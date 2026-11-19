import { getFeedPostDetail, getIdeaDetail, getKudosTodayCount, kudosMilestone, listFeedPosts, listIdeas, listRecentMilestones } from "@/server/actions";
import { Fail, pool } from "@/server/db";
import { body, respond, signedIn } from "@/server/http";
import { loadState } from "@/server/state";

export const POST = (req: Request) => respond(async () => {
  const b = await body(req);
  const id = await signedIn();
  const db = pool();
  const action = String(b.action ?? "");
  if (action === "listFeedPosts") {
    return listFeedPosts(db, id, {
      q: typeof b.q === "string" ? b.q : undefined,
      category: typeof b.category === "string" ? b.category : undefined,
      sort: typeof b.sort === "string" ? b.sort : undefined,
      cursor: typeof b.cursor === "string" || typeof b.cursor === "number" ? b.cursor : undefined,
      limit: typeof b.limit === "number" ? b.limit : undefined,
    });
  }
  if (action === "getFeedPostDetail") {
    return getFeedPostDetail(db, id, { postId: b.postId as number | string });
  }
  if (action === "listIdeas") {
    return listIdeas(db, id, {
      q: typeof b.q === "string" ? b.q : undefined,
      type: typeof b.type === "string" ? b.type : undefined,
      status: typeof b.status === "string" ? b.status : undefined,
      sort: typeof b.sort === "string" ? b.sort : undefined,
      cursor: typeof b.cursor === "string" || typeof b.cursor === "number" ? b.cursor : undefined,
      limit: typeof b.limit === "number" ? b.limit : undefined,
    });
  }
  if (action === "getIdeaDetail") {
    return getIdeaDetail(db, id, { ideaId: b.ideaId as number | string });
  }
  if (action === "listRecentMilestones") {
    const items = await listRecentMilestones(db, id, { limit: typeof b.limit === "number" ? b.limit : undefined });
    return { items };
  }
  if (action === "getKudosTodayCount") {
    return { kudosToday: await getKudosTodayCount(db, id) };
  }
  if (action === "kudosMilestone") {
    const result = await kudosMilestone(id, { milestoneId: b.milestoneId as number | string });
    return { ...result, state: await loadState(db, id) };
  }
  throw new Fail(400, "Unknown community query.");
});
