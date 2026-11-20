// pnpm db:migrate — applies schema.sql in one transaction. Safe to re-run.
import pg from 'pg';
import { ConfigService } from '../platform/config/config.service.ts';
import { applySchema } from './apply-schema.ts';

const url = new ConfigService().env.DATABASE_URL;
console.log(`Applying schema to ${url.replace(/:[^:@/]+@/, ':***@')} ...`);
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  await applySchema(client);
  await client.query('COMMIT');
  console.log('✓ Schema is up to date.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed; nothing was changed.', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
