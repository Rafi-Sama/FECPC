-- FECPC database schema. Applied in one transaction by src/db/apply-schema.ts (pnpm db:migrate).
-- Every statement is idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / ON CONFLICT), so it upgrades an
-- existing database in place and builds a fresh one from nothing. Append new changes at the end, idempotently.
-- The first part is the original member-area schema; the later part adds auth, audit and community tables.

-- FECPC schema. Idempotent: `npm run db:setup` can run it any number of times.
create table if not exists users (
  id          text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  email       text not null unique check (email = lower(email)),
  pass_hash   text,
  google_sub  text unique,
  invite_hash text,
  role        text not null default 'member' check (role in ('member','mentor','cp_head','treasurer','secretary','president','super_admin')),
  suspended   boolean not null default false,
  name        text not null check (length(name) between 1 and 80),
  handle      text not null default '',
  batch       int  not null check (batch between 0 and 99),
  dept        text not null,
  squad       text not null default 'Heap' check (squad in ('Heap','Trie','Graph','Stack')),
  title       text,
  rating int not null default 0, peak int not null default 0, solved int not null default 0, streak int not null default 0, helper int not null default 0,
  skills      text[] not null default '{}',
  progress    jsonb not null default '{}', -- the member's own lists and preferences; always written under a row lock
  created_at  timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key, -- sha256 of the cookie value; the raw token is never stored
  user_id    text not null references users on delete cascade,
  expires_at timestamptz not null
);
create index if not exists sessions_user on sessions (user_id);
create table if not exists registrations (user_id text not null references users on delete cascade, event_id text not null, primary key (user_id, event_id));
create index if not exists registrations_event on registrations (event_id);
create table if not exists attendance (user_id text not null references users on delete cascade, key text not null, primary key (user_id, key));
create index if not exists attendance_key on attendance (key);
create table if not exists votes (user_id text not null references users on delete cascade, poll_id text not null, option text not null, primary key (user_id, poll_id));
create index if not exists votes_poll on votes (poll_id);
create table if not exists reactions (user_id text not null references users on delete cascade, target text not null, primary key (user_id, target));
create index if not exists reactions_target on reactions (target);
create table if not exists payments (
  id         int generated always as identity primary key,
  user_id    text not null references users on delete cascade,
  invoice_id text not null,
  label      text not null,
  amount     int  not null check (amount > 0),
  via        text not null check (via in ('bKash','Nagad','Rocket')),
  trx        text not null, -- one wallet transaction pays for one thing: see the partial unique index payments_trx_live
  sender     text not null,
  status     text not null default 'pending' check (status in ('pending','verified','rejected')),
  decided_by text references users,
  created_at timestamptz not null default now()
);
create unique index if not exists payments_one_live on payments (user_id, invoice_id) where status <> 'rejected';
create index if not exists payments_status on payments (status);
create table if not exists decisions (kind text not null, id text not null, status text not null, by text not null references users, at timestamptz not null default now(), primary key (kind, id));
create table if not exists applications (
  id int generated always as identity primary key,
  name text not null, sid text not null, dept text not null, batch int not null, email text not null, cf text not null default '', track text not null, why text not null,
  quiz int not null default 0, src text not null default 'Website',
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now()
);
create unique index if not exists applications_one_pending on applications (email) where status = 'pending';
create table if not exists club (key text primary key, value jsonb not null, by text references users, at timestamptz not null default now());
create table if not exists announcements (id int generated always as identity primary key, user_id text not null references users, title text not null, created_at timestamptz not null default now());
create table if not exists audit (id bigint generated always as identity primary key, at timestamptz not null default now(), who text not null, what text not null);
create index if not exists audit_at on audit (at desc);

