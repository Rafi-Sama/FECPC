import { cookies } from 'next/headers';

// Where each provider asks the user to sign in. GitHub uses the callback URL registered on its OAuth app.
const start = (provider: string, origin: string): string | null => {
  if (provider === 'google' && process.env.GOOGLE_CLIENT_ID)
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      // Must equal the API's redirect URI exactly (GOOGLE_REDIRECT_URI, else APP_PUBLIC_URL + this path).
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email',
      prompt: 'select_account',
    })}`;
  if (provider === 'github' && process.env.GITHUB_CLIENT_ID)
    return `https://github.com/login/oauth/authorize?${new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      scope: 'user:email',
      allow_signup: 'false',
    })}`;
  return null;
};

export async function GET(req: Request, ctx: RouteContext<'/api/auth/[provider]'>) {
  const { provider } = await ctx.params;
  const url = start(provider, new URL(req.url).origin);
  if (!url)
    return Response.redirect(
      new URL(
        `/login?error=${encodeURIComponent('That sign-in method is not set up yet.')}`,
        req.url,
      ),
    );

  const state = crypto.randomUUID();
  (await cookies()).set('fecpc_oauth', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: `/api/auth/${provider}`,
    maxAge: 600,
  });
  return Response.redirect(`${url}&state=${state}`);
}
