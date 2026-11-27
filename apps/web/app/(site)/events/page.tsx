import Link from 'next/link';
import Life from '@/components/pixel/Life';
import EventRow from '@/components/site/EventRow';
import { publicEvents } from '@/lib/api';

import { lifeBackdrop } from '@/components/site/ui';

export const metadata = { title: 'Events' };
const types = [
  ['Class', 'Bootcamp lessons with slides, recordings and auto-checked assignments.'],
  ['Workshop', 'One evening, one tool. Git, Linux, Docker, LaTeX, debugging.'],
  ['Contest', 'Weekly rated rounds and the annual intra-college contest.'],
  ['ICPC prep', 'Five-hour mocks for teams of three on a single machine.'],
  ['Hackathon', 'Overnight builds with a theme, a demo and breakfast.'],
  ['Seminar', 'Alumni and industry talks, always with a long Q&A.'],
  ['Social', 'Board games, a cricket match, and the end-of-term dinner.'],
];
const day = [
  [
    'Team registration',
    'Register a team of three, pay the fee by mobile wallet, get one QR ticket per person.',
  ],
  [
    'Live scoreboard',
    'ICPC-style standings on the projector and on your phone, frozen for the last hour and revealed at the ceremony.',
  ],
  [
    'Balloon tracker',
    'Volunteers see which team just solved which problem and which colour to carry over.',
  ],
  [
    'Print queue',
    'Teams send code to the printer from their machine; runners deliver it to the desk.',
  ],
];

export default async function Events() {
  const events = await publicEvents();
  const marks = new Map(
    events
      .filter((e) => e.startsAt.startsWith('2026-11'))
      .map((e) => [+e.startsAt.slice(8, 10), e]),
  );
  return (
    <>
      <section
        className="page-head hero-d min-[1000px]:[&_.head]:max-w-[54%] t-d min-h-[560px]"
        data-t="d"
      >
        <div className={lifeBackdrop}>
          <Life />
        </div>
        <div className="wrap relative pointer-events-none">
          <div className="head">
            <h1 className="disp">
              Show up. <span className="acc">Something happens.</span>
            </h1>
            <p className="lede">Classes, contests, workshops and hack nights on one calendar.</p>
            <p className="pointer-events-auto">
              <Link href={`#${events[0]?.id ?? ''}`} className="btn">
                See what is next
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap split flip">
          <div>
            <div className="head">
              <h2 className="h2">Next on the grid.</h2>
            </div>
            {events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </div>
          <aside className="sticky">
            <div className="panel">
              <div className="row between mb-4.5">
                <h3 className="h3">November 2026</h3>
                <span className="label">Sun → Sat</span>
              </div>
              <ol
                className="[display:grid] grid-cols-[repeat(7,1fr)] gap-1 [&_li]:aspect-[1] [&_li]:[display:grid] [&_li]:[place-items:center] [&_li]:[font:14px_var(--mono),monospace] [&_li]:text-mut [&_li]:[background:color-mix(in_srgb,var(--ink)_7%,var(--bg))] [&_li.has]:bg-acc [&_li.has]:text-on [&_li.has]:font-bold [&_li.has_a]:[display:grid] [&_li.has_a]:[place-items:center] [&_li.has_a]:w-full [&_li.has_a]:h-full [&_li.has_a]:no-underline [&_li.ghost]:opacity-30 [&_li.today]:[outline:2px_solid_var(--acc)] [&_li.today]:outline-offset-[-2px] [&_li.today]:text-ink"
                aria-label="November 2026"
              >
                {Array.from({ length: 30 }, (_, i) => {
                  const d = i + 1,
                    e = marks.get(d);
                  return (
                    <li key={d} className={`${e ? 'has' : ''} ${d === 12 ? 'today' : ''}`}>
                      {e ? (
                        <a href={`#${e.id}`} title={e.title}>
                          {d}
                        </a>
                      ) : (
                        d
                      )}
                    </li>
                  );
                })}
                {Array.from({ length: 5 }, (_, i) => (
                  <li key={'g' + i} aria-hidden className="ghost">
                    {i + 1}
                  </li>
                ))}
              </ol>
              <p className="label flex gap-6 mt-6 [&_span]:flex [&_span]:items-center [&_span]:gap-2">
                <span>
                  <i className="k done" />
                  event
                </span>
                <span>
                  <i className="k open" />
                  today
                </span>
              </p>
              <hr className="rule my-5" />
              <p className="body">
                Members can subscribe from Google or Apple Calendar through an iCal feed, and set a
                reminder per event.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">
              What a term <span className="acc">is made of.</span>
            </h2>
          </div>
          <ol className="grid life-steps [--min:300px] [--g:0px]">
            {types.map(([t, d], i) => (
              <li key={t}>
                <span className="mono acc">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h3">{t}</h3>
                <p className="body">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-d bg-[#131314]" data-t="d">
        <div className="wrap split">
          <div className="head sticky">
            <h2 className="h2">
              The annual <span className="acc">contest day.</span>
            </h2>
            <p className="lede">
              One day a year the whole campus watches a scoreboard. The platform runs the room; the
              judging stays on a real judge.
            </p>
            <p>
              <Link href="/contact" className="btn">
                Register a team
              </Link>
            </p>
          </div>
          <ol className="flex flex-col [&_li]:[display:grid] [&_li]:grid-cols-[clamp(64px,9vw,120px)_minmax(0,1fr)] [&_li]:gap-6 [&_li]:[padding-block:28px] [&_li]:[border-top:1px_solid_var(--line2)] d">
            {day.map(([t, d], i) => (
              <li key={t}>
                <span className="mono acc big-n">{i + 1}</span>
                <div className="stack [--g:10px]">
                  <h3 className="h3">{t}</h3>
                  <p className="body">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-d" data-t="d">
        <div className="wrap split even items-center">
          <div className="head mb-0">
            <h2 className="h2">
              A code on the projector, <span className="acc">valid for ten minutes.</span>
            </h2>
            <p className="lede">
              The attendance code rotates and expires, so being marked present means being in the
              room. Streaks of attendance earn badges; absences can be excused with a reason.
            </p>
          </div>
          <div
            className="panel flex flex-col gap-4.5 p-[clamp(24px,4vw,48px)]"
            aria-label="Example attendance code"
          >
            <p className="label">Class code · expires in 09:41</p>
            <p className="mono code">K7 – 4Q – X2</p>
            <div className="meter [--v:96%]">
              <i />
            </div>
            <p className="body">52 of 60 checked in</p>
          </div>
        </div>
      </section>
    </>
  );
}
