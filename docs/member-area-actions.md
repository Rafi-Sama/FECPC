# Member-area actions

Everything a signed-in member changes goes through one function, `act(userId, input)` in
`apps/api/src/modules/member-area/actions.ts`, reached by `POST /api/act` → `POST /v1/me/actions` with
`{ type, ...args }`. Paged reads go through the query functions at the end of this page.

## How `act` works

1. Unknown `type` → `400 Unknown action.`
2. One transaction. The acting user's row is locked `FOR UPDATE`, so two quick clicks run one after the other
   and never lose an update. A suspended user gets `401 Sign in again.`
3. The handler validates every argument (`text()`, `mdText()`, `posInt()`, `key()`, `pick()`) and checks
   permission with `need(...)`, which throws `403` with a readable reason.
4. Personal progress (solved problems, lessons, flags and so on) lives in the `users.progress` JSON column.
   The handler edits it in memory and `act` writes it back once, only if it changed.
5. The handler may return a one-time `info` notice (for example an invite link). The controller then answers
   with the member's fresh `AppState`.

Two guards appear throughout:

- `person(a)`: the operator account (`admin`, `system = true`) is refused. It is not a member, so it cannot
  vote, pay, post or buy.
- `need(can(a.role, 'capability'))`: the role must hold that capability, at least partly. `canFully` requires
  the full grant. The matrix is in [Roles and permissions](roles-and-permissions.md).

## Action types

### Personal progress

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `toggle` | `list`, `id`, `on?` | anyone | Adds or removes `id` in a personal list. `solved` (sheet problems), `done` (resources, wiki pages), `lessons` (`course:index`), `read` (announcements, notifications) accept only real items. `kudos` cheers a post or idea (not your own, not a shop item, not a milestone). `reg` registers for an event. `present` signs up for a volunteer shift, which refuses when full. |
| `readAll` | — | anyone | Marks every inbox item read. |
| `checkin` | — | anyone | Daily check-in (once per day, Asia/Dhaka). |
| `flag` | `key`, `on` | anyone; shared switches need the role | Personal switches (dark mode, rail). Shared ones: `cd:*` contest-day checklist (committee), `act:*` meeting action items (committee), `unfrozen` scoreboard (`event.publish`), `nudge*` (`mentees.view`). |
| `kv` | `key`, `value` | anyone; shared keys need the committee | Personal values (ratings, fantasy picks of at most 3 real members, sheet notes). Shared: `task:*` (ops board column) and `inv:*` (equipment holder), committee only. |
| `quiz` | `course`, `picks` | anyone | Scores the answers on the server against keys the browser never sees. |
| `quizReset` | `course` | anyone | Clears a quiz score. |
| `handle` | `value` | anyone | Links or unlinks your Codeforces handle (validated). |
| `profile` | `name`, `dept`, `batch` | anyone | Basic details, within limits. |
| `updateProfile` | `bio`, `cf_handle`, `skills`, `github_url`, `linkedin_url`, `avatar_url` | `profile.editOwn`, not the operator | Public profile. Rating and solve counts are not accepted; they come from the Codeforces sync. |

### Money

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `pay` | `invoice`, `via`, `trx`, `sender` | members (not the operator) | Submits a bKash/Nagad payment for one of your invoices. Event invoices only if registered. One transaction ID pays for one thing. A rejected payment can be resubmitted. |
| `expense` | `what`, `amount`, `event` | committee | Files an expense request. |
| `decide` | `kind`, `id`, `to`, `reason?` | see below | Officer decisions. |

`decide` by `kind`:

| `kind` | `to` | Who |
| --- | --- | --- |
| `payment` | `verified`, `rejected` (+`reason`) | full `payments.verify` (Treasurer, Super Admin), never on your own payment |
| `application` | `accepted`, `declined` | `application.approve`. Accepting creates the account and returns a one-time invite link (7 days) as `info`. |
| `expense` | `approved`, `rejected`, `sent to President` | `expense.approve`. Up to ৳5,000 a partial grant (Treasurer) decides; above it the Treasurer can only pass it up and a full grant decides. Never your own request. |
| `waiver` | `proposed`, `waived`, `rejected` | `dues.waive`. One officer proposes; a second with the full grant waives or rejects. Never for yourself, never the one who proposed it. |

### Events and contests

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `attend` | `code` | anyone | Checks in to an event with the room code on the projector. |
| `vote` | `poll`, `option` | members (not the operator) | Votes in a poll; an event-feedback poll (`fb:*`) only once. |
| `redeem` | `item` | members (not the operator) | Buys a shop item with XP: enough XP, once per item, safe against double-spend. |

