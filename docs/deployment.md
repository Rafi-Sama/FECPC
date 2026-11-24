# Deployment

Two ways to run it:

- **Free: one Vercel project and Supabase Postgres** (below). The API runs inside the web app's functions.
- **A server:** two Node processes and PostgreSQL, only the web app public:

```
Internet ──HTTPS──▶ reverse proxy (TLS) ──▶ web  (next start, :3000) ──private network──▶ api (node dist/main.js, :3001) ──▶ PostgreSQL
```

The web app reaches the API over HTTP when `API_INTERNAL_URL` is set (a server, local development), and runs it
in its own process when it is not (`@fecpc/api/inprocess`, see `apiFetch` in `apps/web/lib/api.ts`). Either way
every request passes the API's own guards, rate limit and error filter.

## Free hosting: Vercel + Supabase

```
Browser ──▶ Vercel project (apps/web; the API inside it) ──▶ Supabase Postgres (transaction pooler)
            Vercel Cron, daily, and mail runs ──CRON_SECRET──▶ GET /api/cron
```

1. **Database.** Create a Supabase project (free), region Singapore. Copy the **transaction pooler** connection
   string (port 6543) from Connect. The API keeps no session state, and its session settings (`jit`, statement,
   lock and idle-transaction timeouts) are defaults of its database role, set by `pnpm db:migrate`, so they
   apply through the pooler.
