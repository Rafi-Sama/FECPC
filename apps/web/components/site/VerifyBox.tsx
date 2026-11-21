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
    <div className="stack" style={{ '--g': '32px' } as React.CSSProperties}>
      <form
        className="row"
        style={{ '--g': '12px', alignItems: 'flex-end' } as React.CSSProperties}
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim().toUpperCase());
        }}
      >
        <label className="field" style={{ flex: '1 1 280px' }}>
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
            className="link mono sample"
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
            <h3 className="h3" style={{ marginTop: 8 }}>
              No certificate has the code {asked}.
            </h3>
            <p className="body" style={{ marginTop: 8 }}>
              Check for typos. If it still fails, the certificate was not issued by {site.short}.
            </p>
          </div>
        )}
        {hit && (
          <div className="panel box cert">
            <div className="row between">
              <span className="label acc">Verified · issued by {site.short}</span>
              <span className="mono label">{hit.code}</span>
            </div>
            <p className="label" style={{ marginTop: 36 }}>
              This certifies that
            </p>
            <p className="cert-name">{hit.name}</p>
            <p className="lede">{hit.what}</p>
            <div
              className="row"
              style={
                { '--g': '40px', marginTop: 36, alignItems: 'flex-start' } as React.CSSProperties
              }
            >
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
            <i aria-hidden className="seal dither" />
          </div>
        )}
      </div>
    </div>
  );
}
