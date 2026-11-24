// Every change a member or officer can make. One entry point, one transaction, one row lock on the acting user.
// This is the only place that decides what a role may DO; the interface merely hides what would be refused here.
import { APPROVAL_THRESHOLD, announcements, CONTRIBUTION, sheet } from '@fecpc/content/member-area';
import { cols, volunteerShifts, wiki } from '@fecpc/content/training';
import {
  can,
  canFully,
  FEE_KEYS,
  postName,
  postableRoles,
  posts,
  roleName,
  roles,
  type Role,
  RANKS,
  UNRATED_RANK,
} from '@fecpc/contracts';
import type {
  AlumniJob,
  AlumniSummary,
  BlogPost,
  FeedCategory,
  FeedPostDetail,
  FeedPostSummary,
  IdeaDetail,
  IdeaInterestRow,
  IdeaStatus,
  IdeaSummary,
  IdeaType,
  InterviewProblem,
  InterviewTip,
  InterviewRoadmap,
  RoadmapKind,
  InterviewTopic,
  MemberActivityItem,
  MemberContestRow,
  MemberExperience,
  MemberProfile,
  MemberSummary,
} from '@fecpc/contracts';
import { newToken, sha } from './tokens.ts';
import { Fail, face, tx, type Db } from './db.ts';
import {
  audit,
  JOINED,
  need,
  pick,
  posInt,
  ROLES,
  type Actor,
  type Handler,
  type In,
} from './rules.ts';
import { teamHandlers } from './teams.ts';
import { eventHandlers } from './events.ts';
import { decideApplication, inviteNotice, recruitHandlers } from './recruit.ts';
import { mailHandlers } from './mail.ts';
import { AUDIT_AREAS, type AuditArea, type AuditEntry, type AuditPage } from '@fecpc/contracts';
import {
  checkProfile,
  PROFILE_FIELDS,
  PROFILE_LABEL,
  profileDiff,
  type ProfileChanges,
  type ProfileField,
} from '@fecpc/contracts';
import { challengeHandlers, problemset, sheetHandlers } from './sheets.ts';
import { learningHandlers } from './learning.ts';
import {
  forgetShared,
  isAdmin,
  isCommittee,
  loadState,
  progress,
  today,
  TZ,
  yesterday,
  type Progress,
} from './state.ts';

const person = (a: Actor) =>
  need(!a.system, 'This is an operator account, not a member. It cannot do that.');
const KEY = /^[\w:.&' /+#-]{1,80}$/;
const text = (v: unknown, min: number, max: number, what: string) => {
  // Plain text only: control characters are dropped, React escapes the rest on output.
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t.length < min || t.length > max)
    throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const mdText = (v: unknown, min: number, max: number, what: string) => {
  // Multiline Markdown text: preserve newlines/tabs, drop other control characters.
  const t =
    typeof v === 'string'
      ? v
          .replace(/\r\n?/g, '\n')
          .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
          .trim()
      : '';
  if (t.length < min || t.length > max)
    throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
export function excerptFromMarkdown(md: string, maxLen = 140): string {
  const flat = md
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > maxLen ? flat.slice(0, maxLen - 1).trimEnd() + '…' : flat;
}
const optionalUrl = (v: unknown, what: string): string | null => {
  if (v === undefined || v === null) return null;
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
  if (!t) return null;
  if (t.length > 400 || !/^https?:\/\/[^\s]+$/i.test(t))
    throw new Fail(400, `${what} must be a valid http(s) URL.`);
  return t;
};
// A posted job, from either entry point. Every field is bounded; the logo must be an http(s) URL like the link.
const jobFields = (i: In) => {
  const lines = (v: unknown, what: string) =>
    (Array.isArray(v) ? v : [])
      .map((x) => text(x, 0, 300, what))
      .filter(Boolean)
      .slice(0, 20);
  const deadline = i.deadline ? String(i.deadline) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))
    throw new Fail(400, 'The deadline must be a date.');
  const url = optionalUrl(i.url, 'Job URL');
  if (!url) throw new Fail(400, 'Job URL is required.');
  return {
    company: text(i.company, 1, 100, 'Company'),
    role: text(i.title || i.role, 1, 120, 'Role'),
    url,
    location: i.location ? text(i.location, 1, 100, 'Location') : null,
    vacancies: Math.min(999, posInt(i.vacancies ?? 1, 'vacancies')),
    jobType: i.job_type
      ? pick(i.job_type, ['Full-time', 'Part-time', 'Contract', 'Internship'] as const, 'job type')
      : 'Full-time',
    experience: i.experience ? text(i.experience, 1, 100, 'Experience') : null,
    salary: i.salary ? text(i.salary, 1, 100, 'Salary') : null,
    description: i.description ? mdText(i.description, 0, 6000, 'The description') || null : null,
    responsibilities: lines(i.responsibilities, 'A responsibility'),
    requirements: lines(i.requirements, 'A requirement'),
    deadline,
    logo: optionalUrl(i.company_logo_url, 'Company logo URL'),
  };
};
async function insertJob(c: Db, alumniId: string, j: ReturnType<typeof jobFields>) {
  const r = await c.query(
    `insert into alumni_jobs (
       alumni_id, company, role, title, location, url, source,
       vacancies, job_type, experience, salary, description, responsibilities, requirements, deadline, company_logo_url, posted_at
     ) values ($1, $2, $3, $3, $4, $5, 'manual', $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, coalesce($13::date, current_date + interval '30 days'), $14, now())
     returning id`,
    [
      alumniId,
      j.company,
      j.role,
      j.location,
      j.url,
      j.vacancies,
      j.jobType,
      j.experience,
      j.salary,
      j.description,
      JSON.stringify(j.responsibilities),
      JSON.stringify(j.requirements),
      j.deadline,
      j.logo,
    ],
  );
  return Number(r.rows[0].id);
}
/** A blog post's status from the editor's `published` switch or an explicit `status`; undefined when neither. */
const blogStatus = (i: In) =>
  typeof i.published === 'boolean'
    ? i.published
      ? ('published' as const)
      : ('draft' as const)
    : i.status === undefined
      ? undefined
      : pick(i.status, ['draft', 'published'] as const, 'status');
const FEED_CATS = ['problem-solving', 'upsolving', 'topic'] as const;
const FEED_CAT_ALIAS: Record<string, FeedCategory> = {
  'problem-solving': 'problem-solving',
  wins: 'problem-solving',
  upsolving: 'upsolving',
  help: 'upsolving',
  topic: 'topic',
  contests: 'topic',
};
const IDEA_TYPES = ['idea', 'teammate', 'study'] as const;
const IDEA_STATUSES = ['open', 'planned', 'shipped', 'closed'] as const;
const key = (v: unknown) => {
  if (typeof v !== 'string' || !KEY.test(v)) throw new Fail(400, 'That is not a valid item.');
  return v;
};
const tk = (n: number) => '৳' + n.toLocaleString('en');
const flip = (list: string[], id: string, on: boolean) =>
  on ? (list.includes(id) ? list : [...list, id]) : list.filter((x) => x !== id);

// What each personal list accepts. Anything else is refused, so a list can never hold an id that earns XP for nothing.
const lists: Record<string, (id: string) => boolean> = {
  solved: (id) => sheet.some((p) => p.id === id),
  done: (id) => wiki.some((w) => 'wiki:' + w.id === id),
  read: (id) => announcements.some((a) => a.id === id) || /^(an:\d{1,9}|n:[\w:.-]{1,70})$/.test(id),
};
// Shared switches: who may flip them. Everything not listed here is a personal preference.
const clubFlag = (k: string, r: Role[]): boolean | null =>
  k.startsWith('cd:') ? isCommittee(r) : k === 'unfrozen' ? !!can(r, 'event.publish') : null;

// Who a cheer lands on, or null when the target is not a real thing.
async function kudosOwner(c: Db, id: string): Promise<string | null> {
  const [kind, ref = ''] = id.split(/:(.*)/);
  if (kind === 'idea' && /^\d{1,9}$/.test(ref))
    return (
      (await c.query(`select user_id from ideas where id = $1`, [+ref])).rows[0]?.user_id ?? null
    );
  if (kind === 'member')
    return (
      (await c.query(`select id from users where id = $1 and not system`, [ref])).rows[0]?.id ??
      null
    );
  return null;
}

// Whether `id` is in the member's inbox. Announcements are the 50 newest (as the state lists them), checked
// directly; anything else is derived from the member's records, so it takes the whole state.
const inInbox = async (c: Db, userId: string, id: string) => {
  const an = /^an:(\d{1,9})$/.exec(id);
  if (an)
    return !!(
      await c.query(
        `select 1 from (select id from announcements order by id desc limit 50) x where id = $1`,
        [+an[1]!],
      )
    ).rowCount;
  return (await loadState(c, userId))!.inbox.some((n) => n.id === id);
};

async function setClub(c: Db, a: Actor, k: string, value: boolean | string) {
  await c.query(
    `insert into club (key, value, by) values ($1, $2, $3) on conflict (key) do update set value = excluded.value, by = excluded.by, at = now()`,
    [k, JSON.stringify(value), a.id],
  );
}

