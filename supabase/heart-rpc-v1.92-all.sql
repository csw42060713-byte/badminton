-- ============================================================
-- bm-v1.92-all.sql — 하트로 여는 '라켓 바디 · 파츠 · 모션 · 스매시' 한 번에 (셔틀릭스)
--
--  이 파일 하나만 실행하면 지금까지 미적용으로 남아 있던 세 파일이 모두 열립니다.
--    · heart-rpc-v1.82-smash.sql  — 스페셜 스매시 이펙트(불꽃 2 · 얼음 3 · 번개 3)
--    · heart-rpc-v1.84-racket.sql — 라켓 바디·프레임·거트·그립·스텐실·참·효과 (하트)
--    · heart-rpc-v1.86-motion.sql — 라켓 모션 3종(손목 트위스트 1 · 쇼케이스 2 · 플립 3)
--    (bm-v1.92.0 통합 · 세 파일을 그대로 이어 붙이지 않고 가격표를 하나로 합쳤습니다)
--
--  왜 합쳤나 (중요)
--   · v1.86-motion 은 v1.84 보다 먼저 쓰인 가격표를 다시 정의합니다. 두 파일을 순서대로
--     실행하면 v1.87 에서 추가된 레전드 파츠 3종(frame:onyx · grip:towel · grip:twotone)이
--     가격표에서 빠져 '모르는 파츠'가 되고, 그 3종은 하트로 열 수 없게 됩니다.
--   · 그래서 이 파일의 bm_racket_price 는 앱(js/racketcustom.js)의 43개 품목 전체를 담습니다.
--   · heart_spend 도 v1.84 판(racket·smash·deco·gift·match 모두 처리)을 그대로 씁니다.
--
--  실행 방법 (딱 한 번)
--   1) https://supabase.com/dashboard/project/mwgpakntlollndfluwgg/sql/new
--   2) 이 파일 전체를 붙여 넣고 RUN
--   3) 앱에서 MY > 내 커스텀 라켓 에서 '스텔스 카본(❤2)'·'모션 손목 트위스트(❤1)'를
--      눌러 하트가 실제로 빠지는지, 스매시 이펙트 '불꽃 스매시(❤2)'가 열리는지 확인
--
--  안전장치
--   · create or replace / 이미 산 품목은 0 — 여러 번 실행해도 하트가 두 번 빠지지 않습니다.
--   · 가격은 서버 표(bm_racket_price · bm_smash_price)만 믿습니다(클라이언트가 보낸 숫자는 안 씀).
--   · 잔액 부족·미로그인·모르는 target 은 차감 없이 이유만 돌려줍니다.
--   · 로그인한 사용자(authenticated)만 실행할 수 있게 grant 를 함께 겁니다.
-- ============================================================


-- ------------------------------------------------------------
-- 1) 스매시 이펙트 가격 (v1.82 + v1.84 의 effect:ice 포함)
-- ------------------------------------------------------------
create or replace function public.bm_smash_price(p_target text)
returns int language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    when 'effect:fire'    then 2
    when 'effect:ice'     then 3
    when 'effect:thunder' then 3
    else null
  end;
$$;

-- ------------------------------------------------------------
-- 2) 라켓 바디·파츠·모션 가격 (v1.84 + v1.86 + v1.87 레전드 3종)
--    앱(js/racketcustom.js PARTS · BODIES 의 heart)과 같은 값입니다.
--    무료(기본 파츠 · 파워 77 · 모션 없음)는 0 을 돌려줘 차감하지 않습니다.
-- ------------------------------------------------------------
create or replace function public.bm_racket_price(p_target text)
returns int language sql immutable set search_path = public as $$
  select case btrim(coalesce(p_target, ''))
    -- 프레임(테두리)
    when 'frame:matte'    then 0
    when 'frame:carbon'   then 2
    when 'frame:white'    then 2
    when 'frame:navy'     then 3
    when 'frame:red'      then 3
    when 'frame:onyx'     then 4   -- bm-v1.87.0 레전드(오닉스 티타늄)
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
    when 'grip:towel'     then 3   -- bm-v1.87.0 에픽(타월 베이지)
    when 'grip:twotone'   then 3   -- bm-v1.87.0 에픽(투톤 네온)
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
    -- 모션(bm-v1.86.0 · 3D 라켓 감상 연출)
    when 'motion:twist'    then 1
    when 'motion:showcase' then 2
    when 'motion:flip'     then 3
    -- 바디(모델)
    when 'body:power77'   then 0
    when 'body:aero'      then 2
    when 'body:control'   then 3
    when 'body:smash'     then 5
    else null
  end;
$$;

-- ------------------------------------------------------------
-- 3) 쓰기 — heart_spend (v1.84 판: deco · gift · match · smash · racket)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4) 권한 — 로그인한 사용자만 실행 (함수는 security definer, 잔액은 서버가 셈)
-- ------------------------------------------------------------
revoke all on function public.bm_smash_price(text) from public;
grant execute on function public.bm_smash_price(text) to authenticated;
revoke all on function public.bm_racket_price(text) from public;
grant execute on function public.bm_racket_price(text) to authenticated;
-- heart_spend 는 create or replace 해도 권한이 그대로지만, 처음 상태와 같게 한 번 더 걸어 둡니다.
revoke all on function public.heart_spend(text, text) from public;
grant execute on function public.heart_spend(text, text) to authenticated;


-- ------------------------------------------------------------
-- 5) 확인 — 아래 결과가 나오면 적용 완료입니다.
-- ------------------------------------------------------------
--   select public.bm_racket_price('frame:carbon') as carbon,      -- 2
--          public.bm_racket_price('frame:onyx')   as onyx,        -- 4 (v1.87 레전드)
--          public.bm_racket_price('motion:twist') as twist,       -- 1 (v1.86 모션)
--          public.bm_racket_price('body:smash')   as body_smash,  -- 5
--          public.bm_smash_price('effect:ice')    as ice;         -- 3
--   select public.heart_spend('racket', 'string:white') as first_buy;  -- 하트 1개 차감(이미 샀으면 0)
