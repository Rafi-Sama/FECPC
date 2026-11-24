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

The API bundle keeps npm packages external but includes the workspace packages (`@fecpc/contracts`,
`@fecpc/content`), so deploy `apps/api` with its `node_modules`. Node 22 or newer (`.nvmrc` pins 26).

## Free hosting: Vercel + Neon

Everything runs on free tiers: two Vercel projects from this repository (web and API) and a Neon Postgres
database. Vercel has no private network, so the API gets a public address and refuses every request that does
not carry `API_PROXY_SECRET`, which only the web app knows.

```
Browser ──▶ Vercel project "web" (apps/web) ──API_PROXY_SECRET──▶ Vercel project "api" (apps/api, one function) ──▶ Neon
                                                    Vercel Cron, daily ──CRON_SECRET──▶ GET /v1/cron
```

1. **Database.** Create a Neon project (free). Copy the **direct** connection string (the host without
   `-pooler`): the API sets `jit`, `lock_timeout` and `idle_in_transaction_session_timeout` as connection
   options, which Neon's pooler does not pass on. Each function instance keeps at most 5 connections
   (`DB_POOL_MAX` defaults to 5 on Vercel), well within the free tier.
2. **Secrets.** `openssl rand -hex 32` twice: one for `API_PROXY_SECRET`, one for `CRON_SECRET`.
3. **API project.** New Vercel project from the repo, root directory `apps/api`. `apps/api/vercel.json` does the
   rest: it installs, runs `pnpm db:migrate` on production deployments (the schema is idempotent), builds
   `dist/vercel.js`, routes every path to `api/index.js` and schedules the daily cron. Environment:
   `APP_ENV=production`, `DATABASE_URL`, `API_PROXY_SECRET`, `CRON_SECRET`, `APP_PUBLIC_URL` and
   `CORS_ORIGINS` (both the web project's production URL), `TRUST_PROXY=1`, plus the optional mail, Google,
   GitHub and Turnstile values below.
4. **Web project.** New Vercel project from the repo, root directory `apps/web` (Next.js is detected).
   Environment: `API_INTERNAL_URL` (the API project's URL), the same `API_PROXY_SECRET`, `TRUST_PROXY=1`, and
   the optional sign-in and Turnstile values.
5. **First Super Admin.** Run the one-time-link SQL under [Operations](#operations) against Neon.

What changes on serverless, and why it still works:

- **Timers do not run** while a function sleeps. `GET /v1/cron` does their work (this week's sheet, the mail
  queue). Vercel's free plan calls it once a day (00:05 club time, so Monday's sheet appears at once). Do not
  add a frequent pinger: every call wakes the database, and a free database metered by awake time (Neon:
  100 CU-hours a month) would run out and stop until the next month. Mail retries and large mailings
  (20 a minute) therefore continue on the next action or the next daily run.
- **Mail after an action** is sent before the function sleeps (`waitUntil`), so single emails go out at once.
- **Per-client limits** that matter are in the database: sign-in attempts, applications, the per-member write
  cap and the Codeforces sync. The global rate limit is per function instance there, so it is weaker; Vercel's
  own DDoS protection sits in front.
- **Limits of the free tiers.** Neon: 0.5 GB (photos are downscaled to 512 px in the browser, about 50 KB each)
  and the database sleeps after 5 idle minutes (the first request then waits about a second). Vercel: 60 s per
  request is configured; the slowest call (a cold Codeforces problem set) takes about 15 s.
- **Preview deployments** get other URLs, which `CORS_ORIGINS` does not list, so their sign-in is refused. Test
  on production or add the preview URL.

Self-hosting on one machine (below) needs none of this: leave `API_PROXY_SECRET` empty and keep the API
private.

## Environment

Set real environment variables. Do not ship `.env.local` files.

### API

| Variable                                                                                | Production value                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                               | `production`. Secure `__Host-fecpc_session` cookie, so the site must be served over HTTPS.                                                                                                                                                    |
| `DATABASE_URL`                                                                          | the production database                                                                                                                                                                                                                       |
| `APP_PUBLIC_URL`                                                                        | the public origin, for example `https://fecpc.example.edu`                                                                                                                                                                                    |
| `CORS_ORIGINS`                                                                          | the public origin(s) only. Also used by the CSRF check.                                                                                                                                                                                       |
| `TRUST_PROXY`                                                                           | number of proxies in front of the API whose `X-Forwarded-For` is trusted. With only the web app in front: `1`.                                                                                                                                |
| `HOST`, `PORT`                                                                          | bind to a private interface                                                                                                                                                                                                                   |
| `LOG_LEVEL`                                                                             | `info` (JSON logs on stdout)                                                                                                                                                                                                                  |
| `RATE_LIMIT_GLOBAL_PER_MIN`                                                             | `300` unless you have a reason                                                                                                                                                                                                                |
| `SESSION_IDLE_DAYS`, `SESSION_ABSOLUTE_DAYS`, `SESSION_MAX_PER_USER`                    | 14, 60, 10 by default                                                                                                                                                                                                                         |
| `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, `DB_IDLE_TX_TIMEOUT_MS` | 20, 15000, 5000, 30000 by default                                                                                                                                                                                                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`                       | optional; the redirect URI must be `https://<public origin>/api/auth/google/callback` and registered in Google Cloud                                                                                                                          |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                              | optional; a GitHub OAuth app whose callback URL is `https://<public origin>/api/auth/github/callback`                                                                                                                                         |
| `SMTP_URL`, `MAIL_FROM`                                                                 | optional; e.g. `smtps://club%40gmail.com:<app-password>@smtp.gmail.com:465` (a Gmail app password, not the account password). Without them, accepting an application shows the invite link to the officer and event approvals are not emailed |
| `MAIL_DAILY_LIMIT`                                                                      | optional, default `400`: emails sent per rolling 24 h. Free Gmail allows about 500; keep headroom for the account's own mail. See [Email](#email)                                                                                             |
| `TURNSTILE_SECRET_KEY`                                                                  | optional; Cloudflare Turnstile secret. When set, the join form must pass the human check                                                                                                                                                      |
| `API_PROXY_SECRET`                                                                      | where the API has a public address (Vercel): 32+ random characters, the same as the web app's. Every request but `/health` and `/v1/cron` must carry it                                                                                       |
| `CRON_SECRET`                                                                           | bearer token for `GET /v1/cron`; on Vercel, Vercel Cron sends it                                                                                                                                                                              |

### Web

| Variable                                  | Production value                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `API_INTERNAL_URL`                        | the API's private address, for example `http://api.internal:3001`                          |
| `TRUST_PROXY`                             | `1` when the reverse proxy sets `X-Forwarded-For`, so the client's address reaches the API |
| `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` | optional; same values as the API                                                           |
| `GITHUB_CLIENT_ID`                        | optional; same value as the API                                                            |
| `TURNSTILE_SITE_KEY`                      | optional; the public half of the API's `TURNSTILE_SECRET_KEY`                              |
| `API_PROXY_SECRET`                        | the API's `API_PROXY_SECRET`, when it has one                                              |

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

## Email

All email goes through the `mail_queue` table and is sent by the API itself (after each action; on a server
also by a timer every minute and at startup; on Vercel by `GET /v1/cron`), so it needs no paid service or
worker:

- **Daily limit.** At most `MAIL_DAILY_LIMIT` messages per rolling 24 hours, at most 20 per minute. Anything over
  waits in the queue for the window to roll over. If Gmail still answers with a quota error, the whole queue
  pauses for an hour.
- **Sleeping hosts.** A free host that sleeps when idle only delays mail; the queue is in the database and is
  drained when the API starts.
- **Too late is not sent.** Set-password emails expire with their link (7 days) and event approvals when the
  event starts. Officers are told at the time when the limit would make mail late, and can send the link
  themselves.
- **Failures are visible.** Recruit and each event's Email tab show sent/limit, what is waiting, the latest
  server error (unreachable, login rejected) and failed messages with a Retry button. A rejected login or an
  unreachable server keeps mail queued instead of failing it.
- **SMTP ports.** Some free hosts block outgoing SMTP (ports 465/587). The status strip then shows "Could not
  reach the mail server"; check this on the host before relying on email.

Templates are HTML + CSS per recruitment and per event (Admin → Recruit → a recruitment → Acceptance email;
an event → Organise → Email), checked by `checkMailTemplate` in `@fecpc/contracts`: at most 100 KB (Gmail clips
above 102 KB), recruitment emails must keep `{{link}}`, scripts, forms and event handlers are removed. A new
recruitment or event starts from the latest saved design.

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
- **Scaling out:** only the global rate limit is in process memory (sign-in, application, write-cap and
  Codeforces-sync limits are in the database). With several instances it counts per instance.
