/* ============================================================
 * test/v138_1.test.js — bm-v1.41.1 (2026-11-21 14시 정기 점검)
 *
 *   커뮤니티 '올리기' 연타:
 *     · 첫 번째 누름으로 글이 올라가며 입력칸이 비는데,
 *       두 번째 누름이 '내용을 입력해 주세요'로 보이면 글이 안 올라간 줄 알게 됩니다.
 *     · 올린 직후 0.8초 안의 누름은 조용히 무시합니다(중복 저장도 없음).
 *     · 입력칸이 비어 있을 때 한 번 누르는 경우의 안내는 그대로 둡니다.
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  BM.test.test('v1.41.1 커뮤니티: 올리기 연타가 "내용을 입력해 주세요"로 보이지 않는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/community.js');
    BM.test.includes(src, 'var lastPostAt = 0;', '올린 시각을 기억');
    BM.test.includes(src, 'Date.now() - lastPostAt < 800', '올린 뒤 0.8초 안의 누름은 무시');
    var okAt = src.indexOf("if (res.ok) {\n            lastPostAt = Date.now();");
    BM.test.ok(okAt > 0, '글이 실제로 올라간 뒤에만 시각을 남긴다');
    /* 무시하는 자리는 '올리기' 처리 안, 안내 문구보다 앞이어야 합니다 */
    var guard = src.indexOf('Date.now() - lastPostAt < 800');
    var empty = src.indexOf("res.reason === 'empty'");
    BM.test.ok(guard > 0 && empty > guard, '빈 칸 안내보다 앞에서 거른다');
  });

  BM.test.test('v1.41.1 커뮤니티: 빈 칸으로 한 번 눌렀을 때의 안내는 그대로', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/community.js');
    BM.test.includes(src, "else if (res.reason === 'empty') UI.toast('내용을 입력해 주세요');", '빈 칸 안내 유지');
    BM.test.includes(src, "else if (res.reason === 'locked') UI.toast('잠시만요, 올리는 중이에요');", '연타 잠금 안내 유지');
  });

  BM.test.test('v1.41.1 버전: sw · app · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    BM.test.includes(readRoot('sw.js'), "var VERSION = 'bm-v1.51.0'", 'sw.js');
    BM.test.includes(readRoot('app.js'), "version: 'v1.51.0'", 'app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    BM.test.eq(twa.appVersionName, '1.51.0', 'TWA 버전 이름');
    BM.test.eq(twa.appVersion, '1.51.0', 'TWA appVersion');
    BM.test.eq(twa.appVersionCode, 43, 'TWA 버전 코드(웹만 바뀌면 그대로)');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
