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

  /* ============================================================
   * 3D 라켓 뷰 — 라이브러리 없이 캔버스 투영 (bm-v1.80.0)
   *   · 손가락으로 끌면 좌우 360° · 위아래 기울기, 잠시 두면 살짝 숨 쉬듯 돕니다.
   *   · 거트(문자열 면) · 테두리(프레임) · 그립을 직접 눌러 그 파츠를 바로 고릅니다.
   *   · 프레임 두께 · 빛 반사 · 스트링 격자 · 스텐실 · 그립 테이핑 · 참까지 입체로.
   * ============================================================ */
  var G3 = {
    rx: 100, ry: 126, hoop: 11,
    throat: 126, shaft: 186,
    gripY0: 186, gripY1: 292, gripR: 15,
    mid: 84
  };
  var CAM_Z = 640, FOCUS = 840;

  function rot3(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = p.x * cy + p.z * sy;
    var z1 = -p.x * sy + p.z * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
  }

  function project3(p, v) {
    var r = rot3({ x: p.x, y: p.y - G3.mid, z: p.z }, v.yaw, v.pitch);
    var s = FOCUS / (FOCUS + CAM_Z - r.z);
    return { x: v.cx + r.x * s * v.k, y: v.cy + r.y * s * v.k, z: r.z, s: s };
  }

  function shade(hex, amt) {
    var h = String(hex || '#333').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (f - r) * p); g = Math.round(g + (f - g) * p); b = Math.round(b + (f - b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function poly(g, pts, fill, stroke, lw, alpha) {
    if (!pts.length) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    if (fill) {
      g.globalAlpha = alpha == null ? 1 : alpha;
      g.fillStyle = fill;
      g.fill();
      g.globalAlpha = 1;
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lw || 1;
      g.stroke();
    }
  }

  function line3(g, a, b, color, lw, alpha) {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.strokeStyle = color;
    g.lineWidth = lw || 1;
    g.stroke();
    g.globalAlpha = 1;
  }

  /* 스트링 격자 — 안쪽 타원의 현(chord)들 */
  function stringChords(level) {
    var out = [], i, x, y, half;
    var rx = G3.rx - G3.hoop, ry = G3.ry - G3.hoop * 0.9;
    for (i = -2; i <= 2; i++) {
      x = i * (rx / 2.6);
      half = ry * Math.sqrt(Math.max(0, 1 - Math.pow(x / rx, 2)));
      out.push({ a: { x: x, y: -half, z: 0 }, b: { x: x, y: half, z: 0 }, sag: level === 'worn' ? 5 : 0 });
    }
    for (i = -3; i <= 3; i++) {
      y = i * (ry / 3.5);
      half = rx * Math.sqrt(Math.max(0, 1 - Math.pow(y / ry, 2)));
      if (level === 'broken' && i === 0) {
        out.push({ a: { x: -half, y: y, z: 0 }, b: { x: -half * 0.26, y: y + 2, z: 0 }, sag: 0 });
        out.push({ a: { x: half * 0.26, y: y - 2, z: 0 }, b: { x: half, y: y, z: 0 }, sag: 0 });
        continue;
      }
      out.push({ a: { x: -half, y: y, z: 0 }, b: { x: half, y: y, z: 0 }, sag: level === 'worn' ? 5 : 0 });
    }
    return out;
  }

  /* 스텐실 — 헤드 안쪽 좌표(2D)를 그대로 3D 평면에 얹습니다 */
  function stencil3(c) {
    var id = c.stencil;
    if (!id || id === 'none') return [];
    var col = colorOf('stencil', id);
    var seg = [];
    if (id === 'x') {
      seg = [[[-34, -16], [34, 16]], [[34, -16], [-34, 16]]];
    } else if (id === 'bolt') {
      seg = [[[10, -40], [-24, 2], [2, 2], [-10, 40], [30, -4], [4, -4], [10, -40]]];
    } else if (id === 'crown') {
      seg = [[[-38, 16], [-38, -14], [-16, 2], [0, -26], [16, 2], [38, -14], [38, 16], [-38, 16]]];
    } else if (id === 'shuttle') {
      seg = [[[-26, -30], [26, -30], [12, 12], [-12, 12], [-26, -30]], [[0, 26], [0, 18]]];
    }
    return seg.map(function (pts) {
      return { pts: pts.map(function (p) { return { x: p[0], y: p[1], z: 0 }; }), color: col };
    });
  }

  /* 한 프레임 그리기 */
  function draw3d(g, v, custom, level, w, h) {
    var c = normalizeCustom(custom);
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var str = colorOf('string', c.string);
    var N = 56;
    var i, a, p, pts;

    g.clearRect(0, 0, w, h);

    /* 바탕 — 코트 조명 */
    var glow = g.createRadialGradient(w / 2, h * 0.44, 10, w / 2, h * 0.44, Math.max(w, h) * 0.62);
    glow.addColorStop(0, 'rgba(198,242,78,0.16)');
    glow.addColorStop(0.55, 'rgba(198,242,78,0.04)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    /* 바닥 그림자 */
    var sh = project3({ x: 0, y: G3.gripY1 + 16, z: 0 }, v);
    g.save();
    g.globalAlpha = 0.34;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse ? g.ellipse(sh.x, sh.y, 92 * v.k, 20 * v.k, 0, 0, Math.PI * 2)
      : g.arc(sh.x, sh.y, 60 * v.k, 0, Math.PI * 2);
    g.fill();
    g.restore();

    /* 그림자 순서: 뒤(z<0)부터 — 그립 → 샤프트 → 스트링 → 테두리 → 참/스텐실 → 하이라이트 */
    function faceQuad(y0, y1, sx, sz, col, alpha) {
      var q = [
        project3({ x: -sx, y: y0, z: sz }, v), project3({ x: sx, y: y0, z: sz }, v),
        project3({ x: sx, y: y1, z: sz }, v), project3({ x: -sx, y: y1, z: sz }, v)
      ];
      var avgZ = (q[0].z + q[1].z + q[2].z + q[3].z) / 4;
      poly(g, q, col, null, 0, alpha);
      return avgZ;
    }

    var faces = [
      { y0: G3.gripY0, y1: G3.gripY1, sx: G3.gripR, sz: -G3.gripR, col: shade(grip, -0.34) },
      { y0: G3.gripY0, y1: G3.gripY1, sx: G3.gripR, sz: G3.gripR, col: shade(grip, 0.06) },
      { y0: G3.gripY0, y1: G3.gripY1, sx: -G3.gripR, sz: G3.gripR, col: shade(grip, -0.22) },
      { y0: G3.gripY0, y1: G3.gripY1, sx: G3.gripR, sz: G3.gripR, col: shade(grip, -0.22) },
      /* 그립 옆면(좌·우) — x=±r 평면 */
      { y0: G3.gripY0, y1: G3.gripY1, sx: G3.gripR, sz: 0, col: shade(grip, -0.14), side: 'x' }
    ];
    /* 좌우 옆면은 따로 그립니다(법선이 x축) */
    function sideQuad(y0, y1, x, col) {
      var q = [
        project3({ x: x, y: y0, z: -G3.gripR }, v), project3({ x: x, y: y0, z: G3.gripR }, v),
        project3({ x: x, y: y1, z: G3.gripR }, v), project3({ x: x, y: y1, z: -G3.gripR }, v)
      ];
      poly(g, q, col, null, 0, 1);
    }
    sideQuad(G3.gripY0, G3.gripY1, -G3.gripR, shade(grip, -0.3));
    sideQuad(G3.gripY0, G3.gripY1, G3.gripR, shade(grip, -0.3));
    faces.slice(0, 2).forEach(function (f) { faceQuad(f.y0, f.y1, f.sx, f.sz, f.col, 1); });

    /* 그립 테이핑 3줄 */
    for (var t = 1; t <= 3; t++) {
      var yy = G3.gripY0 + (G3.gripY1 - G3.gripY0) * (t / 4);
      line3(g, project3({ x: -G3.gripR, y: yy, z: G3.gripR }, v),
        project3({ x: G3.gripR, y: yy - 7, z: G3.gripR }, v), 'rgba(255,255,255,0.22)', Math.max(1, 3 * v.k), 1);
    }
    /* 그립 캡 */
    line3(g, project3({ x: -G3.gripR, y: G3.gripY1, z: G3.gripR }, v),
      project3({ x: G3.gripR, y: G3.gripY1, z: G3.gripR }, v), shade(grip, -0.45), Math.max(2, 5 * v.k), 1);

    /* 샤프트 — 목에서 그립까지 */
    poly(g, [
      project3({ x: -5, y: G3.throat, z: 0 }, v), project3({ x: 5, y: G3.throat, z: 0 }, v),
      project3({ x: 5, y: G3.gripY0 + 4, z: 0 }, v), project3({ x: -5, y: G3.gripY0 + 4, z: 0 }, v)
    ], frame, null, 0, 1);
    /* 목 (Y자) */
    line3(g, project3({ x: -18, y: G3.ry - 8, z: 0 }, v), project3({ x: 0, y: G3.throat - 6, z: 0 }, v), frame, Math.max(2, 7 * v.k), 1);
    line3(g, project3({ x: 18, y: G3.ry - 8, z: 0 }, v), project3({ x: 0, y: G3.throat - 6, z: 0 }, v), frame, Math.max(2, 7 * v.k), 1);

    /* 스트링 — 뒤쪽 반 먼저, 앞쪽 반 나중 (간단히 모두 그린 뒤 테두리로 덮습니다) */
    var chords = stringChords(level);
    chords.forEach(function (ch) {
      var a1 = project3(ch.a, v), b1 = project3(ch.b, v);
      if (ch.sag) {
        var m = project3({ x: (ch.a.x + ch.b.x) / 2, y: (ch.a.y + ch.b.y) / 2 + (ch.a.y === ch.b.y ? ch.sag : 0), z: -ch.sag }, v);
        g.beginPath(); g.moveTo(a1.x, a1.y); g.quadraticCurveTo(m.x, m.y, b1.x, b1.y);
        g.globalAlpha = 0.82; g.strokeStyle = str; g.lineWidth = Math.max(1, 2.1 * v.k); g.stroke(); g.globalAlpha = 1;
      } else {
        line3(g, a1, b1, str, Math.max(1, 2.1 * v.k), 0.9);
      }
    });
    if (level === 'broken') {
      line3(g, project3({ x: -26, y: 0, z: 0 }, v), project3({ x: -8, y: 4, z: 0 }, v), '#ff6b5e', Math.max(1, 2.4 * v.k), 1);
      line3(g, project3({ x: 12, y: -4, z: 0 }, v), project3({ x: 30, y: 0, z: 0 }, v), '#ff6b5e', Math.max(1, 2.4 * v.k), 1);
    }

    /* 스텐실 */
    stencil3(c).forEach(function (part) {
      var pp = part.pts.map(function (p2) { return project3(p2, v); });
      g.beginPath();
      g.moveTo(pp[0].x, pp[0].y);
      for (var k = 1; k < pp.length; k++) g.lineTo(pp[k].x, pp[k].y);
      g.globalAlpha = 0.92;
      g.strokeStyle = part.color;
      g.lineWidth = Math.max(1.4, 3.4 * v.k);
      g.stroke();
      g.globalAlpha = 1;
    });

    /* 테두리(프레임) — 앞/뒤 두 겹 + 두께 */
    function band(z, colFront, alpha) {
      for (var i2 = 0; i2 < N; i2++) {
        var a0 = i2 / N * Math.PI * 2, a1 = (i2 + 1) / N * Math.PI * 2;
        var o0 = { x: Math.cos(a0) * G3.rx, y: Math.sin(a0) * G3.ry, z: z };
        var o1 = { x: Math.cos(a1) * G3.rx, y: Math.sin(a1) * G3.ry, z: z };
        var i0 = { x: Math.cos(a0) * (G3.rx - G3.hoop), y: Math.sin(a0) * (G3.ry - G3.hoop * 0.9), z: z };
        var i1 = { x: Math.cos(a1) * (G3.rx - G3.hoop), y: Math.sin(a1) * (G3.ry - G3.hoop * 0.9), z: z };
        var q = [project3(o0, v), project3(o1, v), project3(i1, v), project3(i0, v)];
        var depth = (q[0].z + q[1].z + q[2].z + q[3].z) / 4;
        var lit = depth < 0 ? -0.3 : 0.12;
        poly(g, q, shade(colFront, lit + (depth > 30 ? 0.06 : -0.04)), null, 0, alpha);
      }
    }
    band(-G3.hoop * 0.5, frame, 0.92);
    band(G3.hoop * 0.5, frame, 1);
    /* 테두리 바깥면 — 두 겹 사이를 이어 두께를 보여 줍니다 */
    for (var s2 = 0; s2 < N; s2 += 2) {
      var b0 = s2 / N * Math.PI * 2, b1 = (s2 + 2) / N * Math.PI * 2;
      var e0f = project3({ x: Math.cos(b0) * G3.rx, y: Math.sin(b0) * G3.ry, z: G3.hoop * 0.5 }, v);
      var e1f = project3({ x: Math.cos(b1) * G3.rx, y: Math.sin(b1) * G3.ry, z: G3.hoop * 0.5 }, v);
      var e0b = project3({ x: Math.cos(b0) * G3.rx, y: Math.sin(b0) * G3.ry, z: -G3.hoop * 0.5 }, v);
      var e1b = project3({ x: Math.cos(b1) * G3.rx, y: Math.sin(b1) * G3.ry, z: -G3.hoop * 0.5 }, v);
      poly(g, [e0f, e1f, e1b, e0b], shade(frame, -0.45), null, 0, 0.9);
    }

    /* 빛 반사 — 앞쪽 위 테두리에 하이라이트 */
    g.save();
    g.beginPath();
    for (var h2 = 0; h2 <= 20; h2++) {
      var aH = (-2.55 + (h2 / 20) * 1.5);
      var pH = project3({ x: Math.cos(aH) * (G3.rx - G3.hoop / 2), y: Math.sin(aH) * (G3.ry - G3.hoop / 2), z: G3.hoop * 0.5 }, v);
      if (h2 === 0) g.moveTo(pH.x, pH.y); else g.lineTo(pH.x, pH.y);
    }
    g.strokeStyle = 'rgba(255,255,255,0.62)';
    g.lineWidth = Math.max(1.4, 3.6 * v.k);
    g.lineCap = 'round';
    g.stroke();
    g.restore();

    /* 참 — 그립 목에 매단 열쇠고리 */
    if (c.charm && c.charm !== 'none') {
      var cc = colorOf('charm', c.charm);
      var top = project3({ x: G3.gripR - 4, y: G3.gripY0 + 6, z: 2 }, v);
      var end = project3({ x: G3.gripR + 18, y: G3.gripY0 + 40, z: 6 }, v);
      line3(g, top, end, 'rgba(247,255,223,0.55)', Math.max(1, 1.8 * v.k), 1);
      var r = Math.max(3, 9 * end.s * v.k);
      g.beginPath();
      g.arc(end.x, end.y, r, 0, Math.PI * 2);
      g.fillStyle = cc; g.fill();
      g.strokeStyle = shade(cc, -0.3); g.lineWidth = 1; g.stroke();
    }
  }

  /* 화면 좌표 → 파츠 (거트 · 테두리 · 그립) */
  function hitSlot(px, py, v) {
    var i, q, best;
    /* 그립 */
    var g0 = project3({ x: 0, y: G3.gripY0, z: 0 }, v);
    var g1 = project3({ x: 0, y: G3.gripY1, z: 0 }, v);
    if (distToSeg(px, py, g0, g1) < Math.max(14, G3.gripR * 1.7 * g0.s * v.k)) return 'grip';
    /* 테두리 — 바깥 고리 선 */
    best = 1e9;
    for (i = 0; i < 72; i++) {
      var a0 = i / 72 * Math.PI * 2;
      var pt = project3({ x: Math.cos(a0) * (G3.rx - G3.hoop / 2), y: Math.sin(a0) * (G3.ry - G3.hoop / 2), z: 0 }, v);
      var d = Math.sqrt((pt.x - px) * (pt.x - px) + (pt.y - py) * (pt.y - py));
      if (d < best) best = d;
    }
    if (best < Math.max(12, G3.hoop * 1.5 * v.k)) return 'frame';
    /* 안쪽(거트) */
    var polyPts = [];
    for (i = 0; i < 24; i++) {
      var a1 = i / 24 * Math.PI * 2;
      polyPts.push(project3({ x: Math.cos(a1) * (G3.rx - G3.hoop), y: Math.sin(a1) * (G3.ry - G3.hoop), z: 0 }, v));
    }
    if (inPoly(px, py, polyPts)) return 'string';
    /* 목·샤프트도 테두리로 */
    var s0 = project3({ x: 0, y: G3.throat, z: 0 }, v);
    var s1 = project3({ x: 0, y: G3.gripY0, z: 0 }, v);
    if (distToSeg(px, py, s0, s1) < 12) return 'frame';
    return '';
  }

  function distToSeg(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = dx * dx + dy * dy;
    var t = len ? ((px - a.x) * dx + (py - a.y) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    var x = a.x + dx * t, y = a.y + dy * t;
    return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
  }

  function inPoly(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-6) + xi)) inside = !inside;
    }
    return inside;
  }

  var viewMem = { yaw: -0.42, pitch: 0.14 };

  /* 시트 안의 3D 뷰를 붙입니다 — 드래그 회전 · 탭하면 그 파츠로 */
  function mount3d(host, ctx) {
    if (!hasDom) return null;
    var cv = host.querySelector('.rk3d__cv');
    if (!cv || !cv.getContext) return null;
    var g = cv.getContext('2d');
    if (!g) return null;
    var state = ctx.store.state;
    var dpr = Math.min(2, (root.devicePixelRatio || 1));
    /* 색을 바꿔 다시 그려도 보던 각도 그대로 (시트를 닫았다 열어도) */
    var v = { yaw: viewMem.yaw, pitch: viewMem.pitch, k: 1, cx: 0, cy: 0 };
    var drag = null, lastMove = 0, raf = 0, alive = true;
    var w = 0, h = 0;

    function fit() {
      var rect = cv.getBoundingClientRect();
      w = Math.max(160, Math.round(rect.width));
      h = Math.max(200, Math.round(rect.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      v.k = Math.min(w / 300, h / 430) * 1.46;
      v.cx = w / 2;
      v.cy = h / 2 - 4;
    }

    function paint() {
      if (!alive) return;
      var c = customOf(ctx.store.state.me);
      var lvl = conditionOf(ctx.store.state).level;
      draw3d(g, v, c, lvl, w, h);
    }

    function loop() {
      if (!alive) return;
      if (!cv.isConnected) { alive = false; return; }
      var now = Date.now();
      if (!drag && now - lastMove > 1600) {
        v.yaw += 0.0042;                     /* 가만히 두면 살짝 숨 쉬듯 돕니다 */
        viewMem.yaw = v.yaw;
        paint();
      }
      raf = root.requestAnimationFrame(loop);
    }

    fit();
    paint();
    raf = root.requestAnimationFrame(loop);

    cv.addEventListener('pointerdown', function (ev) {
      if (ev.button && ev.button !== 0) return;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, moved: 0 };
      lastMove = Date.now();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      if (ev.preventDefault) ev.preventDefault();
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      v.yaw += dx * 0.012;
      v.pitch = Math.max(-0.9, Math.min(0.9, v.pitch - dy * 0.008));
      viewMem.yaw = v.yaw; viewMem.pitch = v.pitch;
      lastMove = Date.now();
      paint();
    });
    function endDrag(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var wasTap = drag.moved < 8;
      var r = cv.getBoundingClientRect();
      var px = (ev ? ev.clientX : 0) - r.left, py = (ev ? ev.clientY : 0) - r.top;
      try { cv.releasePointerCapture(drag.id); } catch (e) { /* 무시 */ }
      drag = null;
      lastMove = Date.now();
      if (!wasTap) return;
      var slot = hitSlot(px, py, v);
      if (slot) pickSlot(host, ctx, slot);
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', endDrag);

    var api = { view: v, paint: paint, redraw: paint };
    if (BM.racketcustom) BM.racketcustom._last3d = api;
    return api;
  }

  /* 부위 탭 → 그 파츠 탭을 바로 열고 살짝 반짝 */
  function pickSlot(host, ctx, slot) {
    activeSlot = SLOTS.indexOf(slot) >= 0 ? slot : activeSlot;
    if (BM.ui) { BM.ui.haptic(8); }
    refreshSheet(host, ctx);
    var body = host.querySelector('.sheet__body');
    if (!body) return;
    var flashEl = body.querySelector('.rk3d');
    if (flashEl) {
      flashEl.classList.add('is-pick');
      setTimeout(function () { if (flashEl) flashEl.classList.remove('is-pick'); }, 560);
    }
    if (BM.ui && BM.ui.toast) {
      BM.ui.toast(activeSlot === 'string' ? '거트 색을 골라 보세요' : activeSlot === 'grip' ? '그립 색을 골라 보세요' : '테두리 색을 골라 보세요');
    }
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
    return '<div class="rkgroup' + (slot === activeSlot ? ' is-active' : '') + '" data-rk-group="' + slot + '"' +
      (slot === activeSlot ? '' : ' hidden') + '>' +
      '<div class="rkhead"><b>' + U.esc(def.label) + '</b><span>' + U.esc(def.note) + '</span>' +
      (slot === activeSlot ? '<i class="rkhead__now">지금 고르는 중</i>' : '') + '</div>' +
      '<div class="rkparts">' + cells + '</div></div>';
  }

  /* 지금 고르는 파츠 — 3D 라켓에서 부위를 눌러도 여기가 바뀝니다 */
  var activeSlot = 'frame';

  function tabHtml() {
    return '<div class="rk3d__tabs" role="tablist" aria-label="바꿀 부위">' +
      SLOTS.map(function (slot) {
        var on = slot === activeSlot;
        var tabName = { frame: '테두리', string: '거트', grip: '그립', stencil: '스텐실', charm: '참' }[slot];
        return '<button type="button" class="rk3d__tab' + (on ? ' is-on' : '') + '" data-rk-slot="' + slot + '"' +
          ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '">' + U.esc(tabName) + '</button>';
      }).join('') + '</div>';
  }

  function sheetBody(state) {
    var cond = conditionOf(state);
    var c = customOf(state.me);
    var pd = pointsDetail(state);
    var g = BM.gear ? BM.gear.gearOf(state.me) : {};
    var spec = BM.gear ? BM.gear.specText(g) : '';
    var racketLine = [g.racket || '내 라켓', spec].filter(Boolean).join(' · ');
    return '<div class="rksheet">' +
      /* 3D 라켓 — 끌어서 360°, 부위를 눌러 바로 꾸미기 */
      '<div class="rk3d" data-rk-3d>' +
        '<canvas class="rk3d__cv" width="600" height="760" aria-label="내 라켓 3D 보기 · 끌어서 돌리고 거트·테두리·그립을 눌러 꾸미기"></canvas>' +
        '<p class="rk3d__hint"><span aria-hidden="true">↔</span> 끌어서 360° 돌려보기 · <b>거트 · 테두리 · 그립</b>을 눌러 바로 바꿔요</p>' +
        tabHtml() +
      '</div>' +
      /* 지금 상태 */
      '<div class="rkhero rkhero--' + cond.level + '">' +
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

  function refreshSheet(host, ctx) {
    if (!host || !ctx) return;
    var body = host.querySelector('.sheet__body');
    if (!body) return;
    body.innerHTML = sheetBody(ctx.store.state);
    mount3d(host, ctx);
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
    activeSlot = 'frame';
    var state = ctx.store.state;
    if (state && state.me && state.me.key) {
      /* 현재 상태로 바로 그려 둡니다(포인트·잠금 표시가 기록에서 계산됨) */
    }
    var wrap = BM.ui.openSheet({
      title: '🏸 내 커스텀 라켓',
      body: sheetBody(state),
      onMount: function (host) {
        if (BM.views && BM.views.friends && BM.views.friends.bindCopy) BM.views.friends.bindCopy(host);
        mount3d(host, ctx);
        host.addEventListener('click', function (ev) {
          var tab = ev.target.closest('.rk3d__tab');
          if (tab) {
            ev.preventDefault();
            var slotPick = tab.getAttribute('data-rk-slot');
            if (SLOTS.indexOf(slotPick) >= 0 && slotPick !== activeSlot) {
              activeSlot = slotPick;
              BM.ui.haptic(6);
              refreshSheet(host, ctx);
            }
            return;
          }
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
              refreshSheet(host, ctx);
              return;
            }
            var next2 = normalizeCustom(cur);
            next2[slot] = id;
            if (saveCustom(ctx, next2)) refreshSheet(host, ctx);
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
              refreshSheet(host, ctx);
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
    sheetBody: sheetBody, openSheet: openSheet, pickSlot: pickSlot, mount3d: mount3d,
    /* 3D 뷰 (테스트·재사용) */
    G3: G3, rot3: rot3, project3: project3, hitSlot: hitSlot, draw3d: draw3d, inPoly: inPoly,
    burstChips: burstChips, burst: burst, shareInfo: shareInfo
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
