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

  /* 스플래시 — 새 로고 타일을 너무 빨리 걷어내면 화면이 깜빡이므로,
     ①준비가 끝나도 최소 SPLASH_MIN_MS는 보이게 두고
     ②끝난 뒤에는 CSS 페이드(340ms)로 부드럽게 사라집니다. */
  var SPLASH_MIN_MS = 420;
  var splashShownAt = Date.now();
  var splashOff = false;

  function el(id) { return document.getElementById(id); }

  /* 테마별 크롬 색 — CSS의 --bg 값과 같게 유지합니다 */
  var THEME_CHROME = { th_def: '#f6f8f6', th_night: '#080b0a', th_court: '#06170f', th_sakura: '#fff8fa' };

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
    /* 안드로이드 크롬 주소창·작업 전환기 색도 테마를 따라갑니다.
       (예전에는 항상 #080b0a라 밝은 테마에서 검정 띠가 남았습니다) */
    var themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta && THEME_CHROME[theme] && themeMeta.getAttribute('content') !== THEME_CHROME[theme]) {
      themeMeta.setAttribute('content', THEME_CHROME[theme]);
    }
    /* 상단 오른쪽 채팅 아이콘: 안 읽은 메시지 + 친구 요청 배지 */
    var chatBtn = el('hdrChat');
    if (chatBtn) {
      var chatBadge = el('hdrChatBadge');
      var meNow = state.me && state.me.key;
      var pendingMatch = (state.data.requests || []).filter(function (r) {
        return r.target === meNow && r.status === '대기';
      }).length;
      var total = (state.data.unread || 0) + ((state.data.friendRequests || []).length) + pendingMatch;
      if (chatBadge) {
        chatBadge.textContent = total > 9 ? '9+' : String(total);
        chatBadge.hidden = !total;
      }
      chatBtn.classList.toggle('has-unread', !!total);
      var chatOpen = !!(state.ui && state.ui.chatOpen);
      chatBtn.classList.toggle('is-open', chatOpen);
      chatBtn.setAttribute('aria-expanded', chatOpen ? 'true' : 'false');
      chatBtn.title = chatOpen ? '채팅 닫기' : '채팅 열기' + (total ? ' · 새 소식 ' + total + '건' : '');
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

  /* ---------- 안드로이드 뒤로 가기 ----------
   * 채팅(DM)을 열면 겹침 기록을 하나 잡아 두고, 뒤로 가기를 누르면 앱을 닫지 않고
   * 채팅만 닫습니다(설치형 앱과 같은 동작). 시트도 같은 기록을 함께 씁니다. */
  var dmHist = false;
  function dmPushHistory() {
    if (dmHist) return;
    dmHist = true;
    UI.overlay.open();
  }
  function dmPopHistory() {
    if (!dmHist) return;
    dmHist = false;
    UI.overlay.close();
  }

  /* ---------- 1:1 채팅(DM) 패널 ---------- */
  function paintDm(state) {
    var host = el('dm');
    if (!host) return;
    var open = !!(state.ui && state.ui.chatOpen && state.ready && !gated);
    if (!open) {
      dmPopHistory();
      if (!host.hidden) {
        host.hidden = true;
        host.innerHTML = '';
        host.__dmHtml = '';
        host.dataset.sig = '';
        document.body.classList.remove('no-scroll');
      }
      return;
    }
    var active = document.activeElement;
    var keep = null;
    /* 입력 중인 글은 다시 그려도 그대로 남깁니다(새 소식 폴링으로 화면이 갱신될 때) */
    var liveInput = host.querySelector('[data-dm-input]');
    if (liveInput && (liveInput.value || (active && active === liveInput))) {
      keep = {
        value: liveInput.value,
        pos: liveInput.selectionStart,
        focused: !!(active && active === liveInput)
      };
    }
    host.hidden = false;
    dmPushHistory();
    BM.views.chat.bind(host, ctx);
    BM.views.chat.render(host, state);
    host.dataset.sig = state.ui.chatRoom ? 'room:' + state.ui.chatRoom : 'list';
    if (keep) {
      var inp = host.querySelector('[data-dm-input]');
      if (inp) {
        inp.value = keep.value;
        if (keep.focused) {
          inp.focus();
          try { inp.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* noop */ }
        }
      }
    }
    document.body.classList.add('no-scroll');
  }

  /* ---------- v1.20: 새 메시지·요청 알림 ----------
   * 순서: 앱 안 배너(보고 있을 때) → 브라우저 알림(다른 탭·백그라운드)
   *       → 짧은 진동 · 작은 띵음. 모두 MY > 알림·편지지의 '새 메시지 알림'을 따릅니다.
   * 알림은 '직전 확인 이후 새로 들어온 것'만 씁니다(처음 열 때 지난 메시지는 제외). */
  var notifyTimer = null;
  var lastNotifiedAt = '';
  var notifyClosedSig = '';   /* 배너를 닫은 소식 — 같은 소식으로 다시 띄우지 않습니다 */

  function notifEnabled() {
    return !!(store && store.state.prefs && store.state.prefs.notify !== false);
  }

  function notifItemOf(state) {
    var inbox = (state && state.inbox) || {};
    var all = [].concat(inbox.messages || [], inbox.requests || [], inbox.friendRequests || []);
    if (!all.length) return null;
    return all.slice().sort(function (a, b) { return String(a.at || '') < String(b.at || '') ? -1 : 1; })[all.length - 1];
  }

  function notifText(item) {
    if (!item) return '';
    if (item.kind === 'message') return (item.nick || '회원') + '님에게서 새 메시지가 왔어요';
    if (item.kind === 'match') return (item.nick || '회원') + '님이 1:1 매칭을 요청했어요';
    if (item.kind === 'guest') return (item.nick || '회원') + '님이 게스트 참여를 신청했어요';
    return (item.nick || '회원') + '님이 친구 요청을 보냈어요';
  }

  function hideNotify() {
    var bar = el('notifbar');
    if (!bar || bar.hidden) return;
    if (bar.dataset.sig) notifyClosedSig = bar.dataset.sig;
    bar.hidden = true;
    bar.innerHTML = '';
    if (document.body) document.body.classList.remove('has-notif');
  }

  function paintNotify(state) {
    var bar = el('notifbar');
    if (!bar) return;
    var item = (state && state.ready && !gated && notifEnabled()) ? notifItemOf(state) : null;
    /* 지금 보고 있는 방의 메시지는 배너로 또 알리지 않습니다 */
    if (item && item.kind === 'message' && state.ui.chatOpen && String(state.ui.chatRoom) === String(item.roomId)) item = null;
    if (!item) { hideNotify(); return; }
    var sig = item.kind + '|' + (item.roomId || item.id) + '|' + item.at;
    if (sig === notifyClosedSig) { hideNotify(); return; }   /* 이미 닫은 소식 */
    if (bar.dataset.sig === sig && !bar.hidden) return;
    bar.dataset.sig = sig;
    var sub = item.kind === 'message'
      ? U.truncate(item.text || '', 40)
      : (item.kind === 'match' ? '눌러서 받은 요청 보기'
        : (item.kind === 'guest' ? '눌러서 신청 편지지 보기' : '눌러서 확인하기'));
    bar.className = 'notifbar notifbar--' + (item.kind === 'message' ? 'msg' : 'req');
    bar.innerHTML =
      '<button type="button" class="notifbar__body" data-notif-open>' +
      '<span class="notifbar__dot" aria-hidden="true"></span>' +
      '<span class="notifbar__text"><strong>' + U.esc(notifText(item)) + '</strong>' +
      (sub ? '<span>' + U.esc(sub) + '</span>' : '') + '</span></button>' +
      '<button type="button" class="iconbtn notifbar__x" data-notif-close aria-label="알림 닫기">' + UI.icon('close') + '</button>';
    bar.hidden = false;
    if (document.body) document.body.classList.add('has-notif');
    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(hideNotify, 8000);
  }

  function openNotifItem(item) {
    if (!item || !store) return;
    hideNotify();
    UI.haptic(8);
    if (item.kind === 'message') {
      store.actions.openChat(item.roomId, item.from || '');
      store.actions.markChatRead(item.roomId, item.from || '');
      return;
    }
    if (item.kind === 'match') {
      store.actions.closeChats();
      store.actions.setTab('matching');
      store.actions.setMatchTab('in');
      return;
    }
    store.actions.openChats();
  }

  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = new AC();
      var osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ac.destination);
      var t = ac.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.start(t);
      osc.stop(t + 0.18);
      setTimeout(function () { try { ac.close(); } catch (e) { /* 무시 */ } }, 500);
    } catch (e) { /* 무음·자동재생 차단 브라우저 */ }
  }

  function browserNotify(item) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
    var title = '배드민턴 · ' + notifText(item);
    var options = {
      body: item.kind === 'message' ? U.truncate(item.text || '', 90) : '앱을 열어 확인해 보세요.',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: 'bm-' + (item.roomId || item.id || 'news'),
      data: { roomId: item.roomId || '', kind: item.kind }
    };
    /* 안드로이드 크롬은 new Notification() 대신 서비스워커 알림만 됩니다 */
    try {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg && typeof reg.showNotification === 'function') return reg.showNotification(title, options);
        }).catch(function () { /* 권한·지원 문제는 조용히 넘어감 */ });
        return;
      }
    } catch (e) { /* 서비스워커 없이도 아래로 시도 */ }
    try {
      var n = new Notification(title, options);
      n.onclick = function () { try { window.focus(); } catch (e) { /* 무시 */ } openNotifItem(item); try { n.close(); } catch (e) { /* 무시 */ } };
    } catch (e) { /* 알림을 못 띄우는 브라우저 */ }
  }

  function onIncoming(state) {
    var inbox = (state && state.inbox) || null;
    if (!inbox || !inbox.total || !inbox.at || inbox.at === lastNotifiedAt) return;
    lastNotifiedAt = inbox.at;
    if (!notifEnabled()) return;
    var item = notifItemOf(state);
    if (!item) return;
    UI.haptic(35);
    beep();
    browserNotify(item);
  }

  function askNotifyPermission() {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    try {
      var p = Notification.requestPermission();
      if (p && typeof p.catch === 'function') p.catch(function () { /* 사용자가 닫음 */ });
    } catch (e) { /* 구형 브라우저 */ }
  }

  /* ---------- v1.20: 새 소식 폴링 · 활동 시각 ----------
   * 45초마다 새 메시지를 확인하고(탭이 숨겨져 있어도 알림을 위해 계속),
   * 1분마다 내 활동 시각을 갱신합니다(시트에는 3분에 한 번만 씁니다). */
  var pollTimer = null;
  var heartTimer = null;

  function startWatchers() {
    if (typeof setInterval !== 'function') return;
    if (!pollTimer) {
      pollTimer = setInterval(function () {
        if (!store || gated || !store.state.ready) return;
        store.actions.poll();
      }, 45000);
    }
    if (!heartTimer) {
      heartTimer = setInterval(function () {
        if (!store || gated || !store.state.ready) return;
        if (typeof document !== 'undefined' && document.hidden) return;   /* 숨은 탭은 활동으로 치지 않음 */
        store.actions.touchActivity();
      }, 60000);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState !== 'visible') return;
        if (!store || gated || !store.state.ready) return;
        store.actions.touchActivity();
        store.actions.poll();
      });
    }
  }

  /* ---------- 오프라인 · 동기화 안내 막대 ----------
   * 기기 저장 모드에서는 저장 자체가 기기에서 이루어지므로 아무 말도 하지 않고,
   * 시트(서버) 모드에서 보낼 것이 남았거나 연결이 끊겼을 때만 짧게 알려 줍니다.
   * (체험·게스트 모드에 '저장 중… N건 남음'이 뜨던 문제의 원인)
   * bm-v1.58.0 — 영구 실패로 막힌 저장은 원인을 한 줄로 보여 주고, 인증 만료는
   * '로그인 세션이 만료됐어요'로 바로 알 수 있게 했습니다. */
  function netBarText(state) {
    var needsNet = state.mode === 'sheets' || state.mode === 'supabase';
    if (!needsNet) return null;
    var queued = (state.queue && state.queue.length) || 0;
    var skipped = (state.syncBlocked && state.syncBlocked.length) || 0;
    var offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
    if (offline) {
      return { kind: 'off', text: '오프라인 상태예요 · 기록은 기기에 저장되고, 연결되면 자동으로 보내요.', retry: queued > 0 };
    }
    if (state.syncState === 'error' && queued) {
      if (state.syncErrorKind === 'auth') {
        return { kind: 'warn', text: '로그인 세션이 만료됐어요. MY에서 다시 로그인해 주세요.', retry: true };
      }
      var why = state.syncError ? String(state.syncError) : '';
      return {
        kind: 'warn',
        text: '저장 ' + queued + '건을 보내지 못했어요. ' + (why || '잠시 뒤 자동으로 다시 시도합니다.'),
        retry: true
      };
    }
    if (!queued && skipped && state.syncState !== 'syncing') {
      return {
        kind: 'warn',
        text: '저장 ' + skipped + '건은 서버가 받지 못해 건너뛰었어요 · MY › 데이터에서 확인',
        retry: true, blocked: true
      };
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
    var sig = info.kind + '|' + info.text + '|' + (info.retry ? 1 : 0) + '|' + (info.blocked ? 1 : 0);
    if (bar.dataset.sig === sig) return;
    bar.dataset.sig = sig;
    bar.className = 'netbar netbar--' + info.kind;
    bar.innerHTML = '<span class="netbar__t">' + U.esc(info.text) + '</span>' +
      (info.retry ? '<button type="button" class="netbar__btn" data-net-retry' +
        (info.blocked ? ' data-net-dead="1"' : '') + '>다시 시도</button>' : '');
    bar.hidden = false;
    if (document.body) document.body.classList.add('has-netbar');
  }

  function bindNetBar() {
    var bar = el('netbar');
    if (bar) {
      bar.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-net-retry]');
        if (!btn || !store) return;
        UI.haptic(6);
        if (btn.getAttribute('data-net-dead') === '1' && store.actions.retryBlocked) {
          UI.toast('건너뛴 저장을 다시 보내는 중이에요');
          store.actions.retryBlocked();
          return;
        }
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
    paintNotify(state);
    onIncoming(state);
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

  /* 저장하면서 '이번 주 약점 3회' 스탬프가 채워졌으면 저장 토스트에 한 조각 덧붙입니다.
   * (스탬프 계산은 domain.weekChallenge 순수 함수 — 화면은 다시 그려서 따라옵니다)
   * 첫 일지로 챌린지가 새로 열린 경우도 0 → 1로 채워진 것이라 같이 알려 줍니다. */
  function challengeToast(before, records) {
    var after = BM.domain.weekChallenge(records || [], {});
    if (!after.active) return '';
    var same = !!(before && before.active && before.weakness === after.weakness);
    var was = same ? before.count : 0;
    if (after.count <= was) return '';
    if (after.done && !(same && before.done)) return ' 🎉 이번 주 ' + after.weakness + ' ' + after.goal + '회 달성!';
    return ' · 이번 주 ' + after.weakness + ' ' + Math.min(after.count, after.goal) + '/' + after.goal;
  }

  /* ---------- 저장 버튼(연타 잠금 + 즉시 피드백) ---------- */
  function saveLogWithFeedback(btn) {
    if (!store) return;
    if (!btn) { store.actions.saveLog(); return; }
    if (btn.dataset.busy === '1') return;         /* 손가락 연타: 즉시 무시 */
    btn.dataset.busy = '1';
    btn.classList.add('is-busy');
    var label = btn.querySelector('span');
    var editing = !!(store.state.ui && store.state.ui.editLogId);
    if (label) label.textContent = editing ? '수정 중…' : '저장 중…';
    UI.haptic(12);

    var chBefore = BM.domain.weekChallenge(store.state.data.records || [], {});
    var res = store.actions.saveLog({ keepDraft: true });
    if (res.ok) {
      if (label) label.textContent = res.updated ? '수정됨 ✓' : '저장됨 ✓';
      UI.toast((res.updated ? '일지를 수정했어요. 같은 기록이 그대로 갱신됐어요.' : '일지를 저장했어요. AI 분석을 준비했어요.') +
        challengeToast(chBefore, store.state.data.records));
      setTimeout(function () {
        /* 수정 저장이 끝났으면 입력칸을 새 일지로 돌리고(수정 모드 해제) */
        if (res.updated) { repaint(); return; }
        btn.dataset.busy = '0';
        btn.classList.remove('is-busy');
        if (label) label.textContent = '저장하고 AI 분석';
      }, res.updated ? 520 : 1100);
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

  /* ---------- 저장소 고르기 (v1.24) ----------
   * 기본은 Supabase 실시간 서버(서울). MY > 데이터 연결에서 구글 시트로 바꿀 수 있고,
   * 로그인 없이 둘러보기(guest)는 지금처럼 이 기기에만 저장합니다. */
  function makeApi(session) {
    var signed = !!(session && session.kind !== 'guest');
    var backend = BM.api.backendFor(session);
    if (backend === 'sheets' && signed) {
      var saved = BM.api.savedSession() || {};
      return BM.api.createSheets({ url: saved.url, token: saved.token });
    }
    var prof = (session && session.profile) || {};
    if (backend === 'supabase' && signed) {
      return BM.api.createSupabase({
        meKey: BM.auth.meKeyFor(session),
        /* 로그인 세션(access_token)을 실어 보내 본인 행 수정·삭제가 진짜 PATCH/DELETE로 통과하게 합니다 */
        token: BM.auth.accessToken,
        me: {
          email: session.email || '',
          nick: session.name || prof.nick || '',
          level: prof.level || '',
          discipline: prof.discipline || '',
          region: prof.region || '',
          club: prof.club || ''
        }
      });
    }
    var ident = signed ? {
      email: session.email || '',
      nick: session.name || prof.nick || '',
      level: prof.level || '',
      discipline: prof.discipline || '',
      region: prof.region || '',
      club: prof.club || ''
    } : null;
    return BM.api.createLocal({ latency: 120, rowsKey: BM.auth.rowsKeyFor(session), meKey: BM.auth.meKeyFor(session), me: ident });
  }

  /* MY > 데이터 연결: 서버(Supabase) ↔ 구글 시트 전환 */
  function switchBackend(kind) {
    if (!store) return Promise.resolve({ ok: false, message: '앱을 먼저 열어 주세요.' });
    var session = BM.auth.session();
    if (!session || session.kind === 'guest') {
      return Promise.resolve({ ok: false, needLogin: true, message: '로그인하면 실시간 서버에 연결돼요.' });
    }
    if (kind === 'sheets') {
      var saved = BM.api.savedSession();
      if (!saved || !saved.token || !saved.url) return Promise.resolve({ ok: false, needConnect: true, message: 'sheet' });
    }
    U.writeJSON(BM.api.BACKEND_KEY, kind === 'sheets' ? 'sheets' : 'supabase');
    var api = makeApi(session);
    store._replaceApi(api);
    U.writeJSON('bm_mode_v1', api.mode);
    return store.actions.reload().then(function () {
      if (api.mode === 'supabase') store.actions.listen();
      paintNetBar(store.state);
      return { ok: true, mode: api.mode };
    }).catch(function (err) {
      return { ok: false, mode: api.mode, message: (err && err.message) || '저장소를 바꾸지 못했어요.' };
    });
  }

  /* ---------- 실제 시트 연결 ---------- */
  function connectSheets(url, email, password, nick) {
    var api = BM.api.createSheets({ url: url });
    return api.login({ email: email, password: password, nick: nick, create: true }).then(function (res) {
      BM.auth.saveBridgeUrl(url);
      if (BM.auth.session()) BM.auth.signInEmailAccount({ email: email, name: (res.me && res.me.nick) || nick, token: res.token, source: 'sheets' });
      store._replaceApi(api);
      U.writeJSON('bm_mode_v1', 'sheets');
      U.writeJSON(BM.api.BACKEND_KEY, 'sheets');
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
  var ACCOUNT_LOCAL_KEYS = ['bm_queue_v1', 'bm_queue_dead_v1', 'bm_cache_v1', 'bm_mode_v1', 'bm_dedupe_v1', 'bm_seen_v1'];

  function wipeAccountLocal(sess) {
    if (!sess) return;
    U.storage.removeItem(BM.auth.rowsKeyFor(sess));
    ACCOUNT_LOCAL_KEYS.forEach(function (k) { U.storage.removeItem(k); });
    /* 초보자 4주 루틴 체크·표시 선택도 이 계정 것만 지웁니다 */
    if (BM.routine && BM.auth.meKeyFor) {
      U.storage.removeItem(BM.routine.keyFor(BM.auth.meKeyFor(sess)));
      U.storage.removeItem(BM.routine.prefKeyFor(BM.auth.meKeyFor(sess)));
    }
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
      var serverGone = !!(res && res.authDeleted);
      signOut();
      UI.toast(guest ? '이 기기에 저장된 기록을 모두 지웠어요' : '탈퇴가 완료됐어요. 그동안 함께해서 즐거웠어요!');
      return { ok: true, removed: (res && res.removed) || 0, authDeleted: serverGone };
    }).catch(function (err) {
      return { ok: false, message: (err && err.message) || '탈퇴를 처리하지 못했어요.' };
    });
  }

  /* ---------- 시작화면(게이트) ---------- */
  function hideSplash() {
    var sp = el('splash');
    if (!sp || splashOff) return;      /* showGate → enterApp처럼 두 번 불러도 한 번만 */
    splashOff = true;
    var left = SPLASH_MIN_MS - (Date.now() - splashShownAt);
    if (left > 0) {
      setTimeout(function () { sp.classList.add('is-off'); }, left);
    } else {
      sp.classList.add('is-off');
    }
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
    dmHist = false;
    /* 남아 있는 겹침 화면 기록을 정리합니다(탈퇴·로그아웃 뒤 뒤로 가기로 앱을 나가지 않게) */
    if (UI.overlay && UI.overlay.reset) UI.overlay.reset();
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
      /* v1.56 — 지금 적용된 테마(me.theme.theme)를 넘겨 시작 화면의 '앱 분위기'에 미리 골라 둡니다 */
      theme: (store.state.me && store.state.me.theme && store.state.me.theme.theme) || 'th_night',
      onComplete: function (patch) {
        store.actions.saveProfile({
          nick: patch.nick, level: patch.level, discipline: patch.discipline,
          gender: patch.gender || '비공개',
          region: patch.region || '', club: patch.club || '',
          role: patch.role || ''
        });
        /* v1.56 — 시작에서 고른 앱 분위기(테마)를 저장소에 바로 반영합니다.
         *  MY › 테마와 같은 저장이라 하단 탭·모든 화면이 즉시 그 테마로 바뀝니다.
         *  bm-v1.57.0 — 테마는 모두 무료라 하트 확인 없이 그대로 적용됩니다. */
        var wantTheme = patch.theme || '';
        var nowTheme = (store.state.me && store.state.me.theme && store.state.me.theme.theme) || 'th_night';
        if (wantTheme && wantTheme !== nowTheme) store.actions.setTheme(wantTheme);
        /* v1.40 — 고른 유형에 맞춰 일지 첫머리를 준비합니다:
         *  초보는 4주 루틴을 켜고, 선수는 7대 훈련 기록을 기본으로 보여 줍니다. */
        var roleDef = BM.domain.roleById(patch.role);
        if (roleDef) {
          store.actions.setRoutinePref(roleDef.routine ? true : false);
          store.actions.setProPref(roleDef.pro ? true : null);
        }
        store.actions.saveMatchProfile({
          region: patch.region || '', level: patch.level, discipline: patch.discipline,
          club: patch.club || '', availability: '', experience: '', bio: '', avatar: '🏸',
          gender: patch.gender || '비공개'
        });
        BM.auth.markOnboarded(patch);
        /* v1.26 — 온보딩 값(급수·종목·지역)을 내 계정 행에도 반영 */
        if (BM.auth.hasSupabaseAuth()) BM.auth.ensureAccount({ nick: patch.nick, level: patch.level, discipline: patch.discipline, region: patch.region, club: patch.club });
        document.body.classList.remove('is-onboarding');
        setNav(true);
        store.actions.setTab('log');
        gated = false;
        paintChrome(store.state);
        mountView('log');
        try { history.replaceState(null, '', '#/log'); } catch (e) { /* 무시 */ }
        U.writeJSON('bm_seen_v1', true);
        UI.haptic(16);
        UI.toast(patch.nick + '님, 준비됐어요! ' + (roleDef
          ? (roleDef.id === 'beginner' ? '4주 루틴부터 같이 시작해요.'
            : roleDef.id === 'player' ? '7대 훈련으로 오늘을 남겨 보세요.'
              : roleDef.id === 'coach' ? '코치 탭에서 선수 피드백을 볼 수 있어요.'
                : '오늘 일지를 남겨 보세요.')
          : '오늘 일지를 남겨 보세요.'));
      }
    });
  }

  /* ---------- 앱 진입 ---------- */
  function enterApp(session) {
    gated = false;
    dmHist = false;          /* 새 저장소·계정에서는 겹침 기록을 새로 잡습니다 */
    document.body.classList.remove('is-gate');
    document.body.classList.remove('is-onboarding');
    setNav(true);
    hideSplash();
    /* 시작화면/온보딩 리스너를 떼어 냅니다(본문 클릭과 겹치지 않게) */
    if (BM.views.start && BM.views.start.unmount) BM.views.start.unmount();

    var api = makeApi(session);
    store = BM.store.createStore({ api: api });
    ctx = {
      store: store,
      actions: store.actions,
      saveLog: saveLogWithFeedback,
      connectSheets: connectSheets,
      switchBackend: switchBackend,
      deleteAccount: deleteAccount,
      repaint: repaint,
      refresh: repaint,
      signOut: signOut,
      auth: BM.auth,
      push: BM.push || null
    };
    BM.app.ctx = ctx;
    store.subscribe(onChange);

    var startTab = (location.hash || '').replace('#/', '') || 'log';
    if (!TABS.some(function (t) { return t.id === startTab; })) startTab = 'log';
    store.state.ui.tab = startTab;

    store.actions.init().then(function () {
      if (!store) return;
      /* bm-v1.59.0 — 구글 로그인 때 받은 토큰이 앱보다 늦게 도착한 경우,
       * 401로 대기열에 남은 첫 저장을 한 번 더 보냅니다(js/auth.js takeSyncRetry). */
      if (BM.auth.takeSyncRetry && BM.auth.takeSyncRetry() && store.state.queue && store.state.queue.length) {
        store.actions.retrySync();
      }
      paintChrome(store.state);
      paintDm(store.state);
      /* v1.24 — 실시간 서버면 시작하자마자 구독합니다(온보딩 중에도 쌓임) */
      if (store.state.mode === 'supabase') store.actions.listen();
      var s = BM.auth.session();
      if (BM.auth.needsOnboarding(s, store.state.me)) {
        showOnboarding(s);
        return;
      }
      mountView(store.state.ui.tab);
      paintNetBar(store.state);
      startWatchers();
      resumePush();
      if (store.state.syncError) UI.toast(store.state.syncError, 'error');
      if (!U.readJSON('bm_seen_v1', false)) welcome();
    });
  }

  /* ---------- 계정 전환 ---------- */
  function signOut() {
    var sess = BM.auth.session();
    if (store) store.actions.stopListening();
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

  /* 보상형 광고 결과 훅 (모바일 앱 WebView)
   *  window.BM.app.onRewardAdResult(ok, adUnit, txId)
   *  · 거래 ID(txId)를 그대로 js/ads.js 로 넘깁니다 — 같은 시청 건이 두 번 적립되지 않게.
   *    (BM.ads.onRewardAdResult 가 기다리는 재생에 결과를 넘기거나 바로 지급합니다) */
  function onRewardAdResult(rewarded, adUnit, txId) {
    if (BM.ads && typeof BM.ads.onRewardAdResult === 'function') {
      return BM.ads.onRewardAdResult(rewarded, adUnit, txId);
    }
    var resolve = BM.app && BM.app.pendingRewardAd;
    if (BM.app) BM.app.pendingRewardAd = null;
    if (typeof resolve === 'function') {
      resolve({ rewarded: !!rewarded, adUnit: adUnit || 'heart_reward', txId: txId || '' });
    } else if (rewarded && store) {
      store.actions.watchAd({ verified: true, adUnit: adUnit, txId: txId || '' });
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
        store.actions.touchActivity();
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
      /* 알림을 켜 둔 사람이 채팅을 처음 열 때 브라우저 알림 권한을 자연스럽게 물어봅니다 */
      if (notifEnabled()) askNotifyPermission();
      if (store.state.ui.chatOpen) store.actions.closeChats();
      else store.actions.openChats();
    });

    /* 새 소식 배너 — 누르면 해당 방·받은 요청으로, X를 누르면 닫습니다 */
    var notif = el('notifbar');
    if (notif) notif.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-notif-close]')) { ev.preventDefault(); hideNotify(); return; }
      if (ev.target.closest('[data-notif-open]')) {
        ev.preventDefault();
        if (store) openNotifItem(notifItemOf(store.state));
      }
    });

    /* 안드로이드 뒤로 가기: 시트를 닫은 back이면 채팅은 그대로 두고,
     * 채팅이 열려 있으면 채팅만 닫습니다 */
    window.addEventListener('popstate', function () {
      if (UI.backClosedSheet && UI.backClosedSheet()) return;
      if (store && store.state.ui.chatOpen) {
        /* dmHist 는 paintDm 의 dmPopHistory 가 정리합니다(겹침 기록 깊이도 함께) */
        store.actions.closeChats();
      }
    });

    window.addEventListener('hashchange', function () {
      if (!store || gated) return;
      var id = (location.hash || '').replace('#/', '');
      if (TABS.some(function (t) { return t.id === id; })) store.actions.setTab(id);
    });
  }

  /* ---------- 체육관 이름 → 지도 (어느 화면에서든) ----------
   * 프로필·모집글의 체육관 이름을 누르면 지도 화면이 그 체육관을 가운데 두고 열립니다.
   * 캡처 단계에서 먼저 받아, 글 카드가 통째로 누르는 시트(프로필·편지)가 같이 열리지 않게 합니다. */
  function bindGymLinks() {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', function (ev) {
      var node = ev.target && ev.target.closest ? ev.target.closest('[data-gym-open]') : null;
      if (!node) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (!BM.app.ctx || !BM.views || !BM.views.gyms) return;
      UI.haptic(6);
      BM.views.gyms.openVenue(BM.app.ctx, node.getAttribute('data-gym-open'));
    }, true);
  }

  /* ---------- 실시간 푸시 알림 (bm-v1.57.0) ----------
   * 서비스워커(sw.js)가 푸시를 받아 알림을 띄우고, 알림을 누르면:
   *   · 앱 창이 이미 열려 있으면 postMessage로 그 화면으로 이동
   *   · 아니면 openWindow('./#/matching') 처럼 해시를 붙여 새로 엽니다(startTab이 그 탭으로).
   * Firebase 키가 연결돼 있고 스위치를 켜 둔 사람은 앱을 열 때마다 조용히 다시 구독합니다. */
  function bindPushRoute() {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    if (typeof navigator.serviceWorker.addEventListener !== 'function') return;
    navigator.serviceWorker.addEventListener('message', function (ev) {
      var data = ev.data || {};
      if (!data || data.type !== 'BM_PUSH_OPEN') return;
      if (BM.push && BM.push.go) BM.push.go(data.url, BM.app.ctx);
    });
  }

  function resumePush() {
    if (!store || !BM.push || !BM.push.autoEnable) return;
    var prefs = store.state.prefs || {};
    if (prefs.push !== true) return;
    BM.push.autoEnable(prefs).catch(function () { /* 키가 없거나 지원 안 하면 조용히 */ });
  }

  /* ---------- 시작 ---------- */
  function boot() {
    bindChrome();
    bindNetBar();
    bindKeyboardScroll();
    bindGymLinks();
    bindPushRoute();
    /* 비밀번호 재설정 메일 링크로 돌아온 경우(#access_token=…&type=recovery):
       세션을 먼저 받아 두고 시작화면에서 새 비밀번호를 정하게 합니다. */
    var ready = BM.auth.bootstrapRecovery ? BM.auth.bootstrapRecovery() : Promise.resolve(null);
    Promise.resolve(ready).catch(function () { return null; }).then(function (rec) {
      var sess = BM.auth.session();
      if (sess) enterApp(sess);
      else showGate();
      if (rec && rec.recovery) {
        UI.toast('새 비밀번호를 정해 주세요');
        if (BM.views.start && BM.views.start.openRecovery) BM.views.start.openRecovery();
      }
    });
    registerSW();
  }

  BM.app = { boot: boot, repaint: repaint, TABS: TABS, ctx: ctx, onRewardAdResult: onRewardAdResult, pendingRewardAd: null, signOut: signOut, netBarText: netBarText, version: 'v1.68.0' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
