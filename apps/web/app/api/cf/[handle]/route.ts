// Judge sync for one handle: profile, rating history and accepted problems from the Codeforces API.
// Cached for 10 minutes so no screen ever hammers the judge.
// `?fresh=1` skips the cache for submissions only, so "I solved it" sees an accept made a minute ago.
type Round = {
  contestId: number;
  contestName: string;
  rank: number;
  oldRating: number;
  newRating: number;
  ratingUpdateTimeSeconds: number;
};

type Problem = { contestId?: number; index: string; name: string; rating?: number };
// The problemset is too big for the fetch cache, so it is kept here for 12 hours (contest standings no longer
// accept filters, so this is where a round's problem list comes from).
let problemset: { at: number; byContest: Map<number, Problem[]> } | null = null;
async function contestProblems() {
  if (problemset && Date.now() - problemset.at < 12 * 3600_000) return problemset.byContest;
  const j = await fetch('https://codeforces.com/api/problemset.problems', {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
    .then((r) => r.json())
    .catch(() => null);
  if (j?.status !== 'OK') return problemset?.byContest ?? new Map<number, Problem[]>();
  const byContest = new Map<number, Problem[]>();
  for (const p of j.result.problems as Problem[])
    if (p.contestId) byContest.set(p.contestId, [...(byContest.get(p.contestId) ?? []), p]);
  for (const ps of byContest.values()) ps.sort((a, b) => a.index.localeCompare(b.index));
  problemset = { at: Date.now(), byContest };
  return byContest;
}

export async function GET(req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const fresh = new URL(req.url).searchParams.has('fresh');
  if (!/^[\w.-]{3,24}$/.test(handle))
    return Response.json({ error: 'That is not a valid Codeforces handle.' }, { status: 400 });
  const get = async (m: string, noCache = false) => {
    const r = await fetch(`https://codeforces.com/api/${m}`, {
      ...(noCache ? { cache: 'no-store' as const } : { next: { revalidate: 600 } }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json();
    if (j.status !== 'OK') throw new Error(j.comment ?? 'Codeforces error');
    return j.result;
  };
  try {
    const [[info], rating, subs] = await Promise.all([
      get(`user.info?handles=${handle}`),
      get(`user.rating?handle=${handle}`),
      get(`user.status?handle=${handle}&from=1&count=5000`, fresh),
    ]);
    const solved = new Set<string>(),
      tags: Record<string, number> = {},
      days: Record<string, number> = {};
    for (const s of subs) {
      const id = `${s.problem.contestId}${s.problem.index}`;
      if (s.verdict !== 'OK' || solved.has(id)) continue;
      solved.add(id);
      for (const t of s.problem.tags ?? []) tags[t] = (tags[t] ?? 0) + 1;
      const d = new Date(s.creationTimeSeconds * 1000).toISOString().slice(0, 10);
      days[d] = (days[d] ?? 0) + 1;
    }
    // The last three rated rounds with their problem lists, for the upsolve queue.
    const byContest = await contestProblems();
    const contests = (rating as Round[])
      .slice(-3)
      .reverse()
      .map((r) => ({
        id: r.contestId,
        name: r.contestName,
        rank: r.rank,
        delta: r.newRating - r.oldRating,
        at: r.ratingUpdateTimeSeconds * 1000,
        problems: (byContest.get(r.contestId) ?? []).map((p) => ({
          id: `${r.contestId}${p.index}`,
          index: p.index,
          name: p.name,
          rating: p.rating ?? null,
        })),
      }));

    return Response.json({
      handle: info.handle,
      rating: info.rating ?? 0,
      maxRating: info.maxRating ?? 0,
      rank: info.rank ?? 'unrated',
      history: (rating as Round[]).map((r) => r.newRating),
      historyAt: (rating as Round[]).map((r) => r.ratingUpdateTimeSeconds * 1000),
      solved: [...solved],
      tags,
      days,
      contests,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && /not found/i.test(e.message)
            ? 'No Codeforces user has that handle.'
            : 'Codeforces is not answering right now. Try again in a minute.',
      },
      { status: 502 },
    );
  }
}
