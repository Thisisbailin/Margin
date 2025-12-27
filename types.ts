// Domain Types for Margin

export enum Familiarity {
  Unknown = 0,
  Seen = 1,
  Familiar = 2,
  Mastered = 3
}

export enum UserProficiency {
  Beginner = 'beginner',       // 初学者
  Intermediate = 'intermediate', // 进阶者
  Advanced = 'advanced'        // 精通者
}

export type PanelState = 'collapsed' | 'default' | 'expanded';

export interface WordOccurrence {
  id: string;
  text: string;
  lemma: string; // The root form
  pos: string; // Part of Speech
  familiarity: Familiarity;
  translation?: string;
}

export interface Sentence {
  id: string;
  text: string;
  tokens: WordOccurrence[];
}

// Stats for a specific word lemma across the project
export interface VocabularyStat {
  lemma: string;
  familiarity: Familiarity;
  reviewCount: number; // How many times reviewed
  definition?: string; // AI generated definition (persisted)
  lastReviewDate?: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  content: Sentence[]; // Pre-parsed content
  progress: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  books: Book[]; // Max 9
  activeBookId?: string;
  // Source of truth for word mastery and definitions
  vocabularyStats: Record<string, VocabularyStat>; 
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  relatedSentenceId?: string; // Anchor to text
  type: 'annotation' | 'chat' | 'advice';
}

export interface AssessmentWord {
  word: string;
  difficulty: 'easy' | 'medium' | 'hard';
  context: string;
}

// NEW: Structured Context for the Agent
export interface AnnotationContext {
  targetSentence: string;
  surroundingContext: string; // Previous 2 sentences + Next 2 sentences
  bookTitle: string;
  author: string;
  projectName: string;
  projectDescription: string;
  proficiency: UserProficiency;
}

// NEW: Lexicon Engine Types
export interface LexiconItem {
  lemma: string;
  count: number; // Frequency in the entire project
  familiarity: Familiarity;
  reviewCount: number; // NEW
  definition?: string; // NEW
  occurrences: {
    sentenceText: string;
    bookTitle: string;
    wordText: string;
    wordId: string;
  }[];
}

export type FrequencyBand = 'core' | 'essential' | 'niche';

export interface StudyFilter {
  band: FrequencyBand | 'all';
  status: 'new' | 'review' | 'mastered' | 'all'; // Changed 'learning' to 'review' for clarity
}