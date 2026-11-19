import { fetchAlumniJobs, getMemberProfile, listMembers } from "@/server/actions";
import { Fail, pool } from "@/server/db";
import { body, respond, signedIn } from "@/server/http";

export const POST = (req: Request) =>
  respond(async () => {
    const b = await body(req);
    const id = await signedIn();
    const db = pool();
    const action = String(b.action ?? "");

    if (action === "listMembers") {
      return listMembers(db, id, {
        q: typeof b.q === "string" ? b.q : undefined,
        rating: typeof b.rating === "string" ? b.rating : undefined,
        skill: typeof b.skill === "string" ? b.skill : undefined,
        batch: typeof b.batch === "number" || typeof b.batch === "string" ? b.batch : undefined,
        type: typeof b.type === "string" ? b.type : undefined,
        page: typeof b.page === "number" ? b.page : undefined,
        pageSize: typeof b.pageSize === "number" ? b.pageSize : undefined,
      });
    }

    if (action === "getMemberProfile") {
      return getMemberProfile(db, id, { userId: String(b.userId ?? "") });
    }

    if (action === "fetchAlumniJobs") {
      return fetchAlumniJobs(db, id, {
        userId: String(b.userId ?? ""),
        boards: Array.isArray(b.boards) ? (b.boards as { provider: "greenhouse" | "lever"; slug: string; company: string }[]) : undefined,
      });
    }

    throw new Fail(400, "Unknown members query.");
  });
