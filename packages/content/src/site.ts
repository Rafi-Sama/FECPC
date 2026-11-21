// SEED DATA. Every person, number and date below is a placeholder so the
// interface has something to render. Replace with the real database before launch.
import type { Member } from '@fecpc/contracts';

export type { Member };

const m = (
  id: string,
  name: string,
  handle: string,
  batch: number,
  dept: string,
  rating: number,
  peak: number,
  solved: number,
  streak: number,
  squad: Member['squad'],
  skills: string[],
  helper: number,
  role?: string,
): Member => ({
  id,
  name,
  handle,
  batch,
  dept,
  rating,
  peak,
  solved,
  streak,
  squad,
  skills,
  helper,
  role,
  xp: solved * 12 + streak * 30 + helper * 8,
});

export const members: Member[] = [
  m(
    'nadia',
    'Nadia Rahman',
    'nadia_r',
    21,
    'CSE',
    1934,
    1967,
    1482,
    61,
    'Graph',
    ['CP', 'Graphs', 'DP'],
    212,
    'CP Head',
  ),
  m(
    'tanvir',
    'Tanvir Ahmed',
    'tnv.exe',
    20,
    'CSE',
    1871,
    1905,
    1620,
    12,
    'Heap',
    ['CP', 'Math'],
    148,
    'President',
  ),
  m(
    'sadia',
    'Sadia Islam',
    'sadia_codes',
    21,
    'CSE',
    1742,
    1742,
    1105,
    94,
    'Trie',
    ['CP', 'Web'],
    301,
    'General Secretary',
  ),
  m(
    'mehedi',
    'Mehedi Hasan',
    'mh_segtree',
    21,
    'EEE',
    1688,
    1720,
    1240,
    33,
    'Stack',
    ['CP', 'Data structures'],
    87,
    'Mentor',
  ),
  m(
    'rahim',
    'Rahim Uddin',
    'rahim_u',
    22,
    'CSE',
    1596,
    1611,
    902,
    47,
    'Graph',
    ['CP', 'Strings'],
    64,
    'Mentor',
  ),
  m(
    'anika',
    'Anika Tabassum',
    'anika.t',
    22,
    'CSE',
    1523,
    1560,
    811,
    120,
    'Heap',
    ['CP', 'AI/ML'],
    190,
    'Treasurer',
  ),
  m(
    'farhan',
    'Farhan Kabir',
    'fk_binary',
    22,
    'CSE',
    1467,
    1502,
    745,
    9,
    'Trie',
    ['CP', 'Security'],
    41,
  ),
  m(
    'nusrat',
    'Nusrat Jahan',
    'nusrat_j',
    23,
    'CSE',
    1398,
    1398,
    630,
    28,
    'Stack',
    ['CP', 'Web'],
    96,
    'Event Secretary',
  ),
  m(
    'shuvo',
    'Shuvo Das',
    'shuvo_dp',
    23,
    'EEE',
    1342,
    1377,
    588,
    19,
    'Graph',
    ['CP', 'Game dev'],
    22,
  ),
  m('priya', 'Priya Saha', 'priya.s', 23, 'CSE', 1276, 1290, 512, 54, 'Heap', ['CP', 'AI/ML'], 73),
  m(
    'imran',
    'Imran Chowdhury',
    'imran_ch',
    23,
    'CE',
    1203,
    1245,
    430,
    7,
    'Trie',
    ['Web', 'CP'],
    15,
  ),
  m('tasnim', 'Tasnim Akter', 'tasnim_a', 24, 'CSE', 1154, 1154, 356, 41, 'Stack', ['CP'], 58),
  m(
    'sabbir',
    'Sabbir Hossain',
    'sabbir_h',
    24,
    'CSE',
    1088,
    1120,
    298,
    16,
    'Graph',
    ['CP', 'Security'],
    9,
  ),
  m(
    'jannat',
    'Jannatul Ferdous',
    'jannat.f',
    24,
    'EEE',
    1012,
    1012,
    241,
    30,
    'Heap',
    ['CP', 'Web'],
    34,
  ),
  m('zahid', 'Zahid Hasan', 'zahid_z', 25, 'CSE', 934, 934, 164, 22, 'Trie', ['CP'], 11),
  m('mim', 'Mim Sultana', 'mim_s', 25, 'CSE', 871, 871, 121, 18, 'Stack', ['CP', 'Game dev'], 27),
];
export const byId = (id: string) => members.find((x) => x.id === id)!;

export const cfTitle = (r: number) =>
  r >= 2100
    ? 'Master'
    : r >= 1900
      ? 'Candidate Master'
      : r >= 1600
        ? 'Expert'
        : r >= 1400
          ? 'Specialist'
          : r >= 1200
            ? 'Pupil'
            : 'Newbie';
