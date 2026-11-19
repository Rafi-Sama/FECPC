// SEED DATA for the member area. Placeholder records; see lib/data.ts.


export type Problem = { id: string; name: string; rating: number; topic: string; must?: boolean };
const p = (id: string, name: string, rating: number, topic: string, must = true): Problem => ({ id, name, rating, topic, must });
// Real Codeforces problem ids, so links open and solve detection can match them.
export const sheet: Problem[] = [
  p("4A", "Watermelon", 800, "Implementation"), p("71A", "Way Too Long Words", 800, "Implementation"), p("231A", "Team", 800, "Implementation"), p("263A", "Beautiful Matrix", 800, "Implementation"), p("282A", "Bit++", 800, "Implementation", false),
  p("112A", "Petya and Strings", 800, "Strings"), p("339A", "Helpful Maths", 800, "Strings"), p("266A", "Stones on the Table", 800, "Strings"), p("118A", "String Task", 1000, "Strings", false),
  p("158A", "Next Round", 800, "Greedy"), p("50A", "Domino piling", 800, "Greedy"), p("160A", "Twins", 900, "Greedy"), p("1352C", "K-th Not Divisible by n", 1200, "Greedy"),
  p("1A", "Theatre Square", 1000, "Math"), p("26A", "Almost Prime", 900, "Math"), p("230B", "T-primes", 1300, "Math"), p("1512B", "Almost Rectangle", 800, "Math", false),
  p("580C", "Kefa and Park", 1500, "Graphs"), p("520B", "Two Buttons", 1400, "Graphs"), p("277A", "Learning Languages", 1400, "Graphs"), p("20C", "Dijkstra?", 1900, "Graphs", false),
  p("189A", "Cut Ribbon", 1300, "DP"), p("455A", "Boredom", 1500, "DP"), p("698A", "Vacations", 1400, "DP"), p("1195C", "Basketball Exercise", 1400, "DP"),
];
export const cfUrl = (id: string) => { const m = id.match(/^(\d+)(\w+)$/)!; return `https://codeforces.com/problemset/problem/${m[1]}/${m[2]}`; };
export const seedSolved = ["4A", "71A", "231A", "263A", "112A", "339A", "158A", "50A", "1A"];
export const potd = [{ tier: "Easy", id: "266A", name: "Stones on the Table", rating: 800, xp: 20 }, { tier: "Medium", id: "230B", name: "T-primes", rating: 1300, xp: 40 }, { tier: "Hard", id: "20C", name: "Dijkstra?", rating: 1900, xp: 80 }];
export const upsolve = [{ id: "1352C", from: "Weekly #41 · C", due: "2 days" }, { id: "277A", from: "Weekly #41 · D", due: "2 days" }, { id: "1195C", from: "Weekly #40 · E", due: "overdue" }];

export const invoices: { id: string; label: string; amount: number; due: string; event?: string }[] = [
  { id: "INV-2611", label: "Semester subscription, Autumn 2026", amount: 300, due: "2026-11-16" },
  { id: "INV-2612", label: "Winter Hack Night registration", amount: 150, due: "2026-12-03", event: "hack-night" }, // owed only by members who registered
];
/** The invoices that apply to this member: term dues for everyone, event fees only for events they registered for. */
export const myInvoices = (reg: string[]) => invoices.filter((i) => !i.event || reg.includes(i.event));
/** True while the member still has to act on an invoice: nothing submitted, or the last submission was rejected. */
export const owes = (pay: Record<string, { status: string }>, id: string) => !pay[id] || pay[id].status === "rejected";
export const APPROVAL_THRESHOLD = 5000; // above this the President must approve, not only the Treasurer

