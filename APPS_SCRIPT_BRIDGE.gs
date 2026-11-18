/**
 * ============================================================
 *  APPS_SCRIPT_BRIDGE.gs — 배드민턴 앱 ↔ 구글 시트 다리
 * ============================================================
 *  역할
 *   - 시트는 절대 공개하지 않고, 이 웹 앱(doGet/doPost)만 시트를 읽고 씁니다.
 *   - 비밀번호는 SHA-256(반복) 해시로만 저장하고, 어떤 응답에도 내보내지 않습니다.
 *   - 이메일 같은 사용자 식별자는 'u + 해시' 공개 ID로 바꿔서 내려보냅니다.
 *   - 같은 요청이 두 번 오면(연타·재시도) 한 번만 처리합니다(clientId).
 *   - 26칸 '출력결과' 시트 구조를 그대로 사용합니다.
 *
 *  설치 순서 (자세한 설명은 README.md)
 *   1) 이 파일 전체를 시트의 [확장 프로그램 > Apps Script]에 붙여넣기
 *   2) [프로젝트 설정 > 스크립트 속성]에 SHEET_ID 추가 (공개 저장소 보호를 위해
 *      시트 ID는 코드에 넣지 않습니다. 값 = 시트 주소의 /d/ 와 /edit 사이 문자열)
 *   3) 편집기에서 setup() 한 번 실행 (권한 승인)
 *   4) [배포 > 새 배포 > 웹 앱] 실행 사용자: 나, 액세스: 모든 사용자
 *   5) 나온 /exec 주소를 앱 시작화면 또는 MY > 시트 연결에 넣기
 * ============================================================
 */

var CONFIG = {
  // 시트 ID는 코드에 하드코딩하지 않습니다(공개 저장소 노출 방지).
  // [프로젝트 설정 > 스크립트 속성]에서 SHEET_ID 값을 넣어 주세요.
  // 값 = 시트 주소창의 /d/ 와 /edit 사이 문자열
  SHEET_ID: PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '여기에_구글시트_ID',
  TAB: '출력결과',
  TIMEZONE: 'Asia/Seoul',

  // 해시에 섞는 비밀 문자열입니다. 반드시 길게 바꾸세요.
  // 바꾸면 기존 비밀번호/세션이 모두 무효가 됩니다(재설정 필요).
  SECRET: 'CHANGE_ME_badminton_bridge_secret_2026',

  SESSION_HOURS: 6,          // 로그인 유지 시간 (CacheService 최대 6시간)
  PASSWORD_ROUNDS: 120,      // 비밀번호 해시 반복 횟수
  /* --- 하트 경제 (앱의 js/domain.js HEART_RULES와 같은 값이어야 합니다) --- */
  BASE_HEARTS: 3,            // 가입 축하 하트
  CHECKIN_HEARTS: 1,         // 출석 체크 보상
  CHECKIN_PER_DAY: 1,        // 출석은 하루 1회
  AD_HEART_REWARD: 1,        // 광고 1회 보상
  AD_HEARTS_PER_DAY: 5,      // 광고 하루 한도
  AD_COOLDOWN_SEC: 30,       // 광고 사이 최소 간격(초) — 연타 파밍 방지
  MATCH_HEART_COST: 2,       // 1:1 매칭 1회 비용
  GIFT_HEART_COST: 1,        // 하트 선물 1회 비용
  THEME_PRICES: { th_def: 0, th_night: 0, th_court: 2, th_sakura: 2 },
  MAX_ROWS_PER_REQUEST: 5000 // bootstrap 한 번에 내려보낼 최대 행
};

/* 시트 26칸 (A~Z) — 순서를 바꾸면 앱과 어긋납니다 */
var COLS = [
  'ID', '유형', '작성일시', '날짜', '닉네임', '실력', '주력종목', '훈련계획',
  '컨디션', '훈련강도', '운동시간(분)', '완료훈련', '게임점수', '승패', '아픈부위',
  '맞춤처방', '약점기술', '추천드릴', '소셜글', '좋아요', '사용자ID', '대상', '팀',
  '자기소개', '비밀번호', '꾸미기'
];
var COL = {};
for (var _i = 0; _i < COLS.length; _i++) COL[COLS[_i]] = _i;

