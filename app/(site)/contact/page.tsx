import { site } from "@/lib/site";
import { sponsorTiers } from "@/lib/data";

export const metadata = { title: "Sponsors and contact" };
const spend = [["Prizes", 34], ["Food at events", 26], ["Printing", 14], ["Merchandise", 12], ["Hosting and domain", 8], ["Reserve", 6]] as const;

export default function Contact() {
  return (
    <>
      <section className="page-head t-b paper" data-t="b">
        <div className="wrap split flip" style={{ alignItems: "end" }}>
          <div className="head" style={{ marginBottom: 0 }}>
            <h1 className="disp" style={{ fontSize: "clamp(48px,6.4vw,92px)" }}>Put your name on the <span className="acc">scoreboard.</span></h1>
            <p className="lede">We write down what was promised, and report back on what was delivered.</p>
          </div>
          <div className="stack" style={{ "--g": "10px" } as React.CSSProperties}><p className="label">One inbox, answered in two working days</p><a className="mail" style={{ color: "var(--ink)" }} href={`mailto:${site.email}`}>{site.email}</a></div>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap">
          <div className="head"><h2 className="h2">Three ways in.</h2></div>
          <div className="grid" style={{ "--min": "280px", "--g": "0px 24px" } as React.CSSProperties}>
            {sponsorTiers.map((t, i) => (
              <article key={t.tier} className="panel tier">
                <p className="silk acc">0{i + 1}</p>
                <h3 className="tier-name">{t.tier}</h3>
                <p className="stat" style={{ fontSize: 32 }}>{t.ask}</p>
                <ul className="stack" style={{ "--g": "10px" } as React.CSSProperties}>{t.gets.map((g) => <li key={g} className="body"><span className="acc" aria-hidden>■ </span>{g}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky"><h2 className="h2">Spending, by category.</h2><p className="lede">The same breakdown members see on the transparency page. Totals and categories only, never an individual&apos;s payments.</p></div>
          <ul className="spend">
            {spend.map(([k, v]) => <li key={k}><span>{k}</span><div className="spend-bar"><i className="dither" style={{ width: `${v * 2.6}%` }} /></div><span className="silk">{v}%</span></li>)}
          </ul>
        </div>
      </section>

      <section className="sec t-b" data-t="b" id="contact" style={{ background: "#0D0D0B", color: "#ECE9E1" }}>
        <div className="wrap split even" style={{ alignItems: "end" }}>
          <div className="head" style={{ marginBottom: 0 }}><h2 className="h2">Write to a person, not a form.</h2><p className="lede" style={{ color: "#C9C5BC" }}>Sponsorship, a guest talk, a joint contest or a question about joining: one inbox, answered by the General Secretary within two working days.</p></div>
          <div className="stack" style={{ "--g": "20px" } as React.CSSProperties}>
            <a className="mail" href={`mailto:${site.email}`}>{site.email}</a>
            <p className="body" style={{ color: "#C9C5BC" }}>{site.name}<br />Department of CSE, {site.university}<br />{site.city}</p>
          </div>
        </div>
      </section>
    </>
  );
}
