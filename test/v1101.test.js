/* ============================================================
 * test/v1101.test.js — bm-v1.102.0
 *
 *   2026-11-28 16시 정기 배드민턴 AI 고도화 — 아직 ai.js에 없던 검증된 논문 근거 2가지
 *
 *   1) 수분 · 체온 (Hydration & Thermal Strain)
 *      Pang et al., IJSPP 20(12):1647-1653, 2025 (DOI 10.1123/ijspp.2024-0428)
 *      Abián-Vicén et al., PLoS ONE 7(5):e37821, 2012 (DOI 10.1371/journal.pone.0037821)
 *      Abián-Vicén et al., IJSPP 9(4):689-694, 2014 (DOI 10.1123/ijspp.2013-0269)
 *      → 90분 이상 · 강도 8 이상 · 2경기(시합·땀·더위 메모) 중 하나면
 *        '11점 60초·세트 간 120초마다 한두 모금, 탈수 체중 1% 아래' 팁. 2시간 넘으면 전해질 한 줄.
 *   2) 정신 피로 (Mental Fatigue)
 *      Van Cutsem et al., Psychol Sport Exerc 45:101579, 2019 (DOI 10.1016/j.psychsport.2019.101579)
 *      Ding et al., BMC Sports Sci Med Rehabil 16:179, 2024 (DOI 10.1186/s13102-024-00963-w)
 *      → 컨디션 2 이하 · 수면/피곤/집중/타이밍 메모 · 고강도인데 승률·컨디션 저하 중 하나면
 *        '반응 약 7% 느려짐' + 스마트폰 줄이기 · 60초 눈·호흡 · 직선·가운데 단순화 3단계.
 *   3) analyze 연결 — 진단 목록 · 회복/마음 처방
 *   4) 화면 — 조건이 맞을 때만 '오늘 컨디션 케어' 접기 하나 (수분 · 머리 피로)
 *   5) 보호 — 조건이 없으면 예전 그대로 · 실존 선수 이름 없음 · null 없음 · 버전 정합
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes, near = t.near;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var AI = BM.ai;

  /* ---------- 도우미 ---------- */
  function day(n) { return U.ymd(U.addDays(new Date(), n)); }

  function rec(offsetDays, extra) {
    var e = {
      date: day(offsetDays), cond: 6, intensity: 6, minutes: 60, done: [],
      score: { a: 21, b: 18 }, result: '승', pain: [], weakness: [], level: 'C조', text: ''
    };
    Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  function analyze(draft, records, extra) {
    var d = { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], games: [], weakness: [], pain: [] };
    Object.keys(draft || {}).forEach(function (k) { d[k] = draft[k]; });
    var input = { draft: d, records: records || [], level: 'C조', nick: '승우' };
    Object.keys(extra || {}).forEach(function (k) { input[k] = extra[k]; });
    return AI.analyze(input);
  }

  function labels(an) { return (an.insights || []).map(function (i) { return i.label; }).join(' | '); }
  function allText(o) { return JSON.stringify(o); }

  function stateFor(an) {
    return {
      ready: true, mode: 'local',
      me: { key: 'demo_me', nick: '승우', level: 'C조', discipline: '복식', theme: {} },
      rows: [], data: { records: [], posts: [], threads: [], matchProfiles: [] },
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, games: [], weakness: [], pain: [] } },
      ui: {}, analysis: an, stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1. 수분 · 체온 — 언제 켜지는가
   * ========================================================= */
  test('v1.101 수분: 90분 이상이면 켜진다 (논문 근거 문구 그대로)', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 90 });
    ok(an.hydration.on, '90분이면 켜짐');
    eq(an.hydration.level, 'long', '이유: 긴 훈련');
    includes(an.hydration.reason, '시간당 1L', '시간당 1L');
    includes(an.hydration.reason, '11점 60초', '11점 60초');
    includes(an.hydration.reason, '120초', '세트 사이 120초');
    includes(an.hydration.reason, '1%', '탈수 체중 1% 아래');
    includes(an.hydration.reason, '점프', '후반 점프 유지');
  });

  test('v1.101 수분: 90분 미만·강도 7·1경기는 조용하다', function () {
    var an = analyze({ cond: 7, intensity: 7, minutes: 89, games: [{ a: 21, b: 18 }] });
    eq(an.hydration.on, false, '조용함');
    eq(an.hydration.reason, '', '이유 없음');
    eq(an.hydration.tips.length, 0, '팁 없음');
  });

  test('v1.101 수분: 강도 8 이상이면 시간이 짧아도 켜진다', function () {
    var an = analyze({ cond: 7, intensity: 8, minutes: 50 });
    ok(an.hydration.on, '고강도');
    eq(an.hydration.level, 'hard', '이유: 강도');
    includes(an.hydration.reason, '강도 8', '강도 표시');
  });

  test('v1.101 수분: 하루 2경기면 켜지고 이유에 경기 수가 들어간다', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 60, games: [{ a: 21, b: 18 }, { a: 19, b: 21 }] });
    ok(an.hydration.on, '2경기');
    eq(an.hydration.level, 'match', '이유: 시합·연속 경기');
    includes(an.hydration.reason, '2경기', '경기 수');
  });

  test('v1.101 수분: 메모에 시합·땀·더위가 있으면 1경기여도 켜진다', function () {
    ['오늘은 시합이었어요', '땀이 많이 났다', '체육관이 너무 더위서 힘들었어요', '연속 경기 두 개 뛰었어요'].forEach(function (note) {
      var an = analyze({ cond: 7, intensity: 6, minutes: 60, note: note, games: [{ a: 21, b: 18 }] });
      ok(an.hydration.on, '메모로 켜짐: ' + note);
      eq(an.hydration.level, 'match', '이유: 메모');
    });
  });

  test('v1.101 수분: 2시간 이상이면 전해질 한 줄이 붙고, 그 전에는 붙지 않는다', function () {
    var long = analyze({ cond: 6, intensity: 7, minutes: 120 });
    includes(long.hydration.electrolyte, '스포츠음료', '2시간 이상 전해질 안내');
    includes(long.hydration.electrolyte, '소금', '소금 한 꼬집');
    var shortOne = analyze({ cond: 6, intensity: 7, minutes: 100 });
    eq(shortOne.hydration.electrolyte, '', '100분은 전해질 안내 없음');
  });

  test('v1.101 수분: 팁은 4줄 — 나눠 마시기·체중 재기·체온·후반 점프', function () {
    var an = analyze({ cond: 6, intensity: 8, minutes: 90 });
    eq(an.hydration.tips.length, 4, '팁 4줄');
    var text = an.hydration.tips.join(' ');
    includes(text, '한두 모금', '나눠 마시기');
    includes(text, '체중', '운동 전후 체중');
    includes(text, '38.5', '심부 체온 38.5℃');
    includes(text, '점프', '후반 점프');
    excludes(text, 'undefined', 'undefined 없음');
  });

  test('v1.101 수분: 근거 논문 DOI 3편이 그대로 들어 있다', function () {
    var an = analyze({ cond: 6, intensity: 8, minutes: 90 });
    includes(an.hydration.source, '10.1123/ijspp.2024-0428', 'Pang 2025 IJSPP');
    includes(an.hydration.source, '10.1371/journal.pone.0037821', 'Abián-Vicén 2012 PLoS ONE');
    includes(an.hydration.source, '10.1123/ijspp.2013-0269', 'Abián-Vicén 2014 IJSPP');
    includes(an.hydration.sourceShort, 'Pang 2025', '짧은 근거 줄');
  });

  /* =========================================================
   * 2. 정신 피로 — 언제 켜지는가
   * ========================================================= */
  test('v1.101 정신 피로: 컨디션 2 이하면 켜지고 반응 7%를 짚어 준다', function () {
    var an = analyze({ cond: 2, intensity: 6, minutes: 60 });
    ok(an.mental.on, '컨디션 2');
    eq(an.mental.level, 'cond', '이유: 컨디션');
    includes(an.mental.reason, '7%', '반응 약 7%');
    includes(an.mental.reason, '힘들게', '더 힘들게 느껴진다');
  });

  test('v1.101 정신 피로: 컨디션 3은 이 카드로 켜지지 않는다', function () {
    var an = analyze({ cond: 3, intensity: 6, minutes: 60 });
    eq(an.mental.on, false, '컨디션 3은 조용함');
  });

  test('v1.101 정신 피로: 메모의 수면·피곤·집중·타이밍·반응을 읽는다', function () {
    ['어제 잠을 못 자서 수면이 부족했어요', '몸이 피곤하다', '집중이 안 됐어요', '타이밍이 계속 늦었어요', '반응이 느렸어요'].forEach(function (note) {
      var an = analyze({ cond: 7, intensity: 6, minutes: 60, note: note });
      ok(an.mental.on, '메모로 켜짐: ' + note);
      eq(an.mental.level, 'mind', '이유: 메모');
      includes(an.mental.reason, '7%', '반응 7%');
    });
  });

  test('v1.101 정신 피로: 고강도인데 최근 승률이 떨어졌으면 켜진다', function () {
    var losing = [
      rec(-6, { score: { a: 15, b: 21 }, result: '패', intensity: 8, cond: 7, minutes: 90 }),
      rec(-4, { score: { a: 18, b: 21 }, result: '패', intensity: 8, cond: 6, minutes: 90 }),
      rec(-2, { score: { a: 12, b: 21 }, result: '패', intensity: 8, cond: 7, minutes: 90 })
    ];
    var an = analyze({ cond: 7, intensity: 8, minutes: 60 }, losing);
    ok(an.mental.on, '고강도 + 낮은 승률');
    eq(an.mental.level, 'hard', '이유: 강도·결과');
    includes(an.mental.reason, '승률', '승률 언급');
  });

  test('v1.101 정신 피로: 고강도라도 이기고 컨디션 좋으면 조용하다', function () {
    var winning = [
      rec(-6, { score: { a: 21, b: 15 }, result: '승' }),
      rec(-4, { score: { a: 21, b: 18 }, result: '승' }),
      rec(-2, { score: { a: 21, b: 12 }, result: '승' })
    ];
    var an = analyze({ cond: 7, intensity: 9, minutes: 60 }, winning);
    eq(an.mental.on, false, '조용함');
  });

  test('v1.101 정신 피로: 3단계 — 스마트폰 줄이기 · 60초 눈·호흡 · 직선·가운데', function () {
    var an = analyze({ cond: 2, intensity: 7, minutes: 60 });
    eq(an.mental.steps.length, 3, '3단계');
    var names = an.mental.steps.map(function (s) { return s.name; }).join(' | ');
    includes(names, '스마트폰', '① 스마트폰 줄이기');
    includes(names, '60초', '② 60초 리셋');
    includes(names, '직선', '③ 직선·가운데');
    var how = an.mental.steps.map(function (s) { return s.how; }).join(' ');
    includes(names, '30~60분 전', '경기 30~60분 전');
    includes(how, '가운데', '가운데 코스');
  });

  test('v1.101 정신 피로: 근거 논문 DOI 2편이 그대로 들어 있다', function () {
    var an = analyze({ cond: 2, intensity: 7, minutes: 60 });
    includes(an.mental.source, '10.1016/j.psychsport.2019.101579', 'Van Cutsem 2019');
    includes(an.mental.source, '10.1186/s13102-024-00963-w', 'Ding 2024');
    includes(an.mental.sourceShort, 'Van Cutsem 2019', '짧은 근거 줄');
  });

  /* =========================================================
   * 3. analyze 연결 — 진단 · 처방
   * ========================================================= */
  test('v1.101 analyze: 진단 목록에 "수분 보충"·"머리 피로"가 들어간다', function () {
    var an = analyze({ cond: 2, intensity: 8, minutes: 100, note: '시합 2경기', games: [{ a: 21, b: 18 }, { a: 17, b: 21 }] });
    var lb = labels(an);
    includes(lb, '수분 보충', '수분 진단');
    includes(lb, '머리 피로', '머리 피로 진단');
    eq(an.insights.length <= 6, true, '진단은 6개 이하');
  });

  test('v1.101 analyze: 수분 카드가 켜진 날은 회복 처방에 한 줄이 붙는다', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 100 });
    includes(an.care.rehab.join(' '), '물 한두 모금', '회복 처방에 수분 한 줄');
  });

  test('v1.101 analyze: 머리 피로 카드가 켜진 날은 마음 처방에 한 줄이 붙는다', function () {
    var an = analyze({ cond: 2, intensity: 6, minutes: 60 });
    includes(an.care.mental.join(' '), '7%', '마음 처방에 정신 피로 한 줄');
  });

  test('v1.101 analyze: 강도 조절(브레이크) 규칙은 마음 처방 맨 앞을 지킨다', function () {
    var an = analyze({ cond: 1, intensity: 9, minutes: 60 });
    eq(an.mental.on, true, '정신 피로 켜짐');
    includes(an.care.mental[0], '결국 선수 본인이 조절', '브레이크 규칙이 여전히 맨 앞');
    eq(an.care.mental.length <= 3, true, '마음 처방은 3줄 이하');
  });

  test('v1.101 analyze: 결과에 null·undefined가 없다 (시트에 그대로 넣을 수 있어야 함)', function () {
    [{}, { cond: null, intensity: null, minutes: null }, { cond: 2, intensity: 8, minutes: 100, note: '' }].forEach(function (d) {
      var an = analyze(d);
      excludes(allText(an), 'undefined', 'undefined 없음');
      excludes(allText(an), 'null', 'null 없음');
    });
  });

  test('v1.101 analyze: 같은 입력이면 항상 같은 결과', function () {
    var d = { cond: 2, intensity: 8, minutes: 100, note: '더위' };
    var a = analyze(d), b = analyze(d);
    eq(allText(a.hydration), allText(b.hydration), '수분 카드 동일');
    eq(allText(a.mental), allText(b.mental), '정신 피로 카드 동일');
  });

  /* =========================================================
   * 4. 화면 — 조건이 맞을 때만 '오늘 컨디션 케어' 접기 하나
   * ========================================================= */
  test('v1.101 화면: 두 카드가 모두 켜지면 접기 하나에 수분·머리 피로가 함께 나온다', function () {
    var an = analyze({ cond: 2, intensity: 8, minutes: 100, note: '시합 2경기', games: [{ a: 21, b: 18 }, { a: 17, b: 21 }] });
    var html = BM.views.log.render(stateFor(an));
    includes(html, 'data-fold="state"', '컨디션 케어 접기');
    includes(html, '오늘 컨디션 케어', '접기 이름');
    includes(html, 'data-hydration="', '수분 블록');
    includes(html, 'data-mental="', '머리 피로 블록');
    includes(html, '11점 60초', '수분 안내 문구');
    includes(html, '스마트폰', '정신 피로 3단계');
    includes(html, '수분 · 머리 피로', '접기 요약');
    excludes(html, 'undefined', 'undefined 없음');
    eq((html.match(/data-fold="state"/g) || []).length, 1, '접기는 한 칸만');
  });

  test('v1.101 화면: 수분만 켜진 날은 머리 피로 블록 없이 나온다', function () {
    var an = analyze({ cond: 7, intensity: 8, minutes: 60 });
    var html = BM.views.log.render(stateFor(an));
    includes(html, 'data-fold="state"', '접기 있음');
    includes(html, 'data-hydration="', '수분 블록');
    excludes(html, 'data-mental="', '머리 피로 블록 없음');
  });

  test('v1.101 화면: 둘 다 조용한 날은 접기가 아예 안 나온다 (예전 화면 그대로)', function () {
    var an = analyze({ cond: 7, intensity: 5, minutes: 60 });
    var html = BM.views.log.render(stateFor(an));
    excludes(html, 'data-fold="state"', '접기 없음');
    excludes(html, '오늘 컨디션 케어', '이름 없음');
    includes(html, 'data-fold="prevent"', '예방 워밍업 접기는 그대로');
    includes(html, 'data-fold="care"', '맞춤 처방 접기는 그대로');
  });

  test('v1.101 화면: 메모에 쓴 글자가 그대로 HTML로 실행되지 않는다', function () {
    var payload = '"><img src=x onerror=alert(1)>더위';
    var an = analyze({ cond: 7, intensity: 8, minutes: 90, note: payload });
    var html = BM.views.log.render(stateFor(an));
    excludes(html, '<img src=x onerror=alert(1)>', '주입된 태그 없음');
    includes(html, 'data-hydration="', '메모의 더위로 켜진 수분 카드는 그대로 나온다');
  });

  /* =========================================================
   * 5. 보호 — 실존 선수 이름 · 기존 기능 · 버전
   * ========================================================= */
  test('v1.101 보호: 기존 AI 카드·처방·드릴은 그대로', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 60, weakness: ['드라이브'] });
    eq(an.drills.drills.length, 3, '추천 드릴 3개');
    ok(an.prevent && an.prevent.items.length, '예방 워밍업');
    ok(an.cool && typeof an.cool.on === 'boolean', '쿨다운 카드');
    ok(an.jump && typeof an.jump.on === 'boolean', '피로 점프 카드');
    ok(an.guard && an.guard.title, '관절 보호');
    ok(an.load && typeof an.load.ratio === 'number', '부하 점검');
    ok(an.care.warmup.length && an.care.rehab.length && an.care.stretch.length && an.care.mental.length, '처방 4종');
    eq(an.sheetPatch && JSON.parse(an.sheetPatch['맞춤처방']).rehab.length > 0, true, '시트 모양 그대로');
  });

  test('v1.101 상수: 기준값이 논문 숫자와 같다', function () {
    eq(AI.HYDRATION.longMinutes, 90, '90분');
    eq(AI.HYDRATION.hardIntensity, 8, '강도 8');
    eq(AI.HYDRATION.manyGames, 2, '2경기');
    eq(AI.HYDRATION.longHours, 2, '2시간');
    eq(AI.HYDRATION.dehydrationPct, 1, '탈수 1%');
    eq(AI.HYDRATION.coreHighC, 38.5, '38.5℃');
    eq(AI.HYDRATION.sweatMlPerMatch.indexOf(566) >= 0, true, '경기당 땀 566mL');
    near(AI.HYDRATION.sweatLPerHour, 1.0, 0.01, '시간당 1L');
    eq(AI.MENTAL.lowCond, 2, '컨디션 2');
    eq(AI.MENTAL.hardIntensity, 8, '강도 8');
    eq(AI.MENTAL.respPct, 7, '반응 7%');
  });

  test('v1.101 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var push = readRoot('js/push.js');
    includes(sw, "var VERSION = 'bm-v1.102.0'", 'sw.js');
    includes(app, "version: 'v1.102.0'", 'app.js');
    includes(push, "version: 'v1.102.0'", 'push.js');
    includes(index, 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.102.0', 'TWA 이름');
    eq(twa.appVersion, '1.102.0', 'TWA appVersion');
    eq(twa.appVersionCode, 96, 'TWA 버전 코드 +1');
    includes(readRoot('README.md'), 'bm-v1.102.0', 'README');
    includes(readRoot('test/run.js'), 'test/v1101.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
