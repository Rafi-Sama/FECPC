"use client";
// Extra tabs and panels that plug into the main module screens.
import Link from "next/link";
import { useState } from "react";
import { toggle, useStore } from "./Store";
import QR from "./QR";
import { Avatar, Trophy } from "@/components/pixel/Sprites";
import { cfUrl, myInvoices, owes, sheet } from "@/lib/appdata";
import { volunteerShifts } from "@/lib/appdata2";
import { byId, certificates, events, fmtDate, hallOfFame } from "@/lib/data";
import { can, canFully, roleName, roles, type Role } from "@/lib/permissions";
import { quests, XP } from "@/lib/xp";

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

/* ── Today ── */
export function Quests() {
  const { s } = useStore();
  const q = quests(s), n = q.filter((x) => x.done).length;
  return (
    <section className="panel c8" style={{ gridColumn: "1 / -1" }}>
      <div className="row between"><p className="label">Daily quests · all three for +{XP.quest} XP</p><span className="mono acc">{n}/3</span></div>
      <div className="tier3">{q.map((x) => <div key={x.id} style={{ borderColor: x.done ? "var(--acc)" : undefined }}><span className={`label ${x.done ? "acc" : ""}`}>{x.done ? "Done ✓" : "Open"}</span><strong>{x.text}</strong></div>)}</div>
    </section>
  );
}

/* ── Sheets ── */
export function SheetExtras({ isDone }: { isDone: (id: string) => boolean }) {
  const { s, act } = useStore();
  const topics = [...new Set(sheet.map((p) => p.topic))].map((t) => { const ps = sheet.filter((p) => p.topic === t); return { t, pct: ps.filter((p) => isDone(p.id)).length / ps.length }; }).sort((a, b) => a.pct - b.pct);
  const rec = sheet.filter((p) => !isDone(p.id) && topics.slice(0, 2).some((x) => x.t === p.topic)).sort((a, b) => a.rating - b.rating).slice(0, 3);
  const revisit = s.solved.slice(0, 3).filter(isDone);
  return (
    <>
      <section className="panel c6"><p className="label">recommended · weakest tags: {topics.slice(0, 2).map((x) => x.t.toLowerCase()).join(", ")}</p>
        <div>{rec.map((p) => <div key={p.id} className="prob"><span className="acc">→</span><a href={cfUrl(p.id)} target="_blank" rel="noreferrer"><span className="dim">{p.id}</span> {p.name}</a><span className="label">{p.topic}</span><span className="num acc2">{p.rating}</span></div>)}{rec.length === 0 && <p className="body">nothing left to recommend. the sheet is done.</p>}</div></section>
      <section className="panel c6"><p className="label">revisit queue · solved 7 days ago · how sure are you?</p>
        <div>{revisit.map((id) => { const p = sheet.find((x) => x.id === id)!, c = s.kv["conf:" + id]; return <div key={id} className="prob" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><a href={cfUrl(id)} target="_blank" rel="noreferrer"><span className="dim">{id}</span> {p.name}</a>
          <span className="row" style={css({ "--g": "4px" })}>{["shaky", "ok", "solid"].map((v) => <button key={v} className={`tag tab ${c === v ? "on" : ""}`} aria-pressed={c === v} onClick={() => act("kv", { key: "conf:" + id, value: v })}>{v}</button>)}</span></div>; })}</div></section>
    </>
  );
}

