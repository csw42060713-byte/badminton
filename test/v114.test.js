/* ============================================================
 * test/v114.test.js — v1.14.0 (2026-11-19)
 *  1) 매칭 찾기: 처음엔 아무 조건도 고르지 않은 안내 카드만 보이고,
 *     '전체' 또는 급수·지역·종목·성별·검색어를 골라야 선수 목록이 나온다
 *  2) 매칭 편지지: 카드 어디를 눌러도 상세 편지지(보낸 사람 정보·한마디 전문·
 *     수락 시 하트 2개 차감 안내·거절/수락)로 들어가고, 수락 뒤에는 1:1 대화로 이어진다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

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

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', gender: '비공개', style: '공격형',
    theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(rows, extra) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: {
        tab: 'matching',
        matchFilter: { level: '', gender: '', region: '', discipline: '', query: '' },
        matchStarted: false,
        matchTab: 'find', matchSort: 'score', matchFilterOpen: '',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (extra) {
      Object.keys(extra).forEach(function (k) { st.ui[k] = extra[k]; });
    }
    return st;
  }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function hasNode() { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }

  /* ---------- 1. 찾기: 조건을 골라야 목록이 나온다 ---------- */

  test('v1.14 찾기: 처음에는 목록 대신 안내 카드만 보인다', function () {
    var st = stateOf();
    var html = BM.views.matching.render(st);
    includes(html, 'matchintro', '안내 카드');
    includes(html, '원하는 급수·조건이나', '안내 문구');
    includes(html, '전체', '전체 안내');
    includes(html, '원하는 급수·조건이나 <b>전체</b>를 눌러 선수를 찾아보세요', '문구 그대로');
    includes(html, 'data-act="show-all"', '전체 보기 버튼');
    excludes(html, 'class="pcard"', '선수 카드는 아직 없음');
    excludes(html, 'class="pcards"', '선수 목록 없음');
    excludes(html, '명 찾음', '결과 수 없음');
  });

  test('v1.14 찾기: 전체를 누르면 조건 없이 모든 선수가 나온다', function () {
    var st = stateOf();
    st.ui.matchStarted = true;
    var html = BM.views.matching.render(st);
    excludes(html, 'matchintro', '안내 카드 사라짐');
    includes(html, 'class="pcards"', '선수 목록');
    includes(html, 'class="pcard"', '선수 카드');
    includes(html, '명 찾음', '결과 수');
    ok(BM.views.matching.visiblePlayers(st).length > 0, '보이는 선수 있음');
    /* '전체' 버튼이 선택 상태로 보입니다 */
    includes(html, 'class="fall is-on" data-act="show-all"', '전체 선택 표시');
  });

  test('v1.14 찾기: 급수를 고르면 그 순간 목록이 나오고 그 급수만 보인다', function () {
    var st = stateOf();
    st.ui.matchFilter.level = 'C조';
    st.ui.matchStarted = true;
    var list = BM.views.matching.visiblePlayers(st);
    ok(list.length > 0, '선수 있음');
    ok(list.every(function (p) { return D.normalizeGrade(p.level) === 'C조'; }), 'C조만');
    var html = BM.views.matching.render(st);
    excludes(html, 'matchintro', '안내 카드 사라짐');
    includes(html, '명 찾음', '결과 수');
  });

  test('v1.14 찾기: 검색어를 넣으면 목록, 지우면 조건이 없을 때 처음 화면으로 돌아온다', function () {
    return freshStore().then(function (store) {
      eq(store.state.ui.matchStarted, false, '처음엔 미선택');
      store.actions.setMatchQuery('나래');
      eq(store.state.ui.matchStarted, true, '검색어를 넣으면 시작');
      store.actions.setMatchQuery('');
      eq(store.state.ui.matchStarted, false, '검색어를 지우면 처음 화면');
      /* 조건이 남아 있으면 검색어를 지워도 목록은 그대로 */
      store.actions.setFilter({ level: 'C조' });
      store.actions.setMatchQuery('셔틀');
      store.actions.setMatchQuery('');
      eq(store.state.ui.matchStarted, true, '조건이 있으면 목록 유지');
      /* 조건 초기화는 다시 미선택 상태 */
      store.actions.clearMatchFilter();
      eq(store.state.ui.matchStarted, false, '조건 초기화 → 미선택');
      eq(store.state.ui.matchFilter.level, '', '조건 비움');
      /* '전체'는 조건을 비우고 선택된 상태 */
      store.actions.setFilter({ level: 'A조', region: '서울' });
      store.actions.resetMatchFilter();
      eq(store.state.ui.matchStarted, true, '전체 선택');
      eq(D.activeFilters(store.state.ui.matchFilter).length, 0, '조건 없음');
    });
  });

  test('v1.14 찾기: domain.matchSearchActive — 예전 화면 상태도 읽는다', function () {
    eq(D.matchSearchActive({ level: 'C조' }, false), false, '플래그가 우선');
    eq(D.matchSearchActive({ level: '', query: '' }, false), false, '미선택');
    eq(D.matchSearchActive({ level: '', query: '' }, true), true, '전체 선택');
    eq(D.matchSearchActive({ level: '전체', gender: '전체' }), true, '예전 상태: 전체라도 목록');
    eq(D.matchSearchActive({ level: '', gender: '' }), false, '예전 상태: 빈 값은 안내');
  });

  test('v1.14 찾기: 처음엔 필터 칩도 아무것도 선택되지 않는다', function () {
    var st = stateOf();
    st.ui.matchFilterOpen = 'level';
    var html = BM.views.matching.render(st);
    excludes(html, 'chip chip--sm chip--all is-on" data-filter="level"', '급수 전체 미선택');
    excludes(html, 'class="fall is-on"', '전체 버튼 미선택');
    st.ui.matchStarted = true;
    var html2 = BM.views.matching.render(st);
    includes(html2, 'chip chip--sm chip--all is-on" data-filter="level"', '전체 누르면 선택 표시');
  });

  /* ---------- 2. 편지지 카드 · 상세 ---------- */

  function incomingOf(state) {
    return (state.data.requests || []).filter(function (r) {
      return r.target === BM.seed.ME && r.status === '대기';
    })[0];
  }

  test('v1.14 편지지: 받은 요청 카드는 어디를 눌러도 상세 편지지로 들어간다', function () {
    var st = stateOf();
    st.ui.matchTab = 'in';
    var r = incomingOf(st);
    ok(r, '받은 요청 있음');
    var html = BM.views.matching.render(st);
    includes(html, 'data-letter="' + r.id + '" data-open-letter="' + r.id + '"', '카드 전체가 편지지 열기');
    includes(html, '눌러서 편지지 열기', '열기 힌트');
    includes(html, 'data-accept="' + r.id + '"', '카드 안 수락 버튼');
    includes(html, 'data-decline="' + r.id + '"', '카드 안 거절 버튼');
    includes(html, '평일 저녁 어때요?', '한 줄 미리보기');
    includes(html, '매칭 요청', '봉투 표시');
    /* 카드 자체는 프로필 시트로 바로 가지 않습니다(내부 버튼과 충돌 없이 편지지로) */
    var card = html.split('data-letter="' + r.id + '"')[1].split('</article>')[0];
    excludes('data-letter="' + r.id + '"' + card, 'data-open-profile', '카드에 프로필 직접 열기 없음');
  });

  test('v1.14 편지지 상세: 보낸 사람 정보·한마디 전문·하트 안내·거절/수락', function () {
    var st = stateOf();
    var r = incomingOf(st);
    var body = BM.views.matching.letterBody(st, r);
    includes(body, 'lettermail', '상세 편지지');
    includes(body, '셔틀버스', '보낸 사람');
    includes(body, '평일 저녁 어때요?', '한마디 전문');
    includes(body, '주 체육관', '주 체육관');
    includes(body, '플레이 스타일', '플레이 스타일');
    includes(body, '급수', '급수');
    includes(body, '수락하면 보낸 분 하트 <b>2개 차감</b>', '하트 2개 차감 안내');
    includes(body, '<span>수락하면 보낸 분 하트', '안내 문장은 한 덩어리로');
    includes(body, 'data-decline="' + r.id + '"', '거절');
    includes(body, 'data-accept="' + r.id + '"', '수락');
    includes(body, '수락하고 대화하기', '수락 버튼 글자');
    includes(body, 'data-open-profile="demo_suttle"', '프로필 자세히 보기');
  });

  test('v1.14 편지지 상세: 수락한 편지는 1:1 대화방으로 이어진다', function () {
    return freshStore().then(function (store) {
      var r = (store.state.data.requests || []).filter(function (x) {
        return x.target === BM.seed.ME && x.status === '대기';
      })[0];
      var res = store.actions.respondMatch(r.id, '수락');
      ok(res.ok, '수락 처리');
      eq(res.roomId, r.id, '요청 ID가 곧 대화방 ID');
      var thread = (store.state.data.threads || []).filter(function (t2) { return String(t2.roomId) === String(r.id); })[0];
      ok(thread, '대화 목록에 방이 생김');
      ok(D.canChatWith(store.state.idx, BM.seed.ME, r.userKey), '대화 가능');
      var body = BM.views.matching.letterBody(store.state, store.state.data.requests.filter(function (x) { return x.id === r.id; })[0]);
      includes(body, '1:1 대화방 열기', '대화방 열기 버튼');
      includes(body, 'data-open-chat="' + r.id + '"', '방 번호 연결');
      excludes(body, 'data-accept="' + r.id + '"', '다시 수락 버튼 없음');
      /* 받은 요청 탭에 '수락한 요청'으로 남아 다시 들어갈 수 있음 */
      store.actions.setMatchTab('in');
      var html = BM.views.matching.render(store.state);
      includes(html, '수락한 요청', '수락한 요청 묶음');
      includes(html, 'data-open-chat="' + r.id + '"', '대화 버튼');
      includes(html, 'letter--done', '수락 표시');
    });
  });

  test('v1.14 편지지: 채팅 패널의 받은 요청도 같은 편지지 카드를 쓴다', function () {
    if (!hasNode()) return;
    var ch = readRoot('js/views/chat.js');
    includes(ch, 'matchLetters', '채팅 패널 편지지');
    includes(ch, 'BM.views.matching.letterHtml', '같은 카드 재사용');
    includes(ch, '[data-open-letter]', '카드 누르면 상세 편지지');
    includes(ch, 'openLetterSheet', '상세 편지지 연결');
  });

  test('v1.14 편지지: 수락 버튼 뒤에는 바로 1:1 대화방이 열린다', function () {
    if (!hasNode()) return;
    var m = readRoot('js/views/matching.js');
    includes(m, 'function acceptRequest', '수락 처리');
    includes(m, "ctx.actions.openChat(res.roomId", '수락 → 대화방');
    includes(m, 'function openLetterSheet', '상세 편지지 시트');
    includes(m, 'data-open-letter', '카드에서 열기');
    eq(typeof BM.views.matching.openLetterSheet, 'function', '다른 화면에서도 열 수 있음');
    eq(typeof BM.views.matching.letterBody, 'function', '상세 본문 재사용');
  });

  /* ---------- 3. 버전 ---------- */

  test('v1.14 버전: sw·app·화면 캐시가 함께 올라간다', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    includes(sw, "var VERSION = 'bm-v1.55.0'", 'sw.js');
    includes(app, "version: 'v1.55.0'", 'app.js');
    includes(index, 'styles.css?v=', '스타일 캐시');
    var readme = readRoot('README.md');
    includes(readme, 'v1.31.0', 'README 변경 이력');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
