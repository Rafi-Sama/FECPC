# Getting started

## Prerequisites

- **Node.js 26** (`.nvmrc`; at least 22 per `package.json` engines). `engine-strict` is on.
- **pnpm 12** (`packageManager` in `package.json`; `corepack enable` picks it up).
- **PostgreSQL 16**, easiest through Docker (`docker-compose.yml`).

## First run

```sh
pnpm install

# 1. Database: PostgreSQL on 127.0.0.1:5433 with databases fecpc (dev) and fecpc_test (tests).
docker compose up -d

# 2. Configuration. The API works with no file at all except for seeding; the web app needs its own file.
cp apps/api/.env.example apps/api/.env.local      # set SEED_PASSWORD (10+ characters)
cp apps/web/.env.example apps/web/.env.local      # `pnpm dev` also does this when it is missing

# 3. Schema + placeholder club (27 accounts). Safe to re-run: it never touches a non-empty database.
pnpm db:setup

# 4. Run both apps: web on http://localhost:3000, API on http://localhost:3001.
#    `pnpm dev` itself also runs steps 1 and 3 (waits for Postgres to be healthy), so after setup it is all you need.
pnpm dev
```

Sign in at <http://localhost:3000/login> as any seeded account with your `SEED_PASSWORD`:

| Role                   | Accounts (`<id>@fecpc.example`)                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| Super Admin (operator) | `admin`                                                                                               |
| President              | `tanvir`                                                                                              |
| Treasurer              | `anika`                                                                                               |
| Secretary              | `nusrat`, `sadia`                                                                                     |
| CP Head                | `nadia`                                                                                               |
| Member                 | `rahim`, `mehedi`, `tasnim`, `priya`, `farhan`, `imran`, `sabbir`, `shuvo`, `zahid`, `mim`, `jannat`                     |
| Alumni                 | `shahriar`, `rifat`, `tahmina`, `tanim`, `fariha`, `sabrina`, `nabila`, `nusrat_al`, `asif`, `mahmud` |

Signing in as different roles is the fastest way to see what each one can do.

## Where configuration comes from

| App | File(s) read                                                                  | Notes                                                                                                                                  |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| API | real environment, then `apps/api/.env.local`, then the repo-root `.env.local` | Every variable has a default except `SEED_PASSWORD`. See `apps/api/.env.example` and `apps/api/src/platform/config/config.service.ts`. |
| Web | `apps/web/.env.local` (Next.js convention)                                    | `API_INTERNAL_URL`, `TRUST_PROXY`, `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`. See `apps/web/.env.example`.                             |

The database URL defaults to `postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc`, which matches
`docker-compose.yml`.

## Everyday commands

From the repository root:

| Command                               | What it does                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`                            | Both apps in watch mode (Turborepo). The API rebuilds and restarts on every change.               |
| `pnpm db:migrate`                     | Applies `apps/api/src/db/schema.sql` (idempotent, one transaction).                               |
| `pnpm db:seed`                        | Applies the schema and seeds the placeholder club if the database is empty.                       |
| `pnpm db:setup`                       | `db:migrate` then `db:seed`.                                                                      |
| `pnpm verify`                         | format check, lint, typecheck, tests and production builds for every package. Run before pushing. |
| `pnpm check`                          | The same, with auto-fixing of format and lint, and a summary table (`scripts/check.mjs`).         |
| `pnpm --filter @fecpc/api test`       | API tests only (needs the `fecpc_test` database).                                                 |
| `pnpm --filter @fecpc/contracts test` | Shared-rules tests only (no database).                                                            |

One test file: `cd apps/api && node --import tsx --test test/password.test.ts`. Details in
[Testing](testing.md).

## Optional: Google sign-in

1. Create an OAuth client (type "Web application") in Google Cloud Console with the redirect URI
   `http://localhost:3000/api/auth/google/callback`.
2. API (`apps/api/.env.local`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
3. Web (`apps/web/.env.local`): `GOOGLE_CLIENT_ID` (shows the button). No secret in the web app.
4. If your public origin is not `http://localhost:3000`, set the same `GOOGLE_REDIRECT_URI` in both apps.

Google sign-in only works for an address that already belongs to an active member account.

## Troubleshooting

| Symptom                                                    | Cause and fix                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm db:seed` says "Set SEED_PASSWORD"                    | Put `SEED_PASSWORD=...` (10+ characters) in `apps/api/.env.local` or the root `.env.local`.                    |
| API tests fail with `database "fecpc_test" does not exist` | The Docker volume predates `infra/postgres/init.sql`. Run `createdb -h 127.0.0.1 -p 5433 -U fecpc fecpc_test`. |
| Every member page redirects to `/login`                    | The API is not running or `API_INTERNAL_URL` is wrong; the web app treats an unreachable API as "signed out".  |
| `403 Origin not allowed` on every change                   | The page's origin is not in the API's `CORS_ORIGINS`. Add it (for example `http://127.0.0.1:3000`).            |
| `429 Too many failed login attempts`                       | 5 failures per email and address in 15 minutes. Wait, or `DELETE FROM login_attempts` locally.                 |
| Port 3000 or 3001 already in use                           | Another `pnpm dev` is running. Stop it, or set `PORT` (API) / `next dev -p` (web).                             |
