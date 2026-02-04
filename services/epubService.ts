import JSZip from 'jszip';
import type { RawBlockInput, RawSectionInput, RawSpanInput } from './documentBuilder';
import type { TocEntry } from '../types';

const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'li', 'aside']);
const listTags = new Set(['ul', 'ol']);
const containerTags = new Set(['div', 'section', 'article']);

const markForTag = (tag: string): ('bold' | 'italic' | 'underline' | 'quote')[] => {
  if (tag === 'strong' || tag === 'b') return ['bold'];
  if (tag === 'em' || tag === 'i') return ['italic'];
  if (tag === 'u') return ['underline'];
  if (tag === 'q') return ['quote'];
  return [];
};

const mergeMarks = (
  parent: ('bold' | 'italic' | 'underline' | 'quote')[],
  addition: ('bold' | 'italic' | 'underline' | 'quote')[]
) => {
  const set = new Set([...parent, ...addition]);
  return Array.from(set);
};

const extractAlign = (el: Element): 'left' | 'center' | 'right' | 'justify' | undefined => {
  const align = (el.getAttribute('align') || '').toLowerCase();
  if (align === 'left' || align === 'center' || align === 'right' || align === 'justify') return align;
  const style = (el.getAttribute('style') || '').toLowerCase();
  const match = style.match(/text-align:\s*(left|center|right|justify)/);
  if (match) return match[1] as any;
  const classes = classTokens(el);
  if (classes.some((c) => c.includes('text-center') || c.includes('align-center') || c === 'center')) return 'center';
  if (classes.some((c) => c.includes('text-right') || c.includes('align-right') || c === 'right')) return 'right';
  if (classes.some((c) => c.includes('text-left') || c.includes('align-left') || c === 'left')) return 'left';
  if (classes.some((c) => c.includes('text-justify') || c.includes('align-justify') || c === 'justify')) return 'justify';
  return undefined;
};

const classTokens = (el: Element) => (el.getAttribute('class') || '').toLowerCase().split(/\s+/).filter(Boolean);

const detectNoteType = (el: Element): 'footnote' | 'endnote' | undefined => {
  const tag = el.tagName.toLowerCase();
  const classes = classTokens(el);
  const id = (el.getAttribute('id') || '').toLowerCase();
  const epubType = (el.getAttribute('epub:type') || '').toLowerCase();

  const isEndnote =
    classes.some((c) => c.includes('endnote') || c.includes('end-note')) ||
    id.includes('endnote') ||
    epubType.includes('endnote');
  if (isEndnote) return 'endnote';

  const isFootnote =
    classes.some((c) => c.includes('footnote') || c.includes('foot-note') || c.includes('note')) ||
    id.includes('footnote') ||
    epubType.includes('footnote') ||
    tag === 'aside';
  if (isFootnote) return 'footnote';

  return undefined;
};

const detectBlockType = (el: Element, defaultType: RawBlockInput['type']): RawBlockInput['type'] => {
  const tag = el.tagName.toLowerCase();
  const classes = classTokens(el);

  if (tag === 'blockquote' || classes.some((c) => c.includes('quote') || c.includes('blockquote') || c.includes('epigraph'))) {
    return 'quote';
  }
  if (tag === 'pre' || classes.some((c) => c.includes('poem') || c.includes('poetry') || c.includes('verse'))) {
    return 'poetry';
  }
  if (tag === 'li' || classes.some((c) => c.includes('list') || c.includes('bullet'))) {
    return 'list';
  }
  if (tag.startsWith('h') || classes.some((c) => c.includes('title') || c.includes('heading') || c.includes('chapter'))) {
    return 'heading';
  }
  return defaultType;
};

const extractHeadingLevel = (el: Element): number | undefined => {
  const tag = el.tagName.toLowerCase();
  if (tag.startsWith('h')) {
    const level = Number(tag.replace('h', ''));
    if (!Number.isNaN(level)) return level;
  }
  const classes = classTokens(el);
  const levelToken = classes.find((c) => c.startsWith('h') && c.length <= 3);
  if (levelToken) {
    const level = Number(levelToken.replace('h', ''));
    if (!Number.isNaN(level)) return level;
  }
  return undefined;
};

