import { NextResponse } from 'next/server';

export type VjudgeProblemCell = {
  solved: boolean;
  attempts: number;
  time?: number;
  isFirst?: boolean;
  pending?: boolean;
};

export type VjudgeStandingRow = {
  rank: number;
  userId: string | number;
  username: string;
  nickname: string;
  solved: number;
  penalty: number;
  problems: Record<string, VjudgeProblemCell>;
};

export type VjudgeProblemStat = {
  letter: string;
  solvedCount: number;
  totalAttempts: number;
  firstSolver?: {
    name: string;
    time: number;
  };
};

export type VjudgeContestData = {
  id: string | number;
  title: string;
  begin: number;
  length: number;
  isRunning: boolean;
  isEnded: boolean;
  elapsedSeconds: number;
  remainingSeconds: number;
  problems: string[];
  standings: VjudgeStandingRow[];
  problemStats: Record<string, VjudgeProblemStat>;
  rankUrl: string;
  singleApiUrl: string;
};

function parseVjudgeJson(contestId: string, raw: any): VjudgeContestData {
  const title = raw.title || `VJudge Contest #${contestId}`;
  const begin = Number(raw.begin) || Date.now() - 3600000;
  const length = Number(raw.length) || 5 * 3600 * 1000;
  const now = Date.now();
  const isRunning = now >= begin && now < begin + length;
  const isEnded = now >= begin + length;
  const elapsedSeconds = Math.max(
    0,
    Math.min(Math.floor((now - begin) / 1000), Math.floor(length / 1000)),
  );
  const remainingSeconds = Math.max(0, Math.floor((begin + length - now) / 1000));

  // Determine problem set
  const rawSubs: [number | string, number, number, number][] = raw.submissions || [];
  let maxProbIndex = 0;
  if (Array.isArray(rawSubs)) {
    for (const sub of rawSubs) {
      if (typeof sub[1] === 'number' && sub[1] > maxProbIndex) {
        maxProbIndex = sub[1];
      }
    }
  }
  const problemCount = Math.max(raw.problems?.length || 0, maxProbIndex + 1, 5);
  const problems = Array.from({ length: problemCount }, (_, i) => String.fromCharCode(65 + i));

  // Participant map
  const rawParticipants = raw.participants || {};
  const participantsMap: Record<string, { username: string; nickname: string }> = {};

  if (typeof rawParticipants === 'object' && rawParticipants !== null) {
    for (const [key, val] of Object.entries(rawParticipants)) {
      if (Array.isArray(val)) {
        participantsMap[key] = {
          username: String(val[0] || key),
          nickname: String(val[1] || val[0] || key),
        };
      } else if (typeof val === 'object' && val !== null) {
        const v = val as any;
        participantsMap[key] = {
          username: v.username || v.name || key,
          nickname: v.nickname || v.name || key,
        };
      } else {
        participantsMap[key] = {
          username: String(val),
          nickname: String(val),
        };
      }
    }
  }

  // Calculate per participant submissions
  type ParticipantCalc = {
    userId: string;
    username: string;
    nickname: string;
    problems: Record<
      string,
      { solved: boolean; attempts: number; time?: number; isFirst?: boolean }
    >;
    solved: number;
    penalty: number;
    lastAcTime: number;
  };

  const userCalcs: Record<string, ParticipantCalc> = {};

  // Initialize all known participants
  for (const [uid, meta] of Object.entries(participantsMap)) {
    userCalcs[uid] = {
      userId: uid,
      username: meta.username,
      nickname: meta.nickname,
      problems: {},
      solved: 0,
      penalty: 0,
      lastAcTime: 0,
    };
  }

  // Sort submissions chronologically: [userId, probIdx, status (1=AC, 0=WA), timeSec]
  const sortedSubs = [...rawSubs].sort((a, b) => (a[3] || 0) - (b[3] || 0));

  for (const [userId, probIdx, status, timeSec] of sortedSubs) {
    const uid = String(userId);
    if (!userCalcs[uid]) {
      userCalcs[uid] = {
        userId: uid,
        username: participantsMap[uid]?.username || `user_${uid}`,
        nickname: participantsMap[uid]?.nickname || `User ${uid}`,
        problems: {},
        solved: 0,
        penalty: 0,
        lastAcTime: 0,
      };
    }

    const letter = String.fromCharCode(65 + probIdx);
    if (!userCalcs[uid].problems[letter]) {
      userCalcs[uid].problems[letter] = { solved: false, attempts: 0 };
    }

    const prob = userCalcs[uid].problems[letter];
    // If already solved, ignore subsequent submissions for this problem
    if (prob.solved) continue;

    if (status === 1) {
      // AC!
      prob.solved = true;
      prob.time = Math.floor(timeSec / 60);
      userCalcs[uid].solved += 1;
      userCalcs[uid].penalty += prob.time + prob.attempts * 20;
      userCalcs[uid].lastAcTime = Math.max(userCalcs[uid].lastAcTime, prob.time);
    } else {
      // WA or other verdict
      prob.attempts += 1;
    }
  }

  // Sort standings: solved descending, penalty ascending, lastAcTime ascending
  const standingsList = Object.values(userCalcs).sort((a, b) => {
    if (b.solved !== a.solved) return b.solved - a.solved;
    if (a.penalty !== b.penalty) return a.penalty - b.penalty;
    return a.lastAcTime - b.lastAcTime;
  });

  // Calculate ranks
  const standings: VjudgeStandingRow[] = standingsList.map((row, idx) => ({
    rank: idx + 1,
    userId: row.userId,
    username: row.username,
    nickname: row.nickname,
    solved: row.solved,
    penalty: row.penalty,
    problems: row.problems,
  }));

  // Identify first solvers and problem stats
  const stats: Record<string, VjudgeProblemStat> = {};
  for (const letter of problems) {
    let solvedCount = 0;
    let totalAttempts = 0;
    let firstSolver: { name: string; time: number } | undefined;

    for (const row of standings) {
      const cell = row.problems[letter];
      if (cell) {
        totalAttempts += cell.attempts + (cell.solved ? 1 : 0);
        if (cell.solved && cell.time !== undefined) {
          solvedCount++;
          if (!firstSolver || cell.time < firstSolver.time) {
            firstSolver = { name: row.username, time: cell.time };
          }
        }
      }
    }

    // Mark isFirst in standing cell
    if (firstSolver) {
      for (const row of standings) {
        const cell = row.problems[letter];
        if (
          cell &&
          cell.solved &&
          cell.time === firstSolver.time &&
          row.username === firstSolver.name
        ) {
          cell.isFirst = true;
        }
      }
    }

    stats[letter] = { letter, solvedCount, totalAttempts, firstSolver };
  }

  return {
    id: contestId,
    title,
    begin,
    length,
    isRunning,
    isEnded,
    elapsedSeconds,
    remainingSeconds,
    problems,
    standings,
    problemStats: stats,
    rankUrl: `https://vjudge.net/contest/${contestId}#rank`,
    singleApiUrl: `https://vjudge.net/contest/rank/single/${contestId}`,
  };
}

const unavailable = () =>
  NextResponse.json({ error: 'VJudge did not answer. Try Refresh in a minute.' }, { status: 502 });

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Accept a bare contest ID or a full VJudge URL (e.g. https://vjudge.net/contest/123456#rank).
  const raw = url.searchParams.get('id') ?? '';
  const id = raw.match(/contest\/(?:rank\/single\/)?(\d+)/i)?.[1] ?? raw.trim();
  if (!/^\d{1,9}$/.test(id))
    return NextResponse.json({ error: 'That is not a VJudge contest ID.' }, { status: 400 });

  try {
    const res = await fetch(`https://vjudge.net/contest/rank/single/${id}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://vjudge.net/contest/${id}`,
      },
      signal: AbortSignal.timeout(6000),
      // Every viewer of a contest shares one upstream request per 30 s, so VJudge is never hammered.
      next: { revalidate: 30 },
    });
    if (!res.ok) return unavailable();
    const json = await res.json();
    if (!json || typeof json !== 'object') return unavailable();
    return NextResponse.json(parseVjudgeJson(id, json));
  } catch {
    return unavailable();
  }
}
