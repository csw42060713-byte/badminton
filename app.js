/* ============================================================
 * app.js — 앱 시작, 인증 게이트(시작화면), 탭 이동, 화면 다시 그리기
 *
 *  첫 진입: 로그인 세션이 없으면 하단 탭바를 숨기고 시작화면(게이트)만 보여 줍니다.
 *  로그인/가입/둘러보기 후: 저장소를 만들고 일지 & AI 화면으로 들어갑니다.
 *  신규 가입자: 첫 로그인 직후 10초 온보딩(닉네임·급수·종목·지역)을 한 화면에서 받습니다.
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
  var gated = false;      /* 시작화면·온보딩 중에는 일반 화면 갱신을 멈춥니다 */

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
    if (!main || !store || !store.state.ready) return;
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
    if (!state.ready || gated) return;
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
    if (gated) return;
    if (painting) { pendingRepaint = true; return; }
    mountView(currentTab || (store && store.state.ui.tab) || 'log');
  }

  /* ---------- 저장 버튼(연타 잠금 + 즉시 피드백) ---------- */
  function saveLogWithFeedback(btn) {
    if (!store) return;
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
      BM.auth.saveBridgeUrl(url);
      if (BM.auth.session()) BM.auth.signInEmailAccount({ email: email, name: (res.me && res.me.nick) || nick, token: res.token, source: 'sheets' });
      store._replaceApi(api);
      U.writeJSON('bm_mode_v1', 'sheets');
      return store.actions.reload().then(function () {
        return { ok: true, me: res.me };
      });
    }).catch(function (err) {
      return { ok: false, message: (err && err.message) || '연결하지 못했어요.' };
    });
  }

  /* ---------- 시작화면(게이트) ---------- */
  function hideSplash() {
    var sp = el('splash');
    if (sp) sp.classList.add('is-off');
  }

  function setNav(on) {
    var nav = el('tabbar');
    if (nav) nav.hidden = !on;
  }

  function showGate() {
    gated = true;
    currentTab = null;
    document.body.classList.add('is-gate');
    document.body.classList.remove('is-onboarding');
    setNav(false);
    hideSplash();
    /* 시작화면은 특정 탭의 주소를 남기지 않습니다 */
    if (location.hash && location.hash !== '#/') {
      try { history.replaceState(null, '', '#/'); } catch (e) { /* 무시 */ }
    }
    var host = el('main');
    if (!host || !BM.views.start) return;
    BM.views.start.reset();
    BM.views.start.mount(host, {
      onDone: function () {
        var s = BM.auth.session();
        if (s) enterApp(s);
      }
    });
  }

  function showOnboarding(session) {
    gated = true;
    document.body.classList.add('is-onboarding');
    setNav(false);
    var host = el('main');
    if (!host) return;
    BM.views.start.mountOnboarding(host, {
      onComplete: function (patch) {
        store.actions.saveProfile({
          nick: patch.nick, level: patch.level, discipline: patch.discipline,
          gender: patch.gender || '비공개',
          region: patch.region || '', club: patch.club || ''
        });
        store.actions.saveMatchProfile({
          region: patch.region || '', level: patch.level, discipline: patch.discipline,
          club: patch.club || '', availability: '', experience: '', bio: '', avatar: '🏸',
          gender: patch.gender || '비공개'
        });
        BM.auth.markOnboarded(patch);
        document.body.classList.remove('is-onboarding');
        setNav(true);
        store.actions.setTab('log');
        gated = false;
        paintChrome(store.state);
        mountView('log');
        try { history.replaceState(null, '', '#/log'); } catch (e) { /* 무시 */ }
        U.writeJSON('bm_seen_v1', true);
        UI.haptic(16);
        UI.toast(patch.nick + '님, 준비됐어요! 오늘 일지를 남겨 보세요.');
      }
    });
  }

  /* ---------- 앱 진입 ---------- */
  function enterApp(session) {
    gated = false;
    document.body.classList.remove('is-gate');
    document.body.classList.remove('is-onboarding');
    setNav(true);
    hideSplash();
    /* 시작화면/온보딩 리스너를 떼어 냅니다(본문 클릭과 겹치지 않게) */
    if (BM.views.start && BM.views.start.unmount) BM.views.start.unmount();

    var saved = BM.api.savedSession();
    var sheets = !!(session && session.kind !== 'guest' && saved && saved.token && saved.url);
    var api;
    if (sheets) {
      api = BM.api.createSheets({ url: saved.url, token: saved.token });
    } else {
      var ident = session && session.kind !== 'guest' ? {
        nick: session.name || '',
        level: (session.profile && session.profile.level) || '',
        discipline: (session.profile && session.profile.discipline) || '',
        region: (session.profile && session.profile.region) || '',
        club: (session.profile && session.profile.club) || ''
      } : null;
      api = BM.api.createLocal({ latency: 120, rowsKey: BM.auth.rowsKeyFor(session), meKey: BM.auth.meKeyFor(session), me: ident });
    }

    store = BM.store.createStore({ api: api });
    ctx = {
      store: store,
      actions: store.actions,
      saveLog: saveLogWithFeedback,
      connectSheets: connectSheets,
      repaint: repaint,
      refresh: repaint,
      signOut: signOut,
      auth: BM.auth
    };
    BM.app.ctx = ctx;
    store.subscribe(onChange);

    var startTab = (location.hash || '').replace('#/', '') || 'log';
    if (!TABS.some(function (t) { return t.id === startTab; })) startTab = 'log';
    store.state.ui.tab = startTab;

    store.actions.init().then(function () {
      if (!store) return;
      paintChrome(store.state);
      var s = BM.auth.session();
      if (BM.auth.needsOnboarding(s, store.state.me)) {
        showOnboarding(s);
        return;
      }
      mountView(store.state.ui.tab);
      if (store.state.syncError) UI.toast(store.state.syncError, 'error');
      if (!U.readJSON('bm_seen_v1', false)) welcome();
    });
  }

  /* ---------- 계정 전환 ---------- */
  function signOut() {
    var sess = BM.auth.session();
    if (sess && sess.kind !== 'guest') {
      var saved = BM.api.savedSession();
      if (saved && saved.url && saved.token) {
        try { BM.api.createSheets({ url: saved.url, token: saved.token }).logout(); } catch (e) { /* 무시 */ }
      }
      U.storage.removeItem(BM.api.SESSION_KEY);
    }
    BM.auth.signOut();
    store = null;
    ctx = null;
    BM.app.ctx = null;
    showGate();
  }

  function welcome() {
    U.writeJSON('bm_seen_v1', true);
    var sess = BM.auth.session();
    var guest = !sess || sess.kind === 'guest';
    UI.openSheet({
      title: '환영합니다 🏸',
      body: '<p class="sheet__text">' + (guest
          ? '지금은 <b>체험 모드</b>예요. 이 기기에만 저장되고, 남긴 기록으로 모든 기능을 써 볼 수 있어요.'
          : '<b>' + U.esc((sess && sess.name) || '회원') + '</b>님, 준비가 끝났어요.') + '</p>' +
        '<ul class="bullets">' +
        '<li>일지를 저장하면 <b>AI가 드릴·처방·이번 주 루틴</b>을 만들어 줘요.</li>' +
        '<li>연타해도 <b>한 번만 저장</b>됩니다. 버튼을 두 번 눌러 확인해 보세요.</li>' +
        '<li>계정과 시트 연결은 <b>MY</b>에서 언제든 바꿀 수 있어요.</li>' +
        '</ul><button class="btn btn--primary btn--big mt16" data-close>시작하기</button>'
    });
  }

  /* 보상형 광고 결과 훅 (모바일 앱 WebView) */
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

  /* ---------- 하단 탭/해시 (한 번만 연결) ---------- */
  function bindChrome() {
    var nav = el('tabbar');
    if (nav) {
      nav.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-tab]');
        if (!btn || !store || gated) return;
        var id = btn.getAttribute('data-tab');
        UI.haptic(6);
        store.actions.setTab(id);
      });
    }
    var heartsBtn = el('hdrHearts');
    if (heartsBtn) heartsBtn.addEventListener('click', function () {
      if (!store || gated) return;
      store.actions.setTab('my');
    });

    window.addEventListener('hashchange', function () {
      if (!store || gated) return;
      var id = (location.hash || '').replace('#/', '');
      if (TABS.some(function (t) { return t.id === id; })) store.actions.setTab(id);
    });
  }

  /* ---------- 시작 ---------- */
  function boot() {
    bindChrome();
    var sess = BM.auth.session();
    if (sess) enterApp(sess);
    else showGate();
    registerSW();
  }

  BM.app = { boot: boot, repaint: repaint, TABS: TABS, ctx: ctx, onRewardAdResult: onRewardAdResult, pendingRewardAd: null, signOut: signOut, version: 'v1.2.0' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
