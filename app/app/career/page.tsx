"use client";
import { useState } from "react";
import { Page, Tabs } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";
import PersonCard from "@/components/app/PersonCard";
import { alumni, interview, jobs } from "@/lib/appdata2";

const tabs = ["Alumni", "Jobs", "Interview prep"] as const;

export default function Career() {
  const { s, act } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Alumni");
  const flag = (k: string) => s.flags[k], on = (k: string) => act("flag", { key: k, on: true });
  return (
    <Page title={<>{alumni.filter((a) => a.mentor).length} alumni <span className="acc">open to questions.</span></>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "Alumni" && <ul className="grid" style={{ "--min": "330px", "--g": "12px" } as React.CSSProperties}>{alumni.map((a) => { const k = "ask:" + a.name; return (
        <PersonCard key={a.name} name={a.name} role={`Batch ${a.batch} · ${a.city}`} stat={a.at}
          action={a.mentor ? <button className="btn xs line" disabled={flag(k)} onClick={() => on(k)}>{flag(k) ? "Saved ✓" : "Save"}</button> : <span className="label dim">not mentoring</span>} />
      ); })}</ul>}
      {tab === "Jobs" && <div className="list">{jobs.map((j) => { const k = "apply:" + j.id; return (
        <div key={j.id}><span className="grow"><strong>{j.role}</strong><br /><span className="label">{j.org} · referred by {j.by} · closes {j.closes}</span></span><button className={`btn xs ${flag(k) ? "line" : ""}`} disabled={flag(k)} onClick={() => on(k)}>{flag(k) ? "Saved ✓" : "Save"}</button></div>
      ); })}</div>}
      {tab === "Interview prep" && <div className="bento">{interview.map(([n, total, done]) => (
        <section key={n} className="panel c4"><p className="label">{done}/{total} solved</p><h2 className="h3">{n}</h2><div className="meter" style={{ "--v": `${(done / total) * 100}%` } as React.CSSProperties}><i /></div></section>
      ))}</div>}
    </Page>
  );
}
