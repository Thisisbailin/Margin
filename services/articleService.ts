
import { GoogleGenAI, Type } from "@google/genai";
import { Chapter, Paragraph, MaterialType, Book } from "../types";

/**
 * 使用 Gemini 3 Flash 进行智能内容提取与结构化转换
 * 它会将原始网页文本清洗并转换为我们的 Chapter 格式
 */
export const ingestArticleContent = async (rawText: string, titleHint: string): Promise<Chapter> => {
  // CRITICAL: Always create a new instance right before the call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  const prompt = `
    你是一个专业的内容摄入引擎。你的任务是将以下从网页抓取的杂乱文本转换为结构化的阅读素材。
    
    任务要求：
    1. 剔除所有与正文无关的内容（如广告、导航、社交分享、版权声明）。
    2. 将正文拆分为段落（Paragraph）。
    3. 将每个段落进一步拆分为句子（Sentence）。
    4. 识别段落类型：'prose' (散文), 'poetry' (诗歌), 或 'dialogue' (对话)。
    5. 仅提取核心正文。

    文章标题参考：${titleHint}
    原始文本：
    ${rawText.substring(0, 15000)} // 截断以防超出 token 限制
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          paragraphs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: "prose, poetry, or dialogue" },
                sentences: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["type", "sentences"]
            }
          }
        },
        required: ["title", "paragraphs"]
      }
    }
  });

  const data = JSON.parse(response.text);
  
  // 将 API 返回的扁平数据转化为我们内部的 Paragraph/Sentence 对象（包含 Token 逻辑）
  const processedParagraphs: Paragraph[] = data.paragraphs.map((p: any, pIdx: number) => {
    return {
      id: `ingested-p-${pIdx}-${Date.now()}`,
      type: p.type as any,
      sentences: p.sentences.map((sText: string, sIdx: number) => {
        const words = sText.trim().split(/\s+/);
        return {
          id: `ingested-s-${pIdx}-${sIdx}-${Date.now()}`,
          text: sText,
          tokens: words.map((w, wIdx) => ({
            id: `ingested-w-${pIdx}-${sIdx}-${wIdx}-${Date.now()}`,
            text: w,
            lemma: w.replace(/[.,!?;:«»"()]/g, '').toLowerCase(),
            pos: 'unknown',
            masteryScore: 0 // 初始掌握度为 0
          }))
        };
      })
    };
  });

  return {
    id: `ch-ingested-${Date.now()}`,
    number: 1,
    title: data.title || titleHint,
    content: processedParagraphs
  };
};
