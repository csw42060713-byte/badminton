/* ============================================================
 * test/routine.test.js — 초보자 배드민턴 4주 루틴 (v1.10.0 → v1.11.0 접기)
 *  1) 4주 · 13개 항목, 승우 님이 추가한 '서서 하는 헤어핀/언더'가 2주차에 있다
 *  2) 초보자 눈높이: 항목마다 방법 + 감 잡는 포인트 + 소요 시간
 *  3) 주차별/전체 달성률 계산, 다음 연습 안내, 완료 판정
 *  4) 체크는 계정별로 기기에 저장되고 새로고침(새 store) 후에도 남는다
 *  5) 일지 화면에 카드가 그려지고 체크 상태·진행률이 반영된다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, R = BM.routine;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_routine_v1::demo_me', 'bm_routine_v1::u_test_a', 'bm_routine_v1::u_test_b', 'bm_routine_v1::nobody']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function checkAll(map) {
    var m = {};
    R.ids().forEach(function (id) { m[id] = true; });
    return m;
  }

  function freshStore(keepRoutine) {
    if (!keepRoutine) clearStorage();
    var rows = BM.fixtures ? BM.fixtures.demo() : BM.seed.build();
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* ---------- 1. 프로그램 구성 ---------- */
  test('4주 루틴: 4개 주차 · 13개 항목 · 제목/안내 문구', function () {
    eq(R.WEEKS.length, 4, '4주');
    eq(R.ALL_ITEMS.length, 13, '항목 13개');
    eq(R.TITLE, '초보자 배드민턴 4주 루틴', '프로그램 이름');
    includes(R.SUB, '주 2~3회', '주 2~3회');
    includes(R.SUB, '20~30분', '하루 20~30분');
    eq(R.WEEKS[0].name, '그립과 기본 자세', '1주차');
    eq(R.WEEKS[1].name, '제자리 기본 타구와 빈 스윙', '2주차');
    eq(R.WEEKS[2].name, '서브와 랠리 감각', '3주차');
    eq(R.WEEKS[3].name, '실전 적응과 회복', '4주차');
  });

  test('4주 루틴: 2주차에 승우 님이 추가한 서서 하는 헤어핀·언더가 있다', function () {
    var w2 = R.WEEKS[1].items.map(function (i) { return i.name; });
    ok(w2.indexOf('서서 하는 헤어핀 연습') >= 0, '서서 하는 헤어핀 연습');
    ok(w2.indexOf('서서 하는 언더 연습') >= 0, '서서 하는 언더 연습');
    /* 헤어핀·언더가 섀도 스윙보다 먼저 — 제자리 감각부터 */
    ok(w2.indexOf('서서 하는 헤어핀 연습') < w2.indexOf('빈 스윙 15회 × 3세트'), '헤어핀 → 빈 스윙 순서');
    var hair = R.WEEKS[1].items[0];
    includes(hair.how, '손목과 손가락', '헤어핀은 손목·손가락 감각');
    includes(hair.how, '네트', '네트 너머로');
    var under = R.WEEKS[1].items[1];
    includes(under.how, '스텝 없이 제자리', '언더도 제자리에서');
  });

  test('4주 루틴: 모든 항목에 쉬운 방법·감 잡는 포인트·소요 시간이 있다', function () {
    R.WEEKS.forEach(function (w) {
      ok(w.goal && w.goal.length >= 10, w.no + '주차 이번 주 목표');
      ok(w.pace, w.no + '주차 예상 시간');
      w.items.forEach(function (it) {
        ok(it.id && it.name, 'id/이름');
        ok(it.how.length >= 25, it.name + ': 방법이 너무 짧음');
        ok(it.point.length >= 8, it.name + ': 감 잡는 포인트');
        ok(it.min > 0, it.name + ': 시간');
        excludes(it.how + it.point, '리프트 궤적', it.name + ': 어려운 전문 용어 그대로');
        excludes(it.point, '오버헤드', it.name + ': 어려운 전문 용어 그대로');
      });
    });
  });

  test('4주 루틴: 주차별 연습량이 초보자 범위(약 15~24분)에 들어온다', function () {
    R.WEEKS.forEach(function (w) {
      var min = w.items.reduce(function (s, it) { return s + it.min; }, 0);
      ok(min >= 12 && min <= 30, w.no + '주차 ' + min + '분');
      if (w.no > 1) ok(min >= 20, w.no + '주차는 20분 이상 (하루 20~30분 기준)');
    });
    includes(R.WEEKS[1].pace, '2~3회', '2주차 주 2~3회');
    includes(R.GUARD, '통증', '무리하지 않기 안내');
  });

  test('4주 루틴: 용어는 괄호로 풀어 쓴다 (섀도 스윙·런지·스플릿 스텝)', function () {
    var all = R.WEEKS.map(function (w) {
      return w.items.map(function (i) { return i.name + ' ' + i.how + ' ' + i.point; }).join(' ');
    }).join(' ');
    includes(all, '(섀도 스윙)', '섀도 스윙 설명');
    includes(all, '런지(한 발 앞으로 크게 딛기)', '런지 설명');
    includes(all, '스플릿 스텝 (공 오기 직전 폴짝)', '스플릿 스텝 설명');
    includes(all, '하이클리어(머리 위에서 올려 치기)', '하이클리어 설명');
    includes(all, '팔뚝(전완근)', '전완근은 팔뚝으로 풀어 씀');
  });

  /* ---------- 2. 달성률 ---------- */
  test('4주 루틴: 빈 상태 0/13 · 한 개 체크하면 8%', function () {
    var st = R.stats({});
    eq(st.total, 13, '전체 13');
    eq(st.done, 0, '완료 0');
    eq(st.pct, 0, '0%');
    eq(st.complete, false, '아직 완료 아님');
    var one = R.toggle({}, 'w1_grip');
    var st2 = R.stats(one);
    eq(st2.done, 1, '완료 1');
    eq(st2.pct, 8, '8%');
    eq(st2.weeks[0].done, 1, '1주차 1개');
    eq(st2.weeks[0].total, 3, '1주차 3개');
    eq(st2.weeks[1].done, 0, '2주차는 아직 0');
  });

  test('4주 루틴: 같은 항목을 다시 누르면 해제 · 모르는 항목은 무시', function () {
    var on = R.toggle({}, 'w2_under');
    eq(on.w2_under, true, '체크');
    var off = R.toggle(on, 'w2_under');
    eq(off.w2_under, undefined, '해제');
    var weird = R.normalize({ w2_under: 'yes', hack: true, w1_grip: 1 });
    eq(weird.w2_under, undefined, '문자열 true는 무시');
    eq(weird.hack, undefined, '모르는 항목 무시');
    eq(weird.w1_grip, true, '1도 체크로 인정');
    eq(R.toggle({}, 'no-such-item').no_such_item, undefined, '모르는 id 토글 무시');
  });

  test('4주 루틴: 주차 완료 · 전체 완료 판정', function () {
    var m = {};
    R.WEEKS[0].items.forEach(function (i) { m[i.id] = true; });
    var st = R.stats(m);
    eq(st.weeks[0].complete, true, '1주차 완료');
    eq(st.weeks[0].pct, 100, '1주차 100%');
    eq(st.complete, false, '전체는 아직');
    var all = R.stats(checkAll());
    eq(all.done, 13, '13개');
    eq(all.pct, 100, '100%');
    eq(all.complete, true, '전체 완료');
    eq(all.weeks[3].complete, true, '4주차 완료');
  });

  test('4주 루틴: 지금 볼 주차와 다음 연습을 골라 준다', function () {
    eq(R.currentWeek({}), 1, '처음엔 1주차');
    var m = {};
    R.WEEKS[0].items.forEach(function (i) { m[i.id] = true; });
    eq(R.currentWeek(m), 2, '1주차를 끝내면 2주차');
    eq(R.currentWeek(checkAll()), 4, '다 끝내면 4주차');
    eq(R.nextItem({}).id, 'w1_grip', '첫 항목');
    eq(R.nextItem(m).id, 'w2_hairpin', '1주차 다음은 서서 하는 헤어핀');
    eq(R.nextItem(m).week, 2, '2주차');
    eq(R.nextItem(checkAll()), null, '다 하면 다음 없음');
  });

  test('4주 루틴: 항목 id는 고유하고 주차 번호가 맞다', function () {
    var seen = {};
    R.ALL_ITEMS.forEach(function (it) {
      ok(!seen[it.id], '중복 id: ' + it.id);
      seen[it.id] = true;
      ok(it.week >= 1 && it.week <= 4, '주차 범위');
      ok(R.weekOf(it.week).items.some(function (x) { return x.id === it.id; }), '주차 연결');
    });
    eq(Object.keys(seen).length, 13, '13개 고유');
    eq(R.weekOf(99).no, 1, '없는 주차는 1주차로');
  });

  /* ---------- 3. 저장 ---------- */
  test('4주 루틴: 계정(scope)마다 따로 저장된다', function () {
    clearStorage();
    R.save('u_test_a', { w1_grip: true });
    R.save('u_test_b', { w2_hairpin: true, w1_ready: true });
    eq(R.load('u_test_a').w1_grip, true, 'A 체크');
    eq(R.load('u_test_a').w2_hairpin, undefined, 'A는 B 체크 없음');
    eq(R.load('u_test_b').w2_hairpin, true, 'B 체크');
    eq(R.load('nobody').w1_grip, undefined, '빈 계정');
    eq(R.keyFor('U_Test_A'), 'bm_routine_v1::u_test_a', '키 형식(소문자)');
  });

  test('4주 루틴: 새로고침해도 체크가 남는다 (새 store)', function () {
    return freshStore().then(function (s1) {
      s1.actions.toggleRoutine('w2_hairpin');
      s1.actions.toggleRoutine('w1_warmup');
      eq(s1.state.routine.w2_hairpin, true, 'store 체크');
      return freshStore(true).then(function (s2) {
        eq(s2.state.routine.w2_hairpin, true, '새 store에서도 헤어핀 체크');
        eq(s2.state.routine.w1_warmup, true, '새 store에서도 워밍업 체크');
        eq(BM.routine.stats(s2.state.routine).done, 2, '2개 유지');
        s2.actions.resetRoutine();
        return freshStore(true).then(function (s3) {
          eq(BM.routine.stats(s3.state.routine).done, 0, '체크 지우기 후 0');
        });
      });
    });
  });

  test('4주 루틴: 보고 있는 주차는 1~4만 허용', function () {
    return freshStore().then(function (s) {
      eq(s.state.ui.routineWeek, 0, '처음엔 자동');
      s.actions.setRoutineWeek(3);
      eq(s.state.ui.routineWeek, 3, '3주차');
      s.actions.setRoutineWeek(9);
      eq(s.state.ui.routineWeek, 0, '범위 밖은 자동으로');
    });
  });

  /* ---------- 4. 화면 ---------- */
  function stateOf(routine, week) {
    var rows = BM.fixtures ? BM.fixtures.demo() : BM.seed.build();
    var me = {
      key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식',
      bio: '소개', region: '경기', club: '나래울', theme: { theme: 'th_night' }
    };
    return {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, me.key),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
      routine: routine || {},
      ui: {
        tab: 'log', matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', matchSort: 'score', matchFilterOpen: '',
        chatRoom: null, chatOther: '', chatOpen: false, chatDraft: '',
        coachTab: '', coachPlayer: null, composer: '', composerTopic: '자유', replyTo: null,
        routineWeek: week || 0, lastSavedLog: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function checkTags(html, label) {
    ['section', 'div', 'ul', 'li', 'label', 'span', 'p', 'button', 'header'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[ >]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  test('4주 루틴 화면: 일지 첫머리에 카드가 그려진다', function () {
    var html = BM.views.log.render(stateOf());
    includes(html, 'data-region="routine"', '루틴 카드');
    includes(html, '초보자 4주 루틴', '제목');
    includes(html, '왕초보', '왕초보 배지');
    includes(html, '주 2~3회', '기준 안내');
    includes(html, '라켓 그립 익히기', '1주차 항목');
    includes(html, '준비 자세 만들기', '1주차 항목');
    includes(html, '감 잡는 포인트', '포인트 한 줄');
    includes(html, '0</b>/13', '전체 0/13');
    includes(html, 'aria-valuenow="0"', '진행률 0');
    includes(html, '다음 연습', '다음 연습 안내');
    includes(html, 'w1_grip', '체크박스 연결');
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'NaN', 'NaN 없음');
    checkTags(html, '일지 화면');
  });

  test('4주 루틴 화면: 2주차를 고르면 서서 하는 헤어핀·언더가 보인다', function () {
    var html = BM.views.log.render(stateOf({}, 2));
    includes(html, '2주차<i>0/4</i>', '2주차 칩');
    includes(html, '서서 하는 헤어핀 연습', '서서 하는 헤어핀');
    includes(html, '서서 하는 언더 연습', '서서 하는 언더');
    includes(html, '10개 중 3~5개', '헤어핀 성공 기준');
    includes(html, '3~5m 앞', '언더 성공 기준');
    excludes(html, '1주차 · 그립과 기본 자세', '1주차 목록은 접혀 있다');
  });

  test('4주 루틴 화면: 체크한 상태·주차 선택이 그대로 보인다', function () {
    var m = { w1_grip: true, w1_ready: true, w1_warmup: true, w2_hairpin: true, w2_under: true };
    var html = BM.views.log.render(stateOf(m, 2));
    includes(html, 'data-rtn-item="w2_hairpin" checked', '헤어핀 체크 표시');
    includes(html, 'data-rtn-item="w2_under" checked', '언더 체크 표시');
    excludes(html, 'data-rtn-item="w2_shadow" checked', '안 한 항목은 빈 체크');
    includes(html, 'is-done', '완료 스타일');
    includes(html, '5</b>/13', '5/13');
    includes(html, 'aria-valuenow="38"', '38%');
    includes(html, '1주차<i>3/3</i>', '1주차 3/3');
    includes(html, '2주차<i>2/4</i>', '2주차 2/4');
    includes(html, '2주차 빈 스윙', '다음은 빈 스윙');
    excludedQuote(html);
  });

  function excludedQuote(html) {
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'NaN', 'NaN 없음');
  }

  test('4주 루틴 화면: 다 끝내면 완주 문구', function () {
    var html = BM.views.log.render(stateOf(checkAll(), 4));
    includes(html, '13</b>/13', '13/13');
    includes(html, '100', '100%');
    includes(html, '모두 완료', '완주 문구');
    includes(html, '4주 동안 수고했어요', '격려 문구');
    excludes(html, '다음 연습 · ', '다음 연습 안내 없음');
  });

  test('4주 루틴 화면: routine 상태가 없는 예전 state도 그대로 그려진다', function () {
    var st = stateOf();
    delete st.routine;
    delete st.ui.routineWeek;
    var html = BM.views.log.render(st);
    includes(html, '초보자 4주 루틴', '카드 유지');
    includes(html, '0</b>/13', '0/13');
    excludes(html, 'undefined', 'undefined 없음');
  });

  test('4주 루틴 화면: 기본은 한 줄 요약으로 접혀 있다', function () {
    var html = BM.views.log.render(stateOf());
    includes(html, 'class="rtn" data-rtn>', '기본은 접힘(details에 open 없음)');
    excludes(html, 'data-rtn open', '처음에는 펼치지 않음');
    includes(html, 'rtn__sum', '요약 헤더');
    includes(html, '다음 · 라켓 그립 익히기', '다음에 할 한 가지');
    includes(html, '0</b>/13', '완료 수');
    includes(html, '왕초보', '배지');
    /* 접혀 있어도 체크리스트 내용은 그려 두고 CSS로 숨깁니다 */
    includes(html, '라켓 그립 익히기', '펼쳤을 때 볼 내용');
  });

  test('4주 루틴 화면: 요약줄에 진행과 다음 연습이 함께 보인다', function () {
    var m = { w1_grip: true, w1_ready: true, w1_warmup: true };
    var html = BM.views.log.render(stateOf(m, 2));
    includes(html, '3</b>/13', '3/13');
    includes(html, '다음 · 서서 하는 헤어핀 연습', '다음 연습이 요약에');
    var done = BM.views.log.render(stateOf(checkAll(), 4));
    includes(done, '4주 동안 수고했어요', '완주하면 격려');
    excludes(done, '다음 · ', '완주하면 다음 연습 없음');
  });

  test('4주 루틴: index.html과 sw.js에 새 파일이 들어 있다', function () {
    var hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string';
    if (!hasNode) return;
    var fs = require('fs'), path = require('path');
    var rootDir = root.__REPO_ROOT__;
    var index = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    var sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
    var app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    includes(index, 'js/routine.js', 'index.html 스크립트');
    includes(sw, "'./js/routine.js'", 'sw.js 캐시');
    ok(/var VERSION = 'bm-v1\.39\.0'/.test(sw), 'sw.js bm-v1.37.2');
    includes(app, "version: 'v1.39.0'", 'app.js v1.17.0');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