/** Records a wallet payment for the Treasurer to verify. The unique indexes stop a transaction ID paying twice. */
async function submitPayment(
  c: Db,
  a: Actor,
  i: Record<string, unknown>,
  inv: { id: string; label: string; amount: number },
) {
  const via = pick(i.via, ['bKash', 'Nagad', 'Rocket'] as const, 'wallet'),
    trx = String(i.trx ?? '')
      .trim()
      .toUpperCase(),
    sender = String(i.sender ?? '').trim();
  if (!/^[A-Z0-9]{8,12}$/.test(trx))
    throw new Fail(
      400,
      'A transaction ID is 8 to 12 letters and digits. Copy it from the wallet SMS.',
    );
  if (!/^01[3-9]\d{8}$/.test(sender))
    throw new Fail(400, 'Enter the 11-digit number the money was sent from.');
  // The two unique indexes are the rule; checking first would let two simultaneous submissions both pass.
  const r = await c.query(
    `insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, $2, $3, $4, $5, $6, $7) on conflict do nothing returning id`,
    [a.id, inv.id, inv.label, inv.amount, via, trx, sender],
  );
  if (!r.rows[0]) {
    const mine = (
      await c.query(
        `select 1 from payments where user_id = $1 and invoice_id = $2 and status <> 'rejected'`,
        [a.id, inv.id],
      )
    ).rowCount;
    throw new Fail(
      409,
      mine
        ? 'You have already submitted a payment for this invoice.'
        : 'That transaction ID has already been used. Check the SMS from your wallet and enter the ID exactly.',
    );
  }
  await audit(
    c,
    a,
    `submitted payment PAY-${r.rows[0].id} for ${inv.id} (${via}, ${tk(inv.amount)})`,
  );
}
/** An active member id, or null when cleared. */
async function memberOrNull(c: Db, v: unknown) {
  if (v === null || v === undefined || v === '') return null;
  const id = key(v);
  need(
    (await c.query(`select 1 from users where id = $1 and not system and not suspended`, [id]))
      .rowCount,
    'That member does not exist.',
  );
  return id;
}
const isoDay = (v: unknown, what: string) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)))
    throw new Fail(400, `${what} must be a date.`);
  return v;
};
/** Committee records: anyone on the committee edits them; only whoever created one, or an admin, deletes it. */
async function opsDelete(c: Db, a: Actor, table: string, id: unknown, what: string) {
  need(isCommittee(a.roles), 'Only the committee manages the workspace.');
  const n = posInt(id, what);
  const row = (
    await c.query(`select created_by, to_jsonb(t) ->> $2 as label from ${table} t where id = $1`, [
      n,
      table === 'inventory' ? 'name' : 'title',
    ])
  ).rows[0];
  if (!row) throw new Fail(404, `That ${what} does not exist.`);
  need(
    row.created_by === a.id || isAdmin(a.roles),
    `Only whoever added the ${what}, or an admin, deletes it.`,
  );
  await c.query(`delete from ${table} where id = $1`, [n]);
  await audit(c, a, `deleted ${what} "${row.label ?? `#${n}`}"`);
}

/** The account an officer may edit: not their own, not the operator, and the top two only by the Super Admin. */
async function editTarget(c: Db, a: Actor, user: unknown) {
  need(
    canFully(a.roles, 'member.editDetails'),
    'Only the Secretary or President edits member details.',
  );
  const t = (
    await c.query(`select id, name, role from users where id = $1 and not system for update`, [
      key(user),
    ])
  ).rows[0] as { id: string; name: string; role: Role } | undefined;
  if (!t) throw new Fail(404, 'That member does not exist.');
  need(t.id !== a.id, 'Ask another officer to change your own details.');
  need(
    !['president', 'super_admin'].includes(t.role) || a.roles.includes('super_admin'),
    'Only the Super Admin edits that account.',
  );
  return t;
}
const PROFILE_COLS = PROFILE_FIELDS.map(([k]) => k);
/** The values a change is compared against. */
const currentProfile = async (c: Db, userId: string): Promise<ProfileChanges> =>
  (await c.query(`select ${PROFILE_COLS.join(', ')} from users where id = $1`, [userId])).rows[0];
const fieldList = (ch: ProfileChanges) =>
  Object.keys(ch)
    .map((k) => PROFILE_LABEL[k as ProfileField] ?? k)
    .join(', ');
/**
 * One Codeforces handle per member: a handle another member already uses would hand them that member's stats and
 * XP. (Proving ownership of the handle is not checked; see docs/backend-audit.md.)
 */
async function handleFree(c: Db, h: string, userId: string) {
  const taken = await c.query(
    `select 1 from users where id <> $2 and not system
       and lower(coalesce(nullif(cf_handle, ''), handle)) = lower($1)`,
    [h, userId],
  );
  if (taken.rowCount) throw new Fail(409, 'Another member already uses that Codeforces handle.');
}

const CHANGE_BY_REQUEST =
  'Your handle is already linked. Ask for a change from your profile; the Secretary or President approves it.';
/** A judge handle can change but never be removed, and a Codeforces handle belongs to one member. */
async function handlesOk(c: Db, userId: string, ch: ProfileChanges) {
  if (ch.cf_handle === null || ch.vjudge_handle === null)
    throw new Fail(400, 'A judge handle can be changed, not removed.');
  if (typeof ch.cf_handle === 'string') await handleFree(c, ch.cf_handle, userId);
}

/** Writes checked changes. A new judge handle also resets what was synced from the old one. */
async function applyProfile(c: Db, userId: string, ch: ProfileChanges) {
  const cols = (Object.keys(ch) as ProfileField[]).filter((k) => PROFILE_COLS.includes(k));
  if (!cols.length) return;
  await handlesOk(c, userId, ch);
  const at = (k: ProfileField) => `$${cols.indexOf(k) + 2}`;
  const sets = cols.map((k) => (k === 'skills' ? `skills = ${at(k)}::text[]` : `${k} = ${at(k)}`));
  if (cols.includes('cf_handle')) sets.push(`handle = coalesce(${at('cf_handle')}, '')`);
  if (cols.includes('vjudge_handle'))
    sets.push(
      `vj_solved = case when vjudge_handle is distinct from ${at('vjudge_handle')} then 0 else vj_solved end`,
    );
  await c.query(`update users set ${sets.join(', ')}, updated_at = now() where id = $1`, [
    userId,
    ...cols.map((k) => ch[k]),
  ]);
}

const handlers: Record<string, Handler<Progress>> = {
  ...teamHandlers,
  ...eventHandlers,
  ...recruitHandlers,
  ...mailHandlers,
  ...sheetHandlers,
  ...challengeHandlers,
  ...learningHandlers,
  async toggle(c, a, p, i) {
    const id = key(i.id),
      list = String(i.list),
      now = (has: boolean) => (typeof i.on === 'boolean' ? i.on : !has);
    if (lists[list]) {
      need(lists[list](id), 'That item does not exist.');
      // Reading earns XP, so an inbox id or announcement must really be one this member was sent.
      if (list === 'read' && now(p.read.includes(id)) && !announcements.some((x) => x.id === id))
        need(await inInbox(c, a.id, id), 'That item does not exist.');
      const k = list as 'solved' | 'done' | 'read';
      p[k] = flip(p[k], id, now(p[k].includes(id)));
    } else if (list === 'kudos') {
      need(!id.startsWith('milestone:'), 'Use kudosMilestone for milestone kudos.');
      const has =
        (await c.query(`select 1 from reactions where user_id = $1 and target = $2`, [a.id, id]))
          .rowCount! > 0;
      if (now(has) && !has) {
        const owner = await kudosOwner(c, id);
        need(owner, 'That is not something you can cheer.');
        need(owner !== a.id, 'You cannot cheer your own work.');
      }
      // Kudos are permanent: each one is XP for whoever received it.
      need(now(has), 'Kudos cannot be taken back.');
      await c.query(`insert into reactions values ($1, $2) on conflict do nothing`, [a.id, id]);
    } else if (list === 'present') {
      // volunteer shifts; class attendance needs the room code (see `attend`)
      const shift = volunteerShifts.find((v) => 'vol:' + v[0] === id);
      need(shift, 'That shift does not exist.');
      await c.query(`select pg_advisory_xact_lock(hashtext($1))`, [id]); // two people cannot take the last place
      const has =
        (await c.query(`select 1 from attendance where user_id = $1 and key = $2`, [a.id, id]))
          .rowCount! > 0;
      if (!now(has))
        return void (await c.query(`delete from attendance where user_id = $1 and key = $2`, [
          a.id,
          id,
        ]));
      const taken = (await c.query(`select count(*)::int n from attendance where key = $1`, [id]))
        .rows[0].n;
      if (!has && shift![3] + taken >= shift![2]) throw new Fail(409, 'That shift just filled up.');
      await c.query(`insert into attendance values ($1, $2) on conflict do nothing`, [a.id, id]);
    } else throw new Fail(400, 'Unknown list.');
  },
  async readAll(c, a, p) {
    p.read = [...new Set([...p.read, ...(await loadState(c, a.id))!.inbox.map((n) => n.id)])].slice(
      -500,
    );
  },
  async checkin(_c, _a, p) {
    if (p.checkin === today()) return;
    p.run = p.checkin === yesterday() ? p.run + 1 : 1;
    p.checkin = today();
  },
  async flag(c, a, p, i) {
    const k = key(i.key);
    if (typeof i.on !== 'boolean') throw new Fail(400, 'Expected on or off.');
    need(!/^(susp|post|role|mod|rule):|^(remind|risk)/.test(k), 'That switch does not exist.');
    const shared = clubFlag(k, a.roles);
    if (shared !== null) {
      need(shared);
      await setClub(c, a, 'flag:' + k, i.on);
      if (k === 'unfrozen')
        await audit(
          c,
          a,
          i.on ? 'unfroze the contest scoreboard' : 'refroze the contest scoreboard',
        );
      return;
    }
    if (!(k in p.flags) && Object.keys(p.flags).length >= 300)
      throw new Fail(400, 'Too many saved preferences.');
    p.flags[k] = i.on;
  },
  async kv(c, a, p, i) {
    const k = key(i.key),
      v = text(i.value, 0, 200, 'Value');
    need(!/^(task|inv):/.test(k), 'Tasks and equipment have their own actions now.');
    need(!k.startsWith('role:'), 'Use the role action for that.');
    need(!k.startsWith('fee:'), 'Dues are set with the setFee action.');
    if (k.startsWith('conf:')) {
      need(
        sheet.some((x) => x.id === k.slice(5)),
        'That problem does not exist.',
      );
      pick(v, ['shaky', 'ok', 'solid'], 'confidence');
    }
    if (k === 'rate') pick(v, ['1', '2', '3', '4', '5'], 'rating');
    if (k.startsWith('fantasy')) {
      // A fantasy team is only ever picked for next week (keyed by its Monday, club time): this week's is locked,
      // so nobody picks after seeing the results.
      const next = (
        await c.query(
          `select (date_trunc('week', now() at time zone '${TZ}') + interval '7 days')::date::text as d`,
        )
      ).rows[0].d;
      need(k === `fantasy:${next}`, "This week's team is locked. Pick for next week.");
      const ids = [...new Set(v.split(',').filter(Boolean))];
      need(ids.length <= 3, 'Pick at most three members.');
      const n = (
        await c.query(`select count(*)::int n from users where id = any($1) and not system`, [ids])
      ).rows[0].n;
      need(n === ids.length, 'One of those members does not exist.');
      return void (p.kv[k] = ids.join(','));
    }
    if (!(k in p.kv) && Object.keys(p.kv).length >= 200)
      throw new Fail(400, 'Too many saved preferences.');
    p.kv[k] = v;
  },
  async vote(c, a, _p, i) {
    person(a);
    const poll = key(i.poll),
      option = text(i.option, 1, 80, 'Option');
    const once = poll === 'fb:freshers'; // a feedback rating cannot be changed
    if (poll === 'fb:freshers') pick(option, ['1', '2', '3', '4', '5'], 'rating');
    else
      need(
        (
          await c.query(`select 1 from club_polls where 'poll:' || id = $1 and $2 = any(options)`, [
            poll,
            option,
          ])
        ).rowCount,
        'That is not an option in this poll.',
      );
    const r = await c.query(
      `insert into votes values ($1, $2, $3) on conflict (user_id, poll_id) do ${once ? 'nothing' : 'update set option = excluded.option'}`,
      [a.id, poll, option],
    );
    if (once && !r.rowCount) throw new Fail(409, 'You have already rated this event.');
  },
  // The first link is the member's own; after that a judge handle changes only through an approved profile
  // request (profileRequest), and is never removed.
  async handle(c, a, _p, i) {
    const h = typeof i.value === 'string' ? i.value.trim() : '';
    if (!/^[\w.-]{3,24}$/.test(h)) throw new Fail(400, 'That is not a valid Codeforces handle.');
    await handleFree(c, h, a.id);
    const r = await c.query(
      `update users set cf_handle = $2, handle = $2 where id = $1 and coalesce(nullif(cf_handle, ''), handle, '') = ''`,
      [a.id, h],
    );
    if (!r.rowCount) throw new Fail(409, CHANGE_BY_REQUEST);
    await audit(c, a, `linked Codeforces handle ${h}`);
  },
  async vjudge(c, a, _p, i) {
    const h = typeof i.value === 'string' ? i.value.trim() : '';
    if (!/^[\w.-]{2,30}$/.test(h)) throw new Fail(400, 'That is not a valid VJudge username.');
    // syncVjudge fills the count from VJudge itself.
    const r = await c.query(
      `update users set vj_solved = 0, vjudge_handle = $2 where id = $1 and coalesce(vjudge_handle, '') = ''`,
      [a.id, h],
    );
    if (!r.rowCount) throw new Fail(409, CHANGE_BY_REQUEST);
    await audit(c, a, `linked VJudge handle ${h}`);
  },
  async pay(c, a, _p, i) {
    person(a);
    // The same list the member sees: their own periods and the fees of events they are registered for.
    const inv = (await loadState(c, a.id))!.s.dues.find((d) => d.id === i.invoice);
    need(inv, 'That invoice does not exist, or is not yours.');
    need(
      !(
        await c.query(
          `select 1 from waiver_requests where user_id = $1 and invoice_id = $2 and status = 'waived'`,
          [a.id, inv.id],
        )
      ).rowCount,
      'That invoice was waived; there is nothing to pay.',
    );
    await submitPayment(c, a, i, inv);
  },
  async contribute(c, a, _p, i) {
    person(a);
    need(a.roles.includes('alumni'), 'Contributions are for alumni; members pay their dues.');
    const amount = Number(i.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000)
      throw new Fail(400, 'Enter a whole amount in taka.');
    // Each contribution is its own record; the transaction ID keeps the id unique.
    const trx = String(i.trx ?? '')
      .trim()
      .toUpperCase();
    await submitPayment(c, a, i, { id: 'GIFT-' + trx, label: CONTRIBUTION, amount });
  },
  async setFee(c, a, _p, i) {
    need(canFully(a.roles, 'finance.fee'), 'Only the President or Secretary sets the dues.');
    const kind = pick(i.kind, ['term', 'post'] as const, 'fee');
    const amount = Number(i.amount);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100_000)
      throw new Fail(400, 'Enter a whole amount in taka, or 0 for no fee.');
    await setClub(c, a, 'kv:' + FEE_KEYS[kind], String(amount));
    await audit(
      c,
      a,
      `set ${kind === 'term' ? 'member' : 'post'} dues to ${tk(amount)} per 3 months`,
    );
  },
  async announce(c, a, _p, i) {
    need(can(a.roles, 'announce.post'));
    const title = text(i.title, 3, 140, 'The title');
    const bodyMd =
      i.body_md !== undefined && String(i.body_md).trim() !== ''
        ? mdText(i.body_md, 1, 6000, 'The message')
        : '';
    const pinned = Boolean(i.pinned);
    const requiresAck = Boolean(i.requires_ack);
    await c.query(
      `insert into announcements (user_id, title, body_md, pinned, requires_ack) values ($1, $2, $3, $4, $5)`,
      [a.id, title, bodyMd, pinned, requiresAck],
    );
    await audit(c, a, `posted announcement "${title}"`);
  },
  async markAnnouncementRead(c, a, p, i) {
    const raw = String(i.id ?? '').trim();
    const id = /^\d{1,9}$/.test(raw) ? 'an:' + raw : key(raw);
    const isSeed = announcements.some((x) => x.id === id);
    // Only one this member can see.
    if (!isSeed)
      need(
        /^an:\d{1,9}$/.test(id) && (await inInbox(c, a.id, id)),
        'That announcement does not exist.',
      );
    await c.query(
      `insert into announcement_reads (announcement_id, user_id) values ($1, $2) on conflict do nothing`,
      [id, a.id],
    );
    if (!p.read.includes(id)) p.read = [...p.read, id];
  },
  async createFeedPost(c, a, _p, i) {
    person(a);
    need(can(a.roles, 'feed.post'));
    const title = text(i.title, 3, 160, 'Title');
    const bodyMd = mdText(i.body_md, 3, 10000, 'Post body');
    const category = pick(i.category, FEED_CATS, 'category');
    await c.query(
      `insert into feed_posts (user_id, title, body_md, category) values ($1, $2, $3, $4)`,
      [a.id, title, bodyMd, category],
    );
  },
  async voteFeed(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, 'post');
    const rawVal = Number(i.value);
    if (rawVal !== -1 && rawVal !== 0 && rawVal !== 1)
      throw new Fail(400, 'Vote must be -1, 0, or 1.');
    const post = (
      await c.query(`select id, score from feed_posts where id = $1 for update`, [postId])
    ).rows[0];
    if (!post) throw new Fail(404, 'That post does not exist.');
    const cur = (
      await c.query(`select value from feed_votes where user_id = $1 and post_id = $2`, [
        a.id,
        postId,
      ])
    ).rows[0];
    const prev: number = cur ? Number(cur.value) : 0;
    const next = rawVal === prev ? 0 : rawVal;
    if (next === 0)
      await c.query(`delete from feed_votes where user_id = $1 and post_id = $2`, [a.id, postId]);
    else
      await c.query(
        `insert into feed_votes (user_id, post_id, value) values ($1, $2, $3) on conflict (user_id, post_id) do update set value = excluded.value, created_at = now()`,
        [a.id, postId, next],
      );
    const delta = next - prev;
    if (delta !== 0)
      await c.query(`update feed_posts set score = score + $2 where id = $1`, [postId, delta]);
  },
  async updateFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, 'post');
    const title = text(i.title, 3, 160, 'Title');
    const bodyMd = mdText(i.body_md, 3, 10000, 'Post body');
    const r = await c.query(
      `update feed_posts set title = $2, body_md = $3, updated_at = now() where id = $1 and user_id = $4 returning id`,
      [postId, title, bodyMd, a.id],
    );
    if (!r.rows[0]) throw new Fail(403, 'Only the author can edit this post.');
  },
  async deleteFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, 'post');
    const r = await c.query(`delete from feed_posts where id = $1 and user_id = $2 returning id`, [
      postId,
      a.id,
    ]);
    if (!r.rows[0]) throw new Fail(403, 'Only the author can delete this post.');
  },
  async contestDay(c, a, _p, i) {
    need(can(a.roles, 'contest.run'));
    const list = Array.isArray(i.contests) ? i.contests.slice(0, 20) : [];
    const clean = (list as Record<string, unknown>[]).map((x) => {
      const id = String(x?.id ?? ''),
        at = String(x?.addedAt ?? '');
      if (!/^\d{1,9}$/.test(id)) throw new Fail(400, 'Contest IDs are VJudge numbers.');
      return {
        id,
        name: text(x?.name, 1, 120, 'The contest name'),
        type: pick(x?.type, ['running', 'previous'] as const, 'contest type'),
        addedAt: /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : today(),
      };
    });
    need(new Set(clean.map((x) => x.id)).size === clean.length, 'That contest is already listed.');
    await setClub(c, a, 'kv:contests', JSON.stringify(clean));
    await audit(c, a, `set the contest-day scoreboard (${clean.map((x) => x.id).join(', ')})`);
  },
  async moderateFeedPost(c, a, _p, i) {
    need(can(a.roles, 'feed.moderate'));
    const postId = posInt(i.postId, 'post'),
      decision = pick(i.decision, ['remove', 'dismiss'] as const, 'decision');
    const post = (await c.query(`select title from feed_posts where id = $1`, [postId])).rows[0];
    if (!post) throw new Fail(404, 'That post does not exist.');
    if (decision === 'remove') await c.query(`delete from feed_posts where id = $1`, [postId]);
    else await c.query(`delete from feed_reports where post_id = $1`, [postId]);
    await audit(
      c,
      a,
      `${decision === 'remove' ? 'removed' : 'cleared reports on'} feed post #${postId} ("${post.title}")`,
    );
  },
  async deleteAnnouncement(c, a, _p, i) {
    const id = posInt(String(i.id ?? '').replace(/^an:/, ''), 'announcement');
    const r = await c.query(
      `delete from announcements where id = $1 and (user_id = $2 or $3) returning title`,
      [id, a.id, canFully(a.roles, 'announce.post')],
    );
    need(r.rows[0], 'Only the author or an officer can delete this announcement.');
    await c.query(`delete from announcement_reads where announcement_id = $1`, ['an:' + id]);
    await audit(c, a, `deleted announcement "${r.rows[0].title}"`);
  },
  async createPoll(c, a, _p, i) {
    need(canFully(a.roles, 'poll.create'));
    const question = text(i.question, 3, 160, 'The question');
    const raw = Array.isArray(i.options) ? i.options : [];
    const options = [...new Set(raw.map((o) => text(o, 1, 80, 'An option')))];
    if (options.length < 2 || options.length > 8)
      throw new Fail(400, 'A poll needs 2 to 8 different options.');
    await c.query(`insert into club_polls (user_id, question, options) values ($1, $2, $3)`, [
      a.id,
      question,
      options,
    ]);
    await audit(c, a, `created poll "${question}"`);
  },
  async deletePoll(c, a, _p, i) {
    const id = posInt(String(i.id ?? '').replace(/^poll:/, ''), 'poll');
    const r = await c.query(
      `delete from club_polls where id = $1 and (user_id = $2 or $3) returning question`,
      [id, a.id, canFully(a.roles, 'poll.create')],
    );
    need(r.rows[0], 'Only the author or an officer can delete this poll.');
    await c.query(`delete from votes where poll_id = $1`, ['poll:' + id]);
    await audit(c, a, `deleted poll "${r.rows[0].question}"`);
  },
  async reportFeedPost(c, a, _p, i) {
    person(a);
    const postId = posInt(i.postId, 'post');
    const post = (await c.query(`select user_id, title from feed_posts where id = $1`, [postId]))
      .rows[0];
    if (!post) throw new Fail(404, 'That post does not exist.');
    need(post.user_id !== a.id, 'You cannot report your own post.');
    const reason = i.reason ? text(i.reason, 1, 300, 'Reason') : 'Flagged by member';
    await c.query(
      `insert into feed_reports (post_id, user_id, reason) values ($1, $2, $3) on conflict do nothing`,
      [postId, a.id, reason],
    );
    await audit(c, a, `reported feed post #${postId} ("${post.title}")`);
  },
  async createIdea(c, a, _p, i) {
    person(a);
    need(can(a.roles, 'idea.create'));
    const title = text(i.title, 3, 160, 'Title');
    const bodyMd = mdText(i.body_md, 3, 10000, 'Description');
    const rawType = i.ideaType ?? (i.type !== 'createIdea' ? i.type : undefined);
    const type = pick(rawType, IDEA_TYPES, 'type');
    const rawRoles = Array.isArray(i.roles) ? i.roles : [];
    const rolesList = rawRoles
      .map((r) => (typeof r === 'string' ? r.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : ''))
      .filter(Boolean)
      .slice(0, 3);
    for (const r of rolesList)
      if (r.length > 140) throw new Fail(400, 'Each role prompt must be under 140 characters.');
    await c.query(
      `insert into ideas (user_id, title, body_md, type, roles) values ($1, $2, $3, $4, $5::jsonb)`,
      [a.id, title, bodyMd, type, JSON.stringify(rolesList)],
    );
  },
  async updateIdea(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, 'idea');
    const cur = (await c.query(`select user_id, status from ideas where id = $1`, [ideaId]))
      .rows[0];
    if (!cur) throw new Fail(404, 'That idea does not exist.');
    need(
      cur.user_id === a.id || canFully(a.roles, 'idea.manage'),
      'Only the poster or an admin can edit this idea.',
    );
    const title = text(i.title, 3, 160, 'Title');
    const bodyMd = mdText(i.body_md, 3, 10000, 'Description');
    const status = i.status !== undefined ? pick(i.status, IDEA_STATUSES, 'status') : cur.status;
    await c.query(
      `update ideas set title = $2, body_md = $3, status = $4, updated_at = now() where id = $1`,
      [ideaId, title, bodyMd, status],
    );
    if (cur.user_id !== a.id) await audit(c, a, `edited ${cur.user_id}'s idea "${title}"`);
  },
  async closeIdea(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, 'idea');
    const cur = (await c.query(`select user_id from ideas where id = $1`, [ideaId])).rows[0];
    if (!cur) throw new Fail(404, 'That idea does not exist.');
    need(
      cur.user_id === a.id || canFully(a.roles, 'idea.manage'),
      'Only the poster or an admin can close this idea.',
    );
    const t = (
      await c.query(
        `update ideas set status = 'closed', updated_at = now() where id = $1 returning title`,
        [ideaId],
      )
    ).rows[0];
    // A member closing their own idea is their business; a moderator closing someone else's is logged.
    if (cur.user_id !== a.id) await audit(c, a, `closed ${cur.user_id}'s idea "${t.title}"`);
  },
  async markIdeaViewed(c, a, _p, i) {
    const ideaId = posInt(i.ideaId, 'idea');
    const exists = (await c.query(`select 1 from ideas where id = $1`, [ideaId])).rowCount! > 0;
    if (!exists) throw new Fail(404, 'That idea does not exist.');
    await c.query(
      `insert into idea_views (idea_id, user_id) values ($1, $2) on conflict do nothing`,
      [ideaId, a.id],
    );
  },
  async expressInterest(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, 'idea');
    const idea = (await c.query(`select user_id, status, roles from ideas where id = $1`, [ideaId]))
      .rows[0];
    if (!idea) throw new Fail(404, 'That idea does not exist.');
    need(idea.user_id !== a.id, 'You cannot express interest in your own post.');
    if (idea.status === 'closed') throw new Fail(409, 'This post is closed.');
    // Only the poster's own questions are stored, and each one must be answered.
    const given =
      i.response && typeof i.response === 'object' && !Array.isArray(i.response)
        ? (i.response as Record<string, unknown>)
        : {};
    const cleanResp: Record<string, string> = {};
    for (const prompt of (idea.roles ?? []) as string[])
      cleanResp[prompt] = text(given[prompt], 1, 500, `Your answer to “${prompt}”`);
    await c.query(
      `insert into idea_interests (idea_id, user_id, response, status) values ($1, $2, $3::jsonb, 'pending')
       on conflict (idea_id, user_id) do update set response = excluded.response`,
      [ideaId, a.id, JSON.stringify(cleanResp)],
    );
  },
  async decideInterest(c, a, _p, i) {
    person(a);
    const ideaId = posInt(i.ideaId, 'idea');
    const applicant = key(i.userId);
    const decision = pick(i.decision, ['accepted', 'declined'] as const, 'decision');
    const idea = (await c.query(`select user_id from ideas where id = $1`, [ideaId])).rows[0];
    if (!idea) throw new Fail(404, 'That idea does not exist.');
    need(idea.user_id === a.id, 'Only the poster can decide on interested members.');
    const r = await c.query(
      `update idea_interests set status = $3, decided_at = now() where idea_id = $1 and user_id = $2 returning idea_id`,
      [ideaId, applicant, decision],
    );
    if (!r.rows[0]) throw new Fail(404, 'That interest request does not exist.');
  },
  async send(c, a, _p, i) {
    const kind = pick(i.kind, ['suggest', 'feedback'] as const, 'message');
    const body = text(i.body, kind === 'feedback' ? 1 : 3, 1000, 'Your message');
    // A suggestion is anonymous for real: the sender is not written anywhere, not even to the audit log.
    await c.query(`insert into messages (kind, user_id, body) values ($1, $2, $3)`, [
      kind,
      kind === 'suggest' ? null : a.id,
      body,
    ]);
  },
  async expense(c, a, _p, i) {
    need(isCommittee(a.roles), 'Only committee members file expense requests.');
    const amount = Number(i.amount),
      what = text(i.what, 3, 140, 'The description'),
      event = text(i.event, 0, 80, 'The event');
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000)
      throw new Fail(400, 'Enter the amount in whole taka, up to 1,000,000.');
    const r = await c.query(
      `insert into expenses (by, what, amount, event) values ($1, $2, $3, $4) returning id`,
      [a.id, what, amount, event],
    );
    await audit(c, a, `requested expense EXP-${r.rows[0].id} (${tk(amount)}): ${what}`);
  },
  // A member's name, department and batch are club records: only the Secretary or President changes them, never
  // the member, and every change is audited with what it was before.
  async profile(c, a, _p, i) {
    need(
      canFully(a.roles, 'member.editDetails'),
      'Only the Secretary or President edits member details.',
    );
    const name = text(i.name, 2, 80, 'The name'),
      dept = text(i.dept, 2, 20, 'Department'),
      batch = Number(i.batch);
    if (!Number.isInteger(batch) || batch < 0 || batch > 99)
      throw new Fail(400, 'Batch is a two-digit number, like 24.');
    const t = (
      await c.query(
        `select id, name, dept, batch, role from users where id = $1 and not system for update`,
        [key(i.user)],
      )
    ).rows[0];
    if (!t) throw new Fail(404, 'That member does not exist.');
    need(t.id !== a.id, 'Ask another officer to change your own details.');
    // The top two are the Super Admin's, as with every other account change.
    need(
      !['president', 'super_admin'].includes(t.role) || a.roles.includes('super_admin'),
      'Only the Super Admin edits that account.',
    );
    await c.query(`update users set name = $2, dept = $3, batch = $4 where id = $1`, [
      t.id,
      name,
      dept,
      batch,
    ]);
    const changed = (
      [
        ['name', t.name, name],
        ['department', t.dept, dept],
        ['batch', t.batch, batch],
      ] as const
    ).filter(([, x, y]) => x !== y);
    if (changed.length)
      await audit(
        c,
        a,
        `edited ${t.name}'s details: ${changed.map(([k, x, y]) => `${k} ${x} → ${y}`).join(', ')}`,
      );
  },
  async decide(c, a, _p, i) {
    const kind = pick(i.kind, ['payment', 'expense', 'application'] as const, 'decision'),
      id = key(i.id),
      to = String(i.to);
    if (kind === 'payment') {
      need(canFully(a.roles, 'payments.verify'), 'Only the Treasurer verifies payments.');
      pick(to, ['verified', 'rejected'], 'decision');
      const n = /^PAY-(\d{1,9})$/.exec(id);
      need(n, 'That payment does not exist.');
      const note = to === 'rejected' ? text(i.reason, 3, 200, 'The reason for rejecting') : null; // the member is shown this
      const r = await c.query(
        `update payments set status = $2, decided_by = $3, note = $4, decided_at = now(), updated_at = now() where id = $1 and status = 'pending' and user_id <> $3 returning amount, via`,
        [+n[1]!, to, a.id, note],
      );
      if (!r.rows[0])
        throw new Fail(
          409,
          'That payment is already decided, or it is your own: someone else must verify it.',
        );
      return void (await audit(
        c,
        a,
        `${to} payment ${id} (${tk(r.rows[0].amount)}, ${r.rows[0].via})${note ? `: ${note}` : ''}`,
      ));
    }
    if (kind === 'application') {
      need(can(a.roles, 'application.approve'));
      pick(to, ['accepted', 'declined'], 'decision');
      need(/^\d{1,9}$/.test(id), 'That application does not exist.');
      const reason = to === 'declined' && i.reason ? text(i.reason, 3, 200, 'The reason') : null;
      const done = await decideApplication(c, a, +id, to as 'accepted' | 'declined', reason);
      if (!done)
        throw new Fail(
          409,
          'That application is already decided, or a member already uses its email.',
        );
      return to === 'accepted' ? inviteNotice(c, [done]) : undefined;
    }
    // Expenses: two-person rules. Nobody decides their own request.
    {
      const n = /^EXP-(\d{1,9})$/.exec(id),
        lvl = can(a.roles, 'expense.approve');
      need(lvl);
      need(n, 'That expense does not exist.');
      const x = (
        await c.query(
          `select by, amount, status, decided_by from expenses where id = $1 for update`,
          [+n[1]!],
        )
      ).rows[0]; // the lock makes two simultaneous decisions take turns
      need(x, 'That expense does not exist.');
      need(x.by !== a.id, 'You cannot decide your own expense request.');
      const big = x.amount > APPROVAL_THRESHOLD;
      if (x.status !== 'pending' && !(x.status === 'sent to President' && lvl === true))
        throw new Fail(409, 'That expense has already been decided.');
      // Above the threshold two different people must agree: one passes it up, another with full authority decides. Nobody skips the first step.
      if (big && x.status === 'pending')
        pick(
          to,
          ['sent to President'],
          'decision: a large expense is first passed up, then decided by a second officer',
        );
      else pick(to, ['approved', 'rejected'], 'decision');
      if (big && x.status === 'sent to President')
        need(
          x.decided_by !== a.id,
          'A second officer has to make the final decision on an expense you passed up.',
        );
      await c.query(
        `update expenses set status = $2, decided_by = $3, decided_at = now(), updated_at = now() where id = $1`,
        [+n[1]!, to, a.id],
      );
      return void (await audit(
        c,
        a,
        to === 'sent to President'
          ? `proposed expense ${id} to the President`
          : `${to} expense ${id} (${tk(x.amount)})`,
      ));
    }
  },
  async saveTask(c, a, _p, i) {
    need(isCommittee(a.roles), 'Only the committee manages the workspace.');
    const v = [
      text(i.title, 3, 140, 'The task'),
      await memberOrNull(c, i.who),
      isoDay(i.due, 'The due date'),
      pick(i.col ?? 'To do', cols, 'column'),
    ];
    if (i.id === undefined || i.id === null) {
      await c.query(
        `insert into committee_tasks (title, who, due, col, created_by) values ($1, $2, $3, $4, $5)`,
        [...v, a.id],
      );
      return void (await audit(c, a, `added task: ${v[0]}`));
    }
    const r = await c.query(
      `update committee_tasks set title = $2, who = $3, due = $4, col = $5 where id = $1`,
      [posInt(i.id, 'task'), ...v],
    );
    if (!r.rowCount) throw new Fail(404, 'That task does not exist.');
  },
  async deleteTask(c, a, _p, i) {
    await opsDelete(c, a, 'committee_tasks', i.id, 'task');
  },
  async saveItem(c, a, _p, i) {
    need(isCommittee(a.roles), 'Only the committee manages the workspace.');
    const name = text(i.name, 2, 80, 'The item');
    if (i.id === undefined || i.id === null) {
      // Who has it from the start: nobody, yourself, or (admins) anyone. The same rule as handing it over.
      const holder = await memberOrNull(c, i.holder);
      need(
        holder === null || holder === a.id || isAdmin(a.roles),
        'Only an admin hands equipment to someone else.',
      );
      await c.query(`insert into inventory (name, holder, created_by) values ($1, $2, $3)`, [
        name,
        holder,
        a.id,
      ]);
      return void (await audit(
        c,
        a,
        `added equipment: ${name}${holder ? `, with ${holder}` : ''}`,
      ));
    }
    const r = await c.query(`update inventory set name = $2 where id = $1`, [
      posInt(i.id, 'item'),
      name,
    ]);
    if (!r.rowCount) throw new Fail(404, 'That item does not exist.');
  },
  async saveDoc(c, a, _p, i) {
    need(isCommittee(a.roles), 'Only the committee manages the workspace.');
    const title = text(i.title, 3, 120, 'The title'),
      about = text(i.about ?? '', 0, 300, 'The description'),
      url = optionalUrl(i.url, 'The link');
    need(url, 'Add a link to the document.');
    await c.query(`insert into documents (title, about, url, created_by) values ($1, $2, $3, $4)`, [
      title,
      about,
      url,
      a.id,
    ]);
    await audit(c, a, `added document: ${title}`);
  },
  async deleteDoc(c, a, _p, i) {
    await opsDelete(c, a, 'documents', i.id, 'document');
  },
  async deleteItem(c, a, _p, i) {
    await opsDelete(c, a, 'inventory', i.id, 'item');
  },
  // Check out (to yourself), return (to nobody) or hand to someone (admins). A held item cannot be taken.
  async holdItem(c, a, _p, i) {
    need(isCommittee(a.roles), 'Only the committee manages the workspace.');
    const item = (
      await c.query(`select id, name, holder from inventory where id = $1 for update`, [
        posInt(i.id, 'item'),
      ])
    ).rows[0];
    if (!item) throw new Fail(404, 'That item does not exist.');
    const to = await memberOrNull(c, i.to);
    if (to === null)
      need(
        item.holder === a.id || isAdmin(a.roles),
        'Only the person holding it, or an admin, can return it.',
      );
    else if (to === a.id) {
      if (item.holder) throw new Fail(409, 'That item is already checked out.');
    } else need(isAdmin(a.roles), 'Only an admin hands equipment to someone else.');
    await c.query(`update inventory set holder = $2 where id = $1`, [item.id, to]);
    await audit(c, a, `${to ? `gave ${item.name} to ${to}` : `returned ${item.name}`}`);
  },
  // Event budgets: the Treasurer plans them; what is spent comes from approved expenses filed under the name.
  async saveBudget(c, a, _p, i) {
    need(canFully(a.roles, 'payments.verify'), 'Only the Treasurer edits budgets.');
    const name = text(i.name, 3, 80, 'The budget name'),
      plan = Number(i.plan);
    if (!Number.isInteger(plan) || plan < 1 || plan > 10_000_000)
      throw new Fail(400, 'Enter the plan in whole taka, up to 10,000,000.');
    const r =
      i.id === undefined || i.id === null
        ? await c.query(
            `insert into budgets (name, plan) values ($1, $2) on conflict (name) do nothing`,
            [name, plan],
          )
        : await c.query(
            `update budgets set name = $2, plan = $3 where id = $1 and not exists (select 1 from budgets where name = $2 and id <> $1)`,
            [posInt(i.id, 'budget'), name, plan],
          );
    if (!r.rowCount)
      throw new Fail(409, 'That budget does not exist, or another one has that name.');
    await audit(c, a, `set budget ${name}: ${tk(plan)}`);
  },
  async deleteBudget(c, a, _p, i) {
    need(canFully(a.roles, 'payments.verify'), 'Only the Treasurer edits budgets.');
    const r = await c.query(`delete from budgets where id = $1 returning name`, [
      posInt(i.id, 'budget'),
    ]);
    if (!r.rows[0]) throw new Fail(404, 'That budget does not exist.');
    await audit(c, a, `deleted budget ${r.rows[0].name}`);
  },
  // Raw roles are the Super Admin's: they make the President. Everyone else gets permissions through a post.
  async role(c, a, _p, i) {
    need(a.role === 'super_admin', 'Only the Super Admin changes roles. Assign a post instead.');
    const role = pick(i.role, roles, 'role'),
      reason = text(i.reason, 3, 200, 'The reason'),
      user = key(i.user);
    need(user !== a.id, 'You cannot change your own role.');
    // One President, always: the office only changes hands through appointPresident.
    need(
      role !== 'president',
      'Appoint a new President instead; the current one becomes a member.',
    );
    // The public title follows the role and the post is cleared, so a demoted officer keeps neither.
    const r = await c.query(
      `update users set role = $2, title = $3, post = null where id = $1 and not system and role <> 'president' returning name`,
      [user, role, role === 'member' ? null : roleName[role]],
    );
    if (!r.rows[0])
      throw new Fail(
        404,
        'That member does not exist, or is the President: appoint a new one instead.',
      );
    await audit(c, a, `assigned role ${roleName[role]} to ${r.rows[0].name} (reason: ${reason})`);
  },
  async post(c, a, _p, i) {
    need(canFully(a.roles, 'roles.assign'));
    const post = i.post === null || i.post === '' ? null : pick(i.post, posts, 'post'),
      user = key(i.user);
    need(user !== a.id, 'You cannot change your own post.');
    const r = await c.query(
      `update users set post = $2, title = $3 where id = $1 and not system and role not in ('president', 'super_admin') returning name`,
      [user, post, post && post !== 'member' ? postName[post] : null],
    );
    if (!r.rows[0]) throw new Fail(404, 'That member does not exist, or outranks you.');
    await audit(c, a, `assigned post ${post ? postName[post] : 'none'} to ${r.rows[0].name}`);
  },
  // One President at a time. The email is checked again against the chosen account right before the swap.
  async appointPresident(c, a, _p, i) {
    need(a.role === 'super_admin', 'Only the Super Admin appoints the President.');
    const user = key(i.user),
      email = text(i.email, 5, 200, 'Email').toLowerCase();
    need(user !== a.id, 'You cannot appoint yourself.');
    const next = (
      await c.query(
        `select name from users where id = $1 and lower(email) = $2 and not system and not suspended and status = 'active' for update`,
        [user, email],
      )
    ).rows[0];
    if (!next) throw new Fail(404, 'No active member has that email.');
    const old = await c.query(
      `update users set role = 'member', title = null, post = null where role = 'president' and id <> $1 returning name`,
      [user],
    );
    await c.query(
      `update users set role = 'president', title = 'President', post = null where id = $1`,
      [user],
    );
    await audit(
      c,
      a,
      `appointed ${next.name} President${old.rows.length ? `, replacing ${old.rows.map((r) => r.name).join(', ')}` : ''}`,
    );
  },
  // Which roles a post grants. Super Admin only, and never President or Super Admin.
  async postRole(c, a, _p, i) {
    need(a.role === 'super_admin', 'Only the Super Admin sets what a post grants.');
    const post = pick(i.post, posts, 'post'),
      role = pick(i.role, postableRoles, 'role');
    if (typeof i.on !== 'boolean') throw new Fail(400, 'Expected on or off.');
    await c.query(
      `insert into post_roles (post, roles) values ($1, case when $3 then array[$2] else '{}' end)
       on conflict (post) do update set roles = case when $3
         then array(select distinct unnest(post_roles.roles || array[$2]))
         else array_remove(post_roles.roles, $2) end`,
      [post, role, i.on],
    );
    await audit(
      c,
      a,
      `${i.on ? 'gave' : 'took'} ${roleName[role]} ${i.on ? 'to' : 'from'} post ${postName[post]}`,
    );
  },
  /** Suspends (signed out everywhere, no sign-in) or reinstates a member. */
  async suspend(c, a, _p, i) {
    need(
      canFully(a.roles, 'member.deactivate'),
      'Only the President or Super Admin suspends members.',
    );
    const user = key(i.user);
    if (typeof i.on !== 'boolean') throw new Fail(400, 'Expected on or off.');
    need(user !== a.id, 'You cannot suspend yourself.');
    const r = await c.query(
      `update users set suspended = $2, status = case when $2 then 'suspended' when not ${JOINED()} then 'invited' else 'active' end
       where id = $1 and not system and (role not in ('president', 'super_admin') or $3) returning name`,
      [user, i.on, a.role === 'super_admin'],
    );
    if (!r.rows[0]) throw new Fail(404, 'That member does not exist, or outranks you.');
    if (i.on) await c.query(`delete from sessions where user_id = $1`, [user]); // signed out everywhere, immediately
    await audit(c, a, `${i.on ? 'suspended' : 'reinstated'} ${r.rows[0].name}`);
  },
  // A fresh one-time link: the first password for someone who never signed in, or a reset for someone locked out.
  async invite(c, a, _p, i) {
    const user = key(i.user),
      token = newToken();
    need(user !== a.id, 'Change your own password from your profile.');
    const t = (
      await c.query(
        `select role, ${ROLES}, name, ${JOINED()} as joined from users where id = $1 and not suspended for update`,
        [user],
      )
    ).rows[0];
    need(t, 'That member does not exist.');
    // Whoever can take over an account must already outrank it: officers' accounts need the role-assigning authority, a Super Admin's needs a Super Admin.
    need(
      (t.roles as Role[]).every((r) => r === 'member')
        ? can(a.roles, 'application.approve') || canFully(a.roles, 'roles.assign')
        : t.role === 'super_admin'
          ? a.role === 'super_admin'
          : canFully(a.roles, 'roles.assign'),
    );
    await c.query(
      `update users set invite_hash = $2, invite_expires = now() + interval '7 days' where id = $1`,
      [user, sha(token)],
    );
    await audit(c, a, `issued a ${t.joined ? 'password reset' : 'new invite'} link for ${t.name}`);
    return `${t.joined ? 'Password reset' : 'Invite'} link for ${t.name}. It works once and expires in 7 days: /login?invite=${token}`;
  },
  /** An officer edits another member's profile directly. Members ask with `profileRequest` instead. */
  async updateProfile(c, a, _p, i) {
    const t = await editTarget(c, a, i.user);
    const { value, errors } = checkProfile(i);
    const err = Object.values(errors)[0];
    if (err) throw new Fail(400, err);
    const ch = profileDiff(value, await currentProfile(c, t.id));
    if (!Object.keys(ch).length) return 'Nothing changed.';
    await applyProfile(c, t.id, ch);
    await audit(c, a, `edited ${t.name}'s profile: ${fieldList(ch)}`);
  },
  /** A member asks for new values. A judge handle not linked yet is linked directly (handle, vjudge) instead. */
  async profileRequest(c, a, _p, i) {
    person(a);
    const raw = (i.changes && typeof i.changes === 'object' ? i.changes : {}) as In;
    const { value, errors } = checkProfile(raw);
    const err = Object.values(errors)[0];
    if (err) throw new Fail(400, err);
    const now = await currentProfile(c, a.id);
    const ch = profileDiff(value, now);
    if (!Object.keys(ch).length) throw new Fail(400, 'Nothing differs from your current details.');
    for (const k of ['cf_handle', 'vjudge_handle'] as const)
      if (ch[k] !== undefined && !now[k])
        throw new Fail(
          400,
          'Link your judge handles yourself on your profile; only changes need approval.',
        );
    await handlesOk(c, a.id, ch);
    const note = i.note ? text(i.note, 0, 300, 'The note') || null : null;
    // One open request per member: asking again replaces it.
    await c.query(
      `insert into profile_requests (user_id, changes, note) values ($1, $2, $3)
       on conflict (user_id) where status = 'pending' do update set changes = excluded.changes, note = excluded.note, created_at = now()`,
      [a.id, JSON.stringify(ch), note],
    );
    await audit(c, a, `requested a profile change: ${fieldList(ch)}`);
    return 'Request sent. The Secretary or President will review it.';
  },
  async profileRequestCancel(c, a) {
    const r = await c.query(
      `update profile_requests set status = 'cancelled' where user_id = $1 and status = 'pending'`,
      [a.id],
    );
    if (!r.rowCount) throw new Fail(409, 'There is no open request.');
  },
  /** Approving applies the requested values (checked again now); rejecting needs a reason the member sees. */
  async profileRequestDecide(c, a, _p, i) {
    const id = posInt(i.id, 'request'),
      to = pick(i.to, ['approved', 'rejected'] as const, 'decision');
    const r = (
      await c.query(
        `select user_id, changes from profile_requests where id = $1 and status = 'pending' for update`,
        [id],
      )
    ).rows[0];
    if (!r) throw new Fail(409, 'That request is no longer open.');
    const t = await editTarget(c, a, r.user_id);
    const reason = to === 'rejected' ? text(i.reason, 3, 300, 'The reason') : null;
    let ch: ProfileChanges = {};
    if (to === 'approved') {
      const { value, errors } = checkProfile(r.changes);
      const err = Object.values(errors)[0];
      if (err) throw new Fail(400, `That request can no longer be applied: ${err}`);
      ch = profileDiff(value, await currentProfile(c, t.id));
      await applyProfile(c, t.id, ch);
    }
    await c.query(
      `update profile_requests set status = $2, reason = $3, decided_by = $4, decided_at = now() where id = $1`,
      [id, to, reason, a.id],
    );
    await audit(
      c,
      a,
      to === 'approved'
        ? `approved ${t.name}'s profile change: ${fieldList(ch) || 'already up to date'}`
        : `rejected ${t.name}'s profile change: ${fieldList(r.changes)}. Reason: ${reason}`,
    );
  },
  async kudosMilestone(c, a, _p, i) {
    person(a);
    const milestoneId = posInt(i.milestoneId, 'milestone');
    return giveMilestoneKudosTx(c, a, milestoneId);
  },
  async saveAlumni(c, a, _p, i) {
    const alumniId = key(i.alumniId);
    need(
      (
        await c.query(`select 1 from users where id = $1 and role = 'alumni' and not system`, [
          alumniId,
        ])
      ).rowCount,
      'That alumnus does not exist.',
    );
    const has =
      (
        await c.query(`select 1 from alumni_saves where user_id = $1 and alumni_id = $2`, [
          a.id,
          alumniId,
        ])
      ).rowCount! > 0;
    if (has) {
      await c.query(`delete from alumni_saves where user_id = $1 and alumni_id = $2`, [
        a.id,
        alumniId,
      ]);
      return { saved: false };
    }
    await c.query(
      `insert into alumni_saves (user_id, alumni_id) values ($1, $2) on conflict do nothing`,
      [a.id, alumniId],
    );
    return { saved: true };
  },
  async setAvailableForQuestions(c, a, _p, i) {
    const raw = i.alumniId ?? i.userId;
    const targetId = typeof raw === 'string' && KEY.test(raw) ? raw : a.id;
    need(
      targetId === a.id || canFully(a.roles, 'alumni.toggleQuestions'),
      'Only the account owner or the President can change availability for questions.',
    );
    const val = Boolean(i.available ?? i.value);
    const r = await c.query(
      `update users set available_for_questions = $1 where id = $2 and not system`,
      [val, targetId],
    );
    if (!r.rowCount) throw new Fail(404, 'That member does not exist.');
    await audit(c, a, `set availability for questions for ${targetId} to ${val}`);
    return { success: true, value: val, available: val };
  },
  async createAlumniJob(c, a, _p, i) {
    person(a);
    need(canFully(a.roles, 'alumni.job.post'), 'Only alumni or admins can post alumni jobs.');
    const j = jobFields(i);
    const alumniId =
      canFully(a.roles, 'alumni.job.fetch') &&
      typeof i.alumniId === 'string' &&
      KEY.test(i.alumniId)
        ? i.alumniId
        : a.id;
    const owner = (await c.query(`select id from users where id = $1 and not system`, [alumniId]))
      .rows[0];
    if (!owner) throw new Fail(404, 'Target member does not exist.');
    const jobId = await insertJob(c, alumniId, j);
    await audit(c, a, `posted alumni job: ${j.company} — ${j.role}`);
    return {
      success: true,
      jobId,
      id: jobId,
      company: j.company,
      role: j.role,
      title: j.role,
      vacancies: j.vacancies,
      mine: alumniId === a.id,
    };
  },
  async deleteAlumniJob(c, a, _p, i) {
    person(a);
    const jobId = posInt(i.jobId, 'job');
    const row = (
      await c.query(`select id, alumni_id, company, role from alumni_jobs where id = $1`, [jobId])
    ).rows[0];
    if (!row) throw new Fail(404, 'That job listing does not exist.');
    need(
      row.alumni_id === a.id || canFully(a.roles, 'alumni.job.fetch'),
      'Only the author or an admin can delete this job.',
    );
    await c.query(`delete from alumni_jobs where id = $1`, [jobId]);
    await audit(c, a, `deleted alumni job #${jobId} (${row.company} — ${row.role})`);
    return { success: true, deleted: true };
  },
  async toggleInterviewProblem(c, a, _p, i) {
    person(a);
    const problemId = posInt(i.problemId, 'problem');
    need(
      (await c.query(`select 1 from interview_problems where id = $1`, [problemId])).rowCount,
      'That problem does not exist.',
    );
    const gone = await c.query(
      `delete from interview_user_progress where user_id = $1 and problem_id = $2`,
      [a.id, problemId],
    );
    if (gone.rowCount) return { problemId, solved: false };
    await c.query(
      `insert into interview_user_progress (user_id, problem_id) values ($1, $2) on conflict do nothing`,
      [a.id, problemId],
    );
    return { problemId, solved: true };
  },
  async createInterviewProblem(c, a, _p, i) {
    need(
      canFully(a.roles, 'interview.problem.create'),
      'Only the CP head or president can add interview problems.',
    );
    const topicId = posInt(i.topicId, 'topic');
    const title = text(i.title, 2, 120, 'Title');
    const url = optionalUrl(i.url, 'Problem URL');
    if (!url) throw new Fail(400, 'Problem URL is required.');
    const diff = pick(i.difficulty, ['easy', 'medium', 'hard'] as const, 'difficulty');
    const topic = (await c.query(`select id from interview_topics where id = $1`, [topicId]))
      .rows[0];
    if (!topic) throw new Fail(404, 'That topic does not exist.');
    const ins = await c.query(
      `insert into interview_problems (topic_id, title, url, difficulty, created_by) values ($1, $2, $3, $4, $5) returning id`,
      [topicId, title, url, diff, a.id],
    );
    await audit(c, a, `added problem to topic #${topicId}: ${title}`);
    return { success: true, problemId: Number(ins.rows[0].id) };
  },
  async deleteInterviewProblem(c, a, _p, i) {
    const problemId = posInt(i.problemId, 'problem');
    const p = (
      await c.query(`select id, created_by, title from interview_problems where id = $1`, [
        problemId,
      ])
    ).rows[0];
    if (!p) throw new Fail(404, 'That problem does not exist.');
    need(
      p.created_by === a.id || canFully(a.roles, 'interview.roadmap.manage'),
      'Only the creator or an admin can delete this problem.',
    );
    await c.query(`delete from interview_problems where id = $1`, [problemId]);
    await audit(c, a, `deleted interview problem #${problemId}: ${p.title}`);
    return { success: true, deleted: true };
  },
  async createInterviewTip(c, a, _p, i) {
    need(
      canFully(a.roles, 'interview.tip.create'),
      'Only alumni or admins can create interview tips.',
    );
    const topicId = i.topicId ? posInt(i.topicId, 'topic') : null;
    if (topicId) {
      const topic = (await c.query(`select id from interview_topics where id = $1`, [topicId]))
        .rows[0];
      if (!topic) throw new Fail(404, 'That topic does not exist.');
    }
    const title = text(i.title, 2, 140, 'Title');
    const bodyMd = mdText(i.body_md ?? i.body, 1, 20_000, 'Body');
    const ins = await c.query(
      `insert into interview_tips (author_id, topic_id, title, body_md) values ($1, $2, $3, $4) returning id`,
      [a.id, topicId, title, bodyMd],
    );
    await audit(c, a, `posted interview tip: ${title}`);
    return { success: true, id: Number(ins.rows[0].id) };
  },
  async deleteInterviewTip(c, a, _p, i) {
    const tipId = posInt(i.tipId, 'tip');
    const tip = (
      await c.query(`select id, author_id, title from interview_tips where id = $1`, [tipId])
    ).rows[0];
    if (!tip) throw new Fail(404, 'That tip does not exist.');
    need(
      tip.author_id === a.id || canFully(a.roles, 'interview.roadmap.manage'),
      'Only the author or an admin can delete this tip.',
    );
    await c.query(`delete from interview_tips where id = $1`, [tipId]);
    await audit(c, a, `deleted interview tip #${tipId}: ${tip.title}`);
    return { success: true, deleted: true };
  },
  async createBlogPost(c, a, _p, i) {
    person(a);
    need(canFully(a.roles, 'blog.post.create'), 'Only alumni or admins can write blog posts.');
    const title = text(i.title, 2, 120, 'Title');
    const subtitle = i.subtitle ? text(i.subtitle, 1, 200, 'Subtitle') : null;
    const bodyMd = mdText(i.body_md ?? i.body, 1, 50_000, 'Story');
    const excerpt = i.excerpt
      ? text(i.excerpt, 1, 280, 'Excerpt')
      : excerptFromMarkdown(bodyMd, 140);
    const coverUrl = optionalUrl(i.cover_url, 'Cover image URL');
    const tags = Array.isArray(i.tags)
      ? i.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [];
    const status = blogStatus(i) ?? 'draft';
    let slug = i.slug
      ? text(i.slug, 2, 100, 'Slug')
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      : '';
    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    }
    const exists =
      (await c.query(`select 1 from blog_posts where slug = $1`, [slug])).rowCount! > 0;
    if (exists) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const publishedAt = status === 'published' ? new Date() : null;
    const ins = await c.query(
      `insert into blog_posts (author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) returning id`,
      [
        a.id,
        slug,
        title,
        subtitle,
        excerpt,
        bodyMd,
        coverUrl,
        JSON.stringify(tags),
        status,
        publishedAt,
      ],
    );
    await audit(c, a, `created blog post: ${title} (${status})`);
    return { success: true, id: Number(ins.rows[0].id), slug, author_id: a.id };
  },
  async updateBlogPost(c, a, _p, i) {
    const id = posInt(i.id, 'post');
    const post = (
      await c.query(
        `select id, author_id, title, status, published_at from blog_posts where id = $1`,
        [id],
      )
    ).rows[0];
    if (!post) throw new Fail(404, 'That post does not exist.');
    need(
      post.author_id === a.id || canFully(a.roles, 'blog.post.delete'),
      'Only the author or an admin can edit this post.',
    );
    const title = i.title ? text(i.title, 2, 120, 'Title') : post.title;
    const subtitle =
      i.subtitle !== undefined ? (i.subtitle ? text(i.subtitle, 1, 200, 'Subtitle') : null) : null;
    const bodyMd = i.body_md ? mdText(i.body_md, 1, 50_000, 'Story') : null;
    const excerpt =
      i.excerpt !== undefined
        ? i.excerpt
          ? text(i.excerpt, 1, 280, 'Excerpt')
          : null
        : bodyMd
          ? excerptFromMarkdown(bodyMd, 140)
          : null;
    const coverUrl =
      i.cover_url !== undefined ? optionalUrl(i.cover_url, 'Cover image URL') : undefined;
    const tags = Array.isArray(i.tags)
      ? i.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : undefined;
    const status = blogStatus(i);
    let publishedAt = post.published_at;
    if (status === 'published' && !publishedAt) {
      publishedAt = new Date();
    }
    await c.query(
      `update blog_posts set
         title = coalesce($2, title),
         subtitle = case when $3::int is null then subtitle else $4 end,
         excerpt = case when $5::int is null then excerpt else $6 end,
         body_md = coalesce($7, body_md),
         cover_url = case when $8::int is null then cover_url else $9 end,
         tags = case when $10::int is null then tags else $11::jsonb end,
         status = coalesce($12, status),
         published_at = coalesce($13, published_at),
         updated_at = now()
       where id = $1`,
      [
        id,
        i.title ? title : null,
        i.subtitle !== undefined ? 1 : null,
        subtitle,
        i.excerpt !== undefined || bodyMd ? 1 : null,
        excerpt,
        bodyMd,
        i.cover_url !== undefined ? 1 : null,
        coverUrl,
        tags ? 1 : null,
        tags ? JSON.stringify(tags) : null,
        status ?? null,
        publishedAt,
      ],
    );
    await audit(c, a, `updated blog post #${id}: ${title}`);
    return { success: true, title };
  },
  async saveInterviewRoadmap(c, a, _p, i) {
    roadmapManager(a);
    const name = text(i.name, 2, 80, 'Roadmap name');
    const desc = i.description ? text(i.description, 0, 300, 'Description') || null : null;
    if (!Array.isArray(i.topics) || i.topics.length < 1 || i.topics.length > 200)
      throw new Fail(400, 'A roadmap needs 1 to 200 topics.');

    const nodes = (i.topics as RoadmapNodeIn[]).map((n) => ({
      key: text(n.key, 1, 64, 'Topic key'),
      id: n.id == null ? null : posInt(n.id, 'topic'),
      parentKey: n.parentKey == null ? null : text(n.parentKey, 1, 64, 'Parent key'),
      name: text(n.name, 2, 80, 'Topic name'),
      description: n.description ? text(n.description, 0, 300, 'Description') || null : null,
      link: optionalUrl(n.link, 'Topic link'),
      x: Math.min(5000, Math.max(0, Math.round(Number(n.x) || 0))),
      y: Math.min(5000, Math.max(0, Math.round(Number(n.y) || 0))),
      problems:
        n.problems === undefined
          ? null
          : (() => {
              if (!Array.isArray(n.problems) || n.problems.length > 200)
                throw new Fail(400, 'A topic can have at most 200 problems.');
              return (n.problems as ProblemIn[]).map((q) => {
                const title = text(q.title, 2, 120, 'Problem title');
                const url = optionalUrl(q.url, `Link for “${title}”`);
                if (!url) throw new Fail(400, `“${title}” needs a link.`);
                return {
                  id: q.id == null ? null : posInt(q.id, 'problem'),
                  title,
                  url,
                  difficulty: pick(q.difficulty, DIFFICULTIES, `difficulty for “${title}”`),
                };
              });
            })(),
    }));
    if (nodes.reduce((t, n) => t + (n.problems?.length ?? 0), 0) > 3000)
      throw new Fail(400, 'A roadmap can have at most 3000 problems.');
    const byKey = new Map(nodes.map((n) => [n.key, n]));
    if (byKey.size !== nodes.length) throw new Fail(400, 'Topic keys must be unique.');
    for (const n of nodes)
      if (n.parentKey !== null && !byKey.has(n.parentKey))
        throw new Fail(400, `"${n.name}" points at a missing parent.`);

    // Parents first; anything never reached sits on a cycle.
    const order: typeof nodes = [];
    const queue = nodes.filter((n) => n.parentKey === null);
    while (queue.length) {
      const n = queue.shift()!;
      order.push(n);
      queue.push(...nodes.filter((c) => c.parentKey === n.key));
    }
    if (order.length !== nodes.length) throw new Fail(400, 'Topics cannot form a cycle.');

    let roadmapId: number;
    if (i.roadmapId == null) {
      const kind = pick(i.kind ?? 'prep', ['prep', 'learn'] as const, 'roadmap kind');
      // Learn has exactly one roadmap; the unique index backs this up against a race.
      if (
        kind === 'learn' &&
        (await c.query(`select 1 from interview_roadmaps where kind = 'learn'`)).rowCount
      )
        throw new Fail(409, 'The learning roadmap already exists. Edit it instead.');
      roadmapId = Number(
        (
          await c.query(
            `insert into interview_roadmaps (name, description, created_by, kind) values ($1, $2, $3, $4) returning id`,
            [name, desc, a.id, kind],
          )
        ).rows[0].id,
      );
    } else {
      roadmapId = posInt(i.roadmapId, 'roadmap');
      const r = await c.query(
        `update interview_roadmaps set name = $2, description = $3 where id = $1 returning id`,
        [roadmapId, name, desc],
      );
      if (!r.rowCount) throw new Fail(404, 'That roadmap does not exist.');
    }

    const owned = new Set(
      (
        await c.query(`select id from interview_topics where roadmap_id = $1 for update`, [
          roadmapId,
        ])
      ).rows.map((r) => Number(r.id)),
    );
    const dbId = new Map<string, number>();
    for (const [i, n] of order.entries()) {
      const parentId = n.parentKey === null ? null : dbId.get(n.parentKey)!;
      if (n.id !== null) {
        if (!owned.has(n.id)) throw new Fail(400, `"${n.name}" is not in this roadmap.`);
        await c.query(
          `update interview_topics set name = $2, description = $3, parent_id = $4, x = $5, y = $6, order_index = $7, link = $8 where id = $1`,
          [n.id, n.name, n.description, parentId, n.x, n.y, i, n.link],
        );
        dbId.set(n.key, n.id);
      } else {
        const ins = await c.query(
          `insert into interview_topics (roadmap_id, name, description, parent_id, x, y, order_index, created_by, link)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
          [roadmapId, n.name, n.description, parentId, n.x, n.y, i, a.id, n.link],
        );
        dbId.set(n.key, Number(ins.rows[0].id));
      }
    }
    // Problems: only topics that sent a list are touched, and only rows that changed are written.
    const existing = new Map(
      (
        await c.query(
          `select p.id, p.topic_id, p.title, p.url, p.difficulty from interview_problems p
           join interview_topics t on t.id = p.topic_id where t.roadmap_id = $1 for update of p`,
          [roadmapId],
        )
      ).rows.map((r) => [Number(r.id), r]),
    );
    const kept = new Set<number>();
    for (const n of nodes) {
      if (!n.problems) continue;
      const topicId = dbId.get(n.key)!;
      for (const q of n.problems) {
        if (q.id === null) {
          await c.query(
            `insert into interview_problems (topic_id, title, url, difficulty, created_by) values ($1, $2, $3, $4, $5)`,
            [topicId, q.title, q.url, q.difficulty, a.id],
          );
          continue;
        }
        const old = existing.get(q.id);
        if (!old || kept.has(q.id)) throw new Fail(400, `“${q.title}” is not in this roadmap.`);
        kept.add(q.id);
        if (
          Number(old.topic_id) !== topicId ||
          old.title !== q.title ||
          old.url !== q.url ||
          old.difficulty !== q.difficulty
        )
          await c.query(
            `update interview_problems set topic_id = $2, title = $3, url = $4, difficulty = $5 where id = $1`,
            [q.id, topicId, q.title, q.url, q.difficulty],
          );
      }
    }
    const listed = new Set(nodes.filter((n) => n.problems).map((n) => n.id));
    const dropped = [...existing.values()]
      .filter((r) => listed.has(Number(r.topic_id)) && !kept.has(Number(r.id)))
      .map((r) => Number(r.id));
    if (dropped.length)
      await c.query(`delete from interview_problems where id = any($1::int[])`, [dropped]);
    // After the problem moves above. Every kept topic hangs off a kept parent, so this only removes
    // dropped subtrees (and the problems still in them).
    await c.query(`delete from interview_topics where roadmap_id = $1 and id <> all($2::int[])`, [
      roadmapId,
      [...dbId.values()],
    ]);
    await audit(c, a, `saved interview roadmap #${roadmapId}: ${name}`);
    return { roadmapId };
  },
  async deleteInterviewRoadmap(c, a, _p, i) {
    roadmapManager(a);
    const roadmapId = posInt(i.roadmapId, 'roadmap');
    const r = await c.query(`delete from interview_roadmaps where id = $1 returning name`, [
      roadmapId,
    ]);
    if (!r.rowCount) throw new Fail(404, 'That roadmap does not exist.');
    await audit(c, a, `deleted interview roadmap #${roadmapId}: ${r.rows[0].name}`);
    return { deleted: true };
  },
  async deleteBlogPost(c, a, _p, i) {
    const id = posInt(i.id, 'post');
    const post = (await c.query(`select id, author_id, title from blog_posts where id = $1`, [id]))
      .rows[0];
    if (!post) throw new Fail(404, 'That post does not exist.');
    need(
      post.author_id === a.id || canFully(a.roles, 'blog.post.delete'),
      'Only the author or an admin can delete this post.',
    );
    await c.query(`delete from blog_posts where id = $1`, [id]);
    await audit(c, a, `deleted blog post #${id}: ${post.title}`);
    return { success: true, deleted: true };
  },
  async makeAlumni(c, a, _p, i) {
    need(
      canFully(a.roles, 'member.makeAlumni'),
      'Only the President or Super Admin can transition members to alumni.',
    );
    const userId = key(i.userId);
    need(userId !== a.id, 'You cannot transition your own account.');
    const r = await c.query(
      `update users set role = 'alumni', title = 'Alumni', post = null where id = $1 and not system and (role not in ('president', 'super_admin') or $2) returning name`,
      [userId, a.role === 'super_admin'],
    );
    if (!r.rows[0]) throw new Fail(404, 'That member does not exist, or cannot be modified.');
    await audit(c, a, `transitioned ${r.rows[0].name} to Alumni`);
  },
};

// Which audit section each action's entries go under. Unlisted actions fall back to the wording (schema).
const AREA: Record<string, AuditArea> = {};
const area = (name: AuditArea, ...types: string[]) => types.forEach((t) => (AREA[t] = name));
area(
  'Recruitment',
  'recruitCreate',
  'recruitUpdate',
  'recruitClose',
  'recruitDelete',
  'recruitImport',
  'recruitDecide',
  'recruitMail',
);
area(
  'Members & roles',
  'role',
  'post',
  'postRole',
  'appointPresident',
  'invite',
  'suspend',
  'makeAlumni',
  'profile',
  'updateProfile',
  'profileRequest',
  'profileRequestCancel',
  'profileRequestDecide',
  'handle',
  'vjudge',
);
area('Finance', 'pay', 'contribute', 'setFee', 'expense', 'saveBudget', 'deleteBudget');
area(
  'Events',
  'eventSave',
  'eventDelete',
  'roleSave',
  'roleDelete',
  'register',
  'unregister',
  'entryStatus',
  'entryPlace',
  'eventFeedback',
  'certTemplate',
  'certIssue',
  'certDistribute',
  'attend',
  'eventMail',
  'contestDay',
);
area(
  'Community',
  'announce',
  'deleteAnnouncement',
  'createPoll',
  'deletePoll',
  'moderateFeedPost',
  'reportFeedPost',
  'deleteFeedPost',
  'closeIdea',
  'updateIdea',
);
area(
  'Workspace',
  'saveTask',
  'deleteTask',
  'saveDoc',
  'deleteDoc',
  'saveItem',
  'deleteItem',
  'holdItem',
);
area(
  'Training',
  'sheetSave',
  'sheetDelete',
  'challenge',
  'challengeDelete',
  'courseAdd',
  'courseDelete',
  'quizAdd',
  'quizImport',
  'quizEdit',
  'quizDelete',
  'teamRename',
  'teamInvite',
  'teamJoin',
  'teamLeave',
);
area(
  'Alumni',
  'createAlumniJob',
  'deleteAlumniJob',
  'createBlogPost',
  'updateBlogPost',
  'deleteBlogPost',
  'createInterviewTip',
  'deleteInterviewTip',
  'createInterviewProblem',
  'deleteInterviewProblem',
  'setAvailableForQuestions',
);
area('Email', 'mailTest', 'mailRetry');
area('Security & settings', 'flag', 'kv');
/** `decide` covers three officer queues; its section follows the kind. */
const areaOf = (type: string, i: In): AuditArea | '' =>
  type === 'decide' ? (i.kind === 'application' ? 'Recruitment' : 'Finance') : (AREA[type] ?? '');

/** Runs one action for `userId`. Throws Fail for anything the caller got wrong; returns an optional one-time notice. */
/** Runs one action for `userId`: a notice (string), data for the caller (object), or nothing. */
/**
 * One member's changes: 120 a minute and 3000 a day, far above any real use, so one account cannot flood the club.
 * Counted on the member's row, which `act()` has locked, so every API instance shares the count.
 */
export async function throttleWrites(c: Db, userId: string) {
  const w = (
    await c.query(
      `update users set
         writes_min = case when writes_at = date_trunc('minute', now()) then writes_min + 1 else 1 end,
         writes_day = case when writes_at >= date_trunc('day', now()) then writes_day + 1 else 1 end,
         writes_at = date_trunc('minute', now())
       where id = $1 returning writes_min, writes_day`,
      [userId],
    )
  ).rows[0];
  if (w.writes_min > 120 || w.writes_day > 3000)
    throw new Fail(429, 'Too many changes in a short time. Wait a minute and try again.');
}

export async function act(userId: string, input: unknown): Promise<unknown> {
  const i = (input && typeof input === 'object' ? input : {}) as In,
    run = handlers[String(i.type)];
  if (!run || !Object.hasOwn(handlers, String(i.type))) throw new Fail(400, 'Unknown action.');
  // These read the Codeforces problemset (up to 15 s cold): fetch it before the transaction holds the actor's row.
  if (i.type === 'challenge' || i.type === 'sheetSave') await problemset();
  return tx(async (c) => {
    const u = (
      await c.query(
        `select id, role, ${ROLES}, name, system, progress from users where id = $1 and not suspended for update`,
        [userId],
      )
    ).rows[0];
    if (!u) throw new Fail(401, 'Sign in again.');
    await throttleWrites(c, userId);
    // Every audit line this action writes is filed under its section (read by the audit insert trigger).
    await c.query(`select set_config('fecpc.area', $1, true)`, [areaOf(String(i.type), i)]);
    const p = progress(u.progress),
      before = JSON.stringify(p);
    const info = await run(
      c,
      { id: u.id, role: u.role, roles: u.roles, name: u.name, system: u.system },
      p,
      i,
    );
    const after = JSON.stringify(p);
    if (after !== before)
      await c.query(`update users set progress = $2 where id = $1`, [userId, after]);
    return info;
  }).finally(forgetShared); // what everyone sees may have changed (also on a refusal: harmless)
}

/** Member export for officers. The download itself is the audited event. */
export async function exportMembers(userId: string) {
  return tx(async (c) => {
    const u = (
      await c.query(`select role, ${ROLES}, name from users where id = $1 and not suspended`, [
        userId,
      ])
    ).rows[0];
    if (!u || !can(u.roles, 'data.export')) throw new Fail(403, 'Your role cannot export data.');
    await audit(c, u, 'exported member data (CSV)');
    const rows = (
      await c.query(
        `select name, handle, batch, dept, rating, solved, case when suspended then 'suspended' else 'active' end as status from users where not system order by name`,
      )
    ).rows;
    // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
    const cell = (v: unknown) => {
      const t = String(v);
      return `"${(/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`;
    };
    return (
      'name,handle,batch,dept,rating,solved,status\n' +
      rows
        .map((r) =>
          [r.name, r.handle, r.batch, r.dept, r.rating, r.solved, r.status].map(cell).join(','),
        )
        .join('\n') +
      '\n'
    );
  });
}

/** Cursor-paginated Feed posts for infinite scroll. */
export async function listFeedPosts(
  db: Db,
  userId: string,
  input: {
    q?: string;
    category?: string;
    sort?: string;
    mine?: boolean;
    cursor?: string | number | null;
    limit?: number;
  } = {},
): Promise<{ items: FeedPostSummary[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  const rawCat = typeof input.category === 'string' ? input.category.trim().toLowerCase() : '';
  const category = rawCat && rawCat !== 'all' ? (FEED_CAT_ALIAS[rawCat] ?? null) : null;
  const sort = input.sort === 'top' || input.sort === 'hot' ? input.sort : 'new';
  const where: string[] = input.mine ? ['fp.user_id = $1'] : [];
  const params: unknown[] = [userId];
  let idx = 2;
  // Hot ranks move as posts age, so a keyset cursor cannot hold; page by offset instead.
  const offset = sort === 'hot' ? Math.max(0, Math.floor(Number(input.cursor)) || 0) : 0;

  if (q) {
    where.push(`(fp.title ilike $${idx} or fp.body_md ilike $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (category) {
    where.push(`fp.category = $${idx}`);
    params.push(category);
    idx++;
  }
  if (
    sort !== 'hot' &&
    input.cursor !== undefined &&
    input.cursor !== null &&
    String(input.cursor).trim() !== ''
  ) {
    if (sort === 'top') {
      const m = /^(-?\d+):(\d+)$/.exec(String(input.cursor));
      if (m) {
        where.push(`(fp.score < $${idx} or (fp.score = $${idx} and fp.id < $${idx + 1}))`);
        params.push(Number(m[1]), Number(m[2]));
        idx += 2;
      }
    } else {
      const cId = Number(input.cursor);
      if (Number.isInteger(cId) && cId > 0) {
        where.push(`fp.id < $${idx}`);
        params.push(cId);
        idx++;
      }
    }
  }

  params.push(limit + 1);
  // Hot: net votes decay with age in hours (gravity 1.5), so fresh, well-voted posts rise. In float8: extract()
  // returns numeric, and numeric power() over every post took 0.3 s at 20k posts.
  const orderBy =
    sort === 'top'
      ? `fp.score desc, fp.id desc`
      : sort === 'hot'
        ? `(fp.score + 1) / power(extract(epoch from now() - fp.created_at)::float8 / 3600 + 2, 1.5) desc, fp.id desc`
        : `fp.created_at desc, fp.id desc`;
  const sql = `
    select fp.id, fp.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
      u.rating as author_rating, u.title as author_role, ${face('u')} as author_avatar,
      fp.title, left(fp.body_md, 400) as body_md, fp.category, fp.score,
      coalesce(v.value, 0)::int as my_vote,
      fp.created_at, fp.updated_at
    from feed_posts fp
    join users u on u.id = fp.user_id
    left join feed_votes v on v.post_id = fp.id and v.user_id = $1
    ${where.length ? 'where ' + where.join(' and ') : ''}
    order by ${orderBy}
    limit $${idx} offset ${offset}`;
  const rows = (await db.query(sql, params)).rows as FeedPostSummary[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? sort === 'hot'
        ? String(offset + limit)
        : sort === 'top'
          ? `${last.score}:${last.id}`
          : String(last.id)
      : null;
  return { items, nextCursor };
}

/** Reported feed posts, most-reported first, for members who moderate the feed. */
export async function listFeedReports(db: Db, userId: string) {
  const r = (await db.query(`select ${ROLES} from users where id = $1`, [userId])).rows[0];
  need(r && can(r.roles, 'feed.moderate'));
  return {
    items: (
      await db.query(
        `select fp.id, fp.title, u.name as author_name, count(*)::int as reports,
          json_agg(fr.reason order by fr.id desc) as reasons, max(fr.created_at) as last_at
        from feed_reports fr join feed_posts fp on fp.id = fr.post_id join users u on u.id = fp.user_id
        group by fp.id, u.name order by reports desc, last_at desc limit 50`,
      )
    ).rows as {
      id: number;
      title: string;
      author_name: string;
      reports: number;
      reasons: string[];
    }[],
  };
}

/** Full detail for a single Feed post modal (body, author contribution stats, author recent posts). */
export async function getFeedPostDetail(
  db: Db,
  userId: string,
  input: { postId: number | string },
): Promise<FeedPostDetail> {
  const postId = posInt(input.postId, 'post');
  const row = (
    await db.query(
      `select fp.id, fp.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, u.title as author_role, ${face('u')} as author_avatar, u.streak as author_streak,
        fp.title, fp.body_md, fp.category, fp.score,
        coalesce(v.value, 0)::int as my_vote,
        (select count(*)::int from feed_posts x where x.user_id = fp.user_id) as author_posts_count,
        exists (select 1 from feed_reports fr where fr.post_id = fp.id and fr.user_id = $1) as reported_by_me,
        fp.created_at, fp.updated_at
      from feed_posts fp
      join users u on u.id = fp.user_id
      left join feed_votes v on v.post_id = fp.id and v.user_id = $1
      where fp.id = $2`,
      [userId, postId],
    )
  ).rows[0];
  if (!row) throw new Fail(404, 'That post does not exist.');

  const recent = (
    await db.query(
      `select id, title, created_at from feed_posts where user_id = $1 and id <> $2 order by created_at desc limit 4`,
      [row.user_id, postId],
    )
  ).rows as { id: number; title: string; created_at: string }[];

  return { ...row, author_recent: recent };
}

/** Cursor-paginated Ideas list (merged with Teammates). Never returns interested[] member list. */
export async function listIdeas(
  db: Db,
  userId: string,
  input: {
    q?: string;
    type?: string;
    status?: string;
    sort?: string;
    mine?: boolean;
    cursor?: string | number | null;
    limit?: number;
  } = {},
): Promise<{ items: IdeaSummary[]; nextCursor: string | null }> {
  const limit = Math.min(50, Math.max(1, Number(input.limit) || 20));
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  const type =
    typeof input.type === 'string' && IDEA_TYPES.includes(input.type as IdeaType)
      ? (input.type as IdeaType)
      : null;
  const status =
    typeof input.status === 'string' && IDEA_STATUSES.includes(input.status as IdeaStatus)
      ? (input.status as IdeaStatus)
      : null;
  const sort = input.sort === 'new' ? 'new' : 'top';
  const where: string[] = input.mine ? ['i.user_id = $1'] : [];
  const params: unknown[] = [userId];
  let idx = 2;

  if (q) {
    where.push(`(i.title ilike $${idx} or i.body_md ilike $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (type) {
    where.push(`i.type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (status) {
    where.push(`i.status = $${idx}`);
    params.push(status);
    idx++;
  }

  let cursorClause = '';
  if (input.cursor !== undefined && input.cursor !== null && String(input.cursor).trim() !== '') {
    if (sort === 'top') {
      const m = /^(\d+):(\d+)$/.exec(String(input.cursor));
      if (m) {
        cursorClause = `where (upvotes < $${idx} or (upvotes = $${idx} and id < $${idx + 1}))`;
        params.push(Number(m[1]), Number(m[2]));
        idx += 2;
      }
    } else {
      const cId = Number(input.cursor);
      if (Number.isInteger(cId) && cId > 0) {
        where.push(`i.id < $${idx}`);
        params.push(cId);
        idx++;
      }
    }
  }

  params.push(limit + 1);
  const sql = `
    with base as (
      select i.id, i.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, ${face('u')} as author_avatar,
        i.title, left(i.body_md, 400) as body_md, i.type, i.status, i.roles,
        (select count(*)::int from reactions r where r.target = 'idea:' || i.id) as upvotes,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id) as interested_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id and ii.status = 'accepted') as accepted_count,
        (select ii.status from idea_interests ii where ii.idea_id = i.id and ii.user_id = $1) as my_interest,
        i.created_at, i.updated_at
      from ideas i
      join users u on u.id = i.user_id
      ${where.length ? 'where ' + where.join(' and ') : ''}
    )
    select * from base
    ${cursorClause}
    order by ${sort === 'top' ? 'upvotes desc, id desc' : 'created_at desc, id desc'}
    limit $${idx}`;
  const rows = (await db.query(sql, params)).rows as IdeaSummary[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? (sort === 'top' ? `${last.upvotes}:${last.id}` : String(last.id)) : null;
  return { items, nextCursor };
}

/**
 * Idea detail for modal. Marks idea as viewed server-side.
 * STRICT PRIVACY: `interested` is queried and included ONLY when viewerId === idea.user_id.
 */
export async function getIdeaDetail(
  db: Db,
  viewerId: string,
  input: { ideaId: number | string },
): Promise<IdeaDetail> {
  const ideaId = posInt(input.ideaId, 'idea');
  const row = (
    await db.query(
      `select i.id, i.user_id, u.name as author_name, greatest(u.problems_solved, u.solved) as author_solved,
        u.rating as author_rating, ${face('u')} as author_avatar,
        i.title, i.body_md, i.type, i.status, i.roles,
        (select count(*)::int from reactions r where r.target = 'idea:' || i.id) as upvotes,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id) as interested_count,
        (select count(*)::int from idea_interests ii where ii.idea_id = i.id and ii.status = 'accepted') as accepted_count,
        (select ii.status from idea_interests ii where ii.idea_id = i.id and ii.user_id = $1) as my_interest,
        i.created_at, i.updated_at
      from ideas i
      join users u on u.id = i.user_id
      where i.id = $2`,
      [viewerId, ideaId],
    )
  ).rows[0] as IdeaSummary | undefined;
  if (!row) throw new Fail(404, 'That idea does not exist.');

  // Record view server-side on modal open.
  await db.query(
    `insert into idea_views (idea_id, user_id) values ($1, $2) on conflict do nothing`,
    [ideaId, viewerId],
  );

  const detail: IdeaDetail = { ...row };
  // Enforce server-side: interested[] returned ONLY if viewerId === idea.user_id.
  if (viewerId === row.user_id) {
    detail.interested = (
      await db.query(
        `select ii.user_id, u.name, u.rating, greatest(u.problems_solved, u.solved) as problems_solved,
          ${face('u')} as avatar_url, ii.response, ii.status, ii.created_at, ii.decided_at
        from idea_interests ii
        join users u on u.id = ii.user_id
        where ii.idea_id = $1
        order by case ii.status when 'pending' then 0 when 'accepted' then 1 else 2 end, ii.created_at desc`,
        [ideaId],
      )
    ).rows as IdeaInterestRow[];
  }
  return detail;
}

/**
 * Paginated, filtered member roster for `/app/members`.
 * Composes all filters (q, rating tier title, skill, batch, type) with AND.
 */
export async function listMembers(
  db: Db,
  _viewerId: string,
  input: {
    q?: string;
    rating?: string;
    skill?: string;
    batch?: number | string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  members: MemberSummary[];
  total: number;
  clubTotal: number;
  hasMore: boolean;
  skills: string[];
  batches: number[];
}> {
  const pageSize = Math.min(48, Math.max(1, Number(input.pageSize) || 16));
  const page = Math.min(10_000, Math.max(0, Math.floor(Number(input.page) || 0)));
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  const rating = typeof input.rating === 'string' ? input.rating.trim() : '';
  const skill = typeof input.skill === 'string' ? input.skill.trim() : '';
  const batchNum =
    input.batch !== undefined && input.batch !== '' && input.batch !== null
      ? Number(input.batch)
      : NaN;
  // Alumni are listed in the alumni directory, not here.
  const where: string[] = [`not u.system`, `not u.suspended`, `u.role <> 'alumni'`];
  const params: unknown[] = [];
  let idx = 1;

  if (q) {
    where.push(
      `(u.name ilike $${idx} or coalesce(nullif(u.cf_handle, ''), u.handle) ilike $${idx})`,
    );
    params.push(`%${q}%`);
    idx++;
  }

  if (rating && rating.toLowerCase() !== 'all ratings') {
    // Same rule as rankFor: the Codeforces rating, else the stored one; none (<= 0) is Unrated.
    const r = `coalesce(nullif(u.cf_rating, 0), u.rating, 0)`;
    const tier = RANKS.find((t) => t.title.toLowerCase() === rating.toLowerCase());
    if (rating.toLowerCase() === UNRATED_RANK.title.toLowerCase()) where.push(`${r} <= 0`);
    else if (tier) {
      where.push(`${r} between greatest(1, $${idx}::int) and $${idx + 1}::int`);
      params.push(tier.min, Number.isFinite(tier.max) ? tier.max : 2_000_000_000);
      idx += 2;
    }
  }

  if (skill && skill.toLowerCase() !== 'any skill') {
    where.push(`$${idx} = any(u.skills)`);
    params.push(skill);
    idx++;
  }

  if (Number.isInteger(batchNum) && batchNum > 0) {
    where.push(`u.batch = $${idx}`);
    params.push(batchNum);
    idx++;
  }

  const whereSql = where.join(' and ');
  const [countRes, metaRes, rowsRes] = await Promise.all([
    db.query(`select count(*)::int as total from users u where ${whereSql}`, params),
    db.query(
      `select
         count(*)::int as club_total,
         coalesce((select json_agg(s order by s) from (select distinct unnest(skills) as s from users where not system and not suspended and role <> 'alumni') x), '[]'::json) as skills,
         coalesce((select json_agg(b order by b desc) from (select distinct batch as b from users where not system and not suspended and role <> 'alumni' and batch > 0) y), '[]'::json) as batches
       from users where not system and not suspended and role <> 'alumni'`,
    ),
    db.query(
      `select u.id, u.member_no as no, u.name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
         nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
         u.title as role,
         (u.role = 'alumni') as is_alumni,
         u.batch, u.dept, u.squad,
         coalesce(u.cf_rating, u.rating) as rating,
         coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
         greatest(u.problems_solved, u.solved) as problems_solved,
         greatest(u.current_streak, u.streak) as current_streak,
         u.contests_participated,
         u.skills,
         ${face('u')} as avatar_url
       from users u
       where ${whereSql}
       order by coalesce(u.cf_rating, u.rating) desc, greatest(u.problems_solved, u.solved) desc, u.name asc
       limit $${idx} offset $${idx + 1}`,
      [...params, pageSize, page * pageSize],
    ),
  ]);

  const total = Number(countRes.rows[0]?.total ?? 0);
  const clubTotal = Number(metaRes.rows[0]?.club_total ?? 0);
  const skills = (metaRes.rows[0]?.skills ?? []) as string[];
  const batches = (metaRes.rows[0]?.batches ?? []) as number[];
  const members = rowsRes.rows as MemberSummary[];
  const hasMore = page * pageSize + members.length < total;

  return { members, total, clubTotal, hasMore, skills, batches };
}

/**
 * Full resume payload for a single member profile modal.
 * Returns private fields (email, phone, student ID) only to the member and to officers with full
 * `member.editDetails`.
 */
export async function getMemberProfile(
  db: Db,
  viewerId: string,
  input: { userId: string },
): Promise<MemberProfile> {
  const userId = key(input.userId);
  const row = (
    await db.query(
      `select u.id, u.member_no as no, u.name, u.email,
       coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
       nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
       u.title as role,
       (u.role = 'alumni') as is_alumni,
       u.batch, u.dept, u.squad,
       coalesce(u.cf_rating, u.rating) as rating,
       coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
       greatest(u.problems_solved, u.solved) as problems_solved,
       greatest(u.current_streak, u.streak) as current_streak,
       u.contests_participated,
       u.skills,
       ${face('u')} as avatar_url,
       u.bio,
       u.github_url,
       u.linkedin_url,
       u.experience,
       u.contest_history,
       u.available_for_questions,
       u.location,
       u.vjudge_handle,
       u.created_at as joined,
       u.student_id,
       u.phone
     from users u
     where u.id = $1 and not u.system and not u.suspended`,
      [userId],
    )
  ).rows[0];
  if (!row) throw new Fail(404, 'That member does not exist.');

  const [activityRes, prepRes, jobsRes, tipsRes, blogsRes, jobsPostedRes] = await Promise.all([
    db.query(
      `select * from (
         select 'feed'::text as kind, id, title, created_at from feed_posts where user_id = $1
         union all
         select 'idea'::text as kind, id, title, created_at from ideas where user_id = $1
       ) x
       order by created_at desc
       limit 5`,
      [userId],
    ),
    row.is_alumni
      ? db.query(
          `select id, title, created_at from feed_posts where user_id = $1 order by created_at desc limit 10`,
          [userId],
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, alumni_id, company, role, coalesce(title, role) as title, vacancies, location, url, source, fetched_at, created_at
           from alumni_jobs
           where alumni_id = $1
           order by created_at desc`,
          [userId],
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, author_id, topic_id, title, body_md, created_at, updated_at
           from interview_tips
           where author_id = $1
           order by created_at desc`,
          [userId],
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at, views, created_at, updated_at
           from blog_posts
           where author_id = $1 and status = 'published'
           order by published_at desc`,
          [userId],
        )
      : Promise.resolve({ rows: [] }),
    row.is_alumni
      ? db.query(
          `select id, alumni_id, company, role, coalesce(title, role) as title, vacancies, location, job_type, experience, salary, description, responsibilities, requirements, to_char(deadline, 'YYYY-MM-DD') as deadline, company_logo_url, url, source, fetched_at, created_at
           from alumni_jobs
           where alumni_id = $1 and source = 'manual'
           order by created_at desc`,
          [userId],
        )
      : Promise.resolve({ rows: [] }),
  ]);

  const experience = Array.isArray(row.experience) ? (row.experience as MemberExperience[]) : [];
  const contest_history = Array.isArray(row.contest_history)
    ? (row.contest_history as MemberContestRow[])
    : [];
  const recent_activity = activityRes.rows as MemberActivityItem[];

  const profile: MemberProfile = {
    id: row.id,
    no: row.no,
    name: row.name,
    handle: row.handle,
    cf_handle: row.cf_handle,
    role: row.role,
    is_alumni: Boolean(row.is_alumni),
    batch: row.batch,
    dept: row.dept,
    squad: row.squad,
    rating: row.rating,
    cf_rating: row.cf_rating,
    problems_solved: row.problems_solved,
    current_streak: row.current_streak,
    contests_participated: row.contests_participated,
    skills: Array.isArray(row.skills) ? row.skills : [],
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    github_url: row.github_url ?? null,
    linkedin_url: row.linkedin_url ?? null,
    vjudge_handle: row.vjudge_handle ?? null,
    location: row.location ?? null,
    joined: row.joined,
    experience,
    contest_history,
    recent_activity,
  };

  // Contact details: for the member, and for the officers who keep member records.
  const officer =
    viewerId !== userId &&
    (
      await db.query(`select ${ROLES} from users where id = $1 and not suspended`, [viewerId])
    ).rows.some((v: { roles: Role[] }) => canFully(v.roles, 'member.editDetails'));
  if (viewerId === userId || officer) {
    profile.email = row.email;
    profile.student_id = row.student_id ?? null;
    profile.phone = row.phone ?? null;
  }

  if (profile.is_alumni) {
    profile.available_for_questions = Boolean(row.available_for_questions ?? true);
    profile.interview_prep = prepRes.rows as { id: number; title: string; created_at: string }[];
    profile.interview_tips = tipsRes.rows as InterviewTip[];
    profile.blogs = blogsRes.rows.map((b: any) => ({
      ...b,
      tags: Array.isArray(b.tags) ? b.tags : [],
    })) as BlogPost[];
    profile.jobs_posted = jobsPostedRes.rows.map((j: any) => ({
      ...j,
      responsibilities: Array.isArray(j.responsibilities) ? j.responsibilities : [],
      requirements: Array.isArray(j.requirements) ? j.requirements : [],
    })) as AlumniJob[];
    const allJobs = jobsRes.rows as AlumniJob[];
    profile.jobs_fetched = allJobs.filter((j) => j.source === 'fetched');
    profile.jobs_manual = allJobs.filter((j) => j.source === 'manual');
  }

  return profile;
}

type BoardSpec = { provider: 'greenhouse' | 'lever'; slug: string; company: string };

/**
 * On-demand / cron fetch of public Greenhouse / Lever job boards for an alumni member.
 * Inserts new listings into `alumni_jobs` with `source = 'fetched'`, deduplicated by URL.
 */
export async function fetchAlumniJobs(
  db: Db,
  actorId: string,
  input: { userId: string; boards?: BoardSpec[] },
): Promise<{ added: number; jobs: AlumniJob[] }> {
  const userId = key(input.userId);
  const actor = (
    await db.query(`select id, role, ${ROLES}, name from users where id = $1 and not suspended`, [
      actorId,
    ])
  ).rows[0];
  if (!actor) throw new Fail(401, 'Sign in again.');
  need(
    actor.id === userId || canFully(actor.roles, 'alumni.job.fetch'),
    'Only the alumnus or the President can refresh fetched jobs.',
  );

  const target = (
    await db.query(`select id, role from users where id = $1 and not system`, [userId])
  ).rows[0];
  if (!target) throw new Fail(404, 'That member does not exist.');
  need(target.role === 'alumni', 'Job board syncing is only available for alumni.');

  const boards: BoardSpec[] =
    Array.isArray(input.boards) && input.boards.length > 0
      ? input.boards.slice(0, 5)
      : [
          { provider: 'greenhouse', slug: 'stripe', company: 'Stripe' },
          { provider: 'lever', slug: 'figma', company: 'Figma' },
        ];

  let added = 0;
  for (const b of boards) {
    if (typeof b?.slug !== 'string' || !/^[a-z0-9_-]{1,60}$/i.test(b.slug)) continue;
    const company = text(b.company || b.slug, 1, 100, 'Company');
    try {
      let parsed: { role: string; location: string | null; url: string }[] = [];
      if (b.provider === 'greenhouse') {
        const res = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}/jobs`,
          {
            signal: AbortSignal.timeout(5000),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            jobs?: { title?: string; location?: { name?: string }; absolute_url?: string }[];
          };
          parsed = (json.jobs ?? [])
            .filter((j) => j.title && j.absolute_url)
            .slice(0, 5)
            .map((j) => ({
              role: String(j.title).slice(0, 120),
              location: j.location?.name ? String(j.location.name).slice(0, 100) : null,
              url: String(j.absolute_url).slice(0, 400),
            }));
        }
      } else if (b.provider === 'lever') {
        const res = await fetch(
          `https://api.lever.co/v0/postings/${encodeURIComponent(b.slug)}?mode=json`,
          {
            signal: AbortSignal.timeout(5000),
          },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            text?: string;
            categories?: { location?: string };
            hostedUrl?: string;
          }[];
          if (Array.isArray(json)) {
            parsed = json
              .filter((j) => j.text && j.hostedUrl)
              .slice(0, 5)
              .map((j) => ({
                role: String(j.text).slice(0, 120),
                location: j.categories?.location
                  ? String(j.categories.location).slice(0, 100)
                  : null,
                url: String(j.hostedUrl).slice(0, 400),
              }));
          }
        }
      }
      for (const item of parsed.filter((x) => /^https:\/\//i.test(x.url))) {
        const exists =
          (
            await db.query(`select 1 from alumni_jobs where alumni_id = $1 and url = $2`, [
              userId,
              item.url,
            ])
          ).rowCount! > 0;
        if (!exists) {
          await db.query(
            `insert into alumni_jobs (alumni_id, company, role, location, url, source, fetched_at) values ($1, $2, $3, $4, $5, 'fetched', now())`,
            [userId, company, item.role, item.location, item.url],
          );
          added++;
        }
      }
    } catch {
      // Public job board unreachable or timed out; continue gracefully without failing.
    }
  }

  const jobs = (
    await db.query(
      `select id, alumni_id, company, role, location, url, source, fetched_at, created_at
       from alumni_jobs where alumni_id = $1 and source = 'fetched' order by created_at desc`,
      [userId],
    )
  ).rows as AlumniJob[];

  return { added, jobs };
}

