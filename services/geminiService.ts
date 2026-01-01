
import { GoogleGenAI } from "@google/genai";
import { UserProficiency, Project, AnnotationContext, AgentMessage } from "../types";

type OnStreamUpdate = (fullText: string) => void;

export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  if (!process.env.API_KEY) {
    const mockResponse = `【隐形记忆适配】用户对该内容的掌握度为 ${Math.round(contextData.targetMastery * 100)}%。\n\n结合《${contextData.bookTitle}》语境：这里不仅仅是描述，而是一种隐喻。`;
    let currentText = "";
    for (const char of mockResponse.split("")) {
      await new Promise(r => setTimeout(r, 10)); 
      currentText += char;
      onUpdate(currentText);
    }
    return currentText;
  }

  try {
    // 动态调整指令：如果掌握度低，偏向语言解释；掌握度高，偏向文学剖析
    const masteryLevel = contextData.targetMastery;
    const adaptationInstruction = masteryLevel < 0.3 
      ? "用户对该词汇/句式尚不熟悉。请提供清晰的语法拆解、词义辨析，并给出一个简单的同义词。"
      : masteryLevel < 0.7 
        ? "用户已初步掌握该内容。请聚焦于词汇的微妙内涵（熟词生义）以及其在文学语境下的特殊用法。"
        : "用户已完全掌握该内容。跳过基础解释，直接从文本修辞、哲学隐喻、跨文本互文性角度进行深度剖析。";

    const prompt = `你是一款名为 Margin 的 AI 深度阅读助手。你的回应应基于用户的“隐形记忆状态”进行动态调整。
    
【当前上下文】
书: 《${contextData.bookTitle}》(${contextData.language})
语境: "... ${contextData.surroundingContext} ..."
目标: "${contextData.targetSentence}"

【隐形记忆参数】
掌握得分: ${masteryLevel.toFixed(2)} (0=陌生, 1=大师)
是否专门查询词汇: ${contextData.isFocusedLookup ? "是" : "否"}

【动态适配指令】
${adaptationInstruction}

【通用角色要求】
1. 使用中文回答。
2. 保持理性、深邃、简约的风格。
3. 挖掘原始语言（${contextData.language}）的独特文化张力。

用户请求: ${userPrompt}`;

    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let fullText = "";
    for await (const chunk of result) {
        if (chunk.text) { fullText += chunk.text; onUpdate(fullText); }
    }
    return fullText;
  } catch (error) { return "连接错误。"; }
};

// ... 其他函数保持不变
export const streamProjectChat = async (project: Project, history: AgentMessage[], onUpdate: OnStreamUpdate): Promise<string> => {
   const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
   const bookList = project.books.map(b => `《${b.title}》`).join(", ");
   const prompt = `你是 Margin 项目导师。基于项目《${project.name}》进行跨文本讨论。历史：${history.map(h => h.content).join("\n")}`;
   try {
     const result = await ai.models.generateContentStream({ model: 'gemini-3-flash-preview', contents: prompt });
     let fullText = "";
     for await (const chunk of result) { if (chunk.text) { fullText += chunk.text; onUpdate(fullText); } }
     return fullText;
   } catch (e) { return "错误"; }
};

export const generateWordDefinition = async (word: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `为 "${word}" 提供简洁中文释义。` });
    return response.text || "";
  } catch (e) { return ""; }
};
