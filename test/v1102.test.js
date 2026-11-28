/* ============================================================
 * test/v1102.test.js — bm-v1.104.0
 *
 *   승우 님 요청(2026-11-28 저녁):
 *     "라켓 돌릴 때 임팩트 좀 더 있게"
 *     "한 개는 그냥 한 바퀴 도는 게 아니라 좀 멋있게 몇 바퀴 돌고 하게 바꿔줘"
 *     "뭔가 빨라보이게"  ·  "멋있어 보이게"  ·  "뒤에 임팩트 잘고민해봐"
 *     "뭔가 실달린거 같아서 별로야" → 돌릴 때 따라다니는 선/리본 전부 제거
 *
 *   1) 다회전 — flip = 1080°(3바퀴) 콤보, 끝은 정확히 6π(제자리)
 *   2) 속도감 — 재생 시간 단축 + 스냅 가속 · 등속 · 딱 멈춤 (끝은 정지 포즈)
 *   3) 마무리 임팩트 — 이벤트(링·스파크·글로우·펀치)가 2D·3D·소리에 같은 시각으로
 *   4) 실 같은 선 없음 — 회전 잔상 리본 삭제, 링(도넛)·둥근 스파크만
 *   5) 소리 — 휘두름 ×3 + 착지음, 음소거·손짓 규칙 그대로
 *   6) 2D 폴백 — 같은 순서의 이중 링·글로우·스파크 + 흔들림·눌림 반동
 *   7) 보호 · 버전
 *
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

  var TAU = Math.PI * 2;

  /* ============================================================
   * 1. 다회전 — flip 은 3바퀴(1080°) 콤보
   * ============================================================ */

  test('v1.102 다회전: flip 은 1080°(3바퀴)를 돌고 정확히 제자리로 선다', function () {
    var dur = RC.MOTION_MS.flip;
    var peak = 0, i, p, last = 0, mono = true;
    for (i = 0; i <= 100; i++) {
      p = RC.motionPose('flip', dur * (i / 100));
      if (!isFinite(p.roll) || !isFinite(p.yaw) || !isFinite(p.pitch) || !isFinite(p.dy)) ok(false, 'NaN 없음 ' + i);
      if (p.roll > peak) peak = p.roll;
      if (i > 0 && p.roll < last - 0.35) mono = false;   /* 회전이 뒤로 가지 않는다 */
      last = p.roll;
    }
    ok(peak > Math.PI * 5.9, '최고 회전각 1080° 근처 (' + (peak / Math.PI).toFixed(2) + 'π)');
    ok(peak < Math.PI * 6.1, '3바퀴를 넘지 않는다');
    var end = RC.motionPose('flip', dur);
    ok(Math.abs(end.roll - Math.PI * 6) < 0.01, '끝은 6π = 제자리 (' + end.roll.toFixed(3) + ')');
    ok(Math.abs(end.dy) < 2, '착지 높이 ' + end.dy.toFixed(1));
    ok(mono, '회전은 한 방향으로만');
  });

  test('v1.102 다회전: 공중 중반에 이미 두 바퀴를 넘겨 돈다(빠른 회전)', function () {
    var dur = RC.MOTION_MS.flip;
    var half = RC.motionPose('flip', dur * 0.5);
    ok(half.roll > Math.PI * 2.6, '절반 시점에 ' + (half.roll / Math.PI).toFixed(2) + 'π');
    var seven = RC.motionPose('flip', dur * 0.72);
    ok(seven.roll > Math.PI * 4.6, '0.72 시점에 ' + (seven.roll / Math.PI).toFixed(2) + 'π');
    ok(half.dy < -20, '공중에 떠 있다 ' + half.dy.toFixed(1));
  });

  test('v1.102 다회전: 2축 — 옆으로도 돌았다가 착지 순간 정면(0)으로 돌아온다', function () {
    var dur = RC.MOTION_MS.flip;
    var mid = RC.motionPose('flip', dur * 0.55);
    ok(Math.abs(mid.yaw) > 0.35, '공중에서 옆으로 돌아 있다 ' + mid.yaw.toFixed(2));
    var end = RC.motionPose('flip', dur);
    ok(Math.abs(end.yaw) < 0.02, '착지 때 정면 ' + end.yaw.toFixed(3));
    ok(Math.abs(end.pitch) < 0.02, '착지 때 기울기 0 ' + end.pitch.toFixed(3));
  });

  /* ============================================================
   * 2. 속도감 — 짧아지고, 스냅 가속 → 등속 → 딱 멈춤
   * ============================================================ */

  test('v1.102 속도: 세 모션이 예전보다 짧고, flip 이 가장 길다(3바퀴)', function () {
    ok(RC.MOTION_MS.twist <= 1800, 'twist ' + RC.MOTION_MS.twist + 'ms (예전 2400)');
    ok(RC.MOTION_MS.showcase <= 1900, 'showcase ' + RC.MOTION_MS.showcase + 'ms (예전 2800)');
    ok(RC.MOTION_MS.flip <= 2100, 'flip ' + RC.MOTION_MS.flip + 'ms (예전 2100, 회전은 3배)');
    eq(RC.motionDur('flip'), RC.MOTION_MS.flip, 'motionDur 가 같은 값을 준다');
    eq(RC.motionDur('없는모션'), 2000, '모르는 모션은 기본 2000ms');
  });

  test('v1.102 속도: 초반 스냅 가속 — 첫 15% 안에 한 바퀴를 넘게 돈다', function () {
    var dur = RC.MOTION_MS.flip;
    var a = RC.motionPose('flip', dur * 0.10);
    var b = RC.motionPose('flip', dur * 0.25);
    ok(b.roll - a.roll > TAU * 0.45, '0.10→0.25 에 ' + ((b.roll - a.roll) / Math.PI).toFixed(2) + 'π 회전');
    /* 등속 구간: 중반 두 구간의 회전량이 비슷하다(느려지지 않는다) */
    var c = RC.motionPose('flip', dur * 0.45);
    var d = RC.motionPose('flip', dur * 0.65);
    var e = RC.motionPose('flip', dur * 0.85);
    ok(Math.abs((d.roll - c.roll) - (e.roll - d.roll)) < TAU * 0.35, '중반은 거의 등속');
  });

  test('v1.102 속도: 끝은 딱 멈춘 정지 포즈(마지막 10% 는 회전이 그대로)', function () {
    var dur = RC.MOTION_MS.flip;
    var p85 = RC.motionPose('flip', dur * 0.86);
    var p95 = RC.motionPose('flip', dur * 0.95);
    var p100 = RC.motionPose('flip', dur);
    ok(Math.abs(p95.roll - p85.roll) < 0.06, '착지 뒤 회전이 멈춘다');
    ok(Math.abs(p100.roll - p85.roll) < 0.06, '끝까지 그 자리');
    /* 착지 반동 — 눌렸다 돌아오는 스케일·높이 */
    var bounce = 0, i, sq;
    for (i = 86; i <= 100; i++) {
      sq = RC.motionPose('flip', dur * (i / 100)).sq;
      if (sq < bounce) bounce = sq;
    }
    ok(bounce < 0.99, '착지 눌림이 있다 ' + bounce.toFixed(3));
  });

  /* ============================================================
   * 3. 마무리 임팩트 이벤트 — 2D·3D·소리가 같은 시각을 본다
   * ============================================================ */

  test('v1.102 임팩트: 세 모션 모두 회전 피크 + 마무리 한 방이 있다', function () {
    ['twist', 'showcase', 'flip'].forEach(function (k) {
      var ev = RC.motionEvents(k);
      ok(ev.length >= 3, k + ' 이벤트 ' + ev.length + '개');
      var land = ev.filter(function (e) { return e.kind === 'land'; });
      eq(land.length, 1, k + ' 마무리(land)는 하나');
      var spins = ev.filter(function (e) { return e.kind === 'spin'; });
      ok(spins.length >= 2, k + ' 회전 피크 ' + spins.length + '개');
      for (var i = 1; i < ev.length; i++) ok(ev[i].at > ev[i - 1].at, k + ' 이벤트는 시간 순서');
      eq(RC.motionLandAt(k), land[0].at, k + ' motionLandAt 이 land 시각');
      var sp = RC.motionSpins(k);
      eq(sp.length, spins.length, k + ' motionSpins 개수');
      ok(land[0].at < RC.motionDur(k), k + ' 마무리는 재생 안');
    });
  });

  test('v1.102 임팩트: flip 은 세 바퀴에 맞춰 회전 피크가 세 번, 마무리는 0.86', function () {
    var ev = RC.motionEvents('flip');
    eq(RC.motionSpins('flip').length, 3, '휘두름 3번 = 3바퀴');
    var land = ev[ev.length - 1];
    eq(land.kind, 'land', '마지막은 착지');
    eq(land.at, Math.round(RC.MOTION_MS.flip * 0.86), '착지 시각');
    ok(land.power >= 0.99, '착지 한 방이 가장 세다 ' + land.power);
    ok(RC.motionLandAt('flip') === land.at, '같은 시각을 돌려준다');
  });

  test('v1.102 임팩트: 자세가 지금이 한 방 직후인지 알려 준다(imp·impKind)', function () {
    var dur = RC.MOTION_MS.flip;
    var land = RC.motionLandAt('flip');
    var at = RC.motionPose('flip', land + 12);
    eq(at.impKind, 'land', '착지 직후');
    ok(at.imp > 0.6, '세기 ' + at.imp.toFixed(2));
    var later = RC.motionPose('flip', land + 400);
    eq(later.imp, 0, '한 참 뒤에는 0');
    var quiet = RC.motionPose('flip', dur * 0.12);
    eq(quiet.imp, 0, '첫 회전 전에는 0');
    ok(RC.motionHit('flip', land + 12, 300) !== null, 'motionHit 이 찾는다');
    eq(RC.motionHit('flip', land + 400, 300), null, '창 밖이면 null');
  });

  /* ============================================================
   * 4. 실 같은 선 없음 — 링(도넛)·둥근 스파크만
   * ============================================================ */

  if (hasNode) {
    test('v1.102 3D: 돌릴 때 따라다니는 선(회전 잔상 리본)이 완전히 사라졌다', function () {
      var js = readRoot('js/racket3d.js');
      excludes(js, 'spinMesh', '리본 메시 없음');
      excludes(js, 'updateSpinTrail', '잔상 갱신 없음');
      excludes(js, 'spinHist', '잔상 버퍼 없음');
      includes(js, 'function updateMotionFx', '모션 임팩트 갱신');
      includes(js, 'function fireMotionHit', '한 방 발화');
      includes(js, 'function spawnMotionSparks', '스파크');
      includes(js, 'function ringTexture', '충격파 고리 텍스처');
      includes(js, 'motionRingSprite', '회전 고리');
    });

    test('v1.102 3D: 임팩트는 굵은 도넛 링 · 스파크 · 스프라이트 글로우로만 그린다', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, 'mRingTex = ringTexture()', '부드럽게 번지는 빛의 고리(가는 선 아님)');
      includes(js, 'mRingA', '첫 번째 링');
      includes(js, 'mRingB', '두 번째 링(기울여 겹침)');
      includes(js, 'mRingF', '바닥 충격파 링');
      includes(js, 'new T.Sprite(new T.SpriteMaterial({', '하이라이트 글로우');
      includes(js, 'updateMotionSparks(dt)', '스파크 갱신');
      /* 임팩트 갱신 안에서는 선(Line)을 만들지 않는다 */
      var s = js.indexOf('function spawnMotionSparks');
      var e = js.indexOf('function ensureKit');
      var body = js.slice(s, e);
      excludes(body, 'LineSegments', '선분 없음');
      excludes(body, 'LineBasicMaterial', '선 재질 없음');
      excludes(body, 'new T.Line', '선 없음');
    });

    test('v1.102 3D: 마무리 한 방에 펀치 줌·미세 진동·바닥 오라 펄스가 함께 온다', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, '1 - 0.055 * punchE', '펀치 줌(밀고 들어왔다 복귀)');
      includes(js, 'Math.sin(mPunchT * 0.045) * 13 * punchE', '미세 진동 x');
      includes(js, 'Math.sin(mPunchT * 0.06) * 0.014 * punchE', '미세 롤');
      includes(js, 'animateFloorAura(floorAura, tFx, mFloorPulse)', '바닥 오라 펄스');
      includes(js, 'poolRing.scale.set(fp, fp, 1)', '바닥 링 펄스');
      includes(js, 'if (mo.sq) motionScale *= mo.sq;', '착지 눌림 → 반동');
      includes(js, 'motionScale *= 1 + 0.05 * mPunch * mPunch;', '스케일 펀치');
      /* 70ms 히트스톱 */
      includes(readRoot('js/racketcustom.js'), 'var l2 = Math.max(0, lt - 0.035);', '착지 70ms 스냅 정지');
    });

    test('v1.102 3D: 매 프레임 메시·텍스처를 만들지 않는다(60fps)', function () {
      var js = readRoot('js/racket3d.js');
      var s = js.indexOf('function spawnMotionSparks');
      var e = js.indexOf('function ensureKit');
      var body = js.slice(s, e);
      excludes(body, 'new T.Mesh(', '프레임마다 메시 생성 없음');
      excludes(body, 'canvasDraw', '프레임마다 텍스처 없음');
      includes(body, 'mSpark.geometry.attributes.position.needsUpdate = true', '정점만 다시 씀');
      includes(js, 'var MS_N = 64;', '스파크는 64개 풀 고정');
      includes(js, 'mRingAge = -1', '링은 상태만 다시 씀');
    });
  }

  /* ============================================================
   * 5. 소리 — 휘두름 ×3 + 착지음 (음소거 규칙 그대로)
   * ============================================================ */

  test('v1.102 소리: 회전 휘두름 + 마무리 착지음이 같은 시각에 예약된다', function () {
    var S = BM.smashsound;
    ok(typeof S.motion === 'function', 'motion 재생 함수');
    var timing = { landAt: RC.motionLandAt('flip'), spins: RC.motionSpins('flip') };
    var list = S.motionLayers('flip', timing);
    ok(list.length >= 6, '층 ' + list.length + '개');
    var wh = list.filter(function (l) { return l.at < timing.landAt / 1000; });
    eq(wh.length, timing.spins.length, '휘두름은 회전 수만큼');
    var thud = list.filter(function (l) { return Math.abs(l.at - timing.landAt / 1000) < 0.02; });
    ok(thud.length >= 2, '착지음은 낮은 톤 + 코트 소리');
    ok(thud.some(function (l) { return l.kind === 'tone' && l.freq < 200; }), '낮은 "퍽"');
    eq(S.motionLabel('flip'), '공중 3연속 스핀', '소리 이름');
    /* 모르는 모션도 소리는 난다(기본값) */
    ok(S.motionLayers('없는모션', null).length >= 3, '기본 타이밍');
  });

  test('v1.102 소리: 음소거면 아무 소리도 예약하지 않는다(기존 규칙)', function () {
    var S = BM.smashsound;
    var was = S.muted();
    S.setMuted(true);
    eq(S.motion('flip', { landAt: 100, spins: [10] }), false, '음소거 중에는 재생 안 함');
    S.setMuted(was);
    eq(S.muted(), was, '원래대로');
  });

  if (hasNode) {
    test('v1.102 소리: 손짓 안에서만 깨우고, 소리 파일은 쓰지 않는다', function () {
      var js = readRoot('js/smashsound.js');
      includes(js, 'function playMotion', '모션 재생');
      includes(js, 'if (MUTED) return false;', '음소거 먼저');
      excludes(js, '.mp3', '오디오 파일 없음');
      excludes(js, 'new Audio(', '오디오 태그 없음');
      includes(readRoot('js/racket3d.js'), 'BM.smashsound.motion(k, {', '3D 가 소리를 부른다');
      includes(readRoot('js/racketcustom.js'), 'BM.smashsound.motion(k2, {', '2D 도 소리를 부른다');
    });
  }

  /* ============================================================
   * 6. 2D 폴백 — 같은 시각·같은 순서
   * ============================================================ */

  if (hasNode) {
    test('v1.102 2D: 폴백도 이중 링 · 글로우 · 방사형 스파크로 임팩트를 낸다', function () {
      var js = readRoot('js/racketcustom.js');
      includes(js, 'function drawMotionImpact', '2D 임팩트');
      includes(js, 'if (mo) drawMotionImpact(g, vv, gm, mo, w, h, mEl);', '모션 중에만 그린다');
      includes(js, 'ringBand(g, cx, cy, r0 * 0.94, r0 * 1.30)', '바깥 링(면으로 채운 밴드)');
      includes(js, 'ringBand(g, cx, cy, r0 * 1.00, r0 * 1.07)', '이중 충격파 링');
      includes(js, 'function ringBand', '고리 밴드 헬퍼');
      includes(js, 'g.createRadialGradient(cx, cy, 0, cx, cy, gr)', '글로우');
      includes(js, 'var n = land ? 14 : 8;', '방사형 스파크');
      includes(js, 'shake += Math.sin(mEl / 9) * mShake;', '착지 화면 흔들림');
      includes(js, 'if (mo && mo.sq) spinScale *= mo.sq;', '눌림 반동');
      /* 선(스트로크 경로)으로 궤적을 잇지 않는다 */
      var s = js.indexOf('function drawMotionImpact');
      var e = js.indexOf('function loop()', s);
      var body = js.slice(s, e);
      excludes(body, '.lineTo(', '궤적선 없음');
      excludes(body, '.moveTo(', '궤적선 없음');
    });
  }

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.102 보호: 모션 ID·가격·서버 키는 그대로, 이름·설명만 다회전으로', function () {
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종 그대로');
    var f = RC.itemOf('motion', 'flip');
    eq(f.id, 'flip', 'ID 그대로');
    eq(f.heart, 3, '가격 ❤3 그대로');
    eq(RC.priceOf('motion', 'flip'), 3, 'priceOf 도 3');
    includes(f.name, '3연속', '이름이 다회전');
    includes(f.note, '3회전', '설명이 다회전');
    ok(RC.itemOf('motion', 'twist').heart === 1, 'twist ❤1 그대로');
    eq(RC.itemOf('motion', 'showcase').heart, 2, 'showcase ❤2 그대로');
  });

  test('v1.102 보호: 기존 라켓 화면 요소는 그대로다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racketcustom.js');
    includes(js, 'data-rk-motion=', '모션 칩');
    includes(js, 'data-rk-slam="1"', '바닥 강타 버튼');
    includes(js, 'function motionChipsHtml', '모션 칩 그리기');
    includes(js, 'buyPart(host, ctx, \'motion\', mid', '하트 구매 경로');
    includes(js, 'BM.racketcustom._last3d.motion(mid)', '3D 모션 재생 경로');
    includes(js, 'class="rkmotions"', '모션 칩 묶음');
    includes(js, 'function motionNow', '2D 모션 상태');
  });

  test('v1.102 버전: sw · app · push · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.104.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.104.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.104.0'", 'push 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.104.0', 'TWA 이름');
    eq(twa.appVersionCode, 98, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.104.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v1102.test.js', '테스트 목록');
    includes(readRoot('sw.js'), 'bm-v1.104.0', 'sw 변경 이력');
  });

  test('v1.102 보호: 새 코드·문구에 실존 선수 이름이 없다', function () {
    if (!hasNode) return;
    ['js/racketcustom.js', 'js/racket3d.js', 'js/smashsound.js'].forEach(function (f) {
      var s = readRoot(f);
      ['김원호', '안세영', '서승재', '조환비'].forEach(function (n) {
        excludes(s, n, f + ' 에 ' + n + ' 없음');
      });
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
