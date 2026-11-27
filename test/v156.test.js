/* ============================================================
 * test/v156.test.js — bm-v1.73.0
 *   ✨ 일지 컨디션 5단계 + 시작(온보딩) 앱 분위기 선택
 *
 *  사용자가 승인한 두 가지 UX 개선을 그대로 검증합니다.
 *   1) 일지 컨디션 — 세로 5줄 구간 카드
 *      · 1~2 회복 · 3~4 가볍게 · 5~6 무난 · 7~8 고강도 · 9~10 최고
 *      · 저장은 예전 그대로 1~10 숫자(구간 대표 2·4·6·8·10) — 기존 일지·AI 계산 그대로
 *      · 1·3·5·7·9처럼 저장된 지난 일지를 고치면 그 숫자가 속한 구간이 켜짐
 *   2) 시작 화면 앱 분위기 3종(나이트·기본 코트·사쿠라)
 *      · 누르면 화면 전체가 바로 그 테마로 미리 보기 · MY › 테마와 같은 저장
 *      · 성별이 여성일 때만 사쿠라에 은은한 '추천' 배지 (강제 적용 없음)
 *   3) 기존 5개 탭·v1.55 기능 보호 · 보안(CSP·이스케이프) · 버전(sw·app·index·TWA)
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var ME = BM.seed.ME;         /* demo_me */

  function LOG() { return BM.views.log; }
  function START() { return BM.views.start; }

  function draft(patch) {
    var d = {
      date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], gameMode: 21,
      games: [{ a: '', b: '' }], score: null, result: '', pain: [], weakness: [],
      note: '', partner: '', rival: '', video: '', videoNote: '', pro: {}
    };
    Object.keys(patch || {}).forEach(function (k) { d[k] = patch[k]; });
    return d;
  }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: draft(patch && patch.draft) },
      ui: {
        tab: 'log', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null,
        composerTopic: '자유', composerMeet: {}
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { if (k !== 'draft') st[k] = patch[k]; });
    return st;
  }

  function freshStore() {
    try { root.localStorage && root.localStorage.clear && root.localStorage.clear(); } catch (e) { /* 무시 */ }
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 컨디션 5단계 — 구간 정의와 1~10 호환
   * ========================================================= */

  test('v1.56 컨디션: 5개 구간이 1~10을 빈틈없이 덮고 이름이 약속한 그대로다', function () {
    eq(D.CONDITION_BANDS.length, 5, '구간 5개');
    var want = [
      ['rest', 1, 2, 2, '오늘은 회복이 먼저'],
      ['light', 3, 4, 4, '가볍게 몸 풀기'],
      ['normal', 5, 6, 6, '무난한 컨디션'],
      ['go', 7, 8, 8, '오늘은 제대로 달리자'],
      ['best', 9, 10, 10, '컨디션 최고!']
    ];
    want.forEach(function (w, i) {
      var b = D.CONDITION_BANDS[i];
      eq(b.id, w[0], '구간 id');
      eq(b.min, w[1], w[0] + ' 시작 점수');
      eq(b.max, w[2], w[0] + ' 끝 점수');
      eq(b.score, w[3], w[0] + ' 대표 점수');
      eq(b.label, w[4], w[0] + ' 한 줄 기준');
    });
    /* 1~10이 하나도 빠지지 않고 정확히 한 구간에만 속합니다 */
    for (var n = 1; n <= 10; n++) {
      var hits = D.CONDITION_BANDS.filter(function (b) { return n >= b.min && n <= b.max; });
      eq(hits.length, 1, n + '점은 한 구간에만');
    }
  });

  test('v1.56 컨디션: 1~10 어느 점수든 제 구간으로 붙는다(기존 일지 1·3·5·7·9 포함)', function () {
    var map = { 1: 'rest', 2: 'rest', 3: 'light', 4: 'light', 5: 'normal', 6: 'normal', 7: 'go', 8: 'go', 9: 'best', 10: 'best' };
    Object.keys(map).forEach(function (k) {
      var b = D.condBandOf(Number(k));
      ok(b, k + '점 구간');
      eq(b.id, map[k], k + '점 구간');
    });
    /* 예전에 저장된 홀수 값도 그대로 붙습니다 */
    eq(D.condBandOf(1).id, 'rest', '1 → 회복');
    eq(D.condBandOf(3).id, 'light', '3 → 가볍게');
    eq(D.condBandOf(5).id, 'normal', '5 → 무난');
    eq(D.condBandOf(7).id, 'go', '7 → 고강도');
    eq(D.condBandOf(9).id, 'best', '9 → 최고');
    /* 문자열·실수·범위 밖 값도 안전하게 */
    eq(D.condBandOf('8').id, 'go', '문자열 8');
    eq(D.condBandOf(4.4).id, 'light', '실수 4.4');
    eq(D.condBandOf(0).id, 'rest', '0은 첫 구간');
    eq(D.condBandOf(11).id, 'best', '11은 끝 구간');
    eq(D.condBandOf(null), null, '미입력은 구간 없음');
    eq(D.condBandOf(''), null, '빈 값은 구간 없음');
    eq(D.condBandOf('abc'), null, '숫자가 아니면 구간 없음');
  });

  test('v1.56 컨디션: 구간 → 저장 점수는 2·4·6·8·10, 화면 표기는 5~6점', function () {
    eq(D.condScoreOf('rest'), 2, '회복');
    eq(D.condScoreOf('light'), 4, '가볍게');
    eq(D.condScoreOf('normal'), 6, '무난');
    eq(D.condScoreOf('go'), 8, '고강도');
    eq(D.condScoreOf('best'), 10, '최고');
    eq(D.condScoreOf('nope'), null, '모르는 구간');
    eq(D.condRangeText(6), '5~6점', '무난 표기');
    eq(D.condRangeText(3), '3~4점', '가볍게 표기');
    eq(D.condRangeText(null), '', '미입력 표기');
  });

  /* =========================================================
   * 2. 일지 화면 — 5줄 카드 · 지난 일지 수정 표시
   * ========================================================= */

  test('v1.56 일지: 컨디션 자리에 5단계 카드가 있고 슬라이더는 사라졌다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var html = LOG().render(stateOf());
    var bands = ['rest', 'light', 'normal', 'go', 'best'];
    bands.forEach(function (id) {
      includes(html, 'data-cond-band="' + id + '"', '구간 카드 ' + id);
    });
    eq((html.match(/data-cond-band=/g) || []).length, 5, '카드 5장');
    /* 대표 점수는 기존 1~10 숫자 그대로 저장됩니다 */
    ['2', '4', '6', '8', '10'].forEach(function (v, i) {
      includes(html, 'data-cond-val="' + v + '"', '대표 점수 ' + v + '(' + bands[i] + ')');
    });
    ['오늘은 회복이 먼저', '가볍게 몸 풀기', '무난한 컨디션', '오늘은 제대로 달리자', '컨디션 최고!'].forEach(function (label) {
      includes(html, label, '한 줄 기준: ' + label);
    });
    /* 기존 칸 이름(data-field="cond")은 저장·수정 연동을 위해 그대로 남습니다 */
    includes(html, 'data-field="cond"', '칸 이름 유지');
    excludes(html, 'aria-label="컨디션 1에서 10"', '컨디션 슬라이더는 제거');
    /* 훈련강도 슬라이더는 예전 그대로 */
    includes(html, 'aria-label="훈련 강도 1에서 10"', '훈련강도 슬라이더 유지');
    includes(html, 'data-field="intensity"', '훈련강도 칸 유지');
  });

  test('v1.56 일지: 비어 있으면 아무 구간도 켜지지 않고 "미입력"', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var html = LOG().render(stateOf());
    eq((html.match(/condband--[a-z]+ is-on/g) || []).length, 0, '처음엔 선택 없음');
    includes(html, 'data-out="cond"', '컨디션 표시');
    includes(html, '>미입력<', '미입력 표시');
  });

  test('v1.56 일지: 고른 구간만 켜지고 오른쪽에 그 구간 범위가 보인다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var html = LOG().render(stateOf(null, { draft: { cond: 8 } }));
    includes(html, 'class="condband condband--go is-on"', '7~8 카드가 켜짐');
    eq((html.match(/condband--[a-z]+ is-on/g) || []).length, 1, '켜진 카드는 하나');
    includes(html, '>7~8점<', '표시는 구간 범위');
    eq(D.condBandOf(8).id, 'go', '8점 → 고강도');
  });

  test('v1.56 일지: 예전에 1·3·5·7·9로 저장된 일지를 고치면 제 구간이 켜진다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var cases = [[1, 'rest'], [3, 'light'], [5, 'normal'], [7, 'go'], [9, 'best'], [2, 'rest'], [10, 'best'], [4, 'light'], [6, 'normal']];
    cases.forEach(function (c) {
      LOG()._resetDetailFold && LOG()._resetDetailFold();
      var rec = {
        id: 'r_c' + c[0], type: '기록', userKey: ME, nick: '나래', date: U.ymd(),
        cond: c[0], games: [{ a: '21', b: '18' }], result: '승'
      };
      var d = D.recordDraft(rec);
      eq(d.cond, c[0], '수정 초안의 컨디션은 저장값 그대로');
      var html = LOG().render(stateOf([rec], { draft: d }));
      includes(html, 'condband--' + c[1] + ' is-on', c[0] + '점 → ' + c[1] + ' 카드');
      eq((html.match(/condband--[a-z]+ is-on/g) || []).length, 1, c[0] + '점: 켜진 카드는 하나');
    });
  });

  test('v1.56 일지: 고른 구간의 대표 점수가 그대로 일지에 저장된다(1~10 숫자)', function () {
    return freshStore().then(function (store) {
      store.state.locks = {};
      store.state.drafts.log.cond = D.condScoreOf('go');
      store.state.drafts.log.intensity = 8;
      store.state.drafts.log.minutes = 60;
      var res = store.actions.saveLog({ keepDraft: true });
      ok(res.ok, '저장 성공');
      eq(res.entity.cond, 8, '저장된 컨디션은 숫자 8');
      eq(res.entity.intensity, 8, '훈련강도도 그대로');
      var rec = (store.state.data.records || []).filter(function (r) { return String(r.id) === String(res.entity.id); })[0];
      ok(rec, '기록이 쌓임');
      eq(rec.cond, 8, '기록의 컨디션 8');
      /* 예전 값(3)을 고쳐 저장해도 숫자 그대로 남아 AI 계산·평균 컨디션이 그대로 돕니다 */
      store.state.locks = {};
      store.state.ui.editLogId = rec.id;
      store.state.drafts.log = D.recordDraft(rec);
      eq(store.state.drafts.log.cond, 8, '수정 초안 8');
      eq(D.condBandOf(store.state.drafts.log.cond).id, 'go', '수정 화면에서 7~8 카드가 켜짐');
    });
  });

  /* =========================================================
   * 3. 시작 화면 — 앱 분위기 3종
   * ========================================================= */

  function onbHtml(gender) {
    START().reset();
    var s = START().state();
    if (gender) s.onb.gender = gender;
    return START().renderOnboarding({ kind: 'guest', name: '새내기' });
  }

  test('v1.56 시작: 온보딩에서 앱 분위기 3종을 눌러 고른다', function () {
    var html = onbHtml();
    includes(html, 'data-pick="theme"', '테마 고르기 그룹');
    ['th_night', 'th_def', 'th_sakura'].forEach(function (id) {
      includes(html, 'data-val="' + id + '"', '테마 ' + id);
    });
    eq((html.match(/data-pick="theme"/g) || []).length, 3, '테마 카드 3장');
    includes(html, '다크 코트', '다크 안내');
    includes(html, '라이트', '라이트 안내');
    includes(html, '사쿠라 핑크', '사쿠라 안내');
    /* bm-v1.73.0 — 테마가 모두 무료라 카드에 하트 가격 배지가 없습니다 */
    excludes(html, '하트 2', '무료 테마에 하트 배지 없음');
    excludes(html, 'onbtheme__price', '가격 배지 자체가 없음');
    includes(html, 'data-onb-theme-note', '아래 한 줄 안내');
    /* 역할·급수·성별 등 기존 온보딩 칸은 그대로 */
    ['role', 'level', 'discipline', 'gender', 'region'].forEach(function (g) {
      includes(html, 'data-pick="' + g + '"', '기존 칸 ' + g);
    });
    includes(html, 'data-act="finish"', '시작하기');
  });

  test('v1.56 시작: 테마 3종은 MY › 테마와 같은 저장을 쓴다(이름·가격 그대로)', function () {
    var list = D.onbThemes();
    eq(list.length, 3, '3종');
    eq(list[0].id, 'th_night', '첫째는 다크(나이트)');
    eq(list[1].id, 'th_def', '둘째는 라이트(기본 코트)');
    eq(list[2].id, 'th_sakura', '셋째는 사쿠라');
    list.forEach(function (t) {
      var def = D.themeById(t.id);
      ok(def, t.id + ' 실제 테마');
      eq(t.name, def.name, t.id + ' 이름은 MY와 같음');
      eq(t.price, D.themePrice(t.id), t.id + ' 가격은 MY와 같음');
      ok(t.note, t.id + ' 한 줄 안내');
    });
    eq(D.themePrice('th_night'), 0, '다크 무료');
    eq(D.themePrice('th_def'), 0, '라이트 무료');
    eq(D.themePrice('th_sakura'), 0, '사쿠라도 무료 (bm-v1.74.0)');
  });

  test('v1.56 시작: 여성일 때만 사쿠라에 은은한 추천 배지 (남성·비공개는 표시 안 함)', function () {
    var none = onbHtml('');
    var at = none.indexOf('data-onb-rec="th_sakura"');
    ok(at > 0, '사쿠라 추천 배지 자리');
    includes(none.slice(at, none.indexOf('>', at) + 1), 'hidden', '처음엔 숨김');

    var female = onbHtml('여성');
    var fAt = female.indexOf('data-onb-rec="th_sakura"');
    var fTag = female.slice(fAt, female.indexOf('>', fAt) + 1);
    excludes(fTag, 'hidden', '여성이면 보임');
    includes(female, '>추천<', '추천 글자');

    var male = onbHtml('남성');
    var mAt = male.indexOf('data-onb-rec="th_sakura"');
    includes(male.slice(mAt, male.indexOf('>', mAt) + 1), 'hidden', '남성은 숨김');

    /* 추천은 사쿠라에만 — 다른 테마 카드는 늘 선택 가능하고 강제 적용하지 않습니다 */
    eq(D.onbThemeRecommended('th_sakura', '여성'), true, '여성 · 사쿠라');
    eq(D.onbThemeRecommended('th_sakura', '남성'), false, '남성 · 사쿠라');
    eq(D.onbThemeRecommended('th_night', '여성'), false, '여성 · 다크');
    eq(D.onbThemeRecommended('th_def', '여성'), false, '여성 · 라이트');
    eq(D.onbThemeRecommended('th_sakura', '비공개'), false, '비공개 · 사쿠라');
  });

  test('v1.56 시작: 고른 테마는 이미 저장된 테마와 선택 상태로 이어진다', function () {
    START().reset();
    var s = START().state();
    s.onb.theme = 'th_def';
    var html = START().renderOnboarding({ kind: 'guest', name: '새내기' });
    includes(html, 'class="onbtheme is-on" data-pick="theme" data-val="th_def"', '기본 코트가 켜짐');
    includes(html, '누르면 이 화면이 바로 그 테마로 바뀌어요', '미리 보기 안내');
    eq((html.match(/onbtheme is-on/g) || []).length, 1, '켜진 카드는 하나');

    s.onb.theme = 'th_sakura';
    var sakura = START().renderOnboarding({ kind: 'guest', name: '새내기' });
    includes(sakura, '누르면 이 화면이 바로 그 테마로 바뀌어요', '무료 테마 안내');
  });

  test('v1.56 시작: 시작하기를 누르면 고른 테마가 저장소에 바로 반영된다', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js');
    var app = readRoot('app.js');
    includes(start, 'theme: o.theme || \'\'', '온보딩 완료 값에 테마 포함');
    includes(start, 'data-pick="theme"', '테마 카드');
    includes(start, 'previewTheme(ui.onb.theme)', '누르면 바로 미리 보기');
    includes(app, 'store.actions.setTheme(wantTheme)', '고른 테마를 저장소에 적용');
    includes(app, 'theme: (store.state.me && store.state.me.theme && store.state.me.theme.theme)', '지금 테마를 넘겨 미리 골라 둠');
    return freshStore().then(function (store) {
      store.state.locks = {};
      var before = store.state.me.theme && store.state.me.theme.theme;
      store.actions.saveProfile({ nick: '새회원', level: 'D조', discipline: '단식', gender: '여성', role: 'rookie' });
      eq(store.state.me.theme.theme, before, '프로필 저장만으로는 테마가 바뀌지 않음');
      store.state.locks = {};
      var r1 = store.actions.setTheme('th_def');
      ok(r1.ok, '기본 코트 적용');
      eq(store.state.me.theme.theme, 'th_def', '즉시 반영(전체 화면이 이 값을 씀)');
      store.state.locks = {};
      var r2 = store.actions.setTheme('th_sakura');
      ok(r2.ok, '사쿠라 적용');
      eq(r2.purchased, false, '무료라 하트로 열지 않음');
      eq(r2.price, 0, '하트 0');
      eq(store.state.me.theme.theme, 'th_sakura', '사쿠라 즉시 반영');
      /* 사진·프레임 등 나머지 꾸미기는 그대로 */
      ok('avatar' in store.state.me.theme, '아바타 유지');
    });
  });

  /* =========================================================
   * 4. 기존 기능 보호 · 보안 · 버전
   * ========================================================= */

  test('v1.56 보호: v1.55의 일지 접기·5개 탭·점수판 입구가 그대로다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var html = LOG().render(stateOf());
    includes(html, 'data-fold="detail"', '메모·영상 접기 유지');
    includes(html, 'data-fold="games"', '게임 점수 접기 유지');
    includes(html, 'data-act="open-scoreboard"', '코트 점수판 유지');
    if (hasNode) {
      var app = readRoot('app.js');
      var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
      ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
        includes(tabs, "id: '" + id + "'", '탭 ' + id);
      });
      eq((tabs.match(/id: '/g) || []).length, 5, '탭은 5개 그대로');
    }
  });

  test('v1.56 보안: 새 화면도 이스케이프를 거치고 CSP는 그대로다', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js'), logjs = readRoot('js/views/log.js');
    includes(start, 'U.esc(t.name)', '테마 이름 이스케이프');
    includes(start, 'U.esc(t.note)', '테마 안내 이스케이프');
    includes(logjs, 'U.esc(b.label)', '구간 이름 이스케이프');
    excludes(start, 'innerHTML = \'<button', '문자열 그대로 넣지 않음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
  });

  test('v1.56 문구: 예시·안내에 실존 선수 이름을 쓰지 않는다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var logHtml = LOG().render(stateOf(null, { draft: { cond: 6 } }));
    var onb = START().reset() || START().renderOnboarding({ kind: 'guest', name: '새내기' });
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(logHtml, name, '일지 예시에 ' + name + ' 없음');
      excludes(onb, name, '온보딩 예시에 ' + name + ' 없음');
    });
  });

  test('v1.56 배선: sw.js 캐시·테스트 목록에 이 파일이 들어 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "'./js/views/log.js'", 'sw 캐시 log.js');
    includes(sw, "'./js/views/start.js'", 'sw 캐시 start.js');
    var run = readRoot('test/run.js');
    includes(run, 'test/v156.test.js', '테스트 로드');
  });

  test('v1.56 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.88.0'", 'sw.js');
    includes(app, "version: 'v1.88.0'", 'app.js');
    includes(index, 'styles.css?v=20261127-2', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.88.0', 'TWA 이름');
    eq(twa.appVersion, '1.88.0', 'TWA 버전');
    eq(twa.appVersionCode, 82, 'TWA 코드');
  });

  test('v1.56 스타일: 5단계 카드·테마 카드 스타일이 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.condbands', '구간 카드 묶음');
    includes(css, '.condband.is-on', '켜진 구간');
    includes(css, '.onbthemes', '테마 카드 묶음');
    includes(css, '.onbtheme__mini', '테마 미리보기');
    includes(css, '.onbtheme__rec', '추천 배지');
    includes(css, '.onbtheme.is-on', '켜진 테마');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
