# Security

What protects member accounts and club data, where it is implemented, and what is still left to do.

## Sign-in and passwords

`apps/api/src/modules/auth/`

- **Passwords** are hashed with scrypt (N=16384, r=8, p=1, 16-byte salt, 32-byte key) in the
  self-describing format `scrypt$N$r$p$salt$key` (`password.ts`). Verification is constant-time. Older formats
  (`scrypt$salt$key` and `saltHex:hashHex`) still verify and are rehashed to the current format at the next
  sign-in. A truncated or empty stored hash never verifies. A password must be 10 to 128 characters when it is
  set; checking one has no length rule.
- **One answer for every failure.** An unknown email, a missing password and a wrong password all answer
  `401 Invalid email or password.` after the same scrypt work (`dummyVerify`). That the account is suspended is
  revealed only after the correct password.
- **Both password columns stay in step.** Passwords are written by `AuthService.setPassword` to
  `credentials.password_hash` and `users.pass_hash`.
- **Invites and resets** are 256-bit random tokens. Only their SHA-256 is stored (`users.invite_hash` or
  `invite_tokens`). They are single-use, expire after 7 days, and using one signs out every existing session
  of that account. Who may issue one is in [Roles and permissions](roles-and-permissions.md).
- **Google sign-in.** The browser goes to Google with a random `state` held in an httpOnly cookie. The
  callback checks it and hands only the authorization code to the API. The API redeems the code with the
  client secret, so the identity always comes from Google, never from the request. Only a verified email of
  an existing active member signs in. The first Google account used is linked (`google_sub`) and can't be
  replaced by another one.
- **GitHub sign-in** works the same way (`github_id`). Any verified email on the GitHub account may match a
  member; once linked, that GitHub account signs in even if its emails change.

## Sessions

`auth.service.ts`, `auth.guard.ts`

- The session token is 32 random bytes in an **httpOnly, SameSite=Lax** cookie, Secure and `__Host-` prefixed
  outside local development. The database stores only its SHA-256.
- **AuthGuard runs on every route** (`APP_GUARD`); `@Public()` opts a route out. On every request it reloads
  the user's role and status from the database, so a demotion or suspension applies immediately.
- **Expiry slides**: each use extends the session to `SESSION_IDLE_DAYS` (14) from now, at most one write per
  10 minutes, and never past `SESSION_ABSOLUTE_DAYS` (60) after sign-in.
- At most `SESSION_MAX_PER_USER` (10) sessions per account; the least recently used ones are dropped.
- Logout deletes the session. A password change, invite acceptance, suspension or deactivation deletes every
  session of the account.
- Only the cookie is accepted, never a header token, so page scripts never hold a session.

## Authorization

- Every member-area write runs in `act()` and checks permission inside the handler, next to the write (see
  [Member-area actions](member-area-actions.md)). There is no route-level shortcut a request could bypass.
- Reads are filtered by role in `loadState` (`office` contains only the datasets the role has a capability
  for) and in the query functions (for example a profile's email only for its owner).
- The web app's page gates (`/app/admin`, `/app/ops`) and hidden buttons are conveniences, not protection.
- Separation of duties and rank rules: [Roles and permissions](roles-and-permissions.md).

## CSRF

`apps/api/src/platform/http/csrf.guard.ts`, `apps/web/lib/api.ts`

The session cookie is SameSite=Lax, which already stops cross-site POSTs from carrying it. On top of that,
every write (`POST`) to the API must:

1. send `Content-Type: application/json` (HTML forms cannot), and
2. not be `Sec-Fetch-Site: cross-site`, and
3. have an `Origin` (or else `Referer`) that is one of `CORS_ORIGINS`.

The web proxy forwards the browser's `Origin`, `Referer` and `Sec-Fetch-Site` unchanged, so the API judges
the page that actually sent the request. A request with the custom header `X-Requested-With: fecpc` is
accepted. Browsers can only send it from an allowed origin, because CORS preflight blocks the rest.

## Sign-in throttling

`modules/auth/login-throttling.service.ts`

Failed sign-ins within 15 minutes: at most **5 per (email, address)**, **20 per email** from anywhere, **50 per
address** across all emails. Over the limit: `429`, even for the right password. A successful sign-in clears its
(email, address) counter. Each counter restarts its window once the old one has passed.

The client address is only trusted from the configured number of proxy hops (`TRUST_PROXY` in the API). The web
app forwards the browser's address only when its own `TRUST_PROXY=1`. If those are wrong, every request seems to
come from one address. The per-email limit still applies, but the per-address limit then works against
everyone at once. See [Deployment](deployment.md).

There is also a global limit of `RATE_LIMIT_GLOBAL_PER_MIN` (300) requests per minute per address on every
route.

The public join form (`POST /v1/applications`) also has a honeypot field (`website`: filled means a bot,
which gets a fake success), a limit of 10 applications per client address per hour (counted in the database
by hashed address), and, when `TURNSTILE_SECRET_KEY` is set, a Cloudflare Turnstile check. An application
gives no sign-in: the account exists only after a President or Secretary accepts it.

## Input and output

- Every action validates its input by hand (`text`, `mdText`, `posInt`, `key`, `pick` in `actions.ts`): types,
  lengths, allowed values, and existence of referenced items. Control characters are stripped.
- Auth requests are validated with strict zod schemas (`@fecpc/contracts`). Unknown fields are rejected.
- SQL is always parameterized.
- Every stored URL (profile links, job links and logos, blog covers, prep problems) must be `http(s)://`;
  markdown links render only for `http(s)://` and site-relative URLs. No component renders raw HTML.
- Markdown and text are stored as plain text and rendered by React, which escapes them.
- Errors are problem+json with a safe `detail`. Unexpected errors log the details server-side and answer a
  generic 500.
- The member CSV export neutralises spreadsheet formulas (`= + - @` prefixes) and contains no emails.
- Logs redact cookies, authorization headers, passwords, tokens, transaction IDs and phone numbers.

## Trust boundaries with outside services

- Codeforces stats (rating, solves, streak) are fetched by the server for the member's own stored handle
  (`POST /v1/me/codeforces/sync`). Members cannot set them through the profile.
- The web app's `/api/cf/[handle]` and `/api/vjudge` only read public data, validate the identifier (handle
  pattern; numeric contest ID), use fixed hosts and time out after 6–10 s. They are cached to avoid hammering
  the judges.
- Outside job boards: the slug is validated, the hosts are fixed, and at most 5 boards per request.

## Production checklist

- `APP_ENV=production` (Secure `__Host-` cookie) and HTTPS everywhere.
- `CORS_ORIGINS` = the public origin(s) only. `APP_PUBLIC_URL` = the public origin.
- `TRUST_PROXY` correct on both apps (see [Deployment](deployment.md)).
- Keep the API on a private network: only the web app needs to reach it.
- Strong database credentials. Run `pnpm db:migrate` with an account that can create tables; the API itself
  only needs read and write access.
- Remove or replace the seeded placeholder accounts. Never seed production with a guessable `SEED_PASSWORD`.

## Known gaps

- **Password reset by email** is not implemented: `POST /v1/auth/password/forgot` answers `202` and does
  nothing. An officer issues a reset link from the member list instead (the `invite` action).
- **Two-factor authentication** is not implemented.
- The Codeforces sync throttle and the global rate limit are **in memory**. They reset on restart and are not
  shared between several API instances.
- Session tokens and password hashes are protected by the database's own access control. Anyone with read
  access to `sessions` cannot use the hashes, but can see who is signed in.
