// Backend tests against a real PostgreSQL database (fecpc_test), rebuilt from the schema on every run.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { XP, earned } from "../lib/xp.ts";
import { act, apply, exportMembers } from "./actions.ts";
import { acceptInvite, changePassword, endSession, login, loginWithGoogle, sessionUser, throttle } from "./auth.ts";
import { Fail, pool } from "./db.ts";
import { setup } from "./seed.ts";
import { loadState } from "./state.ts";

process.env.DATABASE_URL = (process.env.DATABASE_URL ?? "").replace(/\/[^/]+$/, "/fecpc_test"); // never the development database
const PW = "test-password-123";
const db = () => pool();
const st = async (id: string) => (await loadState(db(), id))!;
/** Asserts the action is refused with this HTTP status. */
const refused = (status: number, p: Promise<unknown>) => assert.rejects(p, (e: unknown) => e instanceof Fail && e.status === status, `expected a ${status} refusal`);

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  assert.equal(await setup(db(), PW), true);
  assert.equal(await setup(db(), PW), false, "setup is idempotent and never reseeds");
});
after(() => pool().end());

test("auth: password login, sessions, logout", async () => {
  const s = await login(db(), " Tasnim@FECPC.example ", PW);
  assert.equal(await sessionUser(db(), s.token), "tasnim");
  assert.equal(await sessionUser(db(), s.token + "x"), null);
  assert.equal(await sessionUser(db(), undefined), null);
  await refused(401, login(db(), "tasnim@fecpc.example", "wrong-password"));
  await refused(401, login(db(), "nobody@fecpc.example", PW)); // same answer as a wrong password: no account enumeration
  await refused(401, login(db(), { $ne: "" }, ["x"]));
  await endSession(db(), s.token);
  assert.equal(await sessionUser(db(), s.token), null);
  const raw = (await db().query(`select token_hash from sessions limit 1`)).rows[0];
  assert.ok(!raw || raw.token_hash.length === 64, "only a hash of the session token is stored");
});
test("auth: expired sessions stop working; repeated failures are throttled", async () => {
  const s = await login(db(), "zahid@fecpc.example", PW);
  await db().query(`update sessions set expires_at = now() - interval '1 second' where user_id = 'zahid'`);
  assert.equal(await sessionUser(db(), s.token), null);
  for (let n = 0; n < 8; n++) throttle("k", 8, 60_000, 1000);
  assert.throws(() => throttle("k", 8, 60_000, 1000), Fail);
  throttle("k", 8, 60_000, 1000 + 60_001); // the window passes
});
test("auth: changing a password signs out every other device", async () => {
  const old = await login(db(), "mim@fecpc.example", PW);
  await refused(401, changePassword(db(), "mim", "not-my-password", "another-password-1"));
  await refused(400, changePassword(db(), "mim", PW, "short"));
  const fresh = await changePassword(db(), "mim", PW, "another-password-1");
  assert.equal(await sessionUser(db(), old.token), null);
  assert.equal(await sessionUser(db(), fresh.token), "mim");
  await refused(401, login(db(), "mim@fecpc.example", PW));
});
test("auth: Google sign-in only for a verified address that is already a member", async () => {
  await refused(403, loginWithGoogle(db(), { sub: "g1", email: "stranger@gmail.com", email_verified: true }));
  await refused(401, loginWithGoogle(db(), { sub: "g1", email: "priya@fecpc.example", email_verified: false }));
  assert.equal(await sessionUser(db(), (await loginWithGoogle(db(), { sub: "g1", email: "priya@fecpc.example", email_verified: true })).token), "priya");
  await refused(403, loginWithGoogle(db(), { sub: "someone-else", email: "priya@fecpc.example", email_verified: true })); // the link cannot be taken over
});

