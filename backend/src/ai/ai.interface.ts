import type { ZodType } from 'zod';

/**
 * The application's entire generative-model surface.
 *
 * This contract is deliberately free of any vendor, product, or protocol
 * detail: nothing here names a model service, an SDK, or a wire format. Feature
 * code injects {@link AI_SERVICE} and depends on these four capabilities alone,
 * which is what makes the concrete service behind them an environment setting
 * rather than an architectural commitment.
 *
 * Concrete implementations live exclusively in `src/ai/providers/` and are
 * chosen at runtime by {@link createAiProvider}.
 */

/** One turn in a conversation. */
export interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Per-call tuning. Every field is a hint — implementations clamp to their own limits. */
export interface AiRequestOptions {
  /** Steers behaviour for the whole call. Prepended ahead of any other input. */
  system?: string;
  /** 0 = deterministic, 1 = maximally varied. */
  temperature?: number;
  /** Ceiling on generated length, in tokens. */
  maxOutputTokens?: number;
  /** Overrides the configured request timeout for this call, in milliseconds. */
  timeoutMs?: number;
  /** Aborts an in-flight call (used to stop streams when a client disconnects). */
  signal?: AbortSignal;
}

/**
 * Raised when a generation cannot be completed. Feature services let this
 * propagate; the global exception filter renders it as a `502 Bad Gateway`
 * problem document, and job processors record it on the `ai_jobs` row.
 */
export class AiGenerationError extends Error {
  /** Status the endpoint replied with, when the failure was an HTTP response. */
  status?: number;
  /** Server-advised wait before retrying, milliseconds. */
  retryAfterMs?: number;

  constructor(
    message: string,
    /** True when a retry stands a reasonable chance of succeeding. */
    readonly retryable: boolean = false,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiGenerationError';
  }
}

/** Raised when the model's output does not satisfy the requested schema. */
export class AiSchemaError extends AiGenerationError {
  constructor(message: string, cause?: unknown) {
    super(message, false, cause);
    this.name = 'AiSchemaError';
  }
}

/**
 * The abstract capability set every provider adapter implements. Declared as an
 * abstract class rather than an interface so it can double as a Nest injection
 * token's type without a separate symbol import at every call site.
 */
export abstract class AiService {
  /** Free-form text for a single instruction. */
  abstract generateText(prompt: string, opts?: AiRequestOptions): Promise<string>;

  /**
   * A value guaranteed to satisfy `schema`. Implementations are responsible for
   * constraining, extracting and validating the output, and must throw
   * {@link AiSchemaError} rather than return a partially-shaped result.
   */
  abstract generateStructured<T>(
    prompt: string,
    schema: ZodType<T>,
    opts?: AiRequestOptions,
  ): Promise<T>;

  /** Interprets an image at `imageUrl` under the direction of `prompt`. */
  abstract analyzeImage(imageUrl: string, prompt: string, opts?: AiRequestOptions): Promise<string>;

  /**
   * A multi-turn exchange, yielded incrementally as the response is produced so
   * callers can forward it to a client without waiting for completion.
   */
  abstract chat(messages: AiMessage[], opts?: AiRequestOptions): AsyncIterable<string>;
}
