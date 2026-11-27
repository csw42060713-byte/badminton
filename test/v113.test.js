/* ============================================================
 * test/v113.test.js — v1.13.0 (2026-11-19)
 *  1) 프로필 꾸미기: 실력·성별·플레이 스타일·주 체육관을 한 시트에서 고치고
 *     프로필(꾸미기 JSON)·매칭프로필(소셜글 JSON)에 함께 남긴다 (시트 26칸 그대로)
 *  2) 상단 채팅 바로가기: 어느 탭에서든 같은 버튼, 열림 상태·배지 표시
 *  3) '전체' 필터: 어느 줄의 전체를 눌러도 모든 조건이 풀려 전부 보인다
 *  4) 뒤로 가기: 시트가 열려 있으면 앱을 나가지 않고 시트만 닫는다
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

  function stateOf(rows, meKey) {
    rows = rows || BM.fixtures.demo();
    meKey = meKey || BM.seed.ME;
    return {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, meKey),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: {
        tab: 'my', matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', matchSort: 'score', matchFilterOpen: '',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function hasNode() { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }

  /* ---------- 1. 플레이 스타일 · 프로필 꾸미기 ---------- */

  test('v1.13 플레이 스타일: 네 가지로 정리하고 모르는 값은 비운다', function () {
    eq(D.VOCAB.styles.length, 4, '스타일 네 가지');
    eq(D.normalizeStyle('공격형'), '공격형', '공격형');
    eq(D.normalizeStyle('네트앞'), '네트 앞', '붙여 써도 인식');
    eq(D.normalizeStyle('올라운드형'), '올라운드', '별칭');
    eq(D.normalizeStyle('무엇'), '', '모르는 값은 빈 값');
    eq(D.normalizeStyle(null), '', '빈 값');
  });

  test('v1.13 프로필 저장: 스타일이 꾸미기 JSON에 남고 시트는 26칸 그대로', function () {
    return freshStore().then(function (store) {
      store.state.locks = {};
      var res = store.actions.saveProfile({
        nick: '나래', level: 'B조', gender: '남성', style: '수비형',
        region: '경기', club: '나래울 체육관', bio: '주말에 칩니다'
      });
      ok(res.ok, '저장');
      eq(store.state.me.style, '수비형', 'me.style');
      eq(store.state.me.theme.style, '수비형', '꾸미기 JSON에도');
      eq(store.state.me.club, '나래울 체육관', '체육관');
      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸');
      var theme = JSON.parse(row[D.COL['꾸미기']]);
      eq(theme.style, '수비형', '꾸미기 칸에 스타일');
      /* 테마를 바꿔도 스타일은 남는다 */
      store.state.locks = {};
      store.actions.setTheme('th_court');
      eq(store.state.me.theme.style, '수비형', '테마 변경 뒤에도 스타일 유지');
    });
  });

  test('v1.13 매칭프로필: 스타일·체육관이 payload에 담긴다', function () {
    return freshStore().then(function (store) {
      store.state.locks = {};
      store.actions.saveMatchProfile({
        region: '경기', level: 'B조', discipline: '복식', club: '나래울 체육관',
        availability: '주말', experience: '2~5년', bio: '소개', gender: '남성', style: '네트 앞'
      });
      var mp = store.state.data.matchProfiles.filter(function (m) { return m.userKey === BM.seed.ME; })[0];
      eq(mp.style, '네트 앞', '파생 데이터에 스타일');
      eq(mp.club, '나래울 체육관', '체육관');
      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸');
      var payload = JSON.parse(row[D.COL['소셜글']]);
      eq(payload.style, '네트 앞', 'payload에 스타일');
    });
  });

  test('v1.13 MY 화면: 프로필 위에 꾸미기 버튼과 스타일·성별·급수가 보인다', function () {
    var html = BM.views.my.render(stateOf());
    includes(html, 'data-act="decorate-sheet"', '프로필 꾸미기 버튼');
    includes(html, '프로필 꾸미기', '버튼 글자');
    includes(html, 'profile__deco', '큰 버튼 스타일');
    includes(html, 'pill--style', '스타일 배지');
    includes(html, '공격형', '스타일 값');
    includes(html, 'pill--grade', '급수 배지');
    includes(html, 'C조', '급수 값');
    includes(html, '나래울', '체육관');
    /* 버튼이 카드 안, 통계보다 위에 있어 첫 화면에서 보입니다 */
    var at = html.indexOf('data-act="decorate-sheet"');
    ok(at > 0 && at < html.indexOf('class="stats"'), '꾸미기 버튼이 통계보다 위');
  });

  test('v1.13 꾸미기 시트: 실력·성별·스타일·체육관·지역·소개·사진을 한 곳에서', function () {
    var st = stateOf();
    var draft = BM.views.my.decorateDraft(st);
    eq(draft.style, '공격형', '기존 스타일로 시작');
    eq(draft.club, '나래울', '기존 체육관으로 시작');
    var body = BM.views.my.decorateBody(draft, st.me, st);
    ['닉네임', '사진 · 프레임', '실력(급수)', '성별', '주력 종목', '플레이 스타일', '주 체육관', '활동 지역', '한 줄 소개']
      .forEach(function (label) { includes(body, label, '항목: ' + label); });
    D.VOCAB.styles.forEach(function (s) { includes(body, 'data-dval="' + s + '"', '스타일 칩: ' + s); });
    includes(body, 'data-dframe="gold"', '프레임 선택');
    includes(body, 'data-dbadge="⭐"', '배지 선택');
    includes(body, 'data-dtext="club"', '체육관 입력');
    includes(body, 'data-act="deco-save"', '저장');
    /* 2026-11-22 — 개발자 문구(JSON·시트 26칸)는 화면에서 빼고 한 줄 안내로 */
    includes(body, 'MY 카드와 1:1 매칭 프로필에 바로 반영돼요', '저장 안내');
    excludes(body, '26칸', '개발자 문구 없음');
    excludes(body, 'JSON', '개발자 문구 없음');
  });

  test('v1.13 매칭 카드·프로필 시트: 스타일과 체육관이 함께 보인다', function () {
    var rows = BM.fixtures.demo();
    rows.forEach(function (r) {
      if (r[D.COL['유형']] !== '매칭프로필' || r[D.COL['사용자ID']] !== BM.seed.ME) return;
      var p = JSON.parse(r[D.COL['소셜글']]);
      p.style = '공격형';
      p.club = '나래울 체육관';
      r[D.COL['소셜글']] = JSON.stringify(p);
    });
    var html = BM.views.matching.render(stateOf(rows));
    includes(html, '공격형', '내 카드에 스타일');
    var me = stateOf(rows).data.matchProfiles.filter(function (m) { return m.userKey === BM.seed.ME; })[0];
    var body = BM.views.matching.profileBody(stateOf(rows), me);
    includes(body, '플레이 스타일', '프로필 시트 항목');
    includes(body, '주 체육관', '프로필 시트 체육관');
  });

  /* ---------- 2. 상단 채팅 바로가기 ---------- */

  test('v1.13 상단 채팅: 어느 탭에서든 같은 버튼을 쓰고 열림 상태를 표시한다', function () {
    if (!hasNode()) return;
    var index = readRoot('index.html');
    var app = readRoot('app.js');
    var css = readRoot('styles.css');
    includes(index, 'id="hdrChat"', '헤더 채팅 버튼');
    includes(index, 'aria-controls="dm"', '채팅 패널 연결');
    includes(app, "chatBtn.classList.toggle('is-open', chatOpen)", '열림 표시');
    includes(app, "chatBtn.setAttribute('aria-expanded'", '접근성 상태');
    includes(app, 'pendingMatch', '받은 매칭 요청도 배지에');
    includes(css, '.hdr__chat.is-open', '열림 스타일');
    includes(css, 'body.is-gate .hdr__chat', '시작화면에서는 숨김');
    /* paintChrome 은 탭과 무관하게 모든 화면 갱신에서 불립니다 */
    includes(app, 'function paintChrome', '헤더 공통 갱신');
    includes(app, 'paintChrome(state);', '상태가 바뀔 때마다 헤더 갱신');
  });

  /* ---------- 3. '전체' 필터 ---------- */

  test('v1.13 전체 필터: 어느 줄이든 전체를 누르면 모든 조건이 풀린다', function () {
    return freshStore().then(function (store) {
      store.actions.setFilter({ level: 'C조' });
      store.actions.setFilter({ gender: '남성' });
      store.actions.setMatchQuery('나래');
      eq(store.state.data.matchProfiles.length > 0, true, '데이터 있음');
      /* 화면은 전체를 '모든 조건 풀기'로 안내합니다 */
      var html = BM.views.matching.render(store.state);
      includes(html, 'data-filter="level" data-value="전체"', '급수 줄 전체 칩');
      includes(html, 'data-filter="gender" data-value="전체"', '성별 줄 전체 칩');
      includes(html, 'data-act="show-all"', '전체 보기 버튼');
      includes(html, '모두', '전체 안내 문구');
      /* 앱이 전체를 눌렀을 때 하는 일과 같은 동작 — 조건은 비고, '전체'가 선택된 상태 */
      store.actions.resetMatchFilter();
      var f = store.state.ui.matchFilter;
      eq(f.level, ''); eq(f.gender, ''); eq(f.region, '');
      eq(f.discipline, ''); eq(f.query, '', '검색어도 함께 초기화');
      eq(store.state.ui.matchStarted, true, '전체가 선택된 상태');
      eq(store.state.ui.matchFilterOpen, '', '필터 접힘');
    });
  });

  test('v1.13 전체 필터: 전체는 조건과 다른 색으로 구분한다', function () {
    var st = stateOf();
    st.ui.matchFilter = { level: 'C조', gender: '전체', region: '전체', discipline: '전체', query: '' };
    var html = BM.views.matching.render(st);
    /* 고른 조건은 라임 is-on, 전체는 chip--all + 체크 */
    includes(html, 'chip chip--sm chip--all is-on" data-filter="gender"', '성별 전체는 전체 표시');
    includes(html, 'chip chip--sm is-on" data-filter="level" data-value="C조"', 'C조는 조건 선택');
    includes(html, 'chip__ic', '전체에 체크 아이콘');
    if (hasNode()) {
      var css = readRoot('styles.css');
      includes(css, '.chip--all.is-on', '전체 전용 스타일');
      includes(css, '.fpanel { grid-template-columns: minmax(0, 1fr); }', '칩 줄이 카드 밖으로 넘치지 않음');
    }
  });

  test('v1.13 커뮤니티: 말머리 거르기의 전체도 같은 표시를 쓴다', function () {
    var html = BM.views.community.render(stateOf());
    includes(html, 'chip chip--sm chip--all is-on" data-topicfilter="전체"', '커뮤니티 전체 칩');
    includes(html, 'chip__ic', '체크 아이콘');
  });

  /* ---------- 4. 뒤로 가기 · 화면 마감 ---------- */

  test('v1.13 뒤로 가기: 시트가 열려 있으면 시트만 닫는다', function () {
    if (!hasNode()) return;
    var ui = readRoot('js/ui.js');
    var app = readRoot('app.js');
    includes(ui, 'backClosedSheet', '시트 뒤로 가기 판정');
    includes(ui, 'bmOverlay', '겹침 기록 표시');
    includes(ui, "window.addEventListener('popstate'", '뒤로 가기 듣기');
    includes(app, 'UI.backClosedSheet', '채팅과 시트를 구분');
    includes(app, 'UI.overlay.open()', '채팅도 같은 겹침 기록을 씀');
    eq(typeof BM.ui.overlay.open, 'function', 'overlay API');
    eq(typeof BM.ui.overlay.close, 'function', 'overlay API close');
  });

  test('v1.13 버전: sw·app·화면 캐시가 함께 올라간다', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    includes(sw, "var VERSION = 'bm-v1.95.0'", 'sw.js');
    includes(app, "version: 'v1.95.0'", 'app.js');
    includes(index, 'styles.css?v=20261128-1', '스타일 캐시 갱신');
    includes(app, 'BM.views.my', 'MY 화면 유지');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
