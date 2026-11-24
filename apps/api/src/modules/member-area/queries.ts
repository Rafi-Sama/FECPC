// The member area's read and write queries, sent as { action, ...args } and answered as JSON.
// Each function below checks its own permissions; the caller only proves who `id` is.
import {
  createAlumniJob,
  createBlogPost,
  createInterviewProblem,
  createInterviewTip,
  createInterviewTopic,
  deleteAlumniJob,
  deleteBlogPost,
  deleteInterviewProblem,
  deleteInterviewRoadmap,
  deleteInterviewTip,
  fetchAlumniJobs,
  getBlogPost,
  getFeedPostDetail,
  getIdeaDetail,
  getInterviewTopicDetail,
  getKudosTodayCount,
  getMemberProfile,
  kudosMilestone,
  listAlumni,
  listAlumniJobs,
  listBlogPosts,
  listFeedPosts,
  listFeedReports,
  listIdeas,
  listInterviewExperiences,
  listInterviewProblems,
  listInterviewRoadmaps,
  listInterviewTopics,
  listMembers,
  listRecentMilestones,
  saveAlumni,
  saveInterviewRoadmap,
  setAvailableForQuestions,
  toggleInterviewProblem,
  updateBlogPost,
} from './actions.ts';
import { Fail, type Db } from './db.ts';
import { getTeam } from './teams.ts';
import { loadState } from './state.ts';

type In = Record<string, unknown>;

