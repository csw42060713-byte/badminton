/* ============================================================
 * test/v194.test.js — bm-v1.96.0
 *
 *   1) 드라이브 실전 노하우 — 사용자 제보(2026-11-27)
 *      "드라이브 칠 때 검지 손가락에 신경 써서 힘을 주고, 끊어 치지 않고 스윙을 짧게 한다"
 *      → 드라이브 드릴 · 약점 코칭 · 복식 드라이브 싸움 전술에 같은 문장으로 들어간다.
 *   2) 초구 기준 — "초구는 지선(직선) 가운데로 누르는 게 기본"
 *      → 단식·복식 리시브 전술과 서브 리시브 드릴(화면에 보이는 전술 노트 포함)에 들어간다.
 *   3) 셔틀콕 머리(코르크) — 흰 코르크 + 빨강 밴드 + 검정 링 + 실밥, 반구가 아닌 덩어리.
 *   4) 효과 업그레이드 — 점이 아닌 방향성 빛줄기(streak) + 코어 광휘, 성능 상한 유지.
 *   5) 치는 맛 — 라켓 휨·반동 · 별섬광 · 셔틀 스쿼시&스트레치 · 타격음 보강.
 *   6) 거트 만료 — 교체 시기가 지나면 3D 거트가 세로 3가닥·가로 1가닥 끊겨 삐져나오고,
 *      '오늘 갈았어요'(strungAt=오늘)로 바로 최상으로 돌아온다.
 *   7) 버전 — sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var AI = BM.ai, RC = BM.racketcustom, R3 = BM.racket3d, SND = BM.smashsound;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function ymdAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return U.ymd(d);
  }

  function stateWithGear(gear, daysAgoLog) {
    var rows = [];
    if (daysAgoLog != null) {
      rows.push({ type: '기록', id: 'x', clientId: 'x', createdAt: ymdAgo(daysAgoLog) + ' 10:00:00',
        userKey: ME.key, nick: '나래', date: ymdAgo(daysAgoLog), minutes: 60 });
    }
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME), drafts: {}, ui: {}
    };
    if (gear) st.me.theme = { theme: 'th_night', avatar: '🦋', gear: gear };
    return st;
  }

  var driveDrill = function () {
    return AI.DRILLS['드라이브'].filter(function (d) { return d.name === '드라이브 기본 반복'; })[0];
  };

  /* ============================================================
   * 1. 드라이브 — 검지에 힘 · 짧은 스윙
   * ============================================================ */

  test('v1.94 드라이브: 제보 문장이 한 곳(PRO_DRIVE)에 정리되어 있다', function () {
    ok(AI.PRO_DRIVE, 'PRO_DRIVE 상수');
    includes(AI.PRO_DRIVE.finger, '검지', '검지 손가락');
    includes(AI.PRO_DRIVE.finger, '힘', '힘을 실어');
    includes(AI.PRO_DRIVE.short, '끊어 치지', '끊어 치지 않고');
    includes(AI.PRO_DRIVE.short, '짧게', '스윙을 짧게');
    includes(AI.PRO_DRIVE.push, '짧은 스윙', '짧은 스윙');
    includes(AI.PRO_DRIVE.push, '밀어', '밀어 치기');
    includes(AI.PRO_DRIVE.first, '초구', '초구');
    includes(AI.PRO_DRIVE.first, '직선 가운데', '직선 가운데');
    includes(AI.PRO_DRIVE.source, '체전 1등 선수 현장 기준', '출처 표기');
    includes(AI.PRO_DRIVE.source, '2026-11-27', '제보 날짜');
  });

  test('v1.94 드라이브: 드릴에 검지·짧은 스윙이 들어가고 초보자도 읽힌다', function () {
    var d = driveDrill();
    ok(d, '드라이브 기본 반복 드릴');
    includes(d.method, '검지', '방법: 검지');
    includes(d.method, '짧게', '방법: 짧게');
    includes(d.method, '끊어 치지', '방법: 끊어 치지');
    includes(d.point, '검지', '포인트: 검지');
    includes(d.point, '짧은 스윙', '포인트: 짧은 스윙');
    /* 3구 연결에서도 같은 감각을 한 번 더 — 랠리 중에 크게 휘두르지 않기 */
    var three = AI.DRILLS['드라이브'].filter(function (x) { return x.name === '드라이브 연결 3구'; })[0];
    includes(three.method, '짧은 스윙', '3구: 짧은 스윙');
    /* 급수별 세트 수는 그대로 (기존 코칭 보호) */
    ok(AI.setsFor(d, '초심') && AI.setsFor(d, '자강'), '급수별 세트 유지');
    ok(AI.setsFor(d, '초심') !== AI.setsFor(d, '자강'), '급수별로 다르다');
  });

  test('v1.94 드라이브: 약점 코칭·복식 드라이브 싸움 전술에도 같은 노하우', function () {
    var focus = AI.senseFocus(['드라이브']);
    ok(focus, '드라이브 약점 한 줄');
    includes(focus.text, '드라이브 10분', '기존 안내 유지');
    includes(focus.text, '검지', '검지');
    includes(focus.text, '짧은 스윙', '짧은 스윙');
    includes(focus.text, '체전 1등 선수 현장 기준', '출처');

    var battle = AI.TACTICS['복식'].filter(function (x) { return x.indexOf('드라이브 싸움') >= 0; })[0];
    ok(battle, '복식 드라이브 싸움 전술');
    includes(battle, '중앙(두 선수 사이)', '기존 중앙 겨냥 유지');
    includes(battle, '검지', '검지');
    includes(battle, '짧은 스윙', '짧은 스윙');
    includes(battle, '체전 1등 선수 현장 기준', '출처');
  });

  test('v1.94 드라이브: 약점으로 고르면 추천 드릴에 그대로 나온다', function () {
    var an = AI.analyze({ draft: { weakness: ['드라이브'], discipline: '복식' }, records: [], level: 'C조' });
    var text = (an.drills.drills || []).map(function (d) { return d.method + ' ' + d.point; }).join(' ');
    includes(text, '검지', '추천 드릴 카드에 검지');
    includes(text, '짧은 스윙', '추천 드릴 카드에 짧은 스윙');
  });

  /* ============================================================
   * 2. 초구 — 직선 가운데로 누르기
   * ============================================================ */

  test('v1.94 초구: 단식·복식 리시브 전술과 서브 리시브 드릴에 들어간다', function () {
    ['단식', '복식'].forEach(function (d) {
      var line = AI.TACTICS[d].filter(function (x) { return x.indexOf('리시브') >= 0; })[0];
      ok(line, d + ' 리시브 전술');
      includes(line, '초구', d + ': 초구');
      includes(line, '직선 가운데', d + ': 직선 가운데');
      includes(line, '체전 1등 선수 현장 기준', d + ': 출처');
    });
    var recv = AI.DRILLS['리시브'].filter(function (x) { return x.name === '서브 리시브 코스'; })[0];
    includes(recv.method, '초구', '리시브 드릴: 초구');
    includes(recv.method, '직선 가운데', '리시브 드릴: 직선 가운데');
    includes(recv.point, '초구', '리시브 드릴 포인트');
    /* 국내 국가대표 리시브 수치는 그대로 (기존 근거 보호) */
    includes(recv.method, '38~46%', '리시브 수치 유지');
  });

  test('v1.94 초구: 화면에 보이는 전술 노트(복식 3개·단식 3개) 안에 있다', function () {
    /* playbook 은 급수에 따라 앞 2~3개만 보여 줍니다 — 초구가 실제로 보이는 자리에 있어야 합니다 */
    includes(AI.playbook('복식', 'A조').tips.join(' '), '직선 가운데', '복식 전술 노트');
    includes(AI.playbook('단식', 'A조').tips.join(' '), '직선 가운데', '단식 전술 노트');
    includes(AI.playbook('복식', 'A조').tips.join(' '), '초구', '복식 초구');
    includes(AI.playbook('단식', 'A조').tips.join(' '), '초구', '단식 초구');
    /* 복식은 드라이브 싸움 한 줄을 더해 4줄 — 그 줄에 검지·짧은 스윙이 보인다 */
    var dbl = AI.playbook('복식', 'A조');
    eq(dbl.tips.length, 4, '복식 전술 4줄');
    includes(dbl.tips.join(' '), '드라이브 싸움', '드라이브 싸움 줄 표시');
    includes(dbl.tips.join(' '), '검지', '전술 노트에 검지');
    eq(AI.playbook('복식', '초심').tips.length, 2, '초심은 2개 유지');
    eq(AI.playbook('단식', 'A조').tips.length, 3, '단식은 3개 그대로');
  });

  test('v1.94 출처: 실존 선수 이름 없이 현장 기준으로만 적는다', function () {
    if (!hasNode) return;
    var js = readRoot('js/ai.js');
    ['김원호', '안세영', '서승재', '김소영', '공희용'].forEach(function (n) {
      excludes(js, n, 'js/ai.js 에 ' + n + ' 없음');
    });
    includes(js, '체전 1등 선수 현장 기준(2026-11-27)', '제보 출처 표기');
  });

  /* ============================================================
   * 3. 셔틀콕 머리(코르크) — 보이게
   * ============================================================ */

  test('v1.94 셔틀: 흰 코르크 덩어리 + 빨강·검정 밴드 + 실밥 링', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'function buildShuttle', '셔틀콕 모델');
    /* 반구(phi 범위를 잘라 낸 구)가 아니라 온전한 구 — 어느 각도에서도 머리가 있다 */
    includes(js, 'new T.SphereGeometry(12.0, 32, 24)', '온전한 코르크 구');
    excludes(js, 'SphereGeometry(6.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62)', '반구 코드 제거');
    includes(js, "'#fbf7ec'", '흰 코르크 색');
    includes(js, "'#cf3b2f'", '빨강 밴드');
    includes(js, "'#17181a'", '검정 얇은 링');
    includes(js, 'CylinderGeometry(12.1, 12.35, 3.4, 34)', '빨강 밴드 크기');
    includes(js, 'CylinderGeometry(12.42, 12.46, 1.2, 34)', '검정 링');
    includes(js, 'TorusGeometry(11.9, 0.55, 6, 40)', '실밥 링');
    includes(js, 'emissiveIntensity: 0.35', '어두운 배경에서도 보이는 코르크 발광');
    includes(js, 'var N = 16', '깃 16장 유지');
    includes(js, 'g.userData.cork = cork', '코르크 참조 보존');
  });

  test('v1.94 셔틀: 공개 API 로 셔틀 모델을 그대로 만들 수 있다', function () {
    eq(typeof R3.buildShuttle, 'function', 'buildShuttle 공개');
    eq(typeof R3.brokenStringPlan, 'function', 'brokenStringPlan 공개');
    eq(R3.rev, '1.96.0', '3D 모듈 리비전');
  });

  /* ============================================================
   * 4. 효과 — 점이 아닌 빛줄기
   * ============================================================ */

  test('v1.94 효과: 7종 모두 코어 광휘 + 방향성 빛줄기를 함께 쓴다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'function streakTexture', '빛줄기 텍스처');
    includes(js, 'function buildStreaks', '빛줄기 생성');
    includes(js, "out.bits.push({ streaks: streaks, mode: 'streak'", '효과에 빛줄기 연결');
    includes(js, "out.bits.push({ core: core, mode: 'fxcore'", '코어 광휘');
    includes(js, 'destination-in', '가운데만 남기는 마스크');
    /* 성능 — 효과당 빛줄기는 16장을 넘지 않는다 (60fps 예산) */
    includes(js, "id === 'speed' ? 16", '스피드는 16장');
    includes(js, "id === 'blaze' || id === 'fire' ? 14", '불 계열 14장');
    ['fire', 'ice', 'thunder', 'blaze', 'spark', 'speed', 'prism'].forEach(function (id) {
      ok(js.indexOf("id === '" + id + "'") >= 0, id + ' 효과 분기 유지');
    });
  });

  /* ============================================================
   * 5. 치는 맛 — 휨·별섬광·스쿼시·소리
   * ============================================================ */

  test('v1.94 타격감: 라켓 휨·반동 · 별섬광 · 셔틀 스쿼시&스트레치', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, '정타 반동', '라켓 반동 주석');
    includes(js, 'swingG.rotation.z += wob * 0.055', '헤드가 휘었다 돌아오는 진동');
    includes(js, 'modelG.position.x = wob * 10', '헤드 옆으로 밀리는 반동');
    includes(js, 'function starTexture', '별섬광 텍스처');
    includes(js, 'var star = new T.Sprite', '별섬광 스프라이트');
    includes(js, "star.material.opacity = 0.95 * (1 - stk) * (1 - stk)", '별섬광 감쇠');
    includes(js, '스쿼시 & 스트레치', '스쿼시 주석');
    includes(js, '(1.25 + tr * 1.2) * (1 - sq * 0.62)', '진행 축 압축');
    includes(js, '1.25 * (1 + sq * 0.62)', '옆으로 부풀기');
    /* 정리 — 연출이 끝나면 별섬광이 남지 않는다 */
    includes(js, 'star.visible = false;', '연출 종료 시 숨김');
  });

  test('v1.94 타격감: 정타음이 더 묵직하고 거트 잔결이 붙는다', function () {
    includes(readRoot('js/smashsound.js'), 'var VOLUME = 0.46;', '전체 음량');
    var base = SND.layers('none');
    ok(base.length >= 6, '기본 정타 층이 늘었다 (' + base.length + ')');
    var low = base.filter(function (l) { return l.kind === 'tone' && l.freq <= 100 && l.at >= SND.HIT_AT; });
    ok(low.length >= 1, '몸통에 남는 낮은 울림');
    var tail = base.filter(function (l) { return l.kind === 'noise' && l.q >= 2.2 && l.at >= SND.HIT_AT; });
    ok(tail.length >= 1, '거트 찢어지는 잔결');
    /* 효과별 소리는 여전히 서로 다르다 */
    var sigs = ['none', 'fire', 'ice', 'thunder'].map(function (id) { return SND.signature(id, 'air'); });
    eq(Object.keys(sigs.reduce(function (a, s) { a[s] = 1; return a; }, {})).length, 4, '효과별 소리 구분 유지');
  });

  /* ============================================================
   * 6. 거트 만료 — 3D 거트가 실제로 끊어져 삐져나온다
   * ============================================================ */

  test('v1.94 거트: 교체 시기가 지나면 상태가 broken 이 된다', function () {
    var due = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 30 };
    eq(RC.conditionOf(stateWithGear(due, 0)).level, 'broken', '교체 시기 지남 → 끊어짐');
    var soon = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: ymdAgo(28), cycleDays: 30 };
    eq(RC.conditionOf(stateWithGear(soon, 0)).level, 'worn', '곧 교체 → 느슨');
  });

  test('v1.94 거트: 끊긴 배치는 세로 3가닥 · 가로 1가닥이고 서로 벌어진다', function () {
    var plan = R3.brokenStringPlan(19, 21);
    eq(plan.mains.length, 3, '세로줄 3가닥');
    eq(plan.crosses.length, 1, '가로줄 1가닥');
    var seen = {};
    plan.mains.forEach(function (c) {
      ok(c.i >= 0 && c.i < 19, '세로줄 번호 범위');
      ok(seen[c.i] == null, '같은 줄을 두 번 끊지 않는다');
      seen[c.i] = 1;
      ok(c.gap >= 6, '끊긴 틈이 눈에 보인다 (' + c.gap + ')');
      ok(c.swing !== 0, '좌우로 벌어지는 방향');
    });
    /* 가운데 근처에서 끊긴다 — 헤드 중심에서 멀지 않게 */
    plan.mains.forEach(function (c) { ok(Math.abs(c.i - 9) <= 3, '가운데 근처'); });
    var empty = R3.brokenStringPlan(0, 0);
    eq(empty.mains.length, 0, '줄이 없으면 끊을 것도 없다');
    eq(empty.crosses.length, 0, '가로줄도 없음');
  });

  test('v1.94 거트: 3D 모델이 끊긴 줄을 그리고, 2D 는 기존대로 좌우 두 동강', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'var cutPlan = brokenStringPlan(mainPts.length, crossPts.length)', '끊긴 줄 배치 사용');
    includes(js, 'splay(aHalf, false, c.gap, c.swing, false)', '세로줄 끊긴 끝 벌리기');
    includes(js, 'splay(aHalf, false, c.gap, c.swing, true)', '가로줄 끊긴 끝 벌리기');
    includes(js, 'frayTip(aHalf[aHalf.length - 1]', '삐져나온 끝');
    includes(js, 'stringRibbon(T, curl, 0.33, 0)', '끝단 리본');
    var gm = RC.geomOf({ body: 'power77' });
    var okCh = RC.stringChords(gm, 'ok'), br = RC.stringChords(gm, 'broken');
    ok(br.mains.length > okCh.mains.length, '2D 도 끊어진 줄 좌우 두 동강');
    includes(readRoot('js/racketcustom.js'), '가로줄 한 가닥도 끊어져', '2D 가로줄 끊김');
  });

  test('v1.94 거트: "오늘 갈았어요"로 갈면 곧바로 최상으로 돌아온다', function () {
    var due = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 30 };
    eq(RC.conditionOf(stateWithGear(due, 0)).level, 'broken', '갈기 전 끊어짐');
    var fixed = { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: U.ymd(), cycleDays: 30 };
    var st = stateWithGear(fixed, 0);
    eq(RC.conditionOf(st).level, 'prime', '오늘 갈면 최상');
    /* 끊긴 배치는 상태가 broken 일 때만 쓰입니다 */
    includes(readRoot('js/racket3d.js'), "if (look.level === 'broken')", 'broken 일 때만 끊김');
    /* 라켓 상태에 따른 꾸미기 시트 안내도 그대로 */
    eq(RC.conditionOf(stateWithGear(fixed, 0)).level, 'prime', '오늘 갈면 끊어짐 아님');
    ok(BM.gear.statusOf(BM.gear.normalizeGear(fixed)).state === 'ok', '오늘 갈면 due 아님');
  });

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.94 보호: 기존 드릴·부상·웜업·전술 구성이 그대로다', function () {
    eq(AI.DRILLS['드라이브'].length, 4, '드라이브 드릴 4개');
    eq(AI.DRILLS['리시브'].length, 5, '리시브 드릴 5개');
    eq(Object.keys(AI.INJURY).length, 8, '부상 8부위');
    eq(AI.WARMUP.length, 6, '웜업 6단계');
    eq(AI.TACTICS['복식'].length, 7, '복식 전술 7줄');
    eq(AI.TACTICS['단식'].length, 6, '단식 전술 6줄');
    eq(AI.matchDay('복식').switchBlock.steps.length, 3, '복식 전환 3단계 유지');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸 유지');
    eq(R3.available(), false, 'Node(WebGL 없음)은 2D 폴백');
  });

  test('v1.94 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.96.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.96.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.96.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-2', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.96.0', 'TWA 이름');
    eq(twa.appVersion, '1.96.0', 'TWA appVersion');
    eq(twa.appVersionCode, 90, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.96.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v194.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
