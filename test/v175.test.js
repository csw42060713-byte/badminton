/* ============================================================
 * test/v175.test.js — bm-v1.84.0
 *   🔒 하트·광고 보상 서버 잠금
 *
 *   하트 원장(출석·광고·꾸미기·선물)을 이제 서버(Supabase RPC)만 적립·차감하는지 봅니다.
 *   1) 서버 SQL — 함수 3종(출석·광고·쓰기)·잔액·연속 보너스·RLS 잠금 유형
 *   2) 앱 코드 — Supabase 모드는 rpc 로만, 기기 저장·시트 브리지는 예전 그대로
 *   3) 화면 — 결과가 바로 오거나(Promise) 나중에 와도 같은 문구(U.when)
 *   4) 보호 — 시트 26칸·localStorage 키·주소·packageId·5개 탭 그대로, 실존 선수 이름 없음
 *   5) 버전 정합(sw · app · index · TWA · README · 테스트 목록)
 *
 *   실서버 검증은 work/heart_rpc_e2e.py (RPC 왕복 + 클라이언트 직접 INSERT 차단)로 합니다.
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var D = BM.domain;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  var LOCKED = ['출석하트', '광고하트', '꾸미기구매', '선물하트', '하트합치기', '내하트사용'];

  /* =========================================================
   * 1. 서버 SQL — supabase/heart-rpc-v1.75.sql
   * ========================================================= */
  test('v1.75 서버: 적립·쓰기·잔액 함수가 SQL 파일에 있다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'create or replace function public.heart_checkin()', '출석 RPC');
    includes(sql, 'create or replace function public.heart_ad_reward(p_tx text default null, p_unit text default null)', '광고 RPC');
    includes(sql, 'create or replace function public.heart_spend(p_kind text, p_target text default null)', '쓰기 RPC');
    includes(sql, 'create or replace function public.heart_balance(p_key text)', '잔액 함수');
    includes(sql, 'security definer', '서버 함수는 definer');
    includes(sql, "grant execute on function public.heart_checkin() to authenticated", '로그인 사용자만 실행');
    excludes(sql, 'service_role', '비밀 키를 쓰지 않는다');
  });

  test('v1.75 서버: 잠그는 유형 6가지가 정확하다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    LOCKED.forEach(function (type) {
      includes(sql, "'" + type + "'", '잠금 유형 ' + type);
    });
    includes(sql, "create or replace function public.bm_locked_type(p_type text)", '잠금 유형 함수');
    /* 커뮤니티 글 좋아요('하트')는 잠그지 않습니다 — 글쓰기·좋아요는 그대로 */
    excludes(sql, "('출석하트', '광고하트', '하트합치기', '선물하트', '내하트사용', '꾸미기구매', '하트')", "좋아요 '하트'는 잠금 목록에 없다");
  });

  test('v1.75 서버: RLS 가 하트 행의 INSERT·UPDATE·DELETE 를 막는다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'drop policy if exists app_records_insert_self on public.app_records;', 'INSERT 정책 교체');
    includes(sql, 'and not public.bm_locked_type(type)', 'INSERT 는 잠근 유형을 거부');
    includes(sql, 'create policy app_records_owner_update', 'UPDATE 정책');
    includes(sql, 'using (user_key = public.current_user_key() and not public.bm_locked_type(type))', 'UPDATE 는 잠근 유형을 못 고친다');
    includes(sql, 'create policy app_records_owner_delete', 'DELETE 정책');
    includes(sql, 'and not public.bm_locked_type(type));\n\n\n-- ----', 'DELETE 도 잠근 유형을 못 지운다');
    includes(sql, 'bm_shadow_locked', "가림 행('수정') 우회 차단");
  });

  test('v1.75 서버: 연속 출석 보너스가 앱 규칙(3·7·14·30)과 같다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'create or replace function public.bm_streak_bonus(p_run int)', '보너스 함수');
    includes(sql, 'case when p_run >= 30 then 5 else 0 end', '30일 +5');
    includes(sql, 'case when p_run >= 14 then 3 else 0 end', '14일 +3');
    includes(sql, 'case when p_run >= 7  then 2 else 0 end', '7일 +2');
    includes(sql, 'case when p_run >= 3  then 1 else 0 end', '3일 +1');
    includes(sql, '3 * (p_run / 14 - 1)', '14일마다 반복');
    /* 앱 쪽 표와 같은 숫자인지 */
    eq(D.streakBonusFor(3).amount, 1, '앱 3일 +1');
    eq(D.streakBonusFor(7).amount, 2, '앱 7일 +2');
    eq(D.streakBonusFor(14).amount, 3, '앱 14일 +3');
    eq(D.streakBonusFor(30).amount, 5, '앱 30일 +5');
    eq(D.streakBonusFor(28).amount, 3, '앱 28일 +3');
  });

  test('v1.75 서버: 광고는 하루 5회·30초·txId 중복·첫 광고 +1', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'if v_used >= 5 then', '하루 5회');
    includes(sql, "interval '30 seconds'", '30초 간격');
    includes(sql, "and note like 'tx:%'", 'txId 는 메모의 tx: 접두어로 본다');
    includes(sql, "'dailyBoost', case when v_first then 1 else 0 end", '오늘 첫 광고 +1');
    eq(D.HEART_RULES.AD_PER_DAY, 5, '앱 하루 5회');
    eq(D.HEART_RULES.AD_COOLDOWN_SEC, 30, '앱 30초');
    eq(D.DAILY_BOOST.amount, 1, '앱 오늘의 부스트 +1');
  });

  test('v1.75 서버: 꾸미기 가격표가 앱과 같다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    /* 가격표 함수 본문만 잘라서 봅니다(주석의 같은 낱말과 섞이지 않게) */
    var table = sql.slice(sql.indexOf('function public.bm_deco_price'));
    ['frame:royal', 'frame:sakura', 'frame:gold', 'frame:neon', 'badge:fire',
      'badge:star', 'badge:medal', 'badge:crown', 'boost:heart', 'card:champ', 'badge:champ'
    ].forEach(function (id) {
      var m = (table.split("when '" + id + "'")[1] || '').match(/then\s+(\d+)/);
      ok(m, id + ' 가격 줄을 찾는다');
      eq(D.decoPrice(id), Number(m && m[1]), id + ' 가격이 앱·서버에서 같다');
    });
    eq(D.decoPrice('boost:heart'), 3, '하트 부스트 3개');
    eq(D.decoPrice('card:champ'), 2, '챔피언 프레임 2개');
  });

  /* =========================================================
   * 2. 앱 코드 — api.js rpc · store.js 서버 분기
   * ========================================================= */
  test('v1.75 앱: Supabase 에만 rpc 가 있고 기기·시트에는 없다', function () {
    if (!hasNode) return;
    var api = root.BM.api;
    var local = api.createLocal({ latency: 0 });
    var sheets = api.createSheets({ url: 'https://script.google.com/macros/s/xx/exec' });
    var sb = api.createSupabase({ url: 'https://example.supabase.co', key: 'anon-key', meKey: 'u_test' });
    ok(typeof sb.rpc === 'function', 'Supabase 는 rpc 를 제공');
    ok(!local.rpc, '기기 저장은 rpc 없음(예전 그대로)');
    ok(!sheets.rpc, '시트 브리지는 rpc 없음(브리지가 검사)');
    includes(String(sb.rpc), 'rpc/', 'rpc 경로로 보낸다');
  });

  test('v1.75 앱: rpc 는 응답 배열을 첫 값으로 풀어 준다', function () {
    /* 실제 호출 없이 약속 모양만 확인 — BM.api.SUPABASE.rest 는 내부 함수라
     * 화면 테스트(Playwright)에서 서버 왕복으로 확인합니다. */
    var sb = root.BM.api.createSupabase({ url: 'https://example.supabase.co', key: 'anon-key', meKey: 'u_test' });
    var p = sb.rpc('heart_checkin', {});
    ok(p && typeof p.then === 'function', 'rpc 는 Promise 를 돌려준다');
    if (p && typeof p.catch === 'function') p.catch(function () { /* 네트워크 없음 — 무시 */ });
  });

  test('v1.75 앱: 하트 행은 서버가 넣고 큐에 다시 보내지 않는다', function () {
    if (!hasNode) return;
    var store = readRoot('js/store.js');
    includes(store, 'function heartServer()', '서버 판별');
    includes(store, 'typeof apiRef.rpc === \'function\'', 'rpc 가 있는 백엔드만');
    includes(store, "server.rpc('heart_checkin', {})", '출석은 서버');
    includes(store, "server.rpc('heart_ad_reward'", '광고는 서버');
    includes(store, "server.rpc('heart_spend', { p_kind: 'deco'", '꾸미기는 서버');
    includes(store, "server.rpc('heart_spend', { p_kind: 'gift'", '선물은 서버');
    includes(store, "server.rpc('heart_spend', { p_kind: 'match'", '매칭 신청은 서버 확인');
    includes(store, 'function pushServerRow(r)', '서버가 만든 행을 화면에 꽂는다');
    includes(store, 'if (!exists) state.rows.unshift(row);', '이미 서버에 있으니 큐에 넣지 않는다');
    /* 기기 저장 경로는 남아 있어야 합니다(체험·오프라인) */
    includes(store, "type: '출석하트', id: U.uid()", '기기 저장 출석 경로 유지');
    includes(store, "type: '광고하트', id: U.uid()", '기기 저장 광고 경로 유지');
  });

  test('v1.75 앱: 서버가 거절하면 이유를 그대로 화면에 넘긴다', function () {
    if (!hasNode) return;
    var store = readRoot('js/store.js');
    ['no_login', 'offline', 'login', 'duplicate', 'limit', 'cooldown', 'hearts'].forEach(function (r) {
      includes(store, "'" + r + "'", '이유 ' + r);
    });
    includes(store, "res.reason === 'done'", '다른 기기에서 먼저 출석한 경우');
    ok(!/heart_checkin[\s\S]{0,200}?enqueue\(/.test(store), '서버 적립 뒤 큐에 다시 넣지 않는다');
  });

  /* =========================================================
   * 3. 화면 — Promise 든 즉시 값이든 같은 문구
   * ========================================================= */
  test('v1.75 화면: U.when 이 즉시 값과 Promise 를 모두 받는다', function () {
    var sync = U.when({ ok: true, gained: 2 }, function (r) { return r.gained; });
    eq(sync, 2, '즉시 값은 그대로');
    var called = 0;
    U.when(Promise.resolve({ ok: true, gained: 3 }), function (r) { called = r.gained; });
    var failed = null;
    U.when(Promise.reject(new Error('x')), function (r) { failed = r; });
    ok(typeof Promise !== 'undefined', 'Promise 사용');
    return Promise.all([
      Promise.resolve().then(function () { eq(called, 3, 'Promise 값도 받는다'); }),
      Promise.resolve().then(function () { eq(failed && failed.ok, false, '실패는 error 로'); })
    ]);
  });

  test('v1.75 화면: 하트 화면들이 U.when·Promise 로 결과를 받는다', function () {
    if (!hasNode) return;
    var my = readRoot('js/views/my.js');
    includes(my, 'U.when(ctx.actions.checkIn()', '출석 버튼');
    includes(my, 'U.when(res, function (res) {', '광고 버튼');
    includes(my, 'U.when(ctx.actions.buyDeco(kind, value)', '꾸미기 구매');
    includes(my, 'U.when(ctx.actions.buyDeco(\'boost\', \'heart\')', '하트 부스트');
    var matching = readRoot('js/views/matching.js');
    includes(matching, 'U.when(res, function (res) {', '매칭 요청');
    includes(matching, 'U.when(r, function (r) {', '하트 선물');
    var ads = readRoot('js/ads.js');
    includes(ads, 'return Promise.resolve(res).then(function (res) {', '광고 적립 결과');
    includes(ads, 'Promise.resolve(actions.checkIn ? actions.checkIn() : null)', '충전 시트 출석');
    var share = readRoot('js/sharecard.js');
    includes(share, 'function unlockFrameAfter(', '챔피언 프레임 해금 결과');
  });

  /* =========================================================
   * 4. 보호 — 이름·키·구조·시트 26칸은 그대로
   * ========================================================= */
  test('v1.75 보호: 시트 26칸·저장 키·주소·packageId 그대로', function () {
    if (!hasNode) return;
    eq(D.COLS.length, 26, '시트 26칸');
    var store = readRoot('js/store.js');
    includes(store, "var QUEUE_KEY = 'bm_queue_v1';", '대기열 키 그대로');
    includes(store, "var DEAD_KEY = 'bm_queue_dead_v1';", '격리 키 그대로');
    var twa = readJson('twa-manifest.json');
    eq(twa.packageId, 'io.github.csw42060713_byte.badminton', 'packageId 그대로');
    includes(readRoot('README.md'), 'csw42060713-byte.github.io/badminton', '주소 그대로');
  });

  test('v1.75 보호: 5개 탭·커뮤니티 좋아요 행은 그대로', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    includes(app, "{ id: 'log', label: '일지 & AI'", '탭 정의 유지');
    var store = readRoot('js/store.js');
    includes(store, "type: '하트', id: U.uid()", '커뮤니티 좋아요는 잠그지 않는다');
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    excludes(sql, "('수정', '삭제') and public.bm_shadow_locked(target)) and type", '가림 행 규칙은 하트 행에만');
  });

  test('v1.75 보호: 실존 선수 이름·비밀 키를 쓰지 않는다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    ['김원호', '안세영', '서승재', 'service_role_key', 'sb_secret_', 'db_password'].forEach(function (bad) {
      excludes(sql, bad, bad + ' 없음');
    });
    var store = readRoot('js/store.js');
    ['김원호', '안세영', '서승재'].forEach(function (bad) { excludes(store, bad, bad + ' 없음'); });
  });

  /* =========================================================
   * 5. 버전 정합
   * ========================================================= */
  test('v1.75 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.84.0';", 'sw 캐시 이름');
    includes(readRoot('app.js'), "version: 'v1.84.0'", 'app 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261126-6', '스타일 캐시');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.84.0', 'TWA 이름');
    eq(twa.appVersionCode, 78, 'TWA 코드');
    eq(twa.appVersion, '1.84.0', 'TWA 버전');
    var readme = readRoot('README.md');
    includes(readme, 'bm-v1.84.0', 'README 버전 절');
    includes(readme, '하트·광고 보상 서버 잠금', 'README 요약');
    includes(readRoot('test/run.js'), 'test/v175.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
