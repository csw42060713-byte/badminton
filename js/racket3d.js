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
  var REV = '1.96.0';

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

  /* 천공(구멍) 오버그립 — 실제 그립처럼 규칙적으로 뚫린 작은 구멍 + 눌린 테두리 (bm-v1.95.0) */
  function perfTexture() {
    return canvasDraw('perf', 128, 128, function (g, w, h) {
      g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 16) {
        var ox = (y / 16) % 2 ? 8 : 0;
        for (var x = 0; x < w; x += 16) {
          var cx = x + ox + 8, cy = y + 8;
          var rg = g.createRadialGradient(cx, cy, 0, cx, cy, 5.2);
          rg.addColorStop(0, 'rgba(0,0,0,0.6)');
          rg.addColorStop(0.62, 'rgba(0,0,0,0.22)');
          rg.addColorStop(0.82, 'rgba(255,255,255,0.26)');
          rg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = rg;
          g.beginPath(); g.arc(cx, cy, 5.6, 0, Math.PI * 2); g.fill();
        }
      }
    }, { srgb: false, repeat: [3, 10] });
  }

  function gripBumpOf(weave) {
    if (weave === 'towel') return towelTexture();
    if (weave === 'perf') return perfTexture();
    return ribTexture();
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

  /* 정타 별섬광 — 가운데가 뜨겁게 타는 별 모양 스프라이트 (bm-v1.94.0) */
  function starTexture() {
    return canvasDraw('impact_star', 256, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var c = w / 2;
      g.translate(c, c);
      var rays = 8, i;
      for (i = 0; i < rays; i++) {
        g.save();
        g.rotate((i * Math.PI * 2) / rays);
        var lg = g.createLinearGradient(0, 0, 0, -c);
        lg.addColorStop(0, 'rgba(255,255,255,1)');
        lg.addColorStop(0.45, 'rgba(255,255,255,0.55)');
        lg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(-6, 0); g.lineTo(0, -c * 0.96); g.lineTo(6, 0);
        g.closePath(); g.fill();
        g.restore();
      }
      var rg = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.36);
      rg.addColorStop(0, 'rgba(255,255,255,1)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(0, 0, c * 0.36, 0, Math.PI * 2); g.fill();
    });
  }

  /* ============================================================
   * bm-v1.96.0 — 떨어지는 얼음 · 불 · 별빛 · 금가루 텍스처
   *  번개(썬더 골드)와 같은 화면 전체 스케일로 '쏟아지는' 연출을 만들기 위해
   *  조각 하나하나에 결을 넣습니다. 모두 캔버스에 한 번만 굽고 재사용합니다.
   * ============================================================ */

  /* 고드름 — 위는 하얗게 타오르고 아래로 갈수록 옅어지는 결정면 + 세로 하이라이트 */
  function icicleTexture(rgb) {
    return canvasDraw('ice_shard_' + rgb, 64, 256, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, 'rgba(255,255,255,0.98)');
      lg.addColorStop(0.26, 'rgba(' + rgb + ',0.88)');
      lg.addColorStop(0.66, 'rgba(' + rgb + ',0.4)');
      lg.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(w * 0.5, 0); g.lineTo(w * 0.95, h * 0.22);
      g.lineTo(w * 0.62, h); g.lineTo(w * 0.38, h);
      g.lineTo(w * 0.05, h * 0.22);
      g.closePath(); g.fill();
      /* 결정면 — 가운데 세로 능선과 위쪽 삼각면을 밝게 */
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(w * 0.5, 3); g.lineTo(w * 0.5, h * 0.86); g.stroke();
      g.beginPath(); g.moveTo(w * 0.24, h * 0.26); g.lineTo(w * 0.5, h * 0.6); g.lineTo(w * 0.76, h * 0.26); g.stroke();
      g.globalCompositeOperation = 'source-over';
    });
  }

  /* 화염 유성 — 아래가 하얗게 타는 머리, 위로 길게 사그라지는 꼬리 */
  function cometTexture(rgb) {
    return canvasDraw('comet_' + rgb, 64, 192, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var lg = g.createLinearGradient(0, h, 0, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0.98)');
      lg.addColorStop(0.14, 'rgba(255,238,190,0.94)');
      lg.addColorStop(0.4, 'rgba(' + rgb + ',0.58)');
      lg.addColorStop(0.78, 'rgba(' + rgb + ',0.16)');
      lg.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(w * 0.5, h);
      g.bezierCurveTo(w * 0.96, h * 0.72, w * 0.7, h * 0.32, w * 0.5, 0);
      g.bezierCurveTo(w * 0.3, h * 0.32, w * 0.04, h * 0.72, w * 0.5, h);
      g.fill();
    });
  }

  /* 서리 파편 — 바닥에 부딪힌 얼음이 사방으로 튀는 6갈래 결정 */
  function frostBurstTexture(rgb) {
    return canvasDraw('frost_burst_' + rgb, 128, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var c = w / 2;
      g.translate(c, c);
      for (var i = 0; i < 6; i++) {
        g.save();
        g.rotate((i * Math.PI) / 3);
        var lg = g.createLinearGradient(0, 0, 0, -c);
        lg.addColorStop(0, 'rgba(255,255,255,1)');
        lg.addColorStop(0.5, 'rgba(' + rgb + ',0.72)');
        lg.addColorStop(1, 'rgba(' + rgb + ',0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(-5, 0); g.lineTo(0, -c * 0.98); g.lineTo(5, 0);
        g.closePath(); g.fill();
        /* 잔가지 — 진짜 서리 결정처럼 */
        g.globalAlpha = 0.6;
        g.beginPath();
        g.moveTo(0, -c * 0.34); g.lineTo(c * 0.22, -c * 0.56);
        g.moveTo(0, -c * 0.34); g.lineTo(-c * 0.22, -c * 0.56);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.stroke();
        g.globalAlpha = 1;
        g.restore();
      }
      var rg = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.44);
      rg.addColorStop(0, 'rgba(255,255,255,0.96)');
      rg.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(0, 0, c * 0.44, 0, Math.PI * 2); g.fill();
    });
  }

  /* 불새 날개 — 안쪽은 하얗게, 깃 끝으로 갈수록 붉게 사그라지는 깃 9장 */
  function wingTexture(rgb, rgb2) {
    return canvasDraw('wing_' + rgb + '_' + rgb2, 256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      /* 같은 뿌리에서 부채처럼 뻗는 깃 — 겹쳐 그리면 그냥 빛 띠가 되므로 사이를 띄웁니다 */
      var rx = 26, ry = h * 0.62;
      for (var f = 0; f < 7; f++) {
        var u = f / 6;
        var ang = (-38 + u * 74) * Math.PI / 180;
        var len = 150 + Math.cos(u * Math.PI) * 52;
        var ex = rx + Math.cos(ang) * len;
        var ey = ry + Math.sin(ang) * len;
        var wgt = 6.5;
        var nx = -Math.sin(ang) * wgt, ny = Math.cos(ang) * wgt;
        var lg = g.createLinearGradient(rx, ry, ex, ey);
        lg.addColorStop(0, 'rgba(255,255,236,0.96)');
        lg.addColorStop(0.22, 'rgba(255,208,120,0.86)');
        lg.addColorStop(0.62, 'rgba(' + rgb + ',0.5)');
        lg.addColorStop(1, 'rgba(' + rgb2 + ',0)');
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(rx, ry - ny * 0.35);
        g.quadraticCurveTo(rx + (ex - rx) * 0.55 + nx, ry + (ey - ry) * 0.55 + ny, ex, ey);
        g.quadraticCurveTo(rx + (ex - rx) * 0.55 - nx, ry + (ey - ry) * 0.55 - ny, rx, ry + ny * 0.35);
        g.closePath(); g.fill();
      }
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
      /* bm-v1.95.0 — 금속 프레임도 제 색을 띱니다.
       *  예전에는 모든 메탈을 거의 검정(#12161c)으로 덮어 오닉스만 의도대로 보였고,
       *  새로 넣은 골드·빙하·에메랄드·바이올렛·로즈가 전부 검게 나왔습니다.
       *  금속 고유색을 살리고(반사가 그 색으로 물들도록) 아주 옅은 자체 발광을 더합니다. */
      mat.color = c.clone().multiplyScalar(0.96);
      mat.metalness = 0.86;
      mat.roughness = 0.24;
      mat.envMapIntensity = 1.55;
      mat.emissive = c.clone().multiplyScalar(0.10);
      mat.emissiveIntensity = 1;
      mat.clearcoat = 0.55;
      mat.clearcoatRoughness = 0.10;
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
      roughness: towel ? 0.96 : (weave === 'perf' ? 0.52 : (weave === 'twotone' ? 0.58 : 0.74)),
      bumpMap: gripBumpOf(weave),
      bumpScale: towel ? 0.9 : (weave === 'perf' ? 0.62 : 0.45),
      envMapIntensity: weave === 'perf' ? 1.5 : 0.8,
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
        /* bm-v1.95.0 — 스튜디오 조명이 세서 밝은 그립 색이 하얗게 타 버렸습니다.
         *  천(오버그립)은 빛을 조금 먹는 재질이라 색을 0.72 로 낮춰 실제 색이 보이게. */
        color: new T.Color(colors[ci]).multiplyScalar(0.48),
        metalness: 0.04,
        roughness: opts.roughness == null ? 0.88 : opts.roughness,
        bumpMap: opts.bump || ribTexture(),
        bumpScale: opts.bumpScale == null ? 0.3 : opts.bumpScale,
        envMapIntensity: 0.12,
        specularIntensity: 0.1,
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
    /* bm-v1.95.0 — 세트 조합 보너스(공개 4 · 히든 7)가 발동 중이면 바닥 오라·특수 연출이 켜집니다 */
    /* 매 프레임 부르므로 이미 정리된 c 를 그대로 쓰는 activeSetRaw (정리 반복 없음) */
    var setHit = R.activeSetRaw ? R.activeSetRaw(c) : (R.activeSet ? R.activeSet(c) : null);
    var setInfo = setHit && setHit.set ? {
      id: setHit.set.id, fx: setHit.set.fx, color: setHit.set.color,
      color2: setHit.set.color2 || setHit.set.color, name: setHit.set.name,
      tag: setHit.set.tag, hidden: !!setHit.set.hidden
    } : null;
    return {
      custom: c, gm: gm, level: level,
      set: setInfo,
      frame: { id: c.frame, color: frameIt.color || '#23272b', finish: frameIt.finish || '', shine: frameIt.shine || '#cfd8e4' },
      string: { color: stringIt.color || '#c6f24e' },
      grip: { color: gripIt.color || '#1d2124', color2: gripIt.color2 || '', weave: gripIt.weave || '' },
      stencil: { id: c.stencil, color: stencilIt.color || '#f2c14e' },
      charm: { id: c.charm, color: charmIt.color || '#f2c14e' },
      effect: { id: c.effect, color: effectIt.color || '#c6f24e' },
      sig: [c.body, c.frame, c.string, c.grip, c.stencil, c.charm, c.effect, level, setInfo ? setInfo.id : ''].join('|')
    };
  }

  /* ---------- 끊어진 거트 배치 (bm-v1.94.0) ----------
   * 거트 교체 시기(gear.strungAt + cycleDays)가 지나면 conditionOf 가 broken 을 돌려주고,
   * buildRacket 이 이 배치대로 줄을 끊어 그립니다.
   *   · 세로줄 3가닥 + 가로줄 1가닥을 가운데 근처에서 끊고
   *   · 끊긴 끝은 좌우로 벌어지며 밖으로 말려 나오게 (삐져나온 모양)
   * 순수 함수라 Node 테스트에서 그대로 값을 확인합니다. */
  function brokenStringPlan(mainCount, crossCount) {
    var mains = [], crosses = [];
    var mid = Math.floor((mainCount || 0) / 2);
    [
      { d: -2, gap: 8.5, swing: -1 },
      { d: 0, gap: 11.5, swing: 1 },
      { d: 2, gap: 7.5, swing: -1 }
    ].forEach(function (c) {
      var i = mid + c.d;
      if (i >= 0 && i < (mainCount || 0)) mains.push({ i: i, gap: c.gap, swing: c.swing });
    });
    if (crossCount) {
      var ci = Math.floor(crossCount / 2) + 1;
      if (ci < crossCount) crosses.push({ i: ci, gap: 9, swing: 1 });
    }
    return { mains: mains, crosses: crosses };
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
    /* 줄이 끊긴 상태 — 세로 3가닥·가로 1가닥이 끊어져 끝이 벌어지고 밖으로 말립니다 */
    if (look.level === 'broken') {
      var cutPlan = brokenStringPlan(mainPts.length, crossPts.length);
      var splay = function (line, fromStart, gap, swing, horiz) {
        if (!line || line.length < 3) return;
        var n = line.length, i, k, cnt = Math.min(3, n);
        for (i = 0; i < cnt; i++) {
          var idx = fromStart ? i : (n - 1 - i);
          k = (cnt - i) / cnt;
          if (horiz) line[idx].x += (fromStart ? -1 : 1) * gap * k;
          else line[idx].y += (fromStart ? -1 : 1) * gap * k;
          line[idx].x += swing * 1.4 * k;
          line[idx].z = (line[idx].z || 0) + 0.6 * k;
        }
      };
      var frayTip = function (p, sx, sy, z) {
        var curl = [
          { x: p.x, y: p.y, z: p.z || 0 },
          { x: p.x + sx * 4.4, y: p.y + sy * 3.2, z: (p.z || 0) + 1.1 },
          { x: p.x + sx * 1.8, y: p.y + sy * 8.2, z: (p.z || 0) + 1.7 }
        ];
        var cm = new T.Mesh(stringRibbon(T, curl, 0.33, 0), mainMat);
        cm.position.z = z;
        bedGroup.add(cm);
      };
      cutPlan.mains.forEach(function (c) {
        var line = mainPts[c.i];
        if (!line || line.length < 5) return;
        var half = Math.floor(line.length / 2);
        var aHalf = line.slice(0, half), bHalf = line.slice(half + 1);
        splay(aHalf, false, c.gap, c.swing, false);
        splay(bHalf, true, c.gap, c.swing, false);
        mainPts.splice(c.i, 1, aHalf, bHalf);
        frayTip(aHalf[aHalf.length - 1], c.swing, -1, -0.5);
        frayTip(bHalf[0], -c.swing, 1, 0.5);
        cutPlan.mainShift = (cutPlan.mainShift || 0) + 1;
      });
      cutPlan.crosses.forEach(function (c) {
        var line = crossPts[c.i];
        if (!line || line.length < 5) return;
        var half = Math.floor(line.length / 2);
        var aHalf = line.slice(0, half), bHalf = line.slice(half + 1);
        splay(aHalf, false, c.gap, c.swing, true);
        splay(bHalf, true, c.gap, c.swing, true);
        crossPts.splice(c.i, 1, aHalf, bHalf);
        frayTip(aHalf[aHalf.length - 1], -1, c.swing, -0.4);
        frayTip(bHalf[0], 1, c.swing, 0.4);
      });
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
        envMapIntensity: 0.12, specularIntensity: 0.1, flatShading: true
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
      bump: gripBumpOf(look.grip.weave),
      material: new T.MeshStandardMaterial({
        vertexColors: true, metalness: 0.05,
        roughness: look.grip.weave === 'towel' ? 0.96 : (look.grip.weave === 'perf' ? 0.74 : 0.62),
        bumpMap: gripBumpOf(look.grip.weave),
        bumpScale: look.grip.weave === 'towel' ? 0.85 : (look.grip.weave === 'perf' ? 0.6 : 0.4),
        envMapIntensity: look.grip.weave === 'perf' ? 1.4 : 0.32, side: T.DoubleSide
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

  /* ---------- 궤적 스트릭 — 동그란 점 대신 방향이 보이는 빛줄기 (bm-v1.94.0) ----------
   * PointsMaterial 은 동그란 점만 찍을 수 있어 효과가 '점 뭉치'로 보였습니다.
   * 헤드 둘레에 가늘고 긴 발광 판(streak)을 세워 두고, 프레임마다 길이·투명도를
   * 흘려 쓸려 지나가는 궤적처럼 만듭니다. 판 한 장짜리라 60fps 예산을 거의 먹지 않습니다. */
  function streakTexture(key, rgb) {
    return canvasDraw('streak_' + key, 32, 128, function (g, w, h) {
      var lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, 'rgba(' + rgb + ',0)');
      lg.addColorStop(0.3, 'rgba(' + rgb + ',0.55)');
      lg.addColorStop(0.72, 'rgba(' + rgb + ',0.98)');
      lg.addColorStop(0.92, 'rgba(' + rgb + ',0.75)');
      lg.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      /* 가운데만 남기고 양옆을 지워 칼날 같은 빛줄기로 */
      var side = g.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,0)');
      side.addColorStop(0.42, 'rgba(0,0,0,1)');
      side.addColorStop(0.58, 'rgba(0,0,0,1)');
      side.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  /* 스트릭 n장 — 각자 씨앗을 받아 animateEffect 가 조금씩 다른 리듬으로 흘립니다 */
  function buildStreaks(T, host, col, rgb, n, cfg) {
    cfg = cfg || {};
    var geo = new T.PlaneGeometry(cfg.w || 7, cfg.h || 84);
    var map = streakTexture(cfg.key || rgb, rgb);
    var out = [];
    for (var i = 0; i < n; i++) {
      var mat = new T.MeshBasicMaterial({
        map: map, color: new T.Color(i % 3 === 2 ? '#ffffff' : col),
        transparent: true, opacity: 0.6, blending: T.AdditiveBlending,
        depthWrite: false, side: T.DoubleSide
      });
      var m = new T.Mesh(geo, mat);
      m.userData.seed = i;
      host.add(m);
      out.push(m);
    }
    return out;
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

    /* 모든 효과 공통 — 헤드 바로 뒤의 작은 코어 광휘.
     * 번지는 안개(aura)만 있으면 효과가 밋밋해서, 가운데를 짧게 태우는 빛을 또 하나 둡니다. */
    var core = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('fx_core_' + id, hexRgb(col)), color: new T.Color('#ffffff'),
      transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false
    }));
    core.scale.set(rx * 1.9, ry * 1.7, 1);
    core.position.z = -8;
    host.add(core);
    out.bits.push({ core: core, mode: 'fxcore', seed: 1, base: 0.55, aw: rx * 1.9, ah: ry * 1.7 });

    /* 스트릭 — 효과별 색·길이만 다르게, 공통 리듬으로 흘립니다 */
    var streakRgb = hexRgb(col);
    var streakN = id === 'blaze' || id === 'fire' ? 14 : (id === 'speed' ? 16 : (id === 'ice' ? 10 : 12));
    var streaks = buildStreaks(T, host, col, streakRgb, streakN, {
      key: 'fx_' + id, w: id === 'ice' ? 5 : 6, h: id === 'ice' ? 48 : (id === 'thunder' ? 76 : 62)
    });
    out.bits.push({ streaks: streaks, mode: 'streak', seed: 2, rx: rx, ry: ry, fast: id === 'speed' ? 1.8 : (id === 'thunder' ? 1.4 : 1) });

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
      var sp = pointCloud(T, 58, 34, '#ffffff', glowTexture('spark', '190,232,255'), 0.95);
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
      var bl = pointCloud(T, 78, 52, '#ffffff', glowTexture('blaze', '255,166,96'), 0.95);
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
      var sparks = pointCloud(T, 40, 30, '#ffffff', glowTexture('prism', '255,240,200'), 0.95);
      host.add(sparks);
      out.bits.push({ ring: band, ring2: band2, points: sparks, mode: 'prism', seed: 3 });
    } else if (id === 'goldbolt' || id === 'void') {
      /* bm-v1.95.0 — 금빛/보랏빛 번개 임팩트: 헤드에서 갈라지는 아크 + 도는 불티 */
      var gb = pointCloud(T, 46, 32, '#ffffff', glowTexture('fx_' + id, hexRgb(col)), 0.95);
      host.add(gb);
      var gArcGeo = new T.BufferGeometry();
      var gArcBuf = new Float32Array(BOLT_ARMS * BOLT_SEG * 6);
      boltFill(gArcBuf, rx, ry, 1.9, -12);
      gArcGeo.setAttribute('position', new T.BufferAttribute(gArcBuf, 3));
      var gArc = new T.LineSegments(gArcGeo, new T.LineBasicMaterial({
        color: new T.Color(id === 'goldbolt' ? '#fff6c2' : '#e8dcff'), transparent: true, opacity: 0.9,
        blending: T.AdditiveBlending, depthWrite: false
      }));
      gArc.frustumCulled = false;
      host.add(gArc);
      out.bits.push({ points: gb, mode: 'orbit', seed: 5, bolt: gArc, boltSize: [rx, ry], boltAt: -1 });
    } else if (id === 'wind') {
      /* 에메랄드 윈드 — 헤드 주변을 감아 도는 바람 링 + 솟아오르는 잎 같은 빛 */
      var wRings = [];
      for (i = 0; i < 3; i++) {
        var wr = new T.Mesh(new T.TorusGeometry(rx * (1.0 + i * 0.1), 1.6 - i * 0.3, 8, 80),
          new T.MeshBasicMaterial({
            color: new T.Color(col), transparent: true, opacity: 0.5 - i * 0.1,
            blending: T.AdditiveBlending, depthWrite: false
          }));
        wr.position.z = -4 - i * 6;
        host.add(wr);
        wRings.push(wr);
      }
      var wPts = pointCloud(T, 64, 30, '#ffffff', glowTexture('fx_wind', hexRgb(col)), 0.95);
      host.add(wPts);
      out.bits.push({ ring: wRings[0], ring2: wRings[1], wind: wRings[2], points: wPts, mode: 'prism', seed: 6 });
    } else if (id === 'blossom') {
      /* 체리 블라썸 — 꽃잎이 흩날리듯 떨어지는 분홍 판 + 부드러운 광휘 */
      var petals = [];
      var petalMat = new T.MeshBasicMaterial({
        color: new T.Color('#ffd7e8'), transparent: true, opacity: 0.85,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      });
      for (i = 0; i < 14; i++) {
        var pt2 = new T.Mesh(new T.PlaneGeometry(13, 8), petalMat.clone());
        host.add(pt2);
        petals.push(pt2);
      }
      out.bits.push({ petals: petals, mode: 'petal', seed: 7, rx: rx, ry: ry });
    } else if (id === 'snow') {
      /* 스노우 스톰 — 헤드 주변에 눈이 몰아치는 임팩트 */
      var snowPts = pointCloud(T, 120, 22, '#ffffff', glowTexture('fx_snow', '235,250,255'), 0.95);
      host.add(snowPts);
      var snowRing = new T.Mesh(new T.TorusGeometry(rx * 1.03, 2.2, 8, 88),
        new T.MeshBasicMaterial({
          color: new T.Color(col), transparent: true, opacity: 0.6,
          blending: T.AdditiveBlending, depthWrite: false
        }));
      snowRing.position.z = -9;
      host.add(snowRing);
      out.bits.push({ points: snowPts, mode: 'fall', seed: 8, rx: rx, ry: ry, frost: snowRing });
    } else if (id === 'aurora') {
      /* 오로라 — 헤드를 감싸는 초록·보라 빛 리본 두 겹 */
      var aBands = [];
      for (i = 0; i < 2; i++) {
        var ab = new T.Mesh(new T.TorusGeometry(rx * (0.95 + i * 0.14), 4.4 - i * 1.2, 8, 96),
          new T.MeshBasicMaterial({
            map: auroraTexture('fx_aur' + i + hexRgb(col), hexRgb(col), hexRgb(id === 'aurora' ? '#b48cff' : col), i),
            transparent: true, opacity: 0.55 - i * 0.15, blending: T.AdditiveBlending, depthWrite: false
          }));
        ab.position.z = -8 - i * 8;
        ab.rotation.z = i * 0.6;
        host.add(ab);
        aBands.push(ab);
      }
      var aPts = pointCloud(T, 50, 26, '#ffffff', glowTexture('fx_aur_pts', hexRgb(col)), 0.9);
      host.add(aPts);
      out.bits.push({ ring: aBands[0], ring2: aBands[1], points: aPts, mode: 'orbit', seed: 9 });
    } else if (id === 'fire' || id === 'ice' || id === 'thunder') {
      var mapKey = id === 'fire' ? '255,150,70' : (id === 'ice' ? '170,230,255' : '160,215,255');
      var em = pointCloud(T, 64, 56, '#ffffff', glowTexture('sm_' + id, mapKey), 0.95);
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
          color: new T.Color('#dff7ff'), emissive: new T.Color('#59c8f2'), emissiveIntensity: 1.5,
          metalness: 0.15, roughness: 0.05, transparent: true, opacity: 0.94, flatShading: true
        });
        for (i = 0; i < 14; i++) {
          /* 뾰족한 얼음 조각(4면 피라미드) — 종잇조각 같은 네모가 아니라 가시처럼 */
          var cr = new T.Mesh(new T.ConeGeometry(4.6 + (i % 3) * 1.6, 22 + (i % 4) * 7, 4, 1), iceMat);
          cr.userData.spin = (i % 5) - 2;
          host.add(cr);
          crystals.push(cr);
        }
        var frost = new T.Mesh(new T.TorusGeometry(rx * 1.04, 2.4, 8, 88),
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
      if (b.core) {
        var cp = 1 + Math.sin(t * 6.4) * 0.09;
        b.core.scale.set((b.aw || 200) * cp, (b.ah || 180) * cp, 1);
        b.core.material.opacity = (b.base || 0.5) + Math.sin(t * 7.7) * 0.18;
      }
      if (b.streaks) {
        for (k = 0; k < b.streaks.length; k++) {
          var sm = b.streaks[k], sd = sm.userData.seed || 0;
          var nStr = b.streaks.length;
          var angS = t * (0.85 + (b.fast || 1) * 0.85) + (sd / nStr) * Math.PI * 2;
          var radS = 1.12 + Math.sin(t * 1.6 + sd) * 0.18;
          /* 헤드 테두리를 따라 붙어 흐르게 — 멀리 떠다니면 긴 막대처럼 보입니다 */
          sm.position.set(
            Math.cos(angS) * (b.rx || 98) * 1.06 * radS,
            Math.sin(angS) * (b.ry || 120) * 1.0 * radS,
            -18 + Math.sin(angS * 2.1 + sd) * 16
          );
          sm.rotation.z = angS - Math.PI / 2;
          var pulse = 0.5 + Math.abs(Math.sin(t * 4.2 + sd * 1.7)) * 0.5;
          sm.scale.set(0.6 + pulse * 0.45, 0.45 + pulse * 0.6, 1);
          sm.material.opacity = 0.18 + pulse * 0.5;
        }
      }
      if (b.ring) {
        b.ring.rotation.z = t * (0.6 + (b.i || 0) * 0.25);
        b.ring.material.opacity = (b.mode === 'prism' ? 0.7 : 0.6) + Math.sin(t * 2.4 + (b.i || 0)) * 0.16;
      }
      if (b.ring2) b.ring2.rotation.z = -t * 0.5;
      if (b.wind) b.wind.rotation.z = -t * 1.5;
      if (b.frost) {
        b.frost.rotation.z = t * 0.5;
        b.frost.material.opacity = 0.5 + Math.sin(t * 2.4) * 0.2;
      }
      if (b.petals) {
        for (k = 0; k < b.petals.length; k++) {
          var pe = b.petals[k];
          var lf = ((t * (0.24 + (k % 5) * 0.03) + k * 0.17) % 1);
          pe.position.set(
            Math.sin(k * 2.1) * (b.rx || 98) * 1.5 + Math.sin(t * 1.6 + k) * 26,
            (b.ry || 120) * (1.25 - lf * 2.6),
            -24 + Math.cos(k * 1.7 + t) * 40
          );
          pe.rotation.set(t * 1.1 + k, t * 0.8 + k * 0.3, t * 1.6 + k);
          pe.material.opacity = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + k));
          pe.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(t * 0.9 + k)));
        }
      }
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
          cr0.position.set(Math.cos(ang0) * 118 * rad0, Math.sin(ang0) * 134 * rad0 - 6,
            -18 + Math.sin(ang0 * 1.7) * 42);
          cr0.rotation.set(t * (0.5 + k * 0.06), t * (0.7 + k * 0.05), (cr0.userData.spin || 0) * 0.6 + Math.sin(t + k) * 0.5);
          cr0.scale.setScalar(0.95 + Math.sin(t * 3.4 + k) * 0.2);
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
          } else if (b.mode === 'fall') {
            /* 눈 — 헤드 위에서 아래로 흘러내리며 좌우로 흔들립니다 */
            var lifeF = ((t * (0.3 + r3 * 0.28) + r1) % 1);
            p.setXYZ(k, (r2 - 0.5) * (b.rx || 98) * 2.4 + Math.sin(t * 2 + r3 * 6) * 14,
              (b.ry || 120) * (1.2 - lifeF * 2.4), -22 + (r3 - 0.5) * 80);
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
   * 6. 세트 조합 연출 (bm-v1.95.0)
   *
   *  · 라켓 바로 아래 바닥 오라 — 촌스러운 단색 원판 대신
   *      다층 방사형 글로우 → 라이트 풀 → 도는 에너지 링 → 바닥을 쓸고 도는 빛줄기 → 빛기둥
   *    을 겹쳐 실제 쇼룸 스포트라이트가 바닥에 반사된 느낌을 냅니다.
   *  · 공개 4종(낙뢰 · 불꽃 · 서리 · 어둠) + 히든 7종(보랏빛 낙뢰 · 눈보라 · 불꽃 기둥 ·
   *    소용돌이 · 금가루 · 네온 · 오로라)은 서로 확실히 구분되는 재료(번개 줄기 · 눈 · 불티 ·
   *    바람 링 · 금가루 · 그리드 · 커튼)로 그립니다.
   *  · 모든 재료는 가산(Additive) 합성 + 한 번 구운 텍스처라 프레임당 비용이 작습니다.
   * ============================================================ */

  function rgbaOf(rgb, a) { return 'rgba(' + rgb + ',' + a + ')'; }

  /* 바닥 오라의 가장 큰 층 — 가운데가 밝고 가장자리로 부드럽게 사라지는 원판 */
  function auraDiscTexture(col) {
    var rgb = hexRgb(col);
    return canvasDraw('aura_disc_' + rgb, 256, 256, function (g, w, h) {
      var rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      rg.addColorStop(0, rgbaOf(rgb, 0.92));
      rg.addColorStop(0.16, rgbaOf(rgb, 0.5));
      rg.addColorStop(0.36, rgbaOf(rgb, 0.22));
      rg.addColorStop(0.62, rgbaOf(rgb, 0.07));
      rg.addColorStop(1, rgbaOf(rgb, 0));
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
  }

  /* 회전하는 에너지 링 — 가는 호를 끊어 그린 여러 겹의 고리(회전이 눈에 보입니다) */
  function auraRingTexture(key, col) {
    var rgb = hexRgb(col);
    return canvasDraw('aura_ring_' + key, 256, 256, function (g, w, h) {
      var cx = w / 2, cy = h / 2, R = w / 2;
      g.clearRect(0, 0, w, h);
      var rings = [
        { r: 0.86, n: 30, dash: 0.62, a: 0.55, lw: 5 },
        { r: 0.72, n: 22, dash: 0.44, a: 0.4, lw: 4 },
        { r: 0.58, n: 16, dash: 0.3, a: 0.3, lw: 3 }
      ];
      for (var i = 0; i < rings.length; i++) {
        var rg = rings[i];
        var rad = R * rg.r;
        var step = Math.PI * 2 / rg.n;
        g.strokeStyle = rgbaOf(rgb, rg.a);
        g.lineWidth = rg.lw;
        g.lineCap = 'round';
        for (var k = 0; k < rg.n; k++) {
          var a0 = k * step;
          var a1 = a0 + step * rg.dash;
          /* 층마다 밝기를 조금씩 흔들어 손으로 그린 듯한 결 */
          g.globalAlpha = 0.55 + 0.45 * ((k * 7 + i * 3) % 5) / 5;
          g.beginPath();
          g.arc(cx, cy, rad, a0, a1);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      /* 링마다 아주 옅은 번짐 */
      var glow = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
      glow.addColorStop(0, rgbaOf(rgb, 0));
      glow.addColorStop(0.62, rgbaOf(rgb, 0.10));
      glow.addColorStop(1, rgbaOf(rgb, 0));
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
    });
  }

  /* 위로 은은하게 번지는 빛기둥(스포트라이트 반사) */
  function shaftTexture(col) {
    var rgb = hexRgb(col);
    return canvasDraw('aura_shaft_' + rgb, 32, 128, function (g, w, h) {
      var lg = g.createLinearGradient(0, h, 0, 0);
      lg.addColorStop(0, rgbaOf(rgb, 0.6));
      lg.addColorStop(0.3, rgbaOf(rgb, 0.2));
      lg.addColorStop(1, rgbaOf(rgb, 0));
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      var side = g.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,0)');
      side.addColorStop(0.5, 'rgba(0,0,0,1)');
      side.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  /* 바닥 오라 한 벌 — info 는 {color,color2,fx} (발동한 세트) */
  function buildFloorAura(T, info, y) {
    var g = new T.Group();
    g.position.set(0, y, 0);
    var col = (info && info.color) || '#7fd8ff';
    var col2 = (info && info.color2) || col;
    var out = { group: g, rings: [], rays: [], base: null, pool: null, shaft: null, color: col };

    function flat(w, h, tex, op) {
      var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({
        map: tex, transparent: true, opacity: op, blending: T.AdditiveBlending,
        depthWrite: false, side: T.DoubleSide
      }));
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      return m;
    }

    /* ① 가장 큰 방사형 글로우 (바닥에 번지는 빛) */
    out.base = flat(1300, 1300, auraDiscTexture(col), 0.5);
    /* ② 가운데 라이트 풀 — 발밑이 가장 밝게 젖은 느낌 */
    out.pool = flat(720, 720, floorPoolTexture(), 0.62);
    out.pool.material.color = new T.Color(col);
    out.pool.position.y = 1.6;
    /* ③ 서로 반대로 도는 에너지 링 2겹 */
    var ringA = flat(900, 900, auraRingTexture('a' + hexRgb(col), col), 0.62);
    var ringB = flat(640, 640, auraRingTexture('b' + hexRgb(col2), col2), 0.48);
    ringA.position.y = 2.4; ringB.position.y = 3.2;
    out.rings.push({ mesh: ringA, sp: 0.22, base: 0.62 }, { mesh: ringB, sp: -0.34, base: 0.48 });
    /* ④ 바닥을 쓸고 도는 빛줄기 8개 */
    var rayTex = streakTexture('aura_ray_' + hexRgb(col), hexRgb(col));
    for (var i = 0; i < 8; i++) {
      var ray = new T.Mesh(new T.PlaneGeometry(8, 430), new T.MeshBasicMaterial({
        map: rayTex, color: new T.Color(i % 2 ? col2 : col), transparent: true,
        opacity: 0.24, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      ray.rotation.x = -Math.PI / 2;
      ray.rotation.z = (i / 8) * Math.PI * 2;
      ray.position.y = 4.0;
      g.add(ray);
      out.rays.push({ mesh: ray, z0: (i / 8) * Math.PI * 2, sp: 0.26 + (i % 3) * 0.07 });
    }
    /* ⑤ 위로 은은하게 번지는 빛기둥 */
    out.shaft = new T.Mesh(
      new T.CylinderGeometry(155, 330, 560, 28, 1, true),
      new T.MeshBasicMaterial({
        map: shaftTexture(col), transparent: true, opacity: 0.15,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      })
    );
    out.shaft.position.y = 282;
    g.add(out.shaft);
    return out;
  }

  function animateFloorAura(fa, t) {
    if (!fa) return;
    var i;
    if (fa.base) fa.base.material.opacity = 0.44 + Math.sin(t * 1.1) * 0.06;
    if (fa.pool) fa.pool.material.opacity = 0.5 + Math.sin(t * 1.7 + 0.6) * 0.1;
    for (i = 0; i < fa.rings.length; i++) {
      var r = fa.rings[i];
      r.mesh.rotation.z = t * r.sp;
      var p = 1 + Math.sin(t * 1.35 + i) * 0.028;
      r.mesh.scale.set(p, p, 1);
      r.mesh.material.opacity = r.base + Math.sin(t * 2.1 + i * 1.7) * 0.12;
    }
    for (i = 0; i < fa.rays.length; i++) {
      var ry = fa.rays[i];
      ry.mesh.rotation.z = ry.z0 + t * ry.sp;
      ry.mesh.material.opacity = 0.12 + 0.18 * Math.abs(Math.sin(t * 1.15 + i * 0.9));
    }
    if (fa.shaft) fa.shaft.material.opacity = 0.11 + Math.sin(t * 1.4) * 0.045;
  }

  /* ---------- 번개 줄기 — 실제 번개처럼 꺾이는 다단 지그재그 ----------
   *  가운데를 흔들며 내려오는 주 줄기 + 중간에서 갈라지는 잔가지.
   *  배열(pairs)에 [x0,y0,z0, x1,y1,z1] 을 이어 붙입니다. */
  function boltArm(seed, x0, y0, z0, x1, y1, z1, segs, amp, pairs, spread) {
    var px = x0, py = y0, pz = z0;
    for (var s = 1; s <= segs; s++) {
      var t = s / segs;
      var nx = x0 + (x1 - x0) * t;
      var ny = y0 + (y1 - y0) * t;
      var nz = z0 + (z1 - z0) * t;
      /* 가운데가 가장 크게 흔들리고 양 끝은 제자리 (자연스러운 번개 모양) */
      var bend = Math.sin(t * Math.PI) * amp;
      /* 낮은 주파수의 큰 꺾임 + 높은 주파수의 잔떨림 — 실제 번개처럼 불규칙하게 */
      nx += Math.sin(seed * 3.7 + s * 2.9) * bend + Math.sin(seed * 7.9 + s * 5.3) * bend * 0.32
        + (Math.abs(Math.sin(seed * 11.3 + s * 7.7)) - 0.5) * bend * 0.5;
      ny += Math.cos(seed * 2.3 + s * 2.1) * bend * 0.35 + Math.cos(seed * 6.1 + s * 4.7) * bend * 0.16;
      nz += Math.cos(seed * 4.1 + s * 3.3) * (spread || 0) * bend * 0.5;
      pairs.push(px, py, pz, nx, ny, nz);
      px = nx; py = ny; pz = nz;
      /* 중간 지점에서 잔가지가 갈라져 나감 */
      if (s > 2 && s < segs - 1 && (s * 7 + Math.floor(seed * 100)) % 6 === 0) {
        var bx = nx + (Math.sin(seed + s) > 0 ? 1 : -1) * (26 + amp * 0.9);
        var by = ny - (10 + amp * 0.5);
        var bz = nz + Math.cos(seed + s) * 30;
        boltArm(seed * 1.7 + s, nx, ny, nz, bx, by, bz, 3, amp * 0.55, pairs, spread);
      }
    }
  }

  /* 줄기의 한 지점 — 빛덩이를 줄기 위에 정확히 앉히려고 같은 흔들림 식을 씁니다 */
  function boltPointAt(seed, def, fr) {
    var segs = 18;
    var s = Math.max(1, Math.min(segs, Math.round(fr * segs)));
    var t = s / segs;
    var bend = Math.sin(t * Math.PI) * def.amp;
    var x0 = def.x, x1 = def.x * 0.35, z0 = def.z, z1 = def.z * 0.4;
    return {
      x: x0 + (x1 - x0) * t + Math.sin(seed * 3.7 + s * 2.9) * bend,
      y: 640 + (-352 - 640) * t + Math.cos(seed * 2.3 + s * 2.1) * bend * 0.35,
      z: z0 + (z1 - z0) * t + Math.cos(seed * 4.1 + s * 3.3) * bend * 0.5
    };
  }

  /* 낙뢰 연출 한 벌 — 위(화면 밖)에서 바닥까지 내려치는 줄기 3개 + 착지 섬광 + 스파크 */
  function buildBolts(T, col, col2, tall) {
    var out = { kind: 'bolts', arms: [], coreMat: null, glowMat: null, land: null, sparks: null, beads: [] };
    var group = new T.Group();
    var rgb = hexRgb(col);
    var armDefs = [
      { x: -18, z: -34, amp: 46, w: 1.0 },
      { x: tall ? -300 : -170, z: -120, amp: 36, w: 0.66 },
      { x: tall ? 310 : 180, z: -86, amp: 40, w: 0.6 },
      { x: tall ? -120 : -90, z: -160, amp: 30, w: 0.42 },
      { x: tall ? 140 : 110, z: -140, amp: 32, w: 0.4 }
    ];
    for (var i = 0; i < armDefs.length; i++) {
      var d = armDefs[i];
      var geo = new T.BufferGeometry();
      var pairs = [];
      boltArm(i * 3.1 + 1.3, d.x, 640, d.z, d.x * 0.35, -352, d.z * 0.4, 24, d.amp, pairs, 1);
      var arr = new Float32Array(pairs);
      geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      var glowMat = new T.LineBasicMaterial({
        color: new T.Color(col), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      });
      var coreMat = new T.LineBasicMaterial({
        color: new T.Color(idx0White(i)), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      });
      var glow = new T.LineSegments(geo, glowMat);
      var core = new T.LineSegments(geo, coreMat);
      glow.frustumCulled = false; core.frustumCulled = false;
      core.scale.setScalar(1.004);
      /* 1px 선은 아무리 밝아도 가늘어서, 좌우로 아주 조금 어긋난 복사본을 겹쳐 굵게 보이게 */
      var haloMat = new T.LineBasicMaterial({
        color: new T.Color(col), transparent: true, opacity: 0,
        blending: T.AdditiveBlending, depthWrite: false
      });
      var halos = [];
      var HALO_OFF = [[1.9, 1.2, 0.34], [4.6, 3.0, 0.18], [9.0, 6.0, 0.1]];
      for (var ho = 0; ho < HALO_OFF.length; ho++) {
        var hm = new T.LineBasicMaterial({
          color: new T.Color(col), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false
        });
        var hl = new T.LineSegments(geo, hm);
        var hr = new T.LineSegments(geo, hm.clone());
        hl.frustumCulled = false; hr.frustumCulled = false;
        hl.position.set(HALO_OFF[ho][0], HALO_OFF[ho][1], 0);
        hr.position.set(-HALO_OFF[ho][0], -HALO_OFF[ho][1], 0);
        group.add(hl); group.add(hr);
        halos.push({ l: hl, r: hr, k: HALO_OFF[ho][2] });
      }
      group.add(glow); group.add(core);
      out.arms.push({ geo: geo, seed: i * 2.3, def: d, glowMat: glowMat, coreMat: coreMat, halos: halos });
      /* 줄기를 따라 붙는 빛덩이 — 1px 선만으로는 얇아서, 실제 번개처럼 굵게 빛나게 */
      for (var j = 0; j < 5; j++) {
        var bead = new T.Sprite(new T.SpriteMaterial({
          map: glowTexture('bolt_bead_' + i, rgb),
          color: new T.Color(j % 2 ? col2 : col),
          transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false
        }));
        group.add(bead);
        out.beads.push({ m: bead, arm: i, j: j, w: d.w || 1 });
      }
    }
    /* 착지 섬광 — 바닥에 번지는 빛 */
    out.land = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshBasicMaterial({
      map: auraDiscTexture(col2), color: new T.Color(col), transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    }));
    out.land.rotation.x = -Math.PI / 2;
    out.land.position.set(0, -348, 30);
    group.add(out.land);
    /* 착지 스파크 — 바닥에서 사방으로 튀는 작은 불티 */
    out.sparks = pointCloud(T, 90, 22, '#ffffff', glowTexture('set_spark_' + rgb, rgb), 0.95);
    out.sparks.visible = false;
    group.add(out.sparks);
    /* 화면을 하얗게 덮는 순간 섬광 (가산이라 배경을 태우지 않음) */
    out.flash = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture('set_flash_' + rgb, rgb), color: new T.Color(col2),
      transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    out.flash.position.set(0, 40, 700);
    out.flash.scale.set(1500, 1500, 1);
    group.add(out.flash);
    out.group = group;
    return out;
  }

  /* 줄기마다 아주 살짝 다른 흰색 — 완전히 같으면 한 덩어리로 보입니다 */
  function idx0White(i) { return i === 0 ? '#ffffff' : (i === 1 ? '#eef6ff' : '#fff6e6'); }

  /* ============================================================
   * bm-v1.96.0 — 화면 전체 낙하 연출 (얼음 · 불 · 별빛 · 금가루)
   *
   *  승우 님 요청:
   *    "좀더 번개떨어지는 것처럼 얼음도 떨어지고 불도 떨어지게 하면 안될까?
   *     공칠때 돌릴때 다 다른임팩트"  ·  "히든도 다 손봐줘"
   *
   *  · 번개(썬더 골드)만 화면 위에서 바닥까지 내려쳤고, 얼음·불은 라켓 둘레에
   *    낮게 머무는 입자뿐이었습니다. 이제 같은 스케일로 '쏟아집니다'.
   *  · 궤적은 순수 함수(rainDrop)라서 같은 (k, t, cfg)면 언제나 같은 자리입니다 —
   *    프레임이 밀려도 모양이 흐트러지지 않고 Node 테스트에서 그대로 검증합니다.
   *  · 조각은 처음에 한 번만 만들고 프레임마다 위치·회전만 다시 씁니다(생성 없음).
   *    바닥 파편은 몇 장을 돌려 씁니다. 별빛·금가루는 Points 하나로 그립니다.
   * ============================================================ */
  function rainCfg(kind, n, floorY, topY, seed) {
    var base = {
      ice:  { n: 26, speed: 0.82, spread: 1000, depth: 540, sway: 56, topY: 680 },
      fire: { n: 20, speed: 0.64, spread: 940, depth: 480, sway: 42, topY: 680 },
      star: { n: 24, speed: 0.5, spread: 1040, depth: 520, sway: 78, topY: 690 },
      gold: { n: 34, speed: 0.36, spread: 1080, depth: 500, sway: 96, topY: 700 }
    }[kind] || { n: 20, speed: 0.6, spread: 940, depth: 480, sway: 40, topY: 680 };
    return {
      kind: kind, n: n || base.n, speed: base.speed, spread: base.spread,
      depth: base.depth, sway: base.sway,
      topY: topY == null ? base.topY : topY,
      floorY: floorY == null ? -352 : floorY,
      seed: seed || 0
    };
  }

  /* 떨어지는 조각 하나의 상태 — life 0(화면 위) → 1(바닥) */
  function rainDrop(k, t, cfg) {
    var c = cfg || rainCfg('ice');
    var s0 = (c.seed || 0) + k * 1.37;
    var r1 = Math.abs(Math.sin(k * 12.9898 + s0 * 0.7)) % 1;
    var r2 = Math.abs(Math.sin(k * 7.233 + s0 * 1.9)) % 1;
    var r3 = Math.abs(Math.sin(k * 3.771 + s0 * 2.6)) % 1;
    var sp = (c.speed || 0.6) * (0.72 + r1 * 0.62);
    var life = (t * sp + r1 * 0.97 + k * 0.137) % 1;
    if (life < 0) life += 1;
    /* life² 로 떨어져 중력처럼 점점 빨라집니다(끝에서 정확히 바닥) */
    var y = c.topY + (c.floorY - c.topY) * life * life;
    var x = (r2 - 0.5) * c.spread + Math.sin(t * 1.5 + k * 1.7) * (c.sway || 0) * life;
    var z = (r3 - 0.5) * c.depth - 40;
    return {
      x: x, y: y, z: z, life: life, speed: sp,
      spin: t * (1.6 + r2 * 3.4) + k,
      tilt: r3,
      scale: 0.72 + r2 * 0.66,
      age: sp > 0 ? life / sp : 1     /* 바닥에 닿은 뒤 흐른 시간(초) */
    };
  }

  /* 손가락으로 돌린 각속도(rad/s) → 회전 잔상 세기 0~1 */
  function spinStrengthOf(prev, cur, dtMs) {
    if (!prev || !cur) return 0;
    var dt = Math.max(8, Math.min(140, Number(dtMs) || 16)) / 1000;
    var dy = (cur.yaw || 0) - (prev.yaw || 0);
    var dp = (cur.pitch || 0) - (prev.pitch || 0);
    var dr = (cur.roll || 0) - (prev.roll || 0);
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    var speed = (Math.abs(dy) + Math.abs(dp) * 1.15 + Math.abs(dr) * 0.9) / dt;
    /* 가만히 숨 쉬는 흔들림(≈0.2rad/s)은 지나가고, 손으로 돌리기 시작하면 살아납니다 */
    return clamp01((speed - 0.25) / 2.0);
  }

  /* 효과·세트 fx → 정타 임팩트 종류 (히든 7종은 각자 다른 폭발) */
  var IMPACT_MAP = {
    lightning: 'thunder', voidbolt: 'void', void: 'void', spark: 'thunder', thunder: 'thunder',
    snowstorm: 'ice', frost: 'ice', ice: 'ice', snow: 'ice',
    pillar: 'fire', flame: 'fire', fire: 'fire', blaze: 'fire', blossom: 'fire',
    cyclone: 'wind', wind: 'wind',
    confetti: 'gold', champion: 'gold', goldbolt: 'gold', prism: 'gold', gold: 'gold',
    cyber: 'neon', speed: 'neon',
    aurora: 'aurora'
  };
  function impactKindOf(fx) {
    return IMPACT_MAP[String(fx == null ? '' : fx)] || 'none';
  }

  /* 임의의 3D 점들을 잇는 빛 리본 (나선·오로라 아치처럼 미리 계산한 궤적용) */
  function trailRibbon(T, pts, w0, w1) {
    var pos = [], idx = [], i;
    var cam = new T.Vector3(0, 0, 1);
    for (i = 0; i < pts.length; i++) {
      var p = pts[i];
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var tan = new T.Vector3().subVectors(b, a).normalize();
      var side = new T.Vector3().crossVectors(tan, cam).normalize();
      if (!isFinite(side.x)) side.set(0, 1, 0);
      var u = i / Math.max(1, pts.length - 1);
      var wid = (w0 + (w1 - w0) * u) * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.04)));
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

  /* 낙하 연출 한 벌 — 3D 조각 + 머리 빛 + 바닥 파편 (또는 점 하나) */
  function buildRain(T, o) {
    o = o || {};
    var kind = o.kind || 'ice';
    var col = o.col || '#d5f0ff';
    var col2 = o.color2 || o.col2 || col;
    var rgb = hexRgb(col), rgb2 = hexRgb(col2);
    var cfg = rainCfg(kind, o.n, o.floorY, o.topY, o.seed || 0);
    var g = new T.Group();
    var out = {
      kind: kind, group: g, cfg: cfg, shards: [], bits: null, splashes: [],
      h: 0, col: col, col2: col2
    };
    var i;

    /* 별빛 · 금가루는 작은 점이라 Points 하나로(드로우콜 1) */
    if (kind === 'star' || kind === 'gold') {
      var tex = kind === 'gold' ? glowTexture('rain_gold_' + rgb, rgb)
        : glowTexture('rain_star_' + rgb, rgb2);
      var pts = pointCloud(T, cfg.n, kind === 'gold' ? 34 : 30, '#ffffff', tex, 0.92);
      g.add(pts);
      out.bits = { pts: pts, n: cfg.n, kind: kind };
      return out;
    }

    /* 얼음 고드름 · 화염 유성은 실제 3D 조각 — 각자 회전·늘어남이 달라야 자연스럽습니다.
     *  (InstancedMesh 는 SwiftShader/일부 안드로이드 WebGL 에서 셰이더 검증 경고가 나
     *   콘솔에 빨간 줄이 남아, 조각 수를 조금 줄이고 개별 메쉬로 그립니다.) */
    var geo, mat, h;
    if (kind === 'ice') {
      h = o.big ? 104 : 72;
      geo = new T.CylinderGeometry(0.8, o.big ? 8.4 : 5.6, h, 6, 1);
      mat = new T.MeshBasicMaterial({
        map: icicleTexture(rgb2), color: new T.Color(col2), transparent: true, opacity: 0.95,
        blending: T.AdditiveBlending, depthWrite: false
      });
    } else {
      h = o.big ? 132 : 92;
      geo = new T.ConeGeometry(o.big ? 11 : 7.5, h, 7, 1);
      mat = new T.MeshBasicMaterial({
        map: cometTexture(rgb), color: new T.Color(col2), transparent: true, opacity: 0.96,
        blending: T.AdditiveBlending, depthWrite: false
      });
    }
    out.h = h;
    for (i = 0; i < cfg.n; i++) {
      var m = new T.Mesh(geo, mat);
      m.frustumCulled = false;
      g.add(m);
      out.shards.push(m);
    }
    /* 머리 빛 — 조각 아래 끝에 붙는 작은 발광(가산). 조각 수의 절반만 붙여 가볍게 */
    var headTex = glowTexture('rain_head_' + kind + rgb2, rgb);
    var headMat = new T.SpriteMaterial({
      map: headTex, color: new T.Color(col2), transparent: true, opacity: 0.8,
      blending: T.AdditiveBlending, depthWrite: false
    });
    out.heads = [];
    for (i = 0; i < cfg.n; i += 2) {
      var hs = new T.Sprite(headMat);
      g.add(hs);
      out.heads.push({ m: hs, k: i });
    }
    /* 바닥 파편 — 조각이 닿는 자리에서 산산이 튀는 판/불꽃 */
    var sn = kind === 'ice' ? 12 : 10;
    for (i = 0; i < sn; i++) {
      var sm;
      if (kind === 'fire') {
        sm = new T.Sprite(new T.SpriteMaterial({
          map: flameTexture(), color: new T.Color(col2), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false
        }));
      } else {
        sm = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({
          map: frostBurstTexture(rgb2), color: new T.Color(col2), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
        }));
        sm.rotation.x = -Math.PI / 2;
      }
      sm.visible = false;
      g.add(sm);
      out.splashes.push({ m: sm, k: Math.round((i * cfg.n) / sn) % cfg.n });
    }
    return out;
  }

  /* 낙하 조각을 프레임마다 새 자리로 (메시 생성 없음 · 위치·회전만) */
  function animateRain(rain, t) {
    if (!rain) return;
    var cfg = rain.cfg, i;
    var mh = rain.h || 1;
    if (rain.bits) {
      var bp = rain.bits.pts.geometry.attributes.position;
      for (i = 0; i < rain.bits.n; i++) {
        var bd = rainDrop(i, t, cfg);
        bp.setXYZ(i, bd.x, bd.y, bd.z);
      }
      bp.needsUpdate = true;
      rain.bits.pts.material.opacity = 0.72 + Math.sin(t * 2.1) * 0.12;
      return;
    }
    for (i = 0; i < rain.shards.length; i++) {
      var dr = rainDrop(i, t, cfg);
      var m = rain.shards[i];
      var len = mh * dr.scale * (0.8 + 0.3 * Math.abs(Math.sin(t * 1.7 + i)));
      m.position.set(dr.x, dr.y, dr.z);
      if (rain.kind === 'ice') {
        m.rotation.set(Math.PI + Math.sin(t * 0.9 + i) * 0.22, dr.spin, Math.sin(t * 1.1 + i) * 0.3);
        m.scale.set(dr.scale, len / mh, dr.scale);
      } else {
        m.rotation.set(Math.PI * 0.97, dr.spin * 0.35, Math.sin(t * 1.3 + i) * 0.18);
        m.scale.set(dr.scale * 1.15, len / mh, dr.scale * 1.15);
      }
    }
    for (i = 0; i < rain.heads.length; i++) {
      var hd = rain.heads[i];
      var hdr = rainDrop(hd.k, t, cfg);
      var hlen = mh * hdr.scale;
      hd.m.position.set(hdr.x, hdr.y - hlen * 0.46, hdr.z + 2);
      var hsz = (rain.kind === 'fire' ? 96 : 58) * hdr.scale;
      hd.m.scale.set(hsz, hsz, 1);
      hd.m.material.opacity = 0.72;
    }

    /* 바닥 파편 — life 가 0 근처면 방금 닿았다는 뜻이라 그 자리에서 터집니다 */
    for (i = 0; i < rain.splashes.length; i++) {
      var s = rain.splashes[i];
      var dd = rainDrop(s.k, t, cfg);
      var age = dd.age, dur = rain.kind === 'ice' ? 0.5 : 0.62;
      if (age > dur) { s.m.visible = false; continue; }
      var p = 1 - age / dur;
      s.m.visible = true;
      if (rain.kind === 'fire') {
        var fs = 70 + (1 - p) * 170;
        s.m.position.set(dd.x, cfg.floorY + 26 + (1 - p) * 96, dd.z);
        s.m.scale.set(fs, fs * 1.5, 1);
        s.m.material.opacity = p * p * 0.9;
      } else {
        var isz = 70 + (1 - p) * 300;
        s.m.position.set(dd.x, cfg.floorY + 8, dd.z);
        s.m.scale.set(isz, isz, 1);
        s.m.material.opacity = p * p * 0.85;
      }
    }
  }

  /* ---------- 히든·공개 세트를 위한 대형 연출들 (bm-v1.96.0) ---------- */

  /* 팬텀 — 바닥 보이드 균열: 가운데서 사방으로 갈라진 보랏빛 금 */
  function buildFloorRift(T, col, col2, floorY) {
    var g = new T.Group();
    var pos = [], i, s;
    for (i = 0; i < 18; i++) {
      var a = (i / 18) * Math.PI * 2 + (i % 3) * 0.21;
      var r0 = 40 + (i % 5) * 14;
      var len = 230 + (i % 7) * 92;
      for (s = 0; s < 4; s++) {
        var t0 = s / 4, t1 = (s + 1) / 4;
        var jx = Math.sin(i * 3.1 + s * 2.3) * 26;
        var jz = Math.cos(i * 2.7 + s * 1.9) * 18;
        pos.push(Math.cos(a) * (r0 + len * t0) + jx, floorY + 4, Math.sin(a) * (r0 + len * t0) * 0.55 + jz);
        pos.push(Math.cos(a) * (r0 + len * t1) + jx * 1.4, floorY + 4, Math.sin(a) * (r0 + len * t1) * 0.55 + jz * 1.4);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    var lines = new T.LineSegments(geo, new T.LineBasicMaterial({
      color: new T.Color(col), transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, depthWrite: false
    }));
    lines.frustumCulled = false;
    g.add(lines);
    var glow = new T.Mesh(new T.PlaneGeometry(1000, 1000), new T.MeshBasicMaterial({
      map: auraDiscTexture(col), color: new T.Color(col2), transparent: true, opacity: 0.2,
      blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = floorY + 6;
    g.add(glow);
    return { group: g, lines: lines, glow: glow };
  }

  /* 팬텀 — 머리 위에서 도는 어둠 소용돌이 판 2겹 */
  function buildVortexDisc(T, col, col2) {
    var g = new T.Group();
    var a = new T.Mesh(new T.PlaneGeometry(1240, 1240), new T.MeshBasicMaterial({
      map: auraRingTexture('vortex_' + hexRgb(col), col), color: new T.Color(col),
      transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    }));
    a.position.set(0, 320, -200);
    var b = new T.Mesh(a.geometry, new T.MeshBasicMaterial({
      map: auraRingTexture('vortex_' + hexRgb(col2), col2), color: new T.Color(col2),
      transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
    }));
    b.position.set(0, 450, -280);
    b.scale.set(0.72, 0.72, 1);
    g.add(a); g.add(b);
    return { group: g, a: a, b: b };
  }

  /* 블리자드 — 화면 위에서 비스듬히 내려꽂히는 거대 얼음 창 */
  function buildIceSpears(T, col, col2, floorY) {
    var g = new T.Group();
    var geo = new T.CylinderGeometry(0.6, 26, 320, 6, 1);
    var mat = new T.MeshBasicMaterial({
      map: icicleTexture(hexRgb(col2)), color: new T.Color(col2), transparent: true, opacity: 0.42,
      blending: T.AdditiveBlending, depthWrite: false
    });
    var spears = [], i;
    for (i = 0; i < 6; i++) {
      var m = new T.Mesh(geo, mat);
      var a = (i / 6) * Math.PI * 2 + 0.4;
      var rad = 220 + (i % 3) * 70;
      m.position.set(Math.cos(a) * rad, floorY + 168 + (i % 2) * 40, Math.sin(a) * rad * 0.5 - 40);
      m.rotation.set(Math.PI + Math.sin(a) * 0.14, a, Math.cos(a) * 0.16);
      m.scale.set(1, 0.6 + (i % 3) * 0.22, 1);
      g.add(m);
      spears.push({ m: m, seed: i * 1.7, y0: m.position.y });
    }
    return { group: g, spears: spears, mat: mat };
  }

  /* 불사조 — 라켓 뒤로 펴지는 거대 불새 날개 2장 */
  function buildFireWings(T, col, col2, floorY) {
    var g = new T.Group();
    var tex = wingTexture(hexRgb(col), hexRgb(col2));
    var wings = [], i;
    for (i = 0; i < 2; i++) {
      var m = new T.Mesh(new T.PlaneGeometry(780, 350), new T.MeshBasicMaterial({
        map: tex, color: new T.Color(i ? col2 : col), transparent: true, opacity: 0.46,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      m.position.set(i ? 150 : -150, 70, -430);
      m.scale.x = i ? -1 : 1;
      g.add(m);
      wings.push({ m: m, side: i ? 1 : -1, seed: i * 1.3 });
    }
    return { group: g, wings: wings };
  }

  /* 사이클론 — 화면을 감싸며 위로 솟는 3D 바람 나선 3겹 */
  function buildWindHelix(T, col, col2, floorY) {
    var g = new T.Group();
    var helix = [], h, i;
    for (h = 0; h < 3; h++) {
      var pts = [];
      for (i = 0; i <= 46; i++) {
        var u = i / 46;
        var a = u * Math.PI * 2 * 2.2 + h * 2.1;
        var rad = 250 + 130 * Math.sin(u * Math.PI) + h * 28;
        pts.push(new T.Vector3(Math.cos(a) * rad, floorY + 40 + u * 640, Math.sin(a) * rad * 0.55));
      }
      var m = new T.Mesh(trailRibbon(T, pts, 26, 9), new T.MeshBasicMaterial({
        map: streakTexture('helix' + h + hexRgb(h % 2 ? col2 : col), hexRgb(h % 2 ? col2 : col)),
        color: new T.Color(h % 2 ? col2 : col), transparent: true, opacity: 0.34,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      g.add(m);
      helix.push({ m: m, seed: h * 2.1, sp: 0.9 + h * 0.25 });
    }
    return { group: g, helix: helix };
  }

  /* 네온 사이버 — 바닥에서 솟는 데이터 기둥 + 위아래로 훑는 스캔 레이저 */
  function buildDataColumns(T, col, col2, floorY) {
    var g = new T.Group();
    var columns = [], scans = [], i, s;
    for (i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2 + 0.7;
      var rad = 230 + (i % 3) * 80;
      var m = new T.Mesh(new T.CylinderGeometry(14, 36, 640, 12, 1, true), new T.MeshBasicMaterial({
        map: shaftTexture(i % 2 ? hexRgb(col2) : hexRgb(col)), color: new T.Color(i % 2 ? col2 : col),
        transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      m.position.set(Math.cos(a) * rad, floorY + 330, Math.sin(a) * rad * 0.6 - 30);
      g.add(m);
      columns.push({ m: m, seed: i * 1.9 });
    }
    for (s = 0; s < 2; s++) {
      var sm = new T.Mesh(new T.PlaneGeometry(1320, 9), new T.MeshBasicMaterial({
        map: streakTexture('scan' + s + hexRgb(col), hexRgb(col)), color: new T.Color(col2),
        transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      sm.position.set(0, floorY + 140, -60);
      g.add(sm);
      scans.push({ m: sm, seed: s * 2.4 });
    }
    return { group: g, columns: columns, scans: scans };
  }

  /* 챔피언 골드 — 위에서 쏟아지는 트로피 광선 */
  function buildTrophyBeams(T, col, col2) {
    var g = new T.Group();
    var beams = [], i;
    for (i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      var m = new T.Mesh(new T.CylinderGeometry(16, 130, 780, 14, 1, true), new T.MeshBasicMaterial({
        map: shaftTexture(i % 2 ? hexRgb(col2) : hexRgb(col)), color: new T.Color(i % 2 ? col2 : col),
        transparent: true, opacity: 0.15, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      m.position.set(Math.cos(a) * 140, 340, Math.sin(a) * 96 - 90);
      m.rotation.z = -Math.cos(a) * 0.22;
      m.rotation.x = Math.sin(a) * 0.18;
      g.add(m);
      beams.push({ m: m, seed: i * 1.4 });
    }
    return { group: g, beams: beams };
  }

  /* 프리즘 오로라 — 하늘을 가로지르는 입체 오로라 아치 */
  function buildAuroraArcs(T, col, col2) {
    var g = new T.Group();
    var arcs = [], i, s;
    for (i = 0; i < 3; i++) {
      var pts = [];
      for (s = 0; s <= 30; s++) {
        var u = s / 30;
        pts.push(new T.Vector3(-840 + u * 1680,
          200 + Math.sin(u * Math.PI) * (270 + i * 70) + i * 40,
          -520 - i * 130 + Math.cos(u * Math.PI) * 80));
      }
      var m = new T.Mesh(trailRibbon(T, pts, 96, 96), new T.MeshBasicMaterial({
        map: auroraTexture('arc' + i + hexRgb(col), hexRgb(col), hexRgb(col2), i),
        color: new T.Color(i % 2 ? col2 : col), transparent: true, opacity: 0.42,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      g.add(m);
      arcs.push({ m: m, seed: i * 2.2 });
    }
    return { group: g, arcs: arcs };
  }

  /* 세트 없이 얼음·불 '효과'만 입었을 때도 같은 낙하가 보이게 (조각 수는 가볍게) */
  function buildWeatherScene(T, info, floorY) {
    var fx = (info && info.fx) || '';
    var kind = fx === 'fire' ? 'fire' : (fx === 'ice' ? 'ice' : '');
    if (!kind) return null;
    var g = new T.Group();
    var out = { fx: 'weather', kind: kind, group: g, bits: {}, color: info.color, color2: info.color2 };
    out.rain = buildRain(T, {
      kind: kind, col: info.color, col2: info.color2,
      n: kind === 'ice' ? 16 : 13, floorY: floorY, seed: 4.4
    });
    g.add(out.rain.group);
    return out;
  }

  /* ---------- 세트 특수 연출 한 벌 ---------- */
  function buildSetScene(T, info, floorY) {
    var fx = (info && info.fx) || '';
    if (!fx) return null;
    var col = info.color || '#ffd200';
    var col2 = info.color2 || col;
    var rgb = hexRgb(col), rgb2 = hexRgb(col2);
    var out = { fx: fx, color: col, color2: col2, bits: {}, strikeAt: -1e9, group: null };
    var g = new T.Group();
    out.group = g;

    if (fx === 'lightning' || fx === 'voidbolt') {
      var tall = fx === 'lightning';
      out.bolts = buildBolts(T, col, col2, tall);
      g.add(out.bolts.group);
      /* 하늘 높은 곳의 충전된 구름 빛 — 번개가 떨어지기 전 노리는 느낌 */
      var cloud = new T.Sprite(new T.SpriteMaterial({
        map: glowTexture('set_cloud_' + rgb, rgb), color: new T.Color(col),
        transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false
      }));
      cloud.position.set(0, 430, -160);
      cloud.scale.set(1100, 420, 1);
      g.add(cloud);
      out.cloud = cloud;
      out.gap = tall ? 2.9 : 3.8;
      out.strikeMs = tall ? 2.9 : 3.6;
      if (fx === 'voidbolt') {
        /* bm-v1.96.0 — 팬텀: 바닥 보이드 균열 + 머리 위 어둠 소용돌이 */
        out.bits.rift = buildFloorRift(T, col, col2, floorY);
        g.add(out.bits.rift.group);
        out.bits.vortex = buildVortexDisc(T, col, col2);
        g.add(out.bits.vortex.group);
      }
    } else if (fx === 'snowstorm' || fx === 'frost') {
      var n = fx === 'snowstorm' ? 460 : 200;
      var snow = pointCloud(T, n, fx === 'snowstorm' ? 22 : 16, '#ffffff',
        glowTexture('set_snow_' + rgb, '255,255,255'), 0.95);
      g.add(snow);
      out.bits.snow = { pts: snow, n: n, speed: fx === 'snowstorm' ? 1 : 0.45 };
      /* 서리 결정 — 헤드 둘레를 천천히 도는 반투명 조각 */
      var iceMat = new T.MeshStandardMaterial({
        color: new T.Color('#e8faff'), emissive: new T.Color(col), emissiveIntensity: 0.9,
        metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.7, flatShading: true
      });
      var crystals = [];
      var cn = fx === 'snowstorm' ? 10 : 14;
      for (var i = 0; i < cn; i++) {
        var cr = new T.Mesh(new T.ConeGeometry(3.6 + (i % 3), 15 + (i % 4) * 5, 4, 1), iceMat);
        g.add(cr);
        crystals.push(cr);
      }
      out.bits.crystals = crystals;
      /* 바닥에 깔리는 한기 — 옅게 퍼지는 안개 */
      var mist = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.MeshBasicMaterial({
        map: auraDiscTexture(col2), transparent: true, opacity: 0.22,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(0, floorY + 26, 0);
      g.add(mist);
      out.bits.mist = mist;
      /* bm-v1.96.0 — 번개처럼 화면 위에서 쏟아지는 고드름 비 + 바닥 얼음 파편 */
      out.rain = buildRain(T, {
        kind: 'ice', col: col, col2: col2, n: fx === 'snowstorm' ? 26 : 16,
        big: fx === 'snowstorm', floorY: floorY, seed: 3.1
      });
      g.add(out.rain.group);
      if (fx === 'snowstorm') {
        out.bits.spears = buildIceSpears(T, col, col2, floorY);
        g.add(out.bits.spears.group);
      }
    } else if (fx === 'pillar' || fx === 'flame') {
      var pillar = fx === 'pillar';
      var tongues = [];
      var count = pillar ? 26 : 14;
      for (var j = 0; j < count; j++) {
        var sp = new T.Sprite(new T.SpriteMaterial({
          map: flameTexture(),
          color: new T.Color(j % 3 === 0 ? col2 : (j % 3 === 1 ? col : '#ff5a18')),
          transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false
        }));
        /* 기둥은 위로 길게, 불꽃 오라는 바닥 둘레에 낮게 */
        var ang = (j / count) * Math.PI * 2;
        var rad = pillar ? 60 + (j % 4) * 34 : 230 + (j % 3) * 30;
        sp.position.set(Math.cos(ang) * rad, floorY + 30 + (pillar ? (j / count) * 260 : (j % 3) * 26), Math.sin(ang) * rad * 0.55 - 30);
        sp.scale.set(pillar ? 90 : 120, pillar ? 190 : 150, 1);
        g.add(sp);
        tongues.push({ m: sp, seed: j * 1.7, y0: sp.position.y, amp: pillar ? 40 + (j % 5) * 16 : 18 });
      }
      out.bits.flames = tongues;
      /* 솟아오르는 불티 */
      var embers = pointCloud(T, pillar ? 120 : 70, 30, '#ffffff',
        glowTexture('set_ember_' + rgb, '255,190,110'), 0.95);
      g.add(embers);
      out.bits.embers = { pts: embers, n: pillar ? 120 : 70 };
      var warm = new T.Mesh(new T.PlaneGeometry(1100, 1100), new T.MeshBasicMaterial({
        map: auraDiscTexture(col2), color: new T.Color(col), transparent: true, opacity: 0.32,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      }));
      warm.rotation.x = -Math.PI / 2;
      warm.position.set(0, floorY + 30, -10);
      g.add(warm);
      out.bits.warm = warm;
      /* bm-v1.96.0 — 위에서 떨어지는 화염 유성 + (불사조) 펼쳐지는 불새 날개 */
      out.rain = buildRain(T, {
        kind: 'fire', col: col, col2: col2, n: pillar ? 22 : 14,
        big: pillar, floorY: floorY, seed: 5.7
      });
      g.add(out.rain.group);
      if (pillar) {
        out.bits.wings = buildFireWings(T, col, col2, floorY);
        g.add(out.bits.wings.group);
      }
    } else if (fx === 'cyclone' || fx === 'cyber') {
      var rings = [];
      var rn = fx === 'cyclone' ? 3 : 2;
      for (var k = 0; k < rn; k++) {
        var tor = new T.Mesh(
          new T.TorusGeometry(150 + k * 62, fx === 'cyclone' ? 2.4 : 1.8, 8, 110),
          new T.MeshBasicMaterial({
            color: new T.Color(k % 2 ? col2 : col), transparent: true, opacity: 0.5,
            blending: T.AdditiveBlending, depthWrite: false
          })
        );
        tor.rotation.x = Math.PI / 2 + (fx === 'cyclone' ? 0.24 - k * 0.17 : 0.05);
        tor.position.set(0, floorY + 80 + k * 120, -20);
        g.add(tor);
        rings.push({ m: tor, sp: (k % 2 ? -1 : 1) * (fx === 'cyclone' ? 1.5 : 0.7) });
      }
      out.bits.rings = rings;
      var swirl = pointCloud(T, fx === 'cyclone' ? 190 : 130, 26, '#ffffff',
        glowTexture('set_swirl_' + rgb, rgb), 0.95);
      g.add(swirl);
      out.bits.swirl = { pts: swirl, n: fx === 'cyclone' ? 190 : 130 };
      if (fx === 'cyber') {
        /* 바닥 네온 그리드 — 라켓 발밑에 켜지는 전광판 */
        var pos = [];
        var half = 640, step = 80;
        for (var gg = -half; gg <= half; gg += step) {
          pos.push(-half, floorY + 18, gg, half, floorY + 18, gg);
          pos.push(gg, floorY + 18, -half, gg, floorY + 18, half);
        }
        var grid = new T.LineSegments(new T.BufferGeometry(), new T.LineBasicMaterial({
          color: new T.Color(col), transparent: true, opacity: 0.24,
          blending: T.AdditiveBlending, depthWrite: false
        }));
        grid.geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        grid.frustumCulled = false;
        g.add(grid);
        out.bits.grid = grid;
      }
      /* bm-v1.96.0 — 사이클론은 화면을 감싸는 3D 바람 나선, 사이버는 솟는 데이터 기둥 */
      if (fx === 'cyclone') {
        out.bits.helix = buildWindHelix(T, col, col2, floorY);
        g.add(out.bits.helix.group);
      } else {
        out.bits.columns = buildDataColumns(T, col, col2, floorY);
        g.add(out.bits.columns.group);
      }
    } else if (fx === 'confetti') {
      var gold = pointCloud(T, 260, 26, '#ffffff', glowTexture('set_confetti_' + rgb, rgb), 0.95);
      g.add(gold);
      out.bits.confetti = { pts: gold, n: 260 };
      /* 큰 금가루 반짝임 — 회전하며 내려오는 작은 판 */
      var flakes = [];
      var flakeMat = new T.MeshBasicMaterial({
        color: new T.Color(col2), transparent: true, opacity: 0.85,
        blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
      });
      for (var f = 0; f < 16; f++) {
        var fl = new T.Mesh(new T.PlaneGeometry(16, 9), flakeMat);
        g.add(fl);
        flakes.push({ m: fl, seed: f * 1.3 });
      }
      out.bits.flakes = flakes;
      /* bm-v1.96.0 — 하늘에서 쏟아지는 금가루 폭포 + 트로피 광선 */
      out.rain = buildRain(T, { kind: 'gold', col: col, col2: col2, n: 34, floorY: floorY, seed: 9.2 });
      g.add(out.rain.group);
      out.bits.beams = buildTrophyBeams(T, col, col2);
      g.add(out.bits.beams.group);
    } else if (fx === 'aurora') {
      var ribbons = [];
      for (var rb = 0; rb < 3; rb++) {
        var geo2 = new T.PlaneGeometry(1500, 300, 36, 2);
        var mesh = new T.Mesh(geo2, new T.MeshBasicMaterial({
          map: auroraTexture('aur' + rb + rgb, rgb, rgb2, rb),
          transparent: true, opacity: 0.34 - rb * 0.06, blending: T.AdditiveBlending,
          depthWrite: false, side: T.DoubleSide
        }));
        mesh.position.set((rb - 1) * 90, 90 - rb * 60, -420 - rb * 90);
        mesh.rotation.z = (rb - 1) * 0.12;
        g.add(mesh);
        ribbons.push({ m: mesh, base: mesh.geometry.attributes.position.array.slice(0), seed: rb * 2.1 });
      }
      out.bits.ribbons = ribbons;
      var shimmer = pointCloud(T, 110, 22, '#ffffff', glowTexture('set_aur_' + rgb, rgb2), 0.9);
      g.add(shimmer);
      out.bits.shimmer = { pts: shimmer, n: 110 };
      /* bm-v1.96.0 — 하늘을 가로지르는 입체 오로라 아치 + 무지개별빛 낙하 */
      out.bits.arcs = buildAuroraArcs(T, col, col2);
      g.add(out.bits.arcs.group);
      out.rain = buildRain(T, { kind: 'star', col: col, col2: col2, n: 26, floorY: floorY, seed: 11.4 });
      g.add(out.rain.group);
    } else if (fx === 'void') {
      var dark = pointCloud(T, 150, 26, '#ffffff', glowTexture('set_void_' + rgb, rgb), 0.95);
      g.add(dark);
      out.bits.void = { pts: dark, n: 150 };
      var dim = new T.Sprite(new T.SpriteMaterial({
        map: glowTexture('set_voiddim_' + rgb, rgb), color: new T.Color(col2),
        transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false
      }));
      dim.position.set(0, 40, -260);
      dim.scale.set(900, 900, 1);
      g.add(dim);
      out.bits.dim = dim;
      /* bm-v1.96.0 — 다크 오닉스도 바닥 균열과 어둠 소용돌이를 함께 */
      out.bits.rift = buildFloorRift(T, col, col2, floorY);
      g.add(out.bits.rift.group);
      out.bits.vortex = buildVortexDisc(T, col, col2);
      g.add(out.bits.vortex.group);
    }
    return out;
  }

  /* 오로라 커튼 텍스처 — 아래에서 위로 옅어지는 빛줄기 */  function auroraTexture(key, rgbA, rgbB, i) {
    return canvasDraw('aurora_' + key, 256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var lg = g.createLinearGradient(0, h, 0, 0);
      var a = i % 2 ? rgbB : rgbA;
      var b = i % 2 ? rgbA : rgbB;
      lg.addColorStop(0, rgbaOf(a, 0.55));
      lg.addColorStop(0.42, rgbaOf(b, 0.3));
      lg.addColorStop(1, rgbaOf(b, 0));
      g.fillStyle = lg;
      for (var x = 0; x < w; x += 8) {
        var hh = 0.55 + 0.45 * Math.abs(Math.sin(x * 0.06 + i));
        g.globalAlpha = 0.35 + 0.4 * hh;
        g.fillRect(x, h - h * hh, 7, h * hh);
      }
      g.globalAlpha = 1;
      var side = g.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,0)');
      side.addColorStop(0.12, 'rgba(0,0,0,1)');
      side.addColorStop(0.88, 'rgba(0,0,0,1)');
      side.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = side; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }

  /* 세트 연출을 걷어낼 때 지오메트리·재질만 정리합니다(텍스처는 캐시라 그대로) */
  function disposeGroup(g) {
    if (!g) return;
    try {
      g.traverse(function (o) {
        if (o.geometry) { try { o.geometry.dispose(); } catch (e) { /* 무시 */ } }
        if (o.material) {
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          for (var i = 0; i < mats.length; i++) { try { mats[i].dispose(); } catch (e2) { /* 무시 */ } }
        }
      });
    } catch (e3) { /* 무시 */ }
  }

  /* 세트 연출 시간 변화 */
  function animateSetScene(ss, t, burstAt) {
    if (!ss) return;
    var b = ss.bits || {}, i, k;
    /* bm-v1.96.0 — 화면 전체 낙하(얼음·불·별빛·금가루)는 세트·효과 모두 같은 함수로 */
    if (ss.rain) animateRain(ss.rain, t);
    if (b.rift) {
      b.rift.lines.material.opacity = 0.36 + Math.abs(Math.sin(t * 2.3)) * 0.42;
      b.rift.glow.material.opacity = 0.14 + Math.abs(Math.sin(t * 1.4 + 0.7)) * 0.14;
    }
    if (b.vortex) {
      b.vortex.a.rotation.z = t * 0.26;
      b.vortex.b.rotation.z = -t * 0.42;
      b.vortex.a.material.opacity = 0.22 + Math.sin(t * 1.1) * 0.08;
      b.vortex.b.material.opacity = 0.14 + Math.sin(t * 1.6 + 1) * 0.07;
    }
    if (b.spears) {
      for (i = 0; i < b.spears.spears.length; i++) {
        var SP = b.spears.spears[i];
        var sq = 0.55 + Math.abs(Math.sin(t * 1.25 + SP.seed)) * 0.75;
        SP.m.scale.y = sq;
        SP.m.position.y = SP.y0 - (1 - sq) * 90;
      }
      b.spears.mat.opacity = 0.28 + Math.abs(Math.sin(t * 1.7)) * 0.22;
    }
    if (b.wings) {
      for (i = 0; i < b.wings.wings.length; i++) {
        var WG = b.wings.wings[i];
        var flap = Math.sin(t * 2.3 + WG.seed);
        WG.m.rotation.y = WG.side * (0.22 + flap * 0.3);
        WG.m.rotation.z = flap * 0.06 * WG.side;
        WG.m.scale.y = Math.abs(WG.m.scale.x) * (0.94 + flap * 0.1);
        WG.m.material.opacity = 0.34 + Math.abs(flap) * 0.3;
      }
    }
    if (b.helix) {
      for (i = 0; i < b.helix.helix.length; i++) {
        var HX = b.helix.helix[i];
        HX.m.rotation.y = t * HX.sp;
        HX.m.material.opacity = 0.22 + Math.abs(Math.sin(t * 1.9 + HX.seed)) * 0.26;
      }
    }
    if (b.columns) {
      for (i = 0; i < b.columns.columns.length; i++) {
        var CL = b.columns.columns[i];
        CL.m.material.opacity = 0.1 + Math.abs(Math.sin(t * (1.4 + (i % 3) * 0.5) + CL.seed)) * 0.26;
      }
      for (i = 0; i < b.columns.scans.length; i++) {
        var SC = b.columns.scans[i];
        var ph = (t * 0.42 + SC.seed) % 1;
        SC.m.position.y = -352 + ph * 700;
        SC.m.material.opacity = 0.1 + Math.abs(Math.sin(ph * Math.PI)) * 0.34;
      }
    }
    if (b.beams) {
      for (i = 0; i < b.beams.beams.length; i++) {
        var BM2 = b.beams.beams[i];
        BM2.m.material.opacity = 0.14 + Math.abs(Math.sin(t * 1.15 + BM2.seed)) * 0.26;
        BM2.m.rotation.y = t * 0.12 + BM2.seed;
      }
    }
    if (b.arcs) {
      for (i = 0; i < b.arcs.arcs.length; i++) {
        var AR = b.arcs.arcs[i];
        AR.m.material.opacity = 0.34 + Math.abs(Math.sin(t * 0.7 + AR.seed)) * 0.26;
        AR.m.position.y = Math.sin(t * 0.5 + AR.seed) * 14;
      }
    }
    if (ss.bolts) {
      var B = ss.bolts;
      var gap = ss.gap || 2.9;
      var el = t - ss.strikeAt;
      if (burstAt > 0) {
        /* 발견 축하 — 1.4초 동안 줄기가 쉬지 않고 내리칩니다 */
        el = Math.min(0.45, (1400 - burstAt) / 1000 + 0.06);
        if (t - ss.strikeAt > gap) ss.strikeAt = t;
      } else if (el > gap) {
        ss.strikeAt = t;
        el = 0;
      }
      var on = el >= 0 && el < 0.46;
      if (burstAt > 0) on = true;
      var inten = on ? (1 - el / 0.46) * (0.55 + 0.45 * Math.abs(Math.sin(t * 43 + el * 31))) : 0;
      if (burstAt > 0) inten = 0.72 + 0.28 * Math.abs(Math.sin(t * 37));
      for (i = 0; i < B.arms.length; i++) {
        var arm = B.arms[i];
        if (on && Math.floor(el * 14) % 2 === 0) {
          /* 70ms 마다 줄기를 새로 뽑아 '찌지직' 떨리는 느낌 */
          var pairs = [];
          arm.curSeed = arm.seed + Math.floor(t * 12) * 0.71;
          boltArm(arm.curSeed, arm.def.x, 640, arm.def.z,
            arm.def.x * 0.35, -352, arm.def.z * 0.4, 24, arm.def.amp, pairs, 1);
          var pa = arm.geo.attributes.position;
          if (pa.count * 3 === pairs.length) { pa.array.set(pairs); pa.needsUpdate = true; }
        }
        arm.glowMat.opacity = inten * (arm.def.w || 1) * 0.9;
        arm.coreMat.opacity = inten * (arm.def.w || 1) * 0.95;
        if (arm.halos) {
          for (k = 0; k < arm.halos.length; k++) {
            arm.halos[k].l.material.opacity = inten * (arm.def.w || 1) * arm.halos[k].k;
            arm.halos[k].r.material.opacity = inten * (arm.def.w || 1) * arm.halos[k].k;
          }
        }
      }
      if (B.land) B.land.material.opacity = inten * 0.55;
      if (B.flash) B.flash.material.opacity = inten * 0.16;
      if (B.beads) {
        for (i = 0; i < B.beads.length; i++) {
          var bd = B.beads[i];
          var armB = B.arms[bd.arm];
          var fr = (bd.j + 0.5) / 5;
          var by2 = 640 + (-352 - 640) * fr;
          var bx2 = armB.def.x + (armB.def.x * 0.35 - armB.def.x) * fr;
          var bz2 = armB.def.z + (armB.def.z * 0.4 - armB.def.z) * fr;
          var bp = boltPointAt(armB.seed, armB.def, fr);
          bd.m.position.set(bp.x + Math.sin(t * 9 + bd.j) * 12, bp.y, bp.z - 2);
          /* 줄기 방향으로 길게 늘인 빛 — 동그란 덩어리(보케)가 아니라 굵은 줄기로 보이게 */
          var bs = (46 + (bd.j % 3) * 7) * (bd.w || 1);
          bd.m.scale.set(bs, bs * 5.4, 1);
          bd.m.material.rotation = Math.sin(t * 5 + bd.j) * 0.12;
          bd.m.material.opacity = inten * (0.3 + 0.16 * Math.abs(Math.sin(t * 23 + bd.j)));
        }
      }
      if (B.sparks) {
        B.sparks.visible = on;
        if (on) {
          var sp = B.sparks.geometry.attributes.position;
          for (k = 0; k < sp.count; k++) {
            var a = (k / sp.count) * Math.PI * 2 + k * 0.37;
            var sp2 = 40 + (k % 7) * 26 + el * 620;
            sp.setXYZ(k, Math.cos(a) * sp2, -346 + Math.sin(el * 9 + k) * 8 + (k % 5) * 6,
              Math.sin(a) * sp2 * 0.5 + 30);
          }
          sp.needsUpdate = true;
        }
      }
      if (ss.cloud) ss.cloud.material.opacity = 0.1 + inten * 0.16 + Math.sin(t * 0.9) * 0.04;
    }
    if (b.snow) {
      var sn = b.snow.pts.geometry.attributes.position;
      for (k = 0; k < b.snow.n; k++) {
        var r1 = Math.abs(Math.sin(k * 12.9898)) % 1;
        var r2 = Math.abs(Math.sin(k * 7.233)) % 1;
        var life = ((t * (0.07 + r1 * 0.06) * b.snow.speed + r1) % 1);
        var yy = 470 - life * 900;
        var drift = Math.sin(t * 0.9 + k) * 40 + life * 120;
        sn.setXYZ(k, (r2 - 0.5) * 1000 + drift, yy, (r1 - 0.5) * 420 - 60);
      }
      sn.needsUpdate = true;
    }
    if (b.crystals) {
      for (i = 0; i < b.crystals.length; i++) {
        var cr = b.crystals[i];
        var ang = t * 0.32 + (i / b.crystals.length) * Math.PI * 2;
        var rad = 170 + Math.sin(t * 0.7 + i) * 26;
        cr.position.set(Math.cos(ang) * rad, 10 + Math.sin(ang * 1.6 + i) * 150 - 40, -30 + Math.sin(ang) * 72);
        cr.rotation.set(t * 0.4 + i, t * 0.55 + i * 0.2, Math.sin(t + i) * 0.5);
        cr.scale.setScalar(0.9 + Math.sin(t * 2.2 + i) * 0.18);
      }
    }
    if (b.mist) b.mist.material.opacity = 0.16 + Math.sin(t * 0.8) * 0.06;
    if (b.flames) {
      for (i = 0; i < b.flames.length; i++) {
        var F = b.flames[i];
        var wob = Math.sin(t * (3.6 + (i % 3) * 0.7) + F.seed) * 0.16;
        F.m.position.y = F.y0 + Math.sin(t * 1.8 + F.seed) * F.amp * 0.4 + ((t * 26 + F.seed * 10) % 40);
        F.m.scale.set(1 + wob * 0.5, 1 + wob, 1);
        F.m.material.opacity = 0.38 + Math.abs(Math.sin(t * 4.2 + F.seed)) * 0.3;
      }
    }
    if (b.embers) {
      var em = b.embers.pts.geometry.attributes.position;
      for (k = 0; k < b.embers.n; k++) {
        var e1 = Math.abs(Math.sin(k * 9.71)) % 1;
        var e2 = Math.abs(Math.sin(k * 4.13)) % 1;
        var lifeE = ((t * (0.16 + e1 * 0.16) + e1) % 1);
        var ey = -340 + lifeE * 620;
        var spreadE = 70 + lifeE * 190;
        em.setXYZ(k, Math.cos(k * 2.3 + t * 0.9) * spreadE, ey, Math.sin(k * 1.7 + t * 0.7) * spreadE * 0.5 - 30);
      }
      em.needsUpdate = true;
    }
    if (b.warm) b.warm.material.opacity = 0.26 + Math.sin(t * 3.1) * 0.08;
    if (b.rings) {
      for (i = 0; i < b.rings.length; i++) {
        b.rings[i].m.rotation.z = t * b.rings[i].sp;
        b.rings[i].m.material.opacity = 0.36 + Math.abs(Math.sin(t * 1.7 + i)) * 0.28;
      }
    }
    if (b.swirl) {
      var sw = b.swirl.pts.geometry.attributes.position;
      for (k = 0; k < b.swirl.n; k++) {
        var s1 = Math.abs(Math.sin(k * 6.31)) % 1;
        var s2 = Math.abs(Math.sin(k * 3.17)) % 1;
        var lifeS = ((t * (0.24 + s1 * 0.2) + s1) % 1);
        var angS = t * (2.2 + s2 * 1.8) + s1 * Math.PI * 2;
        var radS = 90 + (1 - lifeS) * 260 + s2 * 40;
        sw.setXYZ(k, Math.cos(angS) * radS, -330 + lifeS * 560, Math.sin(angS) * radS * 0.4 - 20);
      }
      sw.needsUpdate = true;
    }
    if (b.grid) b.grid.material.opacity = 0.14 + Math.abs(Math.sin(t * 1.5)) * 0.14;
    if (b.confetti) {
      var cf = b.confetti.pts.geometry.attributes.position;
      for (k = 0; k < b.confetti.n; k++) {
        var c1 = Math.abs(Math.sin(k * 8.41)) % 1;
        var c2 = Math.abs(Math.sin(k * 2.77)) % 1;
        var lifeC = ((t * (0.06 + c1 * 0.05) + c1) % 1);
        var cx = (c2 - 0.5) * 900 + Math.sin(t * 1.1 + k) * 34;
        cf.setXYZ(k, cx, 460 - lifeC * 880, (c1 - 0.5) * 320 - 40);
      }
      cf.needsUpdate = true;
    }
    if (b.flakes) {
      for (i = 0; i < b.flakes.length; i++) {
        var FL = b.flakes[i];
        var lf = ((t * 0.12 + (FL.seed % 1)) % 1);
        FL.m.position.set(Math.sin(FL.seed * 3 + t * 0.8) * 300 + (i - 8) * 34, 450 - lf * 860, -60 + Math.cos(FL.seed + t) * 90);
        FL.m.rotation.set(t * 1.2 + FL.seed, t * 0.9, t * 1.6 + i);
        FL.m.material.opacity = 0.55 + Math.sin(t * 3 + i) * 0.3;
      }
    }
    if (b.ribbons) {
      for (i = 0; i < b.ribbons.length; i++) {
        var RB = b.ribbons[i];
        var pa2 = RB.m.geometry.attributes.position;
        var base = RB.base;
        for (k = 0; k < pa2.count; k++) {
          var bx = base[k * 3], by = base[k * 3 + 1];
          var wave = Math.sin(t * 0.7 + bx * 0.004 + RB.seed) * 26 + Math.sin(t * 1.1 + k * 0.12) * 8;
          pa2.setXYZ(k, bx, by + wave, base[k * 3 + 2]);
        }
        pa2.needsUpdate = true;
        RB.m.material.opacity = 0.26 + Math.sin(t * 0.8 + i) * 0.12;
      }
    }
    if (b.shimmer) {
      var sh = b.shimmer.pts.geometry.attributes.position;
      for (k = 0; k < b.shimmer.n; k++) {
        var h1 = Math.abs(Math.sin(k * 5.13)) % 1;
        var h2 = Math.abs(Math.sin(k * 2.41)) % 1;
        sh.setXYZ(k, (h1 - 0.5) * 800, 300 - ((t * 0.1 + h2) % 1) * 600, -300 - h2 * 200);
      }
      sh.needsUpdate = true;
    }
    if (b.void) {
      var vd = b.void.pts.geometry.attributes.position;
      for (k = 0; k < b.void.n; k++) {
        var v1 = Math.abs(Math.sin(k * 7.77)) % 1;
        var v2 = Math.abs(Math.sin(k * 3.31)) % 1;
        var angV = t * (0.6 + v1 * 0.9) + v1 * Math.PI * 2;
        var radV = 120 + v2 * 190 + Math.sin(t * 1.3 + k) * 20;
        vd.setXYZ(k, Math.cos(angV) * radV, 20 + Math.sin(angV * 1.3) * 220, -40 + Math.sin(angV * 0.9) * 110);
      }
      vd.needsUpdate = true;
    }
    if (b.dim) b.dim.material.opacity = 0.14 + Math.sin(t * 1.2) * 0.06;
  }

  /* ============================================================
   * 6. 셔틀콕 — 흰 코르크 머리 + 빨강·검정 밴드 + 깃 16장 (bm-v1.94.0)
   *
   *   예전에는 얇은 반구 하나에 베이지색이었고, 반구 윗부분이 뚫린 채라
   *   ‘셔틀 머리가 없다’고 느껴졌습니다. 지금은
   *     · 흰 코르크 덩어리(둥근 아래 · 넓은 어깨)를 크게 키우고
   *     · 깃이 붙는 자리에 빨강 밴드 → 검정 얇은 링 → 실밥 링을 차례로 두어
   *       어두운 스튜디오 조명에서도 머리 실루엣과 색 대비가 한눈에 보입니다.
   *   크기는 깃 길이(62) 대비 실제 셔틀콕 비율(코르크 지름 ≈ 깃 길이의 1/4)에 맞췄습니다.
   * ============================================================ */

  function buildShuttle(T) {
    var g = new T.Group();
    /* 흰 코르크 — 살짝 스스로 빛나게 해 어두운 배경에 묻히지 않게 */
    var corkMat = new T.MeshStandardMaterial({
      color: new T.Color('#fbf7ec'), roughness: 0.46, metalness: 0.04,
      emissive: new T.Color('#3a3324'), emissiveIntensity: 0.35
    });
    var bandMat = new T.MeshStandardMaterial({
      color: new T.Color('#cf3b2f'), roughness: 0.42, metalness: 0.06,
      emissive: new T.Color('#5a0f08'), emissiveIntensity: 0.45
    });
    var inkMat = new T.MeshStandardMaterial({
      color: new T.Color('#17181a'), roughness: 0.34, metalness: 0.12,
      emissive: new T.Color('#0b0c0d'), emissiveIntensity: 0.2
    });
    var threadMat = new T.MeshStandardMaterial({
      color: new T.Color('#f4efe2'), roughness: 0.85, metalness: 0.0,
      transparent: true, opacity: 0.92
    });
    var featherMat = new T.MeshStandardMaterial({
      color: new T.Color('#f7fbf7'), roughness: 0.72, metalness: 0.0,
      side: T.DoubleSide, transparent: true, opacity: 0.96
    });

    /* ① 코르크 몸통 — 아래는 둥글고 위로 갈수록 넓어지는 실제 셔틀콕 머리
     *    실제 셔틀콕 비율(코르크 지름 약 25mm : 깃 길이 약 62mm)에 맞춰 지름 24 로 키웠습니다.
     *    예전 반지름 6.4 는 화면에서 머리가 거의 점으로 보였습니다. */
    var cork = new T.Mesh(new T.SphereGeometry(12.0, 32, 24), corkMat);
    cork.position.y = -7.0;
    cork.scale.set(1, 0.92, 1);
    g.add(cork);
    /* 코르크 아래를 살짝 평평하게 깐 밑판 (바닥에 놓았을 때 자국) */
    var sole = new T.Mesh(new T.CylinderGeometry(5.4, 5.8, 1.0, 26), corkMat);
    sole.position.y = -17.6;
    g.add(sole);

    /* ② 빨강 밴드 — 깃이 붙는 자리 */
    var band = new T.Mesh(new T.CylinderGeometry(12.1, 12.35, 3.4, 34), bandMat);
    band.position.y = 4.6;
    g.add(band);
    /* ③ 검정 얇은 링 — 빨강 밴드 위, 깃 뿌리 경계 */
    /* 검정 링은 밴드와 겹치지 않게 조금 위·조금 넓게 — 겹치면 점선처럼 지글거립니다 */
    var ink = new T.Mesh(new T.CylinderGeometry(12.42, 12.46, 1.2, 34), inkMat);
    ink.position.y = 7.0;
    g.add(ink);
    /* ④ 실밥 링 — 코르크 가운데를 감은 실 (밀가루 빛 띠) */
    var thread = new T.Mesh(new T.TorusGeometry(11.9, 0.55, 6, 40), threadMat);
    thread.rotation.x = Math.PI / 2;
    thread.position.y = 0.4;
    g.add(thread);
    var thread2 = new T.Mesh(new T.TorusGeometry(11.7, 0.4, 6, 40), threadMat);
    thread2.rotation.x = Math.PI / 2;
    thread2.position.y = 2.1;
    g.add(thread2);

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
    var tilt = 0.44;
    for (i = 0; i < N; i++) {
      var a = (i / N) * Math.PI * 2;
      var out = new T.Vector3(Math.cos(a), 0, Math.sin(a));
      var axis = out.clone().multiplyScalar(Math.sin(tilt)).add(new T.Vector3(0, Math.cos(tilt), 0)).normalize();
      var zAxis = out.clone().sub(axis.clone().multiplyScalar(out.dot(axis))).normalize();
      var xAxis = new T.Vector3().crossVectors(axis, zAxis).normalize();
      var mat4 = new T.Matrix4().makeBasis(xAxis, axis, zAxis);
      var m = new T.Mesh(featherGeo, featherMat);
      m.quaternion.setFromRotationMatrix(mat4);
      m.position.copy(out).multiplyScalar(11.4);
      m.position.y = 6.0;
      g.add(m);
    }
    /* 깃 뿌리를 감싸는 한 줄 스티치 — 머리와 깃이 이어지는 경계를 뚜렷하게 */
    var stitch = new T.Mesh(
      new T.TorusGeometry(20.2, 0.5, 6, 44),
      new T.MeshBasicMaterial({ color: new T.Color('#dfe7e2'), transparent: true, opacity: 0.55 })
    );
    stitch.rotation.x = Math.PI / 2;
    stitch.position.y = 26;
    g.add(stitch);
    g.userData.cork = cork;
    g.userData.band = band;
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
    /* bm-v1.95.0 — 라켓 아래 바닥 오라 + 세트 특수 연출 */
    var floorAura = null, setScene = null, setBurstAt = 0, setBurstMs = 1400;

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
    var shuttleTrail = pointCloud(T, SH_N, 15, '#ffffff', glowTexture('sh_trail', '220,245,255'), 0.4);
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

    /* 정타 별섬광 — 뜨거운 코어가 한 순간 별처럼 터졌다가 짧게 남습니다 (bm-v1.94.0) */
    var star = new T.Sprite(new T.SpriteMaterial({
      map: starTexture(), transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, depthTest: false
    }));
    star.visible = false;
    scene.add(star);

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

    /* ============================================================
     * bm-v1.96.0 — ② 돌릴 때만 휘감기는 회전 잔상 (spin trail)
     *
     *  승우 님: "공칠때 돌릴때 다 다른임팩트"
     *   · 가만히 있을 때(숨쉬는 흔들림 ≈0.2rad/s)는 세기가 0 이라 아무것도 안 그립니다.
     *   · 손가락으로 돌리거나 트위스트·쇼케이스·플립 모션에서 각속도에 비례해
     *     헤드 테두리의 이동 경로를 따라 속성 색 리본이 길게 늘어납니다.
     *   · 꼭짓점 색(가산)으로 뒤로 갈수록 사그라져, 판이 아니라 빛줄기로 보입니다.
     * ============================================================ */
    var SPIN_N = 22;
    var spinHist = [], spinPower = 0, spinPrev = null, spinLastAt = 0;
    var spinPos = new Float32Array(SPIN_N * 2 * 3);
    var spinCol = new Float32Array(SPIN_N * 2 * 3);
    var spinGeo = new T.BufferGeometry();
    spinGeo.setAttribute('position', new T.BufferAttribute(spinPos, 3));
    spinGeo.setAttribute('color', new T.BufferAttribute(spinCol, 3));
    var spinIdx = [];
    for (var sIdx = 0; sIdx < SPIN_N - 1; sIdx++) {
      var sK = sIdx * 2;
      spinIdx.push(sK, sK + 1, sK + 3, sK, sK + 3, sK + 2);
    }
    spinGeo.setIndex(spinIdx);
    var spinMesh = new T.Mesh(spinGeo, new T.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0,
      blending: T.AdditiveBlending, depthWrite: false, depthTest: false, side: T.DoubleSide
    }));
    spinMesh.frustumCulled = false;
    spinMesh.visible = false;
    scene.add(spinMesh);
    var spinTmp = new T.Vector3(), spinTmp2 = new T.Vector3(), spinCam = new T.Vector3(0, 0, 1);

    /* 지금 입은 세트(없으면 효과)의 색 — 잔상·임팩트가 같은 테마 색을 씁니다 */
    function themeNow() {
      var look = lookOf(ctx);
      if (look.set) {
        var k0 = impactKindOf(look.set.fx);
        return { kind: k0 === 'none' ? 'thunder' : k0, col: look.set.color, col2: look.set.color2 || look.set.color, set: look.set.id };
      }
      var pal = (RC().smashPalette ? RC().smashPalette(look.effect.id) : null) || {};
      return {
        kind: impactKindOf(look.effect.id),
        col: pal.mid || look.effect.color || '#c6f24e',
        col2: pal.hot || '#ffffff', set: ''
      };
    }

    function spinColorOf() {
      var look = lookOf(ctx);
      if (look.set) return { col: look.set.color, col2: look.set.color2 || look.set.color };
      var pal = (RC().smashPalette ? RC().smashPalette(look.effect.id) : null) || {};
      return { col: pal.mid || look.effect.color || '#c6f24e', col2: pal.hot || '#ffffff' };
    }

    function updateSpinTrail(now) {
      var dt = spinLastAt ? now - spinLastAt : 16;
      spinLastAt = now;
      var cur = { yaw: aimG.rotation.y, pitch: aimG.rotation.x, roll: aimG.rotation.z };
      var target = spinStrengthOf(spinPrev, cur, dt);
      spinPrev = cur;
      /* 공을 칠 때는 스윙 아크·정타 연출이 주인공이라 잔상은 약하게만 */
      if (smashOn) target *= 0.18;
      /* 손을 떼도 잠깐 남아 흐르는 잔상이 '회전'처럼 보입니다(약 0.5초) */
      spinPower = target > spinPower ? target : spinPower * 0.90 + target * 0.10;
      if (spinPower < 0.015 || !parts) {
        if (spinHist.length) spinHist.length = 0;
        spinMesh.visible = false;
        return;
      }
      rootG.updateMatrixWorld(true);
      /* 테두리(림) 위의 점을 따라갑니다 — 라켓 축 위의 점은 yaw 회전에서 제자리라
       * 잔상이 생기지 않습니다(예전엔 그래서 거의 안 보였습니다). */
      var head = spinTmp.set(spec.rx * 0.95, spec.headCY, 0).applyMatrix4(parts.model.matrixWorld).clone();
      spinHist.push(head);
      while (spinHist.length > SPIN_N) spinHist.shift();
      var n = spinHist.length;
      if (n < 3) { spinMesh.visible = false; return; }
      var th = spinColorOf();
      var a3 = hexRgb(th.col).split(','), b3 = hexRgb(th.col2).split(',');
      var first = spinHist[0], last = spinHist[n - 1];
      for (var i = 0; i < SPIN_N; i++) {
        var src = i - (SPIN_N - n);
        var p = src < 0 ? first : spinHist[src];
        var pPrev = src <= 0 ? first : spinHist[src - 1];
        /* 기록이 아직 SPIN_N 개에 못 미치면 앞쪽은 전부 first —
         * 예전엔 spinHist[-12] 같은 자리를 읽어 'x' of undefined 로
         * 프레임 루프가 통째로 멈췄습니다 (bm-v1.96.0 수정). */
        var pNext = (src >= n - 1) ? last : (src + 1 < 0 ? first : spinHist[src + 1]);
        var tan = spinTmp.subVectors(pNext, pPrev);
        if (tan.lengthSq() < 0.0001) tan.set(0, 1, 0); else tan.normalize();
        var side = spinTmp2.crossVectors(tan, spinCam).normalize();
        if (!isFinite(side.x)) side.set(0, 1, 0);
        var u = i / (SPIN_N - 1);                       /* 0 = 가장 오래된 꼬리, 1 = 지금 */
        var wid = (6 + 64 * u) * (0.14 + 0.86 * Math.sin(Math.PI * Math.min(1, 0.06 + u)));
        var fade = Math.min(1, Math.pow(u, 1.05) * (0.7 + 2.1 * spinPower));
        spinPos[i * 6] = p.x + side.x * wid;
        spinPos[i * 6 + 1] = p.y + side.y * wid;
        spinPos[i * 6 + 2] = p.z + side.z * wid;
        spinPos[i * 6 + 3] = p.x - side.x * wid;
        spinPos[i * 6 + 4] = p.y - side.y * wid;
        spinPos[i * 6 + 5] = p.z - side.z * wid;
        spinCol[i * 6] = (a3[0] / 255) * fade;
        spinCol[i * 6 + 1] = (a3[1] / 255) * fade;
        spinCol[i * 6 + 2] = (a3[2] / 255) * fade;
        spinCol[i * 6 + 3] = (b3[0] / 255) * fade * 0.9;
        spinCol[i * 6 + 4] = (b3[1] / 255) * fade * 0.9;
        spinCol[i * 6 + 5] = (b3[2] / 255) * fade * 0.9;
      }
      spinGeo.attributes.position.needsUpdate = true;
      spinGeo.attributes.color.needsUpdate = true;
      spinMesh.visible = true;
      spinMesh.material.opacity = 1;
    }

    /* ============================================================
     * bm-v1.96.0 — ① 맞을 때의 테마별 임팩트 (히든 7종 각자 다른 폭발)
     *   · 천둥·보이드: 위에서 정타점까지 내리꽂히는 벼락
     *   · 얼음: 타점에서 사방으로 뻗는 거대 얼음 창
     *   · 불: 사방으로 퍼지며 솟는 불꽃 고리
     *   · 바람: 타점을 감싸며 도는 바람 고리
     *   · 금: 금가루 폭발 + 금빛 고리
     *   · 네온: 타점에서 솟는 데이터 기둥
     *   · 오로라: 부채꼴로 펴지는 오로라 섬광
     *   모든 조각은 처음에 한 번만 만들고, 정타마다 자리·색만 다시 씁니다.
     * ============================================================ */
    var kit = null;
    var up3 = new T.Vector3(0, 1, 0);

    function ensureKit() {
      if (kit) return kit;
      var K = { kind: 'none', col: '#ffffff', col2: '#ffffff', parts: {}, dirs: null };
      function mkSprite(tex, col) {
        var s = new T.Sprite(new T.SpriteMaterial({
          map: tex, color: new T.Color(col), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false, depthTest: false
        }));
        s.visible = false;
        scene.add(s);
        return s;
      }
      /* ① 벼락 줄기 — 모양 4개를 번갈아 써서 '찌지직' 떨리게 */
      var bolts = [], v, b;
      for (v = 0; v < 4; v++) {
        var pairs = [];
        for (b = 1; b <= 3; b++) {
          boltArm(v * 4.7 + b * 1.9, (b - 2) * 90, 780, -70, 0, 0, 0, 20, 54, pairs, 0.7);
        }
        var bg = new T.BufferGeometry();
        bg.setAttribute('position', new T.Float32BufferAttribute(pairs, 3));
        var bmat = new T.LineBasicMaterial({
          color: new T.Color('#ffffff'), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false
        });
        var bl = new T.LineSegments(bg, bmat);
        bl.frustumCulled = false;
        bl.visible = false;
        scene.add(bl);
        bolts.push({ mesh: bl, mat: bmat });
      }
      K.parts.bolt = bolts;
      /* ② 얼음 창 14개 — 개별 메쉬(InstancedMesh 는 일부 WebGL 에서 셰이더 검증 경고) */
      var spikeGeo = new T.ConeGeometry(10, 170, 5, 1);
      var spikeMat = new T.MeshBasicMaterial({
        map: icicleTexture('223,243,255'), color: new T.Color('#dff3ff'), transparent: true,
        opacity: 0.92, blending: T.AdditiveBlending, depthWrite: false
      });
      var spikes = [];
      for (var sp = 0; sp < 14; sp++) {
        var spm = new T.Mesh(spikeGeo, spikeMat);
        spm.visible = false;
        scene.add(spm);
        spikes.push(spm);
      }
      K.parts.spikes = { list: spikes, n: 14 };
      /* ③ 불꽃 고리 13송이 */
      var flames = [], f;
      for (f = 0; f < 13; f++) flames.push(mkSprite(flameTexture(), '#ffd166'));
      K.parts.flames = flames;
      /* ④ 바람 고리 3겹 */
      var winds = [], w2;
      for (w2 = 0; w2 < 3; w2++) {
        var tq = new T.Mesh(new T.TorusGeometry(1, 0.05, 8, 72), new T.MeshBasicMaterial({
          color: new T.Color('#b6ffe6'), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
        }));
        tq.visible = false;
        scene.add(tq);
        winds.push(tq);
      }
      K.parts.winds = winds;
      /* ⑤ 금가루 폭발 18알 — 개별 메쉬 */
      var goldGeo = new T.PlaneGeometry(34, 34);
      var gold = [];
      for (var gq = 0; gq < 18; gq++) {
        var gm2 = new T.Mesh(goldGeo, new T.MeshBasicMaterial({
          map: glowTexture('kit_gold', '255,229,140'), color: new T.Color('#ffd166'),
          transparent: true, opacity: 0.95, blending: T.AdditiveBlending,
          depthWrite: false, side: T.DoubleSide
        }));
        gm2.visible = false;
        scene.add(gm2);
        gold.push(gm2);
      }
      K.parts.gold = { list: gold, n: 18 };
      /* ⑥ 네온 기둥 6개 */
      var pillars = [], p2;
      for (p2 = 0; p2 < 6; p2++) {
        var pm = new T.Mesh(new T.CylinderGeometry(12, 12, 1, 10, 1, true), new T.MeshBasicMaterial({
          map: shaftTexture('#7cffd4'), color: new T.Color('#7cffd4'), transparent: true, opacity: 0,
          blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
        }));
        pm.visible = false;
        scene.add(pm);
        pillars.push(pm);
      }
      K.parts.pillars = pillars;
      /* ⑦ 오로라 섬광 3장 */
      var aur = [], q2;
      for (q2 = 0; q2 < 3; q2++) aur.push(mkSprite(auraDiscTexture('#c6ffe9'), '#9be7ff'));
      K.parts.aurora = aur;
      kit = K;
      return kit;
    }

    /* 정타마다 키트를 테마 색으로 새로 준비 */
    function applyKitTheme(theme) {
      ensureKit();
      kit.kind = theme.kind || 'none';
      kit.col = theme.col || '#ffffff';
      kit.col2 = theme.col2 || kit.col;
      var parts2 = kit.parts, i;
      for (i = 0; i < parts2.bolt.length; i++) {
        parts2.bolt[i].mesh.visible = false;
        parts2.bolt[i].mat.color = new T.Color(kit.col2);
      }
      for (i = 0; i < parts2.spikes.list.length; i++) {
        parts2.spikes.list[i].material.color = new T.Color(kit.col2);
        parts2.spikes.list[i].visible = false;
      }
      for (i = 0; i < parts2.flames.length; i++) {
        parts2.flames[i].material.color = new T.Color(kit.col2);
        parts2.flames[i].visible = false;
      }
      for (i = 0; i < parts2.winds.length; i++) {
        parts2.winds[i].material.color = new T.Color(kit.col2);
        parts2.winds[i].visible = false;
      }
      for (i = 0; i < parts2.gold.list.length; i++) {
        parts2.gold.list[i].material.color = new T.Color(kit.col2);
        parts2.gold.list[i].visible = false;
      }
      for (i = 0; i < parts2.pillars.length; i++) {
        parts2.pillars[i].material.color = new T.Color(kit.col2);
        parts2.pillars[i].visible = false;
      }
      for (i = 0; i < parts2.aurora.length; i++) {
        parts2.aurora[i].material.color = new T.Color(kit.col2);
        parts2.aurora[i].visible = false;
      }
      /* 조각이 퍼질 방향은 정타 때 한 번만 정합니다 */
      kit.dirs = [];
      for (i = 0; i < 20; i++) {
        var a = (i / 20) * Math.PI * 2 + i * 0.37;
        var up = (i % 3 === 0) ? 0.92 : ((i % 3 === 1) ? 0.22 : -0.3);
        kit.dirs.push(new T.Vector3(Math.cos(a), up, Math.sin(a) * 0.72 - 0.18).normalize());
      }
    }

    /* 정타 순간 — 키트가 타점 기준으로 다시 뿌려집니다 */
    function spawnKit() {
      if (!kit || kit.kind === 'none') return;
      var P = kit.parts, i;
      if (kit.kind === 'thunder' || kit.kind === 'void') {
        for (i = 0; i < P.bolt.length; i++) {
          var pairs = [];
          for (var b = 1; b <= 3; b++) {
            boltArm(i * 5.3 + b * 2.1 + Math.random() * 3, hitPos.x + (b - 2) * 96, hitPos.y + 820,
              hitPos.z - 90, hitPos.x, hitPos.y, hitPos.z, 20, 58, pairs, 0.7);
          }
          var pa = P.bolt[i].mesh.geometry.attributes.position;
          if (pa.count * 3 === pairs.length) { pa.array.set(pairs); pa.needsUpdate = true; }
        }
      }
      if (kit.kind === 'ice') {
        for (i = 0; i < P.spikes.list.length; i++) {
          var d = kit.dirs[i % kit.dirs.length];
          var o = P.spikes.list[i];
          o.position.copy(hitPos).addScaledVector(d, 40);
          o.quaternion.setFromUnitVectors(up3, d);
          o.scale.set(1, 0.3, 1);
          o.visible = true;
        }
      }
      if (kit.kind === 'fire') {
        for (i = 0; i < P.flames.length; i++) P.flames[i].visible = true;
      }
      if (kit.kind === 'wind') {
        for (i = 0; i < P.winds.length; i++) P.winds[i].visible = true;
      }
      if (kit.kind === 'gold') {
        for (i = 0; i < P.gold.list.length; i++) P.gold.list[i].visible = true;
      }
      if (kit.kind === 'neon') {
        for (i = 0; i < P.pillars.length; i++) P.pillars[i].visible = true;
      }
      if (kit.kind === 'aurora') {
        for (i = 0; i < P.aurora.length; i++) P.aurora[i].visible = true;
      }
    }

    /* 정타 뒤 시간(after ms)에 따른 테마 임팩트 */
    function updateKit(after) {
      if (!kit || kit.kind === 'none') return;
      var P = kit.parts, i, t = clamp01(after / 520);
      if (kit.kind === 'thunder' || kit.kind === 'void') {
        var vis = after < 320;
        var pick = vis ? Math.floor(after / 40) % P.bolt.length : -1;
        for (i = 0; i < P.bolt.length; i++) {
          P.bolt[i].mesh.visible = (i === pick);
          P.bolt[i].mat.opacity = vis ? 0.95 * (1 - after / 320) : 0;
        }
      }
      if (kit.kind === 'ice') {
        var grow = 0.16 + easeOut3(clamp01(after / 240)) * 1.0;
        for (i = 0; i < P.spikes.list.length; i++) {
          var d = kit.dirs[i % kit.dirs.length];
          var len = 90 + (170 * grow) * (i % 3 === 0 ? 1.35 : 1);
          var sm2 = P.spikes.list[i];
          sm2.position.copy(hitPos).addScaledVector(d, len * 0.5);
          sm2.quaternion.setFromUnitVectors(up3, d);
          sm2.scale.set(0.7 + grow * 0.6, len / 170, 0.7 + grow * 0.6);
          sm2.material.opacity = Math.max(0, 0.92 * (1 - t));
          sm2.visible = after < 460;
        }
      }
      if (kit.kind === 'fire') {
        for (i = 0; i < P.flames.length; i++) {
          var a = (i / P.flames.length) * Math.PI * 2 + i * 0.23;
          var rad = 40 + easeOut3(clamp01(after / 420)) * 330;
          var rise = 40 + easeOut3(clamp01(after / 380)) * 210;
          P.flames[i].position.set(hitPos.x + Math.cos(a) * rad, hitPos.y + rise * (0.5 + (i % 3) * 0.22),
            hitPos.z + Math.sin(a) * rad * 0.7);
          var fs = 70 + (1 - t) * 90;
          P.flames[i].scale.set(fs, fs * 1.5, 1);
          P.flames[i].material.opacity = Math.max(0, 0.9 * (1 - t) * (1 - t));
        }
      }
      if (kit.kind === 'wind') {
        for (i = 0; i < P.winds.length; i++) {
          var wm = P.winds[i];
          var sc = 40 + easeOut3(clamp01(after / 340)) * (360 + i * 90);
          wm.position.copy(hitPos);
          wm.position.y += i * 26;
          wm.scale.setScalar(sc);
          wm.rotation.set(Math.PI / 2 + i * 0.2, i * 0.3, after * 0.004 * (i % 2 ? -1 : 1));
          wm.material.opacity = Math.max(0, 0.85 * (1 - t));
        }
      }
      if (kit.kind === 'gold') {
        for (i = 0; i < P.gold.list.length; i++) {
          var gd = kit.dirs[i % kit.dirs.length];
          var gr = 30 + easeOut3(clamp01(after / 440)) * (220 + (i % 5) * 46);
          var gq2 = P.gold.list[i];
          gq2.position.copy(hitPos).addScaledVector(gd, gr);
          gq2.rotation.set(after * 0.006 + i, after * 0.004 + i * 0.7, i * 0.3);
          var gsz = (1 - t) * (0.9 + (i % 4) * 0.2) + 0.15;
          gq2.scale.set(gsz, gsz, 1);
          gq2.material.opacity = Math.max(0, 0.95 * (1 - t));
        }
      }
      if (kit.kind === 'neon') {
        for (i = 0; i < P.pillars.length; i++) {
          var a2 = (i / P.pillars.length) * Math.PI * 2 + 0.5;
          var hgt = 40 + easeOut3(clamp01(after / 300)) * (520 + (i % 3) * 90);
          var pm = P.pillars[i];
          pm.position.set(hitPos.x + Math.cos(a2) * (60 + (i % 2) * 50), hitPos.y + hgt * 0.5,
            hitPos.z + Math.sin(a2) * 46);
          pm.scale.set(1 + (i % 3) * 0.4, hgt, 1 + (i % 3) * 0.4);
          pm.material.opacity = Math.max(0, 0.7 * (1 - t));
        }
      }
      if (kit.kind === 'aurora') {
        for (i = 0; i < P.aurora.length; i++) {
          var au = P.aurora[i];
          var asc = 60 + easeOut3(clamp01(after / 460)) * (260 + i * 110);
          au.position.set(hitPos.x + (i - 1) * 40, hitPos.y + 30 + i * 24, hitPos.z);
          au.scale.set(asc, asc * 0.8, 1);
          au.material.opacity = Math.max(0, 0.8 * (1 - t));
        }
      }
    }

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
      /* 세트 조합 — 바닥 오라와 특수 연출을 다시 만듭니다 */
      if (floorAura) { scene.remove(floorAura.group); disposeGroup(floorAura.group); floorAura = null; }
      if (setScene) { scene.remove(setScene.group); disposeGroup(setScene.group); setScene = null; }
      if (look.set) {
        floorAura = buildFloorAura(T, look.set, floorY + 4);
        scene.add(floorAura.group);
        setScene = buildSetScene(T, look.set, floorY);
        if (setScene) {
          scene.add(setScene.group);
          setScene.strikeAt = (nowMs() % 100000) / 1000 + 0.1;
        }
        /* 스포트라이트 바닥도 세트 색으로 젖게 */
        pool.material.color = new T.Color(look.set.color);
        pool.material.opacity = 0.62;
        poolRing.material.color = new T.Color(look.set.color2 || look.set.color);
        poolRing.material.opacity = 0.26;
      } else {
        pool.material.color = new T.Color('#ffffff');
        pool.material.opacity = 0.5;
        poolRing.material.color = new T.Color('#d8ffd0');
        poolRing.material.opacity = 0.14;
        /* bm-v1.96.0 — 세트는 아니어도 얼음·불 '효과'만 입으면 같은 낙하가 보입니다 */
        var wKind = impactKindOf(look.effect.id);
        if (wKind === 'ice' || wKind === 'fire') {
          setScene = buildWeatherScene(T, { fx: wKind, color: look.effect.color, color2: '#ffffff' }, floorY);
          if (setScene) scene.add(setScene.group);
        }
      }
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
      modelG.position.x = 0;
      modelG.position.y = -spec.span / 2;
    }

    function prepareSmash(kind) {
      var RCx = RC();
      resetPose();
      aimG.rotation.set(viewMem.pitch, viewMem.yaw, 0);
      aimG.updateMatrixWorld(true);
      hitPos = headWorld(RCx.HIT_AT, kind);
      var pal0 = RCx.smashPalette(smashFx || 'none') || {};
      /* bm-v1.96.0 — 세트를 입고 있으면 그 세트의 색·종류로 정타 연출을 바꿉니다 */
      var th0 = themeNow();
      var cHot = th0.set ? th0.col2 : (pal0.hot || '#ffffff');
      var cMid = th0.set ? th0.col : (pal0.mid || pal0.hot || '#ffffff');
      applyKitTheme(th0);
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
      burstCol = new T.Color(cMid);
      burst.material.color = burstCol;
      burst.material.map = particleTexture();
      flash.material.map = glowTexture('hitflash_' + hexRgb(cHot), hexRgb(cHot));
      var ringCol = new T.Color(th0.set ? cHot : (pal0.ring || pal0.hot || '#ffffff'));
      shock.material.color = ringCol;
      shock2.material.color = new T.Color(th0.set ? cHot : (pal0.core || '#ffffff'));
      rays.material.color = new T.Color(cHot);
      impactGlow.material.color = new T.Color(th0.set ? cHot : (pal0.core || pal0.hot || '#ffffff'));
      star.material.color = new T.Color(th0.set ? cHot : (pal0.core || pal0.hot || '#ffffff'));
      star.scale.set(150, 150, 1);
      impactGlow.material.map = glowTexture('impact_glow_' + (smashFx || 'none') + hexRgb(cMid), hexRgb(cMid));
      shuttleTrail.material.color = new T.Color(cMid);
      speedLines.material.color = new T.Color(cHot);
      impactOn = false;
      burst.visible = false;
      flash.visible = false;
      star.visible = false;
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
        var u = i / Math.max(1, pts.length - 1);
        var wid = wid0 + (wid1 - wid0) * u;
        /* 양 끝은 폭을 0 에 가깝게 줄입니다 — 끝이 칼같이 잘린 판처럼 보이지 않게 (bm-v1.94.0) */
        var taper = Math.min(1, Math.sin(Math.PI * Math.min(1, u * 1.12)) * 2.6);
        wid *= 0.12 + 0.88 * Math.max(0, taper);
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
      /* bm-v1.95.0 — 히든 조합을 발견한 순간 그 세트 연출을 한 번 크게 터뜨립니다 */
      setburst: function (setId, holdMs) {
        var look = lookOf(ctx);
        if (setId && (!look.set || look.set.id !== setId)) return false;
        if (!setScene) return false;
        setBurstMs = Math.max(600, Math.min(8000, Number(holdMs) || 1400));
        setBurstAt = nowMs();
        setScene.strikeAt = (nowMs() % 100000) / 1000 - 0.05;
        renderFrame(nowMs());
        return true;
      },
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
        return {
          renderer: renderer, scene: scene, camera: camera, model: parts && parts.model, spec: spec,
          /* bm-v1.96.0 — 돌릴 때·맞을 때·떨어지는 연출이 서로 다른 상태인지 확인하는 값 */
          spin: function () { return spinPower; },
          ribbon: function () { return spinMesh.visible; },
          spinInfo: function () {
            return {
              n: spinHist.length, power: Math.round(spinPower * 100) / 100,
              head: spinHist.length ? [Math.round(spinHist[spinHist.length - 1].x), Math.round(spinHist[spinHist.length - 1].y), Math.round(spinHist[spinHist.length - 1].z)] : null,
              p0: [Math.round(spinPos[0]), Math.round(spinPos[1]), Math.round(spinPos[2])],
              p1: [Math.round(spinPos[3]), Math.round(spinPos[4]), Math.round(spinPos[5])],
              pLast: [Math.round(spinPos[(SPIN_N - 1) * 6]), Math.round(spinPos[(SPIN_N - 1) * 6 + 1])],
              camZ: Math.round(camera.position.z)
            };
          },
          impact: function () { return kit ? kit.kind : 'none'; },
          rain: function () { return setScene && setScene.rain ? setScene.rain.cfg.n : 0; },
          set: function () { return lookOf(ctx).set ? lookOf(ctx).set.id : ''; }
        };
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
          star.visible = false;
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
          /* 정타 반동 — 라켓면이 살짝 휘었다 떨리며 돌아옵니다 (bm-v1.94.0)
           * 몸통 회전은 그대로 두고 헤드 쪽에만 짧은 진동을 더해 ‘손에 남는 맛’을 만듭니다. */
          if (after >= 0) {
            var flexK = Math.max(0, 1 - after / 190);
            var wob = Math.sin(after / 24) * flexK * flexK;
            swingG.rotation.z += wob * 0.055;
            swingG.rotation.x += wob * 0.032;
            modelG.position.x = wob * 10;
          } else {
            modelG.position.x = 0;
          }
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
              star.visible = true;
              spawnImpact();
              spawnKit();       /* bm-v1.96.0 — 히든 테마별 폭발 */
            }
            var ft = clamp01(after / 220);
            if (flash.visible) {
              var fs = 90 + ft * 320;
              flash.scale.set(fs, fs, 1);
              flash.position.copy(hitPos);
              flash.material.opacity = 0.85 * (1 - ft);
              if (ft >= 1) flash.visible = false;
            }
            if (star.visible) {
              var stk = clamp01(after / 150);
              var sts = 150 + easeOut3(stk) * 460;
              star.scale.set(sts, sts, 1);
              star.position.copy(hitPos);
              star.material.opacity = 0.95 * (1 - stk) * (1 - stk);
              if (stk >= 1) star.visible = false;
            }
            updateImpact(after);
            updateBurst(after);
            updateKit(after);
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
      var tFx = (now % 100000) / 1000;
      animateEffect(parts.fx, tFx);
      /* 세트 조합 — 바닥 오라 + 특수 연출 (발견 직후에는 한 번 크게) */
      animateFloorAura(floorAura, tFx);
      var burstLeft = setBurstAt ? Math.max(0, setBurstMs - (now - setBurstAt)) : 0;
      if (setBurstAt && !burstLeft) setBurstAt = 0;
      animateSetScene(setScene, tFx, burstLeft);

      /* 접지 그림자 — 라켓이 기울면 살짝 흐려집니다 */
      shadow.material.opacity = 0.7 + Math.sin(now / 1400) * 0.04;

      /* bm-v1.96.0 — 돌릴 때의 회전 잔상 (가만히 있을 때는 그리지 않음) */
      updateSpinTrail(now);

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
        /* 뒤로 잔상이 늘어지게 — 같은 자리에 점이 겹치면 흰 얼룩이 되므로
         * 충분히 움직였을 때만 잔상을 쌓습니다 (bm-v1.94.0) */
        if (cl > 20) {
          var lastTrail = shHist.length ? shHist[shHist.length - 1] : null;
          if (!lastTrail || lastTrail.distanceToSquared(p0) > 120) {
            shHist.push(p0.clone());
            if (shHist.length > SH_N) shHist.shift();
          }
          shuttleTrail.visible = shHist.length > 3;
          shuttleTrail.material.opacity = 0.34;
          var stp = shuttleTrail.geometry.attributes.position;
          for (var si = 0; si < stp.count; si++) {
            var hp0 = shHist[Math.min(shHist.length - 1, si)];
            stp.setXYZ(si, hp0.x, hp0.y, hp0.z);
          }
          stp.needsUpdate = true;
          /* 아직 쌓인 잔상보다 점이 많으면 나머지는 그리지 않습니다 —
           * 예전에는 같은 자리에 점이 겹쳐 흰 사각 얼룩처럼 보였습니다 (bm-v1.94.0). */
          shuttleTrail.geometry.setDrawRange(0, shHist.length);
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
        /* 스쿼시 & 스트레치 — 진행 축(local y)은 눌리고 옆은 부푼 뒤 120ms 에 풀립니다.
         * 맞는 순간 모양이 일그러져야 ‘공이 실제로 맞았다’는 느낌이 납니다 (bm-v1.94.0). */
        var sq = 1 - easeOut3(clamp01(after / 120));
        shuttle.scale.set(1.25 * (1 + sq * 0.62) + tr * 1.2, (1.25 + tr * 1.2) * (1 - sq * 0.62), 1.25 * (1 + sq * 0.62) + tr * 1.2);
        var lastShot = shHist.length ? shHist[shHist.length - 1] : null;
        if (!lastShot || lastShot.distanceToSquared(shuttle.position) > 120) {
          shHist.push(shuttle.position.clone());
          if (shHist.length > SH_N) shHist.shift();
        }
        shuttleTrail.visible = shHist.length > 3;
        shuttleTrail.geometry.setDrawRange(0, shHist.length);
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
      /* bm-v1.95.0 — 세트 조합 연출(바닥 오라 회전·번개·눈)이 켜져 있으면
       * 쉬는 동안에도 30fps 로 계속 그립니다. 번개 연출은 놓치면 눈에 띄므로
       * 60ms(16fps) 대신 32ms 간격 — 스매시 중에는 그대로 매 프레임(60fps). */
      var idleGap = setScene ? 32 : 60;
      if (busy || (now - lastFrame > idleGap)) {
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
    /* bm-v1.96.0 — 떨어지는 궤적·회전 세기·임팩트 종류는 순수 함수(테스트에서 그대로 겁증) */
    rainCfg: rainCfg,
    rainDrop: rainDrop,
    spinStrengthOf: spinStrengthOf,
    impactKindOf: impactKindOf,
    buildRacket: buildRacket,
    buildShuttle: buildShuttle,
    brokenStringPlan: brokenStringPlan,
    bandGeometry: bandGeometry,
    gripSpiral: gripSpiral,
    _tex: function (k) { return TEX[k] || null; },
    _resetProbe: function () { webglProbe = null; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
