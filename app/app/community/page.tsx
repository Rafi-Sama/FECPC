"use client";
import { useState } from "react";
import { Page, Tabs } from "@/components/app/Shell";
import { toggle, useStore } from "@/components/app/Store";
import { Avatar } from "@/components/pixel/Sprites";
import { announcements, candidates, feed, ideas, polls } from "@/lib/appdata";
import { byId, members } from "@/lib/data";
import { can } from "@/lib/permissions";
import { CommunityExtra } from "@/components/app/Extras";

const tabs = ["Feed", "Announcements", "Polls", "Election", "Ideas", "Groups", "Teammates", "Suggest"] as const;

export default function Community() {
  const { s, me, act, counts, news } = useStore();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Feed");
  const [draft, setDraft] = useState("");
  return (
    <Page title={<>{tab}<span className="acc">.</span></>}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "Feed" && <div className="bento"><section className="panel c8"><div className="list">{feed.map((f, i) => { const on = s.kudos.includes(f.id), mine = f.who === me.id; return (
        <div key={f.id}><Avatar name={byId(f.who).name} size={40} /><span className="grow"><strong>{byId(f.who).name}</strong> {f.text}<br /><span className="label">{f.ago} ago · {12 - i * 2 + (counts.kudos[f.id] ?? 0)} kudos</span></span>
          {mine ? <span className="pill">you</span> : <button className={`btn xs ${on ? "" : "line"}`} aria-pressed={on} onClick={() => act("toggle", { list: "kudos", id: f.id })}>{on ? "Kudos ✓" : "Kudos"}</button>}</div>
      ); })}</div></section>
        <section className="panel c4"><p className="label">Top helpers this week</p><ol className="list">{[...members].sort((a, b) => b.helper - a.helper).slice(0, 5).map((m, i) => <li key={m.id}><span className="mono acc" style={{ width: 22 }}>{i + 1}</span><span className="grow">{m.name}</span><span className="mono">{m.helper}</span></li>)}</ol></section></div>}
      {tab === "Announcements" && (
        <div className="stack">
          {can(s.role, "announce.post") ? (
            <form className="panel" onSubmit={(e) => { e.preventDefault(); act("announce", { title: draft }).then((ok) => ok && setDraft("")); }}>
              <label className="field"><span className="label">New announcement · scope: {can(s.role, "announce.post") === "scope" ? "only your mentees see this" : "everyone"}</span><input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} required minLength={3} maxLength={140} placeholder="Title" /></label>
              <button className="btn sm" style={{ marginTop: 12 }}>Publish</button>
            </form>
          ) : null}
          <div className="list">
            {news.map((t) => { const read = s.read.includes(t.id); return <div key={t.id}><span className="grow"><strong>{t.title}</strong><br /><span className="label">{t.by}{t.mentees ? " · to mentees" : ""} · {new Date(t.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></span><button className="btn xs line" disabled={read} onClick={() => act("toggle", { list: "read", id: t.id, on: true })}>{read ? "Read ✓" : "Mark read"}</button></div>; })}
            {announcements.map((a) => { const read = s.read.includes(a.id); return (
              <div key={a.id}><span className="grow"><strong>{a.title}</strong><br /><span className="body">{a.body}</span><br /><span className="label">{byId(a.from).name} · {a.scope}{a.must ? " · read receipt required" : ""}</span></span>
                <button className="btn xs line" disabled={read} onClick={() => act("toggle", { list: "read", id: a.id, on: true })}>{read ? "Read ✓" : "Mark read"}</button></div>
            ); })}
          </div>
        </div>
      )}
      {tab === "Polls" && <div className="bento">{polls.map((p) => { const mine = s.votes[p.id], live = counts.votes[p.id] ?? {}, total = p.opts.reduce((a, o) => a + o[1] + (live[o[0]] ?? 0), 0); return (
        <section key={p.id} className="panel c6"><h2 className="h3">{p.q}</h2>
          {p.opts.map(([o, n]) => { const v = n + (live[o] ?? 0); return (
            <button key={o} className="opt" aria-pressed={mine === o} onClick={() => act("vote", { poll: p.id, option: o })}>{mine && <i style={{ width: `${(v / total) * 100}%` }} />}<span><b className="mono acc" style={{ marginRight: 10 }}>{mine === o ? "●" : "○"}</b>{o}</span><span className="mono">{mine ? `${Math.round((v / total) * 100)}%` : ""}</span></button>
          ); })}
          <p className="label">{total} votes · closes Friday{mine ? "" : " · vote to see results"}</p></section>
      ); })}</div>}
      {tab === "Election" && (
        <div className="stack">
          <p className="body" style={{ maxWidth: "60ch" }}>One member, one vote, and it cannot be changed. Nobody, officers included, is shown how you voted. Results on 30 November, 18:00.</p>
          <div className="bento">{candidates.map((c) => (
            <section key={c.id} className="panel c4"><Avatar name={byId(c.id).name} size={56} /><p className="label">{c.post}</p><h2 className="h3">{byId(c.id).name}</h2><p className="body">“{c.line}”</p>
              <button className="btn sm" disabled={!!s.votes.election} onClick={() => act("vote", { poll: "election", option: c.id })}>{s.votes.election === c.id ? "Your vote ✓" : s.votes.election ? "Ballot cast" : "Vote"}</button></section>
          ))}</div>
        </div>
      )}
      {tab === "Ideas" && <div className="list">{ideas.map(([t, n]) => { const k = "idea:" + t, on = s.kudos.includes(k); return (
        <div key={t}><span className="mono acc" style={{ width: 40 }}>{n + (counts.kudos[k] ?? 0)}</span><span className="grow"><strong>{t}</strong></span><button className={`btn xs ${on ? "" : "line"}`} aria-pressed={on} onClick={() => act("toggle", { list: "kudos", id: k })}>{on ? "Upvoted" : "▲ Upvote"}</button></div>
      ); })}<div><span className="grow body">Anonymous suggestions and complaints go to the right admin role, without your name.</span></div></div>}
      <CommunityExtra tab={tab} />
    </Page>
  );
}
