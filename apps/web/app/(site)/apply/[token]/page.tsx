import { notFound } from 'next/navigation';
import type { RecruitPublic } from '@fecpc/contracts';
import ApplyForm from '@/components/site/ApplyForm';
import { apiFetch, toApi } from '@/lib/api';
import { site } from '@/lib/site';

export const metadata = { title: 'Apply', robots: { index: false } };
export const dynamic = 'force-dynamic'; // the link can close at any moment; TURNSTILE_SITE_KEY is read per request

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: site.tz,
  });

export default async function Apply({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await apiFetch(`/v1/recruit/${encodeURIComponent(token)}`, {
    headers: toApi(),
  }).catch(() => null);
  if (res?.status === 404) notFound();
  const link = res?.ok ? ((await res.json()) as RecruitPublic) : null;
  return (
    <section className="page-head t-b paper" data-t="b">
      <div className="wrap [display:grid] gap-8 max-w-[880px]">
        <div className="head">
          <p className="label acc2">
            {site.short} · Batch {link?.batch ?? '–'}
          </p>
          <h1 className="disp text-[clamp(40px,5.6vw,80px)]">{link?.title ?? 'Recruitment'}</h1>
          {link?.open && <p className="lede">Open until {when(link.closes)}.</p>}
        </div>
        {!link ? (
          <div className="panel" role="alert">
            <h2 className="h3">The server is not answering.</h2>
            <p className="body mt-2">Reload the page in a minute.</p>
          </div>
        ) : link.open ? (
          <ApplyForm token={token} link={link} turnstile={process.env.TURNSTILE_SITE_KEY} />
        ) : (
          <div className="panel">
            <h2 className="h3">This form closed on {when(link.closes)}.</h2>
            <p className="body mt-2">Ask the club for the link to the next intake.</p>
          </div>
        )}
      </div>
    </section>
  );
}
