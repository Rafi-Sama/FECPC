// Builds everything one member's screens need, in one query (two for officers).
// This is the only place that decides what a role may SEE: a dataset the role has no capability for is never sent.
import { mailStatus } from './mail.ts';
import {
  formatMilestoneTitle,
  milestoneKudosNotification,
  can,
  canFully,
  duesFor,
  FEE_KEYS,
  feesOf,
  periods,
  PROFILE_FIELDS,
  type ProfileRequest,
  isAdmin,
  isCommittee,
  type Role,
  type Who,
} from '@fecpc/contracts';
import type {
  AppState,
  Expense,
  MilestoneDTO,
  MilestoneType,
  Office,
  Roster,
  S,
} from '@fecpc/contracts';
import * as data from './office-data.ts';
import type { Db } from './db.ts';
import { MILESTONE_FRESHNESS_DAYS } from './milestones.ts';

export const TZ = 'Asia/Dhaka';
export const today = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
export const yesterday = () => today(new Date(Date.now() - 864e5));
export { isAdmin, isCommittee };
/** Money records need a finance capability. */
export const seesMoney = (r: Who) => !!(can(r, 'payments.verify') || can(r, 'expense.approve'));

/** The member's own lists and preferences, as stored in users.progress. Unknown or missing fields fall back to empty. */
export type Progress = {
  handle: string;
  base: { solved: number; done: number };
  solved: string[];
  done: string[];
  read: string[];
  shop: string[];
  flags: Record<string, boolean>;
  kv: Record<string, string>;
  spent: number;
  checkin: string;
  /** Consecutive days checked in, ending on `checkin`. */
  run: number;
};
export function progress(raw: Partial<Progress> | null): Progress {
  const p = raw ?? {};
  return {
    handle: p.handle ?? '',
    base: { solved: p.base?.solved ?? 0, done: p.base?.done ?? 0 },
    solved: p.solved ?? [],
    done: p.done ?? [],
    read: p.read ?? [],
    shop: p.shop ?? [],
    flags: p.flags ?? {},
    kv: p.kv ?? {},
    spent: p.spent ?? 0,
    checkin: p.checkin ?? '',
    run: p.run ?? (p.checkin ? 1 : 0),
  };
}

const ROSTER = `json_build_object('id', id, 'no', member_no, 'name', name, 'handle', coalesce(nullif(cf_handle, ''), handle), 'cf_handle', nullif(coalesce(nullif(cf_handle, ''), handle), ''), 'batch', batch, 'dept', dept, 'squad', squad, 'role', title, 'is_alumni', role = 'alumni', 'rating', coalesce(cf_rating, rating), 'cf_rating', coalesce(cf_rating, nullif(rating, 0)), 'peak', peak,
  'solved', greatest(problems_solved, solved), 'problems_solved', greatest(problems_solved, solved), 'avatar_url', avatar_url, 'cf_contests', cf_contests, 'streak', greatest(current_streak, streak), 'current_streak', greatest(current_streak, streak), 'contests_participated', contests_participated, 'helper', helper, 'skills', skills, 'xp', solved * 12 + vj_solved * 12 + streak * 30 + helper * 8, 'roleKey', role, 'post', post, 'email', email, 'suspended', suspended, 'system', system, 'pending', pass_hash is null and google_sub is null)`;
