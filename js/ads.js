/* ============================================================
 * ads.js — 보상형 광고 어댑터 (BM.ads)
 *
 * 원칙
 *  1) 실제 보상은 광고를 끝까지 본 신호(verified)로만 지급합니다.
 *     (지급 자체는 store.actions.watchAd 가 한도·간격·중복을 다시 검사)
 *  2) 앱(안드로이드 WebView / iOS)이 광고 SDK를 들고 있으면 그쪽에 맡깁니다.
 *     네이티브는 다 본 뒤 window.BM.app.onRewardAdResult(true, 광고ID)로 알려 줍니다.
 *  3) 웹·PWA에서는 같은 흐름을 3초짜리 미리보기 시트로 재현합니다.
 *     실제 광고가 아니라는 점을 화면에 그대로 적고, 중간에 닫으면 지급하지 않습니다.
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

  /* 웹 미리보기: 3초 · 중간에 닫으면 지급하지 않습니다 */
  function playPreview(adUnit) {
    return new Promise(function (resolve) {
      var UI = BM.ui;
      if (!UI || typeof UI.openSheet !== 'function' || !UI.hasDom || !UI.hasDom()) {
        /* 화면이 없는 환경(테스트)에서는 재생할 수 없습니다 */
        resolve({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'no_dom' });
        return;
      }
      var left = PREVIEW_SEC;
      var closed = false;
      var wrap = UI.openSheet({
        title: '광고 보고 하트 받기',
        body: '<div class="ad-sim">' +
          '<div class="ad-sim__badge">AD</div>' +
          '<p class="ad-sim__t">광고를 보는 중이에요</p>' +
          '<p class="ad-sim__s">끝까지 보면 하트 <b>' + (BM.domain ? BM.domain.HEART_RULES.AD_REWARD : 1) + '개</b> · <b data-ad-count>' + PREVIEW_SEC + '</b>초</p>' +
          '<div class="adbar adbar--lg"><i data-ad-progress style="width:0%"></i></div>' +
          '<button type="button" class="btn btn--ghost btn--big mt16" data-ad-cancel>그만 보기</button>' +
          '<p class="hint">웹에서는 광고 미리보기예요. 앱(스토어)에서는 이 자리에 실제 광고가 나옵니다.</p></div>'
      });
      function settle(res) {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        UI.closeSheet();
        resolve(res);
      }
      /* 닫기(X·배경)로 나가면 지급하지 않습니다 */
      if (wrap) {
        wrap.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-ad-cancel]')) { ev.preventDefault(); settle({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'cancel' }); return; }
          if (ev.target.closest('[data-close]')) settle({ rewarded: false, adUnit: adUnit, source: 'preview', reason: 'cancel' });
        });
      }
      var timer = setInterval(function () {
        left -= 1;
        var c = wrap && wrap.querySelector('[data-ad-count]');
        var p = wrap && wrap.querySelector('[data-ad-progress]');
        if (c) c.textContent = String(Math.max(0, left));
        if (p) p.style.width = Math.round(((PREVIEW_SEC - left) / PREVIEW_SEC) * 100) + '%';
        if (left <= 0) settle({ rewarded: true, adUnit: adUnit, source: 'preview' });
      }, 1000);
    });
  }

  /* 보상형 광고 한 번 재생 — { rewarded, adUnit, source, reason } */
  function showRewarded(opts) {
    opts = opts || {};
    var name = opts.unit || 'heart_reward';
    var adUnit = unitOf(name);
    var b = bridge();
    if (b) return playNative(b, adUnit);
    return playPreview(adUnit);
  }

  BM.ads = {
    UNITS: units,
    PREVIEW_SEC: PREVIEW_SEC,
    bridge: bridge,
    available: available,
    setUnits: setUnits,
    unitOf: unitOf,
    showRewarded: showRewarded
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