2. **Secret.** `openssl rand -hex 32` for `CRON_SECRET`.
3. **Project.** New Vercel project from the repository, root directory `apps/web`, Node.js 24, region Singapore
   (`sin1`). `apps/web/vercel.json` builds the API bundle, then the web app; on production deployments it first
   runs `pnpm db:migrate` (the schema is idempotent). Vercel's own Git deploys are off there: the
   [pipeline](#cicd) deploys `main` only after CI passes. Environment (Production): `DATABASE_URL`, `CRON_SECRET`,
   `APP_ENV=production`, `TRUST_PROXY=1`, `APP_PUBLIC_URL` and `CORS_ORIGINS` (both the production URL, e.g.
   `https://fecpc.vercel.app`), plus the optional mail, Google, GitHub and Turnstile values below. Leave
   `API_INTERNAL_URL` and `API_PROXY_SECRET` unset.
4. **First Super Admin.** Run the one-time-link SQL under [Operations](#operations) in Supabase's SQL editor.

How it fits the free limits (measured with 1,200 members; see the numbers in the
[backend audit](backend-audit.md)):

- **One function per request.** About 35% of Vercel's 1M calls and 40–50% of its 4 active-CPU hours a month at
  300 active members a day. Past a Hobby limit Vercel switches functions off until the month ends, so watch
  Usage in the dashboard.
- **Photos and banners** are served at a versioned link (`?v=`) with `s-maxage`, so Vercel's CDN keeps them:
  each photo leaves the database about once, not on every view (Supabase allows 5 GB of egress a month).
- **Timers do not run** while a function sleeps. `GET /api/cron` does their work (this week's sheet, the mail
  queue); Vercel calls it daily at 00:05 club time. Do not add a frequent pinger: it only costs function time.
- **Per-client limits** that matter are in the database: sign-in attempts, applications, the per-member write
  cap, the Codeforces sync and the mail limits. The global per-address rate limit is per function instance, so
  it is weaker; Vercel's DDoS protection sits in front.
- **Storage.** Supabase's 500 MB: photos are downscaled to 512 px in the browser (about 50 KB), so 1,000
  members' photos take about 50 MB. Supabase's free plan has no backups: export now and then (`pg_dump`).
- **Durations.** Up to 300 s per function (Hobby): actions and `/api/cron` may run that long, because mail
  goes out after the response (see [Email](#email)); other requests take well under a second.
- **Preview deployments** get other URLs, which `CORS_ORIGINS` does not list, so their sign-in is refused. Test
  on production or add the preview URL.

## CI/CD

`.github/workflows/ci.yml`, on every pull request and every push to `main`:

1. **verify**: exact-lockfile install, `pnpm audit --prod --audit-level high`, `pnpm verify` (format, lint,
   typecheck, API tests on a Postgres 16 service, contracts tests, build), then `scripts/smoke.mjs` against the
   production build with the API in-process (`VERCEL=1`, Secure cookies), on a migrated and seeded database.
2. **deploy** (pushes to `main` only, after verify passes): `vercel deploy --prod` uploads the source; Vercel
   builds it with its own environment, so database, mail and OAuth secrets never reach GitHub. Then the smoke
   test runs against the live site (public checks only).

Security: the workflow token is read-only; actions are pinned to commit SHAs; pull requests (including forks)
run without secrets; the one secret, `VERCEL_TOKEN`, is for the deploy job. Dependabot (`.github/dependabot.yml`)
proposes dependency and action updates weekly, and each one passes the same CI.

GitHub setup (Settings → Secrets and variables → Actions): secret `VERCEL_TOKEN` (vercel.com/account/tokens,
with an expiry); variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (`.vercel/project.json` after `vercel link`) and
`APP_PUBLIC_URL`. On a public repository, put them in an environment named `production` limited to `main`
(Settings → Environments), and protect `main` (require the **Verify** check). GitHub Free offers neither for
private repositories; there the deploy job's `needs: verify` is the gate.

## Launch checklist

- [ ] Supabase project (Singapore), transaction-pooler URL copied.
- [ ] Vercel project: root `apps/web`, Node.js 24, Production environment variables set (see above). A wrong
      value stops the API with a clear message (`productionProblems` in `config.service.ts`): http origins,
      `CORS_ORIGINS` without the site, the local database, or no `CRON_SECRET` on Vercel.
- [ ] GitHub secret and variables set; first push to `main` deploys; the deploy job's smoke test passes.
- [ ] First Super Admin created ([Operations](#operations)); sign in, set the President, then the officers.
- [ ] Mail: `SMTP_URL` set, a test email sent from Admin → Recruit → Acceptance email → Send me a test.
- [ ] Google / GitHub sign-in (optional): redirect URIs registered with the production origin.
- [ ] Replace the placeholders: `packages/content/src/site.ts` (members, committee, contests, projects, hall of
      fame, timeline) and `apps/web/lib/site.ts` (contact email, social links).
- [ ] Never run `pnpm db:setup` or `db:seed` against production (the seed refuses non-local databases).

## Build and run on a server

```sh
pnpm install --frozen-lockfile
pnpm build                            # apps/web/.next, apps/api/dist/main.js and dist/inprocess.js

pnpm db:migrate                       # before starting a new version; idempotent, one transaction

cd apps/api && pnpm start             # node dist/main.js
cd apps/web && pnpm start             # next start, with API_INTERNAL_URL pointing at the API
```

The API bundle keeps npm packages external but includes the workspace packages (`@fecpc/contracts`,
`@fecpc/content`), so deploy `apps/api` with its `node_modules`. Node 22 or newer (`.nvmrc` pins 26). If the API
must have a public address (another host), set the same `API_PROXY_SECRET` on both apps: the API then refuses
every request without it.

## Environment

Set real environment variables. Do not ship `.env.local` files.

### API

| Variable                                                                                | Production value                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                                                                               | `production`. Secure `__Host-fecpc_session` cookie, so the site must be served over HTTPS.                                                                                                                                                                                                                                                                                    |
| `DATABASE_URL`                                                                          | the production database                                                                                                                                                                                                                                                                                                                                                       |
| `APP_PUBLIC_URL`                                                                        | the public origin, for example `https://fecpc.example.edu`                                                                                                                                                                                                                                                                                                                    |
| `CORS_ORIGINS`                                                                          | the public origin(s) only. Also used by the CSRF check.                                                                                                                                                                                                                                                                                                                       |
| `TRUST_PROXY`                                                                           | number of proxies in front of the API whose `X-Forwarded-For` is trusted. With only the web app in front: `1`.                                                                                                                                                                                                                                                                |
| `HOST`, `PORT`                                                                          | bind to a private interface                                                                                                                                                                                                                                                                                                                                                   |
| `LOG_LEVEL`                                                                             | `info` (JSON logs on stdout)                                                                                                                                                                                                                                                                                                                                                  |
| `RATE_LIMIT_GLOBAL_PER_MIN`                                                             | `300` unless you have a reason                                                                                                                                                                                                                                                                                                                                                |
| `SESSION_IDLE_DAYS`, `SESSION_ABSOLUTE_DAYS`, `SESSION_MAX_PER_USER`                    | 14, 60, 10 by default                                                                                                                                                                                                                                                                                                                                                         |
| `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS`, `DB_IDLE_TX_TIMEOUT_MS` | 20, 15000, 5000, 30000 by default                                                                                                                                                                                                                                                                                                                                             |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`                       | optional; the redirect URI must be `https://<public origin>/api/auth/google/callback` and registered in Google Cloud                                                                                                                                                                                                                                                          |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                              | optional; a GitHub OAuth app whose callback URL is `https://<public origin>/api/auth/github/callback`                                                                                                                                                                                                                                                                         |
| `SMTP_URL`, `MAIL_FROM`                                                                 | optional; one or more SMTP URLs separated by spaces, each with optional `?daily=`, `per_minute=`, `from=` (see [Email](#email)), e.g. `smtps://club%40gmail.com:<app-password>@smtp.gmail.com:465` (a Gmail app password). `MAIL_FROM` is the default sender. Without them, accepting an application shows the invite link to the officer and event approvals are not emailed |
| `MAIL_DAILY_LIMIT`                                                                      | optional, default `400`: the daily limit of an account without `daily=`. Free Gmail allows about 500; keep headroom for the account's own mail                                                                                                                                                                                                                                |
| `TURNSTILE_SECRET_KEY`                                                                  | optional; Cloudflare Turnstile secret. When set, the join form must pass the human check                                                                                                                                                                                                                                                                                      |
| `API_PROXY_SECRET`                                                                      | only when the API runs on its own host with a public address: 32+ random characters, the same as the web app's. Every request but `/health` and `/v1/cron` must carry it                                                                                                                                                                                                      |
| `CRON_SECRET`                                                                           | bearer token for `GET /v1/cron` (the web app's `/api/cron`); Vercel Cron sends it                                                                                                                                                                                                                                                                                             |

### Web

| Variable                                  | Production value                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `API_INTERNAL_URL`                        | the API's address on a server, e.g. `http://api.internal:3001`. **Unset on Vercel**: the API then runs inside the web app |
| `TRUST_PROXY`                             | `1` when the reverse proxy sets `X-Forwarded-For`, so the client's address reaches the API                                |
| `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI` | optional; same values as the API                                                                                          |
| `GITHUB_CLIENT_ID`                        | optional; same value as the API                                                                                           |
| `TURNSTILE_SITE_KEY`                      | optional; the public half of the API's `TURNSTILE_SECRET_KEY`                                                             |
| `API_PROXY_SECRET`                        | the API's `API_PROXY_SECRET`, when it has one                                                                             |

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
also by a timer every minute and at startup; on Vercel by `GET /api/cron`), so it needs no paid service or
worker:

- **Several free accounts add up.** `SMTP_URL` may list several SMTP URLs separated by spaces, each with
  optional `daily`, `per_minute` and `from` query parameters, e.g.

  ```
  SMTP_URL="smtps://club%40gmail.com:APP_PASSWORD@smtp.gmail.com:465?daily=400&from=FECPC%20%3Cclub%40gmail.com%3E
            smtp://LOGIN:KEY@smtp-relay.brevo.com:587?daily=280&from=FECPC%20%3Cclub%40gmail.com%3E"
  ```

  A mailing is spread across all of them: each account sends within its own daily limit (rolling 24 hours, the
  way Gmail counts; default `MAIL_DAILY_LIMIT`, 400) and pace (default 20 a minute: Gmail flags fast bursts
  from new senders). Gmail 400 + Brevo's free 300 a day is about 700 a day at 40 a minute; a Google Workspace
  account (a university one, if the club gets one) allows about 2,000 a day. Use different providers, not
  several Gmail accounts: splitting one sender over many accounts breaks Gmail's terms. Each provider must accept
  the `from` address (Brevo: verify the sender).

- **Large mailings.** On a server a timer sends each minute's share. On Vercel the action that queued the mail
  keeps its function alive for one run of up to 4 minutes (pausing between minutes), then calls `/api/cron`,
  which starts the next run, until the queue is empty or every account has used its daily limit; the rest goes
  on the next day (the daily cron or any action). Only one run sends at a time (a lease row in the database), so
  the limits hold across instances.
- **Quota and login errors** pause only the account that answered (an hour for a quota, 10 minutes for a
  rejected login or an unreachable server); the others carry on. When every account is paused, the queue waits.
  Retry in the Email tab clears the pauses.
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
