/* ============================================================
 * test/v186.test.js — bm-v1.94.0
 *   🔥 실제 타격 순서(날아오기→백스윙→스윙·임팩트→폭발·발사) · 진짜 불·얼음 · 실제 규격 라켓·셔틀콕
 *   · 라켓 모션 칩 3종(하트로 열기, 관리자 전체 해금) · 버벅임(프레임) 개선
 *
 *   1) 타임라인 — 1단계 0.22~0.28s · 2단계 0.08~0.12s · 히트스톱 20~35ms · 3단계 0.45~0.55s
 *   2) 자세     — 백스윙은 뒤로 젖혀지고, 정타에서 앞으로, 끝나면 제자리
 *   3) 궤적     — 셔틀콕이 멀리서 작게 → 가까이 크게, 정타 뒤 화면 앞으로 커지며 퇴장
 *   4) 규격     — 라켓(675mm · 헤드 35~36% · 폭 81%) · 셔틀콕(코르크 26 · 깃 64 · 스커트 62)
 *   5) 효과     — 불·얼음·번개가 오프스크린 스프라이트(가산 합성)로 그려진다(프레임 그라데이션 없음)
 *   6) 모션     — 3종 · 하트 1/2/3 · 첫 탭 미리보기 · 관리자 해금 · 서버 가격표(motion:...)
 *   7) 보호·버전
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var RC = BM.racketcustom;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  /* ============================================================
   * 1. 타임라인 — 실제 타격 3단계
   * ============================================================ */

  test('v1.86 타임라인: 1단계 0.22~0.28s · 2단계 0.08~0.12s · 히트스톱 20~35ms · 3단계 0.45~0.55s', function () {
    ok(RC.WIND_MS >= 220 && RC.WIND_MS <= 280, '1단계 ' + RC.WIND_MS + 'ms');
    ok(RC.SWING_MS >= 80 && RC.SWING_MS <= 120, '2단계 ' + RC.SWING_MS + 'ms');
    ok(RC.HITSTOP_MS >= 20 && RC.HITSTOP_MS <= 35, '히트스톱 ' + RC.HITSTOP_MS + 'ms');
    ok(RC.BOOM_MS >= 450 && RC.BOOM_MS <= 550, '3단계 ' + RC.BOOM_MS + 'ms');
    eq(RC.HIT_AT, RC.WIND_MS + RC.SWING_MS, '임팩트 = 1단계 + 2단계');
    ok(RC.SMASH_MS >= 1000, '연출 전체 ' + RC.SMASH_MS + 'ms');
  });

  test('v1.86 타임라인: 히트스톱 동안 화면 시계가 멈췄다가 이어지고, 단계가 0→1→2 로 넘어간다', function () {
    eq(RC.smashClock(0), 0, '시작');
    eq(RC.smashClock(RC.WIND_MS - 40), RC.WIND_MS - 40, '1단계는 그대로');
    eq(RC.smashClock(RC.HIT_AT), RC.HIT_AT, '정타 순간');
    eq(RC.smashClock(RC.HIT_AT + 1), RC.HIT_AT, '멈춤 시작');
    eq(RC.smashClock(RC.HIT_AT + RC.HITSTOP_MS), RC.HIT_AT, '멈춤 끝');
    eq(RC.smashClock(RC.HIT_AT + RC.HITSTOP_MS + 10), RC.HIT_AT + 10, '멈춘 만큼 늦게 이어짐');
    eq(RC.smashPhase(RC.WIND_MS - 1), 0, '날아오기');
    eq(RC.smashPhase(RC.WIND_MS + 10), 1, '스윙');
    eq(RC.smashPhase(RC.HIT_AT + 1), 2, '폭발');
  });

  /* ============================================================
   * 2. 라켓 자세 — 백스윙(뒤) → 정타(앞) → 제자리
   * ============================================================ */

  test('v1.86 자세: 백스윙은 뒤로 젖혀지고, 정타에서 앞으로 채찍처럼 넘어간다', function () {
    var start = RC.swingOf(0, 'air');
    eq(start.pitch, 0, '처음엔 제자리');
    var back = RC.swingOf(RC.WIND_MS - 1, 'air');
    ok(back.pitch < -0.3, '백스윙으로 뒤로 젖힘 ' + back.pitch.toFixed(2));
    ok(back.yaw < -0.2, '몸통도 돌아감 ' + back.yaw.toFixed(2));
    var mid = RC.swingOf(RC.WIND_MS + RC.SWING_MS * 0.6, 'air');
    var hit = RC.swingOf(RC.HIT_AT, 'air');
    ok(hit.pitch > back.pitch + 0.7, '정타에서 크게 앞으로 ' + hit.pitch.toFixed(2));
    ok(hit.dx < 0 && back.dx > 0, '머리가 왼쪽·아래로 휩쓸림');
    ok(mid.pitch > back.pitch && mid.pitch < hit.pitch, '중간은 그 사이');
    var after = RC.swingOf(RC.SMASH_MS - 1, 'air');
    ok(Math.abs(after.pitch) < 0.05 && Math.abs(after.yaw) < 0.05, '끝나면 제자리');
    /* 바닥 강타는 더 높이 젖혔다가 더 아래로 */
    var sback = RC.swingOf(RC.WIND_MS - 1, 'slam');
    var shit = RC.swingOf(RC.HIT_AT, 'slam');
    ok(sback.pitch < back.pitch, '강타 백스윙이 더 높다');
    ok(shit.pitch > hit.pitch && shit.dy > hit.dy, '강타는 더 아래로 내려찍는다');
  });

  /* ============================================================
   * 3. 셔틀콕 궤적 — 원근
   * ============================================================ */

  test('v1.86 궤적: 셔틀콕이 멀리서 작게 날아와 정타 지점에서 가장 크고, 타격 뒤 화면 앞으로 커진다', function () {
    var imp = { x: 176, y: 150 };
    var a = RC.shuttlePath(imp, 352, 356, 0, false);
    var b = RC.shuttlePath(imp, 352, 356, 0.5, false);
    var c = RC.shuttlePath(imp, 352, 356, 1, false);
    ok(a.sc < b.sc && b.sc < c.sc, '점점 커진다 ' + a.sc.toFixed(2) + '→' + c.sc.toFixed(2));
    ok(c.y > a.y, '위에서 아래(타점)로 내려온다');
    ok(c.x > a.x, '왼쪽에서 오른쪽으로 들어온다');
    ok(Math.abs(c.x - imp.x) < 1 && Math.abs(c.y - imp.y) < 1, '정타 순간 타점에 정확히');
    /* 에어 스매시 — bm-v1.94.0: 날아온 방향의 반대로 되받아치며 원근으로 작아져 퇴장
     * (예전에는 화면 앞으로 커지며 오른쪽으로 나갔습니다 — 지시에 따라 되받아치기로 바꿈) */
    var l0 = RC.launchPath(imp, 352, 356, 0, false);
    var l1 = RC.launchPath(imp, 352, 356, 1, false);
    ok(l1.sc < l0.sc - 0.3, '멀어지며 작아진다 ' + l0.sc.toFixed(2) + '→' + l1.sc.toFixed(2));
    ok(l1.x < l0.x && l1.y < l0.y, '날아온 쪽(왼쪽 위)으로 되돌아간다');
    /* 바닥 강타 — 코트 바닥(h*0.9)으로 내려찍힌다 */
    var s1 = RC.launchPath(imp, 352, 356, 0.15, true);
    ok(s1.y > imp.y + 100, '아래로 내려찍힘 ' + s1.y.toFixed(0));
  });

  /* ============================================================
   * 4. 실제 규격 — 라켓 675mm · 셔틀콕 BWF
   * ============================================================ */

  test('v1.86 규격: 라켓 전체 675mm · 헤드 35~36% · 헤드 폭 80~82% · 샤프트+콘 34~36% · 그립 29~30%', function () {
    RC.BODY_IDS.forEach(function (id) {
      var g = RC.geomOf({ body: id });
      var head = g.ry * 2, shaft = g.gripY0 - g.ry, grip = g.gripLen;
      var total = head + shaft + grip;
      ok(Math.abs(total - 675) < 6, id + ' 전체 ' + total + 'mm');
      var hp = head / total;
      ok(hp >= 0.345 && hp <= 0.365, id + ' 헤드 ' + (hp * 100).toFixed(1) + '%');
      var wr = (g.rx * 2) / head;
      ok(wr >= 0.79 && wr <= 0.83, id + ' 헤드 폭 비 ' + wr.toFixed(2));
      var sp = shaft / total;
      ok(sp >= 0.33 && sp <= 0.37, id + ' 샤프트+콘 ' + (sp * 100).toFixed(1) + '%');
      var gp = grip / total;
      ok(gp >= 0.285 && gp <= 0.31, id + ' 그립 ' + (gp * 100).toFixed(1) + '%');
      /* 실제처럼 가는 샤프트(지름 6.8~7.6mm대) · G5 그립 */
      ok(g.shaftR * 2 >= 6.6 && g.shaftR * 2 <= 7.8, id + ' 샤프트 지름 ' + (g.shaftR * 2).toFixed(1) + 'mm');
      ok(g.gripR >= 12.8 && g.gripR <= 14.2, id + ' 그립 반지름 ' + g.gripR + 'mm');
    });
  });

  test('v1.86 규격: 셔틀콕 — 코르크 26mm · 깃 64mm · 스커트 62mm(16장 · 2줄 스티치)', function () {
    var s = RC.SHUTTLE_MM;
    eq(s.R * 2, 26, '코르크 지름 26mm');
    ok(s.L >= 62 && s.L <= 68, '깃 길이 ' + s.L + 'mm');
    ok(s.W * 2 >= 58 && s.W * 2 <= 68, '스커트 지름 ' + s.W * 2 + 'mm');
    var ratio = (s.R * 2) / s.L;
    ok(ratio >= 0.38 && ratio <= 0.44, '코르크/깃 비 ' + ratio.toFixed(2));
    var js = readRoot('js/racketcustom.js');
    includes(js, 'n = 16', '깃 16장');
    includes(js, '2줄 실 스티치', '2줄 스티치');
    includes(js, 'rgba(52,124,82,0.9)', '코르크 색 띠');
  });

  /* ============================================================
   * 5. 진짜 불·얼음 — 스프라이트 + 가산 합성
   * ============================================================ */

  test('v1.86 효과: 불·얼음·번개를 오프스크린 캔버스에 한 번 구워 drawImage·lighter 로 그린다', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'function offCv', '오프스크린 캔버스');
    includes(js, 'function bakeFlame', '화염 스프라이트');
    includes(js, 'function bakeIceShard', '얼음 결정 스프라이트');
    includes(js, 'function bakeSmoke', '연기');
    includes(js, 'function bakeFrost', '서리 안개');
    includes(js, "'lighter'", '가산 합성');
    includes(js, 'function maskEdge', '스프라이트 가장자리 페이드');
    includes(js, 'function fxFire', '불꽃 폭발');
    includes(js, 'function fxIce', '얼음 폭발');
    includes(js, 'function fxThunder', '번개');
    includes(js, 'function drawRacketGhosts', '스윙 잔상');
    includes(js, 'destination-out', '불덩이 사이 어두운 틈');
    /* 매 프레임 shadowBlur·그라데이션을 만들지 않는다(버벅임 원인) */
    var live = js.split('\n').filter(function (l) {
      var t2 = l.trim();
      return t2.indexOf('*') !== 0 && l.indexOf('shadowBlur') >= 0;
    });
    eq(live.length, 0, 'shadowBlur 를 쓰지 않는다');
    includes(js, 'function tex(name)', '스프라이트 캐시');
    includes(js, 'function blit(', 'drawImage 헬퍼');
  });

  test('v1.86 효과: 불/얼음/바닥 강타가 그려지고, 스프라이트가 없으면 벡터로 대신 그린다', function () {
    ['fire', 'ice', 'thunder', 'none'].forEach(function (fx) {
      var m = mockCanvas();
      RC.drawSmash(m.ctx, { yaw: -0.4, pitch: 0.1, k: 1, cx: 200, cy: 250, mid: 0, phase: 0 },
        RC.geomOf({}), fx, 420, 400, 520, { kind: 'air' });
      ok(m.log.strokes + m.log.fills.length > 0, fx + ' 그려진다');
    });
    var m2 = mockCanvas();
    RC.drawSmash(m2.ctx, { yaw: -0.4, pitch: 0.1, k: 1, cx: 200, cy: 250, mid: 0, phase: 0 },
      RC.geomOf({}), 'fire', 520, 400, 520, { kind: 'slam' });
    ok(m2.log.strokes > 0, '바닥 강타도 그려진다');
    includes(readRoot('js/racketcustom.js'), 'function drawShards', '스프라이트 없는 환경 폴백');
  });

  test('v1.86 버벅임: 3D 캔버스 dpr 상한 · 뒷면 생략 · 유휴 재렌더 간격', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'Math.min(1.5, (root.devicePixelRatio || 1))', 'dpr 상한 1.5');
    includes(js, '뒷면은 카메라 반대쪽이라 그리지 않습니다', '라켓 뒷면 생략');
    includes(js, 'function grad1(', '그라데이션 캐시');
    includes(js, 'function gradR(', '그라데이션 캐시(원형)');
    includes(js, 'now - lastPaint > (animate ? 50 : 42)', '유휴 재페인트 간격');
  });

  /* ============================================================
   * 6. 라켓 모션 칩 — 하트로 열기
   * ============================================================ */

  test('v1.86 모션: 3종(트위스트·쇼케이스·플립)과 하트 가격 1/2/3', function () {
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종');
    eq(RC.priceOf('motion', 'twist'), 1, '트위스트 ❤1');
    eq(RC.priceOf('motion', 'showcase'), 2, '쇼케이스 ❤2');
    eq(RC.priceOf('motion', 'flip'), 3, '플립 ❤3');
    eq(RC.isPartSlot('motion'), true, '파츠 슬롯으로 인정');
    eq(RC.isPartSlot('body'), true, '바디도');
    eq(RC.isPartSlot('nope'), false, '모르는 슬롯은 아님');
    /* 파츠 탭(SLOTS)에는 넣지 않아 6칸 그대로 */
    eq(RC.SLOTS.length, 6, '파츠 6칸 유지');
    eq(RC.SLOTS.indexOf('motion'), -1, '모션은 파츠 탭이 아니다');
    ok(RC.MOTION_MS.twist > 1500 && RC.MOTION_MS.flip > 1200, '재생 길이');
  });

  test('v1.86 모션: 열린 모션은 다시 쓸 수 있고, 열림 목록(motion:id)이 저장·복원된다', function () {
    var c = RC.normalizeCustom({ unlocked: ['motion:twist'], frame: 'matte' });
    eq(RC.isUnlocked(c, 'motion', 'twist'), true, '산 모션은 열림');
    eq(RC.isUnlocked(c, 'motion', 'flip'), false, '안 산 모션은 잠김');
    eq(c.unlocked.indexOf('motion:twist') >= 0, true, '열림 목록에 남는다');
    var blank = RC.blankCustom();
    eq(RC.isUnlocked(blank, 'motion', 'twist'), false, '처음엔 잠김');
    /* 관리자 — 전체 해금 */
    var st = { me: { key: 'u_admin', email: 'csw42060713@gmail.com', nick: '관리자' }, data: { idx: BM.domain.index([]), hearts: { balance: 0 } }, ui: {} };
    eq(RC.isAdminUser(st), true, '관리자');
    var html = RC.stageHtml(st);
    eq((html.match(/data-rk-motion=/g) || []).length, 3, '칩 3개');
    excludes(html, 'is-lock', '관리자는 잠금 표시 없음');
  });

  test('v1.86 모션: 잠긴 모션 칩은 하트 가격을 보여 주고, 서버 가격표에 motion 행이 있다', function () {
    var st = { me: { key: 'u_me', nick: '나', theme: { theme: 'th_night' } }, data: { idx: BM.domain.index([]), hearts: { balance: 3 } }, ui: {} };
    var html = RC.stageHtml(st);
    eq((html.match(/data-rk-motion=/g) || []).length, 3, '칩 3개');
    includes(html, 'is-lock', '잠김 표시');
    includes(html, '❤ 1', '트위스트 가격');
    includes(html, '❤ 3', '플립 가격');
    var sql = readRoot('supabase/heart-rpc-v1.86-motion.sql');
    includes(sql, "when 'motion:twist'", '트위스트 가격 행');
    includes(sql, "when 'motion:showcase'", '쇼케이스 가격 행');
    includes(sql, "when 'motion:flip'", '플립 가격 행');
    includes(sql, 'create or replace function public.bm_racket_price', '가격표 함수 교체');
    includes(readRoot('js/store.js'), 'isPartSlot', '저장소가 모션 슬롯을 허용');
  });

  test('v1.86 모션 자세: 8자 스핀 · 한 바퀴 훑기 · 공중 360° 플립 + 착지 반동', function () {
    var tw = [0, 0.15, 0.3, 0.45].map(function (p) { return RC.motionPose('twist', p * RC.MOTION_MS.twist); });
    ok(tw[1].yaw > 0.2 && tw[3].yaw < -0.2, '좌우로 8자');
    ok(Math.abs(tw[0].dy) < 1.2, '시작은 제자리');
    /* bm-v1.94.0 — 쇼케이스는 손목으로 한 바퀴(roll 360°): 중간엔 반 바퀴, 끝엔 제자리(2π)
     * (yaw 로만 돌리면 90°/270° 에서 라켓이 칼날처럼 얇아져 사라진 것처럼 보였습니다) */
    var sc = RC.motionPose('showcase', RC.MOTION_MS.showcase * 0.5);
    ok(sc.roll > 2.4 && sc.roll < 4.4, '중간엔 반 바퀴 남짓 ' + sc.roll.toFixed(2));
    ok(Math.abs(sc.yaw) < 0.45, '옆면이 보이게 살짝만 흔들 ' + sc.yaw.toFixed(2));
    var scEnd = RC.motionPose('showcase', RC.MOTION_MS.showcase * 0.85);
    ok(scEnd.roll > 4.4, '한 바퀴를 거의 마쳤다 ' + scEnd.roll.toFixed(2));
    var fMid = RC.motionPose('flip', RC.MOTION_MS.flip * 0.45);
    ok(fMid.dy < -20, '공중으로 뜬다 ' + fMid.dy.toFixed(1));
    ok(fMid.roll > 1.2, '한 바퀴 회전 중 ' + fMid.roll.toFixed(2));
    var fEnd = RC.motionPose('flip', RC.MOTION_MS.flip);
    ok(Math.abs(fEnd.dy) < 2, '착지');
    ok(Math.abs(fEnd.roll - Math.PI * 2) < 0.01, '360° 를 마쳐 제자리(2π)');
  });

  test('v1.86 모션: 기기 저장 모드에서 하트로 모션을 열면 잔액이 줄고 바로 재생할 수 있다', function () {
    if (!hasNode) return;
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { if (BM.util.storage && BM.util.storage.removeItem) BM.util.storage.removeItem(k); });
    var api = BM.api.createLocal({ latency: 0, meKey: 'u_me', me: { key: 'u_me', nick: '나' } });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () {
      var rows = BM.util.readJSON('bm_rows_v1', []) || [];
      for (var i = 1; i <= 4; i++) {
        rows.push(BM.domain.toRow({ type: '출석하트', id: 'm' + i, clientId: 'm' + i, date: '2026-11-' + (10 + i),
          createdAt: '2026-11-' + (10 + i) + ' 07:00:00', nick: '나', userKey: 'u_me', likes: 1 }));
      }
      BM.util.writeJSON('bm_rows_v1', rows);
      return store.actions.reload().then(function () {
        store.state.locks = {};
        var before = RC.heartNow(store.state);
        ok(before >= 1, '하트 ' + before);
        return Promise.resolve(store.actions.buyRacketPart('motion', 'twist')).then(function (r) {
          r = r || {};
          ok(r.ok, '모션 열림');
          eq(r.price, 1, '1하트');
          eq(RC.isUnlocked(RC.customOf(store.state.me), 'motion', 'twist'), true, '열림 목록에 남는다');
          ok(RC.heartNow(store.state) < before, '잔액이 줄었다');
        });
      });
    });
  });

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.86 보호: 5개 탭 · 시트 26칸 · 3D 라켓 4종 · 파츠 6칸 · 하트 RPC 그대로', function () {
    includes(readRoot('index.html'), 'data-tab="log"', '5개 탭');
    eq(BM.domain.COLS.length, 26, '시트 26칸');
    eq(RC.BODY_IDS.length, 4, '3D 라켓 바디 4종');
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
    includes(readRoot('supabase/heart-rpc-v1.84-racket.sql'), 'heart_spend', '하트 차감 함수');
    includes(readRoot('js/views/gyms.js'), '길찾기', '지도 길찾기');
    includes(RC.stageHtml({ me: {}, data: {} }), 'data-rk-slam="1"', '바닥 강타 버튼 유지');
  });

  test('v1.86 보호: 새 코드·문구에 실존 선수 이름·외부 브랜드가 없다', function () {
    ['js/racketcustom.js', 'js/store.js', 'supabase/heart-rpc-v1.86-motion.sql'].forEach(function (f) {
      var text = readRoot(f);
      ['김원호', '안세영', '서승재', '윤드로이드', '요넥스'].forEach(function (n) {
        excludes(text, n, f + ' 에 ' + n + ' 없음');
      });
    });
  });

  test('v1.86 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.94.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.94.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.94.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261127-7', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.94.0', 'TWA 이름');
    eq(twa.appVersion, '1.94.0', 'TWA appVersion');
    eq(twa.appVersionCode, 88, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.94.0', 'README');
    includes(readRoot('test/run.js'), 'test/v186.test.js', '테스트 목록');
  });

  /* ---------- 도우미 ---------- */
  function mockCanvas() {
    var log = { strokes: 0, fills: [], texts: [], ops: [] };
    function grad() { return { addColorStop: function () {} }; }
    function noop() {}
    var g = {
      globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: '', lineJoin: '',
      font: '', textAlign: '', textBaseline: '', globalCompositeOperation: 'source-over',
      fillRect: noop, clearRect: noop, rect: noop, strokeRect: noop,
      beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, arc: noop, arcTo: noop,
      ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
      rotate: noop, translate: noop, scale: noop, save: noop, restore: noop, clip: noop,
      fill: function () { log.fills.push(g.fillStyle); }, stroke: function () { log.strokes++; },
      createLinearGradient: grad, createRadialGradient: grad,
      measureText: function (text) { return { width: String(text).length * 18 }; },
      fillText: function (text) { log.texts.push(String(text)); },
      strokeText: function (text) { log.texts.push(String(text)); },
      roundRect: noop, drawImage: noop
    };
    return { canvas: { width: 0, height: 0, getContext: function () { return g; } }, ctx: g, log: log };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
