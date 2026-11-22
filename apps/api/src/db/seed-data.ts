// Creates the schema and loads the placeholder club, so a fresh database behaves like the demo did.
import { applySchema } from './apply-schema.ts';
import { seedSolved } from '@fecpc/content/member-area';
import { members } from '@fecpc/content/site';
import type { Role } from '@fecpc/contracts';
import { hashPassword } from '../modules/member-area/tokens.ts';
import * as data from '../modules/member-area/office-data.ts';
import type { Db } from '../modules/member-area/db.ts';
import { backfillMilestones } from '../modules/member-area/milestones.ts';

const roleOf: Record<string, Role> = {
  President: 'president',
  'CP Head': 'cp_head',
  'General Secretary': 'secretary',
  'Event Secretary': 'secretary',
  Treasurer: 'treasurer',
};

export async function setup(db: Db, password: string) {
  await applySchema(db);
  const seededBefore = (await db.query(`select 1 from users limit 1`)).rowCount! > 0;
  if (!seededBefore) {
    const hash = await hashPassword(password),
      base = JSON.stringify({
        base: { solved: seedSolved.length, done: 0 },
        solved: seedSolved,
        done: [],
      });
    for (const m of members)
      await db.query(
        `insert into users (id, email, pass_hash, role, name, handle, batch, dept, squad, title, rating, peak, solved, problems_solved, streak, helper, skills, progress) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15, $16, $17)`,
        [
          m.id,
          `${m.id}@fecpc.example`,
          hash,
          roleOf[m.role ?? ''] ?? 'member',
          m.name,
          m.handle,
          m.batch,
          m.dept,
          m.squad,
          m.role ?? null,
          m.rating,
          m.peak,
          m.solved,
          m.streak,
          m.helper,
          m.skills,
          base,
        ],
      );
    await db.query(
      `insert into users (id, email, pass_hash, role, name, batch, dept, title, system) values ('admin', 'admin@fecpc.example', $1, 'super_admin', 'Site Admin', 0, 'CSE', 'Super Admin', true)`,
      [hash],
    );
    for (const x of data.expenses)
      await db.query(`insert into expenses (by, what, amount, event) values ($1, $2, $3, $4)`, [
        x.by,
        x.what,
        x.amount,
        x.event,
      ]);
    for (const q of data.queue)
      await db.query(
        `insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, 'INV-2611', $2, $3, $4, $5, $6)`,
        [q.who, q.label, q.amount, q.via, q.trx, q.sender.replace(/\D/g, '').padEnd(11, '0')],
      );
    for (const a of data.applications)
      await db.query(
        `insert into applications (name, sid, dept, batch, email, track, why, quiz, src) values ($1, $2, $3, $4, $5, 'cp', 'Seeded placeholder application.', $6, $7)`,
        [
          a.name,
          `20${a.batch}-331-0${a.id.slice(2)}`,
          a.dept,
          a.batch,
          `${a.id}@applicant.example`,
          a.quiz,
          a.src,
        ],
      );
  } else {
    const hash = await hashPassword(password);
    await db.query(`update users set pass_hash = $1 where email like '%@fecpc.example'`, [hash]);
  }

  // Seed initial Community Feed posts & Ideas once (using non-tasnim authors so member onboarding tests start at 0 earned XP).
  const hasSeedUsers = (await db.query(`select 1 from users where id = 'nadia'`)).rowCount! > 0;
  if (hasSeedUsers && !(await db.query(`select 1 from feed_posts limit 1`)).rowCount) {
    const seedFeed: [string, string, string, string, number, string][] = [
      [
        'nadia',
        'Reached Candidate Master — what finally unlocked 1900+ for me',
        'After three months stuck around 1750, two habits made the difference:\n\n- **Timed virtuals on Div. 2 C/D** with zero editorial peeks for 45 minutes\n- Writing a two-line post-mortem for every WA on graph and DP problems\n\n```cpp\n// Always verify overflow on weighted shortest paths\nusing ll = long long;\nconst ll INF = 4e18;\n```\n\nHappy to share my upsolve sheet with anyone pushing for Expert or CM this term!',
        'problem-solving',
        24,
        '2 hours',
      ],
      [
        'mehedi',
        'DP Sheet Q&A: breaking down state transitions on Vacations (698A) and Boredom (455A)',
        'Several Batch 24 members asked how to choose DP states without getting stuck in greedy traps.\n\n> Rule of thumb: write down what information from prefix `1..i` actually constrains choice `i+1`. Everything else does not belong in the state.\n\nBring your stuck submission links or state attempts to the session tonight and I will walk through them.',
        'upsolving',
        17,
        '3 hours',
      ],
      [
        'rahim',
        'Weekly #42 post-contest recap & tricky edge cases on Problem D',
        'Great turnout for Weekly #42! Problem D (`277A` style DSU component count) caught a lot of teams when **zero languages** were known by every participant.\n\nIf `totalLanguages == 0`, the answer is `n`, not `components - 1`. Upsolving window stays open until Sunday night.',
        'topic',
        14,
        '5 hours',
      ],
      [
        'anika',
        '120-day streak milestone + my quick warm-up routine before classes',
        'Keeping a streak alive during exam week came down to solving one 1000–1200 rated implementation problem right after breakfast before opening anything else.\n\nConsistency beats 6-hour weekend marathons every single time.',
        'problem-solving',
        11,
        '1 day',
      ],
      [
        'shuvo',
        'Shipped Balloon Runner v1.2 for Contest Day volunteers',
        'Updated the offline print & balloon runner checklist for the 18 December intra-college contest:\n\n- Faster desk lookup (`L1-01` .. `L2-24`)\n- Keyboard shortcuts for marking delivered balloons\n- Offline fallback if lab Wi-Fi drops\n\nLet me know if any volunteer spots a UI rough edge.',
        'topic',
        9,
        '2 days',
      ],
    ];
    for (const [uid, title, body, cat, score, ago] of seedFeed) {
      await db.query(
        `insert into feed_posts (user_id, title, body_md, category, score, created_at, updated_at) values ($1, $2, $3, $4, $5, now() - $6::interval, now() - $6::interval)`,
        [uid, title, body, cat, score, ago],
      );
    }
  }

  if (hasSeedUsers && !(await db.query(`select 1 from ideas limit 1`)).rowCount) {
    const seedIdeas: [string, string, string, string, string, string[], string][] = [
      [
        'priya',
        'Need a third for Winter Hack Night: someone who likes frontends',
        'We already have backend + ML covered for **Winter Hack Night** and want a teammate who enjoys crisp UI work (Next.js or plain CSS).\n\nWe are building an automated CP submission visualizer with live contest replay.',
        'teammate',
        'open',
        [
          'What frontend stack are you comfortable with?',
          'Share a project or GitHub link (optional)',
        ],
        '2 hours',
      ],
      [
        'zahid',
        'Looking for two for the intra-college contest, rating 900–1200',
        'Forming a balanced Batch 25 team for the 18 December intra-college contest.\n\nPlanning to run two 3-hour gym virtuals together before contest day so we get comfortable sharing one keyboard.',
        'teammate',
        'open',
        ['What is your current Codeforces rating?', 'Which topics do you enjoy most?'],
        '5 hours',
      ],
      [
        'shuvo',
        'Game jam team needs a pixel artist who can code a little',
        'Building a 48-hour retro arcade puzzle game for the December club showcase. Engine is already running; looking for someone into sprite design, palettes, and level polish.',
        'teammate',
        'open',
        ['What tools do you use for pixel art?'],
        '1 day',
      ],
      [
        'nadia',
        'Rust for C++ people — hands-on weekend workshop',
        'A 2-hour practical session mapping C++ concepts (references, move semantics, vectors, iterators) directly to Rust ownership and borrowing, with live mini-problems.',
        'idea',
        'planned',
        [],
        '1 day',
      ],
      [
        'mehedi',
        'Competitive debugging session: stress-testing with random generators',
        'Learn how to write a 15-line brute-force checker and bash loop in 3 minutes during a live contest so you never lose 40 minutes staring at an invisible corner case.',
        'study',
        'open',
        ['Which language do you write contests in?'],
        '2 days',
      ],
      [
        'sadia',
        'Women in CP meetup & study circle',
        'Monthly informal problem-solving evening and Q&A with senior female alumni and ICPC regionalists.',
        'idea',
        'shipped',
        [],
        '3 days',
      ],
      [
        'farhan',
        'Resume review night before internship season',
        'Bring a 1-page PDF draft; alumni from Dhaka & remote teams will review structure, project bullets, and CP achievements.',
        'idea',
        'open',
        [],
        '4 days',
      ],
    ];
    for (const [uid, title, body, type, status, roles, ago] of seedIdeas) {
      await db.query(
        `insert into ideas (user_id, title, body_md, type, status, roles, created_at, updated_at) values ($1, $2, $3, $4, $5, $6::jsonb, now() - $7::interval, now() - $7::interval)`,
        [uid, title, body, type, status, JSON.stringify(roles), ago],
      );
    }
    await db.query(
      `insert into idea_interests (idea_id, user_id, response, status, created_at) values
       (1, 'imran', '{"What frontend stack are you comfortable with?":"Next.js, TypeScript, CSS Grid","Share a project or GitHub link (optional)":"github.com/imran-ch"}', 'pending', now() - interval '1 hour'),
       (1, 'nusrat', '{"What frontend stack are you comfortable with?":"React + clean design systems"}', 'accepted', now() - interval '90 minutes'),
       (2, 'mim', '{"What is your current Codeforces rating?":"920","Which topics do you enjoy most?":"Strings & greedy"}', 'pending', now() - interval '3 hours')`,
    );
  }

  // Seed alumni accounts, rich member profile fields, and alumni jobs idempotently.
  const hasSeedUsersForProfiles =
    (await db.query(`select 1 from users where id = 'nadia'`)).rowCount! > 0;
  if (hasSeedUsersForProfiles) {
    const hash = await hashPassword(password);
    const seedAlumni: {
      id: string;
      name: string;
      handle: string;
      batch: number;
      dept: string;
      squad: string;
      rating: number;
      peak: number;
      solved: number;
      streak: number;
      contests: number;
      skills: string[];
      bio: string;
      github: string;
      linkedin: string;
      experience: { period: string; role: string; summary: string }[];
      contestHistory: { name: string; rank: number; delta: number; date: string }[];
    }[] = [
      {
        id: 'shahriar',
        name: 'Shahriar Kabir',
        handle: 'sk_graphs',
        batch: 16,
        dept: 'CSE',
        squad: 'Graph',
        rating: 2104,
        peak: 2140,
        solved: 2010,
        streak: 0,
        contests: 64,
        skills: ['CP', 'Systems', 'Graphs'],
        bio: 'Software Engineer at a Dhaka fintech working on payment ledgers and distributed queues. Former FECPC President and two-time ICPC Dhaka Regionalist.',
        github: 'https://github.com/shahriar-kabir',
        linkedin: 'https://linkedin.com/in/shahriar-kabir',
        experience: [
          {
            period: '2020–2021',
            role: 'President',
            summary:
              'Established the weekly club ladder and coached the first ICPC regional qualifying trio.',
          },
          {
            period: '2019–2020',
            role: 'CP Head',
            summary: 'Curated the original green sheet and ran Friday algorithm circles in Lab 3.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 982 (Div. 1)', rank: 214, delta: 28, date: '2025-11-12' },
          { name: 'Educational Codeforces Round 171', rank: 142, delta: 19, date: '2025-10-28' },
          { name: 'Codeforces Global Round 27', rank: 498, delta: -14, date: '2025-10-05' },
          {
            name: 'ICPC Dhaka Regional 2021 (Alumni replay)',
            rank: 18,
            delta: 34,
            date: '2025-09-14',
          },
        ],
      },
      {
        id: 'tahmina',
        name: 'Tahmina Akhter',
        handle: 'tahmina_ml',
        batch: 17,
        dept: 'CSE',
        squad: 'Heap',
        rating: 1890,
        peak: 1924,
        solved: 1640,
        streak: 14,
        contests: 51,
        skills: ['CP', 'AI/ML', 'Math'],
        bio: 'ML Engineer at a healthcare startup in Singapore. Focused on clinical NLP, inference optimization, and coaching club juniors preparing for SWE interviews.',
        github: 'https://github.com/tahmina-akhter',
        linkedin: 'https://linkedin.com/in/tahmina-akhter',
        experience: [
          {
            period: '2021–2022',
            role: 'Training Lead',
            summary:
              "Led Batch 20–21 study circles and authored the club's first DP training guide.",
          },
          {
            period: '2020–2021',
            role: 'General Secretary',
            summary: 'Organized Intra-College Programming Contest 2021 with 140+ participants.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 980 (Div. 2)', rank: 89, delta: 31, date: '2025-11-04' },
          { name: 'Codeforces Round 977 (Div. 2)', rank: 310, delta: -9, date: '2025-10-19' },
          { name: 'AtCoder Beginner Contest 375', rank: 164, delta: 22, date: '2025-10-12' },
        ],
      },
      {
        id: 'fariha',
        name: 'Fariha Noor',
        handle: 'fariha_nt',
        batch: 18,
        dept: 'CSE',
        squad: 'Trie',
        rating: 2350,
        peak: 2388,
        solved: 2480,
        streak: 32,
        contests: 78,
        skills: ['CP', 'Math', 'DP'],
        bio: 'PhD student in approximation algorithms and streaming data structures in Toronto. Happy to review research SOPs and grad school applications.',
        github: 'https://github.com/fariha-noor',
        linkedin: 'https://linkedin.com/in/fariha-noor',
        experience: [
          {
            period: '2022–2023',
            role: 'CP Head',
            summary:
              'Designed advanced number theory and string algorithms workshops for ICPC teams.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 984 (Div. 1)', rank: 92, delta: 41, date: '2025-11-18' },
          { name: 'Codeforces Round 979 (Div. 1)', rank: 185, delta: -7, date: '2025-10-22' },
          { name: 'Pinely Round 4 (Div. 1 + Div. 2)', rank: 121, delta: 26, date: '2025-09-29' },
        ],
      },
      {
        id: 'asif',
        name: 'Asif Mahmud',
        handle: 'asif_infra',
        batch: 16,
        dept: 'EEE',
        squad: 'Graph',
        rating: 1940,
        peak: 1980,
        solved: 1720,
        streak: 0,
        contests: 45,
        skills: ['CP', 'Go', 'Kubernetes', 'Observability'],
        bio: 'Staff Site Reliability Engineer at Monzo Bank in London. Working on high-availability banking infrastructure and Cassandra clusters.',
        github: 'https://github.com/asif-infra',
        linkedin: 'https://linkedin.com/in/asif-mahmud',
        experience: [
          {
            period: '2021–Present',
            role: 'Staff SRE',
            summary: 'Core banking platform reliability and zero-downtime migration architect.',
          },
          {
            period: '2019–2020',
            role: 'VP Engineering',
            summary: 'Coached systems programming cohorts at FECPC.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 975 (Div. 2)', rank: 112, delta: 25, date: '2025-09-12' },
        ],
      },
      {
        id: 'nabila',
        name: 'Nabila Karim',
        handle: 'nabila_sys',
        batch: 17,
        dept: 'CSE',
        squad: 'Heap',
        rating: 2020,
        peak: 2065,
        solved: 1950,
        streak: 8,
        contests: 58,
        skills: ['CP', 'Python', 'ML', 'Recommendation'],
        bio: 'Senior ML Engineer at Spotify in Stockholm building personalized audio recommendation engines. Former ICPC Asia-West finalist.',
        github: 'https://github.com/nabila-karim',
        linkedin: 'https://linkedin.com/in/nabila-karim',
        experience: [
          {
            period: '2022–Present',
            role: 'Senior ML Engineer',
            summary: 'Scaling multi-armed bandit recommendation algorithms for 500M+ active users.',
          },
          {
            period: '2020–2021',
            role: 'CP Head',
            summary: 'Lead ICPC coach and contest problem setter for FECPC.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 981 (Div. 1)', rank: 178, delta: 18, date: '2025-10-24' },
        ],
      },
      {
        id: 'rifat',
        name: 'Rifat Hasan',
        handle: 'rifat_dev',
        batch: 19,
        dept: 'CSE',
        squad: 'Trie',
        rating: 1780,
        peak: 1812,
        solved: 1420,
        streak: 21,
        contests: 38,
        skills: ['CP', 'TypeScript', 'React', 'Next.js'],
        bio: 'Tech Lead on Pathao Food and courier logistics. Big fan of clean design systems, accessible interfaces, and pragmatic engineering.',
        github: 'https://github.com/rifat-hasan',
        linkedin: 'https://linkedin.com/in/rifat-hasan',
        experience: [
          {
            period: '2023–Present',
            role: 'Tech Lead',
            summary: 'Architected merchant portals and live order tracking systems.',
          },
          {
            period: '2021–2022',
            role: 'General Secretary',
            summary: 'Organized intra-college hackathons and developer summits.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 978 (Div. 2)', rank: 245, delta: 14, date: '2025-10-14' },
        ],
      },
      {
        id: 'mahmud',
        name: 'Mahmudul Hasan',
        handle: 'mahmud_dp',
        batch: 18,
        dept: 'CSE',
        squad: 'Graph',
        rating: 1850,
        peak: 1888,
        solved: 1590,
        streak: 0,
        contests: 49,
        skills: ['CP', 'Java', 'Spring Boot', 'Kafka'],
        bio: 'Backend Engineer in Berlin building high-throughput event streaming systems and global inventory ledgers.',
        github: 'https://github.com/mahmud-hasan',
        linkedin: 'https://linkedin.com/in/mahmud-hasan',
        experience: [
          {
            period: '2022–Present',
            role: 'Backend Engineer',
            summary: 'High-scale order dispatching and distributed event pipelines.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 976 (Div. 2)', rank: 198, delta: 16, date: '2025-09-22' },
        ],
      },
      {
        id: 'nusrat_al',
        name: 'Nusrat Jahan',
        handle: 'nusrat_cloud',
        batch: 19,
        dept: 'EEE',
        squad: 'Heap',
        rating: 1910,
        peak: 1955,
        solved: 1680,
        streak: 11,
        contests: 52,
        skills: ['CP', 'C#', 'Azure', 'Cloud'],
        bio: 'Software Engineer at Microsoft Cloud & AI in Redmond. Working on Azure resource management and distributed lock services.',
        github: 'https://github.com/nusrat-jahan',
        linkedin: 'https://linkedin.com/in/nusrat-jahan',
        experience: [
          {
            period: '2023–Present',
            role: 'Software Engineer',
            summary: 'Azure hyper-scale control plane and multi-tenant resource orchestration.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 982 (Div. 2)', rank: 74, delta: 35, date: '2025-11-12' },
        ],
      },
      {
        id: 'tanim',
        name: 'Tanimul Haque',
        handle: 'tanim_tree',
        batch: 20,
        dept: 'CSE',
        squad: 'Trie',
        rating: 1690,
        peak: 1725,
        solved: 1310,
        streak: 4,
        contests: 34,
        skills: ['CP', 'Node.js', 'PostgreSQL', 'Full-stack'],
        bio: 'Engineering Manager at Chaldal managing fulfillment automation and cold-chain inventory systems across Bangladesh.',
        github: 'https://github.com/tanim-haque',
        linkedin: 'https://linkedin.com/in/tanim-haque',
        experience: [
          {
            period: '2024–Present',
            role: 'Engineering Manager',
            summary: 'Leading 12 full-stack engineers building warehouse automation software.',
          },
        ],
        contestHistory: [
          { name: 'Codeforces Round 974 (Div. 3)', rank: 45, delta: 48, date: '2025-09-04' },
        ],
      },
      {
        id: 'sabrina',
        name: 'Sabrina Ahmed',
        handle: 'sabrina_robot',
        batch: 20,
        dept: 'CSE',
        squad: 'Graph',
        rating: 1820,
        peak: 1856,
        solved: 1530,
        streak: 0,
        contests: 41,
        skills: ['CP', 'C++', 'ROS', 'SLAM'],
        bio: 'Robotics Software Engineer in Tokyo building autonomous mobile fulfillment robots and warehouse path planning algorithms.',
        github: 'https://github.com/sabrina-ahmed',
        linkedin: 'https://linkedin.com/in/sabrina-ahmed',
        experience: [
          {
            period: '2024–Present',
            role: 'Robotics Engineer',
            summary:
              'Multi-agent pathfinding and dynamic obstacle avoidance in automated warehouses.',
          },
        ],
        contestHistory: [
          { name: 'AtCoder Regular Contest 185', rank: 312, delta: 24, date: '2025-10-18' },
        ],
      },
    ];

    for (const a of seedAlumni) {
      await db.query(
        `insert into users (id, email, pass_hash, role, name, handle, cf_handle, batch, dept, squad, title, rating, cf_rating, peak, solved, problems_solved, streak, current_streak, contests_participated, helper, skills, bio, github_url, linkedin_url, experience, contest_history, progress)
         values ($1, $2, $3, 'alumni', $4, $5, $5, $6, $7, $8, 'Alumni', $9, $9, $10, $11, $11, $12, $12, $13, 120, $14, $15, $16, $17, $18::jsonb, $19::jsonb, '{}'::jsonb)
         on conflict (id) do nothing`,
        [
          a.id,
          `${a.id}@fecpc.example`,
          hash,
          a.name,
          a.handle,
          a.batch,
          a.dept,
          a.squad,
          a.rating,
          a.peak,
          a.solved,
          a.streak,
          a.contests,
          a.skills,
          a.bio,
          a.github,
          a.linkedin,
          JSON.stringify(a.experience),
          JSON.stringify(a.contestHistory),
        ],
      );
    }

    // Backfill rich resume data for key seeded active members if missing.
    const profileSeed: Record<
      string,
      {
        bio: string;
        contests: number;
        github: string;
        linkedin: string;
        experience: { period: string; role: string; summary: string }[];
        contestHistory: { name: string; rank: number; delta: number; date: string }[];
      }
    > = {
      nadia: {
        bio: 'CP Head at FECPC. Obsessed with shortest paths, tree DP, and helping Batch 24–25 members reach Specialist cleanly.',
        contests: 42,
        github: 'https://github.com/nadia-rahman',
        linkedin: 'https://linkedin.com/in/nadia-rahman',
        experience: [
          {
            period: '2025–2026',
            role: 'CP Head',
            summary:
              'Runs weekly club contests, curates the DP Bootcamp, and coordinates ICPC mock replays.',
          },
          {
            period: '2024–2025',
            role: 'Trainer',
            summary: 'Coached 12 freshmen from C++ basics to 1400+ rating on Codeforces.',
          },
        ],
        contestHistory: [
          { name: 'Weekly Club Contest #41', rank: 1, delta: 24, date: '2026-11-09' },
          { name: 'Codeforces Round 985 (Div. 1 + 2)', rank: 412, delta: 18, date: '2026-11-01' },
          { name: 'ICPC Mock #2 (Dhaka replay)', rank: 3, delta: 15, date: '2026-10-11' },
          { name: 'Codeforces Round 981 (Div. 2)', rank: 184, delta: -12, date: '2026-10-03' },
          { name: 'Weekly Club Contest #38', rank: 1, delta: 21, date: '2026-10-05' },
        ],
      },
      tanvir: {
        bio: 'President of FECPC. Builds judge-sync tooling, coaches ICPC teams, and enjoys number theory & combinatorics.',
        contests: 48,
        github: 'https://github.com/tnv-exe',
        linkedin: 'https://linkedin.com/in/tanvir-ahmed',
        experience: [
          {
            period: '2025–2026',
            role: 'President',
            summary:
              'Oversees club governance, sponsor partnerships, and the annual intra-college contest.',
          },
          {
            period: '2024–2025',
            role: 'CP Head',
            summary: 'Launched judge-sync and automated sheet tracking across Codeforces and CSES.',
          },
        ],
        contestHistory: [
          { name: 'Weekly Club Contest #40', rank: 1, delta: 19, date: '2026-11-02' },
          { name: 'Codeforces Round 983 (Div. 2)', rank: 205, delta: 22, date: '2026-10-20' },
          { name: 'ICPC Mock #2 (Dhaka replay)', rank: 2, delta: 11, date: '2026-10-11' },
        ],
      },
      sadia: {
        bio: 'General Secretary & full-stack builder behind clubOS. Bridges competitive programming fundamentals with real web systems.',
        contests: 36,
        github: 'https://github.com/sadia-codes',
        linkedin: 'https://linkedin.com/in/sadia-islam',
        experience: [
          {
            period: '2025–2026',
            role: 'General Secretary',
            summary: 'Coordinates club events, onboarding cohorts, and clubOS engineering.',
          },
        ],
        contestHistory: [
          { name: 'Weekly Club Contest #39', rank: 1, delta: 27, date: '2026-10-19' },
          { name: 'Educational Round 172', rank: 512, delta: -8, date: '2026-10-08' },
        ],
      },
      mehedi: {
        bio: 'Training Lead from EEE. Segment trees, Fenwick trees, and stress-testing enthusiasts welcome.',
        contests: 39,
        github: 'https://github.com/mh-segtree',
        linkedin: 'https://linkedin.com/in/mehedi-hasan',
        experience: [
          {
            period: '2025–2026',
            role: 'Trainer',
            summary: 'Leads C++ from zero and coaches Batch 24–25 study cohorts.',
          },
        ],
        contestHistory: [
          { name: 'ICPC Mock #2 (Dhaka replay)', rank: 1, delta: 32, date: '2026-10-11' },
          { name: 'Weekly Club Contest #41', rank: 4, delta: 9, date: '2026-11-09' },
        ],
      },
    };

    for (const [uid, p] of Object.entries(profileSeed)) {
      await db.query(
        `update users set bio = coalesce(bio, $2), contests_participated = case when contests_participated = 0 then $3 else contests_participated end,
          github_url = coalesce(github_url, $4), linkedin_url = coalesce(linkedin_url, $5),
          experience = case when experience = '[]'::jsonb then $6::jsonb else experience end,
          contest_history = case when contest_history = '[]'::jsonb then $7::jsonb else contest_history end
         where id = $1`,
        [
          uid,
          p.bio,
          p.contests,
          p.github,
          p.linkedin,
          JSON.stringify(p.experience),
          JSON.stringify(p.contestHistory),
        ],
      );
    }

    // Update alumni fields (location, role, availability)
    const alumniMeta: Record<string, { location: string; available: boolean; title: string }> = {
      shahriar: {
        location: 'Dhaka · Hybrid',
        available: true,
        title: 'Software Engineer · Northwind Labs',
      },
      tahmina: { location: 'Singapore', available: true, title: 'ML Engineer · Kite Analytics' },
      fariha: {
        location: 'Toronto, Canada',
        available: false,
        title: 'PhD Researcher · University of Toronto',
      },
      asif: { location: 'London, UK', available: true, title: 'Staff SRE · Monzo Bank' },
      nabila: {
        location: 'Stockholm, Sweden',
        available: true,
        title: 'Senior ML Engineer · Spotify',
      },
      rifat: { location: 'Dhaka, Bangladesh', available: true, title: 'Tech Lead · Pathao' },
      mahmud: {
        location: 'Berlin, Germany',
        available: false,
        title: 'Backend Engineer · Delivery Hero',
      },
      nusrat_al: {
        location: 'Seattle, USA',
        available: true,
        title: 'Software Engineer · Microsoft',
      },
      tanim: {
        location: 'Dhaka, Bangladesh',
        available: true,
        title: 'Engineering Manager · Chaldal',
      },
      sabrina: { location: 'Tokyo, Japan', available: false, title: 'Robotics Engineer · Rakuten' },
    };
    for (const [uid, m] of Object.entries(alumniMeta)) {
      await db.query(
        `update users set location = $2, available_for_questions = $3, role = 'alumni', title = $4 where id = $1`,
        [uid, m.location, m.available, m.title],
      );
    }

    // Seed initial alumni jobs once (ensure comprehensive jobs across types, filters, and sources)
    const jobsCount = Number(
      (await db.query(`select count(*)::int as c from alumni_jobs`)).rows[0]?.c ?? 0,
    );
    if (jobsCount < 8) {
      await db.query(`delete from alumni_jobs`);
      await db.query(
        `insert into alumni_jobs (
           alumni_id, company, role, title, location, url, source, vacancies, job_type, experience, salary, description, responsibilities, requirements, deadline, company_logo_url, fetched_at, posted_at, created_at
         ) values
         ('shahriar', 'Northwind Labs', 'Frontend Engineer', 'Frontend Engineer', 'Dhaka · Hybrid', 'https://example.com/careers/frontend-engineer', 'manual', 3, 'Full-time', '2–4 years', '৳70k–110k',
          'Northwind Labs builds logistics tooling for fast-growing retailers. You will join the product team that owns the customer-facing dashboard, working closely with designers and backend engineers to ship weekly.',
          '["Build and maintain React interfaces used by thousands of daily users", "Turn designs into accessible, responsive components", "Review code and help raise the engineering bar", "Work with analysts to instrument and improve key flows"]'::jsonb,
          '["2+ years of professional experience with React and TypeScript", "Solid grasp of HTML, CSS and browser performance", "Comfortable writing tests and working in a code-review culture", "Clear written and spoken English"]'::jsonb,
          current_date + interval '12 days', null, null, now() - interval '3 days', now() - interval '3 days'),

         ('tahmina', 'Kite Analytics', 'Data Analyst Intern', 'Data Analyst Intern', 'Remote', 'https://example.com/jobs/data-intern', 'manual', 5, 'Internship', 'Fresh graduates', 'Stipend ৳20k',
          'A 6-month internship on our analytics team. You will clean data, build dashboards and present findings to clients. Strong performers are offered full-time roles.',
          '["Clean and validate datasets in SQL and Python", "Build dashboards for client reporting", "Present weekly insights to the team"]'::jsonb,
          '["Final-year student or recent graduate in a quantitative field", "SQL and basic Python", "Curiosity and attention to detail"]'::jsonb,
          current_date + interval '6 days', null, null, now() - interval '2 days', now() - interval '2 days'),

         ('asif', 'Monzo Bank', 'Site Reliability Engineer', 'Site Reliability Engineer', 'London, UK · Remote', 'https://example.com/monzo/sre', 'manual', 2, 'Full-time', '3–6 years', '£85k–105k',
          'Build resilient distributed banking infrastructure supporting 9 million customers. Work with Kubernetes, Go microservices, and Cassandra at scale.',
          '["Maintain multi-region Kubernetes clusters across AWS", "Design automated canary deployments and chaos experiments", "Scale low-latency event-driven ledgers"]'::jsonb,
          '["Deep experience with Linux, networking and containers", "Proficiency in Go or Python", "Familiarity with distributed data stores"]'::jsonb,
          current_date + interval '18 days', null, null, now() - interval '1 day', now() - interval '1 day'),

         ('rifat', 'Pathao', 'Senior Full Stack Engineer', 'Senior Full Stack Engineer', 'Dhaka · On-site', 'https://example.com/pathao/senior-fs', 'manual', 2, 'Full-time', '3+ years', '৳130k–180k',
          'Join Pathao Logistics core team powering nationwide deliveries. You will architect high-scale merchant APIs, dispatch algorithms, and courier apps.',
          '["Design clean TypeScript/Node.js microservices", "Build responsive Next.js web applications for merchant dashboards", "Optimize high-throughput PostgreSQL queries"]'::jsonb,
          '["3+ years building production web applications", "Strong foundation in relational databases and indexing", "Track record of delivering complex product features"]'::jsonb,
          current_date + interval '14 days', null, null, now() - interval '4 days', now() - interval '4 days'),

         ('tanim', 'Chaldal', 'Frontend Engineer (React)', 'Frontend Engineer (React)', 'Dhaka · Hybrid', 'https://example.com/chaldal/frontend', 'manual', 3, 'Full-time', '1–3 years', '৳65k–95k',
          'Work on the fastest grocery delivery web platform in Bangladesh. Focus on instantaneous search, PWA performance, and offline cart sync.',
          '["Implement user-facing features in React and TypeScript", "Improve bundle sizes, Core Web Vitals, and rendering speeds", "Collaborate with UX designers to refine checkout flows"]'::jsonb,
          '["Proficiency in React, modern JavaScript, and CSS layout", "Understanding of state management and API integration", "Eager to learn and ship weekly"]'::jsonb,
          current_date + interval '9 days', null, null, now() - interval '2 days', now() - interval '2 days'),

         ('shahriar', 'Brightpath Systems', 'Backend Engineer (Go)', 'Backend Engineer (Go)', 'Singapore', 'https://example.com/brightpath/backend-go', 'fetched', 2, 'Full-time', '3+ years', null,
          'Design and scale payment-processing services handling millions of requests a day. Brightpath is a remote-friendly team across three time zones.',
          '["Design, build and operate Go microservices", "Improve reliability, observability and latency", "Take part in on-call rotation"]'::jsonb,
          '["3+ years of backend development, ideally with Go", "Experience with PostgreSQL and message queues", "Understanding of distributed systems"]'::jsonb,
          current_date + interval '20 days', null, now() - interval '6 hours', now() - interval '6 hours', now() - interval '6 hours'),

         ('nabila', 'Spotify', 'Distributed Systems Intern', 'Distributed Systems Intern', 'Stockholm, Sweden', 'https://example.com/spotify/systems-intern', 'fetched', 4, 'Internship', 'Students / Grads', 'Stipend €3,500/mo',
          'Spend the summer working inside Spotify Platform engineering on audio transcoding clusters and global CDN caching pipelines.',
          '["Contribute to open-source streaming infrastructure", "Instrument performance metrics and benchmarking suites", "Participate in engineering architecture reviews"]'::jsonb,
          '["Currently enrolled in or recently graduated with CS or EE degree", "Good understanding of concurrency and data structures", "Curiosity about music streaming at scale"]'::jsonb,
          current_date + interval '25 days', null, now() - interval '12 hours', now() - interval '12 hours', now() - interval '12 hours'),

         ('shahriar', 'Lumen Studio', 'Product Designer', 'Product Designer', 'Dhaka', 'https://example.com/lumen/product-designer', 'fetched', 1, 'Contract', '3–5 years', null,
          'A six-month contract to lead the redesign of a consumer fintech app. Work directly with the founders from research to hand-off.',
          '["Lead end-to-end design for the mobile app", "Run user interviews and usability tests", "Maintain the design system"]'::jsonb,
          '["Portfolio showing shipped mobile products", "Fluent in Figma", "Experience running research"]'::jsonb,
          current_date + interval '3 days', null, now() - interval '8 hours', now() - interval '8 hours', now() - interval '8 hours'),

         ('fariha', 'Orbital AI', 'Machine Learning Engineer', 'Machine Learning Engineer', 'Toronto · Remote OK', 'https://example.com/orbital/ml-engineer', 'fetched', 2, 'Full-time', '2+ years', null,
          'Help train and deploy ranking and recommendation models for a growing marketplace.',
          '["Train, evaluate and ship ML models to production", "Own data pipelines and experiment tracking", "Collaborate with product on measurable outcomes"]'::jsonb,
          '["2+ years of applied ML experience", "Python, PyTorch or similar", "Experience deploying models to production"]'::jsonb,
          current_date + interval '30 days', null, now() - interval '10 hours', now() - interval '10 hours', now() - interval '10 hours'),

         ('tahmina', 'Shopee APAC', 'Algorithm Engineer', 'Algorithm Engineer', 'Singapore', 'https://example.com/shopee/algo-engineer', 'fetched', 2, 'Full-time', '2+ years', 'S$8,000–11,000/mo',
          'Optimize search relevance, product recommendations, and real-time ad bidding for Southeast Asia e-commerce platform.',
          '["Design and evaluate ranking algorithms", "Conduct A/B tests on live production traffic", "Work with massive distributed vector databases"]'::jsonb,
          '["Strong background in algorithms and machine learning", "Fluency in C++ or Python", "Experience with large-scale data processing"]'::jsonb,
          current_date + interval '16 days', null, now() - interval '14 hours', now() - interval '14 hours', now() - interval '14 hours'),

         ('shahriar', 'CloudScale BD', 'Infrastructure Engineer', 'Infrastructure Engineer', 'Dhaka', 'https://example.com/jobs/cloudscale-infra', 'manual', 1, 'Full-time', '2+ years', '৳90k–130k',
          'Applications closed for this past posting.',
          '["Maintain Kubernetes clusters", "Monitor telemetry"]'::jsonb,
          '["Linux fundamentals", "Docker & Kubernetes"]'::jsonb,
          current_date - interval '2 days', null, null, now() - interval '15 days', now() - interval '15 days')`,
      );
    }

    // Seed interview prep once; after that the CP head and president own it through the roadmap editor.
    if ((await db.query(`select 1 from interview_roadmaps limit 1`)).rowCount === 0) {
      await db.query(`
          insert into interview_roadmaps (id, name, description, created_by) values
          (1, 'Data structures & algorithms', 'NeetCode 150 and Blind 75 topics.', 'nadia')
          on conflict (id) do nothing
        `);
      await db.query(
        `select setval('interview_roadmaps_id_seq', (select max(id) from interview_roadmaps))`,
      );
      await db.query(`
          insert into interview_topics (id, name, description, created_by, order_index) values
          (1, 'Arrays & Hashing', 'Core frequency counting, prefix sums, and two-pass techniques', 'shahriar', 1),
          (2, 'Two Pointers', 'Shrinking windows, meeting in the middle, and palindromes', 'fariha', 2),
          (3, 'Sliding Window', 'Dynamic length windows and maximum sum subarrays', 'shahriar', 3),
          (4, 'Stack', 'Monotonic stacks, parentheses matching, and evaluation', 'tahmina', 4),
          (5, 'Binary Search', 'Search space reduction, lower/upper bounds, and answer bisection', 'shahriar', 5),
          (6, 'Linked List', 'Fast and slow pointers, reversals, and cycle detection', 'tahmina', 6),
          (7, 'Trees', 'DFS/BFS traversals, BST properties, and lowest common ancestor', 'shahriar', 7),
          (8, 'Tries', 'Prefix trees, autocomplete, and XOR maximizes', 'fariha', 8),
          (9, 'Graphs', 'Topological sort, Dijkstra, and connected components', 'shahriar', 9),
          (10, 'Dynamic Programming', 'State transition equations, knapsack, and sequence matching', 'tahmina', 10)
          on conflict (id) do nothing
        `);
      // Lay the seeded topics out as a tree in roadmap 1 (ids above).
      await db.query(`
          update interview_topics t set roadmap_id = 1, parent_id = v.parent, x = v.x, y = v.y
          from (values (1, null::int, 400, 40), (2, 1, 160, 180), (4, 1, 640, 180), (3, 2, 40, 320),
                       (6, 2, 280, 320), (5, 4, 640, 320), (7, 6, 280, 460), (8, 7, 160, 600),
                       (9, 7, 400, 600), (10, 9, 400, 740)) v(id, parent, x, y)
          where t.id = v.id
        `);
      await db.query(`update interview_topics set roadmap_id = 1 where roadmap_id is null`);
      // Update sequence
      await db.query(
        `select setval('interview_topics_id_seq', (select max(id) from interview_topics))`,
      );

      const problemsCount = Number(
        (await db.query(`select count(*)::int as c from interview_problems`)).rows[0]?.c ?? 0,
      );
      if (problemsCount < 40) {
        await db.query(`delete from interview_user_progress`);
        await db.query(`delete from interview_problems`);
        await db.query(`
            insert into interview_problems (topic_id, title, url, difficulty, created_by) values
            -- 1. Arrays & Hashing
            (1, 'Two Sum', 'https://leetcode.com/problems/two-sum/', 'easy', 'shahriar'),
            (1, 'Valid Anagram', 'https://leetcode.com/problems/valid-anagram/', 'easy', 'shahriar'),
            (1, 'Group Anagrams', 'https://leetcode.com/problems/group-anagrams/', 'medium', 'shahriar'),
            (1, 'Top K Frequent Elements', 'https://leetcode.com/problems/top-k-frequent-elements/', 'medium', 'tahmina'),
            (1, 'Product of Array Except Self', 'https://leetcode.com/problems/product-of-array-except-self/', 'medium', 'shahriar'),
            (1, 'Valid Sudoku', 'https://leetcode.com/problems/valid-sudoku/', 'medium', 'tahmina'),
            (1, 'Longest Consecutive Sequence', 'https://leetcode.com/problems/longest-consecutive-sequence/', 'medium', 'asif'),

            -- 2. Two Pointers
            (2, 'Valid Palindrome', 'https://leetcode.com/problems/valid-palindrome/', 'easy', 'fariha'),
            (2, 'Two Sum II - Input Array Is Sorted', 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', 'medium', 'fariha'),
            (2, '3Sum', 'https://leetcode.com/problems/3sum/', 'medium', 'shahriar'),
            (2, 'Container With Most Water', 'https://leetcode.com/problems/container-with-most-water/', 'medium', 'shahriar'),
            (2, 'Trapping Rain Water', 'https://leetcode.com/problems/trapping-rain-water/', 'hard', 'asif'),

            -- 3. Sliding Window
            (3, 'Best Time to Buy and Sell Stock', 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', 'easy', 'rifat'),
            (3, 'Longest Substring Without Repeating Characters', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', 'medium', 'shahriar'),
            (3, 'Longest Repeating Character Replacement', 'https://leetcode.com/problems/longest-repeating-character-replacement/', 'medium', 'asif'),
            (3, 'Permutation in String', 'https://leetcode.com/problems/permutation-in-string/', 'medium', 'tahmina'),
            (3, 'Minimum Window Substring', 'https://leetcode.com/problems/minimum-window-substring/', 'hard', 'fariha'),

            -- 4. Stack
            (4, 'Valid Parentheses', 'https://leetcode.com/problems/valid-parentheses/', 'easy', 'tahmina'),
            (4, 'Min Stack', 'https://leetcode.com/problems/min-stack/', 'medium', 'shahriar'),
            (4, 'Evaluate Reverse Polish Notation', 'https://leetcode.com/problems/evaluate-reverse-polish-notation/', 'medium', 'rifat'),
            (4, 'Daily Temperatures', 'https://leetcode.com/problems/daily-temperatures/', 'medium', 'nabila'),
            (4, 'Car Fleet', 'https://leetcode.com/problems/car-fleet/', 'medium', 'asif'),
            (4, 'Largest Rectangle in Histogram', 'https://leetcode.com/problems/largest-rectangle-in-histogram/', 'hard', 'fariha'),

            -- 5. Binary Search
            (5, 'Binary Search', 'https://leetcode.com/problems/binary-search/', 'easy', 'shahriar'),
            (5, 'Search a 2D Matrix', 'https://leetcode.com/problems/search-a-2d-matrix/', 'medium', 'asif'),
            (5, 'Koko Eating Bananas', 'https://leetcode.com/problems/koko-eating-bananas/', 'medium', 'tahmina'),
            (5, 'Find Minimum in Rotated Sorted Array', 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/', 'medium', 'nabila'),
            (5, 'Search in Rotated Sorted Array', 'https://leetcode.com/problems/search-in-rotated-sorted-array/', 'medium', 'shahriar'),
            (5, 'Median of Two Sorted Arrays', 'https://leetcode.com/problems/median-of-two-sorted-arrays/', 'hard', 'fariha'),

            -- 6. Linked List
            (6, 'Reverse Linked List', 'https://leetcode.com/problems/reverse-linked-list/', 'easy', 'tahmina'),
            (6, 'Merge Two Sorted Lists', 'https://leetcode.com/problems/merge-two-sorted-lists/', 'easy', 'shahriar'),
            (6, 'Reorder List', 'https://leetcode.com/problems/reorder-list/', 'medium', 'rifat'),
            (6, 'Remove Nth Node From End of List', 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/', 'medium', 'asif'),
            (6, 'Linked List Cycle', 'https://leetcode.com/problems/linked-list-cycle/', 'easy', 'tahmina'),
            (6, 'LRU Cache', 'https://leetcode.com/problems/lru-cache/', 'medium', 'nabila'),

            -- 7. Trees
            (7, 'Invert Binary Tree', 'https://leetcode.com/problems/invert-binary-tree/', 'easy', 'shahriar'),
            (7, 'Maximum Depth of Binary Tree', 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', 'easy', 'rifat'),
            (7, 'Diameter of Binary Tree', 'https://leetcode.com/problems/diameter-of-binary-tree/', 'easy', 'asif'),
            (7, 'Balanced Binary Tree', 'https://leetcode.com/problems/balanced-binary-tree/', 'easy', 'tahmina'),
            (7, 'Same Tree', 'https://leetcode.com/problems/same-tree/', 'easy', 'shahriar'),
            (7, 'Subtree of Another Tree', 'https://leetcode.com/problems/subtree-of-another-tree/', 'easy', 'nabila'),
            (7, 'Lowest Common Ancestor of BST', 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/', 'medium', 'shahriar'),
            (7, 'Binary Tree Level Order Traversal', 'https://leetcode.com/problems/binary-tree-level-order-traversal/', 'medium', 'tahmina'),
            (7, 'Validate BST', 'https://leetcode.com/problems/validate-binary-search-tree/', 'medium', 'fariha'),
            (7, 'Kth Smallest Element in BST', 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/', 'medium', 'asif'),

            -- 8. Tries
            (8, 'Implement Trie (Prefix Tree)', 'https://leetcode.com/problems/implement-trie-prefix-tree/', 'medium', 'fariha'),
            (8, 'Design Add and Search Words Data Structure', 'https://leetcode.com/problems/design-add-and-search-words-data-structure/', 'medium', 'fariha'),
            (8, 'Word Search II', 'https://leetcode.com/problems/word-search-ii/', 'hard', 'fariha'),

            -- 9. Graphs
            (9, 'Number of Islands', 'https://leetcode.com/problems/number-of-islands/', 'medium', 'shahriar'),
            (9, 'Clone Graph', 'https://leetcode.com/problems/clone-graph/', 'medium', 'asif'),
            (9, 'Max Area of Island', 'https://leetcode.com/problems/max-area-of-island/', 'medium', 'rifat'),
            (9, 'Pacific Atlantic Water Flow', 'https://leetcode.com/problems/pacific-atlantic-water-flow/', 'medium', 'nabila'),
            (9, 'Rotting Oranges', 'https://leetcode.com/problems/rotting-oranges/', 'medium', 'tahmina'),
            (9, 'Course Schedule', 'https://leetcode.com/problems/course-schedule/', 'medium', 'shahriar'),
            (9, 'Course Schedule II', 'https://leetcode.com/problems/course-schedule-ii/', 'medium', 'asif'),
            (9, 'Redundant Connection', 'https://leetcode.com/problems/redundant-connection/', 'medium', 'fariha'),

            -- 10. Dynamic Programming
            (10, 'Climbing Stairs', 'https://leetcode.com/problems/climbing-stairs/', 'easy', 'tahmina'),
            (10, 'Min Cost Climbing Stairs', 'https://leetcode.com/problems/min-cost-climbing-stairs/', 'easy', 'rifat'),
            (10, 'House Robber', 'https://leetcode.com/problems/house-robber/', 'medium', 'shahriar'),
            (10, 'House Robber II', 'https://leetcode.com/problems/house-robber-ii/', 'medium', 'asif'),
            (10, 'Coin Change', 'https://leetcode.com/problems/coin-change/', 'medium', 'tahmina'),
            (10, 'Longest Increasing Subsequence', 'https://leetcode.com/problems/longest-increasing-subsequence/', 'medium', 'fariha'),
            (10, 'Word Break', 'https://leetcode.com/problems/word-break/', 'medium', 'nabila'),
            (10, 'Unique Paths', 'https://leetcode.com/problems/unique-paths/', 'medium', 'shahriar')
          `);
      }

      const tipsCount = Number(
        (await db.query(`select count(*)::int as c from interview_tips`)).rows[0]?.c ?? 0,
      );
      if (tipsCount < 10) {
        await db.query(`delete from interview_tips`);
        await db.query(`
            insert into interview_tips (author_id, topic_id, title, body_md) values
            ('shahriar', 1, 'Hash tables vs arrays in competitive interviews', 'When problem constraints have numbers up to 10^5, direct index arrays are 10x faster than unordered_map and guarantee O(1) without hash collision edge cases in C++.'),
            ('fariha', 2, 'Two-pointer invariant proofs in whiteboard interviews', 'Always state your invariant aloud before writing code: "left points to smallest remaining candidate, right points to largest". This builds immense confidence with your interviewer.'),
            ('asif', 3, 'Sliding window template: dynamic vs fixed windows', 'Always establish whether your window expands unconditionally and shrinks on invalidation, or stays fixed size. Write down what count/frequency data structure maintains validity in O(1).'),
            ('tahmina', 4, 'The 3 rules of monotonic stacks', 'When you see "next greater element" or "largest rectangle under histogram", think monotonic stack immediately. Decide whether elements in the stack are strictly increasing or non-decreasing.'),
            ('nabila', 5, 'Binary search predicate functions: never write off-by-one errors again', 'Instead of testing nums[mid] == target, design a monotonic predicate ok(x) returning true/false. Set lo to lowest possible, hi to highest possible, and shrink using mid = lo + (hi - lo) / 2.'),
            ('shahriar', 7, 'Tree traversals without recursion using explicit stacks', 'Interviewers frequently follow up with: "Can you do this iteratively without consuming the call stack?" Knowing DFS with std::stack<TreeNode*> and level-order with std::queue<TreeNode*> is mandatory.'),
            ('rifat', 9, 'BFS vs Dijkstra: when edge weights are uniform', 'If all edges have weight 1 (like unweighted grid problems), standard queue BFS runs in O(V + E) and is 5x faster than Dijkstra heap overhead. Reserve Dijkstra strictly for weighted graphs.'),
            ('tahmina', 10, 'Identifying the 4 standard DP transition recurrence structures', 'Most interview DP falls into 4 buckets: (1) 1D linear prefix, (2) 2D grid walk, (3) 0/1 knapsack choice, (4) string interval matching (LCS/edit distance). Learn the shape of each table.'),
            ('shahriar', null, 'How I structured 6 weeks of SWE interview prep after ICPC', 'Transitioning from 2000+ Codeforces rating to backend SWE loops: coding rounds were easy, but communication, testing, and clean architecture were where I needed deliberate practice.'),
            ('tahmina', null, 'Machine learning coding & probability checklist for new grads', 'Here are the exact probability, matrix manipulation, and PyTorch debugging patterns asked across Grab, Stripe and Shopee APAC rounds.'),
            ('fariha', null, 'Grad school SOPs: highlighting ICPC achievements without sounding one-dimensional', 'Admissions committees value research curiosity over sheer contest badges. Here is how I reframed my algorithmic contest training into evidence of mathematical maturity.'),
            ('asif', null, 'Navigating the London tech market from Bangladesh: visas and interviews', 'How Skilled Worker sponsorship works in the UK, what engineering hiring committees look for in remote applicants, and how to negotiate base salary and equity.'),
            ('rifat', null, 'System design round survival guide: pacing the 45-minute whiteboard', 'Step 1: 5 mins functional & non-functional requirements. Step 2: 5 mins back-of-the-envelope math. Step 3: 15 mins high-level diagram. Step 4: 15 mins deep-dive bottlenecks. Step 5: 5 mins recap.')
          `);
      }
    }

    // Seed blog posts (ensure rich selection of published articles across topics + 1 draft)
    const blogsCount = Number(
      (await db.query(`select count(*)::int as c from blog_posts`)).rows[0]?.c ?? 0,
    );
    if (blogsCount < 6) {
      await db.query(`delete from blog_posts`);
      const p1 =
        '## The Journey from Lab 3\n\nWhen we first started solving problems in 2017, we did not have a roadmap or seniors in top-tier global teams. We had a battered desktop in Lab 3 and the Codeforces problemset.\n\n### What CP teaches you\n\n- Speed of implementation\n- Edge-case paranoia (empty lists, integer overflow, zeroes)\n- Deep intuition for complexity (O(N) vs O(N log N))\n\n> The hardest part of the interview was not the dynamic programming problem. It was explaining my thought process out loud before writing a single line of code.\n\n### The Communication Gap\n\nIn contests, silence is golden. In SWE interviews, silence is failure. Practice mock interviews with your squadmates where you explain your brute force, your optimal intuition, and your space-time tradeoffs.';
      const p2 =
        "## The Double-Click Dilemma\n\nIn consumer payments, users tap 'Confirm' twice when network latency is high. If your API is not strictly idempotent, you will debit their wallet twice.\n\n### Key Principles\n\n1. **Client-generated Idempotency-Key**: Require a UUID on all mutating POST requests.\n2. **Database unique constraints**: Never rely solely on application memory locks. Use database partial unique indexes.\n3. **Atomic ledger mutations**: Keep debit and credit in the same ACID transaction block.\n\n```sql\nCREATE UNIQUE INDEX payments_trx_live ON payments (trx) WHERE status <> 'rejected';\n```\n\nIdempotency is not an afterthought; it is the core foundation of financial software.";
      const p3 =
        "## 1. Contests Have Answers; Research Might Not\n\nIn a contest, every problem has an intended solution that fits within 2.0 seconds and 256MB. In research, you might spend three months proving a problem is NP-hard or has no subquadratic approximation.\n\n## 2. Reading Papers is a Distinct Skill\n\nDon't read papers linearly from start to finish. Read the abstract, look at the theorems, understand the definitions, and then read the proof sketches.\n\n## 3. Write Early and Often\n\nWriting clarifies thinking. Even if your proof has holes, putting it into LaTeX forces precision.";
      const p4 =
        '## The 6-Month Blueprint\n\nBreaking through the 1400–1600 plateau requires shifting from quantity to quality:\n\n1. **Virtual Contests Only**: Stop cherry-picking problems from the catalog. Sit down for 2 hours uninterrupted.\n2. **Upsolve One Problem**: Always solve the first problem you failed to solve during the contest.\n3. **Theme Weeks**: Dedicate 7 full days to binary search on answers, then 7 days to tree DFS, then 7 days to prefix sums.';
      const p5 =
        '## Scaling to 50k Concurrent Scoreboard Viewers\n\nDuring regional contests, thousands of students reload the standings page every 3 seconds.\n\n### Why PostgreSQL Crumbled\n\n`ORDER BY solved DESC, penalty ASC` across 5,000 teams on every HTTP request created massive disk I/O spikes.\n\n### The Redis Solution\n\nWe shifted the live standings to Redis Sorted Sets with composite score encoding:\n\n```text\nscore = (solved * 10^9) + (10^8 - penalty_seconds)\n```\n\n`ZREVRANGEBYSCORE` runs in O(log N + M) and returned in under 1.2ms!';
      const p6 =
        '## From Contest Habits to Clean Code\n\nWhen you start your first SWE job, your senior engineer will reject your PR if you use single-letter variables like `n`, `m`, `ans`, `dp`.\n\nIn industry, code is read 100 times more often than it is written. Variable names should explain intent, functions should fit on one screen, and edge cases should have dedicated unit tests.';
      const p7 =
        '## Draft Notes\n\n1. AI assistants are table stakes; candidates who understand the generated code deeply stand out.\n2. Concurrency and network fundamentals are tested more rigorously than obscure graph algorithms.';

      await db.query(
        `insert into blog_posts (author_id, slug, title, subtitle, excerpt, body_md, cover_url, tags, status, published_at, views) values
         ('shahriar', 'how-i-got-my-first-faang-offer', 'How I got my first FAANG offer', 'From late nights in Lab 3 to passing the Google APAC SWE coding loops.',
          'Reflections on four years of competitive programming at FECPC and what actually mattered when interviewing with global engineering teams.',
          $1, null, '["interview", "career"]'::jsonb, 'published', now() - interval '5 days', 142),
         ('tahmina', 'designing-reliable-idempotent-payment-processors', 'Designing reliable idempotent payment processors', 'Avoiding double charges in distributed microservices using PostgreSQL and Redis.',
          'A practical guide to distributed locks, unique constraint ledgers, and transaction isolation levels in high-throughput payment architectures.',
          $2, null, '["systems", "engineering"]'::jsonb, 'published', now() - interval '8 days', 218),
         ('fariha', '5-things-i-wish-i-knew-before-research', '5 things I wish I knew before algorithm research', 'Lessons from my first year as a PhD student in theoretical computer science.',
          'Moving from competitive programming problems with guaranteed solutions to open research questions with uncertain answers.',
          $3, null, '["career", "stories"]'::jsonb, 'published', now() - interval '12 days', 95),
         ('asif', 'from-1200-to-1900-codeforces-blueprint', 'From 1200 to 1900 on Codeforces: The 6-Month Blueprint', 'A structured roadmap for moving past the Specialist rating plateau.',
          'The exact training regimen, topic distribution, and virtual contest habits that got me from Newbie to Candidate Master in 6 months.',
          $4, null, '["algorithms", "career"]'::jsonb, 'published', now() - interval '3 days', 312),
         ('rifat', 'scaling-real-time-leaderboards-50k-users', 'System Design: Scaling real-time leaderboards to 50k concurrent users', 'Architecting low-latency scoreboard streaming with Redis Sorted Sets and WebSockets.',
          'How we handled live contest scoreboard updates during peak regional contests without melting our PostgreSQL database.',
          $5, null, '["systems", "engineering"]'::jsonb, 'published', now() - interval '6 days', 184),
         ('nabila', 'transitioning-from-cp-to-production-go-and-rust', 'Transitioning from CP to Production Go and Rust', 'Unlearning competitive programming habits to write clean, maintainable systems code.',
          'Why global variables, #define int long long, and 100-line main() functions fail code reviews in industry, and how to write idiomatically.',
          $6, null, '["engineering", "algorithms"]'::jsonb, 'published', now() - interval '10 days', 167),
         ('shahriar', 'upcoming-trends-in-apac-tech-hiring', 'Upcoming trends in APAC tech hiring for 2027', 'What engineering leaders in Singapore and Tokyo are looking for in new grads.',
          'Draft notes on AI tooling proficiency, systems fundamentals, and the rising bar for junior software engineers.',
          $7, null, '["career"]'::jsonb, 'draft', null, 0)`,
        [p1, p2, p3, p4, p5, p6, p7],
      );
    }

    // Seed progress & saves so demo profiles display realistic progress
    if (!(await db.query(`select 1 from interview_user_progress limit 1`)).rowCount) {
      await db.query(`
        insert into interview_user_progress (user_id, problem_id)
        select 'tasnim', id from interview_problems where id in (1, 2, 3, 8, 9, 13, 14, 18, 19, 24, 25, 30, 36, 37, 46, 49, 57, 58)
        on conflict do nothing
      `);
      await db.query(`
        insert into interview_user_progress (user_id, problem_id)
        select 'admin', id from interview_problems where id in (1, 2, 3, 4, 8, 9, 10, 13, 14, 15, 18, 19, 20, 24, 25, 26, 30, 31, 36, 37, 38, 46, 47, 49, 50, 51, 57, 58, 59, 60)
        on conflict do nothing
      `);
    }

    if (!(await db.query(`select 1 from alumni_saves limit 1`)).rowCount) {
      await db.query(`
        insert into alumni_saves (user_id, alumni_id) values
        ('anika', 'shahriar'),
        ('anika', 'asif')
        on conflict do nothing
      `);
    }

    // Seed an alumni interview-prep post once so Alumni modal shows real Interview Prep items
    if (!(await db.query(`select 1 from feed_posts where user_id = 'shahriar' limit 1`)).rowCount) {
      await db.query(
        `insert into feed_posts (user_id, title, body_md, category, score, created_at, updated_at) values
         ('shahriar', 'Interview prep: translating CP graph intuition into SWE system design', 'How I structured 6 weeks of interview prep moving from 2000+ CP rating to backend SWE loops: coding rounds, concurrency fundamentals, and clean API walkthroughs.', 'topic', 19, now() - interval '4 days', now() - interval '4 days'),
         ('tahmina', 'Interview prep: ML coding & probability rounds for new grads', 'Checklist of probability, matrix manipulation, and PyTorch debugging questions that show up in ML engineering loops.', 'topic', 15, now() - interval '5 days', now() - interval '5 days')`,
      );
    }
  }

  // First-deploy backfill: ensure existing active members with problems_solved > 0 and no milestones yet
  // receive their current rank/solved milestone so the Feed sidebar is never empty on first deploy.
  await backfillMilestones(db);
  // schema.sql adds its demo rows (waivers, ops board, budgets) only once the demo members exist.
  if (!seededBefore) await applySchema(db);

  return !seededBefore;
}
