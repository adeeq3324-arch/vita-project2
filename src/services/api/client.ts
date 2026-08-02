import { env } from '@/config/env';

/**
 * Thin HTTP client for the VITAL AI backend.
 *
 * Feature services build on this rather than calling `fetch` directly, so
 * auth, timeouts and error shape stay consistent across the app.
 */

/** `status` used when the request never produced an HTTP response at all. */
export const NETWORK_ERROR_STATUS = 0;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the server was never reached (offline, backend down, DNS, TLS). */
  get isNetworkError(): boolean {
    return this.status === NETWORK_ERROR_STATUS;
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Abort after this many ms. */
  timeoutMs?: number;
  /** Skip attaching the bearer token (for public endpoints / the refresh call). */
  skipAuth?: boolean;
  /**
   * Override retry behaviour. Idempotent verbs (GET/HEAD/PUT/DELETE) retry
   * transient failures by default; POST/PATCH never do unless opted in here,
   * because a replay could duplicate a write the server already accepted.
   */
  retry?: boolean;
};

const DEFAULT_TIMEOUT_MS = 15_000;

/** Extra attempts after the first one, for retryable requests. */
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 400;

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);

/** Statuses worth retrying: the server is up but momentarily unable to answer. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Message shown when the request never reached the backend. Every platform
 * words this differently and unhelpfully ("Failed to fetch" on web, "Network
 * request failed" on native), so we replace it with something a user can act on.
 */
function unreachableMessage(): string {
  const base =
    'Cannot reach the VITAL AI server. Check your internet connection and try again.';
  return env.isDev ? `${base}\n\n(Dev: no response from ${env.apiUrl} — is the backend running?)` : base;
}

/**
 * Distinguishes "fetch never got a response" from every other thrown error.
 * Browsers and React Native both surface this as a TypeError with a
 * platform-specific message.
 */
function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return false;
  return (
    error instanceof TypeError ||
    /failed to fetch|network request failed|load failed|network error|fetch failed/i.test(
      error.message,
    )
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exponential backoff with jitter, so parallel requests don't retry in lockstep. */
function backoffDelay(attempt: number): number {
  const exponential = RETRY_BASE_DELAY_MS * 2 ** attempt;
  return exponential + Math.random() * RETRY_BASE_DELAY_MS;
}

/** Resolves the bearer token for outgoing requests; set once auth lands. */
let getAuthToken: () => Promise<string | null> = async () => null;

export function setAuthTokenProvider(provider: () => Promise<string | null>) {
  getAuthToken = provider;
}

/**
 * Pulls a human-readable message out of the backend's RFC 7807 error body,
 * preferring field-level validation errors, then `detail`, then `message`.
 */
function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { detail?: unknown; message?: unknown; errors?: unknown };
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    return body.errors.map(String).join('\n');
  }
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.message === 'string') return body.message;
  return null;
}

/** Performs exactly one HTTP attempt, normalising failures into `ApiError`. */
async function attempt<T>(path: string, options: RequestOptions): Promise<T> {
  const {
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers,
    skipAuth = false,
    retry: _retry,
    signal: externalSignal,
    ...rest
  } = options;

  // A fresh controller per attempt: an aborted one can never be reused.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  try {
    const token = skipAuth ? null : await getAuthToken();

    // A multipart body is passed through untouched, and without a content type:
    // only the runtime's own FormData knows the boundary parameter it has to be
    // labelled with, and setting the header ourselves would strip it and make
    // the request unparseable at the other end.
    const isMultipart = typeof FormData !== 'undefined' && body instanceof FormData;

    const response = await fetch(`${env.apiUrl}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: isMultipart ? (body as FormData) : JSON.stringify(body) }
        : {}),
    });

    // Accept both application/json and RFC 7807 application/problem+json.
    const isJson = response.headers.get('content-type')?.includes('json');
    const payload = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const message = extractErrorMessage(payload) ?? `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === 'AbortError') {
      // Caller-initiated cancellation must not be reported as a timeout.
      if (externalSignal?.aborted) throw error;
      throw new ApiError('The request timed out. Check your connection and try again.', 408);
    }

    if (isTransportFailure(error)) {
      throw new ApiError(unreachableMessage(), NETWORK_ERROR_STATUS, error);
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected network error occurred.',
      NETWORK_ERROR_STATUS,
      error,
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Sends a request, retrying transient failures so a brief blip — a backend
 * still warming up, a dropped socket, a cold database connection — surfaces as
 * a successful call rather than an error the user has to react to.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const retryable = options.retry ?? IDEMPOTENT_METHODS.has(method);

  let lastError: unknown;

  for (let i = 0; i <= (retryable ? MAX_RETRIES : 0); i += 1) {
    try {
      return await attempt<T>(path, options);
    } catch (error) {
      lastError = error;

      // Cancellation and non-transient errors (4xx, validation) fail fast.
      if (error instanceof Error && error.name === 'AbortError') throw error;
      if (!(error instanceof ApiError)) throw error;
      if (!error.isNetworkError && !RETRYABLE_STATUSES.has(error.status)) throw error;
      if (i === MAX_RETRIES) break;

      await delay(backoffDelay(i));
    }
  }

  throw lastError;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
} as const;
