'use client';
import Link from 'next/link';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { Verified } from '@/components/app/sheets/Verified';
import { useSolved } from '@/components/app/Judge';
import { Onboarding } from '@/components/app/home/Onboarding';
import { announcements, cfUrl, myInvoices, owes, potd, sheet } from '@fecpc/content/member-area';
import { fmtDate, squads } from '@fecpc/content/site';
import { fmtWhen, usePublicEvents } from '@/lib/events';
import { LEVEL, level, quests, XP } from '@fecpc/contracts';

// Whole days from the member's local today to a YYYY-MM-DD date.
const daysTo = (iso: string) =>
  Math.round((Date.parse(iso) - Date.parse(new Date().toLocaleDateString('en-CA'))) / 864e5);
const dueIn = (d: number) =>
  d < 0
    ? `overdue by ${-d} day${d === -1 ? '' : 's'}`
    : d === 0
      ? 'due today'
      : `due in ${d} day${d === 1 ? '' : 's'}`;
const questLink = ['/app/sheets', '/app/courses', '/app/community'];

export default function Today() {
  const { s, me, xp, act } = useStore();
  const { synced, isSolved } = useSolved();
  const owed = myInvoices(s.reg).filter((i) => owes(s.pay, i.id));
  const next = sheet.find((p) => !isSolved(p.id));
  const events = usePublicEvents();
  const contest = events.find((e) => e.type === 'Contest');
  const unread = announcements.filter((a) => !s.read.includes(a.id));
  const streak = me.streak + (s.checkin ? 1 : 0),
    lv = level(xp);
  const q = quests(s),
    qn = q.filter((x) => x.done).length;
  const firstOpen = potd.find((p) => !isSolved(p.id));
  const rank = [...squads].findIndex((x) => x.name === me.squad),
    ahead = squads[rank - 1];
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
      <div className="bento">
        <section className="panel c8">
          <div className="row between">
            <p className="label">Problem of the day</p>
            <button
              className={`btn sm ${s.checkin ? 'line' : ''}`}
              disabled={s.checkin}
              onClick={() => act('checkin')}
            >
              {s.checkin ? 'Checked in ✓' : `Daily check-in · +${XP.checkin} XP`}
            </button>
          </div>
          <div className="tier3">
            {potd.map((p) => {
              const done = isSolved(p.id);
              return (
                <div key={p.id} className={`potd ${done ? 'done' : ''}`} data-tier={p.tier}>
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
                  <span className="label">{p.id}</span>
                  <button
                    className={`btn sm ${done || (s.checkin && p !== firstOpen) || !s.checkin ? 'line' : ''}`}
                    disabled={synced.has(p.id)}
                    onClick={() => act('toggle', { list: 'solved', id: p.id })}
                  >
                    {done ? 'Solved' : 'Mark solved'}
                    {done && <Verified on={synced.has(p.id) || s.verified.includes(p.id)} />}
                  </button>
                </div>
              );
            })}
          </div>
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
          <div
            className="meter"
            style={{ '--v': `${(lv.into / LEVEL) * 100}%` } as React.CSSProperties}
          >
            <i />
          </div>
          <p className="label">
            Daily quests · {qn}/3 · all three +{XP.quest} XP
          </p>
          <ul className="list">
            {q.map((x, i) => (
              <li key={x.id}>
                <span className={x.done ? 'ok' : 'dim'}>{x.done ? '✓' : '○'}</span>
                <span
                  className="grow"
                  style={{
                    opacity: x.done ? 0.55 : 1,
                    textDecoration: x.done ? 'line-through' : 'none',
                  }}
                >
                  {x.text}
                </span>
                {!x.done && (
                  <Link className="btn xs line" href={questLink[i]}>
                    Go
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel c4">
          <p className="label">Next on your green sheet</p>
          {next ? (
            <>
              <a
                className="h3 link"
                style={{ textDecoration: 'none' }}
                href={cfUrl(next.id)}
                target="_blank"
                rel="noreferrer"
              >
                {next.name}
              </a>
              <p className="label">
                {next.id} · {next.topic} · rated {next.rating}
              </p>
            </>
          ) : (
            <p className="h3">Sheet complete.</p>
          )}
          <div
            className="meter"
            style={
              {
                '--v': `${(sheet.filter((p) => isSolved(p.id)).length / sheet.length) * 100}%`,
              } as React.CSSProperties
            }
          >
            <i />
          </div>
          <Link href="/app/sheets" className="btn sm line">
            Open sheet
          </Link>
        </section>
        {contest && (
          <section className="panel c4">
            <p className="label">Next contest</p>
            <p className="big">
              {Math.max(0, daysTo(contest.startsAt.slice(0, 10)))}
              <span className="mut" style={{ fontSize: '.36em' }}>
                {' '}
                days
              </span>
            </p>
            <p className="body">{contest.title}</p>
            <p className="label">{fmtWhen(contest.startsAt)}</p>
            <Link href="/app/contests" className="btn sm line">
              Contest calendar
            </Link>
          </section>
        )}
        {rank >= 0 && (
          <section className="panel c4">
            <p className="label">Squad cup</p>
            <p className="big">
              {['1st', '2nd', '3rd', '4th'][rank]}
              <span className="mut" style={{ fontSize: '.36em' }}>
                {' '}
                · {me.squad}
              </span>
            </p>
            <p className="body">
              {ahead
                ? `${ahead.pts - squads[rank].pts} points behind ${ahead.name}`
                : 'Leading the cup'}
            </p>
            {squads.map((x) => (
              <div
                key={x.name}
                className="row"
                style={
                  {
                    '--g': '10px',
                    flexWrap: 'nowrap',
                    opacity: x.name === me.squad ? 1 : 0.5,
                  } as React.CSSProperties
                }
              >
                <span style={{ width: 52 }}>{x.name}</span>
                <div
                  className="meter grow"
                  style={
                    {
                      '--v': `${((x.pts - 3500) / (squads[0].pts - 3500)) * 100}%`,
                    } as React.CSSProperties
                  }
                >
                  <i />
                </div>
                <span className="mono">{x.pts}</span>
              </div>
            ))}
          </section>
        )}
        <section className="panel c6">
          <p className="label">Coming up</p>
          <ul className="list">
            {events.slice(0, 3).map((e) => (
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
        </section>
        <section className="panel c6">
          <div className="row between">
            <p className="label">Announcements · {unread.length} unread</p>
            <Link className="label" href="/app/community">
              All →
            </Link>
          </div>
          <ul className="list">
            {announcements.map((a) => (
              <li key={a.id} style={{ opacity: s.read.includes(a.id) ? 0.5 : 1 }}>
                <span className="grow">
                  <strong>{a.title}</strong>
                  <br />
                  <span className="label">
                    {a.scope}
                    {a.must ? ' · must read' : ''}
                  </span>
                </span>
                {!s.read.includes(a.id) && (
                  <button
                    className="btn xs line"
                    onClick={() => act('toggle', { list: 'read', id: a.id, on: true })}
                  >
                    Read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
        <Onboarding />
      </div>
    </Page>
  );
}
