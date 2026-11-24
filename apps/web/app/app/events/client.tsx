'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useCanLeave } from '@/components/app/SaveBar';
import { EventsCalendar } from '@/components/app/events/EventsExtra';
import { useStore } from '@/components/app/Store';
import { useMore } from '@/components/site/More';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';
import { can, EVENT_STATUS_LABEL, EVENT_TYPES, type ClubEvent } from '@fecpc/contracts';
import {
  bannerStyle,
  clubNow,
  fmtWhen,
  isOver as over,
  liveStatus,
  eventsQuery,
  useEventsQuery,
} from '@/lib/events';

const TAGS = ['All', ...EVENT_TYPES] as const;
const WHEN = { 'Any time': 0, 'Next 7 days': 7, 'Next 30 days': 30 } as const;
const ONLY = ['Sign-up open', 'Free', 'Seats left'] as const;
const PAST_ONLY = ['Free'] as const;
const STATUS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Declined',
  cancelled: 'Withdrawn',
};

export default function EventsPage({ upcoming }: { upcoming?: ClubEvent[] }) {
  const { s } = useStore();
  const organiser = !!can(s.roles, 'event.publish');
  const tabs = ['Upcoming', 'My events', 'Past', 'Calendar'] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>('Upcoming');
  const canLeave = useCanLeave();
  const [tag, setTag] = useState<(typeof TAGS)[number]>('All');
  const [q, setQ] = useState('');
  const [when, setWhen] = useState<keyof typeof WHEN>('Any time');
  const [only, setOnly] = useState<(typeof ONLY)[number][]>([]);
  // The server sends what is still to come (the first tab); every event, past ones included, loads on the first
  // visit to another tab. Without a server copy, the upcoming list loads here.
  const [all, setAll] = useState<ClubEvent[] | null>();
  // The server sends one screen of upcoming events; the rest loads when the member asks for more, filters or
  // searches (loading it unasked was a long task on every visit).
  const [full, setFull] = useState(!upcoming);
  const soon = useEventsQuery<ClubEvent[]>(
    full ? { action: 'list', upcoming: true } : { action: 'list', upcoming: true, limit: 24 },
    full ? undefined : upcoming,
  );
  useEffect(() => {
    if (tab !== 'Upcoming' && all === undefined)
      void eventsQuery<ClubEvent[]>({ action: 'list' }).then(setAll);
  }, [tab, all]);
  const data = tab === 'Upcoming' ? soon.data : all;
  const events = useMemo(() => data ?? [], [data]);
  const query = q.trim().toLowerCase();
  useEffect(() => {
    if (query || tag !== 'All' || when !== 'Any time' || only.length) setFull(true);
  }, [query, tag, when, only]);
  const listed = tab === 'Upcoming' || tab === 'My events' || tab === 'Past';
  const days = WHEN[when];
  const until = days && tab === 'Upcoming' ? clubNow(-days * 864e5) : null;
  // sign-up and seats mean nothing once an event is over
  const toggles: readonly (typeof ONLY)[number][] = tab === 'Past' ? PAST_ONLY : ONLY;

  const list = useMemo(() => {
    const on = only.filter((o) => toggles.includes(o));
    return events
      .filter(
        (e) =>
          (tab === 'My events'
            ? e.mine.some((x) => x.status !== 'cancelled')
            : tab === 'Past'
              ? over(e)
              : !over(e)) &&
          (tag === 'All' || e.type === tag) &&
          (!until || e.startsAt <= until) &&
          (!on.includes('Sign-up open') ||
            (e.mode === 'platform' ? e.regOpen : e.status === 'open')) &&
          (!on.includes('Free') || e.fee === 0) &&
          (!on.includes('Seats left') || e.seats === null || e.taken < e.seats) &&
          (!query || `${e.title} ${e.about} ${e.place} ${e.type}`.toLowerCase().includes(query)),
      )
      .sort((a, b) => (tab === 'Upcoming' ? 1 : -1) * a.startsAt.localeCompare(b.startsAt));
  }, [events, tab, tag, query, until, only, toggles]);
  const [shown, more] = useMore(list, 24);

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
          </select>
          {organiser && (
            <Link className="btn sm b" href="/app/events/new">
              + New event
            </Link>
          )}
        </div>
      }
    >
      <div className="ev-desk-only">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      {listed && (
        <div className="ev-filter">
          <input
            type="search"
            className="input ev-search"
            aria-label="Search events"
            placeholder="Search events, places, topics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            aria-label="Type"
            value={tag}
            onChange={(e) => setTag(e.target.value as (typeof TAGS)[number])}
          >
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All types' : t}
              </option>
            ))}
          </select>
          {tab === 'Upcoming' && (
            <select
              className="input"
              aria-label="When"
              value={when}
              onChange={(e) => setWhen(e.target.value as keyof typeof WHEN)}
            >
              {Object.keys(WHEN).map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          )}
          <div className="ev-toggles" role="group" aria-label="Only show">
            {toggles.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={only.includes(o)}
                onClick={() =>
                  setOnly(only.includes(o) ? only.filter((x) => x !== o) : [...only, o])
                }
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'Calendar' && <EventsCalendar events={events} />}
      {listed && (
        <div className="ev-grid">
          {shown.map((e, i) => {
            const left = e.seats === null ? null : Math.max(0, e.seats - e.taken);
            const mine = e.mine.filter((x) => x.status !== 'cancelled');
            return (
              <article
                key={e.id}
                className="bx ev-tile"
                style={{ '--i': i % 24 } as React.CSSProperties}
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
                  {mine
                    .filter((x) => x.status === 'rejected' && x.reason)
                    .map((x) => (
                      <p key={x.id} className="bad" style={{ fontSize: 14 }}>
                        Declined: {x.reason}
                      </p>
                    ))}
                  <Link
                    className="btn sm line"
                    href={`/app/events/${e.id}`}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {e.status === 'completed' && mine.some((x) => x.status === 'approved')
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
      {listed && more}
      {tab === 'Upcoming' && !full && events.length >= 24 && (
        <button
          type="button"
          className="btn sm line"
          style={{ alignSelf: 'center', marginTop: 16 }}
          onClick={() => setFull(true)}
        >
          Show all upcoming events
        </button>
      )}
    </Page>
  );
}
