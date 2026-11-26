/* ============================================================
 * test/v181.test.js — bm-v1.86.0
 *   🏸 실제 배드민턴 라켓 3D · 바디 4종 · 등급 · 효과(연출) · 줄 갈고 며칠째
 *
 *  1) 바디 4종 — 실제 비율(헤드:샤프트:그립 ≈ 25:22:20), 모델마다 실루엣·프레임 두께·데칼이 다르다
 *  2) 등급 — 일반/레어/에픽/레전드, 파츠·바디·효과 가격이 등급을 따라간다
 *  3) 효과 — 색이 아니라 연출 5종, 3D·헤더 미니·매칭 카드·공유 카드에 함께 그려진다
 *  4) 3D — 프레임 단면·거트 17×19·끊어진 줄·부위 탭(거트/테두리/그립)
 *  5) 줄 갈고 며칠째 — D+0·교체까지 N일·교체 시기(끊어짐)·미등록 안내와 원탭 복구
 *  6) 버전 · 보호 — sw/app/push/스타일 캐시/TWA/README/테스트 목록, 5탭·26칸·하트 RPC
 *  7) 실명 — 실존 선수·브랜드 이름 없음
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

  var RC = BM.racketcustom;

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function ymdAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + '-' + (mm.length < 2 ? '0' + mm : mm) + '-' + (dd.length < 2 ? '0' + dd : dd);
  }

  function stateOf(rows, gear) {
    rows = rows || [];
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null } },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchTab: 'find', matchStarted: false, matchSort: 'score',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', lastSavedLog: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (gear) st.me.theme = { theme: 'th_night', gear: gear };
    return st;
  }

  function mockCanvas() {
    var log = { texts: [], ops: [], fills: [], strokes: 0, arcs: 0 };
    function grad() { return { addColorStop: function () {} }; }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      globalAlpha: 1, shadowColor: '', shadowBlur: 0, letterSpacing: '0px', lineCap: '', lineJoin: '',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function () { log.ops.push('fillRect'); },
      rect: function () {}, strokeRect: function () {},
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      arc: function () { log.arcs++; }, arcTo: function () {}, ellipse: function () { log.arcs++; },
      quadraticCurveTo: function () {}, bezierCurveTo: function () {},
      rotate: function () { log.ops.push('rotate'); }, translate: function () {}, scale: function () {},
      save: function () {}, restore: function () {}, clip: function () {},
      fill: function () { log.fills.push(g.fillStyle); }, stroke: function () { log.strokes++; },
      createLinearGradient: function () { return grad(); },
      createRadialGradient: function () { return grad(); },
      measureText: function (text) { return { width: String(text).length * 18 }; },
      fillText: function (text) { log.texts.push(String(text)); },
      drawImage: function () {}
    };
    return { canvas: { width: 0, height: 0, getContext: function () { return g; } }, ctx: g, log: log };
  }

  /* ============================================================
   * 1. 바디 4종 — 실제 비율 · 모델별 실루엣
   * ============================================================ */

  test('v1.81 바디: 파워 77 · 스피드 에어로 · 컨트롤 아크 · 스매시 맥스 4종, 첫 모델은 무료', function () {
    eq(RC.BODY_IDS.join(','), 'power77,aero,control,smash', '네 모델');
    eq(RC.DEFAULT_BODY, 'power77', '기본은 파워 77');
    RC.BODY_IDS.forEach(function (id) {
      var b = RC.bodyOf(id);
      eq(b.id, id, id + ' 자기 자신');
      ok(b.name && b.note && b.profile.length >= 10, id + ' 이름·특징·실루엣');
    });
    ok(RC.bodyOf('power77').free, '파워 77 무료');
    ok(!RC.bodyOf('smash').free, '스매시 맥스는 포인트로');
  });

  test('v1.81 비율: 헤드:샤프트:그립 ≈ 25:22:20 (전체 약 675mm)', function () {
    var g = RC.geomOf({ body: 'power77' });
    var head = g.ry * 2, shaft = g.gripY0 - g.ry, grip = g.gripLen;
    var total = head + shaft + grip;
    ok(Math.abs(head / total - 25 / 67) < 0.05, '헤드 비중 ' + (head / total).toFixed(3));
    ok(Math.abs(grip / total - 20 / 67) < 0.06, '그립 비중 ' + (grip / total).toFixed(3));
    ok(total > 620 && total < 700, '전체 길이 ' + total);
    eq(g.gripY1 - g.gripY0, g.gripLen, '그립 길이 그대로');
  });

  test('v1.81 비율: 모델마다 헤드 크기·프레임 두께·그립 길이·샤프트 길이가 다르다', function () {
    var p = RC.geomOf({ body: 'power77' }), a = RC.geomOf({ body: 'aero' });
    var c = RC.geomOf({ body: 'control' }), s = RC.geomOf({ body: 'smash' });
    ok(s.rx < p.rx && s.ry < p.ry, '스매시는 콤팩트 헤드');
    ok(s.hoop > p.hoop, '스매시 프레임이 더 두껍다');
    ok(s.gripLen < p.gripLen && s.shaftLen > p.shaftLen, '스매시는 짧은 그립·긴 샤프트');
    ok(c.gripLen > p.gripLen, '컨트롤은 롱 그립');
    ok(a.hoop < p.hoop, '에어로는 얇은 프레임');
    ok(a.rx < p.rx, '에어로는 살짝 작은 헤드');
    ok(p.accent !== a.accent && a.accent !== s.accent, '모델마다 포인트 색');
    ok(p.decal !== a.decal && a.decal !== s.decal, '모델마다 데칼');
  });

  test('v1.81 데칼: 모델마다 프레임 데칼 위치가 다르고, 그 자리에서 포인트 색을 쓴다', function () {
    var gm = RC.geomOf({ body: 'power77' });
    var hit = null, miss = null;
    for (var a = 0; a < 6.2; a += 0.05) {
      var p = { x: Math.cos(a), y: Math.sin(a) };
      var d = RC.decalAt(gm, p);
      if (d && !hit) hit = { a: a, c: d };
      if (!d && !miss) miss = { a: a };
    }
    ok(hit && hit.c === gm.accent, '파워 77 사선 데칼 색');
    ok(miss, '데칼이 없는 구간도 있다');
    var gmS = RC.geomOf({ body: 'smash' });
    var dS = RC.decalAt(gmS, { x: 0, y: 1 });
    ok(dS === gmS.accent, '스매시는 헤드 아래쪽 블록 데칼');
  });

  /* ============================================================
   * 2. 등급
   * ============================================================ */

  test('v1.81 등급: 일반·레어·에픽·레전드 4단계와 색', function () {
    eq(RC.RARITY_IDS.join(','), 'common,rare,epic,legend', '네 등급');
    eq(RC.rarityOf('common').name, '일반', '일반');
    eq(RC.rarityOf('rare').name, '레어', '레어');
    eq(RC.rarityOf('epic').name, '에픽', '에픽');
    eq(RC.rarityOf('legend').name, '레전드', '레전드');
    eq(RC.rarityOf('없는등급').id, 'common', '모르는 등급은 일반');
    ok(RC.rarityOf('common').rank < RC.rarityOf('rare').rank, '등급 순서');
    ok(RC.rarityOf('legend').rank === 3, '레전드가 가장 높다');
  });

  test('v1.84 등급: 해금 가격이 등급을 따라 하트 1~5개다(일반 1 · 레어 2 · 에픽 3 · 레전드 5)', function () {
    var band = { common: [1, 1], rare: [2, 2], epic: [3, 3], legend: [4, 5] };
    var checked = 0;
    RC.SLOTS.forEach(function (slot) {
      RC.itemsOf(slot).forEach(function (it) {
        var cost = RC.priceOf(slot, it.id);
        if (!cost) { ok(it.free || it.id === 'none', slot + ':' + it.id + ' 무료는 기본 파츠뿐'); checked++; return; }
        /* 스매시 연출은 값이 카드에 직접 적혀 있습니다(불꽃 2 · 얼음·번개 3) */
        if (it.smash) { ok(cost >= 2 && cost <= 3, slot + ':' + it.id + ' 스매시 하트 ' + cost); checked++; return; }
        var range = band[it.rarity];
        ok(range, slot + ':' + it.id + ' 등급 있음');
        ok(cost >= range[0] && cost <= range[1], slot + ':' + it.id + ' ' + it.rarity + ' 하트 ' + cost);
        checked++;
      });
    });
    RC.BODY_IDS.forEach(function (id) {
      var b = RC.BODIES[id];
      var cost = RC.priceOf('body', id);
      if (b.free) { eq(cost, 0, id + ' 무료'); checked++; return; }
      var range = band[b.rarity];
      ok(cost >= range[0] && cost <= range[1], id + ' 바디 하트 ' + cost);
      checked++;
    });
    ok(checked >= 30, '검사한 카드 ' + checked);
  });

  test('v1.81 등급: 입고 있는 것 중 가장 높은 등급이 장착 정보에 드러난다', function () {
    var basic = RC.blankCustom();
    eq(RC.topRarity(basic).id, 'common', '기본은 일반');
    var legend = RC.normalizeCustom({ effect: 'prism', unlocked: ['effect:prism'] });
    eq(RC.topRarity(legend).id, 'legend', '프리즘을 끼면 레전드');
    var rare = RC.normalizeCustom({ string: 'gold', unlocked: ['string:gold'] });
    eq(RC.topRarity(rare).id, 'rare', '골드 스트링은 레어');
    var html = RC.sheetBody(stateOf([], { custom: legend }));
    includes(html, 'rkrar rkrar--legend', '등급 배지');
    includes(html, '레전드 등급', '등급 이름');
  });

  /* ============================================================
   * 3. 효과(연출)
   * ============================================================ */

  test('v1.84 효과: 효과 칸에 8종, 없음은 무료 · 나머지는 하트 2~5개', function () {
    eq(RC.SLOTS.indexOf('effect'), 5, '여섯 번째 칸');
    var list = RC.itemsOf('effect');
    /* bm-v1.86.0 — 하트로 여는 스페셜 스매시(불꽃·얼음·번개)까지 여덟 종 */
    eq(list.length, 8, '여덟 종');
    eq(list.filter(function (it) { return it.smash; }).length, 3, '스매시 연출 3종');
    var byId = {};
    list.forEach(function (it) { byId[it.id] = it; });
    eq(byId.none.rarity, 'common', '없음 일반');
    ok(byId.none.free, '없음 무료');
    eq(byId.speed.rarity, 'rare');
    eq(RC.priceOf('effect', 'speed'), 2);
    eq(byId.spark.rarity, 'epic');
    eq(RC.priceOf('effect', 'spark'), 3);
    eq(byId.blaze.rarity, 'epic');
    eq(RC.priceOf('effect', 'blaze'), 3);
    eq(byId.prism.rarity, 'legend');
    eq(RC.priceOf('effect', 'prism'), 5);
    eq(RC.PARTS.effect.label, '효과');
    ok(RC.PARTS.effect.fx, '연출 칸');
  });

  test('v1.81 효과: 꾸미기 시트에 효과 탭과 다섯 카드가 있고 등급 배지가 붙는다', function () {
    var html = RC.sheetBody(stateOf());
    includes(html, 'data-rk-slot="effect"', '효과 탭');
    includes(html, 'data-rk-part="effect:prism"', '프리즘 카드');
    includes(html, 'data-rk-part="effect:speed"', '스피드 링 카드');
    includes(html, 'is-r-legend', '레전드 글로우');
    includes(html, 'is-r-epic', '에픽 글로우');
    includes(html, '❤ 5', '레전드 가격');
  });

  test('v1.81 효과: 3D 캔버스에서 실제로 그려진다(연출마다 그리는 횟수가 다르다)', function () {
    var v = { yaw: -0.4, pitch: 0.12, k: 0.8, cx: 200, cy: 260, mid: RC.geomOf({}).mid, phase: 1.4 };
    var counts = {};
    ['none', 'speed', 'spark', 'blaze', 'prism'].forEach(function (fx) {
      var m = mockCanvas();
      RC.draw3d(m.ctx, v, { effect: fx, unlocked: ['effect:' + fx] }, 'prime', 400, 520);
      counts[fx] = m.log.strokes + m.log.fills.length;
    });
    ok(counts.none > 50, '기본 라켓도 그린다: ' + counts.none);
    ok(counts.speed > counts.none, '스피드 링이 더 그린다: ' + counts.speed + ' > ' + counts.none);
    ok(counts.blaze > counts.none, '불꽃이 더 그린다: ' + counts.blaze);
    ok(counts.prism > counts.none, '프리즘이 더 그린다: ' + counts.prism);
  });

  test('v1.81 효과: 헤더 미니 라켓·매칭 카드·공유 카드에도 함께 그려진다', function () {
    var withFx = RC.svg({ effect: 'blaze', unlocked: ['effect:blaze'] });
    var plain = RC.svg({ effect: 'none' });
    ok(withFx.length > plain.length, 'SVG에 연출이 더해진다');
    includes(withFx, 'ffb347', '불꽃 색');
    includes(RC.svg({ effect: 'prism', unlocked: ['effect:prism'] }), 'f2c14e', '프리즘 별');
    includes(RC.svg({ effect: 'spark', unlocked: ['effect:spark'] }), '8fd0ff', '스파크');
    includes(RC.svg({ effect: 'speed', unlocked: ['effect:speed'] }), '9fe6ff', '스피드 링');
    var st = stateOf([], { custom: { effect: 'blaze', unlocked: ['effect:blaze'] } });
    var card = RC.personHtml(st, BM.seed.ME);
    includes(card, 'ffb347', '매칭 카드 라켓에도');
    /* 공유 카드(캔버스) */
    ['speed', 'spark', 'blaze', 'prism', 'none'].forEach(function (fx) {
      var m = mockCanvas();
      RC.drawRacket(m.ctx, 200, 240, 320, { effect: fx, unlocked: ['effect:' + fx] },
        { level: 'prime', rot: -0.5, alpha: 0.99, rim: true });
      ok(m.log.strokes > 5, '공유 카드 라켓 ' + fx);
    });
  });

  /* ============================================================
   * 4. 3D — 단면 · 거트 · 끊어짐 · 부위 탭
   * ============================================================ */

  test('v1.81 3D: 헤드 실루엣이 닫힌 곡선이고 아래로 갈수록 좁아진다', function () {
    var gm = RC.geomOf({ body: 'power77' });
    var loop = RC.headLoop(gm, 3);
    ok(loop.length >= 60, '촘촘한 실루엣 ' + loop.length);
    var topW = 0, botW = 0;
    loop.forEach(function (p) {
      if (p.y < -gm.ry * 0.5) topW = Math.max(topW, Math.abs(p.x));
      if (p.y > gm.ry * 0.75) botW = Math.max(botW, Math.abs(p.x));
    });
    ok(botW < topW * 0.9, '헤드 아래(목)가 좁다: ' + botW.toFixed(1) + ' < ' + topW.toFixed(1));
    ok(topW <= gm.rx + 2, '가로가 rx를 넘지 않는다');
  });

  test('v1.81 3D: 거트는 세로 17 × 가로 19줄이고, 끊어지면 가운데 줄이 갈라진다', function () {
    var gm = RC.geomOf({ body: 'power77' });
    var ok2 = RC.stringChords(gm, 'ok');
    ok(ok2.mains.length >= 16, '세로줄 ' + ok2.mains.length);
    ok(ok2.crosses.length >= 18, '가로줄 ' + ok2.crosses.length);
    var broken = RC.stringChords(gm, 'broken');
    ok(broken.mains.length > ok2.mains.length, '끊어진 줄은 좌우 두 동강');
    var mid = broken.mains[Math.floor(broken.mains.length / 2)];
    ok(mid.length >= 2, '끊어진 조각이 남는다');
  });

  test('v1.81 3D: 모델을 바꿔도 거트·테두리·그립이 정확히 잡힌다', function () {
    RC.BODY_IDS.forEach(function (id) {
      var gm = RC.geomOf({ body: id });
      var v = { yaw: -0.35, pitch: 0.1, k: 1, cx: 150, cy: 220, mid: gm.mid };
      var head = RC.project3({ x: 0, y: 0, z: 0 }, v);
      eq(RC.hitSlot(head.x, head.y, v, { body: id }), 'string', id + ' 헤드 가운데 → 거트');
      var grip = RC.project3({ x: 0, y: gm.gripY0 + gm.gripLen * 0.5, z: 0 }, v);
      eq(RC.hitSlot(grip.x, grip.y, v, { body: id }), 'grip', id + ' 손잡이 → 그립');
      var rim = RC.project3({ x: gm.rx, y: 0, z: 0 }, v);
      eq(RC.hitSlot(rim.x, rim.y, v, { body: id }), 'frame', id + ' 테두리 → 프레임');
      var shaft = RC.project3({ x: 0, y: gm.throatY + 10, z: 0 }, v);
      eq(RC.hitSlot(shaft.x, shaft.y, v, { body: id }), 'frame', id + ' 샤프트 → 테두리');
      eq(RC.hitSlot(-900, -900, v, { body: id }), '', id + ' 바깥은 아무것도 아님');
    });
  });

  test('v1.81 3D: 꾸미기 시트에 바디 4칩과 여섯 부위 탭이 있다', function () {
    var html = RC.sheetBody(stateOf());
    eq((html.match(/data-rk-body="/g) || []).length, 4, '바디 칩 4개');
    includes(html, 'data-rk-body="smash"', '스매시 맥스 칩');
    eq((html.match(/class="rk3d__tab[" ]/g) || []).length, 6, '부위 탭 6개');
    includes(html, '파워 77 바디', '지금 바디');
  });

  test('v1.81 3D: 바디·색을 바꿔도 보던 각도는 그대로다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racketcustom.js');
    includes(js, 'viewMem', '각도 기억');
    includes(js, 'function mount3d(', '3D 붙이기');
    includes(js, 'requestAnimationFrame', '자동 회전');
    includes(js, 'pointermove', '끌어서 회전');
    includes(readRoot('styles.css'), 'touch-action: none', '스크롤 대신 회전');
  });

  /* ============================================================
   * 5. 줄 갈고 며칠째
   * ============================================================ */

  test('v1.81 줄: 교체일을 안 적었으면 눌러서 기록하라고 안내한다', function () {
    var a = RC.stringAge(stateOf([]));
    eq(a.state, 'nodate', '미등록');
    includes(a.main, '줄 교체일 미등록', '문구');
    includes(a.sub, '눌러서 기록', '탭 안내');
    var html = RC.stringAgeHtml(stateOf([]));
    includes(html, 'data-rk-gear="1"', '라켓 기록 열기');
    includes(html, 'data-rk-restring="1"', '오늘 갈았어요');
  });

  test('v1.81 줄: 오늘 갈면 D+0, 14일 지나면 교체까지 16일', function () {
    var today = RC.stringAge(stateOf([], { strungAt: U.ymd(), cycleDays: 30 }));
    eq(today.state, 'new', '오늘 교체');
    includes(today.main, '오늘 새 줄로 갈았어요', 'D+0 문구');
    var d14 = RC.stringAge(stateOf([], { strungAt: ymdAgo(14), cycleDays: 30 }));
    eq(d14.state, 'ok', '14일째는 아직 괜찮음');
    eq(d14.days, 14, 'D+14');
    eq(d14.left, 16, '16일 남음');
    includes(d14.main, '줄 갈고 14일째', '며칠째');
    includes(d14.sub, '16일 남음', '남은 날');
  });

  test('v1.81 줄: 교체 주기가 다 되면 끊어짐 + 안내 문구, 헤더도 끊어진 모습', function () {
    var st = stateOf([], { strungAt: ymdAgo(30), cycleDays: 30 });
    var a = RC.stringAge(st);
    eq(a.state, 'due', '교체 시기');
    includes(a.sub, '줄이 끊어졌어요', '안내');
    eq(RC.conditionOf(st).level, 'broken', '3D·헤더 줄이 끊어짐');
    includes(RC.headerHtml(st), 'stroke="#ff6b5e"', '헤더 미니 라켓 끊어진 표시');
    var late = RC.stringAge(stateOf([], { strungAt: ymdAgo(33), cycleDays: 30 }));
    includes(late.main, '줄 갈고 33일째', '지난 날');
    includes(late.sub, '끊어졌어요', '3일 지남 안내');
    includes(RC.stringAgeHtml(stateOf([], { strungAt: ymdAgo(33), cycleDays: 30 })), 'rkage--due', '빨간 배지');
  });

  test('v1.81 줄: 오늘 갈았어요를 누르면 D+0으로 돌아오고 줄이 다시 팽팽해진다', function () {
    var rows = [];
    var st = stateOf(rows, { strungAt: ymdAgo(40), cycleDays: 30 });
    eq(RC.conditionOf(st).level, 'broken', '전에는 끊어짐');
    /* 화면의 원탭 복구와 같은 저장 */
    var gear = BM.gear.normalizeGear({ strungAt: U.ymd(), cycleDays: 30 });
    st.me.theme = { theme: 'th_night', gear: gear };
    eq(RC.stringAge(st).state, 'new', 'D+0');
    eq(RC.conditionOf(st).level, 'prime', '다시 팽팽');
    var js = readRoot('js/racketcustom.js');
    includes(js, 'data-rk-restring', '원탭 버튼');
    includes(js, "setGear({ strungAt: U.ymd() })", '오늘로 저장');
  });

  test('v1.81 줄: 줄 갈고 며칠째 줄이 3D 라켓 바로 아래에 붙는다', function () {
    var html = RC.sheetBody(stateOf([], { strungAt: ymdAgo(9), cycleDays: 30 }));
    var i3d = html.indexOf('rk3d__cv');
    var iAge = html.indexOf('rkage');
    ok(i3d >= 0 && iAge > i3d, '3D 캔버스 아래');
    includes(html, '줄 갈고 9일째', '며칠째');
    includes(readRoot('styles.css'), '.rkage', '한 줄 배지 CSS');
  });

  /* ============================================================
   * 6. 버전 · 보호
   * ============================================================ */

  test('v1.81 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.86.0'", 'sw.js');
    includes(readRoot('sw.js'), "'./js/racketcustom.js'", 'sw 캐시');
    includes(readRoot('app.js'), "version: 'v1.86.0'", 'app.js');
    includes(readRoot('js/push.js'), "version: 'v1.86.0'", 'push.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-8', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.86.0', 'TWA 이름');
    eq(twa.appVersionCode, 80, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.86.0', 'README');
    includes(readRoot('test/run.js'), 'test/v181.test.js', '테스트 목록');
  });

  test('v1.81 보호: 5개 탭 · 시트 26칸 · 하트 RPC · 줄 교체 알림이 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "id: '" + id + "'", '탭 ' + id);
    });
    eq(BM.domain.COLS.length, 26, '시트 26칸');
    includes(readRoot('js/store.js'), "rpc('heart_spend'", '하트 RPC');
    eq(D.HEART_RULES.MATCH_COST, 2, '매칭 2하트');
    includes(readRoot('js/gear.js'), 'notifyIfDue', '줄 교체 알림');
    var st = stateOf(BM.fixtures.demo());
    includes(BM.views.log.render(st), 'data-act="save-log"', '일지 저장');
    includes(BM.views.matching.render(st), 'data-match-tab="find"', '매칭 탭');
  });

  test('v1.81 저장: 바디·효과도 theme.gear.custom 한 칸에만 저장된다', function () {
    var c = RC.normalizeCustom({ body: 'aero', effect: 'spark', unlocked: ['body:aero', 'effect:spark'] });
    eq(c.body, 'aero', '바디');
    eq(c.effect, 'spark', '효과');
    var st = stateOf([], { custom: c });
    var g = BM.gear.gearOf(st.me);
    eq(g.custom.body, 'aero', '같은 칸');
    eq(g.custom.effect, 'spark', '효과도 같은 칸');
    var bad = RC.normalizeCustom({ body: 'no-such', effect: 'no-such' });
    eq(bad.body, 'power77', '모르는 바디는 기본');
    eq(bad.effect, 'none', '모르는 효과는 없음');
    var locked = RC.normalizeCustom({ body: 'smash' });
    eq(locked.body, 'power77', '열지 않은 바디는 입지 않는다');
  });

  /* ============================================================
   * 7. 실명
   * ============================================================ */

  test('v1.81 실명: 실존 선수·브랜드 이름이 코드·화면에 없다', function () {
    if (!hasNode) return;
    var blob = readRoot('js/racketcustom.js') + readRoot('js/sharecard.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) { excludes(blob, name, name + ' 없음'); });
    ['Yonex', '요넥스', 'Astrox', '아스트록스', 'Aerus', '리닝'].forEach(function (brand) {
      excludes(readRoot('js/racketcustom.js'), brand, brand + ' 없음');
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
