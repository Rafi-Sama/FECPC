import { type ClubEvent, fmtDate } from "@/lib/data";

export default function EventRow({ e }: { e: ClubEvent }) {
  const left = e.seats - e.taken;
  return (
    <article className="ev" id={e.id}>
      <time dateTime={e.date} className="ev-date"><span className="d">{fmtDate(e.date, { day: "2-digit" })}</span><span className="label">{fmtDate(e.date, { month: "short" })} · {fmtDate(e.date, { weekday: "short" })}</span></time>
      <div className="stack" style={{ "--g": "10px", minWidth: 0 } as React.CSSProperties}>
        <div className="row" style={{ "--g": "8px" } as React.CSSProperties}><span className="tag on">{e.type}</span><span className="tag">{e.time}</span><span className="tag">{e.fee ? `৳${e.fee}` : "Free"}</span></div>
        <h3 className="h3">{e.title}</h3>
        <p className="body">{e.blurb}</p>
        <p className="label">{e.place}</p>
      </div>
      <div className="ev-seats">
        <div className="meter" style={{ "--v": `${(e.taken / e.seats) * 100}%` } as React.CSSProperties}><i /></div>
        <span className="label">{left > 0 ? `${left} of ${e.seats} seats left` : "Waitlist open"}</span>
      </div>
    </article>
  );
}
