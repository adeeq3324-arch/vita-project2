/**
 * Injection token for the application's {@link AiService} implementation.
 *
 * Feature services always inject this token, never a concrete class, so no code
 * outside `src/ai/providers/` can develop a dependency on a particular model
 * service.
 */
export const AI_SERVICE = Symbol('AI_SERVICE');

/** Resolved, validated connection settings handed to a provider adapter. */
export interface AiProviderConfig {
  /** Selects the adapter. Matched against the provider registry. */
  providerId: string;
  /** Root URL of the inference endpoint, without a trailing slash. */
  baseUrl: string;
  /** Model identifier, exactly as the target service names it. */
  modelName: string;
  /** Credential for the endpoint. */
  apiKey: string;
  /** Per-request ceiling, milliseconds. */
  timeoutMs: number;
  /** Retry budget for transient failures. */
  maxRetries: number;
}
