import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_SERVICE } from './ai.constants';
import type { AiService } from './ai.interface';
import { createAiProvider, SUPPORTED_PROVIDER_IDS } from './providers/provider.factory';

/**
 * Global AI module. Resolves exactly one {@link AiService} implementation at
 * boot from four environment values — `AI_PROVIDER_ID`, `AI_BASE_URL`,
 * `AI_MODEL_NAME`, `AI_API_KEY` — and publishes it under the {@link AI_SERVICE}
 * token.
 *
 * The module itself names no model service and imports no vendor SDK: it reads
 * configuration and delegates the choice to the provider registry. Every feature
 * that generates something injects the token, so switching the platform to a
 * different service is an environment change with no code change anywhere.
 *
 * Configuration is validated eagerly rather than on first use. A typo in
 * `AI_PROVIDER_ID` surfaces as a refused boot with the list of accepted values,
 * not as a run-time failure inside a background job hours later.
 */
@Global()
@Module({
  providers: [
    {
      provide: AI_SERVICE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiService => {
        const service = createAiProvider({
          providerId: config.get<string>('ai.providerId'),
          baseUrl: config.get<string>('ai.baseUrl'),
          modelName: config.get<string>('ai.modelName'),
          apiKey: config.get<string>('ai.apiKey'),
          timeoutMs: config.get<number>('ai.timeoutMs', 60_000),
          maxRetries: config.get<number>('ai.maxRetries', 2),
        });

        // The provider id and model are safe to log and make a misconfigured
        // deployment obvious in the first lines of the boot log. The key is not.
        new Logger('AiModule').log(
          `AI provider "${config.get<string>('ai.providerId')}" ready ` +
            `(model: ${config.get<string>('ai.modelName')}; ` +
            `supported ids: ${SUPPORTED_PROVIDER_IDS.join(', ')})`,
        );

        return service;
      },
    },
  ],
  exports: [AI_SERVICE],
})
export class AiModule {}
