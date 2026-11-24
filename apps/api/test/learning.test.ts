// Backend integration tests for Courses + Daily Quiz (Learning module).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '../src/platform/config/config.service.ts';
import { DbService } from '../src/platform/database/db.service.ts';
import { AuditService } from '../src/modules/audit/audit.service.ts';
import { pool, usePool } from '../src/modules/member-area/db.ts';
import { setup } from '../src/db/seed-data.ts';
import { LearningController } from '../src/modules/learning/learning.controller.ts';
import { CoursesService } from '../src/modules/learning/courses.service.ts';
import { QuizService } from '../src/modules/learning/quiz.service.ts';
import { seedLearning } from '../src/modules/learning/db/learning.seed.ts';
import type { RequestUser } from '../src/modules/auth/decorators.ts';

process.env.DATABASE_URL = (
  process.env.DATABASE_URL || 'postgres://fecpc:fecpc_dev@127.0.0.1:5433/fecpc'
).replace(/\/[^/]+$/, '/fecpc_test');
const PW = 'test-password-123';

const cfg = new ConfigService();
const dbs = new DbService(cfg);
dbs.onModuleInit();
usePool(dbs.getPool());
const audit = new AuditService(dbs);
const coursesService = new CoursesService(dbs, audit);
const quizService = new QuizService(dbs, audit);
const controller = new LearningController(coursesService, quizService);

const db = () => pool();

const memberUser: RequestUser = {
  id: 'mehedi',
  email: 'mehedi@fecpc.example',
  name: 'Mehedi Hasan',
  role: 'member',
  status: 'active',
  handle: 'mehedi_h',
  squad: 'Tree',
};

const cpHeadUser: RequestUser = {
  id: 'nadia',
  email: 'nadia@fecpc.example',
  name: 'Nadia Rahman',
  role: 'cp_head',
  status: 'active',
  handle: 'nadia_r',
  squad: 'Graph',
};

const presidentUser: RequestUser = {
  id: 'tasnim',
  email: 'tasnim@fecpc.example',
  name: 'Tasnim Ahmed',
  role: 'president',
  status: 'active',
  handle: 'tasnim_a',
  squad: 'Stack',
};

/** Asserts the action is refused with the expected HTTP status. */
const refused = (status: number, p: Promise<unknown>) =>
  assert.rejects(
    p,
    (e: unknown) => e instanceof HttpException && e.getStatus() === status,
    `expected a ${status} refusal`,
  );

before(async () => {
  assert.match(process.env.DATABASE_URL!, /fecpc_test$/);
  await db().query(`drop schema public cascade; create schema public`);
  await setup(db(), PW);
  await seedLearning(db());

  // Ensure at least 8 questions exist in the bank for testing picks
  const existingCount = (
    await db().query<{ count: string }>(`SELECT count(*) FROM learning_quiz_questions`)
  ).rows[0]?.count ?? '0';
  if (parseInt(existingCount, 10) < 8) {
    for (let i = 0; i < 5; i++) {
      await db().query(
        `INSERT INTO learning_quiz_questions (question, options, correct_index)
         VALUES ($1, $2::jsonb, $3)`,
        [`Extra Question #${i + 1}`, JSON.stringify(['A', 'B', 'C', 'D']), i % 4],
      );
    }
  }
});

after(() => dbs.onModuleDestroy());

test('learning: a member cannot call any staff endpoint (expect 403)', async () => {
  // Course creation & deletion
  await refused(
    HttpStatus.FORBIDDEN,
    controller.addCourse(memberUser, {
      title: 'Hacking 101',
      instructor: 'Anonymous',
      duration_weeks: 4,
      description: 'Forbidden course.',
      url: 'https://example.com/course',
    }),
  );

  await refused(
    HttpStatus.FORBIDDEN,
    controller.deleteCourse(memberUser, { id: '00000000-0000-0000-0000-000000000001' }),
  );

  // Quiz staff endpoints
  await refused(HttpStatus.FORBIDDEN, controller.listQuestions(memberUser));

  await refused(
    HttpStatus.FORBIDDEN,
    controller.createQuestion(memberUser, {
      question: 'Forbidden question?',
      options: ['A', 'B', 'C', 'D'],
      correct_index: 0,
    }),
  );

  await refused(
    HttpStatus.FORBIDDEN,
    controller.bulkImportQuestions(memberUser, {
      questions: [{ q: 'Bulk Q?', options: ['1', '2', '3', '4'], answer: 1 }],
    }),
  );

  await refused(
    HttpStatus.FORBIDDEN,
    controller.updateQuestion(memberUser, { id: '00000000-0000-0000-0000-000000000001' }, {
      question: 'Updated forbidden?',
    }),
  );

  await refused(
    HttpStatus.FORBIDDEN,
    controller.deleteQuestion(memberUser, { id: '00000000-0000-0000-0000-000000000001' }),
  );

  // Both CP Head and President CAN list questions (authorized)
  const qListCP = await controller.listQuestions(cpHeadUser);
  assert.ok(Array.isArray(qListCP.questions));
  const qListPres = await controller.listQuestions(presidentUser);
  assert.ok(Array.isArray(qListPres.questions));
});

