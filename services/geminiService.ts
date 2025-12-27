import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProficiency, Project, AnnotationContext } from "../types";

const apiKey = process.env.API_KEY || 'mock-key'; 
const ai = new GoogleGenAI({ apiKey });

// Stream handler callback type
type OnStreamUpdate = (fullText: string) => void;

// Helper to get system instruction based on proficiency
const getProficiencyInstruction = (level: UserProficiency) => {
  switch (level) {
    case UserProficiency.Beginner:
      return `
        **角色设定**: 亲切耐心的语言导师。
        **核心任务**: 帮助用户克服语言障碍，建立信心。
        **指导原则**:
        1. 解释基础语法结构，剖析长难句。
        2. 遇到生词（哪怕是常见的）也要提供简明释义。
        3. 语言风格要简单、直白。
      `;
    case UserProficiency.Intermediate:
      return `
        **角色设定**: 资深编辑或文学顾问。
        **核心任务**: 帮助用户从“读懂字面”跨越到“读懂含义”。
        **指导原则**:
        1. **不要**解释简单的基础词汇（如 the, is, basic nouns）。
        2. 重点挖掘“熟词生义”、固定搭配（Collocations）和习语。
        3. 分析句子内部的逻辑连接词。
        4. 鼓励用户在语境中猜测词义。
      `;
    case UserProficiency.Advanced:
      return `
        **角色设定**: 具有批判性思维的学术同行。
        **核心任务**: 进行文本细读（Close Reading），探讨深层意涵。
        **指导原则**:
        1. 完全忽略语言障碍，假设用户能读懂字面意思。
        2. 聚焦于修辞手法、哲学概念、文化隐喻、互文性（Intertextuality）。
        3. 结合项目背景，提供学术级别的洞见。
        4. 语言风格可以是深邃的、思辨的。
      `;
  }
};

export const streamAnnotation = async (
  contextData: AnnotationContext,
  userPrompt: string,
  onUpdate: OnStreamUpdate
): Promise<string> => {
  
  // MOCK MODE
  if (apiKey === 'mock-key') {
    const mockPrefix = contextData.proficiency === UserProficiency.Advanced ? "【深度细读】" : "【语境解析】";
    const mockResponse = `${mockPrefix} 结合《${contextData.bookTitle}》的语境，我们来看这句话。\n\n作者在这里使用了“${contextData.targetSentence.substring(0, 10)}...”这一表述，与其上文提到的逻辑形成了微妙的呼应。\n\n1. **微观视角**: \n注意这里词语的选择...\n\n2. **项目关联**: \n这正好呼应了我们在“${contextData.projectName}”中探讨的核心问题...`;
    
    let currentText = "";
    const words = mockResponse.split("");
    for (const char of words) {
      await new Promise(r => setTimeout(r, 20)); 
      currentText += char;
      onUpdate(currentText);
    }
    return currentText;
  }

  try {
    const instruction = getProficiencyInstruction(contextData.proficiency);

    const prompt = `
      你是一款名为 Margin 的深度阅读 AI 助手。你的核心理念是“文本细读 (Close Reading)”和“语境至上”。
      
      ---
      【用户画像】
      语言水平: ${contextData.proficiency}
      ${instruction}

      ---
      【宏观语境：阅读项目】
      项目名称: ${contextData.projectName}
      项目核心议题: ${contextData.projectDescription}
      *在解析时，请尝试将文本内容与该项目的核心议题建立联系（如果相关）。*

      ---
      【中观语境：书籍信息】
      书籍: 《${contextData.bookTitle}》
      作者: ${contextData.author}

      ---
      【微观语境：文本流】
      *这是目标句子及其前后的上下文，请参考这些内容来理解指代关系和逻辑流，但主要针对目标句子进行解析。*
      
      ... ${contextData.surroundingContext} ...

      **目标句子 (Target)**: "${contextData.targetSentence}"

      ---
      【用户具体指令】
      ${userPrompt}

      ---
      【输出要求】
      1. **严禁**使用客套话（如“你好”、“很高兴为您解答”）。直接进入分析。
      2. 格式清晰，使用 Markdown 分段。
      3. 保持 Margin 的极简、理性和深邃风格。
      4. 输出语言：中文。
    `;

    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let fullText = "";
    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
            fullText += c.text;
            onUpdate(fullText);
        }
    }
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    const errorMsg = "连接 Margin 深度解析服务时发生错误。";
    onUpdate(errorMsg);
    return errorMsg;
  }
};

export const streamProjectAdvice = async (
  project: Project,
  onUpdate: OnStreamUpdate
): Promise<string> => {
   // Mock for demo consistency
   if (apiKey === 'mock-key') {
      const mock = `基于您当前的“${project.name}”项目，我建议的阅读路径如下：\n\n1. 首先从《Is a Museum a Factory?》开始，确立核心论点。\n2. 接着阅读本雅明，追溯历史根源。\n\n注意：这个书单涵盖了从现代主义到后现代媒介理论的转变，请关注“凝视（Gaze）”这一概念的演变。`;
      let currentText = "";
      for (const char of mock.split("")) {
        await new Promise(r => setTimeout(r, 20)); 
        currentText += char;
        onUpdate(currentText);
      }
      return currentText;
   }

   try {
    const bookList = project.books.map(b => `《${b.title}》 by ${b.author}`).join(", ");
    const prompt = `
      作为 Margin 的阅读项目导师，请分析以下阅读项目。
      **不要打招呼，直接给出建议。**

      项目名称: ${project.name}
      项目描述: ${project.description}
      包含书籍: ${bookList}

      请给出专业的阅读建议。包括：
      1. 阅读顺序建议。
      2. 这些书之间的核心关联概念。
      3. 阅读时需要特别注意的宏观问题。
      请用中文回答。
    `;

    const result = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    let fullText = "";
    for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
            fullText += c.text;
            onUpdate(fullText);
        }
    }
    return fullText;
   } catch (error) {
     return "无法生成项目建议。";
   }
};

export const generateWordDefinition = async (word: string): Promise<string> => {
  if (apiKey === 'mock-key') {
    await new Promise(r => setTimeout(r, 1000));
    return `**${word}**\n\n1. (n.) 模拟释义 (Mock Definition)。\n2. 这是一个在没有 API Key 时显示的占位符。`;
  }

  try {
    const prompt = `
      请为英语单词 "${word}" 提供一个简洁的中文词典释义。
      不需要例句，只需要：
      1. 词性 (Part of Speech)
      2. 核心中文含义 (Concise definitions)
      3. 英文发音 (音标)
      保持格式紧凑，适合显示在抽认卡背面。
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text || "无法生成释义";
  } catch (e) {
    console.error(e);
    return "获取释义失败";
  }
};