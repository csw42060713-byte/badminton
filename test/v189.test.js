/* ============================================================
 * test/v189.test.js — bm-v1.96.0
 *   📱 폰 바탕화면(안드로이드 라이브 배경화면) 연결
 *
 *   1) 모듈    — BM.wallpaper · 앱 패키지·스킴 · 세 가지 전달 길(브리지 → 딥링크 → 안내)
 *   2) 설정    — 앱(Java WallpaperConfig)과 같은 키 · 지금 입은 파츠의 실제 색
 *   3) 딥링크  — intent://wallpaper?c=… 의 JSON 왕복(인코딩·디코딩)과 패키지 지정
 *   4) 시트    — '📱 폰 바탕화면으로 설정하기' 단추·안내 문구
 *   5) 캐시·버전
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }
  function fileExists(rel) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, rel));
  }

  var W = BM.wallpaper;
  var RC = BM.racketcustom;

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateWith(custom) {
    var me = JSON.parse(JSON.stringify(ME));
    me.theme.gear = { custom: custom };
    return {
      ready: true, mode: 'local', me: me, rows: [],
      data: BM.store.derive([], BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null } },
      ui: { tab: 'my', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* 앱(Java)과 약속한 키 — 한쪽만 바꾸면 여기서 먼저 걸립니다 */
  var KEYS = ['v', 'body', 'name', 'frame', 'frameColor', 'string', 'stringColor', 'grip', 'gripColor',
    'gripColor2', 'stencil', 'stencilColor', 'effect', 'effectColor'];

  /* ============================================================
   * 1. 모듈
   * ============================================================ */

  test('v1.89 모듈: BM.wallpaper 가 있고 앱 패키지·스킴을 앱과 같게 쓴다', function () {
    ok(W, 'BM.wallpaper');
    eq(W.PKG, 'io.github.csw42060713_byte.badminton', '앱 패키지');
    eq(W.SCHEME, 'shuttlix', '딥링크 스킴');
    eq(typeof W.apply, 'function', 'apply');
    eq(typeof W.configOf, 'function', 'configOf');
  });

  test('v1.89 전달: 브리지가 없으면 false(안내만) · 브리지가 있으면 설정을 넘기고 true', function () {
    var st = stateWith(RC.blankCustom());
    var got = null, opened = 0;
    /* 브리지가 없는 기본 상태 — Node 샌드박스에는 navigator 가 없습니다 */
    eq(W.apply(st), false, '브리지·안드로이드 없음 → false');
    root.BadmintonBridge = {
      setWallpaperConfig: function (json) { got = json; },
      openLiveWallpaper: function () { opened++; }
    };
    try {
      eq(W.apply(st), true, '브리지 → true');
      eq(opened, 1, '배경화면 선택창 1회');
      var parsed = JSON.parse(got);
      eq(parsed.v, 1, '설정 버전');
    } finally {
      delete root.BadmintonBridge;
    }
  });

  test('v1.89 환경: 안드로이드가 아니면 설치 안내, 안드로이드면 터치 스매시 안내', function () {
    includes(W.hintText(), '안드로이드', 'PC·아이폰 안내');
    root.navigator = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/131' };
    try {
      ok(W.isAndroid(), '안드로이드 판별');
      includes(W.hintText(), '바탕화면', '안드로이드 안내');
    } finally {
      delete root.navigator;
    }
  });

  /* ============================================================
   * 2. 설정 — 앱(Java)과 같은 키·실제 색
   * ============================================================ */

  test('v1.89 설정: 키가 앱(Java WallpaperConfig)과 같고 값이 모두 문자열이다', function () {
    var cfg = W.configOf(stateWith(RC.blankCustom()));
    eq(Object.keys(cfg).filter(function (k) { return KEYS.indexOf(k) < 0; }).join(','), '', '약속한 키 밖의 값 없음');
    KEYS.forEach(function (k) { ok(typeof cfg[k] === 'string' || typeof cfg[k] === 'number', k + ' 값'); });
    eq(cfg.frame, 'matte', '기본 프레임');
    eq(cfg.frameColor, '#23272b', '매트 블랙');
    eq(cfg.stringColor, '#c6f24e', '형광 라임');
    eq(cfg.gripColor, '#1d2124', '블랙 그립');
    eq(cfg.effect, 'none', '기본 효과 없음');
    eq(cfg.stencilColor, '', '없음(투명)은 빈 값 — 앱이 기본색으로 채움');
    eq(cfg.effectColor, '', '효과 없음도 빈 값');
  });

  test('v1.89 설정: 지금 입은 오닉스 티타늄·코발트·투톤 그립·얼음 스매시가 그대로 넘어간다', function () {
    var c = RC.blankCustom();
    c.unlocked = ['frame:onyx', 'string:cobalt', 'grip:twotone', 'effect:ice', 'stencil:crown', 'body:smash'];
    c.frame = 'onyx'; c.string = 'cobalt'; c.grip = 'twotone'; c.effect = 'ice'; c.stencil = 'crown';
    c.body = 'smash';
    var cfg = W.configOf(stateWith(c));
    eq(cfg.body, 'smash', '바디');
    eq(cfg.frameColor, '#1b1f26', '오닉스 티타늄');
    eq(cfg.stringColor, '#3f7cf2', '코발트 블루');
    eq(cfg.gripColor, '#c6f24e', '투톤 네온 첫 색');
    eq(cfg.gripColor2, '#20252b', '투톤 네온 둘째 색');
    eq(cfg.effect, 'ice', '얼음 스매시');
    eq(cfg.effectColor, '#a9e8ff', '얼음 색');
    eq(cfg.stencil, 'crown', '왕관 스텐실');
    eq(cfg.name, '스매시 맥스', '바디 이름');
  });

  test('v1.89 설정: 열지 않은 파츠는 기본으로 돌아가고 색은 늘 #rrggbb 다', function () {
    var c = RC.blankCustom();
    c.frame = 'onyx';                       /* 열지 않았으니 무시됩니다 */
    var cfg = W.configOf(stateWith(c));
    eq(cfg.frame, 'matte', '잠긴 파츠 → 기본');
    KEYS.forEach(function (k) {
      if (k.indexOf('Color') > 0 && cfg[k]) ok(/^#[0-9a-f]{6}$/i.test(cfg[k]), k + ' 색 형식 ' + cfg[k]);
    });
  });

  /* ============================================================
   * 3. 딥링크
   * ============================================================ */

  test('v1.89 딥링크: intent:// 에 패키지·스킴을 지정하고 JSON 이 왕복한다', function () {
    var st = stateWith(RC.blankCustom());
    var url = W.intentUrl(W.configOf(st));
    ok(url.indexOf('intent://wallpaper?c=') === 0, 'intent 주소');
    includes(url, '#Intent;scheme=shuttlix;package=io.github.csw42060713_byte.badminton;end', '스킴·패키지');
    var raw = url.slice('intent://wallpaper?c='.length, url.indexOf('#Intent'));
    var back = JSON.parse(decodeURIComponent(raw));
    eq(back.frameColor, '#23272b', '디코딩한 프레임 색');
    ok(raw.indexOf('"') < 0 && raw.indexOf('#') < 0, '인코딩되어 그대로 실린다');
  });

  /* ============================================================
   * 4. 시트 단추
   * ============================================================ */

  test('v1.89 시트: 커스텀 라켓 시트에 폰 바탕화면 설정 단추와 안내가 있다', function () {
    var html = RC.sheetBody(stateWith(RC.blankCustom()));
    includes(html, 'data-rk-wallpaper="1"', '단추');
    includes(html, '📱 폰 바탕화면으로 설정하기', '단추 이름');
    includes(html, 'rkwp__hint', '안내 줄');
    includes(readRoot('js/racketcustom.js'), "closest('[data-rk-wallpaper]')", '누름 처리');
    includes(readRoot('js/racketcustom.js'), 'BM.wallpaper.apply', '모듈 연결');
  });

  test('v1.89 시트: 단추는 공유 카드 단추와 같은 줄을 쓰지 않고 그 아래 한 줄을 쓴다', function () {
    var html = RC.sheetBody(stateWith(RC.blankCustom()));
    var share = html.indexOf('data-rk-share="1"');
    var wall = html.indexOf('data-rk-wallpaper="1"');
    ok(share >= 0 && wall > share, '공유 단추 뒤');
    var between = html.slice(share, wall);
    ok(between.indexOf('</div><div class="rkwp">') > 0, '별도 줄');
  });

  /* ============================================================
   * 5. 캐시·버전·금지 사항
   * ============================================================ */

  test('v1.89 캐시: js/wallpaper.js 가 실제 파일이고 index·서비스워커가 함께 싣는다', function () {
    if (!hasNode) return;
    ok(fileExists('js/wallpaper.js'), '파일');
    includes(readRoot('index.html'), 'js/wallpaper.js', 'index.html');
    includes(readRoot('sw.js'), "'./js/wallpaper.js'", 'sw SHELL');
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.100.0'", '캐시 버전');
  });

  test('v1.90 버전: 앱·서비스워커·TWA 가 같은 버전(1.94.0 / 코드 88)', function () {
    if (!hasNode) return;
    includes(readRoot('app.js'), "version: 'v1.100.0'", 'app.js');
    includes(readRoot('js/push.js'), "version: 'v1.100.0'", 'push.js');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.100.0', 'TWA 이름');
    eq(twa.appVersion, '1.100.0', 'TWA appVersion');
    eq(twa.appVersionCode, 94, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.100.0', 'README 변경 이력');
  });

  test('v1.89 금지: 키스토어·비밀번호 같은 비밀 값이 웹 저장소에 없다', function () {
    if (!hasNode) return;
    var w = readRoot('js/wallpaper.js');
    excludes(w, 'storepass', '비밀번호 표현');
    excludes(w, 'keystore', '키스토어');
    /* 비밀번호 문자열 자체는 테스트에도 남기지 않습니다 — 길게 이어진 임의 문자열만 확인 */
    ok(!/[A-Za-z0-9]{28,}/.test(w), '긴 임의 문자열(비밀번호 모양) 없음');
    var html = RC.sheetBody(stateWith(RC.blankCustom()));
    ['김원호', '안세영', '서승재'].forEach(function (n) { excludes(html, n, '실존 선수 이름'); });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
