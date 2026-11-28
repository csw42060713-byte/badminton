/* ============================================================
 * test/v177.test.js — bm-v1.96.0
 *   🔔 푸시 토큰 저장 + 채팅·매칭 요청·게스트 신청 발송 서버 틀
 *
 *   1) DB 틀 — push_tokens·push_log, 본인 토큰만(RLS), register/unregister/my_push_tokens
 *   2) 서버 함수 — send-push 가 로그인을 확인하고, FCM 시크릿이 없으면 pending_fcm_secret 만
 *   3) 토큰 — 체험 모드는 기기에만 · Supabase 모드는 RPC, 네이티브 브리지(ShuttlixPush)
 *   4) 발송 — 체험·시트 모드는 조용히, Supabase 모드만 상대에게 부탁(실패해도 메시지는 그대로)
 *   5) 훅 — 채팅(1:1·단체)·약속 카드·매칭 요청·게스트 신청/수락이 상대에게 알림을 부른다
 *   6) 화면 — MY 알림에 '실시간 알림(앱 켜짐)' · '백그라운드 푸시(앱 닫힘)' 두 줄
 *   7) 보호·보안·버전 — 5개 탭·시트 26칸 그대로, 비밀 키 없음, 버전 정합
 *
 *   실행: node test/run.js
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
  function readJson(file) { return JSON.parse(readRoot(file)); }

  var ME = BM.seed.ME;
  var OTHER = 'demo_chi';

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      BM.push.TOKEN_KEY, BM.push.LAST_KEY].forEach(function (k) { U.storage.removeItem(k); });
  }

  function row(patch) {
    return D.toRow(patch);
  }

  /* 친구(1:1 대화 가능) + 상대가 쓴 게스트 모집 글 하나 */
  function baseRows() {
    return [
      row({ id: 'p_me', type: '프로필', createdAt: '2026-11-01 09:00:00', nick: '나래', userKey: ME, level: 'C조', discipline: '복식', club: '나래울' }),
      row({ id: 'p_other', type: '프로필', createdAt: '2026-11-01 09:05:00', nick: '콕집사', userKey: OTHER, level: 'B조', discipline: '복식', club: '나래울' }),
      row({ id: 'f_1', type: '친구수락', createdAt: '2026-11-02 09:00:00', nick: '나래', userKey: ME, target: OTHER }),
      row({ id: 'post_1', type: '소셜', createdAt: '2026-11-03 09:00:00', nick: '콕집사', userKey: OTHER, text: '오늘 저녁 같이 치실 분', topic: '게스트 모집' })
    ];
  }

  function stateOf(rows, patch) {
    rows = rows || baseRows();
    var st = {
      ready: true, mode: 'supabase',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, club: '나래울' },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: { tab: 'my', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '', stats: { writes: 0 }, prefs: {},
      realtime: 'off', routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || baseRows());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () {
      store.state.mode = 'supabase';      /* 서버 모드처럼 굴립니다(알림 훅이 이 값을 봅니다) */
      store.state.locks = {};
      return store;
    });
  }

  /* 알림 함수만 가로채 '누구에게 무엇을' 부탁했는지 봅니다 */
  function withNotify(fn) {
    var orig = BM.push.notify;
    var calls = [];
    BM.push.notify = function (kind, opts) {
      calls.push({ kind: kind, opts: opts || {} });
      return Promise.resolve({ ok: true, status: 'pending_fcm_secret' });
    };
    function done() { BM.push.notify = orig; }
    var out;
    try { out = fn(calls); } catch (e) { done(); throw e; }
    if (out && typeof out.then === 'function') return out.then(function (v) { done(); return v; }, function (e) { done(); throw e; });
    done();
    return out;
  }

  /* =========================================================
   * 1. DB 틀
   * ========================================================= */

  test('v1.77 DB: push_tokens·push_log 표와 함수 3개가 있다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/push-v1.77.sql');
    includes(sql, 'create table if not exists public.push_tokens', '토큰 표');
    includes(sql, 'create table if not exists public.push_log', '발송 기록 표');
    includes(sql, 'token       text not null unique', '토큰은 하나만(같은 기기 중복 없음)');
    includes(sql, 'public.register_push_token(', '등록 함수');
    includes(sql, 'public.unregister_push_token(', '해제 함수');
    includes(sql, 'public.my_push_tokens()', '내 기기 수 함수');
    includes(sql, 'security definer', '함수는 서버 권한으로만');
    includes(sql, 'public.current_user_key()', '주인은 서버가 정한다');
    /* 한 사람 10대까지 */
    includes(sql, 'limit (v_count - 10)', '오래된 기기 정리');
    /* 여러 번 실행해도 안전 */
    includes(sql, 'create or replace function', '다시 실행 안전');
  });

  test('v1.77 DB: 내 토큰만 보이고 쓰기는 함수로만', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/push-v1.77.sql');
    includes(sql, 'alter table public.push_tokens enable row level security', 'RLS 켬');
    includes(sql, 'using (user_key = public.current_user_key())', '내 행만');
    includes(sql, 'revoke all on public.push_tokens from anon', 'anon 차단');
    includes(sql, 'revoke all on public.push_log from authenticated', '발송 기록은 앱이 못 읽음');
    excludes(sql, 'create policy push_tokens_insert', '클라이언트 INSERT 정책 없음(함수로만)');
    excludes(sql, 'create policy push_log_read', '발송 기록 읽기 정책 없음');
    /* 응답에 토큰 값을 돌려주지 않는다 */
    includes(sql, "'count', coalesce(v_row.n, 0)", '개수만 돌려줌');
    excludes(sql, "'token', v_row", '토큰 값은 응답에 없음');
  });

  /* =========================================================
   * 2. 서버 함수(send-push)
   * ========================================================= */

  test('v1.77 서버: 로그인 확인 · 받는 사람 토큰만 · FCM v1 발송', function () {
    if (!hasNode) return;
    var fn = readRoot('supabase/functions/send-push/index.ts');
    includes(fn, '/auth/v1/user', '로그인 토큰 확인');
    includes(fn, 'app_users', '보낸 사람 user_key 를 서버에서 찾음');
    includes(fn, 'push_tokens', '받는 사람 기기 토큰');
    includes(fn, 'messages:send', 'FCM HTTP v1');
    includes(fn, 'firebase.messaging', 'FCM 권한 범위');
    includes(fn, 'FCM_SERVICE_ACCOUNT_JSON', '시크릿 이름');
    includes(fn, 'bounded'.replace('bounded', 'RSASSA-PKCS1-v1_5'), 'RS256 서명');
    includes(fn, 'bm_chat', '안드로이드 알림 채널');
    includes(fn, 'UNREGISTERED', '죽은 토큰 정리');
    includes(fn, 'encodeURIComponent(to)', '받는 사람만 조회');
    includes(fn, 'Access-Control-Allow-Origin', 'CORS');
  });

  test('v1.77 서버: FCM 시크릿이 없으면 pending_fcm_secret 만 돌려준다', function () {
    if (!hasNode) return;
    var fn = readRoot('supabase/functions/send-push/index.ts');
    includes(fn, "if (!sa) {", '시크릿 없음 분기');
    includes(fn, "'pending_fcm_secret'", '준비 중 상태');
    includes(fn, 'sent: 0', '아무 것도 보내지 않음');
    /* 앱 흐름을 막지 않는다 — 오류 코드가 아니라 200 + ok */
    includes(fn, "return json({ ok: true, status: 'pending_fcm_secret'", 'ok:true 로 조용히');
    /* 남용 제한 */
    includes(fn, 'RATE_PER_HOUR = 60', '시간당 제한');
    includes(fn, 'DEDUPE_SECONDS = 8', '같은 글 재발송 차단');
  });

  test('v1.77 서버: 시크릿·서비스 계정 값이 응답이나 로그에 남지 않는다', function () {
    if (!hasNode) return;
    var fn = readRoot('supabase/functions/send-push/index.ts');
    excludes(fn, 'console.log', '콘솔에 남기지 않음');
    excludes(fn, 'json(sa', '서비스 계정 객체를 응답에 넣지 않음');
    excludes(fn, 'JSON.stringify(sa)', '서비스 계정 값을 직렬화하지 않음');
    excludes(fn, 'access_token: access', 'FCM 토큰을 응답에 넣지 않음');
    ok(fn.indexOf('FCM_SERVICE_ACCOUNT_JSON') > 0, '환경변수로만 받음');
  });

  /* =========================================================
   * 3. 토큰 등록 (앱)
   * ========================================================= */

  test('v1.77 토큰: 체험 모드는 기기에만 저장하고 서버를 부르지 않는다', function () {
    clearStorage();
    var calls = [];
    var api = { mode: 'local', rpc: function (name) { calls.push(name); return Promise.resolve({ ok: true }); } };
    return BM.push.registerToken('fcm-token-abcdefgh', 'android', { api: api, mode: 'local' }).then(function (res) {
      ok(res.ok, '기기에 저장');
      eq(res.pending, true, '서버는 나중에');
      eq(calls.length, 0, 'RPC 를 부르지 않음');
      var rec = BM.push.token();
      eq(rec.token, 'fcm-token-abcdefgh', '저장된 토큰');
      eq(rec.platform, 'android', '플랫폼');
      clearStorage();
    });
  });

  test('v1.77 토큰: Supabase 모드는 register_push_token 을 부른다', function () {
    clearStorage();
    var calls = [];
    var api = {
      mode: 'supabase',
      rpc: function (name, args) {
        calls.push({ name: name, args: args });
        if (name === 'register_push_token') return Promise.resolve({ ok: true, count: 1, platform: 'android' });
        if (name === 'unregister_push_token') return Promise.resolve({ ok: true, removed: 1 });
        return Promise.resolve({ ok: true });
      }
    };
    return BM.push.registerToken('fcm-token-abcdefgh', 'android', { api: api, mode: 'supabase' }).then(function (res) {
      eq(calls[0].name, 'register_push_token', '등록 RPC');
      eq(calls[0].args.p_token, 'fcm-token-abcdefgh', '토큰');
      eq(calls[0].args.p_platform, 'android', '플랫폼');
      eq(res.count, 1, '내 기기 수');
      return BM.push.unregisterToken('', { api: api, mode: 'supabase' });
    }).then(function (res) {
      eq(calls[1].name, 'unregister_push_token', '해제 RPC');
      eq(calls[1].args.p_token, 'fcm-token-abcdefgh', '저장된 토큰으로 해제');
      eq(res.removed, 1, '지운 수');
      eq(BM.push.token(), null, '기기 저장도 지움');
    });
  });

  test('v1.77 토큰: 이상한 토큰은 받지 않는다', function () {
    clearStorage();
    return BM.push.registerToken('short', 'android', { mode: 'local' }).then(function (res) {
      eq(res.ok, false, '너무 짧은 토큰 거절');
      eq(res.reason, 'bad_token', '이유');
      eq(BM.push.token(), null, '저장하지 않음');
    });
  });

  test('v1.77 브리지: window.ShuttlixPush 로 앱이 토큰을 넘긴다', function () {
    clearStorage();
    var bridge = BM.push.installBridge();
    ok(bridge, '브리지 생성');
    ok(root.ShuttlixPush, 'window.ShuttlixPush');
    eq(typeof root.ShuttlixPush.register, 'function', 'register');
    eq(root.ShuttlixPush.version, 'v1.101.0', '버전');
    return root.ShuttlixPush.register('native-token-12345678', 'android').then(function (res) {
      ok(res.ok, '등록');
      eq((BM.push.token() || {}).token, 'native-token-12345678', '기기에 남음');
      eq(root.ShuttlixPush.token(), 'native-token-12345678', '브리지로 조회');
      eq(root.ShuttlixPush.status().id, 'linked', '연결됨 표시');
      return root.ShuttlixPush.unregister();
    }).then(function () {
      eq(BM.push.token(), null, '해제');
      try { delete root.ShuttlixPush; } catch (e) { root.ShuttlixPush = undefined; }
      clearStorage();
    });
  });

  test('v1.77 브리지: 옛 AndroidBridge · postMessage 통로를 그대로 받는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/push.js');
    includes(src, 'AndroidBridge', '옛 브리지');
    includes(src, 'requestPushToken', '토큰 요청');
    includes(src, 'BM_PUSH_TOKEN', 'postMessage');
    includes(src, 'shuttlix:push-token', '커스텀 이벤트');
    includes(src, 'BM_PUSH_TOKEN_CLEAR', '해제 메시지');
  });

  /* =========================================================
   * 4. 발송
   * ========================================================= */

  test('v1.77 발송: 체험·시트 모드에서는 아무 것도 보내지 않는다', function () {
    var old = root.fetch;
    var hits = 0;
    root.fetch = function () { hits++; return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{}'); } }); };
    return BM.push.notify('chat', { to: OTHER, mode: 'local', me: { key: ME, nick: '나래' }, text: '안녕' })
      .then(function (res) {
        eq(res.status, 'not_remote', '서버를 부르지 않음');
        eq(hits, 0, '네트워크 요청 0');
        root.fetch = old;
      });
  });

  test('v1.77 발송: Supabase 모드에서 상대 userKey·제목·본문·경로를 보낸다', function () {
    var old = root.fetch;
    var seen = null;
    root.fetch = function (url, init) {
      seen = { url: url, init: init };
      return Promise.resolve({
        ok: true,
        text: function () { return Promise.resolve(JSON.stringify({ ok: true, status: 'pending_fcm_secret', sent: 0 })); }
      });
    };
    return BM.push.notify('chat', {
      to: OTHER, mode: 'supabase', me: { key: ME, nick: '나래' }, text: '오늘 7시 어때요?', room: 'room_1234'
    }).then(function (res) {
      root.fetch = old;
      ok(!!seen, '요청이 나감');
      includes(String(seen.url), '/functions/v1/send-push', '발송 함수');
      eq(seen.init.method, 'POST', 'POST');
      var body = JSON.parse(seen.init.body);
      eq(body.userKey, OTHER, '받는 사람');
      eq(body.kind, 'chat', '종류');
      eq(body.title, '새 채팅', '제목');
      includes(body.body, '나래: 오늘 7시 어때요?', '보낸 사람 + 내용');
      eq(body.url, '#/chat/room_1234', '채팅방까지');
      eq(res.status, 'pending_fcm_secret', '준비 중 응답도 그대로 받음');
      eq((BM.push.lastSend() || {}).status, 'pending_fcm_secret', '마지막 결과를 기억');
    });
  });

  test('v1.77 발송: 실패해도 예외를 던지지 않는다(메시지는 이미 나감)', function () {
    var old = root.fetch;
    root.fetch = function () { return Promise.reject(new Error('offline')); };
    return BM.push.notify('match', { to: OTHER, mode: 'supabase', me: { key: ME, nick: '나래' } }).then(function (res) {
      root.fetch = old;
      eq(res.ok, false, '실패로 표시');
      eq(res.status, 'offline', '이유');
      /* 자기 자신에게는 보내지 않음 */
      return BM.push.notify('chat', { to: ME, mode: 'supabase', me: { key: ME, nick: '나래' }, text: 'x' });
    }).then(function (res) {
      eq(res.status, 'self', '내게는 보내지 않음');
      return BM.push.notify('없는종류', { to: OTHER, mode: 'supabase', me: { key: ME } });
    }).then(function (res) {
      eq(res.status, 'unknown', '모르는 종류');
    });
  });

  test('v1.77 문구: 종류별 제목·본문·이동 경로가 짧고 담백하다', function () {
    var me = { key: ME, nick: '나래' };
    var chat = BM.push.messageOf('chat', { me: me, text: '오늘 7시 어때요?', room: 'r1' });
    eq(chat.title, '새 채팅', '채팅 제목');
    eq(chat.url, '#/chat/r1', '채팅 경로');
    var long = BM.push.messageOf('chat', { me: me, text: 'ㄱ'.repeat(200) });
    ok(long.body.length <= 160, '본문 상한');
    var match = BM.push.messageOf('match', { me: me });
    eq(match.title, '1:1 매칭 요청', '매칭 제목');
    includes(match.body, '나래님이 매칭을 신청했어요', '매칭 본문');
    eq(match.url, '#/matching', '매칭 경로');
    var guest = BM.push.messageOf('guest', { me: me, room: 'post_1' });
    includes(guest.body, '게스트로 신청했어요', '게스트 본문');
    eq(guest.url, '#/community', '게스트 경로');
    eq(BM.push.messageOf('guest_accept', { me: me }).title, '게스트 신청 수락', '수락 제목');
    eq(BM.push.appUrlOf('chat', 'a b!@'), '#/chat/ab', '방 ID 는 글자만');
    eq(BM.push.messageOf('없음', {}), null, '모르는 종류는 null');
  });

  /* =========================================================
   * 5. 저장소 훅 — 메시지가 나간 직후 상대에게
   * ========================================================= */

  test('v1.77 훅: 1:1 채팅·약속 카드·매칭 요청·게스트 신청이 상대에게 알림을 부른다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      return withNotify(function (calls) {
        var r1 = store.actions.sendChat('f_1', OTHER, '오늘 7시 어때요?');
        ok(r1.ok, '1:1 채팅 전송');
        eq(calls[0].kind, 'chat', '채팅 알림');
        eq(calls[0].opts.to, OTHER, '상대에게');
        eq(calls[0].opts.text, '오늘 7시 어때요?', '내용 함께');
        eq(calls[0].opts.mode, 'supabase', '서버 모드');
        /* 같은 방 450ms 잠금을 풀고 다음 동작 */
        store.state.locks = {};
        var r2 = store.actions.sendAppt('f_1', OTHER, { gym: '나래울체육관', date: '2026-11-26', time: '19:00' });
        ok(r2.ok, '약속 카드 전송');
        eq(calls[1].kind, 'appt', '약속 카드 알림');
        eq(calls[1].opts.to, OTHER, '상대에게');
        includes(String(calls[1].opts.text), '나래울체육관', '체육관 한 줄');

        store.state.locks = {};
        var r3 = store.actions.requestMatch(OTHER, '한 게임 해요');
        if (r3 && r3.then) return r3;
        eq(calls[2].kind, 'match', '매칭 요청 알림');
        eq(calls[2].opts.to, OTHER, '신청 받는 사람');

        store.state.locks = {};
        var r4 = store.actions.applyGuest('post_1', '같이 치고 싶어요');
        ok(r4.ok, '게스트 신청');
        eq(calls[3].kind, 'guest', '게스트 신청 알림');
        eq(calls[3].opts.to, OTHER, '글쓴이에게');
        return null;
      });
    });
  });

  test('v1.77 훅: 단체방은 글쓴이에게, 내가 글쓴이면 보내지 않는다', function () {
    if (!hasNode) return;
    var rows = baseRows();
    rows.push(row({ id: 'post_mine', type: '소셜', createdAt: '2026-11-04 09:00:00', nick: '나래', userKey: ME, text: '내가 쓴 모집 글', topic: '게스트 모집' }));
    return freshStore(rows).then(function (store) {
      return withNotify(function (calls) {
        var r1 = store.actions.sendChat('post_1', '', '저 갈게요');
        ok(r1.ok, '단체방 전송');
        eq(calls.length, 1, '한 번');
        eq(calls[0].opts.to, OTHER, '글쓴이에게');
        eq(calls[0].opts.room, 'post_1', '방 ID');
        store.state.locks = {};
        var r2 = store.actions.sendChat('post_mine', '', '공지합니다');
        ok(r2.ok, '내 단체방 전송');
        eq(calls.length, 1, '내가 글쓴이면 알림 없음');
      });
    });
  });

  test('v1.77 훅: 게스트 신청 수락·거절은 신청한 사람에게 알린다', function () {
    if (!hasNode) return;
    var rows = baseRows();
    rows.push(row({
      id: 'g_apply', type: D.GUEST.type, createdAt: '2026-11-05 09:00:00', nick: '나래',
      userKey: OTHER, target: ME, team: 'post_1',
      payload: { kind: D.GUEST.apply, note: '같이 치고 싶어요', nick: '콕집사' }
    }));
    return freshStore(rows).then(function (store) {
      return withNotify(function (calls) {
        var res = store.actions.respondGuest('g_apply', true);
        ok(res.ok, '수락');
        eq(calls.length, 1, '한 번');
        eq(calls[0].kind, 'guest_accept', '수락 알림');
        eq(calls[0].opts.to, OTHER, '신청한 사람에게');
      });
    });
  });

  test('v1.77 훅: 알림 함수가 없거나 실패해도 메시지는 그대로 나간다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      var orig = BM.push.notify;
      BM.push.notify = function () { throw new Error('boom'); };
      var res;
      try {
        res = store.actions.sendChat('f_1', OTHER, '알림이 죽어도');
      } finally {
        BM.push.notify = orig;
      }
      ok(res.ok, '전송은 성공');
      var mine = store.state.rows.filter(function (r) { return String(r[D.COL['유형']]) === '매칭채팅'; });
      eq(mine.length, 1, '메시지 한 줄 저장');
    });
  });

  /* =========================================================
   * 6. MY 화면
   * ========================================================= */

  test('v1.77 화면: MY 알림에 실시간·백그라운드 두 줄이 보인다', function () {
    if (!hasNode) return;
    clearStorage();
    var panel = BM.views.my.alarmPanel(stateOf());
    includes(panel, '실시간 푸시 알림', '기존 스위치');
    includes(panel, 'data-act="toggle-push"', '스위치 배선');
    includes(panel, '실시간 알림 (앱 켜짐)', '실시간 줄');
    includes(panel, '백그라운드 푸시 (앱 닫힘)', '백그라운드 줄');
    includes(panel, 'data-push-step="live"', '실시간 상태');
    includes(panel, 'data-push-step="bg"', '백그라운드 상태');
    includes(panel, '스토어 앱 연결 준비', '앱 설치 전 상태');
    includes(panel, 'data-act="toggle-notify"', '기존 새 메시지 알림 그대로');
    includes(panel, 'data-act="toggle-letter"', '기존 편지지 그대로');
  });

  test('v1.77 화면: 토큰이 등록되면 백그라운드가 "앱에 연결됨" 으로 바뀐다', function () {
    if (!hasNode) return;
    clearStorage();
    U.writeJSON(BM.push.TOKEN_KEY, { token: 'native-token-12345678', platform: 'android', at: U.stamp() });
    var panel = BM.views.my.alarmPanel(stateOf());
    includes(panel, '앱에 연결됨', '연결 상태');
    includes(panel, '폰 알림으로 받아요', '안내');
    eq(BM.push.background().id, 'linked', '상태 id');
    clearStorage();
    eq(BM.push.background().id !== 'linked', true, '토큰이 없으면 연결 아님');
  });

  /* =========================================================
   * 7. 보호 · 보안 · 버전
   * ========================================================= */

  test('v1.77 보호: 5개 탭·시트 26칸·기존 푸시 스위치가 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq(D.COLS.length, 26, '시트 26칸 그대로');
    eq(D.normalizePrefs({}).push, false, '푸시 기본 꺼짐');
    eq(D.normalizePrefs({ push: true }).push, true, '켜면 켜짐');
    includes(readRoot('js/views/my.js'), 'BM.push.enable', '켜면 권한·구독');
    includes(app, 'BM_PUSH_OPEN', '알림 클릭 → 앱 화면');
  });

  test('v1.77 보안: 비밀 키·관리 토큰이 저장소에 없다', function () {
    if (!hasNode) return;
    ['js/push.js', 'supabase/push-v1.77.sql', 'supabase/functions/send-push/index.ts', 'js/store.js'].forEach(function (f) {
      var src = readRoot(f);
      ['sb_secret_', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'service_role_key'].forEach(function (bad) {
        excludes(src, bad, f + ' 에 ' + bad + ' 없음');
      });
    });
    var csp = readRoot('index.html');
    var at = csp.indexOf('Content-Security-Policy');
    var line = csp.slice(at, csp.indexOf('>', at));
    excludes(line, "'unsafe-eval'", 'eval 금지');
    includes(line, "object-src 'none'", 'object 잠금');
    /* 실존 선수 이름은 쓰지 않는다 */
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(readRoot('js/push.js'), name, 'push.js 에 ' + name + ' 없음');
      excludes(readRoot('supabase/push-v1.77.sql'), name, 'SQL 에 ' + name + ' 없음');
    });
  });

  test('v1.77 배선: sw 캐시·index 로드·테스트 목록에 반영된다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "'./js/push.js'", 'sw 캐시');
    includes(readRoot('sw.js'), 'bm-v1.101.0', 'sw 변경 이력');
    includes(readRoot('index.html'), 'js/push.js', 'index 로드');
    includes(readRoot('test/run.js'), 'test/v177.test.js', '테스트 목록');
    includes(readRoot('app.js'), 'installBridge', '앱 시작 시 브리지');
    includes(readRoot('app.js'), 'syncToken', '앱 시작 시 토큰 맞춤');
    includes(readRoot('js/store.js'), 'pushHook', '저장소 알림 훅');
  });

  test('v1.77 sw: 알림을 누르면 그 대화방까치 열린다', function () {
    if (!hasNode) return;
    var vm = require('vm');
    var opened = [], handlers = {};
    var self = {
      addEventListener: function (n, fn) { handlers[n] = fn; },
      registration: { showNotification: function () { return Promise.resolve(); } },
      clients: { matchAll: function () { return Promise.resolve([]); }, openWindow: function (u) { opened.push(u); return Promise.resolve(); } },
      location: { origin: 'https://csw42060713-byte.github.io' }
    };
    vm.runInContext(readRoot('sw.js'), vm.createContext({ self: self, console: console, Date: Date, Promise: Promise }), { filename: 'sw.js' });
    var waits = [];
    handlers.notificationclick({
      notification: { close: function () {}, data: { url: './#/chat/room_1234' } },
      waitUntil: function (p) { waits.push(p); }
    });
    return Promise.all(waits).then(function () {
      eq(opened.join(','), './#/chat/room_1234', '대화방까지 살림');
      opened = []; waits = [];
      handlers.notificationclick({
        notification: { close: function () {}, data: { url: '#/chat' } },
        waitUntil: function (p) { waits.push(p); }
      });
      return Promise.all(waits);
    }).then(function () {
      eq(opened.join(','), './#/matching', '방 ID 가 없으면 예전대로 매칭 탭');
      opened = []; waits = [];
      handlers.notificationclick({
        notification: { close: function () {}, data: { url: 'https://evil.example.com/#' + '/chat/x<script>' } },
        waitUntil: function (p) { waits.push(p); }
      });
      return Promise.all(waits);
    }).then(function () {
      ok(/^\.\/#\/(chat\/)?[A-Za-z0-9_-]*$/.test(opened.join('')), '위험한 글자는 지우고 앱 안 화면만(실제: ' + opened.join(',') + ')');
    });
  });

  test('v1.77 버전: sw · app · 스타일 캐시 · TWA · README 가 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.101.0'", 'sw 캐시 이름');
    includes(readRoot('app.js'), "version: 'v1.101.0'", 'app 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.101.0', 'TWA 이름');
    eq(twa.appVersion, '1.101.0', 'TWA 버전');
    eq(twa.appVersionCode, 95, 'TWA 코드');
    var readme = readRoot('README.md');
    includes(readme, 'bm-v1.101.0', 'README 버전 절');
    includes(readme, 'FCM 연동 가이드', 'README FCM 안내');
    includes(readRoot('styles.css'), '.pushsteps', '상태 두 줄 스타일');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
