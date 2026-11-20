'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';
import QR from '@/components/app/QR';
import { useStore } from '@/components/app/Store';
import { events, fmtDate } from '@fecpc/content/site';
import { can } from '@fecpc/contracts';
import { eventTicketCode, getEventDetails } from '@/lib/event-details';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const event = events.find((e) => e.id === id);
  const { s, me, act, counts, office } = useStore();
  const [role, setRole] = useState('');
  const [why, setWhy] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  if (!event) notFound();

  const details = getEventDetails(event);
  const going = s.reg.includes(event.id);
  const here = s.present.includes(event.id);
  const left = Math.max(0, event.seats - event.taken - (counts.reg[event.id] ?? 0));
  const organiser = !!can(s.roles, 'event.publish');
  const names = office.events?.registrants[event.id] ?? [];
  const live = office.events?.event === event.id;

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act('send', {
      kind: 'feedback',
      body: `[Application: ${event.title} · ${role}] ${me.name}, batch ${me.batch}: ${why.trim()}`,
    });
    if (ok) setSent(true);
  };

  return (
    <div className="page ev-detail">
      <p className="label">
        <Link href="/app/events">Events</Link> / {details.bannerTitle}
      </p>
      <div className="ban ev-hero" data-type={event.type}>
        <span>{details.bannerTitle}</span>
      </div>

      <div className="ev-split">
        <div className="stack">
          <div className="row">
            <span className="tag b">{event.type}</span>
            <span className="tag">
              {fmtDate(event.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {event.time}
            </span>
            <span className="tag">{event.place.split(',')[0]}</span>
            {event.fee > 0 && <span className="tag">৳{event.fee}</span>}
          </div>
          <h1 className="h2">{details.headline}</h1>
          <section className="panel stack">
            <p className="body">{details.about}</p>
            <p className="label">Schedule</p>
            <ol className="list ev-sched">
              {details.schedule.map((r) => (
                <li key={r.time}>
                  <span className="mono acc">{r.time}</span>
                  <span>{r.what}</span>
                </li>
              ))}
            </ol>
            <p className="label">Organisers</p>
            <ul className="row">
              {details.organisers.map((o) => (
                <li key={o.name} className="chip">
                  {o.name} · {o.role}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="stack ev-aside">
          <section className="panel stack ev-card">
            <div className="row between">
              <b>Participate</b>
              <span className="label">
                {left} of {event.seats} left
              </span>
            </div>
            {going ? (
              <>
                <div className="dash">
                  <QR text={`FECPC ticket ${event.id}`} size={52} />
                  <span className="mono acc ev-ticket">{eventTicketCode(event)}</span>
                </div>
                {event.fee > 0 && (
                  <Link className="btn sm line" href="/app/finance">
                    Pay ৳{event.fee}
                  </Link>
                )}
                <button
                  className="btn sm line"
                  type="button"
                  onClick={() => act('toggle', { list: 'reg', id: event.id, on: false })}
                >
                  Cancel registration
                </button>
              </>
            ) : (
              <button
                className="btn sm b"
                type="button"
                disabled={left === 0 || me.system}
                onClick={() => act('toggle', { list: 'reg', id: event.id, on: true })}
              >
                {left === 0 ? 'Full' : 'Register'}
              </button>
            )}
          </section>

          {going && (
            <form
              className="panel stack ev-card"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await act('attend', { code })) setCode('');
              }}
            >
              <b>Check in</b>
              {here ? (
                <p className="ok">You are checked in. +20 XP</p>
              ) : (
                <div className="row">
                  <input
                    className="input grow"
                    aria-label="Room code"
                    placeholder="Code on the projector"
                    value={code}
                    maxLength={12}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <button className="btn sm" disabled={code.trim().length < 4}>
                    Check in
                  </button>
                </div>
              )}
            </form>
          )}

          <form className="panel stack ev-card" onSubmit={apply}>
            <b>Help run it</b>
            <div className="row" role="radiogroup" aria-label="Role">
              {[details.role2Title, 'Volunteer'].map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  className={`tag tab ${role === r ? 'on' : ''}`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="label">
              {role === 'Volunteer' ? 'desk and monitoring' : details.role2Sub}
            </span>
            {sent ? (
              <p className="ok">Sent. The organisers will reply.</p>
            ) : (
              <>
                <textarea
                  className="input"
                  aria-label="Why you?"
                  placeholder="Why you?"
                  rows={3}
                  maxLength={600}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                />
                <button className="btn sm" disabled={!role || why.trim().length < 3 || me.system}>
                  Apply
                </button>
              </>
            )}
          </form>

          {organiser && (
            <section className="panel stack ev-card ev-org">
              <div className="row between">
                <b>Organiser</b>
                <span className="label">{names.length} via platform</span>
              </div>
              {live && (
                <div className="ev-code">
                  <span className="label">Room code</span>
                  <span className="mono">{office.events!.code}</span>
                  <span className="label">{office.events!.arrived[event.id] ?? 0} checked in</span>
                </div>
              )}
              {names.length ? (
                <ol className="ev-names">
                  {names.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ol>
              ) : (
                <p className="empty">No registrations yet.</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
