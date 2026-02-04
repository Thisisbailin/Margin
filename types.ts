// Domain Types for Margin - App Layer Refactor v2

export enum UserProficiency {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced'
}

export type PanelState = 'collapsed' | 'default' | 'expanded';
export type TopographyView = 'content' | 'memory' | 'reality';

export enum DocumentType {
  Book = 'book',
  Article = 'article'
}

export interface TocEntry {
  id: string;
  title: string;
  level: number;
  order?: number;
  parentId?: string;
  href?: string;
  anchorId?: string;
  sectionId?: string;
}

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  author?: string;
  language?: string;
  metadata?: Record<string, string>;
  toc: TocEntry[];
  sections: Section[];
}

export interface Section {
  id: string;
  title: string;
  order: number;
  level?: number;
  parentId?: string;
  sourcePath?: string;
  blocks: Block[];
}

export type BlockType = 'paragraph' | 'heading' | 'quote' | 'poetry' | 'list';

export interface Block {
  id: string;
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
  spans: Span[];
}

export interface Span {
  id: string;
  text: string;
  marks?: ('bold' | 'italic' | 'underline' | 'quote')[];
  tokens: Token[];
}

export interface Token {
  id: string; // same as occurrenceId
  surface: string;
  lemma: string;
  position: number;
}

export interface Occurrence {
  id: string;
  lemma: string;
  surface: string;
  documentId: string;
  sectionId: string;
  blockId: string;
  spanId: string;
  tokenIndex: number;
}

export interface OccurrenceIndex {
  byId: Record<string, Occurrence>;
  byLemma: Record<string, string[]>;
  bySection: Record<string, string[]>;
  byBlock: Record<string, string[]>;
  bySpan: Record<string, string[]>;
}

export interface LexemeStat {
  lemma: string;
  totalInteractions: number;
  implicitScore: number;
  explicitScore: number;
  masteryScore: number;
  firstEncounterAt: number;
  firstEncounterOrder: number;
  lastEncounterAt: number;
  definition?: string;
}

export interface LexemeIndex {
  stats: Record<string, LexemeStat>;
}

export interface Interaction {
  id: string;
  occurrenceId: string;
  lemma: string;
  type: 'implicit' | 'explicit';
  weight: number;
  timestamp: number;
}

export interface InteractionLog {
  byOccurrence: Record<string, Interaction[]>;
  byLemma: Record<string, Interaction[]>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  documents: Document[];
  occurrenceIndex: OccurrenceIndex;
  lexemeIndex: LexemeIndex;
  interactionLog: InteractionLog;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  type: 'annotation' | 'chat' | 'advice';
  quickDefinition?: string;
}

export interface AnnotationContext {
  targetText: string;
  surroundingContext: string;
  documentTitle: string;
  author?: string;
  language?: string;
  projectName: string;
  projectDescription: string;
  proficiency: UserProficiency;
  targetMastery: number;
  isFocusedLookup: boolean;
}

export interface LexemeEntry extends LexemeStat {
  count: number; // total occurrences in text
  firstEncounterProgress: number; // 0-1, derived for visualization
}
