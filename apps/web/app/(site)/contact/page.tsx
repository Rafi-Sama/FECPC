import { site } from '@/lib/site';
import { sponsorTiers } from '@fecpc/content/site';

export const metadata = { title: 'Sponsors and contact' };
const spend = [
  ['Prizes', 34],
  ['Food at events', 26],
  ['Printing', 14],
  ['Merchandise', 12],
  ['Hosting and domain', 8],
  ['Reserve', 6],
] as const;

export default function Contact() {
  return (
    <>
      <section className="page-head t-b paper" data-t="b">
        <div className="wrap split flip [align-items:end]">
          <div className="head mb-0">
            <h1 className="disp text-[clamp(48px,6.4vw,92px)]">
              Put your name on the <span className="acc">scoreboard.</span>
            </h1>
            <p className="lede">
              We write down what was promised, and report back on what was delivered.
            </p>
          </div>
          <div className="stack [--g:10px]">
            <p className="label">One inbox, answered in two working days</p>
            <a
              className="[font-size:clamp(22px,3.4vw,44px)] [font-weight:500] [letter-spacing:-0.03em] [text-underline-offset:8px] break-all text-ink"
              href={`mailto:${site.email}`}
            >
              {site.email}
            </a>
          </div>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">Three ways in.</h2>
          </div>
          <div className="grid [--min:280px] [--g:0px_24px]">
            {sponsorTiers.map((t, i) => (
              <article key={t.tier} className="panel tier">
                <p className="silk acc">0{i + 1}</p>
                <h3 className="text-[clamp(36px,4vw,52px)] font-medium tracking-[-0.04em] leading-[1]">
                  {t.tier}
                </h3>
                <p className="stat text-[32px]">{t.ask}</p>
                <ul className="stack [--g:10px]">
                  {t.gets.map((g) => (
                    <li key={g} className="body">
                      <span className="acc" aria-hidden>
                        ■{' '}
                      </span>
                      {g}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Spending, by category.</h2>
            <p className="lede">
              The same breakdown members see on the transparency page. Totals and categories only,
              never an individual&apos;s payments.
            </p>
          </div>
          <ul className="spend [&_.silk]:text-right [&_li]:[display:grid] [&_li]:grid-cols-[minmax(110px,170px)_minmax(0,1fr)_48px] [&_li]:gap-4 [&_li]:items-center [&_li]:p-[16px_0] [&_li]:[border-top:2px_solid_var(--ink)] [&_li]:text-[17px]">
            {spend.map(([k, v]) => (
              <li key={k}>
                <span>{k}</span>
                <div className="h-7 [&_i]:block [&_i]:h-full [&_i]:text-ink [&_i]:min-w-2 [.spend_li:first-child_&_i]:text-acc">
                  <i className="dither" style={{ width: `${v * 2.6}%` }} />
                </div>
                <span className="silk">{v}%</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sec t-b bg-[#0D0D0B] text-[#ECE9E1]" data-t="b" id="contact">
        <div className="wrap split even [align-items:end]">
          <div className="head mb-0">
            <h2 className="h2">Write to a person, not a form.</h2>
            <p className="lede text-[#C9C5BC]">
              Sponsorship, a guest talk, a joint contest or a question about joining: one inbox,
              answered by the General Secretary within two working days.
            </p>
          </div>
          <div className="stack [--g:20px]">
            <a
              className="[font-size:clamp(22px,3.4vw,44px)] [font-weight:500] [letter-spacing:-0.03em] text-[#ece9e1] [text-underline-offset:8px] break-all hover:text-[#8fa0ff]"
              href={`mailto:${site.email}`}
            >
              {site.email}
            </a>
            <p className="body text-[#C9C5BC]">
              {site.name}
              <br />
              Department of CSE, {site.university}
              <br />
              {site.city}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
