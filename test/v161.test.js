/* ============================================================
 * test/v161.test.js — bm-v1.73.0
 *   ✏️ 인스타 카드 문구 프리셋 · 직접 입력
 *
 *  사용자가 요청한 그대로를 검증합니다.
 *   "오운완 말고 다른걸로 못바꿔?" → "여러가지 넣고 원하는것도 넣을수있게"
 *   → "실제 사람들이 올린 게시물보고" · "문구다시 생각해봐"
 *
 *   1) '오운완' 고정 표기를 카드·시트·MY 어디에도 쓰지 않는다
 *      (MY 메뉴 줄은 '민턴일기 · 대회 인증').
 *   2) 프리셋 5종(민턴일기 · 오늘도, 배드민턴 · 민턴기록 · 민턴성장기 · COURT TIME)
 *      + '직접 쓰기'(24자) — 고른/쓴 문구가 매거진 · 필름 · 스티커 셋 다에 들어간다.
 *   3) 줄바꿈·제어문자 정리 · 24자 상한 · HTML 이스케이프(캔버스는 fillText).
 *   4) 대회 카드도 제목 한 줄을 바꿀 수 있다.
 *   5) 보호 — 5개 탭 · 입구 세 곳 · CSP · 실명 없음 · 버전(bm-v1.73.0) · 캐시 키.
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
      id: 'r_v161', type: '기록', userKey: ME, nick: '나래', date: '2026-11-23',
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
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', recordId: 'r_v161', photo: null,
      phrase: '민턴일기', phraseComp: '민턴일기',
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
    var log = { texts: [], textYs: [], rects: [], ops: [], strokes: 0, canvasW: 0, canvasH: 0 };
    function gradient(x0, y0, x1, y1) {
      return { x0: x0, y0: y0, x1: x1, y1: y1, stops: [], addColorStop: function () {} };
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1, lineCap: '', lineJoin: '',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) { log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle }); log.ops.push('fillRect'); },
      strokeRect: function () { log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      arcTo: function () {}, arc: function () {},
      fill: function () { log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {},
      createLinearGradient: function (x0, y0, x1, y1) { return gradient(x0, y0, x1, y1); },
      createRadialGradient: function (x0, y0, r0, x1, y1, r1) { return gradient(x1, y1, r0, r1); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) { log.texts.push(String(text)); log.textYs.push(y); log.ops.push('fillText'); },
      drawImage: function () { log.ops.push('drawImage'); }
    };
    var canvas = {
      width: 0, height: 0,
      getContext: function () { return g; },
      toBlob: function (cb) { cb({ size: 10, type: 'image/png' }); }
    };
    return { canvas: canvas, ctx: g, log: log };
  }

  function cardSpec(patch) {
    var s = {
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night', photo: null,
      phrase: '민턴일기',
      top: '11/23 (일) · 나래울체육관', kicker: '운동 시간',
      big: { value: '90', unit: '분', label: '운동 시간' },
      bigLine: '90분 · 2승 1패',
      stats: [{ label: '경기', value: '2승 1패' }, { label: '연속 기록', value: '5일' }],
      meta: '민호와 함께 · vs 지호', metaLine: '나래울체육관', label: '2승 1패 · 11/23 (일)',
      date: '11/23 (일)', comp: null
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  function compSpec(patch) {
    var s = {
      mode: 'comp', phrase: '민턴일기', top: '11/22 (일)', kicker: '○○시 오픈 배드민턴 대회',
      big: { value: '준우승', unit: '', label: '성적' }, bigLine: '준우승 · B조 복식',
      stats: [{ label: '종목', value: 'B조 복식' }, { label: '파트너', value: '민호' }],
      meta: '', metaLine: '○○시 오픈 배드민턴 대회', label: '○○시 오픈 배드민턴 대회 · B조 복식'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return cardSpec(s);
  }

  var DESIGNS3 = ['magazine', 'receipt', 'film', 'sticker'];

  /* =========================================================
   * 1. 프리셋 — 실제 게시물에서 많이 쓰는 다섯 문구 + 직접 쓰기
   * ========================================================= */

  test('v1.61 프리셋: 민턴일기 · 오늘도, 배드민턴 · 민턴기록 · 민턴성장기 · COURT TIME 다섯 + 직접 쓰기', function () {
    var sc = SC();
    eq(sc.PHRASES.length, 5, '프리셋 5종');
    eq(sc.PHRASES.map(function (p) { return p.text; }).join('|'),
      '민턴일기|오늘도, 배드민턴|민턴기록|민턴성장기|COURT TIME', '문구 그대로');
    eq(sc.PHRASES.map(function (p) { return p.id; }).join(','), 'mintern,today,record,growth,court', '아이디');
    eq(sc.DEFAULT_PHRASE, '민턴일기', '기본은 민턴일기');
    eq(sc.PHRASE_MAX, 24, '직접 입력 24자까지');
    eq(sc.phraseById('growth').text, '민턴성장기', '아이디로 찾기');
    eq(sc.phraseById('없음'), null, '모르는 아이디');
    eq(sc.isPresetPhrase('민턴기록'), true, '프리셋이면 true');
    eq(sc.isPresetPhrase('내가 쓴 문구'), false, '직접 쓴 문구는 false');
    eq(sc.phraseById('mintern').note, '매일 쓰는 기록', '짧은 설명');
    /* 문구마다 24자 안 · 빈 문구 없음 */
    sc.PHRASES.forEach(function (p) {
      ok(p.text.length > 0 && p.text.length <= sc.PHRASE_MAX, p.text + ' 길이');
      eq(sc.phraseText(p.text), p.text, p.text + ' 그대로');
    });
  });

  test('v1.61 문구 다듬기: 줄바꿈·제어문자는 공백으로, 앞뒤 공백은 지우고 24자에서 자른다', function () {
    var sc = SC();
    eq(sc.phraseText('  코트 위 3시간  '), '코트 위 3시간', '앞뒤 공백');
    eq(sc.phraseText('민턴\n일기'), '민턴 일기', '줄바꿈 → 공백');
    eq(sc.phraseText('민턴\t\t일기'), '민턴 일기', '탭 → 한 칸');
    eq(sc.phraseText('민턴\u0007일기'), '민턴 일기', '제어문자 제거');
    eq(sc.phraseText(''), '', '빈 값');
    eq(sc.phraseText(null), '', 'null');
    eq(sc.phraseText(undefined), '', 'undefined');
    var long = '가'.repeat(30);
    eq(sc.phraseText(long).length, 24, '24자에서 자름');
    eq(sc.phraseText(long), '가'.repeat(24), '앞에서부터 24자');
    /* 캔버스에 그리는 글씨는 HTML이 아니라 fillText — 태그도 글자로만 남는다 */
    eq(sc.phraseText('<b>민턴</b>'), '<b>민턴</b>', '태그는 글자 그대로(캔버스 안전)');
  });

  /* =========================================================
   * 2. 시트 — 카드 문구 칸(칩 6개 + 입력칸)
   * ========================================================= */

  test('v1.61 시트: 카드 문구 칸에 칩 6개(프리셋 5 + 직접 쓰기)와 입력칸이 있다', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ mode: 'today' }));
    var html = sc._sheetBody(ctxOf(state));

    includes(html, '카드 문구', '칸 이름');
    eq((html.match(/data-sc-phrase="/g) || []).length, 6, '칩 6개');
    ['mintern', 'today', 'record', 'growth', 'court', 'custom'].forEach(function (id) {
      includes(html, 'data-sc-phrase="' + id + '"', '칩 ' + id);
    });
    includes(html, '>민턴일기<', '민턴일기 칩 글자');
    includes(html, '>오늘도, 배드민턴<', '오늘도, 배드민턴 칩 글자');
    includes(html, '>민턴기록<', '민턴기록 칩 글자');
    includes(html, '>민턴성장기<', '민턴성장기 칩 글자');
    includes(html, '>COURT TIME<', 'COURT TIME 칩 글자');
    includes(html, '>직접 쓰기<', '직접 쓰기 칩');

    /* 기본은 민턴일기 — 그 칩만 눌린 상태 */
    includes(html, 'data-sc-phrase="mintern" aria-pressed="true"', '기본 칩 선택');
    includes(html, 'class="chip sc__phrasechip is-on" data-sc-phrase="mintern"', '기본 칩이 색으로 켜짐');
    includes(html, 'data-sc-phrase="custom" aria-pressed="false"', '직접 쓰기는 꺼짐');
    includes(html, 'data-sc-phrase="court" aria-pressed="false"', 'COURT TIME은 꺼짐');

    /* 직접 입력칸 — 24자 제한 · 현재 문구가 들어 있음 */
    includes(html, 'data-sc-field="phrase"', '입력칸');
    includes(html, 'maxlength="24"', '24자 제한');
    includes(html, 'value="민턴일기"', '지금 문구');
    includes(html, '24자까지', '안내 문구');
    includes(html, 'data-sc-phrase-count', '글자 수');
    includes(html, '4/24', '지금 글자 수');
  });

  test('v1.61 시트: 대회 카드도 제목 한 줄을 바꾼다(phraseComp)', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ mode: 'comp', phraseComp: '민턴성장기', phrase: '민턴일기' }));
    var html = sc._sheetBody(ctxOf(state));
    includes(html, '카드 제목', '대회는 제목');
    includes(html, 'data-sc-field="phraseComp"', '대회 제목 칸');
    includes(html, 'data-sc-phrase="growth" aria-pressed="true"', '대회에서 고른 칩');
    includes(html, 'value="민턴성장기"', '대회 제목 값');
    /* 오늘 문구는 건드리지 않는다 */
    sc._setState(uiState({ mode: 'today', phraseComp: '민턴성장기', phrase: '민턴일기' }));
    includes(sc._sheetBody(ctxOf(state)), 'value="민턴일기"', '오늘 모드는 오늘 문구');
  });

  test('v1.61 시트: 직접 쓴 문구도 이스케이프되어 나가고 24자에서 잘린다', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ phrase: '<img src=x onerror=alert(1)>' }));
    var html = sc._sheetBody(ctxOf(state));
    excludes(html, '<img src=x', '태그가 그대로 나가지 않음');
    includes(html, '&lt;img', '글자로만 남음');
    sc._setState(uiState({ phrase: '가'.repeat(40) }));
    var long = sc._sheetBody(ctxOf(state));
    includes(long, 'value="' + '가'.repeat(24) + '"', '시트도 24자까지만');
    includes(long, '24/24', '글자 수 24/24');
  });

  /* =========================================================
   * 3. 그리기 — 세 디자인 모두에 고른 문구가 들어간다
   * ========================================================= */

  test('v1.61 그리기: 매거진 · 필름 · 스티커 모두 고른 프리셋 문구를 그린다', function () {
    var sc = SC();
    sc.PHRASES.forEach(function (p) {
      DESIGNS3.forEach(function (d) {
        var m = mockCanvas();
        sc.draw(m.canvas, cardSpec({ design: d, phrase: p.text }));
        includes(m.log.texts.join('|'), p.text, d + ' · ' + p.text);
      });
    });
  });

  test('v1.61 그리기: 직접 쓴 문구도 세 디자인 · 두 비율 모두에 들어간다', function () {
    var sc = SC();
    DESIGNS3.forEach(function (d) {
      ['feed', 'story'].forEach(function (r) {
        var m = mockCanvas();
        sc.draw(m.canvas, cardSpec({ design: d, ratio: r, phrase: '코트 위 3시간' }));
        includes(m.log.texts.join('|'), '코트 위 3시간', d + '/' + r + ' 직접 쓴 문구');
        var low = r === 'story' ? 220 : 0, high = r === 'story' ? 1700 : 1350;
        m.log.textYs.forEach(function (y) {
          ok(y >= low && y <= high, d + '/' + r + ' 글씨가 카드 안 (' + y + ')');
        });
      });
    });
  });

  test('v1.61 그리기: 대회 카드도 제목을 바꾸면 그 문구가 세 디자인에 들어간다', function () {
    var sc = SC();
    DESIGNS3.forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, compSpec({ design: d, phrase: '민턴성장기' }));
      includes(m.log.texts.join('|'), '민턴성장기', d + ' 대회 제목');
      includes(m.log.texts.join('|'), '준우승', d + ' 성적은 그대로');
      includes(m.log.texts.join('|'), '○○시 오픈 배드민턴 대회', d + ' 대회명은 그대로');
    });
  });

  test('v1.61 그리기: 아주 긴 문구도 카드 폭을 넘지 않게 줄여 그린다(…로 자름)', function () {
    var sc = SC();
    var long = '가'.repeat(24);
    DESIGNS3.forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ design: d, phrase: long }));
      var mine = m.log.texts.filter(function (x) { return x.indexOf('가') === 0; });
      ok(mine.length >= 1, d + ' 문구를 그린다');
      mine.forEach(function (x) { ok(x.length <= 25, d + ' 폭에 맞게 줄임 (' + x.length + ')'); });
    });
  });

  test('v1.61 그리기: 문구가 비어도 카드가 깨지지 않는다', function () {
    var sc = SC();
    DESIGNS3.forEach(function (d) {
      var m = mockCanvas();
      sc.draw(m.canvas, cardSpec({ design: d, phrase: '' }));
      ok(m.log.ops.indexOf('fillText') >= 0, d + ' 숫자·날짜는 그대로');
      includes(m.log.texts.join('|'), '90', d + ' 큰 숫자');
    });
  });

  /* =========================================================
   * 4. 모델 — 일지/대회 입력 + 문구 → 카드 스펙
   * ========================================================= */

  test('v1.61 모델: 오늘 카드 문구가 스펙에 들어가고 기본은 민턴일기', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ phrase: '민턴기록' }));
    var spec = sc._specOf(ctxOf(state));
    eq(spec.phrase, '민턴기록', '고른 문구');
    eq(spec.kicker, '운동 시간', '숫자 설명은 그대로');
    eq(spec.big.value, '90', '큰 숫자');
    includes(spec.meta, '민호와 함께', '아래 한 줄');
    excludes(spec.label, '오운완', '스티커 한 줄에 오운완 없음');
    includes(spec.label, '2승 1패', '스티커 한 줄은 스탯');

    sc._setState(uiState({ phrase: '' }));
    eq(sc._specOf(ctxOf(state)).phrase, '민턴일기', '비면 기본 문구');
    sc._setState(uiState({ phrase: '   ' }));
    eq(sc._specOf(ctxOf(state)).phrase, '민턴일기', '공백만 있어도 기본 문구');
    sc._setState(uiState({ phrase: '내 문구\n둘째 줄' }));
    eq(sc._specOf(ctxOf(state)).phrase, '내 문구 둘째 줄', '줄바꿈은 공백으로');
  });

  test('v1.61 모델: 대회 카드 제목은 phraseComp를 쓴다', function () {
    if (!hasNode) return;
    var sc = SC();
    var state = stateOf([rec()]);
    sc._setState(uiState({ mode: 'comp', contest: '○○시 오픈 배드민턴 대회', event: 'B조 복식', result: '준우승',
      compPartner: '민호', phraseComp: 'COURT TIME', phrase: '민턴일기' }));
    var spec = sc._specOf(ctxOf(state));
    eq(spec.mode, 'comp', '대회');
    eq(spec.phrase, 'COURT TIME', '대회 제목');
    eq(spec.kicker, '○○시 오픈 배드민턴 대회', '대회명은 kicker');
    includes(spec.label, 'B조 복식', '스티커 한 줄');
    sc._setState(uiState({ mode: 'comp', phraseComp: '' }));
    eq(sc._specOf(ctxOf(state)).phrase, '민턴일기', '비면 기본 문구');
  });

  test('v1.61 요약: 고른 문구가 카드 요약 첫머리에 남는다', function () {
    var sc = SC();
    var sum = sc.summaryOf({ mode: 'today', title: '오늘 운동', phrase: '민턴성장기',
      big: { value: '90', unit: '분' }, design: 'magazine', ratio: 'feed', palette: 'night' });
    includes(sum, '민턴성장기', '문구');
    var comp = sc.summaryOf({ mode: 'comp', phrase: 'COURT TIME',
      comp: { contest: '○○시 오픈 배드민턴 대회', result: '준우승', event: 'B조 복식', partner: '민호', date: '11/22 (일)' },
      design: 'film', ratio: 'feed', palette: 'gold' });
    includes(comp, 'COURT TIME', '대회 문구');
  });

  /* =========================================================
   * 5. '오운완' 미노출
   * ========================================================= */

  test('v1.61 오운완: 카드 · 시트 · MY 어디에도 고정 표기로 남지 않는다', function () {
    if (!hasNode) return;
    var sc = SC();
    var src = readRoot('js/sharecard.js');
    excludes(src, '오운완', 'sharecard.js에 오운완 없음');

    var my = readRoot('js/views/my.js');
    excludes(my, '오운완', 'my.js에 오운완 없음');
    var html = BM.views.my.render(stateOf([rec()]));
    excludes(html, '오운완', 'MY 화면에 오운완 없음');
    includes(html, '민턴일기 · 대회 인증', 'MY 메뉴 줄은 민턴일기 · 대회 인증');

    var state = stateOf([rec()]);
    sc._setState(uiState({ mode: 'today' }));
    excludes(sc._sheetBody(ctxOf(state)), '오운완', '오늘 시트에 없음');
    sc._setState(uiState({ mode: 'comp' }));
    excludes(sc._sheetBody(ctxOf(state)), '오운완', '대회 시트에 없음');

    eq(JSON.stringify(sc.MODES).indexOf('오운완'), -1, '모드 설명에도 없음');
    eq(JSON.stringify(sc.PHRASES).indexOf('오운완'), -1, '프리셋에도 없음');
    sc._setState(uiState({ recordId: '' }));
    var emptySpec = sc._specOf(ctxOf(stateOf([])));
    eq(JSON.stringify(emptySpec).indexOf('오운완'), -1, '일지가 없어도 없음');
    eq(emptySpec.big.value, '', '빈 값으로 두고 가짜 글자를 넣지 않음');
  });

  /* =========================================================
   * 6. 기억 — 마지막에 고른 값 (이 기기에만)
   * ========================================================= */

  test('v1.61 기억: 마지막에 고른 디자인 · 비율 · 색 · 문구를 이 기기에 남긴다', function () {
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
      eq(sc._writePrefs({ design: 'film', ratio: 'story', palette: 'gold', phrase: '민턴성장기' }), true, '저장됨');
      eq(JSON.parse(store.bm_share_prefs_v1).design, 'film', '디자인 기억');
      sc._writePrefs({ phraseComp: 'COURT TIME' });
      var st = sc._initialState(ctxOf(stateOf([rec()])), {});
      eq(st.design, 'film', '다음에 필름으로 열림');
      eq(st.ratio, 'story', '스토리 비율');
      eq(st.palette, 'gold', '챔피언 골드');
      eq(st.phrase, '민턴성장기', '고른 문구');
      eq(st.phraseComp, 'COURT TIME', '대회 제목');
      /* 이상한 값이 섞여 있어도 기본값으로 안전하게 */
      fake.setItem('bm_share_prefs_v1', '{"design":"없음","ratio":null,"palette":5,"phrase":{}}');
      var safe = sc._initialState(ctxOf(stateOf([rec()])), {});
      eq(safe.design, 'magazine', '모르는 디자인은 매거진');
      eq(safe.ratio, 'feed', '모르는 비율은 피드');
      eq(safe.palette, 'night', '모르는 색은 나이트');
      eq(safe.phrase, '민턴일기', '문구가 아니면 기본');
      fake.setItem('bm_share_prefs_v1', '깨진 JSON');
      eq(sc._initialState(ctxOf(stateOf([rec()])), {}).design, 'magazine', '깨진 값이어도 기본');
    } finally {
      delete root.localStorage;
    }
    /* 저장소가 없으면 조용히 아무것도 하지 않는다 */
    eq(sc._writePrefs({ design: 'film' }), false, '저장소 없으면 false');
    eq(sc._initialState(ctxOf(stateOf([rec()])), {}).design, 'magazine', '그래도 기본 디자인');
  });

  /* =========================================================
   * 7. 보호 — 기존 기능 · 보안 · 버전
   * ========================================================= */

  test('v1.61 보호: 5개 탭 · 공유 카드 입구 세 곳 · 디자인/비율/색 그대로', function () {
    if (!hasNode) return;
    var sc = SC();
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');

    eq(sc.MODES.length, 2, '두 모드');
    eq(sc.DESIGNS.map(function (d) { return d.id; }).join(','), 'magazine,receipt,film,sticker', '디자인 4종');
    eq(sc.RATIOS.length, 2, '비율 2종');
    eq(sc.SHADES.length, 3, '밝기 3단계');
    eq(sc.PALETTES.length, 5, '색 5종');
    eq(sc.RESULTS.length, 4, '성적 4종');

    var logjs = readRoot('js/views/log.js');
    includes(logjs, '인스타 공유 카드 만들기', '저장 직후 버튼');
    includes(logjs, 'BM.sharecard.open(ctx', '공유 카드 열기');
    includes(BM.views.log.recordDetail(rec()), 'data-act="share-card"', '기록 상세 버튼');
    var my = BM.views.my.render(stateOf([rec()]));
    includes(my, '인스타 공유 카드', 'MY 입구');
    includes(my, '매거진', 'MY 안내에 디자인');
  });

  test('v1.61 보안: 이스케이프 · CSP · 실명 없음 · 사진은 폰 안에서만', function () {
    if (!hasNode) return;
    var sc = readRoot('js/sharecard.js');
    includes(sc, 'U.esc(', '시트 이스케이프');
    excludes(sc, 'eval(', 'eval 없음');
    excludes(sc, 'innerHTML = \'<', '사용자 글자를 그대로 넣지 않음');
    excludes(sc, 'fetch(', '서버 전송 없음');
    excludes(sc, 'XMLHttpRequest', '서버 전송 없음');

    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
    includes(csp, "default-src 'self'", 'self 만');

    ['김원호', '안세영', '서재승', '서승재'].forEach(function (name) {
      excludes(sc, name, name + ' 없음');
    });
    SC()._setState(uiState({ mode: 'comp', phraseComp: '내 문구' }));
    excludes(SC()._sheetBody(ctxOf(stateOf([rec()]))), '김원호', '시트 예시도 가명만');
  });

  test('v1.61 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.102.0'", 'sw.js');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
    includes(app, "version: 'v1.102.0'", 'app.js');
    includes(index, 'styles.css?v=20261128-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.102.0', 'TWA 이름');
    eq(twa.appVersion, '1.102.0', 'TWA 버전');
    eq(twa.appVersionCode, 96, 'TWA 코드');
    includes(index, 'js/sharecard.js', 'index 스크립트');
  });

  test('v1.61 배선: sw 캐시 · 문구 스타일 · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "'./js/sharecard.js'", 'sw 캐시 sharecard');
    var css = readRoot('styles.css');
    ['.sc__phrase', '.sc__phrases .chip', '.sc__phraseinput', '.sc__phraseinput:focus'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    includes(css, 'max-height: 58vh', '카드가 폰 화면을 넘지 않게');
    var run = readRoot('test/run.js');
    includes(run, 'test/v161.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