test("visibility: each role receives only the datasets it has a capability for", async () => {
  const member = await st("tasnim"), mentor = await st("mehedi"), treasurer = await st("anika"), secretary = await st("sadia"), president = await st("tanvir"), cpHead = await st("nadia");
  assert.deepEqual(Object.keys(member.office), []);
  assert.deepEqual([member.s.log, member.s.queue, member.s.exp, member.s.apps], [[], {}, {}, {}]);
  assert.deepEqual(Object.keys(mentor.office), ["mentees"]);
  assert.deepEqual(Object.keys(cpHead.office).sort(), ["mentees", "ops"]);
  assert.deepEqual(Object.keys(treasurer.office).sort(), ["expenses", "fund", "ops", "queue", "suggestions", "waivers"]);
  assert.equal(treasurer.office.queue!.length, 4);
  assert.match(treasurer.office.queue![0].sender, /^\d{3}••••\d{4}$/, "sender numbers are masked");
  assert.deepEqual(Object.keys(secretary.office).sort(), ["applications", "events", "feedback", "ops", "suggestions"]);
  assert.deepEqual(secretary.s.log, [], "the Secretary cannot read the audit log");
  assert.ok(Array.isArray(president.s.log) && president.office.queue, "the President sees the log and the payment queue");
  assert.equal(president.s.log.some((l) => /PAY-897|EXP-069/.test(l.what)), false, "the audit log starts empty: nothing fabricated is seeded into it");
  assert.equal(JSON.stringify(member).includes("pass_hash"), false);
  assert.equal(member.members.some((m) => "email" in m), false, "no member's email is in the roster");
  assert.equal(member.members.some((m) => "roleKey" in m || "suspended" in m || "system" in m || "mentorId" in m), false, "account-management fields stay with the officers who manage accounts");
  assert.equal(member.members.some((m) => m.id === "admin"), false, "the operator account is not a person and is not listed");
  assert.equal(secretary.members.find((m) => m.id === "tanvir")?.roleKey, "president", "officers who manage accounts see role keys");
  assert.equal(cpHead.office.ops!.sponsors, undefined, "no finance capability, no sponsor ledger");
  assert.ok(treasurer.office.ops!.sponsors);
  assert.equal(president.members.some((m) => m.id === "admin"), false, "only a Super Admin is shown the operator account");
  assert.deepEqual(Object.keys(secretary.office.events!).sort(), ["arrived", "code", "event", "registrants"], "event organisers get the room code and registrants");
  assert.equal(member.office.events, undefined);
  assert.equal(member.me.email, "tasnim@fecpc.example");
});

test("progress: only real items are accepted; XP follows", async () => {
  const x0 = earned((await st("shuvo")).s);
  await act("shuvo", { type: "toggle", list: "solved", id: "282A" });
  await refused(403, act("shuvo", { type: "toggle", list: "solved", id: "9999Z" }));
  await refused(400, act("shuvo", { type: "toggle", list: "spent", id: "x" }));
  await refused(400, act("shuvo", { type: "toggle", list: "solved", id: "<script>" }));
  await act("shuvo", { type: "checkin" });
  await act("shuvo", { type: "toggle", list: "lessons", id: "dp:0" });
  await refused(403, act("shuvo", { type: "toggle", list: "lessons", id: "dp:99" }));
  const s = (await st("shuvo")).s;
  assert.ok(s.solved.includes("282A") && s.checkin);
  assert.equal(earned(s) - x0, XP.solve + XP.checkin + XP.lesson);
  await act("shuvo", { type: "toggle", list: "solved", id: "282A" });
  assert.equal((await st("shuvo")).s.solved.includes("282A"), false);
});
test("progress: simultaneous writes by one member never lose an update", async () => {
  const ids = ["282A", "118A", "266A", "160A", "1352C", "26A", "230B", "1512B"];
  await Promise.all(ids.map((id) => act("imran", { type: "toggle", list: "solved", id, on: true })));
  const solved = (await st("imran")).s.solved;
  for (const id of ids) assert.ok(solved.includes(id), id);
});
test("quiz is scored on the server; the client cannot send a score", async () => {
  await act("shuvo", { type: "quiz", course: "dp", picks: [1, 2, 2], score: 3 });
  assert.equal((await st("shuvo")).s.quiz.dp, 2);
  await refused(400, act("shuvo", { type: "quiz", course: "dp", picks: [1] }));
  await refused(403, act("shuvo", { type: "quiz", course: "nope", picks: [0, 0, 0] }));
  await act("shuvo", { type: "quizReset", course: "dp" });
  assert.equal((await st("shuvo")).s.quiz.dp, undefined);
});

