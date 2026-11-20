'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import QR from '@/components/app/QR';
import { EventsExtra } from '@/components/app/events/EventsExtra';
import { useStore } from '@/components/app/Store';
import { events, fmtDate, pastContests } from '@fecpc/content/site';
import { eventTicketCode, getBannerTitle } from '@/lib/event-details';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';

export default function EventsPage() {
  const router = useRouter();
  const { s, act, counts } = useStore();
  const [tab, setTab] = useState<'Upcoming' | 'My events' | 'Past' | 'Calendar'>('Upcoming');
  const [activeTag, setActiveTag] = useState<'All tags' | 'Class' | 'Contest' | 'Social'>(
    'All tags',
  );
  const [q, setQ] = useState('');

  const filteredEvents = useMemo(() => {
    let list = events;
    if (tab === 'My events') {
      list = list.filter((e) => s.reg.includes(e.id));
    }
    if (activeTag !== 'All tags') {
      list = list.filter((e) => {
        if (activeTag === 'Social') return e.type === 'Social' || e.type === 'Hackathon';
        return e.type === activeTag;
      });
    }
    if (q.trim()) {
      const search = q.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          e.blurb.toLowerCase().includes(search) ||
          e.place.toLowerCase().includes(search) ||
          e.type.toLowerCase().includes(search),
      );
    }
    return list;
  }, [tab, activeTag, q, s.reg]);

  const filteredPastContests = useMemo(() => {
    if (activeTag !== 'All tags' && activeTag !== 'Contest') return [];
    const search = q.trim().toLowerCase();
    if (!search) return pastContests;

    return pastContests.filter((contest) =>
      `${contest.name} ${contest.winner} ${contest.topics.join(' ')}`
        .toLowerCase()
        .includes(search),
    );
  }, [activeTag, q]);

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: '48px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Design Header: events. with accent dot */}
      <h1 style={{ fontSize: 72, letterSpacing: '-.04em', margin: 0, lineHeight: 1 }}>
        events<span style={{ color: 'var(--acc, #1a30ff)' }}>.</span>
      </h1>

      {/* Filter Row matching Main.dc.html design */}
      <div className="row">
        <button
          className={`tag ${tab === 'Upcoming' ? 'b' : ''}`}
          type="button"
          onClick={() => setTab('Upcoming')}
        >
          Upcoming
        </button>
        <button
          className={`tag ${tab === 'My events' ? 'b' : ''}`}
          type="button"
          onClick={() => setTab('My events')}
        >
          My events
        </button>
        <button
          className={`tag ${tab === 'Past' ? 'b' : ''}`}
          type="button"
          onClick={() => setTab('Past')}
        >
          Past
        </button>
        <button
          className={`tag ${tab === 'Calendar' ? 'b' : ''}`}
          type="button"
          onClick={() => setTab('Calendar')}
        >
          Calendar
        </button>
        <span style={{ flex: 1 }} />
        <button
          className={`tag ${activeTag === 'All tags' ? 'b' : ''}`}
          type="button"
          onClick={() => setActiveTag('All tags')}
        >
          All tags
        </button>
        <button
          className={`tag ${activeTag === 'Class' ? 'b' : ''}`}
          type="button"
          onClick={() => setActiveTag('Class')}
        >
          Class
        </button>
        <button
          className={`tag ${activeTag === 'Contest' ? 'b' : ''}`}
          type="button"
          onClick={() => setActiveTag('Contest')}
        >
          Contest
        </button>
        <button
          className={`tag ${activeTag === 'Social' ? 'b' : ''}`}
          type="button"
          onClick={() => setActiveTag('Social')}
        >
          Social
        </button>
      </div>

      {/* Search Bar Panel matching Main.dc.html */}
      <div
        className="bx"
        style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <label className="m" htmlFor="c" style={{ position: 'absolute', left: -9999 }}>
          Search events
        </label>
        <input
          id="c"
          className="ev-field"
          placeholder="Search events, tags or organisers"
          style={{ flex: 1, minWidth: 280 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="button">
          Search
        </button>
      </div>

      {/* Main Grid View */}
      {tab === 'Calendar' ? (
        <div className="bx" style={{ padding: 24 }}>
          <EventsExtra tab="Calendar" />
        </div>
      ) : tab === 'Past' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {filteredPastContests.map((pc) => (
            <article key={pc.id} className="bx">
              <div className="ban" style={{ height: 130 }}>
                <span>
                  <HighlightMatch text={pc.name.replace('Weekly Club ', '')} query={q} />
                </span>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="row">
                  <span className="tag b">Contest</span>
                  <span className="tag">
                    {fmtDate(pc.date, { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="tag k">Ended</span>
                </div>
                <h2 style={{ fontSize: 24, margin: 0 }}>
                  <HighlightMatch text={pc.name} query={q} />
                </h2>
                <p style={{ lineHeight: 1.5, margin: 0 }}>
                  Winner: @<HighlightMatch text={pc.winner} query={q} />. {pc.teams} contestants
                  entered. {pc.solved} problems solved.
                </p>
                <p className="m" style={{ margin: 0 }}>
                  Codeforces Group
                </p>
                <div className="row">
                  {pc.topics.map((t) => (
                    <span key={t} className="chip">
                      <HighlightMatch text={t} query={q} />
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
          {filteredPastContests.length === 0 && (
            <div className="bx" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
              <h2 style={{ fontSize: 22, margin: 0 }}>No past events found</h2>
              <p className="m" style={{ marginTop: 10 }}>
                Try clearing your search or filters.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {filteredEvents.map((e) => {
            const isGoing = s.reg.includes(e.id);
            const takenCount = e.taken + (counts.reg[e.id] ?? 0);
            const seatsLeft = Math.max(0, e.seats - takenCount);
            const isFull = takenCount >= e.seats;
            const bannerTitle = getBannerTitle(e);
            const ticketCode = eventTicketCode(e);

            const seatsText = isFull ? 'full · waitlist 4' : `${seatsLeft} left`;
            const secChipText =
              e.type === 'Contest'
                ? 'Judge · 1 left'
                : e.type === 'Class'
                  ? 'Volunteer · 3 left'
                  : 'Volunteer · 2 left';

            return (
              <article key={e.id} className="bx">
                {/* TODO: Banner section shall contain banner image not title */}
                <div className="ban" style={{ height: 130 }}>
                  <span>
                    <HighlightMatch text={bannerTitle} query={q} />
                  </span>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="row">
                    <span className="tag b">{e.type === 'Hackathon' ? 'Social' : e.type}</span>
                    <span className="tag">
                      {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                      {e.time}
                    </span>
                    {isGoing && <span className="tag k">Going</span>}
                  </div>
                  <h2 style={{ fontSize: 24, margin: 0 }}>
                    <HighlightMatch text={e.title} query={q} />
                  </h2>
                  <p style={{ lineHeight: 1.5, margin: 0 }}>
                    <HighlightMatch text={e.blurb} query={q} />
                  </p>
                  <p className="m" style={{ margin: 0 }}>
                    <HighlightMatch text={e.place} query={q} />
                    {e.fee > 0 ? ' · Paid event' : ''}
                  </p>
                  <div className="row">
                    <button
                      className="chip"
                      type="button"
                      onClick={() => router.push(`/app/events/${e.id}`)}
                    >
                      Participate · {seatsText}
                    </button>
                    <button
                      className="chip"
                      type="button"
                      onClick={() => router.push(`/app/events/${e.id}`)}
                    >
                      {secChipText}
                    </button>
                  </div>

                  {isGoing ? (
                    <div className="dash">
                      <div className="qr">
                        <QR text={`FECPC ticket ${e.id}`} size={52} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="m">Your ticket</div>
                        <div
                          style={{
                            font: "500 22px 'JetBrains Mono', monospace",
                            color: 'var(--acc, #1a30ff)',
                          }}
                        >
                          {ticketCode}
                        </div>
                      </div>
                      <button
                        className="btn o"
                        type="button"
                        onClick={() => act('toggle', { list: 'reg', id: e.id, on: false })}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/app/events/${e.id}`}
                      className={`btn ${e.fee > 0 ? 'o' : ''}`}
                      style={{ textDecoration: 'none', textAlign: 'center' }}
                    >
                      View event
                    </Link>
                  )}
                </div>
              </article>
            );
          })}

          {filteredEvents.length === 0 && (
            <div className="bx" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
              <h2 style={{ fontSize: 22, margin: 0 }}>No events found</h2>
              <p className="m" style={{ marginTop: 10 }}>
                Try clearing your search or filters.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
