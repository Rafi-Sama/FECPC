# Database

PostgreSQL 16. The whole schema is one file, `apps/api/src/db/schema.sql`.

## Schema file and migrations

- **Idempotent, append-only.** Every statement is `CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, a guarded
  `UPDATE`, or similar. The same file builds a new database from nothing and upgrades an existing one in place.
- **Applied in one transaction** by `applySchema()` (`apps/api/src/db/apply-schema.ts`). If any statement fails,
  nothing changes.
- **To change the schema, append** idempotent SQL at the end of the file (for example
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname text;`). Do not edit an earlier `CREATE TABLE`: on an
  existing database it never runs again, so the change would only reach new installs.
- **Run it** with `pnpm db:migrate`. `pnpm db:seed` runs it too.

The file has two parts, kept in order. The first is the original member-area schema. The second adds auth
(`credentials`, `invite_tokens`, `login_attempts`), the structured `audit_log`, the newer community tables,
and extra columns on existing tables.

## Tables

36 tables. "FK" lists the tables each one references.

### People and access

| Table            | Purpose                                                                                                                                                                                                                                      | FK    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `users`          | Every account: identity, role, status and `suspended`, title, `post`, profile, Codeforces stats, `vjudge_handle` and `vj_solved`, `progress` (personal JSON state), `mentor_id`, `system` (operator), invite hash, `google_sub`, `github_id` | —     |
| `credentials`    | Current password hash (kept in step with `users.pass_hash`)                                                                                                                                                                                  | users |
| `sessions`       | SHA-256 of each session token, expiry, created and last-seen times                                                                                                                                                                           | users |
| `invite_tokens`  | One-time set-password tokens (hashed); `users.invite_hash` holds the other form                                                                                                                                                              | users |
| `login_attempts` | Failed sign-in counters per (email, address) with a 15-minute window                                                                                                                                                                         | —     |
| `applications`   | Membership applications from `/join` and their decisions                                                                                                                                                                                     | users |
| `audit`          | Readable audit lines for the admin panel (who, what, when)                                                                                                                                                                                   | —     |
| `audit_log`      | Structured audit records (actor, action, entity, summary, IP hash); rows cannot be changed                                                                                                                                                   | users |

### Member activity

| Table                                  | Purpose                                                                    | FK                 |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------ |
| `reactions`                            | Kudos on posts, ideas and other items (`target` keys)                      | users              |
| `votes`                                | Poll votes and event-feedback ratings                                      | users              |
| `club_events`                          | Events, with registration method, approval and custom questions            | users              |
| `event_roles`                          | Volunteer and other roles an event recruits for                            | club_events        |
| `event_entries`                        | Platform registrations and role applications (status, answers, place)      | club_events, users |
| `event_feedback`                       | One rating per member per completed event                                  | club_events, users |
| `cert_templates`, `event_certificates` | Certificate HTML templates per kind; issued certificates by email          | club_events        |
| `attendance`                           | Event check-ins and volunteer-shift sign-ups (`vol:` keys)                 | users              |
| `messages`                             | Mentor check-ins, anonymous suggestions (no sender stored), event feedback | users              |
| `pings`                                | Invites, duel challenges, nudges and team-up requests between members      | users              |
| `club`                                 | Shared switches and values (`flag:` and `kv:` keys) changed by officers    | users              |
| `milestones`                           | Crossed Codeforces ranks, solved thresholds and streaks                    | users              |
| `post_roles`                           | Which existing roles each club post grants; edited by the Super Admin      | —                  |
| `milestone_kudos`                      | Kudos on milestones (20 per giver per day)                                 | milestones, users  |

### Money

| Table                         | Purpose                                                                                 | FK    |
| ----------------------------- | --------------------------------------------------------------------------------------- | ----- |
| `payments`                    | Submitted bKash/Nagad payments and their decisions; one live payment per transaction ID | users |
| `expenses`                    | Expense requests and decisions                                                          | users |
| `decisions`                   | Older officer decisions by kind and id (no longer written for waivers)                  | users |
| `waiver_requests`             | Old waiver requests; no longer written. A `waived` row still settles its invoice         | users |
| `committee_tasks`             | Ops board tasks: assignee, due date, column                                             | users |
| `meetings`, `meeting_actions` | Committee meetings with agenda, and their action items                                  | users |
| `inventory`                   | Club equipment and who holds it                                                         | users |
| `budgets`                     | Event budgets: plan, and spending from before the ledger (`spent_before`)               | —     |