const normalizeText = (text: string, preserveNewlines: boolean) => {
  if (preserveNewlines) {
    return text.replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  }
  return text.replace(/\s+/g, ' ').trim();
};

const extractStyleValue = (el: Element, property: string): string | undefined => {
  const style = (el.getAttribute('style') || '').toLowerCase();
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`));
  return match ? match[1].trim() : undefined;
};

const normalizeCssSize = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === '0') return '0';
  if (/^[0-9.]+$/.test(trimmed)) return `${trimmed}em`;
  return trimmed;
};

const parseMarginShorthand = (value?: string) => {
  if (!value) return { top: undefined, bottom: undefined };
  const parts = value.split(/\s+/).filter(Boolean).map((part) => normalizeCssSize(part));
  if (!parts.length) return { top: undefined, bottom: undefined };
  if (parts.length === 1) return { top: parts[0], bottom: parts[0] };
  if (parts.length === 2) return { top: parts[0], bottom: parts[0] };
  if (parts.length === 3) return { top: parts[0], bottom: parts[2] };
  return { top: parts[0], bottom: parts[2] };
};

const extractSpacingFromClasses = (el: Element) => {
  const classes = classTokens(el);
  let before: string | undefined;
  let after: string | undefined;
  const presets: Record<string, string> = {
    small: '0.5rem',
    sm: '0.5rem',
    medium: '1rem',
    md: '1rem',
    large: '1.5rem',
    lg: '1.5rem',
    xl: '2rem'
  };

  const applySpacing = (key: string, value?: string) => {
    if (!value) return;
    if (
      key === 'mt' ||
      key === 'margin-top' ||
      key === 'space-before' ||
      key === 'before' ||
      key === 'top' ||
      key === 'para-before'
    ) {
      before = value;
    }
    if (
      key === 'mb' ||
      key === 'margin-bottom' ||
      key === 'space-after' ||
      key === 'after' ||
      key === 'bottom' ||
      key === 'para-after'
    ) {
      after = value;
    }
  };

  classes.forEach((cls) => {
    const numericMatch = cls.match(
      /^(mt|mb|margin-top|margin-bottom|space-before|space-after|before|after|top|bottom|para-before|para-after)-?([0-9.]+)(px|em|rem|pt)?$/
    );
    if (numericMatch) {
      const [, key, rawValue, unit] = numericMatch;
      const value = `${rawValue}${unit || 'px'}`;
      applySpacing(key, value);
      return;
    }

    const presetMatch = cls.match(
      /^(mt|mb|margin-top|margin-bottom|space-before|space-after|before|after|top|bottom|para-before|para-after)-?(small|sm|medium|md|large|lg|xl)$/
    );
    if (presetMatch) {
      const [, key, size] = presetMatch;
      applySpacing(key, presets[size]);
    }
  });
  return { before, after };
};

const extractSpacing = (el: Element): { before?: string; after?: string } => {
  const marginTop = normalizeCssSize(extractStyleValue(el, 'margin-top'));
  const marginBottom = normalizeCssSize(extractStyleValue(el, 'margin-bottom'));
  const margin = parseMarginShorthand(extractStyleValue(el, 'margin'));
  const classSpacing = extractSpacingFromClasses(el);
  return {
    before: marginTop || margin.top || classSpacing.before,
    after: marginBottom || margin.bottom || classSpacing.after
  };
};

const extractIndent = (el: Element): { value: string; kind: 'text' | 'margin' } | undefined => {
  const indent = normalizeCssSize(extractStyleValue(el, 'text-indent'));
  if (indent) return { value: indent, kind: 'text' };
  const margin = normalizeCssSize(extractStyleValue(el, 'margin-left'));
  if (margin) return { value: margin, kind: 'margin' };
  return undefined;
};

const extractLineHeight = (el: Element): string | undefined => extractStyleValue(el, 'line-height');

const collectSourceIds = (el: Element): string[] | undefined => {
  const ids = new Set<string>();
  const id = el.getAttribute('id');
  if (id) ids.add(id);
  const name = el.getAttribute('name');
  if (name) ids.add(name);
  el.querySelectorAll('[id]').forEach((node) => {
    const nodeId = (node as Element).getAttribute('id');
    if (nodeId) ids.add(nodeId);
  });
  el.querySelectorAll('a[name]').forEach((node) => {
    const nodeName = (node as Element).getAttribute('name');
    if (nodeName) ids.add(nodeName);
  });
  return ids.size ? Array.from(ids) : undefined;
};

const stripFragment = (href: string) => href.split('#')[0];
const splitHref = (href: string) => {
  const [path, fragment] = href.split('#');
  return { path, fragment };
};

const normalizePath = (path: string) => {
  const parts = path.split('/').filter((part) => part.length > 0);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
};

const resolvePath = (basePath: string, href: string) => {
  const cleanHref = stripFragment(href || '');
  if (!cleanHref) return '';
  if (/^[a-z]+:/.test(cleanHref)) return cleanHref;
  if (cleanHref.startsWith('/')) return normalizePath(cleanHref.slice(1));
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '';
  return normalizePath(`${baseDir}${cleanHref}`);
};

const resolveHref = (basePath: string, href: string) => {
  const { path, fragment } = splitHref(href || '');
  const resolved = resolvePath(basePath, path || '');
  if (!resolved) return '';
  return fragment ? `${resolved}#${fragment}` : resolved;
};

