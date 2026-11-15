import { cookies } from "next/headers";
import { newToken } from "@/server/auth";

// Starts Google sign-in. Disabled (404) until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
export async function GET(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return new Response("Google sign-in is not configured.", { status: 404 });
  const state = newToken(), origin = new URL(req.url).origin;
  (await cookies()).set("fecpc_oauth", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/google", maxAge: 600 });
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: `${origin}/api/auth/google/callback`, response_type: "code", scope: "openid email", state, prompt: "select_account" });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
