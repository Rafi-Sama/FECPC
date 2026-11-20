import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module.ts';
import { ConfigService } from './platform/config/config.service.ts';
import { ProblemDetailsFilter } from './platform/http/problem-details.filter.ts';
import { CsrfGuard } from './platform/http/csrf.guard.ts';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    // Only the configured number of proxy hops may set the client address (login throttling depends on it).
    trustProxy: new ConfigService().trustProxy,
    bodyLimit: 1_048_576, // 1 MB limit
  });

  fastifyAdapter
    .getInstance()
    .addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      if (!body || (typeof body === 'string' && body.trim() === '')) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err: any) {
        err.statusCode = 400;
        done(err, undefined);
      }
    });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
    bufferLogs: true,
    bodyParser: false, // the JSON parser registered above replaces Nest's (accepts empty bodies)
  });

  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // Cookies are only read and set, never signed: the session token is random and looked up server-side.
  await app.register(fastifyCookie as any);

  await app.register(fastifyRateLimit as any, {
    max: config.env.RATE_LIMIT_GLOBAL_PER_MIN,
    timeWindow: '1 minute',
  });

  await app.register(fastifyCors as any, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Requested-With', 'X-Request-Id'],
  });

  // Global Problem Details Exception Filter
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Global CSRF Guard
  app.useGlobalGuards(new CsrfGuard(config));

  // Every route is versioned under /v1 except the health probes.
  app.setGlobalPrefix('v1', { exclude: ['health/(.*)'] });

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  const port = config.env.PORT;
  const host = config.env.HOST;

  await app.listen(port, host);
  logger.log(`FECPC API successfully listening on http://${host}:${port}/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
