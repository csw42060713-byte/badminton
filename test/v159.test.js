/* ============================================================
 * test/v159.test.js — bm-v1.73.0
 *   😴 14일 넘게 활동이 없는 계정은 매칭 추천·탐색 목록에서 자동으로 숨기고,
 *      다시 접속하면 곧바로 복구합니다. (계정·데이터는 지우지 않음)
 *
 *  사용자가 요청한 그대로 검증합니다.
 *   1) 규칙: 14일(INACTIVE_HIDE_DAYS = 14)을 '초과'하면 숨김
 *      · 13일 23시간 = 보임 · 14일 = 아직 보임 · 14일 + 1분 = 숨김
 *      · 활동 시각 = 최신 기록·채팅·프로필 갱신·매칭프로필 lastActiveAt
 *      · 흔적이 없는 레거시 카드는 매칭프로필 생성일로 대신 판단
 *   2) 목록: 매칭 탭(찾기)과 동네 동호인에서 조용한 카드만 빠짐
 *      · 본인은 빠지지 않음
 *      · 이미 친구 / 1:1 대화방 / 진행 중인 매칭 신청 상대는 그대로(대화 유지)
 *      · 목록 아래에 "최근 14일 안에 활동한 분들만 보여 드려요" 안내
 *   3) 복구: 다시 활동(새 기록·lastActiveAt 갱신)을 남기면 즉시 목록에 돌아옴
 *   4) Google 로그인 직후 토큰이 늦게 와도 대기 중인 저장을 한 번 더 보냄
 *   5) 보호: 5개 탭·v1.58 기능 · 보안(CSP·이스케이프) · 실명 미포함 · 버전
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util, D = BM.domain;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var DAY = 24 * 60 * 60 * 1000;
  var ME = 'u_v159_me';

  /* 테스트 기준 시각 — 순수 함수 판정은 이 시각으로 고정합니다 */
  var NOW = new Date(2026, 10, 23, 12, 0, 0).getTime();
  function atDaysAgo(days, nowMs) { return U.stamp(new Date((nowMs || NOW) - days * DAY)); }
  function nowStamp() { return U.stamp(new Date()); }            /* 화면(실제 시계)용 */

  function person(activityAt, extra) {
    var p = { userKey: 'x', activityAt: activityAt };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  /* ---------- 행 만들기 ---------- */
  var PROFILE = { region: '경기', level: 'C조', discipline: '복식', club: '나래울', availability: '주말', experience: '2~5년', bio: '주말에 같이 쳐요', avatar: '🏸', gender: '남성' };

  function pRow(key, nick, agoMs) {
    return D.toRow({ id: 'p_' + key, type: '프로필', createdAt: U.stamp(new Date(Date.now() - (agoMs || 40 * DAY))), userKey: key, nick: nick, level: 'C조', discipline: '복식', bio: '소개' });
  }
  function mpRow(key, nick, agoMs, patch) {
    var payload = {};
    Object.keys(PROFILE).forEach(function (k) { payload[k] = PROFILE[k]; });
    Object.keys(patch || {}).forEach(function (k) { payload[k] = patch[k]; });
    return D.toRow({ id: 'mp_' + key, type: '매칭프로필', createdAt: U.stamp(new Date(Date.now() - agoMs)), userKey: key, nick: nick, payload: payload });
  }

  /* 사람별 카드 — 모두 '지금' 기준의 상대 시각으로 만듭니다(화면은 실제 시계 사용) */
  function baseRows() {
    return [
      pRow(ME, '나래'),
      mpRow(ME, '나래', 0),
      /* 최근 활동 */
      pRow('v159_fresh', '새벽러너'), mpRow('v159_fresh', '새벽러너', 2 * DAY),
      /* 13일 23시간 — 아직 보입니다 */
      pRow('v159_edge', '경계콕'), mpRow('v159_edge', '경계콕', 13 * DAY + 23 * 60 * 60 * 1000),
      /* 정확히 14일(초 단위 오차만 남김) — 14일을 '초과'하지 않았으므로 보입니다 */
      pRow('v159_exact', '딱열나흘'), mpRow('v159_exact', '딱열나흘', 14 * DAY - 30 * 1000),
      /* 20일 조용 — 숨김 */
      pRow('v159_quiet', '조용한콕'), mpRow('v159_quiet', '조용한콕', 20 * DAY),
      /* 40일 조용하지만 친구 — 유지 */
      pRow('v159_friend', '친구콕'), mpRow('v159_friend', '친구콕', 40 * DAY),
      D.toRow({ id: 'fr_v159', type: '친구수락', createdAt: U.stamp(new Date(Date.now() - 30 * DAY)), userKey: ME, target: 'v159_friend', nick: '나래' }),
      /* 40일 조용하지만 1:1 대화방이 있음 — 유지 */
      pRow('v159_room', '대화콕'), mpRow('v159_room', '대화콕', 40 * DAY),
      D.toRow({ id: 'c_v159', type: '매칭채팅', createdAt: U.stamp(new Date(Date.now() - 40 * DAY)), userKey: 'v159_room', target: ME, team: 'room_v159', nick: '대화콕', text: '다음에 또 쳐요' }),
      /* 40일 조용하지만 받은 매칭 신청이 대기 중 — 유지 */
      pRow('v159_req', '요청콕'), mpRow('v159_req', '요청콕', 40 * DAY),
      D.toRow({ id: 'r_v159', type: '매칭신청', createdAt: U.stamp(new Date(Date.now() - 40 * DAY)), userKey: 'v159_req', target: ME, nick: '요청콕', status: '대기', text: '주말 오전 어때요?' })
    ];
  }

  function stateOf(rows) {
    rows = rows || baseRows();
    return {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', club: '나래울', theme: { theme: 'th_night', avatar: '🏸' } },
      rows: rows, data: BM.store.derive(rows, ME),
      drafts: { log: {} }, prefs: D.normalizePrefs({}),
      inbox: { messages: [], requests: [], friendRequests: [], total: 0, at: '' },
      ui: {
        tab: 'matching', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchStarted: true, matchSort: 'score', matchTab: 'find', matchFilterOpen: ''
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1) 규칙 — 14일 초과
   * ========================================================= */
  test('v1.59 규칙: 14일 상수와 판정 함수가 있다', function () {
    eq(D.INACTIVE_HIDE_DAYS, 14, '14일');
    eq(D.INACTIVE_HIDE_MS, 14 * 24 * 60 * 60 * 1000, 'ms 상수');
    ok(typeof D.isInactiveProfile === 'function', 'isInactiveProfile');
    ok(typeof D.activityAtOf === 'function', 'activityAtOf');
    ok(typeof D.withoutInactive === 'function', 'withoutInactive');
  });

  test('v1.59 규칙: 13일 23시간은 보이고, 14일을 넘기면 숨긴다', function () {
    eq(D.isInactiveProfile(person(atDaysAgo(13 + 23 / 24)), NOW), false, '13일 23시간 = 보임');
    var exact = person(U.stamp(new Date(NOW - 14 * DAY)));
    eq(D.isInactiveProfile(exact, NOW), false, '정확히 14일 = 아직 보임');
    var over = person(U.stamp(new Date(NOW - 14 * DAY - 60000)));
    eq(D.isInactiveProfile(over, NOW), true, '14일 + 1분 = 숨김');
    eq(D.isInactiveProfile(person(atDaysAgo(20)), NOW), true, '20일 = 숨김');
    eq(D.isInactiveProfile(person(''), NOW), false, '활동 정보가 아예 없으면 숨기지 않음');
    eq(D.isInactiveProfile(null, NOW), false, '카드가 없으면 숨기지 않음');
  });

  test('v1.59 규칙: 활동 시각은 최신 기록 · lastActiveAt · 생성일 순서로 읽는다', function () {
    var created = atDaysAgo(30);
    var last = atDaysAgo(3);
    eq(D.activityAtOf({ createdAt: created }), created, '생성일 fallback');
    eq(D.activityAtOf({ createdAt: created, lastActiveAt: last }), last, 'lastActiveAt 우선');
    eq(D.activityAtOf({ createdAt: created, lastActiveAt: last, activityAt: atDaysAgo(1) }), atDaysAgo(1), 'activityAt 최우선');
    eq(D.activityAtOf({ payload: { lastActiveAt: last } }), last, 'payload.lastActiveAt');
  });

  test('v1.59 규칙: 사람별 활동 시각 표를 한 번에 만든다', function () {
    var state = stateOf();
    var map = D.activityTimes(state.data.idx);
    ok(map[ME], '내 활동 시각');
    ok(map['v159_room'], '대화 상대 활동 시각');
    eq(map['nobody_v159'], undefined, '없는 사람은 비어 있음');
    /* lastActiveAt 이 적힌 카드는 그 시각까지 반영 */
    var rows = baseRows().filter(function (r) { return String(r[0]) !== 'mp_v159_quiet'; });
    rows.push(mpRow('v159_quiet', '조용한콕', 20 * DAY, { lastActiveAt: nowStamp() }));
    var idx = state.data.idx;
    var idx2 = BM.store.derive(rows, ME).idx;
    ok(D.activityTimes(idx2)['v159_quiet'] > D.activityTimes(idx)['v159_quiet'], 'lastActiveAt 반영');
  });

  test('v1.59 저장소: 매칭 카드마다 활동 시각(activityAt)이 붙는다', function () {
    var state = stateOf();
    var fresh = state.data.matchProfiles.filter(function (p) { return p.userKey === 'v159_fresh'; })[0];
    ok(fresh && fresh.activityAt, '활동 시각 있음');
    var quiet = state.data.matchProfiles.filter(function (p) { return p.userKey === 'v159_quiet'; })[0];
    ok(quiet.activityAt < fresh.activityAt, '조용한 카드가 더 오래됨');
    eq(D.isInactiveProfile(quiet), true, '조용한 카드는 14일 초과');
  });

  /* =========================================================
   * 2) 목록 — 매칭 찾기 · 동네 동호인
   * ========================================================= */
  test('v1.59 목록: 매칭 찾기에서 14일 넘게 조용한 카드만 빠진다', function () {
    var state = stateOf();
    var nicks = BM.views.matching.visiblePlayers(state).map(function (p) { return p.nick; });
    ok(nicks.indexOf('새벽러너') >= 0, '최근 활동 = 보임');
    ok(nicks.indexOf('경계콕') >= 0, '13일 23시간 = 보임');
    ok(nicks.indexOf('딱열나흘') >= 0, '14일 직전 = 보임');
    eq(nicks.indexOf('조용한콕'), -1, '20일 = 숨김');
    eq(nicks.indexOf('나래'), -1, '본인은 목록에 없음');

    var html = BM.views.matching.render(state);
    excludes(html, '조용한콕', '화면에도 없음');
    includes(html, 'data-player="v159_fresh"', '보이는 카드');
  });

  test('v1.59 목록: 친구·1:1 대화방·진행 중인 매칭 신청 상대는 숨기지 않는다', function () {
    var state = stateOf();
    var nicks = BM.views.matching.visiblePlayers(state).map(function (p) { return p.nick; });
    ok(nicks.indexOf('친구콕') >= 0, '친구 유지');
    ok(nicks.indexOf('대화콕') >= 0, '대화방 상대 유지');
    ok(nicks.indexOf('요청콕') >= 0, '받은 매칭 신청 상대 유지');
    ok(D.keepsInTouch(state.data.idx, ME, 'v159_room'), '대화방 판정');
    ok(D.keepsInTouch(state.data.idx, ME, 'v159_friend'), '친구 판정');
    ok(!D.keepsInTouch(state.data.idx, ME, 'v159_quiet'), '관계 없는 사람은 유지 대상 아님');
  });

  test('v1.59 목록: 대화 탭·받은 요청 탭은 숨김과 상관없이 그대로다', function () {
    var state = stateOf();
    eq((state.data.rooms || []).length, 1, '1:1 대화방 유지');
    eq(state.data.rooms[0].other, 'v159_room', '대화 상대');
    eq((state.data.friends || []).length, 1, '친구 유지');
    eq(BM.views.matching.pendingIncoming(state).length, 1, '받은 요청 유지');
    state.ui.matchTab = 'chat';
    includes(BM.views.matching.render(state), 'data-open-chat=', '대화방은 그대로 보임');
    state.ui.matchTab = 'in';
    includes(BM.views.matching.render(state), '요청콕', '받은 요청은 그대로 보임');
  });

  test('v1.59 안내: 목록 아래에 14일 기준과 숨긴 인원을 조용히 알려 준다', function () {
    var state = stateOf();
    var html = BM.views.matching.resultsHtml(state);
    includes(html, '최근 14일 안에 활동한 분들만 보여 드려요', '안내 문구');
    includes(html, '쉬고 있는 1명은 잠시 감춰 뒀어요', '숨긴 인원');
    includes(html, 'resultbar__quiet', '안내 스타일');
    /* 숨길 사람이 없으면 인원 문구는 붙지 않습니다 */
    var clean = stateOf(baseRows().filter(function (r) {
      return String(r[0]) !== 'mp_v159_quiet' && String(r[0]) !== 'p_v159_quiet';
    }));
    includes(BM.views.matching.resultsHtml(clean), '최근 14일 안에 활동한 분들만 보여 드려요', '안내는 그대로');
    excludes(BM.views.matching.resultsHtml(clean), '잠시 감춰 뒀어요', '숨긴 사람 없으면 인원 문구 없음');
  });

  test('v1.59 안내: 모두 조용하면 조건이 아니라 활동 기준 때문이라고 알려 준다', function () {
    var rows = [
      pRow(ME, '나래'), mpRow(ME, '나래', 0),
      pRow('v159_only', '한적한콕'), mpRow('v159_only', '한적한콕', 30 * DAY)
    ];
    var state = stateOf(rows);
    eq(BM.views.matching.visiblePlayers(state).length, 0, '보이는 카드 없음');
    var html = BM.views.matching.resultsHtml(state);
    includes(html, '지금은 다들 잠시 쉬는 중이에요', '빈 목록 제목');
    includes(html, '최근 14일 안에 활동한 분들만 보여 드려요', '이유 안내');
  });

  test('v1.59 동네: 반경 5km 동호인 목록에서도 14일 미접속 카드는 빠진다', function () {
    var state = stateOf();
    var names = BM.nearby.all(state).map(function (p) { return p.name; });
    ok(names.indexOf('새벽러너') >= 0, '최근 활동 = 보임');
    eq(names.indexOf('조용한콕'), -1, '조용한 카드 = 숨김');
    ok(names.indexOf('대화콕') >= 0, '대화 상대는 유지');
    /* 예시 동호인(데모)은 그대로 — 화면이 비어 보이지 않게 */
    ok(BM.nearby.DEMO.length > 0, '예시 동호인 유지');
  });

  /* =========================================================
   * 3) 복구 — 다시 활동하면 즉시 돌아온다
   * ========================================================= */
  test('v1.59 복구: 새 기록을 남기면 그 사람은 곧바로 목록에 돌아온다', function () {
    var rows = baseRows();
    ok(BM.views.matching.visiblePlayers(stateOf(rows)).map(function (p) { return p.nick; }).indexOf('조용한콕') < 0, '처음엔 숨김');
    /* 조용한콕이 다시 앱을 열어 일지를 남김 */
    rows.push(D.toRow({
      id: 'log_v159', type: '기록', createdAt: nowStamp(), date: U.ymd(),
      userKey: 'v159_quiet', nick: '조용한콕', level: 'C조', discipline: '복식',
      cond: 7, intensity: 7, minutes: 60, done: ['스트록']
    }));
    var back = stateOf(rows);
    ok(BM.views.matching.visiblePlayers(back).map(function (p) { return p.nick; }).indexOf('조용한콕') >= 0, '다시 보임');
    excludes(BM.views.matching.resultsHtml(back), '쉬고 있는 1명은 잠시 감춰 뒀어요', '숨긴 인원도 사라짐');
    eq(BM.views.matching.visiblePlayers(back).length, BM.views.matching.visiblePlayers(stateOf()).length + 1, '한 명 늘어남');
  });

  test('v1.59 복구: touchActivity 로 lastActiveAt 이 갱신되면 다시 보인다', function () {
    var rows = baseRows().filter(function (r) { return String(r[0]) !== 'mp_v159_quiet'; });
    rows.push(mpRow('v159_quiet', '조용한콕', 20 * DAY, { lastActiveAt: nowStamp() }));
    var state = stateOf(rows);
    var quiet = state.data.matchProfiles.filter(function (p) { return p.userKey === 'v159_quiet'; })[0];
    eq(D.isInactiveProfile(quiet), false, 'lastActiveAt 오늘 = 활동 중');
    ok(BM.views.matching.visiblePlayers(state).map(function (p) { return p.nick; }).indexOf('조용한콕') >= 0, '목록 복구');
  });

  test('v1.59 복구: 계정·데이터는 지우지 않는다(카드도 그대로 남아 있음)', function () {
    var state = stateOf();
    var quiet = state.data.matchProfiles.filter(function (p) { return p.userKey === 'v159_quiet'; })[0];
    ok(quiet, '카드는 데이터에 남아 있음');
    eq(quiet.nick, '조용한콕', '닉네임 유지');
    ok(state.rows.some(function (r) { return String(r[0]) === 'mp_v159_quiet'; }), '행도 그대로');
    var before = state.rows.length;
    BM.views.matching.render(state);
    eq(state.rows.length, before, '화면을 그려도 행이 줄지 않음');
    includes(readRoot('js/domain.js'), 'function withoutInactive', '숨김은 목록 필터로만');
  });

  /* =========================================================
   * 4) Google 로그인 직후 토큰 연결 · 동기화 보강
   * ========================================================= */
  test('v1.59 로그인: 토큰을 받은 직후 대기 중인 저장을 한 번 더 보낸다', function () {
    ok(typeof BM.auth.retryPendingSync === 'function', 'retryPendingSync');
    ok(typeof BM.auth.takeSyncRetry === 'function', 'takeSyncRetry');
    var called = 0;
    var prev = BM.app;
    var fake = { ctx: { store: { state: { queue: [{ kind: 'append' }] } }, actions: { retrySync: function () { called++; return Promise.resolve({ ok: true }); } } } };
    BM.app = fake;
    return BM.auth.retryPendingSync().then(function () {
      eq(called, 1, '대기열이 있으면 한 번 보냄');
      fake.ctx.store.state.queue = [];
      return BM.auth.retryPendingSync();
    }).then(function () {
      eq(called, 1, '대기열이 없으면 보내지 않음');
      BM.app = prev;
    });
  });

  test('v1.59 로그인: 앱이 뜨기 전에 토큰이 와도 앱이 뜬 뒤 한 번 확인한다', function () {
    var prev = BM.app;
    BM.app = { ctx: null };
    U.writeJSON('bm_queue_v1', [{ kind: 'append' }]);
    return BM.auth.retryPendingSync().then(function () {
      eq(BM.auth.takeSyncRetry(), true, '앱이 뜨면 확인');
      eq(BM.auth.takeSyncRetry(), false, '한 번만');
      U.storage.removeItem('bm_queue_v1');
      BM.app = prev;
    });
  });

  test('v1.59 로그인: 소스에 연결 지점이 남아 있다', function () {
    if (!hasNode()) return;
    var auth = readRoot('js/auth.js');
    includes(auth, 'retryPendingSync();', 'linkGoogleIdToken 안에서 호출');
    includes(auth, 'bm_queue_v1', '기기에 남은 대기열 확인');
    var app = readRoot('app.js');
    includes(app, 'takeSyncRetry', '앱이 뜬 뒤 확인');
    includes(app, 'store.actions.retrySync()', '다시 보내기');
  });

  /* =========================================================
   * 5) 보호 · 보안 · 문구 · 버전
   * ========================================================= */
  test('v1.59 보호: 5개 탭과 v1.58 기능이 그대로다', function () {
    if (!hasNode()) return;
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');
    includes(readRoot('js/sharecard.js'), 'PALETTES', 'v1.57~1.58 공유 카드 색상 유지');
    eq((readRoot('js/sharecard.js').match(/\{ id: '\w+', name: '[^']+', note:/g) || []).length, 26, '공유 카드 모음(모드 2 · 비율 2 · 디자인 4 · 밝기 3 · 색 5 · 글씨 위치 3 · 사진 필터 5 · 숫자 표시 2)');
    includes(readRoot('js/store.js'), 'DEAD_KEY', 'v1.58 격리 보관 유지');
    includes(readRoot('js/views/my.js'), 'retryBlocked', '격리된 저장 다시 보내기 유지');
  });

  test('v1.59 보안: 새 화면도 이스케이프를 거치고 CSP는 그대로다', function () {
    if (!hasNode()) return;
    var m = readRoot('js/views/matching.js');
    includes(m, 'U.esc(', '이스케이프 사용');
    excludes(m, 'eval(', 'eval 없음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
    includes(csp, "object-src 'none'", 'object 잠금');
    includes(csp, "form-action 'self'", 'form 잠금');
  });

  test('v1.59 문구: 예시·안내에 실존 선수 이름을 쓰지 않는다', function () {
    if (!hasNode()) return;
    var src = readRoot('js/domain.js') + readRoot('js/views/matching.js') + readRoot('js/nearby.js') + readRoot('js/store.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) { excludes(src, name, name + ' 없음'); });
    var m = readRoot('js/views/matching.js');
    excludes(m, '김원호', '안내 문구에도 없음');
  });

  test('v1.59 스타일: 14일 안내 한 줄 스타일이 있다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    includes(css, '.resultbar__quiet', '안내 스타일');
    includes(css, 'font-size: 11.5px', '작은 글씨');
  });

  test('v1.59 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.84.0'", 'sw.js');
    includes(app, "version: 'v1.84.0'", 'app.js');
    includes(index, 'styles.css?v=20261126-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.84.0', 'TWA 이름');
    eq(twa.appVersion, '1.84.0', 'TWA 버전');
    eq(twa.appVersionCode, 78, 'TWA 코드');
    includes(sw, '14일', 'sw 변경 이력');
    var run = readRoot('test/run.js');
    includes(run, 'test/v159.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
