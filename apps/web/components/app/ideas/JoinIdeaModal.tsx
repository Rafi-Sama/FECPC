'use client';
import { useEffect, useState } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';
import {
  cmIdeaSubmitTitle,
  cmIdeaSubmitNote,
  cmIdeaPublish,
  ideaSubmitFoot,
} from '@/components/app/ideas/ui';

export type JoinIdeaTarget = {
  id: number;
  title: string;
  author_name: string;
  roles: string[];
};

/** Application form for ideas with open roles. Its own modal; the post stays visible underneath. */
export function JoinIdeaModal({
  idea,
  onClose,
  onSubmitted,
}: {
  idea: JoinIdeaTarget | null;
  onClose: () => void;
  onSubmitted: (ideaId: number) => void;
}) {
  const { act } = useStore();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAnswers({});
    setBusy(false);
  }, [idea?.id]);

  useEffect(() => {
    if (!idea) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [idea, onClose]);

  if (!idea) return null;

  const submit = async () => {
    if (busy) return false;
    setBusy(true);
    const response = Object.fromEntries(
      idea.roles.map((prompt) => [prompt, (answers[prompt] ?? '').trim()]),
    );
    const ok = await act('expressInterest', { ideaId: idea.id, response });
    setBusy(false);
    if (ok) {
      setAnswers({});
      onClose();
      onSubmitted(idea.id);
    }
    return ok;
  };

  return (
    <div
      className="cm-backdrop cm-idea-join-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Apply to join ${idea.title}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="cm-modal cm-idea-join-modal [box-shadow:8px_8px_0_rgba(13,_13,_11,_0.2)] [.t-d_&]:[box-shadow:8px_8px_0_rgba(0,_0,_0,_0.8)] [.cm-modal&]:max-w-[560px]">
        <header className="cm-modal-head [&_.cm-modal-close]:flex-none flex items-start gap-3.5 p-6 [background:var(--bg)] [border-bottom:2px_solid_var(--line2)] max-[521px]:p-4 cm-idea-join-head">
          <div className="grow min-w-0">
            <p className="mt-0 mx-0 mb-1.5 [color:var(--dim)] font-label text-[11px] tracking-[0.06em] uppercase">
              APPLY TO JOIN
            </p>
            <h2 className={`cm-idea-submit-title ${cmIdeaSubmitTitle}`}>{idea.title}</h2>
          </div>
          <button type="button" className="cm-modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <SaveForm
          className="cm-idea-submit-body"
          label="Unsent application"
          saveLabel="Submit Application"
          onDiscard={() => setAnswers({})}
          onSubmit={submit}
        >
          <p className="m-0 [color:var(--dim)] font-label text-[12px] tracking-[0.05em] uppercase">
            ANSWER BEFORE JOINING · VISIBLE ONLY TO {idea.author_name.toUpperCase()}
          </p>

          <div className="flex flex-col gap-3.5">
            {idea.roles.map((prompt, idx) => (
              <label key={prompt} className="field">
                <span className="label">
                  {idx + 1}. {prompt}
                </span>
                <input
                  className="input"
                  required
                  maxLength={500}
                  value={answers[prompt] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [prompt]: e.target.value }))}
                  placeholder="Your answer"
                />
              </label>
            ))}
          </div>

          <div className={ideaSubmitFoot}>
            <span className={`cm-idea-submit-note tracking-[0.05em] ${cmIdeaSubmitNote}`}>
              Answers go only to the poster.
            </span>
            <div className="row [--g:8px]">
              <button type="button" className="btn sm line" data-close onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className={`btn sm cm-idea-publish ${cmIdeaPublish}`}
                disabled={busy}
              >
                {busy ? 'Sending…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </SaveForm>
      </div>
    </div>
  );
}

export default JoinIdeaModal;
