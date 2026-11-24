// SEED DATA for the member area. Placeholder records; see site.ts.

export type Problem = { id: string; name: string; rating: number; topic: string; must?: boolean };
const p = (id: string, name: string, rating: number, topic: string, must = true): Problem => ({
  id,
  name,
  rating,
  topic,
  must,
});
// Real Codeforces problem ids, so links open and solve detection can match them.
export const sheet: Problem[] = [
  p('4A', 'Watermelon', 800, 'Implementation'),
  p('71A', 'Way Too Long Words', 800, 'Implementation'),
  p('231A', 'Team', 800, 'Implementation'),
  p('263A', 'Beautiful Matrix', 800, 'Implementation'),
  p('282A', 'Bit++', 800, 'Implementation', false),
  p('112A', 'Petya and Strings', 800, 'Strings'),
  p('339A', 'Helpful Maths', 800, 'Strings'),
  p('266A', 'Stones on the Table', 800, 'Strings'),
  p('118A', 'String Task', 1000, 'Strings', false),
  p('158A', 'Next Round', 800, 'Greedy'),
  p('50A', 'Domino piling', 800, 'Greedy'),
  p('160A', 'Twins', 900, 'Greedy'),
  p('1352C', 'K-th Not Divisible by n', 1200, 'Greedy'),
  p('1A', 'Theatre Square', 1000, 'Math'),
  p('26A', 'Almost Prime', 900, 'Math'),
  p('230B', 'T-primes', 1300, 'Math'),
  p('1512B', 'Almost Rectangle', 800, 'Math', false),
  p('580C', 'Kefa and Park', 1500, 'Graphs'),
  p('520B', 'Two Buttons', 1400, 'Graphs'),
  p('277A', 'Learning Languages', 1400, 'Graphs'),
  p('20C', 'Dijkstra?', 1900, 'Graphs', false),
  p('189A', 'Cut Ribbon', 1300, 'DP'),
  p('455A', 'Boredom', 1500, 'DP'),
  p('698A', 'Vacations', 1400, 'DP'),
  p('1195C', 'Basketball Exercise', 1400, 'DP'),
];
export const cfUrl = (id: string) => {
  const m = id.match(/^(\d+)(\w+)$/)!;
  return `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`;
};
export const seedSolved = ['4A', '71A', '231A', '263A', '112A', '339A', '158A', '50A', '1A'];
export const potd = [
  { tier: 'Easy', id: '266A', name: 'Stones on the Table', rating: 800, xp: 20 },
  { tier: 'Medium', id: '230B', name: 'T-primes', rating: 1300, xp: 40 },
  { tier: 'Hard', id: '20C', name: 'Dijkstra?', rating: 1900, xp: 80 },
];
export const upsolve = [
  { id: '1352C', from: 'Weekly #41 · C', due: '2 days' },
  { id: '277A', from: 'Weekly #41 · D', due: '2 days' },
  { id: '1195C', from: 'Weekly #40 · E', due: 'overdue' },
];

/** The label alumni contributions carry in the payment records. */
export const CONTRIBUTION = 'Alumni contribution';
/** True while the member still has to act on an invoice: nothing submitted, or the last submission was rejected. */
export const owes = (pay: Record<string, { status: string }>, id: string) =>
  !pay[id] || pay[id].status === 'rejected';
export const APPROVAL_THRESHOLD = 5000; // above this the President must approve, not only the Treasurer

export const announcements = [
  {
    id: 'a1',
    from: 'sadia',
    scope: 'Everyone',
    title: 'General meeting, Friday 4 pm, Seminar Room',
    body: 'Agenda: contest day roles, budget vote, ICPC team pairings. Attendance is recorded.',
    body_md:
      'Hey @everyone! We are holding our monthly general meeting this Friday.\n\n**Agenda:**\n- Contest day volunteer roles & desk assignments\n- Autumn term budget & prize pool review\n- ICPC team pairings for Batch 25\n\n> Date: Friday, 20 November 2026\n> Time: 4:00 PM\n> Venue: Seminar Room, CSE Building\n\nAttendance is recorded. Please arrive five minutes early.',
    must: true,
    pinned: true,
    requires_ack: true,
    at: '2026-11-16T10:23:00Z',
    edited_at: null as string | null,
  },
  {
    id: 'a2',
    from: 'anika',
    scope: 'Everyone',
    title: 'Semester subscription is due on 16 November',
    body: 'Pay by bKash, Nagad, Rocket or cash at the desk. A late fine applies after the grace period.',
    body_md:
      'Reminder for @everyone: the Autumn 2026 semester subscription (**৳300**) is due on **16 November**.\n\nPay via `bKash`, `Nagad`, `Rocket`, or cash at the club desk and submit your transaction ID under **Club → Finance**.\n\n> Amount: ৳300\n> Deadline: 16 November 2026\n> Contact: @anika for waiver requests',
    must: false,
    pinned: false,
    requires_ack: false,
    at: '2026-11-14T08:00:00Z',
    edited_at: null as string | null,
  },
  {
    id: 'a3',
    from: 'nadia',
    scope: 'Batch 24',
    title: 'Green sheet target: 5 DP problems this week',
    body: 'Tracked automatically from your Codeforces submissions.',
    body_md:
      "Heads up @batch24 — this week's green sheet focus is **Dynamic Programming** (`189A`, `455A`, `698A`, `1195C` + one choice problem).\n\nLink your Codeforces handle in your profile so solves sync automatically. Ask in **Feed → Help** if you get stuck on a state transition.",
    must: false,
    pinned: false,
    requires_ack: false,
    at: '2026-11-13T14:30:00Z',
    edited_at: null as string | null,
  },
];
export const duels = [
  { a: 'farhan', b: 'nusrat', problem: '520B', state: 'live', elo: [1512, 1488] },
  { a: 'priya', b: 'shuvo', problem: '189A', state: 'priya won in 11:42', elo: [1534, 1471] },
];
export const bounties = [
  { id: '20C', name: 'Dijkstra?', prize: 300, left: '3 days' },
  { id: '1195C', name: 'Basketball Exercise', prize: 120, left: '6 days' },
];
export const modules = [
  'Finance',
  'Green sheets',
  'Contests',
  'Arena',
  'Learning',
  'Events',
  'Community',
  'Elections',
  'Alumni',
  'Fantasy league',
];
