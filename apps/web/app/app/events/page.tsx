'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { EventsExtra } from '@/components/app/events/EventsExtra';
import { useStore } from '@/components/app/Store';
import { events, fmtDate, pastContests } from '@fecpc/content/site';
import { can } from '@fecpc/contracts';
import { eventTicketCode, getBannerTitle } from '@/lib/event-details';
import { HighlightMatch } from '@/components/app/alumni/HighlightMatch';

const TAGS = ['All', 'Class', 'Contest', 'Social'] as const;

export default function EventsPage() {
  const { s, me, act, counts } = useStore();
  const tabs = [
    'Upcoming',
    'My events',
    'Past',
    'Calendar',
    'Volunteer',
    'Feedback',
    'Certificates',
    ...(can(s.roles, 'event.publish') ? (['Organiser'] as const) : []),
  ] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>('Upcoming');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('All');
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const listed = tab === 'Upcoming' || tab === 'My events' || tab === 'Past';

  const list = useMemo(
    () =>
      events.filter(
        (e) =>
          (tab !== 'My events' || s.reg.includes(e.id)) &&
          (tag === 'All' ||
            (tag === 'Social' ? e.type === 'Social' || e.type === 'Hackathon' : e.type === tag)) &&
          (!query || `${e.title} ${e.blurb} ${e.place} ${e.type}`.toLowerCase().includes(query)),
      ),
    [tab, tag, query, s.reg],
  );
  const past = useMemo(
    () =>
      tag === 'All' || tag === 'Contest'
        ? pastContests.filter((c) =>
            `${c.name} ${c.winner} ${c.topics.join(' ')}`.toLowerCase().includes(query),
          )
        : [],
    [tag, query],
  );

  return (
    <Page
      title={
        <>
          Events<span className="acc">.</span>
        </>
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

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
          <div className="row" role="group" aria-label="Filter by type">
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

      {!listed ? (
        <EventsExtra tab={tab} />
      ) : (
        <div className="ev-grid">
          {tab === 'Past'
            ? past.map((c, i) => (
                <article
                  key={c.id}
                  className="bx ev-tile"
                  style={{ '--i': i } as React.CSSProperties}
                >
                  <div className="ban" data-type="Contest">
                    <span>
                      <HighlightMatch text={c.name.replace('Weekly Club ', '')} query={q} />
                    </span>
                  </div>
                  <div className="ev-body">
                    <div className="row">
                      <span className="tag">
                        {fmtDate(c.date, { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="tag k">Ended</span>
                    </div>
                    <p className="body">
                      Winner @<HighlightMatch text={c.winner} query={q} /> · {c.teams} entered ·{' '}
                      {c.solved} solved
                    </p>
                    <div className="row">
                      {c.topics.map((t) => (
                        <span key={t} className="chip">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            : list.map((e, i) => {
                const going = s.reg.includes(e.id);
                const left = Math.max(0, e.seats - e.taken - (counts.reg[e.id] ?? 0));
                return (
                  <article
                    key={e.id}
                    className="bx ev-tile"
                    style={{ '--i': i } as React.CSSProperties}
                  >
                    <Link href={`/app/events/${e.id}`} className="ban" data-type={e.type}>
                      <span>
                        <HighlightMatch text={getBannerTitle(e)} query={q} />
                      </span>
                    </Link>
                    <div className="ev-body">
                      <div className="row">
                        <span className="tag b">{e.type}</span>
                        <span className="tag">
                          {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                          {e.time}
                        </span>
                      </div>
                      <h2 className="h3">
                        <Link href={`/app/events/${e.id}`}>
                          <HighlightMatch text={e.title} query={q} />
                        </Link>
                      </h2>
                      <p className="body">
                        <HighlightMatch text={e.blurb} query={q} />
                      </p>
                      <p className="label">
                        {e.place}
                        {e.fee > 0 && ` · ৳${e.fee}`} · {left ? `${left} seats left` : 'full'}
                      </p>
                      {going ? (
                        <div className="dash">
                          <span className="grow">
                            <span className="label">Going · ticket</span>
                            <br />
                            <span className="mono acc ev-ticket">{eventTicketCode(e)}</span>
                          </span>
                          <button
                            className="btn sm line"
                            type="button"
                            onClick={() => act('toggle', { list: 'reg', id: e.id, on: false })}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="row">
                          <button
                            className="btn sm b"
                            type="button"
                            disabled={!left || me.system}
                            onClick={() => act('toggle', { list: 'reg', id: e.id, on: true })}
                          >
                            {left ? 'Register' : 'Full'}
                          </button>
                          <Link className="btn sm line" href={`/app/events/${e.id}`}>
                            Details
                          </Link>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
          {(tab === 'Past' ? past : list).length === 0 && (
            <p className="empty">
              {tab === 'My events'
                ? 'You have not registered for anything yet.'
                : 'Nothing matches.'}
            </p>
          )}
        </div>
      )}
    </Page>
  );
}
