'use client';
import { useEffect, useRef } from 'react';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';

export type UnifiedAnnouncement = {
  id: string;
  title: string;
  body_md: string;
  by: string;
  by_role: string | null;
  by_solved: number;
  by_avatar: string | null;
  scope: string;
  at: string;
  edited_at: string | null;
  pinned: boolean;
  requires_ack: boolean;
  read_count: number;
};

function formatFullTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date}, ${time}`;
}

export function AnnouncementModal({
  item,
  alreadyRead,
  onMarkRead,
  onClose,
  onDelete,
}: {
  item: UnifiedAnnouncement | null;
  alreadyRead: boolean;
  onMarkRead: (id: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const markedRef = useRef<string | null>(null);

  // Opening the modal marks the announcement read (idempotent, server awards +3 XP first time only).
  useEffect(() => {
    if (!item) {
      markedRef.current = null;
      return;
    }
    if (!alreadyRead && markedRef.current !== item.id) {
      markedRef.current = item.id;
      onMarkRead(item.id);
    }
  }, [item, alreadyRead, onMarkRead]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [item, onClose]);

  if (!item) return null;

  const channelLabel = item.by_role
    ? `#announcements · ${item.by_role}`
    : `#announcements · ${item.scope}`;
  const hasLeadingEmoji = /^\p{Extended_Pictographic}/u.test(item.title.trim());
  const titlePrefix = hasLeadingEmoji ? '' : item.pinned ? '📌 ' : '🎯 ';

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className="cm-modal discord">
        <header className="cm-modal-head">
          <TierAvatar name={item.by} solved={item.by_solved} avatarUrl={item.by_avatar} size={40} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
              <TierName name={item.by} solved={item.by_solved} />
              {item.pinned && (
                <span className="pill" style={{ fontSize: 11, padding: '1px 6px' }}>
                  Pinned
                </span>
              )}
              {item.requires_ack && (
                <span className="pill warn" style={{ fontSize: 11, padding: '1px 6px' }}>
                  Must read
                </span>
              )}
            </div>
            <div className="cm-meta" style={{ marginTop: 2 }}>
              <span>{channelLabel}</span>
              <span>· {formatFullTimestamp(item.at)}</span>
            </div>
          </div>
          {onDelete && (
            <button type="button" className="btn xs line" onClick={onDelete}>
              Delete
            </button>
          )}
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <h2 className="h2" style={{ fontSize: 'clamp(22px, 2.4vw, 28px)', lineHeight: 1.2 }}>
          {titlePrefix}
          {item.title}
        </h2>

        <hr className="rule" />

        <div className="stack" style={{ '--g': '12px' } as React.CSSProperties}>
          {item.body_md.trim() ? (
            <MarkdownBody markdown={item.body_md} />
          ) : (
            <p className="body">{item.title}</p>
          )}
          {item.edited_at && (
            <span className="label" style={{ fontSize: 11 }}>
              (edited)
            </span>
          )}
        </div>
      </article>
    </div>
  );
}

export default AnnouncementModal;
