import { Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import * as z from 'zod';
import type { AiProviderConfig } from '../ai.constants';
import {
  AiGenerationError,
  AiSchemaError,
  AiService,
  type AiMessage,
  type AiRequestOptions,
  type InlineAudio,
} from '../ai.interface';
import { tryParseStructured } from '../structured';

/**
 * Machinery shared by every HTTP-based provider adapter: retries, timeouts,
 * server-sent-event decoding, image inlining, and the schema-constrained
 * generation loop.
 *
 * Adapters supply only the three wire-level operations their endpoint's request
 * and response format requires; everything above that is implemented once here,
 * so the four public capabilities behave identically no matter which service is
 * configured.
 */

/** A request that the model emit strict JSON conforming to `jsonSchema`. */
export interface JsonMode {
  /** Short identifier for the expected shape, where the format accepts one. */
  schemaName: string;
  /** JSON Schema (draft-07) description of the expected value. */
  jsonSchema: Record<string, unknown>;
}

/** An image downloaded and inlined so it can be embedded in a request body. */
export interface InlineImage {
  /** MIME type, e.g. `image/jpeg`. */
  mediaType: string;
  /** Raw bytes, base64-encoded. */
  base64: string;
}

/** Default generation ceiling, generous enough for a full week of meal items. */
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

/** Largest image the API will inline into a request, bytes. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Ceiling on a transcript. A spoken question is a sentence or two; this is a
 * bound on a model that decides to keep going, not on any real recording.
 */
const TRANSCRIPT_MAX_TOKENS = 512;

/** What a transcription returns when the recording carries no speech. */
const SILENCE_TOKEN = '[[no-speech]]';

/** Status codes worth retrying: request timeout, rate limit, and server faults. */
const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

/** Ceiling on a `Retry-After` we are willing to honour, milliseconds. */
const MAX_RETRY_AFTER_MS = 20_000;

export abstract class HttpAiProvider extends AiService {
  protected readonly logger: Logger;

  constructor(protected readonly config: AiProviderConfig) {
    super();
    this.logger = new Logger(`AiProvider:${config.providerId}`);
  }

  // ── wire-level operations, implemented per request/response format ────────

  /** Headers every request to this endpoint carries, including authentication. */
  protected abstract buildHeaders(): Record<string, string>;

  /**
   * A single non-streaming completion. When `json` is present the adapter should
   * additionally constrain the output natively if its format supports it — the
   * schema is always described in the prompt as well, so doing nothing extra is
   * still correct.
   */
  protected abstract complete(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Promise<string>;

  /** A completion whose input includes an inlined image. */
  protected abstract completeWithImage(
    image: InlineImage,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string>;

  /** A streaming completion, yielding text fragments as they arrive. */
  protected abstract stream(
    messages: AiMessage[],
    opts: AiRequestOptions,
  ): AsyncIterable<string>;

  /**
   * A completion whose input includes an inlined recording.
   *
   * Concrete rather than abstract, and refusing by default: audio is the one
   * capability the three formats genuinely differ on, and an adapter that cannot
   * carry it should not be forced to write a stub that pretends otherwise. The
   * refusal names the provider, so the fix — point `AI_PROVIDER_ID` at a format
   * that accepts audio — is readable from the error alone.
   */
  protected completeWithAudio(
    _audio: InlineAudio,
    _prompt: string,
    _opts: AiRequestOptions,
  ): Promise<string> {
    return Promise.reject(
      new AiGenerationError(
        `The configured model service (${this.config.providerId}) does not accept audio input.`,
        false,
      ),
    );
  }

  // ── public capabilities ───────────────────────────────────────────────────

  async generateText(prompt: string, opts: AiRequestOptions = {}): Promise<string> {
    const text = await this.complete(this.toMessages(prompt, opts), opts, null);
    return text.trim();
  }

  /**
   * Generates a value satisfying `schema`.
   *
   * The schema is enforced three times over, weakest to strongest: it is
   * described in the prompt, requested natively where the format allows, and —
   * the only one that actually decides the outcome — validated with Zod on the
   * way out. A first failure is fed back to the model once as a repair
   * instruction, since a malformed response is usually a near miss. A second
   * failure is an {@link AiSchemaError}: a caller is never handed a value that
   * did not pass validation.
   */
  async generateStructured<T>(
    prompt: string,
    schema: ZodType<T>,
    opts: AiRequestOptions = {},
  ): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<string, unknown>;
    const json: JsonMode = { schemaName: 'result', jsonSchema };

    const instruction = [
      prompt,
      '',
      'Respond with a single JSON value and nothing else. No prose before or',
      'after it, no markdown code fence, no trailing commentary.',
      'It must validate against this JSON Schema:',
      JSON.stringify(jsonSchema),
    ].join('\n');

    const messages = this.toMessages(instruction, opts);
    const first = await this.complete(messages, opts, json);

    const parsed = tryParseStructured(first, schema);
    if (parsed.ok) {
      return parsed.value;
    }

    this.logger.warn(`Structured output failed validation, requesting a repair: ${parsed.error}`);

    const repaired = await this.complete(
      [
        ...messages,
        { role: 'assistant', content: first },
        {
          role: 'user',
          content: [
            'That response was rejected by the schema validator:',
            parsed.error,
            '',
            'Return the corrected JSON value only. No prose, no code fence.',
          ].join('\n'),
        },
      ],
      opts,
      json,
    );

    const retried = tryParseStructured(repaired, schema);
    if (retried.ok) {
      return retried.value;
    }

    throw new AiSchemaError(
      `The model did not return a value matching the requested schema: ${retried.error}`,
    );
  }

  async analyzeImage(
    imageUrl: string,
    prompt: string,
    opts: AiRequestOptions = {},
  ): Promise<string> {
    const image = await this.fetchImage(imageUrl, opts);
    const text = await this.completeWithImage(image, prompt, opts);
    return text.trim();
  }

  /**
   * Transcribes a recording, preserving the language it was spoken in.
   *
   * The instruction says "write it down", never "answer it": a voice note is the
   * user typing with their mouth, and it has to land in the conversation as the
   * words they actually said. Left looser, a chat model happily replies to the
   * question instead of transcribing it, and the user's own turn is lost.
   *
   * Silence is a real outcome — a mistaken tap on the microphone — so it is
   * given an explicit token to emit rather than being left to produce an empty
   * completion, which every provider reports as a generation failure.
   */
  async transcribeAudio(audio: InlineAudio, opts: AiRequestOptions = {}): Promise<string> {
    const raw = await this.completeWithAudio(
      audio,
      [
        'Transcribe this recording word for word.',
        'Write it in the language and script it was spoken in — never translate it.',
        'Output the transcript alone: no quotation marks, no speaker labels, no',
        'timestamps, no commentary, and no answer to anything that was asked.',
        `If there is no intelligible speech, output exactly ${SILENCE_TOKEN} and nothing else.`,
      ].join(' '),
      { temperature: 0, maxOutputTokens: TRANSCRIPT_MAX_TOKENS, ...opts },
    );

    const text = raw.trim();
    return text === SILENCE_TOKEN ? '' : text;
  }

  chat(messages: AiMessage[], opts: AiRequestOptions = {}): AsyncIterable<string> {
    if (messages.length === 0) {
      throw new AiGenerationError('A chat call needs at least one message.');
    }
    return this.stream(messages, opts);
  }

  // ── helpers for adapters ──────────────────────────────────────────────────

  /** Prepends `opts.system` as a system turn when one was supplied. */
  protected toMessages(prompt: string, opts: AiRequestOptions): AiMessage[] {
    const user: AiMessage = { role: 'user', content: prompt };
    return opts.system ? [{ role: 'system', content: opts.system }, user] : [user];
  }

  protected maxOutputTokens(opts: AiRequestOptions): number {
    return opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  }

  protected temperature(opts: AiRequestOptions, fallback: number): number {
    return opts.temperature ?? fallback;
  }

  /** Absolute endpoint URL for a path relative to the configured base URL. */
  protected url(path: string): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    return `${base}/${path.replace(/^\/+/, '')}`;
  }

  /** POSTs a JSON body and returns the parsed JSON response, with retries. */
  protected async postJson<T>(
    path: string,
    body: unknown,
    opts: AiRequestOptions,
  ): Promise<T> {
    const response = await this.send(path, body, opts, false);
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new AiGenerationError('The model service returned a malformed JSON response.', false, error);
    }
  }

  /**
   * POSTs a JSON body and yields each server-sent-event `data:` payload as it
   * arrives. Terminal `[DONE]` sentinels are swallowed; decoding a frame is left
   * to the adapter, which knows its own event shape.
   */
  protected async *postSse(
    path: string,
    body: unknown,
    opts: AiRequestOptions,
  ): AsyncIterable<string> {
    const response = await this.send(path, body, opts, true);

    if (!response.body) {
      throw new AiGenerationError('The model service returned an empty stream.', true);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Events are separated by a blank line; \r\n is tolerated for proxies
        // that rewrite line endings.
        let boundary = buffer.search(/\r?\n\r?\n/);
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + (buffer[boundary] === '\r' ? 4 : 2));

          const payload = this.readDataLines(frame);
          if (payload !== null && payload !== '[DONE]') {
            yield payload;
          }

          boundary = buffer.search(/\r?\n\r?\n/);
        }
      }

      // A final frame that arrived without its trailing blank line.
      const tail = this.readDataLines(buffer);
      if (tail !== null && tail !== '[DONE]') {
        yield tail;
      }
    } finally {
      // Releasing the lock lets the connection be torn down promptly when the
      // consumer stops early (a client disconnecting mid-stream, for instance).
      await reader.cancel().catch(() => undefined);
    }
  }

  /** Reads a JSON frame, returning null when it is not decodable. */
  protected decodeFrame<T>(payload: string): T | null {
    try {
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Concatenated `data:` lines of one SSE frame, or null when it carries none. */
  private readDataLines(frame: string): string | null {
    const parts = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart());

    return parts.length === 0 ? null : parts.join('\n');
  }

  /**
   * Performs the HTTP call with a timeout and a bounded retry budget. Transient
   * faults (network errors, rate limits, 5xx) are retried with exponential
   * backoff plus jitter; anything else fails immediately, since retrying a
   * rejected request only burns quota.
   */
  private async send(
    path: string,
    body: unknown,
    opts: AiRequestOptions,
    streaming: boolean,
  ): Promise<Response> {
    const url = this.url(path);
    const payload = JSON.stringify(body);
    const headers = {
      'content-type': 'application/json',
      accept: streaming ? 'text/event-stream' : 'application/json',
      ...this.buildHeaders(),
    };

    let lastError: AiGenerationError | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      if (attempt > 0) {
        await this.pause(this.backoffMs(attempt, lastError));
      }

      const timeout = AbortSignal.timeout(opts.timeoutMs ?? this.config.timeoutMs);
      const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;

      let response: Response;
      try {
        response = await fetch(url, { method: 'POST', headers, body: payload, signal });
      } catch (error) {
        // A caller-initiated abort is a decision, not a fault — never retried.
        if (opts.signal?.aborted) {
          throw new AiGenerationError('The generation was cancelled.', false, error);
        }
        lastError = new AiGenerationError(
          `Could not reach the model service: ${this.describe(error)}`,
          true,
          error,
        );
        this.logger.warn(`${lastError.message} (attempt ${attempt + 1})`);
        continue;
      }

      if (response.ok) {
        return response;
      }

      lastError = await this.toError(response);
      if (!lastError.retryable) {
        throw lastError;
      }
      this.logger.warn(`${lastError.message} (attempt ${attempt + 1})`);
    }

    throw lastError ?? new AiGenerationError('The model service could not be reached.', true);
  }

  /** Turns a non-2xx response into a classified error, consuming its body. */
  private async toError(response: Response): Promise<AiGenerationError> {
    const detail = await response.text().catch(() => '');
    const retryable = RETRYABLE_STATUSES.has(response.status);

    const error = new AiGenerationError(
      `The model service responded ${response.status}: ${this.summarise(detail)}`,
      retryable,
    );
    error.status = response.status;

    const retryAfter = this.parseRetryAfter(response.headers.get('retry-after'));
    if (retryAfter !== null) {
      error.retryAfterMs = retryAfter;
    }
    return error;
  }

  /** Honours a server-provided `Retry-After`, else exponential backoff + jitter. */
  private backoffMs(attempt: number, lastError?: AiGenerationError): number {
    const advised = lastError?.retryAfterMs;
    if (typeof advised === 'number') {
      return advised;
    }
    const base = Math.min(500 * 2 ** (attempt - 1), 8_000);
    return base + Math.random() * 250;
  }

  private parseRetryAfter(header: string | null): number | null {
    if (!header) {
      return null;
    }
    const seconds = Number(header);
    if (Number.isFinite(seconds)) {
      return Math.min(Math.max(seconds, 0) * 1000, MAX_RETRY_AFTER_MS);
    }
    const at = Date.parse(header);
    return Number.isNaN(at) ? null : Math.min(Math.max(at - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }

  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Downloads an image and returns it base64-encoded.
   *
   * Inlining the bytes rather than forwarding the URL is deliberate: scan images
   * live in a private bucket the model service cannot read, and every request
   * format accepts inline image data while URL support varies.
   */
  private async fetchImage(imageUrl: string, opts: AiRequestOptions): Promise<InlineImage> {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? this.config.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;

    let response: Response;
    try {
      response = await fetch(imageUrl, { signal });
    } catch (error) {
      throw new AiGenerationError(
        `Could not download the image to analyse: ${this.describe(error)}`,
        true,
        error,
      );
    }

    if (!response.ok) {
      throw new AiGenerationError(
        `Could not download the image to analyse (HTTP ${response.status}).`,
        response.status >= 500,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new AiGenerationError('The image to analyse is empty.');
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new AiGenerationError('The image to analyse is too large to process.');
    }

    const mediaType = (response.headers.get('content-type') ?? 'image/jpeg').split(';')[0].trim();
    return { mediaType, base64: buffer.toString('base64') };
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private summarise(detail: string): string {
    const flat = detail.replace(/\s+/g, ' ').trim();
    return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat || '(no response body)';
  }
}