/* 객체로 행을 추가할 때 쓰는 영문 키 → 실제 헤더 이름 */
var OBJ_KEYS = {
  id: 'ID', type: '유형', createdAt: '작성일시', date: '날짜',
  nick: '닉네임', level: '실력', discipline: '주력종목',
  userKey: '사용자ID', password: '비밀번호', bio: '자기소개', theme: '꾸미기',
  plan: '훈련계획', cond: '컨디션', intensity: '훈련강도', minutes: '운동시간(분)',
  done: '완료훈련', score: '게임점수', result: '승패', pain: '아픈부위',
  prescription: '맞춤처방', weakness: '약점기술', drills: '추천드릴',
  text: '소셜글', likes: '좋아요', target: '대상', team: '팀'
};

var WRITABLE_TYPES = [
  '프로필', '기록', '경기', '계획', '약점', '소셜', '답글', '채팅', '채팅읽음',
  '매칭프로필', '매칭신청', '매칭채팅', '코치신청', '코치피드백', '하트', '광고하트',
  '출석하트', '선물하트', '하트합치기', '내하트사용', '꾸미기구매', '달력메모', '친구', '배민친구'
];

/* ============================================================
 *  1. 진입점
 * ============================================================ */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'ping') {
    return json_({ ok: true, message: '배드민턴 브리지가 살아 있어요.', time: now_(), version: 'v1.1' });
  }
  return json_({ ok: false, code: 'method', message: 'GET은 ping만 지원합니다. 데이터는 POST로 주세요.' });
}

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, code: 'bad_json', message: '요청 형식이 올바르지 않습니다.' });
  }
  try {
    return json_(route_(payload));
  } catch (err) {
    return json_({ ok: false, code: 'error', message: String((err && err.message) || err), retryable: true });
  }
}

function route_(p) {
  var action = p.action;
  if (action === 'ping') return { ok: true, time: now_() };
  if (action === 'login') return login_(p);
  if (action === 'register') return register_(p);
  if (action === 'logout') return logout_(p);

  var session = requireSession_(p.token);
  if (!session) return { ok: false, code: 'unauthorized', message: '로그인이 필요합니다.' };

  if (action === 'bootstrap') return bootstrap_(session);
  if (action === 'append') return append_(session, p);
  if (action === 'update') return update_(session, p);
  if (action === 'remove') return remove_(session, p);
  if (action === 'whoami') return { ok: true, me: meOf_(session.userKey) };

  return { ok: false, code: 'unknown_action', message: '알 수 없는 요청입니다: ' + action };
}

/* ============================================================
 *  2. 시트 접근
 * ============================================================ */
function ss_() { return SpreadsheetApp.openById(CONFIG.SHEET_ID); }
function sheet_() {
  var sh = ss_().getSheetByName(CONFIG.TAB);
  if (!sh) throw new Error("시트에 '" + CONFIG.TAB + "' 탭이 없습니다.");
  return sh;
}

/** 전체 행을 26칸 배열로 (헤더 제외) */
function readRows_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return { rows: [], firstRow: 2 };
  var width = 26;
  var values = sh.getRange(2, 1, last - 1, width).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var any = false;
    var out = [];
    for (var c = 0; c < width; c++) {
      var v = r[c];
      if (v instanceof Date) {
        v = c === COL['ID'] ? String(v.getTime()) : Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
      }
      out.push(v === null || v === undefined ? '' : String(v));
      if (out[c] !== '') any = true;
    }
    if (!any) continue;
    rows.push({ rowNum: i + 2, cells: out });
  }
  return { rows: rows, firstRow: 2 };
}

function now_() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd'); }

