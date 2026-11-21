'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ClubEvent } from '@fecpc/contracts';
import { download } from '@/lib/events';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A month grid you can page through (past months included), the chosen day's or month's events beside it,
 * and an .ics of every upcoming event. Days with events are buttons; events link to their page.
 */
export function EventsCalendar({
  events,
  isOver,
}: {
  events: ClubEvent[];
  isOver: (e: ClubEvent) => boolean;
}) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() }); // m: 0-11
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

  // RFC 5545: CRLF lines, DTSTAMP, and \ ; , newline escaped in text
  const esc = (t: string) => t.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, '');
  const upcoming = events.filter((e) => !isOver(e));

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
              es.length && es.every(isOver) ? 'past' : '',
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
        <div className="row between">
          <button
            type="button"
            className="btn xs line"
            onClick={() => {
              setCursor({ y: now.getFullYear(), m: now.getMonth() });
              setDay(null);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn xs line"
            disabled={!upcoming.length}
            onClick={() =>
              download(
                'fecpc.ics',
                new Blob(
                  [
                    [
                      'BEGIN:VCALENDAR',
                      'VERSION:2.0',
                      'PRODID:-//FECPC//Events//EN',
                      ...upcoming.flatMap((e) => [
                        'BEGIN:VEVENT',
                        `UID:${e.id}@fecpc`,
                        `DTSTAMP:${stamp}`,
                        `DTSTART:${e.startsAt.replace(/[-:]/g, '')}00`,
                        `SUMMARY:${esc(e.title)}`,
                        `LOCATION:${esc(e.place)}`,
                        'END:VEVENT',
                      ]),
                      'END:VCALENDAR',
                      '',
                    ].join('\r\n'),
                  ],
                  { type: 'text/calendar' },
                ),
              )
            }
          >
            Download upcoming as .ics
          </button>
        </div>
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
                  {isOver(e) ? ' · past' : ''}
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
