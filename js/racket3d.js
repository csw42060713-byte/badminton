/* ============================================================
 * js/racket3d.js — 진짜 3D 커스텀 라켓 쇼룸 (bm-v1.90.0)
 *
 * 예전(js/racketcustom.js draw3d)은 캔버스 2D 에 투영해 그리는 가짜 3D 였습니다.
 * 이 파일은 저장소 안에 직접 넣은 Three.js(WebGL) 엔진으로 **실제 메쉬**를 만들어
 * 조명·재질·그림자로 그립니다.
 *
 *  · 프레임  — 헤드 실루엣(바디 4종)을 따라 단면을 쓸어 만든 링(박스/에어로 단면)
 *              + 그로밋(줄 구멍) + 12·3·9시/T 조인트 데칼 + 카본 직조 범프
 *  · 스트링  — 17×19 실제 격자, 줄 상태(prime/worn/broken)에 따라 처짐·끊김
 *  · 샤프트  — 6.8mm 슬림 테이퍼 + 광택 카본, 콘·엔드캡·그립 나선(오버그립 주름)
 *  · 파츠    — 바디·프레임(금속/매트)·스트링·그립(타월/투톤)·스텐실·참·효과 전부 반영
 *  · 쇼룸    — 어두운 스튜디오 배경 + 3점 조명(키·림·필) + 바닥 스포트라이트 + 반사
 *  · 스매시  — 셔틀콕이 코트 먼 쪽에서 날아오고, 백스윙 → 프로네이션 풀스윙 →
 *              히트스톱 + 카메라 셰이크 + 스윙 궤적 + 3D 파티클 → 코르크 반전 발사
 *  · 모션    — 손목 트위스트 / 쇼케이스 스핀 / 공중 360° 플립을 3D 공간에서
 *
 *  WebGL 이 없는 곳(Node 테스트·구형 브라우저)에서는 available() 가 false 라
 *  js/racketcustom.js 의 기존 2D 렌더러로 조용히 돌아갑니다.
 * ============================================================ */
