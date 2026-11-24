// The payload limits from docs/performance-audit.md: lists stay bounded and images travel as links.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AppState, ClubEvent } from '@fecpc/contracts';
import {
  avatar,
  getBlogPost,
  listAlumniJobs,
  listBlogPosts,
} from '../src/modules/member-area/actions.ts';
import { eventBanner, eventsQuery } from '../src/modules/member-area/events.ts';
import { members as membersQuery } from '../src/modules/member-area/queries.ts';
import { Fail, pool } from '../src/modules/member-area/db.ts';
import {
  forgetShared,
  loadRoster,
  loadState,
  rosterJson,
} from '../src/modules/member-area/state.ts';
import { setup } from '../src/db/seed-data.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test'); // never the development database
const db = () => pool();
const refused = (status: number, p: Promise<unknown>) =>
  assert.rejects(p, (e: unknown) => e instanceof Fail && e.getStatus() === status);
// A real JPEG header is all the endpoints look at.
const JPEG =
  'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString('base64');

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  await setup(db(), 'test-password-123');
});
after(() => pool().end());

test('roster: its own request, with photo links instead of photo bytes', async () => {
  await db().query(`update users set avatar_url = $1 where id = 'tasnim'`, [JPEG]);
  const state = (await loadState(db(), 'tanvir'))!;
  assert.deepEqual(state.members, [], 'the roster is not part of state');
  assert.ok(state.counts.peopleCount > 1);
  const t = (await loadRoster(db(), 'tanvir'))!.find((m) => m.id === 'tasnim')!;
  assert.match(t.avatar_url!, /^\/api\/avatars\/tasnim\?v=[0-9a-f]{10}$/);
  assert.equal(JSON.stringify(state).includes('base64'), false);
  const img = await avatar(db(), 'tasnim', t.avatar_url!.split('v=')[1]!);
  assert.equal(img.type, 'image/jpeg');
  assert.equal(img.body[0], 0xff);
  await refused(404, avatar(db(), 'tanvir', '')); // no uploaded photo
  await refused(404, avatar(db(), '../etc', ''));
});

test('roster: one cached body per view, cleared after a change', async () => {
  forgetShared();
  const a = (await rosterJson(db(), 'tasnim'))!;
  assert.equal((await rosterJson(db(), 'nadia'))!.tag, a.tag, 'two members share the member view');
  assert.notEqual((await rosterJson(db(), 'admin'))!.tag, a.tag, 'the Super Admin sees more');
  assert.equal(JSON.parse(a.body).members.length, (await loadRoster(db(), 'tasnim'))!.length);
  await db().query(`update users set name = 'Renamed' where id = 'tasnim'`);
  assert.equal((await rosterJson(db(), 'tasnim'))!.tag, a.tag, 'cached until forgotten');
  forgetShared();
  assert.notEqual((await rosterJson(db(), 'tasnim'))!.tag, a.tag);
  assert.equal(await rosterJson(db(), 'nobody'), null);
});

test('admin dashboard: member counts are counted on the server', async () => {
  const p = (await loadState(db(), 'tanvir'))!.office.people!;
  assert.ok(p.active > 0 && p.active >= p.linked && p.linked >= p.rated);
  assert.ok(p.unlinked.length <= 8);
  assert.equal(
    (await loadState(db(), 'tasnim'))!.office.people,
    undefined,
    'members do not get it',
  );
});

test('challenges: ten solvers each side of the challenge, the member, and the totals', async () => {
  const ch = (
    await db().query(
      `insert into challenges (problem, name, by, at) values ('9999Z', 'Perf', 'tanvir', now() - interval '1 day') returning id`,
    )
  ).rows[0].id;
  // 15 solvers after the challenge (everyone but tasnim), tasnim before it.
  await db().query(
    `insert into cf_solves (user_id, problem, at)
     select id, '9999Z', now() - interval '1 hour' * row_number() over (order by id)
     from users where not system and id <> 'tasnim' limit 15`,
  );
  await db().query(
    `insert into cf_solves (user_id, problem, at) values ('tasnim', '9999Z', now() - interval '5 days')`,
  );
  const c = (await loadState(db(), 'tasnim'))!.challenges.find((x) => x.id === ch)!;
  assert.equal(c.since, 15);
  assert.equal(c.earlier, 1);
  assert.ok(c.solvers.length <= 21);
  assert.ok(
    c.solvers.some((x) => x.id === 'tasnim'),
    'the member is always included',
  );
});

