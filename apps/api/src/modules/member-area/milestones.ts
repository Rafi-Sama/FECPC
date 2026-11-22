// Codeforces milestone crossover detection, sync worker helper, and first-deploy backfill.
//
// Policy constants:
// - Daily milestone kudos cap: 20 per user per day, resetting at 00:00 UTC.
// - Sidebar freshness window: 14 days (older milestones stay on the member's profile only).
import { previousRankTitle, rankFor } from '@fecpc/contracts';
import type { MilestoneType } from '@fecpc/contracts';
import { tx, type Db } from './db.ts';

export const DAILY_KUDOS_CAP = 20;
export const MILESTONE_FRESHNESS_DAYS = 14;
export const SOLVED_THRESHOLDS = [100, 250, 500, 750, 1000, 1500, 2000, 3000] as const;
export const STREAK_STEP = 30;

export type CfSnapshot = {
  cf_rating: number | null;
  problems_solved: number;
  current_streak: number;
};

export type DetectedMilestone = {
  type: MilestoneType;
  from_value: string | null;
  to_value: string;
  threshold: number | null;
  meta: Record<string, unknown>;
};

/** Returns every threshold strictly above `oldVal` and at or below `newVal`. */
export function crossesThreshold(
  oldVal: number,
  newVal: number,
  thresholds: readonly number[] = SOLVED_THRESHOLDS,
): number[] {
  if (newVal <= oldVal) return [];
  return thresholds.filter((t) => oldVal < t && newVal >= t);
}

/**
 * Compares previous vs new Codeforces stats and returns all newly crossed
 * milestones across `rank_promotion`, `solved_milestone`, and `contest_streak`.
 */
export function detectCrossovers(
  prev: CfSnapshot,
  next: CfSnapshot,
  meta: Record<string, unknown> = {},
): DetectedMilestone[] {
  const out: DetectedMilestone[] = [];

  // 1. Rank promotion (Codeforces rating tier crossed upward)
  const oldRating = prev.cf_rating ?? 0;
  const newRating = next.cf_rating ?? 0;
  if (newRating > oldRating && newRating > 0) {
    const oldRank = rankFor(oldRating);
    const newRank = rankFor(newRating);
    if (!newRank.unrated && newRank.title !== oldRank.title) {
      const fromTitle = oldRank.unrated ? previousRankTitle(newRank.title) : oldRank.title;
      // Do not emit an initial Unrated -> Newbie entry as a rank promotion; only actual tier promotions.
      if (fromTitle) {
        out.push({
          type: 'rank_promotion',
          from_value: fromTitle,
          to_value: newRank.title,
          threshold: newRating,
          meta,
        });
      }
    }
  }

  // 2. Solved-count milestones
  const oldSolved = Math.max(0, Math.floor(prev.problems_solved || 0));
  const newSolved = Math.max(0, Math.floor(next.problems_solved || 0));
  for (const t of crossesThreshold(oldSolved, newSolved, SOLVED_THRESHOLDS)) {
    out.push({
      type: 'solved_milestone',
      from_value: String(oldSolved),
      to_value: String(t),
      threshold: t,
      meta,
    });
  }

  // 3. Contest / solve streak milestones (multiples of 30 days)
  const oldStreak = Math.max(0, Math.floor(prev.current_streak || 0));
  const newStreak = Math.max(0, Math.floor(next.current_streak || 0));
  if (newStreak > oldStreak && newStreak > 0) {
    const firstMultiple = Math.floor(oldStreak / STREAK_STEP) * STREAK_STEP + STREAK_STEP;
    for (let s = firstMultiple; s <= newStreak; s += STREAK_STEP) {
      out.push({
        type: 'contest_streak',
        from_value: String(oldStreak),
        to_value: String(s),
        threshold: s,
        meta,
      });
    }
  }

  return out;
}

/** Computes current active consecutive-day streak ending today or yesterday (UTC) from a YYYY-MM-DD solve map. */
export function computeStreakFromDays(days: Record<string, number>, now = new Date()): number {
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!days[key(cursor)]) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while ((days[key(cursor)] ?? 0) > 0) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Syncs one user's Codeforces stats against stored values, records any crossed
 * milestones idempotently (`ON CONFLICT DO NOTHING`), and updates the `users` row.
 */
