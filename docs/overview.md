# Overview

FECPC serves two audiences from one Next.js site:

- **Visitors** see the public site: the club, its events, contests, alumni, projects, a leaderboard, a
  certificate checker, and a form to apply for membership.
- **Members** sign in to the member area under `/app`, where everything they see and do comes from the API.

Most numbers, people and dates in the public site and in some member-area panels are **placeholders**
(`packages/content`). They exist so the interface has something to render; replace them with real data before
launch. Anything a member _does_ (solving, paying, posting, voting, deciding) is stored in PostgreSQL.

## Roles

Every account has exactly one role. Officers are the "committee".

| Role        | Who                                                                  | Committee |
| ----------- | -------------------------------------------------------------------- | :-------: |
| Member      | A current student member                                             |           |
| Alumni      | A graduate; can post jobs, prep material and blog posts              |           |
| CP Head     | Runs training and contest logistics                                  |     ✓     |
| Treasurer   | Verifies payments, files and decides small expenses                  |     ✓     |
| Secretary   | Runs events, reviews applications                                    |     ✓     |
| President   | Final say on expenses, roles                                         |     ✓     |
| Super Admin | The operator account (`admin`); not a person, never listed or ranked |     ✓     |

The full rules are in [Roles and permissions](roles-and-permissions.md).

## Member area, page by page

| Page           | Path                              | What happens there                                                                                                                                                                                                                                   |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today          | `/app`                            | Daily check-in, daily quests, XP and level, problem of the day, announcements, onboarding                                                                                                                                                            |
| Sheets         | `/app/sheets`                     | Tabs: This week (12 problems rebuilt every Monday, 800–2300), Curated (sheets the CP Head or President publish from Codeforces links), Core (the starter ladder). Progress comes from Codeforces sync                                                |
| Arena          | `/app/arena`                      | Daily problems and bounties from this week's sheet, challenges (paste a Codeforces link, see who solves it first), ranks, a weekly fantasy league scored from real Codeforces rounds, and trophies (record holders, badges with progress, your year) |
| Contests       | `/app/contests`                   | Upcoming Codeforces contests; register interest                                                                                                                                                                                                      |
| Contest day    | `/app/contest-day`                | Live VJudge standings for the running contest and past ones; balloons and prints for runners                                                                                                                                                         |
| Courses        | `/app/courses`                    | Lessons and server-scored quizzes                                                                                                                                                                                                                    |
| Learn          | `/app/learn`                      | The club's one learning roadmap: a topic tree with problems and per-member progress, kept by the CP Head and President (same editor as Interview prep)                                                                                               |
| Wiki           | `/app/wiki`                       | Club knowledge base                                                                                                                                                                                                                                  |
| Community      | `/app/community`                  | Feed (posts, votes, reports, milestones and kudos), announcements, ideas (with interest requests), polls                                                                                                                                             |
| Blog           | `/app/blog`                       | Club blog reading list                                                                                                                                                                                                                               |
| Interview prep | `/app/prep`                       | Roadmaps of topics and problems with per-member progress; CP Head and President edit the roadmaps (under Learn)                                                                                                                                      |
| Events         | `/app/events`, `/app/events/[id]` | Register or apply for roles, check in with the room code, feedback, certificates; organisers manage everything ([Events](events.md))                                                                                                                 |
| Teams          | `/app/teams`                      | ICPC team, team invites, shared template notebook with edit history                                                                                                                                                                                  |
| Members        | `/app/directory`                  | Searchable directory and member profiles; officer actions on members                                                                                                                                                                                 |
| Alumni & jobs  | `/app/career`                     | Alumni directory, job board, alumni blog                                                                                                                                                                                                             |
| Finance        | `/app/finance`                    | Own dues and payments, receipts, transparency; officers: payment verification, expense requests and decisions, club fund                                                                                                                             |
| Notifications  | `/app/notifications`              | Inbox built from real records (dues, decisions, team invites, kudos); latest six in the topbar bell; team invites and idea interests answer in one click (`actions` on the item)                                                                     |
| Profile        | `/app/profile`                    | Own details, Codeforces handle, password change                                                                                                                                                                                                      |
| Admin          | `/app/admin`                      | Dashboard (counts, member export, suggestions), recruit (links, QR posters, CSV import, applicant review), members (role, post, suspend/reinstate, invite and reset links), permissions matrix, audit log                                            |
| Ops            | `/app/ops`                        | Committee workspace: task board, documents, inventory, reports                                                                                                                                                     |

`/app/members` and `/app/alumni` are old URLs that redirect to `/app/directory` and `/app/career`.

## Public site

`/`, `/about`, `/events`, `/contests`, `/leaderboard`, `/alumni`, `/projects`, `/blog`, `/gallery`,
`/contact`, `/verify` (certificate checker), `/apply/<token>` (a recruitment link's form), `/login` (sign in, set a
password from an invite link, or Google sign-in).

## Core flows

- **Joining.** There is no standing join page. For each intake an officer with `application.approve` opens a
  recruitment link in Admin → Recruit (batch, closing time, optional questions) and shares the link or its QR
  poster. Applicants submit `/apply/<token>` while it is open; officers can also import a CSV, whose rows
  arrive as pending applicants. Accepting an applicant in Admin creates the account and shows a one-time invite link (valid 7 days). The applicant opens it, sets a
  password, and is signed in.
- **Paying dues.** A member sends money by bKash or Nagad and submits the transaction ID. The Treasurer checks
  it against the wallet statement and verifies or rejects it (never their own). The member's inbox shows the
  outcome; a verified payment has a printable receipt.
- **Expenses.** A committee member files a request. Up to ৳5,000 the Treasurer decides; above it the Treasurer
  can only pass it up and the President decides. Nobody decides their own request.
- **XP and levels.** Solving, check-ins, lessons, quizzes, posts, kudos and verified payments earn XP
  (`packages/contracts/src/xp.ts`). XP can be spent in the shop; spending never lowers the level.
- **Milestones.** Crossing a Codeforces rank, a solved-count threshold or a streak creates a milestone that
  others can give kudos to (20 per person per day). Stats refresh when a member opens a page that shows their
  Codeforces data (at most every 10 minutes).