export async function alumni(db: Db, id: string, b: In): Promise<unknown> {
  const action = String(b.action ?? '');

  // --- ALUMNI DIRECTORY ---
  if (action === 'listAlumni') {
    return listAlumni(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      batch: typeof b.batch === 'number' || typeof b.batch === 'string' ? b.batch : undefined,
      location: typeof b.location === 'string' ? b.location : undefined,
      availableOnly: typeof b.availableOnly === 'boolean' ? b.availableOnly : undefined,
      page: typeof b.page === 'number' ? b.page : undefined,
      pageSize: typeof b.pageSize === 'number' ? b.pageSize : undefined,
    });
  }

  if (action === 'saveAlumni') {
    return saveAlumni(db, id, { alumniId: String(b.alumniId ?? '') });
  }

  if (action === 'setAvailableForQuestions') {
    return setAvailableForQuestions(db, id, {
      value: Boolean(b.value ?? b.available),
      alumniId:
        typeof b.alumniId === 'string'
          ? b.alumniId
          : typeof b.userId === 'string'
            ? b.userId
            : undefined,
    });
  }

  // --- JOBS ---
  if (action === 'listAlumniJobs') {
    return listAlumniJobs(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      type: typeof b.type === 'string' ? b.type : undefined,
      sort: typeof b.sort === 'string' ? b.sort : undefined,
      src: typeof b.src === 'string' ? b.src : typeof b.source === 'string' ? b.source : undefined,
      offset: typeof b.offset === 'number' ? b.offset : undefined,
    });
  }

  if (action === 'createAlumniJob') {
    return createAlumniJob(db, id, {
      company: String(b.company ?? ''),
      title: String(b.title ?? b.role ?? ''),
      role: String(b.role ?? b.title ?? ''),
      vacancies: typeof b.vacancies === 'number' ? b.vacancies : undefined,
      location: typeof b.location === 'string' ? b.location : null,
      job_type: typeof b.job_type === 'string' ? b.job_type : null,
      experience: typeof b.experience === 'string' ? b.experience : null,
      salary: typeof b.salary === 'string' ? b.salary : null,
      description: typeof b.description === 'string' ? b.description : null,
      responsibilities: Array.isArray(b.responsibilities) ? b.responsibilities : undefined,
      requirements: Array.isArray(b.requirements) ? b.requirements : undefined,
      deadline: typeof b.deadline === 'string' ? b.deadline : null,
      company_logo_url: typeof b.company_logo_url === 'string' ? b.company_logo_url : null,
      url: String(b.url ?? ''),
    });
  }

  if (action === 'deleteAlumniJob') {
    return deleteAlumniJob(db, id, { jobId: b.jobId as number | string });
  }

  // --- INTERVIEW PREP ---
  if (action === 'listInterviewRoadmaps') {
    return listInterviewRoadmaps(db, id, b.kind === 'learn' ? 'learn' : 'prep');
  }

  if (action === 'saveInterviewRoadmap') {
    return saveInterviewRoadmap(id, b);
  }

  if (action === 'deleteInterviewRoadmap') {
    return deleteInterviewRoadmap(id, b);
  }

  if (action === 'listInterviewProblems') {
    return listInterviewProblems(db, { roadmapId: b.roadmapId });
  }

  if (action === 'listInterviewTopics') {
    return listInterviewTopics(db, id, { roadmapId: b.roadmapId });
  }

  if (action === 'getInterviewTopicDetail') {
    return getInterviewTopicDetail(db, id, { topicId: b.topicId as number | string });
  }

  if (action === 'toggleInterviewProblem') {
    return toggleInterviewProblem(db, id, { problemId: b.problemId as number | string });
  }

  if (action === 'createInterviewTopic') {
    return createInterviewTopic(db, id, {
      name: String(b.name ?? ''),
      description: typeof b.description === 'string' ? b.description : undefined,
      roadmapId: b.roadmapId,
      parentId: b.parentId,
    });
  }

  if (action === 'createInterviewProblem') {
    return createInterviewProblem(db, id, {
      topicId: (b.topicId ?? b.topic_id) as number | string,
      title: String(b.title ?? ''),
      url: String(b.url ?? ''),
      difficulty: String(b.difficulty ?? 'easy'),
    });
  }

  if (action === 'deleteInterviewProblem') {
    return deleteInterviewProblem(db, id, { problemId: b.problemId as number | string });
  }

  if (action === 'createInterviewTip') {
    return createInterviewTip(db, id, {
      topicId: (b.topicId ?? b.topic_id) as number | string | null | undefined,
      title: String(b.title ?? ''),
      body_md: String(b.body_md ?? ''),
    });
  }

  if (action === 'deleteInterviewTip') {
    return deleteInterviewTip(db, id, { tipId: b.tipId as number | string });
  }

  if (action === 'listInterviewExperiences') {
    return listInterviewExperiences(db);
  }

  // --- BLOGS ---
  if (action === 'listBlogPosts') {
    return listBlogPosts(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      tag: typeof b.tag === 'string' ? b.tag : undefined,
      sort: typeof b.sort === 'string' ? b.sort : undefined,
      page: typeof b.page === 'number' ? b.page : undefined,
      pageSize: typeof b.pageSize === 'number' ? b.pageSize : undefined,
    });
  }

  if (action === 'getBlogPost') {
    return getBlogPost(db, id, {
      slug: typeof b.slug === 'string' ? b.slug : undefined,
      id: b.id as number | string | undefined,
    });
  }

  if (action === 'createBlogPost') {
    return createBlogPost(db, id, {
      title: String(b.title ?? ''),
      subtitle: typeof b.subtitle === 'string' ? b.subtitle : null,
      excerpt: typeof b.excerpt === 'string' ? b.excerpt : null,
      body_md: String(b.body_md ?? ''),
      cover_url: typeof b.cover_url === 'string' ? b.cover_url : null,
      tags: Array.isArray(b.tags) ? b.tags : undefined,
      slug: typeof b.slug === 'string' ? b.slug : null,
      status: b.status === 'published' || b.status === 'draft' ? b.status : 'draft',
    });
  }

  if (action === 'updateBlogPost') {
    return updateBlogPost(db, id, {
      id: b.id as number | string,
      title: typeof b.title === 'string' ? b.title : undefined,
      subtitle:
        typeof b.subtitle === 'string' ? b.subtitle : b.subtitle === null ? null : undefined,
      excerpt: typeof b.excerpt === 'string' ? b.excerpt : b.excerpt === null ? null : undefined,
      body_md: typeof b.body_md === 'string' ? b.body_md : undefined,
      cover_url:
        typeof b.cover_url === 'string' ? b.cover_url : b.cover_url === null ? null : undefined,
      tags: Array.isArray(b.tags) ? b.tags : undefined,
      slug: typeof b.slug === 'string' ? b.slug : undefined,
      status:
        typeof b.published === 'boolean'
          ? b.published
            ? 'published'
            : 'draft'
          : b.status === 'published' || b.status === 'draft'
            ? b.status
            : undefined,
    });
  }

  if (action === 'deleteBlogPost') {
    return deleteBlogPost(db, id, { id: b.id as number | string });
  }

  throw new Fail(400, 'Unknown alumni action.');
}

