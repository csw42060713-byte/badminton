/* ============================================================
 * js/pose.js — 🎥 영상 자세 비교 (bm-v1.50.0)
 *
 *  폰으로 찍은 짧은 배드민턴 영상을 **서버로 보내지 않고** 브라우저 안에서만 봅니다.
 *  · 화면에서 고른 영상 파일은 blob: 주소로 이 기기 안에서만 열립니다(업로드 없음).
 *  · MediaPipe Pose(tasks-vision PoseLandmarker)를 처음 쓸 때 한 번만 CDN에서 받아 옵니다
 *    (WASM + 자세 모델 합쳐 약 10MB · 이후 브라우저가 캐시합니다).
 *  · 영상에서 12~20프레임을 골라 33개 관절 좌표를 읽고, 스켈레톤을 그린 미리보기와
 *    논문 기준과 나란히 놓은 비교 카드를 보여 줍니다.
 *
 *  ▮ 계산은 전부 순수 함수(frameMetrics · measure · cardsFor)입니다.
 *    화면·영상 없이 좌표 배열만 넘기면 같은 결과가 나와 node 테스트(test/v150.test.js)에서
 *    그대로 돌려 봅니다. 영상이 없어도 '예시로 보기'(demoFrames)로 같은 파이프라인을 봅니다.
 *
 *  ▮ 화면에 나가는 말은 전부 쉬운 코트 말투입니다. 논문 이름과 수치는 맨 아래
 *    작은 참고 줄에만 둡니다(앱의 AI 문구 원칙과 같습니다).
 *
 *  ▮ 기준 수치의 출처(모두 실제 논문·국제대회 측정)
 *    · 팔꿈치 각도(임팩트): Miller·Felton·McErlain-Naylor·Towler·King 2016 (BWF/Loughborough,
 *      n=18, 3D 400Hz) 165±5° · King·Towler·Dillon·McErlain-Naylor 2020 (Appl. Sci. 10:1248)
 *      166.1±4.3° · 湯(湯海鵬)·阿江 1994 (Biomechanisms 12, 엘리트 4명) 160°
 *    · 준비 무릎: 같은 Miller 2016 — 준비 순간 무릎 폄 각 110±12° (굽힘 70±12°)
 *    · 임팩트 몸통: 같은 Miller 2016 — 임팩트 때 몸통 회전 −2±5°(정면으로 돌아옴),
 *      Hussey(북일리노이대) — 임팩트 자세는 거의 수직 또는 살짝 앞
 *    · 타점: Towler·King 2023 (IJRSS, 국제대회 남 26·여 26명) 남 2.90m / 여 2.46m,
 *      Wang et al. 1998 (ISBS, 대만 엘리트 7명) 타점이 신장의 145%(스매시)·159%(점프 스매시)
 *    · 런지 앞무릎: Nishino·大熊 2014 (JSME, 고교 8명) 무릎 굽힘 70°,
 *      Xie·Pan·Liang·Wu·Chen 2025 (PLOS ONE, 아마추어 24명) 최대 굽힘 81.7±8.6°
 *    · 런지 몸통: Lam·Wong·Lee 2020 (PeerJ 리뷰) — 런지 프로토콜의 몸통 앞굽힘 45°,
 *      뒷다리는 뒤로 펴서 버팀(Kuntze·Mansfield·Sellers 2010)
 *    · 스플릿 스텝 발 간격: Shishido·Nishijima 2025 (BWF 세계선수권 2023 남자 단식 1~4위)
 *      스플릿 스텝 자세 발 간격 = 신장의 50%, 반응 0.25초 · Hsueh·Pan·Tsai 2016 (ISBS)
 *      스플릿 스텝 타이밍 = 상대 타구 후 0.014~0.037초
 *    ※ 2D 영상이라 촬영 각도·거리에 따라 오차가 있습니다. 화면에도 그렇게 적습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;
  var hasDom = typeof document !== 'undefined' && !!document.createElement;
  function UI() { return BM.ui; }

  /* ---------- MediaPipe 자산 주소 (버전을 고정해 예고 없이 바뀌지 않게) ---------- */
  var MP_VERSION = '0.10.14';
  var CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION;
  var BUNDLE_URL = CDN_BASE + '/vision_bundle.mjs';
  var WASM_PATH = CDN_BASE + '/wasm';
  var MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

  var SAMPLE_N = 16;          /* 기본 샘플 프레임 수 */
  var SAMPLE_MIN = 12;
  var SAMPLE_MAX = 20;
  var MAX_MB = 200;           /* 이보다 큰 파일은 기기에서 열기 전에 안내합니다 */
  var THUMB_W = 360;          /* 미리보기용 프레임 그림 폭(px) */

  /* BlazePose 33 관절 번호 */
  var LM = {
    nose: 0, lEar: 7, rEar: 8,
    lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
    lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28
  };
  var SIDE_IDX = {
    L: { sh: LM.lSh, el: LM.lEl, wr: LM.lWr, hip: LM.lHip, kn: LM.lKn, an: LM.lAn },
    R: { sh: LM.rSh, el: LM.rEl, wr: LM.rWr, hip: LM.rHip, kn: LM.rKn, an: LM.rAn }
  };
  /* 스켈레톤 선 (33점 중 몸통·팔·다리 위주로) */
  var BONES = [
    [11, 12], [11, 23], [12, 24], [23, 24],
    [11, 13], [13, 15], [12, 14], [14, 16],
    [23, 25], [25, 27], [24, 26], [26, 28],
    [27, 31], [28, 32], [11, 7], [12, 8], [7, 0], [8, 0]
  ];

  var MODES = [
    { id: 'smash', label: '스매시·클리어 타점', short: '타점' },
    { id: 'foot', label: '스플릿 스텝·풋워크', short: '풋워크' }
  ];

  function modeDef(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return MODES[0];
  }

  /* ---------- 기준 카드 ----------
   *  ref: 논문·국제대회 선수 측정값에서 가져온 '이 사이면 좋아요' 범위
   *  tip: 화면에 그대로 나가는 쉬운 말 (good / low / high)
   *  src: 맨 아래 참고 줄에 쓰는 짧은 출처 */
  var CARDS = {
    smash: [
      {
        key: 'elbow', label: '임팩트 팔꿈치 각도', unit: '°', digits: 0,
        ref: { min: 155, max: 175, text: '155~175°' },
        tip: {
          good: '임팩트 때 팔이 거의 펴졌어요. 좋은 모양이에요.',
          low: '임팩트 때 팔이 덜 펴졌어요. 타점 직전에 팔을 쭉 펴면서 채 보세요.',
          high: '팔을 끝까지 뻣뻣하게 폈어요. 임팩트 뒤에 살짝 힘을 빼 보세요.'
        },
        src: 'Miller 2016 165±5°·King 2020 166±4°'
      },
      {
        key: 'reach', label: '타점 (손목이 어깨보다 위로)', unit: '배', digits: 1,
        ref: { min: 0.9, max: 1.45, text: '0.9~1.45배(몸통 길이)' },
        tip: {
          good: '타점이 높아요. 손목이 머리 위에서 공을 잡고 있어요.',
          low: '타점이 낮아요. 손목을 머리 위로 더 올려서 잡아 보세요.',
          high: '타점이 아주 높아요. 다만 몸이 뒤로 젖혀지지 않았는지 같이 봐 주세요.'
        },
        src: 'Towler 2023·Wang 1998 타점 = 신장의 145~159%'
      },
      {
        key: 'prepKnee', label: '준비(테이크백) 무릎 굽힘', unit: '°', digits: 0,
        ref: { min: 58, max: 82, text: '58~82°' },
        tip: {
          good: '준비 때 무릎을 잘 앉혔어요. 점프와 회전 힘이 잘 실립니다.',
          low: '준비 때 무릎이 거의 안 굽었어요. 한 번 앉았다가 올라오면서 치면 힘이 붙어요.',
          high: '준비 때 너무 깊게 앉았어요. 앞으로 나가는 첫발이 느려질 수 있어요.'
        },
        src: 'Miller 2016 준비 무릎 폄 110±12°(=굽힘 70±12°)'
      },
      {
        key: 'tilt', label: '임팩트 때 몸통 기울기', unit: '°', digits: 0,
        ref: { min: 0, max: 20, text: '0~20°' },
        tip: {
          good: '임팩트 때 몸통이 거의 세워져 있어요.',
          low: '',
          high: '임팩트 때 몸통이 많이 기울었어요. 배에 힘을 주고 몸통을 세워서 쳐 보세요.'
        },
        src: 'Miller 2016 임팩트 몸통 회전 −2±5°·Hussey'
      }
    ],
    foot: [
      {
        key: 'stance', label: '스플릿 스텝 발 간격', unit: '배', digits: 1,
        ref: { min: 1.45, max: 2.05, text: '1.45~2.05배(몸통 길이)' },
        tip: {
          good: '발 간격이 좋아요. 어느 쪽으로도 바로 나갈 수 있어요.',
          low: '발이 좁아요. 상대가 치기 전에 어깨너비보다 넓게 한 번 벌려 보세요.',
          high: '발이 너무 넓어요. 첫발이 늦어질 수 있어요.'
        },
        src: 'Shishido 2025 스플릿 스텝 발 간격 = 신장의 50%(몸통 길이의 약 1.7배)'
      },
      {
        key: 'lungeKnee', label: '런지 앞무릎 굽힘', unit: '°', digits: 0,
        ref: { min: 60, max: 90, text: '60~90°' },
        tip: {
          good: '런지에서 앞무릎으로 잘 받아 주고 있어요.',
          low: '런지에서 무릎이 덜 굽었어요. 앞으로 앉으면서 공을 잡아 보세요.',
          high: '무릎을 너무 깊게 굽혔어요. 앞무릎이 발끝을 넘지 않게 조절해 보세요.'
        },
        src: 'Nishino 2014 70°·Xie 2025 82±9°'
      },
      {
        key: 'rearKnee', label: '뒤쪽 다리 무릎 각도', unit: '°', digits: 0,
        ref: { min: 140, max: 175, text: '140~175°' },
        tip: {
          good: '뒷다리를 펴서 버티고 있어요. 되돌아오기가 빨라요.',
          low: '뒷다리가 많이 굽었어요. 뒷다리를 펴서 버티면 되돌아오기가 빨라져요.',
          high: ''
        },
        src: 'Kuntze 2010·Lam 2020 — 런지에서 뒷다리는 펴서 버팀'
      },
      {
        key: 'lungeTilt', label: '런지 때 몸통 기울기', unit: '°', digits: 0,
        ref: { min: 25, max: 50, text: '25~50°' },
        tip: {
          good: '런지 때 상체 각도가 좋아요.',
          low: '상체가 너무 서 있어요. 공을 잡을 때 상체를 살짝 숙여 보세요.',
          high: '상체가 너무 숙여졌어요. 가슴과 시선을 조금 더 세워 보세요.'
        },
        src: 'Lam 2020 리뷰 런지 프로토콜 몸통 앞굽힘 45°'
      }
    ]
  };

  /* ============================================================
   * 1) 순수 함수 — 좌표만 있으면 계산되는 부분
   * ============================================================ */
  function num(v) { return typeof v === 'number' && isFinite(v); }

  function dist(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  /* 세 점의 사잇각(도). b가 꼭짓점. 180°면 일직선 */
  function angleAt(a, b, c) {
    var v1x = a.x - b.x, v1y = a.y - b.y;
    var v2x = c.x - b.x, v2y = c.y - b.y;
    var n1 = Math.sqrt(v1x * v1x + v1y * v1y);
    var n2 = Math.sqrt(v2x * v2x + v2y * v2y);
    if (!(n1 > 0) || !(n2 > 0)) return NaN;
    var cos = (v1x * v2x + v1y * v2y) / (n1 * n2);
    if (cos > 1) cos = 1;
    if (cos < -1) cos = -1;
    return Math.acos(cos) * 180 / Math.PI;
  }

  function okLandmarks(lm) {
    if (!lm || !lm.length || lm.length < 29) return false;
    for (var i = 0; i < lm.length; i++) {
      if (!lm[i] || !num(lm[i].x) || !num(lm[i].y)) return false;
    }
    return true;
  }

  /* 한 프레임의 자세 수치 — 라켓 팔(side)을 기준으로 잽니다.
   *  y는 화면 좌표(아래로 갈수록 큼)라서 '위로'는 y가 작아지는 쪽입니다. */
  function frameMetrics(lm, side) {
    if (!okLandmarks(lm)) return null;
    var S = SIDE_IDX[side === 'L' ? 'L' : 'R'];
    var sh = lm[S.sh], el = lm[S.el], wr = lm[S.wr];
    var shMid = mid(lm[LM.lSh], lm[LM.rSh]);
    var hipMid = mid(lm[LM.lHip], lm[LM.rHip]);
    var torso = dist(shMid, hipMid);
    if (!(torso > 0.005)) return null;
    var shoulderW = dist(lm[LM.lSh], lm[LM.rSh]);
    var kneeL = 180 - angleAt(lm[LM.lHip], lm[LM.lKn], lm[LM.lAn]);
    var kneeR = 180 - angleAt(lm[LM.rHip], lm[LM.rKn], lm[LM.rAn]);
    var dx = shMid.x - hipMid.x;
    var up = hipMid.y - shMid.y;                    /* 위로 솟은 높이(양수면 정상) */
    return {
      elbow: angleAt(sh, el, wr),
      reach: (sh.y - wr.y) / torso,                   /* +면 손목이 어깨보다 위 */
      tilt: Math.atan2(Math.abs(dx), Math.max(0.001, up)) * 180 / Math.PI,
      tiltSide: dx >= 0 ? 1 : -1,
      kneeFlexL: isFinite(kneeL) ? Math.max(0, kneeL) : NaN,
      kneeFlexR: isFinite(kneeR) ? Math.max(0, kneeR) : NaN,
      stance: Math.abs(lm[LM.lAn].x - lm[LM.rAn].x) / Math.max(0.02, torso),
      wristX: wr.x, wristY: wr.y,
      shoulderW: shoulderW,
      torso: torso,
      valid: true
    };
  }

  /* 어느 팔로 치는지 — 영상 전체에서 손목이 더 많이 움직인 쪽 */
  function detectSide(frames) {
    var best = { side: 'R', travel: -1 };
    ['L', 'R'].forEach(function (side) {
      var S = SIDE_IDX[side];
      var prev = null, sum = 0, n = 0;
      (frames || []).forEach(function (f) {
        if (!f || !okLandmarks(f.lm)) { prev = null; return; }
        var w = f.lm[S.wr];
        if (prev) { sum += dist(prev, w); n++; }
        prev = w;
      });
      if (n && sum > best.travel) best = { side: side, travel: sum };
    });
    return best.side;
  }

  /* 촬영 길이 → 샘플 시각(초). 앞뒤 가장자리는 조금 비웁니다(검은 프레임 방지) */
  function planSamples(duration, count) {
    var n = Math.round(count || SAMPLE_N);
    if (n < SAMPLE_MIN) n = SAMPLE_MIN;
    if (n > SAMPLE_MAX) n = SAMPLE_MAX;
    if (!(duration > 0)) return [];
    var pad = Math.min(0.12, duration * 0.06);
    var from = pad;
    var to = Math.max(pad + 0.02, duration - pad);
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = from + (to - from) * (i / (n - 1));
      out.push(Math.round(t * 1000) / 1000);
    }
    return out;
  }

  /* 프레임 묶음 → 핵심 순간 + 비교 카드
   *  frames: [{ t: 초, lm: 33좌표 또는 null }]  ·  mode: 'smash' | 'foot' */
  function measure(frames, mode) {
    var useMode = mode === 'foot' ? 'foot' : 'smash';
    var side = detectSide(frames);
    var rows = [];
    (frames || []).forEach(function (f, i) {
      var m = frameMetrics(f && f.lm, side);
      if (m) rows.push({ i: i, t: (f && f.t) || 0, lm: f.lm, m: m });
    });
    if (rows.length < 4) {
      return { ok: false, mode: useMode, side: side, count: rows.length, reason: 'few-frames' };
    }

    var picks = {};
    if (useMode === 'smash') {
      /* 임팩트 = 손목이 가장 빨리 움직인 프레임(빠른 후보 3개 중 손목이 가장 높은 쪽) */
      var cand = [];
      var wrIdx = SIDE_IDX[side].wr;
      for (var k = 1; k < rows.length; k++) {
        var dt = Math.max(0.001, rows[k].t - rows[k - 1].t);
        cand.push({ k: k, v: dist(rows[k].lm[wrIdx], rows[k - 1].lm[wrIdx]) / dt });
      }
      cand.sort(function (a, b) { return b.v - a.v; });
      var top = cand.slice(0, 3).sort(function (a, b) {
        return rows[a.k].m.wristY - rows[b.k].m.wristY;   /* y가 작을수록 높음 */
      });
      var impact = top.length ? top[0].k : rows.length - 1;
      /* 준비 = 임팩트 전에 무릎이 가장 많이 굽은 순간 (Miller 2016 정의) */
      var prep = impact, prepFlex = -1;
      for (var p = 0; p <= impact; p++) {
        var pf = Math.max(rows[p].m.kneeFlexL, rows[p].m.kneeFlexR);
        if (isFinite(pf) && pf > prepFlex) { prepFlex = pf; prep = p; }
      }
      /* 착지 = 임팩트 뒤에 무릎이 가장 많이 굽은 순간 */
      var land = impact, landFlex = -1;
      for (var q = impact; q < rows.length; q++) {
        var lf = Math.max(rows[q].m.kneeFlexL, rows[q].m.kneeFlexR);
        if (isFinite(lf) && lf > landFlex) { landFlex = lf; land = q; }
      }
      picks = { key: impact, prep: prep, landing: land };
      picks.values = {
        elbow: rows[impact].m.elbow,
        reach: rows[impact].m.reach,
        prepKnee: prepFlex,
        tilt: rows[impact].m.tilt
      };
      picks.extra = {
        landingKnee: landFlex,
        impactT: rows[impact].t,
        prepT: rows[prep].t,
        landingT: rows[land].t
      };
    } else {
      /* 풋워크 = 발 간격이 가장 넓은 순간(런지가 가장 깊은 프레임) */
      var deep = 0, deepV = -1;
      rows.forEach(function (r, idx) {
        if (isFinite(r.m.stance) && r.m.stance > deepV) { deepV = r.m.stance; deep = idx; }
      });
      var flexMax = Math.max(rows[deep].m.kneeFlexL, rows[deep].m.kneeFlexR);
      var flexMin = Math.min(rows[deep].m.kneeFlexL, rows[deep].m.kneeFlexR);
      /* 스플릿 스텝 간격 = 영상에서 가장 좁은 순간(모아 선 자세)이 아니라,
       * 발이 가장 넓게 벌어진 순간을 씁니다 — 두 발이 땅에 닿은 자세 기준 */
      picks = { key: deep };
      picks.values = {
        stance: deepV,
        lungeKnee: flexMax,
        rearKnee: 180 - flexMin,
        lungeTilt: rows[deep].m.tilt
      };
      picks.extra = { deepT: rows[deep].t, frames: rows.length };
    }

    var cards = cardsFor(picks.values, useMode);
    return {
      ok: true,
      mode: useMode,
      side: side,
      count: rows.length,
      picks: picks,
      rows: rows.map(function (r) { return { t: r.t, i: r.i, m: r.m }; }),
      cards: cards,
      summary: summaryOf(cards, useMode)
    };
  }

  function fmtValue(card, value) {
    if (!num(value)) return '—';
    return value.toFixed(card.digits == null ? 0 : card.digits);
  }

  /* 수치 → 판정(good / low / high / na) */
  function verdictOf(value, ref) {
    if (!num(value) || !ref) return 'na';
    if (num(ref.min) && value < ref.min) return 'low';
    if (num(ref.max) && value > ref.max) return 'high';
    return 'good';
  }

  var VERDICT_LABEL = { good: '좋아요', low: '조금 낮아요', high: '조금 높아요', na: '재지 못했어요' };

  function cardsFor(values, mode) {
    var defs = CARDS[mode === 'foot' ? 'foot' : 'smash'];
    return defs.map(function (d) {
      var v = values ? values[d.key] : null;
      var verdict = verdictOf(v, d.ref);
      var tip = (d.tip && d.tip[verdict]) || '';
      /* 한쪽으로만 말하는 항목(예: 몸통 기울기는 낮을수록 좋음)은 그 반대를 '좋아요'로 */
      if (verdict === 'low' && !d.tip.low) verdict = 'good';
      if (verdict === 'high' && !d.tip.high) verdict = 'good';
      if (verdict === 'good' && !tip) tip = d.tip.good || '';
      return {
        key: d.key, label: d.label, unit: d.unit, digits: d.digits,
        value: num(v) ? v : null,
        text: fmtValue(d, v),
        refText: d.ref.text, ref: d.ref,
        verdict: verdict,
        badge: VERDICT_LABEL[verdict],
        tip: tip,
        src: d.src
      };
    });
  }

  /* 화면 맨 위 한 줄 — 가장 먼저 고칠 한 가지(없으면 칭찬) */
  function summaryOf(cards, mode) {
    if (!cards || !cards.length) return '';
    var miss = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].verdict !== 'good' && cards[i].tip) { miss = cards[i]; break; }
    }
    if (miss) return miss.tip;
    return mode === 'foot'
      ? '지금 풋워크 모양이 좋아요. 이대로 한 번 더 찍어서 비교해 보세요.'
      : '지금 타점 모양이 좋아요. 이대로 한 번 더 찍어서 비교해 보세요.';
  }

  /* ============================================================
   * 2) 스켈레톤 그리기 — 캔버스 2D
   * ============================================================ */
  function drawSkeleton(g, lm, opts) {
    if (!g || !okLandmarks(lm)) return;
    opts = opts || {};
    var w = opts.w || 1, h = opts.h || 1;
    var X = function (p) { return p.x * w; };
    var Y = function (p) { return p.y * h; };
    var side = opts.side === 'L' ? 'L' : 'R';
    var S = SIDE_IDX[side];
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    /* 뼈대 */
    g.strokeStyle = opts.bone || 'rgba(120,255,214,0.85)';
    g.lineWidth = Math.max(1.6, w * 0.006);
    BONES.forEach(function (b) {
      var a = lm[b[0]], c = lm[b[1]];
      if (!a || !c) return;
      g.beginPath();
      g.moveTo(X(a), Y(a));
      g.lineTo(X(c), Y(c));
      g.stroke();
    });
    /* 관절 점 */
    var r = Math.max(2, w * 0.008);
    for (var i = 0; i < lm.length; i++) {
      if (i === 0) continue;
      g.beginPath();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.arc(X(lm[i]), Y(lm[i]), r * 0.62, 0, Math.PI * 2);
      g.fill();
    }
    /* 측정에 쓴 관절은 크게 (팔꿈치·손목·어깨·무릎·발목) */
    var hi = [S.sh, S.el, S.wr, S.hip, S.kn, S.an];
    hi.forEach(function (idx) {
      var p = lm[idx];
      if (!p) return;
      g.beginPath();
      g.fillStyle = opts.hot || '#c6f24e';
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = Math.max(1, w * 0.003);
      g.arc(X(p), Y(p), r * 1.15, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
    /* 팔꿈치-어깨-손목 사이 각을 호로 표시 */
    var sh = lm[S.sh], el = lm[S.el], wr = lm[S.wr];
    if (sh && el && wr) {
      var a1 = Math.atan2(Y(sh) - Y(el), X(sh) - X(el));
      var a2 = Math.atan2(Y(wr) - Y(el), X(wr) - X(el));
      var rr = Math.max(10, w * 0.05);
      g.beginPath();
      g.strokeStyle = 'rgba(198,242,78,0.55)';
      g.lineWidth = Math.max(1, w * 0.004);
      var diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      g.arc(X(el), Y(el), rr, a1, a1 + diff, diff < 0);
      g.stroke();
    }
    g.restore();
  }

  /* ============================================================
   * 3) 예시 프레임 — 영상이 없어도 같은 계산·화면을 확인합니다
   *    (동호인 수준의 스매시 / 런지 한 동작을 좌표로 만든 것)
   * ============================================================ */
  var D2R = Math.PI / 180;

  /* 두 마디(위 마디 a→k, 아래 마디 k→b). bend는 k에서의 사잇각(도) */
  function twoBone(a, l1, l2, bend, d1, d2) {
    var r1 = d1 * D2R;
    var k = { x: a.x + l1 * Math.sin(r1), y: a.y + l1 * Math.cos(r1) };
    var r2 = r1 + (Math.PI - bend * D2R) * (d2 < 0 ? -1 : 1);
    var b = { x: k.x + l2 * Math.sin(r2), y: k.y + l2 * Math.cos(r2) };
    return { j: k, e: b };
  }

  /* 발목 가로 위치(s)와 무릎 사잇각(θ)을 주면 무릎·발목 자리를 계산합니다.
   *  다리 길이 0.16 + 0.16, 무릎은 앞쪽(+x)으로 굽습니다. */
  function legToFoot(hip, s, kneeAngle) {
    var a = 0.16;
    var theta = Math.max(10, Math.min(179, kneeAngle)) * D2R;
    var d = 2 * a * Math.sin(theta / 2);
    var ss = Math.max(-d * 0.97, Math.min(d * 0.97, s));
    var dy = Math.sqrt(Math.max(0, d * d - ss * ss));
    var ankle = { x: hip.x + ss, y: hip.y + dy };
    var mx = (hip.x + ankle.x) / 2, my = (hip.y + ankle.y) / 2;
    var hh = Math.sqrt(Math.max(0, a * a - (d * d) / 4));
    var ux = (ankle.x - hip.x) / (d || 1), uy = (ankle.y - hip.y) / (d || 1);
    var knee = { x: mx + uy * hh, y: my - ux * hh };
    return { knee: knee, ankle: ankle };
  }

  function blankPose() {
    var out = [];
    for (var i = 0; i < 33; i++) out.push({ x: 0.5, y: 0.5, z: 0, visibility: 1 });
    return out;
  }

  /* 한 프레임 자세 만들기
   *  cfg: { hipY, shoulderY, leanX, elbowAng, armDir, kneeFlex, stanceX, side } */
  function poseFrame(cfg) {
    cfg = cfg || {};
    var side = cfg.side || 'R';
    var hipY = cfg.hipY == null ? 0.60 : cfg.hipY;
    var shY = cfg.shoulderY == null ? 0.40 : cfg.shoulderY;
    var leanX = cfg.leanX || 0;
    var stanceX = cfg.stanceX == null ? 0.03 : cfg.stanceX;
    var kneeFlex = cfg.kneeFlex == null ? 20 : cfg.kneeFlex;
    var kneeFlexRear = cfg.kneeFlexRear == null ? kneeFlex : cfg.kneeFlexRear;
    var kneeAng = 180 - Math.max(0, Math.min(160, kneeFlex));
    var kneeAngRear = 180 - Math.max(0, Math.min(160, kneeFlexRear));

    var lm = blankPose();
    var shMid = { x: 0.50 + leanX, y: shY };
    var hipMid = { x: 0.50, y: hipY };
    lm[LM.lSh] = { x: shMid.x - 0.018, y: shMid.y + 0.004, z: 0, visibility: 1 };
    lm[LM.rSh] = { x: shMid.x + 0.018, y: shMid.y + 0.004, z: 0, visibility: 1 };
    lm[LM.lHip] = { x: hipMid.x - 0.02, y: hipMid.y, z: 0, visibility: 1 };
    lm[LM.rHip] = { x: hipMid.x + 0.02, y: hipMid.y, z: 0, visibility: 1 };
    lm[LM.nose] = { x: shMid.x + 0.005, y: shY - 0.14, z: 0, visibility: 1 };
    lm[LM.lEar] = { x: shMid.x - 0.03, y: shY - 0.12, z: 0, visibility: 1 };
    lm[LM.rEar] = { x: shMid.x + 0.035, y: shY - 0.12, z: 0, visibility: 1 };

    /* 다리: 발 간격 stanceX(한쪽), 무릎 사잇각 = 180 - 굽힘.
     * 발목 자리를 먼저 정하고 무릎을 두 원의 교점으로 놓아 각도가 정확히 나옵니다. */
    ['l', 'r'].forEach(function (k) {
      var hip = lm[k === 'l' ? LM.lHip : LM.rHip];
      var leg = legToFoot(hip, (k === 'l' ? -stanceX : stanceX), k === 'r' ? kneeAng : kneeAngRear);
      lm[k === 'l' ? LM.lKn : LM.rKn] = { x: leg.knee.x, y: leg.knee.y, z: 0, visibility: 1 };
      lm[k === 'l' ? LM.lAn : LM.rAn] = { x: leg.ankle.x, y: leg.ankle.y, z: 0, visibility: 1 };
    });

    /* 팔: 라켓 팔은 위(185° 근처), 반대 팔은 아래 */
    var armDir = cfg.armDir == null ? 186 : cfg.armDir;
    var elbowAng = cfg.elbowAng == null ? 60 : cfg.elbowAng;
    var shA = lm[side === 'L' ? LM.lSh : LM.rSh];
    var arm = twoBone(shA, 0.13, 0.12, elbowAng, armDir, -1);
    lm[side === 'L' ? LM.lEl : LM.rEl] = { x: arm.j.x, y: arm.j.y, z: 0, visibility: 1 };
    lm[side === 'L' ? LM.lWr : LM.rWr] = { x: arm.e.x, y: arm.e.y, z: 0, visibility: 1 };
    var other = side === 'L' ? 'r' : 'l';
    var shB = lm[other === 'l' ? LM.lSh : LM.rSh];
    var arm2 = twoBone(shB, 0.13, 0.12, 120, 20, 1);
    lm[other === 'l' ? LM.lEl : LM.rEl] = { x: arm2.j.x, y: arm2.j.y, z: 0, visibility: 1 };
    lm[other === 'l' ? LM.lWr : LM.rWr] = { x: arm2.e.x, y: arm2.e.y, z: 0, visibility: 1 };
    return lm;
  }

  /* 예시 스매시 16프레임: 준비(무릎 70° 굽힘) → 스윙 → 임팩트(팔꿈치 150°) → 착지 */
  function demoFrames(mode) {
    var out = [];
    var isFoot = mode === 'foot';
    var N = 16;
    for (var i = 0; i < N; i++) {
      var f = i / (N - 1);
      var lm;
      if (isFoot) {
        /* 풋워크: 모아 선 자세 → 넓게 벌린 런지(무릎 75°) → 되돌아오기 */
        var spread = f < 0.55 ? 0.03 + 0.15 * (f / 0.55) : 0.18 - 0.11 * ((f - 0.55) / 0.45);
        var deep = f > 0.35 && f < 0.75;
        var lean = deep ? 0.13 : 0.05;
        lm = poseFrame({
          kneeFlex: deep ? 75 : 22, kneeFlexRear: deep ? 50 : 22,
          stanceX: spread, elbowAng: 110, armDir: 150, leanX: lean
        });
      } else {
        var flex2 = f < 0.26 ? 70 : f < 0.45 ? 58 : f < 0.66 ? 22 : 45;
        var dir = f < 0.30 ? 40 + 40 * (f / 0.30) : 80 + 104 * Math.min(1, (f - 0.30) / 0.34);
        var elbowAng = f < 0.26 ? 55 : f < 0.5 ? 95 : f < 0.68 ? 150 : 110;
        lm = poseFrame({ kneeFlex: flex2, stanceX: 0.04, elbowAng: elbowAng, armDir: dir, leanX: 0.018 });
      }
      out.push({ t: Math.round(i * 66) / 1000, lm: lm });
    }
    return out;
  }

  /* ============================================================
   * 4) MediaPipe — 처음 한 번만 불러옵니다
   * ============================================================ */
  var landmarkerPromise = null;
  var loadState = 'idle';      /* idle | loading | ready | error */

  function loadLandmarker() {
    if (landmarkerPromise) return landmarkerPromise;
    loadState = 'loading';
    landmarkerPromise = Promise.resolve().then(function () {
      /* 동적 import — CDN 모듈을 그대로 씁니다(CSP에서 이 출처만 열어 둡니다) */
      return import(BUNDLE_URL);
    }).then(function (vision) {
      if (!vision || !vision.FilesetResolver || !vision.PoseLandmarker) throw new Error('vision-load');
      return vision.FilesetResolver.forVisionTasks(WASM_PATH).then(function (fileset) {
        return vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5
        });
      });
    }).then(function (inst) {
      loadState = 'ready';
      return inst;
    }).catch(function (err) {
      loadState = 'error';
      landmarkerPromise = null;
      throw err;
    });
    return landmarkerPromise;
  }

  function modelState() {
    return { state: loadState, ready: loadState === 'ready' };
  }

  function loadHint() {
    return '분석 모델을 처음 받아 오는 중이에요. 10MB쯤이라 잠깐 걸려요.';
  }

  function failHint(err) {
    var name = (err && (err.name || '') ) + ' ' + ((err && err.message) || '');
    if (/SecurityError|CSP|Content Security/i.test(name)) {
      return '브라우저 보안 설정 때문에 분석 모델을 못 불러왔어요. 앱을 새로 열어 다시 해 보세요.';
    }
    return '인터넷 연결 후 첫 분석 모델을 불러와 주세요. 모델은 한 번만 받으면 돼요.';
  }

  /* ---------- 영상에서 좌표 뽑기 ---------- */
  function seekTo(video, t) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() {
        if (done) return;
        done = true;
        video.removeEventListener('seeked', fin);
        resolve();
      }
      video.addEventListener('seeked', fin);
      try {
        var target = Math.max(0, Math.min(t, Math.max(0, (video.duration || t) - 0.03)));
        video.currentTime = target;
      } catch (e) { fin(); return; }
      setTimeout(fin, 2000);      /* seeked 를 못 받아도 멈추지 않게 */
    });
  }

  function captureThumb(video) {
    try {
      var w = THUMB_W;
      var vw = video.videoWidth || 16, vh = video.videoHeight || 9;
      var h = Math.round(w * vh / vw);
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var g = c.getContext('2d');
      g.drawImage(video, 0, 0, w, h);
      return { url: c.toDataURL('image/jpeg', 0.7), w: w, h: h };
    } catch (e) { return null; }
  }

  /* 영상 파일 → [{ t, lm, thumb }] (모두 이 기기 안에서) */
  function readVideo(file, opts) {
    opts = opts || {};
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : function () {};
    var landmarker = null;
    onProgress({ phase: 'model', done: 0, total: 0 });
    return loadLandmarker().then(function (inst) {
      landmarker = inst;
      return openVideo(file);
    }).then(function (video) {
      var duration = video.duration;
      var times = planSamples(duration, opts.count);
      var frames = [];
      var chain = Promise.resolve();
      times.forEach(function (t, i) {
        chain = chain.then(function () {
          onProgress({ phase: 'frames', done: i, total: times.length });
          return seekTo(video, t).then(function () {
            var thumb = captureThumb(video);
            var lm = null;
            try {
              var res = landmarker.detect(video);
              lm = (res && res.landmarks && res.landmarks[0]) || null;
            } catch (e) { lm = null; }
            frames.push({ t: t, lm: lm, thumb: thumb });
          });
        });
      });
      return chain.then(function () {
        onProgress({ phase: 'frames', done: times.length, total: times.length });
        closeVideo(video);
        return { frames: frames, duration: duration };
      });
    });
  }

  var videoEl = null, videoUrl = '';

  function openVideo(file) {
    return new Promise(function (resolve, reject) {
      if (!hasDom) return reject(new Error('no-dom'));
      closeVideo(null);
      var v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'auto';
      videoUrl = URL.createObjectURL(file);
      videoEl = v;
      var settled = false;
      function ok() {
        if (settled) return;
        settled = true;
        if (!(v.duration > 0) || !isFinite(v.duration)) { reject(new Error('no-duration')); return; }
        resolve(v);
      }
      function bad() {
        if (settled) return;
        settled = true;
        reject(new Error('video-decode'));
      }
      v.addEventListener('loadedmetadata', ok);
      v.addEventListener('loadeddata', function () { if (v.videoWidth) ok(); });
      v.addEventListener('error', bad);
      v.src = videoUrl;
      v.load();
      setTimeout(function () {
        if (settled) return;
        if (v.duration > 0) ok(); else bad();
      }, 8000);
    });
  }

  function closeVideo() {
    if (videoEl) {
      try { videoEl.removeAttribute('src'); videoEl.load(); } catch (e) { /* 무시 */ }
      videoEl = null;
    }
    if (videoUrl) {
      try { URL.revokeObjectURL(videoUrl); } catch (e) { /* 무시 */ }
      videoUrl = '';
    }
  }

  /* ============================================================
   * 5) 화면 (전체화면 패널)
   * ============================================================ */
  var panelEl = null;
  var state = {
    mode: 'smash',
    frames: null,        /* [{ t, lm, thumb }] */
    result: null,
    view: 0,
    busy: false,
    error: '',
    hint: '',
    demo: false,
    fileName: ''
  };

  function entryHtml() {
    return '<button type="button" class="courttool" data-act="open-pose">' +
      UI().icon('camera') +
      '<span class="courttool__t">영상 자세 비교<small>폰 안에서만 분석 · 스매시·풋워크</small></span>' +
      UI().icon('arrow', 'courttool__car') + '</button>';
  }

  function modesHtml() {
    return '<div class="seg pose__modes" role="tablist" aria-label="분석 종목">' +
      MODES.map(function (m) {
        var on = state.mode === m.id;
        return '<button type="button" class="seg__btn' + (on ? ' is-on' : '') + '" role="tab"' +
          ' data-pose-mode="' + m.id + '" aria-selected="' + (on ? 'true' : 'false') + '">' +
          U.esc(m.label) + '</button>';
      }).join('') + '</div>';
  }

  function statusHtml() {
    if (state.error) {
      return '<div class="pose__status pose__status--err" data-pose-status>' +
        '<p>' + U.esc(state.error) + '</p>' +
        '<div class="row gap8 mt8"><button type="button" class="btn btn--ghost btn--sm" data-pose-retry>다시 해 보기</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-pose-demo>예시로 보기</button></div></div>';
    }
    if (state.busy) {
      return '<div class="pose__status" data-pose-status><span class="pose__spin" aria-hidden="true"></span>' +
        '<p>' + U.esc(state.hint || '영상을 읽고 있어요…') + '</p></div>';
    }
    if (!state.frames) {
      return '<div class="pose__status" data-pose-status>' +
        '<p>영상을 고르면 <b>이 기기 안에서만</b> 관절을 찾아 볼게요. 5~15초짜리 짧은 영상이 가장 정확해요.</p>' +
        '<button type="button" class="linkbtn mt6" data-pose-demo>영상 없이 예시로 먼저 보기</button></div>';
    }
    return '';
  }

  function stageHtml() {
    var hasFrames = !!state.frames;
    var r = state.result;
    var oneLine = '';
    if (r && r.ok) oneLine = '<div class="pose__one" data-pose-one>' + U.esc(r.summary) + '</div>';
    return '<div class="pose__stage"' + (hasFrames ? '' : ' hidden') + ' data-pose-stage>' +
      '<canvas class="pose__canvas" data-pose-canvas width="360" height="480"></canvas>' +
      '<div class="pose__scrub row gap8" data-pose-scrub>' +
      '<input type="range" min="0" max="15" step="1" value="0" data-pose-range aria-label="프레임 이동">' +
      '<span class="pose__t" data-pose-time>0.00초</span></div>' +
      '<div class="pose__legend"><span class="pose__dot"></span>노란 점이 재는 데 쓴 관절(어깨·팔꿈치·손목·무릎·발목)이에요</div>' +
      oneLine + '</div>' +
      '<div class="pose__cards" data-pose-cards>' + (r && r.ok ? cardsHtml(r) : '') + '</div>';
  }

  function cardsHtml(r) {
    return '<ul class="posecards">' + r.cards.map(function (c) {
      return '<li class="posecard is-' + c.verdict + '" data-pose-card="' + c.key + '">' +
        '<div class="posecard__top"><span class="posecard__name">' + U.esc(c.label) + '</span>' +
        '<span class="posecard__badge">' + U.esc(c.badge) + '</span></div>' +
        '<div class="posecard__row">' +
        '<span class="posecard__mine"><b>' + U.esc(c.text) + '</b>' + U.esc(c.unit || '') + '</span>' +
        '<span class="posecard__ref">기준 ' + U.esc(c.refText) + '</span>' +
        '</div>' +
        '<div class="posecard__bar"><i style="--w:' + barPct(c) + '%"></i></div>' +
        (c.tip ? '<p class="posecard__tip">' + U.esc(c.tip) + '</p>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  /* 막대 — 기준 범위 안이면 가운데, 벗어나면 그만큼 밀어 보여 줍니다 */
  function barPct(c) {
    if (!c || c.value == null || !c.ref) return 0;
    var min = num(c.ref.min) ? c.ref.min : 0;
    var max = num(c.ref.max) ? c.ref.max : min + 1;
    var span = Math.max(0.001, max - min);
    var lo = min - span * 1.2, hi = max + span * 1.2;
    var v = Math.min(hi, Math.max(lo, c.value));
    var pct = (v - lo) / (hi - lo);
    return Math.round(Math.max(6, Math.min(100, pct * 100)));
  }

  /* 맨 아래 작은 참고 줄 — 화면 말에는 논문 수치를 섞지 않고 여기에만 둡니다 */
  function refNote(mode) {
    var defs = CARDS[mode === 'foot' ? 'foot' : (mode === 'smash' ? 'smash' : null)] ||
      CARDS.smash.concat(CARDS.foot);
    var srcs = [];
    defs.forEach(function (d) { if (d.src && srcs.indexOf(d.src) < 0) srcs.push(d.src); });
    return '<p class="pose__foot" data-pose-foot>참고 수치: ' + U.esc(srcs.join(' · ')) +
      '<br>중계 각도·촬영 거리에 따라 오차가 있을 수 있는 참고 값이에요. 영상은 폰 밖으로 나가지 않습니다.</p>';
  }

  function shellHtml() {
    return '' +
      '<div class="bgp__backdrop" data-pose-close="1"></div>' +
      '<div class="bgp__panel posep__panel" role="dialog" aria-modal="true" aria-label="영상 자세 비교">' +
      '<div class="bgp__head"><h2>🎥 영상 자세 비교</h2>' +
      '<button type="button" class="iconbtn" data-pose-close="1" aria-label="닫기">' + UI().icon('close') + '</button></div>' +
      '<div class="bgp__body pose__body" data-pose-body>' +
      '<p class="pose__privacy">' + UI().icon('shield') + '<span>영상은 서버로 전송되지 않고 <b>내 폰 안에서만</b> 분석돼요.</span></p>' +
      '<div data-pose-modes>' + modesHtml() + '</div>' +
      '<label class="pose__pick">' + UI().icon('camera') +
      '<span><b>폰에서 영상 고르기</b><small>스매시·클리어 또는 풋워크가 나오는 짧은 영상</small></span>' +
      '<input type="file" accept="video/*" data-pose-file></label>' +
      '<div data-pose-status-wrap>' + statusHtml() + '</div>' +
      '<div data-pose-stage-wrap>' + stageHtml() + '</div>' +
      '<div class="row gap8 mt12 pose__actions" data-pose-actions hidden>' +
      '<button type="button" class="btn btn--ghost grow" data-pose-note>' + UI().icon('edit') + '일지 메모에 넣기</button>' +
      '</div>' +
      '<div data-pose-refnote>' + refNote() + '</div>' +
      '</div></div>';
  }

  function host(sel) { return panelEl ? panelEl.querySelector(sel) : null; }

  function paint() {
    if (!panelEl) return;
    var m = host('[data-pose-modes]');
    if (m) m.innerHTML = modesHtml();
    var sw = host('[data-pose-status-wrap]');
    if (sw) sw.innerHTML = statusHtml();
    var stw = host('[data-pose-stage-wrap]');
    if (stw) stw.innerHTML = stageHtml();
    var act = host('[data-pose-actions]');
    if (act) {
      var show = !!(state.result && state.result.ok);
      act.hidden = !show;
      /* .row 가 display:flex 라 hidden 속성만으로는 안 사라집니다 — 클래스로도 닫아 둡니다 */
      act.classList.toggle('is-off', !show);
    }
    var range = host('[data-pose-range]');
    if (range && state.frames) {
      range.max = String(Math.max(0, state.frames.length - 1));
      range.value = String(state.view);
    }
    drawView();
  }

  /* 지금 보는 프레임을 캔버스에 (영상 그림 + 스켈레톤) */
  function drawView() {
    var c = host('[data-pose-canvas]');
    if (!c || !state.frames || !state.frames.length) return;
    var idx = Math.max(0, Math.min(state.frames.length - 1, state.view));
    var f = state.frames[idx];
    var w = c.width, h = c.height;
    var g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    var paint = function () {
      drawSkeleton(g, f.lm, { w: w, h: h, side: state.result ? state.result.side : 'R' });
      var t = host('[data-pose-time]');
      if (t) t.textContent = (Number(f.t) || 0).toFixed(2) + '초';
    };
    if (f.thumb && f.thumb.url) {
      var img = new Image();
      img.onload = function () {
        g.fillStyle = '#0b1210';
        g.fillRect(0, 0, w, h);
        var sw = f.thumb.w || img.width, shh = f.thumb.h || img.height;
        var scale = Math.min(w / sw, h / shh);
        var dw = sw * scale, dh = shh * scale;
        g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        /* 그림 위 좌표도 같은 비율로 옮겨 그립니다 */
        if (scale < 1 || scale > 1) {
          var offX = (w - dw) / 2 / w, offY = (h - dh) / 2 / h;
          var mapped = f.lm ? f.lm.map(function (p) {
            return { x: offX + p.x * (dw / w), y: offY + p.y * (dh / h) };
          }) : null;
          drawSkeleton(g, mapped, { w: w, h: h, side: state.result ? state.result.side : 'R' });
        } else {
          drawSkeleton(g, f.lm, { w: w, h: h, side: state.result ? state.result.side : 'R' });
        }
        var t2 = host('[data-pose-time]');
        if (t2) t2.textContent = (Number(f.t) || 0).toFixed(2) + '초';
      };
      img.src = f.thumb.url;
      g.fillStyle = 'rgba(11,18,16,0.9)';
      g.fillRect(0, 0, w, h);
      return;
    }
    /* 영상 그림이 없으면(예시 모드) 어두운 코트 배경 위에 뼈대만 */
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0d1a16');
    grad.addColorStop(1, '#08100e');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    g.lineWidth = 1;
    for (var y = 24; y < h; y += 24) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    paint();
  }

  function setHint(text) { state.hint = text || ''; }

  function runAnalysis(frames, opts) {
    state.frames = frames;
    var res = measure(frames, state.mode);
    state.result = res;
    /* 처음 보여 줄 프레임 = 핵심 순간(임팩트·런지) */
    state.view = 0;
    if (res.ok && res.picks && state.frames[res.picks.key]) state.view = res.picks.key;
    if (!res.ok) {
      state.error = res.count
        ? '관절을 찾지 못했어요. 사람이 전신으로 나오고, 영상이 너무 짧지 않은지 확인해 주세요.'
        : '영상에서 사람을 찾지 못했어요. 전신이 나오게 조금 멀리서 찍어 주세요.';
    } else {
      state.error = '';
    }
    if (opts && opts.demo) state.demo = true;
    paint();
  }

  function startAnalysis(file) {
    if (!file) return;
    if (state.busy) return;
    state.error = '';
    if (file.size && file.size > MAX_MB * 1024 * 1024) {
      state.error = '영상이 너무 커요(' + Math.round(file.size / 1024 / 1024) + 'MB). 1분 안쪽 영상으로 다시 골라 주세요.';
      paint();
      return;
    }
    state.busy = true;
    state.demo = false;
    state.fileName = file.name || '';
    state.frames = null;
    state.result = null;
    setHint(loadState === 'ready' ? '영상에서 관절을 찾는 중이에요…' : loadHint());
    paint();
    readVideo(file, {
      onProgress: function (p) {
        if (p.phase === 'model') setHint(loadHint());
        else setHint('관절을 찾는 중이에요… ' + p.done + '/' + p.total);
        var st = host('[data-pose-status] p');
        if (st) st.textContent = state.hint;
      }
    }).then(function (pack) {
      state.busy = false;
      if (!pack.frames.length) { state.error = '영상이 너무 짧아 프레임을 못 골랐어요.'; paint(); return; }
      runAnalysis(pack.frames);
      if (state.result && state.result.ok) {
        UI().haptic(12);
        UI().toast('자세를 비교했어요. 카드를 확인해 보세요.');
      }
    }).catch(function (err) {
      state.busy = false;
      closeVideo();
      if (err && err.message === 'video-decode') {
        state.error = '이 영상은 폰 브라우저가 읽지 못해요. mp4(H.264)로 다시 찍거나 변환해 주세요.';
      } else {
        state.error = failHint(err);
      }
      paint();
    });
  }

  function useDemo() {
    state.demo = true;
    state.error = '';
    state.busy = false;
    runAnalysis(demoFrames(state.mode), { demo: true });
    UI().haptic(8);
  }

  function noteLine(r) {
    var parts = [];
    (r.cards || []).slice(0, 3).forEach(function (c) {
      parts.push(c.label.replace(/\s*\(.*?\)\s*/g, ' ').trim() + ' ' + c.text + (c.unit || ''));
    });
    return '🎥 영상 자세 비교(' + modeDef(r.mode).short + ') — ' + parts.join(' · ');
  }

  function addToNote(ctx) {
    if (!ctx || !state.result || !state.result.ok) return;
    var cur = (ctx.store && ctx.store.state.drafts.log.note) || '';
    var add = noteLine(state.result);
    var next = (cur ? cur.trim() + ' ' : '') + add;
    if (next.length > 160) next = next.slice(0, 157) + '…';
    ctx.actions.setDraft({ note: next });
    UI().toast('일지 메모에 넣었어요');
    UI().haptic(10);
    close();
  }

  function onClick(ev) {
    if (ev.target.closest('[data-pose-close]')) { ev.preventDefault(); close(); return; }
    var mb = ev.target.closest('[data-pose-mode]');
    if (mb) {
      ev.preventDefault();
      var next = mb.getAttribute('data-pose-mode') === 'foot' ? 'foot' : 'smash';
      if (next === state.mode) return;
      state.mode = next;
      UI().haptic(6);
      if (state.demo) useDemo();                 /* 예시는 종목에 맞춰 새로 만듭니다 */
      else if (state.frames) runAnalysis(state.frames);
      else paint();
      return;
    }
    if (ev.target.closest('[data-pose-demo]')) { ev.preventDefault(); useDemo(); return; }
    if (ev.target.closest('[data-pose-retry]')) { ev.preventDefault(); state.error = ''; paint(); return; }
    if (ev.target.closest('[data-pose-note]')) { ev.preventDefault(); addToNote(panelCtx); return; }
  }

  function onInput(ev) {
    var range = ev.target.closest && ev.target.closest('[data-pose-range]');
    if (range) {
      state.view = Math.max(0, Math.min((state.frames || []).length - 1, Number(range.value) || 0));
      drawView();
      return;
    }
    var fileEl = ev.target.closest && ev.target.closest('[data-pose-file]');
    if (fileEl && fileEl.files && fileEl.files[0]) {
      startAnalysis(fileEl.files[0]);
      fileEl.value = '';
    }
  }

  function onPop() {
    if (!panelEl) return;
    panelEl = null;
    var node = document.getElementById('posePanel');
    if (node) {
      node.classList.remove('is-on');
      if (document.body) document.body.classList.remove('no-scroll');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
    closeVideo();
  }

  function close() {
    if (!hasDom) return;
    var node = panelEl;
    panelEl = null;
    if (!node) return;
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    node.classList.remove('is-on');
    if (document.body) document.body.classList.remove('no-scroll');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
    closeVideo();
  }

  var panelCtx = null;

  function open(ctx, opts) {
    if (!hasDom) return null;
    opts = opts || {};
    panelCtx = ctx || null;
    if (panelEl) { paint(); return panelEl; }
    state.mode = opts.mode === 'foot' ? 'foot' : (state.mode || 'smash');
    state.error = '';
    state.hint = '';
    if (!opts.keep) { state.frames = null; state.result = null; }
    var node = document.createElement('div');
    node.id = 'posePanel';
    node.className = 'bgp posep';
    node.innerHTML = shellHtml();
    document.body.appendChild(node);
    document.body.classList.add('no-scroll');
    panelEl = node;
    node.addEventListener('click', onClick);
    node.addEventListener('input', onInput);
    node.addEventListener('change', onInput);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('popstate', onPop);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.open();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { node.classList.add('is-on'); });
    else node.classList.add('is-on');
    var wrap = node.querySelector('[data-pose-file]');
    if (wrap) wrap.setAttribute('aria-label', '영상 고르기');
    if (opts.demo) useDemo();
    return node;
  }

  function openFrom(ctx, opts) { return open(ctx, opts || {}); }

  BM.pose = {
    MODES: MODES, CARDS: CARDS, BONES: BONES, SAMPLE_N: SAMPLE_N, MAX_MB: MAX_MB,
    CDN_BASE: CDN_BASE, MODEL_URL: MODEL_URL,
    /* 계산 (순수 함수) */
    dist: dist, angleAt: angleAt, frameMetrics: frameMetrics, detectSide: detectSide,
    planSamples: planSamples, measure: measure, cardsFor: cardsFor, summaryOf: summaryOf,
    verdictOf: verdictOf, barPct: barPct, demoFrames: demoFrames, poseFrame: poseFrame,
    /* 그리기·영상 */
    drawSkeleton: drawSkeleton, readVideo: readVideo, loadLandmarker: loadLandmarker,
    modelState: modelState, loadHint: loadHint, failHint: failHint, seekTo: seekTo,
    /* 화면 */
    entryHtml: entryHtml, shellHtml: shellHtml, cardsHtml: cardsHtml, stageHtml: stageHtml, refNote: refNote,
    modesHtml: modesHtml, statusHtml: statusHtml, noteLine: noteLine,
    open: open, openFrom: openFrom, close: close, isOpen: function () { return !!panelEl; },
    /* 테스트용 — 지금 화면 상태 확인 */
    _state: function () { return state; },
    _setMode: function (m) { state.mode = m === 'foot' ? 'foot' : 'smash'; },
    _analyzeDemo: function (mode) { state.mode = mode === 'foot' ? 'foot' : state.mode; useDemo(); }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