const EXPENSE = `json_build_object('id', 'EXP-' || e.id, 'by', e.by, 'name', w.name, 'what', e.what, 'amount', e.amount, 'event', e.event, 'status', e.status)`;
const MINE = `
select u.email, u.progress, to_char(u.created_at at time zone '${TZ}', 'YYYY-MM-DD') as joined, to_char(u.post_since, 'YYYY-MM-DD') as post_since,
  (select coalesce(json_agg(json_build_object('id', e.id, 'title', e.title, 'fee', e.fee, 'date', to_char(e.starts_at at time zone '${TZ}', 'YYYY-MM-DD')) order by e.starts_at), '[]')
    from event_entries x join club_events e on e.id = x.event_id where x.user_id = $1 and x.role_id is null and x.status = 'approved' and e.fee > 0) as fee_events,
  u.vjudge_handle, u.vj_solved, nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
  (select coalesce(json_object_agg(post, roles), '{}') from post_roles) as post_roles, (select ${ROSTER} from users m where m.id = u.id) as me,
  (select coalesce(json_agg(distinct event_id), '[]') from event_entries where user_id = $1 and role_id is null and status = 'approved') as reg,
  (select coalesce(json_agg(key), '[]') from attendance where user_id = $1) as present,
  (select coalesce(json_agg(c.problem), '[]') from cf_solves c where c.user_id = $1 and u.progress->'solved' ? c.problem) as verified,
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
  (select coalesce(json_agg(json_build_object('id', x.id, 'eventId', x.event_id, 'title', e.title, 'role', r.title, 'reason', x.reason) order by x.id desc), '[]')
     from event_entries x join club_events e on e.id = x.event_id left join event_roles r on r.id = x.role_id
     where x.user_id = $1 and x.status = 'rejected') as declined_entries,
  (select json_build_object('id', r.id::text, 'status', r.status, 'changes', r.changes, 'note', r.note, 'reason', r.reason, 'at', coalesce(r.decided_at, r.created_at))
     from profile_requests r where r.user_id = $1 and (r.status = 'pending' or (r.status in ('approved','rejected') and r.decided_at > now() - interval '14 days'))
     order by r.id desc limit 1) as profile_request,
  (select coalesce(json_agg(json_build_object('id', p.from_user || ':' || p.kind || ':' || p.ref, 'kind', p.kind, 'from', f.name) order by p.at desc), '[]') from pings p join users f on f.id = p.from_user where p.to_user = $1 and p.kind = 'invite' and p.ref like 'team:%') as team_invites,
  (select coalesce(json_agg(json_build_object('ideaId', ii.idea_id, 'userId', ii.user_id, 'from', w.name, 'title', i.title) order by ii.created_at desc), '[]')
     from idea_interests ii join ideas i on i.id = ii.idea_id join users w on w.id = ii.user_id where i.user_id = $1 and ii.status = 'pending') as incoming_interests,
  (select coalesce(json_agg(json_build_object('ideaId', ii.idea_id, 'status', ii.status, 'title', i.title) order by ii.decided_at desc), '[]')
     from idea_interests ii join ideas i on i.id = ii.idea_id where ii.user_id = $1 and ii.status <> 'pending') as decided_interests,
  (select coalesce(json_agg(${EXPENSE} order by e.id desc), '[]') from expenses e join users w on w.id = e.by where e.by = $1) as my_exp,
  (select coalesce(json_object_agg(key, n), '{}') from (select key, count(*)::int n from attendance where key like 'vol:%' group by 1) x) as c_vol,
  (select coalesce(json_agg(json_build_array(poll_id, option, n)), '[]') from (select poll_id, option, count(*)::int n from votes where poll_id not like 'fb:%' group by 1, 2) x) as c_votes,
  (select coalesce(json_object_agg(target, n), '{}') from (select target, count(*)::int n from reactions group by 1) x) as c_kudos,
  (select coalesce(json_object_agg(pid, n), '{}') from (select pid, count(*)::int n from users, jsonb_array_elements_text(coalesce(progress -> 'solved', '[]')) pid where not system and not suspended group by 1) x) as c_solved,
  (select coalesce(json_object_agg(announcement_id, n), '{}') from (select announcement_id, count(*)::int n from announcement_reads group by 1) x) as c_ann_reads,
  (select count(*)::int from users where role = 'alumni' and not system and not suspended) as c_alumni,
  (select count(*)::int from alumni_jobs where (source = 'manual' or fetched_at > now() - interval '30 days') and (deadline is null or deadline >= current_date)) as c_jobs,
  (select count(*)::int from interview_topics) as c_prep_topics,
  (select count(*)::int from blog_posts where status = 'published') as c_blogs,
  (select coalesce(json_agg(json_build_object('id', ch.id, 'problem', ch.problem, 'name', ch.name, 'rating', ch.rating,
      'by', ch.by, 'at', ch.at,
      'solvers', (select coalesce(json_agg(json_build_object('id', s.user_id, 'at', s.at) order by s.at nulls last), '[]')
        from cf_solves s join users su on su.id = s.user_id
        where s.problem = ch.problem and not su.system and not su.suspended)) order by ch.at desc), '[]')
     from challenges ch where ch.at > now() - interval '30 days') as challenges,
  (select json_build_object('week', w::text, 'next', (w + 7)::text, 'teams', coalesce((
      select json_agg(json_build_object('by', f.id, 'week', substr(kv.k, 9), 'picks', kv.v))
      from users f, jsonb_each_text(coalesce(f.progress->'kv', '{}')) kv(k, v)
      where kv.k like 'fantasy:%' and substr(kv.k, 9) >= (w - 7)::text and not f.system and not f.suspended), '[]'))
     from (select date_trunc('week', now() at time zone '${TZ}')::date as w) wk) as fantasy,
  (select coalesce(json_agg(json_build_object('id', sh.id, 'kind', sh.kind, 'title', sh.title, 'note', sh.note, 'week', sh.week, 'by', w.name, 'at', sh.at,
      'problems', (select coalesce(json_agg(pr || jsonb_build_object('club', (select count(*)::int from cf_solves cs join users cu on cu.id = cs.user_id
          where cs.problem = pr->>'id' and not cu.system and not cu.suspended)) order by o), '[]') from jsonb_array_elements(sh.problems) with ordinality x(pr, o)))
      order by sh.kind = 'weekly' desc, sh.at desc), '[]')
     from sheets sh left join users w on w.id = sh.by
     where sh.kind = 'custom' or sh.week = (select max(week) from sheets)) as sheets,
  (select coalesce(json_agg(json_build_object(
      'id', 'an:' || a.id, 'user_id', a.user_id, 'title', a.title, 'body_md', coalesce(a.body_md, ''), 'by', w.name,
      'by_role', w.title, 'by_solved', greatest(w.problems_solved, w.solved), 'by_avatar', w.avatar_url,
      'at', a.created_at, 'edited_at', a.edited_at, 'pinned', a.pinned,
      'requires_ack', a.requires_ack,
      'read_count', (select count(*)::int from announcement_reads ar where ar.announcement_id = 'an:' || a.id)
    ) order by a.id desc), '[]')
     from (select * from announcements order by id desc limit 50) a join users w on w.id = a.user_id) as news,
  (select coalesce(json_agg(json_build_object('id', 'poll:' || p.id, 'user_id', p.user_id, 'q', p.question,
      'opts', p.options, 'by', w.name, 'at', p.created_at) order by p.id desc), '[]')
     from (select * from club_polls order by id desc limit 50) p join users w on w.id = p.user_id) as polls,
  (select coalesce(json_agg(${ROSTER} order by rating desc, id), '[]') from users) as members,
  (select coalesce(json_object_agg(key, value), '{}') from club) as club,
  (select coalesce(json_agg(json_build_object('id', c.id, 'title', c.title, 'instructor', c.instructor, 'weeks', c.duration_weeks,
      'description', c.description, 'url', c.url) order by c.created_at desc), '[]') from learning_courses c) as courses,
  (select coalesce(json_agg(json_build_object('id', q.id, 'question', q.question, 'options', q.options,
      'picked', a.selected_index, 'answer', case when a.member_id is not null then q.correct_index end) order by d.position), '[]')
     from learning_quiz_daily_picks d join learning_quiz_questions q on q.id = d.question_id
     left join learning_quiz_answers a on a.member_id = $1 and a.quiz_date = d.quiz_date and a.question_id = q.id
     where d.quiz_date = (now() at time zone '${TZ}')::date) as quiz
from users u where u.id = $1 and not u.suspended`;
const QUIZ_BANK = `
select coalesce(json_agg(json_build_object('id', q.id, 'question', q.question, 'options', q.options, 'answer', q.correct_index,
    'today', exists (select 1 from learning_quiz_daily_picks d where d.question_id = q.id and d.quiz_date = (now() at time zone '${TZ}')::date))
  order by q.created_at desc), '[]') as bank
from learning_quiz_questions q`;
// The day's five, least recently used first. One statement: when two loads race, the loser's rows all collide
// on (quiz_date, position) and are dropped, so the day never mixes two sets.
const QUIZ_PICK = `
insert into learning_quiz_daily_picks (quiz_date, position, question_id)
select (now() at time zone '${TZ}')::date, row_number() over (), id from (
  select q.id from learning_quiz_questions q where q.is_active
  order by (select max(p.quiz_date) from learning_quiz_daily_picks p where p.question_id = q.id) asc nulls first, random()
  limit 5) x
where not exists (select 1 from learning_quiz_daily_picks where quiz_date = (now() at time zone '${TZ}')::date)
on conflict do nothing`;
const OFFICE = `
select
  case when $1 then (select coalesce(json_agg(json_build_object('id', 'PAY-' || p.id, 'name', u.name, 'label', p.label, 'amount', p.amount, 'via', p.via, 'trx', p.trx,
      'sender', left(p.sender, 3) || '••••' || right(p.sender, 4), 'status', p.status, 'mine', p.user_id = $6, 'at', p.created_at) order by (p.status <> 'pending'), case when p.status = 'pending' then p.id end, p.id desc), '[]')
    from (select * from payments order by (status <> 'pending'), id desc limit 500) p join users u on u.id = p.user_id) end as queue,
  case when $2 then (select coalesce(json_agg(${EXPENSE} order by e.id desc), '[]') from (select * from expenses order by id desc limit 200) e join users w on w.id = e.by) end as expenses,
  case when $3 then (select coalesce(json_agg(json_build_object('id', a.id::text, 'link', a.link_id, 'name', a.name, 'sid', a.sid, 'dept', a.dept, 'batch', a.batch,
      'email', a.email, 'phone', a.phone, 'cf', a.cf, 'why', a.why, 'answers', a.answers, 'src', a.src, 'status', a.status, 'reason', a.decline_reason,
      'decidedBy', d.name, 'photo', a.photo is not null, 'at', a.created_at) order by (a.status <> 'pending'), a.id desc), '[]')
    from (select * from applications order by (status <> 'pending'), id desc limit 1000) a left join users d on d.id = a.decided_by) end as apps,
  case when $3 then (select coalesce(json_agg(json_build_object('id', l.id, 'token', l.token, 'title', l.title, 'batch', l.batch, 'form', l.form,
      'closes', l.closes_at, 'open', l.closes_at > now(), 'by', w.name, 'at', l.created_at,
      'mail', case when l.mail_html is null then null else json_build_object('subject', l.mail_subject, 'html', l.mail_html) end,
      'pending', (select count(*) from applications x where x.link_id = l.id and x.status = 'pending')::int,
      'accepted', (select count(*) from applications x where x.link_id = l.id and x.status = 'accepted')::int,
      'declined', (select count(*) from applications x where x.link_id = l.id and x.status = 'declined')::int) order by l.id desc), '[]')
    from recruit_links l join users w on w.id = l.by) end as links,
  case when $4 then (select coalesce(json_agg(json_build_object('body', body, 'at', created_at) order by id desc), '[]') from (select * from messages where kind = 'suggest' order by id desc limit 100) m) end as suggestions,
  case when $5 then (select coalesce(json_agg(json_build_object('body', body, 'at', created_at) order by id desc), '[]') from (select * from messages where kind = 'feedback' order by id desc limit 100) m) end as feedback`;