test('alumni jobs: 30 a page, with the total of every match', async () => {
  await db().query(
    `insert into alumni_jobs (company, role, url, source) select 'Co ' || g, 'Engineer', 'https://example.com/' || g, 'manual'
     from generate_series(1, 40) g`,
  );
  const first = await listAlumniJobs(db(), 'tasnim', {});
  assert.equal(first.jobs.length, 30);
  assert.ok(first.total >= 40);
  const rest = await listAlumniJobs(db(), 'tasnim', { offset: 30 });
  assert.equal(rest.jobs.length, first.total - 30);
  assert.equal(new Set([...first.jobs, ...rest.jobs].map((j) => j.id)).size, first.total);
});

test('blogs: the list carries a preview, getBlogPost the whole post', async () => {
  const body = 'word '.repeat(2000);
  await db().query(
    `insert into blog_posts (author_id, slug, title, body_md, status, published_at)
     values ('tasnim', 'long-post', 'Long', $1, 'published', now())`,
    [body],
  );
  const listed = (await listBlogPosts(db(), 'tanvir', { pageSize: 100 })).posts.find(
    (p) => p.slug === 'long-post',
  )!;
  assert.equal(listed.body_md.length, 400);
  assert.equal(listed.read_time_min, 10, 'read time counts the whole post');
  assert.equal((await getBlogPost(db(), 'tanvir', { slug: 'long-post' })).body_md, body);
});

test('events: lists link the banner, and the first tab loads only what is still to come', async () => {
  await db().query(
    `insert into club_events (id, title, starts_at, status, banner) values
       ('soon', 'Soon', now() + interval '3 days', 'open', $1),
       ('gone', 'Gone', now() - interval '30 days', 'completed', null)`,
    [JPEG],
  );
  const all = (await eventsQuery(db(), 'tasnim', { action: 'list' })) as ClubEvent[];
  const soon = (await eventsQuery(db(), 'tasnim', {
    action: 'list',
    upcoming: true,
  })) as ClubEvent[];
  assert.ok(all.some((e) => e.id === 'gone'));
  const first = (await eventsQuery(db(), 'tasnim', {
    action: 'list',
    upcoming: true,
    limit: 1,
  })) as ClubEvent[];
  assert.equal(first.length, 1, 'the first screen can be limited');
  assert.equal(
    soon.some((e) => e.id === 'gone'),
    false,
  );
  const link = soon.find((e) => e.id === 'soon')!.banner!;
  const v = /^\/api\/events\/soon\/banner\?v=([0-9a-f]{10})$/.exec(link)?.[1];
  assert.ok(v, link);
  assert.equal((await eventBanner(db(), 'soon', v)).type, 'image/jpeg');
  await refused(404, eventBanner(db(), 'soon', 'wrong'));
  const detail = (await eventsQuery(db(), 'tasnim', { action: 'event', id: 'soon' })) as ClubEvent;
  assert.equal(detail.banner, JPEG, 'the event page (and its editor) keeps the image itself');
});

test('contests: members rounds come from clubRounds, not the roster', async () => {
  await db().query(
    `update users set cf_contests = '[{"id":1,"name":"R","rank":5,"delta":10,"at":1,"solved":2}]' where id = 'tasnim'`,
  );
  const rows = (await membersQuery(db(), 'tanvir', { action: 'clubRounds' })) as {
    id: string;
  }[];
  assert.deepEqual(
    rows.map((r) => r.id),
    ['tasnim'],
  );
  const roster = (await loadRoster(db(), 'tanvir'))! as AppState['members'];
  assert.equal(
    roster.some((m) => 'cf_contests' in m),
    false,
  );
});