test("sync: registrations, kudos and poll votes are counted across members", async () => {
  await act("shuvo", { type: "toggle", list: "reg", id: "git-night" });
  await act("priya", { type: "toggle", list: "reg", id: "git-night" });
  await act("priya", { type: "toggle", list: "kudos", id: "f1" });
  await act("shuvo", { type: "vote", poll: "p1", option: "Sunday" });
  await act("priya", { type: "vote", poll: "p1", option: "Sunday" });
  await act("priya", { type: "vote", poll: "p1", option: "Saturday" }); // a poll vote can be changed
  await refused(403, act("priya", { type: "vote", poll: "p1", option: "Never" }));
  await refused(403, act("priya", { type: "toggle", list: "reg", id: "no-such-event" }));
  const seen = await st("tasnim");
  assert.equal(seen.counts.reg["git-night"], 2);
  assert.equal(seen.counts.kudos.f1, 1);
  assert.deepEqual(seen.counts.votes.p1, { Sunday: 1, Saturday: 1 });
});
test("election: one ballot, unchangeable, and never counted back to anyone", async () => {
  await act("shuvo", { type: "vote", poll: "election", option: "sadia" });
  await refused(409, act("shuvo", { type: "vote", poll: "election", option: "mehedi" }));
  await refused(403, act("priya", { type: "vote", poll: "election", option: "tasnim" }));
  assert.equal((await st("shuvo")).s.votes.election, "sadia");
  assert.equal((await st("tanvir")).counts.votes.election, undefined, "not even the President gets running totals");
});
test("volunteer shifts: a full shift refuses, and the last place goes to exactly one of two simultaneous sign-ups", async () => {
  await refused(409, act("shuvo", { type: "toggle", list: "present", id: "vol:Print runner" })); // 4 of 4
  await refused(403, act("shuvo", { type: "toggle", list: "present", id: "dp-bootcamp" })); // class attendance needs the code
  const r = await Promise.allSettled(["shuvo", "priya", "imran"].map((u) => act(u, { type: "toggle", list: "present", id: "vol:Registration desk" }))); // 3 of 4
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await st("tasnim")).counts.vol["vol:Registration desk"], 1);
});
test("attendance needs the room code", async () => {
  await refused(400, act("shuvo", { type: "attend", code: "WRONG1" }));
  await act("shuvo", { type: "attend", code: "k7-4q-x2" });
  assert.ok((await st("shuvo")).s.present.includes("dp-bootcamp"));
});