function recordId_() {
  // 앱과 같은 규칙: 밀리초 + 3자리. 시트에는 '텍스트'로 저장합니다.
  return String(new Date().getTime()) + String(100 + Math.floor(Math.random() * 900));
}

/* ============================================================
 *  3. 공개 ID / 개인정보 보호
 * ============================================================ */
function sha256Hex_(text) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

/** 이메일·내부키 → 공개 ID (u + 15자). 되돌릴 수 없습니다. */
function publicId_(key) {
  if (!key) return '';
  return 'u' + sha256Hex_(CONFIG.SECRET + '|pub|' + String(key).toLowerCase()).slice(0, 15);
}

function looksLikeUserKey_(v) {
  if (!v) return false;
  v = String(v);
  return v.indexOf('@') >= 0 || /^u[0-9a-f]{8,}$/.test(v) || /^demo_/.test(v) || /^guest_/.test(v);
}

/** 공개 ID → 원래 키 (시트 안의 값들로 역추적) */
function buildReverseMap_(rows) {
  var map = {};
  rows.forEach(function (r) {
    [r.cells[COL['사용자ID']]].forEach(function (k) {
      if (k && looksLikeUserKey_(k)) map[publicId_(k)] = k;
    });
  });
  return map;
}

/** 존재하는 레코드 ID 집합 (대상이 사람인지 글인지 구분용) */
function buildIdSet_(rows) {
  var set = {};
  rows.forEach(function (r) { if (r.cells[COL['ID']]) set[String(r.cells[COL['ID']])] = 1; });
  return set;
}

/** 한 행을 앱이 볼 수 있는 형태로: 비밀번호 제거 + 사용자 키 치환 */
function sanitizeRow_(cells, ctx) {
  var out = cells.slice();
  out[COL['비밀번호']] = '';
  var uid = out[COL['사용자ID']];
  if (uid) out[COL['사용자ID']] = publicId_(uid);
  ['대상', '팀'].forEach(function (name) {
    var v = out[COL[name]];
    if (!v) return;
    if (ctx.ids[v]) return;            // 레코드 ID(글·채팅방)는 그대로
    out[COL[name]] = publicId_(v);      // 사람이면 공개 ID로
  });
  return out;
}

function meOf_(userKey) {
  var data = readRows_();
  var nick = '', level = '', discipline = '', bio = '', theme = null, latest = '';
  data.rows.forEach(function (r) {
    var c = r.cells;
    if (c[COL['유형']] !== '프로필') return;
    if (String(c[COL['사용자ID']]).toLowerCase() !== String(userKey).toLowerCase()) return;
    if (c[COL['작성일시']] > latest) {
      latest = c[COL['작성일시']];
      nick = c[COL['닉네임']];
      level = c[COL['실력']];
      discipline = c[COL['주력종목']];
      bio = c[COL['자기소개']];
      theme = c[COL['꾸미기']] || null;
    }
  });
  var parsedTheme = null;
  try { parsedTheme = theme ? JSON.parse(theme) : null; } catch (e) { parsedTheme = null; }
  return {
    key: publicId_(userKey),
    nick: nick || (String(userKey).split('@')[0] || '회원'),
    level: level, discipline: discipline, bio: bio, theme: parsedTheme
  };
}

/* ============================================================
 *  4. 비밀번호 / 세션
 * ============================================================ */
function hashPassword_(password, salt) {
  var value = salt + '|' + password;
  for (var i = 0; i < CONFIG.PASSWORD_ROUNDS; i++) value = sha256Hex_(value + '|' + i);
  return 'sha256$' + CONFIG.PASSWORD_ROUNDS + '$' + salt + '$' + value;
}

function newSalt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }

function verifyPassword_(stored, password) {
  if (!stored) return { ok: false, legacy: false };
  if (stored.indexOf('sha256$') !== 0) {
    /* 예전 시트의 평문 비밀번호: 맞으면 즉시 해시로 바꿉니다 */
    return { ok: String(stored) === String(password), legacy: true };
  }
  var parts = stored.split('$');
  var rounds = parseInt(parts[1], 10);
  var salt = parts[2];
  var expected = parts[3];
  var value = salt + '|' + password;
  for (var i = 0; i < rounds; i++) value = sha256Hex_(value + '|' + i);
  return { ok: value === expected, legacy: false };
}

