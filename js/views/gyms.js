/* ============================================================
 * views/gyms.js — 체육관 지도 화면 (지도 + 자주 가는 체육관)
 *
 *  어디서 열리나
 *   · 1:1 매칭 > 찾기 맨 위 '체육관 지도' 카드
 *   · 커뮤니티 '게스트 모집'의 '어디 체육관' 칸 옆 '지도에서 고르기'
 *
 *  무엇을 하나
 *   · 지도를 열면 배드민턴 체육관 13곳이 처음부터 핀으로 찍혀 있습니다.
 *   · 핀·카드의 별을 눌러 '자주 가는 체육관'을 등록/해제하면 이 기기에 저장됩니다.
 *     (계정마다 따로 · 서버로 보내지 않음)
 *   · '즐겨찾기만 보기'로 지도와 목록을 즐겨찾기만 남겨 볼 수 있습니다.
 *   · 카드의 '주 체육관으로'는 MY 프로필의 주 체육관 이름을 채웁니다.
 *
 *  오프라인·타일 실패
 *   · Leaflet 을 못 불러오면 좌표를 % 위치로 계산한 핀 지도를 그립니다(핀·카드 그대로).
 *   · 타일만 실패하면 지도 바탕에 안내 한 줄을 띄우고 핀은 그대로 둡니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, UI = BM.ui;

  function G() { return BM.gyms; }

  var page = null;             /* 지금 열린 화면 DOM */
  var ctxRef = null;
  var optsRef = {};            /* { onPick } */
  var model = { scope: 'guest', onlyFav: false, query: '', club: '' };
  var map = null;              /* Leaflet 지도 */
  var markerLayer = null;
  var histHeld = false;
  var tileBroken = false;

  /* ---------- HTML 조각 ---------- */
  function star(fav) { return fav ? '★' : '☆'; }

  /* 받침에 따라 '을/를', '으로/로'를 골라 '을(를)' 같은 어색한 표기를 없앱니다 */
  function hasBatchim(word) {
    var s = String(word || '');
    var code = s.charCodeAt(s.length - 1);
    if (!(code >= 0xac00 && code <= 0xd7a3)) return false;
    return (code - 0xac00) % 28 !== 0;
  }
  function eul(word) { return word + (hasBatchim(word) ? '을' : '를'); }

  function favSectionHtml(m) {
    var favs = G().favorites(m.scope);
    var items = favs.map(function (id) { return G().get(id); }).filter(Boolean);
    var body;
    if (items.length) {
      body = '<div class="chips gymfav__chips">' + items.map(function (v) {
        return '<button type="button" class="gymchip" data-gym-jump="' + U.esc(v.id) + '">' +
          '<b>★</b>' + U.esc(v.name) + '</button>';
      }).join('') + '</div>';
    } else {
      body = '<p class="gymfav__empty">' + UI.icon('pin') +
        '<span>카드나 핀의 <b>☆</b>를 누르면 여기에 모여요.</span></p>';
    }
    return '<section class="gymfav">' +
      '<div class="gymfav__head"><h3>자주 가는 체육관</h3>' +
      (items.length ? '<span class="pill pill--ok">' + items.length + '곳</span>' : '') + '</div>' +
      body + '</section>';
  }

  function segHtml(m) {
    var list = G();
    var favCount = list.favorites(m.scope).length;
    return '<div class="gymseg">' +
      '<div class="seg seg--wide" role="group" aria-label="체육관 보기">' +
      '<button type="button" class="seg__btn' + (m.onlyFav ? '' : ' is-on') + '" data-gym-filter="all" aria-pressed="' + (m.onlyFav ? 'false' : 'true') + '">전체</button>' +
      '<button type="button" class="seg__btn' + (m.onlyFav ? ' is-on' : '') + '" data-gym-filter="fav" aria-pressed="' + (m.onlyFav ? 'true' : 'false') + '">즐겨찾기만' +
      (favCount ? ' ' + favCount : '') + '</button>' +
      '</div></div>';
  }

  function pinsHtml(m) {
    var list = visible(m);
    if (!list.length) return '';
    var pts = G().project(list);
    return pts.map(function (p) {
      var v = G().get(p.id) || {};
      var fav = G().isFav(m.scope, p.id);
      return '<button type="button" class="gympin' + (fav ? ' is-fav' : '') + '"' +
        ' style="left:' + p.x + '%;top:' + p.y + '%"' +
        ' data-gym-pin="' + U.esc(p.id) + '" aria-label="' + U.esc(v.name) + '">' +
        (fav ? '<b>★</b>' : '<i class="gypin__dot"></i>') + '</button>';
    }).join('');
  }

  function cardHtml(v, m) {
    var fav = G().isFav(m.scope, v.id);
    var meta = [v.area, v.courts ? '코트 ' + v.courts + '면' : ''].filter(Boolean).join(' · ');
    var tags = (v.tags || []).map(function (t) {
      return '<span class="pill pill--ghost">' + U.esc(t) + '</span>';
    }).join('');
    if (m.club && v.name === m.club) tags = '<span class="pill">내 주 체육관</span>' + tags;
    return '<article class="gymcard' + (fav ? ' is-fav' : '') + '" data-gym-card="' + U.esc(v.id) + '">' +
      '<div class="gymcard__head">' +
      '<div class="gymcard__t">' +
      '<h3>' + U.esc(v.name) + '</h3>' +
      '<p class="gymcard__meta">' + U.esc(meta) + '</p>' +
      (tags ? '<div class="gymcard__tags">' + tags + '</div>' : '') +
      '</div>' +
      '<button type="button" class="gymstar' + (fav ? ' is-on' : '') + '" data-gym-fav="' + U.esc(v.id) + '"' +
      ' aria-pressed="' + (fav ? 'true' : 'false') + '" aria-label="' +
      (fav ? '자주 가는 체육관에서 빼기' : '자주 가는 체육관으로 등록') + '">' + star(fav) + '</button>' +
      '</div>' +
      (v.hours ? '<p class="gymcard__row"><span>운영</span>' + U.esc(v.hours) + '</p>' : '') +
      (v.fee ? '<p class="gymcard__row"><span>요금</span>' + U.esc(v.fee) + '</p>' : '') +
      (v.tel ? '<p class="gymcard__row"><span>문의</span>' + U.esc(v.tel) + '</p>' : '') +
      '<div class="gymcard__act">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-gym-view="' + U.esc(v.id) + '">' +
      UI.icon('pin') + '지도에서 보기</button>' +
      (optsRef.onPick
        ? '<button type="button" class="btn btn--primary btn--sm" data-gym-pick="' + U.esc(v.id) + '">이 체육관으로</button>'
        : '<button type="button" class="btn btn--ghost btn--sm" data-gym-club="' + U.esc(v.id) + '">주 체육관으로</button>') +
      '</div></article>';
  }

  function listHtml(m) {
    var list = visible(m);
    if (!list.length) {
      return UI.emptyState('search', m.onlyFav ? '즐겨찾기한 체육관이 없어요' : '조건에 맞는 체육관이 없어요',
        m.onlyFav ? '카드나 핀의 별을 눌러 자주 가는 체육관을 등록해 보세요.' : '다른 조건으로 다시 찾아보세요.',
        m.onlyFav ? '<button type="button" class="btn btn--ghost btn--sm mt8" data-gym-filter="all">전체 체육관 보기</button>' : '');
    }
    return '<div class="gymcards">' + list.map(function (v) { return cardHtml(v, m); }).join('') + '</div>';
  }

  /* flex 안에서는 <b> 마다 gap 이 붙어 '12곳 이'처럼 벌어지므로 글은 한 덩어리로 감쌉니다 */
  function noteText(html) { return UI.icon('pin') + '<span>' + html + '</span>'; }

  function mapNoteInner(m) {
    var list = visible(m);
    if (m.onlyFav) return noteText('자주 가는 체육관 <b>' + list.length + '곳</b>만 지도에 보여요');
    var seoul = G().seoulOnly(list).length;
    var rest = list.length - seoul;
    if (rest > 0) {
      return noteText('지도에 서울 <b>' + seoul + '곳</b>이 바로 보여요 · 동탄 ' + rest + '곳은 <b>전체 보기</b>에서');
    }
    return noteText('지도를 열면 배드민턴 체육관 <b>' + list.length + '곳</b>이 바로 보여요');
  }

  function segHost(m) { return '<div data-gymseg>' + segHtml(m) + '</div>'; }

  function bodyHtml(m) {
    return '<div data-gymfavs>' + favSectionHtml(m) + '</div>' + segHost(m) +
      '<div class="gymmapwrap">' +
      /* 지도 상자(data-gymmap)는 다시 그려도 그대로 둡니다 — Leaflet 인스턴스가 그 안에 살아 있습니다 */
      '<div class="gymmap" data-gymmap>' +
      '<div class="gymmap__fallback" data-gympins aria-hidden="true">' + pinsHtml(m) + '</div>' +
      '</div>' +
      '<p class="gymmap__note" data-gymnote>' + mapNoteInner(m) + '</p>' +
      '</div>' +
      '<div data-gymlist>' + listHtml(m) + '</div>' +
      '<p class="hint gympage__hint">체육관 정보는 공개 자료를 정리한 것이고, 운영 시간·요금은 바뀔 수 있어요. ' +
      '가기 전에 전화로 한 번 확인하는 게 좋아요.</p>';
  }

  function headHtml(m) {
    var picking = !!optsRef.onPick;
    return '<header class="gympage__hdr">' +
      '<button type="button" class="iconbtn" data-gym-close aria-label="닫기">' +
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<div class="gympage__t"><b>' + (picking ? '체육관 고르기' : '체육관 지도') + '</b>' +
      '<span>서울·수도권 배드민턴 ' + G().count() + '곳</span></div>' +
      '<button type="button" class="gympage__all" data-gym-all>전체 보기</button>' +
      '</header>';
  }

  /* 화면에 보일 체육관 (즐겨찾기 먼저, 즐겨찾기만 보기·검색 반영) */
  function visible(m) {
    var favs = G().favorites(m.scope);
    var list = G().filter(G().all(), { onlyFav: m.onlyFav, favorites: favs, query: m.query });
    return G().withFavoritesFirst(list, favs);
  }

  /* 바깥에서 그대로 그려 볼 수 있는 순수 렌더 (테스트용) */
  function render(m) {
    var mm = {
      scope: (m && m.scope) || 'guest', onlyFav: !!(m && m.onlyFav),
      query: (m && m.query) || '', club: (m && m.club) || ''
    };
    return headHtml(mm) + '<div class="gympage__body" data-gymbody>' + bodyHtml(mm) + '</div>';
  }

  /* ---------- 지도 ---------- */
  function leaflet() {
    return (typeof window !== 'undefined' && window.L && window.L.map) ? window.L : null;
  }

  function mapHost() { return page ? page.querySelector('[data-gymmap]') : null; }

  function markerIcon(fav) {
    var L = leaflet();
    return L.divIcon({
      className: 'gypin-wrap',
      html: '<span class="gypin' + (fav ? ' is-fav' : '') + '">' +
        (fav ? '<b>★</b>' : '<i class="gypin__dot"></i>') + '</span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function initMap() {
    var host = mapHost();
    if (!host) return;
    var L = leaflet();
    if (!L) { host.classList.add('is-static'); return; }   /* Leaflet 없음 → % 핀 지도 그대로 */
    host.classList.add('is-live');
    map = L.map(host, {
      zoomControl: false, attributionControl: true, scrollWheelZoom: false,
      minZoom: 8, maxZoom: 18, worldCopyJump: false
    });
    map.attributionControl.setPrefix(false);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '지도 © OpenStreetMap'
    });
    tiles.on('tileerror', function () {
      if (tileBroken) return;
      tileBroken = true;
      host.classList.add('is-notiles');
    });
    tiles.addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    fitSeoul();
    syncMarkers();
  }

  function syncMarkers() {
    var L = leaflet();
    if (!L || !map || !markerLayer) return;
    markerLayer.clearLayers();
    visible(model).forEach(function (v) {
      var fav = G().isFav(model.scope, v.id);
      var mk = L.marker([v.lat, v.lng], { icon: markerIcon(fav), title: v.name, riseOnHover: true });
      mk.on('click', function () { raiseCard(v.id); });
      markerLayer.addLayer(mk);
    });
  }

  function fitAll() {
    var L = leaflet();
    if (!L || !map) return;
    var list = visible(model);
    if (!list.length) return;
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], 14, { animate: true }); return; }
    map.fitBounds(L.latLngBounds(list.map(function (v) { return [v.lat, v.lng]; })).pad(0.16),
      { animate: true, maxZoom: 13 });
  }

  /* 서울 시내만 담아 첫 화면을 잡습니다(나래울·동탄은 '전체 보기'에서) */
  function fitSeoul() {
    var L = leaflet();
    if (!L || !map) return;
    var list = G().seoulOnly(visible(model));
    if (list.length < 2) { fitAll(); return; }
    map.fitBounds(L.latLngBounds(list.map(function (v) { return [v.lat, v.lng]; })).pad(0.12),
      { animate: false, maxZoom: 12 });
  }

  function focusVenue(id) {
    var v = G().get(id);
    if (!v) return;
    if (map) {
      map.setView([v.lat, v.lng], 15, { animate: true });
      var host = mapHost();
      if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    raiseCard(id);
  }

  /* 카드로도 시선을 옮깁니다(핀을 눌렀을 때) */
  function raiseCard(id) {
    if (!page) return;
    var card = page.querySelector('[data-gym-card="' + id + '"]');
    if (!card) return;
    Array.prototype.forEach.call(page.querySelectorAll('.gymcard.is-focus'), function (n) {
      n.classList.remove('is-focus');
    });
    card.classList.add('is-focus');
    if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- 다시 그리기 (지도 상자는 그대로, 글자·핀만) ---------- */
  function refresh() {
    if (!page) return;
    function put(sel, html) {
      var node = page.querySelector(sel);
      if (node) node.innerHTML = html;
    }
    put('[data-gymfavs]', favSectionHtml(model));
    put('[data-gymseg]', segHtml(model));    put('[data-gympins]', pinsHtml(model));
    put('[data-gymnote]', mapNoteInner(model));
    put('[data-gymlist]', listHtml(model));
    syncMarkers();
    if (map) fitVisibleAfterChange();
  }

  /* 보기(전체/즐겨찾기만)를 바꿨을 때만 지도를 다시 맞춥니다 */
  var lastFitKey = '';
  function fitVisibleAfterChange() {
    var list = visible(model);
    var key = (model.onlyFav ? 'fav' : 'all') + ':' + list.map(function (v) { return v.id; }).join(',');
    if (key === lastFitKey) return;
    lastFitKey = key;
    if (!list.length) { fitSeoul(); return; }
    if (model.onlyFav) fitAll();
  }

  /* ---------- 열기 / 닫기 ---------- */
  function destroy() {
    if (map) { try { map.remove(); } catch (e) { /* 무시 */ } }
    map = null;
    markerLayer = null;
    tileBroken = false;
    if (page && page.parentNode) page.parentNode.removeChild(page);
    page = null;
    optsRef = {};
    if (typeof document !== 'undefined') document.body.classList.remove('no-scroll');
    if (typeof window !== 'undefined') window.removeEventListener('popstate', onPop);
  }

  function onPop() {
    if (!page) return;
    histHeld = false;
    UI.overlay.reset();
    var ctx = ctxRef;
    destroy();
    if (ctx && ctx.repaint) ctx.repaint();
  }

  function close() {
    if (!page) return;
    var held = histHeld;
    histHeld = false;
    var ctx = ctxRef;
    destroy();
    if (held) UI.overlay.close();
    if (ctx && ctx.repaint) ctx.repaint();
  }

  function scoped(scope) { return String(scope || 'guest').toLowerCase(); }

  function open(ctx, options) {
    if (typeof document === 'undefined') return null;
    if (page) close();
    ctxRef = ctx || null;
    optsRef = options || {};
    lastFitKey = '';
    var me = (ctx && ctx.store && ctx.store.state && ctx.store.state.me) || {};
    model = { scope: scoped(me.key), onlyFav: false, query: '', club: me.club || '' };

    page = document.createElement('div');
    page.id = 'gympage';
    page.className = 'gympage';
    page.setAttribute('role', 'dialog');
    page.setAttribute('aria-modal', 'true');
    page.setAttribute('aria-label', optsRef.onPick ? '체육관 고르기' : '체육관 지도');
    page.innerHTML = render(model);
    document.body.appendChild(page);
    document.body.classList.add('no-scroll');
    if (!histHeld) { histHeld = true; UI.overlay.open(); }
    if (typeof window !== 'undefined') window.addEventListener('popstate', onPop);
    bind(page, ctx);
    requestAnimationFrame(function () { if (page) page.classList.add('is-on'); });
    initMap();
    return page;
  }

  /* ---------- 동작 ---------- */
  function toggleFav(id, ctx) {
    var res = G().toggle(model.scope, id);
    if (!res.ok) return;
    UI.haptic(8);
    var v = G().get(id);
    UI.toast(res.added
      ? eul(v ? v.name : '체육관') + ' 자주 가는 곳에 담았어요'
      : '자주 가는 체육관에서 뺐어요');
    /* 즐겨찾기만 보기 중에 마지막 하나를 빼면 목록이 비므로 전체로 돌아옵니다 */
    if (model.onlyFav && !res.favorites.length) model.onlyFav = false;
    refresh();
  }

  function setClub(id, ctx) {
    var v = G().get(id);
    if (!v || !ctx || !ctx.actions) return;
    var before = (ctx.store && ctx.store.state && ctx.store.state.me && ctx.store.state.me.club) || '';
    ctx.actions.saveProfile({ club: v.name });
    UI.haptic(10);
    UI.toast(before === v.name ? '이미 주 체육관이에요' : '주 체육관을 ‘' + v.name + '’' + (hasBatchim(v.name) ? '으로' : '로') + ' 바꿨어요');
    refresh();
  }

  function pick(id) {
    var v = G().get(id);
    if (!v) return;
    if (typeof optsRef.onPick === 'function') {
      optsRef.onPick(v);
      close();
    }
  }

  function bind(root, ctx) {
    root.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-gym-close]')) { ev.preventDefault(); close(); return; }

      var fav = ev.target.closest('[data-gym-fav]');
      if (fav) { ev.preventDefault(); toggleFav(fav.getAttribute('data-gym-fav'), ctx); return; }

      var filter = ev.target.closest('[data-gym-filter]');
      if (filter) {
        ev.preventDefault();
        model.onlyFav = filter.getAttribute('data-gym-filter') === 'fav';
        UI.haptic(6);
        refresh();
        return;
      }

      var all = ev.target.closest('[data-gym-all]');
      if (all) { ev.preventDefault(); UI.haptic(6); fitAll(); return; }

      var jump = ev.target.closest('[data-gym-jump]');
      if (jump) { ev.preventDefault(); focusVenue(jump.getAttribute('data-gym-jump')); return; }

      var pin = ev.target.closest('[data-gym-pin]');
      if (pin) {
        ev.preventDefault();
        var pid = pin.getAttribute('data-gym-pin');
        if (optsRef.onPick) { pick(pid); return; }
        raiseCard(pid);
        var card = page && page.querySelector('[data-gym-card="' + pid + '"]');
        if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      var view = ev.target.closest('[data-gym-view]');
      if (view) { ev.preventDefault(); focusVenue(view.getAttribute('data-gym-view')); return; }

      var club = ev.target.closest('[data-gym-club]');
      if (club) { ev.preventDefault(); setClub(club.getAttribute('data-gym-club'), ctx); return; }

      var pickBtn = ev.target.closest('[data-gym-pick]');
      if (pickBtn) { ev.preventDefault(); pick(pickBtn.getAttribute('data-gym-pick')); return; }
    });
  }

  BM.views = BM.views || {};
  BM.views.gyms = {
    render: render,
    open: open,
    close: close,
    isOpen: function () { return !!page; },
    visible: visible,
    focusVenue: focusVenue
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
