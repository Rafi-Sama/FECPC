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
- `need(can(a.roles, 'capability'))`: the member's effective roles (own role plus what their post grants) must
  hold that capability, at least partly. `canFully` requires
  the full grant. The matrix is in [Roles and permissions](roles-and-permissions.md).

## Action types

### Personal progress

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `toggle` | `list`, `id`, `on?` | anyone | Adds or removes `id` in a personal list. `solved` (sheet problems), `done` (resources, wiki pages), `lessons` (`course:index`), `read` (announcements, notifications) accept only real items; a `read` id must be in the member's own inbox, since reading earns XP. `kudos` cheers a real idea (`idea:N`), member (`member:id`), editorial (`post:id`) or doubt, never your own. `reg` registers for an event and refuses when it is full (checked under a lock). `present` signs up for a volunteer shift, which refuses when full. |
| `readAll` | — | anyone | Marks every inbox item read. |
| `checkin` | — | anyone | Daily check-in (once per day, Asia/Dhaka). |
| `flag` | `key`, `on` | anyone; shared switches need the role | Personal switches (dark mode, rail). Shared ones: `cd:*` contest-day checklist (committee), `unfrozen` scoreboard (`event.publish`), `nudge*` (`mentees.view`). |
| `kv` | `key`, `value` | anyone | Personal values (ratings, fantasy picks of at most 3 real members, sheet notes). `task:*` and `inv:*` are refused: the ops board and equipment have their own actions below. |
| `quiz` | `course`, `picks` | anyone | Scores the answers on the server against keys the browser never sees. |
| `quizReset` | `course` | anyone | Clears a quiz score. |
| `handle` | `value` | anyone | Links or unlinks your Codeforces handle (validated). Also sets the profile's `cf_handle`. |
| `vjudge` | `value` | anyone | Links or unlinks your VJudge username. A changed handle resets `vj_solved` until the next sync. |
| `profile` | `name`, `dept`, `batch` | anyone | Basic details, within limits. |
| `updateProfile` | `bio`, `cf_handle`, `skills`, `github_url`, `linkedin_url`, `avatar_url` | `profile.editOwn`, not the operator | Public profile. Rating and solve counts are not accepted; they come from the Codeforces sync. |

### Money

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `pay` | `invoice`, `via`, `trx`, `sender` | members (not the operator) | Submits a bKash/Nagad payment for one of your invoices. Event invoices only if registered. One transaction ID pays for one thing. A rejected payment can be resubmitted. |
| `expense` | `what`, `amount`, `event` | committee | Files an expense request. An approved one counts against the budget whose name equals `event`. |
| `requestWaiver` | `invoice`, `reason` | members (not the operator) | Asks to waive one of your own unpaid invoices. Amount and label come from the invoice. One live request per invoice; a rejected one can be asked again. |
| `saveBudget`, `deleteBudget` | `id?`, `name`, `plan` / `id` | full `payments.verify` (Treasurer, Super Admin) | Creates, renames, re-plans or deletes an event budget. Spent is computed, never entered. Audited. |
| `decide` | `kind`, `id`, `to`, `reason?` | see below | Officer decisions. |

`decide` by `kind`:

| `kind` | `to` | Who |
| --- | --- | --- |
| `payment` | `verified`, `rejected` (+`reason`) | full `payments.verify` (Treasurer, Super Admin), never on your own payment |
| `application` | `accepted`, `declined` | `application.approve`. Accepting creates the account and returns a one-time invite link (7 days) as `info`. |
| `expense` | `approved`, `rejected`, `sent to President` | `expense.approve`. Up to ৳5,000 a partial grant (Treasurer) decides; above it the Treasurer can only pass it up and a full grant decides. Never your own request. |
| `waiver` (`W-n`) | `proposed`, `waived`, `rejected` | `dues.waive`. A pending request is proposed or turned down by any holder; a proposed one is waived or rejected by a second officer with the full grant. Never your own request, never one you proposed. A waived invoice counts as settled (`s.pay[invoice].status = 'waived'`) and cannot be paid. |

### Events and contests

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `attend` | `code` | anyone | Checks in to an event with the room code on the projector. |
| `contestDay` | `contests` (≤20 of `{id, name, type: running\|previous}`) | `contest.run` | Sets the VJudge contests on the contest-day scoreboard, club-wide (`club` key `kv:contests`, visible to every member). Audited. |
| `vote` | `poll`, `option` | members (not the operator) | Votes in a poll; an event-feedback poll (`fb:*`) only once. |
| `redeem` | `item` | members (not the operator) | Buys a shop item with XP: enough XP, once per item, safe against double-spend. |

