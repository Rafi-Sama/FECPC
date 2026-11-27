/**
 * Every way to earn XP, with its default points. The Super Admin can change any amount (club setting `kv:xp`);
 * totals are always worked out from the records with the current amounts, so a change applies to everyone at once.
 */
export const XP_RULES = [
  {
    key: 'solve',
    label: 'Sheet problem solved (Codeforces confirmed)',
    group: 'Training',
    def: 12,
  },
  { key: 'cfSolved', label: 'Codeforces problem solved', group: 'Training', def: 12 },
  { key: 'vjSolved', label: 'VJudge problem solved', group: 'Training', def: 12 },
  { key: 'streakDay', label: 'Day of current Codeforces streak', group: 'Training', def: 30 },
  { key: 'resource', label: 'Wiki page completed', group: 'Training', def: 15 },
  { key: 'quest', label: 'All three starter quests', group: 'Training', def: 50 },
  { key: 'checkin', label: 'Daily check-in', group: 'Habits', def: 5 },
  { key: 'read', label: 'Notification or announcement read', group: 'Habits', def: 3 },
  { key: 'attend', label: 'Event or volunteer shift attended', group: 'Club', def: 20 },
  { key: 'register', label: 'Event registration approved', group: 'Club', def: 5 },
  { key: 'pay', label: 'Payment verified', group: 'Club', def: 30 },
  { key: 'vote', label: 'Poll vote', group: 'Club', def: 5 },
  { key: 'post', label: 'Announcement posted', group: 'Community', def: 10 },
  { key: 'feedPost', label: 'Feed post', group: 'Community', def: 10 },
  { key: 'feedUpvote', label: 'Upvote received on a feed post', group: 'Community', def: 2 },
  { key: 'idea', label: 'Idea posted', group: 'Community', def: 10 },
  {
    key: 'interestAccepted',
    label: 'Your interest in an idea accepted',
    group: 'Community',
    def: 5,
  },
  { key: 'kudos', label: 'Kudos given', group: 'Kudos', def: 2 },
  { key: 'kudosReceived', label: 'Kudos received', group: 'Kudos', def: 2 },
  { key: 'helper', label: 'Helper point', group: 'Kudos', def: 8 },
] as const;
export type XpKey = (typeof XP_RULES)[number]['key'];

/** Limits that stop farming. Also set by the Super Admin. */
export const XP_LIMITS = [
  { key: 'kudosGivenCap', label: 'Kudos given that earn XP (lifetime)', def: 20 },
  { key: 'feedUpvoteDailyCap', label: 'Feed upvotes that earn XP per day', def: 20 },
] as const;
export type XpLimitKey = (typeof XP_LIMITS)[number]['key'];
export type XpRates = Record<XpKey | XpLimitKey, number>;

export const XP_DEFAULTS = Object.fromEntries(
  [...XP_RULES, ...XP_LIMITS].map((r) => [r.key, r.def]),
) as XpRates;
/** The defaults, for code that predates editable rates. */
export const XP = XP_DEFAULTS;
/** Club setting key (`kv:<key>`) holding the rates as JSON. */
export const XP_KEY = 'xp';
export const XP_MAX = 1000;

/** Checks rates from an officer; returns the full set or what is wrong. Missing keys keep their defaults. */
export function cleanXpRates(v: unknown): XpRates | string {
  if (!v || typeof v !== 'object') return 'Send the XP amounts.';
  const out = { ...XP_DEFAULTS };
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!(k in out)) return `Unknown XP rule: ${k}.`;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > XP_MAX)
      return `${[...XP_RULES, ...XP_LIMITS].find((r) => r.key === k)!.label}: a whole number from 0 to ${XP_MAX}.`;
    out[k as keyof XpRates] = n;
  }
  return out;
}

/** The club's XP amounts from the settings, or the defaults. */
export function xpRates(kv: Record<string, unknown>): XpRates {
  try {
    const raw = kv[XP_KEY];
    const r = cleanXpRates(typeof raw === 'string' ? JSON.parse(raw) : raw);
    return typeof r === 'string' ? XP_DEFAULTS : r;
  } catch {
    return XP_DEFAULTS;
  }
}

export const LEVEL = 1500;

