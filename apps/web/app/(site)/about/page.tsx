import Link from 'next/link';
import Sphere from '@/components/pixel/Sphere';
import { Avatar } from '@/components/pixel/Sprites';
import Faq from '@/components/site/Faq';
import { site } from '@/lib/site';
import { byId, cfTitle, committee, lifecycle, timeline } from '@fecpc/content/site';

export const metadata = { title: 'About' };
const principles = [
  [
    'Start from zero',
    'Every class, sheet and roadmap has an entry point that assumes nothing. Nobody is asked what they already know.',
  ],
  [
    'Consistency over talent',
    'Points reward showing up and helping, not only raw rating. A thirty-day streak is worth more here than one lucky contest.',
  ],
  [
    'Teach what you learned last month',
    'Second-years mentor first-years. Explaining a segment tree is how you find out whether you understand one.',
  ],
  [
    'Count the money in public',
    'Every payment has a receipt, every expense has an approver, and members can see where the fund went.',
  ],
  [
    'Leave it better for the next committee',
    'Roles end on a date. Documents, code and passwords are handed over, not rediscovered.',
  ],
];

export default function About() {
  return (
    <>
      <section className="page-head t-b paper" data-t="b">
        <div className="wrap split flip" style={{ alignItems: 'center' }}>
          <div className="head">
            <h1 className="disp">
              A room full of people who <span className="acc">ship.</span>
            </h1>
            <p className="lede">
              {site.name} is a student-run society for anyone at {site.uniShort} who wants to get
              good at programming, by solving problems, building things and teaching each other.
            </p>
            <div className="row" style={{ '--g': '28px' } as React.CSSProperties}>
              <Link href="/join" className="btn">
                Join the club
              </Link>
              <Link href="#team" className="btn ghost">
                Meet the committee →
              </Link>
            </div>
          </div>
          <figure className="fig" style={{ maxWidth: 380 }}>
            <i aria-hidden className="rule-h" />
            <i aria-hidden className="rule-v" />
            <Sphere className="sphere" />
            <i aria-hidden className="sq s1" />
            <i aria-hidden className="sq s2" />
            <figcaption className="fig-no silk">FIG. 00</figcaption>
          </figure>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap">
          <p className="manifesto">
            We think programming is learned the way a language is:{' '}
            <span className="acc">daily, out loud, with other people.</span> So the club is built
            around small things that happen every day and big things that happen every term.
          </p>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Seven years, one borrowed lab.</h2>
            <p className="lede">
              The short version of how a Friday problem-solving circle turned into the busiest
              society on campus.
            </p>
          </div>
          <ol className="timeline">
            {timeline.map((t) => (
              <li key={t.year}>
                <span className="silk acc yr">{t.year}</span>
                <div className="stack" style={{ '--g': '8px' } as React.CSSProperties}>
                  <h3 className="h3">{t.title}</h3>
                  <p className="body">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-b" data-t="b" style={{ background: '#0D0D0B', color: '#ECE9E1' }}>
        <div className="wrap">
          <div className="head">
            <h2 className="h2">Five rules we actually follow.</h2>
          </div>
          <ol className="principles">
            {principles.map(([t, d], i) => (
              <li key={t}>
                <span className="silk">0{i + 1}</span>
                <h3 className="h3">{t}</h3>
                <p className="body" style={{ color: '#C9C5BC' }}>
                  {d}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b" id="team">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">The people holding the keys this year.</h2>
            <p className="lede">Elected by members, one member one vote, for one tenure.</p>
          </div>
          <ul
            className="grid"
            style={{ '--min': '280px', '--g': '0px 24px' } as React.CSSProperties}
          >
            {committee.map((c) => {
              const p = byId(c.id);
              return (
                <li key={c.id} className="panel team-card">
                  <Avatar name={p.name} size={72} fg="#0D0D0B" bg="#DAD6CB" />
                  <div>
                    <p className="label acc">{c.role}</p>
                    <strong>{p.name}</strong>
                    <p className="body">
                      {p.dept} · Batch {p.batch} · {cfTitle(p.rating)} {p.rating}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Five stages, no dead ends.</h2>
            <p className="lede">
              You can stay involved from your first application to long after you graduate.
            </p>
            <p>
              <Link href="/join" className="btn">
                Apply to join
              </Link>
            </p>
          </div>
          <ol className="pillars">
            {lifecycle.map((l, i) => (
              <li key={l.step} className="panel">
                <span className="silk acc big-n">0{i + 1}</span>
                <div className="stack" style={{ '--g': '10px' } as React.CSSProperties}>
                  <h3 className="h3">{l.step}</h3>
                  <p className="body">{l.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-b paper" data-t="b">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">Before you ask.</h2>
          </div>
          <Faq />
        </div>
      </section>
    </>
  );
}
