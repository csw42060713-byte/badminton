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
 *  내 집 반경 5km · 동네 동호인 · 운동 상태 (2026-11-21 추가, js/nearby.js)
 *   · '내 집'을 기준으로 반경 5km 원을 지도에 그리고, 그 안의 동호인을 사람 아이콘으로 찍습니다.
 *     내 집은 '내 집 바꾸기'(현재 위치·동네 프리셋·지도에서 찍기)로 이 기기에만 저장합니다.
 *   · 사람마다 파란 불: 지금 운동 중이거나 운동 가능 시간이면 켜지고,
 *     운동이 끝났거나 운동 가능 시간이 아니면 꺼집니다.
 *   · 내 상태 카드에서 '운동 중'·'지금 운동 가능'을 켜고 끄고, 운동 가능 시간대를 고릅니다.
 *   · 지도 안에서 게스트 모집 글을 보고, 그 자리에서 모집 글을 올릴 수 있습니다.
 *
 *  오프라인·타일 실패
 *   · Leaflet 을 못 불러오면 좌표를 % 위치로 계산한 핀 지도를 그립니다(핀·카드 그대로).
 *   · 타일만 실패하면 지도 바탕에 안내 한 줄을 띄우고 핀은 그대로 둡니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, UI = BM.ui, D = BM.domain;

  function G() { return BM.gyms; }
  function N() { return BM.nearby; }

  /* 파란 불 색 — 앱 테마와 상관없이 '운동 중·운동 가능'을 같은 색으로 읽게 합니다 */
  var LIVE = '#3b82f6';

  var page = null;             /* 지금 열린 화면 DOM */
  var ctxRef = null;
  var optsRef = {};            /* { onPick, now } */
  var model = {
    scope: 'guest', onlyFav: false, query: '', region: 'all', club: '', geo: null, geoState: 'idle', focus: '',
    home: null, posts: [], profiles: [], now: null,
    onlyLit: false, recruitOpen: false, draft: null, pickHome: false
  };
  var map = null;              /* Leaflet 지도 */
  var markerLayer = null;
  var meLayer = null;          /* 내 위치 점 */
  var homeLayer = null;        /* 내 집 점 + 반경 5km 원 */
  var peopleLayer = null;      /* 동네 동호인 */
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

  /* ============================================================
   * 내 집 · 반경 5km 동네 동호인 · 운동 상태 (2026-11-21)
   * ============================================================ */
  function nowOf(m) {
    if (m && m.now instanceof Date) return m.now;
    if (m && typeof m.now === 'string') {
      var d = new Date(m.now);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  function homeOf(m) { return (m && m.home) || N().home(m && m.scope); }

  function lamp(live) { return '<i class="lamp' + (live ? ' lamp--live' : '') + '" aria-hidden="true"></i>'; }

  function initial(name) {
    var s = String(name == null ? '' : name).trim();
    return s ? s.charAt(0) : '?';
  }

  /* 켜고 끄는 스위치 — MY의 스위치와 같은 동작(role="switch") */
  function switchHtml(label, on, attr) {
    return '<button type="button" class="mswitch' + (on ? ' is-on' : '') + '" role="switch" aria-checked="' +
      (on ? 'true' : 'false') + '" ' + attr + ' aria-label="' + U.esc(label) + ' ' + (on ? '끄기' : '켜기') + '">' +
      '<i aria-hidden="true"></i><span>' + U.esc(label) + '</span></button>';
  }

  function rangesHtml(st) {
    return N().RANGES.map(function (r) {
      var on = st.rangeId === r.id || (r.from === st.from && r.to === st.to);
      return '<button type="button" class="mchip' + (on ? ' is-on' : '') + '" data-mystat-range="' +
        U.esc(r.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(r.label) + '</button>';
    }).join('');
  }

  /* 내 상태 카드 — 지금 내 불이 켜졌는지, 왜 켜졌는지(운동 중 / 운동 가능 시간) */
  function myStatHtml(m) {
    var st = N().myStatus(m.scope);
    var status = N().statusOf(N().meAsPerson(st), nowOf(m));
    return '<section class="mystat' + (status.lit ? ' is-lit' : '') + '" data-gymmystat>' +
      '<div class="mystat__top">' +
      '<span class="mystat__lamp">' + lamp(status.lit) + '</span>' +
      '<div class="mystat__t"><b>내 상태 · ' + (status.lit ? '파란 불 켜짐' : '불 꺼짐') + '</b>' +
      '<p data-mystat-line>' + U.esc(status.label) + (status.range ? ' · ' + U.esc(status.range) : '') + '</p></div>' +
      '<span class="mystat__pill" data-mystat-pill>' + U.esc(status.lit ? '켜짐' : '꺼짐') + '</span>' +
      '</div>' +
      '<div class="mystat__sw">' +
      switchHtml('운동 중', !!st.working, 'data-mystat-work') +
      switchHtml('지금 운동 가능', !!st.freeNow, 'data-mystat-free') +
      '</div>' +
      '<div class="mystat__ranges" data-mystat-ranges>' + rangesHtml(st) + '</div>' +
      '</section>';
  }

  /* 내 집(기준 위치) 줄 — 반경 5km 원의 중심 */
  function homeRowHtml(m) {
    var h = homeOf(m);
    var label = (h && h.label) || '기준 위치';
    return '<section class="gymhome" data-gymhome>' +
      '<span class="gymhome__ic" aria-hidden="true">🏠</span>' +
      '<div class="gymhome__t"><b>내 집 · ' + U.esc(label) +
      (h && h.demo ? '<span class="gymhome__demo">예시</span>' : '') + '</b>' +
      '<p>이 집 반경 <b>5km</b> · 지도에 원으로 표시</p></div>' +
      '<button type="button" class="btn btn--ghost btn--sm gymhome__b" data-gym-home>내 집 바꾸기</button>' +
      '</section>';
  }

  /* 반경 안 동호인 (상태 포함) — 지도·목록·안내가 같은 계산을 씁니다 */
  function peopleOf(m) {
    var origin = homeOf(m);
    var list = N().all({ me: { key: m.scope }, data: { matchProfiles: (m && m.profiles) || [] } });
    var inside = N().near(list, origin).map(function (p) {
      p.status = N().statusOf(p, nowOf(m));
      return p;
    });
    return { inside: inside, outside: N().outside(list, origin), home: origin };
  }

  /* 동호인 한 명 — 지도 바로 위에 가로로 늘어놓는 카드 (불 켜짐/꺼짐이 한눈에) */
  function personRowHtml(p) {
    var st = p.status;
    return '<button type="button" class="nearp' + (st.lit ? ' is-lit' : '') + '" data-gym-person="' + U.esc(p.id) + '"' +
      ' aria-label="' + U.esc(p.name + ' ' + st.label) + '">' +
      '<span class="nearp__top"><span class="nearp__av">' + U.esc(initial(p.name)) + '</span>' +
      '<span class="nearp__t"><b>' + U.esc(p.name) + '</b>' +
      '<small>' + U.esc(p.level || '동호인') + ' · ' + U.esc(G().distLabel(p.dist)) + '</small></span></span>' +
      '<span class="nearp__s is-' + st.key + '">' + lamp(st.lit) + U.esc(st.label) + '</span>' +
      '</button>';
  }

  function nearHtml(m) {
    var pack = peopleOf(m);
    var lit = pack.inside.filter(function (p) { return p.status.lit; }).length;
    var rows = m.onlyLit ? pack.inside.filter(function (p) { return p.status.lit; }) : pack.inside;
    var head = '<div class="near__head">' +
      '<h3>반경 5km 동네 동호인<span class="near__demo">예시</span></h3>' +
      '<button type="button" class="mchip near__only' + (m.onlyLit ? ' is-on' : '') + '" data-gym-onlylit' +
      ' aria-pressed="' + (m.onlyLit ? 'true' : 'false') + '">' + lamp(true) + '불 켜진 사람만</button>' +
      '</div>' +
      '<p class="near__sum" data-near-sum>파란 불 <b>' + lit + '명</b> · 운동 중 ' +
      pack.inside.filter(function (p) { return p.status.working; }).length + '명' +
      (pack.outside ? ' · 5km 밖 ' + pack.outside + '명은 뺐어요' : '') + '</p>';
    var body = rows.length
      ? '<div class="nearlist">' + rows.map(personRowHtml).join('') + '</div>'
      : '<p class="near__empty">' + lamp(true) + '지금 불이 켜진 동호인이 없어요. 운동 가능 시간을 켜 두면 여기에 보여요.</p>';
    return '<section class="near" data-gymnear>' + head + body + '</section>';
  }

  /* ---------- 지도 안 게스트 모집 ----------
   * 반경 5km 안 체육관의 모집 글을 지도 화면에서 바로 보고,
   * 그 자리에서 모집 글을 올립니다(커뮤니티 '게스트 모집'과 같은 글). */
  function recruitsOf(m) {
    var origin = homeOf(m);
    var list = [];
    ((m && m.posts) || []).forEach(function (p) {
      var mt = p && p.meet;
      if (!D.meetFilled(mt)) return;
      var v = mt.place ? G().matchVenue(mt.place) : null;
      list.push({ post: p, meet: mt, venue: v, dist: v ? G().distanceKm(origin, v) : null });
    });
    list.sort(function (a, b) { return String(b.post.createdAt || '').localeCompare(String(a.post.createdAt || '')); });
    return list;
  }

  function recruitCardHtml(r, m) {
    var p = r.post, mt = r.meet;
    var meKey = m.scope || '';
    var mine = !!(p.userKey && meKey && String(p.userKey) === String(meKey));
    var st = D.meetStatus((m.idx || null), p, meKey);
    var closed = !!(st && st.closed);
    var meta = [
      mt.cap ? mt.cap + '명' : '',
      st && st.cap ? st.count + '/' + st.cap : '',
      D.meetFeeText(mt)
    ].filter(Boolean).join(' · ');
    return '<article class="rcard" data-gym-recruit-card="' + U.esc(p.id) + '">' +
      '<div class="rcard__top">' +
      '<b>' + U.esc((r.venue && r.venue.name) || mt.place || '체육관 미정') + '</b>' +
      (r.dist != null ? '<span class="rcard__dist">' + U.esc(G().distLabel(r.dist)) + '</span>' : '') +
      (closed ? '<span class="pill pill--closed">마감</span>' : (mine ? '<span class="pill">내 글</span>' : '')) +
      '</div>' +
      '<p class="rcard__row">' + UI.icon('clock') + '<span>' + U.esc(mt.when || '일시는 문의해서 정해요') + '</span></p>' +
      (meta ? '<p class="rcard__row">' + UI.icon('users') + '<span>' + U.esc(meta) + '</span></p>' : '') +
      (p.text ? '<p class="rcard__text">' + U.esc(p.text) + '</p>' : '') +
      '<div class="rcard__act">' +
      '<button type="button" class="btn btn--primary btn--sm" data-gym-recruit-open="' + U.esc(p.id) + '">' +
      (mine ? '단체방 열기' : (closed ? '대기 문의' : '참여 문의')) + '</button>' +
      (r.venue ? '<button type="button" class="btn btn--ghost btn--sm" data-gym-view="' + U.esc(r.venue.id) + '">지도에서 보기</button>' : '') +
      '</div></article>';
  }

  function recruitFormHtml(m) {
    var d = (m && m.draft) || {};
    /* 내 집에서 가까운 체육관 4곳 — 반경 밖이어도 골라서 모집할 수 있습니다 */
    var gyms = G().nearby(G().all(), homeOf(m)).slice(0, 4);
    return '<div class="rform" data-gymrecform>' +
      '<label class="rform__f"><span>어디 체육관</span>' +
      '<input type="text" maxlength="30" data-gymrec="place" enterkeyhint="next" placeholder="동네 체육관 이름" value="' +
      U.esc(d.place || '') + '"></label>' +
      '<div class="chips rform__chips">' + gyms.map(function (v) {
        return '<button type="button" class="mchip' + (d.place === v.name ? ' is-on' : '') + '" data-gymrec-place="' +
          U.esc(v.name) + '" aria-pressed="' + (d.place === v.name ? 'true' : 'false') + '">' + U.esc(v.name) + '</button>';
      }).join('') + '</div>' +
      '<div class="rform__grid">' +
      '<label class="rform__f"><span>언제</span>' +
      '<input type="text" maxlength="30" data-gymrec="when" enterkeyhint="next" placeholder="오늘 20:30" value="' +
      U.esc(d.when || '') + '"></label>' +
      '<label class="rform__f"><span>몇 명</span>' +
      '<input type="text" inputmode="numeric" maxlength="3" data-gymrec="cap" enterkeyhint="done" placeholder="4" value="' +
      U.esc(d.cap || '') + '"></label>' +
      '</div>' +
      '<p class="rform__lab">게스트비</p>' +
      '<div class="chips rform__chips" data-gymrec-fee>' + D.MEET.feeChips.map(function (f) {
        var on = String(d.fee || '') === f;
        return '<button type="button" class="mchip' + (on ? ' is-on' : '') + '" data-gymrec-feeval="' + U.esc(f) +
          '" aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(f) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn btn--primary rform__go" data-gym-recruit-post>' + UI.icon('bolt') + '모집 올리기</button>' +
      '</div>';
  }

  function recruitHtml(m) {
    var all = recruitsOf(m);
    var inside = all.filter(function (r) { return r.venue && r.dist != null && r.dist <= N().RADIUS_KM; });
    var far = all.length - inside.length;
    var body = inside.length
      ? '<div class="recruit__list">' + inside.map(function (r) { return recruitCardHtml(r, m); }).join('') + '</div>'
      : '<p class="recruit__empty">' + UI.icon('bolt') + '<span>반경 5km 안에 올라온 모집 글이 아직 없어요. 첫 모집 글을 올려 보세요.</span></p>';
    return '<section class="recruit" data-gymrecruit>' +
      '<div class="recruit__head"><h3>' + UI.icon('bolt') + '지도 안 게스트 모집</h3>' +
      '<button type="button" class="btn btn--primary btn--sm recruit__new" data-gym-recruit-new>' +
      (m.recruitOpen ? '닫기' : '모집 글 쓰기') + '</button></div>' +
      '<p class="recruit__sum" data-recruit-sum>반경 5km 안 모집 <b>' + inside.length + '건</b>' +
      (far ? ' · 그 밖 ' + far + '건' : '') + '</p>' +
      (m.recruitOpen ? recruitFormHtml(m) : '') +
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

  /* 오프라인(Leaflet 없음) 핀 지도 — 체육관 + 내 집 + 반경 5km 원 + 동호인을 % 위치로 */
  function homeBox(h, km) {
    var dLat = (km || N().RADIUS_KM) / 111.32;
    var dLng = (km || N().RADIUS_KM) / (111.32 * Math.cos((h.lat || 37.5) * Math.PI / 180));
    return { latMin: h.lat - dLat, latMax: h.lat + dLat, lngMin: h.lng - dLng, lngMax: h.lng + dLng };
  }

  function boxPos(box, lat, lng, raw) {
    var x = ((lng - box.lngMin) / (box.lngMax - box.lngMin)) * 100;
    var y = ((box.latMax - lat) / (box.latMax - box.latMin)) * 100;
    if (!raw && (x < -4 || x > 104 || y < -4 || y > 104)) return null;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }

  function nearPinsHtml(m) {
    var h = homeOf(m);
    if (!h) return '';
    var box = homeBox(h);
    var out = '<span class="gymring" aria-hidden="true"></span>';
    var hp = boxPos(box, h.lat, h.lng);
    if (hp) {
      out += '<span class="gymhome-pin is-flat" style="left:' + hp.x + '%;top:' + hp.y + '%" aria-hidden="true">🏠</span>';
    }
    var pack = peopleOf(m);
    out += pack.inside.filter(function (p) { return !m.onlyLit || p.status.lit; }).map(function (p) {
      var pos = boxPos(box, p.lat, p.lng);
      if (!pos) return '';
      return '<button type="button" class="gymp is-flat' + (p.status.lit ? ' is-lit' : '') + '"' +
        ' style="left:' + pos.x + '%;top:' + pos.y + '%" data-gym-person="' + U.esc(p.id) + '"' +
        ' aria-label="' + U.esc(p.name + ' ' + p.status.label) + '"><i>' + U.esc(initial(p.name)) + '</i></button>';
    }).join('');
    return out;
  }

  function pinsHtml(m) {
    var list = visible(m);
    var h = homeOf(m);
    var pts;
    if (h) {
      /* 내 집 반경 5km와 같은 좌표계로 찍습니다 — 밖에 있는 체육관은 지도 밖으로 나가 가려집니다 */
      var box = homeBox(h);
      pts = list.map(function (v) {
        var p = boxPos(box, v.lat, v.lng, true);
        return { id: v.id, x: p.x, y: p.y };
      });
    } else {
      pts = list.length ? G().project(list) : [];
    }
    var pins = pts.map(function (p) {
      var v = G().get(p.id) || {};
      var fav = G().isFav(m.scope, p.id);
      return '<button type="button" class="gympin' + (fav ? ' is-fav' : '') + '"' +
        ' style="left:' + p.x + '%;top:' + p.y + '%"' +
        ' data-gym-pin="' + U.esc(p.id) + '" aria-label="' + U.esc(v.name) + '">' +
        (fav ? '<b>★</b>' : '<i class="gypin__dot"></i>') + '</button>';
    }).join('');
    /* 사람 아이콘은 체육관 핀 위에 (오프라인) */
    return pins + nearPinsHtml(m);
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
    /* 이 체육관의 모집 글 수 — 카드에서 바로 모집을 열 수 있게 */
    var recCount = recruitsOf(m).filter(function (r) { return r.venue && r.venue.id === v.id; }).length;
    if (recCount) tags = '<span class="pill pill--live">모집 ' + recCount + '</span>' + tags;
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
      '</div>' +
      '<button type="button" class="gymcard__rec" data-gym-recruit-gym="' + U.esc(v.id) + '">' +
      UI.icon('users') + '이 체육관에서 게스트 모집' + (recCount ? ' · ' + recCount + '건' : '') + '</button>' +
      '</article>';
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
    var pack = peopleOf(m);
    /* 내 집을 정해 두었을 때만 반경 5km 안 동호인 수를 셉니다 */
    var mine = homeOf(m) ? '동호인 <b>' + pack.inside.length + '명</b> · 파란 불 <b>' +
      pack.inside.filter(function (p) { return p.status.lit; }).length + '명</b>' : '';
    var head = '';
    if (list.length !== G().count() && !m.geo) {
      var where = (G().regionDef(m.region).match ? G().regionDef(m.region).label : '');
      head = m.query ? '검색 결과 <b>' + list.length + '곳</b>' : where + ' <b>' + list.length + '곳</b>만';
      head += ' 지도에 보여요' + (where && m.query ? ' · ' + where : '');
    }
    if (!head) {
      var seoul = list.filter(function (v) { return v.region === '서울'; }).length;
      head = '전국 배드민턴 <b>' + list.length + '곳</b>이 지도에 보여요 · 서울 ' + seoul + '곳';
      /* 내 집 5km로 보고 있으면 지도에는 그 근처만 보입니다 — 전국은 '전체 보기'로 */
      if (mine) head = '전국 배드민턴 <b>' + list.length + '곳</b> · 서울 ' + seoul + '곳은 <b>전체 보기</b>에서';
    }
    return noteText(mine ? '내 집 반경 5km · ' + mine + ' · ' + head : head);
  }

  /* 지도 범례 — 파란 불이 무엇을 뜻하는지 한 줄로 */
  function legendHtml() {
    return '<span>' + lamp(true) + '운동 중 · 운동 가능 시간</span>' +
      '<span>' + lamp(false) + '운동 끝 · 운동 시간 아님</span>';
  }

  function segHost(m) { return '<div data-gymseg>' + segHtml(m) + '</div>'; }

  function bodyHtml(m) {
    /* 내 상태·내 집·동네 동호인 → 즐겨찾기 → 검색·권역 → 내 위치 → 지도 → 모집 → 목록
     * (반경 5km 기능과 권역 칩·검색을 함께 살린 순서) */
    return '<div data-gymfocus>' + focusHtml(m) + '</div>' +
      '<div data-gymmystat>' + myStatHtml(m) + '</div>' +
      '<div data-gymhome>' + homeRowHtml(m) + '</div>' +
      '<div data-gymnear>' + nearHtml(m) + '</div>' +
      '<div data-gymfavs>' + favSectionHtml(m) + '</div>' + segHost(m) +
      '<div class="gymfilters">' + searchHtml(m) + '<div data-gymreghost>' + regionChipsHtml(m) + '</div></div>' +
      '<div data-gymgeohost>' + geoHtml(m) + '</div>' +
      '<div class="gymmapwrap">' +
      /* 지도 상자(data-gymmap)는 다시 그려도 그대로 둡니다 — Leaflet 인스턴스가 그 안에 살아 있습니다 */
      '<div class="gymmap" data-gymmap>' +
      '<div class="gymmap__fallback" data-gympins aria-hidden="true">' + pinsHtml(m) + '</div>' +
      '</div>' +
      '<p class="gymmap__note" data-gymnote>' + mapNoteInner(m) + '</p>' +
      '<p class="gymmap__legend" data-gymlegend>' + legendHtml() + '</p>' +
      '</div>' +
      '<div data-gymrecruit>' + recruitHtml(m) + '</div>' +
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

  /* 바깥에서 그대로 그려 볼 수 있는 순수 렌더 (테스트용)
   *  now·posts·profiles·home 을 넘기면 그 값으로 그립니다(시간에 기대지 않는 검사용). */
  function render(m) {
    var mm = {
      scope: (m && m.scope) || 'guest', onlyFav: !!(m && m.onlyFav),
      query: (m && m.query) || '', club: (m && m.club) || '',
      region: (m && m.region) || 'all',
      geo: (m && m.geo) || null, geoState: (m && m.geoState) || 'idle',
      focus: (m && m.focus) || '',
      home: (m && m.home) || null, posts: (m && m.posts) || [],
      profiles: (m && m.profiles) || [], idx: (m && m.idx) || null,
      now: (m && m.now) || null, onlyLit: !!(m && m.onlyLit),
      recruitOpen: !!(m && m.recruitOpen),
      draft: (m && m.draft) || null
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
    homeLayer = L.layerGroup().addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    peopleLayer = L.layerGroup().addTo(map);
    /* 지도에서 '내 집 찍기' 모드일 때만 누른 자리를 내 집으로 */
    map.on('click', onMapClick);
    fitHome();
    /* 화면을 열 때 맞춘 구도(내 집 반경 5km)를 기준으로 삼습니다 */
    lastFitKey = viewKey();
    syncHome();
    syncMarkers();
    syncPeople();
    syncMe();
  }

  /* ---------- 내 집 점 · 반경 5km 원 ---------- */
  function homeIcon() {
    var L = leaflet();
    return L.divIcon({
      className: 'gymhome-wrap',
      html: '<span class="gymhome-pin">🏠</span>',
      iconSize: [30, 30], iconAnchor: [15, 15]
    });
  }

  function syncHome() {
    var L = leaflet();
    if (!L || !map || !homeLayer) return;
    homeLayer.clearLayers();
    var h = homeOf(model);
    if (!h) return;
    homeLayer.addLayer(L.circle([h.lat, h.lng], {
      radius: N().RADIUS_KM * 1000,
      color: LIVE, weight: 1.6, opacity: 0.85, dashArray: '7 7',
      fillColor: LIVE, fillOpacity: 0.07, interactive: false
    }));
    homeLayer.addLayer(L.marker([h.lat, h.lng], {
      icon: homeIcon(), title: '내 집 · ' + (h.label || '기준 위치'),
      keyboard: false, interactive: false, zIndexOffset: 400
    }));
  }

  /* ---------- 동네 동호인 (사람 아이콘) ---------- */
  function personIcon(p) {
    var L = leaflet();
    return L.divIcon({
      className: 'gymp-wrap',
      html: '<span class="gymp' + (p.status && p.status.lit ? ' is-lit' : '') + '"><i>' +
        U.esc(initial(p.name)) + '</i></span>',
      iconSize: [30, 30], iconAnchor: [15, 15]
    });
  }

  function syncPeople() {
    var L = leaflet();
    if (!L || !map || !peopleLayer) return;
    peopleLayer.clearLayers();
    var pack = peopleOf(model);
    pack.inside.forEach(function (p) {
      if (model.onlyLit && !p.status.lit) return;
      var mk = L.marker([p.lat, p.lng], {
        icon: personIcon(p), title: p.name + ' · ' + p.status.label,
        riseOnHover: true, zIndexOffset: 300, interactive: !model.pickHome
      });
      mk.on('click', function () { raisePerson(p.id); });
      peopleLayer.addLayer(mk);
    });
  }

  /* 내 집 반경 5km가 한 화면에 들어오게 */
  function fitHome() {
    var L = leaflet();
    if (!L || !map) return;
    var h = homeOf(model);
    if (!h) { fitSeoul(); return; }
    var box = homeBox(h, N().RADIUS_KM * 0.87);
    map.fitBounds([[box.latMin, box.lngMin], [box.latMax, box.lngMax]], { animate: false });
  }

  /* 지도를 누르면 내 집으로 (모델이 '내 집 찍기'일 때만) */
  function onMapClick(e) {
    if (!model.pickHome || !e || !e.latlng) return;
    applyHome({ lat: e.latlng.lat, lng: e.latlng.lng, label: '지도에서 고른 곳' }, '내 집을 지도에서 고른 곳으로 정했어요');
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
      /* '지도에서 찍기' 중에는 핀이 클릭을 가로채지 않게 눌리지 않도록 둡니다 (내 집을 찍을 수 있게) */
      var mk = L.marker([v.lat, v.lng], {
        icon: markerIcon(fav), title: v.name, riseOnHover: true, interactive: !model.pickHome
      });
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

  /* 사람을 눌렀을 때 — 그 사람 위치로 지도를 옮기고 목록의 줄을 짚어 줍니다 */
  function raisePerson(id) {
    if (!page) return;
    var row = page.querySelector('[data-gym-person="' + id + '"]');
    Array.prototype.forEach.call(page.querySelectorAll('.nearp.is-focus'), function (n) {
      n.classList.remove('is-focus');
    });
    if (row) {
      row.classList.add('is-focus');
      if (row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    var pack = peopleOf(model);
    var p = pack.inside.filter(function (x) { return x.id === id; })[0];
    if (p && map) map.setView([p.lat, p.lng], 14, { animate: true });
    if (p) UI.toast(p.name + ' · ' + p.status.label + (p.status.range ? ' (' + p.status.range + ')' : ''));
  }

  /* 내 집 바꾸기 — 저장(이 기기) 후 지도·목록을 다시 */
  function applyHome(point, msg) {
    model.home = N().saveHome(model.scope, point || {});
    model.pickHome = false;
    UI.haptic(10);
    toastLater(msg || '내 집을 바꿨어요');
    refresh();
    syncHome();
    syncPeople();
    fitHome();
  }

  /* 화면 갱신 뒤에 토스트(다시 그리면서 사라지지 않게 locate 뒤에) */
  function toastLater(msg) {
    if (typeof UI.toast === 'function') UI.toast(msg);
  }

  /* 내 상태 스위치·시간대 */
  function toggleMine(patch) {
    N().saveMyStatus(model.scope, patch);
    UI.haptic(8);
    refresh();
    syncPeople();
  }

  function pickRange(id) {
    var r = N().RANGES.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    N().saveMyStatus(model.scope, { rangeId: r.id, days: r.days, from: r.from, to: r.to });
    UI.haptic(8);
    UI.toast('운동 가능 시간을 ‘' + r.label + '’로 바꿨어요');
    refresh();
    syncPeople();
  }

  /* '내 집 정하기' 시트 — 현재 위치 · 동네 프리셋 · 지도에서 찍기 */
  function openHomeSheet() {
    var h = homeOf(model);
    var body = '<p class="sheet__text">지도에 그릴 기준점이에요. 이 집에서 <b>반경 5km</b> 안의 동호인을 보여 드려요.' +
      (h && h.demo ? ' 지금은 예시 기준점(<b>망원동</b>)이에요.' : '') + '</p>' +
      '<p class="sheet__lab">동네로 고르기</p>' +
      '<div class="chips homepick">' + N().PLACES.map(function (pl) {
        var on = h && h.label === pl.label;
        return '<button type="button" class="mchip' + (on ? ' is-on' : '') + '" data-home-place="' + U.esc(pl.label) +
          '" aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(pl.label) + '</button>';
      }).join('') + '</div>' +
      '<div class="row gap8 mt16">' +
      '<button type="button" class="btn btn--ghost grow" data-home-now>현재 위치로</button>' +
      '<button type="button" class="btn grow" data-home-pickmap>지도에서 찍기</button>' +
      '</div>';
    var wrap = UI.openSheet({ title: '내 집(기준 위치) 정하기', body: body });
    if (!wrap) return;
    wrap.addEventListener('click', function (ev) {
      var chip = ev.target.closest('[data-home-place]');
      if (chip) {
        var label = chip.getAttribute('data-home-place');
        var pl = N().PLACES.filter(function (x) { return x.label === label; })[0];
        UI.closeSheet();
        if (pl) applyHome({ lat: pl.lat, lng: pl.lng, label: pl.label }, '내 집을 ‘' + pl.label + '’로 바꿨어요');
        return;
      }
      if (ev.target.closest('[data-home-now]')) {
        UI.closeSheet();
        locate(function (pos) {
          if (!pos) { UI.toast('위치를 확인하지 못했어요. 동네로 골라 주세요', 'error'); return; }
          applyHome({ lat: pos.lat, lng: pos.lng, label: '현재 위치' }, '내 집을 현재 위치로 정했어요');
        });
        return;
      }
      if (ev.target.closest('[data-home-pickmap]')) {
        model.pickHome = true;
        UI.closeSheet();
        UI.toast('지도를 살짝 눌러 내 집을 정하세요');
        var host = mapHost();
        if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        refresh();
      }
    });
  }

  /* ---------- 지도 안 게스트 모집 ---------- */
  function openRecruitForm(place) {
    model.recruitOpen = true;
    model.draft = model.draft || { place: '', when: '', cap: '', fee: '' };
    if (place) model.draft.place = place;
    UI.haptic(6);
    refresh();
    var form = page && page.querySelector('[data-gymrecform]');
    if (form && form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* 모집 글 올리기 — 커뮤니티 '게스트 모집'과 같은 글(본문 없이 모집 칸만으로도 올라감) */
  function postRecruit(ctx) {
    var d = model.draft || {};
    var meet = {
      when: String(d.when || '').trim(), cap: String(d.cap || '').trim(),
      place: String(d.place || '').trim(), fee: String(d.fee || '').trim()
    };
    if (!D.meetFilled(D.normalizeMeet(meet))) {
      UI.toast('언제·어디·몇 명 중 하나는 채워 주세요', 'error');
      return;
    }
    if (!ctx || !ctx.actions) return;
    var res = ctx.actions.createPost('', D.MEET.topic, meet);
    if (!res || !res.ok) {
      UI.toast(res && res.reason === 'locked' ? '잠시 뒤 다시 눌러 주세요' : '모집 글을 올리지 못했어요', 'error');
      return;
    }
    var st = ctx.store && ctx.store.state;
    model.posts = (st && st.data && st.data.posts) || model.posts;
    model.recruitOpen = false;
    model.draft = { place: meet.place, when: '', cap: '', fee: '' };
    UI.haptic(10);
    UI.toast('게스트 모집 글을 올렸어요');
    refresh();
  }

  /* 참여 문의 — 커뮤니티와 같은 단체방을 엽니다(내 글은 방장으로) */
  function joinRecruit(id, ctx) {
    if (!ctx || !ctx.actions) return;
    var st = ctx.store && ctx.store.state;
    if (!st || !st.me || !st.me.key) { UI.toast('로그인하면 단체방에서 대화할 수 있어요', 'error'); return; }
    var post = ((st.data && st.data.posts) || []).filter(function (x) { return String(x.id) === String(id); })[0];
    if (!post) { UI.toast('모집 글을 찾지 못했어요', 'error'); return; }
    var mine = String(post.userKey || '') === String(st.me.key);
    var draft = '';
    if (!mine) {
      var C = BM.views.community || {};
      var status = D.meetStatus(st.data.idx, post, st.me.key);
      draft = (status && status.closed && C._waitDraft) ? C._waitDraft(post) : (C._inquiryDraft ? C._inquiryDraft(post) : '');
    }
    var res = ctx.actions.openGroupChat(id, draft);
    if (!res || !res.ok) { UI.toast('이 글의 단체방을 찾지 못했어요', 'error'); return; }
    ctx.actions.markChatRead(res.roomId, '');
    UI.haptic(8);
    close();
  }

  /* ---------- 다시 그리기 (지도 상자는 그대로, 글자·핀만) ---------- */
  function refresh() {
    if (!page) return;
    function put(sel, html) {
      var node = page.querySelector(sel);
      if (node) node.innerHTML = html;
    }
    put('[data-gymfocus]', focusHtml(model));
    put('[data-gymmystat]', myStatHtml(model));
    put('[data-gymhome]', homeRowHtml(model));
    put('[data-gymnear]', nearHtml(model));
    put('[data-gymrecruit]', recruitHtml(model));
    put('[data-gymfavs]', favSectionHtml(model));
    put('[data-gymseg]', segHtml(model));
    put('[data-gymreghost]', regionChipsHtml(model));
    put('[data-gymgeohost]', geoHtml(model));
    put('[data-gympins]', pinsHtml(model));
    put('[data-gymnote]', mapNoteInner(model));
    put('[data-gymlist]', listHtml(model));
    syncMarkers();
    syncHome();
    syncPeople();
    syncMe();
    if (map && !model.geo) fitVisibleAfterChange();
  }

  /* 보기(전체/즐겨찾기만)·권역·검색이 바뀌면 그 결과가 다 들어오게 지도를 맞춥니다 */
  var lastFitKey = '';
  /* 지금 보고 있는 조건 — 이 값이 그대로면(내 상태 토글·모집 올리기 같은 갱신) 지도를 다시 맞추지 않습니다.
   * (내 집 반경 5km 로 보던 화면이 전국 120곳으로 갑자기 멀어지지 않게) */
  function viewKey() {
    var list = visible(model);
    return (model.onlyFav ? 'fav' : 'all') + ':' + (model.region || 'all') + ':' +
      (model.query || '') + ':' + (model.geo ? 'geo' : '') + ':' +
      (list.length <= 12 ? list.map(function (v) { return v.id; }).join(',') : list.length);
  }

  function fitVisibleAfterChange() {
    var list = visible(model);
    var key = viewKey();
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
    homeLayer = null;
    peopleLayer = null;
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
    var st = (ctx && ctx.store && ctx.store.state) || null;
    var focusId = optsRef.focus ? String(optsRef.focus) : '';
    var focusVenue = focusId ? G().get(focusId) : null;
    model = {
      scope: scoped(me.key), onlyFav: false, query: '', region: 'all', club: me.club || '',
      geo: null, geoState: 'idle', focus: focusId,
      home: N().home(scoped(me.key)),
      posts: (st && st.data && st.data.posts) || [],
      profiles: (st && st.data && st.data.matchProfiles) || [],
      idx: (st && st.data && st.data.idx) || null,
      now: optsRef.now || null,
      onlyLit: false, recruitOpen: !!optsRef.recruitOpen,
      draft: { place: focusVenue ? focusVenue.name : '', when: '', cap: '', fee: '' },
      pickHome: false
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
    /* 모집 글 작성 칸은 화면을 다시 그려도 값이 남게 모델에 적어 둡니다 */
    root.addEventListener('input', function (ev) {
      var f = ev.target.closest('[data-gymrec]');
      if (!f) return;
      model.draft = model.draft || { place: '', when: '', cap: '', fee: '' };
      model.draft[f.getAttribute('data-gymrec')] = f.value;
    });

    root.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-gym-close]')) { ev.preventDefault(); close(); return; }

      /* ---- 내 상태 (운동 중 · 운동 가능 시간) ---- */
      if (ev.target.closest('[data-mystat-work]')) {
        ev.preventDefault();
        toggleMine({ working: !N().myStatus(model.scope).working });
        return;
      }
      if (ev.target.closest('[data-mystat-free]')) {
        ev.preventDefault();
        var freeNow = !N().myStatus(model.scope).freeNow;
        toggleMine({ freeNow: freeNow });
        UI.toast(freeNow ? '지금 운동 가능으로 켰어요 · 지도에 내 불이 켜져요' : '지금 운동 가능을 껐어요');
        return;
      }
      var mrange = ev.target.closest('[data-mystat-range]');
      if (mrange) { ev.preventDefault(); pickRange(mrange.getAttribute('data-mystat-range')); return; }

      /* ---- 내 집 · 반경 5km ---- */
      if (ev.target.closest('[data-gym-home]')) { ev.preventDefault(); openHomeSheet(); return; }
      if (ev.target.closest('[data-gym-onlylit]')) {
        ev.preventDefault();
        model.onlyLit = !model.onlyLit;
        UI.haptic(6);
        refresh();
        return;
      }

      /* ---- 동네 동호인 ---- */
      var person = ev.target.closest('[data-gym-person]');
      if (person) { ev.preventDefault(); raisePerson(person.getAttribute('data-gym-person')); return; }

      /* ---- 지도 안 게스트 모집 ---- */
      if (ev.target.closest('[data-gym-recruit-new]')) {
        ev.preventDefault();
        if (model.recruitOpen) { model.recruitOpen = false; refresh(); }
        else { openRecruitForm(model.focus && G().get(model.focus) ? G().get(model.focus).name : ''); }
        return;
      }
      var recGym = ev.target.closest('[data-gym-recruit-gym]');
      if (recGym) {
        ev.preventDefault();
        var rv = G().get(recGym.getAttribute('data-gym-recruit-gym'));
        openRecruitForm(rv ? rv.name : '');
        return;
      }
      var recPlace = ev.target.closest('[data-gymrec-place]');
      if (recPlace) {
        ev.preventDefault();
        model.draft = model.draft || {};
        model.draft.place = recPlace.getAttribute('data-gymrec-place') || '';
        var inp = page && page.querySelector('[data-gymrec="place"]');
        if (inp) inp.value = model.draft.place;
        Array.prototype.forEach.call(page.querySelectorAll('[data-gymrec-place]'), function (n) {
          var on = n === recPlace;
          n.classList.toggle('is-on', on);
          n.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        UI.haptic(6);
        return;
      }
      var recFee = ev.target.closest('[data-gymrec-feeval]');
      if (recFee) {
        ev.preventDefault();
        var fee = recFee.getAttribute('data-gymrec-feeval') || '';
        model.draft = model.draft || {};
        model.draft.fee = model.draft.fee === fee ? '' : fee;
        Array.prototype.forEach.call(page.querySelectorAll('[data-gymrec-feeval]'), function (n) {
          var on = n.getAttribute('data-gymrec-feeval') === model.draft.fee;
          n.classList.toggle('is-on', on);
          n.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        UI.haptic(6);
        return;
      }
      if (ev.target.closest('[data-gym-recruit-post]')) { ev.preventDefault(); postRecruit(ctx); return; }
      var recOpen = ev.target.closest('[data-gym-recruit-open]');
      if (recOpen) { ev.preventDefault(); joinRecruit(recOpen.getAttribute('data-gym-recruit-open'), ctx); return; }

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
