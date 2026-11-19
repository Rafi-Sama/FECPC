// Creates the schema and loads the placeholder club, so a fresh database behaves like the demo did.
import { readFileSync } from "node:fs";
import { seedSolved } from "../lib/appdata.ts";
import { members } from "../lib/data.ts";
import type { Role } from "../lib/permissions.ts";
import { hashPassword } from "./auth.ts";
import * as data from "./data.ts";
import type { Db } from "./db.ts";
import { backfillMilestones } from "./milestones.ts";

const roleOf: Record<string, Role> = { President: "president", "CP Head": "cp_head", "General Secretary": "secretary", "Event Secretary": "secretary", Treasurer: "treasurer", Mentor: "mentor" };

export async function setup(db: Db, password: string) {
  await db.query(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
  const seededBefore = (await db.query(`select 1 from users limit 1`)).rowCount! > 0;
  if (!seededBefore) {
    const hash = await hashPassword(password), base = JSON.stringify({ base: { solved: seedSolved.length, done: 1 }, solved: seedSolved, done: ["r1"] });
    for (const m of members)
      await db.query(`insert into users (id, email, pass_hash, role, name, handle, batch, dept, squad, title, rating, peak, solved, problems_solved, streak, helper, skills, progress) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15, $16, $17)`,
        [m.id, `${m.id}@fecpc.example`, hash, roleOf[m.role ?? ""] ?? "member", m.name, m.handle, m.batch, m.dept, m.squad, m.role ?? null, m.rating, m.peak, m.solved, m.streak, m.helper, m.skills, base]);
    await db.query(`insert into users (id, email, pass_hash, role, name, batch, dept, title, system) values ('admin', 'admin@fecpc.example', $1, 'super_admin', 'Site Admin', 0, 'CSE', 'Super Admin', true)`, [hash]);
    await db.query(`update users set mentor_id = 'mehedi' where id = any($1)`, [data.mentees.map((m) => m.id)]);
    for (const x of data.expenses) await db.query(`insert into expenses (by, what, amount, event) values ($1, $2, $3, $4)`, [x.by, x.what, x.amount, x.event]);
    for (const q of data.queue)
      await db.query(`insert into payments (user_id, invoice_id, label, amount, via, trx, sender) values ($1, 'INV-2611', $2, $3, $4, $5, $6)`, [q.who, q.label, q.amount, q.via, q.trx, q.sender.replace(/\D/g, "").padEnd(11, "0")]);
    for (const a of data.applications)
      await db.query(`insert into applications (name, sid, dept, batch, email, track, why, quiz, src) values ($1, $2, $3, $4, $5, 'cp', 'Seeded placeholder application.', $6, $7)`, [a.name, `20${a.batch}-331-0${a.id.slice(2)}`, a.dept, a.batch, `${a.id}@applicant.example`, a.quiz, a.src]);
  }

  // Seed initial Community Feed posts & Ideas once (using non-tasnim authors so member onboarding tests start at 0 earned XP).
  const hasSeedUsers = (await db.query(`select 1 from users where id = 'nadia'`)).rowCount! > 0;
  if (hasSeedUsers && !(await db.query(`select 1 from feed_posts limit 1`)).rowCount) {
    const seedFeed: [string, string, string, string, number, string][] = [
      [
        "nadia",
        "Reached Candidate Master — what finally unlocked 1900+ for me",
        "After three months stuck around 1750, two habits made the difference:\n\n- **Timed virtuals on Div. 2 C/D** with zero editorial peeks for 45 minutes\n- Writing a two-line post-mortem for every WA on graph and DP problems\n\n```cpp\n// Always verify overflow on weighted shortest paths\nusing ll = long long;\nconst ll INF = 4e18;\n```\n\nHappy to share my upsolve sheet with anyone pushing for Expert or CM this term!",
        "problem-solving",
        24,
        "2 hours",
      ],
      [
        "mehedi",
        "DP Sheet Q&A: breaking down state transitions on Vacations (698A) and Boredom (455A)",
        "Several Batch 24 members asked how to choose DP states without getting stuck in greedy traps.\n\n> Rule of thumb: write down what information from prefix `1..i` actually constrains choice `i+1`. Everything else does not belong in the state.\n\nDrop your stuck submission links or state attempts in the comments below and I will walk through them tonight.",
        "upsolving",
        17,
        "3 hours",
      ],
      [
        "rahim",
        "Weekly #42 post-contest recap & tricky edge cases on Problem D",
        "Great turnout for Weekly #42! Problem D (`277A` style DSU component count) caught a lot of teams when **zero languages** were known by every participant.\n\nIf `totalLanguages == 0`, the answer is `n`, not `components - 1`. Upsolving window stays open until Sunday night.",
        "topic",
        14,
        "5 hours",
      ],
      [
        "anika",
        "120-day streak milestone + my quick warm-up routine before classes",
        "Keeping a streak alive during exam week came down to solving one 1000–1200 rated implementation problem right after breakfast before opening anything else.\n\nConsistency beats 6-hour weekend marathons every single time.",
        "problem-solving",
        11,
        "1 day",
      ],
      [
        "shuvo",
        "Shipped Balloon Runner v1.2 for Contest Day volunteers",
        "Updated the offline print & balloon runner checklist for the 18 December intra-college contest:\n\n- Faster desk lookup (`L1-01` .. `L2-24`)\n- Keyboard shortcuts for marking delivered balloons\n- Offline fallback if lab Wi-Fi drops\n\nLet me know if any volunteer spots a UI rough edge.",
        "topic",
        9,
        "2 days",
      ],
    ];
    for (const [uid, title, body, cat, score, ago] of seedFeed) {
      await db.query(
        `insert into feed_posts (user_id, title, body_md, category, score, created_at, updated_at) values ($1, $2, $3, $4, $5, now() - $6::interval, now() - $6::interval)`,
        [uid, title, body, cat, score, ago]
      );
    }
  }

  if (hasSeedUsers && !(await db.query(`select 1 from ideas limit 1`)).rowCount) {
    const seedIdeas: [string, string, string, string, string, string[], string][] = [
      [
        "priya",
        "Need a third for Winter Hack Night: someone who likes frontends",
        "We already have backend + ML covered for **Winter Hack Night** and want a teammate who enjoys crisp UI work (Next.js or plain CSS).\n\nWe are building an automated CP submission visualizer with live contest replay.",
        "teammate",
        "open",
        ["What frontend stack are you comfortable with?", "Share a project or GitHub link (optional)"],
        "2 hours",
      ],
      [
        "zahid",
        "Looking for two for the intra-college contest, rating 900–1200",
        "Forming a balanced Batch 25 team for the 18 December intra-college contest.\n\nPlanning to run two 3-hour gym virtuals together before contest day so we get comfortable sharing one keyboard.",
        "teammate",
        "open",
        ["What is your current Codeforces rating?", "Which topics do you enjoy most?"],
        "5 hours",
      ],
      [
        "shuvo",
        "Game jam team needs a pixel artist who can code a little",
        "Building a 48-hour retro arcade puzzle game for the December club showcase. Engine is already running; looking for someone into sprite design, palettes, and level polish.",
        "teammate",
        "open",
        ["What tools do you use for pixel art?"],
        "1 day",
      ],
      [
        "nadia",
        "Rust for C++ people — hands-on weekend workshop",
        "A 2-hour practical session mapping C++ concepts (references, move semantics, vectors, iterators) directly to Rust ownership and borrowing, with live mini-problems.",
        "idea",
        "planned",
        [],
        "1 day",
      ],
      [
        "mehedi",
        "Competitive debugging session: stress-testing with random generators",
        "Learn how to write a 15-line brute-force checker and bash loop in 3 minutes during a live contest so you never lose 40 minutes staring at an invisible corner case.",
        "study",
        "open",
        ["Which language do you write contests in?"],
        "2 days",
      ],
      [
        "sadia",
        "Women in CP meetup & mentorship circle",
        "Monthly informal problem-solving evening and Q&A with senior female alumni and ICPC regionalists.",
        "idea",
        "shipped",
        [],
        "3 days",
      ],
      [
        "farhan",
        "Resume review night before internship season",
        "Bring a 1-page PDF draft; alumni from Dhaka & remote teams will review structure, project bullets, and CP achievements.",
        "idea",
        "open",
        [],
        "4 days",
      ],
    ];
    for (const [uid, title, body, type, status, roles, ago] of seedIdeas) {
      await db.query(
        `insert into ideas (user_id, title, body_md, type, status, roles, created_at, updated_at) values ($1, $2, $3, $4, $5, $6::jsonb, now() - $7::interval, now() - $7::interval)`,
        [uid, title, body, type, status, JSON.stringify(roles), ago]
      );
    }
    await db.query(
      `insert into idea_interests (idea_id, user_id, response, status, created_at) values
       (1, 'imran', '{"What frontend stack are you comfortable with?":"Next.js, TypeScript, CSS Grid","Share a project or GitHub link (optional)":"github.com/imran-ch"}', 'pending', now() - interval '1 hour'),
       (1, 'nusrat', '{"What frontend stack are you comfortable with?":"React + clean design systems"}', 'accepted', now() - interval '90 minutes'),
       (2, 'mim', '{"What is your current Codeforces rating?":"920","Which topics do you enjoy most?":"Strings & greedy"}', 'pending', now() - interval '3 hours')`
    );
    await db.query(
      `insert into community_comments (target_type, target_id, user_id, body, created_at) values
       ('idea', 1, 'sadia', 'Love this project concept — happy to help test the replay UI!', now() - interval '50 minutes'),
       ('idea', 4, 'rahim', 'Count me in! Ownership vs C++ references is the exact bridge people need.', now() - interval '12 hours')`
    );
  }

  // Seed alumni accounts, rich member profile fields, and alumni jobs idempotently.
  const hasSeedUsersForProfiles = (await db.query(`select 1 from users where id = 'nadia'`)).rowCount! > 0;
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
        id: "shahriar",
        name: "Shahriar Kabir",
        handle: "sk_graphs",
        batch: 16,
        dept: "CSE",
        squad: "Graph",
        rating: 2104,
        peak: 2140,
        solved: 2010,
        streak: 0,
        contests: 64,
        skills: ["CP", "Systems", "Graphs"],
        bio: "Software Engineer at a Dhaka fintech working on payment ledgers and distributed queues. Former FECPC President and two-time ICPC Dhaka Regionalist.",
        github: "https://github.com/shahriar-kabir",
        linkedin: "https://linkedin.com/in/shahriar-kabir",
        experience: [
          { period: "2020–2021", role: "President", summary: "Established the weekly club ladder and mentored the first ICPC regional qualifying trio." },
          { period: "2019–2020", role: "CP Head", summary: "Curated the original green sheet and ran Friday algorithm circles in Lab 3." },
        ],
        contestHistory: [
          { name: "Codeforces Round 982 (Div. 1)", rank: 214, delta: 28, date: "2025-11-12" },
          { name: "Educational Codeforces Round 171", rank: 142, delta: 19, date: "2025-10-28" },
          { name: "Codeforces Global Round 27", rank: 498, delta: -14, date: "2025-10-05" },
          { name: "ICPC Dhaka Regional 2021 (Alumni replay)", rank: 18, delta: 34, date: "2025-09-14" },
        ],
      },
      {
        id: "tahmina",
        name: "Tahmina Akhter",
        handle: "tahmina_ml",
        batch: 17,
        dept: "CSE",
        squad: "Heap",
        rating: 1890,
        peak: 1924,
        solved: 1640,
        streak: 14,
        contests: 51,
        skills: ["CP", "AI/ML", "Math"],
        bio: "ML Engineer at a healthcare startup in Singapore. Focused on clinical NLP, inference optimization, and mentoring club juniors preparing for SWE interviews.",
        github: "https://github.com/tahmina-akhter",
        linkedin: "https://linkedin.com/in/tahmina-akhter",
        experience: [
          { period: "2021–2022", role: "Lead Mentor", summary: "Led Batch 20–21 mentorship circles and authored the club's first DP training guide." },
          { period: "2020–2021", role: "General Secretary", summary: "Organized Intra-College Programming Contest 2021 with 140+ participants." },
        ],
        contestHistory: [
          { name: "Codeforces Round 980 (Div. 2)", rank: 89, delta: 31, date: "2025-11-04" },
          { name: "Codeforces Round 977 (Div. 2)", rank: 310, delta: -9, date: "2025-10-19" },
          { name: "AtCoder Beginner Contest 375", rank: 164, delta: 22, date: "2025-10-12" },
        ],
      },
      {
        id: "fariha",
        name: "Fariha Noor",
        handle: "fariha_nt",
        batch: 18,
        dept: "CSE",
        squad: "Trie",
        rating: 2350,
        peak: 2388,
        solved: 2480,
        streak: 32,
        contests: 78,
        skills: ["CP", "Math", "DP"],
        bio: "PhD student in approximation algorithms and streaming data structures in Toronto. Happy to review research SOPs and grad school applications.",
        github: "https://github.com/fariha-noor",
        linkedin: "https://linkedin.com/in/fariha-noor",
        experience: [
          { period: "2022–2023", role: "CP Head", summary: "Designed advanced number theory and string algorithms workshops for ICPC teams." },
        ],
        contestHistory: [
          { name: "Codeforces Round 984 (Div. 1)", rank: 92, delta: 41, date: "2025-11-18" },
          { name: "Codeforces Round 979 (Div. 1)", rank: 185, delta: -7, date: "2025-10-22" },
          { name: "Pinely Round 4 (Div. 1 + Div. 2)", rank: 121, delta: 26, date: "2025-09-29" },
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
        ]
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
        bio: "CP Head at FECPC. Obsessed with shortest paths, tree DP, and helping Batch 24–25 members reach Specialist cleanly.",
        contests: 42,
        github: "https://github.com/nadia-rahman",
        linkedin: "https://linkedin.com/in/nadia-rahman",
        experience: [
          { period: "2025–2026", role: "CP Head", summary: "Runs weekly club contests, curates the DP Bootcamp, and coordinates ICPC mock replays." },
          { period: "2024–2025", role: "Mentor", summary: "Mentored 12 freshmen from C++ basics to 1400+ rating on Codeforces." },
        ],
        contestHistory: [
          { name: "Weekly Club Contest #41", rank: 1, delta: 24, date: "2026-11-09" },
          { name: "Codeforces Round 985 (Div. 1 + 2)", rank: 412, delta: 18, date: "2026-11-01" },
          { name: "ICPC Mock #2 (Dhaka replay)", rank: 3, delta: 15, date: "2026-10-11" },
          { name: "Codeforces Round 981 (Div. 2)", rank: 184, delta: -12, date: "2026-10-03" },
          { name: "Weekly Club Contest #38", rank: 1, delta: 21, date: "2026-10-05" },
        ],
      },
      tanvir: {
        bio: "President of FECPC. Builds judge-sync tooling, coaches ICPC teams, and enjoys number theory & combinatorics.",
        contests: 48,
        github: "https://github.com/tnv-exe",
        linkedin: "https://linkedin.com/in/tanvir-ahmed",
        experience: [
          { period: "2025–2026", role: "President", summary: "Oversees club governance, sponsor partnerships, and the annual intra-college contest." },
          { period: "2024–2025", role: "CP Head", summary: "Launched judge-sync and automated sheet tracking across Codeforces and CSES." },
        ],
        contestHistory: [
          { name: "Weekly Club Contest #40", rank: 1, delta: 19, date: "2026-11-02" },
          { name: "Codeforces Round 983 (Div. 2)", rank: 205, delta: 22, date: "2026-10-20" },
          { name: "ICPC Mock #2 (Dhaka replay)", rank: 2, delta: 11, date: "2026-10-11" },
        ],
      },
      sadia: {
        bio: "General Secretary & full-stack builder behind clubOS. Bridges competitive programming fundamentals with real web systems.",
        contests: 36,
        github: "https://github.com/sadia-codes",
        linkedin: "https://linkedin.com/in/sadia-islam",
        experience: [
          { period: "2025–2026", role: "General Secretary", summary: "Coordinates club events, onboarding cohorts, and clubOS engineering." },
        ],
        contestHistory: [
          { name: "Weekly Club Contest #39", rank: 1, delta: 27, date: "2026-10-19" },
          { name: "Educational Round 172", rank: 512, delta: -8, date: "2026-10-08" },
        ],
      },
      mehedi: {
        bio: "Lead Mentor from EEE. Segment trees, Fenwick trees, and stress-testing enthusiasts welcome.",
        contests: 39,
        github: "https://github.com/mh-segtree",
        linkedin: "https://linkedin.com/in/mehedi-hasan",
        experience: [
          { period: "2025–2026", role: "Mentor", summary: "Leads C++ from zero and mentors Batch 24–25 study cohorts." },
        ],
        contestHistory: [
          { name: "ICPC Mock #2 (Dhaka replay)", rank: 1, delta: 32, date: "2026-10-11" },
          { name: "Weekly Club Contest #41", rank: 4, delta: 9, date: "2026-11-09" },
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
        [uid, p.bio, p.contests, p.github, p.linkedin, JSON.stringify(p.experience), JSON.stringify(p.contestHistory)]
      );
    }

    // Seed initial alumni jobs once
    if (!(await db.query(`select 1 from alumni_jobs limit 1`)).rowCount) {
      await db.query(
        `insert into alumni_jobs (alumni_id, company, role, location, url, source, fetched_at, created_at) values
         ('shahriar', 'Stripe', 'Software Engineer, Core Payments', 'Remote / APAC', 'https://boards.greenhouse.io/stripe/jobs/1001', 'fetched', now() - interval '6 hours', now() - interval '6 hours'),
         ('shahriar', 'bKash Engineering', 'Junior Backend Engineer (Go / Postgres)', 'Dhaka, BD', 'https://careers.bkash.com/roles/junior-backend', 'manual', null, now() - interval '2 days'),
         ('tahmina', 'Grab', 'Machine Learning Engineer, NLP', 'Singapore', 'https://boards.greenhouse.io/grab/jobs/2042', 'fetched', now() - interval '4 hours', now() - interval '4 hours'),
         ('tahmina', 'MedMind Health', 'ML Engineering Intern (Summer)', 'Singapore / Hybrid', 'https://medmind.example/careers/ml-intern', 'manual', null, now() - interval '3 days')`
      );
    }

    // Seed an alumni interview-prep post once so Alumni modal shows real Interview Prep items
    if (!(await db.query(`select 1 from feed_posts where user_id = 'shahriar' limit 1`)).rowCount) {
      await db.query(
        `insert into feed_posts (user_id, title, body_md, category, score, created_at, updated_at) values
         ('shahriar', 'Interview prep: translating CP graph intuition into SWE system design', 'How I structured 6 weeks of interview prep moving from 2000+ CP rating to backend SWE loops: coding rounds, concurrency fundamentals, and clean API walkthroughs.', 'topic', 19, now() - interval '4 days', now() - interval '4 days'),
         ('tahmina', 'Interview prep: ML coding & probability rounds for new grads', 'Checklist of probability, matrix manipulation, and PyTorch debugging questions that show up in ML engineering loops.', 'topic', 15, now() - interval '5 days', now() - interval '5 days')`
      );
    }
  }

  // First-deploy backfill: ensure existing active members with problems_solved > 0 and no milestones yet
  // receive their current rank/solved milestone so the Feed sidebar is never empty on first deploy.
  await backfillMilestones(db);

  return !seededBefore;
}
