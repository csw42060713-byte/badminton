/* ============================================================
 * test/v133.test.js — bm-v1.37.2
 *   고도화 5차 사이클: 여백을 가벼운 SVG 그림으로 채우기.
 *
 *   1) 빈 화면(Empty State) 배드민턴 선화 일러스트
 *      · art.js가 log·search·community·coach·send·spark 여섯 그림을 인라인 SVG로 만든다
 *      · 한 장이 3~5KB 이내 · 색은 테마 변수(CSS 클래스)만 · 화면 높이 56~88px
 *      · UI.emptyState가 그림을 먼저 그리고, 모르는 kind는 예전 24px 아이콘으로 되돌아간다
 *      · 일지·매칭(조건 미선택·결과 없음)·커뮤니티·코치 빈 화면에 실제로 들어간다
 *
 *   2) 히어로 카드 코트 선화 워터마크
 *      · 다섯 화면 맨 위 카드(일지 & AI·매칭·커뮤니티·코치·MY)의 오른쪽 여백에만
 *      · 투명도 0.06~0.12 · mask로 테마 포인트 색을 따라감 · 누르기는 통과
 *
 *   3) 버전 정합(sw.js · app.js · styles.css · twa-manifest)
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

  var ME = 'u_v133_me';
  var NOW = '2026-11-21';
  var KINDS = ['log', 'search', 'community', 'coach', 'send', 'spark'];

  /* 화면용 상태 — 실제 앱 state 모양 */
  function stateOf(patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: [], posts: [], threads: [], matchProfiles: [], feedback: [], requests: [], rooms: [],
        mentorApps: [], coachApps: [], hearts: { balance: 3, earned: 0, spent: 0, todayEarned: 0, adUsedToday: 0, adLimit: 5, checkedInToday: false, checkinReward: 1, adCooldownSec: 30, matchCost: 2, giftCost: 5, history: [] },
        idx: { all: [], byType: {}, byId: {} },
        stats: { streak: 0, sessions14: 0, winRate: null, minutesMonth: 0, avgCond: null },
        unread: 0, guests: []
      },
      drafts: {
        log: {
          date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [],
          games: [{ a: '', b: '' }], pain: [], note: '', partner: '', video: '', videoNote: ''
        }
      },
      ui: { tab: 'log', challengeNow: NOW, matchFilter: { level: '전체', region: '전체', discipline: '전체' }, coachTab: 'feedback' },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      routine: {}, routinePref: false
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.data) st.data = Object.assign({}, st.data, patch.data);
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function html(htmlIn, label) {
    ok(htmlIn && htmlIn.length > 20, label + ': 화면이 비어 있습니다');
    excludes(htmlIn, 'undefined', label + ': undefined가 출력됨');
    excludes(htmlIn, 'NaN', label + ': NaN이 출력됨');
    return htmlIn;
  }

  /* =========================================================
   * 1. 그림 자체 — 모양·크기·색·안전성
   * ========================================================= */

  test('v1.33 그림: 여섯 빈 화면 그림이 모두 인라인 SVG로 나온다', function () {
    ok(BM.art, 'BM.art가 있어야 합니다');
    KINDS.forEach(function (k) {
      var s = BM.art.empty(k);
      ok(s.length > 100, k + ': 그림이 비었습니다');
      includes(s, '<svg', k + ': svg 태그');
      includes(s, 'class="empty__art"', k + ': empty__art 클래스');
      includes(s, 'viewBox="0 0 168 96"', k + ': 그림 상자');
      includes(s, 'aria-hidden="true"', k + ': 보조기기에서 숨김');
      includes(s, 'focusable="false"', k + ': 탭 순서 제외');
      excludes(s, 'width="', k + ': 너비는 CSS가 정한다');
      excludes(s, '<image', k + ': 외부 이미지 없음');
      excludes(s, 'http', k + ': 바깥 주소 없음');
    });
  });

  test('v1.33 그림: 그림 한 장은 5KB를 넘지 않는다 (가벼운 벡터)', function () {
    KINDS.forEach(function (k) {
      var s = BM.art.empty(k);
      ok(s.length < 5120, k + ': ' + s.length + '바이트');
      ok(s.length > 300, k + ': 너무 비어 있습니다');
    });
  });

  test('v1.33 그림: 그림마다 모양이 다르다 (같은 그림 복사 아님)', function () {
    var seen = {};
    KINDS.forEach(function (k) {
      var s = BM.art.empty(k);
      ok(!seen[s], k + ': 다른 화면과 같은 그림입니다');
      seen[s] = 1;
    });
    eq(BM.art.kinds.length, KINDS.length, '그림 종류 수');
  });

  test('v1.33 그림: path는 모두 M으로 시작하고 좌표가 숫자다', function () {
    KINDS.forEach(function (k) {
      var s = BM.art.empty(k);
      var ds = s.match(/d="([^"]+)"/g) || [];
      ok(ds.length >= 2, k + ': path가 있습니다');
      ds.forEach(function (attr) {
        var d = attr.slice(3, -1);
        ok(/^M[-0-9. ]/.test(d), k + ': path는 M으로 시작 (' + d.slice(0, 16) + ')');
        excludes(d, 'NaN', k + ': NaN 좌표');
        excludes(d, 'undefined', k + ': undefined 좌표');
        excludes(d, ',,', k + ': 잘못된 구분');
      });
    });
  });

  test('v1.33 그림: 색은 테마 변수만 쓴다 (고정 색·그라데이션 없음)', function () {
    KINDS.forEach(function (k) {
      var s = BM.art.empty(k);
      /* fill/stroke 색을 직접 적지 않고 CSS 클래스(st·st-f·st-a·st-d)로 넘깁니다 */
      excludes(s, 'fill="#', k + ': 고정 fill');
      excludes(s, 'stroke="#', k + ': 고정 stroke');
      excludes(s, 'rgb(', k + ': 고정 rgb');
      excludes(s, 'url(#', k + ': 그라데이션 참조');
      ok(/class="st/.test(s), k + ': 선화 클래스');
    });
  });

  test('v1.33 그림: 모르는 kind는 빈 문자열 — 예전 아이콘으로 돌아간다', function () {
    eq(BM.art.empty('nope'), '', '모르는 kind');
    eq(BM.art.empty(''), '', '빈 kind');
    eq(BM.art.empty(), '', 'kind 없음');
    eq(BM.art.empty('heart'), '', '그림 없는 kind');
  });

  test('v1.33 그림: 셔틀콕·라켓·코트 조각을 그대로 쓸 수 있다', function () {
    ['shuttle', 'racket', 'court'].forEach(function (fn) {
      eq(typeof BM.art[fn], 'function', fn + ' 함수');
      var s = BM.art[fn](40, 40, 1, 0);
      includes(s, '<g', fn + ': 그룹');
      includes(s, 'transform="translate(40 40)', fn + ': 위치');
    });
    includes(BM.art.shuttle(10, 10, 1, 0, 'st-a'), 'class="st-a"', '강조 색 셔틀콕');
  });

  /* =========================================================
   * 2. UI.emptyState — 그림 + 글자 + 버튼
   * ========================================================= */

  test('v1.33 빈 화면: emptyState가 그림을 먼저 그리고 글자를 그대로 둔다', function () {
    var out = BM.ui.emptyState('log', '아직 기록이 없어요', '오늘 일지를 저장하면 여기에 쌓입니다.');
    includes(out, 'class="empty empty--art"', '그림 있는 빈 화면 표시');
    includes(out, '<svg class="empty__art"', '그림');
    includes(out, '아직 기록이 없어요', '제목');
    includes(out, '오늘 일지를 저장하면 여기에 쌓입니다.', '설명');
    includes(out, 'empty__t', '제목 클래스');
    includes(out, 'empty__s', '설명 클래스');
  });

  test('v1.33 빈 화면: 그림이 없는 kind는 24px 아이콘 그대로', function () {
    var out = BM.ui.emptyState('bell', '알림이 없어요');
    includes(out, 'class="empty"', '기본 빈 화면');
    excludes(out, 'empty__art', '그림 없음');
    includes(out, 'class="ico', '아이콘');
    excludes(out, 'empty--art', '그림 표시 없음');
  });

  test('v1.33 빈 화면: 제목·설명·버튼 글자는 그대로 이스케이프된다', function () {
    var bad = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
    var out = BM.ui.emptyState('community', bad, bad, '<button class="btn">첫 글</button>');
    excludes(out, '<img src=x', '제목 이스케이프');
    excludes(out, '<script>alert(2)', '설명 이스케이프');
    includes(out, '&lt;img', '글자로 보임');
    includes(out, '<button class="btn">첫 글</button>', '버튼 HTML은 그대로');
  });

  /* =========================================================
   * 3. 화면별로 실제로 들어갔는지 (빈 데이터로 렌더)
   * ========================================================= */

  test('v1.33 일지: 기록이 없으면 코트 그림 + 안내', function () {
    var out = html(BM.views.log.render(stateOf()), '일지');
    includes(out, 'empty__art', '기록 없음 그림');
    includes(out, '아직 기록이 없어요', '안내 문구');
  });

  test('v1.33 매칭: 조건을 고르기 전 안내 카드에도 그림이 있다', function () {
    var out = html(BM.views.matching.render(stateOf({ ui: { tab: 'matching', matchFilter: {} } })), '매칭');
    includes(out, 'matchintro', '안내 카드');
    includes(out, 'matchintro__art', '안내 카드 그림');
    includes(out, 'empty__art', '그림 svg');
  });

  test('v1.33 매칭: 조건을 풀어도 선수가 없으면 그림 + 첫 행동 버튼', function () {
    var out = html(BM.views.matching.render(stateOf({ ui: { tab: 'matching', matchFilter: { level: '전체', region: '전체', discipline: '전체' } } })), '매칭 결과 없음');
    includes(out, 'empty__art', '결과 없음 그림');
    includes(out, '아직 등록된 선수가 없어요', '결과 없음 안내');
    includes(out, '내 매칭 카드 만들기', '첫 행동 버튼');
  });

  test('v1.33 커뮤니티: 글이 없으면 네트 그림', function () {
    var out = html(BM.views.community.render(stateOf()), '커뮤니티');
    includes(out, 'empty__art', '빈 글 그림');
    includes(out, '아직 글이 없어요', '안내 문구');
  });

  test('v1.33 코치: 선수 화면에서 받은 피드백이 없으면 그림', function () {
    var out = html(BM.views.coach.render(stateOf()), '코치');
    includes(out, 'empty__art', '피드백 없음 그림');
    includes(out, '받은 피드백이 아직 없어요', '안내 문구');
    includes(out, 'card--coach', '코치 상단 카드');
  });

  test('v1.33 채팅: 대화가 없으면 네트 그림', function () {
    ok(BM.views.chat, 'chat 화면');
    var src = readRoot('js/views/chat.js');
    includes(src, "UI.emptyState('community'", '채팅 빈 화면도 같은 그림');
    includes(BM.art.empty('community'), 'empty__art', '그림');
  });

  test('v1.33 MY: 프로필 카드에 워터마크 클래스가 있다', function () {
    var out = html(BM.views.my.render(stateOf()), 'MY');
    includes(out, 'card--profile', '프로필 카드');
  });

  /* =========================================================
   * 4. 스타일 — 크기(56~88px) · 테마 변수 · 워터마크 투명도
   * ========================================================= */

  test('v1.33 스타일: 빈 화면 그림 높이가 56~88px이고 CSS가 크기를 정한다', function () {
    var css = readRoot('styles.css');
    includes(css, '.empty__art', '그림 클래스');
    var m = css.match(/\.empty__art\s*\{[^}]*height:\s*(\d+)px/);
    ok(m, 'height 지정');
    var h = Number(m[1]);
    ok(h >= 56 && h <= 88, '높이 56~88px (실제 ' + h + 'px)');
    includes(css, 'display: block', '가운데 정렬용 블록');
    includes(css, 'margin: 0 auto', '가운데');
  });

  test('v1.33 스타일: 그림 색은 테마 변수(currentColor·--accent·--muted)를 따른다', function () {
    var css = readRoot('styles.css');
    includes(css, '.empty__art .st {', '기본 선');
    includes(css, 'stroke: currentColor', '기본 선은 글자색');
    includes(css, '.empty__art .st-a {', '포인트 선');
    includes(css, 'stroke: var(--accent)', '포인트 선은 테마 포인트');
    includes(css, '.empty__art .st-d {', '점선 궤적');
    includes(css, 'stroke-dasharray', '점선');
    includes(css, 'var(--muted)', '옅은 회색도 테마 변수');
  });

  test('v1.33 스타일: 다섯 화면 맨 위 카드에 코트 선화가 깔린다', function () {
    var css = readRoot('styles.css');
    ['.card--hero', '.card--match', '.card--composer', '.card--profile', '.card--coach'].forEach(function (c) {
      includes(css, c + '::after', c + ' 워터마크');
      var posRule = css.match(/\.card--hero,\s*\.card--match[^{]*\{[^}]*position: relative/);
      ok(posRule, c + ' 기준 위치');
    });
  });

  test('v1.33 스타일: 워터마크는 0.06~0.12 투명도 · mask로 테마 색을 따른다', function () {
    var css = readRoot('styles.css');
    includes(css, '--courtmark:', '코트 선화 자리');
    includes(css, 'data:image/svg+xml', '인라인 SVG');
    ok(/--courtmark:\s*url\("data:image\/svg\+xml,/.test(css), 'url() 안 data URI');
    var ops = (css.match(/\.card--[a-z]+::after\s*\{[^}]*opacity:\s*([0-9.]+)/g) || [])
      .map(function (block) { return Number(block.match(/opacity:\s*([0-9.]+)/)[1]); });
    ok(ops.length >= 3, '투명도 규칙');
    ops.forEach(function (o) { ok(o >= 0.06 && o <= 0.12, '투명도 0.06~0.12 (실제 ' + o + ')'); });
    includes(css, 'mask: var(--courtmark)', 'mask');
    includes(css, '-webkit-mask: var(--courtmark)', '사파리 mask');
    includes(css, 'pointer-events: none', '누르기 통과');
  });

  test('v1.33 스타일: 워터마크는 글자 위가 아니라 여백에만 놓인다 (인라인 블록 아님)', function () {
    var css = readRoot('styles.css');
    var block = css.match(/\.card--hero::after[^{]*\{[^}]*\}/);
    ok(block, 'hero 규칙');
    includes(block[0], 'position: absolute', '절대 위치');
    includes(block[0], 'background: var(--accent)', '테마 포인트 색');
  });

  test('v1.33 스타일: 작은 화면에서는 그림을 한 단계 줄인다', function () {
    var css = readRoot('styles.css');
    includes(css, '@media (max-height: 660px)', '낮은 화면 규칙');
    ok(/@media \(max-height: 660px\) \{ \.empty__art \{ height: \d+px; \} \}/.test(css), '낮은 화면 높이');
  });

  /* =========================================================
   * 5. 버전 정합 · 캐시 목록
   * ========================================================= */

  test('v1.33 버전: sw.js·app.js·index.html·twa-manifest가 모두 v1.33', function () {
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.60.0'", 'sw.js');
    includes(app, "version: 'v1.60.0'", 'app.js');
    includes(index, 'styles.css?v=20261123-4', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.60.0', 'twa appVersionName');
    eq(twa.appVersion, '1.60.0', 'twa appVersion');
    eq(twa.appVersionCode, 54, 'twa appVersionCode');
  });

  test('v1.33 캐시: art.js가 index.html과 sw.js 캐시 목록에 있다', function () {
    var sw = readRoot('sw.js'), index = readRoot('index.html');
    includes(index, 'js/art.js', 'index.html 스크립트');
    includes(sw, "'./js/art.js'", 'sw.js 캐시');
    ok(index.indexOf('js/art.js') < index.indexOf('app.js'), 'art.js는 app.js보다 먼저');
  });

  test('v1.33 회귀: 기존 화면 기능은 그대로 있다', function () {
    var log = readRoot('js/views/log.js'), mat = readRoot('js/views/matching.js');
    var com = readRoot('js/views/community.js'), co = readRoot('js/views/coach.js');
    includes(log, 'data-form="log"', '일지 폼');
    includes(log, 'data-act="save-log"', '일지 저장');
    includes(mat, 'data-act="edit-match"', '매칭 카드');
    includes(com, 'data-composer', '커뮤니티 글쓰기');
    includes(co, 'data-act="go-log"', '코치 → 일지');
    includes(readRoot('js/scoreboard.js'), 'BM.scoreboard', '코트 점수판');
    includes(readRoot('js/timer.js'), 'BM.timer', '드릴 타이머');
  });

  test('v1.33 보안: 그림 파일에 시트 ID·비밀 키·바깥 주소가 없다', function () {
    var art = readRoot('js/art.js');
    excludes(art, '1sqxAM6eskBYS03s', '시트 ID 없음');
    excludes(art, 'supabase', '서버 주소 없음');
    excludes(art, 'eyJ', '토큰 없음');
    excludes(art, '<script', '스크립트 없음');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
