import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '../config/config.service.ts';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.env.LOG_LEVEL,
          genReqId: (req) => {
            const header = req.headers['x-request-id'];
            return typeof header === 'string' ? header : randomUUID();
          },
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
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
