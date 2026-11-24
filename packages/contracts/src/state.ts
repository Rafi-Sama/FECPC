// The shape of everything the server sends a signed-in member. Built by the API's loadState (modules/member-area/state.ts), read by the web store.
import type { Post, Role } from './roles.ts';
import type { Due } from './dues.ts';
import type { Applicant, RecruitLink } from './recruit.ts';
import type { ProfileRequest, ProfileRequestReview } from './profile.ts';

/** A club member as the roster shows them. */
export type Member = {
  id: string;
  name: string;
  handle: string;
  batch: number;
  dept: string;
  rating: number;
  peak: number;
  solved: number;
  streak: number;
  xp: number;
  squad: 'Heap' | 'Trie' | 'Graph' | 'Stack';
  role?: string;
  skills: string[];
  helper: number;
};

export type Payment = {
  trx: string;
  via: string;
  /** `waived`: no payment; a waiver granted before waivers were removed settles the invoice. */
  status: 'pending' | 'verified' | 'rejected' | 'waived';
  id: number;
  amount: number;
  label: string;
  at: string;
  note: string | null;
};
export type S = {
  role: Role;
  /** Effective roles: `role` plus whatever the member's post grants. Check permissions against these. */
  roles: Role[];
  handle: string;
  vjudge: string;
  /** Accepted problems on VJudge outside Codeforces, synced by the server. */
  vjSolved: number;
  base: { solved: number; done: number };
  solved: string[];
  /** Ticked problems that Codeforces confirmed; only these earn solve XP. */
  verified: string[];
  done: string[];
  read: string[];
  kudos: string[];
  reg: string[];
  /** This member's bills: member dues, post dues and event fees (see dues.ts). Settled ones stay listed. */
  dues: Due[];
  present: string[];
  votes: Record<string, string>;
  /** The member's latest payment per invoice. A rejected one stays visible until it is replaced. */
  pay: Record<string, Payment>;
  /** Officer decisions the role may see: payment queue, expenses, applications. */
  queue: Record<string, string>;
  exp: Record<string, string>;
  apps: Record<string, string>;
  flags: Record<string, boolean>;
  kv: Record<string, string>;
  posts: number;
  spent: number;
  checkin: boolean;
  /** Platform streak: consecutive daily check-ins, including today once checked in. */
  run: number;
  feedPosts: number;
  feedUpvotes: number;
  ideasCount: number;
  acceptedInterests: number;
  milestoneKudosReceived: number;
};
/** A member as everyone sees them. `roleKey` and `suspended` are present only for officers who manage accounts. */
export type Roster = Member & {
  no: number;
  problems_solved: number;
  cf_rating?: number | null;
  cf_handle?: string | null;
  /** Last five rated Codeforces rounds, newest first, from the server's sync. Not in the roster (see clubRounds). */
  cf_contests?: CfRound[];
  current_streak?: number;
  contests_participated?: number;
  avatar_url?: string | null;
  is_alumni?: boolean;
  roleKey?: Role;
  post?: Post | null;
  /** Super Admin only. */ email?: string;
  suspended?: boolean;
  /** invited, has not set a password yet */ pending?: boolean;
};

export type MemberExperience = {
  period: string;
  role: string;
  summary: string;
};

export type MemberContestRow = {
  name: string;
  rank: number;
  delta: number;
  date?: string;
};

export type MemberActivityItem = {
  kind: 'feed' | 'idea';
  id: number;
  title: string;
  created_at: string;
};

export type AlumniJob = {
  id: number;
  alumni_id: string | null;
  company: string;
  role: string;
  title?: string;
  vacancies: number;
  location: string | null;
  job_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | string | null;
  experience: string | null;
  salary: string | null;
  description: string | null;
  responsibilities: string[];
  requirements: string[];
  deadline: string | null;
  company_logo_url: string | null;
  url: string;
  source: 'fetched' | 'manual';
  fetched_at: string | null;
  posted_at?: string;
  created_at: string;
  mine?: boolean;
};

export type AlumniSummary = {
  id: string;
  no: number;
  name: string;
  handle: string;
  cf_handle: string | null;
  role: string | null;
  title: string | null;
  batch: number;
  dept: string;
  rating: number;
  cf_rating: number | null;
  problems_solved: number;
  skills: string[];
  avatar_url: string | null;
  location: string | null;
  available_for_questions: boolean;
  isSaved?: boolean;
  saved?: boolean;
};

