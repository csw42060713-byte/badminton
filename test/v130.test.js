/* ============================================================
 * test/v130.test.js — bm-v1.37.2
 *   고도화 2차 사이클(ideas.md 3순위) + 코트 실사용 타이머
 *
 *   1) 원탭 21점/25점 코트 점수판 → 오늘 일지 자동 채움
 *      · 21점제(공식)·25점제(동호인) · 2점 차 · 최대 30점(29-29 → 30-29)
 *      · 내 팀 +1 / 상대 팀 +1 · 되돌리기 · 단식/복식 · 세트 누적
 *      · 세트가 끝나면 '오늘 일지에 넣기' → 게임 점수·한 줄 메모 자동 입력
 *
 *   2) 드릴 옆 원탭 카운트다운 타이머
 *      · AI 추천 드릴 · 부상 예방 워밍업 항목마다 ⏱ 3분 / ⏱ 5분
 *      · 시작/일시정지/초기화 · 한 번에 하나만(중복 타이머 방지)
 *
 *   실행: node test/run.js
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

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(opts) {
    clearStorage();
    if (!(opts && opts.empty)) U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: { key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night', avatar: '🦋' } },
      rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], gameMode: 21,
          games: [{ a: '', b: '' }], score: null, result: '', pain: [], weakness: [], note: ''
        }
      },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' }, chatRoom: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 30, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'p', 'span'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  /* n점을 한쪽으로 연속으로 넣기 */
  function rally(st, side, n) {
    var SB = BM.scoreboard;
    for (var i = 0; i < (n || 0); i++) st = SB.point(st, side);
    return st;
  }

  /* a:b까지 번갈아 치기 — 실제 랠리처럼 양쪽을 오갑니다 (한쪽만 몰아치면 세트가 먼저 끝남) */
  function mix(st, aTarget, bTarget) {
    var SB = BM.scoreboard;
    var a = 0, b = 0;
    while (a < aTarget || b < bTarget) {
      if (a < aTarget && (a <= b || b >= bTarget)) { st = SB.point(st, 'a'); a++; }
      else { st = SB.point(st, 'b'); b++; }
    }
    return st;
  }

  /* =========================================================
   * 1. 점수 규칙 — 21점제
   * ========================================================= */
  test('v1.30 점수: 21점제는 21점 + 2점 차에서 끝난다', function () {
    var SB = BM.scoreboard;
    var st = SB.create();
    eq(st.mode, 21, '기본 21점제');
    eq(st.type, '복식', '기본 복식');
    eq(st.a, 0, '내 팀 0');
    eq(st.b, 0, '상대 0');

    var s20 = mix(st, 20, 0);
    eq(SB.winner(s20), '', '20:0은 아직');
    var s21 = SB.point(s20, 'a');
    eq(SB.winner(s21), 'a', '21:0 → 세트 종료');
    eq(s21.over, 'a', 'over 표시');
    eq(SB.scoreText(s21), '21:0', '점수 문구');
  });

  test('v1.30 점수: 20-20 듀스는 2점 차가 나야 끝난다', function () {
    var SB = BM.scoreboard;
    var st = mix(SB.create(), 20, 20);
    eq(SB.winner(st), '', '20-20 아직');
    eq(SB.deuce(st), true, '듀스');
    var lead = SB.point(st, 'a');
    eq(SB.winner(lead), '', '21-20은 아직 (2점 차 아님)');
    eq(SB.matchPoint(lead), true, '세트 포인트');
    var done = SB.point(lead, 'a');
    eq(SB.winner(done), 'a', '22-20 → 끝');
    eq(SB.deuce(done), true, '끝난 순간에도 듀스 구간');
  });

  test('v1.30 점수: 29-29에서는 30점을 먼저 가져간 쪽이 이긴다', function () {
    var SB = BM.scoreboard;
    var st = mix(SB.create(), 29, 29);
    eq(SB.winner(st), '', '29-29 아직');
    var w = SB.point(st, 'b');
    eq(SB.winner(w), 'b', '30-29 → 상대 승');
    eq(SB.CAP, 30, '최대 30점');
    eq(w.b, 30, '상대 30');
  });

  test('v1.30 점수: 25점제는 25점 + 2점 차, 상한은 그대로 30점', function () {
    var SB = BM.scoreboard;
    var st = SB.create({ mode: 25 });
    eq(SB.target(st), 25, '25점제 목표');
    var s = mix(st, 25, 0);
    eq(SB.winner(s), 'a', '25:0 → 끝');

    var d = mix(SB.create({ mode: 25 }), 24, 24);
    eq(SB.deuce(d), true, '24-24 듀스');
    eq(SB.winner(d), '', '24-24 아직');
    eq(SB.winner(SB.point(d, 'a')), '', '25-24 아직');
    eq(SB.winner(rally(d, 'a', 2)), 'a', '26-24 → 끝');

    var cap = mix(SB.create({ mode: 25 }), 29, 29);
    eq(SB.winner(SB.point(cap, 'a')), 'a', '25점제도 30점에서 끝');
  });

  test('v1.30 점수: 단식·복식과 점수판 문구', function () {
    var SB = BM.scoreboard;
    eq(SB.normalType('단식'), '단식', '단식');
    eq(SB.normalType('이상한 값'), '복식', '모르는 값은 복식');
    eq(SB.normalMode('25'), 25, '문자열 25도 25점제');
    eq(SB.normalMode('abc'), 21, '모르는 값은 21점제');

    eq(SB.stateText(SB.create()).text, '21점제 · 2점 차 · 최대 30점', '시작 안내');
    var deuce = mix(SB.create(), 20, 20);
    eq(SB.stateText(deuce).kind, 'deuce', '듀스 표시');
    includes(SB.stateText(deuce).text, '2점 차', '듀스 안내');
    var over = SB.point(mix(SB.create(), 21, 19, 'a'), 'a');
    eq(SB.stateText(over).kind, 'over', '세트 종료 표시');
    includes(SB.stateText(over).text, '승', '이긴 쪽 표시');
  });

  /* =========================================================
   * 2. 되돌리기 · 세트 누적
   * ========================================================= */
  test('v1.30 되돌리기: 직전 점수로 돌아가고 세트 종료도 풀린다', function () {
    var SB = BM.scoreboard;
    var st = mix(mix(SB.create(), 20, 18), 0, 0);  /* 20:18 */
    var won = SB.point(st, 'a');
    eq(won.over, 'a', '세트 종료');
    var back = SB.undo(won);
    eq(back.a, 20, '내 점수 되돌림');
    eq(back.b, 18, '상대 점수 그대로');
    eq(back.over, '', '세트 종료가 풀려 이어서 칠 수 있음');
    eq(SB.undo(SB.create()).a, 0, '되돌릴 게 없으면 그대로');
  });

  test('v1.30 세트 누적: 다음 세트를 누르면 세트가 쌓이고 0:0으로', function () {
    var SB = BM.scoreboard;
    var s1 = mix(SB.create(), 21, 17);
    eq(SB.winner(s1), 'a', '1세트 내 팀 승');
    var s2 = SB.nextSet(s1);
    eq(s2.sets.length, 1, '끝난 세트 1개');
    eq(s2.sets[0].a + ':' + s2.sets[0].b, '21:17', '1세트 점수');
    eq(s2.a + s2.b, 0, '새 세트는 0:0');
    eq(s2.over, '', '진행 중');

    var lost = SB.nextSet(mix(s2, 19, 21));
    eq(lost.sets.length, 2, '2세트 쌓임');
    var sum = SB.summary(lost);
    eq(sum.count, 2, '2경기');
    eq(sum.wins, 1, '1승');
    eq(sum.losses, 1, '1패');
    eq(sum.result, '무', '1승 1패는 무');
    eq(sum.text, '21:17, 19:21', '점수 목록');
  });

  test('v1.30 계산: 원래 상태를 바꾸지 않는다 (순수 함수)', function () {
    var SB = BM.scoreboard;
    var st = mix(mix(SB.create(), 10, 9), 0, 0);
    var before = JSON.stringify(st);
    SB.point(st, 'a');
    SB.undo(st);
    SB.nextSet(st);
    SB.draftPatch(st, {});
    eq(JSON.stringify(st), before, '입력 상태 그대로');
  });

  test('v1.30 일지 채우기: 끝난 세트가 없으면 넣지 않는다', function () {
    var SB = BM.scoreboard;
    eq(SB.draftPatch(SB.create(), {}), null, '0:0은 넣지 않음');
    eq(SB.draftPatch(mix(SB.create(), 20, 5), {}), null, '진행 중인 세트만으로는 넣지 않음');
    var done = SB.nextSet(mix(SB.create(), 21, 17));
    var patch = SB.draftPatch(done, {});
    eq(patch.gameMode, 21, '점수제');
    eq(JSON.stringify(patch.games), '[{"a":21,"b":17}]', '게임 점수');
    eq(patch.result, '승', '결과');
    includes(patch.done.join(','), '게임', '완료 훈련에 게임');
    includes(patch.note, '코트 점수판', '메모 머리');
    includes(patch.note, '21:17', '메모에 점수');
    includes(patch.note, '복식', '메모에 종목');
  });

  test('v1.30 일지 채우기: 이미 쓴 메모·완료 훈련은 지우지 않는다', function () {
    var SB = BM.scoreboard;
    var st = SB.nextSet(mix(SB.create({ mode: 25, type: '단식' }), 25, 20));
    var patch = SB.draftPatch(st, { note: '오늘은 드라이브 연습', done: ['스트록'] });
    eq(patch.note, '오늘은 드라이브 연습', '기존 메모 유지');
    eq(patch.done.join(','), '스트록,게임', '완료 훈련에 게임만 더함');
    eq(patch.gameMode, 25, '25점제로 들어감');
    eq(patch.result, '승', '결과');
  });

  /* =========================================================
   * 3. 화면 — 일지 탭 버튼 · 점수판 시트
   * ========================================================= */
  test('v1.30 화면: 일지 탭 첫머리에 + 코트 점수판 버튼', function () {
    var html = BM.views.log.render(stateOf());
    checkHtml(html, '일지 화면');
    includes(html, 'data-act="open-scoreboard"', '점수판 버튼');
    includes(html, '코트 점수판', '버튼 이름');
    includes(html, 'courttool', '버튼 클래스');
    var hero = html.slice(0, html.indexOf('card--rtn'));
    includes(hero, 'data-act="open-scoreboard"', '히어로 카드 안(=화면 첫머리)');
  });

  test('v1.30 화면: 점수판 시트에 21/25점 · 단식/복식 · +1 버튼이 있다', function () {
    var SB = BM.scoreboard;
    var html = BM.views.log.scoreboardHtml(SB.create());
    checkHtml(html, '점수판 시트');
    includes(html, 'data-sb-point="a"', '내 팀 +1');
    includes(html, 'data-sb-point="b"', '상대 팀 +1');
    includes(html, 'data-sb-undo', '되돌리기');
    includes(html, 'data-sb-mode-val="21"', '21점제');
    includes(html, 'data-sb-mode-val="25"', '25점제');
    includes(html, 'data-sb-type-val="단식"', '단식');
    includes(html, 'data-sb-type-val="복식"', '복식');
    includes(html, '내 팀', '내 팀 이름');
    includes(html, '상대 팀', '상대 팀 이름');
    includes(html, '2점 차', '듀스 규칙 안내');
    includes(html, '한 세트를 마치면', '아직 넣을 수 없다는 안내');
    excludes(html, 'data-sb-save', '끝난 세트가 없으면 넣기 버튼 없음');
  });

  test('v1.30 화면: 세트가 끝나면 다음 세트 · 오늘 일지에 넣기', function () {
    var SB = BM.scoreboard;
    var st = mix(SB.create(), 21, 17);              /* 1세트 종료(아직 다음 세트 전) */
    eq(SB.winner(st), 'a', '1세트 종료 상태');
    var html = BM.views.log.scoreboardHtml(st);
    checkHtml(html, '세트 종료 화면');
    includes(html, 'data-sb-next', '다음 세트 버튼');
    includes(html, 'data-sb-save', '오늘 일지에 넣기');
    includes(html, '오늘 일지에 넣기', '버튼 글자');
    includes(html, '1세트', '끝난 세트');
    includes(html, '<b>21:17</b>', '세트 점수');
    includes(html, 'sb__res--w', '승 표시');

    var live = BM.views.log.scoreboardHtml(rally(SB.nextSet(st), 'b', 3));
    checkHtml(live, '2세트 진행 중');
    includes(live, 'data-sb-save', '진행 중이어도 1세트는 넣을 수 있음');
    excludes(live, 'data-sb-next', '진행 중에는 다음 세트 없음');
  });

  test('v1.30 화면: 단식은 나/상대, 25점제는 25점제로 그린다', function () {
    var SB = BM.scoreboard;
    var html = BM.views.log.scoreboardHtml(SB.create({ mode: 25, type: '단식' }));
    checkHtml(html, '단식 25점제');
    includes(html, '>나<', '단식은 나');
    includes(html, '>상대<', '단식은 상대');
    includes(html, '25점제', '점수제 표시');
    includes(html, 'is-on', '선택 상태 표시');
  });

  /* =========================================================
   * 4. 저장 — 일지 폼에 실제로 들어가고 저장된다
   * ========================================================= */
  test('v1.30 저장: 점수판 값을 일지 초안에 넣으면 일지에 그대로 저장된다', function () {
    return freshStore().then(function (store) {
      var SB = BM.scoreboard;
      var st = SB.nextSet(mix(SB.create(), 21, 18));
      var patch = SB.draftPatch(st, store.state.drafts.log);
      store.actions.setDraft(patch);
      eq(store.state.drafts.log.gameMode, 21, '초안 점수제');
      eq(store.state.drafts.log.games.length, 1, '초안 게임 수');
      includes(store.state.drafts.log.note, '코트 점수판', '초안 메모');

      var res = store.actions.saveLog();
      ok(res.ok, '저장 성공');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(res.entity.id); })[0];
      ok(row, '저장한 일지 행을 찾음');
      eq(row[D.COL['유형']], '기록', '기록 행');
      eq(row[D.COL['게임점수']], '21:18', '시트 게임점수 칸');
      eq(row[D.COL['승패']], '승', '승패');
      includes(row[D.COL['완료훈련']], '게임', '완료훈련');
      includes(row[D.COL['소셜글']], '코트 점수판', '메모');
      ok(res.analysis && res.analysis.score != null, 'AI 분석까지 이어짐');
      return store.flush();
    });
  });

  test('v1.30 저장: 25점제 두 세트도 시트 한 칸에 그대로', function () {
    return freshStore().then(function (store) {
      var SB = BM.scoreboard;
      var st = SB.nextSet(mix(SB.create({ mode: 25 }), 25, 23));
      st = SB.nextSet(mix(st, 21, 25));                       /* 2세트 상대 승 */
      var patch = SB.draftPatch(st, store.state.drafts.log);
      eq(patch.games.length, 2, '두 세트');
      eq(patch.result, '무', '1승 1패');
      store.actions.setDraft(patch);
      var res = store.actions.saveLog();
      ok(res.ok, '저장 성공');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(res.entity.id); })[0];
      ok(row, '저장한 일지 행을 찾음');
      eq(row[D.COL['게임점수']], '25점제 25:23, 21:25', '25점제 표기 + 두 경기');
      eq(row[D.COL['승패']], '무', '무승부');
      return store.flush();
    });
  });

  test('v1.30 보존: 점수판을 써도 기존 일지 입력칸·AI 카드는 그대로', function () {
    var st = stateOf();
    var html = BM.views.log.render(st);
    ['data-field="cond"', 'data-field="intensity"', 'data-field="minutes"', 'data-field="note"',
      'data-field="gameA"', 'data-act="save-log"', 'data-gamemode-val="21"', 'data-gamemode-val="25"'
    ].forEach(function (sel) { includes(html, sel, '기존 입력칸: ' + sel); });

    st.analysis = BM.ai.analyze({
      draft: st.drafts.log, records: st.data.records, level: 'C조', discipline: '복식', nick: '나래'
    });
    var an = BM.views.log.render(st);
    checkHtml(an, 'AI 카드');
    includes(an, 'data-region="analysis"', 'AI 카드 그대로');
    includes(an, 'data-fold="prevent"', '부상 예방 접기 그대로');
    includes(an, 'data-fold="guard"', '관절 보호 접기 그대로');
  });

  /* =========================================================
   * 5. 드릴 옆 타이머
   * ========================================================= */
  test('v1.30 타이머: 추천 드릴 3개와 워밍업 항목마다 3분·5분 버튼', function () {
    var st = stateOf();
    st.analysis = BM.ai.analyze({
      draft: { cond: 6, intensity: 6, minutes: 60, pain: ['어깨'], weakness: ['리시브'], discipline: '복식' },
      records: st.data.records, level: 'B조', nick: '나래'
    });
    ok(st.analysis.drills.drills.length === 3, '드릴 3개');
    var html = BM.views.log.analysisCard(st.analysis, st);
    checkHtml(html, 'AI 카드 타이머');
    eq((html.match(/data-timer-start=/g) || []).length, 14, '드릴 3개(6) + 워밍업 4개(8) = 14개 버튼');
    eq((html.match(/data-dtimer="drill:/g) || []).length, 3, '드릴마다 위젯');
    eq((html.match(/data-dtimer="warm:/g) || []).length, 4, '워밍업 항목마다 위젯');
    includes(html, '⏱ 3분', '3분 버튼');
    includes(html, '⏱ 5분', '5분 버튼');
    includes(html, 'data-timer-min="3"', '3분 값');
    includes(html, '5분 타이머 시작', '스크린리더용 이름');
    includes(html, 'data-dtimer-name=', '항목 이름 기억');
  });

  test('v1.30 타이머: 남은 시간 표기와 시작·일시정지·초기화', function () {
    var T = BM.timer;
    eq(T.fmt(180), '03:00', '3분');
    eq(T.fmt(59), '00:59', '1분 미만');
    eq(T.fmt(0), '00:00', '끝');
    eq(T.fmt(-5), '00:00', '음수 안전');

    T.reset();
    var res = T.start('drill:0', '하이클리어', 3, 1000);
    eq(res.timer.min, 3, '3분 타이머');
    eq(T.isOn('drill:0'), true, '그 항목이 켜짐');
    eq(T.isOn('drill:1'), false, '다른 항목은 꺼짐');
    eq(T.state(1000).left, 180, '시작하면 3분');
    eq(T.left(1000 + 60000), 120, '1분 지나면 120초');
    eq(T.fmt(T.left(1000 + 60000)), '02:00', '2분 남음');

    var paused = T.toggle(1000 + 60000);
    eq(paused.running, false, '일시정지');
    eq(T.left(1000 + 600000), 120, '멈춘 동안 줄지 않음');
    var resumed = T.toggle(1000 + 600000);
    eq(resumed.running, true, '이어서');
    eq(T.left(1000 + 660000), 60, '이어서 1분 뒤 60초');

    T.reset();
    eq(T.activeKey(), '', '초기화하면 없음');
    eq(T.state(), null, '상태 없음');
  });

  test('v1.30 타이머: 새로 시작하면 돌던 타이머는 멈춘다 (중복 방지)', function () {
    var T = BM.timer;
    T.reset();
    T.start('drill:0', '드릴1', 3, 1000);
    var second = T.start('warm:2', '발목 예열', 5, 2000);
    eq(second.replaced, true, '돌던 타이머를 멈춤');
    eq(T.isOn('warm:2'), true, '새 타이머만');
    eq(T.isOn('drill:0'), false, '이전 타이머는 꺼짐');
    eq(T.state().min, 5, '5분');
    eq(T.activeKey(), 'warm:2', '하나만');
    T.reset();
    eq(T.state(), null, '정리');
  });

  test('v1.30 타이머: 끝나면 짧은 진동·토스트로 알린다', function () {
    var T = BM.timer;
    var haptic = U.haptic;
    var toasted = [];
    var toast = BM.ui.toast;
    U.haptic = function (ms) { haptic.calls = haptic.calls || []; haptic.calls.push(ms); };
    BM.ui.toast = function (msg) { toasted.push(msg); };
    T.reset();
    T.start('drill:1', '풋워크', 5, 1000);
    T.finish();
    ok((haptic.calls || []).length > 0, '진동');
    ok(toasted.length === 1, '토스트 한 번');
    includes(toasted[0], '5분', '몇 분 타이머였는지');
    includes(toasted[0], '풋워크', '무엇을 하던 중이었는지');
    eq(T.state(), null, '타이머는 꺼짐');
    U.haptic = haptic;
    BM.ui.toast = toast;
  });

  test('v1.30 타이머 화면: 돌고 있는 항목만 시계로 바뀐다', function () {
    var T = BM.timer;
    T.reset();
    var idle = T.widget('drill:0', '드릴');
    includes(idle, '⏱ 3분', '시작 전에는 3분 버튼');
    includes(idle, 'data-dtimer-name="드릴"', '이름 기억');
    T.start('drill:0', '드릴', 3);
    var on = T.widget('drill:0', '드릴');
    includes(on, 'dtimer--on', '돌고 있음');
    includes(on, 'data-timer-display="drill:0"', '남은 시간');
    includes(on, 'data-timer-toggle="drill:0"', '일시정지 버튼');
    includes(on, 'data-timer-reset="drill:0"', '초기화 버튼');
    includes(on, '03:00', '3분 표시');
    excludes(on, 'data-timer-start', '시계일 때는 시작 버튼 없음');
    var other = T.widget('drill:1', '다른 드릴');
    includes(other, '⏱ 3분', '다른 항목은 그대로 시작 버튼');
    T.reset();
  });

  /* =========================================================
   * 6. 스타일 · 버전 · 문서
   * ========================================================= */
  test('v1.30 스타일: 점수판·타이머 클래스가 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.courttool', '.courttool__t', '.sb', '.sb__board', '.sb__num', '.sb__btn',
      '.sb__add', '.sb__sets', '.sb__foot', '.dtimer', '.dtimer__btn', '.dtimer__clock',
      '.dtimer__icon', '.dtimer--on', '.drill__foot', '.warm__text'].forEach(function (sel) {
      includes(css, sel, '클래스 정의: ' + sel);
    });
    includes(css, 'min-height: 74px', '큰 터치 버튼');
    includes(css, 'min-height: 30px', '타이머 버튼');
  });

  test('v1.30 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.63.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.63.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261124-1', 'index.html 스타일 캐시');
    includes(readRoot('index.html'), 'js/scoreboard.js', 'scoreboard 스크립트');
    includes(readRoot('index.html'), 'js/timer.js', 'timer 스크립트');
    includes(readRoot('sw.js'), "'./js/scoreboard.js'", '서비스워커 캐시: scoreboard');
    includes(readRoot('sw.js'), "'./js/timer.js'", '서비스워커 캐시: timer');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.63.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.63.0', 'TWA appVersion');
    eq(twa.appVersionCode, 57, 'TWA 버전 코드');
    includes(readRoot('index.html'), 'js/views/log.js', '일지 화면 파일 유지');
    includes(readRoot('sw.js'), "'./js/views/chat.js'", '서비스워커 캐시 목록 유지');
  });

  test('v1.30 문서: 아이디어 노트에 점수판·타이머가 반영으로 남는다', function () {
    if (!hasNode) return;
    var note = readRoot('ideas.md');
    includes(note, '코트 점수판', '아이디어 노트 항목');
    includes(note, 'v1.31.0', '반영 버전');
    includes(note, '타이머', '드릴 타이머');
  });

  test('v1.30 보안: 점수판·타이머 화면도 사용자 입력을 이스케이프한다', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var SB = BM.scoreboard;
    var st = SB.create();
    st.type = PAYLOAD;                    /* 비정상 값이 들어와도 */
    st.mode = 21;
    var html = BM.views.log.scoreboardHtml(st);
    excludes(html, '<img src=x', '점수판 이스케이프');
    var w = BM.timer.widget('drill:0', PAYLOAD);
    excludes(w, '<img src=x', '타이머 이스케이프');
    includes(w, '&lt;img src=x', '글자로 보임');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
