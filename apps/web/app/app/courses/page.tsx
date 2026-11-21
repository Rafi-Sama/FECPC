'use client';
import { SaveForm } from '@/components/app/SaveBar';
import { useState } from 'react';
import { Page } from '@/components/app/Shell';
import { useStore } from '@/components/app/Store';
import { cfUrl, sheet } from '@fecpc/content/member-area';
import { courses, quizzes } from '@fecpc/content/training';
import { byId } from '@fecpc/content/site';
import { XP } from '@fecpc/contracts';

export default function Courses() {
  const { s, act } = useStore();
  const [open, setOpen] = useState(courses[0].id);
  const [pick, setPick] = useState<Record<number, number>>({});
  const c = courses.find((x) => x.id === open)!,
    quiz = quizzes[c.id];
  const lk = (i: number) => `${c.id}:${i}`;
  const doneL = c.lessons.filter((_, i) => s.lessons.includes(lk(i))).length;
  const doneA = c.assign.filter((id) => s.solved.includes(id)).length;
  const score = s.quiz[c.id],
    passed = score >= 2;
  const total = c.lessons.length + c.assign.length + 1,
    have = doneL + doneA + (passed ? 1 : 0);
  return (
    <Page
      title={
        s.lessons.length ? (
          <>
            {s.lessons.length} lesson{s.lessons.length > 1 ? 's' : ''}{' '}
            <span className="acc">done.</span>
          </>
        ) : (
          <>
            Start lesson one. <span className="acc">+{XP.lesson} XP.</span>
          </>
        )
      }
    >
      <div className="bento">
        {courses.map((x) => {
          const d = x.lessons.filter((_, i) => s.lessons.includes(`${x.id}:${i}`)).length;
          return (
            <button
              key={x.id}
              className={`panel c4 pick ${x.id === open ? 'sel' : ''}`}
              aria-pressed={x.id === open}
              onClick={() => {
                setOpen(x.id);
                setPick({});
              }}
            >
              <span className="label">
                {x.weeks} weeks · {byId(x.by).name}
              </span>
              <span className="h3">{x.name}</span>
              <span
                className="meter"
                style={{ '--v': `${(d / x.lessons.length) * 100}%` } as React.CSSProperties}
              >
                <i />
              </span>
              <span className="label">
                {d}/{x.lessons.length} lessons
              </span>
            </button>
          );
        })}
        <section className="panel c6">
          <div className="row between">
            <p className="label">Lessons</p>
            <span className="mono acc">
              {doneL}/{c.lessons.length}
            </span>
          </div>
          <div className="list">
            {c.lessons.map((l, i) => {
              const d = s.lessons.includes(lk(i)),
                locked = i > 0 && !s.lessons.includes(lk(i - 1));
              return (
                <div key={l} style={{ opacity: locked ? 0.45 : 1 }}>
                  <span className="mono dim" style={{ width: 28 }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="grow">
                    <strong>{l}</strong>
                  </span>
                  {locked ? (
                    <span className="label dim">after {String(i).padStart(2, '0')}</span>
                  ) : (
                    <button
                      className={`btn xs ${d ? 'line' : ''}`}
                      onClick={() => act('toggle', { list: 'lessons', id: lk(i) })}
                    >
                      {d ? 'Done ✓' : `Mark complete · +${XP.lesson}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel c6">
          <div className="row between">
            <p className="label">Assignments</p>
            <span className="mono acc">
              {doneA}/{c.assign.length}
            </span>
          </div>
          <div className="list">
            {c.assign.map((id) => {
              const p = sheet.find((x) => x.id === id)!,
                d = s.solved.includes(id);
              return (
                <div key={id}>
                  <span className="grow">
                    <a className="link" href={cfUrl(id)} target="_blank" rel="noreferrer">
                      <strong>
                        {id} · {p.name}
                      </strong>
                    </a>
                    <br />
                    <span className="label">rated {p.rating}</span>
                  </span>
                  <span className={`pill ${d ? 'ok' : ''}`}>{d ? 'accepted' : 'pending'}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <p className="label" style={{ marginTop: 8 }}>
            Quiz · pass 2 of 3 for +{XP.quiz} XP
          </p>
          {score !== undefined ? (
            <p className={`h3 ${passed ? 'ok' : 'bad'}`}>
              {score}/3 · {passed ? 'passed' : 'not yet'}{' '}
              <button
                className="link sample"
                onClick={() => {
                  act('quizReset', { course: c.id });
                  setPick({});
                }}
              >
                retake
              </button>
            </p>
          ) : (
            <SaveForm
              className="grid"
              style={{ '--min': '280px', '--g': '24px' } as React.CSSProperties}
              label="Quiz not submitted"
              saveLabel="Submit quiz"
              onDiscard={() => setPick({})}
              onSubmit={() => act('quiz', { course: c.id, picks: quiz.map((_, i) => pick[i]) })}
            >
              {quiz.map((q, i) => (
                <fieldset key={q.q} className="quiz">
                  <legend>
                    {i + 1}. {q.q}
                  </legend>
                  {q.opts.map((o, j) => (
                    <label key={o}>
                      <input
                        type="radio"
                        name={`q${i}`}
                        required
                        checked={pick[i] === j}
                        onChange={() => setPick({ ...pick, [i]: j })}
                      />{' '}
                      {o}
                    </label>
                  ))}
                </fieldset>
              ))}
            </SaveForm>
          )}
        </section>
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <div className="row between">
            <p className="label">{c.name} · completion</p>
            <span className="mono">
              {have}/{total}
            </span>
          </div>
          <div
            className="meter"
            style={{ '--v': `${(have / total) * 100}%` } as React.CSSProperties}
          >
            <i />
          </div>
          {have === total ? (
            <p className="h3 ok">
              Course complete. Certificate FECPC-2026-{c.id.toUpperCase()}-0{c.lessons.length}41
              issued.
            </p>
          ) : (
            <p className="label">
              Certificate at {total}/{total}
            </p>
          )}
        </section>
      </div>
    </Page>
  );
}
