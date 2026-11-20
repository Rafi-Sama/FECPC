'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { canFully, rankFor } from '@fecpc/contracts';
import { useStore } from '@/components/app/Store';
import { MarkdownBody } from '@/components/app/shared/MarkdownEditor';

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
  const { me, s } = useStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [votes, setVotes] = useState(Number(post.upvotes ?? 24));
  const [upvoted, setUpvoted] = useState(false);

  const isAuthor = post.author_id === me.id;
  const canManage = isAuthor || canFully(s.roles, 'blog.post.delete');

  const rank = rankFor(post.author_rating ?? 0);
  const tierColor = rank.color && rank.color !== '#6B6B6B' ? rank.color : 'var(--ink, #0B0B0B)';

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
        alert('Post link copied to clipboard!');
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
      className="ov open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 11, 11, 0.62)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px',
        overflowY: 'auto',
        zIndex: 9999,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        ref={modalRef}
        className="md"
        role="dialog"
        aria-modal="true"
        aria-label={post.title}
        style={{
          position: 'relative',
          display: 'block',
          maxWidth: 820,
          width: '100%',
          padding: '48px 64px',
          background: 'var(--panel, #F6F4EE)',
          border: '2px solid var(--line2, #0B0B0B)',
          boxShadow: '10px 10px 0 var(--line2, #0B0B0B)',
          animation: 'rise 0.2s ease-out',
        }}
      >
        {/* Close Button */}
        <button
          ref={closeBtnRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            minWidth: 44,
            height: 44,
            position: 'absolute',
            right: 16,
            top: 16,
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            color: 'var(--ink, #0B0B0B)',
            cursor: 'pointer',
            fontSize: 24,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
        >
          ×
        </button>

        {/* Tag on Top */}
        <span
          className="tg"
          style={{
            margin: 0,
            display: 'inline-block',
            font: '11px ui-monospace, Menlo, monospace',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            border: '1px solid var(--line2, #0B0B0B)',
            padding: '4px 8px',
            background: 'var(--bg, #FFFFFF)',
            color: 'var(--ink, #0B0B0B)',
          }}
        >
          {tag}
        </span>

        {/* 40px Grotesque Title */}
        <h2
          style={{
            fontSize: 'clamp(28px, 4.5vw, 40px)',
            lineHeight: 1.15,
            letterSpacing: '-1px',
            margin: '16px 0 12px',
            color: 'var(--ink, #0B0B0B)',
            fontWeight: 700,
          }}
        >
          {post.title}
        </h2>

        {/* 20px Subtitle */}
        {post.subtitle && (
          <p
            style={{
              fontSize: 20,
              lineHeight: 1.4,
              color: 'var(--dim, #5F5F5F)',
              margin: '0 0 24px',
            }}
          >
            {post.subtitle}
          </p>
        )}

        {/* Author Byline Row */}
        <div
          className="hd"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              border: `2px solid ${tierColor}`,
              padding: 2,
              flex: 'none',
              lineHeight: 0,
            }}
          >
            <AvatarRing
              name={post.author_name || 'Alumnus'}
              solved={post.author_rating ?? 0}
              avatarUrl={post.author_avatar}
              size={40}
              ringWidth={2}
              ringOffset={2}
              rank={rank}
            />
          </div>

          <div>
            <b style={{ color: tierColor, fontSize: 15, fontWeight: 700 }}>
              {post.author_name || 'Alumnus'}
            </b>
            <div
              className="m"
              style={{
                marginTop: 2,
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              {post.author_role || 'Software Engineer'} · {dateStr} · {readTime} min read
            </div>
          </div>
        </div>

        {/* Action Bar (Upvote / Downvote / Share / Edit) */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            borderTop: '1px solid var(--line, #CFCBBF)',
            borderBottom: '1px solid var(--line, #CFCBBF)',
            padding: '12px 0',
            marginBottom: 32,
          }}
        >
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="sm"
              aria-label="Upvote"
              onClick={handleUpvote}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 14px',
                background: upvoted ? 'var(--acc, #1F3BFF)' : 'var(--panel, #F6F4EE)',
                color: upvoted ? 'var(--on, #FFFFFF)' : 'var(--ink, #0B0B0B)',
                minHeight: 36,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ▲ {votes}
            </button>
            <button
              type="button"
              className="sm"
              aria-label="Downvote"
              onClick={handleDownvote}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 12px',
                background: 'var(--panel, #F6F4EE)',
                color: 'var(--ink, #0B0B0B)',
                minHeight: 36,
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              ▼
            </button>
          </span>

          <button
            type="button"
            className="sm"
            onClick={handleShare}
            style={{
              marginLeft: 'auto',
              font: '500 13px Inter, Arial, sans-serif',
              border: '2px solid var(--line2, #0B0B0B)',
              padding: '0 16px',
              background: 'var(--panel, #F6F4EE)',
              color: 'var(--ink, #0B0B0B)',
              minHeight: 36,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Share
          </button>

          {canManage && onEdit && (
            <button
              type="button"
              className="sm"
              onClick={() => onEdit(post)}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 14px',
                background: 'var(--panel, #F6F4EE)',
                color: 'var(--ink, #0B0B0B)',
                minHeight: 36,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Edit
            </button>
          )}

          {canManage && onDelete && (
            <button
              type="button"
              className="sm"
              onClick={() => {
                if (window.confirm('Delete this blog post?')) {
                  onDelete(post.id);
                }
              }}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 14px',
                background: 'var(--panel, #F6F4EE)',
                color: 'var(--acc, #C4321C)',
                minHeight: 36,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          )}
        </div>

        {/* Post Markdown Body */}
        <div
          className="blog-content"
          style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: 'var(--ink, #1C1C1A)',
          }}
        >
          <MarkdownBody markdown={post.body_md} />
        </div>

        {/* Tags Row */}
        {post.tags && post.tags.length > 0 && (
          <div style={{ margin: '32px 0' }}>
            {post.tags.map((t) => (
              <span
                key={t}
                className="tg"
                style={{
                  display: 'inline-block',
                  font: '11px ui-monospace, Menlo, monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  border: '1px solid var(--line2, #0B0B0B)',
                  padding: '4px 8px',
                  margin: '0 6px 6px 0',
                  background: 'var(--bg, #FFFFFF)',
                  color: 'var(--ink, #0B0B0B)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Author Bio Card matching mockup 258bdec8 */}
        <div
          className="pn"
          style={{
            margin: 0,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'var(--panel, #F6F4EE)',
            border: '2px solid var(--line2, #0B0B0B)',
            padding: 20,
          }}
        >
          <div
            style={{
              border: `2px solid ${tierColor}`,
              padding: 2,
              flex: 'none',
              lineHeight: 0,
            }}
          >
            <AvatarRing
              name={post.author_name || 'Alumnus'}
              solved={post.author_rating ?? 0}
              avatarUrl={post.author_avatar}
              size={56}
              ringWidth={2}
              ringOffset={2}
              rank={rank}
            />
          </div>

          <div className="g" style={{ minWidth: 200, flex: 1 }}>
            <div
              className="m"
              style={{
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
              }}
            >
              Written by
            </div>
            <b style={{ fontSize: 16, color: 'var(--ink, #0B0B0B)' }}>
              {post.author_name || 'Alumnus'}
            </b>
            <p
              className="t"
              style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--dim, #5F5F5F)' }}
            >
              {post.author_role || 'FECPC Alumnus'} · Competitive programmer and software engineer.
            </p>
          </div>

          {post.author_id && onOpenProfile && (
            <button
              type="button"
              className="btn"
              onClick={() => onOpenProfile(post.author_id!)}
              style={{
                font: '500 13px Inter, Arial, sans-serif',
                border: '2px solid var(--line2, #0B0B0B)',
                padding: '0 16px',
                background: 'var(--panel, #F6F4EE)',
                color: 'var(--ink, #0B0B0B)',
                minHeight: 40,
                cursor: 'pointer',
                fontWeight: 600,
              }}
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
