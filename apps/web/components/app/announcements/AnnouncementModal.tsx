'use client';
import { useEffect, useRef } from 'react';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import {
  annModalBackdrop,
  annModal,
  annModalHeader,
  annCloseBtn,
  annModalBody,
  badgePinned,
  badgeMustRead,
  annBackdrop,
} from '@/components/app/announcements/ui';

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
      className={`${annBackdrop} ${annModalBackdrop}`}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className={`ann-modal ${annModal} read-modal`}>
        <div
          className={`ann-modal-header flex justify-between items-center p-[1.25rem_1.5rem] ${annModalHeader}`}
        >
          <div className="card-author flex items-center gap-[0.75rem] mb-0">
            <TierAvatar
              name={item.by}
              solved={item.by_solved}
              avatarUrl={item.by_avatar}
              size={48}
            />
            <div>
              <div className="font-bold [color:var(--ann-text)] text-[1.1rem]">
                <TierName name={item.by} solved={item.by_solved} />
              </div>
              <div className="mono ann-modal-meta mt-[0.25rem]">{metaLine}</div>
            </div>
          </div>
          <div className="flex items-center gap-[0.75rem] ml-auto">
            {onDelete && (
              <button
                type="button"
                className="[border:1px_solid_var(--ann-red)] t-b:border-[#dc2626] t-d:border-[#f87171] t-d:hover:border-[#dc2626] py-[0.35rem] px-[0.75rem] [background:transparent] [font-family:var(--ann-font-mono)] text-[0.75rem] font-bold cursor-pointer [color:var(--ann-red)] uppercase [transition:background_0.15s,_color_0.15s,_border-color_0.15s] [.t-b_&]:text-[#dc2626] [.t-b_&:hover]:[background:#dc2626] [.t-b_&:hover]:text-[#ffffff] [.t-d_&]:text-[#f87171] [.t-d_&:hover]:[background:#dc2626] [.t-d_&:hover]:text-[#ffffff]"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              className={`ann-close-btn [border:var(--ann-border-thick)] ${annCloseBtn}`}
              aria-label="Close"
              onClick={onClose}
            >
              &times;
            </button>
          </div>
        </div>

        <div className={`ann-modal-body p-[1.5rem] max-[601px]:p-[1.25rem] ${annModalBody}`}>
          <div className="flex items-center gap-[0.75rem] [color:var(--ann-muted)] mono mb-[1rem]">
            {item.pinned && <span className={`${badgePinned}`}>Pinned</span>}
            {item.requires_ack && <span className={`${badgeMustRead}`}>Must Read</span>}
          </div>

          <h2 className="mb-[1rem] text-[2rem] leading-[1.1] font-extrabold [color:var(--ann-text)]">
            {titlePrefix}
            {item.title}
          </h2>

          <div className="read-content [&_p]:mb-[1rem] [&_ul]:mb-[1rem] [&_ul]:pl-[1.5rem] [&_ul]:[list-style-type:disc] [&_li]:mb-[0.5rem] [&_strong]:[font-weight:700] text-[1.05rem] leading-[1.6] [color:var(--ann-text)]">
            {item.body_md.trim() ? <MarkdownBody markdown={item.body_md} /> : <p>{item.title}</p>}
            {item.edited_at && (
              <span className="mono text-[0.75rem] mt-[1rem] text-[color:var(--ann-muted)] block">
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
