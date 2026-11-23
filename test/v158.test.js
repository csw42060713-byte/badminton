/* ============================================================
 * test/v158.test.js — bm-v1.58.0
 *   🎨 인스타 카드 색·디자인 다양화 + 동기화 큐 막힘 해결
 *
 *  사용자가 요청한 두 가지를 그대로 검증합니다.
 *   1) 공유 카드 색상 5종 × 디자인 3종
 *      · 색: 나이트 · 코트 블루 · 선셋 · 사쿠라 · 챔피언 골드 (기본 나이트 = v1.57 그대로)
 *      · 디자인: 미니멀 · 포스터 · 코트 라인 (기본 미니멀 = v1.57 그대로)
 *      · 내 사진 위 · 투명 스티커에서도 고른 색의 강조 글씨·배지·판 테두리
 *      · 시트의 색상 5칸 · 디자인 3칸과 선택 표시
 *   2) 동기화 큐 영구 실패 방지
 *      · 맨 앞 1건이 권한/RLS/잘못된 행으로 막히면 그 건만 격리하고 뒤는 계속 전송
 *      · 6회 이상 연속 실패는 격리, 네트워크·오프라인은 격리하지 않음
 *      · 인증 만료(401)는 '로그인 세션이 만료됐어요'로 원인 표시
 *      · MY › 데이터의 대기열 건수 · 오류 내용 · '대기 중 비우기'
 *   3) 기존 5개 탭·v1.57 기능 보호 · 보안(CSP·이스케이프) · 버전(sw·app·index·TWA)
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
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
      id: 'r_v158', type: '기록', userKey: ME, nick: '나래', date: '2026-11-23',
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
      mode: 'today', style: 'court', palette: 'night', layout: 'minimal', recordId: 'r_v158', photo: null,
      gym: '나래울체육관', partner: '민호', rival: '지호', contest: '', event: '', result: '우승',
      compPartner: '', date: '2026-11-23'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  /* ---------- 가짜 2D 컨텍스트: 캔버스 없이 그리기 호출을 그대로 기록 ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mockCanvas() {
    var log = { styles: [], rects: [], texts: [], textColors: [], stops: [], strokes: 0, ops: [] };
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, globalAlpha: 1,
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function (x, y, w, h) { log.rects.push({ x: x, y: y, w: w, h: h, fill: g.fillStyle }); log.ops.push('fillRect'); },
      strokeRect: function () { log.strokes++; log.ops.push('strokeRect'); },
      beginPath: function () { log.ops.push('beginPath'); },
      moveTo: function () {}, lineTo: function () {}, arcTo: function () {}, closePath: function () {},
      fill: function () { log.styles.push(g.fillStyle); log.ops.push('fill'); },
      stroke: function () { log.styles.push(g.strokeStyle); log.strokes++; log.ops.push('stroke'); },
      clip: function () { log.ops.push('clip'); },
      save: function () { log.ops.push('save'); },
      restore: function () { log.ops.push('restore'); },
      translate: function () { log.ops.push('translate'); },
      scale: function () { log.ops.push('scale'); },
      createLinearGradient: function () { return gradient(); },
      createRadialGradient: function () { return gradient(); },
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) { log.texts.push(String(text)); log.textColors.push(g.fillStyle); log.ops.push('fillText'); },
      drawImage: function () { log.ops.push('drawImage'); }
    };
    function gradient() {
      return { addColorStop: function (offset, color) { log.stops.push(color); } };
    }
    var canvas = { width: 0, height: 0, getContext: function () { return g; } };
    return { canvas: canvas, ctx: g, log: log };
  }

  function usesColor(log, color) {
    return log.styles.indexOf(color) >= 0 || log.stops.indexOf(color) >= 0 ||
      log.textColors.indexOf(color) >= 0 ||
      log.rects.some(function (r) { return r.fill === color; });
  }

  /* =========================================================
   * 1. 색상 5종 · 디자인 3종 모델
   * ========================================================= */

  test('v1.58 색상: 팔레트 5종이 약속한 이름 그대로이고 기본은 나이트다', function () {
    var sc = SC();
    eq(sc.PALETTES.length, 5, '팔레트 5종');
    var ids = sc.PALETTES.map(function (p) { return p.id; }).join(',');
    eq(ids, 'night,court,sunset,sakura,gold', '순서·아이디');
    var names = sc.PALETTES.map(function (p) { return p.name; }).join(',');
    eq(names, '나이트,코트 블루,선셋,사쿠라,챔피언 골드', '이름');
    SC().PALETTES.forEach(function (p) {
      ok(/^#[0-9a-f]{6}$/i.test(p.accent), p.id + ' 강조색');
      ok(/^#[0-9a-f]{6}$/i.test(p.text), p.id + ' 글자색');
      eq(p.bg.length, 3, p.id + ' 바탕 3단');
      eq(p.shade.length, 3, p.id + ' 사진 어둡게 색');
    });
    /* v1.57 기본(딥 그린 + 네온 라임)이 그대로 기본값 */
    var night = sc.paletteById('night');
    eq(night.accent, '#c6f24e', '나이트 강조색 = v1.57 라임');
    eq(sc.paletteById(undefined).id, 'night', '모르는 값은 나이트');
    eq(sc.paletteById('없는색').id, 'night', '없는 이름도 나이트');
    eq(sc.paletteById('gold').name, '챔피언 골드', '골드');
  });

  test('v1.58 디자인: 레이아웃 3종이 약속한 이름 그대로이고 기본은 미니멀이다', function () {
    var sc = SC();
    eq(sc.LAYOUTS.length, 3, '레이아웃 3종');
    eq(sc.LAYOUTS.map(function (l) { return l.id; }).join(','), 'minimal,poster,courtline', '아이디');
    eq(sc.LAYOUTS.map(function (l) { return l.name; }).join(','), '미니멀,포스터,코트 라인', '이름');
    eq(sc.layoutById(undefined).id, 'minimal', '모르는 값은 미니멀');
    eq(sc.layoutById('courtline').name, '코트 라인', '코트 라인');
  });

  test('v1.58 모델: 고른 색·디자인이 카드 문구와 요약에 함께 남는다', function () {
    if (!hasNode) return;
    var state = stateOf([rec()]);
    SC()._setState(uiState({ palette: 'court', layout: 'poster' }));
    var html = SC()._sheetBody(ctxOf(state));
    includes(html, 'sc__pal--court is-on', '색 칩 선택 표시');
    includes(html, 'sc__layout is-on', '디자인 칩 선택 표시');
    eq((html.match(/data-sc-pal="/g) || []).length, 5, '색상 칩 5개');
    eq((html.match(/data-sc-layout="/g) || []).length, 3, '디자인 칩 3개');
    includes(html, '카드 색상', '색상 제목');
    includes(html, '카드 디자인', '디자인 제목');
    includes(html, '챔피언 골드', '골드 칩');
    includes(html, '코트 라인', '코트 라인 칩');
    includes(html, 'aria-pressed="true"', '선택 표시(접근성)');

    var sum = SC().summaryOf({ mode: 'today', title: '오늘 운동', bigs: [{ value: '90', unit: '분' }], sub: '📍 나래울', palette: 'court', layout: 'poster' });
    includes(sum, '코트 블루', '요약에 색 이름');
    includes(sum, '포스터', '요약에 디자인 이름');
    /* v1.57 방식(색·디자인 없음)은 예전 문구 그대로 */
    eq(SC().summaryOf({ title: '오늘 운동', bigs: [{ value: '90', unit: '분' }], sub: '📍 나래울' }),
      '오늘 운동 / 90분 / 📍 나래울', '예전 요약 그대로');
  });

  /* =========================================================
   * 2. 그리기 — 색 5 × 디자인 3 (오늘 운동 · 대회 인증)
   * ========================================================= */

  test('v1.58 그리기: 색 5종 × 디자인 3종 카드가 모두 그려지고 고른 색이 쓰인다', function () {
    var sc = SC();
    var checked = 0;
    sc.PALETTES.forEach(function (p) {
      sc.LAYOUTS.forEach(function (l) {
        var m = mockCanvas();
        var spec = {
          mode: 'today', style: 'court', palette: p.id, layout: l.id, photo: null,
          headline: '오운완', title: '오늘 운동', date: '11/23 (일)',
          bigs: [{ value: '90', unit: '분', label: '운동 시간' },
            { value: '2승 1패', unit: '', label: '경기' },
            { value: '5', unit: '일', label: '연속 기록', flame: true }],
          sub: '📍 나래울체육관  ·  11/23 (일)'
        };
        var out = sc.draw(m.canvas, spec);
        ok(out === m.canvas, p.id + '/' + l.id + ' 캔버스 반환');
        eq(m.canvas.width, 1080, '가로');
        eq(m.canvas.height, 1350, '세로');
        eq(m.log.ops[0], 'clearRect', '투명하게 비우고 시작');
        ok(m.log.texts.join('|').indexOf('90') >= 0, p.id + '/' + l.id + ' 운동 시간');
        ok(usesColor(m.log, p.accent), p.id + '/' + l.id + ' 고른 색 강조(' + p.accent + ')');
        /* 포스터는 위 배너(높이 320 가로 전체) + 아래 바, 미니멀은 배너가 없다 */
        var band = m.log.rects.some(function (r) { return r.w === 1080 && r.h === 320; });
        if (l.id === 'poster') ok(band, p.id + ' 포스터 배너·아래 바');
        if (l.id === 'minimal') ok(!band, p.id + ' 미니멀은 배너 없음');
        checked++;

        /* 대회 인증도 같은 조합으로 */
        var c = mockCanvas();
        var cspec = {
          mode: 'comp', style: 'court', palette: p.id, layout: l.id, photo: null,
          comp: sc.compModel({ contest: '○○시 오픈 배드민턴 대회', event: 'B조 복식', result: '준우승', partner: '민호', date: '2026-11-22' }),
          date: '11/22 (일)'
        };
        cspec.sub = sc.compSub(cspec.comp);
        sc.draw(c.canvas, cspec);
        ok(c.log.texts.indexOf('준우승') >= 0, p.id + '/' + l.id + ' 성적 배지');
        ok(usesColor(c.log, p.accent), p.id + '/' + l.id + ' 대회 카드 색');
        checked++;
      });
    });
    eq(checked, 30, '색 5 × 디자인 3 × 모드 2');
  });

  test('v1.58 그리기: 코트 라인은 배경 선을 더 그리고, 색마다 선 색이 다르다', function () {
    var sc = SC();
    var minimal = mockCanvas(), courtline = mockCanvas();
    var base = { mode: 'today', style: 'court', palette: 'court', photo: null, headline: '오운완', date: '11/23 (일)',
      bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '📍 나래울' };
    sc.draw(minimal.canvas, base);
    sc.draw(courtline.canvas, { mode: 'today', style: 'court', palette: 'court', layout: 'courtline', photo: null,
      headline: '오운완', date: '11/23 (일)',
      bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '📍 나래울' });
    ok(courtline.log.strokes > minimal.log.strokes, '코트 라인 선이 더 많다');
    ok(courtline.log.strokes >= 10, '코트 외곽·서비스 라인·네트 결');
    ok(usesColor(courtline.log, sc.paletteById('court').court), '선 색이 팔레트를 따른다');
  });

  test('v1.58 그리기: 내 사진 위에서도 고른 색 글씨·배지가 쓰인다', function () {
    var sc = SC();
    sc.PALETTES.forEach(function (p) {
      var m = mockCanvas();
      var photo = { width: 1200, height: 1600 };
      sc.draw(m.canvas, {
        mode: 'today', style: 'photo', palette: p.id, layout: 'minimal', photo: photo,
        headline: '오운완', date: '11/23 (일)',
        bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '📍 나래울'
      });
      ok(m.log.ops.indexOf('drawImage') >= 0, p.id + ' 사진을 그린다');
      ok(m.log.stops.indexOf('rgba(' + p.shade.join(',') + ',0.94)') >= 0, p.id + ' 사진 아래를 팔레트 색으로 어둡게');
      ok(m.log.texts.join('|').indexOf('90') >= 0, p.id + ' 숫자');
      ok(usesColor(m.log, p.accent), p.id + ' 강조 단위(분) 색');
    });
  });

  test('v1.58 그리기: 투명 스티커도 고른 색 판·테두리를 쓴다', function () {
    var sc = SC();
    ['night', 'court', 'sunset', 'sakura', 'gold'].forEach(function (id) {
      var p = sc.paletteById(id);
      var m = mockCanvas();
      sc.draw(m.canvas, { mode: 'comp', style: 'sticker', palette: id, layout: 'minimal', photo: null,
        comp: sc.compModel({ contest: '○○시 오픈', event: 'B조 복식', result: '우승', partner: '민호' }), date: '11/22 (일)' });
      ok(m.log.styles.indexOf(p.plate) >= 0, id + ' 판 바탕');
      ok(m.log.styles.indexOf(p.plateLine) >= 0, id + ' 판 테두리');
      ok(m.log.texts.indexOf('우승') >= 0, id + ' 성적');

      var line = mockCanvas();
      sc.draw(line.canvas, { mode: 'today', style: 'sticker', palette: id, layout: 'courtline', photo: null,
        headline: '오운완', bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '📍 나래울', date: '11/23 (일)' });
      ok(line.log.ops.indexOf('clip') >= 0, id + ' 코트 라인은 판 안쪽만');
      ok(line.log.strokes >= 3, id + ' 판 안에 코트 선');

      var poster = mockCanvas();
      sc.draw(poster.canvas, { mode: 'today', style: 'sticker', palette: id, layout: 'poster', photo: null,
        headline: '오운완', bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '', date: '11/23 (일)' });
      ok(poster.log.ops.indexOf('scale') >= 0, id + ' 포스터 스티커는 줄여 그린다');
      ok(poster.log.ops.indexOf('clip') >= 0, id + ' 카드 모양으로 자른다');
      ok(usesColor(poster.log, p.accent), id + ' 포스터 스티커 색');
    });
  });

  test('v1.58 그리기: 모르는 색·디자인이 와도 기본 카드로 안전하게 그린다', function () {
    var sc = SC();
    var m = mockCanvas();
    sc.draw(m.canvas, { mode: 'today', style: 'court', palette: '없는색', layout: '없는디자인', photo: null,
      bigs: [{ value: '90', unit: '분', label: '운동 시간' }], sub: '' });
    ok(usesColor(m.log, '#c6f24e'), '나이트 라임');
    ok(m.log.texts.join('|').indexOf('90') >= 0, '숫자 그대로');
    eq(sc.draw(null, {}), null, '캔버스가 없으면 null');
    eq(sc.draw({}, {}), null, 'getContext가 없으면 null');
  });

  /* =========================================================
   * 3. 동기화 큐 — 영구 실패는 그 건만 격리, 뒤는 계속
   * ========================================================= */

  function apiError(code, message, retryable, status) {
    var e = new BM.api.ApiError(code, message, retryable);
    if (status) e.status = status;
    return e;
  }

  function remote(handler) {
    var calls = { append: 0, update: 0, remove: 0 };
    var api = {
      mode: 'supabase',
      bootstrap: function () { return Promise.resolve({ me: {}, rows: [] }); },
      append: function (row, cid) { calls.append++; return handler('append', row, cid); },
      update: function (id, cells, cid) { calls.update++; return handler('update', id, cid); },
      remove: function (id, cid) { calls.remove++; return handler('remove', id, cid); }
    };
    return { api: api, calls: calls };
  }

  function freshQueueStore(handler) {
    try {
      U.storage.removeItem('bm_queue_v1');
      U.storage.removeItem('bm_queue_dead_v1');
    } catch (e) { /* 무시 */ }
    var r = remote(handler);
    var store = BM.store.createStore({ api: r.api });
    return { store: store, calls: r.calls, state: store.actions._state() };
  }

  function ops() {
    return [
      { kind: 'append', row: ['t1'], clientId: 'c1' },
      { kind: 'update', id: 'r1', cells: {}, clientId: 'c2' },
      { kind: 'update', id: 'r2', cells: {}, clientId: 'c3' },
      { kind: 'update', id: 'r3', cells: {}, clientId: 'c4' },
      { kind: 'update', id: 'r4', cells: {}, clientId: 'c5' }
    ];
  }

  test('v1.58 큐: 맨 앞 1건이 권한 오류로 막혀도 뒤 4건은 그대로 보낸다', function () {
    var f = freshQueueStore(function (kind) {
      if (kind === 'append') return Promise.reject(apiError('forbidden', '서버 권한을 확인하지 못했어요.', false, 403));
      return Promise.resolve({ ok: true });
    });
    f.state.queue = ops();
    return f.store.actions._flush().then(function () {
      eq(f.state.queue.length, 0, '대기열이 비었다');
      eq(f.calls.append, 1, '막힌 1건은 한 번만 시도');
      eq(f.calls.update, 4, '뒤 4건 모두 전송');
      eq(f.state.syncBlocked.length, 1, '막힌 1건만 격리');
      eq(f.state.syncBlocked[0].op.kind, 'append', '격리된 건');
      eq(f.state.syncBlocked[0].kind, 'perm', '오류 종류');
      includes(f.state.syncError, '건너뛰', '원인 한 줄');
      eq(f.state.syncState, 'idle', '끝나면 대기 아님');
      eq(f.state.stats.skipped, 1, '건너뛴 수');
      eq(f.state.stats.writes, 4, '성공 4건');
    });
  });

  test('v1.58 큐: 격리된 저장은 지워지지 않고 다시 보낼 수 있다', function () {
    var failing = true;
    var f = freshQueueStore(function (kind) {
      if (failing && kind === 'append') return Promise.reject(apiError('forbidden', '서버 권한을 확인하지 못했어요.', false, 403));
      return Promise.resolve({ ok: true });
    });
    f.state.queue = [ops()[0], ops()[1]];
    return f.store.actions._flush().then(function () {
      eq(f.state.syncBlocked.length, 1, '한 건 격리');
      eq(f.calls.update, 1, '뒤 건은 보냄');
      failing = false;
      return f.store.actions.retryBlocked();
    }).then(function (res) {
      eq(res.count, 1, '되돌린 건수');
      eq(f.state.queue.length, 0, '다시 보내 대기열이 비었다');
      eq(f.state.syncBlocked.length, 0, '격리 목록 비움');
      eq(f.calls.append, 2, '같은 저장을 다시 시도');
      eq(f.state.syncState, 'idle', '대기 아님');
    });
  });

  test('v1.58 큐: 세션이 만료됐으면 원인을 남기고 남은 저장은 대기열에 그대로 둔다', function () {
    var f = freshQueueStore(function () {
      return Promise.reject(apiError('session', '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', false, 401));
    });
    f.state.queue = [ops()[1], ops()[2]];
    return f.store.actions._flush().then(function () {
      eq(f.calls.update, 1, '한 번만 시도하고 멈춘다');
      eq(f.state.syncState, 'error', '재시도 대기');
      eq(f.state.syncErrorKind, 'auth', '인증 만료');
      includes(f.state.syncError, '로그인 세션이 만료됐어요', '원인 문구');
      includes(f.state.syncError, 'MY에서 다시 로그인', '어디서 고치는지');
      eq(f.state.queue.length, 2, '남은 저장은 지우지 않는다(세션만 풀리면 그대로 보냄)');
      eq(f.state.syncBlocked.length, 0, '격리하지 않는다');
    });
  });

  test('v1.58 큐: 6회 이상 연속 실패는 그 건만 격리한다', function () {
    var f = freshQueueStore(function (kind) {
      if (kind === 'update' && f.calls.update === 1) return Promise.reject(apiError('server', '서버가 잠시 응답하지 못했어요.', true, 500));
      return Promise.resolve({ ok: true });
    });
    var bad = ops()[1];
    bad.attempts = 5;          /* 이미 5번 실패한 건 — 이번이 6번째 */
    f.state.queue = [bad, ops()[2], ops()[3]];
    return f.store.actions._flush().then(function () {
      eq(f.state.syncBlocked.length, 1, '6회 실패한 건만 격리');
      eq(f.state.syncBlocked[0].op.clientId, 'c2', '그 건');
      eq(f.state.syncBlocked[0].op.attempts, 6, '6번째 실패 기록');
      eq(f.state.queue.length, 0, '뒤 건은 그대로 전송');
      eq(f.calls.update, 3, '세 번 시도(막힌 1 + 정상 2)');
    });
  });

  test('v1.58 큐: 네트워크·오프라인 실패는 6회를 넘겨도 격리하지 않는다', function () {
    var f = freshQueueStore(function () {
      return Promise.reject(apiError('network', '네트워크에 연결하지 못했어요. 잠시 뒤 다시 시도할게요.', true));
    });
    var op = ops()[1];
    op.attempts = 8;
    f.state.queue = [op, ops()[2]];
    return f.store.actions._flush().then(function () {
      eq(f.state.syncBlocked.length, 0, '격리하지 않음');
      eq(f.state.queue.length, 2, '대기열 그대로');
      eq(f.state.syncState, 'error', '연결되면 다시 보낼 상태');
      eq(f.state.syncErrorKind, 'net', '네트워크 오류');
      eq(f.calls.update, 1, '한 번 실패하고 멈춤');
    });
  });

  test('v1.58 큐: 영구/일시 오류 판정 규칙', function () {
    var f = freshQueueStore(function () { return Promise.resolve({ ok: true }); });
    var rules = f.store.actions._queueRules();
    eq(rules.isPermanentError(apiError('forbidden', '권한', false, 403)), true, '403 영구');
    eq(rules.isPermanentError(apiError('bad_row', '행', false)), true, '잘못된 행 영구');
    eq(rules.isPermanentError(apiError('conflict', '이미 저장', false)), true, '중복 영구');
    eq(rules.isPermanentError(apiError('42501', 'RLS', false)), true, 'RLS(42501) 영구');
    eq(rules.isPermanentError(apiError('request', '잘못된 요청', false, 400)), true, '400 영구');
    eq(rules.isPermanentError(apiError('network', '연결', true)), false, '네트워크는 아님');
    eq(rules.isPermanentError(apiError('server', '서버', true, 500)), false, '500은 재시도');
    eq(rules.isPermanentError(apiError('server', '서버', true, 500), { attempts: 6 }), true, '6회면 격리');
    eq(rules.isPermanentError(apiError('network', '연결', true), { attempts: 9 }), false, '네트워크는 6회 넘어도 아님');
    eq(rules.isPermanentError(apiError('session', '세션', false, 401)), false, '인증은 격리 대신 안내');
    eq(rules.isAuthError(apiError('session', '', false, 401)), true, '401 인증');
    eq(rules.isAuthError(apiError('server', 'jwt expired', true)), true, 'JWT 만료 문구');
    eq(rules.isAuthError(apiError('network', '연결', true)), false, '네트워크는 인증 아님');
    eq(rules.errorKind(apiError('bad_row', '', false)), 'data', '잘못된 행 종류');
    eq(rules.errorKind(apiError('forbidden', '', false, 403)), 'perm', '권한 종류');
    eq(rules.errorKind(apiError('network', '', true)), 'net', '네트워크 종류');
  });

  test('v1.58 큐: 대기 중 비우기는 대기열·격리만 비우고 서버 기록은 건드리지 않는다', function () {
    var f = freshQueueStore(function () { return Promise.reject(apiError('forbidden', '권한', false, 403)); });
    f.state.queue = ops();
    return f.store.actions._flush().then(function () {
      ok(f.state.syncBlocked.length >= 1, '격리 생김');
      var before = f.calls.update;
      var res = f.store.actions.clearQueue();
      eq(res.ok, true, '결과');
      eq(f.state.queue.length, 0, '대기열 비움');
      eq(f.state.syncBlocked.length, 0, '격리 비움');
      eq(f.state.syncError, null, '오류 문구 비움');
      eq(f.state.syncState, 'idle', '대기 아님');
      eq(f.calls.remove, 0, '서버 삭제 요청 없음');
      eq(f.calls.update, before, '서버 요청 없음');
      eq(JSON.stringify(U.readJSON('bm_queue_v1', [])), '[]', '기기에도 비움');
    });
  });

  /* =========================================================
   * 4. 화면 — netbar 원인 표시 · MY 대기열/오류/비우기
   * ========================================================= */

  test('v1.58 화면: 동기화 막대가 인증 만료와 건너뛴 저장을 한 줄로 알린다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    includes(app, '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', '인증 만료 문구');
    includes(app, '서버가 받지 못해 건너뛰었어요', '건너뛴 저장 문구');
    includes(app, 'data-net-dead', '건너뛴 저장 다시 보내기 버튼');
    includes(app, 'retryBlocked', '격리 다시 보내기 연결');
    includes(app, 'netBarText: netBarText', '테스트·디버그용 공개');
    includes(app, 'syncErrorKind', '오류 종류를 읽는다');
  });

  test('v1.58 화면: MY › 데이터에 대기열 건수·오류 내용·대기 중 비우기가 보인다', function () {
    if (!hasNode) return;
    var state = stateOf([rec()], {
      mode: 'supabase', syncState: 'error', lastSync: '11/23 09:10',
      syncError: '서버 권한을 확인하지 못했어요. 이 저장 1건은 건너뛰고 나머지는 그대로 보냈어요.',
      syncErrorKind: 'perm',
      queue: [{ kind: 'update', id: 'r9', cells: {} }],
      syncBlocked: [{ op: { kind: 'append', row: [] }, kind: 'perm', code: 'forbidden', message: '권한', at: '11/23 09:10' }]
    });
    var html = BM.views.my.render(state);
    includes(html, '대기 중인 저장', '대기열 이름');
    includes(html, '건너뛴 저장', '격리 이름');
    includes(html, '대기 중 비우기', '비우기 버튼');
    includes(html, 'data-act="clear-queue"', '비우기 배선');
    includes(html, 'data-act="retry-dead"', '격리 다시 보내기');
    includes(html, 'data-sync-error', '오류 내용 자리');
    includes(html, '서버 권한을 확인하지 못했어요', '마지막 오류 내용');
    includes(html, '서버가 받지 못했어요', '오류 제목');
    includes(html, 'data-sync-alert', '고급 밖 한 줄 안내');
    includes(html, '마지막 동기화 11/23 09:10', '마지막 동기화 시각');

    /* 인증 만료는 '다시 로그인하기'까지 */
    var auth = stateOf([rec()], {
      mode: 'supabase', syncState: 'error',
      syncError: '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', syncErrorKind: 'auth',
      queue: [{ kind: 'update', id: 'r9', cells: {} }], syncBlocked: []
    });
    var ahtml = BM.views.my.render(auth);
    includes(ahtml, '로그인이 필요해요', '인증 오류 제목');
    includes(ahtml, '다시 로그인하기', '로그인 버튼');
    includes(ahtml, '로그인 세션이 만료됐어요', '원인 문구');

    /* 깨끗한 상태 — 비울 것이 없다고 알려 준다 */
    var clean = BM.views.my.render(stateOf([rec()], { mode: 'supabase' }));
    includes(clean, '보내지 못한 저장이 없어요', '빈 상태 안내');
    excludes(clean, 'data-sync-alert', '경고 줄 없음');

    var my = readRoot('js/views/my.js');
    includes(my, 'UI.confirm', '비우기는 한 번 확인');
    includes(my, 'clearQueue', '비우기 연결');
    includes(my, 'retryBlocked', '격리 다시 보내기 연결');
  });

  test('v1.58 스타일: 색상·디자인 칩과 동기화 블록 스타일이 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.sc__pals', '.sc__pal', '.sc__pal.is-on', '.sc__pal--night i', '.sc__pal--court i',
      '.sc__pal--sunset i', '.sc__pal--sakura i', '.sc__pal--gold i', '.sc__layouts', '.sc__layout.is-on',
      '.syncbox', '.syncbox__row', '.syncbox__err', '.syncbox__alert'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    includes(css, 'repeat(5, 1fr)', '색상 5칸 한 줄');
    includes(css, 'repeat(3, 1fr)', '디자인 3칸 한 줄');
  });

  /* =========================================================
   * 5. 보호 · 보안 · 버전
   * ========================================================= */

  test('v1.58 보호: 5개 탭·v1.57 기능이 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');
    eq(D.CONDITION_BANDS.length, 5, 'v1.56 컨디션 5단계 유지');
    eq(SC().MODES.length, 2, '공유 카드 두 모드 유지');
    eq(SC().STYLES.length, 3, '공유 카드 세 출력 유지');
    eq(SC().RESULTS.length, 4, '성적 4종 유지');
    includes(readRoot('js/views/log.js'), 'data-act="share-log"', '커뮤니티 공유 유지');
    includes(readRoot('js/sharecard.js'), 'icons/icon-192.png', '로고 워터마크 유지');
    includes(readRoot('js/sharecard.js'), 'navigator.canShare', '공유 시트 유지');
    var html = BM.views.my.render(stateOf([rec()]));
    includes(html, '인스타 공유 카드', 'MY 공유 카드 입구');
  });

  test('v1.58 보안: 새 화면도 이스케이프를 거치고 CSP는 그대로다', function () {
    if (!hasNode) return;
    var sc = readRoot('js/sharecard.js');
    includes(sc, 'U.esc(', '이스케이프');
    excludes(sc, 'eval(', 'eval 없음');
    excludes(sc, "innerHTML = '<", '사용자 글자를 그대로 넣지 않음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
    includes(csp, "object-src 'none'", 'object 잠금');
    includes(csp, "form-action 'self'", 'form 잠금');
  });

  test('v1.58 문구: 예시에 실존 선수 이름을 쓰지 않는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js') + readRoot('js/views/my.js') + readRoot('js/store.js') + readRoot('app.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(src, name, name + ' 없음');
    });
    SC()._setState(uiState({ mode: 'comp', contest: '○○시 오픈 대회' }));
    excludes(SC()._sheetBody(ctxOf(stateOf([rec()]))), '김원호', '시트 예시');
  });

  test('v1.58 버전: sw · app · index · TWA가 함께 bm-v1.58.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.58.0'", 'sw.js');
    includes(app, "version: 'v1.58.0'", 'app.js');
    includes(index, 'styles.css?v=20261123-2', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.58.0', 'TWA 이름');
    eq(twa.appVersion, '1.58.0', 'TWA 버전');
    eq(twa.appVersionCode, 52, 'TWA 코드');
    includes(sw, 'bm-v1.58.0', 'sw 변경 이력');
    includes(sw, '인스타 카드 색·디자인', 'sw 변경 이력 내용');
    var run = readRoot('test/run.js');
    includes(run, 'test/v158.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
