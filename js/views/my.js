/* ============================================================
 * views/my.js — MY (프로필·통계·하트·꾸미기·연결 설정)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var AVATARS = D.VOCAB && D.AVATAR ? D.AVATAR.emojis : ['🏸', '🦋', '🐻', '🦊', '🐧', '🐰', '🦉', '🐯', '🐨', '🔥', '🌟', '🥇'];

  function myAvatar(me) {
    return D.avatarOf({ theme: (me && me.theme) || {}, avatar: (me && me.theme && me.theme.avatar) || '🏸' });
  }

  function myMatchProfile(state) {
    var key = (state.me && state.me.key) || '';
    return (state.data.matchProfiles || []).filter(function (m) { return m.userKey === key; })[0] || {};
  }

  function genderPillOf(g) {
    var v = D.normalizeGender(g);
    if (!v || v === '비공개') return '';
    return '<span class="pill pill--gender pill--' + (v === '여성' ? 'f' : 'm') + '">' + U.esc(v) + '</span>';
  }

  function themeSwatches(state) {
    var current = (state.me && state.me.theme && state.me.theme.theme) || 'th_def';
    var meKey = (state.me && state.me.key) || '';
    return '<div class="themes">' + D.THEMES.map(function (t) {
      var owned = D.ownsTheme(state.data.idx, meKey, t.id);
      var price = D.themePrice(t.id);
      return '<button class="theme swatch--' + t.id + (current === t.id ? ' is-on' : '') + '" data-theme="' + t.id + '"' +
        ' aria-pressed="' + (current === t.id ? 'true' : 'false') + '"' +
        ' title="' + U.esc(t.name + (owned ? '' : ' · 하트 ' + price + '개로 열기')) + '">' +
        '<span class="theme__dot"></span><span class="theme__name">' + U.esc(t.name) + '</span>' +
        '<span class="theme__hint">' + U.esc(t.hint) + '</span>' +
        (owned || price <= 0 ? '' : '<span class="decolock theme__lock">하트 ' + price + '</span>') + '</button>';
    }).join('') + '</div>';
  }

  /* 테마 고르기 — 저장(하트 차감)이 끝난 뒤에만 화면 테마를 바꿉니다.
   * 예전에는 결과를 보지 않고 바로 칠해서, 하트가 모자라도 '적용했어요'라고
   * 알리고 화면만 바뀌었다가 새로고침하면 되돌아갔습니다. */
  function pickTheme(ctx, id) {
    var state = ctx.store.state;
    var meKey = (state.me && state.me.key) || '';
    var price = D.themePrice(id);
    var owned = D.ownsTheme(state.data.idx, meKey, id);
    var balance = (state.data.hearts && state.data.hearts.balance) || 0;

    function apply() {
      var res = ctx.actions.setTheme(id);
      if (res && res.ok) {
        /* 테마 적용·잔액은 store가 emit하면서 화면에 바로 반영됩니다 */
        UI.haptic(8);
        UI.toast(res.purchased ? '하트 ' + res.price + '개로 테마를 열었어요' : '테마를 적용했어요');
        return;
      }
      if (res && res.reason === 'hearts') UI.toast('하트가 ' + res.need + '개 부족해요. 광고·출석으로 모아 주세요.', 'error');
      else if (res && res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
      else UI.toast('테마를 바꾸지 못했어요', 'error');
    }

    if (owned || price <= 0) { apply(); return; }
    UI.confirm(((D.themeById(id) || {}).name || '테마') + ' — 하트 ' + price + '개로 열까요? 한 번 열면 계속 써요. 지금 하트 ' + balance + '개.', '열기')
      .then(function (yes) { if (yes) apply(); });
  }

  function adLabel(hearts) {
    if (!hearts.adRemaining) return '오늘 모두 받았어요';
    if (hearts.nextAdInSec > 0) return '+' + hearts.adReward + ' · ' + hearts.nextAdInSec + '초 후';
    return '+' + hearts.adReward + ' · 남은 ' + hearts.adRemaining + '회';
  }

  /* 연속 출석 안내 — 하트 카드 · 꾸미기 패널이 함께 씁니다 */
  function streakLine(hearts) {
    var days = hearts.checkinStreak || 0;
    var next = hearts.streakNext;
    if (!days) return '출석을 이어 가면 3일·7일·14일에 꾸미기가 무료로 열려요';
    return days + '일 연속 출석 중' + (next ? ' · ' + next.days + '일까지 ' + next.left + '일' : ' · 해금 가능한 꾸미기를 모두 받았어요');
  }

  function heartCard(hearts) {
    var adPct = hearts.adLimit ? Math.round((hearts.adUsedToday / hearts.adLimit) * 100) : 0;
    var adDisabled = !hearts.canWatchAd ? ' disabled' : '';
    var checkDisabled = !hearts.canCheckIn ? ' disabled' : '';
    var recent = (hearts.history || []).slice(0, 3);
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
      '<p class="streakline">' + UI.icon('check') + '<span>' + U.esc(streakLine(hearts)) + '</span></p>' +

      (recent.length ? '<ul class="ledger">' + recent.map(ledgerRow).join('') + '</ul>'
        : '<p class="hint">아직 하트 내역이 없어요. 출석 체크로 시작해 보세요.</p>') +
      (hearts.history && hearts.history.length > 3
        ? '<button class="linkbtn" data-act="history">전체 내역 ' + hearts.history.length + '건 보기</button>' : '') +
      '<p class="hint">광고는 ' + hearts.adCooldownSec + '초 간격 · 매칭 ' + hearts.matchCost + ' · 테마 ' +
      D.HEART_RULES.THEME_PRICES.th_court + ' · 선물 ' + hearts.giftCost + '</p>' +
      '</section>';
  }

  /* ---------- 계정 카드 (로그인 상태 · 로그아웃) ---------- */
  function isGuest() {
    var s = BM.auth && BM.auth.session ? BM.auth.session() : null;
    return !s || s.kind === 'guest';
  }

  function accountCard(state) {
    var auth = BM.auth;
    var s = auth.session();
    var kind = s ? s.kind : 'guest';
    var name = (s && s.name) || (state.me && state.me.nick) || '회원';
    var email = (s && s.email) || '';
    /* 실제 데이터 통로를 봅니다.
     * 예전에는 bridgeUrl()(저장 값이 없으면 기본 주소를 돌려줌)로 판단해서
     * 기기 저장(local) 모드에서도 '시트 브리지 계정'이라고 잘못 보였습니다. */
    var live = (s && s.source === 'sheets') || state.mode === 'sheets';
    var pic = s && s.picture
      ? '<img class="acc__pic" src="' + U.esc(s.picture) + '" alt="">'
      : '<span class="acc__pic acc__pic--emoji">' + (kind === 'google' ? 'G' : kind === 'email' ? '✉' : '🏸') + '</span>';
    var hint = kind === 'guest'
      ? '체험 모드 기록은 이 기기에만 저장돼요. 로그인하면 계정별로 따로 보관됩니다.'
      : kind === 'google'
        ? (s.demo ? '데모 Google 계정으로 미리보는 중이에요. 실제 계정은 Client ID를 넣으면 연결됩니다.' : 'Google 계정과 연결되어 있어요.')
        : kind === 'google'
          ? (s.demo ? '데모 Google 계정으로 미리보는 중이에요. 실제 계정은 Client ID를 넣으면 연결됩니다.' : 'Google 계정과 연결되어 있어요.')
          : (live ? '구글 시트 브리지 계정으로 로그인했어요.' : '이 기기에 저장된 체험 계정이에요.');
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
      '</section>';
  }

  /* ---------- 개인정보 · 계정 삭제 (Play 스토어 필수 항목) ---------- */
  function legalCard(state) {
    var s = BM.auth.session();
    var guest = !s || s.kind === 'guest';
    return '' +
      '<section class="card" data-region="legal">' +
      '<header class="card__head"><h2>개인정보 · 계정</h2></header>' +
      '<div class="row gap8 mt8 legal__row">' +
      '<a class="linkbtn legal__link" href="privacy.html" target="_blank" rel="noopener">' + UI.icon('shield') + '개인정보처리방침</a>' +
      '<button type="button" class="linkbtn legal__link" data-act="help">' + UI.icon('doc') + '이용안내</button>' +
      '</div>' +
      (guest
        ? '<p class="hint">체험 모드에는 계정이 없어요. 지금 남긴 기록은 <b>이 기기에만</b> 저장되고, 위의 ‘저장된 기록 모두 지우기’로 언제든 지울 수 있어요.</p>'
        : '<p class="hint">탈퇴하면 프로필·일지·채팅·매칭 신청 등 <b>계정의 모든 기록</b>이 삭제되고 되돌릴 수 없어요.</p>' +
          '<button type="button" class="btn btn--danger btn--sm mt8" data-act="delete-account">회원 탈퇴</button>') +
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
   *  실제 재생·결과 판정은 js/ads.js(BM.ads)가 맡습니다.
   *  1) 네이티브 앱(WebView) 브리지가 있으면 그쪽에 위임하고, 결과는
   *     BM.app.onRewardAdResult(true) 로 돌아옵니다. (AdMob 등)
   *  2) 웹/PWA에서는 3초 미리보기 시트를 쓰고, 중간에 닫으면 지급하지 않습니다.
   */
  function playRewardAd(opts) {
    if (BM.ads && typeof BM.ads.showRewarded === 'function') {
      return BM.ads.showRewarded({ unit: (opts && opts.unit) || 'heart_reward' });
    }
    return Promise.resolve({ rewarded: false, adUnit: 'heart_reward', source: 'none', reason: 'no_adapter' });
  }

  /* 접었다 펴는 설정 묶음 — MY는 카드를 쌓지 않고 목록으로 둡니다 */
  var openGroups = {};
  function group(id, iconName, title, value, body, region) {
    return '<details class="group" data-group="' + id + '"' + (openGroups[id] ? ' open' : '') + '>' +
      '<summary class="group__sum">' + UI.icon(iconName) +
      '<span class="group__t">' + U.esc(title) + '</span>' +
      (value ? '<span class="group__v">' + U.esc(value) + '</span>' : '') +
      UI.icon('arrow', 'group__car') + '</summary>' +
      '<div class="group__body"' + (region ? ' data-region="' + region + '"' : '') + '>' + body + '</div></details>';
  }

  function themeName(id) {
    var t = (D.themeById && D.themeById(id)) || null;
    return (t && t.name) || '기본 코트';
  }

  /* 데이터 연결 — 안내 문구는 짧게, 버튼은 크게.
   * 개발자용 Google Client ID 입력은 첫 화면을 어지럽히지 않게 이 묶음 맨 아래에 둡니다. */
  function dataPanel(state) {
    var auth = BM.auth;
    var cid = auth.googleClientId();
    var origin = (typeof location !== 'undefined' && location.origin) || '';
    return '<p class="hint">' + (state.mode === 'sheets'
      ? '구글 시트의 <b>출력결과</b> 탭과 연결되어 있어요. 저장하면 시트에 바로 쌓입니다.'
      : '이 기기 브라우저에 저장돼요. 시트를 연결하면 계정 기록이 시트에도 쌓입니다.') + '</p>' +
      '<div class="row gap8 mt8">' +
      '<button class="btn btn--ghost grow" data-act="connect">' + UI.icon('edit') + '시트 연결</button>' +
      '<button class="btn btn--ghost grow" data-act="export">JSON 내보내기</button></div>' +
      ((state.mode === 'local' && isGuest()) ? '<button class="linkbtn mt8" data-act="reset-demo">저장된 기록 모두 지우기</button>' : '') +
      '<p class="sync">마지막 동기화 ' + U.esc(state.lastSync || '—') +
      (state.syncState === 'syncing' ? ' · 보내는 중…' : state.syncState === 'error' ? ' · <b class="warn">재시도 대기</b>' : '') + '</p>' +
      (state.queue && state.queue.length ? '<button class="linkbtn" data-act="retry">대기 중인 저장 ' + state.queue.length + '건 지금 보내기</button>' : '') +
      '<details class="adv">' +
      '<summary>고급 · Google Client ID</summary>' +
      '<div class="adv__body">' +
      '<p class="hint">' + (auth.isDefaultGoogleClientId
        ? '기본으로 배드민턴 앱의 Google Client ID가 연결돼 있어 따로 넣지 않아도 구글 로그인이 돼요. '
        : '이 기기에만 다른 Client ID가 저장돼 있어요(아래 지우기를 누르면 기본값으로 돌아갑니다). ') +
      '다른 Google Cloud 프로젝트 것을 쓰려면 여기에 넣으세요. 승인된 자바스크립트 원본에는 ' +
      U.esc(origin || '이 사이트 주소') + '가 있어야 합니다.</p>' +
      '<input class="adv__input" type="text" data-cid spellcheck="false" autocomplete="off" placeholder="0000-xxxx.apps.googleusercontent.com" value="' + U.esc(cid) + '">' +
      '<div class="row gap8 mt8"><button type="button" class="btn btn--primary grow btn--sm" data-act="save-client-id">저장</button>' +
      (cid ? '<button type="button" class="btn btn--ghost btn--sm" data-act="clear-client-id">지우기</button>' : '') +
      '</div></div></details>';
  }

  var view = {
    title: 'MY',
    render: function (state) {
      var me = state.me || {};
      var theme = (me.theme && me.theme.theme) || 'th_def';
      var mp = myMatchProfile(state);
      var s = state.data.stats || {};
      var hearts = state.data.hearts || { balance: 0, earned: 0, spent: 0, history: [] };
      var myApps = (state.data.coachApps || []).filter(function (a) { return a.userKey === me.key; });
      var coach = (myApps.filter(function (a) { return a.status === '승인'; })[0]);
      var pendingApp = myApps.filter(function (a) { return a.status === '심사중'; })[0];
      return '' +
        '<section class="card card--profile">' +
        '<div class="profile">' +
        '<button type="button" class="profile__av" data-act="decorate-avatar" aria-label="프로필 사진 꾸미기">' +
        UI.avatar(myAvatar(me), 64) +
        '<span class="profile__avcam">' + UI.icon('camera') + '</span></button>' +
        '<div class="profile__id"><div class="profile__name">' + U.esc(me.nick || '회원') +
        genderPillOf(mp.gender || me.gender) +
        (coach ? '<span class="pill pill--ok">코치</span>' : '') + '</div>' +
        '<p class="profile__meta">' + U.esc([me.level, me.discipline, me.region, me.club].filter(Boolean).join(' · ')) + '</p>' +
        (me.bio ? '<p class="profile__bio">' + U.esc(me.bio) + '</p>' : '') + '</div>' +
        '<button class="iconbtn" data-act="edit-profile" aria-label="프로필 수정">' + UI.icon('edit') + '</button></div>' +
        (pendingApp ? '<p class="notice">멘토 신청이 <b>심사중</b>이에요. 승인되면 코치 기능을 쓸 수 있어요.</p>' : '') +
        '<div class="stats">' +
        '<div class="stat"><strong>' + (s.count || 0) + '</strong><span>총 기록</span></div>' +
        '<div class="stat"><strong>' + (s.minutesMonth || 0) + '</strong><span>이번 달(분)</span></div>' +
        '<div class="stat"><strong>' + (s.winRate == null ? '—' : s.winRate + '%') + '</strong><span>승률</span></div>' +
        '</div></section>' +

        heartCard(hearts) +

        accountCard(state) +

        group('decor', 'camera', '프로필 꾸미기', '사진 · 프레임 꾸미기', decoratePanel(me, state), 'decor') +
        group('theme', 'palette', '테마', themeName(theme), themeSwatches(state)) +
        group('data', 'chart', '데이터 연결', '시트 연결 · 내보내기', dataPanel(state)) +
        group('legal', 'shield', '개인정보 · 계정', '', legalCard(state)) +

        '<p class="version">배드민턴 · ' + U.esc((BM.app && BM.app.version) || 'v1.9.1') + ' · ' + U.esc(state.mode === 'sheets' ? 'Apps Script 연결' : 'localStorage') + '</p>';
    },

    mount: function (root, ctx) {
      /* 접힌 묶음의 상태를 기억합니다 (테마를 바꿔 다시 그려도 펼친 채로) */
      Array.prototype.forEach.call(root.querySelectorAll('details.group'), function (d) {
        d.addEventListener('toggle', function () {
          openGroups[d.getAttribute('data-group')] = d.open;
        });
      });
      root.addEventListener('click', function (ev) {
        var sw = ev.target.closest('.theme[data-theme]');   /* html[data-theme]까지 올라가지 않게 */
        if (sw) {
          ev.preventDefault();
          pickTheme(ctx, sw.getAttribute('data-theme'));
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
        if (ev.target.closest('[data-act="decorate-avatar"]')) {
          ev.preventDefault();
          ev.stopPropagation();
          openAvatarSheet(root, ctx);
          return;
        }
        if (ev.target.closest('[data-act="pick-photo"]')) {
          ev.preventDefault();
          pickPhotoFile(function (url) {
            var spec = myAvatar(ctx.store.state.me);
            saveAvatar(ctx, {
              photo: url, emoji: spec.emoji, frame: spec.frame, bg: spec.bg, badge: spec.badge
            }).then(function (ok) {
              if (ok) { UI.toast('프로필 사진을 바꿨어요'); UI.haptic(12); }
              else UI.toast('잠시만요, 저장 중이에요');
            });
          }, function (msg) { UI.toast(msg, 'error'); });
          return;
        }
        if (ev.target.closest('[data-act="clear-photo"]')) {
          ev.preventDefault();
          var specNow = myAvatar(ctx.store.state.me);
          saveAvatar(ctx, {
            photo: '', emoji: specNow.emoji, frame: specNow.frame, bg: specNow.bg, badge: specNow.badge
          }).then(function (ok) {
            if (ok) UI.toast('사진을 지웠어요');
          });
          return;
        }
        var frameBtn = ev.target.closest('[data-pick-frame]');
        if (frameBtn) {
          ev.preventDefault();
          var fid = frameBtn.getAttribute('data-pick-frame');
          var s2 = myAvatar(ctx.store.state.me);
          unlockDeco(ctx, 'frame', fid, function (res) {
            if (!res || !res.ok) { if (res && res.cancelled) UI.toast('그대로 두었어요'); return; }
            saveAvatar(ctx, { photo: s2.photo, emoji: s2.emoji, frame: fid, bg: s2.bg, badge: s2.badge })
              .then(function (ok) { if (ok) { UI.toast('프레임 · ' + frameName(fid)); ctx.refresh(); } });
          });
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
        if (ev.target.closest('[data-act="help"]')) {
          ev.preventDefault();
          openHelpSheet(ctx);
          return;
        }
        if (ev.target.closest('[data-act="delete-account"]')) {
          ev.preventDefault();
          openDeleteAccountSheet(ctx);
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
          UI.toast(savedCid.clientId ? 'Google Client ID를 저장했어요' : '저장 값을 지웠어요 · 기본 Client ID로 동작합니다');
          ctx.refresh();
          return;
        }
        if (ev.target.closest('[data-act="clear-client-id"]')) {
          ev.preventDefault();
          BM.auth.setGoogleClientId('');
          UI.toast('저장 값을 지웠어요 · 기본 Client ID로 동작합니다');
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

  /* ---------- 프로필 꾸미기 (MY 카드 · 시트) ---------- */
  function frames() { return (D.AVATAR && D.AVATAR.frames) || [{ id: 'basic', name: '기본' }]; }
  function bgs() { return (D.AVATAR && D.AVATAR.bgs) || [{ id: 'plain', name: '담백' }]; }
  function badges() { return (D.AVATAR && D.AVATAR.badges) || ['']; }

  /* 꾸미기 소유 상태 — 무료·이미 산 것·연속 출석 해금은 바로 적용 */
  function decoOf(state, kind, value) {
    var id = D.decoId(kind, value);
    var hearts = (state.data && state.data.hearts) || {};
    var meKey = (state.me && state.me.key) || '';
    var idx = state.idx || (state.data && state.data.idx) || { byType: {} };
    return {
      id: id, price: D.decoPrice(id),
      owned: !id || D.ownsDeco(idx, meKey, id, hearts.checkinStreak || 0)
    };
  }

  /* 잠긴 꾸미기: 하트로 열지 한 번 묻고, 열면 그대로 이어서 적용합니다 */
  function unlockDeco(ctx, kind, value, onDone) {
    var state = ctx.store.state;
    var d = decoOf(state, kind, value);
    if (!d.id) { UI.toast('알 수 없는 꾸미기예요', 'error'); return; }
    if (d.owned) { onDone({ ok: true, purchased: false }); return; }
    var balance = (state.data.hearts && state.data.hearts.balance) || 0;
    UI.confirm(D.decoName(d.id) + ' — 하트 ' + d.price + '개로 열까요? 한 번 열면 계속 써요. 지금 하트 ' + balance + '개.', '열기')
      .then(function (yes) {
        if (!yes) { onDone({ ok: false, cancelled: true }); return; }
        var res = ctx.actions.buyDeco(kind, value);
        if (res.ok) {
          UI.toast(res.purchased ? '하트 ' + res.price + '개로 열었어요' : '이미 열려 있어요');
          UI.haptic(12);
        } else if (res.reason === 'hearts') {
          UI.toast('하트가 ' + res.need + '개 부족해요');
        } else if (res.reason === 'locked') {
          UI.toast('잠시만요, 처리 중이에요');
        } else {
          UI.toast('열지 못했어요', 'error');
        }
        onDone(res);
      });
  }

  function lockTag(d) {
    return d.owned ? '' : '<span class="decolock">하트 ' + d.price + '</span>';
  }

  function decoratePanel(me, state) {
    var spec = myAvatar(me);
    return '<div class="decor">' +
      '<div class="decor__preview">' + UI.avatar(spec, 76) + '</div>' +
      '<div class="decor__body">' +
      '<p class="decor__t">' + (spec.photo ? '내 사진을 쓰고 있어요' : '이모지 ' + U.esc(spec.emoji)) + '</p>' +
      '<p class="hint">사진은 256×256으로 줄여 저장해요. 프레임은 아래에서 바로 바뀌어요.</p>' +
      '<div class="decor__acts">' +
      '<button type="button" class="btn btn--primary btn--sm" data-act="pick-photo">' + UI.icon('camera') + '사진 올리기</button>' +
      (spec.photo ? '<button type="button" class="btn btn--ghost btn--sm" data-act="clear-photo">지우기</button>' : '') +
      '</div></div></div>' +
      '<div class="framestrip">' + frames().map(function (f) {
        var d = decoOf(state, 'frame', f.id);
        return '<button type="button" class="framepick' + (spec.frame === f.id ? ' is-on' : '') + (d.owned ? '' : ' is-locked') + '"' +
          ' data-pick-frame="' + U.esc(f.id) + '" title="' + U.esc(f.name + (d.owned ? '' : ' · 하트 ' + d.price + '개로 해금')) + '">' +
          '<span class="framepick__dot framepick__dot--' + U.esc(f.id) + '"></span>' +
          '<span class="framepick__name">' + U.esc(f.name) + '</span>' + lockTag(d) + '</button>';
      }).join('') + '</div>' +
      '<p class="hint">' + U.esc(streakLine((state.data && state.data.hearts) || {})) + '</p>';
  }

  /* 사진 → 256×256 정사각형으로 잘라 JPEG로 압축 (localStorage·시트 한 칸 보호) */
  function readPhoto(file, cb, onError) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) { if (onError) onError('이미지 파일만 올릴 수 있어요'); return; }
    if (file.size > 12 * 1024 * 1024) { if (onError) onError('12MB보다 작은 사진을 골라 주세요'); return; }
    if (typeof document === 'undefined' || typeof FileReader === 'undefined') return;
    var reader = new FileReader();
    reader.onerror = function () { if (onError) onError('사진을 읽지 못했어요'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { if (onError) onError('사진을 열지 못했어요'); };
      img.onload = function () {
        var limit = (D.AVATAR && D.AVATAR.maxPhotoChars) || 60000;
        var tries = [{ size: 256, q: 0.72 }, { size: 256, q: 0.55 }, { size: 200, q: 0.6 }, { size: 160, q: 0.5 }];
        var url = '';
        for (var i = 0; i < tries.length; i++) {
          url = drawSquare(img, tries[i].size, tries[i].q);
          if (url && url.length <= limit) break;
        }
        if (!url || url.length > limit) { if (onError) onError('사진이 너무 커요. 다른 사진으로 해 주세요'); return; }
        cb(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function drawSquare(img, size, quality) {
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var c2 = canvas.getContext('2d');
    if (!c2) return '';
    var iw = img.width || size, ih = img.height || size;
    var scale = Math.max(size / iw, size / ih);
    var w = iw * scale, h = ih * scale;
    c2.fillStyle = '#101614';
    c2.fillRect(0, 0, size, size);
    c2.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    try { return canvas.toDataURL('image/jpeg', quality); } catch (e) { return ''; }
  }

  function pickPhotoFile(cb, onError) {
    if (typeof document === 'undefined') return;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      readPhoto(file, function (url) {
        if (input.parentNode) input.parentNode.removeChild(input);
        cb(url);
      }, function (msg) {
        if (input.parentNode) input.parentNode.removeChild(input);
        if (onError) onError(msg);
      });
    });
    input.click();
  }

  function togglePick(wrap, attr, value) {
    Array.prototype.forEach.call(wrap.querySelectorAll('[' + attr + ']'), function (b) {
      b.classList.toggle('is-on', b.getAttribute(attr) === value);
      b.setAttribute('aria-pressed', b.getAttribute(attr) === value ? 'true' : 'false');
    });
  }

  function openAvatarSheet(root, ctx, initialDraft) {
    var me = ctx.store.state.me || {};
    var state = ctx.store.state;
    var draft = initialDraft
      ? { photo: initialDraft.photo, emoji: initialDraft.emoji, frame: initialDraft.frame, bg: initialDraft.bg, badge: initialDraft.badge }
      : myAvatar(me);

    var wrap = UI.openSheet({
      title: '프로필 꾸미기',
      body: '<div class="avstudio">' +
        '<div class="avstudio__stage"><div data-preview>' + UI.avatar(draft, 118) + '</div>' +
        '<p class="avstudio__hint" data-studio-hint>' +
        (draft.photo ? '내 사진 · ' : '이모지 ' + U.esc(draft.emoji) + ' · ') + '프레임 ' + U.esc(frameName(draft.frame)) + '</p></div>' +
        '<div class="avstudio__row">' +
        '<button type="button" class="btn btn--primary btn--sm" data-act="studio-photo">' + UI.icon('camera') + '사진 올리기</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-act="studio-clear"' + (draft.photo ? '' : ' disabled') + '>' + UI.icon('trash') + '사진 지우기</button>' +
        '</div>' +

        '<h4 class="avstudio__label">프레임</h4>' +
        '<div class="pickgrid pickgrid--frame">' + frames().map(function (f) {
          var df = decoOf(state, 'frame', f.id);
          return '<button type="button" class="framepick' + (draft.frame === f.id ? ' is-on' : '') + (df.owned ? '' : ' is-locked') + '"' +
            ' data-pick-frame="' + U.esc(f.id) + '" aria-pressed="' + (draft.frame === f.id ? 'true' : 'false') + '"' +
            ' title="' + U.esc(f.name + (df.owned ? '' : ' · 하트 ' + df.price + '개로 해금')) + '">' +
            '<span class="framepick__dot framepick__dot--' + U.esc(f.id) + '"></span>' +
            '<span class="framepick__name">' + U.esc(f.name) + '</span>' + lockTag(df) + '</button>';
        }).join('') + '</div>' +

        '<h4 class="avstudio__label">배경</h4>' +
        '<div class="pickgrid pickgrid--bg">' + bgs().map(function (b) {
          return '<button type="button" class="bgpick' + (draft.bg === b.id ? ' is-on' : '') + '" data-pick-bg="' + U.esc(b.id) + '"' +
            ' aria-pressed="' + (draft.bg === b.id ? 'true' : 'false') + '">' +
            '<span class="bgpick__dot bgpick__dot--' + U.esc(b.id) + '"></span>' +
            '<span class="bgpick__name">' + U.esc(b.name) + '</span></button>';
        }).join('') + '</div>' +

        '<h4 class="avstudio__label">이모지</h4>' +
        '<div class="pickgrid pickgrid--emoji">' + AVATARS.map(function (a) {
          return '<button type="button" class="avataropt' + (draft.emoji === a ? ' is-on' : '') + '" data-pick-emoji="' + U.esc(a) + '"' +
            ' aria-pressed="' + (draft.emoji === a ? 'true' : 'false') + '">' + U.esc(a) + '</button>';
        }).join('') + '</div>' +

        '<h4 class="avstudio__label">배지</h4>' +
        '<div class="pickgrid pickgrid--badge">' + badges().map(function (b) {
          var db = decoOf(state, 'badge', b);
          return '<button type="button" class="badgeopt' + (draft.badge === b ? ' is-on' : '') + (db.owned ? '' : ' is-locked') + '"' +
            ' data-pick-badge="' + U.esc(b) + '" aria-pressed="' + (draft.badge === b ? 'true' : 'false') + '"' +
            ' title="' + U.esc((b ? D.decoName(db.id) : '배지 없음') + (db.owned ? '' : ' · 하트 ' + db.price + '개로 해금')) + '">' +
            (b ? U.esc(b) : '없음') + lockTag(db) + '</button>';
        }).join('') + '</div></div>' +
        '<button class="btn btn--primary btn--big mt16" data-act="studio-save">저장</button>' +
        '<p class="hint">사진은 기기에 256×256 JPEG로 저장되고, MY·1:1 매칭·커뮤니티에 같은 모습으로 보여요.</p>' +
        '<p class="hint">' + U.esc(streakLine((state.data && state.data.hearts) || {})) + '</p>',
      onMount: function (node) {
        function repaintPreview() {
          var box = node.querySelector('[data-preview]');
          if (box) box.innerHTML = UI.avatar(draft, 118);
          var hint = node.querySelector('[data-studio-hint]');
          if (hint) hint.textContent = (draft.photo ? '내 사진 · ' : '이모지 ' + draft.emoji + ' · ') + '프레임 ' + frameName(draft.frame);
          var clear = node.querySelector('[data-act="studio-clear"]');
          if (clear) clear.disabled = !draft.photo;
        }

        node.addEventListener('click', function (ev) {
          var f = ev.target.closest('[data-pick-frame]');
          if (f) {
            ev.preventDefault();
            var fidPick = f.getAttribute('data-pick-frame');
            var dfPick = decoOf(ctx.store.state, 'frame', fidPick);
            if (!dfPick.owned) {
              unlockDeco(ctx, 'frame', fidPick, function (res) {
                if (res && res.ok) draft.frame = fidPick;
                openAvatarSheet(root, ctx, draft);   /* 고르던 다른 값은 그대로 두고 다시 엽니다 */
              });
              return;
            }
            draft.frame = fidPick;
            togglePick(node, 'data-pick-frame', draft.frame);
            repaintPreview(); UI.haptic(6);
            return;
          }
          var b = ev.target.closest('[data-pick-bg]');
          if (b) {
            ev.preventDefault();
            draft.bg = b.getAttribute('data-pick-bg');
            togglePick(node, 'data-pick-bg', draft.bg);
            repaintPreview(); UI.haptic(6);
            return;
          }
          var e = ev.target.closest('[data-pick-emoji]');
          if (e) {
            ev.preventDefault();
            draft.emoji = e.getAttribute('data-pick-emoji');
            togglePick(node, 'data-pick-emoji', draft.emoji);
            repaintPreview(); UI.haptic(6);
            return;
          }
          var bd = ev.target.closest('[data-pick-badge]');
          if (bd) {
            ev.preventDefault();
            var badgePick = bd.getAttribute('data-pick-badge');
            var dbPick = decoOf(ctx.store.state, 'badge', badgePick);
            if (!dbPick.owned) {
              unlockDeco(ctx, 'badge', badgePick, function (res) {
                if (res && res.ok) draft.badge = badgePick;
                openAvatarSheet(root, ctx, draft);
              });
              return;
            }
            draft.badge = badgePick;
            togglePick(node, 'data-pick-badge', draft.badge);
            repaintPreview(); UI.haptic(6);
            return;
          }
          if (ev.target.closest('[data-act="studio-photo"]')) {
            ev.preventDefault();
            pickPhotoFile(function (url) {
              draft.photo = url;
              repaintPreview();
              UI.toast('사진을 넣었어요. 저장을 누르면 적용돼요');
            }, function (msg) { UI.toast(msg, 'error'); });
            return;
          }
          if (ev.target.closest('[data-act="studio-clear"]')) {
            ev.preventDefault();
            draft.photo = '';
            repaintPreview();
            return;
          }
          if (ev.target.closest('[data-act="studio-save"]')) {
            ev.preventDefault();
            saveAvatar(ctx, draft).then(function (ok) {
              if (!ok) { UI.toast('잠시만요, 저장 중이에요'); return; }
              UI.closeSheet();
              UI.toast('프로필을 꾸몄어요');
              UI.haptic(14);
              ctx.refresh();
            });
          }
        });
      }
    });
    return wrap;
  }

  function frameName(id) {
    var hit = frames().filter(function (f) { return f.id === id; })[0];
    return hit ? hit.name : '기본';
  }

  /* 꾸민 모습을 프로필(꾸미기 칸)과 매칭 카드(매칭프로필 JSON)에 함께 반영합니다 */
  function saveAvatar(ctx, spec) {
    var state = ctx.store.state;
    var me = state.me || {};
    var mp = myMatchProfile(state);
    var res = ctx.actions.saveProfile({
      avatar: spec.emoji, avatarPhoto: spec.photo, avatarFrame: spec.frame,
      avatarBg: spec.bg, avatarBadge: spec.badge, gender: mp.gender || me.gender
    });
    if (!res.ok) return Promise.resolve(false);
    if (mp && mp.rowId) {
      ctx.actions.saveMatchProfile({
        region: mp.region || '', level: mp.level || me.level || '', discipline: mp.discipline || me.discipline || '',
        club: mp.club || '', availability: mp.availability || '', experience: mp.experience || '',
        bio: mp.bio || me.bio || '', gender: mp.gender || me.gender || '비공개',
        avatar: spec.emoji, avatarPhoto: spec.photo, avatarFrame: spec.frame,
        avatarBg: spec.bg, avatarBadge: spec.badge
      });
    }
    return Promise.resolve(true);
  }

  function openProfileSheet(root, ctx) {
    var me = ctx.store.state.me || {};
    var mp = myMatchProfile(ctx.store.state);
    var avatar = myAvatar(me);
    var gender = mp.gender || me.gender || '비공개';
    UI.openSheet({
      title: '프로필 수정',
      body: '<div class="sheethero">' + UI.avatar(avatar, 64) +
        '<div><strong>' + U.esc(me.nick || '회원') + '</strong>' +
        '<p class="hint">사진 · 프레임 · 배경은 한곳에서 바꿔요.</p>' +
        '<button type="button" class="linkbtn" data-act="decorate-from-sheet">' + UI.icon('camera') + '사진 · 프레임 꾸미기</button></div></div>' +
        '<div class="form">' +
        '<label class="flabel">닉네임<input type="text" data-p="nick" maxlength="12" value="' + U.esc(me.nick || '') + '"></label>' +
        '<label class="flabel">성별<div class="scrollx" data-p-group="gender">' + D.VOCAB.genders.map(function (g) {
          return '<button type="button" class="chip chip--sm' + (gender === g ? ' is-on' : '') + '" data-pick-val="' + g + '">' + g + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">급수<div class="scrollx" data-p-group="level">' + D.VOCAB.grades.map(function (l) {
          return '<button type="button" class="chip chip--sm' + (me.level === l ? ' is-on' : '') + '" data-pick-val="' + l + '">' + l + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">주력 종목<div class="scrollx" data-p-group="discipline">' + D.VOCAB.disciplines.map(function (l) {
          return '<button type="button" class="chip chip--sm' + (me.discipline === l ? ' is-on' : '') + '" data-pick-val="' + l + '">' + l + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">지역<div class="scrollx" data-p-group="region">' + D.VOCAB.regions.map(function (r) {
          return '<button type="button" class="chip chip--sm' + ((mp.region || me.region) === r ? ' is-on' : '') + '" data-pick-val="' + r + '">' + r + '</button>';
        }).join('') + '</div></label>' +
        '<label class="flabel">한 줄 소개<input type="text" data-p="bio" maxlength="60" value="' + U.esc(me.bio || '') + '"></label>' +
        '</div><button class="btn btn--primary btn--big mt16" data-act="save-profile">저장</button>',
      onMount: function (wrap) {
        var chosen = { level: me.level, discipline: me.discipline, gender: gender, region: mp.region || me.region || '' };
        wrap.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-act="decorate-from-sheet"]')) {
            ev.preventDefault();
            UI.closeSheet();
            openAvatarSheet(root, ctx);
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
              level: chosen.level, discipline: chosen.discipline, gender: chosen.gender, region: chosen.region
            });
            if (res.ok) {
              var nowMp = myMatchProfile(ctx.store.state);
              if (nowMp && nowMp.rowId) {
                ctx.actions.saveMatchProfile({
                  region: chosen.region, level: chosen.level, discipline: chosen.discipline,
                  club: nowMp.club || '', availability: nowMp.availability || '', experience: nowMp.experience || '',
                  bio: wrap.querySelector('[data-p="bio"]').value.trim(), gender: chosen.gender,
                  avatar: nowMp.avatar || avatar.emoji, avatarPhoto: nowMp.avatarPhoto || '',
                  avatarFrame: nowMp.avatarFrame || 'basic', avatarBg: nowMp.avatarBg || 'plain',
                  avatarBadge: nowMp.avatarBadge || ''
                });
              }
              UI.closeSheet(); UI.toast('프로필을 저장했어요');
            } else UI.toast('잠시만요, 저장 중이에요');
          }
        });
      }
    });
  }

  function openHelpSheet(ctx) {
    UI.openSheet({
      title: '이용안내',
      body: '<p class="sheet__text">일지 한 줄이면 AI가 <b>드릴·처방·이번 주 루틴</b>을 만들어 주는 배드민턴 앱이에요.</p>' +
        '<h3 class="sec-title">' + UI.icon('log') + '기록하기</h3>' +
        '<ul class="bullets">' +
        '<li>일지 & AI 탭에서 컨디션·강도·시간을 고르고 <b>저장하고 AI 분석</b>을 누르면 분석이 바로 보여요.</li>' +
        '<li>아픈 부위를 고르면 그 부위에 맞는 <b>관리·스트레칭·복귀 수칙</b>이 함께 나와요.</li>' +
        '<li>급수(초심~자강)에 따라 드릴 세트 수와 이번 주 루틴이 달라집니다.</li>' +
        '</ul>' +
        '<h3 class="sec-title">' + UI.icon('match') + '매칭 · 대화</h3>' +
        '<ul class="bullets">' +
        '<li>매칭 카드를 만들면 급수·종목·지역이 맞는 상대를 보여 줘요.</li>' +
        '<li>1:1 매칭 요청은 보낼 때 하트 보유량(2개 이상)만 확인하고, <b>상대가 수락하면 하트 2개가 차감</b>돼요. 거절되면 차감 없음.</li>' +
        '<li>커뮤니티 번개의 <b>참여 문의</b>는 그 글 전용 <b>단체방</b>에서 이어져요.</li>' +
        '<li>친구가 되거나 매칭된 상대와만 대화할 수 있어요(안전을 위한 제한).</li>' +
        '</ul>' +
        '<h3 class="sec-title">' + UI.icon('shield') + '데이터 · 계정</h3>' +
        '<ul class="bullets">' +
        '<li>로그인하지 않으면 기록은 <b>이 기기에만</b> 저장돼요.</li>' +
        '<li>로그인하고 시트를 연결하면 계정별로 보관되고 다른 기기에서도 이어져요.</li>' +
        '<li>연결이 끊겨도 기록은 기기에 남고, 연결되면 자동으로 다시 보내요.</li>' +
        '<li>MY &gt; 개인정보 · 계정에서 <b>언제든 탈퇴(모든 기록 삭제)</b>할 수 있어요.</li>' +
        '</ul>' +
        '<div class="row gap8 mt16">' +
        '<a class="btn btn--ghost grow" href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>' +
        '<button type="button" class="btn grow" data-close>확인</button></div>'
    });
  }

  /* ---------- 회원 탈퇴(계정 삭제) 확인 시트 ----------
   * Play 스토어 정책: 앱 안에서 계정을 지울 수 있어야 하고,
   * 지워지는 범위와 되돌릴 수 없다는 점을 분명히 알려야 합니다.
   * 실수 방지를 위해 '탈퇴'를 직접 입력해야 버튼이 열립니다. */
  function openDeleteAccountSheet(ctx) {
    var s = BM.auth.session();
    var guest = !s || s.kind === 'guest';
    var who = (s && s.email) || (s && s.name) || '';
    var word = '탈퇴';
    var wrap = UI.openSheet({
      title: guest ? '기록 삭제' : '회원 탈퇴',
      body: '<p class="sheet__text">' + (guest
          ? '이 기기에 저장된 <b>프로필·일지·채팅·매칭 기록</b>을 모두 지웁니다.'
          : '<b>' + U.esc(who) + '</b> 계정을 삭제합니다.') + '</p>' +
        '<ul class="bullets">' +
        '<li>프로필·급수·성별·플레이스타일</li>' +
        '<li>훈련 일지·경기 기록·AI 분석</li>' +
        '<li>1:1 채팅·친구·매칭/멘토 신청 기록</li>' +
        '<li>하트·꾸미기 같은 계정 활동 기록</li>' +
        '</ul>' +
        '<p class="hint">삭제한 기록은 <b>되돌릴 수 없어요.</b>' +
        (guest ? '' : ' 시트(서버)에 있는 내 기록도 함께 지워집니다.') + '</p>' +
        '<label class="flabel">확인을 위해 <b>' + word + '</b>를 입력해 주세요' +
        '<input type="text" data-delete-word autocomplete="off" spellcheck="false" placeholder="' + word + '"></label>' +
        '<p class="start__error" data-delete-error style="display:none"></p>' +
        '<div class="row gap8 mt16">' +
        '<button type="button" class="btn btn--ghost grow" data-close>취소</button>' +
        '<button type="button" class="btn btn--danger grow" data-act="confirm-delete" disabled>' + (guest ? '모두 지우기' : '탈퇴하기') + '</button>' +
        '</div>',
      onMount: function (node) {
        var input = node.querySelector('[data-delete-word]');
        var btn = node.querySelector('[data-act="confirm-delete"]');
        var err = node.querySelector('[data-delete-error]');
        function sync() { if (btn) btn.disabled = !input || input.value.trim() !== word; }
        if (input) input.addEventListener('input', sync);
        sync();
        node.addEventListener('click', function (ev) {
          if (!ev.target.closest('[data-act="confirm-delete"]')) return;
          if (!btn || btn.disabled || btn.classList.contains('is-busy')) return;
          if (typeof ctx.deleteAccount !== 'function') {
            if (err) { err.textContent = '지금은 탈퇴를 처리할 수 없어요.'; err.style.display = ''; }
            return;
          }
          btn.classList.add('is-busy');
          btn.disabled = true;
          if (input) input.disabled = true;
          var label = btn.textContent;
          btn.textContent = '처리 중…';
          Promise.resolve(ctx.deleteAccount()).then(function (res) {
            if (res && res.ok) { UI.closeSheet(); return; }   /* app.js가 시작화면으로 돌려보냅니다 */
            btn.classList.remove('is-busy');
            btn.textContent = label;
            btn.disabled = false;
            if (input) input.disabled = false;
            if (err) {
              err.textContent = (res && res.message) || '탈퇴를 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
              err.style.display = '';
            }
          }, function (e) {
            btn.classList.remove('is-busy');
            btn.textContent = label;
            btn.disabled = false;
            if (input) input.disabled = false;
            if (err) { err.textContent = (e && e.message) || '탈퇴를 처리하지 못했어요.'; err.style.display = ''; }
          });
        });
      }
    });
    return wrap;
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
  BM.views.my.playRewardAd = playRewardAd;   /* 매칭 화면의 하트 충전 시트도 같은 광고 흐름을 씁니다 */
})(typeof globalThis !== 'undefined' ? globalThis : this);
