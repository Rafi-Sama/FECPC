# API reference

The browser calls the **web routes** (same origin). Each one forwards to an **API route** on
`API_INTERNAL_URL`. Every API route is under `/v1` except the health probes.

## Conventions

- **Auth.** Every route requires a session cookie unless marked _public_. The cookie is `fecpc_session` when
  `APP_ENV=local`, otherwise `__Host-fecpc_session` (HTTPS only). Missing or expired: `401`. Suspended: `403`.
- **Writes** (`POST`) must send `Content-Type: application/json`, and their Origin/Referer must be in
  `CORS_ORIGINS` (see [Security](security.md#csrf)). The web proxy forwards the browser's headers, so this
  holds for real page requests.
- **Body limit** 1 MB. An empty JSON body is read as `{}`.
- **Rate limit** `RATE_LIMIT_GLOBAL_PER_MIN` requests per minute per client address (default 300): `429`.
- **Errors** are `application/problem+json`:

  ```json
  {
    "type": "https://fecpc.org/errors/forbidden_capability",
    "title": "…",
    "status": 403,
    "code": "FORBIDDEN_CAPABILITY",
    "detail": "Only the Treasurer verifies payments.",
    "requestId": "…"
  }
  ```

  `detail` is safe to show to the user. The web proxy copies it to `error`, which is what the pages read.
  Validation failures add `errors: { field: [messages] }`. Codes are in `packages/contracts/src/errors.ts`.

## Route map

| Web route (browser)                      | API route                               | Auth                            | Purpose                                                                                        |
| ---------------------------------------- | --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                   | `POST /v1/auth/login`                   | public                          | Sign in with email and password                                                                |
| `POST /api/auth/logout`                  | `POST /v1/auth/logout`                  | session                         | End this session                                                                               |
| —                                        | `GET /v1/auth/session`                  | session                         | 200 for a live session; web routes that call judges check it                                   |
| —                                        | `GET /v1/cron`                          | `Bearer CRON_SECRET`            | Weekly sheet and mail queue; Vercel Cron calls it daily                                        |
| `POST /api/auth/invite`                  | `POST /v1/auth/invite/accept`           | public                          | Set a password from an invite or reset link, and sign in                                       |
| —                                        | `GET /v1/auth/invite/:token`            | public                          | Name and masked email for an invite link                                                       |
| `POST /api/auth/password`                | `POST /v1/auth/password/change`         | session                         | Change password; signs out every other session                                                 |
| —                                        | `POST /v1/auth/password/forgot`         | public                          | Always `202`; placeholder, sends nothing (see [Decisions](decisions.md#known-gaps))            |
| `GET /api/auth/{google,github}`          | —                                       | public                          | Redirects to Google or GitHub with a `state` cookie                                            |
| `GET /api/auth/{google,github}/callback` | `POST /v1/auth/{google,github}`         | public                          | Exchanges the provider's code for a session                                                    |
| `GET /api/state`                         | `GET /v1/me/state`                      | session                         | The member's full `AppState`                                                                   |
| `POST /api/act`                          | `POST /v1/me/actions`                   | session                         | One change; answers with fresh state                                                           |
| `GET /api/roster`                        | `GET /v1/me/roster`                     | session                         | `{ members }`: the roster this member may see; `ETag`, revalidate with `If-None-Match` (`304`) |
| `GET /api/avatars/:id?v=`                | `GET /v1/avatars/:id`                   | session                         | A member's uploaded photo; the versioned link is cached for good                               |
| `GET /api/events/:id/banner?v=`          | `GET /v1/events/:id/banner?v=`          | public, needs the right `v`     | An event's uploaded banner, linked from event lists; cached for good                           |
| `POST /api/community`                    | `POST /v1/queries/community`            | session                         | Feed, ideas, milestones, kudos                                                                 |
| `POST /api/members`                      | `POST /v1/queries/members`              | session                         | Directory, profiles, job-board sync                                                            |
| `POST /api/alumni`                       | `POST /v1/queries/alumni`               | session                         | Alumni, jobs, interview prep, blog                                                             |
| `POST /api/events`                       | `POST /v1/queries/events`               | session                         | Event list and one event (with responses for organisers)                                       |
| `GET /api/events`                        | `GET /v1/events`                        | public                          | Upcoming events for the public site                                                            |
| `POST /api/codeforces/sync`              | `POST /v1/me/codeforces/sync`           | session                         | Refresh own Codeforces stats and milestones                                                    |
| `POST /api/apply`                        | `POST /v1/applications`                 | public                          | Application through a recruitment link                                                         |
| —                                        | `GET /v1/recruit/:token`                | public                          | A recruitment link's title, batch, closing time and optional questions; `404` if unknown       |
| `GET /api/recruit/photo/:id`             | `GET /v1/applications/:id/photo`        | session + `application.approve` | An applicant's photo                                                                           |
| `GET /api/export/members`                | `GET /v1/exports/members`               | session + `data.export`         | Member list as CSV (audited)                                                                   |
| `POST /api/audit`                        | `POST /v1/queries/audit`                | session + `audit.view`          | The audit log: `{ area?, q?, before? }` → `{ rows, counts, more }`, 100 per page, newest first |
| `GET /api/cf/:handle`                    | — (web only)                            | public                          | Codeforces profile, rating history, solves; cached 10 min                                      |
| `GET /api/vjudge?id=`                    | — (web only)                            | public                          | VJudge contest standings; cached 30 s                                                          |
| —                                        | `GET /health/live`, `GET /health/ready` | public                          | Liveness; readiness checks the database                                                        |

## Auth

### `POST /v1/auth/login`

```json
{ "email": "tasnim@fecpc.example", "password": "…" }
```

`200 { user: { id, email, name, role, status, handle, squad, avatarUrl } }` and sets the session cookie.
`401 INVALID_CREDENTIALS` for an unknown email, a wrong password or an account without a password (same
answer and same work in each case). `403 ACCOUNT_SUSPENDED` only after a correct password.
`429 RATE_LIMITED` after too many failures (see [Security](security.md#sign-in-throttling)).

### `POST /v1/auth/invite/accept`

```json
{ "token": "<from /login?invite=…>", "password": "at least 10 characters" }
```

Sets the password, spends the link, signs out every existing session of that account, and signs in.
`410 INVITE_EXPIRED` for an unknown, used or expired link.

### `POST /v1/auth/password/change`

```json
{ "currentPassword": "…", "newPassword": "at least 10 characters" }
```

`401` if the current password is wrong. On success every session ends and a new one is set for this device.

### `POST /v1/auth/google`

```json
{ "code": "<authorization code from Google>" }
```

Called only by the web callback route. The API redeems the code with `GOOGLE_CLIENT_SECRET` and the redirect
URI (`GOOGLE_REDIRECT_URI`, else `APP_PUBLIC_URL/api/auth/google/callback`), reads the verified email from
Google, and links or signs in the matching active member. `403` if no member uses that address.

## Member area

### `GET /v1/me/state`

`{ state: AppState }`, or `{ state: null }` if the account was suspended mid-session. The shape is
`AppState` in `packages/contracts/src/state.ts`:

| Field                             | Contents                                                                                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `me`                              | the member's roster entry plus email                                                                                                                                                                                                                                               |
| `s`                               | personal progress: role, effective `roles` (role plus post grants), Codeforces and VJudge handles, solved/done/read lists, check-in, kudos, registrations, attendance, votes, payments, preference flags and values, and the officer decision maps (`queue`, `exp`, `apps`, `log`) |
| `members`                         | always empty here: the roster is `GET /v1/me/roster` (roles with an admin capability also see suspended and not-yet-joined accounts). Photos in it, and everywhere else, are `/api/avatars/:id?v=` links                                                                           |
| `counts`                          | live totals: volunteers, kudos, votes (the 50 newest polls), solves per starter-sheet problem, reads of the 50 newest announcements, recent milestones, `peopleCount`, `topHelpers`                                                                                                |
| `news`, `inbox`                   | announcements, and notifications built from real records                                                                                                                                                                                                                           |
| `myExpenses`, `fundTotal`, `term` | own expense requests (latest 200); club fund total; this term's real incoming and spent (since 1 Jan or 1 Jul), the latest 100 expenses and per-category totals                                                                                                                    |
| `courses`, `quiz`, `quizBank`     | course links; today's five quiz questions (`answer` only after the member's `picked`); the full bank with answers, only for full `learning.curate`                                                                                                                                 |
| `office`                          | only the officer datasets this role has a capability for: payment queue, fund, expenses, recruitment (`recruit`: links and applicants, without photo data), email queue status (`mail`), suggestions, feedback, the event room code, ops                                           |

### `POST /v1/me/actions`

Body `{ type, ...args }`. Answers `{ state: AppState, info: string | null }`. `info` is a one-time notice
(for example an invite link to hand over). Every `type` and its rules: [Member-area actions](member-area-actions.md).

### `POST /v1/queries/:area`

`area` is `community`, `members` or `alumni`. Body `{ action, ...args }`. The answer depends on the action;
the list is in [Member-area actions](member-area-actions.md#queries).

### `POST /v1/me/codeforces/sync`

No body. Fetches the member's own linked handles from Codeforces and VJudge (never a handle from the request).
Codeforces: updates rating, solves and streak, and records crossed milestones. VJudge: stores `vj_solved`, the
distinct accepted problems outside Codeforces/Gym. Both feed the member's XP. At most once a minute per member (`users.judge_synced_at`, shared by every API instance);
otherwise `{ synced: false }`. Answer: `{ synced, milestonesCreated }`. The web store calls it once per visit.

### `POST /v1/applications` (public)

```json
{
  "token": "the link's 16-character token",
  "name": "…",
  "sid": "student ID",
  "dept": "CSE",
  "email": "…",
  "phone": "10 to 15 digits, optional leading +",
  "photo": "data:image/(png|jpeg|webp);base64,… (≤ 450 000 characters)",
  "cf": "optional, when the link asks for it",
  "why": "optional, ≤ 1000, when the link asks for it",
  "answers": { "<question id>": "optional, ≤ 200 (short) or 1000 (paragraph)" }
}
```

The batch comes from the link, never from the body. Fields are checked with `checkApplicant` from
`@fecpc/contracts`, the same function the form uses. `200 { ok: true }`. `400` with a message for invalid
input. `404` unknown link, `410` closed link. `409` if an application or account already uses that email.

### `GET /v1/exports/members`

CSV (`name, handle, batch, dept, rating, solved, status`), no emails. Requires `data.export`. Each download is
written to the audit log. Cells that start with `= + - @` are prefixed with `'` so spreadsheets do not run them.