/* ── Arena ── */
export function ArenaExtra({ tab }: { tab: string }) {
  const { s, me, xp, act, members, who } = useStore();
  const picks = (s.kv.fantasy ?? "").split(",").filter(Boolean);
  if (tab === "SEASON") return (
    <div className="stack">
      <div className="panel" style={{ borderColor: "#FFD23F" }}><div className="row"><Trophy size={54} /><div><p className="label">Season 05 leader · 38 days left</p><p className="big">NADIA RAHMAN</p></div></div></div>
      <h2 className="h3 acc">HALL OF FAME</h2>
      <ol className="hof">{hallOfFame.map((h) => <li key={h.title + h.year}><span className="arcade acc">{h.year}</span><div><p className="arcade t">{h.title}</p><p className="body">{h.who} · {h.detail}</p></div><Trophy size={27} /></li>)}</ol>
    </div>
  );
  if (tab === "FANTASY") return (
    <div className="stack">
      <div className="panel"><div className="row between"><p className="label">Your three for Weekly #42</p><span className="arcade acc">{picks.length}/3</span></div>
        <div className="row" style={css({ "--g": "12px", marginTop: 12 })}>{[0, 1, 2].map((i) => picks[i] ? <span key={i} className="tag on" style={{ fontSize: 14, padding: "10px 12px" }}>{who(picks[i]).name}</span> : <span key={i} className="tag" style={{ fontSize: 14, padding: "10px 12px", borderStyle: "dashed" }}>empty slot</span>)}</div></div>
      <div className="scroll-x"><table className="tbl"><thead><tr><th>Member</th><th className="r">Rating</th><th className="r">Last round</th><th className="r">Pick</th></tr></thead>
        <tbody>{members.slice(0, 10).map((m, i) => { const on = picks.includes(m.id), d = [38, 21, 12, -6, 17, 9, -14, 25, 4, 31][i]; return (
          <tr key={m.id} className={on ? "you" : ""}><td><span className="row" style={css({ "--g": "10px", flexWrap: "nowrap" })}><Avatar name={m.name} size={30} fg="#FFD23F" bg="#3A1D6E" /><strong>{m.name}</strong></span></td><td className="r mono">{m.rating}</td><td className={`r mono ${d < 0 ? "bad" : "acc3"}`}>{d > 0 ? "+" : ""}{d}</td>
            <td className="r"><button className={`btn xs ${on ? "" : "line"}`} aria-pressed={on} disabled={!on && picks.length >= 3} onClick={() => act("kv", { key: "fantasy", value: toggle(picks, m.id).join(",") })}>{on ? "PICKED ✓" : "PICK"}</button></td></tr>
        ); })}</tbody></table></div>
    </div>
  );
  if (tab === "RECAP") return (
    <div className="stack"><p className="label">Your year in code · 2026</p>
      <div className="bento">{[["PROBLEMS SOLVED", me.solved + s.solved.length - s.base.solved], ["LONGEST STREAK", `${me.streak + (s.checkin ? 1 : 0)}D`], ["TOTAL XP", xp.toLocaleString("en")], ["CONTESTS", 23], ["KUDOS EARNED", me.helper], ["RATING GAINED", `+${me.rating - 800}`]].map(([k, v]) => <section key={k} className="panel c4"><p className="label">{k}</p><p className="big">{v}</p></section>)}</div>
      <p className="body">Top tag: implementation. Busiest month: October. You out-solved {Math.round((1 - members.filter((m) => m.solved > me.solved).length / members.length) * 100)}% of the club.</p>
    </div>
  );
  return null;
}

/* ── Community ── */
export function Suggest() {
  const { act } = useStore();
  const [sent, setSent] = useState(false);
  return (
    <form className="panel stack" style={css({ maxWidth: 560, "--g": "14px" })} onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; act("send", { kind: "suggest", body: new FormData(f).get("body") }).then((ok) => { if (ok) { f.reset(); setSent(true); } }); }}>
      {sent && <p className="body ok" role="status">Sent. Your name was not stored with it.</p>}
      <label className="field"><span className="label">Anonymous suggestion or complaint</span><textarea name="body" className="input" required minLength={10} maxLength={1000} style={{ minHeight: 110 }} /></label>
      <p className="label">Read by the committee officers. It is saved without your name.</p>
      <button className="btn sm" style={{ alignSelf: "flex-start" }}>Send anonymously</button>
    </form>
  );
}

