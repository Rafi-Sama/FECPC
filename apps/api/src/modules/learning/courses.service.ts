import { Injectable, HttpStatus } from '@nestjs/common';
import { DbService } from '../../platform/database/db.service.ts';
import { AuditService } from '../audit/audit.service.ts';
import { DomainException } from '../../platform/http/problem-details.filter.ts';
import { ErrorCodes } from '@fecpc/contracts';
import type { RequestUser } from '../auth/decorators.ts';
import type { CreateCourseInput } from './learning.schemas.ts';
import { COURSES_QUERIES } from './learning.queries.ts';

export interface CourseDTO {
  id: string;
  title: string;
  instructor: string;
  duration_weeks: number;
  description: string;
  url: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async listCourses(): Promise<CourseDTO[]> {
    const res = await this.db.query<CourseDTO>(COURSES_QUERIES.list);
    return res.rows;
  }

  async createCourse(user: RequestUser, input: CreateCourseInput): Promise<CourseDTO> {
    const res = await this.db.query<CourseDTO>(COURSES_QUERIES.create, [
      input.title,
      input.instructor,
      input.duration_weeks,
      input.description,
      input.url,
      user.id,
    ]);
    const course = res.rows[0];
    if (!course) {
      throw new DomainException('Failed to create course.', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR);
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.course.created',
      entityType: 'learning_course',
      entityId: course.id,
      summary: {
        title: course.title,
        instructor: course.instructor,
        duration_weeks: course.duration_weeks,
      },
    });

    return course;
  }

  async deleteCourse(user: RequestUser, id: string): Promise<{ success: boolean; id: string }> {
    const res = await this.db.query<{ id: string; title: string }>(COURSES_QUERIES.delete, [id]);
    const course = res.rows[0];
    if (!course) {
      throw new DomainException('Course not found.', HttpStatus.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'learning.course.deleted',
      entityType: 'learning_course',
      entityId: id,
      summary: { title: course.title },
    });

    return { success: true, id };
  }
}
