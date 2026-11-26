/* ============================================================
 * test/v169.test.js — bm-v1.73.0
 *   🦵 런지·착지 부상 예방 보강 (무릎·발목 보호 체크)
 *
 *  최신 학술 논문 두 편을 '무릎·발목 보호 체크'에 반영했습니다.
 *   [WEN25] Wen et al., BMC Sports Sci Med Rehabil 17(1):341, 2025
 *           (DOI: 10.1186/s13102-025-01393-y) — 남자 아마추어 30명.
 *           런지 착지에서 발끝을 안쪽으로 말면(toe-in) 뒤꿈치에 응력이 몰리고
 *           발목이 바깥으로 꺾이는 부하가 커지며, 진행 방향~조금 바깥(toe-out)으로
 *           열면 그 각도·힘·전후방 전단력이 유의하게 줄고 충격 흡수가 부드러워집니다.
 *   [XIAO26] Xiao et al., Res Sports Med 34(6):737-760, 2026
 *           (DOI: 10.1080/15438627.2026.2680707) — 전향적 생체역학 연구 11편(435편 검색).
 *           착지 때 무릎이 안쪽으로 모이는 정렬(knee valgus)이 무릎 인대(ACL) 부상 위험을
 *           높이므로 런지·착지 정렬 교정을 우선하라고 정리했습니다.
 *
 *   1) 새 기준 2줄 · 조심할 동작 2개가 기존 4줏·3개 뒤에 붙는다 (기존 문구는 그대로)
 *   2) 쉅운 말 — 화면 문구에 통계 기호·전문 약어를 두지 않는다
 *   3) 출처는 맨 아래 작은 '참고 논문' 한 줄에만 (Wen 2025 · Xiao 2026)
 *   4) 논문 수치는 내부 값(LOWER_RISK)에 그대로
 *   5) 풋워크·수비 드릴의 한 줄 코칭도 같은 기준
 *   6) 관절 보호 접기 하나에 붙고, 기존 블록은 그대로 · 글자는 HTML로 실행되지 않음
 *   7) 실존 선수 이름 없음 · 버전(bm-v1.73.0)
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
  function lowerGuard(ctx) {
    return AI.jointGuard([], ['풋워크'], ctx || { intensity: 5, minutes: 40 }).lower;
  }

  function analyze(draft) {
    return AI.analyze({
      draft: draft, records: [], level: 'A조', discipline: '복식', nick: '나'
    });
  }

  function cardHtml(an) {
    return BM.views.log.analysisCard(an, { ui: {} });
  }

  /* 사용자가 보는 문구에 나오면 안 되는 것들 (bm-v1.28 기준을 이 버전에서도 지킨다) */
  var HARD = ['OR ', 'p <', 'FR240', 'GIRD', '저측굴곡', 'HRmax', 'ACWR', 'RPE', 'IRR',
    'ρ', 'Spearman', '모멘트', '구심성', '원심성', '관절낭', '슬리퍼', '견갑', '내회전', '외회전'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* ============================================================
   * 1. 근거 · 기준
   * ============================================================ */

  test('v1.69 근거: 주석에 [WEN25]·[XIAO26]과 두 DOI가 남아 있다', function () {
    if (!hasNode) return;
    var code = readRoot('js/ai.js');
    includes(code, '[WEN25]', '발끝 방향 논문 태그');
    includes(code, '[XIAO26]', '체계적 문헌고찰 태그');
    includes(code, '10.1186/s13102-025-01393-y', 'Wen DOI');
    includes(code, '10.1080/15438627.2026.2680707', 'Xiao DOI');
    includes(code, 'BMC Sports Sci Med Rehabil 17(1):341, 2025', 'Wen 저널·연도');
    includes(code, 'Res Sports Med 34(6):737-760, 2026', 'Xiao 저널·연도');
  });

  test('v1.69 쉬운 기준: 발끝 안쪽·바깥(toe-in/toe-out)과 무릎 정렬 기준이 기존 4줄 뒤에 붙는다', function () {
    var th = lowerGuard().thresholds;
    ok(th.length >= 7, '기존 4줄 + 새 기준 3줄');
    includes(th[4], 'toe-in', '발끝을 안쪽으로 말기');
    includes(th[4], '뒤꿈치', '뒤꿈치에 힘이 몰린다');
    includes(th[5], 'toe-out', '발끝을 바깥으로 열기');
    includes(th[5], '뒤꿈치 충격', '뒤꿈치 충격이 줄어든다');
    includes(th[6], '두 무릎이 안쪽으로 모이면', '점프 착지 무릎 정렬');
    includes(th[6], '발끝과 같은 방향', '무릎은 발끝 방향으로');
    /* 기존 4줄은 그대로 (보호) */
    includes(th[0], '가장 많이 다치는 곳이 다리', '기존 1번째');
    includes(th[1], '피곤해지면', '기존 2번째');
    includes(th[2], '백핸드 쪽으로 길게 뻗는 런지', '기존 3번째');
    includes(th[3], '대각선 뒤로 빠지면서', '기존 4번째');
  });

  test('v1.69 조심할 동작: 발끝 방향·점프 착지 무릎 정렬이 기존 3개 뒤에 붙는다', function () {
    var g = lowerGuard();
    eq(g.checkTitle, '조심할 동작', '제목 그대로');
    ok(g.checks.length >= 5, '기존 3개 + 새 2개');
    eq(g.checks[0].name, '백핸드 앞쪽 런지 조심', '기존 1번째 그대로');
    eq(g.checks[1].name, '대각선 뒤로 빠질 때 발바닥 전체로 착지', '기존 2번째 그대로');
    eq(g.checks[2].name, '마지막 세트 런지 5개로 확인', '기존 3번째 그대로');
    eq(g.checks[3].name, '런지 착지 발끝 방향', '새 1번째');
    eq(g.checks[4].name, '점프 착지 무릎 정렬', '새 2번째');
    includes(g.checks[3].how, 'toe-in', '안쪽으로 말면');
    includes(g.checks[3].how, 'toe-out', '바깥으로 열면');
    includes(g.checks[3].how, AI.LOWER_RISK.toeOutDeg + '도', '논문에서 본 발끝 각도(내부 값)');
    includes(g.checks[4].how, 'X자', '무릎이 무너지는 모양 풀이');
    includes(g.checks[4].how, '발끝 방향', '무릎을 발끝 방향으로');
    includes(g.checks[4].how, '엉덩이를 살짝 뒤로', '부드럽게 흡수하는 방법');
    /* 오늘 할 것은 3개 그대로 */
    eq(g.guides.length, 3, '오늘 할 것 3개 그대로');
  });

  test('v1.69 수치: Wen(30명·20도)·Xiao(435편·11편) 값이 내부 값에 그대로', function () {
    var l = AI.LOWER_RISK;
    eq(l.toeTrials, 30, 'Wen 참가자 30명');
    eq(l.toeOutDeg, 20, '바깥 20도');
    eq(l.toeInDeg, 20, '안쪽 20도');
    eq(l.toeOutSignificantP.length, 4, 'Wen 유의수준 4개');
    eq(l.toeOutSignificantP[0], 0.001, 'Wen 첫 값');
    eq(l.toeOutSignificantP[3], 0.038, 'Wen 마지막 값');
    eq(l.aclRecords, 435, 'Xiao 검색 435편');
    eq(l.aclStudies, 11, 'Xiao 포함 11편');
    /* 기존 값은 그대로 */
    eq(l.lowerSharePct.join('~'), '43~86', '하지 부상 비중');
    eq(l.kneeMomentP, 0.001, '무릎 유의수준');
    eq(l.plantarDeg, 33, '앞발 착지 각도');
    eq(l.irDeg, 18, '앞발 안쪽 회전 각도');
    eq(l.heavyMinutes, 90, '피로 구간 시간');
    eq(l.heavyIntensity, 8, '피로 구간 강도');
  });

  test('v1.69 출처: 작은 참고 논문 한 줄에 Wen 2025 · Xiao 2026이 함께 남는다', function () {
    var g = lowerGuard();
    includes(g.sourceShort, '참고 논문', '출처 줄');
    includes(g.sourceShort, 'Wen 2025', 'Wen');
    includes(g.sourceShort, 'Xiao 2026', 'Xiao');
    includes(g.sourceShort, 'Du & Fan 2020', '기존 출처 유지');
    includes(g.source, '10.1186/s13102-025-01393-y', 'Wen DOI');
    includes(g.source, '10.1080/15438627.2026.2680707', 'Xiao DOI');
  });

  /* ============================================================
   * 2. 쉬운 말 — 통계 기호·전문 약어 금지
   * ============================================================ */

  test('v1.69 쉬운 말: 화면 문구에 통계 기호·전문 약어가 없다', function () {
    var g = lowerGuard();
    banText(JSON.stringify(g.lower), '무릎·발목 블록');
    banText(g.thresholds.join(' '), '쉬운 기준');
    banText(g.checks.map(function (c) { return c.name + ' ' + c.how; }).join(' '), '조심할 동작');
    /* 대신 쉬운 말이 들어 있다 */
    includes(g.thresholds[4], '몸 안쪽으로 말아', '안쪽으로 말기 풀이');
    includes(g.thresholds[5], '조금 바깥으로 열어', '바깥으로 열기 풀이');
    includes(g.checks[4].how, '무릎 인대', '무릎 인대(쉬운 말)');
  });

  /* ============================================================
   * 3. 드릴 한 줄 코칭
   * ============================================================ */

  test('v1.69 드릴: 점프 착지·한 발 수비 코칭이 같은 기준을 가리킨다', function () {
    var land = AI.DRILLS['스매시'].filter(function (d) { return d.name === '점프 스매시 착지 밸런스'; })[0];
    var reach = AI.DRILLS['수비'].filter(function (d) { return d.name === '한 발 수비(리치)'; })[0];
    ok(land && reach, '드릴 두 개가 그대로 있다');
    includes(land.point, '발끝 방향', '무릎은 발끝 방향');
    includes(land.point, '엉덩이를 뒤로', '엉덩이를 뒤로 빼며 흡수');
    includes(reach.point, '무릎이 안쪽으로 무너지지 않게', '기존 코칭 유지');
    includes(reach.point, '발끝은 몸이 가는 방향', '발끝을 조금 바깥으로');
    /* 키·값 구조가 그대로 */
    ok(typeof land.name === 'string' && typeof land.method === 'string' &&
      typeof land.point === 'string' && land.sets, '착지 드릴 구조 유지');
    ok(typeof reach.name === 'string' && typeof reach.method === 'string' &&
      typeof reach.point === 'string' && reach.sets, '수비 드릴 구조 유지');
  });

  /* ============================================================
   * 4. 화면 — 관절 보호 접기 하나
   * ============================================================ */

  test('v1.69 카드: 관절 보호 접기 하나에 새 항목이 보이고 기존 블록은 그대로', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    ok(an.guard && an.guard.lower.on, '무릎·발목 블록이 켜진다');
    var html = cardHtml(an);
    includes(html, 'data-fold="guard"', '관절 보호 접기');
    eq(html.split('data-fold="guard"').length - 1, 1, '접기는 하나만');
    includes(html, '무릎·발목 보호 체크', '블록 제목');
    includes(html, '조심할 동작', '확인 제목');
    includes(html, '런지 착지 발끝 방향', '새 확인 1');
    includes(html, '점프 착지 무릎 정렬', '새 확인 2');
    includes(html, 'toe-out', '발끝 바깥으로');
    includes(html, '참고 논문 · Du &amp; Fan 2020', '출처 한 줄');
    includes(html, 'Wen 2025', 'Wen 출처');
    /* 기존 카드 블록 보호 */
    includes(html, '추천 드릴', '드릴 유지');
    includes(html, 'data-fold="offcourt"', '오프코트 유지');
    includes(html, 'data-fold="week"', '이번 주 루틴 유지');
    includes(html, 'data-fold="care"', '맞춤 처방 유지');
  });

  test('v1.69 카드: 새 문구도 HTML로 실행되지 않고 글자로만 보인다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    an.guard.lower.thresholds[4] = '<img src=x onerror=alert(1)>';
    an.guard.lower.checks[3].how = '<script>alert(2)</script>';
    var html = cardHtml(an);
    excludes(html, '<img src=x', '태그가 그대로 들어가지 않는다');
    excludes(html, '<script>alert(2)', '스크립트가 그대로 들어가지 않는다');
    includes(html, '&lt;img src=x', '글자로만 보인다');
  });

  test('v1.69 실명: 코드·카드 어디에도 실존 선수 이름이 없다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크', '스매시'] });
    var blob = cardHtml(an) + JSON.stringify(an.guard) +
      (hasNode ? (readRoot('js/ai.js') + readRoot('js/views/log.js')) : '');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
  });

  /* ============================================================
   * 5. 버전
   * ============================================================ */

  test('v1.69 버전: sw · app · 스타일 캐시 · TWA · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.84.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.84.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.84.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.84.0', 'TWA appVersion');
    eq(twa.appVersionCode, 78, 'TWA 버전 코드');
    includes(readRoot('test/run.js'), 'test/v169.test.js', '테스트 목록 배선');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
