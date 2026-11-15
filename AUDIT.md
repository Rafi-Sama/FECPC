# Role-by-role audit

Every role signs in through the browser and every page and tab is judged on three questions:

1. **Visibility** — should this role see everything shown?
2. **Completeness** — is a feature, sub-feature or state missing on or around the page?
3. **Design / UX** — is it good enough for the person using it?

Nothing is marked done until it is fixed **and** re-checked in the browser.

## Status

| Step | State |
|---|---|
| Capture member, mentor, CP head (every page + tab, 1440px) | done |
| Capture treasurer, secretary, president, super admin | done |
| Critic A: member, mentor, CP head | reported (27 findings) |
| Critic B: treasurer, secretary | reported (29 findings) |
| Critic C: president, super admin | reported (29 findings) |
| Findings merged into the list below | done (85 findings: A 27, B 29, C 29) |
| Fixes applied | done: 52 fixed, 26 partly, 7 open (see fix log) |
| Re-capture and re-check every fixed page | done for the changed pages at 1440px, all seven roles; phone only for Verify payments |
| Typecheck + backend tests after fixes | passing (36 tests) |

Captures live in the session scratchpad under `audit/` as `<role>__<page>__<tab>.png` and `.txt`.

## Accounts used

| Role | Account |
|---|---|
| member | tasnim |
| mentor | mehedi |
| cp_head | nadia |
| treasurer | anika |
| secretary | sadia |
| president | tanvir |
| super_admin | admin |

## Coverage

`c` = captured, `r` = reviewed by a critic, `f` = findings fixed and re-checked, `404` = correctly not available to the role.

| Page | member | mentor | cp_head | treasurer | secretary | president | super_admin |
|---|---|---|---|---|---|---|---|
| Today | r | r | r | r | r | r | r |
| Inbox | r | r | r | r | r | r | r |
| Sheets | r | r | r | r | r | r | r |
| Contests | r | r | r | r | r | r | r |
| Contest day (3 tabs) | r | r | r | r | r | r | r |
| Learn (4 tabs) | r | r | r | r | r | r | r |
| Courses | r | r | r | r | r | r | r |
| Editorials | r | r | r | r | r | r | r |
| ICPC teams | r | r | r | r | r | r | r |
| Playground | removed from the app after the audit |
| Arena (4 tabs) | r | r | r | r | r | r | r |
| Events (5 tabs) | r | r | r | r | r | r | r |
| Community (8 tabs) | r | r | r | r | r | r | r |
| Members | r | r | r | r | r | r | r |
| Alumni & jobs (4 tabs) | r | r | r | r | r | r | r |
| Wiki | r | r | r | r | r | r | r |
| Finance (tabs vary by role) | r | r | r | r | r | r | r |
| Profile | r | r | r | r | r | r | r |
| Workspace (7 tabs) | 404 | 404 | r | r | r | r | r |
| Admin (tabs vary by role) | 404 | 404 | 404 | r | r | r | r |

## Already noticed during capture (to confirm with the critics)

- [ ] Browser console reports a hydration mismatch on at least one page (server HTML differs from client). Page not yet identified.

## Findings

Filled in as each critic reports. One line per finding: severity, question, role(s), page, problem, fix, state.

### Critic A — member, mentor, CP head

Reported. 27 findings. `[ ]` open, `[x]` fixed and re-checked, `[~]` partly done (see fix log), `[-]` deliberately not done (reason in fix log).

**P0 — a role sees or can do something it must not**
- [x] A1 · Q1 · mentor · Community/Announcements — form says "your mentees only" but the post goes to the whole club.
- [x] A2 · Q1 · all · Events — the attendance code is printed as the input placeholder.
- [x] A3 · Q1 · mentor · Learn/Mentorship — "your mentees only" is a label; every mentor gets every mentee.

