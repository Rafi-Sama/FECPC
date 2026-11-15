"use client";
import { useState } from "react";
import { Page } from "@/components/app/Shell";
import { toggle, useStore } from "@/components/app/Store";
import { HandleBox, useJudge } from "@/components/app/Judge";
import { cfUrl, sheet } from "@/lib/appdata";
import { can } from "@/lib/permissions";
import { SheetExtras } from "@/components/app/Extras";

const topics = [...new Set(sheet.map((p) => p.topic))];

export default function Sheets() {
  const { s, act, counts, members } = useStore();
  const rate = (id: string) => Math.round(((counts.solved[id] ?? 0) / Math.max(1, members.length)) * 100); // share of members who marked it solved
  const { data } = useJudge();
  const [link, setLink] = useState("");
  const auto = new Set(data?.solved ?? []);
  const isDone = (id: string) => auto.has(id) || s.solved.includes(id);
  const done = sheet.filter((p) => isDone(p.id)).length;
  const next = sheet.find((p) => !isDone(p.id));
  const parsed = link.match(/(?:problem|contest)\/(\d+)\/(?:problem\/)?(\w+)/);
  return (
    <Page title="Sheets">
      <div className="bento">
        <section className="panel" style={{ gridColumn: "1 / -1" }}><div className="row between" style={{ alignItems: "flex-end" }}><div><p className="label">overall</p><p className="big">{done} / {sheet.length}</p></div><HandleBox /></div><div className="meter" style={{ "--v": `${(done / sheet.length) * 100}%`, height: 20 } as React.CSSProperties}><i /></div>{next && <p className="body">next up: <a className="link acc" href={cfUrl(next.id)} target="_blank" rel="noreferrer">{next.id} {next.name}</a></p>}</section>
        {topics.map((t) => { const ps = sheet.filter((p) => p.topic === t), d = ps.filter((p) => isDone(p.id)).length; return (
          <section key={t} className="panel c6">
            <div className="row between"><h2 className="h3">{t.toLowerCase()}/</h2><span className="acc num">{d}/{ps.length}</span></div>
            <div className="meter" style={{ "--v": `${(d / ps.length) * 100}%` } as React.CSSProperties}><i /></div>
            <div>
              {ps.map((p) => (
                <div key={p.id} className={`prob ${isDone(p.id) ? "done" : ""}`}>
                  <input type="checkbox" className="check" aria-label={`${p.name} solved`} checked={isDone(p.id)} disabled={auto.has(p.id)} onChange={() => act("toggle", { list: "solved", id: p.id })} />
                  <a href={cfUrl(p.id)} target="_blank" rel="noreferrer"><span className="dim">{p.id}</span> {p.name}</a>
                  <span className={`label ${p.must ? "" : "dim"}`}>{auto.has(p.id) ? "synced" : p.must ? "must" : "optional"}</span>
                  <span className="num acc2">{p.rating}</span>
                </div>
              ))}
            </div>
          </section>
        ); })}
        <SheetExtras isDone={isDone} />
        {can(s.role, "sheet.edit") ? (
          <section className="panel c8" style={{ gridColumn: "1 / -1" }}>
            <p className="label">where members get stuck · least-solved problems on the sheet</p>
            <div className="scroll-x"><table className="tbl"><thead><tr><th>problem</th><th>topic</th><th className="r">rating</th><th className="r">club completion</th></tr></thead>
              <tbody>{[...sheet].sort((a, b) => rate(a.id) - rate(b.id)).slice(0, 6).map((p) => <tr key={p.id}><td className="hi">{p.id} {p.name}</td><td>{p.topic}</td><td className="r">{p.rating}</td><td className="r"><span className={rate(p.id) < 40 ? "bad" : "acc"}>{rate(p.id)}%</span></td></tr>)}</tbody></table></div>
          </section>
        ) : null}
      </div>
    </Page>
  );
}
