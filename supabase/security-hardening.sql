-- ============================================================
-- bm-v1.41.1 · Supabase 보안 잠금 권고안 (2026-11-21 밤 점검)
--
--   실행 위치: Supabase 대시보드 > SQL Editor (postgres 권한)
--   실행 전에 반드시 아래 '점검 결과'를 읽어 주세요.
--   이 파일은 앱 코드를 바꾸지 않고 DB 정책만 좁히는 SQL입니다.
--
-- ── 점검 결과 (2026-11-21 20:00 KST, 공개 anon 키로 직접 확인) ──
--   ① anon 키만으로 app_records 전체(178행)를 읽을 수 있었습니다.
--      → 남의 일지·1:1 채팅·매칭 신청·하트 내역까지 읽힘 (프라이버시)
--   ② anon 키만으로 app_users 를 읽을 수 있었습니다. email 열이 있어
--      가입자 이메일을 그대로 받아 갈 수 있었습니다.
--   ③ anon 키로 남의 user_key 를 적은 행을 INSERT 하는 것이 201로 통과했습니다.
--      → 남의 이름으로 글·쪽지·하트를 넣는 위조가 가능
--   ④ anon 키의 UPDATE/DELETE 는 0행으로 막혀 있었습니다(정상).
--      실측: 내가 만든 검사용 행을 anon 으로 PATCH/DELETE → 값 그대로/행 그대로.
--   ⑤ 친구 코드(#XXXX)는 user_key 에서 계산되는 4자리이고, 프로필·매칭프로필
--      목록이 공개라 누구나 전 회원의 코드를 계산할 수 있습니다.
--      → '아는 사람만 추가'라는 잠금 효과가 사실상 없음 (아래 3단계).
--
-- ── 적용 순서 ──
--   1단계(권장·안전): app_users 읽기를 '내 행만'으로 좁힙니다. 앱은 app_users 를
--        읽지 않고(내 행 upsert 만 함) 쓰기만 하므로 화면에 영향이 없습니다.
--   2단계(권장·확인 필요): app_records INSERT 를 '내 user_key'로 제한합니다.
--        로그인 세션이 만료된 기기에서 글쓰기가 '동기화 실패'로 보일 수 있어,
--        적용 뒤 앱에서 글·채팅·하트 적립을 한 번씩 확인해 주세요.
--   3단계(선택·설계 변경): SELECT 를 유형별로 좁혀 남의 일지·1:1 대화를 숨깁니다.
--        단체방(모집 글) 대화가 계속 보이도록 helper 함수를 함께 만듭니다.
--        적용 후 커뮤니티·단체방·코치 화면을 꼭 확인해 주세요.
--   4단계(선택): 친구 코드를 무작위 값으로 바꿉니다(서버 발급 + 코드로만 조회).
--
-- 이 파일은 여러 번 실행해도 안전하도록 drop ... if exists 로 썼습니다.
-- ============================================================


-- ------------------------------------------------------------
-- 1단계 · app_users: 내 행만 읽기 (이메일 수집 차단)
--   · 앱 코드는 app_users 를 SELECT 하지 않습니다(ensureAccount 의 upsert 만).
--   · current_user_key() 는 security definer 라 이 정책과 무관하게 동작합니다.
-- ------------------------------------------------------------
drop policy if exists app_users_read on public.app_users;
drop policy if exists app_users_self_read on public.app_users;
create policy app_users_self_read
  on public.app_users for select
  to authenticated
  using (auth_uid = auth.uid());

-- anon 은 app_users 를 아예 읽지 못하게 합니다(정책 없음 = 거부)
revoke select on public.app_users from anon;

-- 확인: 로그인 상태에서 내 행 upsert(ensureAccount)가 그대로 되는지
--   → 앱 MY 화면에서 비밀번호 변경/회원 탈퇴가 정상 동작하면 OK.


-- ------------------------------------------------------------
-- 2단계 · app_records INSERT: 내 user_key 만 (위조·스팸 차단)
--   · 지금은 anon 도 아무 user_key 로 넣을 수 있습니다.
--   · 앱은 로그인(Supabase Auth) 상태에서만 서버에 씁니다. 체험 모드는 기기 저장.
-- ------------------------------------------------------------
create or replace function public.current_user_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.user_key from public.app_users u where u.auth_uid = auth.uid() limit 1;
$$;

drop policy if exists app_records_insert on public.app_records;
drop policy if exists app_records_insert_self on public.app_records;
create policy app_records_insert_self
  on public.app_records for insert
  to authenticated
  with check (user_key = public.current_user_key());

-- anon 의 INSERT 권한 자체를 뺍니다(정책이 없어도 테이블 권한이 남아 있으면 시도는 됩니다)
revoke insert on public.app_records from anon;

-- 확인: 앱에서 ① 커뮤니티 글 올리기 ② 채팅 보내기 ③ 출석/광고 하트 받기
--   ④ 일지 저장 → 모두 그대로 되는지. (세션 만료 기기면 다시 로그인)


-- ------------------------------------------------------------
-- 3단계 · app_records SELECT: 공개 글만 모두, 나머지는 내 것/나에게 온 것만
--   · 커뮤니티 피드(소셜·답글·하트), 프로필, 매칭프로필, 매너는 모두 공개.
--   · 일지·하트 원장·달력메모·친구/매칭 신청·1:1 대화는 당사자만.
--   · 모집 글 단체방(팀 = 글 ID)은 그 글의 대화라 참여자 모두 볼 수 있어야 합니다.
--   · 코치·관리자는 선수 일지를 봐야 하므로 예외를 둡니다.
-- ------------------------------------------------------------
create or replace function public.is_group_room(p_team text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_records p
    where p.id = p_team and p.type = '소셜'
  );
$$;

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users u
    where u.auth_uid = auth.uid() and (u.is_coach or u.is_admin)
  );