function cache_() { return CacheService.getScriptCache(); }

function createSession_(userKey) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  cache_().put('sess_' + token, JSON.stringify({ userKey: userKey, at: Date.now() }), CONFIG.SESSION_HOURS * 3600);
  return token;
}

function requireSession_(token) {
  if (!token) return null;
  var raw = cache_().get('sess_' + token);
  if (!raw) return null;
  var data;
  try { data = JSON.parse(raw); } catch (e) { return null; }
  if (!data || !data.userKey) return null;
  /* 사용할 때마다 수명 연장 */
  cache_().put('sess_' + token, raw, CONFIG.SESSION_HOURS * 3600);
  return { token: token, userKey: data.userKey };
}

function logout_(p) {
  if (p.token) cache_().remove('sess_' + p.token);
  return { ok: true };
}

function login_(p) {
  var email = String(p.email || '').trim();
  var password = String(p.password || '');
  var nick = String(p.nick || '').trim();
  if (!email || !password) return { ok: false, code: 'missing', message: '이메일과 비밀번호를 입력해 주세요.' };

  var data = readRows_();
  var userRows = data.rows.filter(function (r) {
    return String(r.cells[COL['사용자ID']]).toLowerCase() === email.toLowerCase();
  });

  if (!userRows.length) {
    if (p.create === false) return { ok: false, code: 'no_user', message: '등록된 사용자가 없습니다.' };
    /* 신규 가입: 프로필 행을 만들고 해시된 비밀번호를 저장 */
    var salt = newSalt_();
    var profileRow = {
      id: recordId(), type: '프로필', createdAt: now_(), date: today_(),
      nick: nick || email.split('@')[0], userKey: email,
      password: hashPassword_(password, salt)
    };
    /* 시작화면 온보딩에서 고른 값이 함께 오면 프로필에 바로 넣습니다 */
    if (p.level) profileRow.level = p.level;
    if (p.discipline) profileRow.discipline = p.discipline;
    appendRow_(profileRow);
    return { ok: true, token: createSession_(email), me: meOf_(email), created: true };
  }

  /* 비밀번호가 저장된 행 찾기 (프로필 우선) */
  var stored = '', storedRow = null, rowIdx = -1;
  userRows.forEach(function (r) {
    var pw = r.cells[COL['비밀번호']];
    if (!pw) return;
    if (!stored || r.cells[COL['유형']] === '프로필') { stored = pw; storedRow = r; }
  });

  if (!stored) {
    /* 비밀번호가 없던 사용자: 지금 설정 */
    var salt2 = newSalt_();
    setPasswordFor_(email, hashPassword_(password, salt2));
    return { ok: true, token: createSession_(email), me: meOf_(email), passwordSet: true };
  }

  var check = verifyPassword_(stored, password);
  if (!check.ok) return { ok: false, code: 'bad_password', message: '비밀번호가 맞지 않습니다.' };

  if (check.legacy) {
    /* 평문 → 해시로 업그레이드 */
    var salt3 = newSalt_();
    setPasswordFor_(email, hashPassword_(password, salt3));
  }
  return { ok: true, token: createSession_(email), me: meOf_(email) };
}

/**
 * 회원가입 전용 입구 (앱의 '회원가입' 버튼).
 * 이미 있는 이메일이면 code:'exists'로 거절합니다. login은 create:false로 부르면
 * 없는 계정을 만들지 않으므로, 로그인/가입을 앱에서 분명히 나눌 수 있습니다.
 */
