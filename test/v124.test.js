/* ============================================================
 * test/v124.test.js — v1.24.0 (2026-11-20)
 *  1) DB 행 ↔ 시트 26칸 매핑 (recordToRow · rowToRecord · cellsToPatch)
 *  2) 겹쳐 읽는 수정·삭제 행 (reconcileRecords) — 남의 행은 건드리지 못한다
 *  3) Supabase REST: bootstrap / append(409 중복) / update·remove 0행 → 기록 행
 *  4) 저장소 고르기: 기본 Supabase · 게스트 local · 시트 연결 기기는 시트 유지
 *  5) 공개 키만 쓴다 (service_role·비밀번호 없음)
 *  6) Realtime: join → postgres_changes → 핸들러 · 끊기면 다시 붙기
 *  7) store.listen: 새 1:1 메시지가 1초 안에 화면·알림 배너 상태에 들어온다(중복 없음)
 *  8) 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util, D = BM.domain;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* ---------- 가짜 fetch / WebSocket ---------- */
  function fakeFetch(handler) {
    function f(url, init) {
      var call = {
        url: String(url),
        method: (init && init.method) || 'GET',
        headers: (init && init.headers) || {},
        body: init && init.body
      };
      f.calls.push(call);
      var res = handler(call) || {};
      var text = res.body == null ? '' : (typeof res.body === 'string' ? res.body : JSON.stringify(res.body));
      return Promise.resolve({
        ok: (res.status || 200) >= 200 && (res.status || 200) < 300,
        status: res.status || 200,
        text: function () { return Promise.resolve(text); }
      });
    }
    f.calls = [];
    return f;
  }
  function bodyOf(call) {
    try { return JSON.parse(call.body); } catch (e) { return null; }
  }

  function FakeWS(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 1;
    FakeWS.instances.push(this);
  }
  FakeWS.instances = [];
  FakeWS.prototype.send = function (m) { this.sent.push(JSON.parse(m)); };
  FakeWS.prototype.close = function () { this.closedByApp = true; if (this.onclose) this.onclose(); };
  FakeWS.prototype.open = function () { if (this.onopen) this.onopen(); };
  FakeWS.prototype.receive = function (obj) { if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) }); };
  FakeWS.prototype.drop = function () { if (this.onclose) this.onclose(); };

  function useFetch(handler) {
    var f = fakeFetch(handler);
    root.fetch = f;
    return f;
  }

  var REC = {
    id: 'r1', type: '기록', user_key: 'u_me1', nick: '승우', date: '2026-11-20',
    created_at: '2026-11-20T01:02:03.123456+00:00', cond: 7, intensity: 6, minutes: 90,
    done: '드라이브,풋워크', score: '21:15', win: '승', pain: '무릎',
    plan: { topic: '자유' }, theme: { theme: 'th_court' }, likes: 3, note: '오늘 훈련'
  };

  /* =========================================================
   * 1) 매핑
   * ========================================================= */
  test('v1.24 매핑: DB 행이 시트 26칸으로 그대로 옮겨진다', function () {
    var row = BM.api.recordToRow(REC);
    eq(row.length, 26, '26칸');
    eq(row[D.COL['ID']], 'r1', 'ID');
    eq(row[D.COL['유형']], '기록', '유형');
    eq(row[D.COL['닉네임']], '승우', '닉네임');
    eq(row[D.COL['날짜']], '2026-11-20', '날짜');
    eq(row[D.COL['컨디션']], '7', '컨디션은 숫자 문자열');
    eq(row[D.COL['운동시간(분)']], '90', '운동시간');
    eq(row[D.COL['완료훈련']], '드라이브,풋워크', '완료훈련');
    eq(row[D.COL['훈련계획']], '{"topic":"자유"}', '훈련계획 JSON');
    eq(row[D.COL['소셜글']], '오늘 훈련', '평문은 소셜글');
    eq(row[D.COL['좋아요']], '3', '좋아요');
    eq(row[D.COL['비밀번호']], '', '비밀번호 칸은 쓰지 않는다');
    /* 작성일시는 기기 시간대의 시트 모양 — 문자열 비교로 정렬·알림을 세기 때문 */
    eq(row[D.COL['작성일시']], BM.api.localStamp(REC.created_at), '작성일시');
    ok(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row[D.COL['작성일시']]), '시트와 같은 모양');
  });

  test('v1.24 매핑: 26칸이 DB 컬럼 값으로 되돌아간다 (JSON·숫자·빈칸)', function () {
    var row = D.toRow({
      id: 'r2', type: '기록', userKey: 'u_me1', nick: '승우', date: '2026-11-20',
      createdAt: '2026-11-20 10:00:00', cond: 6, minutes: 45,
      plan: { topic: '번개' }, done: ['스매시'], payload: { kind: '일지', v: 1 }
    });
    var rec = BM.api.rowToRecord(row);
    eq(rec.id, 'r2', 'id');
    eq(rec.type, '기록', 'type');
    eq(rec.user_key, 'u_me1', 'user_key');
    eq(rec.cond, 6, '숫자 칸');
    eq(rec.minutes, 45, '숫자 칸');
    eq(rec.plan.topic, '번개', 'jsonb 칸');
    eq(rec.payload.kind, '일지', '구조화 글은 payload');
    eq(rec.note, undefined, '평문 칸은 비어 있다');
    ok(rec.created_at.indexOf('T') > 0 && /Z$/.test(rec.created_at), 'created_at 은 UTC ISO');
    eq(BM.api.localStamp(rec.created_at), '2026-11-20 10:00:00', '저장했다 읽으면 같은 시각');

    var plain = BM.api.rowToRecord(D.toRow({ id: 'r3', type: '소셜', userKey: 'u_me1', text: '평문 글' }));
    eq(plain.note, '평문 글', '평문은 note');
    eq(plain.payload, undefined, 'payload 없음');
  });

  test('v1.24 매핑: 수정 칸도 DB 컬럼 값으로 (빈 값은 null)', function () {
    var patch = BM.api.cellsToPatch({ '운동시간(분)': '120', '완료훈련': '스매시', '컨디션': '' });
    eq(patch.minutes, 120, '숫자');
    eq(patch.done, '스매시', '문자');
    eq(patch.cond, null, '비운 칸은 null');
    var social = BM.api.cellsToPatch({ '소셜글': '평문' });
    eq(social.note, '평문', '평문은 note');
    eq(social.payload, null, 'payload 는 비운다');
    var json = BM.api.cellsToPatch({ '소셜글': '{"status":"승인"}' });
    eq(json.payload.status, '승인', 'JSON 은 payload');
  });

  /* =========================================================
   * 2) 겹쳐 읽는 수정·삭제 행
   * ========================================================= */
  test('v1.24 겹쳐 읽기: 내 행의 수정은 겹치고, 삭제는 가려진다 (기록 행은 화면에 안 보임)', function () {
    var records = [
      { id: 'r1', type: '기록', user_key: 'u_me1', note: '처음', created_at: '2026-11-20T00:00:00+00:00' },
      { id: 'p1', type: '수정', user_key: 'u_me1', target: 'r1', payload: { cells: { '소셜글': '고침' } }, created_at: '2026-11-20T00:01:00+00:00' },
      { id: 'p2', type: '수정', user_key: 'u_me1', target: 'r1', payload: { cells: { '소셜글': '마지막' } }, created_at: '2026-11-20T00:02:00+00:00' },
      { id: 'r2', type: '기록', user_key: 'u_me1', note: '지울 것', created_at: '2026-11-20T00:03:00+00:00' },
      { id: 'd1', type: '삭제', user_key: 'u_me1', target: 'r2', created_at: '2026-11-20T00:04:00+00:00' }
    ];
    var rows = BM.api.reconcileRecords(records);
    eq(rows.length, 1, '살아 있는 행만');
    eq(rows[0][0], 'r1', 'r1 만 남는다');
    eq(rows[0][D.COL['소셜글']], '마지막', '나중 수정이 이긴다');
    rows.forEach(function (r) {
      ok(String(r[D.COL['유형']]) !== '수정' && String(r[D.COL['유형']]) !== '삭제', '기록 행은 넘기지 않는다');
    });
  });

  test('v1.24 겹쳐 읽기: 남의 행에 붙인 수정·삭제는 무시한다', function () {
    var records = [
      { id: 'r1', type: '기록', user_key: 'u_other', note: '남의 기록', created_at: '2026-11-20T00:00:00+00:00' },
      { id: 'p1', type: '수정', user_key: 'u_me1', target: 'r1', payload: { cells: { '소셜글': '몰래 고침' } }, created_at: '2026-11-20T00:01:00+00:00' },
      { id: 'd1', type: '삭제', user_key: 'u_me1', target: 'r1', created_at: '2026-11-20T00:02:00+00:00' }
    ];
    var rows = BM.api.reconcileRecords(records);
    eq(rows.length, 1, '남의 행은 그대로 보인다');
    eq(rows[0][D.COL['소셜글']], '남의 기록', '남의 글은 바뀌지 않는다');
  });

  /* =========================================================
   * 3) Supabase REST
   * ========================================================= */
  test('v1.24 Supabase: bootstrap 이 표를 읽어 26칸 행으로 넘긴다', function () {
    var f = useFetch(function (call) {
      ok(call.url.indexOf('/rest/v1/app_records') > 0, '표 주소');
      ok(call.headers.apikey, 'apikey 헤더');
      eq(call.headers.Authorization, 'Bearer ' + call.headers.apikey, 'Bearer 토큰');
      ok(/^\d+-\d+$/.test(call.headers.Range), '1000행씩 나눠 읽기');
      return {
        status: 200, body: [
          { id: 'r1', type: '기록', user_key: 'u_me1', note: '오늘 훈련', cond: 7, created_at: '2026-11-20T00:00:00+00:00' },
          { id: 'p1', type: '수정', user_key: 'u_me1', target: 'r1', payload: { cells: { '운동시간(분)': '120' } }, created_at: '2026-11-20T00:10:00+00:00' }
        ]
      };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1', me: { nick: '승우' } });
    return api.bootstrap().then(function (res) {
      eq(f.calls.length, 1, '한 번에 끝');
      eq(res.rows.length, 1, '살아 있는 행');
      eq(res.rows[0][D.COL['운동시간(분)']], '120', '수정이 겹쳐졌다');
      eq(res.me.key, 'u_me1', '내 키');
      eq(res.me.nick, '승우', '내 닉네임');
      eq(res.token, 'supabase', '토큰 표시');
    });
  });

  test('v1.24 Supabase: append 는 한 번만 저장하고, 같은 ID 는 중복으로 넘긴다', function () {
    var rows = [];
    var f = useFetch(function (call) {
      var rec = bodyOf(call);
      if (rows.some(function (r) { return r.id === rec.id; })) return { status: 409, body: { code: '23505', message: 'duplicate' } };
      rows.push(rec);
      return { status: 201, body: '' };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    var row = D.toRow({ id: 'r9', type: '기록', userKey: 'u_me1', date: '2026-11-20', cond: 6, mode: 21 });
    return api.append(row, 'c1').then(function (res) {
      eq(res.id, 'r9', '저장한 ID');
      var call = f.calls[0];
      eq(call.method, 'POST', 'POST');
      eq(call.headers.Prefer, 'return=minimal', '응답 본문 없이');
      var rec = bodyOf(call);
      eq(rec.id, 'r9', 'id');
      eq(rec.type, '기록', 'type');
      eq(rec.user_key, 'u_me1', 'user_key');
      eq(rec.cond, 6, '숫자 칸');
      return api.append(row, 'c1');
    }).then(function (res) {
      eq(res.duplicate, true, '두 번째는 중복');
      eq(rows.length, 1, '표에는 한 행');
      eq(f.calls.length, 2, '두 번 보냈지만 한 번만 쌓임');
    });
  });

  test('v1.24 Supabase: 수정·삭제는 0행이면 겹쳐 읽는 기록 행으로 남긴다', function () {
    var f = useFetch(function (call) {
      if (call.method === 'PATCH') return { status: 204, body: '' };    /* anon 은 정책이 없어 0행 */
      if (call.method === 'DELETE') return { status: 204, body: '' };
      return { status: 201, body: '' };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    return api.update('r1', { '운동시간(분)': '120' }, 'c2').then(function (res) {
      eq(res.marked, true, '기록 행으로 남김');
      var patch = f.calls[0];
      eq(patch.method, 'PATCH', '먼저 진짜 수정 시도');
      includes(patch.url, 'id=eq.r1', '내 행만');
      includes(patch.url, 'user_key=eq.u_me1', '내 키만');
      var mark = bodyOf(f.calls[1]);
      eq(mark.type, '수정', '수정 기록');
      eq(mark.target, 'r1', '대상');
      eq(mark.payload.cells['운동시간(분)'], '120', '바뀐 칸');
      eq(mark.user_key, 'u_me1', '내 키');
      return api.remove('r1', 'c3');
    }).then(function (res) {
      eq(res.marked, true, '삭제도 기록 행');
      var del = f.calls[2];
      eq(del.method, 'DELETE', '먼저 진짜 삭제 시도');
      var mark = bodyOf(f.calls[3]);
      eq(mark.type, '삭제', '삭제 기록');
      eq(mark.target, 'r1', '대상');
    });
  });

  test('v1.24 Supabase: 서버가 직접 바꿔 주면(로그인 연결) 기록 행을 남기지 않는다', function () {
    var f = useFetch(function (call) {
      if (call.method === 'PATCH') return { status: 200, body: [{ id: 'r1' }] };
      if (call.method === 'DELETE') return { status: 200, body: [{ id: 'r1' }] };
      return { status: 201, body: '' };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    return api.update('r1', { '컨디션': '8' }).then(function (res) {
      eq(res.native, true, '서버가 직접 수정');
      return api.remove('r1');
    }).then(function (res) {
      eq(res.native, true, '서버가 직접 삭제');
      eq(f.calls.length, 2, 'PATCH·DELETE 두 번뿐');
    });
  });

  /* =========================================================
   * 4) 저장소 고르기
   * ========================================================= */
  test('v1.24 저장소: 기본은 Supabase, 게스트는 기기 저장, 시트 연결 기기는 시트 유지', function () {
    U.storage.removeItem(BM.api.BACKEND_KEY);
    U.storage.removeItem('bm_mode_v1');
    U.storage.removeItem(BM.api.SESSION_KEY);

    eq(BM.api.backendFor({ kind: 'google', email: 'a@b.c' }), 'supabase', '로그인 계정 기본');
    eq(BM.api.backendFor({ kind: 'email', email: 'a@b.c' }), 'supabase', '이메일 계정 기본');
    eq(BM.api.backendFor({ kind: 'guest' }), 'local', '게스트는 이 기기');
    eq(BM.api.backendFor(null), 'local', '로그인 전은 이 기기');

    /* 예전에 구글 시트를 직접 연결한 기기 */
    U.writeJSON(BM.api.SESSION_KEY, { token: 'tok', url: 'https://script.google.com/macros/s/x/exec' });
    U.writeJSON('bm_mode_v1', 'sheets');
    eq(BM.api.backendFor({ kind: 'email', email: 'a@b.c' }), 'sheets', '시트 연결 기기는 그대로');

    /* 사용자가 MY 에서 Supabase 로 바꾼 기기 */
    U.writeJSON(BM.api.BACKEND_KEY, 'supabase');
    eq(BM.api.backendFor({ kind: 'email', email: 'a@b.c' }), 'supabase', '바꾼 선택이 이긴다');

    /* 사용자가 시트를 고른 기기 */
    U.writeJSON(BM.api.BACKEND_KEY, 'sheets');
    eq(BM.api.backendFor({ kind: 'email', email: 'a@b.c' }), 'sheets', '시트 선택');

    /* 시트 토큰이 없으면 시트로 갈 수 없다 */
    U.storage.removeItem(BM.api.SESSION_KEY);
    eq(BM.api.backendFor({ kind: 'email', email: 'a@b.c' }), 'supabase', '토큰 없으면 서버로');

    U.storage.removeItem(BM.api.BACKEND_KEY);
    U.storage.removeItem('bm_mode_v1');
  });

  /* =========================================================
   * 5) 공개 키만
   * ========================================================= */
  test('v1.24 보안: 앱에는 공개 키만 들어 있다 (service_role·DB 비밀번호 없음)', function () {
    ok(BM.api.SUPABASE.publishableKey.indexOf('sb_publishable_') === 0, 'publishable 키');
    ok(/^eyJ/.test(BM.api.SUPABASE.anonKey), 'anon JWT');
    eq(BM.api.SUPABASE.url, 'https://mwgpakntlollndfluwgg.supabase.co', '프로젝트 주소');
    if (!hasNode()) return;
    var Buffer = require('buffer').Buffer;
    function jwtRole(token) {
      try {
        var payload = String(token).split('.')[1];
        var json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        return (JSON.parse(json) || {}).role || '';
      } catch (e) { return ''; }
    }
    eq(jwtRole(BM.api.SUPABASE.anonKey), 'anon', 'anon 키의 역할은 anon');
    var files = ['js/api.js', 'app.js', 'index.html', 'sw.js', 'manifest.webmanifest'];
    files.forEach(function (file) {
      var text = readRoot(file);
      excludes(text, 'sb_secret_', file + ' 에 비밀 키 없음');
      excludes(text, 'service_role_key', file + ' 에 service_role 키 없음');
      excludes(text, 'db_password', file + ' 에 DB 비밀번호 없음');
      (text.match(/eyJ[A-Za-z0-9_\-\.]{20,}/g) || []).forEach(function (token) {
        eq(jwtRole(token), 'anon', file + ' 의 JWT 는 anon 만');
      });
    });
  });

  /* =========================================================
   * 6) Realtime
   * ========================================================= */
  test('v1.24 실시간: join 을 보내고, 새 행을 핸들러로 넘긴다', function () {
    FakeWS.instances = [];
    root.WebSocket = FakeWS;
    var got = [];
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    var sub = api.subscribe(function (change) { got.push(change); });
    ok(!!sub && typeof sub.close === 'function', '구독 핸들');
    eq(FakeWS.instances.length, 1, '소켓 하나');
    var ws = FakeWS.instances[0];
    includes(ws.url, '/realtime/v1/websocket?apikey=', '주소');
    includes(ws.url, 'vsn=1.0.0', '프로토콜');
    ws.open();
    eq(ws.sent.length, 1, 'join 한 번');
    var join = ws.sent[0];
    eq(join.event, 'phx_join', 'join');
    eq(join.topic, 'realtime:public:app_records', '표 구독');
    eq(join.payload.config.postgres_changes[0].event, '*', '모든 변경');
    eq(join.payload.config.postgres_changes[0].table, 'app_records', '표 이름');
    eq(join.join_ref, join.ref, 'join_ref');

    ws.receive({ event: 'phx_reply', payload: { status: 'ok' }, ref: join.ref });
    ws.receive({
      event: 'postgres_changes',
      payload: { data: { type: 'INSERT', table: 'app_records', record: REC } }
    });
    eq(got.length, 1, '핸들러 한 번');
    eq(got[0].record.id, 'r1', '행 전체가 온다');
    api.close();
    ok(ws.closedByApp, '닫으면 소켓도 닫는다');
  });

  test('v1.24 실시간: 연결이 끊기면 스스로 다시 붙는다', function () {
    FakeWS.instances = [];
    root.WebSocket = FakeWS;
    var realTO = root.setTimeout;
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    var sub = api.subscribe(function () {});
    eq(FakeWS.instances.length, 1, '처음 소켓');
    FakeWS.instances[0].open();
    /* 끊김 → 다시 붙기(테스트에서는 타이머를 바로 실행) */
    root.setTimeout = function (fn) { fn(); return 0; };
    FakeWS.instances[0].drop();
    root.setTimeout = realTO;
    ok(FakeWS.instances.length >= 2, '새 소켓으로 다시 붙는다');
    var again = FakeWS.instances[FakeWS.instances.length - 1];
    again.open();
    eq(again.sent[0].event, 'phx_join', '다시 join');
    sub.close();
  });

  /* =========================================================
   * 7) store.listen — 화면·알림 배너
   * ========================================================= */
  test('v1.24 실시간: 새 1:1 메시지가 바로 화면과 알림 배너에 들어온다 (중복 없음)', function () {
    FakeWS.instances = [];
    root.WebSocket = FakeWS;
    useFetch(function (call) {
      if (call.method === 'GET') return { status: 200, body: [] };
      return { status: 201, body: '' };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1', me: { nick: '나' } });
    var store = BM.store.createStore({ api: api });
    var paints = 0;
    store.subscribe(function () { paints++; });
    var message = {
      id: 'm1', type: '매칭채팅', user_key: 'u_other', target: 'u_me1', nick: '상대',
      note: '내일 7시 어때요?', created_at: new Date().toISOString()
    };
    return store.actions.init().then(function () {
      eq(store.state.mode, 'supabase', '모드');
      store.state.notifySince = '2026-01-01 00:00:00';
      ok(store.actions.listen(), '구독 시작');
      eq(store.state.realtime, 'live', '연결 표시');
      var ws = FakeWS.instances[FakeWS.instances.length - 1];
      ws.open();
      ws.receive({ event: 'phx_reply', payload: { status: 'ok' } });
      var before = paints;
      ws.receive({ event: 'postgres_changes', payload: { data: { type: 'INSERT', record: message } } });
      eq(store.state.inbox.total, 1, '새 소식 1건');
      eq(store.state.inbox.messages[0].text, '내일 7시 어때요?', '메시지 내용');
      eq(store.state.inbox.messages[0].roomId, 'm1', '방');
      eq(store.state.inbox.messages[0].from, 'u_other', '보낸 사람');
      eq(store.state.rows.length, 1, '화면 상태에도 들어온다');
      ok(paints > before, '화면을 다시 그린다');
      var tab = store.state.data.threads || [];
      eq(tab.length, 1, '채팅 목록에 방이 생긴다');

      /* 같은 행이 다시 와도 두 번 넣지 않는다 */
      ws.receive({ event: 'postgres_changes', payload: { data: { type: 'INSERT', record: message } } });
      eq(store.state.rows.length, 1, '중복 없음');
      store.actions.stopListening();
      eq(store.state.realtime, 'off', '구독 해제');
    });
  });

  test('v1.24 실시간: 다른 기기의 수정·삭제 행이 오면 전체를 다시 받아 맞춘다', function () {
    FakeWS.instances = [];
    root.WebSocket = FakeWS;
    var gets = 0;
    useFetch(function (call) {
      if (call.method === 'GET') {
        gets++;
        return { status: 200, body: [{ id: 'r1', type: '기록', user_key: 'u_me1', note: '고친 글', created_at: '2026-11-20T00:00:00+00:00' }] };
      }
      return { status: 201, body: '' };
    });
    var api = BM.api.createSupabase({ meKey: 'u_me1' });
    var store = BM.store.createStore({ api: api });
    var realTO = root.setTimeout;
    return store.actions.init().then(function () {
      store.actions.listen();
      var ws = FakeWS.instances[FakeWS.instances.length - 1];
      ws.open();
      ws.receive({ event: 'phx_reply', payload: { status: 'ok' } });
      var before = gets;
      root.setTimeout = function (fn) { fn(); return 0; };
      ws.receive({
        event: 'postgres_changes',
        payload: { data: { type: 'INSERT', record: { id: 'p1', type: '수정', user_key: 'u_me1', target: 'r1', payload: { cells: {} } } } }
      });
      root.setTimeout = realTO;
      ok(gets > before, '다시 받아 왔다');
      store.actions.stopListening();
    });
  });

  /* =========================================================
   * 8) 버전
   * ========================================================= */
  test('v1.24 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.90.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.90.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261127-4', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.90.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.90.0', 'TWA appVersion');
    eq(twa.appVersionCode, 84, 'TWA 버전 코드');
    /* 서비스워커가 새 파일을 먼저 받아 두는 목록에 api.js 가 있다 */
    includes(readRoot('sw.js'), "./js/api.js", 'sw.js 캐시 목록');
    /* 앱 화면이 Supabase 모드를 알고 있다 */
    includes(readRoot('app.js'), 'createSupabase', 'app.js 저장소 선택');
    includes(readRoot('js/views/my.js'), '실시간 서버', 'MY 데이터 연결 문구');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
