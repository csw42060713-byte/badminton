/* ============================================================
 * test/v162.test.js — bm-v1.73.0
 *   📸 인스타 공유 입구를 첫 화면으로
 *
 *  사용자 피드백: "인스타 공유칸이 너무 안보이는데 있어"
 *   → MY 아코디언을 펼치거나, 일지를 방금 저장한 직후에만 보였습니다.
 *
 *   1) 일지 & AI 히어로 카드 — 스탯 줄 바로 아래 '📸 인스타 공유' 칩(늘 보임 · 1탭)
 *   2) MY — 프로필 카드 바로 아래 '인스타 공유 카드 만들기' 배너(1탭)
 *   3) 첫 화면 칩은 **최신 일지**, 저장 직후 스트립은 **방금 저장한 일지**로 연다
 *   4) MY 중간 '인스타 공유 카드' 아코디언은 걷어낸다(같은 시트를 두 번 열던 중복)
 *   5) 보존 — 저장 직후 스트립 · 최근 기록 상세 입구 · 5개 탭 · CSP · 실명 없음
 *   6) 버전(bm-v1.73.0) · 캐시 키 · 테스트 목록
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var ME = BM.seed.ME;

  function rec(patch) {
    var r = {
      id: 'r_v162', type: '기록', userKey: ME, nick: '나래', date: '2026-11-23',
      minutes: 90, cond: 7, intensity: 7, done: ['스트록', '게임'],
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }],
      team: JSON.stringify({ partner: '민호', rival: '지호' }),
      pain: [], weakness: ['헤어핀'], note: ''
    };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  function stateOf(rows, patch) {
    rows = rows || [rec()];
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, club: '나래울' },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: { tab: 'log', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null, lastSavedLog: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  function ctxOf(state) {
    return {
      store: { state: state },
      actions: { setPref: function () {}, setTheme: function () { return { ok: true }; } },
      repaint: function () {}
    };
  }

  function countOf(hay, needle) {
    return String(hay).split(needle).length - 1;
  }

  /* =========================================================
   * 1. 일지 & AI — 히어로 카드 안 상시 칩
   * ========================================================= */

  test('v1.62 일지 첫 화면: 히어로 카드 스탯 줄 바로 아래에 인스타 공유 칩이 늘 있다', function () {
    var html = BM.views.log.render(stateOf());
    includes(html, 'data-share-entry="log-hero"', '첫 화면 칩');
    includes(html, 'class="hero__share', '칩 클래스');
    includes(html, 'data-act="share-card"', '같은 공유 카드 배선');
    includes(html, 'data-sc-mode="today"', '오늘 운동 카드로 열림');
    includes(html, '📸', '카메라 표시');
    includes(html, '인스타 공유', '이름');
    includes(html, 'aria-label="인스타 공유 카드 만들기"', '읽어 주는 이름');

    /* 스크롤 없이 보이는 자리 — 히어로 카드 안, 입력 폼보다 위 */
    var hero = html.indexOf('card--hero');
    var strip = html.indexOf('stat-strip');
    var chip = html.indexOf('data-share-entry="log-hero"');
    var court = html.indexOf('class="courttools"');
    var form = html.indexOf('data-form="log"');
    ok(hero >= 0 && strip > hero, '히어로 카드 · 스탯 줄');
    ok(chip > strip, '칩은 스탯 줄 아래');
    ok(chip < court, '코트 도구보다 위');
    ok(chip < form, '일지 입력 폼보다 위(첫 화면)');
    /* 히어로 카드가 닫히기 전에 칩이 들어 있다 */
    var heroEnd = html.indexOf('</section>', hero);
    ok(chip < heroEnd, '칩은 히어로 카드 안');
  });

  test('v1.62 일지 첫 화면: 기록이 없어도 칩은 보이고 문구는 늘 같다', function () {
    /* 히어로 칩 문구는 기록 유무와 상관없이 고정 — 저장 뒤 일부만 다시 그려도
     * 칩 글씨가 옛 문구로 남지 않습니다(오늘 운동 · 대회 인증 두 모드 모두 시트 안에서). */
    var empty = BM.views.log.render(stateOf([]));
    includes(empty, 'data-share-entry="log-hero"', '기록 없어도 칩');
    includes(empty, '오늘 운동 · 대회 인증', '기록 없을 때 문구');

    var full = BM.views.log.render(stateOf([rec()]));
    includes(full, '오늘 운동 · 대회 인증', '기록이 있을 때도 같은 문구');
    excludes(full, '최근 일지로', '기록에 따라 흔들리는 문구 없음');
  });

  test('v1.62 일지: 첫 화면 칩 · 저장 직후 스트립이 서로 다른 일지를 연다', function () {
    var log = BM.views.log;
    var older = rec({ id: 'r_old', date: '2026-11-21' });
    var newest = rec({ id: 'r_new', date: '2026-11-23' });
    var st = stateOf([older, newest]);
    eq(st.data.records[0].id, 'r_new', '기록은 최신순');
    eq(log.latestRecord(st).id, 'r_new', '최신 = records[0]');
    eq(log.shareRecordOf(st, 'log-hero').id, 'r_new', '첫 화면 칩 → 최신 일지');

    st.ui.lastSavedLog = older;
    eq(log.shareRecordOf(st, null).id, 'r_old', '스트립 → 방금 저장한 일지');
    eq(log.shareRecordOf(st, 'log-hero').id, 'r_new', '칩은 그대로 최신');

    eq(log.latestRecord(stateOf([])), null, '기록이 없으면 null');
    eq(log.shareRecordOf(stateOf([]), 'log-hero'), null, '기록이 없으면 시트가 빈 카드 안내');
  });

  test('v1.62 시트: 칩을 누르면 최신 일지 · 오늘 운동 모드로 바로 열린다', function () {
    if (!hasNode) return;
    var sc = BM.sharecard;
    var st = stateOf([rec({ id: 'r_new', date: '2026-11-23', minutes: 120 })]);
    var ui = sc._initialState(ctxOf(st), { mode: 'today', record: BM.views.log.latestRecord(st) });
    eq(ui.mode, 'today', '오늘 운동 모드');
    eq(ui.recordId, 'r_new', '최신 일지가 골라져 있음');
    sc._setState(ui);
    var body = sc._sheetBody(ctxOf(st));
    includes(body, '대회 인증', '시트 안에서 대회 인증으로도 바꿀 수 있다');
    sc._setState(null);
  });

  /* =========================================================
   * 2. MY — 프로필 바로 아래 배너
   * ========================================================= */

  test('v1.62 MY: 프로필 카드 바로 아래에 인스타 공유 배너(1탭)가 있다', function () {
    var my = BM.views.my.render(stateOf([rec()]));
    includes(my, 'class="share-entry"', '배너');
    includes(my, '인스타 공유 카드 만들기', '제목');
    includes(my, '민턴일기 · 대회 인증 · 사진 얹기', '부제');
    includes(my, '📸', '카메라 표시');
    includes(my, 'data-act="share-card"', '공유 카드 배선');
    includes(my, 'data-sc-mode="today"', '바로 시트');
    includes(my, 'data-share-entry="my-top"', '입구 표시');

    /* 위치 — 프로필 카드가 끝난 뒤, 리포트·아코디언보다 위 */
    var prof = my.indexOf('card--profile');
    var banner = my.indexOf('data-share-entry="my-top"');
    var report = my.indexOf('data-act="open-report"');
    ok(prof >= 0 && banner > prof, '프로필 카드 아래');
    var profEnd = my.indexOf('</section>', my.indexOf('class="stats"'));
    ok(profEnd > prof && banner > profEnd, '프로필 카드 밖(바로 아래)');
    ok(report < 0 || banner < report, '리포트 버튼보다 위');
    /* 같은 시트로 가는 입구는 MY에 하나만 */
    eq(countOf(my, 'data-act="share-card"'), 1, 'MY 공유 입구는 하나');
  });

  test('v1.62 MY: 중복 아코디언은 걷어냈지만 문구·패널 조각은 남긴다', function () {
    var my = BM.views.my.render(stateOf([rec()]));
    excludes(my, 'data-group="share"', '중복 아코디언 없음');
    excludes(my, 'group__t">인스타 공유 카드<', '아코디언 제목 없음');
    includes(my, '매거진', 'v1.61 안내 문구는 배너에 남음');

    /* v1.57부터 있던 두 모드 버튼 조각은 테스트·재사용을 위해 그대로 */
    var panel = BM.views.my.sharePanel(stateOf([rec()]));
    includes(panel, '대회 인증 카드', '대회 인증 입구');
    includes(panel, '오늘 운동 카드', '오늘 운동 입구');
  });

  /* =========================================================
   * 3. 보존 — 저장 직후 · 기록 상세
   * ========================================================= */

  test('v1.62 보존: 저장 직후 스트립과 최근 기록 상세 입구는 그대로다', function () {
    var st = stateOf([rec()]);
    st.drafts.log = { date: U.ymd(), cond: 8, intensity: 7, minutes: 90, done: ['스트록', '게임'],
      games: [{ a: '21', b: '15' }], pain: [], weakness: ['헤어핀'], note: '' };
    st.analysis = BM.ai.analyze({ draft: st.drafts.log, records: st.data.records, level: 'C조', nick: '나래' });
    st.ui.lastSavedLog = rec({ id: 'r_saved', date: '2026-11-23' });
    var html = BM.views.log.render(st);
    includes(html, 'data-region="share"', '저장 직후 스트립');
    includes(html, '인스타 공유 카드 만들기', '스트립 버튼');
    eq(countOf(html, 'data-act="share-card"'), 2, '칩 + 스트립 두 입구');
    includes(BM.views.log.recordDetail(rec()), 'data-act="share-card"', '기록 상세 버튼');
  });

  test('v1.62 보존: 다른 화면·기능은 건드리지 않는다(5개 탭 · 코트 점수판 · 리포트)', function () {
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');
    var html = BM.views.log.render(stateOf());
    includes(html, 'data-act="open-scoreboard"', '코트 점수판');
    var my = BM.views.my.render(stateOf());
    includes(my, 'data-act="decorate-sheet"', '프로필 꾸미기');
    includes(my, '주간·월간 상세 리포트', '리포트 입구');
  });

  /* =========================================================
   * 4. 안전 — 이스케이프 · 실명 · CSP · 저장 없음
   * ========================================================= */

  test('v1.62 안전: 실존 선수 이름 없음 · 새 요청 없음 · 시트만 연다', function () {
    if (!hasNode) return;
    var logjs = readRoot('js/views/log.js');
    var myjs = readRoot('js/views/my.js');
    ['김원호', '안세영', '서재승', '서승재'].forEach(function (name) {
      excludes(logjs, name, 'log.js ' + name);
      excludes(myjs, name, 'my.js ' + name);
    });
    includes(logjs, 'BM.sharecard.open(ctx,', '일지: 공유 시트 열기');
    includes(myjs, "BM.sharecard.open(ctx, { mode: scBtn.getAttribute('data-sc-mode') || 'today' });", 'MY: 공유 시트 열기');
    /* 새 저장·새 컬럼 없음 — 공유 카드는 화면에서만 그린다 */
    excludes(logjs, 'actions.saveLog(', '일지: 공유 입구가 저장을 만들지 않음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    includes(csp, "default-src 'self'", 'CSP self');
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    includes(csp, "form-action 'self'", '폼 전송 self');
  });

  test('v1.62 안전: 사용자가 넣은 값은 그대로 글자로만 나간다(칩 문구 고정)', function () {
    /* 첫 화면 칩·MY 배너는 고정 문구만 씁니다 — 닉네임 같은 사용자 값이 새 입구에 섞이지 않음 */
    var html = BM.views.log.render(stateOf());
    var chip = html.slice(html.indexOf('data-share-entry="log-hero"') - 40, html.indexOf('data-share-entry="log-hero"') + 400);
    excludes(chip, '나래', '칩에 닉네임 없음');
    var my = BM.views.my.render(stateOf());
    var banner = my.slice(my.indexOf('data-share-entry="my-top"') - 40, my.indexOf('data-share-entry="my-top"') + 500);
    excludes(banner, '나래', '배너에 닉네임 없음');
  });

  /* =========================================================
   * 5. 버전 · 배선
   * ========================================================= */

  test('v1.62 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.101.0'", 'sw.js');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
    includes(app, "version: 'v1.101.0'", 'app.js');
    includes(index, 'styles.css?v=20261128-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.101.0', 'TWA 이름');
    eq(twa.appVersion, '1.101.0', 'TWA appVersion');
    eq(twa.appVersionCode, 95, 'TWA 코드');
  });

  test('v1.62 배선: 새 입구 스타일 · 테스트 목록 · 서비스워커 캐시', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.hero__share {', '.hero__share-t', '.hero__share-s', '.share-entry {', '.share-entry__ico', '.share-entry__t'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    /* 390px 폰에서 넘치지 않게 — 오른쪽 설명은 한 줄 말줄임 */
    var at = css.indexOf('.hero__share-s {');
    var seg = css.slice(at, css.indexOf('}', at));
    includes(seg, 'text-overflow: ellipsis', '칩 설명 말줄임');
    includes(seg, 'min-width: 0', '칩 설명이 줄어들 수 있음');
    var run = readRoot('test/run.js');
    includes(run, 'test/v162.test.js', '테스트 목록');
    var sw = readRoot('sw.js');
    includes(sw, "'./js/views/log.js'", 'sw 캐시 log');
    includes(sw, "'./js/views/my.js'", 'sw 캐시 my');
    includes(sw, "'./styles.css'", 'sw 캐시 css');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
