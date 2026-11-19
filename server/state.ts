// Builds everything one member's screens need, in one query (two for officers).
// This is the only place that decides what a role may SEE: a dataset the role has no capability for is never sent.
import { myInvoices } from "../lib/appdata.ts";
import { formatMilestoneTitle, milestoneKudosNotification } from "../lib/notifications.ts";
import { can, canFully, isAdmin, isCommittee, type Role } from "../lib/permissions.ts";
import type { AppState, Expense, MilestoneDTO, MilestoneType, Office, Roster, S } from "../lib/state.ts";
import * as data from "./data.ts";
import type { Db } from "./db.ts";
import { MILESTONE_FRESHNESS_DAYS } from "./milestones.ts";

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

const ROSTER = `json_build_object('id', id, 'no', member_no, 'name', name, 'handle', coalesce(nullif(cf_handle, ''), handle), 'cf_handle', nullif(coalesce(nullif(cf_handle, ''), handle), ''), 'batch', batch, 'dept', dept, 'squad', squad, 'role', title, 'is_alumni', role = 'alumni', 'rating', coalesce(cf_rating, rating), 'cf_rating', coalesce(cf_rating, nullif(rating, 0)), 'peak', peak,
  'solved', greatest(problems_solved, solved), 'problems_solved', greatest(problems_solved, solved), 'avatar_url', avatar_url, 'streak', greatest(current_streak, streak), 'current_streak', greatest(current_streak, streak), 'contests_participated', contests_participated, 'helper', helper, 'skills', skills, 'xp', solved * 12 + streak * 30 + helper * 8, 'roleKey', role, 'suspended', suspended, 'system', system, 'mentorId', mentor_id, 'pending', pass_hash is null and google_sub is null)`;
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
  (select count(*)::int from feed_posts where user_id = $1) as feed_posts,
  (select coalesce(sum(least(daily, 20)), 0)::int from (select date_trunc('day', v.created_at at time zone '${TZ}') d, count(*) daily from feed_votes v join feed_posts fp on fp.id = v.post_id where fp.user_id = $1 and v.user_id <> $1 and v.value = 1 group by 1) x) as feed_upvotes,
  (select count(*)::int from ideas where user_id = $1) as ideas_count,
  (select count(*)::int from idea_interests where user_id = $1 and status = 'accepted') as accepted_interests,
  (select count(*)::int from milestone_kudos mk join milestones m on m.id = mk.milestone_id where m.user_id = $1 and mk.user_id <> $1) as milestone_kudos_received,
  (select count(*)::int from milestone_kudos where user_id = $1 and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) as kudos_today,
  (select coalesce(json_agg(row_to_json(rm) order by rm.created_at desc, rm.id desc), '[]'::json)
     from (
       select m.id, m.user_id,
         mu.name as member_name,
         mu.avatar_url as member_avatar,
         greatest(mu.problems_solved, mu.solved) as member_solved,
         nullif(coalesce(nullif(mu.cf_handle, ''), mu.handle), '') as member_cf_handle,
         coalesce(mu.cf_rating, mu.rating) as member_rating,
         m.type, m.from_value, m.to_value, m.threshold, m.meta, m.created_at,
         (select count(*)::int from milestone_kudos mk where mk.milestone_id = m.id) as kudos_count,
         exists (select 1 from milestone_kudos mk where mk.milestone_id = m.id and mk.user_id = $1) as has_kudos,
         case when m.user_id = $1 then (
           select coalesce(json_agg(g.name order by mk.created_at desc), '[]'::json)
           from (
             select user_id, created_at from milestone_kudos where milestone_id = m.id and user_id <> $1 order by created_at desc limit 3
           ) mk
           join users g on g.id = mk.user_id
         ) else '[]'::json end as recent_givers
       from milestones m
       join users mu on mu.id = m.user_id
       where m.created_at > now() - interval '${MILESTONE_FRESHNESS_DAYS} days'
         and not mu.system and not mu.suspended
       order by m.created_at desc, m.id desc
       limit 5
     ) rm) as recent_milestones,
  (select coalesce(json_agg(json_build_object(
      'milestoneId', mk.milestone_id, 'userId', mk.user_id, 'from', g.name,
      'type', m.type, 'toValue', m.to_value
    ) order by mk.created_at desc), '[]'::json)
     from milestone_kudos mk
     join milestones m on m.id = mk.milestone_id
     join users g on g.id = mk.user_id
     where m.user_id = $1 and mk.user_id <> $1) as milestone_kudos_inbox,
  (select coalesce(json_agg(to_user || ':' || kind || ':' || ref), '[]') from pings where from_user = $1) as sent,
  exists (select 1 from messages where kind = 'checkin' and user_id = $1) as checked_in,
  (select coalesce(json_agg(json_build_object('id', p.from_user || ':' || p.kind || ':' || p.ref, 'kind', p.kind, 'from', f.name) order by p.at desc), '[]') from pings p join users f on f.id = p.from_user where p.to_user = $1) as pings,
  (select coalesce(json_agg(json_build_object('ideaId', ii.idea_id, 'userId', ii.user_id, 'from', w.name, 'title', i.title) order by ii.created_at desc), '[]')
     from idea_interests ii join ideas i on i.id = ii.idea_id join users w on w.id = ii.user_id where i.user_id = $1 and ii.status = 'pending') as incoming_interests,
  (select coalesce(json_agg(json_build_object('ideaId', ii.idea_id, 'status', ii.status, 'title', i.title) order by ii.decided_at desc), '[]')
     from idea_interests ii join ideas i on i.id = ii.idea_id where ii.user_id = $1 and ii.status <> 'pending') as decided_interests,
  (select coalesce(json_agg(json_build_object('id', m.id, 'from', m.user_id, 'name', w.name, 'body', m.body, 'at', m.created_at) order by m.id desc), '[]')
     from (select * from messages where kind = 'checkin' and to_user = $1 order by id desc limit 100) m join users w on w.id = m.user_id) as checkins,
  (select coalesce(json_agg(${EXPENSE} order by e.id desc), '[]') from expenses e join users w on w.id = e.by where e.by = $1) as my_exp,
  (select coalesce(json_object_agg(event_id, n), '{}') from (select event_id, count(*)::int n from registrations group by 1) x) as c_reg,
  (select coalesce(json_object_agg(key, n), '{}') from (select key, count(*)::int n from attendance where key like 'vol:%' group by 1) x) as c_vol,
  (select coalesce(json_agg(json_build_array(poll_id, option, n)), '[]') from (select poll_id, option, count(*)::int n from votes where poll_id not like 'fb:%' group by 1, 2) x) as c_votes,
  (select coalesce(json_object_agg(target, n), '{}') from (select target, count(*)::int n from reactions group by 1) x) as c_kudos,
  (select coalesce(json_object_agg(pid, n), '{}') from (select pid, count(*)::int n from users, jsonb_array_elements_text(coalesce(progress -> 'solved', '[]')) pid where not system and not suspended group by 1) x) as c_solved,
  (select coalesce(json_object_agg(announcement_id, n), '{}') from (select announcement_id, count(*)::int n from announcement_reads group by 1) x) as c_ann_reads,
  (select count(*)::int from users where role = 'alumni' and not system and not suspended) as c_alumni,
  (select count(*)::int from alumni_jobs where (source = 'manual' or fetched_at > now() - interval '30 days') and (deadline is null or deadline >= current_date)) as c_jobs,
  (select count(*)::int from interview_topics) as c_prep_topics,
  (select count(*)::int from blog_posts where status = 'published') as c_blogs,
  (select coalesce(json_agg(json_build_object(
      'id', 'an:' || a.id, 'user_id', a.user_id, 'title', a.title, 'body_md', coalesce(a.body_md, ''), 'by', w.name,
      'by_role', w.title, 'by_solved', greatest(w.problems_solved, w.solved), 'by_avatar', w.avatar_url,
      'at', a.created_at, 'edited_at', a.edited_at, 'mentees', a.audience <> 'all', 'pinned', a.pinned,
      'requires_ack', a.requires_ack,
      'read_count', (select count(*)::int from announcement_reads ar where ar.announcement_id = 'an:' || a.id)
    ) order by a.id desc), '[]')
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

let schemaPromise: Promise<void> | null = null;
function ensureSchemaOnce(db: Db): Promise<void> {
  return (schemaPromise ??= (async () => {
    try {
      await db.query(`
        alter table if exists users add column if not exists available_for_questions boolean not null default true;
        alter table if exists users add column if not exists location text;

        create table if not exists alumni_saves (
          user_id    text not null references users(id) on delete cascade,
          alumni_id  text not null references users(id) on delete cascade,
          created_at timestamptz not null default now(),
          primary key (user_id, alumni_id)
        );

        create table if not exists alumni_jobs (
          id               serial primary key,
          alumni_id        text references users(id) on delete set null,
          company          text not null,
          role             text not null,
          title            text,
          location         text,
          url              text not null,
          vacancies        integer not null default 1,
          job_type         text,
          experience       text,
          salary           text,
          description      text,
          responsibilities jsonb not null default '[]'::jsonb,
          requirements     jsonb not null default '[]'::jsonb,
          deadline         date,
          company_logo_url text,
          posted_at        timestamptz not null default now(),
          source           text not null check (source in ('fetched','manual')),
          fetched_at       timestamptz,
          created_at       timestamptz not null default now()
        );

        alter table if exists alumni_jobs add column if not exists title text;
        alter table if exists alumni_jobs add column if not exists vacancies integer not null default 1;
        alter table if exists alumni_jobs add column if not exists job_type text;
        alter table if exists alumni_jobs add column if not exists experience text;
        alter table if exists alumni_jobs add column if not exists salary text;
        alter table if exists alumni_jobs add column if not exists description text;
        alter table if exists alumni_jobs add column if not exists responsibilities jsonb not null default '[]'::jsonb;
        alter table if exists alumni_jobs add column if not exists requirements jsonb not null default '[]'::jsonb;
        alter table if exists alumni_jobs add column if not exists deadline date;
        alter table if exists alumni_jobs add column if not exists company_logo_url text;
        alter table if exists alumni_jobs add column if not exists posted_at timestamptz not null default now();

        create table if not exists interview_topics (
          id           serial primary key,
          name         text not null unique,
          description  text,
          created_by   text references users(id) on delete set null,
          order_index  integer not null default 0,
          created_at   timestamptz not null default now()
        );

        create table if not exists interview_problems (
          id           serial primary key,
          topic_id     integer not null references interview_topics(id) on delete cascade,
          title        text not null,
          url          text not null,
          difficulty   text not null check (difficulty in ('easy','medium','hard')),
          meta         jsonb not null default '{}'::jsonb,
          created_by   text references users(id) on delete set null,
          created_at   timestamptz not null default now()
        );

        create table if not exists interview_user_progress (
          user_id      text not null references users(id) on delete cascade,
          problem_id   integer not null references interview_problems(id) on delete cascade,
          completed_at timestamptz not null default now(),
          primary key (user_id, problem_id)
        );

        create table if not exists interview_tips (
          id           serial primary key,
          author_id    text not null references users(id) on delete cascade,
          topic_id     integer references interview_topics(id) on delete cascade,
          title        text not null,
          body_md      text not null,
          created_at   timestamptz not null default now(),
          updated_at   timestamptz not null default now()
        );

        create table if not exists blog_posts (
          id           serial primary key,
          author_id    text not null references users(id) on delete cascade,
          slug         text not null unique,
          title        text not null,
          subtitle     text,
          excerpt      text,
          body_md      text not null,
          cover_url    text,
          tags         jsonb not null default '[]'::jsonb,
          status       text not null default 'draft' check (status in ('draft','published')),
          published_at timestamptz,
          views        integer not null default 0,
          created_at   timestamptz not null default now(),
          updated_at   timestamptz not null default now()
        );
      `);
    } catch {
      // Fallback
    }
  })());
}

/** Everything `userId` may see, or null when the account is gone or suspended. */
export async function loadState(db: Db, userId: string): Promise<AppState | null> {
  await ensureSchemaOnce(db);
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
    kudos: [...row.kudos, ...p.shop.map((x) => "shop:" + x)], reg: row.reg, present: row.present, votes: row.votes, pay: row.pay, posts: row.posts,
    feedPosts: row.feed_posts ?? 0, feedUpvotes: row.feed_upvotes ?? 0, ideasCount: row.ideas_count ?? 0, acceptedInterests: row.accepted_interests ?? 0, milestoneKudosReceived: row.milestone_kudos_received ?? 0,
    sent: row.checked_in ? [...row.sent, "checkin"] : row.sent, flags, kv,
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
  for (const n of row.news as AppState["news"]) inbox.push({ id: n.id, cat: "Announcement", text: `${n.by}: ${n.title}`, href: "/app/community?tab=announcements" });
  const ping = { invite: "invited you to their ICPC team", duel: "challenged you to a duel", nudge: "nudged you: solve something today", team: "wants to team up with you" } as Record<string, string>;
  for (const g of row.pings as { id: string; kind: string; from: string }[]) inbox.push({ id: `n:ping:${g.id}`, cat: "Social", text: `${g.from} ${ping[g.kind]}`, href: g.kind === "duel" ? "/app/arena" : g.kind === "nudge" ? "/app/sheets" : g.kind === "team" ? "/app/community?tab=ideas" : "/app/teams" });
  for (const ii of row.incoming_interests as { ideaId: number; userId: string; from: string; title: string }[]) inbox.push({ id: `n:int:${ii.ideaId}:${ii.userId}`, cat: "Community", text: `${ii.from} is interested in "${ii.title}"`, href: "/app/community?tab=ideas" });
  for (const di of row.decided_interests as { ideaId: number; status: string; title: string }[]) inbox.push({ id: `n:intd:${di.ideaId}:${di.status}`, cat: "Community", text: `Your interest in "${di.title}" was ${di.status}`, href: "/app/community?tab=ideas" });
  for (const mk of (row.milestone_kudos_inbox ?? []) as { milestoneId: number; userId: string; from: string; type: MilestoneType; toValue: string }[]) {
    inbox.push({
      id: `n:mk:${mk.milestoneId}:${mk.userId}`,
      cat: "Community",
      text: milestoneKudosNotification({ giverName: mk.from, milestoneTitle: formatMilestoneTitle(mk.type, mk.toValue) }),
      href: "/app/community?tab=feed",
    });
  }
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
    me: { ...me, email: row.email, mentor: row.mentor_name }, s, members,
    counts: {
      reg: row.c_reg,
      vol: row.c_vol,
      kudos: row.c_kudos,
      votes,
      solved: row.c_solved,
      annReads: row.c_ann_reads,
      kudosToday: row.kudos_today ?? 0,
      recentMilestones: (row.recent_milestones ?? []) as MilestoneDTO[],
      alumniCount: Number(row.c_alumni ?? 0),
      jobsCount: Number(row.c_jobs ?? 0),
      prepTopicsCount: Number(row.c_prep_topics ?? 0),
      blogsCount: Number(row.c_blogs ?? 0),
    },
    news: row.news, inbox, myExpenses: row.my_exp, fundTotal: data.accounts.reduce((a, x) => a + x[1], 0), office,
  };
}