Invoices, the fund's opening balance, accounts and cash flow are placeholder content
(`packages/content/src/member-area.ts`, `apps/api/src/modules/member-area/office-data.ts`). The fund balance and
ledger add the real movements on top: verified `payments` in, approved `expenses` out (`MONEY` in `state.ts`).
Mentor pairings are `users.mentor_id`; only the weekly mentee numbers are sample data.
The opening balance (`accounts` in `office-data.ts`) stays a seeded constant because nothing records the club's money
before this ledger; replace it with a real opening entry once one exists. The transparency tab's term totals are real.
`schema.sql` inserts the demo waivers, ops board, meetings, equipment and budgets once, and only after the demo
members exist (the seed applies the schema again after creating them). Some old dev databases also hold empty
prototype tables `waivers` and `ops_tasks`; nothing uses them.

### Community

| Table                | Purpose                                                                                         | FK                |
| -------------------- | ----------------------------------------------------------------------------------------------- | ----------------- |
| `announcements`      | Officer announcements (audience: everyone or a mentor's mentees), pinned, needs acknowledgement | users             |
| `announcement_reads` | Acknowledgements                                                                                | users             |
| `feed_posts`         | Feed posts with category and score                                                              | users             |
| `feed_votes`         | Up and down votes on posts                                                                      | feed_posts, users |
| `feed_reports`       | Reports on posts                                                                                | feed_posts, users |
| `community_comments` | Unused (comments were removed from posts and ideas); kept so existing rows are not dropped      | users             |
| `ideas`              | Ideas, teammate searches, study groups                                                          | users             |
| `idea_interests`     | Requests to join an idea, and the poster's decision                                             | ideas, users      |
| `idea_views`         | Who viewed an idea                                                                              | ideas, users      |

### ICPC teams

Prefixed `icpc_` because some older databases carry an unrelated, unused `teams` table.

| Table          | Purpose                                                                                                                                                 | FK                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `icpc_teams`   | Team name (unique) and coach                                                                                                                            | users             |
| `icpc_members` | Who is on which team; one team per member, at most three                                                                                                | icpc_teams, users |
| `notebook`     | One notebook page per member per topic; stays with the member, team or not                                                                              | users             |
| `notebook_log` | Each member's notebook history (added, renamed, removed, edited with +/− lines); `by` names a teammate who edited the page                              | users             |
| `cf_solves`    | Each member's accepted Codeforces problems, with difficulty `rating` and `tags`; written by the Codeforces sync, read by sheet XP and the team overview | users             |
| `icpc_notes`   | Legacy; emptied into `notebook` on migrate                                                                                                              | icpc_teams, users |
| `icpc_log`     | The team's own events (joined, left, renamed, coach)                                                                                                    | icpc_teams, users |

### Alumni and careers

| Table                     | Purpose                                                  | FK                        |
| ------------------------- | -------------------------------------------------------- | ------------------------- |
| `alumni_saves`            | Bookmarked alumni profiles                               | users                     |
| `alumni_jobs`             | Jobs posted by alumni, or fetched from public job boards | users                     |
| `interview_topics`        | Interview-prep topics                                    | users                     |
| `interview_problems`      | Problems in a topic                                      | interview_topics, users   |
| `interview_user_progress` | Which prep problems a member solved                      | interview_problems, users |
| `interview_tips`          | Tips and interview experiences                           | interview_topics, users   |
| `blog_posts`              | Alumni blog posts (draft or published)                   | users                     |

## Where state lives

- **Personal progress** is in `users.progress` (JSON): Codeforces handle, base XP numbers, solved sheet
  problems, done resources, lessons, read items, quiz scores, shop purchases, XP spent, last check-in,
  preference flags and values. Only `act()` writes it, under a row lock.
- **Everything shared between members** has its own table, so counts (registrations, kudos, votes, solves per
  problem) are computed with SQL across members.
- **Static content** (sheet problems, courses, shop items, invoices, polls) is not in the database. It
  lives in `packages/content`, and handlers check ids against it.

## Seeding

`pnpm db:seed` (`apps/api/src/db/seed.ts` → `seed-data.ts`) applies the schema and, **only if `users` is
empty**, creates the placeholder club: 27 accounts (passwords = `SEED_PASSWORD`), feed posts and a comment,
an idea with an interest request, sample payments, expenses and applications, alumni jobs and bookmarks,
interview prep, blog posts, and milestones backfilled from the seeded ratings. Running it again never changes existing
data.

To start over locally:

```sh
psql postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc -c 'drop schema public cascade; create schema public'
pnpm db:setup
```

## Test database

The API tests use `fecpc_test` (the same server, database name swapped) and rebuild it from scratch on every
run (`drop schema public cascade`). They refuse to run against any database whose name does not end in
`fecpc_test`.
