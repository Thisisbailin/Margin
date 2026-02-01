export type LLMModelTier = "L1" | "L2" | "L3";

export type LLMModelSelection = {
  L1?: string;
  L2?: string;
  L3?: string;
};

const STORAGE_KEY = "margin_llm_models_v1";

export const DEFAULT_MODEL_SELECTION: LLMModelSelection = {
  L1: "qwen-plus",
  L2: "qwen-plus",
  L3: "qwen-max",
};

const canUseStorage = () => typeof window !== "undefined" && !!window.localStorage;

export const loadModelSelection = (): LLMModelSelection => {
  if (!canUseStorage()) return { ...DEFAULT_MODEL_SELECTION };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MODEL_SELECTION };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        L1: typeof parsed.L1 === "string" ? parsed.L1 : DEFAULT_MODEL_SELECTION.L1,
        L2: typeof parsed.L2 === "string" ? parsed.L2 : DEFAULT_MODEL_SELECTION.L2,
        L3: typeof parsed.L3 === "string" ? parsed.L3 : DEFAULT_MODEL_SELECTION.L3,
      };
    }
  } catch {}
  return { ...DEFAULT_MODEL_SELECTION };
};

export const saveModelSelection = (selection: LLMModelSelection) => {
  if (!canUseStorage()) return;
  try {
    const next = {
      L1: selection.L1 || DEFAULT_MODEL_SELECTION.L1,
      L2: selection.L2 || DEFAULT_MODEL_SELECTION.L2,
      L3: selection.L3 || DEFAULT_MODEL_SELECTION.L3,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
};

export const getModelForTier = (tier: LLMModelTier): string | undefined => {
  const selection = loadModelSelection();
  return selection[tier];
};
