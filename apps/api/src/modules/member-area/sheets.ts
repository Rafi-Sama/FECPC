// Problem sheets. A weekly sheet is built from the Codeforces problemset every Monday (club time); curated sheets
// are pasted Codeforces links from holders of full `sheet.curate` (CP Head, President). Solves come from the
// Codeforces sync (`cf_solves`), so nothing here is ticked by hand or earns XP on its own.
import { canFully, type Role, type SheetProblem } from '@fecpc/contracts';
import { sheet as coreSheet } from '@fecpc/content/member-area';
import { Fail, type Db } from './db.ts';
import { TZ } from './state.ts';

type Actor = { id: string; roles: Role[]; name: string; system: boolean };
type In = Record<string, unknown>;
type Picked = Omit<SheetProblem, 'club'>;
export type CfProblem = {
  contestId?: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
};
export type CfStat = { contestId?: number; index: string; solvedCount: number };

let cache: { at: number; problems: CfProblem[]; stats: CfStat[] } | null = null;
/** The whole Codeforces problemset, kept for 12 hours. Null when Codeforces does not answer. */
async function problemset() {
  if (cache && Date.now() - cache.at < 12 * 3600_000) return cache;
  const res = await fetch('https://codeforces.com/api/problemset.problems', {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const j = (await res?.json().catch(() => null)) as {
    status?: string;
    result?: { problems: CfProblem[]; problemStatistics: CfStat[] };
  } | null;
  if (j?.status !== 'OK' || !j.result) return cache;
  return (cache = {
    at: Date.now(),
    problems: j.result.problems,
    stats: j.result.problemStatistics,
  });
}

const pid = (p: { contestId?: number; index: string }) => `${p.contestId ?? ''}${p.index}`;
// Each band's count, easiest first: 12 problems a week, most of them where members actually are.
const BANDS: [number, number, number][] = [
  [800, 1000, 3],
  [1100, 1300, 3],
  [1400, 1600, 3],
  [1700, 1900, 2],
  [2000, 2300, 1],
];

/**
 * A week's problems: recent contests only (about the last 700 rounds), from the most-solved problems in each band
 * (well tested, standard ideas), varied by main tag, never one already used. Same seed, same sheet.
 */
export function pickWeekly(
  problems: CfProblem[],
  stats: CfStat[],
  exclude: Set<string>,
  seed: number,
): Picked[] {
  const solved = new Map(stats.map((s) => [pid(s), s.solvedCount]));
  const newest = Math.max(0, ...problems.map((p) => p.contestId ?? 0));
  const pool = problems.filter(
    (p) =>
      p.contestId &&
      p.contestId > newest - 700 &&
      p.rating &&
      !p.tags.includes('*special') &&
      !exclude.has(pid(p)),
  );
  let r = seed >>> 0 || 1;
  const rand = () => (r = (Math.imul(r, 1103515245) + 12345) >>> 0) / 2 ** 32;
  const out: Picked[] = [],
    tags = new Set<string>();
  for (const [lo, hi, n] of BANDS) {
    const cands = pool
      .filter((p) => p.rating! >= lo && p.rating! <= hi)
      .sort((a, b) => (solved.get(pid(b)) ?? 0) - (solved.get(pid(a)) ?? 0))
      .slice(0, 80)
      .map((p) => [rand(), p] as const)
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => p);
    const fresh = cands.filter((p) => !tags.has(p.tags[0] ?? ''));
    for (const p of [...fresh, ...cands].filter((p, i, all) => all.indexOf(p) === i).slice(0, n)) {
      tags.add(p.tags[0] ?? '');
      out.push({ id: pid(p), name: p.name, rating: p.rating!, tags: p.tags.slice(0, 5) });
    }
  }
  return out;
}

let building = false;
/** Builds this week's sheet if it is missing. Safe to call often and from several processes. */
export async function ensureWeekly(db: Db) {
  if (building) return;
  building = true;
  try {
    const { week, have } = (
      await db.query(
        `select w::text as week, exists (select 1 from sheets where week = w) as have
         from (select date_trunc('week', now() at time zone '${TZ}')::date as w) x`,
      )
    ).rows[0];
    if (have) return;
    const set = await problemset();
    if (!set) return;
    const used = new Set<string>([
      ...coreSheet.map((p) => p.id),
      ...(
        await db.query(
          `select p->>'id' as id from sheets, jsonb_array_elements(problems) p where kind = 'weekly'`,
        )
      ).rows.map((x: { id: string }) => x.id),
    ]);
    const picked = pickWeekly(set.problems, set.stats, used, Date.parse(week) / 864e5);
    if (!picked.length) return;
    const title =
      'Week of ' +
      new Date(week + 'T00:00:00Z').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
    await db.query(
      `insert into sheets (kind, title, week, problems) values ('weekly', $1, $2, $3) on conflict (week) do nothing`,
      [title, week, JSON.stringify(picked)],
    );
  } finally {
    building = false;
  }
}

// problemset/problem/1352/C or contest/1352/problem/C; the index may carry a digit (1772F1 → F1).
const LINK =
  /codeforces\.com\/(?:problemset\/problem\/(\d{1,5})\/([a-z]\d?)|contest\/(\d{1,5})\/problem\/([a-z]\d?))\b/gi;
/** Problem ids in pasted text, in order, without repeats. */
export function parseLinks(text: string): string[] {
  if (/codeforces\.com\/gym\//i.test(text))
    throw new Fail(400, 'Gym problems cannot be synced. Use problemset or contest links.');
  const ids = [...text.matchAll(LINK)].map(
    (m) => (m[1] ?? m[3]) + (m[2] ?? m[4] ?? '').toUpperCase(),
  );
  return [...new Set(ids)];
}

function need(ok: unknown, why = 'Your role cannot do that.'): asserts ok {
  if (!ok) throw new Fail(403, why);
}
const line = (v: unknown, min: number, max: number, what: string) => {
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t.length < min || t.length > max)
    throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const curator = (a: Actor) =>
  need(
    !a.system && canFully(a.roles, 'sheet.curate'),
    'Only the CP Head or President curates sheets.',
  );

export const sheetHandlers: Record<
  string,
  (c: Db, a: Actor, p: unknown, i: In) => Promise<string | void>
> = {
  async sheetSave(c, a, _p, i) {
    curator(a);
    const title = line(i.title, 2, 60, 'The title'),
      note = line(i.note ?? '', 0, 200, 'The note');
    const ids = parseLinks(typeof i.links === 'string' ? i.links.slice(0, 20_000) : '');
    if (!ids.length) throw new Fail(400, 'Paste at least one Codeforces problem link.');
    if (ids.length > 50) throw new Fail(400, 'A sheet holds at most 50 problems.');
    // Names and ratings from Codeforces; a problem it does not list yet keeps its id as the name.
    const set = await problemset(),
      known = new Map((set?.problems ?? []).map((p) => [pid(p), p]));
    const problems: Picked[] = ids.map((id) => {
      const p = known.get(id);
      return {
        id,
        name: p?.name ?? id,
        rating: p?.rating ?? null,
        tags: p?.tags.slice(0, 5) ?? [],
      };
    });
    const id = i.id === undefined ? null : Number(i.id);
    if (id === null)
      await c.query(
        `insert into sheets (kind, title, note, problems, by) values ('custom', $1, $2, $3, $4)`,
        [title, note, JSON.stringify(problems), a.id],
      );
    else {
      const r = await c.query(
        `update sheets set title = $2, note = $3, problems = $4 where id = $1 and kind = 'custom'`,
        [id, title, note, JSON.stringify(problems)],
      );
      if (!r.rowCount) throw new Fail(404, 'That sheet does not exist.');
    }
    await c.query(`insert into audit (who, what) values ($1, $2)`, [
      a.name,
      `${id === null ? 'published' : 'edited'} sheet "${title}" (${problems.length} problems)`,
    ]);
    return `Sheet saved with ${problems.length} problems.`;
  },
  async sheetDelete(c, a, _p, i) {
    curator(a);
    const r = await c.query(
      `delete from sheets where id = $1 and kind = 'custom' returning title`,
      [Number(i.id) || 0],
    );
    if (!r.rowCount) throw new Fail(404, 'That sheet does not exist.');
    await c.query(`insert into audit (who, what) values ($1, $2)`, [
      a.name,
      `deleted sheet "${r.rows[0].title}"`,
    ]);
  },
};

const CHALLENGES_PER_DAY = 5;
/** Arena challenges: any member posts one Codeforces problem for the club; the poster or a curator removes it. */
export const challengeHandlers: Record<
  string,
  (c: Db, a: Actor, p: unknown, i: In) => Promise<string | void>
> = {
  async challenge(c, a, _p, i) {
    need(!a.system, 'This is an operator account, not a member. It cannot do that.');
    const ids = parseLinks(typeof i.link === 'string' ? i.link.slice(0, 500) : '');
    if (ids.length !== 1) throw new Fail(400, 'Paste one Codeforces problem link.');
    const id = ids[0]!;
    const n = (
      await c.query(
        `select count(*)::int n from challenges where by = $1 and at > now() - interval '1 day'`,
        [a.id],
      )
    ).rows[0].n;
    if (n >= CHALLENGES_PER_DAY)
      throw new Fail(429, `At most ${CHALLENGES_PER_DAY} challenges a day.`);
    const dup = await c.query(
      `select 1 from challenges where problem = $1 and at > now() - interval '30 days'`,
      [id],
    );
    if (dup.rowCount) throw new Fail(409, 'That problem is already an open challenge.');
    const p = (await problemset())?.problems.find((x) => pid(x) === id);
    await c.query(`insert into challenges (problem, name, rating, by) values ($1, $2, $3, $4)`, [
      id,
      p?.name ?? id,
      p?.rating ?? null,
      a.id,
    ]);
    return `Challenge posted: ${p?.name ?? id}.`;
  },
  async challengeDelete(c, a, _p, i) {
    const r = await c.query(
      `delete from challenges where id = $1 and (by = $2 or $3) returning id`,
      [Number(i.id) || 0, a.id, !!canFully(a.roles, 'sheet.curate')],
    );
    if (!r.rowCount) throw new Fail(404, 'That challenge does not exist or is not yours.');
  },
};
