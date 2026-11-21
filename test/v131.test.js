/* ============================================================
 * test/v131.test.js — bm-v1.37.2
 *   고도화 3차 사이클(ideas.md 2026-11-19 3번) + 디자인 폴리싱.
 *
 *   1) 일지 기반 주간 약점 3회 스탬프 챌린지
 *      · 최근 2주 '약점기술'에서 가장 자주 나온 약점 1개 → '이번 주 3번 연습하기'
 *      · 그 약점이 '약점기술'·'완료훈련'에 찍힌 일지를 저장하면 스탬프 자동 +1 (수동 체크 없음)
 *        (같은 날 일지는 1회 · 이번 주는 월~일)
 *      · 3회를 채우면 축하 배지 + 다음 주 교체 안내
 *      · 초심이 4주 루틴 1주차를 하는 중이면 첫 화면이 복잡해지지 않게 숨김
 *
 *   2) 디자인 폴리싱 — 프로필 시트 '플레이 스타일' 한 줄, 대화방 아바타 정리
 *
 *   3) AI 부상 예방 남은 전문용어 정리 (55도 · 고관절 · 멀티셔틀 · 대퇴사두근 …)
 *      — 논문 수치(stats)와 '참고 논문' 한 줄은 그대로.
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* 날짜를 고정한 예시 — 2026-11-20(금), 이번 주는 11/16(월)~11/22(일) */
  var NOW = '2026-11-20';
  var ME = 'u_v131_me';

  function rec(date, weak, done) {
    return { date: date, weakness: weak || [], done: done || [] };
  }

  function challenge(records, opts) {
    var o = { now: NOW };
    if (opts) Object.keys(opts).forEach(function (k) { o[k] = opts[k]; });
    return D.weekChallenge(records, o);
  }

  /* 화면용 상태 — 실제 앱 state 모양 그대로(분석·탭·초안 포함) */
  function stateOf(records, patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: { records: records || [], idx: { all: [], byType: {}, byId: {} }, threads: [] },
      drafts: { log: { date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [], games: [{ a: '', b: '' }], pain: [], note: '' } },
      ui: { tab: 'log', challengeNow: NOW, matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      routine: {}, routinePref: true
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 30, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'p', 'span', 'i'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  function countOn(html) {
    return (html.match(/class="wkch__stamp is-on"/g) || []).length;
  }

  /* 최근 2주에 헤어핀만 3번, 이번 주에는 11/16·11/18 두 날 */
  var TWO = [
    rec('2026-11-06', ['헤어핀']),          /* 2주 밖 — 약점 고르기에도 안 들어감 */
    rec('2026-11-10', ['헤어핀']),          /* 지난주 */
    rec('2026-11-12', ['헤어핀', '드라이브']),
    rec('2026-11-16', ['헤어핀'], []),      /* 이번 주 월 */
    rec('2026-11-18', [], ['헤어핀'])       /* 이번 주 수 — 완료훈련에 찍힘 */
  ];

  /* =========================================================
   * 1. 챌린지 계산 — 최근 2주 · 이번 주 · 스탬프
   * ========================================================= */
  test('v1.31 챌린지: 3회 목표 · 이번 주는 월~일', function () {
    var ch = challenge([]);
    eq(ch.goal, 3, '목표 3회');
    eq(ch.weekStart, '2026-11-16', '월요일 시작');
    eq(ch.weekEnd, '2026-11-22', '일요일 끝');
    eq(ch.weekLabel, '11/16~11/22', '한 줄 표기');
    eq(D.CHALLENGE_GOAL, 3, '기본 목표');
    eq(D.CHALLENGE_DAYS, 14, '최근 2주');
    eq(D.weekStartOf(new Date(2026, 10, 20)).getDay(), 1, '월요일로 맞춘다');
  });

  test('v1.31 챌린지: 최근 2주에서 가장 자주 나온 약점 하나를 고른다', function () {
    var ch = challenge(TWO);
    eq(ch.active, true, '챌린지 열림');
    eq(ch.weakness, '헤어핀', '가장 자주 나온 약점');
    eq(ch.picks[0].n, 3, '횟수');
    eq(ch.next, '드라이브', '다음 주 후보는 두 번째 약점');
    eq(ch.recent, 4, '최근 2주 일지 수(11/06은 2주 밖)');
  });

  test('v1.31 챌린지: 이번 주에 그 약점이 찍힌 날만 스탬프', function () {
    var ch = challenge(TWO);
    eq(ch.count, 2, '11/16 · 11/18 두 날');
    eq(ch.done, false, '아직 3회 아님');
    eq(ch.left, 1, '한 번 남음');
    eq(ch.days.join(','), '2026-11-16,2026-11-18', '찍힌 날');
  });

  test('v1.31 챌린지: 같은 날 일지를 두 번 남겨도 1회', function () {
    var ch = challenge([
      rec('2026-11-09', ['헤어핀']),
      rec('2026-11-19', ['헤어핀']),
      rec('2026-11-19', ['헤어핀']),
      rec('2026-11-19', [], ['헤어핀'])
    ]);
    eq(ch.weakness, '헤어핀', '약점');
    eq(ch.count, 1, '연습한 날 1회');
  });

  test('v1.31 챌린지: 완료훈련에 찍혀도 스탬프가 채워진다', function () {
    var ch = challenge([
      rec('2026-11-10', [], ['풋워크']),
      rec('2026-11-11', ['풋워크']),
      rec('2026-11-19', [], ['풋워크', '게임'])
    ]);
    eq(ch.weakness, '풋워크', '약점기술에서 고름');
    eq(ch.count, 1, '완료훈련만 찍힌 날도 스탬프');
    eq(ch.days.join(','), '2026-11-19', '찍힌 날');
  });

  test('v1.31 챌린지: 3회를 채우면 done, 더 해도 넘치지 않는다', function () {
    var ch = challenge([
      rec('2026-11-10', ['헤어핀']),
      rec('2026-11-17', ['헤어핀']),
      rec('2026-11-18', ['헤어핀']),
      rec('2026-11-19', ['헤어핀']),
      rec('2026-11-20', ['헤어핀'])
    ]);
    eq(ch.count, 4, '이번 주 4일');
    eq(ch.done, true, '3회 달성');
    eq(ch.left, 0, '남은 횟수 0');
  });

  test('v1.31 챌린지: 최근 2주 밖 기록은 약점 고르기에서 빠진다', function () {
    var ch = challenge([
      rec('2026-11-01', ['클리어']),
      rec('2026-11-02', ['클리어']),
      rec('2026-11-03', ['클리어']),
      rec('2026-11-19', ['서브'])
    ]);
    eq(ch.weakness, '서브', '2주 밖 클리어는 세지 않는다');
    eq(ch.count, 1, '이번 주 서브 1일');
  });

  test('v1.31 챌린지: 일지가 없거나 약점이 없으면 조용히 알려 준다', function () {
    var none = challenge([]);
    eq(none.active, false, '일지 없음');
    eq(none.reason, 'no_records', '이유');
    var weakless = challenge([rec('2026-11-19', [], []), rec('2026-11-18', [], ['게임'])]);
    eq(weakless.active, false, '약점 없음');
    eq(weakless.reason, 'no_weakness', '이유');
    eq(weakless.recent, 2, '일지 수는 센다');
  });

  test('v1.31 챌린지: 같은 입력이면 같은 결과(순수 함수)', function () {
    var a = challenge(TWO), b = challenge(TWO);
    eq(JSON.stringify(a), JSON.stringify(b), '두 번 계산해도 같다');
    eq(TWO[0].date, '2026-11-06', '입력은 그대로');
    /* 동률이면 최근 쪽 → 사전 순서로 고정 */
    var tie = challenge([
      rec('2026-11-19', ['드라이브', '헤어핀'])
    ]);
    eq(tie.picks.length, 2, '동률 두 개');
    eq(tie.picks[0].n, tie.picks[1].n, '같은 횟수');
    eq(tie.weakness, '드라이브', '동률은 사전 순서(드라이브 → 헤어핀)');
  });

  test('v1.31 챌린지: 날짜 표기가 조금 달라도 읽는다', function () {
    var ch = challenge([
      rec('2026.11.12', ['헤어핀']),
      rec('2026/11/19', ['헤어핀'])
    ]);
    eq(ch.weakness, '헤어핀', '점·슬래시 날짜도 인식');
    eq(ch.count, 1, '이번 주 1일');
  });

  /* =========================================================
   * 2. 화면 — 루틴 요약 아래 한 장, 스탬프는 자동
   * ========================================================= */
  test('v1.31 화면: 루틴 요약 아래에 챌린지 한 장', function () {
    var st = stateOf(TWO);
    st.routine = BM.routine.normalize({ w1_grip: true, w1_ready: true, w1_warmup: true });
    var html = BM.views.log.render(st);
    checkHtml(html, '일지 화면');
    includes(html, 'data-region="challenge"', '챌린지 영역');
    includes(html, '주간 약점 챌린지', '제목');
    includes(html, '이번 주 <b>헤어핀</b> 3번 연습하기', '문구');
    includes(html, '11/16~11/22', '이번 주 표기');
    includes(html, '2/3', '진행 표기');
    includes(html, '한 번만 더 채우면 완성', '남은 한 번 안내');
    includes(html, '일지에 헤어핀을 남기면 자동으로 채워져요', '채우는 방법');
    ok(html.indexOf('data-region="routine"') < html.indexOf('data-region="challenge"'), '루틴 요약 아래');
  });

  test('v1.31 화면: 스탬프는 찍힌 만큼만 채운다', function () {
    var html = BM.views.log.challengeBlock(stateOf(TWO));
    eq(countOn(html), 2, '두 개 채움');
    includes(html, 'role="progressbar"', '진행 표시');
    includes(html, 'aria-valuenow="2"', '현재 값');
    includes(html, 'aria-valuemax="3"', '최대 값');
    includes(html, '일지에 헤어핀을 남기면', '채우는 방법은 그대로');
  });

  test('v1.31 화면: 3회를 채우면 축하 배지와 다음 주 교체 안내', function () {
    var done = TWO.concat([rec('2026-11-19', ['헤어핀'])]);
    var html = BM.views.log.challengeBlock(stateOf(done));
    eq(countOn(html), 3, '세 개 다 채움');
    includes(html, 'card--wkch is-done', '완료 카드');
    includes(html, '🎉 3회 채웠어요', '축하 문구');
    includes(html, '다음 주 월요일에 새 약점으로 바뀌어요', '교체 안내');
    includes(html, '다음 주 후보 · 드라이브', '다음 후보');
  });

  test('v1.31 화면: 초심이 4주 루틴 1주차를 하는 중이면 숨긴다', function () {
    var st = stateOf(TWO, { me: { key: ME, nick: '콕콕', level: '초심', discipline: '복식' } });
    st.routine = BM.routine.normalize({ w1_grip: true });
    eq(BM.views.log.challengeHidden(st), true, '1주차 진행 중 → 숨김');
    eq(BM.views.log.challengeBlock(st), '', '그리지 않는다');
    eq(stateOf(TWO).ui.challengeNow, NOW, '기준 날짜는 그대로');
  });

  test('v1.31 화면: 초심도 1주차를 끝내면 챌린지가 보인다', function () {
    var st = stateOf(TWO, { me: { key: ME, nick: '콕콕', level: '초심', discipline: '복식' } });
    st.routine = BM.routine.normalize({ w1_grip: true, w1_ready: true, w1_warmup: true });
    eq(BM.views.log.challengeHidden(st), false, '1주차 완료 → 보임');
    includes(BM.views.log.challengeBlock(st), '이번 주 <b>헤어핀</b>', '챌린지 카드');
  });

  test('v1.31 화면: 루틴을 건너뛴 초심에게는 보여 준다', function () {
    var st = stateOf(TWO, { me: { key: ME, nick: '콕콕', level: '초심', discipline: '복식' }, routinePref: false });
    st.routine = {};
    eq(BM.views.log.challengeHidden(st), false, '루틴을 건너뛰었으면 보임');
    includes(BM.views.log.challengeBlock(st), '이번 주 <b>헤어핀</b>', '카드');
  });

  test('v1.31 화면: 일지는 있는데 약점 태그가 없으면 한 줄 초대', function () {
    var st = stateOf([rec('2026-11-19', [], ['게임'])]);
    var html = BM.views.log.challengeBlock(st);
    includes(html, 'is-quiet', '조용한 카드');
    includes(html, '약점 기술', '무엇을 남기면 되는지');
    includes(html, '3회 챌린지가 열려요', '안내');
    eq(countOn(html), 0, '스탬프는 그리지 않는다');
  });

  test('v1.31 화면: 기록이 아예 없으면 아무것도 그리지 않는다', function () {
    eq(BM.views.log.challengeBlock(stateOf([])), '', '첫 화면은 오늘 일지에 집중');
  });

  test('v1.31 저장: 일지를 저장하면 스탬프가 바로 채워진다', function () {
    /* 이번 주 기록이 하나도 없는 상태에서 시작 (오늘이 무슨 요일이어도 같게) */
    var before = [rec('2026-11-09', ['헤어핀']), rec('2026-11-10', ['헤어핀'])];
    var st = stateOf(before);
    eq(BM.views.log.challengeBlock(st).indexOf('0/3') > 0, true, '저장 전 0/3');
    /* 오늘 일지를 저장한 것과 같은 변화 — 새 기록 행이 data.records에 붙는다 */
    st.data = { records: [rec('2026-11-16', ['헤어핀'])].concat(before) };
    var html = BM.views.log.challengeBlock(st);
    includes(html, '1/3', '저장 뒤 1/3');
    eq(countOn(html), 1, '스탬프 하나');
    includes(html, '2번 더 남았어요', '남은 횟수');
    /* 오늘 초안에 이미 그 약점이 찍혀 있으면 저장만 하면 된다고 알려 줍니다 */
    st.drafts.log.weakness = ['헤어핀'];
    includes(BM.views.log.challengeBlock(st), '오늘 일지를 저장하면 스탬프가 채워져요', '저장 안내');
  });

  test('v1.31 화면: 오늘 몫을 이미 채웠으면 같은 날 또 저장해도 늘지 않는다고 알린다', function () {
    var st = stateOf([rec('2026-11-18', ['헤어핀']), rec('2026-11-20', ['헤어핀'])]);
    st.drafts.log.weakness = ['헤어핀'];
    var html = BM.views.log.challengeBlock(st);
    includes(html, '오늘 몫은 채웠어요', '안내 문구');
    eq(countOn(html), 2, '오늘 포함 두 날');
  });

  test('v1.31 갱신: 스탬프가 바뀌면 화면 서명도 바뀐다', function () {
    var st = stateOf(TWO);
    var a = BM.views.log.challengeBlock(st);
    st.data = { records: TWO.concat([rec('2026-11-19', ['헤어핀'])]) };
    var b = BM.views.log.challengeBlock(st);
    ok(a !== b, '다시 그린다');
    includes(b, 'is-done', '완료 상태');
  });

  test('v1.31 보안: 약점 글자에 태그가 들어와도 그대로 이스케이프', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var html = BM.views.log.challengeBlock(stateOf([
      rec('2026-11-10', [PAYLOAD]), rec('2026-11-11', [PAYLOAD]), rec('2026-11-18', [PAYLOAD])
    ]));
    excludes(html, '<img src=x', '이스케이프');
    includes(html, '&lt;img', '글자로 보인다');
  });

  /* =========================================================
   * 3. AI 문구 — 남은 전문용어 정리 (수치·출처는 그대로)
   * ========================================================= */
  test('v1.31 문구: 관절 보호 기준에 55도·각도가 없다', function () {
    var g = BM.ai.jointGuard(['어깨'], [], { intensity: 6, minutes: 60 });
    var text = JSON.stringify(g.shoulder);
    excludes(text, '55도', '55도 없음');
    excludes(text, '각도가', '각도 설명 없음');
    includes(g.shoulder.thresholds[2], '81%', '통증 확률은 남긴다');
    includes(BM.ai.INJURY['어깨'].rehab.join(' '), '안으로 덜 돌아가거나', '어깨 기준');
    eq(BM.ai.SHOULDER_RISK.irRomDeg, 55, '논문 기준값은 내부에');
  });

  test('v1.31 문구: 종목 드릴은 "셔틀콕 연속 받기"로 읽힌다', function () {
    ['단식', '남자복식', '혼합복식', '여자복식', '복식'].forEach(function (d) {
      var g = BM.ai.disciplineLoadGuide(d, 'C조');
      excludes(g.drill, '멀티셔틀', d + ' 드릴');
      includes(g.drill, '연속 받기', d + ' 드릴 표현');
      ok(/\d+~\d+초/.test(g.drill), d + ' 랠리 길이 유지');
    });
    eq(BM.ai.disciplineLoadGuide('단식', 'C조').reps, '10~12구 × 3세트', '급수별 구수 유지');
    includes(BM.ai.disciplineLoadGuide('단식', 'C조').steps, '593.8', '스텝 수치 유지');
  });

  test('v1.31 문구: 오프코트·처방에 고관절·대퇴사두근이 없다', function () {
    var oc = BM.ai.offcourtRoutine('복식');
    var text = JSON.stringify(oc);
    excludes(text, '고관절', '고관절 없음');
    includes(oc.days[1].steps[0].how, '무릎과 엉덩이가 데워진 뒤', '쉬운 말');
    includes(oc.days[1].steps[3].how, '뭉친 근육을 풀고', '폼롤러 목적');
    excludes(JSON.stringify(BM.ai.GENERIC_CARE), '고관절', '기본 처방');
    excludes(BM.ai.INJURY['무릎'].stretch.join(' '), '대퇴사두근', '무릎 스트레칭');
    includes(BM.ai.INJURY['무릎'].stretch.join(' '), '허벅지 앞', '쉬운 말');
    /* 밴드 보강 순서·폼롤러 30분 같은 핵심 동작은 그대로 */
    includes(oc.days[1].order, '폼롤러 30분', '웨이트 날 순서');
    eq(oc.core.items.length, 3, '코어 3종');
  });

  test('v1.31 문구: 예방 워밍업 항목 이름도 쉬운 말', function () {
    var names = BM.ai.preventionWarmup(['허리', '손목'], '복식').items.map(function (i) { return i.name; }).join('|');
    includes(names, '엉덩이 접기 · 등 돌리기', '허리 항목');
    includes(names, '손목 풀기', '손목 항목');
    excludes(names, '흉추', '흉추 없음');
    excludes(names, '힙힌지', '힙힌지 없음');
    var pv = BM.ai.preventionWarmup(['팔꿈치'], '단식');
    includes(pv.items.map(function (i) { return i.name; }).join('|'), '팔뚝·손목 예열', '팔꿈치 항목');
  });

  test('v1.31 문구: 참고 논문 한 줄과 수치는 그대로', function () {
    var pv = BM.ai.preventionWarmup(['무릎'], '복식');
    ok((pv.sourceShort || '').length > 10, '짧은 출처');
    includes(pv.sourceShort, 'Phomsoupha 2025', '예방 워밍업 출처');
    eq(pv.stats.preventiBadPct, 70, '부상 감소율');
    includes(BM.ai.disciplineLoadGuide('단식', 'C조').source, 'Alcock & Cable', '종목 부하 출처');
    var g = BM.ai.jointGuard(['어깨'], ['풋워크'], { intensity: 9, minutes: 100 });
    includes(g.shoulder.sourceShort, '참고 논문', '어깨 출처');
    includes(g.lower.sourceShort, '참고 논문', '무릎·발목 출처');
    if (hasNode) {
      var code = readRoot('js/ai.js');
      includes(code, 'GIRD > 14°', '코드 주석에 논문 기준');
      includes(code, '10.3390/ijerph192013095', 'Cejudo DOI');
    }
  });

  /* =========================================================
   * 4. 디자인 폴리싱 — 프로필 표 · 대화방 아바타
   * ========================================================= */
  test('v1.31 디자인: 프로필 표 라벨은 한 줄로', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ok(/\.kv\s*\{[^}]*grid-template-columns:\s*max-content/.test(css), '.kv 라벨 너비 자동');
    ok(/\.kv dt\s*\{[^}]*white-space:\s*nowrap/.test(css), '.kv dt 줄바꿈 없음');
    var html = BM.views.profile.open ? 'ok' : '';
    eq(html, 'ok', '프로필 시트 있음');
  });

  test('v1.31 디자인: 대화방은 같은 사람 말풍선에 아바타를 한 번만', function () {
    if (!hasNode) return;
    var code = readRoot('js/views/chat.js');
    includes(code, 'is-run', '같은 사람 묶음 표시');
    var css = readRoot('styles.css');
    ok(/\.dmsg\.is-run \.dmsg__av/.test(css), '아바타 숨김 규칙');
    ok(/\.dmsg__av\s*\{[^}]*align-self:\s*flex-end/.test(css), '아바타는 말풍선 아랫선에');
  });

  test('v1.31 스타일: 챌린지 카드 클래스가 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.card--wkch', '.wkch__stamp', '.wkch__stamp.is-on', '.wkch__note', '.wkch__hint'].forEach(function (sel) {
      includes(css, sel, sel + ' 정의');
    });
    ok(/\.wkch__stamp\.is-on\s*\{[^}]*var\(--accent-soft\)/.test(css), '테마 색을 쓴다');
    excludes(css.match(/\.card--wkch[^}]*\}/)[0], '#fff', '고정 색을 쓰지 않는다');
  });

  /* =========================================================
   * 5. 버전 정합성 · 아이디어 노트
   * ========================================================= */
  test('v1.31 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.40.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.40.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261121-51', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.40.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.40.0', 'TWA appVersion');
    eq(twa.appVersionCode, 38, 'TWA 버전 코드');
  });

  test('v1.31 문서: 아이디어 노트에 반영과 다음 후보가 남는다', function () {
    if (!hasNode) return;
    var doc = readRoot('ideas.md');
    includes(doc, 'v1.31.0', '이번 사이클 기록');
    includes(doc, '주간 약점', '챌린지 항목');
    includes(doc, '디자인 폴리싱', '디자인 항목');
    includes(doc, '다음 사이클', '다음 후보 안내');
  });

  test('v1.31 파일: 앱 껍데기(sw)에 새 화면 코드가 들어 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, './js/views/log.js', 'log.js');
    includes(sw, './styles.css', 'styles.css');
    var idx = readRoot('index.html');
    includes(idx, 'js/views/log.js', 'index.html 로드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
