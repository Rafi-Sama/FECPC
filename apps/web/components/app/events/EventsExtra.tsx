'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ClubEvent } from '@fecpc/contracts';
import { clubNow, isOver } from '@/lib/events';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A month grid you can page through (past months included), the chosen day's or month's events beside it.
 * Days with events are buttons; events link to their page. A day is past by the club's calendar, never by status.
 */
export function EventsCalendar({ events }: { events: ClubEvent[] }) {
  const todayIso = clubNow().slice(0, 10);
  const [ty, tm] = todayIso.split('-').map(Number) as [number, number];
  const [cursor, setCursor] = useState({ y: ty, m: tm - 1 }); // m: 0-11
  const [day, setDay] = useState<string | null>(null);

  const month = `${cursor.y}-${pad(cursor.m + 1)}`;
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Monday-first
  const name = new Date(cursor.y, cursor.m, 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const inMonth = events
    .filter((e) => e.startsAt.startsWith(month))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const on = (d: string) => inMonth.filter((e) => e.startsAt.startsWith(d));
  const shown = day ? on(day) : inMonth;
  const go = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
    setDay(null);
  };

  return (
    <div className="bento">
      <section className="panel c6">
        <div className="row between">
          <button
            type="button"
            className="btn xs line"
            aria-label="Previous month"
            onClick={() => go(-1)}
          >
            ‹
          </button>
          <h2 className="h3" aria-live="polite">
            {name}
          </h2>
          <button
            type="button"
            className="btn xs line"
            aria-label="Next month"
            onClick={() => go(1)}
          >
            ›
          </button>
        </div>
        <div className="cal2" role="grid" aria-label={name}>
          {DOW.map((d) => (
            <span key={d} className="cal2-dow" role="columnheader">
              {d}
            </span>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = `${month}-${pad(i + 1)}`,
              es = on(d);
            const cls = [
              es.length ? 'has' : '',
              es.length && d < todayIso ? 'past' : '',
              d === todayIso ? 'today' : '',
              d === day ? 'sel' : '',
            ].join(' ');
            return es.length ? (
              <button
                key={d}
                type="button"
                role="gridcell"
                className={cls}
                aria-pressed={d === day}
                aria-label={`${i + 1} ${name}: ${es.map((e) => e.title).join(', ')}`}
                title={es.map((e) => e.title).join('\n')}
                onClick={() => setDay(d === day ? null : d)}
              >
                {i + 1}
                <i>{es.length > 1 ? es.length : ''}</i>
              </button>
            ) : (
              <span key={d} role="gridcell" className={cls}>
                {i + 1}
              </span>
            );
          })}
        </div>
        <button
          type="button"
          className="btn xs line"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setCursor({ y: ty, m: tm - 1 });
            setDay(null);
          }}
        >
          Today
        </button>
      </section>
      <section className="panel c6">
        <div className="row between">
          <p className="label">
            {day
              ? new Date(`${day}T00:00`).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : `All of ${name}`}
          </p>
          {day && (
            <button type="button" className="btn xs line" onClick={() => setDay(null)}>
              Whole month
            </button>
          )}
        </div>
        <div className="list">
          {shown.map((e) => (
            <Link key={e.id} href={`/app/events/${e.id}`} className="cal2-item">
              <span className="mono acc" style={{ width: 28 }}>
                {e.startsAt.slice(8, 10)}
              </span>
              <span className="grow">
                <strong>{e.title}</strong>
                <br />
                <span className="label">
                  {e.startsAt.slice(11)} · {e.place || 'Place TBA'}
                  {e.status === 'cancelled' ? ' · cancelled' : isOver(e) ? ' · past' : ''}
                </span>
              </span>
              {e.mine.some((x) => x.roleId === null && x.status === 'approved') && (
                <span className="pill ok">{isOver(e) ? 'went' : 'going'}</span>
              )}
            </Link>
          ))}
          {!shown.length && <p className="empty">No events {day ? 'that day' : 'this month'}.</p>}
        </div>
      </section>
    </div>
  );
}