const isHtmlItem = (item?: Element | null) => {
  if (!item) return false;
  const mediaType = (item.getAttribute('media-type') || '').toLowerCase();
  const href = (item.getAttribute('href') || '').toLowerCase();
  if (mediaType.includes('html') || mediaType.includes('xhtml+xml')) return true;
  return href.endsWith('.xhtml') || href.endsWith('.html') || href.endsWith('.htm');
};

const buildSpansFromNode = (
  node: Node,
  inheritedMarks: ('bold' | 'italic' | 'underline' | 'quote')[]
): RawSpanInput[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text.trim()) return [];
    return [{ text, marks: inheritedMarks.length ? inheritedMarks : undefined }];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    return [{ text: '\n', marks: inheritedMarks.length ? inheritedMarks : undefined }];
  }

  const nextMarks = mergeMarks(inheritedMarks, markForTag(tag));

  const spans: RawSpanInput[] = [];
  el.childNodes.forEach((child) => {
    spans.push(...buildSpansFromNode(child, nextMarks));
  });
  return spans;
};

const splitSpanBySentences = (span: RawSpanInput, preserveNewlines: boolean): RawSpanInput[] => {
  const raw = normalizeText(span.text, preserveNewlines);
  if (!raw) return [];

  if (preserveNewlines && raw.includes('\n')) {
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ text: line, marks: span.marks }));
  }

  const sentenceRegex = /[^.!?。！？]+[.!?。！？]?/g;
  const matches = raw.match(sentenceRegex) || [raw];
  return matches.map((sentence) => ({ text: sentence.trim(), marks: span.marks }));
};

const normalizeSpans = (spans: RawSpanInput[], preserveNewlines: boolean) => {
  const expanded = spans.flatMap((span) => splitSpanBySentences(span, preserveNewlines));
  return expanded.filter((span) => span.text && span.text.trim());
};

const normalizeHeadingText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

const extractBlockText = (block: RawBlockInput) =>
  block.spans.map((span) => span.text).join(' ').replace(/\s+/g, ' ').trim();

const buildBlockFromElement = (el: Element): RawBlockInput | null => {
  const tag = el.tagName.toLowerCase();
  if (!blockTags.has(tag)) return null;

  const spans = normalizeSpans(buildSpansFromNode(el, []), tag === 'pre');
  if (!spans.length) return null;

  const noteType = detectNoteType(el);
  const defaultType: RawBlockInput['type'] = 'paragraph';
  const type = noteType ? 'quote' : detectBlockType(el, defaultType);
  const level = type === 'heading' ? extractHeadingLevel(el) : undefined;

  const indent = extractIndent(el);
  const lineHeight = extractLineHeight(el);
  const spacing = extractSpacing(el);
  const sourceIds = collectSourceIds(el);

  return {
    type,
    level,
    align: extractAlign(el),
    spans,
    ...(indent ? { indent: indent.value, indentKind: indent.kind } : {}),
    ...(lineHeight !== undefined ? { lineHeight } : {}),
    ...(spacing.before ? { spacingBefore: spacing.before } : {}),
    ...(spacing.after ? { spacingAfter: spacing.after } : {}),
    ...(sourceIds ? { sourceIds } : {}),
    ...(noteType ? { noteType } : {})
  };
};

