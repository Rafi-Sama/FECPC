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
    <div className="learning-container">
      <p className="quiz-staff-sub">Members get five a day.</p>

      {/* 1. Bulk import panel */}
      <BulkImportPanel />

      {/* 2. Add one question form */}
      <form className="course-form-panel" onSubmit={handleCreateOne}>
        <h2 className="h3">Add one question</h2>

        {formError && (
          <div className="alert-box error" style={{ marginTop: 12 }}>
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="alert-box success" style={{ marginTop: 12 }}>
            {formSuccess}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 12,
              marginTop: 14,
            }}
          >
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

          <div className="form-group" style={{ marginTop: 14, maxWidth: 300 }}>
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

          <div style={{ marginTop: 18 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add question'}
            </button>
          </div>
        </div>
      </form>

      {/* 3. Button to open modal */}
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn line"
          style={{ width: '100%', minHeight: 48, justifyContent: 'center' }}
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
