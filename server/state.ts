// Builds everything one member's screens need, in one query (two for officers).
// This is the only place that decides what a role may SEE: a dataset the role has no capability for is never sent.
import { myInvoices } from "../lib/appdata.ts";
import { can, canFully, isAdmin, isCommittee, type Role } from "../lib/permissions.ts";
import type { AppState, Expense, Office, Roster, S } from "../lib/state.ts";
import * as data from "./data.ts";
import type { Db } from "./db.ts";

export const TZ = "Asia/Dhaka";
export const today = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now); // YYYY-MM-DD
export { isAdmin, isCommittee };
/** The sponsor ledger needs a finance capability. */
export const seesMoney = (r: Role) => !!(can(r, "payments.verify") || can(r, "expense.approve"));

/** The member's own lists and preferences, as stored in users.progress. Unknown or missing fields fall back to empty. */
export type Progress = { handle: string; base: { solved: number; done: number }; solved: string[]; done: string[]; lessons: string[]; read: string[]; shop: string[]; quiz: Record<string, number>; flags: Record<string, boolean>; kv: Record<string, string>; spent: number; checkin: string };
export function progress(raw: Partial<Progress> | null): Progress {
  const p = raw ?? {};
  return { handle: p.handle ?? "", base: { solved: p.base?.solved ?? 0, done: p.base?.done ?? 0 }, solved: p.solved ?? [], done: p.done ?? [], lessons: p.lessons ?? [], read: p.read ?? [], shop: p.shop ?? [], quiz: p.quiz ?? {}, flags: p.flags ?? {}, kv: p.kv ?? {}, spent: p.spent ?? 0, checkin: p.checkin ?? "" };
}

const ROSTER = `json_build_object('id', id, 'no', member_no, 'name', name, 'handle', handle, 'batch', batch, 'dept', dept, 'squad', squad, 'role', title, 'rating', rating, 'peak', peak,
  'solved', solved, 'streak', streak, 'helper', helper, 'skills', skills, 'xp', solved * 12 + streak * 30 + helper * 8, 'roleKey', role, 'suspended', suspended, 'system', system, 'mentorId', mentor_id, 'pending', pass_hash is null and google_sub is null)`;
