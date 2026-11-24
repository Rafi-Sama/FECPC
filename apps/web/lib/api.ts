// Next.js API routes are a thin proxy to the NestJS API, which owns sessions, permissions and validation.
import { headers } from 'next/headers';
import type { AppState, PublicEvent } from '@fecpc/contracts';

export const API = () => process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/** The API's session cookie: `__Host-` prefixed over HTTPS, plain in local development. */
export const SESSION_COOKIES = ['__Host-fecpc_session', 'fecpc_session'];

// The API checks these to tell a same-site request from a cross-site one (CSRF), so they must reach it unchanged.
const FORWARD = [
  'cookie',
  'content-type',
  'origin',
  'referer',
  'sec-fetch-site',
  'user-agent',
  'if-none-match',
];

/** The browser's address, when a trusted reverse proxy in front of this app reports it. */
function clientIp(req: Request): string {
  return process.env.TRUST_PROXY === '1'
    ? (req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? '')
    : '';
}

/**
 * Forwards the request to the API as-is (method, raw body, the headers above) and returns its answer.
 * API errors arrive as problem+json; they are reshaped to `{ error }`, which is what the pages read.
 */
export async function proxy(req: Request, path: string): Promise<Response> {
  const headers = new Headers();
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const ip = clientIp(req);
  if (ip) headers.set('x-forwarded-for', ip);

  let res: Response;
  try {
    res = await fetch(API() + path, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json({ error: 'The server is not answering. Try again.' }, { status: 502 });
  }

  const out = new Headers();
  for (const h of ['content-type', 'content-disposition', 'cache-control', 'etag', 'retry-after']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  for (const c of res.headers.getSetCookie()) out.append('set-cookie', c);

  if (!res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    out.set('content-type', 'application/json');
    return Response.json(
      { ...body, error: body.error ?? body.detail ?? body.message ?? 'That did not work.' },
      { status: res.status, headers: out },
    );
  }
  return new Response(res.status === 304 ? null : res.body, { status: res.status, headers: out });
}

/** The signed-in member's state for a server component, or null when there is no valid session. */
export async function serverState(): Promise<AppState | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  const res = await fetch(`${API()}/v1/me/state`, { headers: { cookie }, cache: 'no-store' }).catch(
    () => null,
  );
  if (!res?.ok) return null;
  return ((await res.json()) as { state: AppState | null }).state;
}

/**
 * A read from `POST /v1/queries/{area}` for a server component, as the signed-in member; null when it failed.
 * Pages use it to render their first screen of data with the HTML instead of fetching it after hydration.
 */
export async function serverQuery<T>(
  area: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  const res = await fetch(`${API()}/v1/queries/${area}`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  }).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

/**
 * Upcoming events for the public site; empty when the API is down. Kept for a minute, so the home and events pages
 * are served from cache instead of rendering per visitor (seat counts may lag by up to a minute there).
 */
export async function publicEvents(): Promise<PublicEvent[]> {
  const res = await fetch(`${API()}/v1/events`, { next: { revalidate: 60 } }).catch(() => null);
  return res?.ok ? ((await res.json()) as PublicEvent[]) : [];
}