export const titles = [
  'Rookie',
  'Solver',
  'Grinder',
  'Tactician',
  'Adept',
  'Strategist',
  'Veteran',
  'Elite',
  'Legend',
] as const;

export type Title = (typeof titles)[number];

export type Earn = {
  base: { solved: number; done: number };
  solved: string[];
  /** The ticked problems Codeforces confirmed (server-side sync). Only these earn solve XP. */
  verified: string[];
  done: string[];
  present: string[];
  checkin: boolean;
  /** Days checked in, ever. */
  checkins?: number;
  /** Targets this member cheered through reactions (profiles, ideas). */
  kudos: string[];
  /** Every kudos this member gave: reactions plus milestone kudos. */
  kudosGiven?: number;
  reg: string[];
  pay: Record<string, { status: string }>;
  votes: Record<string, unknown>;
  read: string[];
  posts: number;
  feedPosts?: number;
  feedUpvotes?: number;
  ideasCount?: number;
  acceptedInterests?: number;
  /** Kudos received anywhere: profile, ideas, milestones. */
  kudosReceived?: number;
};

const given = (s: Earn) => s.kudosGiven ?? s.kudos.length;
/** Ticks made on the platform (after the pre-platform base) that Codeforces confirmed. A tick alone earns nothing. */
export const verifiedNew = (s: Earn) =>
  s.solved.slice(s.base.solved).filter((id) => s.verified.includes(id)).length;

export function quests(s: Earn) {
  return [
    { id: 'q1', text: 'Solve one problem', done: verifiedNew(s) > 0 },
    { id: 'q2', text: 'Read a wiki page', done: s.done.length > s.base.done },
    { id: 'q3', text: 'Help or cheer someone', done: given(s) > 0 },
  ];
}

/** How many of each thing the member has done that earns platform XP (judge stats are separate). */
export function earnCounts(s: Earn, rates: XpRates = XP_DEFAULTS): Partial<Record<XpKey, number>> {
  return {
    solve: verifiedNew(s),
    resource: Math.max(0, s.done.length - s.base.done),
    attend: s.present.length,
    checkin: s.checkins ?? (s.checkin ? 1 : 0),
    kudos: Math.min(rates.kudosGivenCap, given(s)),
    register: s.reg.length,
    pay: Object.values(s.pay).filter((p) => p.status === 'verified').length,
    vote: Object.keys(s.votes).filter((k) => k !== 'election').length,
    read: s.read.length,
    post: s.posts,
    feedPost: s.feedPosts ?? 0,
    feedUpvote: s.feedUpvotes ?? 0,
    idea: s.ideasCount ?? 0,
    interestAccepted: s.acceptedInterests ?? 0,
    kudosReceived: s.kudosReceived ?? 0,
    quest: quests(s).every((x) => x.done) ? 1 : 0,
  };
}

/** Total XP earned on the platform, on top of the member's judge XP. Only verified payments count. */
export function earned(s: Earn, rates: XpRates = XP_DEFAULTS): number {
  return Object.entries(earnCounts(s, rates)).reduce(
    (a, [k, n]) => a + (n ?? 0) * rates[k as XpKey],
    0,
  );
}

/** Judge XP: from Codeforces and VJudge stats and helper points, the part every leaderboard shows. */
export const judgeCounts = (u: {
  solved: number;
  vjSolved: number;
  streak: number;
  helper: number;
}): Partial<Record<XpKey, number>> => ({
  cfSolved: u.solved,
  vjSolved: u.vjSolved,
  streakDay: u.streak,
  helper: u.helper,
});

/**
 * Calculates level from lifetime earned XP.
 * Level grows with lifetime XP.
 */
export function level(total: number): { lv: number; into: number; title: string } {
  const lv = Math.floor(Math.max(0, total) / LEVEL) + 1;
  const clampedIndex = Math.min(titles.length - 1, lv - 1);
  return {
    lv,
    into: Math.max(0, total) % LEVEL,
    title: titles[clampedIndex] ?? 'Rookie',
  };
}

/** One line of a member's XP history. `note`: 'start' for XP from before history began, 'rate' for a rate change. */
export type XpHistoryItem = {
  id: number;
  kind: XpKey;
  delta: number;
  count: number;
  note: 'start' | 'rate' | null;
  at: string;
};