/* ── Events ── */
export function EventsExtra({ tab }: { tab: string }) {
  const { s, me, act, counts } = useStore();
  if (tab === "Calendar") { const marks = new Map(events.filter((e) => e.date.startsWith("2026-11")).map((e) => [+e.date.slice(8), e])); return (
    <div className="bento"><section className="panel c6"><div className="row between"><h2 className="h3">November 2026</h2><span className="label">Sun → Sat</span></div>
      <ol className="cal" aria-label="November 2026">{Array.from({ length: 30 }, (_, i) => { const d = i + 1, e = marks.get(d); return <li key={d} className={`${e ? "has" : ""} ${d === 12 ? "today" : ""}`} title={e?.title}>{d}</li>; })}</ol>
      <button className="btn sm line" onClick={() => { const ics = "BEGIN:VCALENDAR\nVERSION:2.0\n" + events.map((e) => `BEGIN:VEVENT\nUID:${e.id}@fecpc\nDTSTART:${e.date.replace(/-/g, "")}T${e.time.replace(":", "")}00\nSUMMARY:${e.title}\nLOCATION:${e.place}\nEND:VEVENT`).join("\n") + "\nEND:VCALENDAR"; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "fecpc.ics"; a.click(); }}>Download .ics for your calendar</button></section>
      <section className="panel c6"><p className="label">This month</p><div className="list">{[...marks.values()].map((e) => <div key={e.id}><span className="mono acc" style={{ width: 28 }}>{e.date.slice(8)}</span><span className="grow"><strong>{e.title}</strong><br /><span className="label">{e.time} · {e.place}</span></span>{s.reg.includes(e.id) && <span className="pill ok">going</span>}</div>)}</div></section></div>
  ); }
  if (tab === "Volunteer") return <div className="stack"><p className="label">Contest day · 18 December · volunteers earn the Perfect Attendance track</p><div className="list">{volunteerShifts.map(([n, t, need, have]) => { const k = "vol:" + n, on = s.present.includes(k), filled = have + (counts.vol[k] ?? 0); return (
    <div key={n}><span className="grow"><strong>{n}</strong><br /><span className="label">{t} · {filled}/{need} filled</span></span><div className="meter" style={css({ "--v": `${(filled / need) * 100}%`, width: "120px" })}><i /></div>
      <button className={`btn xs ${on ? "line" : ""}`} disabled={!on && filled >= need} onClick={() => act("toggle", { list: "present", id: k })}>{on ? "Signed up ✓" : filled >= need ? "Full" : "Sign up"}</button></div>
  ); })}</div></div>;
  if (tab === "Feedback") return (
    <form className="panel" style={{ maxWidth: 560 }} onSubmit={(e) => { e.preventDefault(); const body = String(new FormData(e.currentTarget).get("body") ?? "").trim(); act("vote", { poll: "fb:freshers", option: s.kv.rate ?? "5" }).then((ok) => { if (ok && body) act("send", { kind: "feedback", body }); }); }}>
      <p className="label">Freshers&apos; Cup 2026</p>
      {s.votes["fb:freshers"] ? <p className="h3 ok">Thanks. You rated it {s.votes["fb:freshers"]}/5.</p> : <div className="stack" style={css({ "--g": "14px" })}>
        <div className="row" role="radiogroup" aria-label="Rating" style={css({ "--g": "6px" })}>{["1", "2", "3", "4", "5"].map((v) => <button type="button" key={v} role="radio" aria-checked={(s.kv.rate ?? "5") === v} className={`tag tab ${(s.kv.rate ?? "5") === v ? "on" : ""}`} onClick={() => act("kv", { key: "rate", value: v })}>{v}</button>)}</div>
        <label className="field"><span className="label">What should change next time?</span><textarea name="body" className="input" maxLength={1000} style={{ minHeight: 88 }} /></label>
        <button className="btn sm" style={{ alignSelf: "flex-start" }}>Send feedback</button></div>}
    </form>
  );
  if (tab === "Certificates") { const mine = certificates.filter((c) => c.name === me.name); return (
    <div className="bento">{mine.length === 0 && <div className="panel c8"><p className="h3">No certificates yet.</p><p className="body">Win, volunteer or finish a course and one appears here.</p></div>}
      {mine.map((c) => <section key={c.code} className="panel c8"><div className="row between"><div><p className="label">{fmtDate(c.date, { day: "numeric", month: "long", year: "numeric" })}</p><h2 className="h3">{c.what}</h2><p className="mono">{c.code}</p></div><QR text={`https://fecpc.example/verify?code=${c.code}`} size={110} /></div>
        <div className="row no-print"><button className="btn sm" onClick={() => print()}>Print</button><Link className="btn sm line" href="/verify">Public verification page</Link></div></section>)}</div>
  ); }
  return null;
}

/* ── Finance ── */
export function Waivers() {
  const { s, act, office, who } = useStore();
  const waivers = office.waivers ?? [];
  const lvl = can(s.role, "dues.waive");
  return (
    <div className="stack"><p className="label">Two officers: one proposes, a second with full authority decides. Each step is logged.</p>
      <div className="list">{waivers.map((w) => { const st = s.exp[w.id]; return (
        <div key={w.id} style={{ flexWrap: "wrap" }}><span className="grow"><strong>{who(w.who).name} · {w.what}</strong><br /><span className="label">{w.reason}</span></span><span className="mono" style={{ fontSize: 20 }}>৳{w.amount}</span>
          {!st ? <button className="btn xs line" onClick={() => act("decide", { kind: "waiver", id: w.id, to: "proposed" })}>Propose</button>
            : st === "proposed" && lvl === true ? <><span className="pill warn">proposed</span><button className="btn xs" onClick={() => confirm(`Waive ৳${w.amount} for ${who(w.who).name}?`) && act("decide", { kind: "waiver", id: w.id, to: "waived" })}>Waive</button><button className="btn xs line" onClick={() => confirm("Reject this waiver? This cannot be undone.") && act("decide", { kind: "waiver", id: w.id, to: "rejected" })}>Reject</button></>
            : <span className={`pill ${st === "rejected" ? "bad" : st === "waived" ? "ok" : "warn"}`}>{st === "proposed" ? "proposed · awaiting a second officer" : st}</span>}</div>
      ); })}</div></div>
  );
}
export function Receipt({ id, label, amount, date, via }: { id: string; label: string; amount: number; date: string; via: string }) {
  const { me } = useStore();
  return (
    <div className="panel receipt"><div className="row between"><div><p className="label">Receipt</p><p className="mono" style={{ fontSize: 22 }}>{id}</p></div><QR text={`FECPC receipt ${id} ৳${amount}`} size={84} /></div>
      <dl>{[["Received from", me.name], ["For", label], ["Amount", `৳${amount}`], ["Paid via", via], ["Date", fmtDate(date, { day: "numeric", month: "long", year: "numeric" })]].map(([k, v]) => <div key={k}><dt className="label">{k}</dt><dd>{v}</dd></div>)}</dl>
      <button className="btn sm no-print" onClick={() => print()}>Print or save as PDF</button></div>
  );
}

