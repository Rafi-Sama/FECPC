-- Learning module schema (Courses + Daily Quiz)
-- Idempotent: safe to run on existing or fresh database.

CREATE TABLE IF NOT EXISTS learning_courses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  instructor     text NOT NULL CHECK (char_length(instructor) BETWEEN 1 AND 60),
  duration_weeks smallint NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
  description    text NOT NULL CHECK (char_length(description) <= 200),
  url            text NOT NULL CHECK (url ~* '^https?://'),
  created_by     text REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_quiz_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question      text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  options       jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The 5 questions chosen for a given day. Created lazily on the first request of the day,
-- so the set stays stable even if staff edit the bank during the day.
CREATE TABLE IF NOT EXISTS learning_quiz_daily_picks (
  quiz_date    date NOT NULL,              -- Asia/Dhaka calendar date
  position     smallint NOT NULL CHECK (position BETWEEN 1 AND 5),
  question_id  uuid NOT NULL REFERENCES learning_quiz_questions(id) ON DELETE CASCADE,
  PRIMARY KEY (quiz_date, position),
  UNIQUE (quiz_date, question_id)
);

CREATE TABLE IF NOT EXISTS learning_quiz_answers (
  member_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_date      date NOT NULL,
  question_id    uuid NOT NULL REFERENCES learning_quiz_questions(id) ON DELETE CASCADE,
  selected_index smallint NOT NULL CHECK (selected_index BETWEEN 0 AND 3),
  is_correct     boolean NOT NULL,
  answered_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, quiz_date, question_id)   -- one answer per question per day, no re-answering
);

CREATE INDEX IF NOT EXISTS learning_quiz_answers_member_date_idx ON learning_quiz_answers (member_id, quiz_date);
