# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@apps/web/AGENTS.md

Full documentation is in `docs/` (start at `docs/README.md`). Read the relevant page before changing an area,
and update it when behaviour changes.

## Commands

From the repository root:

```sh
pnpm dev                  # web :3000 + api :3001 (Turborepo)
pnpm db:setup             # apply apps/api/src/db/schema.sql, then seed an empty DB (accounts get SEED_PASSWORD)
pnpm verify               # format:check, lint, typecheck, test, build — must pass before pushing
pnpm check                # the same, auto-fixing format and lint
pnpm --filter @fecpc/api test        # needs the fecpc_test database
pnpm --filter @fecpc/contracts test  # no database
```

One API test file: `cd apps/api && node --import tsx --test test/password.test.ts` (add
`--test-name-pattern="..."` for one test). API tests rebuild the `fecpc_test` database on every run.

## Architecture in brief

- **Browser → web → API → PostgreSQL.** Every `apps/web/app/api/**/route.ts` is a one-line `proxy(req, path)`
  (`apps/web/lib/api.ts`) that forwards the raw body plus cookie, Origin, Referer and Sec-Fetch-Site. The API's
  `CsrfGuard` depends on those headers, so never parse or rebuild requests in Next. Server components use
  `serverState()`.
- **The member area is one state payload plus one action endpoint.** `components/app/Store.tsx` loads `AppState`
  (`GET /v1/me/state`) and sends every change as `act(type, args)` → `POST /v1/me/actions`. Paged reads go to
  `POST /v1/queries/{community,members,alumni}` with `{ action }`. All of it lives in
  `apps/api/src/modules/member-area/`: `actions.ts` (handlers; one transaction and a row lock on the actor per
  action), `queries.ts`, `state.ts` (`loadState`), `milestones.ts` (incl. server-side Codeforces sync).
- **Permissions are checked inside each handler** with `need(can(...))` / `canFully` from `@fecpc/contracts`,
  next to the write. Page gates and hidden buttons are only cosmetic. New member actions are new handlers;
  never add authorization-free routes.
- **Auth is `apps/api/src/modules/auth`.** Global `AuthGuard` (`@Public()` opts out) reloads role and status
  every request. Sessions are SHA-256-hashed opaque tokens in an httpOnly cookie (`fecpc_session` locally,
  `__Host-fecpc_session` otherwise). Passwords are written to both `credentials` and `users.pass_hash`
  (`AuthService.setPassword`). Suspension sets both `users.suspended` and `users.status`.
- **Shared code:** `packages/contracts` (roles, capability matrix, XP, ranks, `AppState` types, auth schemas) and
  `packages/content` (static club content, subpaths `site`, `member-area`, `training`). Never import
  `apps/web` from the API. Server-only data (quiz answer keys) stays in `member-area/office-data.ts`.
- **Schema:** `apps/api/src/db/schema.sql` is the only schema. It is idempotent; append new SQL at the end,
  never edit an earlier `CREATE TABLE`.
- **Values from the client are never trusted for stats or identity.** Codeforces numbers come from
  `syncCodeforces`; Google identity from the API's own code exchange.

## UI conventions

- No pixel or display fonts below 14px.
- Keep copy minimal, with no filler paragraphs.
- Keep the app frame (`Shell`) constant across member pages.
