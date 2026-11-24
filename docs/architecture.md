# Architecture

## The pieces

```
 Browser
   │  same origin only: pages + /api/* (cookies are httpOnly, SameSite=Lax)
   ▼
 apps/web  ── Next.js 16 (App Router, React 19)
   │  • renders the public site and the member area
   │  • /api/* route handlers are a thin proxy (lib/api.ts → proxy())
   │  • two read-only outside fetchers of its own: /api/cf/[handle] (Codeforces), /api/vjudge (standings)
   │
   │  server-to-server, API_INTERNAL_URL, forwards cookie + Origin + Referer + Sec-Fetch-Site
   ▼
 apps/api  ── NestJS 11 on Fastify 5
   │  • AuthGuard on every route (sessions), CsrfGuard on every write
   │  • modules/auth: sign-in, invites, password change, Google
   │  • modules/member-area: the member area's state, actions and queries
   │  • modules/audit: one audit trail
   ▼
 PostgreSQL 16  ── one schema file (apps/api/src/db/schema.sql)

 packages/contracts  ── rules and shapes both apps share (roles, capabilities, XP, ranks, AppState, auth schemas)
 packages/content    ── the club's static content (placeholder people, events, sheet, shop…)
```

The browser never talks to the API directly. Everything goes through the web app's own `/api/*` routes, so
the site has one origin, the session cookie stays first-party, and the API can sit on a private network.

## How a member-area request flows

Take "mark problem 71A solved" on `/app/sheets`:

1. **Browser.** `useStore().act('toggle', { list: 'solved', id: '71A' })` (`components/app/Store.tsx`) sends
   `POST /api/act` with `{ type: 'toggle', list: 'solved', id: '71A' }`.
2. **Web proxy.** `app/api/act/route.ts` calls `proxy(req, '/v1/me/actions')`. `proxy()` forwards the raw
   body and only the headers the API needs (cookie, content type, Origin, Referer, Sec-Fetch-Site, user agent,
   and the client IP when `TRUST_PROXY=1`). It reshapes API errors to `{ error }` for the pages.
3. **API guards.** `CsrfGuard` (global) rejects a write that is not JSON, comes from another site, or has an
   origin outside `CORS_ORIGINS`. `AuthGuard` (global) hashes the session cookie, loads the session and the
   user's _current_ role and status from the database, and slides the session's expiry.
4. **Controller.** `MemberAreaController.act` (`modules/member-area/member-area.controller.ts`) passes the
   body to `act(userId, body)`.
5. **Handler.** `act` (`modules/member-area/actions.ts`) opens one transaction, locks the acting user's row
   (so two clicks never lose an update), looks up the `toggle` handler, and the handler checks the input and
   the permission (`need(...)`). Here it checks that `71A` is a real sheet problem. Then it writes the change.
6. **Fresh state.** The controller answers `{ state, info }`, where `state` is `loadState(userId)`
   (`modules/member-area/state.ts`): everything this member may see, built by a few SQL queries and filtered
   by role. The store replaces its copy, shows `+XP` and level-ups, and renders.

Reads that need paging or search (feed, ideas, members, alumni, jobs, prep, blog) use
`POST /api/{community,members,alumni}` with `{ action, ...args }` → `POST /v1/queries/:area` → the functions
in `modules/member-area/queries.ts`. Each of those checks its own permissions too.

Server components (the `/app` layout and the admin and ops gates) get the same state through
`serverState()` in `apps/web/lib/api.ts`. The page gates only _hide_ pages; the API enforces every action
again.

## Why one big state and one action endpoint

The member area was first built as a single Next.js app with the backend inside it. Its design, kept here:

- **One state payload per member** (`AppState` in `packages/contracts/src/state.ts`). Pages render from the
  store and never fetch on their own, apart from the paged queries above. After every change the server sends
  the whole fresh state, so every page is always consistent with the database, and there is no client cache to
  invalidate. Everything that grows with the club stays out of it: the roster is its own request
  (`GET /v1/me/roster`), lists in it are capped, and photos and banners are links. The roster and the club-wide
  half of the state are cached in the API process for 10 seconds and cleared by every action. With 5,000 members
  the state is about 225 KB for a member (see [Performance audit](performance-audit.md)).
