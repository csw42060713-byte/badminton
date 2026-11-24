/* ============================================================
 * test/v139_1.test.js — bm-v1.39.1 (2026-11-21 17시 버그 수정)
 *
 *  사용자가 직접 겪은 버그: 커뮤니티에서 말머리 '게스트 모집'을 고르고
 *  아래 모집 칸(언제·몇 명·어디 체육관)만 채운 뒤, 위 한 줄 입력칸을 비운 채
 *  '올리기'를 누르면 "내용을 입력해 주세요"로 막혔습니다.
 *
 *  1) 모집 정보만 있으면 본문이 비어도 글을 올린다 (시트 26칸 그대로)
 *  2) 본문도 모집 칸도 비면 지금처럼 empty로 막는다
 *  3) 화면 — 빈 본문 문단을 그리지 않고, 모집 카드와 작성칸 안내가 자연스럽다
 *  4) 버전 정합(bm-v1.39.1 · appVersionCode 38 유지) · 문서 반영
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

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], pain: [], weakness: [], note: '' } },
      ui: {
        tab: 'community', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function meetOnlyRow(over) {
    over = over || {};
    return D.toRow({
      id: over.id || 'meet-only-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '코트지기', text: over.text == null ? '' : over.text, userKey: over.userKey || 'u_other',
      plan: { topic: '게스트 모집', meet: over.meet || { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }
    });
  }

  /* =========================================================
   * 1. 본문 없이 모집 정보만 → 정상 등록
   * ========================================================= */
  test('v1.39.1 모집: 본문 없이 모집 칸만 채워도 글이 올라간다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('게스트 모집');
      store.actions.setComposerMeet('when', '11/21(금) 19:00');
      store.actions.setComposerMeet('place', '올림픽체육관');
      store.actions.setComposerMeet('cap', '6');
      var res = store.actions.createPost('', '게스트 모집', store.state.ui.composerMeet);
      ok(res.ok, '막히지 않고 등록');
      eq(res.reason, undefined, 'empty 거부 없음');
      eq(res.topic, '게스트 모집', '말머리 게스트 모집');
      ok(res.meet, '모집 정보 함께 반환');
      eq(res.meet.when, '11/21(금) 19:00', '언제');
      eq(res.meet.place, '올림픽체육관', '어디');
      eq(res.meet.cap, '6', '몇 명');

      eq(store.state.rows.length, 1, '행 1건 저장');
      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸 그대로');
      eq(row[D.COL['유형']], '소셜', '유형 소셜');
      eq(row[D.COL['소셜글']], '', '본문 칸은 비어 있음');
      includes(row[D.COL['훈련계획']], '"topic":"게스트 모집"', '훈련계획 칸에 말머리');
      includes(row[D.COL['훈련계획']], '"meet"', '훈련계획 칸에 모집 정보');

      var post = store.state.data.posts[0];
      eq(post.text, '', '목록 본문도 빈 값');
      eq(post.topic, '게스트 모집', '목록 말머리');
      eq(post.meet.place, '올림픽체육관', '목록 장소');

      /* 다른 기기(시트)에서 다시 읽어도 그대로 */
      var back = D.fromRow(row);
      eq(D.topicOf(back), '게스트 모집', '다시 읽은 말머리');
      eq(D.meetOf(back).when, '11/21(금) 19:00', '다시 읽은 언제');

      /* 올리면 작성칸은 비워집니다 */
      eq(store.state.ui.composerTopic, '자유', '말머리 초기화');
      eq(store.state.ui.composerMeet.when, '', '모집칸 초기화');
      return store.flush();
    });
  });

  test('v1.39.1 모집: 공백만 있는 본문 + 모집 정보도 올라간다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var res = store.actions.createPost('   \n  ', '게스트 모집', { when: '11/22(토) 09:00', place: '수원체육관', cap: '4' });
      ok(res.ok, '공백 본문은 빈 것으로 보고 모집 정보로 등록');
      eq(store.state.data.posts[0].text, '', '본문은 빈 값으로 정리');
      eq(store.state.data.posts[0].meet.cap, '4', '인원 유지');
      return store.flush();
    });
  });

  test('v1.39.1 모집: 본문·모집 칸 둘 다 비면 지금처럼 empty로 막는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var a = store.actions.createPost('', '게스트 모집', { when: '', place: '', cap: '' });
      eq(a.ok, false, '빈 글 거부');
      eq(a.reason, 'empty', '이유 empty');
      eq(store.state.rows.length, 0, '행이 생기지 않음');

      var b = store.actions.createPost('   ', '게스트 모집', { when: '  ', place: ' ', cap: 'abc' });
      eq(b.ok, false, '공백·숫자 없는 칸도 빈 값');
      eq(store.state.rows.length, 0, '행이 생기지 않음');
      return store.flush();
    });
  });

  test('v1.39.1 모집: 다른 말머리면 본문이 비었을 때 모집 칸만으로 올리지 않는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var res = store.actions.createPost('', '자유', { when: '11/21', place: '체육관', cap: '4' });
      eq(res.ok, false, '자유 말머리는 본문 필요');
      eq(res.reason, 'empty', '이유 empty');
      eq(store.state.rows.length, 0, '행이 생기지 않음');
      return store.flush();
    });
  });

  /* =========================================================
   * 2. 화면 — 빈 본문 문단 · 작성칸 안내
   * ========================================================= */
  test('v1.39.1 화면: 본문 없는 모집 글은 빈 문단 없이 모집 카드만 보여 준다', function () {
    var st = stateOf([meetOnlyRow()]);
    var html = BM.views.community.render(st);
    excludes(html, '<p class="post__text"></p>', '빈 본문 문단을 그리지 않음');
    includes(html, '올림픽체육관', '모집 카드 장소');
    includes(html, '11/21(금) 19:00', '모집 카드 언제');
    includes(html, '게스트 모집', '말머리');
    ok(html.indexOf('vite__info') > 0, '모집 카드가 그려짐');
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'NaN', 'NaN 없음');
  });

  test('v1.39.1 화면: 본문이 있는 모집 글은 지금처럼 본문을 보여 준다', function () {
    var st = stateOf([meetOnlyRow({ text: '금요일 저녁 같이 하실 분!' })]);
    var html = BM.views.community.render(st);
    includes(html, '<p class="post__text">금요일 저녁 같이 하실 분!</p>', '본문 문단 유지');
  });

  test('v1.39.1 안내: 게스트 모집을 고르면 입력칸 안내가 모집용으로 바뀐다', function () {
    var free = BM.views.community.render(stateOf([]));
    includes(free, 'placeholder="오늘 경기 어땠어요? 한 줄 남겨보세요"', '기본 안내');
    excludes(free, '비워 두어도 올라가요"', '기본일 때는 모집 안내 없음');

    var meet = BM.views.community.render(stateOf([], { ui: { composerTopic: '게스트 모집' } }));
    includes(meet, 'placeholder="게스트 모집 한마디 (비워 두어도 올라가요)"', '모집용 안내');
  });

  /* =========================================================
   * 3. 기존 동작 유지 — 연타 방지 · 말머리 초기화
   * ========================================================= */
  test('v1.39.1 유지: 모집 글도 연타 잠금(1.2초)은 그대로다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var a = store.actions.createPost('', '게스트 모집', { when: '11/21', place: '체육관', cap: '4' });
      ok(a.ok, '첫 글 등록');
      var b = store.actions.createPost('', '게스트 모집', { when: '11/22', place: '다른 체육관', cap: '5' });
      eq(b.ok, false, '연타는 막힘');
      eq(b.reason, 'locked', '이유 locked');
      eq(store.state.rows.length, 1, '중복 저장 없음');
      return store.flush();
    });
  });

  test('v1.39.1 유지: 화면의 올리기 연타 무시(0.8초)는 그대로 있다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/community.js');
    includes(src, 'Date.now() - lastPostAt < 800', '0.8초 연타 무시');
    includes(src, 'lastPostAt = Date.now()', '성공 뒤에만 시각 기록');
    includes(src, "UI.toast('내용을 입력해 주세요')", '빈 칸 안내는 유지');
  });

  /* =========================================================
   * 4. 버전 정합 · 문서 반영
   * ========================================================= */
  test('버전: sw.js · app.js · twa-manifest.json이 지금 버전으로 맞는다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.64.0'", 'sw.js 캐시 버전');
    includes(readRoot('app.js'), "version: 'v1.64.0'", 'app.js 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.64.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.64.0', 'TWA appVersion');
    eq(twa.appVersionCode, 58, 'TWA 버전 코드(웹 자산만 바뀌어 유지)');
  });

  test('v1.39.1 문서: README·아이디어 노트에 이번 수정이 남는다', function () {
    if (!hasNode) return;
    includes(readRoot('README.md'), 'v1.39.1', 'README v1.39.1 절 유지');
    includes(readRoot('README.md'), '게스트 모집', 'README 기능 설명');
    includes(readRoot('ideas.md'), 'bm-v1.39.1', '아이디어 노트 상태');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