export type RoadmapKind = 'prep' | 'learn';
export type InterviewRoadmap = {
  id: number;
  kind: RoadmapKind;
  name: string;
  description: string | null;
  created_at: string;
  topicCount: number;
  solvedCount: number;
  totalCount: number;
  topicNames: string[];
};

export type InterviewTopic = {
  id: number;
  name: string;
  description: string | null;
  created_by: string | null;
  order_index: number;
  link?: string | null;
  roadmap_id: number | null;
  parent_id: number | null;
  x: number;
  y: number;
  created_at: string;
  solvedCount: number;
  totalCount: number;
  problemTitles?: string[];
};

export type InterviewProblem = {
  id: number;
  topic_id: number;
  title: string;
  url: string;
  difficulty: 'easy' | 'medium' | 'hard';
  meta: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  solved?: boolean;
};

export type InterviewTip = {
  id: number;
  author_id: string;
  author_name?: string;
  author_handle?: string;
  author_avatar?: string | null;
  author_rating?: number;
  topic_id: number | null;
  title: string;
  body_md: string;
  created_at: string;
  updated_at: string;
};

export type BlogPost = {
  id: number;
  author_id: string;
  author_name?: string;
  author_handle?: string;
  author_avatar?: string | null;
  author_rating?: number;
  author_role?: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body_md: string;
  cover_url: string | null;
  tags: string[];
  status: 'draft' | 'published';
  published_at: string | null;
  views: number;
  upvotes?: number;
  read_time_min?: number;
  created_at: string;
  updated_at: string;
};

export type MemberSummary = {
  id: string;
  no: number;
  name: string;
  handle: string;
  cf_handle: string | null;
  role: string | null;
  is_alumni: boolean;
  batch: number;
  dept: string;
  squad: Member['squad'];
  rating: number;
  cf_rating: number | null;
  problems_solved: number;
  current_streak: number;
  contests_participated: number;
  skills: string[];
  avatar_url: string | null;
};

export type MemberProfile = MemberSummary & {
  bio: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  vjudge_handle: string | null;
  /** When the account was created. */
  joined: string;
  experience: MemberExperience[];
  contest_history: MemberContestRow[];
  recent_activity: MemberActivityItem[];
  /** Only included when viewerId === userId */
  email?: string;
  /** From the recruitment form; only for the member themselves. */
  student_id?: string | null;
  phone?: string | null;
  /** Alumni-only payloads */
  available_for_questions?: boolean;
  location?: string | null;
  interview_prep?: { id: number; title: string; created_at: string }[];
  interview_tips?: InterviewTip[];
  blogs?: BlogPost[];
  jobs_posted?: AlumniJob[];
  jobs_fetched?: AlumniJob[];
  jobs_manual?: AlumniJob[];
};
export type Expense = {
  id: string;
  by: string;
  name: string;
  what: string;
  amount: number;
  event: string;
  status: string;
};

export type FeedCategory = 'problem-solving' | 'upsolving' | 'topic';
export type IdeaType = 'idea' | 'teammate' | 'study';
export type IdeaStatus = 'open' | 'planned' | 'shipped' | 'closed';
export type MilestoneType = 'rank_promotion' | 'solved_milestone' | 'contest_streak';

export type MilestoneDTO = {
  id: number;
  user_id: string;
  member_name: string;
  member_avatar: string | null;
  member_solved: number;
  member_cf_handle: string | null;
  member_rating: number;
  type: MilestoneType;
  from_value: string | null;
  to_value: string;
  threshold: number | null;
  meta: Record<string, unknown>;
  created_at: string;
  kudos_count: number;
  has_kudos: boolean;
  /** Up to 3 recent giver names, populated only when the viewer owns the milestone. */
  recent_givers?: string[];
};

export type FeedPostSummary = {
  id: number;
  user_id: string;
  author_name: string;
  author_solved: number;
  author_rating: number;
  author_role: string | null;
  author_avatar: string | null;
  title: string;
  body_md: string;
  category: FeedCategory;
  score: number;
  my_vote: -1 | 0 | 1;
  created_at: string;
  updated_at: string;
};

export type FeedPostDetail = FeedPostSummary & {
  author_posts_count: number;
  author_streak: number;
  author_recent: { id: number; title: string; created_at: string }[];
  reported_by_me: boolean;
};

