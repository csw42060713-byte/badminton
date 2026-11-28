/* ============================================================
 * test/v196.test.js — bm-v1.96.0
 *
 *   승우 님 요청(2026-11-28):
 *     "좀더 번개떨어지는 것처럼 얼음도 떨어지고 불도 떨어지게 하면 안될까?
 *      공칠때 돌릴때 다 다른임팩트"
 *     "히든도 다 손봐줘"  ·  "히든 안되는거 같은데?"
 *     "한2개 맞으면 그게 뜨게"  ·  "나머지가 뜨게"
 *     "3D 라켓 쇼룸에 ⛶ 전체화면 토글"
 *
 *   1) 화면 전체 낙하 — 얼음 고드름 · 화염 유성 · 별빛 · 금가루 (번개와 같은 스케일)
 *   2) 히든 7종 전면 업그레이드 (보이드 균열 · 얼음 창 · 불새 날개 · 바람 나선 ·
 *      트로피 광선 · 데이터 기둥 · 오로라 아치)
 *   3) 공 칠 때 vs 돌릴 때 완전 분리 — 회전 잔상(각속도) · 테마별 정타 임팩트
 *   4) 히든 조건 유연화(needIds) + 2/4 근접 시 힌트 해금·남은 조건 칩
 *   5) 3D 전체화면 토글 (dvh · ESC · resize)
 *   6) 성능 · 콘솔(셰이더 경고 없이) · 버전
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var RC = BM.racketcustom, R3 = BM.racket3d;
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
  function stateOf(custom) {
    var st = {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: [],
      data: BM.store.derive([], BM.seed.ME), drafts: {}, ui: {}, hearts: { balance: 9 }
    };
    st.me.theme = { theme: 'th_night', avatar: '🦋', gear: { custom: custom || null } };
    return st;
  }
  function wear(pairs) {
    var c = RC.blankCustom();
    var unlocked = [];
    pairs.forEach(function (k) {
      var cut = k.indexOf(':');
      var slot = k.slice(0, cut), id = k.slice(cut + 1);
      c[slot] = id;
      var it = RC.itemOf(slot, id);
      if (it && !it.free) unlocked.push(k);
    });
    c.unlocked = unlocked;
    return RC.normalizeCustom(c);
  }

  /* ============================================================
   * 1. 떨어지는 궤적 — 순수 함수
   * ============================================================ */

  test('v1.96 낙하: 조각은 화면 위에서 바닥까지 떨어지고 life 는 0~1 이다', function () {
    ['ice', 'fire', 'star', 'gold'].forEach(function (kind) {
      var cfg = R3.rainCfg(kind);
      ok(cfg.n >= 12 && cfg.n <= 40, kind + ' 조각 수 ' + cfg.n);
      ok(cfg.topY > 600, kind + ' 화면 위에서 시작');
      ok(cfg.floorY < -300, kind + ' 바닥까지');
      var prevY = null, fell = 0;
      for (var k = 0; k < cfg.n; k++) {
        var a = R3.rainDrop(k, 3.1, cfg);
        var b = R3.rainDrop(k, 3.15, cfg);
        ok(a.life >= 0 && a.life < 1, kind + ' life 범위');
        ok(a.y <= cfg.topY + 1 && a.y >= cfg.floorY - 1, kind + ' y 범위 ' + Math.round(a.y));
        ok(isFinite(a.x) && isFinite(a.z), kind + ' x·z 유한');
        if (b.life > a.life) { ok(b.y <= a.y + 0.001, kind + ' 내려간다'); fell++; }
      }
      ok(fell > cfg.n / 2, kind + ' 대부분 아래로');
      /* 같은 (k,t,cfg) 면 언제나 같은 자리 — 프레임이 밀려도 모양이 같다 */
      var p1 = R3.rainDrop(7, 2.5, cfg), p2 = R3.rainDrop(7, 2.5, cfg);
      eq(p1.x, p2.x, kind + ' 같은 입력 → 같은 x');
      eq(p1.y, p2.y, kind + ' 같은 입력 → 같은 y');
      /* 바닥에 닿은 뒤 흐른 시간 — 파편이 그 자리에서 터지는 데 씁니다 */
      ok(p1.age >= 0 && p1.age < 6, kind + ' age');
    });
    /* 종류마다 다르게 떨어진다 */
    var iceCfg = R3.rainCfg('ice'), fireCfg = R3.rainCfg('fire');
    ok(iceCfg.speed !== fireCfg.speed, '얼음과 불은 떨어지는 속도가 다르다');
    ok(iceCfg.spread !== fireCfg.spread, '퍼지는 폭도 다르다');
  });

  test('v1.96 낙하: 화면 위 → 바닥까지 실제로 내려오는 한 주기를 따라간다', function () {
    var cfg = R3.rainCfg('ice', 8);
    var k = 3, t0 = 0, seen = [];
    for (var i = 0; i < 400; i++) {
      var d = R3.rainDrop(k, t0 + i * 0.02, cfg);
      seen.push(d.y);
      if (seen.length > 2 && d.life < 0.02 && seen[seen.length - 2] > d.y + 40) {
        /* 한 바퀴 돌아 다시 위에서 시작 — 정상 순환 */
        ok(true, '순환 확인');
        break;
      }
    }
    var top = Math.max.apply(null, seen), bottom = Math.min.apply(null, seen);
    ok(top > 500, '위에서 시작 (' + Math.round(top) + ')');
    ok(bottom < -200, '아래까지 내려옴 (' + Math.round(bottom) + ')');
  });

  /* ============================================================
   * 2. 돌릴 때 vs 공 칠 때 — 상태 분리
   * ============================================================ */

  test('v1.96 회전: 가만히 있으면 0, 돌리면 세기가 커진다(각속도 비례)', function () {
    var idle = R3.spinStrengthOf({ yaw: 0.1, pitch: 0.1, roll: 0 }, { yaw: 0.102, pitch: 0.1004, roll: 0 }, 16);
    ok(idle === 0, '숨쉬는 흔들림은 0 (' + idle + ')');
    var slow = R3.spinStrengthOf({ yaw: 0 }, { yaw: 0.02 }, 16);   /* 1.25 rad/s */
    var fast = R3.spinStrengthOf({ yaw: 0 }, { yaw: 0.08 }, 16);   /* 5 rad/s */
    var fast2 = R3.spinStrengthOf({ yaw: 0 }, { yaw: 0.2 }, 16);   /* 12.5 rad/s */
    ok(slow > 0 && slow < fast, '느린 회전 < 빠른 회전');
    ok(fast2 >= fast, '더 빠르면 더 세다');
    ok(fast2 <= 1, '1을 넘지 않는다');
    eq(R3.spinStrengthOf(null, { yaw: 1 }, 16), 0, '이전 값이 없으면 0');
    /* 한 바퀴 감긴 각도도 짧은 쪽으로 계산 */
    var wrapped = R3.spinStrengthOf({ yaw: 3.1 }, { yaw: -3.1 }, 16);
    ok(wrapped <= 1 && wrapped >= 0, '각도 감김 처리');
  });

  test('v1.96 임팩트: 히든 7종이 각자 다른 종류로 갈린다', function () {
    var kinds = {};
    RC.HIDDEN_SETS.forEach(function (s) {
      var k = R3.impactKindOf(s.fx);
      ok(k && k !== 'none', s.id + ' 임팩트 종류');
      kinds[k] = (kinds[k] || 0) + 1;
    });
    /* 히든 7종은 서로 다른 폭발 — 겹치는 것은 보이드(팬텀)와 다크 오닉스(공개)뿐 */
    ok(Object.keys(kinds).length >= 6, '서로 다른 종류 ' + Object.keys(kinds).length + '가지');
    eq(R3.impactKindOf('lightning'), 'thunder', '썬더 골드 = 벼락');
    eq(R3.impactKindOf('voidbolt'), 'void', '팬텀 = 보이드');
    eq(R3.impactKindOf('snowstorm'), 'ice', '블리자드 = 얼음');
    eq(R3.impactKindOf('pillar'), 'fire', '불사조 = 불');
    eq(R3.impactKindOf('cyclone'), 'wind', '사이클론 = 바람');
    eq(R3.impactKindOf('confetti'), 'gold', '챔피언 = 금');
    eq(R3.impactKindOf('cyber'), 'neon', '네온 사이버 = 네온');
    eq(R3.impactKindOf('aurora'), 'aurora', '오로라');
    /* 효과(스매시) id 도 같은 갈래로 */
    eq(R3.impactKindOf('snow'), 'ice', '스노우 스톰 = 얼음');
    eq(R3.impactKindOf('blaze'), 'fire', '블레이즈 = 불');
    eq(R3.impactKindOf('wind'), 'wind', '에메랄드 윈드 = 바람');
    eq(R3.impactKindOf(''), 'none', '없음');
  });

  if (hasNode) {
    test('v1.96 3D: 돌릴 때의 연출과 정타 임팩트가 서로 다른 코드·상태다', function () {
      var js = readRoot('js/racket3d.js');
      /* bm-v1.104.0 — 돌릴 때 따라다니는 '실 같은 선'(회전 잔상 리본)은 없앴습니다.
       *  대신 링·스파크·글로우로 임팩트를 냅니다. */
      excludes(js, 'function updateSpinTrail', '회전 잔상 리본 제거');
      excludes(js, 'spinMesh', '리본 메시 제거');
      includes(js, 'function updateMotionFx', '모션 임팩트 갱신');
      includes(js, 'function fireMotionHit', '모션 한 방 발화');
      includes(js, 'function updateKit', '정타 임팩트');
      includes(js, 'function spawnKit', '정타 때 키트 뿌리기');
      includes(js, "spawnKit();       /* bm-v1.96.0 — 히든 테마별 폭발 */", '정타 순간에만 키트');
      /* 임팩트도 매 프레임 메시를 만들지 않는다 */
      var start = js.indexOf('function spawnMotionSparks');
      var end = js.indexOf('function ensureKit');
      var body = js.slice(start, end);
      excludes(body, 'new T.Mesh(', '프레임마다 메시 생성 없음');
      excludes(body, 'canvasDraw', '프레임마다 텍스처 없음');
      includes(body, 'mSpark.geometry.attributes.position.needsUpdate = true', '스파크 정점만 다시 씀');
    });

    test('v1.96 3D: 히든 7종 전용 대형 연출이 모두 들어 있다', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, 'function buildFloorRift', '팬텀 — 바닥 보이드 균열');
      includes(js, 'function buildVortexDisc', '팬텀 — 어둠 소용돌이');
      includes(js, 'function buildIceSpears', '블리자드 — 거대 얼음 창');
      includes(js, 'function buildFireWings', '불사조 — 불새 날개');
      includes(js, 'function buildWindHelix', '사이클론 — 3D 바람 나선');
      includes(js, 'function buildTrophyBeams', '챔피언 — 트로피 광선');
      includes(js, 'function buildDataColumns', '네온 — 데이터 기둥·스캔');
      includes(js, 'function buildAuroraArcs', '오로라 — 입체 아치');
      includes(js, 'out.bits.spears = buildIceSpears', '블리자드에 연결');
      includes(js, 'out.bits.wings = buildFireWings', '불사조에 연결');
      includes(js, 'out.bits.helix = buildWindHelix', '사이클론에 연결');
      includes(js, 'out.bits.columns = buildDataColumns', '네온에 연결');
      includes(js, 'out.bits.beams = buildTrophyBeams', '챔피언에 연결');
      includes(js, 'out.bits.arcs = buildAuroraArcs', '오로라에 연결');
      includes(js, 'out.bits.rift = buildFloorRift', '보이드 균열에 연결');
    });

    test('v1.96 3D: 얼음·불·별빛·금가루가 화면 전체로 쏟아진다', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, 'function buildRain', '낙하 연출 한 벌');
      includes(js, 'function animateRain', '낙하 갱신');
      includes(js, "kind: 'ice', col: col, col2: col2, n: fx === 'snowstorm' ? 26 : 16", '블리자드·프로스트 얼음 비');
      includes(js, "kind: 'fire', col: col, col2: col2, n: pillar ? 22 : 14", '불사조·블레이즈 불비');
      includes(js, "kind: 'star'", '오로라 별빛');
      includes(js, "kind: 'gold'", '챔피언 금가루');
      includes(js, 'function buildWeatherScene', '세트 없이 효과만 입어도 낙하');
      includes(js, "if (wKind === 'ice' || wKind === 'fire')", '효과만으로도 켜짐');
      includes(js, 'if (ss.rain) animateRain(ss.rain, t)', '세트 연출에서 함께 갱신');
    });

    test('v1.96 3D: 새 연출은 InstancedMesh 없이 그린다(셰이더 검증 경고 방지)', function () {
      var js = readRoot('js/racket3d.js');
      var rainStart = js.indexOf('function buildRain');
      var rainEnd = js.indexOf('function buildFloorRift');
      excludes(js.slice(rainStart, rainEnd), 'new T.InstancedMesh', '낙하에 InstancedMesh 없음');
      var kitStart = js.indexOf('function ensureKit');
      var kitEnd = js.indexOf('function applyKitTheme');
      excludes(js.slice(kitStart, kitEnd), 'new T.InstancedMesh', '임팩트 키트에도 없음');
      /* 기존 그로밋(줄 구멍)만 인스턴싱 유지 */
      includes(js, 'new T.InstancedMesh(gromGeo', '기존 그로밋은 그대로');
      eq((js.match(/new T\.InstancedMesh/g) || []).length, 1, 'InstancedMesh 는 한 곳뿐');
    });

    test('v1.96 3D: 정타 색이 세트 색으로 물든다(효과만 쓸 때는 팔레트)', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, 'function themeNow', '세트/효과 테마');
      includes(js, 'var th0 = themeNow()', '정타 준비에서 테마 확인');
      includes(js, 'applyKitTheme(th0)', '키트 색 적용');
      includes(js, "var cHot = th0.set ? th0.col2 : (pal0.hot || '#ffffff')", '세트가 있으면 세트 색');
      includes(js, 'shock.material.color = ringCol', '충격파도 같은 색');
    });
  }

  /* ============================================================
   * 3. 히든 조건 유연화 · 2/4 근접 안내
   * ============================================================ */

  test('v1.96 히든: 한 칸에 여러 파츠를 인정한다(needIds)', function () {
    ok(typeof RC.needIds === 'function', 'needIds 공개');
    eq(RC.needIds(['effect', ['snow', 'ice']]).join(','), 'snow,ice', '배열 그대로');
    eq(RC.needIds(['frame', 'ice']).join(','), 'ice', '단일 id 도 배열로');
    /* 히든 전부에 허용 목록이 하나 이상 있다 */
    var flex = RC.HIDDEN_SETS.filter(function (s) {
      return s.need.some(function (n) { return RC.needIds(n).length > 1; });
    });
    eq(flex.length, RC.HIDDEN_SETS.length, '히든 7종 모두 허용 목록');
    /* 스노우/얼음 어느 쪽이든 블리자드가 발동한다 */
    var bySnow = RC.activeSet(wear(['frame:ice', 'string:white', 'grip:white', 'effect:snow']));
    var byIce = RC.activeSet(wear(['frame:ice', 'string:ice', 'grip:ice', 'effect:ice']));
    eq(bySnow && bySnow.set.id, 'blizzard', '스노우 스톰으로 발동');
    eq(byIce && byIce.set.id, 'blizzard', '얼음 스매시로도 발동');
    /* 팬텀도 보이드/번개 어느 쪽이든 */
    var byThunder = RC.activeSet(wear(['frame:onyx', 'string:black', 'grip:violet', 'effect:thunder']));
    eq(byThunder && byThunder.set.id, 'phantom', '번개 효과로 팬텀');
    /* 불사조는 블레이즈로도 */
    var byBlaze = RC.activeSet(wear(['frame:red', 'string:crimson', 'grip:crimson', 'effect:blaze']));
    eq(byBlaze && byBlaze.set.id, 'phoenix', '블레이즈로 불사조');
    /* 힌트 문구는 조건에서 그대로 만들어져 어긋나지 않는다 */
    RC.HIDDEN_SETS.forEach(function (s) {
      eq(RC.autoHint(s), RC.needText(s), s.id + ' 힌트=조건');
      RC.needIds(s.need[0]).forEach(function () { ok(s.hint.indexOf('프레임') >= 0 || s.hint.indexOf('거트') >= 0, s.id + ' 힌트에 파츠 이름'); });
    });
  });

  test('v1.96 히든: 2개만 맞아도 근접 안내와 남은 조건이 바로 뜬다', function () {
    var st = stateOf(wear(['frame:ice', 'string:white']));
    var html = RC.setBonusHtml(st);
    includes(html, '히든 조합 힌트 해금', '근접 배너');
    includes(html, '2/4', '2/4 표시');
    includes(html, '남은 조건', '남은 조건 줄');
    /* 남은 파츠 이름이 그대로 보인다(그립·효과) */
    includes(html, '아크 화이트', '남은 그립 이름');
    includes(html, '스노우 스톰', '남은 효과 이름');
    includes(html, 'data-rk-hint-slot="grip"', '그립으로 바로 가는 칩');
    includes(html, 'data-rk-hint-slot="effect"', '효과로 바로 가는 칩');
    includes(html, '✓ 프레임', '맞춘 칸 체크');
    includes(html, 'is-near', '도감에서 강조');
    includes(html, '2/4 근접', '도감 근접 배지');
    /* 이름은 여전히 숨김 */
    excludes(html, '블리자드', '미발견 이름은 숨김');
    /* 1개만 맞으면 근접 배너는 없다 */
    var one = RC.setBonusHtml(stateOf(wear(['frame:ice'])));
    excludes(one, '히든 조합 힌트 해금', '1/4 에서는 배너 없음');
    /* 발견하면 이름이 보이고 '발동 중' */
    var found = wear(['frame:ice', 'string:white', 'grip:white', 'effect:snow']);
    found.found = ['blizzard'];
    var done = RC.setBonusHtml(stateOf(found));
    includes(done, '블리자드', '발견하면 이름');
    includes(done, '발동 중', '발동 표시');
  });

  test('v1.96 히든: 공개 4종도 진행률·조건이 그대로 보인다', function () {
    var html = RC.setBonusHtml(stateOf(wear(['frame:gold', 'string:gold'])));
    includes(html, '썬더 골드', '공개 세트 이름');
    includes(html, '2/3', '진행률');
    includes(html, '조합 도감', '도감');
    var on = RC.setBonusHtml(stateOf(wear(['frame:gold', 'string:gold', 'grip:gold'])));
    includes(on, '풀세트 발동', '공개 세트 발동');
    includes(on, '전체 낙뢰', '연출 이름');
  });

  if (hasNode) {
    test('v1.96 히든: 남은 조건 칩을 누르면 그 파츠 탭으로 이동한다', function () {
      var js = readRoot('js/racketcustom.js');
      includes(js, "var jump = ev.target.closest('[data-rk-hint-slot]')", '칩 클릭 처리');
      includes(js, 'activeSlot = jslot', '탭 이동');
      includes(js, 'refreshSheet(host, ctx)', '바로 다시 그리기');
      /* 배지·3D 는 같은 custom 에서 계산 — 파츠를 바꾸면 즉시 반영 */
      includes(js, 'body.innerHTML = sheetBody(ctx.store.state)', '배지 재계산');
      includes(js, 'mount3d(host, ctx)', '3D 다시 붙이기');
      includes(readRoot('js/racket3d.js'), 'if (look.sig !== looksig) rebuild()', '3D 는 서명이 바뀌면 세트 연출 재생성');
      includes(readRoot('js/racket3d.js'), 'setInfo ? setInfo.id :', '세트도 서명에 포함');
    });
  }

  /* ============================================================
   * 4. 3D 전체화면
   * ============================================================ */

  test('v1.96 전체화면: ⛶ 버튼 · 화면 전체 · 플로팅 컨트롤 · ESC 복귀', function () {
    var js = readRoot('js/racketcustom.js');
    includes(js, 'data-rk-full="1"', '전체화면 버튼');
    includes(js, 'function fullBtnHtml', '버튼 HTML');
    includes(js, "fullOn ? '✕' : '⛶'", '아이콘 전환');
    includes(js, 'function setFull(on, host)', '토글 함수');
    includes(js, "el.classList.toggle('is-full', fullOn)", '3D 칸 전체화면');
    includes(js, "sheetEl.classList.toggle('is-rkfull', fullOn)", '시트 전체화면');
    includes(js, "ev.key === 'Escape'", 'ESC 로 나가기');
    includes(js, 'a3.fit()', '캔버스·카메라 다시 맞춤');
    includes(js, 'fullOn = false;      /* 시트를 열 때는 항상 원래 크기로 */', '열 때 초기화');
    /* 버튼은 음소거 옆(오른쪽 위) */
    includes(js, 'soundBtnHtml() +\n        fullBtnHtml()', '🔊 옆에 ⛶');

    var css = readRoot('styles.css');
    includes(css, '100dvh', '화면 높이(dvh)');
    includes(css, '.rk3d.is-full', '전체화면 스타일');
    includes(css, '.sheet.is-rkfull .rksheet', '시트 안에서 3D 만 남김');
    includes(css, '.rk3d.is-full .rkstage', '플로팅 스매시·바닥 강타');
    includes(css, '.rk3d.is-full .rkmotions', '플로팅 모션 칩');
    includes(css, 'backdrop-filter: blur(8px)', '반투명 컨트롤');
  });

  if (hasNode) {
    test('v1.96 전체화면: 시트를 다시 그려도 상태가 유지되고 페이지가 넘치지 않는다', function () {
      var js = readRoot('js/racketcustom.js');
      includes(js, "if (host.classList) host.classList.toggle('is-rkfull', fullOn)", '다시 그려도 유지');
      includes(js, 'if (fullOn) [30, 140].forEach', '새 캔버스에 맞춰 재-fit');
      var css = readRoot('styles.css');
      /* 390px 폭에서 가로로 넘치지 않게: 전체화면도 시트 패널 폭(100%)을 그대로 씁니다 */
      includes(css, '.sheet.is-rkfull .sheet__panel {', '패널 폭은 시트 그대로');
      var block = css.slice(css.indexOf('.rk3d.is-full {'), css.indexOf('.rk3d.is-full .rk3d__cv'));
      excludes(block, '100vw', '뷰포트 단위로 폭을 늘리지 않음');
      includes(block, 'flex: 1 1 auto', '남는 높이를 그대로 채움');
    });
  }

  /* ============================================================
   * 5. 성능 · 콘솔 · 보호
   * ============================================================ */

  if (hasNode) {
    test('v1.96 성능: 새 연출도 프레임마다 텍스처·메시를 만들지 않는다', function () {
      var js = readRoot('js/racket3d.js');
      var start = js.indexOf('function animateSetScene');
      var end = js.indexOf('/* ============================================================\n   * 6. 셔틀콕', start);
      var body = js.slice(start, end);
      excludes(body, 'canvasDraw', '세트 갱신에 텍스처 굽기 없음');
      excludes(body, 'createElement', '캔버스 생성 없음');
      excludes(body, 'new T.Mesh(', '메시 생성 없음');
      var rainStart = js.indexOf('function animateRain');
      var rainEnd = js.indexOf('/* ---------- 히든·공개 세트를 위한 대형 연출들', rainStart);
      var rainBody = js.slice(rainStart, rainEnd);
      excludes(rainBody, 'canvasDraw', '낙하 갱신에 텍스처 없음');
      excludes(rainBody, 'createElement', '낙하 갱신에 캔버스 없음');
      excludes(rainBody, 'shadowBlur', 'shadowBlur 금지');
    });

    test('v1.96 보호: 기존 스매시·모션·세트 연출은 그대로다', function () {
      var js = readRoot('js/racket3d.js');
      includes(js, 'function spawnImpact', '기존 정타 연출');
      includes(js, 'function spawnSlam', '바닥 강타');
      includes(js, 'function buildBolts', '썬더 골드 낙뢰');
      includes(js, 'function buildFloorAura', '바닥 오라');
      includes(js, 'function buildShuttle', '셔틀콕');
      includes(js, 'function updateMotion', '모션');
      eq(RC.SETS.length, 11, '세트 11종 유지');
      eq(RC.MOTIONS.join(','), 'twist,showcase,flip', '모션 3종 유지');
      eq(RC.SLOTS.join(','), 'frame,string,grip,stencil,charm,effect', '파츠 6칸 유지');
      eq(RC.smashPalette('fire').mid, '#ff8a2f', '기존 팔레트 유지');
      eq(RC.priceOf('effect', 'fire'), 2, '가격 그대로');
    });

    test('v1.96 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
      includes(readRoot('sw.js'), "var VERSION = 'bm-v1.104.0'", 'sw 버전');
      includes(readRoot('app.js'), "version: 'v1.104.0'", 'app 버전');
      includes(readRoot('js/push.js'), "version: 'v1.104.0'", 'push 버전');
      includes(readRoot('index.html'), 'styles.css?v=20261128-6', '스타일 캐시 키');
      var twa = readJson('twa-manifest.json');
      eq(twa.appVersionName, '1.104.0', 'TWA 이름');
      eq(twa.appVersion, '1.104.0', 'TWA appVersion');
      eq(twa.appVersionCode, 98, 'TWA 코드');
      includes(readRoot('README.md'), 'bm-v1.104.0', 'README 변경 이력');
      includes(readRoot('test/run.js'), 'test/v196.test.js', '테스트 목록');
      includes(readRoot('sw.js'), 'bm-v1.104.0', 'sw 캐시 설명');
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
