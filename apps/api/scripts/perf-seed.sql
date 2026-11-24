-- Bulk data for performance testing (docs/performance-audit.md). Run on a throwaway database only, after
-- `pnpm db:setup` against it:  psql "$PERF_DATABASE_URL" -f apps/api/scripts/perf-seed.sql
-- Roughly 10x a large club: 5k members, 500k solves, 20k posts, 1k events, 100k event entries, 200k audit rows.
\set ON_ERROR_STOP on
begin;
select setseed(0.42);

insert into users (id, email, name, batch, dept, squad, role, handle, cf_handle, rating, cf_rating, peak, solved, problems_solved,
                   streak, helper, skills, progress, created_at, pass_hash)
select 'p' || g, 'p' || g || '@perf.example', 'Perf Member ' || g, 18 + g % 9, (array['CSE','EEE','ME','CE'])[1 + g % 4],
       (array['Heap','Trie','Graph','Stack'])[1 + g % 4], case when g % 10 = 0 then 'alumni' else 'member' end,
       'cf_p' || g, 'cf_p' || g, 800 + (g * 37) % 2000, 800 + (g * 37) % 2000, 900 + (g * 37) % 2100, g % 900, g % 900,
       g % 40, g % 15, array['dp','graphs'],
       jsonb_build_object('solved', (select jsonb_agg('cf:' || (1000 + (g * 7 + k) % 900) || 'A') from generate_series(1, 30) k),
                          'read', '[]'::jsonb, 'done', '[]'::jsonb),
       now() - (g % 900) * interval '1 day',
       (select pass_hash from users where pass_hash is not null limit 1)
from generate_series(1, 5000) g;

insert into cf_solves (user_id, problem, rating, at)
select 'p' || u, (1000 + (u * 13 + k) % 2500) || chr(65 + k % 6), 800 + (k % 20) * 100, now() - (k % 365) * interval '1 day'
from generate_series(1, 5000) u, generate_series(1, 100) k
on conflict do nothing;

insert into announcements (user_id, title, body_md, pinned, created_at)
select 'admin', 'Announcement #' || g, repeat('Lorem ipsum dolor sit amet. ', 40), g % 200 = 0, now() - g * interval '1 hour'
from generate_series(1, 2000) g;
insert into announcement_reads (announcement_id, user_id)
select 'an:' || a.id, 'p' || u from (select id from announcements order by id desc limit 100) a, generate_series(1, 2000) u;

insert into club_polls (user_id, question, options, created_at)
select 'admin', 'Poll #' || g, array['A','B','C','D'], now() - g * interval '1 hour' from generate_series(1, 500) g;
insert into votes (user_id, poll_id, option)
select 'p' || u, 'poll:' || p.id, (array['A','B','C','D'])[1 + u % 4] from club_polls p, generate_series(1, 100) u;

insert into reactions (user_id, target) select 'p' || u, 'member:p' || (1 + (u * 7 + k) % 5000) from generate_series(1, 5000) u, generate_series(1, 10) k
on conflict do nothing;

insert into feed_posts (user_id, title, body_md, category, score, created_at)
select 'p' || (1 + g % 5000), 'Feed post ' || g, repeat('Some **markdown** with `code`. ', 60),
       (array['problem-solving','upsolving','topic'])[1 + g % 3], g % 50, now() - g * interval '10 minutes'
from generate_series(1, 20000) g;
insert into feed_votes (user_id, post_id, value)
select 'p' || (1 + (p.id * 31 + k) % 5000), p.id, 1 from feed_posts p, generate_series(1, 10) k on conflict do nothing;
insert into community_comments (target_type, target_id, user_id, body)
select 'feed', p.id, 'p' || (1 + (p.id + k) % 5000), 'Comment ' || k from feed_posts p, generate_series(1, 3) k;

insert into ideas (user_id, title, body_md, type, created_at)
select 'p' || (1 + g % 5000), 'Idea ' || g, repeat('Idea body. ', 50), (array['idea','teammate','study'])[1 + g % 3], now() - g * interval '1 hour'
from generate_series(1, 3000) g;
insert into idea_interests (idea_id, user_id) select i.id, 'p' || (1 + (i.id * 17 + k) % 5000) from ideas i, generate_series(1, 4) k on conflict do nothing;

insert into payments (user_id, invoice_id, label, amount, via, trx, sender, status, created_at)
select 'p' || (1 + g % 5000), 'GIFT-' || g, 'Gift ' || g, 100 + g % 500, 'bKash', 'TRX' || g, '01700000000',
       (array['pending','verified','verified','rejected'])[1 + g % 4], now() - (g % 365) * interval '1 day'
