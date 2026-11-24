// pnpm db:migrate — applies schema.sql in one transaction. Safe to re-run.
import pg from 'pg';
import { ConfigService } from '../platform/config/config.service.ts';
import { applySchema } from './apply-schema.ts';

const env = new ConfigService().env;
const url = env.DATABASE_URL;
console.log(`Applying schema to ${url.replace(/:[^:@/]+@/, ':***@')} ...`);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  // The role's own defaults (set below) are for the API's short queries, not for a schema change.
  await client.query(`set local statement_timeout = 0; set local lock_timeout = '60s'`);
  await applySchema(client);
  // Session settings as defaults of the API's role in this database, so every connection gets them, also through
  // a transaction pooler (Supabase, Neon), which drops per-connection startup options. JIT compiles the big state
  // query for seconds and never pays off on short queries; the timeouts stop a stuck query or a lock wait or an
  // abandoned transaction from holding rows.
  await client.query(`do $$ begin
    execute format('alter role %I in database %I set jit = off', current_user, current_database());
    execute format('alter role %I in database %I set statement_timeout = %s', current_user, current_database(), ${env.DB_STATEMENT_TIMEOUT_MS});
    execute format('alter role %I in database %I set lock_timeout = %s', current_user, current_database(), ${env.DB_LOCK_TIMEOUT_MS});
    execute format('alter role %I in database %I set idle_in_transaction_session_timeout = %s', current_user, current_database(), ${env.DB_IDLE_TX_TIMEOUT_MS});
  exception when insufficient_privilege then
    raise warning 'Could not set the session defaults (jit, timeouts) for this role: %', sqlerrm;
  end $$`);
  await client.query('COMMIT');
  console.log('✓ Schema is up to date.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed; nothing was changed.', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