export async function syncUserCodeforcesStats(
  db: Db,
  userId: string,
  next: {
    cf_handle?: string | null;
    cf_rating?: number | null;
    /** Codeforces' own max rating; when given it replaces the stored peak (which may be stale seed data). */
    max_rating?: number | null;
    problems_solved?: number;
    current_streak?: number;
    meta?: Record<string, unknown>;
  },
): Promise<{ inserted: number; detected: DetectedMilestone[] }> {
  const row = (
    await db.query(
      `select id, cf_handle, handle, cf_rating, rating, problems_solved, solved, current_streak, streak
       from users where id = $1 and not system and not suspended`,
      [userId],
    )
  ).rows[0];
  if (!row) return { inserted: 0, detected: [] };

  const prev: CfSnapshot = {
    cf_rating:
      row.cf_rating !== null ? Number(row.cf_rating) : row.rating > 0 ? Number(row.rating) : null,
    problems_solved: Math.max(Number(row.problems_solved || 0), Number(row.solved || 0)),
    current_streak: Math.max(Number(row.current_streak || 0), Number(row.streak || 0)),
  };

  const resolved: CfSnapshot = {
    cf_rating: next.cf_rating !== undefined ? next.cf_rating : prev.cf_rating,
    problems_solved:
      next.problems_solved !== undefined ? next.problems_solved : prev.problems_solved,
    current_streak: next.current_streak !== undefined ? next.current_streak : prev.current_streak,
  };

  const handle = (next.cf_handle ?? row.cf_handle ?? row.handle ?? '').trim() || null;
  const meta = { ...(handle ? { cf_handle: handle } : {}), ...(next.meta ?? {}) };
  const detected = detectCrossovers(prev, resolved, meta);

  let inserted = 0;
  for (const m of detected) {
    const r = await db.query(
      `insert into milestones (user_id, type, from_value, to_value, threshold, meta)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (user_id, type, to_value) do nothing
       returning id`,
      [userId, m.type, m.from_value, m.to_value, m.threshold, JSON.stringify(m.meta)],
    );
    if (r.rowCount && r.rowCount > 0) inserted++;
  }

  const newRatingInt = resolved.cf_rating ?? 0;
  await db.query(
    `update users set
       cf_rating = $2::int,
       rating = coalesce($2::int, rating),
       peak = coalesce($6::int, greatest(peak, $3::int)),
       problems_solved = $4::int,
       solved = greatest(solved, $4::int),
       current_streak = $5::int,
       streak = greatest(streak, $5::int)
     where id = $1`,
    [
      userId,
      resolved.cf_rating,
      newRatingInt,
      resolved.problems_solved,
      resolved.current_streak,
      next.max_rating ?? null,
    ],
  );

  return { inserted, detected };
}

/**
 * Fetches the member's own linked Codeforces handle from the Codeforces API (never from the caller),
 * then records crossed milestones and updates the stored stats. Returns null when there is no
 * valid linked handle or Codeforces does not answer.
 */
