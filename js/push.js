/* ============================================================
 * push.js — 실시간 푸시 알림(FCM Web Push) 틀 (bm-v1.57.0)
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
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var STORE_KEY = 'bm_push_v1';
  var TABS = ['log', 'matching', 'community', 'coach', 'my'];

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

  BM.push = {
    supported: supported, permission: permission, status: status,
    keyReady: keyReady, config: config,
    requestPermission: requestPermission, subscribe: subscribe, unsubscribe: unsubscribe,
    enable: enable, autoEnable: autoEnable,
    read: read, clear: clear, routeOf: routeOf, go: go,
    urlB64ToUint8Array: urlB64ToUint8Array,
    STORE_KEY: STORE_KEY
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
