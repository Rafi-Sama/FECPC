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
export const cashflow = [18, 26, 22, 41, 35, 29, 44, 38, 52, 47, 61, 55];
export const mentees = [
  { id: 'tasnim', week: [5, 4], last: 'today', flag: '' },
  { id: 'zahid', week: [5, 2], last: 'yesterday', flag: '' },
  { id: 'mim', week: [5, 0], last: '9 days ago', flag: 'No activity for 7 days' },
  { id: 'jannat', week: [5, 5], last: 'today', flag: '' },
];
export const applications = [
  { id: 'ap1', name: 'Rifat Mahmud', dept: 'CSE', batch: 26, quiz: 82, src: 'Orientation' },
  { id: 'ap2', name: 'Lamia Haque', dept: 'EEE', batch: 26, quiz: 74, src: 'Friend' },
  { id: 'ap3', name: 'Sakib Al Noman', dept: 'CSE', batch: 26, quiz: 91, src: 'Facebook' },
];
export const vault = [
  ['Constitution (2024 revision)', 'PDF', '12 pages'],
  ['MoU: department lab access', 'PDF', '3 pages'],
  ['Budget, Autumn 2026', 'Sheet', 'approved 2 Oct'],
  ['Annual report 2025', 'PDF', '28 pages'],
  ['Handover notes: 2025 committee', 'Doc', 'updated Jun'],
];
export const sponsors = [
  {
    name: 'Title sponsor (fintech)',
    promised: 60000,
    got: 40000,
    owe: 'Logo on scoreboard, 20-min talk',
    last: 'Call, 6 Nov',
  },
  {
    name: 'Local ISP',
    promised: 20000,
    got: 20000,
    owe: 'Banner at venue, named prize',
    last: 'Email, 2 Nov',
  },
  { name: 'Bookshop', promised: 5000, got: 0, owe: 'Logo on sponsor page', last: 'Visit, 28 Oct' },
];
export const reports = {
  growth: [88, 94, 101, 109, 118, 126, 131, 144],
  retention: [71, 74, 70, 78, 81, 79, 84, 86],
  solves: [410, 520, 480, 690, 760, 720, 910, 1040],
};
export const quizAnswers: Record<string, number[]> = {
  dp: [1, 2, 0],
  cpp: [1, 2, 1],
  graphs: [0, 1, 2],
};
export const ATTENDANCE = { event: 'dp-bootcamp', code: 'K74QX2' }; // shortcut: one fixed code; rotate per class when attendance goes live
