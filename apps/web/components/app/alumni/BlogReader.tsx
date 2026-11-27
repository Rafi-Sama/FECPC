'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { AvatarRing, tierText } from '@/components/app/shared/RatingBadge';
import { canFully, rankFor } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function BlogReader({
  post,
  onClose,
  onEdit,
  onDelete,
  onOpenProfile,
}: {
  post: BlogPost;
  onClose: () => void;
  onEdit?: (post: BlogPost) => void;
  onDelete?: (postId: number) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const sure = useConfirm();
  const { me, s, toast } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [votes, setVotes] = useState(Number(post.upvotes ?? 24));
  const [upvoted, setUpvoted] = useState(false);

  const isAuthor = post.author_id === me.id;
  const canManage = isAuthor || canFully(s.roles, 'blog.post.delete');

  const rank = rankFor(post.author_rating ?? 0);
  const tierColor = rank.color;

  const readTime =
    post.read_time_min || Math.max(1, Math.round(post.body_md.split(/\s+/).length / 200));
  const tag = post.tags && post.tags.length > 0 ? post.tags[0] : 'Engineering';

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Trap focus + Esc
  useEffect(() => {
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (!active || active === first || !modalRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modalRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleUpvote = () => {
    if (!upvoted) {
      setUpvoted(true);
      setVotes((v) => v + 1);
    }
  };

  const handleDownvote = () => {
    if (upvoted) {
      setUpvoted(false);
      setVotes((v) => Math.max(0, v - 1));
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Post link copied.');
      }
    } catch {
      // ignore
    }
  };

  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <div
      className="ov open inset-0 py-12 px-6 fixed [background:rgba(11,_11,_11,_0.62)] flex items-start justify-center overflow-y-auto z-[9999] [backdrop-filter:blur(2px)]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="md py-12 px-16 relative block max-w-[820px] w-full [background:var(--panel)] [border:2px_solid_var(--line2)] [box-shadow:10px_10px_0_var(--line2)] [animation:rise_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
      >
        {/* Close Button */}
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="top-4 right-4 min-w-[44px] h-[44px] absolute [background:var(--panel)] [border:2px_solid_var(--line2)] text-ink cursor-pointer text-[24px] leading-[1] flex items-center justify-center font-bold"
        >
          ×
        </button>

        {/* Tag on Top */}
        <span className="tg py-1 px-2 m-0 inline-block [font:11px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em] [border:1px_solid_var(--line2)] [background:var(--bg)] text-ink">
          {tag}
        </span>

        {/* 40px Grotesque Title */}
        <h2 className="mt-4 mx-0 mb-3 [font-size:clamp(28px,_4.5vw,_40px)] leading-[1.15] tracking-[-1px] text-ink font-bold">
          {post.title}
        </h2>

        {/* 20px Subtitle */}
        {post.subtitle && (
          <p className="mt-0 mx-0 mb-6 text-[20px] leading-[1.4] text-dim">{post.subtitle}</p>
        )}

        {/* Author Byline Row */}
        <div className="hd mb-5 flex gap-3 items-center">
          <div className="p-0.5 flex-none leading-[0]" style={{ border: `2px solid ${tierColor}` }}>
            <AvatarRing
              name={post.author_name || 'Alumnus'}
              avatarUrl={post.author_avatar}
              size={40}
              ringWidth={2}
              ringOffset={2}
              rank={rank}
            />
          </div>

          <div>
            <b className="text-[15px] font-bold" style={{ color: tierText(tierColor) }}>
              {post.author_name || 'Alumnus'}
            </b>
            <div className="m mt-0.5 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
              {post.author_role || 'Software Engineer'} · {dateStr} · {readTime} min read
            </div>
          </div>
        </div>

        {/* Action Bar (Upvote / Downvote / Share / Edit) */}
        <div className="py-3 px-0 mb-8 flex gap-3 items-center [border-top:1px_solid_var(--line)] [border-bottom:1px_solid_var(--line)]">
          <span className="flex gap-2">
            <button
              type="button"
              className="sm py-0 px-3.5 [font:700_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] min-h-[36px] cursor-pointer"
              aria-label="Upvote"
              onClick={handleUpvote}
              style={{
                background: upvoted ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                color: upvoted ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
              }}
            >
              ▲ {votes}
            </button>
            <button
              type="button"
              className="sm py-0 px-3 [font:700_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[36px] cursor-pointer"
              aria-label="Downvote"
              onClick={handleDownvote}
            >
              ▼
            </button>
          </span>

          <button
            type="button"
            className="sm py-0 px-4 ml-auto [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[36px] cursor-pointer"
            onClick={handleShare}
          >
            Share
          </button>

          {canManage && onEdit && (
            <button
              type="button"
              className="sm py-0 px-3.5 [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[36px] cursor-pointer"
              onClick={() => onEdit(post)}
            >
              Edit
            </button>
          )}

          {canManage && onDelete && (
            <button
              type="button"
              className="sm py-0 px-3.5 [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-acc min-h-[36px] cursor-pointer"
              onClick={async () => {
                if (await sure('Delete this blog post?')) {
                  onDelete(post.id);
                }
              }}
            >
              Delete
            </button>
          )}
        </div>

        {/* Post Markdown Body */}
        <div className="blog-content text-[18px] leading-[1.7] text-ink">
          <MarkdownBody markdown={post.body_md} />
        </div>

        {/* Tags Row */}
        {post.tags && post.tags.length > 0 && (
          <div className="my-8 mx-0">
            {post.tags.map((t) => (
              <span
                key={t}
                className="tg py-1 px-2 mt-0 mr-1.5 mb-1.5 ml-0 inline-block [font:11px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em] [border:1px_solid_var(--line2)] [background:var(--bg)] text-ink"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Author Bio Card matching mockup 258bdec8 */}
        <div className="pn p-5 m-0 flex gap-4 items-center flex-wrap [background:var(--panel)] [border:2px_solid_var(--line2)]">
          <div className="p-0.5 flex-none leading-[0]" style={{ border: `2px solid ${tierColor}` }}>
            <AvatarRing
              name={post.author_name || 'Alumnus'}
              avatarUrl={post.author_avatar}
              size={56}
              ringWidth={2}
              ringOffset={2}
              rank={rank}
            />
          </div>

          <div className="g min-w-[200px] flex-1">
            <div className="m [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
              Written by
            </div>
            <b className="text-[16px] text-ink">{post.author_name || 'Alumnus'}</b>
            <p className="t mt-1 mx-0 mb-0 text-[13px] text-dim">
              {post.author_role || 'FECPC Alumnus'} · Competitive programmer and software engineer.
            </p>
          </div>

          {post.author_id && onOpenProfile && (
            <button
              type="button"
              className="btn py-0 px-4 [font:600_13px_Inter,_Arial,_sans-serif] [border:2px_solid_var(--line2)] [background:var(--panel)] text-ink min-h-[40px] cursor-pointer"
              onClick={() => onOpenProfile(post.author_id!)}
            >
              View profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BlogReader;