export async function syncCodeforces(
  db: Db,
  userId: string,
): Promise<{ handle: string; milestonesCreated: number } | null> {
  const handle = (
    await db.query(
      `select coalesce(nullif(progress->>'handle', ''), nullif(cf_handle, ''), handle) as h
       from users where id = $1 and not system and not suspended`,
      [userId],
    )
  ).rows[0]?.h as string | undefined;
  if (!handle || !/^[\w.-]{3,24}$/.test(handle)) return null;

  const get = async <T>(method: string): Promise<T | null> => {
    const res = await fetch(`https://codeforces.com/api/${method}`, {
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { status?: string; result?: T } | null;
    return json?.status === 'OK' ? (json.result ?? null) : null;
  };
  const h = encodeURIComponent(handle);
  const [info, subs] = await Promise.all([
    get<{ handle?: string; rating?: number; maxRating?: number }[]>(`user.info?handles=${h}`),
    get<
      {
        verdict?: string;
        creationTimeSeconds: number;
        problem: { contestId?: number; index?: string; rating?: number; tags?: string[] };
      }[]
    >(`user.status?handle=${h}&from=1&count=5000`),
  ]);
  if (!info?.[0] || !subs) return null;

  const solved = new Map<string, { p: string; r: number | null; t: string[] }>();
  const days: Record<string, number> = {};
  for (const sub of subs) {
    const pid = `${sub.problem.contestId ?? ''}${sub.problem.index ?? ''}`;
    if (sub.verdict !== 'OK' || solved.has(pid)) continue;
    solved.set(pid, {
      p: pid,
      r: typeof sub.problem.rating === 'number' ? sub.problem.rating : null,
      t: (sub.problem.tags ?? []).filter((t) => typeof t === 'string').slice(0, 20),
    });
    const day = new Date(sub.creationTimeSeconds * 1000).toISOString().slice(0, 10);
    days[day] = (days[day] ?? 0) + 1;
  }
  const cfHandle = info[0].handle ?? handle,
    rating = info[0].rating;
  // The accepted set replaces the stored one in the same transaction as the stats, so sheet XP never sees half a sync.
  const res = await tx(async (c) => {
    await c.query(`delete from cf_solves where user_id = $1`, [userId]);
    await c.query(
      `insert into cf_solves (user_id, problem, rating, tags)
       select $1, x.p, x.r, array(select jsonb_array_elements_text(x.t))
       from jsonb_to_recordset($2::jsonb) as x(p text, r int, t jsonb) on conflict do nothing`,
      [userId, JSON.stringify([...solved.values()].filter((s) => /^\d+[A-Z]\d?$/.test(s.p)))],
    );
    return syncUserCodeforcesStats(c, userId, {
      cf_handle: cfHandle,
      cf_rating: typeof rating === 'number' ? rating : null,
      max_rating: typeof info[0]?.maxRating === 'number' ? info[0].maxRating : null,
      problems_solved: solved.size,
      current_streak: computeStreakFromDays(days),
      meta: { cf_handle: cfHandle, source: 'cf_sync' },
    });
  });
  return { handle: cfHandle, milestonesCreated: res.inserted };
}

/**
 * First-deploy backfill: for existing active users with `problems_solved > 0`
 * and no milestones yet, inserts their current Codeforces rank (or highest
 * crossed solved threshold for Newbies) with `created_at = now()` so the Feed
 * Milestones sidebar is populated on first deploy. Fully idempotent.
 */
export async function backfillMilestones(db: Db): Promise<number> {
  const users = (
    await db.query(
      `select u.id,
         coalesce(nullif(u.cf_handle, ''), u.handle) as cf_handle,
         coalesce(u.cf_rating, u.rating) as cf_rating,
         greatest(u.problems_solved, u.solved) as problems_solved,
         greatest(u.current_streak, u.streak) as current_streak
       from users u
       where not u.system
         and not u.suspended
         and greatest(u.problems_solved, u.solved) > 0
         and not exists (select 1 from milestones m where m.user_id = u.id)
       order by coalesce(u.cf_rating, u.rating) desc, u.id asc`,
    )
  ).rows as {
    id: string;
    cf_handle: string;
    cf_rating: number;
    problems_solved: number;
    current_streak: number;
  }[];

  let inserted = 0;
  for (const u of users) {
    const meta = JSON.stringify({ cf_handle: u.cf_handle || null, backfilled: true });
    const rank = rankFor(u.cf_rating);
    const prevRank = !rank.unrated ? previousRankTitle(rank.title) : null;

    if (prevRank) {
      const r = await db.query(
        `insert into milestones (user_id, type, from_value, to_value, threshold, meta, created_at)
         values ($1, 'rank_promotion', $2, $3, $4, $5::jsonb, now())
         on conflict (user_id, type, to_value) do nothing
         returning id`,
        [u.id, prevRank, rank.title, u.cf_rating, meta],
      );
      if (r.rowCount && r.rowCount > 0) inserted++;
      continue;
    }

    // For Newbie members (< 1200 rating) who have crossed a solved threshold, backfill their highest solved milestone.
    const crossedSolved = [...SOLVED_THRESHOLDS].reverse().find((t) => u.problems_solved >= t);
    if (crossedSolved) {
      const r = await db.query(
        `insert into milestones (user_id, type, from_value, to_value, threshold, meta, created_at)
         values ($1, 'solved_milestone', null, $2, $3, $4::jsonb, now())
         on conflict (user_id, type, to_value) do nothing
         returning id`,
        [u.id, String(crossedSolved), crossedSolved, meta],
      );
      if (r.rowCount && r.rowCount > 0) inserted++;
    }
  }

  return inserted;
}

/** VJudge judges whose solves the Codeforces sync already counts. */
const CF_ON_VJUDGE = new Set(['CodeForces', 'Gym']);

/** Distinct accepted problems in a VJudge `solveDetail` answer, Codeforces ones excluded. */
export function countVjudgeSolved(detail: { acRecords?: Record<string, unknown> } | null): number {
  let n = 0;
  for (const [oj, list] of Object.entries(detail?.acRecords ?? {}))
    if (!CF_ON_VJUDGE.has(oj) && Array.isArray(list)) n += new Set(list).size;
  return n;
}

/**
 * Fetches the member's own linked VJudge handle from VJudge (never from the caller) and stores the solve count,
 * which feeds the member's XP. Returns null when there is no linked handle or VJudge does not answer.
 */
export async function syncVjudge(
  db: Db,
  userId: string,
): Promise<{ handle: string; solved: number } | null> {
  const handle = (
    await db.query(
      `select vjudge_handle as h from users where id = $1 and not system and not suspended`,
      [userId],
    )
  ).rows[0]?.h as string | undefined;
  if (!handle || !/^[\w.-]{2,30}$/.test(handle)) return null;
  const res = await fetch(`https://vjudge.net/user/solveDetail/${encodeURIComponent(handle)}`, {
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const detail = (await res.json().catch(() => null)) as {
    acRecords?: Record<string, unknown>;
  } | null;
  if (!detail?.acRecords) return null;
  const solved = countVjudgeSolved(detail);
  // Only if the handle is still the one we fetched: the member may have changed it meanwhile.
  await db.query(`update users set vj_solved = $3 where id = $1 and vjudge_handle = $2`, [
    userId,
    handle,
    solved,
  ]);
  return { handle, solved };
}
