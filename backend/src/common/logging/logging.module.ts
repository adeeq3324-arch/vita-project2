import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

/**
 * Global structured-logging module (pino). Emits JSON logs in production and
 * human-readable output in development, attaches a correlation id to every
 * request/response, and redacts sensitive headers.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('env') === 'production';
        return {
          pinoHttp: {
            level: config.get<string>('logging.level') ?? 'info',
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:standard' } },
            autoLogging: true,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const existing = req.headers['x-request-id'];
              const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'res.headers["set-cookie"]',
              ],
              remove: true,
            },
            customLogLevel: (_req, res, err) => {
              if (err || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
