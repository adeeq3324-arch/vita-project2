import { AiGenerationError, type AiMessage, type AiRequestOptions } from '../ai.interface';
import { HttpAiProvider, type InlineImage, type JsonMode } from './http-provider.base';

/**
 * Adapter for endpoints speaking the `POST /chat/completions` request and
 * response format.
 *
 * This is by far the most widely implemented shape — OpenAI defined it, and
 * Azure OpenAI, Groq, Together, Fireworks, DeepSeek, Mistral, OpenRouter, vLLM,
 * LM Studio, Ollama and most self-hosted gateways all accept it — so a single
 * adapter covers a large share of deployment choices. Point `AI_BASE_URL` at the
 * root that exposes `/chat/completions` and set `AI_MODEL_NAME` to whatever that
 * service calls the model.
 */

/** Shape of a non-streaming response body. */
interface ChatCompletionResponse {
  choices?: { message?: { content?: string | null } }[];
}

/** Shape of one streamed frame. */
interface ChatCompletionChunk {
  choices?: { delta?: { content?: string | null } }[];
}

/**
 * How output is constrained. Native JSON-Schema enforcement is the strongest
 * option but is not universal, so the adapter starts there and permanently
 * steps down to plain JSON mode the first time an endpoint rejects it.
 */
type JsonStrategy = 'schema' | 'object' | 'prompt';

/** Statuses that mean "this endpoint does not accept that field". */
const UNSUPPORTED_STATUSES = new Set([400, 404, 422, 501]);

export class ChatCompletionsProvider extends HttpAiProvider {
  private jsonStrategy: JsonStrategy = 'schema';

  protected buildHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.config.apiKey}` };
  }

  protected async complete(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Promise<string> {
    if (!json) {
      return this.request(this.body(messages, opts, null), opts);
    }

    // Degrade once, then stay degraded: the endpoint's capabilities do not
    // change between calls, so a rejected field is not worth re-probing.
    for (;;) {
      const strategy = this.jsonStrategy;
      try {
        return await this.request(this.body(messages, opts, json, strategy), opts);
      } catch (error) {
        const next = this.downgrade(strategy, error);
        if (next === null) {
          throw error;
        }
        this.logger.warn(
          `Endpoint rejected "${strategy}" output constraints; falling back to "${next}".`,
        );
        this.jsonStrategy = next;
      }
    }
  }

  protected async completeWithImage(
    image: InlineImage,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string> {
    const content = [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: this.toDataUrl(image) } },
    ];

    const messages: unknown[] = opts.system
      ? [{ role: 'system', content: opts.system }, { role: 'user', content }]
      : [{ role: 'user', content }];

    return this.request(
      {
        model: this.config.modelName,
        messages,
        temperature: this.temperature(opts, 0.2),
        max_tokens: this.maxOutputTokens(opts),
      },
      opts,
    );
  }

  protected async *stream(messages: AiMessage[], opts: AiRequestOptions): AsyncIterable<string> {
    const body = { ...this.body(messages, opts, null), stream: true };

    for await (const payload of this.postSse('chat/completions', body, opts)) {
      const chunk = this.decodeFrame<ChatCompletionChunk>(payload);
      const text = chunk?.choices?.[0]?.delta?.content;
      if (text) {
        yield text;
      }
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async request(body: Record<string, unknown>, opts: AiRequestOptions): Promise<string> {
    const response = await this.postJson<ChatCompletionResponse>('chat/completions', body, opts);
    const content = response.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || content.length === 0) {
      throw new AiGenerationError('The model service returned an empty completion.', true);
    }
    return content;
  }

  private body(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
    strategy: JsonStrategy = 'prompt',
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.config.modelName,
      messages: messages.map((message) => ({ role: message.role, content: message.content })),
      temperature: this.temperature(opts, json ? 0.3 : 0.7),
      max_tokens: this.maxOutputTokens(opts),
    };

    if (json && strategy === 'schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: json.schemaName, schema: json.jsonSchema, strict: false },
      };
    } else if (json && strategy === 'object') {
      body.response_format = { type: 'json_object' };
    }

    return body;
  }

  /** The next weaker strategy, or null when the error is unrelated to constraints. */
  private downgrade(current: JsonStrategy, error: unknown): JsonStrategy | null {
    if (current === 'prompt') {
      return null;
    }
    if (!(error instanceof AiGenerationError) || !UNSUPPORTED_STATUSES.has(error.status ?? 0)) {
      return null;
    }
    return current === 'schema' ? 'object' : 'prompt';
  }

  private toDataUrl(image: InlineImage): string {
    return `data:${image.mediaType};base64,${image.base64}`;
  }
}
