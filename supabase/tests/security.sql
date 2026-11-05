-- Permission and invariant tests. Run with: npm run test:db
-- The last statement always raises, so the whole transaction rolls back and leaves no data.
begin;

create temp table results (name text, actual text, expected text, ok boolean) on commit drop;

create function pg_temp.exec(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare n bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role, 'session_id', 'sess-1')::text, true);
  perform set_config('role', p_role, true);
  execute p_sql;
  get diagnostics n = row_count;
  perform set_config('role', 'none', true);
  return 'ok:' || n;
exception when others then
  return 'err:' || sqlstate;
end $f$;

create function pg_temp.check(p_name text, p_actual text, p_expected text) returns void language sql as $f$
  insert into results values (p_name, p_actual, p_expected, p_actual is not distinct from p_expected);
$f$;

-- Scalar read as the table owner; a missing table or column is a failure, not an abort.
create function pg_temp.val(p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  execute p_sql into v;
  return v;
exception when others then
  return 'err:' || sqlstate;
end $f$;

create function pg_temp.setup(p_sql text) returns void language plpgsql as $f$
begin
  execute p_sql;
exception when others then
  insert into results values ('setup: ' || left(p_sql, 70), 'err:' || sqlstate, 'ok', false);
end $f$;

-- Users
select pg_temp.setup($s$
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    ('00000000-0000-0000-0000-00000000000a', 'admin@test.invalid',   'authenticated', 'authenticated', '{"full_name":"Ada Admin"}'),
    ('00000000-0000-0000-0000-00000000000e', 'editor@test.invalid',  'authenticated', 'authenticated', '{"full_name":"Eli Editor"}'),
    ('00000000-0000-0000-0000-00000000000b', 'blocked@test.invalid', 'authenticated', 'authenticated', '{"full_name":"Bea Blocked"}'),
    ('00000000-0000-0000-0000-00000000000d', 'bloked@test.invalid',  'authenticated', 'authenticated', '{"full_name":"Bob BlockedEditor"}'),
    ('00000000-0000-0000-0000-00000000000f', 'owner@test.invalid',   'authenticated', 'authenticated', '{"full_name":"Olga Owner"}'),
    ('00000000-0000-0000-0000-000000000001', 'reader@test.invalid',  'authenticated', 'authenticated', '{}'),
    ('00000000-0000-0000-0000-000000000002', 'other@test.invalid',   'authenticated', 'authenticated', '{"full_name":"Otto Other"}')
$s$);

select pg_temp.check('signup creates a profile', pg_temp.val($s$select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000001'$s$), '1');
select pg_temp.check('signup never publishes the full email as name', pg_temp.val($s$select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'$s$), 'reader');
select pg_temp.check('signup role is reader', pg_temp.val($s$select role from public.profiles where id = '00000000-0000-0000-0000-000000000002'$s$), 'reader');

select pg_temp.setup($s$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'$s$);
select pg_temp.setup($s$update public.profiles set role = 'editor' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000d')$s$);
select pg_temp.setup($s$update public.profiles set is_blocked = true where id in ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d')$s$);
select pg_temp.setup($s$update public.profiles set role = 'admin', is_protected = true where id = '00000000-0000-0000-0000-00000000000f'$s$);

-- Content
select pg_temp.setup($s$insert into public.categories (id, name, slug) values ('c0000000-0000-0000-0000-000000000001', 'Cat', 'cat-test')$s$);
select pg_temp.setup($s$insert into public.tags (id, name, slug) values ('c0000000-0000-0000-0000-000000000002', 'Tag', 'tag-test')$s$);
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, published_at) values
  ('a0000000-0000-0000-0000-000000000001', 'Pub',    'pub-test',    'x', 'published', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000002', 'Draft',  'draft-test',  'x', 'draft', null),
  ('a0000000-0000-0000-0000-000000000004', 'Future', 'future-test', 'x', 'published', now() + interval '1 day')$s$);
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, scheduled_at) values
  ('a0000000-0000-0000-0000-000000000003', 'Due', 'due-test', 'x', 'scheduled', now() - interval '1 hour')$s$);
select pg_temp.setup($s$insert into public.article_tags (article_id, tag_id) values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002')$s$);
select pg_temp.setup($s$insert into public.comments (id, article_id, user_id, body) values
  (9001, 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'reader comment'),
  (9002, 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'other comment'),
  (9003, 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'to moderate')$s$);

-- Finding 1: nobody promotes or unblocks themselves
select pg_temp.check('reader cannot change own role', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001'$s$), 'err:42501');
select pg_temp.check('blocked user cannot unblock self', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000b', $s$update public.profiles set is_blocked = false where id = '00000000-0000-0000-0000-00000000000b'$s$), 'err:42501');
select pg_temp.check('editor cannot change another role directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e'$s$), 'err:42501');
select pg_temp.check('reader cannot create own profile row', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into public.profiles (id, role) values ('00000000-0000-0000-0000-000000000001', 'admin')$s$), 'err:42501');
select pg_temp.check('reader can edit own name', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$update public.profiles set full_name = 'Rita' where id = '00000000-0000-0000-0000-000000000001'$s$), 'ok:1');
select pg_temp.check('reader cannot edit another name', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-000000000002'$s$), 'ok:0');

select pg_temp.check('anon cannot run admin role change', pg_temp.exec('anon', null, $s$select public.admin_set_user_role('00000000-0000-0000-0000-000000000001', 'admin')$s$), 'err:42501');
select pg_temp.check('reader cannot run admin role change', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select public.admin_set_user_role('00000000-0000-0000-0000-000000000001', 'admin')$s$), 'err:QC403');
select pg_temp.check('editor cannot run admin role change', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.admin_set_user_role('00000000-0000-0000-0000-00000000000e', 'admin')$s$), 'err:QC403');
select pg_temp.check('admin cannot change own role', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_role('00000000-0000-0000-0000-00000000000a', 'reader')$s$), 'err:QC403');
select pg_temp.check('admin cannot change protected owner', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_role('00000000-0000-0000-0000-00000000000f', 'reader')$s$), 'err:QC403');
select pg_temp.check('admin cannot block protected owner', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_block('00000000-0000-0000-0000-00000000000f', true, 'x')$s$), 'err:QC403');
select pg_temp.check('admin promotes a reader', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_role('00000000-0000-0000-0000-000000000002', 'editor')$s$), 'ok:1');
select pg_temp.check('promotion is stored', pg_temp.val($s$select role from public.profiles where id = '00000000-0000-0000-0000-000000000002'$s$), 'editor');
select pg_temp.setup($s$update public.profiles set role = 'reader' where id = '00000000-0000-0000-0000-000000000002'$s$);