test("payments: validated, one transaction ID pays once, and the Treasurer's decision reaches the member", async () => {
  const ok = { type: "pay", invoice: "INV-2611", via: "bKash", trx: "bk12345678", sender: "01712345678" };
  await refused(400, act("tasnim", { ...ok, trx: "short" }));
  await refused(400, act("tasnim", { ...ok, trx: "BK1234'; DROP" }));
  await refused(400, act("tasnim", { ...ok, sender: "12345" }));
  await refused(400, act("tasnim", { ...ok, via: "PayPal" }));
  await refused(403, act("tasnim", { ...ok, invoice: "INV-0000" }));
  await act("tasnim", ok);
  await refused(409, act("tasnim", { ...ok, trx: "BK99999999" })); // one live payment per invoice
  await refused(409, act("priya", ok)); // someone else's transaction ID
  const race = await Promise.allSettled(["shuvo", "imran"].map((u) => act(u, { ...ok, trx: "RACE000001" })));
  assert.equal(race.filter((x) => x.status === "fulfilled").length, 1, "the same ID submitted twice at once is accepted once");
  assert.equal((await st("tasnim")).s.pay["INV-2611"].status, "pending");
  assert.equal(earned((await st("tasnim")).s), 0, "an unverified payment earns nothing");

  const row = (await st("anika")).office.queue!.find((q) => q.trx === "BK12345678")!;
  await refused(403, act("tasnim", { type: "decide", kind: "payment", id: row.id, to: "verified" }));
  await refused(403, act("tanvir", { type: "decide", kind: "payment", id: row.id, to: "verified" })); // the President sees, never verifies
  await refused(400, act("anika", { type: "decide", kind: "payment", id: row.id, to: "paid" }));
  await act("anika", { type: "decide", kind: "payment", id: row.id, to: "verified" });
  await refused(409, act("anika", { type: "decide", kind: "payment", id: row.id, to: "rejected", reason: "changed my mind" })); // decided once
  assert.equal((await st("tasnim")).s.pay["INV-2611"].status, "verified");
  assert.equal(earned((await st("tasnim")).s), XP.pay);
});
test("payments: a rejected payment can be resubmitted; nobody verifies their own", async () => {
  await refused(403, act("anika", { type: "pay", invoice: "INV-2612", via: "Nagad", trx: "NGOWN00001", sender: "01812345678" })); // an event fee, and she has not registered
  await act("anika", { type: "toggle", list: "reg", id: "hack-night", on: true });
  await act("anika", { type: "pay", invoice: "INV-2612", via: "Nagad", trx: "NGOWN00001", sender: "01812345678" });
  const mine = (await st("anika")).office.queue!.find((q) => q.trx === "NGOWN00001")!;
  await refused(409, act("anika", { type: "decide", kind: "payment", id: mine.id, to: "verified" }));
  await refused(400, act("admin", { type: "decide", kind: "payment", id: mine.id, to: "rejected" })); // a rejection needs a reason
  await act("admin", { type: "decide", kind: "payment", id: mine.id, to: "rejected", reason: "Amount in the SMS was 100, not 150" });
  const after = await st("anika");
  assert.equal(after.s.pay["INV-2612"].status, "rejected", "the member is shown the rejection, not a silent reset");
  assert.ok(after.inbox.some((n) => /was rejected: Amount in the SMS was 100, not 150/.test(n.text)), "with the Treasurer's reason");
  await act("anika", { type: "pay", invoice: "INV-2612", via: "Nagad", trx: "NGOWN00001", sender: "01812345678" }); // the same ID again: a wrong rejection is recoverable
  assert.equal((await st("anika")).s.pay["INV-2612"].status, "pending");
  await refused(409, act("priya", { type: "pay", invoice: "INV-2611", via: "Nagad", trx: "NGOWN00001", sender: "01812345678" })); // but it is taken again while live
});
test("expenses: filed by the committee; the Treasurer decides small ones and passes large ones up; the President decides those", async () => {
  await refused(403, act("tasnim", { type: "expense", what: "Pizza for me", amount: 500, event: "" }));
  await refused(400, act("nadia", { type: "expense", what: "Printed problem sets", amount: 0, event: "" }));
  await refused(400, act("nadia", { type: "expense", what: "Printed problem sets", amount: 12.5, event: "" }));
  await act("nadia", { type: "expense", what: "Weekly #43 prizes", amount: 1200, event: "Weekly #43" });
  const mine = (await st("nadia")).myExpenses;
  assert.deepEqual(mine.map((e) => [e.what, e.status]), [["Weekly #43 prizes", "pending"], ["ICPC Mock #3 printed problem sets", "pending"]], "a requester sees her own requests and their status");
  assert.equal((await st("nadia")).office.expenses, undefined, "but not the approval queue");
  const list = (await st("anika")).office.expenses!, small = list.find((e) => e.amount === 900)!.id, big = list.find((e) => e.amount === 14400)!.id;
  await refused(403, act("tasnim", { type: "decide", kind: "expense", id: small, to: "approved" }));
  await act("anika", { type: "decide", kind: "expense", id: small, to: "approved" });
  await refused(409, act("tanvir", { type: "decide", kind: "expense", id: small, to: "rejected" }));
  await refused(400, act("anika", { type: "decide", kind: "expense", id: big, to: "approved" })); // above the threshold
  await refused(400, act("tanvir", { type: "decide", kind: "expense", id: big, to: "approved" })); // not even the President skips the first signature
  await refused(400, act("admin", { type: "decide", kind: "expense", id: big, to: "approved" }));
  await act("anika", { type: "decide", kind: "expense", id: big, to: "sent to President" });
  await refused(409, act("anika", { type: "decide", kind: "expense", id: big, to: "sent to President" }));
  assert.ok((await st("tanvir")).inbox.some((n) => /expense request/.test(n.text)), "the President is told something is waiting");
  await act("tanvir", { type: "decide", kind: "expense", id: big, to: "approved" });
  await refused(403, act("anika", { type: "decide", kind: "expense", id: "EXP-99999", to: "approved" }));
  const two = await Promise.allSettled([act("anika", { type: "decide", kind: "expense", id: mine[0].id, to: "approved" }), act("admin", { type: "decide", kind: "expense", id: mine[0].id, to: "rejected" })]);
  assert.equal(two.filter((x) => x.status === "fulfilled").length, 1, "two simultaneous decisions: exactly one stands");
  assert.deepEqual([(await st("anika")).s.exp[small], (await st("anika")).s.exp[big]], ["approved", "approved"]);
  assert.equal((await st("nadia")).myExpenses.find((e) => e.amount === 900)!.status, "approved", "the requester sees the outcome");
  assert.deepEqual((await st("sadia")).s.exp, {}, "the Secretary has no view of expense decisions");
});
test("waivers: the Treasurer proposes, only the President waives", async () => {
  await refused(400, act("anika", { type: "decide", kind: "waiver", id: "w1", to: "waived" }));
  await refused(400, act("tanvir", { type: "decide", kind: "waiver", id: "w1", to: "waived" })); // the President cannot waive what nobody proposed
  await act("tanvir", { type: "decide", kind: "waiver", id: "w2", to: "proposed" });
  await refused(403, act("tanvir", { type: "decide", kind: "waiver", id: "w2", to: "waived" })); // nor decide his own proposal
  await act("admin", { type: "decide", kind: "waiver", id: "w2", to: "rejected" });
  await act("anika", { type: "decide", kind: "waiver", id: "w1", to: "proposed" });
  await act("tanvir", { type: "decide", kind: "waiver", id: "w1", to: "waived" });
  await refused(409, act("tanvir", { type: "decide", kind: "waiver", id: "w1", to: "rejected" }));
  await refused(403, act("mehedi", { type: "decide", kind: "waiver", id: "w2", to: "proposed" }));
});

