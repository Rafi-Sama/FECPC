// The shape of everything the server sends a signed-in member. Shared by server/state.ts and the client store.
import type { Member } from "./data";
import type { Role } from "./permissions";

export type Payment = { trx: string; via: string; status: "pending" | "verified" | "rejected"; id: number; amount: number; label: string; at: string; note: string | null };
export type S = {
  role: Role; handle: string; base: { solved: number; done: number };
  solved: string[]; done: string[]; lessons: string[]; read: string[]; kudos: string[]; reg: string[]; present: string[];
  quiz: Record<string, number>; votes: Record<string, string>;
  /** The member's latest payment per invoice. A rejected one stays visible until it is replaced. */
  pay: Record<string, Payment>;
  /** Officer decisions the role may see: payment queue, expenses and waivers, applications. */
  queue: Record<string, string>; exp: Record<string, string>; apps: Record<string, string>;
  flags: Record<string, boolean>; kv: Record<string, string>;
  /** Requests this member has sent to others ("to:kind:ref"), so a button can show it was sent. */
  sent: string[];
  posts: number; spent: number; checkin: boolean;
  feedPosts: number; feedUpvotes: number; ideasCount: number; acceptedInterests: number; milestoneKudosReceived: number;
  log: { t: string; who: string; what: string }[];
};
/** A member as everyone sees them. `roleKey` and `suspended` are present only for officers who manage accounts. */
export type Roster = Member & {
  no: number;
  problems_solved: number;
  cf_rating?: number | null;
  cf_handle?: string | null;
  current_streak?: number;
  contests_participated?: number;
  avatar_url?: string | null;
  is_alumni?: boolean;
  roleKey?: Role;
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
  kind: "feed" | "idea";
  id: number;
  title: string;
  created_at: string;
};

export type AlumniJob = {
  id: number;
  alumni_id: string | null;
  company: string;
  role: string;
  location: string | null;
  url: string;
  source: "fetched" | "manual";
  fetched_at: string | null;
  created_at: string;
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
  squad: Member["squad"];
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
  experience: MemberExperience[];
  contest_history: MemberContestRow[];
  recent_activity: MemberActivityItem[];
  /** Only included when viewerId === userId */
  email?: string;
  /** Alumni-only payloads */
  interview_prep?: { id: number; title: string; created_at: string }[];
  jobs_fetched?: AlumniJob[];
  jobs_manual?: AlumniJob[];
};
export type Expense = { id: string; by: string; name: string; what: string; amount: number; event: string; status: string };

export type FeedCategory = "problem-solving" | "upsolving" | "topic";
export type IdeaType = "idea" | "teammate" | "study";
export type IdeaStatus = "open" | "planned" | "shipped" | "closed";
export type MilestoneType = "rank_promotion" | "solved_milestone" | "contest_streak";

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

export type CommunityComment = {
  id: number;
  user_id: string;
  author_name: string;
  author_solved: number;
  author_avatar: string | null;
  body: string;
  created_at: string;
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
  status: "pending" | "accepted" | "declined";
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
  comment_count: number;
  interested_count: number;
  accepted_count: number;
  my_interest: "pending" | "accepted" | "declined" | null;
  created_at: string;
  updated_at: string;
};

export type IdeaDetail = IdeaSummary & {
  comments: CommunityComment[];
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
  mentees: boolean;
  pinned: boolean;
  requires_ack: boolean;
  read_count: number;
};
/** Officer-only datasets. Each key is present only when the role holds the capability that guards it. */
export type Office = {
  queue?: { id: string; name: string; label: string; amount: number; via: string; trx: string; sender: string; status: string; mine: boolean; at: string }[];
  fund?: { accounts: (readonly [string, number])[]; ledger: { date: string; what: string; cat: string; amt: number }[]; budgets: (readonly [string, number, number])[]; cashflow: number[] };
  expenses?: Expense[];
  waivers?: { id: string; who: string; what: string; amount: number; reason: string }[];
  mentees?: { id: string; week: number[]; last: string; flag: string; checkin?: { body: string; at: string } }[];
  applications?: { id: string; name: string; dept: string; batch: number; quiz: number; src: string; email: string; sid: string; cf: string; track: string; why: string }[];
  suggestions?: { body: string; at: string }[];
  feedback?: { body: string; at: string }[];
  /** For roles that run events: today's room code, how many checked in, and who registered through the platform. */
  events?: { code: string; event: string; arrived: Record<string, number>; registrants: Record<string, string[]> };
  ops?: {
    tasks: { id: string; title: string; who: string; due: string; col: string }[]; meetings: { id: string; date: string; title: string; agenda: string[]; actions: string[][] }[];
    vault: string[][]; inventory: [string, string, string][]; sponsors?: { name: string; promised: number; got: number; owe: string; last: string }[];
    reports: { growth: number[]; retention: number[]; solves: number[] };
  };
};
export type AppState = {
  me: Roster & { email: string; roleKey: Role; suspended: boolean; mentor: string | null; /** an operator account, not a person */ system: boolean };
  s: S;
  members: Roster[];
  /** Live totals across all members: seats taken, poll votes, kudos, volunteer sign-ups, solves per problem, announcement reads, milestone kudos daily cap, recent milestones. */
  counts: {
    reg: Record<string, number>;
    votes: Record<string, Record<string, number>>;
    kudos: Record<string, number>;
    vol: Record<string, number>;
    solved: Record<string, number>;
    annReads: Record<string, number>;
    kudosToday: number;
    recentMilestones: MilestoneDTO[];
  };
  news: AnnouncementItem[];
  /** What needs this member's attention, worked out on the server from real records. */
  inbox: { id: string; cat: string; text: string; href: string }[];
  /** Expense requests this member filed, whatever their role. */
  myExpenses: Expense[];
  fundTotal: number;
  office: Office;
};
