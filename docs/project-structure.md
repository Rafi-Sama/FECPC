# Project structure

A pnpm workspace orchestrated by Turborepo: two apps, two shared packages, three config packages.

```
.
├── apps/
│   ├── api/                        NestJS + Fastify API (port 3001)
│   │   ├── scripts/                build.ts, dev.ts, esbuild.config.ts (esbuild + SWC for decorator metadata)
│   │   ├── src/
│   │   │   ├── main.ts             Fastify setup: body parser, cookies, rate limit, CORS, errors, CSRF, /v1 prefix
│   │   │   ├── app.module.ts       the modules that are mounted
│   │   │   ├── db/                 schema.sql, apply-schema.ts, migrate.ts, seed.ts, seed-data.ts
│   │   │   ├── platform/           cross-cutting: config, database, http (CSRF, errors, validation), logging, health
│   │   │   └── modules/
│   │   │       ├── auth/           sign-in, sessions, AuthGuard, throttling, @Public/@CurrentUser, passwords
│   │   │       ├── audit/          AuditService (one audit trail)
│   │   │       └── member-area/    controller, actions (act), queries, state (loadState), milestones, office data
│   │   └── test/                   node:test suites (real PostgreSQL: fecpc_test)
│   └── web/                        Next.js 16 site + member area (port 3000)
│       ├── app/
│       │   ├── (site)/             public pages (route group: no URL segment), site.css
│       │   ├── app/                member area under /app, app.css, layout loads AppState
│       │   │   ├── admin/, ops/    layouts gate these by role (hide only; the API enforces)
│       │   │   └── …               one folder per page
│       │   ├── api/                route handlers: one-line proxies to the API, plus /api/cf and /api/vjudge
│       │   ├── layout.tsx, globals.css, manifest.ts, icon.svg
│       ├── components/
│       │   ├── site/               public-site components (Nav, Footer, ApplyForm, LoginForm, Board, …)
│       │   ├── app/                member-area components
│       │   │   ├── Shell.tsx       the member-area frame: nav, page header (Page), Tabs, Denied
│       │   │   ├── Store.tsx       the client store: AppState, act(), giveKudos(), tab-focus refresh
│       │   │   ├── <feature>/      admin, alumni, announcements, arena, community, events, feed, finance,
│       │   │   │                   home, ideas, members, sheets — components used by that page
│       │   │   └── shared/         used by several features (MarkdownEditor, RatingBadge, SolvedTier)
│       │   └── pixel/              the pixel-art sprites and canvas effects
│       ├── lib/                    web-only helpers: api.ts (proxy, serverState), cf.ts, event-details.ts,
│       │                           lcg.ts (seeded PRNG for art), site.ts (site constants)
│       ├── public/                 static files (gallery photos are read from public/gallery)
│       └── scripts/dev-ready.ts    creates .env.local from .env.example before `next dev`
├── packages/
│   ├── contracts/                  @fecpc/contracts: shared rules and types (tests in test/)
│   ├── content/                    @fecpc/content: static club content, subpaths site | member-area | training
│   ├── config-eslint/              flat ESLint config (typescript-eslint)
│   ├── config-prettier/            Prettier settings
│   └── config-typescript/          tsconfig bases (base, next, node)
├── infra/postgres/init.sql         creates fecpc_test when the Docker volume is first made
├── scripts/check.mjs               `pnpm check`: fix, lint, typecheck, test, build with a summary
├── docs/                           this documentation
├── docker-compose.yml              PostgreSQL 16 for development
├── turbo.json                      task graph (build, typecheck, test, lint, format:check, dev)
└── CLAUDE.md                       guidance for AI coding agents
```

## Where new code goes

| You are adding…                                       | Put it in                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Something a signed-in member does                     | a handler in `apps/api/src/modules/member-area/actions.ts` (see [Member-area actions](member-area-actions.md))                 |
| A paged or searched read for a page                   | a function in `actions.ts` and a branch in `queries.ts`                                                                        |
| Data every member page needs                          | `loadState` in `member-area/state.ts`, and its type in `packages/contracts/src/state.ts`                                       |
| A rule both apps must agree on (permission, XP, rank) | `packages/contracts`                                                                                                           |
| Static club content                                   | `packages/content` (it ships to the browser: no secrets, no answer keys)                                                       |
| Server-only reference data                            | `apps/api/src/modules/member-area/office-data.ts`                                                                              |
| A table or column                                     | append idempotent SQL to `apps/api/src/db/schema.sql`                                                                          |
| A new page                                            | `apps/web/app/app/<name>/page.tsx` (member) or `apps/web/app/(site)/<name>/page.tsx` (public), plus a nav entry in `Shell.tsx` |
| A component for one page                              | `apps/web/components/app/<feature>/`                                                                                           |
| A component several pages use                         | `apps/web/components/app/shared/`                                                                                              |
| A browser-facing endpoint                             | a one-line `proxy()` route in `apps/web/app/api/`, and the real endpoint in the API                                            |
| A cross-cutting API concern                           | `apps/api/src/platform/`                                                                                                       |

## Naming

- React components: `PascalCase.tsx`, one main component per file. Feature folders are lowercase.
- Everything else: `kebab-case.ts`. Nest files: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`.
- Imports: explicit `.ts` extensions in the API and packages (Node type stripping); `@/` means `apps/web/`.
