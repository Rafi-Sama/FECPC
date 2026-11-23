// Typed client helpers for Courses + Daily Quiz (Learning module).

export interface Course {
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

export interface CreateCoursePayload {
  title: string;
  instructor: string;
  duration_weeks: number;
  description: string;
  url: string;
}

export interface TodayQuizQuestion {
  id: string;
  question: string;
  options: string[];
  position: number;
  answered: boolean;
  selectedIndex?: number;
  isCorrect?: boolean;
  correctIndex?: number;
}

export interface TodayQuizResponse {
  date: string;
  questions: TodayQuizQuestion[];
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctIndex: number;
}

export interface QuizQuestion {
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

export interface CreateQuizQuestionPayload {
  question: string;
  options: string[];
  correct_index: number;
}

export interface UpdateQuizQuestionPayload {
  question?: string;
  options?: string[];
  correct_index?: number;
  is_active?: boolean;
}

export interface BulkQuizItem {
  q: string;
  options: string[];
  answer: number;
}

export interface BulkQuizQuestionsPayload {
  questions: BulkQuizItem[];
}

export class LearningApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'LearningApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/learning${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.error ?? data.detail ?? data.message ?? 'An unexpected error occurred.';
    throw new LearningApiError(message, res.status, data.errors);
  }
  return data as T;
}

export async function fetchCourses(): Promise<Course[]> {
  const data = await request<{ courses: Course[] }>('/courses');
  return data.courses ?? [];
}

export async function createCourse(payload: CreateCoursePayload): Promise<Course> {
  const data = await request<{ course: Course }>('/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.course;
}

export async function deleteCourse(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchTodayQuiz(): Promise<TodayQuizResponse> {
  return request<TodayQuizResponse>('/quiz/today');
}

export async function submitQuizAnswer(
  questionId: string,
  selectedIndex: number,
): Promise<SubmitAnswerResponse> {
  return request<SubmitAnswerResponse>('/quiz/today/answer', {
    method: 'POST',
    body: JSON.stringify({ questionId, selectedIndex }),
  });
}

export async function fetchAllQuizQuestions(): Promise<QuizQuestion[]> {
  const data = await request<{ questions: QuizQuestion[] }>('/quiz/questions');
  return data.questions ?? [];
}

export async function createQuizQuestion(
  payload: CreateQuizQuestionPayload,
): Promise<QuizQuestion> {
  const data = await request<{ question: QuizQuestion }>('/quiz/questions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.question;
}

export async function updateQuizQuestion(
  id: string,
  payload: UpdateQuizQuestionPayload,
): Promise<QuizQuestion> {
  const data = await request<{ question: QuizQuestion }>(`/quiz/questions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.question;
}

export async function deleteQuizQuestion(id: string): Promise<{ success: boolean; id: string }> {
  return request<{ success: boolean; id: string }>(`/quiz/questions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function bulkImportQuizQuestions(
  questions: BulkQuizItem[],
): Promise<{ success: boolean; count: number }> {
  return request<{ success: boolean; count: number }>('/quiz/questions/bulk', {
    method: 'POST',
    body: JSON.stringify({ questions }),
  });
}

/**
 * Strips /* ... *\/ block comments and // line comments before JSON.parse.
 */
export function stripJsonComments(input: string): string {
  let inString = false;
  let stringChar = '';
  let isEscaped = false;
  let inBlockComment = false;
  let inLineComment = false;
  let result = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    result += char;
  }

  return result.trim();
}
