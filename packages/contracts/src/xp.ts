export const XP = {
  solve: 12,
  resource: 15,
  lesson: 25,
  quiz: 40,
  attend: 20,
  checkin: 5,
  kudos: 2,
  register: 5,
  pay: 30,
  vote: 5,
  read: 3,
  post: 10,
  quest: 50,
  feedPost: 10,
  feedUpvote: 2,
  idea: 10,
  interestAccepted: 5,
  milestoneKudosReceived: 2,
} as const;

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
  done: string[];
  lessons: string[];
  quiz: Record<string, number>;
  present: string[];
  checkin: boolean;
  kudos: string[];
  reg: string[];
  pay: Record<string, { status: string }>;
  votes: Record<string, unknown>;
  read: string[];
  posts: number;
  spent: number;
  feedPosts?: number;
  feedUpvotes?: number;
  ideasCount?: number;
  acceptedInterests?: number;
  milestoneKudosReceived?: number;
};

const given = (s: Earn) => s.kudos.filter((k) => !k.startsWith('shop:')).length;

export function quests(s: Earn) {
  return [
    { id: 'q1', text: 'Solve one problem', done: s.solved.length > s.base.solved },
    {
      id: 'q2',
      text: 'Finish a lesson or resource',
      done: s.lessons.length + s.done.length > s.base.done,
    },
    { id: 'q3', text: 'Help or cheer someone', done: given(s) > 0 },
  ];
}

/**
 * Total XP earned on the platform, on top of the member's pre-platform base.
 * Only verified payments count. Spending never lowers this amount.
 */
export function earned(s: Earn): number {
  const q = quests(s).filter((x) => x.done).length;
  const pollVotes = Object.keys(s.votes).filter((k) => k !== 'election').length;

  return (
    Math.max(0, s.solved.length - s.base.solved) * XP.solve +
    Math.max(0, s.done.length - s.base.done) * XP.resource +
    s.lessons.length * XP.lesson +
    Object.values(s.quiz).filter((v) => v >= 2).length * XP.quiz +
    s.present.length * XP.attend +
    (s.checkin ? XP.checkin : 0) +
    Math.min(20, given(s)) * XP.kudos +
    s.reg.length * XP.register +
    Object.values(s.pay).filter((p) => p.status === 'verified').length * XP.pay +
    pollVotes * XP.vote +
    s.read.length * XP.read +
    s.posts * XP.post +
    (s.feedPosts ?? 0) * XP.feedPost +
    (s.feedUpvotes ?? 0) * XP.feedUpvote +
    (s.ideasCount ?? 0) * XP.idea +
    (s.acceptedInterests ?? 0) * XP.interestAccepted +
    (s.milestoneKudosReceived ?? 0) * XP.milestoneKudosReceived +
    (q === 3 ? XP.quest : 0)
  );
}

/**
 * Calculates level from lifetime earned XP.
 * Level is monotone non-decreasing (spending in shop never drops level).
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
