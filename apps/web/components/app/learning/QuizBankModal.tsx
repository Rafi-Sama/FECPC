'use client';
import { useEffect, useRef, useState } from 'react';
import type { QuizQuestion } from '@/lib/learning.ts';
import { deleteQuizQuestion, updateQuizQuestion } from '@/lib/learning.ts';
import { useConfirm } from '@/components/app/shared/PromptDialog';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuizBankModal({
  isOpen,
  onClose,
  questions,
  onQuestionsChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  onQuestionsChanged: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirm = useConfirm();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState<[string, string, string, string]>(['', '', '', '']);
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
        const nodes = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);

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
    setEditCorrectIndex(q.correct_index);
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

    try {
      setSaving(true);
      await updateQuizQuestion(editingId, {
        question: trimmedQ,
        options: trimmedOpts,
        correct_index: editCorrectIndex,
      });
      setEditingId(null);
      onQuestionsChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save question changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: QuizQuestion) => {
    const ok = await confirm(
      'Delete question?',
      `Are you sure you want to delete this question? "${q.question}"`,
      'Delete',
      true,
    );
    if (!ok) return;

    try {
      await deleteQuizQuestion(q.id);
      if (editingId === q.id) {
        setEditingId(null);
      }
      onQuestionsChanged();
    } catch (err: any) {
      alert(err.message || 'Failed to delete question.');
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-bank-modal-title"
    >
      <div className="modal-dialog" ref={modalRef}>
        <div className="modal-header">
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

        <div className="modal-body">
          {error && <div className="alert-box error">{error}</div>}

          {questions.length === 0 ? (
            <p className="body" style={{ color: 'var(--dim)', textAlign: 'center', padding: 24 }}>
              No questions in the quiz bank yet.
            </p>
          ) : (
            questions.map((q) => {
              const isEditing = editingId === q.id;

              if (isEditing) {
                return (
                  <form
                    key={q.id}
                    className="course-form-panel"
                    style={{ margin: 0 }}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
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

                    <div className="form-group" style={{ marginTop: 10 }}>
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

                    <div className="row between" style={{ marginTop: 14 }}>
                      <div className="row" style={{ gap: 8 }}>
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
                <div key={q.id} className="bank-row">
                  <div className="bank-row-content">
                    <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                      <strong style={{ fontSize: 14 }}>{q.question}</strong>
                      {q.is_today && <span className="badge-today">TODAY</span>}
                    </div>
                    <span className="course-meta">
                      Ans: Option {String.fromCharCode(65 + q.correct_index)} ({q.options[q.correct_index]})
                    </span>
                  </div>

                  <div className="bank-row-actions">
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
