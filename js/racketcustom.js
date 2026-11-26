/* ============================================================
 * racketcustom.js — 🏸 내 커스텀 라켓 (bm-v1.80.0)
 *
 *  "내 라켓이 지금 어떤 상태인지" 한눈에 보이게, 그리고 모으는 재미를 위해:
 *   ① 상단 오른쪽 미니 라켓 — 운동을 꾸준히 하면 짱짱·반짝(prime),
 *      3일 넘게 쉬면 줄이 느슨(worn), 7일 넘게 쉬거나 스트링 교체 시기가
 *      지나면 줄이 끊어진(broken) 모습으로 바뀝니다. 누르면 꾸미기 시트.
 *   ② 배드민턴 용품 감성 파츠 5칸 — 프레임 · 스트링 · 그립 · 스텐실 · 라켓 참.
 *      기본 파츠는 무료로 열려 있고, 나머지는 일지·출석·매칭으로 모으는
 *      '라켓 포인트'(일지 +10P · 출석 +5P · 매칭 +15P)로 원하는 것부터 해금.
 *      포인트는 저장하지 않고 지금까지의 기록에서 그때그때 계산합니다 —
 *      이미 일지가 있던 기존 사용자도 과거 기록만큼 바로 포인트가 생깁니다.
 *   ③ 저장 위치 — 새 시트 칸·새 DB 컬럼 없이 theme.gear.custom 한 칸.
 *
 *  실존 선수 이름은 예시·문구에 쓰지 않습니다(용품 이름·색만).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var hasDom = typeof document !== 'undefined';

  /* ---------- 파츠 (실제 배드민턴 용품 감성의 색 이름만) ---------- */
  var PARTS = {
    frame: {
      label: '프레임', note: '라켓 몸통 색',
      items: [
        { id: 'matte', name: '매트 블랙', color: '#23272b', free: true },
        { id: 'carbon', name: '스텔스 카본', color: '#3e4a55', cost: 60 },
        { id: 'white', name: '아크 화이트', color: '#eef2f4', cost: 60 },
        { id: 'navy', name: '로열 네이비', color: '#22409f', cost: 80 },
        { id: 'red', name: '파이어 레드', color: '#e0433c', cost: 80 }
      ]
    },
    string: {
      label: '스트링', note: '줄 색',
      items: [
        { id: 'lime', name: '형광 라임', color: '#c6f24e', free: true },
        { id: 'white', name: '화이트', color: '#f3f7ef', cost: 30 },
        { id: 'gold', name: '골드', color: '#f2c14e', cost: 40 },
        { id: 'cobalt', name: '코발트 블루', color: '#3f7cf2', cost: 40 },
        { id: 'pink', name: '핑크', color: '#ff7fb0', cost: 40 }
      ]
    },
    grip: {
      label: '그립', note: '손잡이 색',
      items: [
        { id: 'black', name: '블랙', color: '#1d2124', free: true },
        { id: 'neon', name: '네온 라임', color: '#c6f24e', cost: 30 },
        { id: 'mint', name: '파스텔 민트', color: '#a8e6cf', cost: 30 },
        { id: 'coral', name: '코랄 핑크', color: '#ff9a8b', cost: 40 },
        { id: 'purple', name: '퍼플', color: '#8f7bf2', cost: 40 }
      ]
    },
    stencil: {
      label: '스텐실', note: '헤드 마크',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true },
        { id: 'x', name: 'X자 셔틀', color: '#f2c14e', cost: 50 },
        { id: 'bolt', name: '번개', color: '#c6f24e', cost: 50 },
        { id: 'crown', name: '왕관', color: '#f2c14e', cost: 60 },
        { id: 'shuttle', name: '셔틀콕', color: '#eef2f4', cost: 50 }
      ]
    },
    charm: {
      label: '라켓 참', note: '손잡이 위 작은 장식',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true },
        { id: 'medal', name: '체전 메달', color: '#f2c14e', cost: 80 },
        { id: 'attend30', name: '30일 출석', color: '#c6f24e', cost: 70 },
        { id: 'streak', name: '연속 7일', color: '#ff9a8b', cost: 60 },
        { id: 'ace', name: '에이스', color: '#8fd0ff', cost: 90 }
      ]
    }
  };
  var SLOTS = ['frame', 'string', 'grip', 'stencil', 'charm'];

  /* 포인트 — 기록에서 그때그때 계산 (저장·차감 원장 없음) */
  var POINTS = { log: 10, checkin: 5, match: 15 };

  function itemsOf(slot) { return (PARTS[slot] && PARTS[slot].items) || []; }
  function itemOf(slot, id) {
    var list = itemsOf(slot);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function freeId(slot) {
    var list = itemsOf(slot);
    for (var i = 0; i < list.length; i++) if (list[i].free) return list[i].id;
    return list.length ? list[0].id : '';
  }
  function colorOf(slot, id) {
    var it = itemOf(slot, id);
    return it ? it.color : 'transparent';
  }
  function costOf(slot, id) {
    var it = itemOf(slot, id);
    return (it && !it.free) ? (it.cost || 50) : 0;
  }

  /* ---------- 저장 모양 ---------- */

  function blankCustom() {
    var o = { unlocked: [] };
    SLOTS.forEach(function (slot) { o[slot] = freeId(slot); });
    return o;
  }

  function normalizeCustom(o) {
    if (typeof o === 'string') o = U.jsonParse(o, null);
    if (!o || typeof o !== 'object') return blankCustom();
    var out = blankCustom();
    SLOTS.forEach(function (slot) {
      var want = String(o[slot] == null ? '' : o[slot]).trim();
      /* 열지 않은 파츠를 입고 있으면 기본 파츠로 되돌립니다(기록이 깨져도 화면은 안전) */
      out[slot] = itemOf(slot, want) ? want : freeId(slot);
    });
    var seen = {};
    var list = Array.isArray(o.unlocked) ? o.unlocked : [];
    out.unlocked = [];
    list.forEach(function (raw) {
      var s = String(raw == null ? '' : raw).trim();
      var cut = s.indexOf(':');
      if (cut < 0) return;
      var slot = s.slice(0, cut), id = s.slice(cut + 1);
      if (SLOTS.indexOf(slot) < 0) return;
      var it = itemOf(slot, id);
      if (!it || it.free) return;
      if (seen[s]) return;
      seen[s] = 1;
      out.unlocked.push(slot + ':' + id);
      if (out.unlocked.length >= 40) return;
    });
    /* 입고 있는 파츠가 열려 있지 않으면 기본 파츠로 되돌립니다(예전 값·직접 고친 값 보정).
     * 열림 목록은 저장된 그대로만 믿습니다 — 그래야 포인트로 연 파츠만 쓸 수 있습니다. */
    SLOTS.forEach(function (slot) {
      var id = out[slot];
      if (!isUnlocked(out, slot, id)) out[slot] = freeId(slot);
    });
    return out;
  }

  function isUnlocked(c, slot, id) {
    var it = itemOf(slot, id);
    if (!it) return false;
    if (it.free) return true;
    return (c && c.unlocked || []).indexOf(slot + ':' + id) >= 0;
  }

  function hasCustom(c) {
    c = normalizeCustom(c);
    if (c.unlocked.length) return true;
    for (var i = 0; i < SLOTS.length; i++) {
      if (c[SLOTS[i]] !== freeId(SLOTS[i])) return true;
    }
    return false;
  }

  function customOf(me) {
    var g = BM.gear ? BM.gear.gearOf(me) : ((me && me.theme && me.theme.gear) || null);
    return normalizeCustom(g && g.custom);
  }

  /* 다른 사람의 라켓 — 프로필 행의 꾸미기 JSON에서 꺼냅니다 */
  function customFor(state, userKey) {
    var me = state && state.me;
    if (me && userKey === me.key) return customOf(me);
    var idx = state && state.data && state.data.idx;
    if (!idx || !BM.domain) return blankCustom();
    var p = BM.domain.profileOf(idx, userKey);
    return normalizeCustom(p && p.theme && p.theme.gear && p.theme.gear.custom);
  }

  function specText(c) {
    c = normalizeCustom(c);
    return SLOTS.map(function (slot) {
      var it = itemOf(slot, c[slot]);
      return it ? it.name : '';
    }).filter(function (v) { return v && v !== '없음'; }).join(' · ');
  }

  /* ---------- 포인트 계산 (기록에서 계산) ---------- */
  function mineList(idx, type, key) {
    return ((idx && idx.byType && idx.byType[type]) || []).filter(function (r) { return r.userKey === key; });
  }

  function pointsDetail(state) {
    var me = (state && state.me && state.me.key) || '';
    var idx = (state && state.data && state.data.idx) || null;
    if (!me || !idx) return { logs: 0, checkins: 0, matches: 0, earned: 0, spent: 0, balance: 0 };
    var logs = U.uniq(mineList(idx, '기록', me).map(function (r) { return r.date || (r.createdAt || '').slice(0, 10); })).length;
    var checkins = U.uniq(mineList(idx, '출석하트', me).map(function (r) { return r.date || (r.createdAt || '').slice(0, 10); })).length;
    var matches = ((idx.byType && idx.byType['매칭신청']) || []).filter(function (r) {
      return r.status === '수락' && (r.userKey === me || r.target === me);
    }).length;
    var earned = logs * POINTS.log + checkins * POINTS.checkin + matches * POINTS.match;
    var spent = 0;
    customOf(state.me).unlocked.forEach(function (k) {
      var cut = k.indexOf(':');
      spent += costOf(k.slice(0, cut), k.slice(cut + 1));
    });
    return {
      logs: logs, checkins: checkins, matches: matches,
      earned: earned, spent: spent, balance: Math.max(0, earned - spent)
    };
  }

  function pointsBalance(state) { return pointsDetail(state).balance; }

  /* 오늘 새로 모은 포인트 — 저장 직후 '+10P' 표시에 씁니다 */
  function pointsToday(state) {
    var me = (state && state.me && state.me.key) || '';
    var idx = (state && state.data && state.data.idx) || null;
    if (!me || !idx) return 0;
    var today = U.ymd();
    var n = 0;
    var logToday = mineList(idx, '기록', me).some(function (r) { return (r.date || '') === today; });
    if (logToday) n += POINTS.log;
    var checkToday = mineList(idx, '출석하트', me).some(function (r) {
      return (r.date || (r.createdAt || '').slice(0, 10)) === today;
    });
    if (checkToday) n += POINTS.checkin;
    return n;
  }

  /* ---------- 상태 (운동 빈도 + 스트링 교체 시기) ---------- */
  var TIRED_DAYS = 3;      /* 이만큼 쉬면 줄이 느슨 */
  var BROKEN_DAYS = 7;     /* 이만큼 쉬면 줄이 끊어진 느낌 */

  function lastLogDate(state) {
    var recs = (state && state.data && state.data.records) || [];
    return recs.length ? (recs[0].date || '') : '';
  }

  function daysBetween(fromYmd, toYmd) {
    var a = U.parseYmd(fromYmd), b = U.parseYmd(toYmd);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  function conditionOf(state, now) {
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = BM.gear ? BM.gear.statusOf(g, now || null) : { state: 'empty', has: false };
    var last = lastLogDate(state);
    var sinceLog = last ? daysBetween(last, U.ymd(now || undefined)) : null;
    if (sinceLog != null && sinceLog < 0) sinceLog = 0;
    var out = {
      level: 'ok', gearState: st.state, hasGear: !!st.has,
      daysSinceLog: sinceLog,
      title: '줄 상태 좋아요', line: '오늘도 코트에서 만나요'
    };
    if (st.state === 'due') {
      out.level = 'broken';
      out.title = '줄이 끊어졌어요';
      out.line = '스트링 교체 시기가 지났어요 · 오늘 갈면 바로 최상 컨디션';
    } else if (sinceLog != null && sinceLog >= BROKEN_DAYS) {
      out.level = 'broken';
      out.title = sinceLog + '일째 쉬는 중이라 줄이 끊어졌어요';
      out.line = '가볍게라도 한 게임 치면 라켓이 살아나요';
    } else if (st.state === 'soon') {
      out.level = 'worn';
      out.title = '줄이 슬슬 느슨해요';
      out.line = '교체까지 ' + st.daysLeft + '일 · 미리 맴 두면 좋아요';
    } else if (sinceLog != null && sinceLog >= TIRED_DAYS) {
      out.level = 'worn';
      out.title = sinceLog + '일째 쉬는 중 · 줄이 조금 느슨해요';
      out.line = '오늘 일지를 쓰면 라켓이 다시 짱짱해져요';
    } else if (sinceLog != null && sinceLog <= 1) {
      out.level = 'prime';
      out.title = '최상 컨디션 · 줄이 짱짱해요';
      out.line = sinceLog === 0 ? '오늘 운동 완료 · 이 느낌 그대로' : '어제 운동 완료 · 좋은 흐름이에요';
    } else if (sinceLog == null && st.state === 'empty') {
      out.level = 'ok';
      out.title = '아직 줄 상태를 몰라요';
      out.line = '일지를 쓰면 라켓이 살아나요';
    } else {
      out.level = 'ok';
      out.title = '줄 상태 좋아요';
      out.line = '꾸준히 치고 있어요';
    }
    return out;
  }

  /* ---------- 라켓 그림 (SVG) ----------
   * 화면 HTML에 들어가는 SVG라 svg · path · circle · g 만 씁니다
   * (ellipse·line·rect·clipPath 는 쓰지 않습니다 — 화면 검사 규칙과도 맞습니다). */
  var seq = 0;

  function ellipsePath(cx, cy, rx, ry) {
    return 'M' + (cx - rx) + ' ' + cy +
      'a' + rx + ' ' + ry + ' 0 1,0 ' + (2 * rx) + ' 0' +
      'a' + rx + ' ' + ry + ' 0 1,0 ' + (-2 * rx) + ' 0';
  }

  function rrectPath(x, y, w, h, r) {
    return 'M' + (x + r) + ' ' + y +
      'h' + (w - r * 2) +
      'a' + r + ' ' + r + ' 0 0,1 ' + r + ' ' + r +
      'v' + (h - r * 2) +
      'a' + r + ' ' + r + ' 0 0,1 ' + (-r) + ' ' + r +
      'h' + (-(w - r * 2)) +
      'a' + r + ' ' + r + ' 0 0,1 ' + (-r) + ' ' + (-r) +
      'v' + (-(h - r * 2)) +
      'a' + r + ' ' + r + ' 0 0,1 ' + r + ' ' + (-r) + 'z';
  }

  function ln(x1, y1, x2, y2, color, w, extra) {
    return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" fill="none" stroke="' +
      color + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || '') + '/>';
  }

  function stringsSvg(c, level) {
    var col = colorOf('string', c.string);
    var out = '';
    var i, x, y, h, hw;
    var RX = 15, RY = 19.6, CX = 32, CY = 27;
    if (level === 'broken') {
      for (i = -2; i <= 2; i++) {
        x = CX + i * 5.6;
        h = RY * Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / RX, 2)));
        out += ln(x.toFixed(2), (CY - h).toFixed(2), x.toFixed(2), (CY + h).toFixed(2), col, 1.1, ' opacity="0.92"');
      }
      for (i = -3; i <= 3; i++) {
        y = CY + i * 6.1;
        hw = RX * Math.sqrt(Math.max(0, 1 - Math.pow((y - CY) / RY, 2)));
        if (i === 0) {
          out += ln((CX - hw).toFixed(2), y.toFixed(2), (CX - 6).toFixed(2), (y + 1).toFixed(2), col, 1.25);
          out += ln((CX + 6).toFixed(2), (y - 1).toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.25);
          continue;
        }
        out += ln((CX - hw).toFixed(2), y.toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.1, ' opacity="0.88"');
      }
      return out;
    }
    var sag = level === 'worn' ? 2.4 : 0;
    for (i = -2; i <= 2; i++) {
      x = CX + i * 5.6;
      h = RY * Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / RX, 2)));
      out += sag
        ? '<path d="M' + x.toFixed(2) + ' ' + (CY - h).toFixed(2) + 'Q' + (x + (i ? i * 0.5 : 0)).toFixed(2) + ' ' + CY + ' ' + x.toFixed(2) + ' ' + (CY + h).toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="1.1" opacity="0.85"/>'
        : ln(x.toFixed(2), (CY - h).toFixed(2), x.toFixed(2), (CY + h).toFixed(2), col, 1.1, ' opacity="0.88"');
    }
    for (i = -3; i <= 3; i++) {
      y = CY + i * 6.1;
      hw = RX * Math.sqrt(Math.max(0, 1 - Math.pow((y - CY) / RY, 2)));
      out += sag
        ? '<path d="M' + (CX - hw).toFixed(2) + ' ' + y.toFixed(2) + 'Q' + CX + ' ' + (y + sag).toFixed(2) + ' ' + (CX + hw).toFixed(2) + ' ' + y.toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="1.05" opacity="0.82"/>'
        : ln((CX - hw).toFixed(2), y.toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.05, ' opacity="0.84"');
    }
    return out;
  }

  function stencilSvg(c) {
    var id = c.stencil;
    if (!id || id === 'none') return '';
    var col = colorOf('stencil', id);
    var s = '<g stroke="' + col + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">';
    if (id === 'x') {
      s += '<path d="M26 20L38 34"/><path d="M38 20L26 34"/>' +
        '<circle cx="32" cy="27" r="1.5" fill="' + col + '" stroke="none"/>';
    } else if (id === 'bolt') {
      s += '<path d="M34 15L27 27L32 27L30 39L38 25L33 25Z" fill="' + col + '" stroke="none"/>';
    } else if (id === 'crown') {
      s += '<path d="M24 32L24 22L28.5 26L32 19L35.5 26L40 22L40 32Z"/>';
    } else if (id === 'shuttle') {
      s += '<path d="M27 19L37 19L34 29L30 29Z"/><circle cx="32" cy="31.5" r="2.1" fill="' + col + '" stroke="none"/>';
    }
    return s + '</g>';
  }

  function charmSvg(c) {
    var id = c.charm;
    if (!id || id === 'none') return '';
    var col = colorOf('charm', id);
    var s = '<g stroke="' + col + '" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M35 52Q41 56 40 62" opacity="0.9"/>';
    if (id === 'medal') {
      s += '<circle cx="40" cy="66" r="4.1" fill="' + col + '" stroke="none" opacity="0.92"/>' +
        '<path d="M38.6 66L41.4 66" stroke="#0b1410" stroke-width="1.3"/>';
    } else if (id === 'attend30') {
      s += '<circle cx="40" cy="66" r="4.1"/><path d="M40 63.4L40 68.6"/>';
    } else if (id === 'streak') {
      s += '<path d="M40 62C43.4 65 43.2 69.4 40 70.2C36.8 69.4 36.6 65 40 62Z" fill="' + col + '" stroke="none" opacity="0.92"/>';
    } else if (id === 'ace') {
      s += '<path d="M40 61.8L41.4 65.2L45 65.5L42.2 67.8L43.1 71.2L40 69.3L36.9 71.2L37.8 67.8L35 65.5L38.6 65.2Z" fill="' + col + '" stroke="none"/>';
    }
    return s + '</g>';
  }

  /* 미니 라켓 SVG — viewBox 0 0 64 96, 세로 라켓 한 자루 */
  function svg(custom, opts) {
    opts = opts || {};
    var c = normalizeCustom(custom);
    var level = opts.level || 'ok';
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var uid = ++seq;
    var s = '<svg class="rksvg" viewBox="0 0 64 96" role="img" aria-hidden="true" focusable="false" data-rk="' + uid + '">';
    if (level === 'prime') {
      s += '<circle cx="32" cy="30" r="27" fill="#c6f24e" opacity="0.18"/>';
    }
    s += '<path d="' + ellipsePath(32, 27, 18, 23) + '" fill="none" stroke="#f7ffdf" stroke-width="5.8" opacity="0.20"/>' +
      '<path d="' + ellipsePath(32, 27, 18, 23) + '" fill="none" stroke="' + frame + '" stroke-width="4.2"/>' +
      '<path d="' + ellipsePath(32, 27, 15.4, 20.2) + '" fill="none" stroke="' + frame + '" stroke-width="1" opacity="0.45"/>';
    s += stringsSvg(c, level);
    /* 목 · 샤프트 */
    s += '<path d="M25 47L32 55L39 47" fill="none" stroke="' + frame + '" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M32 53L32 63" fill="none" stroke="' + frame + '" stroke-width="3.6" stroke-linecap="round"/>';
    /* 그립 */
    s += '<path d="' + rrectPath(28.6, 62, 6.8, 26, 3.2) + '" fill="' + grip + '" stroke="none"/>';
    s += '<path d="M28.6 69L35.4 66.4M28.6 75L35.4 72.4M28.6 81L35.4 78.4" stroke="#ffffff" stroke-width="0.9" opacity="0.16"/>';
    s += '<path d="M29.4 88L34.6 88" fill="none" stroke="' + grip + '" stroke-width="2.4" stroke-linecap="round"/>';
    s += stencilSvg(c) + charmSvg(c);
    if (level === 'broken') {
      s += '<g stroke="#ff6b5e" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.95">' +
        '<path d="M23 24L19 21"/><path d="M25 27L21 27"/></g>' +
        '<path d="M39 22L44 17M43 24L47 22" fill="none" stroke="#ffd166" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>';
    } else if (level === 'worn') {
      s += '<path d="M20 38Q24 42 20 46" fill="none" stroke="#ffd166" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>';
    } else if (level === 'prime') {
      s += '<g fill="#f7ffdf">' +
        '<path d="M49 12L50.2 15.2L53.4 16.4L50.2 17.6L49 20.8L47.8 17.6L44.6 16.4L47.8 15.2Z"/>' +
        '<path d="M14 34L14.8 36.2L17 37L14.8 37.8L14 40L13.2 37.8L11 37L13.2 36.2Z" opacity="0.85"/>' +
        '</g>';
    }
    return s + '</svg>';
  }

  /* ---------- 라켓 그림 (캔버스 · 공유 카드용) ---------- */
  function drawRacket(g, x, y, size, custom, opts) {
    opts = opts || {};
    var c = normalizeCustom(custom);
    var level = opts.level || 'ok';
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var str = colorOf('string', c.string);
    var s = size / 96;
    g.save();
    if (typeof g.translate === 'function') g.translate(x, y);
    if (opts.rot && typeof g.rotate === 'function') g.rotate(opts.rot);
    if (typeof g.scale === 'function') g.scale(s, s);
    g.translate(-32, -48);
    g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    /* 헤드 — 어두운 바탕에서도 프레임이 보이게 얇은 빛 테두리를 먼저 깔아 둡니다 */
    if (opts.rim) {
      g.strokeStyle = 'rgba(247,255,223,0.42)';
      g.lineWidth = 6.6;
      g.beginPath();
      g.save(); g.translate(32, 27); g.scale(1, 23 / 18); g.arc(0, 0, 18, 0, Math.PI * 2); g.restore();
      g.stroke();
    }
    g.strokeStyle = frame;
    g.lineWidth = 4.2;
    g.beginPath();
    g.save(); g.translate(32, 27); g.scale(1, 23 / 18); g.arc(0, 0, 18, 0, Math.PI * 2); g.restore();
    g.stroke();

    /* 스트링 (헤드 안쪽) */
    g.save();
    g.beginPath();
    g.translate(32, 27); g.scale(1, 19.6 / 15); g.arc(0, 0, 15, 0, Math.PI * 2); g.restore();
    g.clip();
    g.strokeStyle = str;
    g.lineWidth = 1.1;
    var i, x, y2;
    var sag = level === 'worn' ? 2.4 : 0;
    for (i = -2; i <= 2; i++) {
      x = 32 + i * 5.6;
      g.beginPath();
      g.moveTo(x, 6); g.lineTo(x, 48); g.stroke();
    }
    for (i = -3; i <= 3; i++) {
      y2 = 27 + i * 6.1;
      if (level === 'broken' && i === 0) continue;
      g.beginPath();
      g.moveTo(15, y2);
      g.lineTo(49, y2);
      if (sag && typeof g.quadraticCurveTo === 'function') g.quadraticCurveTo(32, y2 + sag, 49, y2);
      g.stroke();
    }
    g.restore();
    if (level === 'broken') {
      g.strokeStyle = str; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(18, 27); g.lineTo(26, 28); g.stroke();
      g.beginPath(); g.moveTo(38, 26); g.lineTo(46, 27); g.stroke();
    }

    /* 목 · 샤프트 · 그립 */
    g.strokeStyle = frame;
    g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(25, 47); g.lineTo(32, 55); g.lineTo(39, 47); g.stroke();
    g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(32, 53); g.lineTo(32, 63); g.stroke();
    g.fillStyle = grip;
    roundRectPath(g, 28.6, 62, 6.8, 26, 3.2);
    g.fill();

    /* 스텐실 */
    var st = c.stencil;
    if (st && st !== 'none') {
      g.strokeStyle = colorOf('stencil', st);
      g.fillStyle = colorOf('stencil', st);
      g.lineWidth = 1.6;
      if (st === 'x') {
        g.beginPath(); g.moveTo(26, 20); g.lineTo(38, 34); g.stroke();
        g.beginPath(); g.moveTo(38, 20); g.lineTo(26, 34); g.stroke();
      } else if (st === 'bolt') {
        g.beginPath(); g.moveTo(34, 15); g.lineTo(27, 27); g.lineTo(32, 27); g.lineTo(30, 39); g.lineTo(38, 25); g.lineTo(33, 25); g.closePath(); g.fill();
      } else if (st === 'crown') {
        g.beginPath(); g.moveTo(24, 32); g.lineTo(24, 22); g.lineTo(28.5, 26); g.lineTo(32, 19); g.lineTo(35.5, 26); g.lineTo(40, 22); g.lineTo(40, 32); g.closePath(); g.stroke();
      } else if (st === 'shuttle') {
        g.beginPath(); g.moveTo(27, 19); g.lineTo(37, 19); g.lineTo(34, 29); g.lineTo(30, 29); g.closePath(); g.stroke();
        g.beginPath(); g.arc(32, 31.5, 2.1, 0, Math.PI * 2); g.fill();
      }
    }

    /* 참 */
    var ch = c.charm;
    if (ch && ch !== 'none') {
      var cc = colorOf('charm', ch);
      g.strokeStyle = cc; g.fillStyle = cc; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(35, 52); g.lineTo(40, 62); g.stroke();
      g.beginPath(); g.arc(40, 66, 4.1, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function roundRectPath(g, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  /* ---------- 화면 조각 ---------- */
  function miniHtml(custom, opts) {
    opts = opts || {};
    var lvl = opts.level || 'ok';
    return '<span class="rkmini rkmini--' + lvl + (opts.cls ? ' ' + opts.cls : '') + '">' +
      svg(custom, { level: lvl }) + '</span>';
  }

  /* 다른 사람 카드·프로필에 급수·지역 옆으로 붙는 한 조각 */
  function personHtml(state, userKey, opts) {
    opts = opts || {};
    var c = customFor(state, userKey);
    var lvl = opts.level || 'ok';
    return '<span class="rkperson' + (hasCustom(c) ? '' : ' is-default') + '" title="커스텀 라켓' +
      (specText(c) ? ' · ' + U.esc(specText(c)) : '') + '">' +
      svg(c, { level: lvl }) + '</span>';
  }

  /* 상단 헤더 미니 라켓 */
  function headerHtml(state) {
    var cond = conditionOf(state);
    return svg(customOf(state && state.me), { level: cond.level });
  }

  function paintHeader(state) {
    if (!hasDom) return;
    var btn = document.getElementById('hdrRacket');
    if (!btn) return;
    var cond = conditionOf(state);
    var c = customOf(state && state.me);
    var sig = [cond.level, c.frame, c.string, c.grip, c.stencil, c.charm].join('|');
    if (btn.getAttribute('data-sig') === sig) return;
    btn.setAttribute('data-sig', sig);
    var art = btn.querySelector('.hedracket__art');
    if (art) art.innerHTML = svg(c, { level: cond.level });
    btn.className = 'hedracket is-' + cond.level;
    btn.title = cond.title + ' · 눌러서 내 라켓 꾸미기';
    btn.setAttribute('aria-label', '내 커스텀 라켓 · ' + cond.title + ' · 눌러서 꾸미기');
  }

  /* ---------- 꾸미기 시트 ---------- */
  function partHtml(state, slot) {
    var c = customOf(state.me);
    var def = PARTS[slot];
    var cells = itemsOf(slot).map(function (it) {
      var on = c[slot] === it.id;
      var open = isUnlocked(c, slot, it.id);
      var price = it.free ? '무료' : (open ? '보유' : (it.cost || 50) + 'P');
      return '<button type="button" class="rkpart' + (on ? ' is-on' : '') + (!open ? ' is-lock' : '') + '"' +
        ' data-rk-part="' + slot + ':' + it.id + '" data-rk-slot="' + slot + '" data-rk-id="' + it.id + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' aria-label="' + U.esc(def.label + ' ' + it.name + (open ? (on ? ' · 입고 있음' : ' · 입기') : ' · ' + (it.cost || 50) + 'P로 열기')) + '">' +
        '<i class="rkpart__sw" style="--c:' + it.color + '"></i>' +
        '<b class="rkpart__n">' + U.esc(it.name) + '</b>' +
        '<span class="rkpart__p' + (!open ? ' is-cost' : '') + '">' + U.esc(price) + '</span>' +
        (!open ? '<span class="rkpart__lock" aria-hidden="true">🔒</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="rkgroup" data-rk-group="' + slot + '">' +
      '<div class="rkhead"><b>' + U.esc(def.label) + '</b><span>' + U.esc(def.note) + '</span></div>' +
      '<div class="rkparts">' + cells + '</div></div>';
  }

  function sheetBody(state) {
    var cond = conditionOf(state);
    var c = customOf(state.me);
    var pd = pointsDetail(state);
    var g = BM.gear ? BM.gear.gearOf(state.me) : {};
    var spec = BM.gear ? BM.gear.specText(g) : '';
    var racketLine = [g.racket || '내 라켓', spec].filter(Boolean).join(' · ');
    return '<div class="rksheet">' +
      /* 지금 상태 */
      '<div class="rkhero rkhero--' + cond.level + '">' +
        '<div class="rkhero__art">' + svg(c, { level: cond.level }) + '</div>' +
        '<div class="rkhero__txt">' +
          '<p class="rkhero__badge">' + U.esc(cond.level === 'prime' ? '최상 컨디션' : cond.level === 'worn' ? '줄이 느슨해요' : cond.level === 'broken' ? '줄이 끊어졌어요' : '줄 상태 좋아요') + '</p>' +
          '<p class="rkhero__t">' + U.esc(cond.title) + '</p>' +
          '<p class="rkhero__s">' + U.esc(cond.line) + '</p>' +
          '<p class="rkhero__r">' + U.esc(racketLine) + (specText(c) ? ' · ' + U.esc(specText(c)) : '') + '</p>' +
        '</div>' +
      '</div>' +
      /* 포인트 */
      '<div class="rkpoints">' +
        '<div class="rkpoints__top"><b>라켓 포인트 <i>' + pd.balance + 'P</i></b>' +
        '<span>일지 +' + POINTS.log + 'P · 출석 +' + POINTS.checkin + 'P · 매칭 +' + POINTS.match + 'P</span></div>' +
        '<p class="rkpoints__line">지금까지 ' + pd.earned + 'P 모았어요 · ' + pd.spent + 'P 사용' +
        ' <small>(일지 ' + pd.logs + ' · 출석 ' + pd.checkins + ' · 매칭 ' + pd.matches + ')</small></p>' +
        '<p class="rkpoints__hint">마음에 드는 파츠부터 하나씩 열어 보세요. 기본 파츠는 무료예요.</p>' +
      '</div>' +
      /* 파츠 5칸 */
      SLOTS.map(function (slot) { return partHtml(state, slot); }).join('') +
      (lastUnlock
        ? '<div class="rkundo">' +
          '<span class="rkundo__t">' + U.esc(lastUnlock.name) + ' 파츠를 ' + lastUnlock.cost + 'P로 열었어요</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-rk-undo="1">되돌리기</button></div>'
        : '') +
      '<div class="rkactions">' +
        '<button type="button" class="btn btn--ghost grow" data-rk-open-gear="1">내 라켓 · 스트링 기록</button>' +
        '<button type="button" class="btn btn--primary grow" data-rk-share="1">공유 카드에 넣기</button>' +
      '</div>' +
      '<p class="hint">고른 색은 바로 저장되고, 1:1 매칭 카드·프로필·공유 카드에 그대로 보여요. 운동을 3일 넘게 쉬면 줄이 느슨해지고, 7일을 넘기거나 스트링 교체 시기가 지나면 끊어진 모습으로 바뀝니다.</p>' +
      '</div>';
  }

  /* 방금 연 파츠 — 한 번 누르면 바로 열리고, 시트 안 '되돌리기'로 포인트까지 되돌립니다 */
  var lastUnlock = null;

  function refreshSheet(host, state) {
    if (!host) return;
    var body = host.querySelector('.sheet__body');
    if (body) body.innerHTML = sheetBody(state);
  }

  function saveCustom(ctx, next, opts) {
    var res = ctx.actions.setGear ? ctx.actions.setGear({ custom: next }) : { ok: false };
    if (!res || !res.ok) {
      if (BM.ui) BM.ui.toast(res && res.reason === 'locked' ? '잠시만요, 저장 중이에요' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
      return false;
    }
    if (opts && opts.unlock && BM.ui) {
      BM.ui.toast('파츠를 열었어요 · ' + opts.unlock + ' 입었어요');
    } else if (BM.ui) {
      BM.ui.toast('라켓 색을 바꿨어요');
    }
    if (BM.ui) BM.ui.haptic(10);
    if (ctx.repaint) ctx.repaint();
    return true;
  }

  function openSheet(ctx) {
    if (!hasDom || !BM.ui) return null;
    lastUnlock = null;
    var state = ctx.store.state;
    if (state && state.me && state.me.key) {
      /* 현재 상태로 바로 그려 둡니다(포인트·잠금 표시가 기록에서 계산됨) */
    }
    var wrap = BM.ui.openSheet({
      title: '🏸 내 커스텀 라켓',
      body: sheetBody(state),
      onMount: function (host) {
        if (BM.views && BM.views.friends && BM.views.friends.bindCopy) BM.views.friends.bindCopy(host);
        host.addEventListener('click', function (ev) {
          var part = ev.target.closest('[data-rk-part]');
          if (part) {
            ev.preventDefault();
            var slot = part.getAttribute('data-rk-slot');
            var id = part.getAttribute('data-rk-id');
            var st = ctx.store.state;
            var cur = customOf(st.me);
            if (!isUnlocked(cur, slot, id)) {
              /* 원하는 파츠를 한 번에 열고 입습니다 — 포인트가 모자라면 미리 막습니다 */
              var price = costOf(slot, id);
              var bal = pointsBalance(st);
              var it = itemOf(slot, id) || {};
              if (bal < price) {
                BM.ui.toast('라켓 포인트가 ' + (price - bal) + 'P 부족해요 · 일지·출석으로 모아 보세요', 'error');
                return;
              }
              var next = normalizeCustom(cur);
              if (next.unlocked.indexOf(slot + ':' + id) < 0) next.unlocked.push(slot + ':' + id);
              var prevEquip = cur[slot];
              next[slot] = id;
              if (!saveCustom(ctx, next, { unlock: it.name })) return;
              lastUnlock = { slot: slot, id: id, name: it.name, cost: price, prev: prevEquip };
              BM.ui.toast(it.name + ' 파츠를 열었어요 · -' + price + 'P');
              refreshSheet(host, ctx.store.state);
              return;
            }
            var next2 = normalizeCustom(cur);
            next2[slot] = id;
            if (saveCustom(ctx, next2)) refreshSheet(host, ctx.store.state);
            return;
          }
          if (ev.target.closest('[data-rk-undo]')) {
            ev.preventDefault();
            if (!lastUnlock) return;
            var now = customOf(ctx.store.state.me);
            var back = normalizeCustom(now);
            var key = lastUnlock.slot + ':' + lastUnlock.id;
            back.unlocked = back.unlocked.filter(function (k) { return k !== key; });
            back[lastUnlock.slot] = lastUnlock.prev;
            var name = lastUnlock.name, cost = lastUnlock.cost;
            lastUnlock = null;
            if (saveCustom(ctx, back, {})) {
              BM.ui.toast(name + ' 파츠를 되돌렸어요 · ' + cost + 'P 돌아왔어요');
              refreshSheet(host, ctx.store.state);
            }
            return;
          }
          if (ev.target.closest('[data-rk-open-gear]')) {
            ev.preventDefault();
            if (BM.gear) BM.gear.openSheet(ctx);
            return;
          }
          if (ev.target.closest('[data-rk-share]')) {
            ev.preventDefault();
            BM.ui.closeSheet();
            if (BM.sharecard) {
              BM.sharecard.open(ctx, {
                mode: 'today',
                design: 'smash',
                record: (ctx.store.state.ui && ctx.store.state.ui.lastSavedLog) || null
              });
            }
            return;
          }
        });
      }
    });
    return wrap;
  }

  /* ---------- 저장 직후 임팩트 (라켓이 깨지며 오늘 운동이 퍼짐) ---------- */
  function condShort(rec) {
    if (!rec || rec.cond == null || rec.cond === '') return '';
    /* 숫자를 그대로 — '컨디션 8점' (구간 이름은 화면 다른 곳에서 이미 보여 줍니다) */
    return '컨디션 ' + rec.cond + '점';
  }

  function burstChips(state, rec) {
    rec = rec || (state && state.ui && state.ui.lastSavedLog) || null;
    var out = [];
    if (rec && rec.minutes) out.push({ k: '운동', v: rec.minutes + '분' });
    var cs = condShort(rec);
    if (cs) out.push({ k: '오늘', v: cs });
    var focus = (rec && (rec.weakness || [])[0]) || (rec && (rec.done || [])[0]) || '오늘의 훈련';
    out.push({ k: '집중', v: focus });
    var gain = pointsToday(state);
    out.push({ k: '라켓 포인트', v: '+' + (gain || POINTS.log) + 'P' });
    return out.slice(0, 4);
  }

  var BURST_MS = 880;

  function burst(opts) {
    if (!hasDom) return false;
    opts = opts || {};
    var state = opts.state || null;
    var reduce = false;
    try {
      reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { reduce = false; }
    if (reduce) return false;
    var old = document.getElementById('smashburst');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var custom = customOf(state && state.me);
    var level = (opts.level || 'prime');
    var chips = (opts.chips && opts.chips.length) ? opts.chips : burstChips(state, opts.record);
    var pos = [
      { x: -104, y: -112, r: -7 },
      { x: 106, y: -94, r: 6 },
      { x: -102, y: 104, r: 5 },
      { x: 104, y: 116, r: -6 }
    ];
    var chipHtml = chips.map(function (c, i) {
      var p = pos[i] || pos[0];
      return '<span class="smash__chip" style="--tx:' + p.x + 'px;--ty:' + p.y + 'px;--r:' + p.r + 'deg;--d:' + (i * 26) + 'ms">' +
        '<i>' + U.esc(c.k) + '</i><b>' + U.esc(c.v) + '</b></span>';
    }).join('');
    /* 파편 12개 — 각도·길이·기울기를 조금씩 어긋나게 해 '유리 조각'처럼 */
    var SHARDS = [
      [7, 3, 0.95, 64, 34, 14], [38, 5, 0.75, 86, 22, -18], [74, 4, 0.9, 58, 40, 9],
      [101, 6, 0.6, 96, 18, -12], [136, 3, 0.95, 70, 30, 16], [167, 4, 0.7, 102, 24, -22],
      [194, 5, 0.85, 62, 36, 8], [226, 3, 0.65, 92, 20, -15], [254, 4, 0.95, 66, 32, 12],
      [286, 6, 0.6, 100, 18, -9], [311, 3, 0.85, 60, 38, 18], [340, 4, 0.7, 88, 22, -20]
    ];
    var shards = '';
    for (var i = 0; i < SHARDS.length; i++) {
      var sh = SHARDS[i];
      var col = i % 3 === 0 ? '#f2c14e' : (i % 3 === 1 ? '#c6f24e' : '#f7ffdf');
      shards += '<i class="smash__shard" style="--a:' + sh[0] + 'deg;--tilt:' + sh[5] + 'deg;--d:' + sh[3] +
        'px;--w:' + sh[1] + 'px;--h:' + sh[4] + 'px;--o:' + sh[2] + ';--c:' + col + ';--dl:' + (i * 7) + 'ms"></i>';
    }
    var racket = svg(custom, { level: 'prime' });
    var node = document.createElement('div');
    node.id = 'smashburst';
    node.className = 'smashburst';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<div class="smash__stage">' +
      '<span class="smash__flash"></span>' +
      '<span class="smash__ring smash__ring--1"></span>' +
      '<span class="smash__ring smash__ring--2"></span>' +
      '<span class="smash__ring smash__ring--3"></span>' +
      '<span class="smash__rays"></span>' +
      '<span class="smash__shards">' + shards + '</span>' +
      '<span class="smash__racket">' +
        '<span class="smash__half smash__half--l">' + racket + '</span>' +
        '<span class="smash__half smash__half--r">' + racket + '</span>' +
      '</span>' +
      '<span class="smash__crack"></span>' +
      '<span class="smash__streak"></span>' +
      '<span class="smash__chips">' + chipHtml + '</span>' +
      '</div>';
    document.body.appendChild(node);
    var done = false;
    function clear() {
      if (done) return;
      done = true;
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    setTimeout(clear, BURST_MS + 120);
    if (typeof opts.onDone === 'function') setTimeout(opts.onDone, BURST_MS);
    return true;
  }

  /* 공유 카드에 넣을 내 라켓·친구 코드 정보 */
  function shareInfo(state) {
    var c = customOf(state && state.me);
    var code = '';
    if (BM.views && BM.views.friends && BM.views.friends.myCode) code = BM.views.friends.myCode(state) || '';
    var nick = (state && state.me && state.me.nick) || '';
    return {
      custom: c,
      has: hasCustom(c),
      level: conditionOf(state).level,
      name: nick,
      code: code,
      label: nick ? (nick + (code ? '#' + code : '')) : ''
    };
  }

  BM.racketcustom = {
    PARTS: PARTS, SLOTS: SLOTS, POINTS: POINTS,
    TIRED_DAYS: TIRED_DAYS, BROKEN_DAYS: BROKEN_DAYS, BURST_MS: BURST_MS,
    itemsOf: itemsOf, itemOf: itemOf, freeId: freeId, colorOf: colorOf, costOf: costOf,
    blankCustom: blankCustom, normalizeCustom: normalizeCustom, isUnlocked: isUnlocked,
    hasCustom: hasCustom, customOf: customOf, customFor: customFor, specText: specText,
    pointsDetail: pointsDetail, pointsBalance: pointsBalance, pointsToday: pointsToday,
    lastLogDate: lastLogDate, conditionOf: conditionOf,
    svg: svg, drawRacket: drawRacket, miniHtml: miniHtml, personHtml: personHtml,
    headerHtml: headerHtml, paintHeader: paintHeader,
    sheetBody: sheetBody, openSheet: openSheet,
    burstChips: burstChips, burst: burst, shareInfo: shareInfo
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