export const squads = [
  { name: 'Heap', color: '#FFD23F', pts: 4820, motto: 'Always on top' },
  { name: 'Graph', color: '#3DE1FF', pts: 4615, motto: 'Everything is connected' },
  { name: 'Trie', color: '#FF4D8D', pts: 4390, motto: 'One prefix at a time' },
  { name: 'Stack', color: '#9BFF6B', pts: 3975, motto: 'Last in, first out' },
] as const;

export const badges = [
  {
    id: 'first-ac',
    name: 'First AC',
    desc: 'Your first accepted submission.',
    xp: 50,
    glyph: 'AC',
  },
  { id: '100', name: '100 Solved', desc: 'One hundred problems down.', xp: 300, glyph: '100' },
  {
    id: 'streak30',
    name: '30-Day Streak',
    desc: 'Solved something thirty days running.',
    xp: 500,
    glyph: '30D',
  },
  {
    id: 'contests10',
    name: '10 Contests',
    desc: 'Ten rated rounds entered.',
    xp: 250,
    glyph: '10X',
  },
  {
    id: 'upsolve',
    name: 'Upsolve Hero',
    desc: 'Cleared a full upsolve queue before the deadline.',
    xp: 200,
    glyph: 'UP',
  },
  {
    id: 'attend',
    name: 'Perfect Attendance',
    desc: 'Every class in a term.',
    xp: 300,
    glyph: 'ATT',
  },
  {
    id: 'zero-dues',
    name: 'Zero Dues',
    desc: 'A full term with nothing overdue.',
    xp: 150,
    glyph: '৳0',
  },
  {
    id: 'mentor',
    name: 'Mentor of the Month',
    desc: 'Most kudos from mentees in a month.',
    xp: 400,
    glyph: 'MVP',
  },
];

export const tracks = [
  {
    id: 'cp',
    name: 'Competitive Programming',
    cls: 'ALGORITHMIST',
    stat: [9, 6, 8],
    blurb: "Green sheets, weekly contests, ICPC teams. The club's core.",
  },
  {
    id: 'web',
    name: 'Web Engineering',
    cls: 'BUILDER',
    stat: [6, 9, 6],
    blurb: "Ship real products. This platform is the group's main project.",
  },
  {
    id: 'ai',
    name: 'AI / ML',
    cls: 'ORACLE',
    stat: [8, 7, 5],
    blurb: 'Paper reading circles, Kaggle sprints and model-building nights.',
  },
  {
    id: 'game',
    name: 'Game Dev',
    cls: 'WORLDSMITH',
    stat: [5, 9, 7],
    blurb: 'Game jams twice a term. Pixels, physics and play-testing.',
  },
  {
    id: 'sec',
    name: 'Security',
    cls: 'BREAKER',
    stat: [8, 5, 9],
    blurb: 'CTF practice, binary puzzles and responsible disclosure.',
  },
];

export const pastContests = [
  {
    id: 'wc41',
    name: 'Weekly Club Contest #41',
    date: '2026-11-09',
    solved: 5,
    teams: 81,
    winner: 'nadia',
    topics: ['greedy', 'binary search', 'dsu'],
  },
  {
    id: 'wc40',
    name: 'Weekly Club Contest #40',
    date: '2026-11-02',
    solved: 5,
    teams: 77,
    winner: 'tanvir',
    topics: ['math', 'dp', 'graphs'],
  },
  {
    id: 'freshers',
    name: "Freshers' Cup 2026",
    date: '2026-10-24',
    solved: 7,
    teams: 112,
    winner: 'tasnim',
    topics: ['implementation', 'sorting'],
  },
  {
    id: 'wc39',
    name: 'Weekly Club Contest #39',
    date: '2026-10-19',
    solved: 6,
    teams: 69,
    winner: 'sadia',
    topics: ['strings', 'two pointers'],
  },
  {
    id: 'mock2',
    name: 'ICPC Mock #2',
    date: '2026-10-11',
    solved: 11,
    teams: 14,
    winner: 'mehedi',
    topics: ['flows', 'geometry', 'dp'],
  },
  {
    id: 'wc38',
    name: 'Weekly Club Contest #38',
    date: '2026-10-05',
    solved: 5,
    teams: 74,
    winner: 'nadia',
    topics: ['number theory', 'bitmasks'],
  },
];

