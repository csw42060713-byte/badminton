/* ============================================================
 * gyms.js — 배드민턴 체육관 목록 + '자주 가는 체육관' 즐겨찾기
 *
 *  · 지도에 처음부터 보여 줄 체육관 목록입니다(이름·동네·좌표·코트 수·운영 시간·요금).
 *    서울 시설공단·구청 공개 자료와 공개 지도 정보를 기준으로 정리했고,
 *    앱에 이미 나오던 '나래울'(동탄)도 함께 담았습니다.
 *  · 내 위치 기준 거리(Haversine, km)와 '가까운 순' 정렬, 그리고 프로필·모집글에
 *    적힌 체육관 이름을 목록의 체육관과 이어 주는 matchVenue 를 함께 둡니다.
 *  · 운영 시간·요금은 바뀔 수 있어 화면에도 그렇게 적어 둡니다.
 *  · 즐겨찾기는 서버에 보내지 않고 이 기기(localStorage)에만, 계정마다 따로 저장합니다.
 *    (시트 26칸은 건드리지 않습니다 — routine.js 와 같은 방식)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var KEY = 'bm_gym_fav_v1';

  /* 좌표는 소수점 5자리(약 1m)까지. lat·lng 는 지도 핀을 찍는 데 씁니다. */
  var VENUES = [
    {
      id: 'mapo', name: '마포구민체육센터', area: '마포구 망원동', dong: '망원동',
      addr: '서울 마포구 월드컵로25길 190', lat: 37.55674, lng: 126.89692,
      courts: 12, hours: '평일 06:00–11:50 · 19:00–21:50, 주말 06:00–21:50',
      fee: '2시간 성인 2,500원', tel: '02-324-7800', tags: ['구민체육센터']
    },
    {
      id: 'magok', name: '마곡레포츠센터 실내배드민턴장', area: '강서구 마곡동', dong: '마곡동',
      addr: '서울 강서구 양천로 251', lat: 37.57323, lng: 126.83123,
      courts: 14, hours: '평일 06:00–22:00 · 토 06:00–18:00 · 일 09:00–17:00',
      fee: '프로그램별 상이', tel: '02-2063-3990', tags: ['배드민턴 전용']
    },
    {
      id: 'yeongdeungpo', name: '영등포다목적배드민턴체육관', area: '영등포구 신길동', dong: '신길동',
      addr: '서울 영등포구 도신로15길 5', lat: 37.50596, lng: 126.89815,
      courts: 12, hours: '평일 06:00–21:40 · 주말 07:00–17:30',
      fee: '일회 성인 3,000원', tel: '02-2630-2995', tags: ['배드민턴 전용']
    },
    {
      id: 'doksan', name: '독산배드민턴체육관', area: '금천구 독산동', dong: '독산동',
      addr: '서울 금천구 독산로54길 102-82', lat: 37.46736, lng: 126.90999,
      courts: 9, hours: '평일 06:00–22:00 · 주말 06:00–18:50',
      fee: '평일 3,000원 · 주말 3,900원', tel: '070-8670-1823', tags: ['배드민턴 전용']
    },
    {
      id: 'songpa', name: '송파배드민턴체육관', area: '송파구 거여동', dong: '거여동',
      addr: '서울 송파구 문정로 176', lat: 37.49373, lng: 127.13828,
      courts: 8, hours: '매일 06:00–22:00',
      fee: '평일 2,500원 · 주말 3,200원', tel: '02-403-2839', tags: ['배드민턴 전용', '송파구민']
    },
    {
      id: 'wolgye', name: '월계배드민턴장', area: '노원구 월계동', dong: '월계동',
      addr: '서울 노원구 마들로5가길 113 (초안산 스포츠타운)', lat: 37.63841, lng: 127.05145,
      courts: 10, hours: '화–일 06:00–22:00 (월 휴장)',
      fee: '성인 2,000원', tel: '02-2289-6863', tags: ['배드민턴 전용']
    },
    {
      id: 'wolgok', name: '구립월곡배드민턴체육관', area: '성북구 월곡동', dong: '월곡동',
      addr: '서울 성북구 월곡로', lat: 37.60832, lng: 127.04197,
      courts: null, hours: '매일 06:00–22:00',
      fee: '', tel: '', tags: ['배드민턴 전용']
    },
    {
      id: 'guksabong', name: '국사봉체육관', area: '동작구 상도동', dong: '상도동',
      addr: '서울 동작구 국회단지길 144', lat: 37.49156, lng: 126.94179,
      courts: null, hours: '월 06:00–12:00 · 화–일 06:00–22:00',
      fee: '', tel: '02-2081-2690', tags: ['배드민턴 전용']
    },
    {
      id: 'miseong', name: '미성체육관', area: '관악구 신림동', dong: '신림동',
      addr: '서울 관악구 난우16길 37', lat: 37.47775, lng: 126.91880,
      courts: null, hours: '매일 06:00–22:00',
      fee: '', tel: '02-2015-2765', tags: ['배드민턴 전용']
    },
    {
      id: 'maljuk', name: '말죽거리 배드민턴장', area: '강남구 양재동', dong: '양재동',
      addr: '서울 강남구 양재동', lat: 37.48249, lng: 127.03387,
      courts: null, hours: '평일 06:00–22:30 · 주말 06:00–19:00',
      fee: '', tel: '', tags: []
    },
    {
      id: 'guro', name: '구로누리 배드민턴장', area: '구로구 구로동', dong: '구로동',
      addr: '서울 구로구 구로동 18-10', lat: 37.50470, lng: 126.89280,
      courts: null, hours: '평일 06:00–22:00 · 토 07:00–19:00',
      fee: '', tel: '', tags: []
    },
    {
      id: 'mukdong', name: '묵동다목적체육관', area: '중랑구 묵동', dong: '묵동',
      addr: '서울 중랑구 숙선옹주로 66', lat: 37.61444, lng: 127.08417,
      courts: null, hours: '운영 시간은 전화 문의',
      fee: '', tel: '02-949-5577', tags: ['다목적 체육관']
    },
    {
      id: 'naraeul', name: '나래울 배드민턴장', area: '경기 화성 동탄', dong: '능동',
      addr: '경기 화성시 여울로2길 33-2', lat: 37.20520, lng: 127.05150,
      courts: 10, hours: '1~5부 운영 (2시간 이용)',
      fee: '일권 성인 1,500원', tel: '031-8015-0975', tags: ['배드민턴 전용', '동탄']
    }
  ];

  /* 지도 첫 화면은 서울이 보이게, '전체 보기'는 나래울(동탄)까지 담습니다. */
  var SEOUL_VIEW = { lat: 37.5350, lng: 126.9800, zoom: 11 };

  function clone(v) {
    return {
      id: v.id, name: v.name, area: v.area, addr: v.addr, lat: v.lat, lng: v.lng,
      courts: v.courts, hours: v.hours, fee: v.fee, tel: v.tel,
      tags: (v.tags || []).slice()
    };
  }

  function all() { return VENUES.map(clone); }

  function get(id) {
    var key = String(id == null ? '' : id);
    for (var i = 0; i < VENUES.length; i++) if (VENUES[i].id === key) return clone(VENUES[i]);
    return null;
  }

  function ids() { return VENUES.map(function (v) { return v.id; }); }

  /* ---------- 거리 (내 위치 → 체육관) ----------
   * Haversine — 위도·경도 두 점 사이의 대권 거리(km).
   * 테스트와 화면이 같은 함수를 쓰도록 여기에 둡니다. */
  var EARTH_KM = 6371.0088;

  function toRad(deg) { return (Number(deg) || 0) * Math.PI / 180; }

  function pointOf(p) {
    if (!p) return null;
    var lat = Number(p.lat), lng = Number(p.lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }

  function distanceKm(from, to) {
    var a = pointOf(from), b = pointOf(to);
    if (!a || !b) return null;
    var dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    var h = Math.pow(Math.sin(dLat / 2), 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
    var km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    return Math.round(km * 10) / 10;      /* 화면·정렬 모두 0.1km 단위면 충분합니다 */
  }

  /* '약 1.2 km' — 가까운 곳은 0.1km 아래로 내려가지 않게 */
  function distLabel(km) {
    if (km === null || km === undefined || km === '') return '';
    var k = Number(km);
    if (!isFinite(k) || k < 0) return '';
    if (k < 0.1) k = 0.1;
    return '약 ' + k.toFixed(1) + ' km';
  }

  /* 거리 붙은 사본 — 원본 목록은 그대로 둡니다 */
  function withDistance(list, from) {
    return (list || []).map(function (v) {
      var c = clone(v);
      c.dist = distanceKm(from, v);
      return c;
    });
  }

  /* 가까운 순 (거리를 못 구한 곳은 뒤로) */
  function nearby(list, from) {
    var out = withDistance(list, from);
    out.sort(function (a, b) {
      var da = a.dist == null ? 1e9 : a.dist;
      var db = b.dist == null ? 1e9 : b.dist;
      return da - db;
    });
    return out;
  }

  /* ---------- 이름 → 체육관 찾기 ----------
   * 프로필·모집글에는 '나래울'처럼 짧게 적힌 이름도 있어, 띄어쓰기·일반 접미사
   * (체육관·배드민턴장 등)를 떼고 비교합니다. 여러 곳에 똑같이 걸리면 고르지 않습니다. */
  var GENERIC = ['실내배드민턴장', '배드민턴체육관', '다목적체육관', '구민체육센터', '배드민턴장', '체육센터', '체육관'];

  function normName(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\s()\[\]{}·.,'"`~\-]/g, '');
  }

  function coreName(s) {
    var n = normName(s);
    GENERIC.forEach(function (g) { n = n.split(g).join(''); });
    return n;
  }

  function matchVenue(name) {
    var q = normName(name);
    if (q.length < 2) return null;                 /* '체', '' 같은 값은 고르지 않음 */
    var qCore = coreName(name);
    var best = null, bestScore = 0, ties = 0;
    VENUES.forEach(function (v) {
      var n = normName(v.name), c = coreName(v.name);
      var score = 0;
      if (q === n) score = 100;                    /* 이름 그대로 */
      else if (n.indexOf(q) === 0) score = 90;     /* '나래울' → '나래울 배드민턴장' */
      else if (n.indexOf(q) >= 0) score = 85;
      else if (q.indexOf(n) >= 0) score = 82;      /* '마포구민체육센터 1층' → 이름 포함 */
      else if (qCore.length >= 2 && c && qCore === c) score = 80;
      else if (qCore.length >= 2 && c && c.indexOf(qCore) === 0) score = 70;
      else if (qCore.length >= 2 && c && qCore.indexOf(c) >= 0) score = 68;
      else if (q.length >= 2 && normName(v.area).indexOf(q) >= 0) score = 40;   /* 동네 이름만 */
      if (score > bestScore) { best = v; bestScore = score; ties = 1; }
      else if (score > 0 && score === bestScore) ties++;
    });
    if (!best || ties > 1) return null;            /* '체육관'처럼 여럿에 걸리면 고르지 않음 */
    return clone(best);
  }

  /* ---------- 즐겨찾기 (이 기기 · 계정별) ---------- */
  function keyFor(scope) {
    return KEY + '::' + String(scope || 'guest').toLowerCase();
  }

  function readFavs(scope) {
    var raw = U.readJSON(keyFor(scope), []);
    if (!Array.isArray(raw)) return [];
    var seen = {};
    return raw.map(function (v) { return String(v == null ? '' : v); })
      .filter(function (v) {
        if (!v || seen[v] || !get(v)) return false;   /* 없는 체육관·중복은 버립니다 */
        seen[v] = true;
        return true;
      });
  }

  function saveFavs(scope, list) {
    var clean = [];
    (list || []).forEach(function (v) {
      var id = String(v == null ? '' : v);
      if (id && clean.indexOf(id) < 0 && get(id)) clean.push(id);
    });
    U.writeJSON(keyFor(scope), clean);
    return clean;
  }

  function favorites(scope) { return readFavs(scope); }

  function isFav(scope, id) { return readFavs(scope).indexOf(String(id)) >= 0; }

  /* 별을 눌렀을 때: 없으면 맨 앞에 추가, 있으면 해제 */
  function toggle(scope, id) {
    var key = String(id == null ? '' : id);
    if (!get(key)) return { ok: false, added: false, favorites: readFavs(scope) };
    var list = readFavs(scope);
    var at = list.indexOf(key);
    var added = at < 0;
    if (added) list.unshift(key);
    else list.splice(at, 1);
    return { ok: true, added: added, favorites: saveFavs(scope, list) };
  }

  function clear(scope) {
    U.storage.removeItem(keyFor(scope));
    return [];
  }

  /* ---------- 목록 고르기 (순수 함수 — 화면·테스트가 같이 씁니다) ---------- */
  /* opts: { onlyFav, favorites, query } */
  function filter(list, opts) {
    opts = opts || {};
    var favs = opts.favorites || [];
    var q = String(opts.query || '').replace(/\s+/g, '').toLowerCase();
    return (list || []).filter(function (v) {
      if (opts.onlyFav && favs.indexOf(v.id) < 0) return false;
      if (!q) return true;
      var hay = [v.name, v.area, v.dong, v.addr].join('').replace(/\s+/g, '').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  /* 즐겨찾기를 목록 맨 앞으로 (즐겨찾기끼리는 담은 순서, 나머지는 원래 순서) */
  function withFavoritesFirst(list, favs) {
    favs = favs || [];
    var mines = [], rest = [];
    (list || []).forEach(function (v) {
      if (favs.indexOf(v.id) >= 0) mines.push(v);
      else rest.push(v);
    });
    mines.sort(function (a, b) { return favs.indexOf(a.id) - favs.indexOf(b.id); });
    return mines.concat(rest);
  }

  /* ---------- 지도 좌표 → 상자 안 위치(%) ----------
   * Leaflet 을 못 불러왔을 때(오프라인·CDN 차단)에도 핀이 제자리에 찍히도록
   * 단순 등장방형 투영으로 0~100% 위치를 계산합니다. */
  function project(list, pad) {
    var box = { latMin: 90, latMax: -90, lngMin: 180, lngMax: -180 };
    (list || []).forEach(function (v) {
      if (v.lat < box.latMin) box.latMin = v.lat;
      if (v.lat > box.latMax) box.latMax = v.lat;
      if (v.lng < box.lngMin) box.lngMin = v.lng;
      if (v.lng > box.lngMax) box.lngMax = v.lng;
    });
    var p = (pad == null ? 8 : Math.max(0, Number(pad) || 0));
    var span = 100 - p * 2;
    var dLat = box.latMax - box.latMin || 1;
    var dLng = box.lngMax - box.lngMin || 1;
    return (list || []).map(function (v) {
      return {
        id: v.id, name: v.name,
        x: Math.round((p + ((v.lng - box.lngMin) / dLng) * span) * 100) / 100,
        y: Math.round((p + ((box.latMax - v.lat) / dLat) * span) * 100) / 100
      };
    });
  }

  /* 서울 시내 체육관만 (지도 첫 화면) — 나래울(동탄)은 '전체 보기'에서 */
  var SEOUL_BOX = { latMin: 37.42, latMax: 37.70, lngMin: 126.75, lngMax: 127.20 };
  function inSeoul(v) {
    return v.lat >= SEOUL_BOX.latMin && v.lat <= SEOUL_BOX.latMax &&
      v.lng >= SEOUL_BOX.lngMin && v.lng <= SEOUL_BOX.lngMax;
  }
  function seoulOnly(list) { return (list || []).filter(inSeoul); }

  BM.gyms = {
    KEY: KEY, VENUES: VENUES, SEOUL_VIEW: SEOUL_VIEW, SEOUL_BOX: SEOUL_BOX, EARTH_KM: EARTH_KM,
    all: all, get: get, ids: ids, keyFor: keyFor, inSeoul: inSeoul, seoulOnly: seoulOnly,
    favorites: favorites, isFav: isFav, toggle: toggle, clear: clear, saveFavs: saveFavs,
    filter: filter, withFavoritesFirst: withFavoritesFirst, project: project,
    pointOf: pointOf, distanceKm: distanceKm, distLabel: distLabel,
    withDistance: withDistance, nearby: nearby, matchVenue: matchVenue,
    count: function () { return VENUES.length; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
