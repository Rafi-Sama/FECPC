import { site } from "./site";

export type CfContest = { id: number; name: string; start: number; durationH: number };

// Upcoming Codeforces rounds, cached for an hour so no page load ever waits on the judge.
// Returns [] when the judge is unreachable; callers show an explicit fallback line.
export async function upcomingContests(limit = 6): Promise<CfContest[]> {
  try {
    const res = await fetch("https://codeforces.com/api/contest.list?gym=false", { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json.status !== "OK") return [];
    return (json.result as { id: number; name: string; phase: string; startTimeSeconds?: number; durationSeconds: number }[])
      .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds)
      .sort((a, b) => a.startTimeSeconds! - b.startTimeSeconds!)
      .slice(0, limit)
      .map((c) => ({ id: c.id, name: c.name, start: c.startTimeSeconds! * 1000, durationH: c.durationSeconds / 3600 }));
  } catch {
    return [];
  }
}

export const localTime = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: site.tz, weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);
