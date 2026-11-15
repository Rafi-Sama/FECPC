"use client";
import { useState } from "react";
import { Page, Tabs } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";
import { can, isCommittee } from "@/lib/permissions";
import { balloonColor, balloons, prints, probs, scoreboard } from "@/lib/appdata2";

const all = ["SCOREBOARD", "BALLOONS", "PRINTS"] as const;

export default function ContestDay() {
  const { s, act } = useStore();
  const [tab, setTab] = useState<(typeof all)[number]>("SCOREBOARD");
  const open = s.flags.unfrozen;
  // Balloon and print runs are logistics: for the committee and for members who signed up as runners.
  const runner = isCommittee(s.role) || s.present.some((k) => /^vol:(Balloon|Print) runner$/.test(k)), tabs = runner ? all : all.slice(0, 1);
  const rows = scoreboard.map((r) => ({ ...r, all: open ? [...r.solved, ...r.frozen] : r.solved, p: r.pen + (open ? r.frozen.length * 250 : 0) })).sort((a, b) => b.all.length - a.all.length || a.p - b.p);
  const done = (id: string) => s.flags["cd:" + id];
  return (
    <Page title="CONTEST DAY" aside={tab === "SCOREBOARD" && can(s.role, "event.publish") && <button className="btn sm" onClick={() => confirm(open ? "Freeze the scoreboard again?" : "Reveal the final standings to everyone?") && act("flag", { key: "unfrozen", on: !open })}>{open ? "REFREEZE" : "UNFREEZE"}</button>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "SCOREBOARD" && <><p className="label" style={{ marginBottom: 14 }}>{open ? "Final standings" : "Frozen for the last hour · ? = pending"}</p>
        <div className="scroll-x"><table className="tbl board"><thead><tr><th>#</th><th>Team</th><th className="r">Solved</th><th className="r">Pen</th>{probs.map((p) => <th key={p} style={{ textAlign: "center" }}>{p}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r.team}><td className={`mono ${i < 3 ? "acc" : ""}`} style={{ fontWeight: 700 }}>{i + 1}</td><td><strong>{r.team}</strong></td><td className="r arcade acc">{r.all.length}</td><td className="r mono">{r.p}</td>
            {probs.map((p) => <td key={p} style={{ textAlign: "center" }}>{r.solved.includes(p) ? <i className="cell ok" /> : r.frozen.includes(p) ? <i className={`cell ${open ? "ok new" : "q"}`}>{open ? "" : "?"}</i> : <i className="cell" />}</td>)}</tr>)}</tbody></table></div></>}
      {tab === "BALLOONS" && <div className="list">{balloons.map((b) => <div key={b.id} style={{ opacity: done(b.id) ? 0.45 : 1 }}><i aria-hidden className="balloon" style={{ background: balloonColor[b.p] }} /><span className="grow"><strong>{b.team}</strong><br /><span className="label">Problem {b.p} · desk {b.desk}</span></span>
        {isCommittee(s.role) && <button className={`btn xs ${done(b.id) ? "line" : ""}`} aria-pressed={!!done(b.id)} onClick={() => act("flag", { key: "cd:" + b.id, on: !done(b.id) })}>{done(b.id) ? "DELIVERED · UNDO" : "DELIVER"}</button>}</div>)}</div>}
      {tab === "PRINTS" && <div className="list">{prints.map((p) => <div key={p.id} style={{ opacity: done(p.id) ? 0.45 : 1 }}><span className="grow"><strong>{p.team}</strong><br /><span className="label">{p.pages} pages · desk {p.desk}</span></span>
        {isCommittee(s.role) && <button className={`btn xs ${done(p.id) ? "line" : ""}`} aria-pressed={!!done(p.id)} onClick={() => act("flag", { key: "cd:" + p.id, on: !done(p.id) })}>{done(p.id) ? "DELIVERED · UNDO" : "DELIVER"}</button>}</div>)}</div>}
    </Page>
  );
}