test("applications: the public form is validated; accepting creates an account with a one-time invite", async () => {
  const form = { name: "Rina Akter", sid: "2026-331-077", dept: "CSE", batch: "26", email: "Rina@Example.com", cf: "rina_a", track: "cp", why: "I want to learn graphs properly." };
  await refused(400, apply(db(), { ...form, email: "not-an-email" }));
  await refused(400, apply(db(), { ...form, batch: "twenty" }));
  await refused(400, apply(db(), { ...form, why: "x" }));
  await refused(409, apply(db(), { ...form, email: "tasnim@fecpc.example" })); // already a member
  await apply(db(), form);
  await refused(409, apply(db(), form));
  const row = (await st("sadia")).office.applications!.find((a) => a.name === "Rina Akter")!;
  await refused(403, act("tasnim", { type: "decide", kind: "application", id: row.id, to: "accepted" }));
  await refused(403, act("anika", { type: "decide", kind: "application", id: row.id, to: "accepted" }));
  const note = (await act("sadia", { type: "decide", kind: "application", id: row.id, to: "accepted" })) as string;
  await refused(409, act("sadia", { type: "decide", kind: "application", id: row.id, to: "declined" }));
  const token = /invite=([\w-]+)/.exec(note)![1];
  await refused(401, login(db(), "rina@example.com", PW)); // no password until the invite is used
  await refused(400, acceptInvite(db(), token, "short"));
  assert.equal(await sessionUser(db(), (await acceptInvite(db(), token, "rina-password-1")).token), "rina_akter");
  await refused(400, acceptInvite(db(), token, "rina-password-2")); // one time only
  const rina = await st("rina_akter");
  assert.deepEqual([rina.s.role, rina.s.solved, earned(rina.s), Object.keys(rina.office)], ["member", [], 0, []]);
  assert.ok((await st("tasnim")).members.some((m) => m.id === "rina_akter"), "the new member appears in everyone's roster");
});

test("roles: only the President or Super Admin assigns; never to oneself; Super Admin is protected", async () => {
  await refused(403, act("sadia", { type: "role", user: "zahid", role: "mentor", reason: "term roster" }));
  await refused(403, act("tanvir", { type: "role", user: "tanvir", role: "super_admin", reason: "because" }));
  await refused(403, act("tanvir", { type: "role", user: "zahid", role: "super_admin", reason: "because" }));
  await refused(404, act("tanvir", { type: "role", user: "admin", role: "member", reason: "demote the admin" }));
  await refused(400, act("tanvir", { type: "role", user: "zahid", role: "emperor", reason: "term roster" }));
  await refused(400, act("tanvir", { type: "role", user: "zahid", role: "mentor", reason: "" }));
  await act("tanvir", { type: "role", user: "zahid", role: "mentor", reason: "term roster" });
  const z = await st("zahid");
  assert.equal(z.s.role, "mentor");
  assert.deepEqual(Object.keys(z.office), ["mentees"], "new capabilities apply on the next request, without signing in again");
  assert.match((await st("tanvir")).s.log[0].what, /assigned role Mentor to Zahid Hasan \(reason: term roster\)/);
  assert.equal(z.me.role, "Mentor", "the public title follows the role");
  await act("tanvir", { type: "role", user: "nusrat", role: "member", reason: "term ended" });
  assert.equal((await st("nusrat")).me.role, null, "a demoted officer does not keep the title");
});
test("suspension signs the member out everywhere and blocks every door", async () => {
  const s = await login(db(), "sabbir@fecpc.example", PW);
  await refused(403, act("anika", { type: "suspend", user: "sabbir", on: true }));
  await refused(403, act("tanvir", { type: "suspend", user: "tanvir", on: true }));
  await act("tanvir", { type: "suspend", user: "sabbir", on: true });
  assert.equal(await sessionUser(db(), s.token), null);
  assert.equal(await loadState(db(), "sabbir"), null);
  await refused(403, login(db(), "sabbir@fecpc.example", PW));
  await refused(401, act("sabbir", { type: "checkin" }));
  assert.equal((await st("tasnim")).members.some((m) => m.id === "sabbir"), false, "members do not see suspended accounts");
  assert.equal((await st("tanvir")).members.find((m) => m.id === "sabbir")!.suspended, true);
  await act("tanvir", { type: "suspend", user: "sabbir", on: false });
  assert.ok(await loadState(db(), "sabbir"));
});

