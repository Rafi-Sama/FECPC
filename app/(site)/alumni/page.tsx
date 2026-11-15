import Link from "next/link";
import Life from "@/components/pixel/Life";
import { Avatar } from "@/components/pixel/Sprites";
import { alumni } from "@/lib/appdata2";
import { site } from "@/lib/site";

export const metadata = { title: "Alumni" };
const ways = [["Mentor", "One hour a month with a member who wants your job."], ["Refer", "Post an opening. We send you people who can pass the interview."], ["Speak", "A fireside talk each term, with a long Q&A."], ["Fund", "Donations go to the prize sub-fund, visible on the transparency page."]];

export default function Alumni() {
  return (
    <>
      <section className="page-head hero-d t-d" data-t="d" style={{ minHeight: 520 }}>
        <div className="bgfx life" style={{ top: 64 }}><Life /></div>
        <div className="wrap" style={{ position: "relative", pointerEvents: "none" }}><div className="head">
          <h1 className="disp">You graduate. <span className="acc">You do not leave.</span></h1>
          <p className="lede">Graduates keep their profile, their hall of fame entry and a way to give back.</p>
          <p style={{ pointerEvents: "auto" }}><a href={`mailto:${site.email}?subject=Alumni`} className="btn">Get back in touch</a></p>
        </div></div>
      </section>
      <section className="sec t-d" data-t="d"><div className="wrap">
        <ul className="grid" style={{ "--min": "400px", "--g": "0px" } as React.CSSProperties}>
          {alumni.map((a) => <li key={a.name} className="panel proj"><div className="row"><Avatar name={a.name} size={56} /><div><h2 className="h3" style={{ fontSize: 24 }}>{a.name}</h2><p className="label">Batch {a.batch} · {a.city}</p></div></div><p className="body">{a.at}</p>{a.mentor && <span className="tag on" style={{ alignSelf: "flex-start" }}>Mentoring</span>}</li>)}
        </ul>
      </div></section>
      <section className="sec t-d" data-t="d" style={{ background: "#131314" }}><div className="wrap">
        <div className="head"><h2 className="h2">Give the next batch <span className="acc">what you wanted.</span></h2></div>
        <ol className="grid life-steps" style={{ "--min": "220px", "--g": "0px" } as React.CSSProperties}>{ways.map(([t, d], i) => <li key={t}><span className="mono acc">0{i + 1}</span><h3 className="h3">{t}</h3><p className="body">{d}</p></li>)}</ol>
        <p style={{ marginTop: 56 }}><a href={`mailto:${site.email}?subject=Alumni`} className="btn">Get back in touch</a> <Link href="/leaderboard#hall" className="btn ghost" style={{ marginLeft: 20 }}>Hall of fame →</Link></p>
      </div></section>
    </>
  );
}
