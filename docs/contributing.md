# Contributing

## Workflow

1. Branch from `main`.
2. Make the change in the right place (see [Project structure](project-structure.md#where-new-code-goes)).
3. Add or update a test for anything with logic: a branch, a permission, money, a parser.
4. Run `pnpm verify` (or `pnpm check`, which also fixes formatting and lint). It must pass.
5. Update these docs if you changed behaviour, an endpoint, a permission, a table or an env variable.

## Code conventions

- **TypeScript everywhere**, strict. API and packages import with explicit `.ts` extensions. Shared packages
  must stay runnable by Node's type stripping: no `enum`, no `namespace`, no parameter properties.
- **Formatting** is Prettier (single quotes, trailing commas, width 100). **Lint** is typescript-eslint. Unused
  variables are warnings; prefix with `_` only when an argument is required by a signature.
- **Validate at the boundary.** Every action handler validates its own input with the helpers in
  `actions.ts`; auth requests use strict zod schemas. Never trust a type from the request body.
- **Check permission next to the write**, with the shared matrix (`can`, `canFully`), and audit officer
  decisions.
- **SQL is parameterized.** No string-built values in queries.
- **Schema changes are appended** to `schema.sql` and idempotent. Never edit an old `CREATE TABLE`.
- **Comments say why**, not what. A known limitation gets a comment in the form
  `shortcut: <the limit>, <when to upgrade>`.
- **No new dependency** for something a few lines can do. Prefer the platform: `fetch`, `node:crypto`,
  `node:test`.

## Adding things, step by step

| Change | Steps |
| --- | --- |
| A member action | [Member-area actions → Adding an action](member-area-actions.md#adding-an-action) |
| A permission | [Roles and permissions → Changing permissions](roles-and-permissions.md#changing-permissions) |
| A table or column | append to `apps/api/src/db/schema.sql`, run `pnpm db:migrate`, extend `loadState` / `AppState` if pages need it |
| An environment variable | add it to `EnvSchema` in `apps/api/src/platform/config/config.service.ts` (with a default if it is optional) and to `apps/api/.env.example`; for the web app, `apps/web/.env.example` |
| A page | `apps/web/app/app/<name>/page.tsx`, a nav entry and icon in `components/app/Shell.tsx`, components in `components/app/<name>/` |
| A browser-facing endpoint | an API route (with its own checks), then a one-line `proxy()` route in `apps/web/app/api/` |

## Commit messages

Short imperative subject (`fix: refuse self-verification of payments`, `feat: officer waivers tab`), and a
body that says why when it isn't obvious.
