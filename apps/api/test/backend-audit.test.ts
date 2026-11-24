// The rules fixed in docs/backend-audit.md: one write path, one kudos total, one handle per member, joined by any
// sign-in method, throttled password changes, and HTTP errors that keep their status.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { HttpException } from '@nestjs/common';
import { earned, XP } from '@fecpc/contracts';
import { act } from '../src/modules/member-area/actions.ts';
import { apply } from '../src/modules/member-area/recruit.ts';
import { alumni, community } from '../src/modules/member-area/queries.ts';
import { Fail, pool, usePool } from '../src/modules/member-area/db.ts';
import { loadRoster, loadState } from '../src/modules/member-area/state.ts';
import { setup } from '../src/db/seed-data.ts';
import { AuthService } from '../src/modules/auth/auth.service.ts';
import { AuditService } from '../src/modules/audit/audit.service.ts';
import { LoginThrottlingService } from '../src/modules/auth/login-throttling.service.ts';
import {
  ConfigService,
  EnvSchema,
  productionProblems,
} from '../src/platform/config/config.service.ts';
import { DbService } from '../src/platform/database/db.service.ts';
import { ProblemDetailsFilter } from '../src/platform/http/problem-details.filter.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test'); // never the development database
const PW = 'test-password-123';
const cfg = new ConfigService();
const dbs = new DbService(cfg);
dbs.onModuleInit();
usePool(dbs.getPool());
const db = () => pool();
const auth = new AuthService(dbs, cfg, new LoginThrottlingService(dbs), new AuditService(dbs));
const refused = (status: number, p: Promise<unknown>) =>
  assert.rejects(p, (e: unknown) => e instanceof HttpException && e.getStatus() === status);

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  await setup(db(), PW);
});
after(() => dbs.onModuleDestroy());

test('kudos: one permanent total per member, from profile, ideas and milestones, each worth XP', async () => {
  const total = async () => (await loadState(db(), 'priya'))!.counts.kudos['member:tasnim'] ?? 0;
  const xp = async () => earned((await loadState(db(), 'tasnim'))!.s);
  const [before, xpBefore] = [await total(), await xp()];
  await act('priya', { type: 'toggle', list: 'kudos', id: 'member:tasnim', on: true });
  const idea = (
    await db().query(
      `insert into ideas (user_id, title, body_md, type) values ('tasnim', 'Idea', 'Body text', 'idea') returning id`,
    )
  ).rows[0].id;
  await act('priya', { type: 'toggle', list: 'kudos', id: `idea:${idea}`, on: true });
  const ms = (
    await db().query(
      `insert into milestones (user_id, type, to_value) values ('tasnim', 'solved_milestone', '9999') returning id`,
    )
  ).rows[0].id;
  // Through the query endpoint, which runs it as an action: the cached total is refreshed too.
  const r = (await community(db(), 'priya', { action: 'kudosMilestone', milestoneId: ms })) as {
    ok: boolean;
  };
  assert.equal(r.ok, true);
  assert.equal(await total(), before + 3);
  assert.equal(await xp(), xpBefore + XP.idea + 3 * XP.kudosReceived); // her idea, then 3 kudos
  // Never taken back
  await refused(
    403,
    act('priya', { type: 'toggle', list: 'kudos', id: 'member:tasnim', on: false }),
  );
  assert.equal(await total(), before + 3);
});

test('handles: one Codeforces handle per member, read from the account', async () => {
  await db().query(
    `update users set cf_handle = null, handle = '' where id in ('tasnim', 'priya')`,
  );
  await act('tasnim', { type: 'handle', value: 'Unique_Handle' });
  await refused(409, act('priya', { type: 'handle', value: 'unique_handle' })); // case-insensitive
  await refused(
    409,
    act('tanvir', { type: 'updateProfile', user: 'priya', cf_handle: 'UNIQUE_HANDLE' }),
  );
  const p = (await db().query(`select progress->>'handle' h from users where id = 'tasnim'`))
    .rows[0];
  assert.equal(p.h, null, 'no second copy in progress');
});

