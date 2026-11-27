/* ============================================================
 * test/v127.test.js — bm-v1.37.2
 *   배드민턴 선수에게 가장 흔한 두 부위(어깨 · 무릎/발목)의
 *   '검증된 논문 수치 기준'을 AI 분석과 화면에 보강합니다.
 *
 *   어깨 : Guermont 2023 Phys Ther Sport (GIRD>14° OR 36.14, FR240<0.69 OR 28.0)
 *          Cejudo 2022 IJERPH (내회전 ROM ≤ 55° → 1년 내 통증 81%)
 *   하지 : Du & Fan 2020 Appl Sci (하지 부상 43~86%, 피로 시 무릎 모멘트 감소 p<0.001)
 *          Valldecabres 2018 PeerJ (백핸드 네트 런지 > 포핸드)
 *          Fong 2021 J Sport Health Sci (측후방 스텝 앞발 착지 = 급성 외측 염좌)
 *
 *   실행: node test/run.js
 *
 *   ※ bm-v1.37.2에서 화면 문구를 '쉬운 코트 말투'로 다듬었습니다.
 *     논문 수치는 내부 stats에 그대로 남고, 화면 검사는 쉬운 문구 기준입니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function analyze(draft) {
    var d = draft || {};
    return BM.ai.analyze({
      draft: d, records: d.records || [], level: d.level || 'A조',
      discipline: d.discipline || '복식', nick: d.nick || '승우'
    });
  }

  function joinText(o) {
    return JSON.stringify(o);
  }

  /* 분석 카드를 그리는 데 필요한 최소 상태 (release.test.js와 같은 모양) */
  function logState(an) {
    var rows = BM.fixtures.demo();
    var key = 'u_test_me';
    var me = { key: key, nick: '나래', level: 'A조', discipline: '복식', theme: { theme: 'th_def' } };
    return {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, key),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 9, minutes: 110, done: [], pain: ['어깨'], weakness: ['스매시'] } },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: an, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1. 논문 수치 — 코드에 적힌 숫자가 원문과 같아야 한다
   * ========================================================= */
  test('v1.27 어깨 기준: GIRD > 14° · FR240 < 0.69 · 내회전 ≤ 55°', function () {
    var s = BM.ai.SHOULDER_RISK;
    ok(s, '어깨 기준 객체');
    eq(s.girdDeg, 14, 'GIRD 기준각');
    eq(s.girdOR, 36.14, 'GIRD 교차비');
    eq(s.fr240, 0.69, 'FR240 기준');
    eq(s.fr240OR, 28.0, 'FR240 교차비');
    eq(s.irRomDeg, 55, '내회전 ROM 기준각');
    eq(s.irRomProbPct, 81, '1년 내 통증 확률');
    eq(s.followWeeks, 38, '추적 기간');
    eq(s.eliteInjuryPct, 42, '엘리트 주요 어깨 부상 비율');
    eq(s.youthPainPct, 47.4, '유소년 통증 경험 비율');
  });

  test('v1.27 하지 기준: 하지 부상 43~86% · 앞발 착지 33°/18°', function () {
    var s = BM.ai.LOWER_RISK;
    eq(s.lowerSharePct.join('~'), '43~86', '하지 부상 비중');
    eq(s.kneeMomentP, 0.001, '무릎 모멘트 유의수준');
    eq(s.plantarDeg, 33, '착지 저측굴곡');
    eq(s.irDeg, 18, '착지 내회전');
    eq(s.heavyMinutes, 90, '피로 구간 기준 시간');
    eq(s.heavyIntensity, 8, '피로 구간 기준 강도');
  });

  test('v1.27 출처: 다섯 편이 DOI와 함께 남아 있다', function () {
    if (!hasNode) return;
    var code = readRoot('js/ai.js');
    [['10.1016/j.ptsp.2023.04.002', 'Guermont'],
      ['10.3390/ijerph192013095', 'Cejudo'],
      ['10.3390/app10238703', 'Du'],
      ['10.7717/peerj.6033', 'Valldecabres'],
      ['10.1016/j.jshs.2021.03.007', 'Fong']].forEach(function (pair) {
      includes(code, pair[0], pair[1] + ' DOI');
      includes(code, pair[1], pair[1] + ' 이름');
    });
  });

  /* =========================================================
   * 2. 관절 보호 체크 — 켜지고 꺼지는 조건
   * ========================================================= */
  test('v1.27 어깨: 통증이 있으면 pain 단계로 켜진다', function () {
    var g = BM.ai.jointGuard(['어깨'], [], { intensity: 6, minutes: 60 });
    eq(g.shoulder.on, true, '어깨 블록');
    eq(g.shoulder.level, 'pain', '단계');
    var text = joinText(g.shoulder);
    includes(text, '어깨가 찝히기', '핵심 요약(쉬운 말)');
    includes(text, '눈에 띄게 덜 내려가면', '쉬운 자가 체크');
    includes(text, '옆으로 누워 어깨 뒤 풀기', '오늘 할 것');
    includes(text, '81%', '통증 확률 문구(숫자는 이 한 곳만)');
    includes(text, 'Phys Ther Sport', '출처');
    excludes(text, 'GIRD', '어려운 약어 없음');
    excludes(text, 'FR240', '어려운 약어 없음');
    /* 수치는 내부 stats에 그대로 */
  });

  test('v1.27 어깨: 스매시·클리어(오버헤드)를 고른 날도 켜진다', function () {
    var one = BM.ai.jointGuard([], ['스매시'], { intensity: 5, minutes: 40 });
    eq(one.shoulder.on, true, '스매시');
    eq(one.shoulder.level, 'overhead', '오버헤드 단계');
    var two = BM.ai.jointGuard([], ['클리어', '드라이브'], {});
    eq(two.shoulder.on, true, '클리어');
    var none = BM.ai.jointGuard([], ['드라이브', '헤어핀'], { intensity: 5, minutes: 40 });
    eq(none.shoulder.on, false, '오버헤드 없음 → 꺼짐');
    eq(none.shoulder.level, '', '단계 없음');
  });

  test('v1.27 하지: 풋워크(런지 많은 날)에 켜지고 백핸드·앞발 착지를 짚는다', function () {
    var g = BM.ai.jointGuard([], ['풋워크'], { intensity: 5, minutes: 40 });
    eq(g.lower.on, true, '하지 블록');
    eq(g.lower.level, 'lunge', '런지 단계');
    var text = joinText(g.lower);
    includes(text, '백핸드', '백핸드 런지 주의');
    includes(text, '발바닥 전체', '착지 주의(쉬운 말)');
    includes(text, '발목을 삐기 쉬워요', '접질림 설명(쉬운 말)');
    includes(text, 'PeerJ', '출처');
  });

  test('v1.27 하지: 강도 8 이상·90분 이상이면 피로 구간 경고가 붙는다', function () {
    var hard = BM.ai.jointGuard([], ['드라이브'], { intensity: 9, minutes: 60 });
    eq(hard.lower.on, true, '강도 9');
    eq(hard.lower.level, 'fatigue', '피로 단계');
    eq(hard.heavy, true, '피로 구간');
    includes(hard.lower.window, '마지막 30분', '피로 구간 문구');
    includes(hard.lower.window, '발바닥 전체', '착지 지도');

    var long = BM.ai.jointGuard([], ['드라이브'], { intensity: 5, minutes: 100 });
    eq(long.lower.on, true, '100분');
    includes(long.lower.reason, '무릎', '무릎 모멘트 설명');

    var easy = BM.ai.jointGuard([], ['드라이브'], { intensity: 5, minutes: 40 });
    eq(easy.lower.on, false, '짧고 가벼운 날 → 꺼짐');
    eq(easy.lower.window, '', '피로 경고 없음');
  });

  test('v1.27 하지: 주간 부하 급증 주에도 피로 구간으로 본다', function () {
    var g = BM.ai.jointGuard([], [], { intensity: 5, minutes: 40, load: { zone: 'spike', ratio: 1.8 } });
    eq(g.lower.on, true, '급증 주');
    eq(g.heavy, true, '급증 = 피로 구간');
  });

  test('v1.27 하지: 무릎·발목·아킬레스건 통증은 pain 단계', function () {
    ['무릎', '발목', '아킬레스건'].forEach(function (p) {
      var g = BM.ai.jointGuard([p], [], { intensity: 5, minutes: 40 });
      eq(g.lower.on, true, p + ' 블록');
      eq(g.lower.level, 'pain', p + ' 단계');
      includes(g.lower.reason, p, p + ' 문구');
    });
    eq(BM.ai.jointGuard(['허리'], [], {}).lower.on, false, '허리는 하지 블록 아님');
  });

  test('v1.27 보호 항목: 자가 체크 2개 이상 · 오늘 할 것 3개', function () {
    var g = BM.ai.jointGuard(['어깨', '무릎'], [], { intensity: 9, minutes: 100 });
    ok(g.shoulder.checks.length >= 2, '어깨 체크');
    eq(g.shoulder.guides.length, 3, '어깨 가이드 3개');
    ok(g.shoulder.thresholds.length >= 3, '어깨 기준 3줄');
    ok(g.lower.checks.length >= 2, '하지 체크');
    eq(g.lower.guides.length, 3, '하지 가이드 3개');
    ok(g.lower.thresholds.length >= 4, '하지 기준 4줄');
    includes(g.lower.guides.map(function (x) { return x.name; }).join(' '), '엉덩이', '엉덩이 보강');
    includes(g.lower.guides.map(function (x) { return x.name; }).join(' '), '발목', '발목 버티기');
    includes(g.shoulder.guides.map(function (x) { return x.name; }).join(' '), '벽에 등 대고', '어깨 날개 고정');
  });

  test('v1.27 순수성: 같은 입력이면 같은 결과', function () {
    var a = BM.ai.jointGuard(['어깨'], ['스매시', '풋워크'], { intensity: 8, minutes: 95 });
    var b = BM.ai.jointGuard(['어깨'], ['스매시', '풋워크'], { intensity: 8, minutes: 95 });
    eq(joinText(a), joinText(b), '같은 입력 → 같은 결과');
    /* v1.39: 팔꿈치·손목 블록이 세 번째로 붙어 3곳이면 '첫 부위 외 N곳'으로 줄입니다 */
    eq(a.label, '어깨 외 2곳', '켜진 부위 요약');
    eq(a.arm.on, true, '머리 위 샷 + 센 날 → 팔꿈치·손목 켜짐');
  });

  /* =========================================================
   * 3. 분석 카드에 붙는지
   * ========================================================= */
  test('v1.27 분석: guard가 결과에 담기고 수치가 화면 문구로 나온다', function () {
    var an = analyze({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨'], weakness: ['스매시', '풋워크'] });
    ok(an.guard, 'guard');
    eq(an.guard.shoulder.on, true, '어깨 켜짐');
    eq(an.guard.lower.on, true, '하지 켜짐');
    var text = joinText(an.guard);
    includes(text, '어깨가 찝히기', '어깨 핵심 요약');
    includes(text, '지친 경기 후반', '다리 부상 핵심 요약');
    excludes(text, 'GIRD', '어려운 약어 없음');
    excludes(text, 'p <', '통계 기호 없음');
    excludes(text, 'FR240', '어려운 약어 없음');
    /* 논문 수치는 내부 stats에 그대로 남는다 */
    eq(an.guard.shoulder.stats.girdOR, 36.14, '교차비(내부)');
    eq(an.guard.lower.stats.lowerSharePct.join('~'), '43~86', '하지 부상 비중(내부)');
    eq(an.guard.lower.stats.kneeMomentP, 0.001, '무릎 유의수준(내부)');
    /* 기존 시트 호환(추천드릴·맞춤처방 JSON)은 그대로 */
    var patch = JSON.parse(an.sheetPatch['맞춤처방']);
    ok(patch.rehab && patch.stretch, '맞춤처방 JSON');
    excludes(an.sheetPatch['맞춤처방'], 'function', 'JSON에 함수 없음');
  });

  test('v1.27 처방: 부위별 관리에 새 기준 한 줄이 들어간다', function () {
    includes(BM.ai.INJURY['어깨'].rehab.join(' '), '안으로 덜 돌아가거나', '어깨 기준(쉬운 말)');
    includes(BM.ai.INJURY['무릎'].rehab.join(' '), '백핸드', '무릎 기준');
    includes(BM.ai.INJURY['발목'].rehab.join(' '), '발바닥 전체', '발목 기준(쉬운 말)');
    excludes(BM.ai.INJURY['어깨'].rehab.join(' '), 'GIRD', '어려운 약어 없음');
    excludes(BM.ai.INJURY['무릎'].rehab.join(' '), '모멘트', '어려운 용어 없음');

    var an = analyze({ pain: ['어깨'], weakness: ['드라이브'], intensity: 6, minutes: 60 });
    includes(an.care.rehab.join(' '), '어깨 뒤 풀기', '어깨 처방 연결');
    var knee = analyze({ pain: ['무릎'], weakness: ['드라이브'], intensity: 6, minutes: 60 });
    includes(knee.care.rehab.join(' '), '런지', '무릎 처방 연결');
  });

  /* =========================================================
   * 4. 화면 (일지 & AI 카드)
   * ========================================================= */
  test('v1.27 화면: AI 카드에 관절 보호 체크 접기가 뜬다', function () {
    var an = analyze({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨'], weakness: ['스매시'] });
    var html = BM.views.log.render(logState(an));
    includes(html, 'data-fold="guard"', '접기 식별자');
    includes(html, '관절 보호 체크', '제목');
    includes(html, '어깨 보호 체크', '어깨 블록');
    includes(html, '무릎·발목 보호 체크', '하지 블록');
    includes(html, '쉬운 기준', '기준 제목(쉬운 말)');
    includes(html, 'Guermont 2023', '출처');
    includes(html, '자가 체크', '체크 제목');
    includes(html, '오늘 할 것', '가이드 제목');
  });

  test('v1.27 화면: 조용한 날에는 접기를 만들지 않는다', function () {
    var an = analyze({ cond: 7, intensity: 5, minutes: 40, pain: [], weakness: ['드라이브'] });
    eq(an.guard.shoulder.on, false, '어깨 꺼짐');
    eq(an.guard.lower.on, false, '하지 꺼짐');
    var html = BM.views.log.render(logState(an));
    excludes(html, 'data-fold="guard"', '관절 보호 접기 없음');
    /* 기존 예방 워밍업 접기는 그대로 */
    includes(html, 'data-fold="prevent"', '예방 워밍업은 유지');
  });

  test('v1.27 화면: 통증·약점에 태그가 들어와도 접기가 깨지지 않는다', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var an = analyze({ pain: [PAYLOAD, '어깨'], weakness: [PAYLOAD, '스매시'], intensity: 9, minutes: 100 });
    var html = BM.views.log.render(logState(an));
    excludes(html, '<img src=x', '이스케이프');
    excludes(html, '<script', 'script 없음');
    includes(html, 'data-fold="guard"', '접기는 그대로');
  });

  /* =========================================================
   * 5. 버전 정합성
   * ========================================================= */
  test('v1.27 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.89.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.89.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261127-3', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.89.0', 'TWA 버전 이름');
    eq(twa.appVersionCode, 83, 'TWA 버전 코드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
