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
        <div className="row ev-head-actions items-center [--g:8px]">
          {/* Phones: the sections fold into one dropdown beside the title. */}
          <select
            className="input sm hidden max-[641px]:block"
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
      <div className="max-[641px]:hidden">
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
      </div>

      {listed && (
        <div className="ev-filter flex-wrap [@media(max-width:640px)]:flex-nowrap [@media(max-width:640px)]:[--g:8px]">
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
          <div
            className="ev-toggles [&_button+button]:[border-left:1px_solid_var(--ink)] [&_button]:p-[0_14px] [&_button]:min-h-[40px] [&_button]:[font:500_14px_var(--sans,sans-serif)] [&_button]:text-ink [&_button]:[background:var(--panel)] [&_button]:[border:0] [&_button]:cursor-pointer [&_button:hover]:[background:color-mix(in_srgb,var(--acc)_10%,var(--panel))] [&_button[aria-pressed='true']]:[background:var(--acc)] [&_button[aria-pressed='true']]:text-white flex [border:2px_solid_var(--ink)]"
            role="group"
            aria-label="Only show"
          >
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
        <div className="[display:grid] gap-5 items-stretch grid-cols-[repeat(auto-fill,_minmax(min(100%,_320px),_1fr))]">
          {shown.map((e, i) => {
            const left = e.seats === null ? null : Math.max(0, e.seats - e.taken);
            const mine = e.mine.filter((x) => x.status !== 'cancelled');
            return (
              <article
                key={e.id}
                className="bx [background:var(--panel,_#f5f3ec)] [.t-b_&]:[background:#f5f3ec] ev-tile flex flex-col min-h-[380px] [animation:page-rise_0.4s_ease-out_both] [animation-delay:calc(var(--i,_0)_*_50ms)] [transition:transform_0.2s_ease,_box-shadow_0.2s_ease] hover:[transform:translateY(-3px)] hover:[box-shadow:6px_6px_0_var(--line2)]"
                style={{ '--i': i % 24 } as React.CSSProperties}
              >
                <Link
                  href={`/app/events/${e.id}`}
                  className="ban flex items-end flex-none h-[120px] overflow-hidden [&[data-type='Class']]:[--hue:#2f5bff] [&[data-type='Contest']]:[--hue:#f2541b] [&[data-type='Workshop']]:[--hue:#0f9d58] [&[data-type='Seminar']]:[--hue:#7c4dff] [&[data-type='ICPC_prep']]:[--hue:#c98a00] [&[data-type='Social']]:[--hue:#d6266f] [&[data-type='Hackathon']]:[--hue:#d6266f]"
                  data-type={e.type}
                  style={bannerStyle(e.banner)}
                >
                  {!e.banner && (
                    <span>
                      <HighlightMatch text={e.title} query={q} />
                    </span>
                  )}
                </Link>
                <div className="[&>.body]:[display:-webkit-box] [&>.body]:[-webkit-box-orient:vertical] [&>.body]:[-webkit-line-clamp:3] [&>.body]:overflow-hidden [&>.btn:last-child]:mt-auto [&_h2_a]:[text-decoration:none] [&_h2_a:hover]:text-acc p-4.5 flex gap-3 flex-col flex-1">
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
                      <p key={x.id} className="bad text-[14px]">
                        Declined: {x.reason}
                      </p>
                    ))}
                  <Link className="btn sm line self-start" href={`/app/events/${e.id}`}>
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
          className="btn sm line self-center mt-4"

          onClick={() => setFull(true)}
        >
          Show all upcoming events
        </button>
      )}
    </Page>
  );
}
