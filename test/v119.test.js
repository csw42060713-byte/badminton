/* ============================================================
 * test/v119.test.js — v1.20.0 (2026-11-20)
 *  1) 시트 연결 시트의 '웹 앱 URL'이 기본 브리지(/exec) 주소로 미리 채워진다
 *  2) 저장해 둔 브리지 주소가 있으면 그 주소를 채운다
 *  3) 로그인한 세션이면 이메일·닉네임도 미리 채운다 (사용자가 고칠 수 있는 칸 그대로)
 *  4) 체험(게스트) 세션이면 이메일·닉네임은 비워 둔다
 *  5) 빈 칸 검사·연타 잠금은 그대로 남는다
 *  6) 버전: sw · app · 스타일 캐시 · TWA가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util, A = BM.auth;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* ---------- 스토리지 되돌리기 (다른 테스트의 세션·설정을 건드리지 않게) ---------- */
  var TOUCHED = [A.SESSION_KEY, A.BRIDGE_KEY, BM.api.SESSION_KEY];
  function snapshot() {
    return TOUCHED.map(function (k) { return [k, U.storage.getItem(k)]; });
  }
  function restore(snap) {
    snap.forEach(function (p) {
      if (p[1] == null) U.storage.removeItem(p[0]);
      else U.storage.setItem(p[0], p[1]);
    });
  }
  function withStorage(fn) {
    var snap = snapshot();
    try { return fn(); } finally { restore(snap); }
  }

  /* 시트를 실제로 그리지 않고 본문 HTML만 받아 옵니다 */
  function sheetBody() {
    var prev = BM.ui.openSheet, captured = null;
    BM.ui.openSheet = function (opts) { captured = opts; return null; };
    try { BM.views.my.openConnectSheet({}); } finally { BM.ui.openSheet = prev; }
    ok(captured && captured.body, '연결 시트를 그린다');
    eq(captured.title, '구글 시트 연결', '시트 제목');
    return String(captured.body);
  }
  /* data-c="필드" 입력칸의 value 속성 값 */
  function valueOf(body, field) {
    var m = body.match(new RegExp('data-c="' + field + '"[^>]*value="([^"]*)"'));
    return m ? m[1] : null;
  }

  test('v1.19 시트 연결: 웹 앱 URL이 기본 배포 주소(/exec)로 채워진다', function () {
    if (!hasNode()) return;
    withStorage(function () {
      A.signOut();
      U.storage.removeItem(A.BRIDGE_KEY);
      U.storage.removeItem(BM.api.SESSION_KEY);
      var def = BM.views.my.connectDefaults();
      eq(def.url, A.DEFAULT_BRIDGE_URL, '저장된 주소가 없으면 기본 브리지');
      includes(A.DEFAULT_BRIDGE_URL, '/exec', '기본 브리지는 /exec 주소');
      var body = sheetBody();
      eq(valueOf(body, 'url'), A.DEFAULT_BRIDGE_URL, 'URL 칸에 기본 주소가 들어 있다');
    });
  });

  test('v1.19 시트 연결: 저장해 둔 브리지 주소가 있으면 그 주소를 채운다', function () {
    if (!hasNode()) return;
    withStorage(function () {
      var mine = 'https://script.google.com/macros/s/UNIT-TEST-BRIDGE/exec';
      A.saveBridgeUrl(mine);
      eq(BM.views.my.connectDefaults().url, mine, '저장한 주소 우선');
      eq(valueOf(sheetBody(), 'url'), mine, 'URL 칸에도 저장한 주소');
      /* 이미 연결된 세션(sess.url)이 있으면 그쪽 주소를 씁니다 */
      U.writeJSON(BM.api.SESSION_KEY, { url: mine, token: 't' });
      eq(BM.views.my.connectDefaults().url, mine, '연결 세션 주소');
    });
  });

  test('v1.19 시트 연결: 로그인한 세션이면 이메일·닉네임도 미리 채운다', function () {
    if (!hasNode()) return;
    withStorage(function () {
      A.signInEmailAccount({ email: 'Player@Example.com', name: '승우', token: 't' });
      var def = BM.views.my.connectDefaults();
      eq(def.email, 'player@example.com', '세션 이메일(소문자 정규화)');
      eq(def.nick, '승우', '세션 닉네임');
      var body = sheetBody();
      eq(valueOf(body, 'email'), 'player@example.com', '이메일 칸');
      eq(valueOf(body, 'nick'), '승우', '닉네임 칸');
      /* 사용자가 그대로 고쳐 쓸 수 있어야 합니다 (잠그지 않음) */
      excludes(body, 'readonly', '입력칸을 잠그지 않는다');
      excludes(body, 'disabled', '입력칸을 끄지 않는다');
    });
  });

  test('v1.19 시트 연결: 체험(게스트) 세션이면 이메일·닉네임은 비워 둔다', function () {
    if (!hasNode()) return;
    withStorage(function () {
      A.signInGuest();
      var def = BM.views.my.connectDefaults();
      eq(def.email, '', '게스트는 이메일 없음');
      eq(def.nick, '', "게스트의 '체험 사용자'를 닉네임으로 넣지 않는다");
      var body = sheetBody();
      eq(valueOf(body, 'email'), '', '이메일 칸 비움');
      eq(valueOf(body, 'nick'), '', '닉네임 칸 비움');
      ok(def.url, '주소는 게스트도 채운다');
    });
  });

  test('v1.19 시트 연결: 안내 문구·빈 칸 검사·연타 잠금은 그대로', function () {
    if (!hasNode()) return;
    withStorage(function () {
      includes(sheetBody(), '기본 연결 주소가 채워져 있어요', '미리 채웠다는 안내');
      var src = readRoot('js/views/my.js');
      var start = src.indexOf('function openConnectSheet(');
      var block = src.slice(start, src.indexOf('function exportJson(', start));
      includes(block, 'if (!url || !email || !password)', '빈 칸이면 요청하지 않는다');
      ok(block.indexOf('if (!url || !email || !password)') < block.indexOf("btn.dataset.busy = '1';"),
        '빈 칸 검사 → 잠금 순서');
      includes(block, "if (btn.dataset.busy === '1') return;", '연타 잠금 유지');
    });
  });

  test('v1.19 버전: sw · app · 스타일 캐시 · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.31.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.31.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261120-31', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.31.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.31.0', 'TWA appVersion');
    eq(twa.appVersionCode, 31, 'TWA 버전 코드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
