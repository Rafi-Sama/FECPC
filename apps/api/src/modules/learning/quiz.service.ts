import { Injectable, HttpStatus } from '@nestjs/common';
import { DbService } from '../../platform/database/db.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes } from '@fecpc/contracts';
import type { RequestUser } from '../auth/decorators.ts';
import type {
  CreateQuizQuestionInput,
  UpdateQuizQuestionInput,
  BulkQuizQuestionsInput,
  AnswerQuizQuestionInput,
} from './learning.schemas.ts';
import { QUIZ_QUERIES } from './learning.queries.ts';

export interface QuizQuestionDTO {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_today?: boolean;
}

export interface TodayQuizQuestionMemberDTO {
  id: string;
  question: string;
  options: string[];
  position: number;
  answered: boolean;
  selectedIndex?: number;
  isCorrect?: boolean;
  correctIndex?: number;
}

export interface TodayQuizMemberResponse {
  date: string;
  questions: TodayQuizQuestionMemberDTO[];
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
}

export function getAsiaDhakaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
}

@Injectable()
export class QuizService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Lazily initializes today's 5 picks if they don't already exist.
   * Safe against concurrent requests using ON CONFLICT DO NOTHING.
   */
  async ensureDailyPicks(quizDate: string): Promise<void> {
    const existing = await this.db.query(QUIZ_QUERIES.getDailyPicks, [quizDate]);
    if (existing.rowCount && existing.rowCount > 0) {
      return;
    }

    await this.db.run(async (tx) => {
      // Re-check inside transaction in case another request ran concurrently
      const check = await tx.query(QUIZ_QUERIES.getDailyPicks, [quizDate]);
      if (check.rowCount && check.rowCount > 0) {
        return;
      }

      const candidates = await tx.query<{ id: string }>(QUIZ_QUERIES.selectCandidateQuestionIds, [
        quizDate,
      ]);

      for (let i = 0; i < candidates.rows.length; i++) {
        const candidate = candidates.rows[i];
        if (!candidate) continue;
        const position = i + 1;
        await tx.query(QUIZ_QUERIES.insertDailyPick, [quizDate, position, candidate.id]);
      }
    });
  }

  /**
   * Member view: today's 5 questions without correct answers (unless already answered),
   * plus the member's existing answers.
   */
  async getTodayQuizForMember(user: RequestUser): Promise<TodayQuizMemberResponse> {
    const quizDate = getAsiaDhakaDate();
    await this.ensureDailyPicks(quizDate);

    const [picksRes, answersRes] = await Promise.all([
      this.db.query<{
        position: number;
        id: string;
        question: string;
        options: string[];
        correct_index: number;
      }>(QUIZ_QUERIES.getDailyPicks, [quizDate]),
      this.db.query<{
        question_id: string;
        selected_index: number;
        is_correct: boolean;
        answered_at: string;
        correct_index: number;
      }>(QUIZ_QUERIES.getMemberAnswersForDate, [user.id, quizDate]),
    ]);

    const answersMap = new Map<
      string,
      { selectedIndex: number; isCorrect: boolean; correctIndex: number }
    >();
    for (const ans of answersRes.rows) {
      answersMap.set(ans.question_id, {
        selectedIndex: ans.selected_index,
        isCorrect: ans.is_correct,
        correctIndex: ans.correct_index,
      });
    }

    const questions: TodayQuizQuestionMemberDTO[] = picksRes.rows.map((row) => {
      const answered = answersMap.get(row.id);
      if (answered) {
        return {
          id: row.id,
          question: row.question,
          options: row.options,
          position: row.position,
          answered: true,
          selectedIndex: answered.selectedIndex,
          isCorrect: answered.isCorrect,
          correctIndex: answered.correctIndex,
        };
      }

      // Security requirement: NEVER return correct answer or correct index before answering
      return {
        id: row.id,
        question: row.question,
        options: row.options,
        position: row.position,
        answered: false,
      };
    });

    const correctCount = answersRes.rows.filter((a) => a.is_correct).length;

    return {
      date: quizDate,
      questions,
      totalQuestions: questions.length,
      answeredCount: answersRes.rows.length,
      correctCount,
    };
  }

  /**
   * Member submits an answer to one of today's questions.
   */
  async submitAnswer(
    user: RequestUser,
    input: AnswerQuizQuestionInput,
  ): Promise<{ isCorrect: boolean; correctIndex: number }> {
    const quizDate = getAsiaDhakaDate();
    await this.ensureDailyPicks(quizDate);

    // Question must be in today's daily picks
    const inTodayRes = await this.db.query(QUIZ_QUERIES.isQuestionInDailyPicks, [
      quizDate,
      input.questionId,
    ]);
    if (inTodayRes.rowCount === 0) {
      throw new DomainException(
        'This question is not part of today’s quiz.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.BAD_REQUEST,
      );
    }

    // Check if question exists in bank
    const qRes = await this.db.query<{ id: string; correct_index: number }>(
      QUIZ_QUERIES.findQuestionById,
      [input.questionId],
    );
    const question = qRes.rows[0];
    if (!question) {
      throw new DomainException(
        'Question not found.',
        HttpStatus.NOT_FOUND,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const isCorrect = input.selectedIndex === question.correct_index;

    try {
      await this.db.query(QUIZ_QUERIES.insertAnswer, [
        user.id,
        quizDate,
        input.questionId,
        input.selectedIndex,
        isCorrect,
      ]);
    } catch (err: any) {
      // Unique constraint violation (member_id, quiz_date, question_id)
      if (err?.code === '23505') {
        throw new DomainException(
          'You have already answered this question today.',
          HttpStatus.CONFLICT,
          ErrorCodes.STATE_CONFLICT,
        );
      }
      throw err;
    }

    return {
      isCorrect,
      correctIndex: question.correct_index,
    };
  }

  /**
   * Staff view: list all questions in the bank with isToday flag and correct answers.
   */
  async listAllQuestions(_user: RequestUser): Promise<QuizQuestionDTO[]> {
    const quizDate = getAsiaDhakaDate();
    const res = await this.db.query<QuizQuestionDTO>(QUIZ_QUERIES.listAllQuestions, [quizDate]);
    return res.rows;
  }

  /**
   * Staff: add one question to the bank.
   */
  async createQuestion(
    user: RequestUser,
    input: CreateQuizQuestionInput,
  ): Promise<QuizQuestionDTO> {
    const res = await this.db.query<QuizQuestionDTO>(QUIZ_QUERIES.createQuestion, [
      input.question,
      JSON.stringify(input.options),
      input.correct_index,
      user.id,
    ]);
    const question = res.rows[0];
    if (!question) {
      throw new DomainException(
        'Failed to create question.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.quiz_question.created',
      entityType: 'learning_quiz_question',
      entityId: question.id,
      summary: { question: question.question },
    });

    return question;
  }

  /**
   * Staff: bulk import questions (all-or-nothing, max 200, single transaction).
   */
  async bulkCreateQuestions(
    user: RequestUser,
    input: BulkQuizQuestionsInput,
  ): Promise<{ success: boolean; count: number }> {
    const invalidNumbers: number[] = [];

    // Validate every item all-or-nothing
    for (let i = 0; i < input.questions.length; i++) {
      const item = input.questions[i];
      const qNum = i + 1;

      if (!item || !item.q || typeof item.q !== 'string' || item.q.trim().length === 0 || item.q.trim().length > 200) {
        invalidNumbers.push(qNum);
        continue;
      }
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        invalidNumbers.push(qNum);
        continue;
      }
      const hasInvalidOption = item.options.some(
        (opt) => !opt || typeof opt !== 'string' || opt.trim().length === 0 || opt.trim().length > 200,
      );
      if (hasInvalidOption) {
        invalidNumbers.push(qNum);
        continue;
      }
      if (
        typeof item.answer !== 'number' ||
        !Number.isInteger(item.answer) ||
        item.answer < 0 ||
        item.answer > 3
      ) {
        invalidNumbers.push(qNum);
        continue;
      }
    }

    if (invalidNumbers.length > 0) {
      throw new DomainException(
        `Bulk import rejected. Invalid questions at item #${invalidNumbers.join(', #')}. Nothing was added.`,
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_FAILED,
        { questions: [`Invalid question numbers: ${invalidNumbers.join(', ')}`] },
      );
    }

    await this.db.run(async (tx) => {
      for (const item of input.questions) {
        const trimmedOptions = item.options.map((opt) => opt.trim());
        await tx.query(QUIZ_QUERIES.createQuestion, [
          item.q.trim(),
          JSON.stringify(trimmedOptions),
          item.answer,
          user.id,
        ]);
      }
    });

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.quiz_question.bulk_created',
      entityType: 'learning_quiz_question_bulk',
      entityId: 'bulk',
      summary: { count: input.questions.length },
    });

    return { success: true, count: input.questions.length };
  }

  /**
   * Staff: update an existing question.
   */
  async updateQuestion(
    user: RequestUser,
    id: string,
    input: UpdateQuizQuestionInput,
  ): Promise<QuizQuestionDTO> {
    const existing = await this.db.query<QuizQuestionDTO>(QUIZ_QUERIES.findQuestionById, [id]);
    const existingQuestion = existing.rows[0];
    if (!existingQuestion) {
      throw new DomainException(
        'Question not found.',
        HttpStatus.NOT_FOUND,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.question !== undefined) {
      updates.push(`question = $${paramIndex++}`);
      values.push(input.question);
    }
    if (input.options !== undefined) {
      updates.push(`options = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(input.options));
    }
    if (input.correct_index !== undefined) {
      updates.push(`correct_index = $${paramIndex++}`);
      values.push(input.correct_index);
    }
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }

    if (updates.length === 0) {
      return existingQuestion;
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    const updateSql = `
      UPDATE learning_quiz_questions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, question, options, correct_index, is_active, created_by, created_at, updated_at
    `;

    const res = await this.db.query<QuizQuestionDTO>(updateSql, values);
    const updated = res.rows[0];
    if (!updated) {
      throw new DomainException(
        'Failed to update question.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.quiz_question.updated',
      entityType: 'learning_quiz_question',
      entityId: id,
      summary: { question: updated.question },
    });

    return updated;
  }

  /**
   * Staff: delete a question from the bank.
   */
  async deleteQuestion(user: RequestUser, id: string): Promise<{ success: boolean; id: string }> {
    const res = await this.db.query<{ id: string; question: string }>(
      QUIZ_QUERIES.deleteQuestion,
      [id],
    );
    const deleted = res.rows[0];
    if (!deleted) {
      throw new DomainException(
        'Question not found.',
        HttpStatus.NOT_FOUND,
        ErrorCodes.RESOURCE_NOT_FOUND,
      );
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.quiz_question.deleted',
      entityType: 'learning_quiz_question',
      entityId: id,
      summary: { question: deleted.question },
    });

    return { success: true, id };
  }
}
