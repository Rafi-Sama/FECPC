'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { MarkdownBody, excerptFromMarkdown, relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import type { UnifiedAnnouncement } from './AnnouncementModal';

const Chevron = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="nb-chev">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.75" />
  </svg>
);

function Ack({ done, onAck }: { done: boolean; onAck: () => void }) {
  return done ? (
    <span className="nb-ack is-done">
      <Check /> Acknowledged
    </span>
  ) : (
    <button
      type="button"
      className="btn sm nb-ack"
      onClick={(e) => {
        e.stopPropagation();
        onAck();
      }}
    >
      Acknowledge
    </button>
  );
}

function Readers({ read, total }: { read: number; total: number }) {
  const pct = Math.min(100, Math.round((read / total) * 100));
  return (
    <div className="nb-readers" aria-label={`Read by ${read} of ${total}`}>
      <span className="nb-readers__bar" aria-hidden>
        <i style={{ '--v': `${pct}%` } as CSSProperties} />
      </span>
      <span className="nb-readers__n">
        {read} of {total} read
      </span>
    </div>
  );
}

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
};

export function AnnouncementBoard({
  items,
  isRead,
  readCount,
  onMarkRead,
  onOpen,
  isOfficer,
  memberTotal,
}: {
  items: UnifiedAnnouncement[];
  isRead: (id: string) => boolean;
  readCount: (a: UnifiedAnnouncement) => number;
  onMarkRead: (id: string) => void;
  onOpen: (a: UnifiedAnnouncement) => void;
  isOfficer: boolean;
  memberTotal: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const pinned = items.filter((a) => a.pinned);
  const log = items.filter((a) => !a.pinned);

  const toggle = (a: UnifiedAnnouncement) => {
    const next = openId === a.id ? null : a.id;
    setOpenId(next);
    // Must-reads are acknowledged explicitly; everything else counts as read once opened.
    if (next && !a.requires_ack && !isRead(a.id)) onMarkRead(a.id);
  };

  const onKey = (e: React.KeyboardEvent, a: UnifiedAnnouncement) => {
    const order = log.map((x) => x.id);
    const i = order.indexOf(a.id);
    const go = (j: number) => {
      const id = order[Math.max(0, Math.min(order.length - 1, j))];
      if (id) rowRefs.current.get(id)?.focus();
    };
    const keys: Record<string, () => void> = {
      j: () => go(i + 1),
      ArrowDown: () => go(i + 1),
      k: () => go(i - 1),
      ArrowUp: () => go(i - 1),
    };
    const run = keys[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  if (items.length === 0) return <p className="empty">No announcements match this filter.</p>;

  return (
    <div className="nb">
      {pinned.map((a) => {
        const read = isRead(a.id);
        return (
          <article key={a.id} className={`nb-lead${read ? '' : ' is-new'}`}>
            <p className="nb-lead__meta">
              <span>Pinned</span>
              {a.requires_ack && <span className="nb-must">Must read</span>}
              <span>{relTime(a.at)}</span>
            </p>
            <button type="button" className="nb-lead__title" onClick={() => onOpen(a)}>
              {a.title}
            </button>
            {a.body_md && <p className="nb-lead__body">{excerptFromMarkdown(a.body_md)}</p>}
            <div className="nb-lead__foot">
              <span className="nb-by">
                <TierAvatar name={a.by} solved={a.by_solved} avatarUrl={a.by_avatar} size={24} />
                <TierName name={a.by} solved={a.by_solved} />
                <span className="nb-dim">{a.scope}</span>
              </span>
              <span className="nb-lead__acts">
                {isOfficer && <Readers read={readCount(a)} total={memberTotal} />}
                {a.requires_ack ? (
                  <Ack done={read} onAck={() => onMarkRead(a.id)} />
                ) : (
                  <button type="button" className="btn sm line" onClick={() => onOpen(a)}>
                    Read
                  </button>
                )}
              </span>
            </div>
          </article>
        );
      })}

      {log.length > 0 && (
        <ol className="nb-log">
          {log.map((a) => {
            const read = isRead(a.id);
            const open = openId === a.id;
            const { day, mon } = fmtDay(a.at);
            return (
              <li key={a.id} className={`nb-item${read ? '' : ' is-new'}${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) rowRefs.current.set(a.id, el);
                    else rowRefs.current.delete(a.id);
                  }}
                  className="nb-row"
                  aria-expanded={open}
                  aria-controls={`nb-body-${a.id}`}
                  onClick={() => toggle(a)}
                  onKeyDown={(e) => onKey(e, a)}
                >
                  <span className="nb-date" aria-hidden>
                    <b>{day}</b> {mon}
                  </span>
                  <span className="nb-row__main">
                    <span className="nb-row__title">
                      {!read && <span className="sr">Unread: </span>}
                      {a.title}
                    </span>
                    <span className="nb-row__meta">
                      <TierName name={a.by} solved={a.by_solved} />
                      <span>{a.scope}</span>
                      <span>{relTime(a.at)}</span>
                      {a.requires_ack && <span className="nb-must">Must read</span>}
                    </span>
                  </span>
                  {isOfficer && (
                    <span className="nb-row__count" aria-hidden>
                      {readCount(a)}/{memberTotal}
                    </span>
                  )}
                  <Chevron />
                </button>
                <div className="nb-body" id={`nb-body-${a.id}`} role="region" aria-label={a.title}>
                  <div className="nb-body__inner">
                    {open && (
                      <>
                        <div className="nb-body__md">
                          <MarkdownBody markdown={a.body_md || '—'} />
                        </div>
                        <div className="nb-body__foot">
                          {a.requires_ack && <Ack done={read} onAck={() => onMarkRead(a.id)} />}
                          <button type="button" className="btn xs line" onClick={() => onOpen(a)}>
                            Open
                          </button>
                          {isOfficer && <Readers read={readCount(a)} total={memberTotal} />}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
