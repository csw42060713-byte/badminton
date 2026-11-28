/* ============================================================
 * test/v192.test.js — bm-v1.96.0
 *   1) 1:1 매칭 수락/거절이 서버 저장 후에도 유지된다 (치명 버그)
 *      · 원인: 요청 행 주인(신청자)의 '수정' 행만 겹쳐 읽어, 수락자의 응답이 영원히 무시됨
 *      · 수정: 매칭신청 행에 한해 '받은 사람'의 응답(수락·거절)만 정당하게 병합
 *      · 검증: A 신청 → B 수락 → reconcileRecords 재동기화 후에도 수락 + 하트 -2 + 대화방 유지
 *   2) 회원 탈퇴 직후 /auth/v1/logout 403 이 사라진다 (기기 세션만 정리)
 *   3) 계정이 지워진 예전 시험용 유저(우승·환비·나래)의 카드는 매칭 목록에서 빠진다
 *   4) supabase/heart-rpc-v1.92-all.sql — v1.82·v1.84·v1.86 통합(멱등 · 43개 가격 일치)
 *   5) 버전 — sw · app · push · 스타일 캐시 · TWA · README
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  /* ---------- 가짜 fetch (v124 와 같은 방식) ---------- */
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
  function useFetch(handler) {
    var f = fakeFetch(handler);
    root.fetch = f;
    return f;
  }
  function restoreFetch(prev) {
    if (prev === undefined) { try { delete root.fetch; } catch (e) { root.fetch = undefined; } }
    else root.fetch = prev;
  }

  /* ---------- A(신청자) → B(받은 사람) 매칭 기록 ---------- */
  var A = 'u_192_a', B = 'u_192_b', C = 'u_192_c';
  var ROOM = 'm192room';

  function requestRecord() {
    return {
      id: ROOM, type: '매칭신청', user_key: A, nick: '신청A', target: B, win: '대기',
      payload: {
        note: '토요일 오전 9시 나래울 어때요?', heartCost: 2, payOn: 'accept', status: '대기'
      },
      created_at: '2026-11-27T05:00:00+00:00'
    };
  }
  function replyRecord(author, status, charged) {
    var body = { note: '토요일 오전 9시 나래울 어때요?', heartCost: 2, payOn: 'accept', status: status };
    if (charged != null) body.charged = charged;
    return {
      id: 'p192_' + author + '_' + status, type: '수정', user_key: author, target: ROOM,
      payload: { cells: { '승패': status, '소셜글': JSON.stringify(body) }, at: '2026-11-27 14:01' },
      created_at: '2026-11-27T05:01:00+00:00'
    };
  }
  /* bm-v1.96.0 실제 저장 형태 — 받은 사람이 신청자 주소(target=신청자)로 보내고,
   * 어느 요청의 응답인지는 payload.match 에 적습니다(RLS 상 양쪽이 읽을 수 있는 주소). */
  function replyToSender(author, status, charged) {
    var rec = replyRecord(author, status, charged);
    rec.target = A;
    rec.payload.match = ROOM;
    rec.created_at = '2026-11-27T05:03:00+00:00';
    return rec;
  }
  function rowOf(rows, id) {
    return rows.filter(function (r) { return String(r[0]) === String(id); })[0] || [];
  }
  function payloadOf(row) {
    try { return JSON.parse(String(row[D.COL['소셜글']] || '{}')); } catch (e) { return {}; }
  }

  /* =========================================================
   * 1) 매칭 수락/거절 — 재동기화 후에도 유지
   * ========================================================= */

  test('v1.92 매칭: A가 신청 → B가 수락 → 재동기화(reconcileRecords) 후에도 수락 상태가 유지된다', function () {
    var rows = BM.api.reconcileRecords([requestRecord(), replyRecord(B, '수락', 2)]);
    eq(rows.length, 1, '요청 행 하나');
    eq(String(rows[0][0]), ROOM, '대화방 ID가 되는 요청 행 ID');
    eq(String(rows[0][D.COL['승패']]), '수락', "'승패' 칸이 수락");
    eq(payloadOf(rows[0]).status, '수락', 'payload.status 수락');
    eq(payloadOf(rows[0]).note, '토요일 오전 9시 나래울 어때요?', '신청 한마디는 그대로');
    eq(payloadOf(rows[0]).payOn, 'accept', '수락 때 지불 규칙도 그대로');
  });

  test('v1.92 매칭: B가 거절하면 재동기화 후에도 거절로 남고 하트는 그대로다', function () {
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '거절')]);
    var row = rowOf(rows, ROOM);
    eq(String(row[D.COL['승패']]), '거절', '거절 유지');
    eq(payloadOf(row).charged, undefined, '차감 기록 없음');
    var st = BM.store.derive(rows, A);
    eq(st.hearts.balance, 3, '신청자 하트 그대로(기본 3)');
  });

  test('v1.92 매칭: 수락으로 바뀌면 신청자 하트 2개가 원장에서 빠진다', function () {
    var before = BM.store.derive(BM.api.reconcileRecords([requestRowForHearts()]), A);
    eq(before.hearts.balance, 3, '수락 전 기본 3');
    var after = BM.store.derive(BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '수락', 2)]), A);
    eq(after.hearts.balance, 1, '수락 후 3 - 2 = 1');
    ok(after.hearts.history.some(function (h) { return h.label === '매칭 성사' && h.delta === -2; }),
      '원장에 매칭 성사 -2');
  });

  test('v1.92 매칭: 수락하면 두 사람 모두 대화방이 남는다 (새로고침·재동기화 후)', function () {
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '수락', 2)]);
    [A, B].forEach(function (me) {
      var st = BM.store.derive(rows, me);
      var thread = (st.threads || []).filter(function (t) { return String(t.roomId) === ROOM; })[0];
      ok(thread, (me === A ? '신청자' : '수락자') + ' 대화방 유지');
      eq(thread.other, me === A ? B : A, '상대가 맞다');
      eq(thread.kind, 'match', '1:1 매칭 대화방');
    });
    ok(D.canChatWith(BM.store.derive(rows, A).idx, A, B), '신청자가 대화할 수 있다');
    ok(D.canChatWith(BM.store.derive(rows, B).idx, B, A), '수락자도 대화할 수 있다');
    var inb = BM.store.derive(rows, B);
    var got = (inb.requests || []).filter(function (r) { return r.id === ROOM; })[0];
    ok(got, 'B의 받은 요청 목록에 남아 있다');
    eq(got.status, '수락', '받은 요청도 수락으로 표시');
  });

  test('v1.92 매칭: 신청자 주소로 온 응답(payload.match)도 신청자 화면에서 수락으로 반영된다', function () {
    /* 실서버에서는 요청 행에 붙은 '수정' 행을 신청자가 읽을 수 없어(RLS),
     * 받은 사람이 신청자 주소(target=신청자)로 응답을 보냅니다. */
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyToSender(B, '수락', 2)]);
    var row = rowOf(rows, ROOM);
    eq(String(row[D.COL['승패']]), '수락', '신청자 시야에서도 수락');
    eq(payloadOf(row).charged, 2, '차감 2개');
    var st = BM.store.derive(rows, A);
    eq(st.hearts.balance, 1, '신청자 하트 3 - 2 = 1');
    ok((st.threads || []).some(function (t) { return t.roomId === ROOM; }), '대화방도 생긴다');
  });

  test('v1.92 매칭: 신청자 본인이 응답 형식으로 자기 요청을 수락해 차감을 피할 수 없다', function () {
    var self = replyToSender(A, '수락', 0);
    var rows = BM.api.reconcileRecords([requestRowForHearts(), self]);
    eq(String(rowOf(rows, ROOM)[D.COL['승패']]), '대기', '신청자 자신의 응답은 무시');
    eq(BM.store.derive(rows, A).hearts.balance, 3, '하트도 그대로');
  });

  test('v1.92 매칭: 제3자가 신청자 주소로 보낸 응답도 무시한다', function () {
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyToSender(C, '수락', 2)]);
    eq(String(rowOf(rows, ROOM)[D.COL['승패']]), '대기', '제3자는 병합되지 않는다');
  });

  test('v1.92 매칭: 저장 요청이 신청자 주소(target)와 payload.match 로 나간다', function () {
    var sent = [];
    var fake = {
      mode: 'supabase',
      bootstrap: function () {
        return Promise.resolve({
          me: { key: B, nick: '수락자' },
          rows: [D.toRow({
            id: ROOM, type: '매칭신청', userKey: A, nick: '신청A', target: B, status: '대기',
            createdAt: '2026-11-27 14:00:00', date: '2026-11-27',
            payload: { note: '같이 쳐요', heartCost: 2, payOn: 'accept', status: '대기' }
          })],
          syncedAt: ''
        });
      },
      update: function (id, cells, clientId, reply) { sent.push({ id: id, reply: reply, cells: cells }); return Promise.resolve({ id: id }); },
      append: function () { return Promise.resolve({ id: 'x' }); },
      remove: function () { return Promise.resolve({ id: 'x' }); },
      resetDemo: function () { return Promise.resolve({ ok: false }); }
    };
    var store = BM.store.createStore({ api: fake });
    return store.actions.init().then(function () {
      var res = store.actions.respondMatch(ROOM, '수락');
      ok(res.ok, '수락 처리');
      /* flush 는 큐 한 건을 같은 틱에 바로 보냅니다(테스트에는 타이머가 없습니다) */
      eq(sent.length, 1, '한 번 저장');
      eq(sent[0].id, ROOM, '요청 행 ID');
      eq(sent[0].reply, A, '신청자 주소로 보낸다');
      eq(sent[0].cells['승패'], '수락', '상태 칸');
    });
  });

  test('v1.92 매칭: 제3자(C)가 남의 요청 행에 붙인 수락은 무시한다', function () {
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(C, '수락', 2)]);
    var row = rowOf(rows, ROOM);
    eq(String(row[D.COL['승패']]), '대기', '제3자의 응답은 반영되지 않는다');
    eq(BM.store.derive(rows, A).hearts.balance, 3, '하트도 그대로');
  });

  test('v1.92 매칭: 받은 사람이라도 수락·거절이 아닌 값은 반영하지 않는다', function () {
    var rows = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '몰래', 0)]);
    eq(String(rowOf(rows, ROOM)[D.COL['승패']]), '대기', '모르는 상태값 무시');
  });

  test('v1.92 매칭: 응답의 차감값은 0~heartCost 로 잘라 쓴다 (부풀리기 방지)', function () {
    var over = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '수락', 99)]);
    eq(payloadOf(rowOf(over, ROOM)).charged, 2, '2개를 넘길 수 없다');
    var none = BM.api.reconcileRecords([requestRowForHearts(), replyRecord(B, '수락', 1)]);
    eq(payloadOf(rowOf(none, ROOM)).charged, 1, '모자란 만큼만');
    eq(payloadOf(rowOf(none, ROOM)).short, 1, '부족분 기록');
    eq(BM.store.derive(none, A).hearts.balance, 2, '있는 만큼만 차감(3 - 1)');
  });

  test('v1.92 보호: 남의 기록 행에 붙은 수정은 예전처럼 무시한다 (매칭 외 예외 없음)', function () {
    var rows = BM.api.reconcileRecords([
      { id: 'log1', type: '기록', user_key: A, note: '내 일지', created_at: '2026-11-27T04:00:00+00:00' },
      { id: 'p1', type: '수정', user_key: B, target: 'log1', payload: { cells: { '소셜글': '몰래 고침' } }, created_at: '2026-11-27T04:01:00+00:00' }
    ]);
    eq(rows.length, 1, '기록 하나');
    eq(String(rows[0][D.COL['소셜글']]), '내 일지', '남의 기록은 바뀌지 않는다');
  });

  test('v1.92 매칭: 신청자 본인이 남긴 수정은 예전처럼 그대로 겹쳐 읽는다', function () {
    var rows = BM.api.reconcileRecords([
      requestRowForHearts(),
      { id: 'pa', type: '수정', user_key: A, target: ROOM, payload: { cells: { '소셜글': JSON.stringify({ note: '시간 바꿔도 될까요?', heartCost: 2, payOn: 'accept', status: '대기' }) } }, created_at: '2026-11-27T05:02:00+00:00' }
    ]);
    eq(payloadOf(rowOf(rows, ROOM)).note, '시간 바꿔도 될까요?', '신청자 수정 반영');
  });

  test('v1.92 매칭: 서버에서 다시 받아도(bootstrap) 수락과 대화방이 유지된다', function () {
    var prev = root.fetch;
    var f = useFetch(function () {
      return { status: 200, body: [requestRowForHearts(), replyToSender(B, '수락', 2)] };
    });
    var api = BM.api.createSupabase({ meKey: A, me: { nick: '신청A' }, timeout: 0 });
    return api.bootstrap().then(function (res) {
      eq(f.calls.length, 1, '표를 한 번에 읽는다');
      var st = BM.store.derive(res.rows, A);
      var req = (st.requests || []).filter(function (r) { return r.id === ROOM; })[0];
      ok(req, '신청 기록이 보인다');
      eq(req.status, '수락', '새로고침해도 수락');
      eq(st.hearts.balance, 1, '하트도 차감된 상태로 복원');
      ok((st.threads || []).some(function (t) { return String(t.roomId) === ROOM; }), '대화방도 남아 있다');
      restoreFetch(prev);
    }, function (e) { restoreFetch(prev); throw e; });
  });

  /* 하트 계산용 — 신청자 A의 요청 행 하나만 (기본 3하트) */
  function requestRowForHearts() { return requestRecord(); }

  /* =========================================================
   * 2) 탈퇴 직후 logout 403
   * ========================================================= */

  test('v1.92 탈퇴: 서버 계정이 지워진 뒤에는 /auth/v1/logout 을 부르지 않고 기기 세션만 비운다', function () {
    var prev = root.fetch;
    var f = useFetch(function () { return { status: 200, body: {} }; });
    ok(typeof BM.auth.signOutLocal === 'function', '기기 세션만 지우는 로그아웃이 있다');
    BM.auth.signOutLocal();
    eq(f.calls.length, 0, '서버 로그아웃 요청 0건 → 403 없음');
    eq(BM.auth.sbAuthState(), null, '서버 토큰은 비워진다');
    restoreFetch(prev);
  });

  test('v1.92 탈퇴: 앱의 탈퇴 처리는 성공하면 서버 로그아웃을 건너뛰도록 연결되어 있다', function () {
    if (!hasNode()) return;
    var app = readRoot('app.js');
    includes(app, 'signOut(serverGone)', '탈퇴 성공 시 기기 세션만 정리');
    includes(app, 'BM.auth.signOutLocal', 'signOutLocal 로 연결');
    var auth = readRoot('js/auth.js');
    includes(auth, 'function signOutLocal()', 'auth.js 에 signOutLocal');
    includes(auth, 'signOutLocal: signOutLocal', '내보내기');
    /* 탈퇴 안내 문구가 그대로인지(기존 기능 보호) */
    includes(app, '탈퇴가 완료됐어요', '탈퇴 토스트 유지');
  });

  /* =========================================================
   * 3) 계정이 지워진 예전 시험용 유저
   * ========================================================= */

  test('v1.92 시드: 계정이 없는 예전 시험용 유저(우승·환비·나래)는 매칭 목록에서 빠진다', function () {
    ok(BM.seed.isRetiredUser('u_bd730c28ae44'), '우승 카드');
    ok(BM.seed.isRetiredUser('u_632d2cad4830'), '환비 카드');
    ok(BM.seed.isRetiredUser('u_4f3c0b40e9b0'), '나래 카드');
    eq(BM.seed.isRetiredUser('u_509ccd20c3e1'), false, '실제 회원은 그대로');

    var rows = [
      D.toRow({ id: 'mp1', type: '매칭프로필', userKey: 'u_bd730c28ae44', nick: '우승', createdAt: U.stamp(), date: U.ymd(), payload: { level: '자강', region: '경기', discipline: '단식' } }),
      D.toRow({ id: 'mp2', type: '매칭프로필', userKey: 'u_632d2cad4830', nick: '환비', createdAt: U.stamp(), date: U.ymd(), payload: { level: '초심', discipline: '복식' } }),
      D.toRow({ id: 'mp3', type: '매칭프로필', userKey: 'u_4f3c0b40e9b0', nick: '나래', createdAt: U.stamp(), date: U.ymd(), payload: { level: 'C조', region: '경기', discipline: '복식' } }),
      D.toRow({ id: 'mp4', type: '매칭프로필', userKey: 'u_real_192', nick: '실회원', createdAt: U.stamp(), date: U.ymd(), payload: { level: 'B조', region: '경기', discipline: '복식' } })
    ];
    var st = BM.store.derive(rows, 'u_192_me');
    var nicks = (st.matchProfiles || []).map(function (p) { return p.nick; }).sort().join(',');
    eq(nicks, '실회원', '실제 회원 카드만 남는다');
  });

  test('v1.92 시드: 매칭 화면도 시험용 유저 이름을 그리지 않는다', function () {
    var rows = [
      D.toRow({ id: 'mp1', type: '매칭프로필', userKey: 'u_bd730c28ae44', nick: '우승', createdAt: U.stamp(), date: U.ymd(), payload: { level: '자강', region: '경기', discipline: '단식' } }),
      D.toRow({ id: 'mp4', type: '매칭프로필', userKey: 'u_real_192', nick: '실회원', createdAt: U.stamp(), date: U.ymd(), payload: { level: 'B조', region: '경기', discipline: '복식' } })
    ];
    var html = BM.views.matching.render ? BM.views.matching.render(stateWith(rows)) : '';
    if (!html) return;
    excludes(html, '우승', '시험용 카드 제외');
    includes(html, '실회원', '실제 회원은 보인다');
  });

  function stateWith(rows) {
    return {
      ready: true, mode: 'local', me: { key: 'u_192_me', nick: '나' }, rows: rows,
      data: BM.store.derive(rows, 'u_192_me'),
      drafts: {}, analysis: null, queue: [], stats: { writes: 0, blocked: 0, failed: 0 },
      ui: {
        tab: 'matching', matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', chatRoom: null
      }
    };
  }

  /* =========================================================
   * 4) heart-rpc-v1.92-all.sql
   * ========================================================= */

  test('v1.92 SQL: v1.82 · v1.84 · v1.86 을 한 파일로 합쳤고 여러 번 실행해도 안전하다', function () {
    if (!hasNode()) return;
    var sql = readRoot('supabase/heart-rpc-v1.92-all.sql');
    ['bm_smash_price', 'bm_racket_price', 'heart_spend'].forEach(function (fn) {
      includes(sql, 'create or replace function public.' + fn, fn + ' 정의');
    });
    ['deco', 'gift', 'match', 'smash', 'racket'].forEach(function (kind) {
      includes(sql, "v_kind = '" + kind + "'", 'heart_spend 종류 ' + kind);
    });
    includes(sql, "when 'effect:ice'", '스매시 얼음 이펙트');
    includes(sql, "when 'motion:flip'", '모션 플립(v1.86)');
    includes(sql, "when 'motion:twist'", '모션 트위스트(v1.86)');
    ['frame:onyx', 'grip:towel', 'grip:twotone'].forEach(function (p) {
      includes(sql, "when '" + p + "'", 'v1.87 레전드 파츠 ' + p + ' 가 빠지지 않는다');
    });
    includes(sql, 'grant execute on function public.heart_spend', '실행 권한 안내');
    includes(sql, 'grant execute on function public.bm_racket_price', '가격표 권한');
    excludes(sql, 'drop table', '표를 지우지 않는다');
    excludes(sql, 'alter table public.app_records', '기존 표 구조를 바꾸지 않는다');
    eq((sql.match(/\$\$/g) || []).length % 2, 0, '$$ 짝이 맞는다');
  });

  test('v1.92 SQL: 가격표가 앱(js/racketcustom.js)의 하트 가격 전부와 일치한다', function () {
    if (!hasNode()) return;
    /* bm-v1.96.0 — 새 그립·임팩트 파츠가 들어간 통합 SQL(v1.95)이 최신 가격표입니다 */
    var sql = readRoot('supabase/heart-rpc-v1.95-all.sql');
    var m = sql.match(/create or replace function public\.bm_racket_price[\s\S]*?end;/);
    ok(m, 'bm_racket_price 본문');
    var db = {};
    (m[0].match(/when '([^']+)'\s+then (\d+)/g) || []).forEach(function (line) {
      var mm = line.match(/when '([^']+)'\s+then (\d+)/);
      db[mm[1]] = Number(mm[2]);
    });
    var RC = BM.racketcustom;
    var app = {};
    Object.keys(RC.PARTS).forEach(function (slot) {
      (RC.PARTS[slot].items || []).forEach(function (it) {
        app[slot + ':' + it.id] = it.heart == null ? 0 : it.heart;
      });
    });
    Object.keys(RC.BODIES).forEach(function (id) {
      var b = RC.BODIES[id];
      app['body:' + id] = b.heart == null ? 0 : b.heart;
    });
    ok(Object.keys(app).length >= 67, '앱 품목 ' + Object.keys(app).length + '개');
    Object.keys(app).forEach(function (key) {
      eq(db[key], app[key], key + ' 가격');
    });
    Object.keys(db).forEach(function (key) {
      ok(app[key] != null, '서버에만 있는 품목 없음: ' + key);
    });
  });

  /* =========================================================
   * 5) 버전
   * ========================================================= */

  test('v1.92 버전: sw · app · push · 스타일 캐시 · TWA · README', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.100.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.100.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.100.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.100.0', 'TWA 이름');
    eq(twa.appVersion, '1.100.0', 'TWA appVersion');
    eq(twa.appVersionCode, 94, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.100.0', 'README');
    includes(readRoot('test/run.js'), 'test/v192.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