test("shared switches: members cannot flip them and do not see committee state", async () => {
  for (const dead of ["mod:Finance", "rule:Dues overdue over 30 days", "remind", "riskzahid"]) await refused(403, act("tanvir", { type: "flag", key: dead, on: true })); // switches that did nothing are gone, for everyone
  await refused(403, act("tasnim", { type: "flag", key: "unfrozen", on: true }));
  await refused(403, act("tasnim", { type: "flag", key: "susp:zahid", on: true }));
  await refused(403, act("tasnim", { type: "kv", key: "task:t1", value: "Done" }));
  await refused(403, act("tasnim", { type: "kv", key: "role:tasnim", value: "President" }));
  await refused(403, act("tasnim", { type: "flag", key: "nudgemim", on: true }));
  await act("sadia", { type: "kv", key: "task:t1", value: "Done" });
  await refused(400, act("sadia", { type: "kv", key: "task:t1", value: "Lost" }));
  await act("sadia", { type: "kv", key: "inv:eq1", value: "me" });
  await act("sadia", { type: "flag", key: "unfrozen", on: true });
  await act("tasnim", { type: "flag", key: "dark", on: true });
  const [member, officer] = [await st("tasnim"), await st("anika")];
  assert.deepEqual([officer.s.kv["task:t1"], officer.s.kv["inv:eq1"]], ["Done", "sadia"], "the whole committee sees the same board");
  assert.deepEqual([member.s.kv["task:t1"], member.s.kv["inv:eq1"]], [undefined, undefined]);
  assert.deepEqual([member.s.flags.unfrozen, member.s.flags.dark, officer.s.flags.dark], [true, true, undefined]);
});
test("preferences are validated", async () => {
  await refused(400, act("tasnim", { type: "kv", key: "conf:4A", value: "certain" }));
  await refused(403, act("tasnim", { type: "kv", key: "fantasy", value: "nadia,tanvir,sadia,rahim" }));
  await refused(403, act("tasnim", { type: "kv", key: "fantasy", value: "nadia,ghost" }));
  await act("tasnim", { type: "kv", key: "fantasy", value: "nadia,tanvir,nadia" });
  assert.equal((await st("tasnim")).s.kv.fantasy, "nadia,tanvir");
  await refused(400, act("tasnim", { type: "kv", key: "note", value: "x".repeat(201) }));
  await refused(400, act("tasnim", { type: "handle", value: "a b" }));
  await act("tasnim", { type: "handle", value: "tourist" });
  assert.equal((await st("tasnim")).s.handle, "tourist");
});
test("XP shop: needs the XP, once per item, and two simultaneous purchases cannot overspend", async () => {
  await refused(403, act("tasnim", { type: "redeem", item: "Free laptop" }));
  await refused(409, act("mim", { type: "redeem", item: "One-month fee discount" })); // 2,208 XP, costs 4,000
  await act("tasnim", { type: "redeem", item: "Sticker pack" });
  await refused(409, act("tasnim", { type: "redeem", item: "Sticker pack" }));
  const r = await Promise.allSettled(["Club T-shirt", "One-month fee discount"].map((item) => act("tasnim", { type: "redeem", item }))); // 2,500 + 4,000 > what is left
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  const t = await st("tasnim");
  assert.ok(t.me.xp + earned(t.s) - t.s.spent >= 0);
});
test("announcements: posted by officers, seen by everyone, stored as plain text", async () => {
  await refused(403, act("tasnim", { type: "announce", title: "Free pizza" }));
  await refused(400, act("sadia", { type: "announce", title: "x" }));
  await act("sadia", { type: "announce", title: "  Lab 3 is closed\u0000 on <b>Friday</b>  " });
  const news = (await st("tasnim")).news[0];
  assert.deepEqual([news.title, news.by], ["Lab 3 is closed  on <b>Friday</b>", "Sadia Islam"]); // kept as text; the page escapes it
  await act("tasnim", { type: "toggle", list: "read", id: news.id });
  assert.ok((await st("tasnim")).s.read.includes(news.id));
});
test("export: capability-gated, audited, and safe to open in a spreadsheet", async () => {
  await refused(403, exportMembers("tasnim"));
  await db().query(`update users set name = '=HYPERLINK("http://x","click")' where id = 'jannat'`);
  const csv = await exportMembers("anika");
  assert.match(csv, /^name,handle,batch,dept,rating,solved,status\n/);
  assert.equal(csv.includes("Site Admin"), false, "the operator account is not a member");
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"",""click"")"`), "formula cells are neutralised");
  assert.match((await st("tanvir")).s.log[0].what, /exported member data/);
});
test("the action endpoint refuses anything it does not know", async () => {
  for (const bad of [null, "x", {}, { type: "constructor" }, { type: "__proto__" }, { type: "toString" }, { type: "dropTables" }]) await refused(400, act("tasnim", bad));
  await refused(401, act("ghost", { type: "checkin" }));
  await refused(400, act("tanvir", { type: "rollover" })); // removed: it only ever wrote a log line
  await refused(403, act("tasnim", { type: "invite", user: "zahid" }));
});

