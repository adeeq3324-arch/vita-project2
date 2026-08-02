import { env } from '@/config/env';
import { api, ApiError, NETWORK_ERROR_STATUS } from '@/services/api/client';
import { getAccessToken } from '@/services/auth/session';

/**
 * AI Coach service — conversations, history, streamed replies and voice input.
 *
 * Everything here is the backend's: the model, the prompt, the user's profile
 * and the conversation itself all live server-side, and the client's whole job
 * is to show a thread and stream one reply into it. The API key is never in the
 * bundle.
 *
 * The reply is the one call that does not go through {@link api}. It arrives as
 * `text/event-stream`, which needs a response read while it is still open —
 * something `fetch` cannot do on React Native — so it is built on
 * `XMLHttpRequest` here rather than bending the shared client around one route.
 */

export type CoachRole = 'user' | 'assistant';

export interface CoachMessage {
  id: string;
  role: CoachRole;
  content: string;
  createdAt: string;
}

export interface CoachConversation {
  id: string;
  personality: CoachPersonalityId;
  personalityLabel: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export type CoachPersonalityId = 'scientist' | 'motivator' | 'zenMaster';

export interface CoachPersonality {
  id: CoachPersonalityId;
  label: string;
  tagline: string;
}

/** Callbacks a streamed reply reports its progress through. */
export interface ReplyHandlers {
  /** More of the answer. Fired many times; append it to what is on screen. */
  onChunk: (text: string) => void;
  /** The answer is complete and saved, with the id it was stored under. */
  onDone: (message: { id: string; content: string }) => void;
  /** Generation failed. The stream is over; the text so far is all there is. */
  onError: (message: string) => void;
}

const BASE = '/api/v1/coach';

/** The three coaching voices, for a picker. */
export function listPersonalities(): Promise<CoachPersonality[]> {
  return api.get<CoachPersonality[]>(`${BASE}/personalities`);
}

export function listConversations(): Promise<CoachConversation[]> {
  return api.get<CoachConversation[]>(`${BASE}/conversations`);
}

export function createConversation(
  personality: CoachPersonalityId = 'motivator',
): Promise<CoachConversation> {
  return api.post<CoachConversation>(`${BASE}/conversations`, { personality });
}

export function listMessages(conversationId: string): Promise<CoachMessage[]> {
  return api.get<CoachMessage[]>(`${BASE}/conversations/${conversationId}/messages`);
}

/**
 * The thread to open the screen on: the most recent one, or a new one.
 *
 * A coach the user returns to should still remember Tuesday's conversation, and
 * the server already orders threads by real recency — so "continue where we left
 * off" is the first row, and starting fresh is what happens for a new user.
 */
export async function currentConversation(
  personality: CoachPersonalityId = 'motivator',
): Promise<CoachConversation> {
  const conversations = await listConversations();
  return conversations[0] ?? (await createConversation(personality));
}

/**
 * Transcribes a recording into the words that were spoken.
 *
 * Returns text for the composer rather than sending it: speech recognition
 * mishears names and numbers, and the user has to be able to fix it before the
 * coach answers something they did not ask.
 */
export async function transcribe(
  recording: { uri: string; mimeType: string },
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData();
  // React Native's FormData takes this shape for a file part; the cast is the
  // standard one, since the DOM's `FormData` types only admit a Blob here.
  form.append('audio', {
    uri: recording.uri,
    name: `voice.${extensionFor(recording.mimeType)}`,
    type: recording.mimeType,
  } as unknown as Blob);

  // Generous timeout: the recording has to be uploaded before the model even
  // starts listening to it, and a phone on a slow connection is the normal case.
  const { text } = await api.post<{ text: string }>(`${BASE}/voice`, form, {
    timeoutMs: 60_000,
    signal,
  });

  return text;
}

/**
 * Sends a turn and streams the coach's reply.
 *
 * Returns a function that cancels it. Cancelling is a real part of the feature,
 * not a cleanup detail — a user who sees the answer going the wrong way should
 * be able to stop it, and the server drops the half-written reply rather than
 * storing it, so the thread never shows a sentence that trails off.
 */
export function streamReply(
  conversationId: string,
  content: string,
  handlers: ReplyHandlers,
): () => void {
  const request = new XMLHttpRequest();
  let cancelled = false;
  /** How much of `responseText` has already been turned into events. */
  let consumed = 0;
  let settled = false;

  /** Reports a failure once — a failed stream must not also report `done`. */
  const fail = (message: string): void => {
    if (settled || cancelled) return;
    settled = true;
    handlers.onError(message);
  };

  const drain = (): void => {
    if (cancelled) return;

    const buffer = request.responseText;
    if (buffer.length <= consumed) return;

    // Only whole frames are parsed; a partial one stays in the buffer until the
    // rest of it arrives, which is the entire reason `consumed` is tracked
    // rather than the text being re-split each time.
    let boundary = buffer.indexOf('\n\n', consumed);
    while (boundary !== -1) {
      const frame = buffer.slice(consumed, boundary);
      consumed = boundary + 2;

      const event = parseFrame(frame);
      if (event) {
        if (event.type === 'chunk') {
          handlers.onChunk(event.text);
        } else if (event.type === 'done') {
          if (!settled) {
            settled = true;
            handlers.onDone({ id: event.messageId, content: event.content });
          }
        } else {
          fail(event.message);
        }
      }

      boundary = buffer.indexOf('\n\n', consumed);
    }
  };

  request.onreadystatechange = () => {
    // LOADING means bytes have arrived and the response is still open — the one
    // state that makes this a stream rather than a slow request.
    if (request.readyState === XMLHttpRequest.LOADING) {
      drain();
      return;
    }

    if (request.readyState !== XMLHttpRequest.DONE || cancelled) return;

    // A failure before the first token is an ordinary HTTP error with a problem
    // document, not an `error` event — the status was chosen before the stream
    // existed. Both paths have to end in the same callback.
    if (request.status >= 400 || request.status === 0) {
      fail(httpFailureMessage(request));
      return;
    }

    drain();
    fail('The coach stopped before finishing that answer. Please try again.');
  };

  void (async () => {
    const token = await getAccessToken();
    if (cancelled) return;

    request.open('POST', `${env.apiUrl}${BASE}/conversations/${conversationId}/messages`);
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('Accept', 'text/event-stream');
    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    request.send(JSON.stringify({ content }));
  })();

  return () => {
    if (settled || cancelled) return;
    cancelled = true;
    request.abort();
  };
}

// ── internals ───────────────────────────────────────────────────────────────

type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; messageId: string; content: string }
  | { type: 'error'; message: string };

