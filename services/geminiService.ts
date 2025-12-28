import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProficiency, Project, AnnotationContext, AgentMessage } from "../types";

// Obtaining API key and initializing client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type OnStreamUpdate = (fullText: string) => void;

const getProficiencyInstruction = (level: UserProficiency) => {
  switch (level) {
    case UserProficiency.Beginner:
      return `**角色设定**: 亲切耐心的语言导师。帮助用户克服语言障碍。剖析长难句，遇到生词提供简明释义。语言风格简单、直白。`;
    case UserProficiency.Intermediate:
      return `**角色设定**: 资深编辑 or 文学顾问。挖掘熟词生义、固定搭配和习语。分析逻辑连接词。鼓励在语境中猜测。`;
    case UserProficiency.Advanced:
      return `**角色设定**: 批判性思维学术同行。聚焦于修辞、哲学、文化隐喻、互文性。直接进入学术级洞见。风格深邃。`;
  }
};

export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate
): Promise<string> => {
  if (!process.env.API_KEY) {
    const mockResponse = `结合《${contextData.bookTitle}》语境：作者在这里使用了微妙的呼应。1. 微观视角：词语选择精准。2. 项目关联：呼应了“${contextData.projectName}”中的核心问题。`;
    let currentText = "";
    for (const char of mockResponse.split("")) {
      await new Promise(r => setTimeout(r, 15)); 
      currentText += char;
      onUpdate(currentText);
    }
    return currentText;
  }

  try {
    const instruction = getProficiencyInstruction(contextData.proficiency);
    const prompt = `你是一款名为 Margin 的 AI 深度阅读助手。理念：文本细读 & 语境至上。\n\n【用户画像】\n语言水平: ${contextData.proficiency}\n${instruction}\n\n【阅读项目】\n项目: ${contextData.projectName}\n议题: ${contextData.projectDescription}\n\n【书籍语境】\n书: 《${contextData.bookTitle}》\n作者: ${contextData.author}\n\n【上下文文本流】\n... ${contextData.surroundingContext} ...\n目标句: "${contextData.targetSentence}"\n\n【指令】\n${userPrompt}\n\n输出语言：中文。保持 Margin 的理性、深邃特点。`;

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

export const streamProjectChat = async (
  project: Project,
  history: AgentMessage[],
  onUpdate: OnStreamUpdate
): Promise<string> => {
   if (!process.env.API_KEY) {
      const mock = `这是一个基于“${project.name}”的洞察。你提到的关于《${project.books[0].title}》的问题触及了核心。我们尝试构建一种关于“社会生产力”的讨论。`;
      let currentText = "";
      for (const char of mock.split("")) {
        await new Promise(r => setTimeout(r, 15)); 
        currentText += char;
        onUpdate(currentText);
      }
      return currentText;
   }

   try {
    const bookList = project.books.map(b => `《${b.title}》- ${b.author}`).join(", ");
    const conversationHistory = history.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join("\n");
    
    const prompt = `你是 Margin 项目导师。你正在协助用户进行跨文本的综合深度阅读讨论。你拥有“连贯记忆”，应基于先前的对话内容和当前的项目脉络进行回答。\n\n【项目背景】\n名称: ${project.name}\n议题: ${project.description}\n涉及文本: ${bookList}\n\n【对话历史/连贯记忆】\n${conversationHistory}\n\n【当前任务】\n基于项目内的所有书籍及其相互关系，深度回答用户的最新询问。挖掘文本间的逻辑联系与批判性视角。直接切入重点。输出语言：中文。`;

    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let fullText = "";
    for await (const chunk of result) {
        if (chunk.text) { fullText += chunk.text; onUpdate(fullText); }
    }
    return fullText;
   } catch (error) { return "无法生成项目洞察。"; }
};

export const streamProjectAdvice = async (
  project: Project,
  onUpdate: OnStreamUpdate
): Promise<string> => {
   if (!process.env.API_KEY) {
      const mock = `建议：先确立核心论点，再追溯历史。`;
      let currentText = "";
      for (const char of mock.split("")) {
        await new Promise(r => setTimeout(r, 20)); 
        currentText += char;
        onUpdate(currentText);
      }
      return currentText;
   }
   try {
    const prompt = `分析项目建议: ${project.name}, ${project.description}. 请给出专业阅读路径建议. 中文.`;
    const result = await ai.models.generateContentStream({ model: 'gemini-3-flash-preview', contents: prompt });
    let fullText = "";
    for await (const chunk of result) { if (chunk.text) { fullText += chunk.text; onUpdate(fullText); } }
    return fullText;
   } catch (error) { return "无法生成建议。"; }
};

export const generateWordDefinition = async (word: string): Promise<string> => {
  if (!process.env.API_KEY) {
    await new Promise(r => setTimeout(r, 500));
    return `**${word}**\n\n1. (n.) 模拟释义.`;
  }
  try {
    const prompt = `为 "${word}" 提供简洁中文释义：词性, 含义, 音标.`;
    const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text || "无法生成释义";
  } catch (e) { return "获取释义失败"; }
};