test("mentors: mentees, announcements and nudges are scoped to the mentor's own people", async () => {
  const [mehedi, rahim, nadia] = [await st("mehedi"), await st("rahim"), await st("nadia")];
  assert.deepEqual(mehedi.office.mentees!.map((m) => m.id).sort(), ["jannat", "mim", "tasnim", "zahid"]);
  assert.deepEqual(rahim.office.mentees, [], "another mentor sees none of them");
  assert.equal(nadia.office.mentees!.length, 4, "the CP Head sees every mentee");
  await act("mehedi", { type: "announce", title: "Five DP problems this week" });
  assert.equal((await st("jannat")).news[0].title, "Five DP problems this week");
  assert.equal((await st("jannat")).news[0].mentees, true);
  assert.equal((await st("priya")).news.some((n) => n.title === "Five DP problems this week"), false, "a mentor's post never reaches the rest of the club");
  assert.equal((await st("tanvir")).news.some((n) => n.title === "Five DP problems this week"), false);
  await refused(403, act("rahim", { type: "ping", kind: "nudge", to: "jannat" }));
  await refused(403, act("priya", { type: "ping", kind: "nudge", to: "jannat" }));
  await act("mehedi", { type: "ping", kind: "nudge", to: "jannat" });
  await act("mehedi", { type: "ping", kind: "nudge", to: "jannat" }); // twice is still one
  assert.equal((await st("jannat")).inbox.filter((n) => /Mehedi Hasan nudged you/.test(n.text)).length, 1);
  assert.ok((await st("mehedi")).s.sent.includes("jannat:nudge:"));
  await refused(403, act("priya", { type: "ping", kind: "invite", to: "priya" }));
  await refused(403, act("priya", { type: "ping", kind: "invite", to: "admin" }));
  await refused(400, act("priya", { type: "ping", kind: "poke", to: "imran" }));
});
test("messages are delivered: check-ins to the mentor, suggestions anonymously to officers", async () => {
  await refused(403, act("priya", { type: "send", kind: "checkin", body: "Solved three this week." })); // no mentor assigned
  await refused(400, act("jannat", { type: "send", kind: "checkin", body: "x" }));
  await act("jannat", { type: "send", kind: "checkin", body: "Stuck on Vacations, the state is unclear." });
  const m = await st("mehedi");
  assert.equal(m.office.mentees!.find((x) => x.id === "jannat")!.checkin!.body, "Stuck on Vacations, the state is unclear.");
  assert.ok(m.inbox.some((n) => / sent a weekly check-in$/.test(n.text))); // (an earlier test renamed this member)
  await act("priya", { type: "send", kind: "suggest", body: "Please open the lab on Fridays." });
  assert.equal((await db().query(`select user_id from messages where kind = 'suggest'`)).rows[0].user_id, null, "the sender of a suggestion is not stored");
  assert.equal((await st("sadia")).office.suggestions![0].body, "Please open the lab on Fridays.");
  assert.equal((await st("priya")).office.suggestions, undefined);
  await act("priya", { type: "send", kind: "feedback", body: "More time for problem E." });
  assert.equal((await st("sadia")).office.feedback![0].body, "More time for problem E.");
  assert.equal((await st("anika")).office.feedback, undefined, "feedback goes to those who run events");
});
test("inbox is built from real records and can be cleared", async () => {
  const z = await st("rahim");
  assert.deepEqual(z.inbox.filter((n) => n.cat === "Finance").map((n) => n.id), ["n:due:INV-2611"], "term dues only: no fee for an event he never registered for");
  await act("rahim", { type: "toggle", list: "reg", id: "hack-night", on: true });
  assert.ok((await st("rahim")).inbox.some((n) => n.id === "n:due:INV-2612"));
  await act("rahim", { type: "readAll" });
  const after = await st("rahim");
  assert.ok(after.inbox.every((n) => after.s.read.includes(n.id)));
  await refused(403, act("rahim", { type: "toggle", list: "read", id: "x".repeat(79) }));
});
test("profile: a member edits their own details, within limits", async () => {
  await refused(400, act("imran", { type: "profile", name: "", dept: "CE", batch: 23 }));
  await refused(400, act("imran", { type: "profile", name: "Imran Chowdhury", dept: "CE", batch: 123 }));
  await act("imran", { type: "profile", name: "Imran  Chowdhury\u0007", dept: "CSE", batch: 24, role: "president", xp: 99999 });
  const me = (await st("imran")).me;
  assert.deepEqual([me.name, me.dept, me.batch, me.roleKey], ["Imran  Chowdhury", "CSE", 24, "member"], "only name, department and batch change");
});
test("equipment: only the holder or an admin returns it; a held item cannot be taken twice", async () => {
  await refused(409, act("nadia", { type: "kv", key: "inv:eq1", value: "me" })); // Sadia holds it from an earlier test
  await refused(409, act("nadia", { type: "kv", key: "inv:eq1", value: "" }));
  await refused(409, act("nadia", { type: "kv", key: "inv:eq2", value: "" })); // seeded as held by Nusrat
  await act("sadia", { type: "kv", key: "inv:eq1", value: "" });
  await act("nadia", { type: "kv", key: "inv:eq1", value: "me" });
  await act("tanvir", { type: "kv", key: "inv:eq1", value: "" }); // an admin can return it for her
});

