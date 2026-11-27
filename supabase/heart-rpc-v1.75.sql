-- ============================================================
-- bm-v1.75.0 · 하트·광고 보상 서버 잠금 (2026-11-25)
--
--   실행 위치: Supabase 대시보드 > SQL Editor (postgres 권한)
--   또는 Management API /v1/projects/<ref>/database/query
--
--   무엇을 잠그나
--     앱은 하트를 '행(row)이 곧 원장'으로 셉니다(js/domain.js heartLedger).
--     그런데 지금까지는 브라우저가 app_records 에 '출석하트'·'광고하트'·
--     '꾸미기구매'·'선물하트'·'내하트사용'·'하트합치기' 행을 직접 넣을 수 있어
--     잔액을 마음대로 만들 수 있었습니다(개발자 도구로 한 줄이면 +999).
--
--   잠그는 방법
--     ① 적립·차감 행은 서버 함수(SECURITY DEFINER)만 넣습니다.
--        - heart_checkin()                 출석 1일 1회 + 연속 3·7·14·30일 보너스
--        - heart_ad_reward(tx, unit)       하루 5회 · 30초 간격 · txId 중복 차단 · 첫 광고 +1
--        - heart_spend(kind, target)       꾸미기 구매 · 하트 선물 · 매칭 신청 잔액 검사
--     ② RLS: 클라이언트(authenticated)는 위 6가지 유형의 행을
--        INSERT/UPDATE/DELETE 할 수 없습니다. (SELECT 는 예전 그대로)
--     ③ '수정'·'삭제' 가림 행으로 하트 행을 고치는 우회도 막습니다.
--        (받은 매칭 요청을 수락하는 '수정' 행은 예전처럼 허용 — 보낸 사람만 막힘)
--
--   안 깨지는 것
--     · 게스트/체험 모드(기기 저장), 26칸 시트 브리지 폴백, 오프라인 큐는 그대로입니다.
--       (그 모드들은 서버에 하트 행을 보내지 않고, 새 앱은 Supabase 모드에서만 RPC 를 씁니다)
--     · 일지·채팅·커뮤니티·프로필 등 나머지 유형의 INSERT/UPDATE/DELETE 는 그대로입니다.
--
--   여러 번 실행해도 안전합니다 (create or replace / drop policy if exists).
-- ============================================================


-- ------------------------------------------------------------
-- 0) 도우미
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

/* 광고 거래 ID 정리 — 앱(js/domain.js cleanTxId)과 같은 규칙 */
create or replace function public.bm_clean_tx(p_tx text)
returns text language sql immutable set search_path = public as $$
  select nullif(substr(regexp_replace(btrim(coalesce(p_tx, '')), '[^A-Za-z0-9._:-]', '', 'g'), 1, 48), '');
$$;

/* 문자열 → 정수 (값이 이상하면 기본값) */
create or replace function public.bm_int(p text, p_def int)
returns int language plpgsql immutable set search_path = public as $$
begin
  begin
    return coalesce(nullif(btrim(coalesce(p, '')), ''), p_def::text)::numeric::int;
  exception when others then
    return p_def;
  end;
end;
$$;

/* 한 번의 연속 출석(run일)이 지금까지 받았어야 할 보너스 합계
 *  앱 규칙(js/domain.js STREAK_BONUSES)과 같습니다:
 *  3일 +1 · 7일 +2 · 14일 +3 · 30일 +5, 그 뒤 14일마다(28·42·56…) +3 */
create or replace function public.bm_streak_bonus(p_run int)
returns int language sql immutable set search_path = public as $$
  select case when p_run >= 30 then 5 else 0 end
       + case when p_run >= 14 then 3 else 0 end
       + case when p_run >= 7  then 2 else 0 end
       + case when p_run >= 3  then 1 else 0 end
       + case when p_run >= 28 then 3 * (p_run / 14 - 1) else 0 end;
$$;

