-- ============================================================
-- bm-v1.86-motion.sql — 라켓 '모션' 프리셋 하트 가격 (셔틀릭스)
--
--  왜 필요한가
--   · bm-v1.86.0 에서 3D 라켓 아래에 모션 칩 3종을 넣었습니다.
--     🌀 손목 트위스트(❤1) · ✨ 쇼케이스 스핀(❤2) · ⚡ 공중 360° 플립(❤3)
--   · 파츠와 같은 하트·열림 목록(unlocked 'motion:id')을 쓰지만,
--     서버 가격표(bm_racket_price)에 motion 행이 없으면 heart_spend 가 null 을 돌려줘
--     '준비 중' 안내만 하고 하트를 빼지 않습니다(앱은 안전하게 동작).
--   · 이 파일은 bm_racket_price 함수만 새로 정의합니다 — 다른 하트 동작은 그대로입니다.
--
--  실행 방법 (한 번만)
--   1) https://supabase.com/dashboard/project/mwgpakntlollndfluwgg/sql/new
--   2) 이 파일 전체를 붙여 넣고 RUN
--   3) 앱 → MY → 내 커스텀 라켓 → 3D 아래 🌀 손목 트위스트를 두 번 눌러 하트가 빠지는지 확인
--
--  안전장치
--   · 가격은 서버 표만 믿습니다(클라이언트가 보낸 숫자는 쓰지 않음).
--   · 이미 연 모션은 다시 차감하지 않습니다(같은 target 의 '꾸미기구매' 행이 있으면 0).
--   · 모르는 target 은 null → 차감 없이 이유만 돌려줍니다.
-- ============================================================

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
    -- 모션 (bm-v1.86.0 · 3D 라켓 트릭 회전)
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

-- 확인용: select public.bm_racket_price('motion:flip');  -- 3
