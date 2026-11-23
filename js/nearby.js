/* ============================================================
 * nearby.js — 내 집(기준 위치) · 반경 5km 동네 동호인 · 운동 가능 시간
 *
 *  조환비 님 요청 (2026-11-21)
 *   "지도 기능에 게스트 모집 기능을 만들어서 내 집 기준 반경 5키로 이내에 있는
 *    사람들을 알수 있게 아이콘 표시를 해줘 운동중이라면 파란색 불이 들어오고
 *    만약 운동이 끝난 상태라면 불이 꺼지게 만들어줘"
 *   → 2026-11-21 수정: "운동하는 중만 불이 켜지는게 아니고 운동 가능 시간에
 *    불이 켜지는 걸로 바꿔줘"
 *
 *  그래서 불(파란 점)은 다음 둘 중 하나면 켜집니다.
 *   · 지금 운동 중이거나
 *   · 지금이 그 사람의 '운동 가능 시간' 안이거나 ('지금 운동 가능'을 켜 둔 경우 포함)
 *  운동이 끝났거나 운동 가능 시간이 아니면 불이 꺼집니다.
 *
 *  무엇을 두나
 *   · 내 집(기준 위치): 이 기기에만 저장합니다(계정별 · 서버로 보내지 않음).
 *     처음에는 망원동을 예시 기준점으로 두고, '내 집 바꾸기'에서
 *     현재 위치·동네 프리셋·지도에서 찍기로 바꿀 수 있습니다.
 *   · 반경 5km 안의 동네 동호인: 예시(데모) 동호인 목록입니다.
 *     실제 서비스에서는 '위치를 공개한 동호인'만 보이게 됩니다.
 *     이미 앱에 프로필이 있는 사람은 주 체육관 위치로 함께 얹습니다.
 *   · 2026-11-23: 사람마다 userKey(실제 프로필이면 계정 키 · 예시면 '')를 붙여
 *     지도에서 바로 매칭 요청·1:1 대화로 이어갈 수 있게 했습니다.
 *   · 내 운동 상태: '운동 중'·'지금 운동 가능' 스위치와 운동 가능 시간대.
 *
 *  좌표·거리는 js/gyms.js 의 체육관 목록(pointOf·distanceKm)을 그대로 씁니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var HOME_KEY = 'bm_home_base_v1';
  var AVAIL_KEY = 'bm_my_avail_v1';
  var RADIUS_KM = 5;                 /* '내 집 반경 5km' */

  /* 처음 보여 줄 기준점 — 망원동(마포구민체육센터 근처). 데모 값입니다. */
  var DEFAULT_HOME = { name: '내 집', label: '망원동', lat: 37.5585, lng: 126.9012, demo: true };

  /* '내 집 바꾸기'에서 고를 수 있는 동네 (체육관 목록의 동네 + 망원·여의도) */
  var PLACES = [
    { label: '망원동', lat: 37.5585, lng: 126.9012 },
    { label: '합정동', lat: 37.5496, lng: 126.9138 },
    { label: '공덕동', lat: 37.5443, lng: 126.9514 },
    { label: '마곡동', lat: 37.5732, lng: 126.8312 },
    { label: '신길동', lat: 37.5060, lng: 126.8982 },
    { label: '여의도', lat: 37.5215, lng: 126.9245 },
    { label: '신림동', lat: 37.4778, lng: 126.9188 },
    { label: '거여동', lat: 37.4937, lng: 127.1383 },
    { label: '월계동', lat: 37.6384, lng: 127.0515 }
  ];

  /* 운동 가능 시간대 프리셋 — days: 1(월)~7(일) */
  var RANGES = [
    { id: 'day-19-22', label: '매일 19–22시', days: [1, 2, 3, 4, 5, 6, 7], from: '19:00', to: '22:00' },
    { id: 'weekday-19-22', label: '평일 19–22시', days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' },
    { id: 'morning-6-9', label: '아침 06–09시', days: [1, 2, 3, 4, 5, 6, 7], from: '06:00', to: '09:00' },
    { id: 'weekend-9-12', label: '주말 09–12시', days: [6, 7], from: '09:00', to: '12:00' }
  ];

  /* ---------- 예시 동네 동호인 ----------
   * 좌표는 '동네' 위치입니다(그 사람 집 근처). 화면에는 체육관 이름과 함께 보여 줍니다.
   *   workout : 'on' = 지금 운동 중 · 'off' = 운동 중 아님
   *   ended   : 운동을 막 끝낸 상태(불 꺼짐 · '운동 끝')
   *   freeNow : '지금 운동 가능'을 켜 둔 사람
   *   avail   : 운동 가능 시간대 (없으면 null)
   */
  var DEMO = [
    { id: 'nd1', name: '김도현', level: 'B조', gymId: 'mapo', lat: 37.5395, lng: 126.9205,
      workout: 'on', ended: false, freeNow: false,
      avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' }, note: '주 4회 복식' },
    { id: 'nd2', name: '이서연', level: 'C조', gymId: 'mapo', lat: 37.5560, lng: 126.9410,
      workout: 'off', ended: false, freeNow: true, avail: null, note: '퇴근하고 바로' },
    { id: 'nd3', name: '박준영', level: 'A조', gymId: 'mapo', lat: 37.5758, lng: 126.8950,
      workout: 'off', ended: true, freeNow: false,
      avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' }, note: '단식 위주' },
    { id: 'nd4', name: '최민지', level: 'B조', gymId: 'mapo', lat: 37.5820, lng: 126.9250,
      workout: 'off', ended: false, freeNow: false,
      avail: { days: [6, 7], from: '09:00', to: '12:00' }, note: '주말 오전' },
    { id: 'nd5', name: '정하늘', level: '초보', gymId: 'mapo', lat: 37.5527, lng: 126.8968,
      workout: 'off', ended: false, freeNow: true, avail: null, note: '처음 시작했어요' },
    { id: 'nd6', name: '한지우', level: 'C조', gymId: 'mapo', lat: 37.5270, lng: 126.9350,
      workout: 'on', ended: false, freeNow: false,
      avail: { days: [1, 2, 3, 4, 5], from: '18:00', to: '21:00' }, note: '공덕에서 와요' },
    { id: 'nd7', name: '윤도영', level: 'B조', gymId: 'mapo', lat: 37.5220, lng: 126.9000,
      workout: 'off', ended: false, freeNow: false,
      avail: { days: [1, 2, 3, 4, 5, 6, 7], from: '19:00', to: '22:00' }, note: '평일 저녁 꾸준히' },
    /* 5km 밖 — 지도·목록에서 빠지고 '5km 밖 N명'으로만 셉니다 */
    { id: 'nd8', name: '배수아', level: 'C조', gymId: 'magok', lat: 37.5732, lng: 126.8312,
      workout: 'on', ended: false, freeNow: false,
      avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' }, note: '마곡' },
    { id: 'nd9', name: '서지훈', level: 'B조', gymId: 'doksan', lat: 37.4674, lng: 126.9100,
      workout: 'off', ended: false, freeNow: true, avail: null, note: '독산동' }
  ];

  /* ---------- 시간 도우미 ---------- */
  function toMin(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm == null ? '' : hhmm).trim());
    if (!m) return null;
    var h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
    if (!(h >= 0 && h <= 23 && mm >= 0 && mm <= 59)) return null;
    return h * 60 + mm;
  }

  function hhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return U.pad2(Math.floor(min / 60)) + ':' + U.pad2(min % 60);
  }

  /* 요일 (1=월 … 7=일) */
  function dowOf(date) {
    var d = (date || new Date()).getDay();
    return d === 0 ? 7 : d;
  }

  function rangeLabel(a) {
    if (!a) return '';
    var from = toMin(a.from), to = toMin(a.to);
    if (from == null || to == null) return '';
    var span = hhmm(from).slice(0, 2) + '–' + hhmm(to).slice(0, 2) + '시';
    var days = a.days || [];
    var prefix;
    if (days.length >= 7) prefix = '매일 ';
    else if (days.join(',') === '1,2,3,4,5') prefix = '평일 ';
    else if (days.join(',') === '6,7') prefix = '주말 ';
    else prefix = '주 ' + days.length + '일 ';
    return prefix + span;
  }

  /* 지금이 운동 가능 시간인가 */
  function availableAt(person, now) {
    if (!person) return false;
    if (person.freeNow) return true;
    var a = person.avail;
    if (!a) return false;
    var days = a.days || [];
    if (days.length && days.indexOf(dowOf(now)) < 0) return false;
    var from = toMin(a.from), to = toMin(a.to);
    if (from == null || to == null) return false;
    var cur = (now || new Date()).getHours() * 60 + (now || new Date()).getMinutes();
    if (to < from) return cur >= from || cur < to;   /* 자정을 넘기는 시간대 */
    return cur >= from && cur <= to;
  }

  /* 한 사람의 불 상태 — 작업 중이거나 운동 가능 시간이면 켜짐(lit)
   *  key: work(운동 중) · avail(운동 가능 시간) · ended(운동 끝) · off(운동 시간 아님) */
  function statusOf(person, now) {
    now = now || new Date();
    var working = !!(person && person.workout === 'on');
    var available = availableAt(person, now);
    var ended = !!(person && person.ended) && !working && !available;
    var key = working ? 'work' : (available ? 'avail' : (ended ? 'ended' : 'off'));
    var label = working ? '운동 중' : (available ? '운동 가능 시간' : (ended ? '운동 끝' : '운동 시간 아님'));
    return {
      working: working, available: available, ended: ended,
      lit: working || available, key: key, label: label,
      range: person && person.freeNow
        ? ('지금 운동 가능' + (rangeLabel(person.avail) ? ' · ' + rangeLabel(person.avail) : ''))
        : rangeLabel(person && person.avail)
    };
  }

  /* ---------- 내 운동 상태 (이 기기 · 계정별) ----------
   * 기본값: '지금 운동 가능' 켜짐 + 매일 19–22시 → 저녁에는 불이 켜져 있습니다. */
  function availKey(scope) { return AVAIL_KEY + '::' + String(scope || 'guest').toLowerCase(); }
  function homeKey(scope) { return HOME_KEY + '::' + String(scope || 'guest').toLowerCase(); }

  function defaultMine() {
    return { working: false, freeNow: true, days: [1, 2, 3, 4, 5, 6, 7], from: '19:00', to: '22:00', rangeId: 'day-19-22' };
  }

  function myStatus(scope) {
    var raw = U.readJSON(availKey(scope), null);
    var base = defaultMine();
    if (!raw || typeof raw !== 'object') return base;
    var days = Array.isArray(raw.days) ? raw.days.map(Number).filter(function (d) { return d >= 1 && d <= 7; }) : base.days;
    return {
      working: !!raw.working,
      freeNow: raw.freeNow !== false,
      days: days.length ? days : base.days,
      from: toMin(raw.from) == null ? base.from : String(raw.from),
      to: toMin(raw.to) == null ? base.to : String(raw.to),
      rangeId: raw.rangeId || ''
    };
  }

  function saveMyStatus(scope, patch) {
    var cur = myStatus(scope);
    var next = {
      working: patch && patch.working != null ? !!patch.working : cur.working,
      freeNow: patch && patch.freeNow != null ? !!patch.freeNow : cur.freeNow,
      days: (patch && patch.days) || cur.days,
      from: (patch && patch.from) || cur.from,
      to: (patch && patch.to) || cur.to,
      rangeId: patch && patch.rangeId != null ? patch.rangeId : cur.rangeId
    };
    U.writeJSON(availKey(scope), next);
    return next;
  }

  /* 내 상태를 '한 사람'처럼 다룰 수 있게 */
  function meAsPerson(st) {
    st = st || defaultMine();
    return {
      id: 'me', name: '나', level: '나',
      workout: st.working ? 'on' : 'off',
      freeNow: !!st.freeNow,
      avail: { days: st.days, from: st.from, to: st.to },
      me: true
    };
  }

  /* ---------- 내 집 ---------- */
  function home(scope) {
    var raw = U.readJSON(homeKey(scope), null);
    if (!raw || typeof raw !== 'object') return cloneHome(DEFAULT_HOME);
    var lat = Number(raw.lat), lng = Number(raw.lng);
    if (!isFinite(lat) || !isFinite(lng) || lat < 33 || lat > 39 || lng < 124 || lng > 132) return cloneHome(DEFAULT_HOME);
    return {
      name: String(raw.name || '내 집'),
      label: String(raw.label || '').slice(0, 20),
      lat: lat, lng: lng, demo: false
    };
  }

  function cloneHome(h) {
    return { name: h.name, label: h.label, lat: h.lat, lng: h.lng, demo: !!h.demo };
  }

  function saveHome(scope, point) {
    var lat = Number(point && point.lat), lng = Number(point && point.lng);
    if (!isFinite(lat) || !isFinite(lng)) return home(scope);
    var next = {
      name: String((point && point.name) || '내 집').slice(0, 12),
      label: String((point && point.label) || '').slice(0, 20),
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5
    };
    U.writeJSON(homeKey(scope), next);
    var out = home(scope);
    out.demo = false;
    return out;
  }

  function resetHome(scope) {
    U.storage.removeItem(homeKey(scope));
    return home(scope);
  }

  /* ---------- 사람 목록 ----------
   * 예시 동호인 + 이미 앱에 프로필이 있는 사람(주 체육관 위치).
   * 나 자신은 목록에서 뺍니다. */
  function all(state) {
    var G = BM.gyms;
    var me = (state && state.me && state.me.key) || '';
    var out = DEMO.map(function (p) {
      var v = G && G.get(p.gymId);
      return {
        id: p.id, name: p.name, level: p.level, gymId: p.gymId,
        gym: v ? v.name : '', area: v ? v.area : '',
        /* 좌표는 그 사람 동네(집 근처). 체육관은 이름표로만 붙입니다. */
        lat: p.lat, lng: p.lng,
        workout: p.workout, ended: !!p.ended, freeNow: !!p.freeNow,
        avail: p.avail ? { days: p.avail.days.slice(), from: p.avail.from, to: p.avail.to } : null,
        note: p.note || '', demo: true, userKey: ''
      };
    });
    /* 실제 프로필이 있으면 그 사람의 주 체육관 좌표로 함께 얹습니다 (같은 이름은 하나만) */
    var names = {};
    out.forEach(function (p) { names[p.name] = true; });
    var D = BM.domain;
    ((state && state.data && state.data.matchProfiles) || []).forEach(function (m) {
      if (!m || !m.nick || m.userKey === me || names[m.nick]) return;
      /* bm-v1.59.0 — 14일 넘게 활동이 없는 사람은 동네 동호인 목록에서도 뺍니다.
       * (친구·대화 중인 상대는 그대로 — js/domain.js keepsInTouch) */
      if (D && D.isInactiveProfile(m) && !D.keepsInTouch(state.data.idx, me, m.userKey)) return;
      var v = m.club && G ? G.matchVenue(m.club) : null;
      if (!v) return;
      names[m.nick] = true;
      out.push({
        id: 'u:' + (m.userKey || m.nick), name: m.nick, level: m.level || '', gymId: v.id,
        gym: v.name, area: v.area, lat: v.lat, lng: v.lng,
        workout: '', ended: false, freeNow: false, avail: null,
        note: m.bio || '', demo: false, userKey: m.userKey || ''
      });
    });
    return out;
  }

  /* 내 집에서 km 안의 사람만 (거리 붙여 가까운 순) */
  function near(list, origin, km) {
    var G = BM.gyms;
    var max = km == null ? RADIUS_KM : km;
    var out = (list || []).map(function (p) {
      var c = {
        id: p.id, name: p.name, level: p.level, gymId: p.gymId, gym: p.gym, area: p.area,
        lat: p.lat, lng: p.lng, workout: p.workout, ended: p.ended, freeNow: p.freeNow,
        avail: p.avail, note: p.note, demo: p.demo, userKey: p.userKey || ''
      };
      c.dist = G ? G.distanceKm(origin, p) : null;
      return c;
    }).filter(function (p) { return p.dist != null && p.dist <= max; });
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out;
  }

  /* 5km 밖 사람 수 */
  function outside(list, origin, km) {
    var G = BM.gyms;
    var max = km == null ? RADIUS_KM : km;
    return (list || []).filter(function (p) {
      var d = G ? G.distanceKm(origin, p) : null;
      return d != null && d > max;
    }).length;
  }

  /* 화면용 한 묶음 — 반경 안 사람(상태 포함)·불 켜진 수·밖 사람 수 */
  function summary(state, now, scope) {
    var origin = home(scope || (state && state.me && state.me.key));
    var people = all(state);
    var inside = near(people, origin).map(function (p) {
      var st = statusOf(p, now);
      p.status = st;
      return p;
    });
    return {
      home: origin,
      radiusKm: RADIUS_KM,
      people: inside,
      lit: inside.filter(function (p) { return p.status.lit; }).length,
      working: inside.filter(function (p) { return p.status.working; }).length,
      outside: outside(people, origin),
      mine: statusOf(meAsPerson(myStatus(state && state.me && state.me.key)), now)
    };
  }

  BM.nearby = {
    RADIUS_KM: RADIUS_KM, DEMO: DEMO, PLACES: PLACES, RANGES: RANGES, DEFAULT_HOME: DEFAULT_HOME,
    homeKey: homeKey, availKey: availKey,
    home: home, saveHome: saveHome, resetHome: resetHome,
    myStatus: myStatus, saveMyStatus: saveMyStatus, meAsPerson: meAsPerson,
    statusOf: statusOf, availableAt: availableAt, rangeLabel: rangeLabel, toMin: toMin,
    all: all, near: near, outside: outside, summary: summary
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
