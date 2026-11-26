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

  /* ---------- 등급 (bm-v1.81.0) ----------
   * 일반 · 레어 · 에픽 · 레전드 — 카드 테두리 글로우와 해금 가격이 등급을 따라갑니다. */
  var RARITY = {
    common: { id: 'common', name: '일반', color: '#9aa6b0', rank: 0 },
    rare: { id: 'rare', name: '레어', color: '#4aa3ff', rank: 1 },
    epic: { id: 'epic', name: '에픽', color: '#a678ff', rank: 2 },
    legend: { id: 'legend', name: '레전드', color: '#f2c14e', rank: 3 }
  };
  var RARITY_IDS = ['common', 'rare', 'epic', 'legend'];

  function rarityOf(r) { return RARITY[r] || RARITY.common; }

  /* ---------- 파츠 (실제 배드민턴 용품 감성의 색 이름만) ---------- */
  var PARTS = {
    frame: {
      label: '프레임', note: '라켓 몸통 색',
      items: [
        { id: 'matte', name: '매트 블랙', color: '#23272b', free: true, rarity: 'common' },
        { id: 'carbon', name: '스텔스 카본', color: '#3e4a55', cost: 60, rarity: 'rare' },
        { id: 'white', name: '아크 화이트', color: '#eef2f4', cost: 60, rarity: 'rare' },
        { id: 'navy', name: '로열 네이비', color: '#22409f', cost: 80, rarity: 'epic' },
        { id: 'red', name: '파이어 레드', color: '#e0433c', cost: 80, rarity: 'epic' }
      ]
    },
    string: {
      label: '스트링', note: '줄 색',
      items: [
        { id: 'lime', name: '형광 라임', color: '#c6f24e', free: true, rarity: 'common' },
        { id: 'white', name: '화이트', color: '#f3f7ef', cost: 30, rarity: 'common' },
        { id: 'gold', name: '골드', color: '#f2c14e', cost: 40, rarity: 'rare' },
        { id: 'cobalt', name: '코발트 블루', color: '#3f7cf2', cost: 40, rarity: 'rare' },
        { id: 'pink', name: '핑크', color: '#ff7fb0', cost: 40, rarity: 'rare' }
      ]
    },
    grip: {
      label: '그립', note: '손잡이 색',
      items: [
        { id: 'black', name: '블랙', color: '#1d2124', free: true, rarity: 'common' },
        { id: 'neon', name: '네온 라임', color: '#c6f24e', cost: 30, rarity: 'common' },
        { id: 'mint', name: '파스텔 민트', color: '#a8e6cf', cost: 30, rarity: 'common' },
        { id: 'coral', name: '코랄 핑크', color: '#ff9a8b', cost: 40, rarity: 'rare' },
        { id: 'purple', name: '퍼플', color: '#8f7bf2', cost: 40, rarity: 'rare' }
      ]
    },
    stencil: {
      label: '스텐실', note: '헤드 마크',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common' },
        { id: 'x', name: 'X자 셔틀', color: '#f2c14e', cost: 50, rarity: 'rare' },
        { id: 'bolt', name: '번개', color: '#c6f24e', cost: 50, rarity: 'rare' },
        { id: 'crown', name: '왕관', color: '#f2c14e', cost: 90, rarity: 'epic' },
        { id: 'shuttle', name: '셔틀콕', color: '#eef2f4', cost: 50, rarity: 'rare' }
      ]
    },
    charm: {
      label: '라켓 참', note: '손잡이 위 작은 장식',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common' },
        { id: 'medal', name: '체전 메달', color: '#f2c14e', cost: 80, rarity: 'epic' },
        { id: 'attend30', name: '30일 출석', color: '#c6f24e', cost: 60, rarity: 'rare' },
        { id: 'streak', name: '연속 7일', color: '#ff9a8b', cost: 60, rarity: 'rare' },
        { id: 'ace', name: '에이스', color: '#8fd0ff', cost: 120, rarity: 'legend' }
      ]
    },
    /* 색이 아니라 '연출' — 3D 라켓 캔버스에서 움직입니다 */
    effect: {
      label: '효과', note: '라켓 연출', fx: true,
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common', note: '깔끔한 기본 카본' },
        { id: 'speed', name: '스피드 링', color: '#7fd8ff', cost: 50, rarity: 'rare', note: '헤드 주변 회전 궤적' },
        { id: 'spark', name: '스파크 전기', color: '#9fd8ff', cost: 80, rarity: 'epic', note: '톡톡 튀는 전기 스파크' },
        { id: 'blaze', name: '블레이즈 오라', color: '#ff8a2f', cost: 100, rarity: 'epic', note: '헤드를 감싸는 불꽃' },
        { id: 'prism', name: '챔피언 프리즘', color: '#f2c14e', cost: 150, rarity: 'legend', note: '금빛 홀로그램 광채' },
        /* bm-v1.82.0 — 하트로 바로 여는 스페셜 스매시(포인트 아니라 하트) */
        { id: 'fire', name: '불꽃 스매시', color: '#ff7a2f', heart: 2, rarity: 'epic', smash: true, note: '터치하면 불꽃이 활짝' },
        { id: 'thunder', name: '번개 셔틀', color: '#8fd0ff', heart: 3, rarity: 'legend', smash: true, note: '번개와 함께 셔틀 발사' }
      ]
    }
  };
  var SLOTS = ['frame', 'string', 'grip', 'stencil', 'charm', 'effect'];
  var FX_TAB = { frame: '테두리', string: '거트', grip: '그립', stencil: '스텐실', charm: '참', effect: '효과' };

  /* ---------- 라켓 바디(모델) 4종 (bm-v1.81.0) ----------
   * 실존 브랜드·모델 이름은 쓰지 않습니다(상표권) — 특징만 다르게 지은 오리지널 이름.
   * 헤드:샤프트:그립 ≈ 25:22:20 (전체 약 675mm) 실제 배드민턴 비율을 바디마다 다르게 잡았습니다. */
  var BODIES = {
    power77: {
      id: 'power77', name: '파워 77', note: '헤드헤비 · 공격형',
      accent: '#ff7a2f', decal: 'slash', free: true, cost: 0, rarity: 'common',
      rx: 100, ry: 126, hoop: 12.6, shaftR: 4.9, gripR: 14.2,
      shaftLen: 214, gripLen: 200, tJoint: 26, cone: 34,
      profile: [[0, -1], [0.5, -0.985], [0.8, -0.915], [0.965, -0.66], [1, -0.26], [1, 0.16],
        [0.955, 0.5], [0.875, 0.73], [0.735, 0.885], [0.51, 0.975], [0.255, 1], [0, 1.015]]
    },
    aero: {
      id: 'aero', name: '스피드 에어로', note: '초경량 · 드라이브형',
      accent: '#7fd8ff', decal: 'ring', cost: 60, rarity: 'rare',
      rx: 96, ry: 123, hoop: 8.4, shaftR: 3.8, gripR: 13.4,
      shaftLen: 222, gripLen: 192, tJoint: 16, cone: 30,
      profile: [[0, -1], [0.42, -0.98], [0.72, -0.88], [0.92, -0.6], [1, -0.2], [0.99, 0.22],
        [0.93, 0.55], [0.82, 0.75], [0.62, 0.9], [0.36, 0.99], [0.14, 1.02], [0, 1.03]]
    },
    control: {
      id: 'control', name: '컨트롤 아크', note: '올라운드 · 밸런스형',
      accent: '#f2c14e', decal: 'wing', cost: 90, rarity: 'epic',
      rx: 100, ry: 125, hoop: 10.6, shaftR: 4.4, gripR: 14,
      shaftLen: 202, gripLen: 218, tJoint: 22, cone: 32,
      profile: [[0, -1], [0.46, -0.99], [0.77, -0.9], [0.95, -0.63], [1, -0.22], [1, 0.18],
        [0.95, 0.5], [0.86, 0.72], [0.7, 0.88], [0.48, 0.97], [0.24, 1], [0, 1.01]]
    },
    smash: {
      id: 'smash', name: '스매시 맥스', note: '콤팩트 헤드 · 극공격',
      accent: '#cfd8e4', decal: 'block', cost: 140, rarity: 'legend',
      rx: 89, ry: 111, hoop: 13.4, shaftR: 5.4, gripR: 14.6,
      shaftLen: 246, gripLen: 172, tJoint: 34, cone: 36,
      profile: [[0, -1], [0.52, -0.98], [0.82, -0.9], [0.98, -0.62], [1, -0.2], [1, 0.2],
        [0.95, 0.52], [0.86, 0.74], [0.7, 0.9], [0.46, 0.98], [0.22, 1], [0, 1]]
    }
  };
  var BODY_IDS = ['power77', 'aero', 'control', 'smash'];
  var DEFAULT_BODY = 'power77';

  function bodyOf(id) { return BODIES[id] || BODIES[DEFAULT_BODY]; }

  /* 포인트 — 기록에서 그때그때 계산 (저장·차감 원장 없음) */
  var POINTS = { log: 10, checkin: 5, match: 15 };

  function itemsOf(slot) {
    if (slot === 'body') return BODY_IDS.map(function (id) { return BODIES[id]; });
    return (PARTS[slot] && PARTS[slot].items) || [];
  }
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
    return (it && !it.free && !it.heart) ? (it.cost || 50) : 0;
  }

  /* 하트로 사는 파츠(스페셜 스매시) — 포인트와 섞이지 않게 따로 셉니다 */
  function heartCostOf(slot, id) {
    var it = itemOf(slot, id);
    return (it && !it.free && it.heart) ? (it.heart || 0) : 0;
  }

  function isHeartItem(slot, id) { return heartCostOf(slot, id) > 0; }

  /* ---------- 저장 모양 ---------- */

  function blankCustom() {
    var o = { unlocked: [], body: DEFAULT_BODY };
    SLOTS.forEach(function (slot) { o[slot] = freeId(slot); });
    return o;
  }

  function normalizeCustom(o) {
    if (typeof o === 'string') o = U.jsonParse(o, null);
    if (!o || typeof o !== 'object') return blankCustom();
    var out = blankCustom();
    out.body = BODIES[String(o.body == null ? '' : o.body)] ? String(o.body) : DEFAULT_BODY;
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
      if (SLOTS.indexOf(slot) < 0 && slot !== 'body') return;
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
    if (!isUnlocked(out, 'body', out.body)) out.body = DEFAULT_BODY;
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

  /* ---------- 등급 — 입고 있는 것 중 가장 높은 등급 ---------- */
  function rarityRankOf(c) {
    var c2 = normalizeCustom(c);
    var best = rarityOf(bodyOf(c2.body).rarity).rank;
    SLOTS.forEach(function (slot) {
      var it = itemOf(slot, c2[slot]);
      if (it) best = Math.max(best, rarityOf(it.rarity).rank);
    });
    return best;
  }

  function topRarity(c) { return RARITY[RARITY_IDS[rarityRankOf(c)]]; }

  function rarityNameOf(slot, id) {
    var it = itemOf(slot, id);
    return rarityOf(it && it.rarity).name;
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

  /* 교체일만 적어 둔 사람도 날짜는 세도록 — 라켓 이름 없이 '오늘 갈았어요'만 눌러도 동작 */
  function statusFor(g, now) {
    if (!BM.gear) return { state: 'empty', has: false };
    var gg = BM.gear.normalizeGear(g);
    if (!gg || !gg.strungAt) return BM.gear.statusOf(gg, now || null);
    return BM.gear.statusOf({
      racket: gg.racket || '내 라켓', string: gg.string, tension: gg.tension,
      strungAt: gg.strungAt, cycleDays: gg.cycleDays || 30, memo: gg.memo
    }, now || null);
  }

  function conditionOf(state, now) {
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = statusFor(g, now);
    var last = lastLogDate(state);
    var sinceLog = last ? daysBetween(last, U.ymd(now || undefined)) : null;
    if (sinceLog != null && sinceLog < 0) sinceLog = 0;
    var out = {
      level: 'ok', gearState: st.state, hasGear: !!st.has,
      daysSinceLog: sinceLog,
      title: '줄 상태 좋아요', line: '오늘도 코트에서 만나요'
    };
    if (st.state === 'ok' && st.has && st.daysSince === 0) {
      /* 오늘 새 줄로 갈았으면 쉬는 날이 길었어도 새 줄은 팽팽합니다 */
      out.level = 'prime';
      out.title = '새 줄 · 최상 컨디션이에요';
      out.line = 'D+0 · 교체까지 ' + st.daysLeft + '일';
    } else if (st.state === 'due') {
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

  /* ---------- 미니 라켓(SVG)의 바디 데칼 · 효과 ---------- */
  function headArc(a0, a1, rx, ry) {
    rx = rx || 18; ry = ry || 23;
    var x0 = 32 + rx * Math.cos(a0 * Math.PI / 180), y0 = 27 + ry * Math.sin(a0 * Math.PI / 180);
    var x1 = 32 + rx * Math.cos(a1 * Math.PI / 180), y1 = 27 + ry * Math.sin(a1 * Math.PI / 180);
    var big = Math.abs(a1 - a0) > 180 ? 1 : 0;
    var sweep = a1 > a0 ? 1 : 0;
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A' + rx + ' ' + ry + ' 0 ' + big + ' ' + sweep +
      ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }

  function bodyDecalSvg(c) {
    var b = bodyOf(c.body);
    var acc = b.accent;
    var out = '';
    if (b.decal === 'slash') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="2.4" stroke-linecap="round" opacity="0.95">' +
        '<path d="' + headArc(-62, -34, 16.4, 21.4) + '"/>' +
        '<path d="' + headArc(16, 40, 16.4, 21.4) + '"/>' +
        '<path d="' + headArc(140, 166, 16.4, 21.4) + '"/></g>';
    } else if (b.decal === 'ring') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="1.3" opacity="0.9">' +
        '<path d="' + headArc(-4, 4, 17.4, 22.4) + '"/>' +
        '<path d="' + headArc(176, 184, 17.4, 22.4) + '"/></g>' +
        '<path d="M30.2 57.2L33.8 57.2" stroke="' + acc + '" stroke-width="1.6" stroke-linecap="round"/>';
    } else if (b.decal === 'wing') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="1.8" stroke-linecap="round" opacity="0.95">' +
        '<path d="' + headArc(-16, 12, 16.6, 21.6) + '"/>' +
        '<path d="' + headArc(164, 196, 16.6, 21.6) + '"/></g>';
    } else if (b.decal === 'block') {
      out += '<path d="' + headArc(52, 128, 16.8, 21.8) + '" fill="none" stroke="' + acc +
        '" stroke-width="3.4" stroke-linecap="round" opacity="0.95"/>' +
        '<path d="M29.6 47.6L34.4 47.6" stroke="' + acc + '" stroke-width="2.6" stroke-linecap="round"/>';
    }
    return out;
  }

  function fxSvg(c) {
    var id = c.effect;
    if (!id || id === 'none') return '';
    if (id === 'speed') {
      return '<g fill="none" stroke="#9fe6ff" stroke-linecap="round" opacity="0.85">' +
        '<path d="' + headArc(-150, -110, 21, 26.6) + '" stroke-width="1.6"/>' +
        '<path d="' + headArc(-20, 20, 21.4, 27) + '" stroke-width="1.2" opacity="0.7"/>' +
        '<path d="' + headArc(70, 100, 21, 26.6) + '" stroke-width="1.4" opacity="0.6"/></g>';
    }
    if (id === 'spark') {
      return '<g fill="#8fd0ff" opacity="0.95">' +
        '<path d="M47 12L50 16L48.4 16L50 20L46.4 16.6L48 16.4Z"/>' +
        '<path d="M15 20L18 24L16.4 24L18 28L14.4 24.6L16 24.4Z" opacity="0.8"/>' +
        '<path d="M46 40L48.6 43.4L47.2 43.4L48.6 47L45.4 44L46.8 43.8Z" opacity="0.7"/></g>';
    }
    if (id === 'blaze') {
      return '<g opacity="0.9">' +
        '<path d="M32 1C36 5 36.6 8.6 32 11C27.4 8.6 28 5 32 1Z" fill="#ffb347"/>' +
        '<path d="M20 8C23 11 23 14 20 16C17 14 17 11 20 8Z" fill="#ff8a2f" opacity="0.8"/>' +
        '<path d="M44 8C47 11 47 14 44 16C41 14 41 11 44 8Z" fill="#ff8a2f" opacity="0.8"/></g>';
    }
    /* bm-v1.82.0 — 하트로 여는 스페셜 스매시도 미니 라켓에 표시 */
    if (id === 'fire') {
      return '<g opacity="0.95">' +
        '<path d="M32 0C36.4 4.6 37 8.8 32 11.6C27 8.8 27.6 4.6 32 0Z" fill="#ffd166"/>' +
        '<path d="M32 3.4C34.2 5.8 34.4 7.6 32 9.2C29.6 7.6 29.8 5.8 32 3.4Z" fill="#ff6a2b"/>' +
        '<path d="M19 7C21.6 9.8 21.6 12.6 19 14.6C16.4 12.6 16.4 9.8 19 7Z" fill="#ff8a2f" opacity="0.75"/>' +
        '<path d="M45 7C47.6 9.8 47.6 12.6 45 14.6C42.4 12.6 42.4 9.8 45 7Z" fill="#ff8a2f" opacity="0.75"/></g>';
    }
    if (id === 'thunder') {
      return '<g opacity="0.95">' +
        '<path d="M35 0L27 13H32L29 24L39 9H33.6L37 0Z" fill="#7fd8ff"/>' +
        '<path d="M20 14L16 22H19L17.6 28L23 20H20.4L22 14Z" fill="#d6ecff" opacity="0.85"/>' +
        '<path d="M45 20L42 27H44.6L42.8 33L47 26H44.6L46 20Z" fill="#d6ecff" opacity="0.7"/></g>';
    }
    return '<g fill="#f2c14e" opacity="0.95">' +
      '<path d="M49 8L50.4 12L54 13.4L50.4 14.8L49 18.8L47.6 14.8L44 13.4L47.6 12Z"/>' +
      '<path d="M14 32L15 34.6L17.6 35.6L15 36.6L14 39.2L13 36.6L10.4 35.6L13 34.6Z" opacity="0.85"/>' +
      '<path d="M47 44L48 46.2L50.2 47.2L48 48.2L47 50.4L46 48.2L43.8 47.2L46 46.2Z" opacity="0.7"/></g>';
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
    s += bodyDecalSvg(c);
    s += stencilSvg(c) + charmSvg(c);
    s += fxSvg(c);
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
    var body = bodyOf(c.body);
    var acc = body.accent;
    var s = size / 96;
    g.save();
    if (typeof g.translate === 'function') g.translate(x, y);
    if (opts.rot && typeof g.rotate === 'function') g.rotate(opts.rot);
    if (typeof g.scale === 'function') g.scale(s, s);
    g.translate(-32, -48);
    g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    /* 바디별 데칼 · 효과 — 공유 카드에서도 모델과 연출이 그대로 보입니다 */
    function ringArc(rx, ry, a0, a1, color, lw, alpha) {
      g.save();
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * alpha;
      g.beginPath();
      g.translate(32, 27); g.scale(1, ry / rx);
      if (g.arc) g.arc(0, 0, rx, a0, a1);
      g.restore();
      g.stroke();
      g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    }

    /* 연출 — 헤드 뒤 후광 */
    if (c.effect === 'speed') {
      ringArc(21, 26, -2.6, -1.9, '#9fe6ff', 1.6, 0.8);
      ringArc(22, 27, -0.3, 0.35, '#9fe6ff', 1.2, 0.65);
      ringArc(21, 26, 1.2, 1.75, '#d8f6ff', 1.4, 0.6);
    } else if (c.effect === 'spark') {
      if (g.createRadialGradient) {
        var sg = g.createRadialGradient(32, 27, 2, 32, 27, 26);
        sg.addColorStop(0, 'rgba(140,210,255,0.4)');
        sg.addColorStop(1, 'rgba(140,210,255,0)');
        g.fillStyle = sg;
        g.beginPath(); g.arc(32, 27, 26, 0, Math.PI * 2); g.fill();
      }
      var bolts = [[46, 10, 4], [16, 18, 3.4], [45, 41, 3], [19, 39, 2.6]];
      for (var bi = 0; bi < bolts.length; bi++) {
        var bx = bolts[bi][0], by = bolts[bi][1], br = bolts[bi][2];
        g.fillStyle = bi % 2 ? '#8fd0ff' : '#e8f8ff';
        g.beginPath();
        g.moveTo(bx, by); g.lineTo(bx + br, by + br * 1.5); g.lineTo(bx + br * 0.2, by + br * 1.4);
        g.lineTo(bx + br * 1.1, by + br * 2.6); g.lineTo(bx - br * 0.4, by + br * 1.5);
        g.lineTo(bx + br * 0.3, by + br * 1.5); g.closePath(); g.fill();
      }
    } else if (c.effect === 'blaze') {
      if (g.createRadialGradient) {
        var fg = g.createRadialGradient(32, 27, 2, 32, 27, 30);
        fg.addColorStop(0, 'rgba(255,140,40,0.42)');
        fg.addColorStop(0.6, 'rgba(255,90,20,0.16)');
        fg.addColorStop(1, 'rgba(255,60,0,0)');
        g.fillStyle = fg;
        g.beginPath(); g.arc(32, 27, 30, 0, Math.PI * 2); g.fill();
      }
      var flames = [[32, -2, 1], [22, 4, 0.72], [42, 4, 0.72], [15, 24, 0.6], [49, 24, 0.6]];
      for (var fi = 0; fi < flames.length; fi++) {
        var fx0 = flames[fi][0], fy0 = flames[fi][1], fs = flames[fi][2];
        g.fillStyle = fi === 0 ? '#ffcf6a' : '#ff8a2f';
        g.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * 0.9;
        g.beginPath();
        g.moveTo(fx0 - 5 * fs, fy0 + 6 * fs);
        g.quadraticCurveTo(fx0 - 1.5 * fs, fy0 - 2 * fs, fx0, fy0 - 7 * fs);
        g.quadraticCurveTo(fx0 + 1.5 * fs, fy0 - 2 * fs, fx0 + 5 * fs, fy0 + 6 * fs);
        g.closePath(); g.fill();
        g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
      }
    } else if (c.effect === 'prism') {
      var hues = [0, 60, 120, 200, 280];
      for (var hi = 0; hi < hues.length; hi++) {
        ringArc(21 + hi * 0.7, 26 + hi * 0.8, -3 + hi * 0.1, 2.4 + hi * 0.1,
          'hsla(' + hues[hi] + ',95%,72%,0.9)', 1.5, 0.55);
      }
      var stars = [[49, 8, 2.6], [15, 33, 2], [46, 44, 1.8]];
      for (var si = 0; si < stars.length; si++) {
        var sx = stars[si][0], sy = stars[si][1], sr = stars[si][2];
        g.fillStyle = '#f2c14e';
        g.beginPath();
        g.moveTo(sx, sy - sr * 2); g.lineTo(sx + sr * 0.6, sy - sr * 0.6);
        g.lineTo(sx + sr * 2, sy); g.lineTo(sx + sr * 0.6, sy + sr * 0.6);
        g.lineTo(sx, sy + sr * 2); g.lineTo(sx - sr * 0.6, sy + sr * 0.6);
        g.lineTo(sx - sr * 2, sy); g.lineTo(sx - sr * 0.6, sy - sr * 0.6);
        g.closePath(); g.fill();
      }
    }

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

    /* 바디 데칼 — 프레임 위에 얹히는 포인트 컬러 */
    if (body.decal === 'slash') {
      ringArc(18, 23, -1.1, -0.62, acc, 2.6, 1);
      ringArc(18, 23, 0.26, 0.72, acc, 2.6, 1);
      ringArc(18, 23, 2.4, 2.9, acc, 2.6, 1);
    } else if (body.decal === 'ring') {
      ringArc(18.4, 23.4, -0.07, 0.07, acc, 1.4, 1);
      ringArc(18.4, 23.4, Math.PI - 0.07, Math.PI + 0.07, acc, 1.4, 1);
    } else if (body.decal === 'wing') {
      ringArc(18, 23, -0.28, 0.2, acc, 2, 1);
      ringArc(18, 23, Math.PI - 0.2, Math.PI + 0.28, acc, 2, 1);
    } else if (body.decal === 'block') {
      ringArc(18, 23, 0.92, 2.22, acc, 3.4, 1);
    }

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
    var sig = [cond.level, c.body, c.frame, c.string, c.grip, c.stencil, c.charm, c.effect].join('|');
    if (btn.getAttribute('data-sig') === sig) return;
    btn.setAttribute('data-sig', sig);
    var art = btn.querySelector('.hedracket__art');
    if (art) art.innerHTML = svg(c, { level: cond.level });
    btn.className = 'hedracket is-' + cond.level;
    btn.title = cond.title + ' · 눌러서 내 라켓 꾸미기';
    btn.setAttribute('aria-label', '내 커스텀 라켓 · ' + cond.title + ' · 눌러서 꾸미기');
  }

  /* ============================================================
   * 3D 라켓 뷰 — 실제 배드민턴 라켓 비율 · 바디 4종 (bm-v1.81.0)
   *   · 헤드:샤프트:그립 ≈ 25:22:20 (전체 약 675mm) 아이소메트릭 헤드 실루엣
   *   · 테두리 단면 4면(앞·뒤·바깥·안쪽)을 깊이(Z) 순으로 그려 어느 각도에서도 두께가 보입니다
   *   · 거트 17×19 격자(엮인 느낌) · 그로밋 · 스텐실 · T-조인트 · 콘 · 8각 그립 스파이럴 · 엔드캡 · 참
   *   · 바디(파워 77 · 스피드 에어로 · 컨트롤 아크 · 스매시 맥스)마다 실루엣·프레임 두께·데칼이 다릅니다
   * ============================================================ */
  var CAM_Z = 640, FOCUS = 840;
  var LX = -0.44, LY = -0.62, LZ = 0.65;
  var TAU = Math.PI * 2;

  /* 바디 하나의 실제 치수 — 헤드 아래부터 샤프트·그립 길이를 mm 비율로 */
  function geomOf(custom) {
    var c = (custom && typeof custom === 'object') ? custom : null;
    var b = bodyOf(c && c.body);
    var gripY0 = b.ry + b.shaftLen;
    var gripY1 = gripY0 + b.gripLen;
    return {
      id: b.id, name: b.name, note: b.note, accent: b.accent, decal: b.decal,
      rx: b.rx, ry: b.ry, hoop: b.hoop, shaftR: b.shaftR, gripR: b.gripR,
      shaftLen: b.shaftLen, gripLen: b.gripLen, tJoint: b.tJoint, cone: b.cone,
      profile: b.profile,
      top: -b.ry, headBottom: b.ry,
      throatY: b.ry + b.tJoint * 0.62,
      gripY0: gripY0, gripY1: gripY1,
      mid: (b.ry + gripY1) / 2 - b.ry,
      span: gripY1 + b.ry
    };
  }

  var G3 = (function () {
    var g = geomOf(null);
    return {
      rx: g.rx, ry: g.ry, hoop: g.hoop, throat: g.throatY,
      shaft: g.gripY0 - g.cone, gripY0: g.gripY0, gripY1: g.gripY1, gripR: g.gripR, mid: g.mid
    };
  })();

  function rot3(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = p.x * cy + p.z * sy;
    var z1 = -p.x * sy + p.z * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
  }

  function project3(p, v) {
    var mid = (v && v.mid != null) ? v.mid : G3.mid;
    var r = rot3({ x: p.x, y: p.y - mid, z: p.z }, v.yaw, v.pitch);
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

  function pt(p, z) { return { x: p.x, y: p.y, z: z }; }

  function faceNormal(a, b, c) {
    var ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    var vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    return { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
  }

  /* 면 법선을 회전시켜 화면 고정 광원과 내적 — 돌릴 때마다 명암이 바뀝니다 */
  function litOf(n, v) {
    var r = rot3(n, v.yaw, v.pitch);
    var l = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z) || 1;
    var d = (r.x * LX + r.y * LY + r.z * LZ) / l;
    return Math.abs(d);
  }

  /* 폴리곤 하나를 깊이와 함께 예약 — 나중에 Z 순으로 그립니다(화가 알고리즘) */
  function pushFace(prims, v, model, baseHex, opts) {
    opts = opts || {};
    var ps = [], i, z = 0;
    for (i = 0; i < model.length; i++) {
      var q = project3(model[i], v);
      ps.push(q); z += q.z;
    }
    z = z / model.length + (opts.zBias || 0);
    var lit = litOf(faceNormal(model[0], model[1], model[2]), v);
    var amt = (opts.tone || 0) + (lit - 0.52) * 0.5;
    if (amt > 0.18) amt = 0.18;
    if (amt < -0.62) amt = -0.62;
    prims.push({ z: z, pts: ps, fill: shade(baseHex, amt), alpha: opts.alpha == null ? 1 : opts.alpha });
    if (opts.gloss && lit > 0.93) {
      prims.push({ z: z + 0.4, pts: ps, fill: '#ffffff', alpha: 0.1 });
    }
  }

  /* 여러 줄을 한 번에 — 거트처럼 가는 선 수백 개를 빠르게 */
  function pushLines(prims, v, modelLines, color, lw, alpha, zHint) {
    var polys = [], zsum = 0, zn = 0, i, k;
    for (i = 0; i < modelLines.length; i++) {
      var line = [], pts = modelLines[i];
      for (k = 0; k < pts.length; k++) {
        var q = project3(pts[k], v);
        line.push(q); zsum += q.z; zn++;
      }
      polys.push(line);
    }
    if (!polys.length) return;
    prims.push({ z: zHint == null ? zsum / (zn || 1) : zHint, polys: polys, stroke: color, lw: lw, alpha: alpha == null ? 1 : alpha });
  }

  function paintPrims(g, prims) {
    prims.sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < prims.length; i++) {
      var P = prims[i];
      g.globalAlpha = P.alpha == null ? 1 : P.alpha;
      if (P.pts && P.pts.length > 2) {
        g.fillStyle = P.fill;
        g.beginPath();
        g.moveTo(P.pts[0].x, P.pts[0].y);
        for (var k = 1; k < P.pts.length; k++) g.lineTo(P.pts[k].x, P.pts[k].y);
        g.closePath();
        g.fill();
      } else if (P.polys) {
        g.strokeStyle = P.stroke;
        g.lineWidth = P.lw;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (var j = 0; j < P.polys.length; j++) {
          var line = P.polys[j];
          if (line.length < 2) continue;
          g.beginPath();
          g.moveTo(line[0].x, line[0].y);
          for (var m = 1; m < line.length; m++) g.lineTo(line[m].x, line[m].y);
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
  }

  /* ---------- 헤드 실루엣 (닫힌 Catmull-Rom) ---------- */
  function catmull(pts, sub) {
    var n = pts.length, out = [], i, k;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (k = 0; k < sub; k++) {
        var t = k / sub, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    return out;
  }

  var loopMem = {};
  function headLoop(gm, sub) {
    var key = gm.id + '|' + (sub || 3);
    if (loopMem[key]) return loopMem[key];
    var half = gm.profile, ctrl = [], i;
    for (i = 0; i < half.length; i++) ctrl.push({ x: half[i][0] * gm.rx, y: half[i][1] * gm.ry });
    for (i = half.length - 2; i > 0; i--) ctrl.push({ x: -half[i][0] * gm.rx, y: half[i][1] * gm.ry });
    loopMem[key] = catmull(ctrl, sub || 3);
    return loopMem[key];
  }

  /* 테두리 안쪽 선 — 중심에서 바깥으로 향하는 법선 방향으로 hoop 만큼 안으로 */
  function offsetLoop(loop, d) {
    var out = [], n = loop.length, i;
    for (i = 0; i < n; i++) {
      var p0 = loop[(i - 1 + n) % n], p1 = loop[(i + 1) % n], p = loop[i];
      var tx = p1.x - p0.x, ty = p1.y - p0.y;
      var len = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / len, ny = tx / len;
      if (nx * p.x + ny * p.y < 0) { nx = -nx; ny = -ny; }
      out.push({ x: p.x - nx * d, y: p.y - ny * d });
    }
    return out;
  }

  /* ---------- 바디별 프레임 데칼 ---------- */
  var DECALS = {
    /* 파워 — 비대칭 사선 포인트 */
    slash: [[-1.44, -1.0], [-0.62, -0.2], [0.34, 0.78], [2.3, 2.72], [3.14, 3.56], [4.12, 4.54]],
    /* 에어로 — 좌우 얇은 링 라인 */
    ring: [[-0.07, 0.11], [Math.PI - 0.11, Math.PI + 0.07]],
    /* 컨트롤 — 좌우 대칭 윙 스트라이프(2줄씩) */
    wing: [[-0.44, -0.16], [-0.02, 0.26], [Math.PI - 0.44, Math.PI - 0.16], [Math.PI - 0.02, Math.PI + 0.26]],
    /* 스매시 — 하단 두꺼운 메탈릭 블록 */
    block: [[0.45, 2.69]]
  };

  function inArc(th, a0, a1) {
    var norm = function (x) { return ((x % TAU) + TAU) % TAU; };
    var t = norm(th), s = norm(a0), e = norm(a1);
    return s <= e ? (t >= s && t <= e) : (t >= s || t <= e);
  }

  function decalAt(gm, p) {
    var list = DECALS[gm.decal] || [], i;
    var th = Math.atan2(p.y / (gm.ry || 1), p.x / (gm.rx || 1));
    for (i = 0; i < list.length; i++) if (inArc(th, list[i][0], list[i][1])) return gm.accent;
    return null;
  }

  /* ---------- 테두리 (단면 4면) ---------- */
  function addHead(prims, gm, v, frame) {
    var loop = headLoop(gm, 3);
    var inner = offsetLoop(loop, gm.hoop);
    var N = loop.length, i, j;
    var zf = gm.hoop * 0.42, zb = -gm.hoop * 0.42;
    for (i = 0; i < N; i++) {
      j = (i + 1) % N;
      var o0 = loop[i], o1 = loop[j], n0 = inner[i], n1 = inner[j];
      /* 앞면 */
      pushFace(prims, v, [pt(o0, zf), pt(o1, zf), pt(n1, zf), pt(n0, zf)], frame, { tone: 0.02, gloss: true });
      /* 뒷면 — 살짝 어둡게 */
      pushFace(prims, v, [pt(o0, zb), pt(o1, zb), pt(n1, zb), pt(n0, zb)], frame, { tone: -0.2 });
      /* 바깥 옆면 — 빛을 가장 많이 받는 면 */
      pushFace(prims, v, [pt(o0, zf), pt(o1, zf), pt(o1, zb), pt(o0, zb)], frame, { tone: 0.14, gloss: true });
      /* 안쪽 옆면 — 그늘 */
      pushFace(prims, v, [pt(n0, zf), pt(n1, zf), pt(n1, zb), pt(n0, zb)], frame, { tone: -0.36 });
    }
    /* 그로밋(아일렛) — 거트가 빠져나오는 구멍 느낌 */
    var holes = [];
    var k;
    for (k = 2; k < N; k += 4) holes.push(loop[k]);
    var dots = [];
    for (k = 0; k < holes.length; k++) {
      var hp = holes[k];
      var rr = Math.max(1.1, gm.hoop * 0.19);
      var ring2 = [
        pt({ x: hp.x - rr, y: hp.y - rr }, zf + 0.6), pt({ x: hp.x + rr, y: hp.y - rr }, zf + 0.6),
        pt({ x: hp.x + rr, y: hp.y + rr }, zf + 0.6), pt({ x: hp.x - rr, y: hp.y + rr }, zf + 0.6)
      ];
      pushFace(prims, v, ring2, '#12160f', { tone: 0.25, zBias: 0.5 });
      dots.push(ring2);
    }
  }

  /* 프레임 위 포인트 데칼 — 비스듬한 사선 · 밴드 · 윙 */
  function loopIndexAt(gm, ang) {
    var loop = headLoop(gm, 3), n = loop.length, best = 0, bd = 9, i;
    for (i = 0; i < n; i++) {
      var a = Math.atan2(loop[i].y / gm.ry, loop[i].x / gm.rx);
      var d = Math.abs(((a - ang + Math.PI * 3) % TAU) - Math.PI);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function addDecals(prims, gm, v) {
    var list = DECALS[gm.decal] || [];
    if (!list.length) return;
    var loop = headLoop(gm, 3), inner = offsetLoop(loop, gm.hoop);
    var n = loop.length, zf = gm.hoop * 0.42 + 0.5, zb = -gm.hoop * 0.42 - 0.5;
    var k, i, j, j2;
    for (k = 0; k < list.length; k++) {
      var ia = loopIndexAt(gm, list[k][0]);
      var ib = loopIndexAt(gm, list[k][1]);
      var span = (ib - ia + n) % n;
      if (span > n / 2) { var t2 = ia; ia = ib; ib = t2; span = (ib - ia + n) % n; }
      /* 테두리를 따라 칠한 포인트 컬러 섹션 */
      for (i = 0; i <= span; i++) {
        j = (ia + i) % n; j2 = (j + 1) % n;
        pushFace(prims, v, [pt(loop[j], zf), pt(loop[j2], zf), pt(inner[j2], zf), pt(inner[j], zf)],
          gm.accent, { tone: 0.04, zBias: 0.25 });
        pushFace(prims, v, [pt(loop[j], zb), pt(loop[j2], zb), pt(inner[j2], zb), pt(inner[j], zb)],
          gm.accent, { tone: -0.2, zBias: -0.25 });
      }
      /* 섹션 양 끝의 얇은 화이트 핀라인 — 인쇄한 것처럼 또렷하게 */
      var ea = (ia - 1 + n) % n, eb = (ib + 1) % n;
      pushLines(prims, v, [[pt(loop[ea], zf), pt(inner[ea], zf)]], 'rgba(255,255,255,0.45)',
        Math.max(0.8, 1.2 * v.k * 1.4), 0.6, project3(pt(loop[ea], zf), v).z + 0.4);
      pushLines(prims, v, [[pt(loop[eb], zf), pt(inner[eb], zf)]], 'rgba(255,255,255,0.45)',
        Math.max(0.8, 1.2 * v.k * 1.4), 0.6, project3(pt(loop[eb], zf), v).z + 0.4);
    }
  }

  /* 테두리 광택 — 바깥 모서리 하이라이트 · 안쪽 그늘 */
  function addFrameEdge(prims, gm, v) {
    var loop = headLoop(gm, 3), inner = offsetLoop(loop, gm.hoop);
    var n = loop.length, zf = gm.hoop * 0.42 + 0.35;
    var outer = [], inn = [], i;
    for (i = 0; i < n; i++) {
      outer.push(pt(loop[i], zf));
      inn.push(pt(inner[i], zf));
    }
    var zo = project3(outer[0], v).z;
    pushLines(prims, v, [outer], 'rgba(255,255,255,0.3)', Math.max(1, 1.5 * v.k * 1.3), 0.7, zo + 0.6);
    pushLines(prims, v, [inn], 'rgba(0,0,0,0.42)', Math.max(1, 1.7 * v.k * 1.3), 0.8, zo + 0.45);
  }

  /* ---------- 거트 17 × 19 ---------- */
  function chordAt(poly, axis, val) {
    var lo = null, hi = null, i, n = poly.length;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var a1 = axis === 'v' ? a.x : a.y;
      var b1 = axis === 'v' ? b.x : b.y;
      if (a1 === b1) continue;
      if ((a1 - val) * (b1 - val) > 0) continue;
      var t = (val - a1) / (b1 - a1);
      var other = axis === 'v' ? a.y + (b.y - a.y) * t : a.x + (b.x - a.x) * t;
      if (lo == null || other < lo) lo = other;
      if (hi == null || other > hi) hi = other;
    }
    return lo == null ? null : { a: lo, b: hi };
  }

  function sagLine(a, b, sag, seed) {
    var out = [], m = 4, i;
    for (i = 0; i <= m; i++) {
      var t = i / m;
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (sag) {
        var bow = Math.sin(t * Math.PI) * sag * ((seed % 2) ? 1 : -1);
        if (Math.abs(a.y - b.y) < 0.01) y += bow; else x += bow * 0.4;
      }
      out.push({ x: x, y: y, z: 0 });
    }
    return out;
  }

  function stringChords(gm, level) {
    var loop = headLoop(gm, 3);
    var inner = offsetLoop(loop, gm.hoop * 0.92);
    var mains = [], crosses = [], i, ch;
    var X = gm.rx - gm.hoop * 1.5, Y = gm.ry - gm.hoop * 1.3;
    var sag = level === 'worn' ? 3.4 : (level === 'broken' ? 2.2 : 0);
    for (i = 0; i < 17; i++) {
      var x = -X * 0.86 + (i / 16) * X * 1.72;
      ch = chordAt(inner, 'v', x);
      if (!ch) continue;
      mains.push(sagLine({ x: x, y: ch.a - 2 }, { x: x, y: ch.b + 2 }, sag, i));
    }
    for (i = 0; i < 19; i++) {
      var y = -Y * 0.84 + (i / 18) * Y * 1.66;
      ch = chordAt(inner, 'h', y);
      if (!ch) continue;
      crosses.push(sagLine({ x: ch.a - 2, y: y }, { x: ch.b + 2, y: y }, sag, i));
    }
    if (level === 'broken') {
      /* 가운데 세로 줄이 끊어진 모습 — 가운데를 비우고 좌우로 갈라진 끝을 남깁니다 */
      var cut = Math.floor(mains.length / 2);
      var line = mains[cut];
      mains.splice(cut, 1,
        line.slice(0, Math.floor(line.length / 2)),
        line.slice(Math.ceil(line.length / 2)));
    }
    return { mains: mains, crosses: crosses };
  }

  function addStrings(prims, gm, v, color, level) {
    var ch = stringChords(gm, level);
    var lw = Math.max(1, 1.5 * v.k * 1.32);
    pushLines(prims, v, ch.crosses, shade(color, -0.12), lw, 0.62, -0.9);
    pushLines(prims, v, ch.mains, color, lw, 0.9, 0.9);
    if (level === 'broken') {
      /* 끊어진 줄 — 벌어진 끝단이 말려 올라간 모습 */
      pushLines(prims, v, [[
        { x: -5.5, y: 0, z: 0 }, { x: -9, y: 2.4, z: 0 }, { x: -12.5, y: 0.4, z: 0 }, { x: -14, y: -3.4, z: 0 }
      ], [
        { x: 5.5, y: 0, z: 0 }, { x: 9, y: -2.4, z: 0 }, { x: 12.5, y: -0.4, z: 0 }, { x: 14, y: 3.4, z: 0 }
      ]], '#ff6b5e', Math.max(1.2, 2.1 * v.k), 1, 1.4);
      pushLines(prims, v, [[
        { x: -5, y: -1, z: 0 }, { x: -1, y: -5, z: 0 }
      ], [
        { x: 5, y: 1, z: 0 }, { x: 1, y: 5, z: 0 }
      ]], '#ffd166', Math.max(1, 1.4 * v.k), 0.9, 1.5);
    }
  }

  /* ---------- 스텐실 (거트 위) ---------- */
  function stencilShapes(gm, id) {
    var sx = gm.rx / 100, sy = gm.ry / 126;
    var seg = [];
    if (id === 'x') {
      seg = [[[-34, -16], [34, 16]], [[34, -16], [-34, 16]]];
    } else if (id === 'bolt') {
      seg = [[[10, -40], [-24, 2], [2, 2], [-10, 40], [30, -4], [4, -4], [10, -40]]];
    } else if (id === 'crown') {
      seg = [[[-38, 16], [-38, -14], [-16, 2], [0, -26], [16, 2], [38, -14], [38, 16], [-38, 16]]];
    } else if (id === 'shuttle') {
      seg = [[[-26, -26], [26, -26], [12, 10], [-12, 10], [-26, -26]], [[0, 30], [0, 14]]];
    }
    return seg.map(function (pts) {
      return pts.map(function (p) { return { x: p[0] * sx, y: p[1] * sy, z: 1.6 }; });
    });
  }

  function addStencil(prims, gm, v, c) {
    if (!c.stencil || c.stencil === 'none') return;
    var col = colorOf('stencil', c.stencil);
    var shapes = stencilShapes(gm, c.stencil);
    pushLines(prims, v, shapes, col, Math.max(1.6, 3.6 * v.k), 0.92, 1.8);
  }

  /* ---------- T-조인트 · 샤프트 · 콘 ---------- */
  function addShaft(prims, gm, v, frame, accent) {
    var ty0 = gm.headBottom + 3, ty1 = gm.throatY;
    var w0 = gm.tJoint * 0.26, w1 = gm.shaftR * 1.3;
    var d0 = Math.min(6, gm.tJoint * 0.2), d1 = gm.shaftR * 1.05;
    /* T-조인트 — 헤드 아래에서 샤프트로 이어지는 매끈한 목 */
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, d0), pt({ x: w0, y: ty0 }, d0),
      pt({ x: w1, y: ty1 }, d1), pt({ x: -w1, y: ty1 }, d1)], frame, { tone: 0.04, gloss: true });
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, -d0), pt({ x: w0, y: ty0 }, -d0),
      pt({ x: w1, y: ty1 }, -d1), pt({ x: -w1, y: ty1 }, -d1)], frame, { tone: -0.24 });
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, d0), pt({ x: -w1, y: ty1 }, d1),
      pt({ x: -w1, y: ty1 }, -d1), pt({ x: -w0, y: ty0 }, -d0)], frame, { tone: -0.1 });
    pushFace(prims, v, [pt({ x: w0, y: ty0 }, d0), pt({ x: w1, y: ty1 }, d1),
      pt({ x: w1, y: ty1 }, -d1), pt({ x: w0, y: ty0 }, -d0)], frame, { tone: 0.12 });
    if (gm.id === 'smash') {
      /* 굵은 파워 T-조인트 — 메탈릭 밴드 */
      pushFace(prims, v, [pt({ x: -w0 * 1.04, y: ty0 + 4 }, d0 + 0.6), pt({ x: w0 * 1.04, y: ty0 + 4 }, d0 + 0.6),
        pt({ x: w0 * 1.02, y: ty0 + 13 }, d0 + 0.6), pt({ x: -w0 * 1.02, y: ty0 + 13 }, d0 + 0.6)], accent, { tone: 0.16, zBias: 0.6 });
    }

    /* 샤프트 — 가늘고 긴 카본 원통(6면) */
    var segN = 6, k;
    var sy0 = ty1, sy1 = gm.gripY0 - gm.cone;
    var r0 = gm.shaftR, r1 = gm.shaftR * 0.93;
    for (k = 0; k < segN; k++) {
      var a0 = k / segN * TAU, a1 = (k + 1) / segN * TAU;
      pushFace(prims, v, [
        pt({ x: Math.cos(a0) * r0, y: sy0 }, Math.sin(a0) * r0),
        pt({ x: Math.cos(a1) * r0, y: sy0 }, Math.sin(a1) * r0),
        pt({ x: Math.cos(a1) * r1, y: sy1 }, Math.sin(a1) * r1),
        pt({ x: Math.cos(a0) * r1, y: sy1 }, Math.sin(a0) * r1)
      ], frame, { tone: 0.06, gloss: true });
    }

    /* 콘(프론트 캡) — 샤프트에서 그립으로 넓어지는 원뿔 */
    var cy0 = sy1, cy1 = gm.gripY0 + 2, cR = gm.gripR * 0.99;
    for (k = 0; k < segN; k++) {
      var b0 = k / segN * TAU, b1 = (k + 1) / segN * TAU;
      pushFace(prims, v, [
        pt({ x: Math.cos(b0) * r1, y: cy0 }, Math.sin(b0) * r1),
        pt({ x: Math.cos(b1) * r1, y: cy0 }, Math.sin(b1) * r1),
        pt({ x: Math.cos(b1) * cR, y: cy1 }, Math.sin(b1) * cR),
        pt({ x: Math.cos(b0) * cR, y: cy1 }, Math.sin(b0) * cR)
      ], frame, { tone: -0.06, gloss: true });
    }
    if (gm.id === 'aero' || gm.id === 'power77') {
      /* 샤프트 하단 얇은 링 데칼 */
      for (k = 0; k < segN; k++) {
        var d0a = k / segN * TAU, d1a = (k + 1) / segN * TAU;
        var rr = r1 + 0.5;
        pushFace(prims, v, [
          pt({ x: Math.cos(d0a) * rr, y: cy0 + 3 }, Math.sin(d0a) * rr),
          pt({ x: Math.cos(d1a) * rr, y: cy0 + 3 }, Math.sin(d1a) * rr),
          pt({ x: Math.cos(d1a) * rr, y: cy0 + 7 }, Math.sin(d1a) * rr),
          pt({ x: Math.cos(d0a) * rr, y: cy0 + 7 }, Math.sin(d0a) * rr)
        ], accent, { tone: 0.1, zBias: 0.8 });
      }
    }
  }

  /* ---------- 8각 그립 · 스파이럴 오버그립 · 마감 테이프 · 엔드캡 ---------- */
  function addGrip(prims, gm, v, grip, accent) {
    var y0 = gm.gripY0, y1 = gm.gripY1, R = gm.gripR;
    var verts = [], k;
    for (k = 0; k < 8; k++) {
      var a = (k + 0.5) * Math.PI / 4;
      verts.push({ c: Math.cos(a), s: Math.sin(a) });
    }
    /* 8각 기둥 — 회전하면 각진 면의 명암이 바뀝니다 */
    for (k = 0; k < 8; k++) {
      var p = verts[k], q = verts[(k + 1) % 8];
      pushFace(prims, v, [
        pt({ x: p.c * R, y: y0 }, p.s * R), pt({ x: q.c * R, y: y0 }, q.s * R),
        pt({ x: q.c * R, y: y1 }, q.s * R), pt({ x: p.c * R, y: y1 }, p.s * R)
      ], grip, { tone: 0 });
    }
    /* 비스듬히 겹쳐 감긴 오버그립 테이핑 — 한 바퀴에 조금씩 내려갑니다 */
    var pitch = 21, step = 12, bw = 25;
    var nBand = Math.max(3, Math.ceil((y1 - y0 - 4) / step));
    var b, k, shadow;
    for (b = 0; b < nBand; b++) {
      var base = y0 + 2 + b * step;
      var tone = (b % 2) ? -0.02 : 0.2;
      shadow = [];
      var drew = false;
      for (k = 0; k < 8; k++) {
        var p1 = verts[k], q1 = verts[(k + 1) % 8];
        var yA = base + (k / 8) * pitch;
        var yB = base + ((k + 1) / 8) * pitch;
        if (yA > y1 || yA + bw < y0) continue;
        var aTop = Math.max(y0 - 1, yA), aBot = Math.min(y1, yA + bw);
        var bTop = Math.max(y0 - 1, yB), bBot = Math.min(y1, yB + bw);
        pushFace(prims, v, [
          pt({ x: p1.c * R, y: aTop }, p1.s * R), pt({ x: q1.c * R, y: bTop }, q1.s * R),
          pt({ x: q1.c * R, y: bBot }, q1.s * R), pt({ x: p1.c * R, y: aBot }, p1.s * R)
        ], grip, { tone: tone, alpha: 1 });
        drew = true;
        shadow.push({ x: q1.c * R * 1.012, y: bBot, z: q1.s * R * 1.012 });
      }
      if (!drew) continue;
      shadow.unshift({ x: verts[0].c * R * 1.012, y: Math.min(y1, base + bw), z: verts[0].s * R * 1.012 });
      pushLines(prims, v, [shadow], 'rgba(0,0,0,0.42)', Math.max(1.1, 2 * v.k), 1);
    }

    /* 빛이 닿는 면의 세로 하이라이트 — 오버그립 광택 */
    for (k = 0; k < 8; k++) {
      var hp = verts[k], hq = verts[(k + 1) % 8];
      var nn = { x: Math.cos((k + 0.5) * Math.PI / 4), y: 0, z: Math.sin((k + 0.5) * Math.PI / 4) };
      if (litOf(nn, v) < 0.82) continue;
      pushFace(prims, v, [
        pt({ x: hp.c * R * 1.004, y: y0 + 8 }, hp.s * R * 1.004), pt({ x: hq.c * R * 1.004, y: y0 + 8 }, hq.s * R * 1.004),
        pt({ x: hq.c * R * 1.004, y: y1 - 4 }, hq.s * R * 1.004), pt({ x: hp.c * R * 1.004, y: y1 - 4 }, hp.s * R * 1.004)
      ], '#ffffff', { tone: 0, gloss: false, alpha: 0.07, zBias: 0.6 });
    }

    /* 상단 마감 테이프 밴드 */
    var trimR = R * 1.03;
    for (k = 0; k < 8; k++) {
      var t1 = verts[k], t2 = verts[(k + 1) % 8];
      pushFace(prims, v, [
        pt({ x: t1.c * trimR, y: y0 - 2 }, t1.s * trimR), pt({ x: t2.c * trimR, y: y0 - 2 }, t2.s * trimR),
        pt({ x: t2.c * trimR, y: y0 + 13 }, t2.s * trimR), pt({ x: t1.c * trimR, y: y0 + 13 }, t1.s * trimR)
      ], accent, { tone: 0.02, zBias: 0.5 });
    }
    /* 엔드캡 — 바닥 로고 캡 */
    var capPts = [], capIn = [];
    for (k = 0; k < 8; k++) {
      var c1 = verts[k];
      capPts.push(pt({ x: c1.c * R * 0.98, y: y1 + 1 }, c1.s * R * 0.98));
      capIn.push(pt({ x: c1.c * R * 0.52, y: y1 + 1.5 }, c1.s * R * 0.52));
    }
    pushFace(prims, v, capPts, shade(grip, -0.3), { tone: 0.2, zBias: 0.2 });
    pushFace(prims, v, capIn, accent, { tone: 0.1, zBias: 0.3 });
  }

  /* ---------- 라켓 참 (그립 앞/뒤로 정확히 가려지도록 Z 정렬) ---------- */
  function charmPts(kind, cx, cy, z, r) {
    var out = [], i, n = 12;
    if (kind === 'ace') {
      for (i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rr = (i % 2) ? r * 0.46 : r;
        out.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, z: z });
      }
      return out;
    }
    if (kind === 'streak') {
      for (i = 0; i < n; i++) {
        var t = i / n * TAU;
        var hx = 16 * Math.pow(Math.sin(t), 3);
        var hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        out.push({ x: cx + hx * (r / 16), y: cy + hy * (r / 16), z: z });
      }
      return out;
    }
    for (i = 0; i < n; i++) {
      var a2 = i / n * TAU;
      out.push({ x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r, z: z });
    }
    return out;
  }

  function addCharm(prims, gm, v, c) {
    if (!c.charm || c.charm === 'none') return;
    var col = colorOf('charm', c.charm);
    var ang = 0.62;
    var R = gm.gripR + 8;
    var top = { x: Math.cos(ang) * gm.gripR * 0.92, y: gm.gripY0 + 14, z: Math.sin(ang) * gm.gripR * 0.92 };
    var endZ = Math.sin(ang) * R;
    var end = { x: Math.cos(ang) * R, y: gm.gripY0 + 50, z: endZ };
    var cordMid = { x: (top.x + end.x) / 2, y: top.y + 18, z: (top.z + endZ) / 2 + 1 };
    pushLines(prims, v, [[top, cordMid, end]], 'rgba(240,248,230,0.6)', Math.max(1, 1.7 * v.k), 1,
      project3(end, v).z + 0.6);
    prims.push({
      z: endZ + 0.9,
      pts: charmPts(c.charm, end.x, end.y, endZ + 0.9, Math.max(5, 8.6)).map(function (p) { return project3(p, v); }),
      fill: col, alpha: 1
    });
    prims.push({
      z: endZ + 1,
      pts: charmPts(c.charm, end.x, end.y, endZ + 1, Math.max(2.6, 4.2)).map(function (p) { return project3(p, v); }),
      fill: shade(col, 0.45), alpha: 0.85
    });
  }

  /* ============================================================
   * 효과(이펙트) — 색이 아니라 움직이는 연출 (bm-v1.81.0)
   *   스피드 링 · 스파크 전기 · 블레이즈 오라 · 챔피언 프리즘
   * ============================================================ */
  /* 타원 궤적의 한 구간 — 링·후광을 부드럽게 */
  function strokeEllipse(gm, v, scale, a0, a1, steps) {
    var out = [], i, n = Math.max(2, steps || 3);
    for (i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      out.push(project3({ x: Math.cos(a) * gm.rx * scale, y: Math.sin(a) * gm.ry * scale, z: 0 }, v));
    }
    return out;
  }

  function strokeArc(g, pts, color, lw, alpha, from, to) {
    var a = from == null ? 0 : from, b = to == null ? pts.length - 1 : to;
    if (b <= a) return;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[a].x, pts[a].y);
    for (var i = a + 1; i <= b; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
    g.restore();
  }

  function fxRingPoints(gm, v, scale, rot, count) {
    var loop = headLoop(gm, 3), out = [], i, n = loop.length;
    var cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    for (i = 0; i < count; i++) {
      var p = loop[Math.floor(i / count * n) % n];
      var x = p.x * scale, y = p.y * scale;
      out.push(project3({ x: x * cs - y * sn, y: x * sn + y * cs, z: 0 }, v));
    }
    return out;
  }

  function fxLoopPoint(gm, v, frac, scale) {
    var loop = headLoop(gm, 3);
    var n = loop.length;
    var f = ((frac % 1) + 1) % 1;
    var p = loop[Math.floor(f * n) % n];
    return project3({ x: p.x * (scale || 1), y: p.y * (scale || 1), z: 0 }, v);
  }

  /* 헤드 뒤쪽 — 오라 · 궤적 링 · 홀로그램 후광 */
  function fxBack(g, gm, v, c, w, h) {
    var fx = c.effect;
    if (!fx || fx === 'none') return;
    var ph = v.phase || 0;
    var k, s, rot, pts;
    var cxp = project3({ x: 0, y: 0, z: 0 }, v);

    if (fx === 'speed') {
      for (k = 0; k < 2; k++) {
        var sc = 1.13 + k * 0.12;
        var headT = ph * (1.9 + k * 0.7) + k * 2.6;
        var tailT = 2.0 - k * 0.35;
        var N2 = 16;
        for (var sgi = 0; sgi < N2; sgi++) {
          var t0 = headT - tailT * (1 - sgi / N2);
          var t1 = headT - tailT * (1 - (sgi + 1) / N2);
          var pta = strokeEllipse(gm, v, sc, t0, t1, 2);
          var prog = sgi / (N2 - 1);
          strokeArc(g, pta, prog > 0.88 ? '#ffffff' : '#8fe2ff',
            Math.max(1, (1 + prog * 2.6) * v.k * 1.7), 0.05 + 0.7 * prog, 0, pta.length - 1);
        }
      }
    } else if (fx === 'spark') {
      var sg = g.createRadialGradient(cxp.x, cxp.y, 4, cxp.x, cxp.y, gm.rx * 2.1 * v.k);
      sg.addColorStop(0, 'rgba(120,200,255,0.24)');
      sg.addColorStop(1, 'rgba(120,200,255,0)');
      g.save();
      g.fillStyle = sg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.6 * v.k, gm.ry * 1.4 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.4 * v.k, 0, TAU);
      g.fill();
      g.restore();
      /* 톡톡 튀는 스파크 */
      for (k = 0; k < 10; k++) {
        var seed = k * 2.399;
        var on = Math.sin(ph * 3.4 + seed * 3.1);
        if (on < 0.15) continue;
        var p0 = fxLoopPoint(gm, v, k / 10 + ph * 0.04, 1.0);
        var dir = k % 2 ? 1 : 0.72;
        var len = (7 + 9 * ((seed * 7) % 1)) * v.k * 1.5;
        g.save();
        g.globalAlpha = 0.45 + 0.5 * Math.min(1, on);
        g.strokeStyle = k % 3 === 0 ? '#ffffff' : '#8fd0ff';
        g.lineWidth = Math.max(1, 1.6 * v.k * 1.6);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p0.x + len * dir * 0.5, p0.y - len * 0.7);
        g.lineTo(p0.x + len * dir, p0.y - len * 0.2);
        g.lineTo(p0.x + len * dir * 1.35, p0.y - len * 1.1);
        g.stroke();
        g.restore();
      }
    } else if (fx === 'blaze') {
      var bg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.35 * v.k, cxp.x, cxp.y, gm.rx * 1.55 * v.k);
      bg.addColorStop(0, 'rgba(255,158,50,0.34)');
      bg.addColorStop(0.6, 'rgba(255,96,24,0.14)');
      bg.addColorStop(1, 'rgba(255,60,0,0)');
      g.save();
      g.fillStyle = bg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.22 * v.k, gm.ry * 1.12 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.05 * v.k, 0, TAU);
      g.fill();
      g.restore();
    } else if (fx === 'prism') {
      for (k = 0; k < 2; k++) {
        var hb = ph * 90 + k * 140;
        for (var seg2 = 0; seg2 < 12; seg2++) {
          var sa = hb + seg2 * (TAU / 12), sb = sa + TAU / 12;
          var hue2 = ((ph * 90 + seg2 * 30 + k * 60) % 360);
          pts = strokeEllipse(gm, v, 1.16 + k * 0.1, sa, sb, 3);
          strokeArc(g, pts, 'hsla(' + hue2 + ',96%,76%,0.9)',
            Math.max(1.1, (2.4 - k * 0.6) * v.k * 1.7), 0.5, 0, pts.length - 1);
        }
      }
      var pg = g.createRadialGradient(cxp.x, cxp.y, 6, cxp.x, cxp.y, gm.rx * 2.4 * v.k);
      pg.addColorStop(0, 'rgba(255,236,170,0.26)');
      pg.addColorStop(1, 'rgba(255,200,80,0)');
      g.save();
      g.fillStyle = pg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.9 * v.k, gm.ry * 1.7 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.6 * v.k, 0, TAU);
      g.fill();
      g.restore();
    } else if (fx === 'fire') {
      /* 불꽃 스매시 — 헤드 뒤로 은은한 화염 후광 + 떠오르는 불티 */
      var fbg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.3 * v.k, cxp.x, cxp.y, gm.rx * 1.7 * v.k);
      fbg.addColorStop(0, 'rgba(255,120,40,0.34)');
      fbg.addColorStop(0.65, 'rgba(255,72,20,0.12)');
      fbg.addColorStop(1, 'rgba(255,40,0,0)');
      g.save();
      g.fillStyle = fbg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.3 * v.k, gm.ry * 1.2 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.1 * v.k, 0, TAU);
      g.fill();
      g.restore();
      for (k = 0; k < 10; k++) {
        var ff = (k / 10 + ph * 0.05) % 1;
        var fp = fxLoopPoint(gm, v, ff, 1.06);
        var rise = ((ph * 22 + k * 31) % 40) / 40;
        g.save();
        g.globalAlpha = (1 - rise) * 0.7;
        g.fillStyle = k % 3 === 0 ? '#ffe6a8' : '#ff8a2f';
        g.beginPath();
        g.arc(fp.x + Math.sin(ph * 3 + k) * 3 * v.k, fp.y - rise * 22 * v.k, Math.max(0.9, (2.2 - rise * 1.4) * v.k * 1.8), 0, TAU);
        g.fill();
        g.restore();
      }
    } else if (fx === 'thunder') {
      /* 번개 셔틀 — 가끔 헤드 주변에 번쩍이는 번개 */
      var bt = Math.sin(ph * 1.7);
      if (bt > 0.55) {
        g.save();
        g.globalAlpha = Math.min(0.95, (bt - 0.55) * 2.4);
        g.strokeStyle = '#d6ecff';
        g.lineWidth = Math.max(1, 1.6 * v.k * 1.6);
        g.lineCap = 'round';
        for (k = 0; k < 3; k++) {
          var a0 = ph * 0.7 + k * 2.1;
          var s0 = strokeEllipse(gm, v, 1.22, a0, a0 + 0.16, 2);
          if (s0.length < 2) continue;
          var mid = { x: (s0[0].x + s0[s0.length - 1].x) / 2 + Math.sin(ph * 9 + k) * 7 * v.k,
            y: (s0[0].y + s0[s0.length - 1].y) / 2 + Math.cos(ph * 7 + k) * 7 * v.k };
          g.beginPath();
          g.moveTo(s0[0].x, s0[0].y);
          g.lineTo(mid.x, mid.y);
          g.lineTo(s0[s0.length - 1].x, s0[s0.length - 1].y);
          g.stroke();
        }
        g.restore();
      }
      var tg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.3 * v.k, cxp.x, cxp.y, gm.rx * 1.5 * v.k);
      tg.addColorStop(0, 'rgba(140,215,255,0.22)');
      tg.addColorStop(1, 'rgba(70,140,255,0)');
      g.save();
      g.fillStyle = tg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.2 * v.k, gm.ry * 1.15 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.05 * v.k, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  /* 헤드 앞쪽 — 타오르는 불꽃 · 반짝이 */
  function fxFront(g, gm, v, c) {
    var fx = c.effect;
    if (!fx || fx === 'none') return;
    var ph = v.phase || 0;
    var k, p, nrm, len;
    if (fx === 'blaze') {
      /* 위에서 타오르는 열기 — 부드러운 라디얼 글로우 */
      var ctr2 = project3({ x: 0, y: -gm.ry * 0.35, z: 0 }, v);
      if (g.createRadialGradient) {
        var hg = g.createRadialGradient(ctr2.x, ctr2.y, gm.rx * 0.2 * v.k, ctr2.x, ctr2.y, gm.ry * 1.5 * v.k);
        hg.addColorStop(0, 'rgba(255,206,120,0.4)');
        hg.addColorStop(0.5, 'rgba(255,130,50,0.2)');
        hg.addColorStop(1, 'rgba(255,80,20,0)');
        g.save();
        g.fillStyle = hg;
        g.beginPath();
        if (g.ellipse) g.ellipse(ctr2.x, ctr2.y, gm.rx * 1.5 * v.k, gm.ry * 1.3 * v.k, 0, 0, TAU);
        else g.arc(ctr2.x, ctr2.y, gm.rx * 1.3 * v.k, 0, TAU);
        g.fill();
        g.restore();
      }
      for (k = 0; k < 26; k++) {
        var frac = (k / 26) * 0.78 - 0.39;               /* 위쪽 3/4만 — 목 쪽은 덜 탑니다 */
        p = fxLoopPoint(gm, v, frac, 1.0);
        var topness = 0.55 + 0.45 * Math.cos(frac * TAU);
        var wob = Math.sin(ph * 6 + k * 1.1);
        len = (3 + 9 * topness * (0.55 + 0.45 * wob)) * v.k * 1.5;
        var w0 = (3.2 + 2.8 * topness) * v.k * 1.6;
        var p2 = fxLoopPoint(gm, v, frac, 1.06);
        var dx = p2.x - p.x, dy = p2.y - p.y;
        var dl = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / dl, uy = dy / dl;
        var px2 = -uy, py2 = ux;
        var flick = 0.5 + 0.5 * wob;
        g.save();
        g.globalAlpha = 0.24 + 0.42 * flick;
        g.fillStyle = k % 4 === 0 ? 'rgba(255,250,214,0.95)' : (k % 4 === 1 ? 'rgba(255,206,96,0.92)' : 'rgba(255,132,44,0.86)');
        g.beginPath();
        g.moveTo(p.x - px2 * w0, p.y - py2 * w0);
        g.quadraticCurveTo(p.x + ux * len * 0.45 + px2 * w0 * 0.8, p.y + uy * len * 0.45 + py2 * w0 * 0.8,
          p.x + ux * len, p.y + uy * len);
        g.quadraticCurveTo(p.x + ux * len * 0.45 - px2 * w0 * 0.8, p.y + uy * len * 0.45 - py2 * w0 * 0.8,
          p.x + px2 * w0, p.y + py2 * w0);
        g.closePath();
        g.fill();
        g.restore();
      }
      /* 위로 떠오르는 불티 */
      for (k = 0; k < 5; k++) {
        var ft = (ph * 0.16 + k * 0.2) % 1;
        var q = fxLoopPoint(gm, v, (k * 0.21 - 0.2), 1.05);
        g.save();
        g.globalAlpha = (1 - ft) * 0.7;
        g.fillStyle = k % 2 ? '#ffd166' : '#ff9a4d';
        g.beginPath();
        g.arc(q.x + Math.sin(ph * 3 + k) * 4, q.y - ft * 40 * v.k * 2, Math.max(0.8, 1.8 * v.k * 2), 0, TAU);
        g.fill();
        g.restore();
      }
    } else if (fx === 'prism') {
      for (k = 0; k < 7; k++) {
        var f = (k / 7 + ph * 0.06) % 1;
        p = fxLoopPoint(gm, v, f, 1.02 + (k % 3) * 0.09);
        var r = (2.6 + (k % 3) * 1.5) * v.k * 2.4;
        var hue2 = (ph * 90 + k * 52) % 360;
        g.save();
        g.globalAlpha = 0.5 + 0.45 * Math.abs(Math.sin(ph * 2.6 + k));
        g.fillStyle = 'hsla(' + hue2 + ',95%,78%,0.95)';
        g.beginPath();
        g.moveTo(p.x, p.y - r);
        g.lineTo(p.x + r * 0.34, p.y - r * 0.34);
        g.lineTo(p.x + r, p.y);
        g.lineTo(p.x + r * 0.34, p.y + r * 0.34);
        g.lineTo(p.x, p.y + r);
        g.lineTo(p.x - r * 0.34, p.y + r * 0.34);
        g.lineTo(p.x - r, p.y);
        g.lineTo(p.x - r * 0.34, p.y - r * 0.34);
        g.closePath();
        g.fill();
        g.restore();
      }
    } else if (fx === 'spark') {
      for (k = 0; k < 8; k++) {
        var f2 = (k / 8 + 0.02 + ph * 0.02) % 1;
        p = fxLoopPoint(gm, v, f2, 1.03);
        g.save();
        g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(ph * 4.6 + k * 1.7));
        g.fillStyle = k % 3 ? '#dff4ff' : '#8fd0ff';
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.9, 1.3 * v.k * 2), 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  /* ---------- 한 프레임 ---------- */
  function draw3d(g, v, custom, level, w, h) {
    var c = normalizeCustom(custom);
    var gm = geomOf(c);
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var str = colorOf('string', c.string);
    var lvl = level || 'ok';

    g.clearRect(0, 0, w, h);

    /* 코트 조명 */
    var glow = g.createRadialGradient(w / 2, h * 0.42, 8, w / 2, h * 0.42, Math.max(w, h) * 0.72);
    glow.addColorStop(0, 'rgba(198,242,78,0.17)');
    glow.addColorStop(0.52, 'rgba(198,242,78,0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    /* 헤드 뒤쪽 연출 — 링 · 오라 · 후광 */
    fxBack(g, gm, v, c, w, h);

    /* 바닥 그림자 */
    var foot = project3({ x: 0, y: gm.gripY1 + 4, z: 0 }, v);
    g.save();
    g.globalAlpha = 0.34;
    g.fillStyle = '#000';
    g.beginPath();
    if (g.ellipse) g.ellipse(foot.x, foot.y + 12, gm.rx * 0.72 * v.k, 13 * v.k, 0, 0, TAU);
    else g.arc(foot.x, foot.y + 12, gm.rx * 0.6 * v.k, 0, TAU);
    g.fill();
    g.restore();

    var prims = [];
    addHead(prims, gm, v, frame);
    addFrameEdge(prims, gm, v);
    addDecals(prims, gm, v);
    addStrings(prims, gm, v, str, lvl);
    addStencil(prims, gm, v, c);
    addShaft(prims, gm, v, frame, gm.accent);
    addGrip(prims, gm, v, grip, gm.accent);
    addCharm(prims, gm, v, c);
    paintPrims(g, prims);

    /* 헤드 앞쪽 연출 — 불꽃 · 반짝이 */
    fxFront(g, gm, v, c);

    /* 유리 같은 반사 */
    var sheen = g.createLinearGradient(0, 0, w * 0.9, h);
    sheen.addColorStop(0, 'rgba(255,255,255,0.07)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);

    /* 상태 표시 — 최상이면 반짝, 끊어졌으면 경고 점 */
    if (lvl === 'prime') {
      g.save();
      g.globalAlpha = 0.8; g.fillStyle = '#eaffb0';
      var sp = project3({ x: gm.rx * 0.62, y: -gm.ry * 0.72, z: 0 }, v);
      g.beginPath(); g.arc(sp.x, sp.y, Math.max(1.6, 3 * v.k), 0, TAU); g.fill();
      g.restore();
    }
  }

  /* 화면 좌표 → 파츠 (거트 · 테두리 · 그립) */
  function hitSlot(px, py, v, custom) {
    var gm = geomOf(custom);
    var i, q;
    /* 그립 */
    var g0 = project3({ x: 0, y: gm.gripY0 + 4, z: 0 }, v);
    var g1 = project3({ x: 0, y: gm.gripY1 - 2, z: 0 }, v);
    if (distToSeg(px, py, g0, g1) < Math.max(16, gm.gripR * 1.8 * g0.s * v.k)) return 'grip';
    /* 테두리 — 헤드 외곽선까지의 거리 */
    var loop = headLoop(gm, 3);
    var best = 1e9;
    for (i = 0; i < loop.length; i++) {
      var a = project3({ x: loop[i].x, y: loop[i].y, z: 0 }, v);
      var b = project3({ x: loop[(i + 1) % loop.length].x, y: loop[(i + 1) % loop.length].y, z: 0 }, v);
      var d = distToSeg(px, py, a, b);
      if (d < best) best = d;
    }
    if (best < Math.max(11, gm.hoop * 1.6 * v.k)) return 'frame';
    /* 거트 — 테두리 안쪽 */
    var polyPts = [];
    for (i = 0; i < 24; i++) {
      var ang = i / 24 * TAU;
      var rr = 0.94;
      polyPts.push(project3({ x: Math.cos(ang) * gm.rx * rr, y: Math.sin(ang) * gm.ry * rr, z: 0 }, v));
    }
    if (inPoly(px, py, polyPts)) return 'string';
    /* 목·샤프트도 테두리로 */
    var s0 = project3({ x: 0, y: gm.headBottom, z: 0 }, v);
    var s1 = project3({ x: 0, y: gm.throatY, z: 0 }, v);
    if (distToSeg(px, py, s0, s1) < Math.max(12, gm.tJoint * 0.7 * v.k)) return 'frame';
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

  var viewMem = { yaw: -0.52, pitch: 0.16 };

  /* ============================================================
   * 터치 불꽃 스매시 (bm-v1.82.0)
   *  · 라켓을 짧게 톡 치거나 ⚡ 스매시 버튼을 누르면 60fps 캔버스로
   *    불꽃 파티클 + 셔틀콕 발사 + 충격 링이 이어집니다.
   *  · 드래그(360° 회전)와 부위 탭(꾸미기)은 그대로 함께 삽니다 —
   *    '꾸미기' 모드에서만 부위 탭이 파츠를 바꿉니다(기본은 스매시).
   *  · 파티클은 매 프레임 시간(t)에서 다시 계산합니다 — 상태를 쌓지 않아
   *    프레임이 밀려도 모양이 같고, 캔버스 한 장으로만 그려 CSP 위반이 없습니다.
   * ============================================================ */
  var SMASH_MS = 900;
  var SMASH_PALETTE = {
    fire: { core: '#fff7dc', hot: '#ffd166', mid: '#ff8a2f', deep: '#ff3b2f', ring: '#ffb347' },
    thunder: { core: '#ffffff', hot: '#d6ecff', mid: '#7fd8ff', deep: '#3f7cf2', ring: '#9fd8ff' },
    none: { core: '#ffffff', hot: '#eaffb0', mid: '#c6f24e', deep: '#7fd8ff', ring: '#c6f24e' }
  };
  function smashPalette(id) { return SMASH_PALETTE[id] || SMASH_PALETTE.none; }

  /* 지금 입은 효과의 스매시 이름 — 버튼·토스트가 같은 말을 쓰게 */
  function smashLabel(id) {
    var it = itemOf('effect', id);
    return (it && it.smash) ? it.name : '스매시';
  }

  /* 씨앗으로만 만드는 난수 — 같은 순간이면 언제 다시 그려도 같은 모양 */
  function seedRand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  /* 스매시 임팩트 — draw3d 위에 한 장 더 그립니다 (ms = 시작 후 지난 시간)
   *  fx = 연출 id('fire' · 'thunder' · '' ). 아직 안 산 효과도 미리보기로 그려야 하므로
   *  normalizeCustom(잠금 → 기본값으로 되돌림)을 거치지 않고 이름·색만 바로 씁니다. */
  function drawSmash(g, v, gm, fx, ms, w, h) {
    var t = Math.max(0, Math.min(1, ms / SMASH_MS));
    var fxId = String(fx || '');
    var pal = smashPalette(fxId);
    var unit = Math.min(w, h) / 360;                  /* 화면 크기에 맞춘 단위 */
    /* 맞는 자리는 헤드 가운데 — 어느 각도·바디에서도 연출이 화면 안에 들어오게 한 번 더 가둡니다 */
    var imp = project3({ x: 0, y: 0, z: 0 }, v);
    imp.y = Math.min(Math.max(imp.y, h * 0.24), h * 0.62);
    imp.x = Math.min(Math.max(imp.x, w * 0.26), w * 0.74);
    var ease = 1 - Math.pow(1 - t, 3);
    var fade = Math.pow(1 - t, 1.4);
    var rx = Math.max(20, gm.rx * v.k);
    var i, a, r, len, alpha, d, p2;

    g.save();

    /* 0) 맞는 순간 화면을 살짝 어둡게 — 섬광과 불티가 확실히 보이게 */
    if (t < 0.55) {
      g.globalAlpha = 0.42 * Math.pow(1 - t / 0.55, 1.2);
      g.fillStyle = '#04080a';
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }

    /* 1) 번쩍 — 맞는 순간의 섬광 */
    if (t < 0.38) {
      var fa = Math.pow(1 - t / 0.38, 0.8);
      var fg = g.createRadialGradient(imp.x, imp.y, 2, imp.x, imp.y, rx * (1.15 + t * 1.8));
      fg.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, 1.05 * fa).toFixed(3) + ')');
      fg.addColorStop(0.3, 'rgba(255,255,255,' + (0.8 * fa).toFixed(3) + ')');
      fg.addColorStop(0.58, 'rgba(255,236,190,' + (0.42 * fa).toFixed(3) + ')');
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = fg;
      g.beginPath();
      g.arc(imp.x, imp.y, rx * (1.1 + t * 1.7), 0, TAU);
      g.fill();
    }

    /* 1-1) 맞은 자리의 별 모양 폭발 — 한눈에 '때렸다'가 보이게 */
    if (t < 0.34) {
      var sp2 = Math.pow(1 - t / 0.34, 1.1);
      var arms = 12, R0 = rx * (0.3 + 1.25 * ease);
      g.globalAlpha = Math.min(1, sp2 * 1.25);
      g.fillStyle = pal.core;
      g.shadowColor = pal.hot;
      g.shadowBlur = Math.max(0, 26 * unit * sp2);
      g.beginPath();
      for (i = 0; i < arms * 2; i++) {
        var aa = -Math.PI / 2 + i * Math.PI / arms + t * 0.5;
        var rr2 = (i % 2 === 0) ? R0 : R0 * 0.32;
        var xx = imp.x + Math.cos(aa) * rr2, yy = imp.y + Math.sin(aa) * rr2;
        if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.globalAlpha = 1;
    }

    /* 2) 충격 링 3장 — 퍼져 나가며 얇아집니다 */
    for (i = 0; i < 3; i++) {
      d = i * 0.11;
      p2 = (t - d) / (1 - d);
      if (p2 <= 0) continue;
      r = rx * (0.25 + 2.35 * p2);
      alpha = (1 - p2) * (1 - i * 0.18);
      g.globalAlpha = Math.max(0, alpha);
      g.strokeStyle = i === 0 ? pal.core : pal.ring;
      g.lineWidth = Math.max(1.4, (5.2 - i * 1.1 - p2 * 3.4) * unit * 1.6);
      g.beginPath();
      g.arc(imp.x, imp.y, r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;

    /* 2-1) 강타 궤적 — 맞은 자리를 가로지르는 밝은 줄 */
    if (t < 0.3) {
      var tr = Math.pow(1 - t / 0.3, 1.2);
      var tl = rx * 1.9;
      g.globalAlpha = tr;
      g.strokeStyle = pal.core;
      g.lineWidth = Math.max(1.4, 5 * unit * tr);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(imp.x - tl * 0.85, imp.y + tl * 0.2);
      g.lineTo(imp.x + tl * 0.85, imp.y - tl * 0.2);
      g.stroke();
      g.globalAlpha = 1;
    }

    /* 3) 방사형 빛줄기 */
    for (i = 0; i < 14; i++) {
      a = i / 14 * TAU + 0.22 + t * 0.18;
      len = (18 + 34 * seedRand(i * 31 + 7)) * unit * (0.4 + ease * 1.9) * (1 - t * 0.35);
      g.globalAlpha = Math.max(0, (0.85 - i * 0.03) * fade);
      g.strokeStyle = i % 3 === 0 ? pal.core : pal.mid;
      g.lineWidth = Math.max(1, 2.2 * unit * (1 - t * 0.5));
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(imp.x + Math.cos(a) * len * 0.35, imp.y + Math.sin(a) * len * 0.35);
      g.lineTo(imp.x + Math.cos(a) * len, imp.y + Math.sin(a) * len);
      g.stroke();
    }
    g.globalAlpha = 1;

    /* 4) 불티 파티클 — 바깥으로 튀고 중력에 떨어지며 타들어 갑니다 */
    for (i = 0; i < 34; i++) {
      var ang = i * 2.399963 + (seedRand(i * 13 + 3) - 0.5) * 0.7;
      var sp = 0.55 + seedRand(i * 17 + 5) * 1.05;
      var px = imp.x + Math.cos(ang) * rx * 1.75 * sp * ease;
      var py = imp.y + Math.sin(ang) * rx * 1.75 * sp * ease + 86 * unit * t * t * (0.5 + sp * 0.5);
      var sz = Math.max(1.1, (4.4 - t * 2.4) * unit * (0.75 + seedRand(i * 7 + 1)));
      var col = i % 5 === 0 ? pal.core : (i % 3 === 0 ? pal.hot : (i % 2 ? pal.mid : pal.deep));
      g.globalAlpha = Math.max(0, (1.05 - t * 0.85));
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = Math.max(0, 10 * unit * (1 - t));
      g.beginPath();
      if (g.ellipse) g.ellipse(px, py, sz * 1.5, sz, ang, 0, TAU);
      else g.arc(px, py, sz, 0, TAU);
      g.fill();
    }
    g.shadowBlur = 0;
    g.globalAlpha = 1;

    /* 5) 위로 타오르는 열기 — 불꽃 계열은 크게, 나머지는 짧게 */
    var plume = fxId === 'fire' ? 9 : 5;
    for (i = 0; i < plume; i++) {
      var ph2 = i / plume;
      var hx = imp.x + Math.sin(ph2 * 6.1 + t * 5) * rx * 0.55;
      var hy = imp.y - rx * (0.25 + ph2 * 1.15) * (0.5 + ease * 0.9);
      var hr = rx * (0.34 - ph2 * 0.2) * (0.5 + ease * 0.7);
      if (hr <= 0) continue;
      var pg = g.createRadialGradient(hx, hy, 0, hx, hy, Math.max(1, hr));
      pg.addColorStop(0, i % 2 ? 'rgba(255,214,120,0.5)' : 'rgba(255,140,60,0.42)');
      pg.addColorStop(1, 'rgba(255,90,20,0)');
      g.globalAlpha = Math.max(0, fade);
      g.fillStyle = pg;
      g.beginPath();
      g.arc(hx, hy, Math.max(1, hr), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    /* 6) 날아가는 셔틀콕 — 임팩트에서 오른쪽 위로, 점점 작아지며 돕니다 */
    var fly = Math.max(0, Math.min(1, (t - 0.06) / 0.94));
    if (fly > 0) {
      var dir = -0.62;
      var dist = rx * 3.1 * (1 - Math.pow(1 - fly, 2));
      var sx = imp.x + Math.cos(dir) * dist;
      var sy = imp.y + Math.sin(dir) * dist - 26 * unit * fly;
      var sc = (1 - fly * 0.55) * Math.max(0.55, unit * 1.2);
      g.save();
      g.translate(sx, sy);
      g.rotate(-0.7 + fly * 2.6);
      g.globalAlpha = Math.max(0, 1 - Math.pow(fly, 2.2));
      g.strokeStyle = '#f2f7ff';
      g.lineWidth = Math.max(1, 1.5 * sc);
      g.lineCap = 'round';
      for (i = 0; i < 6; i++) {
        var fang = -0.55 + i * 0.22;
        g.beginPath();
        g.moveTo(-2 * sc, 0);
        g.lineTo(-2 * sc - Math.cos(fang) * 15 * sc, -Math.sin(fang) * 15 * sc);
        g.stroke();
      }
      g.strokeStyle = 'rgba(200,230,255,0.75)';
      for (i = 1; i < 6; i++) {
        var fang2 = -0.55 + i * 0.22;
        g.beginPath();
        g.moveTo(-8 * sc, 0);
        g.lineTo(-8 * sc - Math.cos(fang2) * 8 * sc, -Math.sin(fang2) * 8 * sc);
        g.stroke();
      }
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(0, 0, Math.max(1.6, 3.4 * sc), 0, TAU);
      g.fill();
      g.globalAlpha *= 0.5;
      g.fillStyle = pal.hot;
      g.beginPath();
      g.arc(0, 0, Math.max(1, 5.2 * sc), 0, TAU);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;

    /* 7) 효과 이름 — 맞는 순간 톡 튀어 올랐다가 사라집니다 */
    if (t < 0.75) {
      var na = Math.max(0, Math.min(1, (0.75 - t) / 0.3));
      var pop = 0.88 + 0.24 * Math.min(1, t / 0.14);
      var fs = Math.round(24 * unit * pop);
      var label = smashLabel(fxId);
      g.globalAlpha = Math.min(1, na * 1.15);
      g.font = '900 ' + fs + 'px system-ui, -apple-system, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      var labW = (g.measureText ? g.measureText(label).width : fs * label.length) + fs * 0.9;
      var labelY = imp.y + rx * 1.32;                       /* 헤드 아래(샤프트 쪽) — 글자가 잘리지 않게 */
      labelY = Math.max(fs + 8, Math.min(h - fs - 8, labelY));
      /* 글자 뒤에 어두운 알약 — 어느 배경에서도 읽히게 */
      g.globalAlpha = Math.min(1, na * 0.72);
      g.fillStyle = 'rgba(6,12,9,0.55)';
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(imp.x - labW / 2, labelY - fs * 0.82, labW, fs * 1.64, fs * 0.8);
        g.fill();
      } else {
        g.fillRect(imp.x - labW / 2, labelY - fs * 0.8, labW, fs * 1.6);
      }
      g.globalAlpha = Math.min(1, na * 1.15);
      g.lineWidth = Math.max(2, 3 * unit);
      g.strokeStyle = 'rgba(10,16,12,0.6)';
      g.strokeText(label, imp.x, labelY);
      g.fillStyle = pal.core;
      g.fillText(label, imp.x, labelY);
    }
    g.restore();
  }

  /* 시트 안의 3D 뷰를 붙입니다 — 드래그 회전 · 짧은 탭은 스매시(꾸미기 모드에선 부위 선택) */
  function mount3d(host, ctx) {
    if (!hasDom) return null;
    var cv = host.querySelector('.rk3d__cv');
    if (!cv || !cv.getContext) return null;
    var g = cv.getContext('2d');
    if (!g) return null;
    var state = ctx.store.state;
    var dpr = Math.min(2, (root.devicePixelRatio || 1));
    /* 색을 바꿔 다시 그려도 보던 각도 그대로 (시트를 닫았다 열어도) */
    var v = { yaw: viewMem.yaw, pitch: viewMem.pitch, k: 1, cx: 0, cy: 0, mid: 0, phase: 0 };
    var drag = null, lastMove = 0, lastPaint = 0, raf = 0, alive = true;
    var w = 0, h = 0;
    /* 터치 스매시 상태 — smashAt(시작 시각) · smashFx(그때 입은 효과) */
    var smashAt = 0, smashFx = '', smashOn = false;
    var holdAt = null;      /* 캡처·검사용: 이 시간(ms)에 연출을 멈춰 둡니다 */
    var api = { view: v, paint: paint, redraw: paint, fit: function () { fit(); paint(); }, body: '',
      smash: smash, mode: function () { return stageMode; }, smashing: function () { return smashOn; },
      /* 연출을 원하는 순간에 멈춰 두기(화면 캡처·자동 점검) — 사용자 동작과는 무관합니다 */
      hold: function (ms) { holdAt = Math.max(0, Number(ms) || 0); smashOn = true; paint(); return true; },
      resume: function () { holdAt = null; smashAt = nowMs(); smashOn = true; paint(); return true; } };

    function nowMs() {
      return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
    }

    /* 스매시 한 번 — 짧은 탭·⚡ 버튼·미리보기가 모두 이 함수를 씁니다 */
    function smash(fxId) {
      smashFx = (fxId === undefined || fxId === null) ? customOf(ctx.store.state.me).effect : String(fxId);
      smashAt = nowMs();
      smashOn = true;
      lastMove = Date.now();          /* 스매시 동안에는 자동 회전을 잠깐 멈춥니다 */
      if (BM.ui) BM.ui.haptic(14);
      paint();
      return true;
    }

    function fit() {
      var rect = cv.getBoundingClientRect();
      w = Math.max(160, Math.round(rect.width));
      h = Math.max(200, Math.round(rect.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var gm = geomOf(customOf(ctx.store.state.me));
      v.mid = gm.mid;
      /* 바디마다 전체 길이가 달라도 캔버스 안에 꽉 차게 (원근 배율 보정 포함) */
      var persp = (FOCUS + CAM_Z) / FOCUS;
      v.k = Math.min(w / (gm.rx * 2.9), h / (gm.span * 1.1)) * persp;
      v.cx = w / 2;
      v.cy = h / 2 + 2;
    }

    function paint() {
      if (!alive) return;
      var c = customOf(ctx.store.state.me);
      var lvl = conditionOf(ctx.store.state).level;
      var el = smashOn ? (holdAt != null ? holdAt : nowMs() - smashAt) : 0;
      if (smashOn && el >= SMASH_MS) { smashOn = false; el = 0; }
      /* 맞는 순간의 짧은 화면 흔들림 — 스매시가 살아 있을 때만 */
      var shake = 0;
      if (smashOn) {
        var k2 = Math.max(0, 1 - el / SMASH_MS);
        shake = Math.sin(el / 22) * 5 * k2 * Math.min(1, w / 360);
      }
      g.save();
      if (shake) g.translate(shake, Math.cos(el / 31) * shake * 0.5);
      draw3d(g, v, c, lvl, w, h);
      if (smashOn) drawSmash(g, v, geomOf(c), smashFx, el, w, h);
      g.restore();
      lastPaint = Date.now();
      api.body = c.body;
      if (BM.racketcustom) BM.racketcustom._last3d = api;
    }

    function loop() {
      if (!alive) return;
      if (!cv.isConnected) { alive = false; return; }
      var now = Date.now();
      var fx = customOf(ctx.store.state.me).effect;
      var animate = fx && fx !== 'none';
      if (!drag && now - lastMove > 1800) {
        v.yaw += animate ? 0.0014 : 0.0032;    /* 가만히 두면 살짝 숨 쉬듯 돕니다 */
        viewMem.yaw = v.yaw;
      }
      /* 캡처용으로 멈춰 둔 동안에는 다시 그리지 않습니다 */
      if (holdAt != null) { raf = root.requestAnimationFrame(loop); return; }
      /* 스매시 동안에는 60fps로 부드럽게 — 끝나면 평소 주기로 돌아갑니다 */
      if (smashOn && nowMs() - smashAt < SMASH_MS) {
        paint();
      } else if (now - lastPaint > (animate ? 44 : 34)) {
        if (animate) v.phase = (v.phase || 0) + 0.06;
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
      /* 짧은 탭 = 스매시 타격, '꾸미기' 모드에서만 부위 탭으로 파츠를 바꿉니다 */
      if (stageMode !== 'paint') { smash(); return; }
      var slot = hitSlot(px, py, v, customOf(ctx.store.state.me));
      if (slot) pickSlot(host, ctx, slot);
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', endDrag);

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
      var key = slot + ':' + it.id;
      var ask = !open && it.heart && pendingBuy === key;      /* 한 번 더 누르면 하트로 열립니다 */
      var price = it.free ? '무료' : (open ? '보유'
        : (it.heart ? (ask ? '다시 눌러 열기' : '❤ ' + it.heart) : (it.cost || 50) + 'P'));
      var rar = rarityOf(it.rarity);
      return '<button type="button" class="rkpart is-r-' + rar.id + (on ? ' is-on' : '') + (!open ? ' is-lock' : '') +
        (it.heart ? ' is-heart' : '') + (ask ? ' is-ask' : '') + '"' +
        ' data-rk-part="' + key + '" data-rk-slot="' + slot + '" data-rk-id="' + it.id + '"' +
        ' data-rk-rarity="' + rar.id + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' aria-label="' + U.esc(def.label + ' ' + it.name + ' ' + rar.name +
          (open ? (on ? ' · 입고 있음' : ' · 입기')
            : (it.heart ? ' · 하트 ' + it.heart + '개로 열기' : ' · ' + (it.cost || 50) + 'P로 열기'))) + '">' +
        '<i class="rkpart__sw" style="--c:' + it.color + '"></i>' +
        '<b class="rkpart__n">' + U.esc(it.name) + '</b>' +
        (it.note ? '<em class="rkpart__d">' + U.esc(it.note) + '</em>' : '') +
        '<span class="rkpart__p' + (!open ? ' is-cost' : '') + (it.heart ? ' is-heartp' : '') + '">' + U.esc(price) + '</span>' +
        '<u class="rkrar">' + U.esc(rar.name) + '</u>' +
        (!open ? '<span class="rkpart__lock" aria-hidden="true">' + (it.heart ? '❤' : '🔒') + '</span>' : '') +
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
  /* bm-v1.82.0 — 3D에서 짧은 탭이 하는 일
   *  · smash(기본): 라켓을 톡 치면 불꽃 스매시 연출
   *  · paint: 부위를 눌러 그 파츠 탭으로 (예전 동작)
   * 드래그(360° 회전)는 두 모드 모두 그대로입니다. */
  var stageMode = 'smash';
  var pendingBuy = '';      /* 하트로 여는 파츠: 첫 탭은 미리보기, 한 번 더 누르면 구매 */

  function tabHtml() {
    return '<div class="rk3d__tabs" role="tablist" aria-label="바꿀 부위">' +
      SLOTS.map(function (slot) {
        var on = slot === activeSlot;
        var tabName = FX_TAB[slot] || PARTS[slot].label;
        return '<button type="button" class="rk3d__tab' + (on ? ' is-on' : '') + '" data-rk-slot="' + slot + '"' +
          ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '">' + U.esc(tabName) + '</button>';
      }).join('') + '</div>';
  }

  /* 라켓 바디(모델) 4종 — 고르면 3D 실루엣·프레임 두께·데칼이 바로 바뀝니다 */
  function bodyHtml(state) {
    var c = customOf(state && state.me);
    return '<div class="rkbody" role="radiogroup" aria-label="라켓 바디 종류">' +
      BODY_IDS.map(function (id) {
        var b = BODIES[id];
        var on = (c.body || DEFAULT_BODY) === id;
        var open = isUnlocked(c, 'body', id);
        var rar = rarityOf(b.rarity);
        return '<button type="button" class="rkbody__chip is-r-' + rar.id + (on ? ' is-on' : '') + (!open ? ' is-lock' : '') + '"' +
          ' data-rk-body="' + id + '" data-rk-rarity="' + rar.id + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
          ' aria-label="' + U.esc(b.name + ' 바디 · ' + b.note + ' · ' + rar.name + (open ? '' : ' · ' + (b.cost || 0) + 'P로 열기')) + '">' +
          '<i class="rkbody__sw" style="--c:' + b.accent + '" aria-hidden="true"></i>' +
          '<b>' + U.esc(b.name) + '</b><span>' + U.esc(open ? b.note : (b.cost || 0) + 'P') + '</span>' +
          '<u class="rkrar">' + U.esc(rar.name) + '</u>' +
          (!open ? '<span class="rkpart__lock" aria-hidden="true">🔒</span>' : '') +
          '</button>';
      }).join('') + '</div>';
  }

  /* 3D 라켓 바로 아래 — 줄 갈고 며칠째인지 한 줄로 (bm-v1.81.0) */
  function stringAge(state) {
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = statusFor(g);
    var out = { state: 'none', level: 'none', main: '', sub: '', label: '' };
    if (!g.strungAt) {
      out.state = 'nodate';
      out.level = 'nodate';
      out.main = '줄 교체일 미등록';
      out.sub = '오늘 갈았으면 눌러서 기록';
      out.label = '줄 교체일 미등록 · 눌러서 오늘 날짜 기록';
      return out;
    }
    out.days = st.daysSince;
    out.left = st.daysLeft;
    out.cycle = st.cycle;
    out.meta = st.meta || '';
    if (st.state === 'due') {
      out.state = 'due';
      out.level = 'due';
      out.main = '줄 갈고 ' + st.daysSince + '일째';
      out.sub = st.daysLeft === 0 ? '오늘이 교체일 · 줄이 끊어졌어요' : '교체 시기가 다 돼서 줄이 끊어졌어요';
      out.label = out.main + ' · ' + out.sub;
    } else if (st.daysSince === 0) {
      out.state = 'new';
      out.level = 'prime';
      out.main = '오늘 새 줄로 갈았어요!';
      out.sub = 'D+0 · 교체까지 ' + st.daysLeft + '일';
      out.label = '오늘 새 줄로 갈았어요 · D+0';
    } else {
      out.state = st.state;
      out.level = st.state === 'soon' ? 'soon' : 'ok';
      out.main = '줄 갈고 ' + st.daysSince + '일째';
      out.sub = '교체까지 ' + st.daysLeft + '일 남음';
      out.label = out.main + ' · ' + out.sub;
    }
    return out;
  }

  function stringAgeHtml(state) {
    var a = stringAge(state);
    var fixable = a.state === 'due' || a.state === 'nodate';
    return '<div class="rkage rkage--' + a.level + '">' +
      '<button type="button" class="rkage__main" data-rk-gear="1" aria-label="' + U.esc(a.label) + '">' +
        '<i class="rkage__dot" aria-hidden="true"></i>' +
        '<b class="rkage__t">' + U.esc(a.main) + '</b>' +
        '<span class="rkage__s">' + U.esc(a.sub) + '</span>' +
      '</button>' +
      (fixable
        ? '<button type="button" class="rkage__fix" data-rk-restring="1">오늘 갈았어요</button>'
        : '<button type="button" class="rkage__fix is-ghost" data-rk-gear="1">기록</button>') +
      '</div>';
  }

  /* 3D 위 조작 줄 — 스매시 / 꾸미기 모드 + ⚡ 스매시 테스트 버튼 (bm-v1.82.0) */
  function stageHtml(state) {
    var c = customOf(state && state.me);
    var big = c.effect === 'fire' || c.effect === 'thunder';
    return '<div class="rkstage" data-rk-stage>' +
      '<div class="rkstage__modes" role="group" aria-label="라켓 터치 동작">' +
        '<button type="button" class="rkstage__m' + (stageMode === 'smash' ? ' is-on' : '') + '"' +
          ' data-rk-mode="smash" aria-pressed="' + (stageMode === 'smash' ? 'true' : 'false') + '">⚡ 스매시</button>' +
        '<button type="button" class="rkstage__m' + (stageMode === 'paint' ? ' is-on' : '') + '"' +
          ' data-rk-mode="paint" aria-pressed="' + (stageMode === 'paint' ? 'true' : 'false') + '">🎨 꾸미기</button>' +
      '</div>' +
      '<button type="button" class="rkstage__go' + (big ? ' is-big' : '') + '" data-rk-smash="1"' +
        ' aria-label="' + U.esc(smashLabel(c.effect) + ' 연출 쳐보기') + '">⚡ 스매시 테스트</button>' +
      '</div>';
  }

  function sheetBody(state) {
    var cond = conditionOf(state);
    var c = customOf(state.me);
    var pd = pointsDetail(state);
    var g = BM.gear ? BM.gear.gearOf(state.me) : {};
    var spec = BM.gear ? BM.gear.specText(g) : '';
    var racketLine = [g.racket || '내 라켓', spec].filter(Boolean).join(' · ');
    var bodyName = bodyOf(c.body).name;
    return '<div class="rksheet">' +
      /* 3D 라켓 — 끌어서 360°, 부위를 눌러 바로 꾸미기 */
      '<div class="rk3d' + (stageMode === 'paint' ? ' is-paint' : '') + '" data-rk-3d>' +
        '<canvas class="rk3d__cv" width="600" height="760" aria-label="내 라켓 3D 보기 · 끌어서 돌리고 톡 치면 불꽃 스매시"></canvas>' +
        bodyHtml(state) +
        stageHtml(state) +
        '<p class="rk3d__hint"><span aria-hidden="true">↔</span> 끌어서 360° 돌려보기 · ' +
          (stageMode === 'paint'
            ? '<b>거트 · 테두리 · 그립</b>을 눌러 바로 바꿔요'
            : '라켓을 <b>톡</b> 치면 불꽃 스매시!') + '</p>' +
        tabHtml() +
      '</div>' +
      /* 줄 갈고 며칠째인지 — 바로 아래 한 줄 */
      stringAgeHtml(state) +
      /* 지금 상태 */
      '<div class="rkhero rkhero--' + cond.level + '">' +
        '<div class="rkhero__txt">' +
          '<p class="rkhero__badge">' + U.esc(cond.level === 'prime' ? '최상 컨디션' : cond.level === 'worn' ? '줄이 느슨해요' : cond.level === 'broken' ? '줄이 끊어졌어요' : '줄 상태 좋아요') + '</p>' +
          '<p class="rkhero__t">' + U.esc(cond.title) + '</p>' +
          '<p class="rkhero__s">' + U.esc(cond.line) + '</p>' +
          '<p class="rkhero__r">' + U.esc(racketLine) + (specText(c) ? ' · ' + U.esc(specText(c)) : '') + '</p>' +
          '<p class="rkhero__b">' + U.esc(bodyName) + ' 바디 · ' + U.esc(bodyOf(c.body).note) +
            ' <i class="rkrar rkrar--' + topRarity(c).id + '">' + topRarity(c).name + ' 등급</i></p>' +
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
      BM.ui.toast(opts.unlock + ' 입었어요');
    } else if (opts && opts.body && BM.ui) {
      BM.ui.toast(opts.body + ' 바디로 바꿨어요');
    } else if (BM.ui) {
      BM.ui.toast('라켓 색을 바꿨어요');
    }
    if (BM.ui) BM.ui.haptic(10);
    paintHeader(ctx.store.state);
    if (ctx.repaint) ctx.repaint();
    return true;
  }

  function openSheet(ctx) {
    if (!hasDom || !BM.ui) return null;
    lastUnlock = null;
    pendingBuy = '';
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
          /* ---- 스매시 / 꾸미기 모드 · ⚡ 스매시 테스트 (bm-v1.82.0) ---- */
          var modeBtn = ev.target.closest('[data-rk-mode]');
          if (modeBtn) {
            ev.preventDefault();
            var want = modeBtn.getAttribute('data-rk-mode');
            if (want !== stageMode) {
              stageMode = want === 'paint' ? 'paint' : 'smash';
              pendingBuy = '';
              BM.ui.haptic(6);
              refreshSheet(host, ctx);
            }
            return;
          }
          if (ev.target.closest('[data-rk-smash]')) {
            ev.preventDefault();
            /* 연출이 이미 효과 이름을 크게 띄우므로 토스트로 가리지 않습니다 */
            if (BM.racketcustom && BM.racketcustom._last3d && BM.racketcustom._last3d.smash) {
              BM.racketcustom._last3d.smash();
            }
            return;
          }
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
          var bodyBtn = ev.target.closest('[data-rk-body]');
          if (bodyBtn) {
            ev.preventDefault();
            var bid = bodyBtn.getAttribute('data-rk-body');
            var bst = ctx.store.state;
            var bcur = customOf(bst.me);
            if (bcur.body === bid) return;
            if (!isUnlocked(bcur, 'body', bid)) {
              var bprice = costOf('body', bid);
              var bbal = pointsBalance(bst);
              if (bbal < bprice) {
                BM.ui.toast('라켓 포인트가 ' + (bprice - bbal) + 'P 부족해요 · 일지·출석으로 모아 보세요', 'error');
                return;
              }
              var bnext = normalizeCustom(bcur);
              if (bnext.unlocked.indexOf('body:' + bid) < 0) bnext.unlocked.push('body:' + bid);
              var bprev = bcur.body;
              bnext.body = bid;
              if (!saveCustom(ctx, bnext, { unlock: BODIES[bid].name + ' 바디' })) return;
              lastUnlock = { slot: 'body', id: bid, name: BODIES[bid].name + ' 바디', cost: bprice, prev: bprev };
              BM.ui.toast(BODIES[bid].name + ' 바디를 열었어요 · -' + bprice + 'P');
              refreshSheet(host, ctx);
              return;
            }
            var bnext2 = normalizeCustom(bcur);
            bnext2.body = bid;
            if (saveCustom(ctx, bnext2, { body: BODIES[bid].name })) refreshSheet(host, ctx);
            return;
          }
          var part = ev.target.closest('[data-rk-part]');
          if (part) {
            ev.preventDefault();
            var slot = part.getAttribute('data-rk-slot');
            var id = part.getAttribute('data-rk-id');
            var st = ctx.store.state;
            var cur = customOf(st.me);
            var partIt = itemOf(slot, id) || {};
            /* 하트로 여는 스페셜 스매시 — 첫 탭은 미리보기, 한 번 더 누르면 결제 */
            if (isHeartItem(slot, id) && !isUnlocked(cur, slot, id)) {
              var need = heartCostOf(slot, id);
              var keyH = slot + ':' + id;
              if (BM.racketcustom && BM.racketcustom._last3d && BM.racketcustom._last3d.smash) {
                BM.racketcustom._last3d.smash(id);       /* 어떤 연출인지 먼저 보여 줍니다 */
              }
              if (pendingBuy !== keyH) {
                pendingBuy = keyH;
                BM.ui.haptic(8);
                BM.ui.toast(partIt.name + ' · ❤ ' + need + '개 · 한 번 더 누르면 열려요');
                refreshSheet(host, ctx);
                return;
              }
              pendingBuy = '';
              var hearts = (st.data && st.data.hearts && st.data.hearts.balance) || 0;
              if (hearts < need) {
                BM.ui.toast('하트가 ' + (need - hearts) + '개 부족해요 · 출석·광고로 모아 보세요', 'error');
                refreshSheet(host, ctx);
                return;
              }
              if (!ctx.actions.buySmash) {
                BM.ui.toast('지금은 열 수 없어요 · 잠시 뒤 다시 시도해 주세요', 'error');
                return;
              }
              BM.ui.toast(partIt.name + ' 여는 중…');
              Promise.resolve(ctx.actions.buySmash(slot, id)).then(function (res) {
                res = res || { ok: false, reason: 'error' };
                if (res.ok) {
                  lastUnlock = null;
                  BM.ui.haptic(16);
                  BM.ui.toast(res.purchased
                    ? partIt.name + ' 열었어요 · ❤ ' + res.price + '개 사용'
                    : partIt.name + ' 입었어요');
                  paintHeader(ctx.store.state);
                  if (ctx.repaint) ctx.repaint();
                } else if (res.reason === 'hearts') {
                  BM.ui.toast('하트가 ' + (res.need || need) + '개 부족해요 · 출석·광고로 모아 보세요', 'error');
                } else if (res.reason === 'unknown') {
                  BM.ui.toast('지금은 하트로 여는 준비 중이에요 · 연출은 그대로 미리 볼 수 있어요', 'error');
                } else if (res.reason === 'paid_retry') {
                  BM.ui.toast('하트 ' + (res.price || need) + '개로 열었어요 · 잠시 뒤 자동으로 입어져요');
                } else if (res.reason === 'locked') {
                  BM.ui.toast('잠시만요, 저장 중이에요 · 한 번 더 눌러 주세요', 'error');
                } else if (res.reason === 'auth' || res.reason === 'no_login') {
                  BM.ui.toast('로그인을 다시 확인해 주세요', 'error');
                } else {
                  BM.ui.toast('열지 못했어요 · 잠시 뒤 다시 시도해 주세요', 'error');
                }
                refreshSheet(host, ctx);
              });
              return;
            }
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
          if (ev.target.closest('[data-rk-restring]')) {
            ev.preventDefault();
            /* 방금 다른 저장이 올라가는 중이면(잠금) 잠깐 뒤 한 번 더 시도합니다 */
            var doRestring = function (tries) {
              var gres = ctx.actions.setGear ? ctx.actions.setGear({ strungAt: U.ymd() }) : { ok: false };
              if (gres && gres.ok) {
                BM.ui.haptic(12);
                BM.ui.toast('오늘 새 줄로 갈았어요 · 줄이 다시 팽팽해요');
                paintHeader(ctx.store.state);
                if (ctx.repaint) ctx.repaint();
                refreshSheet(host, ctx);
                return;
              }
              if (tries > 0 && gres && gres.reason === 'locked') {
                setTimeout(function () { doRestring(tries - 1); }, 600);
                return;
              }
              BM.ui.toast('지금은 저장할 수 없어요 · 잠시 뒤 다시 시도해 주세요', 'error');
            };
            doRestring(2);
            return;
          }
          if (ev.target.closest('[data-rk-gear]') || ev.target.closest('[data-rk-open-gear]')) {
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
    RARITY: RARITY, RARITY_IDS: RARITY_IDS, rarityOf: rarityOf, rarityRankOf: rarityRankOf,
    topRarity: topRarity, rarityNameOf: rarityNameOf,
    BODIES: BODIES, BODY_IDS: BODY_IDS, DEFAULT_BODY: DEFAULT_BODY, bodyOf: bodyOf, geomOf: geomOf,
    bodyHtml: bodyHtml, headLoop: headLoop,
    TIRED_DAYS: TIRED_DAYS, BROKEN_DAYS: BROKEN_DAYS, BURST_MS: BURST_MS,
    itemsOf: itemsOf, itemOf: itemOf, freeId: freeId, colorOf: colorOf, costOf: costOf,
    heartCostOf: heartCostOf, isHeartItem: isHeartItem, smashLabel: smashLabel, smashPalette: smashPalette,
    SMASH_MS: SMASH_MS, drawSmash: drawSmash,
    blankCustom: blankCustom, normalizeCustom: normalizeCustom, isUnlocked: isUnlocked,
    hasCustom: hasCustom, customOf: customOf, customFor: customFor, specText: specText,
    pointsDetail: pointsDetail, pointsBalance: pointsBalance, pointsToday: pointsToday,
    lastLogDate: lastLogDate, conditionOf: conditionOf,
    svg: svg, drawRacket: drawRacket, miniHtml: miniHtml, personHtml: personHtml,
    bodyDecalSvg: bodyDecalSvg, fxSvg: fxSvg, headArc: headArc, decalAt: decalAt, stringChords: stringChords,
    _parts: { head: addHead, edge: addFrameEdge, decals: addDecals, strings: addStrings, stencil: addStencil,
      shaft: addShaft, grip: addGrip, charm: addCharm, paint: paintPrims, fxBack: fxBack,
      fxFront: fxFront, draw: draw3d },
    headerHtml: headerHtml, paintHeader: paintHeader,
    sheetBody: sheetBody, stageHtml: stageHtml, openSheet: openSheet, pickSlot: pickSlot, mount3d: mount3d,
    stringAge: stringAge, stringAgeHtml: stringAgeHtml,
    /* 3D 뷰 (테스트·재사용) */
    G3: G3, rot3: rot3, project3: project3, hitSlot: hitSlot, draw3d: draw3d, inPoly: inPoly,
    burstChips: burstChips, burst: burst, shareInfo: shareInfo
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
