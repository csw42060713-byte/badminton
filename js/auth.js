/* ============================================================
 * js/auth.js — 시작화면(인증 게이트)의 계정 상태
 *
 *  1) Google 로그인 : Google Identity Services(GIS) 훅.
 *     - MY > 계정 > 고급 설정(또는 이 화면)에서 OAuth Client ID를 넣으면
 *       실제 구글 계정(이메일·이름·사진)으로 로그인/자동 가입됩니다.
 *     - Client ID가 없으면 '데모 Google 계정'으로 미리보기만 합니다.
 *  2) 이메일 로그인 / 회원가입
 *     - 시트 브리지 주소가 저장돼 있으면 브리지의 login / register를 씁니다.
 *     - 없으면 이 기기에만 저장하는 체험 계정으로 동작합니다.
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
  var ACCOUNTS_KEY = 'bm_accounts_v1';
  var CLIENT_ID_KEY = 'bm_google_client_id_v1';
  var PROFILE_KEY = 'bm_auth_profile_v1';
  var BRIDGE_KEY = 'bm_bridge_url_v1';
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
    return activate({
      kind: 'google',
      email: email,
      name: String(info.name || email.split('@')[0]),
      picture: String(info.picture || ''),
      sub: String(info.sub || ''),
      demo: !!info.demo
    });
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
  function googleClientId() {
    var v = U.readJSON(CLIENT_ID_KEY, '');
    return String(v == null ? '' : v).trim();
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
        picture: payload.picture || ''
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

  /* GIS 기본 버튼이 안 뜰 때를 위한 직접 호출 */
  function requestGoogleSignIn(clientId) {
    var cid = clientId || googleClientId();
    if (!cid) return Promise.reject(new Error('Google Client ID가 설정되지 않았어요.'));
    return loadGoogleScript().then(function () {
      return new Promise(function (resolve, reject) {
        var settled = false;
        function done(info) { if (!settled) { settled = true; resolve(info); } }
        root.google.accounts.id.initialize({
          client_id: cid,
          callback: function (resp) {
            var info = resp && decodeJwt(resp.credential);
            if (info) done(info);
            else reject(new Error('구글 로그인 응답을 읽지 못했어요.'));
          }
        });
        try { root.google.accounts.id.prompt(); } catch (e) { /* 버튼으로 안내 */ }
        setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, 2600);
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
    return (sess && sess.url) || '';
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

  BM.auth = {
    SESSION_KEY: SESSION_KEY, ACCOUNTS_KEY: ACCOUNTS_KEY,
    CLIENT_ID_KEY: CLIENT_ID_KEY, PROFILE_KEY: PROFILE_KEY, BRIDGE_KEY: BRIDGE_KEY,
    DEMO_GOOGLE: DEMO_GOOGLE,
    session: session, identityKey: identityKey, kindLabel: kindLabel, rowsKeyFor: rowsKeyFor,
    signInGuest: signInGuest, signInGoogle: signInGoogle, signInEmail: signInEmail,
    signInEmailAccount: signInEmailAccount,
    signOut: signOut, signOutKeepAccounts: signOutKeepAccounts,
    needsOnboarding: needsOnboarding, markOnboarded: markOnboarded, profileFor: profileFor,
    googleClientId: googleClientId, setGoogleClientId: setGoogleClientId, isGoogleClientId: isGoogleClientId,
    loadGoogleScript: loadGoogleScript, googleReady: googleReady,
    renderGoogleButton: renderGoogleButton, requestGoogleSignIn: requestGoogleSignIn,
    decodeJwt: decodeJwt, hashPassword: hashPassword, verifyHash: verifyHash,
    accountOf: accountOf, accounts: accounts,
    bridgeUrl: bridgeUrl, saveBridgeUrl: saveBridgeUrl,
    isEmail: function (v) { return EMAIL_RE.test(normEmail(v)); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
