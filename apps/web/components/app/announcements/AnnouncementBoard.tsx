'use client';
import { useRef } from 'react';
import { excerptFromMarkdown, relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import type { UnifiedAnnouncement } from './AnnouncementModal';

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
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const pinned = items.filter((a) => a.pinned);
  const log = items.filter((a) => !a.pinned);

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
    <div className="ann-board">
      {pinned.map((a) => {
        const read = isRead(a.id);
        const count = readCount(a);
        const pct = memberTotal > 0 ? Math.min(100, Math.round((count / memberTotal) * 100)) : 0;
        return (
          <article
            key={a.id}
            className={`announcement-card${read ? '' : ' is-unread'}`}
            tabIndex={0}
            role="button"
            aria-label={a.title}
            onClick={() => onOpen(a)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(a);
              }
            }}
          >
            <div className="card-meta-top mono">
              {!read && <span className="badge-unread">● Unread</span>}
              <span className="badge-pinned">Pinned</span>
              {a.requires_ack && <span className="badge-must-read">Must Read</span>}
              <span>{relTime(a.at)}</span>
            </div>
            <h2>{a.title}</h2>
            {a.body_md && <p className="card-excerpt">{excerptFromMarkdown(a.body_md)}</p>}
            <div className="card-author">
              <TierAvatar name={a.by} solved={a.by_solved} avatarUrl={a.by_avatar} size={36} />
              <div>
                <div className="author-name">
                  <TierName name={a.by} solved={a.by_solved} />
                </div>
                <div className="audience-tag">{a.scope}</div>
              </div>
            </div>
            <div className="card-footer">
              {isOfficer ? (
                <div
                  className="progress-container"
                  aria-label={`Read by ${count} of ${memberTotal}`}
                >
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="progress-text">
                    {count}/{memberTotal} Acknowledged
                  </span>
                </div>
              ) : (
                <div />
              )}
              <div>
                {a.requires_ack ? (
                  read ? (
                    <div className="mono ann-ack-done">✓ Acknowledged</div>
                  ) : (
                    <button
                      type="button"
                      className="ann-ack-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(a.id);
                      }}
                    >
                      Acknowledge
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="ann-read-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(a);
                    }}
                  >
                    Read
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {log.length > 0 && (
        <section className="list-view">
          {log.map((a) => {
            const read = isRead(a.id);
            const { day, mon } = fmtDay(a.at);
            const count = readCount(a);
            return (
              <div
                key={a.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(a.id, el);
                  else rowRefs.current.delete(a.id);
                }}
                className={`list-item${read ? '' : ' is-unread'}`}
                tabIndex={0}
                role="button"
                aria-label={a.title}
                onClick={() => onOpen(a)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(a);
                  } else {
                    onKey(e, a);
                  }
                }}
              >
                <div className="list-date mono">
                  {day} {mon}
                </div>
                <div>
                  <div className="list-title">
                    {!read && <span className="list-unread-dot" aria-label="Unread" />}
                    {a.title}
                  </div>
                  <div className="list-meta">
                    {!read && <span className="badge-unread">Unread</span>}
                    <span className="list-author">
                      <TierName name={a.by} solved={a.by_solved} />
                    </span>
                    <span>{a.scope}</span>
                    {a.requires_ack && <span className="badge-must-read">Must Read</span>}
                  </div>
                </div>
                {isOfficer && (
                  <div className="list-progress">
                    {count}/{memberTotal}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default AnnouncementBoard;
