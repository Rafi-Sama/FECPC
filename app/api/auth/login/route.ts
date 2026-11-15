import { login } from "@/server/auth";
import { pool } from "@/server/db";
import { body, ip, respond, setSession } from "@/server/http";

export const POST = (req: Request) => respond(async () => {
  const b = await body(req);
  await setSession(await login(pool(), b.email, b.password, ip(req)));
  return { ok: true };
});
