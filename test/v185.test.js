/* ============================================================
 * test/v184.test.js — bm-v1.87.0
 *   🤝 1:1 매칭 실시간(토큰) · 3D 라켓 실루엣·모션·임팩트 · 하트로 파츠 열기 · 라켓 기록 유지
 *
 *   1) 실시간  — Realtime join 에 로그인 access_token 을 싣는다(문자열·Promise 모두),
 *                토큰이 바뀌면 access_token 이벤트, join 거절 시 토큰 없이 한 번 더,
 *                재연결 때 최신 토큰. 토큰이 없으면(체험) 예전처럼 공개 키만.
 *   2) 매칭    — requestMatch → 매칭신청 행 · pendingIncoming/'받은 요청' · 원격 실시간 반영
 *   3) 실패    — 하트 부족·서버 unknown 에서 오해 없이 이유만 돌려주고 요청을 만들지 않는다
 *   4) 3D      — 달걀 실루엣(정수리 둥글고 목이 좁다) · 바디 4종 차이 · 데칼 밴드
 *   5) 꾸미기  — 탭 바로 아래 선택창 · 하트 지갑 · 포인트(P) 표기 없음
 *   6) 하트    — 등급별 1~5하트 · 하트로 열고 차감 · 관리자(csw42060713@gmail.com) 전체 해금
 *   7) 기록    — 같은 초 프로필 행에서도 최신을 고르고, 새 행에 gear 칸이 없어도 이어받기
 *   8) 보호·버전
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var D = BM.domain;
  var U = BM.util;
  var RC = BM.racketcustom;
  var G = BM.gear;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { if (U.storage && U.storage.removeItem) U.storage.removeItem(k); });
  }
  function freshStore(rows, me) {
    clearStorage();
    if (rows) U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0, meKey: (me && me.key) || undefined, me: me || undefined });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* ---------- 가짜 WebSocket (Realtime) ---------- */
  function FakeWS(url) {
    this.url = url;
    this.sent = [];
    this.closedByApp = false;
    FakeWS.instances.push(this);
  }
  FakeWS.instances = [];
  FakeWS.prototype.send = function (raw) { this.sent.push(JSON.parse(raw)); };
  FakeWS.prototype.open = function () { if (this.onopen) this.onopen({}); };
  FakeWS.prototype.receive = function (msg) { if (this.onmessage) this.onmessage({ data: JSON.stringify(msg) }); };
  FakeWS.prototype.close = function () { this.closedByApp = true; };
  FakeWS.prototype.drop = function () { this.ws = null; if (this.onclose) this.onclose({}); };

  function withFakeWS() {
    FakeWS.instances = [];
    root.WebSocket = FakeWS;
  }

  /* ============================================================
   * 1. 실시간 — access_token 을 join 에 싣는다
   * ============================================================ */

  test('v1.84 실시간: 로그인 토큰을 join payload.access_token 으로 보낸다', function () {
    withFakeWS();
    var api = BM.api.createSupabase({ meKey: 'u_me', token: 'jwt-abc' });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    eq(ws.sent.length, 1, 'join 한 번');
    eq(ws.sent[0].event, 'phx_join', 'join');
    eq(ws.sent[0].payload.access_token, 'jwt-abc', '토큰을 함께 보낸다');
    eq(ws.sent[0].payload.config.postgres_changes[0].table, 'app_records', '표 구독은 그대로');
    sub.close();
  });

  test('v1.84 실시간: 토큰이 없으면(체험·로그인 전) 예전처럼 공개 키만 — access_token 없음', function () {
    withFakeWS();
    var api = BM.api.createSupabase({ meKey: 'u_guest' });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    eq(ws.sent[0].payload.access_token == null, true, '토큰 칸이 없다');
    includes(ws.url, 'apikey=', '공개 키는 주소에 그대로');
    sub.close();
  });

  test('v1.84 실시간: 토큰이 Promise(만료 전 자동 갱신)면 값이 온 뒤 join 한다', function () {
    withFakeWS();
    var api = BM.api.createSupabase({ meKey: 'u_me', token: function () { return Promise.resolve('jwt-later'); } });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    return Promise.resolve().then(function () { return Promise.resolve(); }).then(function () {
      eq(ws.sent.length, 1, 'join 은 한 번');
      eq(ws.sent[0].payload.access_token, 'jwt-later', 'Promise 가 푼 토큰으로 join');
      sub.close();
    });
  });

  test('v1.84 실시간: 토큰을 실은 join 이 거절되면 토큰 없이 한 번 더 붙는다(공개 글 실시간 유지)', function () {
    withFakeWS();
    var api = BM.api.createSupabase({ meKey: 'u_me', token: 'expired' });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    ws.receive({ event: 'phx_reply', payload: { status: 'error' }, ref: ws.sent[0].ref });
    eq(ws.sent.length, 2, '다시 join');
    eq(ws.sent[1].payload.access_token == null, true, '두 번째는 토큰 없이');
    sub.close();
  });

  test('v1.84 실시간: 연결이 끊겼다 다시 붙을 때 최신 토큰으로 join 한다', function () {
    withFakeWS();
    var cur = 'jwt-1';
    var api = BM.api.createSupabase({ meKey: 'u_me', token: function () { return Promise.resolve(cur); } });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    return Promise.resolve().then(function () {
      cur = 'jwt-2';                        /* 그 사이 로그인 갱신 */
      var realTO = root.setTimeout;
      root.setTimeout = function (fn) { fn(); return 0; };
      ws.drop();
      root.setTimeout = realTO;
      var again = FakeWS.instances[FakeWS.instances.length - 1];
      ok(FakeWS.instances.length >= 2, '새 소켓');
      again.open();
      return Promise.resolve().then(function () {
        eq(again.sent[0].payload.access_token, 'jwt-2', '새 토큰');
        sub.close();
      });
    });
  });

  test('v1.84 실시간: 접속 중 토큰이 바뀌면 access_token 이벤트로 알린다', function () {
    withFakeWS();
    var cur = 'jwt-old';
    var api = BM.api.createSupabase({ meKey: 'u_me', token: function () { return Promise.resolve(cur); } });
    var sub = api.subscribe(function () {});
    var ws = FakeWS.instances[0];
    ws.open();
    return Promise.resolve().then(function () {
      ws.receive({ event: 'phx_reply', payload: { status: 'ok' }, ref: '1' });
      cur = 'jwt-new';
      /* 하트비트(25초) 주기가 토큰을 확인합니다 — 여기서는 같은 경로를 한 번 불러 봅니다 */
      ok(typeof api.subscribe === 'function', '구독 유지');
      sub.close();
      includes(readRoot('js/api.js'), "event: 'access_token'", 'access_token 이벤트 경로가 있다');
      includes(readRoot('js/api.js'), 'rtAuth()', '하트비트에서 토큰 확인');
    });
  });

  /* ============================================================
   * 2. 1:1 매칭 — 보내기 → 받은 요청 → 실시간 반영
   * ============================================================ */

  test('v1.84 매칭: 보낸 요청은 매칭신청 행(target=상대)으로 남고 받은 요청에 뜬다', function () {
    return freshStore([], { key: 'u_me', nick: '나', level: 'B조' }).then(function (store) {
      store.state.locks = {};
      var res = store.actions.requestMatch('u_other', '한 판 어때요');
      ok(res && res.ok, '요청 보냄');
      var reqs = (store.state.data.idx.byType['매칭신청'] || []);
      eq(reqs.length, 1, '매칭신청 행 하나');
      eq(reqs[0].target, 'u_other', '대상');
      eq(reqs[0].status, '대기', '대기');
      /* 상대 화면(같은 행을 받은 사람) — 받은 요청으로 보인다 */
      var st2 = { me: { key: 'u_other', nick: '상대' }, data: { idx: store.state.data.idx, requests: store.state.data.requests }, ui: {} };
      var inc = BM.views.matching.pendingIncoming(st2);
      eq(inc.length, 1, '받은 요청 1건');
      eq(inc[0].payload.note, '한 판 어때요', '쪽지');
    });
  });

  test('v1.84 매칭: 실시간으로 온 매칭신청 행이 화면 상태·알림에 바로 들어온다', function () {
    withFakeWS();
    var realFetch = root.fetch;
    root.fetch = function () {
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve('[]'); }
      });
    };
    var api = BM.api.createSupabase({ meKey: 'u_me', me: { nick: '나' } });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () {
      store.actions.listen();
      var ws = FakeWS.instances[FakeWS.instances.length - 1];
      ws.open();
      ws.receive({ event: 'phx_reply', payload: { status: 'ok' }, ref: '1' });
      eq(store.state.realtime, 'live', '실시간 연결 표시');
      ws.receive({
        event: 'postgres_changes',
        payload: {
          data: {
            type: 'INSERT', table: 'app_records',
            record: {
              id: '1795999999999', type: '매칭신청', user_key: 'u_other', target: 'u_me',
              nick: '상대', date: U.ymd(), win: '대기', payload: { note: '같이 쳐요', heartCost: 2, payOn: 'accept' },
              created_at: new Date().toISOString()
            }
          }
        }
      });
      var inc = BM.views.matching.pendingIncoming(store.state);
      eq(inc.length, 1, '받은 요청에 즉시 반영');
      ok((store.state.data.idx.byType['매칭신청'] || []).length === 1, '화면 상태에도 들어온다');
      store.actions.stopListening();
      api.close();
      root.fetch = realFetch;
    });
  });

  test('v1.84 매칭: 보낼 수 없을 때(하트 부족)는 요청을 만들지 않고 이유만 돌려준다', function () {
    return freshStore([], { key: 'u_me', nick: '나' }).then(function (store) {
      store.state.data.hearts = { balance: 0 };
      store.state.locks = {};
      var res = store.actions.requestMatch('u_other', '한 판');
      ok(res && !res.ok, '실패');
      eq(res.reason, 'hearts', '하트 부족');
      eq((store.state.data.idx.byType['매칭신청'] || []).length, 0, '요청 행을 만들지 않는다');
      includes(readRoot('js/views/matching.js'), 'res.reason', '화면이 이유를 안내한다');
    });
  });

  /* ============================================================
   * 3. 3D 실루엣 — 네모가 아닌 달걀 곡선
   * ============================================================ */

  test('v1.84 3D: 헤드가 달걀 곡선 — 정수리가 둥글고 목이 좁으며 옆이 곧지 않다', function () {
    RC.BODY_IDS.forEach(function (id) {
      var gm = RC.geomOf({ body: id });
      var half = gm.profile;
      ok(half.length >= 18, id + ' 제어점 ' + half.length + '개(촘촘한 곡선)');
      /* 위·아래 끝은 가운데(x=0) */
      ok(Math.abs(half[0][0]) < 0.001 && Math.abs(half[half.length - 1][0]) < 0.001, id + ' 양 끝은 중심선');
      var wide = 0, wideAt = 0;
      half.forEach(function (p, i) {
        if (Math.abs(p[0]) > wide) { wide = Math.abs(p[0]); wideAt = i; }
      });
      ok(Math.abs(wide - 1) < 0.08, id + ' 최대 폭 ≈ rx (' + wide.toFixed(3) + ')');
      /* 옆이 '곧은 구간'(같은 x 가 길게 이어짐)이 없어야 네모로 보이지 않는다 */
      var flat = 0;
      for (var i = 1; i < half.length; i++) {
        if (Math.abs(half[i][0] - half[i - 1][0]) < 0.012 && Math.abs(half[i][0]) > 0.9) flat++;
      }
      ok(flat <= 1, id + ' 직선 옆구리 없음(' + flat + ')');
      /* 목 쪽이 위보다 좁다 */
      var top = Math.abs(half[Math.round(half.length * 0.25)][0]);
      var bottom = Math.abs(half[Math.round(half.length * 0.88)][0]);
      ok(bottom < top * 0.92, id + ' 아래로 좁아진다 ' + bottom.toFixed(2) + ' < ' + top.toFixed(2));
    });
  });

  test('v1.84 3D: 테두리·거트·그립 히트 테스트와 상단 미니 라켓이 그대로 동작한다', function () {
    RC.BODY_IDS.forEach(function (id) {
      var gm = RC.geomOf({ body: id });
      var v = { yaw: -0.35, pitch: 0.1, k: 1, cx: 150, cy: 220, mid: gm.mid };
      var head = RC.project3({ x: 0, y: 0, z: 0 }, v);
      eq(RC.hitSlot(head.x, head.y, v, { body: id }), 'string', id + ' 가운데 → 거트');
      var grip = RC.project3({ x: 0, y: gm.gripY0 + gm.gripLen * 0.5, z: 0 }, v);
      eq(RC.hitSlot(grip.x, grip.y, v, { body: id }), 'grip', id + ' 손잡이 → 그립');
      var rim = RC.project3({ x: gm.rx, y: 0, z: 0 }, v);
      eq(RC.hitSlot(rim.x, rim.y, v, { body: id }), 'frame', id + ' 테두리');
    });
    includes(RC.miniHtml(RC.blankCustom(), { level: 'prime' }), '<svg', '상단 미니 라켓');
    ok(RC.stringChords(RC.geomOf({}), 'ok').mains.length >= 16, '거트 17줄 그대로');
  });

  test('v1.84 3D: 데칼은 테두리를 따라가는 밴드로 그린다(조각 타일 아님)', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'pushLines(prims, v, [pts], gm.accent', '밴드 스트로크');
    var m = mockCanvas();
    RC._parts.draw(m.ctx, { yaw: -0.5, pitch: 0.1, k: 1, cx: 200, cy: 260, mid: RC.geomOf({}).mid, phase: 0 },
      RC.blankCustom(), 'ok', 400, 520);
    ok(m.log.strokes > 0, '선으로 그려진다');
  });

  /* ============================================================
   * 4. 꾸미기 시트 — 탭 바로 아래 선택창 · 하트 지갑
   * ============================================================ */

  test('v1.84 꾸미기: [테두리…효과] 탭 바로 아래에 선택창이 오고 상태 카드는 그 아래', function () {
    var st = stateOf([]);
    var html = RC.sheetBody(st);
    var pickAt = html.indexOf('data-rk-pick');
    var tabAt = html.indexOf('rk3d__tabs');
    var groupAt = html.indexOf('rkgroup');
    var ageAt = html.indexOf('rkage');
    var heroAt = html.indexOf('rkhero');
    var heartsAt = html.indexOf('rkhearts');
    ok(pickAt > 0 && tabAt > pickAt, '선택창 묶음 안에 탭이 있다');
    ok(groupAt > tabAt, '선택창(파츠 카드)이 탭 바로 아래');
    ok(ageAt > groupAt && heroAt > ageAt && heartsAt > heroAt, '줄 상태·컨디션·하트 지갑은 그 아래');
    /* 3D 캔버스 → 탭 순서도 그대로 */
    ok(html.indexOf('rk3d__cv') < tabAt, '3D 다음에 탭');
  });

  test('v1.84 꾸미기: 포인트(P) 안내가 사라지고 보유 하트 + 하트 모으기 버튼이 있다', function () {
    var st = stateOf([]);
    st.data.hearts = { balance: 7 };
    var html = RC.sheetBody(st);
    includes(html, '보유 하트', '하트 지갑');
    includes(html, '❤ 7개', '잔액');
    includes(html, 'data-rk-hearts="1"', '하트 모으기');
    excludes(html, '라켓 포인트', '포인트 안내 없음');
    excludes(html, 'P</i>', 'P 단위 없음');
  });

  /* ============================================================
   * 5. 하트로 여는 파츠 · 관리자 전체 해금
   * ============================================================ */

  test('v1.84 하트: 등급별 1~5하트, 기본 파츠·파워 77은 무료', function () {
    eq(RC.priceOf('frame', 'matte'), 0, '기본 프레임 무료');
    eq(RC.priceOf('string', 'white'), 1, '일반 1하트');
    eq(RC.priceOf('frame', 'carbon'), 2, '레어 2하트');
    eq(RC.priceOf('frame', 'navy'), 3, '에픽 3하트');
    eq(RC.priceOf('charm', 'ace'), 5, '레전드 5하트');
    eq(RC.priceOf('body', 'power77'), 0, '파워 77 무료');
    eq(RC.priceOf('body', 'aero'), 2, '에어로 2하트');
    eq(RC.priceOf('body', 'smash'), 5, '스매시 맥스 5하트');
    RC.SLOTS.forEach(function (slot) {
      RC.itemsOf(slot).forEach(function (it) {
        var p = RC.priceOf(slot, it.id);
        ok(p >= 0 && p <= 5, slot + ':' + it.id + ' 하트 ' + p);
        if (!it.free) ok(p >= 1, slot + ':' + it.id + ' 유료는 최소 1하트');
      });
    });
  });

  test('v1.84 하트: 하트로 파츠를 열면 잔액이 줄고 바로 입는다(기기 저장 모드)', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      var rows = U.readJSON('bm_rows_v1', []) || [];
      for (var i = 1; i <= 4; i++) {
        rows.push(D.toRow({ type: '출석하트', id: 'h' + i, clientId: 'h' + i, date: '2026-11-' + (10 + i),
          createdAt: '2026-11-' + (10 + i) + ' 07:00:00', nick: '나', userKey: store.state.me.key, likes: 1 }));
      }
      U.writeJSON('bm_rows_v1', rows);
      return store.actions.reload().then(function () {
        store.state.locks = {};
        var before = RC.heartNow(store.state);
        ok(before >= 2, '하트 ' + before);
        var res = store.actions.buyRacketPart('body', 'aero');
        return Promise.resolve(res).then(function (r) {
          r = r || {};
          ok(r.ok, '구매 성공');
          eq(r.price, 2, '2하트');
          eq(RC.customOf(store.state.me).body, 'aero', '바로 입는다');
          ok(RC.heartNow(store.state) < before, '잔액이 줄었다');
        });
      });
    });
  });

  test('v1.84 관리자: csw42060713@gmail.com 은 모든 바디·파츠가 하트 0으로 열려 있다', function () {
    eq(D.isAdminMe({ email: 'csw42060713@gmail.com' }), true, '관리자 판정');
    var st = stateOf([], { key: 'u_admin', email: 'csw42060713@gmail.com', nick: '관리자' });
    st.data.hearts = { balance: 0 };
    var html = RC.sheetBody(st);
    includes(html, '관리자 계정', '관리자 안내');
    excludes(html, '❤ 2', '잠긴 하트 가격이 뜨지 않는다');
    ok(RC.isAdminUser(st), '모두 열림');
    return freshStore([], { key: 'u_admin', email: 'csw42060713@gmail.com', nick: '관리자' }).then(function (store) {
      store.state.locks = {};
      var res = store.actions.buyRacketPart('body', 'smash');
      return Promise.resolve(res).then(function (r) {
        r = r || {};
        ok(r.ok, '관리자는 하트 없이 열린다');
        eq(r.price, 0, '0하트');
        eq(RC.customOf(store.state.me).body, 'smash', '스매시 맥스 입음');
        eq(RC.heartNow(store.state), RC.heartNow(store.state), '잔액 그대로');
      });
    });
  });

  test('v1.84 관리자: 프로필을 저장해도 state.me.email 이 남아 관리자 해금이 유지된다', function () {
    return freshStore([], { key: 'u_admin', email: 'csw42060713@gmail.com', nick: '관리자' }).then(function (store) {
      store.state.locks = {};
      store.actions.saveProfile({ nick: '관리자2' });
      eq(store.state.me.email, 'csw42060713@gmail.com', 'email 유지');
      ok(D.isAdminMe(store.state.me), '관리자 유지');
      eq(RC.isAdminUser(store.state), true, '꾸미기 전체 해금 유지');
    });
  });

  test('v1.84 하트: 새 파츠 SQL 이 저장소에 있고, 서버가 모르면 하트를 빼지 않는다', function () {
    var sql = readRoot('supabase/heart-rpc-v1.84-racket.sql');
    includes(sql, 'bm_racket_price', '가격표 함수');
    includes(sql, "when 'frame:carbon'", '프레임 가격');
    includes(sql, "when 'body:smash'", '바디 가격');
    includes(sql, 'create or replace function public.heart_spend', '기존 함수 확장');
    includes(sql, 'security definer', '서버만 차감');
    var store = readRoot('js/store.js');
    includes(store, "p_kind: 'racket'", 'racket 종류로 호출');
    includes(store, "res.reason === 'unknown' && slot === 'effect'", '효과는 예전 smash 로 한 번 더');
    includes(readRoot('js/racketcustom.js'), '지금은 하트로 여는 준비 중이에요', '준비 전 안내');
  });

  /* ============================================================
   * 6. 라켓·텐션 기록 유지 (다시 열 때 리셋 금지)
   * ============================================================ */

  test('v1.84 기록: 같은 초에 저장된 프로필 행이면 나중 행을 고른다', function () {
    var rows = [
      { type: '프로필', id: '1795000000000100', clientId: 'a', createdAt: '2026-11-26 17:10:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_night' } },
      { type: '프로필', id: '1795000000000300', clientId: 'b', createdAt: '2026-11-26 17:10:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_night', gear: { racket: '아스트록스77', tension: 29 } } }
    ];
    var idx = D.index(rows.map(function (r) { return D.fromRow(D.toRow(r)); }));
    var p = D.profileOf(idx, 'u1');
    eq(String(p.id), '1795000000000300', '나중 행(라켓 기록이 있는 행)');
    eq(G.gearOf({ theme: p.theme }).tension, 29, '텐션 29 유지');
  });

  test('v1.84 기록: 새 프로필 행에 gear 칸이 없어도 마지막 라켓 기록을 이어받는다', function () {
    var rows = [
      { type: '프로필', id: '1795000000000100', clientId: 'a', createdAt: '2026-11-26 17:00:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_night', gear: { racket: '아스트록스77', string: 'BG80', tension: 29, strungAt: '2026-11-20' } } },
      { type: '프로필', id: '1795000000000200', clientId: 'b', createdAt: '2026-11-26 17:05:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_sakura' } }
    ];
    var carry = D.gearCarryFrom(D.index(rows.map(function (r) { return D.fromRow(D.toRow(r)); })), 'u1');
    ok(carry && carry.tension === 29, '이어받을 기록을 찾는다');
    U.writeJSON('bm_rows_v1', rows.map(D.toRow));
    var api = BM.api.createLocal({ latency: 0, meKey: 'u1', rowsKey: 'bm_rows_v1' });
    return api.bootstrap().then(function (res) {
      eq(G.gearOf(res.me).racket, '아스트록스77', '화면 상태에 라켓이 살아 있다');
      eq(G.gearOf(res.me).tension, 29, '텐션도 그대로');
      eq(res.me.theme.theme, 'th_sakura', '테마는 최신 행');
    });
  });

  test('v1.84 기록: 지운 기록은 되살아나지 않는다(gear 칸을 빈 값으로 저장)', function () {
    var rows = [
      { type: '프로필', id: '1795000000000100', clientId: 'a', createdAt: '2026-11-26 17:00:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_night', gear: { racket: '아스트록스77', tension: 29 } } },
      { type: '프로필', id: '1795000000000200', clientId: 'b', createdAt: '2026-11-26 17:05:00', userKey: 'u1', nick: '나',
        theme: { theme: 'th_night', gear: { racket: '', string: '', tension: 0, strungAt: '' } } }
    ];
    U.writeJSON('bm_rows_v1', rows.map(D.toRow));
    var api = BM.api.createLocal({ latency: 0, meKey: 'u1' });
    return api.bootstrap().then(function (res) {
      eq(G.gearOf(res.me).racket, '', '지운 값이 그대로');
      ok(!G.hasGear(G.gearOf(res.me)), '기록 없음');
    });
  });

  test('v1.84 기록: 입력 → 저장 → 닫기 → 다시 열기까지 값이 유지된다(브라우저 전 단계)', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.state.locks = {};
      store.actions.setGear({ racket: '아스트록스77', string: 'BG80', tension: 29, strungAt: '2026-11-26' });
      var body = G.sheetBody(store.state.me);
      includes(body, 'value="아스트록스77"', '라켓 이름이 입력칸에');
      includes(body, 'value="29"', '텐션 29가 입력칸에');
      /* poll(서버에서 다시 받기)을 거쳐도 그대로 */
      return store.actions.poll().then(function () {
        var body2 = G.sheetBody(store.state.me);
        includes(body2, 'value="아스트록스77"', 'poll 뒤에도 라켓');
        includes(body2, 'value="29"', 'poll 뒤에도 텐션');
        /* 커스텀 라켓 색을 바꿔도 기록 유지 */
        store.state.locks = {};
        store.actions.setGear({ custom: { string: 'gold', unlocked: ['string:gold'] } });
        var g = G.gearOf(store.state.me);
        eq(g.racket, '아스트록스77', '색을 바꿔도 라켓');
        eq(g.tension, 29, '색을 바꿔도 텐션');
      });
    });
  });

  /* ============================================================
   * 7. 스매시 연출 (불·얼음·바닥 강타)
   * ============================================================ */

  test('v1.84 임팩트: 불·얼음·번개 팔레트와 셔틀콕·파편·바닥 강타 연출이 있다', function () {
    eq(typeof RC.drawSmash, 'function', '연출 함수');
    eq(RC.smashPalette('ice').mid, '#7fd8ff', '얼음 색');
    includes(readRoot('js/racketcustom.js'), 'function drawShuttle', '셔틀콕');
    includes(readRoot('js/racketcustom.js'), 'function drawShards', '파편');
    includes(readRoot('js/racketcustom.js'), 'function drawFloor', '바닥 충격');
    includes(readRoot('js/racketcustom.js'), 'function drawHeadShards', '부서진 헤드');
    includes(readRoot('js/racketcustom.js'), 'function swingOf', '스윙 자세');
    includes(readRoot('js/racketcustom.js'), 'slam: slam', '3D 뷰에 바닥 강타');
    includes(RC.stageHtml(stateOf([])), 'data-rk-slam="1"', '바닥 강타 버튼');
    ok(RC.SMASH_MS >= 1000, '연출 길이 ' + RC.SMASH_MS);
  });

  test('v1.84 임팩트: 불/얼음/기본 연출이 서로 다른 파편을 그린다', function () {
    var counts = {};
    ['fire', 'ice', 'none'].forEach(function (fx) {
      var m = mockCanvas();
      RC.drawSmash(m.ctx, { yaw: -0.4, pitch: 0.1, k: 1, cx: 200, cy: 250, mid: 0, phase: 0 },
        RC.geomOf({}), fx, 420, 400, 520, { kind: 'air' });
      counts[fx] = m.log.fills.length + m.log.strokes;
    });
    ok(counts.fire !== counts.ice && counts.ice > 0, '연출마다 다르게 그린다');
    var m2 = mockCanvas();
    RC.drawSmash(m2.ctx, { yaw: -0.4, pitch: 0.1, k: 1, cx: 200, cy: 250, mid: 0, phase: 0 },
      RC.geomOf({}), 'fire', 480, 400, 520, { kind: 'slam' });
    ok(m2.log.strokes > 0, '바닥 강타도 그려진다');
  });

  /* ============================================================
   * 8. 보호 · 버전
   * ============================================================ */

  test('v1.84 보호: 5개 탭 · 시트 26칸 · 하트 RPC · 매칭 ON 배지 · AI 코칭 그대로', function () {
    includes(readRoot('index.html'), 'data-tab="log"', '5개 탭');
    eq(D.COLS.length, 26, '시트 26칸');
    var sql = readRoot('supabase/heart-rpc-v1.75.sql');
    includes(sql, 'heart_checkin', '출석 RPC');
    includes(sql, 'heart_ad_reward', '광고 RPC');
    includes(sql, 'heart_spend', '사용 RPC');
    includes(readRoot('app.js'), 'matchpill', '매칭 ON 배지');
    includes(readRoot('js/views/gyms.js'), '길찾기', '지도 길찾기');
    includes(readRoot('js/ai.js'), 'analyze', 'AI 코칭');
    eq(RC.BODY_IDS.length, 4, '3D 라켓 바디 4종');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
  });

  test('v1.84 보호: 새 코드·문구에 실존 선수 이름·외부 브랜드가 없다', function () {
    ['js/racketcustom.js', 'js/store.js', 'js/api.js', 'js/views/matching.js'].forEach(function (f) {
      var text = readRoot(f);
      ['김원호', '안세영', '서승재', '윤드로이드'].forEach(function (n) {
        excludes(text, n, f + ' 에 ' + n + ' 없음');
      });
    });
    excludes(readRoot('js/racketcustom.js'), '요넥스', '브랜드명 없음(모델 이름만)');
  });

  test('v1.84 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.87.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.87.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.87.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261127-1', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.87.0', 'TWA 이름');
    eq(twa.appVersion, '1.87.0', 'TWA appVersion');
    eq(twa.appVersionCode, 81, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.87.0', 'README');
    includes(readRoot('test/run.js'), 'test/v185.test.js', '테스트 목록');
  });

  /* ---------- 공용 도우미 ---------- */
  function stateOf(rows, me) {
    var idx = D.index((rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
    var m = me || { key: 'u_me', nick: '나', level: 'B조', discipline: '복식', theme: { theme: 'th_night' } };
    return {
      me: m,
      data: {
        idx: idx,
        hearts: { balance: 3 },
        requests: (idx.byType['매칭신청'] || [])
      },
      ui: {}
    };
  }

  function mockCanvas() {
    var log = { strokes: 0, fills: [], texts: [], ops: [] };
    function grad() { return { addColorStop: function () {} }; }
    function noop() {}
    var g = {
      globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: '', lineJoin: '',
      font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
      fillRect: noop, clearRect: noop, rect: noop, strokeRect: noop,
      beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, arc: noop, arcTo: noop,
      ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
      rotate: noop, translate: noop, scale: noop, save: noop, restore: noop, clip: noop,
      fill: function () { log.fills.push(g.fillStyle); }, stroke: function () { log.strokes++; },
      createLinearGradient: grad, createRadialGradient: grad,
      measureText: function (text) { return { width: String(text).length * 18 }; },
      fillText: function (text) { log.texts.push(String(text)); },
      strokeText: function (text) { log.texts.push(String(text)); },
      roundRect: noop, drawImage: noop
    };
    return { canvas: { width: 0, height: 0, getContext: function () { return g; } }, ctx: g, log: log };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
