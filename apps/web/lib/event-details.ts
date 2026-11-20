import { type ClubEvent } from '@fecpc/content/site';

export type EventDetailData = {
  headline: string;
  about: string;
  schedule: { time: string; what: string }[];
  organisersDesc: string;
  organisers: { name: string; role: string }[];
  role2Title: string;
  role2Sub: string;
  role2Key: string;
  bannerTitle: string;
};

export function getBannerTitle(e: ClubEvent): string {
  switch (e.id) {
    case 'dp-bootcamp':
      return 'DP Bootcamp';
    case 'weekly-42':
      return 'Contest #42';
    case 'git-night':
      return 'Git Night';
    case 'icpc-mock-3':
      return 'ICPC Mock #3';
    case 'alumni-talk':
      return 'Alumni Fireside';
    case 'hack-night':
      return 'Hack Night';
    case 'intra-contest':
      return 'ICPC 2026';
    default:
      return e.title.split(',')[0].split(':')[0];
  }
}

export function eventTicketCode(e: { id: string; title: string }): string {
  if (e.id === 'weekly-42') return 'WEE-3137';
  return `${e.id.replace(/-/g, '').slice(0, 3).toUpperCase()}-${((e.title.length * 7919) % 9000) + 1000}`;
}

const customDetails: Record<string, Partial<EventDetailData>> = {
  'weekly-42': {
    bannerTitle: 'Weekly Club Contest #42',
    headline: 'Five problems. Two hours. One ladder.',
    about:
      'Rated for the club ladder. The upsolve thread opens when the timer stops. Problem setters walk through solutions the next day.',
    schedule: [
      { time: '19:45', what: 'Join the Codeforces group' },
      { time: '20:00', what: 'Contest starts' },
      { time: '22:00', what: 'Timer stops, upsolve opens' },
    ],
    organisersDesc: 'Event staff are listed here, with their role for this event.',
    organisers: [
      { name: 'Nadia Rahman', role: 'Problem Setter' },
      { name: 'Tanvir Ahmed', role: 'Contest Admin' },
      { name: 'Sadia Islam', role: 'Platform Lead' },
    ],
    role2Title: 'Judge',
    role2Sub: '1 of 2 left · manual approval',
    role2Key: 'judge',
  },
  'dp-bootcamp': {
    bannerTitle: 'DP Bootcamp',
    headline: 'DP Bootcamp, Day 1: states and transitions',
    about:
      'From Fibonacci to knapsack. Bring a laptop; assignments are auto-checked against your Codeforces submissions. Mentors will be present in the lab to walk through recurrence relations, DAG visualization, and memory state compression.',
    schedule: [
      { time: '14:45', what: 'Lab opens & workstation setup' },
      { time: '15:00', what: 'Core theory: states, transitions & base cases' },
      { time: '16:15', what: 'Hands-on problem solving (5 graded problems)' },
      { time: '17:30', what: 'Code review & homework briefing' },
    ],
    organisersDesc: 'Instructors and lab mentors running this bootcamp session.',
    organisers: [
      { name: 'Mehedi Hasan', role: 'Lead Instructor' },
      { name: 'Rahim Uddin', role: 'Teaching Assistant' },
      { name: 'Nusrat Jahan', role: 'Lab Coordinator' },
    ],
    role2Title: 'Teaching Assistant',
    role2Sub: '2 left · lab support & mentoring',
    role2Key: 'ta',
  },
  'git-night': {
    bannerTitle: 'Git Night',
    headline: 'Branches, rebases, and how to un-break a repository at 2 a.m.',
    about:
      'A hands-on workshop aimed at first-years. Branches, rebases and how to un-break a repository at 2 a.m. We will simulate realistic team pull requests, messy merge conflicts, and learn how git reflog saves your commits.',
    schedule: [
      { time: '16:15', what: 'Check-in & terminal environment verification' },
      { time: '16:30', what: 'The Git object model: blobs, trees, commits' },
      { time: '17:15', what: 'Live merge conflict & rebase simulation lab' },
      { time: '18:00', what: 'SSH keys, pull requests & open Q&A' },
    ],
    organisersDesc: 'Session leads and mentors assisting with student machines.',
    organisers: [
      { name: 'Sadia Islam', role: 'Lead Instructor' },
      { name: 'Farhan Kabir', role: 'Teaching Assistant' },
      { name: 'Shuvo Das', role: 'Lab Support' },
    ],
    role2Title: 'Teaching Assistant',
    role2Sub: '2 left · 1-on-1 terminal troubleshooting',
    role2Key: 'ta',
  },
  'icpc-mock-3': {
    bannerTitle: 'ICPC Mock #3',
    headline: 'Five hours. Teams of three. One machine.',
    about:
      'Dhaka Regional replay under official ICPC regional regulations. Scoreboard freezes in the last hour, as it will on the day. Helium balloons, printed code delivery, and real contest pressure.',
    schedule: [
      { time: '09:30', what: 'Team arrival, machine assignment & environment test' },
      { time: '10:00', what: 'Contest start & live scoreboard active' },
      { time: '14:00', what: 'Scoreboard freeze (final hour)' },
      { time: '15:00', what: 'Contest ends & live solution walkthrough' },
    ],
    organisersDesc: 'Chief judge and technical staff managing the contest room.',
    organisers: [
      { name: 'Nadia Rahman', role: 'Chief Judge' },
      { name: 'Tanvir Ahmed', role: 'Contest Director' },
      { name: 'Mehedi Hasan', role: 'System & Scoreboard Lead' },
    ],
    role2Title: 'Judge',
    role2Sub: '1 left · appeal review & clarification desk',
    role2Key: 'judge',
  },
  'alumni-talk': {
    bannerTitle: 'Alumni Fireside',
    headline: 'From Pupil to SWE: three graduates on life after the ladder.',
    about:
      'Three graduates on interviews, first jobs and what competitive programming did and did not prepare them for. Open audience Q&A follows the panel discussion.',
    schedule: [
      { time: '17:45', what: 'Auditorium seating & mic check' },
      { time: '18:00', what: 'Fireside discussion & career retrospectives' },
      { time: '19:15', what: 'Open floor Q&A from members' },
      { time: '20:00', what: 'Casual networking & tea' },
    ],
    organisersDesc: 'Organisers hosting our alumni guests.',
    organisers: [
      { name: 'Farhan Kabir', role: 'PR & Media Lead' },
      { name: 'Sadia Islam', role: 'Host' },
      { name: 'Tanvir Ahmed', role: 'Moderator' },
    ],
    role2Title: 'Stage Support',
    role2Sub: '2 left · mic runner & guest reception',
    role2Key: 'stage',
  },
  'hack-night': {
    bannerTitle: 'Hack Night',
    headline: 'Twelve hours. One surprise theme. Ship before dawn.',
    about:
      'Build something small with a team of up to three. Pizza included; the invoice appears in your finance screen. Theme is revealed at kickoff.',
    schedule: [
      { time: '18:30', what: 'Registration desk & team formation' },
      { time: '19:00', what: 'Theme reveal & hacking begins' },
      { time: '00:00', what: 'Midnight pizza & caffeine break' },
      { time: '07:00', what: 'Code freeze & 3-minute project demos' },
    ],
    organisersDesc: 'Hackathon coordinators and technical mentors.',
    organisers: [
      { name: 'Nusrat Jahan', role: 'Lead Organizer' },
      { name: 'Anika Tabassum', role: 'Logistics & Catering' },
      { name: 'Imran Chowdhury', role: 'Technical Mentor' },
    ],
    role2Title: 'Judge',
    role2Sub: '2 left · project demo scoring',
    role2Key: 'judge',
  },
  'intra-contest': {
    bannerTitle: 'ICPC 2026',
    headline: 'The annual contest day. 50+ teams. One campus champion.',
    about:
      'The flagship competitive programming event of the university. ICPC rules, live projector scoreboard, balloons, and a prize pool for the top five teams. Top teams earn invitations to regional squads.',
    schedule: [
      { time: '08:30', what: 'Badge collection, team kit & breakfast' },
      { time: '09:30', what: 'Contest starts' },
      { time: '13:30', what: 'Scoreboard freezes' },
      { time: '14:30', what: 'Contest ends & lunch' },
      { time: '15:30', what: 'Closing ceremony & prize distribution' },
    ],
    organisersDesc: 'Executive committee directing the annual championship.',
    organisers: [
      { name: 'Tanvir Ahmed', role: 'Contest Director' },
      { name: 'Nadia Rahman', role: 'Chief Judge' },
      { name: 'Nusrat Jahan', role: 'Operations Lead' },
      { name: 'Anika Tabassum', role: 'Finance & Awards' },
    ],
    role2Title: 'Judge',
    role2Sub: '2 of 4 left · clarification desk',
    role2Key: 'judge',
  },
};

export function getEventDetails(event: ClubEvent): EventDetailData {
  const custom = customDetails[event.id] ?? {};
  return {
    bannerTitle: custom.bannerTitle ?? getBannerTitle(event),
    headline: custom.headline ?? event.title,
    about: custom.about ?? event.blurb,
    schedule: custom.schedule ?? [
      { time: event.time, what: `${event.title} begins` },
      { time: '18:00', what: 'Main session concludes & Q&A' },
    ],
    organisersDesc: custom.organisersDesc ?? 'Event staff and leads for this session.',
    organisers: custom.organisers ?? [
      { name: 'Nusrat Jahan', role: 'Event Secretary' },
      { name: 'Tanvir Ahmed', role: 'Executive' },
    ],
    role2Title: custom.role2Title ?? (event.type === 'Contest' ? 'Judge' : 'Mentor / TA'),
    role2Sub: custom.role2Sub ?? '1 left · manual approval',
    role2Key: custom.role2Key ?? (event.type === 'Contest' ? 'judge' : 'ta'),
  };
}
