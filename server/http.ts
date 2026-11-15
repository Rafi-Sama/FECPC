// The thin Next.js edge of the backend: cookies, origin checks, JSON in and out. All rules live in actions.ts and auth.ts.
import { cookies } from "next/headers";
import { sessionUser } from "./auth.ts";
import { Fail, pool } from "./db.ts";

export const COOKIE = "fecpc_sid";
export const userId = async () => sessionUser(pool(), (await cookies()).get(COOKIE)?.value);
export async function setSession(s: { token: string; maxAge: number }) {
  (await cookies()).set(COOKIE, s.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: s.maxAge });
}
// X-Forwarded-For is whatever the caller sends unless a proxy we run sets it. Only believe it when told to, and then only the hop our proxy added (the last one).
export const ip = (req: Request) => (process.env.TRUST_PROXY === "1" ? req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "" : "");

/** A JSON body from our own pages only: same origin, JSON content type, at most 16 kB. */
export async function body(req: Request): Promise<Record<string, unknown>> {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) throw new Fail(403, "This request did not come from the site.");
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new Fail(415, "Send JSON.");
  const raw = await req.text();
  if (raw.length > 16_384) throw new Fail(413, "That request is too large.");
  try { const v = JSON.parse(raw); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch {}
  throw new Fail(400, "That request is not valid JSON.");
}
/** Runs a route body; turns a Fail into its message and anything else into a logged, generic 500. */
export async function respond(fn: () => Promise<Response | Record<string, unknown>>): Promise<Response> {
  try {
    const out = await fn();
    return out instanceof Response ? out : Response.json(out, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof Fail) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
  }
}
export async function signedIn() {
  const id = await userId();
  if (!id) throw new Fail(401, "Sign in again.");
  return id;
}
