'use client';
import { useMore } from '@/components/site/More';
import { useRef } from 'react';
import { excerptFromMarkdown, relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import type { UnifiedAnnouncement } from './AnnouncementModal';
import { badgePinned, badgeMustRead } from '@/components/app/announcements/ui';

const badgeUnread =
  'py-[0.2rem] px-[0.55rem] [font-family:var(--ann-font-mono)] text-[0.7rem] font-extrabold uppercase [border-radius:2px] inline-flex items-center gap-1 [.t-b_&]:[background:var(--ann-blue)] [.t-b_&]:text-[#ffffff] [.t-d_&]:[background:var(--acc)] [.t-d_&]:text-on [.t-d_&]:[box-shadow:0_0_8px_rgba(255,_90,_31,_0.4)]'; // was .badge-unread

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
  const [logShown, logMore] = useMore(log, 15, true);

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
    <div className="flex flex-col">
      {pinned.map((a) => {
        const read = isRead(a.id);
        const count = readCount(a);
        const pct = memberTotal > 0 ? Math.min(100, Math.round((count / memberTotal) * 100)) : 0;
        return (
          <article
            key={a.id}
            className={`announcement-card p-[1.25rem] mb-[1.25rem] [background:var(--ann-surface)] cursor-pointer [transition:background_0.15s,_border-color_0.15s,_box-shadow_0.15s] text-left hover:[background:color-mix(in_srgb,_var(--ann-surface)_96%,_var(--ann-text))] hover:[outline:none] focus-visible:[background:color-mix(in_srgb,_var(--ann-surface)_96%,_var(--ann-text))] focus-visible:[outline:none] [.t-b_&:hover]:[background:#fafafa] [.t-b_&:focus-visible]:[background:#fafafa] [.t-d_&:hover]:[background:color-mix(in_srgb,_var(--panel)_92%,_var(--hi))] [.t-d_&:focus-visible]:[background:color-mix(in_srgb,_var(--panel)_92%,_var(--hi))] [.t-b_&&.is-unread]:[background:#f7faff] [.t-b_&&.is-unread]:[box-shadow:4px_4px_0_var(--ann-blue)] [.t-b_&&.is-unread:hover]:[background:#eef5ff] [.t-b_&&.is-unread:focus-visible]:[background:#eef5ff] [.t-d_&&.is-unread]:[background:color-mix(in_srgb,_var(--acc)_8%,_var(--panel))] [.t-d_&&.is-unread]:[box-shadow:4px_4px_0_rgba(255,_90,_31,_0.35)] [.t-d_&&&.is-unread:hover]:[background:color-mix(in_srgb,_var(--acc)_14%,_var(--panel))] [.t-d_&&&.is-unread:focus-visible]:[background:color-mix(in_srgb,_var(--acc)_14%,_var(--panel))] ${read ? '' : ' is-unread'}`}
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
            <div className="flex items-center gap-[0.75rem] [color:var(--ann-muted)] mb-[0.5rem] mono">
              {!read && (
                <span className={`badge-unread tracking-[0.5px] ${badgeUnread}`}>● Unread</span>
              )}
              <span className={`${badgePinned}`}>Pinned</span>
              {a.requires_ack && <span className={`${badgeMustRead}`}>Must Read</span>}
              <span>{relTime(a.at)}</span>
            </div>
            <h2>{a.title}</h2>
            {a.body_md && (
              <p className="mb-[1.25rem] [color:var(--ann-muted)] text-[1rem] leading-[1.6] [display:-webkit-box] overflow-hidden [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                {excerptFromMarkdown(a.body_md)}
              </p>
            )}
            <div className="card-author flex items-center gap-[0.75rem] mb-[1rem]">
              <TierAvatar name={a.by} solved={a.by_solved} avatarUrl={a.by_avatar} size={36} />
              <div>
                <div className="font-bold text-[0.9rem] [color:var(--ann-text)]">
                  <TierName name={a.by} solved={a.by_solved} />
                </div>
                <div className="[color:var(--ann-muted)] [font-family:var(--ann-font-mono)] text-[0.75rem]">
                  {a.scope}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-[1rem] [border-top:1px_solid_var(--line)] gap-[1rem] max-[601px]:items-start max-[601px]:gap-[1rem] [@media(max-width:600px)]:flex-col">
              {isOfficer ? (
                <div
                  className="flex items-center gap-[1rem] w-[60%] [@media(max-width:600px)]:w-full"
                  aria-label={`Read by ${count} of ${memberTotal}`}
                >
                  <div className="[flex-grow:1] h-[6px] bg-line [border-radius:3px] overflow-hidden">
                    <div
                      className="h-full [background-color:var(--ann-text)] [transition:width_0.3s_ease] [.t-d_&]:bg-acc"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="[font-family:var(--ann-font-mono)] text-[0.75rem] [color:var(--ann-muted)] whitespace-nowrap">
                    {count}/{memberTotal} Acknowledged
                  </span>
                </div>
              ) : (
                <div />
              )}
              <div>
                {a.requires_ack ? (
                  read ? (
                    <div className="mono [font-size:0.8rem] [color:var(--ann-muted)] [font-family:var(--ann-font-mono)] font-bold">
                      ✓ Acknowledged
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="[border:var(--ann-border-thick)] t-b:border-[#111111] t-d:border-acc t-d:hover:border-acc2 py-[0.4rem] px-[0.8rem] [background:var(--ann-text)] [color:var(--ann-surface)] [font-family:var(--ann-font-mono)] text-[0.75rem] font-bold cursor-pointer uppercase [transition:background_0.1s,_color_0.1s,_border-color_0.1s] [.t-b_&]:[background:#111111] [.t-b_&]:text-[#ffffff] [.t-d_&]:[background:var(--acc)] [.t-d_&]:text-on [.t-d_&:hover]:[background:var(--acc2)]"
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
                    className="ann-read-btn py-[0.4rem] px-[0.8rem] [background:transparent] [font-family:var(--ann-font-mono)] text-[0.75rem] font-bold cursor-pointer uppercase [color:var(--ann-text)] [transition:background_0.1s,_border-color_0.1s,_color_0.1s] hover:[color:var(--ann-blue)] [.t-d_&:hover]:text-acc"
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
        <section className="[border-top:var(--ann-border-thick)] mt-[1.5rem]">
          {logShown.map((a) => {
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
                className={`list-item [display:grid] gap-[0.75rem] p-[0.85rem_0.5rem] items-center t-b:[&.is-unread]:pl-[0.75rem] t-d:[&.is-unread]:pl-[0.75rem] max-[601px]:gap-[0.25rem] grid-cols-[76px_1fr_auto] [border-bottom:var(--ann-border-thin)] cursor-pointer [color:var(--ann-text)] [transition:background_0.15s,_border-left-color_0.15s,_padding-left_0.15s] hover:[background:color-mix(in_srgb,_var(--ann-surface)_94%,_var(--ann-text))] hover:[outline:none] focus-visible:[background:color-mix(in_srgb,_var(--ann-surface)_94%,_var(--ann-text))] focus-visible:[outline:none] [.t-b_&:hover]:[background:#f0f0f0] [.t-b_&:focus-visible]:[background:#f0f0f0] [.t-d_&:hover]:[background:color-mix(in_srgb,_var(--panel)_90%,_var(--hi))] [.t-d_&:focus-visible]:[background:color-mix(in_srgb,_var(--panel)_90%,_var(--hi))] [.t-b_&&.is-unread]:[border-left:4px_solid_var(--ann-blue)] [.t-b_&&.is-unread]:[background:#f7faff] [.t-b_&&.is-unread:hover]:[background:#edf4fe] [.t-b_&&.is-unread:focus-visible]:[background:#edf4fe] [.t-d_&&.is-unread]:[border-left:4px_solid_var(--acc)] [.t-d_&&.is-unread]:[background:color-mix(in_srgb,_var(--acc)_8%,_transparent)] [.t-d_&&&.is-unread:hover]:[background:color-mix(in_srgb,_var(--acc)_14%,_transparent)] [.t-d_&&&.is-unread:focus-visible]:[background:color-mix(in_srgb,_var(--acc)_14%,_transparent)] [@media(max-width:600px)]:grid-cols-[1fr] ${read ? '' : ' is-unread'}`}
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
                <div className="[font-size:0.8rem] [color:var(--ann-muted)] [.list-item.is-unread_&]:[color:var(--ann-text)] [font-family:var(--ann-font-mono)] [.list-item.is-unread_&]:font-bold mono">
                  {day} {mon}
                </div>
                <div>
                  <div className="[.t-b_.list-item.is-unread_&]:text-[#1d4ed8] [.t-b_.list-item.is-unread_&]:font-extrabold [.t-d_.list-item.is-unread_&]:text-acc2 [.t-d_.list-item.is-unread_&]:font-extrabold font-bold text-[1rem] [color:var(--ann-text)]">
                    {!read && (
                      <span
                        className="mr-2 inline-block w-[8px] h-[8px] [border-radius:50%] [vertical-align:middle] [.t-b_&]:[background-color:var(--ann-blue)] [.t-d_&]:bg-acc [.t-d_&]:[box-shadow:0_0_6px_var(--acc)]"
                        aria-label="Unread"
                      />
                    )}
                    {a.title}
                  </div>
                  <div className="list-meta flex gap-[0.5rem] items-center mt-[0.25rem] [font-family:var(--ann-font-mono)] text-[0.75rem] [color:var(--ann-muted)]">
                    {!read && (
                      <span className={`badge-unread tracking-[0.5px] ${badgeUnread}`}>Unread</span>
                    )}
                    <span className="[color:var(--ann-orange)] font-bold [.t-d_.list-meta_&]:text-acc">
                      <TierName name={a.by} solved={a.by_solved} />
                    </span>
                    <span>{a.scope}</span>
                    {a.requires_ack && <span className={`${badgeMustRead}`}>Must Read</span>}
                  </div>
                </div>
                {isOfficer && (
                  <div className="max-[601px]:hidden [font-family:var(--ann-font-mono)] text-[0.8rem] [color:var(--ann-muted)]">
                    {count}/{memberTotal}
                  </div>
                )}
              </div>
            );
          })}
          {logMore}
        </section>
      )}
    </div>
  );
}

export default AnnouncementBoard;
