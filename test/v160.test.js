/* ============================================================
 * test/v160.test.js — bm-v1.73.0
 *   ✨ 인스타 공유 카드 감성 리디자인 (매거진 · 필름 · 스티커)
 *
 *  사용자가 요청한 그대로를 검증합니다.
 *   "인스타 공유카드 사람이 만든거 처럼 사진올리고 이쁘게 되게 안될까?
 *    유명한사람들이나 팔로우 많은 사람이 올린거 참고해서"
 *
 *   1) 개발자 표·네모박스 탈피 — 사진이 주인공, 하단 30%만 스며드는 스크림,
 *      큰 숫자 2~3개 + 얇은 라인 + 작은 스탯. strokeRect(네모 테두리) 없음.
 *   2) 디자인 4종 — 매거진(에디토리얼) · 영수증(민턴 영수증, v1.71) · 필름(폴라로이드) · 스티커(투명).
 *   3) 인스타 비율 2종 — 피드 4:5(1080×1350) · 스토리 9:16(1080×1920, 위아래 220px 안전).
 *   4) 사진 없을 때도 에디토리얼 배경 · 사진 밝기 3단계 · 오늘 운동/대회 인증 모두 적용.
 *   5) 보호 — 사진은 폰 안에서만(업로드 없음) · 5개 탭 · CSP · 실명 없음 · 버전.
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

  function ctxOf(state) {
    return {
      store: { state: state },
      actions: { setPref: function () {}, setTheme: function () { return { ok: true }; } },
      repaint: function () {}
    };
  }

  function rec(patch) {
    var r = {
      id: 'r_v160', type: '기록', userKey: ME, nick: '나래', date: '2026-11-23',
      minutes: 90, cond: 7, intensity: 7, done: ['스트록', '게임'],
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }],
      team: JSON.stringify({ partner: '민호', rival: '지호' }),
      pain: [], weakness: ['헤어핀'], note: ''
    };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  function stateOf(rows, patch) {
    rows = rows || [rec()];
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, club: '나래울' },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: { tab: 'my', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  function uiState(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', recordId: 'r_v160', photo: null,
      gym: '나래울체육관', partner: '민호', rival: '지호', contest: '', event: '', result: '우승',
      compPartner: '', date: '2026-11-23'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* ---------- 가짜 2D 컨텍스트 — 그리기 호출을 그대로 기록 ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mockCanvas() {
    var log = {
      texts: [], textColors: [], textYs: [], rects: [], styles: [], stops: [],
      gradients: [], arcs: [], ops: [], strokes: 0, strokeRects: 0, canvasW: 0, canvasH: 0
    };
    function gradient(x0, y0, x1, y1) {
      var g = { x0: x0, y0: y0, x1: x1, y1: y1, stops: [], addColorStop: function (o, c) { g.stops.push(c); log.stops.push(c); } };
      log.gradients.push(g);
      return g;
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1, lineCap: '', lineJoin: '',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) { log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle }); log.ops.push('fillRect'); },
      strokeRect: function () { log.strokeRects++; log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      arcTo: function (x, y, x1, y1, r) { log.arcs.push(r); },
      arc: function () {},
      fill: function () { log.styles.push(g.fillStyle); log.ops.push('fill'); },
      stroke: function () { log.styles.push(g.strokeStyle); log.strokes++; log.ops.push('stroke'); },
      clip: function () {},
      save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) {
        log.texts.push(String(text)); log.textColors.push(g.fillStyle); log.textYs.push(y); log.ops.push('fillText');
      },
      drawImage: function () { log.ops.push('drawImage'); }
    };
    var canvas = {
      width: 0, height: 0,
      getContext: function () { return g; },
      toBlob: function (cb) { cb({ size: 10, type: 'image/png' }); }
    };
    return { canvas: canvas, ctx: g, log: log };
  }

  function usesColor(log, color) {
    return log.styles.indexOf(color) >= 0 || log.stops.indexOf(color) >= 0 ||
      log.textColors.indexOf(color) >= 0 ||
      log.rects.some(function (r) { return r.fill === color; });
  }

  function cardSpec(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', photo: null,
      top: '11/23 (일) · 나래울체육관', kicker: '운동 시간',
      big: { value: '90', unit: '분', label: '운동 시간' },
      bigLine: '90분 · 2승 1패',
      stats: [{ label: '경기', value: '2승 1패' }, { label: '연속 기록', value: '5일' }],
      meta: '민호와 함께 · vs 지호', metaLine: '나래울체육관', phrase: '민턴일기', label: '2승 1패 · 11/23 (일)',
      date: '11/23 (일)',
      comp: null
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  function compSpec(patch) {
    var s = {
      mode: 'comp', top: '11/22 (일)', kicker: '○○시 오픈 배드민턴 대회',
      big: { value: '준우승', unit: '', label: '성적' }, bigLine: '준우승 · B조 복식',
      stats: [{ label: '종목', value: 'B조 복식' }, { label: '파트너', value: '민호' }],
      meta: '', metaLine: '○○시 오픈 배드민턴 대회', label: '○○시 오픈 배드민턴 대회 · B조 복식'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return cardSpec(s);
  }

  /* =========================================================
   * 1. 비율 2종 — 피드 4:5 · 스토리 9:16
   * ========================================================= */

  test('v1.60 비율: 피드 4:5(1080×1350)와 스토리 9:16(1080×1920)로 그린다', function () {
    var sc = SC();
    eq(sc.W, 1080, '기본 가로 1080');
    eq(sc.H, 1350, '기본 세로 1350');
    eq(sc.RATIOS.map(function (r) { return r.id; }).join(','), 'feed,story', '비율 2종');
    eq(sc.RATIOS.map(function (r) { return r.name; }).join(','), '피드 4:5,스토리 9:16', '비율 이름');

    var feed = mockCanvas();
    sc.draw(feed.canvas, cardSpec({ ratio: 'feed' }));
    eq(feed.canvas.width + 'x' + feed.canvas.height, '1080x1350', '피드 캔버스');

    var story = mockCanvas();
    sc.draw(story.canvas, cardSpec({ ratio: 'story' }));
    eq(story.canvas.width + 'x' + story.canvas.height, '1080x1920', '스토리 캔버스');

    eq(sc.dimsOf().w + 'x' + sc.dimsOf().h, '1080x1350', '모르는 비율은 피드');
    eq(sc.dimsOf('story').safe, 220, '스토리 안전 여백 220');
  });

  test('v1.60 스토리: 모든 글씨가 위·아래 220px 안전 여백 안에 있다', function () {
    var sc = SC();
    ['magazine', 'film', 'sticker'].forEach(function (d) {
      ['today', 'comp'].forEach(function (mode) {
        var m = mockCanvas();
        var spec = mode === 'comp' ? compSpec({ design: d, ratio: 'story' }) : cardSpec({ design: d, ratio: 'story' });
        sc.draw(m.canvas, spec);
        ok(m.log.textYs.length >= 2, d + '/' + mode + ' 글씨가 있다');
        m.log.textYs.forEach(function (y) {
          ok(y >= 220, d + '/' + mode + ' 위 220px 안 (' + y + ')');
          ok(y <= 1700, d + '/' + mode + ' 아래 220px 안 (' + y + ')');
        });
      });
    });
  });

  /* =========================================================
   * 2. 디자인 4종 · 색 5종 · 사진 밝기 3단계
   * ========================================================= */

  test('v1.60 디자인: 매거진 · 필름 · 스티커 3종이고 기본은 매거진이다', function () {
    var sc = SC();
    eq(sc.DESIGNS.length, 4, '디자인 4종 (v1.71 영수증 추가)');
    eq(sc.DESIGNS.map(function (d) { return d.id; }).join(','), 'magazine,receipt,film,sticker', '아이디');
    eq(sc.DESIGNS.map(function (d) { return d.name; }).join(','), '매거진,영수증,필름,스티커', '이름');
    eq(sc.designById(undefined).id, 'magazine', '모르는 값은 매거진');
    eq(sc.designById('film').name, '필름', '필름');
    eq(sc.designById('sticker').id, 'sticker', '스티커');
    /* v1.58의 미니멀·포스터·코트 라인은 사라지고 이 3종으로 대체 */
    eq(sc.designById('minimal').id, 'magazine', '예전 값도 안전하게 기본으로');
  });

  test('v1.60 색: 5종 그대로이고 기본은 나이트 · 한 카드는 포인트 1색만 쓴다', function () {
    var sc = SC();
    eq(sc.PALETTES.length, 5, '색 5종');
    eq(sc.PALETTES.map(function (p) { return p.name; }).join(','), '나이트,코트 블루,선셋,사쿠라,챔피언 골드', '이름');
    eq(sc.paletteById(undefined).id, 'night', '기본 나이트');
    eq(sc.paletteById('없는색').id, 'night', '모르는 색은 나이트');

    /* 사진 위 매거진 카드의 글씨 색 = 흰색 계열 + 포인트 1색 */
    sc.PALETTES.forEach(function (p) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ palette: p.id, photo: { width: 1200, height: 1600 } }));
      var allowed = p.accent.toLowerCase();
      m.log.textColors.forEach(function (c) {
        var v = String(c).toLowerCase();
        ok(v === '#ffffff' || v.indexOf('rgba(255,255,255') === 0 || v === allowed,
          p.id + ' 글씨 색 3개 이하 (' + c + ')');
      });
      ok(usesColor(m.log, p.accent), p.id + ' 고른 색이 포인트로');
    });
  });

  test('v1.60 밝기: 원본 · 살짝 어둡게 · 감성 어둡게 3단계가 사진을 덮는 정도로 다르다', function () {
    var sc = SC();
    eq(sc.SHADES.length, 3, '밝기 3단계');
    eq(sc.SHADES.map(function (s) { return s.name; }).join(','), '원본,살짝 어둡게,감성 어둡게', '이름');
    eq(sc.shadeById(undefined).id, 'original', '기본 원본');

    var photo = { width: 1200, height: 1600 };
    var covers = ['original', 'soft', 'deep'].map(function (id) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ shade: id, photo: photo, palette: 'night' }));
      /* v1.67 — 사진 필터 레이어 대신 어둡게 덮는 스크림(rgb 4,9,7)만 봅니다 */
      var c = m.log.rects.filter(function (r) { return r.w === 1080 && r.h === 1350 && String(r.fill).indexOf('rgba(4,9,7,') === 0; });
      return c.length ? String(c[0].fill) : '';
    });
    eq(covers[0], '', '원본은 사진을 덮지 않는다');
    includes(covers[1], '0.26', '살짝 어둡게');
    includes(covers[2], '0.46', '감성 어둡게');
  });

  /* =========================================================
   * 3. 매거진 — 사진 풀블리드 · 스크림 · 큰 숫자
   * ========================================================= */

  test('v1.60 매거진: 사진이 카드를 꽉 채우고 네모 박스·테두리가 없다', function () {
    var sc = SC();
    var src = readRoot('js/sharecard.js');
    excludes(src, 'strokeRect', '네모 테두리(strokeRect) 없음');

    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'magazine', photo: { width: 900, height: 1600 } }));
    ok(m.log.ops.indexOf('drawImage') >= 0, '사진을 그린다');
    eq(m.log.strokeRects, 0, '테두리 사각형 없음');
    var whitePanel = m.log.rects.some(function (r) {
      return String(r.fill).indexOf('rgba(255,255,255') === 0 && r.w * r.h > 200000;
    });
    ok(!whitePanel, '사진을 덮는 반투명 흰 박스 없음');

    /* 스크림은 아래 30% 남짓에서만 시작 */
    var scrims = m.log.gradients.filter(function (g) { return g.stops.some(function (c) { return String(c).indexOf('rgba(') === 0; }); });
    ok(scrims.some(function (g) { return g.y0 >= 1350 * 0.5; }), '아래쪽에서 스며드는 그라데이션');
    ok(scrims.some(function (g) { return g.stops.some(function (c) { return String(c).indexOf(',0.58)') > 0; }); }), '맨 아래는 진하게 (v1.67 스크림 축소)');
  });

  test('v1.60 매거진: 큰 숫자 하나 + 얇은 선 1개 + 작은 스탯 2개', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'magazine' }));
    var joined = m.log.texts.join('|');
    includes(joined, '90', '큰 숫자');
    includes(joined, '분', '단위');
    includes(joined, '2승 1패', '스탯');
    includes(joined, '11/23 (일)', '위 날짜');
    includes(joined, '나래울체육관', '장소');
    /* 가로선은 얇은 1~2획만 (박스 테두리 아님) */
    ok(m.log.strokes <= 8, '선은 얇게 몇 획만 (' + m.log.strokes + ')');
    eq(m.log.strokeRects, 0, '테두리 사각형 없음');
  });

  test('v1.60 매거진: 사진이 없으면 메쉬 그라데이션 + 옅은 셔틀콕 선화로 채운다', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'magazine', photo: null, palette: 'sunset' }));
    eq(m.log.rects.filter(function (r) { return r.w === 1080 && r.h === 1350; }).length >= 3, true, '바탕 + 빛 3겹');
    ok(m.log.strokes >= 4, '셔틀콕 선화');
    ok(usesColor(m.log, sc.paletteById('sunset').accent), '고른 색의 빛');
  });

  /* =========================================================
   * 4. 필름 — 폴라로이드 여백 + 모노스페이스 한 줄
   * ========================================================= */

  test('v1.60 필름: 오프화이트 종이 + 둥근 모서리 0~4px + 모노스페이스 한 줄 + 셔틀콕 스탬프', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'film', photo: { width: 1200, height: 1600 } }));
    var paper = m.log.rects.some(function (r) {
      return r.w === 1080 && r.h === 1350 && r.fill && r.fill.stops && r.fill.stops.indexOf('#F7F5F0') >= 0;
    });
    ok(paper, '따뜻한 오프화이트 종이 바탕(#F7F5F0)');
    ok(m.log.ops.indexOf('drawImage') >= 0, '사진을 프레임 안에');
    ok(m.log.arcs.length > 0, '둥근 모서리');
    ok(m.log.arcs.every(function (r) { return r <= 6; }), '모서리 반경 0~4px 급');
    ok(m.log.strokes >= 4, '셔틀콕 스탬프 선');
    includes(m.log.texts.join('|'), '11/23 (일)', '날짜');
    includes(m.log.texts.join('|'), '나래울체육관', '체육관');
  });

  test('v1.60 필름: 사진이 없어도 종이 위 필름 톤 자리 + 셔틀콕 선화', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'film', photo: null }));
    ok(m.log.ops.indexOf('drawImage') < 0, '사진 없음');
    ok(m.log.rects.length >= 2, '종이 + 사진 자리');
    ok(m.log.strokes >= 4, '셔틀콕 선화');
  });

  /* =========================================================
   * 5. 스티커 — 배경 투명 · 큰 숫자 + 셔틀콕 라인
   * ========================================================= */

  test('v1.60 스티커: 배경을 칠하지 않는 투명 PNG (큰 숫자 + 얇은 한 줄 + 셔틀콕)', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'sticker' }));
    eq(m.log.ops[0], 'clearRect', '투명하게 비우고 시작');
    eq(m.log.rects.length, 0, '배경 사각형 없음');
    includes(m.log.texts.join('|'), '90', '큰 숫자');
    includes(m.log.texts.join('|'), '민턴일기', '문구 한 줄');
    ok(m.log.strokes >= 4, '셔틀콕 라인 아이콘');
    ok(m.log.textColors.indexOf('#ffffff') >= 0, '사진 위에서도 읽히게 흰 글씨');
  });

  /* =========================================================
   * 6. 오늘 운동 · 대회 인증 × 디자인 3종(현재 4종)
   * ========================================================= */

  test('v1.60 오늘 운동: 운동 시간·승패·날짜가 세 디자인 모두에 들어간다', function () {
    var sc = SC();
    ['magazine', 'film', 'sticker'].forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ design: d }));
      var joined = m.log.texts.join('|');
      includes(joined, '90', d + ' 운동 시간');
      includes(joined, '2승 1패', d + ' 승패');
      includes(joined, '11/23 (일)', d + ' 날짜');
    });
  });

  test('v1.60 대회 인증: 대회명·성적·종목·파트너가 세 디자인 모두에 들어간다', function () {
    var sc = SC();
    ['magazine', 'film', 'sticker'].forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, compSpec({ design: d }));
      var joined = m.log.texts.join('|');
      includes(joined, '준우승', d + ' 성적');
      includes(joined, 'B조 복식', d + ' 종목');
      includes(joined, '○○시 오픈 배드민턴 대회', d + ' 대회명');
    });
  });

  test('v1.60 그리기: 모르는 값·빈 스펙도 기본 카드로 안전하게 그린다', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, { mode: 'today', design: '없음', ratio: '없음', shade: '없음', palette: '없음',
      photo: null, big: { value: '90', unit: '분' }, stats: [], top: '', kicker: '', meta: '' });
    eq(m.canvas.width + 'x' + m.canvas.height, '1080x1350', '기본 피드');
    includes(m.log.texts.join('|'), '90', '숫자 그대로');
    eq(sc.draw(null, {}), null, '캔버스가 없으면 null');
    eq(sc.draw({}, {}), null, 'getContext가 없으면 null');

    var empty = mockCanvas();
    sc.draw(empty.canvas, { mode: 'today', design: 'film', ratio: 'feed', shade: 'original', palette: 'night',
      photo: null, big: { value: '', unit: '' }, stats: [], top: '', kicker: '', meta: '' });
    ok(empty.log.ops.length > 5, '빈 값도 그린다(깨진 숫자 대신 빈 자리)');
  });

  /* =========================================================
   * 7. 모델 — 일지 · 대회 입력 → 카드 스펙
   * ========================================================= */

  test('v1.60 모델: 오늘 운동 스펙 — 큰 숫자 1개 + 스탯 2개 · 날짜·체육관·상대', function () {
    if (!hasNode) return;
    var sc = SC();
    /* 연속 일수는 '오늘'부터 거슬러 세므로 날짜를 고정하면 다음 날부터 테스트가 깨집니다.
     * 오늘·어제·그저께로 바꿔 언제 돌려도 3일이 되게 합니다. */
    function daysAgo(n) {
      var d = new Date(U.ymd() + 'T00:00:00');
      d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    var today = daysAgo(0);
    var state = stateOf([rec({ date: today }),
      rec({ id: 'r_v160b', date: daysAgo(1) }), rec({ id: 'r_v160c', date: daysAgo(2) })]);
    sc._setState(uiState({ recordId: 'r_v160', gym: '나래울체육관', partner: '민호', rival: '지호' }));
    var spec = sc._specOf(ctxOf(state));
    eq(spec.design, 'magazine', '기본 매거진');
    eq(spec.ratio, 'feed', '기본 피드');
    eq(spec.shade, 'original', '기본 원본');
    eq(spec.big.value, '90', '운동 시간');
    eq(spec.big.unit, '분', '단위');
    eq(spec.stats.length, 2, '나머지 스탯 2개');
    eq(spec.stats[0].value, '2승 1패', '승패');
    eq(spec.stats[1].value, '3일', '연속');
    includes(spec.top, Number(today.slice(5, 7)) + '/' + Number(today.slice(8, 10)), '오늘 날짜');
    includes(spec.top, '나래울체육관', '위 줄 체육관');
    includes(spec.meta, '민호와 함께', '파트너');
    includes(spec.meta, 'vs 지호', '라이벌');
    eq(spec.phrase, '민턴일기', '카드 문구 기본값');
    includes(spec.label, '2승 1패', '스티커 한 줄');
  });

  test('v1.60 모델: 대회 인증 스펙 — 대회명 · 성적 · 종목 · 파트너', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ mode: 'comp', contest: '○○시 오픈 배드민턴 대회', event: 'B조 복식', result: '준우승', compPartner: '민호' }));
    var spec = sc._specOf(ctxOf(state));
    eq(spec.mode, 'comp', '대회 인증');
    eq(spec.big.value, '준우승', '성적');
    eq(spec.kicker, '○○시 오픈 배드민턴 대회', '대회명');
    eq(spec.stats[0].value, 'B조 복식', '종목');
    eq(spec.stats[1].value, '민호', '파트너');
    includes(spec.top, '/', '날짜');
  });

  test('v1.60 요약: 디자인 · 비율 · 색 이름이 함께 남는다', function () {
    var sc = SC();
    var sum = sc.summaryOf({ mode: 'today', title: '오늘 운동', big: { value: '90', unit: '분' },
      meta: '나래울', design: 'sticker', ratio: 'story', palette: 'gold' });
    includes(sum, '오늘 운동', '제목');
    includes(sum, '90분', '숫자');
    includes(sum, '스티커', '디자인');
    includes(sum, '스토리 9:16', '비율');
    includes(sum, '챔피언 골드', '색');
    /* 사진이 있으면 밝기 단계도 */
    var withPhoto = sc.summaryOf({ mode: 'today', title: '오늘 운동', big: { value: '90', unit: '분' },
      design: 'film', ratio: 'feed', palette: 'night', photo: { width: 10, height: 10 }, shade: 'deep' });
    includes(withPhoto, '감성 어둡게', '밝기');
  });

  /* =========================================================
   * 8. 시트 — 사진 · 디자인 · 비율 · 밝기 · 색 · 미리보기
   * ========================================================= */

  test('v1.60 시트: 사진 고르기 · 디자인 3 · 비율 2 · 밝기 3 · 색 5 · 미리보기 · 저장', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec(), rec({ id: 'r_prev', date: '2026-11-22', minutes: 60 })]);
    sc._setState(uiState({ recordId: 'r_v160' }));
    var html = sc._sheetBody(ctxOf(state));
    includes(html, 'data-sc-mode="today"', '오늘 운동 탭');
    includes(html, 'data-sc-mode="comp"', '대회 인증 탭');
    eq((html.match(/data-sc-design="/g) || []).length, 4, '디자인 4칸');
    ['magazine', 'film', 'sticker'].forEach(function (id) {
      includes(html, 'data-sc-design="' + id + '"', '디자인 ' + id);
    });
    eq((html.match(/data-sc-ratio="/g) || []).length, 2, '비율 2칸');
    includes(html, 'data-sc-ratio="feed"', '피드');
    includes(html, 'data-sc-ratio="story"', '스토리');
    eq((html.match(/data-sc-shade="/g) || []).length, 3, '밝기 3칸');
    eq((html.match(/data-sc-pal="/g) || []).length, 5, '색 5칸');
    includes(html, 'type="file" accept="image/*"', '갤러리·카메라');
    includes(html, '폰 안에서만', '사진은 서버로 보내지 않음');
    includes(html, 'width="1080" height="1350"', '피드 캔버스');
    includes(html, 'data-sc-summary', '카드 요약');
    includes(html, 'data-sc-save', '저장·공유 버튼');
    includes(html, '어느 일지로 만들까요', '최근 일지 고르기');
    includes(html, '스토리', '비율 안내');

    /* 스토리를 고르면 캔버스가 9:16 */
    sc._setState(uiState({ ratio: 'story' }));
    var story = sc._sheetBody(ctxOf(state));
    includes(story, 'width="1080" height="1920"', '스토리 캔버스');

    /* 대회 모드 — 대회 입력칸·성적 칩 */
    sc._setState(uiState({ mode: 'comp', contest: '○○시 오픈 대회', event: 'B조 복식', result: '준우승' }));
    var comp = sc._sheetBody(ctxOf(state));
    includes(comp, 'data-sc-field="contest"', '대회명 칸');
    includes(comp, 'data-sc-field="event"', '급종목 칸');
    ['우승', '준우승', '3위', '출전'].forEach(function (r) {
      includes(comp, 'data-sc-result="' + r + '"', '성적 ' + r);
    });
    includes(comp, 'data-sc-field="compPartner"', '파트너 칸');
    excludes(comp, '어느 일지로 만들까요', '대회 모드에는 일지 선택 없음');
  });

  test('v1.60 시트: 일지가 없으면 저장 버튼이 꺼지고 안내가 뜬다', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([]);
    sc._setState(uiState({ recordId: '', photo: null }));
    var html = sc._sheetBody(ctxOf(state));
    includes(html, 'data-sc-save disabled', '저장 버튼 꺼짐');
    includes(html, '일지를 먼저 저장해 주세요', '안내');
    includes(html, '일지가 아직 없어요', '빈 상태 설명');
  });

  test('v1.60 시트: 스티커는 사진 칸을 숨기고, 사진이 있으면 밝기 칸이 열린다', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ design: 'sticker' }));
    var st = sc._sheetBody(ctxOf(state));
    includes(st, 'class="field sc__photo" hidden', '스티커는 사진 칸 숨김');
    includes(st, '투명 PNG 저장', '투명 PNG 저장 안내');

    sc._setState(uiState({ design: 'magazine', photo: { width: 10, height: 10 } }));
    var ph = sc._sheetBody(ctxOf(state));
    excludes(ph, 'class="field sc__photo" hidden', '사진 칸 보임');
    excludes(ph, 'class="field sc__shadebox" hidden', '밝기 칸 보임');
    includes(ph, '사진 바꾸기', '사진 바꾸기');
  });

  test('v1.60 시트: 사용자가 적은 글자는 이스케이프되어 나간다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({
      mode: 'comp', design: 'film', ratio: 'story',
      contest: '<img src=x onerror=alert(1)>', event: '"><script>alert(2)</script>',
      compPartner: '<b>'
    }));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    excludes(html, '<img src=x', '대회명 이스케이프');
    excludes(html, '<script>alert(2)', '종목 이스케이프');
    includes(html, '&lt;img', '글자로 남김');
  });

  /* =========================================================
   * 9. 저장 · 공유 — 사진은 폰 안에서만
   * ========================================================= */

  test('v1.60 저장: PNG 이름 · 공유 시트 · 다운로드 · 서버 전송 없음', function () {
    if (!hasNode) return;
    var sc = SC();
    var src = readRoot('js/sharecard.js');
    includes(src, "'image/png'", 'PNG 저장');
    includes(src, 'canvas.toBlob', '캔버스 → PNG');
    includes(src, 'navigator.canShare', '공유 시트 지원 확인');
    includes(src, 'navigator.share', '인스타 스토리로 바로 공유');
    includes(src, 'URL.createObjectURL', '공유가 없으면 다운로드');
    includes(src, 'clearRect', '투명 스티커(배경 투명)');
    includes(src, 'createLinearGradient', '스크림·메쉬 그라데이션');
    excludes(src, 'fetch(', '서버 전송 없음');
    excludes(src, 'XMLHttpRequest', '서버 전송 없음');
    excludes(src, 'new FormData', '업로드 없음');

    eq(sc.filename('today', '2026-11-23'), 'badminton-share-20261123-today.png', '오늘 카드 이름');
    eq(sc.filename('comp', '2026-11-23'), 'badminton-share-20261123-contest.png', '대회 카드 이름');
  });

  /* =========================================================
   * 10. 보호 — 기존 기능 · 보안 · 버전
   * ========================================================= */

  test('v1.60 보호: 5개 탭과 공유 카드 입구 세 곳이 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');
    eq(SC().MODES.length, 2, '두 모드');
    eq(SC().RESULTS.length, 4, '성적 4종');
    eq(SC().PALETTES.length, 5, '색 5종');

    var logjs = readRoot('js/views/log.js');
    includes(logjs, '인스타 공유 카드 만들기', '저장 직후 버튼');
    includes(logjs, 'BM.sharecard.open(ctx', '공유 카드 열기');
    includes(BM.views.log.recordDetail(rec()), 'data-act="share-card"', '기록 상세 버튼');
    var my = BM.views.my.render(stateOf([rec()]));
    includes(my, '인스타 공유 카드', 'MY 입구');
    includes(my, '매거진', 'MY 안내에 디자인');
  });

  test('v1.60 보안: 이스케이프 · CSP · 실명 없음', function () {
    if (!hasNode) return;
    var sc = readRoot('js/sharecard.js');
    includes(sc, 'U.esc(', '이스케이프');
    excludes(sc, 'eval(', 'eval 없음');
    excludes(sc, "innerHTML = '<", '사용자 글자를 그대로 넣지 않음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
    includes(csp, "default-src 'self'", 'self 만');
    ['김원호', '안세영', '서재승', '서승재'].forEach(function (name) {
      excludes(sc, name, name + ' 없음');
    });
    SC()._setState(uiState({ mode: 'comp' }));
    excludes(SC()._sheetBody(ctxOf(stateOf([rec()]))), '김원호', '시트 예시도 가명만');
  });

  test('v1.60 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.74.0'", 'sw.js');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
    includes(app, "version: 'v1.74.0'", 'app.js');
    includes(index, 'styles.css?v=20261125-3', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.74.0', 'TWA 이름');
    eq(twa.appVersion, '1.74.0', 'TWA 버전');
    eq(twa.appVersionCode, 68, 'TWA 코드');
    includes(index, 'js/sharecard.js', 'index 스크립트');
  });

  test('v1.60 배선: sw 캐시 · 스타일 · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "'./js/sharecard.js'", 'sw 캐시 sharecard');
    var css = readRoot('styles.css');
    ['.sc__designs', '.sc__design.is-on', '.sc__ratios', '.sc__ratio--story i', '.sc__shadebox', '.seg--three',
      '.sc__preview', '.sc__canvas'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    includes(css, 'max-height: 58vh', '스토리 카드가 폰 화면을 넘지 않게');
    var run = readRoot('test/run.js');
    includes(run, 'test/v160.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
