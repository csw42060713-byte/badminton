/* ============================================================
 * test/v153.test.js — bm-v1.53.0
 *   🦘 점프 최고점 임팩트 분석 + 통증은 조금이라도 아프면 바로 쉬기
 *
 *  사용자가 알려 준 실전 원칙 두 가지를 그대로 검증합니다.
 *   1) "점프를 하고 내려올 때 치면 타점이 내려가기 때문에 점프한 최고지점에서 공을 쳐야 한다"
 *      · jumpTiming — 골반 높이로 점프 최고점을 찾고 임팩트와 비교(좋아요 / 조금 늦어요)
 *      · 제자리 타격은 '제자리 타점' 중립 — 억지로 지적하지 않음, '보완 N건'에도 안 셈
 *      · 점프 예시 2구간(최고점 타점 / 내려오며 타점) · 일지 메모 · 카드 화면
 *   2) "아프다는 느낌이 들면 바로 쉬고 상태를 보는 게 최고. 조금 아프더라도"
 *      · PAIN_RULE — AI 진단·맞춤처방·오늘 추천·내일 루틴·관절 보호 체크·강도 조절에 같은 기준
 *   3) 버전 · 배선 · 보안(영상은 여전히 기기 안에서만)
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var P = BM.pose;
  var AI = BM.ai;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function cardOf(r, key) {
    var out = null;
    (r.cards || []).forEach(function (c) { if (c.key === key) out = c; });
    return out;
  }

  /* 한 구간 노드(화면·구간 칩이 쓰는 모양) */
  function nodeOf(pack, mode) {
    var analysis = P.analyzeSegment(pack.frames, mode || 'smash');
    return { seg: pack.seg, frames: pack.frames, analysis: analysis, track: analysis.pick };
  }

  /* ============================================================
   * 1. 점프 최고점 · 임팩트 타이밍 (순수 함수)
   * ============================================================ */

  test('v1.53 점프: 최고점에서 치면 좋아요 — 최고점 프레임과 임팩트 프레임이 같다', function () {
    var r = P.measure(P.jumpFrames('good'), 'smash');
    ok(r.ok, '분석 성공');
    var c = cardOf(r, 'jump');
    ok(c, '점프 카드가 있다');
    eq(r.jump.jump, true, '점프로 인정');
    eq(r.jump.kind, 'good', '판정');
    eq(c.verdict, 'good', '카드 판정');
    includes(c.badge, '좋아요', '배지');
    eq(c.value, 100, '최고점 높이의 100%');
    eq(c.text, '100', '수치');
    eq(c.unit, '%', '단위');
    includes(c.refText, '85%', '기준');
    includes(c.tip, '최고점');
    eq(r.jump.peak, r.jump.impact, '최고점 프레임에서 임팩트');
    eq(r.jump.gap, 0, '프레임 차 0');
    ok(r.jump.rise >= P.JUMP.minRise, '점프 높이: ' + r.jump.rise + '몸통');
    ok(r.jump.peak > 0 && r.jump.peak < 15, '최고점은 영상 중간');
  });

  test('v1.53 점프: 내려오면서 치면 조금 늦어요 — 몇 초·몇 프레임 늦었는지 짚는다', function () {
    var r = P.measure(P.jumpFrames('late'), 'smash');
    ok(r.ok, '분석 성공');
    var c = cardOf(r, 'jump');
    eq(r.jump.jump, true, '점프로 인정');
    eq(r.jump.kind, 'late', '하강 구간 임팩트');
    eq(c.verdict, 'low', '카드 판정');
    includes(c.badge, '늦', '배지');
    ok(r.jump.gap > r.jump.tol, '최고점보다 뒤: ' + r.jump.gap + '프레임');
    ok(c.value < P.JUMP.latePct, '최고점 높이의 ' + c.value + '%까지 내려옴');
    includes(c.tip, '내려오면서', '원리 그대로');
    includes(c.tip, '최고점', '최고점에서 치라고');
    includes(c.tip, '초(', '몇 초 늦었는지');
    ok(c.tip.indexOf('스윙') >= 0, '스윙 시작 시점까지 알려 줌');
    /* 맨 위 한 줄도 점프를 먼저 짚는다 */
    includes(r.summary, '최고점');
    /* 일지 메모에도 늦은 타점이 남는다 */
    includes(P.noteLine(r, { segTime: '0.0~1.5초' }), '늦은 타점');
  });

  test('v1.53 점프: 제자리 타격은 억지로 지적하지 않는다(중립 · 보완 N건 제외)', function () {
    var frames = P.demoFrames('smash');       /* v1.50부터 쓰던 제자리 스매시 예시 */
    var r = P.measure(frames, 'smash');
    var c = cardOf(r, 'jump');
    ok(c, '카드는 보여 준다');
    eq(r.jump.jump, false, '점프로 안 봄');
    eq(r.jump.kind, 'stay', '중립');
    eq(c.verdict, 'stay', '판정 중립');
    eq(c.value, null, '수치 없음');
    eq(c.text, '제자리', '제자리 타점');
    includes(c.badge, '제자리', '배지');
    includes(c.tip, '제자리');
    excludes(r.summary, '점프', '맨 위 한 줄은 점프를 안 짚는다');
    /* 구간 칩 요약 — 원래 있던 팔꿈치 1건만 센다 */
    var node = nodeOf({ seg: { label: '1구간', start: 0, end: 1 }, frames: frames });
    eq(P.segSummary(node).text, '보완 1건', '제자리 타점은 보완으로 안 셈');
    /* 메모에도 점프 문구를 끼워 넣지 않는다 */
    excludes(P.noteLine(r, {}), '점프', '메모 중립');
  });

  test('v1.53 점프: 점프가 확실하지 않으면(중간부터 찍힌 영상 · 프레임 부족) 판정하지 않는다', function () {
    var mid = P.jumpFrames('good').slice(6);   /* 이미 떠 있는 장면부터 시작 */
    var r = P.measure(mid, 'smash');
    eq(r.jump.jump, false, '뜨기 전이 없으면 점프로 안 봄');
    eq(r.jump.kind, 'stay', '중립');

    var few = P.jumpTiming([{ t: 0, m: { hipY: 0.5, torso: 0.2 } }], 0);
    eq(few.jump, false, '프레임이 적으면 판정 없음');
    eq(few.reason, 'few-frames', '이유');
    var noHip = P.jumpTiming(P.measure(P.jumpFrames('good'), 'smash').rows.map(function (x) {
      return { t: x.t, i: x.i, m: { torso: 0.2 } };
    }), 2);
    eq(noHip.jump, false, '골반 좌표가 없으면 안전');
    eq(noHip.reason, 'no-hip', '이유');
    eq(P.jumpTiming(null, 0).jump, false, '빈 입력도 안전');
  });

  test('v1.53 점프: 풋워크에는 점프 카드가 붙지 않는다(기존 카드 4장 그대로)', function () {
    var r = P.measure(P.demoFrames('foot'), 'foot');
    eq(r.cards.length, 4, '카드 4장');
    eq(r.jump, null, '풋워크는 점프 계산 없음');
    excludes(r.cards.map(function (c) { return c.key; }).join(','), 'jump', '점프 카드 없음');
    /* 스매시는 기존 4장 + 점프 1장 */
    var s = P.measure(P.demoFrames('smash'), 'smash');
    eq(s.cards.length, 5, '스매시 카드 5장');
    eq(s.cards[4].key, 'jump', '점프 카드는 맨 뒤');
  });

  /* ============================================================
   * 2. 점프 예시 · 화면 · 메모
   * ============================================================ */

  test('v1.53 점프 예시: 1구간은 좋아요 · 2구간은 조금 늦어요로 갈린다', function () {
    var packs = P.demoJump();
    eq(packs.length, 2, '두 구간');
    eq(packs[0].seg.label, '1구간', '이름');
    eq(packs[1].seg.label, '2구간', '이름');
    ok(packs[0].seg.span > 0 && packs[1].seg.span > 0, '구간 길이');

    var n1 = nodeOf(packs[0]), n2 = nodeOf(packs[1]);
    ok(n1.analysis.ok && n2.analysis.ok, '두 구간 모두 분석');
    eq(n1.analysis.players[n1.track].result.jump.kind, 'good', '1구간 타이밍');
    eq(n2.analysis.players[n2.track].result.jump.kind, 'late', '2구간 타이밍');
    eq(P.segSummary(n1).text, '좋아요', '1구간 칩');
    eq(P.segSummary(n2).text, '보완 1건', '2구간 칩은 점프 한 건만');
    eq(P.segSummary(n2).tone, 'warn', '색');
  });

  test('v1.53 점프 화면: 다른 카드와 같은 모양으로 나오고 예시 버튼이 있다', function () {
    var html = P.cardsHtml(P.measure(P.jumpFrames('late'), 'smash'));
    includes(html, 'data-pose-card="jump"', '확인용 표시');
    includes(html, '점프 최고점 · 타점 타이밍', '카드 이름');
    includes(html, '최고점 높이의 85% 이상', '기준');
    includes(html, '조금 늦어요', '배지');
    includes(html, '내려오면서', '보완점');
    excludes(html, '<script', '스크립트를 넣지 않는다');

    var shell = P.shellHtml();
    includes(shell, 'data-pose-demo="jump"', '점프 예시 버튼');
    includes(shell, '점프 스매시 예시', '버튼 이름');
    includes(shell, '내 폰 안에서만', '영상은 기기 안에서만');
    /* 참고 줄에는 새 원칙의 출처가 한 줄 붙고, 풋워크에는 붙지 않는다 */
    includes(P.refNote('smash'), '점프 최고점', '참고 줄');
    excludes(P.refNote('foot'), '점프 최고점', '풋워크 참고 줄에는 없음');

    var css = readRoot('styles.css');
    includes(css, '.posecard.is-stay', '제자리 타점 중립 스타일');
  });

  test('v1.53 점프: 일지 메모 한 줄은 160자 안에서 기존 문구를 지킨다', function () {
    var r = P.measure(P.jumpFrames('late'), 'smash');
    var line = P.noteLine(r, { segTime: '0.0~1.5초' });
    includes(line, '🎥 영상 자세 비교(타점', '기존 머리말');
    includes(line, '0.0~1.5초', '구간 시간');
    includes(line, '점프 최고점보다', '점프 지적');
    ok(line.length < 160, '길이: ' + line.length);
    excludes(line, 'undefined', '빈 값 없음');
    excludes(line, 'NaN', 'NaN 없음');
  });

  /* ============================================================
   * 3. 통증 — 조금이라도 아프면 바로 멈추고 쉬기 (ai.js)
   * ============================================================ */

  var PAIN_DRAFT = { cond: 7, intensity: 6, minutes: 50, pain: ['무릎'], weakness: ['풋워크'] };

  test('v1.53 통증: 조금이라도 아프면 바로 멈추는 기준이 가장 먼저 나온다', function () {
    var an = AI.analyze({ draft: PAIN_DRAFT, records: [], level: 'B조', nick: '승우' });
    var stop = AI.PAIN_RULE.stop;
    includes(stop, '조금이라도', '사용자의 말 그대로');
    includes(stop, '바로', '바로');
    includes(stop, '멈추', '멈추기');
    includes(stop, '쉬', '쉬기');
    excludes(stop, '한 세트만 더', '애매하게 넘기지 않음');

    eq(an.risk[0].level, 'warn', '점검 맨 앞 경고');
    includes(an.risk[0].text, '바로 코트를 멈추고', '점검');
    eq(an.care.stop, stop, '처방에 기준이 담긴다');
    includes(an.care.rehab[0], '바로 코트를 멈추고', '회복 처방 맨 앞');
    includes(an.care.mental.join(' '), '바로 코트를 멈추고', '마음 처방');
    includes(an.guard.lower.reason, '바로 코트를 멈추고', '무릎·발목 보호 체크');
    includes(an.pace.text, '바로 코트를 멈추고', '강도 조절');
    eq(an.pace.painStop, stop, '강도 조절에도 같은 문장');
    includes(an.focus, '쉬기', '다음 목표');
    includes(an.week[0].menu, '아프면 바로 쉬기', '내일 루틴 첫 줄');
    ok(an.insights.some(function (i) {
      return i.label.indexOf('통증') >= 0 && i.detail.indexOf('바로 코트를 멈추고') >= 0;
    }), '오늘 진단');
  });

  test('v1.53 통증: 어깨·팔꿈치·손목도 같은 중단 기준을 쓴다(기존 처방은 그대로)', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 50, pain: ['팔꿈치'] }, records: [], level: 'B조' });
    includes(an.guard.arm.reason, '바로 코트를 멈추고', '팔꿈치·손목 보호 체크');
    includes(an.care.rehab.join(' '), '천천히 내리기', '기존 근력 처방 유지');
    includes(an.care.rehab.join(' '), '바로 코트를 멈추고', '회복 처방');

    var sh = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 50, pain: ['어깨'] }, records: [], level: 'B조' });
    includes(sh.guard.shoulder.reason, '바로 코트를 멈추고', '어깨 보호 체크');

    var rp = AI.analyze({
      draft: { cond: 6, intensity: 7, minutes: 60, pain: [], weakness: [] },
      records: [{ date: '2026-11-10', pain: ['무릎'], cond: 6, intensity: 6, minutes: 50 },
        { date: '2026-11-16', pain: ['무릎'], cond: 6, intensity: 6, minutes: 50 }],
      level: 'B조'
    });
    includes(rp.insights.map(function (i) { return i.detail; }).join(' '), '바로 코트를 멈추고', '반복 통증 진단');
  });

  test('v1.53 통증: 아프지 않은 날은 조용하다(기존 문구 그대로)', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 60 }, records: [], level: 'C조' });
    eq(an.risk.length, 1, '점검은 한 줄');
    eq(an.risk[0].level, 'ok', '무리한 신호 없음');
    eq(an.care.stop, '', '중단 기준 없음');
    excludes(JSON.stringify(an.care), '바로 코트를 멈추고', '처방에 안 섞임');
    excludes(an.pace.text, '바로 코트를 멈추고', '강도 조절 문구 그대로');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, [], 0, 6).text, AI.SELF_PACE.keep, '계획대로');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, ['무릎'], 0, 6).level, 'caution', '통증만 있으면 주의');
    includes(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, ['무릎'], 0, 6).text, '바로 코트를 멈추고', '통증이면 붙는다');
  });

  /* ============================================================
   * 4. 버전 · 배선 · 보안
   * ============================================================ */

  test('v1.53 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.99.0'", '서비스워커');
    includes(readRoot('app.js'), "version: 'v1.99.0'", '앱 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.99.0', 'TWA 이름');
    eq(twa.appVersionCode, 93, 'TWA 코드');
    eq(twa.appVersion, '1.99.0', 'TWA 버전');
    var index = readRoot('index.html');
    includes(index, 'styles.css?v=20261128-5', 'styles.css 캐시 주소');
    includes(readRoot('test/run.js'), 'test/v153.test.js', '테스트 목록');
    includes(readRoot('sw.js'), "'./js/pose.js'", '서비스워커 캐시 목록 그대로');
    includes(readRoot('sw.js'), "'./js/ai.js'", '서비스워커 캐시 목록 그대로');
  });

  test('v1.53 보안: 영상은 여전히 기기 안에서만 · CSP에 새 출처를 열지 않는다', function () {
    if (!hasNode) return;
    var index = readRoot('index.html');
    var csp = (index.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
    includes(csp, "media-src 'self' blob:", '고른 영상은 blob로만');
    includes(csp, "script-src 'self' https://accounts.google.com", '스크립트 출처 그대로');
    includes(csp, "object-src 'none'", 'object 차단');
    excludes(csp, "'unsafe-eval'", 'unsafe-eval은 막혀 있음');
    includes(csp, "'wasm-unsafe-eval'", '자세 모델 WASM만 허용');
    var pose = readRoot('js/pose.js');
    excludes(pose, 'XMLHttpRequest', '영상을 올리지 않는다');
    includes(pose, 'URL.createObjectURL', '이 기기 안에서만 연다');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
