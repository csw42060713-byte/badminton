/* ============================================================
 * test/v197.test.js — bm-v1.100.0
 *
 *   승우 님 제보(2026-11-28): "터치오류 고쳐줘"
 *   추가 요청: "그리고 이미 한번 조합한건 바로 완성하기 버튼 있으면 편할거 같아"
 *
 *   1) 손가락 탭 판정 — 누적 8px → **시작점 14px** (살짝 흔들려도 톡 = 스매시·부위 선택)
 *   2) 두 번째 손가락·pointercancel 은 탭이 아니다 (핀치 → 스매시 오인 방지)
 *   3) 캔버스 위 세로 쓸기 = 시트 스크롤 (가로 = 회전)
 *   4) 크기가 바뀌어도(전체화면·가로 회전) 캔버스 비트맵·좌표계가 따라온다
 *   5) '⚡ 바로 완성하기' — 이미 맞춘 조합을 원톡으로 다시 입기
 *   6) 보호(기존 스매시·모션·세트 11종·전체화면) · 버전
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var RC = BM.racketcustom, R3 = BM.racket3d;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };
  function stateOf(custom) {
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: [],
      data: BM.store.derive([], BM.seed.ME), drafts: {}, ui: {}, hearts: { balance: 9 }
    };
    st.me.theme = { theme: 'th_night', avatar: '🦋', gear: { custom: custom || null } };
    return st;
  }
  function wear(pairs) {
    var c = RC.blankCustom();
    var unlocked = [];
    pairs.forEach(function (k) {
      var cut = k.indexOf(':');
      var slot = k.slice(0, cut), id = k.slice(cut + 1);
      c[slot] = id;
      var it = RC.itemOf(slot, id);
      if (it && !it.free) unlocked.push(k);
    });
    c.unlocked = unlocked;
    return RC.normalizeCustom(c);
  }

  /* ============================================================
   * 1. 탭 판정 — 손가락 기준
   * ============================================================ */

  test('v1.97 탭: 누적 8px 대신 시작점 14px — 살짝 흔들린 손가락도 탭이다', function () {
    var r3 = readRoot('js/racket3d.js'), rc = readRoot('js/racketcustom.js');
    [r3, rc].forEach(function (src) {
      includes(src, 'var TAP_SLOP = 14, TAP_PATH = 60;', '탭 허용 거리 14px');
      includes(src, 'drag.path = Math.sqrt(', '시작점에서의 거리로 잰다');
      includes(src, 'if (d.path > TAP_SLOP || d.moved > TAP_PATH) return;', '탭 판정 한 곳');
      excludes(src, 'drag.moved < 8', '예전 8px 규칙은 없다');
    });
  });

  test('v1.97 탭: 두 번째 손가락·취소는 탭이 아니다(핀치 → 스매시 오인 방지)', function () {
    var r3 = readRoot('js/racket3d.js'), rc = readRoot('js/racketcustom.js');
    [r3, rc].forEach(function (src) {
      includes(src, 'if (drag) { drag.multi = true; return; }', '두 번째 손가락은 새 드래그를 만들지 않음');
      includes(src, "if (how === 'cancel' || d.multi) return;", '취소·두 손가락은 탭 아님');
      includes(src, "cv.addEventListener('pointercancel', function (ev) { endDrag(ev, 'cancel'); });", 'pointercancel = 취소');
      includes(src, "cv.addEventListener('pointerleave', function (ev) { endDrag(ev, 'cancel'); });", 'pointerleave = 취소');
      includes(src, 'var px = d.sx - r.left, py = d.sy - r.top;', '처음 닿은 자리로 부위를 고른다');
    });
  });

  test('v1.97 스크롤: 캔버스 위 세로 쓸기는 시트 스크롤, 가로는 회전', function () {
    var r3 = readRoot('js/racket3d.js'), rc = readRoot('js/racketcustom.js');
    [r3, rc].forEach(function (src) {
      includes(src, 'function sheetScrollEl()', '스크롤 대상 찾기');
      includes(src, "drag.axis = Math.abs(my0) > Math.abs(mx0) * 1.4 ? 'scroll' : 'rot'", '세로/가로 판정');
      includes(src, "if (drag.axis === 'scroll') {", '세로는 스크롤로');
      includes(src, 'if (sc) sc.scrollTop -= dy;', '시트 본문을 직접 스크롤');
    });
    includes(readRoot('styles.css'), 'touch-action: none; cursor: grab;', '캔버스는 손짓을 가져간다(스크롤은 코드가)');
  });

  test('v1.97 크기: 전체화면·가로 회전으로 캔버스가 커져도 비트맵·좌표계를 다시 맞춘다', function () {
    var rc = readRoot('js/racketcustom.js');
    includes(rc, 'var w = 0, h = 0, fitCssW = 0, fitCssH = 0;', '마지막으로 맞춘 CSS 크기 기억');
    includes(rc, 'fitCssW = cv.clientWidth || Math.round(rect.width);', 'fit 때 CSS 크기 기록');
    includes(rc, 'if (cw && chh && (Math.abs(cw - fitCssW) > 1 || Math.abs(chh - fitCssH) > 1)) { fit(); paint(); }', '바뀌면 다시 fit');
    /* 3D 엔진 쪽은 프레임마다 clientWidth/Height 를 비교해 fitCamera */
    includes(readRoot('js/racket3d.js'), 'if (cv.clientWidth !== lastW || cv.clientHeight !== lastH) {', '3D 는 프레임마다 크기 확인');
  });

  /* ============================================================
   * 2. ⚡ 바로 완성하기 — 계획(순수 함수)
   * ============================================================ */

  test('v1.97 완성하기: 보유 파츠만 채우고, 맞춰진 칸은 그대로 둔다', function () {
    /* 썬더 골드 = 프레임/거트/그립 골드. 그립만 이미 골드이고 프레임·거트는 못 연 상태 */
    var c = RC.normalizeCustom({ body: 'power77', frame: 'matte', string: 'lime', grip: 'gold', effect: 'none',
      unlocked: ['grip:gold', 'frame:gold', 'string:gold'] });
    var plan = RC.setApplyPlan(c, RC.setById('thunderGold'), false);
    eq(plan.set.id, 'thunderGold', '대상 세트');
    eq(plan.missing.length, 0, '이미 다 갖고 있다');
    eq(plan.steps.length, 3, '세 칸 모두 계획');
    eq(plan.steps.filter(function (s) { return s.now; }).length, 1, '그립은 그대로');
    eq(plan.steps.filter(function (s) { return s.slot === 'frame'; })[0].id, 'gold', '프레임 골드');
    eq(plan.changed, 2, '새로 바꾸는 칸 2개');
  });

  test('v1.97 완성하기: 못 연 파츠가 있으면 보유한 것만 + 남은 것을 알려 준다', function () {
    var c = RC.normalizeCustom({ body: 'power77', frame: 'matte', string: 'lime', grip: 'black', effect: 'none', unlocked: ['frame:red'] });
    var plan = RC.setApplyPlan(c, RC.setById('blazeRed'), false);
    eq(plan.missing.length, 2, '거트·그립은 아직 못 삼');
    eq(plan.steps.length, 1, '프레임만 채운다');
    eq(plan.steps[0].slot, 'frame', '프레임 red');
    eq(plan.complete, false, '완성은 아님');
    eq(plan.missing.map(function (m) { return m.slot; }).join(','), 'string,grip', '남은 칸');
  });

  test('v1.97 완성하기: 관리자(전체 해금)는 한 번에 다 장착한다', function () {
    var c = RC.normalizeCustom({ body: 'power77', frame: 'matte', string: 'lime', grip: 'black', effect: 'none', unlocked: [] });
    var plan = RC.setApplyPlan(c, RC.setById('phoenix'), true);
    eq(plan.missing.length, 0, '남는 칸 없음');
    eq(plan.steps.length, 4, '불사조 4칸');
    /* 한 칸에 여러 파츠를 허용하는 조건은 첫 번째를 씁니다 */
    eq(plan.steps.filter(function (s) { return s.slot === 'effect'; })[0].id, 'fire', '불꽃 효과');
  });

  test('v1.97 완성하기: 여러 파츠를 허용하는 칸은 이미 맞은 것을 그대로 인정한다', function () {
    var c = RC.normalizeCustom({ body: 'power77', frame: 'ice', string: 'white', grip: 'white', effect: 'ice', unlocked: ['frame:ice', 'string:white', 'grip:white', 'effect:ice'] });
    var plan = RC.setApplyPlan(c, RC.setById('blizzard'), true);
    eq(plan.steps.filter(function (s) { return s.now; }).length, 4, '네 칸 모두 이미 맞음');
    eq(plan.changed, 0, '바꿀 칸 없음');
  });

  test('v1.97 완성하기: "이미 한 번 맞춘 조합"만 버튼이 뜬다', function () {
    /* 공개 세트 — 조건 파츠를 다 갖고 있으면 대상 */
    var own = RC.normalizeCustom({ body: 'power77', frame: 'gold', string: 'gold', grip: 'black', effect: 'none', unlocked: ['frame:gold', 'string:gold', 'grip:gold'] });
    ok(RC.setMine(own, RC.setById('thunderGold'), false), '골드 프레임·거트를 갖고 있다 → 썬더 골드 가능');
    ok(!RC.setMine(own, RC.setById('blazeRed'), false), '레드 파츠가 없으면 비공개 아님 → 불가');
    /* 히든 — 발견 목록(found)에 있어야 */
    var hidden = RC.normalizeCustom({ body: 'power77', frame: 'red', string: 'crimson', grip: 'crimson', effect: 'fire', unlocked: ['frame:red', 'string:crimson', 'grip:crimson', 'effect:fire'], found: [] });
    ok(!RC.setMine(hidden, RC.setById('phoenix'), false), '발견 전 히든은 버튼 없음');
    hidden.found = ['phoenix'];
    ok(RC.setMine(hidden, RC.setById('phoenix'), false), '발견한 히든은 버튼');
  });

  /* ============================================================
   * 3. ⚡ 바로 완성하기 — 화면(도감) 표시
   * ============================================================ */

  test('v1.97 완성하기: 도감 줄에 버튼이 서고, 발동 중이면 "이미 적용 중"', function () {
    var c = wear(['frame:red', 'string:crimson', 'grip:crimson', 'effect:fire']);
    c.found = ['phoenix'];
    c.frame = 'white'; c.string = 'white'; c.grip = 'white';   /* 불사조에서 벗어남 */
    var html = RC.setBonusHtml(stateOf(c));
    includes(html, 'data-rk-apply-set="phoenix"', '발견한(한 번 맞춘) 불사조에 바로 완성하기');
    includes(html, '바로 완성하기', '버튼 글자');
    includes(html, 'aria-label="', '스크린리더 이름');

    /* 골드 세트를 입고 있으면 그 줄은 '이미 적용 중' */
    var on = wear(['frame:gold', 'string:gold', 'grip:gold']);
    var html2 = RC.setBonusHtml(stateOf(on));
    includes(html2, '<em class="rkset__on">이미 적용 중</em>', '지금 발동 중인 조합');
    excludes(html2, 'data-rk-apply-set="thunderGold"', '발동 중인 조합에는 버튼 없음');
  });

  test('v1.97 완성하기: 터치 목표 32px 이상 · 도감 안에서 줄 전체 폭', function () {
    var css = readRoot('styles.css');
    includes(css, '.rkset__apply {', '버튼 스타일');
    includes(css, 'min-height: 32px;', '엄지로 누를 수 있는 높이');
    includes(css, 'touch-action: manipulation;', '두 번 탭 확대 방지');
    includes(css, '.rkset__apply:active { transform: scale(0.985);', '눌린 느낌');
    includes(css, '.rkset__on {', '이미 적용 중 표시');
  });

  test('v1.97 완성하기: 누르면 저장 → 3D 즉시 전환(refreshSheet)', function () {
    var rc = readRoot('js/racketcustom.js');
    includes(rc, "var applyBtn = ev.target.closest('[data-rk-apply-set]');", '시트 클릭 위임');
    includes(rc, 'applySet(host, ctx, applyBtn.getAttribute(\'data-rk-apply-set\'));', '조합 id 로 적용');
    includes(rc, 'if (host && ctx) refreshSheet(host, ctx);', '시트·3D 를 다시 그린다');
    /* 실제로 저장되는지 — 가짜 ctx 로 한 번 돌려 봅니다 */
    var saved = null;
    var state = stateOf(RC.normalizeCustom({
      body: 'power77', frame: 'white', string: 'white', grip: 'white', effect: 'none',
      unlocked: ['frame:red', 'string:crimson', 'grip:crimson', 'effect:fire'], found: ['phoenix']
    }));
    state.actions = {
      setGear: function (patch) { saved = patch.custom; state.me.theme.gear.custom = patch.custom; return { ok: true }; }
    };
    var ctx = { store: { state: state }, actions: state.actions };
    var done = RC.applySet(null, ctx, 'phoenix');
    eq(done, true, '적용 성공');
    ok(saved, '저장 호출');
    var after = RC.customOf(state.me);
    eq(after.frame + '/' + after.string + '/' + after.grip + '/' + after.effect, 'red/crimson/crimson/fire', '불사조 파츠로 교체');
    ok((after.found || []).indexOf('phoenix') >= 0, '발견 기록 유지');
    eq(RC.activeSet(after).set.id, 'phoenix', '그 자리에서 세트 발동');
  });

  test('v1.97 완성하기: 이미 그 조합이면 저장하지 않고 안내만', function () {
    var calls = 0;
    var state = stateOf(wear(['frame:gold', 'string:gold', 'grip:gold']));
    state.actions = { setGear: function () { calls++; return { ok: true }; } };
    var ctx = { store: { state: state }, actions: state.actions };
    eq(RC.applySet(null, ctx, 'thunderGold'), false, '이미 적용 중이면 false');
    eq(calls, 0, '저장하지 않는다');
  });

  test('v1.97 완성하기: 하트를 쓰지 않는다(이미 연 파츠로만 입는다)', function () {
    var rc = readRoot('js/racketcustom.js');
    var body = rc.slice(rc.indexOf('function applySet('), rc.indexOf('function applySet(') + 2000);
    excludes(body, 'buyPart(', '구매 경로를 부르지 않음');
    excludes(body, 'heart_spend', '하트 차감 없음');
    includes(body, 'saveCustom(ctx, next,', '저장만');
  });

  /* ============================================================
   * 4. 보호 · 버전
   * ============================================================ */

  test('v1.97 보호: 스매시·모션·세트 11종·전체화면·3D API 는 그대로', function () {
    eq(RC.SETS.length, 11, '조합 11종');
    eq(RC.HIDDEN_SETS.length, 7, '히든 7종');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종');
    ['smash', 'slam', 'motion', 'hold', 'resume', 'view', 'fit', 'paint'].forEach(function (k) {
      includes(readRoot('js/racketcustom.js'), k + ':', '기존 ' + k + ' API 유지');
    });
    var html = RC.sheetBody(stateOf(wear(['frame:red', 'string:crimson', 'grip:crimson', 'effect:fire'])));
    includes(html, 'data-rk-full="1"', '전체화면 버튼');
    includes(html, 'data-rk-slam="1"', '바닥 강타');
    includes(html, 'data-rk-share="1"', '공유 카드');
    includes(html, 'rkset', '조합 배지');
    includes(readRoot('js/racket3d.js'), "engine: 'three'", '3D 엔진 표시');
  });

  test('v1.97 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.100.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.100.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.100.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.100.0', 'TWA 이름');
    eq(twa.appVersion, '1.100.0', 'TWA appVersion');
    eq(twa.appVersionCode, 94, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.100.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v197.test.js', '테스트 목록');
    includes(readRoot('sw.js'), 'bm-v1.100.0', 'sw 캐시 설명');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
