'use client';
import React, { useState } from 'react';
import type { BlogPost } from '@fecpc/contracts';
import { AvatarRing, tierText } from '@/components/app/shared/RatingBadge';
import { rankFor } from '@fecpc/contracts';
import { excerptFromMarkdown, relTime } from '@/components/app/shared/MarkdownEditor';
import { HighlightMatch } from './HighlightMatch';

const voteButton =
  'py-0 px-4 [border:0] min-h-[44px] [background:transparent] cursor-pointer text-[16px] text-ink';

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
      className="pn blog-card p-0 mb-6 flex [background:var(--panel)] [border:2px_solid_var(--line2)] cursor-pointer relative [transition:transform_0.14s_ease,_box-shadow_0.14s_ease]"
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
    >
      {/* 72px Left Upvote Column matching mockup 41f59af4 */}
      <div className="flex-[0_0_72px] [border-right:1px_solid_var(--line)] flex flex-col items-center justify-center [user-select:none]">
        <button type="button" aria-label="Upvote" onClick={handleUpvote} className={voteButton}>
          ▲
        </button>
        <b className="mo [font-family:ui-monospace,_Menlo,_monospace] text-[14px] text-ink font-bold">
          {votes}
        </b>
        <button type="button" aria-label="Downvote" onClick={handleDownvote} className={voteButton}>
          ▼
        </button>
      </div>

      {/* Right Content Column */}
      <div className="p-6 flex-1 min-w-0">
        {/* Author Header Row */}
        <div className="hd mb-4 flex gap-3 items-center">
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

          <div className="g flex-1 min-w-0">
            <b className="text-[15px] font-bold" style={{ color: tierText(tierColor) }}>
              <HighlightMatch text={post.author_name || 'Alumnus'} query={highlightQuery} />
            </b>
            <div className="m mt-0.5 [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim overflow-hidden text-ellipsis whitespace-nowrap">
              {post.author_role || 'Software Engineer'} · Batch 17
            </div>
          </div>

          <span className="m [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
            {dateStr}
          </span>
        </div>

        {/* Title */}
        <h3 className="mt-0 mx-0 mb-2 text-[24px] leading-[1.2] font-bold text-ink">
          <HighlightMatch text={post.title} query={highlightQuery} />
        </h3>

        {/* 2-line Excerpt */}
        <p className="t mt-0 mx-0 mb-4 text-[15px] leading-[1.55] text-mut line-clamp-2">
          <HighlightMatch text={excerpt} query={highlightQuery} />
        </p>

        {/* Footer Meta Row */}
        <div className="flex gap-3 items-center">
          <span className="tg py-1 px-2 m-0 [font:11px_ui-monospace,_Menlo,_monospace] uppercase tracking-[.06em] [border:1px_solid_var(--line2)] [background:var(--bg)] text-ink">
            {tag}
          </span>

          <span className="m [font:11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase text-dim">
            {readTime} min read
          </span>

          <span className="m ml-auto text-ink [font:700_11px_ui-monospace,_Menlo,_monospace] tracking-[.06em] uppercase">
            Read →
          </span>
        </div>
      </div>
    </article>
  );
}

export default BlogCard;
