/* ============================================================
 * test/v140.test.js — bm-v1.40.0 (2026-11-21 18시)
 *
 *  사용자 기획 요청 2건:
 *   1) 처음 시작할 때 네 유형 중 하나 (초보 · 동호인 · 선수 · 코치) — MY에서 언제든 변경
 *   2) 선수용 7대 훈련(스트록·벽치기·코어·풋워크·스매시·상체·하체 근력운동) 체크 +
 *      '어떤 걸 했는지' 적는 칸 — 최근 기록에서 다시 보기
 *
 *   저장은 새 칸 없이: 유형 → 프로필 꾸미기 JSON(role),
 *   체크 → '완료훈련' 칸, 적은 내용 → '훈련계획' JSON(pro). 26칸 그대로.
 *  실행: node test/run.js
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
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_routine_pref_v1::demo_me', 'bm_pro_pref_v1::demo_me'].forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(opts) {
    clearStorage();
    if (!(opts && opts.empty)) U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: '선수부', discipline: '단식', bio: '', region: '경기', club: '나래울',
    theme: { theme: 'th_night', avatar: '🦋', role: 'player' }
  };

  function stateOf(patch, draftPatch) {
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: BM.fixtures.demo(),
      data: BM.store.derive(BM.fixtures.demo(), BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], pain: [], weakness: [], note: '', pro: {} } },
      routine: {}, routinePref: false, proPref: null,
      ui: { tab: 'log', editLogId: null, lastSavedLog: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (draftPatch) Object.keys(draftPatch).forEach(function (k) { st.drafts.log[k] = draftPatch[k]; });
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k === 'me') st.me = Object.assign({}, st.me, patch.me);
        else if (k === 'ui') st.ui = Object.assign({}, st.ui, patch.ui);
        else st[k] = patch[k];
      });
    }
    return st;
  }

  /* =========================================================
   * 1. 유형 정리 (초보 · 동호인 · 선수 · 코치)
   * ========================================================= */
  test('v1.40 유형: 네 가지만 남기고 모르는 값은 비운다', function () {
    eq(D.ROLES.length, 4, '네 유형');
    eq(D.ROLES.map(function (r) { return r.label; }).join(','), '초보,동호인,선수,코치', '표시 이름');
    eq(D.normalizeRole('초보'), 'beginner', '초보');
    eq(D.normalizeRole('동호인'), 'club', '동호인');
    eq(D.normalizeRole('선수'), 'player', '선수');
    eq(D.normalizeRole('코치'), 'coach', '코치');
    eq(D.normalizeRole('player'), 'player', 'id 그대로');
    eq(D.normalizeRole('지도자'), 'coach', '지도자 = 코치');
    eq(D.normalizeRole('일반인'), '', '모르는 값은 빈 값');
    eq(D.normalizeRole(null), '', 'null은 빈 값');
    eq(D.roleById('선수').id, 'player', 'id로 찾기');
    eq(D.roleById('없음'), null, '없는 유형은 null');
  });

  test('v1.40 유형: 프로필 JSON에서 읽고, 없으면 급수로 짐작만 한다', function () {
    eq(D.roleOf({ theme: { role: 'player' } }), 'player', '꾸미기 JSON의 role');
    eq(D.roleOf({ role: 'coach', theme: {} }), 'coach', 'me.role도 읽음');
    eq(D.roleOf({ theme: {} }), '', '저장된 값이 없으면 빈 값');
    eq(D.roleOf(null), '', 'me가 없어도 안전');
    eq(D.roleGuess('선수부'), 'player', '선수부 → 선수');
    eq(D.roleGuess('초심'), 'beginner', '초심 → 초보');
    eq(D.roleGuess('C조'), '', '동호인 급수는 짐작하지 않음(골라야 함)');
  });

  test('v1.40 표시: 7대 훈련 블록은 선수 유형이면 보이고, 스위치로 뒤집힌다', function () {
    eq(D.proVisible({ theme: { role: 'player' } }, null), true, '선수 + 따라감 → 보임');
    eq(D.proVisible({ theme: { role: 'club' } }, null), false, '동호인 + 따라감 → 숨김');
    eq(D.proVisible({ theme: { role: 'club' } }, true), true, '스위치 켜면 보임');
    eq(D.proVisible({ theme: { role: 'player' } }, false), false, '스위치 끄면 숨김');
  });

  /* =========================================================
   * 2. 7대 훈련 값 정리 · 저장 모양
   * ========================================================= */
  test('v1.40 7대 훈련: 일곱 항목 이름이 정해져 있다', function () {
    eq(D.proNames().join(','), '스트록,벽치기,코어,풋워크,스매시,상체 근력운동,하체 근력운동', '7항목');
    ok(D.proItemByName('상체 근력운동'), '이름으로 찾기');
    eq(D.proItemByName('웨이트'), null, '목록에 없는 이름은 null');
  });

  test('v1.40 7대 훈련: 모르는 항목은 버리고, 체크만 한 항목은 빈 값으로 남긴다', function () {
    var p = D.normalizePro({ '스트록': '클리어 100개', '웨이트': '벤치 60kg', '코어': '   ' });
    eq(Object.keys(p).join(','), '스트록,코어', '아는 항목만');
    eq(p['스트록'], '클리어 100개', '적은 내용');
    eq(p['코어'], '', '체크만 하면 빈 값(체크 기억)');
    eq(D.normalizePro(null)['스트록'], undefined, 'null 안전');
    var long = D.normalizePro({ '코어': new Array(200).join('가') });
    eq(long['코어'].length, D.PRO_MAX, '한 항목 상한(D.PRO_MAX)로 자름');
    eq(Object.keys(D.normalizePro('스트록,코어,웨이트')).join(','), '스트록,코어', '이름만 온 문자열도 읽음');
  });

  test('v1.40 7대 훈련: 일지 → plan.pro → 다시 읽기 (26칸 호환)', function () {
    var draft = { '스트록': '클리어 100개', '상체 근력운동': '풀업 4세트, 벤치프레스 60kg' };
    var plan = D.proPlan(draft);
    ok(plan && plan.pro, 'plan.pro로 감싼다');
    eq(plan.pro['상체 근력운동'], '풀업 4세트, 벤치프레스 60kg', '적은 내용');
    eq(D.proPlan({}), null, '아무것도 체크 안 하면 null');
    eq(D.proPlan(null), null, 'null 안전');

    var row = D.toRow({
      id: 'pro-1', type: '기록', createdAt: U.stamp(), date: U.ymd(), nick: '나래',
      userKey: 'u_1', done: ['스트록', '상체 근력운동'], plan: plan
    });
    eq(row.length, 26, '시트 26칸 그대로');
    includes(row[D.COL['훈련계획']], '"pro"', '훈련계획 칸에 pro');
    eq(row[D.COL['완료훈련']], '스트록,상체 근력운동', '체크는 완료훈련 칸');

    var rec = D.fromRow(row);
    eq(D.proOf(rec)['상체 근력운동'], '풀업 4세트, 벤치프레스 60kg', '다시 읽은 내용');
    eq(D.proCheckedNames(D.proOf(rec)).join(','), '스트록,상체 근력운동', '체크한 항목');
    includes(D.proLine(D.proOf(rec)), '상체 근력운동 풀업 4세트', '최근 기록 한 줄');
  });

  test('v1.40 7대 훈련: 지난 일지를 고치면 체크·적은 내용이 초안으로 돌아온다', function () {
    var rec = D.fromRow(D.toRow({
      id: 'pro-2', type: '기록', createdAt: U.stamp(), date: '2026-11-20', nick: '나래',
      userKey: 'u_1', done: ['코어', '하체 근력운동'],
      plan: { pro: { '코어': '플랭크 60초 × 3', '하체 근력운동': '스쿼트 80kg 5×5' } }
    }));
    var d = D.recordDraft(rec);
    eq(d.pro['코어'], '플랭크 60초 × 3', '코어 내용 복원');
    eq(d.pro['하체 근력운동'], '스쿼트 80kg 5×5', '하체 내용 복원');
    eq(d.done.join(','), '코어,하체 근력운동', '체크도 완료훈련에 남음');

    /* 수정 저장이 보내는 칸에도 훈련계획이 함께 간다(칸이 비면 비움) */
    var cells = D.logCells({ plan: { pro: { '코어': '플랭크' } } });
    includes(cells['훈련계획'], '"코어":"플랭크"', '수정 저장에 훈련계획');
    eq(D.logCells({})['훈련계획'], '', '체크한 항목이 없으면 칸을 비움');
  });

  /* =========================================================
   * 3. 저장소 — 일지 저장/수정 · 유형 저장
   * ========================================================= */
  test('v1.40 저장: 선수 7대 훈련이 시트 26칸에 그대로 담긴다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      store.actions.setDraft({
        done: ['스트록', '상체 근력운동'],
        pro: { '스트록': '클리어 100개', '상체 근력운동': '풀업 4세트, 벤치프레스 60kg' },
        minutes: 90, intensity: 8
      });
      var res = store.actions.saveLog();
      ok(res.ok, '저장 성공');
      var row = store.state.rows[0];
      eq(row.length, 26, '26칸');
      eq(row[D.COL['완료훈련']], '스트록,상체 근력운동', '완료훈련 칸');
      includes(row[D.COL['훈련계획']], '"상체 근력운동":"풀업 4세트, 벤치프레스 60kg"', '훈련계획 칸');
      var rec = D.fromRow(row);
      eq(D.proOf(rec)['스트록'], '클리어 100개', '읽어서 다시 보임');

      /* 저장 뒤 초안은 비워집니다 */
      eq(Object.keys(store.state.drafts.log.pro).length, 0, '저장 뒤 초안 비움');
      return store.flush();
    });
  });

  test('v1.40 저장: 지난 일지 수정은 새 행 없이 훈련계획만 바뀐다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      store.actions.setDraft({ pro: { '코어': '플랭크 60초 × 3' }, done: ['코어'] });
      var first = store.actions.saveLog();
      ok(first.ok, '첫 저장');
      var id = store.state.rows[0][0];
      eq(store.state.rows.length, 1, '행 1건');

      store.state.locks = {};
      var edit = store.actions.startEditLog(id);
      ok(edit.ok, '수정 모드 진입');
      eq(store.state.drafts.log.pro['코어'], '플랭크 60초 × 3', '수정 초안에 7대 훈련');
      store.state.locks = {};
      store.actions.setDraft({ pro: { '코어': '플랭크 90초 × 3', '풋워크': '사이드 스텝 10분 × 3' }, done: ['코어', '풋워크'] });
      var res = store.actions.saveLog();
      ok(res.ok && res.updated, '수정 저장');
      eq(store.state.rows.length, 1, '새 행이 생기지 않음');
      var row = store.state.rows[0];
      includes(row[D.COL['훈련계획']], '"플랭크 90초 × 3"', '고친 내용');
      includes(row[D.COL['훈련계획']], '"풋워크"', '새 항목');
      eq(row[D.COL['완료훈련']], '코어,풋워크', '완료훈련도 함께');
      return store.flush();
    });
  });

  test('v1.40 저장: 유형은 꾸미기 JSON(role)에만 담기고 시트 칸은 그대로다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      var res = store.actions.setRole('player');
      ok(res.ok && res.saved, '유형 저장');
      eq(store.state.me.role, 'player', '내 계정에 반영');
      var rows = store.state.rows.filter(function (r) { return r[1] === '프로필'; });
      eq(rows.length, 1, '프로필 행 1건');
      eq(rows[0].length, 26, '26칸 그대로');
      var theme = JSON.parse(rows[0][D.COL['꾸미기']] || '{}');
      eq(theme.role, 'player', '꾸미기 JSON의 role');
      ok(theme.avatar || theme.theme, '꾸미기 값은 유지');

      /* 유형을 바꾸면 4주 루틴·7대 훈련 표시도 따라 바뀝니다 */
      store.state.locks = {};
      var toClub = store.actions.setRole('club');
      ok(toClub.ok, '동호인으로 변경');
      eq(store.state.me.role, 'club', '유형 바뀜');
      eq(store.state.routinePref, false, '동호인은 4주 루틴 숨김');
      eq(D.proVisible(store.state.me, store.state.proPref), false, '7대 훈련 숨김');

      store.state.locks = {};
      store.actions.setRole('beginner');
      eq(store.state.routinePref, true, '초보는 4주 루틴 켜짐');
      eq(store.state.me.role, 'beginner', '초보');

      store.state.locks = {};
      store.actions.setRole('선수');
      eq(store.state.me.role, 'player', '한글 이름도 받음');
      eq(D.proVisible(store.state.me, store.state.proPref), true, '선수는 7대 훈련 보임');
      eq(store.state.routinePref, false, '선수는 4주 루틴 숨김');

      var bad = store.actions.setRole('일반인');
      eq(bad.ok, false, '모르는 유형은 거부');
      eq(bad.reason, 'unknown_role', '이유');
      return store.flush();
    });
  });

  test('v1.40 저장: 유형은 계정이 다시 불릴 때도 꾸미기 JSON에서 살아난다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      store.actions.setRole('coach');
      var row = store.state.rows.filter(function (r) { return r[1] === '프로필'; })[0];
      /* 다른 기기(= 새 저장소)가 같은 행을 받아 세운 me */
      var me = { key: BM.seed.ME, nick: '나래', theme: D.fromRow(row).theme };
      eq(D.roleOf(me), 'coach', '꾸미기 JSON만으로도 유형을 읽음');
      return store.flush();
    });
  });

  /* =========================================================
   * 4. 화면 — 온보딩 · MY · 일지
   * ========================================================= */
  test('v1.40 화면: 온보딩 첫 칸에 유형 카드 네 장이 있다', function () {
    ['bm_auth_v1', 'bm_accounts_v1', 'bm_auth_profile_v1', 'bm_session_v1'].forEach(function (k) { U.storage.removeItem(k); });
    var s = BM.views.start.state();
    s.screen = 'home'; s.mode = 'login'; s.error = ''; s.busy = false;
    s.draft = { email: '', password: '', nick: '' };
    s.onb = { nick: '', level: '', discipline: '', gender: '', region: '', club: '', role: '' };
    BM.auth.signInGoogle(BM.auth.DEMO_GOOGLE);
    var html = BM.views.start.renderOnboarding(BM.auth.session());
    ['beginner', 'club', 'player', 'coach'].forEach(function (id) {
      includes(html, 'data-pick="role" data-val="' + id + '"', '유형 카드: ' + id);
    });
    includes(html, '나는 어떤 유형인가요?', '유형 질문');
    includes(html, '처음 시작해요', '초보 안내');
    includes(html, '선수로 훈련하고 있어요', '선수 안내');
    includes(html, '7대 훈련 기록', '선수 카드 설명');
    includes(html, '코치·지도자예요', '코치 안내');
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'NaN', 'NaN 없음');
    BM.auth.signOut();
  });

  test('v1.40 화면: MY에 내 유형 카드와 유형 pill이 있고, 선수 스위치가 있다', function () {
    var html = BM.views.my.render(stateOf());
    includes(html, 'data-region="role"', '내 유형 카드');
    includes(html, '내 유형', '제목');
    ['beginner', 'club', 'player', 'coach'].forEach(function (id) {
      includes(html, 'data-role="' + id + '"', '유형 버튼: ' + id);
    });
    includes(html, 'rolepick--sm is-on', '지금 유형이 켜져 있음(선수)');
    includes(html, 'data-act="pro-pref-toggle"', '7대 훈련 스위치');
    includes(html, 'data-rolepill="player"', '프로필 줄 유형 pill');

    var none = BM.views.my.render(stateOf({ me: { theme: { theme: 'th_night', avatar: '🦋' }, level: 'C조' } }));
    includes(none, '아직 안 고름', '예전 계정은 아직 안 고름');
    excludes(none, 'rolepick is-on', '켜진 유형 없음');
    excludes(none, 'undefined', 'undefined 없음');
  });

  test('v1.40 화면: 선수 일지에 7대 훈련 일곱 줄과 세부 입력칸이 있다', function () {
    var html = BM.views.log.render(stateOf());
    includes(html, '선수 7대 훈련', '블록 제목');
    D.proNames().forEach(function (n) {
      includes(html, 'data-pro-toggle="' + n + '"', '항목: ' + n);
    });
    eq((html.match(/data-pro-note/g) || []).length, 7, '항목마다 입력칸');
    /* 아직 체크 전이라 입력칸은 접혀 있습니다 */
    eq((html.match(/class="pro__note[^"]*"[^>]*hidden/g) || []).length, 7, '체크 전에는 입력칸 숨김');
    excludes(html, 'data-chipgroup="done"', '선수 화면에는 완료 훈련 칩 줄이 없음');
  });

  test('v1.40 화면: 체크한 항목만 입력칸이 열리고 요약이 보인다', function () {
    var st = stateOf(null, { pro: { '상체 근력운동': '풀업 4세트, 벤치프레스 60kg' }, done: ['상체 근력운동'] });
    var html = BM.views.log.render(st);
    includes(html, 'value="풀업 4세트, 벤치프레스 60kg"', '적은 내용이 입력칸에');
    includes(html, '<li class="pro is-on" data-pro="상체 근력운동">', '체크된 줄 표시');
    includes(html, '<span class="pro__sum">풀업 4세트, 벤치프레스 60kg</span>', '오른쪽 요약');
    /* 체크 안 한 항목은 여전히 접힘 */
    includes(html, '<li class="pro" data-pro="코어">', '안 고른 항목은 체크 없음');
    includes(html, 'value="" placeholder="예: 플랭크 60초 × 3, 데드버그 10회 × 3" aria-label="코어 어떤 걸 했는지" hidden', '안 고른 항목은 접힘');
  });

  test('v1.40 화면: 초보·동호인 일지에는 7대 훈련이 뜨지 않는다', function () {
    var club = BM.views.log.render(stateOf({ me: { theme: { theme: 'th_night', role: 'club' }, level: 'C조' } }));
    excludes(club, 'data-pro-toggle', '동호인은 7대 훈련 없음');
    includes(club, 'data-chipgroup="done"', '동호인은 지금의 완료 훈련 칩');

    /* MY에서 스위치를 켜면 동호인도 7대 훈련을 씁니다 */
    var on = BM.views.log.render(stateOf({ me: { theme: { theme: 'th_night', role: 'club' }, level: 'C조' }, proPref: true }));
    includes(on, 'data-pro-toggle="코어"', '스위치를 켜면 보임');
  });

  test('v1.40 화면: 코치 유형은 일지 위에 코치 탭 안내가 붙는다', function () {
    var coach = BM.views.log.render(stateOf({ me: { theme: { theme: 'th_night', role: 'coach' }, level: 'B조' } }));
    includes(coach, 'data-region="rolehint"', '코치 안내 카드');
    includes(coach, 'data-act="go-coach"', '코치 탭 버튼');
    var player = BM.views.log.render(stateOf());
    excludes(player, 'data-region="rolehint"', '선수에게는 코치 안내 없음');
  });

  test('v1.40 화면: 최근 기록·상세에서 7대 훈련 내용을 다시 본다', function () {
    var row = D.toRow({
      id: 'pro-recent', type: '기록', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME,
      done: ['상체 근력운동'], plan: { pro: { '상체 근력운동': '풀업 4세트' } }, minutes: 80
    });
    var st = stateOf({ rows: [row], data: BM.store.derive([row], BM.seed.ME) });
    var html = BM.views.log.render(st);
    includes(html, 'logrow__pro', '최근 기록 7대 훈련 줄');
    includes(html, '상체 근력운동 풀업 4세트', '적은 내용');

    var detail = BM.views.log.recordDetail(D.fromRow(row));
    includes(detail, '선수 7대 훈련', '상세 제목');
    includes(detail, '풀업 4세트', '상세 내용');
    excludes(detail, 'undefined', 'undefined 없음');
  });

  test('v1.40 화면: 초보·동호인 화면에서도 지난 7대 훈련 이름이 칩에서 사라지지 않는다', function () {
    var st = stateOf({ me: { theme: { theme: 'th_night', role: 'club' }, level: 'C조' } },
      { done: ['상체 근력운동', '게임'], pro: { '상체 근력운동': '풀업 4세트' } });
    var html = BM.views.log.render(st);
    includes(html, 'data-chip="상체 근력운동"', '목록에 없는 이름도 칩으로 남김');
    includes(html, 'data-chip="게임"', '기존 칩도 그대로');
  });

  /* =========================================================
   * 5. 기존 동작 유지 — 연타 잠금 · 하단 고정 저장 바 · AI
   * ========================================================= */
  test('v1.40 유지: 일지 저장 연타 잠금(1.2초)과 AI 분석은 그대로다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      store.actions.setDraft({ pro: { '코어': '플랭크 60초 × 3' }, done: ['코어'], minutes: 40, cond: 7, intensity: 6 });
      var a = store.actions.saveLog();
      ok(a.ok, '첫 저장');
      var b = store.actions.saveLog();
      eq(b.ok, false, '연타는 막힘');
      eq(b.reason, 'locked', '이유 locked');
      eq(store.state.rows.length, 1, '중복 저장 없음');
      ok(store.state.analysis && store.state.analysis.score >= 0, 'AI 분석 카드');
      return store.flush();
    });
  });

  test('v1.40 유지: 화면 코드에 하단 고정 저장 바·초보자 루틴·친구 코드가 남아 있다', function () {
    if (!hasNode) return;
    var log = readRoot('js/views/log.js');
    includes(log, 'submit-wrap savebar', '하단 고정 저장 바');
    includes(log, 'routineBlock(state)', '초보자 4주 루틴 블록');
    includes(readRoot('js/views/my.js'), 'codeChip', '친구 코드 칩');
    includes(readRoot('js/views/community.js'), 'Date.now() - lastPostAt < 800', '커뮤니티 연타 무시');
  });

  /* =========================================================
   * 6. 버전 정합 · 문서 반영
   * ========================================================= */
  test('v1.40 버전: sw.js · app.js · twa-manifest.json이 1.40.1으로 맞는다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.72.0'", 'sw.js 캐시 버전');
    includes(readRoot('app.js'), "version: 'v1.72.0'", 'app.js 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.72.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.72.0', 'TWA appVersion');
    eq(twa.appVersionCode, 66, 'TWA 버전 코드(웹 자산만 바뀌어 유지)');
    includes(readRoot('index.html'), 'styles.css?v=20261125-1', '스타일 캐시 키');
  });

  test('v1.40 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md');
    includes(readme, 'v1.43.0', 'README 버전 절');
    includes(readme, '시작 4유형', 'README 유형 설명');
    includes(readme, '7대 훈련', 'README 7대 훈련 설명');
    includes(readRoot('ideas.md'), 'bm-v1.43.0', '아이디어 노트 상태');
    includes(readRoot('test/run.js'), 'test/v140.test.js', '테스트 실행 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
