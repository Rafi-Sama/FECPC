import { act } from "@/server/actions";
import { pool } from "@/server/db";
import { body, respond, signedIn } from "@/server/http";
import { loadState } from "@/server/state";

// Every change in the member area goes through here: one action in, the member's fresh state out.
export const POST = (req: Request) => respond(async () => {
  const b = await body(req), id = await signedIn();
  const info = await act(id, b);
  return { state: await loadState(pool(), id), info: info ?? null };
});
