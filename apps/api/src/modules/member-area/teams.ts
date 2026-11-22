// ICPC teams: who is on which team, and each member's own notebook (kept with the person, team or not).
// Every handler checks its own permission: a team's members act on it; its coach and full `teams.oversee`
// holders (CP Head and above) may see and rename it. Nobody else reads a team's notebook.
import { canFully, type Role } from '@fecpc/contracts';
import { templates } from '@fecpc/content/training';
import { Fail, type Db } from './db.ts';

type Actor = { id: string; roles: Role[]; system: boolean };
type In = Record<string, unknown>;
export const TEAM_SIZE = 3;

function need(ok: unknown, why = 'Your role cannot do that.'): asserts ok {
  if (!ok) throw new Fail(403, why);
}
const member = (a: Actor) =>
  need(!a.system, 'This is an operator account, not a member. It cannot do that.');
const line = (v: unknown, max: number, what: string) => {
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t.length < 2 || t.length > max)
    throw new Fail(400, `${what} must be 2 to ${max} characters.`);
  return t;
};
const teamName = (v: unknown) => {
  const t = line(v, 40, 'The team name');
  if (!/^[\w .+#-]+$/.test(t))
    throw new Fail(400, 'Use letters, digits, spaces and _ . + # - only.');
  return t;
};

/** The team this member is on, or null. */
export const teamOf = async (c: Db, userId: string): Promise<number | null> =>
  (await c.query(`select team_id from icpc_members where user_id = $1`, [userId])).rows[0]
    ?.team_id ?? null;

/** 'member' for the team's own people, 'staff' for its coach and CP Head and above, else null. */
async function access(c: Db, a: Actor, teamId: number): Promise<'member' | 'staff' | null> {
  const t = (
    await c.query(
      `select coach, exists (select 1 from icpc_members where team_id = $1 and user_id = $2) as mine
       from icpc_teams where id = $1`,
      [teamId, a.id],
    )
  ).rows[0];
  if (!t) throw new Fail(404, 'That team does not exist.');
  return t.mine
    ? 'member'
    : t.coach === a.id || canFully(a.roles, 'teams.oversee')
      ? 'staff'
      : null;
}
const log = (c: Db, teamId: number, a: Actor, what: string) =>
  c.query(`insert into icpc_log (team_id, user_id, what) values ($1, $2, $3)`, [
    teamId,
    a.id,
    what,
  ]);
const note = (c: Db, a: Actor, what: string) =>
  c.query(`insert into notebook_log (user_id, what) values ($1, $2)`, [a.id, what]);
/** The actor's own team, required. */
async function mine(c: Db, a: Actor) {
  member(a);
  const id = await teamOf(c, a.id);
  need(id, 'You are not on a team.');
  return id;
}

/** A member's topic names are unique, ignoring case; at most 40 each. `except` is the topic being renamed. */
async function ownTopicFree(c: Db, userId: string, topic: string, except = '') {
  const own = (await c.query(`select topic from notebook where user_id = $1`, [userId])).rows.map(
    (r) => r.topic as string,
  );
  if (own.some((t) => t !== except && t.toLowerCase() === topic.toLowerCase()))
    throw new Fail(409, `You already have a topic named "${topic}".`);
  if (!except && own.length >= 40) throw new Fail(400, 'You can keep at most 40 topics.');
}
/** Lines added and removed, counted as a multiset (order changes and a final newline are not counted). */
export function lineDiff(before: string, after: string): [number, number] {
  const left = new Map<string, number>();
  for (const l of before.replace(/\n$/, '').split('\n')) left.set(l, (left.get(l) ?? 0) + 1);
  let plus = 0;
  for (const l of after.replace(/\n$/, '').split('\n')) {
    const n = left.get(l) ?? 0;
    if (n) left.set(l, n - 1);
    else plus++;
  }
  return [plus, [...left.values()].reduce((a, b) => a + b, 0)];
}

export const teamHandlers: Record<
  string,
  (c: Db, a: Actor, p: unknown, i: In) => Promise<string | void>
> = {
  async teamRename(c, a, _p, i) {
    const id = i.teamId === undefined ? await mine(c, a) : Number(i.teamId);
    need(
      Number.isInteger(id) && (await access(c, a, id)),
      'Only the team, its coach or the CP Head can rename it.',
    );
    const name = teamName(i.name);
    const r = await c.query(
      `update icpc_teams set name = $2 where id = $1 and not exists (select 1 from icpc_teams where name = $2 and id <> $1) returning id`,
      [id, name],
    );
    if (!r.rows[0]) throw new Fail(409, 'That team name is taken.');
    await log(c, id, a, `renamed the team to ${name}`);
  },
  async teamInvite(c, a, _p, i) {
    member(a);
    const id = await teamOf(c, a.id); // null: no team yet, one is made when the first invite is accepted
    const to = String(i.user ?? '');
    need(to !== a.id, 'You cannot invite yourself.');
    const t = (
      await c.query(`select 1 from users where id = $1 and not system and not suspended`, [to])
    ).rows[0];
    need(t, 'That member does not exist.');
    // Inviting someone who already invited you accepts their invitation.
    if (
      !id &&
      (
        await c.query(
          `select 1 from pings where from_user = $1 and to_user = $2 and kind = 'invite' and ref like 'team:%'`,
          [to, a.id],
        )
      ).rowCount
    )
      return teamHandlers.teamJoin!(c, a, _p, { from: to });
    need(!(await teamOf(c, to)), 'That member is already on a team.');
    if (id) {
      const n = (await c.query(`select count(*)::int n from icpc_members where team_id = $1`, [id]))
        .rows[0].n;
      if (n >= TEAM_SIZE) throw new Fail(409, `A team has at most ${TEAM_SIZE} members.`);
    }
    await c.query(
      `insert into pings (from_user, to_user, kind, ref) values ($1, $2, 'invite', $3) on conflict do nothing`,
      [a.id, to, 'team:' + (id ?? 'new')],
    );
  },
  async teamJoin(c, a, _p, i) {
    member(a);
    const from = String(i.from ?? '');
    need(!(await teamOf(c, a.id)), 'Leave your current team first.');
    // Lock the inviter so two accepted invites never make two teams for them.
    await c.query(`select 1 from users where id = $1 for update`, [from]);
    let id = await teamOf(c, from);
    // Only on an invitation that still matches the inviter's team (or their lack of one).
    const ok = (
      await c.query(
        `select 1 from pings where from_user = $1 and to_user = $2 and kind = 'invite' and ref = $3`,
        [from, a.id, 'team:' + (id ?? 'new')],
      )
    ).rowCount;
    need(ok, 'You need an invitation from a member of that team.');
    if (id) {
      await c.query(`select 1 from icpc_teams where id = $1 for update`, [id]); // the last place goes to one person
      const n = (await c.query(`select count(*)::int n from icpc_members where team_id = $1`, [id]))
        .rows[0].n;
      if (n >= TEAM_SIZE) throw new Fail(409, 'That team is full.');
    } else {
      // A team exists from its second member on; it starts as "Team <id>" and can be renamed.
      id = (
        await c.query(`insert into icpc_teams (name) values (gen_random_uuid()::text) returning id`)
      ).rows[0].id as number;
      await c.query(
        `update icpc_teams set name = 'Team ' || id where id = $1
         and not exists (select 1 from icpc_teams where name = 'Team ' || $1)`,
        [id],
      );
      await c.query(`insert into icpc_members (team_id, user_id) values ($1, $2)`, [id, from]);
      await c.query(`insert into icpc_log (team_id, user_id, what) values ($1, $2, $3)`, [
        id,
        from,
        'created the team',
      ]);
    }
    await c.query(`insert into icpc_members (team_id, user_id) values ($1, $2)`, [id, a.id]);
    await c.query(
      `delete from pings where to_user = $1 and kind = 'invite' and ref like 'team:%'`,
      [a.id],
    );
    // Invites either of them sent before having a team now invite to this one.
    await c.query(
      `update pings set ref = $3 where from_user in ($1, $2) and kind = 'invite' and ref = 'team:new'`,
      [from, a.id, 'team:' + id],
    );
    await log(c, id, a, 'joined');
  },
  async teamLeave(c, a) {
    const id = await mine(c, a);
    await c.query(`delete from icpc_members where user_id = $1`, [a.id]);
    await c.query(`delete from pings where from_user = $1 and ref = $2`, [a.id, 'team:' + id]);
    const left = (await c.query(`select 1 from icpc_members where team_id = $1`, [id])).rowCount;
    if (!left) await c.query(`delete from icpc_teams where id = $1`, [id]);
    else await log(c, id, a, 'left');
  },
  // Notebook topics belong to the member, on a team or not; nobody else writes them.
  async teamTopic(c, a, _p, i) {
    member(a);
    const topic = line(i.topic, 40, 'The topic');
    if (i.on === false) {
      const r = await c.query(`delete from notebook where user_id = $1 and topic = $2`, [
        a.id,
        topic,
      ]);
      if (r.rowCount) await note(c, a, `removed topic ${topic}`);
      return;
    }
    await ownTopicFree(c, a.id, topic);
    await c.query(`insert into notebook (user_id, topic, code) values ($1, $2, $3)`, [
      a.id,
      topic,
      templates.find((t) => t.name === topic)?.code ?? `// ${topic}\n`,
    ]);
    await note(c, a, `added topic ${topic}`);
  },
  async teamTopicRename(c, a, _p, i) {
    member(a);
    const from = line(i.topic, 40, 'The topic'),
      to = line(i.to, 40, 'The new name');
    if (from === to) return;
    await ownTopicFree(c, a.id, to, from);
    const r = await c.query(
      `update notebook set topic = $3, updated_at = now() where user_id = $1 and topic = $2`,
      [a.id, from, to],
    );
    need(r.rowCount, 'You have no topic by that name.');
    await note(c, a, `renamed topic ${from} to ${to}`);
  },
  // Your own pages, or (`owner`) a teammate's: that edit is logged on their page with your name.
  async teamNote(c, a, _p, i) {
    member(a);
    const owner = i.owner === undefined ? a.id : String(i.owner);
    const topic = line(i.topic, 40, 'The topic');
    const code = typeof i.code === 'string' ? i.code.replace(/\r\n?/g, '\n') : '';
    if (code.length > 20_000) throw new Fail(400, 'A page holds at most 20,000 characters.');
    if (owner !== a.id) {
      const team = await teamOf(c, a.id);
      need(team && team === (await teamOf(c, owner)), "You can edit only your teammates' pages.");
    }
    const old = (
      await c.query(
        `select code, updated_at::text as v from notebook where user_id = $1 and topic = $2 for update`,
        [owner, topic],
      )
    ).rows[0];
    need(old, 'Add the topic first.');
    // `since` is the version the editor opened; a newer save in between would be silently lost.
    if (typeof i.since === 'string' && i.since !== old.v)
      throw new Fail(
        409,
        'Someone saved this page after you opened it. Copy your changes, then reopen it.',
      );
    if (old.code === code) return;
    await c.query(
      `update notebook set code = $3, updated_at = now() where user_id = $1 and topic = $2`,
      [owner, topic, code],
    );
    const [plus, minus] = lineDiff(old.code, code);
    await c.query(`insert into notebook_log (user_id, what, by) values ($1, $2, $3)`, [
      owner,
      `edited ${topic} (+${plus} −${minus} lines)`,
      owner === a.id ? null : a.id,
    ]);
  },
  async teamCoach(c, a, _p, i) {
    need(canFully(a.roles, 'teams.oversee'), 'Only the CP Head assigns coaches.');
    const id = Number(i.teamId),
      coach = i.user ? String(i.user) : null;
    if (coach)
      need(
        (
          await c.query(`select 1 from users where id = $1 and not system and not suspended`, [
            coach,
          ])
        ).rowCount,
        'That member does not exist.',
      );
    const r = await c.query(`update icpc_teams set coach = $2 where id = $1 returning id`, [
      id,
      coach,
    ]);
    if (!r.rows[0]) throw new Fail(404, 'That team does not exist.');
    await log(c, id, a, coach ? 'assigned a coach' : 'removed the coach');
  },
};

/** One team for the teams page: the viewer's own, or (`teamId`) one they coach or oversee. */
export async function getTeam(db: Db, userId: string, input: { teamId?: unknown }) {
  const a = (
    await db.query(
      `select id, system, array_prepend(role, coalesce((select pr.roles from post_roles pr where pr.post = users.post), '{}')) as roles from users where id = $1`,
      [userId],
    )
  ).rows[0] as Actor;
  const oversee = canFully(a.roles, 'teams.oversee');
  const own = await teamOf(db, userId);
  const id = input.teamId === undefined || input.teamId === null ? own : Number(input.teamId);
  const invites = (
    await db.query(
      `select p.from_user as "from", f.name as "fromName", t.name from pings p
       join users f on f.id = p.from_user
       left join icpc_members m on m.user_id = p.from_user left join icpc_teams t on t.id = m.team_id
       where p.to_user = $1 and p.kind = 'invite' and p.ref = 'team:' || coalesce(m.team_id::text, 'new')`,
      [userId],
    )
  ).rows as { from: string; fromName: string; name: string | null }[];
  const sent = (
    await db.query(
      `select to_user from pings where from_user = $1 and kind = 'invite' and ref like 'team:%'`,
      [userId],
    )
  ).rows.map((r) => r.to_user as string);
  // Only people on no team can be invited, plus whoever invited you (inviting them back accepts).
  const free = async () =>
    (
      await db.query(
        `select u.id, u.name, u.handle from users u where not u.system and not u.suspended and u.id <> $1
         and (not exists (select 1 from icpc_members m where m.user_id = u.id)
           or exists (select 1 from pings p where p.from_user = u.id and p.to_user = $1
             and p.kind = 'invite' and p.ref like 'team:%'))
         order by u.name limit 200`,
        [userId],
      )
    ).rows as { id: string; name: string; handle: string }[];
  const teams = (
    await db.query(
      `select t.id, t.name, count(m.user_id)::int as size from icpc_teams t
       left join icpc_members m on m.team_id = t.id
       where $1 or t.coach = $2 group by t.id order by t.name`,
      [oversee, userId],
    )
  ).rows as { id: number; name: string; size: number }[];
  if (!id || !Number.isInteger(id))
    return {
      team: null,
      invites,
      teams,
      sent,
      free: a.system || own ? [] : await free(),
      ...(await notebooks(db, [userId], null)),
    };
  const how = await access(db, a, id);
  need(how, 'Only the team, its coach or the CP Head can open it.');
  const [team, members, pool] = await Promise.all([
    db.query(
      `select t.id, t.name, t.coach, c.name as coach_name from icpc_teams t left join users c on c.id = t.coach where t.id = $1`,
      [id],
    ),
    db.query(
      `select u.id, u.name, u.handle from icpc_members m join users u on u.id = m.user_id where m.team_id = $1 order by u.name`,
      [id],
    ),
    how === 'member' ? free() : [],
  ]);
  const ids = members.rows.map((m) => m.id as string);
  const stats = await teamStats(db, ids);
  const { notes, history } = await notebooks(
    db,
    members.rows.map((m) => m.id as string),
    id,
  );
  return {
    team: { ...team.rows[0], mine: how === 'member', size: TEAM_SIZE },
    members: members.rows as { id: string; name: string; handle: string }[],
    notes,
    history,
    stats,
    free: pool,
    invites,
    sent,
    teams,
  };
}

/** These members' own notebooks, and their change log merged with the team's own events (if any). */
async function notebooks(db: Db, userIds: string[], teamId: number | null) {
  const [notes, history] = await Promise.all([
    db.query(
      `select user_id, topic, code, updated_at::text as updated_at from notebook where user_id = any($1) order by topic`,
      [userIds],
    ),
    db.query(
      `select coalesce(u.name, 'someone') as who, x.user_id, x.what, x.at, x.by, b.name as by_name from (
         select user_id, what, at, null::text as by from icpc_log where team_id = $2
         union all select user_id, what, at, by from notebook_log where user_id = any($1) or by = any($1)
       ) x left join users u on u.id = x.user_id left join users b on b.id = x.by
       order by x.at desc limit 500`,
      [userIds, teamId],
    ),
  ]);
  return {
    notes: notes.rows as { user_id: string; topic: string; code: string; updated_at: string }[],
    history: history.rows as {
      who: string;
      user_id: string;
      what: string;
      at: string;
      /** Set when a teammate, not the owner, made the change. */
      by: string | null;
      by_name: string | null;
    }[],
  };
}

/** Real numbers for the team overview, from stored Codeforces/VJudge stats, accepted problems and notebooks. */
async function teamStats(db: Db, ids: string[]) {
  const [people, tags, spread, totals] = await Promise.all([
    db.query(
      `select u.id, coalesce(nullif(u.cf_handle, ''), u.handle) as cf_handle, u.cf_rating, u.peak,
         u.problems_solved, u.vj_solved, u.current_streak, u.contests_participated,
         (select count(*)::int from notebook n where n.user_id = u.id) as topics,
         (select count(*)::int from notebook_log l where (l.user_id = u.id and l.by is null or l.by = u.id)
            and l.at > now() - interval '30 days') as edits_30d
       from users u where u.id = any($1) order by u.name`,
      [ids],
    ),
    // Per tag: distinct problems the team solved, and how many of them each member solved.
    db.query(
      `with x as (select t.tag, s.problem, s.user_id from cf_solves s cross join unnest(s.tags) as t(tag)
                  where s.user_id = any($1)),
            per as (select tag, user_id, count(*)::int as n from x group by tag, user_id)
       select p.tag, (select count(distinct x.problem)::int from x where x.tag = p.tag) as team,
              json_object_agg(p.user_id, p.n) as per
       from per p group by p.tag order by team desc, p.tag limit 12`,
      [ids],
    ),
    db.query(
      `select least(greatest(rating, 800) / 400 * 400, 2800) as band, count(distinct problem)::int as n
       from cf_solves where user_id = any($1) and rating is not null group by 1 order by 1`,
      [ids],
    ),
    db.query(
      `select count(distinct problem)::int as distinct_solved,
         (select count(*)::int from (select problem from cf_solves where user_id = any($1)
            group by problem having count(distinct user_id) = cardinality($1::text[])) a) as solved_by_all
       from cf_solves where user_id = any($1)`,
      [ids],
    ),
  ]);
  return {
    members: people.rows as {
      id: string;
      cf_handle: string;
      cf_rating: number | null;
      peak: number;
      problems_solved: number;
      vj_solved: number;
      current_streak: number;
      contests_participated: number;
      topics: number;
      edits_30d: number;
    }[],
    tags: tags.rows as { tag: string; team: number; per: Record<string, number> }[],
    spread: spread.rows as { band: number; n: number }[],
    distinctSolved: totals.rows[0].distinct_solved as number,
    solvedByAll: totals.rows[0].solved_by_all as number,
  };
}