**P1 — wrong or misleading for the user, or a blocked core task**
- [x] A4 · Q1 · member, mentor · everywhere — roster sends `roleKey` and `suspended` to everyone; "Site Admin" and handle-less accounts appear in ranks; counts disagree (16 vs 18).
- [~] A5 · Q2 · all · Learn check-in, Community/Suggest, Events/Feedback, Career/CV review — text is thrown away, UI says "Sent".
- [~] A6 · Q2 · all · Teammates, Groups, team invite, career ask/referral, duel challenge, mentor Nudge — say "invited"/"asked" but notify nobody.
- [~] A7 · Q2 · cp_head · Sheets — sheet builder has no save and no server action; "club completion" is computed from rating.
- [x] A8 · Q2 · mentor, cp_head · Today — mentor sees "From your mentor · Mehedi" quoting himself; senior officers get beginner onboarding; no role-specific work shown.
- [x] A9 · Q2 · all · Inbox — same six static notifications for everyone; bell always shows 6.
- [x] A10 · Q2 · all · Finance/My dues — invoices and payment history are the same static lists for everyone.
- [x] A11 · Q2 · all · Finance, Today — a pending payment counts as paid ("all paid up"); a rejection shows no reason; test payment row left in the dev database.
- [~] A12 · Q2 · all · Profile — nothing is editable, no change-password screen, privacy toggles do nothing, "export or delete your data" has no control.
- [~] A13 · Q2 · all · Profile — member number derived from name length (three people share FEC-1644); timeline, badges and radar are the same for everyone.
- [x] A14 · Q2 · all · Events — "92% attendance", "23 of 25", "window closes in 09:41", "streak: 7" are literals.
- [x] A15 · Q2 · all · ICPC teams — everyone is shown as on Team FEC_NullPointers; invite offered on a full team.
- [x] A16 · Q2 · cp_head · Finance/Workspace — committee members cannot submit an expense or see the status of their own.

**P2 — real gap or clear UX defect**
- [x] A17 · Q1 · member, mentor · Contest day — Balloons and Prints tabs are runner logistics with no action for them.
- [x] A18 · Q1 · cp_head · Workspace — can disable finance automations and sees sponsor money without any finance capability.
- [~] A19 · Q2 · cp_head · Workspace — no add/assign task, no meeting creation, documents are not links; anyone can "Return" someone else's equipment; counts (144 members) disagree with the directory.
- [~] A20 · Q2 · mentor, cp_head · Learn/Mentorship — no check-in text, no reply, no target editor.
- [~] A21 · Q2 · all · Community — members cannot post to Feed/Ideas/Teammates/Doubts; kudos seeds; "ballots are anonymous" while the vote is stored with the voter; posts cannot be retracted.
- [~] A22 · Q2 · all · Today/Sheets/Arena/Profile — same problem pays +12 XP on Today and +20/40/80 in Arena; level titles reuse Codeforces rank names; streak 42 vs 41; handle not prefilled; onboarding "verify handle" has no link; revisit queue static.
- [~] A23 · Q3 · all · Contest day/Scoreboard — arcade colours unreadable on the paper skin; columns cut off on phones.
- [~] A24 · Q3 · all · Arena (phone) — pixel font names render below 14px.
- [x] A25 · Q3 · cp_head · sidebar — the only officer link (Workspace) is below the fold at 1440×900.
- [~] A26 · Q3 · all · Today, Profile — holes in the grid; "XP to level" text collides; radar has no values.

**P3 — polish**
- [~] A27 · Q3 · all · global — every browser tab titled "Members — FECPC"; Community has 8 tabs; "Read/Acknowledge/Done" for the same act; unlabeled buttons and checkboxes; "join" on Contests does nothing; bare unframed 404 for officer routes; dev overlay reports 1 issue on Profile.

Critic A did not check: post-click states (inferred from code), mentor and CP head at phone width, dark theme, focus order, measured contrast, print output.

### Critic B — treasurer, secretary

Reported. 29 findings.

**P0**
- [x] B1 · Q3 · treasurer · Finance/Verify (phone) — Decision column off-screen, transaction IDs clipped, bottom nav covers last row.

**P1**
- [x] B2 · Q2 · treasurer · Verify — Reject has no reason/confirm; a rejected transaction ID can never be resubmitted (global unique).
- [~] B3 · Q2 · treasurer · Club fund, Transparency — every figure is a constant presented as live.
- [x] B4 · Q2 · secretary · Applications — reviewer cannot see the application's answers; Quiz shows 0% for real applicants.
- [x] B5 · Q2 · secretary · Applications/invite — link shown once, no re-issue screen, no "invited, not joined" status, no confirm on Accept.
- [x] B6 · Q1 · secretary · matrix — "Edit other members' profiles" and "Publish events" are granted but not implemented.
- [~] B7 · Q2 · secretary · Events — no registrant list, attendance code, live arrived count or feedback results for organisers.
- [ ] B8 · Q2 · treasurer · dues — cannot create dues, record cash, or list who owes what.
- [x] B9 · Q2 · treasurer · Club fund — "Remind all defaulters" sends nothing, disables forever, and is audited as sent.
- [~] B10 · Q2 · both · Admin dashboard, Workspace reports — hard-coded numbers contradict the app; inactivity radar is invented.
- [x] B11 · Q1 · both · Admin dashboard — "Nudge mentor" for roles without mentee authority; sends nothing; audited.
- [~] B12 · Q2 · treasurer · Waivers — only "Propose"; "proposed" shown as a green success pill; waiver not linked to the invoice.

