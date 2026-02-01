import { AgentRequest, AgentTask } from "./types";
import { LLMMessage } from "../llm";

const defaultModelForTask = (task: AgentTask): string => {
  if (task === "lexicon") return "L1";
  if (task === "project") return "L3";
  return "L2";
};

const stringify = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getContextValue = (context: Record<string, unknown> | undefined, key: string): string => {
  if (!context || !(key in context)) return "";
  return stringify(context[key]);
};

export const buildMessages = (
  request: AgentRequest
): { messages: LLMMessage[]; model: string } => {
  if (Array.isArray(request.messages) && request.messages.length > 0) {
    return {
      messages: request.messages,
      model: request.model || defaultModelForTask(request.task),
    };
  }

  const task = request.task;
  const input = request.input || "";
  const context = request.context || {};
  const history = request.history || [];

  let prompt = input;

  if (task === "lexicon") {
    const sentence = getContextValue(context, "sentence") || getContextValue(context, "surroundingContext");
    prompt = `提供单词 "${input}" 在阅读中的核心中文释义。${sentence ? `参考语境: ${sentence}` : ""} 仅返回释义内容，越简洁越好，控制在15字以内。`;
  }

  if (task === "annotation") {
    const bookTitle = getContextValue(context, "bookTitle") || "Unknown";
    const targetSentence = getContextValue(context, "targetSentence") || input;
    const surrounding = getContextValue(context, "surroundingContext") || targetSentence;
    const mastery = getContextValue(context, "targetMastery");
    const adaptation = mastery
      ? `当前掌握度: ${mastery}`
      : "";

    prompt = `你是一款名为 Margin 的 AI 深度阅读助手。
上下文: 《${bookTitle}》
${adaptation}
指令: 针对语境 "${surrounding}" 中的 "${targetSentence}" 进行详细解读。`;
  }

  if (task === "project") {
    const projectName = getContextValue(context, "projectName") || "Unknown";
    const projectDescription = getContextValue(context, "projectDescription") || "";
    const historyText = history.map((h) => `${h.role}: ${h.content}`).join("\n");
    prompt = `你是 Margin 项目导师。你拥有卓越的逻辑推理和跨文本关联能力。
当前研究项目: 《${projectName}》
项目描述: ${projectDescription}
对话历史: ${historyText}
用户问题: ${input}
请基于上述项目背景，提供深度综合的见解。`;
  }

  if (task === "freeform") {
    prompt = input || "";
  }

  const messages: LLMMessage[] = [{ role: "user", content: prompt }];

  return {
    messages,
    model: request.model || defaultModelForTask(task),
  };
};
