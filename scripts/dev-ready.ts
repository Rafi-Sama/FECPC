import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";

// 1. Ensure .env.local exists
if (!existsSync(".env.local")) {
  if (existsSync(".env.example")) {
    copyFileSync(".env.example", ".env.local");
    console.log("✓ Created .env.local from .env.example");
  }
}

// 2. Load .env.local
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const dbUrl = process.env.DATABASE_URL || "postgres://light:light@127.0.0.1:5432/fecpc";
process.env.DATABASE_URL = dbUrl;
const pw = process.env.SEED_PASSWORD || "fecpc-dev-2026";

async function isDbReachable(): Promise<boolean> {
  const client = new pg.Client({ connectionString: dbUrl, connectionTimeoutMillis: 1000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch {
    return false;
  }
}

// 3. Check DB and start docker container if needed
let ready = await isDbReachable();
if (!ready) {
  const isLocal = dbUrl.includes("127.0.0.1") || dbUrl.includes("localhost");
  if (isLocal) {
    console.log("PostgreSQL database is not reachable. Starting docker compose...");
    let started = false;
    try {
      execFileSync("/usr/bin/docker", ["compose", "up", "-d"], { stdio: "inherit" });
      started = true;
    } catch {
      try {
        execFileSync("/usr/bin/docker-compose", ["up", "-d"], { stdio: "inherit" });
        started = true;
      } catch {
        // Fall back to local pg_ctl if available
        try {
          const pgData = mkdtempSync(join(tmpdir(), "fecpc_pg-"));
          const parsed = new URL(dbUrl);
          const port = parsed.port || "5432";
          const user = parsed.username || "light";
          if (!existsSync(pgData)) {
            execSync(`initdb -D ${pgData} -U ${user} --auth=trust`, { stdio: "ignore" });
          }
          execSync(`rm -f ${pgData}/postmaster.pid /tmp/.s.PGSQL.${port}*`, { stdio: "ignore" });
          execSync(`pg_ctl -D ${pgData} -l ${pgData}/pg.log -o "-k /tmp -p ${port} -h 127.0.0.1" start`, { stdio: "ignore" });
          execSync(`createdb -h 127.0.0.1 -p ${port} -U ${user} fecpc 2>/dev/null || true`, { stdio: "ignore" });
          execSync(`createdb -h 127.0.0.1 -p ${port} -U ${user} fecpc_test 2>/dev/null || true`, { stdio: "ignore" });
          started = true;
        } catch {
          console.error("Failed to start docker compose or local postgres.");
        }
      }
    }

    if (started) {
      console.log("Waiting for database to be ready...");
      const start = Date.now();
      while (Date.now() - start < 15_000) {
        await new Promise((r) => setTimeout(r, 600));
        if (await isDbReachable()) {
          ready = true;
          break;
        }
      }
    }
  }
}

if (!ready) {
  console.error(`Error: Cannot connect to database at ${dbUrl}. Please start PostgreSQL or Docker.`);
  process.exit(1);
}

// 4. Ensure schema and seed
const { pool } = await import("../server/db.ts");
const { setup } = await import("../server/seed.ts");

try {
  const seeded = await setup(pool(), pw);
  if (seeded) {
    console.log("✓ Database schema created and seeded with demo data.");
  } else {
    console.log("✓ Database ready.");
  }
} catch (err) {
  console.error("Failed to setup database schema:", err);
  process.exit(1);
} finally {
  await pool().end();
}

