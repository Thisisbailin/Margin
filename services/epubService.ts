
import JSZip from 'jszip';
import { Chapter, Paragraph, MaterialType, Book } from "../types";

/**
 * 极简 EPUB 解析器：提取文本以供 Margin 进行词元化
 */
export const parseEpubFile = async (file: File): Promise<{ title: string; author: string; chapters: { title: string; content: string }[] }> => {
  const zip = await JSZip.loadAsync(file);
  
  // 1. 查找 container.xml 以定位 OPF 文件
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Invalid EPUB: Missing container.xml");
  
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("Invalid EPUB: Cannot find OPF path");

  // 2. 解析 OPF 获取元数据和资源清单
  const opfContent = await zip.file(opfPath)?.async("string");
  if (!opfContent) throw new Error("Invalid EPUB: Cannot read OPF");

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfContent, "text/xml");
  
  const title = opfDoc.querySelector("title")?.textContent || file.name;
  const author = opfDoc.querySelector("creator")?.textContent || "Unknown Author";

  // 3. 获取 Spine (阅读顺序) 
  const itemrefs = Array.from(opfDoc.querySelectorAll("spine itemref"));
  const manifestItems = Array.from(opfDoc.querySelectorAll("manifest item"));

  const chapters: { title: string; content: string }[] = [];

  // 为演示目的，我们只解析前 3 个主要章节，避免浏览器内存崩溃
  for (const ref of itemrefs.slice(0, 3)) {
    const id = ref.getAttribute("idref");
    const item = manifestItems.find(i => i.getAttribute("id") === id);
    const href = item?.getAttribute("href");

    if (href) {
      // 处理相对路径
      const path = opfPath.includes('/') 
        ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) + href 
        : href;
      
      const htmlContent = await zip.file(path)?.async("string");
      if (htmlContent) {
        const doc = parser.parseFromString(htmlContent, "text/html");
        // 移除脚本和样式
        doc.querySelectorAll("script, style").forEach(s => s.remove());
        const bodyText = doc.body.innerText || doc.body.textContent || "";
        const chapterTitle = doc.querySelector("h1, h2, h3")?.textContent || `Chapter ${chapters.length + 1}`;
        
        chapters.push({
          title: chapterTitle.trim(),
          content: bodyText.trim()
        });
      }
    }
  }

  return { title, author, chapters };
};
