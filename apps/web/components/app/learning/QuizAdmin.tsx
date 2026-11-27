'use client';
import { useState } from 'react';
import { useStore } from '@/components/app/Store';
import { BulkImportPanel } from './BulkImportPanel.tsx';
import { QuizBankModal } from './QuizBankModal.tsx';

export function QuizAdmin() {
  const { quizBank, act } = useStore();
  const questions = quizBank ?? [];
  const [modalOpen, setModalOpen] = useState(false);

  // Add one question form state
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateOne = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedQ = questionText.trim();
    if (!trimmedQ || trimmedQ.length > 200) {
      setFormError('Question text must be between 1 and 200 characters.');
      return;
    }

    const trimmedOpts = options.map((o) => o.trim());
    if (trimmedOpts.some((o) => !o || o.length > 200)) {
      setFormError('All 4 options must be non-empty and at most 200 characters.');
      return;
    }

    setSubmitting(true);
    const ok = await act('quizAdd', {
      question: trimmedQ,
      options: trimmedOpts,
      answer: correctIndex,
    });
    setSubmitting(false);
    if (!ok) return;
    setQuestionText('');
    setOptions(['', '', '', '']);
    setCorrectIndex(0);
    setFormSuccess('Question added.');
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <p className="text-[14px] [color:var(--dim)] mt-[4px]">Members get five a day.</p>

      {/* 1. Bulk import panel */}
      <BulkImportPanel />

      {/* 2. Add one question form */}
      <form
        className="p-6 [background:var(--panel)] [border:1px_solid_var(--line)] rounded-[4px] mb-6"
        onSubmit={handleCreateOne}
      >
        <h2 className="h3">Add one question</h2>

        {formError && <div className="alert-box error mt-3">{formError}</div>}
        {formSuccess && (
          <div className="alert-box [background:rgba(16,185,129,0.1)] border-[#10b981] text-[#047857] mt-3">
            {formSuccess}
          </div>
        )}

        <div className="mt-4">
          <div className="form-group">
            <label htmlFor="one-q-text">Question *</label>
            <input
              id="one-q-text"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. What is the time complexity of BFS?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </div>

          <div className="[display:grid] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 mt-3.5">
            {[0, 1, 2, 3].map((optIdx) => (
              <div key={optIdx} className="form-group">
                <label htmlFor={`one-opt-${optIdx}`}>
                  Option {String.fromCharCode(65 + optIdx)} *
                </label>
                <input
                  id={`one-opt-${optIdx}`}
                  type="text"
                  required
                  maxLength={200}
                  placeholder={`Option ${String.fromCharCode(65 + optIdx)} text`}
                  value={options[optIdx]}
                  onChange={(e) => {
                    const next = [...options] as [string, string, string, string];
                    next[optIdx] = e.target.value;
                    setOptions(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="form-group mt-3.5 max-w-[300px]">
            <label htmlFor="one-correct-index">Correct Option *</label>
            <select
              id="one-correct-index"
              value={correctIndex}
              onChange={(e) => setCorrectIndex(parseInt(e.target.value, 10))}
            >
              <option value={0}>Option A</option>
              <option value={1}>Option B</option>
              <option value={2}>Option C</option>
              <option value={3}>Option D</option>
            </select>
          </div>

          <div className="mt-4.5">
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add question'}
            </button>
          </div>
        </div>
      </form>

      {/* 3. Button to open modal */}
      <div className="mt-2">
        <button
          type="button"
          className="btn line w-full min-h-[48px] justify-center"

          onClick={() => setModalOpen(true)}
        >
          {`Edit or delete questions (${questions.length})`}
        </button>
      </div>

      {/* 4. Bank management modal */}
      <QuizBankModal isOpen={modalOpen} onClose={() => setModalOpen(false)} questions={questions} />
    </div>
  );
}
