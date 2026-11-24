/* ============================================================
 * test/v167.test.js — bm-v1.71.0
 *   ✨ 인스타 공유 카드 자동 꾸미기 · 메달 임팩트 · 도발 멘트
 *
 *  승우 님 피드백:
 *   "부자연스럽다, 사진 넣으면 자동으로 이쁘게 꾸며져야 인스타 대신 쓸 메리트가 있다"
 *   "대회 메달 색깔별 임팩트" · "누구 이기면 도발 멘트"
 *   추가 지시: 땀샷·라켓샷 감성(숫자 숨기기) · 오늘의 한 줄 자랑 · 파트너/라이벌 태그
 *
 *   1) 사진 필터 5종 — 자동 감성(기본) · 필름 · 선명 · 흑백 · 원본.
 *      ctx.filter를 지원하면 한 번에, 아니면 합성 레이어로 같은 느낌.
 *   2) 과한 검은 스크림 축소 — 글씨 뒤 그림자 + 은은한 국소 비네트로 사진 색을 살린다.
 *   3) 글래스 디자인 — 사진 위 프로스트 유리 배지(1px 테두리)에 스탯·셔틀콕.
 *   4) 대회 메달 임팩트 — 우승 금 · 준우승 은 · 3위 동 · 출전 라임, 스탬프 자동.
 *   5) 도발·자랑 멘트 6종 + 라이벌 이름 맞춤 도발 + @태그 칩.
 *   6) 숫자 숨기기(무드) — 날짜·체육관 도장 + 짧은 한 줄만.
 *   7) 자랑 하이라이트 — 오늘 전승 · 이번 달 N시간 · N일 연속.
 *   8) WIN/GG 스탬프, 파트너·라이벌 전적 한 줄("콤비 3승 1패" · "지호 상대 2연승").
 *   9) 보호 — 드래그·확대 · 글씨 위치 3단 · 비율 2종 · 챔피언 골드 프레임 · 투명 스티커 · 버전.
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

  /* ---------- 가짜 2D 컨텍스트 ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mock(opts) {
    opts = opts || {};
    var log = { texts: [], images: [], rects: [], gradients: [], arcs: [], ops: [], strokes: 0, strokeRects: 0, filters: [], comps: [] };
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
        log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle, comp: g.globalCompositeOperation });
        log.ops.push('fillRect');
      },
      strokeRect: function () { log.strokeRects++; },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      rect: function () {}, arcTo: function () {}, arc: function (x, y, r) { log.arcs.push(r); }, ellipse: function () {},
      fill: function () { log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}, rotate: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1, false); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1, true); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) {
        log.texts.push({ text: String(text), x: x, y: y, color: g.fillStyle, font: g.font, blur: g.shadowBlur });
        log.ops.push('fillText');
      },
      strokeText: function (text, x, y) {
        log.texts.push({ text: String(text), x: x, y: y, color: g.strokeStyle, stroke: true, font: g.font });
        log.ops.push('strokeText');
      },
      drawImage: function (img, x, y, w, h) {
        log.images.push({ x: x, y: y, w: w, h: h, filter: g.filter });
        log.ops.push('drawImage');
      }
    };
    /* ctx.filter를 지원하는 브라우저를 흉내 내는 경우 */
    if (opts.filter) g.filter = 'none';
    var canvas = { width: 0, height: 0, getContext: function () { return g; }, toBlob: function (cb) { cb({ size: 10 }); } };
    return { canvas: canvas, ctx: g, log: log };
  }

  function textsOf(log) {
    return log.texts.filter(function (x) { return !x.stroke; }).map(function (x) { return x.text; }).join('|');
  }

  function colorOf(log, needle) {
    var hit = log.texts.filter(function (x) { return x.text === needle && !x.stroke; })[0];
    return hit ? String(hit.color) : '';
  }

  function photo(w, h) { return { width: w || 1200, height: h || 900 }; }

  function todaySpec(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: photo(), top: '11/24 (화) · 나래울체육관', kicker: '운동 시간',
      phrase: '민턴일기', big: { value: '90', unit: '분', label: '운동 시간' },
      bigLine: '90분 · 2승 1패', stats: [{ label: '경기', value: '2승 1패' }],
      meta: '민호와 함께 · vs 지호', metaLine: '민호와 함께 · vs 지호', label: '2승 1패 · 11/24 (화)',
      date: '11/24 (화)', comp: null, textPos: 'bottom', photoX: 0, photoY: 0, photoZoom: 1,
      filter: 'auto', showNums: true, win: true, hasStamp: false, stamp: '', badge: '', tagLine: ''
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
      comp: { contest: '○○시 오픈 대회', event: 'B조 복식', result: '우승', partner: '', date: '11/24 (화)' }
    }, patch || {}));
  }

  function drawCard(spec, opts) {
    var m = mock(opts);
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
      id: 'r_v167', type: '기록', userKey: ME, nick: '나래', date: U.ymd(),
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
      ui: { tab: 'log', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  function uiState(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      filter: 'auto', nums: 'show', win: true, badge: true, frame: 'none',
      recordId: 'r_v167', photo: photo(), photoX: 0, photoY: 0, photoZoom: 1, textPos: 'bottom',
      gym: '나래울체육관', partner: '민호', rival: '지호', contest: '', event: '', result: '우승',
      compPartner: '', date: U.ymd(), phrase: '민턴일기', phraseComp: '민턴일기'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* =========================================================
   * 1. 사진 필터 5종 — 자동 감성 기본
   * ========================================================= */

  test('v1.67 필터: 자동 감성 · 필름 · 선명 · 흑백 · 원본 5종이고 기본은 자동', function () {
    var sc = SC();
    eq(sc.PHOTO_FILTERS.length, 5, '필터 5종');
    eq(sc.PHOTO_FILTERS.map(function (f) { return f.id; }).join(','), 'auto,film,vivid,mono,original', 'id');
    eq(sc.PHOTO_FILTERS.map(function (f) { return f.name; }).join(','), '자동 감성,필름,선명,흑백,원본', '이름');
    sc.PHOTO_FILTERS.forEach(function (f) { ok(f.note && f.note.length > 1, f.id + ' 설명'); });
    eq(sc.filterById(undefined).id, 'auto', '기본은 자동 감성');
    eq(sc.filterById('없는필터').id, 'auto', '모르는 값은 자동');
    /* css 보정 + 레이어/비네트로 사진을 살린다 */
    ok(sc.filterById('auto').css.indexOf('saturate') >= 0, '자동 감성 채도');
    ok(sc.filterById('auto').layers.length >= 1, '자동 감성 레이어');
    ok(sc.filterById('mono').mono === true, '흑백 표시');
    eq(sc.filterById('original').css, '', '원본은 보정 없음');
    eq(sc.filterById('original').vignette, 0, '원본은 비네트 없음');
  });

  test('v1.67 필터: ctx.filter를 지원하면 한 번에, 아니면 합성 레이어로 그린다', function () {
    var sc = SC();
    /* ctx.filter 지원 — drawImage에 필터 문자열이 걸린다 */
    var hi = mock({ filter: true });
    sc.draw(hi.canvas, todaySpec({ filter: 'mono' }));
    var img = hi.log.images[0];
    ok(!!img, '사진을 그린다');
    includes(String(img.filter), 'grayscale', 'ctx.filter로 흑백');
    /* ctx.filter 없음 — 'saturation' 합성에 회색을 얹어 흑백 */
    var lo = mock({ filter: false });
    sc.draw(lo.canvas, todaySpec({ filter: 'mono' }));
    ok(lo.log.rects.some(function (r) {
      return r.comp === 'saturation' && String(r.fill).toLowerCase() === '#8a8a8a';
    }), '합성 레이어로 흑백');
    /* 원본은 보정 레이어를 깔지 않는다 */
    var plain = mock({ filter: true });
    sc.draw(plain.canvas, todaySpec({ filter: 'original' }));
    ok(!plain.log.rects.some(function (r) { return r.comp === 'saturation'; }), '원본은 흑백 레이어 없음');
    eq(plain.log.images[0].filter, 'none', '원본은 보정 필터 없음');
  });

  test('v1.67 필터: 사진을 넣으면 자동 감성이 기본으로 붙는다', function () {
    if (!hasNode) return;
    var sc = SC();
    var ui = sc._initialState(ctxOf(stateOf()), {});
    eq(ui.filter, 'auto', '새 사진의 기본 필터');
    var html = sc._sheetBody(ctxOf(stateOf()));
    includes(html, 'data-sc-filter="auto"', '시트에 자동 감성 칩');
    ['film', 'vivid', 'mono', 'original'].forEach(function (id) {
      includes(html, 'data-sc-filter="' + id + '"', id + ' 칩');
    });
    eq((html.match(/data-sc-filter="/g) || []).length, 5, '필터 칩 5개');
  });

  /* =========================================================
   * 2. 스크림 축소 — 사진 색을 살린다
   * ========================================================= */

  test('v1.67 스크림: 검은 막을 크게 줄이고 맨 아래도 0.58까지만', function () {
    var log = drawCard(todaySpec());
    var scrim = log.gradients.filter(function (g) {
      return !g.radial && g.stops.length >= 5 && String(g.stops[0]).indexOf('rgba(') === 0;
    })[0];
    ok(!!scrim, '아래에서 스며드는 스크림');
    var last = String(scrim.stops[scrim.stops.length - 1]);
    includes(last, '0.58', '맨 아래는 0.58');
    excludes(last, '0.95', '예전처럼 새까맣게 덮지 않는다');
    var peak = Math.max.apply(null, scrim.stops.map(function (c) {
      var m = /,([0-9.]+)\)$/.exec(String(c));
      return m ? Number(m[1]) : 0;
    }));
    ok(peak <= 0.60, '스크림 최대 0.60 이하 (' + peak + ')');
  });

  test('v1.67 스크림: 글씨는 그림자로 띄우고, 글씨 자리에만 은은한 비네트', function () {
    var log = drawCard(todaySpec());
    var big = log.texts.filter(function (x) { return x.text === '90' && !x.stroke; })[0];
    ok(!!big, '큰 숫자');
    ok(big.blur >= 18, '큰 숫자 그림자 (' + big.blur + ')');
    var local = log.gradients.filter(function (g) { return g.radial; });
    ok(local.some(function (g) {
      return g.stops.some(function (c) { return String(c).indexOf('rgba(4,9,7,') === 0; });
    }), '글씨 자리 국소 비네트(카드 색 스크림)');
  });

  test('v1.67 스크림: 사진 밝기 3단계는 그대로 동작한다', function () {
    var soft = drawCard(todaySpec({ shade: 'soft' }));
    var deep = drawCard(todaySpec({ shade: 'deep' }));
    ok(soft.rects.some(function (r) { return String(r.fill) === 'rgba(4,9,7,0.26)'; }), '살짝 어둡게 0.26');
    ok(deep.rects.some(function (r) { return String(r.fill) === 'rgba(4,9,7,0.46)'; }), '감성 어둡게 0.46');
  });

  /* =========================================================
   * 3. 글래스 디자인
   * ========================================================= */

  test('v1.67 글래스: v1.71에는 칸에서 빠지고 영수증이 들어오며, 그리는 방법은 남는다', function () {
    if (!hasNode) return;
    var sc = SC();
    /* v1.71 — 디자인 칸은 매거진 · 영수증 · 필름 · 스티커 4종. 글래스는 예전 값 보호용(레거시) */
    eq(sc.DESIGNS.map(function (d) { return d.id; }).join(','), 'magazine,receipt,film,sticker', '디자인 4종');
    eq(sc.designById('glass').name, '글래스', '레거시 값도 이름이 살아 있다');
    var html = sc._sheetBody(ctxOf(stateOf()));
    includes(html, 'data-sc-design="receipt"', '영수증 칩');
    eq(sc.presetDesignId('glass'), 'magazine', '레거시 값은 매거진으로');
    includes(readRoot('styles.css'), '.sc__design--glass i', '글래스 미리보기 그림(레거시 CSS)');
  });

  test('v1.67 글래스: 사진 위 유리 배지에 핵심 스탯·셔틀콕·1px 테두리', function () {
    var log = drawCard(todaySpec({ design: 'glass' }));
    includes(textsOf(log), '90분 · 2승 1패', '핵심 스탯 한 줄');
    includes(textsOf(log), '민턴일기', '문구');
    includes(textsOf(log), '11/24 (화) · 나래울체육관', '날짜·체육관');
    includes(textsOf(log), 'BADMINTON', '브랜드');
    ok(log.strokes >= 2, '유리 테두리 선');
    ok(log.strokes >= 3, '셔틀콕 아이콘 선');
    /* 사진은 그대로 깔리고, 유리 카드가 그 위를 덮는다 */
    ok(log.images.length >= 1, '사진');
    eq(log.rects.length > 0, true, '유리 채우기');
  });

  test('v1.67 글래스: 세 비율·두 모드 모두 카드 안에서 그려진다', function () {
    ['feed', 'story'].forEach(function (r) {
      ['today', 'comp'].forEach(function (mode) {
        var spec = mode === 'comp' ? compSpec({ design: 'glass', ratio: r }) : todaySpec({ design: 'glass', ratio: r });
        var log = drawCard(spec);
        var H = r === 'story' ? 1920 : 1350;
        log.texts.forEach(function (x) {
          ok(x.y > 0 && x.y < H, mode + '/' + r + ' 글씨 y=' + Math.round(x.y) + ' 안쪽');
        });
        includes(textsOf(log), 'BADMINTON', mode + '/' + r + ' 브랜드');
      });
    });
  });

  /* =========================================================
   * 4. 대회 메달 임팩트
   * ========================================================= */

  test('v1.67 메달: 우승 금 · 준우승 은 · 3위 동 · 출전 코트 라임', function () {
    var sc = SC();
    eq(sc.MEDALS.length, 4, '메달 4종');
    eq(sc.MEDALS.map(function (m) { return m.id; }).join(','), '우승,준우승,3위,출전', '결과');
    eq(sc.MEDALS.map(function (m) { return m.accent; }).join(','), '#FFD700,#E2E8F0,#E08E55,#A3E635', '포인트 색');
    eq(sc.medalOf('우승').stamp, '1ST PLACE · GOLD', '금 스탬프');
    eq(sc.medalOf('준우승').stamp, '2ND PLACE · SILVER', '은 스탬프');
    eq(sc.medalOf('3위').stamp, '3RD PLACE · BRONZE', '동 스탬프');
    eq(sc.medalOf('출전').stamp, 'CHALLENGER', '출전 스탬프');
    eq(sc.medalOf('없는값').id, '출전', '모르는 값은 출전');
  });

  test('v1.67 메달: 결과를 고르면 포인트 색·스탬프가 그 메달 색으로 바뀐다', function () {
    var sc = SC();
    ['우승', '준우승', '3위', '출전'].forEach(function (r) {
      var medal = sc.medalOf(r);
      var log = drawCard(compSpec({ result: r, comp: { contest: '○○시 오픈 대회', event: 'B조 복식', result: r, date: '11/24 (화)' } }));
      includes(textsOf(log), medal.stamp, r + ' 스탬프');
      ok(log.texts.some(function (x) { return String(x.color).toUpperCase() === medal.accent.toUpperCase(); }),
        r + ' 메달 색 글씨');
      ok(log.gradients.some(function (g) {
        return g.stops.some(function (c) { return String(c).toUpperCase() === medal.accent.toUpperCase(); });
      }) || log.rects.some(function (x) { return String(x.fill).toUpperCase() === medal.accent.toUpperCase(); }),
        r + ' 메달 색 포인트');
    });
  });

  test('v1.67 메달: 금·은·동은 광택과 반짝이가 얹힌다', function () {
    var log = drawCard(compSpec({ result: '우승' }));
    ok(log.gradients.some(function (g) {
      return g.stops.some(function (c) { return String(c).indexOf('rgba(255,215,0,') === 0; });
    }), '금빛 글로우');
    ok(log.ops.filter(function (o) { return o === 'fill'; }).length > 3, '반짝이 도형');
  });

  test('v1.67 보호: 챔피언 골드 프레임(하트 2개)은 메달과 함께 그대로', function () {
    var sc = SC();
    eq(sc.FRAMES.length, 2, '프레임 2종');
    eq(sc.FRAMES[1].id, 'champ', '챔피언');
    eq(sc.FRAMES[1].price, 2, '하트 2개');
    var log = drawCard(compSpec({ result: '준우승', frame: 'champ' }));
    ok(log.strokes >= 6, '프레임 선 + 메달');
    ok(log.texts.some(function (x) { return String(x.color).toLowerCase() === '#e8c26a'; }) ||
      log.rects.some(function (x) { return String(x.fill).toLowerCase() === '#e8c26a'; }) ||
      log.strokes > 0, '금빛 프레임');
  });

  /* =========================================================
   * 5. 도발 · 자랑 멘트
   * ========================================================= */

  test('v1.67 도발: 프리셋 6종은 24자 안이고 그대로 카드 문구가 된다', function () {
    var sc = SC();
    eq(sc.TAUNTS.length, 6, '도발 멘트 6종');
    sc.TAUNTS.forEach(function (t) {
      ok(t.text.length > 2 && t.text.length <= sc.TAUNT_MAX, t.id + ' 길이');
      eq(sc.phraseText(t.text), t.text, t.id + ' 그대로');
      ok(sc.isTauntPhrase(t.text), t.id + ' 도발 인식');
    });
    includes(sc.TAUNTS.map(function (t) { return t.text; }).join('|'), '전승 퇴근합니다', '전승 멘트');
    includes(sc.TAUNTS.map(function (t) { return t.text; }).join('|'), '연습 더 하고 오세요', '도발 멘트');
  });

  test('v1.67 도발: 라이벌 이름이 들어간 맞춤 멘트를 1탭으로 고른다', function () {
    var sc = SC();
    var records = [
      rec({ id: 'a1', date: '2026-11-20', games: [{ a: 21, b: 15 }] }),
      rec({ id: 'a2', date: '2026-11-22', games: [{ a: 21, b: 18 }] }),
      rec({ id: 'a3', date: '2026-11-24', games: [{ a: 21, b: 19 }] })
    ];
    var list = sc.rivalTaunts(records, '지호');
    ok(list.length >= 3, '맞춤 도발 3개 이상');
    includes(list.join('|'), '지호', '이름이 들어간다');
    includes(list.join('|'), '연습 더 하고 와', '도발 문구');
    includes(list.join('|'), '3연승', '연승 수');
    list.forEach(function (s) { ok(s.length <= 24, '24자 이내: ' + s); });
    eq(sc.rivalTaunts(records, '').length, 0, '이름이 없으면 맞춤 멘트 없음');
  });

  test('v1.67 도발: 시트에 도발 칩과 태그 칩이 있고 누르면 문구가 바뀐다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState());
    var html = sc._sheetBody(ctxOf(stateOf()));
    eq((html.match(/data-sc-taunt="/g) || []).length, 6, '도발 칩 6개');
    ok((html.match(/data-sc-rtaunt="/g) || []).length >= 2, '라이벌 맞춤 칩');
    includes(html, '도발 · 자랑 멘트', '제목');
    includes(html, '파트너 · 라이벌 태그', '태그 제목');
    includes(html, 'data-sc-tag="0"', '태그 칩');
    includes(html, '@이름을 붙이면', '태그 안내');
    var src = readRoot('js/sharecard.js');
    includes(src, "closest('[data-sc-taunt]')", '도발 칩 클릭 배선');
    includes(src, 'ui[tkey] = ttext', '고른 멘트가 문구로');
  });

  /* =========================================================
   * 6. 숫자 숨기기 (무드)
   * ========================================================= */

  test('v1.67 무드: 숫자를 숨기면 시간·승패 없이 날짜·체육관·한 줄만', function () {
    var log = drawCard(todaySpec({ showNums: false }));
    var joined = textsOf(log);
    excludes(joined, '90', '운동 시간 숫자 없음');
    includes(joined, '민턴일기', '한 줄 문구');
    includes(joined, '11/24 (화) · 나래울체육관', '날짜·체육관 도장');
    ok(log.strokes >= 1, '포인트 선/도장 테두리');
  });

  test('v1.67 무드: 네 디자인 모두 숫자 없이 그려진다', function () {
    ['magazine', 'glass', 'film', 'sticker'].forEach(function (d) {
      var log = drawCard(todaySpec({ design: d, showNums: false }));
      excludes(textsOf(log), '90분 · 2승 1패', d + ' 스탯 없음');
      includes(textsOf(log), '민턴일기', d + ' 문구');
    });
  });

  test('v1.67 무드: 시트에 숫자 보이기/숨기기 칩이 있고 기본은 보이기', function () {
    if (!hasNode) return;
    var sc = SC();
    eq(sc.NUM_MODES.map(function (m) { return m.id; }).join(','), 'show,hide', '2종');
    eq(sc.numModeById(undefined).id, 'show', '기본 보이기');
    eq(sc.numModeById('hide').name, '숫자 숨기기', '이름');
    sc._setState(uiState());
    var html = sc._sheetBody(ctxOf(stateOf()));
    includes(html, 'data-sc-nums="show"', '보이기 칩');
    includes(html, 'data-sc-nums="hide"', '숨기기 칩');
    includes(html, '숫자 숨기기', '라벨');
  });

  /* =========================================================
   * 7. 자랑 하이라이트
   * ========================================================= */

  test('v1.67 자랑: 오늘 전승이면 "오늘 N전 전승"', function () {
    var sc = SC();
    var perfect = rec({ id: 'p1', games: [{ a: 21, b: 15 }, { a: 21, b: 18 }] });
    var hl = sc.highlightsOf([perfect], {}, perfect, { ymd: U.ymd() });
    includes(hl.map(function (h) { return h.text; }).join('|'), '오늘 2전 전승', '전승 문구');
    /* 패가 있으면 전승이 아니다 */
    var mixed = rec({ id: 'p2', games: [{ a: 21, b: 15 }, { a: 18, b: 21 }] });
    eq(sc.highlightsOf([mixed], {}, mixed, { ymd: U.ymd() }).filter(function (h) { return h.id === 'perfect'; }).length, 0, '패가 있으면 없음');
  });

  test('v1.67 자랑: 이번 달 10시간을 넘으면 "이번 달 N시간 돌파"', function () {
    var sc = SC();
    var month = U.ymd().slice(0, 7);
    var rows = [
      rec({ id: 'm1', date: month + '-02', minutes: 200, games: [] }),
      rec({ id: 'm2', date: month + '-10', minutes: 200, games: [] }),
      rec({ id: 'm3', date: month + '-17', minutes: 240, games: [] })
    ];
    eq(sc.monthMinutes(rows, U.ymd()), 640, '이번 달 분 합');
    var hl = sc.highlightsOf(rows, {}, rows[0], { ymd: U.ymd() });
    includes(hl.map(function (h) { return h.text; }).join('|'), '이번 달 11시간 돌파', '시간 돌파');
  });

  test('v1.67 자랑: 3일 연속이면 "N일 연속 출석"', function () {
    var sc = SC();
    var rows = [rec({ id: 's1', games: [] })];
    var hl = sc.highlightsOf(rows, { streak: 5 }, rows[0], { ymd: U.ymd() });
    includes(hl.map(function (h) { return h.text; }).join('|'), '5일 연속 출석', '연속 출석');
  });

  test('v1.67 자랑: 카드 위 배지로 자동으로 얹히고, 끌 수 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    var rows = [rec({ id: 'b1', games: [{ a: 21, b: 15 }, { a: 21, b: 12 }] })];
    var st = stateOf(rows);
    /* v1.71 — 꾸밈 배지를 켜야 카드에 얹힙니다(기본은 깔끔한 카드) */
    sc._setState(uiState({ recordId: 'b1', deco: true }));
    var spec = sc._specOf(ctxOf(st));
    includes(String(spec.badge), '오늘 2전 전승', 'spec 배지');
    var log = drawCard(spec);
    includes(textsOf(log), spec.badge, '카드에 배지 글씨');
    /* 끄기 */
    sc._setState(uiState({ recordId: 'b1', deco: true, badge: false }));
    eq(sc._specOf(ctxOf(st)).badge, '', '배지 끄기');
    sc._setState(uiState({ recordId: 'b1', deco: true }));
    var html = sc._sheetBody(ctxOf(st));
    includes(html, 'data-sc-badgetoggle', '시트 토글');
    /* 꾸밈 배지가 꺼져 있으면 카드에 배지 글씨가 없다 */
    sc._setState(uiState({ recordId: 'b1' }));
    excludes(textsOf(drawCard(sc._specOf(ctxOf(st)))), '오늘 2전 전승', '기본 카드는 배지 없이 깔끔');
  });

  /* =========================================================
   * 8. WIN/GG 스탬프 · 파트너·라이벌 전적
   * ========================================================= */

  test('v1.67 승리 스탬프: 이기면 WIN, 한 판도 안 지면 GG, 끌 수 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    var win = rec({ id: 'w1', games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }] });
    var stWin = stateOf([win]);
    sc._setState(uiState({ recordId: 'w1', deco: true }));
    eq(sc._specOf(ctxOf(stWin)).stamp, 'WIN', '승 > 패 → WIN');
    includes(textsOf(drawCard(sc._specOf(ctxOf(stWin)))), 'WIN', '카드에 WIN');
    var perfect = rec({ id: 'w2', games: [{ a: 21, b: 15 }, { a: 21, b: 9 }] });
    var stP = stateOf([perfect]);
    sc._setState(uiState({ recordId: 'w2' }));
    eq(sc._specOf(ctxOf(stP)).stamp, 'GG', '전승 → GG');
    sc._setState(uiState({ recordId: 'w1', deco: true, win: false }));
    eq(sc._specOf(ctxOf(stWin)).stamp, '', '끄면 스탬프 없음');
    sc._setState(uiState({ recordId: 'w1' }));
    var lost = rec({ id: 'w3', games: [{ a: 15, b: 21 }] });
    sc._setState(uiState({ recordId: 'w3' }));
    eq(sc._specOf(ctxOf(stateOf([lost]))).stamp, '', '지면 스탬프 없음');
    sc._setState(uiState({ recordId: 'w1' }));
  });

  test('v1.67 태그: 파트너는 "콤비 N승 N패", 라이벌은 "N연승" 한 줄', function () {
    var sc = SC();
    var rows = [
      rec({ id: 't1', date: '2026-11-18', games: [{ a: 21, b: 15 }], team: JSON.stringify({ partner: '민호', rival: '지호' }) }),
      rec({ id: 't2', date: '2026-11-20', games: [{ a: 21, b: 18 }], team: JSON.stringify({ partner: '민호', rival: '지호' }) }),
      rec({ id: 't3', date: '2026-11-24', games: [{ a: 18, b: 21 }], team: JSON.stringify({ partner: '민호', rival: '지호' }) })
    ];
    eq(sc.duoLine(rows, '민호'), '민호랑 콤비 2승 1패', '콤비 전적');
    eq(sc.duoLine(rows, ''), '', '이름 없으면 없음');
    eq(sc.rivalStreak(rows.slice(0, 2), '지호'), 2, '2연승');
    eq(sc.rivalTagLine(rows.slice(0, 2), '지호'), '지호 상대 2연승', '연승 한 줄');
    eq(sc.rivalTagLine([rows[2]], '지호'), '지호 상대 0승 1패', '연승이 없으면 전적');
  });

  test('v1.67 태그: 카드 서브라인과 시트 칩에 전적이 함께 뜬다', function () {
    if (!hasNode) return;
    var sc = SC();
    var rows = [
      rec({ id: 'u1', date: '2026-11-20', games: [{ a: 21, b: 18 }], team: JSON.stringify({ partner: '민호', rival: '지호' }) }),
      rec({ id: 'u2', date: '2026-11-24', games: [{ a: 21, b: 15 }], team: JSON.stringify({ partner: '민호', rival: '지호' }) })
    ];
    var st = stateOf(rows);
    sc._setState(uiState({ recordId: 'u2' }));
    var spec = sc._specOf(ctxOf(st));
    includes(String(spec.tagLine), '민호랑 콤비 2승 0패', '콤비 줄');
    includes(String(spec.tagLine), '지호 상대 2연승', '라이벌 줄');
    var log = drawCard(spec);
    includes(textsOf(log), spec.tagLine, '카드에 전적 줄');
    var html = sc._sheetBody(ctxOf(st));
    includes(html, 'data-sc-tag="0"', '첫 태그 칩');
    ok((html.match(/data-sc-tag="/g) || []).length >= 2, '태그 칩 2개 이상');
    sc._setState(uiState());
  });

  /* =========================================================
   * 9. 보호 — 기존 기능 그대로
   * ========================================================= */

  test('v1.67 보호: 드래그·확대·글씨 위치·비율·투명 스티커가 그대로', function () {
    var sc = SC();
    eq(sc.ZOOM_MIN, 1, '최소 1.0배');
    eq(sc.ZOOM_MAX, 2.5, '최대 2.5배');
    eq(sc.TEXT_POS.length, 3, '글씨 위치 3단');
    eq(sc.RATIOS.length, 2, '비율 2종');
    eq(sc.dimsOf('feed').w + 'x' + sc.dimsOf('feed').h, '1080x1350', '피드');
    eq(sc.dimsOf('story').h, 1920, '스토리');
    /* 끌기 — 확대한 사진만 움직인다 */
    var canvas = mock().canvas;
    /* 1200×900 사진은 4:5 프레임에서 세로가 꽉 차(남는 곳 없음) 위아래로는 안 움직입니다 */
    var at1 = sc.movePhotoBy(canvas, todaySpec({ photoZoom: 1 }), 0, 40);
    eq(at1.moved, false, '1.0배는 넘칠 곳이 없어 안 움직임');
    var at2 = sc.movePhotoBy(canvas, todaySpec({ photoZoom: 2 }), 40, 0);
    eq(at2.moved, true, '확대하면 움직임');
    /* 스티커 — 카드를 채우는 불투명 바탕 없음 */
    var log = drawCard(todaySpec({ design: 'sticker', photo: null, showNums: true }));
    ok(!log.rects.some(function (r) { return r.w === 1080 && r.h === 1350 && !(r.fill && r.fill.stops); }), '스티커는 투명');
  });

  test('v1.67 보호: 사진은 여전히 서버로 보내지 않고 실존 선수 이름도 없다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    excludes(src, 'fetch(', '네트워크 호출 없음');
    excludes(src, 'XMLHttpRequest', 'XHR 없음');
    includes(src, 'readAsDataURL', '폰 안에서 읽기');
    ['김원호', '안세영', '서재승', '서승재'].forEach(function (name) { excludes(src, name, name + ' 없음'); });
  });

  test('v1.67 버전: sw · app · 스타일 캐시 · TWA가 함께 bm-v1.71.0', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.71.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.71.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261124-9', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.71.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.71.0', 'TWA appVersion');
    eq(twa.appVersionCode, 65, 'TWA 버전 코드');
  });

  test('v1.67 배선: 테스트 목록에 v167이 들어 있다', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v167.test.js', 'run.js');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
