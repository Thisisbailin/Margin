/**
 * 基于浏览器 SpeechSynthesis 的轻量 TTS 实现
 * - 无需第三方密钥
 * - 作为云端 TTS 的轻量替代方案
 */

/**
 * 文本清洗：移除 Markdown 格式符号以优化朗读效果
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[*#_>`~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

const loadVoices = async (): Promise<SpeechSynthesisVoice[]> => {
  if (typeof speechSynthesis === "undefined") return [];
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    cachedVoices = voices;
    return voices;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const handler = () => {
      if (resolved) return;
      resolved = true;
      cachedVoices = speechSynthesis.getVoices();
      speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cachedVoices);
    };
    speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      if (resolved) return;
      resolved = true;
      speechSynthesis.removeEventListener("voiceschanged", handler);
      cachedVoices = speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 500);
  });
};

const pickVoice = (voiceName?: string) => {
  const voices = cachedVoices;
  if (!voices.length) return undefined;
  if (voiceName) {
    const direct = voices.find((voice) => voice.name.includes(voiceName));
    if (direct) return direct;
  }
  const enVoice = voices.find((voice) => voice.lang?.startsWith("en"));
  return enVoice || voices[0];
};

/**
 * 停止当前朗读
 */
export const stopSpeech = () => {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  currentUtterance = null;
};

/**
 * 浏览器 TTS 朗读文本
 * 限制长度在 500 字符以内以确保稳定性
 */
export const speakText = async (
  text: string,
  voiceName: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" = "Puck"
) => {
  stopSpeech();
  if (typeof speechSynthesis === "undefined") {
    console.warn("SpeechSynthesis not supported in this environment.");
    return;
  }

  await loadVoices();

  const cleanedText = cleanTextForSpeech(text).substring(0, 500);
  if (!cleanedText) return;

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  utterance.voice = pickVoice(voiceName);
  utterance.lang = utterance.voice?.lang || "en-US";

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);
};

/**
 * 双语朗读
 */
export const speakBilingual = async (original: string, translation: string) => {
  const combined = `Original text: ${original}. Translation: ${translation}`;
  await speakText(combined);
};
