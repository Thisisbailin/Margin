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
