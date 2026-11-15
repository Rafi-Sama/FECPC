"use client";
import Link from "next/link";
import { Page } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";

// Everything here is worked out on the server from real records (dues, decisions, announcements, requests from people).
export default function Inbox() {
  const { s, inbox, act } = useStore();
  const unread = inbox.filter((n) => !s.read.includes(n.id));
  return (
    <Page title={unread.length ? <>{unread.length} thing{unread.length > 1 ? "s" : ""} <span className="acc">need{unread.length > 1 ? "" : "s"} you.</span></> : <>Inbox <span className="acc">zero.</span></>}
      aside={unread.length > 0 && <button className="btn sm line" onClick={() => act("readAll")}>Mark all read</button>}>
      <section className="panel" style={{ maxWidth: 820 }}>
        {inbox.length === 0 ? <p className="body">Nothing yet. Dues, decisions, announcements and requests from other members show up here.</p> : <div className="list">
          {inbox.map((n) => { const r = s.read.includes(n.id); return (
            <div key={n.id} style={{ opacity: r ? 0.5 : 1 }}><span className="pill" style={{ minWidth: 118, justifyContent: "center" }}>{n.cat}</span><Link className="grow link" href={n.href}><strong>{n.text}</strong></Link>
              {!r && <button className="btn xs line" aria-label={`Mark read: ${n.text}`} onClick={() => act("toggle", { list: "read", id: n.id, on: true })}>Mark read</button>}</div>
          ); })}
        </div>}
      </section>
    </Page>
  );
}
