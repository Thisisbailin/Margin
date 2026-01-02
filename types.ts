
// Domain Types for Margin - Material Evolution Edition

export enum UserProficiency {
  Beginner = 'beginner',
  Intermediate = 'intermediate',
  Advanced = 'advanced'
}

export enum Familiarity {
  Unknown = 0,
  Seen = 1,
  Familiar = 2,
  Mastered = 3
}

export enum MaterialType {
  Book = 'book',
  Article = 'article'
}

export type PanelState = 'collapsed' | 'default' | 'expanded';
export type TopographyView = 'content' | 'memory' | 'reality';

export interface ModelConfig {
  lexical: string;   
  contextual: string; 
  synthesis: string;  
}

export interface MemoryInteraction {
  timestamp: number;
  occurrenceId: string;
  type: 'implicit' | 'explicit'; 
  weight: number; 
}

export interface VocabularyStat {
  lemma: string;
  totalOccurrences: number; 
  relativeDifficulty: number; 
  firstDiscoveryProgress: number; 
  masteryScore: number;    
  implicitScore: number;   
  explicitScore: number;   
  familiarity: Familiarity; 
  reviewCount: number;     
  interactions: MemoryInteraction[];
  definition?: string; 
  lastEncounterDate: number;
}

export interface LandscapeStats {
  uniqueTokens: number;
  totalTokens: number;
  ttr: number; 
  difficultyScore: number; 
}

export interface WordOccurrence {
  id: string;      
  text: string;    
  lemma: string;   
  pos: string;     
  masteryScore: number; 
}

export interface Sentence {
  id: string;
  text: string;
  tokens: WordOccurrence[];
}

export interface Paragraph {
  id: string;
  type: 'prose' | 'poetry' | 'dialogue'; 
  sentences: Sentence[];
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  content: Paragraph[];
}

export interface Book {
  id: string;
  type: MaterialType; // 新增：区分书籍与文章
  title: string;
  author: string;
  language: string;
  chapters: Chapter[]; 
  progress: number; 
  landscape?: LandscapeStats; 
  // 生产环境元数据预留
  wordCount?: number;
  readingTime?: number; // 分钟
  sourceUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  books: Book[];
  vocabularyStats: Record<string, VocabularyStat>; 
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  type: 'annotation' | 'chat' | 'advice';
  quickDefinition?: string;
}

export interface AnnotationContext {
  targetSentence: string;
  surroundingContext: string;
  bookTitle: string;
  author: string;
  language: string;
  projectName: string;
  projectDescription: string;
  proficiency: UserProficiency;
  targetMastery: number; 
  isFocusedLookup: boolean; 
}

export interface LexiconItem extends VocabularyStat {
  count: number; 
  occurrences: any[];
}
