export const COURSES_QUERIES = {
  list: `
    SELECT
      id,
      title,
      instructor,
      duration_weeks,
      description,
      url,
      created_by,
      created_at,
      updated_at
    FROM learning_courses
    ORDER BY created_at DESC
  `,
  create: `
    INSERT INTO learning_courses (
      title,
      instructor,
      duration_weeks,
      description,
      url,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      id,
      title,
      instructor,
      duration_weeks,
      description,
      url,
      created_by,
      created_at,
      updated_at
  `,
  delete: `
    DELETE FROM learning_courses
    WHERE id = $1
    RETURNING id, title
  `,
};

export const QUIZ_QUERIES = {
  listAllQuestions: `
    SELECT
      q.id,
      q.question,
      q.options,
      q.correct_index,
      q.is_active,
      q.created_by,
      q.created_at,
      q.updated_at,
      EXISTS (
        SELECT 1
        FROM learning_quiz_daily_picks p
        WHERE p.question_id = q.id AND p.quiz_date = $1
      ) AS is_today
    FROM learning_quiz_questions q
    ORDER BY q.created_at DESC
  `,
  createQuestion: `
    INSERT INTO learning_quiz_questions (
      question,
      options,
      correct_index,
      created_by
    )
    VALUES ($1, $2::jsonb, $3, $4)
    RETURNING
      id,
      question,
      options,
      correct_index,
      is_active,
      created_by,
      created_at,
      updated_at
  `,
  findQuestionById: `
    SELECT
      id,
      question,
      options,
      correct_index,
      is_active
    FROM learning_quiz_questions
    WHERE id = $1
  `,
  deleteQuestion: `
    DELETE FROM learning_quiz_questions
    WHERE id = $1
    RETURNING id, question
  `,
  getDailyPicks: `
    SELECT
      p.position,
      q.id,
      q.question,
      q.options,
      q.correct_index
    FROM learning_quiz_daily_picks p
    JOIN learning_quiz_questions q ON q.id = p.question_id
    WHERE p.quiz_date = $1
    ORDER BY p.position ASC
  `,
  selectCandidateQuestionIds: `
    SELECT q.id
    FROM learning_quiz_questions q
    WHERE q.is_active = true
    ORDER BY
      (
        SELECT MAX(p.quiz_date)
        FROM learning_quiz_daily_picks p
        WHERE p.question_id = q.id AND p.quiz_date < $1
      ) ASC NULLS FIRST,
      random()
    LIMIT 5
  `,
  insertDailyPick: `
    INSERT INTO learning_quiz_daily_picks (quiz_date, position, question_id)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `,
  getMemberAnswersForDate: `
    SELECT
      a.question_id,
      a.selected_index,
      a.is_correct,
      a.answered_at,
      q.correct_index
    FROM learning_quiz_answers a
    JOIN learning_quiz_questions q ON q.id = a.question_id
    WHERE a.member_id = $1 AND a.quiz_date = $2
  `,
  isQuestionInDailyPicks: `
    SELECT 1
    FROM learning_quiz_daily_picks
    WHERE quiz_date = $1 AND question_id = $2
  `,
  insertAnswer: `
    INSERT INTO learning_quiz_answers (
      member_id,
      quiz_date,
      question_id,
      selected_index,
      is_correct
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING member_id, quiz_date, question_id, selected_index, is_correct, answered_at
  `,
};
