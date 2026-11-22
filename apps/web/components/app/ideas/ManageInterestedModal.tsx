'use client';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/components/app/Store';
import { relTime } from '@/components/app/shared/MarkdownEditor';
import { TierAvatar } from '@/components/app/shared/SolvedTier';
import { rankFor } from '@fecpc/contracts';
import type { IdeaDetail } from '@fecpc/contracts';

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
      <div className="cm-modal cm-idea-manage-modal">
        <header className="cm-modal-head cm-idea-manage-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="cm-idea-manage-kicker">Applicant Management</p>
            <h2 className="cm-idea-manage-title">{detail?.title ?? 'Idea'}</h2>
          </div>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="cm-idea-manage-body">
          {loading && !detail ? (
            <p className="body">Loading…</p>
          ) : !isPoster ? (
            <p className="body">Only the poster can manage applicants.</p>
          ) : applicants.length === 0 ? (
            <p className="body">No one has expressed interest yet.</p>
          ) : (
            <div className="cm-idea-applicant-list">
              {applicants.map((row) => {
                const entries = Object.entries(row.response ?? {});
                return (
                  <div key={row.user_id} className="cm-idea-applicant">
                    <div className="cm-idea-applicant-header">
                      <div className="cm-idea-applicant-identity">
                        <TierAvatar
                          name={row.name}
                          solved={row.problems_solved}
                          avatarUrl={row.avatar_url}
                          size={40}
                        />
                        <div className="cm-idea-applicant-who">
                          {onOpenProfile ? (
                            <button
                              type="button"
                              className="cm-idea-applicant-name"
                              aria-label={`Open ${row.name}'s profile`}
                              onClick={(e) => onOpenProfile(row.user_id, e.currentTarget)}
                            >
                              {row.name}
                            </button>
                          ) : (
                            <strong className="cm-idea-applicant-name">{row.name}</strong>
                          )}
                          <span className="cm-idea-applicant-time">
                            Applied {relTime(row.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="cm-idea-applicant-badges">
                        <span className="cm-idea-tag cm-idea-rank-tag">
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
                      <div className="cm-idea-applicant-answers">
                        {entries.map(([question, answer], i) => (
                          <div key={question} className="cm-idea-answer">
                            <div className="cm-idea-answer-q">
                              {i + 1}. {question}
                            </div>
                            <div className="cm-idea-answer-a">{answer}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {row.status === 'pending' && (
                      <div className="cm-idea-applicant-actions">
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
                          className="btn xs cm-idea-accept"
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
