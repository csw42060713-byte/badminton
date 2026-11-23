/* ============================================================
 * test/v128.test.js — bm-v1.37.2
 *   AI 분석 · 관절 보호 · 부상 예방 문구를 '쉬운 코트 말투'로 다듬은 버전.
 *   승우 님이 관절 보호 체크를 보고 "이해하기 너무 어려운데..."라고 한 것에서
 *   출발했습니다 — 화면에는 어려운 약어·통계 기호를 두지 않고,
 *   논문 수치는 내부 값(stats)과 맨 아래 작은 '참고 논문' 한 줄에만 남깁니다.
 *
 *   1) 어깨 · 무릎/발목 보호 체크의 쉬운 문구
 *   2) 사용자가 보는 문구에 어려운 기호가 섞이지 않았는지 (OR · p < · FR240 · GIRD · 저측굴곡 …)
 *   3) 출처는 작은 한 줄, 수치는 내부에 그대로
 *   4) 예방 워밍업 · 종목 부하 카드의 약어 정리
 *
 *   실행: node test/run.js
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

  /* 사용자가 보는 문구에 절대 나오면 안 되는 것들 */
  var HARD = ['OR ', 'p <', 'FR240', 'GIRD', '저측굴곡', 'HRmax', 'ACWR', 'RPE', 'IRR', 'ρ', 'Spearman', '모멘트', '구심성', '원심성', '관절낭', '슬리퍼', '견갑', '내회전', '외회전'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* 카드에서 사용자가 읽는 글만 모읍니다(HTML 태그 제거) */
  function plain(html) {
    return String(html).replace(/<[^>]*>/g, ' ');
  }

  /* =========================================================
   * 1. 어깨 보호 체크 — 쉬운 문구
   * ========================================================= */
  test('v1.28 어깨: 핵심 요약이 코트 말투다', function () {
    var g = BM.ai.jointGuard(['어깨'], [], { intensity: 6, minutes: 60 });
    eq(g.shoulder.title, '어깨 보호 체크', '블록 제목');
    includes(g.shoulder.reason, '주로 쓰는 어깨가 반대쪽보다 안으로 덜 돌아가거나', '핵심 요약');
    includes(g.shoulder.reason, '스매시·클리어 때 어깨가 찝히기 쉬워요', '왜 아픈지');
    includes(g.shoulder.reason, '절반으로 줄이고', '오늘 줄일 것');
    banText(JSON.stringify(g.shoulder), '어깨 블록');
  });

  test('v1.28 어깨: 스매시·클리어 날에도 같은 쉬운 요약을 쓴다', function () {
    var g = BM.ai.jointGuard([], ['스매시'], { intensity: 5, minutes: 40 });
    eq(g.shoulder.level, 'overhead', '단계');
    includes(g.shoulder.reason, '어깨가 찝히기 쉬워요', '머리 위로 치는 날 요약');
    includes(g.shoulder.reason, '코트 전후로', '언제 할지');
    banText(g.shoulder.reason, '오버헤드 요약');
  });

  test('v1.28 어깨: 자가 체크 두 가지가 지시문처럼 읽힌다', function () {
    var g = BM.ai.jointGuard(['어깨'], [], {});
    var names = g.shoulder.checks.map(function (c) { return c.name; }).join('|');
    includes(names, '누워서 어깨 양쪽 비교하기', '첫 번째 체크');
    includes(names, '어깨 뒤쪽 힘 균형', '두 번째 체크');
    var first = g.shoulder.checks[0].how;
    includes(first, '똑바로 누워 팔을 90도로 벌리고', '자세 설명');
    includes(first, '손바닥을 바닥 쪽으로 내려 보세요', '동작 설명');
    includes(first, '눈에 띄게 덜 내려가면 어깨 뒤쪽이 굳은 신호예요', '판단 기준');
    includes(g.shoulder.checks[1].how, '브레이크 잡아주는 뒤쪽 근육이 약하면', '힘 균형 설명');
    excludes(first, '°', '각도 기호 없이');
  });

  test('v1.28 어깨: 오늘 할 것 3개가 동작·횟수까지 한눈에', function () {
    var g = BM.ai.jointGuard(['어깨'], [], {});
    var names = g.shoulder.guides.map(function (x) { return x.name; });
    eq(names.length, 3, '3개');
    eq(names[0], '옆으로 누워 어깨 뒤 풀기 (30초 × 3)', '첫 동작');
    eq(names[1], '밴드 바깥으로 당겼다가 3초 천천히 풀기 (12회 × 3)', '둘째 동작');
    eq(names[2], '벽에 등 대고 팔 위아래 밀기 (10회 × 2)', '셋째 동작');
    g.shoulder.guides.forEach(function (x) {
      ok(x.how.length > 12, x.name + ' 설명 있음');
      excludes(x.how, '°', x.name + ' 기호 없이');
    });
  });

  /* =========================================================
   * 2. 무릎·발목 보호 체크 — 쉬운 문구
   * ========================================================= */
  test('v1.28 무릎·발목: 핵심 요약이 코트 말투다', function () {
    var g = BM.ai.jointGuard([], ['풋워크'], { intensity: 5, minutes: 40 });
    eq(g.lower.title, '무릎·발목 보호 체크', '블록 제목');
    includes(g.lower.reason, '배드민턴 다리 부상은 대부분 지친 경기 후반에 몰려요', '핵심 요약');
    includes(g.lower.reason, '무릎이 덜 굽혀지고 착지가 딱딱해지거든요', '왜 위험한지');
    banText(JSON.stringify(g.lower), '무릎·발목 블록');
  });

  test('v1.28 무릎·발목: 조심할 동작에 백핸드 런지와 착지가 들어간다', function () {
    var g = BM.ai.jointGuard([], ['풋워크'], {});
    eq(g.lower.checkTitle, '조심할 동작', '제목');
    var names = g.lower.checks.map(function (c) { return c.name; }).join('|');
    includes(names, '백핸드 앞쪽 런지 조심', '첫 번째');
    includes(names, '대각선 뒤로 빠질 때 발바닥 전체로 착지', '두 번째');
    var lunge = g.lower.checks[0].how;
    includes(lunge, '무릎에 비틀리는 힘이 더 실려요', '왜 조심하는지');
    includes(lunge, '지친 마지막 세트엔 무리해서 깊게 뻗지 마세요', '행동 지침');
    includes(g.lower.checks[1].how, '발끝부터 먼저 닿으면 발목을 삐기 쉬워요', '착지 설명');
  });

  test('v1.28 무릎·발목: 오늘 할 것이 허벅지 앞·엉덩이·발목으로 나뉜다', function () {
    var g = BM.ai.jointGuard([], ['풋워크'], {});
    var names = g.lower.guides.map(function (x) { return x.name; }).join('|');
    includes(names, '허벅지 앞', '허벅지 앞');
    includes(names, '엉덩이', '엉덩이');
    includes(names, '발목 버티기', '발목');
    eq(g.lower.guides.length, 3, '3개');
  });

  test('v1.28 무릎·발목: 피로 구간 경고도 쉬운 말', function () {
    var g = BM.ai.jointGuard([], ['드라이브'], { intensity: 9, minutes: 110 });
    includes(g.lower.window, '마지막 30분에 다리 부상이 몰려요', '피로 구간');
    includes(g.lower.window, '발바닥 전체로 착지하세요', '착지 지침');
    banText(g.lower.window, '피로 구간 경고');
  });

  /* =========================================================
   * 3. 화면 — 본문에는 쉬운 말만, 출처는 작은 한 줄
   * ========================================================= */
  test('v1.28 화면: 관절 보호 접기에 어려운 기호가 없다', function () {
    var an = analyze({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨', '무릎'], weakness: ['스매시', '풋워크'] });
    var html = BM.views.log.render(logState(an));
    includes(html, 'data-fold="guard"', '접기');
    var body = html.slice(html.indexOf('data-fold="guard"'), html.indexOf('data-fold="offcourt"'));
    banText(plain(body), '관절 보호 접기 본문');
  });

  test('v1.28 화면: 제목이 쉬운 말로 바뀌었다', function () {
    var an = analyze({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨', '무릎'], weakness: [] });
    var html = BM.views.log.render(logState(an));
    includes(html, '쉬운 기준', '기준 제목');
    includes(html, '자가 체크', '어깨 체크 제목');
    includes(html, '조심할 동작', '무릎·발목 체크 제목');
    includes(html, '오늘 할 것', '가이드 제목');
    excludes(html, '>기준<', '옛 "기준" 제목 없음');
  });

  test('v1.28 화면: 출처는 맨 아래 작은 참고 논문 한 줄', function () {
    var an = analyze({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨'], weakness: [] });
    var html = BM.views.log.render(logState(an));
    includes(html, 'planbox__src', '작은 글씨 클래스');
    includes(html, '참고 논문 · Guermont 2023', '어깨 출처 한 줄');
    var lower = analyze({ cond: 6, intensity: 5, minutes: 40, pain: [], weakness: ['풋워크'] });
    includes(BM.views.log.render(logState(lower)), '참고 논문 · Du &amp; Fan 2020', '하지 출처 한 줄');
  });

  test('v1.28 스타일: 참고 논문 줄은 작고 흐리게', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.planbox__src', '클래스 정의');
    ok(/\.planbox__src\s*\{[^}]*font-size:\s*10px/.test(css), '10px');
    ok(/\.planbox__src\s*\{[^}]*opacity/.test(css), '흐리게');
  });

  /* =========================================================
   * 4. 예방 워밍업 · 종목 부하 — 겉에 보이는 약어 정리
   * ========================================================= */
  test('v1.28 예방 워밍업: 근거는 쉬운 문장, 상수는 내부에', function () {
    var pv = BM.ai.preventionWarmup(['무릎', '발목'], '복식');
    banText(JSON.stringify(pv), '예방 워밍업');
    includes(pv.reason, '발목 접질림', '발목 표현');
    includes(pv.reason, '무릎 힘줄 통증', '무릎 표현');
    includes(pv.reason, '준비운동을 자주 할수록 부상이 적었어요', '준비운동 근거');
    /* 수치는 내부 stats에 그대로 */
    eq(pv.stats.ankleSprainPct, 23.5, '발목 염좌 비중(내부)');
    eq(pv.stats.warmupRho, -0.273, '상관계수(내부)');
    eq(pv.stats.preventiBadPct, 70, '부상 감소율(내부)');
  });

  test('v1.28 종목 부하: 심박은 "최대 심박수"로 읽힌다', function () {
    ['단식', '남자복식', '혼합복식', '여자복식', '복식'].forEach(function (d) {
      var g = BM.ai.disciplineLoadGuide(d, 'A조');
      includes(g.heart, '최대 심박수', d + ' 심박 표현');
      banText(g.heart + ' ' + g.tips.join(' '), d + ' 부하 카드');
    });
  });

  test('v1.28 카드: 부상 예방 · 종목 부하 접기에 약어가 없다', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 70, pain: ['무릎'], weakness: ['풋워크'] });
    var html = BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
    includes(html, 'data-fold="prevent"', '접기');
    banText(plain(html.slice(html.indexOf('data-fold="prevent"'), html.indexOf('data-fold="guard"'))), '예방 워밍업 카드');
  });

  test('v1.28 처방: 부위별 관리 문구에 약어가 없다', function () {
    Object.keys(BM.ai.INJURY).forEach(function (area) {
      var box = BM.ai.INJURY[area];
      banText([box.signs.join(' '), box.rehab.join(' '), box.stretch.join(' '), box.ret.join(' ')].join(' '), area + ' 관리');
    });
  });

  test('v1.28 수치 보존: 쉬운 문구로 바꿔도 논문 값은 그대로', function () {
    var s = BM.ai.SHOULDER_RISK, l = BM.ai.LOWER_RISK;
    eq(s.girdDeg, 14, 'GIRD 기준');
    eq(s.girdOR, 36.14, 'GIRD 교차비');
    eq(s.fr240, 0.69, 'FR240 기준');
    eq(s.fr240OR, 28.0, 'FR240 교차비');
    eq(s.irRomDeg, 55, '내회전 기준');
    eq(s.irRomProbPct, 81, '통증 확률');
    eq(l.lowerSharePct.join('~'), '43~86', '하지 부상 비중');
    eq(l.kneeMomentP, 0.001, '무릎 유의수준');
    eq(l.plantarDeg, 33, '착지 저측굴곡');
    eq(l.irDeg, 18, '착지 내회전');
  });

  test('v1.28 코드 주석: 논문 근거는 코드 안에 그대로 남아 있다', function () {
    if (!hasNode) return;
    var code = readRoot('js/ai.js');
    includes(code, 'GIRD > 14°', '어깨 기준 주석');
    includes(code, 'p < 0.001', '하지 유의수준 주석');
    includes(code, '10.1016/j.ptsp.2023.04.002', 'Guermont DOI');
    includes(code, '10.3390/app10238703', 'Du & Fan DOI');
  });

  /* =========================================================
   * 5. 순수성 · 이스케이프 (동작은 그대로)
   * ========================================================= */
  test('v1.28 동작: 문구만 바뀌고 켜짐·꺼짐 규칙은 그대로', function () {
    eq(BM.ai.jointGuard(['어깨'], [], {}).shoulder.on, true, '어깨 통증');
    eq(BM.ai.jointGuard([], ['드라이브'], { intensity: 5, minutes: 40 }).lower.on, false, '가벼운 날');
    eq(BM.ai.jointGuard([], ['드라이브'], { intensity: 8, minutes: 40 }).lower.level, 'fatigue', '강도 8');
    eq(BM.ai.jointGuard([], [], { load: { zone: 'spike' } }).heavy, true, '부하 급증');
    var a = BM.ai.jointGuard(['어깨'], ['스매시'], { intensity: 9, minutes: 110 });
    var b = BM.ai.jointGuard(['어깨'], ['스매시'], { intensity: 9, minutes: 110 });
    eq(JSON.stringify(a), JSON.stringify(b), '같은 입력 → 같은 결과');
  });

  test('v1.28 화면: 통증 태그에 태그를 넣어도 그대로 이스케이프', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var an = analyze({ pain: [PAYLOAD, '무릎'], weakness: [PAYLOAD, '풋워크'], intensity: 9, minutes: 100 });
    var html = BM.views.log.render(logState(an));
    excludes(html, '<img src=x', '이스케이프');
    includes(html, 'data-fold="guard"', '접기는 그대로');
  });

  /* =========================================================
   * 6. 버전 정합성
   * ========================================================= */
  test('v1.28 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.63.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.63.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261124-1', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.63.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.63.0', 'TWA appVersion');
    eq(twa.appVersionCode, 57, 'TWA 버전 코드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
