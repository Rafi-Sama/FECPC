import { fmtDate } from '@fecpc/content/site';
import type { PublicEvent } from '@fecpc/contracts';

export default function EventRow({ e }: { e: PublicEvent }) {
  const date = e.startsAt.slice(0, 10);
  const left = e.seats === null ? null : e.seats - e.taken;
  return (
    <article className="ev" id={e.id}>
      <time dateTime={date} className="ev-date">
        <span className="d">{fmtDate(date, { day: '2-digit' })}</span>
        <span className="label">
          {fmtDate(date, { month: 'short' })} · {fmtDate(date, { weekday: 'short' })}
        </span>
      </time>
      <div className="stack" style={{ '--g': '10px', minWidth: 0 } as React.CSSProperties}>
        <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
          <span className="tag on">{e.type}</span>
          <span className="tag">{e.startsAt.slice(11)}</span>
          <span className="tag">{e.fee ? `৳${e.fee}` : 'Free'}</span>
        </div>
        <h3 className="h3">{e.title}</h3>
        <p className="body">{e.about.split('\n')[0]}</p>
        <p className="label">{e.place}</p>
      </div>
      {e.seats !== null && (
        <div className="ev-seats">
          <div
            className="meter"
            style={{ '--v': `${(e.taken / e.seats) * 100}%` } as React.CSSProperties}
          >
            <i />
          </div>
          <span className="label">
            {left! > 0 ? `${left} of ${e.seats} seats left` : 'Waitlist open'}
          </span>
        </div>
      )}
    </article>
  );
}
