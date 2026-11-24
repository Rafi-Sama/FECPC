'use client';
import Link from 'next/link';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { HandleBox, useJudge, useSolved } from '@/components/app/Judge';
import { Onboarding } from '@/components/app/home/Onboarding';
import { SolveCheck, useDaily } from '@/components/app/home/Daily';
import { cfUrl, owes } from '@fecpc/content/member-area';
import { fmtDate } from '@fecpc/content/site';
import { usePublicEvents } from '@/lib/events';
import { LEVEL, level, quests, rankFor, XP } from '@fecpc/contracts';

// Whole days from the member's local today to a YYYY-MM-DD date.
const daysTo = (iso: string) =>
  Math.round((Date.parse(iso) - Date.parse(new Date().toLocaleDateString('en-CA'))) / 864e5);
const dueIn = (d: number) =>
  d < 0
    ? `overdue by ${-d} day${d === -1 ? '' : 's'}`
    : d === 0
      ? 'due today'
      : `due in ${d} day${d === 1 ? '' : 's'}`;
const questLink = ['/app/sheets', '/app/wiki', '/app/community'];
const css = (o: Record<string, string | number>) => o as React.CSSProperties;
const until = (ms: number) => {
  const h = (ms - Date.now()) / 36e5;
  return h < 1 ? 'within the hour' : h < 24 ? `in ${Math.round(h)}h` : `in ${Math.round(h / 24)}d`;
};

