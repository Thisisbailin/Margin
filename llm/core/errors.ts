export type LLMErrorCode =
  | "InvalidRequest"
  | "Unauthorized"
  | "RateLimited"
  | "Upstream"
  | "Timeout";

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(code: LLMErrorCode, message: string, status?: number, cause?: unknown) {
    super(message);
    this.name = "LLMError";
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export const isLLMError = (error: unknown): error is LLMError => {
  return error instanceof LLMError;
};

export const mapHttpStatusToLLMErrorCode = (status?: number): LLMErrorCode => {
  if (!status) return "Upstream";
  if (status === 400) return "InvalidRequest";
  if (status === 401 || status === 403) return "Unauthorized";
  if (status === 408 || status === 504) return "Timeout";
  if (status === 429) return "RateLimited";
  return "Upstream";
};

export const toLLMError = (error: unknown, status?: number, message?: string): LLMError => {
  if (error instanceof LLMError) return error;
  const code = mapHttpStatusToLLMErrorCode(status);
  const fallback = message || (error instanceof Error ? error.message : "Unknown LLM error");
  return new LLMError(code, fallback, status, error);
};
