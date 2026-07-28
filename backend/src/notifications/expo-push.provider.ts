import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushMessage } from './push.types';

/** Expo accepts up to 100 messages per request; sending more is rejected outright. */
const MAX_BATCH = 100;

/** Statuses that mean the token is permanently gone and should be retired. */
const FATAL_ERRORS = new Set(['DeviceNotRegistered', 'InvalidCredentials']);

/** Outcome for one token in a batch. */
export interface ExpoTicket {
  token: string;
  ok: boolean;
  /** True when the token itself is dead and must not be retried. */
  fatal: boolean;
  message?: string;
}

/**
 * The Expo push transport.
 *
 * Chosen because the client is an Expo application: one endpoint reaches both
 * APNs and FCM, so the backend holds no Apple certificate or Google service
 * account. The provider is intentionally the *only* place that knows this — see
 * `push.types.ts` for the contract everything else depends on.
 *
 * Nothing here throws. A push that cannot be delivered is a degraded experience,
 * never a failed request or a failed background job: a reminder sweep must not
 * retry (and so re-notify) a hundred users because one HTTP call timed out.
 * Failures are reported through the returned tickets and logged.
 */
@Injectable()
export class ExpoPushProvider {
  private readonly logger = new Logger(ExpoPushProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** True when the transport is configured to actually send anything. */
  get enabled(): boolean {
    return this.config.get<boolean>('push.enabled') === true;
  }

  /**
   * Sends one message to many tokens, in batches of {@link MAX_BATCH}.
   *
   * Returns a ticket per token in the order they were supplied. A batch that fails
   * wholesale (network error, non-2xx, malformed body) yields non-fatal tickets for
   * every token in it — the tokens are presumed fine, the call was not.
   */
  async send(tokens: readonly string[], message: PushMessage): Promise<ExpoTicket[]> {
    const tickets: ExpoTicket[] = [];

    for (let offset = 0; offset < tokens.length; offset += MAX_BATCH) {
      const batch = tokens.slice(offset, offset + MAX_BATCH);
      tickets.push(...(await this.sendBatch(batch, message)));
    }

    return tickets;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async sendBatch(tokens: string[], message: PushMessage): Promise<ExpoTicket[]> {
    const body = tokens.map((token) => ({
      to: token,
      title: message.title,
      body: message.body,
      sound: 'default' as const,
      priority: 'high' as const,
      ...(message.data ? { data: message.data } : {}),
      ...(message.channelId ? { channelId: message.channelId } : {}),
    }));

    let response: Response;
    try {
      response = await fetch(this.config.get<string>('push.expoPushUrl') as string, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.get<number>('push.timeoutMs') ?? 15_000),
      });
    } catch (error) {
      return this.batchFailure(tokens, `push service unreachable: ${this.describe(error)}`);
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return this.batchFailure(
        tokens,
        `push service responded ${response.status}: ${this.summarise(detail)}`,
      );
    }

    return this.readTickets(tokens, await this.parse(response));
  }

  private buildHeaders(): Record<string, string> {
    const accessToken = this.config.get<string>('push.expoAccessToken');
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      // Expo compresses large responses; asking for identity keeps decoding simple.
      'accept-encoding': 'identity',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  private async parse(response: Response): Promise<ExpoResponse | null> {
    try {
      return (await response.json()) as ExpoResponse;
    } catch {
      return null;
    }
  }

  /**
   * Maps Expo's per-message receipts back onto the tokens they belong to.
   *
   * Expo answers positionally, so a response of a different length than the
   * request cannot be aligned; that is treated as a batch failure rather than
   * risking the retirement of a token whose receipt actually belonged to another.
   */
  private readTickets(tokens: string[], parsed: ExpoResponse | null): ExpoTicket[] {
    const receipts = parsed?.data;

    if (!Array.isArray(receipts) || receipts.length !== tokens.length) {
      return this.batchFailure(tokens, 'push service returned an unrecognised response');
    }

    return tokens.map((token, index) => {
      const receipt = receipts[index];
      if (receipt?.status === 'ok') {
        return { token, ok: true, fatal: false };
      }

      const errorCode = receipt?.details?.error;
      const fatal = errorCode !== undefined && FATAL_ERRORS.has(errorCode);
      const message = receipt?.message ?? errorCode ?? 'rejected by the push service';

      if (!fatal) {
        this.logger.warn(`Push rejected for a device: ${message}`);
      }
      return { token, ok: false, fatal, message };
    });
  }

  private batchFailure(tokens: string[], reason: string): ExpoTicket[] {
    this.logger.warn(`Push batch of ${tokens.length} failed — ${reason}`);
    return tokens.map((token) => ({ token, ok: false, fatal: false, message: reason }));
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private summarise(detail: string): string {
    const flat = detail.replace(/\s+/g, ' ').trim();
    return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat || '(no response body)';
  }
}

/** The shape Expo's send endpoint answers with. */
interface ExpoResponse {
  data?: {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
  }[];
}
