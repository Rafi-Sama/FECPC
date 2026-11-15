// Every change a member or officer can make. One entry point, one transaction, one row lock on the acting user.
// This is the only place that decides what a role may DO; the interface merely hides what would be refused here.
import { APPROVAL_THRESHOLD, announcements, candidates, invoices, polls, resources, sheet, shop } from "../lib/appdata.ts";
import { cols, courses, volunteerShifts, wiki } from "../lib/appdata2.ts";
import { events } from "../lib/data.ts";
import { can, canFully, roleName, roles, type Role } from "../lib/permissions.ts";
import { earned } from "../lib/xp.ts";
import { hashPassword, newToken, sha } from "./auth.ts";
import * as data from "./data.ts";
import { Fail, tx, type Db } from "./db.ts";
import { isAdmin, isCommittee, loadState, progress, today, type Progress } from "./state.ts";

type Actor = { id: string; role: Role; name: string; system: boolean };
const person = (a: Actor) => need(!a.system, "This is an operator account, not a member. It cannot do that.");
type In = Record<string, unknown>;
const KEY = /^[\w:.&' /+#-]{1,80}$/;
const text = (v: unknown, min: number, max: number, what: string) => {
  // Plain text only: control characters are dropped, React escapes the rest on output.
  const t = typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  if (t.length < min || t.length > max) throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const key = (v: unknown) => { if (typeof v !== "string" || !KEY.test(v)) throw new Fail(400, "That is not a valid item."); return v; };
const pick = <T extends string>(v: unknown, from: readonly T[], what: string): T => { if (!from.includes(v as T)) throw new Fail(400, `Unknown ${what}.`); return v as T; };
const need = (ok: unknown, why = "Your role cannot do that.") => { if (!ok) throw new Fail(403, why); };
const audit = (c: Db, a: Actor, what: string) => c.query(`insert into audit (who, what) values ($1, $2)`, [a.name, what]);
const tk = (n: number) => "৳" + n.toLocaleString("en");
const flip = (list: string[], id: string, on: boolean) => (on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id));

// What each personal list accepts. Anything else is refused, so a list can never hold an id that earns XP for nothing.
const lists: Record<string, (id: string) => boolean> = {
  solved: (id) => sheet.some((p) => p.id === id),
  done: (id) => resources.some((r) => r.id === id) || wiki.some((w) => "wiki:" + w.id === id),
  lessons: (id) => courses.some((c) => c.lessons.some((_, i) => `${c.id}:${i}` === id)),
  read: (id) => announcements.some((a) => a.id === id) || /^(an:\d{1,9}|n:[\w:.-]{1,70})$/.test(id),
};
// Shared switches: who may flip them. Everything not listed here is a personal preference.
const clubFlag = (k: string, r: Role): boolean | null =>
  k.startsWith("act:") ? isCommittee(r) && data.meetings.some((m) => m.actions.some((x) => x[0] === k.slice(4)))
  : k.startsWith("cd:") ? isCommittee(r)
  : k === "unfrozen" ? !!can(r, "event.publish")
  : null;

async function setClub(c: Db, a: Actor, k: string, value: boolean | string) {
  await c.query(`insert into club (key, value, by) values ($1, $2, $3) on conflict (key) do update set value = excluded.value, by = excluded.by, at = now()`, [k, JSON.stringify(value), a.id]);
}

const handlers: Record<string, (c: Db, a: Actor, p: Progress, i: In) => Promise<string | void>> = {
  async toggle(c, a, p, i) {
    const id = key(i.id), list = String(i.list), now = (has: boolean) => (typeof i.on === "boolean" ? i.on : !has);
    if (lists[list]) {
      need(lists[list](id), "That item does not exist.");
      const k = list as "solved" | "done" | "lessons" | "read";
      p[k] = flip(p[k], id, now(p[k].includes(id)));
    } else if (list === "reg") {
      need(events.some((e) => e.id === id), "That event does not exist.");
      const has = (await c.query(`select 1 from registrations where user_id = $1 and event_id = $2`, [a.id, id])).rowCount! > 0;
      if (now(has)) await c.query(`insert into registrations values ($1, $2) on conflict do nothing`, [a.id, id]);
      else await c.query(`delete from registrations where user_id = $1 and event_id = $2`, [a.id, id]);
    } else if (list === "kudos") {
      need(!id.startsWith("shop:"), "That is not something you can cheer.");
      const has = (await c.query(`select 1 from reactions where user_id = $1 and target = $2`, [a.id, id])).rowCount! > 0;
      if (now(has)) await c.query(`insert into reactions values ($1, $2) on conflict do nothing`, [a.id, id]);
      else await c.query(`delete from reactions where user_id = $1 and target = $2`, [a.id, id]);
    } else if (list === "present") { // volunteer shifts; class attendance needs the room code (see `attend`)
      const shift = volunteerShifts.find((v) => "vol:" + v[0] === id);
      need(shift, "That shift does not exist.");
      await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [id]); // two people cannot take the last place
      const has = (await c.query(`select 1 from attendance where user_id = $1 and key = $2`, [a.id, id])).rowCount! > 0;
      if (!now(has)) return void (await c.query(`delete from attendance where user_id = $1 and key = $2`, [a.id, id]));
      const taken = (await c.query(`select count(*)::int n from attendance where key = $1`, [id])).rows[0].n;
      if (!has && shift![3] + taken >= shift![2]) throw new Fail(409, "That shift just filled up.");
      await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, id]);
    } else throw new Fail(400, "Unknown list.");
  },
  async readAll(c, a, p) { p.read = [...new Set([...p.read, ...(await loadState(c, a.id))!.inbox.map((n) => n.id)])].slice(-500); },
  async checkin(_c, _a, p) { p.checkin = today(); },
  async flag(c, a, p, i) {
    const k = key(i.key);
    if (typeof i.on !== "boolean") throw new Fail(400, "Expected on or off.");
    need(!/^(susp|post|role|mod|rule):|^(remind|risk)/.test(k), "That switch does not exist.");
    const shared = clubFlag(k, a.role);
    if (shared !== null) {
      need(shared);
      await setClub(c, a, "flag:" + k, i.on);
      if (k === "unfrozen") await audit(c, a, i.on ? "unfroze the contest scoreboard" : "refroze the contest scoreboard");
      return;
    }
    if (k.startsWith("nudge")) need(can(a.role, "mentees.view"));
    if (!(k in p.flags) && Object.keys(p.flags).length >= 300) throw new Fail(400, "Too many saved preferences.");
    p.flags[k] = i.on;
  },
  async kv(c, a, p, i) {
    const k = key(i.key), v = text(i.value, 0, 200, "Value");
    if (k.startsWith("task:")) {
      need(isCommittee(a.role)); need(data.tasks.some((t) => t.id === k.slice(5)), "That task does not exist.");
      return setClub(c, a, "kv:" + k, pick(v, cols, "column"));
    }
    if (k.startsWith("inv:")) {
      need(isCommittee(a.role));
      const item = data.inventory.find((x) => x[1] === k.slice(4));
      need(item, "That item does not exist.");
      const holder = (await c.query(`select value from club where key = $1`, ["kv:" + k])).rows[0]?.value || item![2];
      if (v ? holder : holder !== a.id && !isAdmin(a.role)) throw new Fail(409, v ? "That item is already checked out." : "Only the person holding it, or an admin, can return it.");
      await setClub(c, a, "kv:" + k, v ? a.id : "");
      return void (await audit(c, a, `${v ? "checked out" : "returned"} ${item![0]}`));
    }
    need(!k.startsWith("role:"), "Use the role action for that.");
    if (k.startsWith("conf:")) { need(sheet.some((x) => x.id === k.slice(5)), "That problem does not exist."); pick(v, ["shaky", "ok", "solid"], "confidence"); }
    if (k === "rate") pick(v, ["1", "2", "3", "4", "5"], "rating");
    if (k === "fantasy") {
      const ids = [...new Set(v.split(",").filter(Boolean))];
      need(ids.length <= 3, "Pick at most three members.");
      const n = (await c.query(`select count(*)::int n from users where id = any($1)`, [ids])).rows[0].n;
      need(n === ids.length, "One of those members does not exist.");
      return void (p.kv[k] = ids.join(","));
    }
    if (!(k in p.kv) && Object.keys(p.kv).length >= 200) throw new Fail(400, "Too many saved preferences.");
    p.kv[k] = v;
  },
  async vote(c, a, _p, i) {
    person(a);
    const poll = key(i.poll), option = text(i.option, 1, 80, "Option");
    const once = poll === "election" || poll === "fb:freshers"; // a ballot and a rating cannot be changed
    if (poll === "election") need(candidates.some((x) => x.id === option), "That is not a candidate.");
    else if (poll === "fb:freshers") pick(option, ["1", "2", "3", "4", "5"], "rating");
    else need(polls.find((x) => x.id === poll)?.opts.some((o) => o[0] === option), "That is not an option in this poll.");
    const r = await c.query(`insert into votes values ($1, $2, $3) on conflict (user_id, poll_id) do ${once ? "nothing" : "update set option = excluded.option"}`, [a.id, poll, option]);
    if (once && !r.rowCount) throw new Fail(409, "You have already voted. A ballot cannot be changed.");
    if (poll === "election") await audit(c, a, "cast a ballot in the committee election"); // who voted is logged; for whom is not
  },
  async quiz(_c, _a, p, i) {
    const answers = data.quizAnswers[String(i.course)];
    need(answers, "That quiz does not exist.");
    if (!Array.isArray(i.picks) || i.picks.length !== answers.length) throw new Fail(400, "Answer every question.");
    p.quiz[String(i.course)] = answers.filter((ans, n) => (i.picks as unknown[])[n] === ans).length;
  },
  async quizReset(_c, _a, p, i) { delete p.quiz[String(i.course)]; },
  async handle(c, a, p, i) {
    const h = typeof i.value === "string" ? i.value.trim() : "";
    if (h && !/^[\w.-]{3,24}$/.test(h)) throw new Fail(400, "That is not a valid Codeforces handle.");
    p.handle = h;
    if (h) await audit(c, a, `linked Codeforces handle ${h}`);
  },
  async pay(c, a, _p, i) {
    person(a);
    const inv = invoices.find((x) => x.id === i.invoice);
    need(inv, "That invoice does not exist.");
    if (inv!.event) need((await c.query(`select 1 from registrations where user_id = $1 and event_id = $2`, [a.id, inv!.event])).rowCount, "That invoice is only for members registered for the event.");
    const via = pick(i.via, ["bKash", "Nagad", "Rocket"] as const, "wallet"), trx = String(i.trx ?? "").trim().toUpperCase(), sender = String(i.sender ?? "").trim();
    if (!/^[A-Z0-9]{8,12}$/.test(trx)) throw new Fail(400, "A transaction ID is 8 to 12 letters and digits. Copy it from the wallet SMS.");
    if (!/^01\d{9}$/.test(sender)) throw new Fail(400, "Enter the 11-digit number the money was sent from.");
    // The two unique indexes are the rule; checking first would let two simultaneous submissions both pass.
    const r = await c.query(`insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing returning id`, [a.id, inv!.id, inv!.label, inv!.amount, via, trx, sender]);
    if (!r.rows[0]) {
      const mine = (await c.query(`select 1 from payments where user_id = $1 and invoice_id = $2 and status <> 'rejected'`, [a.id, inv!.id])).rowCount;
      throw new Fail(409, mine ? "You have already submitted a payment for this invoice." : "That transaction ID has already been used. Check the SMS from your wallet and enter the ID exactly.");
    }
    await audit(c, a, `submitted payment PAY-${r.rows[0].id} for ${inv!.id} (${via})`);
  },
  async attend(c, a, _p, i) {
    if (String(i.code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase() !== data.ATTENDANCE.code) throw new Fail(400, "That code is wrong or has expired. Read it off the projector again.");
    await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, data.ATTENDANCE.event]);
  },
  async redeem(c, a, p, i) {
    person(a);
    const item = shop.find((x) => x[0] === i.item);
    need(item, "That reward does not exist.");
    if (p.shop.includes(item![0])) throw new Fail(409, "You have already redeemed that.");
    const st = (await loadState(c, a.id))!; // read inside the transaction, under the row lock, so XP cannot be spent twice
    if (st.me.xp + earned(st.s) - st.s.spent < item![1]) throw new Fail(409, "You do not have enough XP for that yet.");
    p.shop.push(item![0]); p.spent += item![1];
    await audit(c, a, `redeemed "${item![0]}" for ${item![1]} XP`);
  },
  async announce(c, a, _p, i) {
    need(can(a.role, "announce.post"));
    const title = text(i.title, 3, 140, "The title");
    // A scoped grant (mentor) reaches that mentor's own mentees only; the audience is decided here, never by the caller.
    const audience = can(a.role, "announce.post") === "scope" ? "mentees:" + a.id : "all";
    await c.query(`insert into announcements (user_id, title, audience) values ($1, $2, $3)`, [a.id, title, audience]);
    await audit(c, a, `posted announcement "${title}"${audience === "all" ? "" : " to their mentees"}`);
  },
  async send(c, a, _p, i) {
    const kind = pick(i.kind, ["checkin", "suggest", "feedback"] as const, "message");
    const body = text(i.body, kind === "feedback" ? 1 : 3, 1000, "Your message");
    if (kind === "checkin") {
      const mentor = (await c.query(`select mentor_id from users where id = $1`, [a.id])).rows[0]?.mentor_id;
      need(mentor, "You do not have a mentor yet. Ask the CP Head to assign one.");
      return void (await c.query(`insert into messages (kind, user_id, to_user, body) values ('checkin', $1, $2, $3)`, [a.id, mentor, body]));
    }
    // A suggestion is anonymous for real: the sender is not written anywhere, not even to the audit log.
    await c.query(`insert into messages (kind, user_id, body) values ($1, $2, $3)`, [kind, kind === "suggest" ? null : a.id, body]);
  },
  async ping(c, a, _p, i) {
    const kind = pick(i.kind, ["invite", "duel", "nudge", "team"] as const, "request"), to = key(i.to), ref = typeof i.ref === "string" && KEY.test(i.ref) ? i.ref : "";
    need(to !== a.id, "You cannot send that to yourself.");
    const t = (await c.query(`select mentor_id from users where id = $1 and not suspended and not system`, [to])).rows[0];
    need(t, "That member does not exist.");
    if (kind === "nudge") { const lvl = can(a.role, "mentees.view"); need(lvl); need(lvl === true || t.mentor_id === a.id, "You can only nudge your own mentees."); }
    await c.query(`insert into pings (from_user, to_user, kind, ref) values ($1, $2, $3, $4) on conflict do nothing`, [a.id, to, kind, ref]);
  },
  async expense(c, a, _p, i) {
    need(isCommittee(a.role), "Only committee members file expense requests.");
    const amount = Number(i.amount), what = text(i.what, 3, 140, "The description"), event = text(i.event, 0, 80, "The event");
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) throw new Fail(400, "Enter the amount in whole taka, up to 1,000,000.");
    const r = await c.query(`insert into expenses (by, what, amount, event) values ($1, $2, $3, $4) returning id`, [a.id, what, amount, event]);
    await audit(c, a, `requested expense EXP-${r.rows[0].id} (${tk(amount)}): ${what}`);
  },
  async profile(c, a, _p, i) {
    const name = text(i.name, 2, 80, "Your name"), dept = text(i.dept, 2, 20, "Department"), batch = Number(i.batch);
    if (!Number.isInteger(batch) || batch < 0 || batch > 99) throw new Fail(400, "Batch is a two-digit number, like 24.");
    await c.query(`update users set name = $2, dept = $3, batch = $4 where id = $1`, [a.id, name, dept, batch]);
    if (name !== a.name) await audit(c, a, `changed their name to ${name}`);
  },
  async decide(c, a, _p, i) {
    const kind = pick(i.kind, ["payment", "expense", "waiver", "application"] as const, "decision"), id = key(i.id), to = String(i.to);
    if (kind === "payment") {
      need(canFully(a.role, "payments.verify"), "Only the Treasurer verifies payments.");
      pick(to, ["verified", "rejected"], "decision");
      const n = /^PAY-(\d{1,9})$/.exec(id);
      need(n, "That payment does not exist.");
      const note = to === "rejected" ? text(i.reason, 3, 200, "The reason for rejecting") : null; // the member is shown this
      const r = await c.query(`update payments set status = $2, decided_by = $3, note = $4 where id = $1 and status = 'pending' and user_id <> $3 returning amount, via`, [+n![1], to, a.id, note]);
      if (!r.rows[0]) throw new Fail(409, "That payment is already decided, or it is your own: someone else must verify it.");
      return void (await audit(c, a, `${to} payment ${id} (${tk(r.rows[0].amount)}, ${r.rows[0].via})${note ? `: ${note}` : ""}`));
    }
    if (kind === "application") {
      need(can(a.role, "application.approve"));
      pick(to, ["accepted", "declined"], "decision");
      need(/^\d{1,9}$/.test(id), "That application does not exist.");
      const app = (await c.query(`update applications set status = $2 where id = $1 and status = 'pending' returning name, email, dept, batch, cf`, [+id, to])).rows[0];
      if (!app) throw new Fail(409, "That application has already been decided.");
      if (to === "declined") return void (await audit(c, a, `declined applicant ${app.name}`));
      const slug = app.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "member", token = newToken();
      const made = await c.query(
        `insert into users (id, email, invite_hash, invite_expires, name, handle, batch, dept) select $1 || case when exists (select 1 from users where id = $1) then '_' || $2 else '' end, $3, $4, now() + interval '7 days', $5, $6, $7, $8
         where not exists (select 1 from users where email = $3) returning id`, [slug, id, app.email, sha(token), app.name, app.cf, app.batch, app.dept]);
      if (!made.rows[0]) throw new Fail(409, "A member already uses that email address.");
      await audit(c, a, `accepted applicant ${app.name}; account created`);
      return `Account created for ${app.name}. Send them this link to set a password. It works once and expires in 7 days: /login?invite=${token}`;
    }
    // Expenses and waivers: two-person rules. Nobody decides their own request.
    if (kind === "expense") {
      const n = /^EXP-(\d{1,9})$/.exec(id), lvl = can(a.role, "expense.approve");
      need(lvl); need(n, "That expense does not exist.");
      const x = (await c.query(`select by, amount, status, decided_by from expenses where id = $1 for update`, [+n![1]])).rows[0]; // the lock makes two simultaneous decisions take turns
      need(x, "That expense does not exist."); need(x.by !== a.id, "You cannot decide your own expense request.");
      const big = x.amount > APPROVAL_THRESHOLD;
      if (x.status !== "pending" && !(x.status === "sent to President" && lvl === true)) throw new Fail(409, "That expense has already been decided.");
      // Above the threshold two different people must agree: one passes it up, another with full authority decides. Nobody skips the first step.
      if (big && x.status === "pending") pick(to, ["sent to President"], "decision: a large expense is first passed up, then decided by a second officer");
      else pick(to, ["approved", "rejected"], "decision");
      if (big && x.status === "sent to President") need(x.decided_by !== a.id, "A second officer has to make the final decision on an expense you passed up.");
      await c.query(`update expenses set status = $2, decided_by = $3 where id = $1`, [+n![1], to, a.id]);
      return void (await audit(c, a, to === "sent to President" ? `proposed expense ${id} to the President` : `${to} expense ${id} (${tk(x.amount)})`));
    }
    await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [kind + id]);
    const cur: string | undefined = (await c.query(`select status from decisions where kind = $1 and id = $2`, [kind, id])).rows[0]?.status;
    const save = async (line: string) => { await c.query(`insert into decisions values ($1, $2, $3, $4) on conflict (kind, id) do update set status = excluded.status, by = excluded.by, at = now()`, [kind, id, to, a.id]); await audit(c, a, line); };
    const w = data.waivers.find((e) => e.id === id), lvl = can(a.role, "dues.waive");
    need(w, "That waiver does not exist."); need(lvl); need(w!.who !== a.id, "You cannot decide a waiver for yourself.");
    // Two people: one proposes, a different one with full authority decides.
    const row = (await c.query(`select by from decisions where kind = 'waiver' and id = $1`, [id])).rows[0];
    if (cur && !(cur === "proposed" && lvl === true)) throw new Fail(409, "That waiver has already been decided.");
    pick(to, cur === "proposed" ? ["waived", "rejected"] : ["proposed"], cur ? "decision" : "decision: a waiver is first proposed, then decided by a second officer");
    if (cur === "proposed") need(row.by !== a.id, "A second officer has to decide a waiver you proposed.");
    return save(to === "proposed" ? `proposed waiver ${id} to the President` : `${to} waiver ${id}: ${tk(w!.amount)}, ${w!.what} (reason: ${w!.reason})`);
  },
  async role(c, a, _p, i) {
    need(canFully(a.role, "roles.assign"));
    const role = pick(i.role, roles, "role"), reason = text(i.reason, 3, 200, "The reason"), user = key(i.user);
    need(user !== a.id, "You cannot change your own role.");
    need(role !== "super_admin" || a.role === "super_admin", "Only a Super Admin can grant Super Admin.");
    // The public title follows the role, so a demoted officer does not keep the title and a promoted one gets it.
    const r = await c.query(`update users set role = $2, title = $4 where id = $1 and not system and (role <> 'super_admin' or $3) returning name`, [user, role, a.role === "super_admin", role === "member" ? null : roleName[role]]);
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or is a Super Admin.");
    await audit(c, a, `assigned role ${roleName[role]} to ${r.rows[0].name} (reason: ${reason})`);
  },
  async suspend(c, a, _p, i) {
    need(canFully(a.role, "roles.assign"));
    const user = key(i.user);
    if (typeof i.on !== "boolean") throw new Fail(400, "Expected on or off.");
    need(user !== a.id, "You cannot suspend yourself.");
    const r = await c.query(`update users set suspended = $2 where id = $1 and (role <> 'super_admin' or $3) returning name`, [user, i.on, a.role === "super_admin"]);
    if (!r.rows[0]) throw new Fail(404, "That member does not exist, or is a Super Admin.");
    if (i.on) await c.query(`delete from sessions where user_id = $1`, [user]); // signed out everywhere, immediately
    await audit(c, a, `${i.on ? "suspended" : "reinstated"} ${r.rows[0].name}`);
  },
  // A fresh one-time link: the first password for someone who never signed in, or a reset for someone locked out.
  async invite(c, a, _p, i) {
    const user = key(i.user), token = newToken();
    need(user !== a.id, "Change your own password from your profile.");
    const t = (await c.query(`select role, name, pass_hash is not null as joined from users where id = $1 and not suspended for update`, [user])).rows[0];
    need(t, "That member does not exist.");
    // Whoever can take over an account must already outrank it: officers' accounts need the role-assigning authority, a Super Admin's needs a Super Admin.
    need(t.role === "member" ? can(a.role, "application.approve") || canFully(a.role, "roles.assign") : t.role === "super_admin" ? a.role === "super_admin" : canFully(a.role, "roles.assign"));
    await c.query(`update users set invite_hash = $2, invite_expires = now() + interval '7 days' where id = $1`, [user, sha(token)]);
    await audit(c, a, `issued a ${t.joined ? "password reset" : "new invite"} link for ${t.name}`);
    return `${t.joined ? "Password reset" : "Invite"} link for ${t.name}. It works once and expires in 7 days: /login?invite=${token}`;
  },
};
export const actionTypes = Object.keys(handlers);

