/* ============================================================
 * test/v150.test.js — bm-v1.52.2
 *   🎥 영상 자세 비교 — 폰 안에서만 도는 MediaPipe Pose 파이프라인
 *
 *  1) 계산(순수 함수) — 좌표만 있으면 같은 결과가 나온다
 *     · angleAt / dist / frameMetrics (팔꿈치·타점·무릎·몸통 기울기)
 *     · planSamples (12~20프레임 · 영상 길이 안 · 시간 오름차순)
 *     · measure — 스매시(임팩트·준비·착지 순간 고르기) / 풋워크(런지 고르기)
 *     · cardsFor 판정(좋아요·조금 낮아요·조금 높아요) + 쉬운 말 보완점
 *     · 사람이 안 나온 프레임·너무 짧은 영상은 조용히 실패(앱이 죽지 않음)
 *  2) 화면 — 일지 & AI 입구 버튼, 개인정보 안내, 스켈레톤 캔버스, 카드 HTML
 *  3) 배선·보안 — CSP(CDN·WASM·blob 영상만 추가), MediaPipe 주소 고정,
 *     영상을 서버로 보내지 않음(Supabase·앱 기록 접근 없음)
 *  4) 버전 — sw · app · index · TWA
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var P = BM.pose;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, near = t.near;
  var includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* 기준 자세 — demoFrames와 같은 생성기를 그대로 씁니다 */
  function frame(mode, i) { return P.demoFrames(mode)[i]; }

  test('v1.50 자세: 사잇각·거리 계산이 정확하다', function () {
    var a = { x: 0, y: 0 }, b = { x: 0, y: 1 }, c = { x: 1, y: 1 };
    near(P.angleAt(a, b, c), 90, 0.001, '직각');
    near(P.angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }), 180, 0.001, '일직선');
    near(P.angleAt({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }), 0, 0.001, '겹친 방향');
    ok(isNaN(P.angleAt(a, a, c)), '길이 0이면 NaN(계산 불가)');
    near(P.dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5, 0.0001, '3-4-5');
  });

  test('v1.50 자세: 한 프레임 수치 — 팔꿈치·타점·무릎·몸통 기울기', function () {
    var f = P.poseFrame({ elbowAng: 165, kneeFlex: 70 });
    var m = P.frameMetrics(f, 'R');
    ok(m && m.valid !== false, '수치가 나온다');
    near(m.elbow, 165, 0.5, '팔꿈치 각도 그대로');
    ok(m.reach > 0.8 && m.reach < 1.6, '타점은 몸통 길이의 1배 근처: ' + m.reach);
    near(m.kneeFlexR, 70, 0.6, '오른 무릎 굽힘');
    near(m.kneeFlexL, 70, 0.6, '왼 무릎 굽힘');
    ok(m.tilt >= 0 && m.tilt < 20, '몸통은 거의 세워짐: ' + m.tilt);
    ok(m.torso > 0.1, '몸통 길이를 잰다');

    /* 팔을 낮추면 타점이 내려간다 */
    var low = P.frameMetrics(P.poseFrame({ elbowAng: 120, armDir: 90 }), 'R');
    ok(low.reach < m.reach, '팔을 내리면 타점이 낮아진다');

    /* 몸을 앞으로 기울이면 기울기 각이 커진다 */
    var lean = P.frameMetrics(P.poseFrame({ leanX: 0.12 }), 'R');
    ok(lean.tilt > 25, '앞으로 기울면 25° 이상: ' + lean.tilt);

    /* 좌표가 없으면 조용히 null */
    eq(P.frameMetrics(null, 'R'), null, '좌표 없음');
    eq(P.frameMetrics([{ x: 0, y: 0 }], 'R'), null, '점이 모자람');
  });

  test('v1.50 자세: 라켓 팔을 영상에서 알아서 고른다', function () {
    eq(P.detectSide(P.demoFrames('smash')), 'R', '오른팔이 더 많이 움직임');
    var mirrored = P.demoFrames('smash').map(function (f) {
      return { t: f.t, lm: f.lm.map(function (p) { return { x: 1 - p.x, y: p.y }; }) };
      /* 좌우만 뒤집으면 왼손잡이 영상과 같습니다 — 라켓 팔은 여전히 '많이 움직인 쪽' */
    });
    var side = P.detectSide(mirrored);
    ok(side === 'L' || side === 'R', '팔을 고른다: ' + side);
  });

  test('v1.50 자세: 샘플 프레임 계획 — 12~20프레임 · 영상 안 · 오름차순', function () {
    var s = P.planSamples(3.2);
    eq(s.length, P.SAMPLE_N, '기본 16프레임');
    ok(s.length >= 12 && s.length <= 20, '12~20 사이');
    var prev = -1, mono = true;
    s.forEach(function (v) { if (v <= prev) mono = false; prev = v; });
    ok(mono, '시간이 오름차순');
    ok(s[0] >= 0 && s[s.length - 1] <= 3.2, '영상 길이 안');
    eq(P.planSamples(0).length, 0, '길이가 0이면 빈 목록');
    eq(P.planSamples(10, 40).length, 20, '많이 달라고 해도 20장까지');
    eq(P.planSamples(10, 3).length, 12, '적게 달라고 해도 12장');
    /* 아주 짧은 영상(0.4초)도 시간이 겹치지 않게 */
    var tiny = P.planSamples(0.4);
    ok(tiny.length >= 12 && tiny[tiny.length - 1] <= 0.4, '짧은 영상도 안전');
  });

  test('v1.50 자세: 스매시 — 임팩트·준비·착지 순간을 고르고 카드를 만든다', function () {
    var r = P.measure(P.demoFrames('smash'), 'smash');
    ok(r.ok, '분석 성공');
    eq(r.mode, 'smash', '모드');
    eq(r.count, 16, '16프레임');
    /* bm-v1.53.0 — 점프 최고점 · 타점 타이밍 카드가 한 장 더 붙습니다(제자리 예시는 중립) */
    eq(r.cards.length, 5, '카드 5장(점프 타이밍 포함)');
    var keys = r.cards.map(function (c) { return c.key; }).join(',');
    eq(keys, 'elbow,reach,prepKnee,tilt,jump', '카드 순서(팔꿈치·타점·무릎·몸통·점프)');

    /* 예시는 팔꿈치 150° — 기준(155~175)보다 낮아서 보완점이 나와야 합니다 */
    var elbow = r.cards[0];
    eq(elbow.verdict, 'low', '팔꿈치 150°는 낮음');
    includes(elbow.tip, '팔을 쭉 펴', '쉬운 말 보완점');
    eq(elbow.text, '150', '수치 그대로');
    ok(r.summary.indexOf('팔을 쭉 펴') >= 0, '맨 위 한 줄은 가장 먼저 고칠 것');

    /* 나머지는 기준 안 */
    eq(r.cards[1].verdict, 'good', '타점은 기준 안');
    eq(r.cards[2].verdict, 'good', '무릎은 기준 안');
    eq(r.cards[3].verdict, 'good', '몸통은 기준 안');

    /* 준비 프레임은 임팩트보다 앞, 착지는 뒤 */
    var pk = r.picks;
    ok(pk.prep <= pk.key && pk.key <= pk.landing, '준비 → 임팩트 → 착지 순서');
    ok(pk.values.prepKnee >= 58, '준비 무릎 굽힘: ' + pk.values.prepKnee);
    ok(r.rows.length === 16, '프레임별 수치도 남긴다');
  });

  test('v1.50 자세: 풋워크 — 가장 넓게 벌린 순간을 런지로 고른다', function () {
    var r = P.measure(P.demoFrames('foot'), 'foot');
    ok(r.ok, '분석 성공');
    eq(r.mode, 'foot', '모드');
    eq(r.cards.length, 4, '카드 4장');
    var keys = r.cards.map(function (c) { return c.key; }).join(',');
    eq(keys, 'stance,lungeKnee,rearKnee,lungeTilt', '카드 순서');
    var stance = r.cards[0];
    eq(stance.verdict, 'good', '발 간격은 기준 안');
    ok(stance.value > 1.4 && stance.value < 2.1, '발 간격 1.45~2.05: ' + stance.value);
    eq(r.cards[1].verdict, 'good', '앞무릎 75°는 기준 안');
    eq(r.cards[1].text, '75', '앞무릎 수치');
    eq(r.cards[2].verdict, 'low', '뒷다리를 굽히면 낮음');
    includes(r.cards[2].tip, '뒷다리를 펴', '쉬운 말 보완점');
    ok(r.picks.key > 0 && r.picks.key < 15, '런지 순간을 영상 중간에서 고름: ' + r.picks.key);
  });

  test('v1.50 자세: 판정 경계 — 기준 안/낮음/높음', function () {
    eq(P.verdictOf(165, { min: 155, max: 175 }), 'good', '안');
    eq(P.verdictOf(154.9, { min: 155, max: 175 }), 'low', '낮음');
    eq(P.verdictOf(175.1, { min: 155, max: 175 }), 'high', '높음');
    eq(P.verdictOf(null, { min: 1, max: 2 }), 'na', '잴 수 없음');
    /* 낮을수록 좋은 항목(몸통 기울기)은 min 0에서 '낮음'이 나오지 않는다 */
    var cards = P.cardsFor({ tilt: 3 }, 'smash');
    var tilt = cards[3];
    eq(tilt.verdict, 'good', '0~20° 안');
    includes(tilt.badge, '좋아요', '배지 말');
    /* 막대는 0~100% 안 */
    cards.concat(P.cardsFor({ stance: 99 }, 'foot')).forEach(function (c) {
      var p = P.barPct(c);
      ok(p >= 0 && p <= 100, '막대 ' + c.key + ' = ' + p);
    });
  });

  test('v1.50 자세: 사람이 안 보이거나 영상이 짧으면 앱이 죽지 않는다', function () {
    var none = P.measure([{ t: 0, lm: null }, { t: 0.1, lm: null }, { t: 0.2, lm: null }], 'smash');
    eq(none.ok, false, '사람 없음');
    eq(none.reason, 'few-frames', '이유');
    var few = P.measure([P.demoFrames('smash')[8]], 'smash');
    eq(few.ok, false, '프레임 1장');
    var mixed = P.measure([
      { t: 0, lm: null }, frame('smash', 0), frame('smash', 4),
      frame('smash', 8), frame('smash', 12), { t: 1, lm: null }
    ], 'smash');
    ok(mixed.ok, '군데군데 비어도 나머지로 계산');
    var empty = P.measure([], 'foot');
    eq(empty.ok, false, '빈 목록');
  });

  test('v1.50 화면: 일지 & AI 첫 카드에 영상 자세 비교 입구가 있다', function () {
    var html = BM.views.log.render({
      me: { nick: '선수', level: '선수부' },
      ui: { tab: 'log', editLogId: null },
      drafts: { log: { date: '2026-11-22', done: [], pain: [], weakness: [], games: [] } },
      data: { records: [], stats: {}, requests: [], unread: 0 },
      analysis: null
    });
    includes(html, 'data-act="open-pose"', '입구 버튼');
    includes(html, '영상 자세 비교', '이름');
    includes(html, '폰 안에서만 분석', '안내 문구');
    includes(html, 'data-act="open-scoreboard"', '기존 점수판 버튼도 그대로');
    includes(html, 'courttools', '두 도구를 한 줄에');
    var log = readRoot('js/views/log.js');
    includes(log, "closest('[data-act=\"open-pose\"]')", '클릭 연결');
    includes(log, 'BM.pose.openFrom(ctx)', '패널 열기');
    includes(log, "closest('[data-act=\"open-scoreboard\"]')", '점수판 연결 유지');
  });

  test('v1.50 화면: 개인정보 안내 · 캔버스 · 카드 HTML', function () {
    var shell = P.shellHtml();
    includes(shell, '영상은 서버로 전송되지 않고', '개인정보 안내');
    includes(shell, '내 폰 안에서만', '폰 안에서만');
    includes(shell, 'accept="video/*"', '영상만 고르기');
    includes(shell, 'data-pose-canvas', '스켈레톤 캔버스');
    includes(shell, 'data-pose-range', '프레임 이동');
    includes(shell, 'data-pose-mode="smash"', '종목 선택 — 스매시');
    includes(shell, 'data-pose-mode="foot"', '종목 선택 — 풋워크');
    includes(shell, 'data-pose-demo', '영상 없이 예시로 보기');
    includes(shell, 'data-pose-close', '닫기');

    var r = P.measure(P.demoFrames('smash'), 'smash');
    var cards = P.cardsHtml(r);
    includes(cards, '임팩트 팔꿈치 각도', '카드 이름');
    includes(cards, '150', '측정값');
    includes(cards, '155~175°', '기준 범위');
    includes(cards, '조금 낮아요', '판정 배지');
    includes(cards, '팔을 쭉 펴', '보완점');
    includes(cards, 'data-pose-card="elbow"', '테스트·확인용 표시');
    excludes(cards, '<script', '스크립트를 넣지 않는다');
    /* 참고 논문은 맨 아래 작은 줄에만 */
    includes(shell, 'data-pose-foot', '참고 줄');
    includes(P.refNote('smash'), 'Miller', '스매시 근거');
    includes(P.refNote('foot'), 'Shishido', '풋워크 근거');
  });

  test('v1.50 화면: 일지 메모에 넣는 문구는 짧고 읽힌다', function () {
    var r = P.measure(P.demoFrames('smash'), 'smash');
    var line = P.noteLine(r);
    includes(line, '영상 자세 비교', '제목');
    includes(line, '팔꿈치 각도 150', '수치');
    ok(line.length < 160, '메모 한 줄 길이: ' + line.length);
    excludes(line, 'p<', '통계 기호 없음');
  });

  test('v1.50 스켈레톤: 캔버스에 뼈대·관절을 그린다(가짜 캔버스로 확인)', function () {
    var calls = { line: 0, arc: 0, move: 0 };
    var g = {
      save: function () {}, restore: function () {},
      beginPath: function () {}, stroke: function () {}, fill: function () {},
      moveTo: function () { calls.move++; },
      lineTo: function () { calls.line++; },
      arc: function () { calls.arc++; },
      set lineWidth(v) {}, set strokeStyle(v) {}, set fillStyle(v) {}, set lineCap(v) {}, set lineJoin(v) {}
    };
    P.drawSkeleton(g, P.poseFrame({}), { w: 360, h: 480, side: 'R' });
    ok(calls.line >= P.BONES.length, '뼈대 선을 그린다: ' + calls.line);
    ok(calls.arc >= 20, '관절 점을 찍는다: ' + calls.arc);
    ok(calls.move >= P.BONES.length, '각 선의 시작점');
    /* 좌표가 없으면 아무것도 그리지 않는다 */
    var before = calls.arc;
    P.drawSkeleton(g, null, { w: 360, h: 480 });
    eq(calls.arc, before, '좌표 없으면 그리지 않음');
  });

  test('v1.50 MediaPipe: 주소를 고정하고 실패를 사용자 말로 알린다', function () {
    includes(P.CDN_BASE, 'cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14', 'CDN·버전 고정');
    includes(P.MODEL_URL, 'storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite', '자세 모델');
    includes(P.loadHint(), '10MB', '모델 크기 안내');
    includes(P.failHint(new Error('net::ERR_INTERNET_DISCONNECTED')), '인터넷 연결 후 첫 분석 모델', '오프라인 안내');
    includes(P.failHint(new Error('SecurityError: CSP')), '브라우저 보안 설정', 'CSP 실패 안내');
    eq(P.modelState().ready, false, '아직 안 불러옴(테스트에서는 네트워크를 쓰지 않음)');
  });

  test('v1.50 보안: CSP에 자세 모델 출처만 더했고 영상은 기기 안에서만', function () {
    var index = readRoot('index.html');
    var m = index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    ok(m, 'CSP 메타');
    var csp = m[1];
    includes(csp, 'https://cdn.jsdelivr.net', '자세 모델 코드');
    includes(csp, 'https://storage.googleapis.com', '자세 모델 파일');
    includes(csp, "'wasm-unsafe-eval'", 'WASM 실행');
    includes(csp, "media-src 'self' blob:", '폰에서 고른 영상(blob)만 재생');
    includes(csp, "object-src 'none'", 'object-src 그대로');
    includes(csp, "base-uri 'none'", 'base-uri 그대로');
    includes(csp, "form-action 'self'", 'form-action 그대로');
    excludes(csp, "'unsafe-eval'", 'eval 허용 안 함');
    excludes(csp, "'unsafe-inline'; style-src", '스크립트 인라인 허용 안 함');
    includes(csp, "script-src 'self' https://accounts.google.com 'sha256-", '스크립트는 self·구글·해시부터');

    var pose = readRoot('js/pose.js');
    excludes(pose, 'supabase', '실서버(DB) 접근 없음');
    excludes(pose, 'app_records', '앱 기록 테이블 없음');
    excludes(pose, 'XMLHttpRequest', '직접 업로드 없음');
    excludes(pose, "method: 'POST'", '업로드 없음');
    includes(pose, 'URL.createObjectURL', '기기 안 blob 주소로만 연다');
    includes(pose, 'URL.revokeObjectURL', '다 쓰면 주소를 지운다');
    excludes(pose, 'window.confirm(', '브라우저 confirm 창 없음');
    includes(pose, 'U.esc(', '사용자가 넣은 값도 탈출');
    excludes(pose, 'innerHTML = name', '이름을 그대로 넣지 않음');
  });

  test('v1.50 배선: index.html·sw.js 캐시에 js/pose.js가 들어 있다', function () {
    var index = readRoot('index.html');
    var sw = readRoot('sw.js');
    includes(index, 'js/pose.js', 'index.html 스크립트');
    includes(sw, "'./js/pose.js'", 'sw.js SHELL');
    ok(index.indexOf('js/pose.js') < index.indexOf('src="app.js"'), 'app.js보다 먼저');
    ok(index.indexOf('js/report.js') < index.indexOf('js/pose.js'), 'report.js 다음');
    includes(readRoot('test/run.js'), 'js/pose.js', '테스트 목록');
    includes(readRoot('test/run.js'), 'test/v150.test.js', '테스트 목록');
  });

  test('v1.50 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.77.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.77.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261125-6', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.77.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 71', '앱 버전 코드 +1');
  });

  test('v1.50 근거: 논문 수치는 참고 줄에만, 화면 문구는 코트 말투', function () {
    var pose = readRoot('js/pose.js');
    ['Miller', 'King', 'Nishino', 'Xie', 'Shishido', 'Towler', 'Kuntze', 'Lam'].forEach(function (name) {
      includes(pose, name, '출처 ' + name);
    });
    includes(pose, '165±5°', 'Miller 팔꿈치 수치');
    includes(pose, '166.1±4.3°', 'King 팔꿈치 수치');
    includes(pose, '110±12°', 'Miller 준비 무릎 수치');
    includes(pose, '81.7±8.6°', 'Xie 런지 무릎 수치');
    includes(pose, '신장의 50%', 'Shishido 스플릿 스텝 간격');
    includes(pose, '신장의 145~159%', '타점 = 신장 비율');
    excludes(pose, 'blog.naver', '블로그 출처 없음');
    excludes(pose, 'tistory', '블로그 출처 없음');
    excludes(pose, 'p<0.05', '통계 기호를 화면 말에 쓰지 않음');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
