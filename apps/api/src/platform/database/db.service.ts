import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { ConfigService } from '../config/config.service.ts';

export type TxClient = pg.PoolClient;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: pg.Pool;
  private readonly als = new AsyncLocalStorage<TxClient>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.pool = new pg.Pool({
      connectionString: this.config.env.DATABASE_URL,
      max: this.config.env.DB_POOL_MAX,
      statement_timeout: this.config.env.DB_STATEMENT_TIMEOUT_MS,
      query_timeout: this.config.env.DB_STATEMENT_TIMEOUT_MS,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: this.config.env.DB_IDLE_TX_TIMEOUT_MS,
      // JIT compiles the big state query for seconds on every call and never pays off on short OLTP queries.
      options: '-c jit=off',
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  /**
   * Runs an operation inside a database transaction using AsyncLocalStorage.
   * Nested calls automatically join the existing transaction.
   * Safely retries on transient serialization failure (40001) or deadlock (40P01).
   */
  async run<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
    const existing = this.als.getStore();
    if (existing) {
      return fn(existing);
    }

    let retries = 0;
    const maxRetries = 3;

    while (true) {
      const client = await this.pool.connect();
      let connectionError: any = null;

      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL lock_timeout = '${this.config.env.DB_LOCK_TIMEOUT_MS}ms'`);

        const result = await this.als.run(client, () => fn(client));
        await client.query('COMMIT');
        return result;
      } catch (err: any) {
        connectionError = err;
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback failure on broken connection
        }

        // Retry on 40001 (serialization failure) or 40P01 (deadlock detected)
        if ((err.code === '40001' || err.code === '40P01') && retries < maxRetries) {
          retries++;
          const jitter = Math.floor(Math.random() * 50) + 10;
          await new Promise((r) => setTimeout(r, retries * 50 + jitter));
          continue;
        }

        throw err;
      } finally {
        // If a fatal connection error occurred, notify pool so broken client is destroyed
        const isFatal =
          connectionError &&
          (connectionError.code === 'ECONNRESET' ||
            connectionError.code === '57P01' || // admin_shutdown
            connectionError.code === '57P02' || // crash_shutdown
            connectionError.code === '57P03'); // cannot_connect_now
        client.release(isFatal ? connectionError : undefined);
      }
    }
  }

  /** Runs on the transaction client when called inside run(), otherwise on the pool. */
  async query<R extends pg.QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<pg.QueryResult<R>> {
    return (this.als.getStore() ?? this.pool).query<R>(text, params);
  }
}
