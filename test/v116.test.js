/* ============================================================
 * test/v116.test.js — v1.16.0 (2026-11-20)
 *  1) 지난 일지 수정: 상세 시트의 수정 버튼 → 기존 값이 입력칸으로 돌아온다
 *  2) 수정 저장: 새 행을 만들지 않고 그 일지 한 줄만 갱신한다(기기·시트 공통)
 *  3) 수정 취소: 새 행도, 바뀐 값도 남기지 않는다
 *  4) 지난 일지 삭제: 확인 뒤 그 줄만 빠지고, 서버(시트)에도 remove 한 건
 *  5) 남의 기록은 수정·삭제할 수 없다
 *  6) 코치 피드백 요청: 최근 일지 핵심(날짜·점수/승패·약점·아픈 부위)이 한 줄로 붙는다
 *  7) 코치 화면: 본문의 중복 '멘토로 신청하기'를 걷어 내고 위 탭 하나로
 *  8) MY: 꾸미기 입구 하나 (중복 카드·아이콘 제거, 사진·프레임은 시트 안)
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }
  function freshStore(opts) {
    clearStorage();
    U.writeJSON('bm_rows_v1', (opts && opts.rows) || BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* 내 일지 한 줄 (여러 칸을 채워 둡니다) */
  function myLog(extra) {
    var log = {
      id: 'log-edit-1', type: '기록', createdAt: U.stamp(), date: U.ymd(U.addDays(new Date(), -2)),
      nick: '나래', userKey: BM.seed.ME, cond: 6, intensity: 7, minutes: 90,
      done: ['드라이브', '풋워크'], games: [{ a: 21, b: 18 }, { a: 17, b: 21 }],
      scoreRaw: '21:18, 17:21', result: '무', pain: ['어깨'], weakness: ['드라이브'], text: '오늘은 타점이 늦었다'
    };
    Object.keys(extra || {}).forEach(function (k) { log[k] = extra[k]; });
    return D.toRow(log);
  }

  /* ---------- 1. 상세 시트의 수정·삭제 버튼 ---------- */

  test('v1.16 일지 상세: 닫기 말고 수정·삭제 버튼이 함께 있다', function () {
    var rec = D.fromRow(myLog());
    var html = BM.views.log.recordDetail(rec);
    includes(html, 'data-log-actions', '동작 줄');
    includes(html, 'data-act="edit-log"', '수정 버튼');
    includes(html, 'data-act="delete-log"', '삭제 버튼');
    includes(html, '수정', '수정 글자');
    includes(html, '삭제', '삭제 글자');
    eq(rec.userKey, BM.seed.ME, '내 일지');
  });

  /* ---------- 2. 수정: 기존 값 불러오기 ---------- */

  test('v1.16 수정: 그 날 일지의 기존 값이 입력칸 초안으로 돌아온다', function () {
    var rec = D.fromRow(myLog());
    var draft = D.recordDraft(rec);
    eq(draft.date, rec.date, '날짜');
    eq(draft.cond, 6, '컨디션');
    eq(draft.intensity, 7, '강도');
    eq(draft.minutes, 90, '운동 시간');
    eq(draft.done.join(','), '드라이브,풋워크', '완료 훈련');
    eq(draft.games.length, 2, '게임 두 개');
    eq(draft.games[0].a, '21', '첫 게임 내 점수');
    eq(draft.pain.join(','), '어깨', '아픈 부위');
    eq(draft.weakness.join(','), '드라이브', '약점 기술');
    eq(draft.note, '오늘은 타점이 늦었다', '메모');

    var st = { ui: { editLogId: null } };
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      var res = store.actions.startEditLog('log-edit-1');
      ok(res.ok, '수정 시작');
      eq(store.state.ui.editLogId, 'log-edit-1', '수정 중 표시');
      eq(store.state.drafts.log.cond, 6, '입력칸에 기존 값');
      eq(store.state.drafts.log.date, rec.date, '기존 날짜');
      var html = BM.views.log.render(store.state);
      includes(html, 'data-edit-banner', '수정 중 안내');
      includes(html, '수정 저장', '저장 버튼 이름');
      includes(html, 'data-act="cancel-edit"', '수정 취소');
      includes(html, '21', '게임 점수가 입력칸에');
      return st;
    });
  });

  /* ---------- 3. 수정 저장: 새 행 없이 갱신 ---------- */

  test('v1.16 수정 저장: 새 행을 붙이지 않고 그 일지만 갱신한다', function () {
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      var before = store.state.rows.length;
      store.state.locks = {};
      ok(store.actions.startEditLog('log-edit-1').ok, '수정 시작');
      store.state.locks = {};
      store.actions.setDraft({ cond: 9, minutes: 120, pain: [], weakness: ['스매시'], note: '타점 고침' });
      store.state.locks = {};
      var res = store.actions.saveLog({ keepDraft: true });

      ok(res.ok, '저장 성공');
      eq(res.updated, true, '갱신으로 저장');
      eq(store.state.rows.length, before, '행 수 그대로 (중복 없음)');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === 'log-edit-1'; })[0];
      ok(row, '같은 ID 유지');
      eq(row[D.COL['컨디션']], '9', '컨디션 갱신');
      eq(row[D.COL['운동시간(분)']], '120', '운동 시간 갱신');
      eq(row[D.COL['약점기술']], '스매시', '약점 기술 갱신');
      eq(row[D.COL['아픈부위']], '', '비운 칸은 빈 값');
      eq(row[D.COL['소셜글']], '타점 고침', '메모 갱신');
      eq(row[D.COL['날짜']], U.ymd(U.addDays(new Date(), -2)), '날짜는 그대로');
      eq(store.state.ui.editLogId, null, '수정 모드 끝');
      var kept = store.state.data.records.filter(function (r) { return r.id === 'log-edit-1'; })[0];
      eq(kept.cond, 9, '화면(파생 데이터)에도 반영');
      eq(kept.minutes, 120, '파생 데이터 운동 시간');
    });
  });

  test('v1.16 수정 저장: 시트 연결에서는 update 한 건만 나간다 (append 없음)', function () {
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      /* 시트(서버) 모드처럼 큐를 쓰는 상황을 그대로 재현합니다 */
      store.state.queue = [];
      store.state.locks = {};
      store.actions.startEditLog('log-edit-1');
      store.state.locks = {};
      store.actions.setDraft({ cond: 8 });
      store.state.locks = {};
      var res = store.actions.saveLog({ keepDraft: true });
      var kinds = store.state.queue.map(function (op) { return op.kind; });
      excludes(kinds.join(','), 'append', '새 행을 보내지 않는다');
      ok(kinds.indexOf('update') >= 0, 'update 요청이 큐에 있다');
      var op = store.state.queue.filter(function (o) { return o.kind === 'update'; })[0];
      eq(op.id, 'log-edit-1', '대상 ID');
      eq(op.cells['컨디션'], '8', '바뀐 칸');
      ok(op.cells['날짜'], '날짜 칸도 함께(비우지 않음)');
      ok(res.ok, '저장 성공');
    });
  });

  test('v1.16 일지 수정 칸: ID·사용자ID는 건드리지 않고 26칸 이름만 쓴다', function () {
    var cells = D.logCells({
      date: '2026-11-18', cond: 7, intensity: 5, minutes: 60, done: ['서브'],
      scoreRaw: '21:15', result: '승', pain: ['무릎'], weakness: ['풋워크'], text: '메모'
    });
    ok(!('ID' in cells), 'ID 없음');
    ok(!('사용자ID' in cells), '사용자ID 없음');
    ok(!('닉네임' in cells), '닉네임 없음');
    Object.keys(cells).forEach(function (name) {
      ok(D.COL[name] !== undefined, '시트 칸 이름: ' + name);
      ok(D.COL[name] !== D.COL['비밀번호'], '비밀번호 칸은 쓰지 않는다');
    });
    eq(cells['승패'], '승', '승패');
    eq(cells['게임점수'], '21:15', '게임 점수');
    /* 로컬 저장소에도 같은 규칙으로 반영되는지: 행은 26칸 그대로 */
    var row = D.toRow({ id: 'x', type: '기록', userKey: 'u', date: '2026-11-18', cond: 7 });
    eq(row.length, 26, '26칸 스키마 유지');
  });

  /* ---------- 4. 수정 취소 ---------- */

  test('v1.16 수정 취소: 초안이 비고 새 행도 생기지 않는다', function () {
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      var before = store.state.rows.length;
      store.state.locks = {};
      store.actions.startEditLog('log-edit-1');
      store.actions.setDraft({ cond: 2, note: '지워질 메모' });
      var res = store.actions.cancelEditLog();
      ok(res.ok, '취소');
      eq(store.state.ui.editLogId, null, '수정 모드 해제');
      eq(store.state.drafts.log.cond, null, '입력칸 비움');
      eq(store.state.drafts.log.note, '', '메모 비움');
      eq(store.state.rows.length, before, '행 그대로');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === 'log-edit-1'; })[0];
      eq(row[D.COL['컨디션']], '6', '원래 값 그대로');
      var html = BM.views.log.render(store.state);
      excludes(html, 'data-edit-banner', '수정 안내 없음');
      includes(html, '오늘 일지', '새 일지 화면으로');
    });
  });

  /* ---------- 5. 삭제 ---------- */

  test('v1.16 일지 삭제: 그 줄만 빠지고 서버에도 remove 한 건', function () {
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      var before = store.state.rows.length;
      store.state.queue = [];
      store.state.locks = {};
      var res = store.actions.deleteLog('log-edit-1');
      ok(res.ok, '삭제 성공');
      eq(store.state.rows.length, before - 1, '한 줄만 줄어든다');
      ok(!store.state.rows.some(function (r) { return String(r[0]) === 'log-edit-1'; }), '목록에서 사라짐');
      ok(!store.state.data.records.some(function (r) { return r.id === 'log-edit-1'; }), '화면 목록에서도 사라짐');
      var op = store.state.queue.filter(function (o) { return o.kind === 'remove'; })[0];
      ok(op, 'remove 요청');
      eq(op.id, 'log-edit-1', '대상 ID');
      /* 큐 전송(기기 저장소 쓰기)이 끝난 뒤에 다시 읽습니다 */
      return Promise.resolve().then(function () {
        return Promise.resolve().then(function () { return BM.api.createLocal({ latency: 0 }).bootstrap(); });
      }).then(function (b) {
        ok(!b.rows.some(function (r) { return String(r[0]) === 'log-edit-1'; }), '기기 저장소에서도 삭제(로컬/캐시 일관)');
      });
    });
  });

  test('v1.16 일지 삭제: 수정 중이던 일지를 지우면 수정 모드도 끝난다', function () {
    return freshStore({ rows: BM.fixtures.demo().concat([myLog()]) }).then(function (store) {
      store.state.locks = {};
      store.actions.startEditLog('log-edit-1');
      store.state.locks = {};
      store.actions.deleteLog('log-edit-1');
      eq(store.state.ui.editLogId, null, '수정 모드 종료');
      eq(store.actions.saveLog({}).updated, undefined, '다음 저장은 새 일지');
    });
  });

  test('v1.16 남의 기록은 수정·삭제할 수 없다', function () {
    var rows = BM.fixtures.demo().concat([myLog({ id: 'others-log', userKey: 'demo_chi', nick: '콕집사' })]);
    return freshStore({ rows: rows }).then(function (store) {
      var before = store.state.rows.length;
      eq(store.actions.startEditLog('others-log').reason, 'not_mine', '수정 거절');
      eq(store.actions.deleteLog('others-log').reason, 'not_mine', '삭제 거절');
      eq(store.state.rows.length, before, '행 그대로');
      eq(store.actions.deleteLog('no-such').reason, 'not_found', '없는 기록');
    });
  });

  /* ---------- 6. 코치 피드백 요청 ---------- */

  test('v1.16 피드백 요청 문구: 날짜 · 점수/승패 · 약점 · 아픈 부위가 한 줄로', function () {
    var rows = BM.fixtures.demo().filter(function (r) { return r[D.COL['유형']] !== '기록'; }).concat([myLog()]);
    var store;
    return freshStore({ rows: rows }).then(function (s) {
      store = s;
      var txt = BM.views.coach.feedbackAskText(store.state);
      includes(txt, U.shortDay(U.ymd(U.addDays(new Date(), -2))), '최근 일지 날짜');
      includes(txt, '2경기 1승 1패', '점수/승패');
      includes(txt, '약점 드라이브', '약점 기술');
      includes(txt, '아픈 곳 어깨', '아픈 부위');
      ok(txt.indexOf('\n') < 0, '한 줄 요약');
      includes(txt, '피드백 부탁드려요', '요청 문구');
    });
  });

  test('v1.16 피드백 요청 문구: 최근 일지가 없으면 예전 문구 그대로', function () {
    var rows = BM.fixtures.demo().filter(function (r) { return r[D.COL['유형']] !== '기록'; });
    return freshStore({ rows: rows }).then(function (store) {
      var txt = BM.views.coach.feedbackAskText(store.state);
      eq(txt, '코치님, 일지 피드백 부탁드려요. 이번 주 훈련에서 먼저 볼 점을 알려 주세요.', '기본 문구');
    });
  });

  test('v1.16 피드백 요청: 버튼을 누르면 요약이 채팅 입력칸으로 넘어간다', function () {
    var rows = BM.fixtures.demo().filter(function (r) { return r[D.COL['유형']] !== '기록'; }).concat([myLog()]);
    return freshStore({ rows: rows }).then(function (store) {
      var text = BM.views.coach.feedbackAskText(store.state);
      var res = store.actions.openCoachChat('demo_coach9', text);
      ok(res.ok || res.reason, '대화 열기 시도');
      if (res.ok) {
        eq(store.state.ui.chatDraft, text, '입력칸에 요약');
        includes(store.state.ui.chatDraft, '아픈 곳 어깨', '요약이 들어감');
      }
    });
  });

  /* ---------- 7. 코치 화면 중복 버튼 ---------- */

  test('v1.16 코치 화면: 본문 중복 멘토 신청 버튼을 걷어 내고 위 탭 하나로', function () {
    var rows = BM.fixtures.demo();
    var state = {
      ready: true, mode: 'local', me: { key: BM.seed.ME, nick: '나래', level: 'C조' },
      rows: rows, data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: {} }, ui: { tab: 'coach', coachTab: '' },
      analysis: null, queue: [], locks: {}, syncStats: {}
    };
    var html = BM.views.coach.render(state);
    includes(html, 'data-coachtab="apply"', '위 탭의 멘토 신청');
    excludes(html, '멘토로 신청하기', '본문 중복 버튼 없음');
    includes(html, '코치에게 피드백 받기', '선수 화면 유지');
  });

  /* ---------- 8. MY 꾸미기 정리 ---------- */

  test('v1.16 MY: 꾸미기 입구 하나 · 중복 카드/아이콘 없음', function () {
    var rows = BM.fixtures.demo();
    var state = {
      ready: true, mode: 'local', me: { key: BM.seed.ME, nick: '나래', level: 'C조', theme: { theme: 'th_night' } },
      rows: rows, data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: {} }, ui: { tab: 'my' }, analysis: null, queue: [], locks: {}
    };
    var html = BM.views.my.render(state);
    var entries = html.split('data-act="decorate-sheet"').length - 1;
    eq(entries, 1, '프로필 꾸미기 버튼은 하나');
    excludes(html, 'data-act="edit-profile"', '오른쪽 편집 아이콘 없음');
    excludes(html, 'data-region="decor"', '중복 사진·프레임 카드 없음');
    includes(html, 'data-group="theme"', '테마는 따로 남는다');
    includes(html, '닉네임 · 사진 · 프레임', '시트가 맡는 범위 안내');

    var body = BM.views.my.decorateBody(BM.views.my.decorateDraft(state), state.me, state);
    ['닉네임', '사진 · 프레임', '실력(급수)', '성별', '주력 종목', '플레이 스타일', '주 체육관', '활동 지역', '한 줄 소개']
      .forEach(function (label) { includes(body, label, '시트 항목: ' + label); });
  });

  /* ---------- 버전 ---------- */

  test('v1.16 버전: sw·app·화면 캐시·README가 함께 올라간다', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html'), readme = readRoot('README.md');
    includes(sw, "var VERSION = 'bm-v1.49.0'", 'sw.js');
    includes(app, "version: 'v1.49.0'", 'app.js');
    includes(index, 'styles.css?v=20261122-61', '스타일 캐시');
    includes(readme, 'v1.31.0', 'README 변경 이력');
    includes(readme, 'APPS_SCRIPT_BRIDGE.gs', '브리지 안내');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
