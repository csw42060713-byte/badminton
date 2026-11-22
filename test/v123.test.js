/* ============================================================
 * test/v123.test.js — v1.24.0 (2026-11-20)
 *  1) offcourtRoutine: 코트 훈련 날 순서(밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭)
 *  2) offcourtRoutine: 웨이트 보강 날 순서(자전거 20분 → 스트레칭 → 본 웨이트 → 폼롤러 30분)
 *  3) 코어 · 허리 보강 3종(행잉 레그 레이즈 · 다리 걸고 윗몸 · 백 익스텐션) 세트·횟수
 *  4) 무릎 충격 줄인 지구력 — 실내 자전거 40분
 *  5) paceGuide: 컨디션·부하 급증·통증·연속 훈련에서 '선수 스스로 강도를 낮춰라'
 *  6) analyze() 통합: 진단·점검·부하 조언에 브레이크 문구
 *  7) AI 분석 카드: 접힌 오프코트 루틴 블록 하나
 *  8) 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util;
  var AI = BM.ai;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function rec(daysAgo, extra) {
    var r = {
      id: 'r' + daysAgo + '-' + Math.random().toString(36).slice(2, 6),
      date: U.ymd(U.addDays(new Date(), -daysAgo)),
      cond: 6, intensity: 6, minutes: 60, done: [], weakness: [], pain: []
    };
    Object.keys(extra || {}).forEach(function (k) { r[k] = extra[k]; });
    return r;
  }
  function texts(list) { return (list || []).join(' '); }

  /* =========================================================
   * 1) 코트 훈련 날 순서
   * ========================================================= */
  test('v1.23 오프코트: 코트 훈련 날은 밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭', function () {
    var oc = AI.offcourtRoutine('단식');
    eq(oc.days.length, 2, '코트 날 · 웨이트 날 두 가지');
    var court = oc.days[0];
    eq(court.title, '코트 훈련 날', '이름');
    eq(court.order, '밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭', '순서 문구');
    eq(court.steps.length, 3, '3단계');
    includes(court.steps[0].name, '밴드', '1단계 밴드 보강');
    includes(court.steps[0].name, '스트레칭', '1단계 스트레칭');
    includes(court.steps[1].name, '본운동', '2단계 본운동');
    eq(court.steps[2].name, '마무리 스트레칭', '3단계 마무리 스트레칭');
    ok(court.steps[0].min > 0 && court.steps[2].min > 0, '밴드·마무리 시간이 있다');
    court.steps.forEach(function (s) {
      ok(s.how && s.how.length > 10, '방법 문구: ' + s.name);
    });
    /* 순서대로 읽히는지 — 밴드가 본운동보다, 본운동이 마무리보다 앞 */
    var all = court.steps.map(function (s) { return s.name; }).join(' > ');
    includes(all, '밴드 보강 + 스트레칭 > 본운동 (코트 훈련) > 마무리 스트레칭', '카드 순서');
  });

  /* =========================================================
   * 2) 웨이트 보강 날 순서
   * ========================================================= */
  test('v1.23 오프코트: 웨이트 날은 자전거 20분 → 스트레칭 → 본 웨이트 → 폼롤러 30분', function () {
    var w = AI.offcourtRoutine('복식').days[1];
    eq(w.title, '웨이트 보강 날', '이름');
    includes(w.order, '실내 자전거 20분', '예열 20분');
    includes(w.order, '스트레칭', '스트레칭');
    includes(w.order, '본 웨이트', '본 웨이트');
    includes(w.order, '폼롤러 30분', '마무리 폼롤러');
    eq(w.steps.length, 4, '4단계');
    eq(w.steps[0].name, '가벼운 실내 자전거 20분', '1단계 자전거');
    eq(w.steps[0].min, 20, '자전거 20분');
    includes(w.steps[1].name, '스트레칭', '2단계 스트레칭');
    eq(w.steps[2].name, '본 웨이트', '3단계 본 웨이트');
    eq(w.steps[3].name, '마무리 폼롤러 30분', '4단계 폼롤러');
    eq(w.steps[3].min, 30, '폼롤러 30분');
    includes(w.steps[3].how, '뭉친 근육을 풀고', '폼롤러 목적');
  });

  test('v1.23 오프코트: 본 웨이트 5종 (불가리안 스플릿 스쿼트 · 스쿼트 · 레그 익스텐션 · 벤치프레스 · 턱걸이)', function () {
    var w = AI.offcourtRoutine('단식').days[1];
    var moves = w.steps[2].moves;
    eq(moves.length, 5, '5종');
    includes(moves[0], '불가리안 스플릿 스쿼트', '불가리안 먼저');
    includes(moves[0], '양손 덤벨', '양손 덤벨');
    includes(moves[0], '뒷발 받침대', '뒷발 받침대');
    includes(moves[0], '뒷무릎', '뒷무릎 깊이');
    includes(texts(moves), '스쿼트', '스쿼트');
    includes(texts(moves), '레그 익스텐션', '레그 익스텐션');
    includes(texts(moves), '벤치프레스', '벤치프레스');
    includes(texts(moves), '턱걸이', '턱걸이');
    /* 깊이에 대한 기준이 문장으로 남아 있어야 한다 */
    includes(w.steps[2].how, '깊이', '깊이 기준');
  });

  /* =========================================================
   * 3) 코어 · 허리 보강 3종 — 세트·횟수까지
   * ========================================================= */
  test('v1.23 코어: 행잉 레그 레이즈 20회 × 3세트 · 다리 걸고 윗몸 20회 × 3세트 · 백 익스텐션 15회 × 3세트', function () {
    var core = AI.offcourtRoutine('복식').core;
    eq(core.items.length, 3, '3종');
    eq(core.items[0].name, '행잉 레그 레이즈', '1) 행잉 레그 레이즈');
    eq(core.items[0].sets, '20회 × 3세트', '1) 20회 × 3세트');
    includes(core.items[0].how, '철봉', '1) 철봉/바');
    includes(core.items[1].name, '다리 걸고', '2) 다리 걸고');
    includes(core.items[1].name, '윗몸', '2) 윗몸/복근 올리기');
    eq(core.items[1].sets, '20회 × 3세트', '2) 20회 × 3세트');
    includes(core.items[1].how, '디클라인', '2) 디클라인');
    eq(core.items[2].name, '백 익스텐션', '3) 백 익스텐션');
    eq(core.items[2].sets, '15회 × 3세트', '3) 15회 × 3세트');
    includes(core.items[2].how, '허리', '3) 허리만 들었다 내리기');
    includes(core.when, '웨이트', '언제 하는지');
  });

  /* =========================================================
   * 4) 무릎 충격 줄인 지구력
   * ========================================================= */
  test('v1.23 지구력: 무릎 충격을 줄이는 실내 자전거 40분 빠르게', function () {
    var e = AI.offcourtRoutine('복식').endurance;
    eq(e.min, 40, '40분');
    includes(e.how, '실내 자전거 40분', '자전거 40분');
    includes(e.how, '빠르게', '빠르게');
    includes(e.how, '무릎', '무릎 충격');
    includes(e.when, '코트', '코트·웨이트 없는 날');
  });

  test('v1.23 오프코트: 같은 입력이면 같은 결과이고, 돌려준 값을 고쳐도 원본이 바뀌지 않는다', function () {
    var a = AI.offcourtRoutine('단식');
    var b = AI.offcourtRoutine('단식');
    eq(JSON.stringify(a), JSON.stringify(b), '결정적');
    a.days[1].steps[2].moves.push('가짜 운동');
    a.core.items[0].sets = '1회';
    eq(AI.offcourtRoutine('단식').days[1].steps[2].moves.length, 5, '원본 moves 유지');
    eq(AI.OFFCOURT.core.items[0].sets, '20회 × 3세트', '원본 세트 유지');
    /* 종목별 안내 문구 */
    includes(AI.offcourtRoutine('단식').disciplineNote, '하체', '단식은 하체 비중');
    includes(AI.offcourtRoutine('복식').disciplineNote, '폼롤러', '복식은 회복');
    /* 실명은 쓰지 않는다 */
    excludes(JSON.stringify(AI.offcourtRoutine('단식')), '안세영', '실명 없음');
    includes(AI.offcourtRoutine('단식').source, '체전 1등 선수', '일반화된 출처');
  });

  /* =========================================================
   * 5) 자기 강도 조절
   * ========================================================= */
  test('v1.23 강도 조절: 컨디션 2 이하면 오늘은 한 단계 낮추라고 말한다', function () {
    var p = AI.paceGuide(2, { zone: '', ratio: 0, change: 0 }, [], 0, null);
    eq(p.level, 'brake', '브레이크');
    includes(p.text, '무리해서 끝까지 밀어붙이면 자세가 깨져 다칠 수 있으니', '문구');
    includes(p.text, '선수 스스로 강도를 한 단계 낮춰', '자기 조절');
    includes(p.text, '폼과 회복', '폼·회복');
    includes(p.rule, '결국 선수 본인이 조절', '원칙');
    includes(p.reasons.join(' '), '컨디션 2', '이유');
    /* 컨디션 3~4는 '자세가 무너지면 멈춰라' 단계 */
    eq(AI.paceGuide(4, { zone: '', ratio: 0, change: 0 }, [], 0, null).level, 'caution', '주의');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, [], 2, 6).level, 'keep', '계획대로');
    /* 같은 입력 → 같은 결과 */
    eq(JSON.stringify(AI.paceGuide(2, { zone: '', ratio: 0, change: 0 }, [], 0, null)),
      JSON.stringify(AI.paceGuide(2, { zone: '', ratio: 0, change: 0 }, [], 0, null)), '결정적');
  });

  test('v1.23 강도 조절: 부하 급증 · 통증 + 고강도 · 연속 훈련도 브레이크', function () {
    includes(AI.paceGuide(7, { zone: 'spike', ratio: 1.8, change: 10 }, [], 0, 6).reasons.join(' '), '급증', '부하 급증');
    eq(AI.paceGuide(7, { zone: 'spike', ratio: 1.8, change: 10 }, [], 0, 6).level, 'brake', '급증 → 브레이크');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 30 }, [], 0, 6).level, 'brake', '지난주 30% 증가 → 브레이크');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, ['무릎'], 0, 9).level, 'brake', '통증 + 강도 9 → 브레이크');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, ['무릎'], 0, 6).level, 'caution', '통증만 있으면 주의');
    eq(AI.paceGuide(7, { zone: 'ok', ratio: 1.1, change: 0 }, [], 5, 8).level, 'brake', '5일 연속 + 고강도 → 브레이크');
    /* 브레이크 문구는 카드·점검·부하 조언에서 같은 문장으로 나온다 */
    eq(AI.paceGuide(2, { zone: '', ratio: 0, change: 0 }, [], 0, null).text, AI.SELF_PACE.brake, '한 문장');
  });

  /* =========================================================
   * 6) analyze() 통합
   * ========================================================= */
  test('v1.23 analyze: 컨디션 2면 진단 맨 앞 · 점검 · 마음 처방에 강도 조절이 온다', function () {
    var an = AI.analyze({
      draft: { cond: 2, intensity: 9, minutes: 70, weakness: ['풋워크'], discipline: '단식' },
      records: [], level: 'B조', nick: '나'
    });
    eq(an.pace.level, 'brake', '브레이크');
    includes(an.insights[0].label, '강도 조절', '진단 맨 앞');
    includes(an.insights[0].detail, '한 단계 낮춰', '진단 문구');
    ok(an.risk.some(function (r) { return r.level === 'warn' && r.text.indexOf('한 단계 낮춰') >= 0; }), '점검에 경고');
    includes(an.care.mental[0], '결국 선수 본인이 조절', '마음 처방 맨 앞');
    ok(an.offcourt && an.offcourt.days.length === 2, '오프코트 루틴이 함께 온다');
  });

  test('v1.23 analyze: 주간 부하가 급증한 주는 부하 조언 맨 앞에 브레이크 문구', function () {
    var history = [8, 11, 15, 19, 22, 26].map(function (d) {
      return rec(d, { minutes: 60, intensity: 5 });
    }).concat([
      rec(1, { minutes: 120, intensity: 8 }),
      rec(2, { minutes: 120, intensity: 8 }),
      rec(4, { minutes: 110, intensity: 8 })
    ]);
    var an = AI.analyze({ draft: { cond: 7, intensity: 8, minutes: 120 }, records: history, level: 'B조' });
    eq(an.load.zone, 'spike', '급증');
    eq(an.pace.level, 'brake', '브레이크');
    includes(an.load.tips[0], '한 단계 낮춰', '부하 조언 맨 앞');
    includes(an.load.tips.join(' '), '10%', '기존 10% 조언도 남는다');
    ok(an.load.tips.length <= 2, '조언은 두 줄까지');
  });

  test('v1.23 analyze: 컨디션이 좋은 날은 브레이크 없이 계획대로', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 60 }, records: [], level: 'C조' });
    eq(an.pace.level, 'keep', '계획대로');
    eq(an.risk.length, 1, '점검은 한 줄');
    eq(an.risk[0].level, 'ok', '무리한 신호 없음');
    excludes(texts(an.insights.map(function (i) { return i.label; })), '강도 조절', '진단에 브레이크 없음');
    excludes(JSON.stringify(an), 'null', 'null 없음');
  });

  /* =========================================================
   * 7) 카드
   * ========================================================= */
  test('v1.23 카드: 접힌 오프코트 루틴 블록 하나 (코트 날 · 웨이트 날 · 코어 3종 · 자전거 40분)', function () {
    var an = AI.analyze({ draft: { cond: 6, discipline: '단식' }, records: [], level: 'C조' });
    var html = BM.views.log.analysisCard(an, { ui: {} });
    includes(html, 'data-fold="offcourt"', '접기 블록');
    eq(html.split('data-fold="offcourt"').length - 1, 1, '블록은 하나만');
    excludes(html, 'data-fold="offcourt" open', '기본은 접힘');
    includes(html, '실전 선수 오프코트 루틴', '제목');
    includes(html, '밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭', '코트 날 순서');
    includes(html, '가벼운 실내 자전거 20분 → 스트레칭 → 본 웨이트 → 마무리 폼롤러 30분', '웨이트 날 순서');
    includes(html, '불가리안 스플릿 스쿼트', '불가리안');
    includes(html, '마무리 폼롤러 30분', '폼롤러 30분');
    includes(html, '행잉 레그 레이즈', '코어 1');
    includes(html, '다리 걸고', '코어 2');
    includes(html, '백 익스텐션', '코어 3');
    includes(html, '20회 × 3세트', '코어 20회');
    includes(html, '15회 × 3세트', '백 익스텐션 15회');
    includes(html, '실내 자전거 40분', '지구력 40분');
    /* 기존 블록은 그대로 */
    includes(html, 'data-fold="prevent"', '예방 워밍업 블록 유지');
    includes(html, '추천 드릴', '드릴 유지');
    /* 카드에는 실명을 쓰지 않는다 */
    excludes(html, '안세영', '실명 없음');
    excludes(html, '서승재', '실명 없음');
    excludes(html, '김원호', '실명 없음');
  });

  /* =========================================================
   * 8) 버전
   * ========================================================= */
  test('v1.23 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.47.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.47.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261122-59', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.47.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.47.0', 'TWA appVersion');
    eq(twa.appVersionCode, 39, 'TWA 버전 코드');
    /* 공개 저장소에 시트 ID·토큰을 남기지 않는다 */
    excludes(readRoot('js/ai.js'), '1sqxAM6eskBYS03s', '시트 ID 없음');
    excludes(readRoot('js/ai.js'), '안세영', '선수 실명 없음');
    excludes(readRoot('js/views/log.js'), '서승재', '선수 실명 없음');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
