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










