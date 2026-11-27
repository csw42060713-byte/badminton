/* ============================================================
 * test/v190.test.js — bm-v1.95.0
 *   🔥 3D 효과가 안 보이던 문제 · 셔틀이 오는 방향으로 세게 치는 스매시 · 효과별 소리
 *
 *   1) 효과 가시성 — 파티클 크기(화면 14~52px) · 효과마다 붙는 3D 연출(불꽃 혀·얼음 결정·번개 줄기)
 *   2) 스매시      — 셔틀 궤적·안내선·라켓이 마주 보기 · 충격파 링 2겹 · 빛살 · 속도선 · 히트스톱
 *   3) 소리        — Web Audio 합성(외부 파일 없음) · 효과마다 다른 층 · 정타 시각에 예약
 *   4) 배선        — index 로드 순서 · 서비스워커 캐시 · 쉬트 단추 · 콘솔/CSP 안전
 *   5) 보호·버전
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }
  function fileExists(file) {
    try { return require('fs').statSync(require('path').join(root.__REPO_ROOT__, file)).isFile(); } catch (e) { return false; }
  }

  var SND = BM.smashsound;
  var R3 = BM.racket3d;
  var RC = BM.racketcustom;

  /* ============================================================
   * 1. 효과 가시성 — "효과가 안되는데"
   * ============================================================ */

  test('v1.90 효과: 파티클이 카메라 거리에서도 보이는 크기(30~110)로 커졌다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'function pointCloud', '파티클 생성기 그대로');
    /* 예전 size 5~15 는 z≈1200~1600 에서 1~3px 점이었습니다 — 이제 30 이상 */
    excludes(js, 'pointCloud(T, 64, 5,', '정타 파티클의 5px 크기를 없앴다');
    includes(js, 'var BURST_N = 130', '정타 파티클 130개');
    includes(js, 'pointCloud(T, BURST_N, 36', '정타 파티클 크기 36');
    /* v1.94 — 크기는 줄이고 밝기는 올려 '회색 먼지'가 아니라 불티로 보이게 */
    includes(js, "pointCloud(T, 64, 56, '#ffffff'", '불·얼음·번개 파티클');
    includes(js, "pointCloud(T, 78, 52, '#ffffff'", '블레이즈 파티클');
    includes(js, "pointCloud(T, 58, 34, '#ffffff'", '스파크 파티클');
    includes(js, 'sizeAttenuation', '거리에 따른 크기 계산은 그대로');
    includes(js, 'alphaTest: 0.02', '작은 점이 잘려 사라지지 않게');
  });

  test('v1.90 효과: 일곱 효과 모두 화면에서 실제로 움직이는 3D 연출을 갖는다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'fx_aura_', '모든 효과 공통 광휘');
    includes(js, 'function flameTexture', '불꽃 혀 텍스처');
    includes(js, "out.bits.push({ flames: tongues", '불꽃 혀가 매 프레임 살아 움직인다');
    includes(js, 'var crystals = []', '얼음 결정');
    includes(js, "out.bits.push({ crystals: crystals, frost: frost", '얼음 결정·서리 링');
    includes(js, 'BOLT_ARMS', '번개 줄기 갈래');
    includes(js, 'function boltFill', '지그재그 번개 생성');
    includes(js, 't - b.boltAt > 0.08', '번개가 80ms 마다 새로 뻗는다');
    includes(js, "if (id === 'fire' || id === 'ice' || id === 'thunder')", '스매시 효과 3종 분기 그대로');
    includes(js, 'new T.ConeGeometry(4.6', '얼음 결정(뾰족한 조각) 메쉬');
    includes(js, 'new T.Sprite(', '광휘는 카메라를 바라보는 스프라이트');
  });

  /* ============================================================
   * 2. 스매시 — 셔틀이 오는 방향으로 세게
   * ============================================================ */

  test('v1.90 스매시: 셔틀은 코트 앞 위 대각선에서 궤적·안내선과 함께 날아온다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'var inStart = new T.Vector3(-560, 540, -880)', '날아오는 시작점');
    includes(js, 'var inCtrl = new T.Vector3(-170, 430, -250)', '포물선 조절점');
    includes(js, 'inDir.copy(hitPos).sub(inStart).normalize()', '들어오는 방향을 실제로 잰다');
    includes(js, 'function buildGuide', '날아오는 길 안내선');
    includes(js, 'quadratic(inStart, inCtrl, hitPos', '같은 포물선으로 안내선을 그린다');
    includes(js, 'shuttle.scale.setScalar(2.6 - 1.35 * t)', '멀리서도 보이게 크게 다가온다');
    includes(js, 'shuttleTrail', '셔틀 잔상 꼬리');
    includes(js, 'setFromUnitVectors(FLY_AXIS, dir)', '코르크가 날아가는 쪽을 정확히 본다');
  });

  test('v1.90 스매시: 라켓이 셔틀이 오는 쪽을 마주 보고 깊은 백스윙 → 폭발적 프로네이션', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'aimYaw = clampN(-inDir.x * 0.62', '라켓이 오는 방향으로 돌아본다');
    includes(js, 'aimPitch = clampN(-inDir.y * 0.30', '위아래로도 마주 본다');
    includes(js, 'aimG.rotation.y = yaw + aimYaw * aimK', '스윙 중 실제로 적용');
    includes(js, 'out.rx = -0.62 * e;', '깊은 백스윙');
    includes(js, 'out.pz = -58 * e;', '라켓이 뒤로 크게 젖혀진다');
    includes(js, 'Math.pow(clamp01((c - WIND) / (HIT - WIND)), 2.2)', '끝에서 확 빨라지는 채찍 궤적');
    includes(js, '/* 손목 회내(프로네이션) */', '손목 회내');
    includes(js, 'out.ry = lerp(-0.68, 0.66, u)', '코킹 → 회내 각');
  });

  test('v1.90 스매시: 정타에 3D 충격파 링 2겹 · 빛살 · 큰 섬광 · 두꺼운 스윙 아크', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'var shock = new T.Mesh(', '충격파 토러스');
    includes(js, 'new T.TorusGeometry(1, 0.055', '충격파 링 두께');
    includes(js, 'var shock2 = new T.Mesh(', '두 번째 충격파 링');
    includes(js, 'function spawnImpact', '정타 연출 한 번에');
    includes(js, 'impactGlow', '큰 섬광');
    includes(js, 'rays', '사방 빛살');
    includes(js, 'speedLines', '발사 속도선');
    includes(js, 'function updateImpact', '충격파 시간 변화');
    includes(js, 'shock.scale.setScalar(s1)', '링이 퍼진다');
    includes(js, 'function ribbonOf', '스윙 아크 리본');
    includes(js, 'ribbonOf(pts, 2, 22)', '바깥 아크(끝으로 갈수록 넓게)');
    includes(js, 'ribbonOf(pts, 0.7, 4.6)', '안쪽의 밝은 아크');
    includes(js, 'trailCore', '두 겹 아크');
  });

  test('v1.90 스매시: 히트스톱·셰이크가 더 강해지고 아래 대각선으로 초고속 발사된다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'var EXTRA_STOP = 58', '한 박자 더 긴 히트스톱');
    includes(js, 'var STOP_TOTAL = 30 + EXTRA_STOP', '기존 30ms + 58ms');
    includes(js, 'el <= R2.HIT_AT + STOP_TOTAL ? R2.HIT_AT', '정타 뒤 88ms 동안 그 자리에 박힌다');
    includes(js, 'var amp = (smashKind === \'slam\' ? 46 : 40) * boom * boom', '더 강한 카메라 셰이크');
    includes(js, 'camera.rotation.z += Math.sin(after / 6.2) * amp', '기울기까지 섞은 셰이크');
    includes(js, 'dollyT -= 0.045 * Math.max(0, 1 - after / 170)', '정타에 밀고 들어오는 펀치');
    includes(js, 'launchDir.set(-inDir.x * 0.55 - 0.30', '들어온 축을 뒤집어 아래 대각선으로');
    includes(js, 'var dist = easeOut3(tr) * 1700', '초고속 직선 발사');
    includes(js, 'spawnImpact();', '정타 연출 호출');
    includes(js, 'if (!impactOn) {', '프레임이 밀려도 연출은 딱 한 번');
  });

  /* ============================================================
   * 3. 소리 — 효과마다 다르게 (불 · 얼음 · 번개 · 충격 링)
   * ============================================================ */

  test('v1.90 소리: 모듈이 있고, 오디오 파일 없이 Web Audio 로 합성한다', function () {
    ok(!!SND, 'BM.smashsound 가 로드된다');
    ['supported', 'unlock', 'play', 'layers', 'signature', 'muted', 'setMuted', 'toggle'].forEach(function (k) {
      eq(typeof SND[k], 'function', k + ' 함수');
    });
    if (!hasNode) return;
    ok(fileExists('js/smashsound.js'), 'js/smashsound.js 파일');
    var js = readRoot('js/smashsound.js');
    includes(js, 'AudioContext', '브라우저 오디오 엔진');
    includes(js, 'createOscillator', '톤 합성');
    includes(js, 'createBiquadFilter', '잡음 여과');
    includes(js, 'createBufferSource', '화이트 노이즈');
    includes(js, 'resume()', '손짓 안에서 깨우기');
    ['.mp3', '.wav', '.ogg', '.m4a', '<audio', 'new Audio('].forEach(function (bad) {
      excludes(js.toLowerCase(), bad, '외부 오디오 파일 없음: ' + bad);
    });
    /* CSP 는 그대로 — media-src 를 열 필요가 없습니다 */
    var html = readRoot('index.html');
    var csp = (html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/) || [''])[0];
    includes(csp, "script-src 'self'", 'script-src self 유지');
    excludes(csp, "'unsafe-eval'", 'unsafe-eval 없음');
    includes(html, "media-src 'self' blob:", 'media-src 는 예전 그대로');
  });

  test('v1.90 소리: 효과마다 층 구성이 다르다 (기본·불·얼음·번개·강타)', function () {
    var ids = ['none', 'fire', 'ice', 'thunder', 'slam'];
    var sigs = {}, labels = {};
    ids.forEach(function (id) {
      var kind = id === 'slam' ? 'slam' : 'air';
      var L = SND.layers(id, kind);
      ok(L.length >= 3, id + ' 층 3개 이상');
      L.forEach(function (l) {
        ok(l.dur > 0 && l.gain > 0, id + ' 층 값');
        ok(l.freq >= 20, id + ' 주파수');
        ok(l.at >= 0, id + ' 시작 시각');
        ok(l.kind === 'noise' || l.kind === 'tone', id + ' 층 종류');
      });
      sigs[id] = SND.signature(id, kind);
      labels[id] = SND.label(id, kind);
    });
    var uniq = {};
    ids.forEach(function (id) { uniq[sigs[id]] = 1; });
    eq(Object.keys(uniq).length, ids.length, '다섯 소리가 모두 서로 다르다');
    eq(labels.fire, '불꽃 스매시', '불꽃 이름');
    eq(labels.ice, '얼음 스매시', '얼음 이름');
    eq(labels.thunder, '번개 셔틀', '번개 이름');
    eq(labels.slam, '바닥 강타', '강타 이름');

    /* 정타음은 실제 임팩트 시각(346ms)에 예약된다 */
    ok(Math.abs(SND.HIT_AT - 0.346) < 0.0001, '임팩트 시각 346ms');
    ['none', 'fire', 'ice', 'thunder'].forEach(function (id) {
      var hit = SND.layers(id).filter(function (l) { return Math.abs(l.at - SND.HIT_AT) < 0.02; });
      ok(hit.length >= 2, id + ' 정타음이 임팩트 시각에 몰려 있다');
    });

    /* 불 — 낮게 번지는 열기(lowpass 600Hz 이하) + 불티 */
    var fire = SND.layers('fire');
    ok(fire.some(function (l) { return l.kind === 'noise' && l.filter === 'lowpass' && l.freq <= 600; }), '불: 저음 열기');
    ok(fire.filter(function (l) { return l.kind === 'noise' && l.filter === 'bandpass' && l.q >= 3; }).length >= 4, '불: 타닥타닥');
    ok(fire.length > SND.layers('none').length, '불: 기본보다 풍성하다');

    /* 얼음 — 2kHz 이상 맑은 크리스탈 배음 */
    var ice = SND.layers('ice');
    var chimes = ice.filter(function (l) { return l.kind === 'tone' && l.freq >= 2000; });
    ok(chimes.length >= 3, '얼음: 2kHz 이상 배음 3개 이상 (' + chimes.length + ')');
    ok(ice.some(function (l) { return l.kind === 'noise' && l.filter === 'highpass' && l.freq >= 4000; }), '얼음: 서리 가루');

    /* 번개 — 짧은 방전 크랙이 연달아 */
    var th = SND.layers('thunder');
    ok(th.filter(function (l) { return l.kind === 'noise' && l.q >= 4; }).length >= 4, '번개: 방전 크랙 여러 번');
    var zap = th.filter(function (l) { return l.kind === 'tone' && l.freqTo; });
    ok(zap.length >= 1, '번개: 지지직 내려오는 전류');
    ok(th.length >= 8, '번개: 층이 가장 많다 (' + th.length + ')');

    /* 바닥 강타 — 묵직한 쿵 + 충격파 링 공명 */
    var slam = SND.layers('fire', 'slam');
    ok(slam.some(function (l) { return l.kind === 'tone' && l.freq <= 140 && l.dur >= 0.5; }), '강타: 낮고 긴 쿵');
    ok(slam.some(function (l) { return l.kind === 'noise' && l.freq >= 900 && l.freq <= 2600 && l.q >= 6; }), '강타: 링 공명');
    eq(SND.signature('fire', 'slam'), SND.signature('ice', 'slam'), '강타 소리는 효과와 상관없이 같다');
  });

  test('v1.90 소리: AudioContext 가 없으면 조용히 false (예외 없음 · 소리 없이 앱은 그대로)', function () {
    var had = root.AudioContext;
    try {
      delete root.AudioContext;
      delete root.webkitAudioContext;
      eq(SND.supported(), false, '지원 없음');
      eq(SND.play('fire', 'air'), false, '재생 안 함');
      eq(SND.unlock(), false, '깨우지 않음');
    } finally {
      if (had) root.AudioContext = had;
    }
  });

  test('v1.90 소리: 가짜 AudioContext 로 효과별 소리가 실제로 예약되는지 확인', function () {
    var log = [], made = [];
    function gainNode() {
      return {
        gain: {
          value: 0, setValueAtTime: function () {}, linearRampToValueAtTime: function () {},
          exponentialRampToValueAtTime: function () {}, cancelScheduledValues: function () {},
          setTargetAtTime: function () {}
        },
        connect: function () { return this; }, disconnect: function () {}
      };
    }
    function FakeAC() {
      this.currentTime = 1;
      this.state = 'running';
      this.sampleRate = 8000;
      this.destination = {};
      this.createGain = function () { return gainNode(); };
      this.createBuffer = function (ch, len) { return { getChannelData: function () { return new Float32Array(len); } }; };
      this.createBiquadFilter = function () {
        var f = {
          type: '', Q: { value: 0 },
          frequency: { value: 0, setValueAtTime: function () {}, exponentialRampToValueAtTime: function () {} },
          connect: function () { return this; }
        };
        made.push(f);
        return f;
      };
      this.createBufferSource = function () {
        var s = {
          buffer: null, loop: false, onended: null,
          connect: function () { return this; },
          start: function (at) { log.push({ kind: 'noise', at: at }); },
          stop: function () {}
        };
        return s;
      };
      this.createOscillator = function () {
        var o = {
          type: '', onended: null,
          frequency: { value: 0,
            setValueAtTime: function (v) { this.value = v; },
            exponentialRampToValueAtTime: function (v) { this.to = v; } },
          connect: function () { return this; },
          start: function (at) { log.push({ kind: 'tone', at: at, freq: o.frequency.value }); },
          stop: function () {}
        };
        return o;
      };
      this.resume = function () { this.state = 'running'; };
    }
    var hadAC = root.AudioContext, wasMuted = SND.muted();
    try {
      root.AudioContext = FakeAC;
      delete root.webkitAudioContext;
      SND.setMuted(false);
      eq(SND.unlock(), true, '깨우기');
      eq(SND.play('ice', 'air'), true, '얼음 재생');
      var iceTones = log.filter(function (r) { return r.kind === 'tone' && r.freq >= 2000; }).map(function (r) { return Math.round(r.freq); });
      ok(iceTones.length >= 3, '얼음: 2kHz 이상 톤이 실제로 예약됨 ' + iceTones.join(','));
      log.length = 0; made.length = 0;
      eq(SND.play('fire', 'air'), true, '불 재생');
      ok(made.some(function (f) { return f.type === 'lowpass'; }), '불: lowpass 필터 사용');
      ok(log.length >= 6, '불: 여러 층이 예약됨 (' + log.length + ')');
      /* 끄면 아무것도 예약하지 않는다 */
      SND.setMuted(true);
      log.length = 0;
      eq(SND.play('thunder', 'air'), false, '끄면 재생 안 함');
      eq(log.length, 0, '끄면 예약도 없음');
    } finally {
      SND.setMuted(wasMuted);
      if (hadAC) root.AudioContext = hadAC; else delete root.AudioContext;
    }
  });

  /* ============================================================
   * 4. 배선 — 화면 · 캐시 · 단추
   * ============================================================ */

  test('v1.90 배선: 셔틀릭스가 손짓 안에서 소리를 깨우고 스매시마다 효과 소리를 낸다', function () {
    if (!hasNode) return;
    var js = readRoot('js/racket3d.js');
    includes(js, 'BM.smashsound.play(smashFx, smashKind)', '3D 스매시 소리');
    includes(js, 'BM.smashsound.unlock()', '캔버스 터치에서 깨우기');
    var js2 = readRoot('js/racketcustom.js');
    includes(js2, 'BM.smashsound.play(smashFx, smashKind)', '2D 폴백에서도 같은 소리');
    includes(js2, 'BM.smashsound.unlock()', '2D 캔버스 터치에서 깨우기');
    includes(js2, 'function soundBtnHtml', '소리 단추');
    includes(js2, 'data-rk-sound="1"', '쉬트에 단추 자리');
    includes(js2, "closest('[data-rk-sound]')", '단추 클릭 처리');
    includes(js2, 'BM.smashsound.toggle()', '켜기/끄기');
    includes(readRoot('styles.css'), '.rk3d__sound', '단추 스타일');
    includes(readRoot('styles.css'), '.rk3d__sound.is-off', '꺼진 모습');
  });

  test('v1.90 배선: index 로드 순서 · 서비스워커 캐시에 소리 모듈이 들어 있다', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    includes(html, 'js/smashsound.js', 'index 가 싣는다');
    ok(html.indexOf('js/smashsound.js') < html.indexOf('js/racket3d.js'), '소리 모듈이 3D 보다 먼저');
    var sw = readRoot('sw.js');
    includes(sw, "'./js/smashsound.js'", '서비스워커 캐시');
    includes(sw, "var VERSION = 'bm-v1.95.0'", '캐시 버전');
  });

  test('v1.90 보호: 효과·모션·파츠·폴백이 그대로다', function () {
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸');
    eq(RC.BODY_IDS.length, 4, '바디 4종');
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종');
    eq(R3.available(), false, 'Node(WebGL 없음)은 2D 폴백');
    includes(readRoot('js/racketcustom.js'), 'function drawSmash', '2D 스매시 연출 보존');
    includes(readRoot('js/racket3d.js'), 'function dispose', '렌더러 정리 보존');
    includes(readRoot('js/racket3d.js'), 'WEBGL_lose_context', '컨텍스트 반환 보존');
    includes(readRoot('js/racket3d.js'), 'if (mode !== \'paint\') { api.smash(); return; }', '톡 치면 스매시 보존');
  });

  test('v1.90 보호: 실존 선수·브랜드 이름이 새 파일에도 없다', function () {
    if (!hasNode) return;
    ['js/racket3d.js', 'js/smashsound.js', 'js/racketcustom.js', 'index.html', 'sw.js'].forEach(function (f) {
      var text = readRoot(f);
      ['김원호', '안세영', '서승재', '윤드로이드', '요넥스', 'YONEX', '빅터', '리닝'].forEach(function (n) {
        excludes(text, n, f + ' 에 ' + n + ' 없음');
      });
    });
  });

  test('v1.90 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.95.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.95.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.95.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-1', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.95.0', 'TWA 이름');
    eq(twa.appVersion, '1.95.0', 'TWA appVersion');
    eq(twa.appVersionCode, 89, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.95.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v190.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
