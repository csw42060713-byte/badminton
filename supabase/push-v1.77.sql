-- ============================================================
-- bm-v1.77.0 · 푸시 토큰 저장 + 발송 기록 (2026-11-25)
--
--   실행 위치: Supabase 대시보드 > SQL Editor (postgres 권한)
--   여러 번 실행해도 안전합니다 (if not exists / create or replace / drop policy if exists).
--
--   무엇을 넣나
--     ① public.push_tokens — 기기별 푸시 토큰(FCM 등록 토큰 · 웹 푸시 엔드포인트)
--        · 한 사람이 여러 기기를 쓸 수 있어 user_key 당 최대 10개만 남깁니다.
--        · 같은 기기에서 다른 계정으로 로그인하면 토큰의 주인이 그 계정으로 옮겨집니다
--          (알림이 예전 주인에게 가지 않게).
--     ② public.push_log — 누가 누구에게 어떤 알림을 보냈는지 서버(Edge Function)만 기록.
--        · 앱은 읽지도 쓰지도 못합니다(정책 없음). 발송 횟수 제한·중복 차단의 근거로도 씁니다.
--
--   앱이 부르는 함수(SECURITY DEFINER — 본인 토큰만 다룹니다)
--     · register_push_token(p_token, p_platform, p_ua)   등록/갱신
--     · unregister_push_token(p_token)                    해제(로그아웃·알림 끔)
--     · my_push_tokens()                                  내 기기 몇 대인지(개수·플랫폼만)
--
--   안 여는 것
--     · push_tokens 의 INSERT/UPDATE/DELETE 정책은 만들지 않습니다 —
--       클라이언트는 위 함수로만 손댈 수 있고, 남의 토큰은 SELECT 도 되지 않습니다.
--     · 토큰 값 자체는 응답에 돌려주지 않습니다(개수·플랫폼만).
--
--   ⚠️ service_role 키·FCM 서비스 계정 JSON 은 여기에도, 저장소에도 넣지 않습니다.
--      FCM 키는 Edge Function 시크릿(FCM_SERVICE_ACCOUNT_JSON)으로만 넣습니다.
-- ============================================================


-- ------------------------------------------------------------
-- 1) 표
-- ------------------------------------------------------------
create table if not exists public.push_tokens (
  id          text primary key default ('ptk_' || replace(gen_random_uuid()::text, '-', '')),
  user_key    text not null,
  token       text not null unique,          -- FCM 등록 토큰(안드로이드·웹) 또는 웹 푸시 엔드포인트
  platform    text not null default 'web',   -- android · ios · web
  endpoint    text,                          -- 웹 푸시일 때 구독 주소(참고용)
  keys        jsonb,                         -- 웹 푸시 키 {p256dh, auth} (참고용)
  ua          text,                          -- 어떤 기기였는지(사람이 읽는 힌트)
  app_version text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  seen_at     timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_key);
create index if not exists push_tokens_seen_idx on public.push_tokens (user_key, seen_at desc);

create table if not exists public.push_log (
  id         text primary key default ('plg_' || replace(gen_random_uuid()::text, '-', '')),
  sender_key text,                           -- 보낸 사람 user_key (서버 함수가 확인한 값)
  user_key   text not null,                  -- 받는 사람 user_key
  kind       text,                           -- chat · appt · match · guest · guest_accept · guest_reject
  title      text,
  body       text,
  url        text,
  status     text not null,                  -- sent · partial · no_tokens · pending_fcm_secret · not_allowed · duplicate · limit
  sent       int not null default 0,
  failed     int not null default 0,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists push_log_sender_idx on public.push_log (sender_key, created_at desc);
create index if not exists push_log_user_idx on public.push_log (user_key, created_at desc);


-- ------------------------------------------------------------
-- 2) RLS — 내 토큰만 보이고, 쓰기는 함수로만
-- ------------------------------------------------------------
alter table public.push_tokens enable row level security;
alter table public.push_log enable row level security;

drop policy if exists push_tokens_self_read on public.push_tokens;
create policy push_tokens_self_read
  on public.push_tokens for select
  to authenticated
  using (user_key = public.current_user_key());

drop policy if exists push_tokens_self_delete on public.push_tokens;
create policy push_tokens_self_delete
  on public.push_tokens for delete
  to authenticated
  using (user_key = public.current_user_key());

revoke all on public.push_tokens from anon;
revoke all on public.push_log from anon;
revoke all on public.push_log from authenticated;
grant select, delete on public.push_tokens to authenticated;


-- ------------------------------------------------------------
-- 3) 도우미 — 토큰·플랫폼 정리 (앱 js/push.js 의 규칙과 같습니다)
-- ------------------------------------------------------------
create or replace function public.bm_clean_push_token(p_token text)
returns text language sql immutable set search_path = public as $$
  select nullif(substr(btrim(coalesce(p_token, '')), 1, 4096), '');
$$;

create or replace function public.bm_push_platform(p_platform text)
returns text language sql immutable set search_path = public as $$
  select case lower(btrim(coalesce(p_platform, '')))
    when 'android' then 'android'
    when 'ios' then 'ios'
    else 'web'
  end;
$$;

create or replace function public.bm_push_ua(p_ua text)
returns text language sql immutable set search_path = public as $$
  select nullif(substr(regexp_replace(btrim(coalesce(p_ua, '')), '[[:cntrl:]]', '', 'g'), 1, 160), '');
$$;