-- Added after the role-by-role audit. `add column if not exists` keeps this file safe to re-run on an existing database.
alter table users add column if not exists mentor_id text references users on delete set null;
alter table users add column if not exists system boolean not null default false; -- an operator account, not a person: never listed or ranked
alter table users add column if not exists member_no int generated by default as identity;
alter table announcements add column if not exists audience text not null default 'all'; -- 'all' or 'mentees:<mentor id>'
create table if not exists messages (
  id int generated always as identity primary key,
  kind text not null check (kind in ('checkin','suggest','feedback')),
  user_id text references users on delete set null, -- null for anonymous suggestions: the sender is never stored
  to_user text references users on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_to on messages (to_user, kind);
create table if not exists pings (
  from_user text not null references users on delete cascade, to_user text not null references users on delete cascade,
  kind text not null check (kind in ('invite','duel','nudge','team')), ref text not null default '', at timestamptz not null default now(),
  primary key (from_user, to_user, kind, ref)
);
create index if not exists pings_to on pings (to_user);
create table if not exists expenses (
  id int generated always as identity primary key,
  by text not null references users, what text not null, amount int not null check (amount > 0), event text not null default '',
  status text not null default 'pending' check (status in ('pending','sent to President','approved','rejected')),
  decided_by text references users, created_at timestamptz not null default now()
);
create index if not exists expenses_by on expenses (by);
-- A rejected payment frees its transaction ID, so a wrongly rejected one can be submitted again.
alter table payments drop constraint if exists payments_trx_key;
create unique index if not exists payments_trx_live on payments (trx) where status <> 'rejected';
alter table payments add column if not exists note text; -- the reason given when a payment is rejected
alter table users add column if not exists invite_expires timestamptz;

-- Community redesign: Feed, Ideas (merged with Teammates), extended Announcements, user tiers.
create table if not exists feed_posts (
  id         serial primary key,
  user_id    text not null references users(id) on delete cascade,
  title      text not null,
  body_md    text not null,
  category   text not null check (category in ('problem-solving','upsolving','topic')),
  score      integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feed_posts_cat_time on feed_posts (category, created_at desc);
create index if not exists feed_posts_score    on feed_posts (score desc);

create table if not exists feed_votes (
  user_id    text not null references users(id) on delete cascade,
  post_id    integer not null references feed_posts(id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists feed_votes_post on feed_votes (post_id);

create table if not exists feed_reports (
  id         serial primary key,
  post_id    integer not null references feed_posts(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  reason     text not null default '',
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists ideas (
  id         serial primary key,
  user_id    text not null references users(id) on delete cascade,
  title      text not null,
  body_md    text not null,
  type       text not null check (type in ('idea','teammate','study')),
  status     text not null default 'open' check (status in ('open','planned','shipped','closed')),
  roles      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_type_status_time on ideas (type, status, created_at desc);

create table if not exists idea_interests (
  idea_id    integer not null references ideas(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  response   jsonb not null default '{}'::jsonb,
  status     text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (idea_id, user_id)
);
create index if not exists idea_interests_user on idea_interests (user_id);

create table if not exists idea_views (
  idea_id    integer not null references ideas(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table if not exists community_comments (
  id          serial primary key,
  target_type text not null check (target_type in ('feed','idea')),
  target_id   integer not null,
  user_id     text not null references users(id) on delete cascade,
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists community_comments_target on community_comments (target_type, target_id, id asc);

create table if not exists announcement_reads (
  announcement_id text not null,
  user_id         text not null references users(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists announcement_reads_ann on announcement_reads (announcement_id);

-- Announcements: extend
alter table announcements add column if not exists body_md      text;
alter table announcements add column if not exists pinned       boolean not null default false;
alter table announcements add column if not exists requires_ack boolean not null default false;
alter table announcements add column if not exists edited_at    timestamptz;

-- Users: tier color + avatar + Members redesign profile fields
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('member','alumni','mentor','cp_head','treasurer','secretary','president','super_admin'));
alter table users add column if not exists problems_solved       integer not null default 0;
alter table users add column if not exists cf_rating             integer;
alter table users add column if not exists current_streak        integer not null default 0;
alter table users add column if not exists contests_participated integer not null default 0;
alter table users add column if not exists bio                   text;
alter table users add column if not exists cf_handle             text;
alter table users add column if not exists github_url            text;
alter table users add column if not exists linkedin_url          text;
alter table users add column if not exists avatar_url            text;
alter table users add column if not exists experience            jsonb not null default '[]'::jsonb;
alter table users add column if not exists contest_history       jsonb not null default '[]'::jsonb;

update users set problems_solved = solved where problems_solved = 0 and solved > 0;
update users set cf_rating = rating where cf_rating is null and rating > 0;
update users set current_streak = streak where current_streak = 0 and streak > 0;
update users set cf_handle = handle where (cf_handle is null or cf_handle = '') and handle <> '';

-- Alumni jobs (fetched from Greenhouse/Lever boards + manually posted)
create table if not exists alumni_jobs (
  id               serial primary key,
  alumni_id        text references users(id) on delete set null,
  company          text not null,
  role             text not null,
  title            text,
  location         text,
  url              text not null,
  vacancies        integer not null default 1,
  job_type         text,
  experience       text,
  salary           text,
  description      text,
  responsibilities jsonb not null default '[]'::jsonb,
  requirements     jsonb not null default '[]'::jsonb,
  deadline         date,
  company_logo_url text,
  posted_at        timestamptz not null default now(),
  source           text not null check (source in ('fetched','manual')),
  fetched_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists alumni_jobs_alumni on alumni_jobs (alumni_id, created_at desc);

-- Milestones — one row per detected Codeforces achievement
create table if not exists milestones (
  id          serial primary key,
  user_id     text not null references users(id) on delete cascade,
  type        text not null check (type in ('rank_promotion','solved_milestone','contest_streak')),
  from_value  text,      -- e.g. 'Newbie' or '400'
  to_value    text not null,   -- e.g. 'Pupil' or '500'
  threshold   integer,   -- e.g. 1200 (rating) or 500 (solved count) — nullable
  meta        jsonb not null default '{}'::jsonb,   -- extra context: cf_handle, contest_id, etc.
  created_at  timestamptz not null default now(),
  unique (user_id, type, to_value)   -- prevent duplicate "reached Pupil" rows
);
create index if not exists milestones_recent on milestones (created_at desc);
create index if not exists milestones_user   on milestones (user_id, created_at desc);

-- Per-milestone kudos (permanent, non-revocable)
create table if not exists milestone_kudos (
  milestone_id integer not null references milestones(id) on delete cascade,
  user_id      text not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (milestone_id, user_id)
);
create index if not exists milestone_kudos_user_day
  on milestone_kudos (user_id, created_at desc);

-- Alumni section redesign: Directory saves, extended Jobs, Interview prep tree, and Blogs
alter table users add column if not exists available_for_questions boolean not null default true;
alter table users add column if not exists location                text;

create table if not exists alumni_saves (
  user_id    text not null references users(id) on delete cascade,
  alumni_id  text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, alumni_id)
);
create index if not exists alumni_saves_user on alumni_saves (user_id);

alter table alumni_jobs add column if not exists title            text;
alter table alumni_jobs add column if not exists vacancies        integer not null default 1;
alter table alumni_jobs add column if not exists job_type         text;   -- 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
alter table alumni_jobs add column if not exists experience       text;
alter table alumni_jobs add column if not exists salary           text;
alter table alumni_jobs add column if not exists description      text;
alter table alumni_jobs add column if not exists responsibilities jsonb not null default '[]'::jsonb;
alter table alumni_jobs add column if not exists requirements     jsonb not null default '[]'::jsonb;
alter table alumni_jobs add column if not exists deadline         date;
alter table alumni_jobs add column if not exists company_logo_url text;
alter table alumni_jobs add column if not exists posted_at        timestamptz not null default now();

update alumni_jobs set title = role where title is null;

create unique index if not exists alumni_jobs_fetched_dedupe
  on alumni_jobs (company, role, url) where source = 'fetched';

create table if not exists interview_topics (
  id           serial primary key,
  name         text not null unique,
  description  text,
  created_by   text references users(id) on delete set null,
  order_index  integer not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists interview_problems (
  id         serial primary key,
  topic_id   integer not null references interview_topics(id) on delete cascade,
  title      text not null,
  url        text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  meta       jsonb not null default '{}'::jsonb,
  created_by text references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists interview_problems_topic on interview_problems (topic_id);

create table if not exists interview_user_progress (
  user_id    text not null references users(id) on delete cascade,
  problem_id integer not null references interview_problems(id) on delete cascade,
  solved_at  timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create table if not exists interview_tips (
  id         serial primary key,
  author_id  text not null references users(id) on delete cascade,
  topic_id   integer references interview_topics(id) on delete cascade,   -- null = standalone experience
  title      text not null,
  body_md    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists interview_tips_topic  on interview_tips (topic_id);
create index if not exists interview_tips_author on interview_tips (author_id);

create table if not exists blog_posts (
  id           serial primary key,
  author_id    text not null references users(id) on delete cascade,
  slug         text not null unique,
  title        text not null,
  subtitle     text,
  excerpt      text,
  body_md      text not null,
  cover_url    text,
  tags         jsonb not null default '[]'::jsonb,
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  views        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists blog_posts_published on blog_posts (published_at desc) where status = 'published';
create index if not exists blog_posts_author    on blog_posts (author_id, created_at desc);
-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. users

-- Columns added to users after the original schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_on_public_board boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE users SET status = 'suspended' WHERE suspended = true AND status = 'active';

CREATE INDEX IF NOT EXISTS ix_users__role_status ON users (role, status);
CREATE INDEX IF NOT EXISTS ix_users__batch ON users (batch);
CREATE INDEX IF NOT EXISTS ix_users__name_trgm ON users USING gin (lower(name) gin_trgm_ops);

-- 2. credentials
CREATE TABLE IF NOT EXISTS credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3. sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ix_sessions__user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_sessions__expires_at ON sessions (expires_at);

-- 4. tokens
CREATE TABLE IF NOT EXISTS invite_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  key             text PRIMARY KEY,
  attempts        integer NOT NULL DEFAULT 1,
  window_start    timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);
-- Exact-match columns for the per-email and per-IP limits (LIKE on `key` mis-handled % and _ in emails).
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS login_attempts_email ON login_attempts (email);
CREATE INDEX IF NOT EXISTS login_attempts_ip ON login_attempts (ip);

-- 5. audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    text REFERENCES users(id) ON DELETE RESTRICT,
  actor_role  text NOT NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  summary     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash     text,
  request_id  text
);
CREATE INDEX IF NOT EXISTS ix_audit_log__at ON audit_log (at DESC, id);
CREATE INDEX IF NOT EXISTS ix_audit_log__entity ON audit_log (entity_type, entity_id);

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- 6. applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cf_handle text NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS statement text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS quiz_score integer NOT NULL DEFAULT 0;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decline_reason text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decided_by text REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decided_at timestamptz;
UPDATE applications SET student_id = sid WHERE student_id IS NULL AND sid IS NOT NULL;
UPDATE applications SET statement = why WHERE statement IS NULL AND why IS NOT NULL;
UPDATE applications SET cf_handle = cf WHERE cf_handle = '' AND cf IS NOT NULL;
UPDATE applications SET quiz_score = quiz WHERE quiz_score = 0 AND quiz > 0;

CREATE UNIQUE INDEX IF NOT EXISTS ux_applications__email_pending ON applications (email) WHERE status = 'pending';


CREATE INDEX IF NOT EXISTS ix_milestone_kudos__user_day ON milestone_kudos (user_id, created_at DESC);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE payments SET sender_phone = sender WHERE sender_phone IS NULL AND sender IS NOT NULL;
UPDATE payments SET reason = note WHERE reason IS NULL AND note IS NOT NULL;
UPDATE payments SET decided_at = created_at WHERE decided_at IS NULL AND decided_by IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments__via_trx_active ON payments (via, trx) WHERE status IN ('pending','verified');
CREATE UNIQUE INDEX IF NOT EXISTS ux_payments__invoice_pending ON payments (user_id, invoice_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS ix_payments__status_created ON payments (status, created_at);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS proposed_by text REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS proposed_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE expenses SET user_id = by WHERE user_id IS NULL AND by IS NOT NULL;
UPDATE expenses SET decided_at = created_at WHERE decided_at IS NULL AND decided_by IS NOT NULL;

ALTER TABLE registrations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();


-- 12. community (feed_posts, votes, reports, comments, announcements, ideas, polls, suggestions)
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS legacy_id text;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_feed_posts__cat_time ON feed_posts (category, created_at DESC) WHERE deleted_at IS NULL;











-- 13. club posts (aliases over roles) and VJudge sync
ALTER TABLE users ADD COLUMN IF NOT EXISTS post text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vjudge_handle text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vj_solved integer NOT NULL DEFAULT 0;
-- Which existing roles a post grants. Never president or super_admin (enforced by the postRole action).
CREATE TABLE IF NOT EXISTS post_roles (
  post  text PRIMARY KEY,
  roles text[] NOT NULL DEFAULT '{}'
);
INSERT INTO post_roles (post, roles) VALUES
  ('vice_president', '{secretary,cp_head}'),
  ('general_secretary', '{secretary}'),
  ('joint_secretary', '{secretary}'),
  ('organizing_secretary', '{secretary}'),
  ('joint_organizing_secretary', '{secretary}'),
  ('office_secretary', '{secretary}'),
  ('joint_office_secretary', '{secretary}'),
  ('treasurer', '{treasurer}'),
  ('joint_treasurer', '{treasurer}'),
  ('press_secretary', '{secretary}'),
  ('joint_press_secretary', '{secretary}'),
  ('contest_secretary', '{cp_head}'),
  ('joint_contest_secretary', '{cp_head}'),
  ('executive_member', '{}'),
  ('member', '{}')
ON CONFLICT (post) DO NOTHING;

-- 14. waiver requests, the committee's ops board, meetings, inventory and event budgets (were seed constants)
-- Named apart from the empty prototype tables waivers/ops_tasks that some dev databases still have.
CREATE TABLE IF NOT EXISTS waiver_requests (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users ON DELETE CASCADE,
  invoice_id  text NOT NULL,
  what        text NOT NULL,
  amount      int  NOT NULL CHECK (amount > 0),
  reason      text NOT NULL,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','proposed','waived','rejected')),
  proposed_by text REFERENCES users ON DELETE SET NULL,
  decided_by  text REFERENCES users ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- One live request per invoice; a rejected one can be asked again.
CREATE UNIQUE INDEX IF NOT EXISTS waiver_requests_one_live ON waiver_requests (user_id, invoice_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS waiver_requests_status ON waiver_requests (status);
CREATE TABLE IF NOT EXISTS committee_tasks (
  id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      text NOT NULL,
  who        text REFERENCES users ON DELETE SET NULL,
  due        date,
  col        text NOT NULL DEFAULT 'To do',
  created_by text REFERENCES users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS meetings (
  id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  day        date NOT NULL,
  title      text NOT NULL,
  agenda     text[] NOT NULL DEFAULT '{}',
  created_by text REFERENCES users ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS meeting_actions (
  id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meeting_id int NOT NULL REFERENCES meetings ON DELETE CASCADE,
  what       text NOT NULL,
  who        text REFERENCES users ON DELETE SET NULL,
  done       boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS meeting_actions_meeting ON meeting_actions (meeting_id);
CREATE TABLE IF NOT EXISTS inventory (
  id         int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  holder     text REFERENCES users ON DELETE SET NULL,
  created_by text REFERENCES users ON DELETE SET NULL
);
-- Spent = spent_before (from before this ledger existed) + approved expenses whose event is the budget's name.
CREATE TABLE IF NOT EXISTS budgets (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name         text NOT NULL UNIQUE,
  plan         int  NOT NULL CHECK (plan > 0),
  spent_before int  NOT NULL DEFAULT 0 CHECK (spent_before >= 0)
);
-- Demo rows, once, and only after the demo members exist (the seed applies this file again after creating them).
INSERT INTO waiver_requests (user_id, invoice_id, what, amount, reason)
  SELECT u, 'INV-2611', 'Semester subscription, Autumn 2026', 300, r
  FROM (VALUES ('jannat', 'Financial hardship, advisor letter attached'), ('zahid', 'Wallet outage on the due date')) v (u, r)
  WHERE EXISTS (SELECT 1 FROM users WHERE id = v.u) AND NOT EXISTS (SELECT 1 FROM waiver_requests);
INSERT INTO committee_tasks (title, who, due, col)
  SELECT t, (SELECT id FROM users WHERE id = w), d::date, c
  FROM (VALUES
    ('Book Central Lab for contest day', 'nusrat', '2026-11-20', 'Doing'),
    ('Confirm title sponsor instalment 3', 'anika', '2026-11-25', 'To do'),
    ('Set problems for Weekly #43', 'nadia', '2026-11-21', 'Doing'),
    ('Print 180 participant certificates', 'farhan', '2026-12-15', 'To do'),
    ('Publish election nominee list', 'sadia', '2026-11-14', 'Done'),
    ('Order 400 balloons, 8 colours', 'farhan', '2026-12-10', 'To do')) v (t, w, d, c)
  WHERE EXISTS (SELECT 1 FROM users WHERE id = 'nusrat') AND NOT EXISTS (SELECT 1 FROM committee_tasks);
INSERT INTO meetings (day, title, agenda)
  SELECT d::date, t, a::text[]
  FROM (VALUES
    ('2026-11-13', 'General meeting', '{"Contest day roles","Budget vote","New mentor pairs"}'),
    ('2026-10-30', 'Executive sync', '{"Freshers'' Cup review","Sheet v2026.2"}')) v (d, t, a)
  WHERE EXISTS (SELECT 1 FROM users WHERE id = 'nusrat') AND NOT EXISTS (SELECT 1 FROM meetings);
INSERT INTO meeting_actions (meeting_id, what, who)
  SELECT m.id, v.what, v.who
  FROM (VALUES
    ('General meeting', 'Assign 12 volunteers to balloons', 'nusrat'),
    ('General meeting', 'Share budget sheet with members', 'anika'),
    ('Executive sync', 'Publish Freshers'' Cup editorial', 'rahim')) v (title, what, who)
  JOIN meetings m ON m.title = v.title
  WHERE EXISTS (SELECT 1 FROM users WHERE id = v.who) AND NOT EXISTS (SELECT 1 FROM meeting_actions);
INSERT INTO inventory (name, holder)
  SELECT n, (SELECT id FROM users WHERE id = h)
  FROM (VALUES ('Projector (Epson)', NULL), ('Laptop, contest spare #1', 'nusrat'), ('Laptop, contest spare #2', NULL),
    ('Club banner, 8 ft', 'farhan'), ('Champion trophy 2026', NULL)) v (n, h)
  WHERE EXISTS (SELECT 1 FROM users WHERE id = 'nusrat') AND NOT EXISTS (SELECT 1 FROM inventory);
INSERT INTO budgets (name, plan, spent_before)
  SELECT * FROM (VALUES ('Intra-College Contest', 60000, 49200), ('Winter Hack Night', 25000, 14400),
    ('ICPC Mock series', 6000, 2700)) v
  WHERE NOT EXISTS (SELECT 1 FROM budgets);

-- ICPC teams: a member belongs to at most one team; each member keeps their own notebook page per topic.
-- Prefixed `icpc_` because some older databases carry an unrelated, unused `teams` table.
create table if not exists icpc_teams (
  id int generated always as identity primary key,
  name text not null unique,
  coach text references users on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists icpc_members (
  team_id int not null references icpc_teams on delete cascade,
  user_id text not null references users on delete cascade primary key
);
create index if not exists icpc_members_team on icpc_members (team_id);
create table if not exists icpc_notes (
  team_id int not null references icpc_teams on delete cascade,
  user_id text not null references users on delete cascade,
  topic text not null,
  code text not null default '',
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id, topic)
);
create table if not exists icpc_log (
  id bigint generated always as identity primary key,
  team_id int not null references icpc_teams on delete cascade,
  user_id text references users on delete set null,
  what text not null,
  at timestamptz not null default now()
);
create index if not exists icpc_log_team on icpc_log (team_id, id desc);
INSERT INTO icpc_teams (name, coach)
  SELECT 'FEC_NullPointers', 'tanvir'
  WHERE EXISTS (SELECT 1 FROM users WHERE id = 'tanvir') AND NOT EXISTS (SELECT 1 FROM icpc_teams);
INSERT INTO icpc_members (team_id, user_id)
  SELECT t.id, u.id FROM icpc_teams t JOIN users u ON u.id IN ('nadia', 'mehedi', 'rahim')
  WHERE t.name = 'FEC_NullPointers' AND NOT EXISTS (SELECT 1 FROM icpc_members)
  ON CONFLICT DO NOTHING;

-- Problems Codeforces accepted for a member ('282A'), written by syncCodeforces. Sheet ticks earn XP only when listed here.
create table if not exists cf_solves (
  user_id text not null references users on delete cascade,
  problem text not null,
  primary key (user_id, problem)
);

-- Join-form abuse limit: applications per hashed client address.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS ix_applications__ip_hash ON applications (ip_hash, created_at);

-- GitHub sign-in: the GitHub account linked on first use, like google_sub.
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id text UNIQUE;

-- Notebook topics belong to the member, on a team or not. Team pages show each member's own notebook.
create table if not exists notebook (
  user_id text not null references users on delete cascade,
  topic text not null,
  code text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, topic)
);
create table if not exists notebook_log (
  id bigint generated always as identity primary key,
  user_id text not null references users on delete cascade,
  what text not null,
  at timestamptz not null default now()
);
create index if not exists notebook_log_user on notebook_log (user_id, id desc);
-- Move pages from the old team-keyed table once; the delete keeps re-runs from bringing removed topics back.
with moved as (delete from icpc_notes returning user_id, topic, code, updated_at)
insert into notebook (user_id, topic, code, updated_at) select * from moved on conflict do nothing;
-- Who made a notebook change when it was not the page's owner (a teammate's edit).
ALTER TABLE notebook_log ADD COLUMN IF NOT EXISTS by text REFERENCES users ON DELETE SET NULL;
-- Codeforces tags and difficulty of each accepted problem, for the team solve map. Filled by the next sync.
ALTER TABLE cf_solves ADD COLUMN IF NOT EXISTS rating int;
ALTER TABLE cf_solves ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- Events live in the database: President and Secretary create and run them (see docs/events.md).
create table if not exists club_events (
  id text primary key,
  title text not null,
  type text not null default 'Workshop',
  place text not null default '',
  about text not null default '',
  banner text,                                   -- http(s) or data:image URL; null shows the type's pixel banner
  starts_at timestamptz not null,
  reg_opens timestamptz,
  reg_closes timestamptz,
  status text not null default 'draft' check (status in ('draft','published','open','closed','ongoing','completed','cancelled')),
  seats int,                                     -- null: no limit
  fee int not null default 0,
  mode text not null default 'platform' check (mode in ('platform','form')),
  form_url text,
  approval text not null default 'auto' check (approval in ('auto','manual')),
  fields jsonb not null default '[]',            -- custom questions: [{ label, required, options? }]
  certs boolean not null default false,          -- certificate download switched on
  created_by text references users on delete set null,
  created_at timestamptz not null default now()
);
-- Volunteer, TA and other roles an event recruits for. Each has its own method, approval and questions.
create table if not exists event_roles (
  id bigint generated always as identity primary key,
  event_id text not null references club_events on delete cascade,
  title text not null,
  about text not null default '',
  mode text not null default 'platform' check (mode in ('platform','form')),
  form_url text,
  approval text not null default 'manual' check (approval in ('auto','manual')),
  fields jsonb not null default '[]'
);
-- Platform registrations (role_id null) and role applications. Google Forms answers never land here.
create table if not exists event_entries (
  id bigint generated always as identity primary key,
  event_id text not null references club_events on delete cascade,
  role_id bigint references event_roles on delete cascade,
  user_id text not null references users on delete cascade,
  name text not null,
  phone text not null,
  answers jsonb not null default '{}',
  status text not null check (status in ('pending','approved','rejected','cancelled')),
  place int check (place between 1 and 3),       -- 1st, 2nd, 3rd: winners get their own certificate
  at timestamptz not null default now()
);
create unique index if not exists event_entries_one on event_entries (event_id, coalesce(role_id, 0), user_id);
create index if not exists event_entries_user on event_entries (user_id);
create table if not exists event_feedback (
  event_id text not null references club_events on delete cascade,
  user_id text not null references users on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null default '',
  at timestamptz not null default now(),
  primary key (event_id, user_id)
);
-- One raw HTML+CSS template per event and kind: participant, winner1..3, or role:<id>.
create table if not exists cert_templates (
  event_id text not null references club_events on delete cascade,
  kind text not null,
  html text not null,
  primary key (event_id, kind)
);
-- Issued certificates, matched to members by email. `html` is the filled template, rendered to PNG/JPG in the browser.
create table if not exists event_certificates (
  code text primary key,
  event_id text not null references club_events on delete cascade,
  kind text not null,
  email text not null,
  vars jsonb not null,
  html text not null,
  issued_at timestamptz not null default now(),
  unique (event_id, kind, email)
);
create index if not exists event_certificates_email on event_certificates (lower(email));

-- The events that used to be static content, once.
insert into club_events (id, title, type, place, about, starts_at, status, seats, fee)
select * from (values
  ('dp-bootcamp', 'DP Bootcamp, Day 1: states and transitions', 'Class', 'Lab 3, CSE Building', 'From Fibonacci to knapsack. Bring a laptop; assignments are auto-checked against your Codeforces submissions.', timestamptz '2026-11-14 15:00+06', 'open', 60, 0),
  ('weekly-42', 'Weekly Club Contest #42', 'Contest', 'Online, Codeforces group', 'Five problems, two hours, rated for the club ladder. Upsolve thread opens when the timer stops.', '2026-11-16 20:00+06', 'open', 200, 0),
  ('git-night', 'Git for people who are scared of Git', 'Workshop', 'Seminar Room', 'Branches, rebases and how to un-break a repository at 2 a.m. Aimed at first-years.', '2026-11-19 16:30+06', 'open', 80, 0),
  ('icpc-mock-3', 'ICPC Mock #3 (Dhaka Regional replay)', 'ICPC prep', 'Lab 1 + Lab 2', 'Five hours, teams of three, one machine. Scoreboard freezes in the last hour, as it will on the day.', '2026-11-22 10:00+06', 'open', 45, 0),
  ('alumni-talk', 'From Pupil to SWE: an alumni fireside', 'Seminar', 'Auditorium', 'Three graduates on interviews, first jobs and what competitive programming did and did not prepare them for.', '2026-11-27 18:00+06', 'open', 150, 0),
  ('hack-night', 'Winter Hack Night', 'Hackathon', 'CSE Building, all labs', 'Twelve hours, teams of up to four, one theme announced at the door. Food included in the fee.', '2026-12-05 19:00+06', 'open', 120, 150),
  ('intra-contest', 'Intra-College Programming Contest 2026', 'Contest', 'Central Lab Complex', 'The annual contest day. ICPC rules, live scoreboard, balloons, and a prize pool for the top five teams.', '2026-12-18 09:30+06', 'open', 180, 200)
) v where not exists (select 1 from club_events);
-- Old registrations become approved platform entries; the old table is then dropped (it is re-created empty above on each run).
insert into event_entries (event_id, user_id, name, phone, status, at)
  select r.event_id, r.user_id, u.name, '', case when r.status = 'cancelled' then 'cancelled' else 'approved' end, r.created_at
  from registrations r join users u on u.id = r.user_id join club_events e on e.id = r.event_id
  on conflict do nothing;
drop table if exists registrations;

-- Each event has its own check-in room code; attendance keys are event ids.
alter table club_events add column if not exists checkin text not null default upper(substr(md5(random()::text), 1, 6));
-- Certificate emails are stored lower-case, so one address gets one certificate per kind.
delete from event_certificates c where email <> lower(email)
  and exists (select 1 from event_certificates d where d.event_id = c.event_id and d.kind = c.kind and d.email = lower(c.email));
update event_certificates set email = lower(email) where email <> lower(email);

-- Interview prep roadmaps: each topic belongs to one roadmap and hangs off a parent topic (null = root).
create table if not exists interview_roadmaps (
  id          serial primary key,
  name        text not null,
  description text,
  created_by  text references users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table interview_topics add column if not exists roadmap_id integer references interview_roadmaps(id) on delete cascade;
alter table interview_topics add column if not exists parent_id  integer references interview_topics(id) on delete cascade;
alter table interview_topics add column if not exists x          integer not null default 0;
alter table interview_topics add column if not exists y          integer not null default 0;
-- Topic names only need to be unique inside a roadmap.
alter table interview_topics drop constraint if exists interview_topics_name_key;
create index if not exists interview_topics_roadmap on interview_topics (roadmap_id);
-- Topics from before roadmaps existed go into one roadmap: the first is the root, the rest hang under it.
insert into interview_roadmaps (name, description)
  select 'Data structures & algorithms', 'NeetCode 150 and Blind 75 topics.'
  where exists (select 1 from interview_topics where roadmap_id is null);
with o as (
  select id, row_number() over (order by order_index, id) - 1 as i,
         first_value(id) over (order by order_index, id) as root
  from interview_topics where roadmap_id is null
)
update interview_topics t
   set roadmap_id = (select max(id) from interview_roadmaps),
       parent_id = nullif(o.root, o.id),
       x = case when o.i = 0 then 40 else 40 + ((o.i - 1) % 4) * 240 end,
       y = case when o.i = 0 then 40 else 180 + ((o.i - 1) / 4) * 140 end
  from o where t.id = o.id;

-- Optional editorial / playlist link per interview topic.
alter table interview_topics add column if not exists link text;

-- Why an organiser declined an entry; shown to the member.
alter table event_entries add column if not exists reason text;
