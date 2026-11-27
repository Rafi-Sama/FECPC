// Backend tests for Alumni section: Directory, Jobs, Interview Prep & Blogs
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  act,
  fetchAlumniJobs,
  getBlogPost,
  getInterviewTopicDetail,
  listAlumni,
  listAlumniJobs,
  listBlogPosts,
  listInterviewProblems,
  listInterviewTopics,
  listInterviewRoadmaps,
} from '../src/modules/member-area/actions.ts';
import { Fail, pool } from '../src/modules/member-area/db.ts';
import { setup } from '../src/db/seed-data.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test');
const PW = 'test-password-123';
const db = () => pool();
/** An action's answer, for actions that answer with data (the `queries` writes). */
const does = (who: string, input: Record<string, unknown>) => act(who, input) as Promise<any>;
const refused = (status: number, p: Promise<unknown>) =>
  assert.rejects(
    p,
    (e: unknown) => e instanceof Fail && e.getStatus() === status,
    `expected a ${status} refusal`,
  );

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  await setup(db(), PW);
});
after(() => pool().end());

test('alumni directory: listing, filtering, availability toggle & saving', async () => {
  // List all alumni
  const resAll = await listAlumni(db(), 'tasnim', {});
  assert.ok(resAll.total >= 3, 'should have at least 3 seeded alumni');
  assert.ok(resAll.alumni.length <= 16, 'page limit default 16');

  // Availability filter
  const resAvailable = await listAlumni(db(), 'tasnim', { availableOnly: true });
  assert.ok(resAvailable.alumni.every((a) => a.available_for_questions));
  assert.ok(resAvailable.total <= resAll.total);

  // Search filter
  const resSearch = await listAlumni(db(), 'tasnim', { q: 'Northwind' });
  assert.ok(resSearch.alumni.length >= 1);
  assert.equal(resSearch.alumni[0]!.id, 'shahriar');

  // Save / Unsave
  assert.equal(resSearch.alumni[0]!.saved, false);
  const saveRes1 = await does('tasnim', { type: 'saveAlumni', alumniId: 'shahriar' });
  assert.equal(saveRes1.saved, true);

  const resAfterSave = await listAlumni(db(), 'tasnim', { q: 'Northwind' });
  assert.equal(resAfterSave.alumni[0]!.saved, true);

  const saveRes2 = await does('tasnim', { type: 'saveAlumni', alumniId: 'shahriar' });
  assert.equal(saveRes2.saved, false);

  // Availability toggle: non-owner/non-admin refused
  await refused(
    403,
    does('tasnim', { type: 'setAvailableForQuestions', userId: 'shahriar', available: false }),
  );
  // Owner can toggle
  const availRes = await does('shahriar', {
    type: 'setAvailableForQuestions',
    userId: 'shahriar',
    available: false,
  });
  assert.equal(availRes.available, false);
  const checkShahriar = await listAlumni(db(), 'tasnim', { q: 'shahriar' });
  assert.equal(checkShahriar.alumni[0]!.available_for_questions, false);
  // Restore
  await does('shahriar', { type: 'setAvailableForQuestions', userId: 'shahriar', available: true });
});

test('alumni jobs: listing, filters, create with validation & live preview schema', async () => {
  // List all jobs
  const allJobs = await listAlumniJobs(db(), 'tasnim', {});
  assert.ok(allJobs.jobs.length >= 4, 'seeded jobs should be present');
  assert.ok(allJobs.total >= 4);

  // Source filter
  const manualOnly = await listAlumniJobs(db(), 'tasnim', { source: 'manual' });
  assert.ok(manualOnly.jobs.every((j) => j.source === 'manual'));

  const fetchedOnly = await listAlumniJobs(db(), 'tasnim', { source: 'fetched' });
  assert.ok(fetchedOnly.jobs.every((j) => j.source === 'fetched'));

  // Create job: permission check (regular member refused)
  await refused(
    403,
    does('tasnim', {
      type: 'createAlumniJob',
      company: 'Test Corp',
      role: 'Junior Dev',
      location: 'Dhaka',
      url: 'https://example.com/job/1',
      job_type: 'Full-time',
    }),
  );

  // Alumni can post job
  const newJob = await does('shahriar', {
    type: 'createAlumniJob',
    company: 'TestCorp',
    role: 'Senior React Engineer',
    title: 'Senior React Engineer',
    location: 'Dhaka · Remote',
    url: 'https://testcorp.example/jobs/react',
    vacancies: 2,
    job_type: 'Full-time',
    experience: '3+ years',
    salary: '৳120k',
    description: 'Great opportunity to build modern apps.',
    responsibilities: ['Build frontends', 'Review PRs'],
    requirements: ['React 19', 'TypeScript'],
    deadline: '2026-12-31',
  });
  assert.equal(newJob.company, 'TestCorp');
  assert.equal(newJob.vacancies, 2);
  assert.equal(newJob.mine, true);

  // Viewer sees mine = false
  const jobsView = await listAlumniJobs(db(), 'tasnim', { q: 'TestCorp' });
  assert.equal(jobsView.jobs.length, 1);
  assert.equal(jobsView.jobs[0]!.mine, false);

  // Delete job: non-owner refused
  await refused(403, does('tasnim', { type: 'deleteAlumniJob', jobId: newJob.id }));
  // Admin-panel officers (here the Treasurer) get no say over listings; the matrix gives it to the President.
  await refused(403, does('anika', { type: 'deleteAlumniJob', jobId: newJob.id }));
  await refused(403, fetchAlumniJobs(db(), 'anika', { userId: 'shahriar' }));
  // Owner deletes
  const delRes = await does('shahriar', { type: 'deleteAlumniJob', jobId: newJob.id });
  assert.equal(delRes.deleted, true);
});