const EXPENSE = `json_build_object('id', 'EXP-' || e.id, 'by', e.by, 'name', w.name, 'what', e.what, 'amount', e.amount, 'event', e.event, 'status', e.status)`;
const MINE = `
select u.email, u.progress, u.mentor_id, (select name from users where id = u.mentor_id) as mentor_name, (select ${ROSTER} from users m where m.id = u.id) as me,
  (select coalesce(json_agg(event_id), '[]') from registrations where user_id = $1) as reg,
  (select coalesce(json_agg(key), '[]') from attendance where user_id = $1) as present,
  (select coalesce(json_object_agg(poll_id, option), '{}') from votes where user_id = $1) as votes,
  (select coalesce(json_agg(target), '[]') from reactions where user_id = $1) as kudos,
  (select coalesce(json_object_agg(invoice_id, j), '{}') from (select distinct on (invoice_id) invoice_id,
      json_build_object('trx', trx, 'via', via, 'status', status, 'id', id, 'amount', amount, 'label', label, 'at', created_at, 'note', note) j
    from payments where user_id = $1 order by invoice_id, (status <> 'rejected') desc, id desc) x) as pay,
  (select count(*)::int from announcements where user_id = $1) as posts,
  (select coalesce(json_agg(to_user || ':' || kind || ':' || ref), '[]') from pings where from_user = $1) as sent,
  exists (select 1 from messages where kind = 'checkin' and user_id = $1) as checked_in,
  (select coalesce(json_agg(json_build_object('id', p.from_user || ':' || p.kind || ':' || p.ref, 'kind', p.kind, 'from', f.name) order by p.at desc), '[]') from pings p join users f on f.id = p.from_user where p.to_user = $1) as pings,
  (select coalesce(json_agg(json_build_object('id', m.id, 'from', m.user_id, 'name', w.name, 'body', m.body, 'at', m.created_at) order by m.id desc), '[]')
     from (select * from messages where kind = 'checkin' and to_user = $1 order by id desc limit 100) m join users w on w.id = m.user_id) as checkins,
  (select coalesce(json_agg(${EXPENSE} order by e.id desc), '[]') from expenses e join users w on w.id = e.by where e.by = $1) as my_exp,
  (select coalesce(json_object_agg(event_id, n), '{}') from (select event_id, count(*)::int n from registrations group by 1) x) as c_reg,
  (select coalesce(json_object_agg(key, n), '{}') from (select key, count(*)::int n from attendance where key like 'vol:%' group by 1) x) as c_vol,
  (select coalesce(json_agg(json_build_array(poll_id, option, n)), '[]') from (select poll_id, option, count(*)::int n from votes where poll_id not in ('election') and poll_id not like 'fb:%' group by 1, 2) x) as c_votes,
  (select coalesce(json_object_agg(target, n), '{}') from (select target, count(*)::int n from reactions group by 1) x) as c_kudos,
  (select coalesce(json_object_agg(pid, n), '{}') from (select pid, count(*)::int n from users, jsonb_array_elements_text(coalesce(progress -> 'solved', '[]')) pid where not system and not suspended group by 1) x) as c_solved,
  (select coalesce(json_agg(json_build_object('id', 'an:' || a.id, 'title', a.title, 'by', w.name, 'at', a.created_at, 'mentees', a.audience <> 'all') order by a.id desc), '[]')
     from (select * from announcements where audience = 'all' or user_id = $1 or audience = 'mentees:' || coalesce(u.mentor_id, '') order by id desc limit 50) a join users w on w.id = a.user_id) as news,
  (select coalesce(json_agg(${ROSTER} order by rating desc, id), '[]') from users) as members,
  (select coalesce(json_object_agg(key, value), '{}') from club) as club
from users u where u.id = $1 and not u.suspended`;
const OFFICE = `
select
  case when $1 then (select coalesce(json_agg(json_build_object('id', 'PAY-' || p.id, 'name', u.name, 'label', p.label, 'amount', p.amount, 'via', p.via, 'trx', p.trx,
      'sender', left(p.sender, 3) || '••••' || right(p.sender, 4), 'status', p.status, 'mine', p.user_id = $8, 'at', p.created_at) order by (p.status <> 'pending'), case when p.status = 'pending' then p.id end, p.id desc), '[]')
    from (select * from payments order by (status <> 'pending'), id desc limit 500) p join users u on u.id = p.user_id) end as queue,
  case when $2 then (select coalesce(json_agg(${EXPENSE} order by e.id desc), '[]') from (select * from expenses order by id desc limit 200) e join users w on w.id = e.by) end as expenses,
  case when $3 then (select coalesce(json_object_agg(id, status), '{}') from decisions where kind = 'waiver') end as waived,
  case when $4 then (select coalesce(json_agg(json_build_object('id', id::text, 'name', name, 'dept', dept, 'batch', batch, 'quiz', quiz, 'src', src, 'status', status, 'email', email, 'sid', sid, 'cf', cf, 'track', track, 'why', why) order by id desc), '[]')
    from (select * from applications order by id desc limit 200) a) end as apps,
  case when $5 then (select coalesce(json_agg(json_build_object('t', to_char(at at time zone '${TZ}', 'YYYY-MM-DD HH24:MI'), 'who', who, 'what', what) order by id desc), '[]')
    from (select * from audit order by id desc limit 200) a) end as log,
  case when $6 then (select coalesce(json_agg(json_build_object('body', body, 'at', created_at) order by id desc), '[]') from (select * from messages where kind = 'suggest' order by id desc limit 100) m) end as suggestions,
  case when $7 then (select coalesce(json_agg(json_build_object('body', body, 'at', created_at) order by id desc), '[]') from (select * from messages where kind = 'feedback' order by id desc limit 100) m) end as feedback,
  case when $7 then (select coalesce(json_object_agg(event_id, names), '{}') from (select r.event_id, json_agg(u.name order by u.name) names from registrations r join users u on u.id = r.user_id group by 1) x) end as registrants,
  case when $7 then (select coalesce(json_object_agg(key, n), '{}') from (select key, count(*)::int n from attendance where key not like 'vol:%' group by 1) x) end as arrived`;