/* ── Profile ── */
export function Onboarding() {
  const { s } = useStore();
  const starter = s.solved.filter((id) => sheet.some((p) => p.id === id)).length;
  const steps: [string, boolean, string][] = [["Link your Codeforces handle", !!s.handle, "/app/profile"], ["Send your mentor a check-in", s.sent.includes("checkin"), "/app/learn"], ["Solve three starter problems", starter >= 3, "/app/sheets"], ["Clear your dues", myInvoices(s.reg).every((i) => !owes(s.pay, i.id)), "/app/finance"], ["Register for an event", s.reg.length > 0, "/app/events"]];
  const n = steps.filter((x) => x[1]).length;
  if (n === steps.length || s.role !== "member") return null; // done, or not a newcomer
  return (
    <section className="panel c6"><div className="row between"><p className="label">Onboarding</p><span className="mono acc">{n}/{steps.length}</span></div><div className="meter" style={css({ "--v": `${(n / steps.length) * 100}%` })}><i /></div>
      <ul className="list">{steps.map(([t, d, href]) => <li key={t}><span className={d ? "ok" : "dim"}>{d ? "✓" : "○"}</span><span className="grow" style={{ textDecoration: d ? "line-through" : "none", opacity: d ? 0.6 : 1 }}>{t}</span>{!d && <Link className="btn xs line" href={href}>Go</Link>}</li>)}</ul></section>
  );
}

/* ── Admin ── */
export function AdminExtra({ tab }: { tab: string }) {
  const { s, me, act, members } = useStore();
  const assign = canFully(s.role, "roles.assign");
  if (tab === "Members") return (
    <div className="scroll-x"><table className="tbl"><thead><tr><th>Member</th><th>Batch</th><th>Role</th><th>Status</th><th className="r">Account</th></tr></thead>
      <tbody>{members.map((m) => { const off = !!m.suspended, r = m.roleKey ?? "member"; return (
        <tr key={m.id} style={{ opacity: off ? 0.5 : 1 }}><td><strong>{m.name}</strong>{m.handle && <><br /><span className="label">@{m.handle}</span></>}</td><td>{m.batch}</td>
          <td>{assign ? <select className="input" style={{ minHeight: 36, width: "auto" }} aria-label={`Role for ${m.name}`} value={r} disabled={m.id === me.id || (m.roleKey === "super_admin" && s.role !== "super_admin")} onChange={(e) => { const role = e.target.value, why = prompt(`Reason for making ${m.name} ${roleName[role as Role]}? (logged)`); if (why) act("role", { user: m.id, role, reason: why }); }}>{roles.filter((x) => x !== "super_admin" || s.role === "super_admin" || x === r).map((x) => <option key={x} value={x}>{roleName[x]}</option>)}</select> : roleName[r]}</td>
          <td><span className={`pill ${off ? "bad" : m.pending ? "warn" : "ok"}`}>{off ? "suspended" : m.pending ? "invited, not joined" : "active"}</span></td>
          <td className="r"><span className="row" style={css({ "--g": "6px", justifyContent: "flex-end", flexWrap: "nowrap" })}>{m.id !== me.id && !off && (r === "member" ? can(s.role, "application.approve") || assign : r === "super_admin" ? s.role === "super_admin" : assign) && <button className="btn xs line" onClick={() => confirm(`Create a one-time ${m.pending ? "invite" : "password reset"} link for ${m.name}?`) && act("invite", { user: m.id })}>{m.pending ? "New invite link" : "Reset link"}</button>}{assign && m.id !== me.id && (r !== "super_admin" || s.role === "super_admin") && <button className="btn xs line" onClick={() => confirm(off ? `Reinstate ${m.name}?` : `Suspend ${m.name}? They are signed out everywhere immediately.`) && act("suspend", { user: m.id, on: !off })}>{off ? "Reinstate" : "Suspend"}</button>}</span></td></tr>
      ); })}</tbody></table></div>
  );
  return null;
}
