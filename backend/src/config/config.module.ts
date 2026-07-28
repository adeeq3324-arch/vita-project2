import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validationSchema } from './env.validation';

/**
 * Global configuration module. Loads and validates environment variables once
 * and exposes a typed `ConfigService` throughout the application.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),
  ],
})
export class AppConfigModule {}
