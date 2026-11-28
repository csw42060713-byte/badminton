/* ============================================================
 * test/v188.test.js — bm-v1.96.0
 *   🎮 커스텀 라켓을 진짜 3D(Three.js WebGL) 쇼룸으로
 *
 *   1) 엔진   — 저장소 안 three.min.js(MIT) · sw 캐시 · CSP 그대로(외부 CDN 없음)
 *   2) 모델   — 실제 규격 프레임 단면·그로밋·데칼·6.8mm 샤프트·오버그립 나선·거트
 *   3) 파츠   — 바디 4종·프레임(금속/매트)·스트링·그립(타월/투톤)·스텐실·참·효과 반영
 *   4) 쇼룸   — 3점 조명 + 림 라이트 + 바닥 스포트라이트 + PBR 재질
 *   5) 스매시 — 3D 셔틀콕(깃 16장)·백스윙·프로네이션·히트스톱·카메라 셰이크·궤적·파티클
 *   6) 폴백   — WebGL 이 없으면 조용히 2D 렌더러 (Node 테스트가 그 경로)
 *   7) 보호·버전
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
  function readJson(file) { return JSON.parse(readRoot(file)); }
  function sizeOf(file) { return require('fs').statSync(require('path').join(root.__REPO_ROOT__, file)).size; }

  var RC = BM.racketcustom;
  var R3 = BM.racket3d;

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateWith(custom, gearPatch) {
    var me = JSON.parse(JSON.stringify(ME));
    me.theme.gear = Object.assign({ custom: custom }, gearPatch || {});
    return {
      ready: true, mode: 'local', me: me, rows: [],
      data: BM.store.derive([], BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null } },
      ui: { tab: 'my', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* ============================================================
   * 1. 엔진 — 저장소 안에 넣은 Three.js (외부 CDN·CSP·오프라인 안전)
   * ============================================================ */

  test('v1.88 엔진: three.min.js 를 저장소에 직접 넣고 서비스워커가 함께 캐시한다', function () {
    if (!hasNode) return;
    var three = readRoot('js/vendor/three/three.min.js');
    ok(three.length > 400000, '번들이 저장소 안에 있다 ' + Math.round(three.length / 1024) + 'KB');
    includes(three, 'SPDX-License-Identifier: MIT', 'MIT 라이선스 표기');
    includes(three, 'REVISION', 'three 리비전 표기');
    includes(readRoot('index.html'), 'js/vendor/three/three.min.js', 'index.html 이 저장소 번들을 쓴다');
    includes(readRoot('index.html'), 'js/racket3d.js', '3D 모듈도 저장소 파일');
    var sw = readRoot('sw.js');
    includes(sw, "'./js/vendor/three/three.min.js'", '서비스워커 캐시 목록');
    includes(sw, "'./js/racket3d.js'", '3D 모듈도 캐시');
    /* 로드 순서: three → racket3d → racketcustom (mount3d 가 BM.racket3d 를 먼저 봅니다) */
    var html = readRoot('index.html');
    ok(html.indexOf('js/vendor/three/three.min.js') < html.indexOf('js/racket3d.js'), 'three 먼저');
    ok(html.indexOf('js/racket3d.js') < html.indexOf('js/racketcustom.js'), '3D 모듈이 라켓 모듈보다 먼저');
    /* 외부 CDN 으로 three 를 받지 않는다 */
    excludes(html, 'cdn.jsdelivr.net/npm/three', 'three CDN 로드 없음');
    excludes(html, 'unpkg.com/three', 'unpkg 로드 없음');
    /* CSP 는 그대로 — unsafe-eval 을 열지 않았습니다 */
    includes(html, "script-src 'self'", '스크립트는 self 만');
    /* 실제 CSP 줄만 봅니다 (주석에는 '막았다'는 설명으로 단어가 나옵니다) */
    var cspLine = (html.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/) || [''])[0];
    ok(cspLine.length > 40, 'CSP 메타가 있다');
    excludes(cspLine, "'unsafe-eval'", "CSP 에 unsafe-eval 없음");
    ok(cspLine.indexOf("script-src 'self'") > 0 && cspLine.indexOf("script-src") === cspLine.indexOf("script-src 'self'"), 'script-src 는 self 로 시작');
    includes(html, "object-src 'none'", 'object-src 차단');
  });

  test('v1.88 폴백: WebGL 이 없는 환경(Node)에서는 available=false · create=null, 예외 없음', function () {
    ok(!!R3, 'BM.racket3d 가 로드된다');
    eq(typeof R3.create, 'function', 'create 함수');
    eq(typeof R3.available, 'function', 'available 함수');
    eq(typeof root.document, 'undefined', '테스트 환경에는 document 가 없다');
    eq(R3.available(), false, 'WebGL 없음 → false (2D 로 폴백)');
    eq(R3.create({ querySelector: function () { return null; } }, null), null, 'create 는 null 을 돌려준다');
  });

  test('v1.88 폴백: mount3d 가 3D 엔진을 먼저 시도하고 실패하면 2D 로 돌아간다', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'BM.racket3d.available()', '사용 가능 여부를 먼저 확인');
    includes(js, 'BM.racket3d.create(host, ctx)', '3D 엔진으로 그리기');
    includes(js, '3D 엔진을 열지 못해 기본 뷰로 갑니다', '실패 시 조용한 폴백 안내');
    includes(js, "var g = cv.getContext('2d')", '2D 렌더러는 그대로 남아 있다');
    /* 기존 2D 그리기 코드는 지우지 않았습니다 */
    includes(js, 'function draw3d', '기존 draw3d 보존');
    includes(js, 'function drawSmash', '기존 스매시 연출 보존');
  });

  /* ============================================================
   * 2. 모델 — 실제 규격과 디테일
   * ============================================================ */

  test('v1.88 모델: 헤드 단면을 쓸어 만든 프레임 + 그로밋 + 데칼 + 슬림 샤프트', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'function bandGeometry', '단면 쓸기(스윕) 지오메트리');
    includes(js, 'boxy', '둥근 사각(박스/에어로) 단면');
    includes(js, 'InstancedMesh', '그로밋은 인스턴스로 가볍게');
    includes(js, 'function decalBand', '12·3·9시 데칼');
    includes(js, 'T 조인트', 'T 조인트 판');
    includes(js, 'shaftR * 1.12', '샤프트 테이퍼(6.8mm 감각)');
    includes(js, 'function gripSpiral', '오버그립 나선');
    includes(js, 'pitch: 11.4', '겹쳐 감기는 간격');
    includes(js, '겹쳐 감긴 주름', '나선 주름 설명');
    includes(js, 'towelTexture', '타월 결 텍스처');
    includes(js, 'carbonTexture', '카본 직조 결');
    includes(js, 'function closedLoop', '정수리 이음매가 뾰족하지 않은 닫힌 곡선');
    includes(js, 'function innerLoopOf', '안쪽 곡선을 따라가는 거트');
    includes(js, 'function chordAt', '헤드 모양에 맞춘 줄 길이');
    /* 실제 규격 치수를 쓰는지 (바디 모델 숫자를 그대로) */
    includes(js, 'gm.rx', '바디별 헤드 폭');
    includes(js, 'gm.gripR', '그립 둘레(G5)');
    includes(js, 'gm.shaftR', '샤프트 지름');
  });

  test('v1.88 모델: 줄 상태(prime/worn/broken)가 3D 거트에 그대로 반영된다', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, "look.level === 'worn' ? 1.3 : 0", '늘어진 줄은 가운데가 처진다');
    includes(js, "look.level === 'broken'", '끊긴 줄 처리');
    includes(js, 'brokenStringPlan(mainPts.length, crossPts.length)', '끊긴 줄 배치');
    includes(js, 'line[idx].y += (fromStart ? -1 : 1) * gap * k', '끊긴 끝이 벌어진다');
    includes(js, 'stringRibbon', '줄은 리본 메쉬');
    includes(js, 'function stringRibbon', '리본 정의');
  });

  /* ============================================================
   * 3. 파츠 — 실제 파츠 값이 3D 재질로 넘어간다
   * ============================================================ */

  test('v1.88 파츠: 오닉스(금속)·투톤·스트링 색이 그대로 3D 재질로 넘어간다', function () {
    var st = stateWith({
      body: 'smash',
      unlocked: ['body:smash', 'frame:onyx', 'string:gold', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:prism'],
      frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism'
    });
    var look = R3.lookOf({ store: { state: st } });
    eq(look.frame.finish, 'metal', '오닉스는 금속 마감');
    eq(look.frame.id, 'onyx', '프레임 id');
    eq(look.grip.weave, 'twotone', '투톤 결');
    eq(look.grip.color2, '#20252b', '두 번째 색');
    eq(look.string.color, '#f2c14e', '골드 스트링');
    eq(look.stencil.id, 'crown', '왕관 스텐실');
    eq(look.charm.id, 'ace', '에이스 참');
    eq(look.effect.id, 'prism', '프리즘 효과');
    eq(look.gm.id, 'smash', '스매시 맥스 바디');
    includes(look.sig, 'onyx|gold|twotone', '파츠가 바뀌면 다시 만드는 서명');

    var js = readRoot('js/racket3d.js');
    includes(js, "look.frame.finish === 'metal'", '금속 분기');
    includes(js, "weave === 'towel'", '타월 분기');
    includes(js, "colors.length > 1", '투톤은 두 재질로 감긴다');
    includes(js, 'MeshPhysicalMaterial', 'PBR 재질');
    includes(js, 'clearcoat', '클리어코트 광택');
  });

  test('v1.88 파츠: 효과 4종(스피드·스파크·블레이즈·프리즘)과 스매시 연출 3종이 3D 로', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, "id === 'speed'", '스피드 링');
    includes(js, "id === 'spark'", '스파크');
    includes(js, "id === 'blaze'", '블레이즈');
    includes(js, "id === 'prism'", '프리즘');
    includes(js, "id === 'fire' || id === 'ice' || id === 'thunder'", '스매시 연출 3종');
    includes(js, 'rainbowTexture', '프리즘 홀로그램');
    includes(js, 'function animateEffect', '효과 애니메이션');
  });

  /* ============================================================
   * 4. 쇼룸 — 조명·반사·바닥
   * ============================================================ */

  test('v1.88 쇼룸: 3점 조명 + 뒤쪽 림 라이트 + 바닥 스포트라이트 + 톤매핑', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'HemisphereLight', '환경광');
    includes(js, 'var key = new T.DirectionalLight', '키 라이트');
    includes(js, 'var rim = new T.DirectionalLight', '림 라이트');
    includes(js, 'var rimL = new T.DirectionalLight', '왼쪽 윤곽광');
    includes(js, 'var rimR = new T.DirectionalLight', '오른쪽 윤곽광');
    includes(js, "var fill = new T.DirectionalLight", '필 라이트');
    includes(js, 'floorPoolTexture', '바닥 스포트라이트 원형 반사');
    includes(js, 'contactShadowTexture', '접지 그림자');
    includes(js, 'backdropTexture', '스튜디오 배경');
    includes(js, 'EquirectangularReflectionMapping', '환경맵 반사');
    includes(js, 'ACESFilmicToneMapping', '필름 톤매핑');
    includes(js, 'sRGBEncoding', '색 공간');
    includes(js, 'ColorManagement', '색 관리(실제 색 그대로)');
    includes(js, 'setupColor', '색 관리 켜기');
    /* 화면 배경도 어두운 스튜디오 */
    includes(readRoot('styles.css'), '어두운 프리미엄 스튜디오', '시트 배경 스튜디오 톤');
    includes(readRoot('styles.css'), '.rk3d::after', '유리 진열장 비네트');
  });

  /* ============================================================
   * 5. 스매시 — 실제 타격 순서
   * ============================================================ */

  test('v1.88 스매시: 3D 셔틀콕은 코르크 반구 + 밴드 + 깃 16장', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'function buildShuttle', '셔틀콕 모델');
    includes(js, 'SphereGeometry(12.0', '코르크 머리');
    includes(js, 'CylinderGeometry(12.1, 12.35', '밴드');
    includes(js, 'var N = 16', '깃 16장');
    includes(js, 'var tilt = 0.44', '깃이 원뿔로 퍼지는 각');
    includes(js, 'makeBasis', '깃을 원뿔면에 맞춰 세운다');
    includes(js, 'TorusGeometry(20.2', '두 줄 스티치 링');
  });

  test('v1.88 스매시: 백스윙 → 프로네이션 풀스윙 → 히트스톱 · 셰이크 · 궤적 · 파티클', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, '프로네이션', '손목 회내');
    includes(js, 'function poseAt', '자세 계산');
    includes(js, 'R2.smashClock(el)', '히트스톱 시계는 기존 규칙 그대로');
    includes(js, 'camera.position.x = Math.sin(after / 7.5) * amp', '정타 순간 카메라 셰이크(bm-v1.96.0 에서 더 강하게)');
    includes(js, 'function buildTrail', '스윙 궤적');
    includes(js, 'function spawnBurst', '3D 파티클');
    includes(js, 'function spawnSlam', '바닥 강타');
    includes(js, 'slamCrack', '바닥 균열');
    includes(js, 'launchDir', '코르크 반전 발사 방향');
    includes(js, 'Math.PI * easeOut3(k)', '코르크가 180° 돌아 앞장선다');
    includes(js, 'function updateShuttle', '셔틀콕 궤적');
    includes(js, 'quadratic(', '포물선으로 날아온다');
    /* 기존 타이밍 상수를 그대로 씁니다 */
    includes(js, 'RCx.WIND_MS', '백스윙 시각');
    includes(js, 'RCx.HIT_AT', '임팩트 시각');
    includes(js, 'RCx.SMASH_MS', '연출 길이');
  });

  test('v1.88 모션: 트위스트·쇼케이스·플립을 3D 회전으로, 화면 밖으로 나가지 않게', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'RC().motionPose', '기존 모션 곡선을 그대로 사용');
    includes(js, 'motionScale', '모션 중 살짝 줄여 화면 안에');
    includes(js, "motionKind === 'flip'", '플립');
    includes(js, "motionKind === 'twist'", '트위스트');
    includes(js, 'aimG.rotation', '3D 회전');
  });

  /* ============================================================
   * 6. 조작 — 드래그 360° · 톡 치면 스매시 · 꾸미기 부위 탭
   * ============================================================ */

  test('v1.88 조작: 드래그 회전·관성·짧은 탭 스매시·꾸미기 부위 탭이 그대로 동작한다', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, "cv.addEventListener('pointerdown'", '드래그 시작');
    includes(js, "cv.addEventListener('pointermove'", '드래그 회전');
    /* bm-v1.103.0 — 탭 판정을 누적 8px → 시작점 12px 기준으로 바꿨습니다 */
    includes(js, 'd.path > TAP_SLOP', '짧은 탭 판정(시작점 12px 안)');
    includes(js, 'if (mode !== \'paint\') { api.smash(); return; }', '스매시 모드에서 톡 = 스매시');
    includes(js, 'RC().pickSlot(host, ctx, slot)', '꾸미기 모드에서 부위 탭');
    includes(js, 'function slotAt', '레이캐스트로 부위 찾기');
    includes(js, "userData.slot = 'frame'", '테두리 슬롯');
    includes(js, "userData.slot = 'string'", '거트 슬롯');
    includes(js, "userData.slot = 'grip'", '그립 슬롯');
    /* 기존 API 모양 유지 (캡처·점검 스크립트가 같은 이름을 씁니다) */
    ['paint', 'fit', 'smash', 'slam', 'motion', 'hold', 'resume', 'view'].forEach(function (k) {
      includes(js, k + ':', k + ' API 유지');
    });
    includes(js, 'engine: \'three\'', '엔진 표시');
  });

  test('v1.88 정리: 시트를 닫으면 렌더러·컨텍스트를 정리한다(메모리 누수 방지)', function () {
    var js = readRoot('js/racket3d.js');
    includes(js, 'function dispose', '정리 함수');
    includes(js, 'WEBGL_lose_context', '컨텍스트 반환');
    includes(js, 'if (!cv.isConnected) { dispose(); return; }', '화면에서 빠지면 스스로 정리');
    includes(js, 'cancelAnimationFrame', '애니메이션 정지');
  });

  /* ============================================================
   * 7. 보호 · 버전
   * ============================================================ */

  test('v1.88 보호: 기존 기능·파츠·문구가 그대로다', function () {
    eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸 그대로');
    eq(RC.BODY_IDS.length, 4, '바디 4종 그대로');
    eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종 그대로');
    includes(RC.sheetBody(stateWith({ body: 'power77', unlocked: [], frame: 'matte', string: 'lime', grip: 'black', stencil: 'none', charm: 'none', effect: 'none' })), 'data-rk-3d', '3D 뷰 자리');
    includes(RC.sheetBody(stateWith({})), 'data-rk-share="1"', '공유 카드 버튼');
    includes(RC.sheetBody(stateWith({})), 'data-rk-restring="1"', '줄 갈았어요 버튼');
    includes(RC.stageHtml({ me: {}, data: {} }), 'data-rk-slam="1"', '바닥 강타 버튼');
    includes(readRoot('index.html'), 'data-tab="log"', '5개 탭');
  });

  test('v1.88 보호: 새 파일에도 실존 선수 이름·외부 브랜드가 없다', function () {
    ['js/racket3d.js', 'js/racketcustom.js', 'index.html', 'sw.js'].forEach(function (f) {
      var text = readRoot(f);
      ['김원호', '안세영', '서승재', '윤드로이드', '요넥스', 'YONEX', '빅터', '리닝'].forEach(function (n) {
        excludes(text, n, f + ' 에 ' + n + ' 없음');
      });
    });
    /* 우리 앱 이름만 각인 */
    includes(readRoot('js/racket3d.js'), 'SHUTTLIX', '샤프트 각인은 우리 이름');
  });

  test('v1.88 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.103.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.103.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.103.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.103.0', 'TWA 이름');
    eq(twa.appVersion, '1.103.0', 'TWA appVersion');
    eq(twa.appVersionCode, 97, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.103.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v188.test.js', '테스트 목록');
    includes(readRoot('test/run.js'), 'js/racket3d.js', '테스트가 3D 모듈을 함께 읽는다');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
