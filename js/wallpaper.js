/* ============================================================
 * wallpaper.js — 📱 폰 바탕화면(안드로이드 라이브 배경화면) 연결 (bm-v1.89.0)
 *
 *  · 커스텀 라켓 시트에서 고른 색(테두리·거트·그립·효과·바디)을 그대로 안드로이드
 *    앱의 라이브 배경화면(ShuttlixWallpaperService)에 넘깁니다.
 *  · 넘기는 길은 세 가지입니다.
 *      ① 네이티브 브리지(앱이 WebView로 띄울 때) — window.BadmintonBridge.setWallpaperConfig()
 *         · openLiveWallpaper()
 *      ② 셔틀릭스 앱이 설치된 안드로이드(TWA·크롬) — shuttlix://wallpaper 딥링크(intent://)로
 *         설정 JSON을 넘기고, 앱이 WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER 를 엽니다.
 *      ③ 그 밖(PC·아이폰·앱 미설치) — '안드로이드 앱 설치 후 사용할 수 있어요' 안내만 합니다.
 *
 *  앱(Java) 쪽 WallpaperConfig.java 와 같은 키를 씁니다 — 한쪽만 바꾸지 마세요.
 *    v · body · frame · frameColor · string · stringColor · grip · gripColor ·
 *    gripColor2 · stencil · stencilColor · effect · effectColor · name
 *
 *  실존 선수·브랜드 이름은 쓰지 않습니다(용품 색 이름만).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};

  /* 셔틀릭스 안드로이드 앱 — 딥링크를 받는 패키지·스킴 */
  var PKG = 'io.github.csw42060713_byte.badminton';
  var SCHEME = 'shuttlix';

  function bridge() {
    var cands = [root.BadmintonBridge, root.ShuttlixBridge, root.BadmintonNative];
    for (var i = 0; i < cands.length; i++) {
      if (cands[i] && typeof cands[i] === 'object') {
        if (typeof cands[i].openLiveWallpaper === 'function' || typeof cands[i].setWallpaperConfig === 'function') return cands[i];
      }
    }
    return null;
  }

  function isAndroid() {
    try { return /Android/i.test(String(root.navigator && root.navigator.userAgent || '')); }
    catch (e) { return false; }
  }

  /* 지금 입고 있는 라켓 한 벌 — 앱(Java)이 읽는 그대로의 모양 */
  function configOf(state) {
    var RC = BM.racketcustom;
    var c = RC ? RC.customOf(state && state.me) : null;
    if (!c) c = { body: 'power77', frame: 'matte', string: 'lime', grip: 'black', stencil: 'none', effect: 'none' };
    function color(slot, id) {
      var it = RC && RC.itemOf ? RC.itemOf(slot, id) : null;
      var v = it && it.color ? String(it.color) : '';
      /* '투명'(없음)이면 빈 값 — 앱이 팔레트 기본색으로 채웁니다 */
      return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : '';
    }
    function second(slot, id) {
      var it = RC && RC.itemOf ? RC.itemOf(slot, id) : null;
      var v = it && it.color2 ? String(it.color2) : '';
      return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : '';
    }
    var body = RC && RC.bodyOf ? RC.bodyOf(c.body) : { name: '파워 77' };
    return {
      v: 1,
      body: String(c.body || 'power77'),
      name: String(body && body.name || '파워 77'),
      frame: String(c.frame || 'matte'), frameColor: color('frame', c.frame),
      string: String(c.string || 'lime'), stringColor: color('string', c.string),
      grip: String(c.grip || 'black'), gripColor: color('grip', c.grip), gripColor2: second('grip', c.grip),
      stencil: String(c.stencil || 'none'), stencilColor: color('stencil', c.stencil),
      effect: String(c.effect || 'none'), effectColor: color('effect', c.effect)
    };
  }

  function jsonOf(cfg) { return JSON.stringify(cfg); }

  /* 크롬·TWA에서 앱을 깨우는 딥링크 — 앱이 받아서 배경화면 선택창을 엽니다 */
  function intentUrl(cfg) {
    return 'intent://wallpaper?c=' + encodeURIComponent(jsonOf(cfg)) +
      '#Intent;scheme=' + SCHEME + ';package=' + PKG + ';end';
  }

  /* true = 넘겼다(앱이 열립니다) · false = 이 환경에서는 안내만 */
  function apply(state) {
    var cfg = configOf(state);
    var b = bridge();
    if (b) {
      try {
        if (typeof b.setWallpaperConfig === 'function') b.setWallpaperConfig(jsonOf(cfg));
        if (typeof b.openLiveWallpaper === 'function') { b.openLiveWallpaper(); return true; }
      } catch (e) { /* 브리지가 거절하면 딥링크로 한 번 더 */ }
    }
    if (isAndroid() && root.location) {
      try {
        root.location.href = intentUrl(cfg);
        return true;
      } catch (e2) { return false; }
    }
    return false;
  }

  /* 화면에 띄울 한 줄 안내 — 환경마다 다릅니다 */
  function hintText() {
    if (bridge() || isAndroid()) return '지금 고른 색 그대로 폰 바탕화면에 떠요 · 바탕화면을 톡 치면 스매시!';
    return '안드로이드 셔틀릭스 앱을 설치하면 폰 바탕화면으로 쓸 수 있어요.';
  }

  BM.wallpaper = {
    PKG: PKG, SCHEME: SCHEME,
    bridge: bridge, isAndroid: isAndroid, configOf: configOf, jsonOf: jsonOf,
    intentUrl: intentUrl, apply: apply, hintText: hintText
  };
})(typeof window !== 'undefined' ? window : this);