### Community

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `announce` | `title`, `body_md`, `audience`, `pinned`, `requires_ack` | `announce.post` (a mentor's partial grant posts to their own mentees only) | Posts an announcement. |
| `markAnnouncementRead` | `id` | anyone it was addressed to | Acknowledges an announcement (+3 XP once). |
| `createFeedPost` | `title`, `body_md`, `category` | `feed.post` | New feed post (+XP). |
| `voteFeed` | `postId`, `value` (−1, 0, 1) | members | Votes on a post. |
| `updateFeedPost`, `deleteFeedPost` | `postId`, … | the author only | Edits or deletes your post. |
| `reportFeedPost` | `postId`, `reason` | members, not on your own post | Reports a post. |
| `moderateFeedPost` | `postId`, `decision` (`remove`, `dismiss`) | `feed.moderate` | Removes a reported post, or clears its reports. Audited. |
| `deleteAnnouncement` | `id` | the author, or full `announce.post` | Deletes an announcement and its reads. Audited. |
| `comment` | `targetType` (`feed`/`idea`), `targetId`, `body` | members | Comments. |
| `createIdea` | `title`, `body_md`, `ideaType`, `roles` | `idea.create` | Posts an idea, teammate search or study group. |
| `updateIdea`, `closeIdea` | `ideaId`, … | the poster, or full `idea.manage` | Edits or closes an idea. |
| `markIdeaViewed` | `ideaId` | anyone | Records a view. |
| `expressInterest` | `ideaId`, `response` | members, not on your own idea, not when closed | Asks to join. |
| `decideInterest` | `ideaId`, `userId`, `decision` | the poster only | Accepts or declines an interest request (+5 XP to the requester when accepted). |
| `kudosMilestone` | `milestoneId` | members | Permanent kudos on someone else's milestone, at most 20 per day. |
| `send` | `kind` (`checkin`, `suggest`, `feedback`), `body` | anyone | A weekly check-in to your mentor (needs a mentor), an anonymous suggestion (the sender is never stored), or event feedback. |
| `ping` | `to`, `kind` (`invite`, `duel`, `nudge`, `team`), `ref` | anyone; `nudge` needs `mentees.view` | Pings another member. A mentor nudges only their own mentees. |

### ICPC teams

Handlers live in `teams.ts`. A team's members act on it; its coach and full `mentees.view` holders (CP Head and
above) may open and rename it. Nobody else reads its notebook. Not the operator.

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `teamCreate` | `name` | anyone not on a team | Creates a team with you on it. Names are unique. |
| `teamInvite` | `user` | a team member | Invites someone not on a team (a `pings` invite, ref `team:<id>`). At most three members. |
| `teamJoin` | `teamId` | the invited member | Joins, only on an invitation from a current member; the last place goes to one person. |
| `teamLeave` | — | a team member | Leaves and takes their notebook pages; an empty team is deleted. |
| `teamRename` | `name`, `teamId?` | members, the coach, full `mentees.view` | Renames the team. |
| `teamTopic` | `topic`, `on?` | a team member | Adds a topic (your page starts from the club template of that name) or removes it for the whole team. |
| `teamNote` | `topic`, `code` | a team member | Saves your own page on a topic (20,000 characters). Logged to the team history. |
| `teamCoach` | `teamId`, `user` (or `null`) | full `mentees.view` | Sets or clears the coach. |

Read with the `community` query `getTeam` (`teamId?`): the team, members, pages, history, people you can invite,
your invitations, and the teams you coach or oversee.