**P2**
- [x] B13 · Q1 · treasurer · own payments — Verify/Reject shown on her own row and refused by the server.
- [ ] B14 · Q2 · treasurer · Expenses — budgets/ledger do not move with approvals; no reason on reject.
- [x] B15 · Q1 · both · Workspace/Automation — any committee member can switch off any rule; no rule engine exists.
- [~] B16 · Q2 · both · export — "member and finance data" promised, only a thin member CSV exists; includes Site Admin.
- [x] B17 · Q2 · treasurer · Verify — no pending-first order, oldest pending at the bottom, 200-row cut could hide pending rows.
- [x] B18 · Q3 · both · sidebar, Today — badge counts own invoices, not work waiting; Run group below the fold.
- [ ] B19 · Q1 · treasurer · Admin — nothing there is a treasurer job except export; receives suspended/role keys.
- [x] B20 · Q1 · secretary · Admin dashboard — sees collection rate with no finance capability.
- [ ] B21 · Q2 · both · Workspace — read-only seed data; no create/edit.
- [x] B22 · Q3 · both · Workspace/Meetings — action item checkbox, text and assignee broken apart.
- [~] B23 · Q3 · treasurer · Expenses, Waivers (phone) — title column collapses to one word per line.
- [x] B24 · Q1 · secretary · Contest day — Unfreeze is one click with no confirm.
- [ ] B25 · Q2 · both · Announcements — title only; no body, must-read, edit or delete.

**P3**
- [x] B26 · Q3 · secretary · Events — panel labelled "Organiser view · Secretary" for every role.
- [x] B27 · Q3 · both · Admin/Roles — raw keys under labels; unclear legend.
- [x] B28 · Q3 · both · Contest day — Deliver cannot be undone.
- [x] B29 · Q3 · treasurer · Finance — same headline on two tabs; "October locked" means nothing.

Critic B did not check: outcomes of decision buttons, phone captures other than Verify and Expenses, the current source.

### Critic C — president, super admin

Reported. 29 findings.

**P0**
- [x] C1 · Q1 · both · Admin/Settings — claims "Two-factor for admin roles: required"; no second factor exists.
- [x] C2 · Q1 · all · sign-in — throttle keyed on a client-controlled header: unlimited guesses, or lock out the real admin.
- [x] C3 · Q1 · both · Expenses, Waivers — top roles can decide large expenses and waivers alone, with no proposal from a second person.
- [x] C4 · Q1 · super_admin · Election — the system account can cast a ballot.
- [~] C5 · Q1 · both · Election — "ballots are anonymous" while the vote is stored against the voter.

**P1**
- [x] C6 · Q1 · president · Admin/Members — Suspend shown on Site Admin and refused by the server.
- [x] C7 · Q1 · president · Club fund — "Remind all defaulters" enabled but refused.
- [x] C8 · Q2 · both · Admin/Rollover — a wizard that only writes an audit line.
- [x] C9 · Q2 · both · About page — promises executive access expires automatically; nothing expires.
- [x] C10 · Q2 · both · Admin/Settings — module toggles enforce nothing; club settings are literals.
- [x] C11 · Q2 · both · Admin/Dashboard — literal figures presented as live; invented inactivity data.
- [x] C12 · Q2 · both · Audit log — seeded with fabricated entries.
- [~] C13 · Q2 · both · Audit log — auth events not logged; actor stored as a display name; no filter or export.
- [x] C14 · Q2 · both · Members — changing a role does not change the public title.
- [~] C15 · Q2 · both · recovery — no password reset, no re-issue of an invite, no way to add a member without an application.
- [~] C16 · Q1 · super_admin · Today, Finance, Profile, Arena — the system account is treated as a student (dues, mentor, ranks, member card).
- [x] C17 · Q1 · secretary → president · invite — a Secretary can mint an invite for any password-less account whatever its role; links never expire.

**P2**
- [ ] C18 · Q1 · both · Members — no limit on role holders, no second approver, no suspension reason.
- [x] C19 · Q1 · exporters · export route — a state-changing GET with no origin check; includes Site Admin.
- [x] C20 · Q2 · all officers · Roles matrix — rows granted but not implemented.
- [~] C21 · Q3 · both · Members — window.prompt for the reason; Suspend with no confirmation; no search.
- [ ] C22 · Q2 · both · Election — no open/close, nominees or results.
- [~] C23 · Q3 · both · Expenses, Waivers — irreversible single clicks; copy not role-aware; raw user id in the audit line.
- [x] C24 · Q3 · president · Finance — tab called "Verify payments" for a role that cannot verify; shouted read-only sentence.
- [x] C25 · Q2 · both · Applications — same as B4.
- [x] C26 · Q2 · both · Dashboard — same as B11.

