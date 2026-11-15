import { exportMembers } from "@/server/actions";
import { respond, signedIn } from "@/server/http";

export const GET = () => respond(async () => new Response(await exportMembers(await signedIn()), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="members.csv"', "cache-control": "no-store" } }));
