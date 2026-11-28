/* ============================================================
 * racketcustom.js — 🏸 내 커스텀 라켓 (bm-v1.80.0)
 *
 *  "내 라켓이 지금 어떤 상태인지" 한눈에 보이게, 그리고 모으는 재미를 위해:
 *   ① 상단 오른쪽 미니 라켓 — 운동을 꾸준히 하면 짱짱·반짝(prime),
 *      3일 넘게 쉬면 줄이 느슨(worn), 7일 넘게 쉬거나 스트링 교체 시기가
 *      지나면 줄이 끊어진(broken) 모습으로 바뀝니다. 누르면 꾸미기 시트.
 *   ② 배드민턴 용품 감성 파츠 5칸 — 프레임 · 스트링 · 그립 · 스텐실 · 라켓 참.
 *      기본 파츠는 무료로 열려 있고, 나머지는 일지·출석·매칭으로 모으는
 *      '라켓 포인트'(일지 +10P · 출석 +5P · 매칭 +15P)로 원하는 것부터 해금.
 *      포인트는 저장하지 않고 지금까지의 기록에서 그때그때 계산합니다 —
 *      이미 일지가 있던 기존 사용자도 과거 기록만큼 바로 포인트가 생깁니다.
 *   ③ 저장 위치 — 새 시트 칸·새 DB 컬럼 없이 theme.gear.custom 한 칸.
 *
 *  실존 선수 이름은 예시·문구에 쓰지 않습니다(용품 이름·색만).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var hasDom = typeof document !== 'undefined';

  /* ---------- 등급 (bm-v1.81.0) ----------
   * 일반 · 레어 · 에픽 · 레전드 — 카드 테두리 글로우와 해금 가격이 등급을 따라갑니다. */
  var RARITY = {
    common: { id: 'common', name: '일반', color: '#9aa6b0', rank: 0 },
    rare: { id: 'rare', name: '레어', color: '#4aa3ff', rank: 1 },
    epic: { id: 'epic', name: '에픽', color: '#a678ff', rank: 2 },
    legend: { id: 'legend', name: '레전드', color: '#f2c14e', rank: 3 }
  };
  var RARITY_IDS = ['common', 'rare', 'epic', 'legend'];

  function rarityOf(r) { return RARITY[r] || RARITY.common; }

  /* ---------- 파츠 (실제 배드민턴 용품 감성의 색 이름만) ---------- */
  var PARTS = {
    frame: {
      label: '프레임', note: '라켓 몸통 색',
      items: [
        { id: 'matte', name: '매트 블랙', color: '#23272b', free: true, rarity: 'common' },
        { id: 'carbon', name: '스텔스 카본', color: '#3e4a55', heart: 2, rarity: 'rare' },
        { id: 'white', name: '아크 화이트', color: '#eef2f4', heart: 2, rarity: 'rare' },
        { id: 'navy', name: '로열 네이비', color: '#22409f', heart: 3, rarity: 'epic' },
        { id: 'red', name: '파이어 레드', color: '#e0433c', heart: 3, rarity: 'epic' },
        /* bm-v1.87.0 — 레전드 프레임: 검은 티타늄에 푸른 금속 광택(finish: 'metal') */
        { id: 'onyx', name: '오닉스 티타늄', color: '#1b1f26', heart: 4, rarity: 'legend', finish: 'metal', shine: '#b8c8d8' },
        /* bm-v1.95.0 — 세트 조합용 프레임: 골드 · 빙하 · 에메랄드 · 바이올렛 · 로즈
         *  금속 광택(finish: 'metal')은 3D 에서 실제 메탈 소재(거친 정도·환경 반사)로 그려집니다. */
        { id: 'gold', name: '챔피언 골드', color: '#e6b53c', heart: 4, rarity: 'legend', finish: 'metal', shine: '#fff4c2', note: '금빛 메탈 광택' },
        { id: 'ice', name: '글레이셔 블루', color: '#8fc9e6', heart: 3, rarity: 'epic', finish: 'metal', shine: '#e8f8ff', note: '서리 낀 메탈' },
        { id: 'emerald', name: '에메랄드 티탄', color: '#1f9d78', heart: 3, rarity: 'epic', finish: 'metal', shine: '#b6ffe6', note: '초록빛 메탈' },
        { id: 'violet', name: '미드나잇 바이올렛', color: '#4a3aa8', heart: 3, rarity: 'epic', finish: 'metal', shine: '#d9ccff', note: '보랏빛 메탈' },
        { id: 'rose', name: '로즈 쿼츠', color: '#d97d95', heart: 3, rarity: 'epic', finish: 'metal', shine: '#ffe3ea', note: '분홍빛 메탈' }
      ]
    },
    string: {
      label: '스트링', note: '줄 색',
      items: [
        { id: 'lime', name: '형광 라임', color: '#c6f24e', free: true, rarity: 'common' },
        { id: 'white', name: '화이트', color: '#f3f7ef', heart: 1, rarity: 'common' },
        { id: 'gold', name: '골드', color: '#f2c14e', heart: 2, rarity: 'rare' },
        { id: 'cobalt', name: '코발트 블루', color: '#3f7cf2', heart: 2, rarity: 'rare' },
        { id: 'pink', name: '핑크', color: '#ff7fb0', heart: 2, rarity: 'rare' },
        /* bm-v1.95.0 — 세트 조합용 거트: 크림슨 · 미드나잇 · 아이스 · 바이올렛 · 에메랄드 */
        { id: 'crimson', name: '크림슨', color: '#d63c3c', heart: 2, rarity: 'rare' },
        { id: 'black', name: '미드나잇 블랙', color: '#2b3036', heart: 2, rarity: 'rare' },
        { id: 'ice', name: '아이스 블루', color: '#a9e8ff', heart: 2, rarity: 'rare' },
        { id: 'violet', name: '바이올렛', color: '#8f7bf2', heart: 2, rarity: 'rare' },
        { id: 'emerald', name: '에메랄드', color: '#2fd6a5', heart: 2, rarity: 'rare' }
      ]
    },
    grip: {
      label: '그립', note: '손잡이 색',
      items: [
        { id: 'black', name: '블랙', color: '#1d2124', free: true, rarity: 'common' },
        { id: 'neon', name: '네온 라임', color: '#c6f24e', heart: 1, rarity: 'common' },
        { id: 'mint', name: '파스텔 민트', color: '#a8e6cf', heart: 1, rarity: 'common' },
        { id: 'coral', name: '코랄 핑크', color: '#ff9a8b', heart: 2, rarity: 'rare' },
        { id: 'purple', name: '퍼플', color: '#8f7bf2', heart: 2, rarity: 'rare' },
        /* bm-v1.87.0 — 에픽 그립: 실제 오버그립 감성의 타월 결 · 투톤 랩핑 (weave) */
        { id: 'towel', name: '타월 베이지', color: '#d9c6a5', heart: 3, rarity: 'epic', weave: 'towel', note: '보송보송 타월 결' },
        { id: 'twotone', name: '투톤 네온', color: '#c6f24e', color2: '#20252b', heart: 3, rarity: 'epic', weave: 'twotone', note: '네온 + 블랙 두 색' },
        /* bm-v1.95.0 — 세트 조합용 그립: 프레임·거트 색과 짝이 맞는 8색 전부
         *  weave: 'perf' 는 실제 오버그립처럼 촘촘한 천공(구멍) 결이 돋보이는 질감입니다. */
        { id: 'gold', name: '골드', color: '#e8b93f', heart: 2, rarity: 'rare', weave: 'perf', note: '금빛 천공 오버그립' },
        { id: 'crimson', name: '크림슨', color: '#c9302c', heart: 2, rarity: 'rare' },
        { id: 'ice', name: '아이스 블루', color: '#a9e8ff', heart: 2, rarity: 'rare', weave: 'perf', note: '서리빛 천공 오버그립' },
        { id: 'emerald', name: '에메랄드', color: '#2fbf92', heart: 2, rarity: 'rare' },
        { id: 'violet', name: '바이올렛', color: '#6f55d6', heart: 3, rarity: 'epic', weave: 'perf', note: '보랏빛 천공 오버그립' },
        { id: 'rose', name: '로즈 핑크', color: '#ffb0c6', heart: 2, rarity: 'rare' },
        { id: 'white', name: '아크 화이트', color: '#eef2f4', heart: 1, rarity: 'common', weave: 'towel', note: '보송보송 타월 결' },
        { id: 'sunset', name: '선셋 오렌지', color: '#ff8a5c', heart: 2, rarity: 'rare' }
      ]
    },
    stencil: {
      label: '스텐실', note: '헤드 마크',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common' },
        { id: 'x', name: 'X자 셔틀', color: '#f2c14e', heart: 2, rarity: 'rare' },
        { id: 'bolt', name: '번개', color: '#c6f24e', heart: 2, rarity: 'rare' },
        { id: 'crown', name: '왕관', color: '#f2c14e', heart: 3, rarity: 'epic' },
        { id: 'shuttle', name: '셔틀콕', color: '#eef2f4', heart: 2, rarity: 'rare' }
      ]
    },
    charm: {
      label: '라켓 참', note: '손잡이 위 작은 장식',
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common' },
        { id: 'medal', name: '체전 메달', color: '#f2c14e', heart: 3, rarity: 'epic' },
        { id: 'attend30', name: '30일 출석', color: '#c6f24e', heart: 2, rarity: 'rare' },
        { id: 'streak', name: '연속 7일', color: '#ff9a8b', heart: 2, rarity: 'rare' },
        { id: 'ace', name: '에이스', color: '#8fd0ff', heart: 5, rarity: 'legend' }
      ]
    },
    /* 색이 아니라 '연출' — 3D 라켓 캔버스에서 움직입니다 */
    effect: {
      label: '효과', note: '라켓 연출', fx: true,
      items: [
        { id: 'none', name: '없음', color: 'transparent', free: true, rarity: 'common', note: '깔끔한 기본 카본' },
        { id: 'speed', name: '스피드 링', color: '#7fd8ff', heart: 2, rarity: 'rare', note: '헤드 주변 회전 궤적' },
        { id: 'spark', name: '스파크 전기', color: '#9fd8ff', heart: 3, rarity: 'epic', note: '톡톡 튀는 전기 스파크' },
        { id: 'blaze', name: '블레이즈 오라', color: '#ff8a2f', heart: 3, rarity: 'epic', note: '헤드를 감싸는 불꽃' },
        { id: 'prism', name: '챔피언 프리즘', color: '#f2c14e', heart: 5, rarity: 'legend', note: '금빛 홀로그램 광채' },
        /* bm-v1.82.0 — 하트로 바로 여는 스페셜 스매시(포인트 아니라 하트) */
        { id: 'fire', name: '불꽃 스매시', color: '#ff7a2f', heart: 2, rarity: 'epic', smash: true, note: '터치하면 불꽃이 활짝' },
        { id: 'ice', name: '얼음 스매시', color: '#a9e8ff', heart: 3, rarity: 'epic', smash: true, note: '얼음 결정이 사방으로' },
        { id: 'thunder', name: '번개 셔틀', color: '#8fd0ff', heart: 3, rarity: 'legend', smash: true, note: '번개와 함께 셔틀 발사' },
        /* bm-v1.95.0 — 세트 색에 맞춘 임팩트(스매시) 6종 + 세트 연출과 짝을 이루는 색 */
        { id: 'goldbolt', name: '골드 번개', color: '#ffd84a', heart: 3, rarity: 'epic', smash: true, note: '금빛 번개가 사방으로' },
        { id: 'void', name: '보이드 스파크', color: '#8f6bff', heart: 3, rarity: 'epic', smash: true, note: '보랏빛 어둠 스파크' },
        { id: 'wind', name: '에메랄드 윈드', color: '#45e0b0', heart: 3, rarity: 'epic', smash: true, note: '초록 바람 소용돌이' },
        { id: 'blossom', name: '체리 블라썸', color: '#ff9ec4', heart: 3, rarity: 'epic', smash: true, note: '분홍 꽃잎이 흩날려' },
        { id: 'snow', name: '스노우 스톰', color: '#dff3ff', heart: 3, rarity: 'epic', smash: true, note: '눈보라가 몰아쳐' },
        { id: 'aurora', name: '오로라', color: '#9be7ff', heart: 3, rarity: 'legend', smash: true, note: '초록·보라 오로라' }
      ]
    }
  };
  /* ---------- 라켓 모션 (bm-v1.86.0) ----------
   * 3D 라켓을 눌러 감상하는 트릭 모션. 파츠 탭(SLOTS)에는 넣지 않고 3D 아래 칩으로만 보여 줍니다.
   *  · 기본 드래그 회전은 그대로 무료, 트릭 모션은 하트로 열고 칩에서 바로 재생합니다.
   *  · 'motion:id' 는 파츠와 같은 하트·열림 목록(unlocked)을 씁니다(서버 가격도 motion:...). */
  PARTS.motion = {
    label: '모션', note: '라켓 회전 연출',
    items: [
      { id: 'twist', name: '손목 트위스트', color: '#7fd8ff', heart: 1, rarity: 'rare', note: '8자 스핀 · 손목 기울임' },
      { id: 'showcase', name: '쇼케이스 스핀', color: '#f2c14e', heart: 2, rarity: 'epic', note: '한 바퀴 훑어 보기' },
      { id: 'flip', name: '공중 360° 플립', color: '#ff8a2f', heart: 3, rarity: 'legend', note: '공중 백플립 · 착지 반동' }
    ]
  };
  var MOTIONS = ['twist', 'showcase', 'flip'];

  var SLOTS = ['frame', 'string', 'grip', 'stencil', 'charm', 'effect'];
  var FX_TAB = { frame: '테두리', string: '거트', grip: '그립', stencil: '스텐실', charm: '참', effect: '효과' };

  /* ---------- 라켓 바디(모델) 4종 (bm-v1.81.0 · 실제 규격 비율 bm-v1.86.0) ----------
   * 실존 브랜드·모델 이름은 쓰지 않습니다(상표권) — 특징만 다르게 지은 오리지널 이름.
   *
   * bm-v1.86.0 — 선수용 라켓 실제 규격(전체 약 675mm)에 맞춰 숫자를 다시 잡았습니다.
   *   헤드 길이 236~241mm(전체의 35~36%) · 헤드 폭 190~196mm(헤드 길이의 80~82%)
   *   샤프트+콘 233~240mm(34~36%) · 그립 198~201mm(29~30%)
   *   샤프트 반지름 3.4~3.8mm(지름 6.8~7.6mm대) · 그립 반지름 13mm대(G5 둘레)
   * 숫자는 mm 를 그대로 쓴 모델 단위이고, 화면 배율은 geomOf·fit 이 맞춥니다.
   * (예전 값은 헤드가 37~38% 로 길고 샤프트가 두꺼워 통통해 보였습니다.)
   *
   * bm-v1.84.0 — 헤드 실루엣: 손으로 찍은 12점은 정수리·옆구리가 납작해 '네모'처럼 보였습니다.
   *   이제 달걀(물방울) 곡선 함수로 21점을 만들어 씁니다.
   *    · 위(정수리)는 sin^puff (puff<1) 로 어깨가 살아 둥근 아치,
   *    · 옆은 완만한 타원 곡선(직선 구간 없음),
   *    · 아래(목)는 T-조인트 쪽으로 자연스럽게 좁혀지는 비율(bot) — 바디마다 다르게. */
  function eggProfile(o) {
    o = o || {};
    var n = Math.max(12, o.n || 20);          /* 반쪽 제어점 수(위 0 → 아래 n) */
    var bot = o.bot == null ? 0.82 : o.bot;   /* 아래(목) 좁힘 — 1이면 안 좁아짐 */
    var puff = o.puff == null ? 0.9 : o.puff; /* 정수리·어깨 살집 — 작을수록 둥글고 넓음 */
    var crown = o.crown == null ? 0.06 : o.crown;  /* 정수리를 살짝 더 볼록하게 */
    var out = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n;                              /* 0 = 정수리, 1 = 목 */
      var th = Math.PI * t;
      var s = Math.sin(th);
      /* 정수리 쪽은 살집(puff<1)을 주고, 목 쪽은 puff=1 로 부드럽게 떨어뜨립니다.
       * (끝까지 puff<1 이면 목에서 접선이 꺾여 뾰족한 톱니가 보입니다) */
      var pf = puff + (1 - puff) * Math.pow(t, 0.6);
      var x = Math.pow(Math.max(0, s), pf);
      var narrow = 1 - (1 - bot) * Math.pow(t, 1.55);
      var y = -Math.cos(th);
      /* 정수리를 아주 살짝 볼록하게 — 전체 길이로 나눠 정수리 점이 가장 위가 되게 합니다
       * (나누지 않으면 정수리 점만 아래로 꺼져 가운데에 V자 홈이 생깁니다) */
      if (t < 0.5) y -= crown * Math.pow(1 - t * 2, 2);
      y = y / (1 + crown);
      out.push([Number((x * narrow).toFixed(4)), Number(y.toFixed(4))]);
    }
    /* 가장 넓은 점이 정확히 rx 가 되게 정규화 (바디마다 rx·ry 비율이 그대로 살아납니다) */
    var wide = 0;
    for (i = 0; i <= n; i++) wide = Math.max(wide, Math.abs(out[i][0]));
    if (wide > 0) for (i = 0; i <= n; i++) out[i][0] = Number((out[i][0] / wide).toFixed(4));
    out[0] = [0, -1];
    out[n] = [0, 1];
    /* 이음매(첫 점↔마지막 점)를 정수리에 두면 그 자리만 결이 보입니다.
     * 순서를 뒤집어 이음매를 목(목 아래 T-조인트에 가려지는 곳)으로 옮깁니다. */
    return out.reverse();
  }

  var BODIES = {
    power77: {
      id: 'power77', name: '파워 77', note: '헤드헤비 · 공격형',
      accent: '#ff7a2f', decal: 'slash', free: true, cost: 0, heart: 0, rarity: 'common',
      rx: 98, ry: 120.5, hoop: 10.4, shaftR: 3.6, gripR: 13.6,
      shaftLen: 236, gripLen: 198, tJoint: 24, cone: 26,
      profile: eggProfile({ bot: 0.8, puff: 0.88, crown: 0.07 })
    },
    aero: {
      id: 'aero', name: '스피드 에어로', note: '초경량 · 드라이브형',
      accent: '#7fd8ff', decal: 'ring', free: false, cost: 0, heart: 2, rarity: 'rare',
      rx: 97, ry: 119, hoop: 9.2, shaftR: 3.4, gripR: 13.2,
      shaftLen: 241, gripLen: 196, tJoint: 18, cone: 22,
      profile: eggProfile({ bot: 0.72, puff: 0.95, crown: 0.05 })
    },
    control: {
      id: 'control', name: '컨트롤 아크', note: '올라운드 · 밸런스형',
      accent: '#f2c14e', decal: 'wing', free: false, cost: 0, heart: 3, rarity: 'epic',
      rx: 97.5, ry: 120, hoop: 9.9, shaftR: 3.5, gripR: 13.5,
      shaftLen: 231, gripLen: 204, tJoint: 21, cone: 26,
      profile: eggProfile({ bot: 0.84, puff: 0.9, crown: 0.06 })
    },
    smash: {
      id: 'smash', name: '스매시 맥스', note: '콤팩트 헤드 · 극공격',
      accent: '#cfd8e4', decal: 'block', free: false, cost: 0, heart: 5, rarity: 'legend',
      rx: 95, ry: 118, hoop: 11.2, shaftR: 3.8, gripR: 13.9,
      shaftLen: 245, gripLen: 194, tJoint: 28, cone: 28,
      profile: eggProfile({ bot: 0.82, puff: 0.86, crown: 0.08 })
    }
  };
  var BODY_IDS = ['power77', 'aero', 'control', 'smash'];
  var DEFAULT_BODY = 'power77';

  function bodyOf(id) { return BODIES[id] || BODIES[DEFAULT_BODY]; }

  /* bm-v1.84.0 — '라켓 포인트(P)' 폐지: 바디·테두리·거트·그립·스텐실·참·효과를 **전부 하트(♥)**로 삽니다.
   *  · 잔액은 앱 전체와 같은 하트 원장(state.data.hearts) — 출석·광고·연속보너스로 모읍니다.
   *  · 실제 차감은 Supabase 모드에서 서버 함수 heart_spend('racket', 'slot:id')가 합니다
   *    (supabase/heart-rpc-v1.84-racket.sql). 기기 저장 모드는 같은 자리에 구매 행을 남깁니다.
   *  · 기본 파츠·기본 바디(파워 77)는 무료, 나머지는 등급에 맞춰 하트 1~5개. */
  var HEART_PRICE = { common: 1, rare: 2, epic: 3, legend: 5 };

  function itemsOf(slot) {
    if (slot === 'body') return BODY_IDS.map(function (id) { return BODIES[id]; });
    return (PARTS[slot] && PARTS[slot].items) || [];
  }
  function itemOf(slot, id) {
    var list = itemsOf(slot);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function freeId(slot) {
    var list = itemsOf(slot);
    for (var i = 0; i < list.length; i++) if (list[i].free) return list[i].id;
    return list.length ? list[0].id : '';
  }
  function colorOf(slot, id) {
    var it = itemOf(slot, id);
    return it ? it.color : 'transparent';
  }

  /* 이 파츠를 열 때 드는 하트 — 아이템에 적힌 값이 우선, 없으면 등급 가격 */
  function priceOf(slot, id) {
    var it = itemOf(slot, id);
    if (!it || it.free) return 0;
    if (it.heart) return it.heart;
    return HEART_PRICE[it.rarity] || 2;
  }

  /* 예전 이름(포인트)을 쓰던 곳이 있어도 하트 가격을 돌려줍니다 — 화면은 '❤ n'만 씁니다 */
  function costOf(slot, id) { return priceOf(slot, id); }

  /* 하트로 사는 파츠 — 아이템에 적힌 heart 값을 그대로 씁니다 */
  function heartCostOf(slot, id) {
    var it = itemOf(slot, id);
    return (it && !it.free) ? priceOf(slot, id) : 0;
  }

  function isHeartItem(slot, id) { return heartCostOf(slot, id) > 0; }

  /* ============================================================
   * 파츠 풀세트 조합 보너스 (bm-v1.95.0)
   *
   *  프레임 · 거트 · 그립(히든은 효과·참까지)을 한 계열로 맞추면 3D 쇼룸에서
   *  라켓 아래 바닥 오라 색이 바뀌고, 세트마다 다른 특수 연출이 켜집니다.
   *
   *  · 공개 4종 — 조건을 화면에 그대로 보여 줍니다(무엇을 사면 되는지 바로 보임).
   *  · 히든 7종 — 조건을 숨기고 '??? 히든 조합 (0/7 발견)'으로만 표시합니다.
   *    맞추는 순간 축하 토스트 + 3D 연출 + 발견 목록에 영구 기록(found).
   *  · 모든 조건은 실제로 존재하는 파츠 id 만 씁니다 — 어떤 조합도 100% 발동 가능합니다
   *    (test/v195.test.js 가 SETS 의 모든 need 를 PARTS 와 대조합니다).
   *  · 저장은 지금처럼 theme.gear.custom 한 칸 — 그 안에 found 배열만 더합니다
   *    (새 시트 칸·새 DB 컬럼 없음, 예전 저장값과 그대로 호환).
   * ============================================================ */
  var SETS = [
    /* ---------- 히든 7 (먼저 — 같은 조합이면 히든이 우선) ---------- */
    {
      id: 'phantom', name: '팬텀 라이트닝', emoji: '🌩', hidden: true, fx: 'voidbolt',
      color: '#a487ff', color2: '#efe6ff', tag: '보랏빛 낙뢰', hint: '오닉스 티타늄 프레임 · 미드나잇 블랙 거트 · 바이올렛 그립 · 보이드/번개/골드번개 효과',
      desc: '보랏빛 번개가 어둠 속에서 라켓으로 떨어져요',
      need: [['frame', 'onyx'], ['string', 'black'], ['grip', 'violet'], ['effect', ['void', 'thunder', 'goldbolt']]]
    },
    {
      id: 'blizzard', name: '블리자드', emoji: '🌨', hidden: true, fx: 'snowstorm',
      color: '#d5f0ff', color2: '#9ed8ff', tag: '절대영도 눈보라', hint: '글레이셔 블루 프레임 · 화이트/아이스 거트 · 아크 화이트/아이스 그립 · 스노우/얼음/에메랄드 효과',
      desc: '쇼룸 전체에 눈보라가 몰아치고 바닥이 얼어붙어요',
      need: [['frame', 'ice'], ['string', ['white', 'ice']], ['grip', ['white', 'ice']], ['effect', ['snow', 'ice', 'wind']]]
    },
    {
      id: 'phoenix', name: '불사조', emoji: '🔥', hidden: true, fx: 'pillar',
      color: '#ff8a2f', color2: '#ffd166', tag: '불꽃 기둥', hint: '파이어 레드 프레임 · 크림슨 거트·그립 · 불꽃/블레이즈/블라썸 효과',
      desc: '바닥에서 불꽃 기둥이 솟아오르고 불티가 흩날려요',
      need: [['frame', 'red'], ['string', 'crimson'], ['grip', 'crimson'], ['effect', ['fire', 'blaze', 'blossom']]]
    },
    {
      id: 'cyclone', name: '사이클론', emoji: '🌪', hidden: true, fx: 'cyclone',
      color: '#45e0b0', color2: '#c6ffe9', tag: '태풍 소용돌이', hint: '에메랄드 티탄 프레임·그립 · 형광 라임 거트 · 에메랄드 윈드/스피드 효과',
      desc: '라켓 둘레로 바람 링이 돌고 초록 소용돌이가 솟아요',
      need: [['frame', 'emerald'], ['string', 'lime'], ['grip', 'emerald'], ['effect', ['wind', 'speed']]]
    },
    {
      id: 'champion', name: '챔피언 골드', emoji: '🏆', hidden: true, fx: 'confetti',
      color: '#ffd166', color2: '#fff3c4', tag: '금가루 컨페티', hint: '아크 화이트 프레임 · 골드 거트·그립 · 체전 메달/에이스 참',
      desc: '금가루가 눈처럼 내리고 챔피언 메달이 빛나요',
      need: [['frame', 'white'], ['string', 'gold'], ['grip', 'gold'], ['charm', ['medal', 'ace']]]
    },
    {
      id: 'cyber', name: '네온 사이버', emoji: '🟩', hidden: true, fx: 'cyber',
      color: '#7cffd4', color2: '#c6f24e', tag: '네온 그리드', hint: '스텔스 카본 프레임 · 형광 라임 거트 · 민트 그립 · 에메랄드 윈드/스피드 효과',
      desc: '바닥에 네온 그리드가 켜지고 빛줄기가 돌아요',
      need: [['frame', 'carbon'], ['string', 'lime'], ['grip', 'mint'], ['effect', ['speed', 'wind']]]
    },
    {
      id: 'aurora', name: '프리즘 오로라', emoji: '🌌', hidden: true, fx: 'aurora',
      color: '#9be7ff', color2: '#b48cff', tag: '오로라 커튼', hint: '미드나잇 바이올렛 프레임·그립 · 바이올렛 거트 · 오로라/프리즘 효과',
      desc: '라켓 뒤로 초록·보라 오로라 커튼이 흘러요',
      need: [['frame', 'violet'], ['string', 'violet'], ['grip', 'violet'], ['effect', ['aurora', 'prism']]]
    },
    /* ---------- 공개 4 (조건을 화면에 그대로) ---------- */
    {
      id: 'thunderGold', name: '썬더 골드', emoji: '⚡', hidden: false, fx: 'lightning',
      color: '#ffd200', color2: '#fff6c2', tag: '전체 낙뢰', tone: '노랑',
      desc: '화면 위에서 노란 번개가 라켓으로 내리쳐요',
      need: [['frame', 'gold'], ['string', 'gold'], ['grip', 'gold']]
    },
    {
      id: 'blazeRed', name: '블레이즈 레드', emoji: '🔥', hidden: false, fx: 'flame',
      color: '#ff5a2f', color2: '#ffc36b', tag: '불꽃 오라', tone: '레드',
      desc: '바닥에서 불티가 솟고 라켓이 붉게 달아올라요',
      need: [['frame', 'red'], ['string', 'crimson'], ['grip', ['coral', 'crimson']]]
    },
    {
      id: 'frostIce', name: '프로스트 아이스', emoji: '❄', hidden: false, fx: 'frost',
      color: '#a9e8ff', color2: '#ffffff', tag: '서리 오라', tone: '블루',
      desc: '바닥이 얼어붙고 서리 결정이 천천히 떠다녀요',
      need: [['frame', 'white'], ['string', ['cobalt', 'ice']], ['grip', ['ice', 'white']]]
    },
    {
      id: 'darkOnyx', name: '다크 오닉스', emoji: '🌑', hidden: false, fx: 'void',
      color: '#8a6cff', color2: '#d9ccff', tag: '어둠 스파크', tone: '블랙',
      desc: '보랏빛 어둠 스파크가 라켓을 감싸요',
      need: [['frame', 'onyx'], ['string', 'black'], ['grip', 'black']]
    }
  ];
  var HIDDEN_SETS = SETS.filter(function (s) { return s.hidden; });

  function setById(id) {
    for (var i = 0; i < SETS.length; i++) if (SETS[i].id === id) return SETS[i];
    return null;
  }

  /* bm-v1.96.0 — 조건 하나가 받아 주는 파츠 id 목록
   *  힌트만 보고 맞춰도 발동하게, 한 칸에 여러 파츠를 허용할 수 있습니다.
   *  예) ['effect', ['snow', 'ice']] → 스노우 스톰이든 얼음 스매시든 인정 */
  function needIds(need) {
    return Array.isArray(need && need[1]) ? need[1] : [need && need[1]];
  }

  /* 이 세트에서 지금 몇 파츠가 맞았는지 — 화면의 '2/3 노랑 파츠' 숫자
   *  · setHitRaw 는 이미 정리된 custom 을 그대로 받습니다(3D 가 매 프레임 부를 때
   *    정리(normalizeCustom)를 되풀이하지 않도록). */
  function setHitRaw(c, set) {
    var out = [];
    for (var i = 0; i < set.need.length; i++) {
      var need = set.need[i];
      var ids = needIds(need);
      var curId = c[need[0]];
      var got = ids.indexOf(curId) >= 0;
      var it = itemOf(need[0], got ? curId : ids[0]);
      out.push({
        slot: need[0], id: ids[0], ids: ids, got: got, curId: curId,
        name: ids.map(function (id) {
          var x = itemOf(need[0], id);
          return x ? x.name : id;
        }).join(' / '),
        label: (PARTS[need[0]] && PARTS[need[0]].label) || need[0]
      });
    }
    var hits = out.filter(function (n) { return n.got; }).length;
    return { need: out, hits: hits, total: out.length, complete: hits === out.length };
  }
  function setHit(c, set) { return setHitRaw(normalizeCustom(c), set); }

  /* 지금 입은 조합에서 발동한 세트(여럿이면 히든 우선, 그다음 파츠가 많이 맞은 것) */
  function activeSetRaw(c) {
    var best = null, bestScore = -1;
    for (var i = 0; i < SETS.length; i++) {
      var h = setHitRaw(c, SETS[i]);
      if (!h.complete) continue;
      var score = (SETS[i].hidden ? 100 : 0) + h.hits;
      if (score > bestScore) { best = { set: SETS[i], hit: h }; bestScore = score; }
    }
    return best;
  }
  function activeSet(c) { return activeSetRaw(normalizeCustom(c)); }

  /* 공개 세트 중 가장 가까운 것 — 아직 아무것도 발동하지 않았을 때 'N/M' 안내 */
  function nextSet(c) {
    c = normalizeCustom(c);
    var best = null, bestHits = -1;
    for (var i = 0; i < SETS.length; i++) {
      if (SETS[i].hidden) continue;
      var h = setHitRaw(c, SETS[i]);
      if (h.complete) continue;
      if (h.hits > bestHits) { best = { set: SETS[i], hit: h }; bestHits = h.hits; }
    }
    return best;
  }

  /* 발견한 히든 세트 id 목록 — 저장값(found)은 아는 id 만 남깁니다 */
  function foundOf(c) {
    c = normalizeCustom(c);
    return (c.found && c.found.length) ? c.found.slice(0) : [];
  }

  function hiddenFoundCount(c) { return foundOf(c).length; }

  /* 방금 새로 맞춘 히든 세트 — 저장 직후 축하 연출에 씁니다 */
  function newlyFound(c) {
    var have = foundOf(c);
    var out = [];
    for (var i = 0; i < HIDDEN_SETS.length; i++) {
      var s = HIDDEN_SETS[i];
      if (have.indexOf(s.id) >= 0) continue;
      if (setHit(c, s).complete) out.push(s);
    }
    return out;
  }

  function needText(set) {
    return set.need.map(function (n) {
      var ids = needIds(n);
      var names = ids.map(function (id) {
        var it = itemOf(n[0], id);
        return it ? it.name : id;
      }).join('/');
      return ((PARTS[n[0]] && PARTS[n[0]].label) || n[0]) + ' ' + names;
    }).join(' · ');
  }

  /* ============================================================
   * bm-v1.97.0 — '⚡ 바로 완성하기' : 이미 한 번 맞춘 조합을 원톡으로 다시 입기
   *
   *  · 공개 4종: 조건 파츠를 **모두 갖고 있으면** 맞출 수 있는 조합입니다(한 번 맞춘 뒤
   *    파츠 하나를 바꿔 조합이 풀렸을 때 원톡으로 되돌리는 용도).
   *  · 히든 7종: 발견 목록(found)에 기록된 조합만 대상입니다(발견 전엔 '???').
   *  · 조금이라도 이미 맞아 있는 파츠는 그대로 두고, 빈 자리만 보유 파츠로 채웁니다.
   *  · 보유하지 않은 파츠가 있으면 **보유한 것만** 맞추고 몇 개가 남았는지 알려 줍니다
   *    (관리자 계정은 전체 해금이라 항상 전부 장착).
   *  어떤 조합도 하트를 쓰지 않습니다 — 이미 연 파츠로 입는 것뿐입니다.
   * ============================================================ */
  function setApplyPlan(c, set, admin) {
    var st = normalizeCustom(c);
    if (!set || !set.need) return { set: set, steps: [], missing: [], complete: false, changed: 0 };
    var steps = [], missing = [], changed = 0;
    for (var i = 0; i < set.need.length; i++) {
      var need = set.need[i];
      var slot = need[0];
      var ids = needIds(need);
      var curId = st[slot];
      if (ids.indexOf(curId) >= 0) { steps.push({ slot: slot, id: curId, now: true }); continue; }
      var pick = '';
      for (var j = 0; j < ids.length; j++) {
        if (admin || isUnlocked(st, slot, ids[j]) || priceOf(slot, ids[j]) === 0) { pick = ids[j]; break; }
      }
      if (pick) { steps.push({ slot: slot, id: pick, now: false }); changed++; }
      else {
        missing.push({ slot: slot, id: ids[0], name: itemOf(slot, ids[0]) ? itemOf(slot, ids[0]).name : ids[0],
          label: (PARTS[slot] && PARTS[slot].label) || slot });
      }
    }
    return { set: set, steps: steps, missing: missing, complete: missing.length === 0, changed: changed };
  }

  /* 이 조합을 "이미 한 번 맞춘" 것으로 볼 수 있는지 — 공개는 갖고 있는 파츠만으로 맞출 수 있을 때,
   * 히든은 발견 목록에 있을 때 */
  function setMine(c, set, admin) {
    if (!set) return false;
    var st = normalizeCustom(c);
    if (set.hidden) {
      if (foundOf(st).indexOf(set.id) >= 0) return true;
      return admin && setHitRaw(st, set).complete;
    }
    if (setHitRaw(st, set).complete) return true;
    for (var i = 0; i < set.need.length; i++) {
      var ids = needIds(set.need[i]);
      var ok = false;
      for (var j = 0; j < ids.length; j++) {
        if (admin || isUnlocked(st, set.need[i][0], ids[j]) || priceOf(set.need[i][0], ids[j]) === 0) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }

  /* 조합을 실제로 입니다 — refreshSheet 이 3D까지 다시 그립니다 */
  function applySet(host, ctx, id) {
    var set = setById(String(id || ''));
    if (!set || !ctx || !ctx.store) return false;
    var st = ctx.store.state;
    var cur = customOf(st.me);
    var admin = isAdminUser(st);
    var curSet = activeSetRaw(normalizeCustom(cur));
    if (curSet && curSet.set.id === set.id) {
      if (BM.ui) BM.ui.toast('이미 ' + set.name + ' 조합으로 맞춰져 있어요');
      return false;
    }
    var plan = setApplyPlan(cur, set, admin);
    if (!plan.steps.length) {
      if (BM.ui) BM.ui.toast('이 조합에 쓸 파츠를 아직 갖고 있지 않아요', 'error');
      return false;
    }
    var next = normalizeCustom(cur);
    plan.steps.forEach(function (p) {
      next[p.slot] = p.id;
      if (admin && next.unlocked.indexOf(p.slot + ':' + p.id) < 0) next.unlocked.push(p.slot + ':' + p.id);
    });
    if (!saveCustom(ctx, next, { toast: '⚡ ' + set.emoji + ' ' + set.name + ' 조합 완성!' })) return false;
    if (plan.missing.length && BM.ui) {
      BM.ui.toast('아직 못 연 파츠 ' + plan.missing.length + '개는 그대로 뒀어요 · ' +
        plan.missing.map(function (m) { return m.label + ' ' + m.name; }).join(', '), 'error');
    }
    if (host && ctx) refreshSheet(host, ctx);
    return true;
  }

  /* 힌트 문구를 조건에서 바로 만듭니다 — 힌트와 실제 필요 파츠가 어긋나지 않게 */
  function autoHint(set) { return needText(set); }

  /* 저장하는 순간 맞춘 히든 조합을 발견 목록에 합칩니다.
   *  · 파츠를 사면서(setGear) 바로 완성되는 경우도 있어, 화면 저장 경로뿐 아니라
   *    store.setGear 한 곳에서도 부르도록 내보냅니다(모든 장착 경로가 같은 기록). */
  function mergeFound(next) {
    var c = normalizeCustom(next);
    var added = newlyFound(c);
    if (added.length) {
      added.forEach(function (s) { if (c.found.indexOf(s.id) < 0) c.found.push(s.id); });
    }
    return { custom: c, added: added };
  }

  /* ---------- 저장 모양 ---------- */

  function blankCustom() {
    var o = { unlocked: [], body: DEFAULT_BODY, found: [] };
    SLOTS.forEach(function (slot) { o[slot] = freeId(slot); });
    return o;
  }

  function normalizeCustom(o) {
    if (typeof o === 'string') o = U.jsonParse(o, null);
    if (!o || typeof o !== 'object') return blankCustom();
    var out = blankCustom();
    out.body = BODIES[String(o.body == null ? '' : o.body)] ? String(o.body) : DEFAULT_BODY;
    SLOTS.forEach(function (slot) {
      var want = String(o[slot] == null ? '' : o[slot]).trim();
      /* 열지 않은 파츠를 입고 있으면 기본 파츠로 되돌립니다(기록이 깨져도 화면은 안전) */
      out[slot] = itemOf(slot, want) ? want : freeId(slot);
    });
    /* bm-v1.95.0 — 발견한 히든 조합(찾은 것만, 아는 id 만). 예전 저장값에는 없으므로 빈 배열 */
    out.found = [];
    var fseen = {};
    (Array.isArray(o.found) ? o.found : []).forEach(function (raw) {
      var id = String(raw == null ? '' : raw).trim();
      var st = setById(id);
      if (!st || !st.hidden || fseen[id]) return;
      fseen[id] = 1;
      out.found.push(id);
    });
    var seen = {};
    var list = Array.isArray(o.unlocked) ? o.unlocked : [];
    out.unlocked = [];
    list.forEach(function (raw) {
      var s = String(raw == null ? '' : raw).trim();
      var cut = s.indexOf(':');
      if (cut < 0) return;
      var slot = s.slice(0, cut), id = s.slice(cut + 1);
      if (SLOTS.indexOf(slot) < 0 && slot !== 'body' && slot !== 'motion') return;
      var it = itemOf(slot, id);
      if (!it || it.free) return;
      if (seen[s]) return;
      seen[s] = 1;
      out.unlocked.push(slot + ':' + id);
      /* bm-v1.95.0 — 파츠가 67종으로 늘어 예전 상한(40)이면 다 산 사람의 기록이 잘립니다.
       *  한 사람이 열 수 있는 최대치(비무료 파츠 60 + 모션 3)보다 넉넉하게 둡니다. */
      if (out.unlocked.length >= 80) return;
    });
    /* 입고 있는 파츠가 열려 있지 않으면 기본 파츠로 되돌립니다(예전 값·직접 고친 값 보정).
     * 열림 목록은 저장된 그대로만 믿습니다 — 그래야 포인트로 연 파츠만 쓸 수 있습니다. */
    SLOTS.forEach(function (slot) {
      var id = out[slot];
      if (!isUnlocked(out, slot, id)) out[slot] = freeId(slot);
    });
    if (!isUnlocked(out, 'body', out.body)) out.body = DEFAULT_BODY;
    return out;
  }

  /* 파츠 슬롯(모션 포함) 판정 — 저장소·서버가 같은 기준을 씁니다 */
  function isPartSlot(slot) {
    var s2 = String(slot || '');
    return s2 === 'body' || s2 === 'motion' || SLOTS.indexOf(s2) >= 0;
  }

  function isUnlocked(c, slot, id) {
    var it = itemOf(slot, id);
    if (!it) return false;
    if (it.free) return true;
    return (c && c.unlocked || []).indexOf(slot + ':' + id) >= 0;
  }

  function hasCustom(c) {
    c = normalizeCustom(c);
    if (c.unlocked.length || c.found.length) return true;
    for (var i = 0; i < SLOTS.length; i++) {
      if (c[SLOTS[i]] !== freeId(SLOTS[i])) return true;
    }
    return false;
  }

  function customOf(me) {
    var g = BM.gear ? BM.gear.gearOf(me) : ((me && me.theme && me.theme.gear) || null);
    return normalizeCustom(g && g.custom);
  }

  /* 다른 사람의 라켓 — 프로필 행의 꾸미기 JSON에서 꺼냅니다 */
  function customFor(state, userKey) {
    var me = state && state.me;
    if (me && userKey === me.key) return customOf(me);
    var idx = state && state.data && state.data.idx;
    if (!idx || !BM.domain) return blankCustom();
    var p = BM.domain.profileOf(idx, userKey);
    return normalizeCustom(p && p.theme && p.theme.gear && p.theme.gear.custom);
  }

  function specText(c) {
    c = normalizeCustom(c);
    return SLOTS.map(function (slot) {
      var it = itemOf(slot, c[slot]);
      return it ? it.name : '';
    }).filter(function (v) { return v && v !== '없음'; }).join(' · ');
  }

  /* ---------- 등급 — 입고 있는 것 중 가장 높은 등급 ---------- */
  function rarityRankOf(c) {
    var c2 = normalizeCustom(c);
    var best = rarityOf(bodyOf(c2.body).rarity).rank;
    SLOTS.forEach(function (slot) {
      var it = itemOf(slot, c2[slot]);
      if (it) best = Math.max(best, rarityOf(it.rarity).rank);
    });
    return best;
  }

  function topRarity(c) { return RARITY[RARITY_IDS[rarityRankOf(c)]]; }

  function rarityNameOf(slot, id) {
    var it = itemOf(slot, id);
    return rarityOf(it && it.rarity).name;
  }

  /* ---------- 하트 잔액 (bm-v1.84.0 — 포인트 폐지) ----------
   * 앱 전체와 같은 원장(store.state.data.hearts)을 그대로 읽습니다.
   * 화면은 '보유 하트 ❤ N'과 '부족하면 출석·광고로 충전'만 보여 줍니다. */
  function heartNow(state) {
    var h = state && state.data && state.data.hearts;
    return Math.max(0, Number(h && h.balance) || 0);
  }

  /* 오늘 새로 모은 것 — 포인트가 없어져 화면의 '+P' 표시는 더 쓰지 않습니다 */
  function pointsToday() { return 0; }

  /* 지금 열어 둔 파츠 수 — 시트의 '내가 연 파츠' 줄에 씁니다 */
  function ownedCount(state) {
    var c = customOf(state && state.me);
    return c.unlocked.length;
  }

  /* 관리자(csw42060713@gmail.com)는 모든 바디·파츠·효과가 열려 있습니다.
   *  · 구매 버튼을 눌러도 하트를 빼지 않고, 그 선택을 unlocked 에 적어 둡니다
   *    (적어 두어야 normalizeCustom 이 '안 연 파츠'로 되돌리지 않습니다). */
  function isAdminUser(state) {
    return !!(BM.domain && typeof BM.domain.isAdminMe === 'function' && BM.domain.isAdminMe(state && state.me));
  }

  /* ---------- 상태 (운동 빈도 + 스트링 교체 시기) ---------- */
  var TIRED_DAYS = 3;      /* 이만큼 쉬면 줄이 느슨 */
  var BROKEN_DAYS = 7;     /* 이만큼 쉬면 줄이 끊어진 느낌 */

  function lastLogDate(state) {
    var recs = (state && state.data && state.data.records) || [];
    return recs.length ? (recs[0].date || '') : '';
  }

  function daysBetween(fromYmd, toYmd) {
    var a = U.parseYmd(fromYmd), b = U.parseYmd(toYmd);
    if (!a || !b) return null;
    return Math.round((b - a) / 86400000);
  }

  /* 교체일만 적어 둔 사람도 날짜는 세도록 — 라켓 이름 없이 '오늘 갈았어요'만 눌러도 동작 */
  function statusFor(g, now) {
    if (!BM.gear) return { state: 'empty', has: false };
    var gg = BM.gear.normalizeGear(g);
    if (!gg || !gg.strungAt) return BM.gear.statusOf(gg, now || null);
    return BM.gear.statusOf({
      racket: gg.racket || '내 라켓', string: gg.string, tension: gg.tension,
      strungAt: gg.strungAt, cycleDays: gg.cycleDays || 30, memo: gg.memo
    }, now || null);
  }

  function conditionOf(state, now) {
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = statusFor(g, now);
    var last = lastLogDate(state);
    var sinceLog = last ? daysBetween(last, U.ymd(now || undefined)) : null;
    if (sinceLog != null && sinceLog < 0) sinceLog = 0;
    var out = {
      level: 'ok', gearState: st.state, hasGear: !!st.has,
      daysSinceLog: sinceLog,
      title: '줄 상태 좋아요', line: '오늘도 코트에서 만나요'
    };
    if (st.state === 'ok' && st.has && st.daysSince === 0) {
      /* 오늘 새 줄로 갈았으면 쉬는 날이 길었어도 새 줄은 팽팽합니다 */
      out.level = 'prime';
      out.title = '새 줄 · 최상 컨디션이에요';
      out.line = 'D+0 · 교체까지 ' + st.daysLeft + '일';
    } else if (st.state === 'due') {
      out.level = 'broken';
      out.title = '줄이 끊어졌어요';
      out.line = '스트링 교체 시기가 지났어요 · 오늘 갈면 바로 최상 컨디션';
    } else if (sinceLog != null && sinceLog >= BROKEN_DAYS) {
      out.level = 'broken';
      out.title = sinceLog + '일째 쉬는 중이라 줄이 끊어졌어요';
      out.line = '가볍게라도 한 게임 치면 라켓이 살아나요';
    } else if (st.state === 'soon') {
      out.level = 'worn';
      out.title = '줄이 슬슬 느슨해요';
      out.line = '교체까지 ' + st.daysLeft + '일 · 미리 맴 두면 좋아요';
    } else if (sinceLog != null && sinceLog >= TIRED_DAYS) {
      out.level = 'worn';
      out.title = sinceLog + '일째 쉬는 중 · 줄이 조금 느슨해요';
      out.line = '오늘 일지를 쓰면 라켓이 다시 짱짱해져요';
    } else if (sinceLog != null && sinceLog <= 1) {
      out.level = 'prime';
      out.title = '최상 컨디션 · 줄이 짱짱해요';
      out.line = sinceLog === 0 ? '오늘 운동 완료 · 이 느낌 그대로' : '어제 운동 완료 · 좋은 흐름이에요';
    } else if (sinceLog == null && st.state === 'empty') {
      out.level = 'ok';
      out.title = '아직 줄 상태를 몰라요';
      out.line = '일지를 쓰면 라켓이 살아나요';
    } else {
      out.level = 'ok';
      out.title = '줄 상태 좋아요';
      out.line = '꾸준히 치고 있어요';
    }
    return out;
  }

  /* ---------- 라켓 그림 (SVG) ----------
   * 화면 HTML에 들어가는 SVG라 svg · path · circle · g 만 씁니다
   * (ellipse·line·rect·clipPath 는 쓰지 않습니다 — 화면 검사 규칙과도 맞습니다). */
  var seq = 0;

  function ellipsePath(cx, cy, rx, ry) {
    return 'M' + (cx - rx) + ' ' + cy +
      'a' + rx + ' ' + ry + ' 0 1,0 ' + (2 * rx) + ' 0' +
      'a' + rx + ' ' + ry + ' 0 1,0 ' + (-2 * rx) + ' 0';
  }

  function rrectPath(x, y, w, h, r) {
    return 'M' + (x + r) + ' ' + y +
      'h' + (w - r * 2) +
      'a' + r + ' ' + r + ' 0 0,1 ' + r + ' ' + r +
      'v' + (h - r * 2) +
      'a' + r + ' ' + r + ' 0 0,1 ' + (-r) + ' ' + r +
      'h' + (-(w - r * 2)) +
      'a' + r + ' ' + r + ' 0 0,1 ' + (-r) + ' ' + (-r) +
      'v' + (-(h - r * 2)) +
      'a' + r + ' ' + r + ' 0 0,1 ' + r + ' ' + (-r) + 'z';
  }

  function ln(x1, y1, x2, y2, color, w, extra) {
    return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '" fill="none" stroke="' +
      color + '" stroke-width="' + w + '" stroke-linecap="round"' + (extra || '') + '/>';
  }

  function stringsSvg(c, level) {
    var col = colorOf('string', c.string);
    var out = '';
    var i, x, y, h, hw;
    var RX = 15, RY = 19.6, CX = 32, CY = 27;
    if (level === 'broken') {
      for (i = -2; i <= 2; i++) {
        x = CX + i * 5.6;
        h = RY * Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / RX, 2)));
        out += ln(x.toFixed(2), (CY - h).toFixed(2), x.toFixed(2), (CY + h).toFixed(2), col, 1.1, ' opacity="0.92"');
      }
      for (i = -3; i <= 3; i++) {
        y = CY + i * 6.1;
        hw = RX * Math.sqrt(Math.max(0, 1 - Math.pow((y - CY) / RY, 2)));
        if (i === 0) {
          out += ln((CX - hw).toFixed(2), y.toFixed(2), (CX - 6).toFixed(2), (y + 1).toFixed(2), col, 1.25);
          out += ln((CX + 6).toFixed(2), (y - 1).toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.25);
          continue;
        }
        out += ln((CX - hw).toFixed(2), y.toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.1, ' opacity="0.88"');
      }
      return out;
    }
    var sag = level === 'worn' ? 2.4 : 0;
    for (i = -2; i <= 2; i++) {
      x = CX + i * 5.6;
      h = RY * Math.sqrt(Math.max(0, 1 - Math.pow((x - CX) / RX, 2)));
      out += sag
        ? '<path d="M' + x.toFixed(2) + ' ' + (CY - h).toFixed(2) + 'Q' + (x + (i ? i * 0.5 : 0)).toFixed(2) + ' ' + CY + ' ' + x.toFixed(2) + ' ' + (CY + h).toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="1.1" opacity="0.85"/>'
        : ln(x.toFixed(2), (CY - h).toFixed(2), x.toFixed(2), (CY + h).toFixed(2), col, 1.1, ' opacity="0.88"');
    }
    for (i = -3; i <= 3; i++) {
      y = CY + i * 6.1;
      hw = RX * Math.sqrt(Math.max(0, 1 - Math.pow((y - CY) / RY, 2)));
      out += sag
        ? '<path d="M' + (CX - hw).toFixed(2) + ' ' + y.toFixed(2) + 'Q' + CX + ' ' + (y + sag).toFixed(2) + ' ' + (CX + hw).toFixed(2) + ' ' + y.toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="1.05" opacity="0.82"/>'
        : ln((CX - hw).toFixed(2), y.toFixed(2), (CX + hw).toFixed(2), y.toFixed(2), col, 1.05, ' opacity="0.84"');
    }
    return out;
  }

  function stencilSvg(c) {
    var id = c.stencil;
    if (!id || id === 'none') return '';
    var col = colorOf('stencil', id);
    var s = '<g stroke="' + col + '" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">';
    if (id === 'x') {
      s += '<path d="M26 20L38 34"/><path d="M38 20L26 34"/>' +
        '<circle cx="32" cy="27" r="1.5" fill="' + col + '" stroke="none"/>';
    } else if (id === 'bolt') {
      s += '<path d="M34 15L27 27L32 27L30 39L38 25L33 25Z" fill="' + col + '" stroke="none"/>';
    } else if (id === 'crown') {
      s += '<path d="M24 32L24 22L28.5 26L32 19L35.5 26L40 22L40 32Z"/>';
    } else if (id === 'shuttle') {
      s += '<path d="M27 19L37 19L34 29L30 29Z"/><circle cx="32" cy="31.5" r="2.1" fill="' + col + '" stroke="none"/>';
    }
    return s + '</g>';
  }

  function charmSvg(c) {
    var id = c.charm;
    if (!id || id === 'none') return '';
    var col = colorOf('charm', id);
    var s = '<g stroke="' + col + '" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M35 52Q41 56 40 62" opacity="0.9"/>';
    if (id === 'medal') {
      s += '<circle cx="40" cy="66" r="4.1" fill="' + col + '" stroke="none" opacity="0.92"/>' +
        '<path d="M38.6 66L41.4 66" stroke="#0b1410" stroke-width="1.3"/>';
    } else if (id === 'attend30') {
      s += '<circle cx="40" cy="66" r="4.1"/><path d="M40 63.4L40 68.6"/>';
    } else if (id === 'streak') {
      s += '<path d="M40 62C43.4 65 43.2 69.4 40 70.2C36.8 69.4 36.6 65 40 62Z" fill="' + col + '" stroke="none" opacity="0.92"/>';
    } else if (id === 'ace') {
      s += '<path d="M40 61.8L41.4 65.2L45 65.5L42.2 67.8L43.1 71.2L40 69.3L36.9 71.2L37.8 67.8L35 65.5L38.6 65.2Z" fill="' + col + '" stroke="none"/>';
    }
    return s + '</g>';
  }

  /* ---------- 미니 라켓(SVG)의 바디 데칼 · 효과 ---------- */
  function headArc(a0, a1, rx, ry) {
    rx = rx || 18; ry = ry || 23;
    var x0 = 32 + rx * Math.cos(a0 * Math.PI / 180), y0 = 27 + ry * Math.sin(a0 * Math.PI / 180);
    var x1 = 32 + rx * Math.cos(a1 * Math.PI / 180), y1 = 27 + ry * Math.sin(a1 * Math.PI / 180);
    var big = Math.abs(a1 - a0) > 180 ? 1 : 0;
    var sweep = a1 > a0 ? 1 : 0;
    return 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'A' + rx + ' ' + ry + ' 0 ' + big + ' ' + sweep +
      ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
  }

  function bodyDecalSvg(c) {
    var b = bodyOf(c.body);
    var acc = b.accent;
    var out = '';
    if (b.decal === 'slash') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="2.4" stroke-linecap="round" opacity="0.95">' +
        '<path d="' + headArc(-62, -34, 16.4, 21.4) + '"/>' +
        '<path d="' + headArc(16, 40, 16.4, 21.4) + '"/>' +
        '<path d="' + headArc(140, 166, 16.4, 21.4) + '"/></g>';
    } else if (b.decal === 'ring') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="1.3" opacity="0.9">' +
        '<path d="' + headArc(-4, 4, 17.4, 22.4) + '"/>' +
        '<path d="' + headArc(176, 184, 17.4, 22.4) + '"/></g>' +
        '<path d="M30.2 57.2L33.8 57.2" stroke="' + acc + '" stroke-width="1.6" stroke-linecap="round"/>';
    } else if (b.decal === 'wing') {
      out += '<g fill="none" stroke="' + acc + '" stroke-width="1.8" stroke-linecap="round" opacity="0.95">' +
        '<path d="' + headArc(-16, 12, 16.6, 21.6) + '"/>' +
        '<path d="' + headArc(164, 196, 16.6, 21.6) + '"/></g>';
    } else if (b.decal === 'block') {
      out += '<path d="' + headArc(52, 128, 16.8, 21.8) + '" fill="none" stroke="' + acc +
        '" stroke-width="3.4" stroke-linecap="round" opacity="0.95"/>' +
        '<path d="M29.6 47.6L34.4 47.6" stroke="' + acc + '" stroke-width="2.6" stroke-linecap="round"/>';
    }
    return out;
  }

  function fxSvg(c) {
    var id = c.effect;
    if (!id || id === 'none') return '';
    if (id === 'speed') {
      return '<g fill="none" stroke="#9fe6ff" stroke-linecap="round" opacity="0.85">' +
        '<path d="' + headArc(-150, -110, 21, 26.6) + '" stroke-width="1.6"/>' +
        '<path d="' + headArc(-20, 20, 21.4, 27) + '" stroke-width="1.2" opacity="0.7"/>' +
        '<path d="' + headArc(70, 100, 21, 26.6) + '" stroke-width="1.4" opacity="0.6"/></g>';
    }
    if (id === 'spark') {
      return '<g fill="#8fd0ff" opacity="0.95">' +
        '<path d="M47 12L50 16L48.4 16L50 20L46.4 16.6L48 16.4Z"/>' +
        '<path d="M15 20L18 24L16.4 24L18 28L14.4 24.6L16 24.4Z" opacity="0.8"/>' +
        '<path d="M46 40L48.6 43.4L47.2 43.4L48.6 47L45.4 44L46.8 43.8Z" opacity="0.7"/></g>';
    }
    if (id === 'blaze') {
      return '<g opacity="0.9">' +
        '<path d="M32 1C36 5 36.6 8.6 32 11C27.4 8.6 28 5 32 1Z" fill="#ffb347"/>' +
        '<path d="M20 8C23 11 23 14 20 16C17 14 17 11 20 8Z" fill="#ff8a2f" opacity="0.8"/>' +
        '<path d="M44 8C47 11 47 14 44 16C41 14 41 11 44 8Z" fill="#ff8a2f" opacity="0.8"/></g>';
    }
    /* bm-v1.82.0 — 하트로 여는 스페셜 스매시도 미니 라켓에 표시 */
    if (id === 'fire') {
      return '<g opacity="0.95">' +
        '<path d="M32 0C36.4 4.6 37 8.8 32 11.6C27 8.8 27.6 4.6 32 0Z" fill="#ffd166"/>' +
        '<path d="M32 3.4C34.2 5.8 34.4 7.6 32 9.2C29.6 7.6 29.8 5.8 32 3.4Z" fill="#ff6a2b"/>' +
        '<path d="M19 7C21.6 9.8 21.6 12.6 19 14.6C16.4 12.6 16.4 9.8 19 7Z" fill="#ff8a2f" opacity="0.75"/>' +
        '<path d="M45 7C47.6 9.8 47.6 12.6 45 14.6C42.4 12.6 42.4 9.8 45 7Z" fill="#ff8a2f" opacity="0.75"/></g>';
    }
    if (id === 'thunder') {
      return '<g opacity="0.95">' +
        '<path d="M35 0L27 13H32L29 24L39 9H33.6L37 0Z" fill="#7fd8ff"/>' +
        '<path d="M20 14L16 22H19L17.6 28L23 20H20.4L22 14Z" fill="#d6ecff" opacity="0.85"/>' +
        '<path d="M45 20L42 27H44.6L42.8 33L47 26H44.6L46 20Z" fill="#d6ecff" opacity="0.7"/></g>';
    }
    return '<g fill="#f2c14e" opacity="0.95">' +
      '<path d="M49 8L50.4 12L54 13.4L50.4 14.8L49 18.8L47.6 14.8L44 13.4L47.6 12Z"/>' +
      '<path d="M14 32L15 34.6L17.6 35.6L15 36.6L14 39.2L13 36.6L10.4 35.6L13 34.6Z" opacity="0.85"/>' +
      '<path d="M47 44L48 46.2L50.2 47.2L48 48.2L47 50.4L46 48.2L43.8 47.2L46 46.2Z" opacity="0.7"/></g>';
  }

  /* 미니 라켓 SVG — viewBox 0 0 64 96, 세로 라켓 한 자루 */
  function svg(custom, opts) {
    opts = opts || {};
    var c = normalizeCustom(custom);
    var level = opts.level || 'ok';
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var frameIt = itemOf('frame', c.frame) || {};
    var gripIt = itemOf('grip', c.grip) || {};
    var metal = frameIt.finish === 'metal';
    var weave = gripIt.weave || '';
    var uid = ++seq;
    var s = '<svg class="rksvg" viewBox="0 0 64 96" role="img" aria-hidden="true" focusable="false" data-rk="' + uid + '">';
    if (level === 'prime') {
      s += '<circle cx="32" cy="30" r="27" fill="#c6f24e" opacity="0.18"/>';
    }
    s += '<path d="' + ellipsePath(32, 27, 18, 23) + '" fill="none" stroke="#f7ffdf" stroke-width="5.8" opacity="0.20"/>' +
      '<path d="' + ellipsePath(32, 27, 18, 23) + '" fill="none" stroke="' + frame + '" stroke-width="4.2"/>' +
      '<path d="' + ellipsePath(32, 27, 15.4, 20.2) + '" fill="none" stroke="' + frame + '" stroke-width="1" opacity="0.45"/>';
    s += stringsSvg(c, level);
    /* bm-v1.87.0 — 금속 프레임은 왼쪽 위에 흐르는 금속 반사를 한 줄 더 */
    if (metal) {
      s += '<path d="' + headArc(196, 262, 18, 23) + '" fill="none" stroke="' +
        (frameIt.shine || '#b8c8d8') + '" stroke-width="1.8" stroke-linecap="round" opacity="0.75"/>' +
        '<path d="' + headArc(206, 252, 20.6, 25.6) + '" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round" opacity="0.3"/>';
    }
    /* 목 · 샤프트 */
    s += '<path d="M25 47L32 55L39 47" fill="none" stroke="' + frame + '" stroke-width="3.2" stroke-linejoin="round"/>' +
      '<path d="M32 53L32 63" fill="none" stroke="' + frame + '" stroke-width="3.6" stroke-linecap="round"/>';
    /* 그립 */
    s += '<path d="' + rrectPath(28.6, 62, 6.8, 26, 3.2) + '" fill="' +
      (weave === 'twotone' ? (gripIt.color2 || '#20252b') : grip) + '" stroke="none"/>';
    if (weave === 'twotone') {
      /* 위쪽 네온 · 아래는 블랙 — 경계에 얇은 선 */
      s += '<path d="' + rrectPath(28.6, 62, 6.8, 13, 3.2) + '" fill="' + grip + '" stroke="none"/>' +
        '<path d="M28.6 75L35.4 75" stroke="#ffffff" stroke-width="0.8" opacity="0.45"/>';
    }
    s += '<path d="M28.6 69L35.4 66.4M28.6 75L35.4 72.4M28.6 81L35.4 78.4" stroke="#ffffff" stroke-width="0.9" opacity="' +
      (weave === 'towel' ? '0.28' : '0.16') + '"/>';
    s += '<path d="M29.4 88L34.6 88" fill="none" stroke="' + grip + '" stroke-width="2.4" stroke-linecap="round"/>';
    s += bodyDecalSvg(c);
    s += stencilSvg(c) + charmSvg(c);
    s += fxSvg(c);
    if (level === 'broken') {
      s += '<g stroke="#ff6b5e" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.95">' +
        '<path d="M23 24L19 21"/><path d="M25 27L21 27"/></g>' +
        '<path d="M39 22L44 17M43 24L47 22" fill="none" stroke="#ffd166" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>';
    } else if (level === 'worn') {
      s += '<path d="M20 38Q24 42 20 46" fill="none" stroke="#ffd166" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>';
    } else if (level === 'prime') {
      s += '<g fill="#f7ffdf">' +
        '<path d="M49 12L50.2 15.2L53.4 16.4L50.2 17.6L49 20.8L47.8 17.6L44.6 16.4L47.8 15.2Z"/>' +
        '<path d="M14 34L14.8 36.2L17 37L14.8 37.8L14 40L13.2 37.8L11 37L13.2 36.2Z" opacity="0.85"/>' +
        '</g>';
    }
    return s + '</svg>';
  }

  /* ---------- 라켓 그림 (캔버스 · 공유 카드용) ---------- */
  function drawRacket(g, x, y, size, custom, opts) {
    opts = opts || {};
    var c = normalizeCustom(custom);
    var level = opts.level || 'ok';
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var str = colorOf('string', c.string);
    var body = bodyOf(c.body);
    var acc = body.accent;
    var s = size / 96;
    g.save();
    if (typeof g.translate === 'function') g.translate(x, y);
    if (opts.rot && typeof g.rotate === 'function') g.rotate(opts.rot);
    if (typeof g.scale === 'function') g.scale(s, s);
    g.translate(-32, -48);
    g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    g.lineCap = 'round';
    g.lineJoin = 'round';

    /* 바디별 데칼 · 효과 — 공유 카드에서도 모델과 연출이 그대로 보입니다 */
    function ringArc(rx, ry, a0, a1, color, lw, alpha) {
      g.save();
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * alpha;
      g.beginPath();
      g.translate(32, 27); g.scale(1, ry / rx);
      if (g.arc) g.arc(0, 0, rx, a0, a1);
      g.restore();
      g.stroke();
      g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
    }

    /* 연출 — 헤드 뒤 후광 */
    if (c.effect === 'speed') {
      ringArc(21, 26, -2.6, -1.9, '#9fe6ff', 1.6, 0.8);
      ringArc(22, 27, -0.3, 0.35, '#9fe6ff', 1.2, 0.65);
      ringArc(21, 26, 1.2, 1.75, '#d8f6ff', 1.4, 0.6);
    } else if (c.effect === 'spark') {
      if (g.createRadialGradient) {
        var sg = g.createRadialGradient(32, 27, 2, 32, 27, 26);
        sg.addColorStop(0, 'rgba(140,210,255,0.4)');
        sg.addColorStop(1, 'rgba(140,210,255,0)');
        g.fillStyle = sg;
        g.beginPath(); g.arc(32, 27, 26, 0, Math.PI * 2); g.fill();
      }
      var bolts = [[46, 10, 4], [16, 18, 3.4], [45, 41, 3], [19, 39, 2.6]];
      for (var bi = 0; bi < bolts.length; bi++) {
        var bx = bolts[bi][0], by = bolts[bi][1], br = bolts[bi][2];
        g.fillStyle = bi % 2 ? '#8fd0ff' : '#e8f8ff';
        g.beginPath();
        g.moveTo(bx, by); g.lineTo(bx + br, by + br * 1.5); g.lineTo(bx + br * 0.2, by + br * 1.4);
        g.lineTo(bx + br * 1.1, by + br * 2.6); g.lineTo(bx - br * 0.4, by + br * 1.5);
        g.lineTo(bx + br * 0.3, by + br * 1.5); g.closePath(); g.fill();
      }
    } else if (c.effect === 'blaze') {
      if (g.createRadialGradient) {
        var fg = g.createRadialGradient(32, 27, 2, 32, 27, 30);
        fg.addColorStop(0, 'rgba(255,140,40,0.42)');
        fg.addColorStop(0.6, 'rgba(255,90,20,0.16)');
        fg.addColorStop(1, 'rgba(255,60,0,0)');
        g.fillStyle = fg;
        g.beginPath(); g.arc(32, 27, 30, 0, Math.PI * 2); g.fill();
      }
      var flames = [[32, -2, 1], [22, 4, 0.72], [42, 4, 0.72], [15, 24, 0.6], [49, 24, 0.6]];
      for (var fi = 0; fi < flames.length; fi++) {
        var fx0 = flames[fi][0], fy0 = flames[fi][1], fs = flames[fi][2];
        g.fillStyle = fi === 0 ? '#ffcf6a' : '#ff8a2f';
        g.globalAlpha = (opts.alpha == null ? 1 : opts.alpha) * 0.9;
        g.beginPath();
        g.moveTo(fx0 - 5 * fs, fy0 + 6 * fs);
        g.quadraticCurveTo(fx0 - 1.5 * fs, fy0 - 2 * fs, fx0, fy0 - 7 * fs);
        g.quadraticCurveTo(fx0 + 1.5 * fs, fy0 - 2 * fs, fx0 + 5 * fs, fy0 + 6 * fs);
        g.closePath(); g.fill();
        g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
      }
    } else if (c.effect === 'prism') {
      var hues = [0, 60, 120, 200, 280];
      for (var hi = 0; hi < hues.length; hi++) {
        ringArc(21 + hi * 0.7, 26 + hi * 0.8, -3 + hi * 0.1, 2.4 + hi * 0.1,
          'hsla(' + hues[hi] + ',95%,72%,0.9)', 1.5, 0.55);
      }
      var stars = [[49, 8, 2.6], [15, 33, 2], [46, 44, 1.8]];
      for (var si = 0; si < stars.length; si++) {
        var sx = stars[si][0], sy = stars[si][1], sr = stars[si][2];
        g.fillStyle = '#f2c14e';
        g.beginPath();
        g.moveTo(sx, sy - sr * 2); g.lineTo(sx + sr * 0.6, sy - sr * 0.6);
        g.lineTo(sx + sr * 2, sy); g.lineTo(sx + sr * 0.6, sy + sr * 0.6);
        g.lineTo(sx, sy + sr * 2); g.lineTo(sx - sr * 0.6, sy + sr * 0.6);
        g.lineTo(sx - sr * 2, sy); g.lineTo(sx - sr * 0.6, sy - sr * 0.6);
        g.closePath(); g.fill();
      }
    }

    /* 헤드 — 어두운 바탕에서도 프레임이 보이게 얇은 빛 테두리를 먼저 깔아 둡니다 */
    if (opts.rim) {
      g.strokeStyle = 'rgba(247,255,223,0.42)';
      g.lineWidth = 6.6;
      g.beginPath();
      g.save(); g.translate(32, 27); g.scale(1, 23 / 18); g.arc(0, 0, 18, 0, Math.PI * 2); g.restore();
      g.stroke();
    }
    g.strokeStyle = frame;
    g.lineWidth = 4.2;
    g.beginPath();
    g.save(); g.translate(32, 27); g.scale(1, 23 / 18); g.arc(0, 0, 18, 0, Math.PI * 2); g.restore();
    g.stroke();

    /* 바디 데칼 — 프레임 위에 얹히는 포인트 컬러 */
    if (body.decal === 'slash') {
      ringArc(18, 23, -1.1, -0.62, acc, 2.6, 1);
      ringArc(18, 23, 0.26, 0.72, acc, 2.6, 1);
      ringArc(18, 23, 2.4, 2.9, acc, 2.6, 1);
    } else if (body.decal === 'ring') {
      ringArc(18.4, 23.4, -0.07, 0.07, acc, 1.4, 1);
      ringArc(18.4, 23.4, Math.PI - 0.07, Math.PI + 0.07, acc, 1.4, 1);
    } else if (body.decal === 'wing') {
      ringArc(18, 23, -0.28, 0.2, acc, 2, 1);
      ringArc(18, 23, Math.PI - 0.2, Math.PI + 0.28, acc, 2, 1);
    } else if (body.decal === 'block') {
      ringArc(18, 23, 0.92, 2.22, acc, 3.4, 1);
    }

    /* 스트링 (헤드 안쪽) */
    g.save();
    g.beginPath();
    g.translate(32, 27); g.scale(1, 19.6 / 15); g.arc(0, 0, 15, 0, Math.PI * 2); g.restore();
    g.clip();
    g.strokeStyle = str;
    g.lineWidth = 1.1;
    var i, x, y2;
    var sag = level === 'worn' ? 2.4 : 0;
    for (i = -2; i <= 2; i++) {
      x = 32 + i * 5.6;
      g.beginPath();
      g.moveTo(x, 6); g.lineTo(x, 48); g.stroke();
    }
    for (i = -3; i <= 3; i++) {
      y2 = 27 + i * 6.1;
      if (level === 'broken' && i === 0) continue;
      g.beginPath();
      g.moveTo(15, y2);
      g.lineTo(49, y2);
      if (sag && typeof g.quadraticCurveTo === 'function') g.quadraticCurveTo(32, y2 + sag, 49, y2);
      g.stroke();
    }
    g.restore();
    if (level === 'broken') {
      g.strokeStyle = str; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(18, 27); g.lineTo(26, 28); g.stroke();
      g.beginPath(); g.moveTo(38, 26); g.lineTo(46, 27); g.stroke();
    }

    /* 목 · 샤프트 · 그립 */
    g.strokeStyle = frame;
    g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(25, 47); g.lineTo(32, 55); g.lineTo(39, 47); g.stroke();
    g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(32, 53); g.lineTo(32, 63); g.stroke();
    g.fillStyle = grip;
    roundRectPath(g, 28.6, 62, 6.8, 26, 3.2);
    g.fill();

    /* 스텐실 */
    var st = c.stencil;
    if (st && st !== 'none') {
      g.strokeStyle = colorOf('stencil', st);
      g.fillStyle = colorOf('stencil', st);
      g.lineWidth = 1.6;
      if (st === 'x') {
        g.beginPath(); g.moveTo(26, 20); g.lineTo(38, 34); g.stroke();
        g.beginPath(); g.moveTo(38, 20); g.lineTo(26, 34); g.stroke();
      } else if (st === 'bolt') {
        g.beginPath(); g.moveTo(34, 15); g.lineTo(27, 27); g.lineTo(32, 27); g.lineTo(30, 39); g.lineTo(38, 25); g.lineTo(33, 25); g.closePath(); g.fill();
      } else if (st === 'crown') {
        g.beginPath(); g.moveTo(24, 32); g.lineTo(24, 22); g.lineTo(28.5, 26); g.lineTo(32, 19); g.lineTo(35.5, 26); g.lineTo(40, 22); g.lineTo(40, 32); g.closePath(); g.stroke();
      } else if (st === 'shuttle') {
        g.beginPath(); g.moveTo(27, 19); g.lineTo(37, 19); g.lineTo(34, 29); g.lineTo(30, 29); g.closePath(); g.stroke();
        g.beginPath(); g.arc(32, 31.5, 2.1, 0, Math.PI * 2); g.fill();
      }
    }

    /* 참 */
    var ch = c.charm;
    if (ch && ch !== 'none') {
      var cc = colorOf('charm', ch);
      g.strokeStyle = cc; g.fillStyle = cc; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(35, 52); g.lineTo(40, 62); g.stroke();
      g.beginPath(); g.arc(40, 66, 4.1, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  function roundRectPath(g, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  /* ---------- 화면 조각 ---------- */
  function miniHtml(custom, opts) {
    opts = opts || {};
    var lvl = opts.level || 'ok';
    return '<span class="rkmini rkmini--' + lvl + (opts.cls ? ' ' + opts.cls : '') + '">' +
      svg(custom, { level: lvl }) + '</span>';
  }

  /* ---------- 상대 라켓 요약 (bm-v1.87.0) ----------
   *  · 매칭 카드 · 커뮤니티 글의 미니 라켓을 탭했을 때 보여 줄 값만 모아 줍니다.
   *    (바디 · 등급 · 효과 · 꾸민 파츠 · 줄 상태)
   *  · 줄 상태는 그 사람이 저장한 라켓 기록(theme.gear)으로만 판단하고,
   *    기록이 없으면 '미등록'이라고 사실대로 적습니다. */
  function peekOf(state, userKey) {
    var c = customFor(state, userKey);
    var p = (BM.domain && BM.domain.profileOf)
      ? BM.domain.profileOf((state && state.data && state.data.idx) || null, userKey) : {};
    var g = (p && p.theme && p.theme.gear) || null;
    var st = (BM.gear && g && BM.gear.statusOf) ? BM.gear.statusOf(g)
      : { state: 'empty', has: false, daysSince: 0, daysLeft: 0 };
    var lvl = st.state === 'due' ? 'broken' : (st.state === 'soon' ? 'worn' : 'ok');
    var gearText;
    if (st.state === 'due') gearText = '줄 끊김 · 교체 필요';
    else if (st.state === 'soon') gearText = '줄 느슨 · 교체까지 ' + Math.max(0, st.daysLeft) + '일';
    else if (st.state === 'ok') gearText = '줄 갈고 ' + st.daysSince + '일째 · 팽팽해요';
    else if (st.state === 'nodate') gearText = '교체일 미등록';
    else gearText = '줄 상태 미등록';
    return {
      custom: c, has: hasCustom(c), body: bodyOf(c.body), rarity: topRarity(c),
      spec: specText(c),
      effectName: (itemOf('effect', c.effect) || {}).name || '',
      level: lvl, gear: st, gearText: gearText
    };
  }

  /* 다른 사람 카드·프로필에 급수·지역 옆으로 붙는 한 조각 */
  function personHtml(state, userKey, opts) {
    opts = opts || {};
    var c = customFor(state, userKey);
    var lvl = opts.level || 'ok';
    return '<span class="rkperson' + (hasCustom(c) ? '' : ' is-default') + '" title="커스텀 라켓' +
      (specText(c) ? ' · ' + U.esc(specText(c)) : '') + '">' +
      svg(c, { level: lvl }) + '</span>';
  }

  /* 상단 헤더 미니 라켓 */
  function headerHtml(state) {
    var cond = conditionOf(state);
    return svg(customOf(state && state.me), { level: cond.level });
  }

  function paintHeader(state) {
    if (!hasDom) return;
    var btn = document.getElementById('hdrRacket');
    if (!btn) return;
    var cond = conditionOf(state);
    var c = customOf(state && state.me);
    var sig = [cond.level, c.body, c.frame, c.string, c.grip, c.stencil, c.charm, c.effect].join('|');
    if (btn.getAttribute('data-sig') === sig) return;
    btn.setAttribute('data-sig', sig);
    var art = btn.querySelector('.hedracket__art');
    if (art) art.innerHTML = svg(c, { level: cond.level });
    btn.className = 'hedracket is-' + cond.level;
    btn.title = cond.title + ' · 눌러서 내 라켓 꾸미기';
    btn.setAttribute('aria-label', '내 커스텀 라켓 · ' + cond.title + ' · 눌러서 꾸미기');
  }

  /* ============================================================
   * 3D 라켓 뷰 — 실제 배드민턴 라켓 비율 · 바디 4종 (bm-v1.81.0)
   *   · 헤드:샤프트:그립 ≈ 25:22:20 (전체 약 675mm) 아이소메트릭 헤드 실루엣
   *   · 테두리 단면 4면(앞·뒤·바깥·안쪽)을 깊이(Z) 순으로 그려 어느 각도에서도 두께가 보입니다
   *   · 거트 17×19 격자(엮인 느낌) · 그로밋 · 스텐실 · T-조인트 · 콘 · 8각 그립 스파이럴 · 엔드캡 · 참
   *   · 바디(파워 77 · 스피드 에어로 · 컨트롤 아크 · 스매시 맥스)마다 실루엣·프레임 두께·데칼이 다릅니다
   * ============================================================ */
  var CAM_Z = 640, FOCUS = 840;
  var LX = -0.44, LY = -0.62, LZ = 0.65;
  var TAU = Math.PI * 2;

  /* 바디 하나의 실제 치수 — 헤드 아래부터 샤프트·그립 길이를 mm 비율로 */
  function geomOf(custom) {
    var c = (custom && typeof custom === 'object') ? custom : null;
    var b = bodyOf(c && c.body);
    var gripY0 = b.ry + b.shaftLen;
    var gripY1 = gripY0 + b.gripLen;
    return {
      id: b.id, name: b.name, note: b.note, accent: b.accent, decal: b.decal,
      rx: b.rx, ry: b.ry, hoop: b.hoop, shaftR: b.shaftR, gripR: b.gripR,
      shaftLen: b.shaftLen, gripLen: b.gripLen, tJoint: b.tJoint, cone: b.cone,
      profile: b.profile,
      top: -b.ry, headBottom: b.ry,
      throatY: b.ry + b.tJoint * 0.62,
      gripY0: gripY0, gripY1: gripY1,
      mid: (b.ry + gripY1) / 2 - b.ry,
      span: gripY1 + b.ry
    };
  }

  var G3 = (function () {
    var g = geomOf(null);
    return {
      rx: g.rx, ry: g.ry, hoop: g.hoop, throat: g.throatY,
      shaft: g.gripY0 - g.cone, gripY0: g.gripY0, gripY1: g.gripY1, gripR: g.gripR, mid: g.mid
    };
  })();

  function rot3(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = p.x * cy + p.z * sy;
    var z1 = -p.x * sy + p.z * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    return { x: x1, y: p.y * cp - z1 * sp, z: p.y * sp + z1 * cp };
  }

  function project3(p, v) {
    var mid = (v && v.mid != null) ? v.mid : G3.mid;
    var r = rot3({ x: p.x, y: p.y - mid, z: p.z }, v.yaw, v.pitch);
    var s = FOCUS / (FOCUS + CAM_Z - r.z);
    return { x: v.cx + r.x * s * v.k, y: v.cy + r.y * s * v.k, z: r.z, s: s };
  }

  function shade(hex, amt) {
    var h = String(hex || '#333').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (f - r) * p); g = Math.round(g + (f - g) * p); b = Math.round(b + (f - b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function pt(p, z) { return { x: p.x, y: p.y, z: z }; }

  function faceNormal(a, b, c) {
    var ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    var vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    return { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
  }

  /* 면 법선을 회전시켜 화면 고정 광원과 내적 — 돌릴 때마다 명암이 바뀝니다 */
  function litOf(n, v) {
    var r = rot3(n, v.yaw, v.pitch);
    var l = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z) || 1;
    var d = (r.x * LX + r.y * LY + r.z * LZ) / l;
    return Math.abs(d);
  }

  /* 폴리곤 하나를 깊이와 함께 예약 — 나중에 Z 순으로 그립니다(화가 알고리즘) */
  function pushFace(prims, v, model, baseHex, opts) {
    opts = opts || {};
    var ps = [], i, z = 0;
    for (i = 0; i < model.length; i++) {
      var q = project3(model[i], v);
      ps.push(q); z += q.z;
    }
    z = z / model.length + (opts.zBias || 0);
    var lit = litOf(faceNormal(model[0], model[1], model[2]), v);
    var amt = (opts.tone || 0) + (lit - 0.52) * 0.5;
    if (amt > 0.18) amt = 0.18;
    if (amt < -0.62) amt = -0.62;
    prims.push({ z: z, pts: ps, fill: shade(baseHex, amt), alpha: opts.alpha == null ? 1 : opts.alpha });
    if (opts.gloss && lit > 0.93) {
      prims.push({ z: z + 0.4, pts: ps, fill: '#ffffff', alpha: 0.1 });
    }
  }

  /* 여러 줄을 한 번에 — 거트처럼 가는 선 수백 개를 빠르게 */
  function pushLines(prims, v, modelLines, color, lw, alpha, zHint) {
    var polys = [], zsum = 0, zn = 0, i, k;
    for (i = 0; i < modelLines.length; i++) {
      var line = [], pts = modelLines[i];
      for (k = 0; k < pts.length; k++) {
        var q = project3(pts[k], v);
        line.push(q); zsum += q.z; zn++;
      }
      polys.push(line);
    }
    if (!polys.length) return;
    prims.push({ z: zHint == null ? zsum / (zn || 1) : zHint, polys: polys, stroke: color, lw: lw, alpha: alpha == null ? 1 : alpha });
  }

  function paintPrims(g, prims) {
    prims.sort(function (a, b) { return a.z - b.z; });
    for (var i = 0; i < prims.length; i++) {
      var P = prims[i];
      g.globalAlpha = P.alpha == null ? 1 : P.alpha;
      if (P.pts && P.pts.length > 2) {
        g.fillStyle = P.fill;
        g.beginPath();
        g.moveTo(P.pts[0].x, P.pts[0].y);
        for (var k = 1; k < P.pts.length; k++) g.lineTo(P.pts[k].x, P.pts[k].y);
        g.closePath();
        g.fill();
      } else if (P.polys) {
        g.strokeStyle = P.stroke;
        g.lineWidth = P.lw;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        for (var j = 0; j < P.polys.length; j++) {
          var line = P.polys[j];
          if (line.length < 2) continue;
          g.beginPath();
          g.moveTo(line[0].x, line[0].y);
          for (var m = 1; m < line.length; m++) g.lineTo(line[m].x, line[m].y);
          g.stroke();
        }
      }
    }
    g.globalAlpha = 1;
  }

  /* ---------- 헤드 실루엣 (닫힌 Catmull-Rom) ---------- */
  function catmull(pts, sub) {
    var n = pts.length, out = [], i, k;
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (k = 0; k < sub; k++) {
        var t = k / sub, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    return out;
  }

  var loopMem = {};
  function headLoop(gm, sub) {
    var key = gm.id + '|' + (sub || 3);
    if (loopMem[key]) return loopMem[key];
    var half = gm.profile, ctrl = [], i;
    for (i = 0; i < half.length; i++) ctrl.push({ x: half[i][0] * gm.rx, y: half[i][1] * gm.ry });
    for (i = half.length - 2; i > 0; i--) ctrl.push({ x: -half[i][0] * gm.rx, y: half[i][1] * gm.ry });
    loopMem[key] = catmull(ctrl, sub || 3);
    return loopMem[key];
  }

  /* 테두리 안쪽 선 — bm-v1.84.0
   * 예전에는 점마다 법선 방향으로 d 만큼 밀었는데, 목처럼 곡률이 큰 곳에서는 점 간격보다
   * 밀어내는 거리가 커져 선이 톱니처럼 꺾였습니다(거트 끝·데칼 밴드가 들쭉날쭉해 보인 이유).
   * 이제 헤드 중심에서 각 점을 같은 비율로 줄입니다 — 어떤 실루엣에서도 매끈한 안쪽 곡선. */
  function offsetLoop(loop, d) {
    var n = loop.length, i, p;
    /* 1) 점마다 안쪽 법선으로 d 만큼 (테두리 두께가 어디서나 같게) */
    var raw = [];
    for (i = 0; i < n; i++) {
      var p0 = loop[(i - 1 + n) % n], p1 = loop[(i + 1) % n];
      p = loop[i];
      var tx = p1.x - p0.x, ty = p1.y - p0.y;
      var len = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / len, ny = tx / len;
      if (nx * p.x + ny * p.y < 0) { nx = -nx; ny = -ny; }
      raw.push({ x: p.x - nx * d, y: p.y - ny * d });
    }
    /* 2) 두 번 부드럽게 — 곡률이 큰 목에서 법선이 꺾이며 생기는 톱니를 없앱니다
     *    (거트 끝단·데칼 밴드가 들쭉날쭉해 보이던 원인) */
    var cur = raw;
    for (var pass = 0; pass < 2; pass++) {
      var next = [];
      for (i = 0; i < n; i++) {
        var a = cur[(i - 1 + n) % n], b = cur[i], c = cur[(i + 1) % n];
        next.push({ x: a.x * 0.22 + b.x * 0.56 + c.x * 0.22, y: a.y * 0.22 + b.y * 0.56 + c.y * 0.22 });
      }
      cur = next;
    }
    return cur;
  }

  /* ---------- 바디별 프레임 데칼 ---------- */
  /* 데칼(포인트 컬러 밴드) — bm-v1.84.0: 잘게 흩어진 조각 대신 길고 또렷한 밴드 몇 개.
   * 각도 기준: 0 = 오른쪽, π/2 = 아래(목), π = 왼쪽, 3π/2 = 위(정수리). */
  var DECALS = {
    /* 파워 — 위 한 줄 + 아래 두꺼운 한 줄 (공격적인 밸런스) */
    slash: [[5.62, 6.02], [1.02, 2.12]],
    /* 에어로 — 좌우 얇은 밴드 한 쌍 (가벼운 느낌) */
    ring: [[-0.2, 0.2], [Math.PI - 0.2, Math.PI + 0.2]],
    /* 컨트롤 — 좌우 대칭 밴드 한 쌍 (균형) */
    wing: [[-0.52, -0.12], [Math.PI - 0.52, Math.PI - 0.12]],
    /* 스매시 — 아래쪽 두꺼운 메탈릭 밴드 하나 */
    block: [[1.08, 2.06]]
  };

  function inArc(th, a0, a1) {
    var norm = function (x) { return ((x % TAU) + TAU) % TAU; };
    var t = norm(th), s = norm(a0), e = norm(a1);
    return s <= e ? (t >= s && t <= e) : (t >= s || t <= e);
  }

  function decalAt(gm, p) {
    var list = DECALS[gm.decal] || [], i;
    var th = Math.atan2(p.y / (gm.ry || 1), p.x / (gm.rx || 1));
    for (i = 0; i < list.length; i++) if (inArc(th, list[i][0], list[i][1])) return gm.accent;
    return null;
  }

  /* ---------- 테두리 (카본 단면 + 그로밋) ---------- */
  /* 그로밋 하나 — 금속 링 + 어두운 구멍 + 빛 반사 점 */
  function grommet(prims, v, p, r, z, frame) {
    var i, a, ring = [], hole = [];
    for (i = 0; i < 8; i++) {
      a = i / 8 * TAU;
      ring.push(pt({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }, z));
      hole.push(pt({ x: p.x + Math.cos(a) * r * 0.46, y: p.y + Math.sin(a) * r * 0.46 }, z + 0.25));
    }
    pushFace(prims, v, ring, shade(frame, 0.34), { tone: 0.06, zBias: 0.55 });
    pushFace(prims, v, hole, '#0a0e0b', { tone: 0, zBias: 0.6 });
    /* 금속 하이라이트 — 왼쪽 위 한 점 */
    pushFace(prims, v, [
      pt({ x: p.x - r * 0.5, y: p.y - r * 0.62 }, z + 0.3),
      pt({ x: p.x - r * 0.16, y: p.y - r * 0.7 }, z + 0.3),
      pt({ x: p.x - r * 0.22, y: p.y - r * 0.4 }, z + 0.3),
      pt({ x: p.x - r * 0.56, y: p.y - r * 0.34 }, z + 0.3)
    ], '#ffffff', { tone: 0, alpha: 0.5, zBias: 0.65 });
  }

  function addHead(prims, gm, v, frame, it) {
    var loop = headLoop(gm, 2);
    var inner = offsetLoop(loop, gm.hoop);
    var N = loop.length, i, j;
    var zf = gm.hoop * 0.42, zb = -gm.hoop * 0.42;
    var metal = !!(it && it.finish === 'metal');
    for (i = 0; i < N; i++) {
      j = (i + 1) % N;
      var o0 = loop[i], o1 = loop[j], n0 = inner[i], n1 = inner[j];
      /* 앞면 — 카본 결: 밝은 띠·어두운 띠가 번갈아 (한 겹씩 쌓인 느낌) */
      pushFace(prims, v, [pt(o0, zf), pt(o1, zf), pt(n1, zf), pt(n0, zf)], frame,
        { tone: (i % 2 ? 0.055 : -0.012), gloss: true });
      /* 바깥 옆면 — 빛을 가장 많이 받는 매끈한 모서리 */
      pushFace(prims, v, [pt(o0, zf), pt(o1, zf), pt(o1, zb), pt(o0, zb)], frame, { tone: 0.17, gloss: true });
      /* 안쪽 옆면 — 그늘 */
      pushFace(prims, v, [pt(n0, zf), pt(n1, zf), pt(n1, zb), pt(n0, zb)], frame, { tone: -0.4 });
      /* 뒷면은 카메라 반대쪽이라 그리지 않습니다(보이지 않는 면을 매 프레임 그리면 프레임이 떨어짐) */
    }
    /* bm-v1.87.0 — 레전드 프레임(오닉스 티타늄)의 금속 광택.
     *  카본과 달리 '한 줄로 흐르는 금속 반사'가 보이도록, 빛을 받는 구간은 밝은 띠,
     *  그 반대쪽은 깊은 그림자 띠를 앞면 위에 한 겹 덧그립니다.
     *  (프레임 색만 바뀌는 것과 눈에 띄게 구분되고, 돌릴 때 띠가 프레임을 따라 흐릅니다.) */
    if (metal) {
      var shineCol = (it && it.shine) || '#b8c8d8';
      for (i = 0; i < N; i++) {
        j = (i + 1) % N;
        var mx = (loop[i].x + loop[j].x) / 2 / (gm.rx || 1);
        var my = (loop[i].y + loop[j].y) / 2 / (gm.ry || 1);
        var ml = litOf({ x: mx, y: my, z: 0.75 }, v);
        if (ml > 0.66) {
          pushFace(prims, v, [pt(loop[i], zf + 0.25), pt(loop[j], zf + 0.25),
            pt(inner[j], zf + 0.25), pt(inner[i], zf + 0.25)], shineCol,
            { tone: 0, alpha: Math.min(0.46, (ml - 0.66) * 2.1), zBias: 0.8 });
        }
        if (ml < 0.34) {
          pushFace(prims, v, [pt(loop[i], zf + 0.2), pt(loop[j], zf + 0.2),
            pt(inner[j], zf + 0.2), pt(inner[i], zf + 0.2)], '#05070a',
            { tone: 0, alpha: Math.min(0.32, (0.34 - ml) * 1.4), zBias: 0.7 });
        }
      }
    }
    /* 그로밋(아일렛) — 거트가 빠져나오는 구멍. 실제 라켓처럼 촘촘하게 */
    var rr = Math.max(0.85, gm.hoop * 0.21);
    for (i = 1; i < N; i += 2) grommet(prims, v, inner[i], rr, zf + 0.7, frame);
  }

  /* 프레임 위 포인트 데칼 — 비스듬한 사선 · 밴드 · 윙 */
  function loopIndexAt(gm, ang) {
    var loop = headLoop(gm, 3), n = loop.length, best = 0, bd = 9, i;
    for (i = 0; i < n; i++) {
      var a = Math.atan2(loop[i].y / gm.ry, loop[i].x / gm.rx);
      var d = Math.abs(((a - ang + Math.PI * 3) % TAU) - Math.PI);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function addDecals(prims, gm, v) {
    var list = DECALS[gm.decal] || [];
    if (!list.length) return;
    var loop = headLoop(gm, 3), n = loop.length, k, i;
    var zf = gm.hoop * 0.42;
    for (k = 0; k < list.length; k++) {
      var ia = loopIndexAt(gm, list[k][0]);
      var ib = loopIndexAt(gm, list[k][1]);
      var span = (ib - ia + n) % n;
      if (span > n / 2) { var t2 = ia; ia = ib; ib = t2; span = (ib - ia + n) % n; }
      /* bm-v1.84.0 — 사각형을 이어 붙이면 곡률 큰 곳에서 톱니가 보여, 테두리 가운데를
       * 따라가는 굵은 선 하나로 그립니다(끝은 둥글게). 훨씬 깔끔하고 가볍습니다. */
      var pts = [];
      for (i = 0; i <= span; i += 2) {
        var p = loop[(ia + i) % n];
        pts.push(pt({ x: p.x * 0.935, y: p.y * 0.935 }, zf + 1.2));
      }
      if (pts.length < 2) continue;
      var zTop = project3(pts[Math.floor(pts.length / 2)], v).z + 2.2;
      pushLines(prims, v, [pts], gm.accent, Math.max(1.8, gm.hoop * 0.52 * v.k * 1.35), 0.96, zTop);
      /* 얇은 화이트 핀라인 — 인쇄한 것처럼 또렷하게 */
      pushLines(prims, v, [pts], 'rgba(255,255,255,0.42)', Math.max(0.7, gm.hoop * 0.1 * v.k * 1.35), 0.7, zTop + 0.5);
    }
  }

  /* 테두리 광택 — 바깥 모서리 하이라이트 · 안쪽 그늘
   *  bm-v1.87.0 — 금속 프레임(오닉스 티타늄)은 림 라이트를 더 밝게 두 번(금속색 + 흰색) 그어
   *  매트 카본 프레임과 한눈에 구분되게 합니다. */
  function addFrameEdge(prims, gm, v, frame, it) {
    var loop = headLoop(gm, 3), inner = offsetLoop(loop, gm.hoop);
    var n = loop.length, zf = gm.hoop * 0.42 + 0.35;
    var metal = !!(it && it.finish === 'metal');
    var outer = [], inn = [], i;
    for (i = 0; i < n; i++) {
      outer.push(pt(loop[i], zf));
      inn.push(pt(inner[i], zf));
    }
    var zo = project3(outer[0], v).z;
    pushLines(prims, v, [outer], metal ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.3)',
      Math.max(1, (metal ? 1.9 : 1.5) * v.k * 1.3), 0.7, zo + 0.6);
    pushLines(prims, v, [inn], metal ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)',
      Math.max(1, (metal ? 2 : 1.7) * v.k * 1.3), 0.8, zo + 0.45);
    /* 빛을 받는 구간만 밝은 림 라이트 — 카본 광택이 각도에 따라 흐릅니다 */
    var lit = [], lit2 = [], i2;
    for (i2 = 0; i2 < n; i2++) {
      var q = project3(pt({ x: loop[i2].x * 0.99, y: loop[i2].y * 0.99 }, zf + 0.5), v);
      var nr = { x: loop[i2].x / (gm.rx || 1), y: loop[i2].y / (gm.ry || 1), z: 0 };
      if (litOf(nr, v) > 0.62) lit.push(pt({ x: loop[i2].x * 0.995, y: loop[i2].y * 0.995 }, zf + 0.5));
      if (metal && litOf(nr, v) > 0.86) lit2.push(pt({ x: loop[i2].x * 0.955, y: loop[i2].y * 0.955 }, zf + 0.55));
    }
    if (lit.length > 2) pushLines(prims, v, [lit], metal ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.5)',
      Math.max(1, (metal ? 1.5 : 1.1) * v.k * 1.3), 0.55, zo + 0.7);
    if (lit2.length > 2) {
      pushLines(prims, v, [lit2], (it && it.shine) || '#b8c8d8', Math.max(0.8, 1.1 * v.k * 1.3), 0.6, zo + 0.75);
    }
  }

  /* ---------- 거트 17 × 19 ---------- */
  function chordAt(poly, axis, val) {
    var lo = null, hi = null, i, n = poly.length;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var a1 = axis === 'v' ? a.x : a.y;
      var b1 = axis === 'v' ? b.x : b.y;
      if (a1 === b1) continue;
      if ((a1 - val) * (b1 - val) > 0) continue;
      var t = (val - a1) / (b1 - a1);
      var other = axis === 'v' ? a.y + (b.y - a.y) * t : a.x + (b.x - a.x) * t;
      if (lo == null || other < lo) lo = other;
      if (hi == null || other > hi) hi = other;
    }
    return lo == null ? null : { a: lo, b: hi };
  }

  function sagLine(a, b, sag, seed, m) {
    var out = [], i;
    m = m == null ? 4 : m;
    for (i = 0; i <= m; i++) {
      var t = i / m;
      var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (sag) {
        var bow = Math.sin(t * Math.PI) * sag * ((seed % 2) ? 1 : -1);
        if (Math.abs(a.y - b.y) < 0.01) y += bow; else x += bow * 0.4;
      }
      out.push({ x: x, y: y, z: 0 });
    }
    return out;
  }

  function stringChords(gm, level, wob) {
    var loop = headLoop(gm, 2);
    var inner = offsetLoop(loop, gm.hoop * 1.12);
    var mains = [], crosses = [], i, ch;
    var X = gm.rx - gm.hoop * 1.5, Y = gm.ry - gm.hoop * 1.3;
    var sag = level === 'worn' ? 3.4 : (level === 'broken' ? 2.2 : 0);
    var wa = Number(wob) || 0;
    for (i = 0; i < 17; i++) {
      var x = -X * 0.86 + (i / 16) * X * 1.72;
      ch = chordAt(inner, 'v', x);
      if (!ch) continue;
      mains.push(sagLine({ x: x, y: ch.a - 2 }, { x: x, y: ch.b + 2 },
        sag + (wa ? wa * (0.6 + (i % 3) * 0.4) : 0), i, 3));
    }
    for (i = 0; i < 19; i++) {
      var y = -Y * 0.84 + (i / 18) * Y * 1.66;
      ch = chordAt(inner, 'h', y);
      if (!ch) continue;
      crosses.push(sagLine({ x: ch.a - 2, y: y }, { x: ch.b + 2, y: y },
        sag + (wa ? -wa * (0.55 + (i % 4) * 0.3) : 0), i, 3));
    }
    if (level === 'broken') {
      /* 가운데 세로 줄이 끊어진 모습 — 가운데를 비우고 좌우로 갈라진 끝을 남깁니다 */
      var cut = Math.floor(mains.length / 2);
      var line = mains[cut];
      mains.splice(cut, 1,
        line.slice(0, Math.floor(line.length / 2)),
        line.slice(Math.ceil(line.length / 2)));
    }
    return { mains: mains, crosses: crosses };
  }

  function addStrings(prims, gm, v, color, level, wob) {
    var ch = stringChords(gm, level, wob);
    var lw = Math.max(1, 1.5 * v.k * 1.32);
    /* 가로줄은 세로줄 아래로 — 위/아래로 엮인 결이 보이게 z 를 나눕니다 */
    var oddC = ch.crosses.filter(function (x, i) { return i % 2 === 0; });
    var evenC = ch.crosses.filter(function (x, i) { return i % 2 === 1; });
    pushLines(prims, v, oddC, shade(color, -0.16), lw, 0.6, -1.1);
    pushLines(prims, v, ch.mains, shade(color, -0.45), lw * 1.5, 0.35, 0.2);
    pushLines(prims, v, ch.mains, color, lw, 0.8, 0.4);
    pushLines(prims, v, evenC, shade(color, -0.05), lw, 0.68, 1.0);
    if (level === 'broken') {
      /* 끊어진 줄 — 벌어진 끝단이 말려 올라간 모습 */
      pushLines(prims, v, [[
        { x: -5.5, y: 0, z: 0 }, { x: -9, y: 2.4, z: 0 }, { x: -12.5, y: 0.4, z: 0 }, { x: -14, y: -3.4, z: 0 }
      ], [
        { x: 5.5, y: 0, z: 0 }, { x: 9, y: -2.4, z: 0 }, { x: 12.5, y: -0.4, z: 0 }, { x: 14, y: 3.4, z: 0 }
      ]], '#ff6b5e', Math.max(1.2, 2.1 * v.k), 1, 1.4);
      pushLines(prims, v, [[
        { x: -5, y: -1, z: 0 }, { x: -1, y: -5, z: 0 }
      ], [
        { x: 5, y: 1, z: 0 }, { x: 1, y: 5, z: 0 }
      ]], '#ffd166', Math.max(1, 1.4 * v.k), 0.9, 1.5);
      /* 가로줄 한 가닥도 끊어져 세로줄과 함께 삐져나온 느낌 (bm-v1.94.0) */
      pushLines(prims, v, [[
        { x: -3.4, y: -6.8, z: 0 }, { x: -7.4, y: -9.6, z: 0 }, { x: -11.2, y: -6.6, z: 0 }
      ], [
        { x: 3.4, y: 6.8, z: 0 }, { x: 7.4, y: 9.6, z: 0 }, { x: 11.2, y: 6.6, z: 0 }
      ]], '#ff6b5e', Math.max(1.1, 1.7 * v.k), 1, 1.2);
    }
  }

  /* ---------- 스텐실 (거트 위) ---------- */
  function stencilShapes(gm, id) {
    var sx = gm.rx / 100, sy = gm.ry / 126;
    var seg = [];
    if (id === 'x') {
      seg = [[[-34, -16], [34, 16]], [[34, -16], [-34, 16]]];
    } else if (id === 'bolt') {
      seg = [[[10, -40], [-24, 2], [2, 2], [-10, 40], [30, -4], [4, -4], [10, -40]]];
    } else if (id === 'crown') {
      seg = [[[-38, 16], [-38, -14], [-16, 2], [0, -26], [16, 2], [38, -14], [38, 16], [-38, 16]]];
    } else if (id === 'shuttle') {
      seg = [[[-26, -26], [26, -26], [12, 10], [-12, 10], [-26, -26]], [[0, 30], [0, 14]]];
    }
    return seg.map(function (pts) {
      return pts.map(function (p) { return { x: p[0] * sx, y: p[1] * sy, z: 1.6 }; });
    });
  }

  function addStencil(prims, gm, v, c) {
    if (!c.stencil || c.stencil === 'none') return;
    var col = colorOf('stencil', c.stencil);
    var shapes = stencilShapes(gm, c.stencil);
    pushLines(prims, v, shapes, col, Math.max(1.6, 3.6 * v.k), 0.92, 1.8);
  }

  /* ---------- T-조인트 · 샤프트 · 콘 ---------- */
  function addShaft(prims, gm, v, frame, accent, it) {
    var ty0 = gm.headBottom + 2, ty1 = gm.throatY;
    var metal = !!(it && it.finish === 'metal');
    var w0 = gm.tJoint * 0.34, w1 = gm.shaftR * 1.42;
    var d0 = Math.min(7, gm.tJoint * 0.24), d1 = gm.shaftR * 1.12;
    /* T-조인트 — 헤드 아래에서 샤프트로 이어지는 매끈한 목 */
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, d0), pt({ x: w0, y: ty0 }, d0),
      pt({ x: w1, y: ty1 }, d1), pt({ x: -w1, y: ty1 }, d1)], frame, { tone: 0.04, gloss: true });
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, -d0), pt({ x: w0, y: ty0 }, -d0),
      pt({ x: w1, y: ty1 }, -d1), pt({ x: -w1, y: ty1 }, -d1)], frame, { tone: -0.24 });
    pushFace(prims, v, [pt({ x: -w0, y: ty0 }, d0), pt({ x: -w1, y: ty1 }, d1),
      pt({ x: -w1, y: ty1 }, -d1), pt({ x: -w0, y: ty0 }, -d0)], frame, { tone: -0.1 });
    pushFace(prims, v, [pt({ x: w0, y: ty0 }, d0), pt({ x: w1, y: ty1 }, d1),
      pt({ x: w1, y: ty1 }, -d1), pt({ x: w0, y: ty0 }, -d0)], frame, { tone: 0.12 });
    if (gm.id === 'smash') {
      /* 굵은 파워 T-조인트 — 메탈릭 밴드 */
      pushFace(prims, v, [pt({ x: -w0 * 1.04, y: ty0 + 4 }, d0 + 0.6), pt({ x: w0 * 1.04, y: ty0 + 4 }, d0 + 0.6),
        pt({ x: w0 * 1.02, y: ty0 + 13 }, d0 + 0.6), pt({ x: -w0 * 1.02, y: ty0 + 13 }, d0 + 0.6)], accent, { tone: 0.16, zBias: 0.6 });
    }

    /* 샤프트 — 가늘고 긴 카본 원통(6면) */
    var segN = 6, k;
    var sy0 = ty1, sy1 = gm.gripY0 - gm.cone;
    var r0 = gm.shaftR, r1 = gm.shaftR * 0.93;
    for (k = 0; k < segN; k++) {
      var a0 = k / segN * TAU, a1 = (k + 1) / segN * TAU;
      pushFace(prims, v, [
        pt({ x: Math.cos(a0) * r0, y: sy0 }, Math.sin(a0) * r0),
        pt({ x: Math.cos(a1) * r0, y: sy0 }, Math.sin(a1) * r0),
        pt({ x: Math.cos(a1) * r1, y: sy1 }, Math.sin(a1) * r1),
        pt({ x: Math.cos(a0) * r1, y: sy1 }, Math.sin(a0) * r1)
      ], frame, { tone: 0.06, gloss: true });
    }

    /* 콘(프론트 캡) — 샤프트에서 그립으로 넓어지는 원뿔 */
    var cy0 = sy1, cy1 = gm.gripY0 + 2, cR = gm.gripR * 0.99;
    for (k = 0; k < segN; k++) {
      var b0 = k / segN * TAU, b1 = (k + 1) / segN * TAU;
      pushFace(prims, v, [
        pt({ x: Math.cos(b0) * r1, y: cy0 }, Math.sin(b0) * r1),
        pt({ x: Math.cos(b1) * r1, y: cy0 }, Math.sin(b1) * r1),
        pt({ x: Math.cos(b1) * cR, y: cy1 }, Math.sin(b1) * cR),
        pt({ x: Math.cos(b0) * cR, y: cy1 }, Math.sin(b0) * cR)
      ], frame, { tone: -0.06, gloss: true });
    }
    /* 샤프트 광택 — 빛을 가장 많이 받는 면에 가는 하이라이트 */
    var bestK = 0, bestL = -1;
    for (k = 0; k < segN; k++) {
      var an = (k + 0.5) / segN * TAU;
      var litS = litOf({ x: Math.cos(an), y: 0, z: Math.sin(an) }, v);
      if (litS > bestL) { bestL = litS; bestK = k; }
    }
    var aa0 = bestK / segN * TAU + 0.06, aa1 = (bestK + 1) / segN * TAU - 0.06;
    pushFace(prims, v, [
      pt({ x: Math.cos(aa0) * r0 * 1.005, y: sy0 }, Math.sin(aa0) * r0 * 1.005),
      pt({ x: Math.cos(aa1) * r0 * 1.005, y: sy0 }, Math.sin(aa1) * r0 * 1.005),
      pt({ x: Math.cos(aa1) * r1 * 1.005, y: sy1 }, Math.sin(aa1) * r1 * 1.005),
      pt({ x: Math.cos(aa0) * r1 * 1.005, y: sy1 }, Math.sin(aa0) * r1 * 1.005)
    ], '#ffffff', { tone: 0, alpha: metal ? 0.32 : 0.13, zBias: 1.2 });
    if (metal) {
      /* 금속 샤프트 — 하이라이트 옆에 금속색 반사 한 줄을 더 그어 크롬처럼 보이게 */
      var sm0 = (bestK / segN) * TAU + 0.02, sm1 = ((bestK + 1) / segN) * TAU - 0.02;
      pushFace(prims, v, [
        pt({ x: Math.cos(sm0) * r0 * 1.008, y: sy0 + 6 }, Math.sin(sm0) * r0 * 1.008),
        pt({ x: Math.cos(sm1) * r0 * 1.008, y: sy0 + 6 }, Math.sin(sm1) * r0 * 1.008),
        pt({ x: Math.cos(sm1) * r1 * 1.008, y: sy1 - 4 }, Math.sin(sm1) * r1 * 1.008),
        pt({ x: Math.cos(sm0) * r1 * 1.008, y: sy1 - 4 }, Math.sin(sm0) * r1 * 1.008)
      ], (it && it.shine) || '#b8c8d8', { tone: 0, alpha: 0.5, zBias: 1.25 });
    }
    /* 콘 마감 링 — 샤프트가 그립으로 넘어가는 금속 밴드 */
    for (k = 0; k < segN; k++) {
      var m0 = k / segN * TAU, m1 = (k + 1) / segN * TAU;
      var mr = r1 * 1.08;
      pushFace(prims, v, [
        pt({ x: Math.cos(m0) * mr, y: cy0 + 1 }, Math.sin(m0) * mr),
        pt({ x: Math.cos(m1) * mr, y: cy0 + 1 }, Math.sin(m1) * mr),
        pt({ x: Math.cos(m1) * mr, y: cy0 + 4.5 }, Math.sin(m1) * mr),
        pt({ x: Math.cos(m0) * mr, y: cy0 + 4.5 }, Math.sin(m0) * mr)
      ], shade(frame, metal ? 0.62 : 0.42), { tone: 0.1, zBias: 0.9 });
    }
    if (gm.id === 'aero' || gm.id === 'power77') {
      /* 샤프트 하단 얇은 링 데칼 */
      for (k = 0; k < segN; k++) {
        var d0a = k / segN * TAU, d1a = (k + 1) / segN * TAU;
        var rr = r1 + 0.5;
        pushFace(prims, v, [
          pt({ x: Math.cos(d0a) * rr, y: cy0 + 3 }, Math.sin(d0a) * rr),
          pt({ x: Math.cos(d1a) * rr, y: cy0 + 3 }, Math.sin(d1a) * rr),
          pt({ x: Math.cos(d1a) * rr, y: cy0 + 7 }, Math.sin(d1a) * rr),
          pt({ x: Math.cos(d0a) * rr, y: cy0 + 7 }, Math.sin(d0a) * rr)
        ], accent, { tone: 0.1, zBias: 0.8 });
      }
    }
  }

  /* ---------- 8각 그립 · 스파이럴 오버그립 · 마감 테이프 · 엔드캡 ----------
   *  bm-v1.87.0 — 그립 결(weave)
   *   towel    타월 베이지: 보송보송한 타월 결(짧은 가로 보풀 줄이 면마다 촘촘히) · 광택 없음
   *   twotone  투톤 네온: 위는 네온, 아래는 블랙. 경계는 감긴 결처럼 살짝 비스듬합니다. */
  function addGrip(prims, gm, v, grip, accent, it) {
    var y0 = gm.gripY0, y1 = gm.gripY1, R = gm.gripR;
    var weave = (it && it.weave) || '';
    var dark = (it && it.color2) || shade(grip, -0.55);
    var matte = weave === 'towel';
    var verts = [], k;
    for (k = 0; k < 8; k++) {
      var a = (k + 0.5) * Math.PI / 4;
      verts.push({ c: Math.cos(a), s: Math.sin(a) });
    }
    /* 8각 기둥 — 회전하면 각진 면의 명암이 바뀝니다.
     * 투톤은 면을 위·아래 두 토막으로 나눠 그립니다(겹치지 않아 어떤 각도에서도 두 색이 다 보입니다). */
    for (k = 0; k < 8; k++) {
      var p = verts[k], q = verts[(k + 1) % 8];
      var ys0 = y0 + (y1 - y0) * (0.44 + 0.05 * Math.sin(k * 1.1));
      if (weave === 'twotone') {
        /* 아래(엔드캡 쪽) = 두 번째 색 */
        pushFace(prims, v, [
          pt({ x: p.c * R, y: ys0 }, p.s * R), pt({ x: q.c * R, y: ys0 }, q.s * R),
          pt({ x: q.c * R, y: y1 }, q.s * R), pt({ x: p.c * R, y: y1 }, p.s * R)
        ], dark, { tone: 0 });
        /* 위(헤드 쪽) = 네온 */
        pushFace(prims, v, [
          pt({ x: p.c * R, y: y0 }, p.s * R), pt({ x: q.c * R, y: y0 }, q.s * R),
          pt({ x: q.c * R, y: ys0 }, q.s * R), pt({ x: p.c * R, y: ys0 }, p.s * R)
        ], grip, { tone: 0 });
      } else {
        pushFace(prims, v, [
          pt({ x: p.c * R, y: y0 }, p.s * R), pt({ x: q.c * R, y: y0 }, q.s * R),
          pt({ x: q.c * R, y: y1 }, q.s * R), pt({ x: p.c * R, y: y1 }, p.s * R)
        ], grip, { tone: matte ? (k % 2 ? 0.035 : -0.035) : 0 });
      }
    }
    /* 투톤 — 두 색이 만나는 자리에 얇은 밝은 선 */
    if (weave === 'twotone') {
      for (k = 0; k < 8; k++) {
        var tp = verts[k], tq = verts[(k + 1) % 8];
        var ys = y0 + (y1 - y0) * (0.44 + 0.05 * Math.sin(k * 1.1));
        pushLines(prims, v, [[
          { x: tp.c * R * 1.008, y: ys, z: tp.s * R * 1.008 },
          { x: tq.c * R * 1.008, y: ys, z: tq.s * R * 1.008 }
        ]], 'rgba(255,255,255,0.36)', Math.max(0.6, 0.95 * v.k * 1.3), 0.9, 1.55);
      }
    }
    /* 타월 결 — 면마다 짧은 가로 보풀 줄(밝은 획·어두운 획이 번갈아) */
    if (matte) {
      var rows = Math.max(6, Math.round((y1 - y0) / 7));
      for (k = 0; k < 8; k++) {
        var lp = verts[k], lq = verts[(k + 1) % 8];
        var light = [], fine = [], r, yy;
        for (r = 0; r < rows; r++) {
          yy = y0 + 6 + (y1 - y0 - 10) * (r / Math.max(1, rows - 1));
          var a1 = { x: lp.c * R * 1.006, y: yy, z: lp.s * R * 1.006 };
          var b1 = { x: lq.c * R * 1.006, y: yy + 0.6, z: lq.s * R * 1.006 };
          var md = {
            x: (a1.x + b1.x) / 2 * 1.012, y: yy + (r % 2 ? 1 : -1), z: (a1.z + b1.z) / 2 * 1.012
          };
          (r % 2 ? fine : light).push([a1, md, b1]);
        }
        pushLines(prims, v, light, 'rgba(255,255,255,0.17)', Math.max(0.5, 0.55 * v.k * 1.3), 1, 1.5);
        pushLines(prims, v, fine, 'rgba(0,0,0,0.17)', Math.max(0.5, 0.5 * v.k * 1.3), 1, 1.55);
      }
    }
    /* 천공 결 — 8각 면마다 작은 구멍을 규칙적으로 (bm-v1.95.0 천공 오버그립) */
    if (weave === 'perf') {
      var rowsP = 7, rp, offp, cx3, cz3, sxp, szp;
      for (k = 0; k < 8; k++) {
        var pp3 = verts[k], pq3 = verts[(k + 1) % 8];
        for (rp = 0; rp < rowsP; rp++) {
          var yyP = y0 + 14 + (y1 - y0 - 28) * (rp / (rowsP - 1));
          offp = (rp % 2) ? 0.45 : 0.72;
          cx3 = (pp3.c + (pq3.c - pp3.c) * offp) * R * 1.007;
          cz3 = (pp3.s + (pq3.s - pp3.s) * offp) * R * 1.007;
          sxp = (pq3.c - pp3.c) * R * 0.09;
          szp = (pq3.s - pp3.s) * R * 0.09;
          pushFace(prims, v, [
            { x: cx3, y: yyP - 2.4, z: cz3 },
            { x: cx3 + sxp, y: yyP, z: cz3 + szp },
            { x: cx3, y: yyP + 2.4, z: cz3 },
            { x: cx3 - sxp, y: yyP, z: cz3 - szp }
          ], '#000000', { tone: 0, gloss: false, alpha: 0.2, zBias: 0.7 });
        }
      }
    }
    /* 오버그립 감김 — 한 줄로 이어지는 나선 이음매(실제 오버그립을 감은 모습).
     * 사각형을 겹쳐 찍던 예전 방식은 '사다리'처럼, 한 바퀴마다 선을 그으면 '용수철'처럼
     * 보여서, 나선 하나만 얇게 얹습니다. */
    var pitch2 = 24;
    var seamPts = [], yy2, aa2;
    for (yy2 = y0 + 4; yy2 <= y1 - 3; yy2 += 3.2) {
      aa2 = (yy2 - y0) / pitch2 * TAU;
      var sx2 = Math.cos(aa2) * R * 1.004, sz2 = Math.sin(aa2) * R * 1.004;
      seamPts.push({ x: sx2, y: yy2, z: sz2 });
    }
    if (seamPts.length > 2) {
      pushLines(prims, v, [seamPts], 'rgba(0,0,0,0.34)', Math.max(0.7, 1.05 * v.k * 1.3), 1, 1.3);
      pushLines(prims, v, [seamPts.map(function (q) { return { x: q.x, y: q.y - 0.8, z: q.z }; })],
        'rgba(255,255,255,0.12)', Math.max(0.5, 0.6 * v.k * 1.3), 1, 1.4);
    }

    /* 그립 가장자리 — 원통이 배경과 구분되게 얇은 빛/그늘 선 */
    var edgeL = [], edgeR = [];
    for (k = 0; k <= 6; k++) {
      var yy3 = y0 + 3 + (y1 - y0 - 6) * (k / 6);
      edgeL.push(pt({ x: Math.cos(Math.PI * 1.05) * R * 1.01, y: yy3 }, Math.sin(Math.PI * 1.05) * R * 1.01));
      edgeR.push(pt({ x: Math.cos(Math.PI * 1.95) * R * 1.01, y: yy3 }, Math.sin(Math.PI * 1.95) * R * 1.01));
    }
    pushLines(prims, v, [edgeL], 'rgba(255,255,255,0.16)', Math.max(0.7, 1.1 * v.k * 1.3), 1, 1.2);
    pushLines(prims, v, [edgeR], 'rgba(0,0,0,0.5)', Math.max(0.7, 1.2 * v.k * 1.3), 1, 1.2);

    /* 빛이 닿는 면의 세로 하이라이트 — 오버그립 광택 */
    for (k = 0; k < 8; k++) {
      var hp = verts[k], hq = verts[(k + 1) % 8];
      var nn = { x: Math.cos((k + 0.5) * Math.PI / 4), y: 0, z: Math.sin((k + 0.5) * Math.PI / 4) };
      if (litOf(nn, v) < 0.82) continue;
      pushFace(prims, v, [
        pt({ x: hp.c * R * 1.004, y: y0 + 8 }, hp.s * R * 1.004), pt({ x: hq.c * R * 1.004, y: y0 + 8 }, hq.s * R * 1.004),
        pt({ x: hq.c * R * 1.004, y: y1 - 4 }, hq.s * R * 1.004), pt({ x: hp.c * R * 1.004, y: y1 - 4 }, hp.s * R * 1.004)
      ], '#ffffff', { tone: 0, gloss: false, alpha: matte ? 0.05 : 0.14, zBias: 0.6 });
    }

    /* 상단 마감 테이프 밴드 */
    var trimR = R * 1.03;
    for (k = 0; k < 8; k++) {
      var t1 = verts[k], t2 = verts[(k + 1) % 8];
      pushFace(prims, v, [
        pt({ x: t1.c * trimR, y: y0 - 2 }, t1.s * trimR), pt({ x: t2.c * trimR, y: y0 - 2 }, t2.s * trimR),
        pt({ x: t2.c * trimR, y: y0 + 13 }, t2.s * trimR), pt({ x: t1.c * trimR, y: y0 + 13 }, t1.s * trimR)
      ], accent, { tone: 0.02, zBias: 0.5 });
    }
    /* 쿠션감 — 빛 반대쪽에 부드러운 그늘 한 줄(오버그립이 눌린 느낌) */
    for (k = 0; k < 8; k++) {
      var sp2 = verts[k], sq2 = verts[(k + 1) % 8];
      var sn = { x: Math.cos((k + 0.5) * Math.PI / 4), y: 0, z: Math.sin((k + 0.5) * Math.PI / 4) };
      if (litOf(sn, v) > 0.4) continue;
      pushFace(prims, v, [
        pt({ x: sp2.c * R * 1.006, y: y0 + 10 }, sp2.s * R * 1.006), pt({ x: sq2.c * R * 1.006, y: y0 + 10 }, sq2.s * R * 1.006),
        pt({ x: sq2.c * R * 1.006, y: y1 - 6 }, sq2.s * R * 1.006), pt({ x: sp2.c * R * 1.006, y: y1 - 6 }, sp2.s * R * 1.006)
      ], '#000000', { tone: 0, gloss: false, alpha: 0.12, zBias: 0.55 });
    }
    /* 엔드캡 — 바닥 로고 캡 */
    var capPts = [], capIn = [];
    for (k = 0; k < 8; k++) {
      var c1 = verts[k];
      capPts.push(pt({ x: c1.c * R * 0.98, y: y1 + 1 }, c1.s * R * 0.98));
      capIn.push(pt({ x: c1.c * R * 0.52, y: y1 + 1.5 }, c1.s * R * 0.52));
    }
    pushFace(prims, v, capPts, shade(weave === 'twotone' ? dark : grip, -0.3), { tone: 0.2, zBias: 0.2 });
    pushFace(prims, v, capIn, accent, { tone: 0.1, zBias: 0.3 });
  }

  /* ---------- 라켓 참 (그립 앞/뒤로 정확히 가려지도록 Z 정렬) ---------- */
  function charmPts(kind, cx, cy, z, r) {
    var out = [], i, n = 12;
    if (kind === 'ace') {
      for (i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rr = (i % 2) ? r * 0.46 : r;
        out.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, z: z });
      }
      return out;
    }
    if (kind === 'streak') {
      for (i = 0; i < n; i++) {
        var t = i / n * TAU;
        var hx = 16 * Math.pow(Math.sin(t), 3);
        var hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        out.push({ x: cx + hx * (r / 16), y: cy + hy * (r / 16), z: z });
      }
      return out;
    }
    for (i = 0; i < n; i++) {
      var a2 = i / n * TAU;
      out.push({ x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r, z: z });
    }
    return out;
  }

  function addCharm(prims, gm, v, c) {
    if (!c.charm || c.charm === 'none') return;
    var col = colorOf('charm', c.charm);
    var ang = 0.62;
    var R = gm.gripR + 8;
    var top = { x: Math.cos(ang) * gm.gripR * 0.92, y: gm.gripY0 + 14, z: Math.sin(ang) * gm.gripR * 0.92 };
    var endZ = Math.sin(ang) * R;
    var end = { x: Math.cos(ang) * R, y: gm.gripY0 + 50, z: endZ };
    var cordMid = { x: (top.x + end.x) / 2, y: top.y + 18, z: (top.z + endZ) / 2 + 1 };
    pushLines(prims, v, [[top, cordMid, end]], 'rgba(240,248,230,0.6)', Math.max(1, 1.7 * v.k), 1,
      project3(end, v).z + 0.6);
    prims.push({
      z: endZ + 0.9,
      pts: charmPts(c.charm, end.x, end.y, endZ + 0.9, Math.max(5, 8.6)).map(function (p) { return project3(p, v); }),
      fill: col, alpha: 1
    });
    prims.push({
      z: endZ + 1,
      pts: charmPts(c.charm, end.x, end.y, endZ + 1, Math.max(2.6, 4.2)).map(function (p) { return project3(p, v); }),
      fill: shade(col, 0.45), alpha: 0.85
    });
  }

  /* ============================================================
   * 효과(이펙트) — 색이 아니라 움직이는 연출 (bm-v1.81.0)
   *   스피드 링 · 스파크 전기 · 블레이즈 오라 · 챔피언 프리즘
   * ============================================================ */
  /* 타원 궤적의 한 구간 — 링·후광을 부드럽게 */
  function strokeEllipse(gm, v, scale, a0, a1, steps) {
    var out = [], i, n = Math.max(2, steps || 3);
    for (i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      out.push(project3({ x: Math.cos(a) * gm.rx * scale, y: Math.sin(a) * gm.ry * scale, z: 0 }, v));
    }
    return out;
  }

  function strokeArc(g, pts, color, lw, alpha, from, to) {
    var a = from == null ? 0 : from, b = to == null ? pts.length - 1 : to;
    if (b <= a) return;
    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[a].x, pts[a].y);
    for (var i = a + 1; i <= b; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
    g.restore();
  }

  function fxRingPoints(gm, v, scale, rot, count) {
    var loop = headLoop(gm, 3), out = [], i, n = loop.length;
    var cs = Math.cos(rot || 0), sn = Math.sin(rot || 0);
    for (i = 0; i < count; i++) {
      var p = loop[Math.floor(i / count * n) % n];
      var x = p.x * scale, y = p.y * scale;
      out.push(project3({ x: x * cs - y * sn, y: x * sn + y * cs, z: 0 }, v));
    }
    return out;
  }

  function fxLoopPoint(gm, v, frac, scale) {
    var loop = headLoop(gm, 3);
    var n = loop.length;
    var f = ((frac % 1) + 1) % 1;
    var p = loop[Math.floor(f * n) % n];
    return project3({ x: p.x * (scale || 1), y: p.y * (scale || 1), z: 0 }, v);
  }

  /* 헤드 뒤쪽 — 오라 · 궤적 링 · 홀로그램 후광 */
  function fxBack(g, gm, v, c, w, h) {
    var fx = c.effect;
    if (!fx || fx === 'none') return;
    var ph = v.phase || 0;
    var k, s, rot, pts;
    var cxp = project3({ x: 0, y: 0, z: 0 }, v);

    if (fx === 'speed') {
      for (k = 0; k < 2; k++) {
        var sc = 1.13 + k * 0.12;
        var headT = ph * (1.9 + k * 0.7) + k * 2.6;
        var tailT = 2.0 - k * 0.35;
        var N2 = 16;
        for (var sgi = 0; sgi < N2; sgi++) {
          var t0 = headT - tailT * (1 - sgi / N2);
          var t1 = headT - tailT * (1 - (sgi + 1) / N2);
          var pta = strokeEllipse(gm, v, sc, t0, t1, 2);
          var prog = sgi / (N2 - 1);
          strokeArc(g, pta, prog > 0.88 ? '#ffffff' : '#8fe2ff',
            Math.max(1, (1 + prog * 2.6) * v.k * 1.7), 0.05 + 0.7 * prog, 0, pta.length - 1);
        }
      }
    } else if (fx === 'spark') {
      var sg = g.createRadialGradient(cxp.x, cxp.y, 4, cxp.x, cxp.y, gm.rx * 2.1 * v.k);
      sg.addColorStop(0, 'rgba(120,200,255,0.24)');
      sg.addColorStop(1, 'rgba(120,200,255,0)');
      g.save();
      g.fillStyle = sg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.6 * v.k, gm.ry * 1.4 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.4 * v.k, 0, TAU);
      g.fill();
      g.restore();
      /* 톡톡 튀는 스파크 */
      for (k = 0; k < 10; k++) {
        var seed = k * 2.399;
        var on = Math.sin(ph * 3.4 + seed * 3.1);
        if (on < 0.15) continue;
        var p0 = fxLoopPoint(gm, v, k / 10 + ph * 0.04, 1.0);
        var dir = k % 2 ? 1 : 0.72;
        var len = (7 + 9 * ((seed * 7) % 1)) * v.k * 1.5;
        g.save();
        g.globalAlpha = 0.45 + 0.5 * Math.min(1, on);
        g.strokeStyle = k % 3 === 0 ? '#ffffff' : '#8fd0ff';
        g.lineWidth = Math.max(1, 1.6 * v.k * 1.6);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p0.x + len * dir * 0.5, p0.y - len * 0.7);
        g.lineTo(p0.x + len * dir, p0.y - len * 0.2);
        g.lineTo(p0.x + len * dir * 1.35, p0.y - len * 1.1);
        g.stroke();
        g.restore();
      }
    } else if (fx === 'blaze') {
      var bg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.35 * v.k, cxp.x, cxp.y, gm.rx * 1.55 * v.k);
      bg.addColorStop(0, 'rgba(255,158,50,0.34)');
      bg.addColorStop(0.6, 'rgba(255,96,24,0.14)');
      bg.addColorStop(1, 'rgba(255,60,0,0)');
      g.save();
      g.fillStyle = bg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.22 * v.k, gm.ry * 1.12 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.05 * v.k, 0, TAU);
      g.fill();
      g.restore();
    } else if (fx === 'prism') {
      for (k = 0; k < 2; k++) {
        var hb = ph * 90 + k * 140;
        for (var seg2 = 0; seg2 < 12; seg2++) {
          var sa = hb + seg2 * (TAU / 12), sb = sa + TAU / 12;
          var hue2 = ((ph * 90 + seg2 * 30 + k * 60) % 360);
          pts = strokeEllipse(gm, v, 1.16 + k * 0.1, sa, sb, 3);
          strokeArc(g, pts, 'hsla(' + hue2 + ',96%,76%,0.9)',
            Math.max(1.1, (2.4 - k * 0.6) * v.k * 1.7), 0.5, 0, pts.length - 1);
        }
      }
      var pg = g.createRadialGradient(cxp.x, cxp.y, 6, cxp.x, cxp.y, gm.rx * 2.4 * v.k);
      pg.addColorStop(0, 'rgba(255,236,170,0.26)');
      pg.addColorStop(1, 'rgba(255,200,80,0)');
      g.save();
      g.fillStyle = pg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.9 * v.k, gm.ry * 1.7 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.6 * v.k, 0, TAU);
      g.fill();
      g.restore();
    } else if (fx === 'fire') {
      /* 불꽃 스매시 — 헤드 뒤로 은은한 화염 후광 + 떠오르는 불티 */
      var fbg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.3 * v.k, cxp.x, cxp.y, gm.rx * 1.7 * v.k);
      fbg.addColorStop(0, 'rgba(255,120,40,0.34)');
      fbg.addColorStop(0.65, 'rgba(255,72,20,0.12)');
      fbg.addColorStop(1, 'rgba(255,40,0,0)');
      g.save();
      g.fillStyle = fbg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.3 * v.k, gm.ry * 1.2 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.1 * v.k, 0, TAU);
      g.fill();
      g.restore();
      for (k = 0; k < 10; k++) {
        var ff = (k / 10 + ph * 0.05) % 1;
        var fp = fxLoopPoint(gm, v, ff, 1.06);
        var rise = ((ph * 22 + k * 31) % 40) / 40;
        g.save();
        g.globalAlpha = (1 - rise) * 0.7;
        g.fillStyle = k % 3 === 0 ? '#ffe6a8' : '#ff8a2f';
        g.beginPath();
        g.arc(fp.x + Math.sin(ph * 3 + k) * 3 * v.k, fp.y - rise * 22 * v.k, Math.max(0.9, (2.2 - rise * 1.4) * v.k * 1.8), 0, TAU);
        g.fill();
        g.restore();
      }
    } else if (fx === 'thunder') {
      /* 번개 셔틀 — 가끔 헤드 주변에 번쩍이는 번개 */
      var bt = Math.sin(ph * 1.7);
      if (bt > 0.55) {
        g.save();
        g.globalAlpha = Math.min(0.95, (bt - 0.55) * 2.4);
        g.strokeStyle = '#d6ecff';
        g.lineWidth = Math.max(1, 1.6 * v.k * 1.6);
        g.lineCap = 'round';
        for (k = 0; k < 3; k++) {
          var a0 = ph * 0.7 + k * 2.1;
          var s0 = strokeEllipse(gm, v, 1.22, a0, a0 + 0.16, 2);
          if (s0.length < 2) continue;
          var mid = { x: (s0[0].x + s0[s0.length - 1].x) / 2 + Math.sin(ph * 9 + k) * 7 * v.k,
            y: (s0[0].y + s0[s0.length - 1].y) / 2 + Math.cos(ph * 7 + k) * 7 * v.k };
          g.beginPath();
          g.moveTo(s0[0].x, s0[0].y);
          g.lineTo(mid.x, mid.y);
          g.lineTo(s0[s0.length - 1].x, s0[s0.length - 1].y);
          g.stroke();
        }
        g.restore();
      }
      var tg = g.createRadialGradient(cxp.x, cxp.y, gm.rx * 0.3 * v.k, cxp.x, cxp.y, gm.rx * 1.5 * v.k);
      tg.addColorStop(0, 'rgba(140,215,255,0.22)');
      tg.addColorStop(1, 'rgba(70,140,255,0)');
      g.save();
      g.fillStyle = tg;
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp.x, cxp.y, gm.rx * 1.2 * v.k, gm.ry * 1.15 * v.k, 0, 0, TAU);
      else g.arc(cxp.x, cxp.y, gm.rx * 1.05 * v.k, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  /* 헤드 앞쪽 — 타오르는 불꽃 · 반짝이 */
  function fxFront(g, gm, v, c) {
    var fx = c.effect;
    if (!fx || fx === 'none') return;
    var ph = v.phase || 0;
    var k, p, nrm, len;
    if (fx === 'blaze') {
      /* 위에서 타오르는 열기 — 부드러운 라디얼 글로우 */
      var ctr2 = project3({ x: 0, y: -gm.ry * 0.35, z: 0 }, v);
      if (g.createRadialGradient) {
        var hg = g.createRadialGradient(ctr2.x, ctr2.y, gm.rx * 0.2 * v.k, ctr2.x, ctr2.y, gm.ry * 1.5 * v.k);
        hg.addColorStop(0, 'rgba(255,206,120,0.4)');
        hg.addColorStop(0.5, 'rgba(255,130,50,0.2)');
        hg.addColorStop(1, 'rgba(255,80,20,0)');
        g.save();
        g.fillStyle = hg;
        g.beginPath();
        if (g.ellipse) g.ellipse(ctr2.x, ctr2.y, gm.rx * 1.5 * v.k, gm.ry * 1.3 * v.k, 0, 0, TAU);
        else g.arc(ctr2.x, ctr2.y, gm.rx * 1.3 * v.k, 0, TAU);
        g.fill();
        g.restore();
      }
      for (k = 0; k < 26; k++) {
        var frac = (k / 26) * 0.78 - 0.39;               /* 위쪽 3/4만 — 목 쪽은 덜 탑니다 */
        p = fxLoopPoint(gm, v, frac, 1.0);
        var topness = 0.55 + 0.45 * Math.cos(frac * TAU);
        var wob = Math.sin(ph * 6 + k * 1.1);
        len = (3 + 9 * topness * (0.55 + 0.45 * wob)) * v.k * 1.5;
        var w0 = (3.2 + 2.8 * topness) * v.k * 1.6;
        var p2 = fxLoopPoint(gm, v, frac, 1.06);
        var dx = p2.x - p.x, dy = p2.y - p.y;
        var dl = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / dl, uy = dy / dl;
        var px2 = -uy, py2 = ux;
        var flick = 0.5 + 0.5 * wob;
        g.save();
        g.globalAlpha = 0.24 + 0.42 * flick;
        g.fillStyle = k % 4 === 0 ? 'rgba(255,250,214,0.95)' : (k % 4 === 1 ? 'rgba(255,206,96,0.92)' : 'rgba(255,132,44,0.86)');
        g.beginPath();
        g.moveTo(p.x - px2 * w0, p.y - py2 * w0);
        g.quadraticCurveTo(p.x + ux * len * 0.45 + px2 * w0 * 0.8, p.y + uy * len * 0.45 + py2 * w0 * 0.8,
          p.x + ux * len, p.y + uy * len);
        g.quadraticCurveTo(p.x + ux * len * 0.45 - px2 * w0 * 0.8, p.y + uy * len * 0.45 - py2 * w0 * 0.8,
          p.x + px2 * w0, p.y + py2 * w0);
        g.closePath();
        g.fill();
        g.restore();
      }
      /* 위로 떠오르는 불티 */
      for (k = 0; k < 5; k++) {
        var ft = (ph * 0.16 + k * 0.2) % 1;
        var q = fxLoopPoint(gm, v, (k * 0.21 - 0.2), 1.05);
        g.save();
        g.globalAlpha = (1 - ft) * 0.7;
        g.fillStyle = k % 2 ? '#ffd166' : '#ff9a4d';
        g.beginPath();
        g.arc(q.x + Math.sin(ph * 3 + k) * 4, q.y - ft * 40 * v.k * 2, Math.max(0.8, 1.8 * v.k * 2), 0, TAU);
        g.fill();
        g.restore();
      }
    } else if (fx === 'prism') {
      for (k = 0; k < 7; k++) {
        var f = (k / 7 + ph * 0.06) % 1;
        p = fxLoopPoint(gm, v, f, 1.02 + (k % 3) * 0.09);
        var r = (2.6 + (k % 3) * 1.5) * v.k * 2.4;
        var hue2 = (ph * 90 + k * 52) % 360;
        g.save();
        g.globalAlpha = 0.5 + 0.45 * Math.abs(Math.sin(ph * 2.6 + k));
        g.fillStyle = 'hsla(' + hue2 + ',95%,78%,0.95)';
        g.beginPath();
        g.moveTo(p.x, p.y - r);
        g.lineTo(p.x + r * 0.34, p.y - r * 0.34);
        g.lineTo(p.x + r, p.y);
        g.lineTo(p.x + r * 0.34, p.y + r * 0.34);
        g.lineTo(p.x, p.y + r);
        g.lineTo(p.x - r * 0.34, p.y + r * 0.34);
        g.lineTo(p.x - r, p.y);
        g.lineTo(p.x - r * 0.34, p.y - r * 0.34);
        g.closePath();
        g.fill();
        g.restore();
      }
    } else if (fx === 'spark') {
      for (k = 0; k < 8; k++) {
        var f2 = (k / 8 + 0.02 + ph * 0.02) % 1;
        p = fxLoopPoint(gm, v, f2, 1.03);
        g.save();
        g.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(ph * 4.6 + k * 1.7));
        g.fillStyle = k % 3 ? '#dff4ff' : '#8fd0ff';
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.9, 1.3 * v.k * 2), 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  /* ---------- 한 프레임 ---------- */
  function draw3d(g, v, custom, level, w, h, opts) {
    opts = opts || {};
    var c = normalizeCustom(custom);
    var gm = geomOf(c);
    var frame = colorOf('frame', c.frame);
    var grip = colorOf('grip', c.grip);
    var str = colorOf('string', c.string);
    var frameIt = itemOf('frame', c.frame) || {};
    var gripIt = itemOf('grip', c.grip) || {};
    var lvl = level || 'ok';

    g.clearRect(0, 0, w, h);

    /* 코트 조명 */
    var glow = gradR(g, 'bg', w / 2, h * 0.42, 8, Math.max(w, h) * 0.72, [
      [0, 'rgba(198,242,78,0.17)'], [0.52, 'rgba(198,242,78,0.05)'], [1, 'rgba(0,0,0,0)']
    ]);
    g.fillStyle = glow;
    /* 회전 중에는 캔버스가 축소돼 그려져 모서리가 비지 않게 넓게 칠합니다 */
    if (opts.spin) g.fillRect(-w * 0.45, -h * 0.45, w * 1.9, h * 1.9);
    else g.fillRect(0, 0, w, h);

    /* 헤드 뒤쪽 연출 — 링 · 오라 · 후광 */
    fxBack(g, gm, v, c, w, h);

    /* 바닥 그림자 — 모션으로 크게 돌 때는 그림자까지 같이 돌면 어색해서 그리지 않습니다 */
    var foot = project3({ x: 0, y: gm.gripY1 + 4, z: 0 }, v);
    if (!opts.spin) {
    g.save();
    g.globalAlpha = 0.34;
    g.fillStyle = '#000';
    g.beginPath();
    if (g.ellipse) g.ellipse(foot.x, foot.y + 12, gm.rx * 0.72 * v.k, 13 * v.k, 0, 0, TAU);
    else g.arc(foot.x, foot.y + 12, gm.rx * 0.6 * v.k, 0, TAU);
    g.fill();
    g.restore();
    }

    var prims = [];
    /* 바닥 강타로 헤드가 부서지는 순간에는 헤드를 그리지 않습니다(조각만 위에 그립니다) */
    if (!opts.noHead) {
      addHead(prims, gm, v, frame, frameIt);
      addFrameEdge(prims, gm, v, frame, frameIt);
      addDecals(prims, gm, v);
      addStrings(prims, gm, v, str, lvl, opts.wob);
      addStencil(prims, gm, v, c);
    }
    addShaft(prims, gm, v, frame, gm.accent, frameIt);
    addGrip(prims, gm, v, grip, gm.accent, gripIt);
    addCharm(prims, gm, v, c);
    paintPrims(g, prims);

    /* 헤드 앞쪽 연출 — 불꽃 · 반짝이 */
    fxFront(g, gm, v, c);

    /* 유리 같은 반사 — 회전 중에는 사각형이 같이 돌아 보여서 생략합니다 */
    if (!opts.spin) {
      var sheen = grad1(g, 'sheen', 0, 0, w * 0.9, h, [
        [0, 'rgba(255,255,255,0.07)'], [0.42, 'rgba(255,255,255,0)']
      ]);
      g.fillStyle = sheen;
      g.fillRect(0, 0, w, h);
    }

    /* 상태 표시 — 최상이면 반짝, 끊어졌으면 경고 점 */
    if (lvl === 'prime') {
      g.save();
      g.globalAlpha = 0.8; g.fillStyle = '#eaffb0';
      var sp = project3({ x: gm.rx * 0.62, y: -gm.ry * 0.72, z: 0 }, v);
      g.beginPath(); g.arc(sp.x, sp.y, Math.max(1.6, 3 * v.k), 0, TAU); g.fill();
      g.restore();
    }
  }

  /* 화면 좌표 → 파츠 (거트 · 테두리 · 그립) */
  function hitSlot(px, py, v, custom) {
    var gm = geomOf(custom);
    var i, q;
    /* 그립 */
    var g0 = project3({ x: 0, y: gm.gripY0 + 4, z: 0 }, v);
    var g1 = project3({ x: 0, y: gm.gripY1 - 2, z: 0 }, v);
    if (distToSeg(px, py, g0, g1) < Math.max(16, gm.gripR * 1.8 * g0.s * v.k)) return 'grip';
    /* 테두리 — 헤드 외곽선까지의 거리 */
    var loop = headLoop(gm, 3);
    var best = 1e9;
    for (i = 0; i < loop.length; i++) {
      var a = project3({ x: loop[i].x, y: loop[i].y, z: 0 }, v);
      var b = project3({ x: loop[(i + 1) % loop.length].x, y: loop[(i + 1) % loop.length].y, z: 0 }, v);
      var d = distToSeg(px, py, a, b);
      if (d < best) best = d;
    }
    if (best < Math.max(11, gm.hoop * 1.6 * v.k)) return 'frame';
    /* 거트 — 테두리 안쪽 */
    var polyPts = [];
    for (i = 0; i < 24; i++) {
      var ang = i / 24 * TAU;
      var rr = 0.94;
      polyPts.push(project3({ x: Math.cos(ang) * gm.rx * rr, y: Math.sin(ang) * gm.ry * rr, z: 0 }, v));
    }
    if (inPoly(px, py, polyPts)) return 'string';
    /* 목·샤프트도 테두리로 */
    var s0 = project3({ x: 0, y: gm.headBottom, z: 0 }, v);
    var s1 = project3({ x: 0, y: gm.throatY, z: 0 }, v);
    if (distToSeg(px, py, s0, s1) < Math.max(12, gm.tJoint * 0.7 * v.k)) return 'frame';
    return '';
  }

  function distToSeg(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = dx * dx + dy * dy;
    var t = len ? ((px - a.x) * dx + (py - a.y) * dy) / len : 0;
    t = Math.max(0, Math.min(1, t));
    var x = a.x + dx * t, y = a.y + dy * t;
    return Math.sqrt((px - x) * (px - x) + (py - y) * (py - y));
  }

  function inPoly(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-6) + xi)) inside = !inside;
    }
    return inside;
  }

  var viewMem = { yaw: -0.52, pitch: 0.16 };

  /* ============================================================
   * 터치 불꽃 스매시 (bm-v1.82.0)
   *  · 라켓을 짧게 톡 치거나 ⚡ 스매시 버튼을 누르면 60fps 캔버스로
   *    불꽃 파티클 + 셔틀콕 발사 + 충격 링이 이어집니다.
   *  · 드래그(360° 회전)와 부위 탭(꾸미기)은 그대로 함께 삽니다 —
   *    '꾸미기' 모드에서만 부위 탭이 파츠를 바꿉니다(기본은 스매시).
   *  · 파티클은 매 프레임 시간(t)에서 다시 계산합니다 — 상태를 쌓지 않아
   *    프레임이 밀려도 모양이 같고, 캔버스 한 장으로만 그려 CSP 위반이 없습니다.
   * ============================================================ */
  var SMASH_MS = 1250;
  var SMASH_PALETTE = {
    fire: { core: '#fff7dc', hot: '#ffd166', mid: '#ff8a2f', deep: '#ff3b2f', ring: '#ffb347', tail: 'rgba(255,120,40,', mist: 'rgba(255,180,90,' },
    ice: { core: '#ffffff', hot: '#d8f6ff', mid: '#7fd8ff', deep: '#4aa9ff', ring: '#a9e8ff', tail: 'rgba(150,225,255,', mist: 'rgba(200,240,255,' },
    thunder: { core: '#ffffff', hot: '#d6ecff', mid: '#7fd8ff', deep: '#3f7cf2', ring: '#9fd8ff', tail: 'rgba(150,210,255,', mist: 'rgba(190,225,255,' },
    /* bm-v1.95.0 — 세트 색과 짝을 이루는 임팩트 6종 */
    goldbolt: { core: '#fffce0', hot: '#fff2a8', mid: '#ffd84a', deep: '#c99000', ring: '#ffe98a', tail: 'rgba(255,216,74,', mist: 'rgba(255,240,170,' },
    void: { core: '#f2ecff', hot: '#cbb8ff', mid: '#8f6bff', deep: '#4a2fb0', ring: '#b49aff', tail: 'rgba(143,107,255,', mist: 'rgba(200,180,255,' },
    wind: { core: '#f0fff8', hot: '#b6ffe6', mid: '#45e0b0', deep: '#0f8f68', ring: '#8ff5d2', tail: 'rgba(69,224,176,', mist: 'rgba(190,255,232,' },
    blossom: { core: '#fff6fa', hot: '#ffd3e6', mid: '#ff9ec4', deep: '#c94a7a', ring: '#ffc2da', tail: 'rgba(255,158,196,', mist: 'rgba(255,220,235,' },
    snow: { core: '#ffffff', hot: '#eafaff', mid: '#c6ecff', deep: '#7fb6d9', ring: '#dff3ff', tail: 'rgba(223,243,255,', mist: 'rgba(235,250,255,' },
    aurora: { core: '#f4ffff', hot: '#c6ffe9', mid: '#7ce7d0', deep: '#4f7be0', ring: '#9be7ff', tail: 'rgba(124,231,208,', mist: 'rgba(190,235,255,' },
    none: { core: '#ffffff', hot: '#eaffb0', mid: '#c6f24e', deep: '#7fd8ff', ring: '#c6f24e', tail: 'rgba(198,242,78,', mist: 'rgba(220,255,170,' }
  };
  function smashPalette(id) { return SMASH_PALETTE[id] || SMASH_PALETTE.none; }
  function fxKind(id) {
    var f = String(id || '');
    if (f === 'fire' || f === 'ice' || f === 'thunder') return f;
    /* 새 임팩트도 결은 가장 가까운 연출(불·얼음·번개)을 빌려 그리고, 색은 팔레트가 정합니다 */
    if (f === 'goldbolt' || f === 'void' || f === 'aurora') return 'thunder';
    if (f === 'wind' || f === 'snow') return 'ice';
    if (f === 'blossom') return 'fire';
    return 'none';
  }

  /* 지금 입은 효과의 스매시 이름 — 버튼·토스트가 같은 말을 쓰게 */
  function smashLabel(id) {
    var it = itemOf('effect', id);
    return (it && it.smash) ? it.name : '스매시';
  }

  /* 씨앗으로만 만드는 난수 — 같은 순간이면 언제 다시 그려도 같은 모양 */
  function seedRand(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ============================================================
   * 스매시 연출 (bm-v1.84.0 — 완전히 새로)
   *  · 실제 셔틀콕(코르크 + 깃 16장)이 손목 스윙 궤적을 그리며 튀어나가고,
   *    불·얼음·번개 색의 꼬리와 파편이 함께 날아갑니다.
   *  · kind='slam' 이면 라켓이 코트 바닥을 내려찍어, 바닥 충격 링·금 간 판·파편과
   *    함께 헤드·거트가 산산이 부서졌다가 마지막에 다시 맞춰집니다.
   *  · 모든 파티클은 지난 시간(ms)만으로 매 프레임 새로 계산합니다 — 상태를 쌓지 않아
   *    프레임이 밀려도 모양이 같고, 60fps에서 가볍습니다.
   * ============================================================ */
  /* ============================================================
   * 실제 타격 연출 (bm-v1.86.0)
   *   ① 날아오기·백스윙   0 ~ 250ms  셔틀콕이 멀리서 포물선으로, 라켓은 뒤로 젖힘
   *   ② 스윙·임팩트     250 ~ 346ms  채찍처럼 휘둘러 정타 (+30ms 히트스톱)
   *   ③ 폭발·고속 발사  ~ 520ms      타점에서 효과 폭발, 셔틀콕이 화면 앞으로
   *  · 불·얼음·번개는 오프스크린 캔버스에 **한 번만 구운** 스프라이트를
   *    'lighter'(가산)로 겹쳐 그립니다 — 매 프레임 그라데이션·shadowBlur 를
   *    새로 만들지 않아 중급 안드로이드에서도 55~60fps 가 유지됩니다.
   * ============================================================ */
  var WIND_MS = 250;                 /* 1단계 — 0.22~0.28s */
  var SWING_MS = 96;                 /* 2단계 — 0.08~0.12s */
  var HITSTOP_MS = 30;               /* 타격 순간 프레임 멈춤 20~35ms */
  var HIT_AT = WIND_MS + SWING_MS;   /* 임팩트 시각 */
  var BOOM_MS = 520;                 /* 3단계 — 0.45~0.55s */
  var SHATTER_MS = 470;              /* 바닥 강타 — 헤드가 부서져 있는 시간 */

  function clamp01(p) { return p < 0 ? 0 : (p > 1 ? 1 : p); }
  function clampN(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function easeOut3(p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); }
  function easeIn3(p) { p = clamp01(p); return p * p * p; }
  function easeInOut3(p) { p = clamp01(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

  /* 히트스톱 — 정타 순간 30ms 동안 화면이 그대로 멈춘 뒤 이어집니다 */
  function smashClock(ms) {
    var m = Math.max(0, Number(ms) || 0);
    if (m <= HIT_AT) return m;
    if (m <= HIT_AT + HITSTOP_MS) return HIT_AT;
    return m - HITSTOP_MS;
  }
  /* 0 = 날아오기, 1 = 스윙, 2 = 폭발 */
  function smashPhase(ms) {
    var c = smashClock(ms);
    return c < WIND_MS ? 0 : (c < HIT_AT ? 1 : 2);
  }

  /* ---------- 라켓 자세 (백스윙 · 임팩트 · 팔로스루) ---------- */
  var POSE_BACK = { yaw: -0.46, pitch: -0.55, dx: 10, dy: -8, roll: -0.14 };
  var POSE_HIT = { yaw: 0.20, pitch: 0.42, dx: -30, dy: 16, roll: 0.14 };
  var POSE_FLOW = { yaw: 0.30, pitch: 0.60, dx: -40, dy: 22, roll: 0.10 };
  var POSE_BACK_SLAM = { yaw: -0.32, pitch: -0.98, dx: 6, dy: -20, roll: -0.08 };
  var POSE_HIT_SLAM = { yaw: 0.16, pitch: 0.56, dx: -14, dy: 46, roll: 0.04 };
  var POSE_FLOW_SLAM = { yaw: 0.20, pitch: 0.72, dx: -18, dy: 54, roll: 0.02 };

  function poseLerp(a, b, p) {
    return {
      yaw: a.yaw + (b.yaw - a.yaw) * p,
      pitch: a.pitch + (b.pitch - a.pitch) * p,
      dx: (a.dx || 0) + ((b.dx || 0) - (a.dx || 0)) * p,
      dy: a.dy + (b.dy - a.dy) * p,
      roll: a.roll + (b.roll - a.roll) * p
    };
  }

  /* 그 순간의 라켓 자세 — ①뒤로 젖히고 ②채찍처럼 ③따라 흐르며 제자리 */
  function swingOf(el, kind) {
    var zero = { yaw: 0, pitch: 0, dx: 0, dy: 0, roll: 0 };
    var c = smashClock(el);
    if (c <= 0) return zero;
    var slam = kind === 'slam';
    var back = slam ? POSE_BACK_SLAM : POSE_BACK;
    var hit = slam ? POSE_HIT_SLAM : POSE_HIT;
    var flow = slam ? POSE_FLOW_SLAM : POSE_FLOW;
    var pose;
    if (c < WIND_MS) {
      /* 뒤로 젖히며 손목을 코킹 — 끝에서 '치기 직전' 자세로 잠깐 머뭇거립니다 */
      pose = poseLerp(zero, back, easeOut3(c / WIND_MS * 1.05));
    } else if (c < HIT_AT) {
      /* 되감기 → 앞으로. 앞쪽에서 확 빨라지는 채찍 궤적 */
      pose = poseLerp(back, hit, Math.pow(clamp01((c - WIND_MS) / SWING_MS), 1.55));
    } else {
      var f = c - HIT_AT;
      pose = poseLerp(hit, flow, easeOut3(Math.min(1, f / 70)));
      var home = clamp01((f - 110) / 430);
      if (home > 0) pose = poseLerp(pose, zero, easeInOut3(home));
      /* 라켓이 맞은 뒤 떠는 진동 */
      var vib = Math.exp(-f / 150) * 0.055;
      pose.pitch += Math.sin(f / 7) * vib;
      pose.roll += Math.sin(f / 9 + 1) * vib * 0.6;
    }
    return pose;
  }

  /* ============================================================
   * 라켓 모션 프리셋 (bm-v1.86.0)
   *  · 3D 라켓 아래 칩을 누르면 바로 재생 — 하트로 열고(관리자는 전체 해금)
   *    열린 모션은 언제든 다시 감상할 수 있습니다.
   *  · 파티클·그라데이션 없이 회전 값만 움직이므로 60fps 로 매끄럽습니다.
   * ============================================================ */
  var MOTION_MS = { twist: 2400, showcase: 2800, flip: 2100 };
  function motionPose(kind, el) {
    var dur = MOTION_MS[kind] || 2200;
    var p = clamp01((Number(el) || 0) / dur);
    var out = { yaw: 0, pitch: 0, roll: 0, dy: 0 };
    if (kind === 'twist') {
      /* 손목 트위스트 — 잡고 비트는 8자 스핀. 처음엔 천천히 붙었다가 두 번 크게 돌고
       * 끝에서 부드럽게 풀립니다(비트 사이에 속도가 살짝 죽는 손목 리듬). */
      var w = p * TAU * 2;
      var env = Math.sin(Math.min(1, p / 0.12) * Math.PI * 0.5);          /* 살짝 붙기 */
      var rel = p > 0.86 ? 1 - easeInOut3((p - 0.86) / 0.14) : 1;          /* 끝에서 풀리기 */
      var beat = 0.86 + 0.14 * Math.abs(Math.cos(w * 0.5));                /* 비트마다 살짝 느려짐 */
      out.yaw = Math.sin(w) * 0.68 * env * rel * beat;
      out.pitch = Math.sin(p * TAU) * 0.2 * rel;
      out.roll = Math.cos(w + 0.6) * 0.14 * rel;
      out.dy = Math.sin(p * TAU) * 2.4 * rel;
    } else if (kind === 'showcase') {
      /* 쇼케이스 스핀 — 손목으로 라켓을 **한 바퀴(360°) 돌리기** (bm-v1.87.0)
       *  · bm-v1.86 처럼 yaw 만 크게 돌리면 90°·270° 에서 칼날처럼 얇아져 사라진 것처럼 보입니다.
       *  · 그래서 회전은 roll(화면 안에서 도는 손목 돌리기)로 주고, yaw·pitch 는 살짝만
       *    흔들어 프레임잉 옆면 두께와 거트 결이 함께 보이게 했습니다.
       *  · 끝 각도가 정확히 2π(roll) · 0(yaw/pitch) 라 멈출 때 화면이 튀지 않습니다. */
      var t2 = clamp01(p / 0.92);
      var e2 = easeInOut3(t2);
      out.roll = TAU * e2;
      out.yaw = Math.sin(t2 * Math.PI * 2) * 0.3;
      out.pitch = -0.06 + 0.3 * Math.sin(t2 * Math.PI);
      out.dy = -6 * Math.sin(t2 * Math.PI);
    } else {
      /* 공중 360° 플립 — 살짝 축지했다가(리듬) 떴다가 백플립 한 바퀴, 착지 반동 */
      var crouch = p < 0.1 ? Math.sin(p / 0.1 * Math.PI) * 2.6 : 0;
      var lift = Math.sin(clamp01((p - 0.06) / 0.86) * Math.PI);
      out.dy = -lift * 48 + crouch;
      out.yaw = lift * 0.5;
      out.pitch = -lift * 0.28;
      var sp = clamp01((p - 0.06) / 0.78);
      out.roll = easeInOut3(sp) * TAU;
      if (p > 0.88) {
        var b = (p - 0.88) / 0.12;
        out.dy += Math.sin(b * Math.PI) * 5.5;
      }
    }
    return out;
  }

  /* ---------- 셔틀콕 궤적 ---------- */
  /* ① 멀리(작게)에서 스위트 스팟으로 — 원근이 살아 있는 포물선 */
  function shuttlePath(imp, w, h, p, slam) {
    p = clamp01(p);
    var x0 = Math.max(w * 0.07, imp.x - w * (slam ? 0.30 : 0.33));
    var y0 = Math.max(h * 0.09, imp.y - h * (slam ? 0.34 : 0.38));
    /* 멀수록 천천히, 가까워질수록 빨라집니다 */
    var e = Math.pow(p, 1.45);
    return {
      x: x0 + (imp.x - x0) * e + Math.sin(p * Math.PI) * w * 0.035,
      y: y0 + (imp.y - y0) * e - Math.sin(p * Math.PI) * h * 0.055,
      sc: 0.30 + 0.70 * Math.pow(p, 1.15)
    };
  }

  /* 날아온 방향 — shuttlePath 의 마지막 구간 단위 벡터 (bm-v1.87.0)
   *  · 되받아치는 방향을 '지어내지' 않고, 셔틀이 실제로 들어온 궤적에서 재서 씀니다.
   *    (들어온 길의 반대 = 코르크가 180° 돌아 앞장서는 방향) */
  function entryVec(imp, w, h, slam) {
    var a = shuttlePath(imp, w, h, 0.9, slam);
    var b = shuttlePath(imp, w, h, 1, slam);
    var dx = b.x - a.x, dy = b.y - a.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: dx / len, y: dy / len, ang: Math.atan2(dy, dx) };
  }

  /* ③ 정타 뒤 — 날아온 방향의 반대로 되받아침(에어) · 코트 바닥으로 내려ŝ3(강타)
   *  bm-v1.87.0 — 실제 타구 방향:
   *   · 셔틀콕은 들어온 방향으로 되돌아 나가고(코르크가 180° 돌아 앞장섬),
   *   · 임팩트 직후 0.2 구간에서 그 회전이 눈에 보이게 빠르게 돌고,
   *   · 멀어지므로 크기가 줄며 화면 밖(왼쪽 위)으로 사라집니다. */
  function launchPath(imp, w, h, p, slam) {
    p = clamp01(p);
    if (slam) {
      var floorY = h * 0.9, hitP = 0.15;
      if (p < hitP) {
        var q = p / hitP;
        return { x: imp.x + w * 0.13 * q, y: imp.y + (floorY - 8 - imp.y) * (q * q), sc: 0.95 - 0.34 * q, rot: 1.2 };
      }
      var b = (p - hitP) / (1 - hitP);
      return {
        x: imp.x + w * 0.13 + w * 0.22 * b,
        y: floorY - 8 - Math.sin(b * Math.PI) * h * 0.13,
        sc: 0.61 - 0.26 * b, rot: 1.2 + b * 3.0
      };
    }
    var e = entryVec(imp, w, h, false);
    /* 들어온 각의 반대 + 조금 왼쪽으로 꺾인 코스(완전한 되집기는 어색합니다) */
    var dir = Math.atan2(-e.y, -e.x) - 0.20;
    var cdx = Math.cos(dir), cdy = Math.sin(dir);
    /* 화면 밖으로 나가는 거리 — 벽까지의 거리에 맞춰 '한 번에 사라지지 않고'
     * 되돌아가는 길이·속도가 보이게 합니다(가까운 벽까지만) */
    var toX = Math.abs(cdx) > 0.06 ? Math.max(50, imp.x - 6) / Math.abs(cdx) : 1e9;
    var toY = Math.abs(cdy) > 0.06 ? Math.max(50, imp.y - 6) / Math.abs(cdy) : 1e9;
    var reach = Math.min(toX, toY) * 1.04;
    var d = reach * (1 - Math.pow(1 - p, 1.7));
    /* 코스가 살짝 휘을 — 코트 너머로 넘어가는 되받아치기 느낌 */
    var bow = Math.sin(p * Math.PI) * Math.min(w, h) * 0.06;
    /* 코르크 회전 — 임팩트 직후 0.2 구간에서 들어온 각 → 나가는 각(약 180°) */
    var flip = easeOut3(clamp01(p / 0.2));
    var rot = e.ang + (dir - e.ang) * flip + Math.sin(p * 9) * 0.16 * (1 - flip * 0.55);
    return {
      x: imp.x + cdx * d - cdy * bow,
      y: imp.y + cdy * d + cdx * bow,
      sc: 1.0 - 0.62 * Math.pow(p, 0.8),   /* 멀어지며 작아짐(원근) */
      rot: rot,
      dir: dir
    };
  }

  /* ============================================================
   * 셔틀콕 — 실제 규격 비율 (bm-v1.86.0)
   *  · 코르크 지름 26mm(반구 앞코 + 짧은 넥 + 색 띠)
   *  · 깃털 16장 길이 64mm · 스커트 지름 62mm(약 26° 퍼짐) · 2줄 실 스티치
   *  · 깃대(축)·겹침·반투명 흰 그라데이션까지 그린 뒤, 스프라이트로 한 번 구워
   *    회전·확대는 drawImage 로만 합니다(매 프레임 다시 그리지 않음).
   * ============================================================ */
  var SHUT_L = 64, SHUT_W = 31, SHUT_R = 13;   /* mm 비율 */
  var shutSprite = {};
  /* 벡터 본체 — 코르크가 원점(0,0), 깃이 -x 로 뻗습니다 */
  function paintShuttle(g, sc, pal, kind, dim) {
    var L = SHUT_L * sc, W = SHUT_W * sc, R = SHUT_R * sc, neck = 5.5 * sc;
    var i, n = 16, ang, bx, by, tx, ty;
    dim = clamp01(dim || 0);
    /* 1) 스커트 바탕 — 반투명 흰 원뿔(속이 비쳐 보이게 낮은 알파) */
    g.beginPath();
    g.moveTo(-neck * 0.4, -R * 0.62);
    g.lineTo(-L, -W);
    g.lineTo(-L, W);
    g.lineTo(-neck * 0.4, R * 0.62);
    g.closePath();
    var sg = g.createLinearGradient(0, -R, 0, R);
    sg.addColorStop(0, 'rgba(252,254,255,0.72)');
    sg.addColorStop(0.4, 'rgba(240,247,253,0.5)');
    sg.addColorStop(0.72, 'rgba(214,228,240,0.44)');
    sg.addColorStop(1, 'rgba(188,205,220,0.5)');
    g.fillStyle = sg;
    g.fill();
    /* 2) 깃 16장 — 겹칠수록 밝게(비치는 깃) */
    for (i = 0; i < n; i++) {
      var f = i / (n - 1);                     /* 0 = 오른쪽 끝, 1 = 왼쪽 끝 */
      var side = f * 2 - 1;                    /* -1 ~ 1 */
      ang = side * Math.asin(Math.min(0.999, W / L)) * 0.94;
      bx = -neck * 0.4 + Math.sin(i * 2.7) * 0.6 * sc;
      by = -R * 0.42 + Math.sin(ang) * neck * 0.3;
      tx = -L * (0.99 - Math.abs(side) * 0.02);
      ty = Math.sin(ang) * W * 1.02;
      var wRoot = 1.4 * sc, wTip = 3.2 * sc;
      g.beginPath();
      g.moveTo(bx, by - wRoot);
      g.quadraticCurveTo((bx + tx) * 0.5, (by + ty) * 0.5 - wTip * 1.3, tx, ty - wTip * 0.5);
      g.lineTo(tx, ty + wTip * 0.5);
      g.quadraticCurveTo((bx + tx) * 0.5, (by + ty) * 0.5 + wTip * 1.3, bx, by + wRoot);
      g.closePath();
      g.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.5)'
        : (i % 4 === 1 ? 'rgba(238,246,252,0.26)'
          : (i % 4 === 2 ? 'rgba(255,255,255,0.34)' : 'rgba(210,224,238,0.3)'));
      g.fill();
      /* 깃대(축) — 가운데를 지나는 가는 선 */
      g.strokeStyle = 'rgba(176,196,214,' + (0.6 - dim * 0.25).toFixed(2) + ')';
      g.lineWidth = Math.max(0.35, 0.5 * sc);
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo((bx + tx) * 0.5, (by + ty) * 0.5 - wTip * 0.25, tx, ty);
      g.stroke();
    }
    /* 3) 깃 끝 결 — 살짝 들뜬 깃 끝 */
    g.strokeStyle = 'rgba(255,255,255,0.72)';
    g.lineWidth = Math.max(0.45, 0.7 * sc);
    g.beginPath();
    g.moveTo(-L * 0.995, -W);
    g.quadraticCurveTo(-L * 1.02, 0, -L * 0.995, W);
    g.stroke();
    /* 4) 2줄 실 스티치 띠 */
    var bands = [-0.2, -0.45];
    for (i = 0; i < bands.length; i++) {
      var xx = L * bands[i];
      var hh = W * (-bands[i]) * 0.94;
      g.strokeStyle = i === 0 ? 'rgba(176,192,208,0.95)' : 'rgba(150,170,188,0.8)';
      g.lineWidth = Math.max(0.45, (i === 0 ? 1.05 : 0.75) * sc);
      g.beginPath();
      g.moveTo(xx, -hh);
      g.quadraticCurveTo(xx - 2 * sc, 0, xx, hh);
      g.stroke();
      g.strokeStyle = 'rgba(120,140,160,0.5)';
      g.lineWidth = Math.max(0.35, 0.5 * sc);
      for (var k = 0; k < 7; k++) {
        var ty2 = -hh + (k + 0.5) / 7 * hh * 2;
        g.beginPath();
        g.moveTo(xx - 1 * sc, ty2);
        g.lineTo(xx + 1 * sc, ty2);
        g.stroke();
      }
    }
    /* 5) 넥(짧은 원통) */
    g.fillStyle = '#efe9d8';
    g.beginPath();
    g.moveTo(-neck, -R * 0.56);
    g.lineTo(-neck * 0.1, -R * 0.64);
    g.lineTo(-neck * 0.1, R * 0.64);
    g.lineTo(-neck, R * 0.56);
    g.closePath();
    g.fill();
    /* 6) 코르크 — 반구 앞코 + 가죽 질감 + 색 띠 */
    var cg = g.createRadialGradient(R * 0.3, -R * 0.42, R * 0.1, 0, 0, R * 1.02);
    cg.addColorStop(0, '#fffdf3');
    cg.addColorStop(0.38, '#f7efd8');
    cg.addColorStop(0.76, '#ddceac');
    cg.addColorStop(1, '#ab9670');
    g.fillStyle = cg;
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.fill();
    /* 가죽 결 — 아주 옅은 점 */
    g.fillStyle = 'rgba(150,132,96,0.2)';
    for (i = 0; i < 6; i++) {
      var ra = seedRand(i * 7 + 1) * TAU, rr = R * (0.18 + seedRand(i * 3) * 0.62);
      g.beginPath();
      g.arc(Math.cos(ra) * rr, Math.sin(ra) * rr, Math.max(0.28, 0.5 * sc), 0, TAU);
      g.fill();
    }
    /* 코르크 테두리 — 깃과 경계가 살아나게 */
    g.strokeStyle = 'rgba(126,110,80,0.5)';
    g.lineWidth = Math.max(0.4, 0.7 * sc);
    g.beginPath();
    g.arc(0, 0, R * 0.99, 0, TAU);
    g.stroke();
    /* 색 띠(녹색) — 실제 셔틀콕의 코르크 표시 */
    g.strokeStyle = 'rgba(52,124,82,0.9)';
    g.lineWidth = Math.max(0.5, 1.1 * sc);
    g.beginPath();
    g.arc(-neck * 0.15, 0, R * 0.92, Math.PI * 0.58, Math.PI * 1.42);
    g.stroke();
    /* 하이라이트 */
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(R * 0.28, -R * 0.38, R * 0.3, R * 0.17, -0.5, 0, TAU);
    g.fill();
  }

  /* 스프라이트 — 코르크 원점 기준으로 한 번만 굽습니다 */
  function shuttleTex(kind) {
    if (shutSprite[kind] !== undefined) return shutSprite[kind];
    var o = offCv(268, 232);
    if (!o) { shutSprite[kind] = null; return null; }
    var PX = 3;                            /* 굽는 배율 */
    o.g.setTransform(PX, 0, 0, PX, SHUT_L + 12, 116);   /* 코르크 원점을 (L+12, 116) 에 */
    o.g.clearRect(-(SHUT_L + 12) / PX, -116 / PX, 268 / PX, 232 / PX);
    paintShuttle(o.g, 1, null, kind, 0);
    o.ox = SHUT_L + 12;                    /* 스프라이트 안 코르크 위치(PX 단위) */
    o.oy = 116;
    o.px = 1 / PX;
    shutSprite[kind] = o;
    return o;
  }

  /* 셔틀콕 한 장 — rot 방향으로 코르크가 앞장섭니다 */
  function drawShuttle(g, x, y, sc, rot, pal, kind, alpha, opts) {
    opts = opts || {};
    var dim = clamp01(opts.dim == null ? 0 : opts.dim);
    var a = clamp01(alpha == null ? 1 : alpha) * (1 - dim * 0.28);
    if (a <= 0.01) return;
    var spr = shuttleTex(fxKind(kind));
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.globalAlpha = a;
    if (spr) {
      var s = sc * spr.px;
      g.drawImage(spr.cv, -spr.ox * s, -spr.oy * s, spr.w * s, spr.h * s);
    } else {
      paintShuttle(g, sc, pal, fxKind(kind), dim);
    }
    g.restore();
  }

  /* ============================================================
   * 스프라이트 텍스처 — 한 번만 굽고 drawImage 로 재사용
   * (매 프레임 createRadialGradient·shadowBlur 를 쓰지 않는 이유)
   * ============================================================ */
  var TEX = {};
  function offCv(w, h) {
    if (!hasDom || !root.document || !root.document.createElement) return null;
    var cv = root.document.createElement('canvas');
    if (!cv || !cv.getContext) return null;
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    if (!ctx) return null;
    return { cv: cv, g: ctx, w: w, h: h };
  }
  function blob(g, x, y, r, stops) {
    var lg = g.createRadialGradient(x, y, Math.max(0.01, r * 0.02), x, y, r);
    for (var i = 0; i < stops.length; i++) lg.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = lg;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }

  /* 스프라이트 가장자리를 부드럽게 지웁니다 — 스프라이트 사각 테두리가 보이지 않게 */
  function maskEdge(o, kx, ky) {
    if (!o) return o;
    var g = o.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.translate(o.w / 2, o.h / 2);
    g.scale(kx || 1, ky || 1);
    var r = Math.max(o.w, o.h) * 0.52;
    var lg = g.createRadialGradient(0, 0, r * 0.42, 0, 0, r);
    lg.addColorStop(0, 'rgba(0,0,0,1)');
    lg.addColorStop(0.72, 'rgba(0,0,0,0.92)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.arc(0, 0, r + 2, 0, TAU);
    g.fill();
    g.restore();
    return o;
  }

  /* 불꽃 — 백열 심 → 노랑 → 주황 → 붉은 혀 → 연기 끝 */
  function bakeFlame() {
    var o = offCv(160, 224); if (!o) return null;
    var g = o.g, t, i, f;
    g.globalCompositeOperation = 'lighter';
    /* 혀 10개 — 뿌리는 넓고 뜨겁게, 끝은 가늘게 타들어 가며 주황·붉음으로 */
    for (t = 0; t < 10; t++) {
      var bx = 80 + (seedRand(t * 7 + 1) - 0.5) * 46;
      var tipY = 22 + seedRand(t * 5 + 2) * 64;
      var baseY = 198;
      var wd = 13 + seedRand(t * 3 + 4) * 15;
      var lean = (seedRand(t * 11 + 5) - 0.5) * 26;
      for (i = 0; i <= 16; i++) {
        f = i / 16;                            /* 0 = 꼭대기, 1 = 뿌리 */
        var y = tipY + (baseY - tipY) * f;
        var sway = lean * (1 - f) * (1 - f) + Math.sin(f * 4 + t) * 6 * (1 - f);
        var r = wd * (0.26 + 0.92 * f) * (1 - 0.22 * Math.pow(1 - f, 2));
        var al = 0.13 + 0.34 * Math.pow(f, 1.15);
        blob(g, bx + sway, y, r, [
          [0, 'rgba(255,242,200,' + (al * 0.92).toFixed(3) + ')'],
          [0.3, 'rgba(255,176,56,' + (al * 0.82).toFixed(3) + ')'],
          [0.64, 'rgba(240,88,18,' + (al * 0.46).toFixed(3) + ')'],
          [1, 'rgba(140,24,4,0)']
        ]);
      }
    }
    /* 불덩이 사이의 어두운 틈 — 가산만 하면 하얗게 타서 형태가 사라집니다 */
    g.globalCompositeOperation = 'destination-out';
    for (i = 0; i < 10; i++) {
      var hx = 76 + (seedRand(i * 11 + 6) - 0.5) * 58;
      var hy = 108 + (seedRand(i * 5 + 3) - 0.5) * 96;
      blob(g, hx, hy, 6 + seedRand(i * 3 + 2) * 12, [
        [0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.24)'], [1, 'rgba(0,0,0,0)']
      ]);
    }
    g.globalCompositeOperation = 'source-over';
    return maskEdge(o, 1, 0.9);
  }

  /* 얼음 결정 — 반투명 청록 + 흰 테두리 + 굴절 하이라이트 */
  function bakeIceShard() {
    var o = offCv(48, 88); if (!o) return null;
    var g = o.g;
    var pts = [[24, 3], [41, 27], [35, 68], [24, 84], [13, 68], [7, 27]];
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    var lg = g.createLinearGradient(7, 3, 41, 84);
    lg.addColorStop(0, 'rgba(255,255,255,0.98)');
    lg.addColorStop(0.3, 'rgba(214,246,255,0.92)');
    lg.addColorStop(0.62, 'rgba(130,212,250,0.86)');
    lg.addColorStop(1, 'rgba(62,142,214,0.7)');
    g.fillStyle = lg;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.92)';
    g.lineWidth = 2;
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(16, 22); g.lineTo(24, 58); g.stroke();
    g.strokeStyle = 'rgba(180,240,255,0.5)';
    g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(31, 17); g.lineTo(22, 68); g.stroke();
    g.strokeStyle = 'rgba(120,200,255,0.45)';
    g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(24, 30); g.lineTo(34, 44); g.stroke();
    return o;
  }

  /* 얼음 가시 — 길고 날카로운 결정 */
  function bakeIceSpike() {
    var o = offCv(36, 108); if (!o) return null;
    var g = o.g;
    g.beginPath();
    g.moveTo(18, 2); g.lineTo(29, 40); g.lineTo(24, 96); g.lineTo(18, 106);
    g.lineTo(12, 96); g.lineTo(7, 40);
    g.closePath();
    var lg = g.createLinearGradient(7, 2, 29, 106);
    lg.addColorStop(0, 'rgba(255,255,255,1)');
    lg.addColorStop(0.42, 'rgba(198,240,255,0.9)');
    lg.addColorStop(1, 'rgba(96,180,238,0.66)');
    g.fillStyle = lg; g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6; g.stroke();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(17, 12); g.lineTo(19, 92); g.stroke();
    return o;
  }

  function bakeEmber() {
    var o = offCv(28, 28); if (!o) return null;
    blob(o.g, 14, 14, 14, [
      [0, 'rgba(255,255,248,1)'], [0.2, 'rgba(255,232,164,0.96)'],
      [0.48, 'rgba(255,152,52,0.58)'], [1, 'rgba(255,88,20,0)']
    ]);
    return o;
  }

  function bakeSmoke() {
    var o = offCv(96, 96); if (!o) return null;
    var g = o.g, i, a, rr;
    /* 가운데에 몰린 연기 덩어리 — 테두리에 고리가 생기지 않게 */
    for (i = 0; i < 16; i++) {
      a = i / 16 * TAU + seedRand(i) * 0.6;
      rr = seedRand(i * 3) * 12;
      blob(g, 48 + Math.cos(a) * rr, 48 + Math.sin(a) * rr * 0.9, 14 + seedRand(i * 7) * 13, [
        [0, 'rgba(150,146,140,0.22)'], [0.55, 'rgba(118,114,110,0.12)'], [1, 'rgba(90,88,86,0)']
      ]);
    }
    blob(g, 48, 50, 32, [
      [0, 'rgba(150,146,140,0.2)'], [0.6, 'rgba(120,116,112,0.1)'], [1, 'rgba(96,94,92,0)']
    ]);
    return maskEdge(o);
  }

  function bakeFlash() {
    var o = offCv(128, 128); if (!o) return null;
    var g = o.g;
    blob(g, 64, 64, 62, [
      [0, 'rgba(255,255,255,1)'], [0.16, 'rgba(255,252,236,0.94)'],
      [0.4, 'rgba(255,216,128,0.5)'], [0.7, 'rgba(255,148,54,0.18)'], [1, 'rgba(255,96,24,0)']
    ]);
    g.globalCompositeOperation = 'lighter';
    /* 빛줄기 — 원형 블롭을 이어 부드럽게(직선 경계가 보이지 않게) */
    for (var i = 0; i < 6; i++) {
      var ang = i / 6 * TAU + 0.32;
      for (var k = 1; k <= 6; k++) {
        var d = k * 10, al = 0.34 * (1 - k / 6.6);
        blob(g, 64 + Math.cos(ang) * d, 64 + Math.sin(ang) * d, 7 - k * 0.7, [
          [0, 'rgba(255,246,214,' + al.toFixed(3) + ')'],
          [0.5, 'rgba(255,182,86,' + (al * 0.6).toFixed(3) + ')'],
          [1, 'rgba(255,140,50,0)']
        ]);
      }
    }
    return maskEdge(o);
  }

  function bakeRing() {
    var o = offCv(128, 128); if (!o) return null;
    blob(o.g, 64, 64, 63, [
      [0, 'rgba(255,255,255,0)'], [0.58, 'rgba(255,255,255,0)'],
      [0.78, 'rgba(255,255,255,0.9)'], [0.89, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']
    ]);
    return o;
  }

  function bakeFrost() {
    var o = offCv(128, 128); if (!o) return null;
    blob(o.g, 64, 64, 62, [
      [0, 'rgba(230,250,255,0.46)'], [0.42, 'rgba(178,232,255,0.24)'],
      [0.74, 'rgba(150,212,255,0.1)'], [1, 'rgba(140,200,255,0)']
    ]);
    return o;
  }

  function bakeDust() {
    var o = offCv(96, 96); if (!o) return null;
    for (var i = 0; i < 18; i++) {
      blob(o.g, 48 + (seedRand(i * 3) - 0.5) * 32, 48 + (seedRand(i * 5) - 0.5) * 30, 12 + seedRand(i * 7) * 14, [
        [0, 'rgba(186,192,186,0.22)'], [0.6, 'rgba(152,160,152,0.1)'], [1, 'rgba(130,138,130,0)']
      ]);
    }
    return maskEdge(o);
  }

  var BAKERS = { flame: bakeFlame, iceShard: bakeIceShard, iceSpike: bakeIceSpike, ember: bakeEmber,
    smoke: bakeSmoke, flash: bakeFlash, ring: bakeRing, frost: bakeFrost, dust: bakeDust };
  function tex(name) {
    if (TEX[name] === undefined) TEX[name] = hasDom && BAKERS[name] ? BAKERS[name]() : null;
    return TEX[name];
  }

  /* 스프라이트 한 장 찍기 — 가산 합성(lighter)으로 빛을 더합니다 */
  function blit(g, name, cx, cy, w, h, rot, alpha, add) {
    var spr = tex(name);
    if (!spr || w <= 0 || h <= 0) return false;
    if (alpha <= 0.008) return false;
    g.save();
    if (add) g.globalCompositeOperation = 'lighter';
    g.globalAlpha = clamp01(alpha);
    if (rot) {
      g.translate(cx, cy);
      g.rotate(rot);
      g.drawImage(spr.cv, -w / 2, -h / 2, w, h);
    } else {
      g.drawImage(spr.cv, cx - w / 2, cy - h / 2, w, h);
    }
    g.restore();
    return true;
  }

  /* 스프라이트를 못 굽는 환경(아주 오래된 브라우저·테스트)용 벡터 파편 */
  function drawShards(g, cx, cy, rx, t, pal, kind, unit) {
    var n = kind === 'ice' ? 14 : 11, i, ang, sp, d, sz, rot;
    for (i = 0; i < n; i++) {
      ang = i / n * TAU + seedRand(i * 7 + 2) * 0.4;
      sp = 0.5 + seedRand(i * 11 + 5) * 0.9;
      d = rx * (0.4 + 2.2 * t) * sp;
      sz = Math.max(0.8, (6 - t * 3.6) * unit * (0.6 + seedRand(i * 3 + 1) * 0.8));
      rot = ang + t * (1.5 + seedRand(i) * 2.4);
      g.save();
      g.globalAlpha = Math.max(0, (1 - t * 0.95) * 0.95);
      g.translate(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d + 46 * unit * t * t);
      g.rotate(rot);
      g.beginPath();
      if (kind === 'ice') {
        g.moveTo(0, -sz * 1.9); g.lineTo(sz * 0.95, -sz * 0.35); g.lineTo(sz * 0.6, sz * 1.7);
        g.lineTo(-sz * 0.6, sz * 1.7); g.lineTo(-sz * 0.95, -sz * 0.35);
      } else {
        g.moveTo(0, -sz * 1.6); g.lineTo(sz * 0.9, 0); g.lineTo(0, sz * 1.6); g.lineTo(-sz * 0.9, 0);
      }
      g.closePath();
      g.fillStyle = kind === 'ice' ? (i % 3 === 0 ? '#ffffff' : (i % 2 ? '#cdf3ff' : '#8fdcff'))
        : (i % 3 === 0 ? pal.core : (i % 2 ? pal.mid : pal.deep));
      g.fill();
      g.restore();
    }
  }

  /* ---------- 불꽃 폭발 — 실제 불처럼 혀·불티·연기·열기 ---------- */
  function fxFire(g, cx, cy, rx, t, unit) {
    if (!tex('flame')) { drawShards(g, cx, cy, rx, t, smashPalette('fire'), 'fire', unit); return; }
    var e = easeOut3(Math.min(1, t * 1.6));
    var i, a, sp, d, sz, al, x, y;
    /* 1) 코어 섬광 */
    if (t < 0.34) {
      var fr = rx * 1.9 * (0.45 + t * 1.4);
      blit(g, 'flash', cx, cy, fr, fr, t * 1.4, Math.pow(1 - t / 0.34, 1.6) * 0.5, true);
    }
    /* 2) 불꽃 혀 — 타점에서 사방으로 솟구치며 퍼집니다 */
    for (i = 0; i < 14; i++) {
      a = -Math.PI / 2 + (seedRand(i * 11 + 3) - 0.5) * 3.4;
      sp = 0.25 + seedRand(i * 7 + 5) * 1.15;
      d = rx * (0.05 + 0.95 * e * sp);
      x = cx + Math.cos(a) * d;
      y = cy + Math.sin(a) * d * 0.8 - rx * 0.36 * e * t;
      sz = rx * (0.8 + 0.66 * sp) * (0.62 + 0.72 * Math.min(1, t * 3.6));
      al = Math.max(0, 1 - t * 1.02) * (0.34 + seedRand(i * 3) * 0.3);
      blit(g, 'flame', x, y, sz * 0.94, sz * 1.4, a * 0.32 + Math.sin(t * 5 + i) * 0.28, al, true);
    }
    /* 2-1) 뜨거운 기운 — 뒤에 깔리는 옅은 주황 광(흰 코어가 하얗게 타지 않게) */
    if (t < 0.6) {
      var gw = rx * 3.0 * (0.6 + t);
      blit(g, 'ember', cx, cy, gw, gw * 0.86, 0, (1 - t / 0.6) * 0.2, true);
    }
    /* 3) 불티 — 위로 솟으며 흩날림 */
    for (i = 0; i < 18; i++) {
      a = -Math.PI / 2 + (seedRand(i * 5 + 3) - 0.5) * 2.3;
      sp = 0.5 + seedRand(i * 17 + 9) * 1.25;
      x = cx + Math.cos(a) * rx * (0.25 + sp * 1.7) * e + Math.sin(t * 9 + i) * 5 * unit;
      y = cy + Math.sin(a) * rx * (0.25 + sp * 1.5) * e - 48 * unit * t * t * sp;
      sz = Math.max(1.2, (7.5 - t * 5.2) * unit * (0.6 + seedRand(i * 13 + 1)));
      al = Math.max(0, 1 - t * 0.92);
      blit(g, 'ember', x, y, sz, sz, 0, al, true);
    }
    /* 4) 연기 — 불티 위로 옅게 피어오르다 금방 사라집니다 */
    if (t > 0.14) {
      for (i = 0; i < 4; i++) {
        var st = clamp01((t - 0.14 - i * 0.06) * 1.9);
        if (st <= 0 || st >= 1) continue;
        var sx = cx + (seedRand(i * 9 + 2) - 0.5) * rx * 1.2 + Math.sin(t * 4 + i) * 6 * unit;
        var sy = cy - rx * (0.55 + 1.35 * st) - i * 4 * unit;
        var ss = rx * (0.55 + 1.15 * st);
        blit(g, 'smoke', sx, sy, ss, ss * 0.85, i * 0.6 + t, (1 - st) * st * 0.85, false);
      }
    }
    /* 5) 열기 — 아주 옅은 열 흔들림만 */
    if (t < 0.5) {
      var hg = rx * (1.4 + 2.2 * t);
      blit(g, 'frost', cx, cy, hg, hg * 0.85, 0, (1 - t / 0.5) * 0.16, true);
    }
    g.restore();
    g.globalAlpha = 1;
  }

  /* ---------- 얼음 폭발 — 갈라진 결정·서리 안개·얼음 가시 ---------- */
  function fxIce(g, cx, cy, rx, t, unit) {
    if (!tex('iceShard')) { drawShards(g, cx, cy, rx, t, smashPalette('ice'), 'ice', unit); return; }
    var e = easeOut3(Math.min(1, t * 1.8));
    var i, a, sp, d, sz, al, x, y, rot;
    /* 1) 차가운 섬광 */
    if (t < 0.3) {
      var fr = rx * 2.1 * (0.45 + t * 1.5);
      blit(g, 'flash', cx, cy, fr, fr, 0, Math.pow(1 - t / 0.3, 1.5) * 0.42, true);
    }
    /* 2) 얼음 가시 — 방사형으로 튀는 날카로운 결정 */
    for (i = 0; i < 16; i++) {
      a = i / 16 * TAU + (seedRand(i * 5 + 1) - 0.5) * 0.5;
      sp = 0.5 + seedRand(i * 9 + 2) * 1.15;
      d = rx * (0.08 + 1.5 * e * sp);
      sz = rx * (0.34 + seedRand(i * 13) * 0.46);
      al = Math.max(0, 1 - t * 0.95);
      x = cx + Math.cos(a) * d;
      y = cy + Math.sin(a) * d * 0.92 + 36 * unit * t * t;
      rot = a + Math.PI / 2 + Math.sin(t * 6 + i) * 0.25;
      blit(g, i % 3 === 0 ? 'iceSpike' : 'iceShard', x, y, sz * 0.66, sz * 1.5, rot, al, false);
      /* 결정 테두리 하이라이트(가산) */
      blit(g, i % 3 === 0 ? 'iceSpike' : 'iceShard', x, y, sz * 0.66, sz * 1.5, rot, al * 0.3, true);
    }
    /* 3) 서리 안개 — 차가운 냉기가 퍼짐 */
    for (i = 0; i < 4; i++) {
      var mp = clamp01((t - i * 0.06) * 1.5);
      if (mp <= 0) continue;
      var mr = rx * (0.9 + i * 0.5 + 1.9 * mp);
      blit(g, 'frost', cx, cy, mr * 2, mr * 1.6, 0, (1 - mp) * (0.5 - i * 0.08), true);
    }
    /* 4) 얼음 파편 먼지 — 작고 반짝이는 가루 */
    for (i = 0; i < 20; i++) {
      a = i / 20 * TAU + seedRand(i * 3) * 0.6;
      sp = 0.7 + seedRand(i * 7 + 4) * 1.2;
      d = rx * (0.3 + 2.1 * e * sp);
      sz = Math.max(1.4, (6.5 - t * 4.6) * unit);
      blit(g, 'ember', cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9 + 34 * unit * t * t,
        sz, sz, 0, Math.max(0, 1 - t) * 0.5, true);
    }
    /* 5) 갈라진 금 — 타점에서 뻗는 흰 균열 */
    if (t < 0.75) {
      var ca = Math.pow(1 - t / 0.75, 1.2) * 0.85;
      g.save();
      g.globalAlpha = ca;
      g.strokeStyle = 'rgba(240,252,255,0.9)';
      g.lineWidth = Math.max(1, 1.8 * unit);
      for (i = 0; i < 7; i++) {
        var ang0 = i / 7 * TAU + 0.2;
        var len = rx * (0.5 + 1.5 * e) * (0.7 + seedRand(i * 4) * 0.6);
        g.beginPath();
        g.moveTo(cx + Math.cos(ang0) * rx * 0.12, cy + Math.sin(ang0) * rx * 0.12);
        var px2 = cx, py2 = cy;
        for (var s2 = 1; s2 <= 3; s2++) {
          var f2 = s2 / 3;
          px2 = cx + Math.cos(ang0) * len * f2 + (seedRand(i * 7 + s2) - 0.5) * len * 0.16;
          py2 = cy + Math.sin(ang0) * len * f2 + (seedRand(i * 11 + s2) - 0.5) * len * 0.16;
          g.lineTo(px2, py2);
        }
        g.stroke();
      }
      g.restore();
    }
  }

  /* ---------- 번개 — 지그재그 아크 + 전기 잔광 ---------- */
  function fxThunder(g, cx, cy, rx, t, unit) {
    if (!tex('flash')) { drawShards(g, cx, cy, rx, t, smashPalette('thunder'), 'thunder', unit); return; }
    var i, j, seg = 5;
    if (t < 0.4) {
      var fr = rx * 2.2 * (0.5 + t * 1.4);
      blit(g, 'flash', cx, cy, fr, fr, 0, Math.pow(1 - t / 0.4, 1.5) * 0.5, true);
    }
    g.save();
    g.lineCap = 'round';
    for (i = 0; i < 7; i++) {
      var a = i / 7 * TAU + seedRand(i * 13 + 3) * 0.8;
      var len = rx * (1.1 + seedRand(i * 7) * 1.6) * (0.3 + Math.min(1, t * 4) * 0.85);
      var flick = 0.5 + 0.5 * Math.sin(t * 32 + i * 2.1);
      var al = Math.pow(1 - t, 1.25) * flick;
      if (al <= 0.02) continue;
      g.beginPath();
      g.moveTo(cx, cy);
      var x = cx, y = cy;
      for (j = 1; j <= seg; j++) {
        var f = j / seg;
        var da = a + (seedRand(i * 31 + j * 7) - 0.5) * 0.95;
        x = cx + Math.cos(a) * len * f + Math.cos(da) * len * 0.17;
        y = cy + Math.sin(a) * len * f + Math.sin(da) * len * 0.17;
        g.lineTo(x, y);
      }
      g.globalAlpha = al * 0.42;
      g.strokeStyle = 'rgba(120,190,255,1)';
      g.lineWidth = Math.max(2, 6 * unit * (1 - t * 0.4));
      g.stroke();
      g.globalAlpha = al;
      g.strokeStyle = 'rgba(255,255,255,0.96)';
      g.lineWidth = Math.max(1, 1.9 * unit * (1 - t * 0.4));
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
    for (i = 0; i < 14; i++) {
      var sa = i / 14 * TAU + seedRand(i * 5) * 0.5;
      var sd = rx * (0.2 + 2.0 * easeOut3(Math.min(1, t * 2))) * (0.5 + seedRand(i * 9));
      var sz2 = Math.max(1.4, (6.5 - t * 4.8) * unit);
      blit(g, 'ember', cx + Math.cos(sa) * sd, cy + Math.sin(sa) * sd, sz2, sz2, 0, Math.max(0, 1 - t) * 0.55, true);
    }
  }

  /* ---------- 바닥 강타 — 충격 링 · 균열 · 파편 · 먼지 ---------- */
  function drawFloor(g, v, gm, t, pal, kind, w, h, unit, cxp) {
    if (t <= 0) return;
    var floorY = h * 0.9;
    cxp = cxp == null ? w * 0.5 : cxp;
    var i;
    /* 코트 바닥 선 */
    g.save();
    g.globalAlpha = 0.5 * Math.min(1, t * 3);
    var lg = grad1(g, 'floor', 0, floorY, w, floorY, [
      [0, 'rgba(198,242,78,0)'], [0.5, 'rgba(198,242,78,0.6)'], [1, 'rgba(198,242,78,0)']
    ]);
    g.strokeStyle = lg;
    g.lineWidth = Math.max(1, 2 * unit);
    g.beginPath();
    g.moveTo(0, floorY); g.lineTo(w, floorY);
    g.stroke();
    /* 충격 링 — 납작한 타원 3장 */
    for (i = 0; i < 3; i++) {
      var p = t - i * 0.11;
      if (p <= 0) continue;
      var rr = Math.min(1.15, p);
      g.globalAlpha = Math.max(0, (1 - rr) * (0.95 - i * 0.18));
      g.strokeStyle = i === 0 ? '#ffffff' : pal.ring;
      g.lineWidth = Math.max(1, (7 - i * 1.8 - rr * 4) * unit * 1.5);
      g.beginPath();
      if (g.ellipse) g.ellipse(cxp, floorY, gm.rx * (0.4 + 2.7 * rr) * v.k, gm.rx * (0.13 + 0.62 * rr) * v.k, 0, 0, TAU);
      else g.arc(cxp, floorY, gm.rx * (0.4 + 2 * rr) * v.k, 0, TAU);
      g.stroke();
    }
    /* 균열 — 바닥에서 뻗는 금 + 잔가지 */
    g.globalAlpha = Math.min(1, t * 2.2) * 0.9;
    g.strokeStyle = kind === 'ice' ? '#bfefff' : (kind === 'fire' ? '#ffc27a' : '#eaffb0');
    g.lineWidth = Math.max(1, 1.7 * unit);
    for (i = 0; i < 8; i++) {
      var a = Math.PI + (i + 0.5) / 8 * Math.PI * 0.96;
      var len = gm.rx * (0.7 + seedRand(i * 9 + 4) * 1.6) * Math.min(1, t * 2.4) * v.k;
      var x0 = cxp + Math.cos(a) * gm.rx * 0.08 * v.k;
      var x1 = x0 + Math.cos(a) * len, y1 = floorY + Math.sin(a) * len * 0.3;
      g.beginPath();
      g.moveTo(x0, floorY);
      g.lineTo((x0 + x1) / 2 + (seedRand(i * 3) - 0.5) * 14 * unit, (floorY + y1) / 2);
      g.lineTo(x1, y1);
      var bx2 = (x0 + x1) / 2, by2 = (floorY + y1) / 2;
      g.lineTo(bx2 + Math.cos(a + 0.7) * len * 0.22, by2 + Math.sin(a + 0.7) * len * 0.16);
      g.stroke();
    }
    g.restore();
    /* 먼지 — 링과 함께 피어오르는 회색 연기 */
    for (i = 0; i < 5; i++) {
      var dt2 = clamp01((t - i * 0.05) * 1.5);
      if (dt2 <= 0) continue;
      var dxp = cxp + (seedRand(i * 7 + 3) - 0.5) * gm.rx * 2.4 * v.k;
      blit(g, 'dust', dxp, floorY - 10 * unit - 26 * unit * dt2, gm.rx * (1.1 + 1.4 * dt2) * v.k,
        gm.rx * (0.55 + 0.7 * dt2) * v.k, 0, (1 - dt2) * 0.75, false);
    }
    /* 튀는 파편 */
    for (i = 0; i < 16; i++) {
      var spp = 0.5 + seedRand(i * 13 + 7);
      var ang = -Math.PI / 2 + (seedRand(i * 5 + 2) - 0.5) * 2.6;
      var dd = gm.rx * 1.9 * Math.min(1, t * 1.4) * spp * v.k;
      var yy = floorY + Math.sin(ang) * dd * 0.62 - 66 * unit * t * t;
      var xx = cxp + Math.cos(ang) * dd;
      var sz = Math.max(1, (5 - t * 3.6) * unit);
      g.globalAlpha = Math.max(0, 1 - t * 0.9);
      g.fillStyle = i % 3 === 0 ? pal.core : (i % 2 ? pal.mid : '#d9e7de');
      g.beginPath();
      g.arc(xx, yy, sz, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* 헤드가 부서진 조각 — 강타 순간에만 (draw3d 가 헤드를 숨긴 자리에) */
  function drawHeadShards(g, v, gm, t, pal, kind, unit) {
    if (t <= 0 || t >= 1) return;
    var cxp = project3({ x: 0, y: 0, z: 0 }, v);
    var loop = headLoop(gm, 2), n = loop.length;
    var pieces = 12, i, j;
    for (i = 0; i < pieces; i++) {
      var i0 = Math.floor(i / pieces * n), i1 = Math.floor((i + 1) / pieces * n);
      var pts = [project3({ x: 0, y: 0, z: 0 }, v)];
      for (j = i0; j <= i1; j++) {
        var p = loop[j % n];
        pts.push(project3({ x: p.x, y: p.y, z: 0 }, v));
      }
      var dir = i / pieces * TAU + 0.4;
      var ox = Math.cos(dir) * 66 * t * t * v.k;
      var oy = Math.sin(dir) * 26 * t * t * v.k + 96 * t * t * v.k;
      var rot = (seedRand(i * 3) - 0.5) * 3.2 * t;
      g.save();
      g.globalAlpha = Math.max(0, 1 - t * 1.05);
      g.translate(cxp.x + ox, cxp.y + oy);
      g.rotate(rot);
      g.beginPath();
      g.moveTo(pts[0].x - cxp.x, pts[0].y - cxp.y);
      for (j = 1; j < pts.length; j++) g.lineTo(pts[j].x - cxp.x, pts[j].y - cxp.y);
      g.closePath();
      g.fillStyle = i % 5 === 0 ? pal.hot : (i % 2 ? '#2b3a33' : '#1d2a24');
      g.fill();
      g.strokeStyle = kind === 'ice' ? '#cdf3ff' : pal.ring;
      g.lineWidth = Math.max(0.6, 1.2 * unit);
      g.stroke();
      g.restore();
    }
  }

  /* 스윙 중 라켓 테두리 잔상 — 지나온 자세를 몇 장 겹쳐 모션 블러 */
  /* 스윙 잔상 — 라켓 헤드가 지나온 길 (bm-v1.86.0)
   *  bm-v1.87.0 — 헤드 테두리 잔상뿐 아니라 **스위트 스팟 궤적(아크)** 를 한 줄로 그어
   *  셔틀이 날아온 쪽에서 라켓이 어느 길로 지나가 임팩트에 닿았는지 눈에 보이게 했습니다.
   *  선 몇 개만 더 그리므로 60fps 에 영향이 없습니다. */
  function drawRacketGhosts(g, base, gm, custom, el, kind, w, h) {
    var cl = smashClock(el);
    if (cl < WIND_MS + 8) return;
    var frame = colorOf('frame', normalizeCustom(custom).frame);
    var loop = headLoop(gm, 2), n = loop.length;
    var dyK = Math.min(1, w / 390);
    var k, i;
    var arc = [];
    for (k = 6; k >= 0; k--) {
      var past = swingOf(el - k * 11, kind);
      var vg = {
        yaw: base.yaw + past.yaw,
        pitch: clampN(base.pitch + past.pitch, -1.25, 1.25),
        k: base.k, cx: base.cx + past.dx * dyK, cy: base.cy + past.dy * dyK, mid: base.mid, phase: base.phase
      };
      /* 스위트 스팟이 지나온 자리 */
      arc.push(project3({ x: 0, y: -gm.ry * 0.16, z: 0 }, vg));
      if (k > 0) {
        g.save();
        g.globalAlpha = (0.20 - k * 0.02) * (1 - k / 9);
        g.strokeStyle = frame;
        g.lineWidth = Math.max(1, 1.8 * vg.k);
        g.beginPath();
        for (i = 0; i < n; i += 2) {
          var p = project3({ x: loop[i].x, y: loop[i].y, z: 0 }, vg);
          if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
        }
        g.closePath();
        g.stroke();
        g.restore();
      }
    }
    /* 스윗 스팟 아크 — 밝게 한 줄, 끝(지금 위치)으로 갈수록 진하게 */
    if (arc.length > 2) {
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (i = 1; i < arc.length; i++) {
        var t = i / (arc.length - 1);
        g.globalAlpha = 0.1 + 0.42 * t * t;
        g.strokeStyle = i === arc.length - 1 ? '#ffffff' : frame;
        g.lineWidth = Math.max(0.8, (0.9 + 2.2 * t) * (base.k || 1) * 0.9);
        g.beginPath();
        g.moveTo(arc[i - 1].x, arc[i - 1].y);
        g.lineTo(arc[i].x, arc[i].y);
        g.stroke();
      }
      g.restore();
    }
  }

  /* 셔틀콕 그림자 — 코트 바닥에 닿을 듯한 부드러운 그림자 (bm-v1.87.0)
   *  · 공중에 떠 있는 느낌과 원근을 만들어 줍니다(한 프레임에 타원 하나). */
  function shuttleShadow(g, x, y, sc, unit, a) {
    if (!(a > 0.01)) return;
    g.save();
    g.globalAlpha = clamp01(a) * 0.24;
    g.fillStyle = '#04080a';
    g.beginPath();
    var ry = Math.max(2, 5.5 * sc * unit), rx2 = Math.max(6, 17 * sc * unit);
    if (g.ellipse) g.ellipse(x + 7 * sc * unit, y + 27 * sc * unit, rx2, ry, 0, 0, TAU);
    else g.arc(x + 7 * sc * unit, y + 27 * sc * unit, rx2, 0, TAU);
    g.fill();
    g.restore();
  }

  /* 스매시 임팩트 — draw3d 위에 한 장 더 그립니다 (ms = 시작 후 지난 시간)
   *  fx = 연출 id('fire' · 'ice' · 'thunder' · ''), opts.kind = 'air' | 'slam' */
  function drawSmash(g, v, gm, fx, ms, w, h, opts) {
    opts = opts || {};
    var slam = opts.kind === 'slam';
    var fxId = fxKind(fx);
    var pal = smashPalette(fxId);
    var unit = Math.min(w, h) / 360;
    var cl = smashClock(ms);
    var after = Math.max(0, cl - HIT_AT);
    var boom = clamp01(after / BOOM_MS);
    var rx = Math.max(20, gm.rx * v.k) * 0.95;
    var i, a, len;

    /* 타점 — 라켓 스위트 스팟(임팩트 자세 기준) */
    var ip0 = opts.imp || { x: v.cx, y: v.cy };
    var imp = { x: clampN(ip0.x, w * 0.26, w * 0.74), y: clampN(ip0.y, h * 0.24, h * 0.64) };
    var accSc = Math.max(0.30, unit * 0.62);       /* 셔틀콕 화면 배율 */

    /* ① 날아오는 셔틀콕 — 멀리서 포물선 */
    if (cl < HIT_AT + 1) {
      var p = clamp01(cl / HIT_AT);        /* 임팩트 순간에 스위트 스팟 도착 */
      var s0 = shuttlePath(imp, w, h, p, slam);
      var s1 = shuttlePath(imp, w, h, Math.min(1, p + 0.05), slam);
      var travel = Math.atan2(s1.y - s0.y, s1.x - s0.x);
      /* 빠를수록 길게 — 잔상 */
      var spd = p > 0.4 ? (p - 0.4) / 0.6 : 0;
      for (var kk = 4; kk >= 1; kk--) {
        var q = shuttlePath(imp, w, h, Math.max(0, p - kk * 0.035), slam);
        g.globalAlpha = 0.18 * spd * (1 - kk / 6);
        g.fillStyle = 'rgba(228,242,255,0.9)';
        g.beginPath();
        g.arc(q.x, q.y, Math.max(1, 4 * q.sc * unit), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      shuttleShadow(g, s0.x, s0.y, s0.sc * 1.15, unit, 0.55 + p * 0.45);
      drawShuttle(g, s0.x, s0.y, s0.sc * accSc * 1.15, travel + Math.sin(p * 7) * 0.05,
        pal, fxId, clamp01(cl / 80), { dim: 1 - p });
    }

    /* ② 정타 — 섬광 · 충격 링 · 방사 빛 (맞기 전에는 그리지 않습니다) */
    if (cl >= HIT_AT) {
      /* 히트스톱 동안에는 완전히 멈춘 한 장 */
      var ha = Math.pow(1 - clamp01(after / 190), 1.4);
      if (ha > 0.01) {
        g.save();
        g.globalAlpha = 0.26 * ha;
        g.fillStyle = '#04080a';
        g.fillRect(0, 0, w, h);
        g.restore();
        /* bm-v1.87.0 — 섬광을 조금 줄여 정타 순간에도 라켓 헤드가 보이게 */
        var fr = rx * 2.2 * (0.5 + Math.min(1, after / 150) * 1.0);
        blit(g, 'flash', imp.x, imp.y, fr, fr, after * 0.004, ha * 0.40, true);
      }
      /* 충격 링 — 한 장만, 얇고 빠르게(여러 장 겹치면 과녁처럼 보입니다) */
      g.save();
      var rp0 = clamp01(boom / 0.24);
      if (rp0 > 0 && rp0 < 1) {
        g.globalAlpha = Math.pow(1 - rp0, 2) * 0.6;
        g.strokeStyle = '#ffffff';
        g.lineWidth = Math.max(0.8, (2.6 - rp0 * 2.2) * unit * 1.25);
        g.beginPath();
        if (g.ellipse) g.ellipse(imp.x, imp.y, rx * (0.5 + 1.5 * rp0), rx * (0.42 + 1.15 * rp0), 0, 0, TAU);
        else g.arc(imp.x, imp.y, rx * (0.5 + 1.5 * rp0), 0, TAU);
        g.stroke();
      }
      g.restore();
      /* 방사형 빛줄기 */
      g.save();
      g.globalAlpha = 1;
      for (i = 0; i < 14; i++) {
        a = i / 14 * TAU + 0.2;
        len = (14 + 30 * seedRand(i * 31 + 7)) * unit * (0.3 + Math.min(1, boom * 3.4) * 1.4) * (1 - boom * 0.35);
        g.globalAlpha = Math.max(0, (0.8 - i * 0.03) * Math.pow(1 - boom, 1.2));
        g.strokeStyle = i % 3 === 0 ? pal.core : pal.mid;
        g.lineWidth = Math.max(1, 2.4 * unit * (1 - boom * 0.5));
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(imp.x + Math.cos(a) * len * 0.32, imp.y + Math.sin(a) * len * 0.32);
        g.lineTo(imp.x + Math.cos(a) * len, imp.y + Math.sin(a) * len);
        g.stroke();
      }
      g.restore();
      g.globalAlpha = 1;
    }

    /* ③ 효과 폭발 — 불·얼음·번개(가산 합성 스프라이트) */
    if (after > 0 && boom < 1) {
      if (fxId === 'fire') fxFire(g, imp.x, imp.y, rx, boom, unit);
      else if (fxId === 'ice') fxIce(g, imp.x, imp.y, rx, boom, unit);
      else if (fxId === 'thunder') fxThunder(g, imp.x, imp.y, rx, boom, unit);
      else {
        /* 기본(효과 없음)도 민짜는 아니게 — 옅은 백열 링만 */
        for (i = 0; i < 2; i++) {
          var bp = clamp01((boom - i * 0.08) / 0.7);
          if (bp <= 0 || bp >= 1) continue;
          blit(g, 'ember', imp.x + (i ? 8 : -6) * unit, imp.y, 10 * unit, 10 * unit, 0, (1 - bp) * 0.4, true);
        }
        for (i = 0; i < 10; i++) {
          a = i / 10 * TAU + 0.3;
          var dd2 = rx * (0.3 + 1.7 * easeOut3(Math.min(1, boom * 2))) * (0.6 + seedRand(i * 5));
          blit(g, 'ember', imp.x + Math.cos(a) * dd2, imp.y + Math.sin(a) * dd2, 5 * unit, 5 * unit, 0, (1 - boom) * 0.5, true);
        }
      }
    }

    /* ④ 바닥 강타 — 바닥 충격·균열·파편, 헤드 파손 */
    if (slam) {
      var floorT = clamp01((cl - HIT_AT) / (BOOM_MS * 0.9));
      drawFloor(g, v, gm, floorT, pal, fxId, w, h, unit, clampN(ip0.x, w * 0.3, w * 0.7));
      drawHeadShards(g, v, gm, clamp01((cl - HIT_AT) / SHATTER_MS), pal, fxId, unit);
      /* 다시 맞춰지는 순간의 반짝임 */
      var re = clamp01((cl - (HIT_AT + SHATTER_MS)) / 220);
      if (re > 0 && re < 1) blit(g, 'flash', ip0.x, ip0.y - 40 * unit, rx * 2.2 * (0.6 + re * 0.8),
        rx * 2.2 * (0.6 + re * 0.8), 0, (1 - re) * 0.35, true);
    }

    /* ⑤ 발사된 셔틀콕 — 회전하며 화면 앞으로 */
    if (after > 0) {
      var lp = launchPath(imp, w, h, boom, slam);
      var sp = Math.max(0.2, lp.sc * accSc * 1.2);
      /* 꼬리 — 같은 색 잔상 */
      for (i = 6; i >= 1; i--) {
        var q2 = launchPath(imp, w, h, clamp01(boom - i * 0.045), slam);
        g.globalAlpha = Math.max(0, (1 - boom) * 0.3 * (1 - i / 8));
        g.fillStyle = pal.tail + '0.85)';
        g.beginPath();
        g.arc(q2.x, q2.y, Math.max(1, (7 - i) * q2.sc * accSc * 0.55), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      shuttleShadow(g, lp.x, lp.y, lp.sc, unit, (1 - boom) * 0.75);
      drawShuttle(g, lp.x, lp.y, sp, lp.rot, pal, fxId, Math.max(0, 1 - Math.pow(boom, 2.8)));
    }

    /* ⑥ 효과 이름 — 정타 뒤 톡 (바닥 강타는 '바닥 강타') */
    if (after > 40 && boom < 0.72) {
      var na = Math.max(0, Math.min(1, (0.72 - boom) / 0.28));
      var pop = 0.9 + 0.2 * Math.min(1, (after - 40) / 130);
      var fs = Math.round(22 * unit * pop);
      var label = slam ? (smashLabel(fxId) + ' · 바닥 강타') : smashLabel(fxId);
      g.globalAlpha = Math.min(1, na * 1.1);
      g.font = '900 ' + fs + 'px system-ui, -apple-system, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      var labW = (g.measureText ? g.measureText(label).width : fs * label.length) + fs * 0.9;
      var labelY = clampN(imp.y + rx * 1.55, fs + 12, h - fs - 14);
      g.globalAlpha = Math.min(1, na * 0.86);
      g.fillStyle = 'rgba(6,12,9,0.78)';
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(imp.x - labW / 2, labelY - fs * 0.82, labW, fs * 1.64, fs * 0.8);
        g.fill();
      } else {
        g.fillRect(imp.x - labW / 2, labelY - fs * 0.8, labW, fs * 1.6);
      }
      g.globalAlpha = Math.min(1, na * 1.15);
      g.lineWidth = Math.max(2, 3 * unit);
      g.strokeStyle = 'rgba(10,16,12,0.6)';
      if (g.strokeText) g.strokeText(label, imp.x, labelY);
      g.fillStyle = pal.core;
      g.fillText(label, imp.x, labelY);
    }
    g.globalAlpha = 1;
  }

  /* 캔버스 그라데이션 캐시 — 같은 자리·같은 색이면 다시 만들지 않습니다 */
  var GRAD = {};
  function gradR(g, key, x, y, r0, r1, stops) {
    var k2 = key + '|' + Math.round(x) + ',' + Math.round(y) + ',' + Math.round(r0) + ',' + Math.round(r1);
    var rg = GRAD[k2];
    if (!rg) {
      rg = g.createRadialGradient(x, y, Math.max(0.01, r0), x, y, Math.max(r0 + 1, r1));
      for (var i = 0; i < stops.length; i++) rg.addColorStop(stops[i][0], stops[i][1]);
      GRAD[k2] = rg;
    }
    return rg;
  }
  function grad1(g, key, x0, y0, x1, y1, stops) {
    var k2 = key + '|' + Math.round(x0) + ',' + Math.round(y0) + ',' + Math.round(x1) + ',' + Math.round(y1);
    var lg = GRAD[k2];
    if (!lg) {
      lg = g.createLinearGradient(x0, y0, x1, y1);
      for (var i = 0; i < stops.length; i++) lg.addColorStop(stops[i][0], stops[i][1]);
      GRAD[k2] = lg;
    }
    return lg;
  }

  /* 스프라이트 예열 — 한 번에 다 구우면 시트가 잠깐 멈추므로 60ms 간격으로 나눠 굽습니다 */
  var WARM_LIST = ['ember', 'flash', 'smoke', 'frost', 'flame', 'iceShard', 'iceSpike', 'dust'];
  var warmBusy = false;
  function warmTextures() {
    if (warmBusy || !hasDom || !root.setTimeout) return;
    warmBusy = true;
    var i = 0;
    function step() {
      if (i < WARM_LIST.length) {
        tex(WARM_LIST[i++]);
        root.setTimeout(step, 60);
        return;
      }
      /* 셔틀콕 스프라이트(연출별 색)도 미리 */
      shuttleTex('none'); shuttleTex('fire'); shuttleTex('ice'); shuttleTex('thunder');
    }
    root.setTimeout(step, 500);
  }

  /* 시트 안의 3D 뷰를 붙입니다 — 드래그 회전 · 짧은 탭은 스매시(꾸미기 모드에선 부위 선택) */
  function mount3d(host, ctx) {
    if (!hasDom) return null;
    /* bm-v1.88.0 — 저장소에 넣은 Three.js(WebGL)로 진짜 3D 라켓을 먼저 그립니다.
     *  · WebGL 이 없는 곳(Node 테스트·구형 기기)이나 엔진 로드에 실패하면
     *    아래 2D 캔버스 렌더러로 조용히 돌아갑니다 — 화면이 비지 않습니다. */
    if (BM.racket3d && typeof BM.racket3d.available === 'function' && BM.racket3d.available()) {
      try {
        var a3 = BM.racket3d.create(host, ctx);
        if (a3) {
          a3.view.yaw = viewMem.yaw;
          a3.view.pitch = viewMem.pitch;
          a3.fit();
          if (BM.racketcustom) BM.racketcustom._last3d = a3;
          /* bm-v1.96.0 — 전체화면으로 다시 그릴 때는 새 크기에 맞춰 한 번 더 잽니다 */
          if (fullOn) [30, 140].forEach(function (ms) {
            setTimeout(function () { try { a3.fit(); } catch (e2) { /* 무시 */ } }, ms);
          });
          return a3;
        }
      } catch (e) {
        if (root.console && root.console.warn) root.console.warn('3D 엔진을 열지 못해 기본 뷰로 갑니다', e && e.message);
      }
    }
    var cv = host.querySelector('.rk3d__cv');
    if (!cv || !cv.getContext) return null;
    var g = cv.getContext('2d');
    if (!g) return null;
    var state = ctx.store.state;
    var dpr = Math.min(1.5, (root.devicePixelRatio || 1));   /* 3D는 저해상도로도 충분 — 필레이트 절약 */
    /* 색을 바꿔 다시 그려도 보던 각도 그대로 (시트를 닫았다 열어도) */
    var v = { yaw: viewMem.yaw, pitch: viewMem.pitch, k: 1, cx: 0, cy: 0, mid: 0, phase: 0 };
    var drag = null, lastMove = 0, lastPaint = 0, lastTick = 0, idlePhase = 0, raf = 0, alive = true;
    var w = 0, h = 0, fitCssW = 0, fitCssH = 0;
    /* bm-v1.84.0 — 손목 회전 관성: 끌던 속도를 기억했다가 손을 떼면 부드럽게 감속합니다 */
    var vel = { yaw: 0, pitch: 0 }, roll = 0, lastDragAt = 0;
    /* 터치 스매시 상태 — smashAt(시작 시각) · smashFx(그때 입은 효과) · smashKind('air'|'slam') */
    var smashAt = 0, smashFx = '', smashOn = false, smashKind = 'air';
    /* 모션 프리셋 상태 — motionKind('twist'|'showcase'|'flip') · motionAt(시작 시각) */
    var motionKind = '', motionAt = 0, motionOn = false;
    var holdAt = null;      /* 캡처·검사용: 이 시간(ms)에 연출을 멈춰 둡니다 */
    var api = { view: v, paint: paint, redraw: paint, fit: function () { fit(); paint(); }, body: '',
      smash: smash, slam: slam, mode: function () { return stageMode; }, smashing: function () { return smashOn; },
      kind: function () { return smashKind; },
      /* 라켓 모션 프리셋 재생 (bm-v1.86.0) */
      motion: motion, motioning: function () { return motionOn; },
      motionKind: function () { return motionKind; },
      /* 연출을 원하는 순간에 멈춰 두기(화면 캡처·자동 점검) — 사용자 동작과는 무관합니다 */
      hold: function (ms, kind) {
        holdAt = Math.max(0, Number(ms) || 0);
        if (kind) smashKind = kind === 'slam' ? 'slam' : 'air';
        smashFx = smashFx || customOf(ctx.store.state.me).effect;
        smashOn = true; smashAt = nowMs(); paint(); return true;
      },
      resume: function () { holdAt = null; smashAt = nowMs(); smashOn = true; paint(); return true; } };

    function nowMs() {
      return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
    }

    /* 지금 모션 자세 — 끝나면 스스로 멈춥니다 */
    function motionNow() {
      if (!motionOn) return null;
      var dur = MOTION_MS[motionKind] || 2200;
      if (holdAt != null) return motionPose(motionKind, Math.min(dur - 1, holdAt));
      var e = nowMs() - motionAt;
      if (e >= dur) { motionOn = false; return null; }
      return motionPose(motionKind, e);
    }

    /* 모션 한 번 — 칩을 누르면 여기로 옵니다 */
    function motion(kind) {
      var k2 = String(kind || '');
      if (MOTIONS.indexOf(k2) < 0) return false;
      motionKind = k2;
      motionAt = nowMs();
      motionOn = true;
      smashOn = false;
      vel.yaw = 0; vel.pitch = 0; roll = 0;
      lastMove = Date.now();
      if (BM.ui) BM.ui.haptic(12);
      paint();
      return true;
    }

    /* 스매시 한 번 — 짧은 탭·⚡ 버튼·미리보기가 모두 이 함수를 씁니다 */
    function smash(fxId, kind) {
      smashFx = (fxId === undefined || fxId === null) ? customOf(ctx.store.state.me).effect : String(fxId);
      smashKind = kind === 'slam' ? 'slam' : 'air';
      motionOn = false;
      smashAt = nowMs();
      smashOn = true;
      vel.yaw = 0; vel.pitch = 0;
      lastMove = Date.now();          /* 스매시 동안에는 자동 회전을 잠깐 멈춥니다 */
      /* bm-v1.90.0 — 3D 를 못 여는 기기에서도 효과별 타격음은 그대로 */
      if (BM.smashsound) BM.smashsound.play(smashFx, smashKind);
      if (BM.ui) BM.ui.haptic(smashKind === 'slam' ? 22 : 14);
      paint();
      return true;
    }

    /* 바닥 강타 — 라켓이 코트를 내려찍고 헤드·거트가 부서지는 클라이맥스 연출 */
    function slam(fxId) { return smash(fxId, 'slam'); }

    function fit() {
      var rect = cv.getBoundingClientRect();
      fitCssW = cv.clientWidth || Math.round(rect.width);
      fitCssH = cv.clientHeight || Math.round(rect.height);
      w = Math.max(160, Math.round(rect.width));
      h = Math.max(200, Math.round(rect.height));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var gm = geomOf(customOf(ctx.store.state.me));
      v.mid = gm.mid;
      /* 바디마다 전체 길이가 달라도 캔버스 안에 꽉 차게 (원근 배율 보정 포함) */
      var persp = (FOCUS + CAM_Z) / FOCUS;
      v.k = Math.min(w / (gm.rx * 2.9), h / (gm.span * 1.1)) * persp;
      v.cx = w / 2;
      v.cy = h / 2 + 2;
    }

    function paint() {
      if (!alive) return;
      var t0 = nowMs();
      var c = customOf(ctx.store.state.me);
      var gm = geomOf(c);
      var lvl = conditionOf(ctx.store.state).level;
      var el = smashOn ? (holdAt != null ? holdAt : nowMs() - smashAt) : 0;
      if (smashOn && el >= SMASH_MS) { smashOn = false; el = 0; }
      var cl = smashOn ? smashClock(el) : 0;
      /* 스윙 — 라켓이 실제로 내려치듯 자세가 바뀝니다 */
      var sw = (smashOn && cl > 0) ? swingOf(el, smashKind) : null;
      var vv = v;
      if (sw) {
        vv = { yaw: v.yaw + sw.yaw, pitch: clampN(v.pitch + sw.pitch, -1.25, 1.25),
          k: v.k, cx: v.cx, cy: v.cy, mid: v.mid, phase: v.phase };
      }
      /* 정타 순간의 화면 흔들림 + 기울기 — 짧고 묵직하게 */
      var shake = 0, shakeY = 0, tilt = roll;
      if (smashOn) {
        var ah = cl - HIT_AT;
        var boom = ah > 0 ? Math.max(0, 1 - ah / 300) : 0;
        var amp = (smashKind === 'slam' ? 11 : 8) * Math.min(1, w / 360);
        shake = Math.sin(ah / 9) * amp * boom;
        shakeY = Math.cos(ah / 12) * amp * 0.55 * boom;
        tilt += Math.sin(ah / 14) * 0.04 * boom;
      }
      /* 모션 프리셋 — 눌러서 감상하는 트릭 회전 */
      var mo = motionNow();
      if (mo) {
        vv = { yaw: vv.yaw + mo.yaw, pitch: clampN(vv.pitch + mo.pitch, -1.3, 1.3),
          k: vv.k, cx: vv.cx, cy: vv.cy, mid: vv.mid, phase: vv.phase };
        /* roll(손목 돌리기)은 아래에서 '축소 + 회전'으로 따로 적용합니다 — 여기서 tilt 로 또 돌리면 두 배로 돕니다 */
      }
      var dyK = Math.min(1, w / 390);
      /* 헤드가 부서지는 구간 — 부서진 조각만 보이게 */
      var noHead = smashOn && smashKind === 'slam' && cl >= HIT_AT && cl <= HIT_AT + SHATTER_MS;
      /* 거트 탄성 — 맞은 뒤 줄이 떨립니다 */
      var wob = 0;
      if (smashOn && cl >= HIT_AT && cl < HIT_AT + 260) {
        var wt = cl - HIT_AT;
        wob = Math.sin(wt / 7.5) * 5.5 * Math.exp(-wt / 95);
      }
      g.save();
      /* bm-v1.87.0 — 회전·확대(모션 roll) 변혀이 걸린 상태로 지우면 이전 프레임이 모서리에 남습니다.
       *  먼저 화면 좌표로 되돌려 캔버스를 완전히 비우고 그 위에 그립니다. */
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (shake) g.translate(shake, shakeY);
      /* 모션 roll(손목 돌리기)은 화면 가운데를 축으로 돌리되, 360° 때는 라켓이 화면 밖으로
       * 나가지 않게 같은 비율로 조금 작아졌다가 돌아옵니다 (bm-v1.87.0) */
      var spinScale = mo && mo.roll ? 1 - 0.38 * Math.min(1, Math.abs(mo.roll) / 3.1) : 1;
      if (mo && mo.roll) {
        g.translate(v.cx, v.cy);
        g.scale(spinScale, spinScale);
        g.rotate(mo.roll);
        g.translate(-v.cx, -v.cy);
      }
      if (tilt) { g.translate(v.cx, v.cy); g.rotate(tilt); g.translate(-v.cx, -v.cy); }
      if (mo && mo.dy) g.translate(0, mo.dy * dyK);
      /* 스윙 잔상 — 라켓 뒤에 깔립니다 */
      if (sw && smashPhase(el) === 1) drawRacketGhosts(g, v, gm, c, el, smashKind, w, h);
      if (sw && (sw.dx || sw.dy)) g.translate(sw.dx * dyK, sw.dy * dyK);
      draw3d(g, vv, c, lvl, w, h, { noHead: noHead, wob: wob, spin: !!(mo && mo.roll) });
      if (smashOn) {
        /* 타점은 '임팩트 자세'의 스위트 스팟에 고정 — 효과가 라켓을 따라 흔들리지 않습니다 */
        var hp = swingOf(HIT_AT, smashKind);
        var vHit = { yaw: v.yaw + hp.yaw, pitch: clampN(v.pitch + hp.pitch, -1.25, 1.25),
          k: v.k, cx: v.cx, cy: v.cy, mid: v.mid, phase: v.phase };
        var ip = project3({ x: 0, y: -gm.ry * 0.16, z: 0 }, vHit);
        ip.y += hp.dy * dyK;
        drawSmash(g, vv, gm, smashFx, el, w, h, { kind: smashKind, imp: ip });
      }
      g.restore();
      lastPaint = Date.now();
      api.body = c.body;
      api.paintMs = nowMs() - t0;
      if (BM.racketcustom) BM.racketcustom._last3d = api;
    }

    function loop() {
      if (!alive) return;
      if (!cv.isConnected) { alive = false; return; }
      /* bm-v1.97.0 — 시트를 펴거나 전체화면·가로 회전으로 캔버스 크기가 바뀌면
       *  비트맵(dpr)과 좌표계(v.k·v.cx·v.cy)를 다시 맞춥니다.
       *  예전엔 처음 잰 크기에 머물러, 크기가 바뀐 뒤에는 탭한 곳과 다른 부위가 골라졌습니다. */
      var cw = cv.clientWidth, chh = cv.clientHeight;
      if (cw && chh && (Math.abs(cw - fitCssW) > 1 || Math.abs(chh - fitCssH) > 1)) { fit(); paint(); }
      var now = Date.now();
      var dt = lastTick ? Math.min(48, Math.max(6, now - lastTick)) : 16.7;
      lastTick = now;
      var step = dt / 16.7;                       /* 60fps 기준 프레임 수 */
      var fx = customOf(ctx.store.state.me).effect;
      var animate = fx && fx !== 'none';
      /* 손을 뗀 뒤 관성 — 프레임 간격(dt)에 맞춰 감속해 어떤 기기에서도 같은 느낌 (bm-v1.87.0) */
      if (!drag && (Math.abs(vel.yaw) > 0.0004 || Math.abs(vel.pitch) > 0.0004)) {
        v.yaw += vel.yaw * step;
        v.pitch = Math.max(-0.62, Math.min(0.62, v.pitch + vel.pitch * step));
        viewMem.yaw = v.yaw; viewMem.pitch = v.pitch;
        var damp = Math.pow(0.9, step);
        vel.yaw *= damp;
        vel.pitch *= Math.pow(0.86, step);
        roll = Math.max(-0.16, Math.min(0.16, vel.yaw * 6.5));
        lastMove = now - 1200;
        paint();
      } else if (!drag) {
        vel.yaw = 0; vel.pitch = 0;
        roll *= 0.86;
        if (Math.abs(roll) < 0.002) roll = 0;
        if (now - lastMove > 1800) {
          /* 가만히 두면 살짝 숨 쉬듯 흔들립니다 (bm-v1.87.0)
           *  한 방향으로 계속 더하면 각도가 쌓여 라켓이 옆으로 누워 버려서,
           *  앞뒤로 오가는 흔들림(cos 적분 = sin, 범위 제한)으로 바꿨습니다. */
          idlePhase += 0.012 * step;
          v.yaw += Math.cos(idlePhase) * (animate ? 0.0011 : 0.0022);
          viewMem.yaw = v.yaw;
        }
      }
      /* 캡처용으로 멈춰 둔 동안에는 다시 그리지 않습니다 */
      if (holdAt != null) { raf = root.requestAnimationFrame(loop); return; }
      /* 스매시·모션 동안에는 60fps로 부드럽게 — 끝나면 평소 주기로 돌아갑니다 */
      if (smashOn && nowMs() - smashAt < SMASH_MS) {
        paint();
      } else if (motionOn && nowMs() - motionAt < (MOTION_MS[motionKind] || 2200)) {
        paint();
      } else if (now - lastPaint > (animate ? 50 : 42)) {
        if (animate) v.phase = (v.phase || 0) + 0.06;
        paint();
      }
      raf = root.requestAnimationFrame(loop);
    }

    fit();
    paint();
    /* 스프라이트 미리 굽기 — 첫 스매시 순간에 굽느라 멈추지 않게, 시트를 연 뒤 조용히 하나씩 */
    warmTextures();
    raf = root.requestAnimationFrame(loop);

    /* bm-v1.97.0 — 손가락 터치 기준으로 탭/드래그를 다시 나눕니다(3D 엔진과 같은 규칙).
     *  · 탭: 시작점에서 14 CSS px 안
     *  · 두 번째 손가락 = 탭 아님 · pointercancel = 취소 */
    var TAP_SLOP = 14, TAP_PATH = 60;

    cv.addEventListener('pointerdown', function (ev) {
      if (BM.smashsound) BM.smashsound.unlock();
      if (ev.button && ev.button !== 0) return;
      if (drag) { drag.multi = true; return; }
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY,
               moved: 0, path: 0, multi: false, axis: '', t0: Date.now() };
      lastMove = Date.now();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
    });
    /* 캔버스가 들어 있는 시트 본문 — 세로 쓸기로 스크롤할 대상 */
    function sheetScrollEl() {
      var n = cv.parentNode;
      while (n && n !== document.body) {
        if (n.classList && n.classList.contains('sheet__body')) return n;
        n = n.parentNode;
      }
      return null;
    }
    cv.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      if (ev.preventDefault) ev.preventDefault();
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.path = Math.sqrt((ev.clientX - drag.sx) * (ev.clientX - drag.sx) +
                            (ev.clientY - drag.sy) * (ev.clientY - drag.sy));
      /* bm-v1.97.0 — 캔버스는 touch-action: none 이라 예전엔 캔버스 위에서 시트가 스크롤되지
       *  않았습니다. 세로로 쓸면 시트가 따라 오르내리고, 가로로 끌면 라켓이 돌아갑니다. */
      if (!drag.axis) {
        var mx0 = ev.clientX - drag.sx, my0 = ev.clientY - drag.sy;
        if (Math.abs(mx0) + Math.abs(my0) > 8) {
          drag.axis = Math.abs(my0) > Math.abs(mx0) * 1.4 ? 'scroll' : 'rot';
          if (drag.axis === 'scroll') { vel.yaw = 0; vel.pitch = 0; }
        }
      }
      if (drag.axis === 'scroll') {
        var sc = sheetScrollEl();
        if (sc) sc.scrollTop -= dy;
        lastMove = Date.now();
        return;
      }
      /* 손목을 비틀 듯 — 가로는 크게, 세로는 살짝. 민 속도를 기억해 두었다가 관성으로 이어 줍니다.
       * bm-v1.87.0 — 가로·세로를 한 번에 한 번만 적용해 덜렁거림을 없앴습니다. */
      var stepYaw = dx * 0.012, stepPitch = -dy * 0.006;
      v.yaw += stepYaw;
      v.pitch = Math.max(-0.9, Math.min(0.9, v.pitch + stepPitch));
      vel.yaw = vel.yaw * 0.5 + stepYaw * 0.5;
      vel.pitch = vel.pitch * 0.5 + stepPitch * 0.5;
      roll = Math.max(-0.16, Math.min(0.16, stepYaw * 9 + roll * 0.55));
      lastDragAt = Date.now();
      viewMem.yaw = v.yaw; viewMem.pitch = v.pitch;
      lastMove = Date.now();
      paint();
    });
    function endDrag(ev, how) {
      if (!drag || (ev && typeof ev.pointerId === 'number' && ev.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      try { cv.releasePointerCapture(d.id); } catch (e) { /* 무시 */ }
      lastMove = Date.now();
      /* 취소(pointercancel·pointerleave)·두 손가락은 탭이 아닙니다 */
      if (how === 'cancel' || d.multi) return;
      if (d.path > TAP_SLOP || d.moved > TAP_PATH) return;
      var r = cv.getBoundingClientRect();
      /* 처음 닿은 자리로 판정합니다 — 손가락은 떼면서 조금 밀립니다 */
      var px = d.sx - r.left, py = d.sy - r.top;
      /* 짧은 탭 = 스매시 타격, '꾸미기' 모드에서만 부위 탭으로 파츠를 바꿉니다 */
      if (stageMode !== 'paint') { smash(); return; }
      var slot = hitSlot(px, py, v, customOf(ctx.store.state.me));
      if (slot) pickSlot(host, ctx, slot);
    }
    cv.addEventListener('pointerup', function (ev) { endDrag(ev, 'up'); });
    cv.addEventListener('pointercancel', function (ev) { endDrag(ev, 'cancel'); });
    cv.addEventListener('pointerleave', function (ev) { endDrag(ev, 'cancel'); });

    if (BM.racketcustom) BM.racketcustom._last3d = api;
    return api;
  }

  /* 부위 탭 → 그 파츠 탭을 바로 열고 살짝 반짝 */
  function pickSlot(host, ctx, slot) {
    activeSlot = SLOTS.indexOf(slot) >= 0 ? slot : activeSlot;
    if (BM.ui) { BM.ui.haptic(8); }
    refreshSheet(host, ctx);
    var body = host.querySelector('.sheet__body');
    if (!body) return;
    var flashEl = body.querySelector('.rk3d');
    if (flashEl) {
      flashEl.classList.add('is-pick');
      setTimeout(function () { if (flashEl) flashEl.classList.remove('is-pick'); }, 560);
    }
    if (BM.ui && BM.ui.toast) {
      BM.ui.toast(activeSlot === 'string' ? '거트 색을 골라 보세요' : activeSlot === 'grip' ? '그립 색을 골라 보세요' : '테두리 색을 골라 보세요');
    }
  }

  /* ---------- 꾸미기 시트 ---------- */
  function partHtml(state, slot) {
    var c = customOf(state.me);
    var def = PARTS[slot];
    var admin = isAdminUser(state);
    var bal = heartNow(state);
    var cells = itemsOf(slot).map(function (it) {
      var on = c[slot] === it.id;
      var open = isUnlocked(c, slot, it.id) || admin;
      var key = slot + ':' + it.id;
      var hearts = priceOf(slot, it.id);
      var ask = !open && hearts > 0 && pendingBuy === key;    /* 한 번 더 누르면 하트로 열립니다 */
      /* bm-v1.87.0 — 하트가 모자란 파츠는 '몇 개 부족한지'를 칸 안에 적고,
       * 누르면 공용 리워드 광고 충전 시트로 원톡 연결합니다(단순 잠금 안내로 끝내지 않음). */
      var short = !open && hearts > bal;
      var price = !hearts ? '무료' : (open ? '보유'
        : (short ? '♥ ' + (hearts - bal) + '개 부족' : (ask ? '다시 눌러 열기' : '❤ ' + hearts)));
      var rar = rarityOf(it.rarity);
      return '<button type="button" class="rkpart is-r-' + rar.id + (on ? ' is-on' : '') + (!open ? ' is-lock' : '') +
        (hearts ? ' is-heart' : '') + (ask ? ' is-ask' : '') + (short ? ' is-short' : '') + '"' +
        ' data-rk-part="' + key + '" data-rk-slot="' + slot + '" data-rk-id="' + it.id + '"' +
        ' data-rk-rarity="' + rar.id + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '"' +
        ' aria-label="' + U.esc(def.label + ' ' + it.name + ' ' + rar.name +
          (open ? (on ? ' · 입고 있음' : ' · 입기')
            : (short ? ' · ♥ ' + (hearts - bal) + '개 부족 · 광고 보고 바로 열기'
              : ' · 하트 ' + hearts + '개로 열기'))) + '">' +
        '<i class="rkpart__sw" style="--c:' + it.color + '"></i>' +
        '<b class="rkpart__n">' + U.esc(it.name) + '</b>' +
        (it.note ? '<em class="rkpart__d">' + U.esc(it.note) + '</em>' : '') +
        '<span class="rkpart__p' + (!open ? ' is-cost' : '') + (hearts ? ' is-heartp' : '') + '">' + U.esc(price) + '</span>' +
        '<u class="rkrar">' + U.esc(rar.name) + '</u>' +
        (short ? '<span class="rkpart__ad" aria-hidden="true">⚡ 광고로 열기</span>' : '') +
        (!open ? '<span class="rkpart__lock" aria-hidden="true">❤</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="rkgroup' + (slot === activeSlot ? ' is-active' : '') + '" data-rk-group="' + slot + '"' +
      (slot === activeSlot ? '' : ' hidden') + '>' +
      '<div class="rkhead"><b>' + U.esc(def.label) + '</b><span>' + U.esc(def.note) + '</span>' +
      (slot === activeSlot ? '<i class="rkhead__now">지금 고르는 중</i>' : '') + '</div>' +
      '<div class="rkparts">' + cells + '</div></div>';
  }

  /* 지금 고르는 파츠 — 3D 라켓에서 부위를 눌러도 여기가 바뀝니다 */
  var activeSlot = 'frame';
  /* bm-v1.82.0 — 3D에서 짧은 탭이 하는 일
   *  · smash(기본): 라켓을 톡 치면 불꽃 스매시 연출
   *  · paint: 부위를 눌러 그 파츠 탭으로 (예전 동작)
   * 드래그(360° 회전)는 두 모드 모두 그대로입니다. */
  var stageMode = 'smash';
  var pendingBuy = '';      /* 하트로 여는 파츠: 첫 탭은 미리보기, 한 번 더 누르면 구매 */

  function tabHtml() {
    return '<div class="rk3d__tabs" role="tablist" aria-label="바꿀 부위">' +
      SLOTS.map(function (slot) {
        var on = slot === activeSlot;
        var tabName = FX_TAB[slot] || PARTS[slot].label;
        return '<button type="button" class="rk3d__tab' + (on ? ' is-on' : '') + '" data-rk-slot="' + slot + '"' +
          ' role="tab" aria-selected="' + (on ? 'true' : 'false') + '">' + U.esc(tabName) + '</button>';
      }).join('') + '</div>';
  }

  /* 라켓 바디(모델) 4종 — 고르면 3D 실루엣·프레임 두께·데칼이 바로 바뀝니다 */
  function bodyHtml(state) {
    var c = customOf(state && state.me);
    var admin = isAdminUser(state);
    return '<div class="rkbody" role="radiogroup" aria-label="라켓 바디 종류">' +
      BODY_IDS.map(function (id) {
        var b = BODIES[id];
        var on = (c.body || DEFAULT_BODY) === id;
        var open = isUnlocked(c, 'body', id) || admin;
        var hearts = priceOf('body', id);
        var rar = rarityOf(b.rarity);
        return '<button type="button" class="rkbody__chip is-r-' + rar.id + (on ? ' is-on' : '') + (!open ? ' is-lock' : '') + '"' +
          ' data-rk-body="' + id + '" data-rk-rarity="' + rar.id + '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '"' +
          ' aria-label="' + U.esc(b.name + ' 바디 · ' + b.note + ' · ' + rar.name + (open ? '' : ' · 하트 ' + hearts + '개로 열기')) + '">' +
          '<i class="rkbody__sw" style="--c:' + b.accent + '" aria-hidden="true"></i>' +
          '<b>' + U.esc(b.name) + '</b><span>' + U.esc(open ? b.note : '❤ ' + hearts) + '</span>' +
          '<u class="rkrar">' + U.esc(rar.name) + '</u>' +
          (!open ? '<span class="rkpart__lock" aria-hidden="true">🔒</span>' : '') +
          '</button>';
      }).join('') + '</div>';
  }

  /* 3D 라켓 바로 아래 — 줄 갈고 며칠째인지 한 줄로 (bm-v1.81.0) */
  function stringAge(state) {
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = statusFor(g);
    var out = { state: 'none', level: 'none', main: '', sub: '', label: '' };
    if (!g.strungAt) {
      out.state = 'nodate';
      out.level = 'nodate';
      out.main = '줄 교체일 미등록';
      out.sub = '오늘 갈았으면 눌러서 기록';
      out.label = '줄 교체일 미등록 · 눌러서 오늘 날짜 기록';
      return out;
    }
    out.days = st.daysSince;
    out.left = st.daysLeft;
    out.cycle = st.cycle;
    out.meta = st.meta || '';
    if (st.state === 'due') {
      out.state = 'due';
      out.level = 'due';
      out.main = '줄 갈고 ' + st.daysSince + '일째';
      out.sub = st.daysLeft === 0 ? '오늘이 교체일 · 줄이 끊어졌어요' : '교체 시기가 다 돼서 줄이 끊어졌어요';
      out.label = out.main + ' · ' + out.sub;
    } else if (st.daysSince === 0) {
      out.state = 'new';
      out.level = 'prime';
      out.main = '오늘 새 줄로 갈았어요!';
      out.sub = 'D+0 · 교체까지 ' + st.daysLeft + '일';
      out.label = '오늘 새 줄로 갈았어요 · D+0';
    } else {
      out.state = st.state;
      out.level = st.state === 'soon' ? 'soon' : 'ok';
      out.main = '줄 갈고 ' + st.daysSince + '일째';
      out.sub = '교체까지 ' + st.daysLeft + '일 남음';
      out.label = out.main + ' · ' + out.sub;
    }
    return out;
  }

  function stringAgeHtml(state) {
    var a = stringAge(state);
    var fixable = a.state === 'due' || a.state === 'nodate';
    return '<div class="rkage rkage--' + a.level + '">' +
      '<button type="button" class="rkage__main" data-rk-gear="1" aria-label="' + U.esc(a.label) + '">' +
        '<i class="rkage__dot" aria-hidden="true"></i>' +
        '<b class="rkage__t">' + U.esc(a.main) + '</b>' +
        '<span class="rkage__s">' + U.esc(a.sub) + '</span>' +
      '</button>' +
      (fixable
        ? '<button type="button" class="rkage__fix" data-rk-restring="1">오늘 갈았어요</button>'
        : '<button type="button" class="rkage__fix is-ghost" data-rk-gear="1">기록</button>') +
      '</div>';
  }

  /* ---------- 3D 시트 맨 위 상태 배지 + 원톡 회복 (bm-v1.87.0) ----------
   *  · 미니 라켓이 prime/worn/broken 으로 바뀌는 이유와, 지금 바로 무엇을 하면
   *    회복되는지를 시트를 열자마자 배지 하나로 보여 줍니다.
   *  · worn  → '오늘 일지 쓰고 라켓 회복하기' (일지 탭으로)
   *  · broken → 교체 시기가 지났으면 '오늘 새 줄로 갈았어요'(교체일 기록),
   *             오래 쉬어서 끊겼으면 일지 회복으로 이어집니다.
   *  · 상태 계산은 기존 conditionOf · statusFor 를 그대로 써서 미니 라켓·헤더와 같은 말을 합니다. */
  function stageState(state) {
    var cond = conditionOf(state);
    var g = BM.gear ? BM.gear.gearOf(state && state.me) : {};
    var st = statusFor(g);
    var out = {
      level: cond.level, emoji: '🏸', badge: '줄 상태 좋아요',
      sub: cond.line, action: '', actionLabel: ''
    };
    if (cond.level === 'prime') {
      out.emoji = '🔥';
      out.badge = '최상 컨디션';
      out.sub = cond.line;
    } else if (cond.level === 'worn') {
      out.emoji = '💧';
      out.badge = '줄 느슨 · ' + (st && st.state === 'soon'
        ? '교체까지 ' + Math.max(1, st.daysLeft) + '일'
        : (cond.daysSinceLog != null ? cond.daysSinceLog + '일 휴식' : '교체 시기'));
      out.action = 'log';
      out.actionLabel = '오늘 일지 쓰고 라켓 회복하기';
    } else if (cond.level === 'broken') {
      out.emoji = '✂️';
      out.badge = '줄 끊김 · 교체 필요';
      if (st && st.state === 'due') {
        out.action = 'restring';
        out.actionLabel = '오늘 새 줄로 갈았어요';
      } else {
        out.action = 'log';
        out.actionLabel = '오늘 일지 쓰고 라켓 회복하기';
      }
    }
    return out;
  }

  function stageBadgeHtml(state) {
    var s = stageState(state);
    return '<div class="rkstate rkstate--' + s.level + '" data-rk-state="' + s.level + '"' +
      ' role="status" aria-label="' + U.esc(s.emoji + ' ' + s.badge + ' · ' + s.sub) + '">' +
      '<span class="rkstate__top"><b class="rkstate__b">' + U.esc(s.emoji + ' ' + s.badge) + '</b>' +
        '<span class="rkstate__s">' + U.esc(s.sub) + '</span></span>' +
      (s.action
        ? '<button type="button" class="rkstate__go" data-rk-recover="' + s.action + '">' +
          U.esc(s.actionLabel) + '</button>'
        : '') +
      '</div>';
  }

  /* 3D 위 조작 줄 — 스매시 / 꾸미기 모드 + ⚡ 스매시 테스트 버튼 (bm-v1.82.0) */
  /* bm-v1.90.0 — 스매시 소리 켜기/끄기 (불·얼음·번개 소리가 서로 다릅니다) */
  function soundMuted() {
    return !!(BM.smashsound && BM.smashsound.muted && BM.smashsound.muted());
  }
  function soundBtnHtml() {
    var off = soundMuted();
    return '<button type="button" class="rk3d__sound' + (off ? ' is-off' : '') + '" data-rk-sound="1"' +
      ' aria-pressed="' + (off ? 'false' : 'true') + '"' +
      ' aria-label="' + (off ? '스매시 소리 켜기' : '스매시 소리 끄기') + '">' +
      '<span aria-hidden="true">' + (off ? '🔇' : '🔊') + '</span></button>';
  }

  /* bm-v1.96.0 — 3D 쇼룸 전체화면 토글 (인스타 녹화·감상용) */
  var fullOn = false;
  function fullBtnHtml() {
    return '<button type="button" class="rk3d__full' + (fullOn ? ' is-on' : '') + '" data-rk-full="1"' +
      ' aria-pressed="' + (fullOn ? 'true' : 'false') + '"' +
      ' aria-label="' + (fullOn ? '전체화면 닫고 시트로 돌아가기' : '3D 라켓을 화면 전체로 크게 보기') + '">' +
      '<span aria-hidden="true">' + (fullOn ? '✕' : '⛶') + '</span>' +
      (fullOn ? ' 나가기' : ' 전체화면') + '</button>';
  }

  function stageHtml(state) {
    var c = customOf(state && state.me);
    var big = c.effect === 'fire' || c.effect === 'thunder';
    return '<div class="rkstage" data-rk-stage>' +
      '<div class="rkstage__modes" role="group" aria-label="라켓 터치 동작">' +
        '<button type="button" class="rkstage__m' + (stageMode === 'smash' ? ' is-on' : '') + '"' +
          ' data-rk-mode="smash" aria-pressed="' + (stageMode === 'smash' ? 'true' : 'false') + '">⚡ 스매시</button>' +
        '<button type="button" class="rkstage__m' + (stageMode === 'paint' ? ' is-on' : '') + '"' +
          ' data-rk-mode="paint" aria-pressed="' + (stageMode === 'paint' ? 'true' : 'false') + '">🎨 꾸미기</button>' +
      '</div>' +
      '<button type="button" class="rkstage__go' + (big ? ' is-big' : '') + '" data-rk-smash="1"' +
        ' aria-label="' + U.esc(smashLabel(c.effect) + ' 연출 쳐보기') + '">⚡ 스매시</button>' +
      '<button type="button" class="rkstage__go rkstage__go--slam" data-rk-slam="1"' +
        ' aria-label="바닥 강타 연출 · 라켓이 코트를 내려찍고 부서져요">💥 바닥 강타</button>' +
      '</div>' +
      motionChipsHtml(state);
  }

  /* 라켓 모션 칩 — 3D 아래에서 눌러 바로 감상 (bm-v1.86.0)
   *  · 열린 모션은 바로 재생, 잠긴 모션은 첫 탭 = 미리보기 · 두 번째 탭 = 하트로 열기 */
  var MOTION_EMOJI = { twist: '🌀', showcase: '✨', flip: '⚡' };
  function motionChipsHtml(state) {
    var c = customOf(state && state.me);
    var admin = isAdminUser(state);
    var bal = heartNow(state);
    var playing = BM.racketcustom && BM.racketcustom._last3d && BM.racketcustom._last3d.motioning &&
      BM.racketcustom._last3d.motionKind ? BM.racketcustom._last3d.motionKind() : '';
    return '<div class="rkmotions" role="group" aria-label="라켓 모션">' +
      MOTIONS.map(function (id) {
        var it = itemOf('motion', id) || { name: id };
        var open = isUnlocked(c, 'motion', id) || admin;
        var ask = !open && pendingBuy === 'motion:' + id;
        var need = priceOf('motion', id);
        /* bm-v1.87.0 — 하트가 모자란 모션도 '몇 개 부족한지 + 광고로 바로' */
        var short = !open && need > bal;
        var price = open ? '' : (short ? '♥ ' + (need - bal) + '개 부족' : (ask ? '다시 눌러 열기' : '❤ ' + need));
        return '<button type="button" class="rkmotion' + (open ? '' : ' is-lock') + (ask ? ' is-ask' : '') +
          (short ? ' is-short' : '') + (playing === id ? ' is-on' : '') + '"' +
          ' data-rk-motion="' + id + '" data-rk-open="' + (open ? '1' : '0') + '"' +
          ' aria-pressed="' + (playing === id ? 'true' : 'false') + '"' +
          ' aria-label="' + U.esc(it.name + (open ? ' 모션 재생'
            : (short ? ' · ♥ ' + (need - bal) + '개 부족 · 광고 보고 바로 열기'
              : ' · 하트 ' + need + '개로 열기'))) + '">' +
          '<span class="rkmotion__e" aria-hidden="true">' + (MOTION_EMOJI[id] || '🌀') + '</span>' +
          '<b>' + U.esc(it.name) + '</b>' +
          (price ? '<i class="rkmotion__p">' + U.esc(price) + '</i>' : '') +
          (short ? '<i class="rkmotion__ad" aria-hidden="true">⚡ 광고로</i>' : '') +
          '</button>';
      }).join('') +
      '</div>';
  }

  /* 하트 지갑 줄 — '라켓 포인트' 박스를 대신합니다 (bm-v1.84.0)
   *  · 보유 하트와 이번 라켓 꾸미기에 쓴 하트를 함께 보여 주고,
   *  · 모자라면 바로 하트 충전(출석·광고) 시트로 이어 줍니다.
   *  · bm-v1.87.0 — 오늘 남은 광고 시청 횟수('오늘 N/5회 남음')를 지갑 안에 또렷하게 */
  function heartsHtml(state) {
    var bal = heartNow(state);
    var admin = isAdminUser(state);
    var adLeft = '';
    if (BM.ads && typeof BM.ads.adLeftText === 'function') {
      adLeft = BM.ads.adLeftText(BM.ads.getStatus(state && state.data && state.data.hearts));
    }
    var spent = 0;
    customOf(state && state.me).unlocked.forEach(function (k) {
      var cut = k.indexOf(':');
      if (cut < 0) return;
      spent += priceOf(k.slice(0, cut), k.slice(cut + 1));
    });
    return '<div class="rkhearts' + (admin ? ' is-admin' : '') + '">' +
      '<div class="rkhearts__top"><b>보유 하트 <i>❤ ' + bal + '개</i></b>' +
        (admin
          ? '<span>관리자 계정 · 전부 열려 있어요</span>'
          : '<span>출석 +1 · 광고 +1 · 연속 3·7·14·30일 보너스</span>') + '</div>' +
      (adLeft ? '<p class="rkhearts__ad" data-rk-adleft>' + U.esc(adLeft) + '</p>' : '') +
      '<p class="rkhearts__line">파츠를 열 때 하트가 빠져요 · 지금까지 <b>' + spent + '개</b> 사용' +
        ' <small>(기본 파츠·파워 77 바디는 무료)</small></p>' +
      '<div class="rkhearts__acts">' +
        '<button type="button" class="btn btn--ghost btn--sm grow" data-rk-hearts="1">❤ 하트 모으기</button>' +
        '<button type="button" class="btn btn--ghost btn--sm grow" data-rk-open-gear="1">🏸 라켓 기록</button>' +
      '</div>' +
      '</div>';
  }

  /* ---------- 세트 조합 배지 + 도감 (bm-v1.95.0) ----------
   *  · 발동 중이면 맨 위에 '⚡ 썬더 골드 풀세트 발동! (전체 낙뢰)'를 크게,
   *  · 아직이면 가장 가까운 공개 세트의 '2/3 노랑 파츠'를 보여 줘서 모을 맛을 냅니다.
   *  · 도감은 <details>로 접어 둬 시트가 길어지지 않게 — 공개 4종은 조건을 그대로,
   *    히든 7종은 발견 전엔 '??? 히든 조합'과 아주 짧은 힌트만 보입니다. */
  function setChipsHtml(hit) {
    return '<div class="rkset__need">' + hit.need.map(function (n) {
      return '<span class="rkset__chip' + (n.got ? ' is-got' : '') + '">' +
        '<i aria-hidden="true">' + (n.got ? '✓' : '·') + '</i>' + U.esc(n.label + ' ' + n.name) + '</span>';
    }).join('') + '</div>';
  }

  function setBonusHtml(state) {
    var c = customOf(state && state.me);
    var admin = isAdminUser(state);
    var cur = activeSetRaw(normalizeCustom(c));
    var next = cur ? null : nextSet(c);
    var found = hiddenFoundCount(c);
    var head, tag, desc, hit, pct, prog;
    if (cur) {
      head = cur.set.emoji + ' ' + cur.set.name + ' 풀세트 발동!';
      tag = cur.set.tag;
      desc = cur.set.desc;
      hit = cur.hit;
      pct = 100;
      prog = hit.total + '/' + hit.total + ' 파츠 완성';
    } else if (next) {
      head = '다음 조합까지 ' + next.hit.hits + '/' + next.hit.total + ' ' + (next.set.tone || '') + ' 파츠';
      tag = next.set.name + ' · ' + next.set.tag;
      desc = '파츠를 ' + next.set.name + ' 세트로 맞추면 ' + next.set.tag + ' 연출이 켜져요';
      hit = next.hit;
      pct = Math.round(next.hit.hits / Math.max(1, next.hit.total) * 100);
      prog = next.hit.total - next.hit.hits + '개 더 맞추면 발동';
    } else {
      head = '조합 보너스 11종';
      tag = '프레임 · 거트 · 그립을 같은 색으로';
      desc = '같은 계열 파츠를 맞추면 3D 쇼룸에 특별한 연출이 켜져요';
      hit = { need: [], hits: 0, total: 1 };
      pct = 0;
      prog = '';
    }
    var rowsArr = SETS.map(function (s) {
      var h = setHit(c, s);
      var got = s.hidden ? (foundOf(c).indexOf(s.id) >= 0) : h.complete;
      return { s: s, h: h, got: got, near: (s.hidden && !got && h.hits >= 2) ? h.hits : 0 };
    });
    /* bm-v1.96.0 — 2개 이상 맞은 히든은 도감 맨 위로 올려 '지금 만져야 할 것'이 먼저 보이게 */
    rowsArr.sort(function (a, b) {
      var sa = (a.near ? 3 : 0) + (a.got ? 1 : 0);
      var sb = (b.near ? 3 : 0) + (b.got ? 1 : 0);
      if (sa !== sb) return sb - sa;
      if (a.s.hidden !== b.s.hidden) return a.s.hidden ? -1 : 1;
      return 0;
    });
    var nearList = rowsArr.filter(function (r) { return r.near; });
    var near = nearList.length ? nearList[0] : null;
    function partNames(n) {
      var ids = (n && n.ids) ? n.ids : needIds(n);
      return ids.map(function (id) {
        var it = itemOf(n.slot, id);
        return it ? it.name : id;
      }).join('/');
    }
    function hintChip(n) {
      return '<button type="button" class="rkset__chip" data-rk-hint-slot="' + n.slot + '"' +
        ' aria-label="' + U.esc(n.label + ' ' + partNames(n) + ' 고르러 가기') + '">' +
        '+ ' + U.esc(n.label + ' ' + partNames(n)) + '</button>';
    }
    var rows = rowsArr.map(function (r) {
      var s = r.s, h = r.h, got = r.got;
      if (s.hidden && !got) {
        /* bm-v1.96.0 — 2개 이상 맞으면 "나머지"까지 바로 공개합니다.
         *  · 0~1개: 몇 개 맞았는지 + 어떤 자리가 비었는지(?)만
         *  · 2개 이상: ✨ 근접 배지 + 남은 조건 이름 + 탭하면 바로 그 탭으로 */
        var nearOn = h.hits >= 2;
        var bits = h.need.map(function (n) {
          return n.got ? '✓ ' + n.label + ' ' + n.name : (nearOn ? '+ ' + n.label + ' ' + partNames(n) : '? ' + n.label);
        }).join('   ');
        var left = h.need.filter(function (n) { return !n.got; });
        return '<li class="rkset__row is-secret' + (nearOn ? ' is-near' : '') + '" data-rk-need="' + s.id + ':' + h.hits + '">' +
          '<b class="rkset__n">??? 히든 조합' +
            (nearOn ? ' <i class="rkset__nearb">✨ ' + h.hits + '/' + h.total + ' 근접</i>' : '') + '</b>' +
          '<span class="rkset__t">' + U.esc(s.hint || s.tag) + '</span>' +
          '<i class="rkset__s">' + h.hits + '/' + h.total + '</i>' +
          '<em class="rkset__c">' + U.esc(bits) + '</em>' +
          (nearOn && left.length
            ? '<div class="rkset__hintchips">' + left.map(hintChip).join('') + '</div>'
            : '') +
          '</li>';
      }
      /* bm-v1.97.0 — 이미 한 번 맞춘 조합은 '⚡ 바로 완성하기' 한 번으로 다시 입습니다.
       *  · 지금 이 조합이 발동 중이면 '이미 적용 중' 표시
       *  · 한 번이라도 맞춰 본 조합(공개는 보유 파츠로 맞출 수 있는 것 · 히든은 발견된 것)만 버튼 */
      var activeNow = !!(cur && cur.set.id === s.id);
      var canApply = !activeNow && setMine(c, s, admin);
      var applyHtml = activeNow
        ? '<em class="rkset__on">이미 적용 중</em>'
        : (canApply
          ? '<button type="button" class="rkset__apply" data-rk-apply-set="' + s.id + '"' +
            ' aria-label="' + U.esc(s.name + ' 조합 바로 완성하기') + '">' +
            '<span aria-hidden="true">⚡</span> 바로 완성하기</button>'
          : '');
      return '<li class="rkset__row' + (got ? ' is-found' : '') + '">' +
        '<b class="rkset__n">' + s.emoji + ' ' + U.esc(s.name) + '</b>' +
        '<span class="rkset__t">' + U.esc(s.tag + (s.hidden ? ' · 히든' : '')) + '</span>' +
        '<i class="rkset__s">' + (activeNow ? '발동 중' : (got ? '맞춤 완료' : h.hits + '/' + h.total)) + '</i>' +
        '<em class="rkset__c">' + U.esc(needText(s)) + '</em>' +
        applyHtml + '</li>';
    }).join('');
    /* 상단 배지 — 2개 이상 맞은 히든이 있으면 '나머지 조건'을 바로 떠 놓습니다 */
    var nearHtml = '';
    if (near) {
      var nearLeft = near.h.need.filter(function (n) { return !n.got; });
      nearHtml = '<div class="rkset__near" data-rk-near="' + near.s.id + ':' + near.h.hits + '">' +
        '<b>✨ 히든 조합 힌트 해금! (' + near.h.hits + '/' + near.h.total + ' 일치)</b>' +
        '<p>남은 조건 → ' + U.esc(nearLeft.map(function (n) { return n.label + ' ' + partNames(n); }).join(' · ')) + '</p>' +
        '<div class="rkset__hintchips">' + nearLeft.map(hintChip).join('') + '</div>' +
        '</div>';
    }
    return '<div class="rkset' + (cur ? ' is-on' : '') + '" data-rk-set="' + (cur ? cur.set.id : '') + '"' +
      ' style="--sc:' + (cur ? cur.set.color : (next ? next.set.color : '#c6f24e')) +
        ';--sc2:' + (cur ? (cur.set.color2 || cur.set.color) : (next ? (next.set.color2 || next.set.color) : '#c6f24e')) + '">' +
      '<div class="rkset__top">' +
        '<b class="rkset__h">' + U.esc(head) + '</b>' +
        '<span class="rkset__tg">' + U.esc(tag) + '</span>' +
      '</div>' +
      '<p class="rkset__d">' + U.esc(desc) + '</p>' +
      '<div class="rkset__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct +
        '" aria-label="세트 조합 진행 ' + pct + '%"><i style="--p:' + pct + '%"></i></div>' +
      '<div class="rkset__meta"><span>' + U.esc(prog) + '</span>' +
        '<span class="rkset__cnt">🔒 히든 ' + found + '/' + HIDDEN_SETS.length + ' 발견</span></div>' +
      setChipsHtml(hit) +
      nearHtml +
      '<details class="rkset__book">' +
        '<summary>조합 도감 <b>' + SETS.filter(function (s) { return !s.hidden; }).length + '종 공개</b>' +
          ' · 히든 <b>' + found + '/' + HIDDEN_SETS.length + '</b></summary>' +
        '<ul class="rkset__list">' + rows + '</ul>' +
      '</details>' +
      '</div>';
  }

  function sheetBody(state) {
    var cond = conditionOf(state);
    var c = customOf(state.me);
    var g = BM.gear ? BM.gear.gearOf(state.me) : {};
    var spec = BM.gear ? BM.gear.specText(g) : '';
    var racketLine = [g.racket || '내 라켓', spec].filter(Boolean).join(' · ');
    var bodyName = bodyOf(c.body).name;
    return '<div class="rksheet">' +
      stageBadgeHtml(state) +
      /* 3D 라켓 — 끌어서 360°, 톡 치면 스매시 */
      '<div class="rk3d' + (stageMode === 'paint' ? ' is-paint' : '') + (fullOn ? ' is-full' : '') + '" data-rk-3d>' +
        '<canvas class="rk3d__cv" width="600" height="760" aria-label="내 라켓 3D 보기 · 끌어서 돌리고 톡 치면 스매시 임팩트"></canvas>' +
        soundBtnHtml() +
        fullBtnHtml() +
        bodyHtml(state) +
        stageHtml(state) +
        '<p class="rk3d__hint"><span aria-hidden="true">↔</span> 끌어서 360° 돌려보기 · ' +
          (stageMode === 'paint'
            ? '<b>거트 · 테두리 · 그립</b>을 눌러 바로 바꿔요'
            : '라켓을 <b>톡</b> 치면 스매시!') + '</p>' +
      '</div>' +
      /* 세트 조합 배지 + 도감 — 3D 바로 아래, 파츠를 고르기 전에 눈에 들어오게 */
      setBonusHtml(state) +
      /* 거트·그립 선택창은 탭 바로 아래 — 3D에서 탭을 누르면 눈이 바로 밑에서 고릅니다 */
      '<div class="rkpick" data-rk-pick>' +
        tabHtml() +
        SLOTS.map(function (slot) { return partHtml(state, slot); }).join('') +
      '</div>' +
      /* 그 아래: 줄 상태 · 지금 컨디션 · 하트 지갑 */
      stringAgeHtml(state) +
      '<div class="rkhero rkhero--' + cond.level + '">' +
        '<div class="rkhero__txt">' +
          '<p class="rkhero__badge">' + U.esc(cond.level === 'prime' ? '최상 컨디션' : cond.level === 'worn' ? '줄이 느슨해요' : cond.level === 'broken' ? '줄이 끊어졌어요' : '줄 상태 좋아요') + '</p>' +
          '<p class="rkhero__t">' + U.esc(cond.title) + '</p>' +
          '<p class="rkhero__s">' + U.esc(cond.line) + '</p>' +
          '<p class="rkhero__r">' + U.esc(racketLine) + (specText(c) ? ' · ' + U.esc(specText(c)) : '') + '</p>' +
          '<p class="rkhero__b">' + U.esc(bodyName) + ' 바디 · ' + U.esc(bodyOf(c.body).note) +
            ' <i class="rkrar rkrar--' + topRarity(c).id + '">' + topRarity(c).name + ' 등급</i></p>' +
        '</div>' +
      '</div>' +
      heartsHtml(state) +
      (lastUnlock
        ? '<div class="rkundo">' +
          '<span class="rkundo__t">' + U.esc(lastUnlock.name) + ' 파츠를 ' + (lastUnlock.heart || lastUnlock.cost) + '하트로 열었어요</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-rk-undo="1">되돌리기</button></div>'
        : '') +
      '<div class="rkactions">' +
        '<button type="button" class="btn btn--primary grow" data-rk-share="1">공유 카드에 넣기</button>' +
      '</div>' +
      /* bm-v1.89.0 — 지금 고른 색 그대로 안드로이드 폰 바탕화면(라이브 배경화면)으로 */
      '<div class="rkwp">' +
        '<button type="button" class="btn btn--ghost grow" data-rk-wallpaper="1">📱 폰 바탕화면으로 설정하기</button>' +
        '<p class="rkwp__hint">' + U.esc(BM.wallpaper ? BM.wallpaper.hintText() : '안드로이드 셔틀릭스 앱에서 쓸 수 있어요.') + '</p>' +
      '</div>' +
      '<p class="hint">고른 색은 바로 저장되고, 1:1 매칭 카드·프로필·공유 카드에 그대로 보여요. 운동을 3일 넘게 쉬면 줄이 느슨해지고, 7일을 넘기거나 스트링 교체 시기가 지나면 끊어진 모습으로 바뀝니다.</p>' +
      '</div>';
  }

  /* 방금 연 파츠 — 한 번 누르면 바로 열리고, 시트 안 '되돌리기'로 포인트까지 되돌립니다 */
  var lastUnlock = null;

  function refreshSheet(host, ctx) {
    if (!host || !ctx) return;
    var body = host.querySelector('.sheet__body');
    if (!body) return;
    body.innerHTML = sheetBody(ctx.store.state);
    /* bm-v1.96.0 — 전체화면 상태는 시트 다시 그리기를 건너도 유지 */
    if (host.classList) host.classList.toggle('is-rkfull', fullOn);
    mount3d(host, ctx);
    firePendingBurst();
  }

  /* bm-v1.96.0 — 3D 쇼룸 전체화면 토글.
   *  · 3D 칸과 시트 패널을 화면 전체(100dvh)로 키우고, 아래 파츠 선택창·상단 헤더는 숨깁니다.
   *  · 남는 것은 3D 캔버스 + 아래 플로팅 컨트롤(스매시 · 바닥 강타 · 모션 칩) + 오른쪽 위 ✕ 뿐.
   *  · Three.js 는 캔버스 크기가 바뀐 것을 보고 스스로 fitCamera 하므로 종횡비도 바로 따라갑니다. */
  function setFull(on, host) {
    fullOn = !!on;
    var root = host && host.querySelector ? host : (hasDom ? document : null);
    var el = (root && root.querySelector ? root.querySelector('.rk3d') : null) ||
      (hasDom ? document.querySelector('.rk3d') : null);
    if (!el) return;
    var sheetEl = el.closest ? el.closest('.sheet') : null;
    el.classList.toggle('is-full', fullOn);
    if (sheetEl) sheetEl.classList.toggle('is-rkfull', fullOn);
    var btn = el.querySelector('[data-rk-full]');
    if (btn) {
      btn.classList.toggle('is-on', fullOn);
      btn.setAttribute('aria-pressed', fullOn ? 'true' : 'false');
      btn.setAttribute('aria-label', fullOn ? '전체화면 닫고 시트로 돌아가기' : '3D 라켓을 화면 전체로 크게 보기');
      btn.innerHTML = '<span aria-hidden="true">' + (fullOn ? '✕' : '⛶') + '</span>' +
        (fullOn ? ' 나가기' : ' 전체화면');
    }
    var api = BM.racketcustom && BM.racketcustom._last3d;
    /* 모바일 주소창 때문에 높이가 늦게 정해지므로 두 번 재어 줍니다 */
    [30, 120, 320].forEach(function (ms) {
      setTimeout(function () { if (api && api.fit) api.fit(); }, ms);
    });
    if (BM.ui) BM.ui.haptic(8);
  }

  if (hasDom && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', function (ev) {
      if (!fullOn) return;
      if (ev && (ev.key === 'Escape' || ev.key === 'Esc')) {
        ev.preventDefault();
        setFull(false, document.querySelector('.sheet.is-rkfull'));
      }
    }, false);
  }

  /* 새로 발견한 히든 조합 — 시트를 다시 그린 뒤 3D 연출을 한 번 크게 터뜨립니다 */
  var pendingBurst = '';
  function firePendingBurst() {
    if (!pendingBurst) return;
    var id = pendingBurst;
    pendingBurst = '';
    setTimeout(function () {
      var api = BM.racketcustom && BM.racketcustom._last3d;
      if (api && typeof api.setburst === 'function') api.setburst(id);
    }, 40);
  }

  /* 히든 조합 발견 축하 — 토스트 + 진동 + 3D 연출 (발견은 found 에 영구 기록) */
  function celebrateSets(ctx, list) {
    if (!list || !list.length) return;
    var s = list[0];
    pendingBurst = s.id;
    if (BM.ui) {
      BM.ui.haptic(list.length > 1 ? 26 : 18);
      BM.ui.toast('🔓 히든 조합 발견! ' + s.emoji + ' ' + s.name + ' · ' + s.tag);
    }
  }

  function saveCustom(ctx, next, opts) {
    /* 맞춘 히든 조합은 저장하는 순간 발견 목록에 영구 기록합니다
     * (store.setGear 도 같은 mergeFound 를 불러 어떤 장착 경로든 기록이 남습니다) */
    var merged = mergeFound(next);
    var nx = merged.custom;
    var newly = merged.added;
    var res = ctx.actions.setGear ? ctx.actions.setGear({ custom: nx }) : { ok: false };
    if (!res || !res.ok) {
      if (BM.ui) BM.ui.toast(res && res.reason === 'locked' ? '잠시만요, 저장 중이에요' : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error');
      return false;
    }
    if (opts && opts.toast && BM.ui) {
      BM.ui.toast(opts.toast);
    } else if (opts && opts.unlock && BM.ui) {
      BM.ui.toast(opts.unlock + ' 입었어요');
    } else if (opts && opts.body && BM.ui) {
      BM.ui.toast(opts.body + ' 바디로 바꿨어요');
    } else if (BM.ui) {
      BM.ui.toast('라켓 색을 바꿨어요');
    }
    if (newly.length) celebrateSets(ctx, newly);
    if (BM.ui) BM.ui.haptic(10);
    paintHeader(ctx.store.state);
    if (ctx.repaint) ctx.repaint();
    return true;
  }

  /* 파츠 하나를 하트로 열고 바로 입습니다 (bm-v1.84.0)
   *  · 관리자 계정: 하트 없이 열림 목록에만 적습니다.
   *  · Supabase 모드: store.buyRacketPart → 서버 heart_spend('racket', 'slot:id').
   *  · 기기 저장 모드: 같은 자리에 구매 행을 남기고 잔액을 다시 셉니다.
   *  · 서버가 아직 'racket' 종류를 모르면(unknown) 하트는 그대로이고 안내만 합니다. */
  function buyPart(host, ctx, slot, id, label) {
    var st = ctx.store.state;
    var cur = customOf(st.me);
    var need = priceOf(slot, id);
    var name = label || (itemOf(slot, id) || {}).name || '파츠';
    var key = slot + ':' + id;

    function equipNow() {
      var nx = normalizeCustom(cur);
      if (nx.unlocked.indexOf(key) < 0) nx.unlocked.push(key);
      nx[slot] = id;
      return nx;
    }

    /* 관리자 — 전부 열려 있으니 하트를 쓰지 않습니다 */
    if (isAdminUser(st)) {
      var nxa = equipNow();
      if (!saveCustom(ctx, nxa, { unlock: name })) return null;
      lastUnlock = { slot: slot, id: id, name: name, heart: 0, prev: cur[slot] };
      BM.ui.toast(name + ' · 관리자 전체 해금 (하트 0)');
      refreshSheet(host, ctx);
      return Promise.resolve({ ok: true, purchased: false, price: 0, admin: true });
    }

    if (need <= 0) {
      var nx0 = equipNow();
      if (saveCustom(ctx, nx0, { unlock: name })) refreshSheet(host, ctx);
      return Promise.resolve({ ok: true, purchased: false, price: 0 });
    }

    var bal = heartNow(st);
    if (bal < need) {
      BM.racketcustom._lastNeed = need;
      /* bm-v1.87.0 — 단순 토스트로 끝내지 않고 '♥ N개 부족 · 광고 보고 바로 열기'
       * 충전 시트를 원톡으로 열어, 채우면 그 자리에서 이 파츠를 엽니다. */
      openAdCharge(host, ctx, slot, id, name, { need: need, short: need - bal });
      refreshSheet(host, ctx);
      return Promise.resolve({ ok: false, reason: 'hearts', need: need - bal });
    }
    if (!ctx.actions.buyRacketPart && !ctx.actions.buySmash) {
      BM.ui.toast('지금은 열 수 없어요 · 잠시 뒤 다시 시도해 주세요', 'error');
      return Promise.resolve({ ok: false, reason: 'unknown' });
    }
    BM.ui.toast(name + ' 여는 중…');
    var run = ctx.actions.buyRacketPart || function (sl, iid) { return ctx.actions.buySmash(sl, iid); };
    return Promise.resolve(run(slot, id)).then(function (res) {
      res = res || { ok: false, reason: 'error' };
      if (res.ok) {
        BM.ui.haptic(16);
        if (res.purchased) {
          lastUnlock = { slot: slot, id: id, name: name, heart: res.price || need, prev: cur[slot] };
          BM.ui.toast(name + ' 열었어요 · ❤ ' + (res.price || need) + '개 사용');
        } else {
          lastUnlock = null;
          BM.ui.toast(name + ' 입었어요');
        }
        paintHeader(ctx.store.state);
        if (ctx.repaint) ctx.repaint();
      } else if (res.reason === 'hearts') {
        BM.ui.toast('하트가 ' + (res.need || need) + '개 부족해요 · 출석·광고로 모아 보세요', 'error');
      } else if (res.reason === 'unknown') {
        BM.ui.toast('지금은 하트로 여는 준비 중이에요 · 화면은 그대로 둘게요', 'error');
      } else if (res.reason === 'paid_retry') {
        BM.ui.toast('하트 ' + (res.price || need) + '개로 열었어요 · 잠시 뒤 자동으로 입어져요');
      } else if (res.reason === 'locked') {
        BM.ui.toast('잠시만요, 저장 중이에요 · 한 번 더 눌러 주세요', 'error');
      } else if (res.reason === 'auth' || res.reason === 'no_login') {
        BM.ui.toast('로그인을 다시 확인해 주세요', 'error');
      } else {
        BM.ui.toast('열지 못했어요 · 잠시 뒤 다시 시도해 주세요', 'error');
      }
      refreshSheet(host, ctx);
      return res;
    }, function () {
      BM.ui.toast('열지 못했어요 · 잠시 뒤 다시 시도해 주세요', 'error');
      refreshSheet(host, ctx);
      return { ok: false, reason: 'error' };
    });
  }

  /* 하트가 모자란 자리에서 공용 리워드 광고 충전 시트로 원톡 (bm-v1.87.0)
   *  · 제목부터 '♥ N개 부족 · 광고 보고 바로 열기'로 무엇을 하면 되는지 분명히 하고,
   *  · 시트 안에서 '오늘 N/5회 남음'과 모자란 개수를 함께 보여 줍니다.
   *  · 광고·출석으로 채우면 그 자리에서 원래 열려던 파츠(buyPart)를 이어서 엽니다.
   *  · 광고 모듈이 없는 환경(테스트·오래된 캐시)에서는 안내 토스트만 남깁니다. */
  function openAdCharge(host, ctx, slot, id, name, opts) {
    opts = opts || {};
    var need = Math.max(1, Number(opts.need) || 1);
    var short = Math.max(1, Number(opts.short) || 1);
    if (BM.ads && typeof BM.ads.openHeartSheet === 'function') {
      var wrap = BM.ads.openHeartSheet(ctx, {
        need: need,
        title: '♥ ' + short + '개 부족 · 광고 보고 바로 열기',
        intro: function (s) {
          return '<p class="sheet__text"><b>' + (name || '이 파츠') + '</b>를 열려면 하트 <b>' + need +
            '개</b>가 필요해요. 지금 <b>' + s.balance + '개</b> 있어요.' +
            (s.balance < need ? ' <span class="warn">' + (need - s.balance) + '개 부족</span>' : '') + '</p>';
        },
        continueLabel: name ? name + ' 바로 열기' : '바로 열기',
        onContinue: function () {
          if (slot && id) buyPart(host, ctx, slot, id, name);
        }
      });
      if (wrap) return wrap;
    }
    if (BM.ui && BM.ui.toast) BM.ui.toast('하트가 ' + short + '개 부족해요 · MY에서 충전해 주세요', 'error');
    return null;
  }

  /* 오늘 새 줄로 교체일 기록 — 시트의 '오늘 갈았어요'와 상단 배지의 원톡 버튼이 같은 길을 씁니다 */
  function restringToday(host, ctx) {
    if (!BM.ui) return;
    /* 방금 다른 저장이 올라가는 중이면(잠금) 잠깐 뒤 한 번 더 시도합니다 */
    var doRestring = function (tries) {
      var gres = ctx.actions.setGear ? ctx.actions.setGear({ strungAt: U.ymd() }) : { ok: false };
      if (gres && gres.ok) {
        BM.ui.haptic(12);
        BM.ui.toast('오늘 새 줄로 갈았어요 · 줄이 다시 팽팽해요');
        paintHeader(ctx.store.state);
        if (ctx.repaint) ctx.repaint();
        refreshSheet(host, ctx);
        return;
      }
      if (tries > 0 && gres && gres.reason === 'locked') {
        setTimeout(function () { doRestring(tries - 1); }, 600);
        return;
      }
      BM.ui.toast('지금은 저장할 수 없어요 · 잠시 뒤 다시 시도해 주세요', 'error');
    };
    doRestring(2);
  }

  function openSheet(ctx) {
    if (!hasDom || !BM.ui) return null;
    lastUnlock = null;
    pendingBuy = '';
    activeSlot = 'frame';
    fullOn = false;      /* 시트를 열 때는 항상 원래 크기로 */
    var state = ctx.store.state;
    if (state && state.me && state.me.key) {
      /* 현재 상태로 바로 그려 둡니다(포인트·잠금 표시가 기록에서 계산됨) */
    }
    var wrap = BM.ui.openSheet({
      title: '🏸 내 커스텀 라켓',
      body: sheetBody(state),
      onMount: function (host) {
        if (BM.views && BM.views.friends && BM.views.friends.bindCopy) BM.views.friends.bindCopy(host);
        mount3d(host, ctx);
        host.addEventListener('click', function (ev) {
          /* ---- 스매시 / 꾸미기 모드 · ⚡ 스매시 테스트 (bm-v1.82.0) ---- */
          var modeBtn = ev.target.closest('[data-rk-mode]');
          if (modeBtn) {
            ev.preventDefault();
            var want = modeBtn.getAttribute('data-rk-mode');
            if (want !== stageMode) {
              stageMode = want === 'paint' ? 'paint' : 'smash';
              pendingBuy = '';
              BM.ui.haptic(6);
              refreshSheet(host, ctx);
            }
            return;
          }
          /* ---- 3D 전체화면 토글 (bm-v1.96.0) ---- */
          if (ev.target.closest('[data-rk-full]')) {
            ev.preventDefault();
            setFull(!fullOn, host);
            return;
          }
          /* ---- 스매시 소리 켜기/끄기 (bm-v1.90.0) ---- */
          if (ev.target.closest('[data-rk-sound]')) {
            ev.preventDefault();
            if (!BM.smashsound) return;
            var nowOff = BM.smashsound.toggle();
            var sbtn = ev.target.closest('[data-rk-sound]');
            if (sbtn) {
              sbtn.classList.toggle('is-off', nowOff);
              sbtn.setAttribute('aria-pressed', nowOff ? 'false' : 'true');
              sbtn.setAttribute('aria-label', nowOff ? '스매시 소리 켜기' : '스매시 소리 끄기');
              var sico = sbtn.querySelector('span');
              if (sico) sico.textContent = nowOff ? '🔇' : '🔊';
            }
            if (!nowOff) BM.smashsound.play(customOf(ctx.store.state.me).effect, 'air');
            if (BM.ui) BM.ui.haptic(6);
            return;
          }
          /* ---- 조합 도감: ⚡ 바로 완성하기 (bm-v1.97.0) ---- */
          var applyBtn = ev.target.closest('[data-rk-apply-set]');
          if (applyBtn) {
            ev.preventDefault();
            if (applyBtn.disabled) return;
            applySet(host, ctx, applyBtn.getAttribute('data-rk-apply-set'));
            return;
          }
          if (ev.target.closest('[data-rk-smash]')) {
            ev.preventDefault();
            /* 연출이 이미 효과 이름을 크게 띄우므로 토스트로 가리지 않습니다 */
            if (BM.racketcustom && BM.racketcustom._last3d && BM.racketcustom._last3d.smash) {
              BM.racketcustom._last3d.smash();
            }
            return;
          }
          /* ---- 라켓 모션 칩 (bm-v1.86.0) ---- */
          var moBtn = ev.target.closest('[data-rk-motion]');
          if (moBtn) {
            ev.preventDefault();
            var mid = moBtn.getAttribute('data-rk-motion');
            var mst = ctx.store.state;
            var mcur = customOf(mst.me);
            var mitem = itemOf('motion', mid) || { name: '모션' };
            var openMo = isUnlocked(mcur, 'motion', mid) || isAdminUser(mst);
            var api3 = BM.racketcustom._last3d;
            if (!openMo) {
              /* 첫 탭 = 미리보기(잠겨 있어도 한 번 보여 줍니다) */
              if (api3 && api3.motion) api3.motion(mid);
              BM.racketcustom._lastNeed = priceOf('motion', mid);
              var mbal = heartNow(mst);
              /* bm-v1.87.0 — 하트가 모자라면 미리보기 뒤에 광고 충전 시트로 원톡 */
              if (priceOf('motion', mid) > mbal) {
                pendingBuy = '';
                BM.ui.haptic(8);
                openAdCharge(host, ctx, 'motion', mid, mitem.name,
                  { need: priceOf('motion', mid), short: priceOf('motion', mid) - mbal });
                return;
              }
              if (pendingBuy !== 'motion:' + mid) {
                pendingBuy = 'motion:' + mid;
                BM.ui.haptic(8);
                BM.ui.toast(mitem.name + ' 미리보기 · ❤ ' + priceOf('motion', mid) + '개 · 한 번 더 누르면 열려요');
                return;
              }
              /* 두 번째 탭 = 하트로 열기 */
              pendingBuy = '';
              Promise.resolve(buyPart(host, ctx, 'motion', mid, mitem.name)).then(function (res) {
                if (res && res.ok && BM.racketcustom._last3d && BM.racketcustom._last3d.motion) {
                  BM.racketcustom._last3d.motion(mid);
                }
              });
              return;
            }
            if (api3 && api3.motion) api3.motion(mid);
            BM.ui.haptic(10);
            return;
          }
          if (ev.target.closest('[data-rk-slam]')) {
            ev.preventDefault();
            /* 바닥 강타 — 라켓이 코트를 내려찍고 헤드·거트가 부서졌다가 다시 맞춰집니다 */
            if (BM.racketcustom && BM.racketcustom._last3d && BM.racketcustom._last3d.slam) {
              BM.racketcustom._last3d.slam();
            }
            return;
          }
          var jump = ev.target.closest('[data-rk-hint-slot]');
          if (jump) {
            ev.preventDefault();
            var jslot = jump.getAttribute('data-rk-hint-slot');
            if (SLOTS.indexOf(jslot) >= 0) {
              activeSlot = jslot;
              if (BM.ui) BM.ui.haptic(6);
              refreshSheet(host, ctx);
            }
            return;
          }
          var tab = ev.target.closest('.rk3d__tab');
          if (tab) {
            ev.preventDefault();
            var slotPick = tab.getAttribute('data-rk-slot');
            if (SLOTS.indexOf(slotPick) >= 0 && slotPick !== activeSlot) {
              activeSlot = slotPick;
              BM.ui.haptic(6);
              refreshSheet(host, ctx);
            }
            return;
          }
          /* ---- 하트 모으기 (출석·광고 충전 시트로 바로) ---- */
          if (ev.target.closest('[data-rk-hearts]')) {
            ev.preventDefault();
            var want2 = 0;
            if (BM.racketcustom && BM.racketcustom._lastNeed) want2 = BM.racketcustom._lastNeed;
            if (BM.ads && typeof BM.ads.openHeartSheet === 'function') {
              BM.ads.openHeartSheet(ctx, {
                need: Math.max(1, want2 || 1),
                title: '❤ 하트 모으기',
                intro: function (s) {
                  return '<p class="sheet__text">라켓 파츠는 <b>하트</b>로 열려요. 지금 <b>' + s.balance + '개</b> 있어요.' +
                    (want2 && s.balance < want2 ? ' <span class="warn">' + (want2 - s.balance) + '개 부족</span>' : '') + '</p>';
                },
                onContinue: function () { refreshSheet(host, ctx); }
              });
            } else if (BM.ui) {
              BM.ui.toast('MY › 하트 카드에서 모을 수 있어요', 'error');
            }
            return;
          }

          var bodyBtn = ev.target.closest('[data-rk-body]');
          if (bodyBtn) {
            ev.preventDefault();
            var bid = bodyBtn.getAttribute('data-rk-body');
            var bst = ctx.store.state;
            var bcur = customOf(bst.me);
            if (bcur.body === bid) return;
            if (!isUnlocked(bcur, 'body', bid) && !isAdminUser(bst)) {
              buyPart(host, ctx, 'body', bid, BODIES[bid].name + ' 바디');
              return;
            }
            /* 관리자 해금: 하트 없이 열어 두고 입습니다 */
            var bnext = normalizeCustom(bcur);
            if (bnext.unlocked.indexOf('body:' + bid) < 0) bnext.unlocked.push('body:' + bid);
            if (isAdminUser(bst) && !isUnlocked(bcur, 'body', bid)) {
              bnext.body = bid;
              if (saveCustom(ctx, bnext, { body: BODIES[bid].name })) {
                BM.ui.toast(BODIES[bid].name + ' 바디 · 관리자 전체 해금');
                refreshSheet(host, ctx);
              }
              return;
            }
            bnext.body = bid;
            if (saveCustom(ctx, bnext, { body: BODIES[bid].name })) refreshSheet(host, ctx);
            return;
          }
          var part = ev.target.closest('[data-rk-part]');
          if (part) {
            ev.preventDefault();
            var slot = part.getAttribute('data-rk-slot');
            var id = part.getAttribute('data-rk-id');
            var st = ctx.store.state;
            var cur = customOf(st.me);
            var partIt = itemOf(slot, id) || {};
            var openNow = isUnlocked(cur, slot, id) || isAdminUser(st);
            if (!openNow) {
              /* bm-v1.84.0 — 모든 파츠를 하트로: 첫 탭은 미리보기, 한 번 더 누르면 하트로 엽니다
               * bm-v1.87.0 — 하트가 모자라면 막다른 안내 대신 광고 충전 시트로 원톡 */
              var needH = priceOf(slot, id);
              var keyH = slot + ':' + id;
              BM.racketcustom._lastNeed = needH;
              if (slot === 'effect' && BM.racketcustom._last3d && BM.racketcustom._last3d.smash) {
                BM.racketcustom._last3d.smash(id);       /* 어떤 연출인지 먼저 보여 줍니다 */
              }
              var balH = heartNow(st);
              if (needH > balH) {
                pendingBuy = '';
                BM.ui.haptic(8);
                openAdCharge(host, ctx, slot, id, partIt.name, { need: needH, short: needH - balH });
                return;
              }
              if (pendingBuy !== keyH) {
                pendingBuy = keyH;
                BM.ui.haptic(8);
                BM.ui.toast(partIt.name + ' · ❤ ' + needH + '개 · 한 번 더 누르면 열려요');
                refreshSheet(host, ctx);
                return;
              }
              pendingBuy = '';
              buyPart(host, ctx, slot, id, partIt.name);
              return;
            }
            var next2 = normalizeCustom(cur);
            /* 관리자는 '열린 것으로' 취급하므로, 고를 때 열림 목록에도 적어야
             * normalizeCustom 이 기본 파츠로 되돌리지 않습니다. */
            if (isAdminUser(st) && next2.unlocked.indexOf(slot + ':' + id) < 0) next2.unlocked.push(slot + ':' + id);
            next2[slot] = id;
            if (saveCustom(ctx, next2)) refreshSheet(host, ctx);
            return;
          }
          if (ev.target.closest('[data-rk-undo]')) {
            ev.preventDefault();
            if (!lastUnlock) return;
            /* 하트로 한 번 연 파츠는 그대로 두고, 입던 것만 되돌립니다(서버 원장은 환불하지 않아요) */
            var nowC = customOf(ctx.store.state.me);
            var back = normalizeCustom(nowC);
            back[lastUnlock.slot] = lastUnlock.prev;
            var nameU = lastUnlock.name;
            lastUnlock = null;
            if (saveCustom(ctx, back, {})) {
              BM.ui.toast(nameU + ' → 입던 파츠로 되돌렸어요 · 한 번 연 파츠는 그대로 열려 있어요');
              refreshSheet(host, ctx);
            }
            return;
          }
          if (ev.target.closest('[data-rk-restring]')) {
            ev.preventDefault();
            restringToday(host, ctx);
            return;
          }
          /* bm-v1.87.0 — 상단 상태 배지의 원톡 회복 */
          if (ev.target.closest('[data-rk-recover]')) {
            ev.preventDefault();
            var how = ev.target.closest('[data-rk-recover]').getAttribute('data-rk-recover');
            if (how === 'restring') {
              restringToday(host, ctx);
              return;
            }
            /* 일지 탭으로 — 오늘 기록을 남기면 미니 라켓이 다시 짱짱해집니다 */
            BM.ui.closeSheet();
            if (ctx.actions.setTab) ctx.actions.setTab('log');
            if (ctx.refresh) ctx.refresh();
            BM.ui.toast('오늘 일지를 쓰면 라켓이 다시 짱짱해져요');
            return;
          }
          if (ev.target.closest('[data-rk-gear]') || ev.target.closest('[data-rk-open-gear]')) {
            ev.preventDefault();
            if (BM.gear) BM.gear.openSheet(ctx);
            return;
          }
          if (ev.target.closest('[data-rk-wallpaper]')) {
            ev.preventDefault();
            /* bm-v1.89.0 — 앱이 있으면 배경화면 선택창으로, 없으면 설치 안내만 */
            var went = BM.wallpaper ? BM.wallpaper.apply(ctx.store.state) : false;
            if (BM.ui) {
              if (went) BM.ui.toast('셔틀릭스 앱에서 바탕화면을 확인해 주세요');
              else BM.ui.toast('안드로이드 셔틀릭스 앱을 설치하면 폰 바탕화면으로 쓸 수 있어요', 'error');
            }
            if (went && BM.ui && BM.ui.haptic) BM.ui.haptic(12);
            return;
          }
          if (ev.target.closest('[data-rk-share]')) {
            ev.preventDefault();
            BM.ui.closeSheet();
            if (BM.sharecard) {
              BM.sharecard.open(ctx, {
                mode: 'today',
                design: 'smash',
                record: (ctx.store.state.ui && ctx.store.state.ui.lastSavedLog) || null
              });
            }
            return;
          }
        });
      }
    });
    return wrap;
  }

  /* ---------- 저장 직후 임팩트 (라켓이 깨지며 오늘 운동이 퍼짐) ---------- */
  function condShort(rec) {
    if (!rec || rec.cond == null || rec.cond === '') return '';
    /* 숫자를 그대로 — '컨디션 8점' (구간 이름은 화면 다른 곳에서 이미 보여 줍니다) */
    return '컨디션 ' + rec.cond + '점';
  }

  function burstChips(state, rec) {
    rec = rec || (state && state.ui && state.ui.lastSavedLog) || null;
    var out = [];
    if (rec && rec.minutes) out.push({ k: '운동', v: rec.minutes + '분' });
    var cs = condShort(rec);
    if (cs) out.push({ k: '오늘', v: cs });
    var focus = (rec && (rec.weakness || [])[0]) || (rec && (rec.done || [])[0]) || '오늘의 훈련';
    out.push({ k: '집중', v: focus });
    /* bm-v1.84.0 — 라켓 포인트 폐지: 저장 직후 칩에 '+P'를 쓰지 않습니다 */
    return out.slice(0, 4);
  }

  var BURST_MS = 880;

  function burst(opts) {
    if (!hasDom) return false;
    opts = opts || {};
    var state = opts.state || null;
    var reduce = false;
    try {
      reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { reduce = false; }
    if (reduce) return false;
    var old = document.getElementById('smashburst');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var custom = customOf(state && state.me);
    var level = (opts.level || 'prime');
    var chips = (opts.chips && opts.chips.length) ? opts.chips : burstChips(state, opts.record);
    var pos = [
      { x: -104, y: -112, r: -7 },
      { x: 106, y: -94, r: 6 },
      { x: -102, y: 104, r: 5 },
      { x: 104, y: 116, r: -6 }
    ];
    var chipHtml = chips.map(function (c, i) {
      var p = pos[i] || pos[0];
      return '<span class="smash__chip" style="--tx:' + p.x + 'px;--ty:' + p.y + 'px;--r:' + p.r + 'deg;--d:' + (i * 26) + 'ms">' +
        '<i>' + U.esc(c.k) + '</i><b>' + U.esc(c.v) + '</b></span>';
    }).join('');
    /* 파편 12개 — 각도·길이·기울기를 조금씩 어긋나게 해 '유리 조각'처럼 */
    var SHARDS = [
      [7, 3, 0.95, 64, 34, 14], [38, 5, 0.75, 86, 22, -18], [74, 4, 0.9, 58, 40, 9],
      [101, 6, 0.6, 96, 18, -12], [136, 3, 0.95, 70, 30, 16], [167, 4, 0.7, 102, 24, -22],
      [194, 5, 0.85, 62, 36, 8], [226, 3, 0.65, 92, 20, -15], [254, 4, 0.95, 66, 32, 12],
      [286, 6, 0.6, 100, 18, -9], [311, 3, 0.85, 60, 38, 18], [340, 4, 0.7, 88, 22, -20]
    ];
    var shards = '';
    for (var i = 0; i < SHARDS.length; i++) {
      var sh = SHARDS[i];
      var col = i % 3 === 0 ? '#f2c14e' : (i % 3 === 1 ? '#c6f24e' : '#f7ffdf');
      shards += '<i class="smash__shard" style="--a:' + sh[0] + 'deg;--tilt:' + sh[5] + 'deg;--d:' + sh[3] +
        'px;--w:' + sh[1] + 'px;--h:' + sh[4] + 'px;--o:' + sh[2] + ';--c:' + col + ';--dl:' + (i * 7) + 'ms"></i>';
    }
    var racket = svg(custom, { level: 'prime' });
    var node = document.createElement('div');
    node.id = 'smashburst';
    node.className = 'smashburst';
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = '<div class="smash__stage">' +
      '<span class="smash__flash"></span>' +
      '<span class="smash__ring smash__ring--1"></span>' +
      '<span class="smash__ring smash__ring--2"></span>' +
      '<span class="smash__ring smash__ring--3"></span>' +
      '<span class="smash__rays"></span>' +
      '<span class="smash__shards">' + shards + '</span>' +
      '<span class="smash__racket">' +
        '<span class="smash__half smash__half--l">' + racket + '</span>' +
        '<span class="smash__half smash__half--r">' + racket + '</span>' +
      '</span>' +
      '<span class="smash__crack"></span>' +
      '<span class="smash__streak"></span>' +
      '<span class="smash__chips">' + chipHtml + '</span>' +
      '</div>';
    document.body.appendChild(node);
    var done = false;
    function clear() {
      if (done) return;
      done = true;
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    setTimeout(clear, BURST_MS + 120);
    if (typeof opts.onDone === 'function') setTimeout(opts.onDone, BURST_MS);
    return true;
  }

  /* 공유 카드에 넣을 내 라켓·친구 코드 정보 */
  function shareInfo(state) {
    var c = customOf(state && state.me);
    var code = '';
    if (BM.views && BM.views.friends && BM.views.friends.myCode) code = BM.views.friends.myCode(state) || '';
    var nick = (state && state.me && state.me.nick) || '';
    return {
      custom: c,
      has: hasCustom(c),
      level: conditionOf(state).level,
      name: nick,
      code: code,
      label: nick ? (nick + (code ? '#' + code : '')) : ''
    };
  }

  BM.racketcustom = {
    PARTS: PARTS, SLOTS: SLOTS, HEART_PRICE: HEART_PRICE,
    RARITY: RARITY, RARITY_IDS: RARITY_IDS, rarityOf: rarityOf, rarityRankOf: rarityRankOf,
    topRarity: topRarity, rarityNameOf: rarityNameOf,
    BODIES: BODIES, BODY_IDS: BODY_IDS, DEFAULT_BODY: DEFAULT_BODY, bodyOf: bodyOf, geomOf: geomOf,
    bodyHtml: bodyHtml, headLoop: headLoop,
    TIRED_DAYS: TIRED_DAYS, BROKEN_DAYS: BROKEN_DAYS, BURST_MS: BURST_MS,
    itemsOf: itemsOf, itemOf: itemOf, freeId: freeId, colorOf: colorOf, costOf: costOf,
    heartCostOf: heartCostOf, isHeartItem: isHeartItem, smashLabel: smashLabel, smashPalette: smashPalette,
    SMASH_MS: SMASH_MS, drawSmash: drawSmash,
    WIND_MS: WIND_MS, SWING_MS: SWING_MS, HIT_AT: HIT_AT, BOOM_MS: BOOM_MS, HITSTOP_MS: HITSTOP_MS,
    smashClock: smashClock, smashPhase: smashPhase, swingOf: swingOf, shuttlePath: shuttlePath,
    launchPath: launchPath, entryVec: entryVec, motionPose: motionPose, MOTION_MS: MOTION_MS, MOTIONS: MOTIONS,
    MOTION_EMOJI: MOTION_EMOJI, motionChipsHtml: motionChipsHtml,
    SHUTTLE_MM: { L: SHUT_L, W: SHUT_W, R: SHUT_R },
    isPartSlot: isPartSlot, tex: tex, _tex: tex,
    blankCustom: blankCustom, normalizeCustom: normalizeCustom, isUnlocked: isUnlocked,
    hasCustom: hasCustom, customOf: customOf, customFor: customFor, specText: specText,
    priceOf: priceOf, heartNow: heartNow, ownedCount: ownedCount, isAdminUser: isAdminUser,
    pointsToday: pointsToday,
    lastLogDate: lastLogDate, conditionOf: conditionOf,
    svg: svg, drawRacket: drawRacket, miniHtml: miniHtml, personHtml: personHtml, peekOf: peekOf,
    /* bm-v1.95.0 — 세트 조합 보너스 (공개 4 · 히든 7) */
    SETS: SETS, HIDDEN_SETS: HIDDEN_SETS, setById: setById, setHit: setHit, setHitRaw: setHitRaw, activeSet: activeSet, activeSetRaw: activeSetRaw,
    nextSet: nextSet, foundOf: foundOf, hiddenFoundCount: hiddenFoundCount, newlyFound: newlyFound,
    needText: needText, needIds: needIds, autoHint: autoHint, setBonusHtml: setBonusHtml, mergeFound: mergeFound,
    /* bm-v1.97.0 — '⚡ 바로 완성하기' (이미 맞춘 조합 원톡 장착) */
    setApplyPlan: setApplyPlan, setMine: setMine, applySet: applySet,
    stageState: stageState, stageBadgeHtml: stageBadgeHtml,
    bodyDecalSvg: bodyDecalSvg, fxSvg: fxSvg, headArc: headArc, decalAt: decalAt, stringChords: stringChords,
    _parts: { head: addHead, edge: addFrameEdge, decals: addDecals, strings: addStrings, stencil: addStencil,
      shaft: addShaft, grip: addGrip, charm: addCharm, paint: paintPrims, fxBack: fxBack,
      fxFront: fxFront, draw: draw3d },
    headerHtml: headerHtml, paintHeader: paintHeader,
    sheetBody: sheetBody, stageHtml: stageHtml, openSheet: openSheet, pickSlot: pickSlot, mount3d: mount3d,
    /* bm-v1.88.0 — 3D 뷰가 '지금 스매시/꾸미기 모드인지' 물어볼 수 있게 */
    stageModeGet: function () { return stageMode; },
    stringAge: stringAge, stringAgeHtml: stringAgeHtml,
    /* 3D 뷰 (테스트·재사용) */
    G3: G3, rot3: rot3, project3: project3, hitSlot: hitSlot, draw3d: draw3d, inPoly: inPoly,
    burstChips: burstChips, burst: burst, shareInfo: shareInfo
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
