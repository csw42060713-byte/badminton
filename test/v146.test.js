/* ============================================================
 * test/v146.test.js — bm-v1.46.0 내 집 반경 5km · 동네 동호인 · 지도 안 게스트 모집
 *
 *  이번 버전은 새 기능을 얹은 것이 아니라, 로컬 미리보기로 확인한 기능을
 *  최신 main(bm-v1.43.0 게스트 신청 · bm-v1.44.0 점수판·전국 120곳 ·
 *  bm-v1.45.0 멘토 소속 증명) 위로 병합해 배포한 것입니다.
 *  그래서 여기서는 '한 화면에 둘이 함께 있는가'를 봅니다.
 *
 *  1) 지도 화면 — 권역 칩·검색(최신 main)과 내 상태·내 집·반경 5km·모집 칸(이번 기능)이 함께
 *  2) 지도 안내 — 내 집이 있으면 '반경 5km · 동호인 N명'과 '전국 배드민턴 120곳'을 함께
 *  3) 매칭 입구 카드 — '반경 5km · 파란 불 N' 칩
 *  4) 스타일 — 18. 체육관 지도 구역이 한 벌만(병합 중복 없음) · --live 색
 *  5) 배선 — index.html·sw.js 캐시·테스트 목록에 js/nearby.js
 *  6) 버전 — sw · app · index · TWA가 함께 올라간다
 *
 *  실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var SAT = new Date(2026, 10, 21, 20, 30);   /* 2026-11-21(토) 20:30 — 저녁 운동 시간 */

  function resetAll() {
    try { BM.nearby.resetHome('demo_me'); } catch (e) { /* 무시 */ }
    try { BM.nearby.resetMyStatus('demo_me'); } catch (e) { /* 무시 */ }
    ['bm_rows_v1', 'bm_me_v1', 'bm_mode_v1'].forEach(function (k) { BM.util.storage.removeItem(k); });
  }

  function stateOf(key) {
    return {
      me: { key: key || 'demo_me', nick: '나', level: 'B조', discipline: '복식', club: '' },
      data: { posts: [], matchProfiles: [], idx: null, records: [] },
      ui: {}
    };
  }

  /* =========================================================
   * 1. 지도 화면 — 최신 main 기능과 이번 기능이 함께 있다
   * ========================================================= */
  test('v1.46 지도 화면: 권역 칩·검색(최신 main)과 내 상태·내 집·모집 칸(반경 5km)이 함께 있다', function () {
    resetAll();
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT });
    /* 최신 main (bm-v1.44.0) */
    includes(html, 'data-gymregion', '권역 칩');
    includes(html, 'data-gym-search', '동네·이름 검색');
    eq((html.match(/data-gym-region="/g) || []).length, 7, '권역 칩 7개');
    /* 이번 기능 */
    includes(html, 'data-gymmystat', '내 상태 카드');
    includes(html, 'data-gymhome', '내 집 줄');
    includes(html, 'data-gymnear', '반경 5km 동호인 목록');
    includes(html, 'data-gymrecruit', '지도 안 게스트 모집');
    includes(html, 'data-gymlegend', '파란 불 범례');
    /* 120곳이 그대로 (전국 체육관 확장 유지) */
    ok(BM.gyms.count() >= 120, '전국 체육관 120곳 이상');
  });

  test('v1.46 지도 안내: 내 집이 있으면 반경 5km와 전국 안내를 함께 말한다', function () {
    resetAll();
    BM.nearby.resetHome('demo_me');           /* 기본값 = 망원동 예시 */
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT });
    var note = html.slice(html.indexOf('data-gymnote'));
    note = note.slice(0, note.indexOf('</p>'));
    includes(note, '반경 5km', '내 집 기준');
    includes(note, '동호인 <b>', '동호인 수');
    includes(note, '전체 보기', '지도 밖 체육관은 전체 보기로');
    includes(note, '전국 배드민턴 <b>', '최신 main의 전국 안내도 그대로');
    includes(note, '서울 ', '서울 몇 곳인지');
  });

  test('v1.46 매칭 입구 카드: 반경 5km · 파란 불 N 칩이 붙는다', function () {
    resetAll();
    var html = BM.views.matching.render(stateOf('demo_me'));
    includes(html, 'data-act="open-gym-map"', '지도 열기 버튼');
    includes(html, '전국 체육관 ' + BM.gyms.count() + '곳', '최신 main 안내 문구');
    includes(html, 'gymentry__near', '반경 5km 칩');
    includes(html, '반경 5km · 파란 불 ', '칩 문구');
  });

  /* =========================================================
   * 2. 스타일 · 배선
   * ========================================================= */
  test('v1.46 스타일: 체육관 지도 구역이 한 벌만 있고 파란 불 색이 정의돼 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    /* 병합 중 같은 구역(18. 체육관 지도)이 두 벌 들어가지 않았는지 */
    eq((css.match(/\/\* -+ 18\.3 지도 -+ \*\//g) || []).length, 1, '18.3 지도 구역 한 벌');
    eq((css.match(/^\.gymmap \{$/gm) || []).length, 1, '.gymmap 규칙 한 벌');
    includes(css, '--live: #3b82f6', '파란 불 색');
    includes(css, '.gymring', '반경 5km 원');
    includes(css, '.gymhome-pin', '내 집 핀');
    includes(css, '.gymp', '사람 아이콘');
    includes(css, '.gymentry__near', '입구 카드 칩');
    includes(css, '.recruit__new', '모집 글 쓰기 버튼');
  });

  test('v1.46 배선: js/nearby.js 가 화면 · 서비스워커 캐시 · 테스트 목록에 있다', function () {
    if (!hasNode) return;
    includes(readRoot('index.html'), 'js/nearby.js', 'index.html');
    includes(readRoot('sw.js'), "'./js/nearby.js'", 'sw.js 캐시');
    includes(readRoot('test/run.js'), "'js/nearby.js'", '테스트 목록');
    includes(readRoot('js/views/gyms.js'), "function N() { return BM.nearby; }", '지도 화면이 nearby 를 씀');
  });

  test('v1.46 개인정보: 내 집·사람 좌표는 기기에만 저장한다', function () {
    if (!hasNode) return;
    var src = readRoot('js/nearby.js');
    excludes(src, 'fetch(', '서버로 보내지 않는다');
    excludes(src, 'XMLHttpRequest', '서버로 보내지 않는다');
    includes(src, 'U.writeJSON', '기기 저장');
    includes(src, 'U.storage', '기기 저장소만 사용');
  });

  /* =========================================================
   * 3. 버전
   * ========================================================= */
  test('v1.46 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.95.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.95.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-1', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.95.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 89', '앱 버전 코드는 그대로');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
