// Courses and the daily quiz. Holders of full `learning.curate` (CP Head, President) keep the course list and the
// question bank; every member answers today's five once each. Answers are revealed in state only after a pick.
import { canFully, type Role } from '@fecpc/contracts';
import { Fail, type Db } from './db.ts';
import { TZ } from './state.ts';

type Actor = { id: string; roles: Role[]; name: string; system: boolean };
type In = Record<string, unknown>;

function need(ok: unknown, why: string): asserts ok {
  if (!ok) throw new Fail(403, why);
}
const curator = (a: Actor) =>
  need(
    !a.system && canFully(a.roles, 'learning.curate'),
    'Only the CP Head or President keeps courses and the quiz bank.',
  );
const line = (v: unknown, min: number, max: number, what: string) => {
  const t = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
  if (t.length < min || t.length > max)
    throw new Fail(400, `${what} must be ${min} to ${max} characters.`);
  return t;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, what: string) => {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Fail(404, `That ${what} does not exist.`);
  return v;
};
const index = (v: unknown, what: string) => {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 3)
    throw new Fail(400, `${what} must be 0 to 3.`);
  return v as number;
};
/** One question: text, exactly four options, the index of the right one. `n` names it in bulk errors. */
const question = (v: unknown, n = '') => {
  const o = (v && typeof v === 'object' ? v : {}) as In;
  const options = Array.isArray(o.options) ? o.options : [];
  if (options.length !== 4) throw new Fail(400, `${n}Give exactly four options.`);
  return {
    question: line(o.question, 1, 200, `${n}The question`),
    options: options.map((x, k) => line(x, 1, 200, `${n}Option ${'ABCD'[k]}`)),
    answer: index(o.answer, `${n}The answer`),
  };
};
const audit = (c: Db, a: Actor, what: string) =>
  c.query(`insert into audit (who, what) values ($1, $2)`, [a.name, what]);
const insertQuestion = (c: Db, a: Actor, q: ReturnType<typeof question>) =>
  c.query(
    `insert into learning_quiz_questions (question, options, correct_index, created_by) values ($1, $2, $3, $4)`,
    [q.question, JSON.stringify(q.options), q.answer, a.id],
  );

export const learningHandlers: Record<
  string,
  (c: Db, a: Actor, p: unknown, i: In) => Promise<string | void>
> = {
  async courseAdd(c, a, _p, i) {
    curator(a);
    const title = line(i.title, 1, 80, 'The title'),
      instructor = line(i.instructor, 1, 60, 'The instructor'),
      description = line(i.description ?? '', 0, 200, 'The description'),
      url = line(i.url, 8, 500, 'The link'),
      weeks = Number(i.weeks);
    if (!/^https?:\/\//i.test(url))
      throw new Fail(400, 'The link must start with http:// or https://.');
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 52)
      throw new Fail(400, 'The duration must be 1 to 52 weeks.');
    await c.query(
      `insert into learning_courses (title, instructor, duration_weeks, description, url, created_by) values ($1, $2, $3, $4, $5, $6)`,
      [title, instructor, weeks, description, url, a.id],
    );
    await audit(c, a, `added course "${title}"`);
  },
  async courseDelete(c, a, _p, i) {
    curator(a);
    const r = await c.query(`delete from learning_courses where id = $1 returning title`, [
      uuid(i.id, 'course'),
    ]);
    if (!r.rowCount) throw new Fail(404, 'That course does not exist.');
    await audit(c, a, `deleted course "${r.rows[0].title}"`);
  },
  async quizAnswer(c, a, _p, i) {
    need(!a.system, 'This is an operator account, not a member. It cannot do that.');
    const id = uuid(i.id, 'question'),
      pick = index(i.pick, 'The pick');
    // Only one of today's five, only once: the primary key refuses a second answer.
    const r = await c.query(
      `insert into learning_quiz_answers (member_id, quiz_date, question_id, selected_index, is_correct)
       select $1, d.quiz_date, q.id, $3, q.correct_index = $3
       from learning_quiz_daily_picks d join learning_quiz_questions q on q.id = d.question_id
       where d.quiz_date = (now() at time zone '${TZ}')::date and q.id = $2
       on conflict do nothing`,
      [a.id, id, pick],
    );
    if (r.rowCount) return;
    const today = await c.query(
      `select 1 from learning_quiz_daily_picks where quiz_date = (now() at time zone '${TZ}')::date and question_id = $1`,
      [id],
    );
    if (!today.rowCount) throw new Fail(400, 'That question is not in today’s quiz.');
    throw new Fail(409, 'You have already answered that question.');
  },
  async quizAdd(c, a, _p, i) {
    curator(a);
    const q = question(i);
    await insertQuestion(c, a, q);
    await audit(c, a, `added a quiz question`);
  },
  /** All or nothing: one bad item refuses the whole import. */
  async quizImport(c, a, _p, i) {
    curator(a);
    const list = Array.isArray(i.questions) ? i.questions : [];
    if (!list.length || list.length > 200)
      throw new Fail(400, 'Import 1 to 200 questions at a time.');
    const qs = list.map((x, k) => {
      const o = (x && typeof x === 'object' ? x : {}) as In;
      return question(
        { question: o.q, options: o.options, answer: o.answer },
        `Question #${k + 1}: `,
      );
    });
    for (const q of qs) await insertQuestion(c, a, q);
    await audit(c, a, `imported ${qs.length} quiz questions`);
  },
  async quizEdit(c, a, _p, i) {
    curator(a);
    const q = question(i);
    const r = await c.query(
      `update learning_quiz_questions set question = $2, options = $3, correct_index = $4, updated_at = now() where id = $1`,
      [uuid(i.id, 'question'), q.question, JSON.stringify(q.options), q.answer],
    );
    if (!r.rowCount) throw new Fail(404, 'That question does not exist.');
    await audit(c, a, `edited a quiz question`);
  },
  async quizDelete(c, a, _p, i) {
    curator(a);
    const r = await c.query(`delete from learning_quiz_questions where id = $1`, [
      uuid(i.id, 'question'),
    ]);
    if (!r.rowCount) throw new Fail(404, 'That question does not exist.');
    await audit(c, a, `deleted a quiz question`);
  },
};
