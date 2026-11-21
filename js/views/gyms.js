/* ============================================================
 * views/gyms.js — 체육관 지도 화면 (지도 + 자주 가는 체육관)
 *
 *  어디서 열리나
 *   · 1:1 매칭 > 찾기 맨 위 '체육관 지도' 카드
 *   · 커뮤니티 '게스트 모집'의 '어디 체육관' 칸 옆 '지도에서 고르기'
 *
 *  무엇을 하나
 *   · 지도를 열면 전국 배드민턴 체육관 120곳이 처음부터 핀으로 찍혀 있습니다(v1.44.0).
 *   · 권역 칩(전체·서울·경기·인천·강원·제주·충청·전라·경상)과 검색창으로 원하는 지역을
 *     바로 좁혀 볼 수 있습니다(칩을 누르면 그 권역에 맞춰 지도도 이동).
 *   · 핀·카드의 별을 눌러 '자주 가는 체육관'을 등록/해제하면 이 기기에 저장됩니다.
 *     (계정마다 따로 · 서버로 보내지 않음)
 *   · '즐겨찾기만 보기'로 지도와 목록을 즐겨찾기만 남겨 볼 수 있습니다.
 *   · 카드의 '주 체육관으로'는 MY 프로필의 주 체육관 이름을 채웁니다.
 *   · '내 위치 기준'을 누르면 위치를 한 번만 받아 내 위치에서 가까운 순으로 정렬하고
 *     카드에 '약 X.X km'를 붙이며 지도를 내 위치 쪽으로 옮깁니다.
 *     위치를 거부하거나 위치를 못 쓰는 환경에서는 조용히 기본 목록을 그대로 보여 줍니다.
 *   · open(ctx, { focus: id }) / openVenue(ctx, id)는 그 체육관을 지도 가운데 두고
 *     이름·동네·주소·코트 수를 맨 위에 띄웁니다. 커뮤니티 모집글·MY·매칭 프로필의
 *     체육관 이름(data-gym-open)을 눌렀을 때 이 화면으로 이어집니다.
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
  var model = { scope: 'guest', onlyFav: false, query: '', region: 'all', club: '', geo: null, geoState: 'idle', focus: '' };
  var map = null;              /* Leaflet 지도 */
  var markerLayer = null;
  var meLayer = null;          /* 내 위치 점 */
  var histHeld = false;
  var tileBroken = false;

  /* ---------- HTML 조각 ---------- */
  function star(fav) { return fav ? '★' : '☆'; }

  /* 프로필·모집글의 체육관 이름 → 지도로 이어지는 작은 링크.
   * 등록된 체육관과 이어지지 않으면 빈 문자열을 돌려주고, 부르는 쪽이 글자만 보여 줍니다. */
  function gymLink(name) {
    if (!name) return '';
    var v = G().matchVenue(name);
    if (!v) return '';
    return '<button type="button" class="gymlink" data-gym-open="' + U.esc(v.id) + '"' +
      ' aria-label="' + U.esc(v.name + ' ' + v.area + ' · 지도에서 보기') + '">' +
      UI.icon('pin') + '<span>' + U.esc(String(name)) + '</span><i>지도</i></button>';
  }

  /* 이름이 등록된 체육관과 이어지면 링크, 아니면 글자 그대로 */
  function linkOrText(name) {
    if (!name) return '';
    return gymLink(name) || U.esc(String(name));
  }

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

  /* ---------- 내 위치 기준 (가까운 순) ----------
   * 위치는 이 버튼을 눌렀을 때 한 번만 받고, 서버로 보내지 않습니다. */
  function geoHtml(m) {
    var on = !!m.geo;
    var busy = m.geoState === 'locating';
    var label = busy ? '위치 확인 중…' : (on ? '가까운 순' : '내 위치 기준');
    var note = on
      ? '내 위치에서 가까운 순 · 해제하려면 한 번 더'
      : (m.geoState === 'off' ? '위치를 허용하면 가까운 순으로 보여 드려요' : '허용하면 가까운 곳부터 보여 드려요');
    return '<div class="gymgeo" data-gymgeo>' +
      '<button type="button" class="gymgeo__b' + (on ? ' is-on' : '') + '"' +
      ' data-gym-geo aria-pressed="' + (on ? 'true' : 'false') + '"' + (busy ? ' disabled' : '') + '>' +
      UI.icon('target') + label + '</button>' +
      '<span class="gymgeo__n">' + U.esc(note) + '</span></div>';
  }

  /* 모집글·프로필에서 체육관 이름을 눌러 들어왔을 때 맨 위에 띄우는 요약 */
  function focusHtml(m) {
    var v = m.focus ? G().get(m.focus) : null;
    if (!v) return '';
    var meta = [v.area, v.courts ? '코트 ' + v.courts + '면' : ''].filter(Boolean).join(' · ');
    return '<section class="gymfocus" data-gym-focuscard="' + U.esc(v.id) + '">' +
      '<div class="gymfocus__t">' +
      '<span class="pill pill--ok">지도에서 찾은 체육관</span>' +
      '<h3>' + U.esc(v.name) + '</h3>' +
      '<p class="gymfocus__meta">' + U.esc(meta) + '</p>' +
      (v.addr ? '<p class="gymfocus__row">' + UI.icon('pin') + '<span>' + U.esc(v.addr) + '</span></p>' : '') +
      (v.hours ? '<p class="gymfocus__row">' + UI.icon('clock') + '<span>' + U.esc(v.hours) + '</span></p>' : '') +
      '</div>' +
      '<button type="button" class="linkbtn gymfocus__all" data-gym-focus-clear>전체 지도</button>' +
      '</section>';
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

  /* ---------- 권역 칩 · 검색 (bm-v1.44.0) ----------
   * 120곳이 되면서 '내가 갈 동네'를 한 번에 좁히는 줄이 필요해졌습니다.
   * 칩 숫자는 지금 조건(즐겨찾기만·검색) 안에서 세어, 누르기 전에 몇 곳인지 보입니다. */
  function regionChipsHtml(m) {
    var G0 = G();
    var counts = G0.regionCounts(G0.filter(G0.all(), {
      onlyFav: m.onlyFav, favorites: G0.favorites(m.scope), query: m.query
    }));
    return '<div class="gymregions" data-gymregion role="group" aria-label="권역 고르기">' +
      G0.REGIONS.map(function (def) {
        var on = (m.region || 'all') === def.key;
        return '<button type="button" class="gymregion' + (on ? ' is-on' : '') + '"' +
          ' data-gym-region="' + U.esc(def.key) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
          U.esc(def.label) + '<i>' + (counts[def.key] || 0) + '</i></button>';
      }).join('') + '</div>';
  }

  function searchHtml(m) {
    /* × 버튼은 늘 그리고 CSS 로 숨깁니다 — 글자를 칠 때마다 다시 그리지 않아도 되게 */
    return '<label class="gymsearch' + (m.query ? ' has-q' : '') + '">' + UI.icon('search') +
      '<input type="search" data-gym-search value="' + U.esc(m.query) + '"' +
      ' placeholder="동네·체육관 이름으로 찾기" aria-label="체육관 검색"' +
      ' autocomplete="off" enterkeyhint="search">' +
      '<button type="button" class="gymsearch__x" data-gym-search-clear aria-label="검색어 지우기">' + UI.icon('close') + '</button>' +
      '</label>';
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
    var dist = (v.dist != null) ? '<span class="gymcard__dist">' + U.esc(G().distLabel(v.dist)) + '</span>' : '';
    var tags = (v.tags || []).map(function (t) {
      return '<span class="pill pill--ghost">' + U.esc(t) + '</span>';
    }).join('');
    var myGym = m.club ? G().matchVenue(m.club) : null;
    if (myGym && myGym.id === v.id) tags = '<span class="pill">내 주 체육관</span>' + tags;
    return '<article class="gymcard' + (fav ? ' is-fav' : '') + (m.focus === v.id ? ' is-focus' : '') + '" data-gym-card="' + U.esc(v.id) + '">' +
      '<div class="gymcard__head">' +
      '<div class="gymcard__t">' +
      '<h3>' + U.esc(v.name) + '</h3>' +
      '<p class="gymcard__meta">' + U.esc(meta) + dist + '</p>' +
      (tags ? '<div class="gymcard__tags">' + tags + '</div>' : '') +
      '</div>' +
      '<button type="button" class="gymstar' + (fav ? ' is-on' : '') + '" data-gym-fav="' + U.esc(v.id) + '"' +
      ' aria-pressed="' + (fav ? 'true' : 'false') + '" aria-label="' +
      (fav ? '자주 가는 체육관에서 빼기' : '자주 가는 체육관으로 등록') + '">' + star(fav) + '</button>' +
      '</div>' +
      (v.addr ? '<p class="gymcard__row"><span>주소</span>' + U.esc(v.addr) + '</p>' : '') +
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
    if (m.geo) {
      var near = list.length && list[0].dist != null ? G().distLabel(list[0].dist) : '';
      return noteText('내 위치에서 가까운 순' + (near ? ' · 가장 가까운 곳 <b>' + U.esc(near) + '</b>' : '') +
        ' · ' + list.length + '곳');
    }
    if (m.onlyFav) return noteText('자주 가는 체육관 <b>' + list.length + '곳</b>만 지도에 보여요');
    if (list.length !== G().count() && !m.geo) {
      var where = (G().regionDef(m.region).match ? G().regionDef(m.region).label : '');
      var head = m.query ? '검색 결과 <b>' + list.length + '곳</b>' : where + ' <b>' + list.length + '곳</b>만';
      return noteText(head + ' 지도에 보여요' + (where && m.query ? ' · ' + where : ''));
    }
    var seoul = list.filter(function (v) { return v.region === '서울'; }).length;
    return noteText('전국 배드민턴 <b>' + list.length + '곳</b>이 지도에 보여요 · 서울 ' + seoul + '곳');
  }

  function segHost(m) { return '<div data-gymseg>' + segHtml(m) + '</div>'; }

  function bodyHtml(m) {
    return '<div data-gymfocus>' + focusHtml(m) + '</div>' +
      '<div data-gymfavs>' + favSectionHtml(m) + '</div>' + segHost(m) +
      '<div class="gymfilters">' + searchHtml(m) + '<div data-gymreghost>' + regionChipsHtml(m) + '</div></div>' +
      '<div data-gymgeohost>' + geoHtml(m) + '</div>' +
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
      '<span>전국 배드민턴 ' + G().count() + '곳 · 7개 권역</span></div>' +
      '<button type="button" class="gympage__all" data-gym-all>전체 보기</button>' +
      '</header>';
  }

  /* 화면에 보일 체육관 (가까운 순 · 즐겨찾기 먼저, 즐겨찾기만 보기·검색 반영)
   * 특정 체육관으로 들어왔으면 그 카드가 맨 앞에 옵니다. */
  function visible(m) {
    var favs = G().favorites(m.scope);
    var list = G().filter(G().all(), {
      onlyFav: m.onlyFav, favorites: favs, query: m.query, region: m.region
    });
    /* '내 위치 기준'을 켜면 거리 순서가 우선합니다(즐겨찾기는 별 표시로 남김) */
    var out = m.geo ? G().nearby(list, m.geo) : G().withFavoritesFirst(list, favs);
    if (m.focus) {
      for (var i = 1; i < out.length; i++) {
        if (out[i].id === m.focus) { out.unshift(out.splice(i, 1)[0]); break; }
      }
    }
    return out;
  }

  /* 바깥에서 그대로 그려 볼 수 있는 순수 렌더 (테스트용) */
  function render(m) {
    var mm = {
      scope: (m && m.scope) || 'guest', onlyFav: !!(m && m.onlyFav),
      query: (m && m.query) || '', club: (m && m.club) || '',
      region: (m && m.region) || 'all',
      geo: (m && m.geo) || null, geoState: (m && m.geoState) || 'idle',
      focus: (m && m.focus) || ''
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
      minZoom: 5, maxZoom: 18, worldCopyJump: false,
      /* 전국이 한 화면에 차도록 소수 줌을 허용합니다(정수 줌이면 5와 6 사이에서 한참 작아짐) */
      zoomSnap: 0.25, zoomDelta: 0.5
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
    syncMe();
  }

  /* 내 위치 점 — 위치를 허용했을 때만, 지도 위에 하나 */
  function syncMe() {
    var L = leaflet();
    if (!L || !map) return;
    if (meLayer) { try { map.removeLayer(meLayer); } catch (e) { /* 무시 */ } meLayer = null; }
    if (!model.geo) return;
    meLayer = L.layerGroup().addTo(map);
    meLayer.addLayer(L.marker([model.geo.lat, model.geo.lng], {
      icon: L.divIcon({
        className: 'gyme-wrap',
        html: '<span class="gyme"><i></i></span>',
        iconSize: [20, 20], iconAnchor: [10, 10]
      }),
      title: '내 위치', keyboard: false, interactive: false, zIndexOffset: -200
    }));
  }

  /* 내 위치 + 가까운 체육관이 한 화면에 들도록 (먼 곳까지 담아 너무 멀어지지 않게) */
  function fitNear() {
    var L = leaflet();
    if (!L || !map || !model.geo) return;
    var pts = [[model.geo.lat, model.geo.lng]].concat(visible(model).slice(0, 8).map(function (v) {
      return [v.lat, v.lng];
    }));
    if (pts.length === 1) { map.setView(pts[0], 13, { animate: true }); return; }
    map.fitBounds(L.latLngBounds(pts).pad(0.14), { animate: true, maxZoom: 12 });
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

  /* 지금 화면에 보이는 체육관이 모두 들어오게 (권역·검색·가까운 순 그대로) */
  function fitVisible(animate) {
    var L = leaflet();
    if (!L || !map) return;
    var list = visible(model);
    if (!list.length) return;
    if (list.length === 1) { map.setView([list[0].lat, list[0].lng], 14, { animate: !!animate }); return; }
    map.fitBounds(L.latLngBounds(list.map(function (v) { return [v.lat, v.lng]; })).pad(0.1),
      { animate: !!animate, maxZoom: 13 });
  }

  /* 예전 이름 — 부르는 곳이 많아 그대로 둡니다(이제 전국/권역 기준) */
  function fitSeoul() { fitVisible(false); }

  function focusVenue(id) {
    var v = G().get(id);
    if (!v) return;
    if (model.focus !== id) { model.focus = id; refresh(); }
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
    put('[data-gymfocus]', focusHtml(model));
    put('[data-gymfavs]', favSectionHtml(model));
    put('[data-gymseg]', segHtml(model));
    put('[data-gymreghost]', regionChipsHtml(model));
    put('[data-gymgeohost]', geoHtml(model));
    put('[data-gympins]', pinsHtml(model));
    put('[data-gymnote]', mapNoteInner(model));
    put('[data-gymlist]', listHtml(model));
    syncMarkers();
    syncMe();
    if (map && !model.geo) fitVisibleAfterChange();
  }

  /* 보기(전체/즐겨찾기만)·권역·검색이 바뀌면 그 결과가 다 들어오게 지도를 맞춥니다 */
  var lastFitKey = '';
  function fitVisibleAfterChange() {
    var list = visible(model);
    var key = (model.onlyFav ? 'fav' : 'all') + ':' + (model.region || 'all') + ':' +
      (model.query || '') + ':' + (model.geo ? 'geo' : '') + ':' +
      (list.length <= 12 ? list.map(function (v) { return v.id; }).join(',') : list.length);
    if (key === lastFitKey) return;
    lastFitKey = key;
    if (!list.length) return;
    fitVisible(true);
  }

  /* ---------- 열기 / 닫기 ---------- */
  function destroy() {
    if (map) { try { map.remove(); } catch (e) { /* 무시 */ } }
    map = null;
    markerLayer = null;
    meLayer = null;
    tileBroken = false;
    if (page && page.parentNode) page.parentNode.removeChild(page);
    page = null;
    optsRef = {};
    /* 시트 위에 올려 열었을 때는 시트가 아직 스크롤을 잡고 있으므로 그대로 둡니다 */
    if (typeof document !== 'undefined' && !document.getElementById('sheet')) {
      document.body.classList.remove('no-scroll');
    }
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

  /* 위치를 한 번만 받습니다 — 실패·거부·미지원은 모두 null 로 돌려줍니다(조용한 폴백). */
  function locate(cb) {
    var done = false;
    function finish(r) { if (done) return; done = true; cb(r); }
    var geo = (typeof navigator !== 'undefined') ? navigator.geolocation : null;
    if (!geo || typeof geo.getCurrentPosition !== 'function') { finish(null); return; }
    var timer = setTimeout(function () { finish(null); }, 10000);
    try {
      geo.getCurrentPosition(function (pos) {
        clearTimeout(timer);
        var p = G().pointOf({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        finish(p);
      }, function () {
        clearTimeout(timer);
        finish(null);
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    } catch (e) {
      clearTimeout(timer);
      finish(null);
    }
  }

  /* '내 위치 기준' 버튼 — 켜면 가까운 순, 다시 누르면 해제 */
  function toggleGeo() {
    if (model.geoState === 'locating') return;
    if (model.geo) {
      model.geo = null;
      model.geoState = 'idle';
      UI.haptic(6);
      refresh();
      fitSeoul();
      return;
    }
    model.geoState = 'locating';
    refresh();
    locate(function (pos) {
      if (!page) return;
      if (!pos) {
        /* 거부·미지원·시간 초과 — 목록은 그대로 두고 안내 문구만 부드럽게 */
        model.geo = null;
        model.geoState = 'off';
        refresh();
        return;
      }
      model.geo = pos;
      model.geoState = 'on';
      UI.haptic(8);
      refresh();
      fitNear();
    });
  }

  function open(ctx, options) {
    if (typeof document === 'undefined') return null;
    if (page) close();
    ctxRef = ctx || null;
    optsRef = options || {};
    lastFitKey = '';
    var me = (ctx && ctx.store && ctx.store.state && ctx.store.state.me) || {};
    model = {
      scope: scoped(me.key), onlyFav: false, query: '', region: 'all', club: me.club || '',
      geo: null, geoState: 'idle', focus: optsRef.focus ? String(optsRef.focus) : ''
    };

    page = document.createElement('div');
    page.id = 'gympage';
    page.className = 'gympage';
    /* 시트(모집글 작성·프로필 꾸미기) 위에서 연 경우 시트보다 위에 띄웁니다 */
    if (document.getElementById('sheet')) page.style.zIndex = '96';
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
    /* 모집글·프로필에서 특정 체육관으로 들어왔을 때 — 지도를 그 곳에 두고 요약을 위에 */
    if (model.focus) {
      var fv = G().get(model.focus);
      if (fv && map) map.setView([fv.lat, fv.lng], 15, { animate: false });
    }
    return page;
  }

  /* 다른 화면의 체육관 이름에서 이어지는 입구 */
  function openVenue(ctx, id) {
    var v = G().get(id);
    if (!v) return null;
    return open(ctx, { focus: v.id });
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

      /* 권역 칩 — 누르면 그 권역만 남기고 지도를 그 권역에 맞춥니다 */
      var reg = ev.target.closest('[data-gym-region]');
      if (reg) {
        ev.preventDefault();
        var key = reg.getAttribute('data-gym-region') || 'all';
        if (model.region !== key) {
          model.region = key;
          model.focus = '';
          UI.haptic(6);
          refresh();
        }
        return;
      }

      if (ev.target.closest('[data-gym-search-clear]')) {
        ev.preventDefault();
        model.query = '';
        var host = page && page.querySelector('.gymsearch');
        var box = page && page.querySelector('[data-gym-search]');
        if (box) box.value = '';
        if (host) host.classList.remove('has-q');
        UI.haptic(6);
        refresh();
        return;
      }

      var geoBtn = ev.target.closest('[data-gym-geo]');
      if (geoBtn) { ev.preventDefault(); toggleGeo(); return; }

      if (ev.target.closest('[data-gym-focus-clear]')) {
        ev.preventDefault();
        model.focus = '';
        refresh();
        fitSeoul();
        return;
      }

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

    /* 검색 — 한 글자 치고 바로 거르되, 줄마다 다시 그리지 않게 120ms 만 기다립니다 */
    var searchTimer = null;
    root.addEventListener('input', function (ev) {
      var box = ev.target.closest && ev.target.closest('[data-gym-search]');
      if (!box) return;
      var val = box.value || '';
      var host = box.closest('.gymsearch');
      if (host) host.classList.toggle('has-q', !!val);
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchTimer = null;
        if (!page) return;
        /* 입력 칸은 그대로 두고 목록·핀·안내만 바꿉니다(커서가 날아가지 않게) */
        model.query = val;
        refresh();
      }, 120);
    });
    root.addEventListener('search', function (ev) {
      var box = ev.target.closest && ev.target.closest('[data-gym-search]');
      if (!box) return;
      model.query = box.value || '';
      refresh();
    });
  }

  BM.views = BM.views || {};
  BM.views.gyms = {
    render: render,
    open: open,
    openVenue: openVenue,
    close: close,
    isOpen: function () { return !!page; },
    visible: visible,
    focusVenue: focusVenue,
    link: gymLink,
    linkOrText: linkOrText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
