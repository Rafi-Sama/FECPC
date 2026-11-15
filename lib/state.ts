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
  log: { t: string; who: string; what: string }[];
};
/** A member as everyone sees them. `roleKey` and `suspended` are present only for officers who manage accounts. */
export type Roster = Member & { no: number; roleKey?: Role; suspended?: boolean; /** invited, has not set a password yet */ pending?: boolean };
export type Expense = { id: string; by: string; name: string; what: string; amount: number; event: string; status: string };
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
  /** Live totals across all members: seats taken, poll votes, kudos, volunteer sign-ups, solves per problem. */
  counts: { reg: Record<string, number>; votes: Record<string, Record<string, number>>; kudos: Record<string, number>; vol: Record<string, number>; solved: Record<string, number> };
  news: { id: string; title: string; by: string; at: string; mentees: boolean }[];
  /** What needs this member's attention, worked out on the server from real records. */
  inbox: { id: string; cat: string; text: string; href: string }[];
  /** Expense requests this member filed, whatever their role. */
  myExpenses: Expense[];
  fundTotal: number;
  office: Office;
};
