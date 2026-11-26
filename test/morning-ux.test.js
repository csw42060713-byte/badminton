/* ============================================================
 * test/morning-ux.test.js — 2026-11-25 아침 사용성 개선 (미리보기)
 *   배드민턴 앱 사용성 점검(06시) + 어제 남은 항목을 그대로 검증합니다.
 *
 *   ① 인스타 공유 카드 — 시간·점수 없는 일지도 영수증 TOTAL·본문이 빈다는 문제
 *      (예: 11/21 · 풋워크 → TOTAL '—' + 완료 훈련이 빠짐)
 *   ② 인스타 공유 카드 — 대회 인증 날짜가 오늘로 고정되는 문제 → 날짜 입력
 *   ③ 일지 & AI — '무릎 쉬기' 경고 아래 육각 풋워크가 추천되는 모순
 *   ④ 일지 & AI — 저장 뒤 접힘 메뉴 9개가 한꺼번에 나열되는 문제 → 심화 묶음
 *   ⑤ 상세 리포트 — 접전 승률이 떨어졌는데 칭찬하는 문구 + '채워져요.일지의' 오타
 *   ⑥ 영상 자세 비교 — 1·2구간 시간 중복 · 예시를 본 뒤 전환 버튼이 사라지는 문제
 *
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

  /* ---------- 가짜 캔버스 (v1.71 테스트와 같은 방식) ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mock() {
    var log = { texts: [], fills: [], points: 0, strokes: 0, gradients: [] };
    function gradient() {
      var g = { addColorStop: function () {} };
      log.gradients.push(g);
      return g;
    }
    var ctx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1,
      lineCap: '', lineJoin: '', letterSpacing: '0px', globalCompositeOperation: 'source-over',
      clearRect: function () {},
      fillRect: function () {},
      strokeRect: function () {},
      beginPath: function () {}, moveTo: function () { log.points++; }, lineTo: function () { log.points++; },
      closePath: function () {}, rect: function () {}, arcTo: function () {}, arc: function () {}, ellipse: function () {},
      fill: function () { log.fills.push(ctx.fillStyle); },
      stroke: function () { log.strokes++; },
      clip: function () {}, save: function () {}, restore: function () {},
      translate: function () {}, scale: function () {}, rotate: function () {},
      createLinearGradient: gradient, createRadialGradient: gradient,
      measureText: function (text) { return { width: textWidth(text, ctx.font) }; },
      fillText: function (text) { log.texts.push(String(text)); },
      strokeText: function (text) { log.texts.push(String(text)); },
      drawImage: function () {}
    };
    var canvas = { width: 0, height: 0, getContext: function () { return ctx; } };
    return { canvas: canvas, log: log };
  }

  function textsOf(log) { return log.texts.join('|'); }

  function todaySpec(patch) {
    var s = {
      mode: 'today', design: 'receipt', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: null, top: '11/21 (금)', kicker: '', phrase: '민턴일기',
      big: { value: '', unit: '', label: '' }, bigLine: '', stats: [],
      meta: '', metaLine: '', label: '', date: '11/21 (금)', comp: null,
      textPos: 'bottom', photoX: 0, photoY: 0, photoZoom: 1, filter: 'auto',
      showNums: true, win: true, hasStamp: false, stamp: '', badge: '', tagLine: '',
      gymName: '', minutes: null, recordText: '', condText: '좋음',
      doneText: '풋워크', noteText: '', partnerName: '', rivalName: ''
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  var ME = BM.seed.ME;

  function stateOf(records) {
    return {
      me: { key: ME, nick: '승우', level: 'B조', discipline: '복식', club: '나래울체육관' },
      data: { records: records || [], stats: { streak: 0 } },
      analysis: null, drafts: { log: {} }, ui: {}
    };
  }

  function rec(patch) {
    var r = { id: 'rmorning', userKey: ME, date: '2026-11-21', done: ['풋워크'], weakness: ['풋워크'], pain: [] };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  function uiState(patch) {
    var s = {
      mode: 'today', design: 'receipt', ratio: 'feed', shade: 'original', palette: 'night',
      bg: '', photo: null, filter: 'auto', nums: 'show', win: true, badge: false, deco: false,
      frame: 'none', phrase: '민턴일기', phraseComp: '민턴일기', textPos: 'bottom',
      recordId: 'rmorning', photoX: 0, photoY: 0, photoZoom: 1, gym: '', partner: '', rival: '',
      contest: '', event: '', result: '우승', compPartner: '', date: U.ymd()
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  function ctxOf(state) {
    return { store: { state: state }, actions: { setPref: function () {} }, repaint: function () {} };
  }

  /* =========================================================
   * ① 영수증 — 시간·점수가 없어도 빈 TOTAL 대신 훈련이 채워진다
   * ========================================================= */

  test('v1.72 영수증: 시간·점수 없는 일지도 훈련·컨디션·한 줄이 본문에 선다', function () {
    var sc = BM.sharecard;
    var rows = sc.receiptRows(todaySpec({ noteText: '육각 스텝 시작' }));
    eq(rows.map(function (r) { return r.key; }).join(','), '날짜,훈련,컨디션,한 줄', '빈 운동시간·경기 대신 훈련·컨디션·한 줄');
    eq(rows[1].value, '풋워크', '완료한 훈련');
    eq(rows[3].value, '육각 스텝 시작', '한 줄 메모');
    var full = sc.receiptRows(todaySpec({
      mode: 'today', minutes: 90, recordText: '2승 1패', gymName: '나래울체육관',
      doneText: '풋워크 · 스트록', noteText: ''
    }));
    eq(full.map(function (r) { return r.key; }).join(','), '날짜,운동시간,훈련,체육관,경기,컨디션',
      '값이 있는 날은 운동시간·경기 사이에 훈련이 끼어든다');
  });

  test('v1.72 영수증: TOTAL 자리가 — 대신 완료한 훈련으로 채워진다', function () {
    var sc = BM.sharecard;
    sc._setState(uiState());
    var spec = sc._specOf(ctxOf(stateOf([rec({ cond: 9 })])));
    eq(spec.big.value, '풋워크', '큰 숫자 자리에 훈련 이름');
    eq(spec.big.textOnly, true, '숫자가 아닌 글자 카드');
    eq(spec.doneText, '풋워크', '모델에도 남는다');
    eq(spec.minutes, null, '운동 시간은 없는 그대로');
    var m = mock();
    sc.draw(m.canvas, spec);
    var joined = textsOf(m.log);
    includes(joined, 'TOTAL', '합계 라벨은 그대로');
    includes(joined, '풋워크', '훈련 이름이 종이 위에');
    excludes(joined, '—', '빈 대시가 남지 않는다');
    includes(joined, '최고', '컨디션 줄');
  });

  test('v1.72 영수증: 훈련이 3개를 넘으면 앞 2개 + 외 N으로 줄인다', function () {
    var sc = BM.sharecard;
    sc._setState(uiState());
    var spec = sc._specOf(ctxOf(stateOf([rec({ done: ['풋워크', '스트록', '스매시', '게임'] })])));
    eq(spec.doneText, '풋워크 · 스트록 외 2', '영수증 한 줄에 맞게');
    var note = sc._specOf(ctxOf(stateOf([rec({ done: [], text: '오늘은 풋워크 영상만 보고 육각 스텝을 익혔다' })])));
    eq(note.big.value, '오늘은 풋워크 영상만 보고 육각…', '훈련이 없으면 한 줄 메모가 TOTAL로');
    ok(note.big.value.length <= 18, '18자 안');
  });

  /* =========================================================
   * ② 대회 인증 — 날짜를 바꿀 수 있다
   * ========================================================= */

  test('v1.72 대회 인증: 날짜 입력이 있고, 고른 날짜가 카드에 그대로 간다', function () {
    var sc = BM.sharecard;
    var ctx = ctxOf(stateOf([rec()]));
    sc._setState(uiState({ mode: 'comp', date: '2026-11-15' }));
    var html = sc._sheetBody(ctx);
    includes(html, 'type="date"', '날짜 입력');
    includes(html, 'data-sc-field="date"', '날짜 칸 연결');
    includes(html, 'value="2026-11-15"', '고른 날짜가 남는다');
    includes(html, '지난 대회 날짜로 바꿀 수 있어요', '안내');
    var spec = sc._specOf(ctx);
    eq(spec.top, '11/15 (일)', '지난 대회 날짜로 카드');
    eq(spec.comp.date, '11/15 (일)', '대회 모델도 같은 날짜');
    /* 날짜를 안 고르면 예전처럼 오늘 */
    sc._setState(uiState({ mode: 'comp' }));
    eq(sc._specOf(ctx).top, sc.dateLine(U.ymd()), '기본은 오늘');
  });

  /* =========================================================
   * ③ 무릎 통증 — 부담 큰 드릴을 빼고 안전한 드릴로
   * ========================================================= */

  var PAIN_DRAFT = { cond: 7, intensity: 6, minutes: 50, pain: ['무릎'], weakness: ['풋워크'] };

  function namesOf(an) {
    return (an.drills.drills || []).map(function (d) { return d.name; });
  }

  test('v1.72 무릎 통증: 육각 풋워크·점프 드릴이 사라지고 상체·스트레칭·회복으로 바뀐다', function () {
    var an = AI.analyze({ draft: PAIN_DRAFT, records: [], level: 'B조', nick: '승우' });
    var names = namesOf(an);
    eq(names.length, 3, '드릴 3개는 그대로');
    names.forEach(function (n) {
      ['풋워크', '점프', '육각', '스텝', '런지'].forEach(function (bad) {
        ok(n.indexOf(bad) < 0, '"' + n + '"에 ' + bad + ' 없음');
      });
    });
    names.forEach(function (n) {
      ok(AI.PAIN_SAFE_DRILLS.lower.some(function (d) { return d.name === n; }), '안전 드릴: ' + n);
    });
    includes(an.drills.note, '무릎', '왜 바뀌었는지 한 줄');
    includes(an.drills.note, '상체', '무엇으로 바뀌었는지');
    ok(an.drills.drills.every(function (d) { return d.sets && d.method; }), '세트·방법 안내');
    /* 일주일 루틴 메뉴도 같은 드릴을 쓴다 */
    ok(an.week[0].menu.indexOf('풋워크') < 0, '이번 주 메뉴도 안전한 드릴');
  });

  test('v1.72 어깨 통증: 머리 위·팔을 쓰는 드릴만 빠지고 개수는 3개로 채운다', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 50, pain: ['어깨'], weakness: ['스매시'] }, records: [], level: 'B조', nick: '승우' });
    var names = namesOf(an);
    eq(names.length, 3, '드릴 3개');
    names.forEach(function (n) { ok(n.indexOf('스매시') < 0, '"' + n + '"에 스매시 없음'); });
    includes(an.drills.note, '어깨', '안내');
    ok(names.some(function (n) { return /하체|코어|스트레칭/.test(n); }), '부담 없는 드릴로 채움');
  });

  test('v1.72 통증 없음: 드릴은 예전 그대로, 안내 줄도 없다', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 50, pain: [], weakness: ['풋워크'] }, records: [], level: 'B조', nick: '승우' });
    eq(an.drills.note, '', '안내 없음');
    ok(namesOf(an).length === 3, '드릴 3개');
  });

  test('v1.72 일지 화면: 바뀐 이유가 추천 드릴 위에 보인다', function () {
    var an = AI.analyze({ draft: PAIN_DRAFT, records: [], level: 'B조', nick: '승우' });
    var html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
    includes(html, 'data-drill-swap', '안내 줄');
    includes(html, '무릎 통증이 있어', '문구');
    includes(html, '<ol class="drills drills--core">', '드릴 목록은 그대로');
    excludes(html, '육각 풋워크', '화면 어디에도 육각 풋워크가 없다');
  });

  /* =========================================================
   * ④ 저장 뒤 접힘 메뉴 — 심화·선수 루틴으로 묶기
   * ========================================================= */

  test('v1.72 일지 화면: 선수용 4개 접기는 "심화 · 선수 루틴 더 보기" 하나로 묶인다', function () {
    var an = AI.analyze({ draft: { cond: 7, intensity: 6, minutes: 60, pain: [], weakness: ['풋워크'] }, records: [], level: 'B조', nick: '승우' });
    var html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
    includes(html, 'data-fold="pro"', '묶음 접기');
    includes(html, '심화 · 선수 루틴 더 보기', '이름');
    var proAt = html.indexOf('data-fold="pro"');
    ['offcourt', 'sense', 'match'].forEach(function (k) {
      ok(html.indexOf('data-fold="' + k + '"') > proAt, k + ' 접기가 묶음 안에');
    });
    /* 동호인 핵심은 그대로 먼저 */
    ok(html.indexOf('data-fold="prevent"') < proAt, '부상 예방이 먼저');
    ok(html.indexOf('data-fold="guard"') < proAt, '관절 보호가 먼저');
    ok(html.indexOf('data-fold="week"') > proAt, '이번 주 루틴은 뒤');
    /* 첫 화면 접기 수: 예전 9~10개 → 이제 7개 이하 (겹친 접기는 depth로 구분) */
    var top = 0, depth = 0, m;
    var scan = /<details\b|<\/details>/g;
    while ((m = scan.exec(html))) {
      if (m[0] === '</details>') depth--;
      else { if (depth === 0) top++; depth++; }
    }
    ok(top <= 7, '첫 화면 접기 ' + top + '개');
    var css = hasNode ? readRoot('styles.css') : '';
    includes(css, '.fold--pro .fold__body > .fold', '묶음 안쪽 접기 모양');
  });

  /* =========================================================
   * ⑤ 상세 리포트 — 하락엔 보완 문구, 오타 수정
   * ========================================================= */

  function reportOf(diff) {
    return {
      mode: 'week', periodLabel: '이번 주', prevPeriodLabel: '지난주', role: 'club', level: 'B조',
      current: {
        sessions: 3, minutes: 180, rate: 40, games: 10,
        close: { games: 6, wins: 2, losses: 4, rate: diff == null ? 33 : (diff < 0 ? 33 : 67) }
      },
      prev: { sessions: 3 },
      closeDiff: diff, weaknesses: [], repeatedPains: []
    };
  }

  test('v1.72 리포트: 접전 승률이 떨어졌으면 칭찬 대신 보완 문구', function () {
    var lines = BM.report.direction(reportOf(-33)).join(' ');
    includes(lines, '33포인트 낮아요', '수치');
    includes(lines, '서브를 낮게', '보완 문구');
    excludes(lines, '지금처럼 마지막까지 집중하는 게 잘 되고 있어요', '모순 칭찬 없음');
    var rose = BM.report.direction(reportOf(33)).join(' ');
    excludes(rose, '서브를 낮게', '오른 주에는 보완 문구 없음');
    var flat = BM.report.direction(reportOf(0)).join(' ');
    includes(flat, '지금처럼 마지막까지 집중하는 게 잘 되고 있어요', '유지·상승에는 칭찬');
  });

  test('v1.72 리포트: 아픈 부위가 있으면 다음 방향도 드릴 권유 대신 회복 안내', function () {
    var r = reportOf(0);
    r.repeatedPains = [{ name: '무릎', n: 2 }];
    var lines = BM.report.direction(r).join(' ');
    includes(lines, '아픈 부위가 편해질 때까지는', '회복 안내');
    excludes(lines, '풋워크 드릴 10분', '통증 있는데 드릴 권유 없음');
  });

  test('v1.72 리포트: "채워져요.일지의" 띄어쓰기 오타가 없다', function () {
    if (!hasNode) return;
    var src = readRoot('js/report.js');
    excludes(src, '채워져요.<br>', '줄바꿈으로 붙이지 않는다');
    var html = BM.report.bodyHtml(BM.report.build([rec({ date: U.ymd(), weakness: [], pain: [] })], { mode: 'week' }));
    includes(html, '채워져요. 일지의', '마침표 뒤 한 칸');
    excludes(html, '채워져요.일지의', '붙어 있지 않다');
  });

  /* =========================================================
   * ⑥ 영상 자세 비교 — 구간 시간 구분 · 예시 전환 버튼 유지
   * ========================================================= */

  test('v1.72 자세 비교: 점프 예시 1·2구간 시간이 겹치지 않는다', function () {
    var P = BM.pose;
    var packs = P.demoJump();
    eq(packs.length, 2, '두 구간');
    eq(P.segTime(packs[0].seg), '0.0~1.5초', '1구간');
    eq(P.segTime(packs[1].seg), '1.5~3.0초', '2구간은 이어서');
    ok(packs[1].seg.start === packs[0].seg.end, '구간이 이어진다');
    eq(packs[1].frames[0].t, 1.5, '2구간 프레임도 1.5초에서 시작');
    ok(packs[0].frames[0].t === 0, '1구간은 0초');
    /* 분석 결과는 그대로 — 좋은 예 / 늦은 예 */
    eq(P.segSummary({ seg: packs[0].seg, frames: packs[0].frames, analysis: P.analyzeSegment(packs[0].frames, 'smash'), track: 0 }).text, '좋아요', '1구간');
  });

  test('v1.72 자세 비교: 예시를 본 뒤에도 다른 예시로 바꾸는 버튼이 남는다', function () {
    var P = BM.pose;
    P._analyzeDemo('smash');
    var html = P.statusHtml();
    includes(html, 'data-pose-demo=""', '기본 예시');
    includes(html, 'data-pose-demo="jump"', '점프 예시');
    includes(html, 'data-pose-demo="duo"', '복식 예시');
    includes(html, '다른 예시로 바로 바꿀 수 있어요', '안내');
    includes(html, 'is-on', '지금 본 예시 표시');
    /* 풋워크 모드에는 점프 예시가 없다 */
    P._setMode('foot');
    var foot = P.statusHtml();
    includes(foot, 'data-pose-demo="duo"', '풋워크도 예시 전환');
    excludes(foot, 'data-pose-demo="jump"', '풋워크에 점프 예시 없음');
  });

  /* =========================================================
   * ⑦ 배포 버전 — 승인 뒤 sw.js VERSION을 bm-v1.74.0으로 올렸습니다
   * ========================================================= */

  test('v1.72 배포: sw.js VERSION이 지금 배포 버전이고 테스트 목록에 등록돼 있다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.83.0'", '버전');
    includes(readRoot('test/run.js'), 'test/morning-ux.test.js', '테스트 목록에 등록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
