"use client";
import { useEffect, useState } from "react";
import { useStore } from "./Store";

export type Judge = { handle: string; rating: number; maxRating: number; rank: string; history: number[]; solved: string[]; tags: Record<string, number>; days: Record<string, number> };
const cache = new Map<string, Judge>();

/** Live Codeforces data for the linked handle, or null while unlinked/loading. */
export function useJudge() {
  const { s } = useStore();
  const [data, setData] = useState<Judge | null>(cache.get(s.handle) ?? null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!s.handle) { setData(null); return; }
    if (cache.has(s.handle)) { setData(cache.get(s.handle)!); return; }
    let live = true;
    setBusy(true); setErr("");
    fetch(`/api/cf/${encodeURIComponent(s.handle)}`).then(async (r) => {
      const j = await r.json();
      if (!live) return;
      if (!r.ok) { setErr(j.error); setData(null); } else { cache.set(s.handle, j); setData(j); }
    }).catch(() => live && setErr("Could not reach the server.")).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [s.handle]);
  return { data, err, busy };
}

export function HandleBox() {
  const { s, act } = useStore();
  const { data, err, busy } = useJudge();
  const [v, setV] = useState("");
  if (s.handle && !err) return (
    <p className="body" aria-live="polite">{busy ? `syncing ${s.handle} from Codeforces…` : data ? <>linked: <strong className="acc">{data.handle}</strong> · {data.rank} {data.rating} · {data.solved.length} solved · synced from Codeforces</> : null} <button className="link sample" onClick={() => act("handle", { value: "" })}>unlink</button></p>
  );
  return (
    <form className="row" style={{ "--g": "10px", alignItems: "flex-end" } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); act("handle", { value: v.trim() }); }}>
      <label className="field" style={{ flex: "0 1 260px" }}><span className="label">Codeforces handle</span><input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder="your_handle" pattern="[\w.\-]{3,24}" required /></label>
      <button className="btn sm">Sync</button>
      {err && <p className="body bad" role="alert" style={{ flexBasis: "100%" }}>{err} <button type="button" className="link sample" onClick={() => act("handle", { value: "" })}>clear</button></p>}
    </form>
  );
}
