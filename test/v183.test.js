/* ============================================================
 * test/v183.test.js — bm-v1.86.0
 *   🤖 피로 점프 · 무릎-허리 연쇄 보호 AI 고도화
 *
 *   1) 피로 점프 — 컨디션 낮음/최근 센 훈련 누적 + 점프·스매시 → 전환 경고 + 네트·스텝 드릴
 *   2) 연쇄 보호 — 무릎·허리 통증 → 허벅지 뒤 스트레칭 + 양쪽 사이드 플랭크 처방
 *   3) 화면     — '피로할 때 점프 스매시' 접기 · 관절 보호 체크 안 연쇄 블록(쉬운 말만)
 *   4) 보호     — 기존 세 블록(어깨·무릎/발목·팔꿈치/손목)과 3드릴·시트 JSON 그대로
 *   5) 버전     — sw · app · push · styles 캐시 · TWA · README · 테스트 목록
 *
 *   실행: node test/run.js
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
  function readJson(file) { return JSON.parse(readRoot(file)); }

  /* 오늘로부터 n일 전 날짜 */
  function day(n) {
    return U.ymd(U.addDays(U.parseYmd(U.ymd()), -n));
  }

  function analyze(draft, records) {
    return AI.analyze({
      draft: draft, records: records || [], level: 'B조', nick: '승우', discipline: '복식'
    });
  }

  function noticeText(an) {
    return (an.insights || []).map(function (i) { return i.label + ' ' + i.detail; }).join(' \n ');
  }

  /* =========================================================
   * 1. 피로 점프 — 컨디션 낮음 + 점프 스매시
   * ========================================================= */
  test('v1.83 피로 점프: 컨디션 4 이하인데 스매시를 고르면 점프 낮아짐·착지 충격을 알린다', function () {
    var an = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'] });
    ok(an.jump && an.jump.on, '피로 점프 카드가 켜진다');
    eq(an.jump.level, 'low', '낮은 컨디션 이유');
    includes(an.jump.reason, '점프가 평소보다 낮아지고', '점프 높이 저하');
    includes(an.jump.reason, '착지할 때 무릎·발목 충격이 커져요', '착지 충격');
    includes(an.jump.reason, '네트 앞 짧은 볼', '네트 앞 전환');
    includes(an.jump.reason, '안정적인 풋워크', '풋워크 전환');
    /* 진단에도 같은 문장이 뜬다 */
    var text = noticeText(an);
    includes(text, '피로 점프 주의', '진단 항목');
    includes(text, '점프가 평소보다 낮아지고', '진단 문장');
  });

  test('v1.83 피로 점프: 경고와 함께 네트 앞·낮은 스텝 드릴로 바꿔 준다(3개 그대로)', function () {
    var an = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'] });
    eq(an.drills.drills.length, 3, '드릴은 여전히 3개');
    var names = an.drills.drills.map(function (d) { return d.name; });
    includes(names.join(' · '), '네트 앞', '네트 앞 드릴로 교체');
    excludes(names.join(' · '), '점프 스매시 착지 밸런스', '점프 드릴은 빠진다');
    includes(an.drills.note, '네트 앞·스텝 드릴로 바꿨어요', '왜 바꿨는지 한 줄');
    ok(an.drills.jumpSwapped.length, '바뀐 드릴 이름을 남긴다');
    /* 맞춤 처방(회복)에도 후반 전환 한 줄 */
    includes(an.care.rehab.join(' '), '네트 앞 짧은 볼', '회복 처방에 전환');
  });

  test('v1.83 피로 점프: 최근 3일에 센 훈련이 쌓였어도 같은 경고(이유는 다르게)', function () {
    var recs = [
      { date: day(1), cond: 7, intensity: 9, minutes: 110, weakness: ['스매시'] },
      { date: day(2), cond: 6, intensity: 8, minutes: 100, weakness: ['풋워크'] }
    ];
    var an = analyze({ cond: 7, intensity: 7, minutes: 60, weakness: ['스매시'] }, recs);
    ok(an.jump.on, '누적 피로로 켜진다');
    eq(an.jump.level, 'load', '부하 누적 이유');
    includes(an.jump.reason, '요 며칠 센 훈련이 이어져', '누적 문장');
    includes(an.jump.reason, '점프가 평소보다 낮아지고', '같은 근거');
  });

  test('v1.83 피로 점프: 컨디션 좋고 최근 부하도 낮으면 조용하다(드릴도 그대로)', function () {
    var an = analyze({ cond: 8, intensity: 6, minutes: 60, weakness: ['스매시'] });
    eq(an.jump.on, false, '경고 없음');
    eq(an.insights.length <= 6, true, '진단 개수 그대로');
    excludes(noticeText(an), '피로 점프', '진단에 없음');
    includes(an.drills.drills.map(function (d) { return d.name; }).join(' '), '점프 스매시 착지 밸런스', '기존 드릴 유지');
    eq(an.drills.note, '', '바꿈 안내 없음');
  });

  test('v1.83 피로 점프: 다리 통증이 있으면 점프 경고 대신 통증 중단 기준이 먼저다', function () {
    var an = analyze({ cond: 3, intensity: 7, minutes: 60, weakness: ['스매시'], pain: ['무릎'] });
    eq(an.jump.on, false, '통증 있는 날은 끔');
    includes(an.risk[0].text, '바로 코트를 멈추고', '점검 맨 앞은 통증 기준');
    eq(an.care.rehab[0], AI.PAIN_RULE.stop, '회복 처방도 통증 기준이 먼저');
    includes(an.drills.note, '무릎', '드릴 교체 안내는 통증 기준');
  });

  test('v1.83 피로 점프: 점프·스매시를 고르지 않은 날은 컨디션이 낮아도 켜지지 않는다', function () {
    var an = analyze({ cond: 2, intensity: 5, minutes: 40, weakness: ['헤어핀'] });
    eq(an.jump.on, false, '스매시·점프가 아니면 끔');
    eq(AI.fatigueJump(2, ['헤어핀'], {}).on, false, '순수 함수도 같은 판단');
    eq(AI.fatigueJump(2, ['점프'], {}).on, true, "'점프'를 골라도 켜진다");
    eq(AI.fatigueJump(7, ['스매시'], { recentHard: 0 }).on, false, '컨디션 좋고 부하 없음');
    eq(AI.fatigueJump(7, ['스매시'], { recentHard: 2 }).on, true, '최근 센 훈련 2번');
    eq(AI.fatigueJump(7, ['스매시'], { load: { zone: 'spike' } }).on, true, '주간 부하 급증');
    eq(AI.fatigueJump(3, ['스매시'], { pain: ['무릎'] }).on, false, '다리 통증 우선');
  });

  test('v1.83 피로 점프: 같은 입력이면 항상 같은 문장·드릴(결정적)', function () {
    var a = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'] });
    var b = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'] });
    eq(JSON.stringify(a.jump), JSON.stringify(b.jump), '피로 점프 카드');
    eq(JSON.stringify(a.drills), JSON.stringify(b.drills), '드릴 교체');
  });

  /* =========================================================
   * 2. 무릎 → 허리 연쇄 보호
   * ========================================================= */
  test('v1.83 연쇄 보호: 무릎 통증이면 허리까지 이어질 수 있다고 알리고 스트레칭·사이드 플랭크를 준다', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 50, weakness: ['풋워크'], pain: ['무릎'] });
    var ch = an.guard.chain;
    ok(ch && ch.on, '연쇄 블록이 켜진다');
    eq(ch.level, 'knee', '무릎에서 시작');
    includes(ch.reason, '무릎이 불편하거나 허벅지 뒤쪽이 뻣뻣하면', '연쇄 설명');
    includes(ch.reason, '몸통 힘이 떨어져 허리까지 아파질 수 있어요', '허리까지 이어짐');
    includes(ch.reason, '허벅지 뒤 스트레칭', '햄스트링 스트레칭');
    includes(ch.reason, '양쪽 균형 코어 버티기(사이드 플랭크)', '사이드 플랭크');
    var guides = (ch.guides || []).map(function (g) { return g.name + ' ' + g.how; }).join(' ');
    includes(guides, '허벅지 뒤 스트레칭', '오늘 할 것 1');
    includes(guides, '사이드 플랭크', '오늘 할 것 2');
    includes(guides, '엉덩이 들기', '오늘 할 것 3');
    /* 맞춤 처방 스트레칭에도 한 줄 */
    includes(an.care.stretch.join(' '), '사이드 플랭크', '스트레칭 처방');
  });

  test('v1.83 연쇄 보호: 허리 통증이면 허리에서 시작한 문장으로 같은 처방', function () {
    var ch = AI.guardChain(['허리']);
    ok(ch.on, '켜진다');
    eq(ch.level, 'back', '허리에서 시작');
    includes(ch.reason, '허리가 불편한 날은', '허리 문장');
    includes(ch.reason, '양쪽 균형 코어 버티기(사이드 플랭크)', '같은 처방');
    var an = analyze({ cond: 6, intensity: 5, minutes: 50, pain: ['허리'] });
    ok(an.guard.chain.on, 'analyze 에서도 켜진다');
    includes(an.care.stretch.join(' '), '허벅지 뒤 스트레칭', '처방 스트레칭');
  });

  test('v1.83 연쇄 보호: 최근 일지에 무릎 통증이 반복되면 오늘 통증이 없어도 켜진다', function () {
    var recs = [
      { date: day(4), cond: 6, intensity: 6, minutes: 50, pain: ['무릎'] },
      { date: day(9), cond: 6, intensity: 6, minutes: 50, pain: ['무릎'] },
      { date: day(14), cond: 6, intensity: 6, minutes: 50, pain: ['무릎'] }
    ];
    var an = analyze({ cond: 7, intensity: 6, minutes: 50, weakness: ['풋워크'] }, recs);
    ok(an.guard.chain.on, '반복 무릎 통증으로 켜짐');
    includes(an.guard.chain.reason, '허리까지 아파질 수 있어요', '연쇄 안내 유지');
  });

  test('v1.83 연쇄 보호: 무릎·허리 통증이 없으면 블록이 꺼져 있다(기존 화면 그대로)', function () {
    eq(AI.guardChain([]).on, false, '빈 목록');
    eq(AI.guardChain(['어깨']).on, false, '어깨만');
    var an = analyze({ cond: 7, intensity: 6, minutes: 60, weakness: ['드라이브'] });
    eq(an.guard.chain.on, false, '오늘 블록 꺼짐');
    eq(an.guard.chain.reason, '', '문장 없음');
    excludes(JSON.stringify(an.care), '사이드 플랭크', '처방에 안 섞임');
  });

  /* =========================================================
   * 3. 화면 — 새 접기와 블록이 실제로 그려진다
   * ========================================================= */
  test('v1.83 화면: 피로한 날은 AI 카드에 "피로할 때 점프 스매시" 접기가 나온다', function () {
    var an = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'] });
    var html = BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
    includes(html, 'data-fold="jump"', '새 접기');
    includes(html, '피로할 때 점프 스매시', '제목');
    includes(html, '오늘은 이렇게 바꿔 보세요', '바꿔 할 드릴');
    includes(html, '참고 논문 · Cheng 2024', '참고 논문 한 줄');

    var plain = analyze({ cond: 8, intensity: 6, minutes: 60, weakness: ['스매시'] });
    excludes(BM.views.log.analysisCard(plain, { ui: {}, data: { records: [] } }), 'data-fold="jump"', '조건이 아니면 안 나옴');
  });

  test('v1.83 화면: 관절 보호 체크 안에 무릎→허리 연쇄 블록이 함께 보인다', function () {
    var an = analyze({ cond: 7, intensity: 6, minutes: 50, weakness: ['풋워크'], pain: ['무릎'] });
    var html = BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
    includes(html, 'data-fold="guard"', '관절 보호 체크');
    includes(html, '무릎 → 허리 연쇄 보호', '연쇄 블록 제목');
    includes(html, '양쪽 균형 코어 버티기(사이드 플랭크)', '쉬운 처방 문장');
    includes(html, '참고 논문 · Apriantono 2023', '참고 논문 한 줄');
  });

  test('v1.83 화면: 새 문구에 어려운 의학 용어를 쓰지 않는다', function () {
    var an = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'], pain: ['무릎'] });
    var shown = [an.jump.reason].concat((an.jump.guides || []).map(function (g) { return g.name + ' ' + g.how; }))
      .concat((an.jump.thresholds || []))
      .concat([an.guard.chain.reason])
      .concat((an.guard.chain.guides || []).map(function (g) { return g.name + ' ' + g.how; }))
      .concat((an.guard.chain.thresholds || []))
      .join(' ');
    ['가속도', 'LBP', '생체역학', '굴곡', '유연성 저하', '비대칭'].forEach(function (w) {
      excludes(shown, w, '쉬운 말만: ' + w);
    });
    includes(shown, '허벅지 뒤', '쉬운 말 사용');
  });

  /* =========================================================
   * 4. 보호 — 기존 세 블록·드릴·시트 JSON 그대로
   * ========================================================= */
  test('v1.83 보호: 기존 어깨·무릎/발목·팔꿈치/손목 블록과 3드릴·시트 JSON 이 그대로다', function () {
    var sh = analyze({ cond: 7, intensity: 6, minutes: 50, pain: ['어깨'], weakness: ['스매시'] });
    ok(sh.guard.shoulder.on, '어깨 블록');
    includes(sh.guard.shoulder.reason, '바로 코트를 멈추고', '기존 문구');
    eq(sh.drills.drills.length, 3, '드릴 3개');
    var patch = JSON.parse(sh.sheetPatch['맞춤처방']);
    ok(patch.rehab && patch.stretch && patch.mental && patch.warmup, '맞춤처방 JSON 모양 그대로');
    eq(JSON.parse(sh.sheetPatch['추천드릴']).drills.length, 3, '추천드릴 JSON 모양 그대로');

    var arm = analyze({ cond: 7, intensity: 8, minutes: 100, pain: ['팔꿈치'], weakness: ['스매시'] });
    ok(arm.guard.arm.on, '팔꿈치 블록');
    includes(arm.care.rehab.join(' '), '천천히 내리기', '기존 근력 처방 유지');

    var foot = analyze({ cond: 7, intensity: 5, minutes: 40, weakness: ['풋워크'] });
    ok(foot.guard.lower.on, '풋워크 날 무릎·발목 블록');
  });

  test('v1.83 보호: 5개 탭 · 시트 26칸 · 하트 RPC · 3D 라켓 · 지도 · 매칭 ON 배지 그대로', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    includes(app, 'TABS', '탭 목록');
    var cols = BM.domain.COL || {};
    eq(Object.keys(cols).length, 26, '시트 26칸');
    var sql = readRoot('supabase/heart-rpc-v1.82-smash.sql');
    includes(sql, 'heart_spend', '하트 RPC');
    includes(readRoot('js/racketcustom.js'), 'function miniHtml', '3D 라켓');
    includes(readRoot('js/views/gyms.js'), '길찾기', '지도 길찾기');
    includes(readRoot('app.js'), 'matchpill', '매칭 ON 배지');
    includes(readRoot('js/ai.js'), 'bm-v1.83.0', '근거 주석에 버전 표기');
  });

  test('v1.83 보호: 새 코드·문구에 실존 선수 이름이 없다', function () {
    if (!hasNode) return;
    /* 이름을 글자로 박아 두면 이 테스트 파일 자체가 이름을 담게 되므로 조각으로 만듭니다 */
    var banned = ['김' + '원호', '안' + '세영', '서' + '승재'];
    ['js/ai.js', 'js/views/log.js'].forEach(function (f) {
      var src = readRoot(f);
      banned.forEach(function (n) { excludes(src, n, f + ' 실존 선수 이름'); });
    });
    var an = analyze({ cond: 3, intensity: 6, minutes: 50, weakness: ['스매시'], pain: ['무릎'] });
    var html = BM.views.log.analysisCard(an, { ui: {}, data: { records: [] } });
    banned.forEach(function (n) { excludes(html, n, '화면 실존 선수 이름'); });
  });

  /* =========================================================
   * 5. 버전 — sw · app · push · styles · TWA · README · 목록
   * ========================================================= */
  test('v1.83 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.86.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.86.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.86.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261126-8', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.86.0', 'TWA 이름');
    eq(twa.appVersion, '1.86.0', 'TWA appVersion');
    eq(twa.appVersionCode, 80, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.86.0', 'README');
    includes(readRoot('test/run.js'), 'test/v183.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
