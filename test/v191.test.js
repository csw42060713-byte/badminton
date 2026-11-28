/* ============================================================
 * test/v191.test.js — bm-v1.96.0
 *   🦶 종아리 쿨다운 · 아킬레스 보호 AI 고도화
 *
 *   1) 근거     — 동호인 158명 종아리 뻣뻣함 26.6% · 웜업 r=-0.006 vs 쿨다운 r=-0.890 (Ingle 2025)
 *                 엘리트 66명 중 32% 아킬레스건 통증 · 주당 훈련량 많을수록 위험 (Fahlström 2002)
 *   2) 판단     — 발목·종아리·아킬레스 통증 / 60분 이상 / 강도 8 이상 / 주간 부하 급증
 *   3) 처방     — 운동 후 5분 3동작(종아리·가자미근·뒤꿈치 내리기) + 강도 한 칸 낮추기
 *   4) 화면     — '부상 예방 · 종목 부하' 접기 안 '마무리 5분' · 스트레칭·회복 처방 · 저장된 처방
 *   5) 보호     — 기존 AI 진단·드릴·관절 보호·피로 점프 문구 그대로 · 실존 선수 이름 없음
 *   6) 버전     — sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var AI = BM.ai;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  function day(n) {
    return U.ymd(U.addDays(U.parseYmd(U.ymd()), -n));
  }

  function analyze(draft, records) {
    return AI.analyze({
      draft: draft, records: records || [], level: 'B조', nick: '승우', discipline: '복식'
    });
  }

  function coolText(c) {
    return [c.title, c.reason, c.advice, c.note, c.stretchLine]
      .concat((c.items || []).map(function (it) { return it.name + ' ' + it.how; }))
      .join(' \n ');
  }

  /* 주간 부하를 확실히 급증(spike)으로 만드는 기록 — 최근 7일에 길고 센 훈련을 몰아 넣습니다 */
  function spikeRecords() {
    return [
      { date: day(1), cond: 6, intensity: 9, minutes: 120, done: ['풋워크'], pain: [], weakness: ['풋워크'] },
      { date: day(2), cond: 6, intensity: 9, minutes: 120, done: ['풋워크'], pain: [], weakness: ['풋워크'] },
      { date: day(3), cond: 6, intensity: 9, minutes: 110, done: ['풋워크'], pain: [], weakness: ['풋워크'] },
      { date: day(20), cond: 6, intensity: 5, minutes: 40, done: ['풋워크'], pain: [], weakness: ['풋워크'] }
    ];
  }

  /* =========================================================
   * 1. 근거 — 실제 확인된 두 논문의 숫자
   * ========================================================= */
  test('v1.91 근거: 동호인 158명 조사의 종아리 뻣뻣함·웜업/쿨다운 상관을 그대로 쓴다', function () {
    var C = AI.CALF;
    eq(C.tightN, 158, '조사 표본 158명');
    eq(C.tightPct, 26.6, '종아리 뻣뻣함 26.6%');
    eq(C.tightCount, 42, '42명');
    eq(C.cooldownR, -0.89, '쿨다운 상관 r = -0.890');
    eq(C.warmupR, -0.006, '웜업 상관 r = -0.006');
    eq(AI.CALF_STATS.cooldownMin, 5, '마무리 5분');
  });

  test('v1.91 근거: 엘리트 66명 중 32%가 아킬레스건 통증 — 주당 훈련량이 많을수록 위험', function () {
    var C = AI.CALF;
    eq(C.achillesN, 66, '엘리트 66명');
    eq(C.achillesPct, 32, '32%');
    eq(C.achillesCount, 21, '21명');
    if (!hasNode) return;
    var js = readRoot('js/ai.js');
    includes(js, '10.25259/srjhs_14_2025', 'Ingle 2025 DOI');
    includes(js, '10.1177/03635465020300012201', 'Fahlström 2002 DOI');
    includes(js, '주당 총 훈련 시간', '주당 훈련 시간 근거 문장');
  });

  test('v1.91 근거: 화면 문구에는 통계 기호·논문 용어를 그대로 노출하지 않는다', function () {
    var c = AI.coolDown(['발목'], { minutes: 70, intensity: 6 });
    var txt = coolText(c);
    excludes(txt, 'r =', '상관계수 기호 비노출');
    excludes(txt, 'p <', '유의수준 기호 비노출');
    excludes(txt, '배측굴곡', '논문 용어 비노출');
    includes(txt, '동호인 네 명 중 한 명', '쉬운 말로 비율 설명');
  });

  /* =========================================================
   * 2. 판단 — 언제 켜지고 언제 꺼지는가
   * ========================================================= */
  test('v1.91 판단: 발목·아킬레스건 통증이면 코트 전이 아니라 운동 후 쿨다운이 켜진다', function () {
    ['발목', '아킬레스건', '종아리'].forEach(function (p) {
      var c = AI.coolDown([p], { minutes: 40, intensity: 5 });
      eq(c.on, true, p + ' 통증 → 켜짐');
      eq(c.level, 'pain', p + ' 통증 단계');
      ok(c.areas.indexOf(p) >= 0, p + ' 부위 기록');
      includes(c.reason, p, '이유에 통증 부위');
      includes(c.reason, '운동 끝나고 5분', '운동 후 5분 안내');
      includes(c.advice, '강도를 한 칸 낮추고', '강도 낮추기');
      eq(c.items.length, 3, '3동작');
    });
  });

  test('v1.91 판단: 60분 이상 친 날은 통증이 없어도 마무리 5분이 켜진다', function () {
    var c = AI.coolDown([], { minutes: 60, intensity: 5 });
    eq(c.on, true, '60분 → 켜짐');
    eq(c.level, 'load', '볼륨 이유');
    includes(c.reason, '60분', '시간 근거');
    includes(c.reason, '웜업보다 경기 후 종아리 스트레칭', '웜업 vs 쿨다운');
    eq(c.advice, '', '통증·부하 급증이 없으면 강도 경고는 붙지 않는다');
  });

  test('v1.91 판단: 강도 8 이상(고강도)도 켜지고, 짧고 가벼운 날은 꺼진다', function () {
    var hard = AI.coolDown([], { minutes: 45, intensity: 8 });
    eq(hard.on, true, '강도 8 → 켜짐');
    eq(hard.level, 'load', '고강도 단계');
    includes(hard.reason, '강도 8', '강도 근거');

    var easy = AI.coolDown([], { minutes: 40, intensity: 7 });
    eq(easy.on, false, '40분 · 강도 7 → 꺼짐');
    eq(easy.items.length, 0, '꺼지면 동작 없음');
    eq(easy.level, '', '꺼지면 단계 없음');
  });

  test('v1.91 판단: 주간 훈련량이 급증한 주에 통증이 겹치면 아킬레스 부하를 짚는다', function () {
    var c = AI.coolDown(['아킬레스건'], { minutes: 70, intensity: 7, load: { zone: 'spike', ratio: 2.4 } });
    eq(c.heavyWeek, true, '급증 주');
    includes(c.advice, '이번 주 누적 훈련량이 많아요', '누적 훈련량 경고');
    includes(c.advice, '아킬레스건은 주당 훈련 시간이 많을수록', '논문 근거를 쉬운 말로');
    includes(c.reason, '이번 주 훈련량이 평소보다 많아', '이유에도 이번 주 부하');
  });

  /* =========================================================
   * 3. 처방 — 5분 3동작
   * ========================================================= */
  test('v1.91 처방: 종아리·가자미근·뒤꿈치 내리기 3동작이 5분으로 묶인다', function () {
    var c = AI.coolDown(['발목'], {});
    eq(c.minutes, 5, '5분');
    eq(c.label, '5분', '표시');
    var names = c.items.map(function (it) { return it.name; }).join(' | ');
    includes(names, '종아리 스트레칭', '종아리 스트레칭');
    includes(names, '가자미근', '가자미근(무릎 굽히고)');
    includes(names, '뒤꿈치 내리기', '계단 뒤꿈치 내리기');
    var sum = c.items.reduce(function (n, it) { return n + it.min; }, 0);
    eq(sum, 5, '동작 시간 합 5분');
    includes(c.items[0].how, '무릎을 편 채 30초', '종아리 스트레칭 방법');
    includes(c.items[1].how, '뒷무릎만 살짝 굽히면', '가자미근 방법');
    includes(c.items[2].how, '발목을 안·밖으로 10회', '발목 돌리기 방법');
    includes(c.note, '코트에서 나오기 전에', '마무리 안내');
    includes(c.stretchLine, '운동 끝나고 5분', '처방 한 줄');
  });

  /* =========================================================
   * 4. 화면 — 진단 결과에 실제로 붙는가
   * ========================================================= */
  test('v1.91 화면: 발목 통증 일지에서 AI가 쿨다운 카드를 켜고 처방에 넣는다', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 50, pain: ['발목'], weakness: ['풋워크'] });
    ok(an.cool && an.cool.on, 'cool 켜짐');
    eq(an.cool.level, 'pain', '통증 단계');
    includes(an.care.stretch.join(' '), '운동 끝나고 5분', '스트레칭 처방에 쿨다운');
    includes(an.care.rehab.join(' '), '강도를 한 칸 낮추고', '회복 처방에 강도 조절');
    var html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
    includes(html, 'data-fold="prevent"', '부상 예방 접기 그대로');
    includes(html, 'data-cool="pain"', '쿨다운 블록');
    includes(html, '운동 후 5분 종아리·아킬레스 쿨다운', '제목');
    includes(html, '마무리 5분', '접기 요약에 마무리 5분');
    includes(html, 'data-dtimer="cool:0"', '첫 동작 타이머');
    eq((html.match(/data-dtimer="cool:/g) || []).length, 3, '3동작 타이머');
    includes(html, 'Am J Sports Med', '참고 논문 줄');
  });

  test('v1.91 화면: 90분 센 훈련을 남기면 통증이 없어도 쿨다운이 붙는다', function () {
    var an = analyze({ cond: 7, intensity: 9, minutes: 90, pain: [], weakness: ['드라이브'] });
    ok(an.cool.on, '켜짐');
    eq(an.cool.level, 'load', '볼륨 이유');
    includes(an.care.stretch.join(' '), '운동 끝나고 5분', '처방에도 반영');
    var html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
    includes(html, 'data-cool="load"', '쿨다운 블록(부하)');
  });

  test('v1.91 화면: 짧고 가벼운 날에는 쿨다운 블록이 뜨지 않는다', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 40, pain: [], weakness: ['드라이브'] });
    eq(an.cool.on, false, '꺼짐');
    eq(an.care.stretch.join(' ').indexOf('운동 끝나고 5분'), -1, '처방에도 없음');
    var html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
    eq(html.indexOf('data-cool'), -1, '쿨다운 블록 없음');
  });

  test('v1.91 처방: 저장한 일지에도 쿨다운 한 줄이 남는다', function () {
    var an = analyze({ cond: 6, intensity: 5, minutes: 65, pain: [], weakness: ['풋워크'] });
    var rec = { date: U.ymd(), cond: 6, intensity: 5, minutes: 65, pain: [], weakness: ['풋워크'], prescription: an.care };
    var html = BM.views.log.recordDetail(rec);
    includes(html, '운동 끝나고 5분', '저장된 처방에 쿨다운');
  });

  /* =========================================================
   * 5. 보호 — 기존 코칭이 그대로인가
   * ========================================================= */
  test('v1.91 보호: 기존 진단·드릴·관절 보호·피로 점프 문구는 그대로 유지된다', function () {
    var an = analyze({ cond: 3, intensity: 9, minutes: 100, pain: ['어깨'], weakness: ['스매시'] });
    eq(an.drills.drills.length, 3, '드릴 3개');
    ok(an.guard && an.guard.shoulder.on, '어깨 보호 켜짐');
    ok(an.guard.lower.on, '센 날은 하지 피로 구간도 켜짐');
    includes(an.guard.lower.reason, '배드민턴 다리 부상은 대부분 지친 경기 후반에 몰려요', '하지 보호 문구');
    ok(an.jump && an.jump.on, '피로 점프 경고');
    includes(an.jump.reason, '점프가 평소보다 낮아지고', '피로 점프 문구');
    eq(an.care.rehab[0], AI.PAIN_RULE.stop, '회복 처방 맨 앞은 통증 기준');
    ok(an.prevent && an.prevent.items.length >= 3, '코트 전 워밍업 그대로');
    includes(an.prevent.source, 'Phomsoupha', '워밍업 근거 그대로');
  });

  test('v1.91 보호: 실존 선수·브랜드 이름이 새 코드·테스트에 없다', function () {
    if (!hasNode) return;
    var files = ['js/ai.js', 'js/views/log.js', 'index.html', 'sw.js', 'test/v191.test.js'];
    /* 이름은 이스케이프로만 적어 두고, 화면·코드에 실제 글자로 나타나지 않는지 봅니다 */
    var names = ['\uAE40\uc6D0\ud638', '\uc548\uc138\uc601', '\uc11C\uc2B9\uc7AC',
      '\uc694\ub125\uc2A4', '\ube45\ud130', '\x59ONEX', '\x56ICTOR', '\x4Ci-Ning'];
    files.forEach(function (f) {
      var s = readRoot(f);
      names.forEach(function (n) { excludes(s, n, f + ' 에 ' + n); });
    });
  });

  /* =========================================================
   * 6. 버전 — 캐시·앱 버전 함께
   * ========================================================= */
  test('v1.91 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), idx = readRoot('index.html');
    var twa = readJson('twa-manifest.json'), readme = readRoot('README.md'), run = readRoot('test/run.js');
    includes(sw, "var VERSION = 'bm-v1.104.0'", 'sw 버전');
    includes(sw, 'bm-v1.104.0', 'sw 변경 이력');
    includes(app, "version: 'v1.104.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.104.0'", 'push 버전');
    includes(idx, 'styles.css?v=20261128-6', '스타일 캐시 키');
    eq(twa.appVersionName, '1.104.0', 'TWA 이름');
    eq(twa.appVersion, '1.104.0', 'TWA appVersion');
    eq(twa.appVersionCode, 98, 'TWA 코드');
    includes(readme, 'bm-v1.104.0', 'README');
    includes(run, 'test/v191.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