export type KudosMilestoneResult = {
  ok: true;
  alreadyGiven: boolean;
  milestoneId: number;
  kudosCount: number;
  hasKudos: true;
};

/**
 * Shared transactional implementation for giving a permanent, non-revocable kudos
 * on a milestone. Caller must already hold `FOR UPDATE` lock on the acting user's row.
 */
async function giveMilestoneKudosTx(
  c: Db,
  a: Actor,
  milestoneId: number,
): Promise<KudosMilestoneResult> {
  const milestone = (
    await c.query(`select id, user_id, type, to_value from milestones where id = $1`, [milestoneId])
  ).rows[0];
  if (!milestone) throw new Fail(404, 'That milestone does not exist.');
  need(milestone.user_id !== a.id, 'You cannot give kudos to your own milestone.');

  const ins = await c.query(
    `insert into milestone_kudos (milestone_id, user_id)
     values ($1, $2)
     on conflict (milestone_id, user_id) do nothing
     returning milestone_id`,
    [milestoneId, a.id],
  );
  const inserted = (ins.rowCount ?? 0) > 0;
  const countRes = await c.query(
    `select count(*)::int as n from milestone_kudos where milestone_id = $1`,
    [milestoneId],
  );
  return {
    ok: true,
    alreadyGiven: !inserted,
    milestoneId,
    kudosCount: Number(countRes.rows[0]?.n ?? 0),
    hasKudos: true,
  };
}

