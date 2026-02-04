const STORAGE_KEY = "margin_agent_default_model_v1";

export const DEFAULT_AGENT_MODEL = "qwen-plus";

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const loadDefaultAgentModel = (): string => {
  if (!canUseStorage()) return DEFAULT_AGENT_MODEL;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT_MODEL;
    const trimmed = raw.trim();
    return trimmed || DEFAULT_AGENT_MODEL;
  } catch {
    return DEFAULT_AGENT_MODEL;
  }
};

export const saveDefaultAgentModel = (model: string) => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, model || DEFAULT_AGENT_MODEL);
  } catch {}
};