/** Runs one action for `userId`. Throws Fail for anything the caller got wrong; returns an optional one-time notice. */
export async function act(userId: string, input: unknown): Promise<string | void> {
  const i = (input && typeof input === "object" ? input : {}) as In, run = handlers[String(i.type)];
  if (!run || !Object.hasOwn(handlers, String(i.type))) throw new Fail(400, "Unknown action.");
  return tx(async (c) => {
    const u = (await c.query(`select id, role, name, system, progress from users where id = $1 and not suspended for update`, [userId])).rows[0];
    if (!u) throw new Fail(401, "Sign in again.");
    const p = progress(u.progress), before = JSON.stringify(p);
    const info = await run(c, { id: u.id, role: u.role, name: u.name, system: u.system }, p, i);
    const after = JSON.stringify(p);
    if (after !== before) await c.query(`update users set progress = $2 where id = $1`, [userId, after]);
    return info;
  });
}

/** The public join form. Anyone can call it, so it is strict about what it accepts. */
export async function apply(db: Db, i: In) {
  const email = text(i.email, 5, 200, "Email").toLowerCase(), batch = Number(i.batch);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Fail(400, "Enter a valid email address.");
  if (!Number.isInteger(batch) || batch < 0 || batch > 99) throw new Fail(400, "Batch is a two-digit number, like 24.");
  const cf = typeof i.cf === "string" && /^[\w.-]{3,24}$/.test(i.cf.trim()) ? i.cf.trim() : "";
  const row = [text(i.name, 2, 80, "Your name"), text(i.sid, 3, 40, "Student ID"), text(i.dept, 2, 20, "Department"), batch, email, cf, text(i.track, 2, 10, "Track"), text(i.why, 10, 1000, "Your answer")];
  const taken = (await db.query(`select 1 from users where email = $1`, [email])).rowCount;
  const r = taken ? { rowCount: 0 } : await db.query(`insert into applications (name, sid, dept, batch, email, cf, track, why) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing`, row);
  if (!r.rowCount) throw new Fail(409, "An application or an account already exists for that email address.");
}

/** Member export for officers. The download itself is the audited event. */
export async function exportMembers(userId: string) {
  return tx(async (c) => {
    const u = (await c.query(`select role, name from users where id = $1 and not suspended`, [userId])).rows[0];
    if (!u || !can(u.role, "data.export")) throw new Fail(403, "Your role cannot export data.");
    await audit(c, { id: userId, role: u.role, name: u.name, system: false }, "exported member data (CSV)");
    const rows = (await c.query(`select name, handle, batch, dept, rating, solved, case when suspended then 'suspended' else 'active' end as status from users where not system order by name`)).rows;
    // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
    const cell = (v: unknown) => { const t = String(v); return `"${(/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`; };
    return "name,handle,batch,dept,rating,solved,status\n" + rows.map((r) => [r.name, r.handle, r.batch, r.dept, r.rating, r.solved, r.status].map(cell).join(",")).join("\n") + "\n";
  });
}
