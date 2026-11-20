import { HttpException } from '@nestjs/common';
import pg from 'pg';

// One pool per process. The API hands over its own pool (usePool); scripts and tests open one from DATABASE_URL.
const g = globalThis as { __fecpcPool?: pg.Pool };
export const usePool = (p: pg.Pool) => void (g.__fecpcPool = p);
export const pool = (): pg.Pool => {
  if (g.__fecpcPool) return g.__fecpcPool;
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
  return (g.__fecpcPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  }));
};
/** Anything that can run a query: the pool, or one client inside a transaction. */
export type Db = Pick<pg.Pool, 'query'>;

/** Runs `fn` in one transaction; any throw rolls everything back. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query('begin');
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/** A refusal the caller caused: wrong input, missing permission, conflict. Safe to show to the user. */
export class Fail extends HttpException {
  constructor(status: number, message: string) {
    super(message, status);
  }
}
