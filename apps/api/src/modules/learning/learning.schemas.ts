import { z } from 'zod';

const HTTP_URL_REGEX = /^https?:\/\/.+/i;

export const CourseIdParamSchema = z.object({
  id: z.string().uuid('Course ID must be a valid UUID.'),
});

export const QuestionIdParamSchema = z.object({
  id: z.string().uuid('Question ID must be a valid UUID.'),
});

export const CreateCourseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title must not be empty.')
    .max(80, 'Title must be at most 80 characters.'),
  instructor: z
    .string()
    .trim()
    .min(1, 'Instructor name must not be empty.')
    .max(60, 'Instructor name must be at most 60 characters.'),
  duration_weeks: z
    .number({ invalid_type_error: 'Duration in weeks must be a number.' })
    .int('Duration in weeks must be an integer.')
    .min(1, 'Duration must be at least 1 week.')
    .max(52, 'Duration must be at most 52 weeks.'),
  description: z
    .string()
    .trim()
    .max(200, 'Description must be at most 200 characters.'),
  url: z
    .string()
    .trim()
    .regex(HTTP_URL_REGEX, 'Only http:// and https:// URLs are accepted.')
    .max(500, 'URL must be at most 500 characters.'),
});

export const CreateQuizQuestionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question must not be empty.')
    .max(200, 'Question must be at most 200 characters.'),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Option must not be empty.')
        .max(200, 'Option must be at most 200 characters.'),
    )
    .length(4, 'Exactly 4 options are required.'),
  correct_index: z
    .number({ invalid_type_error: 'Correct option index must be a number.' })
    .int()
    .min(0, 'Correct index must be between 0 and 3.')
    .max(3, 'Correct index must be between 0 and 3.'),
});

export const UpdateQuizQuestionSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, 'Question must not be empty.')
    .max(200, 'Question must be at most 200 characters.')
    .optional(),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Option must not be empty.')
        .max(200, 'Option must be at most 200 characters.'),
    )
    .length(4, 'Exactly 4 options are required.')
    .optional(),
  correct_index: z
    .number({ invalid_type_error: 'Correct option index must be a number.' })
    .int()
    .min(0, 'Correct index must be between 0 and 3.')
    .max(3, 'Correct index must be between 0 and 3.')
    .optional(),
  is_active: z.boolean().optional(),
});

export const BulkQuestionItemSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Question must not be empty.')
    .max(200, 'Question must be at most 200 characters.'),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Option must not be empty.')
        .max(200, 'Option must be at most 200 characters.'),
    )
    .length(4, 'Exactly 4 options are required.'),
  answer: z
    .number({ invalid_type_error: 'Answer index must be a number.' })
    .int()
    .min(0, 'Answer index must be between 0 and 3.')
    .max(3, 'Answer index must be between 0 and 3.'),
});

export const BulkQuizQuestionsSchema = z.object({
  questions: z
    .array(BulkQuestionItemSchema)
    .min(1, 'Provide at least one question.')
    .max(200, 'A maximum of 200 questions can be imported at once.'),
});

export const AnswerQuizQuestionSchema = z.object({
  questionId: z.string().uuid('Question ID must be a valid UUID.'),
  selectedIndex: z
    .number({ invalid_type_error: 'Selected index must be a number.' })
    .int()
    .min(0, 'Selected index must be between 0 and 3.')
    .max(3, 'Selected index must be between 0 and 3.'),
});

export type CreateCourseInput = z.infer<typeof CreateCourseSchema>;
export type CreateQuizQuestionInput = z.infer<typeof CreateQuizQuestionSchema>;
export type UpdateQuizQuestionInput = z.infer<typeof UpdateQuizQuestionSchema>;
export type BulkQuizQuestionsInput = z.infer<typeof BulkQuizQuestionsSchema>;
export type AnswerQuizQuestionInput = z.infer<typeof AnswerQuizQuestionSchema>;
