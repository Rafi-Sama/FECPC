// Backend tests against a real PostgreSQL database (fecpc_test), rebuilt from the schema on every run.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { XP, earned, InviteAcceptSchema, PasswordChangeSchema } from '@fecpc/contracts';
import {
  act,
  apply,
  exportMembers,
  getFeedPostDetail,
  getIdeaDetail,
  getKudosTodayCount,
  getMemberProfile,
  kudosMilestone,
  listFeedPosts,
  listIdeas,
  listMembers,
  listRecentMilestones,
} from '../src/modules/member-area/actions.ts';
import { HttpException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { AuditService } from '../src/modules/audit/audit.service.ts';
import { ConfigService } from '../src/platform/config/config.service.ts';
import { DbService } from '../src/platform/database/db.service.ts';
import { LoginThrottlingService } from '../src/modules/auth/login-throttling.service.ts';
import { sha } from '../src/modules/member-area/tokens.ts';
import { pool, usePool } from '../src/modules/member-area/db.ts';
import {
  backfillMilestones,
  DAILY_KUDOS_CAP,
  detectCrossovers,
  syncCodeforces,
  syncUserCodeforcesStats,
} from '../src/modules/member-area/milestones.ts';
import { setup } from '../src/db/seed-data.ts';
import { loadState } from '../src/modules/member-area/state.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test'); // never the development database
const PW = 'test-password-123';
const db = () => pool();

// The API's real sign-in service, on the same pool as the member-area actions.
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
const cfg = new ConfigService();
const dbs = new DbService(cfg);
dbs.onModuleInit();
usePool(dbs.getPool());
const auth = new AuthService(dbs, cfg, new LoginThrottlingService(dbs), new AuditService(dbs));
const login = (email: string, pw: string, ip = '') => auth.login(email, pw, ip);
const acceptInvite = (token: string, pw: string) => auth.acceptInvite(token, pw, '');
/** Who a session token signs in as, or null: what AuthGuard checks. */
const sessionUser = async (token: string | undefined) =>
  token
    ? ((
        await db().query(
          `select user_id from sessions where token_hash = $1 and expires_at > now()`,
          [sha(token)],
        )
      ).rows[0]?.user_id ?? null)
    : null;
/** Google answers the token exchange with this profile. */
const googleSays = (profile: object) => {
  globalThis.fetch = (async (url: string) =>
    Response.json(
      String(url).includes('oauth2.googleapis.com/token') ? { access_token: 'at' } : profile,
    )) as typeof fetch;
};
const st = async (id: string) => (await loadState(db(), id))!;
/** Asserts the action is refused with this HTTP status. */
const refused = (status: number, p: Promise<unknown>) =>
  assert.rejects(
    p,
    (e: unknown) => e instanceof HttpException && e.getStatus() === status,
    `expected a ${status} refusal`,
  );

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  assert.equal(await setup(db(), PW), true);
  assert.equal(await setup(db(), PW), false, 'setup is idempotent and never reseeds');
});
after(() => dbs.onModuleDestroy());

