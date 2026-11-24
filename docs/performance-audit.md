# Performance audit

Audit of every page under load and with a very large club, on 24 November 2026. It records how each page was
measured, what was wrong, what was changed and what is still open. Re-run it with [Reproduce](#reproduce) after
any change to the state payload, a list query or the shell.

## Summary

The member area did not survive a large club. Every member page waits for one state request
(`GET /v1/me/state`), and that request took **15–16 seconds**, sometimes failed with a statement timeout, and
was **2.8 MB** for a member (4.3 MB for an officer). With 1,000 members who had uploaded a photo it was **137 MB**,
because every photo travelled inside the roster on every page. After the changes below it takes **0.09–0.25 s
and 225 KB** for a member (0.18–0.33 s and 680 KB for the President), photos are cached links, the roster loads
once on its own and is revalidated with a `304`, and what every member shares is computed once, not per request.

| What                              | Before                               | After                                                  |
| --------------------------------- | ------------------------------------ | ------------------------------------------------------ |
| State request, member             | 15.2 s, 2.8 MB                       | 0.09–0.25 s, 225 KB                                    |
| State request, officer            | 15.8 s, 4.3 MB, 1 in 3 failed (500)  | 0.18–0.33 s, 680 KB                                    |
| State request with 1,000 photos   | 137 MB                               | unchanged (photos are links)                           |
| Roster                            | inside every page and every answer   | own request, 1.9 MB raw / 200 KB gzip once; then `304` |
| Member page HTML                  | 4.9 MB raw / 377 KB gzip             | about 240 KB raw / 37 KB gzip                          |
| Alumni jobs list                  | 2.25 MB (every job, full text)       | 32 KB (30 a page)                                      |
| Events list                       | 877 KB (every event, banners inline) | upcoming only on first view; banners are links         |
| Lighthouse, member pages (mobile) | 41–66                                | see [Scores](#scores)                                  |

## Method

**Data.** A throwaway database (`fecpc_perf`) seeded as usual, plus `apps/api/scripts/perf-seed.sql`: about ten
times a large club.

| Table                                | Rows             | Table                     | Rows       |
| ------------------------------------ | ---------------- | ------------------------- | ---------- |
| users (500 alumni)                   | 5,027            | event_entries             | 100,000    |
| users with an uploaded photo (45 KB) | 1,000            | club_events (500 to come) | 1,007      |
| cf_solves                            | 500,000          | event_feedback            | 20,000     |
| feed_posts / feed_votes / comments   | 20k / 200k / 60k | milestones / kudos        | 20k / 100k |
| announcements / reads                | 2,000 / 200,000  | payments / expenses       | 30k / 5k   |
| polls / votes / reactions            | 500 / 50k / 50k  | applications              | 10,000     |
| ideas / interests                    | 3,000 / 12,000   | audit                     | 200,000    |
| alumni_jobs / blog_posts             | 2,000 / 2,000    | mail_queue                | 50,000     |

Photos are 45 KB: the top of what the app stores (`lib/image.ts` crops uploads to 512 px WebP at q0.85). The
first runs used 100 KB photos, which overstated their weight.

**Builds.** Production builds of both apps (`pnpm build`), `next start` on :3100 and the API on :3101, on the
same machine as PostgreSQL 16. JIT, indexes and every query as committed.

**Pages.** Lighthouse 12, mobile preset (simulated slow 4G and a mid-range phone's CPU), categories
performance, accessibility, best practices and SEO. The CPU slowdown is calibrated to the machine, as Lighthouse
recommends: 4× on mains power (benchmark index about 2,590) and 2× on battery (about 1,345), so every run emulates
the same phone. Uncalibrated runs on battery scored 5–10 points lower on every page, static ones included. Every page was run **three times, one after another, and the median
performance run is reported**: parallel runs share the CPU and score 10–15 points low. Member pages were
measured as a member (`p42`, 5,000-member roster) and the officer pages as the President (`tanvir`, who also
gets the recruitment and payment queues). Public pages without a session.

**Load.** autocannon against the API and the web server with 20–50 concurrent connections, signed in where the
page needs it. The API's global rate limit was raised for the run (`RATE_LIMIT_GLOBAL_PER_MIN`), so the numbers
are the server's capacity, not the limiter's.

**Causes** were found with `EXPLAIN ANALYZE` on the state query, Chrome traces (LCP candidates, layout shifts,
long tasks, style-recalculation counters) and CPU profiles of single page loads.

## Findings and fixes

Severity: **critical** — the page fails or takes many seconds at scale; **high** — fails the 95 target on its
own; **medium** — costs a few points or grows with the club; **low** — waste with no visible cost yet.

### Server and data

1. **Critical — PostgreSQL JIT compiled the state query on every request (7.8 s of 14.7 s).** The query's cost
   estimate (millions, from correlated subqueries) is above `jit_above_cost`, so every call spent seconds
   compiling. JIT never pays off for short queries like these. Fix: `jit=off` on the API pool
   (`platform/database/db.service.ts`).
2. **Critical — no index on `cf_solves(problem)` (8.8 s).** Each Arena challenge and each weekly-sheet problem
   counted its solvers with a sequential scan of every solve (300 challenges × 27 ms). Fix: index
   `cf_solves_problem` (schema §24).
3. **Critical — every uploaded photo inside every payload.** `users.avatar_url` holds a data URL of up to
   450 KB, and the roster (sent to every member, on every page and after every click), the feed, comments,
   milestones, the directory and alumni lists all selected it. 1,000 photos made the state 137 MB. Fix: a
   generated `avatar_key` (md5 prefix of the photo); lists send `/api/avatars/:id?v=<key>` (helper `face()` in
   `member-area/db.ts`), served by `GET /v1/avatars/:id` with `Cache-Control: immutable`.
4. **Critical — the whole roster in the HTML of every member page and in every action's answer.** 5,000 members
   is 1.9 MB of JSON; it was parsed before the page could paint and re-sent after each click. Fix: `loadState`
   no longer builds it; `GET /v1/me/roster` sends it with an ETag; the store loads it after the page has loaded
   and revalidates it (a `304`) when new state arrives, in a React transition. What a first screen needs from it
   is now counted on the server: `counts.peopleCount`, `counts.topHelpers`, `office.people` (admin dashboard).
   `cf_contests` (up to five rounds per member, the heaviest field) left the roster for the `clubRounds` query
   that only the Contests and Arena pages read.
5. **High — unbounded lists in the state.** The member's own expenses (all of them), the term ledger (all
   approved expenses of the term), every challenge of the last 30 days with every solver, vote counts for every
   poll ever, read counts for every announcement ever, solve counts for every problem anyone ticked. Fix: 200
   own expenses, 100 ledger rows plus per-category totals from the server, the 30 newest challenges with ten
   solvers on each side of the challenge plus the member and the two totals, votes and reads for the 50 polls
   and announcements shown, solve counts for the starter-sheet problems that use them.
6. **High — lists without pages.** `listAlumniJobs` sent all jobs with their full descriptions (2.25 MB);
   `listBlogPosts` sent each post's whole body for a card that shows two lines; the events list sent every
   event ever with its banner, which can itself be a 700 KB data URL. Fix: jobs 30 a page with a true total and
   _Show more_; blog lists carry the first 400 characters (the reader and the editor load the whole post); event
   lists link the banner (`GET /v1/events/:id/banner?v=`, public, needs the version from a list) and send 200
   characters of the description; the events page asks only for what is still to come and loads the rest when
   another tab is opened.
7. **Medium — `feed_posts(user_id)` had no index**: the member's post count scanned every post. Fix: index
   `feed_posts_user`.
8. **Bug, fixed — blog admins could not list blogs.** For a viewer with full `blog.post.delete` (the President)
   `listBlogPosts` sent one more parameter than its SQL used, and PostgreSQL refused the whole query (500). The
   draft condition now always uses both parameters.

### Browser

9. **Critical — `/app/events` rendered every event (TBT 3.7 s).** 1,000 cards, each with a staggered entrance
   delayed by its index. Fix: 24 cards at a time (`useMore`), the stagger restarts every 24. The server renders
   the first 24 upcoming events; the rest of the upcoming list loads only when the member asks for more, filters
   or searches (loading it unasked was a 300 ms task on every visit), and past events when another tab opens.
10. **High — whole-page fade-in hid every member page from its first paint.** `.page { animation: page-in }`
    started at `opacity: 0`, so the largest element only counted after hydration and the fade. Fix: the page
    and event cards slide in without fading (`page-rise`).
11. **High — Suspense fallbacks on dynamic pages.** Career, Community, the directory and _New event_ wrapped
    their content in `<Suspense>` for `useSearchParams`. On these per-request pages it does not suspend, but the
    boundary still streamed the page behind "Loading…" and React's ~300 ms reveal throttle. Fix: boundaries
    removed (the member layout is `force-dynamic`).
12. **High — main content fetched after hydration.** The directory, the community feed, the events list, one
    event, the ICPC team and the contests table appeared only after a second round trip. Fix: their `page.tsx` renders the
    first page on the server (`serverQuery()` in `lib/api.ts`) and the client skips its first fetch.
13. **High — layout shift on phones (CLS 0.31–0.35).** On mobile the shell is a two-row grid with
    `min-height: 100svh`; while a page was still short, the top bar's row was stretched to fill the screen, then
    snapped back to 62 px when content arrived. Fix: `grid-template-rows: auto 1fr`. Community also shifted when
    _Top helpers_ filled in from the roster; it now comes with the state.
14. **High — alumni cards ran ~90 style recalculations per load (627 ms on a phone).** Each card animated every
    pixel of its avatar, every letter of the name, a clip-path, eight staggered blocks and two endless loops.
    Fix: a card enters as one piece (transform and opacity only) and the loops run on hover: 101 ms.
15. **High — five full-size photos above the fold** on Community and Career competed with the page's own files.
    Fix: lazy loading on every member photo and job logo; photos are cached for a year after the first view.
16. **Medium — lists of the whole roster as DOM.** The Arena ranking, the admin accounts table (three selects per
    row) and the contests table rendered all 5,000 members. Fix: 50–100 rows and _Show more_.
17. **Medium — the admin dashboard counted 5,000 roster rows in the browser**, and could only show after the
    roster arrived. Fix: counted on the server (`office.people`).
18. **Medium — `/api/cf/:handle` was requested once per widget** (seven times on Today). Fix: one shared
    request per handle.
19. **Medium — `MemberFace` searched the roster array for every face** (`members.find`, quadratic on long lists).
    Fix: the store's id map (`who`).
20. **Tried and reverted — not preloading the three pixel fonts.** VT323, Silkscreen and Press Start 2P are
    rare in the member area, but the public pages set headings in them: loaded late, they swapped in and shifted
    the page (CLS 0.12 on `/`, 0.25 on `/blog`). They stay preloaded.
21. **High — the feed's _hot_ order computed in `numeric` (355 ms per page of posts).** `extract(epoch …)`
    returns `numeric`, so `power()` ran in arbitrary precision over every post. Fix: the formula in `float8`
    (85 ms at 20,000 posts).
22. **Critical under load — the same club-wide data rebuilt for every request.** The roster (2 MB of JSON) was
    rebuilt and hashed even to answer a `304`, and the club-wide half of the state (counts, news, polls, sheets,
    top helpers) was recomputed for every member's every page; PostgreSQL saturated all cores at about 30 state
    requests a second. Fix: both are built once per visibility class and kept 10 seconds; every action
    (`act()`) and judge sync clears them (`forgetShared` in `state.ts`), and nothing computed inside a
    transaction is cached. Roster `304`s went from 27 to 2,500 a second; a warm state request from 0.25 s to
    0.085 s; member pages answer in about 100 ms instead of 180–370 ms.
23. **High under load — the public home and events pages rendered per visitor**, because the public events list
    was fetched with `no-store`. Fix: kept for a minute (`next.revalidate: 60`); `/` went from 56 to 400 requests
    a second on the same laptop power state.

### Page by page

Every member page waited on findings 1–5 and 10 (the state request and the fade-in); those are not repeated
below. Numbers refer to the findings above.

| Page                                                         | What was wrong                                                                                                                                                 | Fixed by          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `/app` (Today)                                               | Seven identical Codeforces requests; quest links named only "Go" (SEO 90)                                                                                      | 18; link text     |
| `/app/admin`                                                 | Dashboard counted the roster in the browser; accounts table drew 5,000 rows with three selects each                                                            | 16, 17            |
| `/app/arena`                                                 | Ranking drew every member; every challenge carried every solver; awards read rounds from the roster                                                            | 4, 5, 16          |
| `/app/career`                                                | ~90 style recalculations from card animations; Suspense fallback; eager photos; unpaged jobs; whole blog posts in the list; blog list failed for the President | 6, 8, 11, 14, 15  |
| `/app/community`                                             | Feed fetched after hydration and sorted in `numeric`; Suspense fallback; _Top helpers_ shifted the page; vote and read counts for everything                   | 5, 11, 12, 13, 21 |
| `/app/contest-day`                                           | Nothing specific                                                                                                                                               | —                 |
| `/app/contests`                                              | Club table drew every participant; rounds came from the roster                                                                                                 | 4, 12, 16         |
| `/app/courses`, `/quiz`                                      | Nothing specific                                                                                                                                               | —                 |
| `/app/directory`                                             | First list fetched after hydration; Suspense fallback; header showed "0 members" until the roster came                                                         | 4, 11, 12         |
| `/app/events`                                                | 1,000 cards rendered (TBT 3.7 s); every event ever, with inline banners, fetched after hydration                                                               | 6, 9, 12          |
| `/app/events/[id]`                                           | Fetched after hydration; the mobile top bar jumped when it arrived (CLS 0.35)                                                                                  | 12, 13            |
| `/app/events/new`                                            | Suspense fallback                                                                                                                                              | 11                |
| `/app/finance`                                               | Whole term ledger and every own expense in the state                                                                                                           | 5                 |
| `/app/learn`, `/prep`, `/wiki`, `/notifications`, `/profile` | Nothing beyond the shared fixes                                                                                                                                | —                 |
| `/app/sheets`                                                | Solver counts scanned every solve; solve counts for every problem anyone ticked                                                                                | 2, 5              |
| `/app/teams`                                                 | Team fetched after hydration; the mobile top bar jumped when it arrived (CLS 0.31)                                                                             | 12, 13            |
| `/app/ops`                                                   | Committee only (404 for others); its lists are small tables                                                                                                    | —                 |
| `/app/members`, `/app/alumni`                                | Old URLs that redirect to the directory and Career                                                                                                             | —                 |
| `/`, `/events` (public)                                      | Up to 50 upcoming events with inline banners in the HTML                                                                                                       | 6                 |
| `/gallery`                                                   | Returns 404 until photos are added to `public/gallery` (by design); not scored                                                                                 | —                 |
| Other public pages                                           | Static; only the shared fonts                                                                                                                                  | 20                |

## Scores

Median of three runs per page on the final build (the run with the median performance score is shown, with
all three performance scores). Mobile preset; `CPU` is the calibrated slowdown.

**Against the 95 target:** every public page passes (95–99). In the member area, 12 of 22 member pages and 1
of 9 officer pages reach 95; the rest score 90–94. Accessibility, best practices and SEO are 95 or more
everywhere, except `/apply/[token]`, whose SEO is 60 because the page is `noindex` on purpose.

Before the changes, member pages scored **41–63** where they loaded at all (`/app` 41 and `/app/admin` 44 with
photos; 56–63 without; `/app/events` 66), and the public pages 95–98. Lighthouse is not meaningful for the
original state request (15 s before the first byte), so the "before" scores above are already after findings 1
and 2.

Every page below 95 has the same profile: observed LCP equals FCP (nothing paints late any more, no long task
blocks it), but Lighthouse's simulation charges the shared JavaScript and the one 188 KB member stylesheet to it
(LCP 3.0–3.6 s against 2.6–2.7 s on the pages that pass). The same page moves 3–6 points between runs. See
[open item 5](#open-items) for what would move them all.

**Member pages, as a member (5,000-member club)**

| Page                      |   Perf | A11y |  BP | SEO |   FCP |   LCP |    TBT |   CLS | Perf, 3 runs | CPU |
| ------------------------- | -----: | ---: | --: | --: | ----: | ----: | -----: | ----: | ------------ | --- |
| `/app`                    | **96** |   96 |  96 | 100 | 1.4 s | 2.7 s |  60 ms |     0 | 92/96/96     | 4x  |
| `/app/alumni`             | **99** |  100 | 100 | 100 | 1.2 s | 2.1 s |  50 ms |     0 | 97/99/99     | 4x  |
| `/app/arena`              | **92** |   96 |  96 | 100 | 1.4 s | 3.2 s | 120 ms |     0 | 90/92/95     | 4x  |
| `/app/career`             | **91** |   96 |  96 | 100 | 1.4 s | 3.3 s | 130 ms |     0 | 90/91/93     | 4x  |
| `/app/community`          | **90** |   96 | 100 | 100 | 1.4 s | 3.6 s |  50 ms |     0 | 87/90/90     | 4x  |
| `/app/contest-day`        | **96** |  100 | 100 | 100 | 1.4 s | 2.7 s |  70 ms | 0.002 | 92/96/96     | 4x  |
| `/app/contests`           | **96** |   95 |  96 | 100 | 1.4 s | 2.6 s | 120 ms |     0 | 92/96/97     | 4x  |
| `/app/courses`            | **91** |   98 | 100 | 100 | 1.5 s | 3.4 s |  70 ms |     0 | 90/91/91     | 4x  |
| `/app/directory`          | **94** |   96 | 100 | 100 | 1.4 s | 3.0 s |  50 ms |     0 | 94/94/94     | 4x  |
| `/app/events`             | **92** |  100 | 100 | 100 | 1.4 s | 3.3 s |  70 ms |     0 | 92/92/96     | 4x  |
| `/app/events/perf-ev-900` | **92** |   95 | 100 | 100 | 1.4 s | 3.3 s |  50 ms |     0 | 91/92/95     | 4x  |
| `/app/events/new`         | **96** |  100 | 100 | 100 | 1.4 s | 2.7 s |  70 ms |     0 | 95/96/96     | 4x  |
| `/app/finance`            | **92** |   98 | 100 | 100 | 1.4 s | 3.3 s |  70 ms |     0 | 92/92/96     | 4x  |
| `/app/learn`              | **95** |  100 | 100 | 100 | 1.4 s | 2.7 s | 140 ms | 0.001 | 92/95/95     | 4x  |
| `/app/members`            | **96** |  100 | 100 | 100 | 1.2 s | 2.7 s |  50 ms |     0 | 96/96/99     | 4x  |
| `/app/notifications`      | **92** |  100 | 100 | 100 | 1.4 s | 3.4 s |  70 ms |     0 | 91/92/92     | 4x  |
| `/app/prep`               | **95** |   98 | 100 | 100 | 1.4 s | 2.7 s | 140 ms |     0 | 93/95/95     | 4x  |
| `/app/profile`            | **94** |   96 |  96 | 100 | 1.4 s | 2.7 s | 150 ms |     0 | 93/94/95     | 4x  |
| `/app/quiz`               | **92** |  100 | 100 | 100 | 1.5 s | 3.2 s | 130 ms |     0 | 90/92/95     | 4x  |
| `/app/sheets`             | **96** |   96 |  96 | 100 | 1.4 s | 2.7 s |  70 ms |     0 | 92/96/96     | 4x  |
| `/app/teams`              | **91** |  100 | 100 | 100 | 1.4 s | 3.3 s | 110 ms |     0 | 91/91/95     | 4x  |
| `/app/wiki`               | **96** |  100 | 100 | 100 | 1.4 s | 2.6 s | 130 ms |     0 | 90/96/97     | 4x  |

**Officer pages, as the President**

| Page                      |   Perf | A11y |  BP | SEO |   FCP |   LCP |    TBT | CLS | Perf, 3 runs | CPU |
| ------------------------- | -----: | ---: | --: | --: | ----: | ----: | -----: | --: | ------------ | --- |
| `/app/admin`              | **93** |  100 | 100 | 100 | 1.5 s | 3.0 s |  90 ms |   0 | 92/93/94     | 4x  |
| `/app/ops`                | **93** |  100 | 100 | 100 | 1.5 s | 2.9 s | 150 ms |   0 | 92/93/93     | 4x  |
| `/app/finance`            | **93** |   98 | 100 | 100 | 1.5 s | 2.9 s | 170 ms |   0 | 91/93/94     | 4x  |
| `/app/events`             | **93** |  100 | 100 | 100 | 1.5 s | 3.2 s |  70 ms |   0 | 91/93/95     | 4x  |
| `/app/events/perf-ev-900` | **94** |   96 | 100 | 100 | 1.5 s | 3.0 s |  60 ms |   0 | 90/94/95     | 4x  |
| `/app`                    | **95** |   96 |  96 | 100 | 1.5 s | 2.7 s |  70 ms |   0 | 92/95/95     | 4x  |
| `/app/directory`          | **90** |   96 | 100 | 100 | 1.5 s | 3.5 s |  50 ms |   0 | 88/90/93     | 4x  |
| `/app/community`          | **90** |  100 | 100 | 100 | 1.5 s | 3.6 s |  60 ms |   0 | 89/90/91     | 4x  |
| `/app/arena`              | **93** |   96 |  96 | 100 | 1.5 s | 2.9 s | 160 ms |   0 | 93/93/94     | 4x  |

**Public pages**

| Page             |   Perf | A11y |  BP | SEO |   FCP |   LCP |    TBT | CLS | Perf, 3 runs | CPU |
| ---------------- | -----: | ---: | --: | --: | ----: | ----: | -----: | --: | ------------ | --- |
| `/apply/[token]` | **99** |   96 | 100 |  60 | 0.9 s | 2.3 s |  50 ms |   0 | 95/99/99     | 4x  |
| `/`              | **95** |   96 | 100 | 100 | 1.1 s | 2.9 s | 100 ms |   0 | 94/95/95     | 4x  |
| `/about`         | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/96     | 4x  |
| `/alumni`        | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/99     | 4x  |
| `/blog`          | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/99     | 4x  |
| `/contact`       | **96** |  100 | 100 | 100 | 0.9 s | 2.6 s | 100 ms |   0 | 96/96/96     | 4x  |
| `/contests`      | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/96     | 4x  |
| `/events`        | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/96     | 4x  |
| `/leaderboard`   | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/99     | 4x  |
| `/login`         | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/99     | 2x  |
| `/projects`      | **96** |   98 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/96     | 4x  |
| `/verify`        | **96** |  100 | 100 | 100 | 0.9 s | 2.7 s |  50 ms |   0 | 96/96/99     | 4x  |

## Load

autocannon on the final build, on mains power, with the database, the API, the web server and the load
generator sharing one 12-core laptop. Absolute numbers are therefore low; the shape is what matters. No request
failed in any scenario.

| Scenario                    | Concurrent | Requests | Req/s |     p50 |     p90 |     p99 | Errors |
| --------------------------- | ---------: | -------: | ----: | ------: | ------: | ------: | -----: |
| api state (member)          |         50 |     2000 |    57 |  819 ms |  981 ms | 1404 ms |      0 |
| api state (president)       |         50 |     1000 |    21 | 2274 ms | 2834 ms | 3052 ms |      0 |
| api roster (full)           |         50 |     1000 |   250 |   63 ms |  435 ms | 1426 ms |      0 |
| api roster (304)            |         50 |     5000 |  2500 |   14 ms |   16 ms |   18 ms |      0 |
| api feed page               |         50 |     3000 |    83 |  572 ms |  702 ms |  849 ms |      0 |
| api directory page          |         50 |     3000 |   429 |  115 ms |  124 ms |  134 ms |      0 |
| api upcoming events         |         50 |     1000 |   111 |  432 ms |  493 ms |  573 ms |      0 |
| api jobs page               |         50 |     3000 |   500 |   85 ms |   93 ms |  101 ms |      0 |
| api audit log (president)   |         50 |     2000 |   118 |  388 ms |  493 ms |  595 ms |      0 |
| api public events           |         50 |     5000 |  1000 |   42 ms |   50 ms |   58 ms |      0 |
| api avatar image            |         50 |     5000 |  2501 |   19 ms |   21 ms |   22 ms |      0 |
| web / (public)              |         50 |     2000 |   667 |   33 ms |   47 ms |  639 ms |      0 |
| web /app (member)           |         20 |      500 |    33 |  560 ms |  636 ms |  852 ms |      0 |
| web /app/directory (member) |         20 |      500 |    29 |  652 ms |  758 ms | 1482 ms |      0 |
| web /app/community (member) |         20 |      500 |    25 |  764 ms | 1077 ms | 1295 ms |      0 |
| web /app/events (member)    |         20 |      300 |    27 |  756 ms |  839 ms |  895 ms |      0 |
| web /app/admin (president)  |         20 |      300 |    14 | 1504 ms | 1665 ms | 1764 ms |      0 |

What the load showed, with before → after on the same machine and power state:

- **The state request is the ceiling for member pages.** PostgreSQL used every core at about 30 member state
  requests a second; with the club-wide half cached (finding 22) it is 57 a second, and a member page renders at
  25–33 a second under 20 concurrent members. The President's state (680 KB, with the recruitment and payment
  queues) is 21 a second: [open item 1](#open-items).
- **The roster revalidation is now nearly free**: 27 → 2,500 `304`s a second.
- **The public home is served from cache**: 56 → 667 requests a second.
- **Paged lists hold up**: directory 429, jobs 500 a second; the feed (83 a second, _hot_ order over 20,000
  posts) and upcoming events (111 a second) are the slowest lists.
- Single requests: state 0.09 s warm, 0.25 s cold; roster 0.1 s; feed 85 ms; directory 10 ms.

## Open items

These were measured and left, either because they are product decisions or because they are larger than this
audit's changes.

1. **Officer state is 650 KB for the President.** Up to 1,000 applicants and 500 payments travel with every
   page an officer opens, though only Admin → Recruit and Finance show them. Next step: load them as queries on
   those tabs and keep only the pending counts in the state.
2. **The roster is 1.9 MB raw (200 KB gzip) at 5,000 members.** It now loads once per visit after the page
   (then `304`), but a phone still parses it once. Pages that list everyone (Arena ranking, fantasy picker,
   admin accounts) need it; long term they should page on the server.
3. **Page data waits for the layout.** The layout awaits the state before the page's own server query starts,
   so Community, Events, the directory, an event and Teams answer one query later than other pages (about 10 ms
   now that the state is mostly cached; 85–150 ms with a cold cache).
4. **Still in every state:** `counts.kudos` (one entry per member with kudos, about 90 KB raw at 5,000
   members) and the 50 newest announcements with their full text (67 KB raw here).
5. **The shared floor — why ten member pages and most officer pages are at 90–94.** Every member page loads
   about 190 KB (gzip) of JavaScript and one 188 KB stylesheet (35 KB gzip) with every page's styles, plus
   `alumni-cards.css` (33 KB). On simulated slow 4G that puts FCP at 1.4–1.5 s and LCP at 2.6–3.6 s. About half
   of `app.css` belongs to six features (community 15 %, events 12 %, alumni 10 %, finance 7 %, recruitment 4 %,
   announcements 3 %); importing each from the pages that use it, and `alumni-cards.css` from Career only,
   would roughly halve the render-blocking CSS on every member page. It was not done here because moving rules
   changes cascade order across a recently finished design, and it needs a visual check of every page.
6. **Best practices 96 on pages that show Codeforces data:** the test members' handles are made up, so
   `/api/cf/:handle` answers 502 and the browser logs it. Real handles answer 200.
7. **Accessibility (all ≥ 95):** low contrast on a few small labels (Today's problem tier, sheet tags, contest
   chips, the kudos limit, the ID card's dim text), `h3` without an `h2` (courses, finance, prep, projects),
   `role` on an `article`/`li` that does not allow it (alumni cards, directory), a small _View_ target on alumni
   cards, and `aria-label` on a `dd` on the home page.
8. **Photos are stored at 512 px** and shown at 28–64 px. A 128 px copy made at upload would cut photo bytes by
   about ten times.
9. **Filtering upcoming events loads all of them.** 500 upcoming events (as seeded) is 270 KB; a club that plans
   that far ahead would want the filters on the server.

## Reproduce

```sh
# 1. A throwaway database with the normal seed, then the bulk data (about a minute).
psql postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc -c 'create database fecpc_perf'
export PERF=postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc_perf
DATABASE_URL=$PERF SEED_PASSWORD=fecpc-dev-2026 pnpm --filter @fecpc/api db:seed
psql $PERF -f apps/api/scripts/perf-seed.sql

# 2. Production builds on spare ports, pointed at it.
pnpm build
(cd apps/api && PORT=3101 DATABASE_URL=$PERF APP_PUBLIC_URL=http://localhost:3100 \
  CORS_ORIGINS=http://localhost:3100 RATE_LIMIT_GLOBAL_PER_MIN=1000000 node dist/main.js) &
(cd apps/web && API_INTERNAL_URL=http://localhost:3101 npx next start -p 3100) &

# 3. Sign in (bulk members are p1…p5000@perf.example, password fecpc-dev-2026) and run Lighthouse per page,
#    one run at a time, three runs each; report the median.
npx lighthouse@12 http://localhost:3100/app/directory --extra-headers='{"Cookie":"fecpc_session=…"}' \
  --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new"
```

The state query plan: `EXPLAIN ANALYZE` the `MINE` query in `member-area/state.ts` with a member's id and the
starter-sheet ids; it should stay well under 150 ms on this data.