/* ========================================================================== */
/*                           ALUMNI DIRECTORY                                 */
/* ========================================================================== */

export async function listAlumni(
  db: Db,
  viewerId: string,
  input: {
    q?: string;
    batch?: string | number;
    location?: string;
    availableOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  alumni: AlumniSummary[];
  total: number;
  hasMore: boolean;
  batchOptions: number[];
  locationOptions: string[];
}> {
  const page = Math.min(10_000, Math.max(0, Math.floor(Number(input.page) || 0)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize) || 16)));
  const offset = page * pageSize;

  const conditions: string[] = ["u.role = 'alumni'", 'not u.system', 'not u.suspended'];
  const params: unknown[] = [];
  let pIdx = 1;

  if (input.q && typeof input.q === 'string' && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      u.name ilike $${pIdx} or
      u.handle ilike $${pIdx} or
      coalesce(u.cf_handle, '') ilike $${pIdx} or
      coalesce(u.location, '') ilike $${pIdx} or
      coalesce(u.title, '') ilike $${pIdx} or
      exists (select 1 from alumni_jobs j where j.alumni_id = u.id and (j.company ilike $${pIdx} or j.role ilike $${pIdx} or coalesce(j.title, '') ilike $${pIdx}))
    )`);
    params.push(term);
    pIdx++;
  }

  if (
    input.batch !== undefined &&
    input.batch !== '' &&
    input.batch !== null &&
    input.batch !== 'all'
  ) {
    const b = Number(input.batch);
    if (!Number.isNaN(b)) {
      conditions.push(`u.batch = $${pIdx}`);
      params.push(b);
      pIdx++;
    }
  }

  if (
    input.location &&
    typeof input.location === 'string' &&
    input.location.trim() &&
    input.location !== 'all'
  ) {
    conditions.push(`u.location ilike $${pIdx}`);
    params.push(input.location.trim());
    pIdx++;
  }

  if (input.availableOnly) {
    conditions.push(`u.available_for_questions = true`);
  }

  const whereSql = conditions.join(' and ');

  const countRow = (
    await db.query(`select count(*)::int as total from users u where ${whereSql}`, params)
  ).rows[0];
  const total = Number(countRow?.total ?? 0);

  const viewerParamIdx = pIdx++;
  const limitParamIdx = pIdx++;
  const offsetParamIdx = pIdx++;
  const queryParams = [...params, viewerId, pageSize, offset];

  const rowsRes = await db.query(
    `select u.id, u.member_no as no, u.name,
       coalesce(nullif(u.cf_handle, ''), u.handle) as handle,
       nullif(coalesce(nullif(u.cf_handle, ''), u.handle), '') as cf_handle,
       u.title as role,
       u.title,
       u.batch, u.dept,
       coalesce(u.cf_rating, u.rating) as rating,
       coalesce(u.cf_rating, nullif(u.rating, 0)) as cf_rating,
       greatest(u.problems_solved, u.solved) as problems_solved,
       u.skills,
       ${face('u')} as avatar_url,
       u.location,
       u.available_for_questions,
       exists (select 1 from alumni_saves s where s.user_id = $${viewerParamIdx} and s.alumni_id = u.id) as "isSaved"
     from users u
     where ${whereSql}
     order by (u.id = $${viewerParamIdx}) desc, u.available_for_questions desc, u.rating desc, u.id asc
     limit $${limitParamIdx} offset $${offsetParamIdx}`,
    queryParams,
  );

  const [batchRes, locRes] = await Promise.all([
    db.query(
      `select distinct batch from users where role = 'alumni' and not system and not suspended order by batch desc`,
    ),
    db.query(
      `select distinct location from users where role = 'alumni' and not system and not suspended and location is not null and location <> '' order by location asc`,
    ),
  ]);

  const batchOptions = batchRes.rows.map((r) => Number(r.batch)).filter(Number.isInteger);
  const locationOptions = locRes.rows.map((r) => String(r.location).trim()).filter(Boolean);

  const alumni = rowsRes.rows.map((r) => ({
    ...r,
    skills: Array.isArray(r.skills) ? r.skills : [],
    isSaved: Boolean(r.isSaved),
    saved: Boolean(r.isSaved),
    available_for_questions: Boolean(r.available_for_questions ?? true),
  })) as AlumniSummary[];

  return {
    alumni,
    total,
    hasMore: offset + alumni.length < total,
    batchOptions,
    locationOptions,
  };
}

/* ========================================================================== */
/*                                   JOBS                                     */
/* ========================================================================== */

export async function listAlumniJobs(
  db: Db,
  viewerId: string,
  input: {
    q?: string;
    type?: string;
    sort?: string;
    src?: string;
    source?: string;
    offset?: number;
  } = {},
): Promise<{ jobs: AlumniJob[]; total: number }> {
  const conditions: string[] = [
    `(j.source = 'manual' or j.fetched_at > now() - interval '30 days')`,
  ];
  const params: unknown[] = [viewerId];
  let pIdx = 2;

  const src = input.src || input.source;
  if (src === 'manual' || src === 'fetched') {
    conditions.push(`j.source = $${pIdx}`);
    params.push(src);
    pIdx++;
  }

  if (
    input.type &&
    typeof input.type === 'string' &&
    input.type.trim() &&
    input.type !== 'All job types'
  ) {
    conditions.push(`j.job_type ilike $${pIdx}`);
    params.push(input.type.trim());
    pIdx++;
  }

  if (input.q && typeof input.q === 'string' && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      j.company ilike $${pIdx} or
      j.role ilike $${pIdx} or
      coalesce(j.title, '') ilike $${pIdx} or
      coalesce(j.location, '') ilike $${pIdx} or
      coalesce(j.job_type, '') ilike $${pIdx}
    )`);
    params.push(term);
    pIdx++;
  }

  const whereSql = conditions.join(' and ');

  let orderSql = `case when j.deadline is not null and j.deadline < current_date then 1 else 0 end asc, `;
  if (input.sort === 'vac') {
    orderSql += `j.vacancies desc, coalesce(j.posted_at, j.created_at) desc`;
  } else if (input.sort === 'new') {
    orderSql += `coalesce(j.posted_at, j.created_at) desc, j.id desc`;
  } else {
    // Default = "soon"
    orderSql += `case when j.deadline is not null then j.deadline else '9999-12-31'::date end asc, j.id desc`;
  }

  const rows = (
    await db.query(
      `select j.id, j.alumni_id, j.company, j.role, coalesce(j.title, j.role) as title,
         j.vacancies, j.location, j.job_type, j.experience, j.salary, j.description,
         j.responsibilities, j.requirements,
         to_char(j.deadline, 'YYYY-MM-DD') as deadline,
         j.company_logo_url, j.url, j.source, j.fetched_at,
         coalesce(j.posted_at, j.created_at) as posted_at,
         j.created_at,
         (j.alumni_id = $1) as mine, count(*) over () as total
       from alumni_jobs j
       where ${whereSql}
       order by ${orderSql}
       limit 30 offset $${pIdx}`,
      [...params, Math.max(0, Math.floor(Number(input.offset) || 0))],
    )
  ).rows;

  const jobs = rows.map(({ total: _t, ...r }) => ({
    ...r,
    responsibilities: Array.isArray(r.responsibilities) ? r.responsibilities : [],
    requirements: Array.isArray(r.requirements) ? r.requirements : [],
    vacancies: Number(r.vacancies || 1),
    mine: Boolean(r.mine),
  })) as AlumniJob[];

  // 30 a page; `total` counts every match.
  return {
    jobs,
    total: Number(rows[0]?.total ?? 0),
  };
}

