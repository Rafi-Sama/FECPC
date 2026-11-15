// Judge sync for one handle: profile, rating history and accepted problems from the Codeforces API.
// Cached for 10 minutes so no screen ever hammers the judge.
export async function GET(_: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  if (!/^[\w.-]{3,24}$/.test(handle)) return Response.json({ error: "That is not a valid Codeforces handle." }, { status: 400 });
  const get = async (m: string) => {
    const r = await fetch(`https://codeforces.com/api/${m}`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    if (j.status !== "OK") throw new Error(j.comment ?? "Codeforces error");
    return j.result;
  };
  try {
    const [[info], rating, subs] = await Promise.all([get(`user.info?handles=${handle}`), get(`user.rating?handle=${handle}`), get(`user.status?handle=${handle}&from=1&count=5000`)]);
    const solved = new Set<string>(), tags: Record<string, number> = {}, days: Record<string, number> = {};
    for (const s of subs) {
      const id = `${s.problem.contestId}${s.problem.index}`;
      if (s.verdict !== "OK" || solved.has(id)) continue;
      solved.add(id);
      for (const t of s.problem.tags ?? []) tags[t] = (tags[t] ?? 0) + 1;
      const d = new Date(s.creationTimeSeconds * 1000).toISOString().slice(0, 10);
      days[d] = (days[d] ?? 0) + 1;
    }
    return Response.json({ handle: info.handle, rating: info.rating ?? 0, maxRating: info.maxRating ?? 0, rank: info.rank ?? "unrated", history: rating.map((r: { newRating: number }) => r.newRating), solved: [...solved], tags, days });
  } catch (e) {
    return Response.json({ error: e instanceof Error && /not found/i.test(e.message) ? "No Codeforces user has that handle." : "Codeforces is not answering right now. Try again in a minute." }, { status: 502 });
  }
}