/**
 * Reads one SSE frame's `data:` payload.
 *
 * The event name on the frame is ignored: the payload carries its own `type`,
 * and trusting one source rather than two is what stops the two disagreeing.
 * Heartbeat comments (`: ping`) carry no data line and decode to null.
 */
function parseFrame(frame: string): StreamEvent | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (data.length === 0) return null;

  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}

/** Turns a failed stream request into a line the user can act on. */
function httpFailureMessage(request: XMLHttpRequest): string {
  if (request.status === 0) {
    return env.isDev
      ? `Cannot reach the VITAL AI server.\n\n(Dev: no response from ${env.apiUrl} — is the backend running?)`
      : 'Cannot reach the VITAL AI server. Check your internet connection and try again.';
  }

  try {
    const body = JSON.parse(request.responseText) as { detail?: string; message?: string };
    const detail = body.detail ?? body.message;
    if (detail) return detail;
  } catch {
    // Not a problem document — fall through to the generic wording.
  }

  return request.status === 429
    ? 'You have reached the coaching limit for now. Try again a little later.'
    : 'The coach is unavailable right now. Please try again.';
}

/** File extension matching a recording's container, for the upload's filename. */
function extensionFor(mimeType: string): string {
  const base = (mimeType.split(';')[0] ?? '').trim().toLowerCase();
  const known: Record<string, string> = {
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/aac': 'aac',
    'audio/ogg': 'ogg',
  };
  return known[base] ?? 'm4a';
}

/** True when a thrown value is the backend refusing because onboarding is incomplete. */
export function isProfileIncomplete(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && /profile|onboarding/i.test(error.message);
}

/** True when the request never reached the server. */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === NETWORK_ERROR_STATUS;
}
