import Link from "next/link";
import Rain from "@/components/pixel/Rain";
import { upcomingContests, localTime } from "@/lib/cf";
import { byId, fmtDate, pastContests } from "@/lib/data";
import { site } from "@/lib/site";

export const metadata = { title: "Contests" };
const sheets = [
  ["starter.sheet", 40, "Zero to first AC. Input, loops, arrays, strings.", "open to everyone"],
  ["green.sheet", 240, "The core. Twelve topics from implementation to DP.", "members"],
  ["advanced.sheet", 160, "Segment trees, flows, string algorithms, geometry.", "after green"],
  ["icpc.sheet", 90, "Team problems from past regionals, solved on one machine.", "ICPC teams"],
  ["interview.sheet", 75, "The questions companies actually ask, by pattern.", "final year"],
] as const;
const loop = [
  ["register", "Tap “I'm participating” so the club sees who is in each round."],
  ["compete", "Solve on the judge. Nothing is submitted to us."],
  ["report", "Minutes after the round: who took part, ranks, rating changes, best performer."],
  ["upsolve", "Every problem you missed lands in a personal queue with a deadline and a group thread."],
];

export default async function Contests() {
  const up = await upcomingContests(10);
  return (
    <>
      <section className="page-head t-a crt" data-t="a">
        <div className="bgfx rain"><Rain /></div>
        <div className="wrap"><div className="head">
          <h1 className="disp"><span className="dim">$</span> ./compete<i aria-hidden className="blink blk" /></h1>
          <p className="lede">Every rated round worth entering, in {site.city.split(",")[0]} time, plus the club&apos;s own weekly contest and the editorials for all of them.</p>
        </div></div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head"><h2 className="h2">ls ./upcoming</h2></div>
          <div className="panel flush"><div className="bar"><span>contests.upcoming</span><span>{up.length} rounds</span></div>
            <div className="scroll-x"><table className="tbl">
              <thead><tr><th style={{ width: 230 }}>starts ({site.tz})</th><th>round</th><th className="r" style={{ width: 90 }}>length</th><th className="r" style={{ width: 90 }}>link</th></tr></thead>
              <tbody>
                {up.length === 0 && <tr><td colSpan={4} className="mut">judge unreachable; showing nothing rather than stale times. try again in a few minutes.</td></tr>}
                {up.map((c) => <tr key={c.id}><td className="acc" style={{ whiteSpace: "nowrap" }}>{localTime(c.start)}</td><td className="hi">{c.name}</td><td className="r">{c.durationH}h</td><td className="r"><a className="link" href={`https://codeforces.com/contests/${c.id}`} rel="noreferrer">open ↗</a></td></tr>)}
              </tbody>
            </table></div>
          </div>
          <p className="body" style={{ marginTop: 18 }}>Members also see AtCoder, CodeChef and LeetCode rounds, with reminders.</p>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head"><h2 className="h2"><span className="nw">register → compete →</span> <span className="nw">report → upsolve</span></h2></div>
          <ol className="grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {loop.map(([t, d], i) => <li key={t} className="panel"><p className="label">step {i + 1}/4</p><h3 className="h3" style={{ marginBlock: 10 }}><span className="acc">./</span>{t}</h3><p className="body">{d}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a" id="archive">
        <div className="wrap">
          <div className="head"><h2 className="h2">cat ./archive/*.md</h2><p className="lede">Past club contests with problem sets and member-written editorials.</p></div>
          <div className="stack" style={{ "--g": "0px" } as React.CSSProperties}>
            {pastContests.map((c) => (
              <details key={c.id} className="arch" name="arch">
                <summary><span className="acc">{fmtDate(c.date, { day: "2-digit", month: "short", year: "numeric" })}</span><span className="hi">{c.name}</span><span className="dim">{c.teams} entered</span><span aria-hidden className="chev">[+]</span></summary>
                <div className="arch-body">
                  <p><span className="dim">winner&nbsp;&nbsp;&nbsp;</span> {byId(c.winner).name} <span className="dim">@{byId(c.winner).handle}</span></p>
                  <p><span className="dim">problems&nbsp;</span> {c.solved} · all solved by at least one member</p>
                  <p><span className="dim">topics&nbsp;&nbsp;&nbsp;</span> {c.topics.map((t) => <span key={t} className="tag" style={{ marginRight: 6 }}>{t}</span>)}</p>
                  <p className="mut">Editorial: progressive hints first (hint 1, hint 2), then the full solution with code in C++. Members can comment on each problem.</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head"><h2 className="h2">ls -la ./sheets</h2><p className="lede">A sheet is an ordered list of problems grouped by topic. Paste your handle once; solved problems tick themselves.</p></div>
          <div className="panel flush"><div className="scroll-x"><table className="tbl">
            <thead><tr><th>sheet</th><th className="r">problems</th><th>what it covers</th><th>access</th></tr></thead>
            <tbody>{sheets.map(([n, c, d, a]) => <tr key={n}><td className="acc">{n}</td><td className="r num hi">{c}</td><td>{d}</td><td className="dim">{a}</td></tr>)}</tbody>
          </table></div></div>
          <div className="row" style={{ marginTop: 40, "--g": "20px" } as React.CSSProperties}><Link href="/join" className="btn">&gt; Get the sheets</Link><Link href="/leaderboard" className="btn ghost">cat ./ranks</Link></div>
        </div>
      </section>
    </>
  );
}