/* 지금까지 이어진 연속 출석 일수 (오늘 또는 어제까지) */
create or replace function public.bm_checkin_streak(p_key text, p_today text)
returns int language sql stable security definer set search_path = public as $$
  with d as (
    select distinct public.bm_row_day(date, created_at) as day
    from public.app_records
    where type = '출석하트' and user_key = p_key
  ), s as (
    select day, (day::date - (row_number() over (order by day))::int) as grp from d
  ), g as (
    select grp, count(*)::int as len, max(day) as last_day from s group by grp
  )
  select coalesce(
    (select len from g
      where last_day = p_today
         or last_day = to_char(p_today::date - 1, 'YYYY-MM-DD')
      limit 1), 0);
$$;

/* 하트 부스트(영구 +1)를 켜 두었나 — 소유: 꾸미기구매 target='boost:heart', 장착: 최근 프로필 꾸미기 JSON boost */
create or replace function public.bm_boost_on(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_records
    where type = '꾸미기구매' and user_key = p_key and target = 'boost:heart'
  ) and coalesce(
    (select nullif(theme ->> 'boost', '')
       from public.app_records
      where type = '프로필' and user_key = p_key
      order by created_at desc limit 1), '0') in ('1', 'true');
$$;

/* 표시 이름 — 최근 프로필 행 → app_users */
create or replace function public.bm_nick(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(btrim(nick), '') from public.app_records
      where type = '프로필' and user_key = p_key order by created_at desc limit 1),
    (select nullif(btrim(nick), '') from public.app_users where user_key = p_key limit 1),
    '');
$$;


-- ------------------------------------------------------------
-- 1) 잔액 — 앱 원장(js/domain.js heartLedger)과 같은 계산
--    기본 3 + 적립 - 사용. 행을 세어 계산하므로 캐시가 어긋날 일이 없습니다.
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


-- ------------------------------------------------------------
-- 2) 서버 함수 — 적립
-- ------------------------------------------------------------

/* 출석 체크: 하루 1회 +1 (+ 하트 부스트, + 연속 3·7·14·30일 보너스)
 *  앱이 보내는 값은 없습니다 — 오늘 날짜·연속 일수·보너스를 모두 서버가 다시 셉니다. */
