import { Project, AnnotationContext, AgentMessage } from "../types";
import { streamAgent, type AgentMessage as AgentHistoryMessage } from "./agentClient";
import { loadDefaultAgentModel } from "./agentConfig";

type OnStreamUpdate = (fullText: string) => void;

const mapHistory = (history: AgentMessage[]): AgentHistoryMessage[] =>
  history.map((h) => ({
    role: h.role === "agent" ? "assistant" : h.role,
    content: h.content
  }));

/**
 * L2: 语境批注 - 专注于当前文本片段的文学解析 (Margin Agent 核心逻辑)
 */
export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate,
  metadata?: Record<string, string>,
  authToken?: string
): Promise<string> => {
  try {
    return await streamAgent(
      {
        task: "annotation",
        input: userPrompt,
        context: contextData,
        model: loadDefaultAgentModel(),
        metadata: {
          source: "app",
          feature: "annotation",
          ...(metadata || {})
        }
      },
      (fullText) => onUpdate(fullText),
      authToken
    );
  } catch {
    return "解析中断，请稍后重试。";
  }
};

/**
 * L3: 项目合成 - 高性能思考，跨文本关联分析 (Project Agent 专用)
 */
export const streamProjectChat = async (
  project: Project,
  history: AgentMessage[],
  onUpdate: OnStreamUpdate,
  metadata?: Record<string, string>,
  authToken?: string
): Promise<string> => {
  try {
    return await streamAgent(
      {
        task: "project",
        input: history[history.length - 1]?.content || "",
        context: {
          projectName: project.name,
          projectDescription: project.description
        },
        history: mapHistory(history),
        model: loadDefaultAgentModel(),
        metadata: {
          source: "app",
          feature: "project",
          ...(metadata || {})
        }
      },
      (fullText) => onUpdate(fullText),
      authToken
    );
  } catch {
    return "智能生成失败，可能由于 API 限制或权限问题。";
  }
};
