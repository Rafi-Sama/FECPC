'use client';
import { useCallback, useEffect, useState } from 'react';
import type { QuizQuestion } from '@/lib/learning.ts';
import { fetchAllQuizQuestions, createQuizQuestion, LearningApiError } from '@/lib/learning.ts';
import { BulkImportPanel } from './BulkImportPanel.tsx';
import { QuizBankModal } from './QuizBankModal.tsx';

export function QuizAdmin() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Add one question form state
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState<[string, string, string, string]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchAllQuizQuestions();
      setQuestions(list);
    } catch {
      // silently handle, user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

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

    try {
      setSubmitting(true);
      const newQ = await createQuizQuestion({
        question: trimmedQ,
        options: trimmedOpts,
        correct_index: correctIndex,
      });

      setQuestions((prev) => [newQ, ...prev]);
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
      setFormSuccess('Question added to bank successfully!');
    } catch (err: any) {
      if (err instanceof LearningApiError) {
        setFormError(err.message);
      } else {
        setFormError('Failed to add question. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="learning-container">
      <header className="quiz-staff-header">
        <h1 className="quiz-staff-title">Quiz bank.</h1>
        <p className="quiz-staff-sub">Add, edit or delete questions. Members get five a day.</p>
      </header>

      {/* 1. Bulk import panel */}
      <BulkImportPanel onImportSuccess={loadQuestions} />

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
                <label htmlFor={`one-opt-${optIdx}`}>Option {String.fromCharCode(65 + optIdx)} *</label>
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
          {loading ? 'Loading quiz bank...' : `Edit or delete questions (${questions.length})`}
        </button>
      </div>

      {/* 4. Bank management modal */}
      <QuizBankModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        questions={questions}
        onQuestionsChanged={loadQuestions}
      />
    </div>
  );
}
