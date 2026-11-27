/* ============================================================
 * test/v163.test.js — bm-v1.73.0
 *   📸 인스타 공유 시트 단순화 · 사진 버튼 상단 + 기본 감성 배경 4종
 *
 *  사용자 피드백: "어 잘안보여 그리고 어떡게 하는건지 복잡해"
 *                "디자인도 좀더 다듬어봐줘"
 *                "예쁜 이미지도 추가할수있게. 어때?" → "ㄱㄱ"
 *
 *   1) 시트 순서 — 탭 → 한 줄 안내 → 미리보기 → 📷 사진 넣기(+사진 빼기)
 *      → 대회 정보(대회 탭) → 디자인 · 비율 · 사진 밝기 → 접기 → 저장(맨 아래 고정)
 *   2) 문구 · 색 · 내용 바꾸기 — <details> 로 접혀 있고 기본은 닫힘
 *   3) 기본 감성 배경 4종 — 코트 야경 · 셔틀콕 라이트 · 노을 코트 · 민턴 그라데이션
 *      썸네일 칩 · spec.bg · 스티커(투명)에서는 깔지 않음
 *   4) 그리기 — 배경 아트가 카드에 실제로 그려진다(사진 없이), 스티커는 투명 유지
 *   5) 보호 — 일지 없음/사진 없음에도 저장 가능 · 실명 없음 · 서버 전송 없음 · 버전
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
      id: 'r_v163', type: '기록', userKey: ME, nick: '나래', date: '2026-11-24',
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
      recordId: 'r_v163', photo: null,
      gym: '나래울체육관', partner: '민호', rival: '지호', contest: '', event: '', result: '우승',
      compPartner: '', date: '2026-11-24'
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
    var log = { texts: [], rects: [], stops: [], gradients: [], ops: [], strokes: 0, fillTexts: 0 };
    function gradient(x0, y0, x1, y1) {
      var g = { x0: x0, y0: y0, x1: x1, y1: y1, stops: [], addColorStop: function (o, c) { g.stops.push(c); log.stops.push(c); } };
      log.gradients.push(g);
      return g;
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1, lineCap: '', lineJoin: '',
      letterSpacing: '0px',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) { log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle }); log.ops.push('fillRect'); },
      strokeRect: function () { log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      rect: function () {},
      arcTo: function () {}, arc: function () {}, ellipse: function () {},
      fill: function () { log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text) { log.texts.push(String(text)); log.fillTexts++; log.ops.push('fillText'); },
      drawImage: function () { log.ops.push('drawImage'); }
    };
    var canvas = { width: 0, height: 0, getContext: function () { return g; }, toBlob: function (cb) { cb({ size: 10 }); } };
    return { canvas: canvas, ctx: g, log: log };
  }

  function cardSpec(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', bg: '', photo: null,
      top: '11/24 (화) · 나래울체육관', kicker: '운동 시간',
      big: { value: '90', unit: '분', label: '운동 시간' },
      bigLine: '90분 · 2승 1패',
      stats: [{ label: '경기', value: '2승 1패' }, { label: '연속 기록', value: '5일' }],
      meta: '민호와 함께 · vs 지호', metaLine: '나래울체육관', phrase: '민턴일기', label: '2승 1패 · 11/24 (화)',
      date: '11/24 (화)', comp: null
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* =========================================================
   * 1. 기본 감성 배경 4종 — 모델
   * ========================================================= */

  test('v1.63 배경 모델: 기본 감성 배경 4종이 있다', function () {
    var sc = SC();
    eq(sc.BGS.length, 4, '4종');
    eq(sc.BGS.map(function (b) { return b.id; }).join(','), 'nightcourt,sunsetshuttle,darkstudio,mintmesh', 'id');
    eq(sc.BGS.map(function (b) { return b.name; }).join(','), '야경 코트,노을 체육관,다크 스튜디오,민턴 그라데이션', '이름');
    sc.BGS.forEach(function (b) { ok(b.note && b.note.length > 2, b.id + ' 설명'); });
    eq(sc.bgById('nightcourt').name, '야경 코트', 'id로 찾기');
    eq(sc.bgById('nope').id, '', '모르는 id는 없음');
    eq(sc.bgById('').id, '', '빈 값은 없음');
  });

  test('v1.63 배경: 스티커(투명)에는 절대 깔지 않고, 고른 색·비율은 그대로', function () {
    var sc = SC();
    ok(sc.bgOf({ design: 'magazine', bg: 'nightcourt' }), '매거진 + 배경');
    ok(sc.bgOf({ design: 'film', bg: 'mintmesh' }), '필름 + 배경');
    eq(sc.bgOf({ design: 'sticker', bg: 'nightcourt' }), null, '스티커는 투명 우선');
    eq(sc.bgOf({ design: 'magazine', bg: '' }), null, '고르지 않으면 색 메쉬');
    eq(sc.bgOf(null), null, 'spec 없음');
  });

  /* =========================================================
   * 2. 시트 순서 — 3초 완성 흐름
   * ========================================================= */

  test('v1.63 시트: 탭 → 안내 → 미리보기 → 사진 넣기 순서로 위에 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));

    var tabs = html.indexOf('sc__modes');
    var guide = html.indexOf('sc__guide');
    var preview = html.indexOf('class="sc__preview');
    var summary = html.indexOf('data-sc-summary');
    var photo = html.indexOf('class="field sc__photo"');
    var design = html.indexOf('data-sc-design="magazine"');
    var ratio = html.indexOf('data-sc-ratio="feed"');
    var shade = html.indexOf('sc__shadebox');
    var more = html.indexOf('<details class="sc__more">');
    var save = html.indexOf('data-sc-save');

    ok(tabs >= 0 && guide > tabs, '안내는 탭 바로 아래');
    ok(preview > guide, '미리보기는 안내 아래');
    ok(summary > preview && summary < photo, '요약은 미리보기 바로 아래');
    ok(photo > preview, '사진 버튼은 미리보기 아래');
    ok(design > photo, '디자인은 사진 버튼 아래');
    ok(ratio > design, '비율은 디자인 아래');
    ok(shade > ratio, '사진 밝기는 비율 아래');
    ok(more > shade, '접기는 그 아래');
    ok(save > more, '저장은 맨 마지막');
  });

  test('v1.63 시트: 한 줄 안내가 "사진 고르고 → 저장 누르면 끝!"이다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    includes(html, '사진 고르고', '사진 고르고');
    includes(html, '저장 누르면 끝!', '저장 누르면 끝');
    includes(html, 'sc__guide', '안내 줄');
  });

  test('v1.63 시트: 📷 사진 넣기 버튼이 갤러리·카메라를 함께 열고, 사진이 있으면 빼기도 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var empty = sc._sheetBody(ctxOf(stateOf([rec()])));
    includes(empty, 'type="file" accept="image/*"', '갤러리·카메라');
    includes(empty, '사진 넣기', '사진 넣기 이름');
    includes(empty, '갤러리 · 카메라', '보조 줄');
    includes(empty, 'data-sc-photo', '파일 칸');
    includes(empty, '사진 빼기', '사진 빼기 버튼');
    includes(empty, 'data-sc-photoclear hidden', '사진이 없으면 빼기는 숨김');
    includes(empty, '폰 안에서만', '사진은 서버로 보내지 않음');

    sc._setState(uiState({ photo: { width: 10, height: 10 } }));
    var full = sc._sheetBody(ctxOf(stateOf([rec()])));
    includes(full, '사진 바꾸기', '사진이 있으면 바꾸기');
    excludes(full, 'data-sc-photoclear hidden', '빼기 버튼이 보임');
  });

  test('v1.63 시트: 문구·색·내용은 접기 안, 대회 핵심 입력은 접지 않는다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var today = sc._sheetBody(ctxOf(stateOf([rec(), rec({ id: 'r_old', date: '2026-11-23' })])));
    var more = today.indexOf('<details class="sc__more">');
    var moreEnd = today.indexOf('</details>', more);

    ok(more > 0 && moreEnd > more, '접기 블록');
    excludes(today, '<details class="sc__more" open', '기본은 닫힘');
    includes(today, '문구 · 색 · 내용 바꾸기', '접기 제목');

    /* 문구 · 색 · 오늘 세부 입력은 접기 안 */
    ['sc__phrase', 'data-sc-pal="night"', 'data-sc-field="gym"', 'data-sc-field="partner"',
      'data-sc-field="rival"', '어느 일지로 만들까요'].forEach(function (k) {
      var i = today.indexOf(k);
      ok(i > more && i < moreEnd, k + ' 는 접기 안');
    });

    /* 대회 인증 — 대회명·종목·성적·파트너는 접기 밖에서 바로 입력 */
    sc._setState(uiState({ mode: 'comp', contest: '○○시 오픈 대회', event: 'B조 복식', result: '준우승' }));
    var comp = sc._sheetBody(ctxOf(stateOf([rec()])));
    var cMore = comp.indexOf('<details class="sc__more">');
    ok(cMore > 0, '대회에도 접기는 있다');
    ['data-sc-field="contest"', 'data-sc-field="event"', 'data-sc-result="우승"',
      'data-sc-field="compPartner"'].forEach(function (k) {
      var i = comp.indexOf(k);
      ok(i >= 0 && i < cMore, k + ' 는 접기 밖(바로 입력)');
    });
    var cPhrase = comp.indexOf('sc__phrase');
    ok(cPhrase > cMore, '대회 문구는 접기 안');
  });

  test('v1.63 시트: 바깥에는 디자인·비율·사진 밝기만 남는다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ photo: null }));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    var more = html.indexOf('<details class="sc__more">');
    eq((html.match(/data-sc-design="/g) || []).length, 4, '디자인 4 (v1.67 글래스)');
    eq((html.match(/data-sc-ratio="/g) || []).length, 2, '비율 2');
    eq((html.match(/data-sc-shade="/g) || []).length, 3, '밝기 3칸은 있지만');
    var shadeIdx = html.indexOf('sc__shadebox');
    ok(shadeIdx < more, '밝기 칸은 접기 밖');
    includes(html, 'class="field sc__shadebox" hidden', '사진이 없으면 밝기 칸은 숨김');

    sc._setState(uiState({ photo: { width: 10, height: 10 } }));
    excludes(sc._sheetBody(ctxOf(stateOf([rec()]))), 'class="field sc__shadebox" hidden', '사진이 있으면 밝기 칸');
  });

  test('v1.63 시트: 기본 배경 4종 칩과 썸네일 캔버스가 사진 버튼 바로 아래에 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({}));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    eq((html.match(/data-sc-bg="/g) || []).length, 4, '배경 칩 4');
    ['nightcourt', 'sunsetshuttle', 'darkstudio', 'mintmesh'].forEach(function (id) {
      includes(html, 'data-sc-bg="' + id + '"', '칩 ' + id);
      includes(html, 'data-sc-bgthumb="' + id + '"', '썸네일 ' + id);
    });
    includes(html, '기본 배경', '칩 묶음 이름');
    var photo = html.indexOf('class="field sc__photo"');
    var bgs = html.indexOf('data-sc-bg="');
    var design = html.indexOf('data-sc-design="magazine"');
    ok(bgs > photo && bgs < design, '사진 버튼과 디자인 사이');

    sc._setState(uiState({ bg: 'sunsetshuttle' }));
    includes(sc._sheetBody(ctxOf(stateOf([rec()]))), 'sc__bg is-on" data-sc-bg="sunsetshuttle"', '고른 배경 표시');
  });

  test('v1.63 시트: 스티커를 고르면 사진·배경 칸을 숨기고 투명 PNG로 저장한다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ design: 'sticker' }));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    includes(html, 'class="field sc__photo" hidden', '사진·배경 칸 숨김');
    includes(html, '투명 PNG 저장', '투명 PNG');
  });

  test('v1.63 시트: 일지가 없으면 저장이 꺼지고 안내가 뜬다(사진·배경은 그대로 고를 수 있다)', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ recordId: '' }));
    var html = sc._sheetBody(ctxOf(stateOf([])));
    includes(html, 'data-sc-save disabled', '저장 꺼짐');
    includes(html, '일지를 먼저 저장해 주세요', '안내');
    includes(html, '일지가 아직 없어요', '빈 상태 설명');
    includes(html, '사진 넣기', '사진 버튼은 그대로');
    eq((html.match(/data-sc-bg="/g) || []).length, 4, '배경도 그대로');
  });

  /* =========================================================
   * 3. 그리기 — 배경 아트가 카드에 그려진다
   * ========================================================= */

  test('v1.63 그리기: 배경 4종이 각각 다른 그림을 그린다', function () {
    var sc = SC();
    var sigs = {};
    sc.BGS.forEach(function (b) {
      var m = mockCanvas();
      sc.paintBg(m.ctx, b.id, { x: 0, y: 0, w: 1080, h: 1350 });
      ok(m.log.ops.length > 3, b.id + ' 그리기 호출');
      ok(m.log.stops.length > 0, b.id + ' 그라데이션');
      sigs[b.id] = m.log.stops.join('|');
    });
    var keys = Object.keys(sigs);
    for (var i = 1; i < keys.length; i++) {
      ok(sigs[keys[i]] !== sigs[keys[0]], keys[i] + ' 는 ' + keys[0] + ' 와 다른 그림');
    }
    eq((sigs.nightcourt.match(/#0a2a20/) || []).length, 1, '야경 코트 바탕색');
    ok(sigs.darkstudio.indexOf('rgba(255,196,120') >= 0, '다크 스튜디오 조명');
    ok(sigs.sunsetshuttle.indexOf('#f6ab63') >= 0, '노을 체육관 지평선 색');
    ok(sigs.mintmesh.indexOf('rgba(86,255,206') >= 0, '민턴 그라데이션 민트');
  });

  test('v1.63 그리기: 사진 없이도 매거진·필름 카드에 배경 아트가 깔린다', function () {
    var sc = SC();
    ['magazine', 'film'].forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ design: d, bg: 'nightcourt', photo: null }));
      eq(m.log.ops.indexOf('drawImage'), -1, d + ' · 사진 없이 그린다');
      ok(m.log.stops.indexOf('#0a2a20') >= 0, d + ' · 기본 배경(사진 자리엔 캔버스 fallback)이 깔린다');
      ok(m.log.fillTexts > 0, d + ' · 글씨도 그린다');
      ok(m.log.texts.join('|').indexOf('민턴일기') >= 0, d + ' · 문구');
      ok(m.log.texts.join('|').indexOf('90') >= 0, d + ' · 숫자');
    });
  });

  test('v1.63 그리기: 스티커는 배경을 고르게 해도 투명 그대로다', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'sticker', bg: 'sunsetshuttle' }));
    eq(m.log.rects.length, 0, '바탕을 칠하지 않는다');
    eq(m.log.stops.indexOf('#f6ab63'), -1, '배경 아트도 깔지 않는다');
    eq(m.log.ops.indexOf('clearRect'), 0, '먼저 투명으로 지운다');
    ok(m.log.fillTexts > 0, '글씨는 그린다');
  });

  test('v1.63 그리기: 사진을 고르면 내 사진이 먼저다(배경 아트는 지워진다)', function () {
    var sc = SC();
    sc._setState(uiState({ bg: '', photo: { width: 900, height: 1600 } }));
    var spec = sc._specOf(ctxOf(stateOf([rec()])));
    eq(spec.bg, '', '사진을 고르면 배경은 비어 있다');
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ bg: '', photo: { width: 900, height: 1600 } }));
    ok(m.log.ops.indexOf('drawImage') >= 0, '내 사진을 그린다');
    eq(m.log.stops.indexOf('#0a2a20'), -1, '배경 아트 없음');
  });

  test('v1.63 그리기: 고른 배경이 spec에 실린다(스티커는 빈 값)', function () {
    var sc = SC();
    sc._setState(uiState({ design: 'magazine', bg: 'darkstudio' }));
    eq(sc._specOf(ctxOf(stateOf([rec()]))).bg, 'darkstudio', '매거진 spec.bg');
    sc._setState(uiState({ design: 'film', bg: 'mintmesh' }));
    eq(sc._specOf(ctxOf(stateOf([rec()]))).bg, 'mintmesh', '필름 spec.bg');
    sc._setState(uiState({ design: 'sticker', bg: 'mintmesh' }));
    eq(sc.bgOf(sc._specOf(ctxOf(stateOf([rec()])))), null, '스티커는 그리지 않음');
  });

  /* =========================================================
   * 4. 디자인 다듬기 — 스크림·자간·문구
   * ========================================================= */

  test('v1.63 매거진: 스크림이 여러 단계로 부드럽게 스며들고 맨 아래는 진하다', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'magazine', bg: 'nightcourt' }));
    var scrim = m.log.gradients.filter(function (g) { return g.y0 >= 1350 * 0.5 && g.stops.length >= 5; })[0];
    ok(!!scrim, '아래에서 시작하는 다단 스크림');
    ok(scrim.stops[0].indexOf(',0)') > 0, '위는 투명');
    ok(scrim.stops[scrim.stops.length - 1].indexOf(',0.58)') > 0, '맨 아래는 진하게 (v1.67 스크림 축소)');
    var src = readRoot('js/sharecard.js');
    includes(src, 'letterSpacing', '자간 다듬기');
    includes(src, "tracking(g, 0)", '자간 원복');
  });

  test('v1.63 스티커: 어떤 사진 위에서도 또렷하게 — 글씨 테두리를 함께 그린다', function () {
    var src = readRoot('js/sharecard.js');
    includes(src, 'outlineText', '테두리 그리기');
    includes(src, 'strokeText', '캔버스 strokeText');
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, cardSpec({ design: 'sticker' }));
    ok(m.log.fillTexts > 0, '글씨는 그대로');
  });

  /* =========================================================
   * 5. 보호 — 기존 기능·안전·버전
   * ========================================================= */

  test('v1.63 보호: 사진은 폰 안에서만 · 서버 전송·업로드 없음', function () {
    var src = readRoot('js/sharecard.js');
    excludes(src, 'fetch(', '서버 전송 없음');
    excludes(src, 'XMLHttpRequest', '서버 전송 없음');
    excludes(src, 'new FormData', '업로드 없음');
    includes(src, 'readAsDataURL', '폰 안에서 읽기');
    includes(src, 'canvas.toBlob', '캔버스 → PNG');
    includes(src, 'navigator.share', '공유 시트');
    includes(src, 'clearRect', '투명 스티커');
    ['김원호', '안세영', '서승재'].forEach(function (n) { excludes(src, n, n + ' 없음'); });
  });

  test('v1.63 보호: 시트 예시에도 실존 선수 이름이 없다', function () {
    if (!hasNode) return;
    var sc = SC();
    sc._setState(uiState({ mode: 'comp', contest: '○○시 오픈 대회' }));
    var html = sc._sheetBody(ctxOf(stateOf([rec()])));
    ['김원호', '안세영', '서승재'].forEach(function (n) { excludes(html, n, n + ' 없음'); });
  });

  test('v1.63 배선: 스타일 · 캐시 · 테스트 목록', function () {
    var css = readRoot('styles.css');
    ['.sc__guide', '.sc__shot', '.sc__shotdel', '.sc__bgs', '.sc__bg.is-on', '.sc__bgthumb',
      '.sc__more', '.sc__moresum', '.sc__savebar', '.sc__compbox', '.sc__preview .sc__canvas',
      '.sc__design.is-on', '.sc__ratio--story i', '.sc__shadebox', '.sc__preview', '.sc__canvas',
      '.sc__summary', '.sc__modes', '.sc__designs', '.sc__ratios', '.sc__pals'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    includes(css, 'max-height: max(230px, 37dvh)', '첫 화면에 사진 버튼까지 — 미리보기 높이 제한');
    includes(css, 'position: sticky', '저장은 아래에 붙어 있음');

    var sw = readRoot('sw.js');
    includes(sw, "'./js/sharecard.js'", 'sw 캐시 sharecard');
    includes(sw, "'./js/ui.js'", 'sw 캐시 ui');
    var run = readRoot('test/run.js');
    includes(run, 'test/v163.test.js', '테스트 목록');

    var ui = readRoot('js/ui.js');
    includes(ui, 'tune:', '접기 아이콘');
  });

  test('v1.63 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.92.0'", 'sw.js');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
    includes(app, "version: 'v1.92.0'", 'app.js');
    ok(/styles\.css\?v=20261127-\d+/.test(index), 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.92.0', 'TWA 이름');
    eq(twa.appVersion, '1.92.0', 'TWA 버전');
    eq(twa.appVersionCode, 86, 'TWA 코드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
