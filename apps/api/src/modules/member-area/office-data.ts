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
export const budgets = [
  ['Intra-College Contest', 60000, 49200],
  ['Winter Hack Night', 25000, 14400],
  ['ICPC Mock series', 6000, 2700],
] as const;
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
export const tasks = [
  {
    id: 't1',
    title: 'Book Central Lab for contest day',
    who: 'nusrat',
    due: '20 Nov',
    col: 'Doing',
  },
  {
    id: 't2',
    title: 'Confirm title sponsor instalment 3',
    who: 'anika',
    due: '25 Nov',
    col: 'To do',
  },
  { id: 't3', title: 'Set problems for Weekly #43', who: 'nadia', due: '21 Nov', col: 'Doing' },
  {
    id: 't4',
    title: 'Print 180 participant certificates',
    who: 'farhan',
    due: '15 Dec',
    col: 'To do',
  },
  { id: 't5', title: 'Publish election nominee list', who: 'sadia', due: '14 Nov', col: 'Done' },
  { id: 't6', title: 'Order 400 balloons, 8 colours', who: 'farhan', due: '10 Dec', col: 'To do' },
];
export const meetings = [
  {
    id: 'm1',
    date: '13 Nov',
    title: 'General meeting',
    agenda: ['Contest day roles', 'Budget vote', 'New mentor pairs'],
    actions: [
      ['Assign 12 volunteers to balloons', 'nusrat'],
      ['Share budget sheet with members', 'anika'],
    ],
  },
  {
    id: 'm2',
    date: '30 Oct',
    title: 'Executive sync',
    agenda: ["Freshers' Cup review", 'Sheet v2026.2'],
    actions: [["Publish Freshers' Cup editorial", 'rahim']],
  },
];
export const vault = [
  ['Constitution (2024 revision)', 'PDF', '12 pages'],
  ['MoU: department lab access', 'PDF', '3 pages'],
  ['Budget, Autumn 2026', 'Sheet', 'approved 2 Oct'],
  ['Annual report 2025', 'PDF', '28 pages'],
  ['Handover notes: 2025 committee', 'Doc', 'updated Jun'],
];
export const inventory = [
  ['Projector (Epson)', 'eq1', ''],
  ['Laptop, contest spare #1', 'eq2', 'nusrat'],
  ['Laptop, contest spare #2', 'eq3', ''],
  ['Club banner, 8 ft', 'eq4', 'farhan'],
  ['Champion trophy 2026', 'eq5', ''],
] as [string, string, string][];
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
export const waivers = [
  {
    id: 'w1',
    who: 'jannat',
    what: 'Semester subscription',
    amount: 300,
    reason: 'Financial hardship, advisor letter attached',
  },
  {
    id: 'w2',
    who: 'zahid',
    what: 'Late fine',
    amount: 50,
    reason: 'Wallet outage on the due date',
  },
];
export const quizAnswers: Record<string, number[]> = {
  dp: [1, 2, 0],
  cpp: [1, 2, 1],
  graphs: [0, 1, 2],
};
export const ATTENDANCE = { event: 'dp-bootcamp', code: 'K74QX2' }; // shortcut: one fixed code; rotate per class when attendance goes live
