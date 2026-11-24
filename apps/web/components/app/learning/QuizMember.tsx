'use client';
import { useCallback, useEffect, useState } from 'react';
import type { TodayQuizQuestion, TodayQuizResponse } from '@/lib/learning.ts';
import { fetchTodayQuiz, submitQuizAnswer, LearningApiError } from '@/lib/learning.ts';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizMember() {
  const [data, setData] = useState<TodayQuizResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadQuiz = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchTodayQuiz();
      setData(res);
    } catch (err: any) {
      setError(err instanceof LearningApiError ? err.message : 'Could not load today’s quiz.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  const handleSelectOption = async (question: TodayQuizQuestion, optionIndex: number) => {
    if (question.answered || submittingId) return;

    try {
      setSubmittingId(question.id);
      const result = await submitQuizAnswer(question.id, optionIndex);

      setData((prev) => {
        if (!prev) return prev;
        const updatedQuestions = prev.questions.map((q) => {
          if (q.id === question.id) {
            return {
              ...q,
              answered: true,
              selectedIndex: optionIndex,
              isCorrect: result.isCorrect,
              correctIndex: result.correctIndex,
            };
          }
          return q;
        });

        const answeredCount = updatedQuestions.filter((q) => q.answered).length;
        const correctCount = updatedQuestions.filter((q) => q.isCorrect).length;

        return {
          ...prev,
          questions: updatedQuestions,
          answeredCount,
          correctCount,
        };
      });
    } catch (err: any) {
      alert(err instanceof LearningApiError ? err.message : 'Failed to save answer. Try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
        <p className="body" style={{ color: 'var(--dim)' }}>
          Loading today’s questions...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-box error" style={{ margin: '20px 0' }}>
        <p>{error}</p>
        <button type="button" className="btn xs line" onClick={loadQuiz} style={{ marginTop: 8 }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.questions.length === 0) {
    return (
      <div className="panel" style={{ padding: 48, textAlign: 'center' }}>
        <h3 className="h3">No quiz available today</h3>
        <p className="body" style={{ color: 'var(--dim)', marginTop: 8 }}>
          The quiz bank is currently empty. Check back tomorrow!
        </p>
      </div>
    );
  }

  const allAnswered = data.answeredCount === data.totalQuestions && data.totalQuestions > 0;

  return (
    <div className="learning-container">
      {allAnswered ? (
        <div className="quiz-summary-banner complete" role="status">
          <div>
            <h2 className="h3">
              Today: {data.correctCount} of {data.totalQuestions} correct.
            </h2>
            <p className="body" style={{ color: 'var(--dim)', marginTop: 4 }}>
              Come back tomorrow for five new questions.
            </p>
          </div>
          <span className="badge-today" style={{ background: '#10b981' }}>
            Done for today
          </span>
        </div>
      ) : (
        <div className="quiz-summary-banner" role="status">
          <div>
            <h2 className="h3">Daily Practice</h2>
            <p className="body" style={{ color: 'var(--dim)', marginTop: 4 }}>
              Answer today’s five questions. {data.answeredCount} of {data.totalQuestions} completed.
            </p>
          </div>
          <span className="label" style={{ fontWeight: 600 }}>
            {data.answeredCount} / {data.totalQuestions}
          </span>
        </div>
      )}

      <div className="quiz-list">
        {data.questions.map((q, idx) => (
          <section
            key={q.id}
            className={`quiz-card ${q.answered ? 'answered' : ''}`}
            aria-label={`Question ${idx + 1}`}
          >
            <div className="quiz-question-header">
              <span className="quiz-q-num">Q{idx + 1}.</span>
              <p className="quiz-q-text">{q.question}</p>
            </div>

            <div className="quiz-options-list" role="group" aria-label={`Options for question ${idx + 1}`}>
              {q.options.map((opt, optIdx) => {
                const isSelected = q.selectedIndex === optIdx;
                const isAnswered = q.answered;
                const isCorrectOption = q.correctIndex === optIdx;

                let optClass = 'quiz-opt-btn';
                if (isAnswered) {
                  if (isCorrectOption) {
                    optClass += ' correct';
                  } else if (isSelected && !q.isCorrect) {
                    optClass += ' wrong';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    className={optClass}
                    disabled={isAnswered || submittingId === q.id}
                    onClick={() => handleSelectOption(q, optIdx)}
                    aria-pressed={isSelected}
                  >
                    <span className="quiz-opt-indicator">
                      {isAnswered && isCorrectOption ? '✓' : isAnswered && isSelected && !q.isCorrect ? '✗' : OPTION_LETTERS[optIdx]}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
