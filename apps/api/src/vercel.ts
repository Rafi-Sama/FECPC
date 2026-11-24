// Vercel's entry (api/index.js re-exports this bundle). One app per function instance, built on the first request
// and reused while the instance lives; every request is handed to Fastify as if it had arrived on a socket.
import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { createApp } from './server.ts';

let ready: Promise<FastifyInstance> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= createApp()
    .then(async (app) => {
      const f = app.getHttpAdapter().getInstance() as FastifyInstance;
      await f.ready();
      return f;
    })
    .catch((e) => {
      ready = null; // a failed start (database asleep, bad config) is retried by the next request
      throw e;
    });
  (await ready).server.emit('request', req, res);
}
