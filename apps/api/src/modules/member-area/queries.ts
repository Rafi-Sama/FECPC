// The member area's paged reads, sent as { action, ...args } and answered as JSON. Each function checks its own
// permissions; the caller only proves who `id` is. Writes that answer with data (a saved flag, a new id) are
// accepted here too, but every one of them runs through act(): one transaction, the actor's row lock, the audit
// section and the shared-cache refresh, exactly like a change sent to /me/actions.
import {
  act,
  fetchAlumniJobs,
  getBlogPost,
  getFeedPostDetail,
  getIdeaDetail,
  getInterviewTopicDetail,
  getMemberProfile,
  listAlumni,
  listAlumniJobs,
  listBlogPosts,
  listFeedPosts,
  listFeedReports,
  listIdeas,
  listInterviewProblems,
  listInterviewRoadmaps,
  listInterviewTopics,
  listMembers,
} from './actions.ts';
import { Fail, type Db } from './db.ts';
import { getTeam } from './teams.ts';
import { loadState } from './state.ts';
import type { In } from './rules.ts';

/** Writes that answer with data. They run as actions: the query endpoint only carries them. */
const WRITES = new Set([
  'saveAlumni',
  'setAvailableForQuestions',
  'createAlumniJob',
  'deleteAlumniJob',
  'saveInterviewRoadmap',
  'deleteInterviewRoadmap',
  'toggleInterviewProblem',
  'createInterviewProblem',
  'deleteInterviewProblem',
  'createInterviewTip',
  'deleteInterviewTip',
  'createBlogPost',
  'updateBlogPost',
  'deleteBlogPost',
  'kudosMilestone',
]);
const write = (id: string, action: string, b: In) => act(id, { ...b, type: action });

export async function alumni(db: Db, id: string, b: In): Promise<unknown> {
  const action = String(b.action ?? '');
  if (WRITES.has(action)) return write(id, action, b);

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

  // --- INTERVIEW PREP ---
  if (action === 'listInterviewRoadmaps') {
    return listInterviewRoadmaps(db, id, b.kind === 'learn' ? 'learn' : 'prep');
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

  throw new Fail(400, 'Unknown alumni action.');
}

export async function community(db: Db, id: string, b: In): Promise<unknown> {
  const action = String(b.action ?? '');
  // The store applies the fresh state the kudos answer carries (the giver's count and the milestone's).
  if (action === 'kudosMilestone')
    return { ...((await write(id, action, b)) as object), state: await loadState(db, id) };
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
  if (action === 'listFeedReports') return listFeedReports(db, id);
  if (action === 'getTeam') return getTeam(db, id, { teamId: b.teamId });
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
