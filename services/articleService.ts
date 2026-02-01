
import { Chapter, Paragraph } from "../types";
import { generateLLM } from "./llmClient";
import { getModelForTier } from "./llmConfig";

/**
 * 核心逻辑：尝试抓取网页内容
 * 由于 CORS 限制，生产环境通常需要通过 Cloudflare Worker Proxy。
 * 在此演示中，我们尝试直接获取，并提供友好的失败反馈。
 */
const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml'
      },
      // 注意：由于浏览器安全策略，许多站点会拒绝跨域 fetch。
      // 在本地开发或有代理的情况下可工作。
    });
    
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error("Fetch failed, requesting fallback to manual paste.", error);
    throw new Error("Could not access the URL directly due to CORS or site restrictions. Please copy and paste the article text manually.");
  }
};

/**
 * 使用 LLM 进行智能内容提取与结构化转换（Qwen via server）
 */
export const ingestArticleContent = async (
  input: string,
  titleHint: string,
  isUrl: boolean,
  metadata?: Record<string, string>
): Promise<Chapter> => {
  let contentToAnalyze = input;

  if (isUrl) {
    contentToAnalyze = await fetchUrlContent(input);
  }

  const prompt = `
    你是一个专业的内容结构化专家。你收到了以下${isUrl ? 'HTML 源代码' : '原始文本'}。
    
    你的任务：
    1. 提取文章的【标题】(Title) 和 【作者】(Author)。
    2. 提取核心正文内容。请剔除侧边栏、导航栏、底部版权、广告等噪音。
    3. 如果内容是诗歌，请保留每一行（作为单独的句子）并标记段落类型为 'poetry'。
    4. 如果内容包含对话，请识别并标记为 'dialogue'。
    5. 常规文章请标记为 'prose'。
    6. 将内容拆分为段落(paragraphs)，每个段落拆分为句子(sentences)。

    参考标题/来源: ${titleHint} ${isUrl ? `(URL: ${input})` : ''}
    
    待处理内容（截断至 20000 字符）:
    ${contentToAnalyze.substring(0, 20000)}
  `;

  const schemaHint = `
请严格输出 JSON，结构如下：
{
  "title": "string",
  "author": "string(optional)",
  "paragraphs": [
    { "type": "prose|poetry|dialogue", "sentences": ["..."] }
  ]
}
只返回 JSON，不要输出其他文字。`;

  const response = await generateLLM({
    model: getModelForTier("L2") || "L2",
    messages: [
      { role: "system", content: "你是一个严谨的内容结构化引擎，只输出 JSON。" },
      { role: "user", content: `${prompt}\n\n${schemaHint}` },
    ],
    metadata: {
      source: "app",
      feature: "article_ingest",
      ...(metadata || {}),
    },
  });

  const parseJson = (text: string): any => {
    try {
      return JSON.parse(text);
    } catch {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1));
        } catch {}
      }
      return {};
    }
  };

  const data = parseJson(response.text || "");
  
  if (!data.paragraphs || data.paragraphs.length === 0) {
    throw new Error("Failed to extract meaningful paragraphs from the source.");
  }

  const processedParagraphs: Paragraph[] = data.paragraphs.map((p: any, pIdx: number) => {
    return {
      id: `ingested-p-${pIdx}-${Date.now()}`,
      type: (p.type === 'poetry' || p.type === 'dialogue') ? p.type : 'prose',
      sentences: p.sentences.map((sText: string, sIdx: number) => {
        // 词汇化处理
        const words = sText.trim().split(/\s+/).filter(w => w.length > 0);
        return {
          id: `ingested-s-${pIdx}-${sIdx}-${Date.now()}`,
          text: sText,
          tokens: words.map((w, wIdx) => ({
            id: `ingested-w-${pIdx}-${sIdx}-${wIdx}-${Date.now()}`,
            text: w,
            lemma: w.replace(/[.,!?;:«»"()]/g, '').toLowerCase(),
            pos: 'unknown',
            masteryScore: 0
          }))
        };
      })
    };
  });

  return {
    id: `ch-ingested-${Date.now()}`,
    number: 1,
    title: data.title || titleHint,
    subtitle: data.author ? `by ${data.author}` : undefined,
    content: processedParagraphs
  };
};
