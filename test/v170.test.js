/* ============================================================
 * test/v170.test.js — bm-v1.73.0
 *   🏸 실전 시합 웜업 · 복식 수비 전환 · 수비 타이밍 코칭
 *
 *  체전 1등 선수의 2026-11-24 19시 인터뷰에서 알려 준 실전 노하우 세 가지를
 *  쉬운 코트 말로 옮겼습니다(실명은 쓰지 않고 '체전 1등 선수 현장 기준'으로만 부릅니다).
 *    ① 시합 직전 기본 워밍업 — "조깅하고 스트레칭하고 시합 뛰고"
 *    ② 복식 수비 → 공격 전환 — "공을 세게한번쳐서 밀리게 하고 틀거나 놔"
 *    ③ 수비 타이밍 — 예측한 공은 앞에서 짧게, 예측 못 한 공은 뒤로 당겨 여유롭게
 *
 *   1) 시합 당일 준비 3단계(조깅 → 스트레칭 → 코트)가 순서대로 담긴다
 *   2) 수비 → 공격 전환은 '세게 한 번 밀기 → 코스 틀기·짧게 놓기' 순서를 지킨다
 *   3) 수비 타이밍은 예측/예측 못 함 두 가지로 나뉘고 수비 드릴·전술에도 붙는다
 *   4) 화면에 통계 기호·전문 약어가 없고, 글자는 HTML로 실행되지 않는다
 *   5) 기존 블록(추천 드릴·감각연습·관절 보호·맞춤 처방)은 그대로
 *   6) 실존 선수 이름 없음 · 버전(bm-v1.73.0)
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

  function analyze(draft, records) {
    return AI.analyze({
      draft: draft, records: records || [], level: 'A조', discipline: '복식', nick: '나'
    });
  }

  function cardHtml(an) {
    return BM.views.log.analysisCard(an, { ui: {} });
  }

  function joinSteps(block) {
    return (block || []).map(function (s) { return s.name + ' ' + s.how; }).join(' ');
  }

  /* 사용자가 보는 문구에 나오면 안 되는 것들 (bm-v1.28 기준 유지) */
  var HARD = ['OR ', 'p <', 'GIRD', 'ACWR', 'RPE', 'IRR', 'ρ', 'Spearman', '모멘트',
    '구심성', '원심성', '내회전', '외회전', '생체역학'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* ============================================================
   * 1. 시합 직전 워밍업 — 조깅 → 스트레칭 → 시합
   * ============================================================ */

  test('v1.70 시합 준비: 조깅 → 스트레칭 → 코트 시합 3단계가 적힌다', function () {
    var m = AI.matchDay('복식');
    eq(m.steps.length, 3, '3단계');
    eq(m.steps[0].name, '가볍게 조깅', '1단계 이름');
    eq(m.steps[1].name, '스트레칭으로 관절 풀기', '2단계 이름');
    eq(m.steps[2].name, '코트에서 시합', '3단계 이름');
    includes(m.order, '가볍게 조깅', '순서 줄 — 조깅');
    includes(m.order, '스트레칭', '순서 줄 — 스트레칭');
    includes(m.order, '코트에서 시합', '순서 줄 — 시합');
    includes(m.steps[0].how, '몸이 따뜻해질 때까지', '조깅은 몸을 데우는 단계');
    includes(m.steps[1].how, '관절을 풀어', '스트레칭은 관절을 푸는 단계');
    includes(m.steps[2].how, '실제 경기처럼', '코트에서 시합');
    ok(m.steps[0].min > 0 && m.steps[1].min > 0, '조깅·스트레칭 시간 안내');
  });

  test('v1.70 시합 준비: 평소 웜업 목록은 그대로 있고 이 블록은 따로 더해진다', function () {
    ok(AI.WARMUP.length >= 5, '기존 웜업 목록 그대로');
    includes(AI.WARMUP[0], '가벼운 조깅', '기존 첫 항목 유지');
    includes(AI.WARMUP.join(' '), '셔틀 랠리', '기존 네트 예열 유지');
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['드라이브'] });
    ok(an.match && an.match.steps.length === 3, '분석 결과에 시합 준비');
    ok(an.care.warmup.length >= 4, '맞춤 처방 웜업도 그대로');
  });

  /* ============================================================
   * 2. 복식 수비 → 공격 전환 — 세게 밀고 나서 코스 틀기
   * ============================================================ */

  test('v1.70 복식 전환: 세게 한 번 밀기 → 코스 틀기·짧게 놓기 순서다', function () {
    var sw = AI.matchDay('복식').switchBlock;
    eq(sw.title, '수비에서 공격으로 뒤집기', '블록 제목');
    eq(sw.steps.length, 3, '3단계');
    includes(sw.steps[0].how, '아래로 힘 있게', '1단계 — 세게 치기');
    includes(sw.steps[0].how, '뒤로 물러나야', '1단계 — 상대를 밀어내기');
    includes(sw.steps[1].how, '코스를 틀거나', '2단계 — 코스 틀기');
    includes(sw.steps[1].how, '짧게 놓아', '2단계 — 짧게 놓기');
    includes(sw.steps[2].how, '밀기 전에 방향부터 바꾸면', '3단계 — 순서 지키기');
    includes(sw.steps[2].how, '코스 바꾸기', '3단계 — 바꾸는 시점');
    includes(sw.partner, '전후 전환', '파트너 약속');
  });

  test('v1.70 복식 전환: 전술 노트 첫 줄에도 같은 순서가 들어간다', function () {
    var tips = AI.playbook('복식', 'A조').tips;
    includes(tips[0], '세게 한 번', '전환 전술이 전술 노트에 붙는다');
    includes(tips[0], '뒤로 밀리게', '밀어내기');
    includes(tips[0], '코스를 틀거나 짧게 놓', '코스 변경·짧게 놓기');
    /* 기존 전술(서브·리시브)은 그대로 */ 
    var all = tips.join(' ');
    includes(all, '67~70%', '기존 서브 전술 유지');
    includes(all, '38~46%', '기존 리시브 전술 유지');
    /* 초심은 기본 2개 — 그 안에도 전환이 들어간다 */
    var beg = AI.playbook('복식', '초심');
    eq(beg.tips.length, 2, '초심은 2개');
    includes(beg.tips[0], '세게 한 번', '초심도 전환 전술부터');
  });

  test('v1.70 단식: 전환은 한 줄 안내로 바뀌고 복식 3단계는 붙지 않는다', function () {
    var single = AI.matchDay('단식');
    eq(single.discipline, '단식', '종목');
    eq(single.switchBlock.steps.length, 0, '단식은 3단계 없음');
    includes(single.switchBlock.note, '세게 깊게', '단식 한 줄 안내');
    includes(single.switchBlock.note, '드롭', '단식은 드롭으로 흔들기');
    eq(single.switchBlock.partner, '', '단식에는 파트너 약속 없음');
    /* 혼합복식은 복식처럼 3단계 */
    eq(AI.matchDay('혼합복식').switchBlock.steps.length, 3, '혼합복식 3단계');
  });

  /* ============================================================
   * 3. 수비 타이밍 — 예측한 공 / 예측 못 한 공
   * ============================================================ */

  test('v1.70 수비 타이밍: 예측한 공은 앞에서 짧게, 예측 못 한 공은 뒤로 당겨 여유', function () {
    var df = AI.matchDay('복식').defenseBlock;
    eq(df.title, '수비에서 받는 타이밍', '블록 제목');
    eq(df.steps.length, 2, '두 가지');
    includes(df.steps[0].name, '예측한 공', '1번째 이름');
    includes(df.steps[0].how, '앞에서 짧게', '예측하면 앞에서');
    includes(df.steps[0].how, '압박', '예측하면 압박');
    includes(df.steps[1].name, '예측 못 한 공', '2번째 이름');
    includes(df.steps[1].how, '뒤로 살짝 당겨', '예측 못 하면 당기기');
    includes(df.steps[1].how, '빠르게 느껴져', '앞에서 치면 더 빠르게 느껴진다');
    includes(df.steps[1].how, '여유', '여유를 두고 받기');
    includes(df.note, '받는 자리', '왜 다른지 한 줄');
  });

  test('v1.70 수비 드릴: 첫 수비 드릴이 예측/예측 못 함 타이밍을 가르친다', function () {
    var d = AI.DRILLS['수비'][0];
    eq(d.name, '수비 타이밍 — 예측했을 때 / 아닐 때', '드릴 이름');
    includes(d.method, '예측한 공은 앞에서 짧게', '방법 — 예측');
    includes(d.method, '뒤로 살짝 당겨', '방법 — 당기기');
    includes(d.method, '빠르게 느껴져', '방법 — 왜 실수가 나는지');
    includes(d.point, '예측했으면 앞에서 짧게', '한 줄 코칭 앞부분');
    includes(d.point, '뒤로 당겨 여유롭게', '한 줄 코칭 뒷부분');
    ok(d.sets && String(d.sets['A조'] || '').indexOf('랠리') >= 0, '세트 안내');
    /* 기존 수비 드릴 4개는 그대로 뒤에 있다 */
    var names = AI.DRILLS['수비'].map(function (x) { return x.name; });
    ['좌우 수비 블록', '드라이브 카운터', '수비 → 로테이션', '한 발 수비(리치)'].forEach(function (n) {
      ok(names.indexOf(n) >= 0, '기존 드릴 유지: ' + n);
    });
    /* v1.103에서 '강한 스매시 받아내기 — 낮게, 뒤로 끌어' 드릴 1개가 뒤에 더 붙어 6개 */
    eq(AI.DRILLS['수비'].length, 6, '기존 4개 + 수비 타이밍 + 강한 스매시');
  });

  test('v1.70 수비 전술: 복식 수비 줄에 타이밍 기준이 붙는다', function () {
    var line = AI.TACTICS['복식'].filter(function (x) { return x.indexOf('리프트는 스트레이트') >= 0; })[0];
    ok(line, '기존 수비 전술 줄');
    includes(line, '블록·드라이브로 앞으로 나가', '기존 문구 유지');
    includes(line, '예측한 수비는 앞에서 짧게', '예측 기준');
    includes(line, '뒤로 살짝 당겨', '예측 못 한 공 기준');
  });

  test('v1.70 수비 약점: 오늘 수비가 약점이면 추천 드릴 1번이 수비 타이밍', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['수비'] });
    var names = an.drills.drills.map(function (d) { return d.name; });
    eq(an.drills.drills.length, 3, '드릴 3개');
    includes(names.join(' '), '수비 타이밍', '수비 타이밍이 추천에 들어간다');
    eq(names[0], '수비 타이밍 — 예측했을 때 / 아닐 때', '첫 추천');
  });

  /* ============================================================
   * 4. 쉬운 말 · 순수 함수
   * ============================================================ */

  test('v1.70 쉬운 말: 새 문구에 통계 기호·전문 약어가 없다', function () {
    var m = AI.matchDay('복식');
    banText(JSON.stringify(m), '시합 준비 블록');
    banText(joinSteps(m.steps), '시합 직전 3단계');
    banText(joinSteps(m.switchBlock.steps), '수비 → 공격 전환');
    banText(joinSteps(m.defenseBlock.steps), '수비 타이밍');
    includes(m.steps[1].how, '관절', '관절(쉬운 말)');
    includes(m.defenseBlock.steps[1].how, '편한 자세', '편한 자세(쉬운 말)');
  });

  test('v1.70 순수 함수: 돌려준 값을 고쳐도 원본(MATCH_DAY)이 바뀌지 않는다', function () {
    var a = AI.matchDay('복식');
    a.steps[0].how = '바꿔치기';
    a.switchBlock.steps[0].name = '바꿔치기';
    a.defenseBlock.steps[0].how = '바꿔치기';
    var b = AI.matchDay('복식');
    excludes(b.steps[0].how, '바꿔치기', '원본 보존 — 시합 준비');
    excludes(b.switchBlock.steps[0].name, '바꿔치기', '원본 보존 — 전환');
    excludes(b.defenseBlock.steps[0].how, '바꿔치기', '원본 보존 — 수비 타이밍');
    eq(AI.MATCH_DAY.steps[0].how.indexOf('바꿔치기'), -1, '내부 상수도 그대로');
  });

  /* ============================================================
   * 5. 화면 — 시합 당일 준비 접기 하나
   * ============================================================ */

  test('v1.70 카드: 시합 당일 준비 접기 하나에 세 가지가 모두 보인다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['드라이브'] });
    var html = cardHtml(an);
    includes(html, 'data-fold="match"', '시합 준비 접기');
    eq(html.split('data-fold="match"').length - 1, 1, '접기는 하나만');
    includes(html, '시합 당일 준비', '접기 제목');
    includes(html, '시합 직전 워밍업', '워밍업 소제목');
    includes(html, '가볍게 조깅', '1단계');
    includes(html, '스트레칭으로 관절 풀기', '2단계');
    includes(html, '코트에서 시합', '3단계');
    includes(html, '수비에서 공격으로 뒤집기', '전환 소제목');
    includes(html, '세게 한 번 쳐서 밀어내기', '전환 1단계');
    includes(html, '코스 틀기 · 짧게 놓기', '전환 2단계');
    includes(html, '전후 전환', '파트너 약속');
    includes(html, '수비에서 받는 타이밍', '수비 타이밍 소제목');
    includes(html, '예측한 공', '예측한 공');
    includes(html, '뒤로 살짝 당겨', '예측 못 한 공');
    includes(html, '체전 1등 선수 현장 기준', '출처 줄');
  });

  test('v1.70 카드: 기존 접기·블록은 그대로 있고 실명도 없다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['풋워크'] });
    var html = cardHtml(an);
    ['추천 드릴', 'data-fold="care"', 'data-fold="week"', 'data-fold="sense"',
      'data-fold="offcourt"', 'data-fold="prevent"'].forEach(function (s) {
      includes(html, s, '기존 블록 유지: ' + s);
    });
    var blob = html + JSON.stringify(an.match) +
      (hasNode ? (readRoot('js/ai.js') + readRoot('js/views/log.js')) : '');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
  });

  test('v1.70 카드: 새 문구도 HTML로 실행되지 않고 글자로만 보인다', function () {
    var an = analyze({ cond: 6, discipline: '복식', weakness: ['드라이브'] });
    an.match.steps[0].how = '<img src=x onerror=alert(1)>';
    an.match.defenseBlock.steps[1].how = '<script>alert(2)</script>';
    var html = cardHtml(an);
    excludes(html, '<img src=x', '태그가 그대로 들어가지 않는다');
    excludes(html, '<script>alert(2)', '스크립트가 그대로 들어가지 않는다');
    includes(html, '&lt;img src=x', '글자로만 보인다');
  });

  /* ============================================================
   * 6. 버전
   * ============================================================ */

  test('v1.70 버전: sw · app · 스타일 캐시 · TWA · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.104.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.104.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.104.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.104.0', 'TWA appVersion');
    eq(twa.appVersionCode, 98, 'TWA 버전 코드');
    includes(readRoot('test/run.js'), 'test/v170.test.js', '테스트 목록 배선');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
