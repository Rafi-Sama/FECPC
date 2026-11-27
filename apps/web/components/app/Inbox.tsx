'use client';
// One notification row, shared by the topbar dropdown and the inbox page. Colour and label carry the
// tone (urgent / to do / good news / update), so a glance tells which ones need the member.
import Link from 'next/link';
import { useState } from 'react';
import type { AppState, InboxTone } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { relTime } from '@/components/app/shared/MarkdownEditor';

type Note = AppState['inbox'][number];

export const TONES: Record<InboxTone, { label: string; rank: number }> = {
  urgent: { label: 'Urgent', rank: 0 },
  action: { label: 'To do', rank: 1 },
  good: { label: 'Good news', rank: 2 },
  info: { label: 'Update', rank: 3 },
};

/** Unread first, then by tone, then newest. */
export function sortInbox(inbox: Note[], read: string[]) {
  return [...inbox].sort(
    (a, b) =>
      +read.includes(a.id) - +read.includes(b.id) ||
      TONES[a.tone].rank - TONES[b.tone].rank ||
      (b.at ? Date.parse(b.at) : 0) - (a.at ? Date.parse(a.at) : 0),
  );
}

/** One-click answers on a notification; the action's handler re-checks permission. */
export function InboxActions({ n }: { n: Note }) {
  const { act } = useStore();
  const [busy, setBusy] = useState(false);
  if (!n.actions?.length) return null;
  return (
    <span className="row [--g:8px]">
      {n.actions.map((x) => (
        <button
          key={x.label}
          className="btn xs line"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await act(x.type, x.args); // once answered, the server leaves it out of the inbox
            setBusy(false);
          }}
        >
          {x.label}
        </button>
      ))}
    </span>
  );
}

export function InboxItem({ n, full }: { n: Note; full?: boolean }) {
  const { s, act } = useStore();
  const read = s.read.includes(n.id);
  const mark = (on: boolean) => act('toggle', { list: 'read', id: n.id, on });
  return (
    <div className="inbox-item" data-tone={n.tone} data-read={read || undefined}>
      <div className="inbox-meta">
        <span className="inbox-tone">{TONES[n.tone].label}</span>
        <span>· {n.cat}</span>
        {n.at && (
          <time dateTime={n.at} title={new Date(n.at).toLocaleString('en-GB')}>
            · {relTime(n.at)}
          </time>
        )}
        {!read && <i className="inbox-dot" aria-label="Unread" />}
      </div>
      {/* Opening a notification reads it. */}
      <Link href={n.href} className="inbox-text" onClick={() => !read && void mark(true)}>
        {n.text}
      </Link>
      {(n.actions?.length || full) && (
        <div className="row [--g:8px] flex-wrap">
          <InboxActions n={n} />
          {full && (
            <button
              className="inbox-mark"
              aria-label={`${read ? 'Mark unread' : 'Mark read'}: ${n.text}`}
              onClick={() => void mark(!read)}
            >
              {read ? 'Mark unread' : 'Mark read'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The colour key, so the tones are never a guess. */
export function ToneKey() {
  return (
    <div className="inbox-key" aria-label="Notification colours">
      {(Object.keys(TONES) as InboxTone[]).map((t) => (
        <span key={t} data-tone={t}>
          <i aria-hidden /> {TONES[t].label}
        </span>
      ))}
    </div>
  );
}
