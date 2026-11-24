/* ============================================================
 * test/v165.test.js — 2026-11-23 저녁 사용성 점검 3가지 (bm-v1.71.0 으로 반영)
 *
 *  1) 체육관 지도 → 반경 5km 동네 동호인
 *     · 사람을 누르면 가로 목록 아래 '선택한 동호인' 카드가 열린다
 *     · 카드에서 매칭 요청(매칭 탭 프로필 시트)·1:1 대화·프로필로 이어진다
 *     · 지도에 보이는 예시 동호인은 실제 계정이 없으므로 그 사실을 밝힌다
 *     · 사람 목록에 userKey(실제 프로필) / demo(예시)가 함께 온다
 *  2) 코치 탭 위 줄 정리
 *     · 내 유형이 동호인·초보·미선택이면 위 탭 없이 '코치 찾기 · 피드백' 한 줄
 *       → 멘토 신청은 맨 아래 보조 줄(기능은 그대로)
 *     · 내 유형이 선수·코치면 예전처럼 위 탭(코치 찾기 · 피드백 / 멘토 신청)
 *     · 관리자는 언제나 멘토 심사 탭
 *  3) 커뮤니티 빈 화면
 *     · '게스트 모집 글쓰기' 바로가기가 함께 있다(누르면 게스트 모집 분류 + 모집 칸)
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function N() { return BM.nearby; }

  /* 2026-11-23(월) 20:30 — 저녁 점검과 같은 시각 */
  var MON = new Date(2026, 10, 23, 20, 30);

  function clearNear() {
    ['demo_me', 'guest'].forEach(function (scope) {
      U.storage.removeItem(N().homeKey(scope));
      U.storage.removeItem(N().availKey(scope));
    });
  }

  function stateOf(patchI) {
    patchI = patchI || {};
    return {
      ready: true, mode: 'local',
      me: { key: 'demo_me', nick: '나래', level: 'C조', region: '경기', club: '나래울', theme: { theme: 'th_def' } },
      rows: [], data: { posts: [], matchProfiles: patchI.profiles || [], idx: null },
      ui: { tab: 'community', composer: '', composerTopic: '자유', composerMeet: {} },
      drafts: { log: {} }, analysis: null, queue: [], locks: {}, syncStats: {}
    };
  }

  /* 지도 화면 모델 — render()가 받는 모양 그대로 */
  function mapModel(patchM) {
    var mm = {
      scope: 'demo_me', home: null, posts: [], profiles: [], now: MON, person: ''
    };
    Object.keys(patchM || {}).forEach(function (k) { mm[k] = patchM[k]; });
    return mm;
  }

  /* =========================================================
   * 1. 지도 → 동네 동호인 바로 매칭·대화
   * ========================================================= */
  test('v165 지도: 사람을 누르면 그 자리에 매칭 요청·프로필 버튼 카드가 열린다', function () {
    clearNear();
    var html = BM.views.gyms.render(mapModel({ person: 'nd5' }));
    includes(html, 'data-gymact="nd5"', '선택한 동호인 카드');
    includes(html, 'data-gym-match="nd5"', '매칭 요청 버튼');
    includes(html, '매칭 요청', '버튼 이름');
    includes(html, 'data-gym-profile="nd5"', '프로필 보기 버튼');
    includes(html, '프로필 보기', '버튼 이름');
    includes(html, '정하늘', '고른 사람 이름');
    includes(html, '예시 동호인', '예시라는 안내');
    /* 고른 카드는 '펼쳐짐' 표시가 되고, 지도 위 아이콘도 표시됩니다 */
    includes(html, 'aria-expanded="true"', '펼친 카드');
    /* 계정이 없는 예시 동호인에게 1:1 채팅을 열어 두지 않습니다 */
    excludes(html, 'data-gym-chat="nd5"', '예시 동호인에게 대화 버튼 없음');

    var none = BM.views.gyms.render(mapModel({}));
    excludes(none, 'data-gymact=', '고르기 전에는 카드 없음');
    includes(none, 'data-gym-person="nd5"', '사람 카드는 그대로');
  });

  test('v165 지도: 실제 프로필이 있는 동호인도 같은 카드에서 매칭으로 이어진다', function () {
    clearNear();
    var prof = {
      userKey: 'demo_chi', nick: '콕집사', level: 'B조', club: '나래울 배드민턴장',
      discipline: '복식', bio: '주말 오전 위주'
    };
    var gym = BM.gyms.matchVenue('나래울 배드민턴장');
    var home = { lat: gym.lat, lng: gym.lng, label: '나래울', demo: false };
    var html = BM.views.gyms.render(mapModel({ profiles: [prof], person: 'u:demo_chi', home: home }));
    includes(html, 'data-gymact="u:demo_chi"', '프로필 동호인 카드');
    includes(html, 'data-gym-match="u:demo_chi"', '매칭 요청');
    includes(html, '매칭이 성사되면 1:1 대화가 열려요', '대화 조건 안내');
    excludes(html, '예시 동호인', '실제 프로필은 예시가 아님');
  });

  test('v165 지도: 사람 목록이 실제 프로필(userKey)과 예시(demo)를 구분해 준다', function () {
    clearNear();
    var list = N().all({
      me: { key: 'demo_me' },
      data: { matchProfiles: [{ userKey: 'demo_chi', nick: '콕집사', level: 'B조', club: '나래울 배드민턴장' }] }
    });
    var demoRows = list.filter(function (p) { return p.demo; });
    var realRows = list.filter(function (p) { return !p.demo; });
    ok(demoRows.length >= 7, '예시 동호인 7명 이상');
    eq(demoRows[0].userKey, '', '예시는 계정 키 없음');
    eq(realRows.length, 1, '실제 프로필 1명');
    eq(realRows[0].userKey, 'demo_chi', '실제 프로필 계정 키');
    eq(realRows[0].id, 'u:demo_chi', '카드 id 규칙');

    var inside = N().near(list, N().home('demo_me'), 50);
    var chi = inside.filter(function (p) { return p.userKey === 'demo_chi'; })[0];
    ok(chi, '반경 계산 뒤에도 계정 키가 남는다');
  });

  test('v165 지도: 매칭 탭 함수 재사용 — 대화할 수 있는 사이만 1:1 대화가 열린다', function () {
    var rows = BM.fixtures.demo();
    var state = {
      ready: true, mode: 'local', me: { key: 'demo_me', nick: '나래', level: 'C조' },
      rows: rows, data: BM.store.derive(rows, 'demo_me'), ui: {}, drafts: {},
      analysis: null, queue: [], locks: {}, syncStats: {}
    };
    var calls = [];
    var ctx = {
      store: { state: state },
      actions: {
        openChat: function (roomId, other) { calls.push([roomId, other]); return { ok: true, roomId: roomId }; },
        markChatRead: function () { return { ok: true }; }
      }
    };
    var M = BM.views.matching;
    ok(typeof M.openChatWith === 'function', 'openChatWith 있음');
    ok(typeof M.canChatWith === 'function', 'canChatWith 있음');
    ok(typeof M.matchWith === 'function', 'matchWith 있음');

    /* 아무 사이도 아니면 대화가 열리지 않는다 */
    eq(M.canChatWith(ctx, 'demo_unknown'), false, '모르는 사람');
    eq(M.openChatWith(ctx, 'demo_unknown').ok, false, '대화 없음');
    eq(calls.length, 0, '대화방을 열지 않음');
  });

  /* =========================================================
   * 2. 코치 탭 위 줄 정리
   * ========================================================= */
  function coachState(role, tab) {
    var rows = BM.fixtures.demo();
    var me = { key: 'demo_me', nick: '나래', level: 'C조' };
    if (role) me.role = role;
    var st = {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, 'demo_me'),
      ui: { tab: 'coach', coachTab: tab || '', composer: '' },
      drafts: { log: {} }, analysis: null, queue: [], locks: {}, syncStats: {}
    };
    return st;
  }

  test('v165 코치: 동호인·초보는 위 탭 없이 코치 찾기부터, 멘토 신청은 맨 아래 보조 줄', function () {
    ['', 'club', 'beginner'].forEach(function (role) {
      var html = BM.views.coach.render(coachState(role));
      includes(html, '코치 찾기 · 피드백', '화면 이름');
      includes(html, 'data-coachmentor', '보조 줄');
      includes(html, 'data-coachtab="apply"', '멘토 신청 입구는 남아 있다');
      includes(html, '코치·지도자이신가요?', '보조 줄 안내');
      /* 위 탭 줄(seg)이 아니라 카드 아래에 붙습니다 */
      var feedbackAt = html.indexOf('코치에게 피드백 받기');
      var entryAt = html.indexOf('data-coachmentor');
      ok(feedbackAt >= 0 && entryAt > feedbackAt, '멘토 신청은 목록 아래');
      excludes(html, '<div class="seg seg--wide" data-coachtabs>', '위 탭 없음');
    });
  });

  test('v165 코치: 선수·코치 유형은 예전처럼 위 탭으로 멘토 신청을 강조한다', function () {
    ['player', 'coach'].forEach(function (role) {
      var html = BM.views.coach.render(coachState(role));
      includes(html, '<div class="seg seg--wide" data-coachtabs>', '위 탭');
      includes(html, 'data-coachtab="apply"', '멘토 신청 탭');
      includes(html, 'data-coachtab="feedback"', '코치 찾기 탭');
      excludes(html, 'data-coachmentor', '보조 줄 중복 없음');
    });
  });

  test('v165 코치: 보조 줄에서 들어가도 신청 화면은 그대로 동작하고 돌아갈 길이 있다', function () {
    var html = BM.views.coach.render(coachState('beginner', 'apply'));
    includes(html, '← 코치 찾기로 돌아가기', '돌아가기');
    includes(html, 'data-coachtab="feedback"', '돌아가는 탭');
    includes(html, 'data-mentor-field="affiliation"', '소속 입력칸');
    includes(html, '멘토 신청 보내기', '보내기 버튼');
  });

  test('v165 코치: 관리자는 언제나 멘토 심사 탭을 본다', function () {
    var rows = BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: 'demo_me', nick: '승우', email: 'csw42060713@gmail.com' },
      rows: rows, data: BM.store.derive(rows, 'demo_me'),
      ui: { tab: 'coach', coachTab: '', composer: '' },
      drafts: { log: {} }, analysis: null, queue: [], locks: {}, syncStats: {}
    };
    var html = BM.views.coach.render(st);
    includes(html, 'data-coachtab="approve"', '멘토 심사 탭');
    excludes(html, 'data-coachmentor', '관리자에게는 보조 줄 없음');
  });

  /* =========================================================
   * 3. 커뮤니티 빈 화면 → 게스트 모집 바로가기
   * ========================================================= */
  test('v165 커뮤니티: 빈 화면에 게스트 모집 글쓰기 바로가기가 함께 있다', function () {
    var st = stateOf({});
    var html = BM.views.community.render(st);
    includes(html, '아직 글이 없어요', '빈 화면');
    includes(html, 'data-act="write-guest"', '게스트 모집 글쓰기');
    includes(html, '게스트 모집 글쓰기', '버튼 이름');
    includes(html, 'data-act="write-log"', '일지 입구는 그대로');
  });

  test('v165 커뮤니티: 게스트 모집 분류로 들어가면 모집 입력칸이 열려 있다', function () {
    var st = stateOf({});
    st.ui.composerTopic = D.MEET.topic;
    var html = BM.views.community.render(st);
    includes(html, 'data-topic="게스트 모집"', '분류 칩');
    includes(html, 'class="chip chip--sm is-on" data-topic="게스트 모집"', '게스트 모집이 선택됨');
    includes(html, 'class="viteform" data-viteform', '모집 입력칸이 열림');
    includes(html, 'data-vitefield="when"', '언제 칸');
    includes(html, 'data-vitefield="place"', '체육관 칸');
    excludes(html, 'data-viteform hidden', '숨김 아님');
  });

  /* =========================================================
   * 4. 배선
   * ========================================================= */
  test('v165 배선: 테스트 목록 · 새 스타일 · 서비스워커 캐시는 그대로', function () {
    if (!hasNode) return;
    var run = readRoot('test/run.js');
    includes(run, 'test/v165.test.js', '테스트 목록에 등록');
    var css = readRoot('styles.css');
    includes(css, '.nearact', '선택한 동호인 카드 스타일');
    includes(css, '.coachmentor', '코치 보조 줄 스타일');
    includes(css, '.gymperson', '동네 동호인 카드 스타일');
    var gyms = readRoot('js/views/gyms.js');
    includes(gyms, 'data-gym-match', '매칭 요청 버튼');
    includes(gyms, 'data-gym-chat', '1:1 대화 버튼');
    includes(gyms, 'BM.views.matching', '매칭 탭 함수 재사용');
  });

  test('v165 안전: 지도·코치·커뮤니티가 위치나 사람 정보를 서버로 보내지 않는다', function () {
    if (!hasNode) return;
    var gyms = readRoot('js/views/gyms.js');
    excludes(gyms, 'fetch(', '지도 화면에서 직접 요청 없음');
    excludes(gyms, 'navigator.geolocation.watchPosition', '계속 추적하지 않음');
    var comm = readRoot('js/views/community.js');
    excludes(comm, 'fetch(', '커뮤니티에서 직접 요청 없음');
  });

  test('v165 안전: 사용자가 넣은 이름·한마디는 글자로만 나간다', function () {
    clearNear();
    var prof = {
      userKey: 'demo_x', nick: '<img src=x onerror=alert(1)>', level: 'B조',
      club: '나래울 배드민턴장', bio: '<script>alert(1)</script>'
    };
    var gym = BM.gyms.matchVenue('나래울 배드민턴장');
    var html = BM.views.gyms.render(mapModel({
      profiles: [prof], home: { lat: gym.lat, lng: gym.lng, label: '나래울', demo: false }
    }));
    excludes(html, '<img src=x', '태그로 실행되지 않는다');
    excludes(html, '<script>alert(1)</script>', '스크립트 그대로 나가지 않는다');
    includes(html, '&lt;img', '글자로 이스케이프');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