export const projects = [
  {
    name: 'clubOS',
    by: ['sadia', 'nusrat', 'imran'],
    tags: ['Web', 'Next.js', 'PostgreSQL'],
    blurb: 'This platform: dues, sheets, contests and status behind one login.',
    status: 'In production',
  },
  {
    name: 'judge-sync',
    by: ['tanvir', 'mehedi'],
    tags: ['CP', 'TypeScript', 'Queues'],
    blurb:
      'Background workers that pull solves and ratings from Codeforces, AtCoder and CSES without tripping a rate limit.',
    status: 'In production',
  },
  {
    name: 'Balloon Runner',
    by: ['shuvo', 'mim'],
    tags: ['Game dev', 'Godot'],
    blurb:
      'A contest-day arcade game: deliver balloons to the right team before the scoreboard freezes.',
    status: 'Game jam winner',
  },
  {
    name: 'Bangla OCR Lite',
    by: ['anika', 'priya'],
    tags: ['AI/ML', 'PyTorch'],
    blurb: 'A small model that reads handwritten Bangla digits off exam scripts on a phone.',
    status: 'Research',
  },
  {
    name: 'ctf-warmups',
    by: ['farhan', 'sabbir'],
    tags: ['Security', 'Docker'],
    blurb:
      "Twenty self-hosted beginner CTF challenges with write-ups, used in the security group's first month.",
    status: 'Open source',
  },
  {
    name: 'Notebook Forge',
    by: ['nadia', 'rahim'],
    tags: ['CP', 'LaTeX', 'C++'],
    blurb: "Turns the club's shared template library into a printable, 25-page ICPC team notebook.",
    status: 'Open source',
  },
  {
    name: 'Seat Finder',
    by: ['jannat', 'zahid'],
    tags: ['Web', 'PWA'],
    blurb:
      'Shows which lab has free machines right now. Built in one hack night, used every day since.',
    status: 'Hack night',
  },
  {
    name: 'Proof Buddy',
    by: ['rahim', 'tasnim'],
    tags: ['AI/ML', 'CP'],
    blurb:
      'Explains why your greedy is wrong by generating the smallest counter-example it can find.',
    status: 'Prototype',
  },
];

export const timeline = [
  {
    year: '2019',
    title: 'Four students, one lab',
    text: 'The club starts as a Friday problem-solving circle in a borrowed lab.',
  },
  {
    year: '2021',
    title: 'First ICPC regional team',
    text: 'Three members qualify for the Dhaka Regional preliminary and bring back a notebook full of lessons.',
  },
  {
    year: '2023',
    title: 'The green sheet',
    text: "Mentors publish the first curated sheet. Completion becomes the club's shared language for progress.",
  },
  {
    year: '2025',
    title: 'Tracks beyond CP',
    text: 'Web, AI/ML, game dev and security groups form, each with a lead and a weekly meeting.',
  },
  {
    year: '2026',
    title: 'One login for everything',
    text: 'Dues, attendance, sheets and contests move off spreadsheets and Messenger threads onto this platform.',
  },
];

export const committee = [
  { id: 'tanvir', role: 'President' },
  { id: 'nadia', role: 'CP Head' },
  { id: 'sadia', role: 'General Secretary' },
  { id: 'anika', role: 'Treasurer' },
  { id: 'nusrat', role: 'Event Secretary' },
  { id: 'mehedi', role: 'Lead Mentor' },
  { id: 'rahim', role: 'Content and Resources' },
  { id: 'farhan', role: 'PR and Media' },
];

export const roadmap = [
  {
    id: 'cpp',
    name: 'C++ basics',
    weeks: 2,
    needs: [] as string[],
    note: 'I/O, loops, functions, arrays',
  },
  {
    id: 'stl',
    name: 'STL',
    weeks: 2,
    needs: ['cpp'],
    note: 'vector, map, set, sort, priority_queue',
  },
  {
    id: 'math',
    name: 'Number theory',
    weeks: 3,
    needs: ['cpp'],
    note: 'gcd, sieve, modular arithmetic',
  },
  {
    id: 'ds',
    name: 'Data structures',
    weeks: 4,
    needs: ['stl'],
    note: 'prefix sums, DSU, segment tree',
  },
  { id: 'graphs', name: 'Graphs', weeks: 4, needs: ['stl'], note: 'BFS, DFS, shortest paths, MST' },
  {
    id: 'dp',
    name: 'Dynamic programming',
    weeks: 5,
    needs: ['ds', 'math'],
    note: 'states, transitions, bitmask, digit',
  },
  {
    id: 'icpc',
    name: 'ICPC team',
    weeks: 0,
    needs: ['graphs', 'dp'],
    note: 'Mocks, notebook, regionals',
  },
];

