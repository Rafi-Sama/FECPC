import Rain from "@/components/pixel/Rain";
import { cfUrl } from "@/lib/appdata";
import { posts } from "@/lib/appdata2";
import { byId } from "@/lib/data";

export const metadata = { title: "Editorials" };

export default function Blog() {
  return (
    <>
      <section className="page-head t-a crt" data-t="a"><div className="bgfx rain"><Rain /></div><div className="wrap"><div className="head">
        <h1 className="disp"><span className="dim">$</span> cat ./editorials<i aria-hidden className="blink blk" /></h1>
        <p className="lede">Hints first, solution last. Try each hint before you open the next.</p>
      </div></div></section>
      <section className="sec t-a crt" data-t="a" style={{ paddingTop: 0 }}><div className="wrap"><div className="stack" style={{ "--g": "28px", maxWidth: 980 } as React.CSSProperties}>
        {posts.map((p) => (
          <article key={p.id} className="panel">
            <div className="row between"><h2 className="h3"><a className="link" href={cfUrl(p.id)} rel="noreferrer">{p.id} · {p.title} ↗</a></h2><span className="label">{byId(p.by).name} · {p.tags.join(" · ")}</span></div>
            {p.hints.map((h, i) => <details key={h} className="hint" open={i === 0}><summary>hint {i + 1}</summary><p className="body">{h}</p></details>)}
            <details className="hint"><summary>solution</summary><p className="body hi">{p.body}</p><pre className="code">{p.code}</pre></details>
          </article>
        ))}
      </div></div></section>
    </>
  );
}
