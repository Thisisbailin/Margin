
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * 辅助函数：解码 Base64
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * 辅助函数：解码音频数据 (PCM 格式)
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * 文本清洗：移除 Markdown 格式符号以优化朗读效果
 */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[*#_>`~]/g, '') // 移除 Markdown 符号
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // 移除链接，保留文字
    .replace(/\n+/g, ' ') // 将换行替换为空格
    .trim();
}

let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

/**
 * 停止当前朗读
 */
export const stopSpeech = () => {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch (e) {
      // 忽略已停止的错误
    }
    currentSource = null;
  }
};

/**
 * 使用 Gemini 2.5 TTS 模型朗读文本
 * 限制长度在 500 字符以内以确保 API 稳定性
 */
export const speakText = async (text: string, voiceName: 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' = 'Puck') => {
  stopSpeech();

  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }

  // 清洗并截断文本
  const cleanedText = cleanTextForSpeech(text).substring(0, 500);
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say naturally: ${cleanedText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio && audioContext) {
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1,
      );

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      currentSource = source;
      source.start();
    }
  } catch (error) {
    console.error("TTS API Error:", error);
  }
};

/**
 * 双语朗读
 */
export const speakBilingual = async (original: string, translation: string) => {
  const combined = `Original text: ${original}. Translation: ${translation}`;
  await speakText(combined);
};
