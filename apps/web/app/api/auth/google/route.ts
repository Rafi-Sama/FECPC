import { cookies } from 'next/headers';

export async function GET(req: Request) {
  if (!process.env.GOOGLE_CLIENT_ID)
    return new Response('Google sign-in is not configured.', { status: 404 });

  const state = crypto.randomUUID();
  (await cookies()).set('fecpc_oauth', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/google',
    maxAge: 600,
  });

  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    // Must equal the API's redirect URI exactly (GOOGLE_REDIRECT_URI, else APP_PUBLIC_URL + this path).
    redirect_uri:
      process.env.GOOGLE_REDIRECT_URI || `${new URL(req.url).origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email',
    state,
    prompt: 'select_account',
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}