test('interview prep: topics, tree progress, problems, tips & experiences', async () => {
  // List topics
  const { topics } = await listInterviewTopics(db(), 'tasnim');
  assert.ok(topics.length >= 5, 'at least 5 seeded topics');
  const dsa = topics.find((t) => t.name.includes('Arrays') || t.name.includes('DSA'));
  assert.ok(dsa, 'Arrays topic exists');

  // Get topic detail
  const detail = await getInterviewTopicDetail(db(), 'tasnim', { topicId: dsa!.id });
  assert.ok(detail.problems.length >= 1, 'topic has problems');
  assert.equal(typeof detail.topic.solvedCount, 'number');

  const prob = detail.problems[0]!;
  const initialSolved = prob.solved;

  // Toggle problem solve status
  const toggled = await does('tasnim', { type: 'toggleInterviewProblem', problemId: prob.id });
  assert.equal(toggled.solved, !initialSolved);

  // Detail reflects updated solved_count
  const detailAfter = await getInterviewTopicDetail(db(), 'tasnim', { topicId: dsa!.id });
  assert.equal(detailAfter.topic.solvedCount, detail.topic.solvedCount + (toggled.solved ? 1 : -1));

  // Regular member cannot create a problem
  await refused(
    403,
    does('tasnim', {
      type: 'createInterviewProblem',
      topicId: dsa!.id,
      title: 'Graph Cycle',
      url: 'https://leetcode.com/1',
      difficulty: 'medium',
    }),
  );

  // Alumni can create tip
  const newTip = await does('shahriar', {
    type: 'createInterviewTip',
    topicId: dsa!.id,
    title: 'How to approach two pointer problems',
    body_md: 'Start by sorting if array is not sorted...',
  });
  assert.equal(
    (await db().query(`select author_id from interview_tips where id = $1`, [newTip.id])).rows[0]
      .author_id,
    'shahriar',
  );

  // Non-owner cannot delete tip
  await refused(403, does('tasnim', { type: 'deleteInterviewTip', tipId: newTip.id }));
  await refused(403, does('anika', { type: 'deleteInterviewTip', tipId: newTip.id }));
  // Owner can delete tip
  const delTip = await does('shahriar', { type: 'deleteInterviewTip', tipId: newTip.id });
  assert.equal(delTip.deleted, true);
});