**P3**
- [x] C27 · Q3 · both · Admin/Roles — rename to Permissions; drop keys; larger glyphs.
- [x] C28 · Q3 · both · copy — "Only the President can run a rollover"; suspended sign-in message names the wrong officer.
- [~] C29 · Q3 · president · sidebar — officer links below the fold; level card type looks under 14px.

Critic C did not check: phone widths, most screenshots, Google sign-in live, the non-admin pages for these two roles.

## Fix log

`[x]` items are fixed and were re-checked in a signed-in browser capture or by a backend test. Details for partly done and open items:

**Partly done**
- A5: check-in, suggestion and event feedback are now stored and delivered; CV review form removed (no recipient exists).
- A6: nudge, teammate, team-up and duel requests now reach the other person's inbox; group join and alumni/job "Save" are personal lists and say so; admin "nudge mentor" removed.
- A7: sheet builder removed (no sheet storage); completion is now the real share of members who solved each problem.
- A12: name/department/batch edit and change-password added; privacy toggles and the export/delete sentence removed because nothing backed them.
- A13: member number is now a real stored number; hard-coded timeline and badges removed; tag radar still shows sample values until a handle is linked.
- A19: only the holder or an admin can return equipment; still no create/edit; reports are still sample numbers.
- A20: mentor now sees each mentee's latest check-in; no reply box or target editor.
- A21: ballot wording corrected; members still cannot post to Feed/Ideas/Doubts.
- A22: one XP value everywhere, level title no longer reuses a Codeforces rank, streak consistent, onboarding steps all link somewhere; handle not prefilled; revisit queue still static.
- A23: ink colours forced on the paper skin; not re-checked in a screenshot.
- A24: names switch to the body font on phones; not re-checked.
- A26: "XP to level" spacing fixed; grid holes remain.
- A27: per-page browser titles, one verb ("Mark read"), framed not-available page; Community still has 8 tabs; a dev-only hydration warning remains.
- B3: Club fund and Transparency are now labelled as sample figures; not derived from payments yet.
- B7: organisers now see the room code, real checked-in count, registrants per event and written feedback; no event creation or certificates.
- B10: Admin dashboard counts are live; Workspace reports are still sample numbers.
- B12: two-step flow shown clearly, "proposed" is no longer green; waiver still not applied to the invoice.
- B16: label now says member list only, operator account excluded, status column added; no finance export.
- B23: list rows stack on phones; not re-checked for Expenses.
- C5: wording now says nobody is shown how you voted; the vote is still stored against the voter.
- C13: password changes and one-time-link use are now logged; sign-ins are not; no filter or export.
- C15: officers can issue reset/invite links from Admin → Members; no "add member without application" form.
- C16: operator account lands on Admin, has no dues, level card, ballot or purchases; its Profile page still shows a member card.
- C21: Suspend and decisions now ask for confirmation; the reason still uses a browser prompt; no member search.
- C23: decisions now ask for confirmation and copy is role-neutral; expense rejection still has no reason field.
- C29: officer links moved to the top of the sidebar; level card type unchanged.

**Open (not done)**
- B8: needs a dues/invoice table and cash recording.
- B14: needs the ledger connected to approvals.
- B19: left as is: export lives in Admin.
- B21: needs task/meeting tables.
- B25: needs announcement body/audience fields.
- C18: needs seat limits and a second-approver flow.
- C22: needs election open/close and results.

**Removed rather than built** (they claimed to do something and did nothing): Admin → Settings (module toggles, club settings, the two-factor claim), Admin → Rollover, Workspace → Automation, "Remind all defaulters", "Nudge mentor" on the dashboard, notification channel settings, CV review, profile privacy toggles, fabricated audit-log seed rows.

**Backend tests:** 36, all passing (`npm test`).

## Not checked

- Dark theme on any page after these changes.
- Phone width, except Treasurer → Verify payments.
- Clicking through each new button in the browser (reset link, reject with reason, expense request, check-in): these are covered by backend tests, and the pages were captured, but the clicks themselves were not driven in the browser.
- Mentor, CP head and super admin at phone width.
- Google sign-in (no credentials configured).
- The dev-only hydration warning: page not identified.
