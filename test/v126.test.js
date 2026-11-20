/* ============================================================
 * test/v126.test.js — bm-v1.33.0
 *   Supabase Auth 로 이메일 가입·로그인·비밀번호·탈퇴가
 *   Apps Script 브리지 없이 동작하는지, 그리고 그 세션으로
 *   RLS 의 '본인 행' 수정·삭제가 진짜 PATCH/DELETE 로 나가는지 검증합니다.
 *
 *   실제 서버 대신 /auth/v1 · /rest/v1 을 흉내 내는 가짜 fetch 를 씁니다.
 *   (실서버 왕복은 work/supabase_auth_e2e.py 가 담당)
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

  /* ---------- 저장소 정리 ---------- */
  function clearAuth() {
    ['bm_auth_v1', 'bm_accounts_v1', 'bm_auth_profile_v1', 'bm_bridge_url_v1', 'bm_session_v1',
      'bm_sb_auth_v1', 'bm_backend_v1', 'bm_mode_v1'].forEach(function (k) { U.storage.removeItem(k); });
    var s = BM.views.start.state();
    s.screen = 'home'; s.mode = 'login'; s.error = ''; s.busy = false;
    s.draft = { email: '', password: '', nick: '' };
    s.onb = { nick: '', level: '', discipline: '', region: '', club: '' };
  }

  /* ---------- 가짜 Supabase 서버 ----------
   *  routes: { 'METHOD path접두': function(call) → {status, body} }
   *  기본: 가입/로그인/갱신/로그아웃/유저/재설정 + PostgREST 표 */
  function fakeServer(over) {
    var calls = [];
    var state = {
      access: 'access-1', refresh: 'refresh-1', uid: 'uid-1', email: '',
      rows: [], users: []
    };
    function base(path, pattern) { return String(path).indexOf(pattern) >= 0; }
    function server(url, init) {
      var call = {
        url: String(url), method: (init && init.method) || 'GET',
        headers: (init && init.headers) || {}, body: init && init.body
      };
      try { call.json = call.body ? JSON.parse(call.body) : null; } catch (e) { call.json = null; }
      calls.push(call);
      var res = route(call);
      var text = res.body == null ? '' : (typeof res.body === 'string' ? res.body : JSON.stringify(res.body));
      return Promise.resolve({
        ok: (res.status || 200) >= 200 && (res.status || 200) < 300,
        status: res.status || 200,
        text: function () { return Promise.resolve(text); }
      });
    }
    server.calls = calls;
    server.state = state;

    function route(call) {
      if (over) {
        var custom = over(call, state);
        if (custom) return custom;
      }
      var u = call.url;
      if (base(u, '/auth/v1/signup')) {
        state.email = (call.json && call.json.email) || state.email;
        if (state.email && state.users.indexOf(state.email) >= 0) {
          return { status: 422, body: { code: 422, error_code: 'user_already_exists', msg: 'User already registered' } };
        }
        state.users.push(state.email);
        return {
          status: 200, body: {
            access_token: state.access, refresh_token: state.refresh, token_type: 'bearer', expires_in: 3600,
            user: { id: state.uid, email: state.email, user_metadata: { nick: (call.json && call.json.data && call.json.data.nick) || '' } }
          }
        };
      }
      if (base(u, '/auth/v1/token?grant_type=password')) {
        var em = call.json && call.json.email;
        if (state.users.length && state.users.indexOf(em) < 0) {
          return { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
        }
        if (call.json && String(call.json.password).indexOf('wrong') === 0) {
          return { status: 400, body: { error_code: 'invalid_credentials', msg: 'Invalid login credentials' } };
        }
        state.email = em || state.email;
        return {
          status: 200, body: {
            access_token: state.access, refresh_token: state.refresh, expires_in: 3600,
            user: { id: state.uid, email: state.email }
          }
        };
      }
      if (base(u, '/auth/v1/token?grant_type=refresh_token')) {
        var rt = call.json && call.json.refresh_token;
        if (rt !== state.refresh) return { status: 400, body: { error_code: 'invalid_grant', msg: 'Invalid Refresh Token' } };
        state.access = 'access-2';
        state.refresh = 'refresh-2';          /* 회전(rotation) */
        return { status: 200, body: { access_token: state.access, refresh_token: state.refresh, expires_in: 3600, user: { id: state.uid, email: state.email } } };
      }
      if (base(u, '/auth/v1/token?grant_type=id_token')) {
        return { status: 400, body: { error_code: 'provider_disabled', msg: 'Provider is not enabled' } };
      }
      if (base(u, '/auth/v1/logout')) return { status: 204, body: '' };
      if (base(u, '/auth/v1/recover')) return { status: 200, body: {} };
      if (base(u, '/auth/v1/user') && call.method === 'PUT') {
        return { status: 200, body: { id: state.uid, email: state.email } };
      }
      if (base(u, '/auth/v1/user')) return { status: 200, body: { id: state.uid, email: state.email } };

      /* ---------- PostgREST ---------- */
      if (base(u, '/rest/v1/app_users')) {
        if (call.method === 'POST') return { status: 201, body: '' };
        return { status: 200, body: [] };
      }
      if (base(u, '/rest/v1/rpc/delete_my_account')) {
        return { status: 200, body: [{ ok: true, key: 'u_x', removed: 3 }] };
      }
      if (base(u, '/rest/v1/app_records')) {
        if (call.method === 'GET') return { status: 200, body: state.rows };
        if (call.method === 'PATCH') {
          var authed = String(call.headers.Authorization || '').indexOf(state.access) >= 0;
          return authed ? { status: 200, body: [{ id: 'r1' }] } : { status: 200, body: [] };
        }
        if (call.method === 'DELETE') {
          var authed2 = String(call.headers.Authorization || '').indexOf(state.access) >= 0;
          return authed2 ? { status: 200, body: [{ id: 'r1' }] } : { status: 200, body: [] };
        }
        return { status: 201, body: '' };
      }
      return { status: 404, body: { message: 'not found: ' + u } };
    }
    return server;
  }

  function withServer(over) {
    var saved = root.fetch;
    var srv = fakeServer(over);
    root.fetch = srv;
    return {
      server: srv,
      restore: function () { root.fetch = saved; },
      callsTo: function (needle, method) {
        return srv.calls.filter(function (c) {
          return c.url.indexOf(needle) >= 0 && (!method || c.method === method);
        });
      }
    };
  }

  function authState() { return U.readJSON('bm_sb_auth_v1', null); }

  /* =========================================================
   * 1) 이메일 가입·로그인 — Supabase Auth 직행
   * ========================================================= */
  test('v1.26 가입: 브리지 없이 Supabase Auth 로 가입하고 토큰을 보관한다', function () {
    clearAuth();
    var s = withServer();
    return BM.auth.signInEmail({ email: 'New@Example.com', password: 'secret12', nick: '신입', create: true })
      .then(function (res) {
        s.restore();
        eq(res.ok, true, '가입 성공');
        eq(res.session.kind, 'email', '이메일 세션');
        eq(res.session.source, 'supabase', 'source=supabase');
        eq(res.session.email, 'new@example.com', '소문자 정규화');
        eq(BM.auth.session().email, 'new@example.com', '앱 세션 저장');
        var st = authState();
        ok(st && st.access_token === 'access-1', 'access_token 보관');
        ok(st.refresh_token === 'refresh-1', 'refresh_token 보관');
        ok(st.expires_at > Math.floor(Date.now() / 1000), '만료 시각 보관');
        eq(st.uid, 'uid-1', 'auth uid');
        eq(s.callsTo('/auth/v1/signup', 'POST').length, 1, 'signup 1회');
        eq(s.callsTo('script.google.com').length, 0, '브리지 호출 없음');
        /* 계정 행 연결(meKey 유지) */
        var link = s.callsTo('/rest/v1/app_users', 'POST')[0];
        ok(link, 'app_users 연결 요청');
        eq(link.json.user_key, BM.auth.meKeyFor(BM.auth.session()), 'user_key 는 앱 공개 ID');
        eq(link.json.auth_uid, 'uid-1', 'auth_uid 연결');
        excludes(JSON.stringify(link.json), 'service_role', '서버 비밀 키 없음');
      });
  });

  test('v1.26 로그인: 실패 이유를 사용자 말로 바꿔 준다', function () {
    clearAuth();
    var s = withServer();
    return BM.auth.signInEmail({ email: 'who@example.com', password: 'wrongpass' })
      .then(function (res) {
        s.restore();
        eq(res.ok, false, '로그인 실패');
        eq(res.code, 'bad_password', '이유 코드');
        includes(res.message, '비밀번호', '안내 문구');
      });
  });

  test('v1.26 가입: 이미 있는 이메일은 exists 로 알려 준다', function () {
    clearAuth();
    var s = withServer();
    return BM.auth.signInEmail({ email: 'dup@example.com', password: 'secret12', create: true })
      .then(function () {
        return BM.auth.signInEmail({ email: 'dup@example.com', password: 'secret12', create: true });
      })
      .then(function (res) {
        s.restore();
        eq(res.ok, false, '재가입 실패');
        eq(res.code, 'exists', '이유');
        includes(res.message, '이미 가입된', '안내 문구');
      });
  });

  test('v1.26 로그인: 확인 메일이 필요한 프로젝트면 그 사실을 알려 준다', function () {
    clearAuth();
    var s = withServer(function (call) {
      if (call.url.indexOf('/auth/v1/signup') >= 0) return { status: 200, body: { id: 'uid-9', email: 'c@example.com' } };
      return null;
    });
    return BM.auth.signInEmail({ email: 'c@example.com', password: 'secret12', create: true })
      .then(function (res) {
        s.restore();
        eq(res.ok, false, '세션 없음');
        eq(res.code, 'confirm_email', '확인 메일 안내');
        eq(BM.auth.session(), null, '로그인 상태가 되지 않음');
      });
  });

  /* =========================================================
   * 2) 토큰 자동 갱신
   * ========================================================= */
  test('v1.26 토큰: 만료가 가까우면 refresh_token 으로 먼저 갱신한다(회전 값 저장)', function () {
    clearAuth();
    var s = withServer();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'access-1', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) - 10, uid: 'uid-1', email: 'a@example.com'
    });
    return BM.auth.accessToken().then(function (tok) {
      s.restore();
      eq(tok, 'access-2', '새 토큰');
      eq(s.callsTo('/auth/v1/token?grant_type=refresh_token', 'POST').length, 1, '갱신 1회');
      eq(authState().refresh_token, 'refresh-2', '회전된 refresh_token 저장');
    });
  });

  test('v1.26 토큰: 남은 시간이 충분하면 서버를 부르지 않는다', function () {
    clearAuth();
    var s = withServer();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'access-1', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3000, uid: 'uid-1', email: 'a@example.com'
    });
    return BM.auth.accessToken().then(function (tok) {
      s.restore();
      eq(tok, 'access-1', '그대로 사용');
      eq(s.server.calls.length, 0, '요청 없음');
    });
  });

  test('v1.26 토큰: 갱신이 거절되면 세션을 비워 다시 로그인하게 한다', function () {
    clearAuth();
    var s = withServer();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'old', refresh_token: 'dead',
      expires_at: Math.floor(Date.now() / 1000) - 10, uid: 'uid-1', email: 'a@example.com'
    });
    return BM.auth.accessToken().then(function (tok) {
      s.restore();
      eq(tok, '', '토큰 없음');
      eq(authState(), null, '보관 세션 삭제');
    });
  });

  /* =========================================================
   * 3) 비밀번호 변경·재설정
   * ========================================================= */
  test('v1.26 비밀번호: 6자 미만은 서버에 보내지 않는다', function () {
    clearAuth();
    var s = withServer();
    return BM.auth.changePassword('123').then(function (res) {
      s.restore();
      eq(res.ok, false, '거절');
      eq(res.code, 'weak_password', '이유');
      eq(s.server.calls.length, 0, '요청 없음');
    });
  });

  test('v1.26 비밀번호: 로그인 상태면 PUT /user 로 바꾼다', function () {
    clearAuth();
    var s = withServer();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'access-1', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3000, uid: 'uid-1', email: 'a@example.com'
    });
    return BM.auth.changePassword('brandnew1').then(function (res) {
      s.restore();
      eq(res.ok, true, '변경 성공');
      var put = s.callsTo('/auth/v1/user', 'PUT')[0];
      ok(put, 'PUT /user');
      eq(put.json.password, 'brandnew1', '새 비밀번호');
      eq(put.headers.Authorization, 'Bearer access-1', '내 토큰으로');
    });
  });

  test('v1.26 비밀번호: 재설정 메일 요청은 /recover 로 보낸다', function () {
    clearAuth();
    var s = withServer();
    return BM.auth.recoverPassword('Me@Example.com').then(function (res) {
      s.restore();
      eq(res.ok, true, '요청 성공');
      var req = s.callsTo('/auth/v1/recover', 'POST')[0];
      ok(req, '/recover 호출');
      eq(req.json.email, 'me@example.com', '정규화된 이메일');
      includes(res.message, '메일', '안내 문구');
    });
  });

  /* =========================================================
   * 4) api.js — access_token 을 실어 진짜 PATCH/DELETE
   * ========================================================= */
  test('v1.26 저장소: 로그인 토큰을 Authorization 으로 보내고 진짜 PATCH 가 통과한다', function () {
    clearAuth();
    var s = withServer();
    var api = BM.api.createSupabase({
      meKey: 'u_me', token: 'access-1',
      me: { email: 'a@example.com', nick: '나' }
    });
    return api.update('r1', { '닉네임': '고침' }).then(function (res) {
      s.restore();
      var call = s.callsTo('/rest/v1/app_records', 'PATCH')[0];
      ok(call, 'PATCH 요청');
      includes(call.url, 'id=eq.r1', '행 지정');
      includes(call.url, 'user_key=eq.u_me', '본인 행만');
      eq(call.headers.Authorization, 'Bearer access-1', '내 토큰');
      eq(call.headers.apikey, BM.api.SUPABASE.publishableKey, 'apikey 는 공개 키');
      eq(call.json.nick, '고침', '바뀐 값');
      eq(res.native, true, '기록 행 없이 바로 반영');
    });
  });

  test('v1.26 저장소: 토큰이 없으면(체험·구글) 예전처럼 수정 기록 행으로 내려간다', function () {
    clearAuth();
    var s = withServer();
    var api = BM.api.createSupabase({ meKey: 'u_guest' });
    return api.update('r1', { '닉네임': '고침' }).then(function (res) {
      s.restore();
      var patch = s.callsTo('/rest/v1/app_records', 'PATCH')[0];
      eq(patch.headers.Authorization, 'Bearer ' + BM.api.SUPABASE.publishableKey, '공개 키로 시도');
      eq(res.marked, true, '수정 기록 행 추가');
      var mark = s.callsTo('/rest/v1/app_records', 'POST')[0];
      eq(mark.json.type, '수정', '기록 유형');
      eq(mark.json.user_key, 'u_guest', '본인 키');
    });
  });

  test('v1.26 저장소: 토큰이 만료돼 401 이 오면 한 번 갱신해 다시 보낸다', function () {
    clearAuth();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'stale', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3000, uid: 'uid-1', email: 'a@example.com'
    });
    var firstTry = true;
    var s = withServer(function (call) {
      if (call.url.indexOf('/rest/v1/app_records') >= 0 && call.method === 'PATCH') {
        if (firstTry) {
          firstTry = false;
          return { status: 401, body: { message: 'JWT expired' } };
        }
        return { status: 200, body: [{ id: 'r1' }] };
      }
      return null;
    });
    var api = BM.api.createSupabase({ meKey: 'u_me', token: BM.auth.accessToken });
    return api.update('r1', { '닉네임': '고침' }).then(function (res) {
      s.restore();
      eq(res.native, true, '갱신 뒤 통과');
      eq(s.callsTo('/auth/v1/token?grant_type=refresh_token', 'POST').length, 1, '갱신 1회');
      var patches = s.callsTo('/rest/v1/app_records', 'PATCH');
      eq(patches.length, 2, '두 번 시도');
      eq(patches[1].headers.Authorization, 'Bearer access-2', '새 토큰으로 재요청');
    });
  });

  test('v1.26 저장소: 로그인 상태의 탈퇴는 RPC 로 계정까지 지운다', function () {
    clearAuth();
    var s = withServer();
    var api = BM.api.createSupabase({ meKey: 'u_me', token: 'access-1' });
    return api.deleteAccount().then(function (res) {
      s.restore();
      eq(res.ok, true, '탈퇴 성공');
      eq(res.authDeleted, true, '로그인 계정도 삭제');
      eq(res.removed, 3, '지운 행 수');
      var rpc = s.callsTo('/rest/v1/rpc/delete_my_account', 'POST')[0];
      ok(rpc, 'RPC 호출');
      eq(rpc.headers.Authorization, 'Bearer access-1', '내 토큰');
    });
  });

  test('v1.26 저장소: 토큰이 없으면 탈퇴는 기록 삭제 행 방식', function () {
    clearAuth();
    var s = withServer(function (call) {
      if (call.url.indexOf('/rest/v1/app_records') >= 0 && call.method === 'GET') {
        return { status: 200, body: [{ id: 'r1', type: '기록', user_key: 'u_g' }] };
      }
      if (call.url.indexOf('/rest/v1/app_records') >= 0 && call.method === 'DELETE') return { status: 200, body: [] };
      return null;
    });
    var api = BM.api.createSupabase({ meKey: 'u_g' });
    return api.deleteAccount().then(function (res) {
      s.restore();
      eq(res.ok, true, '탈퇴 성공');
      eq(res.hidden, true, '기록 행으로 가림');
      eq(res.authDeleted, undefined, '계정 삭제는 아님');
      eq(s.callsTo('/rest/v1/rpc/delete_my_account').length, 0, 'RPC 호출 없음');
    });
  });

  /* =========================================================
   * 5) 경로 선택 — 시트로 바꾼 기기만 브리지
   * ========================================================= */
  test('v1.26 경로: 기본은 Supabase, 시트로 바꾼 기기만 브리지를 쓴다', function () {
    clearAuth();
    eq(BM.auth.prefersSheetsAuth(), false, '기본은 Supabase');
    U.writeJSON('bm_backend_v1', 'sheets');
    eq(BM.auth.prefersSheetsAuth(), false, '브리지 세션이 없으면 여전히 Supabase');
    U.writeJSON('bm_session_v1', { token: 'tok', url: 'https://script.google.com/macros/s/x/exec' });
    eq(BM.auth.prefersSheetsAuth(), true, '브리지 세션이 있으면 시트');
    clearAuth();
  });

  test('v1.26 경로: 시트로 바꾼 기기는 기존 브리지 인증을 그대로 쓴다', function () {
    clearAuth();
    U.writeJSON('bm_backend_v1', 'sheets');
    U.writeJSON('bm_session_v1', { token: 'tok', url: 'https://script.google.com/macros/s/x/exec' });
    var saved = root.fetch;
    var calls = [];
    root.fetch = function (url, opts) {
      calls.push({ url: String(url), body: JSON.parse(opts.body) });
      return Promise.resolve({
        ok: true, status: 200,
        text: function () { return Promise.resolve(JSON.stringify({ ok: true, token: 'tok2', me: { nick: '시트' } })); }
      });
    };
    return BM.auth.signInEmail({ email: 'sheet@example.com', password: 'secret12' }).then(function (res) {
      root.fetch = saved;
      clearAuth();
      eq(res.ok, true, '브리지 로그인');
      eq(res.session.source, 'sheets', '시트 세션');
      eq(calls.length, 1, '브리지 1회');
      includes(calls[0].url, 'script.google.com', '브리지 주소');
    }).catch(function (e) { root.fetch = saved; clearAuth(); throw e; });
  });

  test('v1.26 경로: 로그아웃하면 서버 세션과 기기 토큰을 함께 지운다', function () {
    clearAuth();
    var s = withServer();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'access-1', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3000, uid: 'uid-1', email: 'a@example.com'
    });
    BM.auth.signInEmailAccount({ email: 'a@example.com', name: '나', source: 'supabase' });
    BM.auth.signOut();
    var loggedOut = s.callsTo('/auth/v1/logout', 'POST').length;
    s.restore();
    eq(BM.auth.session(), null, '앱 세션 삭제');
    eq(authState(), null, '토큰 삭제');
    eq(loggedOut, 1, '서버 로그아웃 요청');
  });

  /* =========================================================
   * 6) 화면
   * ========================================================= */
  test('v1.26 화면: 이메일 화면에 비밀번호 찾기와 서버 안내가 있다', function () {
    clearAuth();
    BM.views.start.reset();
    var st = BM.views.start.state();
    st.screen = 'email';
    st.mode = 'login';
    var html = BM.views.start.render();
    includes(html, 'data-act="forgot"', '비밀번호 찾기 버튼');
    includes(html, '비밀번호를 잊었어요', '버튼 이름');
    includes(html, 'Supabase', '서버 안내');
    st.mode = 'signup';
    var up = BM.views.start.render();
    excludes(up, 'data-act="forgot"', '가입 화면에는 없음');
    BM.views.start.reset();
  });

  test('v1.26 화면: 로그인 상태 MY 에 비밀번호 변경이 있고, 탈퇴 안내에 계정 삭제가 적힌다', function () {
    clearAuth();
    U.writeJSON('bm_sb_auth_v1', {
      access_token: 'access-1', refresh_token: 'refresh-1',
      expires_at: Math.floor(Date.now() / 1000) + 3000, uid: 'uid-1', email: 'a@example.com'
    });
    BM.auth.signInEmailAccount({ email: 'a@example.com', name: '나', source: 'supabase' });
    var state = {
      ready: true, mode: 'supabase', me: { key: 'u_me', nick: '나', level: 'A조', discipline: '복식', theme: { theme: 'th_def' } },
      rows: BM.fixtures.demo(), data: BM.store.derive(BM.fixtures.demo(), 'u_me'),
      drafts: {}, ui: { tab: 'my' }
    };
    var html = BM.views.my.render(state);
    includes(html, 'data-act="change-password"', '비밀번호 변경 버튼');
    includes(html, 'Supabase', '계정 설명');
    var sheet = BM.views.start.openRecovery ? 'ok' : '';
    eq(sheet, 'ok', '재설정 시트 제공');
    BM.auth.signOut();
    clearAuth();
  });

  test('v1.26 개인정보처리방침: 비밀번호는 Supabase Auth 해시, 탈퇴 시 계정까지 삭제', function () {
    if (!hasNode) return;
    var html = readRoot('privacy.html');
    includes(html, 'Supabase Auth', '인증 주체');
    includes(html, '로그인 계정(이메일·비밀번호)', '탈퇴 범위');
    includes(html, '해시', '비밀번호 저장 방식');
  });

  test('v1.26 앱 코드: service_role·비밀 키가 앱 코드에 없다', function () {
    if (!hasNode) return;
    ['js/auth.js', 'js/api.js', 'app.js', 'js/views/start.js', 'js/views/my.js'].forEach(function (f) {
      var code = readRoot(f);
      excludes(code, '"service_role"', f + ' service_role 키');
      excludes(code, "'service_role'", f + ' service_role 키');
      excludes(code, 'sb_secret_', f + ' secret key');
      excludes(code, 'db_password', f + ' DB 비밀번호');
    });
  });

  test('v1.26 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.33.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.33.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.33.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.33.0', 'TWA appVersion');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