// Real money movements: verified payments in, approved expenses out. The ledger rows only for finance roles.
// Real money and the committee's own records. $1 finance roles, $2 the member, $3 committee.
const MONEY = `
with term as (select date_trunc('year', now() at time zone '${TZ}')
  + case when extract(month from now() at time zone '${TZ}') >= 7 then interval '6 months' else interval '0' end as since)
select
  (select coalesce(sum(amount), 0) from payments where status = 'verified')::int
    - (select coalesce(sum(amount), 0) from expenses where status = 'approved')::int as net,
  (select to_char(since, 'YYYY-MM-DD') from term) as since,
  (select coalesce(sum(amount), 0)::int from payments, term where status = 'verified' and created_at at time zone '${TZ}' >= since) as incoming,
  (select coalesce(sum(amount), 0)::int from expenses, term where status = 'approved' and created_at at time zone '${TZ}' >= since) as spent,
  (select coalesce(json_agg(json_build_object('date', to_char(e.created_at at time zone '${TZ}', 'YYYY-MM-DD'), 'what', e.what,
      'cat', e.category, 'amount', e.amount, 'by', u.name) order by e.created_at desc, e.id desc), '[]')
    from expenses e cross join term left join users u on u.id = e.decided_by
    where e.status = 'approved' and e.created_at at time zone '${TZ}' >= since) as term_expenses,
  (select json_agg(json_build_object('month', to_char(m, 'YYYY-MM'),
      'in', (select coalesce(sum(amount), 0)::int from payments where status = 'verified' and date_trunc('month', created_at at time zone '${TZ}') = m),
      'out', (select coalesce(sum(amount), 0)::int from expenses where status = 'approved' and date_trunc('month', created_at at time zone '${TZ}') = m)) order by m)
    from generate_series(date_trunc('month', now() at time zone '${TZ}') - interval '5 months', date_trunc('month', now() at time zone '${TZ}'), interval '1 month') m) as flow,
  case when $1 then (select coalesce(json_agg(x order by x.date desc, x.what), '[]') from (
    (select to_char(created_at at time zone '${TZ}', 'YYYY-MM-DD') as date, label || ' · PAY-' || id as what, 'Dues' as cat, amount as amt
      from payments where status = 'verified' order by id desc limit 100)
    union all
    (select to_char(created_at at time zone '${TZ}', 'YYYY-MM-DD'), what || ' · EXP-' || id, 'Expense', -amount
      from expenses where status = 'approved' order by id desc limit 100)) x) end as ledger,
  case when $1 then (select coalesce(json_agg(json_build_object('id', b.id, 'name', b.name, 'plan', b.plan,
      'spent', b.spent_before + (select coalesce(sum(amount), 0) from expenses e where e.status = 'approved' and e.event = b.name)) order by b.id), '[]')
    from budgets b) end as budgets,
  -- Waivers are no longer requested; ones already granted still settle their invoice.
  (select coalesce(json_agg(json_build_object('invoice', invoice_id, 'what', what, 'amount', amount, 'reason', reason, 'at', created_at)), '[]')
    from waiver_requests where user_id = $2 and status = 'waived') as waived,
  case when $3 then (select coalesce(json_agg(json_build_object('id', id, 'title', title, 'who', who, 'due', to_char(due, 'YYYY-MM-DD'), 'col', col) order by due nulls last, id), '[]')
    from committee_tasks) end as tasks,
  case when $3 then (select coalesce(json_agg(json_build_object('id', d.id, 'title', d.title, 'about', d.about, 'url', d.url, 'by', u.name, 'byId', d.created_by,
      'at', to_char(d.created_at at time zone '${TZ}', 'YYYY-MM-DD')) order by d.id desc), '[]')
    from documents d left join users u on u.id = d.created_by) end as docs,
  case when $3 then (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'holder', holder) order by id), '[]') from inventory) end as inventory`;

