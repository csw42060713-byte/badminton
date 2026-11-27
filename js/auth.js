/* ============================================================
 * js/auth.js — 시작화면(인증 게이트)의 계정 상태
 *
 *  1) Google 로그인 : Google Identity Services(GIS) 훅.
 *     - 기본 Client ID(DEFAULT_GOOGLE_CLIENT_ID)가 들어 있어 별도 설정 없이
 *       실제 구글 계정(이메일·이름·사진)으로 로그인/자동 가입됩니다.
 *     - MY > 계정 > 고급에서 다른 OAuth Client ID를 넣으면 그 값이 우선합니다.
 *     - Client ID가 비어 있으면 '데모 Google 계정'으로 미리보기만 합니다.
 *  2) 이메일 로그인 / 회원가입  (v1.26 — Supabase Auth)
 *     - 기본은 Supabase Auth(/auth/v1)로 직접 가입·로그인하고,
 *       받은 access_token/refresh_token 으로 RLS의 '본인 행 수정·삭제'까지 통과합니다.
 *     - MY > 데이터 연결에서 구글 시트로 직접 바꾼 기기만 옛 시트 브리지를 씁니다.
 *     - 브리지도 없으면 이 기기에만 저장하는 체험 계정으로 동작합니다.
 *  3) 로그인 없이 둘러보기 : 체험 세션(guest).
 *  4) 첫 가입 10초 온보딩 상태(급수·종목을 아직 안 고른 로그인 사용자).
 *
 * DOM이 없는 환경(테스트)에서도 안전하게 로드되도록 화면 코드는 두지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var SESSION_KEY = 'bm_auth_v1';
  /* Supabase Auth 세션(access_token·refresh_token)은 앱 세션과 따로 둡니다.
     - 앱 세션에는 이메일·닉네임만, 토큰은 여기(같은 기기 저장소)에 보관합니다.
     - 로그아웃·탈퇴 때 두 키를 함께 지웁니다. */
  var SB_AUTH_KEY = 'bm_sb_auth_v1';
  var ACCOUNTS_KEY = 'bm_accounts_v1';
  var CLIENT_ID_KEY = 'bm_google_client_id_v1';
  var PROFILE_KEY = 'bm_auth_profile_v1';
  var BRIDGE_KEY = 'bm_bridge_url_v1';
  /* 배포된 구글 시트 브리지(Apps Script 웹 앱) 주소.
     MY > 시트 연결에서 저장한 주소가 있으면 그 값이 우선하고, 없을 때만 이 기본값을 씁니다. */
  var DEFAULT_BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbwr9EtmiKo6HT5sz_dsgKtLwkX1B-z_EA-B4u28HxN_09kv9S4tluejRtB4HkFEgwPo/exec';
  /* 배포된 Google OAuth 웹 클라이언트 ID(공개 식별자 — 비밀번호가 아닙니다).
     MY > 계정 > 고급에서 저장한 값이 있으면 그 값이 우선하고, 없을 때 이 기본값으로 실제 구글 로그인이 동작합니다.
     승인된 JavaScript 원본: https://csw42060713-byte.github.io */
  var DEFAULT_GOOGLE_CLIENT_ID = '156445399633-egfhbi1jh5k40lqh26sfbuofja6k8ai5.apps.googleusercontent.com';
  var GOOGLE_SRC = 'https://accounts.google.com/gsi/client';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var DEMO_GOOGLE = {
    sub: 'demo-google-account',
    email: 'demo.player@gmail.com',
    name: '데모 플레이어',
    picture: '',
    demo: true
  };

  /* ---------- 작은 도구 ---------- */
  function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  function fnv(text) {
    var s = String(text), h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0;
      h1 = (h1 * 16777619) >>> 0;
      h2 = ((h2 + c) * 2654435761) >>> 0;
    }
    var out = h1.toString(16) + h2.toString(16);
    while (out.length < 16) out = '0' + out;
    return out;
  }

  function bytesToHex(buf) {
    var b = new Uint8Array(buf), out = '';
    for (var i = 0; i < b.length; i++) out += ('0' + b[i].toString(16)).slice(-2);
    return out;
  }

  /* 비밀번호는 저장 전에 항상 해시합니다 (체험 계정도 평문 저장 안 함) */
  function hashPassword(password, salt) {
    var payload = String(salt) + '|' + String(password);
    var subtle = root.crypto && root.crypto.subtle;
    if (subtle && root.TextEncoder && root.Uint8Array) {
      try {
        return subtle.digest('SHA-256', new root.TextEncoder().encode(payload)).then(function (buf) {
          return 'sha256$' + bytesToHex(buf);
        }, function () { return 'fnv$' + fnv(payload); });
      } catch (e) { /* 아래 fallback */ }
    }
    return Promise.resolve('fnv$' + fnv(payload));
  }

  function verifyHash(stored, password, salt) {
    var s = String(stored || '');
    if (!s) return Promise.resolve(false);
    if (s.indexOf('sha256$') === 0) {
      return hashPassword(password, salt).then(function (h) { return h === s; });
    }
    return Promise.resolve(fnv(String(salt) + '|' + String(password)) === s.replace(/^fnv\$/, ''));
  }

  function randomSalt() {
    var out = '';
    while (out.length < 16) out += Math.random().toString(36).slice(2);
    return out.slice(0, 16);
  }

  /* ---------- 세션 ---------- */
  function session() {
    var s = U.readJSON(SESSION_KEY, null);
    if (!s || ['google', 'email', 'guest'].indexOf(s.kind) < 0) return null;
    return s;
  }

  function saveSession(s) {
    s.at = U.stamp();
    U.writeJSON(SESSION_KEY, s);
    return s;
  }

  function identityKey(s) {
    s = s || session();
    if (!s) return 'guest';
    if (s.kind === 'guest') return 'guest';
    return normEmail(s.email) || ('google:' + (s.sub || ''));
  }

  function readProfiles() { return U.readJSON(PROFILE_KEY, {}) || {}; }

  function profileFor(s) {
    return readProfiles()[identityKey(s)] || null;
  }

  function activate(s) {
    s.profile = profileFor(s);
    if (s.profile && s.profile.onboardedAt) s.onboardedAt = s.profile.onboardedAt;
    return saveSession(s);
  }

  function signInGuest() {
    return saveSession({ kind: 'guest', email: '', name: '체험 사용자' });
  }

  /* 실제 Google 계정 정보 또는 데모 계정으로 세션을 만듭니다 */
  function signInGoogle(info) {
    info = info || {};
    var email = normEmail(info.email);
    if (!email) throw new Error('구글 계정 이메일을 확인하지 못했어요.');
    /* 구글 ID 토큰도 함께 넘겨 Supabase 세션을 시도합니다(공급자가 켜져 있을 때만 성공, 실패는 무시) */
    linkGoogleIdToken(info);
    return activate({
      kind: 'google',
      email: email,
      name: String(info.name || email.split('@')[0]),
      picture: String(info.picture || ''),
      sub: String(info.sub || ''),
      demo: !!info.demo
    });
  }

  /* ---------- bm-v1.59.0: Google 로그인 직후 첫 저장이 401로 건너뛰는 문제 ----------
   * linkGoogleIdToken 이 Supabase access_token 을 받아 저장한 '직후' 대기 중인 동기화 큐를
   * 한 번 더 보냅니다. 토큰을 받는 사이에 앱이 이미 보낸 저장은 401로 대기열에 남아 있으므로,
   * 토큰이 늦게 도착한 경우에는 앱이 뜬 뒤 한 번 더 시도해야 첫 글이 사라지지 않습니다.
   * 앱(store)이 아직 만들어지기 전에 토큰이 도착하면 표시만 해 두고,
   * app.js 가 store.actions.init() 뒤에 takeSyncRetry() 로 한 번 보냅니다. */
  var syncRetryPending = false;

  /* 기기에 남은 대기열 건수 (store 가 아직 없을 때) */
  function queuedCount() {
    try {
      var q = U.readJSON('bm_queue_v1', []) || [];
      return Array.isArray(q) ? q.length : 0;
    } catch (e) { return 0; }
  }

  /* 대기 중인 저장이 있으면 한 번 더 보냅니다(없으면 아무 것도 하지 않음). */
  function retryPendingSync() {
    var ctx = root.BM && root.BM.app && root.BM.app.ctx;
    var st = ctx && ctx.store && ctx.store.state;
    if (ctx && st && ctx.actions && typeof ctx.actions.retrySync === 'function') {
      syncRetryPending = false;
      if (!((st.queue && st.queue.length) || 0)) return Promise.resolve({ ok: true, count: 0 });
      try { return Promise.resolve(ctx.actions.retrySync()); } catch (e) { return Promise.resolve({ ok: false }); }
    }
    /* 앱이 아직 없음 — 앱이 뜨면 app.js 가 takeSyncRetry() 로 확인합니다 */
    syncRetryPending = queuedCount() > 0;
    return Promise.resolve({ ok: true, pending: syncRetryPending });
  }

  /* app.js 가 store.actions.init() 뒤에 호출 — 한 번만 참을 돌려줍니다 */
  function takeSyncRetry() {
    var on = syncRetryPending;
    syncRetryPending = false;
    return on;
  }

  /* Supabase 프로젝트에 구글 공급자가 켜져 있으면 구글 로그인도 같은 JWT 세션을 받습니다.
     (아직 꺼져 있으면 조용히 지나가고 예전처럼 앱 세션만 씁니다 — 로그인은 그대로 동작) */
  function linkGoogleIdToken(info) {
    if (!info || !info.idToken || info.demo) return Promise.resolve(null);
    return sbFetch('/token?grant_type=id_token', {
      method: 'POST', body: { provider: 'google', id_token: info.idToken }
    }).then(function (data) {
      var next = sbSessionFrom(data, info.email);
      if (!next || normEmail(next.email) !== normEmail(info.email)) return null;
      saveSbAuth(next);
      var s = session();
      if (s) {
        s.token = next.access_token;
        s.source = 'supabase';
        saveSession(s);
        ensureAccount({ nick: s.name });
      }
      /* 토큰이 준비됐으니 401로 멈춰 있던 저장을 이어서 보냅니다 */
      retryPendingSync();
      return next;
    }).catch(function () { return null; });
  }

  function signInEmailAccount(account) {
    account = account || {};
    var email = normEmail(account.email);
    return activate({
      kind: 'email',
      email: email,
      name: String(account.name || email.split('@')[0]),
      token: account.token || '',
      source: account.source || 'local'
    });
  }

  function signOut() {
    signOutRemote();
    clearSbAuth();
    U.storage.removeItem(SESSION_KEY);
    return true;
  }

  /* bm-v1.92.0 — 서버에 이미 계정이 없는 경우(회원 탈퇴 직후)의 로그아웃.
   *  · 탈퇴(delete_my_account)가 성공하면 그 토큰의 사용자는 더 이상 없습니다.
   *  · 이때 /auth/v1/logout 을 부르면 403(user_not_found)만 콘솔에 남습니다.
   *  · 그래서 서버 요청 없이 기기 세션(토큰·새로고침 토큰)만 깨끗이 비웁니다. */
  function signOutLocal() {
    clearSbAuth();
    U.storage.removeItem(SESSION_KEY);
    return true;
  }

  function signOutKeepAccounts() { return signOut(); }

  /* ---------- 온보딩 ---------- */
  function needsOnboarding(s, me) {
    s = s || session();
    if (!s || s.kind === 'guest') return false;
    if (s.onboardedAt) return false;
    if (s.profile && s.profile.level && s.profile.discipline) return false;
    if (me && me.level && me.discipline) return false;
    return true;
  }

  function markOnboarded(patch) {
    var s = session();
    if (!s) return null;
    patch = patch || {};
    s.onboardedAt = U.stamp();
    s.name = patch.nick || s.name;
    s.profile = {
      nick: patch.nick || s.name || '',
      level: patch.level || '',
      discipline: patch.discipline || '',
      region: patch.region || '',
      club: patch.club || '',
      onboardedAt: s.onboardedAt
    };
    saveSession(s);
    var all = readProfiles();
    all[identityKey(s)] = s.profile;
    U.writeJSON(PROFILE_KEY, all);
    return s;
  }

  /* ---------- Google Client ID ---------- */
  /* 저장 값(사용자가 넣은 다른 프로젝트 ID)이 없으면 배포 기본값을 씁니다. */
  function googleClientId() {
    var v = String(U.readJSON(CLIENT_ID_KEY, '') || '').trim();
    if (v) return v;
    return isGoogleClientId(DEFAULT_GOOGLE_CLIENT_ID) ? DEFAULT_GOOGLE_CLIENT_ID : '';
  }

  /* 화면에서 '기본값 사용 중'을 표시할 때 씁니다. */
  function isDefaultGoogleClientId() {
    return String(U.readJSON(CLIENT_ID_KEY, '') || '').trim() === '';
  }

  function setGoogleClientId(id) {
    var v = String(id == null ? '' : id).trim();
    if (v && !isGoogleClientId(v)) return { ok: false, message: '…apps.googleusercontent.com으로 끝나는 Client ID를 넣어 주세요.' };
    U.writeJSON(CLIENT_ID_KEY, v);
    return { ok: true, clientId: v };
  }

  function isGoogleClientId(v) {
    return /^[0-9A-Za-z_-]{10,}\.apps\.googleusercontent\.com$/.test(String(v || '').trim());
  }

  /* JWT(id_token)의 payload만 읽습니다. 서명 검증은 Google SDK가 합니다. */
  function b64url(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  function atobText(s) {
    var raw;
    if (typeof root.atob === 'function') raw = root.atob(s);
    else if (typeof atob === 'function') raw = atob(s);      /* eslint-disable-line no-undef */
    else return '';
    try { return decodeURIComponent(escape(raw)); } catch (e) { return raw; }
  }

  function decodeJwt(token) {
    var parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    try {
      var payload = JSON.parse(atobText(b64url(parts[1])));
      if (!payload || !payload.email) return null;
      return {
        sub: payload.sub || '',
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || '',
        /* Supabase Auth의 signInWithIdToken 에 넘길 원본 토큰(구글 공급자가 켜져 있을 때만 쓰입니다) */
        idToken: String(token)
      };
    } catch (e) { return null; }
  }

  /* ---------- Google Identity Services 로딩 ---------- */
  var gsLoading = null;

  function googleReady() {
    return !!(root.google && root.google.accounts && root.google.accounts.id);
  }

  function loadGoogleScript() {
    if (googleReady()) return Promise.resolve(root.google);
    if (gsLoading) return gsLoading;
    if (typeof document === 'undefined') {
      return Promise.reject(new Error('브라우저에서만 구글 로그인을 쓸 수 있어요.'));
    }
    gsLoading = new Promise(function (resolve, reject) {
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        if (ok && googleReady()) resolve(root.google);
        else { gsLoading = null; reject(new Error('구글 로그인 스크립트를 불러오지 못했어요.')); }
      }
      var old = document.querySelector('script[data-bm-gsi]');
      if (old) {
        old.addEventListener('load', function () { finish(true); });
        old.addEventListener('error', function () { finish(false); });
        setTimeout(function () { if (googleReady()) finish(true); }, 2500);
        return;
      }
      var s = document.createElement('script');
      s.src = GOOGLE_SRC;
      s.async = true;
      s.defer = true;
      s.setAttribute('data-bm-gsi', '1');
      s.onload = function () { finish(true); };
      s.onerror = function () { finish(false); };
      document.head.appendChild(s);
    });
    return gsLoading;
  }

  /* 공식 Google 버튼을 그립니다. 성공하면 true */
  function renderGoogleButton(container, opts) {
    opts = opts || {};
    var cid = opts.clientId || googleClientId();
    if (!cid || !container || !googleReady()) return false;
    try {
      root.google.accounts.id.initialize({
        client_id: cid,
        callback: function (resp) {
          var info = resp && decodeJwt(resp.credential);
          if (info && typeof opts.onCredential === 'function') opts.onCredential(info);
        }
      });
      container.innerHTML = '';
      root.google.accounts.id.renderButton(container, {
        theme: 'outline', size: 'large', shape: 'pill',
        text: 'continue_with', logo_alignment: 'left', locale: 'ko', width: 300
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /* GIS 기본 버튼이 안 뜰 때를 위한 직접 호출
     계정 선택 창을 닫거나 취소했을 때만 null로 끝냅니다(예전에는 2.6초 뒤 무조건 null이라
     계정을 고르는 데 3초만 걸려도 이미 받은 로그인 응답을 버렸습니다). */
  function requestGoogleSignIn(clientId) {
    var cid = clientId || googleClientId();
    if (!cid) return Promise.reject(new Error('Google Client ID가 설정되지 않았어요.'));
    return loadGoogleScript().then(function () {
      return new Promise(function (resolve, reject) {
        var settled = false;
        function done(info) { if (!settled) { settled = true; resolve(info); } }
        function giveUp() { if (!settled) { settled = true; resolve(null); } }
        root.google.accounts.id.initialize({
          client_id: cid,
          callback: function (resp) {
            var info = resp && decodeJwt(resp.credential);
            if (info) done(info);
            else reject(new Error('구글 로그인 응답을 읽지 못했어요.'));
          }
        });
        try {
          root.google.accounts.id.prompt(function (notification) {
            if (!notification) return;
            if (typeof notification.isNotDisplayed === 'function' && notification.isNotDisplayed()) giveUp();
            if (typeof notification.isDismissedMoment === 'function' && notification.isDismissedMoment()) {
              var why = typeof notification.getDismissedReason === 'function' ? notification.getDismissedReason() : '';
              if (why !== 'credential_returned') giveUp();
            }
          });
        } catch (e) { /* 버튼으로 안내 */ }
        /* 창이 아무 신호도 주지 않을 때를 대비한 안전장치 */
        setTimeout(giveUp, 120000);
      });
    });
  }

  /* ---------- 이메일 계정 (이 기기 체험 계정) ---------- */
  function accounts() { return U.readJSON(ACCOUNTS_KEY, {}) || {}; }

  function accountOf(email) { return accounts()[normEmail(email)] || null; }

  function registerLocal(email, password, nick) {
    var list = accounts();
    var key = normEmail(email);
    if (list[key]) return Promise.resolve({ ok: false, code: 'exists', message: '이미 가입된 이메일이에요. 로그인해 주세요.' });
    var salt = randomSalt();
    return hashPassword(password, salt).then(function (hash) {
      list[key] = {
        email: key, nick: String(nick || email.split('@')[0]).trim(),
        salt: salt, hash: hash, createdAt: U.stamp()
      };
      U.writeJSON(ACCOUNTS_KEY, list);
      return { ok: true, session: signInEmailAccount({ email: key, name: list[key].nick, source: 'local' }), me: { nick: list[key].nick } };
    });
  }

  function loginLocal(email, password) {
    var acc = accountOf(email);
    if (!acc) return Promise.resolve({ ok: false, code: 'no_user', message: '가입된 계정이 없어요. 회원가입으로 시작해 주세요.' });
    return verifyHash(acc.hash, password, acc.salt).then(function (good) {
      if (!good) return { ok: false, code: 'bad_password', message: '비밀번호가 맞지 않아요.' };
      return { ok: true, session: signInEmailAccount({ email: acc.email, name: acc.nick, source: 'local' }), me: { nick: acc.nick } };
    });
  }

  /* ---------- 시트 브리지 ---------- */
  function bridgeUrl() {
    var direct = String(U.readJSON(BRIDGE_KEY, '') || '').trim();
    if (direct) return direct;
    var sess = BM.api ? BM.api.savedSession() : null;
    if (sess && sess.url) return sess.url;
    /* 저장된 주소가 없으면 배포된 기본 브리지로 연결합니다 */
    return DEFAULT_BRIDGE_URL;
  }

  function saveBridgeUrl(url) {
    var v = String(url || '').trim();
    if (v) U.writeJSON(BRIDGE_KEY, v);
    return v;
  }

  /* opts: {email, password, nick, create, url} */
  function signInEmail(opts) {
    opts = opts || {};
    var email = normEmail(opts.email);
    var password = String(opts.password == null ? '' : opts.password);
    var nick = String(opts.nick || '').trim();
    if (!EMAIL_RE.test(email)) {
      return Promise.resolve({ ok: false, code: 'bad_email', message: '이메일 주소를 확인해 주세요.' });
    }
    if (password.length < 6) {
      return Promise.resolve({ ok: false, code: 'weak_password', message: '비밀번호는 6자 이상으로 정해 주세요.' });
    }
    /* v1.26 — 기본은 Supabase Auth 로 바로 가입·로그인합니다.
       · 주소를 넘기지 않았을 때: 시트로 직접 바꾼 기기가 아니면 Supabase
       · 주소가 ''(빈 문자열)로 명시되면: 예전처럼 이 기기 체험 계정
       · 주소가 있으면: 그 시트 브리지 */
    var explicitUrl = opts.url != null;
    if (!explicitUrl && !prefersSheetsAuth()) return signInEmailSupabase(opts);
    var url = String(opts.url == null ? bridgeUrl() : opts.url).trim();

    if (!url) {
      /* 이 기기 체험 계정 */
      U.storage.removeItem(BM.api ? BM.api.SESSION_KEY : 'bm_session_v1');
      return opts.create ? registerLocal(email, password, nick) : loginLocal(email, password);
    }

    var api = BM.api.createSheets({ url: url });
    var req;
    if (opts.create) {
      req = typeof api.register === 'function'
        ? api.register({ email: email, password: password, nick: nick })
        : api.login({ email: email, password: password, nick: nick, create: true });
    } else {
      req = api.login({ email: email, password: password, create: false });
    }
    return req.then(function (res) {
      saveBridgeUrl(url);
      return {
        ok: true,
        me: res.me,
        session: signInEmailAccount({
          email: email,
          name: (res.me && res.me.nick) || nick || email.split('@')[0],
          token: res.token,
          source: 'sheets'
        })
      };
    }).catch(function (err) {
      var code = (err && err.code) || 'error';
      var msg = (err && err.message) || '로그인하지 못했어요.';
      if (code === 'no_user') msg = '가입된 계정이 없어요. 회원가입으로 시작해 주세요.';
      return { ok: false, code: code, message: msg };
    });
  }

  /* =========================================================
   * Supabase Auth (이메일 가입·로그인·비밀번호·탈퇴)
   *
   *  · 앱에는 공개 키(anon / publishable)만 들어갑니다.
   *  · 가입/로그인 성공 시 access_token + refresh_token 을 기기에 보관하고,
   *    만료 60초 전부터 refresh_token 으로 자동 갱신합니다(회전 시 새 값 저장).
   *  · api.js 는 이 access_token 을 Authorization: Bearer 로 실어 보내,
   *    RLS 의 '본인 행' 수정·삭제가 실제 PATCH/DELETE 로 통과합니다.
   *  · 비밀번호는 Supabase Auth 가 해시로 보관하며 앱은 저장하지 않습니다.
   * ========================================================= */
  var refreshing = null;

  function sbCfg() {
    var sb = (BM.api && BM.api.SUPABASE) || {};
    return {
      url: String(sb.url || '').replace(/\/+$/, ''),
      key: String(sb.publishableKey || sb.anonKey || '')
    };
  }

  function http() {
    if (typeof root.fetch === 'function') return root.fetch;
    if (typeof fetch === 'function') return fetch;            /* eslint-disable-line no-undef */
    return null;
  }

  function sbAuthState() { return U.readJSON(SB_AUTH_KEY, null); }

  function saveSbAuth(v) {
    if (v && v.access_token) U.writeJSON(SB_AUTH_KEY, v);
    else U.storage.removeItem(SB_AUTH_KEY);
    return v || null;
  }

  function clearSbAuth() {
    refreshing = null;
    U.storage.removeItem(SB_AUTH_KEY);
  }

  /* /auth/v1 응답 → 보관할 세션 모양 */
  function sbSessionFrom(data, email) {
    if (!data || !data.access_token) return null;
    var user = data.user || {};
    var exp = Number(data.expires_at) || 0;
    if (!exp && data.expires_in) exp = Math.floor(Date.now() / 1000) + Number(data.expires_in);
    return {
      access_token: String(data.access_token),
      refresh_token: String(data.refresh_token || ''),
      expires_at: exp,
      uid: String(user.id || ''),
      email: normEmail(user.email || email || '')
    };
  }

  function authErrorOf(status, data) {
    var code = String((data && (data.error_code || data.code)) || '') || String(status);
    var msg = String((data && (data.msg || data.message || data.error_description)) || '');
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
      return { code: 'bad_password', message: '이메일이나 비밀번호가 맞지 않아요.' };
    }
    if (code === 'email_not_confirmed') {
      return { code: 'confirm_email', message: '메일 확인이 필요한 계정이에요. 받은 편지함의 확인 링크를 먼저 눌러 주세요.' };
    }
    if (code === 'user_already_exists' || /already registered|already been registered/i.test(msg)) {
      return { code: 'exists', message: '이미 가입된 이메일이에요. 로그인해 주세요.' };
    }
    if (code === 'weak_password') return { code: 'weak_password', message: '비밀번호가 너무 짧아요. 6자 이상으로 정해 주세요.' };
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) {
      return { code: 'rate_limit', message: '요청이 너무 잦았어요. 잠시 뒤 다시 시도해 주세요.' };
    }
    if (code === 'signup_disabled') return { code: 'signup_disabled', message: '지금은 새 가입을 받지 않고 있어요.' };
    if (code === 'session_not_found' || code === 'invalid_grant') return { code: 'no_session', message: '로그인이 만료됐어요. 다시 로그인해 주세요.' };
    if (status >= 500) return { code: 'server', message: '서버가 잠시 응답하지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
    return { code: code || 'error', message: msg || '로그인하지 못했어요.' };
  }

  /* /auth/v1 호출. 실패하면 {code, message} 가 붙은 Error 로 거절합니다. */
  function sbFetch(path, o) {
    o = o || {};
    var cfg = sbCfg();
    var f = http();
    if (!f || !cfg.url || !cfg.key) {
      return Promise.reject(authFail('network', '지금은 서버 로그인을 쓸 수 없어요.'));
    }
    var headers = { 'apikey': cfg.key, 'Content-Type': 'application/json' };
    if (o.token) headers['Authorization'] = 'Bearer ' + o.token;
    var init = { method: o.method || 'GET', headers: headers };
    if (o.body !== undefined) init.body = JSON.stringify(o.body);
    return Promise.resolve(f(cfg.url + '/auth/v1' + path, init)).then(function (res) {
      return Promise.resolve(res.text()).then(function (text) {
        var data = null;
        if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
        if (res.ok) return data;
        var err = authErrorOf(res.status, data);
        throw authFail(err.code, err.message);
      });
    }, function () {
      throw authFail('network', '서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
    });
  }

  function authFail(code, message) {
    var err = new Error(message || '로그인하지 못했어요.');
    err.code = code || 'error';
    return err;
  }

  /* access_token 이 유효한지(만료 60초 전이면 미리 갱신) 확인해 돌려줍니다 */
  function accessToken() {
    var cur = sbAuthState();
    if (!cur || !cur.access_token) return Promise.resolve('');
    var now = Math.floor(Date.now() / 1000);
    if (!cur.expires_at || cur.expires_at - 60 > now) return Promise.resolve(String(cur.access_token));
    return refreshTokens().then(function (next) { return next ? next.access_token : ''; });
  }

  /* refresh_token 으로 세션 갱신(동시 요청은 하나로 합칩니다) */
  function refreshTokens() {
    var cur = sbAuthState();
    if (!cur || !cur.refresh_token) return Promise.resolve(null);
    if (refreshing) return refreshing;
    refreshing = sbFetch('/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: cur.refresh_token }
    }).then(function (data) {
      refreshing = null;
      var next = sbSessionFrom(data, cur.email);
      if (!next) return null;
      if (!next.uid) next.uid = cur.uid;
      if (!next.email) next.email = cur.email;
      return saveSbAuth(next);
    }, function (err) {
      refreshing = null;
      /* 갱신 토큰이 죽었으면 세션을 비워 다시 로그인하게 합니다 */
      if (err && (err.code === 'no_session' || err.code === 'bad_password' || err.code === 'error')) clearSbAuth();
      return null;
    });
    return refreshing;
  }

  function sbSignUp(email, password, nick) {
    var body = { email: email, password: password };
    if (nick) body.data = { nick: nick };
    return sbFetch('/signup', { method: 'POST', body: body });
  }

  function sbSignInPassword(email, password) {
    return sbFetch('/token?grant_type=password', { method: 'POST', body: { email: email, password: password } });
  }

  /* 이메일 가입·로그인 — Supabase 기본 경로 */
  function signInEmailSupabase(opts) {
    var email = normEmail(opts.email);
    var password = String(opts.password == null ? '' : opts.password);
    var nick = String(opts.nick || '').trim();
    return (opts.create ? sbSignUp(email, password, nick) : sbSignInPassword(email, password)).then(function (data) {
      var next = sbSessionFrom(data, email);
      if (!next) {
        /* 확인 메일 설정이 켜진 프로젝트에서는 가입만 되고 세션이 오지 않습니다 */
        return {
          ok: false, code: 'confirm_email',
          message: '가입은 됐어요. 받은 편지함의 확인 링크를 누른 뒤 로그인해 주세요.'
        };
      }
      saveSbAuth(next);
      var meta = (data && data.user && data.user.user_metadata) || {};
      var name = nick || meta.nick || email.split('@')[0];
      var sess = signInEmailAccount({ email: email, name: name, token: next.access_token, source: 'supabase' });
      /* 내 계정 행(app_users)을 auth.uid() 와 연결 — 본인 행 수정·삭제가 열립니다 */
      ensureAccount({ nick: name });
      return { ok: true, me: { nick: name, email: email }, session: sess, uid: next.uid };
    }).catch(function (err) {
      return { ok: false, code: (err && err.code) || 'error', message: (err && err.message) || '로그인하지 못했어요.' };
    });
  }

  /* 이 기기(iPad·브라우저) 체험/브리지 로그인을 쓸지 — 시트로 직접 바꾼 기기만 true */
  function prefersSheetsAuth() {
    var key = (BM.api && BM.api.BACKEND_KEY) || 'bm_backend_v1';
    if (String(U.readJSON(key, '') || '') !== 'sheets') return false;
    var saved = BM.api && BM.api.savedSession ? BM.api.savedSession() : null;
    return !!(saved && saved.url && saved.token);
  }

  function hasSupabaseAuth() {
    var cur = sbAuthState();
    return !!(cur && cur.access_token);
  }

  /* 내 계정 행(app_users)을 auth.uid() 와 연결합니다.
     - user_key 는 앱이 쓰는 공개 ID(meKeyFor) 그대로라 기록·친구·매칭이 끊기지 않습니다.
     - 실패해도 로그인은 그대로 쓸 수 있습니다(수정·삭제만 기록 행 방식으로 내려감). */
  function ensureAccount(patch) {
    var cur = sbAuthState();
    var s = session();
    if (!cur || !s || s.kind === 'guest') return Promise.resolve(false);
    var f = http();
    var cfg = sbCfg();
    if (!f || !cfg.url) return Promise.resolve(false);
    return accessToken().then(function (tok) {
      if (!tok) return false;
      var row = { user_key: meKeyFor(s), auth_uid: cur.uid };
      var email = normEmail(s.email || cur.email);
      if (email) row.email = email;
      var nick = (patch && patch.nick) || s.name || (s.profile && s.profile.nick) || '';
      if (nick) row.nick = nick;
      if (patch && patch.level) row.level = patch.level;
      if (patch && patch.discipline) row.discipline = patch.discipline;
      if (patch && patch.region) row.region = patch.region;
      if (patch && patch.club) row.club = patch.club;
      var init = {
        method: 'POST',
        headers: {
          'apikey': cfg.key, 'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(row)
      };
      return Promise.resolve(f(cfg.url + '/rest/v1/app_users?on_conflict=user_key', init))
        .then(function (res) { return !!res && res.ok; }, function () { return false; });
    }).catch(function () { return false; });
  }

  /* 비밀번호 변경(로그인 상태) */
  function changePassword(newPassword, currentPassword) {
    var pw = String(newPassword == null ? '' : newPassword);
    if (pw.length < 6) return Promise.resolve({ ok: false, code: 'weak_password', message: '비밀번호는 6자 이상으로 정해 주세요.' });
    return accessToken().then(function (tok) {
      if (!tok) return { ok: false, code: 'no_session', message: '로그인이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.' };
      var body = { password: pw };
      if (currentPassword) body.current_password = String(currentPassword);
      return sbFetch('/user', { method: 'PUT', body: body, token: tok }).then(function () {
        return { ok: true };
      }, function (err) {
        return { ok: false, code: (err && err.code) || 'error', message: (err && err.message) || '비밀번호를 바꾸지 못했어요.' };
      });
    });
  }

  /* 비밀번호 재설정 메일 보내기 */
  function recoverPassword(email) {
    var e = normEmail(email);
    if (!EMAIL_RE.test(e)) return Promise.resolve({ ok: false, code: 'bad_email', message: '이메일 주소를 확인해 주세요.' });
    var body = { email: e };
    try {
      var here = String((root.location && root.location.href) || '').split('#')[0];
      if (here) body.redirect_to = here;
    } catch (err) { /* 주소를 못 읽으면 기본 주소(Site URL)로 보냅니다 */ }
    return sbFetch('/recover', { method: 'POST', body: body }).then(function () {
      return { ok: true, message: '재설정 메일을 보냈어요. 받은 편지함(스팸함 포함)을 확인해 주세요.' };
    }, function (err) {
      return { ok: false, code: (err && err.code) || 'error', message: (err && err.message) || '메일을 보내지 못했어요.' };
    });
  }

  /* 서버 쪽 세션 정리(로그아웃) — 실패해도 기기 세션은 지웁니다 */
  function signOutRemote() {
    var cur = sbAuthState();
    if (!cur || !cur.access_token) return Promise.resolve(false);
    return sbFetch('/logout', { method: 'POST', token: cur.access_token }).then(function () {
      clearSbAuth();
      return true;
    }, function (err) {
      if (err && err.code === 'no_session') clearSbAuth();
      return false;
    });
  }

  /* 재설정 메일 링크로 돌아왔을 때: 주소(#access_token=…&type=recovery)에서 세션을 받아옵니다 */
  function bootstrapRecovery() {
    if (typeof root.location === 'undefined' || !root.location) return Promise.resolve(null);
    var hash = String(root.location.hash || '');
    if (hash.indexOf('access_token=') < 0) return Promise.resolve(null);
    var q = {};
    hash.replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (!q.access_token) return Promise.resolve(null);
    var next = {
      access_token: q.access_token,
      refresh_token: q.refresh_token || '',
      expires_at: Math.floor(Date.now() / 1000) + (Number(q.expires_in) || 3600),
      uid: '', email: ''
    };
    saveSbAuth(next);
    try { history.replaceState(null, '', String(root.location.pathname || '#/')); } catch (e) { /* 주소창 정리는 실패해도 됨 */ }
    return sbFetch('/user', { token: next.access_token }).then(function (user) {
      var email = normEmail((user && user.email) || '');
      var cur = sbAuthState() || next;
      cur.uid = String((user && user.id) || '');
      cur.email = email;
      saveSbAuth(cur);
      /* 이미 앱 세션이 있으면 그대로, 없으면 새로 만듭니다 */
      var s = session();
      if (!s || s.kind === 'guest') s = signInEmailAccount({ email: email, name: email.split('@')[0], token: cur.access_token, source: 'supabase' });
      ensureAccount({});
      return { email: email, recovery: q.type === 'recovery', session: s };
    }).catch(function () { return null; });
  }

  /* ---------- 표시 도우미 ---------- */
  function kindLabel(s) {
    s = s || session();
    if (!s) return '로그인 전';
    if (s.kind === 'google') return s.demo ? 'Google (데모)' : 'Google 연동';
    if (s.kind === 'email') return '이메일 계정';
    return '체험 모드';
  }

  /* 계정별 로컬 데이터 키 (체험 모드 데이터와 섞이지 않게) */
  function rowsKeyFor(s) {
    s = s || session();
    if (!s || s.kind === 'guest') return 'bm_rows_v1';
    return 'bm_rows_v1::' + identityKey(s);
  }

  /* 계정별 사용자 키 — 체험 모드의 demo_me와 겹치지 않게 따로 둡니다 */
  function meKeyFor(s) {
    s = s || session();
    if (!s || s.kind === 'guest') return BM.seed ? BM.seed.ME : 'demo_me';
    return 'u_' + fnv(identityKey(s)).slice(0, 12);
  }

  BM.auth = {
    SESSION_KEY: SESSION_KEY, ACCOUNTS_KEY: ACCOUNTS_KEY,
    CLIENT_ID_KEY: CLIENT_ID_KEY, PROFILE_KEY: PROFILE_KEY, BRIDGE_KEY: BRIDGE_KEY,
    DEFAULT_BRIDGE_URL: DEFAULT_BRIDGE_URL,
    DEMO_GOOGLE: DEMO_GOOGLE,
    session: session, identityKey: identityKey, kindLabel: kindLabel, rowsKeyFor: rowsKeyFor, meKeyFor: meKeyFor,
    signInGuest: signInGuest, signInGoogle: signInGoogle, signInEmail: signInEmail,
    signInEmailAccount: signInEmailAccount,
    /* v1.26 — Supabase Auth */
    SB_AUTH_KEY: SB_AUTH_KEY,
    signInEmailSupabase: signInEmailSupabase,
    hasSupabaseAuth: hasSupabaseAuth, prefersSheetsAuth: prefersSheetsAuth,
    accessToken: accessToken, refreshTokens: refreshTokens,
    ensureAccount: ensureAccount, changePassword: changePassword, recoverPassword: recoverPassword,
    signOutRemote: signOutRemote, clearSbAuth: clearSbAuth, sbAuthState: sbAuthState,
    bootstrapRecovery: bootstrapRecovery, signInGoogleIdToken: linkGoogleIdToken,
    /* bm-v1.59.0 — 토큰 연결 직후 대기열 한 번 더 보내기 */
    retryPendingSync: retryPendingSync, takeSyncRetry: takeSyncRetry,
    signOut: signOut, signOutKeepAccounts: signOutKeepAccounts, signOutLocal: signOutLocal,
    needsOnboarding: needsOnboarding, markOnboarded: markOnboarded, profileFor: profileFor,
    googleClientId: googleClientId, setGoogleClientId: setGoogleClientId, isGoogleClientId: isGoogleClientId,
    isDefaultGoogleClientId: isDefaultGoogleClientId, DEFAULT_GOOGLE_CLIENT_ID: DEFAULT_GOOGLE_CLIENT_ID,
    loadGoogleScript: loadGoogleScript, googleReady: googleReady,
    renderGoogleButton: renderGoogleButton, requestGoogleSignIn: requestGoogleSignIn,
    decodeJwt: decodeJwt, hashPassword: hashPassword, verifyHash: verifyHash,
    accountOf: accountOf, accounts: accounts,
    bridgeUrl: bridgeUrl, saveBridgeUrl: saveBridgeUrl,
    isEmail: function (v) { return EMAIL_RE.test(normEmail(v)); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
