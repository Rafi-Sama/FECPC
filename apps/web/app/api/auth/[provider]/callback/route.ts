import { cookies } from 'next/headers';
import { apiFetch, toApi } from '@/lib/api.ts';

const NAMES: Record<string, string> = { google: 'Google', github: 'GitHub' };

// The provider sends the browser back here with a one-time code. The API redeems the code itself, so the
// identity comes from the provider, never from this request.
export async function GET(req: Request, ctx: RouteContext<'/api/auth/[provider]/callback'>) {
  const { provider } = await ctx.params;
  if (!Object.hasOwn(NAMES, provider)) return new Response('Not found.', { status: 404 });
  const name = NAMES[provider];
  const url = new URL(req.url);
  const state = (await cookies()).get('fecpc_oauth')?.value;
  const headers = new Headers({
    'set-cookie': `fecpc_oauth=; Path=/api/auth/${provider}; Max-Age=0; HttpOnly; SameSite=Lax`,
  });
  const back = (error?: string) => {
    headers.set('location', error ? `/login?error=${encodeURIComponent(error)}` : '/app');
    return new Response(null, { status: 303, headers });
  };

  const code = url.searchParams.get('code');
  if (!state || state !== url.searchParams.get('state') || !code)
    return back('That sign-in attempt expired. Try again.');

  try {
    const res = await apiFetch(`/v1/auth/${provider}`, {
      method: 'POST',
      headers: toApi('', { 'content-type': 'application/json' }),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      return back(err.detail ?? `${name} sign-in failed. Try again.`);
    }
    for (const c of res.headers.getSetCookie()) headers.append('set-cookie', c);
    return back();
  } catch {
    return back(`${name} sign-in failed. Try again.`);
  }
}
