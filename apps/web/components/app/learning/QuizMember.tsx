'use client';
import { useState } from 'react';
import { useStore } from '@/components/app/Store';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuizMember() {
  const { quiz, act } = useStore();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const pick = async (id: string, optionIndex: number) => {
    if (submittingId) return;
    setSubmittingId(id);
    await act('quizAnswer', { id, pick: optionIndex });
    setSubmittingId(null);
  };

  if (quiz.length === 0) {
    return (
      <div className="panel" style={{ padding: 48, textAlign: 'center' }}>
        <h3 className="h3">No quiz today</h3>
        <p className="body" style={{ color: 'var(--dim)', marginTop: 8 }}>
          The question bank is empty.
        </p>
      </div>
    );
  }

  const answered = quiz.filter((q) => q.picked !== null).length;
  const correct = quiz.filter((q) => q.picked !== null && q.picked === q.answer).length;
  const allAnswered = answered === quiz.length;

  return (
    <div className="learning-container">
      {allAnswered ? (
        <div className="quiz-summary-banner complete" role="status">
          <div>
            <h2 className="h3">
              Today: {correct} of {quiz.length} correct.
            </h2>
            <p className="body" style={{ color: 'var(--dim)', marginTop: 4 }}>
              New questions tomorrow.
            </p>
          </div>
          <span className="badge-today" style={{ background: '#10b981' }}>
            Done for today
          </span>
        </div>
      ) : (
        <div className="quiz-summary-banner" role="status">
          <h2 className="h3">Today&apos;s questions</h2>
          <span className="label" style={{ fontWeight: 600 }}>
            {answered} / {quiz.length}
          </span>
        </div>
      )}

      <div className="quiz-list">
        {quiz.map((q, idx) => {
          const isAnswered = q.picked !== null;
          const isCorrect = isAnswered && q.picked === q.answer;
          return (
            <section
              key={q.id}
              className={`quiz-card ${isAnswered ? 'answered' : ''}`}
              aria-label={`Question ${idx + 1}`}
            >
              <div className="quiz-question-header">
                <span className="quiz-q-num">Q{idx + 1}.</span>
                <p className="quiz-q-text">{q.question}</p>
              </div>

              <div
                className="quiz-options-list"
                role="group"
                aria-label={`Options for question ${idx + 1}`}
              >
                {q.options.map((opt, optIdx) => {
                  const isSelected = q.picked === optIdx;
                  const isCorrectOption = isAnswered && q.answer === optIdx;
                  const isWrongPick = isSelected && !isCorrect;
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      className={`quiz-opt-btn${isCorrectOption ? ' correct' : isWrongPick ? ' wrong' : ''}`}
                      disabled={isAnswered || submittingId !== null}
                      onClick={() => pick(q.id, optIdx)}
                      aria-pressed={isSelected}
                    >
                      <span className="quiz-opt-indicator">
                        {isCorrectOption ? '✓' : isWrongPick ? '✗' : OPTION_LETTERS[optIdx]}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
