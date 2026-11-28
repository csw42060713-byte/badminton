/* ============================================================
 * test/v178.test.js — bm-v1.96.0
 *   🦶 스플릿 스텝 → 전위 런지 연결 · 발목 비틀림 보호
 *
 *  [WANG24] Wang Y., Xu L., Jiang H., Yu L., Wu H., Mei Q.,
 *           <Biomechanical Effects of the Badminton Split-Step on Forecourt Lunging Footwork>,
 *           Bioengineering 11(5):501, 2024 (DOI: 10.3390/bioengineering11050501)
 *           — 대학 수준 남자 선수 18명, VICON 모션캡처·지면반력 분석.
 *           포핸드 런지에서는 스플릿 스텝을 밟으면 발이 닿는 순간 고관절 벌림·돌림이 커지고
 *           무릎 굽힘이 줄며, 백핸드 런지에서는 무릎 돌림이 커지는 대신 발목 돌림이 유의하게
 *           줄었습니다(p < 0.05). 첫 지면반력 피크의 하중률이 커지고 첫·둘째 피크 간격이
 *           좁아져, 나가기 직전 스플릿 스텝이 힘을 받아내는 준비를 빠르게 합니다.
 *  [PENG25] Pengked K. et al., Electron J Gen Med 22(1):em629, 2025 (DOI: 10.29333/ejgm/15917)
 *           — 급격한 방향 전환이 외측 발목 염좌의 큰 원인(준비운동 빈도와 부상 빈도 역상관).
 *
 *   1) 근거 — ai.js 주석에 [WANG24]·DOI·저널이 남아 있다
 *   2) 드릴 — '풋워크'에 '스플릿 스텝 → 전위 런지'가 스플릿 스텝 드릴 바로 뒤에 붙는다
 *   3) 추천 — 풋워크를 약점으로 고르면 그 드릴이 추천 3개 안에 들어온다
 *   4) 보호 체크 — 쉬운 기준 1줄·조심할 동작 1개가 뒤에 붙고 기존 문구는 그대로
 *   5) 쉬운 말 — 화면 문구에 통계 기호·전문 약어를 두지 않는다
 *   6) 수치 — 18명·p 0.05가 내부 값에 그대로, 기존 값은 그대로
 *   7) 출처 — 맨 아래 작은 '참고 논문' 한 줄에 Wang 2024가 함께
 *   8) 화면 — 관절 보호 접기 하나에 새 항목이 보이고 기존 블록·드릴은 그대로
 *   9) 안전 — 글자는 HTML로 실행되지 않고, 실존 선수 이름이 없다
 *  10) 버전 — sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께
 *
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var AI = BM.ai;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* 무릎·발목 블록이 켜지는 가장 흔한 경우 — 풋워크를 약점으로 고른 날 */
  function lowerGuard(pain) {
    return AI.jointGuard(pain || [], pain ? [] : ['풋워크'], { intensity: 5, minutes: 40 }).lower;
  }

  function analyze(draft) {
    return AI.analyze({
      draft: draft, records: [], level: 'A조', discipline: '복식', nick: '나'
    });
  }

  function cardHtml(an) {
    return BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
  }

  function footDrill(name) {
    return AI.DRILLS['풋워크'].filter(function (d) { return d.name === name; })[0];
  }

  /* 사용자가 보는 문구에 나오면 안 되는 것들 (bm-v1.28 기준을 이 버전에서도 지킨다) */
  var HARD = ['OR ', 'p <', 'FR240', 'GIRD', 'inversion', 'eversion', '저측굴곡', 'HRmax', 'ACWR', 'RPE', 'IRR',
    'ρ', 'Spearman', '모멘트', '구심성', '원심성', '관절낭', '슬리퍼', '견갑', '내회전', '외회전', '생체역학'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* ============================================================
   * 1. 근거
   * ============================================================ */

  test('v1.78 근거: 주석에 [WANG24]과 DOI·저널이 남아 있다', function () {
    if (!hasNode) return;
    var code = readRoot('js/ai.js');
    includes(code, '[WANG24]', '스플릿 스텝 논문 태그');
    includes(code, '10.3390/bioengineering11050501', 'Wang DOI');
    includes(code, 'Bioengineering 11(5):501, 2024', 'Wang 저널·권·호·쪽·연도');
    includes(code, 'Split-Step on Forecourt Lunging Footwork', 'Wang 논문 제목');
    includes(code, '18명', '참가자 수');
  });

  /* ============================================================
   * 2. 드릴 — 스플릿 스텝 → 전위 런지
   * ============================================================ */

  test('v1.78 드릴: 풋워크에 새 드릴이 스플릿 스텝 드릴 바로 뒤에 붙는다', function () {
    var names = AI.DRILLS['풋워크'].map(function (d) { return d.name; });
    var at = names.indexOf('스플릿 스텝 → 전위 런지');
    ok(at > 0, '새 드릴이 있다');
    eq(names[at - 1], '스플릿스텝 타이밍', '스플릿 스텝 드릴 바로 뒤');
    /* 기존 드릴은 하나도 빠지지 않고 이름·순서 그대로 */
    eq(names[0], '육각 풋워크', '기존 1번째 그대로');
    eq(names[1], '스플릿스텝 타이밍', '기존 2번째 그대로');
    eq(names[at + 1], '베이스 복귀 스플릿스텝', '기존 3번째는 그대로 뒤로');
    eq(names.length, 6, '기존 5개 + 새 1개');
  });

  test('v1.78 드릴: 방법·세트·한 줄 코칭이 쉬운 말로 채워진다', function () {
    var d = footDrill('스플릿 스텝 → 전위 런지');
    ok(d && typeof d.method === 'string' && typeof d.point === 'string' && d.sets, '구조 유지');
    includes(d.method, '두 발을 살짝 떼며 박자를 맞춘', '스플릿 스텝 설명');
    includes(d.method, '포핸드·백핸드', '전위 런지 방향');
    includes(d.method, '발바닥 전체로 내려놓으세요', '착지 요령');
    includes(d.point, '백핸드로 길게 뻗을 때 발목이 덜 비틀려요', '한 줄 코칭');
    includes(AI.setsFor(d, 'B조'), '세트', '급수별 세트 표기');
    includes(AI.setsFor(d, '초심'), '세트', '초심 세트');
    includes(AI.setsFor(d, 'A조'), '세트', 'A조 세트');
    banText(d.method + ' ' + d.point, '새 드릴');
  });

  test('v1.78 추천: 풋워크를 약점으로 고르면 새 드릴이 추천 3개 안에 들어온다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    var names = (an.drills.drills || []).map(function (d) { return d.name; });
    eq(names.length, 3, '드릴 3개');
    includes(names.join('|'), '스플릿 스텝 → 전위 런지', '새 드릴이 추천에 보인다');
    eq(names[0], '육각 풋워크', '기존 1순위 그대로');
    /* 드릴마다 방법·세트·코칭이 함께 나간다(시트 JSON 모양 그대로) */
    an.drills.drills.forEach(function (d) {
      ok(d.name && d.method && d.sets && d.point && d.level, '드릴 모양: ' + d.name);
    });
  });

  /* ============================================================
   * 3. 무릎·발목 보호 체크
   * ============================================================ */

  test('v1.78 쉬운 기준: 방향 전환·스플릿 스텝 기준이 기존 7줄 뒤에 붙는다', function () {
    var th = lowerGuard().thresholds;
    eq(th.length, 8, '기존 7줄 + 새 1줄');
    includes(th[7], '방향을 바꾸기 직전', '방향 바꾸기 직전');
    includes(th[7], '스플릿 스텝', '스플릿 스텝');
    includes(th[7], '발목이 비틀리는 부담이 줄어요', '발목 비틀림 부담 감소');
    /* 기존 7줄은 그대로 (보호) */
    includes(th[0], '가장 많이 다치는 곳이 다리', '기존 1번째');
    includes(th[3], '대각선 뒤로 빠지면서', '기존 4번째');
    includes(th[4], 'toe-in', '기존 5번째');
    includes(th[5], 'toe-out', '기존 6번째');
    includes(th[6], '발끝과 같은 방향', '기존 7번째');
  });

  test('v1.78 조심할 동작: 방향 바꾸기 전 스플릿 스텝이 기존 5개 뒤에 붙는다', function () {
    var g = lowerGuard();
    eq(g.checkTitle, '조심할 동작', '제목 그대로');
    eq(g.checks.length, 6, '기존 5개 + 새 1개');
    eq(g.checks[0].name, '백핸드 앞쪽 런지 조심', '기존 1번째 그대로');
    eq(g.checks[1].name, '대각선 뒤로 빠질 때 발바닥 전체로 착지', '기존 2번째 그대로');
    eq(g.checks[2].name, '마지막 세트 런지 5개로 확인', '기존 3번째 그대로');
    eq(g.checks[3].name, '런지 착지 발끝 방향', '기존 4번째 그대로');
    eq(g.checks[4].name, '점프 착지 무릎 정렬', '기존 5번째 그대로');
    var c = g.checks[5];
    eq(c.name, '방향 바꾸기 전 스플릿 스텝 한 번', '새 확인');
    includes(c.how, '발목이 안쪽으로 꺾이면', '접질림 원인');
    includes(c.how, '스플릿 스텝으로 멈춘 뒤', '멈춘 뒤');
    includes(c.how, '발바닥 전체로 디디세요', '발바닥 전체 착지');
    includes(c.how, AI.LOWER_RISK.splitStepTrials + '명', '같은 선수 18명(내부 값)');
    /* 오늘 할 것은 3개 그대로 */
    eq(g.guides.length, 3, '오늘 할 것 3개 그대로');
  });

  test('v1.78 발목 통증: 통증으로 블록이 켜져도 새 항목이 같은 자리에 있다', function () {
    var g = lowerGuard(['발목']);
    includes(g.thresholds.join(' '), '스플릿 스텝', '쉬운 기준에 스플릿 스텝');
    includes(g.checks.map(function (c) { return c.name; }).join('|'), '방향 바꾸기 전 스플릿 스텝 한 번', '조심할 동작에 스플릿 스텝');
  });

  /* ============================================================
   * 4. 쉬운 말 — 통계 기호·전문 약어 금지
   * ============================================================ */

  test('v1.78 쉬운 말: 화면 문구에 통계 기호·전문 약어가 없다', function () {
    var g = lowerGuard();
    banText(g.thresholds.join(' '), '쉬운 기준');
    banText(g.checks.map(function (c) { return c.name + ' ' + c.how; }).join(' '), '조심할 동작');
    includes(g.thresholds[7], '가볍게 한 번 뛰어', '스플릿 스텝 풀이');
    includes(g.checks[5].how, '두 발을 살짝 떼는', '스플릿 스텝 풀이');
  });

  /* ============================================================
   * 5. 수치 · 출처
   * ============================================================ */

  test('v1.78 수치: 18명·p 0.05가 내부 값에 그대로, 기존 값은 그대로', function () {
    var l = AI.LOWER_RISK;
    eq(l.splitStepTrials, 18, 'Wang 참가자 18명');
    eq(l.splitStepP, 0.05, 'Wang 유의수준');
    /* 기존 값 보호 */
    eq(l.lowerSharePct.join('~'), '43~86', '하지 부상 비중');
    eq(l.plantarDeg, 33, '앞발 착지 각도');
    eq(l.irDeg, 18, '앞발 안쪽 회전 각도');
    eq(l.toeOutDeg, 20, '발끝 바깥 20도');
    eq(l.aclRecords, 435, 'Xiao 검색 435편');
    eq(l.aclStudies, 11, 'Xiao 포함 11편');
    eq(l.heavyMinutes, 90, '피로 구간 시간');
    eq(l.heavyIntensity, 8, '피로 구간 강도');
  });

  test('v1.78 출처: 작은 참고 논문 한 줄에 Wang 2024가 함께 남는다', function () {
    var g = lowerGuard();
    includes(g.sourceShort, '참고 논문', '출처 줄');
    includes(g.sourceShort, 'Wang 2024', 'Wang');
    includes(g.sourceShort, 'Fong 2021', '기존 출처 유지');
    includes(g.sourceShort, 'Wen 2025', '기존 출처 유지');
    includes(g.sourceShort, 'Xiao 2026', '기존 출처 유지');
    includes(g.source, '10.3390/bioengineering11050501', 'Wang DOI');
    includes(g.source, 'Bioengineering 11(5):501, 2024', 'Wang 저널');
  });

  /* ============================================================
   * 6. 화면
   * ============================================================ */

  test('v1.78 카드: 관절 보호 접기 하나에 새 항목이 보이고 기존 블록은 그대로', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    ok(an.guard && an.guard.lower.on, '무릎·발목 블록이 켜진다');
    var html = cardHtml(an);
    includes(html, 'data-fold="guard"', '관절 보호 접기');
    eq(html.split('data-fold="guard"').length - 1, 1, '접기는 하나만');
    includes(html, '무릎·발목 보호 체크', '블록 제목');
    includes(html, '방향 바꾸기 전 스플릿 스텝 한 번', '새 확인');
    includes(html, '스플릿 스텝 → 전위 런지', '새 드릴');
    includes(html, '참고 논문 · Du &amp; Fan 2020', '출처 한 줄');
    includes(html, 'Wang 2024', 'Wang 출처');
    /* 기존 카드 블록 보호 */
    includes(html, '추천 드릴', '드릴 유지');
    includes(html, 'data-fold="offcourt"', '오프코트 유지');
    includes(html, 'data-fold="week"', '이번 주 루틴 유지');
    includes(html, 'data-fold="care"', '맞춤 처방 유지');
    includes(html, 'data-fold="prevent"', '부상 예방 유지');
  });

  test('v1.78 카드: 새 문구도 HTML로 실행되지 않고 글자로만 보인다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    an.guard.lower.thresholds[7] = '<img src=x onerror=alert(1)>';
    an.guard.lower.checks[5].how = '<script>alert(2)</script>';
    an.drills.drills[2].method = '<b onmouseover=alert(3)>x</b>';
    var html = cardHtml(an);
    excludes(html, '<img src=x', '태그가 그대로 들어가지 않는다');
    excludes(html, '<script>alert(2)', '스크립트가 그대로 들어가지 않는다');
    excludes(html, '<b onmouseover', '드릴 방법도 글자로만');
    includes(html, '&lt;img src=x', '글자로만 보인다');
  });

  test('v1.78 실명: 코드·카드·드릴 어디에도 실존 선수 이름이 없다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    var blob = cardHtml(an) + JSON.stringify(an.guard) + JSON.stringify(an.drills) +
      (hasNode ? (readRoot('js/ai.js') + readRoot('js/views/log.js')) : '');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
  });

  /* ============================================================
   * 7. 버전 · 배선
   * ============================================================ */

  test('v1.78 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.99.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.99.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-5', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.99.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.99.0', 'TWA appVersion');
    eq(twa.appVersionCode, 93, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.99.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v178.test.js', '테스트 목록 배선');
  });

  test('v1.78 보호: 5개 탭·시트 26칸·기존 블록 구조가 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "id: '" + id + "'", '탭 ' + id);
    });
    eq(BM.domain.COLS.length, 26, '시트 26칸');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
