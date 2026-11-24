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
import { isIP } from 'node:net';
import { requestId } from './platform/logging/logging.module.ts';
import { sameSecret } from './modules/member-area/tokens.ts';

/** The API, configured and initialised but not listening: `main.ts` listens; `inprocess.ts` hands it the web app's requests. */
export async function createApp() {
  const env = new ConfigService();
  const fastifyAdapter = new FastifyAdapter({
    // Only the configured number of proxy hops may set the client address (login throttling depends on it).
    trustProxy: env.trustProxy,
    bodyLimit: 1_048_576, // 1 MB limit
    genReqId: requestId, // the same id in logs and in error responses
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

  // Where the API runs as its own server with a public address, only the web app may call it: it proves itself
  // with the shared secret and reports the visitor's address in X-Client-Ip, since a platform may rewrite
  // X-Forwarded-For.
  // Runs before the rate limiter, which then counts the visitor, not the web app.
  const secret = env.env.API_PROXY_SECRET;
  if (secret)
    fastifyAdapter.getInstance().addHook('onRequest', async (req, reply) => {
      if (req.url.startsWith('/health') || req.url.startsWith('/v1/cron')) return; // cron has its own secret
      if (!sameSecret(req.headers['x-proxy-secret'], secret))
        return reply
          .code(404)
          .send({ status: 404, code: 'RESOURCE_NOT_FOUND', detail: 'Not found.' });
      const ip = req.headers['x-client-ip'];
      if (typeof ip === 'string' && isIP(ip)) req.raw.headers['x-forwarded-for'] = ip;
      else delete req.raw.headers['x-forwarded-for'];
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
  app.setGlobalPrefix('v1', { exclude: ['health/{*path}'] });

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  await app.init();
  return app;
}
