/* ============================================================
 * test/v122.test.js — v1.22.0 (2026-11-20)
 *  1) preventionWarmup: 통증 부위별 신경근 예방 워밍업 4항목 · 8분 · 출처
 *  2) disciplineLoadGuide: 단식/복식/남자복식/여자복식/혼합복식 분기와 수치 · 급수별 구수
 *  3) analyze() 통합: 통증·종목이 그대로 카드 데이터로
 *  4) AI 분석 카드: 접힌 '부상 예방 · 종목 부하' 블록 하나
 *  5) 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function names(pv) {
    return pv.items.map(function (it) { return it.name; });
  }
  function allText(pv) {
    return names(pv).join(' ') + ' ' + pv.items.map(function (it) { return it.how; }).join(' ');
  }

  /* =========================================================
   * 1) 예방 워밍업
   * ========================================================= */
  test('v1.22 예방 워밍업: 전신 예열 → 통증 부위 2개 → 종목 예열, 4항목 8분', function () {
    var pv = BM.ai.preventionWarmup(['무릎'], '단식');
    eq(pv.items.length, 4, '항목 4개');
    eq(pv.minutes, 8, '총 8분');
    eq(pv.label, '8분', '표시 문구');
    eq(pv.items[0].name, '전신 동적 예열', '전신 예열이 먼저');
    eq(pv.items[3].name, '코트 동작 예열', '종목 예열이 마지막');
    pv.items.forEach(function (it) {
      ok(it.how && it.how.length > 8, '방법 문구: ' + it.name);
      ok(it.min > 0, '소요 시간: ' + it.name);
    });
    /* 같은 입력이면 같은 결과 (순수 함수) */
    var again = BM.ai.preventionWarmup(['무릎'], '단식');
    eq(JSON.stringify(again.items), JSON.stringify(pv.items), '같은 입력 → 같은 결과');
  });

  test('v1.22 예방 워밍업: 통증 부위마다 다른 항목을 고른다', function () {
    var cases = [
      ['무릎', '한 발 착지 · 감속 런지'],
      ['발목', '발목 균형 감각'],
      ['어깨', '팔 바깥 돌리기 · 어깨 날개 고정'],
      ['팔꿈치', '팔뚝·손목 예열'],
      ['손목', '손목 풀기'],
      ['허리', '엉덩이 접기 · 등 돌리기'],
      ['목', '턱 당기기 · 등 풀기'],
      ['아킬레스건', '종아리 · 발목 예열']
    ];
    cases.forEach(function (c) {
      var pv = BM.ai.preventionWarmup([c[0]], '복식');
      includes(names(pv).join('|'), c[1], c[0] + ' → ' + c[1]);
      eq(pv.areas[0], c[0], '반영 부위: ' + c[0]);
    });
    /* 도메인 통증 목록 8부위 모두 항목이 있다 */
    BM.domain.VOCAB.pain.forEach(function (p) {
      var pv = BM.ai.preventionWarmup([p], '복식');
      ok(pv.items.length === 4, '부위 처리: ' + p);
      eq(pv.areas[0], p, '부위 이름 유지: ' + p);
    });
  });

  test('v1.22 예방 워밍업: 무릎·발목은 방향 전환·착지 항목으로, 두 부위까지만 반영', function () {
    var pv = BM.ai.preventionWarmup(['무릎', '발목', '어깨'], '복식');
    var txt = allText(pv);
    includes(txt, '착지', '무릎 항목');
    includes(txt, '한 발 서기', '발목 항목');
    excludes(txt, '팔 바깥 돌리기', '세 번째 부위는 넣지 않는다');
    eq(pv.areas.length, 2, '반영 부위 2개');
    includes(pv.reason, '52%', '하체 부상 비중 근거(쉬운 말)');
    includes(pv.reason, '23.5', '발목 염좌 근거');
    includes(pv.reason, '준비운동을 자주 할수록', '준비운동 근거 문구(쉬운 말)');
    /* 하체 통증만 있으면 남은 자리는 하체 기본(발목·무릎)으로 */
    var knee = BM.ai.preventionWarmup(['무릎'], '복식');
    includes(names(knee).join('|'), '발목 균형 감각', '빈자리는 발목 기본');
  });

  test('v1.22 예방 워밍업: 통증이 없으면 하체 기본 + PreventiBad 근거 문구', function () {
    var pv = BM.ai.preventionWarmup([], '복식');
    eq(pv.items.length, 4, '기본 4항목');
    eq(pv.areas.join(','), '발목,무릎', '하체 기본');
    includes(names(pv).join('|'), '발목 균형 감각', '발목 기본 항목');
    includes(pv.reason, '70', '부상 70% 감소');
    includes(pv.reason, '4.07', '대조군 1,000시간당 4.07건');
    includes(pv.reason, '1.23', '중재군 1.23건');
    var none = BM.ai.preventionWarmup(null, null);
    eq(none.items.length, 4, '인자 없이도 동작');
    eq(none.areas.join(','), '발목,무릎', '인자 없으면 하체 기본');
  });

  test('v1.22 예방 워밍업: 단식은 전후위, 복식은 전위 연타로 마무리한다', function () {
    var single = BM.ai.preventionWarmup([], '단식');
    includes(single.items[3].how, '전·후위 코너', '단식 마무리');
    includes(single.items[3].how, '8~12초', '단식 랠리 길이');
    ['복식', '혼합복식', '여자복식', ''].forEach(function (d) {
      includes(BM.ai.preventionWarmup([], d).items[3].how, '전위 연타', '복식 마무리: ' + (d || '빈 값'));
    });
    includes(single.source, '10.1080/02640414.2025.2461931', 'PreventiBad DOI');
    includes(single.source, '10.1080/15438627.2024.2351964', 'Marchena DOI');
    includes(single.source, '10.29333/ejgm/15917', 'Pengked DOI');
    includes(single.sourceShort, 'Phomsoupha 2025', '카드용 짧은 출처');
    eq(BM.ai.PREVENT.preventiBadPct, 70, '상수 70%');
    eq(BM.ai.PREVENT.warmupRho, -0.273, '상수 ρ');
  });

  /* =========================================================
   * 2) 종목별 부하 기준
   * ========================================================= */
  test('v1.22 종목 부하: 단식은 심박·스텝이 높은 기준으로 안내한다', function () {
    var g = BM.ai.disciplineLoadGuide('단식', 'B조');
    eq(g.discipline, '단식', '종목');
    includes(g.rally, '8~12초', '전후위 코너 랠리');
    includes(g.workRest, '1:2', '일:휴식 비율');
    includes(g.heart, '88.8', '단식 평균 심박');
    includes(g.heart, '96.8', '단식 최고 심박');
    includes(g.steps, '593.8', '게임당 스텝');
    includes(g.heart, '75.5', '복식 비교값');
    includes(g.tips.join(' '), '몸무게 대비 움직이는 양', '단식 부하 설명(쉬운 말)');
    eq(g.stats.singlesWorkES, 0.44, '내부 기준값 유지');
    eq(g.stats.eliteWorkES, 0.88, '내부 기준값 유지');
    includes(g.drill, '전후 코너 셔틀콕 연속 받기', '추천 드릴');
    includes(g.source, '10.1080/24748668.2009.11868479', 'Alcock DOI');
    includes(g.source, '10.1080/02640414.2025.2489863', 'Santiano DOI');
    eq(g.stats.stepsSingles, 593.8, '기준값 노출');
  });

  test('v1.22 종목 부하: 남자복식·혼합복식은 6~10초 고빈도, 여자복식은 10~12초', function () {
    ['남자복식', '혼합복식', '복식'].forEach(function (d) {
      var g = BM.ai.disciplineLoadGuide(d, 'C조');
      includes(g.rally, '6~10초', d + ' 랠리');
      includes(g.rally, '5.6~6.7', d + ' 실전 평균');
      includes(g.workRest, '1:1.5', d + ' 일:휴식');
      includes(g.tips.join(' '), '짧', d + ' 짧은 랠리 설명');
    });
    var w = BM.ai.disciplineLoadGuide('여자복식', 'C조');
    eq(w.discipline, '여자복식', '여자복식 분기');
    includes(w.rally, '10~12초', '긴 랠리');
    includes(w.rally, '10.1', '실전 평균 10.1초');
    includes(w.tips.join(' '), '실제 경기시간', '유효 시간 비율 설명');
    eq(BM.ai.disciplineKey('여복'), '여자복식', '여복 축약');
    eq(BM.ai.disciplineKey('남복'), '남자복식', '남복 축약');
    eq(BM.ai.disciplineKey('혼복'), '혼합복식', '혼복 축약');
    eq(BM.ai.disciplineKey('스쿼시'), '복식', '모르는 종목은 복식');
    eq(BM.ai.disciplineKey(''), '복식', '빈 값은 복식');
  });

  test('v1.22 종목 부하: 급수에 따라 셔틀콕 연속 받기 구수가 달라진다', function () {
    var low = BM.ai.disciplineLoadGuide('단식', '초심');
    var mid = BM.ai.disciplineLoadGuide('단식', 'C조');
    var high = BM.ai.disciplineLoadGuide('단식', '자강');
    ok(low.reps !== high.reps, '초심 ≠ 자강');
    eq(low.reps, '8~10구 × 2~3세트', '초심 구수');
    eq(mid.reps, '10~12구 × 3세트', 'C조 구수');
    eq(high.reps, '15구 × 4세트', '자강 구수');
    includes(low.levelNote, '스플릿 스텝', '초심 안내');
    includes(high.levelNote, '회복', '고급자 안내');
    var unknown = BM.ai.disciplineLoadGuide('복식', '모름');
    eq(unknown.reps, '20구 × 3세트', '급수를 모르면 C조 기준');
  });

  /* =========================================================
   * 3) analyze() 통합
   * ========================================================= */
  test('v1.22 분석 통합: 통증 부위·종목·급수가 그대로 담긴다', function () {
    var an = BM.ai.analyze({
      draft: { cond: 6, intensity: 6, minutes: 70, pain: ['무릎'], weakness: ['풋워크'], discipline: '단식' },
      records: [], level: 'B조', nick: '나래'
    });
    ok(an.prevent, '예방 워밍업 결과');
    eq(an.prevent.areas[0], '무릎', '오늘 통증 반영');
    includes(names(an.prevent).join('|'), '한 발 착지', '무릎 항목');
    includes(an.prevent.items[3].how, '전·후위 코너', '단식 종목 반영');
    ok(an.loadGuide, '종목 부하 결과');
    eq(an.loadGuide.discipline, '단식', '주력 종목 반영');
    includes(an.loadGuide.reps, '10~15구', 'B조 구수');

    /* 종목이 없으면 복식 기본 */
    var dflt = BM.ai.analyze({ draft: { pain: [], discipline: '' }, records: [], level: 'C조' });
    eq(dflt.loadGuide.discipline, '복식', '종목 없으면 복식');
    eq(dflt.prevent.areas.join(','), '발목,무릎', '통증 없으면 하체 기본');

    /* 기존 시트 칸은 그대로 (추천드릴·맞춤처방 JSON) */
    eq(Object.keys(an.sheetPatch).sort().join(','), ['맞춤처방', '추천드릴'].sort().join(','), '시트 칸 그대로');
    excludes(an.sheetPatch['맞춤처방'], 'function', 'JSON에 함수 없음');
    ok(an.care.warmup.length >= 3, '기존 웜업 처방 유지');
  });

  test('v1.22 분석 통합: 반복 통증(3회 이상)도 예방 워밍업에 들어간다', function () {
    var records = [];
    for (var i = 1; i <= 3; i++) {
      var d = U.ymd(U.addDays(new Date(), -i * 2));
      records.push({
        id: 'p' + i, date: d, userKey: 'me', cond: 6, intensity: 6, minutes: 60,
        pain: ['어깨'], weakness: [], done: []
      });
    }
    var an = BM.ai.analyze({ draft: { date: U.ymd(), pain: [], discipline: '복식' }, records: records, level: 'A조', nick: '나래' });
    eq(an.prevent.areas[0], '어깨', '반복 통증 부위');
    includes(allText(an.prevent), '팔 바깥 돌리기', '어깨 항목');
  });

  /* =========================================================
   * 4) AI 분석 카드
   * ========================================================= */
  test('v1.22 카드: 접힌 한 블록에 예방 워밍업과 종목 부하가 함께 보인다', function () {
    var an = BM.ai.analyze({
      draft: { cond: 7, intensity: 6, minutes: 70, pain: ['무릎'], weakness: ['풋워크'], discipline: '단식' },
      records: [], level: 'B조', nick: '나래'
    });
    var html = BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
    includes(html, 'data-fold="prevent"', '접기 블록');
    includes(html, '부상 예방 · 종목 부하', '블록 제목');
    includes(html, '코트 전 8분', '요약줄에 시간');
    includes(html, '무릎', '요약줄에 부위');
    includes(html, '4가지', '항목 수');
    includes(html, '전신 동적 예열', '항목 이름');
    includes(html, '한 발 착지', '부위별 항목');
    includes(html, '전후 코너 셔틀콕 연속 받기', '종목 드릴');
    includes(html, '88.8', '심박 기준');
    includes(html, '근거 · Phomsoupha 2025', '짧은 출처');
    includes(html, 'Alcock', '부하 출처');
    includes(html, 'Santiano', '부하 출처(국제저널)');
    /* 카드가 길어지지 않게 기본은 접힌 상태 */
    excludes(html, 'data-fold="prevent" open', '기본은 접힘');
    eq(html.split('data-fold="prevent"').length - 1, 1, '블록은 하나만');

    /* 통증이 없어도 기본 워밍업 블록은 나온다 */
    var plain = BM.ai.analyze({ draft: { cond: 6, discipline: '복식' }, records: [], level: 'C조' });
    includes(BM.views.log.analysisCard(plain, { ui: {} }), '발목 균형 감각', '기본 항목');
  });

  test('v1.22 카드: 일지 기록 상세에는 저장된 처방만 남는다 (새 필드는 카드 전용)', function () {
    var an = BM.ai.analyze({ draft: { cond: 6, pain: ['어깨'], discipline: '복식' }, records: [], level: 'C조' });
    var rec = { id: 'r1', date: U.ymd(), cond: 6, pain: ['어깨'], weakness: [], done: [], prescription: an.care };
    var detail = BM.views.log.recordDetail(rec);
    excludes(detail, '부상 예방 · 종목 부하', '지난 기록 상세에는 새 블록 없음');
    includes(detail, '저장된 처방', '기존 처방 유지');
  });

  /* =========================================================
   * 5) 버전
   * ========================================================= */
  test('v1.22 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.101.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.101.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.101.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.101.0', 'TWA appVersion');
    eq(twa.appVersionCode, 95, 'TWA 버전 코드');
    /* 공개 저장소에 시트 ID·토큰을 남기지 않는다 */
    excludes(readRoot('js/ai.js'), '1sqxAM6eskBYS03s', '시트 ID 없음');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
