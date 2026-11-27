import Link from 'next/link';
import Rain from '@/components/pixel/Rain';
import { upcomingContests, localTime } from '@/lib/cf';
import { byId, fmtDate, pastContests } from '@fecpc/content/site';
import { site } from '@/lib/site';

import { rainBackdrop, caret } from '@/components/site/ui';

export const metadata = { title: 'Contests' };
const sheets = [
  ['starter.sheet', 40, 'Zero to first AC. Input, loops, arrays, strings.', 'open to everyone'],
  ['green.sheet', 240, 'The core. Twelve topics from implementation to DP.', 'members'],
  ['advanced.sheet', 160, 'Segment trees, flows, string algorithms, geometry.', 'after green'],
  ['icpc.sheet', 90, 'Team problems from past regionals, solved on one machine.', 'ICPC teams'],
  ['interview.sheet', 75, 'The questions companies actually ask, by pattern.', 'final year'],
] as const;
const loop = [
  ['register', "Tap “I'm participating” so the club sees who is in each round."],
  ['compete', 'Solve on the judge. Nothing is submitted to us.'],
  ['report', 'Minutes after the round: who took part, ranks, rating changes, best performer.'],
  [
    'upsolve',
    'Every problem you missed lands in a personal queue with a deadline and a group thread.',
  ],
];

export default async function Contests() {
  const up = await upcomingContests(10);
  return (
    <>
      <section className="page-head t-a crt" data-t="a">
        <div className={rainBackdrop}>
          <Rain />
        </div>
        <div className="wrap">
          <div className="head">
            <h1 className="disp">
              <span className="dim">$</span> ./compete
              <i aria-hidden className={caret} />
            </h1>
            <p className="lede">
              Every rated round worth entering, in {site.city.split(',')[0]} time, plus the
              club&apos;s own weekly contest and the editorials for all of them.
            </p>
          </div>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">ls ./upcoming</h2>
          </div>
          <div className="panel flush">
            <div className="bar">
              <span>contests.upcoming</span>
              <span>{up.length} rounds</span>
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-[230px]">starts ({site.tz})</th>
                    <th>round</th>
                    <th className="r w-[90px]">length</th>
                    <th className="r w-[90px]">link</th>
                  </tr>
                </thead>
                <tbody>
                  {up.length === 0 && (
                    <tr>
                      <td colSpan={4} className="mut">
                        judge unreachable; showing nothing rather than stale times. try again in a
                        few minutes.
                      </td>
                    </tr>
                  )}
                  {up.map((c) => (
                    <tr key={c.id}>
                      <td className="acc whitespace-nowrap">{localTime(c.start)}</td>
                      <td className="hi">{c.name}</td>
                      <td className="r">{c.durationH}h</td>
                      <td className="r">
                        <a
                          className="link"
                          href={`https://codeforces.com/contests/${c.id}`}
                          rel="noreferrer"
                        >
                          open ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="body mt-4.5">
            Members also see AtCoder, CodeChef and LeetCode rounds, with reminders.
          </p>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">
              <span className="whitespace-nowrap">register → compete →</span>{' '}
              <span className="whitespace-nowrap">report → upsolve</span>
            </h2>
          </div>
          <ol className="grid [--min:240px]">
            {loop.map(([t, d], i) => (
              <li key={t} className="panel">
                <p className="label">step {i + 1}/4</p>
                <h3 className="h3 my-2.5">
                  <span className="acc">./</span>
                  {t}
                </h3>
                <p className="body">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a" id="archive">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">cat ./archive/*.md</h2>
            <p className="lede">
              Past club contests with problem sets and member-written editorials.
            </p>
          </div>
          <div className="stack [--g:0px]">
            {pastContests.map((c) => (
              <details key={c.id} className="arch" name="arch">
                <summary>
                  <span className="acc">
                    {fmtDate(c.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="hi">{c.name}</span>
                  <span className="dim">{c.teams} entered</span>
                  <span
                    aria-hidden
                    className="[.arch[open]_&]:text-acc [color:var(--dim)] max-[641px]:[.arch_summary_&]:[grid-row:1] max-[641px]:[.arch_summary_&]:[grid-column:2]"
                  >
                    [+]
                  </span>
                </summary>
                <div className="pt-1 pr-1 pb-6 pl-37.5 leading-[2.1] max-[641px]:pl-1">
                  <p>
                    <span className="dim">winner&nbsp;&nbsp;&nbsp;</span> {byId(c.winner).name}{' '}
                    <span className="dim">@{byId(c.winner).handle}</span>
                  </p>
                  <p>
                    <span className="dim">problems&nbsp;</span> {c.solved} · all solved by at least
                    one member
                  </p>
                  <p>
                    <span className="dim">topics&nbsp;&nbsp;&nbsp;</span>{' '}
                    {c.topics.map((t) => (
                      <span key={t} className="tag mr-1.5">
                        {t}
                      </span>
                    ))}
                  </p>
                  <p className="mut">
                    Editorial: progressive hints first (hint 1, hint 2), then the full solution with
                    code in C++. Members can comment on each problem.
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sec t-a crt" data-t="a">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">ls -la ./sheets</h2>
            <p className="lede">
              A sheet is an ordered list of problems grouped by topic. Paste your handle once;
              solved problems tick themselves.
            </p>
          </div>
          <div className="panel flush">
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>sheet</th>
                    <th className="r">problems</th>
                    <th>what it covers</th>
                    <th>access</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map(([n, c, d, a]) => (
                    <tr key={n}>
                      <td className="acc">{n}</td>
                      <td className="r num hi">{c}</td>
                      <td>{d}</td>
                      <td className="dim">{a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="row mt-10 [--g:20px]">
            <Link href="/contact" className="btn">
              &gt; Get the sheets
            </Link>
            <Link href="/leaderboard" className="btn ghost">
              cat ./ranks
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
