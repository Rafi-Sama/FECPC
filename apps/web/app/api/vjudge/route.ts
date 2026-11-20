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
  source: 'live' | 'simulated';
};

// Seed contests for simulated/offline fallback
function getSimulatedContest(id: string): VjudgeContestData {
  const contestId = id.trim();
  const rankUrl = `https://vjudge.net/contest/${contestId}#rank`;
  const singleApiUrl = `https://vjudge.net/contest/rank/single/${contestId}`;

  // Default presets
  if (contestId === '594821') {
    // Previous Contest 1: ICPC Mock #2
    const probs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const standings: VjudgeStandingRow[] = [
      {
        rank: 1,
        userId: 't1',
        username: 'Heap_Overlords',
        nickname: 'Tanvir Ahmed, Nadia Rahman, Mehedi Hasan',
        solved: 9,
        penalty: 874,
        problems: {
          A: { solved: true, attempts: 0, time: 14, isFirst: true },
          B: { solved: true, attempts: 1, time: 38 },
          C: { solved: true, attempts: 0, time: 55, isFirst: true },
          D: { solved: true, attempts: 2, time: 112 },
          E: { solved: true, attempts: 0, time: 135 },
          F: { solved: true, attempts: 1, time: 178 },
          G: { solved: true, attempts: 3, time: 215 },
          H: { solved: true, attempts: 0, time: 240, isFirst: true },
          I: { solved: true, attempts: 1, time: 282 },
          J: { solved: false, attempts: 4 },
          K: { solved: false, attempts: 1 },
        },
      },
      {
        rank: 2,
        userId: 't2',
        username: 'Trie_Harders',
        nickname: 'Sadia Islam, Rahim Uddin, Farhan Kabir',
        solved: 8,
        penalty: 940,
        problems: {
          A: { solved: true, attempts: 0, time: 18 },
          B: { solved: true, attempts: 0, time: 42, isFirst: true },
          C: { solved: true, attempts: 1, time: 70 },
          D: { solved: true, attempts: 1, time: 125 },
          E: { solved: true, attempts: 0, time: 160, isFirst: true },
          F: { solved: true, attempts: 2, time: 210 },
          G: { solved: true, attempts: 0, time: 235, isFirst: true },
          H: { solved: true, attempts: 2, time: 275 },
          I: { solved: false, attempts: 3 },
          J: { solved: false, attempts: 0 },
          K: { solved: false, attempts: 0 },
        },
      },
      {
        rank: 3,
        userId: 't3',
        username: 'Graph_Traversers',
        nickname: 'Shuvo Das, Priya Saha, Anika Tabassum',
        solved: 7,
        penalty: 812,
        problems: {
          A: { solved: true, attempts: 0, time: 22 },
          B: { solved: true, attempts: 2, time: 64 },
          C: { solved: true, attempts: 0, time: 85 },
          D: { solved: true, attempts: 0, time: 140, isFirst: true },
          E: { solved: true, attempts: 1, time: 195 },
          F: { solved: true, attempts: 0, time: 230, isFirst: true },
          G: { solved: true, attempts: 1, time: 276 },
          H: { solved: false, attempts: 2 },
          I: { solved: false, attempts: 0 },
          J: { solved: false, attempts: 0 },
          K: { solved: false, attempts: 0 },
        },
      },
      {
        rank: 4,
        userId: 't4',
        username: 'Stack_Underflow',
        nickname: 'Tasnim Akter, Nusrat Jahan, Sabbir Hossain',
        solved: 6,
        penalty: 698,
        problems: {
          A: { solved: true, attempts: 1, time: 30 },
          B: { solved: true, attempts: 0, time: 58 },
          C: { solved: true, attempts: 2, time: 104 },
          D: { solved: true, attempts: 0, time: 162 },
          E: { solved: true, attempts: 1, time: 220 },
          F: { solved: true, attempts: 0, time: 264 },
          G: { solved: false, attempts: 3 },
          H: { solved: false, attempts: 1 },
          I: { solved: false, attempts: 0 },
          J: { solved: false, attempts: 0 },
          K: { solved: false, attempts: 0 },
        },
      },
      {
        rank: 5,
        userId: 't5',
        username: 'Zero_Indexed',
        nickname: 'Imran Chowdhury, Jannatul Ferdous, Zahid Hasan',
        solved: 5,
        penalty: 580,
        problems: {
          A: { solved: true, attempts: 0, time: 28 },
          B: { solved: true, attempts: 1, time: 75 },
          C: { solved: true, attempts: 0, time: 118 },
          D: { solved: true, attempts: 3, time: 195 },
          E: { solved: true, attempts: 0, time: 264 },
          F: { solved: false, attempts: 2 },
          G: { solved: false, attempts: 0 },
          H: { solved: false, attempts: 0 },
          I: { solved: false, attempts: 0 },
          J: { solved: false, attempts: 0 },
          K: { solved: false, attempts: 0 },
        },
      },
    ];

    const stats: Record<string, VjudgeProblemStat> = {};
    for (const p of probs) {
      let solvedCount = 0;
      let totalAttempts = 0;
      let firstSolver: { name: string; time: number } | undefined;
      for (const row of standings) {
        const cell = row.problems[p];
        if (cell) {
          totalAttempts += cell.attempts + (cell.solved ? 1 : 0);
          if (cell.solved) {
            solvedCount++;
            if (!firstSolver || (cell.time && cell.time < firstSolver.time)) {
              firstSolver = { name: row.username, time: cell.time! };
            }
          }
        }
      }
      stats[p] = { letter: p, solvedCount, totalAttempts, firstSolver };
    }

    return {
      id: contestId,
      title: 'FECPC ICPC Mock #2 (Dhaka Regional Replay)',
      begin: Date.now() - 30 * 86400000,
      length: 5 * 3600 * 1000,
      isRunning: false,
      isEnded: true,
      elapsedSeconds: 5 * 3600,
      remainingSeconds: 0,
      problems: probs,
      standings,
      problemStats: stats,
      rankUrl,
      singleApiUrl,
      source: 'simulated',
    };
  } else if (contestId === '582109') {
    // Previous Contest 2: Weekly Club Contest #41 Replay
    const probs = ['A', 'B', 'C', 'D', 'E'];
    const standings: VjudgeStandingRow[] = [
      {
        rank: 1,
        userId: 'u1',
        username: 'nadia_r',
        nickname: 'Nadia Rahman',
        solved: 5,
        penalty: 342,
        problems: {
          A: { solved: true, attempts: 0, time: 12, isFirst: true },
          B: { solved: true, attempts: 0, time: 28, isFirst: true },
          C: { solved: true, attempts: 1, time: 54 },
          D: { solved: true, attempts: 0, time: 76, isFirst: true },
          E: { solved: true, attempts: 2, time: 112 },
        },
      },
      {
        rank: 2,
        userId: 'u2',
        username: 'tnv.exe',
        nickname: 'Tanvir Ahmed',
        solved: 5,
        penalty: 410,
        problems: {
          A: { solved: true, attempts: 0, time: 15 },
          B: { solved: true, attempts: 1, time: 35 },
          C: { solved: true, attempts: 0, time: 48, isFirst: true },
          D: { solved: true, attempts: 1, time: 88 },
          E: { solved: true, attempts: 1, time: 104, isFirst: true },
        },
      },
      {
        rank: 3,
        userId: 'u3',
        username: 'sadia_codes',
        nickname: 'Sadia Islam',
        solved: 4,
        penalty: 295,
        problems: {
          A: { solved: true, attempts: 0, time: 18 },
          B: { solved: true, attempts: 0, time: 40 },
          C: { solved: true, attempts: 1, time: 65 },
          D: { solved: true, attempts: 0, time: 92 },
          E: { solved: false, attempts: 2 },
        },
      },
      {
        rank: 4,
        userId: 'u4',
        username: 'rahim_u',
        nickname: 'Rahim Uddin',
        solved: 4,
        penalty: 330,
        problems: {
          A: { solved: true, attempts: 1, time: 24 },
          B: { solved: true, attempts: 0, time: 45 },
          C: { solved: true, attempts: 0, time: 72 },
          D: { solved: true, attempts: 2, time: 109 },
          E: { solved: false, attempts: 1 },
        },
      },
      {
        rank: 5,
        userId: 'u5',
        username: 'tasnim_a',
        nickname: 'Tasnim Akter',
        solved: 3,
        penalty: 215,
        problems: {
          A: { solved: true, attempts: 0, time: 20 },
          B: { solved: true, attempts: 1, time: 55 },
          C: { solved: true, attempts: 0, time: 80 },
          D: { solved: false, attempts: 3 },
          E: { solved: false, attempts: 0 },
        },
      },
    ];

    const stats: Record<string, VjudgeProblemStat> = {};
    for (const p of probs) {
      let solvedCount = 0;
      let totalAttempts = 0;
      let firstSolver: { name: string; time: number } | undefined;
      for (const row of standings) {
        const cell = row.problems[p];
        if (cell) {
          totalAttempts += cell.attempts + (cell.solved ? 1 : 0);
          if (cell.solved) {
            solvedCount++;
            if (!firstSolver || (cell.time && cell.time < firstSolver.time)) {
              firstSolver = { name: row.username, time: cell.time! };
            }
          }
        }
      }
      stats[p] = { letter: p, solvedCount, totalAttempts, firstSolver };
    }

    return {
      id: contestId,
      title: 'Weekly Club Contest #41 (VJudge Replay)',
      begin: Date.now() - 14 * 86400000,
      length: 2 * 3600 * 1000,
      isRunning: false,
      isEnded: true,
      elapsedSeconds: 2 * 3600,
      remainingSeconds: 0,
      problems: probs,
      standings,
      problemStats: stats,
      rankUrl,
      singleApiUrl,
      source: 'simulated',
    };
  }

  // Default: Running Club Contest (e.g. 612840 or active ID)
  const probs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const standings: VjudgeStandingRow[] = [
    {
      rank: 1,
      userId: '101',
      username: 'FECPC_Sigma',
      nickname: 'Nadia Rahman, Tanvir Ahmed, Mehedi Hasan',
      solved: 6,
      penalty: 512,
      problems: {
        A: { solved: true, attempts: 0, time: 11, isFirst: true },
        B: { solved: true, attempts: 1, time: 34, isFirst: true },
        C: { solved: true, attempts: 0, time: 58 },
        D: { solved: true, attempts: 2, time: 115, isFirst: true },
        E: { solved: true, attempts: 0, time: 142 },
        F: { solved: true, attempts: 1, time: 192 },
        G: { solved: false, attempts: 3, pending: true },
        H: { solved: false, attempts: 1 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
    {
      rank: 2,
      userId: '102',
      username: 'Bit_Shift_Heroes',
      nickname: 'Sadia Islam, Rahim Uddin, Anika Tabassum',
      solved: 5,
      penalty: 430,
      problems: {
        A: { solved: true, attempts: 0, time: 16 },
        B: { solved: true, attempts: 0, time: 41 },
        C: { solved: true, attempts: 1, time: 64, isFirst: true },
        D: { solved: true, attempts: 0, time: 128 },
        E: { solved: true, attempts: 2, time: 161, isFirst: true },
        F: { solved: false, attempts: 2 },
        G: { solved: false, attempts: 1 },
        H: { solved: false, attempts: 0 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
    {
      rank: 3,
      userId: '103',
      username: 'Runtime_Terrors',
      nickname: 'Farhan Kabir, Shuvo Das, Priya Saha',
      solved: 5,
      penalty: 495,
      problems: {
        A: { solved: true, attempts: 1, time: 25 },
        B: { solved: true, attempts: 1, time: 49 },
        C: { solved: true, attempts: 0, time: 78 },
        D: { solved: true, attempts: 1, time: 140 },
        E: { solved: true, attempts: 0, time: 183 },
        F: { solved: false, attempts: 3 },
        G: { solved: false, attempts: 0 },
        H: { solved: false, attempts: 0 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
    {
      rank: 4,
      userId: '104',
      username: 'Recursion_Breakers',
      nickname: 'Tasnim Akter, Nusrat Jahan, Imran Chowdhury',
      solved: 4,
      penalty: 360,
      problems: {
        A: { solved: true, attempts: 0, time: 21 },
        B: { solved: true, attempts: 2, time: 65 },
        C: { solved: true, attempts: 0, time: 92 },
        D: { solved: true, attempts: 1, time: 162 },
        E: { solved: false, attempts: 2 },
        F: { solved: false, attempts: 1 },
        G: { solved: false, attempts: 0 },
        H: { solved: false, attempts: 0 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
    {
      rank: 5,
      userId: '105',
      username: 'Segment_Tree_Squad',
      nickname: 'Sabbir Hossain, Jannat Ferdous, Zahid Hasan',
      solved: 3,
      penalty: 258,
      problems: {
        A: { solved: true, attempts: 0, time: 29 },
        B: { solved: true, attempts: 0, time: 72 },
        C: { solved: true, attempts: 2, time: 117 },
        D: { solved: false, attempts: 2 },
        E: { solved: false, attempts: 1 },
        F: { solved: false, attempts: 0 },
        G: { solved: false, attempts: 0 },
        H: { solved: false, attempts: 0 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
    {
      rank: 6,
      userId: '106',
      username: 'Bug_Hunters_CSE',
      nickname: 'Mim Sultana, Al-Amin, Rafiqul Islam',
      solved: 2,
      penalty: 165,
      problems: {
        A: { solved: true, attempts: 1, time: 35 },
        B: { solved: true, attempts: 1, time: 90 },
        C: { solved: false, attempts: 2 },
        D: { solved: false, attempts: 0 },
        E: { solved: false, attempts: 0 },
        F: { solved: false, attempts: 0 },
        G: { solved: false, attempts: 0 },
        H: { solved: false, attempts: 0 },
        I: { solved: false, attempts: 0 },
        J: { solved: false, attempts: 0 },
      },
    },
  ];

  const stats: Record<string, VjudgeProblemStat> = {};
  for (const p of probs) {
    let solvedCount = 0;
    let totalAttempts = 0;
    let firstSolver: { name: string; time: number } | undefined;
    for (const row of standings) {
      const cell = row.problems[p];
      if (cell) {
        totalAttempts += cell.attempts + (cell.solved ? 1 : 0);
        if (cell.solved) {
          solvedCount++;
          if (!firstSolver || (cell.time && cell.time < firstSolver.time)) {
            firstSolver = { name: row.username, time: cell.time! };
          }
        }
      }
    }
    stats[p] = { letter: p, solvedCount, totalAttempts, firstSolver };
  }

  const durationMs = 5 * 3600 * 1000;
  const elapsed = 3 * 3600 + 24 * 60; // 3h 24m elapsed
  return {
    id: contestId,
    title: `FECPC Contest Day #${contestId} · Intra-College Live Contest`,
    begin: Date.now() - elapsed * 1000,
    length: durationMs,
    isRunning: true,
    isEnded: false,
    elapsedSeconds: elapsed,
    remainingSeconds: 5 * 3600 - elapsed,
    problems: probs,
    standings,
    problemStats: stats,
    rankUrl,
    singleApiUrl,
    source: 'simulated',
  };
}

// Parse live VJudge JSON
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
    source: 'live',
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  let id = url.searchParams.get('id') || url.searchParams.get('contestId') || '612840';

  // Accept a bare contest ID or a full VJudge URL (e.g. https://vjudge.net/contest/123456#rank).
  id = id.match(/contest\/(?:rank\/single\/)?(\d+)/i)?.[1] ?? id.trim();
  if (!/^\d{1,9}$/.test(id))
    return NextResponse.json({ error: 'That is not a VJudge contest ID.' }, { status: 400 });

  const vjudgeEndpoint = `https://vjudge.net/contest/rank/single/${id}`;

  try {
    const res = await fetch(vjudgeEndpoint, {
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

    if (!res.ok) {
      // Fallback to simulated data if VJudge returns 403/404/500
      const fallback = getSimulatedContest(id);
      return NextResponse.json(fallback);
    }

    const json = await res.json();
    if (!json || typeof json !== 'object') {
      const fallback = getSimulatedContest(id);
      return NextResponse.json(fallback);
    }

    const parsed = parseVjudgeJson(id, json);
    return NextResponse.json(parsed);
  } catch {
    // Return high fidelity simulated contest if judge is unreachable (offline or sandbox)
    const fallback = getSimulatedContest(id);
    return NextResponse.json(fallback);
  }
}
