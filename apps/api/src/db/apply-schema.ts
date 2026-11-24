import { readFileSync } from 'node:fs';

/** Applies schema.sql. Every statement is idempotent, so this is safe on new and existing databases. */
export async function applySchema(db: { query: (sql: string) => Promise<unknown> }) {
  await db.query(readFileSync(new URL('schema.sql', import.meta.url), 'utf8'));
}