create or replace function public.heart_checkin()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key   text := public.current_user_key();
  v_today text := public.bm_kst_day(now());
  v_streak int;
  v_bonus int := 0;
  v_boost int := 0;
  v_gain  int;
  v_note  text := '';
  v_id    text;
  v_row   public.app_records;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;

  if exists (select 1 from public.app_records
              where type = '출석하트' and user_key = v_key
                and public.bm_row_day(date, created_at) = v_today) then
    return jsonb_build_object('ok', false, 'reason', 'done',
                              'balance', public.heart_balance(v_key));
  end if;

  v_streak := public.bm_checkin_streak(v_key, v_today) + 1;
  v_bonus  := public.bm_streak_bonus(v_streak) - public.bm_streak_bonus(greatest(0, v_streak - 1));
  if public.bm_boost_on(v_key) then v_boost := 1; end if;
  v_gain := 1 + v_boost;

  if v_bonus > 0 then
    v_note := v_streak || '일 연속 출석 보너스 +' || v_bonus;
  end if;
  if v_boost > 0 then
    v_note := concat_ws(' · ', nullif(v_note, ''), '부스트 +' || v_boost);
  end if;
  /* 보너스를 받은 날 표시 — 앱이 같은 날 두 번 더하지 않게 하는 키(원장이 날짜로 판정) */
  if v_bonus > 0 then
    v_note := concat_ws(' · ', nullif(v_note, ''), 'streak:' || v_today);
  end if;

  v_id := 'hrt_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.app_records (id, type, user_key, nick, date, likes, note, created_at, updated_at)
  values (v_id, '출석하트', v_key, public.bm_nick(v_key), v_today, v_gain,
          nullif(v_note, ''), now(), now())
  returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'gained', v_gain + v_bonus, 'base', 1, 'boost', v_boost,
    'bonus', v_bonus, 'streak', v_streak,
    'milestone', case when v_bonus > 0 then v_streak else 0 end,
    'balance', public.heart_balance(v_key),
    'row', jsonb_build_object(
      'id', v_row.id, 'type', v_row.type, 'date', v_row.date, 'likes', v_row.likes,
      'note', coalesce(v_row.note, ''), 'target', '', 'user_key', v_row.user_key,
      'created_at', to_char(v_row.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'))
  );
end;
$$;


/* 보상형 광고: 하루 5회 · 30초 간격 · txId 중복 차단 · 오늘 첫 광고 +1 */ 
create or replace function public.heart_ad_reward(p_tx text default null, p_unit text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key    text := public.current_user_key();
  v_today  text := public.bm_kst_day(now());
  v_tx     text := public.bm_clean_tx(p_tx);
  v_used   int;
  v_last   timestamptz;
  v_retry  int := 0;
  v_boost  int := 0;
  v_first  boolean;
  v_gain   int;
  v_id     text;
  v_row    public.app_records;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;

  /* 같은 시청 건은 한 번만 (광고 SDK 콜백이 두 번 와도) */
  if v_tx is not null and exists (
       select 1 from public.app_records
        where type = '광고하트' and user_key = v_key
          and note like 'tx:%'
          and public.bm_clean_tx(substr(note, 4)) = v_tx) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate', 'txId', v_tx,
                              'balance', public.heart_balance(v_key));
  end if;

  select count(*)::int into v_used
    from public.app_records
   where type = '광고하트' and user_key = v_key
     and public.bm_row_day(date, created_at) = v_today;

  if v_used >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'limit', 5, 'remaining', 0,
                              'balance', public.heart_balance(v_key));
  end if;

  select max(created_at) into v_last
    from public.app_records
   where type = '광고하트' and user_key = v_key;

  if v_last is not null then
    v_retry := ceil(extract(epoch from (v_last + interval '30 seconds' - now())))::int;
    if v_retry > 0 then
      return jsonb_build_object('ok', false, 'reason', 'cooldown', 'retryAfter', v_retry,
                                'remaining', greatest(0, 5 - v_used),
                                'balance', public.heart_balance(v_key));
    end if;
  end if;

  if public.bm_boost_on(v_key) then v_boost := 1; end if;
  v_first := (v_used = 0);
  v_gain  := 1 + v_boost;          /* 행에는 광고값만 — 오늘의 부스트는 원장이 첫 행에서 셉니다 */
  v_id    := 'hrt_' || replace(gen_random_uuid()::text, '-', '');

  insert into public.app_records (id, type, user_key, nick, date, likes, note, target, created_at, updated_at)
  values (v_id, '광고하트', v_key, public.bm_nick(v_key), v_today, v_gain,
          case when v_tx is not null then 'tx:' || v_tx else null end,
          nullif(left(btrim(coalesce(p_unit, '')), 40), ''), now(), now())
  returning * into v_row;

  return jsonb_build_object(
    'ok', true, 'gained', v_gain + (case when v_first then 1 else 0 end),
    'base', 1, 'boost', v_boost,
    'dailyBoost', case when v_first then 1 else 0 end,
    'txId', coalesce(v_tx, ''),
    'remaining', greatest(0, 5 - (v_used + 1)),
    'nextAdInSec', 30,
    'balance', public.heart_balance(v_key),
    'row', jsonb_build_object(
      'id', v_row.id, 'type', v_row.type, 'date', v_row.date, 'likes', v_row.likes,
      'note', coalesce(v_row.note, ''), 'target', coalesce(v_row.target, ''),
      'user_key', v_row.user_key,
      'created_at', to_char(v_row.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'))
  );
end;
$$;


-- ------------------------------------------------------------
-- 3) 서버 함수 — 사용 (잔액 검사 후 차감)
-- ------------------------------------------------------------

/* 꾸미기 가격 — 앱(js/domain.js DECO_PRICES)과 같습니다 */
create or replace function public.bm_deco_price(p_target text)
returns int language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    when 'frame:court'   then 0
    when 'frame:royal'   then 1
    when 'frame:sakura'  then 1
    when 'frame:gold'    then 2
    when 'frame:neon'    then 2
    when 'badge:racket'  then 0
    when 'badge:butterfly' then 0
    when 'badge:fire'    then 1
    when 'badge:star'    then 1
    when 'badge:medal'   then 2
    when 'badge:crown'   then 2
    when 'boost:heart'   then 3
    when 'card:champ'    then 2
    when 'badge:champ'   then 3
    else null
  end;
$$;

/* 연속 출석으로 무료 해금되는 꾸미기 (js/domain.js STREAK_UNLOCKS) */
create or replace function public.bm_streak_unlocked(p_target text, p_streak int)
returns boolean language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    when 'badge:star'  then p_streak >= 3
    when 'badge:medal' then p_streak >= 7
    when 'frame:gold'  then p_streak >= 14
    when 'badge:champ' then p_streak >= 30
    else false
  end;
$$;

/* 쓰기: kind = 'deco'(꾸미기 구매) · 'gift'(하트 선물) · 'match'(매칭 신청 잔액 검사)
 *  · 잔액은 언제나 서버가 셉니다(heart_balance). 클라이언트가 보낸 숫자는 쓰지 않습니다. */
create or replace function public.heart_spend(p_kind text, p_target text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_key    text := public.current_user_key();
  v_kind   text := lower(btrim(coalesce(p_kind, '')));
  v_target text := btrim(coalesce(p_target, ''));
  v_balance int;
  v_price  int;
  v_streak int;
  v_id     text;
  v_row    public.app_records;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'reason', 'no_login');
  end if;

  v_balance := public.heart_balance(v_key);
  v_streak  := public.bm_checkin_streak(v_key, public.bm_kst_day(now()));

  /* ---------- 꾸미기 구매 ---------- */
  if v_kind = 'deco' then
    v_price := public.bm_deco_price(v_target);
    if v_price is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown', 'balance', v_balance);
    end if;
    if v_price = 0 then
      return jsonb_build_object('ok', true, 'purchased', false, 'price', 0, 'id', v_target, 'balance', v_balance);
    end if;
    if public.bm_streak_unlocked(v_target, v_streak) then
      return jsonb_build_object('ok', true, 'purchased', false, 'price', 0, 'id', v_target,
                                'free', true, 'balance', v_balance);
    end if;
    if exists (select 1 from public.app_records
                where type = '꾸미기구매' and user_key = v_key and target = v_target) then
      return jsonb_build_object('ok', true, 'purchased', false, 'price', 0, 'id', v_target, 'balance', v_balance);
    end if;
    if v_balance < v_price then
      return jsonb_build_object('ok', false, 'reason', 'hearts', 'need', v_price - v_balance,
                                'price', v_price, 'id', v_target, 'balance', v_balance);
    end if;

    v_id := 'hrt_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.app_records (id, type, user_key, nick, date, target, likes, created_at, updated_at)
    values (v_id, '꾸미기구매', v_key, public.bm_nick(v_key), public.bm_kst_day(now()), v_target, v_price, now(), now())
    returning * into v_row;

    return jsonb_build_object(
      'ok', true, 'purchased', true, 'price', v_price, 'id', v_target,
      'balance', public.heart_balance(v_key),
      'row', jsonb_build_object(
        'id', v_row.id, 'type', v_row.type, 'date', v_row.date, 'likes', v_row.likes,
        'note', '', 'target', coalesce(v_row.target, ''), 'user_key', v_row.user_key,
        'created_at', to_char(v_row.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'))
    );
  end if;

  /* ---------- 하트 선물 (1개) ---------- */
  if v_kind = 'gift' then
    if v_target = '' then
      return jsonb_build_object('ok', false, 'reason', 'no_target');
    end if;
    if v_target = v_key then
      return jsonb_build_object('ok', false, 'reason', 'self');
    end if;
    if not exists (select 1 from public.app_records
                    where type in ('프로필', '매칭프로필') and user_key = v_target) then
      return jsonb_build_object('ok', false, 'reason', 'no_target');
    end if;
    if v_balance < 1 then
      return jsonb_build_object('ok', false, 'reason', 'hearts', 'need', 1 - v_balance, 'balance', v_balance);
    end if;

    v_id := 'hrt_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.app_records (id, type, user_key, nick, date, target, likes, created_at, updated_at)
    values (v_id, '선물하트', v_key, public.bm_nick(v_key), public.bm_kst_day(now()), v_target, 1, now(), now())
    returning * into v_row;

    return jsonb_build_object(
      'ok', true, 'spent', 1, 'balance', public.heart_balance(v_key),
      'row', jsonb_build_object(
        'id', v_row.id, 'type', v_row.type, 'date', v_row.date, 'likes', v_row.likes,
        'note', '', 'target', coalesce(v_row.target, ''), 'user_key', v_row.user_key,
        'created_at', to_char(v_row.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS'))
    );
  end if;

  /* ---------- 1:1 매칭 신청 — 지금은 차감하지 않고(수락 때 차감) 잔액만 서버가 확인 ---------- */
  if v_kind = 'match' then
    if v_target <> '' and v_target = v_key then
      return jsonb_build_object('ok', false, 'reason', 'self');
    end if;
    if v_balance < 2 then
      return jsonb_build_object('ok', false, 'reason', 'hearts', 'need', 2 - v_balance,
                                'cost', 2, 'balance', v_balance);
    end if;
    return jsonb_build_object('ok', true, 'cost', 2, 'balance', v_balance, 'chargeOnAccept', true);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'unknown');
end;
$$;


-- ------------------------------------------------------------
-- 4) RLS — 클라이언트는 하트 원장 행을 직접 만들거나 고치거나 지울 수 없습니다
-- ------------------------------------------------------------

/* 잠그는 유형 (원장의 돈줄) — '하트'는 커뮤니티 글 좋아요라 잠그지 않습니다 */
create or replace function public.bm_locked_type(p_type text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_type, '') in
    ('출석하트', '광고하트', '하트합치기', '선물하트', '내하트사용', '꾸미기구매');
$$;

/* '수정'·'삭제' 가림 행으로 잠근 행을 고치려는지 — 가림 행은 남의 하트 행을 건드릴 수 없습니다.
 *  · 받은 매칭 요청을 수락하는 '수정' 행(요청 받은 사람이 쓰는 행)은 예전처럼 통과합니다.
 *  · 보낸 사람이 자기 매칭 요청 행을 '수정'해 차감을 피하는 것은 막습니다. */
create or replace function public.bm_shadow_locked(p_target text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_records r
     where r.id = p_target
       and (public.bm_locked_type(r.type)
            or (r.type = '매칭신청' and r.user_key = public.current_user_key()))
  );
$$;

drop policy if exists app_records_insert_self on public.app_records;
create policy app_records_insert_self
  on public.app_records for insert
  to authenticated
  with check (
    user_key = public.current_user_key()
    and not public.bm_locked_type(type)
    and not (type in ('수정', '삭제') and public.bm_shadow_locked(target))
  );

drop policy if exists app_records_owner_update on public.app_records;
create policy app_records_owner_update
  on public.app_records for update
  to authenticated
  using (user_key = public.current_user_key() and not public.bm_locked_type(type))
  with check (user_key = public.current_user_key() and not public.bm_locked_type(type));

drop policy if exists app_records_owner_delete on public.app_records;
create policy app_records_owner_delete
  on public.app_records for delete
  to authenticated
  using (user_key = public.current_user_key() and not public.bm_locked_type(type));


-- ------------------------------------------------------------
-- 5) 실행 권한 — 로그인한 사용자만
-- ------------------------------------------------------------
revoke all on function public.heart_checkin() from public;
revoke all on function public.heart_ad_reward(text, text) from public;
revoke all on function public.heart_spend(text, text) from public;
revoke all on function public.heart_balance(text) from public;
revoke all on function public.bm_shadow_locked(text) from public;

grant execute on function public.heart_checkin() to authenticated;
grant execute on function public.heart_ad_reward(text, text) to authenticated;
grant execute on function public.heart_spend(text, text) to authenticated;
grant execute on function public.heart_balance(text) to authenticated;
grant execute on function public.bm_deco_price(text) to authenticated;
grant execute on function public.bm_streak_unlocked(text, int) to authenticated;
grant execute on function public.bm_boost_on(text) to authenticated;
grant execute on function public.bm_locked_type(text) to authenticated;
grant execute on function public.bm_shadow_locked(text) to authenticated;
grant execute on function public.bm_kst_day(timestamptz) to authenticated;
grant execute on function public.bm_row_day(text, timestamptz) to authenticated;


-- ------------------------------------------------------------
-- 확인용
-- ------------------------------------------------------------
-- select public.heart_balance(user_key) from public.app_users limit 5;
-- select tablename, policyname, roles::text, cmd, coalesce(with_check, qual, '') from pg_policies
--   where schemaname = 'public' and tablename = 'app_records' order by cmd;
