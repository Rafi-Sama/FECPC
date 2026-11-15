import Link from "next/link";
import Rain from "@/components/pixel/Rain";
import Sphere from "@/components/pixel/Sphere";
import Life from "@/components/pixel/Life";
import { Avatar, Bug, Heart, Ship, Starfield } from "@/components/pixel/Sprites";
import Roadmap from "@/components/Roadmap";
import EventRow from "@/components/EventRow";
import Faq from "@/components/Faq";
import { site } from "@/lib/site";
import { upcomingContests, localTime } from "@/lib/cf";
import { badges, cfTitle, events, lifecycle, loops, members, squads, tracks } from "@/lib/data";

const boot = ["mounting /dev/brain", "loading caffeine.service", "linking 0xC0DE modules", "starting workshops.target", "starting contests.target", "reached target: hack night"];
const pillars = [
  { n: "01", t: "Workshops", d: "Weekly classes that start from zero. Slides and recordings stay online." },
  { n: "02", t: "Contests", d: "A rated club round every week, and mock regionals for the ICPC teams." },
  { n: "03", t: "Hack nights", d: "Twelve hours, one theme, a demo at sunrise." },
  { n: "04", t: "Open source", d: "This platform is built by members. Your first pull request can be to your own club." },
];
const sheet = [["Implementation", 86], ["Greedy", 71], ["Binary search", 64], ["Number theory", 52], ["Graphs", 43], ["DP", 31]] as const;

