import { cookies } from "next/headers";
import { endSession } from "@/server/auth";
import { pool } from "@/server/db";
import { body, COOKIE, respond } from "@/server/http";

export const POST = (req: Request) => respond(async () => {
  await body(req);
  const jar = await cookies();
  await endSession(pool(), jar.get(COOKIE)?.value);
  jar.delete(COOKIE);
  return { ok: true };
});
