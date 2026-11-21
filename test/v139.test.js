/* ============================================================
 * test/v139.test.js — bm-v1.39.0 (2026-11-21 16시 AI 고도화)
 *
 *  1) 팔꿈치·손목 과사용(라켓 엘보) 보호 체크
 *     · 근거: Senadheera et al., Am J Sports Sci Med 7(1):16-19, 2019
 *             Yoon et al., J Clin Med 10(17):3968, 2021
 *             Wen et al., Sports Health 3(6):500-503, 2011
 *     · 통증(팔꿈치·손목)이 있거나, 머리 위 샷(스매시·클리어)을 약점으로 고른
 *       길거나 센 날에만 켜집니다. 화면 문구는 쉬운 코트 말투(영어 약어·통계 기호 없음).
 *
 *  2) 접전(3점차 이내) 성적 · 8~14점 리드 목표
 *     · 근거: Barreira, Chiminazzo & Fernandes, Int J Perform Anal Sport 16(2):687-694, 2016
 *       (2015 세계선수권 남자단식 136게임 — 0~7·8~14·15~21점 구간)
 *
 *  실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var eq = BM.test.eq, ok = BM.test.ok, includes = BM.test.includes, excludes = BM.test.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function ai(draft, extra) {
    var input = { draft: draft, records: [], level: 'B조' };
    Object.keys(extra || {}).forEach(function (k) { input[k] = extra[k]; });
    return BM.ai.analyze(input);
  }

  function text(o) {
    return JSON.stringify(o);
  }

  /* 분석 카드를 그리는 데 필요한 최소 상태 (v127·release.test.js와 같은 모양) */
  function logState(an, draft) {
    var rows = BM.fixtures.demo();
    var key = 'u_test_me';
    var me = { key: key, nick: '나래', level: 'A조', discipline: '복식', theme: { theme: 'th_def' } };
    return {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, key),
      drafts: { log: draft || { date: BM.util.ymd(), cond: 6, intensity: 7, minutes: 80, done: [], pain: ['팔꿈치'], weakness: ['스매시'] } },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: an, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1. 팔꿈치·손목 보호 체크 — 켜지고 꺼지는 조건
   * ========================================================= */
  BM.test.test('v1.39 팔꿈치: 통증을 남긴 날은 보호 체크가 켜진다', function () {
    var an = ai({ cond: 6, intensity: 7, minutes: 80, pain: ['팔꿈치'], weakness: ['스매시'] });
    ok(an.guard.arm, '팔꿈치·손목 블록');
    eq(an.guard.arm.on, true, '켜짐');
    eq(an.guard.arm.level, 'pain', '통증 단계');
    includes(an.guard.arm.reason, '팔꿈치', '이유에 통증 부위');
    includes(an.guard.area || an.guard.areas.join(' '), '팔꿈치·손목', '켜진 부위 목록');
  });

  BM.test.test('v1.39 손목: 손목 통증도 같은 블록으로 관리한다', function () {
    var an = ai({ cond: 6, intensity: 6, minutes: 60, pain: ['손목'], weakness: ['헤어핀'] });
    eq(an.guard.arm.on, true, '켜짐');
    eq(an.guard.arm.pain.join(','), '손목', '통증 부위 기록');
    includes(an.guard.arm.reason, '손목', '이유');
    includes(joinAll(an.guard.arm.thresholds), '새끼손가락', '손목 신호 안내');
  });

  BM.test.test('v1.39 머리 위 샷을 몰아 치는 센 날은 부담 단계로 켜진다', function () {
    var an = ai({ cond: 6, intensity: 9, minutes: 100, weakness: ['스매시'] });
    eq(an.guard.arm.on, true, '예방으로 켜짐');
    eq(an.guard.arm.level, 'load', '통증 없음 → 부담 단계');
    includes(an.guard.arm.reason, '머리 위', '이유');
    excludes(an.guard.arm.reason, '통증 부위로', '통증 문구는 없음');
  });

  BM.test.test('v1.39 조용한 날: 통증도 없고 머리 위 샷도 아니면 꺼진다', function () {
    var an = ai({ cond: 7, intensity: 5, minutes: 40, weakness: ['드라이브'] });
    eq(an.guard.arm.on, false, '꺼짐');
    var heavy = ai({ cond: 6, intensity: 9, minutes: 120, weakness: ['풋워크'] });
    eq(heavy.guard.arm.on, false, '센 날이어도 머리 위 샷이 아니면 꺼짐');
  });

  BM.test.test('v1.39 요약: 세 곳이 켜지면 첫 부위만 남기고 줄인다', function () {
    var g = BM.ai.jointGuard(['어깨', '팔꿈치'], ['스매시', '풋워크'], { intensity: 9, minutes: 100 });
    eq(g.areas.join(' / '), '어깨 / 무릎·발목 / 팔꿈치·손목', '세 부위');
    eq(g.label, '어깨 외 2곳', '긴 줄임표');
    var two = BM.ai.jointGuard(['팔꿈치'], ['드라이브'], { intensity: 5, minutes: 50 });
    eq(two.label, '팔꿈치·손목', '한 부위는 그대로');
  });

  BM.test.test('v1.39 수치: 논문 값은 내부(stats)에만 남는다', function () {
    var arm = BM.ai.ARM_RISK;
    eq(arm.tendinopathyPct, 28, '팔꿈치·손목·손 통증 경험 28%');
    eq(arm.metaN, 429, '메타분석 인원');
    eq(arm.eccentricWeeks, 4, '꾸준히 4주 이상');
    eq(BM.ai.GUARD_ARM_STATS || BM.ai.ARM_RISK.tendinopathyPct, 28, '내보낸 상수');
  });

  BM.test.test('v1.39 말투: 화면 문구에 영어 약어·통계 기호가 없다', function () {
    var an = ai({ cond: 5, intensity: 8, minutes: 90, pain: ['팔꿈치', '손목'], weakness: ['스매시'] });
    var body = text({
      reason: an.guard.arm.reason,
      thresholds: an.guard.arm.thresholds,
      checks: an.guard.arm.checks,
      guides: an.guard.arm.guides
    });
    ['GIRD', 'FR240', 'SMD', 'p <', 'RCT', 'DOI', 'http'].forEach(function (bad) {
      excludes(body, bad, '어려운 표기 없음: ' + bad);
    });
    includes(body, '라켓 엘보', '쉬운 말');
    includes(body, '15회 × 3세트', '횟수로 안내');
  });

  /* =========================================================
   * 2. 접전 성적 · 구간 목표
   * ========================================================= */
  BM.test.test('v1.39 접전: 3점차 이내 경기의 승패를 따로 센다', function () {
    var an = ai({
      cond: 6, intensity: 7, minutes: 90, gameMode: 21, discipline: '단식',
      games: [{ a: 21, b: 19 }, { a: 21, b: 9 }, { a: 19, b: 21 }]
    });
    eq(an.flow.count, 3, '경기 수');
    eq(an.flow.clutch.games, 2, '접전 경기');
    eq(an.flow.clutch.wins, 1, '접전 승');
    eq(an.flow.clutch.losses, 1, '접전 패');
    eq(an.flow.clutch.rate, 50, '접전 승률');
  });

  BM.test.test('v1.39 접전: 전부 접전이면 진단을 겹쳐 쓰지 않는다', function () {
    var all = ai({ cond: 6, intensity: 7, minutes: 90, games: [{ a: 21, b: 19 }, { a: 19, b: 21 }] });
    var labels = all.insights.map(function (i) { return i.label; }).join(' | ');
    excludes(labels, '접전', '모든 경기가 접전이면 따로 말하지 않음');
    var mixed = ai({ cond: 6, intensity: 7, minutes: 90, games: [{ a: 21, b: 19 }, { a: 19, b: 21 }, { a: 21, b: 6 }] });
    includes(mixed.insights.map(function (i) { return i.label; }).join(' | '), '접전 2경기 1승 1패', '섞인 날은 접전 성적');
  });

  BM.test.test('v1.39 접전: 아쉽게 놓친 날은 중반 리드 목표를 준다', function () {
    var an = ai({
      cond: 6, intensity: 7, minutes: 90, discipline: '단식',
      games: [{ a: 19, b: 21 }, { a: 20, b: 22 }, { a: 21, b: 12 }]
    });
    var d = an.insights.filter(function (i) { return i.label.indexOf('접전') === 0; })[0];
    ok(d, '접전 진단');
    includes(d.detail, '8~14점', '구간');
    includes(d.detail, '3점 이상', '목표 리드');
    excludes(d.detail, 'p<', '통계 기호 없음');
  });

  BM.test.test('v1.39 경기 흐름: 문구에 접전 전적과 중반 리드가 들어간다', function () {
    var an = ai({
      cond: 6, intensity: 7, minutes: 90, gameMode: 21, discipline: '복식',
      games: [{ a: 21, b: 19 }, { a: 22, b: 20 }, { a: 18, b: 21 }]
    });
    var tips = an.flow.tips.join(' ');
    includes(tips, '마지막 2~3점', '기존 후반 운영 문구 유지');
    includes(tips, '8~14점', '중반 구간');
    includes(tips, '3점 이상', '리드 목표');
    includes(tips, '3점차 이내 3경기 중 2승 1패', '접전 전적');
    ok(an.flow.tips.length <= 3, '문구는 3개까지');
    var html = BM.views.log.render(logState(an));
    includes(html, '접전(3점차 이내)', '화면 한 줄 요약');
  });

  BM.test.test('v1.39 경기 흐름: 경기가 없으면 접전 값이 비어 있고 null이 없다', function () {
    var an = ai({ cond: 6, intensity: 6, minutes: 60 });
    eq(an.flow.clutch.games, 0, '경기 없음');
    eq(typeof an.flow.clutch.rate, 'undefined', '승률 없음');
    excludes(text(an), 'null', 'null 없음');
    excludes(text(an), 'undefined', 'undefined 없음');
  });

  BM.test.test('v1.39 근거 상수: 구간·기준값이 논문과 맞는다', function () {
    var g = BM.ai.GAME_PHASE;
    eq(g.phases[0].join('-'), '0-7', '1구간');
    eq(g.phases[1].join('-'), '8-14', '2구간');
    eq(g.phases[2].join('-'), '15-21', '3구간');
    eq(g.noLeadFirstLossPct, 78, '1구간 리드 없음 → 패배 78%');
    eq(g.targetLead, 3, '중반 목표 리드');
    includes(g.source, 'Barreira', '출처');
    eq(BM.ai.ARM_RISK.lateralSharePct, 45.9, '바깥쪽 팔꿈치 비중');
  });

  /* =========================================================
   * 3. 화면 — 기존 접기 안에 세 번째 블록으로
   * ========================================================= */
  BM.test.test('v1.39 화면: 관절 보호 체크 안에 팔꿈치·손목 블록이 붙는다', function () {
    var an = ai({ cond: 6, intensity: 7, minutes: 80, pain: ['팔꿈치'], weakness: ['스매시'] });
    var html = BM.views.log.render(logState(an));
    includes(html, 'data-fold="guard"', '관절 보호 접기');
    includes(html, '팔꿈치·손목 보호 체크', '블록 제목');
    includes(html, '라켓 엘보', '쉬운 이름');
    includes(html, '손목 천천히 내리기', '천천히 내리기 안내');
    includes(html, '그립은 10에 3 힘으로', '그립 안내');
    includes(html, 'Senadheera 2019', '출처 한 줄');
    excludes(html, '<script', '스크립트 없음');
    eq(html.split('data-fold="guard"').length - 1, 1, '접기는 하나');
  });

  BM.test.test('v1.39 화면: 꺼진 날은 팔꿈치 블록을 만들지 않는다', function () {
    var an = ai({ cond: 7, intensity: 5, minutes: 40, weakness: ['드라이브'] });
    var html = BM.views.log.render(logState(an));
    excludes(html, '팔꿈치·손목 보호 체크', '블록 없음');
  });

  BM.test.test('v1.39 화면: 몸이 아픈 날은 관리 접기에 천천히 내리기가 함께 나온다', function () {
    var an = ai({ cond: 5, intensity: 6, minutes: 60, pain: ['팔꿈치'], weakness: ['드라이브'] });
    includes(an.care.rehab.join(' '), '천천히 내리기', '맞춤 처방에 같은 운동');
    var html = BM.views.log.render(logState(an));
    includes(html, '천천히 내리기', '화면 처방');
  });

  /* =========================================================
   * 4. 회귀 — 기존 기능은 그대로
   * ========================================================= */
  BM.test.test('v1.39 회귀: 시트 호환 JSON·기존 블록·기본 드릴이 그대로', function () {
    var an = ai({ cond: 6, intensity: 9, minutes: 110, pain: ['어깨', '팔꿈치'], weakness: ['스매시', '풋워크'] });
    var patch = JSON.parse(an.sheetPatch['맞춤처방']);
    ok(patch.rehab && patch.stretch && patch.mental && patch.warmup, '맞춤처방 26칸 JSON');
    ok(JSON.parse(an.sheetPatch['추천드릴']).drills.length === 3, '추천드릴 3개');
    eq(an.guard.shoulder.on, true, '어깨 블록 유지');
    eq(an.guard.lower.on, true, '무릎·발목 블록 유지');
    eq(an.drills.drills.length, 3, '드릴 수 유지');
    eq(an.week.length >= 3, true, '이번 주 루틴 유지');
  });

  BM.test.test('v1.39 버전: sw · app · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.39.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.39.0'", 'app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.39.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.39.0', 'TWA appVersion');
    eq(twa.appVersionCode, 38, 'TWA 버전 코드(웹만 바뀌면 그대로)');
  });

  BM.test.test('v1.39 문서: README에 이번 근거와 화면 문구 방침이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md');
    includes(readme, 'v1.39.0', '버전 절');
    includes(readme, 'Senadheera', '팔꿈치·손목 출처');
    includes(readme, 'Barreira', '접전·구간 출처');
    includes(readme, '8~14점', '코트 목표 문구');
  });

  function joinAll(list) {
    return (list || []).map(function (x) { return typeof x === 'string' ? x : JSON.stringify(x); }).join(' ');
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
