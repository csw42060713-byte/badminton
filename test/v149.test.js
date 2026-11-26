/* ============================================================
 * test/v149.test.js — bm-v1.49.0
 *   🤖 배드민턴 AI — 선수 7대 훈련 균형 + 주간 부하 리듬(단조로움)
 *
 *  1) 7대 훈련 밸런스 — 지난 2주 기록에서 항목별 횟수·마지막 날
 *     · 코트 훈련만 했으면 '쏠림'으로 짚고, 코트 밖 3가지 중 하나를 먼저 권함
 *     · 비어 있는 항목만 1~2개, 이유·세트는 쉬운 코트 말투
 *     · 7대 훈련 3번 미만이면 말하지 않음(2주 밖 기록은 안 셈)
 *  2) 주간 부하 리듬 — Foster(1998)/Haddad(2017) 세션 RPE
 *     · 매일 비슷하게 세게 치면 단조로움 ↑ + 쉰 날 0일 경고
 *     · 세게/가볍게 번갈아 치면 낮은 단조로움 = 좋은 리듬
 *  3) 분석 카드 — 기존 값 그대로 + 새 접기(7대 훈련 균형·부하 리듬)
 *  4) 버전 · 배선 · 보안 · 근거 출처
 * 실행: node test/run.js
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

  var NOW = new Date();
  function d(offset) { return U.ymd(U.addDays(NOW, offset)); }

  /* 일지 한 줄 — 7대 훈련은 시트 '훈련계획' 칸(plan JSON)에 남습니다 */
  function rec(offset, opt) {
    opt = opt || {};
    var r = {
      id: 'r149-' + offset + '-' + (opt.tag || ''),
      type: '기록', date: d(offset), cond: opt.cond == null ? 6 : opt.cond,
      intensity: opt.intensity == null ? 6 : opt.intensity,
      minutes: opt.minutes == null ? 60 : opt.minutes,
      done: [], pain: opt.pain || [], weakness: opt.weakness || [],
      score: opt.score || null, result: opt.result || ''
    };
    if (opt.pro) r.plan = opt.proRaw ? JSON.stringify({ pro: opt.pro }) : { pro: opt.pro };
    return r;
  }

  var ME = { key: 'u_me149', nick: '선수', level: '선수부', role: 'player', discipline: '단식' };

  function baseState(records) {
    var rows = [];
    var st = {
      ready: true, mode: 'local', me: ME, rows: rows,
      data: { records: records || [], posts: [], friends: [], chats: [], hearts: { balance: 0, adToday: 0 }, log: {} },
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], note: '', pro: {} } },
      ui: { tab: 'log', composer: '', composerTopic: '자유', chatRoom: null, chatOpen: true },
      queue: [], locks: {}, stats: { writes: 0, blocked: 0, failed: 0 }
    };
    return st;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 20, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
  }

  /* =========================================================
   * 1. 선수 7대 훈련 밸런스
   * ========================================================= */

  test('v1.49 7대 훈련: 지난 2주 기록을 항목별로 센다', function () {
    var recs = [
      rec(-13, { pro: { '스트록': '클리어 100개', '스매시': '20개' }, tag: 'a' }),
      rec(-9, { pro: { '스트록': '', '풋워크': '10분' }, tag: 'b' }),
      rec(-4, { pro: { '스트록': '', '스매시': '', '벽치기': '' }, tag: 'c' }),
      rec(-20, { pro: { '하체 근력운동': '스쿼트 5×5' }, tag: 'old' })
    ];
    var b = AI.proBalance(recs, null);
    ok(b.on, '2주에 3번이면 켜짐');
    eq(b.sessions, 3, '2주 밖 기록은 세지 않음');
    eq(b.counts.length, 7, '7항목 모두');
    function n(name) {
      return b.counts.filter(function (c) { return c.name === name; })[0].n;
    }
    eq(n('스트록'), 3, '스트록 3번');
    eq(n('스매시'), 2, '스매시 2번');
    eq(n('벽치기'), 1, '벽치기 1번');
    eq(n('하체 근력운동'), 0, '2주 밖 근력운동은 안 셈');
    eq(b.counts.filter(function (c) { return c.name === '스트록'; })[0].last, d(-4), '마지막으로 한 날');
  });

  test('v1.49 7대 훈련: 코트 훈련만 했으면 쏠림으로 짚고 근력부터 권한다', function () {
    var recs = [
      rec(-10, { pro: { '스트록': '클리어', '스매시': '20개' }, tag: 'a' }),
      rec(-6, { pro: { '스트록': '', '풋워크': '' }, tag: 'b' }),
      rec(-2, { pro: { '스트록': '', '스매시': '', '벽치기': '' }, tag: 'c' })
    ];
    var b = AI.proBalance(recs, null);
    eq(b.level, 'skew', '코트만 → 쏠림');
    includes(b.pattern, '코트에서 하는', '무엇을 했는지 먼저');
    includes(b.pattern, '한 번도 없어요', '비어 있는 곳을 쉬운 말로');
    eq(b.add.length, 2, '보완은 두 개까지');
    eq(b.add[0].name, '하체 근력운동', '근력운동을 먼저');
    includes(b.add[0].how, '세트', '세트 수를 알려 줌');
    includes(b.add[0].why, '점프 스매시', '왜 필요한지 코트 말로');
    ok(b.missing.indexOf('하체 근력운동') >= 0 && b.missing.indexOf('코어') >= 0, '빈 항목에 근력·코어');
  });

  test('v1.49 7대 훈련: 비어 있는 항목만 골라 1~2개 추천한다', function () {
    var recs = [
      rec(-8, { pro: { '스트록': '100개', '코어': '플랭크' }, tag: 'a' }),
      rec(-5, { pro: { '스트록': '100개', '하체 근력운동': '스쿼트' }, tag: 'b' }),
      rec(-1, { pro: { '스트록': '100개', '스매시': '30개' }, tag: 'c' })
    ];
    var b = AI.proBalance(recs, null);
    eq(b.level, 'miss', '일부만 비었을 때');
    ok(b.add.length >= 1 && b.add.length <= 2, '1~2개');
    b.add.forEach(function (a) {
      ok(b.missing.indexOf(a.name) >= 0, '이미 한 항목은 권하지 않음: ' + a.name);
      ok(a.how && a.why, a.name + ': 하는 법·이유가 있어야 함');
    });
    includes(b.pattern, '아직 없어요', '비어 있는 항목 안내');
    ok(b.add[0].name !== '하체 근력운동' && b.add[0].name !== '코어', '이번 주에 한 항목은 빼고 권함');
  });

  test('v1.49 7대 훈련: 7가지를 다 하면 칭찬만 하고 더 권하지 않는다', function () {
    var all = ['스트록', '벽치기', '코어', '풋워크', '스매시', '상체 근력운동', '하체 근력운동'];
    var pro = {};
    all.forEach(function (n) { pro[n] = ''; });
    var recs = [rec(-9, { pro: pro, tag: 'a' }), rec(-4, { pro: pro, tag: 'b' }), rec(-1, { pro: pro, tag: 'c' })];
    var b = AI.proBalance(recs, null);
    eq(b.level, 'ok', '균형 좋음');
    eq(b.add.length, 0, '더 권하지 않음');
    eq(b.label, '7가지 다 했어요', '접기 제목 값');
    includes(b.pattern, '다 들어갔어요', '칭찬 문구');
  });

  test('v1.49 7대 훈련: 3번 미만이거나 기록이 없으면 말하지 않는다', function () {
    var two = [rec(-5, { pro: { '스트록': '' }, tag: 'a' }), rec(-2, { pro: { '스매시': '' }, tag: 'b' })];
    eq(AI.proBalance(two, null).on, false, '2번이면 꺼짐');
    eq(AI.proBalance([], null).on, false, '기록 없음');
    eq(AI.proBalance(null, {}).on, false, '인자 없음');
    var old = [rec(-30, { pro: { '스트록': '' } }), rec(-20, { pro: { '스트록': '' } }), rec(-16, { pro: { '스트록': '' } })];
    eq(AI.proBalance(old, null).on, false, '2주 밖 기록만 있으면 꺼짐');
  });

  test('v1.49 7대 훈련: 오늘 작성 중인 일지도 한 번으로 세고, 글자 JSON도 읽는다', function () {
    var recs = [
      rec(-7, { pro: { '스트록': '클리어' }, proRaw: true, tag: 'json' }),
      rec(-3, { pro: { '스매시': '20개' }, tag: 'b' })
    ];
    var b = AI.proBalance(recs, { pro: { '코어': '플랭크 60초' } });
    ok(b.on, '셋이 되면 켜짐');
    eq(b.sessions, 3, '오늘 초안 포함');
    eq(b.counts.filter(function (c) { return c.name === '스트록'; })[0].n, 1, '글자 JSON plan도 읽음');
    eq(b.counts.filter(function (c) { return c.name === '코어'; })[0].last, U.ymd(), '오늘 날짜');
  });

  /* =========================================================
   * 2. 주간 부하 리듬 (단조로움)
   * ========================================================= */

  test('v1.49 부하 리듬: 매일 비슷하게 세게 치면 단조로움이 높고 쉰 날이 0일이다', function () {
    var recs = [];
    for (var i = 0; i < 7; i++) recs.push(rec(-i, { minutes: 90, intensity: 7, tag: 'e' + i }));
    var r = AI.loadRhythm(recs, {});
    ok(r.on, '7일이면 켜짐');
    eq(r.restDays, 0, '쉰 날 0일');
    eq(r.monotony, 9.9, '하루 부하가 같으면 표준편차 0 → 계산 불가 값');
    eq(r.level, 'flat', '가장 평평한 리듬');
    eq(r.total, 4410, '90분 × 7 × 7일');
    includes(r.text, '지난 7일 부하', '한 줄 요약');
    includes(r.tips[0], '하루도 안 쉬었어요', '쉬는 날 경고');
    includes(r.tips[0], '쉬거나', '어떻게 할지까지');
    eq(r.tips.length, 2, '두 줄까지만');
    excludes(r.tips.join(' '), 'undefined', '빈 값 없음');
  });

  test('v1.49 부하 리듬: 세게/가볍게 번갈아 치면 단조로움이 낮다', function () {
    var recs = [];
    [0, 2, 4, 6].forEach(function (i) { recs.push(rec(-i, { minutes: 100, intensity: 8, tag: 'h' + i })); });
    [1, 3, 5].forEach(function (i) { recs.push(rec(-i, { minutes: 20, intensity: 2, tag: 'l' + i })); });
    var r = AI.loadRhythm(recs, {});
    ok(r.on, '켜짐');
    ok(r.monotony < 2, '단조로움 낮음: ' + r.monotony);
    eq(r.level, 'ok', '좋은 리듬');
    eq(r.total, 3320, '80×4 + 4×3');
    includes(r.tips[0], '번갈아', '좋은 리듬 칭찬');
  });

  test('v1.49 부하 리듬: 훈련일이 3일 미만이면 말하지 않는다', function () {
    eq(AI.loadRhythm([rec(-2, { minutes: 60, intensity: 6 })], {}).on, false, '하루');
    eq(AI.loadRhythm([], {}).on, false, '기록 없음');
    var rest = [rec(-6, { minutes: 0, intensity: 0, tag: 'r1' }), rec(-5, { minutes: 0, intensity: 0, tag: 'r2' }), rec(-4, { minutes: 0, intensity: 0, tag: 'r3' })];
    eq(AI.loadRhythm(rest, {}).on, false, '부하 0만 있으면 꺼짐');
  });

  test('v1.49 부하 리듬: 오늘 일지(분·강도)도 오늘 부하로 들어간다', function () {
    var recs = [rec(-5, { minutes: 60, intensity: 5, tag: 'a' }), rec(-3, { minutes: 60, intensity: 5, tag: 'b' })];
    eq(AI.loadRhythm(recs, {}).on, false, '두 번만 있으면 아직 말하지 않음');
    var withToday = AI.loadRhythm(recs, { minutes: 90, intensity: 8 });
    ok(withToday.on, '오늘이 더해져 3일');
    eq(withToday.total, 1320, '두 번 × 300 + 오늘 720');
    eq(withToday.trainDays, 3, '오늘 포함 3일');
  });

  /* =========================================================
   * 3. 분석 카드 — 기존 값 그대로 + 새 접기
   * ========================================================= */

  test('v1.49 분석: 기존 필드는 그대로, balance·rhythm 이 함께 온다', function () {
    var recs = [
      rec(-9, { pro: { '스트록': '클리어', '스매시': '20개' }, weakness: ['풋워크'], tag: 'a' }),
      rec(-5, { pro: { '스트록': '', '풋워크': '' }, tag: 'b' }),
      rec(-1, { pro: { '스트록': '', '스매시': '' }, tag: 'c' })
    ];
    var an = AI.analyze({ draft: { date: U.ymd(), cond: 6, intensity: 7, minutes: 80, weakness: ['풋워크'], pro: {} }, records: recs, level: '선수부', discipline: '단식' });
    ok(an.balance && an.balance.on, '7대 훈련 균형');
    ok(an.rhythm && an.rhythm.on, '부하 리듬');
    ok(typeof an.score === 'number', '점수 그대로');
    ok(an.drills && an.drills.drills.length === 3, '추천 드릴 그대로');
    ok(an.guard && an.guard.title, '관절 보호 그대로');
    ok(an.prevent && an.prevent.items.length, '예방 워밍업 그대로');
    ok(an.load && typeof an.load.ratio === 'number', '부하 점검 그대로');
    ok(an.care && an.care.warmup.length, '맞춤 처방 그대로');
    eq(an.risk.length, 1, '점검 줄 수는 그대로');
    eq(an.insights.length <= 6, true, '진단 6개 이하');
  });

  test('v1.49 화면: 일지 카드에 7대 훈련 균형·부하 리듬이 나온다', function () {
    var recs = [
      rec(-9, { pro: { '스트록': '클리어', '스매시': '20개' }, minutes: 90, intensity: 7, tag: 'a' }),
      rec(-5, { pro: { '스트록': '', '풋워크': '' }, minutes: 90, intensity: 7, tag: 'b' }),
      rec(-1, { pro: { '스트록': '', '스매시': '' }, minutes: 90, intensity: 7, tag: 'c' })
    ];
    var st = baseState(recs);
    st.analysis = AI.analyze({ draft: st.drafts.log, records: recs, level: '선수부', discipline: '단식', nick: '선수' });
    var html = BM.views.log.render(st);
    checkHtml(html, '일지 카드');
    includes(html, 'data-fold="balance"', '7대 훈련 균형 접기');
    includes(html, '지난 14일', '2주 기준 표기');
    includes(html, '선수 7대 훈련 균형', '접기 제목');
    includes(html, '이번 주에 하나만 더', '보완 추천');
    includes(html, '주간 부하 리듬', '부하 리듬 줄');
    includes(html, '단조로움', '쉬운 말 + 지표 이름');
    includes(html, '참고 논문', '출처 한 줄');
    includes(html, '훈련 균형', '자세히 보기 요약 값');
  });

  test('v1.49 화면: 선수 7대 훈련 기록이 없으면 접기가 안 나온다', function () {
    var recs = [rec(-5, { minutes: 60, intensity: 6, tag: 'a' }), rec(-3, { minutes: 60, intensity: 6, tag: 'b' }), rec(-1, { minutes: 60, intensity: 6, tag: 'c' })];
    var st = baseState(recs);
    st.analysis = AI.analyze({ draft: st.drafts.log, records: recs, level: 'C조', discipline: '복식' });
    var html = BM.views.log.render(st);
    excludes(html, 'data-fold="balance"', '7대 훈련을 안 적으면 안 나옴');
    includes(html, '주간 부하 리듬', '일반 기록에도 부하 리듬은 나옴');
  });

  test('v1.49 문구: 숫자만 던지지 않고 코트 말로 이유까지 말한다', function () {
    var recs = [];
    for (var i = 0; i < 7; i++) recs.push(rec(-i, { pro: { '스트록': '' }, minutes: 100, intensity: 8, tag: 'f' + i }));
    var r = AI.loadRhythm(recs, {});
    includes(r.tips[0], '몸살', '왜 쉬어야 하는지');
    includes(r.tips[0], '이번 주', '언제 할지');
    includes(r.sourceShort, 'Foster', '논문 이름은 출처 줄에만');
    var b = AI.proBalance([rec(-4, { pro: { '스트록': '' }, tag: 'a' }), rec(-3, { pro: { '스매시': '' }, tag: 'b' }), rec(-2, { pro: { '풋워크': '' }, tag: 'c' })], null);
    includes(b.text, '번 적었어요', '쉬운 말 요약');
    excludes(b.text + b.pattern, 'undefined', '빈 값 없음');
    excludes(b.text + b.pattern, 'DOI', '논문 번호는 화면 문장에 없음');
  });

  /* =========================================================
   * 4. 근거 · 버전 · 배선 · 보안
   * ========================================================= */

  test('v1.49 근거: 새 논문 4편이 ai.js 머리말·상수에 남아 있다', function () {
    if (!hasNode) return;
    var ai = readRoot('js/ai.js');
    includes(ai, '[FOST98]', 'Foster 1998');
    includes(ai, '10.1097/00005768-199807000-00023', 'Foster DOI');
    includes(ai, '[HADD17]', 'Haddad 2017');
    includes(ai, '10.3389/fnins.2017.00612', 'Haddad DOI');
    includes(ai, '[MA25]', 'Ma 2025 메타분석');
    includes(ai, '10.1186/s13102-025-01199-y', 'Ma DOI');
    includes(ai, '[WANG25]', 'Wang 2025 저항운동 고찰');
    includes(ai, '10.3389/fphys.2025.1548869', 'Wang DOI');
    excludes(ai, 'blog.naver', '블로그 출처 없음');
    excludes(ai, 'tistory', '블로그 출처 없음');
    includes(ai, 'monotony', '단조로움 계산');
    includes(ai, 'monotonyHigh: 2.0', '2.0 참고선');
  });

  test('v1.49 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.84.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.84.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-6', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.84.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 78', '앱 버전 코드 +1');
  });

  test('v1.49 배선: 새 파일 없이 기존 파일만 바뀐다 (테스트 목록·서비스워커)', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v149.test.js', '테스트 목록');
    var sw = readRoot('sw.js');
    excludes(sw, './js/balance.js', '새 파일 없음');
    includes(sw, './js/ai.js', 'ai.js 그대로');
    includes(sw, './js/views/log.js', '일지 화면 그대로');
  });

  test('v1.49 보안: 새 화면 문구도 esc 를 쓰고 confirm 창을 쓰지 않는다', function () {
    if (!hasNode) return;
    var log = readRoot('js/views/log.js');
    includes(log, 'U.esc(c.name)', '항목 이름 탈출');
    includes(log, 'U.esc(String(c.last)', '마지막 날 탈출');
    includes(log, 'U.esc(a.how)', '하는 법 탈출');
    includes(log, 'U.esc(a.why)', '이유 탈출');
    includes(log, 'U.esc(an.rhythm.text)', '부하 리듬 문구 탈출');
    includes(log, 'U.esc(b.sourceShort)', '출처 탈출');
    excludes(log, 'window.confirm(', '브라우저 confirm 창 없음');
    excludes(log, 'native confirm', '브라우저 confirm 창 없음');
    var index = readRoot('index.html');
    includes(index, "object-src 'none'", 'CSP object-src');
    includes(index, "base-uri 'none'", 'CSP base-uri');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
