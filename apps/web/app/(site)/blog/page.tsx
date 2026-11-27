import Rain from '@/components/pixel/Rain';
import { cfUrl } from '@fecpc/content/member-area';
import { posts } from '@fecpc/content/training';
import { byId } from '@fecpc/content/site';

import { rainBackdrop, caret } from '@/components/site/ui';

export const metadata = { title: 'Editorials' };

export default function Blog() {
  return (
    <>
      <section className="page-head t-a crt" data-t="a">
        <div className={rainBackdrop}>
          <Rain />
        </div>
        <div className="wrap">
          <div className="head">
            <h1 className="disp">
              <span className="dim">$</span> cat ./editorials
              <i aria-hidden className={caret} />
            </h1>
            <p className="lede">
              Hints first, solution last. Try each hint before you open the next.
            </p>
          </div>
        </div>
      </section>
      <section className="sec t-a crt pt-0" data-t="a">
        <div className="wrap">
          <div className="stack [--g:28px] max-w-[980px]">
            {posts.map((p) => (
              <article key={p.id} className="panel">
                <div className="row between">
                  <h2 className="h3">
                    <a className="link" href={cfUrl(p.id)} rel="noreferrer">
                      {p.id} · {p.title} ↗
                    </a>
                  </h2>
                  <span className="label">
                    {byId(p.by).name} · {p.tags.join(' · ')}
                  </span>
                </div>
                {p.hints.map((h, i) => (
                  <details key={h} className="hint" open={i === 0}>
                    <summary>hint {i + 1}</summary>
                    <p className="body">{h}</p>
                  </details>
                ))}
                <details className="hint">
                  <summary>solution</summary>
                  <p className="body hi">{p.body}</p>
                  <pre className="code">{p.code}</pre>
                </details>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
