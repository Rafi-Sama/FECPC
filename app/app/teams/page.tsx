"use client";
import { useState } from "react";
import { Page } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";
import { Avatar } from "@/components/pixel/Sprites";
import { lookingForTeam, myTeam, templates } from "@/lib/appdata2";
import { byId } from "@/lib/data";

export default function Teams() {
  const { s, me, act, who } = useStore();
  const onTeam = myTeam.members.includes(me.id) || myTeam.coach === me.id;
  const [t, setT] = useState(0);
  return (
    <Page title={onTeam ? <>Team {myTeam.name}</> : <>You are not on a team <span className="acc">yet.</span></>} aside={<button className="btn sm line no-print" onClick={() => print()}>print notebook</button>}>
      <div className="bento">
        {onTeam && <><section className="panel c4"><p className="label">roster · coach {byId(myTeam.coach).name}</p>
          <div className="list">{myTeam.members.map((id) => <div key={id}><Avatar name={byId(id).name} size={36} /><span className="grow"><strong className="hi">{byId(id).name}</strong><br /><span className="label">{byId(id).rating} · {byId(id).skills.slice(1).join(", ")}</span></span></div>)}</div></section>
        <section className="panel c4"><p className="label">combined solve map</p>{myTeam.map.map(([k, v]) => <div key={k} className="sheet-row"><span>{k}</span><div className="meter" style={{ "--v": `${v}%` } as React.CSSProperties}><i /></div><span className={`num ${v < 35 ? "bad" : "acc"}`}>{v}%</span></div>)}</section>
        <section className="panel c4"><p className="label">mock history</p><div className="list">{myTeam.mocks.map(([n, sv, rk]) => <div key={n}><span className="grow hi">{n}</span><span className="acc" style={{ width: 80, textAlign: "right" }}>{sv} solved</span><span className="mut" style={{ width: 44, textAlign: "right" }}>#{rk}</span></div>)}</div><p className="label">next mock: 22 Nov, 10:00</p></section></>}
        <section className="panel c4 no-print"><p className="label">looking for a team</p>
          <div className="list">{lookingForTeam.map((m) => { const k = m.id + ":team:", mine = m.id === me.id; return <div key={m.id}><span className="grow"><strong className="hi">{byId(m.id).name}</strong><br /><span className="label one" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{byId(m.id).rating} · {m.wants}</span></span>{mine ? <span className="pill">you</span> : !("no" in who(m.id)) ? null : <button className="btn xs line" disabled={s.sent.includes(k)} onClick={() => act("ping", { kind: "team", to: m.id })}>{s.sent.includes(k) ? "asked" : "ask to team up"}</button>}</div>; })}</div></section>
        <section className="panel c8"><div className="row between"><p className="label">team notebook · shared templates</p><div className="row no-print" style={{ "--g": "6px" } as React.CSSProperties}>{templates.map((x, i) => <button key={x.name} className={`tag tab ${i === t ? "on" : ""}`} aria-pressed={i === t} onClick={() => setT(i)}>{x.name}</button>)}</div></div>
          <pre className="code">{templates[t].code}</pre></section>
      </div>
    </Page>
  );
}
