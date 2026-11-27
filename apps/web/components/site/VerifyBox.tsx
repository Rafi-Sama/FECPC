'use client';
import { useEffect, useState } from 'react';
import { certificates, fmtDate } from '@fecpc/content/site';
import type { VerifiedCertificate } from '@fecpc/contracts';
import { site } from '@/lib/site';

type Hit = { code: string; name: string; what: string; date: string; signedBy?: string };
const what = (c: VerifiedCertificate) =>
  `${c.kind.startsWith('winner') ? `${c.place} place` : c.kind.startsWith('role:') ? c.role : 'Participant'}, ${c.event}`;

// The sample codes are static; every other code is looked up among issued event certificates.
export default function VerifyBox() {
  const [q, setQ] = useState(certificates[0].code);
  const [asked, setAsked] = useState<string | null>(certificates[0].code); // open on a sample so the result state is visible
  // A printed certificate's QR links here with ?code=…; open on that code.
  useEffect(() => {
    const c = new URLSearchParams(location.search).get('code')?.trim().toUpperCase();
    if (c) {
      setQ(c);
      setAsked(c);
    }
  }, []);
  const sample = asked ? certificates.find((c) => c.code === asked) : undefined;
  const [found, setFound] = useState<{ code: string; hit: Hit | null }>();
  useEffect(() => {
    if (!asked || sample) return;
    let live = true;
    fetch(`/api/certificates/${encodeURIComponent(asked)}`)
      .then((r) => (r.ok ? (r.json() as Promise<VerifiedCertificate>) : null))
      .catch(() => null)
      .then((c) => {
        if (live)
          setFound({
            code: asked,
            hit: c && { code: c.code, name: c.name, what: what(c), date: c.date.slice(0, 10) },
          });
      });
    return () => {
      live = false;
    };
  }, [asked, sample]);
  const hit: Hit | undefined =
    sample ?? (found?.code === asked ? (found.hit ?? undefined) : undefined);
  const pending = !!asked && !sample && found?.code !== asked;
  return (
    <div className="stack [--g:32px]">
      <form
        className="row [--g:12px] items-end"

        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim().toUpperCase());
        }}
      >
        <label className="field flex-[1_1_280px]">
          <span className="label">Certificate code</span>
          <input
            className="input mono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="FECPC-2026-0412"
            required
          />
        </label>
        <button className="btn">Verify</button>
      </form>
      <p className="label">
        Try a sample:{' '}
        {certificates.map((c) => (
          <button
            key={c.code}
            type="button"
            className="link mono [background:none] [border:0] cursor-pointer ml-3 p-[8px_0] [text-decoration:underline]"
            onClick={() => {
              setQ(c.code);
              setAsked(c.code);
            }}
          >
            {c.code}
          </button>
        ))}
      </p>
      <div aria-live="polite">
        {asked && !hit && !pending && (
          <div className="panel box">
            <p className="label bad">No match</p>
            <h3 className="h3 mt-2">No certificate has the code {asked}.</h3>
            <p className="body mt-2">
              Check for typos. If it still fails, the certificate was not issued by {site.short}.
            </p>
          </div>
        )}
        {hit && (
          <div className="panel box p-[clamp(24px,4vw,56px)] overflow-hidden">
            <div className="row between">
              <span className="label acc">Verified · issued by {site.short}</span>
              <span className="mono label">{hit.code}</span>
            </div>
            <p className="label mt-9">This certifies that</p>
            <p className="text-[clamp(36px,5vw,64px)] font-medium tracking-[-0.04em] leading-[1] [margin-block:8px_16px]">
              {hit.name}
            </p>
            <p className="lede">{hit.what}</p>
            <div className="row [--g:40px] mt-9 items-start">
              <div className="kv">
                <span className="label">Date</span>
                <span>{fmtDate(hit.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
              {hit.signedBy && (
                <div className="kv">
                  <span className="label">Signed by</span>
                  <span>{hit.signedBy}</span>
                </div>
              )}
            </div>
            <i
              aria-hidden
              className="absolute -right-10 -bottom-10 w-45 h-45 rounded-[50%] text-acc opacity-90 dither"
            />
          </div>
        )}
      </div>
    </div>
  );
}
