'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { SaveForm } from '@/components/app/SaveBar';
import { useStore } from '@/components/app/Store';

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
      <div className="cm-modal cm-idea-join-modal">
        <header className="cm-modal-head cm-idea-submit-head cm-idea-join-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <p className="cm-idea-join-kicker">APPLY TO JOIN</p>
            <h2 className="cm-idea-submit-title">{idea.title}</h2>
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
          <p className="cm-idea-apply-note">
            ANSWER BEFORE JOINING · VISIBLE ONLY TO {idea.author_name.toUpperCase()}
          </p>

          <div className="cm-idea-join-questions">
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

          <div className="cm-idea-submit-foot">
            <span className="cm-idea-submit-note">Answers go only to the poster.</span>
            <div className="row" style={{ '--g': '8px' } as CSSProperties}>
              <button type="button" className="btn sm line" data-close onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn sm cm-idea-publish" disabled={busy}>
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
