/* ============================================================
 * push.js — 실시간 푸시 알림 틀 (bm-v1.57.0 → bm-v1.77.0)
 *
 * Firebase 프로젝트 키가 아직 연결되지 않았습니다. 키만 넣으면 바로 동작하도록
 * 권한 요청 · 서비스워커 구독 · 토큰(구독) 저장 · 알림 눌렀을 때 갈 화면까지
 * 미리 만들어 둡니다.
 *
 *   1) js/api.js 의 PUSH_CONFIG.vapidPublicKey 에 Firebase 콘솔 > 클라우드 메시징 >
 *      웹 푸시 인증서(VAPID) 공개 키를 채웁니다.
 *   2) 스위치를 켠 사람은 Permission granted + PushManager.subscribe 가 되면
 *      구독(엔드포인트·키)을 이 기기에 저장합니다(bm_push_v1).
 *   3) 서버가 보낸 푸시는 sw.js 가 받아 알림을 띄우고, 누르면 data.url 로
 *      앱의 그 화면(5개 탭·채팅)을 열거나 앞으로 가져옵니다.
 *
 * 키가 없을 때는 아무 것도 구독하지 않고 'Firebase 연결 준비됨 · 곧 켜져요'로만
 * 보여 줍니다(에러·콘솔 경고 없음).
 *
 * bm-v1.77.0 — 토큰 저장 + 발송 서버 연결
 *   4) 안드로이드 앱(TWA·웹뷰)이 FCM 등록 토큰을 넘겨 주면 두 가지로 받습니다.
 *      · 표준 통로: window.ShuttlixPush.register(token, 'android')
 *      · 옛 통로  : window.AndroidBridge.requestPushToken() / postMessage
 *   5) 받은 토큰은 `register_push_token` 서버 함수로 내 계정에 저장합니다(본인 토큰만).
 *      → supabase/push-v1.77.sql
 *   6) 채팅·약속 카드·매칭 요청·게스트 신청이 나간 직후 `send-push` 서버 함수로
 *      상대에게 알림을 부탁합니다. Firebase 키(FCM_SERVICE_ACCOUNT_JSON)가 아직 없으면
 *      서버는 pending_fcm_secret 만 돌려주고, 앱은 그 응답을 조용히 지나갑니다.
 *      → 어떤 경우에도 메시지 전송 자체를 막지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var STORE_KEY = 'bm_push_v1';
  var TOKEN_KEY = 'bm_push_token_v1';     /* bm-v1.77.0 — 이 기기의 푸시 토큰 */
  var LAST_KEY = 'bm_push_last_v1';       /* bm-v1.77.0 — 마지막 발송 결과(화면 표시용) */
  var TABS = ['log', 'matching', 'community', 'coach', 'my'];
  var SEND_TIMEOUT = 8000;
  /* 알림 문구 — 짧고 담백하게(이모지·과한 감탄 없이) */
  var MESSAGES = {
    chat: { title: '새 채팅', url: '#/chat' },
    appt: { title: '코트 약속 카드', url: '#/chat' },
    match: { title: '1:1 매칭 요청', url: '#/matching', line: '님이 매칭을 신청했어요' },
    guest: { title: '게스트 신청', url: '#/community', line: '님이 게스트로 신청했어요' },
    guest_accept: { title: '게스트 신청 수락', url: '#/community', line: '님이 함께 하기로 했어요' },
    guest_reject: { title: '게스트 신청', url: '#/community', line: '님이 이번엔 함께하지 못해요' }
  };

  function config() {
    if (BM.api && typeof BM.api.pushConfig === 'function') return BM.api.pushConfig();
    return { vapidPublicKey: '', topic: '' };
  }

  /* Firebase 키가 채워졌는지 — 이 값이 없으면 구독을 시도하지 않습니다 */
  function keyReady() {
    var k = String(config().vapidPublicKey || '');
    return k.length > 40;      /* VAPID 공개 키는 87자 안팎입니다 */
  }

  function supported() {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
    return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  }

  function permission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission || 'default';
  }

  /* MY에 보여 줄 상태 — 에러 없이 네 가지 중 하나 */
  function status() {
    var perm = permission();
    var ready = keyReady();
    var stored = read();
    var id, label;
    if (perm === 'unsupported' || !supported()) { id = 'unsupported'; label = '이 브라우저는 지원하지 않아요'; }
    else if (perm === 'denied') { id = 'denied'; label = '차단됨'; }
    else if (!ready) { id = 'ready'; label = 'Firebase 연결 준비됨 · 곧 켜져요'; }
    else if (perm === 'granted' && stored && stored.endpoint) { id = 'on'; label = '허용됨 · 켜짐'; }
    else if (perm === 'granted') { id = 'granted'; label = '허용됨'; }
    else { id = 'default'; label = '미설정'; }
    return {
      id: id, label: label, permission: perm,
      firebaseReady: ready, subscribed: !!(stored && stored.endpoint),
      canAsk: perm === 'default' && supported(),
      savedAt: (stored && stored.at) || ''
    };
  }

  function read() {
    try { return U.readJSON(STORE_KEY, null); } catch (e) { return null; }
  }

  function save(subscription) {
    var json = null;
    try { json = subscription && subscription.toJSON ? subscription.toJSON() : subscription; } catch (e) { json = null; }
    var rec = {
      endpoint: (json && json.endpoint) || '',
      keys: (json && json.keys) || {},
      at: U.stamp(),
      topic: String(config().topic || '')
    };
    if (!rec.endpoint) return null;
    try { U.writeJSON(STORE_KEY, rec); } catch (e) { /* 저장 못 해도 구독은 살아 있음 */ }
    return rec;
  }

  function clear() {
    try { U.storage.removeItem(STORE_KEY); } catch (e) { /* 무시 */ }
  }

  /* 브라우저 알림 권한 요청 — 사용자가 직접 누를 때만 부릅니다 */
  function requestPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission);
    try {
      var p = Notification.requestPermission();
      if (p && typeof p.then === 'function') return p.catch(function () { return permission(); });
      return new Promise(function (resolve) {
        Notification.requestPermission(function (v) { resolve(v || permission()); });
      });
    } catch (e) {
      return Promise.resolve(permission());
    }
  }

  /* base64 → Uint8Array (applicationServerKey) */
  function urlB64ToUint8Array(base64String) {
    var padding = new Array(4 - ((base64String.length % 4) % 4) + 1).join('=');
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /* 서비스워커에 구독 — 키가 없으면 조용히 no_key */
  function subscribe(reg) {
    if (!keyReady()) return Promise.resolve({ ok: false, reason: 'no_key' });
    if (!supported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
    if (permission() !== 'granted') return Promise.resolve({ ok: false, reason: 'permission', permission: permission() });
    var ready = reg ? Promise.resolve(reg) : navigator.serviceWorker.ready;
    return ready.then(function (r) {
      if (!r || !r.pushManager) return { ok: false, reason: 'unsupported' };
      return r.pushManager.getSubscription().then(function (old) {
        if (old) { save(old); return { ok: true, subscription: save(old) }; }
        return r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(String(config().vapidPublicKey))
        }).then(function (next) {
          return { ok: true, subscription: save(next) };
        });
      });
    }).catch(function (err) {
      return { ok: false, reason: 'subscribe_failed', message: (err && err.message) || '' };
    });
  }

  function unsubscribe() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker || !navigator.serviceWorker.ready) {
      clear();
      return Promise.resolve({ ok: true });
    }
    return navigator.serviceWorker.ready.then(function (r) {
      return r.pushManager ? r.pushManager.getSubscription() : null;
    }).then(function (sub) {
      clear();
      if (!sub) return { ok: true };
      return sub.unsubscribe().then(function () { return { ok: true }; });
    }).catch(function () { clear(); return { ok: false, reason: 'unsubscribe_failed' }; });
  }

  /* 스위치를 켤 때: (키가 있으면) 권한 → 구독. 키가 없으면 권한 창을 띄우지 않고
   * 스위치만 켜 둡니다 — 아직 동작하지 않는 기능으로 알림 권한을 묻지 않습니다. */
  function enable() {
    if (!keyReady()) return Promise.resolve({ ok: true, waiting: true, status: status() });
    if (!supported()) return Promise.resolve({ ok: false, reason: 'unsupported', status: status() });
    return requestPermission().then(function (perm) {
      if (perm === 'denied') return { ok: false, reason: 'denied', status: status() };
      if (perm !== 'granted') return { ok: false, reason: 'permission', status: status() };
      if (!keyReady()) return { ok: true, waiting: true, status: status() };
      return subscribe().then(function (res) {
        return { ok: !!res.ok, reason: res.reason || '', waiting: false, status: status() };
      });
    });
  }

  /* 앱을 열 때마다 — 스위치를 켜 둔 사람은 권한이 살아 있으면 조용히 다시 구독합니다 */
  function autoEnable(prefs) {
    if (!prefs || prefs.push !== true) return Promise.resolve({ ok: false, reason: 'off' });
    if (!supported() || permission() !== 'granted' || !keyReady()) return Promise.resolve({ ok: false, reason: 'waiting' });
    return subscribe().then(function (res) { return { ok: !!res.ok, waiting: false, reason: res.reason || '' }; });
  }

  /* 알림을 눌렀을 때 갈 곳 — 알림 payload의 url(예: '#/matching')을 앱 화면으로 */
  function routeOf(url) {
    var s = String(url || '').trim();
    var i = s.indexOf('#');
    if (i >= 0) s = s.slice(i + 1);           /* 해시만 봅니다 */
    s = s.replace(/^\/+/, '').replace(/^\?.*$/, '');
    var parts = s.split(/[\/?&=]+/).filter(Boolean);
    var tab = '', chat = false, room = '';
    parts.forEach(function (p, idx) {
      if (p === 'chat') { chat = true; return; }
      if (TABS.indexOf(p) >= 0) { tab = p; return; }
      if (idx > 0 && parts[idx - 1] === 'chat' && p !== 'chat') room = p;
    });
    if (chat && !tab) tab = 'matching';
    if (!tab) tab = 'log';
    return { tab: tab, chat: chat, room: room };
  }

  /* 앱 안에서 그 화면으로 이동 (서비스워커가 보낸 알림 클릭) */
  function go(url, ctx) {
    var route = routeOf(url);
    var store = ctx && ctx.store ? ctx.store : (BM.app && BM.app.ctx && BM.app.ctx.store);
    if (!store) return route;
    if (route.chat) {
      store.actions.setTab('matching');
      store.actions.openChats();
      if (route.room) store.actions.openChat(route.room, '');
    } else {
      store.actions.setTab(route.tab);
    }
    return route;
  }

  /* =========================================================
   * bm-v1.77.0 — 푸시 토큰 저장 · 발송 서버 연결 · 네이티브 브리지
   * ========================================================= */

  /* 지금 쓰는 저장소 모드·API — 화면 시작 전(테스트·초기화면)에도 안전하게 */
  function ctxStore() {
    return (BM.app && BM.app.ctx && BM.app.ctx.store) || null;
  }

  function apiNow(opts) {
    if (opts && opts.api) return opts.api;
    var st = ctxStore();
    if (!st) return null;
    try {
      if (typeof st._api === 'function') return st._api();
    } catch (e) { /* 무시 */ }
    return null;
  }

  function modeNow(opts) {
    if (opts && opts.mode != null) return String(opts.mode);
    var st = ctxStore();
    if (st && st.state && st.state.mode) return String(st.state.mode);
    var api = apiNow(opts);
    return api && api.mode ? String(api.mode) : '';
  }

  /* 기기 종류 — android · ios · web */
  function platformOf(p) {
    var s = String(p == null ? '' : p).toLowerCase();
    if (s.indexOf('android') >= 0 || s === 'twa') return 'android';
    if (s.indexOf('ios') >= 0 || s.indexOf('iphone') >= 0 || s.indexOf('ipad') >= 0) return 'ios';
    return 'web';
  }

  function readToken() {
    try { return U.readJSON(TOKEN_KEY, null); } catch (e) { return null; }
  }

  function saveToken(rec) {
    try { U.writeJSON(TOKEN_KEY, rec); } catch (e) { /* 저장 못 해도 서버 등록은 살아 있음 */ }
    return rec;
  }

  function clearToken() {
    try { U.storage.removeItem(TOKEN_KEY); } catch (e) { /* 무시 */ }
  }

  function lastRead() {
    try { return U.readJSON(LAST_KEY, null); } catch (e) { return null; }
  }

  function lastSave(result) {
    var rec = {
      at: U.stamp(),
      status: String((result && result.status) || ''),
      sent: Number((result && result.sent) || 0) || 0
    };
    try { U.writeJSON(LAST_KEY, rec); } catch (e) { /* 무시 */ }
    return rec;
  }

  /* 알림 한 줄 — [{제목}, {본문}, {갈 곳}] */
  function messageOf(kind, opts) {
    opts = opts || {};
    var id = String(kind || '').toLowerCase();
    var spec = MESSAGES[id];
    if (!spec) return null;
    var me = opts.me || {};
    var nick = String(opts.nick || me.nick || '회원').slice(0, 16);
    var text = String(opts.text || '').replace(/\s+/g, ' ').trim();
    var body;
    if (id === 'chat') body = nick + ': ' + (text ? text.slice(0, 80) : '새 메시지가 도착했어요');
    else if (id === 'appt') body = nick + ': ' + (text ? text.slice(0, 90) : '코트 약속 카드를 보냈어요');
    else body = nick + (spec.line || '님이 알려 드렸어요');
    return { title: spec.title, body: body.slice(0, 160), url: appUrlOf(id, opts.room) };
  }

  /* 알림을 누르면 갈 곳 — 앱 안 화면(#/...)만 */
  function appUrlOf(kind, room) {
    var id = String(kind || '').toLowerCase();
    var base = (MESSAGES[id] && MESSAGES[id].url) || '#/log';
    if (id === 'chat' || id === 'appt') {
      var r = String(room || '').replace(/[^A-Za-z0-9_-]/g, '');
      if (r) return base + '/' + r.slice(0, 40);
    }
    return base;
  }

  function sendUrl() {
    var sb = (BM.api && BM.api.SUPABASE) || {};
    var base = String(sb.url || '').replace(/\/+$/, '');
    return base ? base + '/functions/v1/send-push' : '';
  }

  function tokenFor() {
    try {
      if (BM.auth && typeof BM.auth.accessToken === 'function') {
        return Promise.resolve(BM.auth.accessToken()).then(function (t) { return String(t || ''); }, function () { return ''; });
      }
    } catch (e) { /* 무시 */ }
    return Promise.resolve('');
  }

  /* 발송 요청 — 8초 타임아웃 · 어떤 실패도 예외로 던지지 않습니다 */
  function postSend(payload) {
    var url = sendUrl();
    if (!url || typeof fetch !== 'function') return Promise.resolve({ ok: false, status: 'no_url' });
    return tokenFor().then(function (token) {
      var sb = (BM.api && BM.api.SUPABASE) || {};
      var headers = { 'Content-Type': 'application/json' };
      var key = sb.publishableKey || sb.anonKey || '';
      if (key) headers['apikey'] = key;
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = (ctrl && typeof setTimeout === 'function')
        ? setTimeout(function () { try { ctrl.abort(); } catch (e) { /* 무시 */ } }, SEND_TIMEOUT)
        : null;
      var init = { method: 'POST', headers: headers, body: JSON.stringify(payload) };
      if (ctrl) init.signal = ctrl.signal;
      return fetch(url, init).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.text().then(function (text) {
          var data = null;
          if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
          if (data && typeof data === 'object') return data;
          return { ok: res.ok, status: res.ok ? 'sent' : 'unknown_' + res.status };
        });
      }).catch(function () {
        if (timer) clearTimeout(timer);
        return { ok: false, status: 'offline' };
      });
    }).catch(function () { return { ok: false, status: 'error' }; });
  }

  /* 채팅·약속 카드·매칭 요청·게스트 신청이 나간 '직후' 부르는 훅.
   * Supabase 모드가 아니면(체험·시트) 아무 것도 보내지 않고, 실패해도 조용합니다. */
  function notify(kind, opts) {
    opts = opts || {};
    return Promise.resolve().then(function () {
      var to = String(opts.to || '').trim();
      if (!to) return { ok: false, status: 'no_target' };
      if (to === String((opts.me && opts.me.key) || '')) return { ok: false, status: 'self' };
      var mode = modeNow(opts);
      if (mode && mode !== 'supabase') return { ok: false, status: 'not_remote' };
      var msg = messageOf(kind, opts);
      if (!msg) return { ok: false, status: 'unknown' };
      return postSend({
        userKey: to,
        kind: String(kind || '').toLowerCase(),
        title: msg.title,
        body: msg.body,
        url: msg.url,
        roomId: String(opts.room || '').slice(0, 64)
      }).then(function (res) {
        lastSave(res);
        return res;
      });
    }).catch(function () { return { ok: false, status: 'error' }; });
  }

  /* 푸시 토큰 등록 — 기기에 먼저 남기고(Supabase가 아니어도 상태는 보임) 서버에 올립니다. */
  function registerToken(token, platform, opts) {
    opts = opts || {};
    var clean = String(token == null ? '' : token).trim().slice(0, 4096);
    if (clean.length < 8) return Promise.resolve({ ok: false, reason: 'bad_token', status: background() });
    var plat = platformOf(platform || 'android');
    var ua = '';
    try { ua = String((root.navigator && root.navigator.userAgent) || '').slice(0, 160); } catch (e) { ua = ''; }
    saveToken({ token: clean, platform: plat, at: U.stamp(), ua: ua });

    var done = function (extra) {
      var out = { ok: true, local: true, status: background() };
      Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
      return out;
    };

    if (modeNow(opts) !== 'supabase') return Promise.resolve(done({ pending: true }));
    var api = apiNow(opts);
    if (!api || typeof api.rpc !== 'function') return Promise.resolve(done({ pending: true }));
    return Promise.resolve(api.rpc('register_push_token', { p_token: clean, p_platform: plat, p_ua: ua }))
      .then(function (res) {
        var r = res || {};
        return done({
          pending: false,
          saved: r.ok !== false,
          count: r.count == null ? null : r.count,
          reason: r.ok === false ? String(r.reason || 'rejected') : ''
        });
      }, function () {
        return { ok: false, reason: 'offline', local: true, status: background() };
      });
  }

  /* 푸시 토큰 해제 — 토큰을 모르면 내 기기 전부(서버 함수가 본인 것만 지움) */
  function unregisterToken(token, opts) {
    opts = opts || {};
    var clean = String(token == null ? '' : token).trim();
    var saved = readToken();
    if (!clean && saved && saved.token) clean = String(saved.token);
    clearToken();
    if (modeNow(opts) !== 'supabase') return Promise.resolve({ ok: true, local: true, status: background() });
    var api = apiNow(opts);
    if (!api || typeof api.rpc !== 'function') return Promise.resolve({ ok: true, local: true, status: background() });
    return Promise.resolve(api.rpc('unregister_push_token', { p_token: clean || null }))
      .then(function (res) {
        return { ok: true, removed: (res && res.removed) || 0, status: background() };
      }, function () {
        return { ok: false, reason: 'offline', status: background() };
      });
  }

  /* 앱을 열 때 — 이 기기에 저장된 토큰을 서버에 한 번 더 맞춰 둡니다(재로그인·계정 변경) */
  function syncToken(opts) {
    var rec = readToken();
    if (!rec || !rec.token) return Promise.resolve({ ok: false, reason: 'no_token' });
    if (modeNow(opts) !== 'supabase') return Promise.resolve({ ok: false, reason: 'not_remote' });
    return registerToken(rec.token, rec.platform, opts);
  }

  /* 서버에 저장된 내 기기 수(MY 표시용 · 토큰 값은 오지 않습니다) */
  function myTokens(opts) {
    opts = opts || {};
    if (modeNow(opts) !== 'supabase') return Promise.resolve({ ok: false, reason: 'not_remote' });
    var api = apiNow(opts);
    if (!api || typeof api.rpc !== 'function') return Promise.resolve({ ok: false, reason: 'no_api' });
    return Promise.resolve(api.rpc('my_push_tokens', {})).then(function (res) {
      return res || { ok: false, reason: 'empty' };
    }, function () { return { ok: false, reason: 'offline' }; });
  }

  /* MY › 백그라운드 푸시 상태 — 스토어 앱 연동 준비 정도를 한 줄로 */
  function background() {
    var rec = readToken();
    var last = lastRead();
    var perm = permission();
    var out;
    if (rec && rec.token) {
      var plat = platformOf(rec.platform);
      out = {
        id: 'linked',
        label: plat === 'android' ? '앱에 연결됨' : plat === 'ios' ? '아이폰에 연결됨' : '웹에 연결됨',
        detail: '새 채팅·신청을 앱을 닫아 둬도 폰 알림으로 받아요.'
      };
    } else if (perm === 'denied') {
      out = { id: 'denied', label: '알림 차단됨', detail: '폰 설정에서 이 사이트·앱 알림을 허용하면 켜져요.' };
    } else if (last && (last.status === 'pending_fcm_secret' || last.status === 'no_tokens')) {
      out = { id: 'waiting', label: 'Firebase 키 대기', detail: '키가 들어오면 자동으로 켜져요. 지금은 앱 안 알림만 와요.' };
    } else {
      out = { id: 'ready', label: '스토어 앱 연결 준비', detail: '앱을 설치하고 알림을 켜면 이 기기가 자동으로 연결돼요.' };
    }
    out.platform = rec ? platformOf(rec.platform) : '';
    out.hasToken = !!(rec && rec.token);
    out.at = (rec && rec.at) || '';
    out.last = last || null;
    return out;
  }

  /* 네이티브에 토큰을 물어보기 — AndroidBridge(옛 통로)가 있으면 한 번 부릅니다.
   * 앱은 곧바로 돌려주거나, 나중에 ShuttlixPush.register 로 넘겨 줍니다. */
  function requestNativeToken() {
    var bridge = root.AndroidBridge || (root.android && root.android.push) || null;
    if (!bridge) return Promise.resolve({ ok: false, reason: 'no_bridge' });
    try {
      var get = typeof bridge.getPushToken === 'function' ? bridge.getPushToken : bridge.requestPushToken;
      if (typeof get !== 'function') return Promise.resolve({ ok: false, reason: 'no_bridge' });
      var token = get.call(bridge);
      if (token && typeof token === 'string') return registerToken(token, 'android');
      return Promise.resolve({ ok: true, waiting: true });
    } catch (e) {
      return Promise.resolve({ ok: false, reason: 'bridge_failed' });
    }
  }

  /* 앱 안내용 표준 통로 — window.ShuttlixPush */
  function installBridge() {
    if (typeof window === 'undefined') return null;
    var api = {
      version: 'v1.102.0',
      register: function (token, platform) { return registerToken(token, platform); },
      unregister: function (token) { return unregisterToken(token); },
      token: function () { var r = readToken(); return r ? String(r.token || '') : ''; },
      status: function () { return background(); },
      requestToken: requestNativeToken
    };
    try { window.ShuttlixPush = api; } catch (e) { /* 무시 */ }

    /* 웹뷰·TWA가 postMessage로 넘기는 경우 */
    try {
      window.addEventListener('message', function (ev) {
        var d = ev && ev.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
        if (!d || typeof d !== 'object') return;
        var type = String(d.type || '');
        if (type === 'BM_PUSH_TOKEN' || type === 'SHUTTLIX_PUSH_TOKEN') registerToken(d.token, d.platform || 'android');
        else if (type === 'BM_PUSH_TOKEN_CLEAR') unregisterToken(d.token || '');
      });
      /* 커스텀 이벤트(shuttlix:push-token) — 네이티브가 그대로 쏠 수 있는 형태 */
      window.addEventListener('shuttlix:push-token', function (ev) {
        var d = (ev && ev.detail) || {};
        if (d && d.token) registerToken(d.token, d.platform || 'android');
      });
    } catch (e) { /* 이벤트를 못 붙여도 위 api 는 살아 있음 */ }

    requestNativeToken();
    return api;
  }

  BM.push = {
    supported: supported, permission: permission, status: status,
    keyReady: keyReady, config: config,
    requestPermission: requestPermission, subscribe: subscribe, unsubscribe: unsubscribe,
    enable: enable, autoEnable: autoEnable,
    read: read, clear: clear, routeOf: routeOf, go: go,
    urlB64ToUint8Array: urlB64ToUint8Array,
    STORE_KEY: STORE_KEY,
    /* bm-v1.77.0 — 토큰·발송 */
    notify: notify, registerToken: registerToken, unregisterToken: unregisterToken,
    syncToken: syncToken, myTokens: myTokens, background: background,
    token: readToken, lastSend: lastRead, clearToken: clearToken,
    requestToken: requestNativeToken, installBridge: installBridge,
    messageOf: messageOf, appUrlOf: appUrlOf, platformOf: platformOf,
    TOKEN_KEY: TOKEN_KEY, LAST_KEY: LAST_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
