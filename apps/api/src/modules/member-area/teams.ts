// ICPC teams: who is on which team, each member's notebook pages, and the team's edit history.
// Every handler checks its own permission: a team's members act on it; its coach and full `mentees.view`
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
  return t.mine ? 'member' : t.coach === a.id || canFully(a.roles, 'mentees.view') ? 'staff' : null;
}
const log = (c: Db, teamId: number, a: Actor, what: string) =>
  c.query(`insert into icpc_log (team_id, user_id, what) values ($1, $2, $3)`, [
    teamId,
    a.id,
    what,
  ]);
/** The actor's own team, required. */
async function mine(c: Db, a: Actor) {
  member(a);
  const id = await teamOf(c, a.id);
  need(id, 'You are not on a team.');
  return id;
}

export const teamHandlers: Record<
  string,
  (c: Db, a: Actor, p: unknown, i: In) => Promise<string | void>
> = {
  async teamCreate(c, a, _p, i) {
    member(a);
    need(!(await teamOf(c, a.id)), 'Leave your current team first.');
    const name = teamName(i.name);
    const r = await c.query(
      `insert into icpc_teams (name) values ($1) on conflict (name) do nothing returning id`,
      [name],
    );
    if (!r.rows[0]) throw new Fail(409, 'That team name is taken.');
    await c.query(`insert into icpc_members (team_id, user_id) values ($1, $2)`, [
      r.rows[0].id,
      a.id,
    ]);
    await log(c, r.rows[0].id, a, 'created the team');
  },
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
    const id = await mine(c, a);
    const to = String(i.user ?? '');
    need(to !== a.id, 'You are already on this team.');
    const t = (
      await c.query(`select 1 from users where id = $1 and not system and not suspended`, [to])
    ).rows[0];
    need(t, 'That member does not exist.');
    need(!(await teamOf(c, to)), 'That member is already on a team.');
    const n = (await c.query(`select count(*)::int n from icpc_members where team_id = $1`, [id]))
      .rows[0].n;
    if (n >= TEAM_SIZE) throw new Fail(409, `A team has at most ${TEAM_SIZE} members.`);
    await c.query(
      `insert into pings (from_user, to_user, kind, ref) values ($1, $2, 'invite', $3) on conflict do nothing`,
      [a.id, to, 'team:' + id],
    );
  },
  async teamJoin(c, a, _p, i) {
    member(a);
    const id = Number(i.teamId);
    need(Number.isInteger(id), 'That team does not exist.');
    need(!(await teamOf(c, a.id)), 'Leave your current team first.');
    // Only on an invitation from someone who is on that team right now.
    const ok = (
      await c.query(
        `select 1 from pings p join icpc_members m on m.user_id = p.from_user and m.team_id = $2
         where p.to_user = $1 and p.kind = 'invite' and p.ref = $3`,
        [a.id, id, 'team:' + id],
      )
    ).rowCount;
    need(ok, 'You need an invitation from a member of that team.');
    await c.query(`select 1 from icpc_teams where id = $1 for update`, [id]); // the last place goes to one person
    const n = (await c.query(`select count(*)::int n from icpc_members where team_id = $1`, [id]))
      .rows[0].n;
    if (n >= TEAM_SIZE) throw new Fail(409, 'That team is full.');
    await c.query(`insert into icpc_members (team_id, user_id) values ($1, $2)`, [id, a.id]);
    await c.query(
      `delete from pings where to_user = $1 and kind = 'invite' and ref like 'team:%'`,
      [a.id],
    );
    await log(c, id, a, 'joined');
  },
  async teamLeave(c, a) {
    const id = await mine(c, a);
    await c.query(`delete from icpc_members where user_id = $1`, [a.id]);
    await c.query(`delete from icpc_notes where team_id = $1 and user_id = $2`, [id, a.id]);
    await c.query(`delete from pings where from_user = $1 and ref = $2`, [a.id, 'team:' + id]);
    const left = (await c.query(`select 1 from icpc_members where team_id = $1`, [id])).rowCount;
    if (!left) await c.query(`delete from icpc_teams where id = $1`, [id]);
    else await log(c, id, a, 'left');
  },
  async teamTopic(c, a, _p, i) {
    const id = await mine(c, a);
    const topic = line(i.topic, 40, 'The topic');
    if (i.on === false) {
      await c.query(`delete from icpc_notes where team_id = $1 and topic = $2`, [id, topic]);
      return void (await log(c, id, a, `removed ${topic}`));
    }
    const n = (
      await c.query(`select count(distinct topic)::int n from icpc_notes where team_id = $1`, [id])
    ).rows[0].n;
    if (n >= 40) throw new Fail(400, 'A notebook has at most 40 topics.');
    const r = await c.query(
      `insert into icpc_notes (team_id, user_id, topic, code) values ($1, $2, $3, $4) on conflict do nothing`,
      [id, a.id, topic, templates.find((t) => t.name === topic)?.code ?? `// ${topic}\n`],
    );
    if (r.rowCount) await log(c, id, a, `added ${topic}`);
  },
  async teamNote(c, a, _p, i) {
    const id = await mine(c, a);
    const topic = line(i.topic, 40, 'The topic');
    const code = typeof i.code === 'string' ? i.code.replace(/\r\n?/g, '\n') : '';
    if (code.length > 20_000) throw new Fail(400, 'A page holds at most 20,000 characters.');
    need(
      (await c.query(`select 1 from icpc_notes where team_id = $1 and topic = $2`, [id, topic]))
        .rowCount,
      'Add the topic first.',
    );
    // Each member writes only their own page.
    await c.query(
      `insert into icpc_notes (team_id, user_id, topic, code) values ($1, $2, $3, $4)
       on conflict (team_id, user_id, topic) do update set code = excluded.code, updated_at = now()`,
      [id, a.id, topic, code],
    );
    await log(c, id, a, `edited ${topic}`);
  },
  async teamCoach(c, a, _p, i) {
    need(canFully(a.roles, 'mentees.view'), 'Only the CP Head assigns coaches.');
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
  const oversee = canFully(a.roles, 'mentees.view');
  const own = await teamOf(db, userId);
  const id = input.teamId === undefined || input.teamId === null ? own : Number(input.teamId);
  const invites = (
    await db.query(
      `select t.id, t.name, f.name as "from" from pings p
       join icpc_members m on m.user_id = p.from_user and 'team:' || m.team_id = p.ref
       join icpc_teams t on t.id = m.team_id join users f on f.id = p.from_user
       where p.to_user = $1 and p.kind = 'invite'`,
      [userId],
    )
  ).rows as { id: number; name: string; from: string }[];
  const teams = (
    await db.query(
      `select t.id, t.name, count(m.user_id)::int as size from icpc_teams t
       left join icpc_members m on m.team_id = t.id
       where $1 or t.coach = $2 group by t.id order by t.name`,
      [oversee, userId],
    )
  ).rows as { id: number; name: string; size: number }[];
  if (!id || !Number.isInteger(id)) return { team: null, invites, teams };
  const how = await access(db, a, id);
  need(how, 'Only the team, its coach or the CP Head can open it.');
  const [team, members, notes, history, free] = await Promise.all([
    db.query(
      `select t.id, t.name, t.coach, c.name as coach_name from icpc_teams t left join users c on c.id = t.coach where t.id = $1`,
      [id],
    ),
    db.query(
      `select u.id, u.name, u.handle from icpc_members m join users u on u.id = m.user_id where m.team_id = $1 order by u.name`,
      [id],
    ),
    db.query(
      `select user_id, topic, code, updated_at from icpc_notes where team_id = $1 order by topic`,
      [id],
    ),
    db.query(
      `select coalesce(u.name, 'someone') as who, l.user_id, l.what, l.at from icpc_log l
       left join users u on u.id = l.user_id where l.team_id = $1 order by l.id desc limit 30`,
      [id],
    ),
    how === 'member'
      ? db.query(
          `select u.id, u.name from users u where not u.system and not u.suspended
           and not exists (select 1 from icpc_members m where m.user_id = u.id) order by u.name limit 200`,
        )
      : Promise.resolve({ rows: [] }),
  ]);
  return {
    team: { ...team.rows[0], mine: how === 'member', size: TEAM_SIZE },
    members: members.rows as { id: string; name: string; handle: string }[],
    notes: notes.rows as { user_id: string; topic: string; code: string; updated_at: string }[],
    history: history.rows as { who: string; user_id: string; what: string; at: string }[],
    free: free.rows as { id: string; name: string }[],
    invites,
    teams,
  };
}