export type IdeaInterestRow = {
  user_id: string;
  name: string;
  rating: number;
  problems_solved: number;
  avatar_url: string | null;
  response: Record<string, string>;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  decided_at: string | null;
};

export type IdeaSummary = {
  id: number;
  user_id: string;
  author_name: string;
  author_solved: number;
  author_rating: number;
  author_avatar: string | null;
  title: string;
  body_md: string;
  type: IdeaType;
  status: IdeaStatus;
  roles: string[];
  upvotes: number;
  interested_count: number;
  accepted_count: number;
  my_interest: 'pending' | 'accepted' | 'declined' | null;
  created_at: string;
  updated_at: string;
};

export type IdeaDetail = IdeaSummary & {
  /** Present ONLY when viewerId === idea.user_id; strictly omitted from server payload otherwise. */
  interested?: IdeaInterestRow[];
};

export type AnnouncementItem = {
  id: string;
  user_id: string;
  title: string;
  body_md: string;
  by: string;
  by_role: string | null;
  by_solved: number;
  by_avatar: string | null;
  at: string;
  edited_at: string | null;
  pinned: boolean;
  requires_ack: boolean;
  read_count: number;
};
/** Officer-only datasets. Each key is present only when the role holds the capability that guards it. */
/** Member counts for the admin dashboard, counted on the server so the dashboard does not wait for the roster. */
export type PeopleSummary = {
  active: number;
  invited: number;
  suspended: number;
  /** Active members with a Codeforces handle, and how many of those have a rating. */
  linked: number;
  rated: number;
  median: number;
  /** Active members on a solving streak. */
  daily: number;
  /** Rated active members per rank, lowest rank first: [title, count, colour]. */
  ranks: [string, number, string][];
  /** Active members per batch, newest batch first. */
  batches: [number, number][];
  /** The first eight active members without a handle, highest rated first. */
  unlinked: { id: string; name: string; batch: number }[];
};

