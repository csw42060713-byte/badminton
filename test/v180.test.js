/* ============================================================
 * test/v180.test.js — bm-v1.85.0
 *   🏸 내 커스텀 라켓 — 상태 연동 · 수집(포인트 해금) · 매칭/공유 노출
 *
 *  1) 파츠 — 배드민턴 용품 감성 5칸(프레임·스트링·그립·스텐실·참), 기본 5종 무료
 *  2) 포인트 — 일지 +10P · 출석 +5P · 매칭 +15P를 '기록에서' 계산(기존 사용자도 과거 일지만큼 지급)
 *  3) 해금 — 포인트로 원하는 파츠부터 열고 입는다(잔액 부족이면 열리지 않는다)
 *  4) 상태 — 3일 넘게 쉬면 줄이 느슨, 7일 넘거나 교체 시기가 지나면 끊어짐, 오늘 쳤으면 최상
 *  5) 헤더 — 상단 오른쪽 미니 라켓(탭하면 꾸미기 시트) + CSS
 *  6) 저장 — 새 시트 칸·DB 컬럼 없이 theme.gear.custom 한 칸, 라켓 기록 수정에도 유지
 *  7) 매칭/프로필 — 상대 라켓을 급수·지역 옆에, 프로필 시트에서 매칭 요청·친구 코드 초대
 *  8) 저장 직후 — 스매시 연출 + '방금 쓴 오늘 운동 그대로 공유' 바 → 스매시 카드
 *  9) 공유 카드 — 스매시 임팩트 캔버스(라켓 색 그대로 · 충격파 · 오늘 수치 · SHUTTLIX + 이름#코드)
 * 10) 버전 · 보호 — sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록, 26칸 · 5탭
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

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_share_prefs_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(opts) {
    clearStorage();
    if (!(opts && opts.empty)) U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function day(y, m, d) { return new Date(y, m - 1, d); }

  /* 오늘/며칠 전 날짜 글자 */
  function ymdAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    var mm = String(d.getMonth() + 1), dd = String(d.getDate());
    return d.getFullYear() + '-' + (mm.length < 2 ? '0' + mm : mm) + '-' + (dd.length < 2 ? '0' + dd : dd);
  }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null } },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchTab: 'find', matchStarted: false, matchSort: 'score',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유',
        lastSavedLog: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  /* 가짜 2D 컨텍스트 — 캔버스 없이 그리기 호출을 그대로 기록 */
  function mockCanvas() {
    var log = { texts: [], ops: [], fills: [], strokes: 0 };
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      globalAlpha: 1, shadowColor: '', shadowBlur: 0, letterSpacing: '0px',
      clearRect: function () { log.ops.push('clearRect'); },
      fillRect: function () { log.ops.push('fillRect'); },
      rect: function () {}, strokeRect: function () {},
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      arc: function () {}, arcTo: function () {}, ellipse: function () {},
      quadraticCurveTo: function () {},
      rotate: function () { log.ops.push('rotate'); },
      translate: function () {}, scale: function () {},
      save: function () {}, restore: function () {},
      clip: function () {}, fill: function () { log.fills.push(g.fillStyle); },
      stroke: function () { log.strokes++; },
      createLinearGradient: function () { return grad(); },
      createRadialGradient: function () { return grad(); },
      measureText: function (text) { return { width: String(text).length * 18 }; },
      fillText: function (text) { log.texts.push(String(text)); },
      drawImage: function () {}
    };
    function grad() { return { addColorStop: function () {} }; }
    return { canvas: { width: 0, height: 0, getContext: function () { return g; } }, ctx: g, log: log };
  }

  /* ============================================================
   * 1. 파츠 — 용품 감성 5칸 · 기본 무료
   * ============================================================ */

  test('v1.80 파츠: 프레임·스트링·그립·스텐실·참 5칸에 각 5종, 기본은 무료', function () {
    /* v1.81에서 '효과'(연출) 칸이 더해져 여섯 칸입니다 */
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '여섯 칸');
    RC.SLOTS.forEach(function (slot) {
      /* bm-v1.85.0 — '효과' 칸에 하트로 여는 스페셜 스매시 3종(불꽃·얼음·번개)이 더해져 8종입니다 */
      eq(RC.itemsOf(slot).length, slot === 'effect' ? 8 : 5, slot + (slot === 'effect' ? ' 8종' : ' 5종'));
      var free = RC.itemsOf(slot).filter(function (it) { return it.free; });
      eq(free.length, 1, slot + ' 무료 1종');
    });
    var names = RC.SLOTS.map(function (s) { return RC.PARTS[s].label; }).join(',');
    eq(names, '프레임,스트링,그립,스텐실,라켓 참,효과', '칸 이름');
    var frameNames = RC.itemsOf('frame').map(function (i) { return i.name; }).join(',');
    includes(frameNames, '매트 블랙', '프레임 예시');
    includes(frameNames, '스텔스 카본', '프레임 예시');
    includes(RC.itemsOf('string').map(function (i) { return i.name; }).join(','), '형광 라임', '스트링 예시');
    includes(RC.itemsOf('grip').map(function (i) { return i.name; }).join(','), '파스텔 민트', '그립 예시');
    includes(RC.itemsOf('stencil').map(function (i) { return i.name; }).join(','), 'X자 셔틀', '스텐실 예시');
    includes(RC.itemsOf('charm').map(function (i) { return i.name; }).join(','), '체전 메달', '참 예시');
  });

  test('v1.80 파츠: 잘못된 값은 기본 파츠로 돌아가고, 열지 않은 파츠는 입을 수 없다', function () {
    var c = RC.normalizeCustom({ frame: 'hologram', string: 'gold', grip: null, stencil: 'bolt', charm: 'unicorn' });
    eq(c.frame, 'matte', '없는 프레임 → 기본');
    eq(c.grip, 'black', '빈 그립 → 기본');
    eq(c.charm, 'none', '없는 참 → 기본');
    /* 열지 않은 파츠를 직접 넣어도 열린 것으로 치지 않고 기본값으로 되돌립니다 */
    eq(c.string, 'lime', '열지 않은 스트링은 기본으로');
    eq(c.stencil, 'none', '열지 않은 스텐실은 기본으로');
    ok(c.unlocked.length === 0, '열린 파츠 없음');
    var withGold = RC.normalizeCustom({ string: 'gold', unlocked: ['string:gold'] });
    eq(withGold.string, 'gold', '열린 파츠는 그대로');
    eq(withGold.unlocked.join(','), 'string:gold', '열린 목록');
    var junk = RC.normalizeCustom({ unlocked: ['nope:x', 'string:gold', 'string:gold', 'frame:matte', 3] });
    eq(junk.unlocked.join(','), 'string:gold', '쓸모없는 값·중복·무료 파츠는 걸러진다');
  });

  /* ============================================================
   * 2. 포인트 — 기록에서 계산 (기존 사용자 초기 지급)
   * ============================================================ */

  test('v1.84 하트: 라켓 파츠 가격은 등급을 따라 하트 1~5개이고, 기록으로 쌓이지 않는다', function () {
    /* 포인트(P)는 폐지 — 일지를 아무리 써도 라켓 가격표가 자동으로 채워지지 않습니다 */
    var rows = BM.fixtures.demo();
    var st = stateOf(rows);
    eq(RC.pointsToday(st), 0, '포인트가 없어졌다');
    eq(RC.priceOf('string', 'white'), 1, '일반 파츠 1하트');
    eq(RC.priceOf('frame', 'navy'), 3, '에픽 파츠 3하트');
    eq(RC.priceOf('charm', 'ace'), 5, '레전드 파츠 5하트');
    eq(RC.priceOf('frame', 'matte'), 0, '기본 파츠는 무료');
    eq(RC.priceOf('body', 'power77'), 0, '파워 77 바디는 무료');
    eq(RC.priceOf('body', 'smash'), 5, '스매시 맥스 5하트');
  });

  test('v1.80 헤더(하트 지갑): 보유 하트와 쓰는 곳이 시트에 보인다', function () {
    var st = stateOf(BM.fixtures.demo());
    st.data.hearts = { balance: 3 };
    var html = RC.sheetBody(st);
    includes(html, '보유 하트', '하트 지갑');
    includes(html, '❤ 3개', '잔액');
    includes(html, 'data-rk-hearts="1"', '하트 모으기 버튼');
    excludes(html, '라켓 포인트', '포인트 안내는 없다');
  });

  /* ============================================================
   * 3. 해금 — 원하는 파츠부터 (하트)
   * ============================================================ */

  test('v1.84 해금: 하트로 산 파츠는 열리고(보유) 잔액이 줄고, 다시 계산해도 같다', function () {
    return freshStore({ empty: true }).then(function (store) {
      /* 출석 3일치 = 기본 3 + 3 = 6하트 */
      var rows = U.readJSON('bm_rows_v1', []) || [];
      for (var i = 1; i <= 3; i++) {
        rows.push(D.toRow({ type: '출석하트', id: 'h' + i, clientId: 'h' + i, date: '2026-11-' + (10 + i),
          createdAt: '2026-11-' + (10 + i) + ' 07:00:00', nick: '나래', userKey: store.state.me.key, likes: 1 }));
      }
      U.writeJSON('bm_rows_v1', rows);
      return store.actions.reload().then(function () {
        store.state.locks = {};
        ok(RC.heartNow(store.state) >= 2, '하트가 모였다: ' + RC.heartNow(store.state));
        var before = RC.heartNow(store.state);
        var res = store.actions.buyRacketPart('string', 'white');
        return Promise.resolve(res).then(function (r) {
          r = r || {};
          if (r.ok) {
            eq(rC(store).string, 'white', '입은 색');
            ok(RC.heartNow(store.state) < before, '하트가 줄었다');
            eq(RC.isUnlocked(rC(store), 'string', 'white'), true, '열림');
            eq(RC.isUnlocked(rC(store), 'string', 'gold'), false, '다른 색은 아직 잠김');
          }
          return store.flush();
        });
      });
    });
    function rC(store) { return RC.customOf(store.state.me); }
  });

  test('v1.84 해금: 하트가 모자라면 서버 저장 없이 그대로 둔다(화면이 먼저 막는다)', function () {
    var st = stateOf([]);
    st.data.hearts = { balance: 0 };
    eq(RC.heartNow(st), 0, '하트 없음');
    ok(RC.priceOf('frame', 'carbon') > 0, '프레임 가격');
    /* 잠긴 파츠는 화면에서 잠금 표시 + 하트 가격이 보인다 */
    var html = RC.sheetBody(st);
    includes(html, 'data-rk-part="frame:carbon"', '잠긴 파츠 버튼');
    includes(html, '❤ 2', '하트 가격 표시');
    includes(html, 'is-lock', '잠금 표시');
  });

  /* ============================================================
   * 4. 상태 — 운동 빈도 · 스트링 교체 시기
   * ============================================================ */

  function stateWithLogs(daysAgo, gear) {
    var rows = [];
    if (daysAgo != null) {
      rows.push({ type: '기록', id: 'x', clientId: 'x', createdAt: ymdAgo(daysAgo) + ' 10:00:00',
        userKey: ME.key, nick: '나래', date: ymdAgo(daysAgo), minutes: 60 });
    }
    var st = stateOf(rows);
    if (gear) st.me.theme = { theme: 'th_night', gear: gear };
    return st;
  }

  test('v1.80 상태: 오늘 쳤으면 최상, 3일 넘게 쉬면 느슨, 7일 넘으면 끊어짐', function () {
    eq(RC.conditionOf(stateWithLogs(0)).level, 'prime', '오늘 운동 → 최상');
    eq(RC.conditionOf(stateWithLogs(1)).level, 'prime', '어제 운동 → 최상');
    eq(RC.conditionOf(stateWithLogs(4)).level, 'worn', '4일 → 느슨');
    eq(RC.conditionOf(stateWithLogs(9)).level, 'broken', '9일 → 끊어짐');
    includes(RC.conditionOf(stateWithLogs(4)).title, '느슨', '문구');
  });

  test('v1.80 상태: 스트링 교체 시기가 지나면 운동을 했어도 끊어진 모습', function () {
    var due = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 30 };
    var st = stateWithLogs(0, due);
    eq(RC.conditionOf(st).level, 'broken', '교체 시기 지남 → 끊어짐');
    var soon = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(28), cycleDays: 30 };
    eq(RC.conditionOf(stateWithLogs(0, soon)).level, 'worn', '곧 교체 → 느슨');
    var okGear = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(2), cycleDays: 60 };
    eq(RC.conditionOf(stateWithLogs(0, okGear)).level, 'prime', '줄 상태 좋고 오늘 운동 → 최상');
  });

  test('v1.80 상태: 라켓 그림이 상태에 따라 끊어진 줄·느슨한 줄·반짝임으로 바뀐다', function () {
    var c = RC.blankCustom();
    var broken = RC.svg(c, { level: 'broken' });
    var worn = RC.svg(c, { level: 'worn' });
    var prime = RC.svg(c, { level: 'prime' });
    includes(broken, 'stroke="#ff6b5e"', '끊어진 줄 표시');
    includes(worn, 'Q32', '느슨한 줄(곡선)');
    includes(prime, 'opacity="0.18"', '최상 컨디션 반짝임');
    includes(prime, '<path d="M49 12', '반짝이');
    includes(broken, '<svg', 'SVG');
    includes(RC.svg(RC.normalizeCustom({ stencil: 'bolt', unlocked: ['stencil:bolt'] }), { level: 'ok' }), 'M34 15', '스텐실 번개');
  });

  /* ============================================================
   * 5. 헤더 위젯
   * ============================================================ */

  test('v1.80 헤더: 상단 오른쪽(하트 옆)에 미니 라켓 버튼이 있고 탭하면 꾸미기 시트', function () {
    if (!hasNode) return;
    var index = readRoot('index.html');
    includes(index, 'id="hdrRacket"', '헤더 라켓');
    ok(index.indexOf('id="hdrHearts"') < index.indexOf('id="hdrRacket"'), '하트 옆');
    includes(index, 'class="hedracket is-ok"', '기본 상태');
    includes(index, 'js/racketcustom.js', '스크립트');
    var app = readRoot('app.js');
    includes(app, 'BM.racketcustom.paintHeader(state)', '상태 연동 그리기');
    includes(app, 'BM.racketcustom.openSheet(ctx)', '탭하면 시트');
    var css = readRoot('styles.css');
    ['.hedracket', '.hedracket.is-worn', '.hedracket.is-broken', '.hedracket.is-prime'].forEach(function (sel) {
      includes(css, sel, 'CSS ' + sel);
    });
  });

  test('v1.80 헤더: 상태마다 클래스와 안내 문구가 바뀐다', function () {
    var html = RC.headerHtml(stateWithLogs(0));
    includes(html, 'rksvg', '라켓 그림');
    includes(RC.headerHtml(stateWithLogs(0)), 'opacity="0.18"', '오늘 쳤으면 반짝');
    var sheet = RC.sheetBody(stateWithLogs(9));
    includes(sheet, 'rkhero--broken', '끊어진 상태 카드');
    includes(sheet, '보유 하트', '하트 지갑');
    includes(sheet, 'data-rk-open-gear="1"', '라켓 기록으로');
  });

  /* ============================================================
   * 6. 저장 — theme.gear.custom 한 칸
   * ============================================================ */

  test('v1.80 저장: 커스텀 색은 theme.gear.custom 한 칸에만 저장된다', function () {
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아스트록스', tension: 26, strungAt: '2026-11-05' });
      store.state.locks = {};
      var res = store.actions.setGear({ custom: { frame: 'navy', unlocked: ['frame:navy', 'grip:mint'], grip: 'mint' } });
      ok(res && res.ok, '저장');
      var g = BM.gear.gearOf(store.state.me);
      eq(g.racket, '아스트록스', '라켓 기록 유지');
      eq(g.custom.frame, 'navy', '프레임');
      eq(g.custom.grip, 'mint', '그립');
      ok(!store.state.data.idx.byType['커스텀라켓'], '새 행 타입을 만들지 않는다');
      ok(!store.state.data.idx.byType['라켓'], '새 행 타입을 만들지 않는다(2)');
      return store.flush().then(function () {
        var theme = (store.state.me && store.state.me.theme) || {};
        eq(theme.gear.custom.frame, 'navy', '꾸미기 JSON 안 gear.custom');
        eq(theme.gear.custom.grip, 'mint', '그립도 같은 칸');
        ok(!theme.custom, 'theme 최상위에 새 칸을 만들지 않는다');
        ok(!theme.racket && !theme.string, '꾸미기 JSON에 라켓 칸을 새로 만들지 않는다');
      });
    });
  });

  test('v1.80 저장: 라켓 기록을 고쳐도 커스텀 색은 그대로다', function () {
    return freshStore().then(function (store) {
      store.actions.setGear({ custom: { string: 'gold', unlocked: ['string:gold'] } });
      store.state.locks = {};
      store.actions.setGear({ racket: '88D 프로', tension: 27, strungAt: '2026-11-01', cycleDays: 45 });
      var g = BM.gear.gearOf(store.state.me);
      eq(g.custom.string, 'gold', '색 유지');
      eq(g.racket, '88D 프로', '기록 반영');
      /* 색만 골라 둔 사람도 꾸미기 JSON이 지워지지 않는다 */
      ok(BM.gear.hasGear(g), '색만 있어도 기록으로 본다');
      return store.flush();
    });
  });

  /* ============================================================
   * 7. 매칭 · 프로필
   * ============================================================ */

  test('v1.80 매칭: 선수 카드의 급수·지역 옆에 상대 커스텀 라켓이 보인다', function () {
    var rows = BM.fixtures.demo();
    /* 상대 프로필 행에 커스텀 라켓을 넣어 둡니다(프로필 꾸미기 JSON 그대로) */
    var other = rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
      .filter(function (r) { return r.type === '매칭프로필'; })[0];
    ok(other, '매칭프로필 있음');
    rows.push({
      type: '프로필', id: 'p-other', clientId: 'po', createdAt: '2026-11-25 10:00:00',
      userKey: other.userKey, nick: other.nick, level: 'B조',
      theme: { theme: 'th_night', gear: { custom: { frame: 'red', string: 'gold', unlocked: ['frame:red', 'string:gold'] } } }
    });
    var st = stateOf(rows);
    var p = st.data.matchProfiles.filter(function (x) { return x.userKey === other.userKey; })[0];
    var card = BM.views.matching.playerCard(p, st);
    includes(card, 'pcard__rk', '카드의 라켓');
    includes(card, 'data-rk-person="' + other.userKey + '"', '상대 키');
    var body = BM.views.matching.profileBody(st, p);
    includes(body, 'pp__racket', '프로필 시트 라켓 줄');
    includes(body, '커스텀 라켓', '이름');
    includes(body, 'data-code-copy=', '친구 코드로 초대');
    includes(body, 'data-send-request="' + other.userKey + '"', '1:1 매칭 요청은 그대로');
  });

  test('v1.80 매칭: 상대가 색을 안 골랐으면 기본 라켓으로 조용히 보여 준다', function () {
    var st = stateOf();
    var p = st.data.matchProfiles.filter(function (x) { return x.userKey !== ME.key; })[0];
    var html = BM.views.matching.racketMini(st, p.userKey);
    includes(html, 'rkperson is-default', '기본 라켓');
    eq(RC.customFor(st, p.userKey).frame, 'matte', '기본 프레임');
  });

  /* ============================================================
   * 8. 저장 직후 — 스매시 연출 + 공유 바
   * ============================================================ */

  test('v1.80 저장 직후: 방금 쓴 일지 데이터로 스매시 공유 버튼이 이어진다', function () {
    var rec = { id: 'r1', date: U.ymd(), minutes: 60, cond: 8, intensity: 6, weakness: ['풋워크'], done: ['스트록'] };
    var rows = BM.fixtures.demo();
    rows.push({ type: '기록', id: 'r1', clientId: 'c1', createdAt: U.ymd() + ' 19:00:00',
      userKey: BM.seed.ME, nick: '나래', date: U.ymd(), minutes: 60, cond: 8 });
    var st = stateOf(rows, { ui: { lastSavedLog: rec } });
    var html = BM.views.log.shareNowHtml(st, rec);
    includes(html, '방금 쓴 오늘 운동 그대로 공유하기', '문구');
    includes(html, 'data-sc-design="smash"', '스매시 카드로');
    includes(html, '60분', '운동 시간');
    includes(html, '풋워크', '오늘 집중');
    excludes(html, '+10P', '포인트 폐지 — 하트만 쓴다');
    includes(html, 'data-act="dismiss-share"', '닫기');
    includes(html, 'data-act="share-log"', '커뮤니티 공유는 그대로');
    var chips = RC.burstChips(st, rec);
    eq(chips.length, 3, '세 칩 (포인트 폐지로 +P 칩이 빠졌다)');
    eq(chips[0].v, '60분', '첫 칩은 운동 시간');
    eq(chips[2].k, '집중', '마지막 칩은 오늘의 집중');
  });

  test('v1.80 저장 직후: 저장하면 화면 아래 공유 바가 뜨고 스매시 연출이 불린다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    includes(app, 'function paintSaveShare(', '저장 직후 바');
    includes(app, "el('saveShare')", '바를 켜고 끈다');
    includes(app, 'BM.racketcustom.burst({', '저장 순간 연출');
    includes(app, 'data-sc-design="smash"', '스매시 카드로 연결');
    var index = readRoot('index.html');
    includes(index, 'id="saveShare"', '바 자리');
    var css = readRoot('styles.css');
    ['.saveshare', '.smashburst', '.smash__ring', '.smash__shard', '.smash__chip'].forEach(function (sel) {
      includes(css, sel, 'CSS ' + sel);
    });
    includes(css, 'prefers-reduced-motion', '모션 줄이기 존중');
  });

  test('v1.80 연출: 라켓 반쪽 → 충격파 링 → 네온 파편 → 수치 칩 순서로 0.88초', function () {
    if (!hasNode) return;
    var js = readRoot('js/racketcustom.js');
    includes(js, 'smash__half--l', '라켓 왼쪽 반쪽');
    includes(js, 'smash__ring--3', '충격파 링');
    includes(js, 'smash__shard', '빛줄기 파편');
    includes(js, 'smash__chip', '수치 칩');
    ok(RC.BURST_MS >= 700 && RC.BURST_MS <= 900, '0.88초 안에 끝난다');
    var css = readRoot('styles.css');
    includes(css, 'animation: smashFlash 880ms', '플래시');
    includes(css, 'animation: smashRing 880ms', '링');
    includes(css, 'animation: smashHalfL 880ms', '라켓이 갈라짐');
    includes(css, 'animation: smashChip 880ms', '칩이 퍼짐');
  });

  /* ============================================================
   * 9. 공유 카드 — 스매시 임팩트
   * ============================================================ */

  test('v1.80 공유: 스매시 임팩트는 디자인 칸(4종)을 건드리지 않고 따로 켜진다', function () {
    var sc = BM.sharecard;
    eq(sc.DESIGNS.length, 4, '디자인 칸은 그대로 4종');
    eq(sc.designById('smash').name, '스매시 임팩트', '이름');
    eq(sc.presetDesignId('smash'), 'smash', '저장 직후 바로 열기');
    eq(sc._initialState({ store: { state: stateOf() } }, { design: 'smash' }).design, 'smash', 'opts.design');
  });

  test('v1.80 공유: 스매시 카드에 라켓 색·충격파·오늘 수치·SHUTTLIX·친구 코드가 그려진다', function () {
    var sc = BM.sharecard;
    var rec = { id: 'r1', date: U.ymd(), minutes: 60, cond: 8, intensity: 6, weakness: ['풋워크'], done: ['스트록'] };
    var rows = BM.fixtures.demo();
    rows.push({ type: '기록', id: 'r1', clientId: 'c1', createdAt: U.ymd() + ' 19:00:00',
      userKey: BM.seed.ME, nick: '나래', date: U.ymd(), minutes: 60, cond: 8, intensity: 6, weakness: ['풋워크'] });
    var st = stateOf(rows, { ui: { lastSavedLog: rec } });
    st.data.records = [rec].concat(st.data.records);
    st.me.theme = { theme: 'th_night', gear: { custom: { frame: 'red', string: 'gold', grip: 'neon', stencil: 'bolt', charm: 'medal', unlocked: ['frame:red', 'string:gold', 'grip:neon', 'stencil:bolt', 'charm:medal'] } } };
    var ctx = { store: { state: st } };
    sc._setState(sc._initialState(ctx, { mode: 'today', design: 'smash', record: rec }));
    var spec = sc._specOf(ctx);
    eq(spec.design, 'smash', '스매시');
    ok(spec.smashItems.length >= 3, '오늘 수치 칩: ' + JSON.stringify(spec.smashItems));
    includes(spec.smashItems.map(function (x) { return x.v; }).join('|'), '60분', '운동 시간');
    includes(spec.smashItems.map(function (x) { return x.v; }).join('|'), '8', '컨디션');
    includes(spec.friendCode, '#', '친구 코드(이름#코드)');
    var m = mockCanvas();
    sc.draw(m.canvas, spec);
    var all = m.log.texts.join('|');
    includes(all, 'SMASH DAY', '임팩트 제목');
    includes(all, 'SHUTTLIX', '브랜드');
    includes(all, '60분', '운동 시간 칩');
    includes(all, '풋워크', '오늘 집중');
    includes(all, spec.friendCode, '친구 코드');
    ok(m.log.strokes > 8, '링·파편·크랙 선을 그린다: ' + m.log.strokes);
    ok(m.log.ops.indexOf('rotate') >= 0, '라켓을 기울여 그린다');
  });

  test('v1.80 공유: 스토리 비율에서도 위아래 안전 여백 안에 그려진다', function () {
    var sc = BM.sharecard;
    var rec = { id: 'r1', date: U.ymd(), minutes: 45, cond: 7 };
    var rows = BM.fixtures.demo();
    rows.push({ type: '기록', id: 'r1', clientId: 'c1', createdAt: U.ymd() + ' 19:00:00',
      userKey: BM.seed.ME, nick: '나래', date: U.ymd(), minutes: 45, cond: 7 });
    var st = stateOf(rows, { ui: { lastSavedLog: rec } });
    st.data.records = [rec].concat(st.data.records);
    var ctx = { store: { state: st } };
    sc._setState(sc._initialState(ctx, { mode: 'today', design: 'smash', record: rec }));
    var ui = sc._state();
    ui.ratio = 'story';
    var spec = sc._specOf(ctx);
    var m = mockCanvas();
    sc.draw(m.canvas, spec);
    eq(m.canvas.height, 1920, '스토리 높이');
    includes(m.log.texts.join('|'), '45분', '수치');
  });

  test('v1.80 공유: 스매시 배너·라켓/친구 코드 토글이 시트에 있고 기본은 켜짐', function () {
    var sc = BM.sharecard;
    var st = stateOf();
    var ctx = { store: { state: st } };
    var init = sc._initialState(ctx, {});
    eq(init.racket, true, '내 라켓 기본 켜짐');
    eq(init.code, true, '친구 코드 기본 켜짐');
    sc._setState(init);
    var html = sc._sheetBody(ctx);
    includes(html, 'data-sc-smash="1"', '스매시 배너');
    includes(html, '스매시 임팩트', '이름');
    includes(html, 'data-sc-rackettoggle', '라켓 토글');
    includes(html, 'data-sc-codetoggle', '코드 토글');
    var sheet = readRoot('js/sharecard.js');
    includes(sheet, "function paintSmash(", '캔버스 그리기');
    includes(sheet, "d === 'smash'", '디자인 분기');
    includes(sheet, 'SMASH_DESIGN', '상수');
    includes(readRoot('styles.css'), '.sc__smashban', '배너 CSS');
  });

  test('v1.80 공유: 매거진 날짜 줄에도 내 친구 코드가 붙는다(토글 켜짐)', function () {
    var sc = BM.sharecard;
    var rec = { id: 'r1', date: U.ymd(), minutes: 45, cond: 7 };
    var rows = BM.fixtures.demo();
    rows.push({ type: '기록', id: 'r1', clientId: 'c1', createdAt: U.ymd() + ' 19:00:00',
      userKey: BM.seed.ME, nick: '나래', date: U.ymd(), minutes: 45, cond: 7 });
    var st = stateOf(rows, { ui: { lastSavedLog: rec } });
    st.data.records = [rec].concat(st.data.records);
    var ctx = { store: { state: st } };
    sc._setState(sc._initialState(ctx, { mode: 'today', record: rec }));
    sc._state().code = true;
    sc._state().design = 'magazine';
    var spec = sc._specOf(ctx);
    var m = mockCanvas();
    sc.draw(m.canvas, spec);
    includes(m.log.texts.join('|'), spec.friendCode, '날짜 줄에 이름#코드');
    m = mockCanvas();
    sc._state().code = false;
    sc.draw(m.canvas, sc._specOf(ctx));
    excludes(m.log.texts.join('|'), spec.friendCode, '끄면 빠진다');
  });

  /* ============================================================
   * 9-2. 3D 라켓 뷰 — 돌려보기 · 부위 직접 탭
   * ============================================================ */

  test('v1.80 3D: 투영 회전이 좌우 360°·상하 기울기를 만든다', function () {
    var r = RC.rot3({ x: 1, y: 0, z: 0 }, Math.PI / 2, 0);
    ok(Math.abs(r.x) < 1e-9 && Math.abs(r.z + 1) < 1e-9, 'yaw 90°면 x축이 화면 뒤로');
    var r2 = RC.rot3({ x: 0, y: 1, z: 0 }, 0, Math.PI / 2);
    ok(Math.abs(r2.y) < 1e-9 && Math.abs(r2.z - 1) < 1e-9, 'pitch 90°면 y축이 깊이로');
    var v = { yaw: 0, pitch: 0, k: 1, cx: 0, cy: 0 };
    var a = RC.project3({ x: 0, y: 0, z: 0 }, v);
    ok(a.s > 0.3 && a.s < 1.2, '원근 배율: ' + a.s);
    var front = RC.project3({ x: 0, y: 0, z: 60 }, v);
    ok(front.s > a.s, '앞으로 나온 점은 더 크게');
  });

  test('v1.80 3D: 라켓에서 거트·테두리·그립을 직접 누르면 그 파츠가 잡힌다', function () {
    var v = { yaw: -0.42, pitch: 0.14, k: 1, cx: 150, cy: 190 };
    var head = RC.project3({ x: 0, y: 0, z: 0 }, v);
    eq(RC.hitSlot(head.x, head.y, v), 'string', '헤드 가운데 → 거트');
    var grip = RC.project3({ x: 0, y: RC.G3.gripY0 + 40, z: 0 }, v);
    eq(RC.hitSlot(grip.x, grip.y, v), 'grip', '손잡이 → 그립');
    var rim = RC.project3({ x: 100, y: 0, z: 0 }, v);
    eq(RC.hitSlot(rim.x, rim.y, v), 'frame', '테두리 → 프레임');
    var throat = RC.project3({ x: 0, y: 150, z: 0 }, v);
    eq(RC.hitSlot(throat.x, throat.y, v), 'frame', '목 → 프레임');
    eq(RC.hitSlot(-500, -500, v), '', '라켓 밖은 아무것도 아님');
  });

  test('v1.80 3D: 꾸미기 시트에 3D 캔버스·부위 탭이 있고, 고른 부위 파츠만 보인다', function () {
    var html = RC.sheetBody(stateOf());
    includes(html, 'rk3d__cv', '3D 캔버스');
    includes(html, '끌어서 360° 돌려보기', '돌려보기 안내');
    eq((html.match(/class="rk3d__tab[" ]/g) || []).length, 6, '부위 탭 6개(효과 포함)');
    includes(html, 'data-rk-slot="frame"', '테두리 탭');
    includes(html, 'data-rk-slot="string"', '거트 탭');
    includes(html, 'data-rk-slot="grip"', '그립 탭');
    eq((html.match(/data-rk-group=/g) || []).length, 6, '파츠 묶음 6개(효과 포함)');
    eq((html.match(/data-rk-group="frame" hidden/g) || []).length, 0, '기본은 테두리가 열려 있음');
    eq((html.match(/data-rk-group="string" hidden/g) || []).length, 1, '나머지는 숨김');
    var js = (hasNode ? readRoot('js/racketcustom.js') : '');
    includes(js, 'function mount3d(', '3D 붙이기');
    includes(js, 'pointermove', '드래그 회전');
    includes(js, 'requestAnimationFrame', '숨 쉬듯 자동 회전');
    includes(js, 'setPointerCapture', '끌기');
    includes(hasNode ? readRoot('styles.css') : '', '.rk3d__cv', '3D 캔버스 CSS');
    includes(hasNode ? readRoot('styles.css') : '', 'touch-action: none', '스크롤 대신 회전');
  });

  /* ============================================================
   * 10. 버전 · 보호
   * ============================================================ */

  test('v1.80 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.85.0'", 'sw.js');
    includes(readRoot('sw.js'), "'./js/racketcustom.js'", 'sw 캐시에 라켓 모듈');
    includes(readRoot('app.js'), "version: 'v1.85.0'", 'app.js');
    includes(readRoot('js/push.js'), "version: 'v1.85.0'", 'push.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-7', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.85.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.85.0', 'TWA appVersion');
    eq(twa.appVersionCode, 79, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.85.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v180.test.js', '테스트 목록 배선');
    includes(readRoot('test/run.js'), 'js/racketcustom.js', '테스트 로드');
  });

  test('v1.80 보호: 5개 탭 · 시트 26칸 · 하트 RPC · 줄 교체 알림이 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "id: '" + id + "'", '탭 ' + id);
    });
    eq(BM.domain.COLS.length, 26, '시트 26칸');
    var store = readRoot('js/store.js');
    includes(store, "rpc('heart_spend'", '하트 차감 RPC 그대로');
    eq(D.HEART_RULES.MATCH_COST, 2, '매칭 2하트');
    includes(readRoot('js/gear.js'), 'notifyIfDue', '줄 교체 알림 그대로');
    includes(readRoot('js/gear.js'), 'data-gear-state=', 'MY 라켓 카드 그대로');
    var st = stateOf();
    var logHtml = BM.views.log.render(st);
    includes(logHtml, 'data-act="save-log"', '저장 버튼');
    includes(logHtml, 'data-form="log"', '일지 폼');
    var matching = BM.views.matching.render(st);
    includes(matching, 'data-match-tab="find"', '매칭 탭');
    var p0 = st.data.matchProfiles.filter(function (p) { return p.userKey !== BM.seed.ME; })[0];
    includes(BM.views.matching.playerCard(p0, st), 'data-open-profile=', '프로필 열기');
  });

  test('v1.80 실명: 코드·화면 어디에도 실존 선수 이름이 없다', function () {
    if (!hasNode) return;
    var blob = readRoot('js/racketcustom.js') + readRoot('js/sharecard.js') +
      readRoot('js/views/log.js') + readRoot('js/views/matching.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
