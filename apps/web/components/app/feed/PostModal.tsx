'use client';
import { usePrompt, useConfirm } from '@/components/app/shared/PromptDialog';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { SaveForm } from '@/components/app/SaveBar';
import { MarkdownBody, MarkdownEditor, relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar, TierName } from '@/components/app/shared/SolvedTier';
import { rankFor } from '@fecpc/contracts';
import { feedCategoryChip } from '@/components/app/feed/NewPostModal';
import { VoteWidget } from '@/components/app/feed/VoteWidget';
import type { FeedPostDetail } from '@fecpc/contracts';

export function PostModal({
  postId,
  onClose,
  onSelectPost,
  onVote,
  onMutated,
}: {
  postId: number | null;
  onClose: () => void;
  onSelectPost: (id: number) => void;
  onVote: (postId: number, value: 1 | -1) => Promise<void>;
  onMutated: () => void;
}) {
  const sure = useConfirm();
  const { me, act } = useStore();
  const ask = usePrompt();
  const [detail, setDetail] = useState<FeedPostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getFeedPostDetail', postId: id }),
      });
      if (res.ok) {
        const data = (await res.json()) as FeedPostDetail;
        setDetail(data);
        setEditTitle(data.title);
        setEditBody(data.body_md);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!postId) {
      setDetail(null);
      setEditing(false);
      return;
    }
    setEditing(false);
    load(postId);
  }, [postId, load]);

  useEffect(() => {
    if (!postId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [postId, onClose]);

  if (!postId) return null;

  const isAuthor = detail ? detail.user_id === me.id : false;
  const wasEdited = detail
    ? new Date(detail.updated_at).getTime() - new Date(detail.created_at).getTime() > 5000
    : false;

  const handleSaveEdit = async () => {
    if (!detail) return false;
    const ok = await act('updateFeedPost', {
      postId: detail.id,
      title: editTitle.trim(),
      body_md: editBody.trim(),
    });
    if (ok) {
      setEditing(false);
      await load(detail.id);
      onMutated();
    }
    return ok;
  };

  const handleDelete = async () => {
    if (!detail || busy) return;
    if (!(await sure('Delete this post? This cannot be undone.'))) return;
    setBusy(true);
    const ok = await act('deleteFeedPost', { postId: detail.id });
    setBusy(false);
    if (ok) {
      onMutated();
      onClose();
    }
  };

  const handleReport = async () => {
    if (!detail || busy || detail.reported_by_me) return;
    const reason = await ask({
      title: 'Report this post',
      label: 'What is wrong with it? Moderators see this.',
      placeholder: 'Spam, abuse, off-topic… (optional)',
      confirmLabel: 'Report post',
      danger: true,
    });
    if (reason === null) return;
    setBusy(true);
    const ok = await act('reportFeedPost', {
      postId: detail.id,
      reason: reason.trim() || 'Flagged by member',
    });
    setBusy(false);
    if (ok) await load(detail.id);
  };

  const handleVote = async (value: 1 | -1) => {
    if (!detail) return;
    const prev = detail.my_vote;
    const next: -1 | 0 | 1 = prev === value ? 0 : value;
    setDetail({ ...detail, my_vote: next, score: detail.score + (next - prev) });
    await onVote(detail.id, value);
    await load(detail.id);
  };

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={detail?.title ?? 'Post'}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cm-modal wide">
        {loading && !detail ? (
          <p className="body">Loading post…</p>
        ) : detail ? (
          <div className="cm-two-pane">
            {/* Left pane: Markdown body / Editor */}
            <div className="stack" style={{ '--g': '16px' } as React.CSSProperties}>
              <div className="cm-modal-head">
                <span className="pill">{feedCategoryChip(detail.category)}</span>
                <span className="label">
                  {relTime(detail.created_at)}
                  {wasEdited ? ' · edited' : ''}
                </span>
              </div>

              {editing ? (
                <SaveForm
                  className="stack"
                  style={{ '--g': '14px' } as React.CSSProperties}
                  label="Unsaved changes to this post"
                  onDiscard={() => {
                    setEditTitle(detail.title);
                    setEditBody(detail.body_md);
                    setEditing(false);
                  }}
                  onSubmit={handleSaveEdit}
                >
                  <label className="field">
                    <span className="label">Title</span>
                    <input
                      className="input"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      minLength={3}
                      maxLength={160}
                    />
                  </label>
                  <MarkdownEditor
                    id="edit-feed-body"
                    label="Body (Markdown)"
                    value={editBody}
                    onChange={setEditBody}
                    required
                    minLength={3}
                    maxLength={10000}
                    rows={8}
                  />
                  <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                    <button
                      type="button"
                      className="btn sm line"
                      data-close
                      onClick={() => {
                        setEditTitle(detail.title);
                        setEditBody(detail.body_md);
                        setEditing(false);
                      }}
                    >
                      Close editor
                    </button>
                  </div>
                </SaveForm>
              ) : (
                <>
                  <h2 className="h2" style={{ fontSize: 'clamp(22px, 2.5vw, 30px)' }}>
                    {detail.title}
                  </h2>
                  <MarkdownBody markdown={detail.body_md} />
                </>
              )}
            </div>

            {/* Right pane: Author + Tier + Contributions + Updates + Actions */}
            <aside className="stack" style={{ '--g': '16px' } as React.CSSProperties}>
              <div className="cm-modal-head" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="cm-modal-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  ×
                </button>
              </div>

              <div className="cm-side-box">
                <div
                  className="row"
                  style={{ '--g': '12px', flexWrap: 'nowrap' } as React.CSSProperties}
                >
                  <TierAvatar
                    name={detail.author_name}
                    solved={detail.author_solved}
                    avatarUrl={detail.author_avatar}
                    size={48}
                  />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <TierName name={detail.author_name} solved={detail.author_solved} />
                    <div className="label" style={{ marginTop: 2 }}>
                      {rankFor(detail.author_rating).title} · {detail.author_rating}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="cm-kv">
                    <span>Problems solved</span>
                    <strong>{detail.author_solved}</strong>
                  </div>
                  <div className="cm-kv">
                    <span>Streak</span>
                    <strong>{detail.author_streak}d</strong>
                  </div>
                  <div className="cm-kv">
                    <span>Feed posts</span>
                    <strong>{detail.author_posts_count}</strong>
                  </div>
                </div>
              </div>

              <div className="cm-side-box">
                <p className="label">Updates &amp; edit history</p>
                <div className="cm-meta">
                  <span>Posted {relTime(detail.created_at)}</span>
                  {wasEdited && <span>· Edited {relTime(detail.updated_at)}</span>}
                </div>
                {detail.author_recent.length > 0 && (
                  <div
                    className="stack"
                    style={{ '--g': '8px', marginTop: 4 } as React.CSSProperties}
                  >
                    <p className="label">More from {detail.author_name.split(' ')[0]}</p>
                    {detail.author_recent.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="cm-title"
                        style={{ fontSize: 14 }}
                        onClick={() => onSelectPost(r.id)}
                      >
                        {r.title}
                        <span
                          className="label"
                          style={{ display: 'block', fontSize: 11, marginTop: 2 }}
                        >
                          {relTime(r.created_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="cm-side-box">
                {isAuthor ? (
                  <div className="row" style={{ '--g': '8px' } as React.CSSProperties}>
                    <button
                      type="button"
                      className="btn sm line grow"
                      onClick={() => setEditing((v) => !v)}
                      disabled={busy}
                    >
                      {editing ? 'Cancel edit' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="btn sm line"
                      style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }}
                      onClick={handleDelete}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="row between" style={{ '--g': '8px' } as React.CSSProperties}>
                    <VoteWidget
                      score={detail.score}
                      myVote={detail.my_vote}
                      disabled={me.system}
                      layout="horizontal"
                      onVote={handleVote}
                    />
                    <button
                      type="button"
                      className="btn xs line"
                      disabled={busy || detail.reported_by_me || me.system}
                      onClick={handleReport}
                    >
                      {detail.reported_by_me ? 'Reported' : 'Report'}
                    </button>
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="stack">
            <div className="cm-modal-head">
              <strong>Post unavailable</strong>
              <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
                ×
              </button>
            </div>
            <p className="body">This post may have been deleted.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PostModal;
