
import { Project, AnnotationContext, AgentMessage } from "../types";
import { generateLLM, streamLLM } from "./llmClient";
import { getModelForTier } from "./llmConfig";

type OnStreamUpdate = (fullText: string) => void;

// LLM 统一入口：使用模型层级，具体模型由服务端映射
const MODELS = {
  L1: "L1",
  L2: "L2",
  L3: "L3",
};

const resolveTierModel = (tier: keyof typeof MODELS): string => {
  return getModelForTier(tier) || MODELS[tier];
};

/**
 * L2: 语境批注 - 专注于当前句子和段落的文学解析 (Margin Agent 核心逻辑)
 */
export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate,
  metadata?: Record<string, string>
): Promise<string> => {
  try {
    const masteryLevel = contextData.targetMastery;
    const adaptation = masteryLevel < 0.3 
      ? "语法拆解与词义辨析" 
      : masteryLevel < 0.7 
        ? "词汇内涵与语境用法" 
        : "修辞隐喻与哲学剖析";

    const prompt = `你是一款名为 Margin 的 AI 深度阅读助手。
上下文: 《${contextData.bookTitle}》
当前掌握度: ${masteryLevel.toFixed(2)} (${adaptation})
指令: 针对语境 "${contextData.surroundingContext}" 中的 "${contextData.targetSentence}" 进行详细解读。
${userPrompt}`;

    return await streamLLM(
      {
        model: resolveTierModel("L2"),
        messages: [{ role: "user", content: prompt }],
        metadata: {
          source: "app",
          feature: "annotation",
          ...(metadata || {}),
        },
      },
      (fullText) => onUpdate(fullText)
    );
  } catch (error) {
    return "解析中断，请稍后重试。";
  }
};

/**
 * L3: 项目合成 - 高性能思考，跨文本关联分析 (Project Agent 专用)
 */
export const streamProjectChat = async (project: Project, history: AgentMessage[], onUpdate: OnStreamUpdate, metadata?: Record<string, string>): Promise<string> => {
   const prompt = `你是 Margin 项目导师。你拥有卓越的逻辑推理和跨文本关联能力。
当前研究项目: 《${project.name}》
项目描述: ${project.description}
对话历史: ${history.map(h => `${h.role}: ${h.content}`).join("\n")}
请基于上述项目背景，提供深度综合的见解。`;

   try {
     return await streamLLM(
       {
         model: resolveTierModel("L3"),
         messages: [{ role: "user", content: prompt }],
         metadata: {
           source: "app",
           feature: "project",
           ...(metadata || {}),
         },
       },
       (fullText) => onUpdate(fullText)
     );
   } catch (e) { 
     return "智能生成失败，可能由于 API 限制或权限问题。"; 
   }
};

/**
 * L1: 基础词汇 - 极速获取单词释义 (Terrain 模块专用，不干扰阅读流)
 */
export const generateWordDefinition = async (word: string, context?: string, metadata?: Record<string, string>): Promise<string> => {
  try {
    const response = await generateLLM({
      model: resolveTierModel("L1"),
      messages: [
        {
          role: "user",
          content: `提供单词 "${word}" 在阅读中的核心中文释义。${context ? `参考语境: ${context}` : ""} 仅返回释义内容，越简洁越好，控制在15字以内。`,
        },
      ],
      metadata: {
        source: "app",
        feature: "lexicon",
        ...(metadata || {}),
      },
    });
    return response.text || "暂无释义";
  } catch (e) { 
    return "获取释义失败"; 
  }
};
