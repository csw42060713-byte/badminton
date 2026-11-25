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

  function rolePillOf(id) {
    var r = D.roleById(id);
    if (!r) return '';
    return '<span class="pill pill--role" data-rolepill="' + r.id + '">' + U.esc(r.label) + '</span>';
  }

  function genderPillOf(g) {
    var v = D.normalizeGender(g);
    if (!v || v === '비공개') return '';
    return '<span class="pill pill--gender pill--' + (v === '여성' ? 'f' : 'm') + '">' + U.esc(v) + '</span>';
  }

  /* 플레이 스타일 — 급수·성별과 나란히 프로필 카드에 보여 줍니다 */
  function styleOf(state, me, mp) {
    return D.normalizeStyle((mp && mp.style) || (me && me.style) ||
      (me && me.theme && me.theme.style) || '');
  }

  function stylePillOf(v) {
    var s = D.normalizeStyle(v);
    if (!s) return '';
    return '<span class="pill pill--style">' + U.esc(s) + '</span>';
  }

  /* bm-v1.57.0 — 테마 4종은 모두 무료입니다. 하트 배지·잠금·구매 안내 없이
   * 누르는 즉시 적용되고, 고른 테마는 MY › 테마와 시작 화면이 같은 저장을 씁니다. */
  function themeSwatches(state) {
    var current = (state.me && state.me.theme && state.me.theme.theme) || 'th_def';
    return '<div class="themes">' + D.THEMES.map(function (t) {
      return '<button class="theme swatch--' + t.id + (current === t.id ? ' is-on' : '') + '" data-theme="' + t.id + '"' +
        ' aria-pressed="' + (current === t.id ? 'true' : 'false') + '"' +
        ' title="' + U.esc(t.name + (current === t.id ? ' · 지금 테마' : ' · 무료')) + '">' +
        '<span class="theme__dot"></span><span class="theme__name">' + U.esc(t.name) + '</span>' +
        '<span class="theme__hint">' + U.esc(t.hint) + '</span></button>';
    }).join('') + '</div>';
  }

  /* 테마 고르기 — 모두 무료라 하트 확인 없이 바로 저장·적용합니다.
   * 예전에 하트로 열었던 기기·구매 기록은 그대로 남고 원장 계산도 건드리지 않습니다. */
  function pickTheme(ctx, id) {
    var res = ctx.actions.setTheme(id);
    if (res && res.ok) {
      UI.haptic(8);
      UI.toast('테마를 적용했어요');
      return;
    }
    if (res && res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
    else UI.toast('테마를 바꾸지 못했어요', 'error');
  }

  /* ---------- 하트 충전(공용 시트) ----------
   * MY 안에서도 하트가 모자란 자리(테마·프레임·배지)는 토스트로 끝내지 않고
   * js/ads.js 의 공용 충전 시트를 열어 출석·광고로 바로 채우게 합니다. */
  function openHeartSheet(ctx, opts) {
    if (BM.ads && typeof BM.ads.openHeartSheet === 'function') {
      return BM.ads.openHeartSheet(ctx, opts || {});
    }
    UI.toast('MY 하트 카드에서 충전할 수 있어요', 'error');
    return null;
  }

  function liveHearts(hearts) {
    return (BM.ads && typeof BM.ads.getStatus === 'function')
      ? BM.ads.getStatus(hearts)
      : hearts;
  }

  /* 광고 버튼 아래 한 줄 — '남은 3/5회 · 다음 광고까지 12초' (bm-v1.47.0)
   *  쿨타임 초가 1초마다 줄어 지금 눌러도 되는지가 바로 보입니다. */
  function adLabel(hearts) {
    var h = liveHearts(hearts);
    if (BM.ads && typeof BM.ads.adMeterText === 'function') return BM.ads.adMeterText(h);
    if (BM.ads && typeof BM.ads.adText === 'function') return BM.ads.adText(h);
    if (!h.adRemaining) return '오늘 모두 받았어요';
    if (h.nextAdInSec > 0) return '다음 광고까지 ' + h.nextAdInSec + '초';
    return '남은 ' + h.adRemaining + '회';
  }

  /* 연속 출석 안내 — 하트 카드 · 꾸미기 패널이 함께 씁니다
   *  왼쪽 줄: 꾸미기 무료 해금(3·7·14일 + 30일 챔피언 배지)까지,
   *  아래 줄: 하트 보너스(3·7·14·30일)까지 (bm-v1.73.0) */
  function streakLine(hearts) {
    var days = hearts.checkinStreak || 0;
    var next = hearts.streakNext;
    if (!days) return '출석을 이어 가면 3·7·14일 꾸미기와 30일 챔피언 배지가 무료로 열려요';
    if (!next) return days + '일 연속 출석 중 · 열 수 있는 꾸미기를 모두 받았어요';
    var gift = /배지/.test(next.label || '') ? '배지' : '프레임';
    return days + '일 연속 출석 중 · ' + next.days + '일까지 ' + next.left + '일 (' + gift + ' 무료)';
  }

  /* 3·7·14·30일 연속 출석 보너스 한 줄 (bm-v1.73.0) — 공용 충전 시트와 같은 문구를 씁니다 */
  function streakBonusLine(hearts) {
    var live = liveHearts(hearts);
    if (BM.ads && typeof BM.ads.streakText === 'function') return BM.ads.streakText(live);
    var b = hearts.streakBonus;
    if (!b || !(b.amount > 0)) return '';
    return b.left + '일 더 하면 보너스 하트 +' + b.amount;
  }

  /* 오늘의 하트 부스트 한 줄 (bm-v1.73.0) — 하트 부스트를 아직 열지 않은 사람도
   * 오늘 첫 리워드 광고 한 편에 하트 +1을 더 받습니다. */
  function dailyBoostLine(hearts) {
    var live = liveHearts(hearts);
    if (BM.ads && typeof BM.ads.dailyBoostText === 'function') return BM.ads.dailyBoostText(live);
    return '';
  }

  /* 하트 부스트 줄 (bm-v1.64.0)
   *  · 잠김: '하트 3개로 평생 켜기' — 누르면 하트 시트(모자라면 광고)로 이어집니다.
   *  · 켜짐: '적용 중(+1)' · 끄기 버튼. 상태는 프로필 꾸미기 JSON의 boost 값입니다. */
  function boostLine(hearts) {
    var b = (hearts && hearts.boost) || {};
    var price = Math.max(1, Number(b.price) || 3);
    var owned = !!b.owned, on = !!b.equipped;
    var sub = on ? '적용 중(+' + Math.max(1, Number(b.bonus) || 1) + ') · 출석·광고 +1'
      : owned ? '켜면 출석·광고가 +1' : '하트 ' + price + '개로 한 번 열면 계속';
    var btn = owned
      ? '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '" data-act="boost" data-boost="' + (on ? '0' : '1') + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + (on ? '끄기' : '켜기') + '</button>'
      : '<button type="button" class="chip chip--sm" data-act="boost" data-boost="1">하트 ' + price + '개로 열기</button>';
    return '<div class="boostline' + (on ? ' is-on' : '') + '" data-region="boost">' +
      UI.icon('spark') +
      '<span class="boostline__t">하트 부스트</span>' +
      '<span class="boostline__s">' + U.esc(sub) + '</span>' + btn + '</div>';
  }

  /* 하트 부스트 열기/켜기/끄기 (bm-v1.64.0)
   *  하트 지갑 카드와 꾸미기 시트가 같은 흐름을 씁니다.
   *  · 처음이면 하트 3개로 해금(모자라면 공용 하트 시트 → 채우면 그 자리에서 열기)
   *  · 그 뒤 setHeartBoost(true/false) 로 켜고 끕니다. */
  function runBoost(ctx, want, after) {
    var hearts = (ctx.store.state.data && ctx.store.state.data.hearts) || {};
    var bst = hearts.boost || {};
    var price = Math.max(1, Number(bst.price) || 3);

    function equip(on) {
      var onRes = ctx.actions.setHeartBoost(on);
      if (onRes && onRes.ok) {
        UI.toast(on ? '하트 부스트를 켰어요 · 출석·광고 +1' : '하트 부스트를 껐어요');
        UI.haptic(10);
      } else if (onRes && onRes.reason === 'not_owned') {
        UI.toast('먼저 하트로 하트 부스트를 열어 주세요');
      } else if (onRes && onRes.reason === 'locked') {
        UI.toast('잠시만요, 처리 중이에요');
      } else {
        UI.toast('바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요', 'error');
      }
      if (after) after();
    }

    if (want && !bst.owned) {
      /* bm-v1.75.0 — 하트 구매도 서버가 처리합니다(결과가 Promise 로 올 수 있어 U.when) */
      U.when(ctx.actions.buyDeco('boost', 'heart'), function (buyRes) {
        if (buyRes && buyRes.ok) {
          UI.toast(buyRes.purchased ? '하트 ' + buyRes.price + '개로 하트 부스트를 열었어요' : '이미 열려 있어요');
          UI.haptic(12);
        } else if (buyRes && buyRes.reason === 'hearts') {
          openHeartSheet(ctx, {
            need: price,
            intro: function (s) {
              return '<p class="sheet__text">하트 부스트 — <b>하트 ' + price +
                '개</b>로 한 번 열면 계속 써요. 지금 <b>' + s.balance + '개</b> 있어요.' +
                (s.balance < price ? ' <span class="warn">' + (price - s.balance) + '개 부족</span>' : '') + '</p>';
            },
            continueLabel: '열기',
            onContinue: function () { runBoost(ctx, true, after); }
          });
          return;
        } else if (buyRes && buyRes.reason === 'locked') {
          UI.toast('잠시만요, 처리 중이에요');
          return;
        } else if (buyRes && (buyRes.reason === 'offline' || buyRes.reason === 'login')) {
          UI.toast(buyRes.message || '인터넷에 연결되면 열 수 있어요', 'error');
          return;
        } else {
          UI.toast('지금은 열 수 없어요. 잠시 뒤 다시 시도해 주세요', 'error');
          return;
        }
        equip(true);
      });
      return;
    }
    equip(want);
  }

  function heartCard(hearts) {
    var live = liveHearts(hearts);
    var adPct = hearts.adLimit ? Math.round((hearts.adUsedToday / hearts.adLimit) * 100) : 0;
    var adDisabled = !live.canWatchAd ? ' disabled' : '';
    var checkDisabled = !hearts.canCheckIn ? ' disabled' : '';
    var recent = (hearts.history || []).slice(0, 3);
    var free = (BM.ads && typeof BM.ads.freeText === 'function') ? BM.ads.freeText(live) : '';
    var freeD = (BM.ads && typeof BM.ads.freeDetail === 'function') ? BM.ads.freeDetail(live) : '';
    return '<section class="card card--heart" data-region="heart">' +
      '<header class="card__head"><h2>' + UI.icon('heart') + '하트</h2>' +
      '<span class="heartchip">' + hearts.balance + '</span></header>' +

      '<div class="heartstats">' +
      '<div><strong class="up">+' + (hearts.todayEarned || 0) + '</strong><span>오늘 얻음</span></div>' +
      '<div><strong>' + hearts.balance + '</strong><span>잔액</span></div>' +
      '<div><strong data-ad-stat>' + hearts.adUsedToday + '/' + hearts.adLimit + '</strong><span>오늘 광고</span></div>' +
      '</div>' +

      /* 오늘 남은 무료 적립분을 한 줄로 — 이 숫자가 광고 쿨타임과 함께 1초마다 갱신됩니다 */
      '<p class="freeline" data-free-line' + (live.freeHeartsLeft > 0 ? '' : ' is-done') + '>' + UI.icon('spark') +
      '<span data-free>' + U.esc(free) + '</span>' +
      '<span class="freeline__d" data-free-d>' + U.esc(freeD) + '</span></p>' +

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
      (streakBonusLine(hearts)
        ? '<p class="streakbonus">' + UI.icon('spark') + '<span>' + U.esc(streakBonusLine(hearts)) + '</span></p>'
        : '') +
      (dailyBoostLine(hearts)
        ? '<p class="hint dailyline" data-daily-boost>' + U.esc(dailyBoostLine(hearts)) + '</p>'
        : '') +
      boostLine(hearts) +

      (recent.length ? '<ul class="ledger">' + recent.map(ledgerRow).join('') + '</ul>'
        : '<p class="hint">아직 하트 내역이 없어요. 출석 체크로 시작해 보세요.</p>') +
      (hearts.history && hearts.history.length > 3
        ? '<button class="linkbtn" data-act="history">전체 내역 ' + hearts.history.length + '건 보기</button>' : '') +
      '<p class="hint">광고는 ' + hearts.adCooldownSec + '초 간격 · 매칭 ' + hearts.matchCost + ' · 선물 ' + hearts.giftCost +
      ' · 테마는 모두 무료예요</p>' +
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
    /* 계정 사진도 http/https(또는 앱이 자른 data:image)만 — javascript:·data:text/html 차단 */
    var picUrl = s && s.picture ? D.safeImageUrl(s.picture) : '';
    var pic = picUrl
      ? '<img class="acc__pic" src="' + U.esc(picUrl) + '" alt="">'
      : '<span class="acc__pic acc__pic--emoji">' + (kind === 'google' ? 'G' : kind === 'email' ? '✉' : '🏸') + '</span>';
    var hint = kind === 'guest'
      ? '체험 모드 기록은 이 기기에만 저장돼요. 로그인하면 계정별로 따로 보관됩니다.'
      : kind === 'google'
        ? (s.demo ? '데모 Google 계정으로 미리보는 중이에요. 실제 계정은 Client ID를 넣으면 연결됩니다.' : 'Google 계정과 연결되어 있어요.')
        : auth.hasSupabaseAuth()
          ? '서버(Supabase) 계정으로 로그인했어요. 기록이 다른 기기와 이어집니다.'
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
      (auth.hasSupabaseAuth()
        ? '<div class="row gap8 mt8"><button type="button" class="linkbtn" data-act="change-password">' + UI.icon('shield') + '비밀번호 변경</button></div>'
        : '') +
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
    btn.disabled = !liveHearts(hearts).canWatchAd;
  }

  function stopAdTicker() {
    if (adTimer) { clearInterval(adTimer); adTimer = null; }
  }

  /* 광고 쿨타임을 1초마다 다시 계산합니다.
   *  · nextAdAt(절대 시각)에서 남은 초를 다시 구해 "다음 광고까지 N초"가 줄어듭니다.
   *  · 0초가 되면 버튼을 바로 열고 화면을 한 번 다시 그립니다.
   *  · 화면이 사라지면(탭 이동 등) 타이머를 끕니다 — adTimer 누수 방지. */
  function startAdTicker(root, ctx) {
    stopAdTicker();
    if (typeof setInterval !== 'function') return;
    var heartsNow = function () { return (ctx.store.state.data.hearts || {}); };
    if (!liveHearts(heartsNow()).nextAdInSec) return;

    adTimer = setInterval(function () {
      if (!root || (typeof root.isConnected === 'boolean' && !root.isConnected)) { stopAdTicker(); return; }
      var hearts = heartsNow();
      var h = liveHearts(hearts);
      var btn = root.querySelector('[data-ad-btn]');
      if (!btn) { stopAdTicker(); return; }
      var sub = btn.querySelector('[data-ad-sub]');
      if (sub) sub.textContent = adLabel(hearts);
      /* '오늘 광고 N/5' 칸도 함께 — 남은 횟수가 바뀌면 바로 따라갑니다 */
      var stat = root.querySelector('[data-ad-stat]');
      if (stat) stat.textContent = h.adUsedToday + '/' + h.adLimit;
      var free = root.querySelector('[data-free]');
      if (free && BM.ads && typeof BM.ads.freeText === 'function') free.textContent = BM.ads.freeText(h);
      var freeD = root.querySelector('[data-free-d]');
      if (freeD && BM.ads && typeof BM.ads.freeDetail === 'function') freeD.textContent = BM.ads.freeDetail(h);
      if (h.nextAdInSec > 0) return;

      /* 0초 — 버튼을 바로 열고, 잔액·오늘 남은 무료 하트를 다시 계산합니다 */
      btn.disabled = !h.canWatchAd;
      stopAdTicker();
      ctx.refresh();
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

  /* ---------- 알림 · 편지지 설정 (v1.20) ----------
   * 둘 다 기기에만 저장되고 기본은 켜짐입니다. 끄면 편지지·알림 없이 그대로 동작해요. */
  function prefOn(state, key) {
    return !(state && state.prefs && state.prefs[key] === false);
  }

  function prefRow(state, key, title, desc) {
    var on = prefOn(state, key);
    return '<div class="prefrow" data-pref-row="' + key + '">' +
      '<div class="prefrow__t"><strong>' + U.esc(title) + '</strong><p>' + U.esc(desc) + '</p></div>' +
      '<button type="button" class="switch' + (on ? ' is-on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' +
      ' aria-label="' + U.esc(title + ' ' + (on ? '끄기' : '켜기')) + '" data-act="toggle-' + key + '">' +
      '<i aria-hidden="true"></i><span>' + (on ? '켬' : '끔') + '</span></button></div>';
  }

  /* 실시간 푸시 알림 (bm-v1.57.0) — Firebase 키가 붙기 전에도 상태를 에러 없이 보여 주고,
   * 키가 들어오면 스위치를 켜 둔 사람부터 그대로 구독됩니다. */
  function pushStatusOf() {
    if (BM.push && BM.push.status) return BM.push.status();
    return { id: 'ready', label: 'Firebase 연결 준비됨 · 곧 켜져요' };
  }

  function pushRow(state) {
    var on = !!(state && state.prefs && state.prefs.push === true);
    var st = pushStatusOf();
    var hint = st.id === 'denied'
      ? '브라우저 알림이 차단되어 있어요. 폰 설정 > 사이트 설정에서 이 사이트 알림을 허용하면 켜져요.'
      : st.id === 'unsupported'
        ? '이 브라우저는 실시간 푸시를 지원하지 않아요. 앱 안 배너로 알려 드려요.'
        : st.firebaseReady
          ? '새 메시지·1:1 요청·게스트 신청을 앱을 닫아 둬도 폰 알림으로 받아요.'
          : '앱을 닫아 둬도 폰 알림으로 받는 기능이에요. 지금은 준비만 해 두고, 키가 연결되면 자동으로 켜집니다.';
    return '<div class="prefrow prefrow--push" data-pref-row="push">' +
      '<div class="prefrow__t"><strong>실시간 푸시 알림</strong><p>' + U.esc(hint) + '</p>' +
      '<span class="pushstatus pushstatus--' + U.esc(st.id) + '" data-push-status>' + U.esc(st.label) + '</span></div>' +
      '<button type="button" class="switch' + (on ? ' is-on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"' +
      ' aria-label="실시간 푸시 알림 ' + (on ? '끄기' : '켜기') + '" data-act="toggle-push">' +
      '<i aria-hidden="true"></i><span>' + (on ? '켬' : '끔') + '</span></button></div>';
  }

  function alarmPanel(state) {
    var perm = (typeof Notification !== 'undefined' && Notification.permission) || 'unsupported';
    var hint = perm === 'granted' ? '<p class="hint">브라우저 알림이 허용되어 있어요. 다른 탭·백그라운드에서도 알려 줘요.</p>'
      : perm === 'denied' ? '<p class="hint">브라우저 알림이 차단되어 있어요. 앱 안 배너와 진동으로만 알려 드려요.</p>'
      : perm === 'default' ? '<button type="button" class="linkbtn" data-act="allow-notify">브라우저 알림 허용하기</button>'
      : '<p class="hint">이 브라우저는 시스템 알림을 지원하지 않아요. 앱 안 배너로 알려 드려요.</p>';
    return prefRow(state, 'notify', '새 메시지 알림', '상대의 새 메시지·1:1 요청이 오면 앱 안 배너·브라우저 알림·짧은 진동으로 알려 줘요.') +
      hint +
      pushRow(state) +
      prefRow(state, 'letter', '편지지 형식 사용', '끄면 1:1 요청을 보낼 때와 받을 때 모두 편지지 대신 간단한 요청 카드로 보여요.') +
      '<p class="hint">이 기기에만 저장돼요. 끄고 켜도 보낸 요청과 기록은 그대로예요.</p>';
  }

  function alarmSummary(state) {
    return '알림 ' + (prefOn(state, 'notify') ? '켬' : '끔') + ' · 편지지 ' + (prefOn(state, 'letter') ? '켬' : '끔') +
      (state && state.prefs && state.prefs.push === true ? ' · 푸시 켬' : '');
  }

  /* ---------- 인스타 공유 카드 (bm-v1.57.0 → v1.61.0 → v1.62.0) ----------
   * v1.62.0에서 MY 입구는 프로필 바로 아래 배너(share-entry, 1탭으로 시트)로 옮겼습니다.
   * 이 패널은 오늘 운동·대회 인증 두 모드 버튼의 문구·배선을 그대로 남겨 둔 조각입니다
   * (기존 테스트·재사용). */
  function sharePanel(state) {
    var n = ((state.data && state.data.records) || []).length;
    return '<p class="sheet__text">운동 기록이나 대회 사진을 인스타 카드로 만들어 스토리에 올려요. ' +
      '카드 문구는 민턴일기 · 민턴기록 같은 프리셋에서 고르거나 직접 쓸 수 있어요. ' +
      '매거진 · 필름 · 투명 스티커 중에서 고르고 피드 4:5 · 스토리 9:16으로 저장해요. ' +
      '사진은 폰 안에서만 합쳐지고 서버로 보내지 않아요.</p>' +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--primary grow" data-act="share-card" data-sc-mode="today">' +
      UI.icon('camera') + '오늘 운동 카드</button>' +
      '<button type="button" class="btn btn--ghost grow" data-act="share-card" data-sc-mode="comp">' +
      UI.icon('target') + '대회 인증 카드</button></div>' +
      (n ? '<p class="hint">최근 일지 ' + n + '건 중에서 골라 만들 수 있어요.</p>'
        : '<p class="hint">일지를 먼저 저장하면 운동 숫자로 바로 만들 수 있어요.</p>');
  }

  /* ---------- 동기화 대기열 · 마지막 오류 (bm-v1.58.0) ----------
   * 예전에는 '보내지 못한 저장 N건'만 떠서 왜 안 보내지는지 알 수 없었습니다.
   * 이제 대기 중 건수 · 마지막 오류 내용 · 건너뛴(격리된) 저장 건수를 한눈에 보여 주고,
   * '지금 보내기 / 건너뛴 저장 다시 보내기 / 대기 중 비우기'를 같은 자리에 둡니다. */
  function syncErrorHead(kind) {
    if (kind === 'auth') return '로그인이 필요해요';
    if (kind === 'perm') return '서버가 받지 못했어요';
    if (kind === 'data') return '저장 내용을 확인해 주세요';
    if (kind === 'net') return '연결이 잠시 끊겼어요';
    return '마지막 동기화 오류';
  }

  /* 대기열·오류가 있으면 접힌 고급 밖에서도 한 줄로 먼저 알려 줍니다 */
  function syncAlert(state, full) {
    var queued = (state.queue || []).length;
    var skipped = (state.syncBlocked || []).length;
    if (!queued && !skipped) return '';
    var bits = [];
    if (queued) bits.push('보내지 못한 저장 ' + queued + '건');
    if (skipped) bits.push('건너뛴 저장 ' + skipped + '건');
    var head = state.syncError ? syncErrorHead(state.syncErrorKind) : (queued ? '보내는 중이에요' : '건너뛴 저장이 있어요');
    return '<div class="syncbox__alert" data-sync-alert>' +
      bits.join(' · ') + ' · <b>' + U.esc(head) + '</b>' +
      (state.syncError ? '<span class="syncbox__why">' + U.esc(state.syncError) + '</span>' : '') +
      (full ? '' : '<span class="syncbox__hint">원인과 다시 보내기는 아래 <b>고급</b>에 있어요.</span>') +
      (state.syncErrorKind === 'auth'
        ? '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="account-login">다시 로그인하기</button>' : '') +
      '</div>';
  }

  function syncPanel(state) {
    var queued = (state.queue || []).length;
    var skipped = (state.syncBlocked || []).length;
    var err = state.syncError || '';
    var authKind = state.syncErrorKind === 'auth';
    return '<div class="syncbox" data-sync-box>' +
      '<p class="syncbox__head">동기화 상태</p>' +
      '<div class="syncbox__row"><span>대기 중인 저장</span><b data-sync-queue>' + queued + '건</b></div>' +
      (skipped ? '<div class="syncbox__row"><span>서버가 받지 못해 건너뛴 저장</span><b class="warn" data-sync-dead>' + skipped + '건</b></div>' : '') +
      (err ? '<p class="syncbox__err' + (authKind ? ' is-auth' : '') + '" data-sync-error>' +
        '<b>' + U.esc(syncErrorHead(state.syncErrorKind)) + '</b> ' + U.esc(err) + '</p>' : '') +
      '<p class="sync">마지막 동기화 ' + U.esc(state.lastSync || '—') +
      (state.syncState === 'syncing' ? ' · 보내는 중…' : state.syncState === 'error' ? ' · <b class="warn">재시도 대기</b>' : '') + '</p>' +
      (queued || skipped
        ? '<div class="row gap8 mt8">' +
          (queued ? '<button type="button" class="btn btn--ghost btn--sm grow" data-act="retry">지금 보내기</button>' : '') +
          (skipped ? '<button type="button" class="btn btn--ghost btn--sm grow" data-act="retry-dead">건너뛴 저장 다시 보내기</button>' : '') +
          '</div>' : '') +
      (queued || skipped
        ? '<button type="button" class="linkbtn" data-act="clear-queue">대기 중 비우기</button>' +
          '<p class="hint">비우면 이 기기에 남은 보내지 못한 저장만 사라져요. 서버에 이미 저장된 기록은 그대로예요.</p>'
        : '<p class="hint">보내지 못한 저장이 없어요. 기록은 저장되는 대로 서버에 올라갑니다.</p>') +
      '</div>';
  }

  /* 데이터 연결 — 안내 문구는 짧게, 버튼은 크게.
   * bm-v1.55.0: 기록은 이제 Supabase에 자동으로 저장됩니다. 그래서 일반 사용자 화면에서는
   * 구글 시트 연결·JSON 내보내기·Client ID를 '고급' 접기 안으로 옮겼습니다
   * ("시트도 연결해야 하나?" 헷갈리지 않게 — 관리자·이미 시트로 쓰는 계정은 예전처럼 바로 보입니다).
   * 내부 sheets 브리지 코드·data-act 는 그대로라 예전 기기·점검 스크립트도 그대로 동작합니다. */
  function dataPanel(state) {
    var auth = BM.auth;
    var cid = auth.googleClientId();
    var origin = (typeof location !== 'undefined' && location.origin) || '';
    var live = state.mode === 'supabase';
    var signed = !isGuest();
    var full = dataToolsOpen(state);
    var livePill = state.realtime === 'live'
      ? '<span class="pill pill--ok">실시간 연결됨</span>'
      : '<span class="pill pill--ghost">연결 중…</span>';
    var modeText = live
      ? 'Supabase 실시간 서버(서울)에 연결돼 있어요. 상대가 보낸 메시지·1:1 요청이 1초 안에 도착합니다.'
      : state.mode === 'sheets'
        ? '구글 시트의 <b>출력결과</b> 탭과 연결되어 있어요. 저장하면 시트에 바로 쌓입니다.'
        : '이 기기 브라우저에 저장돼요. 로그인하면 실시간 서버에 쌓입니다.';
    var tools =
      '<div class="row gap8 mt8">' +
      '<button class="btn btn--ghost grow" data-act="connect">' + UI.icon('edit') +
      (live ? '시트로 바꾸기' : '시트 연결') + '</button>' +
      '<button class="btn btn--ghost grow" data-act="export">JSON 내보내기</button></div>' +
      (!live && signed
        ? '<button class="btn btn--primary btn--sm mt8" data-act="use-supabase">실시간 서버(Supabase)로 바꾸기</button>'
        : '') +
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
    return '<p class="hint">' + modeText + (live && signed ? ' ' + livePill : '') + '</p>' +
      syncAlert(state, full) +
      (full
        ? tools + syncPanel(state)
        : '<p class="hint hint--auto">' + UI.icon('check') +
          '기록은 자동으로 저장돼요. 시트 연결이나 백업은 필요할 때만 아래 <b>고급</b>을 열어 주세요.</p>' +
          '<details class="adv adv--dev" data-adv="sheets">' +
          '<summary>고급 · 시트 연결 · JSON 백업</summary>' +
          '<div class="adv__body">' + tools + syncPanel(state) + '</div></details>') +
      ((state.mode === 'local' && isGuest()) ? '<button class="linkbtn mt8" data-act="reset-demo">저장된 기록 모두 지우기</button>' : '');
  }

  /* 시트·백업 도구를 접기 없이 보여 줄 사람 — 관리자이거나 이미 시트로 쓰는 계정 */
  function dataToolsOpen(state) {
    return !!(state && ((state.data && state.data.isAdmin) || state.mode === 'sheets'));
  }

  /* ---------- 차단한 사람 (bm-v1.55.0) ----------
   * 커뮤니티·1:1 대화에서 차단한 사람을 여기서 한눈에 보고 풉니다.
   * 차단은 '유형=차단' 한 줄이라 기기를 바꿔도 그대로 따라옵니다. */
  function blockPanel(state) {
    var list = (state.data && state.data.blocks) || [];
    if (!list.length) {
      return '<p class="hint">' + UI.icon('shield') +
        '차단한 사람이 없어요. 커뮤니티 글·답글이나 1:1 대화 상단의 ⋯에서 차단할 수 있어요.</p>';
    }
    return '<ul class="blocklist">' + list.map(function (b) {
      return '<li data-block-row="' + U.esc(b.key) + '">' +
        UI.avatar(UI.person(state, b.key), 36) +
        '<div class="blocklist__mid"><strong>' + U.esc(b.nick) + '</strong>' +
        '<small>' + (b.at ? U.esc(U.timeAgo(b.at)) + ' 차단' : '차단함') + '</small></div>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-unblock="' + U.esc(b.key) + '">해제</button>' +
        '</li>';
    }).join('') + '</ul>' +
      '<p class="hint">해제하면 그 사람의 글·답글·매칭·1:1 대화가 다시 보여요.</p>';
  }

  /* ---------- 내 유형 (bm-v1.40.0) ----------
   * 처음 시작할 때 고른 네 유형을 MY에서 언제든 보고 바꿉니다.
   * 저장은 프로필 꾸미기 JSON 안 role 하나뿐이라(시트 26칸·Supabase 그대로)
   * 기기를 바꿔도 따라오고, 이미 가입한 예전 사용자는 '아직 안 고름'으로 보입니다. */
  function roleCard(state) {
    var me = state.me || {};
    var role = D.roleOf(me);
    var def = D.roleById(role);
    var guess = role ? null : D.roleById(D.roleGuess(me.level));
    var proOn = D.proVisible(me, (state || {}).proPref);
    var hint = role === 'player' ? '일지에 선수용 7대 훈련이 기본으로 뜽니다. 적은 내용은 저장한 뒤 ‘최근 기록’에서 다시 볼 수 있어요.'
      : role === 'beginner' ? '초보자 4주 루틴과 용어 사전을 먼저 보여 드려요.'
        : role === 'coach' ? '코치 탭에서 선수 일지를 모아 보고 피드백을 남길 수 있어요.'
          : role === 'club' ? '일지·게스트 모집·1:1 매칭을 기본으로 씁니다.'
            : '고르면 일지 첫머리와 안내가 그에 맞춰 바뀝니다.';
    return '' +
      '<section class="card" data-region="role">' +
      '<header class="card__head"><h2>내 유형</h2>' +
      (def ? '<span class="pill pill--grade">' + U.esc(def.label) + '</span>'
        : '<span class="pill pill--ghost">아직 안 고름</span>') + '</header>' +
      '<p class="role__s">지금 나에게 맞는 쪽을 골라 두세요. 언제든 바꿀 수 있어요.</p>' +
      '<div class="rolelist">' + D.ROLES.map(function (r) {
        var on = r.id === role;
        return '<button type="button" class="rolepick rolepick--sm' + (on ? ' is-on' : '') + '" data-role="' + r.id + '"' +
          ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<span class="rolepick__t">' + U.esc(r.label) + '</span>' +
          '<span class="rolepick__s">' + U.esc(r.answer) + '</span>' +
          '<span class="rolepick__d">' + U.esc(r.desc) + '</span></button>';
      }).join('') + '</div>' +
      (guess ? '<p class="hint">급수로 보면 <b>' + U.esc(guess.label) + '</b>이에요. 골라 두면 일지가 그에 맞춰 시작해요.</p>'
        : '<p class="hint">' + U.esc(hint) + '</p>') +
      /* 선수 블록 표시 선택 — 선수가 아니어도 개인 훈련을 적는 사람은 켈 수 있게 */
      '<div class="prefrow mt8">' +
      '<div class="prefrow__t"><strong>선수 7대 훈련 기록</strong><p>일지에 스트록·스매시 등 7항목 체크와 세부 입력칸을 보여 줘요</p></div>' +
      '<button type="button" class="switch' + (proOn ? ' is-on' : '') + '" role="switch" aria-checked="' +
      (proOn ? 'true' : 'false') + '" aria-label="선수 7대 훈련 기록 ' + (proOn ? '끄기' : '켜기') + '" data-act="pro-pref-toggle">' +
      '<i aria-hidden="true"></i><span>' + (proOn ? '켬' : '끔') + '</span></button></div>' +
      '</section>';
  }

  /* ---------- 초보자 4주 루틴 표시 선택 ----------
   * 일지 & AI 화면에 4주 체크리스트를 보일지 MY에서 언제든 바꿉니다.
   * '아직 고르지 않음'은 스위치가 꺼진 채로 보이고, 한 번 켜면 표시됩니다. */
  function routinePrefCard(state) {
    var pref = (state || {}).routinePref;
    var off = pref === false;
    var undecided = pref === null;
    var on = !off && !undecided;        /* routinePref가 없는 예전 state는 켜진 것으로 */
    var pill = on ? '<span class="pill pill--ok">표시 중</span>'
      : undecided ? '<span class="pill pill--ghost">아직 안 고름</span>'
        : '<span class="pill pill--ghost">숨김</span>';
    var hint = on
      ? '체크는 이 기기에 저장돼요 · 오늘은 한두 개만 해도 충분해요'
      : undecided
        ? '일지 & AI 화면에서 아직 시작할지 고르지 않았어요. 켜면 1주차부터 바로 보입니다.'
        : '일지 & AI 화면에서 숨겨 둔 상태예요. 켜면 바로 다시 보입니다.';
    return '' +
      '<section class="card" data-region="routine-pref">' +
      '<header class="card__head"><h2>훈련</h2>' + pill + '</header>' +
      /* v1.20의 MY 설정 줄(.prefrow)과 같은 모양으로 그립니다 */
      '<div class="prefrow">' +
      '<div class="prefrow__t"><strong>초보자 4주 루틴 표시</strong>' +
      '<p>일지 & AI 첫 화면에 4주 체크리스트를 보여줘요</p></div>' +
      '<button type="button" class="switch' + (on ? ' is-on' : '') + '" role="switch" aria-checked="' +
      (on ? 'true' : 'false') + '" aria-label="초보자 4주 루틴 표시 ' + (on ? '끄기' : '켜기') + '" data-act="routine-pref-toggle">' +
      '<i aria-hidden="true"></i><span>' + (on ? '켬' : '끔') + '</span></button>' +
      '</div>' +
      '<p class="hint">' + hint + '</p>' +
      /* 처음이라면 — 초심이 아니어도 언제든 용어 사전·기초 가이드를 펼칩니다 */
      '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="beginner-open" data-beg-tab="intro">🏸 처음이라면 · 용어 사전 &amp; 기초 가이드</button>' +
      '</section>';
  }

  /* 주간 약점 챌린지 연속 달성 배지 (bm-v1.34.0)
   *  · 집계는 D.challengeStreak 순수 함수 — 최근 주에 3회를 채운 주가 몇 주 연속인지.
   *  · 2주부터만 배지로 보입니다(1주는 '이번 주 달성' 한 줄). 0주면 조용히 숨김 —
   *    처음 하는 사람에게는 일지 탭의 챌린지 카드가 이미 안내를 합니다. */
  function streakBadge(state) {
    var ui = (state && state.ui) || {};
    var opts = ui.challengeNow ? { now: ui.challengeNow } : {};
    var st = D.challengeStreak((state && state.data && state.data.records) || [], opts);
    if (!st.weeks) return '';
    var text = st.weeks === 1 ? '이번 주 챌린지 달성' : st.weeks + '주 연속 챌린지 달성';
    return '<p class="mystreak" data-streak="' + st.weeks + '" title="주간 약점 3회 챌린지를 연속으로 채운 주">' +
      '<b>🔥 ' + U.esc(text) + '</b></p>';
  }

  var view = {
    title: 'MY',
    render: function (state) {
      var me = state.me || {};
      var theme = (me.theme && me.theme.theme) || 'th_def';
      var mp = myMatchProfile(state);
      var s = state.data.stats || {};
      var hearts = state.data.hearts || { balance: 0, earned: 0, spent: 0, history: [] };
      /* v1.45 — 코치·멘토 신청은 '멘토신청'·'코치신청' 두 종류라 도메인 함수로 모아 봅니다
       * (예전에는 코치신청만 봐서 멘토로 승인된 사람에게 배지가 안 붙었습니다) */
      var myApps = (state.idx && D.mentorApplications)
        ? D.mentorApplications(state.idx, me.key, false)
        : (state.data.coachApps || []).filter(function (a) { return a.userKey === me.key; });
      var coach = (myApps.filter(function (a) { return a.status === '승인'; })[0]);
      var pendingApp = myApps.filter(function (a) { return a.status === '심사중'; })[0];
      var myStyle = styleOf(state, me, mp);
      var prof = (state.idx && D.profileOf(state.idx, me.key)) || {};
      var myLevel = mp.level || prof.level || '';
      var myDiscipline = mp.discipline || prof.discipline || '';
      var clubName = mp.club || me.club || '';
      /* 체육관 이름은 등록된 체육관과 이어지면 눌러서 지도(주소·코트 수)를 엽니다 */
      var whereParts = [myDiscipline, mp.region || me.region].filter(Boolean).map(function (x) { return U.esc(x); });
      if (clubName) {
        whereParts.push((BM.views && BM.views.gyms && BM.views.gyms.link(clubName)) || U.esc(clubName));
      }
      var whereHtml = whereParts.join(' · ');
      var missing = [];
      if (!myLevel) missing.push('실력');
      if (!myDiscipline) missing.push('종목');
      if (D.normalizeGender(mp.gender || me.gender) === '비공개') missing.push('성별');
      if (!myStyle) missing.push('플레이 스타일');
      if (!mp.region && !me.region) missing.push('활동 지역');
      if (!mp.club && !me.club) missing.push('체육관');
      return '' +
        '<section class="card card--profile">' +
        '<div class="profile">' +
        '<button type="button" class="profile__av" data-act="decorate-avatar" aria-label="프로필 사진 꾸미기">' +
        UI.avatar(myAvatar(me), 64) +
        '<span class="profile__avcam">' + UI.icon('camera') + '</span></button>' +
        '<div class="profile__id"><div class="profile__name">' + U.esc(me.nick || '회원') +
        (coach ? '<span class="pill pill--ok">' + U.esc(coach.mentorType || '코치') + '</span>' : '') + '</div>' +
        /* v1.45 — 승인된 코치·멘토는 어디서 코치하는지와 증명됨을 이름 아래에 */
        (coach && D.mentorAffiliationLine(coach)
          ? '<p class="profile__coachline">' + UI.icon('shield') + U.esc(D.mentorAffiliationLine(coach)) + '</p>'
          : '') +
        /* v1.38 — 내 친구 코드(#XXXX). 친구는 이 코드를 아는 사람끼리만 맺습니다. */
        (BM.views.friends ? BM.views.friends.codeChip(state) : '') +
        '<div class="profile__pills">' +
        (myLevel ? '<span class="pill pill--grade">' + U.esc(myLevel) + '</span>' : '') +
        genderPillOf(mp.gender || me.gender) + stylePillOf(myStyle) + rolePillOf(D.roleOf(me)) + '</div>' +
        '<p class="profile__meta">' + (whereHtml || '종목·지역·체육관을 골라 보세요') + '</p>' +
        (me.bio ? '<p class="profile__bio">' + U.esc(me.bio) + '</p>' : '') + '</div></div>' +
        /* 꾸미기 입구는 이 버튼 하나입니다. 닉네임·사진·프레임·배지·급수·성별·
         * 스타일·체육관·지역·소개를 한 시트에서 고칩니다(테마만 따로 아래에). */
        '<button type="button" class="btn btn--primary btn--big profile__deco" data-act="decorate-sheet">' +
        '<span class="profile__deco-t">' + UI.icon('spark') + '프로필 꾸미기</span>' +
        '<span class="profile__deco-s">닉네임 · 사진 · 프레임 · 배지 · 급수 · 스타일 · 체육관</span></button>' +
        (missing.length
          ? '<p class="profile__decohint">' + U.esc(missing.slice(0, 2).join(' · ')) +
            (missing.length > 2 ? ' 등' : '') + '을 채우면 매칭이 더 잘 맞춰져요.</p>' : '') +
        (pendingApp ? '<p class="notice">멘토 신청이 <b>심사중</b>이에요. 승인되면 코치 기능을 쓸 수 있어요.</p>' : '') +
        '<div class="stats">' +
        '<div class="stat"><strong>' + (s.count || 0) + '</strong><span>총 기록</span></div>' +
        '<div class="stat"><strong>' + (s.minutesMonth || 0) + '</strong><span>이번 달(분)</span></div>' +
        '<div class="stat"><strong>' + (s.winRate == null ? '—' : s.winRate + '%') + '</strong><span>승률</span></div>' +
        '</div>' + streakBadge(state) + '</section>' +

        /* bm-v1.62.0 — 프로필 바로 아래 인스타 공유 입구.
         *  예전엔 아래 '인스타 공유 카드' 아코디언을 펼쳐야 보였습니다.
         *  이제 MY 첫 화면에서 1탭으로 시트가 열립니다(아코디언은 중복이라 걷어냈습니다). */
        '<button type="button" class="share-entry" data-act="share-card" data-sc-mode="today"' +
        ' data-share-entry="my-top" aria-label="인스타 공유 카드 만들기">' +
        '<span class="share-entry__ico" aria-hidden="true">📸</span>' +
        '<span class="share-entry__txt">' +
        '<span class="share-entry__t">인스타 공유 카드 만들기</span>' +
        '<span class="share-entry__s">민턴일기 · 대회 인증 · 사진 얹기</span>' +
        '<span class="share-entry__h">매거진 · 필름 · 스티커 디자인</span>' +
        '</span>' + UI.icon('arrow', 'share-entry__car') + '</button>' +

        /* v1.41 — 통계 카드 아래 주간·월간 상세 리포트 입구 */
        (BM.report ? BM.report.entryHtml() : '') +

        roleCard(state) +

        routinePrefCard(state) +

        heartCard(hearts) +

        accountCard(state) +

        group('alarm', 'bell', '알림 · 편지지', alarmSummary(state), alarmPanel(state)) +

        group('theme', 'palette', '테마', themeName(theme), themeSwatches(state)) +
        /* bm-v1.62.0 — '인스타 공유 카드' 아코디언은 프로필 아래 배너로 옮겼습니다.
         *  (예전 group('share', …) 는 같은 시트를 두 번 열어 중복이었습니다.) */
        /* v1.55 — 일반 사용자에게는 데이터 연결 대신 '자동 저장'이라는 말로 짧게 */
        group('data', 'chart', dataToolsOpen(state) ? '데이터 연결' : '데이터 · 자동 저장',
          dataToolsOpen(state) ? '시트 연결 · 내보내기' : '자동 저장 · 고급', dataPanel(state)) +
        group('blocks', 'shield', '차단한 사람',
          ((state.data && state.data.blocks && state.data.blocks.length) ? state.data.blocks.length + '명' : ''),
          blockPanel(state)) +
        group('legal', 'shield', '개인정보 · 계정', '', legalCard(state)) +

        '<p class="version">셔틀릭스 · ' + U.esc((BM.app && BM.app.version) || 'v1.9.1') + ' · ' + U.esc(state.mode === 'sheets' ? 'Apps Script 연결' : (state.mode === 'supabase' ? 'Supabase 서울' : '이 기기 저장')) + '</p>';
    },

    mount: function (root, ctx) {
      /* 접힌 묶음의 상태를 기억합니다 (테마를 바꿔 다시 그려도 펼친 채로) */
      Array.prototype.forEach.call(root.querySelectorAll('details.group'), function (d) {
        d.addEventListener('toggle', function () {
          openGroups[d.getAttribute('data-group')] = d.open;
        });
      });
      root.addEventListener('click', function (ev) {
        /* v1.38: 내 친구 코드 복사 (프로필 아래 칩) */
        var codeCopy = ev.target.closest('[data-code-copy]');
        if (codeCopy) {
          ev.preventDefault();
          if (BM.views.friends) BM.views.friends.copyAndTell(codeCopy.getAttribute('data-code-copy'));
          return;
        }
        var sw = ev.target.closest('.theme[data-theme]');   /* html[data-theme]까지 올라가지 않게 */
        if (sw) {
          ev.preventDefault();
          pickTheme(ctx, sw.getAttribute('data-theme'));
          return;
        }
        if (ev.target.closest('[data-act="toggle-notify"]') || ev.target.closest('[data-act="toggle-letter"]')) {
          ev.preventDefault();
          var isNotify = !!ev.target.closest('[data-act="toggle-notify"]');
          var which = isNotify ? 'notify' : 'letter';
          var next = !prefOn(ctx.store.state, which);
          ctx.actions.setPref(which, next);
          UI.haptic(8);
          UI.toast(isNotify
            ? (next ? '새 메시지 알림을 켰어요' : '새 메시지 알림을 껐어요')
            : (next ? '편지지 형식을 켰어요' : '편지지 형식을 껐어요'));
          if (isNotify && next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
            try { Notification.requestPermission(); } catch (e) { /* 무시 */ }
          }
          return;
        }
        if (ev.target.closest('[data-act="allow-notify"]')) {
          ev.preventDefault();
          if (typeof Notification !== 'undefined') {
            try { Notification.requestPermission(); } catch (e) { /* 무시 */ }
          }
          UI.toast('브라우저 알림을 허용하면 다른 탭에서도 알려 드려요');
          return;
        }

        if (ev.target.closest('[data-act="toggle-push"]')) {
          ev.preventDefault();
          var pushOn = !(ctx.store.state.prefs && ctx.store.state.prefs.push === true);
          ctx.actions.setPref('push', pushOn);
          UI.haptic(8);
          if (!pushOn) {
            if (BM.push && BM.push.unsubscribe) BM.push.unsubscribe();
            UI.toast('실시간 푸시 알림을 껐어요');
            return;
          }
          if (!BM.push || !BM.push.enable) { UI.toast('이 브라우저는 실시간 푸시를 지원하지 않아요', 'error'); return; }
          BM.push.enable().then(function (res) {
            if (res && res.waiting) UI.toast('스위치를 켜 뒀어요. Firebase가 연결되면 바로 켜져요');
            else if (res && res.ok) UI.toast('실시간 푸시 알림을 켰어요');
            else if (res && res.reason === 'denied') UI.toast('브라우저에서 알림을 차단했어요. 사이트 설정에서 허용해 주세요', 'error');
            else if (res && res.reason === 'permission') UI.toast('알림을 허용해야 켤 수 있어요', 'error');
            else if (res && res.reason === 'unsupported') UI.toast('이 브라우저는 실시간 푸시를 지원하지 않아요', 'error');
            else UI.toast('푸시 구독을 마치지 못했어요. 잠시 뒤 다시 켜 주세요', 'error');
            if (ctx.repaint) ctx.repaint();
          });
          return;
        }
        if (ev.target.closest('[data-act="share-card"]')) {
          ev.preventDefault();
          var scBtn = ev.target.closest('[data-act="share-card"]');
          if (!BM.sharecard) { UI.toast('공유 카드를 준비하고 있어요', 'error'); return; }
          UI.haptic(6);
          BM.sharecard.open(ctx, { mode: scBtn.getAttribute('data-sc-mode') || 'today' });
          return;
        }

        if (ev.target.closest('[data-act="beginner-open"]')) {
          ev.preventDefault();
          var begBtn = ev.target.closest('[data-act="beginner-open"]');
          if (BM.beginner) {
            BM.beginner.open({
              tab: begBtn.getAttribute('data-beg-tab') || 'intro',
              skill: begBtn.getAttribute('data-beg-skill') || ''
            });
          }
          UI.haptic(8);
          return;
        }

        if (ev.target.closest('[data-act="routine-pref-toggle"]')) {
          ev.preventDefault();
          var curPref = ctx.store.state.routinePref;
          var nextPref = curPref === true ? false : true;
          var resPref = ctx.actions.setRoutinePref(nextPref);
          if (resPref && resPref.ok) {
            UI.toast(nextPref ? '일지 화면에 4주 루틴을 보여줄게요' : '일지 화면에서 4주 루틴을 숨겼어요');
            UI.haptic(10);
          }
          return;
        }

        /* v1.40 — 내 유형 바꾸기 (초보 · 동호인 · 선수 · 코치) */
        var roleBtn = ev.target.closest('[data-role]');
        if (roleBtn) {
          ev.preventDefault();
          var roleId = roleBtn.getAttribute('data-role') || '';
          var roleDef = D.roleById(roleId);
          if (!roleDef) return;
          var roleRes = ctx.actions.setRole(roleId);
          if (roleRes && roleRes.ok && roleRes.saved === false) {
            UI.toast('이미 ' + roleDef.label + ' 유형으로 하고 있어요');
          } else if (roleRes && roleRes.ok) {
            UI.toast('내 유형을 ' + roleDef.label + ' 유형으로 바꿨어요 · ' + roleDef.desc);
            UI.haptic(12);
          } else if (roleRes && roleRes.reason === 'locked') {
            UI.toast('잠시만요, 처리 중이에요');
          } else {
            UI.toast('유형을 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
          }
          return;
        }

        /* v1.40 — 선수 7대 훈련 기록 보기/숨기기 */
        if (ev.target.closest('[data-act="pro-pref-toggle"]')) {
          ev.preventDefault();
          var st0 = ctx.store.state;
          var proNow = D.proVisible(st0.me, st0.proPref);
          var proRes = ctx.actions.setProPref(!proNow);
          if (proRes && proRes.ok) {
            UI.toast(!proNow ? '일지에 선수 7대 훈련을 보여줄게요' : '일지에서 선수 7대 훈련을 숨겼어요');
            UI.haptic(10);
          }
          return;
        }

        if (ev.target.closest('[data-act="checkin"]')) {
          ev.preventDefault();
          /* bm-v1.75.0 — 하트 적립은 서버가 합니다. 결과가 바로 오거나(기기 저장)
           * 서버 응답으로 올 수 있어(Supabase) U.when 으로 같은 문구를 씁니다. */
          U.when(ctx.actions.checkIn(), function (ci) {
            if (ci.ok) {
              /* 연속 보너스가 붙는 날(3·7·14·30일)은 토스트도 따로 — 부스트 보너스도 함께 알려 줍니다 */
              var parts = [];
              if (ci.bonus) parts.push(ci.streak + '일 연속! 보너스 +' + ci.bonus);
              if (ci.boost) parts.push('부스트 +' + ci.boost);
              UI.toast('출석 체크 완료 · 하트 +' + ci.gained + (parts.length ? ' (' + parts.join(' · ') + ')' : ''));
              UI.haptic(14);
            } else if (ci.reason === 'done') UI.toast('오늘은 이미 출석했어요');
            else if (ci.reason === 'locked') UI.toast('잠시만요');
            else if (ci.reason === 'offline') UI.toast('인터넷에 연결되면 출석할 수 있어요', 'error');
            else if (ci.reason === 'login') UI.toast('로그인이 풀렸어요. MY에서 다시 로그인해 주세요', 'error');
          });
          return;
        }
        /* 하트 부스트 — 열기(하트 3개) · 켜기 · 끄기 (bm-v1.64.0) */
        var boostBtn = ev.target.closest('[data-act="boost"]');
        if (boostBtn) {
          ev.preventDefault();
          runBoost(ctx, boostBtn.getAttribute('data-boost') === '1');
          return;
        }
        var adBtn = ev.target.closest('[data-act="ad"]');
        if (adBtn) {
          ev.preventDefault();
          if (adBtn.disabled || adBtn.classList.contains('is-busy')) return;   /* 연타·쿨다운 방지 */
          adBtn.classList.add('is-busy');
          playRewardAd().then(function (r) {
            adBtn.classList.remove('is-busy');
            if (!r || !r.rewarded) {
              if (r && r.busy) UI.toast('광고를 준비하고 있어요. 잠시만요');
              else UI.toast('광고를 끝까지 봐야 하트를 받을 수 있어요');
              return;
            }
            var res = ctx.actions.watchAd({ verified: true, adUnit: r.adUnit, txId: r.txId });
            U.when(res, function (res) {
              if (res.ok) {
                UI.toast('하트 +' + res.gained + (res.dailyBoost ? ' (오늘의 부스트 +' + res.dailyBoost + ' 포함)' : '') +
                  ' · 오늘 ' + res.remaining + '회 남음');
                UI.haptic(16);
              } else if (res.reason === 'limit') UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!');
              else if (res.reason === 'cooldown') UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
              else if (res.reason === 'duplicate') UI.toast('이미 받은 광고예요');
              else if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
              else if (res.reason === 'offline') UI.toast('인터넷에 연결되면 하트를 받을 수 있어요', 'error');
              else if (res.reason === 'login') UI.toast('로그인이 풀렸어요. MY에서 다시 로그인해 주세요', 'error');
            });
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
        if (ev.target.closest('[data-act="open-report"]')) {
          ev.preventDefault();
          UI.haptic(8);
          if (BM.report) BM.report.openFrom(ctx);
          return;
        }
        if (ev.target.closest('[data-act="decorate-sheet"]')) {
          ev.preventDefault();
          openDecorateSheet(ctx);
          return;
        }
        if (ev.target.closest('[data-act="decorate-avatar"]')) {
          ev.preventDefault();
          ev.stopPropagation();
          openDecorateSheet(ctx, { focus: 'avatar' });
          return;
        }
        if (ev.target.closest('[data-act="connect"]')) {
          ev.preventDefault();
          openConnectSheet(ctx);
          return;
        }
        if (ev.target.closest('[data-act="use-supabase"]')) {
          ev.preventDefault();
          if (!ctx.switchBackend) { UI.toast('이 화면에서는 바꿀 수 없어요', 'error'); return; }
          UI.toast('서버에 연결하는 중…');
          ctx.switchBackend('supabase').then(function (res) {
            if (res && res.ok) { UI.toast('실시간 서버에 연결됐어요'); ctx.refresh(); return; }
            if (res && res.needLogin) { UI.toast(res.message); return; }
            UI.toast((res && res.message) || '바꾸지 못했어요', 'error');
          });
          return;
        }
        if (ev.target.closest('[data-act="export"]')) {
          ev.preventDefault();
          exportJson(ctx);
          return;
        }
        /* v1.55 — 차단한 사람 해제 */
        var unblockBtn = ev.target.closest('[data-unblock]');
        if (unblockBtn) {
          ev.preventDefault();
          if (BM.safety) BM.safety.doUnblock(ctx, unblockBtn.getAttribute('data-unblock'));
          else ctx.actions.unblockUser(unblockBtn.getAttribute('data-unblock'));
          return;
        }
        if (ev.target.closest('[data-act="help"]')) {
          ev.preventDefault();
          openHelpSheet(ctx);
          return;
        }
        if (ev.target.closest('[data-act="change-password"]')) {
          ev.preventDefault();
          openPasswordSheet(ctx);
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
        if (ev.target.closest('[data-act="retry-dead"]')) {
          ev.preventDefault();
          if (ctx.actions.retryBlocked) ctx.actions.retryBlocked();
          UI.toast('건너뛴 저장을 다시 보내는 중이에요');
          return;
        }
        if (ev.target.closest('[data-act="clear-queue"]')) {
          ev.preventDefault();
          UI.confirm('보내지 못한 저장을 이 기기에서 비울까요? 서버에 이미 저장된 기록은 그대로예요.', '대기 중 비우기').then(function (ok) {
            if (!ok) return;
            if (!ctx.actions.clearQueue) return;
            var res = ctx.actions.clearQueue();
            UI.toast(res && res.cleared ? '보내지 못한 저장 ' + res.cleared + '건을 비웠어요' : '대기 중인 저장이 없어요');
          });
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

  /* 잠긴 꾸미기: 미리보기에서 하트로 열지 정하고, 열면 그대로 이어서 적용합니다 */

  /* 하트가 모자라면 공용 충전 시트를 열고, 채운 뒤에는 이미 확인한 구매를 바로 이어서 진행합니다 */
  function buyDeco(ctx, kind, value, onDone) {
    /* bm-v1.75.0 — Supabase 모드에서는 서버(RPC)가 잔액을 보고 차감합니다. 결과가 Promise 로 옵니다. */
    U.when(ctx.actions.buyDeco(kind, value), function (res) {
    if (res && res.ok) {
      UI.toast(res.purchased ? '하트 ' + res.price + '개로 열었어요' : '이미 열려 있어요');
      UI.haptic(12);
      onDone(res);
      return;
    }
    res = res || { ok: false, reason: 'error' };
    if (res.reason === 'offline' || res.reason === 'login') {
      UI.toast(res.message || '인터넷에 연결되면 열 수 있어요', 'error');
      onDone(res);
      return;
    }
    if (res.reason === 'hearts') {
      var d = decoOf(ctx.store.state, kind, value);
      var decoName = U.esc(D.decoName(d.id));
      var decoPrice = d.price || res.price || (res.need + ((ctx.store.state.data.hearts && ctx.store.state.data.hearts.balance) || 0));
      openHeartSheet(ctx, {
        need: decoPrice,
        intro: function (s) {
          return '<p class="sheet__text">' + decoName + ' — <b>하트 ' + decoPrice +
            '개</b>로 열 수 있어요. 지금 <b>' + s.balance + '개</b> 있어요.' +
            (s.balance < decoPrice ? ' <span class="warn">' + (decoPrice - s.balance) + '개 부족</span>' : '') + '</p>';
        },
        continueLabel: '열기',
        onContinue: function () { buyDeco(ctx, kind, value, onDone); }
      });
      return;
    }
    if (res.reason === 'locked') {
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

  /* ---------- 꾸미기 미리보기 → 1탭 해금 (bm-v1.47.0) ----------
   * 잠긴 테두리·배지를 누르면 바로 결제 확인을 띄우지 않고,
   * 내 사진·닉네임에 적용한 모습을 먼저 보여 줍니다(지금 ↔ 적용 후).
   *  · 하트가 충분하면 '하트 N개로 열기' 1탭으로 해금하고 꾸미기 화면으로 돌아갑니다.
   *  · 모자라면 '광고 보고 하트 +1' 로 바로 이어지고, 채워지면 그 자리에서 해금 버튼이 열립니다. */
  function decoSim(draft, kind, value) {
    var sim = {};
    Object.keys(draft || {}).forEach(function (k) { sim[k] = draft[k]; });
    if (kind === 'frame') sim.frame = value;
    else if (kind === 'badge') sim.badge = value;
    else if (kind === 'bg') sim.bg = value;
    return sim;
  }

  function balanceOf(ctx) {
    var h = (ctx.store.state.data && ctx.store.state.data.hearts) || {};
    return Math.max(0, Number(h.balance) || 0);
  }

  /* 미리보기 시트 본문 — shown:'now' 이면 지금 모습, 'next' 이면 적용 후 */
  function decoPreviewBody(ctx, d, draft, me, shown) {
    var live = liveHearts((ctx.store.state.data && ctx.store.state.data.hearts) || {});
    var view = shown === 'now' ? draft : decoSim(draft, d.kind, d.value);
    var have = balanceOf(ctx);
    var short = Math.max(0, d.price - have);
    var name = D.decoName(d.id) || '꾸미기';
    var meter = adLabel((ctx.store.state.data && ctx.store.state.data.hearts) || {});

    var toggle = '<div class="chips chips--wrap decoprev__seg" data-dpv-seg>' +
      '<button type="button" class="chip chip--sm' + (shown === 'now' ? ' is-on' : '') + '"' +
      ' data-dpv="now" aria-pressed="' + (shown === 'now' ? 'true' : 'false') + '">지금 모습</button>' +
      '<button type="button" class="chip chip--sm' + (shown === 'next' ? ' is-on' : '') + '"' +
      ' data-dpv="next" aria-pressed="' + (shown === 'next' ? 'true' : 'false') + '">적용 후</button>' +
      '</div>';

    var main;
    var hint = '';
    if (short <= 0) {
      main = '<button type="button" class="btn btn--primary grow" data-dpv-act="unlock">' +
        '하트 ' + d.price + '개로 열기</button>';
      hint = '지금 하트 <b>' + have + '개</b> — 한 번 열면 계속 써요.';
    } else if (live.adRemaining <= 0) {
      main = '<button type="button" class="btn btn--ghost grow" disabled>오늘 광고를 모두 봤어요</button>';
      hint = '하트 <b>' + short + '개</b>가 모자라요. 내일 다시 채우거나 출석으로 모아 주세요.';
    } else {
      main = '<button type="button" class="btn btn--primary grow" data-dpv-act="ad">' +
        '광고 보고 하트 +1</button>';
      hint = '하트 <b>' + short + '개</b> 부족 · ' + U.esc(meter);
    }

    return '<div class="decostudio">' +
        '<div class="decostudio__stage decoprev__stage">' +
        '<div class="decostudio__av" data-deco-preview>' + UI.avatar(view, 112) + '</div>' +
        '<div class="decostudio__id"><strong>' + U.esc(view.nick || me.nick || '회원') + '</strong>' +
        '<div class="decostudio__pills">' + decoPills(view) +
        '<span class="pill pill--ghost">' + U.esc(name) + '</span></div>' +
        '<p class="decostudio__meta">' + U.esc(decoMeta(view)) + '</p>' +
        '</div></div></div>' +
      toggle +
      '<p class="sheet__text">' + (short <= 0
        ? '하트 <b>' + d.price + '개</b>로 열 수 있어요. 지금 <b>' + have + '개</b> 있어요.'
        : '하트 <b>' + d.price + '개</b>가 필요해요. 지금 <b>' + have + '개</b> — <span class="warn">' + short + '개 부족</span>') + '</p>' +
      '<div class="row gap8 mt16">' +
        '<button type="button" class="btn btn--ghost' + (short <= 0 ? ' grow' : '') + '" data-dpv-act="close">닫기</button>' +
        main +
      '</div>' +
      '<p class="hint" data-dpv-meter>' + hint + '</p>';
  }

  function openDecoPreviewSheet(ctx, kind, value, draft, onDone) {
    draft = draft || decorateDraft(ctx.store.state);
    var d = decoOf(ctx.store.state, kind, value);
    d.kind = kind;
    d.value = value;
    if (!d.id) { UI.toast('알 수 없는 꾸미기예요', 'error'); return null; }
    if (d.owned) { if (onDone) onDone({ ok: true, purchased: false }); return null; }

    var me = ctx.store.state.me || {};
    var shown = 'next';
    var busy = false;

    /* 미리보기만 닫고, 아래에서 열려 있던 '프로필 꾸미기'로 돌아갑니다.
     * (시트는 한 번에 하나만 그리기 때문에 닫는 순간 꾸미기 창이 사라지면
     *  MY 첫 화면으로 튕긴 것처럼 보입니다) */
    function back(res) {
      UI.closeSheet();
      if (onDone) { onDone(res || { ok: false }); return; }
      if (ctx && ctx.refresh) ctx.refresh();
    }

    function open() {
      var wrap = UI.openSheet({
        title: '미리보기 · ' + (D.decoName(d.id) || '꾸미기'),
        body: decoPreviewBody(ctx, d, draft, me, shown),
        onMount: function (node) {
          /* 위 ×·바깥 누름도 '닫기'와 같게 — 미리보기만 닫습니다 (capture로 먼저 받기) */
          node.addEventListener('click', function (ev) {
            if (busy) return;
            if (!ev.target.closest || !ev.target.closest('[data-close]')) return;
            ev.preventDefault();
            ev.stopPropagation();
            back({ ok: false });
          }, true);
          node.addEventListener('click', function (ev) {
            var seg = ev.target.closest('[data-dpv]');
            if (seg) {
              ev.preventDefault();
              shown = seg.getAttribute('data-dpv') === 'now' ? 'now' : 'next';
              UI.haptic(5);
              open();
              return;
            }
            var act = ev.target.closest('[data-dpv-act]');
            if (!act) return;
            ev.preventDefault();
            if (busy) return;
            var what = act.getAttribute('data-dpv-act');

            if (what === 'close') { back({ ok: false }); return; }

            if (what === 'unlock') {
              busy = true;
              act.disabled = true;
              buyDeco(ctx, kind, value, function (res) {
                busy = false;
                if (res && res.ok) {
                  back(res);
                  return;
                }
                /* 취소·잠금·오류 — 시트를 그대로 두고 숫자만 다시 */
                if (res && res.reason === 'hearts') { open(); return; }
                if (res && res.reason === 'cancelled') { open(); return; }
                UI.closeSheet();
              });
              return;
            }

            if (what === 'ad') {
              if (!BM.ads || typeof BM.ads.watchForHeart !== 'function') {
                UI.toast('지금은 광고를 볼 수 없어요', 'error');
                return;
              }
              busy = true;
              act.disabled = true;
              BM.ads.watchForHeart(ctx).then(function (res) {
                busy = false;
                if (res && res.ok) { open(); return; }
                if (res && res.reason === 'cooldown') { UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요'); open(); return; }
                if (res && res.reason === 'limit') { UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!'); open(); return; }
                if (res && res.reason === 'cancel') { open(); return; }
                if (res && res.reason === 'duplicate') { UI.toast('이미 받은 광고예요'); open(); return; }
                if (res && res.reason === 'busy') { UI.toast('광고를 준비하고 있어요. 잠시만요'); return; }
                if (res && res.reason === 'locked') { UI.toast('잠시만요, 처리 중이에요'); return; }
                UI.toast('지금은 광고를 볼 수 없어요. 잠시 후 다시 시도해 주세요');
                open();
              });
            }
          });
        }
      });
      return wrap;
    }

    return open();
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

  /* ---------- 프로필 꾸미기 (한 곳에서) ----------
   * 실력·성별·플레이 스타일·주 체육관·활동 지역·한 줄 소개·사진/프레임/배경/배지를
   * 한 시트에서 고치고 저장합니다. 저장 값은 프로필(꾸미기 JSON)과
   * 매칭프로필(payload JSON)에 함께 들어가 시트 26칸은 그대로입니다. */
  function decorateDraft(state) {
    var me = state.me || {};
    var mp = myMatchProfile(state);
    var av = myAvatar(me);
    /* 체험 모드의 자리표시(일반회원·복식)가 아니라 실제로 저장된 값만 씁니다 */
    var idx = state.idx || (state.data && state.data.idx) || null;
    var prof = (idx && D.profileOf(idx, me.key)) || {};
    var rawLevel = mp.level || prof.level || '';
    var level = D.normalizeGrade(rawLevel);
    return {
      nick: me.nick || '',
      photo: av.photo, emoji: av.emoji, frame: av.frame, bg: av.bg, badge: av.badge,
      level: level,
      discipline: mp.discipline || prof.discipline || '',
      gender: D.normalizeGender(mp.gender || me.gender),
      style: styleOf(state, me, mp),
      region: mp.region || me.region || '',
      club: mp.club || me.club || '',
      bio: me.bio || mp.bio || ''
    };
  }

  function decoPills(draft) {
    return ((draft.level) ? '<span class="pill pill--grade">' + U.esc(draft.level) + '</span>' : '') +
      genderPillOf(draft.gender) + stylePillOf(draft.style);
  }

  function decoMeta(draft) {
    return [draft.region, draft.club].filter(Boolean).join(' · ') || '지역 · 체육관';
  }

  function decoPreview(draft, me) {
    return '<div class="decostudio__stage">' +
      '<div class="decostudio__av" data-deco-preview>' + UI.avatar(draft, 96) + '</div>' +
      '<div class="decostudio__id"><strong>' + U.esc(draft.nick || me.nick || '회원') + '</strong>' +
      '<div class="decostudio__pills" data-deco-pills>' + decoPills(draft) + '</div>' +
      '<p class="decostudio__meta" data-deco-meta>' + U.esc(decoMeta(draft)) + '</p>' +
      '</div></div>';
  }

  function decoChips(field, values, current, opts) {
    opts = opts || {};
    return '<div class="chips chips--wrap" data-dgroup="' + U.esc(field) + '">' + values.map(function (v) {
      var on = current === v;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '"' +
        ' data-dfield="' + U.esc(field) + '" data-dval="' + U.esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        U.esc(v) + '</button>';
    }).join('') + (opts.note ? '<span class="decostudio__note">' + U.esc(opts.note) + '</span>' : '') + '</div>';
  }

  function decorateBody(draft, me, state) {
    return '<div class="decostudio">' +
      decoPreview(draft, me) +

      '<h4 class="avstudio__label" data-sec="nick">닉네임</h4>' +
      '<input class="deco__input" type="text" data-dtext="nick" maxlength="12" autocomplete="off" value="' + U.esc(draft.nick) + '">' +

      '<h4 class="avstudio__label" data-sec="avatar">사진 · 프레임</h4>' +
      '<div class="decostudio__acts">' +
      '<button type="button" class="btn btn--primary btn--sm" data-act="deco-photo">' + UI.icon('camera') + '사진 올리기</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="deco-clear"' + (draft.photo ? '' : ' disabled') + '>' + UI.icon('trash') + '사진 지우기</button>' +
      '</div>' +
      '<p class="deco__sub" data-sub="frame">프레임</p>' +
      '<div class="pickgrid pickgrid--frame">' + frames().map(function (f) {
        var df = decoOf(state, 'frame', f.id);
        return '<button type="button" class="framepick' + (draft.frame === f.id ? ' is-on' : '') + (df.owned ? '' : ' is-locked') + '"' +
          ' data-dframe="' + U.esc(f.id) + '" aria-pressed="' + (draft.frame === f.id ? 'true' : 'false') + '"' +
          ' title="' + U.esc(f.name + (df.owned ? '' : ' · 하트 ' + df.price + '개로 해금')) + '">' +
          '<span class="framepick__dot framepick__dot--' + U.esc(f.id) + '"></span>' +
          '<span class="framepick__name">' + U.esc(f.name) + '</span>' + lockTag(df) + '</button>';
      }).join('') + '</div>' +
      '<p class="deco__sub" data-sub="bg">배경</p>' +
      '<div class="pickgrid pickgrid--bg">' + bgs().map(function (b) {
        return '<button type="button" class="bgpick' + (draft.bg === b.id ? ' is-on' : '') + '" data-dbg="' + U.esc(b.id) + '"' +
          ' aria-pressed="' + (draft.bg === b.id ? 'true' : 'false') + '">' +
          '<span class="bgpick__dot bgpick__dot--' + U.esc(b.id) + '"></span>' +
          '<span class="bgpick__name">' + U.esc(b.name) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="deco__sub" data-sub="emoji">아이콘</p>' +
      '<div class="pickgrid pickgrid--emoji">' + AVATARS.map(function (a) {
        return '<button type="button" class="avataropt' + (draft.emoji === a ? ' is-on' : '') + '" data-demoji="' + U.esc(a) + '"' +
          ' aria-pressed="' + (draft.emoji === a ? 'true' : 'false') + '">' + U.esc(a) + '</button>';
      }).join('') + '</div>' +
      '<p class="deco__sub" data-sub="badge">배지</p>' +
      '<div class="pickgrid pickgrid--badge">' + badges().map(function (b) {
        var db = decoOf(state, 'badge', b);
        return '<button type="button" class="badgeopt' + (draft.badge === b ? ' is-on' : '') + (db.owned ? '' : ' is-locked') + '"' +
          ' data-dbadge="' + U.esc(b) + '" aria-pressed="' + (draft.badge === b ? 'true' : 'false') + '"' +
          ' title="' + U.esc((b ? D.decoName(db.id) : '배지 없음') + (db.owned ? '' : ' · 하트 ' + db.price + '개로 해금')) + '">' +
          (b ? U.esc(b) : '없음') + lockTag(db) + '</button>';
      }).join('') + '</div>' +

      /* 하트 부스트 — 출석·광고 적립을 늘리는 꾸미기 (bm-v1.64.0).
       * 꾸미기 상점과 같은 자리에서 열고 켜고 끕니다(시트는 그 자리에서 다시 그립니다). */
      '<p class="deco__sub" data-sub="boost">하트 부스트</p>' +
      boostLine(state.data && state.data.hearts) +

      '<h4 class="avstudio__label" data-sec="level">실력(급수)</h4>' +
      decoChips('level', D.VOCAB.grades, draft.level) +

      '<h4 class="avstudio__label" data-sec="gender">성별</h4>' +
      decoChips('gender', D.VOCAB.genders, draft.gender) +

      '<h4 class="avstudio__label" data-sec="discipline">주력 종목</h4>' +
      decoChips('discipline', D.VOCAB.disciplines, draft.discipline) +

      '<h4 class="avstudio__label" data-sec="style">플레이 스타일</h4>' +
      decoChips('style', D.VOCAB.styles, draft.style, { note: '한 번 더 누르면 해제' }) +

      '<h4 class="avstudio__label" data-sec="club">주 체육관</h4>' +
      '<div class="deco__clubrow">' +
      '<input class="deco__input" type="text" data-dtext="club" maxlength="20" autocomplete="off"' +
      ' placeholder="자주 가는 체육관 이름" value="' + U.esc(draft.club) + '">' +
      '<button type="button" class="btn btn--ghost btn--sm deco__clubmap" data-act="deco-club-map">' +
      UI.icon('pin') + '지도에서 고르기</button></div>' +

      '<h4 class="avstudio__label" data-sec="region">활동 지역</h4>' +
      decoChips('region', D.VOCAB.regions, draft.region) +

      '<h4 class="avstudio__label" data-sec="bio">한 줄 소개</h4>' +
      '<input class="deco__input" type="text" data-dtext="bio" maxlength="60" autocomplete="off"' +
      ' placeholder="어떤 플레이를 좋아하는지 한 줄로" value="' + U.esc(draft.bio) + '">' +
      '</div>' +
      '<div class="deco__savebar"><button class="btn btn--primary btn--big" data-act="deco-save">저장</button></div>' +
      '<p class="hint">저장하면 MY 카드와 1:1 매칭 프로필에 바로 반영돼요.</p>';
  }

  /* 시트 본문을 보던 자리 — 미리보기를 닫고 돌아올 때 그 자리로 */
  function sheetScrollOf(node) {
    var body = node && node.querySelector ? node.querySelector('.sheet__body') : null;
    return body ? (body.scrollTop || 0) : 0;
  }

  function paintDecoPreview(node, draft) {
    var av = node.querySelector('[data-deco-preview]');
    if (av) av.innerHTML = UI.avatar(draft, 96);
    var pills = node.querySelector('[data-deco-pills]');
    if (pills) pills.innerHTML = decoPills(draft);
    var meta = node.querySelector('[data-deco-meta]');
    if (meta) meta.textContent = decoMeta(draft);
    var name = node.querySelector('.decostudio__id strong');
    if (name) name.textContent = draft.nick || '회원';
    var clear = node.querySelector('[data-act="deco-clear"]');
    if (clear) clear.disabled = !draft.photo;
  }

  function saveDecorate(ctx, draft) {
    var state = ctx.store.state;
    var me = state.me || {};
    var mp = myMatchProfile(state);
    var res = ctx.actions.saveProfile({
      nick: String(draft.nick || '').trim() || me.nick,
      level: draft.level, discipline: draft.discipline || me.discipline || mp.discipline || '',
      gender: draft.gender, region: draft.region, club: draft.club, bio: draft.bio,
      style: draft.style, avatar: draft.emoji, avatarPhoto: draft.photo,
      avatarFrame: draft.frame, avatarBg: draft.bg, avatarBadge: draft.badge
    });
    if (!res || !res.ok) return res || { ok: false };
    ctx.actions.saveMatchProfile({
      region: draft.region, level: draft.level,
      discipline: draft.discipline || mp.discipline || me.discipline || '복식', club: draft.club,
      availability: mp.availability || '', experience: mp.experience || '',
      bio: draft.bio, gender: draft.gender, style: draft.style,
      avatar: draft.emoji, avatarPhoto: draft.photo, avatarFrame: draft.frame,
      avatarBg: draft.bg, avatarBadge: draft.badge
    });
    return res;
  }

  function openDecorateSheet(ctx, opts) {
    opts = opts || {};
    var state = ctx.store.state;
    var me = state.me || {};
    var draft = opts.draft || decorateDraft(state);
    var focus = opts.focus || '';
    /* 미리보기를 닫고 돌아올 때: 보던 스크롤 위치를 그대로 되살립니다 */
    var backAt = Math.max(0, Number(opts.scroll) || 0);

    var wrap = UI.openSheet({
      title: '프로필 꾸미기',
      body: decorateBody(draft, me, state),
      onMount: function (node) {
        if (backAt) {
          var body = node.querySelector('.sheet__body');
          if (body) body.scrollTop = backAt;
        }
        if (focus) {
          setTimeout(function () {
            var sec = node.querySelector('[data-sec="' + focus + '"]');
            if (sec && sec.scrollIntoView) sec.scrollIntoView({ block: 'start' });
          }, 120);
        }
        node.addEventListener('click', function (ev) {
          /* 하트 부스트 — 꾸미기 시트 안에서 열고 켜고 끄기 (bm-v1.64.0) */
          if (ev.target.closest('[data-act="boost"]')) {
            ev.preventDefault();
            var wantBoost = ev.target.closest('[data-act="boost"]').getAttribute('data-boost') === '1';
            var at = sheetScrollOf(node);
            runBoost(ctx, wantBoost, function () {
              openDecorateSheet(ctx, { draft: draft, scroll: at });
            });
            return;
          }
          var chip = ev.target.closest('[data-dfield]');
          if (chip) {
            ev.preventDefault();
            var field = chip.getAttribute('data-dfield');
            var val = chip.getAttribute('data-dval');
            /* 한 번 더 누르면 해제 (플레이 스타일) */
            draft[field] = (field === 'style' && draft.style === val) ? '' : val;
            var group = chip.closest('[data-dgroup]');
            if (group) {
              Array.prototype.forEach.call(group.querySelectorAll('[data-dfield]'), function (b) {
                var on = b.getAttribute('data-dval') === draft[field];
                b.classList.toggle('is-on', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
              });
            }
            paintDecoPreview(node, draft);
            UI.haptic(5);
            return;
          }
          var fr = ev.target.closest('[data-dframe]');
          if (fr) {
            ev.preventDefault();
            var fid = fr.getAttribute('data-dframe');
            var df = decoOf(ctx.store.state, 'frame', fid);
            if (!df.owned) {
              /* 잠긴 프레임 → 미리보기. 닫으면 이 꾸미기 창을 보던 자리로 돌려놓습니다 */
              var atFrame = sheetScrollOf(node);
              openDecoPreviewSheet(ctx, 'frame', fid, draft, function (res) {
                if (res && res.ok) draft.frame = fid;
                openDecorateSheet(ctx, { draft: draft, scroll: atFrame });
              });
              return;
            }
            draft.frame = fid;
            Array.prototype.forEach.call(node.querySelectorAll('[data-dframe]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-dframe') === fid);
              b.setAttribute('aria-pressed', b.getAttribute('data-dframe') === fid ? 'true' : 'false');
            });
            paintDecoPreview(node, draft);
            UI.haptic(5);
            return;
          }
          var bg = ev.target.closest('[data-dbg]');
          if (bg) {
            ev.preventDefault();
            draft.bg = bg.getAttribute('data-dbg');
            Array.prototype.forEach.call(node.querySelectorAll('[data-dbg]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-dbg') === draft.bg);
              b.setAttribute('aria-pressed', b.getAttribute('data-dbg') === draft.bg ? 'true' : 'false');
            });
            paintDecoPreview(node, draft);
            UI.haptic(5);
            return;
          }
          var em = ev.target.closest('[data-demoji]');
          if (em) {
            ev.preventDefault();
            draft.emoji = em.getAttribute('data-demoji');
            Array.prototype.forEach.call(node.querySelectorAll('[data-demoji]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-demoji') === draft.emoji);
              b.setAttribute('aria-pressed', b.getAttribute('data-demoji') === draft.emoji ? 'true' : 'false');
            });
            paintDecoPreview(node, draft);
            UI.haptic(5);
            return;
          }
          var bd = ev.target.closest('[data-dbadge]');
          if (bd) {
            ev.preventDefault();
            var bid = bd.getAttribute('data-dbadge');
            var db = decoOf(ctx.store.state, 'badge', bid);
            if (!db.owned) {
              var atBadge = sheetScrollOf(node);
              openDecoPreviewSheet(ctx, 'badge', bid, draft, function (res) {
                if (res && res.ok) draft.badge = bid;
                openDecorateSheet(ctx, { draft: draft, scroll: atBadge });
              });
              return;
            }
            draft.badge = bid;
            Array.prototype.forEach.call(node.querySelectorAll('[data-dbadge]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-dbadge') === bid);
              b.setAttribute('aria-pressed', b.getAttribute('data-dbadge') === bid ? 'true' : 'false');
            });
            paintDecoPreview(node, draft);
            UI.haptic(5);
            return;
          }
          /* 주 체육관 칸의 '지도에서 고르기' — 고른 이름을 칸과 미리보기에 바로 넣습니다 */
          if (ev.target.closest('[data-act="deco-club-map"]')) {
            ev.preventDefault();
            if (!BM.views || !BM.views.gyms) return;
            BM.views.gyms.open(ctx, {
              onPick: function (v) {
                if (!v) return;
                draft.club = v.name;
                var inp = node.querySelector('[data-dtext="club"]');
                if (inp) inp.value = v.name;
                paintDecoPreview(node, draft);
                UI.toast(v.name + ' · 주 체육관 칸에 넣었어요');
              }
            });
            return;
          }
          if (ev.target.closest('[data-act="deco-photo"]')) {
            ev.preventDefault();
            pickPhotoFile(function (url) {
              draft.photo = url;
              paintDecoPreview(node, draft);
              UI.toast('사진을 넣었어요. 저장을 누르면 적용돼요');
            }, function (msg) { UI.toast(msg, 'error'); });
            return;
          }
          if (ev.target.closest('[data-act="deco-clear"]')) {
            ev.preventDefault();
            draft.photo = '';
            paintDecoPreview(node, draft);
            return;
          }
          if (ev.target.closest('[data-act="deco-save"]')) {
            ev.preventDefault();
            Array.prototype.forEach.call(node.querySelectorAll('[data-dtext]'), function (inp) {
              draft[inp.getAttribute('data-dtext')] = inp.value.trim();
            });
            var res = saveDecorate(ctx, draft);
            if (!res.ok) {
              UI.toast(res.reason === 'locked' ? '잠시만요, 저장 중이에요' : '저장하지 못했어요', 'error');
              return;
            }
            UI.closeSheet();
            UI.toast('프로필을 꾸몄어요');
            UI.haptic(14);
            if (ctx.refresh) ctx.refresh();
          }
        });
        node.addEventListener('input', function (ev) {
          var inp = ev.target.closest('[data-dtext]');
          if (!inp) return;
          draft[inp.getAttribute('data-dtext')] = inp.value;
          paintDecoPreview(node, draft);
        });
      }
    });
    return wrap;
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
        '<li>커뮤니티 <b>게스트 모집</b> 글의 <b>참여 문의</b>는 그 글 전용 <b>단체방</b>에서 이어져요.</li>' +
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

  /* ---------- 비밀번호 변경 (서버 계정 · 로그인 상태) ----------
   *  Supabase Auth 의 PUT /user 로 바꿉니다. 앱은 비밀번호를 저장하지 않아요. */
  function openPasswordSheet(ctx) {
    return UI.openSheet({
      title: '비밀번호 변경',
      body: '<p class="sheet__text">새 비밀번호를 정해 주세요. 다음 로그인부터 적용돼요.</p>' +
        '<label class="flabel">새 비밀번호<input type="password" autocomplete="new-password" data-pw="new" placeholder="6자 이상"></label>' +
        '<label class="flabel">한 번 더<input type="password" autocomplete="new-password" data-pw="new2" placeholder="같은 비밀번호"></label>' +
        '<p class="start__error" data-pw="err" style="display:none"></p>' +
        '<div class="row gap8 mt16"><button type="button" class="btn btn--ghost grow" data-close>취소</button>' +
        '<button type="button" class="btn btn--primary grow" data-pw="save">변경</button></div>',
      onMount: function (node) {
        function show(m) {
          var err = node.querySelector('[data-pw="err"]');
          if (err) { err.textContent = m; err.style.display = ''; }
        }
        node.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-pw="save"]');
          if (!btn) return;
          ev.preventDefault();
          var a = node.querySelector('[data-pw="new"]').value;
          var b = node.querySelector('[data-pw="new2"]').value;
          if (String(a).length < 6) { show('비밀번호는 6자 이상으로 정해 주세요.'); return; }
          if (a !== b) { show('두 비밀번호가 달라요.'); return; }
          if (btn.dataset.busy === '1') return;
          btn.dataset.busy = '1';
          btn.disabled = true;
          var label = btn.textContent;
          btn.textContent = '변경 중…';
          BM.auth.changePassword(a).then(function (res) {
            btn.dataset.busy = '0';
            btn.disabled = false;
            btn.textContent = label;
            if (res && res.ok) { UI.closeSheet(); UI.toast('비밀번호를 바꿨어요'); return; }
            show((res && res.message) || '비밀번호를 바꾸지 못했어요.');
          }, function () {
            btn.dataset.busy = '0';
            btn.disabled = false;
            btn.textContent = label;
            show('비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.');
          });
        });
      }
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
        (guest ? '' : (BM.auth.hasSupabaseAuth()
          ? ' 서버에 있는 내 기록과 <b>로그인 계정</b>이 함께 삭제되고, 같은 이메일로 다시 가입할 수 있어요.'
          : ' 시트(서버)에 있는 내 기록도 함께 지워집니다.')) + '</p>' +
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

  /* MY > 데이터 연결 > 구글 시트 연결
   *  주소·이메일은 미리 채워 둡니다 — 사용자가 /exec 주소를 찾아 넣지 않아도 되게.
   *  (다른 브리지를 쓰는 사람은 채워진 주소만 바꾸면 됩니다) */
  function connectDefaults() {
    var saved = BM.api.savedSession() || {};
    var mine = (BM.auth && typeof BM.auth.session === 'function' ? BM.auth.session() : null) || {};
    var auth = BM.auth || {};
    var url = saved.url || (typeof auth.bridgeUrl === 'function' ? auth.bridgeUrl() : '') || '';
    /* 체험(게스트) 세션의 '체험 사용자'는 시트 계정이 아니므로 이메일·닉네임은 비워 둡니다 */
    var real = mine.kind && mine.kind !== 'guest';
    return {
      url: String(url || ''),
      email: real ? String(mine.email || '') : '',
      nick: real ? String(mine.name || '') : ''
    };
  }

  function openConnectSheet(ctx) {
    var def = connectDefaults();
    UI.openSheet({
      title: '구글 시트 연결',
      body: '<p class="sheet__text">기본 연결 주소가 채워져 있어요. 다른 브리지를 쓸 때만 바꿔 주세요. ' +
        '메일과 비밀번호는 브리지에서만 확인되고, 비밀번호는 해시로 저장됩니다.</p>' +
        '<label class="flabel">웹 앱 URL (…/exec)<input type="url" data-c="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + U.esc(def.url) + '"></label>' +
        '<label class="flabel">이메일<input type="email" data-c="email" inputmode="email" placeholder="you@example.com" value="' + U.esc(def.email) + '"></label>' +
        '<label class="flabel">비밀번호<input type="password" data-c="password" placeholder="처음이면 새 비밀번호로 가입"></label>' +
        '<label class="flabel">닉네임 (처음 가입 시)<input type="text" data-c="nick" maxlength="12" placeholder="시트에 표시될 이름" value="' + U.esc(def.nick) + '"></label>' +
        '<div class="row gap8 mt16"><button class="btn btn--ghost grow" data-close>취소</button>' +
        '<button class="btn btn--primary grow" data-act="do-connect">연결</button></div>',
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-act="do-connect"]');
          if (!btn) return;
          ev.preventDefault();
          /* 손가락 연타: 연결 요청이 두 번 나가지 않게 버튼을 잠급니다 */
          if (btn.dataset.busy === '1') return;
          var url = wrap.querySelector('[data-c="url"]').value.trim();
          var email = wrap.querySelector('[data-c="email"]').value.trim();
          var password = wrap.querySelector('[data-c="password"]').value;
          var nick = wrap.querySelector('[data-c="nick"]').value.trim();
          if (!url || !email || !password) { UI.toast('주소·이메일·비밀번호를 모두 입력해 주세요'); return; }
          btn.dataset.busy = '1';
          btn.disabled = true;
          var label = btn.textContent;
          btn.textContent = '연결 중…';
          function release() {
            btn.dataset.busy = '0';
            btn.disabled = false;
            btn.textContent = label;
          }
          UI.toast('연결하는 중…');
          ctx.connectSheets(url, email, password, nick).then(function (res) {
            if (res.ok) { UI.closeSheet(); UI.toast('시트와 연결됐어요'); return; }
            release();
            UI.toast(res.message || '연결하지 못했어요', 'error');
          }, function () {
            release();
            UI.toast('연결하지 못했어요', 'error');
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
  BM.views.my.decorateDraft = decorateDraft;   /* 테스트·점검용 (꾸미기 시트 초기값) */
  BM.views.my.decorateBody = decorateBody;     /* 테스트·점검용 (꾸미기 시트 본문) */
  BM.views.my.openConnectSheet = openConnectSheet;   /* 테스트·점검용 (시트 연결 기본값) */
  BM.views.my.dataPanel = dataPanel;                 /* 테스트·점검용 (v1.55: 일반 사용자 숨김/접힘) */
  BM.views.my.blockPanel = blockPanel;               /* 테스트·점검용 (v1.55: 차단한 사람 목록) */
  BM.views.my.connectDefaults = connectDefaults;     /* 테스트·점검용 (기본 채움 값) */
  BM.views.my.alarmPanel = alarmPanel;               /* 테스트·점검용 (알림·편지지 설정) */
  BM.views.my.prefRow = prefRow;                     /* 테스트·점검용 */
  BM.views.my.pushRow = pushRow;                     /* 테스트·점검용 (v1.57 푸시 알림 상태) */
  BM.views.my.sharePanel = sharePanel;               /* 테스트·점검용 (v1.57 인스타 공유 카드) */
  BM.views.my.heartCard = heartCard;                 /* 테스트·점검용 (하트 카드·보너스 줄) */
  BM.views.my.decoPreviewBody = decoPreviewBody;     /* 테스트·점검용 (꾸미기 미리보기 본문) */
  BM.views.my.openDecoPreviewSheet = openDecoPreviewSheet;   /* 테스트·점검용 */
  BM.views.my.streakBonusLine = streakBonusLine;     /* 테스트·점검용 (7일 연속 보너스 줄) */
  BM.views.my.dailyBoostLine = dailyBoostLine;       /* 테스트·점검용 (오늘의 하트 부스트 줄) */
  BM.views.my.streakLine = streakLine;
})(typeof globalThis !== 'undefined' ? globalThis : this);
