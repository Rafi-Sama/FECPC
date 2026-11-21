'use client';
import type { ClubEvent } from '@fecpc/contracts';
import { download } from '@/lib/events';

/** This month's grid, the list beside it, and an .ics of every upcoming event. */
export function EventsCalendar({ events }: { events: ClubEvent[] }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const name = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const list = events.filter((e) => e.startsAt.startsWith(month));
  const on = (d: number) => list.filter((e) => +e.startsAt.slice(8, 10) === d);
  // RFC 5545: CRLF lines, DTSTAMP, and \ ; , newline escaped in text
  const esc = (t: string) => t.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
  const stamp = now.toISOString().replace(/[-:]|\.\d+/g, '');
  return (
    <div className="bento">
      <section className="panel c6">
        <div className="row between">
          <h2 className="h3">{name}</h2>
        </div>
        <ol className="cal" aria-label={name}>
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1,
              es = on(d);
            return (
              <li
                key={d}
                className={`${es.length ? 'has' : ''} ${d === now.getDate() ? 'today' : ''}`}
                title={es.map((e) => e.title).join('\n') || undefined}
              >
                {d}
              </li>
            );
          })}
        </ol>
        <button
          className="btn sm line"
          onClick={() =>
            download(
              'fecpc.ics',
              new Blob(
                [
                  [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//FECPC//Events//EN',
                    ...events.flatMap((e) => [
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
          Download .ics for your calendar
        </button>
      </section>
      <section className="panel c6">
        <p className="label">This month</p>
        <div className="list">
          {list.map((e) => (
            <div key={e.id}>
              <span className="mono acc" style={{ width: 28 }}>
                {e.startsAt.slice(8, 10)}
              </span>
              <span className="grow">
                <strong>{e.title}</strong>
                <br />
                <span className="label">
                  {e.startsAt.slice(11)} · {e.place}
                </span>
              </span>
              {e.mine.some((x) => x.roleId === null && x.status === 'approved') && (
                <span className="pill ok">going</span>
              )}
            </div>
          ))}
          {!list.length && <p className="empty">Nothing this month.</p>}
        </div>
      </section>
    </div>
  );
}
