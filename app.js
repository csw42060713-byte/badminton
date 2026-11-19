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
  var lastMountedTab = null;   /* 탭이 바뀔 때만 화면 전환 모션을 켭니다 */
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
        /* 매칭 탭 배지: 안 읽은 메시지 + 나에게 온 대기 중인 요청 */
        var meKey = state.me && state.me.key;
        var pendingReq = (state.data.requests || []).filter(function (r) {
          return r.target === meKey && r.status === '대기';
        }).length;
        var unread = (state.data.unread || 0) + pendingReq;
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
    /* 상단 오른쪽 채팅 아이콘: 안 읽은 메시지 + 친구 요청 배지 */
    var chatBtn = el('hdrChat');
    if (chatBtn) {
      var chatBadge = el('hdrChatBadge');
      var total = (state.data.unread || 0) + ((state.data.friendRequests || []).length);
      if (chatBadge) {
        chatBadge.textContent = total > 9 ? '9+' : String(total);
        chatBadge.hidden = !total;
      }
      chatBtn.classList.toggle('has-unread', !!total);
    }
    /* 코치 탭: 관리자에게만 도착한 멘토 신청 배지 */
    var coachBtn = nav && nav.querySelector('[data-tab="coach"]');
    if (coachBtn) {
      var coachBadge = coachBtn.querySelector('.nav__badge');
      var pendingMentor = (state.data.isAdmin && state.data.mentorPending) || 0;
      if (coachBadge) {
        coachBadge.textContent = pendingMentor > 9 ? '9+' : String(pendingMentor);
        coachBadge.hidden = !pendingMentor;
      }
    }
  }

  /* ---------- 1:1 채팅(DM) 패널 ---------- */
  function paintDm(state) {
    var host = el('dm');
    if (!host) return;
    var open = !!(state.ui && state.ui.chatOpen && state.ready && !gated);
    if (!open) {
      if (!host.hidden) {
        host.hidden = true;
        host.innerHTML = '';
        host.dataset.sig = '';
        document.body.classList.remove('no-scroll');
      }
      return;
    }
    var active = document.activeElement;
    var keep = null;
    if (active && active.matches && active.matches('[data-dm-input]')) {
      keep = { value: active.value, pos: active.selectionStart };
    }
    host.hidden = false;
    BM.views.chat.bind(host, ctx);
    BM.views.chat.render(host, state);
    host.dataset.sig = state.ui.chatRoom ? 'room:' + state.ui.chatRoom : 'list';
    if (keep) {
      var inp = host.querySelector('[data-dm-input]');
      if (inp) {
        inp.value = keep.value;
        inp.focus();
        try { inp.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* noop */ }
      }
    }
    document.body.classList.add('no-scroll');
  }

  /* ---------- 오프라인 · 동기화 안내 막대 ----------
   * 기기 저장 모드에서는 저장 자체가 기기에서 이루어지므로 아무 말도 하지 않고,
   * 시트(서버) 모드에서 보낼 것이 남았거나 연결이 끊겼을 때만 짧게 알려 줍니다.
   * (체험·게스트 모드에 '저장 중… N건 남음'이 뜨던 문제의 원인) */
  function netBarText(state) {
    var needsNet = state.mode === 'sheets';
    if (!needsNet) return null;
    var queued = (state.queue && state.queue.length) || 0;
    var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (offline) {
      return { kind: 'off', text: '오프라인 상태예요 · 기록은 기기에 저장되고, 연결되면 자동으로 보내요.', retry: queued > 0 };
    }
    if (state.syncState === 'error' && queued) {
      return { kind: 'warn', text: '보내지 못한 저장 ' + queued + '건이 있어요. 잠시 뒤 자동으로 다시 시도합니다.', retry: true };
    }
    if (state.syncState === 'syncing' && queued) {
      return { kind: 'busy', text: '저장 중… ' + queued + '건 남음', retry: false };
    }
    return null;
  }

  function paintNetBar(state) {
    var bar = el('netbar');
    if (!bar) return;
    var info = state && state.ready && !gated ? netBarText(state) : null;
    if (!info) {
      if (!bar.hidden) {
        bar.hidden = true;
        bar.innerHTML = '';
        bar.className = 'netbar';
        if (document.body) document.body.classList.remove('has-netbar');
      }
      return;
    }
    var sig = info.kind + '|' + info.text + '|' + (info.retry ? 1 : 0);
    if (bar.dataset.sig === sig) return;
    bar.dataset.sig = sig;
    bar.className = 'netbar netbar--' + info.kind;
    bar.innerHTML = '<span class="netbar__t">' + U.esc(info.text) + '</span>' +
      (info.retry ? '<button type="button" class="netbar__btn" data-net-retry>다시 시도</button>' : '');
    bar.hidden = false;
    if (document.body) document.body.classList.add('has-netbar');
  }

  function bindNetBar() {
    var bar = el('netbar');
    if (bar) {
      bar.addEventListener('click', function (ev) {
        if (!ev.target.closest('[data-net-retry]') || !store) return;
        UI.haptic(6);
        UI.toast('다시 보내는 중이에요');
        store.actions.retrySync();
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', function () {
        if (store) { paintNetBar(store.state); if (store.state.queue && store.state.queue.length) store.actions.retrySync(); }
        UI.toast('다시 연결됐어요');
      });
      window.addEventListener('offline', function () { if (store) paintNetBar(store.state); });
    }
  }

  /* ---------- 모바일 키보드: 입력창이 가려지지 않게 ----------
   * 안드로이드 WebView/크롬에서 키보드가 올라오면 화면 높이가 줄어 입력창이 가려집니다.
   * 포커스를 받은 입력 요소를 잠시 뒤 가운데로 스크롤하고, 하단 여백을 키보드 높이만큼 띄웁니다. */
  function bindKeyboardScroll() {
    if (typeof document === 'undefined') return;
    /* 손가락 입력 기기에서만 스크롤을 옮깁니다 (데스크톱에서 클릭할 때 화면이 튀지 않게) */
    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { coarse = false; }
    document.addEventListener('focusin', function (ev) {
      if (!coarse) return;
      var t = ev.target;
      if (!t || !t.tagName) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      setTimeout(function () {
        if (typeof t.scrollIntoView !== 'function') return;
        try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* 구형 브라우저 */ }
      }, 260);
    });
    if (typeof window === 'undefined' || !window.visualViewport) return;
    var vv = window.visualViewport;
    var apply = function () {
      var gap = Math.max(0, Math.round((window.innerHeight || 0) - vv.height - (vv.offsetTop || 0)));
      var open = gap > 80;
      document.documentElement.style.setProperty('--kbd', open ? gap + 'px' : '0px');
      if (document.body) document.body.classList.toggle('kb-open', open);
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
  }

  /* ---------- 화면 그리기 ---------- */
  function mountView(tabId) {
    var main = el('main');
    if (!main || !store || !store.state.ready) return;
    var view = viewOf(tabId);
    painting = true;
    currentTab = tabId;
    var enter = tabId !== lastMountedTab;
    lastMountedTab = tabId;
    main.innerHTML = '<div class="view' + (enter ? ' is-enter' : '') + '" data-view="' + tabId + '">' + view.render(store.state) + '</div>';
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
    if (!state.ready || gated) { paintNetBar(state); return; }
    paintChrome(state);
    paintNetBar(state);
    paintDm(state);
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
    /* 같은 화면을 다시 그릴 때는 보던 위치를 지킵니다.
     * (MY처럼 긴 화면에서 꾸미기·테마를 누를 때마다 맨 위로 튀던 문제) */
    var main = el('main');
    var y = (typeof window !== 'undefined' && window.scrollY) || 0;
    var mt = main ? main.scrollTop : 0;
    mountView(currentTab || (store && store.state.ui.tab) || 'log');
    if (main) main.scrollTop = mt;
    if (y && typeof window !== 'undefined') window.scrollTo(0, y);
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

  /* ---------- 계정 삭제(탈퇴) ----------
   * 1) 시트(서버)에 있는 내 기록 삭제 (브리지 deleteAccount, 본인 토큰 필요)
   * 2) 이 기기에 남은 세션·캐시·프로필·계정 기록 삭제
   * 3) 시작화면으로 돌아갑니다.
   * 서버 삭제가 실패하면 이 기기 데이터도 지우지 않습니다(반쪽 탈퇴 방지).
   */
  var ACCOUNT_LOCAL_KEYS = ['bm_queue_v1', 'bm_cache_v1', 'bm_mode_v1', 'bm_dedupe_v1', 'bm_seen_v1'];

  function wipeAccountLocal(sess) {
    if (!sess) return;
    U.storage.removeItem(BM.auth.rowsKeyFor(sess));
    ACCOUNT_LOCAL_KEYS.forEach(function (k) { U.storage.removeItem(k); });
    var profiles = U.readJSON(BM.auth.PROFILE_KEY, {}) || {};
    var idKey = BM.auth.identityKey(sess);
    if (profiles[idKey]) {
      delete profiles[idKey];
      U.writeJSON(BM.auth.PROFILE_KEY, profiles);
    }
    if (sess.kind === 'email' && sess.email) {
      var accounts = U.readJSON(BM.auth.ACCOUNTS_KEY, {}) || {};
      var email = String(sess.email).toLowerCase();
      if (accounts[email]) {
        delete accounts[email];
        U.writeJSON(BM.auth.ACCOUNTS_KEY, accounts);
      }
    }
  }

  function deleteAccount() {
    var sess = BM.auth.session();
    if (!sess) return Promise.resolve({ ok: false, message: '로그인 정보가 없어요.' });
    if (!store) return Promise.resolve({ ok: false, message: '잠시 뒤 다시 시도해 주세요.' });
    return store.actions.deleteAccount().then(function (res) {
      if (!res || res.ok === false) {
        var msg = (res && res.message) || '탈퇴를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
        if (res && res.code === 'unauthorized') msg = '로그인 세션이 만료됐어요. 다시 로그인한 뒤 탈퇴해 주세요.';
        return { ok: false, message: msg };
      }
      wipeAccountLocal(sess);
      var guest = sess.kind === 'guest';
      signOut();
      UI.toast(guest ? '이 기기에 저장된 기록을 모두 지웠어요' : '탈퇴가 완료됐어요. 그동안 함께해서 즐거웠어요!');
      return { ok: true, removed: (res && res.removed) || 0 };
    }).catch(function (err) {
      return { ok: false, message: (err && err.message) || '탈퇴를 처리하지 못했어요.' };
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
    if (!on) {
      var dm = el('dm');
      if (dm) { dm.hidden = true; dm.innerHTML = ''; }
      document.body.classList.remove('no-scroll');
    }
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
        email: session.email || '',
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
      deleteAccount: deleteAccount,
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
      paintDm(store.state);
      var s = BM.auth.session();
      if (BM.auth.needsOnboarding(s, store.state.me)) {
        showOnboarding(s);
        return;
      }
      mountView(store.state.ui.tab);
      paintNetBar(store.state);
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
    var dm = el('dm');
    if (dm) { dm.hidden = true; dm.innerHTML = ''; }
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
      title: (guest ? '체험 모드로 시작해요' : '준비가 끝났어요') + ' 🏸',
      body: '<p class="sheet__text">' + (guest
          ? '이 기기에만 저장돼요. 일지를 저장하면 <b>AI가 드릴과 이번 주 루틴</b>을 만들어 줘요.'
          : '<b>' + U.esc((sess && sess.name) || '회원') + '</b>님, 오늘 일지부터 남겨 보세요.') + '</p>' +
        '<button class="btn btn--primary btn--big mt16" data-close>일지 쓰러 가기</button>'
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

  /* ---------- 서비스워커 ----------
   * 새 버전이 활성화되면 한 번만 새로고침합니다(무한 반복 방지).
   * 입력 중에는 새로고침하지 않고, 다음에 앱을 열 때 새 화면을 보여 줍니다. */
  var swReloaded = false;
  function reloadForNewVersion() {
    if (swReloaded) return;
    var active = document.activeElement;
    if (active && active.tagName && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    var last = 0;
    try { last = Number(sessionStorage.getItem('bm_sw_reloaded_at') || 0); } catch (e) { last = 0; }
    if (Date.now() - last < 10000) return;      /* 10초 안에 이미 새로고침했으면 그대로 둔다 */
    swReloaded = true;
    try { sessionStorage.setItem('bm_sw_reloaded_at', String(Date.now())); } catch (e) { /* 무시 */ }
    location.reload();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* 첫 설치 때는 제어자가 없었다가 생기는 것뿐이므로 새로고침하지 않습니다 */
      if (!hadController) { hadController = true; return; }
      reloadForNewVersion();
    });
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function activate(worker) {
        if (!worker) return;
        try { worker.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { /* 무시 */ }
      }
      /* 이미 대기 중인 새 버전이 있으면 바로 넘깁니다 */
      if (reg.waiting && navigator.serviceWorker.controller) activate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', function () {
          if (next.state === 'installed' && navigator.serviceWorker.controller) activate(next);
        });
      });
      /* 앱으로 돌아올 때마다 새 버전을 확인합니다 */
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        try { reg.update(); } catch (e) { /* 무시 */ }
      });
    }).catch(function () { /* 오프라인 캐시는 없어도 동작 */ });
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

    /* 상단 오른쪽 채팅(DM) 아이콘 */
    var chatBtn = el('hdrChat');
    if (chatBtn) chatBtn.addEventListener('click', function () {
      if (!store || gated) return;
      UI.haptic(6);
      if (store.state.ui.chatOpen) store.actions.closeChats();
      else store.actions.openChats();
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
    bindNetBar();
    bindKeyboardScroll();
    var sess = BM.auth.session();
    if (sess) enterApp(sess);
    else showGate();
    registerSW();
  }

  BM.app = { boot: boot, repaint: repaint, TABS: TABS, ctx: ctx, onRewardAdResult: onRewardAdResult, pendingRewardAd: null, signOut: signOut, version: 'v1.9.4' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
