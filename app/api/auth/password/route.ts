import { changePassword, throttle } from "@/server/auth";
import { pool } from "@/server/db";
import { body, respond, setSession, signedIn } from "@/server/http";

export const POST = (req: Request) => respond(async () => {
  const b = await body(req), id = await signedIn();
  throttle(`password:${id}`);
  await setSession(await changePassword(pool(), id, b.current, b.next));
  return { ok: true };
});
