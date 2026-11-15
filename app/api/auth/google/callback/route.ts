import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginWithGoogle } from "@/server/auth";
import { Fail, pool } from "@/server/db";
import { setSession } from "@/server/http";

export async function GET(req: Request) {
  const url = new URL(req.url), jar = await cookies(), state = jar.get("fecpc_oauth")?.value;
  let error = "";
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new Fail(404, "Google sign-in is not configured.");
    if (!state || state !== url.searchParams.get("state")) throw new Fail(400, "That sign-in attempt expired. Try again.");
    const tok = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({ code: url.searchParams.get("code") ?? "", client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" }) })).json();
    if (!tok.access_token) throw new Fail(401, "Google did not complete the sign-in.");
    const profile = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tok.access_token}` }, signal: AbortSignal.timeout(10_000) })).json();
    await setSession(await loginWithGoogle(pool(), profile));
  } catch (e) {
    if (!(e instanceof Fail)) console.error(e);
    error = e instanceof Fail ? e.message : "Google sign-in failed. Try again, or use your password.";
  }
  jar.delete({ name: "fecpc_oauth", path: "/api/auth/google" });
  redirect(error ? `/login?error=${encodeURIComponent(error)}` : "/app");
}