test('auth: password login, sessions, logout', async () => {
  const s = await login(' Tasnim@FECPC.example ', PW);
  assert.equal(await sessionUser(s.token), 'tasnim');
  assert.equal(await sessionUser(s.token + 'x'), null);
  assert.equal(await sessionUser(undefined), null);
  await refused(401, login('tasnim@fecpc.example', 'wrong-password'));
  await refused(401, login('nobody@fecpc.example', PW)); // same answer as a wrong password: no account enumeration
  await auth.logout(s.token);
  assert.equal(await sessionUser(s.token), null);
  const raw = (await db().query(`select token_hash from sessions limit 1`)).rows[0];
  assert.ok(!raw || raw.token_hash.length === 64, 'only a hash of the session token is stored');
});
test('auth: expired sessions stop working', async () => {
  const s = await login('zahid@fecpc.example', PW);
  await db().query(
    `update sessions set expires_at = now() - interval '1 second' where user_id = 'zahid'`,
  );
  assert.equal(await sessionUser(s.token), null);
});
test('auth: changing a password signs out every other device', async () => {
  const old = await login('mim@fecpc.example', PW);
  await refused(401, auth.changePassword('mim', 'not-my-password', 'another-password-1'));
  assert.equal(
    PasswordChangeSchema.safeParse({ currentPassword: PW, newPassword: 'short' }).success,
    false,
  );
  const fresh = await auth.changePassword('mim', PW, 'another-password-1');
  assert.equal(await sessionUser(old.token), null);
  assert.equal(await sessionUser(fresh), 'mim');
  await refused(401, login('mim@fecpc.example', PW));
  assert.ok(await login('mim@fecpc.example', 'another-password-1'));
});
test('auth: Google sign-in only for a verified address that is already a member', async () => {
  const realFetch = globalThis.fetch;
  try {
    googleSays({ sub: 'g1', email: 'stranger@gmail.com', email_verified: true });
    await refused(403, auth.loginWithGoogle('code'));
    googleSays({ sub: 'g1', email: 'priya@fecpc.example', email_verified: false });
    await refused(401, auth.loginWithGoogle('code'));
    googleSays({ sub: 'g1', email: 'priya@fecpc.example', email_verified: true });
    assert.equal(await sessionUser((await auth.loginWithGoogle('code')).token), 'priya');
    googleSays({ sub: 'someone-else', email: 'priya@fecpc.example', email_verified: true });
    await refused(403, auth.loginWithGoogle('code')); // the link cannot be taken over
    globalThis.fetch = (async () => Response.json({ error: 'invalid_grant' })) as typeof fetch;
    await refused(401, auth.loginWithGoogle('forged-code')); // no code, no identity
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('visibility: each role receives only the datasets it has a capability for', async () => {
  const member = await st('tasnim'),
    mentor = await st('mehedi'),
    treasurer = await st('anika'),
    secretary = await st('sadia'),
    president = await st('tanvir'),
    cpHead = await st('nadia');
  assert.deepEqual(Object.keys(member.office), []);
  assert.deepEqual([member.s.log, member.s.queue, member.s.exp, member.s.apps], [[], {}, {}, {}]);
  assert.deepEqual(Object.keys(mentor.office), ['mentees']);
  assert.deepEqual(Object.keys(cpHead.office).sort(), ['mentees', 'ops']);
  assert.deepEqual(Object.keys(treasurer.office).sort(), [
    'expenses',
    'fund',
    'ops',
    'queue',
    'suggestions',
    'waivers',
  ]);
  assert.equal(treasurer.office.queue!.length, 4);
  assert.match(treasurer.office.queue![0]!.sender, /^\d{3}••••\d{4}$/, 'sender numbers are masked');
  assert.deepEqual(Object.keys(secretary.office).sort(), [
    'applications',
    'events',
    'feedback',
    'ops',
    'suggestions',
  ]);
  assert.deepEqual(secretary.s.log, [], 'the Secretary cannot read the audit log');
  assert.ok(
    Array.isArray(president.s.log) && president.office.queue,
    'the President sees the log and the payment queue',
  );
  assert.equal(
    president.s.log.some((l) => /PAY-897|EXP-069/.test(l.what)),
    false,
    'the audit log starts empty: nothing fabricated is seeded into it',
  );
  assert.equal(JSON.stringify(member).includes('pass_hash'), false);
  assert.equal(
    member.members.some((m) => 'email' in m),
    false,
    "no member's email is in the roster",
  );
  assert.equal(
    member.members.some(
      (m) => 'roleKey' in m || 'suspended' in m || 'system' in m || 'mentorId' in m,
    ),
    false,
    'account-management fields stay with the officers who manage accounts',
  );
  assert.equal(
    member.members.some((m) => m.id === 'admin'),
    false,
    'the operator account is not a person and is not listed',
  );
  assert.equal(
    secretary.members.find((m) => m.id === 'tanvir')?.roleKey,
    'president',
    'officers who manage accounts see role keys',
  );
  assert.equal(cpHead.office.ops!.sponsors, undefined, 'no finance capability, no sponsor ledger');
  assert.ok(treasurer.office.ops!.sponsors);
  assert.equal(
    president.members.some((m) => m.id === 'admin'),
    false,
    'only a Super Admin is shown the operator account',
  );
  assert.deepEqual(
    Object.keys(secretary.office.events!).sort(),
    ['arrived', 'code', 'event', 'registrants'],
    'event organisers get the room code and registrants',
  );
  assert.equal(member.office.events, undefined);
  assert.equal(member.me.email, 'tasnim@fecpc.example');
});

test('progress: only real items are accepted; XP follows', async () => {
  const x0 = earned((await st('shuvo')).s);
  await act('shuvo', { type: 'toggle', list: 'solved', id: '282A' });
  await refused(403, act('shuvo', { type: 'toggle', list: 'solved', id: '9999Z' }));
  await refused(400, act('shuvo', { type: 'toggle', list: 'spent', id: 'x' }));
  await refused(400, act('shuvo', { type: 'toggle', list: 'solved', id: '<script>' }));
  await act('shuvo', { type: 'checkin' });
  await act('shuvo', { type: 'toggle', list: 'lessons', id: 'dp:0' });
  await refused(403, act('shuvo', { type: 'toggle', list: 'lessons', id: 'dp:99' }));
  const s = (await st('shuvo')).s;
  assert.ok(s.solved.includes('282A') && s.checkin);
  assert.equal(earned(s) - x0, XP.solve + XP.checkin + XP.lesson);
  await act('shuvo', { type: 'toggle', list: 'solved', id: '282A' });
  assert.equal((await st('shuvo')).s.solved.includes('282A'), false);
});
test('progress: simultaneous writes by one member never lose an update', async () => {
  const ids = ['282A', '118A', '266A', '160A', '1352C', '26A', '230B', '1512B'];
  await Promise.all(
    ids.map((id) => act('imran', { type: 'toggle', list: 'solved', id, on: true })),
  );
  const solved = (await st('imran')).s.solved;
  for (const id of ids) assert.ok(solved.includes(id), id);
});
test('quiz is scored on the server; the client cannot send a score', async () => {
  await act('shuvo', { type: 'quiz', course: 'dp', picks: [1, 2, 2], score: 3 });
  assert.equal((await st('shuvo')).s.quiz.dp, 2);
  await refused(400, act('shuvo', { type: 'quiz', course: 'dp', picks: [1] }));
  await refused(403, act('shuvo', { type: 'quiz', course: 'nope', picks: [0, 0, 0] }));
  await act('shuvo', { type: 'quizReset', course: 'dp' });
  assert.equal((await st('shuvo')).s.quiz.dp, undefined);
});

test('sync: registrations, kudos and poll votes are counted across members', async () => {
  await act('shuvo', { type: 'toggle', list: 'reg', id: 'git-night' });
  await act('priya', { type: 'toggle', list: 'reg', id: 'git-night' });
  await act('priya', { type: 'toggle', list: 'kudos', id: 'f1' });
  await act('shuvo', { type: 'vote', poll: 'p1', option: 'Sunday' });
  await act('priya', { type: 'vote', poll: 'p1', option: 'Sunday' });
  await act('priya', { type: 'vote', poll: 'p1', option: 'Saturday' }); // a poll vote can be changed
  await refused(403, act('priya', { type: 'vote', poll: 'p1', option: 'Never' }));
  await refused(403, act('priya', { type: 'toggle', list: 'reg', id: 'no-such-event' }));
  const seen = await st('tasnim');
  assert.equal(seen.counts.reg['git-night'], 2);
  assert.equal(seen.counts.kudos.f1, 1);
  assert.deepEqual(seen.counts.votes.p1, { Sunday: 1, Saturday: 1 });
});
test('election voting is removed', async () => {
  await refused(403, act('shuvo', { type: 'vote', poll: 'election', option: 'sadia' }));
  assert.equal((await st('shuvo')).s.votes.election, undefined);
});
test('volunteer shifts: a full shift refuses, and the last place goes to exactly one of two simultaneous sign-ups', async () => {
  await refused(409, act('shuvo', { type: 'toggle', list: 'present', id: 'vol:Print runner' })); // 4 of 4
  await refused(403, act('shuvo', { type: 'toggle', list: 'present', id: 'dp-bootcamp' })); // class attendance needs the code
  const r = await Promise.allSettled(
    ['shuvo', 'priya', 'imran'].map((u) =>
      act(u, { type: 'toggle', list: 'present', id: 'vol:Registration desk' }),
    ),
  ); // 3 of 4
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await st('tasnim')).counts.vol['vol:Registration desk'], 1);
});
test('attendance needs the room code', async () => {
  await refused(400, act('shuvo', { type: 'attend', code: 'WRONG1' }));
  await act('shuvo', { type: 'attend', code: 'k7-4q-x2' });
  assert.ok((await st('shuvo')).s.present.includes('dp-bootcamp'));
});

test("payments: validated, one transaction ID pays once, and the Treasurer's decision reaches the member", async () => {
  const ok = {
    type: 'pay',
    invoice: 'INV-2611',
    via: 'bKash',
    trx: 'bk12345678',
    sender: '01712345678',
  };
  await refused(400, act('tasnim', { ...ok, trx: 'short' }));
  await refused(400, act('tasnim', { ...ok, trx: "BK1234'; DROP" }));
  await refused(400, act('tasnim', { ...ok, sender: '12345' }));
  await refused(400, act('tasnim', { ...ok, via: 'PayPal' }));
  await refused(403, act('tasnim', { ...ok, invoice: 'INV-0000' }));
  await act('tasnim', ok);
  await refused(409, act('tasnim', { ...ok, trx: 'BK99999999' })); // one live payment per invoice
  await refused(409, act('priya', ok)); // someone else's transaction ID
  const race = await Promise.allSettled(
    ['shuvo', 'imran'].map((u) => act(u, { ...ok, trx: 'RACE000001' })),
  );
  assert.equal(
    race.filter((x) => x.status === 'fulfilled').length,
    1,
    'the same ID submitted twice at once is accepted once',
  );
  assert.equal((await st('tasnim')).s.pay['INV-2611']!.status, 'pending');
  assert.equal(earned((await st('tasnim')).s), 0, 'an unverified payment earns nothing');

  const row = (await st('anika')).office.queue!.find((q) => q.trx === 'BK12345678')!;
  await refused(
    403,
    act('tasnim', { type: 'decide', kind: 'payment', id: row.id, to: 'verified' }),
  );
  await refused(
    403,
    act('tanvir', { type: 'decide', kind: 'payment', id: row.id, to: 'verified' }),
  ); // the President sees, never verifies
  await refused(400, act('anika', { type: 'decide', kind: 'payment', id: row.id, to: 'paid' }));
  await act('anika', { type: 'decide', kind: 'payment', id: row.id, to: 'verified' });
  await refused(
    409,
    act('anika', {
      type: 'decide',
      kind: 'payment',
      id: row.id,
      to: 'rejected',
      reason: 'changed my mind',
    }),
  ); // decided once
  assert.equal((await st('tasnim')).s.pay['INV-2611']!.status, 'verified');
  assert.equal(earned((await st('tasnim')).s), XP.pay);
});
test('payments: a rejected payment can be resubmitted; nobody verifies their own', async () => {
  await refused(
    403,
    act('anika', {
      type: 'pay',
      invoice: 'INV-2612',
      via: 'Nagad',
      trx: 'NGOWN00001',
      sender: '01812345678',
    }),
  ); // an event fee, and she has not registered
  await act('anika', { type: 'toggle', list: 'reg', id: 'hack-night', on: true });
  await act('anika', {
    type: 'pay',
    invoice: 'INV-2612',
    via: 'Nagad',
    trx: 'NGOWN00001',
    sender: '01812345678',
  });
  const mine = (await st('anika')).office.queue!.find((q) => q.trx === 'NGOWN00001')!;
  await refused(
    409,
    act('anika', { type: 'decide', kind: 'payment', id: mine.id, to: 'verified' }),
  );
  await refused(
    400,
    act('admin', { type: 'decide', kind: 'payment', id: mine.id, to: 'rejected' }),
  ); // a rejection needs a reason
  await act('admin', {
    type: 'decide',
    kind: 'payment',
    id: mine.id,
    to: 'rejected',
    reason: 'Amount in the SMS was 100, not 150',
  });
  const after = await st('anika');
  assert.equal(
    after.s.pay['INV-2612']!.status,
    'rejected',
    'the member is shown the rejection, not a silent reset',
  );
  assert.ok(
    after.inbox.some((n) => /was rejected: Amount in the SMS was 100, not 150/.test(n.text)),
    "with the Treasurer's reason",
  );
  await act('anika', {
    type: 'pay',
    invoice: 'INV-2612',
    via: 'Nagad',
    trx: 'NGOWN00001',
    sender: '01812345678',
  }); // the same ID again: a wrong rejection is recoverable
  assert.equal((await st('anika')).s.pay['INV-2612']!.status, 'pending');
  await refused(
    409,
    act('priya', {
      type: 'pay',
      invoice: 'INV-2611',
      via: 'Nagad',
      trx: 'NGOWN00001',
      sender: '01812345678',
    }),
  ); // but it is taken again while live
});
test('expenses: filed by the committee; the Treasurer decides small ones and passes large ones up; the President decides those', async () => {
  await refused(
    403,
    act('tasnim', { type: 'expense', what: 'Pizza for me', amount: 500, event: '' }),
  );
  await refused(
    400,
    act('nadia', { type: 'expense', what: 'Printed problem sets', amount: 0, event: '' }),
  );
  await refused(
    400,
    act('nadia', { type: 'expense', what: 'Printed problem sets', amount: 12.5, event: '' }),
  );
  await act('nadia', {
    type: 'expense',
    what: 'Weekly #43 prizes',
    amount: 1200,
    event: 'Weekly #43',
  });
  const mine = (await st('nadia')).myExpenses;
  assert.deepEqual(
    mine.map((e) => [e.what, e.status]),
    [
      ['Weekly #43 prizes', 'pending'],
      ['ICPC Mock #3 printed problem sets', 'pending'],
    ],
    'a requester sees her own requests and their status',
  );
  assert.equal((await st('nadia')).office.expenses, undefined, 'but not the approval queue');
  const list = (await st('anika')).office.expenses!,
    small = list.find((e) => e.amount === 900)!.id,
    big = list.find((e) => e.amount === 14400)!.id;
  await refused(403, act('tasnim', { type: 'decide', kind: 'expense', id: small, to: 'approved' }));
  await act('anika', { type: 'decide', kind: 'expense', id: small, to: 'approved' });
  await refused(409, act('tanvir', { type: 'decide', kind: 'expense', id: small, to: 'rejected' }));
  await refused(400, act('anika', { type: 'decide', kind: 'expense', id: big, to: 'approved' })); // above the threshold
  await refused(400, act('tanvir', { type: 'decide', kind: 'expense', id: big, to: 'approved' })); // not even the President skips the first signature
  await refused(400, act('admin', { type: 'decide', kind: 'expense', id: big, to: 'approved' }));
  await act('anika', { type: 'decide', kind: 'expense', id: big, to: 'sent to President' });
  await refused(
    409,
    act('anika', { type: 'decide', kind: 'expense', id: big, to: 'sent to President' }),
  );
  assert.ok(
    (await st('tanvir')).inbox.some((n) => /expense request/.test(n.text)),
    'the President is told something is waiting',
  );
  await act('tanvir', { type: 'decide', kind: 'expense', id: big, to: 'approved' });
  await refused(
    403,
    act('anika', { type: 'decide', kind: 'expense', id: 'EXP-99999', to: 'approved' }),
  );
  const two = await Promise.allSettled([
    act('anika', { type: 'decide', kind: 'expense', id: mine[0]!.id, to: 'approved' }),
    act('admin', { type: 'decide', kind: 'expense', id: mine[0]!.id, to: 'rejected' }),
  ]);
  assert.equal(
    two.filter((x) => x.status === 'fulfilled').length,
    1,
    'two simultaneous decisions: exactly one stands',
  );
  assert.deepEqual(
    [(await st('anika')).s.exp[small], (await st('anika')).s.exp[big]],
    ['approved', 'approved'],
  );
  assert.equal(
    (await st('nadia')).myExpenses.find((e) => e.amount === 900)!.status,
    'approved',
    'the requester sees the outcome',
  );
  assert.deepEqual((await st('sadia')).s.exp, {}, 'the Secretary has no view of expense decisions');
});
test('waivers: the Treasurer proposes, only the President waives', async () => {
  await refused(400, act('anika', { type: 'decide', kind: 'waiver', id: 'w1', to: 'waived' }));
  await refused(400, act('tanvir', { type: 'decide', kind: 'waiver', id: 'w1', to: 'waived' })); // the President cannot waive what nobody proposed
  await act('tanvir', { type: 'decide', kind: 'waiver', id: 'w2', to: 'proposed' });
  await refused(403, act('tanvir', { type: 'decide', kind: 'waiver', id: 'w2', to: 'waived' })); // nor decide his own proposal
  await act('admin', { type: 'decide', kind: 'waiver', id: 'w2', to: 'rejected' });
  await act('anika', { type: 'decide', kind: 'waiver', id: 'w1', to: 'proposed' });
  await act('tanvir', { type: 'decide', kind: 'waiver', id: 'w1', to: 'waived' });
  await refused(409, act('tanvir', { type: 'decide', kind: 'waiver', id: 'w1', to: 'rejected' }));
  await refused(403, act('mehedi', { type: 'decide', kind: 'waiver', id: 'w2', to: 'proposed' }));
});

test('applications: the public form is validated; accepting creates an account with a one-time invite', async () => {
  const form = {
    name: 'Rina Akter',
    sid: '2026-331-077',
    dept: 'CSE',
    batch: '26',
    email: 'Rina@Example.com',
    cf: 'rina_a',
    track: 'cp',
    why: 'I want to learn graphs properly.',
  };
  await refused(400, apply(db(), { ...form, email: 'not-an-email' }));
  await refused(400, apply(db(), { ...form, batch: 'twenty' }));
  await refused(400, apply(db(), { ...form, why: 'x' }));
  await refused(409, apply(db(), { ...form, email: 'tasnim@fecpc.example' })); // already a member
  await apply(db(), form);
  await refused(409, apply(db(), form));
  const row = (await st('sadia')).office.applications!.find((a) => a.name === 'Rina Akter')!;
  await refused(
    403,
    act('tasnim', { type: 'decide', kind: 'application', id: row.id, to: 'accepted' }),
  );
  await refused(
    403,
    act('anika', { type: 'decide', kind: 'application', id: row.id, to: 'accepted' }),
  );
  const note = (await act('sadia', {
    type: 'decide',
    kind: 'application',
    id: row.id,
    to: 'accepted',
  })) as string;
  await refused(
    409,
    act('sadia', { type: 'decide', kind: 'application', id: row.id, to: 'declined' }),
  );
  const token = /invite=([\w-]+)/.exec(note)![1]!;
  await refused(401, login('rina@example.com', PW)); // no password until the invite is used
  assert.equal(InviteAcceptSchema.safeParse({ token, password: 'short' }).success, false);
  assert.equal(
    await sessionUser((await acceptInvite(token, 'rina-password-1')).token),
    'rina_akter',
  );
  await refused(410, acceptInvite(token, 'rina-password-2')); // one time only
  const rina = await st('rina_akter');
  assert.deepEqual(
    [rina.s.role, rina.s.solved, earned(rina.s), Object.keys(rina.office)],
    ['member', [], 0, []],
  );
  assert.ok(
    (await st('tasnim')).members.some((m) => m.id === 'rina_akter'),
    "the new member appears in everyone's roster",
  );
});

test('roles: only the President or Super Admin assigns; never to oneself; Super Admin is protected', async () => {
  await refused(
    403,
    act('sadia', { type: 'role', user: 'zahid', role: 'mentor', reason: 'term roster' }),
  );
  await refused(
    403,
    act('tanvir', { type: 'role', user: 'tanvir', role: 'super_admin', reason: 'because' }),
  );
  await refused(
    403,
    act('tanvir', { type: 'role', user: 'zahid', role: 'super_admin', reason: 'because' }),
  );
  await refused(
    404,
    act('tanvir', { type: 'role', user: 'admin', role: 'member', reason: 'demote the admin' }),
  );
  await refused(
    400,
    act('tanvir', { type: 'role', user: 'zahid', role: 'emperor', reason: 'term roster' }),
  );
  await refused(400, act('tanvir', { type: 'role', user: 'zahid', role: 'mentor', reason: '' }));
  await act('tanvir', { type: 'role', user: 'zahid', role: 'mentor', reason: 'term roster' });
  const z = await st('zahid');
  assert.equal(z.s.role, 'mentor');
  assert.deepEqual(
    Object.keys(z.office),
    ['mentees'],
    'new capabilities apply on the next request, without signing in again',
  );
  assert.match(
    (await st('tanvir')).s.log[0]!.what,
    /assigned role Mentor to Zahid Hasan \(reason: term roster\)/,
  );
  assert.equal(z.me.role, 'Mentor', 'the public title follows the role');
  await act('tanvir', { type: 'role', user: 'nusrat', role: 'member', reason: 'term ended' });
  assert.equal((await st('nusrat')).me.role, null, 'a demoted officer does not keep the title');
});
test('suspension signs the member out everywhere and blocks every door', async () => {
  const s = await login('sabbir@fecpc.example', PW);
  await refused(403, act('anika', { type: 'suspend', user: 'sabbir', on: true }));
  await refused(403, act('tanvir', { type: 'suspend', user: 'tanvir', on: true }));
  await act('tanvir', { type: 'suspend', user: 'sabbir', on: true });
  assert.equal(await sessionUser(s.token), null);
  assert.equal(await loadState(db(), 'sabbir'), null);
  await refused(403, login('sabbir@fecpc.example', PW));
  await refused(401, act('sabbir', { type: 'checkin' }));
  assert.equal(
    (await st('tasnim')).members.some((m) => m.id === 'sabbir'),
    false,
    'members do not see suspended accounts',
  );
  assert.equal((await st('tanvir')).members.find((m) => m.id === 'sabbir')!.suspended, true);
  await act('tanvir', { type: 'suspend', user: 'sabbir', on: false });
  assert.ok(await loadState(db(), 'sabbir'));
});

test('shared switches: members cannot flip them and do not see committee state', async () => {
  for (const dead of ['mod:Finance', 'rule:Dues overdue over 30 days', 'remind', 'riskzahid'])
    await refused(403, act('tanvir', { type: 'flag', key: dead, on: true })); // switches that did nothing are gone, for everyone
  await refused(403, act('tasnim', { type: 'flag', key: 'unfrozen', on: true }));
  await refused(403, act('tasnim', { type: 'flag', key: 'susp:zahid', on: true }));
  await refused(403, act('tasnim', { type: 'kv', key: 'task:t1', value: 'Done' }));
  await refused(403, act('tasnim', { type: 'kv', key: 'role:tasnim', value: 'President' }));
  await refused(403, act('tasnim', { type: 'flag', key: 'nudgemim', on: true }));
  await act('sadia', { type: 'kv', key: 'task:t1', value: 'Done' });
  await refused(400, act('sadia', { type: 'kv', key: 'task:t1', value: 'Lost' }));
  await act('sadia', { type: 'kv', key: 'inv:eq1', value: 'me' });
  await act('sadia', { type: 'flag', key: 'unfrozen', on: true });
  await act('tasnim', { type: 'flag', key: 'dark', on: true });
  const [member, officer] = [await st('tasnim'), await st('anika')];
  assert.deepEqual(
    [officer.s.kv['task:t1'], officer.s.kv['inv:eq1']],
    ['Done', 'sadia'],
    'the whole committee sees the same board',
  );
  assert.deepEqual([member.s.kv['task:t1'], member.s.kv['inv:eq1']], [undefined, undefined]);
  assert.deepEqual(
    [member.s.flags.unfrozen, member.s.flags.dark, officer.s.flags.dark],
    [true, true, undefined],
  );
});
test('preferences are validated', async () => {
  await refused(400, act('tasnim', { type: 'kv', key: 'conf:4A', value: 'certain' }));
  await refused(
    403,
    act('tasnim', { type: 'kv', key: 'fantasy', value: 'nadia,tanvir,sadia,rahim' }),
  );
  await refused(403, act('tasnim', { type: 'kv', key: 'fantasy', value: 'nadia,ghost' }));
  await act('tasnim', { type: 'kv', key: 'fantasy', value: 'nadia,tanvir,nadia' });
  assert.equal((await st('tasnim')).s.kv.fantasy, 'nadia,tanvir');
  await refused(400, act('tasnim', { type: 'kv', key: 'note', value: 'x'.repeat(201) }));
  await refused(400, act('tasnim', { type: 'handle', value: 'a b' }));
  await act('tasnim', { type: 'handle', value: 'tourist' });
  assert.equal((await st('tasnim')).s.handle, 'tourist');
});
test('XP shop: needs the XP, once per item, and two simultaneous purchases cannot overspend', async () => {
  await refused(403, act('tasnim', { type: 'redeem', item: 'Free laptop' }));
  await refused(409, act('mim', { type: 'redeem', item: 'One-month fee discount' })); // 2,208 XP, costs 4,000
  await act('tasnim', { type: 'redeem', item: 'Sticker pack' });
  await refused(409, act('tasnim', { type: 'redeem', item: 'Sticker pack' }));
  const r = await Promise.allSettled(
    ['Club T-shirt', 'One-month fee discount'].map((item) =>
      act('tasnim', { type: 'redeem', item }),
    ),
  ); // 2,500 + 4,000 > what is left
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  const t = await st('tasnim');
  assert.ok(t.me.xp + earned(t.s) - t.s.spent >= 0);
});
test('announcements: posted by officers, seen by everyone, stored as plain text', async () => {
  await refused(403, act('tasnim', { type: 'announce', title: 'Free pizza' }));
  await refused(400, act('sadia', { type: 'announce', title: 'x' }));
  await act('sadia', { type: 'announce', title: '  Lab 3 is closed\u0000 on <b>Friday</b>  ' });
  const news = (await st('tasnim')).news[0]!;
  assert.deepEqual([news.title, news.by], ['Lab 3 is closed  on <b>Friday</b>', 'Sadia Islam']); // kept as text; the page escapes it
  await act('tasnim', { type: 'toggle', list: 'read', id: news.id });
  assert.ok((await st('tasnim')).s.read.includes(news.id));
});
test('export: capability-gated, audited, and safe to open in a spreadsheet', async () => {
  await refused(403, exportMembers('tasnim'));
  await db().query(`update users set name = '=HYPERLINK("http://x","click")' where id = 'jannat'`);
  const csv = await exportMembers('anika');
  assert.match(csv, /^name,handle,batch,dept,rating,solved,status\n/);
  assert.equal(csv.includes('Site Admin'), false, 'the operator account is not a member');
  assert.ok(csv.includes(`"'=HYPERLINK(""http://x"",""click"")"`), 'formula cells are neutralised');
  assert.match((await st('tanvir')).s.log[0]!.what, /exported member data/);
});
test('the action endpoint refuses anything it does not know', async () => {
  for (const bad of [
    null,
    'x',
    {},
    { type: 'constructor' },
    { type: '__proto__' },
    { type: 'toString' },
    { type: 'dropTables' },
  ])
    await refused(400, act('tasnim', bad));
  await refused(401, act('ghost', { type: 'checkin' }));
  await refused(400, act('tanvir', { type: 'rollover' })); // removed: it only ever wrote a log line
  await refused(403, act('tasnim', { type: 'invite', user: 'zahid' }));
});

test("mentors: mentees, announcements and nudges are scoped to the mentor's own people", async () => {
  const [mehedi, rahim, nadia] = [await st('mehedi'), await st('rahim'), await st('nadia')];
  assert.deepEqual(mehedi.office.mentees!.map((m) => m.id).sort(), [
    'jannat',
    'mim',
    'tasnim',
    'zahid',
  ]);
  assert.deepEqual(rahim.office.mentees, [], 'another mentor sees none of them');
  assert.equal(nadia.office.mentees!.length, 4, 'the CP Head sees every mentee');
  await act('mehedi', { type: 'announce', title: 'Five DP problems this week' });
  assert.equal((await st('jannat')).news[0]!.title, 'Five DP problems this week');
  assert.equal((await st('jannat')).news[0]!.mentees, true);
  assert.equal(
    (await st('priya')).news.some((n) => n.title === 'Five DP problems this week'),
    false,
    "a mentor's post never reaches the rest of the club",
  );
  assert.equal(
    (await st('tanvir')).news.some((n) => n.title === 'Five DP problems this week'),
    false,
  );
  await refused(403, act('rahim', { type: 'ping', kind: 'nudge', to: 'jannat' }));
  await refused(403, act('priya', { type: 'ping', kind: 'nudge', to: 'jannat' }));
  await act('mehedi', { type: 'ping', kind: 'nudge', to: 'jannat' });
  await act('mehedi', { type: 'ping', kind: 'nudge', to: 'jannat' }); // twice is still one
  assert.equal(
    (await st('jannat')).inbox.filter((n) => /Mehedi Hasan nudged you/.test(n.text)).length,
    1,
  );
  assert.ok((await st('mehedi')).s.sent.includes('jannat:nudge:'));
  await refused(403, act('priya', { type: 'ping', kind: 'invite', to: 'priya' }));
  await refused(403, act('priya', { type: 'ping', kind: 'invite', to: 'admin' }));
  await refused(400, act('priya', { type: 'ping', kind: 'poke', to: 'imran' }));
});
test('messages are delivered: check-ins to the mentor, suggestions anonymously to officers', async () => {
  await refused(
    403,
    act('priya', { type: 'send', kind: 'checkin', body: 'Solved three this week.' }),
  ); // no mentor assigned
  await refused(400, act('jannat', { type: 'send', kind: 'checkin', body: 'x' }));
  await act('jannat', {
    type: 'send',
    kind: 'checkin',
    body: 'Stuck on Vacations, the state is unclear.',
  });
  const m = await st('mehedi');
  assert.equal(
    m.office.mentees!.find((x) => x.id === 'jannat')!.checkin!.body,
    'Stuck on Vacations, the state is unclear.',
  );
  assert.ok(m.inbox.some((n) => / sent a weekly check-in$/.test(n.text))); // (an earlier test renamed this member)
  await act('priya', { type: 'send', kind: 'suggest', body: 'Please open the lab on Fridays.' });
  assert.equal(
    (await db().query(`select user_id from messages where kind = 'suggest'`)).rows[0]!.user_id,
    null,
    'the sender of a suggestion is not stored',
  );
  assert.equal((await st('sadia')).office.suggestions![0]!.body, 'Please open the lab on Fridays.');
  assert.equal((await st('priya')).office.suggestions, undefined);
  await act('priya', { type: 'send', kind: 'feedback', body: 'More time for problem E.' });
  assert.equal((await st('sadia')).office.feedback![0]!.body, 'More time for problem E.');
  assert.equal(
    (await st('anika')).office.feedback,
    undefined,
    'feedback goes to those who run events',
  );
});
test('inbox is built from real records and can be cleared', async () => {
  const z = await st('rahim');
  assert.deepEqual(
    z.inbox.filter((n) => n.cat === 'Finance').map((n) => n.id),
    ['n:due:INV-2611'],
    'term dues only: no fee for an event he never registered for',
  );
  await act('rahim', { type: 'toggle', list: 'reg', id: 'hack-night', on: true });
  assert.ok((await st('rahim')).inbox.some((n) => n.id === 'n:due:INV-2612'));
  await act('rahim', { type: 'readAll' });
  const after = await st('rahim');
  assert.ok(after.inbox.every((n) => after.s.read.includes(n.id)));
  await refused(403, act('rahim', { type: 'toggle', list: 'read', id: 'x'.repeat(79) }));
});
test('profile: a member edits their own details, within limits', async () => {
  await refused(400, act('imran', { type: 'profile', name: '', dept: 'CE', batch: 23 }));
  await refused(
    400,
    act('imran', { type: 'profile', name: 'Imran Chowdhury', dept: 'CE', batch: 123 }),
  );
  await act('imran', {
    type: 'profile',
    name: 'Imran  Chowdhury\u0007',
    dept: 'CSE',
    batch: 24,
    role: 'president',
    xp: 99999,
  });
  const me = (await st('imran')).me;
  assert.deepEqual(
    [me.name, me.dept, me.batch, me.roleKey],
    ['Imran  Chowdhury', 'CSE', 24, 'member'],
    'only name, department and batch change',
  );
});
test('equipment: only the holder or an admin returns it; a held item cannot be taken twice', async () => {
  await refused(409, act('nadia', { type: 'kv', key: 'inv:eq1', value: 'me' })); // Sadia holds it from an earlier test
  await refused(409, act('nadia', { type: 'kv', key: 'inv:eq1', value: '' }));
  await refused(409, act('nadia', { type: 'kv', key: 'inv:eq2', value: '' })); // seeded as held by Nusrat
  await act('sadia', { type: 'kv', key: 'inv:eq1', value: '' });
  await act('nadia', { type: 'kv', key: 'inv:eq1', value: 'me' });
  await act('tanvir', { type: 'kv', key: 'inv:eq1', value: '' }); // an admin can return it for her
});

test('reset links: issued only by someone who outranks the account, single-use, expiring, and they sign the old sessions out', async () => {
  const old = await login('priya@fecpc.example', PW);
  await refused(403, act('priya', { type: 'invite', user: 'priya' })); // own password is changed from the profile
  await refused(403, act('sadia', { type: 'invite', user: 'anika' })); // a Secretary cannot take over an officer's account
  await refused(403, act('sadia', { type: 'invite', user: 'admin' }));
  await refused(403, act('tanvir', { type: 'invite', user: 'admin' })); // nor the President a Super Admin's
  const note = (await act('sadia', { type: 'invite', user: 'priya' })) as string;
  assert.match(note, /^Password reset link for Priya Saha/);
  const token = /invite=([\w-]+)/.exec(note)![1]!;
  assert.equal(
    await sessionUser(old.token),
    'priya',
    'issuing a link does not lock the member out',
  );
  const fresh = await acceptInvite(token, 'a-brand-new-password');
  assert.equal(await sessionUser(old.token), null);
  assert.equal(await sessionUser(fresh.token), 'priya');
  await refused(410, acceptInvite(token, 'another-password-12'));
  const again = /invite=([\w-]+)/.exec(
    (await act('tanvir', { type: 'invite', user: 'anika' })) as string,
  )![1]!;
  await db().query(
    `update users set invite_expires = now() - interval '1 minute' where id = 'anika'`,
  );
  await refused(410, acceptInvite(again, 'expired-link-password'));
  assert.ok(
    (await st('tanvir')).s.log.some((l) => /invite\.accepted/.test(l.what)),
    'auth events are in the audit log',
  );
});
test('the operator account is not a member: no ballot, no dues, no purchases', async () => {
  await refused(403, act('admin', { type: 'vote', poll: 'election', option: 'sadia' }));
  await refused(403, act('admin', { type: 'vote', poll: 'p1', option: 'Sunday' }));
  await refused(
    403,
    act('admin', {
      type: 'pay',
      invoice: 'INV-2611',
      via: 'bKash',
      trx: 'ADMIN00001',
      sender: '01712345678',
    }),
  );
  await refused(403, act('admin', { type: 'redeem', item: 'Sticker pack' }));
  const a = await st('admin');
  assert.equal(a.me.system, true);
  assert.equal(
    a.inbox.some((n) => n.id.startsWith('n:due:')),
    false,
  );
  await refused(
    404,
    act('tanvir', { type: 'role', user: 'admin', role: 'member', reason: 'demote the operator' }),
  );
});
test('sign-in limits: per address and per account, so rotating addresses does not help', async () => {
  for (let n = 0; n < 5; n++)
    await refused(401, login('shuvo@fecpc.example', 'wrong-password-' + n, '10.0.0.1'));
  await refused(429, login('shuvo@fecpc.example', PW, '10.0.0.1')); // 5 from one address
  for (let n = 0; n < 15; n++)
    await refused(401, login('shuvo@fecpc.example', 'wrong-password-' + n, '10.0.1.' + n));
  await refused(429, login('shuvo@fecpc.example', PW, '10.9.9.9')); // 20 for the account, from anywhere
  await db().query(`update login_attempts set window_start = now() - interval '16 minutes'`);
  assert.ok(await login('shuvo@fecpc.example', PW, '10.9.9.9'), 'the window passes');
});

test('community feed: create, list, filter, vote (+XP), edit/delete author-only', async () => {
  const xBefore = earned((await st('farhan')).s);
  await refused(
    400,
    act('farhan', {
      type: 'createFeedPost',
      title: 'Hi',
      body_md: 'Short',
      category: 'problem-solving',
    }),
  );
  await refused(
    400,
    act('farhan', {
      type: 'createFeedPost',
      title: 'Valid title',
      body_md: 'Valid body',
      category: 'invalid',
    }),
  );
  await act('farhan', {
    type: 'createFeedPost',
    title: 'Bitmask DP trick for N<=20',
    body_md: 'Use **SOS DP** when iterating over submasks.',
    category: 'problem-solving',
  });
  assert.equal(earned((await st('farhan')).s) - xBefore, XP.feedPost);

  const page1 = await listFeedPosts(db(), 'priya', { q: 'Bitmask', category: 'wins', limit: 20 });
  assert.equal(page1.items.length, 1);
  const post = page1.items[0]!;
  assert.equal(post.category, 'problem-solving');
  assert.equal(post.score, 0);

  // Another user upvotes -> author earns +2 XP
  await act('priya', { type: 'voteFeed', postId: post.id, value: 1 });
  assert.equal(earned((await st('farhan')).s) - xBefore, XP.feedPost + XP.feedUpvote);
  const detail = await getFeedPostDetail(db(), 'priya', { postId: post.id });
  assert.equal(detail.score, 1);
  assert.equal(detail.my_vote, 1);
  assert.equal('comments' in detail, false);
  await refused(
    400,
    act('priya', { type: 'comment', targetType: 'feed', targetId: post.id, body: 'Not allowed' }),
  );

  // Non-author cannot edit or delete
  await refused(
    403,
    act('priya', { type: 'updateFeedPost', postId: post.id, title: 'Hacked', body_md: 'Nope' }),
  );
  await refused(403, act('priya', { type: 'deleteFeedPost', postId: post.id }));

  // Author can edit and delete
  await act('farhan', {
    type: 'updateFeedPost',
    postId: post.id,
    title: 'SOS DP trick for N<=20',
    body_md: 'Updated **markdown** body.',
  });
  assert.equal(
    (await getFeedPostDetail(db(), 'farhan', { postId: post.id })).title,
    'SOS DP trick for N<=20',
  );
  await act('farhan', { type: 'deleteFeedPost', postId: post.id });
  await refused(404, getFeedPostDetail(db(), 'farhan', { postId: post.id }));
});

test('community announcements: extended fields + idempotent markAnnouncementRead (+3 XP once)', async () => {
  await act('sadia', {
    type: 'announce',
    title: 'Seminar with alumni speaker',
    body_md: 'Hey @everyone!\n\n> Date: 21 Nov 2026\n> Venue: CSE Seminar Room',
    pinned: true,
    requires_ack: true,
  });
  const latest = (await st('farhan')).news[0]!;
  assert.equal(latest.title, 'Seminar with alumni speaker');
  assert.equal(latest.pinned, true);
  assert.equal(latest.requires_ack, true);
  assert.match(latest.body_md, /@everyone/);

  const x0 = earned((await st('farhan')).s);
  await act('farhan', { type: 'markAnnouncementRead', id: latest.id });
  const afterFirst = await st('farhan');
  assert.equal(earned(afterFirst.s) - x0, XP.read);
  assert.equal(afterFirst.counts.annReads[latest.id], 1);

  // Opening modal again must be idempotent (no double XP, no duplicate read count)
  await act('farhan', { type: 'markAnnouncementRead', id: latest.id });
  const afterSecond = await st('farhan');
  assert.equal(earned(afterSecond.s) - x0, XP.read);
  assert.equal(afterSecond.counts.annReads[latest.id], 1);
});

test('community ideas: poster-only interested payload, expressInterest, decideInterest (+5 XP), inbox ping link', async () => {
  const xPoster0 = earned((await st('farhan')).s);
  await refused(
    400,
    act('farhan', {
      type: 'createIdea',
      title: 'Missing type',
      body_md: 'No ideaType passed.',
      roles: [],
    }),
  );
  await act('farhan', {
    type: 'createIdea',
    title: 'ICPC Dhaka regional practice trio',
    body_md: 'Need a teammate strong in **geometry and flows**.',
    ideaType: 'teammate',
    roles: ['Rating?', 'Favorite topic?'],
  });
  assert.equal(earned((await st('farhan')).s) - xPoster0, XP.idea);

  const teamList = await listIdeas(db(), 'priya', { q: 'practice trio', type: 'teammate' });
  assert.equal(teamList.items.length, 1);
  const ideaId = teamList.items[0]!.id;

  // Non-poster expresses interest
  const xApp0 = earned((await st('priya')).s);
  await refused(403, act('farhan', { type: 'expressInterest', ideaId, response: {} })); // poster cannot apply to own
  await act('priya', {
    type: 'expressInterest',
    ideaId,
    response: { 'Rating?': '1400', 'Favorite topic?': 'Graphs' },
  });

  // CRITICAL: Non-poster detail payload MUST NOT contain `interested` key at all
  const viewerDetail = await getIdeaDetail(db(), 'priya', { ideaId });
  assert.equal(
    'interested' in viewerDetail,
    false,
    'non-poster must never receive interested[] in payload',
  );
  assert.equal(viewerDetail.interested_count, 1);
  assert.equal(viewerDetail.my_interest, 'pending');

  // Poster detail payload MUST contain `interested` with applicant's response
  const posterDetail = await getIdeaDetail(db(), 'farhan', { ideaId });
  assert.ok(Array.isArray(posterDetail.interested) && posterDetail.interested.length === 1);
  assert.equal(posterDetail.interested[0]!.user_id, 'priya');
  assert.equal(posterDetail.interested[0]!.response['Rating?'], '1400');

  // Non-poster cannot decide; poster accepts -> applicant gets +5 XP and notification
  await refused(
    403,
    act('priya', { type: 'decideInterest', ideaId, userId: 'priya', decision: 'accepted' }),
  );
  await act('farhan', { type: 'decideInterest', ideaId, userId: 'priya', decision: 'accepted' });
  const priyaState = await st('priya');
  assert.equal(earned(priyaState.s) - xApp0, XP.interestAccepted);
  assert.ok(
    priyaState.inbox.some((n) => n.href === '/app/community?tab=ideas' && /accepted/.test(n.text)),
  );

  // Legacy team ping inbox link must point to /app/community?tab=ideas
  await act('farhan', { type: 'ping', kind: 'team', to: 'priya', ref: 'check1' });
  assert.ok(
    (await st('priya')).inbox.some(
      (n) => n.href === '/app/community?tab=ideas' && /team up/.test(n.text),
    ),
  );
});

test('members redesign: paginated listMembers, composed AND filters, and alumni filter', async () => {
  const p0 = await listMembers(db(), 'tasnim', { page: 0, pageSize: 16 });
  assert.equal(p0.members.length, 16);
  assert.equal(p0.hasMore, true);
  assert.ok(p0.total > 16);

  const p1 = await listMembers(db(), 'tasnim', { page: 1, pageSize: 16 });
  assert.equal(p1.members.length, p0.total - 16);
  assert.equal(p1.hasMore, false);

  // Type filter: alumni only
  const alum = await listMembers(db(), 'tasnim', { type: 'alumni' });
  assert.ok(alum.members.length >= 3);
  assert.ok(alum.members.every((m) => m.is_alumni));

  // Composed AND filters: rating tier (Master = 2000-2399 solved) + skill + type
  const composed = await listMembers(db(), 'tasnim', {
    rating: 'Master',
    skill: 'Systems',
    type: 'alumni',
    q: 'shahriar',
  });
  assert.equal(composed.members.length, 1);
  assert.equal(composed.members[0]!.id, 'shahriar');

  // Batch filter
  const batch16 = await listMembers(db(), 'tasnim', { batch: 16 });
  assert.ok(batch16.members.some((m) => m.id === 'shahriar'));
  assert.ok(batch16.members.every((m) => m.batch === 16));
});

test('members redesign: getMemberProfile privacy, updateProfile, alumni jobs, and admin actions', async () => {
  // Privacy: viewer != user omits email; viewer == user includes email
  const pubProfile = await getMemberProfile(db(), 'tasnim', { userId: 'nadia' });
  assert.equal('email' in pubProfile, false, 'other members never see private email');
  assert.ok(pubProfile.experience.length >= 1);
  assert.ok(pubProfile.contest_history.length >= 1);

  const ownProfile = await getMemberProfile(db(), 'tasnim', { userId: 'tasnim' });
  assert.equal(ownProfile.email, 'tasnim@fecpc.example');

  // Owner updates own profile
  await refused(400, act('tasnim', { type: 'updateProfile', github_url: 'javascript:alert(1)' }));
  await refused(400, act('tasnim', { type: 'updateProfile', bio: 'x'.repeat(401) }));
  await act('tasnim', {
    type: 'updateProfile',
    bio: 'Batch 24 CSE, grinding DP and graphs.',
    cf_handle: 'tasnim_cf',
    github_url: 'https://github.com/tasnim-a',
    linkedin_url: 'https://linkedin.com/in/tasnim-a',
    skills: ['CP', 'DP', 'Web'],
    avatar_url: null,
  });
  const updated = await getMemberProfile(db(), 'nadia', { userId: 'tasnim' });
  assert.equal(updated.bio, 'Batch 24 CSE, grinding DP and graphs.');
  assert.equal(updated.cf_handle, 'tasnim_cf');
  assert.equal(updated.github_url, 'https://github.com/tasnim-a');
  assert.deepEqual(updated.skills, ['CP', 'DP', 'Web']);

  // Kudos with member:<id>
  await act('tasnim', { type: 'toggle', list: 'kudos', id: 'member:nadia' });
  assert.ok((await st('tasnim')).s.kudos.includes('member:nadia'));

  // Alumni jobs: regular member refused; alumni posts & deletes
  await refused(
    403,
    act('tasnim', {
      type: 'createAlumniJob',
      company: 'Acme',
      role: 'SWE',
      url: 'https://acme.example/jobs/1',
    }),
  );
  await act('shahriar', {
    type: 'createAlumniJob',
    company: 'Pathao',
    role: 'Backend Engineer',
    location: 'Dhaka',
    url: 'https://pathao.example/careers/be',
  });
  const shahriarProf = await getMemberProfile(db(), 'tasnim', { userId: 'shahriar' });
  assert.equal(shahriarProf.is_alumni, true);
  assert.ok((shahriarProf.interview_prep?.length ?? 0) >= 1);
  assert.ok((shahriarProf.jobs_fetched?.length ?? 0) >= 1);
  const posted = shahriarProf.jobs_manual?.find((j) => j.company === 'Pathao');
  assert.ok(posted);
  await refused(403, act('tasnim', { type: 'deleteAlumniJob', jobId: posted!.id }));
  await act('shahriar', { type: 'deleteAlumniJob', jobId: posted!.id });

  // Admin actions: promoteMember, makeAlumni, deactivateMember
  await refused(403, act('tasnim', { type: 'promoteMember', userId: 'mim' }));
  await refused(403, act('sadia', { type: 'makeAlumni', userId: 'mim' }));
  await refused(403, act('tanvir', { type: 'deactivateMember', userId: 'tanvir' }));

  await act('tanvir', { type: 'promoteMember', userId: 'mim' });
  assert.equal((await st('mim')).s.role, 'mentor');

  await act('tanvir', { type: 'makeAlumni', userId: 'mim' });
  assert.equal((await st('mim')).s.role, 'alumni');
  assert.equal((await getMemberProfile(db(), 'tasnim', { userId: 'mim' })).is_alumni, true);

  await act('tanvir', { type: 'deactivateMember', userId: 'mim' });
  assert.equal(await loadState(db(), 'mim'), null);
  await refused(404, getMemberProfile(db(), 'tasnim', { userId: 'mim' }));
  const afterDeact = await listMembers(db(), 'tasnim', { q: 'Mim' });
  assert.equal(
    afterDeact.members.some((m) => m.id === 'mim'),
    false,
  );
});

test('milestones: backfill, CF sync crossover detection, freshness window, permanent kudos, XP, notifications, and daily cap', async () => {
  // 1. First-deploy backfill populated real DB rows (idempotent on re-run)
  const backfilled = await listRecentMilestones(db(), 'tasnim', { limit: 5 });
  assert.equal(backfilled.length, 5, 'sidebar hydrates up to 5 recent backfilled milestones');
  assert.equal(await backfillMilestones(db()), 0, 'backfill is idempotent');

  // Hydrated state includes recentMilestones & kudosToday
  const initState = await st('tasnim');
  assert.equal(initState.counts.kudosToday, 0);
  assert.equal(initState.counts.recentMilestones.length, 5);

  // 2. Pure crossover detection for all three types
  const detected = detectCrossovers(
    { cf_rating: 1150, problems_solved: 480, current_streak: 29 },
    { cf_rating: 1215, problems_solved: 510, current_streak: 30 },
    { cf_handle: 'demo_cf' },
  );
  assert.deepEqual(
    detected.map((d) => [d.type, d.from_value, d.to_value, d.threshold]),
    [
      ['rank_promotion', 'Newbie', 'Pupil', 1215],
      ['solved_milestone', '480', '500', 500],
      ['contest_streak', '29', '30', 30],
    ],
  );
  // Rating drop or same tier does not emit promotion
  assert.deepEqual(
    detectCrossovers(
      { cf_rating: 1620, problems_solved: 600, current_streak: 30 },
      { cf_rating: 1580, problems_solved: 600, current_streak: 30 },
    ),
    [],
  );

  // 3. DB CF sync crossover detection + idempotency
  const sync1 = await syncUserCodeforcesStats(db(), 'tasnim', {
    cf_handle: 'tasnim_cf',
    cf_rating: 1220, // Newbie (1154) -> Pupil (1220)
    problems_solved: 505, // crosses 500
    current_streak: 60, // crosses 60 (was 41)
  });
  assert.equal(
    sync1.inserted,
    3,
    'rank_promotion + solved_milestone(500) + contest_streak(60) inserted',
  );
  const sync2 = await syncUserCodeforcesStats(db(), 'tasnim', {
    cf_handle: 'tasnim_cf',
    cf_rating: 1230,
    problems_solved: 510,
    current_streak: 60,
  });
  assert.equal(sync2.inserted, 0, 're-syncing without crossing new thresholds inserts nothing');

  const recentAfterSync = await listRecentMilestones(db(), 'nadia', { limit: 10 });
  const tasnimPromo = recentAfterSync.find(
    (m) => m.user_id === 'tasnim' && m.type === 'rank_promotion' && m.to_value === 'Pupil',
  );
  const tasnimSolved = recentAfterSync.find(
    (m) => m.user_id === 'tasnim' && m.type === 'solved_milestone' && m.to_value === '500',
  );
  const tasnimStreak = recentAfterSync.find(
    (m) => m.user_id === 'tasnim' && m.type === 'contest_streak' && m.to_value === '60',
  );
  assert.ok(tasnimPromo && tasnimPromo.from_value === 'Newbie' && tasnimPromo.threshold === 1220);
  assert.ok(tasnimSolved && tasnimSolved.threshold === 500);
  assert.ok(tasnimStreak && tasnimStreak.threshold === 60);

  // 4. Generic toggle refuses milestone: prefix while keeping member: kudos intact
  await refused(
    403,
    act('nadia', { type: 'toggle', list: 'kudos', id: `milestone:${tasnimPromo!.id}` }),
  );
  await act('nadia', { type: 'toggle', list: 'kudos', id: 'member:tasnim' });
  assert.ok((await st('nadia')).s.kudos.includes('member:tasnim'));

  // 5. Self-kudos is refused; giving kudos awards +2 XP to owner (NOT giver) + one notification
  await refused(403, kudosMilestone('tasnim', { milestoneId: tasnimPromo!.id }));

  const ownerXpBefore = earned((await st('tasnim')).s);
  const giverXpBefore = earned((await st('nadia')).s);

  const k1 = await kudosMilestone('nadia', { milestoneId: tasnimPromo!.id });
  assert.equal(k1.ok, true);
  if (k1.ok) {
    assert.equal(k1.alreadyGiven, false);
    assert.equal(k1.kudosCount, 1);
    assert.equal(k1.hasKudos, true);
    assert.equal(k1.kudosToday, 1);
  }

  // Replaying same milestone kudos is idempotent: no extra count, no extra XP, no duplicate notification
  const k1Replay = await kudosMilestone('nadia', { milestoneId: tasnimPromo!.id });
  assert.equal(k1Replay.ok, true);
  if (k1Replay.ok) {
    assert.equal(k1Replay.alreadyGiven, true);
    assert.equal(k1Replay.kudosCount, 1);
    assert.equal(k1Replay.kudosToday, 1);
  }

  const ownerAfter = await st('tasnim');
  const giverAfter = await st('nadia');
  assert.equal(
    earned(ownerAfter.s) - ownerXpBefore,
    XP.milestoneKudosReceived,
    'owner earns +2 XP on first kudos',
  );
  assert.equal(earned(giverAfter.s) - giverXpBefore, 0, 'giver earns 0 XP');
  assert.equal(giverAfter.counts.kudosToday, 1);

  const ownerNotifs = ownerAfter.inbox.filter((n) => n.id === `n:mk:${tasnimPromo!.id}:nadia`);
  assert.equal(ownerNotifs.length, 1, 'exactly one notification per unique giver');
  assert.equal(ownerNotifs[0]!.text, 'Nadia Rahman congratulated you on reaching Pupil');

  // Owner sees recent_givers; another viewer does not
  const ownerList = await listRecentMilestones(db(), 'tasnim', { limit: 10 });
  const ownerRow = ownerList.find((m) => m.id === tasnimPromo!.id)!;
  assert.deepEqual(ownerRow.recent_givers, ['Nadia Rahman']);
  const otherList = await listRecentMilestones(db(), 'priya', { limit: 10 });
  const otherRow = otherList.find((m) => m.id === tasnimPromo!.id)!;
  assert.equal(otherRow.kudos_count, 1);
  assert.equal(otherRow.has_kudos, false);
  assert.deepEqual(otherRow.recent_givers, []);

  // 6. Server-side daily cap enforcement (20/day UTC)
  // Create 21 distinct milestones for another user so `priya` can hit 20/20 and be blocked on 21st
  const capIds: number[] = [];
  for (let i = 1; i <= DAILY_KUDOS_CAP + 1; i++) {
    const r = await db().query(
      `insert into milestones (user_id, type, from_value, to_value, threshold)
       values ('farhan', 'contest_streak', $1, $2, $3)
       on conflict (user_id, type, to_value) do update set created_at = now()
       returning id`,
      [String(i * 30 - 30), String(i * 30), i * 30],
    );
    capIds.push(Number(r.rows[0]!.id));
  }
  for (let i = 0; i < DAILY_KUDOS_CAP; i++) {
    const res = await kudosMilestone('priya', { milestoneId: capIds[i]! });
    assert.equal(res.ok, true);
  }
  assert.equal(await getKudosTodayCount(db(), 'priya'), DAILY_KUDOS_CAP);
  assert.equal((await st('priya')).counts.kudosToday, DAILY_KUDOS_CAP);

  // 21st new milestone today must be rejected server-side with DAILY_LIMIT
  const overCap = await kudosMilestone('priya', { milestoneId: capIds[DAILY_KUDOS_CAP]! });
  assert.deepEqual(overCap, { ok: false, reason: 'DAILY_LIMIT', kudosToday: DAILY_KUDOS_CAP });
  await refused(
    429,
    act('priya', { type: 'kudosMilestone', milestoneId: capIds[DAILY_KUDOS_CAP]! }),
  );

  // Replaying an already-given milestone still returns ok: true, alreadyGiven: true
  const replayAtCap = await kudosMilestone('priya', { milestoneId: capIds[0]! });
  assert.equal(replayAtCap.ok, true);
  if (replayAtCap.ok) assert.equal(replayAtCap.alreadyGiven, true);

  // 7. 14-day freshness window & empty state
  await db().query(`update milestones set created_at = now() - interval '15 days'`);
  const stale = await listRecentMilestones(db(), 'tasnim', { limit: 5 });
  assert.deepEqual(stale, [], 'milestones older than 14 days are excluded from sidebar');
  assert.deepEqual((await st('tasnim')).counts.recentMilestones, []);
});

test('officers cannot act on accounts at or above their rank; suspension blocks sign-in', async () => {
  const reason = 'rank test';
  await act('admin', { type: 'role', user: 'nusrat', role: 'president', reason });
  await refused(404, act('tanvir', { type: 'role', user: 'nusrat', role: 'member', reason }));
  await refused(404, act('tanvir', { type: 'suspend', user: 'nusrat', on: true }));
  await refused(404, act('tanvir', { type: 'makeAlumni', userId: 'nusrat' }));
  await refused(404, act('tanvir', { type: 'deactivateMember', userId: 'nusrat' }));
  await refused(404, act('tanvir', { type: 'promoteMember', userId: 'anika' })); // a Treasurer is not turned into a Mentor
  await refused(403, act('rahim', { type: 'role', user: 'tasnim', role: 'member', reason })); // Mentors assign nothing
  await act('admin', { type: 'role', user: 'nusrat', role: 'secretary', reason });

  await act('tanvir', { type: 'suspend', user: 'imran', on: true });
  await refused(403, login('imran@fecpc.example', PW)); // sign-in sees the suspension
  await act('tanvir', { type: 'suspend', user: 'imran', on: false });
  assert.ok(await login('imran@fecpc.example', PW));
});

test('codeforces sync: uses the handle stored for the member, never one from the caller', async () => {
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = (async (url: string) => {
    asked.push(String(url));
    return Response.json(
      String(url).includes('user.info')
        ? { status: 'OK', result: [{ handle: 'priya_cf', rating: 1650 }] }
        : {
            status: 'OK',
            result: [
              {
                verdict: 'OK',
                creationTimeSeconds: Date.now() / 1000,
                problem: { contestId: 1, index: 'A' },
              },
              {
                verdict: 'OK',
                creationTimeSeconds: Date.now() / 1000,
                problem: { contestId: 1, index: 'A' },
              },
              {
                verdict: 'WRONG_ANSWER',
                creationTimeSeconds: 1,
                problem: { contestId: 2, index: 'B' },
              },
            ],
          },
    );
  }) as typeof fetch;
  try {
    await db().query(
      `update users set progress = progress || '{"handle":"priya_cf"}' where id = 'priya'`,
    );
    const res = await syncCodeforces(db(), 'priya');
    assert.equal(res?.handle, 'priya_cf');
    assert.ok(
      asked.every((u) => u.includes('priya_cf')),
      'only the stored handle is fetched',
    );
    const row = (
      await db().query(`select cf_rating, problems_solved from users where id = 'priya'`)
    ).rows[0];
    assert.deepEqual([row.cf_rating, row.problems_solved], [1650, 1]); // duplicates and wrong answers do not count

    globalThis.fetch = (async () => Response.json({ status: 'FAILED' })) as typeof fetch;
    assert.equal(await syncCodeforces(db(), 'priya'), null, 'a failed fetch changes nothing');
    assert.equal(await syncCodeforces(db(), 'admin'), null, 'the operator account is never synced');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('profile: a member cannot set their own Codeforces rating or solve count', async () => {
  const before = (
    await db().query(`select cf_rating, problems_solved, rating from users where id = 'farhan'`)
  ).rows[0];
  await act('farhan', { type: 'updateProfile', bio: 'hi', cf_rating: 3999, problems_solved: 9999 });
  const after = (
    await db().query(
      `select cf_rating, problems_solved, rating, bio from users where id = 'farhan'`,
    )
  ).rows[0];
  assert.deepEqual(
    [after.cf_rating, after.problems_solved, after.rating],
    [before.cf_rating, before.problems_solved, before.rating],
  );
  assert.equal(after.bio, 'hi', 'the rest of the profile still saves');
});
