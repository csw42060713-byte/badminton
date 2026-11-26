/* ============================================================
 * test/v152_2.test.js — bm-v1.52.2
 *   조환비(@chohwanbi7) 님 사용성 피드백 3종
 *
 *  1) 🎥 영상 자세 비교 — 맨 아래 논문 참고 수치를 '참고 기준 보기'로 접어 둠(기본 닫힘)
 *  2) 코치 탭 — 소속 체육관(·프로필 클럽) 이름을 눌러 그 체육관 지도로 (MY·매칭과 같은 칩)
 *  3) 커뮤니티 게스트 모집 — 일/토요일에 '오늘'과 '이번 주말'이 같은 날로 겹치지 않음
 *     (일요일·토요일·평일 모두 단위 테스트)
 *  4) 버전 · 배선(sw · app · index · TWA · 테스트 목록)
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var P = BM.pose;
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

  var ME = 'u_v1522_me';

  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0, meKey: ME, me: { nick: '나래', level: 'B조', discipline: '복식', region: '경기', club: '나래울' } });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function rowsWith(extra) {
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(D.toRow(e)); });
    return rows;
  }

  function mentorRow(opts) {
    opts = opts || {};
    var payload = {
      type: opts.type || '체육관 코치', affiliation: opts.affiliation || '', experience: '7년',
      awards: '시 대회 3위', proof: opts.proof || '', proofUrl: '', proofPhoto: '',
      reason: '성인반을 봅니다', status: '승인', submitted: U.stamp(), level: 'B조', discipline: '복식'
    };
    return {
      id: opts.id || 'mentor-1522', type: '멘토신청', createdAt: U.stamp(), date: U.ymd(),
      nick: opts.nick || '코치', userKey: opts.userKey || 'demo_chi',
      target: D.ADMIN_TARGET, payload: payload, status: '승인'
    };
  }

  /* ============================================================
   * 1. 영상 자세 비교 — 참고 수치 접기
   * ============================================================ */

  test('v1.52.2 자세 비교: 참고 수치는 "참고 기준 보기"로 접혀 있고 기본은 닫힘', function () {
    var html = P.refNote('smash');
    includes(html, '<details', '접기 상자');
    includes(html, 'data-pose-ref', '점검용 이름');
    includes(html, '참고 기준 보기', '누를 이름');
    includes(html, '</details>', '상자 끝');
    excludes(html, '<details open', '기본은 닫힘');
    includes(html, 'data-pose-foot', '참고 줄은 상자 안에 그대로');
    includes(html, 'Miller', '스매시 근거');

    var shell = P.shellHtml();
    includes(shell, 'data-pose-ref', '패널에도 접힌 상자');
    includes(shell, '참고 기준 보기', '패널 안내');
    excludes(shell, '<details open', '처음 열면 펼쳐져 있지 않음');

    var css = readRoot('styles.css');
    includes(css, '.pose__refsum', '누를 줄 스타일');
    includes(css, '.pose__ref[open]', '펼쳤을 때 표시');
  });

  test('v1.52.2 자세 비교: 종목을 바꿔도 참고 줄 내용은 그대로 (풋워크 · 스매시 출처)', function () {
    includes(P.refNote('foot'), 'Shishido', '풋워크 근거');
    var both = P.refNote();
    includes(both, '참고 기준 보기', '종목 없이도 접힘');
    includes(both, 'Miller', '스매시 출처 포함');
  });

  /* ============================================================
   * 2. 코치 소속 체육관 → 지도
   * ============================================================ */

  test('v1.52.2 코치 소속: 소속 이름 자체가 지도로 가는 칩 (단일·복수·미등록)', function () {
    var one = BM.views.coach.affRow('나래울 배드민턴장');
    includes(one, 'coachcard__gyms', '칩 줄');
    includes(one, 'data-gym-open="naraeul"', '누르면 나래울 지도');
    includes(one, '나래울 배드민턴장', '코치가 적은 이름 그대로');
    includes(one, '경기', '지역 표시');

    var two = BM.views.coach.affRow('나래울 배드민턴장 · 매원고 배드민턴부');
    eq((two.match(/data-gym-open/g) || []).length, 2, '두 곳 모두 지도 칩');
    includes(two, 'data-gym-open="maewon"', '매원고');
    includes(two, '매원고 배드민턴부', '적은 이름 그대로');

    var none = BM.views.coach.affRow('우리동네 배드민턴 크루');
    includes(none, 'coachcard__gymname', '등록에 없으면 글자');
    excludes(none, 'data-gym-open', '없는 곳은 링크 없음');
    eq(BM.views.coach.affRow(''), '', '소속이 없으면 줄도 없음');
  });

  test('v1.52.2 코치 카드: 소속과 프로필 클럽(경기 나래울)을 눌러 지도로', function () {
    return freshStore(rowsWith([mentorRow({
      id: 'mentor-1522-a', userKey: 'demo_chi', nick: '콕집사', type: '체육관 코치',
      affiliation: '나래울 배드민턴장', proof: '재직 확인'
    })])).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      var card = html.slice(html.indexOf('data-coach="demo_chi"'), html.indexOf('</li>', html.indexOf('data-coach="demo_chi"')));
      includes(card, 'coachcard__gyms', '소속 칩 줄');
      includes(card, 'data-gym-open="naraeul"', '소속 이름 → 지도');
      includes(card, '활동 증명됨', '증명 배지 그대로');
      /* 프로필 클럽 '나래울' — '경기 나래울'에서 이름을 눌러도 같은 지도 */
      includes(card, '경기', '지역은 글자');
      includes(card, 'coachcard__meta', '프로필 줄');
      includes(card, 'gymlink', '클럽 이름도 누를 수 있게');

      /* 버튼을 누르면 앱의 공통 처리(app.js)가 그 체육관으로 지도를 엽니다 */
      includes(readRoot('app.js'), "closest('[data-gym-open]')", '어느 화면에서든 지도 열기 처리');
      includes(readRoot('app.js'), 'BM.views.gyms.openVenue', '그 체육관으로 바로 열기');
    });
  });

  test('v1.52.2 코치 카드: 등록에 없는 소속·클럽은 글자만 (없는 지도 링크를 만들지 않음)', function () {
    return freshStore(rowsWith([mentorRow({
      id: 'mentor-1522-b', userKey: 'demo_suttle', nick: '셔틀버스', type: '개인 멘토',
      affiliation: '우리동네 배드민턴 크루', proof: ''
    })])).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      var start = html.indexOf('data-coach="demo_suttle"');
      var card = html.slice(start, html.indexOf('</li>', start));
      includes(card, '우리동네 배드민턴 크루', '소속 글자');
      includes(card, 'coachcard__gymname', '글자 자리');
      excludes(card, '활동 증명됨', '증명 없으면 배지 없음');
    });
  });

  test('v1.52.2 클럽 링크: 이름이 정말 겹칠 때만 (동네 이름만 같은 다른 체육관은 글자)', function () {
    /* '나래울'은 '나래울 배드민턴장'과 이름이 겹침 → 링크 */
    includes(BM.views.coach.affRow('나래울'), 'data-gym-open="naraeul"', '이름이 겹치면 링크');
    /* '체육관'처럼 여럿에 걸리는 이름은 어느 곳으로도 고르지 않음 */
    eq(BM.views.coach.venueFor('체육관'), null, '여럿에 걸리면 고르지 않음');
    /* 등록되지 않은 이름은 링크 없는 글자 */
    var plain = BM.views.coach.affRow('동네 체육공원');
    includes(plain, 'coachcard__gymname', '글자');
    excludes(plain, 'data-gym-open', '링크 없음');
  });

  /* ============================================================
   * 3. 게스트 모집 — 빠른 날짜 칩 중복 없음
   * ============================================================ */

  function datesOn(y, m, d) {
    return D.meetWhen.quickDates(new Date(y, m - 1, d)).map(function (q) { return q.date; });
  }

  test('v1.52.2 게스트 모집: 일요일 — 오늘·이번 주말이 같은 날로 겹치지 않는다', function () {
    /* 2026-11-22 = 일요일 (feedback에 나온 바로 그날) */
    var q = D.meetWhen.quickDates(new Date(2026, 10, 22));
    eq(q.length, 2, '칩 2개');
    eq(q[0].label, '오늘', '첫 칩');
    eq(q[0].day, '11/22(일)', '오늘 표기');
    eq(q[1].label, '내일', '둘째 칩');
    eq(q[1].day, '11/23(월)', '내일 표기');
    eq(datesOn(2026, 11, 22).filter(function (x) { return x === '2026-11-22'; }).length, 1, '11/22는 한 번만');
    excludes(q.map(function (x) { return x.label; }).join(','), '이번 주말', '겹치는 주말 칩은 숨김');
  });

  test('v1.52.2 게스트 모집: 토요일 — 오늘(토)과 이번 주말이 겹치지 않는다', function () {
    var q = D.meetWhen.quickDates(new Date(2026, 10, 21));   /* 토요일 */
    eq(q.map(function (x) { return x.day; }).join(','), '11/21(토),11/22(일)', '오늘·내일');
    eq(q.length, 2, '칩 2개');
    eq(new Set(datesOn(2026, 11, 21)).size, 2, '서로 다른 날');
  });

  test('v1.52.2 게스트 모집: 평일 — 오늘·내일·이번 주말이 서로 다른 날, 금요일은 겹쳐서 둘', function () {
    var q = D.meetWhen.quickDates(new Date(2026, 10, 25));   /* 수요일 */
    eq(q.length, 3, '칩 3개');
    eq(q[2].label, '이번 주말', '주말 칩');
    eq(q[2].day, '11/28(토)', '다가오는 토요일');
    eq(new Set(q.map(function (x) { return x.date; })).size, 3, '겹치는 날짜 없음');

    /* 금요일 — 내일이 곧 이번 주말(토)이라 주말 칩은 겹쳐 빠지고 둘만 */
    var fri = D.meetWhen.quickDates(new Date(2026, 10, 27));
    eq(fri.length, 2, '금요일 칩 2개');
    eq(fri[1].day, '11/28(토)', '금요일의 내일 = 토요일');
    eq(new Set(fri.map(function (x) { return x.date; })).size, 2, '겹치는 날짜 없음');
  });

  test('v1.52.2 게스트 모집: 한 주 7일 모두 빠른 날짜 칩에 같은 날짜가 두 번 나오지 않는다', function () {
    for (var i = 0; i < 7; i++) {
      var q = D.meetWhen.quickDates(new Date(2026, 10, 16 + i));   /* 11/16(월)~11/22(일) */
      var ds = q.map(function (x) { return x.date; });
      eq(new Set(ds).size, ds.length, '겹치는 날짜 없음: ' + ds.join(','));
      ok(q.length >= 2 && q.length <= 3, '칩은 2~3개: ' + q.length);
      eq(q[0].label, '오늘', '첫 칩은 늘 오늘');
      ok(/^\d{1,2}\/\d{1,2}\([월화수목금토일]\)$/.test(q[q.length - 1].day), '끝 칩도 날짜(요일) 표기');
    }
  });

  test('v1.52.2 게스트 모집 화면: 일요일에 작성 칸에 중복 날짜 칩이 그려지지 않는다', function () {
    /* 화면은 오늘 날짜(실행 시각)로 칩을 그립니다 — 오늘 기준으로 겹침만 확인 */
    var st = {
      me: { key: ME, nick: '나래', level: 'B조', discipline: '복식' },
      data: { posts: [], matchProfiles: [], records: [], feedback: [], threads: [], idx: { byType: {} } },
      ui: { composerTopic: '게스트 모집', composerMeet: {}, postFilter: '전체' }
    };
    var html = BM.views.community.render(st);
    var days = (html.match(/data-viteday-quick="([0-9-]+)"/g) || []);
    eq(new Set(days).size, days.length, '같은 날짜 버튼은 하나: ' + days.join(','));
    ok(days.length >= 2, '빠른 날짜 버튼이 있다: ' + days.length);
  });

  /* ============================================================
   * 4. 버전 · 배선
   * ============================================================ */

  test('v1.52.2 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.83.0'", '서비스워커');
    includes(readRoot('app.js'), "version: 'v1.83.0'", '앱 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.83.0', 'TWA 이름');
    eq(twa.appVersionCode, 77, 'TWA 코드');
    var index = readRoot('index.html');
    ok(/styles\.css\?v=20261126-\d+/.test(index), 'styles.css 캐시 주소 갱신: ' + (index.match(/styles\.css\?v=[^"]+/) || [''])[0]);
    includes(readRoot('test/run.js'), 'test/v152_2.test.js', '테스트 목록');
    includes(readRoot('sw.js'), "'./js/pose.js'", '서비스워커 캐시 목록 그대로');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