export default async function Home() {
  const contests = await upcomingContests(5);
  const top = [...members].sort((a, b) => b.rating - a.rating).slice(0, 6);
  const solved = members.reduce((s, x) => s + x.solved, 0);
  const maxPts = squads[0].pts;

  return (
    <>
      {/* ───── A · PHOSPHOR TERMINAL ───── */}
      <section className="hero hero-a t-a crt" data-t="a">
        <div className="bgfx rain"><Rain /></div>
        <div className="wrap inner">
          <div className="stack" style={{ "--g": "30px" } as React.CSSProperties}>
            <h1 className="disp">
              <span className="ln"><span className="hi">while</span> <span className="dim">(</span>alive<span className="dim">) {"{"}</span></span>
              <span className="ln ind">build<span className="dim">();</span></span>
              <span className="ln"><span className="dim">{"}"}</span><i aria-hidden className="blink blk" /></span>
            </h1>
            <p className="lede">{site.short} is where {site.uniShort} students write, ship and break real software together. Workshops, contests and hack nights, all semester.</p>
            <div className="row" style={{ "--g": "20px" } as React.CSSProperties}>
              <Link href="/join" className="btn">&gt; Join the club</Link>
              <Link href="/events" className="btn ghost">ls ./events</Link>
            </div>
          </div>
          <div className="panel flush boot">
            <div className="bar"><span>TTY1 — boot.log</span><span className="dots" aria-hidden><i /><i /><i /></span></div>
            <div className="boot-body">
              {boot.map((l, i) => <div key={l} style={{ animationDelay: `${0.3 + i * 0.28}s` }}><span className="acc">[ OK ]</span>  {l}</div>)}
              <div style={{ animationDelay: `${0.3 + boot.length * 0.28}s` }}><span className="acc2">[WARN]</span>  sleep.service not found</div>
              <div className="prompt" style={{ animationDelay: `${0.6 + boot.length * 0.28}s` }}><span className="dim">guest@{site.short.toLowerCase()}:~$</span> <Link href="/join" className="hi">./join.sh</Link><i aria-hidden className="blink cursor" /></div>
            </div>
          </div>
        </div>
        <div className="statusbar">
          <div><b>-- INSERT --</b><span>main</span><span>hero.c</span></div>
          <div><span>UTF-8</span><span>LF</span><span>Ln 1, Col 1</span></div>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head">
            <h2 className="h2"><span className="dim">$</span> ./{site.short.toLowerCase()} --status</h2>
          </div>
          <div className="grid stats" style={{ "--min": "180px", "--g": "32px" } as React.CSSProperties}>
            <div className="kv"><span className="label">members.active</span><span className="stat">{members.length * 9}</span></div>
            <div className="kv"><span className="label">problems.solved</span><span className="stat">{solved.toLocaleString("en")}</span></div>
            <div className="kv"><span className="label">contests.run</span><span className="stat">42</span></div>
            <div className="kv"><span className="label">streak.longest</span><span className="stat">{Math.max(...members.map((x) => x.streak))}d</span></div>
          </div>
          <div className="split even" style={{ marginTop: 64 }}>
            <div className="panel flush">
              <div className="bar"><span>TTY2 — ls ./contests --upcoming</span><span>codeforces · live</span></div>
              <div className="term-list">
                {contests.length === 0 && <p className="body">judge unreachable right now. <Link className="link acc" href="/contests">open the contest page</Link> to retry.</p>}
                {contests.map((c) => (
                  <a key={c.id} href={`https://codeforces.com/contests/${c.id}`} rel="noreferrer" className="term-row">
                    <span className="acc">{localTime(c.start)}</span>
                    <span className="hi clip">{c.name}</span>
                    <span className="dim">{c.durationH}h</span>
                  </a>
                ))}
                <p className="label" style={{ paddingTop: 14 }}>times in {site.tz}</p>
              </div>
            </div>
            <div className="panel flush">
              <div className="bar"><span>TTY3 — cat green-sheet.progress</span><span>club average</span></div>
              <div className="term-list">
                {sheet.map(([t, v]) => (
                  <div key={t} className="sheet-row">
                    <span>{t}</span>
                    <div className="meter" style={{ "--v": `${v}%` } as React.CSSProperties}><i /></div>
                    <span className="acc num">{v}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── B · MONOLITH DITHER ───── */}
      <section className="hero hero-b t-b paper" data-t="b">
        <div className="wrap inner">
          <div className="stack" style={{ "--g": "28px" } as React.CSSProperties}>
            <h2 className="disp">
              <span className="ln">Ideas in.</span>
              <span className="ln silk acc soft">SOFTWARE</span>
              <span className="ln">out.<i aria-hidden className="blink blk" /></span>
            </h2>
            <p className="lede">{site.short} is {site.uniShort}&apos;s home for people who think in logic and build in code. Learn it, ship it, show it.</p>
            <div className="row" style={{ "--g": "28px" } as React.CSSProperties}>
              <Link href="/about" className="btn">About the club</Link>
              <Link href="/projects" className="btn ghost">See our projects →</Link>
            </div>
          </div>
          <figure className="fig">
            <i aria-hidden className="rule-h" /><i aria-hidden className="rule-v" />
            <Sphere className="sphere" />
            <i aria-hidden className="sq s1" /><i aria-hidden className="sq s2" /><i aria-hidden className="sq s3" />
            <figcaption className="fig-no silk">FIG. 01</figcaption>
            <div className="fig-cap mono"><div>1-BIT · 8×8 BAYER · 128 PX</div><div>LIGHT θ = <span className="acc" data-theta>052°</span></div></div>
          </figure>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Four things happen here, every term.</h2>
          </div>
          <ol className="pillars">
            {pillars.map((p) => (
              <li key={p.n} className="panel">
                <span className="silk acc big-n">{p.n}</span>
                <div className="stack" style={{ "--g": "10px" } as React.CSSProperties}><h3 className="h3">{p.t}</h3><p className="body">{p.d}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">Six reasons to open it every day.</h2>
            <p className="lede">Problems, contests, events and dues behind one login.</p>
          </div>
          <ol className="loops6">
            {loops.map((l, i) => <li key={l.name}><span className="silk acc">0{i + 1}</span><strong>{l.name}</strong><p className="body">{l.what}</p></li>)}
          </ol>
        </div>
      </section>

      {/* ───── C · INSERT COIN ───── */}
      <section className="hero hero-c t-c" data-t="c">
        <Starfield />
        <div className="wrap hud arcade"><div><span className="acc2">1UP</span><span>{String(top[0].xp).padStart(6, "0")}</span></div><div className="mid"><span className="acc">HI-SCORE</span><span>{top[0].name.split(" ")[0]}</span></div><div className="end"><span className="acc3">STAGE 03</span><span>{site.uniShort}</span></div></div>
        <div aria-hidden className="march">{Array.from({ length: 9 }, (_, i) => <Bug key={i} i={i} />)}</div>
        <div className="wrap inner">
          <h2 className="disp"><span className="l1">LEVEL UP</span><span className="l2">YOUR CODE</span></h2>
          <p className="lede">Streaks, squads, duels, and a leaderboard that resets every semester.</p>
          <div className="row" style={{ "--g": "28px", justifyContent: "center" } as React.CSSProperties}>
            <Link href="/join" className="btn">PRESS START</Link>
            <Link href="/leaderboard" className="btn ghost">HIGH SCORES</Link>
          </div>
        </div>
        <div aria-hidden className="ship"><span className="shot arcade">;</span><Ship /></div>
        <div className="wrap hud foot arcade"><div className="row" style={{ "--g": "14px" } as React.CSSProperties}><span>LIVES</span><Heart /><Heart /><Heart /></div><div><span>CREDIT&nbsp;</span><span className="acc">01</span></div></div>
      </section>

      <section className="sec t-c" data-t="c">
                <div className="wrap split even">
          <div>
            <div className="head"><h2 className="h2">HIGH SCORES</h2></div>
            <ol className="scores">
              {top.map((x, i) => (
                <li key={x.id}>
                  <span className="rk arcade">{String(i + 1).padStart(2, "0")}</span>
                  <Avatar name={x.name} size={36} fg={["#FFD23F", "#3DE1FF", "#FF4D8D"][i] ?? "#8E84C9"} bg="#1D1145" />
                  <span className="nm">{x.name}<small>{cfTitle(x.rating)}</small></span>
                  <span className="arcade sc">{x.rating}</span>
                </li>
              ))}
            </ol>
            <p className="body" style={{ marginTop: 24 }}><Link href="/leaderboard" className="link acc3">View all ranks →</Link></p>
          </div>
          <div>
            <div className="head"><h2 className="h2">SQUAD CUP</h2></div>
            <div className="stack" style={{ "--g": "22px" } as React.CSSProperties}>
              {squads.map((s) => (
                <div key={s.name} className="squad">
                  <div className="row between"><span className="arcade" style={{ color: s.color }}>{s.name.toUpperCase()}</span><span className="arcade">{s.pts}</span></div>
                  <div className="meter" style={{ "--v": `${(s.pts / maxPts) * 100}%` } as React.CSSProperties}><i style={{ background: s.color }} /></div>
                  <span className="label">{s.motto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sec t-c" data-t="c">
        <div className="wrap">
          <div className="head"><h2 className="h2">SELECT YOUR CLASS</h2></div>
          <div className="grid" style={{ "--min": "230px" } as React.CSSProperties}>
            {tracks.map((t, i) => (
              <article key={t.id} className="panel class-card">
                <Bug i={i} size={55} />
                <h3 className="h3 acc">{t.cls}</h3>
                <p className="label" style={{ color: "#fff" }}>{t.name}</p>
                <dl>
                  {["LOGIC", "BUILD", "GRIT"].map((k, j) => (
                    <div key={k}><dt className="label">{k}</dt><dd aria-label={`${t.stat[j]} of 10`}>{Array.from({ length: 10 }, (_, n) => <i key={n} className={n < t.stat[j] ? "on" : ""} />)}</dd></div>
                  ))}
                </dl>
                <p className="body">{t.blurb}</p>
              </article>
            ))}
          </div>
          <div className="head" style={{ marginTop: 96 }}><h2 className="h2">ACHIEVEMENTS</h2></div>
          <ul className="grid badges" style={{ "--min": "290px", "--g": "16px" } as React.CSSProperties}>
            {badges.map((b, i) => (
              <li key={b.id}><span className="glyph" style={{ color: ["#FFD23F", "#3DE1FF", "#FF4D8D"][i % 3] }}>{b.glyph}</span><p className="silk nm">{b.name}</p><span className="arcade xp">+{b.xp}</span></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── D · SIGNAL / LIFE ───── */}
      <section className="hero hero-d t-d" data-t="d">
        <div className="bgfx life"><Life /></div>
        <div className="wrap inner">
          <div className="stack" style={{ "--g": "32px" } as React.CSSProperties}>
            <h2 className="disp"><span className="ln">Four rules.</span><span className="ln acc">Infinite</span><span className="ln acc">outcomes.</span></h2>
            <p className="lede">Every program starts as a handful of simple rules. {site.short} is where {site.uniShort} students learn them, then build what nobody predicted.</p>
            <div className="row" style={{ "--g": "28px" } as React.CSSProperties}>
              <Link href="/join" className="btn">Join the club</Link>
              <Link href="/projects" className="btn ghost">See what we build →</Link>
            </div>
          </div>
          <div className="row life-stats mono">
            <div className="kv"><span className="label">Generation</span><span data-life="gen">000012</span></div>
            <div className="kv"><span className="label">Cells alive</span><span data-life="count">—</span></div>
            <div className="kv"><span className="label">Try it</span><span>drag on the grid</span></div>
          </div>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap">
          <div className="head"><h2 className="h2">From <span className="acc">hello world</span> to a regional, one node at a time.</h2></div>
          <Roadmap done={["cpp", "stl"]} />
          <ol className="grid life-steps" style={{ "--min": "200px", "--g": "0px", marginTop: 88 } as React.CSSProperties}>
            {lifecycle.map((l, i) => (
              <li key={l.step}><span className="mono acc">{String(i + 1).padStart(2, "0")}</span><h3 className="h3">{l.step}</h3><p className="body">{l.text}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Something is on <span className="acc">this week.</span></h2>
            <p className="lede">One calendar. Register in two taps.</p>
            <p><Link href="/events" className="btn">Full calendar</Link></p>
          </div>
          <div>
            {events.slice(0, 4).map((e) => <EventRow key={e.id} e={e} />)}
          </div>
        </div>
      </section>

      {/* ───── B · questions ───── */}
      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky"><h2 className="h2">Asked every intake.</h2><p className="lede">Not here? Write to <a className="link" href={`mailto:${site.email}`}>{site.email}</a>.</p></div>
          <Faq />
        </div>
      </section>

      {/* ───── A · join ───── */}
      <section className="sec t-a crt" data-t="a">
        <div className="bgfx rain dimmer"><Rain /></div>
        <div className="wrap">
          <div className="panel flush cta">
            <div className="bar"><span>TTY1 — join.sh</span><span className="dots" aria-hidden><i /><i /><i /></span></div>
            <div className="cta-body">
              <p className="mut"><span className="dim">guest@{site.short.toLowerCase()}:~$</span> ./join.sh --dry-run</p>
              <p><span className="acc">[1/3]</span> fill in the form <span className="dim"># 4 minutes</span></p>
              <p><span className="acc">[2/3]</span> take the screening quiz <span className="dim"># no experience needed</span></p>
              <p><span className="acc">[3/3]</span> book an interview slot <span className="dim"># we mostly ask what you want to build</span></p>
              <h2 className="h2" style={{ marginTop: 28 }}>Ready when you are<i aria-hidden className="blink cursor" style={{ marginLeft: 12 }} /></h2>
              <div className="row" style={{ "--g": "20px", marginTop: 28 } as React.CSSProperties}>
                <Link href="/join" className="btn">&gt; Apply now</Link>
                <Link href="/about" className="btn ghost">man {site.short.toLowerCase()}</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
