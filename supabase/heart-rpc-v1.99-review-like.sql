-- ============================================================
-- bm-v1.99.0 · 체육관 후기 좋아요 → 후기 주인 하트 +1 (2026-11-28)
--
--   실행 위치: Supabase 대시보드 > SQL Editor (postgres 권한)
--     https://supabase.com/dashboard/project/mwgpakntlollndfluwgg/sql/new
--     이 파일 전체를 붙여 넣고 RUN → 여러 번 실행해도 안전합니다.
--
--   무엇을 더하나
--     · 다른 사람이 내 '체육관 후기' 글에 ❤ 좋아요를 누르면 후기 주인 하트 +1.
--       - 본인 글 + 본인 좋아요 = 0
--       - 같은 사람이 같은 후기에 취소 후 다시 눌러도 1회
--       - 하루 최대 3개 (KST 날짜 기준 — 4번째부터는 좋아요 수만 오르고 하트는 안 옵니다)
--     · 앱은 좋아요를 누른 사람 기기에서 '후기하트' 행 한 줄을 남깁니다
--       (user_key = 누른 사람, target = 후기 주인, team = 글 ID, likes = 1).
--       하트를 세는 곳(js/domain.js heartLedger)과 서버(heart_balance)가 같은 규칙으로 셉니다.
--
--   왜 서버가 다시 검사하나
--     · '후기하트'는 클라이언트가 넣는 행이라, 그대로 두면 개발자 도구로
--       아무 글 ID나 적어 하트를 만들 수 있습니다. 그래서
--         ① INSERT 트리거가 '진짜 그 사람의 체육관 후기 글'인지 확인하고
--            날짜·시각·적립값을 서버가 다시 찍습니다 (likes 는 1 아니면 0).
--            → 클라이언트가 date 를 과거로 돌려 하루 3개 제한을 피할 수 없습니다.
--         ② heart_balance 가 사람·글당 1회, 하루 3개로만 세도록 바뀝니다.
--            (하트로 물건을 살 때 서버가 보는 잔액 = 앱이 보여 주는 잔액)
--
--   안 깨지는 것
--     · 앱이 이 SQL 을 실행하기 전에도 좋아요·커뮤니티는 그대로 동작합니다
--       ('후기하트'는 지금 정책에서 막히지 않는 유형이라 행은 쌓이고,
--        앱 화면 잔액은 앱 원장이 셉니다. 서버 잔액만 아직 후기 하트를 모릅니다).
--     · SQL 실행 뒤에는 서버 잔액까지 같아져, 후기로 받은 하트로 꾸미기·선물을 살 수 있습니다.
--     · 출석·광고·선물·꾸미기·매칭 등 기존 하트 계산은 한 줄도 바뀌지 않습니다.
--     · 체험 모드(기기 저장)·26칸 시트 브리지 폴백은 이 파일과 무관하게 그대로입니다.
-- ============================================================


