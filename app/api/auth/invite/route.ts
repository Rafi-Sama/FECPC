import { acceptInvite, throttle } from "@/server/auth";
import { pool } from "@/server/db";
import { body, ip, respond, setSession } from "@/server/http";

export const POST = (req: Request) => respond(async () => {
  const b = await body(req);
  throttle(`invite:${ip(req)}`);
  await setSession(await acceptInvite(pool(), b.token, b.password));
  return { ok: true };
});