/* ========================================================================== */
/*                             INTERVIEW PREP                                 */
/* ========================================================================== */

export async function listInterviewRoadmaps(
  db: Db,
  viewerId: string,
  kind: RoadmapKind = 'prep',
): Promise<{ roadmaps: InterviewRoadmap[] }> {
  const rows = (
    await db.query(
      `select r.id, r.kind, r.name, r.description, r.created_at,
         (select count(*)::int from interview_topics t where t.roadmap_id = r.id) as "topicCount",
         (select count(*)::int from interview_problems p
          join interview_topics t on t.id = p.topic_id where t.roadmap_id = r.id) as "totalCount",
         (select count(*)::int from interview_user_progress up
          join interview_problems p on p.id = up.problem_id
          join interview_topics t on t.id = p.topic_id
          where t.roadmap_id = r.id and up.user_id = $1) as "solvedCount",
         coalesce((select array_agg(t.name order by t.order_index)
           from interview_topics t where t.roadmap_id = r.id), '{}') as "topicNames"
       from interview_roadmaps r
       where r.kind = $2
       order by r.id asc`,
      [viewerId, kind],
    )
  ).rows;
  return { roadmaps: rows as InterviewRoadmap[] };
}

type RoadmapNodeIn = {
  key?: unknown;
  id?: unknown;
  parentKey?: unknown;
  name?: unknown;
  description?: unknown;
  link?: unknown;
  x?: unknown;
  y?: unknown;
  problems?: unknown;
};
type ProblemIn = { id?: unknown; title?: unknown; url?: unknown; difficulty?: unknown };
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