test('interview roadmaps: CP head and president CRUD a topic tree', async () => {
  const tree = [
    { key: 'r', parentKey: null, name: 'Basics', x: 200, y: 40 },
    { key: 'a', parentKey: 'r', name: 'Arrays', x: 0, y: 180 },
    { key: 'b', parentKey: 'r', name: 'Strings', x: 400, y: 180 },
  ];
  await refused(403, does('tasnim', { type: 'saveInterviewRoadmap', name: 'Mine', topics: tree }));
  await refused(
    400,
    does('nadia', {
      type: 'saveInterviewRoadmap',
      name: 'Loop',
      topics: [
        { key: 'x', parentKey: 'y', name: 'One' },
        { key: 'y', parentKey: 'x', name: 'Two' },
      ],
    }),
  );

  // Two children under one root.
  const { roadmapId } = await does('nadia', {
    type: 'saveInterviewRoadmap',
    name: 'Warm-up',
    topics: tree,
  });
  const first = (await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics;
  const id = (n: string) => first.find((t) => t.name === n)!.id;
  assert.equal(first.length, 3);
  assert.equal(first.filter((t) => t.parent_id === id('Basics')).length, 2);

  // President edits: rename root, drop Arrays, hang a new topic under Strings.
  await does('tanvir', {
    type: 'saveInterviewRoadmap',
    roadmapId,
    name: 'Warm-up',
    topics: [
      { key: 'r', id: id('Basics'), parentKey: null, name: 'Fundamentals', x: 200, y: 40 },
      { key: 'b', id: id('Strings'), parentKey: 'r', name: 'Strings', x: 400, y: 180 },
      { key: 'n', parentKey: 'b', name: 'Tries', x: 400, y: 320 },
    ],
  });
  const second = (await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics;
  assert.deepEqual(second.map((t) => t.name).sort(), ['Fundamentals', 'Strings', 'Tries']);
  assert.equal(second.find((t) => t.name === 'Tries')!.parent_id, id('Strings'));

  // Topic ids from another roadmap are refused.
  await refused(
    400,
    does('nadia', {
      type: 'saveInterviewRoadmap',
      roadmapId,
      name: 'Warm-up',
      topics: [{ key: 'z', id: 1, parentKey: null, name: 'Stolen' }],
    }),
  );

  // Problems and links ride along with the tree.
  const T = (n: string) => second.find((t) => t.name === n)!.id;
  const tree3 = (problems: { s: unknown[]; t: unknown[] }) => [
    { key: 'r', id: T('Fundamentals'), parentKey: null, name: 'Fundamentals' },
    {
      key: 'b',
      id: T('Strings'),
      parentKey: 'r',
      name: 'Strings',
      link: 'https://youtube.com/playlist?list=x',
      problems: problems.s,
    },
    { key: 'n', id: T('Tries'), parentKey: 'b', name: 'Tries', problems: problems.t },
  ];
  await refused(
    400,
    does('nadia', {
      type: 'saveInterviewRoadmap',
      roadmapId,
      name: 'Warm-up',
      topics: tree3({
        s: [{ title: 'Bad', url: 'javascript:alert(1)', difficulty: 'easy' }],
        t: [],
      }),
    }),
  );
  await does('nadia', {
    type: 'saveInterviewRoadmap',
    roadmapId,
    name: 'Warm-up',
    topics: tree3({
      s: [
        {
          title: 'Valid Anagram',
          url: 'https://leetcode.com/problems/valid-anagram/',
          difficulty: 'easy',
        },
        {
          title: 'Group Anagrams',
          url: 'https://leetcode.com/problems/group-anagrams/',
          difficulty: 'medium',
        },
      ],
      t: [],
    }),
  });
  let probs = (await listInterviewProblems(db(), { roadmapId })).problems;
  assert.equal(probs.length, 2);
  const anagram = probs.find((q) => q.title === 'Valid Anagram')!;
  await does('tasnim', { type: 'toggleInterviewProblem', problemId: anagram.id });
  const topics3 = (await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics;
  assert.equal(
    topics3.find((t) => t.name === 'Strings')!.link,
    'https://youtube.com/playlist?list=x',
  );

  // Edit one in place and move it to Tries, drop the other: progress survives the edit.
  await does('tanvir', {
    type: 'saveInterviewRoadmap',
    roadmapId,
    name: 'Warm-up',
    topics: tree3({
      s: [],
      t: [{ id: anagram.id, title: 'Valid Anagram II', url: anagram.url, difficulty: 'hard' }],
    }),
  });
  probs = (await listInterviewProblems(db(), { roadmapId })).problems;
  assert.deepEqual(
    probs.map((q) => [q.id, q.title, q.difficulty, q.topic_id]),
    [[anagram.id, 'Valid Anagram II', 'hard', T('Tries')]],
  );
  const tries = (await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics.find(
    (t) => t.name === 'Tries',
  )!;
  assert.equal(tries.solvedCount, 1);

  // Someone else's problem id is refused.
  await refused(
    400,
    does('nadia', {
      type: 'saveInterviewRoadmap',
      roadmapId,
      name: 'Warm-up',
      topics: tree3({
        s: [{ id: 1, title: 'Two Sum', url: 'https://x.io', difficulty: 'easy' }],
        t: [],
      }),
    }),
  );

  await refused(403, does('tasnim', { type: 'deleteInterviewRoadmap', roadmapId }));
  await does('nadia', { type: 'deleteInterviewRoadmap', roadmapId });
  assert.equal((await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics.length, 0);
});

test('blog posts: create, read, update, tags filter, delete & permissions', async () => {
  // List published blogs
  const list = await listBlogPosts(db(), 'tasnim', {});
  assert.ok(list.posts.length >= 2, 'seeded blogs exist');
  assert.ok(list.tags.length >= 1, 'tags extracted');

  // Get blog by slug
  const first = list.posts[0]!;
  const post = await getBlogPost(db(), first.slug);
  assert.equal(post.title, first.title);
  assert.ok(post.views >= 0);

  // Regular member cannot create blog post
  await refused(
    403,
    does('tasnim', {
      type: 'createBlogPost',
      title: 'My Journey',
      body_md: 'Here is my story...',
      tags: ['Career'],
    }),
  );

  // Alumni can create blog post
  const created = await does('shahriar', {
    type: 'createBlogPost',
    title: '10 Lessons From 5 Years in Big Tech',
    subtitle: 'What school never taught me',
    body_md: '# Introduction\n\nSoftware engineering in practice is about people and trade-offs.',
    tags: ['Engineering', 'Career'],
    status: 'published',
  });
  assert.ok(created.slug.includes('10-lessons'));
  assert.equal(created.author_id, 'shahriar');

  // Non-owner cannot update
  await refused(
    403,
    does('tahmina', { type: 'updateBlogPost', id: created.id, title: 'Hacked Title' }),
  );

  // Owner can update
  const updated = await does('shahriar', {
    type: 'updateBlogPost',
    id: created.id,
    title: '10 Lessons From 5 Years in Big Tech (Updated)',
  });
  assert.equal(updated.title, '10 Lessons From 5 Years in Big Tech (Updated)');

  // Non-owner cannot delete
  await refused(403, does('tasnim', { type: 'deleteBlogPost', id: created.id }));

  // Owner can delete
  const delBlog = await does('shahriar', { type: 'deleteBlogPost', id: created.id });
  assert.equal(delBlog.deleted, true);
});

test('alumni content: image URLs must be http(s)', async () => {
  await refused(
    400,
    act('shahriar', {
      type: 'createAlumniJob',
      company: 'Acme',
      title: 'Engineer',
      url: 'https://example.com/job',
      company_logo_url: 'javascript:alert(1)',
    }),
  );
  await refused(
    400,
    act('shahriar', {
      type: 'createBlogPost',
      title: 'A post title',
      body_md: 'Some body text that is long enough.',
      cover_url: 'data:image/svg+xml,<svg/>',
    }),
  );
});

test('learning roadmap: one only, kept by the CP Head and President, never listed with interview prep', async () => {
  const tree = [{ key: 'r', parentKey: null, name: 'C++ basics' }];
  await refused(
    403,
    does('tasnim', { type: 'saveInterviewRoadmap', kind: 'learn', name: 'Learn', topics: tree }),
  );
  const { roadmapId } = await does('nadia', {
    type: 'saveInterviewRoadmap',
    kind: 'learn',
    name: 'Learn',
    topics: tree,
  });
  await refused(
    409,
    does('tanvir', { type: 'saveInterviewRoadmap', kind: 'learn', name: 'Again', topics: tree }),
  );
  const learn = (await listInterviewRoadmaps(db(), 'tasnim', 'learn')).roadmaps;
  assert.deepEqual(
    learn.map((r) => r.id),
    [roadmapId],
  );
  assert.ok(
    !(await listInterviewRoadmaps(db(), 'tasnim')).roadmaps.some((r) => r.id === roadmapId),
  );
  // Editing keeps it the learning roadmap.
  await does('tanvir', { type: 'saveInterviewRoadmap', roadmapId, name: 'Learn v2', topics: tree });
  assert.equal(
    (await listInterviewRoadmaps(db(), 'tasnim', 'learn')).roadmaps[0]!.name,
    'Learn v2',
  );
});

test('interview topics: only roadmap managers set the editorial link', async () => {
  const { roadmapId } = await does('nadia', {
    type: 'saveInterviewRoadmap',
    name: 'Editorials',
    topics: [{ key: 'r', parentKey: null, name: 'Greedy', x: 0, y: 0 }],
  });
  const [topic] = (await listInterviewTopics(db(), 'tasnim', { roadmapId })).topics;
  const set = (who: string, link: string) =>
    does(who, { type: 'setInterviewTopicLink', topicId: topic!.id, link });
  await refused(403, set('tasnim', 'https://youtube.com/x'));
  await refused(400, set('nadia', 'javascript:alert(1)'));
  assert.equal((await set('tanvir', 'https://youtube.com/x')).link, 'https://youtube.com/x');
  const link = async () =>
    (await db().query(`select link from interview_topics where id = $1`, [topic!.id])).rows[0].link;
  assert.equal(await link(), 'https://youtube.com/x');
  assert.equal((await set('nadia', '')).link, null);
  assert.equal(await link(), null);
});
