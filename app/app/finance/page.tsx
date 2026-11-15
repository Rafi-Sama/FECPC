"use client";
import { useState } from "react";
import { Page, Tabs } from "@/components/app/Shell";
import { useStore } from "@/components/app/Store";
import { Bars } from "@/components/app/Charts";
import { APPROVAL_THRESHOLD, myInvoices, owes } from "@/lib/appdata";
import { fmtDate } from "@/lib/data";
import { can, canFully } from "@/lib/permissions";
import { Receipt, Waivers } from "@/components/app/Extras";

const tk = (n: number) => "৳" + Math.abs(n).toLocaleString("en");

export default function Finance() {
  const { s, me, act, office, fundTotal, myExpenses } = useStore();
  const invoices = me.system ? [] : myInvoices(s.reg), committee = s.role !== "member" && s.role !== "mentor";
  const { accounts = [], budgets = [], cashflow = [], ledger = [] } = office.fund ?? {}, queue = office.queue ?? [], expenses = office.expenses ?? [];
  const verify = can(s.role, "payments.verify"), approve = can(s.role, "expense.approve"), payTab = verify === true ? "Verify payments" : "Payments";
  const tabs = ["My dues", ...(committee ? ["My requests"] : []), ...(verify ? [payTab] : []), ...(approve ? ["Expenses"] : []), ...(can(s.role, "dues.waive") ? ["Waivers"] : []), ...(verify || approve ? ["Club fund"] : []), "Transparency"];
  const [tab, setTab] = useState("My dues");
  const reject = (id: string) => { const reason = prompt("Why is this payment rejected? The member is shown this."); if (reason) act("decide", { kind: "payment", id, to: "rejected", reason }); };
  const [open, setOpen] = useState("");
  const owed = invoices.filter((i) => owes(s.pay, i.id)), waiting = invoices.filter((i) => s.pay[i.id]?.status === "pending"), paid = Object.values(s.pay).filter((p) => p.status === "verified");
  const sum = (list: { amount: number }[]) => tk(list.reduce((a, i) => a + i.amount, 0));
  const pay = (e: React.FormEvent<HTMLFormElement>, invoice: string) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    act("pay", { invoice, via: d.get("via"), trx: d.get("trx"), sender: d.get("sender") }).then((ok) => ok && setOpen(""));
  };
  return (
    <Page title={tab === "Club fund" || tab === "Transparency" ? <>{tab === "Transparency" ? "Where the money goes" : "Club fund"}<span className="acc">.</span></> : tab !== "My dues" && tabs.includes(tab) ? <>{tab}<span className="acc">.</span></> : owed.length ? <>You owe <span className="acc">{sum(owed)}.</span></> : waiting.length ? <>{sum(waiting)} <span className="acc">awaiting verification.</span></> : <>You are <span className="acc">all paid up.</span></>}>
      <Tabs tabs={tabs} value={tabs.includes(tab) ? tab : "My dues"} onChange={setTab} />
      {(tab === "My dues" || !tabs.includes(tab)) && (
        <div className="bento">
          <section className="panel" style={{ gridColumn: "1 / -1" }}><p className="label">Invoices</p>
            <div className="list">{invoices.map((i) => { const p = s.pay[i.id]; return (
              <div key={i.id} style={{ flexWrap: "wrap" }}>
                <span className="grow"><strong>{i.label}</strong><br /><span className="label">{i.id} · due {fmtDate(i.due, { day: "numeric", month: "short" })}</span></span>
                <span className="mono" style={{ fontSize: 20 }}>{tk(i.amount)}</span>
                {p && <span className={`pill ${p.status === "verified" ? "ok" : p.status === "rejected" ? "bad" : "warn"}`}>{p.status === "verified" ? "paid" : p.status === "rejected" ? "rejected" : "awaiting verification"} · {p.via} {p.trx}</span>}
                {!owes(s.pay, i.id) ? null : <button className="btn sm" onClick={() => setOpen(open === i.id ? "" : i.id)}>{open === i.id ? "Close" : p ? "Submit again" : `Pay ${tk(i.amount)}`}</button>}
                {open === i.id && owes(s.pay, i.id) && (
                  <form className="grid" style={{ "--min": "160px", "--g": "12px", flexBasis: "100%", alignItems: "end" } as React.CSSProperties} onSubmit={(e) => pay(e, i.id)}>
                    <label className="field"><span className="label">Wallet</span><select name="via" className="input"><option>bKash</option><option>Nagad</option><option>Rocket</option></select></label>
                    <label className="field"><span className="label">Transaction ID</span><input name="trx" className="input mono" required minLength={8} maxLength={12} pattern="[A-Za-z0-9]+" placeholder="BK9X2M4Q7A" /></label>
                    <label className="field"><span className="label">Sender number</span><input name="sender" className="input mono" required inputMode="numeric" pattern="01[0-9]{9}" placeholder="01XXXXXXXXX" /></label>
                    <button className="btn sm">Submit for verification</button>
                  </form>
                )}
              </div>
            ); })}</div>
            {invoices.some((i) => s.pay[i.id]?.status === "rejected") && <p className="body bad" role="status">A rejected payment usually means the transaction ID did not match the wallet statement. Check the SMS and submit again.</p>}
            <p className="body">Send the amount to the club wallet, then enter the transaction ID from the SMS. The Treasurer verifies it against the wallet statement.</p>
          </section>
                    <section className="panel" style={{ gridColumn: "1 / -1" }}><p className="label">Payment history</p>
            <div className="scroll-x"><table className="tbl"><thead><tr><th>No.</th><th>For</th><th>Date</th><th>Via</th><th className="r">Amount</th><th className="r no-print">Receipt</th></tr></thead>
              <tbody>{paid.map((h) => <tr key={h.id}><td className="mono">RCP-{h.id}</td><td>{h.label}</td><td>{new Date(h.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td><td>{h.via}</td><td className="r mono">{tk(h.amount)}</td><td className="r no-print"><button className="btn xs line" onClick={() => setOpen(open === "r" + h.id ? "" : "r" + h.id)}>{open === "r" + h.id ? "Hide" : "View"}</button></td></tr>)}</tbody></table></div>
            {paid.length === 0 && <p className="body">No verified payments yet. A receipt appears here as soon as the Treasurer verifies one.</p>}
            {paid.filter((h) => "r" + h.id === open).map((h) => <Receipt key={h.id} id={"RCP-" + h.id} label={h.label} amount={h.amount} date={h.at.slice(0, 10)} via={h.via} />)}
          </section>
        </div>
      )}
      {tab === payTab && verify && (
        <div className="stack">
          {queue.length === 0 && <p className="body">No payments have been submitted yet.</p>}
          <div className="scroll-x"><table className="tbl cards"><thead><tr><th>Payment</th><th>Member</th><th>Submitted</th><th>Via · Trx ID · Sender</th><th className="r">Amount</th><th className="r">Decision</th></tr></thead>
            <tbody>{queue.map((q) => { const st = s.queue[q.id] === "pending" ? "" : s.queue[q.id]; return (
              <tr key={q.id}><td className="mono">{q.id}</td><td><strong>{q.name}</strong><br /><span className="label">{q.label}</span></td><td className="label">{new Date(q.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
                <td className="mono">{q.via} · {q.trx} · {q.sender}</td><td className="r mono">{tk(q.amount)}</td>
                <td className="r">{st ? <span className={`pill ${st === "verified" ? "ok" : "bad"}`}>{st}</span> : q.mine ? <span className="pill">yours · needs another verifier</span> : canFully(s.role, "payments.verify") ? <span className="row" style={{ "--g": "6px", justifyContent: "flex-end", flexWrap: "nowrap" } as React.CSSProperties}>
                  <button className="btn xs" onClick={() => confirm(`Verify ${q.id}: ${tk(q.amount)} from ${q.name}? Check it against the wallet statement first.`) && act("decide", { kind: "payment", id: q.id, to: "verified" })}>Verify</button>
                  <button className="btn xs line" onClick={() => reject(q.id)}>Reject</button></span> : <span className="pill">pending</span>}</td></tr>
            ); })}</tbody></table></div>
        </div>
      )}
      {tab === "My requests" && committee && (
        <div className="stack">
          <form className="panel grid" style={{ "--min": "200px", "--g": "12px", alignItems: "end" } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget, d = new FormData(f); act("expense", { what: d.get("what"), amount: Number(d.get("amount")), event: d.get("event") }).then((ok) => ok && f.reset()); }}>
            <label className="field" style={{ gridColumn: "span 2" }}><span className="label">What is it for</span><input name="what" className="input" required minLength={3} maxLength={140} placeholder="Printed problem sets, 60 copies" /></label>
            <label className="field"><span className="label">Amount (৳)</span><input name="amount" className="input mono" type="number" required min={1} max={1000000} step={1} /></label>
            <label className="field"><span className="label">Event (optional)</span><input name="event" className="input" maxLength={80} /></label>
            <button className="btn sm">Request expense</button>
          </form>
          {myExpenses.length === 0 ? <p className="body">You have not filed any expense requests.</p> : <div className="list">{myExpenses.map((x) => (
            <div key={x.id}><span className="grow"><strong>{x.what}</strong><br /><span className="label">{x.id}{x.event ? ` · ${x.event}` : ""}</span></span><span className="mono" style={{ fontSize: 20 }}>{tk(x.amount)}</span><span className={`pill ${x.status === "approved" ? "ok" : x.status === "rejected" ? "bad" : "warn"}`}>{x.status}</span></div>
          ))}</div>}
        </div>
      )}
      {tab === "Expenses" && approve && (
        <div className="stack">
          <p className="body" style={{ maxWidth: "70ch" }}>Up to {tk(APPROVAL_THRESHOLD)} one officer decides. Above it, one officer passes the request up and a second, with full authority, decides. Nobody decides their own request.</p>
          {expenses.length === 0 && <p className="body">No expense requests.</p>}
          <div className="list">{expenses.map((x) => { const big = x.amount > APPROVAL_THRESHOLD, st = x.status === "pending" ? "" : x.status === "sent to President" && approve === true ? "" : x.status, mine = !big || x.status === "sent to President"; return (
            <div key={x.id} style={{ flexWrap: "wrap" }}><span className="grow"><strong>{x.what}</strong><br /><span className="label">{x.id} · requested by {x.name} · {x.event}{big ? " · above threshold" : ""}</span></span><span className="mono" style={{ fontSize: 20 }}>{tk(x.amount)}</span>
              {st ? <span className={`pill ${st === "rejected" ? "bad" : st === "approved" ? "ok" : "warn"}`}>{st}</span> : x.by === me.id ? <span className="pill">your request</span> : mine ? <>
                <button className="btn xs" onClick={() => confirm(`Approve ${x.id}: ${tk(x.amount)} for "${x.what}"?`) && act("decide", { kind: "expense", id: x.id, to: "approved" })}>Approve</button>
                <button className="btn xs line" onClick={() => confirm(`Reject ${x.id}? This cannot be undone.`) && act("decide", { kind: "expense", id: x.id, to: "rejected" })}>Reject</button></>
                : <button className="btn xs line" onClick={() => act("decide", { kind: "expense", id: x.id, to: "sent to President" })}>Pass up for a second decision</button>}</div>
          ); })}</div>
        </div>
      )}
      {tab === "Club fund" && (
        <div className="bento">
          <p className="body" style={{ gridColumn: "1 / -1" }} role="note"><strong>Sample figures.</strong> The balance, ledger, budgets and cash flow below are placeholders until the ledger is connected; verifying a payment or approving an expense does not change them yet.</p>
          <section className="panel c4"><p className="label">Balance</p><p className="big">{tk(fundTotal)}</p><ul className="list">{accounts.map(([n, v]) => <li key={n}><span>{n}</span><span className="mono">{tk(v)}</span></li>)}</ul></section>
          <section className="panel c8"><p className="label">Cash flow, 12 months (thousand ৳)</p><Bars data={cashflow} unit="k" /><div className="bars-x"><span>Dec 2025</span><span>Nov 2026 · ৳55k</span></div></section>
          <section className="panel c6"><p className="label">Event budgets</p>{budgets.map(([n, plan, act]) => <div key={n} className="stack" style={{ "--g": "6px" } as React.CSSProperties}><div className="row between"><span>{n}</span><span className={`mono ${act / plan >= 0.8 ? "bad" : ""}`}>{tk(act)} / {tk(plan)}{act / plan >= 0.8 ? " · 80% alert" : ""}</span></div><div className="meter" style={{ "--v": `${(act / plan) * 100}%` } as React.CSSProperties}><i style={act / plan >= 0.8 ? { background: "var(--bad)" } : undefined} /></div></div>)}</section>
          <section className="panel c6"><p className="label">Ledger</p><div className="scroll-x"><table className="tbl"><tbody>{ledger.map((l) => <tr key={l.what}><td className="label">{fmtDate(l.date)}</td><td>{l.what}</td><td className="r mono"><span className={l.amt < 0 ? "bad" : "ok"}>{l.amt < 0 ? "−" : "+"}{tk(l.amt)}</span></td></tr>)}</tbody></table></div></section>
        </div>
      )}
      {tab === "Transparency" && (
        <div className="bento">
          <p className="body" style={{ gridColumn: "1 / -1" }} role="note"><strong>Sample figures</strong> until the ledger is connected.</p>
          <section className="panel c4"><p className="label">Club fund balance</p><p className="big">{tk(fundTotal)}</p></section>
          <section className="panel c8"><p className="label">Spending this term, by category</p>{[["Prizes", 34], ["Food at events", 26], ["Printing", 14], ["Merchandise", 12], ["Hosting", 8], ["Reserve", 6]].map(([k, v]) => <div key={k} className="row" style={{ "--g": "12px", flexWrap: "nowrap" } as React.CSSProperties}><span style={{ width: 130 }}>{k}</span><div className="meter grow" style={{ "--v": `${+v * 2.6}%` } as React.CSSProperties}><i /></div><span className="mono">{v}%</span></div>)}</section>
        </div>
      )}
      {tab === "Waivers" && can(s.role, "dues.waive") && <Waivers />}
    </Page>
  );
}
