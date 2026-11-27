'use client';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar } from '@/components/app/shared/SolvedTier';
import { rankFor } from '@fecpc/contracts';
import type { IdeaDetail } from '@fecpc/contracts';
import { cmIdeaTag } from '@/components/app/ideas/ui';

/** Owner-only applicant management: a separate modal, not the post detail view. */
export function ManageInterestedModal({
  ideaId,
  onClose,
  onMutated,
  onOpenProfile,
}: {
  ideaId: number | null;
  onClose: () => void;
  onMutated: () => void;
  onOpenProfile?: (userId: string, trigger?: HTMLElement | null) => void;
}) {
  const { me, act } = useStore();
  const [detail, setDetail] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'getIdeaDetail', ideaId: id }),
      });
      if (res.ok) setDetail((await res.json()) as IdeaDetail);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ideaId) {
      setDetail(null);
      return;
    }
    load(ideaId);
  }, [ideaId, load]);

  useEffect(() => {
    if (!ideaId) return;
    const onKey = (e: KeyboardEvent) => {
      // Let the profile dossier close first when it is stacked above this modal.
      if (e.key === 'Escape' && !document.querySelector('.profile-modal-backdrop')) onClose();
    };
    // Capture before the profile dossier's document-level handler can unmount it.
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  }, [ideaId, onClose]);

  if (!ideaId) return null;

  const isPoster = detail ? detail.user_id === me.id : false;
  const applicants = detail?.interested ?? [];

  const handleDecision = async (userId: string, decision: 'accepted' | 'declined') => {
    if (!detail || busy) return;
    setBusy(true);
    const ok = await act('decideInterest', { ideaId: detail.id, userId, decision });
    setBusy(false);
    if (ok) {
      await load(detail.id);
      onMutated();
    }
  };

  return (
    <div
      className="cm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Manage interested members"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cm-modal cm-idea-manage-modal [.cm-modal&]:max-w-[800px] [box-shadow:8px_8px_0_rgba(13,_13,_11,_0.2)] [.t-d_&]:[box-shadow:8px_8px_0_rgba(0,_0,_0,_0.8)]">
        <header className="cm-modal-head p-6 items-start [background:var(--bg)] [border-bottom:2px_solid_var(--line2)] [@media(max-width:520px)]:p-4">
          <div className="grow min-w-0">
            <p className="mt-0 mx-0 mb-2 [color:var(--dim)] font-label text-[12px] tracking-[0.05em] uppercase">
              Applicant Management
            </p>
            <h2 className="m-0 text-hi font-disp [font-size:clamp(20px,_2.5vw,_28px)] font-bold leading-[1.2]">
              {detail?.title ?? 'Idea'}
            </h2>
          </div>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="p-6 max-[521px]:p-4 [background:var(--panel)]">
          {loading && !detail ? (
            <p className="body">Loading…</p>
          ) : !isPoster ? (
            <p className="body">Only the poster can manage applicants.</p>
          ) : applicants.length === 0 ? (
            <p className="body">No one has expressed interest yet.</p>
          ) : (
            <div className="flex gap-4 flex-col">
              {applicants.map((row) => {
                const entries = Object.entries(row.response ?? {});
                return (
                  <div
                    key={row.user_id}
                    className="flex gap-4 p-5 [border:2px_solid_var(--line2)] flex-col [background:var(--bg)]"
                  >
                    <div className="flex items-center justify-between gap-3 pb-3 flex-wrap [border-bottom:1px_solid_var(--line)]">
                      <div className="flex items-center gap-3 min-w-0">
                        <TierAvatar
                          name={row.name}
                          solved={row.problems_solved}
                          avatarUrl={row.avatar_url}
                          size={40}
                        />
                        <div className="flex gap-0.5 min-w-0 flex-col">
                          {onOpenProfile ? (
                            <button
                              type="button"
                              className="[border:0] text-hi font-body text-[17px] [font-weight:700] hover:text-acc p-0 self-start [background:none] leading-[1.2] text-left [&:is(button)]:cursor-pointer [&:is(button):hover]:[text-decoration:underline] [&:is(button):hover]:[text-underline-offset:3px] [&:is(button):focus-visible]:[outline:2px_solid_var(--acc)] [&:is(button):focus-visible]:[outline-offset:2px]"
                              aria-label={`Open ${row.name}'s profile`}
                              onClick={(e) => onOpenProfile(row.user_id, e.currentTarget)}
                            >
                              {row.name}
                            </button>
                          ) : (
                            <strong className="[border:0] text-hi font-body text-[17px] [font-weight:700] p-0 self-start [background:none] leading-[1.2] text-left">
                              {row.name}
                            </strong>
                          )}
                          <span className="[color:var(--dim)] font-label text-[11px]">
                            Applied {relTime(row.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <span
                          className={`cm-idea-tag [border:1px_solid_var(--line2)] tracking-[0.05em] ${cmIdeaTag} [&&]:text-ink [&&]:whitespace-nowrap`}
                        >
                          Codeforces: {rankFor(row.rating).title}
                        </span>
                        {row.status !== 'pending' && (
                          <span className={`pill ${row.status === 'accepted' ? 'ok' : 'bad'}`}>
                            {row.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {entries.length > 0 && (
                      <div className="flex gap-3 p-4 [border:1px_solid_var(--line)] flex-col [background:var(--panel)]">
                        {entries.map(([question, answer], i) => (
                          <div key={question} className="cm-idea-answer">
                            <div className="mb-1 [color:var(--dim)] font-label text-[11px] tracking-[0.02em]">
                              {i + 1}. {question}
                            </div>
                            <div className="text-ink font-body text-[14px] font-semibold">
                              {answer}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {row.status === 'pending' && (
                      <div className="cm-idea-applicant-actions flex gap-2 justify-end max-[769px]:justify-end ml-auto [@media(max-width:768px)]:ml-0 [@media(max-width:768px)]:w-full">
                        <button
                          type="button"
                          className="btn xs line"
                          disabled={busy}
                          onClick={() => handleDecision(row.user_id, 'declined')}
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          className="btn xs cm-idea-accept text-on hover:text-bg"
                          disabled={busy}
                          onClick={() => handleDecision(row.user_id, 'accepted')}
                        >
                          Accept &amp; Invite
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