type Raw = Roster & { system: boolean; mentorId: string | null; roleKey: Role; suspended: boolean; pending: boolean };

/** Everything `userId` may see, or null when the account is gone or suspended. */
export async function loadState(db: Db, userId: string): Promise<AppState | null> {
  const row = (await db.query(MINE, [userId])).rows[0];
  if (!row) return null;
  const raw = row.me as Raw, role = raw.roleKey, p = progress(row.progress), committee = isCommittee(role), admin = isAdmin(role);
  const caps = { queue: !!can(role, "payments.verify"), exp: !!can(role, "expense.approve"), waive: !!can(role, "dues.waive"), apps: !!can(role, "application.approve"), log: !!can(role, "audit.view"), suggest: admin, feedback: !!can(role, "event.publish") };
  const off = Object.values(caps).some(Boolean) ? (await db.query(OFFICE, [...Object.values(caps), userId])).rows[0] : {};

  const flags = { ...p.flags }, kv = { ...p.kv };
  for (const [k, v] of Object.entries(row.club as Record<string, unknown>)) {
    const [kind, key] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
    if (!committee && !(kind === "flag" && (key === "unfrozen" || key.startsWith("mod:")))) continue; // members see only what changes their own screens
    if (kind === "flag") flags[key] = v === true; else kv[key] = String(v);
  }
  const expenses: Expense[] = off.expenses ?? [], decided = (list: Expense[]) => Object.fromEntries(list.filter((e) => e.status !== "pending").map((e) => [e.id, e.status]));
  const s: S = {
    role, handle: p.handle, base: p.base, solved: p.solved, done: p.done, lessons: p.lessons, read: p.read, quiz: p.quiz, spent: p.spent, checkin: p.checkin === today(),
    kudos: [...row.kudos, ...p.shop.map((x) => "shop:" + x)], reg: row.reg, present: row.present, votes: row.votes, pay: row.pay, posts: row.posts, sent: row.checked_in ? [...row.sent, "checkin"] : row.sent, flags, kv,
    queue: Object.fromEntries((off.queue ?? []).map((q: { id: string; status: string }) => [q.id, q.status])),
    exp: { ...decided(expenses), ...(off.waived ?? {}) }, apps: Object.fromEntries((off.apps ?? []).map((a: { id: string; status: string }) => [a.id, a.status])), log: off.log ?? [],
  };

  // The roster everyone gets: people only, no account-management fields. Officers who manage accounts get those too.
  const everyone = row.members as Raw[];
  // The operator account is listed only for a Super Admin, who is the only one able to act on it.
  const members: Roster[] = everyone.filter((m) => (admin ? !m.system || role === "super_admin" : !m.system && !m.suspended)).map(({ system: _s, mentorId: _m, roleKey, suspended, pending, ...m }) => (admin ? { ...m, roleKey, suspended, pending } : m));
  const { mentorId: _m, pending: _p, ...me } = raw;

  const office: Office = {};
  if (caps.queue) office.queue = off.queue;
  if (seesMoney(role)) office.fund = { accounts: [...data.accounts], ledger: data.ledger, budgets: [...data.budgets], cashflow: data.cashflow };
  if (caps.exp) office.expenses = expenses;
  if (caps.waive) office.waivers = data.waivers;
  const view = can(role, "mentees.view");
  if (view) {
    // A mentor ("scope") gets only the members assigned to them; the CP Head and above get everyone who has a mentor.
    const mine = new Set(everyone.filter((m) => (view === "scope" ? m.mentorId === userId : m.mentorId)).map((m) => m.id));
    const last = new Map<string, { body: string; at: string }>();
    for (const c of [...row.checkins].reverse() as { from: string; body: string; at: string }[]) last.set(c.from, { body: c.body, at: c.at });
    office.mentees = data.mentees.filter((m) => mine.has(m.id)).map((m) => ({ ...m, checkin: last.get(m.id) }));
  }
  if (caps.apps) office.applications = off.apps;
  if (caps.suggest) office.suggestions = off.suggestions;
  if (caps.feedback) { office.feedback = off.feedback; office.events = { code: data.ATTENDANCE.code, event: data.ATTENDANCE.event, arrived: off.arrived, registrants: off.registrants }; }
  if (committee) office.ops = { tasks: data.tasks, meetings: data.meetings, vault: data.vault, inventory: data.inventory, sponsors: seesMoney(role) ? data.sponsors : undefined, reports: data.reports };

  // The inbox is derived from real records, so it can never claim something that did not happen.
  const inbox: AppState["inbox"] = [];
  for (const inv of raw.system ? [] : myInvoices(row.reg)) {
    const pay = row.pay[inv.id];
    if (!pay) inbox.push({ id: `n:due:${inv.id}`, cat: "Finance", text: `${inv.label}: ৳${inv.amount} is due on ${inv.due}`, href: "/app/finance" });
    else if (pay.status === "rejected") inbox.push({ id: `n:rej:${pay.id}`, cat: "Finance", text: `Your payment for "${inv.label}" was rejected${pay.note ? `: ${pay.note}` : ""}. Submit it again.`, href: "/app/finance" });
    else if (pay.status === "verified") inbox.push({ id: `n:paid:${pay.id}`, cat: "Finance", text: `Your payment for "${inv.label}" was verified.`, href: "/app/finance" });
  }
  for (const n of row.news as AppState["news"]) inbox.push({ id: n.id, cat: "Announcement", text: `${n.by}: ${n.title}`, href: "/app/community" });
  const ping = { invite: "invited you to their ICPC team", duel: "challenged you to a duel", nudge: "nudged you: solve something today", team: "wants to team up with you" } as Record<string, string>;
  for (const g of row.pings as { id: string; kind: string; from: string }[]) inbox.push({ id: `n:ping:${g.id}`, cat: "Social", text: `${g.from} ${ping[g.kind]}`, href: g.kind === "duel" ? "/app/arena" : g.kind === "nudge" ? "/app/sheets" : "/app/teams" });
  for (const c of row.checkins as { id: number; name: string }[]) inbox.push({ id: `n:msg:${c.id}`, cat: "Mentor", text: `${c.name} sent a weekly check-in`, href: "/app/learn" });
  const waiting = (off.queue ?? []).filter((q: { status: string }) => q.status === "pending");
  if (canFully(role, "payments.verify") && waiting.length) inbox.push({ id: `n:queue:${waiting[0].id}`, cat: "Finance", text: `${waiting.length} payment${waiting.length > 1 ? "s are" : " is"} waiting for verification`, href: "/app/finance" });
  const mineToDecide = expenses.filter((e) => e.by !== userId && (e.status === "sent to President" ? can(role, "expense.approve") === true : e.status === "pending"));
  if (mineToDecide.length) inbox.push({ id: `n:exp:${mineToDecide[0].id}`, cat: "Finance", text: `${mineToDecide.length} expense request${mineToDecide.length > 1 ? "s need" : " needs"} a decision`, href: "/app/finance" });
  const applied = (off.apps ?? []).filter((a: { status: string }) => a.status === "pending");
  if (applied.length) inbox.push({ id: `n:app:${applied[0].id}`, cat: "Admin", text: `${applied.length} application${applied.length > 1 ? "s" : ""} to review`, href: "/app/admin" });

  const votes: AppState["counts"]["votes"] = {};
  for (const [poll, opt, n] of row.c_votes as [string, string, number][]) (votes[poll] ??= {})[opt] = n;
  return {
    me: { ...me, email: row.email, mentor: row.mentor_name }, s, members, counts: { reg: row.c_reg, vol: row.c_vol, kudos: row.c_kudos, votes, solved: row.c_solved },
    news: row.news, inbox, myExpenses: row.my_exp, fundTotal: data.accounts.reduce((a, x) => a + x[1], 0), office,
  };
}
