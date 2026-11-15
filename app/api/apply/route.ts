import { apply } from "@/server/actions";
import { throttle } from "@/server/auth";
import { pool } from "@/server/db";
import { body, ip, respond } from "@/server/http";

export const POST = (req: Request) => respond(async () => {
  const b = await body(req);
  throttle(`apply:${ip(req)}`, 5, 60 * 60_000);
  await apply(pool(), b);
  return { ok: true };
});
