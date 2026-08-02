import {
  AiGenerationError,
  type AiMessage,
  type AiRequestOptions,
  type InlineAudio,
} from '../ai.interface';
import { HttpAiProvider, type InlineImage, type JsonMode } from './http-provider.base';

/**
 * Room reserved for the model's own reasoning, on top of whatever ceiling the
 * caller asked for.
 *
 * This format's `maxOutputTokens` is not a ceiling on the *answer* — it covers
 * the reasoning tokens a thinking model spends before writing one, and current
 * models spend a great deal. Measured against this API: a single meal swap
 * spent ~2,000 reasoning tokens and a recipe ~2,200, against caller ceilings of
 * 1,024 and 4,096 respectively. Without this reserve the swap never completes —
 * reasoning consumes the entire budget and the answer is truncated mid-string
 * on every attempt, including the repair.
 *
 * Reserved rather than capped because `thinkingConfig.thinkingBudget` is a hint
 * upward only: asked for 1,024, the model spent 1,963 anyway. The one value it
 * honours exactly is zero, and switching reasoning off wholesale would trade a
 * truncation bug for worse plans.
 *
 * Sized from the largest reasoning run observed (~8,100 tokens) rather than the
 * average, because being short here is a hard failure and being long costs only
 * unused headroom. Reasoning does expand to fill what it is given, so this is
 * also the knob to turn if the token bill needs trimming.
 */
const THINKING_HEADROOM_TOKENS = 8192;

/**
 * Adapter for endpoints speaking the `models/{model}:generateContent` request
 * and response format (Google's Generative Language API and compatible hosts).
 *
 * Unlike the other two shapes the model name is part of the URL rather than the
 * body, the assistant role is spelled `model`, and text lives in `parts` arrays.
 * Structured output is requested via the JSON response MIME type only: the
 * format's `responseSchema` accepts a restricted OpenAPI dialect rather than
 * JSON Schema, and silently rejecting valid schemas would be worse than relying
 * on the prompt plus the validation the base class performs regardless.
 */

interface GenerateContentResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
}

interface ContentPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export class GenerateContentProvider extends HttpAiProvider {
  protected buildHeaders(): Record<string, string> {
    return { 'x-goog-api-key': this.config.apiKey };
  }

  /**
   * Adds {@link THINKING_HEADROOM_TOKENS} to whatever the caller asked for.
   *
   * Every caller across the platform sizes its ceiling as "how much room does
   * this answer need" — a week of meals, one dish, a chat reply — and that
   * reading has to keep holding whichever provider is configured. This format is
   * the one where it would not, so the correction belongs here rather than in
   * five services each learning what a thinking model is.
   */
  protected override maxOutputTokens(opts: AiRequestOptions): number {
    return super.maxOutputTokens(opts) + THINKING_HEADROOM_TOKENS;
  }

  protected async complete(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Promise<string> {
    const response = await this.postJson<GenerateContentResponse>(
      this.path('generateContent'),
      this.body(messages, opts, json),
      opts,
    );
    return this.readText(response);
  }

  protected async completeWithImage(
    image: InlineImage,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string> {
    return this.completeWithMedia(image.mediaType, image.base64, prompt, opts);
  }

  /**
   * This format carries audio in exactly the same `inline_data` part an image
   * uses, so spoken input costs one method and no new transport.
   */
  protected override async completeWithAudio(
    audio: InlineAudio,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string> {
    return this.completeWithMedia(audio.mediaType, audio.base64, prompt, opts);
  }

  protected async *stream(messages: AiMessage[], opts: AiRequestOptions): AsyncIterable<string> {
    const path = `${this.path('streamGenerateContent')}?alt=sse`;

    for await (const payload of this.postSse(path, this.body(messages, opts, null), opts)) {
      const frame = this.decodeFrame<GenerateContentResponse>(payload);
      const text = frame?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
      if (text) {
        yield text;
      }
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** One turn whose input is a media part followed by the instruction for it. */
  private async completeWithMedia(
    mediaType: string,
    base64: string,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: prompt },
          ] satisfies ContentPart[],
        },
      ],
      generationConfig: {
        temperature: this.temperature(opts, 0.2),
        maxOutputTokens: this.maxOutputTokens(opts),
      },
    };

    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }

    const response = await this.postJson<GenerateContentResponse>(
      this.path('generateContent'),
      body,
      opts,
    );
    return this.readText(response);
  }

  private path(method: string): string {
    return `models/${encodeURIComponent(this.config.modelName)}:${method}`;
  }

  private body(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Record<string, unknown> {
    const systemParts: string[] = [];
    if (opts.system) {
      systemParts.push(opts.system);
    }

    const contents: { role: 'user' | 'model'; parts: ContentPart[] }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
        continue;
      }

      const role = message.role === 'assistant' ? 'model' : 'user';
      const previous = contents[contents.length - 1];
      if (previous?.role === role) {
        previous.parts.push({ text: message.content });
        continue;
      }
      contents.push({ role, parts: [{ text: message.content }] });
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Continue.' }] });
    }

    const generationConfig: Record<string, unknown> = {
      temperature: this.temperature(opts, json ? 0.3 : 0.7),
      maxOutputTokens: this.maxOutputTokens(opts),
    };

    if (json) {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = { contents, generationConfig };
    if (systemParts.length > 0) {
      body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
    }
    return body;
  }

  /**
   * Extracts the generated text, distinguishing a genuinely empty result from a
   * safety block — the latter is a permanent decision about that input, so it is
   * reported as non-retryable rather than burning the retry budget.
   */
  private readText(response: GenerateContentResponse): string {
    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new AiGenerationError(
        `The model service declined to answer (${blockReason}).`,
        false,
      );
    }

    const candidate = response.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('');

    if (text.length === 0) {
      const reason = candidate?.finishReason;
      throw new AiGenerationError(
        reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT'
          ? `The model service declined to answer (${reason}).`
          : 'The model service returned an empty completion.',
        reason !== 'SAFETY' && reason !== 'PROHIBITED_CONTENT',
      );
    }
    return text;
  }
}
