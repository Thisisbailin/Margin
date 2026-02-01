import { LLMRequest, LLMUsage } from "../core/types";

export type TrafficStatus = "success" | "error";

export type TrafficRecord = {
  id: string;
  startedAt: number;
  endedAt: number;
  latencyMs: number;
  provider: string;
  model: string;
  stream: boolean;
  status: TrafficStatus;
  error?: string;
  promptTokens?: number;
  responseTokens?: number;
  totalTokens?: number;
  messageCount?: number;
  promptChars?: number;
  metadata?: Record<string, unknown>;
  source?: string;
  feature?: string;
  userId?: string;
  projectId?: string;
};

export type TrafficStart = {
  id: string;
  startedAt: number;
  provider: string;
  request: LLMRequest;
};

export type TrafficFinish = {
  status: TrafficStatus;
  usage?: LLMUsage;
  error?: string;
};

export type TrafficRecorderConfig = {
  enabled?: boolean;
  sink?: "supabase" | "console" | "none";
  supabaseUrl?: string;
  supabaseKey?: string;
  table?: string;
  provider: string;
};

export interface TrafficRecorder {
  start: (request: LLMRequest) => TrafficStart;
  finish: (start: TrafficStart, finish: TrafficFinish) => Promise<void>;
}
