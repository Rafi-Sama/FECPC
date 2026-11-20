import { cookies } from 'next/headers';
import { API } from '@/lib/api.ts';

// Google sends the browser back here with a one-time code. The API redeems the code itself, so the
// identity comes from Google, never from this request.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = (await cookies()).get('fecpc_oauth')?.value;
  const headers = new Headers({
    'set-cookie': 'fecpc_oauth=; Path=/api/auth/google; Max-Age=0; HttpOnly; SameSite=Lax',
  });
  const back = (error?: string) => {
    headers.set('location', error ? `/login?error=${encodeURIComponent(error)}` : '/app');
    return new Response(null, { status: 303, headers });
  };

  const code = url.searchParams.get('code');
  if (!state || state !== url.searchParams.get('state') || !code)
    return back('That sign-in attempt expired. Try again.');

  try {
    const res = await fetch(`${API()}/v1/auth/google`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      return back(err.detail ?? 'Google sign-in failed. Try again.');
    }
    for (const c of res.headers.getSetCookie()) headers.append('set-cookie', c);
    return back();
  } catch {
    return back('Google sign-in failed. Try again.');
  }
}
