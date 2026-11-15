"use client";
import { useState } from "react";
import { certificates, fmtDate } from "@/lib/data";
import { site } from "@/lib/site";

// shortcut: looks up seed certificates in the bundle; move to a server lookup with the database.
export default function VerifyBox() {
  const [q, setQ] = useState(certificates[0].code);
  const [asked, setAsked] = useState<string | null>(certificates[0].code); // open on a sample so the result state is visible
  const hit = asked ? certificates.find((c) => c.code === asked) : undefined;
  return (
    <div className="stack" style={{ "--g": "32px" } as React.CSSProperties}>
      <form className="row" style={{ "--g": "12px", alignItems: "flex-end" } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); setAsked(q.trim().toUpperCase()); }}>
        <label className="field" style={{ flex: "1 1 280px" }}><span className="label">Certificate code</span>
          <input className="input mono" value={q} onChange={(e) => setQ(e.target.value)} placeholder="FECPC-2026-0412" required /></label>
        <button className="btn">Verify</button>
      </form>
      <p className="label">Try a sample: {certificates.map((c) => <button key={c.code} type="button" className="link mono sample" onClick={() => { setQ(c.code); setAsked(c.code); }}>{c.code}</button>)}</p>
      <div aria-live="polite">
        {asked && !hit && <div className="panel box"><p className="label bad">No match</p><h3 className="h3" style={{ marginTop: 8 }}>No certificate has the code {asked}.</h3><p className="body" style={{ marginTop: 8 }}>Check for typos. If it still fails, the certificate was not issued by {site.short}.</p></div>}
        {hit && (
          <div className="panel box cert">
            <div className="row between"><span className="label acc">Verified · issued by {site.short}</span><span className="mono label">{hit.code}</span></div>
            <p className="label" style={{ marginTop: 36 }}>This certifies that</p>
            <p className="cert-name">{hit.name}</p>
            <p className="lede">{hit.what}</p>
            <div className="row" style={{ "--g": "40px", marginTop: 36, alignItems: "flex-start" } as React.CSSProperties}>
              <div className="kv"><span className="label">Date</span><span>{fmtDate(hit.date, { day: "numeric", month: "long", year: "numeric" })}</span></div>
              <div className="kv"><span className="label">Signed by</span><span>{hit.signedBy}</span></div>
            </div>
            <i aria-hidden className="seal dither" />
          </div>
        )}
      </div>
    </div>
  );
}
