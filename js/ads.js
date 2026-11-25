/* ============================================================
 * ads.js — 보상형 광고 어댑터 (BM.ads) + 공용 하트 충전 시트
 *
 * 원칙
 *  1) 실제 보상은 광고를 끝까지 본 신호(verified)로만 지급합니다.
 *     (지급 자체는 store.actions.watchAd 가 한도·간격·중복을 다시 검사)
 *     한 번 재생할 때마다 거래 ID(txId)를 붙여, 같은 시청 건이 두 번 적립되지 않게 합니다.
 *     (bm-v1.36.0 — 광고 SDK 콜백이 중복으로 와도 한 번만 들어갑니다)
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
 * AdMob 연결(출시 시 — bm-v1.64.0 브리지 훅 정리)
 *  - 안드로이드 래퍼(TWA·WebView)는 아래 둘 중 하나만 있으면 됩니다:
 *      window.BadmintonBridge.showRewardedAd(adUnit)   (또는 window.AndroidBridge · AndroidAdMob · BadmintonNative)
 *    광고를 끝까지 본 뒤 다음 중 하나로 결과를 알려 주세요(어느 쪽이든 동작):
 *      window.BadmintonAdMob.reward(true, 'heart_reward', txId)
 *      window.BM.app.onRewardAdResult(true, 'heart_reward', txId)
 *    txId(광고 SDK의 거래 ID)를 주면 같은 시청 건이 두 번 적립되지 않습니다.
 *  - 광고 단위 ID는 BM.ads.setUnits({ heart_reward: 'ca-app-pub-…/…' }) 로 넣습니다.
 *    하트 부스트·주간 리포트 자리는 단위 ID만 미리 등록해 둡니다.
 *    window.BadmintonAdMob.setUnits({…}) 로도 같은 일을 할 수 있습니다.
 *
 * 하트 부스트 (bm-v1.64.0)
 *  - 꾸미기에서 'boost:heart'를 열고 켜 두면 출석·광고 적립이 +1 (store.checkIn · watchAd).
 *  - 미리보기 화면도 그 순간의 보상 값(하트 상태의 adReward)을 그대로 보여 줍니다.
 *
 * 다중 슬롯 (bm-v1.47.0)
 *  - 광고 자리는 SLOTS 에 이름으로 모여 있습니다. 지금 실제로 쓰는 것은 heart_reward 이고,
 *    heart_boost(하트 2배 시간)·report_detail(주간·월간 상세 리포트)은 단위 ID만 미리
 *    등록해 둘 수 있는 자리입니다 — setUnits({ heart_boost: 'ca-app-pub-…/…' }).
 *  - 하루 5회·30초 간격은 슬롯을 합쳐서 셉니다(하트 지급 규칙은 그대로). 어느 자리에서 봤는지는
 *    적립 행의 target(광고 단위 이름)에 남습니다.
 *  - 등록하지 않은 자리는 heart_reward 단위로 재생합니다(unitOf 의 기본값).
 *
 * 실시간 표시 · 1탭 충전 (bm-v1.47.0)
 *  - adMeterText: '남은 3/5회 · 다음 광고까지 12초' — MY 하트 카드·충전 시트가 1초마다 다시 씁니다.
 *  - watchForHeart: 하트가 모자란 자리에서 '광고 보고 +1' 한 번으로 재생→적립까지 끝냅니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util || {};

  var PREVIEW_SEC = 3;                 /* 웹 미리보기 길이 */
  var NATIVE_TIMEOUT_MS = 90 * 1000;   /* 광고가 안 돌아올 때 화면이 잠기지 않게 */

  /* 광고 슬롯 이름 — 출시하며 광고 단위를 늘릴 자리 (bm-v1.47.0) */
  var SLOTS = ['heart_reward', 'heart_boost', 'report_detail'];
  var units = { heart_reward: 'heart_reward' };

  /* 진행 중인 보상형 광고 요청의 Promise (중복 실행 잠금) */
  var inFlight = null;

  function bridge() {
    if (typeof root === 'undefined' || !root) return null;
    var cands = [root.BadmintonBridge, root.AndroidBridge, root.AndroidAdMob, root.BadmintonNative];
    for (var i = 0; i < cands.length; i++) {
      var b = cands[i];
      if (b && typeof b.showRewardedAd === 'function') return b;
    }
    return null;
  }

  function available() {
    return { native: !!bridge(), preview: true };
  }

  /* 광고 단위 ID 등록 — { heart_reward: 'ca-app-pub-…/…', heart_boost: '…' }
   *  빈 값(''·null)은 '등록을 지운다'는 뜻으로, 그 슬롯은 heart_reward 단위로 들아갑니다. */
  function setUnits(map) {
    Object.keys(map || {}).forEach(function (k) {
      var v = map[k];
      var key = String(k);
      if (SLOTS.indexOf(key) < 0) return;      /* 오타 난 슬롯은 조용히 버립니다 */
      if (v === '' || v == null) {
        if (key !== 'heart_reward') delete units[key];
        return;
      }
      units[key] = String(v);
    });
    return units;
  }

  /* 이 슬롯에 따로 등록한 단위 ID가 있는지 (없으면 heart_reward 로 재생) */
  function hasUnit(name) {
    var k = String(name || '');
    return !!units[k] && units[k] !== units.heart_reward;
  }

  function unitOf(name) {
    return units[name] || units.heart_reward;
  }

  function slotNames() { return SLOTS.slice(); }

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

  /* ---------- 광고 거래 ID (bm-v1.36.0) ----------
   *  한 번의 광고 시청 = ID 하나. 광고 SDK 콜백이 두 번 오거나 사용자가 연달아 눌러도
   *  store.actions.watchAd 가 같은 ID를 두 번째로 받으면 duplicate 로 막습니다.
   *  앱이 ID를 안 주면 시각+난수로 만듭니다(같은 밀리초에 두 번 만들어도 겹치지 않게). */
  var txSeq = 0;
  function newTxId() {
    txSeq = (txSeq + 1) % 100000;
    return 'tx-' + Date.now().toString(36) + '-' + txSeq.toString(36) + '-' +
      Math.random().toString(36).slice(2, 6);
  }

  function cleanTxId(v) {
    if (BM.domain && typeof BM.domain.cleanTxId === 'function') return BM.domain.cleanTxId(v);
    return String(v == null ? '' : v).trim();
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
    /* 오늘의 하트 부스트 — 오늘 광고가 한 번도 남지 않았으면 오늘은 받을 수 없습니다 */
    var dailyBoostAmount = numVal(h.dailyBoostAmount, 0);
    var dailyBoostLeft = (remaining > 0 && !(h.dailyBoost && h.dailyBoost.usedToday)) ? numVal(h.dailyBoostLeft, 0) : 0;

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
      freeHeartsLeft: (canCheckIn ? checkinReward : 0) + remaining * adReward + dailyBoostLeft,
      freeChancesLeft: (canCheckIn ? 1 : 0) + remaining,

      /* 오늘의 하트 부스트 — 오늘 첫 광고 한 편에 +1 (bm-v1.73.0) */
      dailyBoost: h.dailyBoost || null,
      dailyBoostAmount: dailyBoostAmount,
      dailyBoostLeft: dailyBoostLeft,

      /* 연속 출석 보너스 안내 (bm-v1.36.0 → v1.64: 3·7·14일) — MY 하트 카드와 같은 문구를 씁니다 */
      streak: Math.max(0, numVal(h.checkinStreak, 0)),
      streakBonus: h.streakBonus || null,

      /* 하트 부스트 상태 (bm-v1.64.0) */
      boost: h.boost || null
    };
  }

  /* 하트 부스트 안내 한 줄 — MY 카드·충전 시트 공용 (bm-v1.64.0) */
  function boostText(s) {
    var b = (s && s.boost) || null;
    if (!b || !b.equipped) return '';
    return '하트 부스트 적용 중(+' + Math.max(0, numVal(b.bonus, 1)) + ') · 출석·광고 적립에 붙어요';
  }

  /* 3·7·14일 연속 보너스 안내 한 줄 — MY 하트 카드·충전 시트 공용 */
  function streakText(s) {
    var b = (s && s.streakBonus) || null;
    var amount = b ? numVal(b.amount, 0) : 0;
    if (!(amount > 0)) return '';
    var left = Math.max(1, numVal(b.left, 3));
    var run = Math.max(0, numVal(s.streak, 0));
    var head = run > 0 ? run + '일 연속 출석 중 · ' : '';
    return head + left + '일 더 하면 보너스 하트 +' + amount;
  }

  /* 오늘의 하트 부스트 안내 한 줄 — MY 하트 카드·충전 시트 공용 (bm-v1.73.0)
   *  · 하트 부스트(영구 +1)를 열지 않은 사람도 광고를 볼 이유가 되도록,
   *    그날 첫 광고에 +1을 더 줍니다. */
  function dailyBoostText(s) {
    var amount = Math.max(0, numVal(s && s.dailyBoostAmount, 0));
    if (!(amount > 0)) return '';
    if (numVal(s.dailyBoostLeft, 0) > 0) return '오늘의 하트 부스트 · 오늘 첫 광고에 +' + amount + ' 더';
    if (s && s.dailyBoost && s.dailyBoost.usedToday) return '오늘의 하트 부스트 받음 · 내일 첫 광고에 +' + amount;
    return '내일 첫 광고에 하트 +' + amount + ' 더';
  }

  /* 광고 줄에 쓰는 한 줄 — 남은 초가 있으면 1초마다 이 문구가 바뀝니다 */
  function adText(s) {
    if (!s || !s.adRemaining) return '오늘 모두 받았어요';
    if (s.nextAdInSec > 0) return '다음 광고까지 ' + s.nextAdInSec + '초';
    return '남은 ' + s.adRemaining + '회';
  }

  /* 오늘 남은 횟수(N/5회)와 쿨타임을 한 줄에 (bm-v1.47.0)
   *  · MY 하트 카드·충전 시트가 1초마다 다시 그려 '지금 눌러도 되는지'가 바로 보입니다.
   *  · 남은 횟수를 먼저, 그다음 쿨타임 초를 둡니다. */
  function adMeterText(s) {
    if (!s) return '';
    var limit = Math.max(0, numVal(s.adLimit, 0));
    var leftCount = Math.max(0, numVal(s.adRemaining, 0));
    if (limit <= 0) return '오늘 광고 없음';
    var head = '남은 ' + leftCount + '/' + limit + '회';
    if (leftCount <= 0) return head + ' · 오늘 모두 받았어요';
    if (numVal(s.nextAdInSec, 0) > 0) return head + ' · 다음 광고까지 ' + numVal(s.nextAdInSec, 0) + '초';
    return head + ' · 지금 바로 +' + (numVal(s.adReward, 1) + numVal(s.dailyBoostLeft, 0));
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
  function playNative(b, adUnit, txId) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      function finish(res) {
        if (done) return;
        done = true;
        if (timer && typeof clearTimeout === 'function') clearTimeout(timer);
        if (BM.app && BM.app.pendingRewardAd === finish) BM.app.pendingRewardAd = null;
        if (res && !res.txId) res.txId = txId;
        resolve(res);
      }
      BM.app = BM.app || {};
      BM.app.pendingRewardAd = finish;
      timer = setTimeout(function () {
        finish({ rewarded: false, adUnit: adUnit, source: 'native', reason: 'timeout', txId: txId });
      }, NATIVE_TIMEOUT_MS);
      try {
        b.showRewardedAd(adUnit);
      } catch (e) {
        finish({ rewarded: false, adUnit: adUnit, source: 'native', reason: 'error', txId: txId });
      }
    });
  }

  /* 화면이 있는 환경인지 — ui.js의 hasDom은 값(true/false)이고, 함수로 내보내는 경우도 받아 줍니다. */
  function uiReady() {
    var UI = BM.ui;
    if (!UI || typeof UI.openSheet !== 'function') return false;
    return (typeof UI.hasDom === 'function') ? !!UI.hasDom() : !!UI.hasDom;
  }

  /* 지금 이 기기에서 광고를 보면 받을 하트 수 — 하트 부스트가 켜져 있으면 2 (bm-v1.64.0) */
  function rewardNow() {
    try {
      var store = BM.app && BM.app.ctx && BM.app.ctx.store;
      var h = store && store.state && store.state.data && store.state.data.hearts;
      if (h && numVal(h.adReward, 0) > 0) {
        /* 오늘의 하트 부스트가 남아 있으면 그날 첫 광고 보상에 함께 붙습니다 (bm-v1.73.0) */
        return numVal(h.adReward, 1) + numVal(h.dailyBoostLeft, 0);
      }
    } catch (e) { /* 화면이 없는 환경(테스트)에서는 기본값 */ }
    return (BM.domain && BM.domain.HEART_RULES.AD_REWARD) || 1;
  }

  /* 웹 미리보기: 3초 · 중간에 닫으면 지급하지 않습니다 */
  function playPreview(adUnit, txId) {
    return new Promise(function (resolve) {
      var UI = BM.ui;
      if (!uiReady()) {
        /* 화면이 없는 환경(테스트)에서는 재생할 수 없습니다 */
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'no_dom', txId: txId });
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
        if (res && !res.txId) res.txId = txId;
        resolve(res);
      }
      try {
        wrap = UI.openSheet({
          title: '광고 보고 하트 받기',
          body: '<div class="ad-sim">' +
            '<div class="ad-sim__badge">AD</div>' +
            '<p class="ad-sim__t">광고를 보는 중이에요</p>' +
            '<p class="ad-sim__s">끝까지 보면 하트 <b>' + rewardNow() + '개</b> · <b data-ad-count>' + PREVIEW_SEC + '</b>초</p>' +
            '<div class="adbar adbar--lg"><i data-ad-progress style="width:0%"></i></div>' +
            '<button type="button" class="btn btn--ghost btn--big mt16" data-ad-cancel>그만 보기</button>' +
            '<p class="hint">웹에서는 광고 미리보기예요. 앱(스토어)에서는 이 자리에 실제 광고가 나옵니다.</p></div>'
        });
      } catch (e) {
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'error', txId: txId });
        return;
      }
      if (!wrap) {
        /* 시트를 띄우지 못하면 보상도 없습니다 (버튼이 잠긴 채 남지 않게) */
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'no_sheet', txId: txId });
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

  /* 하트가 모자란 자리의 1탭 충전 (bm-v1.47.0)
   *  '광고 보고 하트 +1' 버튼이 이걸 부릅니다 — 재생이 끝나면 바로 적립까지 하고,
   *  결과 이유(limit·cooldown·duplicate·cancel·busy)를 화면이 그대로 안내합니다.
   *  opts: { unit, silent(토스트 생략) } */
  function watchForHeart(ctx, opts) {
    opts = opts || {};
    var store = (ctx && ctx.store) || (BM.app && BM.app.ctx && BM.app.ctx.store) || null;
    var actions = (ctx && ctx.actions) || (store && store.actions) || null;
    var unit = opts.unit || 'heart_reward';
    if (!actions || typeof actions.watchAd !== 'function') {
      return Promise.resolve({ ok: false, reason: 'no_store' });
    }
    return showRewarded({ unit: unit }).then(function (r) {
      if (!r || !r.rewarded) {
        var why = !r ? 'error' : (r.busy ? 'busy' : (r.reason || 'not_rewarded'));
        return { ok: false, reason: why, ad: r };
      }
      var res = null;
      try { res = actions.watchAd({ verified: true, adUnit: r.adUnit, txId: r.txId }); }
      catch (e) { res = { ok: false, reason: 'error' }; }
      var out = {
        ok: !!(res && res.ok),
        reason: res ? res.reason : 'error',
        gained: res && res.gained,
        remaining: res && res.remaining,
        balance: res && res.balance,
        dailyBoost: res && res.dailyBoost,
        retryAfter: res && res.retryAfter,
        ad: r
      };
      if (out.ok && !opts.silent && BM.ui) {
        if (BM.ui.toast) BM.ui.toast('하트 +' + out.gained + (out.dailyBoost ? ' (오늘의 부스트 +' + out.dailyBoost + ' 포함)' : '') +
          ' · 오늘 ' + out.remaining + '회 남음');
        if (BM.ui.haptic) BM.ui.haptic(16);
      }
      return out;
    }, function () { return { ok: false, reason: 'error' }; });
  }

  /* 보상형 광고 한 번 재생 — { rewarded, adUnit, source, reason }
   *  이미 다른 광고가 진행 중이면 { rewarded:false, source:'lock', reason:'in_flight', busy:true } */
  function showRewarded(opts) {
    opts = opts || {};
    var name = opts.unit || 'heart_reward';
    var adUnit = unitOf(name);
    /* 이번 시청 건의 거래 ID — 네이티브가 자기 ID를 주면 그쪽을 씁니다 */
    var txId = cleanTxId(opts.txId) || newTxId();

    if (inFlight) {
      return Promise.resolve({ rewarded: false, adUnit: adUnit, source: 'lock', reason: 'in_flight', busy: true, txId: txId });
    }

    var run;
    try {
      var b = bridge();
      run = b ? playNative(b, adUnit, txId) : playPreview(adUnit, txId);
    } catch (e) {
      return Promise.resolve({ rewarded: false, adUnit: adUnit, source: 'none', reason: 'error', txId: txId });
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

  /* 보상형 광고 결과 훅 (모바일 앱 WebView → JS)
   *  window.BM.app.onRewardAdResult(ok, adUnit, txId)
   *  · 기다리는 재생(playNative)이 있으면 그Promise로 결과를 넘겨 보냅니다.
   *  · 기다리는 화면이 없으면(앱이 먼저 알려 준 경우) 바로 지급합니다.
   *  · txId가 없으면 시각 기반 ID를 만들어 적립에 남기고, 같은 ID의 두 번째 적립은
   *    store.actions.watchAd 가 duplicate 로 막습니다 (bm-v1.36.0).
   *  → { rewarded, adUnit, source:'native', txId, apply? } */
  function onRewardAdResult(ok, adUnit, txId) {
    var unit = adUnit || 'heart_reward';
    var id = cleanTxId(txId) || newTxId();
    var res = { rewarded: !!ok, adUnit: unit, source: 'native', txId: id };

    var pending = BM.app && BM.app.pendingRewardAd;
    if (BM.app) BM.app.pendingRewardAd = null;
    if (typeof pending === 'function') {
      pending(res);
      return res;
    }
    if (!ok) return res;

    var store = (BM.app && BM.app.ctx && BM.app.ctx.store) || null;
    var actions = (store && store.actions) || null;
    if (actions && typeof actions.watchAd === 'function') {
      try { res.apply = actions.watchAd({ verified: true, adUnit: unit, txId: id }); }
      catch (e) { res.apply = { ok: false, reason: 'error' }; }
    }
    return res;
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
        '<span class="charge__d" data-ad-sub>' + escText(adMeterText(s)) + '</span>' +
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
        (streakText(s) ? '<p class="hint" data-streak-bonus>' + escText(streakText(s)) + '</p>' : '') +
        (dailyBoostText(s) ? '<p class="hint dailyline" data-daily-boost>' + escText(dailyBoostText(s)) + '</p>' : '') +
        (boostText(s) ? '<p class="hint" data-boost-line>' + escText(boostText(s)) + '</p>' : '') +
        (short > 0 && s.canWatchAd
          ? '<button type="button" class="btn btn--primary btn--big mt8" data-charge="ad-fill" data-ad-fill>' +
            '광고 보고 +' + (numVal(s.adReward, 1) + numVal(s.dailyBoostLeft, 0)) + ' 받기</button>'
          : '') +
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
        /* 남은 횟수(N/5)와 쿨타임 초를 1초마다 다시 — '지금 눌러도 되는지'가 바로 보입니다 */
        var sub = wrap.querySelector('[data-ad-sub]');
        if (sub) sub.textContent = adMeterText(s);
        var row = wrap.querySelector('[data-ad-row]');
        if (row) row.disabled = !s.canWatchAd;
        var free = wrap.querySelector('[data-free]');
        if (free) free.textContent = freeText(s);
        var fd = wrap.querySelector('[data-free-d]');
        if (fd) fd.textContent = freeDetail(s);
        var dl = wrap.querySelector('[data-daily-boost]');
        if (dl) dl.textContent = dailyBoostText(s);
        var af = wrap.querySelector('[data-ad-fill]');
        if (af) {
          af.disabled = !s.canWatchAd;
          af.textContent = '광고 보고 +' + (numVal(s.adReward, 1) + numVal(s.dailyBoostLeft, 0)) + ' 받기';
        }
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
          UI.toast(ci.bonus
            ? ci.streak + '일 연속 출석! 하트 +' + ci.gained + ' (보너스 +' + ci.bonus + ')'
            : '출석 체크 완료 · 하트 +' + ci.gained);
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

      if (kind === 'ad' || kind === 'ad-fill') {
        if (b.classList.contains('is-busy')) return;
        b.classList.add('is-busy');
        watchForHeart(ctx, { unit: 'heart_reward', silent: true }).then(function (res) {
          b.classList.remove('is-busy');
          if (res && res.ok) {
            UI.toast('하트 +' + res.gained + (res.dailyBoost ? ' (오늘의 부스트 +' + res.dailyBoost + ' 포함)' : '') +
              ' · 오늘 ' + res.remaining + '회 남음');
            UI.haptic(16);
            reopen();
          } else if (res && (res.reason === 'limit')) {
            UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!');
            reopen();
          } else if (res && res.reason === 'cooldown') {
            UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
            reopen();
          } else if (res && res.reason === 'duplicate') {
            UI.toast('이미 받은 광고예요');
            reopen();
          } else if (res && res.reason === 'locked') {
            UI.toast('잠시만요, 처리 중이에요');
          } else if (res && res.reason === 'busy') {
            UI.toast('광고를 준비하고 있어요. 잠시만요');
          } else if (res && res.reason === 'cancel') {
            UI.toast('광고를 끝까지 봐야 하트를 받을 수 있어요');
          } else if (res && (res.reason === 'not_rewarded' || res.reason === 'no_dom')) {
            UI.toast('지금은 광고를 볼 수 없어요. 잠시 후 다시 시도해 주세요');
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
    SLOTS: SLOTS,
    PREVIEW_SEC: PREVIEW_SEC,
    bridge: bridge,
    available: available,
    setUnits: setUnits,
    hasUnit: hasUnit,
    slotNames: slotNames,
    unitOf: unitOf,
    showRewarded: showRewarded,
    watchForHeart: watchForHeart,
    onRewardAdResult: onRewardAdResult,
    newTxId: newTxId,
    busy: busy,
    getStatus: getStatus,
    adText: adText,
    adMeterText: adMeterText,
    freeText: freeText,
    freeDetail: freeDetail,
    streakText: streakText,
    dailyBoostText: dailyBoostText,
    boostText: boostText,
    rewardNow: rewardNow,
    openHeartSheet: openHeartSheet
  };

  /* ---------- 래퍼(안드로이드)와의 약속 ----------
   * 조환비 님 쪽 TWA/WebView 가 광고를 재생한 뒤 아래 둘 중 하나를 부르면 동작합니다.
   *   window.BadmintonAdMob.reward(true, 'heart_reward', txId)
   *   window.BM.app.onRewardAdResult(true, 'heart_reward', txId)
   * 단위 ID 등록과 상태 확인도 같은 자리에서 됩니다(setUnits · ready). */
  root.BadmintonAdMob = {
    reward: function (ok, adUnit, txId) { return onRewardAdResult(ok, adUnit, txId); },
    setUnits: function (map) { return setUnits(map || {}); },
    units: function () { return units; },
    ready: function () { return available(); },
    showRewarded: function (slot) { return showRewarded({ unit: slot || 'heart_reward' }); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
