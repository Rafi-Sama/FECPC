# Roles and permissions

Permissions are defined once, in `packages/contracts/src/capabilities.ts`, and used by both apps. The API
enforces them inside every action handler. The web app uses the same matrix only to decide what to show.

## Grants

Each cell of the matrix is one of:

| Cell      | Meaning                                                                         | `can(role, cap)` | `canFully(role, cap)` |
| --------- | ------------------------------------------------------------------------------- | ---------------- | --------------------- |
| ✓         | full authority                                                                  | `true`           | `true`                |
| `scope`   | only within the role's own reach (a mentor's own mentees, a poster's own items) | `'scope'`        | `false`               |
| `view`    | can see, cannot act                                                             | `'view'`         | `false`               |
| `propose` | can start a two-person decision, a second officer completes it                  | `'propose'`      | `false`               |
| empty     | nothing                                                                         | `false`          | `false`               |

Money-moving and account-changing actions require `canFully`. `grantOf(role, cap)` returns the same
information as a string: `'full' | 'scope' | 'view' | 'propose' | 'none'`.

## The matrix

Generated from `packages/contracts/src/capabilities.ts`.

| Capability                  | What it allows                                            | Member | Alumni | Mentor | CP Head | Treasurer | Secretary | President | Super Admin |
| --------------------------- | --------------------------------------------------------- | :----: | :----: | :----: | :-----: | :-------: | :-------: | :-------: | :---------: |
| `profile.own`               | Edit own profile, see own dues                            |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `profile.editOwn`           | Edit own public profile                                   |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `directory.view`            | View member directory                                     |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `mentees.view`              | View mentees' progress                                    |        |        | scope  |    ✓    |           |           |     ✓     |      ✓      |
| `sheet.edit`                | See sheet completion statistics                           |        |        |        |    ✓    |           |           |     ✓     |      ✓      |
| `payments.verify`           | Verify member payments                                    |        |        |        |         |     ✓     |           |   view    |      ✓      |
| `expense.approve`           | Approve expenses                                          |        |        |        |         |  propose  |           |     ✓     |      ✓      |
| `event.publish`             | Run events: create, registrations, feedback, certificates |        |        |        |         |           |     ✓     |     ✓     |      ✓      |
| `contest.run`               | Choose the contests on the contest-day scoreboard         |        |        |        |    ✓    |           |     ✓     |     ✓     |      ✓      |
| `announce.post`             | Post announcements                                        |        |        | scope  |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `feed.post`                 | Create community feed posts                               |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `feed.moderate`             | Review reported feed posts                                |        |        |        |         |           |     ✓     |     ✓     |      ✓      |
| `idea.create`               | Submit community ideas                                    |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `idea.manage`               | Manage community ideas                                    | scope  | scope  | scope  |  scope  |   scope   |   scope   |     ✓     |      ✓      |
| `alumni.save`               | Save alumni profile                                       |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `alumni.toggleMentoring`    | Toggle mentoring availability                             |        | scope  |        |         |           |           |     ✓     |      ✓      |
| `alumni.job.post`           | Post alumni job listings                                  |        |   ✓    |        |         |           |           |     ✓     |      ✓      |
| `alumni.job.fetch`          | Fetch public job listings                                 |        |        |        |         |           |           |     ✓     |      ✓      |
| `interview.topic.create`    | Create interview prep topic                               |        |   ✓    |        |         |           |           |     ✓     |      ✓      |
| `interview.problem.create`  | Add problem to topic                                      |        |   ✓    |        |         |           |           |     ✓     |      ✓      |
| `interview.tip.create`      | Post interview tip                                        |        |   ✓    |        |         |           |           |     ✓     |      ✓      |
| `interview.progress.toggle` | Toggle problem solved                                     |   ✓    |   ✓    |   ✓    |    ✓    |     ✓     |     ✓     |     ✓     |      ✓      |
| `blog.post.create`          | Write blog post                                           |        |   ✓    |        |         |           |           |     ✓     |      ✓      |
| `blog.post.delete`          | Delete blog post                                          |        | scope  |        |         |           |           |     ✓     |      ✓      |
| `application.approve`       | Approve applications                                      |        |        |        |         |           |     ✓     |     ✓     |      ✓      |
| `roles.assign`              | Assign roles                                              |        |        |        |         |           |           |     ✓     |      ✓      |
| `member.promote`            | Promote member to mentor                                  |        |        |        |         |           |           |     ✓     |      ✓      |
| `member.makeAlumni`         | Transition member to alumni                               |        |        |        |         |           |           |     ✓     |      ✓      |
| `member.deactivate`         | Deactivate member account                                 |        |        |        |         |           |           |     ✓     |      ✓      |
| `audit.view`                | View audit log                                            |        |        |        |         |           |           |     ✓     |      ✓      |
| `data.export`               | Export the member list                                    |        |        |        |         |     ✓     |     ✓     |     ✓     |      ✓      |

