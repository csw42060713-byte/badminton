/* ============================================================
 * test/routine-choice.test.js — 초보자 4주 루틴 '표시 선택' (2026-11-19)
 *  1) 아직 안 고름(null) · 보임(true) · 숨김(false) 세 상태가 계정별로 저장된다
 *  2) 일지 & AI: 안 고르면 선택 카드(시작하기/건너뛰기),
 *     켜면 체크리스트, 건너뛰면 카드가 통째로 사라진다
 *  3) MY: '초보자 4주 루틴 표시' 스위치로 언제든 켜고 끌 수 있다
 *  4) 이미 체크를 쓰던 기기는 묻지 않고 켜진 상태로 이어진다 (마이그레이션)
 *  5) 앱 state.routinePref가 없는 예전 화면 모양도 그대로 그려진다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, R = BM.routine;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_routine_v1::demo_me', 'bm_routine_pref_v1::demo_me',
      'bm_routine_v1::u_p_a', 'bm_routine_pref_v1::u_p_a',
      'bm_routine_v1::u_p_b', 'bm_routine_pref_v1::u_p_b']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(keep) {
    if (!keep) clearStorage();
    var rows = BM.fixtures ? BM.fixtures.demo() : BM.seed.build();
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* 일지 화면을 그릴 수 있는 최소 state (routine.test.js와 같은 모양) */
  function stateOf(routine, week, pref) {
    var rows = BM.fixtures ? BM.fixtures.demo() : BM.seed.build();
    var me = {
      key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식',
      bio: '소개', region: '경기', club: '나래울', theme: { theme: 'th_night' }
    };
    return {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, me.key, me),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
      routine: routine || {},
      routinePref: pref,
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

  /* ---------- 1. 저장 (3가지 상태) ---------- */
  test('루틴 선택: 아직 안 고름 · 보임 · 숨김 세 상태가 계정별로 저장된다', function () {
    clearStorage();
    eq(R.loadPref('u_p_a'), null, '처음엔 아직 안 고름');
    eq(R.savePref('u_p_a', true), true, '보임 저장');
    eq(R.loadPref('u_p_a'), true, '보임 유지');
    eq(R.loadPref('u_p_b'), null, '다른 계정은 따로');
    R.savePref('u_p_a', false);
    eq(R.loadPref('u_p_a'), false, '숨김 유지');
    eq(R.prefKeyFor('U_P_A'), 'bm_routine_pref_v1::u_p_a', '키 형식(소문자)');
    R.savePref('u_p_b', true);
    eq(R.loadPref('u_p_b'), true, 'B 계정은 보임');
    R.savePref('u_p_b', null);
    eq(R.loadPref('u_p_b'), null, 'null로 되돌리면 안 고름');
    eq(U.storage.getItem(R.prefKeyFor('u_p_b')), null, '저장 값도 지워짐');
  });

  test('루틴 선택: 체크 저장 키와 다른 키를 쓴다 (체크는 그대로)', function () {
    clearStorage();
    R.savePref('u_p_a', false);
    R.save('u_p_a', { w1_grip: true });
    eq(R.loadPref('u_p_a'), false, '숨김 선택 유지');
    eq(R.load('u_p_a').w1_grip, true, '체크는 따로 남는다');
    ok(R.prefKeyFor('u_p_a') !== R.keyFor('u_p_a'), '키가 겹치지 않는다');
  });

  /* ---------- 2. store ---------- */
  test('루틴 선택: store는 처음에 null · 고른 값은 새로고침해도 남는다', function () {
    return freshStore().then(function (s1) {
      eq(s1.state.routinePref, null, '처음엔 아직 안 고름');
      s1.actions.setRoutinePref(true);
      eq(s1.state.routinePref, true, '켜짐');
      return freshStore(true).then(function (s2) {
        eq(s2.state.routinePref, true, '새 store에서도 켜짐');
        s2.actions.setRoutinePref(false);
        return freshStore(true).then(function (s3) {
          eq(s3.state.routinePref, false, '새 store에서도 숨김');
          s3.actions.setRoutinePref(null);
          return freshStore(true).then(function (s4) {
            eq(s4.state.routinePref, null, '안 고름으로 되돌아감');
          });
        });
      });
    });
  });

  test('루틴 선택: 이미 체크를 쓰던 기기는 묻지 않고 켜진 상태로 이어진다', function () {
    return freshStore().then(function (s1) {
      s1.actions.toggleRoutine('w1_grip');
      U.storage.removeItem(R.prefKeyFor(s1.state.me.key));
      return freshStore(true).then(function (s2) {
        eq(s2.state.routinePref, true, '체크가 있으면 표시 중');
        eq(R.loadPref(s2.state.me.key), true, '기기에도 보임으로 저장');
        eq(s2.state.routine.w1_grip, true, '체크는 그대로');
      });
    });
  });

  /* ---------- 3. 일지 화면 ---------- */
  test('일지 화면: 아직 안 고르면 선택 카드만 보인다', function () {
    var html = BM.views.log.render(stateOf({}, 0, null));
    includes(html, 'data-region="routine"', '루틴 영역');
    includes(html, '초보자 4주 루틴, 같이 시작할까요?', '질문');
    includes(html, 'data-act="routine-start"', '시작 버튼');
    includes(html, '초보자 루틴 시작하기', '시작 버튼 이름');
    includes(html, 'data-act="routine-skip"', '건너뛰기 버튼');
    includes(html, '괜찮아요, 건너뛰기', '건너뛰기 이름');
    includes(html, '나중에 MY에서 언제든 켜고 끌 수 있어요', '되돌릴 수 있다는 안내');
    excludes(html, 'data-rtn-item', '아직 체크리스트는 없다');
    excludes(html, 'data-rtn>', '접힌 루틴 카드도 없다');
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'NaN', 'NaN 없음');
    checkTags(html, '선택 카드');
  });

  test('일지 화면: 켜면 체크리스트 · 끄면 카드가 사라진다', function () {
    var on = BM.views.log.render(stateOf({}, 0, true));
    includes(on, 'data-rtn-item="w1_grip"', '체크리스트');
    includes(on, 'data-rtn>', '접힌 한 줄 요약');
    excludes(on, 'data-act="routine-start"', '선택 카드는 없다');

    var off = BM.views.log.render(stateOf({}, 0, false));
    excludes(off, 'data-region="routine"', '루틴 영역 없음');
    excludes(off, '초보자 4주 루틴', '루틴 카드 없음');
    excludes(off, 'data-act="routine-start"', '선택 카드도 없음');
    includes(off, 'data-form="log"', '일지 입력은 그대로');
  });

  test('일지 화면: routinePref가 없는 예전 state는 체크리스트로 그린다', function () {
    var st = stateOf({}, 0, true);
    delete st.routinePref;
    var html = BM.views.log.render(st);
    includes(html, 'data-rtn-item="w1_grip"', '예전과 같은 체크리스트');
    excludes(html, 'data-act="routine-start"', '선택 카드는 없다');
  });

  /* ---------- 4. MY 스위치 ---------- */
  test('MY: 루틴 표시 스위치가 상태에 맞게 그려진다', function () {
    return freshStore().then(function (s) {
      var ask = BM.views.my.render(s.state);
      includes(ask, '초보자 4주 루틴 표시', '스위치 이름');
      includes(ask, 'role="switch"', '스위치 역할');
      includes(ask, 'data-act="routine-pref-toggle"', '스위치 동작');
      includes(ask, 'aria-checked="false"', '아직 안 고름은 꺼짐');
      includes(ask, '아직 안 고름', '상태 배지');
      includes(ask, '아직 시작할지 고르지 않았어요', '안내');

      s.actions.setRoutinePref(true);
      var on = BM.views.my.render(s.state);
      includes(on, 'aria-checked="true"', '켜짐');
      includes(on, '표시 중', '상태 배지');
      includes(on, 'switch is-on', '켜진 스위치 모양');

      s.actions.setRoutinePref(false);
      var off = BM.views.my.render(s.state);
      includes(off, 'aria-checked="false"', '꺼짐');
      includes(off, '숨김', '상태 배지');
      includes(off, '숨겨 둔 상태예요', '안내');
      excludes(off, 'undefined', 'undefined 없음');
    });
  });

  test('MY: 스위치를 켜고 끄면 일지 화면도 따라 바뀐다', function () {
    return freshStore().then(function (s) {
      includes(BM.views.log.render(s.state), 'data-act="routine-start"', '처음엔 선택 카드');
      s.actions.setRoutinePref(true);
      includes(BM.views.log.render(s.state), 'data-rtn-item', '켜면 체크리스트');
      s.actions.setRoutinePref(false);
      excludes(BM.views.log.render(s.state), 'data-region="routine"', '끄면 카드 없음');
      s.actions.setRoutinePref(true);
      includes(BM.views.log.render(s.state), 'data-rtn-item', '다시 켜면 체크리스트');
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