- **One action endpoint** with a `type`. Every write goes through `act()`, which gives each one a transaction,
  a row lock on the actor, input validation and a permission check in one place. A new feature is one new
  handler.
- **Permissions in the handler, next to the write.** The capability matrix lives in `packages/contracts`, and
  every handler calls `need(can(...))` before touching data. The interface only hides what would be refused.

## The API's modules

| Module      | Path                  | Responsibility                                                                                                     |
| ----------- | --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Config      | `platform/config`     | Parses and validates the environment once (zod). Single source of every setting.                                   |
| Database    | `platform/database`   | The pg pool, `run()` transactions with retry on serialization/deadlock, statement and lock timeouts.               |
| HTTP        | `platform/http`       | `CsrfGuard`, the problem+json error filter (`DomainException`), the zod validation pipe.                           |
| Logging     | `platform/logging`    | pino through `nestjs-pino`, request IDs, redaction of cookies, passwords, tokens and phone numbers.                |
| Health      | `platform/health`     | `/health/live` and `/health/ready` (checks the database).                                                          |
| Auth        | `modules/auth`        | Sign-in, logout, invites, password change, Google; `AuthGuard`; login throttling; `@Public`, `@CurrentUser`.       |
| Audit       | `modules/audit`       | `AuditService.record()` writes the structured `audit_log` row and the readable `audit` line the admin panel shows. |
| Member area | `modules/member-area` | Controller, `act` handlers, queries, `loadState`, milestones and Codeforces sync, office placeholder data.         |

`apps/api/src/main.ts` wires Fastify: a JSON body parser that accepts empty bodies, cookies, a global rate
limit (per client IP), CORS for `CORS_ORIGINS`, the error filter, `CsrfGuard`, and the `/v1` prefix (every
route except `/health/*`).

The member-area code uses plain functions over a `pg` client rather than Nest services. `member-area/db.ts`
gives it the API's own pool (`usePool`), a `tx()` helper and `Fail`, an `HttpException` that the error filter
turns into a problem+json response.

## Shared packages

| Package            | Contains                                                                                                                                                                                                                                            | Used by   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `@fecpc/contracts` | roles and statuses, the capability matrix (`can`, `canFully`, `isAdmin`, `isCommittee`), XP and levels, Codeforces rank tiers, `AppState` and the other state types, notification wording, error codes and problem+json shape, auth request schemas | both apps |
| `@fecpc/content`   | `site` (public people, events, certificates, badges), `member-area` (sheet, shop, invoices, announcements, resources), `training` (wiki, templates, contest-day data, volunteer shifts)                                             | both apps |
| `@fecpc/config-*`  | shared ESLint, Prettier and TypeScript settings                                                                                                                                                                                                     | tooling   |

The packages ship TypeScript source. Turbopack compiles them for the web app, esbuild and tsx do it for the
API, and Node's type stripping loads them in the production API bundle (so they must stay free of enums and
other non-erasable syntax).

The office placeholder data stays in `apps/api/src/modules/member-area/office-data.ts`
so they never reach the browser.

## Outside services

| Service                       | Called from                                                                                                   | Purpose                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Codeforces API                | web `/api/cf/[handle]` (cached 10 min) and API `POST /v1/me/codeforces/sync` (max once per 10 min per member) | profile, rating history, solves; milestones                                                       |
| VJudge                        | web `/api/vjudge` (cached 30 s)                                                                               | contest standings for contest day; a 502 with a message when VJudge does not answer  |
| Codeforces contest list       | web `lib/cf.ts`                                                                                               | upcoming contests                                                                                 |
| Greenhouse / Lever job boards | API `fetchAlumniJobs` query                                                                                   | public job listings for alumni                                                                    |
| Google / GitHub OAuth         | API `POST /v1/auth/{google,github}`                                                                           | sign-in; the API redeems the code with the client secret                                          |
