# Backend audit

Review of `apps/api` on 24 November 2026 for security, trust in client input, correctness, structure, dead
code and performance. It records what was checked, what was wrong, what was fixed, and the decisions still open.
Speed under load is in [Performance audit](performance-audit.md).

## Method

- Every module read: platform (config, database, HTTP filter and CSRF guard, logging, health), auth (guard,
  sessions, passwords, Google and GitHub, throttling), audit, and the member area (`actions.ts`, `state.ts`,
  `queries.ts`, events, recruitment, teams, sheets, learning, mail, milestones).
- Sweeps across all handlers: a permission or ownership check in every write; every `${…}` inside SQL (each is
  a constant, a column chosen in code or a bounded number; none carries input); a timeout on every external
  call; every action and query name matched against the web app's calls to find dead ones.
- Live probes against a production build: malformed JSON, an oversized body, the rate limiter, health routes,
  a hostile `X-Request-Id`.
- `pnpm verify` (format, lint, typecheck, 100 API tests, 27 contracts tests, build), plus
  `test/backend-audit.test.ts` for the fixes below.

## What holds up

Sessions are random 32-byte tokens stored only as SHA-256, in an `httpOnly`, `SameSite=Lax` cookie (`__Host-`
and `Secure` outside local), with idle and absolute expiry and a per-user cap; role and suspension are re-read on
every request. Passwords are scrypt with timing-safe comparison and equal work for unknown accounts. CSRF needs
JSON plus an allowed origin. Google and GitHub identities come from the API's own code exchange, and only an
existing member account can sign in with them. Every write checks its permission next to the write, inside one
transaction with the actor's row locked. Money follows two-person rules (nobody verifies their own payment or
decides their own expense; large expenses need two officers). Event seats and volunteer shifts are taken under a
lock. Codeforces numbers come only from the server's own sync. Every SQL value is a parameter. Every external
call has a timeout. The mail queue sends each message once (`for update skip locked`).

## Findings and fixes

Severity: **high** — exploitable, data-corrupting or user-visible; **medium** — wrong in some cases or a real
cost; **low** — clean-up.

### Security and trust

| #   | Severity | Finding                                                                                                                                                                                                                                                                  | Fix                                                                                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1   | high     | The web server's own API calls (`serverState`, `serverQuery`) carried no client address, so every server-rendered member page counted against the web server's address in the API's global limit (300 a minute). Past it, state failed and members were sent to sign-in. | They forward the visitor's address like the browser proxy does (`lib/api.ts`, `asVisitor`).                  |
| 2   | high     | Two members could link the same Codeforces handle and both receive its stats and XP.                                                                                                                                                                                     | `handleFree`: a handle in use by another member is refused (409), from the member or from an officer's edit. |
| 3   | medium   | **Change password** had no attempt limit: a stolen session could guess the current password.                                                                                                                                                                             | Wrong current passwords count like failed sign-ins (`LoginThrottlingService`).                               |
| 4   | medium   | `X-Request-Id` was taken from the client unchecked, logged, and echoed in every error body.                                                                                                                                                                              | Kept only if it looks like an id (`[\w.-]{1,64}`), else a UUID; one generator for Fastify and the logger.    |
| 5   | low      | Sign-in answered with the member's photo as a data URL of up to 450 KB.                                                                                                                                                                                                  | The versioned photo link, as everywhere else.                                                                |

### Correctness

| #   | Severity | Finding                                                                                                                                                                                                                  | Fix                                                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 6   | high     | Rate-limited requests answered **500**, malformed JSON **500**, an oversized body 413 labelled "Internal Server Error": the error filter only knew Nest's exceptions, not Fastify's.                                     | Errors carrying a 4xx/5xx `statusCode` keep it, with the matching code (`RATE_LIMITED`, `BAD_REQUEST`).                       |
| 7   | high     | Members who joined through **GitHub only** were "not joined": reinstating one set them to `invited`, which then blocked their GitHub sign-in; the roster and dues counted them as invited.                               | One definition, `JOINED` (password, Google or GitHub), used by the roster, the admin dashboard, dues, `suspend` and `invite`. |
| 8   | high     | The Codeforces sync preferred a stale copy of the handle in the member's progress JSON over the account column, so an officer's correction was ignored.                                                                  | The account column is the only copy; the progress field is gone.                                                              |
| 9   | high     | The blog editor sends `published: true`, but creating a post only read `status`: every new post was saved as a draft.                                                                                                    | `blogStatus()` reads either, for create and update.                                                                           |
| 10  | medium   | A member's kudos count meant different things on different screens: Profile added milestone kudos, the member card and the Arena award did not, and kudos on ideas counted nowhere.                                      | One server-side total per member: profile, idea and milestone kudos (`counts.kudos`), shown everywhere.                       |
| 11  | medium   | The same writes had two implementations with different rules: e.g. availability changes through the query path were not audited, the job and blog query paths refused the operator account but the action paths did not. | See finding 13.                                                                                                               |
| 12  | low      | Payment and expense decisions never set `decided_at`.                                                                                                                                                                    | Set on every decision.                                                                                                        |

