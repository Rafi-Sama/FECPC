import { fmtDate } from '@fecpc/content/site';
import type { PublicEvent } from '@fecpc/contracts';

export default function EventRow({ e }: { e: PublicEvent }) {
  const date = e.startsAt.slice(0, 10);
  const left = e.seats === null ? null : e.seats - e.taken;
  return (
    <article
      className="py-7 px-0 [display:grid] grid-cols-[96px_minmax(0,1fr)] gap-[20px_28px] border-t border-t-line [&:last-of-type]:border-b [&:last-of-type]:border-b-line [&_.meter]:h-1 max-[521px]:grid-cols-[1fr]"
      id={e.id}
    >
      <time
        dateTime={date}
        className="flex flex-col gap-1.5 [&_.d]:text-[56px] [&_.d]:leading-[0.9] [&_.d]:font-medium [&_.d]:tracking-[-0.05em] [&_.d]:text-acc max-[521px]:flex-row max-[521px]:items-baseline max-[521px]:gap-3"
      >
        <span className="d">{fmtDate(date, { day: '2-digit' })}</span>
        <span className="label">
          {fmtDate(date, { month: 'short' })} · {fmtDate(date, { weekday: 'short' })}
        </span>
      </time>
      <div className="stack [--g:10px] min-w-0">
        <div className="row [--g:8px]">
          <span className="tag on">{e.type}</span>
          <span className="tag">{e.startsAt.slice(11)}</span>
          <span className="tag">{e.fee ? `৳${e.fee}` : 'Free'}</span>
        </div>
        <h3 className="h3">{e.title}</h3>
        <p className="body">{e.about.split('\n')[0]}</p>
        <p className="label">{e.place}</p>
      </div>
      {e.seats !== null && (
        <div className="col-[2] flex flex-col gap-2 max-w-80 max-[521px]:col-[1]">
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
