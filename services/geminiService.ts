
import { GoogleGenAI } from "@google/genai";
import { UserProficiency, Project, AnnotationContext, AgentMessage } from "../types";

type OnStreamUpdate = (fullText: string) => void;

/**
 * 获取最新的 AI 实例
 * 遵循平台规范：每次调用时创建新实例以获取最新的 process.env.API_KEY
 */
const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate
): Promise<string> => {
  if (!process.env.API_KEY) {
    const mockResponse = `【未检测到 API 密钥】请在设置中配置密钥以启用实时 AI 解析。当前显示为离线模拟响应。`;
    let currentText = "";
    for (const char of mockResponse.split("")) {
      await new Promise(r => setTimeout(r, 10)); 
      currentText += char;
      onUpdate(currentText);
    }
    return currentText;
  }

  const ai = getAiClient();

  try {
    const masteryLevel = contextData.targetMastery;
    const adaptationInstruction = masteryLevel < 0.3 
      ? "用户对该内容尚不熟悉。请提供语法拆解、词义辨析。"
      : masteryLevel < 0.7 
        ? "用户已初步掌握。聚焦于词汇的微妙内涵及文学语境用法。"
        : "用户已完全掌握。请从文本修辞、哲学隐喻进行深度剖析。";

    const prompt = `你是一款名为 Margin 的 AI 深度阅读助手。
    
【上下文】
书: 《${contextData.bookTitle}》
语境: "... ${contextData.surroundingContext} ..."
目标: "${contextData.targetSentence}"
掌握度: ${masteryLevel.toFixed(2)}

【指令】
${adaptationInstruction}

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
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found")) {
      return "API 密钥无效或已过期，请在设置中重新选择密钥。";
    }
    return "连接错误，请检查网络或 API 配置。";
  }
};

export const streamProjectChat = async (project: Project, history: AgentMessage[], onUpdate: OnStreamUpdate): Promise<string> => {
   const ai = getAiClient();
   const prompt = `你是 Margin 项目导师。基于项目《${project.name}》进行探讨。历史：${history.map(h => h.content).join("\n")}`;
   try {
     const result = await ai.models.generateContentStream({ model: 'gemini-3-flash-preview', contents: prompt });
     let fullText = "";
     for await (const chunk of result) { if (chunk.text) { fullText += chunk.text; onUpdate(fullText); } }
     return fullText;
   } catch (e) { return "生成失败。"; }
};

export const generateWordDefinition = async (word: string): Promise<string> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: `为 "${word}" 提供简洁中文释义。` 
    });
    return response.text || "";
  } catch (e) { return "暂无释义"; }
};