const collectBlocks = (root: Element): RawBlockInput[] => {
  const blocks: RawBlockInput[] = [];

  const walk = (node: Element) => {
    const tag = node.tagName.toLowerCase();

    if (listTags.has(tag)) {
      Array.from(node.querySelectorAll('li')).forEach((li) => {
        const block = buildBlockFromElement(li);
        if (block) blocks.push(block);
      });
      return;
    }

    if (blockTags.has(tag)) {
      const block = buildBlockFromElement(node);
      if (block) blocks.push(block);
      return;
    }

    if (containerTags.has(tag)) {
      const hasBlockChildren = Array.from(node.children).some((child) => blockTags.has(child.tagName.toLowerCase()) || listTags.has(child.tagName.toLowerCase()));
      if (!hasBlockChildren) {
        const spans = normalizeSpans(buildSpansFromNode(node, []), false);
        if (spans.length) {
          const indent = extractIndent(node);
          const lineHeight = extractLineHeight(node);
          const spacing = extractSpacing(node);
          const sourceIds = collectSourceIds(node);
          const noteType = detectNoteType(node);
          blocks.push({
            type: noteType ? 'quote' : detectBlockType(node, 'paragraph'),
            align: extractAlign(node),
            spans,
            ...(indent ? { indent: indent.value, indentKind: indent.kind } : {}),
            ...(lineHeight !== undefined ? { lineHeight } : {}),
            ...(spacing.before ? { spacingBefore: spacing.before } : {}),
            ...(spacing.after ? { spacingAfter: spacing.after } : {}),
            ...(sourceIds ? { sourceIds } : {}),
            ...(noteType ? { noteType } : {})
          });
        }
        return;
      }
    }

    Array.from(node.children).forEach((child) => walk(child as Element));
  };

  walk(root);
  return blocks;
};

export type ParsedEpub = {
  title: string;
  author: string;
  language?: string;
  sections: RawSectionInput[];
  toc: TocEntry[];
};

/**
 * EPUB 解析器：输出符合新数据模型的 Section/Block/Span
 */
