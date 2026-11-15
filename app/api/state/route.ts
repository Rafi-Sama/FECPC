import { pool } from "@/server/db";
import { respond, signedIn } from "@/server/http";
import { loadState } from "@/server/state";

export const GET = () => respond(async () => ({ state: await loadState(pool(), await signedIn()) }));
