
// Domain Types for Margin - Linguistic Landscape Edition

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

export type PanelState = 'collapsed' | 'default' | 'expanded';
export type TopographyView = 'content' | 'memory' | 'reality';

/**
 * 记忆交互记录：区分隐性与显性
 */
export interface MemoryInteraction {
  timestamp: number;
  occurrenceId: string;
  type: 'implicit' | 'explicit'; 
  weight: number; 
}

/**
 * 词汇统计：IMS + VMS 双驱动
 */
export interface VocabularyStat {
  lemma: string;
  totalOccurrences: number; 
  relativeDifficulty: number; 
  firstDiscoveryProgress: number; // 0.0 - 1.0 单词在书中首次出现的进度位置

  // 记忆分解
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
  difficultyScore: number; // 综合难度评价
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
  title: string;
  author: string;
  language: string;
  chapters: Chapter[]; 
  progress: number; // 当前真实阅读进度
  landscape?: LandscapeStats; 
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

export interface AssessmentWord {
  word: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context: string;
}
