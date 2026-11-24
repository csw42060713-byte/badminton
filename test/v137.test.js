/* ============================================================
 * test/v137.test.js — bm-v1.37.2
 *   [앱 시작 로딩(스플래시) · 시작화면 브랜드 영역 디자인 업그레이드]
 *   1) 스플래시(index.html)
 *      · 이모지(🏸) 대신 새 로고(icons/icon-512.png)를 라운드 타일로 감쌈
 *      · BADMINTON 킥커 · 배드민턴 타이틀 · 준비 문구 · 얇은 진행선
 *      · role="status" + aria-label (스크린리더가 '준비 중'을 알 수 있게)
 *   2) 스타일(styles.css)
 *      · .splash__tile 24px 라운드 · 어두운 타일 · 에메랄드 테두리/그림자/맥동
 *      · 340ms 페이드아웃(.is-off) · 라이트/사쿠라 테마 보정 · 로고 가장자리 보정(scale 1.06)
 *      · 시작화면 .start__mark · .start__mini 도 같은 타일 감각
 *   3) 시작 코드(app.js)
 *      · 최소 노출 300~500ms(현재 420ms) 뒤 페이드 — 두 번 불러도 한 번만
 *      · 기존 부팅 순서(bootstrapRecovery → enterApp/showGate)는 그대로
 *   4) 버전 정합(sw · app · index · TWA · README · ideas) · 회귀 · 보안
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function exists(rel) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, rel));
  }
  /* index.html에서 스플래시 블록만 잘라 냅니다(헤더 앞까지) */
  function splashBlock(html) {
    var a = html.indexOf('<div id="splash"');
    var b = html.indexOf('<header class="hdr"');
    return a >= 0 && b > a ? html.slice(a, b) : '';
  }

  /* =========================================================
   * 1. 스플래시 화면 구조 (index.html)
   * ========================================================= */
  test('v1.37 스플래시: 이모지 대신 새 로고를 라운드 타일에 담는다', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    var sp = splashBlock(html);
    ok(sp, '스플래시 블록을 찾는다');
    includes(sp, 'class="splash"', '스플래시 컨테이너');
    includes(sp, 'class="splash__tile"', '라운드 타일');
    includes(sp, 'class="splash__logo"', '로고 그림');
    includes(sp, 'src="icons/icon-512.png"', '새 앱 로고(icon-512)');
    includes(sp, 'alt=""', '장식용 그림이라 alt는 비움');
    includes(sp, 'fetchpriority="high"', '첫 화면이므로 먼저 받기');
    includes(sp, 'decoding="async"', '그림 디코딩이 첫 페인트를 막지 않게');
    includes(sp, 'class="splash__glow"', '뒤의 은은한 빛');
    excludes(sp, '🏸', '이모지 로고는 남기지 않는다');
  });

  test('v1.37 스플래시: 타이틀·서브 문구·진행선이 있다', function () {
    if (!hasNode) return;
    var sp = splashBlock(readRoot('index.html'));
    includes(sp, 'class="splash__brand"', 'BADMINTON 킥커');
    includes(sp, '>BADMINTON<', '브랜드 글자');
    includes(sp, 'class="splash__t"', '앱 타이틀');
    includes(sp, '>배드민턴<', '타이틀 글자');
    includes(sp, 'class="splash__s"', '서브 문구');
    includes(sp, '오늘의 코트를 준비하고 있어요', '준비 문구');
    includes(sp, 'class="splash__bar"', '얇은 진행선');
  });

  test('v1.37 스플래시: 스크린리더가 준비 중임을 알 수 있다', function () {
    if (!hasNode) return;
    var sp = splashBlock(readRoot('index.html'));
    includes(sp, 'role="status"', '상태 영역');
    includes(sp, 'aria-label="앱을 준비하고 있어요"', '상태 이름');
    includes(sp, 'aria-hidden="true"', '장식 요소는 읽지 않게');
  });

  /* =========================================================
   * 2. 스타일 (styles.css)
   * ========================================================= */
  test('v1.37 스타일: 스플래시가 화면 전체를 덮고 부드럽게 사라진다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.splash.is-off { opacity: 0; visibility: hidden; pointer-events: none; }', '페이드 뒤 누를 수 없게');
    includes(css, 'transition: opacity 340ms cubic-bezier(0.22, 0.61, 0.36, 1), visibility 0s linear 340ms;', '340ms 페이드');
    includes(css, 'place-items: center;', '가운데 정렬');
    includes(css, 'position: fixed;', '화면 고정');
  });

  test('v1.37 스타일: 로고를 24px 라운드 타일 + 에메랄드 테두리로 감싼다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    var i = css.indexOf('.splash__tile {');
    var block = css.slice(i, css.indexOf('}', i) + 1);
    includes(block, 'border-radius: 24px', '라운드 24px');
    includes(block, 'overflow: hidden', '그림 모서리 자르기');
    includes(block, 'background: #0a0d0b', '어두운 사각 아이콘이 떠 보이게');
    includes(block, 'rgba(67, 223, 160, 0.32)', '에메랄드 테두리');
    includes(block, 'animation: splashPulse', '맥동');
  });

  test('v1.37 스타일: 맥동·빛·진행선 애니메이션이 정의되어 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['@keyframes splashPulse', '@keyframes splashGlow', '@keyframes splashSlide', '@keyframes splashIn'].forEach(function (k) {
      includes(css, k, k);
    });
    /* 맥동은 그림자만 움직여 레이아웃을 건드리지 않는다 */
    var pulse = css.slice(css.indexOf('@keyframes splashPulse'));
    includes(pulse.slice(0, 400), 'box-shadow', '그림자 맥동');
    excludes(pulse.slice(0, 400), 'width:', '크기 변화 없음');
  });

  test('v1.37 스타일: 라이트·사쿠라 테마에서도 로고가 떠 보인다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '[data-theme="th_def"] .splash,', '라이트 테마 보정');
    includes(css, '[data-theme="th_sakura"] .splash', '사쿠라 테마 보정');
    includes(css, '--em: #43dfa0', '밤 테마 에메랄드');
    includes(css, '--em: #0f8f63', '밝은 테마 에메랄드(대비 확보)');
  });

  test('v1.37 스타일: 로고 그림 가장자리의 검은 여백을 잘라 낸다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.splash__logo { width: 100%; height: 100%; object-fit: cover; transform: scale(1.06); }', '타일을 꽉 채우기');
  });

  test('v1.37 스타일: 시작화면 로고도 같은 타일이고 이모지 그라데이션은 없다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    var i = css.indexOf('.start__mark {');
    var block = css.slice(i, css.indexOf('}', i) + 1);
    includes(block, 'width: 92px; height: 92px', '같은 크기');
    includes(block, 'border-radius: 24px', '같은 라운드');
    includes(block, 'background: #0a0d0b', '같은 어두운 타일');
    includes(css, '.start__mark img {', '로고 그림');
    excludes(css, 'linear-gradient(150deg, color-mix(in srgb, var(--accent) 20%, var(--card)), var(--card))', '예전 그라데이션 타일 제거');
    includes(css, '.start__mini', '이메일 화면 미니 로고');
  });

  test('v1.37 스타일: 움직임 줄이기 설정에서는 애니메이션이 멈춘다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '@media (prefers-reduced-motion: reduce)', '움직임 줄이기');
    includes(css, 'animation-duration: 0.01ms !important', '애니메이션 정지');
  });

  test('v1.37 안전망: 화면이 못 떠도 6초 뒤 로딩 화면이 스스로 걷힌다', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    var sp = splashBlock(html);
    includes(sp, '}, 6000);', '6초 타이머');
    includes(sp, "var sp = document.getElementById('splash');", '스플래시를 찾고');
    includes(sp, "if (sp) sp.classList.add('is-off');", '스스로 걷음');
  });

  /* =========================================================
   * 3. 시작화면 (js/views/start.js)
   * ========================================================= */
  test('v1.37 시작화면: 브랜드 로고가 새 로고 타일이다', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js');
    includes(start, '<div class="start__mark"><img src="icons/icon-512.png"', '시작화면 로고');
    excludes(start, '<span>🏸</span>', '이모지 제거');
    includes(start, 'BADMINTON LOG', '킥커 유지');
    includes(start, '배드민턴 분석', '앱 이름 유지');
  });

  test('v1.37 시작화면: 이메일 화면 위 작은 로고도 새 로고로 정돈', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js');
    includes(start, '<img class="start__mini" src="icons/icon-192.png"', '미니 로고 타일');
    includes(start, 'class="start__tiny"', '브랜드 줄 유지');
    /* 구글 마크는 'Google로 계속하기' 버튼에만 남는다 */
    var tiny = start.slice(start.indexOf('class="start__tiny"'), start.indexOf('</span>', start.indexOf('class="start__tiny"')));
    excludes(tiny, 'googleMark()', '브랜드 줄의 구글 마크 제거');
  });

  test('v1.37 회귀: 로그인 세 갈래 길과 온보딩은 그대로다', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js');
    includes(start, 'data-act="google"', 'Google 로그인');
    includes(start, 'data-act="to-email"', '이메일 로그인');
    includes(start, 'data-act="guest"', '둘러보기(체험)');
    includes(start, 'googleMark()', '구글 마크는 버튼에 그대로');
    includes(start, 'mountOnboarding', '온보딩 유지');
    includes(start, 'if (act.dataset.busy === \'1\') return', '구글 로그인 연타 방지 유지');
  });

  /* =========================================================
   * 4. 시작 코드 (app.js)
   * ========================================================= */
  test('v1.37 시작 코드: 스플래시 최소 노출은 300~500ms다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var m = app.match(/var SPLASH_MIN_MS = (\d+);/);
    ok(m, 'SPLASH_MIN_MS 상수');
    var ms = Number(m[1]);
    ok(ms >= 300 && ms <= 500, '최소 노출 범위(300~500ms) — 실제: ' + ms);
  });

  test('v1.37 시작 코드: 준비가 빨라도 남은 시간만 기다렸다가 걷어낸다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var i = app.indexOf('function hideSplash()');
    var block = app.slice(i, app.indexOf('function setNav(', i));
    includes(block, 'if (!sp || splashOff) return;', '두 번 불러도 한 번만');
    includes(block, 'var left = SPLASH_MIN_MS - (Date.now() - splashShownAt);', '남은 시간 계산');
    includes(block, 'setTimeout(function () { sp.classList.add(\'is-off\'); }, left);', '남은 시간 뒤 페이드');
    includes(block, 'sp.classList.add(\'is-off\');', '이미 지났으면 바로 페이드');
  });

  test('v1.37 회귀: 부팅 순서와 세션 복구는 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    includes(app, 'BM.auth.bootstrapRecovery', '비밀번호 재설정·세션 복구 유지');
    includes(app, 'if (sess) enterApp(sess);', '세션이 있으면 바로 앱으로');
    includes(app, 'else showGate();', '없으면 시작화면');
    /* 두 곳(게이트·앱 진입)에서 부르는 것은 예전과 같다 */
    eq((app.match(/hideSplash\(\);/g) || []).length, 2, 'hideSplash 호출 두 곳 유지');
  });

  test('v1.37 회귀: 5개 탭과 주요 화면이 그대로 연결되어 있다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "{ id: '" + id + "'", '탭 ' + id);
    });
    var index = readRoot('index.html');
    ['js/views/log.js', 'js/views/matching.js', 'js/views/community.js', 'js/views/coach.js', 'js/views/my.js']
      .forEach(function (f) { includes(index, f, '화면 ' + f); });
  });

  /* =========================================================
   * 5. 버전 · 캐시 정합
   * ========================================================= */
  test('v1.37 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.68.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.68.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261124-6', 'index.html 스타일 캐시');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.68.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.68.0', 'TWA appVersion');
    eq(twa.appVersionCode, 62, 'TWA 버전 코드(웹만 바뀌면 그대로)');
  });

  test('v1.37 버전: sw.js 변경 이력에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, '스플래시', '스플래시');
    includes(sw, '420ms', '최소 노출');
    includes(sw, '340ms', '페이드');
  });

  test('v1.37 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var doc = readRoot('ideas.md');
    includes(doc, 'v1.37.2', '이번 사이클');
    includes(doc, '반영 완료', '반영 표시');
    var readme = readRoot('README.md');
    includes(readme, 'v1.37.2', 'README 변경 이력');
  });

  /* =========================================================
   * 6. 회귀 · 보안 · 파일
   * ========================================================= */
  test('v1.37 파일: 로고 파일이 실제로 있고 캐시에 들어 있다', function () {
    if (!hasNode) return;
    ['icons/icon-512.png', 'icons/icon-192.png'].forEach(function (f) {
      ok(exists(f), '저장소에 있는 파일: ' + f);
    });
    var sw = readRoot('sw.js');
    includes(sw, "'./icons/icon-512.png'", 'sw 캐시: icon-512');
    includes(sw, "'./icons/icon-192.png'", 'sw 캐시: icon-192');
    includes(sw, "'./styles.css'", 'sw 캐시: styles.css');
  });

  test('v1.37 보안: 스플래시가 바깥 주소를 부르지 않는다', function () {
    if (!hasNode) return;
    var sp = splashBlock(readRoot('index.html'));
    excludes(sp, 'http://', '평문 주소 없음');
    excludes(sp, 'https://', '바깥 그림·글꼴 없음');
    excludes(sp, 'onclick=', '인라인 스크립트 없음');
  });

  test('v1.37 회귀: 스플래시는 예전 id와 .is-off를 그대로 쓴다', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    includes(html, 'id="splash"', 'id 유지(기존 코드가 찾는 이름)');
    var app = readRoot('app.js');
    includes(app, "var sp = el('splash');", '시작 코드가 같은 id를 찾는다');
    includes(app, "classList.add('is-off')", 'CSS와 같은 클래스');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
