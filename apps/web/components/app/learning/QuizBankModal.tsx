'use client';
import { useEffect, useRef, useState } from 'react';
import type { QuizQuestion } from '@fecpc/contracts';
import { useConfirm } from '@/components/app/shared/PromptDialog';
import { useStore } from '@/components/app/Store';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuizBankModal({
  isOpen,
  onClose,
  questions,
}: {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
}) {
  const { act } = useStore();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirm = useConfirm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [editCorrectIndex, setEditCorrectIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus trap & Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const nodes = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );

        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartEdit = (q: QuizQuestion) => {
    setEditingId(q.id);
    setEditQuestion(q.question);
    setEditOptions([
      q.options[0] || '',
      q.options[1] || '',
      q.options[2] || '',
      q.options[3] || '',
    ]);
    setEditCorrectIndex(q.answer);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);

    const trimmedQ = editQuestion.trim();
    if (!trimmedQ || trimmedQ.length > 200) {
      setError('Question text must be between 1 and 200 characters.');
      return;
    }

    const trimmedOpts = editOptions.map((o) => o.trim());
    if (trimmedOpts.some((o) => !o || o.length > 200)) {
      setError('All 4 options must be non-empty and at most 200 characters.');
      return;
    }

    setSaving(true);
    const ok = await act('quizEdit', {
      id: editingId,
      question: trimmedQ,
      options: trimmedOpts,
      answer: editCorrectIndex,
    });
    setSaving(false);
    if (ok) setEditingId(null);
  };

  const handleDelete = async (q: QuizQuestion) => {
    const ok = await confirm(
      'Delete question?',
      `Are you sure you want to delete this question? "${q.question}"`,
      'Delete',
      true,
    );
    if (!ok) return;

    if ((await act('quizDelete', { id: q.id })) && editingId === q.id) setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 [background:rgba(0,0,0,0.55)] flex items-center justify-center z-999 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-bank-modal-title"
    >
      <div
        className="[background:var(--panel)] [border:2px_solid_var(--line2)] rounded-[6px] w-full max-w-[800px] max-h-[85vh] flex flex-col [box-shadow:0_10px_30px_rgba(0,0,0,0.25)] overflow-hidden"
        ref={modalRef}
      >
        <div className="flex items-center justify-between p-[16px_20px] [border-bottom:1px_solid_var(--line)]">
          <h2 id="quiz-bank-modal-title" className="h3">
            Quiz Bank ({questions.length})
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            className="btn xs line"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕ Close
          </button>
        </div>

        <div className="[.ann-modal_&]:p-[1.5rem] [.ann-modal_&]:max-h-[70vh] [.ann-modal_&]:overflow-y-auto max-[601px]:[.ann-modal_&]:p-[1.25rem] p-5 overflow-y-auto flex flex-col gap-4">
          {error && <div className="alert-box error">{error}</div>}

          {questions.length === 0 ? (
            <p className="body text-dim text-center p-6">No questions in the quiz bank yet.</p>
          ) : (
            questions.map((q) => {
              const isEditing = editingId === q.id;

              if (isEditing) {
                return (
                  <form
                    key={q.id}
                    className="p-6 [background:var(--panel)] [border:1px_solid_var(--line)] rounded-[4px] m-0"

                    onSubmit={handleSaveEdit}
                  >
                    <div className="form-group">
                      <label htmlFor={`edit-q-${q.id}`}>Question *</label>
                      <input
                        id={`edit-q-${q.id}`}
                        type="text"
                        required
                        maxLength={200}
                        value={editQuestion}
                        onChange={(e) => setEditQuestion(e.target.value)}
                      />
                    </div>

                    <div className="[display:grid] grid-cols-[1fr_1fr] gap-2.5 mt-2.5">
                      {[0, 1, 2, 3].map((optIdx) => (
                        <div key={optIdx} className="form-group">
                          <label htmlFor={`edit-opt-${q.id}-${optIdx}`}>
                            Option {String.fromCharCode(65 + optIdx)} *
                          </label>
                          <input
                            id={`edit-opt-${q.id}-${optIdx}`}
                            type="text"
                            required
                            maxLength={200}
                            value={editOptions[optIdx]}
                            onChange={(e) => {
                              const next = [...editOptions] as [string, string, string, string];
                              next[optIdx] = e.target.value;
                              setEditOptions(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="form-group mt-2.5">
                      <label htmlFor={`edit-answer-${q.id}`}>Correct Option *</label>
                      <select
                        id={`edit-answer-${q.id}`}
                        value={editCorrectIndex}
                        onChange={(e) => setEditCorrectIndex(parseInt(e.target.value, 10))}
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                    </div>

                    <div className="row between mt-3.5">
                      <div className="row gap-2">
                        <button type="submit" className="btn sm" disabled={saving}>
                          {saving ? 'Saving...' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          className="btn sm line"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Back
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn sm line danger"
                        onClick={() => handleDelete(q)}
                        disabled={saving}
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between p-[14px_16px] [border:1px_solid_var(--line)] rounded-[4px] [background:var(--bg,#fff)] gap-3"
                >
                  <div className="flex flex-col gap-[4px] flex-1">
                    <div className="row gap-2 items-center">
                      <strong>{q.question}</strong>
                      {q.today && (
                        <span className="inline-block p-[2px_8px] rounded-[999px] text-[14px] [font-weight:700] uppercase [background:#3b82f6] text-white tracking-[0.05em]">
                          TODAY
                        </span>
                      )}
                    </div>
                    <span className="text-[14px] [color:var(--dim)]">
                      Ans: Option {String.fromCharCode(65 + q.answer)} ({q.options[q.answer]})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn xs line"
                      onClick={() => handleStartEdit(q)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn xs line danger"
                      onClick={() => handleDelete(q)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