function register_(p) {
  var email = String(p.email || '').trim();
  var password = String(p.password || '');
  if (!email || !password) {
    return { ok: false, code: 'missing', message: '이메일과 비밀번호를 입력해 주세요.' };
  }
  if (password.length < 6) {
    return { ok: false, code: 'weak_password', message: '비밀번호는 6자 이상으로 정해 주세요.' };
  }
  var data = readRows_();
  var exists = data.rows.some(function (r) {
    return String(r.cells[COL['사용자ID']]).toLowerCase() === email.toLowerCase();
  });
  if (exists) {
    return { ok: false, code: 'exists', message: '이미 가입된 이메일입니다. 로그인해 주세요.' };
  }
  return login_({ email: email, password: password, nick: String(p.nick || '').trim(), create: true });
}

/** 사용자의 모든 행 중 비밀번호가 있던 자리에 해시를 씁니다 */
function setPasswordFor_(userKey, hash) {
  var data = readRows_();
  var sh = sheet_();
  var targets = data.rows.filter(function (r) {
    return String(r.cells[COL['사용자ID']]).toLowerCase() === String(userKey).toLowerCase();
  });
  var wrote = false;
  targets.forEach(function (r) {
    if (r.cells[COL['유형']] !== '프로필') return;
    sh.getRange(r.rowNum, COL['비밀번호'] + 1).setValue(hash);
    sh.getRange(r.rowNum, COL['비밀번호'] + 1).setNumberFormat('@');
    wrote = true;
  });
  if (!wrote) {
    /* 프로필 행이 없으면 하나 만듭니다 */
    appendRow_({ id: recordId(), type: '프로필', createdAt: now_(), nick: String(userKey).split('@')[0], userKey: userKey, password: hash });
  }
}

/* ============================================================
 *  5. 중복 방지 (연타·재시도)
 * ============================================================ */
function dedupeKey_(clientId) { return 'cid_' + sha256Hex_(String(clientId)).slice(0, 24); }

function isDuplicate_(clientId) {
  if (!clientId) return false;
  var k = dedupeKey_(clientId);
  if (cache_().get(k)) return true;
  cache_().put(k, '1', 21600); // 6시간
  return false;
}

/* ============================================================
 *  6. 동작들
 * ============================================================ */
function bootstrap_(session) {
  var data = readRows_();
  var reverse = buildReverseMap_(data.rows);
  var ctx = { reverse: reverse, ids: buildIdSet_(data.rows) };
  var rows = data.rows.map(function (r) { return sanitizeRow_(r.cells, ctx); });
  return {
    ok: true,
    token: session.token,
    me: meOf_(session.userKey),
    rows: rows.slice(-CONFIG.MAX_ROWS_PER_REQUEST),
    count: rows.length,
    syncedAt: now_()
  };
}

