/* ============================================================
 * test/v1103.test.js — bm-v1.104.0
 *
 *   2026-11-28 19시 배드민턴 AI 인터뷰 — 체전 1등 선수 현장 기준 실전 노하우 2가지
 *     "상대 스매시가 엄청 강할 때는 서서 맞서지 말고 자세를 낮게 숙여서 수비 시야·타점을
 *      확보하고, 공을 뒤로 끌어서(임팩트에 여유를 두고 흡수하듯) 받아 넘긴다"
 *     "경기 중 체력이 급격히 떨어지거나 숨이 찰 때는 무리해서 바로 다음 랠리로 들어가지 말고,
 *      신발끈을 다시 묶거나 물을 한 모금 마시는 등 규정 안에서 자연스럽게 시간을 벌며
 *      호흡과 템포를 정리한다"
 *
 *   1) 강한 스매시 수비 — 자세 낮추기 → 뒤로 끌어 흡수 → 높게 넘겨 재정비 (3단계)
 *   2) 체력 저하 시 템포 정리 — 점 사이 시간 벌기 → 숨 정리 → 낮은 템포로 시작 (3단계)
 *   3) 드릴 · 전술 노트 연결
 *   4) 화면 — 시합 당일 준비 접기 안에 두 블록 (접기는 하나)
 *   5) 보호 — 기존 시합 준비·수비 타이밍·전환·드릴 그대로 · 실존 선수 이름 없음 · 버전
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

  var AI = BM.ai;

  /* ---------- 도우미 ---------- */
  function analyze(draft, records) {
    var d = { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], games: [], weakness: [], pain: [] };
    Object.keys(draft || {}).forEach(function (k) { d[k] = draft[k]; });
    return AI.analyze({ draft: d, records: records || [], level: 'C조', discipline: '복식', nick: '승우' });
  }

  function cardHtml(an) {
    return BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
  }

  function joinSteps(steps) {
    return (steps || []).map(function (s) { return s.name + ' ' + s.how; }).join(' ');
  }

  /* 사용자가 보는 문구에 나오면 안 되는 것들 (기존 기준 유지) */
  var HARD = ['OR ', 'p <', 'GIRD', 'ACWR', 'RPE', 'IRR', 'ρ', 'Spearman', '모멘트',
    '구심성', '원심성', '내회전', '외회전', '생체역학'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* ============================================================
   * 1. 강한 스매시 수비 — 낮게 · 뒤로 끌어 흡수
   * ============================================================ */

  test('v1.103 강스매시: 낮추기 → 뒤로 끌어 흡수 → 높게 넘기기 3단계가 적힌다', function () {
    var h = AI.matchDay('복식').heavyBlock;
    ok(h && h.title, '블록 있음');
    includes(h.title, '강한 스매시', '제목');
    eq(h.steps.length, 3, '3단계');
    includes(h.steps[0].name, '자세', '1단계 — 자세');
    includes(h.steps[0].how, '낮', '1단계 — 낮추기');
    includes(h.steps[0].name, '서서 맞서지', '1단계 — 서서 맞서지 않기');
    includes(h.steps[0].how, '시야', '1단계 — 시야 확보');
    includes(h.steps[0].how, '타점', '1단계 — 타점 확보');
    includes(h.steps[1].name, '뒤로 끌어', '2단계 — 뒤로 끌기');
    includes(h.steps[1].how, '뒤로 빼', '2단계 — 라켓을 뒤로');
    includes(h.steps[1].how, '흡수', '2단계 — 흡수');
    includes(h.steps[1].how, '임팩트', '2단계 — 임팩트 여유');
    includes(h.steps[2].name, '높게', '3단계 — 높게 넘기기');
    includes(h.steps[2].how, '네트 위', '3단계 — 네트 위로 띄우기');
    includes(h.note, '서서 맞서면', '왜 안 되는지 한 줄');
    includes(h.drill, '스매시만', '연습 방법');
    includes(h.source, '체전 1등 선수 현장 기준', '출처 표기');
    ok(h.source.indexOf('2026-11-28') >= 0, '제보 날짜 표기');
  });

  test('v1.103 강스매시: 단식·혼합복식에도 같이 붙는다 (받는 법은 같다)', function () {
    ['단식', '복식', '혼합복식'].forEach(function (d) {
      var h = AI.matchDay(d).heavyBlock;
      ok(h && h.steps && h.steps.length === 3, d + ' 3단계');
    });
  });

  test('v1.103 강스매시: 수비 드릴이 실제 연습으로 이어진다', function () {
    var names = AI.DRILLS['수비'].map(function (x) { return x.name; });
    var i = names.indexOf('강한 스매시 받아내기 — 낮게, 뒤로 끌어');
    ok(i >= 0, '수비 드릴 목록에 있다');
    var d = AI.DRILLS['수비'][i];
    includes(d.method, '무릎을 굽혀', '방법 — 자세 낮추기');
    includes(d.method, '뒤로 빼며', '방법 — 라켓을 뒤로');
    includes(d.method, '흡수', '방법 — 흡수');
    includes(d.method, '허리 아래', '방법 — 라켓 높이');
    includes(d.point, '자세 낮추고 시작', '한 줄 코칭 앞부분');
    includes(d.point, '흡수', '한 줄 코칭 가운데');
    includes(d.point, '높게 넘기기', '한 줄 코칭 뒷부분');
    ok(d.sets && String(d.sets['A조'] || '').indexOf('개') >= 0, '세트 안내');
  });

  test('v1.103 강스매시: 복식 수비 전술 줄에 같은 기준이 붙는다', function () {
    var line = AI.TACTICS['복식'].filter(function (x) { return x.indexOf('리프트는 스트레이트') >= 0; })[0];
    ok(line, '기존 수비 전술 줄');
    includes(line, '블록·드라이브로 앞으로 나가', '기존 문구 유지');
    includes(line, '뒤로 살짝 당겨', '기존 예측 못 한 공 기준 유지');
    includes(line, '서서 맞서지 말고', '새 기준 — 서서 맞서지 않기');
    includes(line, '자세를 낮춰', '새 기준 — 자세 낮추기');
    includes(line, '뒤로 끌어 흡수', '새 기준 — 뒤로 끌어 흡수');
  });

  /* ============================================================
   * 2. 체력 저하 시 템포 정리
   * ============================================================ */

  test('v1.103 템포: 시간 벌기 → 숨 정리 → 낮은 템포 3단계가 적힌다', function () {
    var p = AI.matchDay('복식').tempoBlock;
    ok(p && p.title, '블록 있음');
    includes(p.title, '템포', '제목');
    eq(p.steps.length, 3, '3단계');
    includes(p.steps[0].how, '신발끈', '1단계 — 신발끈');
    includes(p.steps[0].how, '물을 한 모금', '1단계 — 물 한 모금');
    includes(p.steps[0].how, '자연스러운', '1단계 — 자연스러운 동작');
    includes(p.steps[1].how, '들이쉬고', '2단계 — 들이쉬기');
    includes(p.steps[1].how, '내쉬', '2단계 — 내쉬기');
    includes(p.steps[2].how, '2~3구', '3단계 — 첫 몇 구');
    includes(p.steps[2].how, '깊게 길게', '3단계 — 낮은 템포로 길게');
    includes(p.note, '바로 다음 랠리', '왜 서두르면 안 되는지');
    includes(p.source, '체전 1등 선수 현장 기준', '출처 표기');
  });

  test('v1.103 템포: 규정을 피하는 요령이 아니라 경기 흐름 안의 동작으로 적는다', function () {
    var p = AI.matchDay('복식').tempoBlock;
    var all = joinSteps(p.steps) + ' ' + p.note;
    includes(all, '규정 안', '규정 안이라는 말');
    ['지연', '일부러 늦', '시간 끌', '꼼수', '몰래'].forEach(function (w) {
      excludes(all, w, '규정 밖 표현 없음: ' + w);
    });
  });

  test('v1.103 템포: 단식·혼합복식에도 붙는다', function () {
    ['단식', '복식', '혼합복식'].forEach(function (d) {
      var p = AI.matchDay(d).tempoBlock;
      ok(p && p.steps && p.steps.length === 3, d + ' 3단계');
    });
  });

  /* ============================================================
   * 3. 순수 함수 · 같은 입력 = 같은 결과
   * ============================================================ */

  test('v1.103 순수 함수: 돌려준 블록을 고쳐도 원본(MATCH_DAY)이 바뀌지 않는다', function () {
    var a = AI.matchDay('복식');
    a.heavyBlock.steps[0].how = '바꿔치기';
    a.tempoBlock.steps[0].name = '바꿔치기';
    var b = AI.matchDay('복식');
    excludes(JSON.stringify(b.heavyBlock), '바꿔치기', '강스매시 원본 보존');
    excludes(JSON.stringify(b.tempoBlock), '바꿔치기', '템포 원본 보존');
    excludes(JSON.stringify(AI.MATCH_DAY), '바꿔치기', '내부 상수도 그대로');
    eq(JSON.stringify(AI.matchDay('복식')), JSON.stringify(AI.matchDay('복식')), '같은 입력 = 같은 결과');
  });

  test('v1.103 분석: 저장 카드의 시합 블록에 두 블록이 함께 들어간다', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 60, weakness: ['수비'] });
    ok(an.match.heavyBlock && an.match.heavyBlock.steps.length === 3, '강스매시 블록');
    ok(an.match.tempoBlock && an.match.tempoBlock.steps.length === 3, '템포 블록');
    includes(an.match.summary, '강한 스매시', '요약 줄');
    includes(an.match.summary, '템포', '요약 줄');
  });

  /* ============================================================
   * 4. 화면 — 시합 당일 준비 접기 하나 안에
   * ============================================================ */

  test('v1.103 화면: 시합 준비 접기 안에 강스매시·템포 블록이 함께 나온다', function () {
    var html = cardHtml(analyze({ cond: 6, intensity: 6, minutes: 60, weakness: ['드라이브'] }));
    includes(html, 'data-fold="match"', '시합 준비 접기');
    eq(html.split('data-fold="match"').length - 1, 1, '접기는 하나만');
    includes(html, 'data-heavy-smash="1"', '강스매시 블록');
    includes(html, 'data-tempo="1"', '템포 블록');
    includes(html, '서서 맞서지 말고 자세부터 낮추기', '낮추기 단계가 화면에');
    includes(html, '공을 뒤로 끌어 흡수하기', '흡수 단계가 화면에');
    includes(html, '신발끈을 다시 묶거나', '신발끈이 화면에');
    includes(html, '숨부터 정리하기', '숨 정리 단계가 화면에');
    excludes(html, 'undefined', 'undefined 없음');
    excludes(html, 'null', 'null 없음');
  });

  test('v1.103 화면: 두 블록은 수비 타이밍 아래에 이어지고 접기 수는 그대로다', function () {
    var html = cardHtml(analyze({ cond: 7, intensity: 6, minutes: 60, weakness: ['풋워크'] }));
    var dfAt = html.indexOf('수비에서 받는 타이밍');
    var hvAt = html.indexOf('data-heavy-smash="1"');
    var tpAt = html.indexOf('data-tempo="1"');
    ok(dfAt > 0 && hvAt > dfAt, '수비 타이밍 뒤에 강스매시');
    ok(tpAt > hvAt, '강스매시 뒤에 템포');
    /* 첫 화면 접기 수는 늘리지 않았다 (시합 준비는 심화 묶음 안) */
    var top = 0, depth = 0, m, scan = /<details\b|<\/details>/g;
    while ((m = scan.exec(html))) {
      if (m[0] === '</details>') depth--;
      else { if (depth === 0) top++; depth++; }
    }
    ok(top <= 7, '첫 화면 접기 ' + top + '개');
  });

  test('v1.103 화면: 두 블록의 글자는 HTML로 실행되지 않는다(esc)', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 60 });
    an.match.heavyBlock.steps[0].how = '<img src=x onerror=alert(1)>';
    an.match.tempoBlock.note = '"><script>alert(2)</script>';
    var html = cardHtml(an);
    excludes(html, '<img src=x onerror=alert(1)>', '태그 주입 없음');
    excludes(html, '<script>alert(2)</script>', '스크립트 주입 없음');
    includes(html, '&lt;img', '글자로만 보인다');
  });

  /* ============================================================
   * 5. 보호 — 기존 코칭은 그대로
   * ============================================================ */

  test('v1.103 보호: 시합 준비 3단계 · 전환 3단계 · 수비 타이밍 2단계는 그대로', function () {
    var m = AI.matchDay('복식');
    eq(m.steps.length, 3, '시합 직전 3단계');
    eq(m.switchBlock.steps.length, 3, '수비→공격 전환 3단계');
    eq(m.defenseBlock.steps.length, 2, '수비 타이밍 2단계');
    eq(m.defenseBlock.steps[0].name.indexOf('예측한 공'), 0, '예측한 공 유지');
    eq(m.switchBlock.steps[0].name.indexOf('① 세게'), 0, '전환 1단계 유지');
    eq(AI.matchDay('단식').switchBlock.steps.length, 0, '단식은 전환 3단계 없음');
  });

  test('v1.103 보호: 기존 수비 드릴 5개는 이름·순서 그대로 남아 있다', function () {
    var names = AI.DRILLS['수비'].map(function (x) { return x.name; });
    eq(names.length, 6, '기존 5개 + 새 1개');
    eq(names[0], '수비 타이밍 — 예측했을 때 / 아닐 때', '첫 드릴 그대로');
    ['좌우 수비 블록', '드라이브 카운터', '수비 → 로테이션', '한 발 수비(리치)'].forEach(function (n, i) {
      eq(names[i + 1], n, '기존 드릴 순서 유지: ' + n);
    });
    eq(names[5], '강한 스매시 받아내기 — 낮게, 뒤로 끌어', '새 드릴은 맨 뒤');
  });

  test('v1.103 보호: 추천 드릴·처방·부하 점검은 그대로', function () {
    var an = analyze({ cond: 6, intensity: 6, minutes: 60, weakness: ['수비'] });
    eq(an.drills.drills.length, 3, '추천 드릴 3개');
    eq(an.drills.drills[0].name, '수비 타이밍 — 예측했을 때 / 아닐 때', '수비 약점 1순위 그대로');
    ok(an.care.warmup.length && an.care.rehab.length && an.care.stretch.length && an.care.mental.length, '처방 4종');
    ok(an.load && typeof an.load.ratio === 'number', '부하 점검');
    ok(an.hydration && typeof an.hydration.on === 'boolean', '수분 카드');
    ok(an.mental && typeof an.mental.on === 'boolean', '정신 피로 카드');
  });

  test('v1.103 보호: 새 문구에 실존 선수 이름·전문 통계 기호가 없다', function () {
    var m = AI.matchDay('복식');
    var text = JSON.stringify(m.heavyBlock) + JSON.stringify(m.tempoBlock) +
      JSON.stringify(AI.DRILLS['수비']) + JSON.stringify(AI.TACTICS['복식']);
    banText(text, '새 코칭');
    ['김원호', '안세영', '서승재', '김소영', '공희용'].forEach(function (n) {
      excludes(text, n, '실존 선수 이름 없음: ' + n);
    });
    includes(text, '체전 1등 선수 현장 기준', '가명 표기');
  });

  test('v1.103 버전: sw · app · push · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.104.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.104.0'", 'app.js');
    includes(readRoot('js/push.js'), "version: 'v1.104.0'", 'push.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.104.0', 'TWA 이름');
    eq(twa.appVersion, '1.104.0', 'TWA appVersion');
    eq(twa.appVersionCode, 98, 'TWA 버전 코드 +1');
    includes(readRoot('README.md'), 'bm-v1.104.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v1103.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
