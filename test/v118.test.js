/* ============================================================
 * test/v118.test.js — v1.18.0 (2026-11-20)
 *  1) 시트 연결(연결 버튼) 연타 잠금: 연결 요청이 두 번 나가지 않는다
 *  2) 실패하면 버튼이 다시 열린다(잠긴 채 남지 않음)
 *  3) 버전: sw · app · 스타일 캐시 키 · README가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  /* 시트 연결 시트의 onMount 블록만 떼어 냅니다 (다른 시트와 섞이지 않게) */
  function connectBlock(src) {
    var start = src.indexOf('function openConnectSheet(');
    ok(start >= 0, 'openConnectSheet 정의');
    var end = src.indexOf('function exportJson(', start);
    ok(end > start, 'openConnectSheet 끝');
    return src.slice(start, end);
  }

  test('v1.18 시트 연결: 연결 버튼에 연타 잠금이 있다', function () {
    if (!hasNode()) return;
    var block = connectBlock(readRoot('js/views/my.js'));
    includes(block, 'var btn = ev.target.closest', '버튼을 먼저 잡는다');
    includes(block, "if (btn.dataset.busy === '1') return;", '연타는 즉시 무시');
    includes(block, "btn.dataset.busy = '1';", '요청 전에 잠근다');
    includes(block, 'btn.disabled = true;', '잠근 동안 버튼을 끈다');
    /* 잠그기 전에 값 검사(빈 칸이면 요청하지 않음)가 먼저여야 버튼이 잠긴 채 남지 않습니다 */
    ok(block.indexOf('if (!url || !email || !password)') < block.indexOf("btn.dataset.busy = '1';"),
      '빈 칸 검사 → 잠금 순서');
    includes(block, 'ctx.connectSheets(url, email, password, nick).then', '연결 요청은 한 곳에서');
  });

  test('v1.18 시트 연결: 실패하면 버튼이 다시 열린다', function () {
    if (!hasNode()) return;
    var block = connectBlock(readRoot('js/views/my.js'));
    includes(block, 'function release()', '되돌리는 함수');
    includes(block, "btn.dataset.busy = '0';", '잠금 해제');
    includes(block, 'btn.disabled = false;', '버튼 다시 켜기');
    var releaseCalls = (block.match(/release\(\);/g) || []).length;
    ok(releaseCalls >= 2, '실패·예외 두 갈래에서 모두 되돌린다 (실제 ' + releaseCalls + '곳)');
    includes(block, 'if (res.ok) { UI.closeSheet();', '성공하면 시트를 닫는다');
  });

  test('v1.18 서버 갈래도 한 번만 나간다: 연결은 store 액션이 아니라 한 약속으로 끝난다', function () {
    if (!hasNode()) return;
    var my = readRoot('js/views/my.js');
    excludes(my, 'data-act="do-connect" data-retry', '중복 호출용 두 번째 입구 없음');
    /* connectSheets는 app.js에서 api.login(create:true) 한 번만 부릅니다 */
    var app = readRoot('app.js');
    includes(app, 'function connectSheets(url, email, password, nick)', '연결 함수 하나');
    eq((app.match(/api\.login\(/g) || []).length, 1, 'login 호출은 한 곳');
  });

  test('v1.18 버전: sw · app · 스타일 캐시 · README가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.59.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.59.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261123-3', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
