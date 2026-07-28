import { AiGenerationError, type AiMessage, type AiRequestOptions } from '../ai.interface';
import { HttpAiProvider, type InlineImage, type JsonMode } from './http-provider.base';

/**
 * Adapter for endpoints speaking the `POST /messages` request and response
 * format (Anthropic's API and the gateways that re-expose it).
 *
 * Two structural differences from the completions shape are handled here rather
 * than leaking upward: the system instruction is a top-level field instead of a
 * message, and the turn list must strictly alternate starting with the user. The
 * normaliser below enforces both, so callers can hand over any conversation the
 * abstract contract allows.
 */

/** API revision this adapter is written against. */
const API_VERSION = '2023-06-01';

interface MessagesResponse {
  content?: { type?: string; text?: string }[];
}

interface MessagesStreamEvent {
  type?: string;
  delta?: { type?: string; text?: string };
}

/** A turn list that satisfies the format's alternation rule. */
interface NormalisedTurns {
  system?: string;
  turns: { role: 'user' | 'assistant'; content: unknown }[];
}

export class MessagesProvider extends HttpAiProvider {
  protected buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey,
      'anthropic-version': API_VERSION,
    };
  }

  protected async complete(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Promise<string> {
    const response = await this.postJson<MessagesResponse>(
      'messages',
      this.body(messages, opts, json),
      opts,
    );

    const text = (response.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');

    if (text.length === 0) {
      throw new AiGenerationError('The model service returned an empty completion.', true);
    }
    return text;
  }

  protected async completeWithImage(
    image: InlineImage,
    prompt: string,
    opts: AiRequestOptions,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.config.modelName,
      max_tokens: this.maxOutputTokens(opts),
      temperature: this.temperature(opts, 0.2),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    };

    if (opts.system) {
      body.system = opts.system;
    }

    const response = await this.postJson<MessagesResponse>('messages', body, opts);
    const text = (response.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');

    if (text.length === 0) {
      throw new AiGenerationError('The model service returned an empty image analysis.', true);
    }
    return text;
  }

  protected async *stream(messages: AiMessage[], opts: AiRequestOptions): AsyncIterable<string> {
    const body = { ...this.body(messages, opts, null), stream: true };

    for await (const payload of this.postSse('messages', body, opts)) {
      const event = this.decodeFrame<MessagesStreamEvent>(payload);
      if (event?.type === 'content_block_delta' && typeof event.delta?.text === 'string') {
        yield event.delta.text;
      }
    }
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private body(
    messages: AiMessage[],
    opts: AiRequestOptions,
    json: JsonMode | null,
  ): Record<string, unknown> {
    const { system, turns } = this.normalise(messages, opts.system);

    const body: Record<string, unknown> = {
      model: this.config.modelName,
      max_tokens: this.maxOutputTokens(opts),
      temperature: this.temperature(opts, json ? 0.3 : 0.7),
      messages: turns,
    };

    if (system) {
      body.system = system;
    }
    return body;
  }

  /**
   * Reshapes an arbitrary conversation into what the format accepts: system
   * turns hoisted out and joined, consecutive same-role turns merged, and a
   * leading user turn synthesised if the history happens to open on the
   * assistant (which it can, when a stored conversation is replayed).
   */
  private normalise(messages: AiMessage[], systemOption?: string): NormalisedTurns {
    const systemParts: string[] = [];
    if (systemOption) {
      systemParts.push(systemOption);
    }

    const turns: { role: 'user' | 'assistant'; content: unknown }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
        continue;
      }

      const previous = turns[turns.length - 1];
      if (previous?.role === message.role) {
        previous.content = `${previous.content as string}\n\n${message.content}`;
        continue;
      }
      turns.push({ role: message.role, content: message.content });
    }

    if (turns.length === 0 || turns[0].role !== 'user') {
      turns.unshift({ role: 'user', content: 'Continue.' });
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      turns,
    };
  }
}
