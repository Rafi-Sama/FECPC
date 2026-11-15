"use client";
import { Page } from "@/components/app/Shell";
import { toggle, useStore } from "@/components/app/Store";
import { cfUrl, sheet, upsolve } from "@/lib/appdata";
import { byId, pastContests } from "@/lib/data";

const report = [["nadia", 5, 212, +38], ["tanvir", 5, 344, +21], ["sadia", 4, 801, +12], ["rahim", 4, 1120, -6], ["tasnim", 3, 2890, +54], ["zahid", 2, 5102, +31]] as const;

export default function ContestsClient({ up }: { up: { id: number; name: string; when: string; durationH: number }[] }) {
  const { s, me, act } = useStore();
  const last = pastContests[0];
  return (
    <Page title="Contests">
      <div className="bento">
        <section className="panel c8">
          <p className="label">upcoming</p>
          <div className="list">
            {up.length === 0 && <p className="body">judge unreachable; no rounds to show right now.</p>}
            {up.map((c) => { const on = s.reg.includes("cf" + c.id); return (
              <div key={c.id}><span className="grow"><a className="hi link" href={`https://codeforces.com/contests/${c.id}`} target="_blank" rel="noreferrer">{c.name}</a><br /><span className="label"><span className="acc">{c.when}</span> · {c.durationH >= 48 ? `${Math.round(c.durationH / 24)} days` : `${c.durationH}h`}</span></span>
                <button className={`btn xs ${on ? "" : "line"}`} aria-pressed={on} onClick={() => act("toggle", { list: "reg", id: "cf" + c.id })}>{on ? "going ✓" : "join"}</button></div>
            ); })}
          </div>
        </section>
        <section className="panel c4">
          <p className="label">upsolve queue</p>
          <div className="list">
            {upsolve.map((u) => { const p = sheet.find((x) => x.id === u.id)!, done = s.solved.includes(u.id); return (
              <div key={u.id}><span className="grow"><a className={`link ${done ? "dim" : "hi"}`} href={cfUrl(u.id)} target="_blank" rel="noreferrer">{p.id} {p.name}</a><br /><span className="label">{u.from} · <span className={u.due === "overdue" && !done ? "bad" : ""}>{done ? "cleared" : u.due}</span></span></span>
                <input type="checkbox" className="check" aria-label={`${p.name} upsolved`} checked={done} onChange={() => act("toggle", { list: "solved", id: u.id })} /></div>
            ); })}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: "1 / -1", maxWidth: 980 }}>
          <div className="row between"><p className="label">club report · {last.name}</p><span className="label">{last.teams} entered · best performer: <span className="acc">{byId(last.winner).name}</span></span></div>
          <div className="scroll-x"><table className="tbl"><thead><tr><th>member</th><th className="r">solved</th><th className="r">global rank</th><th className="r">rating change</th></tr></thead>
            <tbody>{report.map(([id, sv, rk, d]) => <tr key={id} className={id === me.id ? "you" : ""}><td className="hi">{byId(id).name} <span className="dim">@{byId(id).handle}</span>{id === me.id && <span className="pill" style={{ marginLeft: 10 }}>you</span>}</td><td className="r">{sv}/{last.solved}</td><td className="r">{rk}</td><td className={`r ${d >= 0 ? "acc" : "bad"}`}>{d >= 0 ? "+" : ""}{d}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </Page>
  );
}
