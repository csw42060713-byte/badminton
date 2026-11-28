/* ============================================================
 * test/v166.test.js — bm-v1.73.0
 *   🖼️ 인스타 카드 사진 드래그·확대 & 글씨 위치 이동
 *
 *  승우 님 요청: "이미지 같은거 원하는 위치에 넣을수없어?" → "ㄱㄱ" → "둘다"
 *
 *   1) 사진 구도 — 미리보기를 끌어 위치 이동, 1.0×~2.5× 확대, 원래대로 복구
 *      · 확대하면 프레임보다 커진 만큼만 움직이고, 넘친 곳이 없으면 그대로다
 *      · 화면(미리보기)과 저장 PNG가 같은 계산(coverBox)을 쓴다
 *      · 사진을 바꾸거나 빼면 위치·확대는 기본값(가운데 · 1.0×)
 *   2) 글씨 위치 3단 — 아래 · 가운데 · 위
 *      · 매거진: 스크림과 글씨 묶음이 통째로 옮겨진다(기본 '아래'는 예전 그대로)
 *      · 필름: '아래'는 인화지 여백, '가운데'·'위'는 사진 위 흰 글씨 + 스크림
 *      · 스티커: 투명 PNG 위에서 스티커 묶음이 옮겨진다
 *   3) 시트 — 사진이 들어갔을 때만 '사진 위치 · 확대', 디자인·비율 근처에 '글씨 위치'
 *   4) 보호 — 저장 PNG 크기(1080×1350 · 1080×1920) · 스티커 투명 · 서버 전송 없음 · 버전
 *
 * 실행: node test/run.js
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

  var ME = BM.seed.ME;
  function SC() { return BM.sharecard; }

  /* ---------- 가짜 2D 컨텍스트 — 글씨 y·색·그림 위치를 그대로 기록 ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mock() {
    var log = { texts: [], images: [], rects: [], gradients: [], ops: [], strokes: 0 };
    function gradient(x0, y0, x1, y1) {
      var g = { x0: x0, y0: y0, x1: x1, y1: y1, stops: [], addColorStop: function (o, c) { g.stops.push(c); } };
      log.gradients.push(g);
      return g;
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1,
      lineCap: '', lineJoin: '', letterSpacing: '0px',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) { log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle }); log.ops.push('fillRect'); },
      strokeRect: function () { log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      rect: function () {}, arcTo: function () {}, arc: function () {}, ellipse: function () {},
      fill: function () { log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) {
        log.texts.push({ text: String(text), x: x, y: y, color: g.fillStyle, font: g.font });
        log.ops.push('fillText');
      },
      strokeText: function (text, x, y) {
        log.texts.push({ text: String(text), x: x, y: y, color: g.strokeStyle, stroke: true, font: g.font });
        log.ops.push('strokeText');
      },
      drawImage: function (img, x, y, w, h) { log.images.push({ x: x, y: y, w: w, h: h }); log.ops.push('drawImage'); }
    };
    var canvas = { width: 0, height: 0, getContext: function () { return g; }, toBlob: function (cb) { cb({ size: 10 }); } };
    return { canvas: canvas, ctx: g, log: log };
  }

  function yOf(log, needle) {
    var hit = log.texts.filter(function (x) { return x.text === needle && !x.stroke; })[0];
    return hit ? Math.round(hit.y) : null;
  }

  function colorOf(log, needle) {
    var hit = log.texts.filter(function (x) { return x.text === needle && !x.stroke; })[0];
    return hit ? String(hit.color) : '';
  }

  function photo(w, h) { return { width: w || 1200, height: h || 900 }; }

  /* 대회 인증 카드 — 큰 숫자가 '우승' 하나뿐이라 y를 재기 쉽습니다 */
  function compSpec(patch) {
    var s = {
      mode: 'comp', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: photo(), top: '11/24 (화)', kicker: '○○시 오픈 대회',
      phrase: '민턴일기', big: { value: '우승', unit: '', label: '성적' },
      bigLine: '우승 · B조 복식', stats: [{ label: '종목', value: 'B조 복식' }, { label: '파트너', value: '민호' }],
      meta: '', metaLine: '○○시 오픈 대회', label: '○○시 오픈 대회 · B조 복식', date: '11/24 (화)',
      textPos: 'bottom', photoX: 0, photoY: 0, photoZoom: 1
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  function drawCard(spec) {
    var m = mock();
    SC().draw(m.canvas, spec);
    return m.log;
  }

  function ctxOf(state) {
    return {
      store: { state: state },
      actions: { setPref: function () {}, setTheme: function () { return { ok: true }; } },
      repaint: function () {}
    };
  }

  function rec(patch) {
    var r = {
      id: 'r_v166', type: '기록', userKey: ME, nick: '나래', date: '2026-11-24',
      minutes: 90, cond: 7, intensity: 7, done: ['스트록', '게임'],
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }],
      team: JSON.stringify({ partner: '민호', rival: '지호' }),
      pain: [], weakness: ['헤어핀'], note: ''
    };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  function stateOf(rows) {
    rows = rows || [rec()];
    return {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, club: '나래울' },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: { tab: 'log', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
  }

  function uiState(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      recordId: 'r_v166', photo: null, photoX: 0, photoY: 0, photoZoom: 1, textPos: 'bottom',
      gym: '나래울체육관', partner: '민호', rival: '지호', contest: '', event: '', result: '우승',
      compPartner: '', date: '2026-11-24', phrase: '민턴일기', phraseComp: '민턴일기', frame: 'none'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* =========================================================
   * 1. 모델 — 글씨 위치 3단
   * ========================================================= */

  test('v1.66 글씨 위치: 아래 · 가운데 · 위 세 가지이고 기본은 아래', function () {
    var sc = SC();
    eq(sc.TEXT_POS.length, 3, '3단');
    eq(sc.TEXT_POS.map(function (p) { return p.id; }).join(','), 'bottom,middle,top', 'id');
    eq(sc.TEXT_POS.map(function (p) { return p.name; }).join(','), '아래,가운데,위', '이름');
    sc.TEXT_POS.forEach(function (p) { ok(p.note && p.note.length > 2, p.id + ' 설명'); });
    eq(sc.textPosById('middle').name, '가운데', 'id로 찾기');
    eq(sc.textPosById('nope').id, 'bottom', '모르는 값은 아래');
    eq(sc.textPosById('').id, 'bottom', '빈 값은 아래');
    eq(sc.textPosById(undefined).id, 'bottom', '없는 값은 아래');
  });

  test('v1.66 글씨 위치: 처음 여는 시트는 아래, 마지막에 고른 값은 기억한다', function () {
    if (!hasNode) return;
    var sc = SC();
    var store = {};
    var fake = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    };
    root.localStorage = fake;
    try {
      eq(sc._initialState(ctxOf(stateOf()), {}).textPos, 'bottom', '기본 아래');
      eq(sc._writePrefs({ textPos: 'top' }), true, '저장됨');
      eq(sc._initialState(ctxOf(stateOf()), {}).textPos, 'top', '고른 값 기억');
      sc._writePrefs({ textPos: 'middle' });
      eq(sc._initialState(ctxOf(stateOf()), {}).textPos, 'middle', '고른 값 기억 2');
      /* 예전 기기(값이 없거나 깨진 경우)도 기본 '아래'로 안전하게 */
      fake.setItem('bm_share_prefs_v1', '{"textPos":"없는값"}');
      eq(sc._initialState(ctxOf(stateOf()), {}).textPos, 'bottom', '모르는 값은 아래');
    } finally {
      delete root.localStorage;
    }
    eq(sc._initialState(ctxOf(stateOf()), {}).textPos, 'bottom', '저장소가 없어도 아래');
  });

  /* =========================================================
   * 2. 그리기 — 글씨 위치가 실제로 옮겨진다
   * ========================================================= */

  test('v1.66 매거진: 위 → 가운데 → 아래 순서로 글씨가 내려온다', function () {
    var sc = SC();
    var ys = {};
    ['top', 'middle', 'bottom'].forEach(function (pos) {
      var log = drawCard(compSpec({ textPos: pos }));
      ys[pos] = yOf(log, '우승');
      ok(ys[pos] !== null, pos + ' 글씨를 그린다');
    });
    ok(ys.top < ys.middle, '위가 가운데보다 위 (' + ys.top + ' < ' + ys.middle + ')');
    ok(ys.middle < ys.bottom, '가운데가 아래보다 위 (' + ys.middle + ' < ' + ys.bottom + ')');
    ok(ys.top > 220, '위라도 스토리 안전 여백 근처에서 시작');
    ok(ys.bottom < 1350 && ys.bottom > 1000, '아래는 예전처럼 하단');
  });

  test('v1.66 매거진: 스크림도 글씨 자리를 따라간다 (가운데는 띠, 위는 위쪽)', function () {
    var sc = SC();
    var bottom = drawCard(compSpec({ textPos: 'bottom' }));
    var middle = drawCard(compSpec({ textPos: 'middle' }));
    var top = drawCard(compSpec({ textPos: 'top' }));

    /* 카드 폭을 덮는 스크림 사각형 — 채우기가 그라데이션이라 stops로 판단합니다 */
    function darkRects(log) {
      /* v1.67 — 사진 필터 레이어(단색 rgba)는 빼고, 스며드는 스크림(그라데이션)만 셉니다 */
      return log.rects.filter(function (r) {
        if (r.w !== 1080) return false;
        if (!(r.fill && r.fill.stops)) return false;
        return r.fill.stops.some(function (c) { return String(c).indexOf('rgba(') === 0; });
      });
    }
    ok(darkRects(bottom).length >= 1, '아래 — 하단 스크림');
    ok(darkRects(bottom).some(function (r) { return r.y >= 660; }), '아래 스크림은 카드 중턱 아래에서 시작');
    ok(darkRects(middle).length >= 1, '가운데 — 띠');
    var peak = function (log) {
      return log.gradients.some(function (g) {
        return g.stops.some(function (c) { return String(c).indexOf(',0.54)') > 0; });
      });
    };
    ok(peak(middle), '가운데는 한가운데가 가장 진한 띠');
    ok(!peak(bottom), '아래는 띠가 아니라 아래로 짙어지는 스크림');
    ok(darkRects(top).length >= 1, '위 — 위쪽 스크림');
    eq(Math.round(darkRects(top)[0].y), 0, '위 스크림은 맨 위에서 시작');
  });

  test('v1.66 매거진: 위·가운데 글씨가 위 여백·워드마크와 겹치지 않는다', function () {
    /* v1.71 — 날짜·장소는 카드 맨 아래로 내려가 머리줄이 없어졌습니다.
     * 위·가운데를 골라도 안전 여백과 워드마크(SHUTTLIX)를 침범하지 않는지만 봅니다. */
    ['top', 'middle'].forEach(function (pos) {
      var log = drawCard(compSpec({ textPos: pos, ratio: 'story' }));
      var big = yOf(log, '우승');
      ok(big !== null, pos + ' 큰 숫자');
      ok(big > 220 + 60, pos + ' 위 안전 여백 아래 (' + big + ')');
      ok(big < 1700, pos + ' 아래 안전 여백 위 (' + big + ')');
      var mark = yOf(log, 'SHUTTLIX');
      ok(mark === null || Math.abs(mark - big) > 60, pos + ' 워드마크와 안 겹침');
    });
    var topBig = yOf(drawCard(compSpec({ textPos: 'top', ratio: 'story' })), '우승');
    var midBig = yOf(drawCard(compSpec({ textPos: 'middle', ratio: 'story' })), '우승');
    ok(topBig < midBig, '위 < 가운데 (' + topBig + ' < ' + midBig + ')');
  });

  test('v1.66 필름: 아래는 인화지 여백, 가운데·위는 사진 위 흰 글씨', function () {
    var sc = SC();
    var bottom = drawCard(compSpec({ design: 'film', textPos: 'bottom' }));
    var middle = drawCard(compSpec({ design: 'film', textPos: 'middle' }));
    var top = drawCard(compSpec({ design: 'film', textPos: 'top' }));

    var yb = yOf(bottom, '우승 · B조 복식');
    var ym = yOf(middle, '우승 · B조 복식');
    var yt = yOf(top, '우승 · B조 복식');
    ok(yb !== null && ym !== null && yt !== null, '세 자리 모두 2줄을 그린다');
    ok(yt < ym && ym < yb, '위 < 가운데 < 아래 (' + yt + ' < ' + ym + ' < ' + yb + ')');

    var box = sc.photoFrameOf({ design: 'film', ratio: 'feed' });
    ok(yb > box.y + box.h, '아래는 인화지 아래 여백');
    ok(yt > box.y && yt < box.y + box.h * 0.4, '위는 사진 위쪽 안');
    ok(ym > box.y + box.h * 0.3 && ym < box.y + box.h * 0.75, '가운데는 사진 가운데쯤');

    eq(colorOf(bottom, '우승 · B조 복식').toLowerCase(), '#1d1b18', '아래는 종이 잉크');
    eq(colorOf(middle, '우승 · B조 복식'), '#ffffff', '가운데는 흰 글씨');
    eq(colorOf(top, '우승 · B조 복식'), '#ffffff', '위는 흰 글씨');
  });

  test('v1.66 스티커: 투명 그대로, 스티커 묶음이 위·가운데로 옮겨진다', function () {
    var sc = SC();
    var ys = {};
    ['bottom', 'middle', 'top'].forEach(function (pos) {
      var log = drawCard(compSpec({ design: 'sticker', textPos: pos, photo: null }));
      ys[pos] = yOf(log, '우승');
      /* 투명 PNG — 카드를 꽉 채우는 불투명 사각형이 없어야 합니다 */
      /* v1.67 — 메달 광택(그라데이션)은 투명도가 있어 바탕이 아닙니다 */
      var full = log.rects.filter(function (r) { return r.w === 1080 && r.h === 1350 && !(r.fill && r.fill.stops); });
      eq(full.length, 0, pos + ' 불투명 바탕 없음');
    });
    ok(ys.top < ys.middle && ys.middle < ys.bottom,
      '위 < 가운데 < 아래 (' + ys.top + ' < ' + ys.middle + ' < ' + ys.bottom + ')');
  });

  test('v1.66 바깥: 글씨가 카드 밖으로 나가지 않는다 (두 비율 모두)', function () {
    ['feed', 'story'].forEach(function (ratio) {
      var F = { feed: 1350, story: 1920 }[ratio];
      ['magazine', 'film', 'sticker'].forEach(function (design) {
        ['top', 'middle', 'bottom'].forEach(function (pos) {
          var log = drawCard(compSpec({ design: design, ratio: ratio, textPos: pos }));
          log.texts.forEach(function (x) {
            if (!x.text) return;
            ok(x.y > 0 && x.y < F, design + ' · ' + pos + ' · ' + ratio + ' 글씨 y=' + Math.round(x.y) + ' 안쪽');
          });
        });
      });
    });
  });

  /* =========================================================
   * 3. 사진 구도 — 위치 이동 · 확대
   * ========================================================= */

  test('v1.66 구도: 확대 범위는 1.0×~2.5×, 위치는 −1~1로 묶인다', function () {
    var sc = SC();
    eq(sc.ZOOM_MIN, 1, '최소 1.0×');
    eq(sc.ZOOM_MAX, 2.5, '최대 2.5×');
    eq(sc.zoomOf(3), 2.5, '너무 크면 2.5×');
    eq(sc.zoomOf(0.2), 1, '너무 작으면 1.0×');
    eq(sc.zoomOf('nope'), 1, '숫자가 아니면 1.0×');
    eq(sc.photoViewOf({ photoX: 4, photoY: -9, photoZoom: 9 }).x, 1, 'X는 1까지');
    eq(sc.photoViewOf({ photoX: 4, photoY: -9, photoZoom: 9 }).y, -1, 'Y는 −1까지');
    eq(sc.photoViewOf({ photoX: 4, photoY: -9, photoZoom: 9 }).zoom, 2.5, '확대도 묶임');
    eq(sc.photoViewOf({}).zoom, 1, '값이 없으면 1.0×');
    eq(sc.zoomLabel(1), '1.0×', '표시 1.0×');
    eq(sc.zoomLabel(1.25), '1.25×', '표시 1.25×');
    eq(sc.zoomLabel(2.5), '2.5×', '표시 2.5×');
  });

  test('v1.66 구도: 확대하면 프레임보다 커지고, 넘친 만큼만 움직인다', function () {
    var sc = SC();
    var img = photo(1200, 900);           /* 4:3 — 4:5 카드에 세로로 꽉 차고 가로만 넘침 */
    var one = sc.coverBox(img, 0, 0, 1080, 1350, { x: 0, y: 0, zoom: 1 });
    eq(Math.round(one.w), 1800, '1.0× 가로 1800');
    eq(Math.round(one.h), 1350, '1.0× 세로 1350 (꽉 참)');
    eq(Math.round(one.maxX), 360, '가로로 넘친 절반 360');
    eq(one.maxY, 0, '세로는 넘치지 않음');

    var two = sc.coverBox(img, 0, 0, 1080, 1350, { x: 0, y: 0, zoom: 2 });
    eq(Math.round(two.w), 3600, '2.0× 가로 3600');
    eq(Math.round(two.maxX), 1260, '2.0× 넘친 절반 1260');

    var right = sc.coverBox(img, 0, 0, 1080, 1350, { x: 1, y: 0, zoom: 2 });
    eq(Math.round(right.left), 0, '오른쪽 끝으로 끌면 사진 왼쪽 끝이 카드 왼쪽에');
    var left = sc.coverBox(img, 0, 0, 1080, 1350, { x: -1, y: 0, zoom: 2 });
    eq(Math.round(left.left), -2520, '왼쪽 끝으로 끌면 사진 오른쪽 끝이 카드 오른쪽에');
  });

  test('v1.66 구도: 미리보기와 그리는 곳이 같은 계산을 쓴다 (drawImage 자리)', function () {
    var sc = SC();
    var spec = compSpec({ photo: photo(1200, 900), photoX: 0, photoY: 0, photoZoom: 1 });
    var log = drawCard(spec);
    var img = log.images[0];
    ok(!!img, '사진을 그린다');
    var box = sc.coverBox(spec.photo, 0, 0, 1080, 1350, { x: 0, y: 0, zoom: 1 });
    eq(Math.round(img.x), Math.round(box.left), 'drawImage x = coverBox.left');
    eq(Math.round(img.w), Math.round(box.w), 'drawImage 폭 = coverBox.w');

    var zoomed = drawCard(compSpec({ photo: photo(1200, 900), photoX: 1, photoZoom: 2 }));
    ok(zoomed.images[0].w > log.images[0].w, '확대하면 더 크게 그린다');
    ok(zoomed.images[0].x > log.images[0].x, '오른쪽으로 옮기면 오른쪽으로 그린다');
  });

  test('v1.66 구도: 끌기는 화면 px을 사진 위치로 바꾸고, 넘칠 곳이 없으면 그대로', function () {
    var sc = SC();
    var canvas = { width: 1080, height: 1350, getBoundingClientRect: function () { return { width: 270 }; } };
    var spec = compSpec({ photo: photo(1200, 900) });     /* 1.0× — 세로는 넘치지 않음 */
    var r1 = sc.movePhotoBy(canvas, spec, -68, 40);
    ok(r1 && r1.x < 0, '왼쪽으로 끌면 X가 왼쪽 (−)');
    eq(r1.y, 0, '세로는 넘칠 곳이 없어 그대로');
    ok(r1.moved, '가로로는 움직임');

    var r2 = sc.movePhotoBy(canvas, compSpec({ photo: photo(1200, 900), photoX: r1.x }), -9999, 0);
    eq(r2.x, -1, '끝까지 끌어도 −1에서 멈춤');

    eq(sc.movePhotoBy(canvas, compSpec({ photo: null }), -50, 0), null, '사진이 없으면 움직이지 않음');
    /* 화면 폭이 카드의 1/4이면 같은 손가락 이동이 4배 크게 반영됩니다 */
    var small = { width: 1080, height: 1350, getBoundingClientRect: function () { return { width: 135 }; } };
    var a = sc.movePhotoBy(canvas, spec, -40, 0).x;
    var b = sc.movePhotoBy(small, spec, -40, 0).x;
    ok(Math.abs(b) > Math.abs(a) * 1.5, '작게 보이는 미리보기일수록 더 크게 움직임');
  });

  test('v1.66 구도: 필름은 인화지 안에서만 움직인다', function () {
    var sc = SC();
    var box = sc.photoFrameOf({ design: 'film', ratio: 'feed' });
    ok(box.x > 0 && box.w < 1080, '필름 사진 틀은 여백 안');
    var card = sc.photoFrameOf({ design: 'magazine', ratio: 'feed' });
    eq(card.x, 0, '매거진은 카드 전체');
    eq(card.w, 1080, '매거진 폭 = 카드 폭');
    var story = sc.photoFrameOf({ design: 'magazine', ratio: 'story' });
    eq(story.h, 1920, '스토리는 1920 높이');
  });

  /* =========================================================
   * 4. 시트 — 컨트롤
   * ========================================================= */

  test('v1.66 시트: 사진이 없으면 위치·확대 칸은 숨김, 있으면 열린다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var html = sc._sheetBody(ctxOf(stateOf()));
    includes(html, 'data-sc-zoombox', '칸이 있다');
    includes(html, ' data-sc-zoombox hidden', '사진 없으면 숨김');
    includes(html, 'data-sc-zoomin', '+ 버튼');
    includes(html, 'data-sc-zoomout', '− 버튼');
    includes(html, 'type="range"', '슬라이더');
    includes(html, 'min="1"', '슬라이더 최소 1');
    includes(html, 'max="2.5"', '슬라이더 최대 2.5');
    includes(html, 'data-sc-zoomreset', '원래대로');
    includes(html, '원래대로', '원래대로 글씨');

    sc._setState(uiState({ photo: photo(), photoZoom: 1.6 }));
    var on = sc._sheetBody(ctxOf(stateOf()));
    excludes(on, ' data-sc-zoombox hidden', '사진이 있으면 보인다');
    includes(on, '1.6×', '지금 배율 표시');
    includes(on, '끌면 구도를', '끄는 방법 안내');
  });

  test('v1.66 시트: 글씨 위치 3단이 디자인·비율 바로 아래에 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ textPos: 'middle' }));
    var html = sc._sheetBody(ctxOf(stateOf()));
    eq((html.match(/data-sc-textpos="/g) || []).length, 3, '3칸');
    includes(html, '>아래</button>', '아래');
    includes(html, '>가운데</button>', '가운데');
    includes(html, '>위</button>', '위');
    includes(html, 'data-sc-textpos="middle" aria-pressed="true"', '고른 칸만 켜짐');

    var design = html.indexOf('data-sc-design="magazine"');
    var ratio = html.indexOf('data-sc-ratio="feed"');
    var textpos = html.indexOf('data-sc-textpos="bottom"');
    var shade = html.indexOf('sc__shadebox');
    var more = html.indexOf('<details class="sc__more">');
    ok(design < ratio && ratio < textpos && textpos < shade, '디자인 → 비율 → 글씨 위치 → 사진 밝기');
    ok(textpos < more, '접기보다 위');
  });

  test('v1.66 시트: 스티커는 사진을 얹지 않아 위치·확대 칸이 없다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ design: 'sticker', photo: photo() }));
    var html = sc._sheetBody(ctxOf(stateOf()));
    includes(html, ' data-sc-zoombox hidden', '스티커는 숨김');
    includes(html, 'class="field sc__photo" hidden', '스티커는 사진 칸도 숨김');
  });

  /* =========================================================
   * 5. 상태 — 기본값 · 초기화 · spec
   * ========================================================= */

  test('v1.66 상태: 새 사진은 가운데 · 1.0×에서 시작한다', function () {
    if (!hasNode) return;
    var sc = SC();
    var st = sc._initialState(ctxOf(stateOf()), {});
    eq(st.photoX, 0, 'X 가운데');
    eq(st.photoY, 0, 'Y 가운데');
    eq(st.photoZoom, 1, '1.0×');
  });

  test('v1.66 상태: spec에 구도와 글씨 위치가 그대로 실린다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ photoX: -0.4, photoY: 0.6, photoZoom: 1.8, textPos: 'top' }));
    var spec = sc._specOf(ctxOf(stateOf()));
    eq(spec.photoX, -0.4, 'photoX');
    eq(spec.photoY, 0.6, 'photoY');
    eq(spec.photoZoom, 1.8, 'photoZoom');
    eq(spec.textPos, 'top', 'textPos');

    sc._setState(uiState({ textPos: '???' }));
    eq(sc._specOf(ctxOf(stateOf())).textPos, 'bottom', '모르는 값은 아래로');
  });

  test('v1.66 배선: 사진을 바꾸거나 빼면 구도를 기본값으로 되돌린다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    var clear = src.slice(src.indexOf("if (ev.target.closest('[data-sc-photoclear]'))"));
    var clearBlock = clear.slice(0, clear.indexOf('return;'));
    includes(clearBlock, 'ui.photoX = 0', '사진 빼기 — X');
    includes(clearBlock, 'ui.photoY = 0', '사진 빼기 — Y');
    includes(clearBlock, 'ui.photoZoom = ZOOM_MIN', '사진 빼기 — 확대');

    var up = src.slice(src.indexOf('readPhoto(input.files[0]'));
    var upBlock = up.slice(0, up.indexOf('BM.ui.haptic(10)'));
    includes(upBlock, 'ui.photoX = 0', '사진 바꾸기 — X');
    includes(upBlock, 'ui.photoZoom = ZOOM_MIN', '사진 바꾸기 — 확대');

    var reset = src.slice(src.indexOf("ev.target.closest('[data-sc-zoomreset]')"));
    includes(reset.slice(0, reset.indexOf('return;')), 'ui.photoZoom = ZOOM_MIN', '원래대로');
  });

  test('v1.66 배선: 끌기는 포인터 이벤트로, 미리보기에서만 (스크롤은 그대로)', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    includes(src, "addEventListener('pointerdown'", 'pointerdown');
    includes(src, "addEventListener('pointermove'", 'pointermove');
    includes(src, "addEventListener('pointerup'", 'pointerup');
    includes(src, "addEventListener('pointercancel'", 'pointercancel');
    includes(src, 'setPointerCapture', '포인터 잡기 (손가락이 미리보기를 벗어나도 따라옴)');
    includes(src, "closest('.sc__canvas')", '미리보기 캔버스에서만');
    includes(src, "ui.design === 'sticker'", '스티커는 끌지 않음');

    var css = readRoot('styles.css');
    includes(css, '.sc__preview.is-drag .sc__canvas { touch-action: none;', '끌 때만 touch-action: none');
    includes(css, '.sc__zoomrow {', '확대 줄 스타일');
    includes(css, '.sc__textposbtn {', '글씨 위치 스타일');
  });

  /* =========================================================
   * 6. 보호 — 저장 크기 · 투명 · 프라이버시 · 버전
   * ========================================================= */

  test('v1.66 보호: 저장 PNG는 그대로 1080×1350 · 1080×1920', function () {
    var sc = SC();
    eq(sc.dimsOf('feed').w, 1080, '피드 폭');
    eq(sc.dimsOf('feed').h, 1350, '피드 높이');
    eq(sc.dimsOf('story').w, 1080, '스토리 폭');
    eq(sc.dimsOf('story').h, 1920, '스토리 높이');
    var feed = mock();
    sc.draw(feed.canvas, compSpec({ textPos: 'top', photoZoom: 2, photoX: 1 }));
    eq(feed.canvas.width, 1080, '피드 캔버스 폭');
    eq(feed.canvas.height, 1350, '피드 캔버스 높이');
    var story = mock();
    sc.draw(story.canvas, compSpec({ ratio: 'story', textPos: 'middle', photoZoom: 2.5 }));
    eq(story.canvas.height, 1920, '스토리 캔버스 높이');
  });

  test('v1.66 보호: 사진은 여전히 서버로 보내지 않는다 (폰 안에서만)', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    excludes(src, 'fetch(', '네트워크 호출 없음');
    excludes(src, 'XMLHttpRequest', 'XHR 없음');
    includes(src, 'readAsDataURL', '폰 안에서 읽기');
    includes(src, '사진은 폰 안에서만', '안내 문구 유지');
  });

  test('v1.66 보호: 예시에 실존 선수 이름을 쓰지 않는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) { excludes(src, name, name + ' 없음'); });
  });

  test('v1.66 버전: sw · app · 스타일 캐시 · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.99.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.99.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-5', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.99.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.99.0', 'TWA appVersion');
    eq(twa.appVersionCode, 93, 'TWA 버전 코드');
  });

  test('v1.66 배선: 테스트 목록에 v166이 들어 있다', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v166.test.js', 'run.js');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
