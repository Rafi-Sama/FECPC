'use client';
import { useCallback, useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';
import { MarkdownBody, MarkdownEditor, relTime } from '@/components/app/shared/MarkdownEditor';
import { TierName } from '@/components/app/shared/SolvedTier';
import { AvatarRing } from '@/components/app/shared/RatingBadge';
import { ideaTypeLabel } from '@/components/app/ideas/ui';
import { JoinIdeaModal, type JoinIdeaTarget } from '@/components/app/ideas/JoinIdeaModal';
import { canFully, rankFor } from '@fecpc/contracts';
import type { IdeaDetail, IdeaStatus } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';
import {
  cmIdeaMeta,
  cmIdeaTags,
  cmIdeaAcceptedBadge,
  cmIdeaInterestedLabel,
  cmIdeaStatusBadge,
  cmSideBox,
} from '@/components/app/ideas/ui';

export function IdeaModal({
  ideaId,
  onClose,
  onMutated,
  onManage,
}: {
  ideaId: number | null;
  onClose: () => void;
  onMutated: () => void;
  onManage?: () => void;
}) {
  const sure = useConfirm();
  const { s, me, act } = useStore();
  const [detail, setDetail] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [joinIdea, setJoinIdea] = useState<JoinIdeaTarget | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editStatus, setEditStatus] = useState<IdeaStatus>('open');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getIdeaDetail', ideaId: id }),
      });
      if (res.ok) {
        const data = (await res.json()) as IdeaDetail;
        setDetail(data);
        setEditTitle(data.title);
        setEditBody(data.body_md);
        setEditStatus(data.status);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ideaId) {
      setDetail(null);
      setJoinIdea(null);
      setEditing(false);
      return;
    }
    setJoinIdea(null);
    setEditing(false);
    load(ideaId);
  }, [ideaId, load]);

  useEffect(() => {
    if (!ideaId) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape belongs to the join form while it is open.
      if (e.key === 'Escape' && !joinIdea) onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [ideaId, onClose, joinIdea]);

  if (!ideaId) return null;

  const isPoster = detail ? detail.user_id === me.id : false;
  const canManage = detail ? isPoster || canFully(s.roles, 'idea.manage') : false;
  const upvoted = detail ? s.kudos.includes(`idea:${detail.id}`) : false;

  const handleUpvote = async () => {
    if (!detail || upvoted) return;
    const ok = await act('toggle', { list: 'kudos', id: `idea:${detail.id}`, on: true });
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  const handleImIn = async () => {
    if (!detail || busy || isPoster || detail.status === 'closed' || detail.my_interest) return;
    setBusy(true);
    const ok = await act('expressInterest', { ideaId: detail.id, response: {} });
    setBusy(false);
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  const handleJoinClick = () => {
    if (!detail || busy || isPoster || detail.status === 'closed' || detail.my_interest) return;
    // No questions to answer: join straight away instead of opening a form.
    if (detail.roles.length === 0) {
      void handleImIn();
      return;
    }
    setJoinIdea({
      id: detail.id,
      title: detail.title,
      author_name: detail.author_name,
      roles: detail.roles,
    });
  };

  const handleJoinSubmitted = async () => {
    if (!detail) return;
    await load(detail.id);
    onMutated();
  };

  const handleSaveEdit = async () => {
    if (!detail) return false;
    const ok = await act('updateIdea', {
      ideaId: detail.id,
      title: editTitle.trim(),
      body_md: editBody.trim(),
      status: editStatus,
    });
    if (ok) {
      setEditing(false);
      await load(detail.id);
      onMutated();
    }
    return ok;
  };

  const handleClosePost = async () => {
    if (!detail || busy) return;
    if (!(await sure('Close this post? Members will no longer be able to express interest.')))
      return;
    setBusy(true);
    const ok = await act('closeIdea', { ideaId: detail.id });
    setBusy(false);
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  return (
    <>
      <div
        className="cm-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label={detail?.title ?? 'Idea'}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="cm-modal wide cm-idea-modal [.cm-modal&]:max-w-[750px] [box-shadow:8px_8px_0_rgba(13,_13,_11,_0.2)] [.t-d_&]:[box-shadow:8px_8px_0_rgba(0,_0,_0,_0.8)]">
          {loading && !detail ? (
            <p className="body p-6">Loading…</p>
          ) : detail ? (
            <>
              <header className="cm-modal-head [&_.cm-modal-close]:flex-none py-6 px-7 [background:var(--bg)] [border-bottom:2px_solid_var(--line2)] [display:grid] grid-cols-[minmax(0,_1fr)_auto] [align-items:start] gap-4 [@media(max-width:520px)]:p-4">
                <div className="flex gap-2.5 min-w-0 flex-col">
                  <div
                    className={`cm-idea-meta flex items-center max-[521px]:gap-2 ${cmIdeaMeta} gap-[8px_12px] [&_.avatar-ring]:[background:var(--bg)] [&&]:m-0 [&&]:[color:var(--dim)]`}
                  >
                    <AvatarRing
                      name={detail.author_name}
                      avatarUrl={detail.author_avatar}
                      size={36}
                      ringWidth={2}
                      ringOffset={2}
                      rank={rankFor(detail.author_rating)}
                    />
                    <span className="cm-idea-author [&_.avatar-ring]:[background:var(--panel)] inline-flex items-center gap-2 min-w-0 text-ink text-[13px]">
                      <TierName name={detail.author_name} solved={detail.author_solved} />
                    </span>
                    <span className="[color:var(--dim)] text-[12px]">
                      {relTime(detail.created_at)}
                    </span>
                    <div className={`cm-idea-tags flex items-center gap-1.5 ${cmIdeaTags}`}>
                      <span className="cm-idea-tag [border:1px_solid_var(--line2)] tracking-[0.05em] py-px px-1.5 text-ink text-[11px] leading-[1.5] uppercase whitespace-nowrap [background:var(--panel)] [&.status-open]:text-acc [&.status-planned]:text-acc2 [&.status-shipped]:[color:var(--mut)] [&&.status-closed]:text-bad">
                        {ideaTypeLabel(detail.type)}
                      </span>
                      <span
                        className={`cm-idea-tag [border:1px_solid_var(--line2)] tracking-[0.05em] [&.status-open]:border-acc [&.status-planned]:border-acc2 [&.status-shipped]:border-mut [&&&&.status-closed]:border-bad py-px px-1.5 text-ink text-[11px] leading-[1.5] uppercase whitespace-nowrap [background:var(--panel)] [&.status-open]:text-acc [&.status-planned]:text-acc2 [&.status-shipped]:[color:var(--mut)] [&&.status-closed]:text-bad status-${detail.status}`}
                      >
                        {detail.status}
                      </span>
                      {detail.my_interest === 'accepted' && (
                        <span
                          className={`pill ok cm-idea-accepted-badge tracking-[0.06em] ${cmIdeaAcceptedBadge}`}
                        >
                          ✓ Accepted
                        </span>
                      )}
                      {detail.my_interest === 'declined' && (
                        <span
                          className={`pill bad cm-idea-status-badge tracking-[0.06em] ${cmIdeaStatusBadge}`}
                        >
                          ✗ Declined
                        </span>
                      )}
                      {detail.my_interest === 'pending' && (
                        <span
                          className={`pill warn cm-idea-status-badge tracking-[0.06em] ${cmIdeaStatusBadge}`}
                        >
                          Interest sent
                        </span>
                      )}
                    </div>
                  </div>
                  <h2 className="m-0 text-hi font-disp [font-size:clamp(22px,_2.6vw,_30px)] font-bold leading-[1.2] [overflow-wrap:anywhere]">
                    {editing ? 'Edit idea' : detail.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="cm-modal-close cm-idea-modal-close m-0 min-w-[32px] min-h-[32px] [background:var(--panel)] text-[18px] hover:[background:var(--acc)]"
                  aria-label="Close"
                  onClick={onClose}
                >
                  ×
                </button>
              </header>

              <div className="flex gap-4.5 p-6 max-[521px]:p-4 flex-col">
                {editing ? (
                  <SaveForm
                    className="stack [--g:14px]"
                    label="Unsaved changes to this idea"
                    onDiscard={() => {
                      setEditTitle(detail.title);
                      setEditBody(detail.body_md);
                      setEditStatus(detail.status);
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
                      id="edit-idea-body"
                      label="Description (Markdown)"
                      value={editBody}
                      onChange={setEditBody}
                      required
                      minLength={3}
                      maxLength={10000}
                      rows={6}
                    />
                    <label className="field max-w-[220px]">
                      <span className="label">Status</span>
                      <select
                        className="input"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as IdeaStatus)}
                      >
                        <option value="open">Open</option>
                        <option value="planned">Planned</option>
                        <option value="shipped">Shipped</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                    <div className="row [--g:8px]">
                      <button type="submit" className="btn sm">
                        Save changes
                      </button>
                    </div>
                  </SaveForm>
                ) : (
                  <>
                    <div className="cm-idea-detail-content">
                      <MarkdownBody markdown={detail.body_md} />
                    </div>
                    {detail.roles.length > 0 && (
                      <div
                        className={`cm-side-box flex ${cmSideBox} p-5 [border:2px_solid_var(--line2)] [&_.label]:mb-3 [&&]:[background:var(--bg)] gap-2`}
                      >
                        <p className="label">Open roles / applicant questions</p>
                        <ul className="[list-style:disc] pl-4.5 m-0 flex flex-col gap-1">
                          {detail.roles.map((r, i) => (
                            <li key={i} className="body text-[14px]">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* Action bar */}
                <div className="row between cm-idea-actionbar items-center pt-4 [border-top:2px_solid_var(--line2)] [--g:10px]">
                  <div className="flex items-center min-w-0">
                    <div className="row [--g:8px]">
                      <button
                        type="button"
                        className={`btn xs ${upvoted ? '' : 'line'}`}
                        aria-pressed={upvoted}
                        disabled={isPoster || upvoted}
                        onClick={handleUpvote}
                      >
                        ▲ {detail.upvotes}
                      </button>
                      <span
                        className={`cm-idea-interested-label tracking-[0.05em] ${cmIdeaInterestedLabel}`}
                      >
                        INTERESTED ({detail.interested_count})
                      </span>
                    </div>
                  </div>

                  <div className="row ml-auto [--g:8px]">
                    {!detail.my_interest &&
                      !isPoster &&
                      !me.system &&
                      detail.status !== 'closed' && (
                        <button
                          type="button"
                          className="btn xs cm-idea-apply-btn text-on hover:text-bg cm-idea-join-btn min-w-[140px]"
                          disabled={busy}
                          onClick={handleJoinClick}
                        >
                          {detail.roles.length > 0 ? 'Apply to Join' : "I'm in"}
                        </button>
                      )}
                    {editing && (
                      // data-close: with unsaved edits the save bar holds the editor open instead.
                      <button
                        type="button"
                        className="btn xs line"
                        data-close
                        onClick={() => setEditing(false)}
                      >
                        Close editor
                      </button>
                    )}
                    {isPoster && onManage && !editing && (
                      <button
                        type="button"
                        className="btn xs cm-idea-manage-short text-on hover:text-bg"
                        onClick={onManage}
                      >
                        Manage Interested ({detail.interested_count})
                      </button>
                    )}
                    {canManage && !editing && (
                      <>
                        <button
                          type="button"
                          className="btn xs line"
                          onClick={() => setEditing(true)}
                          disabled={busy}
                        >
                          Edit
                        </button>
                        {detail.status !== 'closed' && (
                          <button
                            type="button"
                            className="btn xs line"
                            onClick={handleClosePost}
                            disabled={busy}
                          >
                            Close post
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="stack p-6">
              <div className="cm-modal-head">
                <strong>Idea not found</strong>
                <button
                  type="button"
                  className="cm-modal-close"
                  aria-label="Close"
                  onClick={onClose}
                >
                  ×
                </button>
              </div>
              <p className="body">This post may have been removed.</p>
            </div>
          )}
        </div>
      </div>
      <JoinIdeaModal
        idea={joinIdea}
        onClose={() => setJoinIdea(null)}
        onSubmitted={handleJoinSubmitted}
      />
    </>
  );
}

export default IdeaModal;