### Community

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `announce` | `title`, `body_md`, `audience`, `pinned`, `requires_ack` | `announce.post` (a mentor's partial grant posts to their own mentees only) | Posts an announcement. |
| `markAnnouncementRead` | `id` | anyone | Acknowledges an announcement (+3 XP once). |
| `createFeedPost` | `title`, `body_md`, `category` | `feed.post` | New feed post (+XP). |
| `voteFeed` | `postId`, `value` (−1, 0, 1) | members | Votes on a post. |
| `updateFeedPost`, `deleteFeedPost` | `postId`, … | the author only | Edits or deletes your post. |
| `reportFeedPost` | `postId`, `reason` | members, not on your own post | Reports a post. |
| `comment` | `targetType` (`feed`/`idea`), `targetId`, `body` | members | Comments. |
| `createIdea` | `title`, `body_md`, `ideaType`, `roles` | `idea.create` | Posts an idea, teammate search or study group. |
| `updateIdea`, `closeIdea` | `ideaId`, … | the poster, or full `idea.manage` | Edits or closes an idea. |
| `markIdeaViewed` | `ideaId` | anyone | Records a view. |
| `expressInterest` | `ideaId`, `response` | members, not on your own idea, not when closed | Asks to join. |
| `decideInterest` | `ideaId`, `userId`, `decision` | the poster only | Accepts or declines an interest request (+5 XP to the requester when accepted). |
| `kudosMilestone` | `milestoneId` | members | Permanent kudos on someone else's milestone, at most 20 per day. |
| `send` | `kind` (`checkin`, `suggest`, `feedback`), `body` | anyone | A weekly check-in to your mentor (needs a mentor), an anonymous suggestion (the sender is never stored), or event feedback. |
| `ping` | `to`, `kind` (`invite`, `duel`, `nudge`, `team`), `ref` | anyone; `nudge` needs `mentees.view` | Pings another member. A mentor nudges only their own mentees. |

### Alumni, jobs, prep, blog

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `saveAlumni` | `alumniId` | anyone | Bookmarks an alumni profile. |
| `setAvailableForQuestions` | `value`, `alumniId?` | the account owner or an admin | Toggles mentoring availability. |
| `createAlumniJob` | `company`, `title`/`role`, `url`, `location`, `job_type`, `description`, … | full `alumni.job.post` | Posts a job. |
| `deleteAlumniJob` | `jobId` | the poster or an admin | Deletes a job. |
| `toggleInterviewProblem` | `problemId` | members | Marks a prep problem solved or unsolved. |
| `createInterviewTopic` | `name`, `description` | full `interview.topic.create` | New prep topic. |
| `createInterviewProblem` | `topicId`, `title`, `url`, `difficulty` | full `interview.problem.create` | New prep problem. |
| `deleteInterviewProblem` | `problemId` | the creator or an admin | Deletes it. |
| `createInterviewTip` | `topicId?`, `title`, `body_md` | full `interview.tip.create` | New tip or interview experience. |
| `deleteInterviewTip` | `tipId` | the author or an admin | Deletes it. |
| `createBlogPost` | `title`, `body_md`, `subtitle`, `excerpt`, `tags`, `slug`, `cover_url`, `status` | full `blog.post.create` | Writes a post (draft or published). |
| `updateBlogPost`, `deleteBlogPost` | `id`, … | the author or an admin | Edits or deletes a post. |

### Accounts (officers)

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `role` | `user`, `role`, `reason` | full `roles.assign` | Changes a role. Not your own. Only a Super Admin grants Super Admin or changes a President or Super Admin. The public title follows the role. Audited with the reason. |
| `suspend` | `user`, `on` | full `roles.assign` | Suspends or reinstates. Same rank rule. Suspension ends every session immediately and blocks sign-in. |
| `deactivateMember` | `userId` | full `member.deactivate` | Suspends (same rule as above). |
| `promoteMember` | `userId` | full `member.promote` | Makes a plain member a Mentor. |
| `makeAlumni` | `userId` | full `member.makeAlumni` | Makes an account Alumni. Not a President or Super Admin unless you are a Super Admin. |
| `invite` | `user` | must outrank the account: members need `application.approve` or `roles.assign`; officers need full `roles.assign`; a Super Admin needs a Super Admin | Issues a new one-time set-password link (7 days) as `info`. Used for first invites and for resets. Not for yourself. |

## Queries

`POST /api/{area}` → `POST /v1/queries/:area` with `{ action, ...args }` (`queries.ts`). Writes here are the
same functions as the action handlers above, with the same checks.

| Area | Actions |
| --- | --- |
| `community` | `listFeedPosts` (q, category, sort, cursor, limit), `getFeedPostDetail`, `listIdeas` (q, type, status, sort, cursor, limit), `getIdeaDetail` (the poster also sees who is interested), `listRecentMilestones`, `getKudosTodayCount`, `kudosMilestone` (answers with fresh state) |
| `members` | `listMembers` (q, rating, skill, batch, type, page, pageSize), `getMemberProfile` (email only for yourself), `fetchAlumniJobs` (Greenhouse/Lever boards; owner or admin) |
| `alumni` | `listAlumni`, `saveAlumni`, `setAvailableForQuestions`, `listAlumniJobs`, `createAlumniJob`, `deleteAlumniJob`, `listInterviewTopics`, `getInterviewTopicDetail`, `toggleInterviewProblem`, `createInterviewTopic`, `createInterviewProblem`, `deleteInterviewProblem`, `createInterviewTip`, `deleteInterviewTip`, `listInterviewExperiences`, `listBlogPosts`, `getBlogPost`, `createBlogPost`, `updateBlogPost`, `deleteBlogPost` |

## Adding an action

1. Add a handler to `handlers` in `actions.ts`: `async myThing(c, a, p, i) { … }`.
   - `c` is the transaction client, `a` the actor `{ id, role, name, system }`, `p` the actor's progress
     (mutate it to change personal state), `i` the raw input.
   - Validate every field of `i` with the helpers at the top of the file. Never trust its types.
   - Check permission first: `person(a)` if the operator must not do it, and `need(can(a.role, '…'))` or an
     ownership check. Add a new capability to `packages/contracts/src/capabilities.ts` if none fits.
   - Officer decisions: call `audit(c, a, 'what happened')`.
   - Return a string only for a one-time notice.
2. If members must see the result, make sure `loadState` (`state.ts`) includes it and `AppState` describes it.
3. Call it from the page: `const { act } = useStore(); await act('myThing', { … })`. It resolves `true` on
   success and shows the refusal as a toast otherwise.
4. Add a test in `apps/api/test/member-area.test.ts` that covers both the allowed and the refused case.
