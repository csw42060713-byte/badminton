/* ============================================================
 * views/my.js — MY (프로필·통계·하트·꾸미기·연결 설정)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var AVATARS = ['🏸', '🦋', '🐻', '🦊', '🐧', '🐰', '🦉', '🐯', '🐨', '🔥', '🌟', '🥇'];

  function themeSwatches(state) {
    var current = (state.me && state.me.theme && state.me.theme.theme) || 'th_def';
    return '<div class="themes">' + D.THEMES.map(function (t) {
      return '<button class="theme swatch--' + t.id + (current === t.id ? ' is-on' : '') + '" data-theme="' + t.id + '">' +
        '<span class="theme__dot"></span><span class="theme__name">' + U.esc(t.name) + '</span>' +
        '<span class="theme__hint">' + U.esc(t.hint) + '</span></button>';
    }).join('') + '</div>';
  }

  function adLabel(hearts) {
    if (!hearts.adRemaining) return '오늘 모두 받았어요';
    if (hearts.nextAdInSec > 0) return '+' + hearts.adReward + ' · ' + hearts.nextAdInSec + '초 후';
    return '+' + hearts.adReward + ' · 남은 ' + hearts.adRemaining + '회';
  }

  function heartCard(hearts) {
    var adPct = hearts.adLimit ? Math.round((hearts.adUsedToday / hearts.adLimit) * 100) : 0;
    var adDisabled = !hearts.canWatchAd ? ' disabled' : '';
    var checkDisabled = !hearts.canCheckIn ? ' disabled' : '';
    var recent = (hearts.history || []).slice(0, 6);
    return '<section class="card card--heart" data-region="heart">' +
      '<header class="card__head"><h2>' + UI.icon('heart') + '하트</h2>' +
      '<span class="heartchip">' + hearts.balance + '</span></header>' +

      '<div class="heartstats">' +
      '<div><strong class="up">+' + (hearts.todayEarned || 0) + '</strong><span>오늘 얻음</span></div>' +
      '<div><strong>' + hearts.balance + '</strong><span>잔액</span></div>' +
      '<div><strong>' + hearts.adUsedToday + '/' + hearts.adLimit + '</strong><span>오늘 광고</span></div>' +
      '</div>' +

      '<div class="heartacts">' +
      '<button class="btn btn--ghost grow heartact" data-act="checkin"' + checkDisabled + '>' +
      '<span class="heartact__t">' + UI.icon('check') + '출석 체크</span>' +
      '<span class="heartact__s">' + (hearts.checkedInToday ? '오늘 완료' : '+' + hearts.checkinReward + ' · 하루 1회') + '</span></button>' +
      '<button class="btn btn--primary grow heartact" data-act="ad" data-ad-btn' + adDisabled + '>' +
      '<span class="heartact__t">' + UI.icon('spark') + '광고 보고 받기</span>' +
      '<span class="heartact__s" data-ad-sub>' + U.esc(adLabel(hearts)) + '</span></button>' +
      '</div>' +
      '<div class="adbar" aria-hidden="true"><i style="width:' + adPct + '%"></i></div>' +

      (recent.length ? '<ul class="ledger">' + recent.map(ledgerRow).join('') + '</ul>'
        : '<p class="hint">아직 하트 내역이 없어요. 출석 체크로 시작해 보세요.</p>') +
      (hearts.history && hearts.history.length > 6
        ? '<button class="linkbtn" data-act="history">전체 내역 ' + hearts.history.length + '건 보기</button>' : '') +
      '<p class="hint">출석 하루 1회 · 광고 하루 ' + hearts.adLimit + '회(' + hearts.adCooldownSec + '초 간격) · ' +
      '매칭 ' + hearts.matchCost + ' · 유료 테마 ' + D.HEART_RULES.THEME_PRICES.th_court + ' · 선물 ' + hearts.giftCost + '</p>' +
      '</section>';
  }

  /* ---------- 계정 카드 (로그인 상태 · 로그아웃 · Google Client ID) ---------- */
  function isGuest() {
    var s = BM.auth && BM.auth.session ? BM.auth.session() : null;
    return !s || s.kind === 'guest';
  }

  function accountCard(state) {
    var auth = BM.auth;
    var s = auth.session();
    var kind = s ? s.kind : 'guest';
    var cid = auth.googleClientId();
    var name = (s && s.name) || (state.me && state.me.nick) || '회원';
    var email = (s && s.email) || '';
    var bridge = auth.bridgeUrl();
    var origin = (typeof location !== 'undefined' && location.origin) || '';
    var pic = s && s.picture
      ? '<img class="acc__pic" src="' + U.esc(s.picture) + '" alt="">'
      : '<span class="acc__pic acc__pic--emoji">' + (kind === 'google' ? 'G' : kind === 'email' ? '✉' : '🏸') + '</span>';
    var hint = kind === 'guest'
      ? '체험 모드 기록은 이 기기에만 저장돼요. 로그인하면 계정별로 따로 보관됩니다.'
      : kind === 'google'
        ? (s.demo ? '데모 Google 계정으로 미리보는 중이에요. 실제 계정은 Client ID를 넣으면 연결됩니다.' : 'Google 계정과 연결되어 있어요.')
        : (bridge ? '구글 시트 브리지 계정으로 로그인했어요.' : '이 기기에 저장된 체험 계정이에요.');
    return '' +
      '<section class="card" data-region="account">' +
      '<header class="card__head"><h2>계정</h2>' +
      '<span class="pill ' + (kind === 'guest' ? 'pill--ghost' : 'pill--ok') + '">' + U.esc(auth.kindLabel(s)) + '</span></header>' +
      '<div class="acc">' + pic +
      '<div class="acc__id"><strong>' + U.esc(name) + '</strong>' +
      '<span>' + U.esc(email || (kind === 'guest' ? '로그인 없이 둘러보는 중' : '')) + '</span></div>' +
      (kind === 'guest'
        ? '<button type="button" class="btn btn--ghost btn--sm" data-act="account-login">로그인</button>'
        : '<button type="button" class="btn btn--ghost btn--sm" data-act="logout">로그아웃</button>') +
      '</div>' +
      '<p class="hint">' + hint + '</p>' +
      '<details class="adv">' +
      '<summary>고급 · Google Client ID</summary>' +
      '<div class="adv__body">' +
      '<p class="hint">Google Cloud Console → OAuth 클라이언트 ID(웹 애플리케이션). 승인된 자바스크립트 원본에 ' +
      U.esc(origin || '이 사이트 주소') + '를 추가하세요.</p>' +
      '<input class="adv__input" type="text" data-cid spellcheck="false" autocomplete="off" placeholder="0000-xxxx.apps.googleusercontent.com" value="' + U.esc(cid) + '">' +
      '<div class="row gap8 mt8"><button type="button" class="btn btn--primary grow btn--sm" data-act="save-client-id">저장</button>' +
      (cid ? '<button type="button" class="btn btn--ghost btn--sm" data-act="clear-client-id">지우기</button>' : '') +
      '</div></div></details>' +
      '</section>';
  }

  function ledgerRow(h) {
    var iconName = h.delta > 0 ? 'plus' : 'arrow';
    var note = h.note ? ' · ' + h.note : '';
    return '<li><span class="ledger__k ledger__k--' + U.esc(h.kind) + '">' + UI.icon(iconName) + '</span>' +
      '<span class="ledger__l">' + U.esc(h.label + note) + '</span>' +
      '<span class="' + (h.delta > 0 ? 'up' : 'down') + '">' + (h.delta > 0 ? '+' : '') + h.delta + '</span>' +
      '<time>' + U.timeAgo(h.at) + '</time></li>';
  }


  var adTimer = null;

  function updateAdButton(root, hearts) {
    var btn = root.querySelector('[data-ad-btn]');
    if (!btn) return;
    var sub = btn.querySelector('[data-ad-sub]');
    if (sub) sub.textContent = adLabel(hearts);
    btn.disabled = !hearts.canWatchAd;
  }

  /* 30초 쿨다운 동안 버튼 글자를 1초마다 갱신 */
  function startAdTicker(root, ctx) {
    if (adTimer) { clearInterval(adTimer); adTimer = null; }
    var hearts = (ctx.store.state.data.hearts || {});
    var left = hearts.nextAdInSec || 0;
    if (left <= 0) return;
    adTimer = setInterval(function () {
      left -= 1;
      var btn = root.querySelector('[data-ad-btn]');
      if (!btn) { clearInterval(adTimer); adTimer = null; return; }
      if (left > 0) {
        var sub = btn.querySelector('[data-ad-sub]');
        if (sub) sub.textContent = '+' + hearts.adReward + ' · ' + left + '초 후';
      } else {
        clearInterval(adTimer);
        adTimer = null;
        ctx.refresh();     /* 쿨다운이 끝나면 잔액·버튼 상태를 다시 계산 */
      }
    }, 1000);
  }

  /* 보상형 광고 재생
   * 1) 네이티브 앱(WebView) 브리지가 있으면 그쪽에 위임하고, 결과는
   *    BM.app.onRewardAdResult(true) 로 돌아옵니다. (AdMob 등)
   * 2) 웹/프로토타입에서는 3초짜리 모의 광고를 재생합니다.
   */
  function playRewardAd() {
    return new Promise(function (resolve) {
      var bridge = (typeof window !== 'undefined') && (window.BadmintonNative || window.AndroidBridge);
      if (bridge && typeof bridge.showRewardedAd === 'function') {
        try {
          BM.app.pendingRewardAd = resolve;
          bridge.showRewardedAd('heart_reward');
          return;
        } catch (e) { /* 실패하면 모의 광고로 진행 */ }
      }
      var wrap = UI.openSheet({
        title: '보상형 광고',
        body: '<div class="ad-sim">' +
          '<div class="ad-sim__badge">AD</div>' +
          '<p class="ad-sim__t">광고를 보는 중이에요</p>' +
          '<p class="ad-sim__s">끝까지 보면 하트 ' + D.HEART_RULES.AD_REWARD + '개 · <b data-ad-count>3</b>초</p>' +
          '<div class="adbar adbar--lg"><i data-ad-progress style="width:0%"></i></div>' +
          '<p class="hint">실제 앱에서는 이 자리에 AdMob 광고가 재생됩니다.</p></div>'
      });
      var left = 3;
      var tick = setInterval(function () {
        left -= 1;
        var c = wrap && wrap.querySelector('[data-ad-count]');
        var p = wrap && wrap.querySelector('[data-ad-progress]');
        if (c) c.textContent = String(Math.max(0, left));
        if (p) p.style.width = Math.round(((3 - left) / 3) * 100) + '%';
        if (left <= 0) {
          clearInterval(tick);
          UI.closeSheet();
          resolve({ rewarded: true, adUnit: 'heart_reward' });
        }
      }, 1000);
    });
  }

  var view = {
    title: 'MY',
    render: function (state) {
      var me = state.me || {};
      var theme = (me.theme && me.theme.theme) || 'th_def';
      var avatar = (me.theme && me.theme.avatar) || '🏸';
      var s = state.data.stats || {};
      var hearts = state.data.hearts || { balance: 0, earned: 0, spent: 0, history: [] };
      var myApps = (state.data.coachApps || []).filter(function (a) { return a.userKey === me.key; });
      var coach = (myApps.filter(function (a) { return a.status === '승인'; })[0]);
      var pendingApp = myApps.filter(function (a) { return a.status === '심사중'; })[0];
      return '' +
        '<section class="card card--profile">' +
        '<div class="profile">' + UI.avatar(avatar, 64) +
        '<div class="profile__id"><div class="profile__name">' + U.esc(me.nick || '회원') +
        (coach ? '<span class="pill pill--ok">코치</span>' : '') + '</div>' +
        '<p class="profile__meta">' + U.esc([me.level, me.discipline, me.region, me.club].filter(Boolean).join(' · ')) + '</p>' +
        (me.bio ? '<p class="profile__bio">' + U.esc(me.bio) + '</p>' : '') + '</div>' +
        '<button class="iconbtn" data-act="edit-profile" aria-label="프로필 수정">' + UI.icon('edit') + '</button></div>' +
        (pendingApp ? '<p class="notice">멘토 신청이 <b>심사중</b>이에요. 승인되면 코치 기능을 쓸 수 있어요.</p>' : '') +
        '<div class="stats">' +
        '<div class="stat"><strong>' + (s.count || 0) + '</strong><span>총 기록</span></div>' +
        '<div class="stat"><strong>' + (s.minutesMonth || 0) + '</strong><span>이번 달(분)</span></div>' +
        '<div class="stat"><strong>' + (s.winRate == null ? '—' : s.winRate + '%') + '</strong><span>승률</span></div>' +
        '<div class="stat"><strong>' + (s.streak || 0) + '</strong><span>연속 기록</span></div>' +
        '<div class="stat"><strong>' + (s.avgCond == null ? '—' : s.avgCond) + '</strong><span>평균 컨디션</span></div>' +
        '<div class="stat"><strong>' + (s.sessions14 || 0) + '</strong><span>최근 2주</span></div>' +
        '</div></section>' +

        accountCard(state) +

        heartCard(hearts) +

        '<section class="card"><header class="card__head"><h2>꾸미기</h2><span class="muted sm">탭하면 바로 적용</span></header>' +
        themeSwatches(state) + '</section>' +

        '<section class="card"><header class="card__head"><h2>데이터 연결</h2>' +
        '<span class="pill ' + (state.mode === 'sheets' ? 'pill--ok' : '') + '">' + (state.mode === 'sheets' ? '시트 연결됨' : '기기 저장') + '</span></header>' +
        '<p class="hint">' + (state.mode === 'sheets'
          ? '구글 시트의 <b>출력결과</b> 탭과 실제로 연결되어 있어요. 저장하면 시트에 바로 쌓입니다.'
          : '이 기기 브라우저에 저장돼요. Apps Script 브리지를 연결하면 계정 기록이 시트에 쌓입니다.') + '</p>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-act="connect">' + UI.icon('edit') + '시트 연결</button>' +
        '<button class="btn btn--ghost grow" data-act="export">JSON 내보내기</button></div>' +
        ((state.mode === 'local' && isGuest()) ? '<button class="linkbtn mt8" data-act="reset-demo">저장된 기록 모두 지우기</button>' : '') +
        '<p class="sync">마지막 동기화 ' + U.esc(state.lastSync || '—') +
        (state.syncState === 'syncing' ? ' · 보내는 중…' : state.syncState === 'error' ? ' · <b class="warn">재시도 대기</b>' : '') + '</p>' +
        (state.queue && state.queue.length ? '<button class="linkbtn" data-act="retry">대기 중인 저장 ' + state.queue.length + '건 지금 보내기</button>' : '') +
        '</section>' +

        '<p class="version">배드민턴 분석 앱 · 프로토타입 v1.1 · ' + U.esc(state.mode === 'sheets' ? 'Apps Script 연결' : 'localStorage') + '</p>';
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        var sw = ev.target.closest('.theme[data-theme]');   /* html[data-theme]까지 올라가지 않게 */
        if (sw) {
          ev.preventDefault();
          var id = sw.getAttribute('data-theme');
          Array.prototype.forEach.call(root.querySelectorAll('[data-theme]'), function (b) { b.classList.remove('is-on'); });
          sw.classList.add('is-on');
          document.documentElement.setAttribute('data-theme', id);
          UI.haptic(8);
          ctx.actions.setTheme(id);
          UI.toast('테마를 적용했어요');
          return;
        }
        if (ev.target.closest('[data-act="checkin"]')) {
          ev.preventDefault();
          var ci = ctx.actions.checkIn();
          if (ci.ok) { UI.toast('출석 체크 완료! 하트 +' + ci.gained); UI.haptic(14); }
          else if (ci.reason === 'done') UI.toast('오늘은 이미 출석했어요');
          else if (ci.reason === 'locked') UI.toast('잠시만요');
          return;
        }
        var adBtn = ev.target.closest('[data-act="ad"]');
        if (adBtn) {
          ev.preventDefault();
          if (adBtn.disabled || adBtn.classList.contains('is-busy')) return;   /* 연타·쿨다운 방지 */
          adBtn.classList.add('is-busy');
          playRewardAd().then(function (r) {
            adBtn.classList.remove('is-busy');
            if (!r || !r.rewarded) { UI.toast('광고를 끝까지 봐야 하트를 받을 수 있어요'); return; }
            var res = ctx.actions.watchAd({ verified: true, adUnit: r.adUnit });
            if (res.ok) {
              UI.toast('하트 +' + res.gained + ' · 오늘 ' + res.remaining + '회 남음');
              UI.haptic(16);
            } else if (res.reason === 'limit') UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!');
            else if (res.reason === 'cooldown') UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
            else if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
          });
          return;
        }
        if (ev.target.closest('[data-act="history"]')) {
          ev.preventDefault();
          var h = ctx.store.state.data.hearts || { history: [] };
          UI.openSheet({
            title: '하트 내역',
            body: '<div class="ledger-head">잔액 <b>' + h.balance + '</b> · 적립 <b class="up">' + h.earned +
              '</b> · 사용 <b class="down">' + h.spent + '</b> (기본 ' + h.base + ')</div>' +
              ((h.history || []).length
                ? '<ul class="ledger ledger--full">' + h.history.map(ledgerRow).join('') + '</ul>'
                : '<p class="sheet__text">아직 내역이 없어요.</p>')
          });
          return;
        }
        if (ev.target.closest('[data-act="edit-profile"]')) {
          ev.preventDefault();
          openProfileSheet(root, ctx);
          return;
        }
        if (ev.target.closest('[data-act="connect"]')) {
          ev.preventDefault();
          openConnectSheet(ctx);
          return;
        }
        if (ev.target.closest('[data-act="export"]')) {
          ev.preventDefault();
          exportJson(ctx);
          return;
        }
        if (ev.target.closest('[data-act="reset-demo"]')) {
          ev.preventDefault();
          UI.confirm('이 기기에 저장된 기록을 모두 지울까요? 되돌릴 수 없어요.').then(function (ok) {
            if (!ok) return;
            ctx.actions.resetDemo().then(function () { UI.toast('저장된 기록을 모두 지웠어요'); });
          });
          return;
        }
        if (ev.target.closest('[data-act="retry"]')) {
          ev.preventDefault();
          ctx.actions.retrySync();
          return;
        }
        if (ev.target.closest('[data-act="logout"]')) {
          ev.preventDefault();
          UI.confirm('로그아웃할까요? 기록은 계정에 그대로 남아 있어요.', '로그아웃').then(function (ok) {
            if (!ok) return;
            if (ctx.signOut) ctx.signOut();
          });
          return;
        }
        if (ev.target.closest('[data-act="account-login"]')) {
          ev.preventDefault();
          if (ctx.signOut) ctx.signOut();
          return;
        }
        if (ev.target.closest('[data-act="save-client-id"]')) {
          ev.preventDefault();
          var input = root.querySelector('[data-cid]');
          var savedCid = BM.auth.setGoogleClientId(input ? input.value : '');
          if (!savedCid.ok) { UI.toast(savedCid.message, 'error'); return; }
          UI.toast(savedCid.clientId ? 'Google Client ID를 저장했어요' : 'Client ID를 지웠어요');
          ctx.refresh();
          return;
        }
        if (ev.target.closest('[data-act="clear-client-id"]')) {
          ev.preventDefault();
          BM.auth.setGoogleClientId('');
          UI.toast('Client ID를 지웠어요');
          ctx.refresh();
          return;
        }
      });

      startAdTicker(root, ctx);
    },

    update: function (root, state, ctx) {
      /* MY 화면은 값이 여러 곳에 흩어져 있어 통째로 다시 그립니다 */
      ctx.refresh();
    }
  };

  function openProfileSheet(root, ctx) {
    var me = ctx.store.state.me || {};
    var avatar = (me.theme && me.theme.avatar) || '🏸';
    UI.openSheet({
      title: '프로필 수정',
      body: '<div class="form">' +
        '<div class="avatars">' + AVATARS.map(function (a) {
          return '<button type="button" class="avataropt' + (a === avatar ? ' is-on' : '') + '" data-avatar="' + a + '">' + a + '</button>';
        }).join('') + '</div>' +
        '<label class="flabel">닉네임<input type="text" data-p="nick" maxlength="12" value="' + U.esc(me.nick || '') + '"></label>' +
        '<label class="flabel">급수<div class="scrollx" data-p-group="level">' + D.VOCAB.grades.map(function (l) {
          return '<button type="button" class="chip chip--sm' + (me.level === l ? ' is-on' : '') + '" data-pick-val="' + l + '">' + l + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">주력 종목<div class="scrollx" data-p-group="discipline">' + D.VOCAB.disciplines.map(function (l) {
          return '<button type="button" class="chip chip--sm' + (me.discipline === l ? ' is-on' : '') + '" data-pick-val="' + l + '">' + l + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">한 줄 소개<input type="text" data-p="bio" maxlength="60" value="' + U.esc(me.bio || '') + '"></label>' +
        '</div><button class="btn btn--primary btn--big mt16" data-act="save-profile">저장</button>',
      onMount: function (wrap) {
        var chosen = { level: me.level, discipline: me.discipline, avatar: avatar };
        wrap.addEventListener('click', function (ev) {
          var av = ev.target.closest('[data-avatar]');
          if (av) {
            chosen.avatar = av.getAttribute('data-avatar');
            Array.prototype.forEach.call(wrap.querySelectorAll('[data-avatar]'), function (b) { b.classList.remove('is-on'); });
            av.classList.add('is-on');
            return;
          }
          var pick = ev.target.closest('[data-pick-val]');
          if (pick) {
            var group = pick.closest('[data-p-group]');
            var key = group.getAttribute('data-p-group');
            chosen[key] = pick.getAttribute('data-pick-val');
            Array.prototype.forEach.call(group.querySelectorAll('[data-pick-val]'), function (b) { b.classList.remove('is-on'); });
            pick.classList.add('is-on');
            return;
          }
          if (ev.target.closest('[data-act="save-profile"]')) {
            var res = ctx.actions.saveProfile({
              nick: wrap.querySelector('[data-p="nick"]').value.trim() || me.nick,
              bio: wrap.querySelector('[data-p="bio"]').value.trim(),
              level: chosen.level, discipline: chosen.discipline, avatar: chosen.avatar
            });
            if (res.ok) { UI.closeSheet(); UI.toast('프로필을 저장했어요'); }
            else UI.toast('잠시만요, 저장 중이에요');
          }
        });
      }
    });
  }

  function openConnectSheet(ctx) {
    var sess = BM.api.savedSession() || {};
    UI.openSheet({
      title: '구글 시트 연결',
      body: '<p class="sheet__text">Apps Script를 웹 앱으로 배포한 뒤 나온 <b>/exec</b> 주소를 넣어 주세요. ' +
        '메일과 비밀번호는 브리지에서만 확인되고, 비밀번호는 해시로 저장됩니다.</p>' +
        '<label class="flabel">웹 앱 URL (…/exec)<input type="url" data-c="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + U.esc(sess.url || '') + '"></label>' +
        '<label class="flabel">이메일<input type="email" data-c="email" inputmode="email" placeholder="you@example.com"></label>' +
        '<label class="flabel">비밀번호<input type="password" data-c="password" placeholder="처음이면 새 비밀번호로 가입"></label>' +
        '<label class="flabel">닉네임 (처음 가입 시)<input type="text" data-c="nick" maxlength="12" placeholder="시트에 표시될 이름"></label>' +
        '<div class="row gap8 mt16"><button class="btn btn--ghost grow" data-close>취소</button>' +
        '<button class="btn btn--primary grow" data-act="do-connect">연결</button></div>',
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="do-connect"]')) return;
          var url = wrap.querySelector('[data-c="url"]').value.trim();
          var email = wrap.querySelector('[data-c="email"]').value.trim();
          var password = wrap.querySelector('[data-c="password"]').value;
          var nick = wrap.querySelector('[data-c="nick"]').value.trim();
          if (!url || !email || !password) { UI.toast('주소·이메일·비밀번호를 모두 입력해 주세요'); return; }
          UI.toast('연결하는 중…');
          ctx.connectSheets(url, email, password, nick).then(function (res) {
            if (res.ok) { UI.closeSheet(); UI.toast('시트와 연결됐어요'); }
            else UI.toast(res.message || '연결하지 못했어요', 'error');
          });
        });
      }
    });
  }

  function exportJson(ctx) {
    var rows = ctx.store.state.rows || [];
    var payload = JSON.stringify({ exportedAt: U.stamp(), columns: D.COLS, rows: rows }, null, 2);
    try {
      var blob = new Blob([payload], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'badminton-' + U.ymd() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      UI.toast('JSON 파일을 내려받았어요');
    } catch (e) {
      UI.toast('내보내지 못했어요', 'error');
    }
  }

  BM.views.my = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