$$;

grant execute on function public.is_group_room(text) to authenticated;
grant execute on function public.is_coach_or_admin() to authenticated;

drop policy if exists app_records_read on public.app_records;

-- 로그인 사용자
drop policy if exists app_records_read_self on public.app_records;
create policy app_records_read_self
  on public.app_records for select
  to authenticated
  using (
    type in ('프로필', '매칭프로필', '소셜', '답글', '하트', '매너')
    or user_key = public.current_user_key()
    or target  = public.current_user_key()
    or (type = '매칭채팅' and public.is_group_room(team))
    or (type = '기록' and public.is_coach_or_admin())
    or (type in ('코치신청', '멘토신청') and public.is_coach_or_admin())
  );

-- 로그인 전(둘러보기) 사용자: 공개 글만
drop policy if exists app_records_read_public on public.app_records;
create policy app_records_read_public
  on public.app_records for select
  to anon
  using (type in ('프로필', '매칭프로필', '소셜', '답글', '하트', '매너'));

-- 확인: ① 커뮤니티 글·답글·하트 ② 모집 글 단체방 대화 ③ 코치 화면의 선수 일지
--   ④ 내 일지·달력메모 ⑤ 받은 매칭/친구 신청 → 모두 그대로 보이는지.


-- ------------------------------------------------------------
-- 4단계(선택) · 친구 코드를 무작위 6자리로 (역산 불가)
--   · 지금은 user_key 에서 계산되므로 누구나 전 회원 코드를 계산할 수 있습니다.
--   · 아래는 컬럼 + 발급 + '코드로만 찾기' RPC 예시입니다. 앱 코드도 같이 바꿔야 합니다
--     (js/domain.js friendCodeOf → 서버 값 사용, js/views/friends.js 조회 → rpc).
-- ------------------------------------------------------------
-- alter table public.app_users add column if not exists friend_code text unique;
--
-- create or replace function public.claim_friend_code()
-- returns text language plpgsql security definer set search_path = public as $$
-- declare v_key text := public.current_user_key(); v_code text;
-- begin
--   if v_key is null then return null; end if;
--   select friend_code into v_code from public.app_users where user_key = v_key;
--   if v_code is not null then return v_code; end if;
--   loop
--     v_code := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 6));
--     begin
--       update public.app_users set friend_code = v_code where user_key = v_key;
--       return v_code;
--     exception when unique_violation then v_code := null;
--     end;
--   end loop;
-- end $$;
--
-- create or replace function public.find_by_friend_code(p_code text)
-- returns table (user_key text, nick text) language sql stable security definer
-- set search_path = public as $$
--   select u.user_key, u.nick from public.app_users u
--   where upper(u.friend_code) = upper(trim(p_code)) limit 2;
-- $$;
--
-- grant execute on function public.claim_friend_code() to authenticated;
-- grant execute on function public.find_by_friend_code(text) to authenticated;


-- ------------------------------------------------------------
-- 확인용 (실행 뒤 값만 봅니다)
-- ------------------------------------------------------------
-- select tablename, policyname, roles::text, cmd, coalesce(qual, '') as qual
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