test("reset links: issued only by someone who outranks the account, single-use, expiring, and they sign the old sessions out", async () => {
  const old = await login(db(), "priya@fecpc.example", PW);
  await refused(403, act("priya", { type: "invite", user: "priya" })); // own password is changed from the profile
  await refused(403, act("sadia", { type: "invite", user: "anika" })); // a Secretary cannot take over an officer's account
  await refused(403, act("sadia", { type: "invite", user: "admin" }));
  await refused(403, act("tanvir", { type: "invite", user: "admin" })); // nor the President a Super Admin's
  const note = (await act("sadia", { type: "invite", user: "priya" })) as string;
  assert.match(note, /^Password reset link for Priya Saha/);
  const token = /invite=([\w-]+)/.exec(note)![1];
  assert.equal(await sessionUser(db(), old.token), "priya", "issuing a link does not lock the member out");
  const fresh = await acceptInvite(db(), token, "a-brand-new-password");
  assert.equal(await sessionUser(db(), old.token), null);
  assert.equal(await sessionUser(db(), fresh.token), "priya");
  await refused(400, acceptInvite(db(), token, "another-password-12"));
  const again = /invite=([\w-]+)/.exec((await act("tanvir", { type: "invite", user: "anika" })) as string)![1];
  await db().query(`update users set invite_expires = now() - interval '1 minute' where id = 'anika'`);
  await refused(400, acceptInvite(db(), again, "expired-link-password"));
  assert.ok((await st("tanvir")).s.log.some((l) => /set a password with a one-time link/.test(l.what)), "auth events are in the audit log");
});
test("the operator account is not a member: no ballot, no dues, no purchases", async () => {
  await refused(403, act("admin", { type: "vote", poll: "election", option: "sadia" }));
  await refused(403, act("admin", { type: "vote", poll: "p1", option: "Sunday" }));
  await refused(403, act("admin", { type: "pay", invoice: "INV-2611", via: "bKash", trx: "ADMIN00001", sender: "01712345678" }));
  await refused(403, act("admin", { type: "redeem", item: "Sticker pack" }));
  const a = await st("admin");
  assert.equal(a.me.system, true);
  assert.equal(a.inbox.some((n) => n.id.startsWith("n:due:")), false);
  await refused(404, act("tanvir", { type: "role", user: "admin", role: "member", reason: "demote the operator" }));
});
test("sign-in limits are per account and ignore a caller-supplied address", async () => {
  for (let n = 0; n < 10; n++) await refused(401, login(db(), "shuvo@fecpc.example", "wrong-password-" + n, "10.0.0." + n)); // a new address each time changes nothing
  await refused(429, login(db(), "shuvo@fecpc.example", PW, "10.9.9.9"));
});