export const resources = [
  { id: "r1", title: "A gentle introduction to prefix sums", type: "Article", topic: "Data structures", level: "Beginner", up: 48 },
  { id: "r2", title: "Binary search: the answer is monotone", type: "Video", topic: "Binary search", level: "Beginner", up: 73 },
  { id: "r3", title: "Graphs in 2 weeks (collection, 14 items)", type: "Collection", topic: "Graphs", level: "Intermediate", up: 91 },
  { id: "r4", title: "DP states: how to find them", type: "Article", topic: "DP", level: "Intermediate", up: 64 },
  { id: "r5", title: "Segment tree cheat sheet", type: "PDF", topic: "Data structures", level: "Advanced", up: 39 },
  { id: "r6", title: "Modular arithmetic for contests", type: "Article", topic: "Math", level: "Beginner", up: 27 },
  { id: "r7", title: "ICPC rules and registration, explained", type: "Wiki", topic: "ICPC", level: "Beginner", up: 55 },
  { id: "r8", title: "Interview patterns: two pointers", type: "Video", topic: "Interviews", level: "Intermediate", up: 33 },
];
export const doubts = [
  { id: "d1", by: "zahid", q: "Why does my greedy fail on 1352C for n = 2?", problem: "1352C", answers: 3, solved: true, up: 12 },
  { id: "d2", by: "mim", q: "TLE on Kefa and Park with recursion depth 1e5", problem: "580C", answers: 2, solved: true, up: 9 },
  { id: "d3", by: "jannat", q: "How do I pick the DP state in Vacations?", problem: "698A", answers: 1, solved: false, up: 7 },
  { id: "d4", by: "sabbir", q: "Is sqrt() safe for checking T-primes up to 1e12?", problem: "230B", answers: 0, solved: false, up: 4 },
];

export const announcements = [
  {
    id: "a1",
    from: "sadia",
    scope: "Everyone",
    title: "General meeting, Friday 4 pm, Seminar Room",
    body: "Agenda: contest day roles, budget vote, new mentor pairs. Attendance is recorded.",
    body_md: "Hey @everyone! We are holding our monthly general meeting this Friday.\n\n**Agenda:**\n- Contest day volunteer roles & desk assignments\n- Autumn term budget & prize pool review\n- New Batch 25 mentor pairings with @mentors\n\n> Date: Friday, 20 November 2026\n> Time: 4:00 PM\n> Venue: Seminar Room, CSE Building\n\nAttendance is recorded. Please arrive five minutes early.",
    must: true,
    pinned: true,
    requires_ack: true,
    at: "2026-11-16T10:23:00Z",
    edited_at: null as string | null,
  },
  {
    id: "a2",
    from: "anika",
    scope: "Everyone",
    title: "Semester subscription is due on 16 November",
    body: "Pay by bKash, Nagad, Rocket or cash at the desk. A late fine applies after the grace period.",
    body_md: "Reminder for @everyone: the Autumn 2026 semester subscription (**৳300**) is due on **16 November**.\n\nPay via `bKash`, `Nagad`, `Rocket`, or cash at the club desk and submit your transaction ID under **Club → Finance**.\n\n> Amount: ৳300\n> Deadline: 16 November 2026\n> Contact: @anika for waiver requests",
    must: false,
    pinned: false,
    requires_ack: false,
    at: "2026-11-14T08:00:00Z",
    edited_at: null as string | null,
  },
  {
    id: "a3",
    from: "nadia",
    scope: "Batch 24",
    title: "Green sheet target: 5 DP problems this week",
    body: "Tracked automatically from your Codeforces submissions.",
    body_md: "Heads up @batch24 — this week's green sheet focus is **Dynamic Programming** (`189A`, `455A`, `698A`, `1195C` + one choice problem).\n\nLink your Codeforces handle in your profile so solves sync automatically. Ask in **Feed → Help** if you get stuck on a state transition.",
    must: false,
    pinned: false,
    requires_ack: false,
    at: "2026-11-13T14:30:00Z",
    edited_at: null as string | null,
  },
];
export const polls = [
  { id: "p1", q: "Which day for the Linux workshop?", opts: [["Saturday", 31], ["Sunday", 18], ["Tuesday evening", 44]] as [string, number][] },
  { id: "p2", q: "Next bootcamp topic?", opts: [["Graphs", 52], ["Number theory", 23], ["Strings", 29]] as [string, number][] },
];

export const duels = [{ a: "farhan", b: "nusrat", problem: "520B", state: "live", elo: [1512, 1488] }, { a: "priya", b: "shuvo", problem: "189A", state: "priya won in 11:42", elo: [1534, 1471] }];
export const bounties = [{ id: "20C", name: "Dijkstra?", prize: 300, left: "3 days" }, { id: "1195C", name: "Basketball Exercise", prize: 120, left: "6 days" }];
export const shop = [["Sticker pack", 400], ["Priority seat at the next seminar", 900], ["Club T-shirt", 2500], ["One-month fee discount", 4000]] as const;

export const modules = ["Finance", "Green sheets", "Contests", "Arena", "Learning", "Events", "Community", "Elections", "Alumni", "Fantasy league"];
