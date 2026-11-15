"use client";
import { useState } from "react";
import { Avatar } from "@/components/pixel/Sprites";
import { byId, projects } from "@/lib/data";

const groups = ["All", "Web", "CP", "AI/ML", "Game dev", "Security"];

export default function ProjectGrid() {
  const [g, setG] = useState("All");
  const list = projects.filter((p) => g === "All" || p.tags.includes(g));
  return (
    <>
      <div className="row" role="tablist" aria-label="Filter by track" style={{ "--g": "8px", marginBottom: 36 } as React.CSSProperties}>
        {groups.map((x) => <button key={x} role="tab" aria-selected={x === g} className={`tag tab ${x === g ? "on" : ""}`} onClick={() => setG(x)}>{x}</button>)}
        <span className="label" style={{ marginLeft: "auto" }}>{list.length} of {projects.length}</span>
      </div>
      <div className="grid" style={{ "--min": "320px", "--g": "0px" } as React.CSSProperties}>
        {list.map((p, i) => (
          <article key={p.name} className="panel proj">
            <div className="row between"><span className="mono dim">{String(i + 1).padStart(2, "0")}</span><span className="label acc2">{p.status}</span></div>
            <h3 className="h3">{p.name}</h3>
            <p className="body">{p.blurb}</p>
            <div className="row" style={{ "--g": "6px" } as React.CSSProperties}>{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
            <div className="row by" style={{ "--g": "8px" } as React.CSSProperties}>{p.by.map((id) => <Avatar key={id} name={byId(id).name} size={28} />)}<span className="label">{p.by.map((id) => byId(id).name.split(" ")[0]).join(", ")}</span></div>
          </article>
        ))}
      </div>
    </>
  );
}