test('joined: a GitHub-only member is joined, and stays active when reinstated', async () => {
  await db().query(
    `update users set pass_hash = null, google_sub = null, github_id = '42' where id = 'sabbir'`,
  );
  await db().query(`delete from credentials where user_id = 'sabbir'`);
  const row = (await loadRoster(db(), 'tanvir'))!.find((m) => m.id === 'sabbir')!;
  assert.equal(row.pending, false);
  await act('tanvir', { type: 'suspend', user: 'sabbir', on: true });
  await act('tanvir', { type: 'suspend', user: 'sabbir', on: false });
  assert.equal(
    (await db().query(`select status from users where id = 'sabbir'`)).rows[0].status,
    'active',
  );
});

test('password change: wrong current passwords are throttled like sign-ins', async () => {
  for (let i = 0; i < 5; i++)
    await refused(
      401,
      auth.changePassword('mim', 'wrong-password-x', 'new-password-123', '1.2.3.4'),
    );
  await refused(429, auth.changePassword('mim', PW, 'new-password-123', '1.2.3.4'));
  await db().query(`delete from login_attempts`);
  assert.ok(await auth.changePassword('mim', PW, 'new-password-123', '1.2.3.4'));
});

test('query writes run as actions: same checks, same answers', async () => {
  // The editor's `published` switch is honoured (it used to save every new post as a draft).
  const post = (await alumni(db(), 'shahriar', {
    action: 'createBlogPost',
    title: 'Published from the editor',
    body_md: 'Body',
    published: true,
  })) as { id: number };
  assert.equal(
    (await db().query(`select status from blog_posts where id = $1`, [post.id])).rows[0].status,
    'published',
  );
  // Only an alumnus can be saved.
  await assert.rejects(
    alumni(db(), 'tasnim', { action: 'saveAlumni', alumniId: 'priya' }),
    (e: unknown) => e instanceof Fail && e.getStatus() === 403,
  );
  assert.deepEqual(await alumni(db(), 'tasnim', { action: 'saveAlumni', alumniId: 'shahriar' }), {
    saved: true,
  });
  // Every write is audited under its section and leaves one audit line, like any other action.
  const n = Number(
    (await db().query(`select count(*) n from audit where what like 'created blog post%'`)).rows[0]
      .n,
  );
  assert.equal(n, 1);
});

test('errors: Fastify and plugin errors keep their status instead of becoming 500', () => {
  const sent: { status?: number; body?: { status: number; code: string } } = {};
  const reply = {
    status(n: number) {
      sent.status = n;
      return reply;
    },
    header: () => reply,
    send(b: { status: number; code: string }) {
      sent.body = b;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ id: 'req-1', headers: {} }),
    }),
  } as never;
  const filter = new ProblemDetailsFilter();
  for (const [err, status, code] of [
    [Object.assign(new SyntaxError('bad json'), { statusCode: 400 }), 400, 'BAD_REQUEST'],
    [{ statusCode: 413, message: 'Request body is too large' }, 413, 'BAD_REQUEST'],
    [{ statusCode: 429, message: 'Rate limit exceeded' }, 429, 'RATE_LIMITED'],
    [{ code: '22003', message: 'value out of range for type integer' }, 400, 'BAD_REQUEST'],
    [{ code: '22021', message: 'invalid byte sequence (NUL)' }, 400, 'BAD_REQUEST'],
    [
      Object.assign(new Error('getaddrinfo ENOTFOUND db'), { code: 'ENOTFOUND' }),
      503,
      'SERVICE_UNAVAILABLE',
    ],
    [new Error('boom'), 500, 'INTERNAL_ERROR'],
  ] as const) {
    filter.catch(err, host);
    assert.deepEqual([sent.status, sent.body?.code], [status, code]);
  }
});

