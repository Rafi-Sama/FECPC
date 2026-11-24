// pnpm db:seed — applies the schema and, on an empty database only, creates the placeholder club.
import pg from 'pg';
import { ConfigService } from '../platform/config/config.service.ts';
import { usePool } from '../modules/member-area/db.ts';
import { setup } from './seed-data.ts';

const pw = process.env.SEED_PASSWORD ?? '';
if (pw.length < 10) {
  console.error(
    'Set SEED_PASSWORD (10+ characters) in apps/api/.env.local or the root .env.local.',
  );
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: new ConfigService().env.DATABASE_URL });
usePool(pool);
try {
  const seeded = await setup(pool, pw);
  console.log(
    seeded
      ? 'Placeholder club seeded. Sign in as <id>@fecpc.example (tasnim@, anika@, tanvir@, admin@) with SEED_PASSWORD.'
      : 'Schema is up to date. Existing data was left alone.',
  );
} finally {
  await pool.end();
}