export const parseEpubFile = async (file: File): Promise<ParsedEpub> => {
  const zip = await JSZip.loadAsync(file);

  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) throw new Error('Invalid EPUB: Missing container.xml');

  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error('Invalid EPUB: Cannot find OPF path');

  const opfContent = await zip.file(opfPath)?.async('string');
  if (!opfContent) throw new Error('Invalid EPUB: Cannot read OPF');

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfContent, 'text/xml');

  const pickText = (selector: string) => opfDoc.querySelector(selector)?.textContent?.trim();
  const title =
    pickText('dc\\:title') ||
    pickText('title') ||
    file.name;
  const author =
    pickText('dc\\:creator') ||
    pickText('creator') ||
    'Unknown Author';
  const language =
    pickText('dc\\:language') ||
    pickText('language') ||
    undefined;

  const itemrefs = Array.from(opfDoc.querySelectorAll('spine itemref'));
  const manifestItems = Array.from(opfDoc.querySelectorAll('manifest item'));

  const manifestById = new Map<string, Element>();
  manifestItems.forEach((item) => {
    const id = item.getAttribute('id');
    if (id) manifestById.set(id, item);
  });

  const navItem = manifestItems.find((item) => (item.getAttribute('properties') || '').includes('nav'));
  const ncxItem = manifestItems.find((item) => (item.getAttribute('media-type') || '').includes('ncx')) ||
    manifestItems.find((item) => (item.getAttribute('href') || '').toLowerCase().endsWith('.ncx'));

  const tocEntries: { title: string; level: number; href: string }[] = [];

  const collectNavToc = async (href: string) => {
    const navPath = resolvePath(opfPath, href);
    const navContent = await zip.file(navPath)?.async('string');
    if (!navContent) return;
    const navDoc = parser.parseFromString(navContent, 'text/html');
    const navs = Array.from(navDoc.querySelectorAll('nav'));
    const tocNav = navs.find((nav) => {
      const type = nav.getAttribute('epub:type') || nav.getAttribute('type') || '';
      const role = nav.getAttribute('role') || '';
      return type.toLowerCase() === 'toc' || role.toLowerCase() === 'doc-toc';
    }) || navs[0];
    if (!tocNav) return;
    const links = Array.from(tocNav.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    links.forEach((link) => {
      const hrefValue = link.getAttribute('href');
      if (!hrefValue) return;
      const resolved = resolveHref(navPath, hrefValue);
      if (!resolved) return;
      const label = (link.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label) return;
      let level = 1;
      let parent = link.parentElement;
      while (parent && parent !== tocNav) {
        if (parent.tagName.toLowerCase() === 'ol' || parent.tagName.toLowerCase() === 'ul') level += 1;
        parent = parent.parentElement;
      }
      tocEntries.push({ title: label, level, href: resolved });
    });
  };

  const collectNcxToc = async (href: string) => {
    const ncxPath = resolvePath(opfPath, href);
    const ncxContent = await zip.file(ncxPath)?.async('string');
    if (!ncxContent) return;
    const ncxDoc = parser.parseFromString(ncxContent, 'text/xml');
    const navPoints = Array.from(ncxDoc.querySelectorAll('navPoint'));
    navPoints.forEach((point) => {
      const label = point.querySelector('navLabel text')?.textContent?.trim();
      const src = point.querySelector('content')?.getAttribute('src');
      if (!label || !src) return;
      const resolved = resolveHref(ncxPath, src);
      if (!resolved) return;
      let depth = 1;
      let parent = point.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === 'navpoint') depth += 1;
        parent = parent.parentElement;
      }
      tocEntries.push({ title: label, level: depth, href: resolved });
    });
  };

  if (navItem?.getAttribute('href')) {
    await collectNavToc(navItem.getAttribute('href') || '');
  } else if (ncxItem?.getAttribute('href')) {
    await collectNcxToc(ncxItem.getAttribute('href') || '');
  }

  const sections: RawSectionInput[] = [];

  const tocByPath = new Map<string, { title: string; level: number; href: string }[]>();
  tocEntries.forEach((entry) => {
    const base = stripFragment(entry.href);
    if (!base) return;
    const list = tocByPath.get(base) || [];
    list.push(entry);
    tocByPath.set(base, list);
  });

  for (const ref of itemrefs) {
    const id = ref.getAttribute('idref');
    const item = id ? manifestById.get(id) : undefined;
    const href = item?.getAttribute('href');
    const isNav = (item?.getAttribute('properties') || '').includes('nav');

    if (!href || !isHtmlItem(item) || isNav) continue;

    const path = resolvePath(opfPath, href);
    const htmlContent = await zip.file(path)?.async('string');
    if (!htmlContent) continue;

    const doc = parser.parseFromString(htmlContent, 'text/html');
    doc.querySelectorAll('script, style, nav, footer, header, svg, img').forEach((s) => s.remove());

    const body = doc.body;
    if (!body) continue;

    const blocks = collectBlocks(body);
    if (!blocks.length) continue;

    const tocItemsForPath = tocByPath.get(path);
    const tocItem = tocItemsForPath?.[0];
    const heading = body.querySelector('h1, h2, h3')?.textContent?.trim();
    const docTitle = doc.querySelector('title')?.textContent?.trim();
    const sectionTitle = tocItem?.title || heading || docTitle || `Chapter ${sections.length + 1}`;

    if (blocks.length && blocks[0].type === 'heading') {
      const firstHeadingText = extractBlockText(blocks[0]);
      if (normalizeHeadingText(firstHeadingText) === normalizeHeadingText(sectionTitle)) {
        blocks.shift();
      }
    }

    sections.push({
      title: sectionTitle,
      sourcePath: path,
      blocks
    });

  }

  if (sections.length === 0) {
    throw new Error('EPUB parsing produced no readable sections.');
  }

  const toc: TocEntry[] = tocEntries.length
    ? tocEntries.map((entry, idx) => ({
        id: `toc-${idx}`,
        title: entry.title,
        level: entry.level,
        href: entry.href
      }))
    : sections.map((section, idx) => ({
        id: `toc-${idx}`,
        title: section.title,
        level: 1,
        href: section.sourcePath
      }));

  return { title, author, language, sections, toc };
};