test('learning: GET /learning/quiz/today never contains correct_index or correctIndex before answering', async () => {
  const quiz = await controller.getTodayQuiz(memberUser);

  assert.ok(quiz.questions.length > 0, 'Should return daily questions');
  assert.ok(quiz.questions.length <= 5, 'Should return at most 5 questions');

  for (const q of quiz.questions) {
    assert.equal(
      (q as any).correct_index,
      undefined,
      'Response must never leak raw DB correct_index',
    );
    assert.equal(
      (q as any).correctIndex,
      undefined,
      'Response must never leak correctIndex before answering',
    );
    assert.equal(q.answered, false, 'Should be unanswered initially');
    assert.equal(q.options.length, 4, 'Each question has 4 options');
  }
});

test('learning: answering a question that is not in today’s picks is rejected', async () => {
  const fakeQuestionId = '00000000-0000-0000-0000-999999999999';
  await refused(
    HttpStatus.BAD_REQUEST,
    controller.submitAnswer(memberUser, {
      questionId: fakeQuestionId,
      selectedIndex: 2,
    }),
  );
});

test('learning: answering the same question twice is rejected', async () => {
  const quiz = await controller.getTodayQuiz(memberUser);
  const target = quiz.questions[0];
  assert.ok(target, 'Question from today must exist');

  // First answer succeeds
  const firstAns = await controller.submitAnswer(memberUser, {
    questionId: target.id,
    selectedIndex: 1,
  });
  assert.equal(typeof firstAns.isCorrect, 'boolean');
  assert.equal(typeof firstAns.correctIndex, 'number');

  // Second answer to same question is rejected with 409 Conflict
  await refused(
    HttpStatus.CONFLICT,
    controller.submitAnswer(memberUser, {
      questionId: target.id,
      selectedIndex: 2,
    }),
  );
});

test('learning: bulk import with one invalid item inserts nothing', async () => {
  const countBeforeRes = await db().query<{ count: string }>(
    `SELECT count(*) FROM learning_quiz_questions`,
  );
  const countBefore = parseInt(countBeforeRes.rows[0]?.count ?? '0', 10);

  const payload = {
    questions: [
      {
        q: 'Valid Question 1?',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        answer: 0,
      },
      {
        q: 'Invalid Question 2 (only 2 options)?',
        options: ['Only Two', 'Options'],
        answer: 0,
      },
      {
        q: 'Valid Question 3?',
        options: ['Opt A', 'Opt B', 'Opt C', 'Opt D'],
        answer: 2,
      },
    ],
  };

  await refused(
    HttpStatus.BAD_REQUEST,
    controller.bulkImportQuestions(cpHeadUser, payload as any),
  );

  const countAfterRes = await db().query<{ count: string }>(
    `SELECT count(*) FROM learning_quiz_questions`,
  );
  const countAfter = parseInt(countAfterRes.rows[0]?.count ?? '0', 10);

  assert.equal(countAfter, countBefore, 'Transaction must roll back; no questions added');
});

test('learning: two concurrent first requests of the day produce exactly one set of 5 picks', async () => {
  const testDate = '2099-12-31';
  // Clear any existing picks for this future test date
  await db().query(`DELETE FROM learning_quiz_daily_picks WHERE quiz_date = $1`, [testDate]);

  // Run two pick calls concurrently
  await Promise.all([
    quizService.ensureDailyPicks(testDate),
    quizService.ensureDailyPicks(testDate),
  ]);

  const picksRes = await db().query<{ position: number; question_id: string }>(
    `SELECT position, question_id FROM learning_quiz_daily_picks WHERE quiz_date = $1 ORDER BY position ASC`,
    [testDate],
  );

  assert.equal(picksRes.rows.length, 5, 'Must create exactly 5 picks');
  const positions = picksRes.rows.map((r) => r.position);
  assert.deepEqual(positions, [1, 2, 3, 4, 5], 'Positions must be 1 through 5');

  const uniqueQuestionIds = new Set(picksRes.rows.map((r) => r.question_id));
  assert.equal(uniqueQuestionIds.size, 5, 'Must have 5 unique questions');
});
