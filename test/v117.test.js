/* ============================================================
 * test/v117.test.js — v1.17.0 (2026-11-20)
 *  1) 검정 배경 오류: <html>에 박혀 있던 검정 배경·나이트 테마를 걷어 낸다
 *  2) 첫 페인트 전에 저장된 테마를 칠한다 (밝은 테마인데 검정이 번쩍이지 않게)
 *  3) 테마마다 바탕색·크롬(theme-color) 색이 함께 바뀐다 (CSS --bg == app.js THEME_CHROME)
 *  4) 화면 바탕은 html까지 테마 색으로 칠하고, 가로 넘침은 잘라 검정 띠를 만들지 않는다
 *  5) 디자인 폴리싱: 카드·칩·버튼·탭바·하트 카드가 한 벌의 값으로 정돈된다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* CSS에서 테마별 --bg 값을 뽑습니다 (html 배경·크롬 색이 같은 값인지 비교하려고) */
  function cssBg(css, id) {
    var block;
    if (id === 'th_night') {
      block = css.slice(css.indexOf(':root {'), css.indexOf('[data-theme="th_def"]'));
    } else {
      var start = css.indexOf('[data-theme="' + id + '"] {');
      if (start < 0) return '';
      block = css.slice(start, css.indexOf('}', start));
    }
    var m = block.match(/--bg:\s*(#[0-9a-fA-F]{3,8})/);
    return m ? m[1].toLowerCase() : '';
  }

  test('v1.17 검정 배경: html에 검정 배경·나이트 테마가 박혀 있지 않다', function () {
    if (!hasNode()) return;
    var html = readRoot('index.html');
    var head = html.slice(0, html.indexOf('<body'));
    excludes(head, 'style="background:#080b0a"', 'html 인라인 검정 배경 없음');
    excludes(head, 'data-theme="th_night"', '기본 테마는 밝은 코트');
    includes(head, '<html lang="ko" data-theme="th_def"', '기본 data-theme=th_def');
    includes(head, 'name="theme-color" content="#f6f8f6"', '주소창 색도 밝은 바탕');
    includes(head, 'name="color-scheme" content="light dark"', '스크롤바·입력칸은 밝은 우선');
    excludes(head, 'content="dark light"', '어두운 우선 제거');
  });

  test('v1.17 첫 페인트: 저장된 테마를 먼저 칠하고 크롬 색도 함께 바꾼다', function () {
    if (!hasNode()) return;
    var html = readRoot('index.html');
    var app = readRoot('app.js');
    includes(html, 'bm_cache_v1', '저장된 상태에서 테마를 읽는다');
    includes(html, 'de.setAttribute(\'data-theme\', theme)', '첫 페인트 전 data-theme');
    includes(html, 'meta[name="theme-color"]', '첫 페인트 전 크롬 색');
    includes(app, 'var THEME_CHROME', '앱도 테마별 크롬 색을 안다');
    includes(app, 'themeMeta.setAttribute', '테마를 바꾸면 크롬 색도 바뀐다');
  });

  test('v1.17 설치형 앱: 실행 화면 바탕도 검정이 아니다', function () {
    if (!hasNode()) return;
    ['manifest.json', 'manifest.webmanifest'].forEach(function (file) {
      var m = JSON.parse(readRoot(file));
      eq(m.background_color, '#f6f8f6', file + ' 실행 바탕');
      eq(m.theme_color, '#f6f8f6', file + ' 테마 색');
    });
  });

  test('v1.17 테마 색: CSS 바탕색과 앱 크롬 색이 테마마다 같다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    var app = readRoot('app.js');
    var m = app.match(/var THEME_CHROME = \{([^}]*)\}/);
    ok(m, 'THEME_CHROME 정의');
    var map = {};
    m[1].split(',').forEach(function (pair) {
      var kv = pair.split(':');
      if (kv.length < 2) return;
      map[kv[0].trim().replace(/['"]/g, '')] = kv[1].trim().replace(/['"]/g, '').toLowerCase();
    });
    ['th_def', 'th_sakura', 'th_night', 'th_court'].forEach(function (id) {
      var bg = cssBg(css, id);
      ok(bg, id + ' --bg 값');
      eq(map[id], bg, id + ' 크롬 색 = --bg');
    });
  });

  test('v1.17 바탕: html까지 테마 색으로 칠하고 가로 넘침을 자른다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    includes(css, 'html {', 'html 규칙');
    ok(/html\s*\{[^}]*background-color:\s*var\(--bg\)/.test(css), 'html 배경 = var(--bg)');
    ok(/html\s*\{[^}]*overflow-x:\s*clip/.test(css), '가로 스크롤 띠 방지');
    ok(/body\s*\{[^}]*background-color:\s*var\(--bg\)/.test(css), 'body도 테마 색');
    includes(css, 'scrollbar-color', '스크롤바도 테마 색');
    excludes(css, 'body::before', '검정 배경 레이어 없음');
  });

  test('v1.17 디자인: 카드·칩·버튼·탭바가 한 벌의 값으로 정돈된다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    /* 17장(디자인 폴리싱)이 마지막에 한 번 더 정리합니다 */
    includes(css, '17. 디자인 폴리싱', '폴리싱 절');
    var tail = css.slice(css.indexOf('17. 디자인 폴리싱'));
    ok(/\.card\s*\{[^}]*border-radius:\s*var\(--r-lg\)/.test(tail), '카드 라운드 통일');
    ok(/\.chip\.is-on\s*\{[^}]*background:\s*var\(--accent-soft\)/.test(tail), '칩 선택은 옅은 면');
    ok(/\.btn--primary\s*\{[^}]*background:\s*var\(--accent\)/.test(tail), '주요 버튼은 단색');
    excludes(tail, 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, #fff)', '형광 그라데이션 제거');
    ok(/\.card--heart\s*\{[^}]*background:\s*var\(--card\)/.test(tail), '하트 카드는 중성 표면');
    ok(/\.tab\s*\{[^}]*height:\s*46px/.test(tail), '탭바 높이 정돈');
    includes(tail, '@media (pointer: coarse)', '손가락 44px 유지');
  });

  test('v1.17 회귀: 기존 화면 규칙은 그대로 남아 있다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    ['.letter {', '.dmgroupav', '.fpanel { grid-template-columns: minmax(0, 1fr); }',
      '.chip--all.is-on', '.hdr__chat.is-open', '.netbar', '.planbox', ':focus-visible']
      .forEach(function (s) { includes(css, s, s); });
    includes(css, '@media (pointer: coarse)', '손가락 입력 대응');
    includes(css, 'min-height: 44px', '44px 터치 타겟');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
