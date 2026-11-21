'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useCanLeave } from '@/components/app/SaveBar';
import { EventsCalendar } from '@/components/app/events/EventsExtra';
import { EventForm } from '@/components/app/events/EventForm';
import { useStore } from '@/components/app/Store';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';
import { can, EVENT_STATUS_LABEL, type ClubEvent } from '@fecpc/contracts';
import { bannerStyle, fmtWhen, liveStatus, useEventsQuery } from '@/lib/events';

const TAGS = ['All', 'Class', 'Contest', 'Social'] as const;
const STATUS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Declined',
  cancelled: 'Withdrawn',
};

export default function EventsPage() {
  const { s } = useStore();
  const organiser = !!can(s.roles, 'event.publish');
  // "New event" is a separate primary button, not one of the browsing tabs.
  const tabs = ['Upcoming', 'My events', 'Past', 'Calendar'] as const;
  const [tab, setTab] = useState<(typeof tabs)[number] | 'New event'>('Upcoming');
  const canLeave = useCanLeave();
  const [tag, setTag] = useState<(typeof TAGS)[number]>('All');
  const [q, setQ] = useState('');
  const { data, reload } = useEventsQuery<ClubEvent[]>({ action: 'list' });
  const events = useMemo(() => data ?? [], [data]);
  const query = q.trim().toLowerCase();
  const listed = tab === 'Upcoming' || tab === 'My events' || tab === 'Past';
  // an event that started over a day ago is past even if nobody marked it completed
  const over = (e: ClubEvent) =>
    e.status === 'completed' ||
    e.status === 'cancelled' ||
    e.startsAt < new Date(Date.now() - 864e5).toISOString().slice(0, 16);

  const list = useMemo(
    () =>
      events
        .filter(
          (e) =>
            (tab === 'My events'
              ? e.mine.some((x) => x.status !== 'cancelled')
              : tab === 'Past'
                ? over(e)
                : !over(e)) &&
            (tag === 'All' ||
              (tag === 'Social'
                ? e.type === 'Social' || e.type === 'Hackathon'
                : e.type === tag)) &&
            (!query || `${e.title} ${e.about} ${e.place} ${e.type}`.toLowerCase().includes(query)),
        )
        .sort((a, b) => (tab === 'Upcoming' ? 1 : -1) * a.startsAt.localeCompare(b.startsAt)),
    [events, tab, tag, query],
  );

  return (
    <Page
      title={
        <>
          Events<span className="acc">.</span>
        </>
      }
      aside={
        <div className="row ev-head-actions">
          {/* Phones: the sections fold into one dropdown beside the title. */}
          <select
            className="input sm ev-mob-only"
            aria-label="Section"
            value={tab}
            onChange={(e) => canLeave() && setTab(e.target.value as typeof tab)}
          >
            {tabs.map((t) => (
              <option key={t}>{t}</option>
            ))}
            {organiser && <option>New event</option>}
          </select>
          {organiser && (
            <button
              type="button"
              data-nav
              className="btn sm b ev-new"
              aria-pressed={tab === 'New event'}
              onClick={() => setTab('New event')}
            >
              + New event
            </button>
          )}
        </div>
      }
    >
      <div className="ev-desk-only">
        <Tabs
          tabs={tabs}
          value={tab === 'New event' ? ('' as (typeof tabs)[number]) : tab}
          onChange={setTab}
        />
      </div>

      {listed && (
        <div className="row ev-filter">
          <input
            type="search"
            className="input grow"
            aria-label="Search events"
            placeholder="Search events, places, topics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input sm ev-mob-only"
            aria-label="Filter by type"
            value={tag}
            onChange={(e) => setTag(e.target.value as (typeof TAGS)[number])}
          >
            {TAGS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <div className="row ev-desk-only" role="group" aria-label="Filter by type">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tag === t}
                className={`tag ${tag === t ? 'on' : ''}`}
                onClick={() => setTag(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'Calendar' && <EventsCalendar events={events} isOver={over} />}
      {tab === 'New event' && (
        <section className="panel">
          <h2 className="h3" style={{ marginBottom: 24 }}>
            New event
          </h2>
          <EventForm
            saved={() => {
              void reload();
              setTab('Upcoming');
            }}
          />
        </section>
      )}
      {listed && (
        <div className="ev-grid">
          {list.map((e, i) => {
            const left = e.seats === null ? null : Math.max(0, e.seats - e.taken);
            const mine = e.mine.filter((x) => x.status !== 'cancelled');
            return (
              <article
                key={e.id}
                className="bx ev-tile"
                style={{ '--i': i } as React.CSSProperties}
              >
                <Link
                  href={`/app/events/${e.id}`}
                  className="ban"
                  data-type={e.type}
                  style={bannerStyle(e.banner)}
                >
                  {!e.banner && (
                    <span>
                      <HighlightMatch text={e.title} query={q} />
                    </span>
                  )}
                </Link>
                <div className="ev-body">
                  <div className="row">
                    <span className="tag b">{e.type}</span>
                    <span className="tag">{fmtWhen(e.startsAt)}</span>
                    {(organiser || e.status !== 'published') && (
                      <span className="tag k">{liveStatus(e) ?? EVENT_STATUS_LABEL[e.status]}</span>
                    )}
                  </div>
                  <h2 className="h3">
                    <Link href={`/app/events/${e.id}`}>
                      <HighlightMatch text={e.title} query={q} />
                    </Link>
                  </h2>
                  {e.about && (
                    <p className="body">
                      <HighlightMatch text={e.about.split('\n')[0]!.slice(0, 200)} query={q} />
                    </p>
                  )}
                  <p className="label">
                    {[
                      e.place,
                      e.fee > 0 && `৳${e.fee}`,
                      e.mode === 'form'
                        ? 'Google Form'
                        : left !== null && !over(e) && (left ? `${left} seats left` : 'full'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {mine.length > 0 && (
                    <div className="row">
                      {mine.map((x) => (
                        <span key={x.id} className={`pill ${x.status === 'approved' ? 'ok' : ''}`}>
                          {e.roles.find((r) => r.id === x.roleId)?.title ?? 'Participant'} ·{' '}
                          {STATUS[x.status]}
                        </span>
                      ))}
                      {e.certs && mine.some((x) => x.status === 'approved') && (
                        <span className="pill ok">Certificates open</span>
                      )}
                    </div>
                  )}
                  <Link
                    className="btn sm line"
                    href={`/app/events/${e.id}`}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {tab === 'Past' && e.status === 'completed' && mine.length
                      ? 'Feedback and certificates'
                      : 'Details'}
                  </Link>
                </div>
              </article>
            );
          })}
          {data !== undefined && list.length === 0 && (
            <p className="empty">
              {tab === 'My events'
                ? 'You have not signed up for anything yet.'
                : 'Nothing matches.'}
            </p>
          )}
        </div>
      )}
    </Page>
  );
}
