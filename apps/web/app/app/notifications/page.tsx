'use client';
import { useMore } from '@/components/site/More';
import { useState } from 'react';
import { Page, Tabs } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { InboxItem, sortInbox, ToneKey } from '@/components/app/Inbox';

const FILTERS = ['All', 'Unread', 'Needs you', 'Updates'] as const;
type Filter = (typeof FILTERS)[number];

// Everything here is worked out on the server from real records (dues, decisions, announcements, requests from people).
export default function Inbox() {
  const { s, inbox, act } = useStore();
  const [filter, setFilter] = useState<Filter>('All');
  const unread = inbox.filter((n) => !s.read.includes(n.id));
  const shown = sortInbox(inbox, s.read).filter((n) =>
    filter === 'Unread'
      ? !s.read.includes(n.id)
      : filter === 'Needs you'
        ? n.tone === 'urgent' || n.tone === 'action'
        : filter === 'Updates'
          ? n.tone === 'good' || n.tone === 'info'
          : true,
  );
  const [page, more] = useMore(shown, 20, true);
  return (
    <Page
      title={
        unread.length ? (
          <>
            {unread.length} thing{unread.length > 1 ? 's' : ''}{' '}
            <span className="acc">need{unread.length > 1 ? '' : 's'} you.</span>
          </>
        ) : (
          <>
            Inbox <span className="acc">zero.</span>
          </>
        )
      }
      aside={
        unread.length > 0 && (
          <button className="btn sm line" onClick={() => act('readAll')}>
            Mark all read
          </button>
        )
      }
    >
      <div className="row between flex-wrap [--g:12px] mb-4 max-w-[820px]">
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <ToneKey />
      </div>
      <section className="panel max-w-[820px] p-0!">
        {shown.length === 0 ? (
          <p className="body p-5">
            {inbox.length === 0
              ? 'Nothing yet. Dues, decisions, announcements and requests from other members show up here.'
              : 'Nothing here.'}
          </p>
        ) : (
          page.map((n) => <InboxItem key={n.id} n={n} full />)
        )}
      </section>
      <div className="max-w-[820px] flex">{more}</div>
    </Page>
  );
}