-- ------------------------------------------------------------
-- 0) 도우미 — v1.75 파일과 같은 정의 (이 파일만 실행해도 돌아가게 함께 둡니다)
-- ------------------------------------------------------------
create or replace function public.bm_kst_day(p_ts timestamptz)
returns text language sql immutable set search_path = public as $$
  select to_char((p_ts at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD');
$$;

create or replace function public.bm_row_day(p_date text, p_created timestamptz)
returns text language sql immutable set search_path = public as $$
  select coalesce(
    nullif(btrim(substr(coalesce(p_date, ''), 1, 10)), ''),
    public.bm_kst_day(coalesce(p_created, now()))
  );
$$;


-- ------------------------------------------------------------
-- 1) 검증 — '이 좋아요는 진짜 체육관 후기에 대한 것인가'
--    · 글 ID 가 실제 '소셜' 글이고, 글쓴이가 target 과 같고, 그 글에 후기(plan.gym)가 있어야 합니다.
--    · 본인 글에는 쓸 수 없고, 같은 사람이 같은 글에 두 번 쓸 수 없습니다.
--    · p_id 는 '지금 넣는 행의 ID' — 자기 자신과 겹쳐 중복으로 판정하지 않게 뺍니다.
-- ------------------------------------------------------------
create or replace function public.bm_review_like_ok(p_id text, p_user text, p_target text, p_team text)
returns boolean language sql stable security definer set search_path = public as $$
  select btrim(coalesce(p_user, '')) <> ''
     and btrim(coalesce(p_target, '')) <> ''
     and p_user <> p_target
     and exists (
       select 1 from public.app_records p
        where p.id = btrim(coalesce(p_team, ''))
          and p.type = '소셜'
          and p.user_key = p_target
          and jsonb_typeof(p.plan) = 'object'
          and p.plan ? 'gym'
     )
     and not exists (
       select 1 from public.app_records q
        where q.type = '후기하트'
          and q.user_key = p_user
          and q.target = p_target
          and coalesce(q.team, '') = btrim(coalesce(p_team, ''))
          and coalesce(q.id, '') <> coalesce(p_id, '')
     );
$$;

revoke all on function public.bm_review_like_ok(text, text, text, text) from public;
grant execute on function public.bm_review_like_ok(text, text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 2) INSERT 지킴이 — 날짜·시각·적립값을 서버가 다시 찍습니다
--    · 좋아요 하트는 '1개 아니면 0개' — 클라이언트가 보낸 숫자를 쓰지 않습니다.
--    · 날짜(date)·시각(created_at)을 서버 시각으로 덮어 하루 3개 제한을 우회할 수 없게 합니다.
--    · 검증에 걸리면 하트 없이(likes=0) 행만 남깁니다 — 앱 저장은 실패하지 않고,
--      그 사람·그 글에는 다시 하트가 가지 않습니다(중복 판정에 쓰이므로).
-- ------------------------------------------------------------
create or replace function public.bm_review_like_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  if coalesce(new.type, '') <> '후기하트' then
    return new;
  end if;

  v_ok := public.bm_review_like_ok(new.id, new.user_key, new.target, new.team);
  new.likes := case when v_ok then 1 else 0 end;
  new.date := public.bm_kst_day(now());
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bm_review_like_guard on public.app_records;
create trigger trg_bm_review_like_guard
  before insert on public.app_records
  for each row execute function public.bm_review_like_guard();


-- ------------------------------------------------------------
-- 3) 잔액 — 앱 원장(js/domain.js heartLedger)과 같은 계산 + 후기 좋아요
--    기존 항목은 v1.75 와 똑같고, 맨 끝에 '후기하트' 한 줄만 더했습니다.
-- ------------------------------------------------------------
create or replace function public.heart_balance(p_key text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  v int := 0;
begin
  if p_key is null or btrim(p_key) = '' then return 0; end if;

  select
    3
    -- 적립
    + coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '출석하트' and user_key = p_key), 0)
    + coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '광고하트' and user_key = p_key), 0)
    -- 오늘의 하트 부스트: 광고가 있는 날마다 +1 (그날 첫 광고)
    + coalesce((select count(distinct public.bm_row_day(date, created_at)) from public.app_records
                 where type = '광고하트' and user_key = p_key), 0)
    + coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '하트합치기' and user_key = p_key), 0)
    + coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '선물하트' and target = p_key), 0)
    -- 내 체육관 후기에 다른 사람이 누른 좋아요 (bm-v1.99.0)
    --   · 사람(user_key)·글(team)당 1회만 인정
    --   · 날짜별로 앞에서 3개까지만 (4번째부터는 좋아요 수만 오르고 하트는 0)
    + coalesce((
        select count(*) from (
          select row_number() over (
                   partition by public.bm_row_day(u.date, u.created_at)
                   order by u.created_at, u.id) as rn
            from (
              select distinct on (r.user_key, coalesce(r.team, ''))
                     r.id, r.date, r.created_at
                from public.app_records r
               where r.type = '후기하트'
                 and r.target = p_key
                 and coalesce(r.user_key, '') <> ''
                 and r.user_key <> p_key
                 and coalesce(r.likes, 0) > 0
               order by r.user_key, coalesce(r.team, ''), r.created_at asc, r.id asc
            ) u
        ) c
        where c.rn <= 3
      ), 0)
    -- 사용
    - coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '선물하트' and user_key = p_key), 0)
    - coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '내하트사용' and user_key = p_key), 0)
    - coalesce((select sum(greatest(coalesce(likes, 0), 0)) from public.app_records
                 where type = '꾸미기구매' and user_key = p_key), 0)
    -- 매칭 성사 시 보낸 사람 차감 (요청 행 payload: payOn=accept, charged)
    - coalesce((
        select sum(least(
                 public.bm_int(payload ->> 'heartCost', 2),
                 greatest(0, public.bm_int(payload ->> 'charged', public.bm_int(payload ->> 'heartCost', 2)))
               ))
        from public.app_records
        where type = '매칭신청' and user_key = p_key
          and coalesce(win, '') = '수락'
          and coalesce(payload ->> 'payOn', '') = 'accept'
      ), 0)
    -- 연속 출석 보너스 (날짜 연속에서 매번 다시 셉니다 — 행에 따로 저장하지 않음)
    + coalesce((
        select sum(public.bm_streak_bonus(run_len))
        from (
          select count(*)::int as run_len
          from (
            select day, (day::date - (row_number() over (order by day))::int) as grp
            from (
              select distinct public.bm_row_day(date, created_at) as day
              from public.app_records
              where type = '출석하트' and user_key = p_key
            ) d
          ) s
          group by grp
        ) r
      ), 0)
  into v;

  return v;
end;
$$;

revoke all on function public.heart_balance(text) from public;
grant execute on function public.heart_balance(text) to authenticated;


-- ------------------------------------------------------------
-- 4) RLS — 바꾸지 않습니다 (일부러)
--    · v1.75 의 '본인 행만 INSERT' 정책이 '후기하트'를 막지 않습니다(잠긴 유형 아님).
--      그래서 앱은 지금처럼 행을 쌓고(오프라인 큐 포함), 서버는 2)의 트리거로 검사합니다.
--    · bm_locked_type 에는 '후기하트'를 넣지 마세요 — 넣으면 오프라인에서 누른 좋아요가
--      서버에 닿을 때마다 거절되어 대기열에 실패로 쌓입니다.
--    · '후기하트' 는 글쓴이(target)도 읽을 수 있습니다(v1.75 의 target = 내 키 정책).
--      앱은 그 행을 세어 후기 주인의 하트 잔액을 계산합니다(js/domain.js heartLedger).
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 5) 확인 — 아래 값을 눈으로 보면 적용 완료입니다
--    (아래 5줄은 주석이라 실행해도 아무것도 바뀌지 않습니다. 필요하면 복사해 실행)
-- ------------------------------------------------------------
--   select public.bm_review_like_ok('test', 'userA', 'userB', 'postX') as should_be_true_only_for_real_review;
--   select public.heart_balance(user_key) from public.app_users limit 5;
--   select trigger_name from information_schema.triggers
--     where event_object_table = 'app_records' and trigger_name = 'trg_bm_review_like_guard';  -- 1줄
--   select type, count(*) from public.app_records where type = '후기하트' group by type;
--   select tablename, policyname from pg_policies
--     where schemaname = 'public' and tablename = 'app_records' order by policyname;