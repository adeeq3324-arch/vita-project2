import type { AiProviderConfig } from '../ai.constants';
import type { AiService } from '../ai.interface';
import { ChatCompletionsProvider } from './chat-completions.provider';
import { GenerateContentProvider } from './generate-content.provider';
import type { HttpAiProvider } from './http-provider.base';
import { MessagesProvider } from './messages.provider';

/**
 * The provider registry — the one place that knows which concrete adapters
 * exist and which identifier selects each.
 *
 * Adapters are registered under the request/response format they speak rather
 * than under a company name, because that is what actually determines
 * compatibility: a single format is accepted by many services, managed and
 * self-hosted alike, so `AI_PROVIDER_ID` describes *how* to talk to the
 * endpoint and `AI_BASE_URL` decides *who* answers.
 *
 * Adding support for a new format means writing one adapter beside this file and
 * adding one line below. Nothing outside this directory changes.
 */
const REGISTRY: Record<string, new (config: AiProviderConfig) => HttpAiProvider> = {
  /** `POST {baseUrl}/chat/completions` */
  'chat-completions': ChatCompletionsProvider,
  /** `POST {baseUrl}/messages` */
  messages: MessagesProvider,
  /** `POST {baseUrl}/models/{model}:generateContent` */
  'generate-content': GenerateContentProvider,
};

/** Identifiers `AI_PROVIDER_ID` accepts, for diagnostics and documentation. */
export const SUPPORTED_PROVIDER_IDS: readonly string[] = Object.keys(REGISTRY);

/** Thrown at boot when the AI environment is missing or unusable. */
export class AiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigurationError';
  }
}

/** Raw environment values, before validation. */
export interface AiEnvironment {
  providerId?: string;
  baseUrl?: string;
  modelName?: string;
  apiKey?: string;
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Validates the environment and constructs the adapter it names.
 *
 * The selection is made from `AI_PROVIDER_ID` and nothing else: there is no
 * default, and no attempt to infer a service from the URL or the model name. An
 * unset or unrecognised id is a configuration error the application refuses to
 * start on, which is the only way "swap the environment, change no code" can be
 * a guarantee rather than an aspiration.
 */
export function createAiProvider(env: AiEnvironment): AiService {
  const config = validate(env);
  const Adapter = REGISTRY[config.providerId];
  return new Adapter(config);
}

function validate(env: AiEnvironment): AiProviderConfig {
  const providerId = env.providerId?.trim().toLowerCase() ?? '';

  if (providerId.length === 0) {
    throw new AiConfigurationError(
      `AI_PROVIDER_ID is not set. Set it to one of: ${SUPPORTED_PROVIDER_IDS.join(', ')}.`,
    );
  }

  if (!(providerId in REGISTRY)) {
    throw new AiConfigurationError(
      `AI_PROVIDER_ID "${providerId}" is not a supported provider. ` +
        `Supported values are: ${SUPPORTED_PROVIDER_IDS.join(', ')}.`,
    );
  }

  const baseUrl = env.baseUrl?.trim() ?? '';
  const modelName = env.modelName?.trim() ?? '';
  const apiKey = env.apiKey?.trim() ?? '';

  const missing = [
    baseUrl.length === 0 ? 'AI_BASE_URL' : null,
    modelName.length === 0 ? 'AI_MODEL_NAME' : null,
    apiKey.length === 0 ? 'AI_API_KEY' : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new AiConfigurationError(
      `The AI layer is missing required configuration: ${missing.join(', ')}.`,
    );
  }

  return {
    providerId,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    modelName,
    apiKey,
    timeoutMs: env.timeoutMs,
    maxRetries: env.maxRetries,
  };
}
