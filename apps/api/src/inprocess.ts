// The API as a library: the web app calls it in its own process (no network hop, no public address). One app per
// process, built on the first call and reused; a failed start (database asleep, bad config) is retried next call.
import 'reflect-metadata';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { createApp } from './server.ts';

let ready: Promise<FastifyInstance> | null = null;

/** Runs one request through the full API (guards, rate limit, error filter) without a socket. */
export async function inject(opts: InjectOptions) {
  ready ??= createApp()
    .then(async (app) => {
      const f = app.getHttpAdapter().getInstance() as FastifyInstance;
      await f.ready();
      return f;
    })
    .catch((e) => {
      ready = null;
      throw e;
    });
  return (await ready).inject(opts);
}
