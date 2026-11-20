# Testing

All tests use Node's built-in runner (`node:test`) with `node:assert/strict`. There are no mocks of the
database: the API tests run against a real PostgreSQL database.

## Suites

| Package | Files | Needs | Covers |
| --- | --- | --- | --- |
| `@fecpc/contracts` | `packages/contracts/test/*.test.ts` | nothing | permission matrix risky cells, admin/committee gates, XP and levels, Codeforces rank tiers and colours, auth schemas (strict, normalised) |
| `@fecpc/api` | `apps/api/test/password.test.ts` | nothing | scrypt format, legacy formats and rehash, empty or truncated hashes never verify |
| `@fecpc/api` | `apps/api/test/member-area.test.ts` | `fecpc_test` | sign-in, sessions, password change, Google sign-in (with Google mocked), throttling; role-based visibility of state; every money flow and two-person rule; applications and invites; roles, suspension and rank rules; shop double-spend; announcements; export; mentors; messages; inbox; profile; equipment; feed, ideas, milestones, kudos cap; Codeforces sync |
| `@fecpc/api` | `apps/api/test/member-area-alumni.test.ts` | `fecpc_test` | alumni directory, saves, mentoring availability, jobs, interview prep, blog permissions, URL validation |

`member-area.test.ts` builds the database once (`drop schema public cascade`, then `setup()` from the seed), so
its tests share one seeded club and run in file order. A test that changes an account (suspends it, changes its
password) affects the tests after it. Pick an account no earlier test touched, or restore what you change.

## Running

```sh
pnpm test                                    # every package (Turborepo)
pnpm --filter @fecpc/api test                # API only
pnpm --filter @fecpc/contracts test          # shared rules only

cd apps/api
node --import tsx --test test/password.test.ts                         # one file
node --import tsx --test --test-name-pattern="suspension" test/member-area.test.ts   # matching tests
node --import tsx --test --test-reporter=spec test/member-area.test.ts # readable failure output
```

The API tests load Nest classes, which use decorators and parameter properties that Node's type stripping
cannot run, so they go through `tsx`. The contracts tests run on plain Node.

The test database is `DATABASE_URL` with its database name replaced by `fecpc_test`. The tests stop if the
name is anything else, so they can never wipe the development database. Docker creates `fecpc_test` on first
start (`infra/postgres/init.sql`). For an older volume, create it once:
`createdb -h 127.0.0.1 -p 5433 -U fecpc fecpc_test`.

## Writing a test

- **For a member-area action**, call `act(userId, { type, ... })` directly and assert on the database or on
  `loadState`. Use the `refused(status, promise)` helper for refusals, and test both the allowed and the refused
  case. Permission bugs hide in the refused case.
- **For anything that calls an outside service**, replace `globalThis.fetch` for the duration of the test and
  restore it in `finally`. See the Google sign-in and Codeforces sync tests.
- **For pure rules** (XP, permissions, ranks), put the test in `packages/contracts/test`.
- Keep tests independent of wall-clock time where you can. Where a window matters, move the stored timestamps
  instead of sleeping, as the throttling test does.

## Before pushing

`pnpm verify` runs format check, lint, typecheck, tests and both production builds across the workspace.
`pnpm check` does the same with auto-fixing of format and lint, and prints a summary.
