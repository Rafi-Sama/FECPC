import {
  createAlumniJob,
  createBlogPost,
  createInterviewProblem,
  createInterviewTip,
  createInterviewTopic,
  deleteAlumniJob,
  deleteBlogPost,
  deleteInterviewProblem,
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
} from "@/server/actions";
import { Fail, pool } from "@/server/db";
import { body, respond, signedIn } from "@/server/http";

export const POST = (req: Request) =>
  respond(async () => {
    const b = await body(req);
    const id = await signedIn();
    const db = pool();
    const action = String(b.action ?? "");

    // --- ALUMNI DIRECTORY ---
    if (action === "listAlumni") {
      return listAlumni(db, id, {
        q: typeof b.q === "string" ? b.q : undefined,
        batch: typeof b.batch === "number" || typeof b.batch === "string" ? b.batch : undefined,
        location: typeof b.location === "string" ? b.location : undefined,
        mentoringOnly: typeof b.mentoringOnly === "boolean" ? b.mentoringOnly : undefined,
        page: typeof b.page === "number" ? b.page : undefined,
        pageSize: typeof b.pageSize === "number" ? b.pageSize : undefined,
      });
    }

    if (action === "saveAlumni") {
      return saveAlumni(db, id, { alumniId: String(b.alumniId ?? "") });
    }

    if (action === "setAvailableForQuestions") {
      return setAvailableForQuestions(db, id, {
        value: Boolean(b.value ?? b.available),
        alumniId: typeof b.alumniId === "string" ? b.alumniId : (typeof b.userId === "string" ? b.userId : undefined),
      });
    }

    // --- JOBS ---
    if (action === "listAlumniJobs") {
      return listAlumniJobs(db, id, {
        q: typeof b.q === "string" ? b.q : undefined,
        type: typeof b.type === "string" ? b.type : undefined,
        sort: typeof b.sort === "string" ? b.sort : undefined,
        src: typeof b.src === "string" ? b.src : (typeof b.source === "string" ? b.source : undefined),
      });
    }

    if (action === "createAlumniJob") {
      return createAlumniJob(db, id, {
        company: String(b.company ?? ""),
        title: String(b.title ?? b.role ?? ""),
        role: String(b.role ?? b.title ?? ""),
        vacancies: typeof b.vacancies === "number" ? b.vacancies : undefined,
        location: typeof b.location === "string" ? b.location : null,
        job_type: typeof b.job_type === "string" ? b.job_type : null,
        experience: typeof b.experience === "string" ? b.experience : null,
        salary: typeof b.salary === "string" ? b.salary : null,
        description: typeof b.description === "string" ? b.description : null,
        responsibilities: Array.isArray(b.responsibilities) ? b.responsibilities : undefined,
        requirements: Array.isArray(b.requirements) ? b.requirements : undefined,
        deadline: typeof b.deadline === "string" ? b.deadline : null,
        company_logo_url: typeof b.company_logo_url === "string" ? b.company_logo_url : null,
        url: String(b.url ?? ""),
      });
    }

    if (action === "deleteAlumniJob") {
      return deleteAlumniJob(db, id, { jobId: b.jobId as number | string });
    }

    // --- INTERVIEW PREP ---
    if (action === "listInterviewTopics") {
      return listInterviewTopics(db, id);
    }

    if (action === "getInterviewTopicDetail") {
      return getInterviewTopicDetail(db, id, { topicId: b.topicId as number | string });
    }

    if (action === "toggleInterviewProblem") {
      return toggleInterviewProblem(db, id, { problemId: b.problemId as number | string });
    }

    if (action === "createInterviewTopic") {
      return createInterviewTopic(db, id, {
        name: String(b.name ?? ""),
        description: typeof b.description === "string" ? b.description : undefined,
      });
    }

    if (action === "createInterviewProblem") {
      return createInterviewProblem(db, id, {
        topicId: (b.topicId ?? b.topic_id) as number | string,
        title: String(b.title ?? ""),
        url: String(b.url ?? ""),
        difficulty: String(b.difficulty ?? "easy"),
      });
    }

    if (action === "deleteInterviewProblem") {
      return deleteInterviewProblem(db, id, { problemId: b.problemId as number | string });
    }

    if (action === "createInterviewTip") {
      return createInterviewTip(db, id, {
        topicId: (b.topicId ?? b.topic_id) as number | string | null | undefined,
        title: String(b.title ?? ""),
        body_md: String(b.body_md ?? ""),
      });
    }

    if (action === "deleteInterviewTip") {
      return deleteInterviewTip(db, id, { tipId: b.tipId as number | string });
    }

    if (action === "listInterviewExperiences") {
      return listInterviewExperiences(db);
    }

    // --- BLOGS ---
    if (action === "listBlogPosts") {
      return listBlogPosts(db, id, {
        q: typeof b.q === "string" ? b.q : undefined,
        tag: typeof b.tag === "string" ? b.tag : undefined,
        sort: typeof b.sort === "string" ? b.sort : undefined,
        page: typeof b.page === "number" ? b.page : undefined,
        pageSize: typeof b.pageSize === "number" ? b.pageSize : undefined,
      });
    }

    if (action === "getBlogPost") {
      return getBlogPost(db, id, {
        slug: typeof b.slug === "string" ? b.slug : undefined,
        id: b.id as number | string | undefined,
      });
    }

    if (action === "createBlogPost") {
      return createBlogPost(db, id, {
        title: String(b.title ?? ""),
        subtitle: typeof b.subtitle === "string" ? b.subtitle : null,
        excerpt: typeof b.excerpt === "string" ? b.excerpt : null,
        body_md: String(b.body_md ?? ""),
        cover_url: typeof b.cover_url === "string" ? b.cover_url : null,
        tags: Array.isArray(b.tags) ? b.tags : undefined,
        slug: typeof b.slug === "string" ? b.slug : null,
        status: b.status === "published" || b.status === "draft" ? b.status : "draft",
      });
    }

    if (action === "updateBlogPost") {
      return updateBlogPost(db, id, {
        id: b.id as number | string,
        title: typeof b.title === "string" ? b.title : undefined,
        subtitle: typeof b.subtitle === "string" ? b.subtitle : (b.subtitle === null ? null : undefined),
        excerpt: typeof b.excerpt === "string" ? b.excerpt : (b.excerpt === null ? null : undefined),
        body_md: typeof b.body_md === "string" ? b.body_md : undefined,
        cover_url: typeof b.cover_url === "string" ? b.cover_url : (b.cover_url === null ? null : undefined),
        tags: Array.isArray(b.tags) ? b.tags : undefined,
        slug: typeof b.slug === "string" ? b.slug : undefined,
        status: typeof b.published === "boolean" ? (b.published ? "published" : "draft") : (b.status === "published" || b.status === "draft" ? b.status : undefined),
      });
    }

    if (action === "deleteBlogPost") {
      return deleteBlogPost(db, id, { id: b.id as number | string });
    }

    throw new Fail(400, "Unknown alumni action.");
  });
