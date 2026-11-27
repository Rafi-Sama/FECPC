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
      <div className="panel p-12 text-center">
        <h3 className="h3">No quiz today</h3>
        <p className="body text-dim mt-2">The question bank is empty.</p>
      </div>
    );
  }

  const answered = quiz.filter((q) => q.picked !== null).length;
  const correct = quiz.filter((q) => q.picked !== null && q.picked === q.answer).length;
  const allAnswered = answered === quiz.length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {allAnswered ? (
        <div
          className="p-[20px_24px] rounded-[4px] [border:2px_solid_var(--line2)] mb-6 flex items-center justify-between [&&]:border-[#10b981] [background:rgba(16,185,129,0.08)] complete"
          role="status"
        >
          <div>
            <h2 className="h3">
              Today: {correct} of {quiz.length} correct.
            </h2>
            <p className="body text-dim mt-1">New questions tomorrow.</p>
          </div>
          <span className="inline-block p-[2px_8px] rounded-[999px] text-[14px] [font-weight:700] uppercase text-white tracking-[0.05em] bg-[#10b981]">
            Done for today
          </span>
        </div>
      ) : (
        <div
          className="p-[20px_24px] rounded-[4px] [background:var(--panel)] [border:2px_solid_var(--line2)] mb-6 flex items-center justify-between"
          role="status"
        >
          <h2 className="h3">Today&apos;s questions</h2>
          <span className="label font-semibold">
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
              className={`p-6 [border:1px_solid_var(--line)] [background:var(--panel)] rounded-[4px] mb-5 flex flex-col gap-4.5 [&.answered]:opacity-[0.95] ${isAnswered ? 'answered' : ''}`}
              aria-label={`Question ${idx + 1}`}
            >
              <div className="flex items-baseline gap-2.5">
                <span className="[font-weight:700] text-[14px] [color:var(--dim)]">
                  Q{idx + 1}.
                </span>
                <p className="text-[16px] [font-weight:500] text-ink leading-[1.4]">{q.question}</p>
              </div>

              <div
                className="[display:grid] grid-cols-[1fr] gap-2.5"
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
