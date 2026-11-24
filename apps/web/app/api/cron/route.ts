import { apiFetch, toApi } from '@/lib/api.ts';

// Vercel Cron (daily) and a mail run that leaves due mail call this with `Authorization: Bearer CRON_SECRET`.
// It answers at once; the mail run goes on after the response, up to 4 minutes.
export const maxDuration = 300;
export const GET = (req: Request) =>
  apiFetch('/v1/cron', {
    headers: toApi('', { authorization: req.headers.get('authorization') ?? '' }),
  });
