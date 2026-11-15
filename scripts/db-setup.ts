// npm run db:setup — creates tables and, on an empty database, the placeholder club.
import { pool } from "../server/db.ts";
import { setup } from "../server/seed.ts";

const pw = process.env.SEED_PASSWORD ?? "";
if (pw.length < 10) { console.error("Set SEED_PASSWORD (10+ characters) in .env.local first."); process.exit(1); }
const seeded = await setup(pool(), pw);
console.log(seeded ? "Schema created and placeholder club seeded. Sign in as <id>@fecpc.example (for example tasnim@, anika@, tanvir@, admin@) with SEED_PASSWORD." : "Schema is up to date. Existing data was left alone.");
await pool().end();
