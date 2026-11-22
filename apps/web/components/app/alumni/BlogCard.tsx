'use client';
import React, { useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { AvatarRing, tierText } from '@/components/app/shared/RatingBadge';
import { rankFor } from '@fecpc/contracts';
import { excerptFromMarkdown, relTime } from '@/components/app/shared/MarkdownEditor';
import { HighlightMatch } from './HighlightMatch';

export function BlogCard({
  post,
  onOpen,
  onVote,
  highlightQuery,
}: {
  readonly post: BlogPost;
  readonly onOpen: (post: BlogPost) => void;
  readonly onVote?: (postId: number, delta: number) => void;
  readonly highlightQuery?: string;
}) {
  const [votes, setVotes] = useState(Number(post.upvotes ?? 31));
  const excerpt = post.subtitle || excerptFromMarkdown(post.body_md, 160);
  const tag = post.tags && post.tags.length > 0 ? post.tags[0] : 'Engineering';
  const readTime =
    post.read_time_min || Math.max(1, Math.round(post.body_md.split(/\s+/).length / 200));

  const rank = rankFor(post.author_rating ?? 0);
  const tierColor = rank.color;

  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVotes((v) => v + 1);
    onVote?.(post.id, 1);
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVotes((v) => Math.max(0, v - 1));
    onVote?.(post.id, -1);
  };

  const dateStr = post.created_at
    ? new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : relTime(post.created_at);

  return (
    <article
      className="pn blog-card"
      tabIndex={0}
      role="button"
      aria-label={`${post.title} by ${post.author_name || 'Alumnus'}. Read post.`}
      onClick={() => onOpen(post)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(post);
        }
      }}
      style={{
        padding: 0,
        display: 'flex',
        marginBottom: 24,
        background: 'var(--panel, #F6F4EE)',
        border: '2px solid var(--line2, #0B0B0B)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease',
      }}
    >
      {/* 72px Left Upvote Column matching mockup 41f59af4 */}
      <div
        style={{
          flex: '0 0 72px',
          borderRight: '1px solid var(--line, #CFCBBF)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <button
          type="button"
          aria-label="Upvote"
          onClick={handleUpvote}
          style={{
            border: 0,
            minHeight: 44,
            padding: '0 16px',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--ink, #0B0B0B)',
          }}
        >
          ▲
        </button>
        <b
          className="mo"
          style={{
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 14,
            color: 'var(--ink, #0B0B0B)',
            fontWeight: 700,
          }}
        >
          {votes}
        </b>
        <button
          type="button"
          aria-label="Downvote"
          onClick={handleDownvote}
          style={{
            border: 0,
            minHeight: 44,
            padding: '0 16px',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--ink, #0B0B0B)',
          }}
        >
          ▼
        </button>
      </div>

      {/* Right Content Column */}
      <div style={{ flex: 1, padding: 24, minWidth: 0 }}>
        {/* Author Header Row */}
        <div
          className="hd"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 16,
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
              avatarUrl={post.author_avatar}
              size={40}
              ringWidth={2}
              ringOffset={2}
              rank={rank}
            />
          </div>

          <div className="g" style={{ flex: 1, minWidth: 0 }}>
            <b style={{ color: tierText(tierColor), fontSize: 15, fontWeight: 700 }}>
              <HighlightMatch text={post.author_name || 'Alumnus'} query={highlightQuery} />
            </b>
            <div
              className="m"
              style={{
                marginTop: 2,
                font: '11px ui-monospace, Menlo, monospace',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                color: 'var(--dim, #5F5F5F)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {post.author_role || 'Software Engineer'} · Batch 17
            </div>
          </div>

          <span
            className="m"
            style={{
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            {dateStr}
          </span>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: 24,
            lineHeight: 1.2,
            margin: '0 0 8px',
            fontWeight: 700,
            color: 'var(--ink, #0B0B0B)',
          }}
        >
          <HighlightMatch text={post.title} query={highlightQuery} />
        </h3>

        {/* 2-line Excerpt */}
        <p
          className="t"
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--mut, #3B3A35)',
            margin: '0 0 16px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <HighlightMatch text={excerpt} query={highlightQuery} />
        </p>

        {/* Footer Meta Row */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span
            className="tg"
            style={{
              margin: 0,
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

          <span
            className="m"
            style={{
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: 'var(--dim, #5F5F5F)',
            }}
          >
            {readTime} min read
          </span>

          <span
            className="m"
            style={{
              marginLeft: 'auto',
              color: 'var(--ink, #0B0B0B)',
              font: '11px ui-monospace, Menlo, monospace',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Read →
          </span>
        </div>
      </div>
    </article>
  );
}

export default BlogCard;
