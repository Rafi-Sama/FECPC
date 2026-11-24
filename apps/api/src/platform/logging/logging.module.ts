import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '../config/config.service.ts';

/** A caller's X-Request-Id is kept only if it looks like an id: it is logged and echoed in error responses. */
export const requestId = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && /^[\w.-]{1,64}$/.test(header) ? header : randomUUID();
};

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Every route, in the router's current wildcard syntax (the default `*` is the legacy one).
        forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.env.LOG_LEVEL,
          genReqId: requestId,
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-proxy-secret"]',
              '*.password',
              '*.token',
              '*.trx',
              '*.phone',
              '*.senderPhone',
              '*.sender_phone',
              '*.secret',
            ],
            censor: '[REDACTED]',
          },
          autoLogging: true,
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
