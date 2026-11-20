# Deployment

Two Node processes and a PostgreSQL database. Only the web app is public.

```
Internet ──HTTPS──▶ reverse proxy (TLS) ──▶ web  (next start, :3000) ──private network──▶ api (node dist/main.js, :3001) ──▶ PostgreSQL
```

## Build and run

```sh
pnpm install --frozen-lockfile
pnpm build                            # apps/web/.next and apps/api/dist/main.js

pnpm db:migrate                       # before starting a new version; idempotent, one transaction

cd apps/api && pnpm start             # node dist/main.js
cd apps/web && pnpm start             # next start
```

The API bundle keeps npm packages external, so deploy `apps/api` with its `node_modules`, together with
`packages/contracts` and `packages/content`. Node runs those packages from their TypeScript source through
type stripping, so use Node 22.18 or newer (`.nvmrc` pins 26).

## Environment

Set real environment variables. Do not ship `.env.local` files.

### API

| Variable                                                                                | Production value                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                               | `production`. Secure `__Host-fecpc_session` cookie, so the site must be served over HTTPS.                                                                                      |
| `DATABASE_URL`                                                                          | the production database                                                                                                                                                         |
| `APP_PUBLIC_URL`                                                                        | the public origin, for example `https://fecpc.example.edu`                                                                                                                      |
| `CORS_ORIGINS`                                                                          | the public origin(s) only. Also used by the CSRF check.                                                                                                                         |
| `TRUST_PROXY`                                                                           | number of proxies in front of the API whose `X-Forwarded-For` is trusted. With only the web app in front: `1`.                                                                  |
| `HOST`, `PORT`                                                                          | bind to a private interface                                                                                                                                                     |
| `LOG_LEVEL`                                                                             | `info` (JSON logs on stdout)                                                                                                                                                    |
| `RATE_LIMIT_GLOBAL_PER_MIN`                                                             | `300` unless you have a reason                                                                                                                                                  |
| `SESSION_IDLE_DAYS`, `SESSION_ABSOLUTE_DAYS`, `SESSION_MAX_PER_USER`                    | 14, 60, 10 by default                                                                                                                                                           |
| `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, `DB_IDLE_TX_TIMEOUT_MS` | 20, 15000, 5000, 30000 by default                                                                                                                                               |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`                       | optional; the redirect URI must be `https://<public origin>/api/auth/google/callback` and registered in Google Cloud                                                            |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                              | optional; a GitHub OAuth app whose callback URL is `https://<public origin>/api/auth/github/callback`                                                                           |
| `SMTP_URL`, `MAIL_FROM`                                                                 | optional; e.g. `smtps://club%40gmail.com:<app-password>@smtp.gmail.com:465`. Without them, accepting an application shows the invite link to the officer instead of emailing it |
| `TURNSTILE_SECRET_KEY`                                                                  | optional; Cloudflare Turnstile secret. When set, the join form must pass the human check                                                                                        |

### Web

| Variable                                  | Production value                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `API_INTERNAL_URL`                        | the API's private address, for example `http://api.internal:3001`                          |
| `TRUST_PROXY`                             | `1` when the reverse proxy sets `X-Forwarded-For`, so the client's address reaches the API |
| `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` | optional; same values as the API                                                           |
| `GITHUB_CLIENT_ID`                        | optional; same value as the API                                                            |
| `TURNSTILE_SITE_KEY`                      | optional; the public half of the API's `TURNSTILE_SECRET_KEY`                              |

### Getting the client address right

Sign-in throttling and the global rate limit count per client address. The chain must pass the real
address along:

1. The reverse proxy sets `X-Forwarded-For` to the client's address.
2. The web app (`TRUST_PROXY=1`) takes the last entry and sends it to the API as `X-Forwarded-For`.
3. The API (`TRUST_PROXY=1`, one hop: the web app) uses that value as the client address.

If the API is ever reachable without going through the web app, anyone can set that header. Keep it on a
private network.

## Health checks

| Endpoint                  | Meaning                                |
| ------------------------- | -------------------------------------- |
| `GET /health/live` (API)  | the process is up                      |
| `GET /health/ready` (API) | the database answers (`503` otherwise) |
| `GET /login` (web)        | the web app renders                    |

## Operations

- **Upgrades:** `pnpm db:migrate`, then restart the API, then the web app. Schema changes are additive and
  idempotent, so the old API version keeps working with the new schema.
- **Backups:** back up PostgreSQL. All member data is there; everything else is code and static content.
- **First officer account:** seed only in development. In production, create the first Super Admin with a
  one-time link, then do everything else (applications, roles) from the admin panel:

  ```sh
  TOKEN=$(openssl rand -hex 32)
  psql "$DATABASE_URL" -c "insert into users (id, email, name, role, title, batch, dept, invite_hash, invite_expires)
    values ('chief', 'chief@example.edu', 'Club Chief', 'super_admin', 'Super Admin', 0, 'CSE',
            encode(sha256(convert_to('$TOKEN', 'utf8')), 'hex'), now() + interval '1 day')"
  echo "https://<public origin>/login?invite=$TOKEN"   # open it once to set the password
  ```

- **Logs** are JSON (pino), one line per request, with a request ID (`X-Request-Id` is honoured). Cookies,
  passwords, tokens, transaction IDs and phone numbers are redacted.
- **Scaling out:** the global rate limit and the Codeforces sync throttle are in process memory. With
  several API instances, move them to the database or Redis first.