-- Finding 9: roles and block reasons are private
select pg_temp.check('anon cannot read profiles', pg_temp.exec('anon', null, 'select role from public.profiles'), 'err:42501');
select pg_temp.check('anon reads safe author data', pg_temp.exec('anon', null, $s$select id, full_name, avatar_url, profile_color from public.public_profiles where id = '00000000-0000-0000-0000-00000000000a'$s$), 'ok:1');
select pg_temp.check('public view hides role', pg_temp.exec('anon', null, 'select role from public.public_profiles'), 'err:42703');
select pg_temp.check('reader sees only own private profile', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select is_blocked from public.profiles'), 'ok:1');
select pg_temp.check('editor sees only own private profile', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select is_blocked from public.profiles'), 'ok:1');
select pg_temp.check('admin sees all private profiles', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000002'$s$), 'ok:1');

-- Article visibility and writes
select pg_temp.check('anon reads published article', pg_temp.exec('anon', null, $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000001'$s$), 'ok:1');
select pg_temp.check('anon cannot read draft', pg_temp.exec('anon', null, $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:0');
select pg_temp.check('anon cannot read future article', pg_temp.exec('anon', null, $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000004'$s$), 'ok:0');
select pg_temp.check('reader cannot read draft', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:0');
select pg_temp.check('editor reads draft', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:1');
select pg_temp.check('reader cannot create article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into public.articles (title, slug, content) values ('x', 'r-test', 'x')$s$), 'err:42501');
select pg_temp.check('anon cannot create article', pg_temp.exec('anon', null, $s$insert into public.articles (title, slug, content) values ('x', 'a-test', 'x')$s$), 'err:42501');
select pg_temp.check('editor creates article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.articles (title, slug, content) values ('x', 'e-test', 'x')$s$), 'ok:1');
select pg_temp.check('editor edits article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.articles set title = 'y' where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:1');
select pg_temp.check('editor cannot delete article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$delete from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:0');
select pg_temp.check('editor cannot create category', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.categories (name, slug) values ('x', 'e-cat')$s$), 'err:42501');
select pg_temp.check('admin creates category', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$insert into public.categories (name, slug) values ('x', 'a-cat')$s$), 'ok:1');
select pg_temp.check('anon reads categories', pg_temp.exec('anon', null, $s$select id from public.categories where slug = 'cat-test'$s$), 'ok:1');
select pg_temp.check('anon cannot write tags', pg_temp.exec('anon', null, $s$delete from public.tags$s$), 'err:42501');

-- Finding 3: a block takes effect in the database
select pg_temp.check('blocked editor cannot create article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000d', $s$insert into public.articles (title, slug, content) values ('x', 'b-test', 'x')$s$), 'err:42501');
select pg_temp.check('blocked editor cannot edit article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000d', $s$update public.articles set title = 'z' where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:0');
select pg_temp.check('blocked editor cannot read drafts', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000d', $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), 'ok:0');
select pg_temp.check('blocked user cannot like', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000b', $s$insert into public.comment_likes (comment_id, user_id) values (9001, '00000000-0000-0000-0000-00000000000b')$s$), 'err:42501');
select pg_temp.check('blocked user cannot delete a comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000b', $s$delete from public.comments where id = 9001$s$), 'ok:0');

select pg_temp.setup($s$insert into auth.sessions (id, user_id) values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$s$);
select pg_temp.check('admin blocks a user', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_block('00000000-0000-0000-0000-000000000002', true, 'spam')$s$), 'ok:1');
select pg_temp.check('blocking closes the user sessions', pg_temp.val($s$select count(*) from auth.sessions where user_id = '00000000-0000-0000-0000-000000000002'$s$), '0');
select pg_temp.check('block reason is stored', pg_temp.val($s$select blocked_reason from public.profiles where id = '00000000-0000-0000-0000-000000000002'$s$), 'spam');
select pg_temp.check('admin unblocks a user', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_block('00000000-0000-0000-0000-000000000002', false, null)$s$), 'ok:1');
select pg_temp.check('unblock clears the reason', pg_temp.val($s$select coalesce(blocked_reason, 'none') from public.profiles where id = '00000000-0000-0000-0000-000000000002'$s$), 'none');

-- Findings 2 and 3: comments only enter through the moderated function
select pg_temp.check('reader cannot insert comment directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into public.comments (article_id, user_id, body) values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'skip moderation')$s$), 'err:42501');
select pg_temp.check('anon cannot insert comment directly', pg_temp.exec('anon', null, $s$insert into public.comments (article_id, user_id, body) values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'x')$s$), 'err:42501');
select pg_temp.check('reader cannot edit a comment directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$update public.comments set body = 'changed after moderation' where id = 9001$s$), 'err:42501');
select pg_temp.check('reader cannot call the service function', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select public.service_post_comment('00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', null, 'impersonated')$s$), 'err:42501');
select pg_temp.check('anon cannot call the service function', pg_temp.exec('anon', null, $s$select public.service_post_comment('00000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', null, 'impersonated')$s$), 'err:42501');
select pg_temp.check('service posts for a user', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000001', null, 'hola')$s$), 'ok:1');
select pg_temp.check('service rejects a blocked user', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000001', null, 'hola')$s$), 'err:QC403');
select pg_temp.check('service rejects a draft article', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000002', null, 'hola')$s$), 'err:QC404');
select pg_temp.check('service rejects a reply to another article', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000004', 9001, 'hola')$s$), 'err:QC404');
select pg_temp.setup($s$update public.articles set published_at = now() - interval '1 day' where id = 'a0000000-0000-0000-0000-000000000004'$s$);
select pg_temp.check('service rejects a parent from a different article', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-000000000004', 9001, 'hola')$s$), 'err:QC400');
select pg_temp.setup($s$update public.articles set published_at = now() + interval '1 day' where id = 'a0000000-0000-0000-0000-000000000004'$s$);
select pg_temp.setup($s$select public.service_post_comment('00000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null, 'c' || g) from generate_series(1, 5) g$s$);
select pg_temp.check('sixth comment in a minute is rate limited', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000f', 'a0000000-0000-0000-0000-000000000001', null, 'sexto')$s$), 'err:QC429');
select pg_temp.check('empty comment is rejected', pg_temp.exec('service_role', null, $s$select public.service_post_comment('00000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001', null, '   ')$s$), 'err:23514');

select pg_temp.check('anon reads comments', pg_temp.exec('anon', null, 'select id from public.comments where id = 9001'), 'ok:1');
select pg_temp.check('reader cannot delete another comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'delete from public.comments where id = 9002'), 'ok:0');
select pg_temp.check('editor cannot delete another comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'delete from public.comments where id = 9002'), 'ok:0');
select pg_temp.check('admin moderates a comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from public.comments where id = 9003'), 'ok:1');
select pg_temp.check('reader deletes own comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', 'delete from public.comments where id = 9002'), 'ok:1');

-- Finding 11: likes count on comments the liker does not own
select pg_temp.check('user likes another comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', $s$insert into public.comment_likes (comment_id, user_id) values (9001, '00000000-0000-0000-0000-000000000002')$s$), 'ok:1');
select pg_temp.check('like raises the counter', pg_temp.val('select like_count from public.comments where id = 9001'), '1');
select pg_temp.check('second like is rejected', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', $s$insert into public.comment_likes (comment_id, user_id) values (9001, '00000000-0000-0000-0000-000000000002')$s$), 'err:23505');
select pg_temp.check('cannot like as someone else', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', $s$insert into public.comment_likes (comment_id, user_id) values (9001, '00000000-0000-0000-0000-00000000000e')$s$), 'err:42501');
select pg_temp.check('user sees own likes only', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select 1 from public.comment_likes'), 'ok:0');
select pg_temp.check('reader cannot set the counter', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'update public.comments set like_count = 999 where id = 9001'), 'err:42501');
select pg_temp.check('removing a like lowers the counter', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', 'delete from public.comment_likes where comment_id = 9001'), 'ok:1');
select pg_temp.check('counter is back to zero', pg_temp.val('select like_count from public.comments where id = 9001'), '0');

-- Finding 6: scheduled articles
select pg_temp.check('scheduled article needs a date', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.articles (title, slug, content, status) values ('x', 's-test', 'x', 'scheduled')$s$), 'err:23514');
select pg_temp.check('publishing without a date gets one', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.articles (title, slug, content, status) values ('x', 'p-test', 'x', 'published')$s$), 'ok:1');
select pg_temp.check('published_at was filled', pg_temp.val($s$select (published_at is not null)::text from public.articles where slug = 'p-test'$s$), 'true');
select pg_temp.check('due article is not public yet', pg_temp.exec('anon', null, $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000003'$s$), 'ok:0');
select pg_temp.check('anon cannot run the publisher', pg_temp.exec('anon', null, 'select private.publish_due_articles()'), 'err:42501');
select pg_temp.check('authenticated cannot run the publisher', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'select private.publish_due_articles()'), 'err:42501');
select pg_temp.setup('select private.publish_due_articles()');
select pg_temp.check('publisher publishes the due article', pg_temp.val($s$select status from public.articles where id = 'a0000000-0000-0000-0000-000000000003'$s$), 'published');
select pg_temp.check('publication date is the scheduled date', pg_temp.val($s$select (published_at = scheduled_at)::text from public.articles where id = 'a0000000-0000-0000-0000-000000000003'$s$), 'true');
select pg_temp.check('published due article is public', pg_temp.exec('anon', null, $s$select id from public.articles where id = 'a0000000-0000-0000-0000-000000000003'$s$), 'ok:1');
select pg_temp.check('publisher is on a schedule', pg_temp.val($s$select count(*) from cron.job where jobname = 'publish-due-articles'$s$), '1');

-- View counter
select pg_temp.check('anon counts a view', pg_temp.exec('anon', null, $s$select public.incrementar_vista('a0000000-0000-0000-0000-000000000001')$s$), 'ok:1');
select pg_temp.check('view is stored', pg_temp.val($s$select views_count from public.articles where id = 'a0000000-0000-0000-0000-000000000001'$s$), '1');
select pg_temp.setup($s$select set_config('role', 'anon', true), public.incrementar_vista('a0000000-0000-0000-0000-000000000002'), set_config('role', 'none', true)$s$);
select pg_temp.check('draft view is not counted', pg_temp.val($s$select views_count from public.articles where id = 'a0000000-0000-0000-0000-000000000002'$s$), '0');
select pg_temp.check('reader cannot set views directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$update public.articles set views_count = 999$s$), 'err:42501');

-- Newsletter
select pg_temp.check('anon subscribes', pg_temp.exec('anon', null, $s$insert into public.newsletter_subscribers (email) values ('a@test.invalid')$s$), 'ok:1');
select pg_temp.check('anon cannot self-confirm', pg_temp.exec('anon', null, $s$insert into public.newsletter_subscribers (email, confirmed) values ('b@test.invalid', true)$s$), 'err:42501');
select pg_temp.check('invalid email is rejected', pg_temp.exec('anon', null, $s$insert into public.newsletter_subscribers (email) values ('not-an-email')$s$), 'err:23514');
select pg_temp.check('same email in other case is a duplicate', pg_temp.exec('anon', null, $s$insert into public.newsletter_subscribers (email) values ('A@TEST.invalid')$s$), 'err:23505');
select pg_temp.check('anon cannot list subscribers', pg_temp.exec('anon', null, 'select email from public.newsletter_subscribers'), 'err:42501');
select pg_temp.check('reader cannot list subscribers', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select email from public.newsletter_subscribers'), 'ok:0');
select pg_temp.check('editor cannot list subscribers', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select email from public.newsletter_subscribers'), 'ok:0');
select pg_temp.check('admin lists subscribers', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select email from public.newsletter_subscribers where email = 'a@test.invalid'$s$), 'ok:1');

-- Finding 14: the audit log cannot be forged or erased
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.9, 10.0.0.1"}', true);
select pg_temp.check('reader cannot write the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into public.admin_access_logs (user_id) values ('00000000-0000-0000-0000-000000000001')$s$), 'err:42501');
select pg_temp.check('anon cannot write the access log', pg_temp.exec('anon', null, $s$insert into public.admin_access_logs (user_id) values (null)$s$), 'err:42501');
select pg_temp.check('editor writes the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.admin_access_logs (user_id, email, role, ip_address, session_id, status) values ('00000000-0000-0000-0000-00000000000a', 'fake@test.invalid', 'admin', '1.1.1.1', 'forged', 'success')$s$), 'ok:1');
select pg_temp.check('log keeps the real user', pg_temp.val('select user_id from public.admin_access_logs order by id desc limit 1'), '00000000-0000-0000-0000-00000000000e');
select pg_temp.check('log keeps the real email', pg_temp.val('select email from public.admin_access_logs order by id desc limit 1'), 'editor@test.invalid');
select pg_temp.check('log keeps the real role', pg_temp.val('select role from public.admin_access_logs order by id desc limit 1'), 'editor');
select pg_temp.check('log keeps the real IP', pg_temp.val('select ip_address from public.admin_access_logs order by id desc limit 1'), '203.0.113.9');
select pg_temp.check('log keeps the real session', pg_temp.val('select session_id from public.admin_access_logs order by id desc limit 1'), 'sess-1');
select pg_temp.check('editor cannot read the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select id from public.admin_access_logs'), 'ok:0');
select pg_temp.check('admin reads the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select id from public.admin_access_logs where user_id = '00000000-0000-0000-0000-00000000000e'$s$), 'ok:1');
select pg_temp.check('admin cannot erase the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from public.admin_access_logs'), 'err:42501');
select pg_temp.check('admin cannot edit the access log', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$update public.admin_access_logs set email = 'x'$s$), 'err:42501');

-- Storage
select pg_temp.check('image buckets exist', pg_temp.val($s$select count(*) from storage.buckets where id in ('article-covers', 'article-media') and public$s$), '2');
select pg_temp.check('svg is not an allowed upload', pg_temp.val($s$select count(*) from storage.buckets where id in ('article-covers', 'article-media') and allowed_mime_types::text like '%svg%'$s$), '0');
select pg_temp.check('anon cannot upload', pg_temp.exec('anon', null, $s$insert into storage.objects (bucket_id, name) values ('article-covers', 'a.webp')$s$), 'err:42501');
select pg_temp.check('reader cannot upload', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into storage.objects (bucket_id, name) values ('article-covers', 'r.webp')$s$), 'err:42501');
select pg_temp.check('blocked editor cannot upload', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000d', $s$insert into storage.objects (bucket_id, name) values ('article-covers', 'b.webp')$s$), 'err:42501');
select pg_temp.check('editor uploads', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into storage.objects (bucket_id, name) values ('article-covers', 'e.webp')$s$), 'ok:1');

-- Deleting keeps the data consistent
select pg_temp.setup($s$insert into public.comment_likes (comment_id, user_id) values (9001, '00000000-0000-0000-0000-00000000000e')$s$);
select pg_temp.check('admin deletes an article', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$delete from public.articles where id = 'a0000000-0000-0000-0000-000000000001'$s$), 'ok:1');
select pg_temp.check('article delete removes its comments', pg_temp.val($s$select count(*) from public.comments where article_id = 'a0000000-0000-0000-0000-000000000001'$s$), '0');
select pg_temp.check('article delete removes its tags', pg_temp.val($s$select count(*) from public.article_tags where article_id = 'a0000000-0000-0000-0000-000000000001'$s$), '0');
select pg_temp.check('comment delete removes its likes', pg_temp.val('select count(*) from public.comment_likes where comment_id = 9001'), '0');
select pg_temp.check('category delete keeps the article', pg_temp.exec('postgres', null, $s$delete from public.categories where id = 'c0000000-0000-0000-0000-000000000001'$s$), 'ok:1');

-- The archive of old rows is not reachable over the API
select pg_temp.check('anon cannot read the archive', pg_temp.exec('anon', null, 'select 1 from private.legacy_data'), 'err:42501');
select pg_temp.check('admin cannot read the archive through the API', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'select 1 from private.legacy_data'), 'err:42501');

-- The switch lock is not reachable over the API
select pg_temp.check('anon cannot read the switch lock', pg_temp.exec('anon', null, 'select 1 from private.cutover'), 'err:42501');
select pg_temp.check('admin cannot clear the switch lock', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from private.cutover'), 'err:42501');

-- Panel: Hoy
select pg_temp.check('anon cannot read dashboard stats', pg_temp.exec('anon', null, 'select public.admin_dashboard_stats()'), 'err:42501');
select pg_temp.check('reader cannot read dashboard stats', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select public.admin_dashboard_stats()'), 'err:42501');
select pg_temp.check('editor reads dashboard stats', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select public.admin_dashboard_stats()'), 'ok:1');
select pg_temp.check('blocked editor cannot read dashboard stats', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000d', 'select public.admin_dashboard_stats()'), 'err:42501');

-- Panel: replacing tags
select pg_temp.check('reader cannot replace tags', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select public.replace_article_tags('a0000000-0000-0000-0000-000000000002', '{}')$s$), 'err:42501');
select pg_temp.check('anon cannot replace tags', pg_temp.exec('anon', null, $s$select public.replace_article_tags('a0000000-0000-0000-0000-000000000002', '{}')$s$), 'err:42501');
select pg_temp.setup($s$insert into public.tags (id, name, slug) values ('b0000000-0000-0000-0000-000000000001', 'T1', 't1-test'), ('b0000000-0000-0000-0000-000000000002', 'T2', 't2-test')$s$);
select pg_temp.check('editor replaces tags', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_article_tags('a0000000-0000-0000-0000-000000000002', '{b0000000-0000-0000-0000-000000000001,b0000000-0000-0000-0000-000000000002}')$s$), 'ok:1');
select pg_temp.check('both tags are stored', pg_temp.val($s$select count(*) from public.article_tags where article_id = 'a0000000-0000-0000-0000-000000000002'$s$), '2');
select pg_temp.check('a tag that does not exist fails', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_article_tags('a0000000-0000-0000-0000-000000000002', '{b0000000-0000-0000-0000-00000000dead}')$s$), 'err:23503');
select pg_temp.check('that failure keeps the old tags', pg_temp.val($s$select count(*) from public.article_tags where article_id = 'a0000000-0000-0000-0000-000000000002'$s$), '2');
select pg_temp.check('replacing removes the rest', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_article_tags('a0000000-0000-0000-0000-000000000002', '{b0000000-0000-0000-0000-000000000002}')$s$), 'ok:1');
select pg_temp.check('one tag is left', pg_temp.val($s$select count(*) from public.article_tags where article_id = 'a0000000-0000-0000-0000-000000000002'$s$), '1');

-- Panel: version history
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status) values ('a0000000-0000-0000-0000-00000000aaaa', 'Original', 'historial-test', 'texto uno', 'draft')$s$);
select pg_temp.check('a new note has no versions', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), '0');
select pg_temp.check('editor edits the note', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.articles set content = 'texto dos' where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), 'ok:1');
select pg_temp.check('editing keeps the old text', pg_temp.val($s$select content from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa' order by id desc limit 1$s$), 'texto uno');
select pg_temp.check('the version records who changed it', pg_temp.val($s$select edited_by from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa' order by id desc limit 1$s$), '00000000-0000-0000-0000-00000000000e');
select pg_temp.setup($s$update public.articles set views_count = views_count + 1 where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$);
select pg_temp.check('a read creates no version', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), '1');
select pg_temp.setup($s$update public.articles set status = 'published', published_at = now() where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$);
select pg_temp.check('publishing creates no version', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), '1');
select pg_temp.setup($s$update public.articles set content = content where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$);
select pg_temp.check('saving without changes creates no version', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), '1');
select pg_temp.check('anon cannot read versions', pg_temp.exec('anon', null, 'select 1 from public.article_revisions'), 'err:42501');
select pg_temp.check('reader cannot read versions', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select 1 from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), 'ok:0');
select pg_temp.check('editor reads versions', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select 1 from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), 'ok:1');
select pg_temp.check('nobody writes versions directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$delete from public.article_revisions$s$), 'err:42501');
select pg_temp.setup($s$do $d$ begin for i in 1..55 loop update public.articles set content = 'v' || i where id = 'a0000000-0000-0000-0000-00000000aaaa'; end loop; end $d$$s$);
select pg_temp.check('only the last 50 versions stay', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), '50');
select pg_temp.check('the oldest versions are the ones removed', pg_temp.val($s$select count(*) from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa' and content = 'texto uno'$s$), '0');
select pg_temp.check('editor cannot restore through the admin function', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.admin_restore_article(1)$s$), 'err:42501');
select pg_temp.setup($s$delete from public.articles where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$);
select pg_temp.check('deleting a note keeps its text', pg_temp.val($s$select content from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa' and is_deletion$s$), 'v55');
select pg_temp.check('admin restores a deleted note', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_restore_article((select id from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000aaaa' and is_deletion))$s$), 'ok:1');
select pg_temp.check('the restored note is a draft with its text', pg_temp.val($s$select status || ':' || content from public.articles where id = 'a0000000-0000-0000-0000-00000000aaaa'$s$), 'draft:v55');

-- Panel: assistant usage
select pg_temp.check('editor cannot reserve assistant use directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000e')$s$), 'err:42501');
select pg_temp.check('anon cannot reserve assistant use', pg_temp.exec('anon', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000e')$s$), 'err:42501');
select pg_temp.check('the function reserves a use', pg_temp.exec('service_role', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000e')$s$), 'ok:1');
select pg_temp.check('the use is counted', pg_temp.val($s$select uses from public.ai_usage where user_id = '00000000-0000-0000-0000-00000000000e'$s$), '1');
select pg_temp.check('the function records tokens', pg_temp.exec('service_role', null, $s$select public.service_record_ai_tokens('00000000-0000-0000-0000-00000000000e', 10, 5)$s$), 'ok:1');
select pg_temp.check('tokens are stored', pg_temp.val($s$select input_tokens + output_tokens from public.ai_usage where user_id = '00000000-0000-0000-0000-00000000000e'$s$), '15');
select pg_temp.check('admin reads usage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select 1 from public.ai_usage where user_id = '00000000-0000-0000-0000-00000000000e'$s$), 'ok:1');
select pg_temp.check('editor does not read usage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select 1 from public.ai_usage'), 'ok:0');
select pg_temp.check('nobody changes usage over the API', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from public.ai_usage'), 'err:42501');
select pg_temp.setup($s$update public.ai_usage set uses = 99 where user_id = '00000000-0000-0000-0000-00000000000e'$s$);
select pg_temp.check('use number 100 is allowed', pg_temp.exec('service_role', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000e')$s$), 'ok:1');
select pg_temp.check('use number 101 is refused', pg_temp.exec('service_role', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000e')$s$), 'err:QC429');
select pg_temp.check('another person still has room', pg_temp.exec('service_role', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-00000000000a')$s$), 'ok:1');
select pg_temp.setup($s$update public.ai_usage set uses = 400 where user_id = '00000000-0000-0000-0000-00000000000a'$s$);
select pg_temp.check('the team cap stops everyone', pg_temp.exec('service_role', null, $s$select public.service_reserve_ai_use('00000000-0000-0000-0000-000000000001')$s$), 'err:QC429');
select pg_temp.setup($s$delete from public.ai_usage$s$);

-- Panel: image library
select pg_temp.check('anon cannot read the library', pg_temp.exec('anon', null, 'select 1 from public.media_assets'), 'err:42501');
select pg_temp.check('reader sees nothing in the library', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select 1 from public.media_assets where url = 'https://x.test/a.webp'$s$), 'ok:0');
select pg_temp.check('reader cannot add to the library', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$insert into public.media_assets (url, source) values ('https://x.test/r.webp', 'url')$s$), 'err:42501');
select pg_temp.check('editor adds an image by address', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.media_assets (url, source) values ('https://x.test/a.webp', 'url')$s$), 'ok:1');
select pg_temp.check('the library records who added it', pg_temp.val($s$select uploaded_by from public.media_assets where url = 'https://x.test/a.webp'$s$), '00000000-0000-0000-0000-00000000000e');
select pg_temp.check('an insecure address is refused', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.media_assets (url, source) values ('http://x.test/b.webp', 'url')$s$), 'err:23514');
select pg_temp.check('editor describes an image', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.media_assets set alt = 'Foto' where url = 'https://x.test/a.webp'$s$), 'ok:1');
select pg_temp.check('editor cannot change an image address', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.media_assets set url = 'https://evil.test/x' where url = 'https://x.test/a.webp'$s$), 'err:42501');
select pg_temp.check('editor removes an image', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$delete from public.media_assets where url = 'https://x.test/a.webp'$s$), 'ok:1');

-- Panel: homepage
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, published_at) values ('a0000000-0000-0000-0000-00000000bbb1', 'Portada', 'portada-test', 'x', 'published', now() - interval '1 hour'), ('a0000000-0000-0000-0000-00000000bbb2', 'Portada 2', 'portada2-test', 'x', 'published', now() - interval '2 hours')$s$);
select pg_temp.check('anon cannot choose the homepage', pg_temp.exec('anon', null, $s$select public.replace_homepage_slots('{a0000000-0000-0000-0000-00000000bbb1}')$s$), 'err:42501');
select pg_temp.check('reader cannot choose the homepage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select public.replace_homepage_slots('{a0000000-0000-0000-0000-00000000bbb1}')$s$), 'err:42501');
select pg_temp.check('editor chooses the homepage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_homepage_slots(array['a0000000-0000-0000-0000-00000000bbb1'::uuid, null, 'a0000000-0000-0000-0000-00000000bbb2'::uuid])$s$), 'ok:1');
select pg_temp.check('each note keeps its place', pg_temp.val($s$select string_agg(position::text, ',' order by position) from public.homepage_slots$s$), '1,3');
select pg_temp.check('anyone can read the homepage', pg_temp.exec('anon', null, 'select 1 from public.homepage_slots'), 'ok:2');
select pg_temp.check('nobody writes the homepage directly', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'delete from public.homepage_slots'), 'err:42501');
select pg_temp.check('a draft cannot go on the homepage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_homepage_slots('{a0000000-0000-0000-0000-000000000002}')$s$), 'err:QC400');
select pg_temp.check('a refused change keeps the homepage', pg_temp.val('select count(*) from public.homepage_slots'), '2');
select pg_temp.check('one note cannot take two places', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_homepage_slots('{a0000000-0000-0000-0000-00000000bbb1,a0000000-0000-0000-0000-00000000bbb1}')$s$), 'err:QC400');
select pg_temp.check('the homepage has six places', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_homepage_slots(array[null,null,null,null,null,null,'a0000000-0000-0000-0000-00000000bbb1'::uuid])$s$), 'err:QC400');
select pg_temp.setup($s$select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true)$s$);
select pg_temp.check('open places are counted', pg_temp.val($s$select (public.admin_dashboard_stats())->>'homepage_open_slots'$s$), '4');
select pg_temp.setup($s$delete from public.articles where id = 'a0000000-0000-0000-0000-00000000bbb2'$s$);
select pg_temp.check('deleting a note empties its place', pg_temp.val($s$select article_id is null from public.homepage_slots where position = 3$s$), 'true');
select pg_temp.setup($s$delete from public.homepage_slots$s$);

-- Panel: a category in use can be deleted
select pg_temp.setup($s$insert into public.categories (id, name, slug) values ('c0000000-0000-0000-0000-00000000ccc1', 'Borrable', 'borrable-test')$s$);
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, category_id) values ('a0000000-0000-0000-0000-00000000ccc2', 'Con sección', 'con-seccion-test', 'x', 'draft', 'c0000000-0000-0000-0000-00000000ccc1')$s$);
select pg_temp.check('admin deletes a category that a note uses', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$delete from public.categories where id = 'c0000000-0000-0000-0000-00000000ccc1'$s$), 'ok:1');
select pg_temp.check('the note stays, without section', pg_temp.val($s$select category_id is null from public.articles where id = 'a0000000-0000-0000-0000-00000000ccc2'$s$), 'true');
select pg_temp.check('restoring a version with a deleted category works', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_restore_article((select id from public.article_revisions where article_id = 'a0000000-0000-0000-0000-00000000ccc2' order by id desc limit 1))$s$), 'ok:1');

-- Panel: the team's authors
select pg_temp.check('anon cannot list authors', pg_temp.exec('anon', null, 'select * from public.list_team_authors()'), 'err:42501');
select pg_temp.check('reader cannot list authors', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select * from public.list_team_authors()'), 'err:42501');
select pg_temp.check('editor sees an administrator among the authors', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select 1 from public.list_team_authors() where id = '00000000-0000-0000-0000-00000000000a'$s$), 'ok:1');

-- Panel: users with email
select pg_temp.check('anon cannot list users', pg_temp.exec('anon', null, 'select * from public.admin_list_users()'), 'err:42501');
select pg_temp.check('reader cannot list users', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select * from public.admin_list_users()'), 'err:42501');
select pg_temp.check('editor cannot list users', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select * from public.admin_list_users()'), 'err:42501');
select pg_temp.check('admin finds a user by email', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select * from public.admin_list_users(1, 'editor@test.invalid')$s$), 'ok:1');
select pg_temp.check('a percent sign is not a wildcard', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select * from public.admin_list_users(1, '%%%')$s$), 'ok:0');

-- Panel: activity log
select pg_temp.check('editor creates a note', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$insert into public.articles (title, slug, content, status) values ('Actividad', 'actividad-test', 'x', 'draft')$s$), 'ok:1');
select pg_temp.check('creating is logged with its author', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'article' and summary = 'Actividad' order by id desc limit 1$s$), 'created:00000000-0000-0000-0000-00000000000e');
select pg_temp.check('editor publishes', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.articles set status = 'published', published_at = now() where slug = 'actividad-test'$s$), 'ok:1');
select pg_temp.check('publishing is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'article' and summary = 'Actividad' order by id desc limit 1$s$), 'published:00000000-0000-0000-0000-00000000000e');
select pg_temp.check('editor edits', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.articles set content = 'y' where slug = 'actividad-test'$s$), 'ok:1');
select pg_temp.check('editing is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'article' and summary = 'Actividad' order by id desc limit 1$s$), 'edited:00000000-0000-0000-0000-00000000000e');
select pg_temp.setup($s$update public.articles set views_count = views_count + 1 where slug = 'actividad-test'$s$);
select pg_temp.check('a read is not activity', pg_temp.val($s$select count(*) from public.activity_log where entity = 'article' and summary = 'Actividad'$s$), '3');
select pg_temp.check('editor unpublishes', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$update public.articles set status = 'draft' where slug = 'actividad-test'$s$), 'ok:1');
select pg_temp.check('unpublishing is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'article' and summary = 'Actividad' order by id desc limit 1$s$), 'unpublished:00000000-0000-0000-0000-00000000000e');
select pg_temp.setup($s$insert into public.comments (id, article_id, user_id, body) values (9901, (select id from public.articles where slug = 'actividad-test'), '00000000-0000-0000-0000-000000000002', 'A moderar')$s$);
select pg_temp.check('admin removes a comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from public.comments where id = 9901'), 'ok:1');
select pg_temp.check('moderating is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'comment' and entity_id = '9901' order by id desc limit 1$s$), 'deleted:00000000-0000-0000-0000-00000000000a');
select pg_temp.setup($s$insert into public.comments (id, article_id, user_id, body) values (9902, (select id from public.articles where slug = 'actividad-test'), '00000000-0000-0000-0000-000000000002', 'Mío')$s$);
select pg_temp.check('a person removes their own comment', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000002', 'delete from public.comments where id = 9902'), 'ok:1');
select pg_temp.check('removing your own comment is not moderation', pg_temp.val($s$select count(*) from public.activity_log where entity = 'comment' and entity_id = '9902'$s$), '0');
select pg_temp.check('admin changes a role', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_role('00000000-0000-0000-0000-000000000002', 'editor')$s$), 'ok:1');
select pg_temp.check('a role change is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'user' and entity_id = '00000000-0000-0000-0000-000000000002' order by id desc limit 1$s$), 'role_changed:00000000-0000-0000-0000-00000000000a');
select pg_temp.check('admin blocks someone', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select public.admin_set_user_block('00000000-0000-0000-0000-000000000002', true, 'Motivo')$s$), 'ok:1');
select pg_temp.check('a block is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'user' and entity_id = '00000000-0000-0000-0000-000000000002' order by id desc limit 1$s$), 'blocked:00000000-0000-0000-0000-00000000000a');
select pg_temp.setup($s$select public.admin_set_user_block('00000000-0000-0000-0000-000000000002', false, '')$s$);
select pg_temp.check('admin creates a category', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$insert into public.categories (id, name, slug) values ('c0000000-0000-0000-0000-00000000ddd2', 'Nueva', 'nueva-test')$s$), 'ok:1');
select pg_temp.check('a new category is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'category' and entity_id = 'c0000000-0000-0000-0000-00000000ddd2' order by id desc limit 1$s$), 'created:00000000-0000-0000-0000-00000000000a');
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, published_at) values ('a0000000-0000-0000-0000-00000000ddd3', 'Para portada', 'para-portada-test', 'x', 'published', now() - interval '1 hour')$s$);
select pg_temp.setup($s$delete from public.activity_log where entity = 'homepage'$s$);
select pg_temp.check('editor saves the homepage', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select public.replace_homepage_slots('{a0000000-0000-0000-0000-00000000ddd3}')$s$), 'ok:1');
select pg_temp.check('the homepage change is logged once', pg_temp.val($s$select count(*) from public.activity_log where entity = 'homepage' and actor_id = '00000000-0000-0000-0000-00000000000e'$s$), '1');
select pg_temp.check('admin deletes a note', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$delete from public.articles where slug = 'actividad-test'$s$), 'ok:1');
select pg_temp.check('deleting is logged', pg_temp.val($s$select action || ':' || coalesce(actor_id::text, 'sistema') from public.activity_log where entity = 'article' and entity = 'article' and summary = 'Actividad' order by id desc limit 1$s$), 'deleted:00000000-0000-0000-0000-00000000000a');
select pg_temp.check('admin reads the activity', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$select 1 from public.activity_log where entity = 'article' and summary = 'Actividad' limit 1$s$), 'ok:1');
select pg_temp.check('editor does not read the activity', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', 'select 1 from public.activity_log'), 'ok:0');
select pg_temp.check('anon does not read the activity', pg_temp.exec('anon', null, 'select 1 from public.activity_log'), 'err:42501');
select pg_temp.check('nobody forges activity', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', $s$insert into public.activity_log (action, entity, summary) values ('x', 'x', 'x')$s$), 'err:42501');
select pg_temp.check('nobody erases activity', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000a', 'delete from public.activity_log'), 'err:42501');

-- Panel: reads per day
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status, published_at) values ('a0000000-0000-0000-0000-00000000eee1', 'Lecturas', 'lecturas-test', 'x', 'published', now() - interval '1 hour')$s$);
select pg_temp.setup($s$insert into public.articles (id, title, slug, content, status) values ('a0000000-0000-0000-0000-00000000eee2', 'Borrador lecturas', 'borrador-lecturas-test', 'x', 'draft')$s$);
select pg_temp.check('a reader counts a view', pg_temp.exec('anon', null, $s$select public.incrementar_vista('a0000000-0000-0000-0000-00000000eee1')$s$), 'ok:1');
select pg_temp.setup($s$select public.incrementar_vista('a0000000-0000-0000-0000-00000000eee1')$s$);
select pg_temp.check('the total goes up', pg_temp.val($s$select views_count from public.articles where id = 'a0000000-0000-0000-0000-00000000eee1'$s$), '2');
select pg_temp.check('the day goes up by the same', pg_temp.val($s$select views from public.article_views_daily where article_id = 'a0000000-0000-0000-0000-00000000eee1'$s$), '2');
select pg_temp.setup($s$select public.incrementar_vista('a0000000-0000-0000-0000-00000000eee2')$s$);
select pg_temp.check('a draft counts nowhere', pg_temp.val($s$select count(*) from public.article_views_daily where article_id = 'a0000000-0000-0000-0000-00000000eee2'$s$), '0');
select pg_temp.check('late at night still counts as that day in Paraguay', pg_temp.val($s$select private.local_day('2026-11-05 02:30:00+00')$s$), '2026-11-04');
select pg_temp.check('anon cannot read reads per day', pg_temp.exec('anon', null, 'select 1 from public.article_views_daily'), 'err:42501');
select pg_temp.check('reader cannot read reads per day', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', 'select 1 from public.article_views_daily'), 'ok:0');
select pg_temp.check('reader cannot read the series', pg_temp.exec('authenticated', '00000000-0000-0000-0000-000000000001', $s$select * from public.admin_reads_series(current_date - 1, current_date + 1)$s$), 'err:42501');
select pg_temp.check('editor reads the series', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select * from public.admin_reads_series(current_date - 2, current_date + 2)$s$), 'ok:1');
select pg_temp.check('anon cannot read the ranking', pg_temp.exec('anon', null, $s$select * from public.admin_reads_by('article', current_date, current_date)$s$), 'err:42501');
select pg_temp.check('editor reads the ranking by note', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select * from public.admin_reads_by('article', current_date - 2, current_date + 2)$s$), 'ok:1');
select pg_temp.check('editor reads the ranking by section', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select * from public.admin_reads_by('category', current_date - 2, current_date + 2)$s$), 'ok:1');
select pg_temp.check('editor reads the ranking by author', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select * from public.admin_reads_by('author', current_date - 2, current_date + 2)$s$), 'ok:1');
select pg_temp.check('an unknown grouping is refused', pg_temp.exec('authenticated', '00000000-0000-0000-0000-00000000000e', $s$select * from public.admin_reads_by('x', current_date, current_date)$s$), 'err:22023');
select pg_temp.setup($s$delete from public.articles where id = 'a0000000-0000-0000-0000-00000000eee1'$s$);
select pg_temp.check('deleting a note removes its daily reads', pg_temp.val($s$select count(*) from public.article_views_daily where article_id = 'a0000000-0000-0000-0000-00000000eee1'$s$), '0');

-- Structure
select pg_temp.check('every public table has RLS', pg_temp.val($s$select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$s$), '0');
select pg_temp.check('anon has no whole-table write access', pg_temp.val($s$select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'INSERT, UPDATE, DELETE')$s$), '0');
select pg_temp.check('security definer functions pin search_path', pg_temp.val($s$select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prosecdef and p.proconfig is null$s$), '0');
select pg_temp.check('comments are published to realtime', pg_temp.val($s$select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comments'$s$), '1');
select pg_temp.check('editor role exists', pg_temp.val($s$select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'user_role' and e.enumlabel = 'editor'$s$), '1');
select pg_temp.check('archived status exists', pg_temp.val($s$select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'article_status' and e.enumlabel = 'archived'$s$), '1');

-- Report and roll back
do $d$
declare
  total int;
  failed int;
  detail text;
begin
  select count(*), count(*) filter (where not ok) into total, failed from results;
  select coalesce(string_agg(name || ' => got ' || coalesce(actual, 'NULL') || ', expected ' || coalesce(expected, 'NULL'), E'\n'), '')
    into detail from results where not ok;
  raise exception 'QC_TEST_REPORT total=% failed=% %', total, failed, E'\n' || detail;
end $d$;
