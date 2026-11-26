-- ============================================================
-- bm-v1.84-racket.sql — 하트로 여는 '라켓 바디 · 파츠 · 효과' (셔틀릭스)
--
--  왜 필요한가
--   · bm-v1.84.0 부터 '라켓 포인트(P)'를 없애고, 바디·테두리·거트·그립·스텐실·참·효과를
--     전부 하트(♥)로 엽니다(기본 파츠·파워 77 바디는 무료, 일반 1 · 레어 2 · 에픽 3 · 레전드 5).
--   · 하트 잔액은 서버 원장(app_records)으로만 계산되고, 하트를 빼는 행('꾸미기구매')은
--     RLS 로 잠겨 있어 브라우저가 직접 만들 수 없습니다.
--   · 그래서 기존 heart_spend 함수에 새 종류('racket')를 한 갈래 더합니다.
--     함수 전체를 create or replace 하므로 기존 deco·gift·match·smash 동작은 그대로입니다.
--
--  실행 방법 (한 번만)
--   1) https://supabase.com/dashboard/project/mwgpakntlollndfluwgg/sql/new
--   2) 이 파일 전체를 붙여 넣고 RUN
--   3) 앱에서 내 커스텀 라켓 > 테두리 > '스텔스 카본'(❤2)을 눌러 하트가 빠지는지 확인
--
--  안전장치
--   · 가격은 서버 표(bm_racket_price)만 믿습니다 — 클라이언트가 보낸 숫자는 쓰지 않습니다.
--   · 이미 연 파츠는 다시 차감하지 않습니다(같은 target 의 '꾸미기구매' 행이 있으면 0).
--   · 잔액 부족·미로그인·모르는 target 은 차감 없이 이유만 돌려줍니다.
--   · 앱은 이 SQL 이 아직 없어도('unknown') 하트를 빼지 않고 '준비 중' 안내만 합니다.
-- ============================================================

/* 라켓 파츠·바디 가격 — 앱(js/racketcustom.js priceOf · HEART_PRICE)과 같습니다
 *  · slot:id 형식 (예: frame:carbon, body:aero, effect:ice)
 *  · 무료(기본 파츠·파워 77)는 여기서 0 을 돌려줘 차감하지 않습니다. */
create or replace function public.bm_racket_price(p_target text)
returns int language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    -- 프레임(테두리)
    when 'frame:matte'    then 0
    when 'frame:carbon'   then 2
    when 'frame:white'    then 2
    when 'frame:navy'     then 3
    when 'frame:red'      then 3
    -- 거트(스트링)
    when 'string:lime'    then 0
    when 'string:white'   then 1
    when 'string:gold'    then 2
    when 'string:cobalt'  then 2
    when 'string:pink'    then 2
    -- 그립
    when 'grip:black'     then 0
    when 'grip:neon'      then 1
    when 'grip:mint'      then 1
    when 'grip:coral'     then 2
    when 'grip:purple'    then 2
    -- 스텐실
    when 'stencil:none'   then 0
    when 'stencil:x'      then 2
    when 'stencil:bolt'   then 2
    when 'stencil:crown'  then 3
    when 'stencil:shuttle' then 2
    -- 참
    when 'charm:none'     then 0
    when 'charm:medal'    then 3
    when 'charm:attend30' then 2
    when 'charm:streak'   then 2
    when 'charm:ace'      then 5
    -- 효과(연출)
    when 'effect:none'    then 0
    when 'effect:speed'   then 2
    when 'effect:spark'   then 3
    when 'effect:blaze'   then 3
    when 'effect:prism'   then 5
    when 'effect:fire'    then 2
    when 'effect:ice'     then 3
    when 'effect:thunder' then 3
    -- 바디(모델)
    when 'body:power77'   then 0
    when 'body:aero'      then 2
    when 'body:control'   then 3
    when 'body:smash'     then 5
    else null
  end;
$$;

/* 쓰기: kind = 'deco'(꾸미기) · 'gift'(하트 선물) · 'match'(매칭 잔액 검사)
 *      · 'smash'(스페셜 스매시) · 'racket'(라켓 바디·파츠·효과 · bm-v1.84.0)
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

  /* ---------- 1:1 매칭 신청 — 차감은 수락 때, 여기서는 잔액만 확인 ---------- */
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

  /* ---------- 스페셜 스매시 이펙트 (bm-v1.82.0) ---------- */
  if v_kind = 'smash' then
    v_price := public.bm_smash_price(v_target);
    if v_price is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown', 'balance', v_balance);
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

  /* ---------- bm-v1.84.0: 라켓 바디 · 파츠 · 효과 (하트) ----------
   *  · 종류: 'frame:carbon' 'string:gold' 'grip:mint' 'stencil:bolt' 'charm:ace'
   *          'effect:ice' 'body:aero' …
   *  · 해금 기록은 꾸미기 구매와 같은 '꾸미기구매' 행(target=slot:id) — 새 표·새 칸 없음.
   *  · 무료(기본 파츠·파워 77)는 0 을 돌려주고 아무것도 쓰지 않습니다. */
  if v_kind = 'racket' then
    v_price := public.bm_racket_price(v_target);
    if v_price is null then
      return jsonb_build_object('ok', false, 'reason', 'unknown', 'balance', v_balance);
    end if;
    if v_price = 0 then
      return jsonb_build_object('ok', true, 'purchased', false, 'price', 0, 'id', v_target, 'balance', v_balance);
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

  return jsonb_build_object('ok', false, 'reason', 'unknown');
end;
$$;

-- ── bm-v1.82 의 스매시 가격표가 아직 없으면 함께 만들어 둡니다(있으면 그대로) ──
create or replace function public.bm_smash_price(p_target text)
returns int language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    when 'effect:fire'    then 2
    when 'effect:ice'     then 3
    when 'effect:thunder' then 3
    else null
  end;
$$;

-- 로그인한 사용자만 실행할 수 있게 (함수는 security definer, 잔액은 서버가 셈)
revoke all on function public.bm_racket_price(text) from public;
grant execute on function public.bm_racket_price(text) to authenticated;
revoke all on function public.bm_smash_price(text) from public;
grant execute on function public.bm_smash_price(text) to authenticated;

-- 확인용 — 아래 두 줄이 나오면 적용 완료입니다.
--   select public.bm_racket_price('frame:carbon') as frame_carbon, public.bm_racket_price('body:smash') as body_smash;
--   select public.heart_spend('racket', 'string:white') as first_buy;   -- 하트 1개 차감(이미 샀으면 0)