export const lifecycle = [
  {
    step: 'Applicant',
    text: 'Fill in the form, take a short screening quiz, book an interview slot.',
  },
  {
    step: 'Probationary',
    text: 'Limited access and an onboarding checklist: verify a handle, pick a mentor, solve three starter problems.',
  },
  { step: 'Member', text: 'Full access: sheets, contests, events, the leaderboard and a vote.' },
  {
    step: 'Executive',
    text: 'Role-based admin access for one tenure, assigned and removed by the President.',
  },
  {
    step: 'Alumni',
    text: 'Automatic at graduation. You keep your profile, your hall of fame entry and the right to mentor.',
  },
];

export const faq = [
  {
    q: 'I have never written a line of code. Can I join?',
    a: 'Yes. The Starter sheet and the first bootcamp assume nothing. About a third of each intake starts from zero.',
  },
  {
    q: 'Is there a fee?',
    a: 'A one-time admission fee and a small semester subscription, payable by bKash, Nagad, Rocket or cash. You always see exactly what you owe and get a numbered receipt.',
  },
  {
    q: 'Which languages do you use?',
    a: 'C++ for competitive programming, because that is what ICPC teams use. The other tracks use whatever ships: TypeScript, Python, C#, GDScript.',
  },
  {
    q: 'How much time does it take?',
    a: 'One problem a day keeps a streak alive. Most active members spend five to eight hours a week, more before a regional.',
  },
  {
    q: 'Do I need a Codeforces account?',
    a: 'You will want one. The platform verifies your handle once, then pulls solves and ratings automatically, so you never type progress by hand.',
  },
  {
    q: 'Where does the money go?',
    a: 'Prizes, food at events, printing and hosting. Members can open a transparency page that shows the fund balance and spending by category.',
  },
];

export const sponsorTiers = [
  {
    tier: 'Compiler',
    ask: '৳50,000+',
    gets: [
      'Title naming on the annual contest',
      'Logo on the live scoreboard and all certificates',
      'A 20-minute talk slot and a recruitment desk',
      'Access to the opt-in CV book',
    ],
  },
  {
    tier: 'Linker',
    ask: '৳20,000+',
    gets: [
      'Logo on the contest site and event banners',
      'A named prize for one category',
      'A recruitment desk on contest day',
    ],
  },
  {
    tier: 'Runtime',
    ask: '৳5,000+',
    gets: [
      'Logo on the sponsor page',
      'A mention in the opening and closing ceremony',
      'Sponsored food or balloons, credited',
    ],
  },
];

export const certificates = [
  {
    code: 'FECPC-2026-0412',
    name: 'Tasnim Akter',
    what: "Champion, Freshers' Cup 2026",
    date: '2026-10-24',
    signedBy: 'Tanvir Ahmed, President',
  },
  {
    code: 'FECPC-2026-0388',
    name: 'Mehedi Hasan',
    what: 'Mentor of the Term, Spring 2026',
    date: '2026-06-30',
    signedBy: 'Nadia Rahman, CP Head',
  },
  {
    code: 'FECPC-2026-0297',
    name: 'Shuvo Das',
    what: 'Winner, Summer Game Jam 2026',
    date: '2026-07-19',
    signedBy: 'Nusrat Jahan, Event Secretary',
  },
];

export const hallOfFame = [
  {
    year: '2026',
    title: 'Highest club rating',
    who: 'Nadia Rahman',
    detail: 'Candidate Master, peak 1967',
  },
  {
    year: '2025',
    title: 'ICPC Dhaka Regional',
    who: 'Team FEC_NullPointers',
    detail: 'Rank 41 of 180 on site',
  },
  { year: '2025', title: 'Longest streak', who: 'Anika Tabassum', detail: '312 consecutive days' },
  {
    year: '2024',
    title: 'NCPC preliminary',
    who: 'Team FEC_Overflow',
    detail: 'Qualified for the final round',
  },
  {
    year: '2024',
    title: 'First Expert',
    who: 'Tanvir Ahmed',
    detail: 'Crossed 1600 in his third semester',
  },
];

export const fmtDate = (
  iso: string,
  opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opt }).format(
    new Date(iso + 'T00:00:00Z'),
  );

export const loops = [
  { name: 'Streak', what: 'A new problem every day. Miss one and the counter resets.' },
  { name: 'Rank', what: 'See where you stand on a live board, by batch or by rating.' },
  { name: 'Progress', what: 'Watch the green sheet fill in as the judge confirms each solve.' },
  { name: 'Deadline', what: 'Contests, dues and registrations remind you before they close.' },
  { name: 'Social', what: 'Cheer a rank-up, accept a duel, answer a doubt.' },
  { name: 'Status', what: 'Earn badges and a title that sits beside your name.' },
];