from generate_series(1, 30000) g;
insert into expenses (by, what, amount, event, status, created_at)
select 'admin', 'Expense ' || g, 100 + g % 5000, '', (array['pending','approved','approved','rejected'])[1 + g % 4], now() - (g % 365) * interval '1 day'
from generate_series(1, 5000) g;

insert into club_events (id, title, type, place, about, starts_at, status, seats, fee)
select 'perf-ev-' || g, 'Perf event ' || g, (array['Workshop','Contest','Class','Seminar'])[1 + g % 4], 'Lab ' || g % 5,
       repeat('About this event. ', 30), now() + (g - 500) * interval '1 day',
       case when g > 500 then 'open' else 'completed' end, 500, 0
from generate_series(1, 1000) g;
insert into event_entries (event_id, user_id, name, phone, status)
select 'perf-ev-' || e, 'p' || (1 + (e * 53 + k) % 5000), 'Perf Member', '0170', 'approved'
from generate_series(1, 1000) e, generate_series(1, 100) k on conflict do nothing;
insert into event_feedback (event_id, user_id, rating, body)
select 'perf-ev-' || e, 'p' || (1 + (e * 53 + k) % 5000), 1 + k % 5, 'Good' from generate_series(1, 500) e, generate_series(1, 40) k
on conflict do nothing;
insert into attendance (user_id, key) select 'p' || (1 + (e * 53 + k) % 5000), 'ev:perf-ev-' || e
from generate_series(1, 500) e, generate_series(1, 100) k on conflict do nothing;

insert into milestones (user_id, type, to_value, created_at)
select 'p' || u, 'solved_milestone', (k * 100)::text, now() - (u % 60) * interval '1 day' from generate_series(1, 5000) u, generate_series(1, 4) k;
insert into milestone_kudos (milestone_id, user_id)
select m.id, 'p' || (1 + (m.id * 11 + k) % 5000) from milestones m, generate_series(1, 5) k on conflict do nothing;

insert into applications (name, sid, dept, batch, email, track, why, status, created_at)
select 'Applicant ' || g, 'S' || g, 'CSE', 25, 'app' || g || '@perf.example', 'cp', 'Because.', (array['pending','accepted','declined'])[1 + g % 3],
       now() - g * interval '1 hour'
from generate_series(1, 10000) g;

insert into audit (who, what, at)
select 'Perf Member ' || g % 50, (array['Verified payment PAY-1','Published event x','Changed role of y','Posted announcement z'])[1 + g % 4],
       now() - g * interval '1 minute'
from generate_series(1, 200000) g;

insert into alumni_jobs (alumni_id, company, role, title, url, source, description, created_at)
select 'p' || (10 * (1 + g % 500)), 'Company ' || g % 300, 'Engineer', 'Software Engineer ' || g, 'https://example.com/j/' || g, 'manual',
       repeat('Job description. ', 40), now() - g * interval '1 hour'
from generate_series(1, 2000) g;
insert into blog_posts (author_id, slug, title, excerpt, body_md, status, published_at)
select 'p' || (10 * (1 + g % 500)), 'perf-blog-' || g, 'Blog ' || g, 'Excerpt ' || g, repeat('Blog paragraph with **markdown**.\n\n', 200),
       'published', now() - g * interval '1 hour'
from generate_series(1, 2000) g;

insert into challenges (problem, name, rating, by, at)
select (1000 + g) || 'A', 'Challenge ' || g, 1200, 'p' || g, now() - (g % 30) * interval '1 day' from generate_series(1, 300) g;

insert into mail_queue (to_email, subject, html, kind, status, sent_at)
select 'p' || g || '@perf.example', 'Hello', '<p>hi</p>', 'invite', 'sent', now() - (g % 30) * interval '1 day' from generate_series(1, 50000) g;

-- 1,000 members with a 45 KB uploaded photo: the upper end of what the app stores (lib/image.ts crops uploads to
-- 512 px WebP at q0.85). An 8x8 JPEG padded after its end marker; browsers ignore the tail.
update users set avatar_url = 'data:image/jpeg;base64,' || replace(encode(
    decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCADoD/2Q==', 'base64') || decode(repeat('00', 45000), 'hex'), 'base64'), E'\n', '')
where id ~ '^p[0-9]+$' and substr(id, 2)::int % 5 = 0;

commit;
analyze;
