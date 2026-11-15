"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Page } from "@/components/app/Shell";
import { toggle, useStore } from "@/components/app/Store";
import PersonCard from "@/components/app/PersonCard";
import { cfTitle, members } from "@/lib/data";

const bands = [["All ratings", 0, 9999], ["Newbie–Pupil", 0, 1399], ["Specialist", 1400, 1599], ["Expert+", 1600, 9999]] as const;
const skills = ["Any skill", "CP", "Web", "AI/ML", "Game dev", "Security"];

function Inner() {
  const { s, me, act } = useStore();
  const [q, setQ] = useState(useSearchParams().get("q") ?? "");
  const [band, setBand] = useState(0);
  const [skill, setSkill] = useState("Any skill");
  const [batch, setBatch] = useState(0);
  const filtered = !!q || band > 0 || skill !== "Any skill" || batch > 0;
  const list = members.filter((m) => (m.name + m.handle).toLowerCase().includes(q.toLowerCase()) && m.rating >= bands[band][1] && m.rating <= bands[band][2] && (skill === "Any skill" || m.skills.includes(skill)) && (!batch || m.batch === batch));
  return (
    <Page title={filtered ? <>{list.length} of {members.length} <span className="acc">match.</span></> : <>{members.length} <span className="acc">members.</span></>}>
      <div className="row" style={{ marginBottom: 24, "--g": "10px" } as React.CSSProperties}>
        <input className="input" style={{ width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or handle" aria-label="Search members" />
        <select className="input" style={{ width: 180 }} aria-label="Rating band" value={band} onChange={(e) => setBand(+e.target.value)}>{bands.map((b, i) => <option key={b[0]} value={i}>{b[0]}</option>)}</select>
        <select className="input" style={{ width: 180 }} aria-label="Skill" value={skill} onChange={(e) => setSkill(e.target.value)}>{skills.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="input" style={{ width: 180 }} aria-label="Batch" value={batch} onChange={(e) => setBatch(+e.target.value)}><option value={0}>All batches</option>{[20, 21, 22, 23, 24, 25].map((b) => <option key={b} value={b}>Batch {b}</option>)}</select>
        {filtered && <button className="btn xs line" onClick={() => { setQ(""); setBand(0); setSkill("Any skill"); setBatch(0); }}>Clear</button>}
      </div>
      {list.length === 0 ? <div className="panel box"><p className="h3">Nobody matches those filters.</p></div> : (
        <ul className="grid" style={{ "--min": "330px", "--g": "12px" } as React.CSSProperties}>
          {list.map((m) => { const k = "kudos:" + m.id, on = s.kudos.includes(k); return (
            <PersonCard key={m.id} className="box" name={m.name} role={`${m.role ?? "Member"} · ${m.dept} · Batch ${m.batch}`} stat={`${m.rating} ${cfTitle(m.rating)} · ${m.solved} solved · ${m.streak}d streak`} tags={m.skills} fg="#0D0D0B" bg="#DAD6CB"
              action={m.id === me.id ? <span className="pill">you</span> : <button className={`btn xs ${on ? "" : "line"}`} aria-pressed={on} onClick={() => act("toggle", { list: "kudos", id: k })}>{on ? "Kudos ✓" : "Kudos"}</button>} />
          ); })}
        </ul>)}
    </Page>
  );
}
export default function Directory() { return <Suspense><Inner /></Suspense>; }
