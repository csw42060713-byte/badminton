/* ============================================================
 * test/release.test.js — 플레이 스토어 출시 점검 (보안 · UX · AI 지식 · 캐시)
 *   1) XSS: 사용자 입력이 화면 HTML에 그대로 박히지 않는지 전 화면 렌더로 확인
 *   2) MY 계정 안내가 실제 모드(local/sheets)와 맞는지 (예전 버그 회귀 방지)
 *   3) 배드민턴 AI: 급수별 드릴 · 급수 플랜 · 전술 · 부상 기준/처방
 *   4) PWA: manifest 필수 필드 · sw.js 캐시 목록 · 캐시 키 갱신
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string';
  var fs = hasNode ? require('fs') : null;
  var path = hasNode ? require('path') : null;
  var ROOT = hasNode ? root.__REPO_ROOT__ : '';

  function readRepo(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  }

  var ME_KEY = 'u_test_me';
  var ME = {
    key: ME_KEY, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🏸' }
  };

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function baseState() {
    var rows = BM.fixtures.demo();
    return {
      ready: true, mode: 'local', me: copy(ME), rows: rows,
      data: BM.store.derive(rows, ME_KEY),
      drafts: {
        log: {
          date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: ['스트록', '게임'],
          score: { a: 21, b: 18 }, result: '승', pain: [], weakness: ['드라이브'], note: ''
        }
      },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, coachTab: 'feedback', coachPlayer: null, composer: '', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1. XSS — 저장된 사용자 입력이 HTML로 실행되지 않아야 한다
   * ========================================================= */
  var PAYLOAD = '"><img src=x onerror=alert(1)><script>alert(2)</script>';

  function taint(state) {
    var s = state;
    /* 내 프로필 / 오늘 일지 */
    s.me.nick = PAYLOAD; s.me.bio = PAYLOAD; s.me.club = PAYLOAD; s.me.region = PAYLOAD;
    s.drafts.log.note = PAYLOAD;
    /* 일지 기록 */
    (s.data.records || []).forEach(function (r) {
      r.nick = PAYLOAD; r.note = PAYLOAD;
      if (r.pain) r.pain = [PAYLOAD];
      if (r.weakness) r.weakness = [PAYLOAD];
    });
    /* 커뮤니티 글·답글 */
    (s.data.posts || []).forEach(function (p) {
      p.nick = PAYLOAD; p.text = PAYLOAD;
      (p.replies || []).forEach(function (r) { r.nick = PAYLOAD; r.text = PAYLOAD; });
    });
    /* 매칭 프로필 */
    (s.data.matchProfiles || []).forEach(function (p) {
      p.nick = PAYLOAD; p.bio = PAYLOAD; p.club = PAYLOAD; p.region = PAYLOAD;
      p.experience = PAYLOAD; p.availability = PAYLOAD; p.level = PAYLOAD;
    });
    /* 채팅 */
    (s.data.threads || []).forEach(function (t2) {
      if (t2.last) t2.last.text = PAYLOAD;
      (t2.messages || []).forEach(function (m) { m.text = PAYLOAD; });
    });
    /* 친구 요청·매칭 요청 쪽지 */
    (s.data.friendRequests || []).forEach(function (r) { r.nick = PAYLOAD; });
    (s.data.requests || []).forEach(function (r) { r.note = PAYLOAD; r.status = PAYLOAD; });
    /* 멘토 신청 */
    (s.data.mentorApps || []).forEach(function (a) {
      a.nick = PAYLOAD; a.experience = PAYLOAD; a.awards = PAYLOAD;
      a.reason = PAYLOAD; a.club = PAYLOAD; a.region = PAYLOAD;
    });
    return s;
  }

  /* 앱이 실제로 쓰는 태그만 허용 — 입력값으로 <img>/<script>가 열리면 잡힙니다 */
  var ALLOWED_TAGS = {
    div: 1, span: 1, p: 1, section: 1, article: 1, header: 1, footer: 1, main: 1, nav: 1,
    ul: 1, ol: 1, li: 1, dl: 1, dt: 1, dd: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
    button: 1, form: 1, input: 1, textarea: 1, select: 1, option: 1, label: 1, a: 1,
    img: 1, svg: 1, path: 1, circle: 1, g: 1, br: 1, time: 1, b: 1, i: 1, strong: 1, em: 1,
    small: 1, details: 1, summary: 1, pre: 1, code: 1,
    table: 1, thead: 1, tbody: 1, tr: 1, th: 1, td: 1
  };

  function assertClean(html, label) {
    ok(typeof html === 'string' && html.length > 0, label + ': 화면이 비었습니다');
    excludes(html, '<script', label + ': script 태그가 그대로 나갑니다');
    excludes(html, 'javascript:', label + ': javascript: 링크가 있습니다');
    excludes(html, '<img src=x', label + ': 입력값이 태그로 열렸습니다');
    var re = /<\/?([a-zA-Z][a-zA-Z0-9]*)/g, m;
    while ((m = re.exec(html))) {
      var tag = m[1].toLowerCase();
      if (!ALLOWED_TAGS[tag]) throw new Error(label + ': 허용되지 않은 태그 <' + tag + '> — 이스케이프 누락');
    }
  }

  test('보안: 모든 화면이 사용자 입력을 이스케이프한다 (XSS)', function () {
    BM.auth.signInEmailAccount({ email: 'xss@example.com', name: PAYLOAD, source: 'local' });
    var state = taint(baseState());
    state.analysis = BM.ai.analyze({
      draft: state.drafts.log, records: state.data.records, level: 'C조', discipline: '복식', nick: PAYLOAD
    });
    var screens = [];
    screens.push(['일지', BM.views.log.render(state)]);
    screens.push(['매칭', BM.views.matching.render(state)]);
    screens.push(['커뮤니티', BM.views.community.render(state)]);
    screens.push(['코치', BM.views.coach.render(state)]);
    screens.push(['MY', BM.views.my.render(state)]);
    screens.push(['채팅 목록', BM.views.chat.listHtml(state)]);
    if (state.data.threads && state.data.threads.length) {
      state.ui.chatRoom = state.data.threads[0].roomId;
      screens.push(['채팅방', BM.views.chat.roomHtml(state)]);
    }
    screens.push(['일지 상세', BM.views.log.recordDetail((state.data.records || []).filter(function (r) { return r.cond != null; })[0] || { date: U.ymd(), cond: 6 })]);
    screens.forEach(function (pair) { assertClean(pair[1], pair[0]); });
    BM.auth.signOut();
  });
  test('보안: 매칭 프로필 시트도 이스케이프한다', function () {
    var state = taint(baseState());
    var p = state.data.matchProfiles[0];
    assertClean(BM.views.matching.profileBody(state, p), '프로필 시트');
    assertClean(BM.views.matching.playerCard(p, state), '매칭 카드');
  });

  test('보안: 프로필 미리보기·코치 피드백 카드도 이스케이프한다', function () {
    var state = taint(baseState());
    var key = state.data.matchProfiles[0].userKey;
    assertClean(BM.views.profile.buttons(state, key), '프로필 버튼');
    var coachHtml = BM.views.coach.render(state);
    assertClean(coachHtml, '코치 화면');
  });

  /* =========================================================
   * 2. MY 계정 안내 — 실제 모드(local/sheets)와 일치해야 한다
   * ========================================================= */
  test('MY: 기기 저장(local) 모드에서는 시트 브리지 계정이라고 하지 않는다', function () {
    /* 저장된 브리지 주소가 없어도 bridgeUrl()은 기본 주소를 돌려줍니다.
     * 예전에는 이 값만 보고 '시트 브리지 계정'이라고 잘못 표시했습니다. */
    ok(BM.auth.bridgeUrl().indexOf('https://') === 0, '기본 브리지 주소가 존재');
    BM.auth.signInEmailAccount({ email: 'local-mode@example.com', name: '로컬', source: 'local' });
    var state = baseState();
    state.mode = 'local';
    var html = BM.views.my.render(state);
    includes(html, '이 기기에 저장된 체험 계정', '기기 저장 안내');
    excludes(html, '구글 시트 브리지 계정', '시트 브리지 문구 없음');
    BM.auth.signOut();
  });

  test('MY: 이용안내(도움말)와 개인정보처리방침을 함께 볼 수 있다', function () {
    BM.auth.signOut();
    var html = BM.views.my.render(baseState());
    includes(html, 'data-act="help"', '이용안내 버튼');
    includes(html, '이용안내', '버튼 이름');
    includes(html, 'href="privacy.html"', '개인정보처리방침 링크');
  });

  test('MY: 시트(sheets) 모드에서는 브리지 계정으로 표시한다', function () {
    BM.auth.signInEmailAccount({ email: 'sheet-mode@example.com', name: '시트', source: 'sheets' });
    var state = baseState();
    state.mode = 'sheets';
    var html = BM.views.my.render(state);
    includes(html, '구글 시트 브리지 계정', '시트 브리지 안내');
    excludes(html, '이 기기에 저장된 체험 계정', '기기 저장 문구 없음');
    BM.auth.signOut();
  });

  /* =========================================================
   * 3. 배드민턴 AI 지식
   * ========================================================= */  test('AI: 급수 7단계를 알아본다 (예전 값 포함)', function () {
    ['자강', '선수부', 'A조', 'B조', 'C조', 'D조', '초심'].forEach(function (g) {
      eq(BM.ai.gradeOf(g), g, '급수: ' + g);
    });
    eq(BM.ai.gradeOf('일반부'), 'C조', '예전 값 일반부');
    eq(BM.ai.gradeOf('초보용'), '초심', '예전 값 초보용');
    eq(BM.ai.gradeOf('상급'), 'B조', '예전 값 상급');
    eq(BM.ai.gradeOf('a조'), 'A조', '소문자 조');
    eq(BM.ai.tierOf('자강'), 6, '자강 = 최상위');
  });

  test('AI: 같은 드릴도 급수마다 세트 처방이 다르다', function () {
    var d = BM.ai.DRILLS['드라이브'][0];
    var beginner = BM.ai.setsFor(d, '초심');
    var mid = BM.ai.setsFor(d, 'C조');
    var top = BM.ai.setsFor(d, '자강');
    ok(beginner && mid && top, '세트 값');
    ok(beginner !== mid && mid !== top && beginner !== top, '급수별로 달라야 합니다');
    /* 예전 4단계 문구로 물어봐도 값이 나온다 (기존 화면·시트 호환) */
    ok(BM.ai.setsFor(d, '일반부'), '예전 값 호환');
    ok(BM.ai.setsFor(BM.ai.DRILLS['풋워크'][0], '초심'), '풋워크 세트');
  });

  test('AI: 7급수 플랜과 종목별 전술 노트가 있다', function () {
    ['초심', 'D조', 'C조', 'B조', 'A조', '선수부', '자강'].forEach(function (g) {
      var plan = BM.ai.gradePlan(g);
      eq(plan.grade, g, '플랜 급수: ' + g);
      ok(plan.focus && plan.volume && plan.rules.length >= 2, '플랜 내용: ' + g);
    });
    eq(BM.ai.gradePlan('일반부').grade, 'C조', '예전 값 → C조');
    ['복식', '단식', '혼합복식'].forEach(function (d) {
      var pb = BM.ai.playbook(d, 'A조');
      eq(pb.discipline, d, '종목: ' + d);
      ok(pb.tips.length >= 2, '전술 팁: ' + d);
    });
    /* 초심은 기본 2개만 (정보 과부하 방지) */
    eq(BM.ai.playbook('복식', '초심').tips.length, 2, '초심 전술은 2개');
  });

  test('AI: 스플릿 스텝 논문 수치가 드릴·전술에 반영된다', function () {
    var s = BM.ai.SPLIT_STEP;
    eq(s.reactionSec.join('~'), '0.24~0.25', '반응시간');
    eq(s.stanceHeightRatio.join('~'), '0.51~0.52', '스탠스 폭');
    eq(s.baseRadiusCm.join('~'), '42~55', '베이스 반경');
    includes(s.source, 'PLoS ONE', '출처');

    var drill = BM.ai.DRILLS['풋워크'].filter(function (d) { return d.name === '스플릿스텝 타이밍'; })[0];
    ok(drill, '스플릿 스텝 드릴');
    includes(drill.method, '0.24~0.25초', '반응시간 문구');
    includes(drill.method, '0.51~0.52배', '스탠스 문구');
    var back = BM.ai.DRILLS['풋워크'].filter(function (d) { return d.name === '베이스 복귀 스플릿스텝'; })[0];
    ok(back, '베이스 복귀 드릴');
    includes(back.method, '42~55cm', '베이스 반경 문구');

    var an = BM.ai.analyze({ draft: { weakness: ['풋워크'], discipline: '단식' }, records: [], level: 'B조' });
    includes(an.drills.drills.map(function (d) { return d.method + ' ' + d.point; }).join(' '), '0.24~0.25초', '추천드릴에 반영');
    includes(BM.ai.playbook('단식', 'A조').tips.join(' '), '백핸드 후위', '단식 전술');
  });

  test('AI: 복식 서브·리시브 분석 수치가 드릴·전술에 반영된다', function () {
    var sv = BM.ai.DOUBLES_SERVE, rc = BM.ai.DOUBLES_RECEIVE;
    eq(sv.bodyPct.join('~'), '67~70', '몸쪽 서브 비중');
    eq(sv.lossPct.join('~'), '23~25', '서브 실점률');
    eq(rc.shortDrivePct.join('~'), '38~46', '숏 드라이브');
    eq(rc.drivePct.join('~'), '21~34', '드라이브');
    eq(rc.hairpinPct.join('~'), '15~28', '헤어핀');
    includes(sv.source, '체육과학연구', '출처');

    var serve = BM.ai.DRILLS['서브'].filter(function (d) { return d.name === '숏서브 네트 낮게'; })[0];
    includes(serve.method, '67~70%', '서브 드릴');
    var recv = BM.ai.DRILLS['리시브'].filter(function (d) { return d.name === '서브 리시브 코스'; })[0];
    includes(recv.method, '38~46%', '리시브 드릴');

    var tips = BM.ai.playbook('복식', 'A조').tips.join(' ');
    includes(tips, '67~70%', '복식 전술 서브');
    includes(tips, '38~46%', '복식 전술 리시브');
    includes(BM.ai.gradePlan('C조').rules.join(' '), '직선·대각', 'C조 규칙');
  });

  test('AI: 부상 8부위에 기준·처방·복귀 수칙이 있다', function () {
    ['목', '어깨', '무릎', '허리', '팔꿈치', '손목', '아킬레스건', '발목'].forEach(function (part) {
      var box = BM.ai.INJURY[part];
      ok(box, '부위: ' + part);
      ok(box.signs && box.signs.length >= 1, '진료 기준: ' + part);
      ok(box.rehab && box.rehab.length >= 2, '관리: ' + part);
      ok(box.stretch && box.stretch.length >= 2, '스트레칭: ' + part);
      ok(box.ret && box.ret.length >= 1, '복귀 수칙: ' + part);
    });
    /* domain.js의 통증 목록과 어긋나지 않아야 한다 */
    D.VOCAB.pain.forEach(function (part) { ok(BM.ai.INJURY[part], '통증 목록 누락: ' + part); });
  });

  test('AI: 분석 결과에 급수 플랜·전술·웜업이 함께 담긴다 (시트 호환 유지)', function () {
    var an = BM.ai.analyze({
      draft: { cond: 6, intensity: 6, minutes: 60, pain: ['어깨'], weakness: ['리시브'], discipline: '복식' },
      records: [], level: 'B조', nick: '나래'
    });
    eq(an.grade, 'B조', '급수');
    ok(an.gradePlan && an.gradePlan.grade === 'B조', '급수 플랜');
    ok(an.playbook && an.playbook.discipline === '복식', '전술');
    ok(an.care.warmup && an.care.warmup.length >= 3, '웜업 처방');
    ok(an.drills.drills.length === 3, '드릴 3개');
    ok(an.week.length >= 3, '주간 루틴');
    /* 기존 시트 칸(추천드릴·맞춤처방)은 그대로 JSON */
    var patch = JSON.parse(an.sheetPatch['추천드릴']);
    eq(patch.drills.length, 3, '추천드릴 JSON');
    var care = JSON.parse(an.sheetPatch['맞춤처방']);
    ok(care.rehab && care.stretch && care.mental, '맞춤처방 JSON');
    excludes(an.sheetPatch['추천드릴'], 'function', 'JSON에 함수 없음');
  });

  test('AI: 급수 플랜이 높은 급수에서 4회차 전술 훈련을 넣는다', function () {
    var high = BM.ai.analyze({ draft: { weakness: ['스매시'], discipline: '복식' }, records: [], level: 'A조' });
    eq(high.week.length, 4, 'A조는 4회차');
    includes(high.week[3].menu, '3구', '전술 세션');
    var low = BM.ai.analyze({ draft: { weakness: ['스매시'], discipline: '복식' }, records: [], level: '초심' });
    eq(low.week.length, 3, '초심은 3회차');
  });

  /* =========================================================
   * 4. PWA · 캐시 · 모바일 메타
   * ========================================================= */
  test('PWA: manifest에 플레이 스토어/TWA 필수 항목이 모두 있다', function () {
    var m = JSON.parse(readRepo('manifest.webmanifest'));
    ['name', 'short_name', 'description', 'start_url', 'scope', 'display',
      'orientation', 'theme_color', 'background_color', 'icons'].forEach(function (k) {
      ok(m[k], 'manifest.' + k);
    });
    eq(m.display, 'standalone', 'display');
    eq(m.orientation, 'portrait', 'orientation');
    var sizes = m.icons.map(function (i) { return i.sizes; });
    ok(sizes.indexOf('192x192') >= 0 && sizes.indexOf('512x512') >= 0, '192/512 아이콘');
    ok(m.icons.some(function (i) { return i.purpose === 'maskable'; }), 'maskable 아이콘');
    /* manifest.json은 호환용 사본 — 내용이 같아야 한다 */
    var legacy = JSON.parse(readRepo('manifest.json'));
    eq(JSON.stringify(legacy), JSON.stringify(m), 'manifest.json 사본 일치');
  });

  test('PWA: index.html 모바일 메타와 개인정보처리방침 링크', function () {
    var html = readRepo('index.html');
    includes(html, 'viewport-fit=cover', '노치 대응');
    includes(html, 'name="theme-color"', '테마 컬러');
    includes(html, 'rel="manifest"', '매니페스트');
    includes(html, 'rel="privacy-policy"', '개인정보처리방침');
    includes(html, 'id="netbar"', '오프라인 안내 막대');
    includes(html, 'apple-touch-icon', '홈화면 아이콘');
  });

  test('PWA: sw.js 캐시 목록에 모든 화면 파일이 들어 있다', function () {
    var sw = readRepo('sw.js');
    var index = readRepo('index.html');
    ok(/var VERSION = 'bm-v\d+\.\d+\.\d+'/.test(sw), 'VERSION 형식');
    var srcs = (index.match(/src="([^"]+\.js)"/g) || []).map(function (s) { return s.replace(/src="|"/g, ''); });
    ok(srcs.length >= 15, '스크립트 개수');
    srcs.forEach(function (f) { includes(sw, "'./" + f + "'", 'sw.js 캐시 누락: ' + f); });
    includes(sw, "'./styles.css'", 'styles.css');
    includes(sw, "'./privacy.html'", 'privacy.html');
    includes(sw, "'./manifest.webmanifest'", 'manifest');
    includes(sw, "'./icons/icon-maskable-512.png'", 'maskable 아이콘');
  });

  test('PWA: 보상형 광고 어댑터가 앱·캐시에 들어 있다', function () {
    var index = readRepo('index.html');
    var sw = readRepo('sw.js');
    var ads = readRepo('js/ads.js');
    includes(index, 'js/ads.js', 'index.html 스크립트');
    includes(sw, "'./js/ads.js'", 'sw.js 캐시');
    includes(ads, 'showRewardedAd', '네이티브 브리지');
    includes(ads, 'onRewardAdResult', '웹뷰 콜백');
    includes(ads, 'reason', '지급 판정');
    excludes(ads, 'ca-app-pub-1234', '광고 단위 하드코딩 없음');
  });

  test('PWA: 스타일 캐시 키가 갱신되어 있다', function () {
    var html = readRepo('index.html');
    var m = html.match(/styles\.css\?v=(\d{8}-\d+)/);
    ok(m, 'styles.css?v= 캐시 키');
    ok(Number(m[1].replace('-', '')) >= 202611190, '오늘 날짜 이상으로 갱신: ' + m[1]);
  });

  test('UX: 터치 타겟·키보드·포커스 규칙이 있다', function () {
    var css = readRepo('styles.css');
    includes(css, '@media (pointer: coarse)', '손가락 입력 대응');
    includes(css, 'min-height: 44px', '44px 터치 타겟');
    includes(css, ':focus-visible', '키보드 포커스 표시');
    includes(css, '--kbd', '키보드 여백 변수');
    includes(css, '.netbar', '오프라인 안내 스타일');
    includes(css, '.planbox', '급수 플랜 스타일');
  });

  test('보안: 공개 저장소에 시트 ID·실제 비밀번호가 없다', function () {
    var gs = readRepo('APPS_SCRIPT_BRIDGE.gs');
    includes(gs, "getProperty('SHEET_ID')", 'SHEET_ID는 스크립트 속성에서');
    includes(gs, "getProperty('AUTH_SECRET')", 'AUTH_SECRET은 스크립트 속성에서');
    excludes(gs, 'AKfycb', '배포 주소 하드코딩 없음');
    ok(!/SHEET_ID:\s*'[A-Za-z0-9_-]{30,}'/.test(gs), 'SHEET_ID 실제 값 없음');
    /* 앱 쪽: 기본 브리지 주소만 두고, 비밀번호는 해시로만 보관한다 */
    var auth = readRepo('js/auth.js');
    includes(auth, "'sha256$'", '비밀번호는 SHA-256 해시');
    includes(auth, 'hash: hash', '저장은 해시 값으로');
    excludes(auth, 'hash: password', '평문 저장 없음');
  });

  /* =========================================================
   * 5. 화면 회귀 — 2026-11-19 14:00 오류 점검에서 고친 것들
   * ========================================================= */
  test('DM: 로그아웃 후 다시 로그인해도 최신 ctx로 동작한다', function () {
    var chat = readRepo('js/views/chat.js');
    includes(chat, 'host.__dmCtx = ctx', '다시 bind할 때 현재 ctx를 기억');
    includes(chat, 'ctx = host.__dmCtx || ctx', '이벤트는 기억한 ctx를 사용');
  });

  test('MY: 테마는 저장에 성공했을 때만 적용하고 실패를 알린다 (v1.57 무료 테마)', function () {
    var my = readRepo('js/views/my.js');
    includes(my, 'function pickTheme(ctx, id)', '테마 선택 전용 함수');
    includes(my, 'var res = ctx.actions.setTheme(id);', '저장을 먼저');
    includes(my, "if (res && res.ok)", '성공했을 때만 토스트');
    includes(my, "UI.toast('테마를 바꾸지 못했어요', 'error')", '실패 안내는 그대로');
    excludes(my, "document.documentElement.setAttribute('data-theme'", '테마 적용은 paintChrome이 맡는다');
    excludes(my, 'theme__lock', 'bm-v1.60.0 — 테마가 모두 무료라 잠금·가격 표시 없음');
    var at = my.indexOf('function pickTheme(ctx, id)');
    var seg = my.slice(at, my.indexOf('\n  }', at));
    excludes(seg, "res.reason === 'hearts'", '테마에 하트 차감 안내 없음');
  });

  test('MY: 다시 그려도 보던 스크롤 위치를 지킨다', function () {
    var app = readRepo('app.js');
    includes(app, 'function repaint()', 'repaint');
    includes(app, 'window.scrollTo(0, y)', '스크롤 복원');
  });

  test('UI: 이벤트 처리 블록이 중복되지 않는다 (일지 결과 버튼)', function () {
    var log = readRepo('js/views/log.js');
    var n = (log.match(/var seg = ev\.target\.closest\('\[data-segval\]'\)/g) || []).length;
    eq(n, 1, 'data-segval 처리 블록은 하나');
  });

  test('UI: 구글 로그인·온보딩 버튼은 연타를 막는다', function () {
    var start = readRepo('js/views/start.js');
    includes(start, "if (act.dataset.busy === '1') return", '구글 로그인 연타 방지');
    includes(start, 'if (ui.busy) return;', '온보딩 시작하기 연타 방지');
  });

  test('UX: 아이콘만 있는 답글 전송 버튼에 이름이 있다', function () {
    var community = readRepo('js/views/community.js');
    includes(community, 'aria-label="답글 보내기"', '스크린리더용 이름');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