test('challenge: Codeforces is asked before the transaction, and once when it is down', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return Response.json({ status: 'FAILED' });
  }) as typeof fetch;
  try {
    await act('tasnim', {
      type: 'challenge',
      link: 'https://codeforces.com/contest/9998/problem/Q',
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls, 1);
  const r = await db().query(`select name from challenges where problem = '9998Q'`);
  assert.equal(r.rows[0]?.name, '9998Q'); // unknown to Codeforces: the id stands in for the name
});

test('sign-in: parallel guesses are counted before any is checked', async () => {
  await db().query(`delete from login_attempts`);
  const res = await Promise.allSettled(
    Array.from({ length: 20 }, () => auth.login('nadia@fecpc.example', 'wrong-guess', '9.9.9.9')),
  );
  const checked = res.filter(
    (r) => r.status === 'rejected' && (r.reason as HttpException).getStatus() === 401,
  ).length;
  assert.ok(checked <= 5, `${checked} guesses reached the password check`);
  await db().query(`delete from login_attempts`);
});

test('applications: parallel posts from one network stop at the hourly limit', async () => {
  const token = 'raceToken_123456';
  await db().query(
    `insert into recruit_links (token, title, batch, form, closes_at, by) values ($1, 'Race', 26, '{}', now() + interval '1 day', 'admin')`,
    [token],
  );
  const photo =
    'data:image/png;base64,' + Buffer.from('\x89PNG\r\n\x1a\n0000', 'latin1').toString('base64');
  const res = await Promise.allSettled(
    Array.from({ length: 15 }, (_, k) =>
      apply(
        db(),
        {
          token,
          name: 'Race Bot',
          sid: `R-${k}00`,
          dept: 'CSE',
          email: `race${k}@x.org`,
          phone: '01700000000',
          photo,
          why: 'x',
        },
        '7.7.7.7',
      ),
    ),
  );
  assert.equal(res.filter((r) => r.status === 'fulfilled').length, 10);
  // A renamed HTML file is not a photo.
  const html =
    'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
  await refused(
    400,
    apply(
      db(),
      {
        token,
        name: 'Race Bot',
        sid: 'R-999',
        dept: 'CSE',
        email: 'x@y.org',
        phone: '01700000000',
        photo: html,
      },
      '8.8.8.8',
    ),
  );
});

test('writes: one member is capped at 120 changes a minute, counted in the database', async () => {
  const at = (n: number, when: string) =>
    db().query(
      `update users set writes_min = $1, writes_day = $1, writes_at = ${when} where id = 'farhan'`,
      [n],
    );
  await at(120, `date_trunc('minute', now())`);
  await refused(429, act('farhan', { type: 'readAll' }));
  await at(120, `date_trunc('minute', now()) - interval '1 minute'`); // a new minute
  await act('farhan', { type: 'readAll' });
  await at(3000, `date_trunc('minute', now()) - interval '1 minute'`); // but not a new day
  await refused(429, act('farhan', { type: 'readAll' }));
  await at(0, 'null');
});

test('production config: a broken or unsafe setup refuses to start, a correct one passes', () => {
  const env = (o: Record<string, string>) => EnvSchema.parse({ APP_ENV: 'production', ...o });
  const good = {
    APP_PUBLIC_URL: 'https://fecpc.vercel.app',
    CORS_ORIGINS: 'https://fecpc.vercel.app',
    DATABASE_URL: 'postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    CRON_SECRET: 'x'.repeat(32),
  };
  assert.deepEqual(productionProblems(env(good), true), []);
  assert.equal(
    productionProblems(env({ ...good, CORS_ORIGINS: 'https://other.app' }), true).length,
    1,
  );
  assert.equal(
    productionProblems(env({ ...good, APP_PUBLIC_URL: 'http://fecpc.vercel.app' }), true).length,
    2,
  );
  assert.equal(
    productionProblems(env({ ...good, CRON_SECRET: undefined as never }), true).length,
    1,
  );
  assert.deepEqual(productionProblems(EnvSchema.parse({})), [], 'local development is not checked');
});
