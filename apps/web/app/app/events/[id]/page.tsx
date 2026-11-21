'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import { EventAdmin } from '@/components/app/events/EventAdmin';
import { SignUp } from '@/components/app/events/SignUp';
import { useStore } from '@/components/app/Store';
import { EVENT_STATUS_LABEL, type EventDetail } from '@fecpc/contracts';
import { bannerStyle, fmtWhen, renderCertificate, useEventsQuery } from '@/lib/events';

const CERT_NAME: Record<string, string> = {
  participant: 'Participation',
  winner1: '1st place',
  winner2: '2nd place',
  winner3: '3rd place',
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: e, reload } = useEventsQuery<EventDetail>({ action: 'event', id });
  if (e === null) notFound();
  if (!e) return <div className="page" aria-busy="true" />;

  const entry = (roleId: number | null) => e.mine.find((x) => x.roleId === roleId);
  const tookPart = e.mine.some((x) => x.status === 'approved');
  const over = e.status === 'completed' || e.status === 'cancelled';
  const left = e.seats === null ? null : Math.max(0, e.seats - e.taken);
  const certName = (k: string) =>
    CERT_NAME[k] ?? e.roles.find((r) => `role:${r.id}` === k)?.title ?? k;

  return (
    <div className="page ev-detail">
      <p className="label">
        <Link href="/app/events">Events</Link> / {e.title}
      </p>
      <div className="ban ev-hero" data-type={e.type} style={bannerStyle(e.banner)}>
        {!e.banner && <span>{e.title}</span>}
      </div>

      <div className="ev-split">
        <div className="stack">
          <div className="row">
            <span className="tag b">{e.type}</span>
            <span className="tag">{fmtWhen(e.startsAt)}</span>
            {e.place && <span className="tag">{e.place}</span>}
            {e.fee > 0 && <span className="tag">৳{e.fee}</span>}
            <span className="tag k">{EVENT_STATUS_LABEL[e.status]}</span>
          </div>
          <h1 className="h2">{e.title}</h1>
          {e.about && (
            <section className="panel">
              <p className="body" style={{ whiteSpace: 'pre-line' }}>
                {e.about}
              </p>
            </section>
          )}
          {e.admin && <EventAdmin e={e} reload={reload} />}
        </div>

        <aside className="stack ev-aside">
          {e.certificates.length ? (
            <section className="panel stack ev-card">
              <b>Your certificates</b>
              {e.certificates.map((c) => (
                <div key={c.code} className="stack">
                  <span>
                    {certName(c.kind)} <span className="label mono">{c.code}</span>
                  </span>
                  <div className="row">
                    {(['png', 'jpeg'] as const).map((t) => (
                      <button
                        key={t}
                        className="btn sm"
                        type="button"
                        onClick={() => renderCertificate(c.html, t, `${e.id}-${c.code}`)}
                      >
                        {t === 'png' ? 'PNG' : 'JPG'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <section className="panel stack ev-card">
              <div className="row between">
                <b>Participate</b>
                {e.mode === 'platform' && left !== null && (
                  <span className="label">
                    {left} of {e.seats} left
                  </span>
                )}
              </div>
              <SignUp
                eventId={e.id}
                mode={e.mode}
                formUrl={e.formUrl}
                fields={e.fields}
                entry={entry(null)}
                open={e.regOpen && left !== 0}
                closedText={left === 0 && e.regOpen ? 'Full.' : 'Registration is not open.'}
                done={reload}
              />
              {e.fee > 0 && entry(null)?.status === 'approved' && (
                <Link className="btn sm line" href="/app/finance">
                  Pay ৳{e.fee}
                </Link>
              )}
            </section>
          )}

          {e.status === 'completed' && tookPart && <FeedbackForm e={e} done={reload} />}
          {['open', 'closed', 'ongoing'].includes(e.status) &&
            (e.admin || entry(null)?.status === 'approved') && <CheckIn e={e} />}

          {!over &&
            e.roles.map((r) => (
              <section key={r.id} className="panel stack ev-card">
                <b>{r.title}</b>
                {r.about && <span className="label">{r.about}</span>}
                <SignUp
                  eventId={e.id}
                  roleId={r.id}
                  mode={r.mode}
                  formUrl={r.formUrl}
                  fields={r.fields}
                  entry={entry(r.id)}
                  open={['published', 'open', 'closed'].includes(e.status)}
                  closedText="Applications are closed."
                  done={reload}
                />
              </section>
            ))}
        </aside>
      </div>
    </div>
  );
}

/** The room code on the projector marks you present (+XP). Organisers see the code here. */
function CheckIn({ e }: { e: EventDetail }) {
  const { s, act } = useStore();
  const [code, setCode] = useState('');
  const room = e.admin?.checkin;
  const approved = e.mine.some((x) => x.roleId === null && x.status === 'approved');
  return (
    <form
      className="panel stack ev-card"
      onSubmit={async (x) => {
        x.preventDefault();
        if (await act('attend', { eventId: e.id, code })) setCode('');
      }}
    >
      <b>Check in</b>
      {room && (
        <div className="ev-code">
          <span className="label">Room code</span>
          <span className="mono">{room.code}</span>
          <span className="label">{room.arrived} checked in</span>
        </div>
      )}
      {!approved ? null : s.present.includes(e.id) ? (
        <p className="ok">You are checked in.</p>
      ) : (
        <div className="row">
          <input
            className="input grow"
            aria-label="Room code"
            placeholder="Code on the projector"
            value={code}
            maxLength={12}
            onChange={(x) => setCode(x.target.value)}
          />
          <button className="btn sm" disabled={code.trim().length < 4}>
            Check in
          </button>
        </div>
      )}
    </form>
  );
}

function FeedbackForm({ e, done }: { e: EventDetail; done: () => void }) {
  const { act } = useStore();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  if (e.feedback)
    return (
      <section className="panel ev-card">
        <p className="ok">Thanks. You rated it {e.feedback.rating}/5.</p>
      </section>
    );
  return (
    <form
      className="panel stack ev-card"
      onSubmit={async (x) => {
        x.preventDefault();
        if (await act('eventFeedback', { eventId: e.id, rating, body })) done();
      }}
    >
      <b>How was it?</b>
      <div className="row" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={rating === v}
            className={`tag tab ${rating === v ? 'on' : ''}`}
            onClick={() => setRating(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <textarea
        className="input"
        aria-label="What should change next time?"
        placeholder="What should change next time?"
        rows={3}
        maxLength={2000}
        value={body}
        onChange={(x) => setBody(x.target.value)}
      />
      <button className="btn sm">Send feedback</button>
    </form>
  );
}
