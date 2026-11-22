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

  /* 플레이 스타일 — 프로필 꾸미기에서 고릅니다.
   * 시트 칸을 늘리지 않고 매칭프로필 JSON(소셜글)과 프로필 꾸미기 JSON 안에
   * style 로 들어갑니다(26칸 스키마 그대로). */
  var STYLES = ['공격형', '수비형', '네트 앞', '올라운드'];
  var STYLE_ALIASES = {
    '공격형': '공격형', '공격': '공격형', '어택': '공격형',
    '수비형': '수비형', '수비': '수비형', '디펜스': '수비형',
    '네트 앞': '네트 앞', '네트앞': '네트 앞', '전위': '네트 앞', '앞': '네트 앞',
    '올라운드': '올라운드', '올라운드형': '올라운드', '전천후': '올라운드'
  };

  function normalizeStyle(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (STYLE_ALIASES[s]) return STYLE_ALIASES[s];
    var compact = s.replace(/\s+/g, '');
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].replace(/\s+/g, '') === compact) return STYLES[i];
    }
    return '';
  }
  function normalizeGender(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
    if (!s) return '비공개';
    var low = s.toLowerCase();
    if (s === '남성' || s === '여성' || s === '비공개') return s;
    if (low === 'm' || low === 'male' || low === 'man' || s.indexOf('남자') >= 0 || s.indexOf('남') === 0) return '남성';
    if (low === 'f' || low === 'female' || low === 'woman' || s.indexOf('여자') >= 0 || s.indexOf('여') === 0) return '여성';
    return '비공개';
  }

  /* ============================================================
   * 사용자 유형 (bm-v1.40.0)
   *  처음 시작할 때 네 가지 중 하나를 고르고, MY에서 언제든 바꿉니다.
   *  · 초보  — 초보자 4주 루틴 ON · 용어 사전·기초 가이드를 먼저
   *  · 동호인 — 일반 일지·게스트 모집·1:1 매칭 중심 (4주 루틴 기본 OFF)
   *  · 선수  — 선수용 7대 훈련 기록 기본 ON (4주 루틴 숨김)
   *  · 코치  — 코치·피드백 흐름 중심
   *  저장은 새 칸 없이 프로필 JSON(꾸미기 칸) 안 role 하나로만 합니다(26칸 스키마 유지).
   * ============================================================ */
  var ROLES = [
    { id: 'beginner', label: '초보', answer: '처음 시작해요', desc: '4주 루틴 · 용어 사전', routine: true, pro: false },
    { id: 'club', label: '동호인', answer: '클럽·동호회에서 치고 있어요', desc: '일지 · 게스트 모집 · 1:1 매칭', routine: false, pro: false },
    { id: 'player', label: '선수', answer: '선수로 훈련하고 있어요', desc: '7대 훈련 기록 · 강도 조절', routine: false, pro: true },
    { id: 'coach', label: '코치', answer: '코치·지도자예요', desc: '선수 일지 · 피드백', routine: false, pro: false }
  ];
  var ROLE_ALIASES = {
    '초보': 'beginner', '초심': 'beginner', '입문': 'beginner', 'beginner': 'beginner', '초보자': 'beginner',
    '동호인': 'club', '동호회': 'club', '일반': 'club', 'club': 'club', 'amateur': 'club',
    '선수': 'player', '엘리트': 'player', 'player': 'player', '선수부': 'player', 'athlete': 'player',
    '코치': 'coach', '지도자': 'coach', 'coach': 'coach', '감독': 'coach'
  };

  function normalizeRole(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s) return '';
    if (ROLE_ALIASES[s]) return ROLE_ALIASES[s];
    var low = s.toLowerCase();
    if (ROLE_ALIASES[low]) return ROLE_ALIASES[low];
    for (var i = 0; i < ROLES.length; i++) {
      if (ROLES[i].id === low) return ROLES[i].id;
      if (ROLES[i].label === s) return ROLES[i].id;
    }
    return '';
  }

  function roleById(id) {
    var key = normalizeRole(id);
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i].id === key) return ROLES[i];
    return null;
  }

  /* 프로필에서 유형 꺼내기 — 새 구조(me.role)와 꾸미기 JSON(theme.role) 둘 다 읽습니다.
   * 예전 계정은 저장된 값이 없어 ''입니다(화면은 급수로 짐작해 안내만 합니다). */
  function roleOf(me) {
    if (!me) return '';
    var r = normalizeRole(me.role);
    if (r) return r;
    var t = me.theme || {};
    return normalizeRole(t.role || t.userRole || '');
  }

  /* 저장된 유형이 없을 때 급수로 짐작하는 값 (안내 문구에만 씁니다) */
  function roleGuess(level) {
    var g = normalizeGrade(level);
    if (g === '선수부') return 'player';
    if (g === '초심') return 'beginner';
    return '';
  }

  /* 일지 화면에 선수용 7대 훈련 블록을 보여 줄지
   *  proPref true → 항상 · false → 숨김 · null/undefined → 유형이 선수일 때만 */
  function proVisible(me, proPref) {
    if (proPref === true) return true;
    if (proPref === false) return false;
    return roleOf(me) === 'player';
  }

  /* 선수용 7대 훈련 (bm-v1.40.0)
   *  체크한 항목은 일지 '완료훈련' 칸에, 어떤 걸 했는지는 '훈련계획' JSON 칸에 남습니다.
   *  plan.pro = { '스트록': '클리어 100개', '상체 근력운동': '풀업 4세트, 벤치 60kg' } */
  var PRO_ITEMS = [
    { id: 'stroke', name: '스트록', hint: '예: 클리어 100개, 드라이브 10분' },
    { id: 'wall', name: '벽치기', hint: '예: 10분 × 3세트' },
    { id: 'core', name: '코어', hint: '예: 플랭크 60초 × 3, 데드버그 10회 × 3' },
    { id: 'footwork', name: '풋워크', hint: '예: 사이드 스텝 10분 × 3세트' },
    { id: 'smash', name: '스매시', hint: '예: 점프 스매시 30개 × 4세트' },
    { id: 'upper', name: '상체 근력운동', hint: '예: 풀업 4세트, 벤치프레스 60kg' },
    { id: 'lower', name: '하체 근력운동', hint: '예: 스쿼트 80kg 5×5, 런지 20보' }
  ];
  var PRO_MAX = 120;            /* 한 항목에 적는 글자 수 상한 (시트 한 칸을 지킵니다) */

  function proItemByName(name) {
    var s = String(name == null ? '' : name).trim();
    for (var i = 0; i < PRO_ITEMS.length; i++) if (PRO_ITEMS[i].name === s) return PRO_ITEMS[i];
    return null;
  }

  function proNames() {
    return PRO_ITEMS.map(function (p) { return p.name; });
  }

  function cleanProText(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, PRO_MAX);
  }

  /* 어떤 모양이 와도 { 항목이름: '적은 내용' } 만 남깁니다.
   *  체크만 하고 안 적은 항목은 빈 문자열로 남겨 '체크했다'를 기억합니다. */
  function normalizePro(v) {
    var out = {};
    if (!v) return out;
    if (typeof v === 'string') {
      /* '스트록,코어' 처럼 이름만 온 경우 (체크만) */
      String(v).split(',').forEach(function (n) {
        var it = proItemByName(n);
        if (it) out[it.name] = '';
      });
      return out;
    }
    if (typeof v !== 'object') return out;
    PRO_ITEMS.forEach(function (it) {
      if (!Object.prototype.hasOwnProperty.call(v, it.name)) return;
      if (v[it.name] === false || v[it.name] == null) return;
      out[it.name] = cleanProText(v[it.name]);
    });
    return out;
  }

  /* 일지 한 줄에서 7대 훈련 꺼내기 (훈련계획 JSON → pro) */
  function proOf(rec) {
    var plan = rec && rec.plan;
    if (typeof plan === 'string') plan = U.jsonParse(plan, null);
    if (!plan || typeof plan !== 'object') return {};
    return normalizePro(plan.pro);
  }

  /* 저장할 초안 → '훈련계획' 칸에 넣을 JSON (체크한 항목이 없으면 null) */
  function proPlan(v) {
    var pro = normalizePro(v);
    if (!Object.keys(pro).length) return null;
    return { pro: pro };
  }

  /* 체크한 항목만 이름 목록으로 (일지 '완료훈련' 칸에 함께 남깁니다) */
  function proCheckedNames(pro) {
    var p = normalizePro(pro);
    return PRO_ITEMS.filter(function (it) { return Object.prototype.hasOwnProperty.call(p, it.name); })
      .map(function (it) { return it.name; });
  }

  /* 최근 기록·상세에 보여 줄 한 줄 — '상체 근력운동 풀업 4세트 · 풋워크 10분 × 3'
   *  적은 내용이 있는 항목을 먼저, 체크만 한 항목은 뒤로 (최대 max개 + '외 N') */
  function proLine(pro, max) {
    var p = normalizePro(pro);
    var limit = max == null ? 2 : Math.max(1, max);
    var picked = PRO_ITEMS.filter(function (it) { return Object.prototype.hasOwnProperty.call(p, it.name); });
    picked.sort(function (a, b) {
      var ta = p[a.name] ? 1 : 0, tb = p[b.name] ? 1 : 0;
      if (ta !== tb) return tb - ta;                       /* 적은 내용이 있는 항목 먼저 */
      return PRO_ITEMS.indexOf(a) - PRO_ITEMS.indexOf(b);  /* 그다음은 정해진 순서 */
    });
    var parts = picked.map(function (it) { return it.name + (p[it.name] ? ' ' + p[it.name] : ''); });
    if (parts.length > limit) return parts.slice(0, limit).join(' · ') + ' 외 ' + (parts.length - limit);
    return parts.join(' · ');
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

  /* ---------- 꾸미기 해금 (하트 소모처) ----------
   * 프레임·배지 일부는 하트로 영구 해금합니다. 무료(0)는 지금처럼 바로 씁니다.
   * 해금 기록은 기존 '꾸미기구매' 행을 그대로 재사용하고, '대상' 칸에
   * frame:gold · badge:star 처럼 남깁니다(테마는 예전처럼 th_court 같은 테마 ID). */
  var DECO_PRICES = {
    'frame:court': 0, 'frame:royal': 1, 'frame:sakura': 1, 'frame:gold': 2, 'frame:neon': 2,
    'badge:racket': 0, 'badge:butterfly': 0, 'badge:fire': 1, 'badge:star': 1, 'badge:medal': 2, 'badge:crown': 2
  };
  var BADGE_IDS = { '': '', '🏸': 'racket', '🦋': 'butterfly', '🔥': 'fire', '⭐': 'star', '🥇': 'medal', '👑': 'crown' };
  var BADGE_BY_ID = { racket: '🏸', butterfly: '🦋', fire: '🔥', star: '⭐', medal: '🥇', crown: '👑' };

  /* 연속 출석으로 무료 해금되는 꾸미기 — 매일 돌아올 이유(하트를 쓰지 않아도 됨) */
  var STREAK_UNLOCKS = [
    { days: 3, id: 'badge:star', label: '3일 연속 출석 배지' },
    { days: 7, id: 'badge:medal', label: '7일 연속 출석 배지' },
    { days: 14, id: 'frame:gold', label: '14일 연속 금빛 프레임' }
  ];

  function frameById(id) {
    return AVATAR.frames.filter(function (f) { return f.id === id; })[0] || null;
  }

  function frameName(id) {
    var f = frameById(id);
    return f ? f.name : '';
  }

  /* 화면 값(프레임 ID · 배지 이모지) → 저장·해금에 쓰는 꾸미기 ID */
  function decoId(kind, value) {
    if (kind === 'frame') return frameById(value) ? 'frame:' + value : '';
    if (kind === 'badge') {
      var id = BADGE_IDS[String(value == null ? '' : value)];
      return id ? 'badge:' + id : '';
    }
    return '';
  }

  function decoPrice(id) {
    return DECO_PRICES[String(id || '')] || 0;
  }

  function badgeEmoji(id) {
    return BADGE_BY_ID[String(id || '')] || '';
  }

  function badgeLabel(id) {
    var names = { racket: '라켓', butterfly: '나비', fire: '불꽃', star: '별', medal: '메달', crown: '왕관' };
    return names[String(id || '')] || '';
  }

  function decoName(id) {
    var s = String(id || '');
    if (s.indexOf('frame:') === 0) return '프레임 · ' + frameName(s.slice(6));
    if (s.indexOf('badge:') === 0) return '배지 · ' + badgeLabel(s.slice(6));
    return s;
  }

  /* 연속 출석으로 무료 해금된 꾸미기 ID 목록 */
  function streakUnlocked(days) {
    var d = Math.max(0, Number(days) || 0);
    return STREAK_UNLOCKS.filter(function (m) { return d >= m.days; }).map(function (m) { return m.id; });
  }

  /* 꾸미기 소유 여부: 무료 · 이미 샀음 · 연속 출석 해금 */
  function ownsDeco(idx, userKey, id, streakDays) {
    var target = String(id || '');
    if (!target) return true;
    if (decoPrice(target) <= 0) return true;
    if (streakUnlocked(streakDays).indexOf(target) >= 0) return true;
    return listOf(idx, '꾸미기구매', userKey).some(function (h) { return String(h.target || '') === target; });
  }

  /* 연속 출석 일수 — 오늘(또는 어제)까지 이어진 날 수 */
  function checkinStreak(idx, userKey, nowMs) {
    var days = U.uniq(listOf(idx, '출석하트', userKey).map(dateKeyOf)).sort().reverse();
    if (!days.length) return 0;
    var today = U.ymd(new Date(nowMs || Date.now()));
    var gap = Math.round((U.parseYmd(today) - U.parseYmd(days[0])) / 86400000);
    if (gap > 1) return 0;
    var n = 1;
    for (var i = 1; i < days.length; i++) {
      if (Math.round((U.parseYmd(days[i - 1]) - U.parseYmd(days[i])) / 86400000) === 1) n++;
      else break;
    }
    return n;
  }

  /* 다음 연속 출석 목표 — 하트 카드에 "3일까지 1일" 처럼 보여 줍니다 */
  function nextStreakMilestone(days) {
    var d = Math.max(0, Number(days) || 0);
    for (var i = 0; i < STREAK_UNLOCKS.length; i++) {
      if (d < STREAK_UNLOCKS[i].days) {
        return { days: STREAK_UNLOCKS[i].days, left: STREAK_UNLOCKS[i].days - d, label: STREAK_UNLOCKS[i].label };
      }
    }
    return null;
  }

  var VOCAB = {
    grades: GRADES,
    levels: GRADES,                 /* 예전 이름 호환 */
    genders: GENDERS,
    styles: STYLES,
    legacyLevels: ['초보용', '일반부', '상급', '선수부'],
    disciplines: ['복식', '단식', '혼합복식'],
    done: ['스트록', '벽치기', '런닝', '코어', '풋워크', '스매시', '게임', '웨이트'],
    gameModes: [21, 25],            /* 게임 점수 입력의 점수제 */
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
    /* 7일 연속 출석을 채운 날의 보너스 하트 (bm-v1.36.0) — 출석 보상 1개에 더해 2개 */
    STREAK_7_BONUS: 2,
    AD_REWARD: 1,
    AD_PER_DAY: 5,
    AD_COOLDOWN_SEC: 30,
    MATCH_COST: 2,
    GIFT_COST: 1,
    THEME_PRICES: { th_def: 0, th_night: 0, th_court: 2, th_sakura: 2 }
  };

  /* 연속 출석 보너스를 주는 주기(일) — 7·14·21…일째마다 한 번 */
  var STREAK_BONUS_DAYS = 7;

  var THEMES = [
    { id: 'th_def', name: '기본 코트', hint: '깔끔한 그린', price: HEART_RULES.THEME_PRICES.th_def },
    { id: 'th_night', name: '나이트', hint: '어두운 네이비', price: HEART_RULES.THEME_PRICES.th_night },
    { id: 'th_court', name: '라임 코트', hint: '형광 라임 포인트', price: HEART_RULES.THEME_PRICES.th_court },
    { id: 'th_sakura', name: '사쿠라', hint: '핑크 라이트', price: HEART_RULES.THEME_PRICES.th_sakura }
  ];

  var BASE_HEARTS = HEART_RULES.BASE;            // 가입 축하 하트 (구버전 호환)
  var HEART_COST_MATCH = HEART_RULES.MATCH_COST; // 1:1 매칭 신청 비용

  var JSON_TYPES = { '매칭프로필': 1, '코치신청': 1, '멘토신청': 1, '매칭신청': 1, '코치피드백': 1, '계획': 1, '게스트신청': 1 };

  /* 커뮤니티 말머리(주제 태그) — 시트 칸을 늘리지 않고 '훈련계획' 칸에
   * {"topic":"게스트 모집"} 로 적습니다(예전 글은 주제가 없으므로 아래에서 자동 판별).
   * 2026-11-21 (bm-v1.37.2): '번개'라는 이름을 사용자가 '게스트 모집'으로 바꿨습니다. */
  var POST_TOPICS = ['자유', '후기', '게스트 모집', '용품', '일지'];

  /* 예전에 저장된 말머리·방 이름 — 새 이름('게스트 모집')으로 읽어 줍니다.
   * 이미 시트·Supabase에 '"topic":"번개"'로 들어간 글도 모집 카드·단체방이 그대로 뜨게 합니다. */
  var LEGACY_TOPICS = { '번개': '게스트 모집', '번개모집': '게스트 모집', '번개 모집': '게스트 모집' };

  /* 모집 글('게스트 모집' 말머리)에서 쓰는 이름표.
   * 나중에 말머리 이름을 바꾸면 이 한 곳만 고치면 화면 문구가 따라갑니다. */
  var MEET = {
    topic: '게스트 모집',
    cardLabel: '게스트 모집',
    roomLabel: '게스트 모집 단체방',
    /* v1.43.0 — '참여 문의'(바로 들어가기)는 '참여 신청'(수락제)으로 바뀌었습니다.
     * 예전 문구는 예전 글·옛 기기 화면과 섞이지 않게 남겨 둡니다. */
    joinLabel: '참여 신청',
    legacyJoinLabel: '참여 문의',
    openLabel: '단체방 열기',
    closedLabel: '마감',
    waitLabel: '대기 문의',
    waitTopic: '대기하고 싶어요!',
    /* 게스트비 (bm-v1.40.1) — 모집할 때 '얼마 받는지'를 한 칸에 적습니다.
     * 숫자·글자 그대로 적게 두고(없음·5천원·1만원 등), 빠르게 누르는 칩만 정해 둡니다. */
    feeLabel: '게스트비',
    feeNone: '없음',
    feeChips: ['없음', '5천원', '1만원'],
    /* v1.43.0 — 바로 들어가던 '참여 문의'를 '참여 신청 → 수락'으로 바꿉니다 */
    applyLabel: '참여 신청',
    pendingLabel: '신청 대기 중',
    /* bm-v1.48.0 — 글쓴이가 단체방을 통째로 지웁니다(글도 함께 내려감) */
    deleteLabel: '방 삭제',
    deleteNoLabel: '그대로 두기'
  };

  function normalizeTopic(v) {
    var s = String(v == null ? '' : v).trim();
    if (LEGACY_TOPICS[s]) return LEGACY_TOPICS[s];
    return POST_TOPICS.indexOf(s) >= 0 ? s : '자유';
  }

  /* 커뮤니티 '게스트 모집' 모집 정보 — 언제 · 어디 · 몇 명(예전 '번개' 글 포함).
   * 말머리와 같이 '훈련계획' 칸의 {"topic":"게스트 모집","meet":{...}}로 적어 시트 26칸을 늘리지 않습니다.
   * 모두 비워 두면 일반 글과 똑같이 올라갑니다(선택 입력). */
  var MEET_MAX = 30;          /* 언제·어디 글자 수 */
  var MEET_FEE_MAX = 12;      /* 게스트비 글자 수 ('없음'·'1만원'·'10,000원' 정도) */

  function meetLine(v, max) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || MEET_MAX);
  }

  function normalizeMeet(m) {
    var out = { when: '', place: '', cap: '', fee: '' };
    if (!m || typeof m !== 'object') return out;
    out.when = meetLine(m.when);
    out.place = meetLine(m.place);
    /* 게스트비는 적은 그대로 둡니다 ('없음'도 하나의 값) */
    out.fee = meetLine(m.fee, MEET_FEE_MAX);
    /* '몇 명'은 cap으로 적습니다. 다른 이름(max)으로 들어온 글도 같이 읽습니다. */
    var rawCap = (m.cap == null || m.cap === '') ? m.max : m.cap;
    var cap = String(rawCap == null ? '' : rawCap).replace(/[^0-9]/g, '').slice(0, 3);
    if (cap) out.cap = String(U.clamp(parseInt(cap, 10), 1, 99));
    return out;
  }

  function meetFilled(m) {
    return !!(m && (m.when || m.place || m.cap || m.fee));
  }

  /* 카드에 쓰는 한 줄 이름 — 값이 있으면 '게스트비 1만원' (없으면 빈 값) */
  function meetFeeText(m) {
    var fee = m ? String(m.fee == null ? '' : m.fee).trim() : '';
    return fee ? MEET.feeLabel + ' ' + fee : '';
  }

  /* 글에서 모집 정보만 꺼냅니다 (없으면 null) */
  function meetOf(post) {
    if (!post || !post.plan || !post.plan.meet) return null;
    var m = normalizeMeet(post.plan.meet);
    return meetFilled(m) ? m : null;
  }

  /* 모집 정보 한 줄 — 채팅 미리 채우기·안내에 씁니다 */
  function meetText(m, sep) {
    if (!meetFilled(m)) return '';
    return [m.when, m.place, m.cap ? m.cap + '명' : '', meetFeeText(m)].filter(Boolean).join(sep || ' · ');
  }

  /* ---------- 모집 일시 고르기 (bm-v1.48.0) ----------
   * "게스트 모집 날짜 선택할수 있게해줘 시간이랑 일일이 치기 불편해"
   *  · 예전에는 '11/23(월) 19:00~21:00'을 손으로 쳤습니다. 이제 날짜·시간 칸과
   *    빠른 선택 칩이 같은 글자를 만들어 meet.when 에 넣습니다.
   *  · 저장은 지금 그대로 한 칸(글자)이라 모집 카드·지도·참여 신청·단체방이 그대로 읽습니다.
   *    (예전에 손으로 적은 글도 parse 로 다시 칸에 채워 고칠 수 있습니다) */
  var WHEN_QUICK_DATES = [
    { key: 'today', label: '오늘' },
    { key: 'tomorrow', label: '내일' },
    { key: 'weekend', label: '이번 주말' }
  ];
  /* 자주 치는 시간대 — 한 번 누르면 시작·끝이 함께 채워집니다 */
  var WHEN_QUICK_TIMES = ['19:00~21:00', '20:00~22:00', '14:00~16:00'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* 'HH:MM' 만 통과 — '9:00' 도 '09:00' 으로 맞춥니다 */
  function whenTime(v) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(v == null ? '' : v).trim());
    if (!m) return '';
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return '';
    return pad2(h) + ':' + pad2(mi);
  }

  /* 날짜 칸(YYYY-MM-DD) → '11/23(월)' — 앱의 다른 날짜 표기와 같은 모양
   * 2/31 처럼 달력에 없는 날짜는 빈 값으로 돌려줍니다(3/3 으로 굴러가지 않게) */
  function whenDateLabel(dateStr) {
    var key = String(dateStr == null ? '' : dateStr).trim();
    var d = U.parseYmd(key);
    if (!d || U.ymd(d) !== key) return '';
    return (d.getMonth() + 1) + '/' + d.getDate() + '(' + U.WEEK[d.getDay()] + ')';
  }

  /* 날짜·시간 → 저장 포맷 한 줄 ('11/23(월) 19:00~21:00' · '11/23(월) 19:00' · '11/23(월)') */
  function whenCompose(dateStr, start, end) {
    var date = whenDateLabel(dateStr);
    if (!date) return '';
    var s = whenTime(start), e = whenTime(end);
    if (s && e) return s === e ? date + ' ' + s : date + ' ' + s + '~' + e;
    return s ? date + ' ' + s : date;
  }

  /* 빠른 날짜 칩 — 오늘 · 내일 · 이번 주말(다가오는 토요일). 날짜가 겹치는 칩은 빼둡니다.
   *  bm-v1.52.2 (조환비 님 피드백) — 일요일에는 '이번 주말'이 오늘(11/22)과 같은 날이라
   *  '오늘 11/22(일)'·'이번 주말 11/22(일)'이 나란히 중복됐습니다. 토요일도 마찬가지입니다.
   *  · 이미 나온 날짜와 겹치는 칩은 돌려주지 않습니다(오늘을 먼저 두므로 주말 칩만 빠짐).
   *    앞날을 고를 때는 바로 아래 날짜 칸(달력)을 그대로 쓰면 됩니다. */
  function whenQuickDates(now) {
    var base = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
    var today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    var wd = today.getDay();
    var sat = (wd === 0 || wd === 6) ? 0 : 6 - wd;
    var seen = {};
    var out = [];
    WHEN_QUICK_DATES.forEach(function (q) {
      var d = today;
      if (q.key === 'tomorrow') d = U.addDays(today, 1);
      if (q.key === 'weekend') d = U.addDays(today, sat);
      var key = U.ymd(d);
      if (seen[key]) return;           /* 같은 날짜는 한 번만 */
      seen[key] = 1;
      out.push({ key: q.key, label: q.label, date: key, day: whenDateLabel(key) });
    });
    return out;
  }

  /* 적힌 글자에서 날짜·시간을 다시 꺼냅니다 (예전 자유 입력도 칸에 채워 고칠 수 있게)
   * '11/23(월) 19:00~21:00' → {date:'2026-11-23', start:'19:00', end:'21:00'} */
  function whenParse(text, now) {
    var out = { date: '', start: '', end: '' };
    var s = String(text == null ? '' : text);
    if (!s.trim()) return out;
    var base = (now instanceof Date && !isNaN(now.getTime())) ? now : new Date();
    var md = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(s);
    if (md) {
      var mo = +md[1], day = +md[2];
      if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31) {
        var thisYear = new Date(base.getFullYear(), mo - 1, day);
        var y = base.getFullYear();
        /* 지난날이면 다음 해로 — 올리려는 모집은 앞날입니다(12/31 → 1/1 넘김 포함) */
        if (thisYear.getTime() < base.getTime() - 180 * 86400000) y += 1;
        var d = new Date(y, mo - 1, day);
        if (d.getMonth() === mo - 1) out.date = U.ymd(d);
      }
    }
    var range = /(\d{1,2}):(\d{2})\s*[~\-–]\s*(\d{1,2}):(\d{2})/.exec(s);
    if (range) {
      out.start = whenTime(range[1] + ':' + range[2]);
      out.end = whenTime(range[3] + ':' + range[4]);
    } else {
      var one = /(\d{1,2}):(\d{2})/.exec(s);
      if (one) out.start = whenTime(one[1] + ':' + one[2]);
    }
    return out;
  }

  /* 글의 말머리: 직접 고른 값이 먼저, 없으면 일지 공유 글(target=일지 ID)은 '일지', 나머지는 '자유' */
  function topicOf(post) {
    if (!post) return '자유';
    var t = post.plan && post.plan.topic;
    if (t) return normalizeTopic(t);
    return post.target ? '일지' : '자유';
  }

  /* ---------- 모집 정원 (2026-11-20, bm-v1.29.0) ----------
   * '몇 명'은 새 글에서 meet.cap, 예전 글·다른 이름(meet.max)도 함께 읽습니다.
   * 참여자는 따로 행을 만들지 않고 '글쓴이 + 단체방에 한마디 남긴 사람'으로 셉니다
   * (v1.12의 단체방 규칙 그대로 — 시트 26칸·Supabase 스키마를 늘리지 않습니다).
   * 정원은 방 인원 총원(글쓴이 포함)이라, 6명 글이면 6명이 모이면 마감입니다. */
  function meetCap(m) {
    var v = m ? (m.cap != null && m.cap !== '' ? m.cap : m.max) : '';
    var digits = String(v == null ? '' : v).replace(/[^0-9]/g, '');
    if (!digits) return 0;
    var n = parseInt(digits.slice(0, 3), 10);
    return isFinite(n) && n > 0 ? n : 0;
  }

  /* 참여자 = 글쓴이 + 이 글 단체방에 한마디 남긴 사람 (글쓴이가 먼저) */
  function meetMembers(idx, post, meKey) {
    if (!post || !post.id) return [];
    /* v1.43.0 — 글쓴이 + 수락된 게스트 + 예전 참여자(방에 말을 남긴 사람) */
    return guestRoster(idx, post, meKey).members;
  }

  /* ---------- 게스트 참여 신청 (2026-11-21, bm-v1.43.0) ----------
   * 정원이 있는 모집 글은 '바로 단체방에 들어가기' 대신 신청 편지지를 보내고,
   * 글쓴이가 수락해야 정원에 들어갑니다.
   *  · 새 칸·새 표 없이 '유형=게스트신청' 행 하나로 4가지를 남깁니다.
   *      신청  — 신청자가 남김 (사용자ID=신청자, 대상=글쓴이)
   *      수락·거절 — 글쓴이가 남김 (사용자ID=글쓴이, 대상=신청자)
   *      나가기 — 게스트가 남김 (사용자ID=게스트, 대상=글쓴이)
   *    '팀' 칸은 글 ID(단체방 번호와 같음), '소셜글' 칸은 {kind, note, …} JSON 입니다.
   *  · 화면은 이 행들을 시간 순서로 읽어 '지금 상태'만 계산합니다(행을 고치지 않음).
   *    그래서 두 기기에서 동시에 수락/나가기가 일어나도 마지막 한 줄이 이깁니다.
   *  · 서버(Supabase) 읽기 정책이 '내 행이거나 나에게 온 행'이라 당사자 둘만 봅니다. */
  var GUEST_TYPE = '게스트신청';
  var GUEST_NOTE_MAX = 80;      /* 신청 한마디 글자 수 */
  var GUEST = {
    type: GUEST_TYPE,
    noteMax: GUEST_NOTE_MAX,
    noteDefault: '같이 치고 싶어요!',
    applyLabel: MEET.applyLabel,
    pendingLabel: MEET.pendingLabel,
    rejectedLabel: '신청 거절됨',
    leaveLabel: '나가기',
    inboxTitle: '받은 게스트 신청',
    /* 행에 적는 값 */
    apply: '신청', accept: '수락', reject: '거절', leave: '나가기',
    pending: '대기'
  };

  function guestKind(r) {
    return String((r && r.payload && r.payload.kind) || '');
  }

  function guestKindOk(k) {
    return k === GUEST.apply || k === GUEST.accept || k === GUEST.reject || k === GUEST.leave;
  }

  /* 이 행이 '누구에 대한' 것인지 — 수락·거절은 받는 사람(대상)이 주인공입니다 */
  function guestWho(r) {
    var k = guestKind(r);
    return (k === GUEST.accept || k === GUEST.reject) ? String((r && r.target) || '') : String((r && r.userKey) || '');
  }

  /* 한 글의 신청 행들 (오래된 것부터) */
  function guestRows(idx, postId) {
    if (!postId) return [];
    return U.sortBy(((idx && idx.byType && idx.byType[GUEST_TYPE]) || []).filter(function (r) {
      return String((r && r.team) || '') === String(postId);
    }), function (r) { return (r && r.createdAt) || ''; });
  }

  /* 글 안에서 사람별 '지금 상태' — 대기 · 수락 · 거절 · 나가기 (없으면 '') */
  function guestStates(idx, postId) {
    var map = {};
    guestRows(idx, postId).forEach(function (r) {
      var k = guestKind(r);
      if (!guestKindOk(k)) return;
      var who = guestWho(r);
      if (!who) return;
      var st = map[who] || (map[who] = {
        key: who, status: '', at: '', note: '', applyId: '', applyAt: '', nick: '', level: '', style: ''
      });
      if (k === GUEST.apply) {
        st.status = GUEST.pending;
        st.note = String((r.payload && r.payload.note) || '');
        st.nick = String((r.payload && r.payload.nick) || r.nick || '');
        st.level = normalizeGrade((r.payload && r.payload.level) || r.level || '');
        st.style = normalizeStyle((r.payload && r.payload.style) || '');
        st.applyId = String(r.id || '');
        st.applyAt = r.createdAt || st.applyAt;
      } else {
        st.status = k;
      }
      st.at = r.createdAt || st.at;
    });
    return map;
  }

  /* 한 사람의 지금 상태 */
  function guestState(idx, postId, userKey) {
    if (!postId || !userKey) return { key: String(userKey || ''), status: '', at: '', note: '', applyId: '' };
    return guestStates(idx, postId)[String(userKey)] ||
      { key: String(userKey), status: '', at: '', note: '', applyId: '', applyAt: '', nick: '', level: '', style: '' };
  }

  /* 단체방에 한마디 남긴 사람 (예전 참여자 호환) */
  function guestSenders(idx, postId) {
    var set = {};
    ((idx && idx.byType && idx.byType['매칭채팅']) || []).forEach(function (m) {
      if (String((m && m.team) || '') !== String(postId)) return;
      if (m && m.userKey) set[String(m.userKey)] = 1;
    });
    return set;
  }

  /* 글 하나의 명단 — 글쓴이 + 수락된 게스트 + 예전 참여자, 대기/거절/나감 명단 */
  function guestRoster(idx, post, meKey) {
    var postId = String((post && post.id) || '');
    var author = String((post && post.userKey) || '');
    var me = String(meKey || '');
    var out = { postId: postId, author: author, members: [], pending: [], accepted: [], rejected: [], left: [] };
    if (!postId) return out;
    var states = guestStates(idx, postId);
    var seen = {};
    function addMember(key, nick) {
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.members.push({ key: key, nick: nick || nickOf(idx, key) || '회원', me: key === me });
    }
    if (author) addMember(author, post.nick);
    Object.keys(states).forEach(function (key) {
      var st = states[key];
      var item = {
        key: key, status: st.status, at: st.at, note: st.note, applyId: st.applyId,
        applyAt: st.applyAt || st.at,
        nick: st.nick || nickOf(idx, key) || '회원',
        level: st.level || '', style: st.style || '', me: key === me
      };
      if (st.status === GUEST.accept) { out.accepted.push(item); addMember(key, item.nick); }
      else if (st.status === GUEST.pending) out.pending.push(item);
      else if (st.status === GUEST.reject) out.rejected.push(item);
      else if (st.status === GUEST.leave) out.left.push(item);
    });
    /* 신청 행이 없는데 방에 말을 남긴 사람은 v1.42까지의 참여자로 그대로 셉니다 */
    var senders = guestSenders(idx, postId);
    Object.keys(senders).forEach(function (key) {
      if (states[key]) return;
      addMember(key, '');
    });
    out.pending = U.sortBy(out.pending, function (x) { return x.applyAt || x.at || ''; }, true);
    out.accepted = U.sortBy(out.accepted, function (x) { return x.at || ''; });
    out.rejected = U.sortBy(out.rejected, function (x) { return x.at || ''; }, true);
    out.left = U.sortBy(out.left, function (x) { return x.at || ''; }, true);
    return out;
  }

  /* 이 사람이 이 글의 단체방 사람인가 — 글쓴이 · 수락된 게스트 · 예전 참여자 */
  function guestMember(idx, post, meKey) {
    if (!post || !meKey) return false;
    var postId = String(post.id || '');
    var me = String(meKey);
    if (String(post.userKey || '') === me) return true;
    var st = guestState(idx, postId, me);
    if (st.status === GUEST.accept) return true;
    if (st.status) return false;      /* 대기·거절·나가기 — 수락 전에는 방 사람이 아님 */
    if (guestSenders(idx, postId)[me]) return true;
    return (idx.byType['채팅읽음'] || []).some(function (r) {
      return r.userKey === me && String(r.team || r.target || '') === postId;
    });
  }

  /* 신청만 하고 수락 전인 사람(대기·거절·나감)은 방에 들어갈 수 없습니다 (v1.43.0) */
  function guestBlocked(idx, post, meKey) {
    if (!post || !meKey) return false;
    if (String(post.userKey || '') === String(meKey)) return false;
    var st = guestState(idx, post.id, meKey).status;
    return !!st && st !== GUEST.accept;
  }

  /* 정원이 차서 커뮤니티에서 내려간 글인가 (정원이 없으면 내려가지 않음) */
  function meetHidden(idx, post, meKey) {
    var st = meetStatus(idx, post, meKey);
    return !!(st.cap > 0 && st.closed);
  }

  /* 글쓴이의 신청함 — 아직 답하지 않은 게스트 신청 (최근 것부터) */
  function guestInbox(idx, meKey) {
    var me = String(meKey || '');
    if (!me) return [];
    var out = [];
    ((idx && idx.byType && idx.byType['소셜']) || []).forEach(function (post) {
      if (String(post.userKey || '') !== me) return;
      var roster = guestRoster(idx, post, me);
      roster.pending.forEach(function (it) {
        out.push({
          id: it.applyId, postId: roster.postId, post: post, userKey: it.key, nick: it.nick,
          level: it.level, style: it.style, note: it.note, at: it.applyAt || it.at
        });
      });
    });
    return U.sortBy(out, function (x) { return x.at || ''; }, true);
  }

  /* 내가 보낸 신청의 지금 상태 (글마다 마지막 것) */
  function guestMine(idx, meKey, postId) {
    var st = guestState(idx, postId, meKey);
    return { status: st.status, at: st.at, note: st.note, applyId: st.applyId };
  }

  /* 모집 글의 지금 상태 — 정원·참여자·마감 여부 (화면은 이 값만 그립니다) */
  function meetStatus(idx, post, meKey) {
    var m = (post && post.meet) || meetOf(post);
    var cap = meetCap(m);
    var roster = guestRoster(idx, post, meKey);
    var members = roster.members;
    var count = members.length;
    var author = (post && post.userKey) || '';
    var me = String(meKey || '');
    var mine = !!(me && author && String(author) === me);
    var st = (me && !mine) ? guestState(idx, roster.postId, me) : { status: '', at: '', note: '', applyId: '' };
    return {
      cap: cap,
      count: count,
      /* 글쓴이를 뺀 '참여 중인 게스트' 수 */
      guests: Math.max(0, count - (author ? 1 : 0)),
      members: members,
      pending: roster.pending,
      accepted: roster.accepted,
      rejected: roster.rejected,
      left: roster.left,
      mine: mine,
      /* 내 신청 상태 — ''(없음) · 대기 · 수락 · 거절 · 나가기 */
      me: { status: st.status || '', at: st.at || '', note: st.note || '', applyId: st.applyId || '' },
      /* 정원이 있고 그 수만큼 모이면 자동 마감 (커뮤니티 피드에서는 내려갑니다) */
      closed: cap > 0 && count >= cap
    };
  }

  /* ---------- 매너 한 줄 태그 (2026-11-20, bm-v1.29.0) ----------
   * 매칭이 성사된 1:1 대화방에서 경기 후 한 줄 남깁니다. 정해진 4종만(자유 입력 없음).
   * 새 칸을 만들지 않고 '유형=매너 · 대상=받는 사람 키 · 팀=태그 코드 · 좋아요=1'로 적어
   * 시트 26칸·Supabase 스키마를 그대로 씁니다. 악용 방지로 같은 상대에게는 하루 1회.
   * 받은 태그 집계는 아래 mannerReceived(순수 함수)로만 계산합니다. */
  var MANNER_TYPE = '매너';
  var MANNER_TAGS = [
    { code: 'time', label: '시간 약속 정확' },
    { code: 'care', label: '배려 넘침' },
    { code: 'similar', label: '실력이 비슷해요' },
    { code: 'good', label: '매너 굿' }
  ];
  var MANNER_MAX_BADGES = 3;

  function mannerTag(code) {
    var s = String(code == null ? '' : code).trim();
    for (var i = 0; i < MANNER_TAGS.length; i++) {
      if (MANNER_TAGS[i].code === s) return MANNER_TAGS[i];
    }
    return null;
  }

  function mannerLabel(code) {
    var t = mannerTag(code);
    return t ? t.label : '';
  }

  /* 매너 행 고르기 — 보낸 사람(from) · 받는 사람(to) · 그날(day) */
  function mannerRows(idx, opts) {
    var list = (idx && idx.byType && idx.byType[MANNER_TYPE]) || [];
    return list.filter(function (r) {
      if (!opts) return true;
      if (opts.to != null && String(r.target || '') !== String(opts.to)) return false;
      if (opts.from != null && String(r.userKey || '') !== String(opts.from)) return false;
      if (opts.day != null && String(r.date || r.createdAt || '').slice(0, 10) !== String(opts.day)) return false;
      return true;
    });
  }

  function mannerDay(nowMs) {
    return U.ymd(nowMs ? new Date(nowMs) : new Date());
  }

  /* 오늘 이 상대에게 이미 남겼는지 (하루 1회 제한) */
  function mannerGivenToday(idx, fromKey, toKey, nowMs) {
    if (!fromKey || !toKey) return false;
    return mannerRows(idx, { from: fromKey, to: toKey, day: mannerDay(nowMs) }).length > 0;
  }

  /* 오늘 남긴 태그 — 있으면 { code, label, at }, 없으면 null */
  function mannerToday(idx, fromKey, toKey, nowMs) {
    if (!fromKey || !toKey) return null;
    var list = U.sortBy(mannerRows(idx, { from: fromKey, to: toKey, day: mannerDay(nowMs) }),
      function (r) { return r.createdAt || ''; });
    var last = list[list.length - 1];
    if (!last) return null;
    return { code: String(last.team || ''), label: mannerLabel(last.team), at: last.createdAt || '' };
  }

  /* 받은 매너 태그 집계 — 순수 함수(화면은 이 값만 그립니다).
   * 태그별 건수·마지막으로 받은 시각·준 사람 수를 세고, 많이 받은 순으로 정렬합니다.
   * 정해진 4종에 없는 코드(예전·깨진 값)는 세지 않습니다. */
  function mannerReceived(idx, userKey, limit) {
    var rows = mannerRows(idx, { to: userKey }).filter(function (r) { return !!mannerTag(r.team); });
    var by = {};
    rows.forEach(function (r) {
      var code = String(r.team);
      var b = by[code] || (by[code] = { code: code, label: mannerLabel(code), count: 0, lastAt: '', givers: {} });
      b.count += 1;
      var from = String(r.userKey || '');
      if (from && from !== String(userKey)) b.givers[from] = 1;
      var at = String(r.createdAt || '');
      if (at > b.lastAt) b.lastAt = at;
    });
    var tags = Object.keys(by).map(function (k) {
      var b = by[k];
      return {
        code: b.code, label: b.label, count: b.count, lastAt: b.lastAt,
        givers: Object.keys(b.givers).length
      };
    });
    tags.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return (a.lastAt || '') < (b.lastAt || '') ? 1 : -1;
    });
    var givers = {};
    rows.forEach(function (r) { var k = String(r.userKey || ''); if (k && k !== String(userKey)) givers[k] = 1; });
    return {
      total: rows.length,
      givers: Object.keys(givers).length,
      tags: tags.slice(0, limit == null ? MANNER_MAX_BADGES : Math.max(0, limit)),
      all: tags
    };
  }

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

  /* --- 게임 점수: 한 일지에 여러 게임을 남길 수 있습니다 ---
   * 시트에는 '게임점수' 한 칸에 "21:18, 18:21"처럼 적고, 25점제는 앞에
   * "25점제 "를 붙입니다. 예전 기록("21:18")은 그대로 21점제 한 경기로 읽힙니다.
   * (칸을 늘리지 않아 기존 시트·브리지와 그대로 호환됩니다.) */
  function parseGames(v) {
    var s = String(v == null ? '' : v);
    var mode = /25\s*점/.test(s) ? 25 : 21;
    var out = [];
    var re = /(\d{1,2})\s*[:：\-]\s*(\d{1,2})/g;
    var m;
    while ((m = re.exec(s))) out.push({ a: parseInt(m[1], 10), b: parseInt(m[2], 10), mode: mode });
    return out;
  }

  /* 입력칸에서 온 값 정리 — 두 점수가 다 들어온 게임만 남깁니다 */
  function cleanGames(list) {
    var out = [];
    (list || []).forEach(function (g) {
      if (!g) return;
      if (g.a === '' || g.a == null || g.b === '' || g.b == null) return;
      var a = Number(g.a), b = Number(g.b);
      if (!isFinite(a) || !isFinite(b)) return;
      out.push({ a: U.clamp(Math.round(a), 0, 99), b: U.clamp(Math.round(b), 0, 99) });
    });
    return out;
  }

  /* 여러 게임의 승/패 요약 — 시트 '승패' 칸에는 이 결과 하나만 적습니다 */
  function gamesSummary(games) {
    var list = games || [];
    var wins = 0, losses = 0, draws = 0;
    list.forEach(function (g) {
      var r = resultFromScore(g);
      if (r === '승') wins++;
      else if (r === '패') losses++;
      else draws++;
    });
    var result = !list.length ? '' : wins > losses ? '승' : losses > wins ? '패' : '무';
    return {
      count: list.length, wins: wins, losses: losses, draws: draws, result: result,
      first: list.length ? { a: list[0].a, b: list[0].b } : null
    };
  }

  /* 여러 게임 → 시트 한 칸 (25점제는 앞에 표시) */
  function formatGames(games, mode) {
    var list = games || [];
    if (!list.length) return '';
    var body = list.map(function (g) { return g.a + ':' + g.b; }).join(', ');
    return Number(mode) === 25 ? '25점제 ' + body : body;
  }

  function resultFromScore(score, mine) {
    if (!score) return '';
    if (score.a === score.b) return '무';
    var win = score.a > score.b;
    if (mine === 'b') win = !win;
    return win ? '승' : '패';
  }

  /* ============================================================
   * 일지 부가 정보 — 복식 파트너 · 상대(라이벌) · 영상 링크 (bm-v1.32.0 · v1.54.0)
   *  · 시트 26칸·Supabase 컬럼을 늘리지 않고 '팀' 칸에 JSON 한 줄로 적습니다.
   *      팀 = {"partner":"조환비","rival":"김원호","video":{"url":"https://…","label":"스매시 폼"}}
   *    rival(상대·라이벌)은 v1.54.0에서 더한 칸이라, 예전 일지에는 없어도 그대로 읽힙니다.
   *    '기록'(일지) 행에서 '팀' 칸은 달리 쓰이지 않으므로 안전합니다.
   *  · 영상은 링크만 저장합니다(http/https). javascript:·data: 같은 주소는
   *    읽을 때도, 쓸 때도 걸러 내 화면에 href로 나가지 않습니다.
   * ============================================================ */
  var PARTNER_MAX = 20;         /* 파트너 이름 글자 수 */
  var RIVAL_MAX = 20;           /* 상대(라이벌) 이름 글자 수 */
  var VIDEO_URL_MAX = 500;      /* 링크 길이 상한 */
  var VIDEO_LABEL_MAX = 60;     /* 한 줄 체크 포인트 */

  function tidyText(v, max) {
    var s = String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')   /* 줄바꿈·제어문자는 한 칸으로 */
      .replace(/\s+/g, ' ')
      .trim();
    if (max && s.length > max) s = s.slice(0, max).trim();
    return s;
  }

  function cleanPartner(v) {
    return tidyText(v, PARTNER_MAX);
  }

  function cleanRival(v) {
    return tidyText(v, RIVAL_MAX);
  }

  function cleanVideoLabel(v) {
    return tidyText(v, VIDEO_LABEL_MAX);
  }

  /* 화면에 src·href로 나가는 주소는 여기를 통과합니다 (bm-v1.41.1).
   *  · http/https 또는 앱이 직접 만드는 사진(data:image/png|jpeg|webp;base64)만 허용
   *  · javascript: · data:text/html · vbscript: · 파일 경로는 버립니다.
   *  · 공백·꺾쇠·따옴표·백틱이 섞인 주소는 속성을 깨뜨릴 수 있어 버립니다. */
  function safeLinkUrl(v, opts) {
    var o = opts || {};
    var s = String(v == null ? '' : v).trim();
    if (!s || s.length > (o.max || 2048)) return '';
    if (o.photo && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
    if (/[\s<>"'`]/.test(s)) return '';
    var m = s.match(/^(https?):\/\/([^\s\/?#]+)/i);
    if (!m) return '';
    var host = m[2].toLowerCase();
    if (host.indexOf('.') < 0) return '';          /* localhost·내부 주소는 링크가 아님 */
    return s;
  }

  /* 프로필 사진 — 구글 계정 사진 같은 https 주소나 앱이 자른 data:image 만 */
  function safeImageUrl(v) {
    return safeLinkUrl(v, { photo: true, max: 60000 });
  }

  /* 글자 수 상한 — 화면·DB에 아주 긴 글자가 들어오지 않게 쓸 때 자릅니다.
   * (maxlength 는 화면 입력칸에만 걸려 있어서, 다른 경로로 들어온 값을 여기서 막습니다.) */
  function clampText(v, max) {
    var s = String(v == null ? '' : v).replace(/\u0000/g, '');
    if (max && s.length > max) s = s.slice(0, max);
    return s;
  }

  /* 영상 링크 — http(s)만. 주소에 공백·꺾쇠·따옴표가 있으면 버립니다. */
  function safeVideoUrl(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s || s.length > VIDEO_URL_MAX) return '';
    if (/[\s<>"'`]/.test(s)) return '';
    var m = s.match(/^([a-z][a-z0-9+.\-]*):\/\/([^\s\/?#]+)/i);
    if (!m) return '';
    var scheme = m[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') return '';   /* javascript: · data: · file: 차단 */
    var host = m[2].toLowerCase();
    if (host.indexOf('.') < 0) return '';                     /* localhost 같은 주소는 영상 링크가 아님 */
    return s;
  }

  function emptyMeta() { return { partner: '', rival: '', video: { url: '', label: '' } }; }

  /* 일지 한 줄(또는 '팀' 칸 문자열) → { partner, rival, video:{url,label} }
   * 예전에 '팀' 칸에 이름만 적힌 일지도 파트너로 읽습니다(값을 잃지 않게). */
  function logMeta(recOrTeam) {
    var out = emptyMeta();
    var raw = recOrTeam && typeof recOrTeam === 'object' ? recOrTeam.team : recOrTeam;
    if (raw == null || raw === '') return out;
    var text = String(raw).trim();
    var obj = looksJson(text) ? U.jsonParse(text, null) : null;
    if (obj && typeof obj === 'object' && !(obj instanceof Array)) {
      out.partner = cleanPartner(obj.partner);
      out.rival = cleanRival(obj.rival);
      var v = obj.video;
      if (typeof v === 'string') v = { url: v };
      if (v && typeof v === 'object') {
        out.video.url = safeVideoUrl(v.url);
        out.video.label = out.video.url ? cleanVideoLabel(v.label) : '';
      }
      return out;
    }
    out.partner = cleanPartner(text);
    return out;
  }

  /* { partner, rival, video } → '팀' 칸에 넣을 JSON 문자열 (모두 비면 '' — 칸을 비웁니다) */
  function logExtraJson(o) {
    o = o || {};
    var partner = cleanPartner(o.partner);
    var rival = cleanRival(o.rival);
    var video = o.video || {};
    var url = safeVideoUrl(video.url);
    var label = url ? cleanVideoLabel(video.label) : '';
    if (!partner && !rival && !url) return '';
    var out = {};
    if (partner) out.partner = partner;
    if (rival) out.rival = rival;
    if (url) out.video = { url: url, label: label };
    return JSON.stringify(out);
  }

  /* 파트너·상대(라이벌) 전적 — 일지에 그 이름을 적은 기록만 셉니다.
   *  · 한 일지에 여러 게임이 있으면 그 게임 수만큼 셉니다(승/패/무도 게임 단위).
   *  · 점수 없이 '승패'만 적힌 일지는 1경기로 셉니다.
   *  · 승률은 승+패로 나눕니다(무승부는 분모에서 뺌).
   *  · field 'partner'는 함께 뛴 사람, 'rival'은 맞선 상대입니다.
   *    어느 쪽이든 승/패는 내 팀 기준(o.a > o.b = 승)이라 라이벌은 '내가 이긴 경기'가 승입니다.
   *  정렬: 파트너는 승률 → 함께 친 경기 → 이름,
   *        라이벌은 맞붙은 경기 → 승률 → 이름(가장 자주 만난 상대가 위로). */
  function duelStats(records, opts) {
    opts = opts || {};
    var field = opts.field === 'rival' ? 'rival' : 'partner';
    var limit = Math.max(1, U.num(opts.limit, 5) || 5);
    var want = tidyText(opts.name || '').toLowerCase();
    var map = {}, order = [];
    (records || []).forEach(function (r) {
      if (!r) return;
      var meta = logMeta(r);
      var name = meta[field];
      if (!name) return;
      var games = (r.games && r.games.length) ? cleanGames(r.games) : (r.score ? cleanGames([r.score]) : []);
      var sum = gamesSummary(games);
      var count = sum.count, wins = sum.wins, losses = sum.losses, draws = sum.draws;
      if (!count) {
        var res = String(r.result || '');
        if (res === '승') { count = 1; wins = 1; }
        else if (res === '패') { count = 1; losses = 1; }
        else if (res === '무') { count = 1; draws = 1; }
      }
      if (!count) return;
      var e = map[name];
      if (!e) { e = map[name] = { name: name, games: 0, wins: 0, losses: 0, draws: 0, days: [], last: '', recent: '', recentKey: '' }; order.push(name); }
      e.games += count; e.wins += wins; e.losses += losses; e.draws += draws;
      var day = dayKey(r.date);
      if (day) {
        if (e.days.indexOf(day) < 0) e.days.push(day);
        if (day > e.last) e.last = day;
      }
      /* 최근 스코어 — 가장 최근 날 일지의 점수 한 줄 ('21:17, 19:21')
       *  · 같은 날짜 일지가 둘이면 작성일시(createdAt)가 늦은 쪽(나중에 쓴 일지)을 씁니다. */
      if (sum.count) {
        var txt = games.map(function (g) { return g.a + ':' + g.b; }).join(', ');
        var m25 = (r.games && r.games[0] && Number(r.games[0].mode) === 25) || /25\s*점/.test(String(r.scoreRaw || ''));
        if (m25) txt = '25점제 ' + txt;
        var key = (day || String(r.date || '')) + '|' + String(r.createdAt || '');
        if (!e.recentKey || key > e.recentKey) { e.recent = txt; e.recentKey = key; }
      }
    });
    var list = order.map(function (name) {
      var e = map[name];
      var decided = e.wins + e.losses;
      e.rate = decided ? Math.round((e.wins / decided) * 100) : 0;
      e.line = e.games + '전 ' + e.wins + '승' + (e.draws ? ' ' + e.draws + '무' : '') + ' ' + e.losses + '패';
      return e;
    });
    list.sort(field === 'rival'
      ? function (a, b) {
        if (b.games !== a.games) return b.games - a.games;
        if (b.rate !== a.rate) return b.rate - a.rate;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      }
      : function (a, b) {
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.games !== a.games) return b.games - a.games;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
    /* 이름 하나만 볼 때(일지 입력칸 아래 미리보기) */
    if (want) list = list.filter(function (e) { return e.name.toLowerCase() === want; });
    return list.slice(0, limit);
  }

  /* 파트너별 승률 — 함께 뛴 사람(기존 이름 그대로, bm-v1.32.0) */
  function partnerStats(records, opts) {
    var o = {};
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    o.field = 'partner';
    return duelStats(records, o);
  }

  /* 라이벌(상대) 맞대결 전적 — bm-v1.54.0
   *  · 총 경기 수·승/패·승률·최근 스코어까지 한 번에 셉니다. */
  function rivalStats(records, opts) {
    var o = {};
    Object.keys(opts || {}).forEach(function (k) { o[k] = opts[k]; });
    o.field = 'rival';
    return duelStats(records, o);
  }

  /* 파트너 한 명의 전적 — 일지 입력칸 아래 한 줄 미리보기 (bm-v1.36.0)
   *  · 일지에 한 번도 안 적은 이름·점수가 없는 이름은 null(줄을 그리지 않습니다).
   *  순수 함수. */
  function partnerStat(records, name) {
    var n = tidyText(name || '');
    if (!n) return null;
    return partnerStats(records, { name: n, limit: 1 })[0] || null;
  }

  /* 파트너 전적 한 줄 — '조환비 · 4전 3승 1패 (75%)'
   *  무승부만 있으면 승률을 붙이지 않습니다(0%로 보이면 오해). */
  function partnerLineText(p) {
    if (!p) return '';
    var decided = (p.wins || 0) + (p.losses || 0);
    return p.name + ' · ' + p.line + (decided ? ' (' + p.rate + '%)' : '');
  }

  /* 라이벌 한 명의 전적 — 일지 입력칸·점수판 아래 한 줄 미리보기 (bm-v1.54.0) */
  function rivalStat(records, name) {
    var n = tidyText(name || '');
    if (!n) return null;
    return rivalStats(records, { name: n, limit: 1 })[0] || null;
  }

  /* 라이벌 전적 한 줄 — '김원호 · 6전 4승 2패 (67%) · 최근 21:17'
   *  무승부만 있으면 승률을 붙이지 않습니다(파트너 줄과 같은 이유). */
  function rivalLineText(r) {
    if (!r) return '';
    var decided = (r.wins || 0) + (r.losses || 0);
    return r.name + ' · ' + r.line + (decided ? ' (' + r.rate + '%)' : '') +
      (r.recent ? ' · 최근 ' + r.recent : '');
  }

  /* 라이벌에게 몇 승 몇 패인지 — '라이벌 김원호에게 4승 2패' (한눈에 보는 한 줄)
   *  아직 기록이 없으면 ''(처음 맞붙는 상대). */
  function rivalVersusText(r) {
    if (!r || !r.games) return '';
    var decided = (r.wins || 0) + (r.losses || 0);
    return r.name + '에게 ' + r.wins + '승 ' + (r.draws ? r.draws + '무 ' : '') + r.losses + '패' +
      (decided ? ' (' + r.rate + '%)' : '');
  }

  /* 파트너 이름 → 앱 회원 키 (bm-v1.34.0)
   *  · 일지 '팀' 칸에는 이름만 적히므로(회원 키 없음), 닉네임이 정확히 같은 회원이
   *    한 명뿐일 때만 그 사람 프로필로 잇습니다.
   *  · 같은 닉네임이 둘 이상이면 엉뚱한 사람에게 연결될 수 있어 잇지 않습니다(빈 문자열).
   *  · 나 자신은 제외하고, 프로필·매칭프로필 두 곳의 닉네임을 봅니다(회원마다 최신 줄).
   *  순수 함수 — 같은 입력이면 같은 결과. */
  function memberByName(idx, name, opts) {
    opts = opts || {};
    var want = tidyText(name).toLowerCase();
    if (!want) return '';
    var me = String(opts.meKey || '');
    var types = (idx && idx.byType) || {};
    var rows = (types['프로필'] || []).concat(types['매칭프로필'] || []);
    var byKey = {};
    rows.forEach(function (r) {
      if (!r || !r.userKey || r.userKey === me) return;
      var nick = tidyText(r.nick || (r.payload && r.payload.nick) || '');
      if (!nick) return;
      var at = String(r.createdAt || '');
      var cur = byKey[r.userKey];
      if (!cur || at >= cur.at) byKey[r.userKey] = { nick: nick, at: at };
    });
    var hits = Object.keys(byKey).filter(function (k) { return byKey[k].nick.toLowerCase() === want; });
    return hits.length === 1 ? hits[0] : '';
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
      games: parseGames(c[COL['게임점수']]),
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

  /* --- 일지 수정: 저장된 한 줄 → 입력칸 초안 ---
   * '최근 기록'에서 수정을 누르면 이 함수가 기존 값을 그대로 입력칸 모양으로 돌려줍니다.
   * (화면은 순수 함수만 쓰고, 시트·저장소 사정은 몰라도 됩니다) */
  function recordDraft(rec) {
    rec = rec || {};
    var games = (rec.games && rec.games.length)
      ? rec.games.map(function (g) { return { a: g.a == null ? '' : String(g.a), b: g.b == null ? '' : String(g.b) }; })
      : (rec.score ? [{ a: String(rec.score.a), b: String(rec.score.b) }] : [{ a: '', b: '' }]);
    if (!games.length) games = [{ a: '', b: '' }];
    var mode = (rec.games && rec.games[0] && rec.games[0].mode === 25) ? 25 : 21;
    var meta = logMeta(rec);
    return {
      date: rec.date || U.ymd(),
      cond: rec.cond == null ? null : rec.cond,
      intensity: rec.intensity == null ? null : rec.intensity,
      minutes: rec.minutes == null ? null : rec.minutes,
      done: (rec.done || []).slice(),
      gameMode: mode,
      games: games,
      score: rec.score || null,
      result: rec.result || '',
      pain: (rec.pain || []).slice(),
      weakness: (rec.weakness || []).slice(),
      partner: meta.partner,
      rival: meta.rival,
      video: meta.video.url,
      videoNote: meta.video.label,
      /* 선수용 7대 훈련 — 수정할 때 체크·적은 내용을 그대로 불러옵니다 */
      pro: proOf(rec),
      note: rec.text || ''
    };
  }

  /* --- 일지 수정: 바뀐 값만 시트 칸 이름으로 ---
   * 비운 입력은 빈 값('')으로 보내 칸을 비웁니다. 다른 칸(ID·사용자ID·닉네임)은
   * 건드리지 않으므로 26칸 스키마와 행 순서는 그대로입니다. */
  function logCells(e) {
    e = e || {};
    var cells = {
      '날짜': e.date ? String(e.date) : '',
      '컨디션': e.cond == null || e.cond === '' ? '' : String(e.cond),
      '훈련강도': e.intensity == null || e.intensity === '' ? '' : String(e.intensity),
      '운동시간(분)': e.minutes == null || e.minutes === '' ? '' : String(e.minutes),
      '완료훈련': (e.done && e.done.length) ? e.done.join(',') : '',
      '게임점수': e.scoreRaw ? String(e.scoreRaw) : '',
      '승패': e.result ? String(e.result) : '',
      '아픈부위': (e.pain && e.pain.length) ? e.pain.join(',') : '',
      '약점기술': (e.weakness && e.weakness.length) ? e.weakness.join(',') : '',
      '소셜글': e.text ? String(e.text) : '',
      /* 선수용 7대 훈련은 '훈련계획' JSON 칸으로 — 비우면 칸도 비웁니다 */
      '훈련계획': e.plan == null || e.plan === '' ? '' : (typeof e.plan === 'string' ? String(e.plan) : JSON.stringify(e.plan)),
      /* 파트너·영상은 '팀' 칸 JSON 한 줄로 — 비우면 칸도 비웁니다 */
      '팀': e.team == null ? '' : String(e.team)
    };
    if (e.prescription) cells['맞춤처방'] = JSON.stringify(e.prescription);
    if (e.drills) cells['추천드릴'] = JSON.stringify(e.drills);
    return cells;
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
    if (e.scoreRaw) set('게임점수', e.scoreRaw);
    else if (e.score) set('게임점수', e.score.a + ':' + e.score.b);
    else if (e.games && e.games.length) set('게임점수', formatGames(e.games, e.gameMode));
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
    /* 7일 연속 출석 보너스 (bm-v1.36.0)
     *  · 출석 행을 날짜 순으로 훑어 7·14·21…일째 되는 날에 보너스를 한 줄 더 남깁니다.
     *  · 보너스 행을 따로 저장하지 않고 기록에서 매번 세므로(멱등) 앱을 다시 열거나
     *    기기를 바꿔도 잔액이 같고, 지난 연속에도 소급해 한 번만 잡힙니다.
     *  · 서버(브리지)는 출석 행을 1개로만 세므로 행 값은 그대로 두고 원장에서만 더합니다. */
    var streakBonus = Math.max(0, U.num(R.STREAK_7_BONUS, 0) || 0);
    if (streakBonus > 0) {
      var checkinByDay = {};
      listOf(idx, '출석하트', userKey).forEach(function (h) {
        var day = dateKeyOf(h);
        if (!day) return;
        var cur = checkinByDay[day];
        if (!cur || atMsOf(h) > atMsOf(cur)) checkinByDay[day] = h;
      });
      var checkinDays = Object.keys(checkinByDay).sort();
      var run = 0, prevDay = '';
      checkinDays.forEach(function (day) {
        var gap = prevDay ? Math.round((U.parseYmd(day) - U.parseYmd(prevDay)) / 86400000) : 0;
        run = gap === 1 ? run + 1 : 1;
        prevDay = day;
        if (run % STREAK_BONUS_DAYS === 0) {
          add('streak', run + '일 연속 출석 보너스', streakBonus, checkinByDay[day], '보너스');
        }
      });
    }
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
    /* 1:1 매칭 (v1.12.0~) — 보낼 때가 아니라 '상대가 수락할 때' 보낸 사람 하트를 뺍니다.
     * 요청 행 자체에 payOn:'accept' 를 적어 두므로, 상대 기기에서 수락해도
     * 보낸 사람의 원장(행을 세어 계산)에 바로 반영됩니다.
     * 예전 요청(payOn 없음)은 이미 '내하트사용' 행이 있어 두 번 차감되지 않게 건너뜁니다. */
    listOf(idx, '매칭신청', userKey).forEach(function (r) {
      var pl = r.payload || {};
      if (pl.payOn !== 'accept' || r.status !== '수락') return;
      var cost = Number(pl.heartCost) || R.MATCH_COST;
      var charged = pl.charged == null ? cost : Number(pl.charged);
      charged = Math.max(0, Math.min(cost, isFinite(charged) ? charged : cost));
      if (charged <= 0) return;
      add('match', '매칭 성사', -charged, r, nickOf(idx, r.target));
    });
    listOf(idx, '꾸미기구매', userKey).forEach(function (h) {
      var target = String(h.target || '');
      var price = h.likes || decoPrice(target) || R.THEME_PRICES[target] || 0;
      if (price <= 0) return;                 /* 무료 테마·무료 꾸미기 구매 기록은 원장에서 제외 */
      if (target.indexOf('frame:') === 0) { add('deco-frame', '프레임 해금', -price, h, frameName(target.slice(6))); return; }
      if (target.indexOf('badge:') === 0) { add('deco-badge', '배지 해금', -price, h, badgeLabel(target.slice(6))); return; }
      var theme = THEMES.filter(function (t) { return t.id === target; })[0];
      add('theme', '꾸미기 구매', -price, h, theme ? theme.name : target);
    });

    return {
      base: R.BASE,
      earned: earned,
      spent: spent,
      balance: R.BASE + earned - spent,
      history: U.sortBy(history, function (h) { return h.at || ''; }, true)
    };
  }

  /* 다음 연속 출석 보너스까지 남은 날 (오늘 이미 보너스를 받은 날이면 7) */
  function streakBonusLeft(days) {
    var d = Math.max(0, Number(days) || 0);
    var r = d % STREAK_BONUS_DAYS;
    return r === 0 ? STREAK_BONUS_DAYS : STREAK_BONUS_DAYS - r;
  }

  /* 광고 적립 거래 ID (bm-v1.36.0)
   *  · 보상형 광고 한 번에 ID 하나를 붙여, 같은 시청 건이 두 번 적립되는 것을 막습니다.
   *  · 앱이 ID를 주지 않으면 js/ads.js 가 시각 기반으로 만들어 넘깁니다.
   *  · ID는 '광고하트' 행의 메모(소셜글 칸)에 'tx:…' 로 남습니다(새 칸 없음). */
  var AD_TX_PREFIX = 'tx:';
  var AD_TX_MAX = 48;

  function cleanTxId(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s || s.length > 200) return '';
    s = s.replace(/[^A-Za-z0-9._:-]/g, '');
    return s.slice(0, AD_TX_MAX);
  }

  function adTxNote(txId) {
    var id = cleanTxId(txId);
    return id ? AD_TX_PREFIX + id : '';
  }

  function adTxOf(row) {
    var t = String((row && (row.text || row.note)) || '').trim();
    if (t.indexOf(AD_TX_PREFIX) !== 0) return '';
    return cleanTxId(t.slice(AD_TX_PREFIX.length));
  }

  function adTxSeen(idx, userKey, txId) {
    var id = cleanTxId(txId);
    if (!id) return false;
    return listOf(idx, '광고하트', userKey).some(function (h) { return adTxOf(h) === id; });
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

    var streak = checkinStreak(idx, userKey, now);

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
      /* 다음 광고까지 남은 시간의 기준점(ms). 파생 시각이 지나도
       * 화면이 1초마다 다시 계산할 수 있게 절대 시각을 함께 넘깁니다. */
      nextAdAt: nextAdAt,
      canWatchAd: adToday < R.AD_PER_DAY && nextAdInSec <= 0,

      matchCost: R.MATCH_COST,
      giftCost: R.GIFT_COST,

      checkinStreak: streak,
      streakNext: nextStreakMilestone(streak),
      streakUnlocks: streakUnlocked(streak),
      /* 7일 연속 보너스 안내 — MY 하트 카드와 공용 하트 시트가 이 값을 씁니다 */
      streakBonus: {
        amount: Math.max(0, U.num(R.STREAK_7_BONUS, 0) || 0),
        days: STREAK_BONUS_DAYS,
        left: streakBonusLeft(streak)
      },

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
    if (gap === 0) { score += 24; reasons.push('같은 급수'); }
    else if (gap === 1) { score += 12; reasons.push('급수 한 단계 차이'); }
    else { score += 2; }
    if (me.region && me.region === other.region) { score += 16; reasons.push('같은 지역'); }
    else if (other.region) { score += 3; }
    if (me.discipline && me.discipline === other.discipline) { score += 6; reasons.push(other.discipline + ' 선호'); }
    if (me.availability && other.availability && (me.availability === other.availability || me.availability === '무관' || other.availability === '무관')) {
      score += 5; reasons.push('시간대가 맞음');
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

  /* 매칭 찾기 목록을 보여 줄 상태인지.
   *  - 처음 들어오면 아무 조건도 고르지 않은 '안내' 상태입니다(목록 없음).
   *  - 조건·검색어를 고르거나 '전체'를 누르면 목록을 보여 줍니다.
   *  - started 값이 없는 예전 화면 상태에서는 '전체'라도 적혀 있으면 보여 주는 것으로 봅니다. */
  function matchSearchActive(filter, started) {
    filter = filter || {};
    if (started === true) return true;
    if (started === false) return false;
    if (activeFilters(filter).length) return true;
    return ['level', 'gender', 'region', 'discipline'].some(function (k) {
      return filter[k] === '전체';
    });
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

  /* ============================================================
   * 멘토 유형 · 활동 소속 · 증명 (bm-v1.45.0)
   *  · 활동 유형은 '개인 멘토' · '체육관 코치' · '선수 코치' · '클럽 운영' 넷입니다.
   *    예전에 저장된 '선수 멘토' · '코치' · '동호인 멘토' 는 값을 바꾸지 않고
   *    그대로 읽어 그대로 보여 줍니다(이미 심사된 신청의 기록을 건드리지 않습니다).
   *  · '체육관 코치' · '선수 코치' 는 어디서 코치하는지(affiliation)와
   *    증명(proof 글 · proofUrl 링크 · proofPhoto 사진)을 함께 받습니다.
   *    링크는 safeLinkUrl, 사진은 safeImageUrl 을 지나야 화면·DB에 들어갑니다.
   * ============================================================ */
  var MENTOR_TYPES = ['개인 멘토', '체육관 코치', '선수 코치', '클럽 운영'];
  var MENTOR_NEED_PROOF = ['체육관 코치', '선수 코치'];   /* 소속·증명이 필요한 유형 */
  var MENTOR = {
    typeMax: 20,              /* 유형 이름 글자 수 */
    affiliationMax: 40,       /* '나래울 배드민턴장 · 매원고 배드민턴부' */
    proofMax: 60,             /* 증빙 메모(위촉 확인 번호 등) */
    proofUrlMax: 300,         /* 증빙 링크 */
    photoMax: 48000           /* 증빙 사진(data:image, base64) — 시트 한 칸(50,000자) 안 */
  };

  function mentorTypeOf(v) {
    var s = tidyText(v, MENTOR.typeMax);
    return s || '개인 멘토';
  }

  /* '체육관 코치' · '선수 코치' 인지 — 소속·증명을 받아야 하는 유형 */
  function mentorNeedsProof(type) {
    return MENTOR_NEED_PROOF.indexOf(mentorTypeOf(type)) >= 0;
  }

  function cleanAffiliation(v) { return tidyText(v, MENTOR.affiliationMax); }
  function cleanProofText(v) { return tidyText(v, MENTOR.proofMax); }
  function cleanProofUrl(v) { return safeLinkUrl(v, { max: MENTOR.proofUrlMax }); }
  function cleanProofPhoto(v) {
    var s = safeImageUrl(v);
    /* 증빙 사진은 앱이 직접 줄인 data:image/png|jpeg|webp 만 (외부 주소는 받지 않습니다) */
    return /^data:image\//i.test(s) && s.length <= MENTOR.photoMax ? s : '';
  }

  /* 신청 한 건의 증명 — 글·링크·사진 중 무엇이 있는지 */
  function mentorProofOf(pl) {
    pl = pl || {};
    var out = {
      text: cleanProofText(pl.proof),
      url: cleanProofUrl(pl.proofUrl),
      photo: cleanProofPhoto(pl.proofPhoto)
    };
    out.any = !!(out.text || out.url || out.photo);
    return out;
  }

  /* 신청 payload → 화면 배지에 쓰는 값 (구분 · 소속 · 증명 여부) */
  function mentorBadgeOf(pl) {
    pl = pl || {};
    return {
      type: mentorTypeOf(pl.type),
      affiliation: cleanAffiliation(pl.affiliation),
      proofed: mentorProofOf(pl).any
    };
  }

  /* 승인된 코치 줄 — '나래울 배드민턴장 · 활동 증명됨'
   *  · 승인 + 증명이 있을 때만 '활동 증명됨' 을 붙입니다(심사 전 신청에는 붙이지 않음). */
  function mentorAffiliationLine(a) {
    a = a || {};
    var out = [];
    var aff = cleanAffiliation(a.affiliation);
    if (aff) out.push(aff);
    if (a.status === '승인' && (a.proofed != null ? a.proofed : mentorProofOf(a.payload).any)) out.push('활동 증명됨');
    return out.join(' · ');
  }

  /* 체육관 이름 빠른 선택 — BM.gyms(전국 목록)에서 이름·동네·주소로 찾습니다.
   *  · 한 글자부터 찾고, 최대 limit 곳. 화면(멘토 신청)과 테스트가 같이 씁니다. */
  function gymNameSuggestions(q, limit) {
    var G = root.BM && root.BM.gyms;
    var list = (G && typeof G.all === 'function') ? G.all() : [];
    var s = String(q == null ? '' : q).replace(/\s+/g, '').toLowerCase();
    var n = limit || 5;
    var out = [];
    if (!s || !list.length) return out;
    list.forEach(function (v) {
      if (out.length >= n) return;
      var hay = [v.name, v.area, v.region, v.addr].join('').replace(/\s+/g, '').toLowerCase();
      if (hay.indexOf(s) >= 0) out.push({ id: v.id, name: v.name, area: v.area || '' });
    });
    return out;
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
      var badge = mentorBadgeOf(pl);
      var proof = mentorProofOf(pl);
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
        /* v1.45 — 구분 · 활동 소속 · 증명(글/링크/사진) */
        mentorType: badge.type,
        affiliation: badge.affiliation,
        proof: proof.text,
        proofUrl: proof.url,
        proofPhoto: proof.photo,
        proofed: proof.any,
        bio: p.bio || ''
      };
    });
  }

  function mentorPendingCount(idx, meKey, admin) {
    if (!admin) return 0;
    return mentorApplications(idx, meKey, true).filter(function (a) { return a.status === '심사중'; }).length;
  }

  /* 한 사람의 승인된 멘토 신청 — 구분·소속·증명 (코치 카드·프로필 시트 배지)
   *  · '멘토신청'·'코치신청' 둘 다 보고, 가장 최근 승인 한 건을 씁니다.
   *  · 승인 + 증명일 때 line 이 '나래울 배드민턴장 · 활동 증명됨' 이 됩니다. */
  function approvedMentorOf(idx, userKey) {
    if (!idx || !userKey) return null;
    var rows = (idx.byType['멘토신청'] || []).concat(idx.byType['코치신청'] || [])
      .filter(function (r) {
        return r.userKey === userKey && (r.status || (r.payload && r.payload.status)) === '승인';
      });
    var last = U.sortBy(rows, function (r) { return r.createdAt || ''; }).pop();
    if (!last) return null;
    var badge = mentorBadgeOf(last.payload || {});
    return {
      id: last.id,
      type: badge.type,
      affiliation: badge.affiliation,
      proofed: badge.proofed,
      line: mentorAffiliationLine({ status: '승인', affiliation: badge.affiliation, proofed: badge.proofed })
    };
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

  /* ============================================================
   * 친구 코드(#XXXX) — 아는 사람만 친구 추가 (bm-v1.38.0)
   *
   *  · 4자리 영문 대문자 + 숫자. 눈으로 헷갈리는 I · O · 0 · 1 은 쓰지 않습니다(32자).
   *  · user_key 하나에 코드 하나가 나오는 결정적 함수입니다. 그래서
   *    기기·서버·시트 어디서 같은 규칙으로 계산해도 같은 코드가 나오고,
   *    app_users 컬럼을 새로 만들지 않아도 됩니다.
   *      (서버 조회: app_users.user_key → friendCodeOf(user_key))
   *  · 코드를 아는 사람만 그 회원을 찾아 친구 요청을 보낼 수 있습니다.
   *    닉네임 검색·프로필 화면에는 '친구 추가' 버튼을 두지 않습니다.
   * ============================================================ */
  var FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var FRIEND_CODE_LEN = 4;
  var FRIEND_CODE_SALT = 'bm-friend-code-v1:';
  /* 헷갈리는 글자 — 코드에는 없으므로 입력에 있으면 잘못 친 것으로 봅니다 */
  var FRIEND_CODE_CONFUSED = 'O0I1';   /* O·0·I·1 */

  /* FNV-1a 32bit + 마무리 섞기(bit mixer)
   *  · 어느 언어로 옮겨도 같은 값이 나오는 작은 해시.
   *  · 마무리 섞기가 없으면 비슷한 user_key(u_0001…)끼리 낮은 비트가 몰려
   *    4자리 코드 충돌이 잦아집니다(5000명 중 1/4). 믹서를 거치면 기대값대로 떨어집니다. */
  function codeHash(text) {
    var s = String(text == null ? '' : text);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    h ^= h >>> 16;
    h = mul32(h, 0x7feb352d);
    h ^= h >>> 15;
    h = mul32(h, 0x846ca68b);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /* 32bit 곱셈 — Math.imul이 없는 환경(아주 오래된 브라우저)에서도 같은 값 */
  function mul32(h, k) {
    if (typeof Math !== 'undefined' && Math.imul) return Math.imul(h, k) >>> 0;
    var hi = (h >>> 16) * k;
    var lo = (h & 0xffff) * k;
    return ((lo + ((hi & 0xffff) << 16)) >>> 0);
  }

  /* 내 친구 코드 — user_key 가 같으면 언제나 같은 4자리 */
  function friendCodeOf(userKey) {
    var key = String(userKey == null ? '' : userKey).trim();
    if (!key) return '';
    var out = '';
    for (var i = 0; i < FRIEND_CODE_LEN; i++) {
      var h = codeHash(FRIEND_CODE_SALT + i + ':' + key);
      out += FRIEND_CODE_ALPHABET.charAt(h % FRIEND_CODE_ALPHABET.length);
    }
    return out;
  }

  /* 화면에 보여 줄 코드 — '#A7K2' */
  function friendCodeLabel(userKey) {
    var code = friendCodeOf(userKey);
    return code ? '#' + code : '';
  }

  /* 닉네임#A7K2 (복사·공유용). 같은 사람이 여러 번 저장해도 최신 닉네임 */
  function friendCodeWithNick(idx, userKey, nick) {
    var code = friendCodeOf(userKey);
    if (!code) return '';
    var name = String(nick || (idx ? displayName(idx, userKey) : '') || '').trim();
    return (name ? name + '#' : '#') + code;
  }

  /* 사람이 친 코드 → 'A7K2'. 못 읽으면 빈 글자.
   *  · '#a7k2', 'a7k2', '나래#A7K2', ' A7K2 ' 를 모두 받습니다.
   *  · 코드에 없는 O·0·I·1 이 섞이면 잘못 친 것으로 봅니다(조용히 다른 코드로 바꾸지 않음). */
  function friendCodeParse(input) {
    var s = String(input == null ? '' : input).toUpperCase();
    var hashAt = s.lastIndexOf('#');
    if (hashAt >= 0) s = s.slice(hashAt + 1);
    s = s.replace(/[\s\-_]/g, '');
    if (!s) return '';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (FRIEND_CODE_CONFUSED.indexOf(ch) >= 0) return '';
      if (FRIEND_CODE_ALPHABET.indexOf(ch) < 0) return '';
      out += ch;
    }
    return out.length === FRIEND_CODE_LEN ? out : '';
  }

  /* 코드로 찾을 수 있는 사람들 — 프로필·매칭카드가 있는 회원 전부.
   * (친구 코드는 user_key 에서 나오므로 서버 표를 따로 읽지 않아도 됩니다) */
  function friendCodeDirectory(idx) {
    var byKey = {};
    function put(key, nick, level, theme, createdAt) {
      if (!key) return;
      var cur = byKey[key];
      if (cur && String(cur.createdAt || '') > String(createdAt || '')) return;
      byKey[key] = { key: key, nick: nick || (cur && cur.nick) || '', level: level || (cur && cur.level) || '', theme: theme || (cur && cur.theme) || null, createdAt: createdAt || '' };
    }
    (idx && idx.byType['프로필'] || []).forEach(function (p) {
      put(p.userKey, p.nick, p.level, p.theme, p.createdAt);
    });
    (idx && idx.byType['매칭프로필'] || []).forEach(function (m) {
      var pl = m.payload || {};
      put(m.userKey, m.nick || pl.nick, normalizeGrade(pl.level) || m.level, null, m.createdAt);
    });
    return Object.keys(byKey).map(function (k) {
      var u = byKey[k];
      u.code = friendCodeOf(u.key);
      return u;
    }).filter(function (u) { return !!u.code; });
  }

  /* 친 코드로 회원 찾기 — { code, matches } (같은 코드가 둘이면 둘 다 돌려줍니다) */
  function friendCodeFind(idx, input) {
    var typed = String(input == null ? '' : input).trim();
    var code = friendCodeParse(typed);
    if (!code) return { code: '', matches: [], invalid: !!typed };
    var matches = friendCodeDirectory(idx).filter(function (u) { return u.code === code; });
    return { code: code, matches: matches, invalid: false };
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

  /* 코치와의 1:1 대화방 — 두 사람 키를 정렬해 만든 고정 ID라서 양쪽 기기에서 같습니다.
   * (친구·매칭처럼 별도 행 없이 '매칭채팅' 행의 팀 칸에 이 ID를 씁니다.) */
  function coachRoomId(a, b) {
    var pair = [String(a == null ? '' : a), String(b == null ? '' : b)].sort();
    return 'coach_' + encodeURIComponent(pair[0]) + '__' + encodeURIComponent(pair[1]);
  }

  /* 코치 대화 허용:
   *  · 선수 → 승인된 코치: 바로 대화를 시작할 수 있습니다(피드백 요청용).
   *  · 코치 → 선수: 이미 대화가 시작된 방이 있을 때만 이어서 답합니다(모르는 회원에게 먼저 말 걸지 않음). */
  function coachChatAllowed(idx, meKey, otherKey) {
    var meCoach = isCoach(idx, meKey);
    var otherCoach = isCoach(idx, otherKey);
    if (!meCoach && !otherCoach) return false;
    if (otherCoach && !meCoach) return true;
    var room = coachRoomId(meKey, otherKey);
    return (idx.byType['매칭채팅'] || []).some(function (m) { return String(m.team || '') === room; });
  }

  /* ---------- 모집 글 단체방 (참여 문의) ----------
   * 글마다 하나인 고정 방입니다. 방 ID는 글 ID를 그대로 씁니다.
   *  · '팀' 칸은 브리지가 레코드 ID만 그대로 내려주고 사람 키처럼 보이면
   *    공개 ID(u…)로 바꿔 버립니다(sanitizeRow_). 'group_post_' 같은 접두사를 붙이면
   *    다른 기기에서는 방 ID가 달라지므로, 이미 레코드 ID인 글 ID를 그대로 씁니다.
   *  · 글 ID와 매칭신청·친구수락 ID는 모두 무작위라 서로 겹치지 않습니다.
   *  · 참여자는 따로 행을 만들지 않고, 방에 남긴 사람들(그리고 글쓴이)로 셉니다.
   *    말을 걸면 그때부터 이 기기의 대화 목록에도 방이 남습니다. */
  function groupRoomId(postId) { return String(postId == null ? '' : postId); }

  function groupPostOf(idx, roomId) {
    if (!idx || !idx.byId || !roomId) return null;
    var p = idx.byId[String(roomId)];
    return p && p.type === '소셜' ? p : null;
  }

  function isGroupRoom(idx, roomId) { return !!groupPostOf(idx, roomId); }

  function groupTitle(post) {
    var t = (post && post.topic) ? normalizeTopic(post.topic) : topicOf(post);
    return (t === MEET.topic ? MEET.roomLabel : t + ' 단체방');
  }

  function groupNote(post) {
    var m = (post && post.meet) || meetOf(post);
    var txt = meetFilled(m) ? meetText(m, ' · ') : '';
    if (!txt) txt = String((post && post.text) || '').replace(/\s+/g, ' ').trim();
    return U.truncate(txt, 60);
  }

  function groupMembers(idx, post, list, meKey) {
    /* v1.43.0 — 참여자 = 글쓴이 + 수락된 게스트 + 예전 참여자(방에 말을 남긴 사람).
     * 신청만 하고 수락 전인 사람은 방 사람으로 세지 않습니다. */
    if (post && post.id) return guestRoster(idx, post, meKey).members;
    var seen = {}, out = [];
    function add(key, nick) {
      if (!key || seen[key]) return;
      seen[key] = 1;
      out.push({ key: key, nick: nick || nickOf(idx, key) || '회원', me: key === meKey });
    }
    (list || []).forEach(function (m) { add(m.userKey, m.nick); });
    return out;
  }

  /* 단체방 하나의 모습 — 참여자·메시지·안 읽음 */
  function groupThread(idx, post, list, meKey, readAt) {
    var msgs = U.sortBy(list || [], function (m) { return m.createdAt || ''; });
    var last = msgs[msgs.length - 1] || null;
    var since = (readAt || {})[String((post && post.id) || '')] || '';
    var members = groupMembers(idx, post, msgs, meKey);
    return {
      roomId: String((post && post.id) || ''), other: '', kind: 'group', postId: String((post && post.id) || ''),
      title: groupTitle(post), note: groupNote(post),
      members: members, memberCount: members.length,
      messages: msgs, last: last, at: (last && last.createdAt) || '',
      unread: msgs.filter(function (m) {
        return m.userKey !== meKey && (!since || (m.createdAt || '') > since);
      }).length
    };
  }

  /* 대화 목록에 없더라도 방 하나를 그려 볼 수 있게 (참여 문의로 막 들어온 방) */
  function groupThreadById(idx, meKey, roomId) {
    var post = groupPostOf(idx, roomId);
    if (!post) return null;
    var list = (idx.byType['매칭채팅'] || []).filter(function (m) { return String(m.team) === String(roomId); });
    return groupThread(idx, post, list, meKey, chatReadMap(idx, meKey));
  }

  /* 친구이거나 매칭이 성사된 상대, 또는 승인된 코치와 1:1 대화를 할 수 있습니다.
   * (이미 대화가 시작된 방은 그대로 이어집니다.) */
  function canChatWith(idx, meKey, otherKey) {
    if (!meKey || !otherKey || meKey === otherKey) return false;
    if (friendState(idx, meKey, otherKey).state === 'friends') return true;
    if (matchBetween(idx, meKey, otherKey).accepted) return true;
    return coachChatAllowed(idx, meKey, otherKey);
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
      if (String(roomId).indexOf('coach_') === 0) map[roomId].kind = 'coach';
    });

    /* 모집 글 단체방 — 글마다 하나인 고정 방(방 ID = 글 ID).
     * 이미 들어간 방(내가 한마디 했거나, 읽음 표시가 있거나, 내가 쓴 글)만 목록에 둡니다. */
    var groupMsgs = {};
    (idx.byType['매칭채팅'] || []).forEach(function (m) {
      if (!groupPostOf(idx, m.team)) return;
      (groupMsgs[m.team] = groupMsgs[m.team] || []).push(m);
    });
    Object.keys(groupMsgs).forEach(function (roomId) {
      var post = groupPostOf(idx, roomId);
      var list = U.sortBy(groupMsgs[roomId], function (m) { return m.createdAt || ''; });
      /* v1.43.0 — 방 사람만 목록에 둡니다 (글쓴이 · 수락된 게스트 · 예전 참여자).
       * 신청만 하고 아직 수락되지 않은 사람, 나간 사람은 목록에서 빠집니다. */
      if (!post || !guestMember(idx, post, meKey)) return;
      map[roomId] = groupThread(idx, post, list, meKey, readAt);
    });
    /* 문의 버튼으로 방을 열어 읽음 표시만 남은 방(아직 대화 없음)도 내 목록에 남깁니다 */
    Object.keys(readAt).forEach(function (roomId) {
      if (map[roomId]) return;
      var post = groupPostOf(idx, roomId);
      if (!post || !guestMember(idx, post, meKey)) return;
      map[roomId] = groupThread(idx, post, [], meKey, readAt);
    });
    /* v1.43.0 — 대화가 아직 없어도 방 사람(수락된 게스트·신청이 온 글의 글쓴이)에게는 방이 보입니다.
     * 수락 직후 '단체방 열기'로 들어가 바로 인사할 수 있게 하기 위해서입니다. */
    (idx.byType['소셜'] || []).forEach(function (post) {
      var roomId = String((post && post.id) || '');
      if (!roomId || map[roomId]) return;
      if (!guestMember(idx, post, meKey)) return;
      var roster = guestRoster(idx, post, meKey);
      if (!(roster.members.length > 1 || roster.pending.length > 0 || readAt[roomId])) return;
      map[roomId] = groupThread(idx, post, groupMsgs[roomId] || [], meKey, readAt);
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
      .filter(function (t) {
        if (t.kind === 'group') return true;   /* 단체방은 '상대 한 사람'이 없습니다 */
        return t.other && t.other !== meKey;
      })
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

  /* ============================================================
   * v1.20 — 채팅 시각 · 활동 상태 · 새 메시지 감지 · 사용자 설정
   * 화면(DOM) 없이 계산만 합니다. 테스트에서 그대로 돌려볼 수 있습니다.
   * ============================================================ */

  /* ---------- 1) 보낸 시각 표기 ----------
   * 말풍선·방 목록 어디서든 같은 규칙을 씁니다.
   *  · 같은 날      : '오후 2:20'
   *  · 다른 날      : '11/18 14:20'
   *  · 방 목록     : 오늘이면 '오후 2:20', 어제면 '어제', 그 전이면 '11/18'
   *  · 날짜 구분선 : '오늘' / '어제' / '11월 18일 (화)' */
  function timeOf(ts) {
    if (!ts) return null;
    if (ts instanceof Date) return isNaN(ts.getTime()) ? null : ts;
    var d = new Date(String(ts).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  function clock12(d) {
    var h = d.getHours(), m = d.getMinutes();
    return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
  }

  function clock24(d) {
    return U.pad2(d.getHours()) + ':' + U.pad2(d.getMinutes());
  }

  function sameDay(a, b) {
    return !!a && !!b && U.ymd(a) === U.ymd(b);
  }

  function chatTime(ts) {
    var d = timeOf(ts);
    return d ? clock12(d) : '';
  }

  /* 말풍선 아래 시각 — 오늘이 아니면 날짜를 함께 적습니다 */
  function chatStamp(ts, nowMs) {
    var d = timeOf(ts);
    if (!d) return '';
    var now = nowMs ? new Date(nowMs) : new Date();
    return sameDay(d, now) ? clock12(d) : U.shortDay(U.ymd(d)) + ' ' + clock24(d);
  }

  /* 대화 목록 오른쪽 시각 */
  function chatListTime(ts, nowMs) {
    var d = timeOf(ts);
    if (!d) return '';
    var now = nowMs ? new Date(nowMs) : new Date();
    if (sameDay(d, now)) return clock12(d);
    if (sameDay(d, U.addDays(now, -1))) return '어제';
    if (d.getFullYear() === now.getFullYear()) return U.shortDay(U.ymd(d));
    return d.getFullYear() + '.' + U.shortDay(U.ymd(d));
  }

  function chatDayKey(ts) {
    var d = timeOf(ts);
    return d ? U.ymd(d) : '';
  }

  function chatDayLabel(ts, nowMs) {
    var d = timeOf(ts);
    if (!d) return '';
    var now = nowMs ? new Date(nowMs) : new Date();
    if (sameDay(d, now)) return '오늘';
    if (sameDay(d, U.addDays(now, -1))) return '어제';
    return U.dayLabel(U.ymd(d));
  }

  /* ---------- 2) 활동 상태 ----------
   * 기준: 5분 이내 '활동 중' · 15분 이내 '방금 전 활동' · 1시간 이내 'N분 전 활동'
   *       오늘 '오늘 활동' · 7일 이내 'N일 전 활동' · 그 뒤 '오래전' · 기록 없음 '활동 정보 없음'
   * 활동 시각은 채팅·일지·출석·꾸미기·프로필 갱신 같은 '그 사람이 남긴 행'의
   * 최신 작성일시와 매칭프로필에 적어 둔 lastActiveAt 중 가장 늦은 값입니다. */
  var PRESENCE = { ACTIVE_MIN: 5, RECENT_MIN: 15, HOUR_MIN: 60, DAY_MIN: 1440, OLD_DAYS: 7 };

  var ACTIVITY_TYPES = [
    '매칭채팅', '채팅읽음', '기록', '경기', '출석하트', '광고하트', '하트', '내하트사용',
    '선물하트', '하트합치기', '꾸미기구매', '달력메모', '프로필', '매칭프로필',
    '소셜', '답글', '매칭신청', '친구요청', '친구수락', '코치피드백'
  ];

  function presenceFromAt(at, nowMs) {
    var out = { state: 'none', label: '활동 정보 없음', at: at || '', minutes: null, dot: false };
    var d = timeOf(at);
    if (!d) return out;
    var now = nowMs ? new Date(nowMs) : new Date();
    var mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (mins < 0) mins = 0;
    out.minutes = mins;
    if (mins <= PRESENCE.ACTIVE_MIN) { out.state = 'on'; out.label = '활동 중'; }
    else if (mins <= PRESENCE.RECENT_MIN) { out.state = 'recent'; out.label = '방금 전 활동'; }
    else if (mins <= PRESENCE.HOUR_MIN) { out.state = 'minutes'; out.label = mins + '분 전 활동'; }
    else if (sameDay(d, now)) { out.state = 'today'; out.label = '오늘 활동'; }
    else if (sameDay(d, U.addDays(now, -1))) { out.state = 'yesterday'; out.label = '어제 활동'; }
    else if (mins <= PRESENCE.DAY_MIN * PRESENCE.OLD_DAYS) {
      out.state = 'days'; out.label = Math.max(1, Math.floor(mins / PRESENCE.DAY_MIN)) + '일 전 활동';
    } else { out.state = 'old'; out.label = '오래전'; }
    out.dot = out.state === 'on';
    return out;
  }

  function lastActiveAt(idx, userKey) {
    if (!idx || !userKey) return '';
    var best = '';
    ACTIVITY_TYPES.forEach(function (type) {
      (idx.byType[type] || []).forEach(function (r) {
        if (!r || r.userKey !== userKey) return;
        var at = r.createdAt || '';
        if (at > best) best = at;
      });
    });
    var mp = matchProfileOf(idx, userKey) || {};
    if (mp.lastActiveAt && String(mp.lastActiveAt) > best) best = String(mp.lastActiveAt);
    return best;
  }

  function presenceOf(idx, userKey, nowMs) {
    if (userKey && typeof userKey === 'object') return presenceFromAt(userKey.at, nowMs);
    return presenceFromAt(lastActiveAt(idx, userKey), nowMs);
  }

  /* ---------- 3) 새 메시지 · 새 요청 감지 ----------
   * since(작성일시 문자열) 이후에 들어온, '내가 보낸 것이 아닌' 메시지와 요청만 골라냅니다.
   * 처음 앱을 열 때는 since = 지금 시각이라 지난 메시지는 알리지 않습니다. */
  function joinedGroupRoom(idx, roomId, meKey) {
    if (!meKey) return false;
    var post = groupPostOf(idx, roomId);
    if (!post) return false;
    /* v1.43.0 — 글쓴이 or 수락된 게스트 or 예전 참여자. 신청만 한 사람은 아직 방 사람이 아닙니다 */
    return guestMember(idx, post, meKey);
  }

  function newIncoming(idx, meKey, since) {
    var out = { messages: [], requests: [], friendRequests: [], total: 0 };
    if (!idx || !meKey) return out;
    var after = String(since || '');
    function fresh(r) { return !!r && !!r.createdAt && r.createdAt > after; }

    (idx.byType['매칭채팅'] || []).forEach(function (m) {
      if (!fresh(m) || m.userKey === meKey) return;
      var roomId = String(m.team || m.id || '');
      if (!roomId) return;
      var group = isGroupRoom(idx, roomId);
      if (group) {
        if (!joinedGroupRoom(idx, roomId, meKey)) return;
      } else if (m.target !== meKey) return;
      out.messages.push({
        kind: 'message', roomId: roomId, from: m.userKey || '',
        nick: m.nick || nickOf(idx, m.userKey) || '회원',
        text: String(m.text || ''), at: m.createdAt, group: group
      });
    });

    (idx.byType['매칭신청'] || []).forEach(function (r) {
      if (!fresh(r) || r.userKey === meKey || r.target !== meKey) return;
      if ((r.status || '대기') !== '대기') return;
      out.requests.push({
        kind: 'match', id: r.id, from: r.userKey || '',
        nick: r.nick || nickOf(idx, r.userKey) || '회원',
        note: (r.payload && r.payload.note) || '', at: r.createdAt
      });
    });

    (idx.byType['친구요청'] || []).forEach(function (r) {
      if (!fresh(r) || r.userKey === meKey || r.target !== meKey) return;
      if (friendState(idx, meKey, r.userKey).state !== 'received') return;
      out.friendRequests.push({
        kind: 'friend', id: r.id, from: r.userKey || '',
        nick: r.nick || nickOf(idx, r.userKey) || '회원', at: r.createdAt
      });
    });

    /* v1.43.0 — 내 모집 글에 도착한 게스트 참여 신청 (글쓴이에게만) */
    (idx.byType[GUEST_TYPE] || []).forEach(function (r) {
      if (!fresh(r) || guestKind(r) !== GUEST.apply) return;
      if (String(r.target || '') !== String(meKey)) return;
      var postId = String(r.team || '');
      if (!groupPostOf(idx, postId)) return;
      if (guestState(idx, postId, r.userKey).status !== GUEST.pending) return;
      out.requests.push({
        kind: 'guest', id: r.id, from: String(r.userKey || ''), postId: postId,
        nick: (r.payload && r.payload.nick) || r.nick || nickOf(idx, r.userKey) || '회원',
        note: (r.payload && r.payload.note) || '', at: r.createdAt
      });
    });

    out.messages = U.sortBy(out.messages, function (m) { return m.at || ''; });
    out.requests = U.sortBy(out.requests, function (m) { return m.at || ''; });
    out.friendRequests = U.sortBy(out.friendRequests, function (m) { return m.at || ''; });
    out.total = out.messages.length + out.requests.length + out.friendRequests.length;
    return out;
  }

  /* ---------- 4) 사용자 설정 (알림 · 편지지) ----------
   * 기기에 저장합니다(계정과 무관). 기본은 둘 다 켜짐이고,
   * 저장된 값이 false일 때만 꺼집니다(예전 기기·깨진 값은 켜짐으로). */
  var PREFS_KEY = 'bm_prefs_v1';
  var PREFS_DEFAULTS = { notify: true, letter: true };

  function normalizePrefs(o) {
    o = o || {};
    return {
      notify: o.notify === false ? false : true,
      letter: o.letter === false ? false : true
    };
  }

  /* ---------- 주간 약점 극복 3회 챌린지 (bm-v1.31.0) ----------
   * ideas.md 2026-11-19 3번 후보 — '이번 주 ○○ 3회 연습하기' 작은 스탬프 챌린지.
   *  · 최근 2주(오늘 포함 14일) 일지의 '약점기술'에서 가장 자주 나온 약점 1개를 고릅니다.
   *    동률이면 최근에 남긴 쪽 → 사전(VOCAB.weakness) 순서로 정해 항상 같은 결과가 나옵니다.
   *  · 스탬프는 그 약점이 '약점기술' 또는 '완료훈련'에 찍힌 일지를 저장하면 자동으로 채워집니다.
   *    같은 날 일지를 두 번 남겨도 '연습한 날' 1회로 셉니다(날짜 기준).
   *  · 3회를 채우면 done — 화면은 축하 배지와 '다음 주에 새 약점으로 교체' 안내를 보여 줍니다.
   *  · 계산만 하므로 새로 저장하는 칸이 없습니다(시트 26칸 · Supabase 스키마 그대로).
   *  · 같은 입력이면 항상 같은 결과(순수 함수). opts.now로 날짜를 고정할 수 있습니다. */
  var CHALLENGE_GOAL = 3;
  var CHALLENGE_DAYS = 14;          /* 최근 2주 */

  /* 날짜 문자열('2026-11-20' · '2026.11.20' · '2026/11/20')을 YYYY-MM-DD로 */
  function dayKey(v) {
    var s = String(v == null ? '' : v).trim().slice(0, 10).replace(/[.\/]/g, '-');
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) return '';
    return m[1] + '-' + (m[2].length < 2 ? '0' + m[2] : m[2]) + '-' + (m[3].length < 2 ? '0' + m[3] : m[3]);
  }

  /* 그 주의 월요일 00:00 (배드민턴 주간은 월~일) */
  function weekStartOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function hasTag(list, name) {
    for (var i = 0; i < (list || []).length; i++) if (String(list[i]) === name) return true;
    return false;
  }

  /* weekChallenge(records, {now, goal}) →
   *   { active, reason, weakness, goal, count, done, left, days,
   *     weekStart, weekEnd, weekLabel, next, picks, recent }
   *   reason: 'ok' | 'no_records'(최근 2주 일지 없음) | 'no_weakness'(약점 태그 없음) */
  function weekChallenge(records, opts) {
    opts = opts || {};
    var goal = Math.max(1, U.num(opts.goal, CHALLENGE_GOAL) || CHALLENGE_GOAL);
    var now = opts.now
      ? (opts.now instanceof Date ? opts.now : (U.parseYmd(dayKey(opts.now)) || new Date()))
      : new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var ws = weekStartOf(today);
    var we = U.addDays(ws, 6);
    var from = U.addDays(today, -(CHALLENGE_DAYS - 1));
    var wsKey = U.ymd(ws), weKey = U.ymd(we), fromKey = U.ymd(from), todayKey = U.ymd(today);

    /* 최근 2주 일지만 (날짜가 없는 행은 세지 않습니다) */
    var recent = [];
    (records || []).forEach(function (r) {
      if (!r) return;
      var k = dayKey(r.date);
      if (!k || k < fromKey || k > todayKey) return;
      recent.push({ key: k, weakness: r.weakness || [], done: r.done || [] });
    });

    var base = {
      active: false, reason: 'no_records', weakness: '', goal: goal, count: 0, done: false, left: goal,
      days: [], weekStart: wsKey, weekEnd: weKey, weekLabel: U.shortDay(wsKey) + '~' + U.shortDay(weKey),
      next: '', picks: [], recent: recent.length
    };
    if (!recent.length) return base;

    /* 약점 세기 — 한 일지에 같은 약점이 두 번 있어도 1회 */
    var counts = {}, lastAt = {};
    recent.forEach(function (r) {
      var seen = {};
      r.weakness.forEach(function (w) {
        var name = String(w == null ? '' : w).trim();
        if (!name || seen[name]) return;
        seen[name] = 1;
        counts[name] = (counts[name] || 0) + 1;
        if (!lastAt[name] || r.key > lastAt[name]) lastAt[name] = r.key;
      });
    });
    var order = {};
    (VOCAB.weakness || []).forEach(function (w, i) { order[w] = i; });
    var picks = Object.keys(counts).map(function (name) {
      return { name: name, n: counts[name], last: lastAt[name] || '' };
    }).sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      if (a.last !== b.last) return a.last < b.last ? 1 : -1;
      var oa = order[a.name] == null ? 99 : order[a.name];
      var ob = order[b.name] == null ? 99 : order[b.name];
      return oa - ob || (a.name < b.name ? -1 : 1);
    });
    if (!picks.length) {
      base.reason = 'no_weakness';
      return base;
    }

    var pick = picks[0].name;

    /* 이번 주(월~일) 스탬프 — 약점기술 또는 완료훈련에 그 약점이 찍힌 '날' */
    var days = [];
    recent.forEach(function (r) {
      if (r.key < wsKey || r.key > weKey) return;
      if (!hasTag(r.weakness, pick) && !hasTag(r.done, pick)) return;
      if (days.indexOf(r.key) < 0) days.push(r.key);
    });
    days.sort();

    var count = days.length;
    return {
      active: true, reason: 'ok', weakness: pick, goal: goal,
      count: count, done: count >= goal, left: Math.max(0, goal - count),
      days: days, weekStart: wsKey, weekEnd: weKey,
      weekLabel: U.shortDay(wsKey) + '~' + U.shortDay(weKey),
      next: picks.length > 1 ? picks[1].name : '',
      picks: picks.slice(0, 3),
      recent: recent.length
    };
  }

  /* 연속 주간 챌린지 달성 배지 (bm-v1.34.0)
   *  · 이번 주부터 최대 STREAK_WEEKS주를 거슬러 올라가며 goal을 채운 주가 몇 주 연속인지 셉니다.
   *  · 한 주의 달성 판정은 그 주 마지막 날(일요일) 기준 weekChallenge — 지난 주 결과는
   *    뒤에 바뀌지 않고, 이번 주는 오늘까지만 셉니다.
   *  · 이번 주가 아직 진행 중이면(미달) 연속을 끊지 않고 지난주까지 셉니다.
   *  · 일지가 없던 주는 달성으로 세지 않습니다(없는 기록을 성과로 만들지 않음).
   *  순수 함수. opts.now·opts.weeks·opts.goal로 날짜와 기간을 고정할 수 있습니다.
   *  → { weeks, goal, best, inProgress, current, list:[{weekStart, weekEnd, label, done, count, weakness}] } */
  var STREAK_WEEKS = 8;

  function challengeStreak(records, opts) {
    opts = opts || {};
    var goal = Math.max(1, U.num(opts.goal, CHALLENGE_GOAL) || CHALLENGE_GOAL);
    var now = opts.now
      ? (opts.now instanceof Date ? opts.now : (U.parseYmd(dayKey(opts.now)) || new Date()))
      : new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var span = Math.min(26, Math.max(1, U.num(opts.weeks, STREAK_WEEKS) || STREAK_WEEKS));
    var ws = weekStartOf(today);
    var list = [];
    for (var i = 0; i < span; i++) {
      var start = U.addDays(ws, -7 * i);
      var end = U.addDays(start, 6);
      /* 이번 주는 오늘까지만 (아직 오지 않은 날은 셀 수 없습니다) */
      var at = end.getTime() > today.getTime() ? today : end;
      var ch = weekChallenge(records, { now: at, goal: goal });
      list.push({
        weekStart: U.ymd(start), weekEnd: U.ymd(end),
        label: U.shortDay(U.ymd(start)) + '~' + U.shortDay(U.ymd(end)),
        done: !!ch.done, count: ch.count || 0, weakness: ch.weakness || '',
        reason: ch.reason, current: i === 0
      });
    }
    /* 이번 주가 미달이면(진행 중) 지난주부터 셉니다 — 이번 주는 아직 실패가 아닙니다 */
    var weeks = 0;
    var from = (list[0] && list[0].done) ? 0 : 1;
    for (var j = from; j < list.length; j++) {
      if (!list[j].done) break;
      weeks++;
    }
    var best = 0, run = 0;
    list.forEach(function (w) {
      if (w.done) { run++; best = Math.max(best, run); } else run = 0;
    });
    return {
      weeks: weeks, goal: goal, best: best,
      inProgress: !(list[0] && list[0].done),
      current: list[0], list: list
    };
  }

  /* 챌린지 자랑 문구 — 3회를 채운 카드에서 커뮤니티 글로 그대로 들어갑니다.
   *  예) '이번 주 헤어핀 3회 연습 달성! 🎉'
   *  · 이번 주(또는 오늘) 기록에 함께 친 파트너·전적이 있으면 괄호로 자연스럽게 붙입니다 (bm-v1.36.0).
   *    예) '이번 주 헤어핀 3회 연습 달성! (조환비와 2경기 2승) 🎉'
   *  · opts.records 를 안 주면 예전과 같은 문구입니다. */
  function challengeShareText(ch, opts) {
    opts = opts || {};
    var w = String((ch && ch.weakness) || '').trim();
    if (!w) return '';
    var goal = Math.max(1, U.num(ch && ch.goal, CHALLENGE_GOAL) || CHALLENGE_GOAL);
    var tail = challengePartnerTail(challengePartner(opts.records, ch, opts));
    return '이번 주 ' + w + ' ' + goal + '회 연습 달성!' + (tail ? ' (' + tail + ')' : '') + ' 🎉';
  }

  /* '조환비와' / '민수와' / '김철수와' — 받침에 따라 '와/과'를 고릅니다 */
  function withAnd(name) {
    var s = String(name == null ? '' : name).trim();
    if (!s) return '와';
    var c = s.charCodeAt(s.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return '와';
    return ((c - 0xac00) % 28) > 0 ? '과' : '와';
  }

  /* 자랑 문구에 붙일 파트너 한 명 (bm-v1.36.0)
   *  · 이번 주 챌린지 스탬프가 찍힌 날(ch.days)의 일지에서 '가장 많이 함께 친' 파트너.
   *  · 이번 주 기록이 아직 없으면 오늘 일지에서 봅니다.
   *  · 점수·승패가 적힌 경기가 있어야 고릅니다(이름만 있고 경기가 없으면 붙이지 않음).
   *  → { name, games, wins, losses, draws, line, rate } 또는 null. 순수 함수. */
  function challengePartner(records, ch, opts) {
    opts = opts || {};
    var days = (ch && ch.days && ch.days.length) ? ch.days.slice() : [];
    if (!days.length) {
      var today = opts.now ? dayKey(opts.now) : U.ymd();
      if (today) days = [today];
    }
    if (!days.length) return null;
    var picked = (records || []).filter(function (r) {
      return r && days.indexOf(dayKey(r.date)) >= 0;
    });
    var list = partnerStats(picked, { limit: 99 });
    if (!list.length) return null;
    list.sort(function (a, b) {
      if (b.games !== a.games) return b.games - a.games;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
    return list[0];
  }

  /* '조환비와 2경기 2승' — 자랑 문구 괄호 안에 들어가는 한 마디 */
  function challengePartnerTail(p) {
    if (!p || !p.games) return '';
    var rec = [];
    if (p.wins) rec.push(p.wins + '승');
    if (p.draws) rec.push(p.draws + '무');
    if (p.losses) rec.push(p.losses + '패');
    if (!rec.length) return '';
    return p.name + withAnd(p.name) + ' ' + p.games + '경기 ' + rec.join(' ');
  }

  /* 채팅 말풍선의 http(s) 주소만 눌러지게 (bm-v1.34.0)
   *  · 글자를 먼저 이스케이프한 뒤 http/https 주소만 <a>로 감쌉니다
   *    (javascript:·data: 같은 주소는 글자 그대로 남습니다).
   *  · 문장 끝의 마침표·쉼표·괄호는 주소에서 떼어 냅니다. 줄바꿈은 <br>.
   *  코치가 받은 '영상 링크'를 그 자리에서 누를 수 있게 하는 용도입니다. */
  function linkify(text) {
    var s = String(text == null ? '' : text);
    var re = /https?:\/\/[^\s<>"'`]+/gi;
    var out = '', last = 0, m;
    while ((m = re.exec(s))) {
      out += U.esc(s.slice(last, m.index));
      var whole = m[0], url = whole, trail = '';
      var tm = whole.match(/[),.!?;:]+$/);
      if (tm) { trail = tm[0]; url = whole.slice(0, whole.length - trail.length); }
      if (url.length > 7) {
        out += '<a class="dlink" href="' + U.esc(url) + '" target="_blank" rel="noopener noreferrer">' + U.esc(url) + '</a>';
      } else {
        out += U.esc(whole);
        trail = '';
      }
      out += U.esc(trail);
      last = m.index + whole.length;
    }
    out += U.esc(s.slice(last));
    return out.replace(/\n/g, '<br>');
  }

  function readPrefs() {
    return normalizePrefs(U.readJSON(PREFS_KEY, null) || {});
  }

  function writePrefs(p) {
    var n = normalizePrefs(p);
    U.writeJSON(PREFS_KEY, n);
    return n;
  }

  function setPref(list, key, value) {
    var p = normalizePrefs(list || readPrefs());
    if (!Object.prototype.hasOwnProperty.call(PREFS_DEFAULTS, key)) return p;
    p[key] = value !== false;
    return writePrefs(p);
  }

  BM.domain = {
    COLS: COLS, COL: COL, VOCAB: VOCAB, GRADES: GRADES, GENDERS: GENDERS, THEMES: THEMES, AVATAR: AVATAR, PRESENCE: PRESENCE, PREFS_DEFAULTS: PREFS_DEFAULTS,
    normalizeGrade: normalizeGrade, normalizeGender: normalizeGender, normalizeStyle: normalizeStyle,
    STYLES: STYLES,
    /* v1.40 — 시작 4유형 선택 · 선수용 7대 훈련 */
    ROLES: ROLES, normalizeRole: normalizeRole, roleById: roleById, roleOf: roleOf, roleGuess: roleGuess, proVisible: proVisible,
    PRO_ITEMS: PRO_ITEMS, PRO_MAX: PRO_MAX, proNames: proNames, proItemByName: proItemByName,
    normalizePro: normalizePro, proOf: proOf, proPlan: proPlan, proCheckedNames: proCheckedNames, proLine: proLine,
    normalizeAvatar: normalizeAvatar, avatarOf: avatarOf,
    DECO_PRICES: DECO_PRICES, STREAK_UNLOCKS: STREAK_UNLOCKS,
    decoId: decoId, decoPrice: decoPrice, decoName: decoName, ownsDeco: ownsDeco,
    frameById: frameById, frameName: frameName, badgeEmoji: badgeEmoji, badgeLabel: badgeLabel,
    streakUnlocked: streakUnlocked, checkinStreak: checkinStreak, nextStreakMilestone: nextStreakMilestone, streakBonusLeft: streakBonusLeft,
    searchText: searchText, matchesQuery: matchesQuery, filterPlayers: filterPlayers, activeFilters: activeFilters,
    matchSearchActive: matchSearchActive,
    HEART_RULES: HEART_RULES,
    BASE_HEARTS: BASE_HEARTS, HEART_COST_MATCH: HEART_COST_MATCH,
    JSON_TYPES: JSON_TYPES,
    fromRow: fromRow, toRow: toRow, asCells: asCells,
    recordDraft: recordDraft, logCells: logCells,
    logMeta: logMeta, logExtraJson: logExtraJson,
    partnerStats: partnerStats, partnerStat: partnerStat, partnerLineText: partnerLineText,
    rivalStats: rivalStats, rivalStat: rivalStat, rivalLineText: rivalLineText, rivalVersusText: rivalVersusText,
    duelStats: duelStats, memberByName: memberByName,
    linkify: linkify,
    cleanPartner: cleanPartner, safeVideoUrl: safeVideoUrl, cleanVideoLabel: cleanVideoLabel,
    safeLinkUrl: safeLinkUrl, safeImageUrl: safeImageUrl, clampText: clampText,
    PARTNER_MAX: PARTNER_MAX, RIVAL_MAX: RIVAL_MAX, VIDEO_URL_MAX: VIDEO_URL_MAX, VIDEO_LABEL_MAX: VIDEO_LABEL_MAX,
    parseScore: parseScore, parseGames: parseGames, cleanGames: cleanGames,
    gamesSummary: gamesSummary, formatGames: formatGames,
    resultFromScore: resultFromScore, splitList: splitList,
    index: index, profileOf: profileOf, displayName: displayName, latestPerUser: latestPerUser,
    heartLedger: heartLedger, heartStatus: heartStatus,
    ownsTheme: ownsTheme, themeById: themeById, themePrice: themePrice,
    stats: stats, matchScore: matchScore, levelGap: levelGap,
    chatRooms: chatRooms, matchRequests: matchRequests,
    ADMIN_EMAILS: ADMIN_EMAILS, ADMIN_TARGET: ADMIN_TARGET,
    isAdminEmail: isAdminEmail, isAdminMe: isAdminMe, isCoach: isCoach,
    mentorApplications: mentorApplications, mentorPendingCount: mentorPendingCount,
    /* v1.45.0 — 멘토 구분 · 활동 소속 · 증명(링크/사진) */
    MENTOR: MENTOR, MENTOR_TYPES: MENTOR_TYPES, MENTOR_NEED_PROOF: MENTOR_NEED_PROOF,
    mentorTypeOf: mentorTypeOf, mentorNeedsProof: mentorNeedsProof, approvedMentorOf: approvedMentorOf,
    cleanAffiliation: cleanAffiliation, cleanProofText: cleanProofText,
    cleanProofUrl: cleanProofUrl, cleanProofPhoto: cleanProofPhoto,
    mentorProofOf: mentorProofOf, mentorBadgeOf: mentorBadgeOf, mentorAffiliationLine: mentorAffiliationLine,
    gymNameSuggestions: gymNameSuggestions,
    FRIEND_TYPES: FRIEND_TYPES,
    friendState: friendState, friendsOf: friendsOf, incomingFriendRequests: incomingFriendRequests,
    /* v1.38 — 친구 코드(#XXXX) */
    FRIEND_CODE_ALPHABET: FRIEND_CODE_ALPHABET, FRIEND_CODE_LEN: FRIEND_CODE_LEN,
    friendCodeOf: friendCodeOf, friendCodeLabel: friendCodeLabel, friendCodeWithNick: friendCodeWithNick,
    friendCodeParse: friendCodeParse, friendCodeDirectory: friendCodeDirectory, friendCodeFind: friendCodeFind,
    matchBetween: matchBetween, canChatWith: canChatWith,
    coachRoomId: coachRoomId, coachChatAllowed: coachChatAllowed,
    POST_TOPICS: POST_TOPICS, MEET: MEET, LEGACY_TOPICS: LEGACY_TOPICS, normalizeTopic: normalizeTopic, topicOf: topicOf,
    normalizeMeet: normalizeMeet, meetFilled: meetFilled, meetOf: meetOf, meetText: meetText, meetFeeText: meetFeeText,
    meetCap: meetCap, meetMembers: meetMembers, meetStatus: meetStatus,
    /* 모집 일시 고르기 (bm-v1.48.0) */
    meetWhen: {
      parse: whenParse, compose: whenCompose, dateLabel: whenDateLabel,
      quickDates: whenQuickDates, quickTimes: WHEN_QUICK_TIMES, time: whenTime
    },
    WHEN_QUICK_TIMES: WHEN_QUICK_TIMES,
    /* v1.43.0 — 게스트 참여 신청 · 수락/거절 · 나가기 · 마감 숨김 */
    GUEST_TYPE: GUEST_TYPE, GUEST: GUEST, GUEST_NOTE_MAX: GUEST_NOTE_MAX,
    guestKind: guestKind, guestRows: guestRows, guestStates: guestStates, guestState: guestState,
    guestRoster: guestRoster, guestMember: guestMember, guestInbox: guestInbox, guestMine: guestMine,
    guestBlocked: guestBlocked,
    meetHidden: meetHidden,
    /* v1.29 */
    MANNER_TYPE: MANNER_TYPE, MANNER_TAGS: MANNER_TAGS, MANNER_MAX_BADGES: MANNER_MAX_BADGES,
    mannerTag: mannerTag, mannerLabel: mannerLabel, mannerRows: mannerRows,
    mannerGivenToday: mannerGivenToday, mannerToday: mannerToday, mannerReceived: mannerReceived,
    groupRoomId: groupRoomId, groupPostOf: groupPostOf, isGroupRoom: isGroupRoom,
    groupTitle: groupTitle, groupNote: groupNote, groupMembers: groupMembers,
    groupThread: groupThread, groupThreadById: groupThreadById,
    chatThreads: chatThreads, threadById: threadById, chatUnread: chatUnread,
    matchProfileOf: matchProfileOf,
    /* v1.20 */
    chatTime: chatTime, chatStamp: chatStamp, chatListTime: chatListTime,
    chatDayKey: chatDayKey, chatDayLabel: chatDayLabel,
    presenceFromAt: presenceFromAt, lastActiveAt: lastActiveAt, presenceOf: presenceOf,
    newIncoming: newIncoming, joinedGroupRoom: joinedGroupRoom,
    PREFS_KEY: PREFS_KEY, normalizePrefs: normalizePrefs, readPrefs: readPrefs, writePrefs: writePrefs, setPref: setPref,
    /* v1.31 */
    CHALLENGE_GOAL: CHALLENGE_GOAL, CHALLENGE_DAYS: CHALLENGE_DAYS, STREAK_WEEKS: STREAK_WEEKS,
    weekChallenge: weekChallenge, weekStartOf: weekStartOf, dayKey: dayKey,
    challengeShareText: challengeShareText, challengeStreak: challengeStreak,
    challengePartner: challengePartner, challengePartnerTail: challengePartnerTail,
    cleanTxId: cleanTxId, adTxNote: adTxNote, adTxOf: adTxOf, adTxSeen: adTxSeen
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
