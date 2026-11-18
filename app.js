/* ============================================================
 * app.js — 앱 시작, 탭 이동, 화면 다시 그리기, 연결 전환
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;

  var TABS = [
    { id: 'log', label: '일지 & AI', icon: 'log' },
    { id: 'matching', label: '1:1 매칭', icon: 'match' },
    { id: 'community', label: '커뮤니티', icon: 'community' },
    { id: 'coach', label: '코치', icon: 'coach' },
    { id: 'my', label: 'MY', icon: 'my' }
  ];

  var store = null;
  var ctx = null;
  var currentTab = null;
  var painting = false;
  var pendingRepaint = false;

  function el(id) { return document.getElementById(id); }

  function tabMeta(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
    return TABS[0];
  }

  function viewOf(tabId) {
    var map = { log: BM.views.log, matching: BM.views.matching, community: BM.views.community, coach: BM.views.coach, my: BM.views.my };
    return map[tabId] || BM.views.log;
  }

  /* ---------- 상단/하단 크롬 ---------- */
  function paintChrome(state) {
    var title = el('hdrTitle');
    if (title) title.textContent = tabMeta(state.ui.tab).label;
    var hearts = el('hdrHearts');
    if (hearts) hearts.innerHTML = UI.icon('heart') + '<span>' + (state.data.hearts ? state.data.hearts.balance : 0) + '</span>';
    var dot = el('syncDot');
    if (dot) {
      dot.className = 'syncdot' +
        (state.syncState === 'syncing' ? ' is-busy' : state.syncState === 'error' ? ' is-error' : '');
      dot.title = state.syncState === 'syncing' ? '저장 중' : state.syncState === 'error' ? '동기화 재시도 대기' : '동기화됨';
    }
    var nav = el('tabbar');
    if (nav) {
      Array.prototype.forEach.call(nav.querySelectorAll('[data-tab]'), function (b) {
        var on = b.getAttribute('data-tab') === state.ui.tab;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-current', on ? 'page' : 'false');
      });
      var matchBtn = nav.querySelector('[data-tab="matching"]');
      if (matchBtn) {
        var badge = matchBtn.querySelector('.nav__badge');
        var unread = state.data.unread || 0;
        if (badge) {
          badge.textContent = unread > 9 ? '9+' : String(unread);
          badge.hidden = !unread;
        }
      }
    }
    var theme = (state.me && state.me.theme && state.me.theme.theme) || 'th_def';
    if (document.documentElement.getAttribute('data-theme') !== theme) {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  /* ---------- 화면 그리기 ---------- */
  function mountView(tabId) {
    var main = el('main');
    if (!main || !store.state.ready) return;
    var view = viewOf(tabId);
    painting = true;
    currentTab = tabId;
    main.innerHTML = '<div class="view" data-view="' + tabId + '">' + view.render(store.state) + '</div>';
    var host = main.querySelector('[data-view]');
    if (view.mount) view.mount(host, ctx);
    painting = false;
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    if (pendingRepaint) { pendingRepaint = false; mountView(tabId); }
  }

  function updateView() {
    var main = el('main');
    var host = main && main.querySelector('[data-view]');
    if (!host) return;
    var view = viewOf(currentTab);
    if (view.update) view.update(host, store.state, ctx);
  }

  function onChange(state) {
    if (!state.ready) return;
    paintChrome(state);
    if (painting) return;
    if (state.ui.tab !== currentTab) {
      mountView(state.ui.tab);
      if (location.hash !== '#/' + state.ui.tab) {
        try { history.replaceState(null, '', '#/' + state.ui.tab); } catch (e) { /* 무시 */ }
      }
      return;
    }
    updateView();
  }

  function repaint() {
    if (painting) { pendingRepaint = true; return; }
    mountView(currentTab || (store && store.state.ui.tab) || 'log');
  }

  /* ---------- 저장 버튼(연타 잠금 + 즉시 피드백) ---------- */
  function saveLogWithFeedback(btn) {
    if (!btn) { store.actions.saveLog(); return; }
    if (btn.dataset.busy === '1') return;         /* 손가락 연타: 즉시 무시 */
    btn.dataset.busy = '1';
    btn.classList.add('is-busy');
    var label = btn.querySelector('span');
    if (label) label.textContent = '저장 중…';
    UI.haptic(12);

    var res = store.actions.saveLog({ keepDraft: true });
    if (res.ok) {
      if (label) label.textContent = '저장됨 ✓';
      UI.toast('일지를 저장했어요. AI 분석을 준비했어요.');
      setTimeout(function () {
        btn.dataset.busy = '0';
        btn.classList.remove('is-busy');
        if (label) label.textContent = '저장하고 AI 분석';
      }, 1100);
      setTimeout(function () {
        var an = el('main') && el('main').querySelector('[data-region="analysis"]');
        if (an && an.scrollIntoView) an.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    } else {
      btn.dataset.busy = '0';
      btn.classList.remove('is-busy');
      if (label) label.textContent = '저장하고 AI 분석';
      if (res.reason === 'locked') UI.toast('잠시만요, 이미 저장 중이에요');
    }
  }

  /* ---------- 실제 시트 연결 ---------- */
  function connectSheets(url, email, password, nick) {
    var api = BM.api.createSheets({ url: url });
    return api.login({ email: email, password: password, nick: nick, create: true }).then(function (res) {
      store._replaceApi(api);
      U.writeJSON('bm_mode_v1', 'sheets');
      return store.actions.reload().then(function () {
        return { ok: true, me: res.me };
      });
    }).catch(function (err) {
      return { ok: false, message: (err && err.message) || '연결하지 못했어요.' };
    });
  }

  /* ---------- 시작 ---------- */
  function boot() {
    var sess = BM.api.savedSession();
    var api;
    if (sess && sess.token && sess.url) {
      api = BM.api.createSheets({ url: sess.url, token: sess.token });
    } else {
      api = BM.api.createLocal({ latency: 120 });
    }
    store = BM.store.createStore({ api: api });
    ctx = {
      store: store,
      actions: store.actions,
      saveLog: saveLogWithFeedback,
      connectSheets: connectSheets,
      repaint: repaint,
      refresh: repaint
    };
    BM.app.ctx = ctx;
    store.subscribe(onChange);

    var startTab = (location.hash || '').replace('#/', '') || 'log';
    if (!TABS.some(function (t) { return t.id === startTab; })) startTab = 'log';
    store.state.ui.tab = startTab;

    var nav = el('tabbar');
    if (nav) {
      nav.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-tab]');
        if (!btn) return;
        var id = btn.getAttribute('data-tab');
        UI.haptic(6);
        store.actions.setTab(id);
      });
    }
    var heartsBtn = el('hdrHearts');
    if (heartsBtn) heartsBtn.addEventListener('click', function () { store.actions.setTab('my'); });

    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#/', '');
      if (TABS.some(function (t) { return t.id === id; })) store.actions.setTab(id);
    });

    store.actions.init().then(function () {
      var splash = el('splash');
      if (splash) splash.classList.add('is-off');
      paintChrome(store.state);
      mountView(store.state.ui.tab);
      if (store.state.syncError) UI.toast(store.state.syncError, 'error');
      if (!U.readJSON('bm_seen_v1', false)) welcome();
    });

    registerSW();
  }

  function welcome() {
    U.writeJSON('bm_seen_v1', true);
    UI.openSheet({
      title: '환영합니다 🏸',
      body: '<p class="sheet__text">구글 시트로 만들던 배드민턴 앱을 <b>빠른 모바일 앱</b>으로 옮긴 프로토타입이에요.</p>' +
        '<ul class="bullets">' +
        '<li>일지를 저장하면 <b>AI가 드릴·처방·이번 주 루틴</b>을 만들어 줘요.</li>' +
        '<li>연타해도 <b>한 번만 저장</b>됩니다. 버튼을 두 번 눌러 확인해 보세요.</li>' +
        '<li>지금은 <b>체험 모드</b>예요. MY에서 Apps Script 주소를 넣으면 실제 시트와 연결됩니다.</li>' +
        '</ul><button class="btn btn--primary btn--big mt16" data-close>시작하기</button>'
    });
  }

  /* 보상형 광고 결과 훅 (모바일 앱 WebView)
   * 네이티브: window.BadmintonNative.showRewardedAd('heart_reward')
   * 완료/스킵 시: BadmintonNative → JS: BM.app.onRewardAdResult(true|false, 'heart_reward')
   */
  function onRewardAdResult(rewarded, adUnit) {
    var resolve = BM.app && BM.app.pendingRewardAd;
    if (BM.app) BM.app.pendingRewardAd = null;
    if (typeof resolve === 'function') {
      resolve({ rewarded: !!rewarded, adUnit: adUnit || 'heart_reward' });
    } else if (rewarded && store) {
      store.actions.watchAd({ verified: true, adUnit: adUnit });
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* 오프라인 캐시는 없어도 동작 */ });
  }

  BM.app = { boot: boot, repaint: repaint, TABS: TABS, ctx: ctx, onRewardAdResult: onRewardAdResult, pendingRewardAd: null };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
