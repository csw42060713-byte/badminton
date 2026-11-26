/* ============================================================
 * test/v171.test.js — bm-v1.73.0
 *   🎨 인스타 공유 카드 감성 전면 리디자인 + 고화질 배경 3종
 *
 *  승우 님 요청: "인스타 공유 카드가 아직 어수선하고 아쉽다 — 싹 갈아엎어 줘."
 *  승인한 세 방향을 그대로 구현했는지 봅니다.
 *    ① 고화질 실사 감성 기본 배경 3종(야경 코트 · 노을 체육관 · 다크 스튜디오)
 *       + 깔끔한 그라데이션 1종. 사진이 없어도 바로 화보 같은 카드.
 *    ② 군더더기 뺀 레이아웃 — 큰 숫자 하나 + 얇은 선 + 짧은 한 줄 + 맨 아래 날짜·장소.
 *       도장·자랑 배지·전적·도발 멘트는 '꾸밈 배지'를 켤 때만.
 *    ③ 디자인 4종 — 매거진 · 영수증(오늘의 민턴 영수증) · 필름 · 스티커.
 *
 *   1) 배경 사진 3장이 저장소에 1080×1350 JPEG로 있고 sw 캐시(SHELL)에 들어 있다
 *   2) 사진이 아직 안 와도 예전 캔버스 아트(fallback)로 절대 비지 않는다
 *   3) 매거진은 숫자 1개 + 선 1개 + 한 줄 + 아래 날짜, 도장은 기본으로 없다
 *   4) 영수증은 모델(날짜·운동시간·체육관·경기·컨디션)과 종이·바코드·톱니가 그려진다
 *   5) 글래스는 칸에서 빠지고 레거시 값은 매거진으로 안전하게
 *   6) 기존 기능 보호 — 두 모드 · 비율 2 · 색 5 · 필터 5 · 글씨 위치 3 · 프레임 2 · 태그
 *   7) 안전 — 실존 선수 이름·서버 전송·민감값 없음 · 버전 4종 함께
 *
 * 실행: node test/run.js
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
  function readBytes(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file));
  }

  function SC() { return BM.sharecard; }

  /* ---------- 가짜 2D 컨텍스트 ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mock() {
    var log = {
      texts: [], images: [], rects: [], gradients: [], ops: [], strokes: 0,
      points: 0, dashes: 0, fills: []
    };
    function gradient(x0, y0, x1, y1, radial) {
      var g = { x0: x0, y0: y0, x1: x1, y1: y1, radial: !!radial, stops: [], addColorStop: function (o, c) { g.stops.push(c); } };
      log.gradients.push(g);
      return g;
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1,
      lineCap: '', lineJoin: '', letterSpacing: '0px', globalCompositeOperation: 'source-over',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) {
        log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle });
        log.ops.push('fillRect');
      },
      strokeRect: function () { log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () { log.points++; }, lineTo: function () { log.points++; },
      closePath: function () {}, rect: function () {}, arcTo: function () {}, arc: function () {}, ellipse: function () {},
      fill: function () { log.fills.push(g.fillStyle); log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {}, rotate: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1, false); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1, true); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) {
        log.texts.push({ text: String(text), x: x, y: y, color: g.fillStyle, font: g.font });
        log.ops.push('fillText');
      },
      strokeText: function (text, x, y) { log.texts.push({ text: String(text), x: x, y: y, stroke: true }); },
      drawImage: function (img, x, y, w, h) { log.images.push({ x: x, y: y, w: w, h: h }); log.ops.push('drawImage'); }
    };
    var canvas = { width: 0, height: 0, getContext: function () { return g; }, toBlob: function (cb) { cb({ size: 10 }); } };
    return { canvas: canvas, ctx: g, log: log };
  }

  function textsOf(log) {
    return log.texts.filter(function (x) { return !x.stroke; }).map(function (x) { return x.text; }).join('|');
  }
  function yOf(log, needle) {
    var hit = log.texts.filter(function (x) { return !x.stroke && x.text === needle; })[0];
    return hit ? hit.y : null;
  }

  function photo(w, h) { return { width: w || 1200, height: h || 900 }; }

  function todaySpec(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: photo(), top: '11/24 (화) · 나래울체육관', kicker: '운동 시간',
      phrase: '민턴일기', big: { value: '90', unit: '분', label: '운동 시간' },
      bigLine: '90분 · 2승 1패', stats: [{ label: '경기', value: '2승 1패' }, { label: '연속', value: '5일' }],
      meta: '민호와 함께 · vs 지호', metaLine: '민호와 함께 · vs 지호', label: '2승 1패 · 11/24 (화)',
      date: '11/24 (화)', comp: null, textPos: 'bottom', photoX: 0, photoY: 0, photoZoom: 1,
      filter: 'auto', showNums: true, win: true, hasStamp: false, stamp: '', badge: '', tagLine: '',
      gymName: '나래울체육관', minutes: 90, recordText: '2승 1패', condText: '최고',
      partnerName: '민호', rivalName: '지호'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  function compSpec(patch) {
    return todaySpec(Object.assign({
      mode: 'comp', top: '11/24 (화)', kicker: '○○시 오픈 대회', phrase: '대회 인증',
      big: { value: '우승', unit: '', label: '성적' }, bigLine: '우승 · B조 복식',
      stats: [{ label: '종목', value: 'B조 복식' }], meta: '', metaLine: '○○시 오픈 대회',
      label: '○○시 오픈 대회 · B조 복식', hasStamp: true, stamp: '',
      comp: { contest: '○○시 오픈 대회', event: 'B조 복식', result: '우승', partner: '민호', date: '11/24 (화)' }
    }, patch || {}));
  }

  function drawCard(spec) {
    var m = mock();
    SC().draw(m.canvas, spec);
    return m.log;
  }

  function ctxOf(state) {
    return { store: { state: state }, actions: { setPref: function () {} }, repaint: function () {} };
  }
  var ME = BM.seed.ME;
  function stateOf(records) {
    return { me: { key: ME, nick: '승우', club: '나래울체육관' }, data: { records: records || [], stats: { streak: 5 } }, drafts: { log: {} } };
  }
  function rec(patch) {
    var r = { id: 'r171', userKey: ME, date: '2026-11-24', minutes: 90, cond: 9, intensity: 7,
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }],
      team: JSON.stringify({ partner: '민호', rival: '지호' }), done: ['스매시 드릴'] };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }
  function uiState(patch) {
    var s = { mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night',
      bg: 'nightcourt', photo: null, filter: 'auto', nums: 'show', win: true, badge: true, deco: false,
      frame: 'none', phrase: '민턴일기', phraseComp: '민턴일기', textPos: 'bottom',
      recordId: 'r171', photoX: 0, photoY: 0, photoZoom: 1, gym: '나래울체육관',
      partner: '민호', rival: '지호', contest: '○○시 오픈 대회', event: 'B조 복식', result: '우승',
      compPartner: '민호', date: '2026-11-24' };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* =========================================================
   * 1. 고화질 실사 배경 3종 — 파일 · 모델
   * ========================================================= */

  test('v1.71 배경 사진: 저장소에 1080×1350 JPEG 3장이 있다', function () {
    if (!hasNode) return;
    var files = ['assets/share-bg/night-court.jpg', 'assets/share-bg/sunset-shuttle.jpg', 'assets/share-bg/minimal-studio.jpg'];
    files.forEach(function (f) {
      var buf = readBytes(f);
      ok(buf.length > 40000, f + ' 파일 크기 ' + Math.round(buf.length / 1024) + 'KB');
      eq(buf[0], 0xFF, f + ' JPEG 시작');
      eq(buf[1], 0xD8, f + ' JPEG SOI');
      /* SOF0(0xFFC0)에서 세로·가로를 읽습니다 */
      var w = 0, h = 0;
      for (var i = 2; i < buf.length - 9; i++) {
        if (buf[i] === 0xFF && (buf[i + 1] === 0xC0 || buf[i + 1] === 0xC2)) {
          h = buf.readUInt16BE(i + 5);
          w = buf.readUInt16BE(i + 7);
          break;
        }
      }
      eq(w, 1080, f + ' 가로');
      eq(h, 1350, f + ' 세로');
    });
  });

  test('v1.71 배경 모델: 실사 3종 + 그라데이션 1종, 사진·fallback·톤이 함께 있다', function () {
    var sc = SC();
    eq(sc.BGS.length, 4, '배경 4종');
    eq(sc.BGS.map(function (b) { return b.id; }).join(','), 'nightcourt,sunsetshuttle,darkstudio,mintmesh', '아이디');
    eq(sc.BGS.map(function (b) { return b.name; }).join(','), '야경 코트,노을 체육관,다크 스튜디오,민턴 그라데이션', '이름');
    sc.BGS.slice(0, 3).forEach(function (b) {
      eq(b.src.indexOf('assets/share-bg/'), 0, b.id + ' 사진 경로');
      ok(/\.jpg$/.test(b.src), b.id + ' JPEG');
      ok(!!b.fallback, b.id + ' fallback 아트');
      ok(typeof b.tone === 'number' && b.tone >= 0 && b.tone < 0.4, b.id + ' 톤 ' + b.tone);
    });
    eq(sc.BGS[3].src, '', '민턴 그라데이션은 캔버스');
    eq(sc.BGS[3].fallback, 'mintmesh', '그라데이션 id');
    eq(sc.bgById('nightcourt').name, '야경 코트', 'id로 찾기');
  });

  test('v1.71 배경 캐시: 서비스워커 SHELL에 사진 3장이 들어 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "var VERSION = 'bm-v1.82.0'", 'sw 버전');
    includes(sw, "'./assets/share-bg/night-court.jpg'", '야경 코트 캐시');
    includes(sw, "'./assets/share-bg/sunset-shuttle.jpg'", '노을 체육관 캐시');
    includes(sw, "'./assets/share-bg/minimal-studio.jpg'", '다크 스튜디오 캐시');
  });

  test('v1.71 배경 그리기: 사진이 오면 cover로 깔고, 없으면 fallback 아트로 채운다', function () {
    var sc = SC();
    /* 1) 사진 없음 — 예전 캔버스 아트가 그라데이션으로 채웁니다(절대 비지 않음) */
    var m1 = mock();
    sc.paintBg(m1.ctx, 'nightcourt', { x: 0, y: 0, w: 1080, h: 1350 });
    eq(m1.log.images.length, 0, '사진 없음 → drawImage 없음');
    ok(m1.log.gradients.length > 0, 'fallback 그라데이션');
    ok(m1.log.ops.length > 3, 'fallback 그림');
    /* 2) 사진이 준비되면 cover로 그리고 옅은 톤을 얹습니다 */
    sc._setBgImage('nightcourt', { width: 1080, height: 1350 });
    var m2 = mock();
    sc.paintBg(m2.ctx, 'nightcourt', { x: 0, y: 0, w: 1080, h: 1350 });
    eq(m2.log.images.length, 1, '사진 cover');
    eq(m2.log.images[0].w + 'x' + m2.log.images[0].h, '1080x1350', '카드에 꽉 차게');
    ok(m2.log.rects.some(function (r) { return String(r.fill).indexOf('rgba(4,8,7,') === 0; }), '사진 위 옅은 톤');
    sc._clearBgImages();
    eq(sc.bgImageOf('nightcourt'), null, '정리 후 없음');
  });

  test('v1.71 배경 그리기: 스티커(투명)에는 배경을 절대 깔지 않는다', function () {
    var sc = SC();
    sc._setBgImage('nightcourt', { width: 1080, height: 1350 });
    var log = drawCard(todaySpec({ design: 'sticker', bg: 'nightcourt' }));
    eq(log.images.length, 0, '스티커는 사진 없음');
    eq(sc.bgOf({ design: 'sticker', bg: 'nightcourt' }), null, '모델도 비움');
    sc._clearBgImages();
  });

  test('v1.71 배경: 사진이 없으면 시트를 열 때 받아 두고, 다 오면 다시 그린다', function () {
    var src = hasNode ? readRoot('js/sharecard.js') : '';
    if (!hasNode) return;
    includes(src, 'function preloadBgs', '미리 받기');
    includes(src, 'function onBgLoad', '도착하면 다시 그리기');
    includes(src, 'function whenBgsReady', '저장 직전 대기');
    includes(src, "if (bgOf(s)) ensureBgs();", '그릴 때 받기 시작');
    var done = 0;
    SC().whenBgsReady(function () { done++; });
    eq(done, 1, '그림 도구(node)에서는 기다리지 않고 바로 저장');
  });

  /* =========================================================
   * 2. 매거진 — 군더더기 뺀 레이아웃
   * ========================================================= */

  test('v1.71 매거진: 큰 숫자 1개 + 얇은 선 + 짧은 한 줄 + 맨 아래 날짜', function () {
    var log = drawCard(todaySpec());
    var joined = textsOf(log);
    includes(joined, '90', '큰 숫자');
    includes(joined, '분', '단위');
    includes(joined, '민턴일기', '짧은 문구');
    includes(joined, '경기 2승 1패', '짧은 한 줄(스탯)');
    includes(joined, '11/24 (화) · 나래울체육관', '맨 아래 날짜·장소');
    includes(joined, 'SHUTTLIX', '작은 워드마크');
    ok(log.strokes >= 1, '얇은 선 1개');
    /* 날짜는 카드 맨 아래, 큰 숫자는 그 위 */
    var dateY = yOf(log, '11/24 (화) · 나래울체육관');
    var bigY = yOf(log, '90');
    ok(dateY > 1250, '날짜는 맨 아래 (' + Math.round(dateY) + ')');
    ok(bigY < dateY, '숫자는 날짜 위');
  });

  test('v1.71 매거진: 예전 군더더기(COURT LOG·스탯 2열 라벨)를 걷어냈다', function () {
    var log = drawCard(todaySpec());
    var joined = textsOf(log);
    excludes(joined, 'COURT LOG', '영문 라벨 없음');
    excludes(joined, 'CONTEST LOG', '대회 영문 라벨 없음');
    excludes(joined, '운동 시간|', '스탯 라벨을 따로 세우지 않음');
    var fills = log.texts.length;
    ok(fills <= 8, '카드 위 글씨는 8개 이하 (' + fills + ')');
  });

  test('v1.71 매거진: 도장·자랑 배지·WIN은 기본으로 없고, 꾸밈 배지를 켜면 조용히 얹힌다', function () {
    /* 앱은 specOf에서 deco:false를 넣습니다(새 기본). 여기서도 같은 값을 넣어 봅니다. */
    var plain = drawCard(todaySpec({ stamp: 'WIN', badge: '오늘 2전 전승', deco: false }));
    excludes(textsOf(plain), 'WIN', '기본은 WIN 없음');
    excludes(textsOf(plain), '오늘 2전 전승', '기본은 배지 없음');
    var deco = drawCard(todaySpec({ stamp: 'WIN', badge: '오늘 2전 전승', deco: true }));
    includes(textsOf(deco), 'WIN', '켜면 WIN');
    includes(textsOf(deco), '오늘 2전 전승', '켜면 자랑 배지');
  });

  test('v1.71 매거진: 글씨 위치 위·가운데·아래 모두 카드 안에 들어온다', function () {
    ['bottom', 'middle', 'top'].forEach(function (pos) {
      ['feed', 'story'].forEach(function (ratio) {
        var H = ratio === 'story' ? 1920 : 1350;
        var lo = ratio === 'story' ? 220 : 0;
        var hi = ratio === 'story' ? 1700 : H;
        var log = drawCard(todaySpec({ textPos: pos, ratio: ratio }));
        log.texts.forEach(function (x) {
          ok(x.y > lo && x.y < hi, pos + '/' + ratio + ' "' + x.text + '" y=' + Math.round(x.y));
        });
      });
    });
  });

  test('v1.71 매거진: 긴 문구·긴 체육관 이름도 폭을 넘지 않는다', function () {
    var long = '아주아주 긴 카드 문구를 넣어도 한 줄 안에서 줄어듭니다';
    var log = drawCard(todaySpec({ phrase: long, top: '11/24 (화) · 아주 긴 이름을 가진 시립 배드민턴 전용 체육관' }));
    var phrase = log.texts.filter(function (x) { return x.text.indexOf('아주아주') === 0; })[0];
    ok(!!phrase, '문구를 그린다');
    ok(textWidth(phrase.text, phrase.font) <= 1080 - 84 * 2 + 1, '카드 폭 안');
  });

  /* =========================================================
   * 3. 영수증 — 오늘의 민턴 영수증
   * ========================================================= */

  test('v1.71 영수증 모델: 날짜·운동시간·체육관·경기·컨디션·함께·상대가 줄로 선다', function () {
    var sc = SC();
    var rows = sc.receiptRows(todaySpec());
    var keys = rows.map(function (r) { return r.key; }).join(',');
    eq(keys, '날짜,운동시간,체육관,경기,컨디션,함께,상대', '줄 순서');
    eq(rows[1].value, '90분', '운동시간');
    eq(rows[3].value, '2승 1패', '경기');
    eq(rows[4].value, '최고', '컨디션');
  });

  test('v1.71 영수증 모델: 대회 카드는 대회·종목·성적·파트너 줄로 바뀐다', function () {
    var sc = SC();
    var rows = sc.receiptRows(compSpec());
    eq(rows.map(function (r) { return r.key; }).join(','), '날짜,대회,종목,성적,파트너', '대회 줄');
    eq(rows[1].value, '○○시 오픈 대회', '대회명');
    eq(rows[3].value, '우승', '성적');
  });

  test('v1.71 영수증 그리기: 종이 · 머리글 · 큰 숫자 · 바코드 · 한 줄 코멘트', function () {
    var log = drawCard(todaySpec({ design: 'receipt' }));
    var joined = textsOf(log);
    includes(joined, 'SHUTTLIX RECEIPT', '머리글');
    includes(joined, '오늘의 민턴 영수증', '부제');
    includes(joined, 'TOTAL', '합계 라벨');
    includes(joined, '90분', '큰 숫자');
    includes(joined, '2승 1패', '전적 줄');
    includes(joined, '민턴일기', '한 줄 코멘트');
    includes(joined, 'THANK YOU FOR TODAY', '감사 인사');
    includes(joined, '나래울체육관', '체육관 줄');
    /* 종이 — 크림색 채우기 + 찢은 톱니(경로 점이 많은 닫힌 도형) */
    ok(log.fills.length >= 1, '종이 채우기');
    ok(log.fills.some(function (c) { return String(c).indexOf('rgba(250,246,237,') === 0; }), '크림 종이');
    ok(log.points > 40, '톱니로 찢은 종이 경로 (' + log.points + '점)');
    ok(log.strokes >= 3, '점선 구분선');
  });

  test('v1.71 영수증 그리기: 바코드는 씨앗이 같으면 늘 같고, 다르면 달라진다', function () {
    var sc = SC();
    var a = sc.barcodeBars('2026-11-24|90|2승 1패', 42);
    var b = sc.barcodeBars('2026-11-24|90|2승 1패', 42);
    var c = sc.barcodeBars('2026-11-25|60', 42);
    eq(a.length, 42, '막대 42개');
    eq(a.map(function (x) { return x.w; }).join(''), b.map(function (x) { return x.w; }).join(''), '같은 씨앗 → 같은 바코드');
    ok(a.map(function (x) { return x.w; }).join('') !== c.map(function (x) { return x.w; }).join(''), '다른 날 → 다른 바코드');
    ok(a.every(function (x) { return x.w >= 2 && x.w <= 12; }), '굵기는 2~12px');
  });

  test('v1.71 영수증 그리기: 사진 위·기본 배경 위 모두, 스토리 9:16에서도 카드 안', function () {
    var withPhoto = drawCard(todaySpec({ design: 'receipt', photo: photo() }));
    eq(withPhoto.images.length, 1, '내 사진을 먼저 깐다');
    var onBg = drawCard(todaySpec({ design: 'receipt', photo: null, bg: 'sunsetshuttle' }));
    eq(onBg.images.length, 0, '기본 배경은 캔버스(그림 도구)');
    ok(onBg.gradients.length > 0, '기본 배경 위에도 종이');
    var story = drawCard(todaySpec({ design: 'receipt', ratio: 'story', photo: null }));
    story.texts.forEach(function (x) {
      ok(x.y > 220 && x.y < 1700, '스토리 안전 여백 "' + x.text + '" y=' + Math.round(x.y));
    });
  });

  test('v1.71 영수증: 종이 위에는 도장·배지를 얹지 않는다', function () {
    var log = drawCard(todaySpec({ design: 'receipt', stamp: 'WIN', badge: '오늘 2전 전승', deco: true }));
    excludes(textsOf(log), 'WIN', '영수증에는 WIN 없음');
    excludes(textsOf(log), '오늘 2전 전승', '영수증에는 배지 없음');
  });

  /* =========================================================
   * 4. 디자인 4종 — 매거진 · 영수증 · 필름 · 스티커
   * ========================================================= */

  test('v1.71 디자인: 매거진 · 영수증 · 필름 · 스티커 4종이고 기본은 매거진', function () {
    var sc = SC();
    eq(sc.DESIGNS.length, 4, '4종');
    eq(sc.DESIGNS.map(function (d) { return d.id; }).join(','), 'magazine,receipt,film,sticker', '아이디');
    eq(sc.DESIGNS.map(function (d) { return d.name; }).join(','), '매거진,영수증,필름,스티커', '이름');
    eq(sc.designById('receipt').name, '영수증', '영수증');
    eq(sc.designById(undefined).id, 'magazine', '모르는 값은 매거진');
    sc.DESIGNS.forEach(function (d) { ok(d.note && d.note.length > 3, d.id + ' 설명'); });
  });

  test('v1.71 디자인: 글래스는 칸에서 빠지고, 예전 값은 매거진으로 안전하게', function () {
    var sc = SC();
    eq(sc.presetDesignId('glass'), 'magazine', '레거시 → 매거진');
    eq(sc.presetDesignId('receipt'), 'receipt', '영수증 유지');
    eq(sc.presetDesignId('??'), 'magazine', '모르는 값 → 매거진');
    eq(sc.designById('glass').name, '글래스', '그리는 방법은 남김');
    /* 예전 값으로도 카드가 깨지지 않고 그려진다 */
    var log = drawCard(todaySpec({ design: 'glass' }));
    ok(log.texts.length > 0, '글래스 카드도 그려진다');
  });

  test('v1.71 시트: 디자인 칸·영수증 그림·꾸밈 배지 칩·기본 배경 안내', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState());
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    eq((html.match(/data-sc-design="/g) || []).length, 4, '디자인 칸 4');
    includes(html, 'data-sc-design="receipt"', '영수증 칸');
    includes(html, 'data-sc-decotoggle', '꾸밈 배지 칩');
    includes(html, '꾸밈 배지 꺼짐', '기본은 꺼짐');
    excludes(html, 'data-sc-badgetoggle', '꺼짐일 때는 자랑 배지 칸을 숨김');
    sc._setState(uiState({ deco: true }));
    var on = sc._sheetBody(ctxOf(stateOf([rec()])));
    includes(on, 'data-sc-badgetoggle', '켜면 자랑 배지 칸');
    sc._setState(uiState());
    includes(html, 'data-sc-bg="nightcourt"', '야경 코트 칩');
    includes(html, '사진 없이도 화보처럼', '배경 안내');
    includes(hasNode ? readRoot('styles.css') : '', '.sc__design--receipt i', '영수증 칸 그림');
  });

  test('v1.71 기본값: 사진이 없어도 첫 배경(야경 코트)으로 시작하고, 꾸밈은 꺼짐', function () {
    var sc = SC();
    var ui = sc._initialState(ctxOf(stateOf([rec()])), {});
    eq(ui.bg, 'nightcourt', '기본 배경');
    eq(ui.deco, false, '꾸밈 배지 기본 꺼짐');
    eq(ui.design, 'magazine', '기본 디자인');
    eq(sc._initialState(ctxOf(stateOf([rec()])), {}).textPos, 'bottom', '글씨 위치 기본 아래');
  });

  /* =========================================================
   * 5. 기존 기능 보호
   * ========================================================= */

  test('v1.71 보호: 두 모드 · 비율 2 · 색 5 · 필터 5 · 글씨 위치 3 · 프레임 2 · 태그', function () {
    var sc = SC();
    eq(sc.MODES.map(function (m) { return m.id; }).join(','), 'today,comp', '두 모드');
    eq(sc.RATIOS.map(function (r) { return r.id; }).join(','), 'feed,story', '비율 2');
    eq(sc.PALETTES.length, 5, '색 5');
    eq(sc.PHOTO_FILTERS.length, 5, '사진 필터 5');
    eq(sc.TEXT_POS.length, 3, '글씨 위치 3');
    eq(sc.FRAMES.length, 2, '프레임 2');
    eq(sc.SHADES.length, 3, '사진 밝기 3');
    eq(sc.NUM_MODES.length, 2, '숫자 표시 2');
    eq(sc.duoLine([rec()], '민호').indexOf('민호랑 콤비'), 0, '콤비 전적');
    eq(sc.rivalTagLine([rec()], '지호').indexOf('지호 상대'), 0, '라이벌 전적');
  });

  test('v1.71 보호: 사진 끌기·확대·필터·챔피언 프레임·스티커 투명이 그대로', function () {
    var sc = SC();
    var m = mock();
    var moved = sc.movePhotoBy(m.canvas, todaySpec({ photoZoom: 1.4, ratio: 'feed' }), 40, 30);
    ok(moved && typeof moved.x === 'number' && typeof moved.y === 'number', '사진 끌기');
    eq(sc.zoomOf(9), sc.ZOOM_MAX, '확대 상한');
    eq(sc.zoomOf(0.2), sc.ZOOM_MIN, '확대 하한');
    var sticker = drawCard(todaySpec({ design: 'sticker' }));
    eq(sticker.rects.length, 0, '스티커는 바탕을 칠하지 않음');
    var champ = drawCard(compSpec({ frame: 'champ' }));
    ok(champ.strokes > 0, '챔피언 프레임 테두리');
    var filtered = drawCard(todaySpec({ filter: 'mono' }));
    eq(filtered.images.length, 1, '필터를 걸어도 사진은 한 장');
  });

  test('v1.71 보호: 숫자 숨기기(무드)는 테두리 박스 없이 문구·날짜·한 줄만', function () {
    var log = drawCard(todaySpec({ showNums: false }));
    var joined = textsOf(log);
    excludes(joined, '90', '숫자 없음');
    includes(joined, '민턴일기', '문구');
    includes(joined, '11/24 (화) · 나래울체육관', '날짜·체육관');
    ok(log.strokes >= 1, '포인트 선');
    /* 알약(둥근 사각형 테두리)은 더 이상 그리지 않습니다 */
    eq(log.ops.indexOf('strokeRect'), -1, 'strokeRect 없음');
  });

  /* =========================================================
   * 6. 안전 · 버전
   * ========================================================= */

  test('v1.71 안전: 실존 선수 이름·서버 전송·민감값이 없다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    ['김원호', '안세영', '서승재', '서재승'].forEach(function (n) { excludes(src, n, n + ' 없음'); });
    excludes(src, 'fetch(', '서버 전송 없음');
    excludes(src, 'XMLHttpRequest', 'XHR 없음');
    excludes(src, 'new FormData', '업로드 없음');
    excludes(src, 'mwgpakntlollndfluwgg', '시트·DB 주소 없음');
    includes(src, 'readAsDataURL', '사진은 폰 안에서만');
    includes(src, "src: 'assets/share-bg/night-court.jpg'", '배경은 앱 안 파일');
  });

  test('v1.71 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.82.0'", 'sw');
    includes(readRoot('app.js'), "version: 'v1.82.0'", 'app');
    includes(readRoot('index.html'), 'styles.css?v=20261126-4', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.82.0', 'TWA 이름');
    eq(twa.appVersionCode, 76, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.74.0', 'README 이력');
    includes(readRoot('test/run.js'), "'test/v171.test.js'", '테스트 목록');
  });

  test('v1.71 요약: 카드 요약 문구에 디자인 이름이 그대로', function () {
    var sc = SC();
    includes(sc.summaryOf(todaySpec({ design: 'receipt' })), '영수증', '영수증 요약');
    includes(sc.summaryOf(todaySpec({ design: 'magazine' })), '매거진', '매거진 요약');
    includes(sc.summaryOf(todaySpec({ design: 'receipt' })), '피드 4:5', '비율도 함께');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
