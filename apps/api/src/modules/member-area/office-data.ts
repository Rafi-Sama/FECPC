// Officer-only records and answer keys. This file is imported by server code only, so none of it
// reaches a browser unless state.ts (loadState) decides the signed-in role may see it.
// Placeholder figures, like @fecpc/content: replace with real entry screens when the club starts using them.
export const queue = [
  {
    id: 'PAY-901',
    who: 'zahid',
    label: 'Semester subscription',
    amount: 300,
    via: 'bKash',
    trx: 'BK7Q2M9X1A',
    sender: '017••••4821',
  },
  {
    id: 'PAY-902',
    who: 'mim',
    label: 'Semester subscription',
    amount: 300,
    via: 'Nagad',
    trx: 'NG55K1P07C',
    sender: '018••••1190',
  },
  {
    id: 'PAY-903',
    who: 'sabbir',
    label: 'Hack Night registration',
    amount: 150,
    via: 'Rocket',
    trx: 'RK3310ZZ8T',
    sender: '019••••7754',
  },
  {
    id: 'PAY-904',
    who: 'jannat',
    label: 'Semester subscription',
    amount: 300,
    via: 'bKash',
    trx: 'BK81TT0P3Z',
    sender: '017••••0032',
  },
];
export const accounts = [
  ['Cash in hand', 8450],
  ['bKash', 21300],
  ['Nagad', 9120],
  ['Rocket', 2750],
  ['Bank', 46000],
] as const;
export const ledger = [
  { date: '2026-11-10', what: 'Semester subscriptions (14)', cat: 'Dues', amt: 4200 },
  { date: '2026-11-09', what: 'Weekly #41 prizes', cat: 'Prizes', amt: -1500 },
  { date: '2026-11-06', what: 'Sponsor: instalment 2 of 3', cat: 'Sponsorship', amt: 10000 },
  { date: '2026-11-04', what: 'Banner printing', cat: 'Printing', amt: -1850 },
  { date: '2026-11-02', what: 'Hosting and domain, annual', cat: 'Hosting', amt: -3600 },
  { date: '2026-10-24', what: "Freshers' Cup food", cat: 'Food', amt: -6200 },
  { date: '2026-10-24', what: "Freshers' Cup registration (112)", cat: 'Events', amt: 11200 },
];
export const expenses = [
  {
    id: 'EXP-071',
    by: 'nusrat',
    what: 'Hack Night dinner, 120 people',
    amount: 14400,
    event: 'Winter Hack Night',
  },
  {
    id: 'EXP-072',
    by: 'nadia',
    what: 'ICPC Mock #3 printed problem sets',
    amount: 900,
    event: 'ICPC Mock #3',
  },
  {
    id: 'EXP-073',
    by: 'farhan',
    what: 'Contest day balloons and helium',
    amount: 5200,
    event: 'Intra-College Contest',
  },
];
export const applications = [
  { id: 'ap1', name: 'Rifat Mahmud', dept: 'CSE', batch: 26, quiz: 82, src: 'Orientation' },
  { id: 'ap2', name: 'Lamia Haque', dept: 'EEE', batch: 26, quiz: 74, src: 'Friend' },
  { id: 'ap3', name: 'Sakib Al Noman', dept: 'CSE', batch: 26, quiz: 91, src: 'Facebook' },
];
export const reports = {
  growth: [88, 94, 101, 109, 118, 126, 131, 144],
  retention: [71, 74, 70, 78, 81, 79, 84, 86],
  solves: [410, 520, 480, 690, 760, 720, 910, 1040],
};

// Placeholder courses and quiz questions for a fresh database (/app/courses, /app/quiz).
export const courses = [
  {
    title: 'Competitive Programming Core: Algorithms & Data Structures',
    instructor: 'Tasnim Ahmed',
    duration_weeks: 12,
    description:
      'Master binary search, graph traversals, shortest paths, dynamic programming, and segment trees.',
    url: 'https://cp-algorithms.com',
  },
  {
    title: 'Introduction to Modern C++ for Contests',
    instructor: 'Tanvir Hossain',
    duration_weeks: 4,
    description:
      'Fast I/O, STL containers, iterators, lambdas, bitsets, and custom comparators for speed.',
    url: 'https://en.cppreference.com/w/cpp',
  },
  {
    title: 'Graph Theory & Network Flows Deep Dive',
    instructor: 'Anika Rahman',
    duration_weeks: 8,
    description:
      'DFS/BFS trees, articulation points, bridges, 2-SAT, Dinic algorithm, and min-cost max-flow.',
    url: 'https://usaco.guide/advanced',
  },
];
export const quizBank = [
  {
    question:
      'What is the worst-case time complexity of binary search on a sorted array of size n?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correct_index: 1,
  },
  {
    question: 'Which abstract data structure does Breadth-First Search (BFS) typically use?',
    options: ['Queue', 'Stack', 'Priority Queue', 'Disjoint Set Union'],
    correct_index: 0,
  },
  {
    question: 'What is the time complexity of building a Segment Tree for an array of size n?',
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)'],
    correct_index: 1,
  },
  {
    question:
      'In Dijkstra algorithm with a binary min-heap, what is the standard time complexity for graph G(V, E)?',
    options: ['O(V^2)', 'O(V + E)', 'O((V + E) log V)', 'O(V * E)'],
    correct_index: 2,
  },
  {
    question:
      'What is the space complexity of an adjacency matrix representation for a graph with V vertices?',
    options: ['O(V)', 'O(V + E)', 'O(V^2)', 'O(E^2)'],
    correct_index: 2,
  },
  {
    question: 'Which of the following problems can NOT be solved in polynomial time unless P = NP?',
    options: [
      'Minimum Spanning Tree',
      '0/1 Knapsack (exact)',
      'Shortest Path with negative weights (no cycle)',
      'Eulerian Circuit',
    ],
    correct_index: 1,
  },
];
