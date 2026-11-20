'use client';
import Link from 'next/link';
import { useStore } from '../Store';
import QR from '../QR';
import { volunteerShifts } from '@fecpc/content/training';
import { certificates, events, fmtDate } from '@fecpc/content/site';

const css = (o: Record<string, string | number>) => o as React.CSSProperties;

export function EventsExtra({ tab }: { tab: string }) {
  const { s, me, act, counts, office } = useStore();
  if (tab === 'Calendar') {
    const marks = new Map(
      events.filter((e) => e.date.startsWith('2026-11')).map((e) => [+e.date.slice(8), e]),
    );
    return (
      <div className="bento">
        <section className="panel c6">
          <div className="row between">
            <h2 className="h3">November 2026</h2>
            <span className="label">Sun → Sat</span>
          </div>
          <ol className="cal" aria-label="November 2026">
            {Array.from({ length: 30 }, (_, i) => {
              const d = i + 1,
                e = marks.get(d);
              return (
                <li
                  key={d}
                  className={`${e ? 'has' : ''} ${d === 12 ? 'today' : ''}`}
                  title={e?.title}
                >
                  {d}
                </li>
              );
            })}
          </ol>
          <button
            className="btn sm line"
            onClick={() => {
              const ics =
                'BEGIN:VCALENDAR\nVERSION:2.0\n' +
                events
                  .map(
                    (e) =>
                      `BEGIN:VEVENT\nUID:${e.id}@fecpc\nDTSTART:${e.date.replace(/-/g, '')}T${e.time.replace(':', '')}00\nSUMMARY:${e.title}\nLOCATION:${e.place}\nEND:VEVENT`,
                  )
                  .join('\n') +
                '\nEND:VCALENDAR';
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
              a.download = 'fecpc.ics';
              a.click();
            }}
          >
            Download .ics for your calendar
          </button>
        </section>
        <section className="panel c6">
          <p className="label">This month</p>
          <div className="list">
            {[...marks.values()].map((e) => (
              <div key={e.id}>
                <span className="mono acc" style={{ width: 28 }}>
                  {e.date.slice(8)}
                </span>
                <span className="grow">
                  <strong>{e.title}</strong>
                  <br />
                  <span className="label">
                    {e.time} · {e.place}
                  </span>
                </span>
                {s.reg.includes(e.id) && <span className="pill ok">going</span>}
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
  if (tab === 'Volunteer')
    return (
      <div className="stack">
        <p className="label">
          Contest day · 18 December · volunteers earn the Perfect Attendance track
        </p>
        <div className="list">
          {volunteerShifts.map(([n, t, need, have]) => {
            const k = 'vol:' + n,
              on = s.present.includes(k),
              filled = have + (counts.vol[k] ?? 0);
            return (
              <div key={n}>
                <span className="grow">
                  <strong>{n}</strong>
                  <br />
                  <span className="label">
                    {t} · {filled}/{need} filled
                  </span>
                </span>
                <div
                  className="meter"
                  style={css({ '--v': `${(filled / need) * 100}%`, width: '120px' })}
                >
                  <i />
                </div>
                <button
                  className={`btn xs ${on ? 'line' : ''}`}
                  disabled={!on && filled >= need}
                  onClick={() => act('toggle', { list: 'present', id: k })}
                >
                  {on ? 'Signed up ✓' : filled >= need ? 'Full' : 'Sign up'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  if (tab === 'Feedback')
    return (
      <form
        className="panel"
        style={{ maxWidth: 560 }}
        onSubmit={(e) => {
          e.preventDefault();
          const body = String(new FormData(e.currentTarget).get('body') ?? '').trim();
          act('vote', { poll: 'fb:freshers', option: s.kv.rate ?? '5' }).then((ok) => {
            if (ok && body) act('send', { kind: 'feedback', body });
          });
        }}
      >
        <p className="label">Freshers&apos; Cup 2026</p>
        {s.votes['fb:freshers'] ? (
          <p className="h3 ok">Thanks. You rated it {s.votes['fb:freshers']}/5.</p>
        ) : (
          <div className="stack" style={css({ '--g': '14px' })}>
            <div
              className="row"
              role="radiogroup"
              aria-label="Rating"
              style={css({ '--g': '6px' })}
            >
              {['1', '2', '3', '4', '5'].map((v) => (
                <button
                  type="button"
                  key={v}
                  role="radio"
                  aria-checked={(s.kv.rate ?? '5') === v}
                  className={`tag tab ${(s.kv.rate ?? '5') === v ? 'on' : ''}`}
                  onClick={() => act('kv', { key: 'rate', value: v })}
                >
                  {v}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="label">What should change next time?</span>
              <textarea name="body" className="input" maxLength={1000} style={{ minHeight: 88 }} />
            </label>
            <button className="btn sm" style={{ alignSelf: 'flex-start' }}>
              Send feedback
            </button>
          </div>
        )}
      </form>
    );
  if (tab === 'Organiser') {
    const ev = office.events;
    return (
      <div className="bento">
        <section className="panel c6">
          <p className="label">Registrations through the platform</p>
          <ol className="list">
            {events.map((e) => (
              <li key={e.id}>
                <Link className="grow" href={`/app/events/${e.id}`}>
                  {e.title}
                </Link>
                {ev?.event === e.id && <span className="pill ok">code {ev.code}</span>}
                <span className="mono acc">{ev?.registrants[e.id]?.length ?? 0}</span>
              </li>
            ))}
          </ol>
        </section>
        <section className="panel c6">
          <p className="label">Feedback and applications · {office.feedback?.length ?? 0}</p>
          {office.feedback?.length ? (
            <ol className="list">
              {office.feedback.map((f, i) => (
                <li key={i} className="ev-fb">
                  <span className="grow">{f.body}</span>
                  <span className="label">
                    {fmtDate(f.at.slice(0, 10), { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">Nothing yet.</p>
          )}
        </section>
      </div>
    );
  }
  if (tab === 'Certificates') {
    const mine = certificates.filter((c) => c.name === me.name);
    return (
      <div className="bento">
        {mine.length === 0 && (
          <div className="panel c8">
            <p className="h3">No certificates yet.</p>
            <p className="body">Win, volunteer or finish a course and one appears here.</p>
          </div>
        )}
        {mine.map((c) => (
          <section key={c.code} className="panel c8">
            <div className="row between">
              <div>
                <p className="label">
                  {fmtDate(c.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <h2 className="h3">{c.what}</h2>
                <p className="mono">{c.code}</p>
              </div>
              <QR text={`https://fecpc.example/verify?code=${c.code}`} size={110} />
            </div>
            <div className="row no-print">
              <button className="btn sm" onClick={() => print()}>
                Print
              </button>
              <Link className="btn sm line" href={`/verify?code=${c.code}`}>
                Public verification page
              </Link>
            </div>
          </section>
        ))}
      </div>
    );
  }
  return null;
}