// Loads the actor inside the transaction and requires full `interview.roadmap.manage`.
/** Roadmaps are kept by full `interview.roadmap.manage` holders (CP Head, President). */
const roadmapManager = (a: Actor) => {
  person(a);
  need(
    canFully(a.roles, 'interview.roadmap.manage'),
    'Only the CP head or president can manage roadmaps.',
  );
};

/** Every problem in a roadmap, for the editor. */
export async function listInterviewProblems(
  db: Db,
  input: { roadmapId?: unknown },
): Promise<{
  problems: Pick<InterviewProblem, 'id' | 'topic_id' | 'title' | 'url' | 'difficulty'>[];
}> {
  const roadmapId = posInt(input.roadmapId, 'roadmap');
  const rows = (
    await db.query(
      `select p.id, p.topic_id, p.title, p.url, p.difficulty from interview_problems p
       join interview_topics t on t.id = p.topic_id where t.roadmap_id = $1 order by p.id`,
      [roadmapId],
    )
  ).rows;
  return { problems: rows as InterviewProblem[] };
}

export async function listInterviewTopics(
  db: Db,
  viewerId: string,
  input: { roadmapId?: unknown } = {},
): Promise<{ topics: InterviewTopic[] }> {
  const roadmapId = input.roadmapId == null ? null : posInt(input.roadmapId, 'roadmap');
  const rows = (
    await db.query(
      `select t.id, t.name, t.description, t.link, t.created_by, t.order_index, t.created_at,
         t.roadmap_id, t.parent_id, t.x, t.y,
         (select count(*)::int from interview_problems p where p.topic_id = t.id) as "totalCount",
         (select count(*)::int from interview_user_progress up
          join interview_problems p on p.id = up.problem_id
          where p.topic_id = t.id and up.user_id = $1) as "solvedCount",
         coalesce((select array_agg(p.title order by p.id)
           from interview_problems p where p.topic_id = t.id), '{}') as "problemTitles"
       from interview_topics t
       where $2::int is null or t.roadmap_id = $2
       order by t.order_index asc, t.name asc`,
      [viewerId, roadmapId],
    )
  ).rows;

  const topics = rows.map((r) => ({
    ...r,
    totalCount: Number(r.totalCount || 0),
    solvedCount: Number(r.solvedCount || 0),
    problemTitles: Array.isArray(r.problemTitles) ? r.problemTitles : [],
  })) as InterviewTopic[];

  return { topics };
}

