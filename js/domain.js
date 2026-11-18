/* ============================================================
 * domain.js — 시트(26칸) ↔ 앱 객체 변환 + 계산 로직 (순수 함수)
 * 시트 '출력결과' 탭의 실제 열 순서를 그대로 사용합니다.
 * DOM/네트워크를 만지지 않으므로 테스트에서 그대로 돌려볼 수 있습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  /* 시트 열 순서 (A~Z, 26칸) — 절대 순서를 바꾸지 마세요 */
  var COLS = [
    'ID', '유형', '작성일시', '날짜', '닉네임', '실력', '주력종목', '훈련계획',
    '컨디션', '훈련강도', '운동시간(분)', '완료훈련', '게임점수', '승패', '아픈부위',
    '맞춤처방', '약점기술', '추천드릴', '소셜글', '좋아요', '사용자ID', '대상', '팀',
    '자기소개', '비밀번호', '꾸미기'
  ];
  var COL = {};
  COLS.forEach(function (c, i) { COL[c] = i; });

  /* 실제 시트에서 쓰이던 값들 그대로 */
  /* 급수(grade) — 실제 동호인/선수부에서 쓰는 구분. 강한 순서.
   * 예전 시트의 '초보용/일반부/상급' 값은 아래 별칭표로 자동 변환됩니다. */
  var GRADES = ['자강', '선수부', 'A조', 'B조', 'C조', 'D조', '초심'];
  var GRADE_ALIASES = {
    '자강': '자강', '자강부': '자강',
    '선수부': '선수부', '선수': '선수부', '선출': '선수부',
    'A조': 'A조', 'B조': 'B조', 'C조': 'C조', 'D조': 'D조', '초심': '초심',
    '상급': 'B조', '중급': 'C조', '초급': 'D조',
    '일반부': 'C조', '초보용': '초심', '초보': '초심'
  };

  function normalizeGrade(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
    if (!s) return '';
    if (GRADE_ALIASES[s]) return GRADE_ALIASES[s];
    var m = s.match(/^([ABCD])조$/i);
    if (m) return m[1].toUpperCase() + '조';
    if (s.indexOf('자강') >= 0) return '자강';
    if (s.indexOf('선수') >= 0) return '선수부';
    if (s.indexOf('초심') >= 0 || s.indexOf('초보') >= 0) return '초심';
    if (s.indexOf('상급') >= 0) return 'B조';
    if (s.indexOf('일반') >= 0) return 'C조';
    return '';
  }

  /* 성별 — 매칭 검색용. 모두에게 밝히고 싶지 않은 사람이 있으므로 '비공개'를 둡니다. */
  var GENDERS = ['남성', '여성', '비공개'];
  function normalizeGender(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
    if (!s) return '비공개';
    var low = s.toLowerCase();
    if (s === '남성' || s === '여성' || s === '비공개') return s;
    if (low === 'm' || low === 'male' || low === 'man' || s.indexOf('남자') >= 0 || s.indexOf('남') === 0) return '남성';
    if (low === 'f' || low === 'female' || low === 'woman' || s.indexOf('여자') >= 0 || s.indexOf('여') === 0) return '여성';
    return '비공개';
  }

  /* 프로필 사진 꾸미기 — 프레임 / 배경 / 배지.
   * 실제 저장은 프로필 JSON(꾸미기 칸, 매칭프로필 payload) 안에
   * avatarPhoto·avatarFrame·avatarBg·avatarBadge 로 들어갑니다. */
  var AVATAR = {
    frames: [
      { id: 'basic', name: '기본', hint: '담백한 링' },
      { id: 'court', name: '코트그린', hint: '배드민턴 코트' },
      { id: 'gold', name: '골드', hint: '챔피언 링' },
      { id: 'royal', name: '로열블루', hint: '차분한 블루' },
      { id: 'sakura', name: '사쿠라', hint: '핑크 라이트' },
      { id: 'neon', name: '네온', hint: '야간 코트' }
    ],
    bgs: [
      { id: 'plain', name: '담백', hint: '테마 기본' },
      { id: 'mint', name: '민트', hint: '코트 그린' },
      { id: 'ocean', name: '오션', hint: '블루' },
      { id: 'sunset', name: '선셋', hint: '코랄' },
      { id: 'grape', name: '그레이프', hint: '퍼플' },
      { id: 'lime', name: '라임', hint: '셔틀콕 포인트' }
    ],
    badges: ['', '🏸', '🔥', '⭐', '🥇', '👑', '🦋'],
    emojis: ['🏸', '🦋', '🐻', '🦊', '🐧', '🐰', '🦉', '🐯', '🐨', '🦌', '🔥', '🌟', '🥇', '⚡', '🐳', '🐍'],
    maxPhotoChars: 60000     /* 시트 한 칸·localStorage를 지키는 상한 (base64 글자 수) */
  };

  function pickId(list, value, fallback) {
    var v = String(value == null ? '' : value);
    for (var i = 0; i < list.length; i++) if (list[i].id === v) return v;
    return fallback;
  }

  function isPhoto(v) {
    return typeof v === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(v);
  }

  /* 어떤 모양의 입력이 와도 화면이 바로 쓸 수 있는 형태로 정리합니다.
   *  입력: { photo|avatarPhoto, emoji|avatar, frame|avatarFrame, bg|avatarBg, badge|avatarBadge }
   *  출력: { photo, emoji, frame, bg, badge } */
  function normalizeAvatar(o) {
    o = o || {};
    var photo = o.photo != null ? o.photo : o.avatarPhoto;
    var emoji = o.emoji != null ? o.emoji : o.avatar;
    var em = String(emoji == null ? '' : emoji).trim();
    if (!em || em.length > 8) em = '🏸';
    var badge = String((o.badge != null ? o.badge : o.avatarBadge) || '').trim();
    if (AVATAR.badges.indexOf(badge) < 0) badge = '';
    return {
      photo: isPhoto(photo) && photo.length <= AVATAR.maxPhotoChars ? photo : '',
      emoji: em,
      frame: pickId(AVATAR.frames, o.frame != null ? o.frame : o.avatarFrame, 'basic'),
      bg: pickId(AVATAR.bgs, o.bg != null ? o.bg : o.avatarBg, 'plain'),
      badge: badge
    };
  }

  /* 프로필·매칭프로필·내 계정 어디서든 같은 모양으로 꺼냅니다 */
  function avatarOf(p) {
    p = p || {};
    var t = p.theme || {};
    return normalizeAvatar({
      avatarPhoto: p.avatarPhoto || p.photo || t.avatarPhoto,
      avatar: p.avatar || p.emoji || t.avatar,
      avatarFrame: p.avatarFrame || p.frame || t.avatarFrame,
      avatarBg: p.avatarBg || p.bg || t.avatarBg,
      avatarBadge: p.avatarBadge || p.badge || t.avatarBadge
    });
  }

  var VOCAB = {
    grades: GRADES,
    levels: GRADES,                 /* 예전 이름 호환 */
    genders: GENDERS,
    legacyLevels: ['초보용', '일반부', '상급', '선수부'],
    disciplines: ['복식', '단식', '혼합복식'],
    done: ['스트록', '벽치기', '런닝', '코어', '풋워크', '스매시', '게임', '웨이트', '21점제'],
    weakness: ['드라이브', '헤어핀', '드롭', '클리어', '스매시', '풋워크', '서브', '리시브'],
    pain: ['목', '어깨', '허리', '팔꿈치', '무릎', '손목', '아킬레스건', '발목'],
    regions: ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '기타'],
    genderFilter: ['전체'].concat(GENDERS.slice(0, 2)),
    availability: ['평일 저녁', '주말', '평일 낮', '무관'],
    experience: ['1년 미만', '1~2년', '2~5년', '5년 이상']
  };

  /* ============================================================
   * 하트 경제 규칙 — 앱과 브리지(APPS_SCRIPT_BRIDGE.gs CONFIG)가 같은 값이어야 합니다.
   *  적립: 가입 기본 3 / 출석 1(하루 1회) / 광고 1(하루 5회, 30초 간격) /
   *        선물 받음 1 / 하트 합치기 N
   *  사용: 매칭 신청 2 / 유료 테마 2 / 하트 선물 1
   * ============================================================ */
  var HEART_RULES = {
    BASE: 3,
    CHECKIN: 1,
    CHECKIN_PER_DAY: 1,
    AD_REWARD: 1,
    AD_PER_DAY: 5,
    AD_COOLDOWN_SEC: 30,
    MATCH_COST: 2,
    GIFT_COST: 1,
    THEME_PRICES: { th_def: 0, th_night: 0, th_court: 2, th_sakura: 2 }
  };

  var THEMES = [
    { id: 'th_def', name: '기본 코트', hint: '깔끔한 그린', price: HEART_RULES.THEME_PRICES.th_def },
    { id: 'th_night', name: '나이트', hint: '어두운 네이비', price: HEART_RULES.THEME_PRICES.th_night },
    { id: 'th_court', name: '라임 코트', hint: '형광 라임 포인트', price: HEART_RULES.THEME_PRICES.th_court },
    { id: 'th_sakura', name: '사쿠라', hint: '핑크 라이트', price: HEART_RULES.THEME_PRICES.th_sakura }
  ];

  var BASE_HEARTS = HEART_RULES.BASE;            // 가입 축하 하트 (구버전 호환)
  var HEART_COST_MATCH = HEART_RULES.MATCH_COST; // 1:1 매칭 신청 비용

  var JSON_TYPES = { '매칭프로필': 1, '코치신청': 1, '멘토신청': 1, '매칭신청': 1, '코치피드백': 1, '계획': 1 };

  /* 멘토 심사는 관리자 계정만 할 수 있습니다.
   * 앱(화면)과 브리지(APPS_SCRIPT_BRIDGE.gs CONFIG.ADMIN_EMAILS)가 같은 값을 봅니다. */
  var ADMIN_EMAILS = ['csw42060713@gmail.com'];
  var ADMIN_TARGET = ADMIN_EMAILS[0];

  function asCells(row) {
    var out = [];
    for (var i = 0; i < COLS.length; i++) out.push(row && row[i] != null ? String(row[i]) : '');
    return out;
  }

  function splitList(v) {
    if (!v) return [];
    return U.uniq(String(v).split(/[,、\/]/).map(function (s) { return s.trim(); }));
  }

  function looksJson(v) {
    return typeof v === 'string' && /^\s*[\{\[]/.test(v);
  }

  function parseScore(v) {
    var m = String(v || '').match(/(\d{1,2})\s*[:：\-]\s*(\d{1,2})/);
    if (!m) return null;
    return { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
  }

  function resultFromScore(score, mine) {
    if (!score) return '';
    if (score.a === score.b) return '무';
    var win = score.a > score.b;
    if (mine === 'b') win = !win;
    return win ? '승' : '패';
  }

  /* --- 시트 한 줄 → 앱 객체 --- */
  function fromRow(row) {
    var c = asCells(row);
    var type = c[COL['유형']];
    var social = c[COL['소셜글']];
    var payload = JSON_TYPES[type] && looksJson(social) ? U.jsonParse(social, null) : null;
    var e = {
      id: c[COL['ID']],
      type: type,
      createdAt: c[COL['작성일시']],
      date: c[COL['날짜']] || (c[COL['작성일시']] || '').slice(0, 10),
      nick: c[COL['닉네임']],
      level: normalizeGrade(c[COL['실력']]),
      discipline: c[COL['주력종목']],
      plan: U.jsonParse(c[COL['훈련계획']], null),
      cond: Cnum(c[COL['컨디션']]),
      intensity: Cnum(c[COL['훈련강도']]),
      minutes: Cnum(c[COL['운동시간(분)']]),
      done: splitList(c[COL['완료훈련']]),
      score: parseScore(c[COL['게임점수']]),
      scoreRaw: c[COL['게임점수']],
      result: c[COL['승패']],
      pain: splitList(c[COL['아픈부위']]),
      prescription: U.jsonParse(c[COL['맞춤처방']], null),
      weakness: splitList(c[COL['약점기술']]),
      drills: U.jsonParse(c[COL['추천드릴']], null),
      text: payload ? '' : social,
      payload: payload,
      likes: Cnum(c[COL['좋아요']]),
      userKey: c[COL['사용자ID']],
      target: c[COL['대상']],
      team: c[COL['팀']],
      bio: c[COL['자기소개']],
      theme: U.jsonParse(c[COL['꾸미기']], null)
    };
    if (type === '매칭신청') e.status = c[COL['승패']] || (payload && payload.status) || '대기';
    if (type === '코치신청' || type === '멘토신청') e.status = (payload && payload.status) || c[COL['승패']] || '심사중';
    return e;
  }

  function Cnum(v) {
    var n = U.num(v, NaN);
    return isNaN(n) ? null : n;
  }

  /* --- 앱 객체 → 시트 한 줄 --- */
  function toRow(e) {
    var c = [];
    for (var i = 0; i < COLS.length; i++) c.push('');
    function set(name, val) { if (val !== undefined && val !== null) c[COL[name]] = String(val); }
    set('ID', e.id || U.uid());
    set('유형', e.type);
    set('작성일시', e.createdAt || U.stamp());
    set('날짜', e.date || U.ymd());
    set('닉네임', e.nick);
    set('실력', e.level);
    set('주력종목', e.discipline);
    if (e.plan) set('훈련계획', typeof e.plan === 'string' ? e.plan : JSON.stringify(e.plan));
    set('컨디션', e.cond);
    set('훈련강도', e.intensity);
    set('운동시간(분)', e.minutes);
    if (e.done && e.done.length) set('완료훈련', e.done.join(','));
    if (e.score) set('게임점수', e.score.a + ':' + e.score.b);
    else if (e.scoreRaw) set('게임점수', e.scoreRaw);
    set('승패', e.status && e.type === '매칭신청' ? e.status : e.result);
    if (e.pain && e.pain.length) set('아픈부위', e.pain.join(','));
    if (e.prescription) set('맞춤처방', JSON.stringify(e.prescription));
    if (e.weakness && e.weakness.length) set('약점기술', e.weakness.join(','));
    if (e.drills) set('추천드릴', JSON.stringify(e.drills));
    if (e.payload) set('소셜글', JSON.stringify(e.payload));
    else if (e.text) set('소셜글', e.text);
    set('좋아요', e.likes);
    set('사용자ID', e.userKey);
    set('대상', e.target);
    set('팀', e.team);
    set('자기소개', e.bio);
    /* 비밀번호(24번째)는 앱이 절대 채우지 않습니다. 브리지가 해시를 관리. */
    if (e.theme) set('꾸미기', typeof e.theme === 'string' ? e.theme : JSON.stringify(e.theme));
    return c;
  }

  /* --- 모음 --- */
  function index(rows) {
    var out = { all: [], byType: {}, byId: {} };
    for (var i = 0; i < rows.length; i++) {
      var e = rows[i].type ? rows[i] : fromRow(rows[i]);
      if (!e.id) continue;
      out.byId[e.id] = e;
      if (e.type === '삭제') continue;   /* 브리지에서 지운 행은 건너뜁니다 */
      out.all.push(e);
      (out.byType[e.type] = out.byType[e.type] || []).push(e);
    }
    return out;
  }

  function latestPerUser(profiles) {
    var map = {};
    var sorted = U.sortBy(profiles, function (p) { return p.createdAt || ''; });
    sorted.forEach(function (p) { if (p.userKey) map[p.userKey] = p; });
    return map;
  }

  function profileOf(idx, userKey) {
    var list = (idx.byType['프로필'] || []).filter(function (p) { return p.userKey === userKey; });
    if (!list.length) return { nick: '', level: '', discipline: '', bio: '', theme: null };
    return U.sortBy(list, function (p) { return p.createdAt || ''; }).pop();
  }

  function displayName(idx, userKey) {
    var p = profileOf(idx, userKey);
    return p.nick || '이름없음';
  }

  /* --- 하트 경제 ---
   * 시트의 행이 곧 원장(ledger)입니다. 캐시 값이 아니라 행을 세어 계산합니다.
   *   적립: 출석하트 / 광고하트 / 선물하트(받음) / 하트합치기
   *   사용: 선물하트(보냄) / 내하트사용(매칭) / 꾸미기구매(테마)
   */
  function dateKeyOf(row) {
    return row.date || (row.createdAt || '').slice(0, 10);
  }

  function atMsOf(row) {
    var t = Date.parse(String(row.createdAt || '').replace(' ', 'T'));
    return isNaN(t) ? 0 : t;
  }

  function nickOf(idx, key) {
    if (!key) return '';
    var p = profileOf(idx, key);
    return p.nick || '';
  }

  function listOf(idx, type, userKey) {
    return (idx.byType[type] || []).filter(function (r) { return r.userKey === userKey; });
  }

  function heartLedger(idx, userKey) {
    var R = HEART_RULES;
    var earned = 0, spent = 0, history = [];

    function add(kind, label, delta, row, note) {
      if (delta > 0) earned += delta; else spent += -delta;
      history.push({
        id: row.id, at: row.createdAt, atMs: atMsOf(row), date: dateKeyOf(row),
        delta: delta, kind: kind, label: label, note: note || '', target: row.target || ''
      });
    }

    listOf(idx, '출석하트', userKey).forEach(function (h) {
      add('checkin', '출석 체크', h.likes || R.CHECKIN, h);
    });
    listOf(idx, '광고하트', userKey).forEach(function (h) {
      add('ad', '광고 보고 받기', h.likes || R.AD_REWARD, h);
    });
    listOf(idx, '하트합치기', userKey).forEach(function (h) {
      add('merge', '하트 합치기', h.likes || 1, h);
    });
    (idx.byType['선물하트'] || []).forEach(function (h) {
      var amount = h.likes || R.GIFT_COST;
      if (h.target === userKey) {
        add('gift-in', '하트 선물 받음', amount, h, nickOf(idx, h.userKey));
      } else if (h.userKey === userKey) {
        add('gift-out', '하트 선물 보냄', -amount, h, nickOf(idx, h.target));
      }
    });
    listOf(idx, '내하트사용', userKey).forEach(function (h) {
      add('match', '매칭 신청', -(h.likes || R.MATCH_COST), h, nickOf(idx, h.target));
    });
    listOf(idx, '꾸미기구매', userKey).forEach(function (h) {
      var price = h.likes || R.THEME_PRICES[h.target] || 0;
      if (price <= 0) return;                 /* 무료 테마 구매 기록은 원장에서 제외 */
      var theme = THEMES.filter(function (t) { return t.id === h.target; })[0];
      add('theme', '꾸미기 구매', -price, h, theme ? theme.name : h.target);
    });

    return {
      base: R.BASE,
      earned: earned,
      spent: spent,
      balance: R.BASE + earned - spent,
      history: U.sortBy(history, function (h) { return h.at || ''; }, true)
    };
  }

  /* 화면용: 잔액 + 오늘 적립/광고 현황 + 출석 여부 */
  function heartStatus(idx, userKey, nowMs) {
    var R = HEART_RULES;
    var ledger = heartLedger(idx, userKey);
    var now = nowMs || Date.now();
    var today = U.ymd(new Date(now));

    var ads = listOf(idx, '광고하트', userKey);
    var adToday = ads.filter(function (h) { return dateKeyOf(h) === today; }).length;
    var lastAdAt = ads.reduce(function (max, h) { return Math.max(max, atMsOf(h)); }, 0);
    var nextAdAt = lastAdAt ? lastAdAt + R.AD_COOLDOWN_SEC * 1000 : 0;
    var nextAdInSec = Math.max(0, Math.ceil((nextAdAt - now) / 1000));

    var checkedInToday = listOf(idx, '출석하트', userKey).some(function (h) {
      return dateKeyOf(h) === today;
    });

    var todayEarned = 0, todaySpent = 0;
    ledger.history.forEach(function (h) {
      if (h.date !== today) return;
      if (h.delta > 0) todayEarned += h.delta; else todaySpent += -h.delta;
    });

    return {
      base: ledger.base,
      earned: ledger.earned,
      spent: ledger.spent,
      balance: ledger.balance,
      history: ledger.history,

      checkinReward: R.CHECKIN,
      checkedInToday: checkedInToday,
      canCheckIn: !checkedInToday,

      adReward: R.AD_REWARD,
      adLimit: R.AD_PER_DAY,
      adUsedToday: adToday,
      adRemaining: Math.max(0, R.AD_PER_DAY - adToday),
      adCooldownSec: R.AD_COOLDOWN_SEC,
      nextAdInSec: nextAdInSec,
      canWatchAd: adToday < R.AD_PER_DAY && nextAdInSec <= 0,

      matchCost: R.MATCH_COST,
      giftCost: R.GIFT_COST,

      todayEarned: todayEarned,
      todaySpent: todaySpent
    };
  }

  /* 테마 소유 여부: 무료 테마는 항상 소유, 유료는 구매 행이 있어야 함 */
  function ownsTheme(idx, userKey, themeId) {
    var price = HEART_RULES.THEME_PRICES[themeId];
    if (price === undefined) return false;
    if (price <= 0) return true;
    return listOf(idx, '꾸미기구매', userKey).some(function (h) { return h.target === themeId; });
  }

  function themeById(themeId) {
    return THEMES.filter(function (t) { return t.id === themeId; })[0] || null;
  }

  function themePrice(themeId) {
    var p = HEART_RULES.THEME_PRICES[themeId];
    if (p !== undefined) return p;
    var t = themeById(themeId);
    return t ? t.price : 0;
  }

  /* --- 통계 --- */
  function stats(idx, userKey) {
    var recs = (idx.byType['기록'] || []).filter(function (r) { return !userKey || r.userKey === userKey; });
    var games = (idx.byType['경기'] || []).filter(function (r) { return !userKey || r.userKey === userKey; });
    var all = recs.concat(games);
    var today = U.parseYmd(U.ymd());
    var monthKey = U.ymd().slice(0, 7);
    var thisMonth = all.filter(function (r) { return (r.date || '').slice(0, 7) === monthKey; });
    var withScore = all.filter(function (r) { return r.score; });
    var wins = withScore.filter(function (r) { return (r.result || resultFromScore(r.score)) === '승'; }).length;
    var losses = withScore.filter(function (r) { return (r.result || resultFromScore(r.score)) === '패'; }).length;

    var dates = U.uniq(all.map(function (r) { return r.date; })).sort().reverse();
    var streak = 0;
    if (dates.length) {
      var cursor = U.parseYmd(dates[0]);
      var todayDiff = Math.round((today - cursor) / 86400000);
      if (todayDiff > 1) streak = 0;
      else {
        streak = 1;
        for (var i = 1; i < dates.length; i++) {
          var prev = U.parseYmd(dates[i - 1]), cur = U.parseYmd(dates[i]);
          if (Math.round((prev - cur) / 86400000) === 1) streak++;
          else break;
        }
      }
    }

    var conds = all.filter(function (r) { return r.cond != null; });
    var last14 = all.filter(function (r) {
      var d = U.parseYmd(r.date);
      return d && (today - d) / 86400000 < 14;
    });

    return {
      count: all.length,
      recordCount: recs.length,
      gameCount: games.length,
      minutesTotal: U.sum(all, function (r) { return r.minutes || 0; }),
      minutesMonth: U.sum(thisMonth, function (r) { return r.minutes || 0; }),
      sessions14: last14.length,
      winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
      wins: wins, losses: losses,
      streak: streak,
      avgCond: conds.length ? Math.round((U.sum(conds, function (r) { return r.cond; }) / conds.length) * 10) / 10 : null,
      lastDate: dates[0] || null
    };
  }

  /* --- 매칭 점수 --- */
  function levelGap(a, b) {
    var A = GRADES.indexOf(normalizeGrade(a)), B = GRADES.indexOf(normalizeGrade(b));
    if (A < 0 || B < 0) return 9;
    return Math.abs(A - B);
  }

  function matchScore(me, other, myProfileRow) {
    me = me || {}; other = other || {};
    var score = 30, reasons = [];   /* 0~90 사이로 퍼지게 설계 */
    var gap = levelGap(me.level, other.level);
    if (gap === 0) { score += 24; reasons.push('급수가 같아요'); }
    else if (gap === 1) { score += 12; reasons.push('급수가 한 단계 차이'); }
    else { score += 2; }
    if (me.region && me.region === other.region) { score += 16; reasons.push(other.region + ' 같은 지역'); }
    else if (other.region) { score += 3; }
    if (me.discipline && me.discipline === other.discipline) { score += 6; reasons.push(other.discipline + ' 선호'); }
    if (me.availability && other.availability && (me.availability === other.availability || me.availability === '무관' || other.availability === '무관')) {
      score += 5; reasons.push('시간대가 맞아요');
    }
    if (me.experience && other.experience) {
      var ex = VOCAB.experience.indexOf(me.experience), ox = VOCAB.experience.indexOf(other.experience);
      if (ex >= 0 && ox >= 0 && Math.abs(ex - ox) <= 1) score += 3;
    }
    if (myProfileRow && myProfileRow.club && other.club && myProfileRow.club === other.club) {
      score += 6; reasons.push('같은 클럽');
    }
    return { score: U.clamp(Math.round(score), 10, 92), reasons: reasons };
  }

  /* --- 채팅 --- */
  function chatRooms(idx, userKey) {
    var msgs = (idx.byType['매칭채팅'] || []).filter(function (m) {
      return m.userKey === userKey || m.target === userKey;
    });
    var reads = (idx.byType['채팅읽음'] || []).filter(function (r) { return r.userKey === userKey; });
    var readAt = {};
    reads.forEach(function (r) {
      var key = r.team || r.target;
      if (!readAt[key] || r.createdAt > readAt[key]) readAt[key] = r.createdAt;
    });
    var groups = U.groupBy(msgs, function (m) { return m.team || m.id; });
    return Object.keys(groups).map(function (roomId) {
      var list = U.sortBy(groups[roomId], function (m) { return m.createdAt || ''; });
      var last = list[list.length - 1] || {};
      var other = '';
      list.forEach(function (m) {
        var cand = m.userKey === userKey ? m.target : m.userKey;
        if (cand && cand !== userKey) other = cand;
      });
      var since = readAt[roomId] || readAt[other] || '';
      var unread = list.filter(function (m) {
        return m.userKey !== userKey && (!since || (m.createdAt || '') > since);
      }).length;
      return { roomId: roomId, other: other, messages: list, last: last, unread: unread, at: last.createdAt || '' };
    }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }

  /* --- 매칭 검색 · 필터 ---
   * 화면과 테스트가 같은 규칙을 쓰도록 순수 함수로 둡니다.
   *  검색어: 닉네임 · 지역 · 클럽 · 소개 · 급수 · 종목 · 성별 · 경력 · 가능 시간
   *  필터: 급수 / 성별 / 종목 / 지역 (값이 '전체'이거나 비어 있으면 통과) */
  function searchText(p) {
    p = p || {};
    return [p.nick, p.region, p.club, p.bio, p.level, p.discipline, p.gender,
      p.experience, p.availability, p.badge]
      .filter(function (v) { return v != null && v !== ''; }).join(' ').toLowerCase();
  }

  function queryTerms(query) {
    return String(query == null ? '' : query).toLowerCase().split(/[\s,]+/).filter(Boolean);
  }

  function matchesQuery(p, query) {
    var terms = queryTerms(query);
    if (!terms.length) return true;
    var hay = searchText(p);
    var compact = hay.replace(/\s+/g, '');
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i].replace(/\s+/g, '');
      if (compact.indexOf(term) < 0) return false;
    }
    return true;
  }

  function filterPlayers(players, filter, opts) {
    filter = filter || {};
    opts = opts || {};
    var level = filter.level || '전체';
    var gender = filter.gender || '전체';
    var region = filter.region || '전체';
    var discipline = filter.discipline || '전체';
    var query = filter.query || '';
    return (players || []).filter(function (p) {
      if (!p) return false;
      if (opts.excludeKey && p.userKey === opts.excludeKey) return false;
      if (level !== '전체' && normalizeGrade(p.level) !== level) return false;
      if (region !== '전체' && p.region !== region) return false;
      if (discipline !== '전체' && p.discipline !== discipline) return false;
      if (gender !== '전체' && normalizeGender(p.gender) !== gender) return false;
      if (!matchesQuery(p, query)) return false;
      return true;
    });
  }

  /* 화면에 보여 줄 조건 요약 — 초기화 버튼을 보일지 판단할 때도 씁니다 */
  function activeFilters(filter) {
    filter = filter || {};
    var out = [];
    ['level', 'gender', 'discipline', 'region'].forEach(function (k) {
      var v = filter[k];
      if (v && v !== '전체') out.push({ key: k, value: v });
    });
    var q = String(filter.query == null ? '' : filter.query).trim();
    if (q) out.push({ key: 'query', value: q });
    return out;
  }

  /* --- 매칭 신청 상태 --- */
  function matchRequests(idx, userKey) {
    return (idx.byType['매칭신청'] || []).filter(function (m) {
      return m.userKey === userKey || m.target === userKey;
    });
  }

  /* ============================================================
   * 관리자 · 멘토 심사
   * ============================================================ */
  function normEmail(v) { return String(v == null ? '' : v).trim().toLowerCase(); }

  function isAdminEmail(email) {
    return ADMIN_EMAILS.indexOf(normEmail(email)) >= 0;
  }

  /* me.admin 은 브리지가(시트 모드) 내려 주는 서버 판정값입니다.
   * 체험/로컬 모드는 로그인 세션의 이메일로 판단합니다. */
  function isAdminMe(me) {
    me = me || {};
    if (me.admin === true) return true;
    if (isAdminEmail(me.email)) return true;
    return isAdminEmail(me.key);
  }

  function matchProfileOf(idx, userKey) {
    var list = (idx.byType['매칭프로필'] || []).filter(function (m) {
      return m.userKey === userKey && m.payload;
    });
    var last = U.sortBy(list, function (m) { return m.createdAt || ''; }).pop();
    return (last && last.payload) || {};
  }

  /* 멘토 신청 목록 — 관리자는 전부, 일반 사용자는 내 신청만 봅니다. */
  function mentorApplications(idx, meKey, admin) {
    var rows = [];
    ['멘토신청', '코치신청'].forEach(function (t) {
      rows = rows.concat(idx.byType[t] || []);
    });
    if (!admin) rows = rows.filter(function (r) { return r.userKey === meKey; });
    return U.sortBy(rows, function (r) { return r.createdAt || ''; }, true).map(function (r) {
      var pl = r.payload || {};
      var p = profileOf(idx, r.userKey);
      var mp = matchProfileOf(idx, r.userKey);
      var status = r.status || pl.status || '심사중';
      return {
        id: r.id, type: r.type, userKey: r.userKey,
        nick: r.nick || p.nick || '신청자',
        status: status,
        payload: pl,
        createdAt: r.createdAt || '',
        submitted: pl.submitted || r.createdAt || '',
        level: pl.level || p.level || '',
        discipline: pl.discipline || p.discipline || '',
        gender: normalizeGender(pl.gender || mp.gender),
        region: pl.region || mp.region || '',
        club: pl.club || mp.club || '',
        experience: pl.experience || mp.experience || '',
        awards: pl.awards || '',
        reason: pl.reason || pl.intro || '',
        proof: pl.proof || '',
        bio: p.bio || ''
      };
    });
  }

  function mentorPendingCount(idx, meKey, admin) {
    if (!admin) return 0;
    return mentorApplications(idx, meKey, true).filter(function (a) { return a.status === '심사중'; }).length;
  }

  /* 승인된 코치·멘토인지 (피드백을 보낼 수 있는 사람) */
  function isCoach(idx, meKey) {
    if (!meKey) return false;
    return (idx.byType['코치신청'] || []).concat(idx.byType['멘토신청'] || []).some(function (a) {
      return a.userKey === meKey && a.status === '승인';
    });
  }

  /* ============================================================
   * 친구(친추)
   *  시트에는 '친구요청'/'친구수락'/'친구거절'/'친구삭제' 행으로 남고,
   *  한 쌍의 관계는 그 행들을 시간순으로 접어서 계산합니다(순수 함수).
   *    none     → 관계 없음
   *    sent     → 내가 요청을 보냄 (상대 응답 대기)
   *    received → 상대가 요청을 보냄 (내가 수락/거절)
   *    friends  → 친구
   * ============================================================ */
  var FRIEND_TYPES = ['친구요청', '친구수락', '친구거절', '친구삭제'];

  function friendPairRows(idx, a, b) {
    var out = [];
    FRIEND_TYPES.forEach(function (type) {
      (idx.byType[type] || []).forEach(function (r) {
        if ((r.userKey === a && r.target === b) || (r.userKey === b && r.target === a)) out.push(r);
      });
    });
    return U.sortBy(out, function (r) { return r.createdAt || ''; });
  }

  function friendState(idx, meKey, otherKey) {
    var res = { state: 'none', requestId: '', acceptId: '', since: '', incomingId: '', outgoingId: '' };
    if (!meKey || !otherKey || meKey === otherKey) return res;
    var friends = false;
    friendPairRows(idx, meKey, otherKey).forEach(function (r) {
      var mine = r.userKey === meKey;
      if (r.type === '친구요청') {
        if (mine) res.outgoingId = r.id;
        else res.incomingId = r.id;
      } else if (r.type === '친구수락') {
        friends = true;
        res.acceptId = r.id;
        res.since = r.createdAt || '';
        res.incomingId = '';
        res.outgoingId = '';
      } else if (r.type === '친구거절') {
        friends = false;
        res.acceptId = '';
        /* 내가 거절했으면 받은 요청이, 상대가 거절했으면 보낸 요청이 사라집니다 */
        if (mine) res.incomingId = '';
        else res.outgoingId = '';
      } else if (r.type === '친구삭제') {
        friends = false;
        res.acceptId = '';
      }
    });
    if (friends) {
      res.state = 'friends';
    } else if (res.incomingId) {
      res.state = 'received';
      res.requestId = res.incomingId;
    } else if (res.outgoingId) {
      res.state = 'sent';
      res.requestId = res.outgoingId;
    }
    return res;
  }

  function friendKeysOf(idx, meKey) {
    var keys = {};
    if (!meKey) return [];
    FRIEND_TYPES.forEach(function (type) {
      (idx.byType[type] || []).forEach(function (r) {
        if (r.userKey === meKey && r.target) keys[r.target] = 1;
        if (r.target === meKey && r.userKey) keys[r.userKey] = 1;
      });
    });
    delete keys[meKey];
    return Object.keys(keys);
  }

  function friendsOf(idx, meKey) {
    return friendKeysOf(idx, meKey).map(function (key) {
      var st = friendState(idx, meKey, key);
      var p = profileOf(idx, key);
      return { key: key, since: st.since, roomId: st.acceptId, nick: p.nick, level: p.level };
    }).filter(function (f) { return !!f.roomId; });
  }

  function incomingFriendRequests(idx, meKey) {
    if (!meKey) return [];
    return friendKeysOf(idx, meKey).map(function (key) {
      var st = friendState(idx, meKey, key);
      if (st.state !== 'received') return null;
      var row = (idx.byType['친구요청'] || []).filter(function (r) { return r.id === st.incomingId; })[0] || {};
      var p = profileOf(idx, key);
      return {
        id: st.incomingId, key: key,
        nick: row.nick || p.nick || '회원',
        level: p.level || '', theme: p.theme || null,
        at: row.createdAt || ''
      };
    }).filter(Boolean);
  }

  /* 두 사람 사이의 1:1 매칭 상태 */
  function matchBetween(idx, meKey, otherKey) {
    if (!meKey || !otherKey) return { accepted: false, requestId: '', pending: false };
    var reqs = (idx.byType['매칭신청'] || []).filter(function (r) {
      return (r.userKey === meKey && r.target === otherKey) ||
        (r.userKey === otherKey && r.target === meKey);
    });
    var accepted = null, last = null;
    U.sortBy(reqs, function (r) { return r.createdAt || ''; }).forEach(function (r) {
      last = r;
      if (r.status === '수락') accepted = r;
    });
    return {
      accepted: !!accepted,
      requestId: accepted ? accepted.id : '',
      pending: !!(last && last.status === '대기')
    };
  }

  /* 친구이거나 매칭이 성사된 상대와만 1:1 대화를 할 수 있습니다.
   * (이미 대화가 시작된 방은 그대로 이어집니다.) */
  function canChatWith(idx, meKey, otherKey) {
    if (!meKey || !otherKey || meKey === otherKey) return false;
    if (friendState(idx, meKey, otherKey).state === 'friends') return true;
    return matchBetween(idx, meKey, otherKey).accepted;
  }

  /* 대화 목록: 메시지가 있는 방 + 친구 + 매칭 성사 상대(첫 대화 전 포함) */
  function chatReadMap(idx, meKey) {
    var map = {};
    (idx.byType['채팅읽음'] || []).forEach(function (r) {
      if (r.userKey !== meKey) return;
      var key = r.team || r.target;
      if (!key) return;
      if (!map[key] || (r.createdAt || '') > map[key]) map[key] = r.createdAt || '';
    });
    return map;
  }

  function threadOf(idx, roomId, list, meKey, readAt) {
    var sorted = U.sortBy(list, function (m) { return m.createdAt || ''; });
    var last = sorted[sorted.length - 1] || null;
    var other = '';
    sorted.forEach(function (m) {
      var cand = m.userKey === meKey ? m.target : m.userKey;
      if (cand && cand !== meKey) other = cand;
    });
    var since = readAt[roomId] || readAt[other] || '';
    var unread = sorted.filter(function (m) {
      return m.userKey !== meKey && (!since || (m.createdAt || '') > since);
    }).length;
    return {
      roomId: roomId, other: other, messages: sorted, last: last,
      unread: unread, at: (last && last.createdAt) || '', kind: ''
    };
  }

  function chatThreads(idx, meKey) {
    if (!meKey) return [];
    var readAt = chatReadMap(idx, meKey);
    var msgs = (idx.byType['매칭채팅'] || []).filter(function (m) {
      return m.userKey === meKey || m.target === meKey;
    });
    var groups = U.groupBy(msgs, function (m) { return m.team || m.id; });
    var map = {};
    Object.keys(groups).forEach(function (roomId) {
      map[roomId] = threadOf(idx, roomId, groups[roomId], meKey, readAt);
    });

    /* 친구: 친구수락 행 ID가 곧 대화방 ID (양쪽 기기에서 같은 값) */
    friendsOf(idx, meKey).forEach(function (f) {
      if (!f.roomId) return;
      if (!map[f.roomId]) map[f.roomId] = threadOf(idx, f.roomId, [], meKey, readAt);
      if (!map[f.roomId].other) map[f.roomId].other = f.key;
      map[f.roomId].kind = 'friend';
    });

    /* 1:1 매칭 성사: 매칭신청 행 ID가 대화방 ID */
    (idx.byType['매칭신청'] || []).forEach(function (r) {
      if (r.status !== '수락') return;
      var mine = r.userKey === meKey, theirs = r.target === meKey;
      if (!mine && !theirs) return;
      var other = mine ? r.target : r.userKey;
      if (!other) return;
      if (!map[r.id]) {
        map[r.id] = threadOf(idx, r.id, [], meKey, readAt);
        map[r.id].other = other;
      }
      if (!map[r.id].kind) map[r.id].kind = 'match';
      if (!map[r.id].other) map[r.id].other = other;
    });

    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (t) { return t.other && t.other !== meKey; })
      .sort(function (a, b) { return (a.at || '') < (b.at || '') ? 1 : -1; });
  }

  function chatUnread(idx, meKey) {
    return U.sum(chatThreads(idx, meKey), function (t) { return t.unread || 0; });
  }

  function threadById(idx, meKey, roomId) {
    var list = chatThreads(idx, meKey);
    for (var i = 0; i < list.length; i++) if (String(list[i].roomId) === String(roomId)) return list[i];
    return null;
  }

  BM.domain = {
    COLS: COLS, COL: COL, VOCAB: VOCAB, GRADES: GRADES, GENDERS: GENDERS, THEMES: THEMES, AVATAR: AVATAR,
    normalizeGrade: normalizeGrade, normalizeGender: normalizeGender,
    normalizeAvatar: normalizeAvatar, avatarOf: avatarOf,
    searchText: searchText, matchesQuery: matchesQuery, filterPlayers: filterPlayers, activeFilters: activeFilters,
    HEART_RULES: HEART_RULES,
    BASE_HEARTS: BASE_HEARTS, HEART_COST_MATCH: HEART_COST_MATCH,
    JSON_TYPES: JSON_TYPES,
    fromRow: fromRow, toRow: toRow, asCells: asCells,
    parseScore: parseScore, resultFromScore: resultFromScore, splitList: splitList,
    index: index, profileOf: profileOf, displayName: displayName, latestPerUser: latestPerUser,
    heartLedger: heartLedger, heartStatus: heartStatus,
    ownsTheme: ownsTheme, themeById: themeById, themePrice: themePrice,
    stats: stats, matchScore: matchScore, levelGap: levelGap,
    chatRooms: chatRooms, matchRequests: matchRequests,
    ADMIN_EMAILS: ADMIN_EMAILS, ADMIN_TARGET: ADMIN_TARGET,
    isAdminEmail: isAdminEmail, isAdminMe: isAdminMe, isCoach: isCoach,
    mentorApplications: mentorApplications, mentorPendingCount: mentorPendingCount,
    FRIEND_TYPES: FRIEND_TYPES,
    friendState: friendState, friendsOf: friendsOf, incomingFriendRequests: incomingFriendRequests,
    matchBetween: matchBetween, canChatWith: canChatWith,
    chatThreads: chatThreads, threadById: threadById, chatUnread: chatUnread,
    matchProfileOf: matchProfileOf
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