export default function Today({
  up,
}: {
  up: { id: number; name: string; when: string; start: number; durationH: number }[];
}) {
  const { s, xp, act, sheets, news } = useStore();
  const { isSolved } = useSolved();
  const { data: cf } = useJudge();
  const daily = useDaily();
  const owed = s.dues.filter((i) => owes(s.pay, i.id));
  const week = sheets.find((x) => x.kind === 'weekly');
  const weekDone = week?.problems.filter((p) => isSolved(p.id)).length ?? 0;
  const next = week?.problems.find((p) => !isSolved(p.id));
  const events = usePublicEvents();
  const unread = news.filter((a) => !s.read.includes(a.id));
  const streak = s.run,
    lv = level(xp);
  const q = quests(s),
    qn = q.filter((x) => x.done).length;
  const last = cf?.contests?.[0];
  return (
    <Page
      title={
        s.checkin ? (
          <>
            {streak} days. <span className="acc">Safe until tomorrow.</span>
          </>
        ) : (
          <>
            {streak} days. <span className="acc">Don&apos;t break it.</span>
          </>
        )
      }
    >
      {owed.length > 0 && (
        <div className="alert">
          <span>
            <strong>৳{owed.reduce((a, i) => a + i.amount, 0)}</strong> across {owed.length} invoice
            {owed.length > 1 ? 's' : ''} · ৳{owed[0].amount} {dueIn(daysTo(owed[0].due))}
          </span>
          <Link href="/app/finance" className="btn xs line">
            Pay
          </Link>
        </div>
      )}
      <div className="bento fill">
        <section className="panel c8">
          <div className="row between">
            <p className="label">Problems of the day · from this week&apos;s sheet</p>
            <button
              className={`btn sm ${s.checkin ? 'line' : ''}`}
              disabled={s.checkin}
              onClick={() => act('checkin')}
            >
              {s.checkin ? 'Checked in ✓' : `Daily check-in · +${XP.checkin} XP`}
            </button>
          </div>
          {daily.length ? (
            <div className="tier3">
              {daily.map((p) => (
                <div
                  key={p.id}
                  className={`potd ${isSolved(p.id) ? 'done' : ''}`}
                  data-tier={p.tier}
                >
                  <span className="label acc2">
                    {p.tier} · {p.rating}
                  </span>
                  <a
                    className="h3 link"
                    style={{ fontSize: 19, textDecoration: 'none' }}
                    href={cfUrl(p.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.name}
                  </a>
                  <span className="label">
                    {p.id}
                    {p.tags[0] ? ` · ${p.tags[0]}` : ''}
                  </span>
                  <SolveCheck id={p.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="body dim">This week&apos;s sheet is being built.</p>
          )}
        </section>
        <section className="panel c4">
          <p className="label">
            Level {lv.lv} · {lv.title}
          </p>
          <p className="big">
            {LEVEL - lv.into}
            <span className="mut" style={{ fontSize: '.36em' }}>
              {' '}
              XP to level {lv.lv + 1}
            </span>
          </p>
          <div className="meter" style={css({ '--v': `${(lv.into / LEVEL) * 100}%` })}>
            <i />
          </div>
          <p className="label">
            Daily quests · {qn}/3 · all three +{XP.quest} XP
          </p>
          <ul className="list">
            {q.map((x, i) => (
              <li key={x.id}>
                <span className={x.done ? 'ok' : 'dim'}>{x.done ? '✓' : '○'}</span>
                <span className="grow" style={{ opacity: x.done ? 0.55 : 1 }}>
                  {x.text}
                </span>
                {!x.done && (
                  <Link className="btn xs line" href={questLink[i]}>
                    Go<span className="sr">: {x.text}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel c4">
          <p className="label">Codeforces</p>
          {cf ? (
            <>
              <p className="big" style={css({ color: rankFor(cf.rating).color })}>
                {cf.rating}
                <span className="mut" style={{ fontSize: '.36em' }}>
                  {' '}
                  {cf.rank}
                </span>
              </p>
              <p className="label">
                {cf.handle} · peak {cf.maxRating} · {cf.solved.length} solved
              </p>
              {last && (
                <p className="body">
                  Last round: rank {last.rank.toLocaleString()} ·{' '}
                  <span className={last.delta >= 0 ? 'ok' : 'bad'}>
                    {last.delta >= 0 ? '+' : ''}
                    {last.delta}
                  </span>
                </p>
              )}
              <Link href="/app/contests" className="btn sm line">
                Upsolve queue
              </Link>
            </>
          ) : (
            <HandleBox />
          )}
        </section>
        <section className="panel c4">
          <p className="label">This week&apos;s sheet</p>
          {week ? (
            <>
              <p className="big">
                {weekDone}
                <span className="mut" style={{ fontSize: '.36em' }}>
                  {' '}
                  / {week.problems.length} solved
                </span>
              </p>
              <div
                className="meter"
                style={css({ '--v': `${(weekDone / Math.max(1, week.problems.length)) * 100}%` })}
              >
                <i />
              </div>
              {next ? (
                <p className="body">
                  Next:{' '}
                  <a className="link" href={cfUrl(next.id)} target="_blank" rel="noreferrer">
                    {next.name}
                  </a>{' '}
                  <span className="dim">· {next.rating}</span>
                </p>
              ) : (
                <p className="body ok">All done this week.</p>
              )}
            </>
          ) : (
            <p className="body dim">Being built.</p>
          )}
          <Link href="/app/sheets" className="btn sm line">
            Open sheets
          </Link>
        </section>
        <section className="panel c4">
          <p className="label">Next Codeforces rounds</p>
          {up.length ? (
            <ul className="list">
              {up.map((c) => (
                <li key={c.id}>
                  <span className="grow">
                    <a
                      className="link"
                      href={`https://codeforces.com/contests/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {c.name}
                    </a>
                    <br />
                    <span className="label">
                      {c.when} · <span className="acc">{until(c.start)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="body dim">Codeforces is not answering right now.</p>
          )}
        </section>
        <section className="panel c6">
          <div className="row between">
            <p className="label">Club events</p>
            <Link className="label" href="/app/events">
              All →
            </Link>
          </div>
          {events.length ? (
            <ul className="list">
              {events.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <span className="mono acc" style={{ width: 64, whiteSpace: 'nowrap' }}>
                    {fmtDate(e.startsAt.slice(0, 10))}
                  </span>
                  <span className="grow">
                    <Link className="link" href={`/app/events/${e.id}`}>
                      <strong>{e.title}</strong>
                    </Link>
                    <br />
                    <span className="label">
                      {[e.startsAt.slice(11), e.place].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {s.reg.includes(e.id) && <span className="pill ok">going</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="body dim">No events scheduled.</p>
          )}
        </section>
        <section className="panel c6">
          <div className="row between">
            <p className="label">Announcements · {unread.length} unread</p>
            <Link className="label" href="/app/community">
              All →
            </Link>
          </div>
          {news.length ? (
            <ul className="list">
              {news.slice(0, 4).map((a) => (
                <li key={a.id} style={{ opacity: s.read.includes(a.id) ? 0.5 : 1 }}>
                  <span className="grow">
                    <strong>{a.title}</strong>
                    <br />
                    <span className="label">
                      {a.by} · {fmtDate(a.at.slice(0, 10))}
                      {a.requires_ack ? ' · must read' : ''}
                    </span>
                  </span>
                  <Link
                    className="btn xs line"
                    href={`/app/community?tab=announcements&open=${encodeURIComponent(a.id)}`}
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="body dim">No announcements yet.</p>
          )}
        </section>
        <Onboarding />
      </div>
    </Page>
  );
}
