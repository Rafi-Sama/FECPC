import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.ts';
import { LearningController } from './learning.controller.ts';
import { CoursesService } from './courses.service.ts';
import { QuizService } from './quiz.service.ts';
import { LearningStaffGuard } from './learning.guard.ts';

@Module({
  imports: [AuditModule],
  controllers: [LearningController],
  providers: [CoursesService, QuizService, LearningStaffGuard],
  exports: [CoursesService, QuizService],
})
export class LearningModule {}
