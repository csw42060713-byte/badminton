/* ============================================================
 * test/v182.test.js — bm-v1.86.0
 *   🗺️ 지도 길찾기 · 매칭 ON 배지 · 라켓 창 초기화 수정 · 터치 불꽃 스매시
 *
 *   1) 지도  — 방위(8방위)·거리 표기·예상 시간·길찾기 링크, 검색 후보, 내 위치(GPS) 버튼
 *   2) 배지  — 상단 헤더가 작은 점 대신 '매칭 ON / 휴식 중' 글자 배지
 *   3) 기록  — 라켓·스트링 값을 저장한 뒤 테마·부스트·새로고침을 거쳐도 그대로
 *   4) 스매시 — 하트로 여는 스페셜 이펙트(불꽃 2 · 번개 3), 차감·해금·잔액 부족
 *   5) 보호  — 5개 탭 · 시트 26칸 · 하트 RPC · 3D 파츠/바디/등급 · 스매시 임팩트 그대로
 *   6) 버전  — sw · app · push · styles 캐시 · TWA · README · 테스트 목록
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var D = BM.domain;
  var U = BM.util;
  var RC = BM.racketcustom;
  var G = BM.gear;
  var GV = BM.views.gyms;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore() {
    clearStorage();
    U.writeJSON('bm_rows_v1', []);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function unlock(store) {
    if (store.state && store.state.locks) {
      store.state.locks.profile = 0;
      store.state.locks.deco = 0;
      store.state.locks.heartBoost = 0;
    }
    return store;
  }

  /* 기기 저장(로컬) 모드는 잠깐 뒤에 실제 저장소에 씁니다 — 테스트에서는 그 순서를 기다립니다 */
  function flush(store) {
    return Promise.resolve()
      .then(function () { return null; })
      .then(function () { return null; })
      .then(function () { return null; })
      .then(function () { return store; });
  }

  function stateOf(rows, opts) {
    opts = opts || {};
    var idx = D.index(rows || []);
    var me = { key: 'me', nick: '승우', level: 'B조', theme: { theme: 'th_night' } };
    if (opts.custom) me.gear = { custom: opts.custom };
    return {
      me: me, idx: idx, rows: rows || [],
      data: D.derive ? null : null,
      ui: {}
    };
  }

  /* =========================================================
   * 1. 지도 — 방향 · 거리 · 시간 · 길찾기
   * ========================================================= */
  test('v1.82 지도: 방위각을 8방위 이름으로 읽는다', function () {
    eq(GV.dir8(0), '북쪽', '0도는 북쪽');
    eq(GV.dir8(45), '북동쪽', '45도는 북동쪽');
    eq(GV.dir8(90), '동쪽', '90도는 동쪽');
    eq(GV.dir8(180), '남쪽', '180도는 남쪽');
    eq(GV.dir8(270), '서쪽', '270도는 서쪽');
    eq(GV.dir8(359), '북쪽', '359도는 다시 북쪽');
    /* 실제 좌표 — 망포동(수원)에서 북쪽에 있는 체육관은 북쪽 */
    var north = GV.bearingDeg({ lat: 37.20, lng: 127.05 }, { lat: 37.35, lng: 127.05 });
    ok(north > 350 || north < 10, '정북 방위각 ' + Math.round(north));
    var east = GV.bearingDeg({ lat: 37.20, lng: 127.05 }, { lat: 37.20, lng: 127.20 });
    ok(east > 80 && east < 100, '정동 방위각 ' + Math.round(east));
  });

  test('v1.82 지도: 거리는 1km 아래는 m, 위는 km 로 읽는다', function () {
    eq(GV.metersLabel(0.85), '850 m', '850m');
    eq(GV.metersLabel(0.004), '10 m', '아주 가까운 값은 10m 단위');
    eq(GV.metersLabel(1.83), '1.8 km', '1.8km');
    eq(GV.metersLabel(12), '12.0 km', '12km');
  });

  test('v1.82 지도: 예상 시간은 도보·차량·대중교통 순서로 늘어난다', function () {
    var from = { lat: 37.2455, lng: 127.0565 };
    var to = { lat: 37.2620, lng: 127.0715 };          /* 약 2km */
    var r = GV.routeInfo(from, to);
    ok(r && r.km > 1.5 && r.km < 2.6, '직선거리 ' + (r && r.km) + 'km');
    ok(r.walk > r.drive, '도보가 차량보다 오래 걸린다');
    ok(r.transit > r.drive, '대중교통이 차량보다 오래 걸린다');
    includes(r.distance, 'km', '거리 표기');
    includes(r.walkText, '약', '어림값 표기');
    ok(!!r.dir, '방위 이름이 있다');
    eq(GV.routeInfo({ lat: 0, lng: 0 }, null), null, '좌표가 없으면 null');
  });

  test('v1.82 지도: 예상 시간 표기는 60분이 넘으면 시간으로', function () {
    eq(GV.minLabel(8), '8분', '8분');
    eq(GV.minLabel(60), '1시간', '60분 = 1시간');
    eq(GV.minLabel(95), '1시간 35분', '95분');
  });

  test('v1.82 지도: 길찾기 링크가 네이버·카카오·구글 지도로 열린다', function () {
    var from = { lat: 37.2455, lng: 127.0565, label: '내 집 · 망포동' };
    var v = { name: '나래울체육관', lat: 37.2, lng: 127.1 };
    var links = GV.navLinks(from, v);
    includes(links.naver, 'map.naver.com', '네이버 지도');
    includes(links.naver, '127.1,37.2', '네이버에 도착 좌표');
    includes(links.kakao, 'map.kakao.com/link/from/', '카카오맵 길찾기');
    includes(links.kakao, encodeURIComponent('나래울체육관'), '카카오에 체육관 이름');
    includes(links.google, 'google.com/maps/dir/', '구글 지도 길찾기');
    includes(links.google, 'origin=37.2455,127.0565', '구글에 출발 좌표');
    excludes(links.naver, 'javascript:', '스크립트 주소는 쓰지 않는다');
  });

  test('v1.82 지도: 출발점은 위치를 허용했으면 내 위치, 아니면 내 집', function () {
    var start = GV.meStart({ geo: { lat: 37.5, lng: 127.0 }, home: { lat: 37.2, lng: 127.0, label: '망포동' } });
    eq(start.label, '내 위치', '허용했을 때');
    eq(start.live, true, 'live 표시');
    var home = GV.meStart({ geo: null, home: { lat: 37.2, lng: 127.0, label: '망포동' } });
    includes(home.label, '내 집', '내 집 기준');
    includes(home.label, '망포동', '동네 이름');
    eq(home.live, false, 'live 아님');
  });

  test('v1.82 지도 화면: 검색 후보·내 위치(GPS) 버튼·길찾기 카드가 있다', function () {
    var js = readRoot('js/views/gyms.js');
    includes(js, 'data-gymsug', '검색 후보 목록');
    includes(js, 'data-gym-gps', '내 위치(GPS) 버튼');
    includes(js, 'gymroute__go', '큰 길찾기 버튼');
    includes(js, 'data-gym-routecard', '길찾기 카드');
    includes(js, 'data-gymfroute', '오프라인 경로선');
    includes(js, 'syncRoute', '지도 경로선');
    includes(js, 'position: \'topright\'', '확대/축소를 위로 (GPS 자리 비움)');
    var html = GV.render({ geo: { lat: 37.2455, lng: 127.0565 }, focus: 'mapo', home: { lat: 37.5585, lng: 126.9012, label: '망원동' } });
    includes(html, 'data-gym-gps', 'render 안에 GPS 버튼');
    includes(html, 'data-gym-routecard', 'render 안에 길찾기 카드');
    includes(html, 'gymroute__apps', '네이버·카카오·구글 링크 줄');
  });

  /* =========================================================
   * 2. 상단 '내 상태' 배지
   * ========================================================= */
  test('v1.82 배지: 헤더가 작은 점 대신 매칭 ON / 휴식 중 글자 배지', function () {
    var html = readRoot('index.html');
    includes(html, 'id="matchPill"', '배지 자리');
    includes(html, 'matchpill', '배지 클래스');
    includes(html, '매칭 ON', '글자 배지(켜짐)');
    excludes(html, 'id="syncDot"', '작은 점은 없앴다');
    var app = readRoot('app.js');
    includes(app, "'매칭 ON'", '켜짐 문구');
    includes(app, "'휴식 중'", '꺼짐 문구');
    includes(app, 'matchpill', '배지 갱신');
    includes(app, "myStatus(pScope)", '내 상태에서 계산');
    var css = readRoot('styles.css');
    includes(css, '.matchpill', '배지 스타일');
    includes(css, '.matchpill.is-off', '휴식 중 스타일');
    includes(css, 'white-space: nowrap', '줄바꿈으로 넘치지 않게');
  });

  /* =========================================================
   * 3. 라켓 · 스트링 창 재오픈 초기화 수정
   * ========================================================= */
  test('v1.82 기록: 값 → 저장 → 다시 열기 → 그대로 (초기화 없음)', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      var res = store.actions.setGear({
        racket: '아크세이버 11', string: 'BG80', tension: 27,
        strungAt: '2026-11-20', cycleDays: 45, memo: '가을 대회용'
      });
      eq(res.ok, true, '저장 성공');
      var g = G.gearOf(store.state.me);
      eq(g.racket, '아크세이버 11', '라켓');
      eq(g.string, 'BG80', '스트링');
      eq(g.tension, 27, '장력');
      eq(g.strungAt, '2026-11-20', '교체일');
      eq(g.cycleDays, 45, '주기');
      eq(g.memo, '가을 대회용', '메모');
      /* 시트가 다시 열릴 때 쓰는 값 = 시트 본문 */
      var html = G.sheetBody(store.state.me);
      includes(html, 'value="아크세이버 11"', '시트 라켓 칸');
      includes(html, 'value="BG80"', '시트 스트링 칸');
      includes(html, 'value="27"', '시트 장력 칸');
      includes(html, 'value="2026-11-20"', '시트 교체일 칸');
      includes(html, 'value="가을 대회용"', '시트 메모 칸');
      includes(html, 'data-gear-pick="tension" data-value="27" aria-pressed="true"', '장력 칩 선택 표시');
    });
  });

  test('v1.82 기록: 테마를 바꿔도 라켓 기록이 지워지지 않는다 (버그 원인)', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아크세이버 11', string: 'BG80', tension: 27, strungAt: '2026-11-20' });
      unlock(store);
      var r = store.actions.setTheme('th_def');
      eq(r.ok, true, '테마 변경 성공');
      eq(!!store.state.me.theme.gear, true, '꾸미기 JSON 에 gear 가 남아 있다');
      eq(G.gearOf(store.state.me).string, 'BG80', '스트링이 남아 있다');
      eq(G.gearOf(store.state.me).tension, 27, '장력이 남아 있다');
      /* 저장된 프로필 행에도 남아야 새로고침 뒤에도 보입니다 */
      return flush(store).then(function () {
        var rows = U.readJSON('bm_rows_v1', []) || [];
        var prof = rows.filter(function (x) { return x[D.COL['유형']] === '프로필'; });
        ok(prof.length > 0, '프로필 행이 있다');
        var theme = U.jsonParse(prof[prof.length - 1][D.COL['꾸미기']], null) || {};
        eq(theme.theme, 'th_def', '테마는 바뀌고');
        eq(theme.gear.racket, '아크세이버 11', '기록도 함께 저장');
        eq(theme.gear.strungAt, '2026-11-20', '교체일도 함께');
      });
    });
  });

  test('v1.82 기록: 하트 부스트를 켜고 꺼도 라켓 기록이 남는다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아크세이버 11', tension: 26 });
      unlock(store);
      store.actions.buyDeco('boost', 'heart');
      unlock(store);
      var on = store.actions.setHeartBoost(true);
      ok(on.ok, '부스트 켜기');
      eq(G.gearOf(store.state.me).racket, '아크세이버 11', '켜도 남는다');
      unlock(store);
      var off = store.actions.setHeartBoost(false);
      ok(off.ok, '부스트 끄기');
      eq(!!store.state.me.theme.boost, false, '부스트는 꺼짐');
      eq(G.gearOf(store.state.me).racket, '아크세이버 11', '껐어도 남는다');
    });
  });

  test('v1.82 기록: 새로고침(새 저장소) 뒤에도 그대로 — 초기화 버그 재발 없음', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아크세이버 11', string: 'BG80', tension: 27, strungAt: '2026-11-20' });
      unlock(store);
      store.actions.setTheme('th_sakura');
      return flush(store);
    }).then(function () {
      var api = BM.api.createLocal({ latency: 0 });
      var store2 = BM.store.createStore({ api: api });
      return store2.actions.init().then(function () {
        var g = G.gearOf(store2.state.me);
        eq(g.racket, '아크세이버 11', '새 저장소에서도 라켓');
        eq(g.string, 'BG80', '새 저장소에서도 스트링');
        eq(store2.state.me.theme.theme, 'th_sakura', '테마도 그대로');
        includes(G.sheetBody(store2.state.me), 'value="아크세이버 11"', '시트에도 그대로');
      });
    });
  });

  test('v1.82 기록: theme.gear 가 진실 — 화면용 me.gear 가 비어도 읽는다', function () {
    var me = { key: 'me', gear: null, theme: { gear: { racket: '아크세이버 11', tension: 26 } } };
    eq(G.gearOf(me).racket, '아크세이버 11', 'theme.gear 에서 읽는다');
    var stale = { key: 'me', gear: G.blank(), theme: { gear: { racket: '아크세이버 11', tension: 26 } } };
    eq(G.gearOf(stale).tension, 26, '빈 사본은 무시');
    var onlyMirror = { key: 'me', gear: { racket: '아크세이버 11', tension: 26 }, theme: {} };
    eq(G.gearOf(onlyMirror).racket, '아크세이버 11', '사본만 있어도 읽는다');
  });

  /* =========================================================
   * 4. 터치 불꽃 스매시 + 하트로 여는 스페셜 이펙트
   * ========================================================= */
  test('v1.84 스매시: 효과 칸에 하트로 여는 세 종(불꽃 2 · 얼음 3 · 번개 3)', function () {
    eq(RC.heartCostOf('effect', 'fire'), 2, '불꽃 스매시 하트 2');
    eq(RC.heartCostOf('effect', 'ice'), 3, '얼음 스매시 하트 3');
    eq(RC.heartCostOf('effect', 'thunder'), 3, '번개 셔틀 하트 3');
    eq(RC.heartCostOf('effect', 'blaze'), 3, 'bm-v1.86.0 — 나머지 효과도 하트로 산다');
    eq(RC.itemOf('effect', 'fire').name, '불꽃 스매시', '이름');
    eq(RC.itemOf('effect', 'ice').name, '얼음 스매시', '이름');
    eq(RC.itemOf('effect', 'thunder').name, '번개 셔틀', '이름');
    ok(RC.isHeartItem('effect', 'fire'), '하트 파츠 판정');
  });

  test('v1.82 스매시: 연출 이름·색·프레임이 하트 파츠를 따라간다', function () {
    eq(RC.smashLabel('fire'), '불꽃 스매시');
    eq(RC.smashLabel('thunder'), '번개 셔틀');
    eq(RC.smashLabel('none'), '스매시');
    eq(RC.smashPalette('fire').mid, '#ff8a2f', '불꽃 색');
    eq(RC.smashPalette('thunder').mid, '#7fd8ff', '번개 색');
    ok(RC.SMASH_MS >= 900 && RC.SMASH_MS <= 1600, '연출 길이 ' + RC.SMASH_MS);
    eq(typeof RC.drawSmash, 'function', '캔버스 연출 함수');
  });

  test('v1.82 스매시: 3D 화면에 스매시/꾸미기 모드와 스매시 테스트 버튼', function () {
    var html = RC.sheetBody(stateOf([]));
    includes(html, 'data-rk-stage', '조작 줄');
    includes(html, 'data-rk-mode="smash"', '스매시 모드');
    includes(html, 'data-rk-mode="paint"', '꾸미기 모드');
    includes(html, 'data-rk-smash="1"', '스매시 테스트 버튼');
    includes(html, '⚡ 스매시', '버튼 글자');
    includes(html, 'data-rk-slam="1"', '바닥 강타 버튼');
    var js = readRoot('js/racketcustom.js');
    includes(js, 'stageMode', '모드 기억');
    includes(js, "if (stageMode !== 'paint') { smash(); return; }", '짧은 탭은 스매시');
    includes(js, 'smash: smash', '3D 뷰에 스매시 연결');
    includes(js, 'drawSmash(g, vv, gm, smashFx', '스매시 연출 그리기');
  });

  test('v1.82 스매시: 하트로 열면 장착되고 포인트 계산과 섞이지 않는다', function () {
    var c = RC.normalizeCustom({ effect: 'fire', unlocked: ['effect:fire'] });
    eq(c.effect, 'fire', '열었으면 입는다');
    eq(RC.isUnlocked(c, 'effect', 'fire'), true, '열림');
    var locked = RC.normalizeCustom({ effect: 'fire' });
    eq(locked.effect, 'none', '안 열었으면 기본으로');
    var st = { me: { key: 'me', nick: '승우', gear: { custom: { effect: 'fire', unlocked: ['effect:fire'] } } },
      data: { idx: D.index([]), hearts: { balance: 4 } }, ui: {} };
    includes(RC.sheetBody(st), '지금까지 <b>2개</b> 사용', '하트로 센다');
    eq(RC.heartNow(st), 4, '잔액은 앱 하트 원장 그대로');
  });

  test('v1.82 스매시: 기기 저장 모드에서 하트가 실제로 차감되고 해금된다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      /* 하트를 모읍니다 — 출석 6일치(기본 3 + 6) */
      var rows = U.readJSON('bm_rows_v1', []) || [];
      for (var i = 1; i <= 6; i++) {
        rows.push(['hrt' + i, '출석하트', '2026-11-' + (10 + i) + ' 07:00:00', 'me', '승우', '', '', '', 1]);
      }
      /* D.COL 순서에 맞춰 다시 만듭니다(테스트용 최소 행) */
      var rows2 = rows.map(function (r) {
        var o = {};
        o[D.COL['id']] = r[0]; o[D.COL['유형']] = r[1]; o[D.COL['시각']] = r[2];
        o[D.COL['작성자']] = r[3]; o[D.COL['닉']] = r[4]; o[D.COL['좋아요']] = r[9];
        return o;
      });
      return freshStoreWith(rows2).then(function (s2) {
        var before = s2.state.data.hearts.balance;
        ok(before >= 2, '하트 잔액 ' + before);
        var res = s2.actions.buySmash('effect', 'fire');
        ok(res && res.ok, '구매 성공');
        eq(res.price, 2, '하트 2개');
        eq(res.purchased, true, '새로 열었다');
        eq(s2.state.data.hearts.balance, before - 2, '잔액이 2 줄었다');
        eq(RC.customOf(s2.state.me).effect, 'fire', '바로 장착');
        eq(RC.isUnlocked(RC.customOf(s2.state.me), 'effect', 'fire'), true, '해금 기록');
        /* 두 번째는 다시 차감하지 않는다 (연타 잠금만 풀고 다시) */
        s2.state.locks = {};
        s2.state.locks = {};
        var again = s2.actions.buySmash('effect', 'fire');
        /* 이미 연 것은 이제 잠금(reason:'unknown', 가격 0)이 아니라 '이미 보유'로 통과합니다 */
        ok(again && (again.ok || again.reason === 'unknown'), '다시 눌러도 하트를 빼지 않는다');
        eq(s2.state.data.hearts.balance, before - 2, '잔액 그대로');
      });
    });
  });

  test('v1.82 스매시: 하트가 모자라면 차감 없이 이유만', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      /* 기본 하트 3개 → 불꽃(2)을 열면 1개가 남아 번개(3)는 모자랍니다 */
      var first = store.actions.buySmash('effect', 'fire');
      ok(first && first.ok, '불꽃은 연다');
      var before = store.state.data.hearts.balance;
      ok(before < 3, '남은 하트 ' + before);
      store.state.locks = {};
      var res = store.actions.buySmash('effect', 'thunder');
      ok(!res.ok, '실패');
      eq(res.reason, 'hearts', '하트 부족');
      eq(res.price, 3, '필요한 하트');
      eq(store.state.data.hearts.balance, before, '잔액은 그대로');
      eq(RC.customOf(store.state.me).effect, 'fire', '장착도 그대로(불꽃)');
      eq(RC.isUnlocked(RC.customOf(store.state.me), 'effect', 'thunder'), false, '번개는 잠김');
    });
  });

  function freshStoreWith(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || []);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  test('v1.82 스매시: 서버 heart_spend(smash) 연동과 SQL 준비물', function () {
    var store = readRoot('js/store.js');
    includes(store, "rpc('heart_spend', { p_kind: 'racket'", '서버 RPC 호출');
    includes(store, "p_kind: 'smash'", '예전 smash 종류로도 한 번 더 시도');
    includes(store, "reason: 'unknown'", 'serverFail 등에서 같은 이유 코드를 씁니다');
    includes(readRoot('js/racketcustom.js'), "res.reason === 'unknown'", '아직 서버 준비 전이면 안내');
    var sql = readRoot('supabase/heart-rpc-v1.82-smash.sql');
    includes(sql, 'bm_smash_price', '가격표 함수');
    includes(sql, "when 'effect:fire'    then 2", '불꽃 2하트');
    includes(sql, "when 'effect:thunder' then 3", '번개 3하트');
    includes(sql, 'create or replace function public.heart_spend', '기존 함수 확장');
    includes(sql, "type = '꾸미기구매'", '해금 기록은 꾸미기구매 행 그대로');
    includes(sql, 'security definer', '서버만 차감');
    var js = readRoot('js/racketcustom.js');
    includes(js, '지금은 하트로 여는 준비 중이에요', '서버 준비 전 안내 문구');
  });

  /* =========================================================
   * 5. 기존 기능 보호
   * ========================================================= */
  test('v1.82 보호: 5개 탭 · 시트 26칸 · 하트 RPC · 3D 라켓 그대로', function () {
    includes(readRoot('index.html'), 'data-tab="log"', '5개 탭 그대로(첫 탭)');
    eq(D.COLS.length, 26, '시트 26칸');
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'heart_checkin', '출석 RPC');
    includes(sql, 'heart_ad_reward', '광고 RPC');
    includes(sql, 'heart_spend', '사용 RPC');
    eq((RC.BODY_IDS || []).length, 4, '3D 라켓 바디 4종');
    eq((RC.RARITY_IDS || []).length, 4, '등급 4단계');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
    eq(typeof RC.burst, 'function', '스매시 임팩트 연출');
    eq(typeof RC.stringAge, 'function', '줄 갈고 며칠째');
  });

  test('v1.82 보호: 지도 기존 기능(권역·즐겨찾기·반경 5km·모집) 그대로', function () {
    var html = GV.render({});
    includes(html, 'data-gymregion', '권역 칩');
    includes(html, 'data-gymfavs', '즐겨찾기');
    includes(html, 'data-gymmystat', '내 상태 카드');
    includes(html, 'data-gymnear', '반경 5km 동호인');
    includes(html, 'data-gymrecruit', '게스트 모집');
    includes(html, 'data-gympins', '오프라인 핀 지도');
    includes(html, 'data-gym-search', '검색창');
    includes(html, 'data-gym-geo', '내 위치 기준(가까운 순)');
  });

  test('v1.82 실명: 실존 선수·브랜드 이름이 새 코드에 없다', function () {
    var files = ['js/views/gyms.js', 'js/racketcustom.js', 'js/store.js', 'app.js', 'index.html'];
    files.forEach(function (f) {
      var code = readRoot(f);
      ['김원호', '안세영', '서승재', '아스트록스', '요넥스', '빅터', '리닝'].forEach(function (name) {
        excludes(code, name, f + ' 에 ' + name + ' 없음');
      });
    });
  });

  /* =========================================================
   * 6. 버전 정합
   * ========================================================= */
  test('v1.82 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.86.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.86.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.86.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261126-8', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.86.0', 'TWA 이름');
    eq(twa.appVersionCode, 80, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.86.0', 'README');
    includes(readRoot('test/run.js'), 'test/v182.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