### Structure and dead code

| #   | Severity | Finding                                                                                                                                                                                                     | Fix                                                                                                                                                                             |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | high     | `/v1/queries/*`, documented as reads, carried 16 writes implemented a second time outside `act()`: no actor row lock, no audit section, no cache refresh, and an overloaded `(db?, user, input)` signature. | Each write exists once, as an action handler; `queries.ts` hands it to `act()` and answers with its data. 14 duplicate functions and `parseActorAndInput` deleted (−740 lines). |
| 14  | medium   | Six modules each defined their own `need`, `audit`, `Actor`, `In`, `posInt`, `pick` and the roles SQL.                                                                                                      | One `member-area/rules.ts`; refusal messages that were module defaults are now passed explicitly.                                                                               |
| 15  | medium   | Recent milestones were built twice: in the state query and in `listRecentMilestones`.                                                                                                                       | The state uses `listRecentMilestones` (moved to `milestones.ts`).                                                                                                               |
| 16  | low      | Dead: `revokeAllUserSessions`, `createInterviewTopic` (replaced by the roadmap editor), `listInterviewExperiences`, and the unused query actions `getKudosTodayCount`, `listRecentMilestones`.              | Removed (the functions still used internally stay).                                                                                                                             |
| 17  | low      | `DB_LOCK_TIMEOUT_MS` applied only to the auth transactions, and `DB_IDLE_TX_TIMEOUT_MS` was used as the pool's idle-connection timeout, not the idle-transaction timeout its name says.                     | Both are connection settings now (`lock_timeout`, `idle_in_transaction_session_timeout`), so every transaction gets them.                                                       |
| 18  | low      | Legacy route wildcards (`health/(.*)`, the logger's `*`) logged deprecation warnings at every start.                                                                                                        | Current syntax.                                                                                                                                                                 |

### Performance

| #   | Severity | Finding                                                                                                                                                                                                                                   | Fix                                                                                                                |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 19  | medium   | Marking an announcement read rebuilt the member's whole state inside the transaction, just to check the id was in their inbox.                                                                                                            | Announcements are checked directly against the 50 the inbox lists; other inbox ids as before.                      |
| 20  | —        | State, roster, lists, caching and indexes                                                                                                                                                                                                 | See [Performance audit](performance-audit.md).                                                                     |
| 21  | medium   | Posting an Arena challenge or saving a sheet fetched the Codeforces problem set inside the transaction on a cold cache (up to 15 s), holding a connection and the member's row; when Codeforces was down, every such action waited again. | `act()` fetches it before the transaction opens; a failure is remembered for a minute (`sheets.ts`, `problemset`). |

## Decisions taken (25 November 2026)

| #   | Question                         | Decision and change                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Codeforces and VJudge handles    | The member links each handle once (`handle`, `vjudge`). After that a change is a `profileRequest` the Secretary or President approves; nobody can remove a handle, officers included. The handle boxes lost their unlink buttons; the request form shows linked handles.                                      |
| 2   | One President or two             | One. `role` neither makes nor removes a President; `appointPresident` swaps, and the old President becomes a member. The Admin role picker no longer offers President.                                                                                                                                        |
| 3   | `suspend` and `deactivateMember` | Merged: `deactivateMember` is gone; `suspend` (with `on`) is gated by `member.deactivate`, which the same people hold. The member menu's _Deactivate_ is now _Suspend_.                                                                                                                                       |
| 4   | Features with no screen          | `redeem` and the XP shop (`shop`, `spent`) removed; `teamCoach` and team coaches removed (the `coach` column stays, unused, since the schema is append-only). `send` is still open, below.                                                                                                                    |
| 5   | Kudos                            | One lifetime total per member, never reset: profile, idea and milestone kudos all count, and every kudos received is XP (`XP.kudosReceived`). Kudos cannot be taken back, and the 20-a-day cap is gone (each giver can cheer each item once, so it stays bounded).                                            |
| 6   | Single instance                  | The Codeforces/VJudge sync throttle is in the database (`users.judge_synced_at`). The rate limit stays per process (with N instances a client gets N × the limit, still a limit), and the shared caches already expire after 10 s. One instance is the supported setup; add Redis only if the API scales out. |
| 7   | Google and GitHub                | As intended: they sign in existing members only. The first sign-in stores the provider account on the member (`google_sub`, `github_id`) and writes an audit line.                                                                                                                                            |

## Still open

1. **`send`.** Members' anonymous suggestions (`kind: 'suggest'`, no sender stored anywhere) and named feedback
   (`kind: 'feedback'`). Admin lists them, but no screen lets a member send one. Build a small form or remove it.
2. **Proof of handle ownership.** The first link of a Codeforces handle is not verified. See
   [known gaps](decisions.md#known-gaps).