export type Office = {
  people?: PeopleSummary;
  queue?: {
    id: string;
    name: string;
    label: string;
    amount: number;
    via: string;
    trx: string;
    sender: string;
    status: string;
    mine: boolean;
    at: string;
  }[];
  fund?: {
    accounts: (readonly [string, number])[];
    ledger: { date: string; what: string; cat: string; amt: number }[];
    /** `spent` = spent before the ledger existed + approved expenses filed under the budget's name. */
    budgets: { id: number; name: string; plan: number; spent: number }[];
  };
  expenses?: Expense[];
  /** Finance roles: how many are paid up for their current period, by account, and alumni gifts this term. */
  dues?: {
    term: { of: number; paid: number; waiting: number; fee: number };
    post: { of: number; paid: number; waiting: number; fee: number };
    gifts: { amount: number; count: number };
  };
  recruit?: { links: RecruitLink[]; applicants: Applicant[] };
  /** Open profile change requests, for officers with full `member.editDetails`. */
  profileRequests?: ProfileRequestReview[];
  /** The email queue, for officers who send email (recruitment, events). */
  mail?: {
    ready: boolean;
    limit: number;
    sent: number;
    queued: number;
    /** The latest error on mail still waiting (server unreachable, login rejected, limit reached). */
    problem: string | null;
    failed: { id: string; to: string; subject: string; error: string; at: string }[];
  };
  suggestions?: { body: string; at: string }[];
  feedback?: { body: string; at: string }[];
  ops?: {
    tasks: { id: number; title: string; who: string | null; due: string | null; col: string }[];
    docs: {
      id: number;
      title: string;
      about: string;
      url: string;
      /** Who added it; null once that account is deleted. */
      by: string | null;
      byId: string | null;
      /** YYYY-MM-DD */
      at: string;
    }[];
    inventory: { id: number; name: string; holder: string | null }[];
    reports: { growth: number[]; retention: number[]; solves: number[] };
  };
};
export type AppState = {
  me: Roster & {
    email: string;
    roleKey: Role;
    suspended: boolean;
    /** an operator account, not a person */ system: boolean;
  };
  s: S;
  members: Roster[];
  /** Live totals across all members: poll votes, kudos, volunteer sign-ups, solves per problem, announcement reads, milestone kudos daily cap, recent milestones. */
  counts: {
    votes: Record<string, Record<string, number>>;
    /** Kudos per member, keyed `member:<id>` (members with none are absent). */
    kudos: Record<string, number>;
    vol: Record<string, number>;
    solved: Record<string, number>;
    annReads: Record<string, number>;
    kudosToday: number;
    recentMilestones: MilestoneDTO[];
    alumniCount?: number;
    /** Everyone a member sees on the roster (alumni included), known before the roster itself loads. */
    peopleCount: number;
    /** The five members with the most helper points, highest first. */
    topHelpers: {
      id: string;
      name: string;
      helper: number;
      solved: number;
      avatar_url: string | null;
    }[];
    jobsCount?: number;
    prepTopicsCount?: number;
    blogsCount?: number;
  };
  news: AnnouncementItem[];
  /** Newest 50 polls; live tallies are in `counts.votes[id]`. */
  polls: { id: string; user_id: string; q: string; opts: string[]; by: string; at: string }[];
  /** What needs this member's attention, worked out on the server from real records. */
  inbox: {
    id: string;
    cat: string;
    text: string;
    href: string;
    /** One-click answers: each is a member action (`act(type, args)`); its handler re-checks permission. */
    actions?: { label: string; type: string; args: Record<string, unknown> }[];
  }[];
  /** Expense requests this member filed, whatever their role. */
  myExpenses: Expense[];
  fundTotal: number;
  /** Real money this term (since 1 Jan or 1 Jul): verified payments in, approved expenses out. */
  term: {
    since: string;
    incoming: number;
    spent: number;
    /** The latest 100 approved expenses this term, newest first; every member sees them. */
    expenses: { date: string; what: string; cat: string; amount: number; by: string | null }[];
    /** Every approved expense this term, summed per category, largest first. */
    categories: { cat: string; amount: number }[];
    /** Verified payments in and approved expenses out, per month, the last six months. */
    flow: { month: string; in: number; out: number }[];
  };
  office: Office;
  /** The member's own latest profile change request: open, or decided in the last 14 days. */
  profileRequest: ProfileRequest | null;
  /** The current weekly sheet first, then curated sheets, newest first. `club` = members Codeforces says solved it. */
  sheets: Sheet[];
  /**
   * The 30 newest Arena challenges from the last 30 days, newest first. `solvers[].at` is the first accept on Codeforces;
   * `solvers` holds the first ten since the challenge, ten from before and the member, `since`/`earlier` the totals.
   */
  challenges: {
    id: number;
    problem: string;
    name: string;
    rating: number | null;
    by: string;
    at: string;
    solvers: { id: string; at: string | null }[];
    since: number;
    earlier: number;
  }[];
  /** Fantasy league: this week's and next week's Mondays, and every team picked for last, this or next week. */
  fantasy: { week: string; next: string; teams: { by: string; week: string; picks: string }[] };
  /** Which roles each club post grants. Set by the Super Admin. */
  postRoles: Partial<Record<Post, Role[]>>;
  /** Popular courses, newest first. */
  courses: Course[];
  /** Today's daily quiz (Asia/Dhaka date). `answer` is sent only once the member has picked. */
  quiz: QuizToday[];
  /** The whole question bank with answers, newest first. Only for holders of `learning.curate`. */
  quizBank: QuizQuestion[] | null;
};

export type Course = {
  id: string;
  title: string;
  instructor: string;
  weeks: number;
  description: string;
  url: string;
};
export type QuizToday = {
  id: string;
  question: string;
  options: string[];
  picked: number | null;
  answer: number | null;
};
export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: number;
  /** One of today's five. */
  today: boolean;
};

export type SheetProblem = {
  id: string;
  name: string;
  rating: number | null;
  tags: string[];
  club: number;
};
export type Sheet = {
  id: number;
  kind: 'weekly' | 'custom';
  title: string;
  note: string;
  week: string | null;
  by: string | null;
  at: string;
  problems: SheetProblem[];
};

/** One member's rounds for the contests page (`members` query `clubRounds`). */
export type ClubRounds = {
  id: string;
  name: string;
  handle: string | null;
  cf_rating: number | null;
  cf_contests: CfRound[];
};

export type CfRound = {
  id: number;
  name: string;
  rank: number;
  delta: number;
  at: number;
  /** problems accepted during the round */ solved: number;
};