### Alumni, jobs, prep, blog

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `saveAlumni` | `alumniId` | anyone | Bookmarks an alumni profile. |
| `setAvailableForQuestions` | `value`, `alumniId?` | the account owner, or full `alumni.toggleMentoring` | Toggles mentoring availability. |
| `createAlumniJob` | `company`, `title`/`role`, `url`, `location`, `job_type`, `description`, … | full `alumni.job.post` | Posts a job. Both entry points share one validator (`jobFields`): bounded text, a known job type, an ISO deadline, http(s) link and logo. |
| `deleteAlumniJob` | `jobId` | the poster or an admin | Deletes a job. |
| `toggleInterviewProblem` | `problemId` | members | Marks a prep problem solved or unsolved. |
| `createInterviewTopic` | `name`, `description` | full `interview.topic.create` | New prep topic. |
| `createInterviewProblem` | `topicId`, `title`, `url`, `difficulty` | full `interview.problem.create` | New prep problem. |
| `deleteInterviewProblem` | `problemId` | the creator or an admin | Deletes it. |
| `createInterviewTip` | `topicId?`, `title`, `body_md` | full `interview.tip.create` | New tip or interview experience. |
| `deleteInterviewTip` | `tipId` | the author or an admin | Deletes it. |
| `createBlogPost` | `title`, `body_md`, `subtitle`, `excerpt`, `tags`, `slug`, `cover_url`, `status` | full `blog.post.create` | Writes a post (draft or published). |
| `updateBlogPost`, `deleteBlogPost` | `id`, … | the author or an admin | Edits or deletes a post. |

### Committee workspace (Ops)

All need the committee (`isCommittee`). Anyone on it edits, assigns and moves records; deleting a task, meeting
or item needs whoever added it, or an admin.

| `type` | Arguments | What it does |
| --- | --- | --- |
| `saveTask`, `deleteTask` | `id?`, `title`, `who?`, `due?` (YYYY-MM-DD), `col` (`To do`/`Doing`/`Done`) | Creates or updates a board task. |
| `saveMeeting`, `deleteMeeting` | `id?`, `date`, `title`, `agenda[]` (≤ 15) | Creates or updates a meeting; deleting removes its action items. |
| `saveMeetingAction`, `deleteMeetingAction` | `meeting` (new) or `id`, `what`, `who?`, `done` | Adds, edits, reassigns or ticks off an action item. |
| `saveItem`, `deleteItem` | `id?`, `name` | Adds or renames equipment. |
| `holdItem` | `id`, `to` (member or `null`) | Check out to yourself (only when free), return (the holder or an admin), or hand to someone else (admins). Audited. |

### Accounts (officers)

| `type` | Arguments | Who | What it does |
| --- | --- | --- | --- |
| `role` | `user`, `role`, `reason` | Super Admin | Changes a raw role (this is how the President is made). Not your own. Clears the post; the public title follows the role. Audited with the reason. |
| `appointPresident` | `user`, `email` | Super Admin | Makes `user` President after re-checking that `email` is that active account's. The previous President becomes a Member (post and title cleared). Audited. |
| `post` | `user`, `post` (or `null`) | full `roles.assign` | Assigns a club post. Not your own, never to a President or Super Admin. The public title follows the post. Audited. |
| `postRole` | `post`, `role`, `on` | Super Admin | Toggles one role in what a post grants. President and Super Admin cannot be granted. Audited. |
| `suspend` | `user`, `on` | full `roles.assign` | Suspends or reinstates. Same rank rule. Suspension ends every session immediately and blocks sign-in. Reinstating an account that never set a password leaves it `invited`. |
| `deactivateMember` | `userId` | full `member.deactivate` | Suspends (same rule as above). |
| `promoteMember` | `userId` | full `member.promote` | Makes a plain member a Mentor. |
| `makeAlumni` | `userId` | full `member.makeAlumni` | Makes an account Alumni and clears its post. Not a President or Super Admin unless you are a Super Admin. |
| `assignMentor` | `user`, `mentor` (or `null`) | full `mentees.view` (CP Head and above) | Pairs a member (not alumni) with a mentor, who must hold `mentees.view`. Audited. Ops → Mentors. |
| `invite` | `user` | must outrank the account: members need `application.approve` or `roles.assign`; officers need full `roles.assign`; a Super Admin needs a Super Admin | Issues a new one-time set-password link (7 days) as `info`. Used for first invites and for resets. Not for yourself. |

## Queries

`POST /api/{area}` → `POST /v1/queries/:area` with `{ action, ...args }` (`queries.ts`). Writes here are the
same functions as the action handlers above, with the same checks.

| Area | Actions |
| --- | --- |
| `community` | `listFeedPosts` (q, category, sort, cursor, limit), `getFeedPostDetail`, `listIdeas` (q, type, status, sort, cursor, limit), `getIdeaDetail` (the poster also sees who is interested), `listFeedReports` (`feed.moderate`), `getTeam` (see ICPC teams), `listRecentMilestones`, `getKudosTodayCount`, `kudosMilestone` (answers with fresh state) |
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
