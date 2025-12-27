import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UserProficiency, Project } from "../types";

const apiKey = process.env.API_KEY || 'mock-key'; 
const ai = new GoogleGenAI({ apiKey });

// Stream handler callback type
type OnStreamUpdate = (fullText: string) => void;

// Helper to get system instruction based on proficiency
const getProficiencyInstruction = (level: UserProficiency) => {
  switch (level) {
    case UserProficiency.Beginner:
      return `
        用户是语言初学者。
        1. 重点解释基础语法结构和字面含义。
        2. 遇到生词（哪怕是常见的）也要提供简明释义。
        3. 语言风格要亲切、简单、易懂。
        4. 帮助用户建立基本的阅读信心。
      `;
    case UserProficiency.Intermediate:
      return `
        用户是语言进阶学习者（B2/C1水平）。
        1. **不要**解释简单的基础词汇（如 the, is, basic nouns）。
        2. 重点挖掘“熟词生义”、固定搭配（Collocations）和习语。
        3. 分析句子的逻辑连接。
        4. 语言风格要专业但适度，鼓励用户在语境中猜测词义。
      `;
    case UserProficiency.Advanced:
      return `
        用户是语言精通者（C2/母语水平）。
        1. 完全忽略语言障碍，假设用户能读懂字面意思。
        2. **核心任务**是文本细读（Close Reading）和深度分析。
        3. 解析修辞手法、哲学概念、文化隐喻、术语的语境义。
        4. 提供学术级别的背景知识补充。
        5. 语言风格可以是学术的、深邃的、批判性的。
      `;
  }
};

export const streamAnnotation = async (
  sentence: string, 
  context: string,
  userFocus: string,
  proficiency: UserProficiency,
  onUpdate: OnStreamUpdate
): Promise<string> => {
  
  // MOCK MODE
  if (apiKey === 'mock-key') {
    const mockPrefix = proficiency === UserProficiency.Beginner ? "【基础解析】" : proficiency === UserProficiency.Advanced ? "【深度细读】" : "【进阶指引】";
    const mockResponse = `${mockPrefix} 针对您的水平，我们来看这句话...\n\n在此语境下，作者通过“${sentence.substring(0, 10)}...”这一表述，构建了一种独特的张力。\n\n1. **词汇**:\n注意词语的选择...\n\n2. **句法**:\n结构上使用了...`;
    
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
    const prompt = `
      你是一位精通“文本细读”（Close Reading）的专家助手 Margin。
      
      【用户设置】
      当前语言水平: ${proficiency}
      ${getProficiencyInstruction(proficiency)}

      【交互规则】
      1. **严禁**使用任何问候语（如“你好”、“我是Margin”、“很高兴...”）。
      2. **严禁**重复题目或自我介绍。
      3. 直接针对目标句子开始分析，开门见山。
      4. 即使这是第一次对话，也当作我们已经处于深入交流中。

      【上下文】
      文章背景: ${context}
      目标句子: "${sentence}"
      用户关注点: ${userFocus}

      请根据上述要求，用中文对目标句子进行流式解析。
      格式要求：清晰分段，重点突出，Markdown格式。
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
}