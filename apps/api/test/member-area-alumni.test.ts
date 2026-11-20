// Backend tests for Alumni section: Directory, Jobs, Interview Prep & Blogs
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  act,
  createAlumniJob,
  createBlogPost,
  createInterviewProblem,
  createInterviewTip,
  createInterviewTopic,
  deleteAlumniJob,
  deleteBlogPost,
  deleteInterviewTip,
  getBlogPost,
  getInterviewTopicDetail,
  listAlumni,
  listAlumniJobs,
  listBlogPosts,
  listInterviewExperiences,
  listInterviewTopics,
  saveAlumni,
  setAvailableForQuestions,
  toggleInterviewProblem,
  updateBlogPost,
} from '../src/modules/member-area/actions.ts';
import { Fail, pool } from '../src/modules/member-area/db.ts';
import { setup } from '../src/db/seed-data.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test');
const PW = 'test-password-123';
const db = () => pool();
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

test('alumni directory: listing, filtering, mentoring toggle & saving', async () => {
  // List all alumni
  const resAll = await listAlumni(db(), 'tasnim', {});
  assert.ok(resAll.total >= 3, 'should have at least 3 seeded alumni');
  assert.ok(resAll.alumni.length <= 16, 'page limit default 16');

  // Mentoring filter
  const resMentoring = await listAlumni(db(), 'tasnim', { mentoringOnly: true });
  assert.ok(resMentoring.alumni.every((a) => a.available_for_questions));
  assert.ok(resMentoring.total <= resAll.total);

  // Search filter
  const resSearch = await listAlumni(db(), 'tasnim', { q: 'Northwind' });
  assert.ok(resSearch.alumni.length >= 1);
  assert.equal(resSearch.alumni[0]!.id, 'shahriar');

  // Save / Unsave
  assert.equal(resSearch.alumni[0]!.saved, false);
  const saveRes1 = await saveAlumni(db(), 'tasnim', { alumniId: 'shahriar' });
  assert.equal(saveRes1.saved, true);

  const resAfterSave = await listAlumni(db(), 'tasnim', { q: 'Northwind' });
  assert.equal(resAfterSave.alumni[0]!.saved, true);

  const saveRes2 = await saveAlumni(db(), 'tasnim', { alumniId: 'shahriar' });
  assert.equal(saveRes2.saved, false);

  // Mentoring availability toggle: non-owner/non-admin refused
  await refused(
    403,
    setAvailableForQuestions(db(), 'tasnim', { userId: 'shahriar', available: false }),
  );
  // Owner can toggle
  const availRes = await setAvailableForQuestions(db(), 'shahriar', {
    userId: 'shahriar',
    available: false,
  });
  assert.equal(availRes.available, false);
  const checkShahriar = await listAlumni(db(), 'tasnim', { q: 'shahriar' });
  assert.equal(checkShahriar.alumni[0]!.available_for_questions, false);
  // Restore
  await setAvailableForQuestions(db(), 'shahriar', { userId: 'shahriar', available: true });
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
    createAlumniJob(db(), 'tasnim', {
      company: 'Test Corp',
      role: 'Junior Dev',
      location: 'Dhaka',
      url: 'https://example.com/job/1',
      job_type: 'Full-time',
    }),
  );

  // Alumni can post job
  const newJob = await createAlumniJob(db(), 'shahriar', {
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
  await refused(403, deleteAlumniJob(db(), 'tasnim', { jobId: newJob.id }));
  // Owner deletes
  const delRes = await deleteAlumniJob(db(), 'shahriar', { jobId: newJob.id });
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
  const toggled = await toggleInterviewProblem(db(), 'tasnim', { problemId: prob.id });
  assert.equal(toggled.solved, !initialSolved);

  // Detail reflects updated solved_count
  const detailAfter = await getInterviewTopicDetail(db(), 'tasnim', { topicId: dsa!.id });
  assert.equal(detailAfter.topic.solvedCount, detail.topic.solvedCount + (toggled.solved ? 1 : -1));

  // Regular member cannot create problem or topic
  await refused(
    403,
    createInterviewTopic(db(), 'tasnim', { name: 'Graphs Topic', description: 'All about graphs' }),
  );
  await refused(
    403,
    createInterviewProblem(db(), 'tasnim', {
      topic_id: dsa!.id,
      title: 'Graph Cycle',
      url: 'https://leetcode.com/1',
      difficulty: 'medium',
    }),
  );

  // Alumni can create tip
  const newTip = await createInterviewTip(db(), 'shahriar', {
    topic_id: dsa!.id,
    title: 'How to approach two pointer problems',
    body_md: 'Start by sorting if array is not sorted...',
  });
  assert.equal(newTip.author_name, 'Shahriar Kabir');

  // Non-owner cannot delete tip
  await refused(403, deleteInterviewTip(db(), 'tasnim', { tipId: newTip.id }));
  // Owner can delete tip
  const delTip = await deleteInterviewTip(db(), 'shahriar', { tipId: newTip.id });
  assert.equal(delTip.deleted, true);

  // List interview experiences
  const exps = await listInterviewExperiences(db());
  assert.ok(exps.experiences.length >= 1, 'seeded experiences exist');
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
    createBlogPost(db(), 'tasnim', {
      title: 'My Journey',
      body_md: 'Here is my story...',
      tags: ['Career'],
    }),
  );

  // Alumni can create blog post
  const created = await createBlogPost(db(), 'shahriar', {
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
    updateBlogPost(db(), 'tahmina', {
      id: created.id,
      title: 'Hacked Title',
    }),
  );

  // Owner can update
  const updated = await updateBlogPost(db(), 'shahriar', {
    id: created.id,
    title: '10 Lessons From 5 Years in Big Tech (Updated)',
  });
  assert.equal(updated.title, '10 Lessons From 5 Years in Big Tech (Updated)');

  // Non-owner cannot delete
  await refused(403, deleteBlogPost(db(), 'tasnim', { id: created.id }));

  // Owner can delete
  const delBlog = await deleteBlogPost(db(), 'shahriar', { id: created.id });
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