function append_(session, p) {
  if (p.clientId && isDuplicate_(p.clientId)) {
    return { ok: true, duplicate: true, id: p.row && p.row[0] };
  }
  var cells = (p.row || []).slice(0, 26);
  while (cells.length < 26) cells.push('');
  var type = String(cells[COL['유형']] || '');
  if (WRITABLE_TYPES.indexOf(type) < 0) {
    return { ok: false, code: 'bad_type', message: '저장할 수 없는 유형입니다: ' + type };
  }

  /* 신뢰 경계: 작성자와 시각은 서버가 정합니다 (위조 방지) */
  if (!cells[COL['ID']]) cells[COL['ID']] = recordId_();
  cells[COL['작성일시']] = now_();
  cells[COL['날짜']] = cells[COL['날짜']] || today_();
  cells[COL['사용자ID']] = session.userKey;
  cells[COL['비밀번호']] = '';

  /* 대상: 공개 ID로 왔으면 원래 키로 되돌립니다 */
  var target = cells[COL['대상']];
  if (target) {
    var data0 = readRows_();
    var reverse = buildReverseMap_(data0.rows);
    var ids0 = buildIdSet_(data0.rows);
    if (!ids0[target]) cells[COL['대상']] = reverse[target] || target;
  }

  /* 하트 규칙 (서버가 최종 판정: 한도·간격·잔액. 앱 값은 믿지 않습니다) */
  var heart = heartStatus_(session.userKey);
  if (type === '광고하트') {
    if (heart.adToday >= CONFIG.AD_HEARTS_PER_DAY) {
      return { ok: false, code: 'ad_limit', message: '오늘 광고 하트를 모두 받았습니다.', balance: heart.balance };
    }
    if (heart.lastAdAt && Date.now() - heart.lastAdAt < CONFIG.AD_COOLDOWN_SEC * 1000) {
      return {
        ok: false, code: 'ad_cooldown',
        retryAfter: Math.ceil((CONFIG.AD_COOLDOWN_SEC * 1000 - (Date.now() - heart.lastAdAt)) / 1000),
        message: '광고는 ' + CONFIG.AD_COOLDOWN_SEC + '초 간격으로 받을 수 있습니다.'
      };
    }
    cells[COL['좋아요']] = String(CONFIG.AD_HEART_REWARD);
  }
  if (type === '출석하트') {
    if (heart.checkinsToday >= CONFIG.CHECKIN_PER_DAY) {
      return { ok: false, code: 'checkin_done', message: '오늘은 이미 출석했습니다.', balance: heart.balance };
    }
    cells[COL['좋아요']] = String(CONFIG.CHECKIN_HEARTS);
  }
  if (type === '선물하트') {
    if (heart.balance < CONFIG.GIFT_HEART_COST) {
      return { ok: false, code: 'no_hearts', message: '하트가 부족합니다.', balance: heart.balance };
    }
    cells[COL['좋아요']] = String(CONFIG.GIFT_HEART_COST);
  }
  if (type === '내하트사용') {
    var amount = parseInt(cells[COL['좋아요']] || '0', 10) || CONFIG.MATCH_HEART_COST;
    if (amount !== CONFIG.MATCH_HEART_COST) {
      return { ok: false, code: 'bad_amount', message: '하트 사용 금액이 올바르지 않습니다.' };
    }
    if (heart.balance < amount) {
      return { ok: false, code: 'no_hearts', message: '하트가 부족합니다.', balance: heart.balance };
    }
    cells[COL['좋아요']] = String(amount);
  }
  if (type === '매칭신청') {
    if (heart.balance < CONFIG.MATCH_HEART_COST) {
      return { ok: false, code: 'no_hearts', message: '하트가 부족합니다.', balance: heart.balance };
    }
  }
  if (type === '꾸미기구매') {
    var themePrice = CONFIG.THEME_PRICES[cells[COL['대상']]];
    if (themePrice === undefined) {
      return { ok: false, code: 'unknown_theme', message: '없는 테마입니다.' };
    }
    if (themePrice > 0 && heart.balance < themePrice) {
      return { ok: false, code: 'no_hearts', message: '하트가 부족합니다.', balance: heart.balance };
    }
    cells[COL['좋아요']] = String(themePrice);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    appendRow_(cells);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: cells[COL['ID']] };
}

function appendRow_(objOrCells) {
  var sh = sheet_();
  var cells;
  if (Array.isArray(objOrCells)) {
    cells = objOrCells.slice();
  } else {
    cells = [];
    for (var i = 0; i < 26; i++) cells.push('');
    Object.keys(objOrCells).forEach(function (k) {
      var name = COL[k] !== undefined ? k : (OBJ_KEYS[k] || null);
      var col = name !== null ? COL[name] : null;
      if (col !== undefined && col !== null) cells[col] = objOrCells[k] === undefined || objOrCells[k] === null ? '' : String(objOrCells[k]);
    });
  }
  while (cells.length < 26) cells.push('');
  sh.appendRow(cells);
  var rowNum = sh.getLastRow();
  /* ID/비밀번호 열은 텍스트로 고정 (1.79229E+15 방지) */
  sh.getRange(rowNum, 1).setNumberFormat('@');
  sh.getRange(rowNum, COL['비밀번호'] + 1).setNumberFormat('@');
  sh.getRange(rowNum, 1).setValue(String(cells[0]));
  return rowNum;
}

