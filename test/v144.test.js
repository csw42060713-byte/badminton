/* ============================================================
 * test/v144.test.js — bm-v1.45.0 코트 점수판 전체화면 · 전국 체육관 지도
 *
 *  1) 점수판 계산 추가분 — 세트 비우기(resetSet) · 세트 번호 · 세트 스코어
 *  2) 전체화면 코트 점수판 — 상하 큰 카드 · 헤더(세트/점수제) · 코트 교대 ·
 *     세트 초기화 · −1 되돌리기 · 일지에 넣기(기존 v1.30.0 경로 그대로)
 *  3) 전국 체육관 — 100곳 이상 · 7개 권역 · 좌표·주소가 모두 있다
 *     (수원 남부: 매원고·영통·망포·나래울·칠보 포함)
 *  4) 권역 칩 · 검색 — 좁히기 · 조합(권역+검색) · 즐겨찾기 유지
 *  5) 보안 · 버전 · 스타일
 *
 * 실행: node test/run.js
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

  function SB() { return BM.scoreboard; }
  function G() { return BM.gyms; }

  /* n점을 한쪽에 쌓기 */
  function rally(st, side, n) {
    for (var i = 0; i < n; i++) st = SB().point(st, side);
    return st;
  }

  function stateOf(patch) {
    var rows = BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: 'demo_me', nick: '나래', level: 'C조', region: '경기', club: '나래울', theme: { theme: 'th_def' } },
      rows: rows,
      data: BM.store.derive(rows, 'demo_me'),
      ui: {
        tab: 'log', matchTab: 'find', matchFilter: {}, matchSort: 'score',
        matchFilterOpen: '', matchStarted: false, chatRoom: null, chatOther: '',
        chatDraft: '', chatOpen: false, coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: ''
    };
    if (patch && patch.ui) Object.keys(patch.ui).forEach(function (k) { st.ui[k] = patch.ui[k]; });
    return st;
  }

  /* =========================================================
   * 1. 점수판 계산 — 세트 비우기 · 세트 번호 · 세트 스코어
   * ========================================================= */
  test('v1.44 점수판: 세트 초기화는 지금 세트만 0:0으로 되돌리고, 되돌리기로 살아난다', function () {
    var st = rally(SB().create(), 'a', 5);
    st = rally(st, 'b', 3);
    var zero = SB().resetSet(st);
    eq(zero.a, 0, '내 점수 0');
    eq(zero.b, 0, '상대 점수 0');
    eq(SB().winner(zero), '', '세트 종료 아님');
    eq(zero.sets.length, 0, '끝난 세트는 그대로(0)');

    var back = SB().undo(zero);
    eq(back.a, 5, '되돌리면 5점');
    eq(back.b, 3, '되돌리면 3점');

    /* 이미 0:0이면 기록도 쌓지 않는다 */
    var idle = SB().resetSet(SB().create());
    eq(idle.history.length, 0, '0:0에서는 기록 없음');
    eq(SB().undo(idle).a, 0, '되돌려도 0');
  });

  test('v1.44 점수판: 세트 번호와 세트 스코어를 센다', function () {
    var st = SB().create();
    eq(SB().setNo(st), 1, '처음은 1세트');
    eq(SB().setScore(st).text, '0-0', '세트 0-0');
    st = SB().nextSet(rally(st, 'a', 21));
    eq(SB().setNo(st), 2, '한 세트 끝나면 2세트');
    eq(SB().setScore(st).text, '1-0', '1세트 승');
    st = SB().nextSet(rally(rally(st, 'a', 5), 'b', 21));
    eq(SB().setScore(st).text, '1-1', '1승 1패');
    eq(SB().setNo(st), 3, '3세트');
    /* 25점제도 같은 방식 */
    eq(SB().setNo(SB().create({ mode: 25 })), 1, '25점제 1세트');
  });

  test('v1.44 점수판: 세트 초기화 뒤에도 일지에 넣는 값은 그대로 호환된다', function () {
    var st = SB().nextSet(rally(rally(SB().create(), 'a', 21), 'a', 4));
    st = SB().resetSet(st);                       /* 2세트는 0:0으로 */
    var patch = SB().draftPatch(st, { note: '', done: [] });
    eq(patch.games.length, 1, '끝난 1세트만');
    eq(patch.games[0].a, 21, '1세트 점수');
    eq(patch.result, '승', '승패');
    includes(patch.note, '코트 점수판', '메모');
    eq(SB().draftPatch(SB().resetSet(SB().create()), {}), null, '끝난 세트가 없으면 null(넣기 버튼 없음)');
  });

  /* =========================================================
   * 2. 전체화면 화면
   * ========================================================= */
  test('v1.44 화면: 점수판은 전체화면(.sb--full) · 닫기 · 세트 표시를 갖는다', function () {
    var html = BM.views.log.scoreboardHtml(SB().create());
    includes(html, 'sb--full', '전체화면 클래스');
    includes(html, 'data-sb', '다시 그리는 자리');
    includes(html, 'data-sb-close', '닫기 버튼');
    includes(html, 'sbfull__hdr', '상단 헤더');
    includes(html, '1세트', '지금 세트');
    includes(html, '0-0', '세트 스코어');
    includes(html, '내 팀', '내 팀 이름');
    includes(html, '상대 팀', '상대 팀 이름');
    includes(html, '2점 차', '규칙 안내');
  });

  test('v1.44 화면: 카드 전체가 +1 버튼이고, 기본은 상대가 위·내 팀이 아래다', function () {
    var html = BM.views.log.scoreboardHtml(SB().create());
    eq((html.match(/data-sb-point=/g) || []).length, 2, '+1 카드 두 장');
    includes(html, 'class="sb__btn sb__side sb__card sb__btn--a"', '내 팀 카드가 큰 버튼');
    includes(html, 'sb__card', '카드 클래스');
    includes(html, '1점', '카드 안 +1 안내');
    ok(html.indexOf('data-sb-point="b"') < html.indexOf('data-sb-point="a"'), '기본: 상대가 위');

    var swapped = BM.views.log.scoreboardHtml(SB().create(), { swap: true });
    ok(swapped.indexOf('data-sb-point="a"') < swapped.indexOf('data-sb-point="b"'), '코트 교대: 내 팀이 위');
    includes(swapped, 'aria-pressed="true"', '교대 상태 표시');
  });

  test('v1.44 화면: −1 되돌리기 · 코트 교대 · 세트 초기화 버튼이 있다', function () {
    var html = BM.views.log.scoreboardHtml(SB().create());
    includes(html, 'data-sb-undo', '되돌리기');
    includes(html, '−1', '−1 표기');
    includes(html, 'data-sb-swap', '코트 교대');
    includes(html, '코트 교대', '교대 이름');
    includes(html, 'data-sb-reset', '세트 초기화');
    includes(html, '세트 초기화', '초기화 이름');
    excludes(html, 'data-sb-save', '끝난 세트가 없으면 넣기 버튼 없음');
    includes(html, '한 세트를 마치면', '안내');
  });

  test('v1.44 화면: 세트가 끝나면 다음 세트 · 오늘 일지에 넣기 (v1.30.0 그대로)', function () {
    var st = rally(SB().create(), 'a', 21);
    var html = BM.views.log.scoreboardHtml(st);
    includes(html, 'data-sb-next', '다음 세트');
    includes(html, 'data-sb-save', '일지에 넣기');
    includes(html, '오늘 일지에 넣기', '버튼 글자');
    includes(html, '<b>21:0</b>', '끝난 세트 점수');
    includes(html, 'sb__res--w', '승 표시');
    includes(html, '1세트 ·', '지금은 1세트(다음 세트를 누르면 2세트)');
    includes(BM.views.log.scoreboardHtml(SB().nextSet(st)), '2세트 ·', '다음 세트로 넘어가면 2세트');
  });

  test('v1.44 화면: 점수판은 시트가 아니라 화면 전체 오버레이로 열린다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    includes(src, "node.className = 'sbfull'", '전체화면 오버레이');
    includes(src, "document.body.appendChild(node)", 'body 위에');
    includes(src, 'UI.overlay.open()', '뒤로 가기 기록');
    includes(src, "window.addEventListener('popstate', sbOnPop)", '뒤로 가기로 닫기');
    includes(src, 'UI.overlay.close()', '닫을 때 기록 정리');
    includes(src, 'data-sb-swap', '코트 교대 배선');
    includes(src, 'SB.resetSet', '세트 초기화 배선');
    var css = readRoot('styles.css');
    ['.sbfull', '.sb--full', '.sb__card', '.sb__tool', '.sb__plus', '.sbfull__hdr'].forEach(function (sel) {
      includes(css, sel, '스타일: ' + sel);
    });
    includes(css, 'position: fixed; inset: 0', '화면을 덮는 고정 레이어');
    includes(css, 'grid-template-rows: 1fr 1fr', '상하 두 카드가 높이를 나눠 씀');
    includes(css, 'clamp(60px, 16vh, 112px)', '큰 점수 숫자');
    includes(css, 'min-height: 54px', '넉넉한 보조 버튼');
  });

  test('v1.44 보안: 점수판 화면도 사용자 입력을 이스케이프한다', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var st = SB().create();
    st.type = PAYLOAD;
    st.mode = 21;
    var html = BM.views.log.scoreboardHtml(st);
    excludes(html, '<img src=x', '점수판 이스케이프');
    /* 검색어·체육관 이름도 화면에 그대로 들어가지 않는다 */
    var g = BM.views.gyms.render({ scope: 'demo_me', query: PAYLOAD });
    excludes(g, '<img src=x', '체육관 검색 이스케이프');
    includes(g, '&lt;img src=x', '검색어는 글자로 보임');
  });

  /* =========================================================
   * 3. 전국 체육관
   * ========================================================= */
  test('v1.44 체육관: 100곳 이상이 7개 권역에 나뉘어 있고 모두 실제 주소·좌표가 있다', function () {
    var list = G().all();
    ok(list.length >= 100, '100곳 이상 (실제 ' + list.length + '곳)');
    var seen = {}, regions = {};
    var keys = G().REGIONS.map(function (r) { return r.key; });
    eq(keys.join(','), 'all,seoul,gg,gangwon,chungcheong,jeolla,gyeongsang', '칩 7개');
    list.forEach(function (v) {
      ok(v.id && !seen[v.id], 'id 중복 없음: ' + v.id);
      seen[v.id] = true;
      ok(v.name && v.name.length >= 3, '이름: ' + v.id);
      ok(v.region && ['서울', '경기·인천', '강원', '충청', '전라', '경상', '제주'].indexOf(v.region) >= 0,
        v.id + ' 권역: ' + v.region);
      ok(v.addr && v.addr.length >= 8, v.id + ' 주소');
      ok(v.lat >= 33 && v.lat <= 39 && v.lng >= 124 && v.lng <= 132, v.id + ' 좌표가 국내');
      regions[v.region] = (regions[v.region] || 0) + 1;
    });
    ['서울', '경기·인천', '강원', '충청', '전라', '경상', '제주'].forEach(function (r) {
      ok(regions[r] >= 5, r + ' 권역에 5곳 이상 (' + (regions[r] || 0) + ')');
    });
    var counts = G().regionCounts();
    eq(counts.all, list.length, '전체 수');
    eq(counts.gangwon, regions['강원'] + regions['제주'], '강원·제주 칩은 두 권역 합');
  });

  test('v1.44 체육관: 수원 남부(매원고·영통·망포·나래울·칠보)가 모두 들어 있다', function () {
    var names = G().all().map(function (v) { return v.name; }).join('|');
    ['매원고등학교 체육관', '영통복합체육센터', '망포종합체육센터', '나래울 배드민턴장', '서수원칠보체육관']
      .forEach(function (n) { includes(names, n, n); });
    var maewon = G().all().filter(function (v) { return v.id === 'maewon'; })[0];
    ok(maewon, '매원고 항목');
    includes(maewon.addr, '수원시 영통구', '매원고 주소');
    ok(Math.abs(maewon.lat - 37.2655) < 0.01 && Math.abs(maewon.lng - 127.0544) < 0.01, '매원고 좌표');
    ok(G().get('naraeul').courts === 10, '나래울 코트 10면 그대로');
  });

  test('v1.44 체육관: 권역으로 좁히면 그 권역만, 검색과 함께 쓰면 둘 다 적용된다', function () {
    var seoul = G().filter(G().all(), { region: 'seoul' });
    ok(seoul.length >= 15, '서울 ' + seoul.length + '곳');
    ok(seoul.every(function (v) { return v.region === '서울'; }), '서울만');
    var gangwon = G().filter(G().all(), { region: 'gangwon' });
    var j = 0;
    gangwon.forEach(function (v) { if (v.region === '강원' || v.region === '제주') j++; });
    eq(j, gangwon.length, '강원·제주 칩은 두 권역');
    eq(G().filter(G().all(), { region: 'all' }).length, G().count(), '전체는 모두');
    eq(G().filter(G().all(), { region: 'seoul', query: '마포' })[0].id, 'mapo', '권역+검색');
    eq(G().filter(G().all(), { region: 'seoul', query: '부산' }).length, 0, '권역 밖 검색은 없음');
    eq(G().filter(G().all(), { query: '부산' })[0].region, '경상', '부산은 경상');
    /* 권역 안에서도 가까운 순·즐겨찾기가 그대로 */
    var near = G().nearby(G().filter(G().all(), { region: 'gg' }), { lat: 37.2644, lng: 127.0852 });
    eq(near[0].id, 'yeongtong', '영통에서 가장 가까운 곳');
    eq(G().inRegion(G().get('jeju-halla'), 'gangwon'), true, '제주는 강원·제주 칩에');
    eq(G().inRegion(G().get('jeju-halla'), 'seoul'), false, '서울 칩에는 없음');
  });

  test('v1.44 화면: 지도 화면에 권역 칩과 검색창이 있고, 칩을 고르면 그 권역만 그린다', function () {
    U.storage.removeItem(G().keyFor('demo_me'));
    var html = BM.views.gyms.render({ scope: 'demo_me' });
    includes(html, 'data-gym-search', '검색창');
    includes(html, '동네·체육관 이름으로 찾기', '검색 안내');
    includes(html, 'gymregions', '권역 칩 줄');
    eq((html.match(/data-gym-region="/g) || []).length, 7, '칩 7개');
    includes(html, 'data-gym-region="seoul"', '서울 칩');
    includes(html, 'data-gym-region="gangwon"', '강원·제주 칩');
    includes(html, 'aria-pressed="true"', '지금 고른 칩');
    eq((html.match(/data-gym-card="/g) || []).length, G().count(), '처음엔 전부');

    var seoulOnly = BM.views.gyms.render({ scope: 'demo_me', region: 'seoul' });
    var n = (seoulOnly.match(/data-gym-card="/g) || []).length;
    eq(n, G().filter(G().all(), { region: 'seoul' }).length, '서울만 카드로');
    excludes(seoulOnly, 'data-gym-card="yeongtong"', '다른 권역 카드는 없음');
    includes(seoulOnly, '서울 <b>', '서울만 보인다는 안내');
    includes(seoulOnly, '전국 배드민턴 ' + G().count() + '곳', '머리말은 전국 수');

    var searched = BM.views.gyms.render({ scope: 'demo_me', query: '수원' });
    includes(searched, '검색 결과 <b>', '검색 결과 안내');
    ok(searched.indexOf('data-gym-card="yeongtong"') >= 0, '수원 검색에 영통');
  });

  test('v1.44 화면: 권역 칩·검색·전체 보기가 지도 맞춤과 배선에 연결돼 있다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/gyms.js');
    includes(src, "closest('[data-gym-region]')", '칩 클릭');
    includes(src, "closest('[data-gym-search]')", '검색 입력');
    includes(src, "addEventListener('input'", '한 글자마다 거르기');
    includes(src, "addEventListener('search'", '검색 지우기(×)도 반영');
    includes(src, 'function fitVisible(', '보이는 곳에 지도 맞춤');
    includes(src, "fitVisible(true)", '권역/검색이 바뀌면 지도 이동');
    includes(src, '지도에 보여요', '지도 안내');
    excludes(src, 'fetch(', '지도 화면은 서버로 보내지 않는다');
    /* 기존 기능 유지 */
    includes(src, 'toggleFav', '즐겨찾기');
    includes(src, 'toggleGeo', '내 위치 기준');
    includes(src, 'onPick', '모집글·프로필에서 체육관 고르기');
  });

  /* =========================================================
   * 5. 버전 · 문서
   * ========================================================= */
  test('v1.44 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.79.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.79.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-1', '스타일 캐시');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.79.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.79.0', 'TWA appVersion');
    eq(twa.appVersionCode, 73, 'TWA 버전 코드 유지');
    includes(readRoot('index.html'), 'js/scoreboard.js', '점수판 스크립트 유지');
    includes(readRoot('sw.js'), "'./js/gyms.js'", '체육관 모듈 캐시 유지');
    includes(readRoot('index.html'), 'js/vendor/leaflet/leaflet.js', '지도 라이브러리 유지');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
