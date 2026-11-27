/* ============================================================
 * test/v168.test.js — bm-v1.73.0
 *   🏸 실전 감각연습 + 오후 보강 웨이트 (선수 현장 루틴)
 *
 *  승우 님이 현장에서 하던 하루를 알려 주고 "코칭에 추가해둬"라고 했습니다.
 *    오전 코트 : 몸풀기(양쪽 약 5분) → 2대1 감각연습 30분 → 뒷코트 감각연습 10분
 *    오후 웨이트: 코어·허리 → 하체 → 상체·팔
 *  추가 지시: "이해하기 쉽게" — 줄임말·전문 용어는 쉬운 말과 짧은 설명을 함께 적는다.
 *
 *   1) 감각연습 3블록(5분·30분·10분)과 순서 · 총 시간(약 45~50분)
 *   2) 2대1 = 숏드라이브 10분 → 드라이브 10분 → 드롭 10분
 *   3) 보강 웨이트 3묶음 — 중량 크런치(10kg) 30개 × 5세트 · 백 익스텐션 3방향 10개
 *      · 스쿼트(선수 기준 80kg) 10개 × 3세트 · 종아리 레이즈 10개 × 3세트
 *      · 턱걸이 10개 × 3세트 · 덤벨컬 10kg 10개씩 · 어깨·삼두 10개씩
 *   4) 안전 — 동호인·초보자는 무게·세트를 낮추고, 아프면 그 종목은 오늘 쉰다
 *   5) 쉬운 말 — 처음 보는 사람도 알아듣게 줄임말 옆에 설명을 붙인다
 *   6) 약점(드라이브·드롭·헤어핀·풋워크·스매시)과 한 줄로 연결
 *   7) 일지 & AI 카드에 접힌 블록 하나로 붙고, 기존 블록은 그대로
 *   8) 실존 선수 이름 없음 · 순수 함수 · 버전(bm-v1.73.0)
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

  function sense(discipline, level, weak) { return AI.senseRoutine(discipline || '복식', level || 'A조', weak || []); }

  /* ============================================================
   * 1. 오전 코트 감각연습
   * ============================================================ */

  test('v1.68 감각연습: 오전 코트는 몸풀기 5분 → 2대1 30분 → 뒷코트 10분 (약 45~50분)', function () {
    var s = sense('복식', 'A조');
    eq(s.court.blocks.length, 3, '블록 3개');
    eq(s.court.blocks[0].min, 5, '몸풀기 5분');
    eq(s.court.blocks[1].min, 30, '2대1 30분');
    eq(s.court.blocks[2].min, 10, '뒷코트 10분');
    includes(s.court.total, '45~50', '총 시간');
    includes(s.court.order, '몸풀기 5분', '순서 1');
    includes(s.court.order, '2대1 감각연습 30분', '순서 2');
    includes(s.court.order, '뒷코트 감각연습 10분', '순서 3');
    eq(s.court.blocks[0].sides, '양쪽 약 5분', '양쪽 5분');
    includes(s.court.blocks[0].how, '헤어핀', '헤어핀');
    includes(s.court.blocks[0].how, '드롭', '드롭');
    includes(s.court.blocks[0].how, '스매시', '스매시');
    includes(s.court.blocks[2].name, '뒷코트', '뒷코트');
    includes(s.court.blocks[2].how, '모서리', '뒤쪽 모서리');
  });

  test('v1.68 2대1: 숏드라이브 10분 → 드라이브 10분 → 드롭 10분이고 세트처럼 나눠 보여 준다', function () {
    var b = sense().court.blocks[1];
    eq(b.parts.length, 3, '3개로 나눔');
    eq(b.parts[0].name, '숏드라이브 10분', '숏드라이브');
    eq(b.parts[1].name, '드라이브 10분', '드라이브');
    eq(b.parts[2].name, '드롭 10분', '드롭');
    b.parts.forEach(function (p) {
      ok(p.how.length > 15, p.name + ' 설명이 있다');
    });
    includes(b.how, '두 명이서 한 사람에게', '2대1 풀이');
    includes(b.how, '라켓면', '라켓면');
    includes(b.how, '타점', '타점');
    includes(b.point, '10초', '무너지면 10초 쉬기');
  });

  /* ============================================================
   * 2. 오후 보강 웨이트
   * ============================================================ */

  test('v1.68 웨이트: 코어·허리 → 하체 → 상체·팔 3묶음', function () {
    var w = sense().weight;
    eq(w.groups.length, 3, '3묶음');
    includes(w.order, '코어', '순서 1');
    includes(w.order, '하체', '순서 2');
    includes(w.order, '상체', '순서 3');
    includes(w.groups[0].name, '코어', '코어 묶음');
    includes(w.groups[1].name, '하체', '하체 묶음');
    includes(w.groups[2].name, '상체', '상체 묶음');
  });

  test('v1.68 웨이트 코어: 중량 크런치 10kg 30개 × 5세트 · 백 익스텐션 3방향 10개', function () {
    var items = sense().weight.groups[0].items;
    eq(items.length, 2, '2종');
    eq(items[0].name, '중량 크런치', '크런치');
    eq(items[0].load, '10kg', '10kg');
    eq(items[0].sets, '30개 × 5세트', '30개 × 5세트');
    includes(items[1].name, '백 익스텐션', '백 익스텐션');
    eq(items[1].sets, '1번에 10개', '3방향 1번 10개');
    includes(items[1].how, '가운데·왼쪽·오른쪽', '3방향 설명');
    includes(items[1].how, '1개', '3동작을 1개로');
  });

  test('v1.68 웨이트 하체: 스쿼트(선수 기준 80kg) 10개 × 3세트 · 종아리 레이즈 10개 × 3세트', function () {
    var items = sense().weight.groups[1].items;
    eq(items.length, 2, '2종');
    eq(items[0].name, '스쿼트', '스쿼트');
    eq(items[0].load, '선수 기준 80kg', '80kg');
    eq(items[0].sets, '10개 × 3세트', '10개 × 3세트');
    includes(items[0].how, '동호인·초보자', '무게 조절 설명');
    includes(items[1].name, '종아리 레이즈', '종아리');
    includes(items[1].name, '카프', '카프 레이즈 표기');
    eq(items[1].sets, '10개 × 3세트', '10개 × 3세트');
  });

  test('v1.68 웨이트 상체·팔: 턱걸이 10개 × 3세트 · 덤벨컬 10kg 10개씩 · 어깨·삼두 10개씩', function () {
    var items = sense().weight.groups[2].items;
    eq(items.length, 4, '4종');
    eq(items[0].name, '턱걸이', '턱걸이');
    eq(items[0].sets, '10개 × 3세트', '10개 × 3세트');
    eq(items[1].name, '덤벨컬', '덤벨컬');
    eq(items[1].load, '10kg', '10kg');
    eq(items[1].sets, '10개씩', '10개씩');
    eq(items[2].name, '어깨 보강', '어깨');
    eq(items[2].sets, '10개씩', '어깨 10개씩');
    eq(items[3].name, '삼두 보강', '삼두');
    eq(items[3].sets, '10개씩', '삼두 10개씩');
  });

  /* ============================================================
   * 3. 안전 · 급수별 조절
   * ============================================================ */

  test('v1.68 안전: 중량은 본인 체력에 맞춰 낮추고, 아프면 그 종목은 오늘 쉰다', function () {
    var w = sense().weight;
    includes(w.loadGuide, '80kg', '선수 기준 숫자');
    includes(w.loadGuide, '10kg', '선수 기준 숫자');
    includes(w.loadGuide, '맨몸', '초보는 맨몸부터');
    includes(w.loadGuide, '조절', '조절 안내');
    includes(w.loadGuide, '2~3세트', '세트 줄이기');
    includes(w.stop, '아프면', '통증 기준');
    includes(w.stop, AI.PAIN_RULE.stop, '기존 통증 중단 기준과 같은 문장');
  });

  test('v1.68 급수: 초심은 2대1 20분·웨이트 2세트, 선수부는 위 볼륨 그대로', function () {
    var easy = sense('복식', '초심');
    includes(easy.levelNote, '20분', '초심은 2대1을 20분으로');
    includes(easy.levelNote, '맨몸', '초심은 맨몸');
    includes(easy.levelNote, '2세트', '초심은 2세트');
    var mid = sense('복식', 'C조');
    includes(mid.levelNote, '동호인', '동호인 안내');
    includes(mid.levelNote, '2~3세트', '동호인 세트');
    var pro = sense('단식', '선수부');
    includes(pro.levelNote, '그대로', '선수부는 그대로');
    ok(easy.levelNote !== pro.levelNote, '급수에 따라 다르다');
  });

  test('v1.68 종목: 복식·단식·혼합복식에 맞춰 한 줄이 달라진다', function () {
    includes(sense('단식').disciplineNote, '뒷코트', '단식은 뒷코트');
    includes(sense('복식').disciplineNote, '2대1', '복식은 2대1');
    includes(sense('혼합복식').disciplineNote, '전위', '혼합복식은 전위');
    eq(sense('단식').discipline, '단식', '종목 이름');
  });

  /* ============================================================
   * 4. 쉬운 말 (승우 님 "이해하기 쉽게")
   * ============================================================ */

  test('v1.68 쉬운 말: 줄임말·전문 용어 옆에 처음 보는 사람도 알 설명이 붙는다', function () {
    var s = sense();
    includes(s.court.blocks[0].how, '거리감', '몸풀기 풀이');
    includes(s.court.blocks[0].point, '손끝 감각', '손끝 감각');
    includes(s.court.blocks[2].how, '뒷사각', '뒷사각');
    includes(s.court.blocks[2].how, '왼쪽·오른쪽', '뒷사각 위치 풀이');
    includes(s.court.blocks[2].point, '발이 먼저', '핵심 한 줄');
    includes(s.weight.groups[0].name, '몸통', '코어 풀이');
    includes(s.weight.groups[1].name, '다리', '하체 풀이');
    includes(s.weight.groups[2].name, '스매시', '상체·팔 풀이');
    includes(s.weight.groups[0].items[0].how, '배에', '크런치 방법 풀이');
    includes(s.note, '순서대로', '하루 순서 안내');
    /* 각 블록의 설명은 한 줄로 끝나지 않는다 — 쉬운 말로 풀어 쓴다 */
    s.court.blocks.forEach(function (b) {
      ok(b.how.length >= 40, b.name + ' 설명 길이');
      ok(b.point.length >= 15, b.name + ' 포인트 길이');
    });
  });

  /* ============================================================
   * 5. 약점 연결 · 순수 함수
   * ============================================================ */

  test('v1.68 약점 연결: 드라이브·드롭·헤어핀·풋워크·스매시면 그 블록을 한 번 더', function () {
    includes(AI.senseFocus(['드라이브']).text, '드라이브 10분', '드라이브');
    includes(AI.senseFocus(['드롭']).text, '드롭 10분', '드롭');
    includes(AI.senseFocus(['헤어핀']).text, '헤어핀', '헤어핀');
    includes(AI.senseFocus(['풋워크']).text, '뒷코트', '풋워크');
    includes(AI.senseFocus(['스매시']).text, '최고점', '스매시 타점');
    eq(AI.senseFocus([]), null, '약점이 없으면 한 줄도 없다');
    eq(AI.senseFocus(['클리어']), null, '관계없는 약점은 그대로');
    var an = AI.analyze({ draft: { cond: 6, discipline: '복식', weakness: ['드라이브'] }, records: [], level: 'A조', nick: '나' });
    ok(an.sense, 'analyze에 감각연습이 함께 온다');
    includes(an.sense.focus.text, '드라이브 10분', '분석 카드에 약점 연결');
    eq(an.sense.focus.skill, '드라이브', '약점 이름');
  });

  test('v1.68 순수 함수: 돌려준 값을 고쳐도 원본(SENSE)이 바뀌지 않는다', function () {
    var a = sense();
    a.court.blocks[0].name = '바뀜';
    a.court.blocks[1].parts[0].name = '바뀜';
    a.weight.groups[0].items[0].sets = '바뀜';
    eq(AI.SENSE.court.blocks[0].name, '몸풀기 — 손끝 감각 깨우기', '원본 이름 유지');
    eq(AI.SENSE.court.blocks[1].parts[0].name, '숏드라이브 10분', '원본 parts 유지');
    eq(AI.SENSE.weight.groups[0].items[0].sets, '30개 × 5세트', '원본 세트 유지');
    var b = sense();
    eq(b.court.blocks[0].name, '몸풀기 — 손끝 감각 깨우기', '새 호출은 새 객체');
    eq(b.weight.groups[0].items[0].sets, '30개 × 5세트', '새 호출 세트');
    includes(b.summary, '감각연습 3블록', '요약');
  });

  /* ============================================================
   * 6. 일지 & AI 카드
   * ============================================================ */

  test('v1.68 카드: 접힌 감각연습 블록 하나 — 오전 코트 · 오후 웨이트 · 무게 안내 · 안전', function () {
    var an = AI.analyze({ draft: { cond: 6, discipline: '복식' }, records: [], level: 'A조', nick: '나' });
    var html = BM.views.log.analysisCard(an, { ui: {} });
    includes(html, 'data-fold="sense"', '접기 블록');
    eq(html.split('data-fold="sense"').length - 1, 1, '블록은 하나만');
    excludes(html, 'data-fold="sense" open', '기본은 접힘');
    includes(html, '실전 감각연습 + 오후 보강 웨이트', '제목');
    includes(html, '약 45~50분', '총 시간');
    includes(html, '몸풀기 5분 → 2대1 감각연습 30분 → 뒷코트 감각연습 10분', '오전 순서');
    includes(html, '두 명이서 한 사람에게', '2대1 풀이');
    includes(html, '숏드라이브 10분', '숏드라이브');
    includes(html, '뒷코트(뒷사각)', '뒷사각');
    includes(html, '중량 크런치', '크런치');
    includes(html, '30개 × 5세트', '크런치 세트');
    includes(html, '선수 기준 80kg', '스쿼트 중량');
    includes(html, '덤벨컬', '덤벨컬');
    includes(html, '무게 안내 ·', '무게 안내 줄');
    includes(html, '안전 ·', '안전 줄');
    includes(html, '동호인·초보자는 맨몸', '무게 낮추기');
    /* 기존 블록은 그대로 (보호) */
    includes(html, 'data-fold="offcourt"', '오프코트 유지');
    includes(html, 'data-fold="week"', '이번 주 루틴 유지');
    includes(html, '추천 드릴', '드릴 유지');
    includes(html, '체전 1등 선수', '일반화된 출처');
  });

  test('v1.68 카드: 감각연습이 없으면 블록도 그리지 않고, 글자는 HTML로 실행되지 않는다', function () {
    var bare = AI.analyze({ draft: { cond: 6 }, records: [], level: 'C조' });
    bare.sense = null;
    excludes(BM.views.log.analysisCard(bare, { ui: {} }), 'data-fold="sense"', '없으면 안 그린다');
    var an = AI.analyze({ draft: { cond: 6 }, records: [], level: 'A조' });
    an.sense.court.blocks[0].name = '<img src=x onerror=alert(1)>';
    var html = BM.views.log.analysisCard(an, { ui: {} });
    excludes(html, '<img src=x', '태그가 그대로 들어가지 않는다');
    includes(html, '&lt;img src=x', '글자로만 보인다');
  });

  /* ============================================================
   * 7. 실명 금지 · 버전 · 배선
   * ============================================================ */

  test('v1.68 실명: 코드·카드 어디에도 실존 선수 이름이 없다', function () {
    var an = AI.analyze({ draft: { cond: 6, discipline: '복식' }, records: [], level: '선수부' });
    var html = BM.views.log.analysisCard(an, { ui: {} });
    var blob = html + JSON.stringify(an.sense) + (hasNode ? (readRoot('js/ai.js') + readRoot('js/views/log.js')) : '');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
    includes(html, '체전 1등 선수', '일반화된 표현만');
  });

  test('v1.68 버전: sw · app · 스타일 캐시 · TWA · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.89.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.89.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261127-3', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.89.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.89.0', 'TWA appVersion');
    eq(twa.appVersionCode, 83, 'TWA 버전 코드');
    includes(readRoot('test/run.js'), 'test/v168.test.js', '테스트 목록 배선');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