type Raw = Roster & {
  system: boolean;
  roleKey: Role;
  suspended: boolean;
  pending: boolean;
};

/** Everything `userId` may see, or null when the account is gone or suspended. */
export async function loadState(db: Db, userId: string): Promise<AppState | null> {
  await db.query(QUIZ_PICK);
  const row = (await db.query(MINE, [userId])).rows[0];
  if (!row) return null;
  const postRoles = row.post_roles as AppState['postRoles'],
    raw = row.me as Raw,
    // Permissions come from the member's own role plus what their post grants.
    roles: Role[] = [raw.roleKey, ...((raw.post && postRoles[raw.post]) || [])],
    role = raw.roleKey,
    p = progress(row.progress),
    committee = isCommittee(roles),
    admin = isAdmin(roles);
  const caps = {
    queue: !!can(roles, 'payments.verify'),
    exp: !!can(roles, 'expense.approve'),
    apps: !!can(roles, 'application.approve'),
    suggest: admin,
    feedback: !!can(roles, 'event.publish'),
  };
  const off = Object.values(caps).some(Boolean)
    ? (await db.query(OFFICE, [...Object.values(caps), userId])).rows[0]
    : {};

  const flags = { ...p.flags },
    kv = { ...p.kv },
    club = row.club as Record<string, unknown>,
    fees = feesOf({
      [FEE_KEYS.term]: club['kv:' + FEE_KEYS.term],
      [FEE_KEYS.post]: club['kv:' + FEE_KEYS.post],
    });
  for (const [k, v] of Object.entries(row.club as Record<string, unknown>)) {
    const [kind, key] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    const everyone =
      (kind === 'flag' && (key === 'unfrozen' || key.startsWith('mod:'))) ||
      (kind === 'kv' && (key === 'contests' || key.startsWith('fee:')));
    if (!committee && !everyone) continue; // members see only what changes their own screens
    if (kind === 'flag') flags[key] = v === true;
    else kv[key] = String(v);
  }
  const expenses: Expense[] = off.expenses ?? [],
    decided = (list: Expense[]) =>
      Object.fromEntries(list.filter((e) => e.status !== 'pending').map((e) => [e.id, e.status]));
  const s: S = {
    role,
    roles,
    handle: row.cf_handle ?? '', // the account's column is the one copy officers and the member both write
    vjudge: row.vjudge_handle ?? '',
    vjSolved: row.vj_solved ?? 0,
    base: p.base,
    solved: p.solved,
    verified: row.verified,
    done: p.done,
    read: p.read,
    spent: p.spent,
    checkin: p.checkin === today(),
    run: p.checkin === today() || p.checkin === yesterday() ? p.run : 0,
    kudos: [...row.kudos, ...p.shop.map((x) => 'shop:' + x)],
    reg: row.reg,
    dues: raw.system
      ? []
      : duesFor(
          { joined: row.joined, postSince: row.post_since, alumni: role === 'alumni' },
          fees,
          row.fee_events,
          today(),
        ),
    present: row.present,
    votes: row.votes,
    pay: row.pay,
    posts: row.posts,
    feedPosts: row.feed_posts ?? 0,
    feedUpvotes: row.feed_upvotes ?? 0,
    ideasCount: row.ideas_count ?? 0,
    acceptedInterests: row.accepted_interests ?? 0,
    milestoneKudosReceived: row.milestone_kudos_received ?? 0,
    flags,
    kv,
    queue: Object.fromEntries(
      (off.queue ?? []).map((q: { id: string; status: string }) => [q.id, q.status]),
    ),
    exp: decided(expenses),
    apps: Object.fromEntries(
      (off.apps ?? []).map((a: { id: string; status: string }) => [a.id, a.status]),
    ),
  };

  // The roster everyone gets: people only, no account-management fields. Officers who manage accounts get those too.
  const everyone = row.members as Raw[];
  // The operator account is listed only for a Super Admin, who is the only one able to act on it.
  const members: Roster[] = everyone
    .filter((m) => (admin ? !m.system || role === 'super_admin' : !m.system && !m.suspended))
    // Emails only for the Super Admin, who appoints the President by email.
    .map(({ system: _s, roleKey, suspended, pending, email, ...m }) => ({
      ...m,
      ...(admin ? { roleKey, suspended, pending } : {}),
      ...(role === 'super_admin' ? { email } : {}),
    }));
  const { pending: _p, ...me } = raw;

  const money = (await db.query(MONEY, [seesMoney(roles), userId, committee])).rows[0];
  // A waiver granted before the feature was removed settles its invoice, unless a payment already did.
  for (const w of money.waived as {
    invoice: string;
    what: string;
    amount: number;
    reason: string;
    at: string;
  }[])
    if (!row.pay[w.invoice] || row.pay[w.invoice].status === 'rejected')
      row.pay[w.invoice] = {
        trx: '',
        via: 'Waiver',
        status: 'waived',
        id: 0,
        amount: w.amount,
        label: w.what,
        at: w.at,
        note: w.reason,
      };
  const office: Office = {};
  if (caps.queue) office.queue = off.queue;
  if (seesMoney(roles))
    office.fund = {
      accounts: [...data.accounts],
      ledger: [...money.ledger, ...data.ledger],
      budgets: money.budgets,
    };
  if (seesMoney(roles)) office.dues = await duesSummary(db, fees, money.since);
  if (caps.exp) office.expenses = expenses;
  if (caps.apps) office.recruit = { links: off.links, applicants: off.apps };
  if (caps.apps || caps.feedback) office.mail = await mailStatus(db);
  if (canFully(roles, 'member.editDetails'))
    office.profileRequests = (
      await db.query(
        // The new photo stays out of state (it is fetched on its own); `true` marks that there is one.
        `select r.id::text, r.user_id "user", u.name, r.note, r.created_at at,
           case when r.changes ? 'avatar_url' and r.changes->>'avatar_url' is not null
             then jsonb_set(r.changes, '{avatar_url}', 'true') else r.changes end changes,
           jsonb_build_object(${PROFILE_FIELDS.filter(([k]) => k !== 'avatar_url')
             .map(([k]) => `'${k}', u.${k}`)
             .join(', ')}, 'avatar_url', u.avatar_url is not null) current
         from profile_requests r join users u on u.id = r.user_id
         where r.status = 'pending' order by r.id limit 200`,
      )
    ).rows;
  if (caps.suggest) office.suggestions = off.suggestions;
  if (caps.feedback) office.feedback = off.feedback;
  if (committee)
    office.ops = {
      tasks: money.tasks,
      docs: money.docs,
      inventory: money.inventory,
      reports: data.reports,
    };

  // The inbox is derived from real records, so it can never claim something that did not happen.
  const inbox: AppState['inbox'] = [];
  for (const inv of s.dues) {
    const pay = row.pay[inv.id];
    if (!pay)
      inbox.push({
        id: `n:due:${inv.id}`,
        cat: 'Finance',
        text: `${inv.label}: ৳${inv.amount} is due on ${inv.due}`,
        href: '/app/finance',
      });
    else if (pay.status === 'rejected')
      inbox.push({
        id: `n:rej:${pay.id}`,
        cat: 'Finance',
        text: `Your payment for "${inv.label}" was rejected${pay.note ? `: ${pay.note}` : ''}. Submit it again.`,
        href: '/app/finance',
      });
    else if (pay.status === 'verified')
      inbox.push({
        id: `n:paid:${pay.id}`,
        cat: 'Finance',
        text: `Your payment for "${inv.label}" was verified.`,
        href: '/app/finance',
      });
  }
  for (const n of row.news as AppState['news'])
    inbox.push({
      id: n.id,
      cat: 'Announcement',
      text: `${n.by}: ${n.title}`,
      href: `/app/community?tab=announcements&open=${encodeURIComponent(n.id)}`,
    });
  for (const g of row.team_invites as { id: string; from: string }[])
    inbox.push({
      id: `n:ping:${g.id}`,
      cat: 'Social',
      text: `${g.from} invited you to their ICPC team`,
      actions: [{ label: 'Join team', type: 'teamJoin', args: { from: g.id.split(':')[0] } }],
      href: '/app/teams',
    });
  for (const ii of row.incoming_interests as {
    ideaId: number;
    userId: string;
    from: string;
    title: string;
  }[])
    inbox.push({
      id: `n:int:${ii.ideaId}:${ii.userId}`,
      cat: 'Community',
      text: `${ii.from} is interested in "${ii.title}"`,
      href: '/app/community?tab=ideas',
      actions: (['accepted', 'declined'] as const).map((decision) => ({
        label: decision === 'accepted' ? 'Accept' : 'Decline',
        type: 'decideInterest',
        args: { ideaId: ii.ideaId, userId: ii.userId, decision },
      })),
    });
  for (const di of row.decided_interests as { ideaId: number; status: string; title: string }[])
    inbox.push({
      id: `n:intd:${di.ideaId}:${di.status}`,
      cat: 'Community',
      text: `Your interest in "${di.title}" was ${di.status}`,
      href: '/app/community?tab=ideas',
    });
  for (const mk of (row.milestone_kudos_inbox ?? []) as {
    milestoneId: number;
    userId: string;
    from: string;
    type: MilestoneType;
    toValue: string;
  }[]) {
    inbox.push({
      id: `n:mk:${mk.milestoneId}:${mk.userId}`,
      cat: 'Community',
      text: milestoneKudosNotification({
        giverName: mk.from,
        milestoneTitle: formatMilestoneTitle(mk.type, mk.toValue),
      }),
      href: '/app/community?tab=feed',
    });
  }
  for (const d of row.declined_entries as {
    id: number;
    eventId: string;
    title: string;
    role: string | null;
    reason: string | null;
  }[])
    inbox.push({
      id: `n:evdec:${d.id}`,
      cat: 'Events',
      text: `Your ${d.role ? `application for ${d.role} at` : 'registration for'} "${d.title}" was declined${d.reason ? `: ${d.reason}` : '.'}`,
      href: `/app/events/${d.eventId}`,
    });
  const pr = row.profile_request as ProfileRequest | null;
  if (pr && pr.status !== 'pending')
    inbox.push({
      id: `n:preq:${pr.id}`,
      cat: 'Profile',
      text:
        pr.status === 'approved'
          ? 'Your profile change was approved.'
          : `Your profile change was rejected: ${pr.reason}`,
      href: '/app/profile',
    });
  if (office.profileRequests?.length)
    inbox.push({
      id: `n:preqs:${office.profileRequests[0]!.id}`,
      cat: 'Admin',
      text: `${office.profileRequests.length} profile change request${office.profileRequests.length > 1 ? 's' : ''} to review`,
      href: '/app/admin',
    });
  const waiting = (off.queue ?? []).filter((q: { status: string }) => q.status === 'pending');
  if (canFully(roles, 'payments.verify') && waiting.length)
    inbox.push({
      id: `n:queue:${waiting[0].id}`,
      cat: 'Finance',
      text: `${waiting.length} payment${waiting.length > 1 ? 's are' : ' is'} waiting for verification`,
      href: '/app/finance',
    });
  const mineToDecide = expenses.filter(
    (e) =>
      e.by !== userId &&
      (e.status === 'sent to President'
        ? can(roles, 'expense.approve') === true
        : e.status === 'pending'),
  );
  if (mineToDecide.length)
    inbox.push({
      id: `n:exp:${mineToDecide[0]!.id}`,
      cat: 'Finance',
      text: `${mineToDecide.length} expense request${mineToDecide.length > 1 ? 's need' : ' needs'} a decision`,
      href: '/app/finance',
    });
  const applied = (off.apps ?? []).filter((a: { status: string }) => a.status === 'pending');
  if (applied.length)
    inbox.push({
      id: `n:app:${applied[0].id}`,
      cat: 'Admin',
      text: `${applied.length} application${applied.length > 1 ? 's' : ''} to review`,
      href: '/app/admin',
    });

  // New challenges from others in the last three days that this member has not solved yet.
  const open = (row.challenges as AppState['challenges']).filter(
    (c) =>
      c.by !== userId &&
      Date.parse(c.at) > Date.now() - 3 * 864e5 &&
      !c.solvers.some((x) => x.id === userId),
  );
  if (open.length)
    inbox.push({
      id: `n:ch:${open[0]!.id}`,
      cat: 'Arena',
      text:
        open.length > 1
          ? `${open.length} open challenges in the Arena`
          : `New challenge: ${open[0]!.name}`,
      href: '/app/arena',
    });

  const votes: AppState['counts']['votes'] = {};
  for (const [poll, opt, n] of row.c_votes as [string, string, number][])
    (votes[poll] ??= {})[opt] = n;
  return {
    me: { ...me, email: row.email },
    s,
    members,
    counts: {
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
    news: row.news,
    polls: row.polls,
    inbox,
    myExpenses: row.my_exp,
    term: {
      since: money.since,
      incoming: money.incoming,
      spent: money.spent,
      expenses: money.term_expenses,
      flow: money.flow,
    },
    // The seeded opening balance plus every verified payment, minus every approved expense.
    fundTotal: data.accounts.reduce((a, x) => a + x[1], 0) + money.net,
    office,
    profileRequest: (row.profile_request as ProfileRequest | null) ?? null,
    sheets: row.sheets,
    fantasy: row.fantasy,
    challenges: row.challenges,
    postRoles,
    courses: row.courses,
    quiz: row.quiz,
    quizBank: canFully(roles, 'learning.curate') ? (await db.query(QUIZ_BANK)).rows[0].bank : null,
  };
}

/** Who is paid up for their current period, counted per account id over every live payment. */
async function duesSummary(db: Db, fees: { term: number; post: number }, since: string) {
  const people = (
    await db.query(
      `select id, to_char(created_at at time zone '${TZ}', 'YYYY-MM-DD') joined, to_char(post_since, 'YYYY-MM-DD') post_since
       from users where not system and not suspended and role <> 'alumni' and (pass_hash is not null or google_sub is not null)`,
    )
  ).rows as { id: string; joined: string; post_since: string | null }[];
  const live = new Map(
    (
      await db.query(
        `select user_id || ' ' || invoice_id k, status from payments where status <> 'rejected' and invoice_id ~ '^(TERM|POST)-'
         union all select user_id || ' ' || invoice_id, 'verified' from waiver_requests where status = 'waived'`,
      )
    ).rows.map((r: { k: string; status: string }) => [r.k, r.status]),
  );
  const t = today();
  const tally = (
    kind: 'TERM' | 'POST',
    fee: number,
    from: (u: (typeof people)[number]) => string | null,
  ) => {
    const r = { of: 0, paid: 0, waiting: 0, fee };
    if (!fee) return r;
    for (const u of people) {
      const start = from(u),
        cur = start && periods(start, t).at(-1);
      if (!cur) continue;
      r.of++;
      const st = live.get(`${u.id} ${kind}-${cur}`);
      if (st === 'verified') r.paid++;
      else if (st === 'pending') r.waiting++;
    }
    return r;
  };
  const gifts = (
    await db.query(
      `select coalesce(sum(amount), 0)::int amount, count(*)::int count from payments
       where status = 'verified' and invoice_id like 'GIFT-%' and created_at at time zone '${TZ}' >= $1::date`,
      [since],
    )
  ).rows[0] as { amount: number; count: number };
  return {
    term: tally('TERM', fees.term, (u) => u.joined),
    post: tally('POST', fees.post, (u) => u.post_since),
    gifts,
  };
}
