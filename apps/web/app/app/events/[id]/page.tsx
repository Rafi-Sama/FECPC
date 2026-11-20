'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import QR from '@/components/app/QR';
import { useStore } from '@/components/app/Store';
import { events, fmtDate } from '@fecpc/content/site';
import { eventTicketCode, getEventDetails } from '@/lib/event-details';

export default function EventDetailPage() {
  const params = useParams();
  const rawId =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';
  const id = rawId || 'weekly-42';
  const event =
    events.find((e) => e.id === id) || events.find((e) => e.id === 'weekly-42') || events[0];

  const { s, me, act, counts } = useStore();

  const [applyRole, setApplyRole] = useState('judge');
  const [cfHandle, setCfHandle] = useState(s.handle || me?.handle || '');
  const [whyYou, setWhyYou] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const details = getEventDetails(event);
  const isGoing = s.reg.includes(event.id) || event.id === 'weekly-42';
  const takenCount = event.taken + (counts.reg[event.id] ?? 0);
  const seatsLeft = Math.max(0, event.seats - takenCount);
  const ticketCode = eventTicketCode(event);

  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    await act('send', {
      kind: 'feedback',
      body: `[Event Application: ${event.title} - ${applyRole}] Applicant: ${me?.name} (Batch ${me?.batch}). CF: ${cfHandle}. Why: ${whyYou}`,
    });
    setSubmitted(true);
  };

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Breadcrumb matching Detail.dc.html */}
      <p className="m" style={{ margin: 0 }}>
        <Link href="/app/events" style={{ color: 'inherit', textDecoration: 'none' }}>
          Events
        </Link>{' '}
        / {event.title}
      </p>

      {/* Hero Banner inside .bx matching Detail.dc.html */}
      {/* TODO: The banner section shall contain image not the title */}
      <div className="bx">
        <div className="ban" style={{ height: 220 }}>
          <span style={{ fontSize: 56 }}>{event.title}</span>
        </div>
      </div>

      {/* 2-Column Split matching Detail.dc.html */}
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left Column (flex: 2) */}
        <div style={{ flex: 2, minWidth: 340, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="row">
            <span className="tag b">{event.type}</span>
            <span className="tag">
              {fmtDate(event.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
              {event.time}
            </span>
            <span className="tag">{event.place.split(',')[0]}</span>
            <span className="tag">Members</span>
          </div>

          <h1 style={{ fontSize: 44, letterSpacing: '-.03em', margin: 0, lineHeight: 1.15 }}>
            {details.headline}
          </h1>

          <div
            className="bx"
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              lineHeight: 1.6,
            }}
          >
            <h2 style={{ fontSize: 22, margin: 0 }}>About</h2>
            <p style={{ margin: 0 }}>{details.about}</p>

            <h2 style={{ fontSize: 22, margin: 0 }}>Schedule</h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <th>Time</th>
                  <th>What</th>
                </tr>
                {details.schedule.map((row) => (
                  <tr key={row.time}>
                    <td>{row.time}</td>
                    <td>{row.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 style={{ fontSize: 22, margin: 0 }}>Organisers</h2>
            <p style={{ margin: 0 }}>{details.organisersDesc}</p>
          </div>
        </div>

        {/* Right Sticky Aside matching Detail.dc.html */}
        <aside
          style={{
            flex: 1,
            minWidth: 300,
            position: 'sticky',
            top: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Opportunities Box matching Detail.dc.html */}
          <div
            className="bx"
            style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="m">Opportunities</div>

            {/* Participate Card */}
            <div
              style={{
                border: '1px solid var(--ink, #0b0b0b)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>Participate</b>
                {isGoing ? (
                  <span className="tag k">Going</span>
                ) : (
                  <button
                    className="btn b"
                    style={{ minHeight: 32, padding: '0 14px', fontSize: 13 }}
                    type="button"
                    onClick={() => act('toggle', { list: 'reg', id: event.id, on: true })}
                  >
                    Register
                  </button>
                )}
              </div>
              <p className="m" style={{ margin: 0 }}>
                {seatsLeft} of {event.seats} left · closes{' '}
                {fmtDate(event.date, { day: 'numeric', month: 'short' })} 18:00
              </p>
              {isGoing && (
                <div className="dash">
                  <div className="qr">
                    <QR text={`FECPC ticket ${event.id}`} size={52} />
                  </div>
                  <div
                    style={{
                      font: "500 20px 'JetBrains Mono', monospace",
                      color: 'var(--acc, #1a30ff)',
                    }}
                  >
                    {ticketCode}
                  </div>
                </div>
              )}
            </div>

            {/* Judge */}
            <div
              style={{
                border: '1px solid var(--ink, #0b0b0b)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <b>{details.role2Title}</b>
              <p className="m" style={{ margin: 0 }}>
                {details.role2Sub}
              </p>
              <button
                className="btn b"
                type="button"
                onClick={() => setApplyRole(details.role2Title)}
              >
                Apply
              </button>
            </div>

            {/* Volunteer */}
            <div
              style={{
                border: '1px solid var(--ink, #0b0b0b)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <b>Volunteer</b>
              <p className="m" style={{ margin: 0 }}>
                3 left · desk and monitoring
              </p>
              <button className="btn" type="button" onClick={() => setApplyRole('Volunteer')}>
                Apply
              </button>
            </div>
          </div>

          {/* Apply Form Box matching Detail.dc.html */}
          <div
            className="bx"
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderColor: 'var(--acc, #1a30ff)',
            }}
          >
            <div className="m">Apply as {applyRole.toLowerCase()} · name and batch prefilled</div>
            <label className="m" htmlFor="a">
              Codeforces handle
            </label>
            <input
              id="a"
              placeholder="your_handle"
              value={cfHandle}
              onChange={(e) => setCfHandle(e.target.value)}
            />
            <label className="m" htmlFor="b">
              Why you?
            </label>
            <textarea id="b" rows={3} value={whyYou} onChange={(e) => setWhyYou(e.target.value)} />
            <button className="btn b" type="button" onClick={submitApplication}>
              {submitted ? 'Application submitted ✓' : 'Submit application'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