export async function getInterviewTopicDetail(
  db: Db,
  viewerId: string,
  input: { topicId: number | string },
): Promise<{ topic: InterviewTopic; problems: InterviewProblem[]; tips: InterviewTip[] }> {
  const topicId = posInt(input.topicId, 'topic');
  const topicRow = (
    await db.query(
      `select t.id, t.name, t.description, t.link, t.created_by, t.order_index, t.created_at,
         (select count(*)::int from interview_problems p where p.topic_id = t.id) as "totalCount",
         (select count(*)::int from interview_user_progress up
          join interview_problems p on p.id = up.problem_id
          where p.topic_id = t.id and up.user_id = $1) as "solvedCount"
       from interview_topics t
       where t.id = $2`,
      [viewerId, topicId],
    )
  ).rows[0];
  if (!topicRow) throw new Fail(404, 'That topic does not exist.');

  const [problemsRes, tipsRes] = await Promise.all([
    db.query(
      `select p.id, p.topic_id, p.title, p.url, p.difficulty, p.meta, p.created_by, p.created_at,
         exists (select 1 from interview_user_progress up where up.problem_id = p.id and up.user_id = $1) as solved
       from interview_problems p
       where p.topic_id = $2
       order by p.id asc`,
      [viewerId, topicId],
    ),
    db.query(
      `select tip.id, tip.author_id, tip.topic_id, tip.title, tip.body_md, tip.created_at, tip.updated_at,
         u.name as author_name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
         ${face('u')} as author_avatar,
         coalesce(u.cf_rating, u.rating) as author_rating
       from interview_tips tip
       join users u on u.id = tip.author_id
       where tip.topic_id = $1
       order by tip.created_at desc`,
      [topicId],
    ),
  ]);

  const topic: InterviewTopic = {
    ...topicRow,
    totalCount: Number(topicRow.totalCount || 0),
    solvedCount: Number(topicRow.solvedCount || 0),
  };

  const problems = problemsRes.rows.map((p) => ({
    ...p,
    solved: Boolean(p.solved),
  })) as InterviewProblem[];

  const tips = tipsRes.rows as InterviewTip[];

  return { topic, problems, tips };
}

