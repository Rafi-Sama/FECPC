"use client";
import { useState } from "react";
import { Page, Tabs } from "@/components/app/Shell";
import { EventsExtra } from "@/components/app/Extras";
import QR from "@/components/app/QR";
import { useStore } from "@/components/app/Store";
import { events, fmtDate } from "@/lib/data";

export default function Events() {
  const { s, act, counts, office } = useStore();
  const [code, setCode] = useState("");
  const tabs = ["Upcoming", "Calendar", "Volunteer", "Feedback", "Certificates"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Upcoming");
  const checkIn = (e: React.FormEvent) => { e.preventDefault(); act("attend", { code }); };
  return (
    <Page title={<>{s.reg.length} ticket{s.reg.length === 1 ? "" : "s"}<span className="acc">.</span></>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <EventsExtra tab={tab} />
      {tab === "Upcoming" && <div className="bento">
        <form className="panel" style={{ gridColumn: "1 / -1" }} onSubmit={checkIn}>
          <p className="label">Attendance · DP Bootcamp, Day 1</p>
          {s.present.includes("dp-bootcamp") ? <p className="h3 ok">You are marked present.</p> : <>
            <label className="field"><span className="label">Code on the projector</span><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 characters" required maxLength={12} autoComplete="off" /></label>
            <button className="btn sm" style={{ alignSelf: "flex-start" }}>Check in</button>
</>}
        </form>
        {events.map((e) => { const on = s.reg.includes(e.id), full = e.taken + (counts.reg[e.id] ?? 0) >= e.seats; return (
          <section key={e.id} className="panel c6">
            <div className="row between"><span className="row" style={{ "--g": "8px" } as React.CSSProperties}><span className="tag on">{e.type}</span><span className="tag">{fmtDate(e.date, { weekday: "short", day: "numeric", month: "short" })} · {e.time}</span></span>{e.fee > 0 && <span className="label">৳{e.fee}</span>}</div>
            <h2 className="h3">{e.title}</h2>
            <p className="body">{e.blurb}</p>
            <p className="label">{e.place} · {Math.max(0, e.seats - e.taken - (counts.reg[e.id] ?? 0))} of {e.seats} seats left</p>
            {on ? <div className="ticket"><QR text={`FECPC ticket ${e.id}`} size={72} /><div className="grow"><p className="label">Your ticket</p><p className="mono">{e.id.replace(/-/g, "").slice(0, 3).toUpperCase()}-{(e.title.length * 7919) % 9000 + 1000}</p></div>
              <button className="btn xs line" onClick={() => act("toggle", { list: "reg", id: e.id, on: false })}>Cancel</button></div>
              : <button className={`btn sm ${e.id === events.find((x) => !s.reg.includes(x.id))?.id ? "" : "line"}`} style={{ alignSelf: "flex-start" }} onClick={() => act("toggle", { list: "reg", id: e.id, on: true })}>{full ? "Join waitlist" : e.fee ? `Register · ৳${e.fee} invoice` : "Register"}</button>}
          </section>
        ); })}
        {office.events && <section className="panel" style={{ gridColumn: "1 / -1" }}><p className="label">Organiser view</p>
          <div className="row" style={{ "--g": "32px", alignItems: "flex-start" } as React.CSSProperties}><div><p className="label">Room code · read it out or project it</p><p className="big mono">{office.events.code}</p></div><div><p className="label">Checked in with the code</p><p className="big">{office.events.arrived[office.events.event] ?? 0}</p></div></div>
          <p className="label" style={{ marginTop: 12 }}>Registered through the platform</p>
          <ul className="list">{events.map((e) => { const names = office.events!.registrants[e.id] ?? []; return <li key={e.id}><details className="grow"><summary>{e.title} · <span className="mono">{names.length}</span></summary><p className="body" style={{ marginTop: 6 }}>{names.length ? names.join(", ") : "Nobody yet."}</p></details></li>; })}</ul>
          <p className="label" style={{ marginTop: 12 }}>Written feedback · Freshers' Cup · {(office.feedback ?? []).length}</p>
          {(office.feedback ?? []).length === 0 ? <p className="body">None yet.</p> : <ul className="list">{office.feedback!.slice(0, 20).map((m, i) => <li key={i}><span className="grow">{m.body}</span></li>)}</ul>}
        </section>}
      </div>}
    </Page>
  );
}