## Posts

Club posts (Vice President, General Secretary, … Executive Member, Member; `posts` in
`packages/contracts/src/roles.ts`) are aliases, not roles. Each post grants a set of the roles above, stored in
`post_roles` and edited by the Super Admin in Admin → Permissions → Posts. A member's effective roles are their
own role plus their post's roles, and `can`, `canFully`, `isAdmin` and `isCommittee` all accept that list and
take the strongest grant. A post can never grant President or Super Admin (`postableRoles`).

- The Super Admin appoints the President in Admin → Permissions, by member email (`appointPresident`). The
  previous President becomes a Member. Members' emails reach the Super Admin only.
- The President (full `roles.assign`) assigns posts (`post`) from a member's ⋯ menu, to anyone below President.
- Admin → Members lists every account with what the viewer may do to it: post (full `roles.assign`), raw role
  (Super Admin), suspend or reinstate, and a one-time invite or reset link (same rank rules as `invite`).
- Ops → Mentors: whoever holds full `mentees.view` (CP Head, President, Super Admin) pairs members with mentors
  (`assignMentor`). A mentor's dashboard lists exactly the members paired with them.

## Role groups and rank

- `isCommittee(role)`: everyone except Member, Alumni and Mentor. Committee members see the ops workspace,
  shared contest-day switches, and file expense requests.
- `isAdmin(role)`: holds `application.approve`, `roles.assign`, `audit.view` or `data.export`. Opens the
  admin panel, and sees suspended and not-yet-joined accounts in the roster.

Rank rules, on top of the matrix:

- Nobody changes their own role, suspends themselves, or issues a reset link for themselves.
- Only a Super Admin changes raw roles, and only a Super Admin changes a President or a Super Admin (role,
  post, suspension, deactivation, alumni transition).
- `promoteMember` only turns a plain Member into a Mentor.
- The operator account (`admin`, `system = true`) is never changed by these actions and never acts as a
  member: no votes, payments, purchases or posts.
- A reset or invite link for an officer needs full `roles.assign`; for a Super Admin, a Super Admin.

## Separation of duties

- Nobody verifies their own payment, or decides their own expense.
- Expenses above ৳5,000 (`APPROVAL_THRESHOLD` in `packages/content/src/member-area.ts`) need two officers:
  the Treasurer passes them up, a full `expense.approve` grant decides.
- Event budgets are the Treasurer's (full `payments.verify`); the President sees them.
- Ops tasks, meetings and equipment: the whole committee edits; the creator or an admin deletes.

## Changing permissions

1. Edit the matrix in `packages/contracts/src/capabilities.ts`. Add a capability with a `label` and one cell per
   role that has it.
2. Use it where the action is enforced: `need(can(a.role, 'my.cap'))` or `canFully` in
   `apps/api/src/modules/member-area/actions.ts`.
3. Use it in the interface to hide what would be refused: `can(s.role, 'my.cap')` from `@fecpc/contracts`.
4. Update `packages/contracts/test/permissions.test.ts` for risky cells, and this page's table (regenerate it
   with the snippet below).

```sh
node --input-type=module -e "
const { matrix, roles, roleName } = await import('./packages/contracts/src/index.ts');
const cell = (v) => v === true ? '✓' : v || '';
console.log('| Capability | What it allows | ' + roles.map((r) => roleName[r]).join(' | ') + ' |');
console.log('|---|---|' + roles.map(() => ':-:').join('|') + '|');
for (const [k, v] of Object.entries(matrix))
  console.log('| \`' + k + '\` | ' + v.label + ' | ' + roles.map((r) => cell(v[r])).join(' | ') + ' |');"
```