var UPDATABLE = {
  '프로필': ['닉네임', '실력', '주력종목', '자기소개', '꾸미기'],
  '매칭프로필': ['소셜글'],
  '코치신청': ['소셜글', '승패'],
  '매칭신청': ['소셜글', '승패'],
  '기록': ['맞춤처방', '추천드릴', '아픈부위', '약점기술', '훈련계획']
};

function update_(session, p) {
  if (p.clientId && isDuplicate_(p.clientId)) return { ok: true, duplicate: true };
  var data = readRows_();
  var hit = null;
  data.rows.forEach(function (r) { if (String(r.cells[COL['ID']]) === String(p.id)) hit = r; });
  if (!hit) return { ok: false, code: 'not_found', message: '해당 기록을 찾지 못했습니다.' };

  var type = hit.cells[COL['유형']];
  var allowed = UPDATABLE[type] || [];
  var owner = String(hit.cells[COL['사용자ID']]).toLowerCase() === String(session.userKey).toLowerCase();
  var isAdmin = isAdmin_(session.userKey);
  var isTarget = String(hit.cells[COL['대상']]).toLowerCase() === String(session.userKey).toLowerCase();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    Object.keys(p.cells || {}).forEach(function (name) {
      if (allowed.indexOf(name) < 0) return;
      if (!(owner || isAdmin || (isTarget && type === '매칭신청'))) return;
      var col = COL[name];
      if (col === undefined || col === COL['비밀번호']) return;
      sh.getRange(hit.rowNum, col + 1).setValue(String(p.cells[name]));
    });
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: p.id };
}