(function (root) {
  'use strict';

  var BM = root.BM = root.BM || {};
  var hasDom = typeof document !== 'undefined';
  var REV = '1.88.0';

  var TEX = {};                 /* 캔버스 텍스처 캐시 (한 번만 굽습니다) */
  var webglProbe = null;        /* null = 아직 확인 전 */
  var viewMem = { yaw: -0.46, pitch: 0.12 };   /* 시트를 닫았다 열어도 보던 각도 그대로 */

  function RC() { return BM.racketcustom || null; }
  function engine() { return root.THREE || null; }

  function clamp01(p) { return p < 0 ? 0 : (p > 1 ? 1 : p); }
  function clampN(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut3(p) { p = clamp01(p); return 1 - Math.pow(1 - p, 3); }
  function easeIn3(p) { p = clamp01(p); return p * p * p; }
  function easeInOut3(p) {
    p = clamp01(p);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }
  function smooth(p) { p = clamp01(p); return p * p * (3 - 2 * p); }

  function nowMs() {
    return (root.performance && root.performance.now) ? root.performance.now() : Date.now();
  }

  /* ============================================================
   * 1. 캔버스 텍스처 — 카본 직조 · 타월 결 · 스튜디오 환경 · 스텐실 · 입자
   * ============================================================ */

  function canvasDraw(key, w, h, draw, opt) {
    if (TEX[key]) return TEX[key];
    var T = engine();
    if (!T || !hasDom) return null;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    if (!g) return null;
    draw(g, w, h);
    var t = new T.CanvasTexture(cv);
    opt = opt || {};
    if (opt.srgb !== false) t.encoding = T.sRGBEncoding;
    if (opt.repeat) {
      t.wrapS = T.RepeatWrapping;
      t.wrapT = T.RepeatWrapping;
      t.repeat.set(opt.repeat[0], opt.repeat[1]);
    }
    if (opt.aniso && hasDom) { t.anisotropy = 4; }
    TEX[key] = t;
    return t;
  }

  /* 카본 직조 — 대각선 트윌이 번갈아 가는 미세 결 (범프·거칠기용, 색은 재질이 냅니다) */
  function carbonTexture() {
    return canvasDraw('carbon', 256, 256, function (g, w, h) {
      g.fillStyle = '#7d7d7d'; g.fillRect(0, 0, w, h);
      var cell = 32;
      for (var y = 0; y < h; y += cell) {
        for (var x = 0; x < w; x += cell) {
          var odd = ((x / cell) + (y / cell)) % 2 === 0;
          g.strokeStyle = odd ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
          g.lineWidth = 3;
          g.beginPath();
          if (odd) { g.moveTo(x, y + cell); g.lineTo(x + cell, y); }
          else { g.moveTo(x, y); g.lineTo(x + cell, y + cell); }
          g.stroke();
          g.strokeStyle = 'rgba(0,0,0,0.18)';
          g.lineWidth = 1;
          g.beginPath();
          if (odd) { g.moveTo(x + 6, y + cell); g.lineTo(x + cell, y + 6); }
          else { g.moveTo(x + 6, y); g.lineTo(x + cell, y + 6); }
          g.stroke();
        }
      }
      /* 아주 미세한 노이즈 */
      for (var i = 0; i < 2600; i++) {
        g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.06).toFixed(3) + ')';
        g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
    }, { srgb: false, repeat: [3, 6] });
  }

  /* 타월 오버그립 — 보풀 결 (범프) */
  function towelTexture() {
    return canvasDraw('towel', 256, 256, function (g, w, h) {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 5200; i++) {
        var a = Math.random();
        g.fillStyle = a > 0.5 ? 'rgba(255,255,255,' + (0.1 + a * 0.25).toFixed(2) + ')'
          : 'rgba(0,0,0,' + (0.08 + a * 0.2).toFixed(2) + ')';
        var x = Math.random() * w, y = Math.random() * h;
        g.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
      }
      /* 결 방향의 가는 주름 */
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 1;
      for (var y2 = 0; y2 < h; y2 += 5) {
        g.beginPath(); g.moveTo(0, y2); g.lineTo(w, y2 + 3); g.stroke();
      }
    }, { srgb: false, repeat: [4, 3] });
  }

  /* 그립 나선의 미세 주름 */
  function ribTexture() {
    return canvasDraw('rib', 64, 64, function (g, w, h) {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 4) {
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y, w, 1);
        g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, y + 1, w, 1);
      }
    }, { srgb: false, repeat: [1, 6] });
  }

  /* 스튜디오 환경맵 — 금속·카본이 비출 소프트박스 (등거리 원통) */
  function envTexture() {
    var t = canvasDraw('env', 1024, 512, function (g, w, h) {
      var base = g.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#243038');
      base.addColorStop(0.42, '#0b1116');
      base.addColorStop(0.72, '#06090c');
      base.addColorStop(1, '#0a0f12');
      g.fillStyle = base; g.fillRect(0, 0, w, h);

      function soft(cx, cy, rx, ry, a, col) {
        g.save();
        g.translate(cx, cy);
        g.scale(rx, ry);
        var rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0, 'rgba(' + col + ',' + a + ')');
        rg.addColorStop(0.45, 'rgba(' + col + ',' + (a * 0.42).toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = rg;
        g.beginPath(); g.arc(0, 0, 1, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      /* 위쪽 큰 키 소프트박스 · 좌우 림 스트립 · 바닥 반사 */
      soft(w * 0.50, h * 0.13, w * 0.30, h * 0.15, 0.98, '255,255,255');
      soft(w * 0.50, h * 0.28, w * 0.17, h * 0.07, 0.55, '255,255,255');
      soft(w * 0.06, h * 0.48, w * 0.10, h * 0.30, 0.60, '186,232,255');
      soft(w * 0.94, h * 0.44, w * 0.10, h * 0.26, 0.52, '255,226,186');
      soft(w * 0.50, h * 0.90, w * 0.60, h * 0.16, 0.20, '198,242,120');
      /* 얇은 하이라이트 스트립 두 줄 — 금속에 날카로운 반사 */
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(w * 0.33, h * 0.20, w * 0.012, h * 0.34);
      g.fillRect(w * 0.66, h * 0.22, w * 0.008, h * 0.26);
    }, { srgb: true });
    return t;
  }

  function particleTexture() {
    return canvasDraw('spr', 64, 64, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(0.35, 'rgba(255,255,255,0.75)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  function glowTexture(key, col) {
    return canvasDraw('glow_' + key, 128, 128, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      rg.addColorStop(0, 'rgba(' + col + ',0.95)');
      rg.addColorStop(0.4, 'rgba(' + col + ',0.35)');
      rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  /* 스튜디오 배경 — 가운데만 은은히 밝은 원형 그라데이션 */
  /* 불꽃 혀 텍스처 — 물방울 모양 그라데이션 (스프라이트라 어느 각도에서도 카메라를 봅니다) */
  function flameTexture() {
    return canvasDraw('flame', 128, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var grd = g.createRadialGradient(w / 2, h * 0.82, 1, w / 2, h * 0.66, h * 0.62);
      grd.addColorStop(0, 'rgba(255,240,190,0.95)');
      grd.addColorStop(0.22, 'rgba(255,170,60,0.78)');
      grd.addColorStop(0.55, 'rgba(255,95,25,0.34)');
      grd.addColorStop(1, 'rgba(255,60,10,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(w / 2, h * 0.03);
      g.bezierCurveTo(w * 0.88, h * 0.42, w * 0.80, h * 0.97, w / 2, h * 0.99);
      g.bezierCurveTo(w * 0.20, h * 0.97, w * 0.12, h * 0.42, w / 2, h * 0.03);
      g.fill();
    });
  }

  function backdropTexture() {
    return canvasDraw('backdrop', 512, 512, function (g, w, h) {
      g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
      var rg = g.createRadialGradient(w * 0.5, h * 0.38, 10, w * 0.5, h * 0.5, w * 0.62);
      rg.addColorStop(0, '#1d2f28');
      rg.addColorStop(0.45, '#101b17');
      rg.addColorStop(1, '#040607');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  function floorPoolTexture() {
    return canvasDraw('pool', 256, 256, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      rg.addColorStop(0, 'rgba(214,255,220,0.55)');
      rg.addColorStop(0.35, 'rgba(180,240,200,0.20)');
      rg.addColorStop(0.7, 'rgba(140,210,180,0.06)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  function contactShadowTexture() {
    return canvasDraw('contact', 256, 256, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      rg.addColorStop(0, 'rgba(0,0,0,0.78)');
      rg.addColorStop(0.45, 'rgba(0,0,0,0.42)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  function stencilTexture(id, color) {
    return canvasDraw('st_' + id + '_' + color, 256, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = color; g.fillStyle = color;
      g.lineWidth = 15; g.lineJoin = 'round'; g.lineCap = 'round';
      if (id === 'x') {
        /* X자 + 가운데 셔틀콕 */
        g.beginPath(); g.moveTo(58, 58); g.lineTo(198, 198);
        g.moveTo(198, 58); g.lineTo(58, 198); g.stroke();
      } else if (id === 'bolt') {
        g.beginPath();
        g.moveTo(150, 34); g.lineTo(78, 132); g.lineTo(124, 132);
        g.lineTo(104, 222); g.lineTo(182, 112); g.lineTo(134, 112);
        g.closePath(); g.fill();
      } else if (id === 'crown') {
        g.beginPath();
        g.moveTo(48, 176); g.lineTo(60, 74); g.lineTo(104, 128); g.lineTo(128, 58);
        g.lineTo(152, 128); g.lineTo(196, 74); g.lineTo(208, 176);
        g.closePath(); g.fill();
        g.fillRect(52, 184, 152, 16);
      } else if (id === 'shuttle') {
        g.beginPath(); g.arc(128, 78, 22, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.moveTo(104, 92); g.lineTo(54, 196); g.lineTo(202, 196); g.lineTo(152, 92);
        g.closePath();
        g.globalAlpha = 0.92; g.fill();
        g.globalAlpha = 1;
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
        for (var i = 1; i < 5; i++) {
          var t = i / 5;
          g.beginPath();
          g.moveTo(lerp(112, 68, t), lerp(100, 186, t));
          g.lineTo(lerp(144, 188, t), lerp(100, 186, t));
          g.stroke();
        }
      }
    });
  }

  /* 샤프트 각인 — 우리 앱 이름만 (실존 브랜드 없음) */
  function brandTexture() {
    return canvasDraw('brand', 512, 96, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      g.font = '700 54px system-ui, -apple-system, "Segoe UI", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = 'rgba(255,255,255,0.72)';
      g.fillText('SHUTTLIX', w / 2, h / 2 + 2);
    });
  }

  function rainbowTexture() {
    return canvasDraw('rainbow', 256, 16, function (g, w, h) {
      var lg = g.createLinearGradient(0, 0, w, 0);
      ['#ffd8a0', '#ffb3c7', '#c9b6ff', '#9fe8ff', '#b6ffcf', '#fff2a8', '#ffd8a0'].forEach(function (c, i, a) {
        lg.addColorStop(i / (a.length - 1), c);
      });
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    });
  }

  /* ============================================================
   * 2. 재질 — 매트 / 메탈릭 / 카본 / 타월의 대비를 실제로
   * ============================================================ */

  function frameMaterial(T, look) {
    var c = new T.Color(look.frame.color);
    var metal = look.frame.finish === 'metal';
    var mat = new T.MeshPhysicalMaterial({
      color: c,
      metalness: metal ? 0.96 : (look.frame.id === 'carbon' ? 0.45 : 0.14),
      roughness: metal ? 0.20 : (look.frame.id === 'white' ? 0.30 : 0.46),
      clearcoat: metal ? 0.45 : 0.40,
      clearcoatRoughness: metal ? 0.12 : 0.34,
      envMapIntensity: metal ? 2.0 : 1.15,
      bumpMap: carbonTexture(),
      bumpScale: metal ? 0.28 : 0.45,
      specularIntensity: metal ? 1.0 : 0.55,
      side: T.DoubleSide
    });
    if (metal) {
      mat.color = new T.Color('#12161c');
      mat.metalness = 1.0;
      mat.emissive = new T.Color(look.frame.shine || '#b8c8d8').multiplyScalar(0.015);
    }
    return mat;
  }

  function accentMaterial(T, hex, opts) {
    opts = opts || {};
    return new T.MeshPhysicalMaterial({
      color: new T.Color(hex || '#c6f24e'),
      metalness: opts.metal == null ? 0.75 : opts.metal,
      roughness: opts.rough == null ? 0.30 : opts.rough,
      clearcoat: 0.8, clearcoatRoughness: 0.14,
      emissive: new T.Color(hex || '#c6f24e'),
      emissiveIntensity: opts.glow == null ? 0.06 : opts.glow,
      envMapIntensity: 1.05, side: T.DoubleSide
    });
  }

  function stringMaterial(T, hex) {
    return new T.MeshStandardMaterial({
      color: new T.Color(hex || '#c6f24e'),
      metalness: 0.05, roughness: 0.50,
      emissive: new T.Color(hex || '#c6f24e'),
      emissiveIntensity: 0.40,
      envMapIntensity: 0.55,
      side: T.DoubleSide
    });
  }

  function gripMaterial(T, hex, weave) {
    var towel = weave === 'towel';
    return new T.MeshStandardMaterial({
      color: new T.Color(hex || '#1d2124'),
      metalness: 0.05,
      roughness: towel ? 0.96 : (weave === 'twotone' ? 0.58 : 0.74),
      bumpMap: towel ? towelTexture() : ribTexture(),
      bumpScale: towel ? 0.9 : 0.45,
      envMapIntensity: 0.8,
      side: T.DoubleSide
    });
  }

  /* ============================================================
   * 3. 지오메트리 — 헤드 단면 쓸기 · 스트링 리본 · 그립 나선
   * ============================================================ */

  /* 닫힌 점선을 부드럽게 — 꼭대기 이음매의 뾰족한 모서리를 둥글립니다 */
  /* 헤드 실루엣을 주기 Catmull-Rom 으로 다시 샘플링 — 이음매(정수리)가 뾰족하지 않게 */
  function closedLoop(profile, rx, ry, sub) {
    var ctrl = [], i;
    for (i = 1; i < profile.length; i++) ctrl.push({ x: profile[i][0] * rx, y: profile[i][1] * ry });
    for (i = profile.length - 1; i >= 1; i--) ctrl.push({ x: -profile[i][0] * rx, y: profile[i][1] * ry });
    var n = ctrl.length, per = sub || 4, out = [];
    for (i = 0; i < n; i++) {
      var p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      for (var s = 0; s < per; s++) {
        var t = s / per, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    return out;
  }

  function smoothLoop(pts, passes) {
    var cur = pts, p, i, n, a, b, out;
    for (p = 0; p < (passes || 2); p++) {
      out = [];
      n = cur.length;
      for (i = 0; i < n; i++) {
        a = cur[i]; b = cur[(i + 1) % n];
        out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      cur = out;
    }
    return cur;
  }

  /* 헤드 실루엣을 따라 단면(둥근 사각)을 쓸어 링을 만듭니다.
   * cfg.inward = 중심에서 안쪽으로 당기는 거리, halfW/halfT = 단면 반지름, boxy = 각진 정도 */
  function bandGeometry(T, pts, cfg) {
    cfg = cfg || {};
    var n = pts.length;
    var from = cfg.from == null ? 0 : cfg.from;
    var to = cfg.to == null ? n : cfg.to;
    var closed = cfg.closed !== false;
    var ring = cfg.ring || 14;
    var inward = cfg.inward || 0;
    var halfW = cfg.halfW || 5;
    var halfT = cfg.halfT || 3;
    var boxy = cfg.boxy || 3;
    /* 바깥쪽을 가르는 기준점 — 헤드 중심. 절대 좌표로 보면 y 오프셋에 휘말려
     * 단면이 바깥/안쪽으로 튀어 프레임이 끊겨 보입니다. */
    var cx0 = cfg.center ? cfg.center.x : 0;
    var cy0 = cfg.center ? cfg.center.y : 0;
    var pos = [], idx = [];
    var count = Math.max(2, to - from);
    var rows = closed ? count + 1 : count;
    for (var i = 0; i < rows; i++) {
      var ii = from + (closed ? (i % count) : i);
      var p = pts[((ii % n) + n) % n];
      var pPrev = pts[(((ii - 1) % n) + n) % n];
      var pNext = pts[((ii + 1) % n) % n];
      var tx = pNext.x - pPrev.x, ty = pNext.y - pPrev.y;
      var tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
      var nx = ty, ny = -tx;
      if (nx * (p.x - cx0) + ny * (p.y - cy0) < 0) { nx = -nx; ny = -ny; }   /* 바깥쪽 법선 */
      var cx = p.x - nx * inward, cy = p.y - ny * inward;
      for (var j = 0; j <= ring; j++) {
        var a = (j / ring) * Math.PI * 2;
        var ca = Math.cos(a), sa = Math.sin(a);
        var u = (ca < 0 ? -1 : 1) * Math.pow(Math.abs(ca), 2 / boxy);
        var v = (sa < 0 ? -1 : 1) * Math.pow(Math.abs(sa), 2 / boxy);
        pos.push(cx + nx * u * halfW, cy + ny * u * halfW, v * halfT);
      }
    }
    for (var r = 0; r < rows - 1; r++) {
      for (var k = 0; k < ring; k++) {
        var a0 = r * (ring + 1) + k, b0 = a0 + ring + 1;
        idx.push(a0, b0, b0 + 1, a0, b0 + 1, a0 + 1);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* 스트링 한 줄 — 가는 리본. 가운데가 살짝 볼록해 실제 줄처럼 보입니다 */
  function stringRibbon(T, pts, width, sag) {
    var pos = [], idx = [], n = pts.length, i;
    for (i = 0; i < n; i++) {
      var p = pts[i];
      var pp = pts[Math.max(0, i - 1)], pn = pts[Math.min(n - 1, i + 1)];
      var dx = pn.x - pp.x, dy = pn.y - pp.y;
      var dl = Math.sqrt(dx * dx + dy * dy) || 1;
      var ox = -dy / dl * width, oy = dx / dl * width;
      var z = (p.z || 0) + sag * Math.sin(Math.PI * (i / Math.max(1, n - 1)));
      pos.push(p.x + ox, p.y + oy, z, p.x - ox, p.y - oy, z);
    }
    for (i = 0; i < n - 1; i++) {
      var a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* 오버그립 나선 — 실제로 겹쳐 감긴 주름. 두 색(투톤)은 한 바퀴마다 색을 바꿉니다
   * (띠를 따로 만들면 이음매에서 삼각형이 끊겨 점선처럼 보여, 한 줄로 이어 붙이고 정점 색으로 칠합니다) */
  function gripSpiral(T, opts) {
    var radius = opts.radius;
    var y0 = opts.y0, len = opts.len;
    var pitch = opts.pitch || 12.5;
    var thick = opts.thick || 0.9;
    var half = pitch * 0.62;
    var turns = Math.max(3, Math.round(len / pitch));
    var steps = Math.max(36, turns * 20);
    var colors = opts.colors && opts.colors.length ? opts.colors : ['#1d2124'];
    var perBand = 3;                         /* 한 색이 이어지는 바퀴 수 */
    var group = new T.Group();
    var rail = [
      { dy: -half, r: radius },
      { dy: -half * 0.8, r: radius + thick },
      { dy: half * 0.8, r: radius + thick },
      { dy: half, r: radius }
    ];
    var buckets = [];
    for (var bi = 0; bi < colors.length; bi++) buckets.push({ pos: [], idx: [] });
    for (var s = 0; s <= steps; s++) {
      var t = s / steps;
      var ang = t * turns * Math.PI * 2;
      var yc = y0 + t * len;
      var seg = Math.floor(t * turns / (colors.length > 1 ? perBand : 1)) % colors.length;
      var b = buckets[seg];
      var first = b.pos.length === 0;
      var base = b.pos.length / 3;
      for (var k = 0; k < 4; k++) {
        var rr = rail[k].r;
        var aa = ang + rail[k].dy / Math.max(1, radius);
        b.pos.push(Math.cos(aa) * rr, yc + rail[k].dy, Math.sin(aa) * rr);
      }
      if (!first) {
        for (var e = 0; e < 4; e++) {
          var e2 = (e + 1) % 4;
          b.idx.push(base - 4 + e, base + e, base + e2, base - 4 + e, base + e2, base - 4 + e2);
        }
      }
    }
    for (var ci = 0; ci < buckets.length; ci++) {
      var bk = buckets[ci];
      if (!bk.pos.length || !bk.idx.length) continue;
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(bk.pos, 3));
      geo.setIndex(bk.idx);
      geo.computeVertexNormals();
      var mat = new T.MeshPhysicalMaterial({
        color: new T.Color(colors[ci]),
        metalness: 0.04,
        roughness: opts.roughness == null ? 0.88 : opts.roughness,
        bumpMap: opts.bump || ribTexture(),
        bumpScale: opts.bumpScale == null ? 0.3 : opts.bumpScale,
        envMapIntensity: 0.12,
        specularIntensity: 0.16,
        side: T.DoubleSide
      });
      var mesh = new T.Mesh(geo, mat);
      mesh.userData.slot = 'grip';
      group.add(mesh);
    }
    return group;
  }

  /* 테두리 안쪽 곡선 — 그로밋·거트 끝이 테두리에서 같은 간격이 되게 */
  function innerLoopOf(path, d, center) {
    var n = path.length, raw = [], i, a, b;
    for (i = 0; i < n; i++) {
      var p = path[i], pp = path[(i - 1 + n) % n], pn = path[(i + 1) % n];
      var tx = pn.x - pp.x, ty = pn.y - pp.y;
      var tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
      var nx = ty, ny = -tx;
      if (nx * (p.x - center.x) + ny * (p.y - center.y) < 0) { nx = -nx; ny = -ny; }
      raw.push({ x: p.x - nx * d, y: p.y - ny * d });
    }
    for (var pass = 0; pass < 2; pass++) {
      var next = [];
      for (i = 0; i < n; i++) {
        a = raw[(i - 1 + n) % n]; b = raw[(i + 1) % n];
        next.push({ x: a.x * 0.22 + raw[i].x * 0.56 + b.x * 0.22, y: a.y * 0.22 + raw[i].y * 0.56 + b.y * 0.22 });
      }
      raw = next;
    }
    return raw;
  }

  /* 가로·세로 줄이 헤드 안쪽 곡선과 만나는 두 점 */
  function chordAt(poly, axis, v) {
    var lo = 1e9, hi = -1e9, n = poly.length, i;
    for (i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var av = axis === 'v' ? a.x : a.y;
      var bv = axis === 'v' ? b.x : b.y;
      if ((av - v) * (bv - v) > 0) continue;
      if (Math.abs(bv - av) < 1e-6) continue;
      var t = (v - av) / (bv - av);
      if (t < -0.002 || t > 1.002) continue;
      var q = axis === 'v' ? a.y + (b.y - a.y) * t : a.x + (b.x - a.x) * t;
      if (q < lo) lo = q;
      if (q > hi) hi = q;
    }
    return hi - lo > 1 ? [lo, hi] : null;
  }

  /* 줄 한 가닥의 점들 — 가운데가 살짝 앞으로 불툭 */
  function linePts(x1, y1, x2, y2, sag, n) {
    var out = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n;
      out.push({ x: lerp(x1, x2, t), y: lerp(y1, y2, t), z: sag * Math.sin(Math.PI * t) });
    }
    return out;
  }

  /* ============================================================
   * 4. 라켓 모델 — 실제 규격(mm) 그대로
   * ============================================================ */

  /* 지금이 스매시 모드인지 꾸미기 모드인지 — 라켓 모듈에 물어봅니다 */
  function modeNow() {
    var R = RC();
    if (!R) return '';
    if (typeof R.stageModeGet === 'function') return R.stageModeGet();
    return R.stageMode || '';
  }

  function lookOf(ctx) {
    var R = RC();
    var st = ctx && ctx.store ? ctx.store.state : null;
    var c = R.customOf(st && st.me);
    var gm = R.geomOf(c);
    var level = R.conditionOf(st).level;
    var frameIt = R.itemOf('frame', c.frame) || {};
    var stringIt = R.itemOf('string', c.string) || {};
    var gripIt = R.itemOf('grip', c.grip) || {};
    var stencilIt = R.itemOf('stencil', c.stencil) || {};
    var charmIt = R.itemOf('charm', c.charm) || {};
    var effectIt = R.itemOf('effect', c.effect) || {};
    return {
      custom: c, gm: gm, level: level,
      frame: { id: c.frame, color: frameIt.color || '#23272b', finish: frameIt.finish || '', shine: frameIt.shine || '#cfd8e4' },
      string: { color: stringIt.color || '#c6f24e' },
      grip: { color: gripIt.color || '#1d2124', color2: gripIt.color2 || '', weave: gripIt.weave || '' },
      stencil: { id: c.stencil, color: stencilIt.color || '#f2c14e' },
      charm: { id: c.charm, color: charmIt.color || '#f2c14e' },
      effect: { id: c.effect, color: effectIt.color || '#c6f24e' },
      sig: [c.body, c.frame, c.string, c.grip, c.stencil, c.charm, c.effect, level].join('|')
    };
  }

  function buildRacket(T, look) {
    var R = RC();
    var gm = look.gm;
    var group = new T.Group();
    var gripLen = gm.gripLen, shaftLen = gm.shaftLen, cone = gm.cone, ry = gm.ry;
    var neckY = gripLen + shaftLen;        /* T 조인트(목) */
    var headCY = neckY + ry;               /* 헤드 중심 */
    var span = neckY + ry * 2;             /* 전체 길이 */
    var parts = {};

    /* --- ① 헤드 프레임 --- */
    var loop = smoothLoop(closedLoop(gm.profile, gm.rx, gm.ry, 3), 1);
    var path = [];
    for (var i = 0; i < loop.length; i++) path.push({ x: loop[i].x, y: loop[i].y + headCY });

    var aero = gm.id === 'aero', smashBody = gm.id === 'smash';
    var halfT = aero ? 2.55 : (smashBody ? 3.55 : 3.0);
    var frameGeo = bandGeometry(T, path, {
      inward: gm.hoop * 0.56, halfW: gm.hoop * 0.58, halfT: halfT,
      ring: 16, boxy: aero ? 3.8 : (smashBody ? 3.0 : 3.3),
      center: { x: 0, y: headCY }
    });
    var headMat = frameMaterial(T, look);
    var headMesh = new T.Mesh(frameGeo, headMat);
    headMesh.name = 'frame';
    headMesh.userData.slot = 'frame';
    group.add(headMesh);
    parts.head = headMesh;

    /* --- ② 그로밋(줄 구멍) — 테두리 안쪽에 작은 검은 구멍 테 --- */
    var gromMat = new T.MeshStandardMaterial({ color: new T.Color('#0d1013'), metalness: 0.75, roughness: 0.32 });
    var gromGeo = new T.CylinderGeometry(1.35, 1.35, 3.2, 8);
    var gromCount = Math.floor(path.length / 2);
    var grom = new T.InstancedMesh(gromGeo, gromMat, gromCount);
    var m4 = new T.Matrix4(), q4 = new T.Quaternion(), up = new T.Vector3(0, 1, 0), vv = new T.Vector3();
    var gi = 0;
    for (var k = 0; k < path.length && gi < gromCount; k += 2) {
      var p = path[k];
      var pp = path[(k - 1 + path.length) % path.length], pn = path[(k + 1) % path.length];
      var tx = pn.x - pp.x, ty = pn.y - pp.y;
      var tl = Math.sqrt(tx * tx + ty * ty) || 1; tx /= tl; ty /= tl;
      var nx = ty, ny = -tx;
      if (nx * p.x + ny * (p.y - headCY) < 0) { nx = -nx; ny = -ny; }
      vv.set(nx, ny, 0).normalize();
      q4.setFromUnitVectors(up, vv);
      m4.compose(new T.Vector3(p.x - nx * gm.hoop * 1.02, p.y - ny * gm.hoop * 1.02, 0), q4, new T.Vector3(1, 1, 1));
      grom.setMatrixAt(gi++, m4);
    }
    grom.count = gi;
    group.add(grom);

    /* --- ③ 데칼 — 12시 · 3시 · 9시 · T 조인트 (바디마다 다르게) --- */
    var accentMat = accentMaterial(T, gm.accent, { metal: 0.9, glow: 0.10 });
    var decalMat = new T.MeshPhysicalMaterial({
      color: new T.Color(smashBody ? '#e8eef6' : gm.accent),
      metalness: 0.55, roughness: 0.3, clearcoat: 0.8,
      emissive: new T.Color(gm.accent), emissiveIntensity: 0.10,
      envMapIntensity: 1.0, side: T.DoubleSide
    });
    var topIdx = 0, bestY = 1e9;
    for (var di = 0; di < path.length; di++) if (path[di].y < bestY) { bestY = path[di].y; topIdx = di; }
    var N = path.length;

    function decalBand(from, to, wid, mat, tHalf, box) {
      var geo = bandGeometry(T, path, {
        from: from, to: to, closed: false, inward: gm.hoop * 0.46,
        halfW: gm.hoop * 0.28, halfT: tHalf || (halfT + 0.12), ring: 12,
        boxy: box || 3.0, center: { x: 0, y: headCY }
      });
      var mesh = new T.Mesh(geo, mat);
      mesh.userData.slot = 'frame';
      mesh.name = 'decal';
      group.add(mesh);
      return mesh;
    }

    if (gm.decal === 'slash') {
      decalBand(topIdx - 4, topIdx + 4, 4, decalMat);
      decalBand(topIdx + Math.round(N * 0.25) - 2, topIdx + Math.round(N * 0.25) + 2, 3, accentMat);
      decalBand(topIdx - Math.round(N * 0.25) - 2, topIdx - Math.round(N * 0.25) + 2, 3, accentMat);
    } else if (gm.decal === 'ring') {
      decalBand(topIdx - 3, topIdx + 3, 4, decalMat);
      decalBand(topIdx + Math.round(N * 0.25) - 3, topIdx + Math.round(N * 0.25) + 3, 3, accentMat);
      decalBand(topIdx - Math.round(N * 0.25) - 3, topIdx - Math.round(N * 0.25) + 3, 3, accentMat);
    } else if (gm.decal === 'wing') {
      decalBand(topIdx - 5, topIdx + 5, 4, decalMat);
      decalBand(topIdx + Math.round(N * 0.25) - 5, topIdx + Math.round(N * 0.25) - 1, 3, accentMat);
      decalBand(topIdx - Math.round(N * 0.25) + 1, topIdx - Math.round(N * 0.25) + 5, 3, accentMat);
    } else {
      /* block — 각진 스매시 바디: 3·9시에 굵은 블록 */
      decalBand(topIdx - 2, topIdx + 2, 5, decalMat);
      decalBand(topIdx + Math.round(N * 0.25) - 6, topIdx + Math.round(N * 0.25) + 6, 4, accentMat);
      decalBand(topIdx - Math.round(N * 0.25) - 6, topIdx - Math.round(N * 0.25) + 6, 4, accentMat);
    }

    /* T 조인트 — 목 아래 작은 금속 판 */
    var tJoint = new T.Mesh(
      new T.BoxGeometry(gm.hoop * 1.5, 11, halfT * 2.1),
      new T.MeshPhysicalMaterial({
        color: new T.Color(look.frame.color), metalness: 0.85, roughness: 0.25,
        clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.5
      })
    );
    tJoint.position.set(0, neckY - 2.5, 0);
    tJoint.userData.slot = 'frame';
    group.add(tJoint);
    var tAcc = new T.Mesh(new T.BoxGeometry(gm.hoop * 1.55, 2.2, halfT * 2.25), accentMat);
    tAcc.position.set(0, neckY + 2.6, 0);
    tAcc.userData.slot = 'frame';
    group.add(tAcc);

    /* --- ④ 스트링(거트) — 헤드 안쪽 곡선에 꽉 차게, 줄 상태 반영 --- */
    var inner = innerLoopOf(path, gm.hoop * 1.16, { x: 0, y: headCY });
    var bedGroup = new T.Group();
    bedGroup.userData.slot = 'string';
    group.add(bedGroup);
    var sagZ = look.level === 'worn' ? 1.3 : 0;
    var mainMat = stringMaterial(T, look.string.color);
    var crossMat = stringMaterial(T, look.string.color);
    var mainPts = [], crossPts = [], si;
    var SX = gm.rx * 0.93, SY = gm.ry * 0.93;
    for (si = 0; si < 19; si++) {
      var sx = -SX + (si / 18) * SX * 2;
      var cv1 = chordAt(inner, 'v', sx);
      if (cv1) mainPts.push(linePts(sx, cv1[0], sx, cv1[1], sagZ, 7));
    }
    for (si = 0; si < 21; si++) {
      var sy = headCY - SY + (si / 20) * SY * 2;
      var cv2 = chordAt(inner, 'h', sy);
      if (cv2) crossPts.push(linePts(cv2[0], sy, cv2[1], sy, sagZ * 0.85, 7));
    }
    /* 줄이 끊긴 상태 — 가운데 세로 줄 한 가닥이 끊어져 양쪽 끝만 남습니다 */
    if (look.level === 'broken' && mainPts.length) {
      var cut = Math.floor(mainPts.length / 2);
      var line = mainPts[cut];
      var half = Math.floor(line.length / 2);
      var aHalf = line.slice(0, half), bHalf = line.slice(half + 1);
      if (aHalf.length > 1) aHalf[aHalf.length - 1].y -= 7;
      if (bHalf.length > 1) bHalf[0].y += 7;
      mainPts.splice(cut, 1, aHalf, bHalf);
    }
    crossPts.forEach(function (line, idx) {
      var mesh = new T.Mesh(stringRibbon(T, line, 0.30, 0), crossMat);
      mesh.position.z = (idx % 2 ? -0.28 : 0.28);
      bedGroup.add(mesh);
    });
    mainPts.forEach(function (line, idx) {
      if (!line || line.length < 2) return;
      var mesh = new T.Mesh(stringRibbon(T, line, 0.32, 0), mainMat);
      mesh.position.z = (idx % 2 ? 0.40 : -0.40);
      bedGroup.add(mesh);
    });
    parts.strings = bedGroup;
    parts.mainMat = mainMat;

    /* --- ⑤ 스텐실 — 거트에 찍힌 마크 --- */
    if (look.stencil.id && look.stencil.id !== 'none') {
      var sm = new T.MeshBasicMaterial({
        map: stencilTexture(look.stencil.id, look.stencil.color),
        transparent: true, opacity: 0.94, depthWrite: false, side: T.DoubleSide
      });
      var st = new T.Mesh(new T.PlaneGeometry(gm.rx * 0.86, gm.ry * 0.80), sm);
      st.position.set(0, headCY, 1.25);
      st.userData.slot = 'stencil';
      group.add(st);
      parts.stencil = st;
    }

    /* --- ⑥ 샤프트 — 6.8mm 슬림 테이퍼 카본 --- */
    var shaftBottom = gripLen + cone * 0.55;
    var shaftTop = neckY - 3;
    var shaftGeo = new T.CylinderGeometry(gm.shaftR * 1.12, gm.shaftR * 0.94, shaftTop - shaftBottom, 24, 1, false);
    var shaftMat = new T.MeshPhysicalMaterial({
      color: new T.Color('#101317'), metalness: 0.30, roughness: 0.30,
      clearcoat: 0.85, clearcoatRoughness: 0.10, envMapIntensity: 0.75,
      bumpMap: carbonTexture(), bumpScale: 0.25
    });
    var shaft = new T.Mesh(shaftGeo, shaftMat);
    shaft.position.y = (shaftTop + shaftBottom) / 2;
    shaft.scale.x = 1.04;
    shaft.userData.slot = 'grip';
    group.add(shaft);
    parts.shaft = shaft;

    /* 샤프트 각인 — 작게 */
    var brand = new T.Mesh(
      new T.PlaneGeometry(34, 6.4),
      new T.MeshBasicMaterial({ map: brandTexture(), transparent: true, opacity: 0.5, depthWrite: false })
    );
    brand.position.set(0, shaftBottom + (shaftTop - shaftBottom) * 0.42, gm.shaftR * 1.1);
    group.add(brand);

    /* --- ⑦ 콘(목 아래 삼각) --- */
    var conePts = [];
    for (var cpt = 0; cpt <= 10; cpt++) {
      var ct = cpt / 10;
      conePts.push(new T.Vector2(
        lerp(gm.gripR * 0.98, gm.shaftR * 1.45, easeInOut3(ct)),
        lerp(0, cone, ct)
      ));
    }
    var coneGeo = new T.LatheGeometry(conePts, 32);
    var coneMesh = new T.Mesh(coneGeo, new T.MeshPhysicalMaterial({
      color: new T.Color('#15181c'), metalness: 0.35, roughness: 0.34,
      clearcoat: 0.85, clearcoatRoughness: 0.14, envMapIntensity: 0.75,
      specularIntensity: 0.5
    }));
    coneMesh.position.y = gripLen;
    coneMesh.userData.slot = 'grip';
    group.add(coneMesh);
    parts.cone = coneMesh;

    /* 콘 위 얇은 포인트 링 */
    var ring = new T.Mesh(new T.TorusGeometry(gm.gripR * 0.99, 0.55, 8, 40), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = gripLen + 1.4;
    group.add(ring);

    /* --- ⑧ 손잡이 ---------- */
    var handle = new T.Mesh(
      new T.CylinderGeometry(gm.gripR * 0.86, gm.gripR * 0.92, gripLen - 4, 10, 1, false),
      new T.MeshPhysicalMaterial({
        color: new T.Color('#12151a'), metalness: 0.1, roughness: 0.9,
        envMapIntensity: 0.12, specularIntensity: 0.16, flatShading: true
      })
    );
    handle.position.y = (gripLen - 4) / 2 + 2;
    handle.userData.slot = 'grip';
    group.add(handle);

    /* 엔드캡 — 바닥의 작은 금속 링 */
    var cap = new T.Mesh(
      new T.CylinderGeometry(gm.gripR * 1.02, gm.gripR * 0.9, 4.5, 8),
      new T.MeshPhysicalMaterial({ color: new T.Color('#2a3038'), metalness: 0.95, roughness: 0.22, envMapIntensity: 1.6, flatShading: true })
    );
    cap.position.y = 1.6;
    cap.userData.slot = 'grip';
    group.add(cap);

    /* --- ⑨ 오버그립 나선 — 겹쳐 감긴 주름 + 마감 테이프 --- */
    var gripColors = [look.grip.color];
    if (look.grip.weave === 'twotone' && look.grip.color2) gripColors.push(look.grip.color2);
    var spiral = gripSpiral(T, {
      radius: gm.gripR * 0.97,
      y0: 5.5, len: gripLen - 12,
      pitch: 11.4, thick: 0.6,
      colors: gripColors,
      bump: look.grip.weave === 'towel' ? towelTexture() : ribTexture(),
      material: new T.MeshStandardMaterial({
        vertexColors: true, metalness: 0.05,
        roughness: look.grip.weave === 'towel' ? 0.96 : 0.6,
        bumpMap: look.grip.weave === 'towel' ? towelTexture() : ribTexture(),
        bumpScale: look.grip.weave === 'towel' ? 0.85 : 0.4,
        envMapIntensity: 0.32, side: T.DoubleSide
      })
    });
    group.add(spiral);
    parts.grip = spiral;

    var tape = new T.Mesh(
      new T.CylinderGeometry(gm.gripR * 0.99, gm.gripR * 0.99, 3.4, 10, 1, true),
      accentMaterial(T, look.grip.weave === 'twotone' ? look.grip.color2 || '#20252b' : look.grip.color, { metal: 0.2, rough: 0.55, glow: 0.02 })
    );
    tape.material.side = T.DoubleSide;
    tape.position.y = gripLen - 5.2;
    tape.userData.slot = 'grip';
    group.add(tape);

    /* --- ⑩ 참 — 목에 매달린 작은 장식 --- */
    var charmGroup = new T.Group();
    charmGroup.position.set(0, neckY - 6, 0);
    if (look.charm.id && look.charm.id !== 'none') {
      var cord = new T.Mesh(
        new T.CylinderGeometry(0.35, 0.35, 14, 6),
        new T.MeshStandardMaterial({ color: new T.Color('#2b3238'), metalness: 0.2, roughness: 0.8 })
      );
      cord.position.set(0, -7, 5);
      cord.rotation.x = 0.18;
      charmGroup.add(cord);
      var cmat = new T.MeshPhysicalMaterial({
        color: new T.Color(look.charm.color), metalness: 0.9, roughness: 0.22,
        clearcoat: 1, clearcoatRoughness: 0.1, emissive: new T.Color(look.charm.color),
        emissiveIntensity: 0.12, envMapIntensity: 1.5
      });
      var ch = null;
      if (look.charm.id === 'medal') {
        ch = new T.Group();
        var disc = new T.Mesh(new T.CylinderGeometry(4.4, 4.4, 0.9, 24), cmat);
        disc.rotation.x = Math.PI / 2;
        var rim = new T.Mesh(new T.TorusGeometry(4.4, 0.6, 8, 24), cmat);
        ch.add(disc); ch.add(rim);
      } else if (look.charm.id === 'attend30') {
        ch = new T.Mesh(new T.OctahedronGeometry(3.9, 0), cmat);
      } else if (look.charm.id === 'streak') {
        ch = new T.Mesh(new T.ConeGeometry(2.9, 7.2, 6), cmat);
        ch.rotation.x = Math.PI;
      } else {
        ch = new T.Group();
        var body = new T.Mesh(new T.CylinderGeometry(2.2, 3.2, 3.6, 5), cmat);
        var topS = new T.Mesh(new T.SphereGeometry(1.5, 12, 8), cmat);
        topS.position.y = 2.4;
        ch.add(body); ch.add(topS);
      }
      ch.position.set(0, -16.5, 6.5);
      ch.scale.setScalar(1.5);
      ch.userData.slot = 'charm';
      charmGroup.add(ch);
      parts.charm = ch;
    }
    group.add(charmGroup);

    /* --- ⑪ 효과(연출) — 헤드에 붙어 움직입니다 --- */
    var fxGroup = new T.Group();
    fxGroup.position.y = headCY;
    group.add(fxGroup);
    parts.fxGroup = fxGroup;
    parts.fx = buildEffect(T, fxGroup, look.effect, gm);

    group.userData.parts = parts;
    group.userData.headCY = headCY;
    group.userData.span = span;
    group.userData.gm = gm;
    return group;
  }

  /* ============================================================
   * 5. 효과(오라) — 스피드 링 · 스파크 · 블레이즈 · 프리즘 + 스매시 연출
   * ============================================================ */

  /* 파티클 하나의 크기는 '세계 단위'입니다. 카메라가 z≈1200~1600 에서 보므로
   * 예전 size 5~15 는 화면에서 1~3px 점으로 줄어 사실상 보이지 않았습니다.
   * (bm-v1.90.0) 화면 14~52px 에 해당하는 30~110 으로 올려 누가 봐도 보이게. */
  function pointCloud(T, count, size, color, map, opacity) {
    var pos = new Float32Array(count * 3);
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({
      size: size, map: map || particleTexture(), color: new T.Color(color),
      transparent: true, opacity: opacity == null ? 0.9 : opacity,
      blending: T.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      alphaTest: 0.02
    });
    return new T.Points(geo, mat);
  }

  /* #rrggbb → 'r,g,b' — 글로우 스프라이트 열쇠에 씁니다 */
  function hexRgb(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!isFinite(n)) return '255,255,255';
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  /* 번개 줄기 — 헤드 둘레에서 사방으로 갈라지는 지그재그 (값을 그 자리에서 다시 씁니다) */
  var BOLT_ARMS = 6, BOLT_SEG = 9;
  function boltFill(buf, rx, ry, seed, z) {
    var k = 0, a, s;
    for (a = 0; a < BOLT_ARMS; a++) {
      var ang = (a / BOLT_ARMS) * Math.PI * 2 + Math.sin(seed + a) * 0.5;
      var x0 = Math.cos(ang) * rx * 0.55, y0 = Math.sin(ang) * ry * 0.5;
      var x1 = Math.cos(ang) * rx * (1.5 + Math.abs(Math.sin(seed * 1.7 + a)) * 1.1);
      var y1 = Math.sin(ang) * ry * (1.4 + Math.abs(Math.cos(seed * 1.3 + a)) * 0.9);
      for (s = 0; s < BOLT_SEG; s++) {
        var t0 = s / BOLT_SEG, t1 = (s + 1) / BOLT_SEG;
        var jx = Math.sin(seed * 6.1 + a * 4.3 + s * 2.7) * 16;
        var jy = Math.cos(seed * 3.7 + a * 2.1 + s * 3.3) * 14;
        buf[k++] = x0 + (x1 - x0) * t0 + jx * t0;
        buf[k++] = y0 + (y1 - y0) * t0 + jy * t0;
        buf[k++] = z + Math.sin(seed + s) * 8;
        buf[k++] = x0 + (x1 - x0) * t1 + jx * t1;
        buf[k++] = y0 + (y1 - y0) * t1 + jy * t1;
        buf[k++] = z + Math.cos(seed + s) * 8;
      }
    }
    return buf;
  }

  function buildEffect(T, host, effect, gm) {
    var id = effect.id || 'none';
    var col = effect.color || '#c6f24e';
    var out = { id: id, bits: [] };
    var rx = gm.rx, ry = gm.ry;
    if (id === 'none') return out;

    /* 모든 효과 공통 — 헤드 뒤로 번지는 부드러운 광휘.
     * 검은 스튜디오 배경에서도 '효과를 입었다'는 게 한눈에 보이게 합니다. */
    var aura = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('fx_aura_' + id, hexRgb(col)), color: new T.Color(col),
      transparent: true, opacity: 0.42, blending: T.AdditiveBlending, depthWrite: false
    }));
    aura.scale.set(rx * 5.2, ry * 4.6, 1);
    aura.position.z = -22;
    host.add(aura);
    out.bits.push({ aura: aura, mode: 'aura', seed: 0, base: 0.42, aw: rx * 5.2, ah: ry * 4.6 });

    if (id === 'speed') {
      for (var i = 0; i < 4; i++) {
        var ring = new T.Mesh(
          new T.TorusGeometry(rx * (0.98 + i * 0.07), 1.5 - i * 0.16, 8, 72),
          new T.MeshBasicMaterial({
            color: new T.Color(col), transparent: true, opacity: 0.78 - i * 0.13,
            blending: T.AdditiveBlending, depthWrite: false
          })
        );
        ring.position.z = -3 - i * 2.6;
        ring.rotation.z = i * 0.4;
        host.add(ring);
        out.bits.push({ ring: ring, i: i });
      }
    } else if (id === 'spark') {
      var sp = pointCloud(T, 74, 40, col, glowTexture('spark', '159,216,255'), 0.95);
      host.add(sp);
      var arcGeo = new T.BufferGeometry();
      var arcBuf = new Float32Array(BOLT_ARMS * BOLT_SEG * 6);
      boltFill(arcBuf, rx, ry, 1.1, -14);
      arcGeo.setAttribute('position', new T.BufferAttribute(arcBuf, 3));
      var arc = new T.LineSegments(arcGeo,
        new T.LineBasicMaterial({
          color: new T.Color('#dff2ff'), transparent: true, opacity: 0.85,
          blending: T.AdditiveBlending, depthWrite: false
        }));
      arc.frustumCulled = false;
      host.add(arc);
      out.bits.push({ points: sp, mode: 'orbit', seed: 1, bolt: arc, boltSize: [rx, ry], boltAt: -1 });
    } else if (id === 'blaze') {
      var bl = pointCloud(T, 110, 64, col, glowTexture('blaze', '255,150,70'), 0.9);
      host.add(bl);
      var halo = new T.Mesh(
        new T.PlaneGeometry(rx * 3.8, ry * 3.2),
        new T.MeshBasicMaterial({
          map: glowTexture('halo', '255,140,60'), transparent: true, opacity: 0.42,
          blending: T.AdditiveBlending, depthWrite: false
        })
      );
      halo.position.z = -10;
      host.add(halo);
      var tongues0 = [];
      for (i = 0; i < 6; i++) {
        var cn0 = new T.Sprite(new T.SpriteMaterial({
          map: flameTexture(),
          color: new T.Color(i % 2 ? '#ffb347' : '#ff7a2f'),
          transparent: true, opacity: 0.62, blending: T.AdditiveBlending, depthWrite: false
        }));
        var a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
        cn0.position.set(Math.cos(a0) * rx * 0.74, Math.sin(a0) * ry * 0.58 - 12, -18);
        cn0.scale.set(28 + (i % 3) * 7, 58 + (i % 3) * 18, 1);
        host.add(cn0);
        tongues0.push(cn0);
      }
      out.bits.push({ points: bl, mode: 'rise', seed: 2, halo: halo, flames: tongues0 });
    } else if (id === 'prism') {
      var band = new T.Mesh(
        new T.TorusGeometry(rx * 1.04, 3.2, 10, 96),
        new T.MeshBasicMaterial({
          map: rainbowTexture(), transparent: true, opacity: 0.85,
          blending: T.AdditiveBlending, depthWrite: false
        })
      );
      band.position.z = -6;
      host.add(band);
      var band2 = new T.Mesh(
        new T.TorusGeometry(rx * 0.86, 2.2, 10, 80),
        new T.MeshBasicMaterial({
          map: rainbowTexture(), transparent: true, opacity: 0.55,
          blending: T.AdditiveBlending, depthWrite: false
        })
      );
      band2.position.z = -14;
      host.add(band2);
      var sparks = pointCloud(T, 46, 34, '#ffe9a8', glowTexture('prism', '255,233,168'), 0.9);
      host.add(sparks);
      out.bits.push({ ring: band, ring2: band2, points: sparks, mode: 'prism', seed: 3 });
    } else if (id === 'fire' || id === 'ice' || id === 'thunder') {
      var mapKey = id === 'fire' ? '255,150,70' : (id === 'ice' ? '170,230,255' : '160,215,255');
      var em = pointCloud(T, 96, 70, col, glowTexture('sm_' + id, mapKey), 0.95);
      host.add(em);
      out.bits.push({ points: em, mode: 'rise', seed: 4, riseH: 330 });

      if (id === 'fire') {
        /* 불꽃 혀 — 헤드 위로 살아 움직이는 주황 혀 6개 */
        var tongues = [];
        for (i = 0; i < 6; i++) {
          var cn = new T.Sprite(new T.SpriteMaterial({
            map: flameTexture(),
            color: new T.Color(i % 2 ? '#ffb347' : '#ff7a2f'),
            transparent: true, opacity: 0.52, blending: T.AdditiveBlending,
            depthWrite: false
          }));
          var af = (i / 6) * Math.PI * 2 - Math.PI / 2;
          cn.position.set(Math.cos(af) * rx * 0.94, Math.sin(af) * ry * 0.76 - 4, -26);
          cn.scale.set(32 + (i % 3) * 7, 68 + (i % 4) * 18, 1);
          host.add(cn);
          tongues.push(cn);
        }
        out.bits.push({ flames: tongues, mode: 'fire', seed: 11 });
      } else if (id === 'ice') {
        /* 얼음 결정 — 헤드 둘레를 천천히 도는 서리 조각 10개 + 서리 링 */
        var crystals = [];
        var iceMat = new T.MeshStandardMaterial({
          color: new T.Color('#e8fbff'), emissive: new T.Color('#4fbfe8'), emissiveIntensity: 1.1,
          metalness: 0.1, roughness: 0.06, transparent: true, opacity: 0.92, flatShading: true
        });
        for (i = 0; i < 12; i++) {
          var cr = new T.Mesh(new T.OctahedronGeometry(6 + (i % 3) * 2.4, 0), iceMat);
          /* 길쭉한 얼음 조각 — 종잇조각처럼 보이지 않게 */
          cr.scale.set(0.55, 1.9 + (i % 3) * 0.5, 0.55);
          host.add(cr);
          crystals.push(cr);
        }
        var frost = new T.Mesh(new T.TorusGeometry(rx * 1.04, 1.8, 8, 88),
          new T.MeshBasicMaterial({
            color: new T.Color('#a9e8ff'), transparent: true, opacity: 0.7,
            blending: T.AdditiveBlending, depthWrite: false
          }));
        frost.position.z = -10;
        host.add(frost);
        out.bits.push({ crystals: crystals, frost: frost, mode: 'ice', seed: 12 });
      } else {
        /* 번개 — 헤드에서 사방으로 갈라지는 지그재그 줄기 + 파란 코어 */
        var boltGeo = new T.BufferGeometry();
        var boltBuf = new Float32Array(BOLT_ARMS * BOLT_SEG * 6);
        boltFill(boltBuf, rx, ry, 1.3, -10);
        boltGeo.setAttribute('position', new T.BufferAttribute(boltBuf, 3));
        var bolt = new T.LineSegments(boltGeo, new T.LineBasicMaterial({
          color: new T.Color('#d8efff'), transparent: true, opacity: 0.95,
          blending: T.AdditiveBlending, depthWrite: false
        }));
        bolt.frustumCulled = false;
        host.add(bolt);
        var core = new T.Sprite(new T.SpriteMaterial({
          map: glowTexture('sm_thunder_core', '160,215,255'), color: new T.Color('#bfe4ff'),
          transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false
        }));
        core.scale.set(rx * 2.6, ry * 2.4, 1);
        core.position.z = -16;
        host.add(core);
        out.bits.push({ bolt: bolt, boltAt: -1, boltSize: [rx, ry], core: core, mode: 'thunder', seed: 13 });
      }
    }
    return out;
  }

  function animateEffect(fx, t) {
    if (!fx || !fx.bits) return;
    var i, k;
    for (i = 0; i < fx.bits.length; i++) {
      var b = fx.bits[i];
      if (b.aura) {
        var ap = 1 + Math.sin(t * 1.9) * 0.055;
        b.aura.material.opacity = (b.base || 0.4) + Math.sin(t * 2.1) * 0.11;
        b.aura.scale.set((b.aw || 480) * ap, (b.ah || 430) * ap, 1);
      }
      if (b.ring) {
        b.ring.rotation.z = t * (0.6 + (b.i || 0) * 0.25);
        b.ring.material.opacity = (b.mode === 'prism' ? 0.7 : 0.6) + Math.sin(t * 2.4 + (b.i || 0)) * 0.16;
      }
      if (b.ring2) b.ring2.rotation.z = -t * 0.5;
      if (b.halo) b.halo.material.opacity = 0.32 + Math.sin(t * 3.1) * 0.1;
      if (b.flames) {
        for (k = 0; k < b.flames.length; k++) {
          var fl = b.flames[k];
          if (!fl.userData.base) fl.userData.base = [fl.scale.x, fl.scale.y];
          var bs = fl.userData.base;
          var wob = 1 + Math.sin(t * 7.4 + k * 1.7) * 0.16 + Math.sin(t * 3.1 + k) * 0.08;
          fl.scale.set(bs[0] * (1 + (wob - 1) * 0.5), bs[1] * wob, 1);
          fl.position.y += Math.sin(t * 6.2 + k * 2.1) * 0.6;
          fl.material.opacity = 0.68 + Math.sin(t * 11 + k * 2) * 0.18;
        }
      }
      if (b.crystals) {
        for (k = 0; k < b.crystals.length; k++) {
          var cr0 = b.crystals[k];
          var ang0 = t * 0.55 + (k / b.crystals.length) * Math.PI * 2;
          var rad0 = 1.35 + Math.sin(t * 1.3 + k) * 0.12;
          cr0.position.set(Math.cos(ang0) * 110 * rad0, Math.sin(ang0) * 128 * rad0 - 6,
            -18 + Math.sin(ang0 * 1.7) * 42);
          cr0.rotation.set(t * (0.6 + k * 0.05), t * (0.8 + k * 0.04), 0);
          cr0.scale.setScalar(0.9 + Math.sin(t * 3.4 + k) * 0.18);
        }
      }
      if (b.frost) {
        b.frost.rotation.z = t * 0.4;
        b.frost.material.opacity = 0.55 + Math.sin(t * 2.7) * 0.2;
      }
      if (b.core) b.core.material.opacity = 0.45 + Math.sin(t * 8.5) * 0.22;
      if (b.bolt) {
        /* 80ms 마다 줄기를 새로 뽑아 '찌지직' 떨리는 느낌 */
        var pa = b.bolt.geometry && b.bolt.geometry.attributes.position;
        if (pa && t - b.boltAt > 0.08) {
          b.boltAt = t;
          var arr = pa.array;
          var seedv = 1.7 + Math.floor(t * 12) * 0.37;
          if (b.boltSize) boltFill(arr, b.boltSize[0], b.boltSize[1], seedv, -10);
          else boltFill(arr, 96, 118, seedv, -14);
          pa.needsUpdate = true;
        }
        b.bolt.material.opacity = 0.55 + Math.abs(Math.sin(t * 21)) * 0.45;
      }
      if (b.points) {
        var p = b.points.geometry.attributes.position;
        var n = p.count;
        var spreadMul = b.riseH ? b.riseH / 240 : 1;
        for (k = 0; k < n; k++) {
          var seed = k * 12.9898 + (b.seed || 1) * 78.233;
          var r1 = Math.abs(Math.sin(seed)) % 1;
          var r2 = Math.abs(Math.sin(seed * 1.7)) % 1;
          var r3 = Math.abs(Math.sin(seed * 2.3)) % 1;
          if (b.mode === 'orbit' || b.mode === 'prism') {
            var ang = t * (0.5 + r1 * 0.9) + r1 * Math.PI * 2;
            var rad = 118 + r2 * 62;
            p.setXYZ(k, Math.cos(ang) * rad, Math.sin(ang) * rad * 0.95, -20 + Math.sin(ang * 1.7) * 46);
          } else {
            var life = ((t * (0.28 + r3 * 0.3) + r1) % 1);
            var y = (-110 + life * 240) * (spreadMul > 1 ? 1.25 : 1);
            var spread = 1 - life * 0.55;
            p.setXYZ(k, (r2 - 0.5) * 210 * spread + Math.sin(t * 2 + r3 * 6) * 12,
              y, (r3 - 0.5) * 84);
          }
        }
        p.needsUpdate = true;
      }
    }
  }

  /* ============================================================
   * 6. 셔틀콕 — 코르크 반구 + 밴드 + 깃 16장
   * ============================================================ */

  function buildShuttle(T) {
    var g = new T.Group();
    var corkMat = new T.MeshStandardMaterial({ color: new T.Color('#f2e6cf'), roughness: 0.55, metalness: 0.05 });
    var bandMat = new T.MeshStandardMaterial({ color: new T.Color('#c9b48f'), roughness: 0.4, metalness: 0.08 });
    var featherMat = new T.MeshStandardMaterial({
      color: new T.Color('#f7fbf7'), roughness: 0.72, metalness: 0.0,
      side: T.DoubleSide, transparent: true, opacity: 0.96
    });
    var cork = new T.Mesh(new T.SphereGeometry(6.4, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), corkMat);
    cork.rotation.x = Math.PI;   /* 반구가 아래(코르크)로 */
    g.add(cork);
    var band = new T.Mesh(new T.CylinderGeometry(6.2, 6.4, 2.4, 20), bandMat);
    band.position.y = -2.2;
    g.add(band);

    /* 깃 16장 — 실제 셔틀콕처럼 원뿔 깔때기(약 26°)로 퍼지게 */
    var N = 16, i;
    var shape = new T.Shape();
    shape.moveTo(-4.3, 0);
    shape.quadraticCurveTo(-5.4, 30, -3.6, 62);
    shape.lineTo(3.6, 62);
    shape.quadraticCurveTo(5.4, 30, 4.3, 0);
    shape.closePath();
    var featherGeo = new T.ShapeGeometry(shape, 8);
    var upV = new T.Vector3(0, 1, 0);
    var tilt = 0.55;
    for (i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2;
      var out = new T.Vector3(Math.cos(a), 0, Math.sin(a));
      var axis = out.clone().multiplyScalar(Math.sin(tilt)).add(new T.Vector3(0, Math.cos(tilt), 0)).normalize();
      var zAxis = out.clone().sub(axis.clone().multiplyScalar(out.dot(axis))).normalize();
      var xAxis = new T.Vector3().crossVectors(axis, zAxis).normalize();
      var mat4 = new T.Matrix4().makeBasis(xAxis, axis, zAxis);
      var m = new T.Mesh(featherGeo, featherMat);
      m.quaternion.setFromRotationMatrix(mat4);
      m.position.copy(out).multiplyScalar(4.6);
      g.add(m);
    }
    /* 두 줄 스티치 링 */
    var stitch = new T.Mesh(
      new T.TorusGeometry(15.5, 0.5, 6, 40),
      new T.MeshBasicMaterial({ color: new T.Color('#dfe7e2'), transparent: true, opacity: 0.55 })
    );
    stitch.rotation.x = Math.PI / 2;
    stitch.position.y = 26;
    g.add(stitch);
    g.scale.setScalar(1.0);
    g.userData.cork = cork;
    return g;
  }

  /* ============================================================
   * 7. create() — 씬 · 조명 · 조작 · 애니메이션
   * ============================================================ */

  function available() {
    if (webglProbe != null) return webglProbe;
    if (!hasDom || !engine()) { webglProbe = false; return false; }
    try {
      var cv = document.createElement('canvas');
      var gl = cv.getContext('webgl2') || cv.getContext('webgl') || cv.getContext('experimental-webgl');
      webglProbe = !!gl;
      if (gl && gl.getExtension) {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    } catch (e) { webglProbe = false; }
    return webglProbe;
  }

  /* 색 관리 — 캔버스에 지정한 색(#c6f24e 같은 실제 색)이 화면에서도 같은 색으로 나오게.
   *  이걸 켜지 않으면 색을 선형값으로 읽어 밝고 탈색된 회색빛으로 보입니다. */
  function setupColor(T) {
    try {
      if (T.ColorManagement && T.ColorManagement.legacyMode !== undefined) T.ColorManagement.legacyMode = false;
      else if (T.ColorManagement && 'enabled' in T.ColorManagement) T.ColorManagement.enabled = true;
    } catch (e) { /* 무시 */ }
  }

  function create(host, ctx) {
    var T = engine();
    if (!T || !hasDom || !host || !available()) return null;
    setupColor(T);
    var cv = host.querySelector('.rk3d__cv');
    if (!cv) return null;
    var R = RC();
    if (!R) return null;

    var renderer;
    try {
      renderer = new T.WebGLRenderer({
        canvas: cv, antialias: true, alpha: true,
        powerPreference: 'high-performance', preserveDrawingBuffer: true
      });
    } catch (e) { return null; }
    if (!renderer) return null;

    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    var scene = new T.Scene();
    scene.background = null;
    var env = envTexture();
    if (env) {
      env.mapping = T.EquirectangularReflectionMapping;
      scene.environment = env;
    }

    var camera = new T.PerspectiveCamera(27, 1, 20, 9000);
    camera.position.set(0, 0, 1600);

    /* --- 스튜디오 조명 (키 · 림 · 필 + 바닥 반사) --- */
    scene.add(new T.HemisphereLight(0x9fc6c0, 0x05080a, 0.55));
    var key = new T.DirectionalLight(0xffffff, 1.9);
    key.position.set(420, 620, 900);
    scene.add(key);
    var rim = new T.DirectionalLight(0xbfe6ff, 1.3);
    rim.position.set(-700, 260, -820);
    scene.add(rim);
    var fill = new T.DirectionalLight(0xffdcb4, 0.55);
    fill.position.set(520, -260, 520);
    scene.add(fill);
    var top = new T.DirectionalLight(0xffffff, 0.6);
    top.position.set(0, 1200, 200);
    scene.add(top);
    /* 뒤쪽 양옆 림 — 프레임 가장자리에 얇은 빛 테두리를 만듭니다 (제품 사진의 '윤곽광') */
    var rimL = new T.DirectionalLight(0xd8f0ff, 2.6);
    rimL.position.set(-900, 420, -520);
    scene.add(rimL);
    var rimR = new T.DirectionalLight(0xffeccf, 2.0);
    rimR.position.set(880, 260, -460);
    scene.add(rimR);
    /* 정면 위 소프트 스트립 — 카본·글래스에 길게 흐르는 하이라이트 */
    var strip = new T.DirectionalLight(0xffffff, 1.1);
    strip.position.set(-260, 980, 700);
    scene.add(strip);

    /* --- 배경 · 바닥 스포트라이트 · 접지 그림자 --- */
    var back = new T.Mesh(
      new T.PlaneGeometry(5200, 4200),
      new T.MeshBasicMaterial({ map: backdropTexture(), depthWrite: false })
    );
    back.position.set(0, 200, -1500);
    scene.add(back);

    /* 라켓 뒤 은은한 헤일로 — 검은 프레임의 실루엣이 배경에 묻히지 않게 */
    var halo = new T.Mesh(
      new T.PlaneGeometry(2600, 2600),
      new T.MeshBasicMaterial({
        map: glowTexture('halo_back', '150,220,205'), transparent: true, opacity: 0.16,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    halo.position.set(0, 40, -700);
    scene.add(halo);

    var rootG = new T.Group();
    scene.add(rootG);
    var airG = new T.Group();
    rootG.add(airG);
    var aimG = new T.Group();
    airG.add(aimG);
    var swingG = new T.Group();
    aimG.add(swingG);
    var modelG = new T.Group();
    swingG.add(modelG);

    var spec = { span: 675, headCY: 500, rx: 98, ry: 120 };
    var looksig = '', parts = null;
    var floorY = -360;

    var shadow = new T.Mesh(
      new T.PlaneGeometry(760, 300),
      new T.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, opacity: 0.85, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -352, 0);
    scene.add(shadow);

    var pool = new T.Mesh(
      new T.PlaneGeometry(1000, 1000),
      new T.MeshBasicMaterial({
        map: floorPoolTexture(), transparent: true, opacity: 0.5,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, -350, 0);
    scene.add(pool);

    var poolRing = new T.Mesh(
      new T.RingGeometry(196, 208, 80),
      new T.MeshBasicMaterial({
        color: new T.Color('#d8ffd0'), transparent: true, opacity: 0.14,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    poolRing.rotation.x = -Math.PI / 2;
    poolRing.position.set(0, -349, 0);
    scene.add(poolRing);

    /* --- 셔틀콕 · 궤적 · 파티클 (스매시 연출) --- */
    var shuttle = buildShuttle(T);
    shuttle.visible = false;
    scene.add(shuttle);
    /* 셔틀콕의 비행 축 — 모델은 깃이 +y, 코르크가 -y 이므로 -y 를 나아가는 쪽에 맞춥니다 */
    var FLY_AXIS = new T.Vector3(0, -1, 0);

    var trail = null, trailCore = null;
    /* 정타 파티클 — 예전 size 5 는 화면 1px 점이라 보이지 않았습니다 (bm-v1.90.0: 36) */
    var BURST_N = 130;
    var burst = pointCloud(T, BURST_N, 36, '#ffffff', particleTexture(), 0.95);
    burst.visible = false;
    scene.add(burst);
    var burstVel = new Float32Array(BURST_N * 3);
    var burstCol = null;

    /* 정타 3D 충격파 — 카메라를 향해 퍼지는 토러스 2겹 + 사방으로 뻗는 빛살 */
    var shock = new T.Mesh(
      new T.TorusGeometry(1, 0.055, 10, 96),
      new T.MeshBasicMaterial({
        color: new T.Color('#ffffff'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    shock.visible = false;
    scene.add(shock);
    var shock2 = new T.Mesh(
      new T.TorusGeometry(1, 0.032, 8, 96),
      new T.MeshBasicMaterial({
        color: new T.Color('#ffffff'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    shock2.visible = false;
    scene.add(shock2);
    var RAY_N = 20;
    var rays = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: new T.Color('#ffffff'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    rays.frustumCulled = false;
    rays.visible = false;
    scene.add(rays);
    var rayBuf = new Float32Array(RAY_N * 6);
    var rayAng = new Float32Array(RAY_N);
    for (var ri = 0; ri < RAY_N; ri++) rayAng[ri] = Math.random() * Math.PI * 2;
    /* 충격점에서 활짝 터지는 큰 광휘 */
    var impactGlow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('impact_glow', '255,240,200'), transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    impactGlow.visible = false;
    scene.add(impactGlow);

    /* 셔틀콕 꼬리 — 날아올 때와 발사될 때 뒤로 늘어지는 잔상 */
    var SH_N = 34;
    var shuttleTrail = pointCloud(T, SH_N, 30, '#ffffff', glowTexture('sh_trail', '220,245,255'), 0.6);
    shuttleTrail.visible = false;
    scene.add(shuttleTrail);
    var shHist = [];
    /* 발사 속도선 — 타점에서 나가는 방향으로 뻗는 가는 선 */
    var SPEED_N = 18;
    var speedLines = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: new T.Color('#eaffd0'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    speedLines.frustumCulled = false;
    speedLines.visible = false;
    scene.add(speedLines);
    var speedBuf = new Float32Array(SPEED_N * 6);
    /* 날아오는 길 안내선 — 셔틀이 어디서 오는지 한눈에 */
    var inGuide = new T.Line(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: new T.Color('#dff3ff'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      })
    );
    inGuide.frustumCulled = false;
    inGuide.visible = false;
    scene.add(inGuide);

    /* 정타 섬광 — 카메라를 항상 바라보는 스프라이트(네모로 보이지 않게) */
    var flash = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('hitflash', '255,255,240'), transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    flash.visible = false;
    scene.add(flash);

    /* 강타 — 바닥 충격 링 · 균열 · 먼지 */
    var slamRing = new T.Mesh(
      new T.RingGeometry(0.7, 1, 72),
      new T.MeshBasicMaterial({
        color: new T.Color('#e6fff0'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    slamRing.rotation.x = -Math.PI / 2;
    slamRing.visible = false;      /* 바닥 강타에서만 (공중 스매시에 큰 링이 남지 않게) */
    scene.add(slamRing);
    var slamCrack = new T.LineSegments(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({ color: new T.Color('#c9ffe2'), transparent: true, opacity: 0 })
    );
    scene.add(slamCrack);
    var debris = pointCloud(T, 90, 34, '#dff6e8', particleTexture(), 0.9);
    debris.visible = false;
    scene.add(debris);
    var debrisVel = new Float32Array(90 * 3);

    /* --- 스매시·모션 상태 --- */
    var smashOn = false, smashAt = 0, smashFx = '', smashKind = 'air';
    var impactOn = false;      /* 이번 스매시의 정타 연출이 이미 터졌는지 */
    var motionKind = '', motionAt = 0, motionOn = false;
    var holdAt = null;
    var hitPos = new T.Vector3(0, 60, 120);
    var launchDir = new T.Vector3(0.2, -0.9, 0.5).normalize();
    /* 셔틀이 실제로 날아오는 시작점·방향 (bm-v1.90.0 — 방향을 눈으로 읽게) */
    var inStart = new T.Vector3(-560, 540, -880);
    var inCtrl = new T.Vector3(-170, 430, -250);
    var inDir = new T.Vector3(0, 0, 1);
    var aimYaw = 0, aimPitch = 0;
    /* 히트스톱 — 기존 30ms 위에 한 박자 더 (정타 순간이 '멈칫' 하고 박힘) */
    var EXTRA_STOP = 58;
    var lastMove = 0, idlePhase = 0;
    var vel = { yaw: 0, pitch: 0 };
    var drag = null;
    var alive = true, raf = 0, ready = false;
    var estars = null;

    /* --- 모델 만들기/갱신 --- */
    function rebuild() {
      var look = lookOf(ctx);
      if (look.sig === looksig && parts) return look;
      looksig = look.sig;
      var old = modelG.children.slice();
      for (var i = 0; i < old.length; i++) modelG.remove(old[i]);
      if (parts && parts.gm && modelG.userData.dispose) { /* noop */ }
      var g = buildRacket(T, look);
      modelG.add(g);
      spec = { span: g.userData.span, headCY: g.userData.headCY, rx: g.userData.gm.rx, ry: g.userData.gm.ry };
      parts = g.userData.parts;
      parts.model = g;
      modelG.position.y = -spec.span / 2;   /* 라켓 가운데를 회전축으로 */
      floorY = -spec.span / 2 - 16;
      shadow.position.y = floorY + 6;
      pool.position.y = floorY + 8;
      poolRing.position.y = floorY + 9;
      airG.position.y = 0;
      fitCamera();
      return look;
    }

    function fitCamera() {
      var w = Math.max(120, cv.clientWidth || 340);
      var h = Math.max(160, cv.clientHeight || 322);
      renderer.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var vfov = camera.fov * Math.PI / 180;
      var tan = Math.tan(vfov / 2);
      var distH = (spec.span * 0.515) / tan;
      var distW = (spec.span * 0.34) / (tan * camera.aspect);
      camera.position.set(0, 0, Math.max(distH, distW) * 1.02);
      camera.userData.baseZ = camera.position.z;
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }

    /* --- 날아오는 방향·타점 — 임팩트 자세에서 실제 헤드 위치를 잽니다 --- */
    var tmpO = new T.Object3D();
    function poseAt(ms, kind) {
      var RCx = RC();
      var c = RCx.smashClock(ms);
      var WIND = RCx.WIND_MS, HIT = RCx.HIT_AT, END = RCx.SMASH_MS;
      var out = { rx: 0, ry: 0, rz: 0, py: 0, pz: 0 };
      if (kind === 'slam') {
        if (c < WIND) {
          var e0 = easeOut3(c / WIND);
          out.rx = -0.72 * e0; out.rz = -0.22 * e0; out.ry = -0.26 * e0;
          out.py = -18 * e0;
        } else if (c < HIT) {
          var u0 = easeIn3((c - WIND) / (HIT - WIND));
          out.rx = lerp(-0.72, 1.68, u0);
          out.rz = lerp(-0.22, 0.30, u0);
          out.ry = lerp(-0.26, 0.48, u0);
          out.py = lerp(-18, -54, u0);
          out.pz = lerp(0, 46, u0);
        } else {
          var v0 = clamp01((c - HIT) / (END - HIT));
          var back0 = easeOut3(clamp01(v0 * 1.5));
          out.rx = lerp(1.68, 0, back0);
          out.rz = lerp(0.30, 0, back0);
          out.ry = lerp(0.48, 0, back0);
          out.py = lerp(-54, 0, back0);
          out.pz = lerp(46, 0, back0);
        }
        return out;
      }
      if (c < WIND) {
        /* ① 깊은 백스윙 — 라켓 머리가 뒤·위로 크게 젖혀지고 손목이 코킹됩니다 */
        var e = easeOut3(c / WIND);
        out.rx = -0.62 * e;
        out.rz = -0.46 * e;
        out.ry = -0.68 * e;
        out.py = 26 * e;
        out.pz = -58 * e;
      } else if (c < HIT) {
        /* ② 폭발적인 풀스윙 — 끝에서 확 빨라지는 채찍(지수 2.2) + 손목 회내(프로네이션) */
        var u = Math.pow(clamp01((c - WIND) / (HIT - WIND)), 2.2);
        out.rx = lerp(-0.62, 0.74, u);
        out.rz = lerp(-0.46, 0.62, u);
        out.ry = lerp(-0.68, 0.66, u);      /* 손목 회내(프로네이션) */
        out.py = lerp(26, -56, u);
        out.pz = lerp(-58, 46, u);
      } else {
        /* ③ 팔로스루 — 맞은 뒤 손목이 더 돌아가고, 몸이 따라 흐른 뒤 제자리 */
        var v = clamp01((c - HIT) / (END - HIT));
        var back = easeOut3(clamp01(v * 1.6));
        var over = Math.sin(clamp01(v * 2.6) * Math.PI) * 0.07;
        out.rx = lerp(0.88, 0, back) + over;
        out.rz = lerp(0.74, 0, back);
        out.ry = lerp(0.82, 0, back);
        out.py = lerp(-56, 0, back);
        out.pz = lerp(46, 0, back);
      }
      return out;
    }

    /* 스매시 자세 — 보통은 라켓 가운데를 축으로(화면 안에 남게),
     * 바닥 강타는 손잡이 끝을 축으로 해서 머리가 코트를 향해 내려꽂힙니다. */
    function applySwing(pose, kind) {
      swingG.rotation.set(pose.rx, pose.ry, pose.rz, 'YXZ');
      if (kind === 'slam') {
        modelG.position.y = 0;
        swingG.position.set(0, -spec.span / 2 + pose.py, pose.pz);
      } else {
        modelG.position.y = -spec.span / 2;
        swingG.position.set(0, pose.py, pose.pz);
      }
    }

    function headWorld(ms, kind) {
      var pose = poseAt(ms, kind);
      applySwing(pose, kind);
      rootG.updateMatrixWorld(true);
      var p = new T.Vector3(0, spec.headCY, 0);
      p.applyMatrix4(parts.model.matrixWorld);
      return p;
    }

    function resetPose() {
      swingG.rotation.set(0, 0, 0);
      swingG.position.set(0, 0, 0);
      modelG.position.y = -spec.span / 2;
    }

    function prepareSmash(kind) {
      var RCx = RC();
      resetPose();
      aimG.rotation.set(viewMem.pitch, viewMem.yaw, 0);
      aimG.updateMatrixWorld(true);
      hitPos = headWorld(RCx.HIT_AT, kind);
      var pal0 = RCx.smashPalette(smashFx || 'none') || {};
      /* 셔틀이 실제로 날아오는 길 — 코트 앞쪽 위 대각선에서 타점까지 */
      inStart.set(-560, 540, -880);
      inCtrl.set(-180, 430, -250);
      if (kind === 'slam') { inStart.set(-420, 620, -760); inCtrl.set(-150, 500, -240); }
      inDir.copy(hitPos).sub(inStart).normalize();
      /* 라켓은 셔틀이 오는 쪽을 마주 봅니다 (그 방향으로 세게 치는 맛) */
      aimYaw = clampN(-inDir.x * 0.62, -0.5, 0.5);
      aimPitch = clampN(-inDir.y * 0.30, -0.26, 0.26);
      /* 나가는 방향 — 들어온 축을 뒤집어 코트 아래 대각선으로 꽂습니다 */
      launchDir.set(-inDir.x * 0.55 - 0.30, -Math.abs(inDir.y) * 0.55 - 0.92, 0.46).normalize();
      shuttle.visible = kind !== 'slam';
      shuttle.position.copy(hitPos);
      shuttle.rotation.set(0, 0, 0);
      shuttle.scale.setScalar(1);      /* 지난 연출의 확대가 남지 않게 */
      shHist = [];
      /* 스윙 궤적 리본 — 실제 헤드가 지나온 자리 */
      buildTrail(kind);
      /* 날아오는 길 안내선 */
      buildGuide(kind);
      /* 파티클·충격파 색 */
      burstCol = new T.Color(pal0.mid || pal0.hot || '#ffffff');
      burst.material.color = burstCol;
      burst.material.map = particleTexture();
      flash.material.map = glowTexture('hitflash', smashFx === 'ice' ? '200,240,255'
        : (smashFx === 'thunder' ? '200,225,255' : (smashFx === 'fire' ? '255,225,170' : '235,255,190')));
      var ringCol = new T.Color(pal0.ring || pal0.hot || '#ffffff');
      shock.material.color = ringCol;
      shock2.material.color = new T.Color(pal0.core || '#ffffff');
      rays.material.color = new T.Color(pal0.hot || '#ffffff');
      impactGlow.material.color = new T.Color(pal0.core || pal0.hot || '#ffffff');
      impactGlow.material.map = glowTexture('impact_glow_' + (smashFx || 'none'), hexRgb(pal0.mid || pal0.hot || '#ffffff'));
      shuttleTrail.material.color = new T.Color(pal0.mid || '#ffffff');
      speedLines.material.color = new T.Color(pal0.hot || '#ffffff');
      impactOn = false;
      burst.visible = false;
      flash.visible = false;
      shock.visible = false; shock2.visible = false;
      rays.visible = false; impactGlow.visible = false;
      speedLines.visible = false; shuttleTrail.visible = false;
      slamRing.material.opacity = 0;
      slamRing.visible = false;
      slamCrack.material.opacity = 0;
      slamCrack.visible = false;
      debris.visible = false;
    }

    /* 스윙 궤적 — 실제 헤드가 지나온 자리. 바깥은 넓고 부드럽게, 안쪽은 밝게 두 겹 */
    function ribbonOf(pts, wid0, wid1) {
      var pos = [], idx = [], i;
      var camDir = new T.Vector3(0, 0, 1);
      for (i = 0; i < pts.length; i++) {
        var p = pts[i];
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var tan = new T.Vector3().subVectors(b, a).normalize();
        var side = new T.Vector3().crossVectors(tan, camDir).normalize();
        if (!isFinite(side.x)) side.set(0, 1, 0);
        var wid = wid0 + (wid1 - wid0) * (i / Math.max(1, pts.length - 1));
        pos.push(p.x + side.x * wid, p.y + side.y * wid, p.z + side.z * wid,
          p.x - side.x * wid, p.y - side.y * wid, p.z - side.z * wid);
      }
      for (i = 0; i < pts.length - 1; i++) {
        var k = i * 2;
        idx.push(k, k + 1, k + 3, k, k + 3, k + 2);
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      return geo;
    }

    function buildTrail(kind) {
      var RCx = RC();
      if (trail) { scene.remove(trail); trail.geometry.dispose(); trail = null; }
      if (trailCore) { scene.remove(trailCore); trailCore.geometry.dispose(); trailCore = null; }
      if (kind === 'slam') return;
      var pts = [], i;
      var N = 16;
      for (i = 0; i <= N; i++) {
        var ms = lerp(RCx.WIND_MS, RCx.HIT_AT, i / N);
        pts.push(headWorld(ms, kind));
      }
      resetPose();
      if (!pts.length) return;
      /* 굵고 선명한 스윙 아크 — 예전 2~8 은 실오라기 같았습니다 (bm-v1.90.0: 7~34) */
      trail = new T.Mesh(ribbonOf(pts, 2, 22), new T.MeshBasicMaterial({
        color: new T.Color(burstColorHex()), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      trail.visible = false;
      scene.add(trail);
      trailCore = new T.Mesh(ribbonOf(pts, 0.7, 4.6), new T.MeshBasicMaterial({
        color: new T.Color('#ffffff'), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      trailCore.visible = false;
      scene.add(trailCore);
    }

    /* 날아오는 길 — 점선 같은 안내선(어디서 오는지 눈으로 읽게) */
    function buildGuide(kind) {
      inGuide.visible = false;
      if (kind === 'slam') return;
      var pts = [], i;
      for (i = 0; i <= 26; i++) {
        pts.push(quadratic(inStart, inCtrl, hitPos, i / 26));
      }
      inGuide.geometry.dispose();
      inGuide.geometry = new T.BufferGeometry();
      inGuide.geometry.setAttribute('position', new T.Float32BufferAttribute(
        pts.reduce(function (acc, p) { return acc.concat([p.x, p.y, p.z]); }, []), 3));
      inGuide.visible = true;
      inGuide.material.opacity = 0;
    }

    function burstColorHex() {
      var pal = RC().smashPalette(smashFx || 'none') || {};
      return pal.hot || '#ffffff';
    }

    /* 정타 파티클 — 타점에서 사방으로 크게 터지는 알갱이 */
    function spawnBurst() {
      var p = burst.geometry.attributes.position;
      var n = p.count;
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, b = Math.random();
        var up = 0.15 + Math.random() * 0.95;
        burstVel[i * 3] = Math.cos(a) * (140 + Math.random() * 420) * (1 - b * 0.35);
        burstVel[i * 3 + 1] = up * (200 + Math.random() * 470);
        burstVel[i * 3 + 2] = Math.sin(a) * (140 + Math.random() * 380) + 90;
        var spread = 84;
        p.setXYZ(i, hitPos.x + (Math.random() - 0.5) * spread,
          hitPos.y + (Math.random() - 0.5) * spread,
          hitPos.z + (Math.random() - 0.5) * spread);
      }
      p.needsUpdate = true;
      burst.visible = true;
      burst.material.opacity = 1;
    }

    /* 정타 한 방 — 3D 충격파 링 두 겹 + 빛살 + 큰 섬광 (모든 스매시 공통) */
    function spawnImpact() {
      spawnBurst();
      shock.position.copy(hitPos);
      shock.rotation.set(0, 0, 0);
      shock.scale.setScalar(1);
      shock.material.opacity = 1;
      shock.visible = true;
      shock2.position.copy(hitPos);
      shock2.rotation.set(Math.PI * 0.34, 0.5, 0.2);
      shock2.scale.setScalar(1);
      shock2.material.opacity = 0.9;
      shock2.visible = true;
      /* 빛살 — 타점에서 사방으로 뻗는 가는 선 */
      for (var i = 0; i < RAY_N; i++) {
        var a = rayAng[i];
        var r0 = 30, r1 = 96 + Math.random() * 74;
        rayBuf[i * 6] = hitPos.x + Math.cos(a) * r0;
        rayBuf[i * 6 + 1] = hitPos.y + Math.sin(a) * r0;
        rayBuf[i * 6 + 2] = hitPos.z + 4;
        rayBuf[i * 6 + 3] = hitPos.x + Math.cos(a) * r1;
        rayBuf[i * 6 + 4] = hitPos.y + Math.sin(a) * r1;
        rayBuf[i * 6 + 5] = hitPos.z + 4;
      }
      rays.geometry.dispose();
      rays.geometry = new T.BufferGeometry();
      rays.geometry.setAttribute('position', new T.BufferAttribute(rayBuf.slice(0), 3));
      rays.material.opacity = 0.85;
      rays.visible = true;
      impactGlow.position.copy(hitPos);
      impactGlow.scale.set(74, 74, 1);
      impactGlow.material.opacity = 0.8;
      impactGlow.visible = true;
      /* 발사 속도선 — 나가는 쪽으로 길게 뻗는 선 18개 */
      for (var k = 0; k < SPEED_N; k++) {
        var sp = 40 + Math.random() * 90;
        var side = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
        side.addScaledVector(launchDir, -side.dot(launchDir)).normalize().multiplyScalar(sp);
        speedBuf[k * 6] = hitPos.x + side.x;
        speedBuf[k * 6 + 1] = hitPos.y + side.y;
        speedBuf[k * 6 + 2] = hitPos.z + side.z;
        speedBuf[k * 6 + 3] = hitPos.x + side.x + launchDir.x * 40;
        speedBuf[k * 6 + 4] = hitPos.y + side.y + launchDir.y * 40;
        speedBuf[k * 6 + 5] = hitPos.z + side.z + launchDir.z * 40;
      }
      speedLines.geometry.dispose();
      speedLines.geometry = new T.BufferGeometry();
      speedLines.geometry.setAttribute('position', new T.BufferAttribute(speedBuf.slice(0), 3));
      speedLines.material.opacity = 0.9;
      speedLines.visible = true;
      /* 발사 잔상 씨앗 — 타점에서 나가는 쪽으로 미리 깔아 두면 첫 프레임부터 꼬리가 보입니다 */
      shHist = [];
      for (var q = 0; q < SH_N; q++) {
        shHist.push(hitPos.clone().addScaledVector(launchDir, -(q / SH_N) * 260));
      }
      shuttleTrail.visible = true;
      shuttleTrail.material.opacity = 0.5;
    }

    /* 충격파·빛살·섬광·속도선의 시간 변화 (after = 정타 뒤 ms) */
    function updateImpact(after) {
      var t = clamp01(after / 460);
      if (shock.visible) {
        var s1 = 40 + easeOut3(clamp01(after / 300)) * 320;
        shock.scale.setScalar(s1);
        shock.material.opacity = 0.95 * (1 - t);
        var s2 = 30 + easeOut3(clamp01(after / 380)) * 460;
        shock2.scale.setScalar(s2);
        shock2.material.opacity = 0.85 * (1 - t) * (1 - t);
        if (t >= 1) { shock.visible = false; shock2.visible = false; }
      }
      if (rays.visible) {
        rays.material.opacity = 0.85 * Math.max(0, 1 - after / 190);
        if (after > 190) rays.visible = false;
      }
      if (impactGlow.visible) {
        var g = clamp01(after / 240);
        var gs = 74 + easeOut3(g) * 360;
        impactGlow.scale.set(gs, gs, 1);
        impactGlow.material.opacity = 0.8 * (1 - g);
        if (g >= 1) impactGlow.visible = false;
      }
      if (speedLines.visible) {
        var sl = clamp01(after / 260);
        speedLines.material.opacity = 0.9 * (1 - sl);
        speedLines.scale.setScalar(1 + sl * 2.6);
        if (sl >= 1) { speedLines.visible = false; speedLines.scale.setScalar(1); }
      }
      /* 셔틀콕 잔상 — 최근 위치를 점으로 남깁니다 */
      if (shuttleTrail.visible && shHist.length) {
        var sp = shuttleTrail.geometry.attributes.position;
        for (var i = 0; i < sp.count; i++) {
          var hp = shHist[Math.min(shHist.length - 1, Math.floor(i * shHist.length / sp.count))];
          sp.setXYZ(i, hp.x, hp.y, hp.z);
        }
        sp.needsUpdate = true;
        shuttleTrail.material.opacity = 0.55 * Math.max(0, 1 - after / 420);
        if (after > 420) shuttleTrail.visible = false;
      }
    }

    function spawnSlam(where) {
      var fy = Math.max(floorY + 9, where.y - 6);
      slamRing.position.set(where.x, fy, where.z);
      slamRing.scale.setScalar(1);
      slamRing.material.opacity = 0.9;
      slamRing.visible = true;
      /* 균열 — 바닥에서 사방으로 */
      var pos = [], i;
      for (i = 0; i < 14; i++) {
        var a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
        var len = 120 + Math.random() * 220;
        var r0 = 20 + Math.random() * 30;
        pos.push(where.x + Math.cos(a) * r0, fy + 1, where.z + Math.sin(a) * r0);
        pos.push(where.x + Math.cos(a) * len, fy + 1, where.z + Math.sin(a) * len * 0.6);
      }
      slamCrack.geometry.dispose();
      slamCrack.geometry = new T.BufferGeometry();
      slamCrack.geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      slamCrack.material.opacity = 0.7;
      slamCrack.visible = true;
      /* 먼지·파편 */
      var dp = debris.geometry.attributes.position;
      for (i = 0; i < dp.count; i++) {
        dp.setXYZ(i, where.x + (Math.random() - 0.5) * 90, fy + 3, where.z + (Math.random() - 0.5) * 70);
        debrisVel[i * 3] = (Math.random() - 0.5) * 260;
        debrisVel[i * 3 + 1] = 60 + Math.random() * 260;
        debrisVel[i * 3 + 2] = (Math.random() - 0.5) * 200;
      }
      dp.needsUpdate = true;
      debris.visible = true;
      debris.material.opacity = 0.8;
    }

    /* --- 공개 API — 기존 2D 뷰와 같은 이름들 --- */
    var api = {
      engine: 'three', rev: REV,
      view: viewMem,
      paint: function () { renderFrame(nowMs()); return true; },
      redraw: function () { renderFrame(nowMs()); return true; },
      fit: function () { fitCamera(); renderFrame(nowMs()); return true; },
      smash: function (fxId, kind) {
        smashFx = (fxId == null) ? lookOf(ctx).effect.id : String(fxId);
        smashKind = kind === 'slam' ? 'slam' : 'air';
        motionOn = false;
        smashAt = nowMs();
        smashOn = true;
        holdAt = null;
        vel.yaw = 0; vel.pitch = 0;
        lastMove = Date.now();
        prepareSmash(smashKind === 'slam' ? 'slam' : 'air');
        /* 효과마다 다른 소리 — 스윙은 지금, 정타음은 임팩트 시각에 맞춰 예약 */
        if (BM.smashsound) BM.smashsound.play(smashFx, smashKind);
        if (BM.ui) BM.ui.haptic(smashKind === 'slam' ? 22 : 14);
        renderFrame(nowMs());
        return true;
      },
      slam: function (fxId) { return api.smash(fxId, 'slam'); },
      motion: function (kind) {
        var k = String(kind || '');
        if (!RC().MOTIONS || RC().MOTIONS.indexOf(k) < 0) return false;
        motionKind = k;
        motionAt = nowMs();
        motionOn = true;
        smashOn = false;
        holdAt = null;
        vel.yaw = 0; vel.pitch = 0;
        lastMove = Date.now();
        if (BM.ui) BM.ui.haptic(12);
        renderFrame(nowMs());
        return true;
      },
      mode: function () { return modeNow(); },
      smashing: function () { return smashOn; },
      kind: function () { return smashKind; },
      motioning: function () { return motionOn; },
      motionKind: function () { return motionKind; },
      hold: function (ms, kind) {
        holdAt = Math.max(0, Number(ms) || 0);
        if (kind) smashKind = kind === 'slam' ? 'slam' : 'air';
        smashFx = smashFx || lookOf(ctx).effect.id;
        smashOn = true;
        smashAt = nowMs();
        /* 잡아 둔 프레임은 그 순간의 정확한 모습이어야 합니다 —
         * 앞선 연출의 충격파·파티클이 남지 않게 매번 처음부터 준비합니다. */
        prepareSmash(smashKind);
        renderFrame(nowMs());
        return true;
      },
      resume: function () {
        holdAt = null;
        smashAt = nowMs();
        smashOn = true;
        renderFrame(nowMs());
        return true;
      },
      dispose: dispose,
      ready: function () { return ready; },
      /* 점검용 — 화면에는 쓰지 않고 캡처·자동 테스트에서만 들여다봅니다 */
      dbg: function () {
        return { renderer: renderer, scene: scene, camera: camera, model: parts && parts.model, spec: spec };
      }
    };

    /* 캡처·자동 점검에서 각도를 직접 지정할 수 있게 (2D 뷰와 같은 계약) */
    api.view.yaw = viewMem.yaw;
    api.view.pitch = viewMem.pitch;

    function dispose() {
      alive = false;
      if (raf) root.cancelAnimationFrame(raf);
      try { renderer.dispose(); } catch (e) { /* 무시 */ }
      try {
        var gl = renderer.getContext && renderer.getContext();
        var lose = gl && gl.getExtension && gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (e2) { /* 무시 */ }
    }

    /* --- 렌더 루프 --- */
    function updateMotion(now) {
      if (!motionOn) return null;
      var dur = (RC().MOTION_MS && RC().MOTION_MS[motionKind]) || 2200;
      var e = holdAt != null ? Math.min(dur - 1, holdAt) : (now - motionAt);
      if (holdAt == null && e >= dur) { motionOn = false; return null; }
      return RC().motionPose(motionKind, e);
    }

    function renderFrame(now) {
      if (!alive || !parts) return;
      var R2 = RC();
      var look = lookOf(ctx);
      if (look.sig !== looksig) rebuild();

      /* 시점 */
      var mo = updateMotion(now);
      var yaw = viewMem.yaw, pitch = viewMem.pitch;
      var dy = 0;
      if (mo) {
        yaw += mo.yaw || 0;
        pitch = clampN(pitch + (mo.pitch || 0), -1.3, 1.3);
        dy = (mo.dy || 0);
      } else if (holdAt == null) {
        /* 가만히 두면 천천히 숨 쉬듯 */
        var idleT = (now - lastMove) / 1000;
        if (idleT > 1.6) {
          idlePhase += 0.008;
          yaw += Math.cos(idlePhase) * 0.075;
          pitch += Math.sin(idlePhase * 0.8) * 0.02;
        }
      }
      var roll = 0;
      if (mo && mo.roll) roll = mo.roll;
      aimG.rotation.set(pitch, yaw, roll, 'YXZ');
      /* 모션 중에는 라켓이 화면 밖으로 나가지 않게 살짝 줄입니다(2D 뷰와 같은 방식) */
      var motionScale = 1;
      if (mo) {
        motionScale = 1 - 0.26 * Math.min(1, Math.abs(roll) / 3.14);
        if (motionKind === 'flip') motionScale = 0.90;
      }
      aimG.scale.setScalar(motionScale);
      airG.position.set(0, dy, 0);

      /* 손목 트위스트 — 좌우로 비틀기 */
      if (mo && motionKind === 'twist') {
        aimG.rotation.z += Math.sin((holdAt != null ? holdAt : now - motionAt) / 220) * 0.22;
      }

      /* 스매시 */
      var el = 0, cl = 0, phase = -1;
      if (smashOn) {
        el = holdAt != null ? holdAt : (now - smashAt);
        if (holdAt == null && el >= R2.SMASH_MS) {
          smashOn = false; el = 0; resetPose(); shuttle.visible = false;
          if (trail) trail.visible = false;
          if (trailCore) trailCore.visible = false;
          flash.visible = false;
          shock.visible = false; shock2.visible = false;
          impactGlow.visible = false; speedLines.visible = false;
          rays.visible = false; shuttleTrail.visible = false;
          inGuide.visible = false;
        } else {
          /* 히트스톱 — 기존 30ms 위에 EXTRA_STOP 한 박자. 정타 뒤 이 시간 동안
           * 자세·파티클·카메라가 그 자리에 '박혀' 있어 타격감이 확실해집니다. */
          /* 히트스톱 — 기존 30ms(R2.smashClock(el)) 에 bm-v1.90.0 한 박자(EXTRA_STOP)를 더해
           * 정타 뒤 88ms 동안 자세·셔틀·카메라가 그 자리에 '박혀' 있습니다. */
          var STOP_TOTAL = 30 + EXTRA_STOP;
          cl = el <= R2.HIT_AT
            ? R2.smashClock(el)
            : (el <= R2.HIT_AT + STOP_TOTAL ? R2.HIT_AT : R2.smashClock(el - EXTRA_STOP));
          var poseMs = cl <= R2.HIT_AT ? cl : cl + 30;
          phase = R2.smashPhase(poseMs);
          var pose = poseAt(poseMs, smashKind);
          applySwing(pose, smashKind);
          /* 스매시 중에는 살짝 앞으로 당겨 라켓이 화면을 향하게 */
          airG.position.y += (phase === 1 ? -4 : 0);
          var aimK = easeInOut3(clamp01(cl / R2.HIT_AT));
          if (cl > R2.HIT_AT) aimK = Math.max(0, 1 - (cl - R2.HIT_AT) / 240);
          if (smashKind === 'slam') {
            /* 바닥 강타는 라켓이 눕기 때문에 시선을 조금 올려 코트와 머리가 함께 보이게 */
            airG.position.y += 90 * easeInOut3(clamp01(cl / R2.HIT_AT));
            /* 강타는 옆에서 눕기 때문에, 얼굴(거트)이 보이게 살짝 돌려 줍니다 */
            aimG.rotation.y += 0.55 * easeInOut3(clamp01(cl / R2.HIT_AT));
          } else {
            /* 셔틀이 날아오는 쪽을 마주 봅니다 — 그 방향으로 세게 치는 맛 */
            aimG.rotation.y = yaw + aimYaw * aimK;
            aimG.rotation.x = pitch + aimPitch * aimK;
          }

          /* 정타 순간 · 강한 카메라 셰이크 (위치 + 살짝 기울기) */
          var after = cl - R2.HIT_AT;
          if (after >= 0) {
            var boom = Math.max(0, 1 - after / 420);
            var amp = (smashKind === 'slam' ? 46 : 40) * boom * boom;
            camera.position.x = Math.sin(after / 7.5) * amp;
            camera.position.y = Math.cos(after / 10.5) * amp * 0.7;
            camera.lookAt(0, 0, 0);
            camera.rotation.z += Math.sin(after / 6.2) * amp * (smashKind === 'slam' ? 0.0014 : 0.0011);
          } else {
            camera.position.x = 0; camera.position.y = 0;
            camera.lookAt(0, 0, 0);
          }
          /* 스윙 동안 카메라가 살짝 물러나 헤드가 화면 밖으로 나가지 않게
           * (+ 정타 순간 아주 짧게 밀고 들어오는 펀치) */
          var dollyMax = smashKind === 'slam' ? 0.62 : 0.10;
          var dollyT = cl < R2.HIT_AT
            ? 1 + dollyMax * easeInOut3(clamp01(cl / R2.HIT_AT))
            : 1 + dollyMax * (1 - easeOut3(clamp01(after / 700)));
          if (after >= 0) dollyT -= 0.045 * Math.max(0, 1 - after / 170);
          var baseZ = camera.userData.baseZ || camera.position.z;
          camera.position.z = baseZ * dollyT;
          camera.updateProjectionMatrix();

          /* 셔틀콕 — 날아오기 → 임팩트 → 코르크 반전 초고속 발사 */
          if (smashKind !== 'slam') {
            updateShuttle(poseMs, cl, after);
          } else if (after >= 0 && after < 30 && !slamRing.visible) {
            spawnSlam(hitPos);
          }
          /* 히트스톱 프레임에서 궤적·파티클·플래시·충격파 */
          if (trail) {
            trail.visible = cl >= R2.WIND_MS && after < 440;
            trail.material.opacity = 0.30 * Math.max(0, 1 - after / 420);
          }
          if (trailCore) {
            trailCore.visible = trail ? trail.visible : false;
            trailCore.material.opacity = 0.95 * Math.max(0, 1 - after / 380);
          }
          if (inGuide.visible) {
            inGuide.material.opacity = cl < R2.HIT_AT
              ? 0.38 * Math.min(1, cl / 100)
              : 0.38 * Math.max(0, 1 - after / 180);
            if (after > 180) inGuide.visible = false;
          }
          if (after >= 0) {
            /* 한 프레임이 크게 밀려도(느린 기기) 정타 연출은 딱 한 번 반드시 터집니다 */
            if (!impactOn) {
              impactOn = true;
              flash.visible = true;
              spawnImpact();
            }
            var ft = clamp01(after / 220);
            if (flash.visible) {
              var fs = 90 + ft * 320;
              flash.scale.set(fs, fs, 1);
              flash.position.copy(hitPos);
              flash.material.opacity = 0.85 * (1 - ft);
              if (ft >= 1) flash.visible = false;
            }
            updateImpact(after);
            updateBurst(after);
          }
          if (slamRing.visible) {
            var st2 = clamp01(after / (R2.BOOM_MS || 520));
            slamRing.scale.setScalar(1 + st2 * 900);
            slamRing.material.opacity = 0.85 * (1 - st2);
            slamCrack.material.opacity = 0.7 * (1 - st2 * 0.8);
            updateDebris();
            if (st2 >= 1) { slamRing.visible = false; slamCrack.visible = false; debris.visible = false; }
          }
        }
      } else {
        resetPose();
        shuttle.visible = false;
        if (trail) trail.visible = false;
        if (trailCore) trailCore.visible = false;
        camera.position.x = 0; camera.position.y = 0;
        camera.position.z = (camera.userData.baseZ || camera.position.z) * (mo ? 1.10 : 1);
        camera.lookAt(0, 0, 0);
        camera.rotation.z = 0;
      }

      /* 오라 */
      animateEffect(parts.fx, (now % 100000) / 1000);

      /* 접지 그림자 — 라켓이 기울면 살짝 흐려집니다 */
      shadow.material.opacity = 0.7 + Math.sin(now / 1400) * 0.04;

      renderer.render(scene, camera);
      ready = true;
    }

    /* 셔틀콕 — 코트 앞 위 대각선에서 실제 궤적으로 날아와, 정타 뒤
     * 들어온 축을 뒤집어 아래 대각선으로 초고속 직선 발사됩니다. */
    function updateShuttle(el, cl, after) {
      var R2 = RC();
      shuttle.visible = true;
      if (cl < R2.HIT_AT) {
        var t = smooth(cl / R2.HIT_AT);
        var p0 = quadratic(inStart, inCtrl, hitPos, t);
        shuttle.position.copy(p0);
        var dir = new T.Vector3().subVectors(hitPos, p0).normalize();
        /* 깃은 +y, 코르크는 -y — 코르크가 날아가는 쪽을 정확히 보게 */
        shuttle.quaternion.setFromUnitVectors(FLY_AXIS, dir);
        /* 멀리서도 또렷하게 — 시작 2.6배에서 타점 1.25배로 다가옵니다 */
        shuttle.scale.setScalar(2.6 - 1.35 * t);
        /* 뒤로 잔상이 늘어지게 */
        if (cl > 20) {
          shHist.push(p0.clone());
          if (shHist.length > SH_N) shHist.shift();
          shuttleTrail.visible = shHist.length > 3;
          shuttleTrail.material.opacity = 0.34;
          var stp = shuttleTrail.geometry.attributes.position;
          for (var si = 0; si < stp.count; si++) {
            var hp0 = shHist[Math.min(shHist.length - 1, si)];
            stp.setXYZ(si, hp0.x, hp0.y, hp0.z);
          }
          stp.needsUpdate = true;
        }
      } else {
        /* 맞은 뒤 — 코르크가 180° 돌아 앞장서고, 정타 뒤 300ms 만에 화면 밖까지 */
        var k = clamp01(after / 150);
        var tr = clamp01(after / 420);
        var dist = easeOut3(tr) * 1700;
        shuttle.position.copy(hitPos).addScaledVector(launchDir, dist);
        shuttle.quaternion.setFromUnitVectors(FLY_AXIS, launchDir);
        shuttle.rotateY(Math.PI * easeOut3(k));   /* 코르크가 앞장서며 도는 스핀 */
        shuttle.scale.setScalar(1.25 + tr * 1.2);
        shHist.push(shuttle.position.clone());
        if (shHist.length > SH_N) shHist.shift();
        shuttleTrail.visible = shHist.length > 3;
      }
    }

    function quadratic(a, c, b, t) {
      var it = 1 - t;
      return new T.Vector3(
        it * it * a.x + 2 * it * t * c.x + t * t * b.x,
        it * it * a.y + 2 * it * t * c.y + t * t * b.y,
        it * it * a.z + 2 * it * t * c.z + t * t * b.z
      );
    }

    function updateBurst(after) {
      if (!burst.visible) return;
      var p = burst.geometry.attributes.position;
      var dt = Math.min(0.05, after / 1000 || 0.016);
      var t = Math.min(0.6, after / 1000);
      for (var i = 0; i < p.count; i++) {
        burstVel[i * 3 + 1] -= 520 * 0.016;
        p.setXYZ(i,
          p.getX(i) + burstVel[i * 3] * 0.016,
          p.getY(i) + burstVel[i * 3 + 1] * 0.016,
          p.getZ(i) + burstVel[i * 3 + 2] * 0.016);
      }
      p.needsUpdate = true;
      burst.material.opacity = Math.max(0, 0.9 * (1 - after / 700));
      if (after > 780) burst.visible = false;
    }

    function updateDebris() {
      if (!debris.visible) return;
      var p = debris.geometry.attributes.position;
      for (var i = 0; i < p.count; i++) {
        debrisVel[i * 3 + 1] -= 620 * 0.016;
        p.setXYZ(i,
          p.getX(i) + debrisVel[i * 3] * 0.016,
          Math.max(floorY + 8, p.getY(i) + debrisVel[i * 3 + 1] * 0.016),
          p.getZ(i) + debrisVel[i * 3 + 2] * 0.016);
      }
      p.needsUpdate = true;
    }

    /* --- 프레임 루프 --- */
    function loop() {
      if (!alive) return;
      if (!cv.isConnected) { dispose(); return; }
      var now = nowMs();
      /* 크기 변경(시트 펼침·회전) 감지 */
      if (cv.clientWidth && Math.abs(cv.clientWidth * (renderer.getPixelRatio() || 1) * 0 + 0) >= 0) {
        if (cv.clientWidth !== lastW || cv.clientHeight !== lastH) {
          lastW = cv.clientWidth; lastH = cv.clientHeight;
          fitCamera();
        }
      }
      var busy = smashOn || motionOn || (Date.now() - lastMove < 2000);
      if (busy || (now - lastFrame > 60)) {
        renderFrame(now);
        lastFrame = now;
      }
      raf = root.requestAnimationFrame(loop);
    }

    var lastW = 0, lastH = 0, lastFrame = 0;

    /* --- 조작 — 끌어서 360°, 톡 치면 스매시, 꾸미기 모드에선 부위 선택 --- */
    var ray = new T.Raycaster();
    var ndc = new T.Vector2();

    function slotAt(clientX, clientY) {
      var r = cv.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
      ndc.y = -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(modelG.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        while (o && !o.userData.slot) o = o.parent;
        if (o && o.userData.slot) return o.userData.slot;
      }
      return '';
    }

    cv.addEventListener('pointerdown', function (ev) {
      /* 이 손짓 안에서 소리를 깨웁니다 (브라우저 자동재생 규칙) */
      if (BM.smashsound) BM.smashsound.unlock();
      if (ev.button && ev.button !== 0) return;
      drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, sx: ev.clientX, sy: ev.clientY, moved: 0 };
      lastMove = Date.now();
      try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      if (ev.preventDefault) ev.preventDefault();
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      var stepYaw = dx * 0.012, stepPitch = -dy * 0.006;
      viewMem.yaw += stepYaw;
      viewMem.pitch = clampN(viewMem.pitch + stepPitch, -0.9, 0.9);
      vel.yaw = vel.yaw * 0.5 + stepYaw * 0.5;
      vel.pitch = vel.pitch * 0.5 + stepPitch * 0.5;
      lastMove = Date.now();
      renderFrame(nowMs());
    });
    function endDrag(ev) {
      if (!drag || (ev && ev.pointerId !== drag.id)) return;
      var wasTap = drag.moved < 8;
      var r = cv.getBoundingClientRect();
      var px = (ev ? ev.clientX : 0) - r.left, py = (ev ? ev.clientY : 0) - r.top;
      try { cv.releasePointerCapture(drag.id); } catch (e) { /* 무시 */ }
      drag = null;
      lastMove = Date.now();
      if (!wasTap) return;
      var mode = modeNow();
      if (mode !== 'paint') { api.smash(); return; }
      var slot = slotAt(px + r.left, py + r.top);
      /* 레이가 아무것도 못 맞히면(줄 사이 빈 곳) 위치로 부위를 고릅니다 */
      if (!slot) {
        var ry2 = py / Math.max(1, r.height);
        slot = ry2 < 0.45 ? 'frame' : (ry2 < 0.74 ? 'string' : 'grip');
      }
      if (slot) RC().pickSlot(host, ctx, slot);
    }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    cv.addEventListener('pointerleave', endDrag);

    cv.addEventListener('webglcontextlost', function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      alive = false;
    }, false);

    /* 시작 */
    rebuild();
    renderFrame(nowMs());
    raf = root.requestAnimationFrame(loop);

    if (BM.racketcustom) BM.racketcustom._last3d = api;
    return api;
  }

  /* ============================================================
   * 8. 내보내기
   * ============================================================ */
  BM.racket3d = {
    rev: REV,
    available: available,
    create: create,
    lookOf: lookOf,
    buildRacket: buildRacket,
    buildShuttle: buildShuttle,
    bandGeometry: bandGeometry,
    gripSpiral: gripSpiral,
    _tex: function (k) { return TEX[k] || null; },
    _resetProbe: function () { webglProbe = null; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
