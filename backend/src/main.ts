import 'reflect-metadata';
import {
  RequestMethod,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Route all framework logging through pino.
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Security & transport hardening.
  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: true, credentials: true });

  // Versioned API surface: feature routes live under /api/v1/*.
  // The health probe stays at the root (/health), version-neutral.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Strict, transforming validation for every inbound payload.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Graceful shutdown: closes DB/Redis pools and drains queues on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 3000);
  const appName = config.get<string>('app.name', 'VITAL AI API');

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`${appName} listening on port ${port}`, 'Bootstrap');

  // Last-resort diagnostics. Without these a stray rejection can take the
  // process down with no trace, which reads to the client as an unexplained
  // connection failure. Rejections are logged and survived; a genuinely
  // corrupt state (uncaught exception) is logged, then shut down cleanly.
  process.on('unhandledRejection', (reason) => {
    logger.error(
      `Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
      'Bootstrap',
    );
  });

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.stack ?? error.message}`, 'Bootstrap');
    void app.close().finally(() => process.exit(1));
  });
}

void bootstrap().catch((error: unknown) => {
  // Boot failures (bad env, unreachable database) must be loud — the process
  // exits non-zero so a supervisor or `npm run dev` reports it instead of
  // leaving a silently dead port behind.
  console.error('Failed to start VITAL AI API:', error);
  process.exit(1);
});
