/* ============================================================
 * test/v174.test.js — bm-v1.74.0
 *   🏸 앱 이름 '셔틀릭스 (Shuttlix)' 반영 — 표시 이름만, 기능·데이터는 그대로
 *
 *   승우 님·조환비 님 확정 이름으로 앱 안에 보이는 이름을 바꿨는지 봅니다.
 *   1) 앱 화면 — 문서 제목 · 상단 헤더 워드마크 · 시작 로딩 · 시작화면 · MY 버전 줄
 *   2) 설치 파일 — manifest(name·short_name) · TWA(name·launcherName·버전 이름/코드)
 *   3) 인스타 공유 카드 — 워드마크 SHUTTLIX · 영수증 머리글 SHUTTLIX RECEIPT
 *   4) 알림 — 푸시 기본 제목 · 브라우저 알림 제목 접두어
 *   5) 개인정보처리방침 이름
 *   6) 보호 — localStorage 키(bm_*) · Supabase 테이블 · 주소 경로 · packageId ·
 *      5개 탭 · 시트 26칸은 그대로, 실존 선수 이름 없음
 *   7) 버전 정합(sw · app · index · TWA · README · 테스트 목록)
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) {
    return JSON.parse(readRoot(file));
  }
  /* index.html에서 스플래시 블록만 잘라 냅니다(헤더 앞까지) */
  function splashBlock(html) {
    var a = html.indexOf('<div id="splash"');
    var b = html.indexOf('<header class="hdr"');
    return a >= 0 && b > a ? html.slice(a, b) : '';
  }
  function countOf(src, needle) {
    var n = 0, i = 0;
    while (true) {
      var at = src.indexOf(needle, i);
      if (at < 0) return n;
      n++;
      i = at + needle.length;
    }
  }

  /* =========================================================
   * 1. 앱 화면 (index.html · js/views/start.js · js/views/my.js)
   * ========================================================= */
  test('v1.74 이름: 문서 제목·메타가 셔틀릭스다', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    includes(html, '<title>셔틀릭스 · 배드민턴 일지 &amp; 매칭</title>'.replace('&amp;', '&'), '탭 제목');
    includes(html, '<meta name="apple-mobile-web-app-title" content="셔틀릭스">', '홈 화면 이름(iOS)');
    includes(html, '<meta name="application-name" content="셔틀릭스">', '앱 이름 메타');
    includes(html, '<meta name="description" content="셔틀릭스(Shuttlix)', '설명 메타');
    excludes(html, '<title>배드민턴 · 일지', '옛 탭 제목은 남기지 않는다');
  });

  test('v1.74 이름: 상단 헤더 워드마크와 시작 로딩이 SHUTTLIX · 셔틀릭스', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    includes(html, '<span class="hdr__brand">SHUTTLIX</span>', '헤더 워드마크');
    var sp = splashBlock(html);
    ok(sp, '스플래시 블록을 찾는다');
    includes(sp, '>SHUTTLIX<', '시작 로딩 영문 워드마크');
    includes(sp, '>셔틀릭스<', '시작 로딩 한글 이름');
    includes(sp, '오늘의 코트를 준비하고 있어요', '준비 문구는 그대로');
    includes(sp, 'icons/icon-512.png', '로고 타일은 그대로');
    excludes(sp, '>BADMINTON<', '옛 워드마크는 남기지 않는다');
  });

  test('v1.74 이름: 시작화면 · MY 버전 줄도 셔틀릭스다', function () {
    if (!hasNode) return;
    var start = readRoot('js/views/start.js');
    includes(start, '<h1 class="start__title">셔틀릭스</h1>', '시작화면 앱 이름');
    includes(start, 'class="start__kicker">SHUTTLIX<', '킥커');
    includes(start, 'class="start__tiny"', '이메일 화면 브랜드 줄 유지');
    includes(start, 'decoding="async">셔틀릭스</span>', '이메일 화면 이름');
    excludes(start, '배드민턴 분석</h1>', '옛 앱 이름은 남기지 않는다');
    var my = readRoot('js/views/my.js');
    includes(my, '<p class="version">셔틀릭스 · ', 'MY 버전 줄');
  });

  /* =========================================================
   * 2. 설치 파일 (manifest · TWA)
   * ========================================================= */
  test('v1.74 설치: manifest 두 파일의 이름이 같다', function () {
    if (!hasNode) return;
    var web = readJson('manifest.webmanifest');
    var legacy = readJson('manifest.json');
    eq(web.name, '셔틀릭스 · 배드민턴 매칭 · AI', '웹 매니페스트 name');
    eq(web.short_name, '셔틀릭스', '웹 매니페스트 short_name (아이콘 밑 이름)');
    includes(web.description, '셔틀릭스(Shuttlix)', '설명');
    eq(legacy.name, web.name, 'manifest.json name도 같다');
    eq(legacy.short_name, web.short_name, 'manifest.json short_name도 같다');
    eq(web.start_url, './index.html', '시작 주소는 그대로');
    eq(web.scope, './', '범위는 그대로');
  });

  test('v1.74 TWA: 이름은 셔틀릭스, packageId는 그대로', function () {
    if (!hasNode) return;
    var twa = readJson('twa-manifest.json');
    eq(twa.name, '셔틀릭스', 'TWA name');
    eq(twa.launcherName, '셔틀릭스', '실행 아이콘 이름');
    eq(twa.packageId, 'io.github.csw42060713_byte.badminton', 'packageId는 조환비 님과 합의한 값 그대로');
    eq(twa.startUrl, '/badminton/index.html', '주소 경로는 그대로');
    eq(twa.appVersionName, '1.103.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.103.0', 'TWA appVersion');
    eq(twa.appVersionCode, 97, 'TWA 버전 코드');
    includes(twa.webManifestUrl, '/badminton/manifest.webmanifest', '매니페스트 주소 그대로');
  });

  /* =========================================================
   * 3. 인스타 공유 카드 (js/sharecard.js)
   * ========================================================= */
  test('v1.74 공유 카드: 작은 영문 워드마크가 SHUTTLIX다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    excludes(src, "fillText('BADMINTON'", '매거진·글래스·필름 워드마크');
    eq(countOf(src, "fillText('SHUTTLIX'"), 3, '매거진 · 글래스 · 필름 세 자리');
    includes(src, "centered('SHUTTLIX RECEIPT'", '영수증 머리글');
    excludes(src, "'BADMINTON RECEIPT'", '옛 영수증 머리글은 남기지 않는다');
  });

  test('v1.74 공유 카드: 그려진 글씨에 SHUTTLIX가 실제로 들어간다', function () {
    var SC = BM.sharecard;
    ok(SC && typeof SC.draw === 'function', '공유 카드 그리기');
    function textWidth(text, font) {
      var m = /(\d+)px/.exec(font || '');
      var size = m ? Number(m[1]) : 24;
      var w = 0, srcx = String(text);
      for (var i = 0; i < srcx.length; i++) w += srcx.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
      return w;
    }
    function mock() {
      var log = { texts: [] };
      function gradient() { return { addColorStop: function () {} }; }
      var ctx = {
        fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
        shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1,
        lineCap: '', lineJoin: '', letterSpacing: '0px', globalCompositeOperation: 'source-over',
        clearRect: function () {}, fillRect: function () {}, strokeRect: function () {},
        beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
        rect: function () {}, arcTo: function () {}, arc: function () {}, ellipse: function () {},
        fill: function () {}, stroke: function () {}, clip: function () {},
        save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}, rotate: function () {},
        createLinearGradient: gradient, createRadialGradient: gradient,
        measureText: function (text) { return { width: textWidth(text, ctx.font) }; },
        fillText: function (text) { log.texts.push(String(text)); },
        strokeText: function (text) { log.texts.push(String(text)); },
        drawImage: function () {}
      };
      var canvas = { width: 0, height: 0, getContext: function () { return ctx; } };
      return { canvas: canvas, log: log };
    }
    var spec = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: null, top: '11/24 (화)', kicker: '', phrase: '민턴일기',
      big: { value: '90', unit: '분', label: '' }, bigLine: '', stats: [], meta: '', metaLine: '',
      label: '', date: '11/24 (화)', comp: null, textPos: 'bottom', photoX: 0, photoY: 0, photoZoom: 1,
      filter: 'auto', showNums: true, win: true, hasStamp: false, stamp: '', badge: '', tagLine: ''
    };
    var m = mock();
    SC.draw(m.canvas, spec);
    var joined = m.log.texts.join('|');
    includes(joined, 'SHUTTLIX', '매거진 카드 워드마크');
    excludes(joined, 'BADMINTON', '옛 워드마크 없음');
    includes(joined, '민턴일기', '카드 문구는 그대로');
  });

  /* =========================================================
   * 4. 알림 (sw.js · app.js)
   * ========================================================= */
  test('v1.74 알림: 푸시 기본 제목과 브라우저 알림 접두어가 셔틀릭스다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "var out = { title: '셔틀릭스',", '푸시 기본 제목');
    excludes(sw, "var out = { title: '배드민턴',", '옛 기본 제목 없음');
    var app = readRoot('app.js');
    includes(app, "var title = '셔틀릭스 · ' + notifText(item);", '브라우저 알림 제목');
    includes(app, "icon: 'icons/icon-192.png'", '알림 아이콘은 그대로');
  });

  /* =========================================================
   * 5. 개인정보처리방침 이름
   * ========================================================= */
  test('v1.74 방침: 개인정보처리방침도 셔틀릭스 이름을 쓴다', function () {
    if (!hasNode) return;
    var p = readRoot('privacy.html');
    includes(p, '<title>개인정보처리방침 · 셔틀릭스</title>', '문서 제목');
    includes(p, '</span>셔틀릭스</div>', '브랜드 줄');
    includes(p, '셔틀릭스(Shuttlix) 앱(이하 “앱”)', '본문 첫 문장');
    includes(p, '앱: 셔틀릭스 (Shuttlix · Google Play · 웹 앱)', '앱 표기');
    excludes(p, '배드민턴 분석 앱(이하', '옛 이름 본문 없음');
  });

  /* =========================================================
   * 6. 보호 — 데이터·구조는 그대로
   * ========================================================= */
  test('v1.74 보호: 저장 키·테이블·주소 경로는 이름과 함께 바뀌지 않는다', function () {
    if (!hasNode) return;
    var store = readRoot('js/store.js');
    includes(store, "'bm_cache_v1'", '기기 저장 키');
    includes(store, "'bm_queue_v1'", '대기열 키');
    includes(store, "'bm_mode_v1'", '모드 키');
    excludes(store, "'shuttlix", '이름 때문에 새 저장 키를 만들지 않는다');
    var api = readRoot('js/api.js');
    includes(api, 'rest/v1/', 'Supabase 표는 그대로');
    var twa = readJson('twa-manifest.json');
    eq(twa.startUrl.indexOf('/badminton/'), 0, '배포 주소 경로 그대로');
  });

  test('v1.74 보호: 5개 탭과 시트 26칸은 그대로다', function () {
    eq((readRoot('index.html').match(/class="tab" data-tab="/g) || []).length, 5, '탭 5개');
    eq(D.COLS.length, 26, '시트 26칸');
    var me = BM.seed.ME;
    ok(typeof me === 'string' && me.length > 0, '내 키는 그대로');
  });

  test('v1.74 안전: 실존 선수 이름을 쓰지 않는다', function () {
    if (!hasNode) return;
    var files = ['index.html', 'manifest.webmanifest', 'twa-manifest.json', 'js/views/start.js', 'js/sharecard.js', 'sw.js', 'privacy.html'];
    var names = ['김원호', '안세영', '서승재', '하태권', '김홍기'];
    files.forEach(function (f) {
      var src = readRoot(f);
      names.forEach(function (n) {
        excludes(src, n, f + ' — 실존 선수 이름 없음');
      });
    });
  });

  /* =========================================================
   * 7. 버전 정합
   * ========================================================= */
  test('v1.74 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.103.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.103.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.103.0', 'TWA 버전 이름');
    eq(twa.appVersionCode, 97, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.74.0', 'README 변경 이력');
    includes(readRoot('README.md'), '셔틀릭스 (Shuttlix)', 'README 앱 이름');
    includes(readRoot('sw.js'), 'bm-v1.74.0', '서비스워커 캐시 키');
    includes(readRoot('test/run.js'), "test/v174.test.js", '테스트 목록에 등록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
