/* ============================================================
 * test/v198.test.js — bm-v1.100.0
 *
 *   승우 님 승인(2026-11-28): "그립에 글자 쓸 수 있게 하는 거 어때?" → "ㄱㄱ", "하고싶은 사람만 하게"
 *   제보: "이거 그립이랑 선택하면 아래로 내려가서 불편해 너가 한번써보고 제일 편하게 해줘"
 *
 *   1) 각인 값 — 기본 빈 글자 · 최대 6자 · 제어문자/꺾쇠 제거 · 한글·영문·숫자
 *   2) 저장 — 새 칸 없이 theme.gear.custom.initial · normalizeCustom 왕복 · hasCustom
 *   3) 대비 — 어두운 그립=밝은 금색, 밝은 그립=짙은 잉크 (lumOf·inkOf)
 *   4) 화면 — 그립 탭 입력줄(적용·지우기) · 미니 라켓 SVG · 2D 폴백 캔버스
 *   5) 3D — 각인 레이어 배치(gripInkPlan) · 빈 글자면 레이어 없음 · looksAlg 에 글자 포함
 *   6) 동선 — 파츠 카드 선택은 시트를 다시 그리지 않는다(syncChosen) · 스크롤 보존 · 붙박이 미리보기
 *   7) 보호 — 기존 3D·세트·전체화면 그대로 · 버전
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var RC = BM.racketcustom, R3 = BM.racket3d;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };
  function stateWith(custom, gearPatch) {
    var me = JSON.parse(JSON.stringify(ME));
    me.theme.gear = Object.assign({ custom: custom }, gearPatch || {});
    return {
      ready: true, mode: 'local', me: me, rows: [],
      data: BM.store.derive([], BM.seed.ME), drafts: {}, ui: {}, hearts: { balance: 9 }
    };
  }

  /* ============================================================
   * 1. 각인 값 — 선택 옵션 · 기본 비움
   * ============================================================ */

  test('v1.98 각인: 기본은 빈 글자 — 넣지 않으면 아무 글자도 그리지 않는다', function () {
    eq(RC.blankCustom().initial, '', '새 커스텀의 기본값');
    eq(RC.normalizeCustom(null).initial, '', '기록이 없어도 빈 글자');
    eq(RC.normalizeCustom({}).initial, '', '예전 저장값(칸 없음)도 빈 글자');
    eq(RC.normalizeCustom({ initial: '   ' }).initial, '', '공백만 있으면 비움');
    eq(RC.normalizeInitial(undefined), '', 'undefined 안전');
    eq(RC.INK_MAX, 6, '최대 6자');
  });

  test('v1.98 각인: 최대 6자 · 영문·숫자·한글 · 제어문자와 HTML 꺾쇠 제거', function () {
    eq(RC.normalizeInitial('SW'), 'SW', '영문');
    eq(RC.normalizeInitial('ACE1'), 'ACE1', '영문+숫자');
    eq(RC.normalizeInitial('승우'), '승우', '한글');
    eq(RC.normalizeInitial('  승우  '), '승우', '앞뒤 공백 정리');
    eq(RC.normalizeInitial('AB CD'), 'AB CD', '가운데 공백은 유지');
    eq(RC.normalizeInitial('ABCDEFGH'), 'ABCDEF', '6자에서 자름');
    eq(RC.normalizeInitial('승우배드민턴고'), '승우배드민턴', '한글도 6자');
    eq(RC.normalizeInitial('<b>SW</b>'), 'bSW/b', '꺾쇠는 글자로 남기지 않음');
    eq(RC.normalizeInitial('S"W\'&<>'), 'SW', '따옴표·& 제거');
    eq(RC.normalizeInitial('A\u0000B\nC'), 'A B C', '제어문자 → 공백');
    eq(RC.normalizeInitial('S\tW'), 'S W', '탭 → 공백');
    var emoji = RC.normalizeInitial('😀😀😀😀😀😀😀');
    ok(emoji.length <= 6, '6자 상한 ' + JSON.stringify(emoji));
    ok(!/[\ud800-\udbff]$/.test(emoji), '이모지 반쪽이 잘리지 않음 ' + JSON.stringify(emoji));
    /* 위험한 문자는 화면에도 남지 않는다 */
    var html = RC.inkHtml(RC.normalizeCustom({ initial: '<img src=x onerror=alert(1)>' }));
    excludes(html, '<img', '입력한 태그가 그대로 들어가지 않음');
    includes(html, 'maxlength="6"', '입력칸 자체도 6자 제한');
  });

  /* ============================================================
   * 2. 저장 — 새 칸 없이 theme.gear.custom.initial
   * ============================================================ */

  test('v1.98 저장: 각인은 custom.initial 한 값에만 남고 왕복해도 그대로', function () {
    var c = RC.normalizeCustom({ initial: 'SW', grip: 'black' });
    eq(c.initial, 'SW', '정리 후에도 남는다');
    eq(RC.normalizeCustom(c).initial, 'SW', '다시 정리해도 그대로');
    eq(RC.normalizeCustom(JSON.stringify(c)).initial, 'SW', 'JSON 문자열(서버 왕복)도 그대로');
    ok(RC.hasCustom({ initial: 'SW' }), '색은 기본이어도 각인만 있으면 저장 대상');
    ok(!RC.hasCustom({}), '아무것도 없으면 저장 대상 아님');
    eq(RC.customOf({ theme: { gear: { custom: { initial: 'ACE' } } } }).initial, 'ACE', '내 프로필에서 읽기');
    /* 새 시트 칸·새 DB 컬럼 없음 — theme.gear.custom 한 칸 */
    var store = readRoot('js/store.js');
    includes(store, 'custom: (BM.racketcustom && BM.racketcustom.mergeFound)', '저장 경로 그대로');
  });

  test('v1.98 저장: 스토어 저장→불러오기에서 각인이 살아 있다(로컬 모드)', function () {
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
    return store.actions.init().then(function () {
      return store.actions.setGear({ custom: RC.normalizeCustom({ initial: '승우' }) });
    }).then(function (res) {
      ok(res && res.ok, '저장 성공 ' + JSON.stringify(res && res.reason));
      var me = store.state.me;
      eq(RC.customOf(me).initial, '승우', '메모리 상태');
      var saved = ((me.theme || {}).gear || {}).custom || {};
      eq(saved.initial, '승우', 'theme.gear.custom.initial 한 칸');
      /* 파츠를 하나 바꿔 저장해도 각인은 따라온다 */
      var next = RC.normalizeCustom(saved);
      next.string = 'white';
      store.actions.setGear({ custom: next });
      eq(RC.customOf(store.state.me).initial, '승우', '다른 파츠 저장 뒤에도 유지');
    });
  });

  /* ============================================================
   * 3. 대비 — 그립 색에 맞춰 글자색 자동
   * ============================================================ */

  test('v1.98 대비: 어두운 그립은 밝은 금색, 밝은 그립은 짙은 잉크', function () {
    ok(RC.lumOf('#1d2124') < 0.1, '블랙 그립은 어둡다');
    ok(RC.lumOf('#eef2f4') > 0.8, '화이트 그립은 밝다');
    eq(RC.inkOf('#1d2124'), '#f8dc96', '어두운 그립 → 밝은 금색');
    eq(RC.inkOf('#eef2f4'), '#1b1f26', '밝은 그립 → 짙은 잉크');
    eq(RC.inkOf('#d9c6a5'), '#1b1f26', '타월 베이지 → 짙은 잉크');
    eq(RC.inkOf('#8f7bf2'), '#f8dc96', '퍼플 → 밝은 금색');
    eq(RC.inkOf(''), '#f8dc96', '색을 모르면 밝은 쪽(안전)');
    /* 두 쪽 모두 대비 3:1 이상 — 실제로 읽히는지 숫자로 확인 */
    function ratio(a, b) {
      var la = RC.lumOf(a), lb = RC.lumOf(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
      return (hi + 0.05) / (lo + 0.05);
    }
    /* 3D 그립은 재질 색을 0.48 로 낮춰 그려져 실제로는 더 어둡습니다 — 그 밝기로 대비를 봅니다 */
    ['#1d2124', '#eef2f4', '#d9c6a5', '#8f7bf2', '#e8b93f', '#a9e8ff'].forEach(function (g) {
      var ink = RC.inkOf(g);
      var gl = RC.lumOf(g) * 0.45, il = RC.lumOf(ink);
      var r = (Math.max(gl, il) + 0.05) / (Math.min(gl, il) + 0.05);
      ok(r >= 3, '대비 ' + g + ' → ' + ink + ' = ' + r.toFixed(1));
    });
  });

  /* ============================================================
   * 4. 화면 — 그립 탭 입력줄 · 미니 라켓 · 2D 폴백
   * ============================================================ */

  test('v1.98 화면: 그립 탭에만 입력줄 · 적용/지우기 · 안내 문구', function () {
    var st = stateWith(null);
    var html = RC.sheetBody(st);
    var gripGroup = html.slice(html.indexOf('data-rk-group="grip"'));
    includes(gripGroup, 'data-rk-ink-input', '그립 탭 안 입력칸');
    includes(gripGroup, 'data-rk-ink-apply', '적용 버튼');
    includes(gripGroup, 'data-rk-ink-clear', '지우기 버튼');
    includes(gripGroup, '이니셜 각인', '이름');
    includes(gripGroup, '비워 두면 각인 없이', '선택 옵션 안내');
    /* 다른 탭에는 없다 */
    var frameGroup = html.slice(html.indexOf('data-rk-group="frame"'), html.indexOf('data-rk-group="string"'));
    excludes(frameGroup, 'data-rk-ink-input', '프레임 탭에는 입력칸 없음');

    var filled = RC.sheetBody(stateWith({ initial: 'SW' }));
    includes(filled, 'value="SW"', '저장값이 칸에 채워진다');
    eq((filled.match(/2\/6/g) || []).length >= 1, true, '글자 수 2/6');
  });

  test('v1.98 화면: 미니 라켓에 각인 글자 — 빈 값이면 글자가 없다', function () {
    var withInk = RC.svg({ initial: 'SW' }, {});
    includes(withInk, 'rkink-t', '각인 텍스트');
    includes(withInk, '>SW<', '글자 그대로');
    includes(withInk, RC.inkOf('#1d2124'), '그립 색에 맞춘 대비');
    var empty = RC.svg({}, {});
    excludes(empty, 'rkink-t', '빈 값이면 각인 없음');
    /* 꺾쇠가 든 입력도 글자로만 나간다 */
    var evil = RC.svg({ initial: '<b>X' }, {});
    excludes(evil, '<b>', '태그가 그대로 들어가지 않음');
    includes(evil, '>bX</text>', '위험 문자만 지우고 글자는 남긴다');
    excludes(evil, '>b<X', '꺾쇠가 글자로 되살아나지 않음');
    /* 그림판(공유 카드)에도 같은 글자 */
    includes(readRoot('js/racketcustom.js'), 'g.fillText(c.initial', '캔버스 fillText 만 사용');
    /* 헤더 미니 라켓도 글자가 바뀌면 다시 그린다 */
    includes(readRoot('js/racketcustom.js'), 'c.effect, c.initial].join', '헤더 서명에 각인 포함');
  });

  test('v1.98 화면: 2D 폴백(WebGL 없는 기기)에서도 그립에 글자가 그려진다', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'function drawInk2d', '2D 폴백 각인');
    includes(js, 'drawInk2d(g, gm, v, c, grip)', '나무(2D) 렌더러에서 호출');
    var calls = [];
    var g = {
      save: function () {}, restore: function () {}, translate: function () {}, rotate: function () {},
      fillText: function (t) { calls.push(t); }, fillRect: function () {}, beginPath: function () {},
      arc: function () {}, fill: function () {}, stroke: function () {}, moveTo: function () {},
      lineTo: function () {}, closePath: function () {}, clearRect: function () {},
      createRadialGradient: function () { return { addColorStop: function () {} }; },
      createLinearGradient: function () { return { addColorStop: function () {} }; }
    };
    var st = stateWith({ initial: 'SW' });
    var c = RC.customOf(st.me);
    var gm = RC.geomOf(c);
    RC.draw3d(g, { yaw: 0, pitch: 0, k: 1, cx: 0, cy: 0, mid: gm.mid }, c, 'ok', 360, 420, {});
    ok(calls.indexOf('SW') >= 0, '2D 폴백이 글자를 그린다 ' + JSON.stringify(calls.slice(0, 4)));
    calls = [];
    RC.draw3d(g, { yaw: 2.2, pitch: 0, k: 1, cx: 0, cy: 0, mid: gm.mid }, c, 'ok', 360, 420, {});
    eq(calls.indexOf('SW'), -1, '뒤로 돌아가면 보이지 않는다');
  });

  /* ============================================================
   * 5. 3D — 각인 레이어
   * ============================================================ */

  test('v1.98 3D: 각인 레이어는 오버그립 바깥에 얇게 · 빈 글자면 만들지 않는다', function () {
    var st = stateWith({ initial: 'SW', grip: 'black' });
    var look = R3.lookOf({ store: { state: st } });
    eq(look.grip.initial, 'SW', '3D 가 글자를 읽는다');
    var plan = R3.gripInkPlan(look);
    ok(plan, '배치 계산');
    eq(plan.text, 'SW', '글자');
    eq(plan.color, '#f8dc96', '대비 색');
    ok(plan.radius > look.gm.gripR * 0.97, '그립 바깥 반지름 ' + plan.radius.toFixed(2));
    ok(plan.height >= 18 && plan.height <= 30, '띠 높이 ' + plan.height.toFixed(1));
    ok(plan.thetaLength > 1 && plan.thetaLength < 2.4, '감기는 각도 ' + plan.thetaLength.toFixed(2));
    ok(plan.y > 0 && plan.y < look.gm.gripLen, '그립 위쪽 안쪽');

    var plain = R3.lookOf({ store: { state: stateWith({}) } });
    eq(R3.gripInkPlan(plain), null, '빈 글자면 레이어 없음(null)');
    var js = readRoot('js/racket3d.js');
    includes(js, 'var inkMesh = buildGripInk(T, look);', '빌드에서 각인 레이어 추가');
    includes(js, 'if (inkMesh) {', '글자가 있을 때만');
    includes(js, "map: tex, transparent: true, depthWrite: false", '투명 텍스처 레이어');
    includes(js, 'toneMapped: false', '조명과 무관하게 또렷하게');
  });

  test('v1.98 3D: 글자를 넣고 빼면 looksAlg 서명이 바뀌어 즉시 다시 그린다', function () {
    var a = R3.lookOf({ store: { state: stateWith({ initial: 'SW' }) } });
    var b = R3.lookOf({ store: { state: stateWith({ initial: 'ACE' }) } });
    var c = R3.lookOf({ store: { state: stateWith({}) } });
    ok(a.sig !== b.sig, '다른 글자 → 다른 서명');
    ok(a.sig !== c.sig, '글자 있음 ↔ 없음 → 다른 서명');
    includes(a.sig, 'SW', '서명에 글자 포함');
    includes(readRoot('js/racket3d.js'), 'c.effect, c.initial, level', 'looksAlg 에 글자 포함');
    includes(readRoot('js/racket3d.js'), 'if (look.sig !== looksig) rebuild();', '서명이 바뀌면 다시 만든다');
  });

  /* ============================================================
   * 6. 동선 — 파츠를 고르는 동안 라켓이 보인다 · 스크롤이 튀지 않는다
   * ============================================================ */

  test('v1.98 동선: 선택창이 3D 바로 아래 (조합 도감은 아래로)', function () {
    var html = RC.sheetBody(stateWith(null));
    var i3d = html.indexOf('rk3d__cv');
    var iPick = html.indexOf('data-rk-pick');
    var iSet = html.indexOf('class="rkset');
    var iAge = html.indexOf('rkage');
    ok(i3d >= 0 && iPick > i3d, '3D 다음에 선택창');
    ok(iSet > iPick, '조합 도감은 선택창 아래로');
    ok(iAge > iSet, '줄 상태는 그 아래 그대로');
    excludes(html.slice(i3d, iPick), 'class="rkset', '3D 와 선택창 사이에 도감 카드 없음');
  });

  test('v1.98 동선: 색을 고르면 시트를 다시 그리지 않는다(3D 재마운트·스크롤 튐 없음)', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'function syncChosen(host, ctx)', '가벼운 갱신');
    includes(js, "card.classList.toggle('is-on', on)", '고른 카드 표시만 바꿈');
    includes(js, 'if (saveCustom(ctx, next2)) syncChosen(host, ctx);', '파츠 선택 경로가 syncChosen 사용');
    excludes(js, 'if (saveCustom(ctx, next2)) refreshSheet(host, ctx);', '예전 전체 다시 그리기는 사라짐');
    includes(js, 'body.scrollTop = keepTop;', '다시 그려도 스크롤 위치 유지');
    includes(js, 'body.scrollTop = Math.max(0, keepTop + dy);', '탭 줄이 화면에서 같은 자리');
  });

  test('v1.98 동선: 파츠를 고르는 동안 3D 가 위에 붙박이로 남는다(높이 고정 → 튐 없음)', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'function syncMini(host)', '붙박이 토글');
    includes(js, "if (!card.style.height) card.style.height = card.offsetHeight + 'px';", '흐름 높이를 굳혀 아래 내용이 안 튐');
    includes(js, "bodyEl.addEventListener('scroll', function () { syncMini(host); }, { passive: true });", '스크롤할 때마다 판단');
    includes(js, 'syncMini(host);\n    firePendingBurst();', '다시 그린 뒤에도 상태 유지');
    includes(js, "el.classList.remove('is-mini');", '전체화면에서는 붙박이 해제');

    var css = readRoot('styles.css');
    includes(css, '.rk3d.is-mini', '붙박이 카드 스타일');
    includes(css, 'position: sticky', '붙박이');
    includes(css, 'clip-path: inset(0 0 calc(100% - 176px) 0 round 20px)', '보이는 부분만 카드로');
    includes(css, '.rk3d.is-mini .rk3d__cv { height: 176px;', '작은 미리보기');
    includes(css, 'pointer-events: none;', '빈 자리는 터치를 막지 않음');
    includes(css, '.rk3d.is-full {', '전체화면 예외');
    /* 폰에서 3D 아래 탭 줄이 첫 화면에 들어오는 높이 */
    includes(css, '.rk3d__cv { height: 240px;', '폰 3D 높이 240px');
    includes(css, '@media (min-width: 520px)', '큰 화면에서는 다시 크게');
  });

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.98 보호: 스매시·모션·전체화면·세트 11종·공유 카드는 그대로', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'data-rk-full="1"', '전체화면 버튼');
    includes(js, 'data-rk-smash="1"', '스매시 버튼');
    includes(js, 'data-rk-motion=', '모션 칩');
    includes(js, 'function setFull(on, host)', '전체화면 토글');
    eq(RC.SETS.length, 11, '세트 11종');
    eq(RC.SLOTS.length, 6, '파츠 6칸');
    includes(readRoot('js/racket3d.js'), 'function gripSpiral', '오버그립 나선 그대로');
    includes(readRoot('js/racket3d.js'), 'function buildRacket', '라켓 모델 그대로');
    /* 공유 카드 그림에도 각인 (drawRacket 사용처 그대로) */
    includes(readRoot('js/sharecard.js'), 'BM.racketcustom.drawRacket', '공유 카드');
  });

  test('v1.98 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var push = readRoot('js/push.js');
    includes(sw, "var VERSION = 'bm-v1.100.0'", 'sw.js');
    includes(app, "version: 'v1.100.0'", 'app.js');
    includes(push, "version: 'v1.100.0'", 'push.js');
    includes(index, 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.100.0', 'TWA 이름');
    eq(twa.appVersion, '1.100.0', 'TWA appVersion');
    eq(twa.appVersionCode, 94, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.100.0', 'README');
    includes(readRoot('test/run.js'), 'test/v198.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
