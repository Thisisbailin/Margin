import {
  Block,
  BlockType,
  Document,
  DocumentType,
  InteractionLog,
  LexemeIndex,
  LexemeStat,
  Occurrence,
  OccurrenceIndex,
  Section,
  Span,
  Token
} from '../types';

export type RawSpanInput = {
  text: string;
  marks?: ('bold' | 'italic' | 'underline' | 'quote')[];
};

export type RawBlockInput = {
  type: BlockType;
  level?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  indent?: string;
  indentKind?: 'text' | 'margin';
  lineHeight?: string;
  spacingBefore?: string;
  spacingAfter?: string;
  sourceIds?: string[];
  noteType?: 'footnote' | 'endnote';
  spans: RawSpanInput[];
};

export type RawSectionInput = {
  title: string;
  sourcePath?: string;
  blocks: RawBlockInput[];
};

const cleanLemma = (text: string) => text.replace(/[.,!?;:«»"()\[\]{}]/g, '').toLowerCase();

const splitIntoSentences = (text: string) => {
  const matches = text.match(/[^.!?]+[.!?]*/g);
  return (matches || [text]).map((s) => s.trim()).filter(Boolean);
};

const tokensFromSpan = (docId: string, sIdx: number, bIdx: number, spIdx: number, text: string): Token[] => {
  const words = text.split(/\s+/).filter(Boolean);
  return words.map((w, tIdx) => ({
    id: `${docId}-s${sIdx}-b${bIdx}-p${spIdx}-t${tIdx}`,
    surface: w,
    lemma: cleanLemma(w),
    position: tIdx
  }));
};

export const buildDocumentFromBlocks = (opts: {
  id: string;
  type: DocumentType;
  title: string;
  author?: string;
  language?: string;
  sections: RawSectionInput[];
  toc?: { title: string; level: number; sectionId?: string; href?: string }[];
}): Document => {
  const sectionBySource = new Map<string, string>();
  const blockBySourceId = new Map<string, string>();
  const sections: Section[] = opts.sections.map((section, sIdx) => {
    const blocks: Block[] = section.blocks.map((block, bIdx) => {
      const spans: Span[] = block.spans
        .map((span, spIdx) => ({
          id: `${opts.id}-s${sIdx}-b${bIdx}-p${spIdx}`,
          text: span.text,
          marks: span.marks,
          tokens: tokensFromSpan(opts.id, sIdx, bIdx, spIdx, span.text)
        }))
        .filter((span) => span.text && span.tokens.length > 0);

      return {
        id: `${opts.id}-s${sIdx}-b${bIdx}`,
        type: block.type,
        level: block.level,
        align: block.align,
        indent: block.indent,
        indentKind: block.indentKind,
        lineHeight: block.lineHeight,
        spacingBefore: block.spacingBefore,
        spacingAfter: block.spacingAfter,
        sourceIds: block.sourceIds,
        noteType: block.noteType,
        spans
      };
    });

    return {
      id: `${opts.id}-s${sIdx}`,
      title: section.title,
      order: sIdx + 1,
      sourcePath: section.sourcePath,
      blocks
    };
  });

  sections.forEach((section) => {
    if (section.sourcePath) {
      sectionBySource.set(section.sourcePath, section.id);
    }
    section.blocks.forEach((block) => {
      block.sourceIds?.forEach((sourceId) => {
        if (sourceId && !blockBySourceId.has(sourceId)) {
          blockBySourceId.set(sourceId, block.id);
        }
      });
    });
  });

  const tocEntries = opts.toc?.length
    ? opts.toc.map((entry, idx) => {
        const [hrefBase, hrefFragment] = entry.href ? entry.href.split('#') : [];
        const sectionId =
          entry.sectionId ||
          (hrefBase ? sectionBySource.get(hrefBase) : undefined) ||
          sections[idx]?.id;
        const anchorId = hrefFragment ? blockBySourceId.get(hrefFragment) : undefined;
        return {
          id: `toc-${idx}`,
          title: entry.title,
          level: entry.level || 1,
          order: idx + 1,
          href: entry.href,
          anchorId,
          sectionId
        };
      })
    : sections.map((section, idx) => ({
        id: `${section.id}-toc`,
        title: section.title,
        level: 1,
        order: idx + 1,
        sectionId: section.id
      }));

  const tocStack: { id: string; level: number }[] = [];
  const tocIdToSectionId = new Map<string, string>();
  tocEntries.forEach((entry) => {
    while (tocStack.length && entry.level <= tocStack[tocStack.length - 1].level) {
      tocStack.pop();
    }
    const parentId = tocStack[tocStack.length - 1]?.id;
    if (parentId) {
      entry.parentId = parentId;
    }
    tocStack.push({ id: entry.id, level: entry.level });
    if (entry.sectionId) {
      tocIdToSectionId.set(entry.id, entry.sectionId);
    }
  });

  const sectionMeta = new Map<string, { level: number; parentId?: string }>();
  tocEntries.forEach((entry) => {
    if (!entry.sectionId || sectionMeta.has(entry.sectionId)) return;
    const parentSectionId = entry.parentId ? tocIdToSectionId.get(entry.parentId) : undefined;
    sectionMeta.set(entry.sectionId, { level: entry.level, parentId: parentSectionId });
  });

  sections.forEach((section) => {
    const meta = sectionMeta.get(section.id);
    if (meta) {
      section.level = meta.level;
      section.parentId = meta.parentId;
    }
  });

  return {
    id: opts.id,
    type: opts.type,
    title: opts.title,
    author: opts.author,
    language: opts.language,
    toc: tocEntries,
    sections
  };
};

export const buildDocumentFromTextSections = (opts: {
  id: string;
  type: DocumentType;
  title: string;
  author?: string;
  language?: string;
  sections: { title: string; content: string }[];
}): Document => {
  const rawSections: RawSectionInput[] = opts.sections.map((section) => {
    const blocks: RawBlockInput[] = section.content.split(/\n\s*\n/).map((blockText) => {
      const sentenceTexts = splitIntoSentences(blockText);
      const spans: RawSpanInput[] = sentenceTexts.map((sentence) => ({
        text: sentence,
        marks: []
      }));
      return {
        type: blockText.includes('"') || blockText.includes('«') ? 'quote' : 'paragraph',
        spans
      };
    });

    return {
      title: section.title,
      blocks
    };
  });

  return buildDocumentFromBlocks({
    id: opts.id,
    type: opts.type,
    title: opts.title,
    author: opts.author,
    language: opts.language,
    sections: rawSections
  });
};

const ensureLexemeStat = (stats: Record<string, LexemeStat>, lemma: string): LexemeStat => {
  if (!stats[lemma]) {
    stats[lemma] = {
      lemma,
      totalInteractions: 0,
      implicitScore: 0,
      explicitScore: 0,
      masteryScore: 0,
      firstEncounterAt: 0,
      firstEncounterOrder: 0,
      lastEncounterAt: 0
    };
  }
  return stats[lemma];
};

export const buildProjectIndexes = (
  documents: Document[],
  seedLexemeIndex?: LexemeIndex,
  seedInteractionLog?: InteractionLog
): { occurrenceIndex: OccurrenceIndex; lexemeIndex: LexemeIndex; interactionLog: InteractionLog } => {
  const occurrenceIndex: OccurrenceIndex = {
    byId: {},
    byLemma: {},
    bySection: {},
    byBlock: {},
    bySpan: {}
  };

  const lexemeIndex: LexemeIndex = {
    stats: { ...(seedLexemeIndex?.stats || {}) }
  };

  const interactionLog: InteractionLog = {
    byOccurrence: { ...(seedInteractionLog?.byOccurrence || {}) },
    byLemma: { ...(seedInteractionLog?.byLemma || {}) }
  };

  documents.forEach((doc) => {
    doc.sections.forEach((section) => {
      section.blocks.forEach((block) => {
        block.spans.forEach((span) => {
          span.tokens.forEach((token, tokenIndex) => {
            const occurrence: Occurrence = {
              id: token.id,
              lemma: token.lemma,
              surface: token.surface,
              documentId: doc.id,
              sectionId: section.id,
              blockId: block.id,
              spanId: span.id,
              tokenIndex
            };

            occurrenceIndex.byId[occurrence.id] = occurrence;
            occurrenceIndex.byLemma[occurrence.lemma] = occurrenceIndex.byLemma[occurrence.lemma] || [];
            occurrenceIndex.byLemma[occurrence.lemma].push(occurrence.id);
            occurrenceIndex.bySection[section.id] = occurrenceIndex.bySection[section.id] || [];
            occurrenceIndex.bySection[section.id].push(occurrence.id);
            occurrenceIndex.byBlock[block.id] = occurrenceIndex.byBlock[block.id] || [];
            occurrenceIndex.byBlock[block.id].push(occurrence.id);
            occurrenceIndex.bySpan[span.id] = occurrenceIndex.bySpan[span.id] || [];
            occurrenceIndex.bySpan[span.id].push(occurrence.id);

            ensureLexemeStat(lexemeIndex.stats, occurrence.lemma);

            if (!interactionLog.byOccurrence[occurrence.id]) {
              interactionLog.byOccurrence[occurrence.id] = [];
            }
            if (!interactionLog.byLemma[occurrence.lemma]) {
              interactionLog.byLemma[occurrence.lemma] = [];
            }
          });
        });
      });
    });
  });

  return { occurrenceIndex, lexemeIndex, interactionLog };
};