function remove_(session, p) {
  if (p.clientId && isDuplicate_(p.clientId)) return { ok: true, duplicate: true };
  var data = readRows_();
  var hit = null;
  data.rows.forEach(function (r) { if (String(r.cells[COL['ID']]) === String(p.id)) hit = r; });
  if (!hit) return { ok: true, missing: true };
  var owner = String(hit.cells[COL['사용자ID']]).toLowerCase() === String(session.userKey).toLowerCase();
  if (!owner && !isAdmin_(session.userKey)) {
    return { ok: false, code: 'forbidden', message: '내 기록만 삭제할 수 있습니다.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    /* 행을 지우지 않고 비웁니다(아래 행 번호가 밀리지 않게). 앱은 유형 '삭제'를 무시합니다. */
    var range = sh.getRange(hit.rowNum, 1, 1, 26);
    var blank = [];
    for (var i = 0; i < 26; i++) blank.push('');
    blank[0] = String(hit.cells[0]);
    blank[COL['유형']] = '삭제';
    range.setValues([blank]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, id: p.id };
}

function isAdmin_(userKey) {
  var admins = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  if (!admins) return false;
  return admins.split(',').map(function (s) { return s.trim().toLowerCase(); })
    .indexOf(String(userKey).toLowerCase()) >= 0;
}

/* 하트 잔액 = 기본 + 적립(출석·광고·합치기·선물받음) - 사용(매칭·테마·선물보냄) */
function heartBalance_(userKey) {
  var data = readRows_();
  var earned = 0, spent = 0;
  data.rows.forEach(function (r) {
    var c = r.cells;
    var t = c[COL['유형']];
    var uid = c[COL['사용자ID']];
    var target = c[COL['대상']];
    var likes = parseInt(c[COL['좋아요']] || '1', 10) || 1;
    if (t === '출석하트' && uid === userKey) earned += likes;
    if (t === '광고하트' && uid === userKey) earned += likes;
    if (t === '하트합치기' && uid === userKey) earned += likes;
    if (t === '선물하트') {
      if (target === userKey) earned += likes;
      else if (uid === userKey) spent += likes;
    }
    if (t === '내하트사용' && uid === userKey) spent += likes;
    if (t === '꾸미기구매' && uid === userKey) {
      var price = parseInt(c[COL['좋아요']] || '', 10);
      if (isNaN(price)) price = CONFIG.THEME_PRICES[target] || 0;
      spent += price;
    }
  });
  return CONFIG.BASE_HEARTS + earned - spent;
}

/* 오늘의 하트 현황: 광고 횟수·마지막 시각·출석 여부 + 잔액 */
function heartStatus_(userKey) {
  var data = readRows_();
  var today = today_();
  var adToday = 0, lastAdAt = 0, checkinsToday = 0;
  data.rows.forEach(function (r) {
    var c = r.cells;
    if (c[COL['사용자ID']] !== userKey) return;
    var t = c[COL['유형']];
    if (t === '광고하트') {
      if (c[COL['날짜']] === today) adToday++;
      var at = new Date(String(c[COL['작성일시']]).replace(' ', 'T')).getTime();
      if (at > lastAdAt) lastAdAt = at;
    }
    if (t === '출석하트' && c[COL['날짜']] === today) checkinsToday++;
  });
  return {
    adToday: adToday, lastAdAt: lastAdAt, checkinsToday: checkinsToday,
    adRemaining: Math.max(0, CONFIG.AD_HEARTS_PER_DAY - adToday),
    balance: heartBalance_(userKey)
  };
}

/* 하트 규칙 한눈에 보기 (관리 메뉴/디버그용) */
function heartRules() {
  Logger.log(JSON.stringify({
    base: CONFIG.BASE_HEARTS,
    checkin: CONFIG.CHECKIN_HEARTS + ' (하루 ' + CONFIG.CHECKIN_PER_DAY + '회)',
    ad: CONFIG.AD_HEART_REWARD + ' (하루 ' + CONFIG.AD_HEARTS_PER_DAY + '회, ' + CONFIG.AD_COOLDOWN_SEC + '초 간격)',
    match: CONFIG.MATCH_HEART_COST, gift: CONFIG.GIFT_HEART_COST, themes: CONFIG.THEME_PRICES
  }));
}

/* ============================================================
 *  7. 초기 설정 / 관리 메뉴
 * ============================================================ */
function setup() {
  var sh = sheet_();
  /* 헤더 확인 */
  var header = sh.getRange(1, 1, 1, 26).getValues()[0];
  var needHeader = false;
  for (var i = 0; i < 26; i++) if (String(header[i]).trim() !== COLS[i]) needHeader = true;
  if (needHeader) {
    sh.getRange(1, 1, 1, 26).setValues([COLS]);
    sh.setFrozenRows(1);
  }
  /* ID·비밀번호 열을 텍스트로 (과학적 표기 깨짐 방지) */
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange(1, COL['비밀번호'] + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  /* 비밀번호 열도 텍스트 */
  Logger.log('설정 완료: ' + ss_().getName() + ' / ' + CONFIG.TAB);
  return true;
}

/** 이미 깨진 ID(1.79229E+15)를 찾아 알려줍니다 */
function findBrokenIds() {
  var data = readRows_();
  var broken = data.rows.filter(function (r) { return /E\+/.test(r.cells[0]) || /^[0-9.]+E\+?[0-9]+$/i.test(r.cells[0]); });
  Logger.log('깨진 ID ' + broken.length + '개: ' + broken.map(function (r) { return '행 ' + r.rowNum; }).join(', '));
  return broken.length;
}

/** 관리자 이메일 등록 (한 번만) */
function setAdminEmails() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('관리자 이메일', '코치 승인까지 관리할 이메일을 쉼표로 구분해 넣으세요.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAILS', res.getResponseText().trim());
}

/** 시트를 열면 생기는 메뉴 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🏸 배드민턴 앱')
      .addItem('초기 설정 (헤더/서식)', 'setup')
      .addItem('깨진 ID 찾기', 'findBrokenIds')
      .addItem('관리자 이메일 설정', 'setAdminEmails')
      .addItem('하트 규칙 보기', 'heartRules')
      .addToUi();
  } catch (e) { /* 웹 앱에서 열린 경우 메뉴 없음 */ }
}

/* ============================================================
 *  8. 응답
 * ============================================================ */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
