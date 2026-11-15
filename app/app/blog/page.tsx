"use client";
import { useState } from "react";
import { Page } from "@/components/app/Shell";
import { toggle, useStore } from "@/components/app/Store";
import { cfUrl } from "@/lib/appdata";
import { posts } from "@/lib/appdata2";
import { byId } from "@/lib/data";

export default function Blog() {
  const { s, act } = useStore();
  const [open, setOpen] = useState(posts[0].id);
  const [step, setStep] = useState<Record<string, number>>({});
  const p = posts.find((x) => x.id === open)!, n = step[p.id] ?? 0, solved = s.solved.includes(p.id);
  return (
    <Page title="Editorials">
      <div className="bento">
        <nav className="c4" aria-label="Editorials" style={{ gap: 12 }}>
          {posts.map((x) => <button key={x.id} className={`panel pick ${x.id === open ? "sel" : ""}`} aria-pressed={x.id === open} onClick={() => setOpen(x.id)}><span className="label">{x.tags.join(" · ")}</span><span className="h3">{x.id} {x.title}</span><span className="label">{byId(x.by).name} · ▲ {x.up + (s.kudos.includes("post:" + x.id) ? 1 : 0)}</span></button>)}
        </nav>
        <article className="panel c8" style={{ maxWidth: 760 }}>
          <div className="row between"><h2 className="h3"><a className="link" href={cfUrl(p.id)} target="_blank" rel="noreferrer">{p.id} · {p.title} ↗</a></h2>
            <button className={`btn xs ${s.kudos.includes("post:" + p.id) ? "" : "line"}`} aria-pressed={s.kudos.includes("post:" + p.id)} onClick={() => act("toggle", { list: "kudos", id: "post:" + p.id })}>▲ {p.up + (s.kudos.includes("post:" + p.id) ? 1 : 0)}</button></div>
          <p className="label">{byId(p.by).name} · {p.tags.join(" · ")}</p>
          {p.hints.map((h, i) => n > i ? <p key={h} className="body"><span className="acc">hint {i + 1}:</span> {h}</p> : null)}
          {n >= p.hints.length || solved ? <><p className="body hi">{p.body}</p><pre className="code">{p.code}</pre></> : null}
          {n < p.hints.length && !solved && <div className="row"><button className="btn sm" onClick={() => setStep({ ...step, [p.id]: n + 1 })}>show hint {n + 1}</button><span className="label">solution unlocks after hint {p.hints.length}, or when you solve it</span></div>}
          {n === p.hints.length && !solved && <p className="label">stuck after both hints? the solution is above. try it yourself first.</p>}
        </article>
      </div>
    </Page>
  );
}
