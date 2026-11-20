/* ============================================================
 * ads.js — 보상형 광고 어댑터 (BM.ads) + 공용 하트 충전 시트
 *
 * 원칙
 *  1) 실제 보상은 광고를 끝까지 본 신호(verified)로만 지급합니다.
 *     (지급 자체는 store.actions.watchAd 가 한도·간격·중복을 다시 검사)
 *  2) 앱(안드로이드 WebView / iOS)이 광고 SDK를 들고 있으면 그쪽에 맡깁니다.
 *     네이티브는 다 본 뒤 window.BM.app.onRewardAdResult(true, 광고ID)로 알려 줍니다.
 *  3) 웹·PWA에서는 같은 흐름을 3초짜리 미리보기 시트로 재현합니다.
 *     실제 광고가 아니라는 점을 화면에 그대로 적고, 중간에 닫으면 지급하지 않습니다.
 *  4) 한 번에 하나만 — 광고 시트가 떠 있거나 네이티브 응답을 기다리는 동안
 *     다시 부르면 새 창을 띄우지 않고 busy 결과를 돌려줍니다(연타로 창이 겹치지 않게).
 *  5) 하트가 모자란 모든 자리(매칭 신청·하트 선물·유료 테마·프레임/배지 해금)는
 *     openHeartSheet 하나로 모읍니다. 시트 안에서 출석·광고를 바로 받고,
 *     필요 하트를 채우면 원래 하려던 동작으로 이어집니다.
 *
 * AdMob 연결(출시 시)
 *  - Android: WebView에 window.AndroidBridge.showRewardedAd(adUnit) 를 추가하고
 *    광고 콜백에서 evaluateJavascript("BM.app.onRewardAdResult(true,'heart_reward')").
 *  - 광고 단위 ID는 BM.ads.setUnits({ heart_reward: 'ca-app-pub-…/…' }) 로 넣습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util || {};

  var PREVIEW_SEC = 3;                 /* 웹 미리보기 길이 */
  var NATIVE_TIMEOUT_MS = 90 * 1000;   /* 광고가 안 돌아올 때 화면이 잠기지 않게 */
  var units = { heart_reward: 'heart_reward' };

  /* 진행 중인 보상형 광고 요청의 Promise (중복 실행 잠금) */
  var inFlight = null;

  function bridge() {
    if (typeof root === 'undefined' || !root) return null;
    var cands = [root.AndroidBridge, root.BadmintonNative];
    for (var i = 0; i < cands.length; i++) {
      var b = cands[i];
      if (b && typeof b.showRewardedAd === 'function') return b;
    }
    return null;
  }

  function available() {
    return { native: !!bridge(), preview: true };
  }

  function setUnits(map) {
    Object.keys(map || {}).forEach(function (k) { if (map[k]) units[k] = String(map[k]); });
    return units;
  }

  function unitOf(name) {
    return units[name] || units.heart_reward;
  }

  function rules() {
    return (BM.domain && BM.domain.HEART_RULES) || {
      CHECKIN: 1, AD_REWARD: 1, AD_PER_DAY: 5, AD_COOLDOWN_SEC: 30, MATCH_COST: 2
    };
  }

  function numVal(v, dflt) {
    var n = Number(v);
    return isFinite(n) ? n : dflt;
  }

  function escText(v) {
    if (U && typeof U.esc === 'function') return U.esc(String(v == null ? '' : v));
    return String(v == null ? '' : v);
  }

  /* ---------- 실시간 하트 상태 (시트·MY 카드 공용) ----------
   * domain.heartStatus 는 화면을 그린 순간의 값이라, 쿨타임이 지나도 숫자가 멈춰 있습니다.
   * getStatus 는 nextAdAt(절대 시각)을 now와 비교해 매초 다시 계산합니다. */
  function getStatus(heartStatus, nowMs) {
    var h = heartStatus || {};
    var R = rules();
    var now = numVal(nowMs, Date.now());

    var limit = Math.max(0, numVal(h.adLimit, R.AD_PER_DAY));
    var used = Math.max(0, numVal(h.adUsedToday, 0));
    var remaining = Math.max(0, limit - used);

    var nextAt = numVal(h.nextAdAt, 0);
    var left = nextAt > 0
      ? Math.max(0, Math.ceil((nextAt - now) / 1000))
      : Math.max(0, Math.ceil(numVal(h.nextAdInSec, 0)));

    var checkinReward = numVal(h.checkinReward, R.CHECKIN);
    var adReward = numVal(h.adReward, R.AD_REWARD);
    var canCheckIn = !!h.canCheckIn;

    return {
      balance: numVal(h.balance, 0),

      checkinReward: checkinReward,
      checkedInToday: !!h.checkedInToday,
      canCheckIn: canCheckIn,

      adReward: adReward,
      adLimit: limit,
      adUsedToday: used,
      adRemaining: remaining,
      adCooldownSec: numVal(h.adCooldownSec, R.AD_COOLDOWN_SEC),
      nextAdInSec: left,
      canWatchAd: remaining > 0 && left <= 0,

      /* 오늘 아직 받을 수 있는 무료 하트·받을 수 있는 횟수 (출석 + 광고) */
      freeHeartsLeft: (canCheckIn ? checkinReward : 0) + remaining * adReward,
      freeChancesLeft: (canCheckIn ? 1 : 0) + remaining
    };
  }

  /* 광고 줄에 쓰는 한 줄 — 남은 초가 있으면 1초마다 이 문구가 바뀝니다 */
  function adText(s) {
    if (!s || !s.adRemaining) return '오늘 모두 받았어요';
    if (s.nextAdInSec > 0) return '다음 광고까지 ' + s.nextAdInSec + '초';
    return '남은 ' + s.adRemaining + '회';
  }

  function freeText(s) {
    if (!s) return '';
    if (s.freeHeartsLeft <= 0) return '오늘 무료 하트를 모두 받았어요';
    return '오늘 받을 수 있는 무료 하트 ' + s.freeHeartsLeft + '개 남음';
  }

  function freeDetail(s) {
    if (!s) return '';
    var parts = [
      s.canCheckIn ? '출석 ' + s.checkinReward : '출석 완료'
    ];
    if (s.adRemaining > 0) parts.push('광고 ' + s.adRemaining + '회');
    else if (s.adLimit > 0) parts.push('광고 완료');
    return '(' + parts.join(' · ') + ')';
  }

  /* ---------- 보상형 광고 재생 ---------- */

  /* 네이티브 광고: app.js 의 onRewardAdResult 로 결과가 돌아옵니다 */
  function playNative(b, adUnit) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      function finish(res) {
        if (done) return;
        done = true;
        if (timer && typeof clearTimeout === 'function') clearTimeout(timer);
        if (BM.app && BM.app.pendingRewardAd === finish) BM.app.pendingRewardAd = null;
        resolve(res);
      }
      BM.app = BM.app || {};
      BM.app.pendingRewardAd = finish;
      timer = setTimeout(function () {
        finish({ rewarded: false, adUnit: adUnit, source: 'native', reason: 'timeout' });
      }, NATIVE_TIMEOUT_MS);
      try {
        b.showRewardedAd(adUnit);
      } catch (e) {
        finish({ rewarded: false, adUnit: adUnit, source: 'native', reason: 'error' });
      }
    });
  }

  /* 화면이 있는 환경인지 — ui.js의 hasDom은 값(true/false)이고, 함수로 내보내는 경우도 받아 줍니다. */
  function uiReady() {
    var UI = BM.ui;
    if (!UI || typeof UI.openSheet !== 'function') return false;
    return (typeof UI.hasDom === 'function') ? !!UI.hasDom() : !!UI.hasDom;
  }

  /* 웹 미리보기: 3초 · 중간에 닫으면 지급하지 않습니다 */
  function playPreview(adUnit) {
    return new Promise(function (resolve) {
      var UI = BM.ui;
      if (!uiReady()) {
        /* 화면이 없는 환경(테스트)에서는 재생할 수 없습니다 */
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'no_dom' });
        return;
      }
      var left = PREVIEW_SEC;
      var closed = false;
      var timer = null;
      var wrap = null;
      function settle(res) {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (typeof UI.closeSheet === 'function') UI.closeSheet();
        resolve(res);
      }
      try {
        wrap = UI.openSheet({
          title: '광고 보고 하트 받기',
          body: '<div class="ad-sim">' +
            '<div class="ad-sim__badge">AD</div>' +
            '<p class="ad-sim__t">광고를 보는 중이에요</p>' +
            '<p class="ad-sim__s">끝까지 보면 하트 <b>' + (BM.domain ? BM.domain.HEART_RULES.AD_REWARD : 1) + '개</b> · <b data-ad-count>' + PREVIEW_SEC + '</b>초</p>' +
            '<div class="adbar adbar--lg"><i data-ad-progress style="width:0%"></i></div>' +
            '<button type="button" class="btn btn--ghost btn--big mt16" data-ad-cancel>그만 보기</button>' +
            '<p class="hint">웹에서는 광고 미리보기예요. 앱(스토어)에서는 이 자리에 실제 광고가 나옵니다.</p></div>'
        });
      } catch (e) {
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'error' });
        return;
      }
      if (!wrap) {
        /* 시트를 띄우지 못하면 보상도 없습니다 (버튼이 잠긴 채 남지 않게) */
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'no_sheet' });
        return;
      }
      /* 닫기(X·배경)로 나가면 지급하지 않습니다 */
      wrap.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-ad-cancel]')) { ev.preventDefault(); settle({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'cancel' }); return; }
        if (ev.target.closest('[data-close]')) settle({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'cancel' });
      });
      timer = setInterval(function () {
        left -= 1;
        var c = wrap.querySelector('[data-ad-count]');
        var p = wrap.querySelector('[data-ad-progress]');
        if (c) c.textContent = String(Math.max(0, left));
        if (p) p.style.width = Math.round(((PREVIEW_SEC - left) / PREVIEW_SEC) * 100) + '%';
        if (left <= 0) settle({ rewarded: true, adUnit: adUnit, source: 'preview' });
      }, 1000);
    });
  }

  /* 진행 중인 광고가 있는지 — 화면이 버튼을 잠그는 데 씁니다 */
  function busy() { return !!inFlight; }

  /* 보상형 광고 한 번 재생 — { rewarded, adUnit, source, reason }
   *  이미 다른 광고가 진행 중이면 { rewarded:false, source:'lock', reason:'in_flight', busy:true } */
  function showRewarded(opts) {
    opts = opts || {};
    var name = opts.unit || 'heart_reward';
    var adUnit = unitOf(name);

    if (inFlight) {
      return Promise.resolve({ rewarded: false, adUnit: adUnit, source: 'lock', reason: 'in_flight', busy: true });
    }

    var run;
    try {
      var b = bridge();
      run = b ? playNative(b, adUnit) : playPreview(adUnit);
    } catch (e) {
      return Promise.resolve({ rewarded: false, adUnit: adUnit, source: 'none', reason: 'error' });
    }

    var tracked = run.then(function (res) {
      if (inFlight === tracked) inFlight = null;
      return res;
    }, function (err) {
      if (inFlight === tracked) inFlight = null;
      throw err;
    });
    inFlight = tracked;
    return tracked;
  }

  /* ---------- 공용 하트 충전 시트 ----------
   * openHeartSheet(ctx, { need, intro, continueLabel, onContinue, allowMy, title })
   *  · ctx.store.state.data.hearts 로 지금 상태를 읽고, 1초마다 쿨타임을 다시 계산합니다.
   *  · 시트를 닫으면(뒤로 가기 포함) 타이머를 반드시 끕니다.
   *  · 필요 하트를 채우면 onContinue 로 원래 하려던 동작을 이어 갑니다. */
  function openHeartSheet(ctx, opts) {
    opts = opts || {};
    var UI = BM.ui;
    if (!UI || typeof UI.openSheet !== 'function') return null;
    var store = (ctx && ctx.store) || null;
    if (!store || !store.state || !store.state.data) return null;
    var actions = (ctx && ctx.actions) || store.actions || {};
    var R = rules();
    var need = Math.max(1, Math.round(numVal(opts.need, R.MATCH_COST)));
    var allowMy = opts.allowMy !== false;
    var stopTicker = null;

    function hearts() { return (store.state.data && store.state.data.hearts) || {}; }
    function live() { return getStatus(hearts()); }

    function stop() {
      if (stopTicker) { stopTicker(); stopTicker = null; }
    }

    function introHtml(s) {
      /* 함수로 받으면 시트를 다시 열 때마다 그 순간의 잔액으로 문장을 새로 만듭니다 */
      if (typeof opts.intro === 'function') {
        try { return String(opts.intro(s) || ''); } catch (e) { return ''; }
      }
      if (opts.intro) return String(opts.intro);
      var short = Math.max(0, need - s.balance);
      return '<p class="sheet__text">이번엔 <b>하트 ' + need + '개</b>가 필요해요. 지금 <b>' + s.balance + '개</b> 있어요.' +
        (short ? ' <span class="warn">' + short + '개 부족</span>' : '') + '</p>';
    }

    function hintText(s) {
      var short = need - s.balance;
      if (short <= 0) return '지금 바로 이어서 할 수 있어요.';
      if (s.freeHeartsLeft <= 0) return '오늘 무료 하트를 모두 받았어요. 내일 다시 채울 수 있어요.';
      if (s.freeHeartsLeft >= short) return '무료 하트 ' + s.freeChancesLeft + '번이면 ' + short + '개를 채울 수 있어요.';
      return '오늘 무료로 더 받을 수 있는 하트는 ' + s.freeHeartsLeft + '개예요. ' + short + '개 중 그만큼만 채워져요.';
    }

    function rowsHtml(s) {
      return '<button type="button" class="charge__row" data-charge="checkin"' + (s.canCheckIn ? '' : ' disabled') + '>' +
        '<span class="charge__t">출석 체크</span>' +
        '<span class="charge__d" data-checkin-sub>' + (s.checkedInToday ? '오늘 완료' : '하루 1회') + '</span>' +
        '<b class="charge__n">+' + s.checkinReward + '</b></button>' +
        '<button type="button" class="charge__row" data-charge="ad" data-ad-row' + (s.canWatchAd ? '' : ' disabled') + '>' +
        '<span class="charge__t">광고 보고 받기</span>' +
        '<span class="charge__d" data-ad-sub>' + escText(adText(s)) + '</span>' +
        '<b class="charge__n">+' + s.adReward + '</b></button>';
    }

    function bodyHtml(s) {
      var short = Math.max(0, need - s.balance);
      var pct = Math.min(100, Math.round((s.balance / need) * 100));
      var enough = short <= 0;
      return introHtml(s) +
        '<div class="chargemeter"><i style="width:' + pct + '%"></i></div>' +
        '<p class="freeline" data-free-line>' + UI.icon('spark') +
        '<span data-free>' + escText(freeText(s)) + '</span>' +
        '<span class="freeline__d" data-free-d>' + escText(freeDetail(s)) + '</span></p>' +
        '<div class="charge">' + rowsHtml(s) + '</div>' +
        '<p class="hint" data-hint>' + escText(hintText(s)) + '</p>' +
        (enough
          ? '<button type="button" class="btn btn--primary btn--big mt8" data-charge="continue">' +
            escText(opts.continueLabel || (typeof opts.onContinue === 'function' ? '이어서 하기' : '닫기')) + '</button>' +
            (allowMy ? '<button type="button" class="linkbtn mt8" data-charge="my">MY 하트 카드 보기</button>' : '')
          : '<button type="button" class="btn btn--ghost btn--big mt8" data-charge="my"' + (allowMy ? '' : ' disabled') + '>MY에서 잔액 보기</button>');
    }

    /* 1초마다 쿨타임·무료 하트 줄을 다시 계산합니다 (닫히면 멈춤) */
    function startTicker(wrap) {
      var si = root && root.setInterval;
      if (typeof si !== 'function') return;
      var ci = root.clearInterval;
      var id = si.call(root, function () {
        if (!wrap) { stop(); return; }
        if (typeof wrap.isConnected === 'boolean' && !wrap.isConnected) { stop(); return; }
        if (typeof document !== 'undefined' && document && document.body &&
          wrap.parentNode && !document.body.contains(wrap)) { stop(); return; }
        var s = live();
        var sub = wrap.querySelector('[data-ad-sub]');
        if (sub) sub.textContent = adText(s);
        var row = wrap.querySelector('[data-ad-row]');
        if (row) row.disabled = !s.canWatchAd;
        var free = wrap.querySelector('[data-free]');
        if (free) free.textContent = freeText(s);
        var fd = wrap.querySelector('[data-free-d]');
        if (fd) fd.textContent = freeDetail(s);
        if (s.nextAdInSec <= 0) stop();
      }, 1000);
      stopTicker = function () { if (typeof ci === 'function') ci.call(root, id); };
    }

    function reopen() {
      stop();
      UI.closeSheet();
      open();
    }

    function onClick(ev) {
      var b = ev.target.closest('[data-charge]');
      if (!b) return;
      ev.preventDefault();
      if (b.disabled) return;
      var kind = b.getAttribute('data-charge');

      if (kind === 'my') {
        stop();
        UI.closeSheet();
        if (actions.setTab) actions.setTab('my');
        if (ctx && typeof ctx.refresh === 'function') ctx.refresh();
        UI.toast('MY 하트 카드에서도 충전할 수 있어요');
        return;
      }

      if (kind === 'continue') {
        stop();
        UI.closeSheet();
        if (typeof opts.onContinue === 'function') {
          try { opts.onContinue(); } catch (e) { if (UI.toast) UI.toast('이어서 하지 못했어요', 'error'); }
        }
        return;
      }

      if (kind === 'checkin') {
        var ci = actions.checkIn ? actions.checkIn() : null;
        if (ci && ci.ok) {
          UI.toast('출석 체크 완료 · 하트 +' + ci.gained);
          UI.haptic(12);
          reopen();
        } else if (ci && ci.reason === 'done') {
          UI.toast('오늘은 이미 출석했어요');
          reopen();
        } else if (ci && ci.reason === 'locked') {
          UI.toast('잠시만요, 처리 중이에요');
        } else {
          UI.toast('출석 체크를 하지 못했어요', 'error');
        }
        return;
      }

      if (kind === 'ad') {
        if (b.classList.contains('is-busy')) return;
        b.classList.add('is-busy');
        showRewarded({ unit: 'heart_reward' }).then(function (r) {
          b.classList.remove('is-busy');
          if (!r || !r.rewarded) {
            if (r && r.busy) UI.toast('광고를 준비하고 있어요. 잠시만요');
            else if (r && r.reason === 'cancel') UI.toast('광고를 끝까지 봐야 하트를 받을 수 있어요');
            else UI.toast('지금은 광고를 볼 수 없어요. 잠시 후 다시 시도해 주세요');
            return;
          }
          var res = actions.watchAd ? actions.watchAd({ verified: true, adUnit: r.adUnit }) : null;
          if (res && res.ok) {
            UI.toast('하트 +' + res.gained + ' · 오늘 ' + res.remaining + '회 남음');
            UI.haptic(16);
            reopen();
          } else if (res && res.reason === 'limit') {
            UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!');
            reopen();
          } else if (res && res.reason === 'cooldown') {
            UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
            reopen();
          } else if (res && res.reason === 'locked') {
            UI.toast('잠시만요, 처리 중이에요');
          } else {
            UI.toast('하트를 받지 못했어요', 'error');
          }
        });
      }
    }

    function open() {
      stop();
      var s = live();
      var wrap = UI.openSheet({
        title: opts.title || '하트 충전',
        body: bodyHtml(s),
        onMount: function (w) {
          w.addEventListener('click', onClick);
          if (s.nextAdInSec > 0) startTicker(w);
        }
      });
      /* 시트가 닫히거나 다른 시트로 바뀌면 타이머를 끕니다 (누수 방지) */
      if (wrap && typeof UI.onSheetClose === 'function') UI.onSheetClose(stop);
      return wrap;
    }

    return open();
  }

  BM.ads = {
    UNITS: units,
    PREVIEW_SEC: PREVIEW_SEC,
    bridge: bridge,
    available: available,
    setUnits: setUnits,
    unitOf: unitOf,
    showRewarded: showRewarded,
    busy: busy,
    getStatus: getStatus,
    adText: adText,
    freeText: freeText,
    freeDetail: freeDetail,
    openHeartSheet: openHeartSheet
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
