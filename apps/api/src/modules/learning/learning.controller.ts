import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/decorators.ts';
import { LearningStaffGuard, requireLearningStaff } from './learning.guard.ts';
import { CoursesService } from './courses.service.ts';
import { QuizService } from './quiz.service.ts';
import { ZodValidationPipe } from '../../platform/http/zod-validation.pipe.ts';
import {
  CreateCourseSchema,
  CourseIdParamSchema,
  QuestionIdParamSchema,
  CreateQuizQuestionSchema,
  UpdateQuizQuestionSchema,
  BulkQuizQuestionsSchema,
  AnswerQuizQuestionSchema,
  type CreateCourseInput,
  type CreateQuizQuestionInput,
  type UpdateQuizQuestionInput,
  type BulkQuizQuestionsInput,
  type AnswerQuizQuestionInput,
} from './learning.schemas.ts';

@Controller('learning')
export class LearningController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly quizService: QuizService,
  ) {}

  // ---------------------------------------------------------------------------
  // Courses
  // ---------------------------------------------------------------------------

  /** Any logged-in member can list popular courses. */
  @Get('courses')
  async listCourses() {
    const courses = await this.coursesService.listCourses();
    return { courses };
  }

  /** CP Head and President only: add a course. */
  @Post('courses')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.CREATED)
  async addCourse(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateCourseSchema)) body: CreateCourseInput,
  ) {
    requireLearningStaff(user);
    const course = await this.coursesService.createCourse(user, body);
    return { course };
  }

  /** CP Head and President only: delete a course. */
  @Delete('courses/:id')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.OK)
  async deleteCourse(
    @CurrentUser() user: RequestUser,
    @Param(new ZodValidationPipe(CourseIdParamSchema)) params: { id: string },
  ) {
    requireLearningStaff(user);
    return this.coursesService.deleteCourse(user, params.id);
  }

  // ---------------------------------------------------------------------------
  // Daily Quiz (Member)
  // ---------------------------------------------------------------------------

  /** Any logged-in member: today's 5 questions without answers, plus member's answers. */
  @Get('quiz/today')
  async getTodayQuiz(@CurrentUser() user: RequestUser) {
    return this.quizService.getTodayQuizForMember(user);
  }

  /** Any logged-in member: submit an answer to one of today's questions. */
  @Post('quiz/today/answer')
  @HttpCode(HttpStatus.OK)
  async submitAnswer(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(AnswerQuizQuestionSchema)) body: AnswerQuizQuestionInput,
  ) {
    return this.quizService.submitAnswer(user, body);
  }

  // ---------------------------------------------------------------------------
  // Quiz Bank (Staff: CP Head and President)
  // ---------------------------------------------------------------------------

  /** CP Head and President: entire question bank with correct answers and isToday flag. */
  @Get('quiz/questions')
  @UseGuards(LearningStaffGuard)
  async listQuestions(@CurrentUser() user: RequestUser) {
    requireLearningStaff(user);
    const questions = await this.quizService.listAllQuestions(user);
    return { questions };
  }

  /** CP Head and President: add one question to bank. */
  @Post('quiz/questions')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.CREATED)
  async createQuestion(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateQuizQuestionSchema)) body: CreateQuizQuestionInput,
  ) {
    requireLearningStaff(user);
    const question = await this.quizService.createQuestion(user, body);
    return { question };
  }

  /** CP Head and President: bulk import questions (all-or-nothing, max 200). */
  @Post('quiz/questions/bulk')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.CREATED)
  async bulkImportQuestions(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(BulkQuizQuestionsSchema)) body: BulkQuizQuestionsInput,
  ) {
    requireLearningStaff(user);
    return this.quizService.bulkCreateQuestions(user, body);
  }

  /** CP Head and President: edit a question in the bank. */
  @Patch('quiz/questions/:id')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.OK)
  async updateQuestion(
    @CurrentUser() user: RequestUser,
    @Param(new ZodValidationPipe(QuestionIdParamSchema)) params: { id: string },
    @Body(new ZodValidationPipe(UpdateQuizQuestionSchema)) body: UpdateQuizQuestionInput,
  ) {
    requireLearningStaff(user);
    const question = await this.quizService.updateQuestion(user, params.id, body);
    return { question };
  }

  /** CP Head and President: delete a question from the bank. */
  @Delete('quiz/questions/:id')
  @UseGuards(LearningStaffGuard)
  @HttpCode(HttpStatus.OK)
  async deleteQuestion(
    @CurrentUser() user: RequestUser,
    @Param(new ZodValidationPipe(QuestionIdParamSchema)) params: { id: string },
  ) {
    requireLearningStaff(user);
    return this.quizService.deleteQuestion(user, params.id);
  }
}