/* ========================================================================== */
/*                                   BLOGS                                    */
/* ========================================================================== */

export async function listBlogPosts(
  db: Db,
  viewerId: string = '',
  input: {
    q?: string;
    tag?: string;
    sort?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ posts: BlogPost[]; total: number; tags: string[] }> {
  const page = Math.min(10_000, Math.max(0, Math.floor(Number(input.page) || 0)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize) || 12)));
  const offset = page * pageSize;

  const viewerRow = viewerId
    ? (await db.query(`select role, ${ROLES} from users where id = $1`, [viewerId])).rows[0]
    : null;
  const admin = viewerRow && canFully(viewerRow.roles, 'blog.post.delete');

  // Drafts: the author's own, or every draft for a blog admin. The condition always uses $1 and $2: a statement
  // must use every parameter it is sent, and leaving it out for admins failed their whole list.
  const conditions: string[] = [`(b.status = 'published' or b.author_id = $1 or $2)`];
  const params: unknown[] = [viewerId || null, !!admin];
  let pIdx = 3;

  if (
    input.tag &&
    typeof input.tag === 'string' &&
    input.tag.trim() &&
    input.tag.toLowerCase() !== 'all'
  ) {
    conditions.push(`b.tags @> $${pIdx}::jsonb`);
    params.push(JSON.stringify([input.tag.trim().toLowerCase()]));
    pIdx++;
  }

  if (input.q && typeof input.q === 'string' && input.q.trim()) {
    const term = `%${input.q.trim()}%`;
    conditions.push(`(
      b.title ilike $${pIdx} or
      coalesce(b.subtitle, '') ilike $${pIdx} or
      coalesce(b.excerpt, '') ilike $${pIdx} or
      b.body_md ilike $${pIdx} or
      u.name ilike $${pIdx} or
      b.tags::text ilike $${pIdx}
    )`);
    params.push(term);
    pIdx++;
  }

  const whereSql = conditions.length ? conditions.join(' and ') : '1=1';
  const sortSql =
    input.sort === 'oldest'
      ? `coalesce(b.published_at, b.created_at) asc, b.id asc`
      : `coalesce(b.published_at, b.created_at) desc, b.id desc`;

  const countRow = (
    await db.query(
      `select count(*)::int as total from blog_posts b join users u on u.id = b.author_id where ${whereSql}`,
      params,
    )
  ).rows[0];
  const total = Number(countRow?.total ?? 0);

  const queryParams = [...params, pageSize, offset];
  const rows = (
    await db.query(
      `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, left(b.body_md, 400) as body_md,
         array_length(regexp_split_to_array(btrim(b.body_md), '\\s+'), 1) as words,
         b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
         u.name as author_name,
         coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
         ${face('u')} as author_avatar,
         coalesce(u.cf_rating, u.rating) as author_rating,
         u.title as author_role
       from blog_posts b
       join users u on u.id = b.author_id
       where ${whereSql}
       order by ${sortSql}
       limit $${pIdx++} offset $${pIdx++}`,
      queryParams,
    )
  ).rows;

  const tagRows = (
    await db.query(
      `select distinct jsonb_array_elements_text(tags) as tag
       from blog_posts
       where status = 'published'
       order by 1 asc`,
    )
  ).rows;
  const tags = tagRows.map((r) => String(r.tag)).filter(Boolean);

  // A list carries the first 400 characters of each post (cards show an excerpt); getBlogPost has the whole post.
  const posts = rows.map(({ words, ...r }) => ({
    ...r,
    tags: Array.isArray(r.tags) ? r.tags : [],
    read_time_min: Math.max(1, Math.round((words ?? 0) / 200)),
  })) as BlogPost[];

  return { posts, total, tags };
}

export async function getBlogPost(
  db: Db,
  viewerIdOrInput: string | { slug?: string; id?: number | string },
  maybeInput?: { slug?: string; id?: number | string } | string,
): Promise<BlogPost> {
  let viewerId = '';
  let slug: string | undefined;
  let id: number | string | undefined;

  if (typeof viewerIdOrInput === 'object' && viewerIdOrInput !== null) {
    slug = viewerIdOrInput.slug;
    id = viewerIdOrInput.id;
  } else if (typeof viewerIdOrInput === 'string') {
    if (typeof maybeInput === 'string') {
      viewerId = viewerIdOrInput;
      slug = maybeInput;
    } else if (typeof maybeInput === 'object' && maybeInput !== null) {
      viewerId = viewerIdOrInput;
      slug = maybeInput.slug;
      id = maybeInput.id;
    } else {
      slug = viewerIdOrInput;
    }
  }

  let row;
  if (slug) {
    row = (
      await db.query(
        `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, b.body_md,
           b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
           u.name as author_name,
           coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
           ${face('u')} as author_avatar,
           coalesce(u.cf_rating, u.rating) as author_rating,
           u.title as author_role
         from blog_posts b
         join users u on u.id = b.author_id
         where b.slug = $1`,
        [slug],
      )
    ).rows[0];
  } else if (id) {
    const postId = posInt(id, 'post');
    row = (
      await db.query(
        `select b.id, b.author_id, b.slug, b.title, b.subtitle, b.excerpt, b.body_md,
           b.cover_url, b.tags, b.status, b.published_at, b.views, b.created_at, b.updated_at,
           u.name as author_name,
           coalesce(nullif(u.cf_handle, ''), u.handle) as author_handle,
           ${face('u')} as author_avatar,
           coalesce(u.cf_rating, u.rating) as author_rating,
           u.title as author_role
         from blog_posts b
         join users u on u.id = b.author_id
         where b.id = $1`,
        [postId],
      )
    ).rows[0];
  }
  if (!row) throw new Fail(404, 'That blog post does not exist.');

  if (viewerId) {
    const viewerRow = (await db.query(`select role, ${ROLES} from users where id = $1`, [viewerId]))
      .rows[0];
    const admin = viewerRow && canFully(viewerRow.roles, 'blog.post.delete');
    if (row.status !== 'published' && row.author_id !== viewerId && !admin) {
      throw new Fail(403, 'This draft post is private.');
    }
  } else if (row.status !== 'published') {
    throw new Fail(403, 'This draft post is private.');
  }

  // Fire-and-forget view count increment
  db.query(`update blog_posts set views = views + 1 where id = $1`, [row.id]).catch(() => {});

  const wordCount = (row.body_md || '').split(/\s+/).filter(Boolean).length;
  const read_time_min = Math.max(1, Math.round(wordCount / 200));

  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    read_time_min,
  } as BlogPost;
}

/** The photo in a pending profile change request, for the officers who review it. */
export async function profileRequestPhoto(db: Db, viewerId: string, id: string) {
  const v = (
    await db.query(`select ${ROLES} from users where id = $1 and not suspended`, [viewerId])
  ).rows[0];
  need(v && canFully(v.roles, 'member.editDetails'), 'Your role cannot review profile changes.');
  const p = /^\d{1,12}$/.test(id)
    ? (await db.query(`select changes->>'avatar_url' p from profile_requests where id = $1`, [id]))
        .rows[0]?.p
    : null;
  const m = typeof p === 'string' ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(p) : null;
  if (!m) throw new Fail(404, 'No photo.');
  return { type: m[1]!, body: Buffer.from(m[2]!, 'base64') };
}

/** A member's uploaded photo, for any signed-in member (the roster already links it). */
export async function avatar(db: Db, id: string) {
  const p = /^[a-z0-9_]{2,40}$/.test(id)
    ? (
        await db.query(`select avatar_url p from users where id = $1 and avatar_key is not null`, [
          id,
        ])
      ).rows[0]?.p
    : null;
  const m = typeof p === 'string' ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(p) : null;
  if (!m) throw new Fail(404, 'No photo.');
  return { type: m[1]!, body: Buffer.from(m[2]!, 'base64') };
}

/**
 * The audit log for officers with `audit.view`: newest first, 100 at a time, optionally one section and a
 * search over who and what. `counts` are per section for the whole log.
 */
export async function auditQuery(db: Db, userId: string, b: In): Promise<AuditPage> {
  const u = (await db.query(`select ${ROLES} from users where id = $1 and not suspended`, [userId]))
    .rows[0];
  need(u && can(u.roles, 'audit.view'), 'Your role cannot read the audit log.');
  const area = (AUDIT_AREAS as readonly string[]).includes(String(b.area)) ? String(b.area) : null;
  const q = typeof b.q === 'string' ? b.q.trim().slice(0, 80) : '';
  const before = /^\d{1,18}$/.test(String(b.before ?? '')) ? String(b.before) : null;
  // Ordered by the number: the text id would sort '99' above '147'.
  const rows = (
    await db.query(
      `select x.id::text as id, x.at, x.who, x.what, coalesce(x.area, 'Other') as area from audit x
       where ($1::text is null or coalesce(x.area, 'Other') = $1)
         and ($2 = '' or x.who ilike $3 or x.what ilike $3)
         and ($4::bigint is null or x.id < $4)
       order by x.id desc limit 101`,
      [area, q, `%${q.replace(/[\\%_]/g, '\\$&')}%`, before],
    )
  ).rows as AuditEntry[];
  const counts = Object.fromEntries(
    (
      await db.query(`select coalesce(area, 'Other') a, count(*)::int n from audit group by 1`)
    ).rows.map((r: { a: string; n: number }) => [r.a, r.n]),
  );
  return { rows: rows.slice(0, 100), counts, more: rows.length > 100 };
}
