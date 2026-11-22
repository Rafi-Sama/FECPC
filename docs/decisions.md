# Decisions and history

Why the code is shaped the way it is. Read this before undoing one of these choices.

## History

1. **Single Next.js app.** The project started as one Next.js app with the backend in `server/` (actions,
   state, sign-in) and a hand-written SQL schema. The member area's design (one state payload, one action
   endpoint, permissions in each handler) comes from this version, and its database tests were written then.
2. **Monorepo and NestJS port.** The code was split into `apps/web` and `apps/api` (NestJS). A second backend
   was started next to the first: about twenty Nest modules (finance, events, community, ops and others) with
   a new data model, a drizzle schema and an outbox worker. Only a few actions were connected to it. The rest
   of the frontend was left calling endpoints that did nothing, and the new modules wrote tables the member
   area never read.
3. **Hardening and consolidation (this layout).** The original backend moved into the API as
   `modules/member-area`, behind the API's own authentication. The unfinished second backend was removed. A
   snapshot of the tree before the removal is on the local branch `backup/pre-cleanup`.

## Decisions

### One backend implementation: the member-area handlers

**Chosen:** the original action handlers (`actions.ts`), state builder (`state.ts`) and queries, inside the
API.
**Instead of:** finishing the Nest domain modules.
**Because:** the handlers already did everything the interface needs, had database tests for every money flow
and permission rule, and wrote exactly the tables `loadState` reads. The Nest port covered a fraction of the
actions and used a different data model. Two backends meant two sets of permission rules that had already
diverged (some Nest routes had none).
**Consequence:** member-area code is plain functions over `pg`, not Nest services. Nest provides the HTTP
layer, configuration, logging, authentication and the error format.

### Authentication only in Nest

Sign-in, sessions, invites, password changes and Google live only in `modules/auth`. The original app's own
sign-in code was removed when its handlers moved into the API, so there is exactly one session mechanism, one
cookie and one throttle.

### Permissions in the handler, not on the route

Every handler calls `need(...)` next to the write it protects, using the shared matrix. Route-level capability
decorators were removed. They had become a second, partial set of rules, and the member area has only one
write route.

### Shared rules and content are packages, not imports from the web app

The API used to import `apps/web/lib/*`, so the rules guarding the API lived inside the frontend. Roles,
capabilities, XP, ranks and the `AppState` shape are now in `@fecpc/contracts`. Static club content is in
`@fecpc/content`. Duplicate copies (in the web app and in contracts) were merged into one.

### The browser only talks to the web app

The web app proxies `/api/*` to the API instead of the browser calling the API. This gives one origin and a
first-party httpOnly cookie, so the API can stay private. The proxy forwards the browser's Origin, Referer and
Sec-Fetch-Site, so the API's CSRF check still sees the real page.

### Google sign-in redeems the code on the server

An earlier version let the browser-facing callback send `{ email, email_verified }` to a public API endpoint,
which then trusted it. Anyone could sign in as anyone. Now only the authorization code crosses that boundary,
and the API asks Google itself.

### Codeforces stats come only from Codeforces

The profile editor used to send the rating and solve count it had fetched, and the API stored them. Now the API
fetches them for the member's own stored handle (`syncCodeforces`). Members cannot set those numbers.

### One schema file, idempotent

The two schema files (the original and the "upgrade") were merged into `schema.sql` and pruned to the 36
tables the code uses. The result was compared against the previous files: every column, default, index and
constraint of those tables is identical. Tables of the removed modules were dropped from the file; on an
existing database they stay until someone drops them by hand.

### Duplicate routes became redirects

`/app/members` and `/app/alumni` rendered the same pages as `/app/directory` and `/app/career`, which are the
URLs the navigation uses. The old URLs now redirect.

### Officer finance restored

A redesign of the Finance page had dropped the officer views, so payment verification, expense decisions,
waivers and the club fund had no interface even though the API supported them. They are back as extra tabs
(`components/app/finance/officer.tsx`), shown by capability.

### Rank titles follow the rating

Codeforces titles (Newbie … Legendary GM) used to be computed from the solved count and shown beside the rating, so a
1934-rated member read "1934 · Expert". `rankFor(rating)` in `@fecpc/contracts` now uses Codeforces' own rating bands,
and the directory's rank filter filters by rating. `SolvedTier` still colours names by solved count; it shows no title.

### No invented data when a judge is down

Codeforces and VJudge outages used to be covered with made-up contests and "simulated" standings that looked live.
Now the contest list is empty and contest day says VJudge did not answer.

### One "are you sure?" dialog

Native `confirm()`/`alert()` were replaced by the in-app `useConfirm()` dialog and store toasts, which match the theme and
keep the page responsive.

## Known gaps

| Gap                                                                                                                                                                                                                                 | Where to start                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Password reset by email: `/v1/auth/password/forgot` sends nothing. Officers issue reset links instead (`invite` action).                                                                                                            | add a mailer; store reset tokens like invite tokens         |
| No two-factor authentication.                                                                                                                                                                                                       | `modules/auth`                                              |
| Invoices, the fund's opening balance and accounts, mentee weekly stats and some public-site figures are placeholder content, not tables. Fund balance, ledger, term totals, monthly cash flow, budgets and the ops board are real. | `packages/content`, `member-area/office-data.ts`            |
| The public site (members, certificates, hall of fame) is static content; events come from the database. `/verify` checks certificates against that list.                                                                            | `packages/content/src/site.ts`                              |
| The rate limit and the Codeforces sync throttle are in memory: per process, reset on restart.                                                                                                                                       | move to the database before running several API instances   |
| The ESLint config has no React Hooks rules.                                                                                                                                                                                         | add `eslint-plugin-react-hooks` to `packages/config-eslint` |
| `users` still has columns only the removed modules used (for example `avatar`, `legacy_id`), and existing databases still have those modules' tables.                                                                               | drop them with a deliberate, reviewed migration             |
| Codeforces stats refresh only when a member opens a page with their Codeforces data (at most every 10 minutes); there is no background job.                                                                                         | a scheduled call to `syncCodeforces` per member             |

### Waivers removed

Members can no longer ask to waive an invoice, and officers no longer decide waivers (`requestWaiver`,
`decide` kind `waiver` and the `dues.waive` capability are gone). Waivers already granted still settle their
invoice, so nobody is billed again for a due the club forgave.
