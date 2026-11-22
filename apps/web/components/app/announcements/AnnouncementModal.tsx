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
  return `${date}`;
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

  const roleOrScope = item.by_role || item.scope || 'Everyone';
  const metaLine = `#Announcements · ${roleOrScope} · ${formatFullTimestamp(item.at)}`;
  const hasLeadingEmoji = /^\p{Extended_Pictographic}/u.test(item.title.trim());
  const titlePrefix = hasLeadingEmoji ? '' : item.pinned ? '📌 ' : '🎯 ';

  return (
    <div
      className="cm-backdrop ann-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className="ann-modal read-modal">
        <div className="ann-modal-header">
          <div className="card-author" style={{ marginBottom: 0 }}>
            <TierAvatar
              name={item.by}
              solved={item.by_solved}
              avatarUrl={item.by_avatar}
              size={48}
            />
            <div>
              <div className="author-name" style={{ fontSize: '1.1rem' }}>
                <TierName name={item.by} solved={item.by_solved} />
              </div>
              <div className="mono ann-modal-meta" style={{ marginTop: '0.25rem' }}>
                {metaLine}
              </div>
            </div>
          </div>
          <div className="ann-modal-actions">
            {onDelete && (
              <button type="button" className="ann-btn-del" onClick={onDelete}>
                Delete
              </button>
            )}
            <button type="button" className="ann-close-btn" aria-label="Close" onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        <div className="ann-modal-body">
          <div className="card-meta-top mono" style={{ marginBottom: '1rem' }}>
            {item.pinned && <span className="badge-pinned">Pinned</span>}
            {item.requires_ack && <span className="badge-must-read">Must Read</span>}
          </div>

          <h2 className="read-title">
            {titlePrefix}
            {item.title}
          </h2>

          <div className="read-content">
            {item.body_md.trim() ? <MarkdownBody markdown={item.body_md} /> : <p>{item.title}</p>}
            {item.edited_at && (
              <span
                className="mono"
                style={{
                  fontSize: '0.75rem',
                  marginTop: '1rem',
                  color: 'var(--ann-muted)',
                  display: 'block',
                }}
              >
                (edited)
              </span>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

export default AnnouncementModal;