-- ------------------------------------------------------------
-- 4) 등록 · 해제 · 내 기기 수
-- ------------------------------------------------------------

/* 푸시 토큰 등록/갱신
 *  · 주인(user_key)은 서버가 정합니다 — 앱이 남의 토큰을 심을 수 없습니다.
 *  · 같은 토큰이 이미 있으면 주인·플랫폼만 새 값으로 옮기고 갱신 시각을 올립니다.
 *  · 한 사람당 10대까지만 남기고 오래된 기기는 지웁니다. */
create or replace function public.register_push_token(
  p_token text,
  p_platform text default 'web',
  p_ua text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key   text := public.current_user_key();
  v_token text := public.bm_clean_push_token(p_token);
  v_plat  text := public.bm_push_platform(p_platform);
  v_ua    text := public.bm_push_ua(p_ua);
  v_id    text;
  v_count int;
  v_dead  int;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;
  if v_token is null or length(v_token) < 8 then
    return jsonb_build_object('ok', false, 'reason', 'bad_token');
  end if;

  insert into public.push_tokens (user_key, token, platform, ua, seen_at)
  values (v_key, v_token, v_plat, v_ua, now())
  on conflict (token) do update
    set user_key   = excluded.user_key,
        platform   = excluded.platform,
        ua         = coalesce(excluded.ua, public.push_tokens.ua),
        updated_at = now(),
        seen_at    = now()
  returning id into v_id;

  /* 내 기기가 10대를 넘으면 오래 안 쓴 것부터 정리 (방금 등록한 것은 남깁니다) */
  select count(*)::int into v_count from public.push_tokens where user_key = v_key;
  if v_count > 10 then
    with dead as (
      select id from public.push_tokens
       where user_key = v_key and id <> v_id
       order by seen_at asc, created_at asc
       limit (v_count - 10)
    )
    delete from public.push_tokens t using dead where t.id = dead.id;
    get diagnostics v_dead = row_count;
  end if;

  select count(*)::int into v_count from public.push_tokens where user_key = v_key;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'platform', v_plat,
    'count', v_count, 'removed', coalesce(v_dead, 0),
    'at', to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS')
  );
end;
$$;

/* 푸시 토큰 해제 — 내 토큰만 지울 수 있습니다 */
create or replace function public.unregister_push_token(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key   text := public.current_user_key();
  v_token text := public.bm_clean_push_token(p_token);
  v_removed int := 0;
  v_count int := 0;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;
  if v_token is not null then
    delete from public.push_tokens where token = v_token and user_key = v_key;
    get diagnostics v_removed = row_count;
  else
    /* 토큰을 모르면 이 사람 기기 전부 해제(로그아웃·알림 끔) */
    delete from public.push_tokens where user_key = v_key;
    get diagnostics v_removed = row_count;
  end if;
  select count(*)::int into v_count from public.push_tokens where user_key = v_key;
  return jsonb_build_object('ok', true, 'removed', coalesce(v_removed, 0), 'count', v_count);
end;
$$;

/* 내 기기 몇 대인지 — 토큰 값은 돌려주지 않습니다(MY 화면 표시용) */
create or replace function public.my_push_tokens()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_key text := public.current_user_key();
  v_row record;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;
  select count(*)::int as n,
         count(*) filter (where platform = 'android')::int as android,
         count(*) filter (where platform = 'ios')::int as ios,
         count(*) filter (where platform = 'web')::int as web,
         max(seen_at) as last_seen
    into v_row
    from public.push_tokens where user_key = v_key;
  return jsonb_build_object(
    'ok', true,
    'count', coalesce(v_row.n, 0),
    'android', coalesce(v_row.android, 0),
    'ios', coalesce(v_row.ios, 0),
    'web', coalesce(v_row.web, 0),
    'lastSeen', case when v_row.last_seen is null then ''
                     else to_char(v_row.last_seen at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') end
  );
end;
$$;


-- ------------------------------------------------------------
-- 5) 실행 권한 — 로그인한 사용자만 (anon 은 아무것도 못 함)
--    · Supabase 는 새 함수·표에 anon/authenticated 기본 권한을 붙입니다.
--      그래서 'revoke from public' 만으로는 부족하고 anon 을 이름으로 뺴야 합니다.
--    · 표에 남는 TRUNCATE·REFERENCES·TRIGGER 는 RLS 로 막히지 않으므로 함께 회수합니다.
-- ------------------------------------------------------------
revoke all on function public.register_push_token(text, text, text) from public;
revoke all on function public.unregister_push_token(text) from public;
revoke all on function public.my_push_tokens() from public;

revoke all on function public.register_push_token(text, text, text) from anon;
revoke all on function public.unregister_push_token(text) from anon;
revoke all on function public.my_push_tokens() from anon;

revoke truncate, references, trigger on public.push_tokens from authenticated;
revoke truncate, references, trigger on public.push_log from authenticated;
revoke insert, update on public.push_tokens from authenticated;
revoke all on public.push_log from anon;
revoke all on public.push_tokens from anon;

grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.my_push_tokens() to authenticated;


-- ------------------------------------------------------------
-- 6) 확인용 (필요할 때만 주석을 풀어 실행)
-- ------------------------------------------------------------
-- select tablename, policyname, roles::text, cmd from pg_policies
--   where schemaname = 'public' and tablename in ('push_tokens', 'push_log') order by tablename, cmd;
-- select count(*) from public.push_tokens;
-- select * from public.push_log order by created_at desc limit 5;