export async function community(db: Db, id: string, b: In): Promise<unknown> {
  const action = String(b.action ?? '');
  if (action === 'listFeedPosts') {
    return listFeedPosts(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      category: typeof b.category === 'string' ? b.category : undefined,
      sort: typeof b.sort === 'string' ? b.sort : undefined,
      mine: b.mine === true,
      cursor: typeof b.cursor === 'string' || typeof b.cursor === 'number' ? b.cursor : undefined,
      limit: typeof b.limit === 'number' ? b.limit : undefined,
    });
  }
  if (action === 'getFeedPostDetail') {
    return getFeedPostDetail(db, id, { postId: b.postId as number | string });
  }
  if (action === 'listIdeas') {
    return listIdeas(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      type: typeof b.type === 'string' ? b.type : undefined,
      status: typeof b.status === 'string' ? b.status : undefined,
      sort: typeof b.sort === 'string' ? b.sort : undefined,
      mine: b.mine === true,
      cursor: typeof b.cursor === 'string' || typeof b.cursor === 'number' ? b.cursor : undefined,
      limit: typeof b.limit === 'number' ? b.limit : undefined,
    });
  }
  if (action === 'getIdeaDetail') {
    return getIdeaDetail(db, id, { ideaId: b.ideaId as number | string });
  }
  if (action === 'listRecentMilestones') {
    const items = await listRecentMilestones(db, id, {
      limit: typeof b.limit === 'number' ? b.limit : undefined,
    });
    return { items };
  }
  if (action === 'listFeedReports') return listFeedReports(db, id);
  if (action === 'getTeam') return getTeam(db, id, { teamId: b.teamId });
  if (action === 'getKudosTodayCount') {
    return { kudosToday: await getKudosTodayCount(db, id) };
  }
  if (action === 'kudosMilestone') {
    const result = await kudosMilestone(id, { milestoneId: b.milestoneId as number | string });
    return { ...result, state: await loadState(db, id) };
  }
  throw new Fail(400, 'Unknown community query.');
}

export async function members(db: Db, id: string, b: In): Promise<unknown> {
  const action = String(b.action ?? '');

  if (action === 'listMembers') {
    return listMembers(db, id, {
      q: typeof b.q === 'string' ? b.q : undefined,
      rating: typeof b.rating === 'string' ? b.rating : undefined,
      skill: typeof b.skill === 'string' ? b.skill : undefined,
      batch: typeof b.batch === 'number' || typeof b.batch === 'string' ? b.batch : undefined,
      page: typeof b.page === 'number' ? b.page : undefined,
      pageSize: typeof b.pageSize === 'number' ? b.pageSize : undefined,
    });
  }

  if (action === 'getMemberProfile') {
    return getMemberProfile(db, id, { userId: String(b.userId ?? '') });
  }

  // Contests page: every member's last rated Codeforces rounds (from the server's sync). Kept out of the roster,
  // which every page loads, because it is the bulk of a member's record and only this page reads it.
  if (action === 'clubRounds') {
    return (
      await db.query(
        `select id, name, nullif(coalesce(nullif(cf_handle, ''), handle), '') as handle,
           coalesce(cf_rating, nullif(rating, 0)) as cf_rating, cf_contests
         from users where not system and not suspended and cf_contests <> '[]'::jsonb
         order by rating desc, id`,
      )
    ).rows;
  }

  if (action === 'fetchAlumniJobs') {
    return fetchAlumniJobs(db, id, {
      userId: String(b.userId ?? ''),
      boards: Array.isArray(b.boards)
        ? (b.boards as { provider: 'greenhouse' | 'lever'; slug: string; company: string }[])
        : undefined,
    });
  }

  throw new Fail(400, 'Unknown members query.');
}
