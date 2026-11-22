/* ============================================================
 * sharecard.js — 오운완 · 대회 인증 인스타 공유 카드 (bm-v1.57.0)
 *
 *  · 1080×1350 (4:5) 캔버스 한 장으로 만듭니다. 사진은 폰 안에서만 합성되고
 *    서버로 보내지 않습니다(업로드 없음 · 파일 선택 → 캔버스 → 저장/공유).
 *  · 두 가지 모드
 *      today — 오늘 운동(오운완): 운동 시간 · 승패/스코어(AI 점수) · 연속 일수를 크게
 *      comp  — 대회 인증: 대회명 · 급수/종목 · 성적(우승/준우승/3위/출전) · 파트너
 *  · 세 가지 출력
 *      court  — 사진 없이 바로 예쁜 다크 코트 카드(기본)
 *      photo  — 내 사진 위에 얹기(밝은 사진에서도 읽히게 아래 그라디언트·그림자)
 *      sticker— 배경 투명 PNG (인스타 스토리에 스티커처럼)
 *  · 문구·숫자 계산은 순수 함수(model*)로 두고, 그리기는 DOM 캔버스에서만 합니다
 *    (node 테스트에서는 model/filename/문구만 확인합니다).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;
  function dom() { return BM.domain; }

  var W = 1080, H = 1350;
  var ACCENT = '#c6f24e';
  var MINT = '#43dfa0';
  var FONT = '"Pretendard","Noto Sans KR","Noto Sans CJK KR","Apple SD Gothic Neo",Roboto,"Malgun Gothic",system-ui,sans-serif';

  var MODES = [
    { id: 'today', name: '오늘 운동', note: '오운완 · 운동 기록' },
    { id: 'comp', name: '대회 인증', note: '메달 · 상장 사진 위에' }
  ];

  var STYLES = [
    { id: 'court', name: '다크 코트 카드', note: '사진 없이 바로' },
    { id: 'photo', name: '내 사진 위에', note: '갤러리 · 카메라' },
    { id: 'sticker', name: '투명 스티커', note: '스토리에 붙이기' }
  ];

  var RESULTS = ['우승', '준우승', '3위', '출전'];

  /* ---------- 순수 모델 ---------- */

  /* 날짜 → '11/23 (일)' — 카드 아래 작게 들어가는 표기 */
  function dateLine(ymd) {
    var key = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    var m = Number(key.slice(5, 7)), d = Number(key.slice(8, 10));
    var wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(key + 'T00:00:00').getDay()];
    return m + '/' + d + ' (' + wd + ')';
  }

  /* 게임 배열 → '2승 1패' · '21:18' · '' (1경기면 스코어 그대로) */
  function scoreLine(record) {
    var rec = record || {};
    var games = (rec.games && rec.games.length) ? rec.games : (rec.score ? [rec.score] : []);
    if (!games.length) return { value: '', label: '', unit: '' };
    if (games.length === 1) {
      var g = games[0];
      var res = (dom() && dom().resultFromScore) ? dom().resultFromScore(g) : '';
      return { value: g.a + ':' + g.b, label: res ? res + ' · 스코어' : '스코어', unit: '' };
    }
    var sum = (dom() && dom().gamesSummary) ? dom().gamesSummary(games) : null;
    if (!sum) return { value: games.length + '경기', label: '경기', unit: '' };
    var parts = [];
    if (sum.wins) parts.push(sum.wins + '승');
    if (sum.losses) parts.push(sum.losses + '패');
    if (sum.draws) parts.push(sum.draws + '무');
    return { value: parts.join(' ') || games.length + '경기', label: '경기', unit: '' };
  }

  /* 오늘 운동 카드의 큰 숫자 2~3개: 운동 시간 · 승패/스코어(또는 AI 점수) · 연속 일수 */
  function todayBigs(record, opts) {
    opts = opts || {};
    var rec = record || {};
    var out = [];
    if (rec.minutes) out.push({ value: String(rec.minutes), unit: '분', label: '운동 시간' });
    var sc = scoreLine(rec);
    if (sc.value) out.push({ value: sc.value, unit: sc.unit, label: sc.label });
    else if (opts.aiScore) out.push({ value: String(opts.aiScore), unit: '점', label: 'AI 점수' });
    if (opts.streak && opts.streak >= 2) out.push({ value: String(opts.streak), unit: '일', label: '연속 기록', flame: true });
    return out.slice(0, 3);
  }

  /* 아래 작은 한 줄: 체육관 · 파트너/라이벌 · 날짜 */
  function todaySub(record, opts) {
    opts = opts || {};
    var rec = record || {};
    var meta = (dom() && dom().logMeta) ? dom().logMeta(rec) : {};
    var bits = [];
    if (opts.gym) bits.push('📍 ' + opts.gym);
    var people = [];
    if (opts.partner || meta.partner) people.push((opts.partner || meta.partner) + '와 함께');
    if (opts.rival || meta.rival) people.push('vs ' + (opts.rival || meta.rival));
    if (people.length) bits.push(people.join(' · '));
    var day = dateLine(rec.date || opts.date);
    if (day) bits.push(day);
    return bits.join('  ·  ');
  }

  function compModel(input) {
    input = input || {};
    var contest = String(input.contest || '').trim().slice(0, 24);
    var event = String(input.event || '').trim().slice(0, 20);
    var result = RESULTS.indexOf(input.result) >= 0 ? input.result : '출전';
    var partner = String(input.partner || '').trim().slice(0, 12);
    return {
      title: '대회 인증',
      contest: contest || '오늘의 대회',
      event: event,
      result: result,
      partner: partner,
      date: dateLine(input.date) || dateLine(U.ymd())
    };
  }

  /* 대회 카드 아래 한 줄: 급수/종목 · 파트너 · 날짜 */
  function compSub(m) {
    var bits = [];
    if (m.event) bits.push(m.event);
    if (m.partner) bits.push('파트너 ' + m.partner);
    if (m.date) bits.push(m.date);
    return bits.join('  ·  ');
  }

  /* 저장 파일 이름 — apps-insta-card-YYYYMMDD-모드.png */
  function filename(mode, ymd) {
    var key = String(ymd || U.ymd()).replace(/[^0-9]/g, '').slice(0, 8);
    return 'badminton-share-' + key + '-' + (mode === 'comp' ? 'contest' : 'today') + '.png';
  }

  /* 화면에 보여 줄 카드 요약(테스트·접근성 문구) */
  function summaryOf(spec) {
    var s = spec || {};
    if (s.mode === 'comp' && s.comp) {
      return ['대회 인증', s.comp.contest, s.comp.result, compSub(s.comp)].filter(Boolean).join(' / ');
    }
    var bigs = (s.bigs || []).map(function (b) { return b.value + (b.unit || ''); }).join(' · ');
    return [s.title, bigs, s.sub].filter(Boolean).join(' / ');
  }

  /* ---------- 캔버스 그리기 ---------- */
  function hasCanvas() {
    return typeof document !== 'undefined' && !!document.createElement;
  }

  function font(size, weight) { return (weight || 800) + ' ' + Math.round(size) + 'px ' + FONT; }

  function roundRect(g, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function fit(g, text, maxW, size, weight) {
    var s = size;
    g.font = font(s, weight);
    while (s > 20 && g.measureText(text).width > maxW) {
      s -= 2;
      g.font = font(s, weight);
    }
    return s;
  }

  function wrap(g, text, maxW, size, weight, maxLines) {
    var max = maxLines || 2;
    var src = String(text == null ? '' : text);
    g.font = font(size, weight);
    var lines = [], line = '', used = 0;
    for (var i = 0; i < src.length; i++) {
      var ch = src.charAt(i);
      var next = line + ch;
      if (g.measureText(next).width <= maxW || !line) { line = next; used = i + 1; continue; }
      lines.push(line);
      line = ch === ' ' ? '' : ch;
      used = i + 1;
      if (lines.length >= max) break;
    }
    if (line && lines.length < max) { lines.push(line); used = src.length; }
    if (used < src.length && lines.length) {
      /* 2줄을 넘는 이름은 마지막 줄 끝을 …로 */
      var last = lines[lines.length - 1].replace(/\s+$/, '');
      lines[lines.length - 1] = last + '…';
    }
    return lines.length ? lines : [''];
  }

  /* 다크 코트 배경 — 아래쪽에 아주 옅은 코트 선만. 글자를 가리지 않습니다. */
  function paintCourt(g) {
    var base = g.createLinearGradient(0, 0, W * 0.35, H);
    base.addColorStop(0, '#0b1713');
    base.addColorStop(0.5, '#07100d');
    base.addColorStop(1, '#040a08');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W * 0.8, H * 0.08, 10, W * 0.8, H * 0.08, W * 0.95);
    glow.addColorStop(0, 'rgba(198,242,78,0.14)');
    glow.addColorStop(0.4, 'rgba(67,223,160,0.05)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    /* 아래 빈자리는 얇은 구분선 하나로만 — 표처럼 보이지 않게 */
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(80, 1150);
    g.lineTo(W - 80, 1150);
    g.stroke();
    g.strokeStyle = 'rgba(198,242,78,0.6)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(80, 1150);
    g.lineTo(210, 1150);
    g.stroke();
    g.restore();
  }

  /* 사진 위 — 위아래를 살짝 어둡게 해 밝은 사진에서도 글씨가 또렷합니다 */
  function paintPhotoFilters(g) {
    var bottom = g.createLinearGradient(0, H * 0.3, 0, H);
    bottom.addColorStop(0, 'rgba(2,6,4,0)');
    bottom.addColorStop(0.5, 'rgba(2,6,4,0.5)');
    bottom.addColorStop(1, 'rgba(2,6,4,0.94)');
    g.fillStyle = bottom;
    g.fillRect(0, 0, W, H);
    var top = g.createLinearGradient(0, 0, 0, H * 0.22);
    top.addColorStop(0, 'rgba(2,6,4,0.5)');
    top.addColorStop(1, 'rgba(2,6,4,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, W, H * 0.22);
  }

  /* 로고 워터마크 — 같은 주소의 아이콘을 캔버스에 작게 */
  var logoImg = null, logoTried = false;
  function paintLogo(g, x, y, size, light) {
    if (logoImg) {
      try {
        roundRect(g, x, y, size, size, size * 0.24);
        g.save();
        g.clip();
        g.drawImage(logoImg, x, y, size, size);
        g.restore();
      } catch (e) { /* 그림을 못 그려도 글자 워터마크는 남습니다 */ }
      g.fillStyle = light ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.5)';
      g.font = font(24, 800);
      g.textAlign = 'left';
      g.fillText('BADMINTON', x + size + 16, y + size * 0.68);
      return;
    }
    g.fillStyle = light ? 'rgba(255,255,255,0.66)' : 'rgba(255,255,255,0.45)';
    g.font = font(26, 800);
    g.textAlign = 'left';
    g.fillText('BADMINTON', x, y + size * 0.72);
  }

  function loadLogo(cb) {
    if (logoTried || typeof Image === 'undefined') { if (cb) cb(); return; }
    logoTried = true;
    var img = new Image();
    img.onload = function () { logoImg = img; if (cb) cb(); };
    img.onerror = function () { if (cb) cb(); };
    img.src = 'icons/icon-192.png';
  }

  /* 카드 위·아래 머리줄 — 브랜드와 날짜는 작게만 */
  function drawHeader(g, spec, light) {
    g.textAlign = 'left';
    g.fillStyle = light ? 'rgba(255,255,255,0.72)' : 'rgba(198,242,78,0.72)';
    g.font = font(24, 800);
    g.fillText('BADMINTON', 80, 122);
    if (spec.date) {
      g.textAlign = 'right';
      g.fillStyle = light ? 'rgba(255,255,255,0.6)' : 'rgba(160,178,168,0.72)';
      g.font = font(24, 700);
      g.fillText(spec.date, W - 80, 122);
    }
    g.textAlign = 'left';
  }

  /* today 카드 — 큰 숫자 2~3개 (라벨은 숫자 아래 작게) */
  function drawBigs(g, bigs, y, light) {
    var list = bigs || [];
    if (!list.length) {
      /* 기록이 없을 때 — 깨진 숫자 대신 한 줄 안내 */
      g.textAlign = 'left';
      g.fillStyle = light ? 'rgba(255,255,255,0.8)' : 'rgba(180,196,188,0.9)';
      g.font = font(42, 800);
      g.fillText('오늘 기록을 먼저 남겨 주세요', 80, y - 30);
      return;
    }
    var n = list.length;
    var colW = (W - 160) / Math.max(1, n);
    var base = n === 1 ? 200 : n === 2 ? 150 : 112;
    list.forEach(function (b, i) {
      var cx = 80 + colW * i;
      var size = fit(g, String(b.value), colW - 26, base, 900);
      var vW = g.measureText(String(b.value)).width;
      g.textAlign = 'left';
      g.fillStyle = light ? '#ffffff' : '#f4f8f5';
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = light ? 22 : 0;
      g.fillText(String(b.value), cx, y);
      g.shadowBlur = 0;
      if (b.unit) {
        g.font = font(size * 0.3, 800);
        g.fillStyle = light ? 'rgba(255,255,255,0.85)' : ACCENT;
        g.fillText(b.unit, cx + vW + 12, y - 4);
      }
      g.fillStyle = light ? 'rgba(255,255,255,0.75)' : 'rgba(160,178,168,0.95)';
      g.font = font(28, 700);
      g.fillText((b.flame ? '🔥 ' : '') + String(b.label || ''), cx, y + 52);
    });
  }

  /* 출력별 자리 — 사진은 아래 1/3, 스티커는 판 안쪽, 코트는 가운데 */
  function layoutOf(style, mode) {
    if (style === 'photo') {
      return mode === 'comp'
        ? { eyebrow: 790, name: 900, badge: 1090, sub: 1190, logo: H - 116 }
        : { eyebrow: 800, bigs: 1010, sub: 1160, logo: H - 116 };
    }
    if (style === 'sticker') {
      return mode === 'comp'
        ? { eyebrow: 400, name: 505, badge: 715, sub: 860, logo: 1000 }
        : { eyebrow: 420, bigs: 730, sub: 900, logo: 1000 };
    }
    return mode === 'comp'
      ? { eyebrow: 380, name: 496, badge: 700, sub: 880, logo: 1236 }
      : { eyebrow: 400, bigs: 700, sub: 900, logo: 1236 };
  }

  function drawToday(g, spec) {
    var light = spec.style === 'photo';
    var L = layoutOf(spec.style, 'today');
    g.textAlign = 'left';
    if (light) {
      g.fillStyle = 'rgba(255,255,255,0.88)';
      g.font = font(32, 800);
      g.fillText('오늘 운동 · 오운완', 80, L.eyebrow);
    } else {
      g.fillStyle = ACCENT;
      g.font = font(28, 800);
      g.fillText('오늘 운동', 80, L.eyebrow);
      g.fillStyle = 'rgba(242,246,243,0.96)';
      g.font = font(78, 900);
      g.fillText(spec.headline || '오운완', 80, L.eyebrow + 100);
    }
    drawBigs(g, spec.bigs, L.bigs, light);
    if (spec.sub) {
      g.fillStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(180,196,188,0.95)';
      var s = fit(g, spec.sub, W - 160, 32, 700);
      g.font = font(s, 700);
      g.textAlign = 'left';
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = light ? 14 : 0;
      g.fillText(spec.sub, 80, L.sub);
      g.shadowBlur = 0;
    }
    paintLogo(g, 80, L.logo, 54, light);
  }

  function drawComp(g, spec) {
    var light = spec.style === 'photo';
    var m = spec.comp || compModel({});
    var L = layoutOf(spec.style, 'comp');
    g.textAlign = 'left';
    /* 트로피 + 이름표 */
    g.font = font(66, 700);
    g.fillStyle = ACCENT;
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = light ? 16 : 0;
    g.fillText('🏆', 80, L.eyebrow);
    g.shadowBlur = 0;
    g.fillStyle = light ? 'rgba(255,255,255,0.88)' : 'rgba(198,242,78,0.92)';
    g.font = font(30, 800);
    g.fillText('대회 인증', 172, L.eyebrow - 10);
    /* 대회명 — 최대 2줄 */
    var lines = wrap(g, m.contest, W - 160, 86, 900, 2);
    g.fillStyle = light ? '#ffffff' : '#f4f8f5';
    g.font = font(86, 900);
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = light ? 22 : 0;
    lines.forEach(function (ln, i) { g.fillText(ln, 80, L.name + i * 96); });
    g.shadowBlur = 0;
    /* 성적 배지 */
    var badge = m.result;
    g.font = font(38, 900);
    var bw = g.measureText(badge).width + 54;
    var by = L.badge + (lines.length - 1) * 96;
    g.fillStyle = badge === '출전' ? 'rgba(255,255,255,0.16)' : ACCENT;
    roundRect(g, 80, by - 54, bw, 72, 18);
    g.fill();
    g.fillStyle = badge === '출전' ? 'rgba(255,255,255,0.92)' : '#0a1410';
    g.fillText(badge, 80 + 27, by - 6);
    /* 급수/종목 · 파트너 · 날짜 */
    var sub = compSub(m);
    if (sub) {
      g.fillStyle = light ? 'rgba(255,255,255,0.9)' : 'rgba(180,196,188,0.95)';
      var s = fit(g, sub, W - 160, 32, 700);
      g.font = font(s, 700);
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = light ? 14 : 0;
      g.fillText(sub, 80, L.sub);
      g.shadowBlur = 0;
    }
    paintLogo(g, 80, L.logo, 54, light);
  }

  /* 투명 스티커 — 글자 뒤에 반투명 판 하나만 남기고 배경은 투명 */
  function paintStickerPlate(g, spec) {
    var h = spec.mode === 'comp' ? 880 : 800;
    var y = (H - h) / 2;
    g.save();
    g.fillStyle = 'rgba(6,12,9,0.76)';
    roundRect(g, 40, y, W - 80, h, 48);
    g.fill();
    g.strokeStyle = 'rgba(198,242,78,0.45)';
    g.lineWidth = 4;
    g.stroke();
    g.restore();
  }

  /* spec → 캔버스 (순수 그리기; 캔버스가 없으면 null) */
  function draw(canvas, spec, cb) {
    if (!canvas || !canvas.getContext) return null;
    var g = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    g.clearRect(0, 0, W, H);
    var s = spec || {};
    if (s.style === 'sticker') {
      paintStickerPlate(g, s);
    } else if (s.style === 'photo' && s.photo) {
      try {
        var img = s.photo;
        var scale = Math.max(W / img.width, H / img.height);
        var dw = img.width * scale, dh = img.height * scale;
        g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } catch (e) { paintCourt(g); }
      paintPhotoFilters(g);
    } else {
      paintCourt(g);
    }
    if (s.style !== 'sticker') drawHeader(g, s, s.style === 'photo');
    if (s.mode === 'comp') drawComp(g, s);
    else drawToday(g, s);
    if (typeof cb === 'function') cb(canvas);
    return canvas;
  }

  /* ---------- 저장 · 공유 ---------- */
  function download(blob, name) {
    if (typeof document === 'undefined') return false;
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) { /* 무시 */ }
      try { URL.revokeObjectURL(url); } catch (e) { /* 무시 */ }
    }, 400);
    return true;
  }

  /* PNG로 저장하거나, 공유 시트가 있으면 그쪽으로 (인스타 스토리로 바로) */
  function saveOrShare(canvas, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!canvas || !canvas.toBlob) { resolve({ ok: false, reason: 'no_canvas' }); return; }
      canvas.toBlob(function (blob) {
        if (!blob) { resolve({ ok: false, reason: 'no_blob' }); return; }
        var name = opts.name || filename(opts.mode);
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
        var canShare = !!(file && typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }));
        if (canShare) {
          navigator.share({ files: [file], title: opts.title || '배드민턴 공유 카드' })
            .then(function () { resolve({ ok: true, shared: true }); })
            .catch(function (err) {
              if (err && err.name === 'AbortError') { resolve({ ok: true, canceled: true }); return; }
              resolve({ ok: download(blob, name), shared: false, reason: 'share_failed' });
            });
          return;
        }
        resolve({ ok: download(blob, name), shared: false });
      }, 'image/png');
    });
  }

  /* ---------- 화면(시트) ---------- */
  var ui = null;   /* { mode, style, recordId, photo, gym, partner, rival, contest, event, result, partner2, date } */

  function initialState(ctx, opts) {
    opts = opts || {};
    var state = ctx && ctx.store ? ctx.store.state : {};
    var records = (state.data && state.data.records) || [];
    var rec = opts.record || records[0] || null;
    var me = state.me || {};
    var mp = ((state.data && state.data.matchProfiles) || []).filter(function (m) { return m.userKey === me.key; })[0] || {};
    var meta = rec && dom().logMeta ? dom().logMeta(rec) : {};
    return {
      mode: opts.mode === 'comp' ? 'comp' : 'today',
      style: 'court',
      recordId: rec ? rec.id : '',
      photo: null,
      gym: me.club || mp.club || '',
      partner: (meta && meta.partner) || '',
      rival: (meta && meta.rival) || '',
      contest: '',
      event: '',
      result: '우승',
      compPartner: '',
      date: U.ymd()
    };
  }

  function recordById(ctx, id) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var list = (state.data && state.data.records) || [];
    if (!id) return list[0] || null;
    return list.filter(function (r) { return String(r.id) === String(id); })[0] || list[0] || null;
  }

  function specOf(ctx) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var rec = recordById(ctx, ui.recordId);
    var stats = (state.data && state.data.stats) || {};
    if (ui.mode === 'comp') {
      var m = compModel({ contest: ui.contest, event: ui.event, result: ui.result, partner: ui.compPartner, date: ui.date });
      return { mode: 'comp', style: ui.style, comp: m, sub: compSub(m), photo: ui.photo, title: '대회 인증', date: m.date };
    }
    var an = (state.analysis && state.analysis.recordId && rec && String(state.analysis.recordId) === String(rec.id)) ? state.analysis : null;
    return {
      mode: 'today', style: ui.style, photo: ui.photo, title: '오늘 운동',
      headline: '오운완',
      bigs: todayBigs(rec, { streak: stats.streak, aiScore: an ? an.score : (rec && rec.score) }),
      sub: todaySub(rec, { gym: ui.gym, partner: ui.partner, rival: ui.rival }),
      date: dateLine(rec && rec.date)
    };
  }

  function field(label, name, value, opts) {
    opts = opts || {};
    return '<label class="flabel"><span>' + U.esc(label) + '</span>' +
      '<input type="text" data-sc-field="' + name + '" maxlength="' + (opts.max || 24) + '" ' +
      'placeholder="' + U.esc(opts.placeholder || '') + '" value="' + U.esc(value || '') + '"' +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '></label>';
  }

  function sheetBody(ctx) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var records = ((state.data && state.data.records) || []).slice(0, 5);
    var rec = recordById(ctx, ui.recordId);
    var modeTabs = '<div class="seg seg--wide sc__modes" role="tablist">' + MODES.map(function (m) {
      return '<button type="button" class="seg__btn' + (ui.mode === m.id ? ' is-on' : '') + '" data-sc-mode="' + m.id + '" role="tab" ' +
        'aria-selected="' + (ui.mode === m.id ? 'true' : 'false') + '">' + U.esc(m.name) + '</button>';
    }).join('') + '</div>';

    var picker = '';
    if (records.length > 1 && ui.mode === 'today') {
      picker = '<label class="flabel"><span>어느 일지로 만들까요</span><select data-sc-field="recordId">' +
        records.map(function (r) {
          return '<option value="' + U.esc(r.id) + '"' + (String(r.id) === String(ui.recordId) ? ' selected' : '') + '>' +
            U.esc(U.shortDay(r.date) + (r.minutes ? ' · ' + r.minutes + '분' : '') + ((r.done || []).length ? ' · ' + r.done.slice(0, 2).join('·') : '')) +
            '</option>';
        }).join('') + '</select></label>';
    }

    var todayFields = picker +
      '<div class="sc__grid">' +
      field('체육관', 'gym', ui.gym, { max: 20, placeholder: '예: ○○체육관' }) +
      field('함께 친 파트너', 'partner', ui.partner, { max: 12, placeholder: '비워도 돼요' }) +
      '</div>' +
      field('상대(라이벌)', 'rival', ui.rival, { max: 12, placeholder: '비워도 돼요' });

    var compFields =
      field('대회명', 'contest', ui.contest, { max: 24, placeholder: '예: ○○시 오픈 배드민턴 대회' }) +
      field('급수 · 종목', 'event', ui.event, { max: 20, placeholder: '예: B조 복식' }) +
      '<div class="field"><div class="field__label"><span>성적</span></div>' +
      '<div class="chips chips--wrap" data-sc-results>' + RESULTS.map(function (r) {
        return '<button type="button" class="chip' + (ui.result === r ? ' is-on' : '') + '" data-sc-result="' + r + '" ' +
          'aria-pressed="' + (ui.result === r ? 'true' : 'false') + '">' + r + '</button>';
      }).join('') + '</div></div>' +
      field('파트너', 'compPartner', ui.compPartner, { max: 12, placeholder: '비워도 돼요' });

    var emptyToday = ui.mode === 'today' && !rec;
    var emptyNote = emptyToday
      ? '<p class="notice sc__notice">일지가 아직 없어요. 일지를 저장하면 운동 시간 · 승패 · 연속 일수가 카드에 채워져요.</p>'
      : '';
    var stylePicks = '<div class="sc__styles">' + STYLES.map(function (s) {
      return '<button type="button" class="sc__style' + (ui.style === s.id ? ' is-on' : '') + '" data-sc-style="' + s.id + '">' +
        '<b>' + U.esc(s.name) + '</b><span>' + U.esc(s.note) + '</span></button>';
    }).join('') + '</div>';

    var photoBox = '<div class="sc__photo"' + (ui.style === 'photo' ? '' : ' hidden') + '>' +
      '<label class="btn btn--ghost btn--big sc__photobtn">' + BM.ui.icon('camera') +
      '<span>' + (ui.photo ? '사진 바꾸기' : '사진 고르기') + '</span>' +
      '<input type="file" accept="image/*" data-sc-photo hidden></label>' +
      '<p class="hint">사진은 폰 안에서만 합쳐져요 · 서버로 보내지 않아요</p></div>';

    return modeTabs + emptyNote +
      (ui.mode === 'today' ? todayFields : compFields) +
      stylePicks + photoBox +
      '<div class="sc__preview"><canvas class="sc__canvas" width="' + W + '" height="' + H + '" aria-label="공유 카드 미리보기"></canvas></div>' +
      '<p class="sc__summary" data-sc-summary></p>' +
      '<button type="button" class="btn btn--primary btn--big mt8" data-sc-save' + (emptyToday ? ' disabled' : '') + '>' +
      BM.ui.icon('send') +
      '<span>' + (emptyToday ? '일지를 먼저 저장해 주세요'
        : (ui.style === 'sticker' ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유')) + '</span></button>' +
      '<p class="hint">인스타 스토리에 올리면 4:5 카드가 화면에 꽉 차요. 투명 스티커는 사진 위에 붙이기 좋아요.</p>';
  }

  function paintPreview(wrap, ctx) {
    var canvas = wrap.querySelector('.sc__canvas');
    if (!canvas) return;
    var spec = specOf(ctx);
    draw(canvas, spec);
    var sum = wrap.querySelector('[data-sc-summary]');
    if (sum) sum.textContent = summaryOf(spec);
  }

  /* 사진 파일을 폰 안에서만 읽어 캔버스에 (업로드 없음) */
  function readPhoto(file, done) {
    if (!file || typeof FileReader === 'undefined') return;
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () { done(img); };
      img.onerror = function () { done(null); };
      img.src = String(reader.result || '');
    };
    reader.onerror = function () { done(null); };
    reader.readAsDataURL(file);
  }

  function open(ctx, opts) {
    if (!BM.ui || !BM.ui.openSheet) return null;
    ui = initialState(ctx, opts);
    var isBrowser = hasCanvas();
    if (!isBrowser) return null;
    loadLogo(function () { /* 로고가 늦게 와도 다음 미리보기에서 붙습니다 */ });
    var wrap = BM.ui.openSheet({
      title: '인스타 공유 카드',
      body: sheetBody(ctx),
      onMount: function (node) {
        paintPreview(node, ctx);

        function repaint() { paintPreview(node, ctx); }

        node.addEventListener('click', function (ev) {
          var mode = ev.target.closest('[data-sc-mode]');
          if (mode) {
            ev.preventDefault();
            if (ui.mode === mode.getAttribute('data-sc-mode')) return;
            ui.mode = mode.getAttribute('data-sc-mode');
            BM.ui.haptic(6);
            /* 시트를 닫았다 열지 않고 안쪽만 다시 그립니다 — 고른 사진·입력값 그대로 */
            var body = node.querySelector('.sheet__body');
            if (body) body.innerHTML = sheetBody(ctx);
            paintPreview(node, ctx);
            return;
          }
          var st = ev.target.closest('[data-sc-style]');
          if (st) {
            ev.preventDefault();
            ui.style = st.getAttribute('data-sc-style');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-style]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-sc-style') === ui.style);
            });
            var pb = node.querySelector('.sc__photo');
            if (pb) pb.hidden = ui.style !== 'photo';
            var saveLabel = node.querySelector('[data-sc-save] span');
            if (saveLabel) saveLabel.textContent = ui.style === 'sticker' ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유';
            BM.ui.haptic(6);
            repaint();
            return;
          }
          var chip = ev.target.closest('[data-sc-result]');
          if (chip) {
            ev.preventDefault();
            ui.result = chip.getAttribute('data-sc-result');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-result]'), function (b) {
              var on = b.getAttribute('data-sc-result') === ui.result;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            repaint();
            return;
          }
          if (ev.target.closest('[data-sc-save]')) {
            ev.preventDefault();
            var btn = ev.target.closest('[data-sc-save]');
            if (btn.dataset.busy === '1') return;
            btn.dataset.busy = '1';
            var canvas = node.querySelector('.sc__canvas');
            paintPreview(node, ctx);
            saveOrShare(canvas, { name: filename(ui.mode, U.ymd().replace(/-/g, '')), mode: ui.mode }).then(function (res) {
              btn.dataset.busy = '0';
              if (res && res.ok) {
                BM.ui.haptic(12);
                BM.ui.toast(res.shared ? '공유 창을 열었어요' : '카드를 저장했어요');
              } else if (!(res && res.canceled)) {
                BM.ui.toast('카드를 저장하지 못했어요', 'error');
              }
            });
            return;
          }
        });

        node.addEventListener('input', function (ev) {
          var f = ev.target.closest('[data-sc-field]');
          if (!f) return;
          var name = f.getAttribute('data-sc-field');
          ui[name] = f.value;
          if (name === 'recordId') {
            var rec = recordById(ctx, f.value);
            if (rec) { ui.recordId = f.value; }
          }
          repaint();
        });

        node.addEventListener('change', function (ev) {
          var file = ev.target.closest('[data-sc-photo]');
          if (!file || !file.files || !file.files[0]) return;
          var input = file;
          readPhoto(input.files[0], function (img) {
            if (!img) { BM.ui.toast('사진을 읽지 못했어요', 'error'); return; }
            ui.photo = img;
            ui.style = 'photo';
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-style]'), function (b) {
              b.classList.toggle('is-on', b.getAttribute('data-sc-style') === 'photo');
            });
            var pb = node.querySelector('.sc__photo');
            if (pb) pb.hidden = false;
            var lbl = node.querySelector('.sc__photobtn span');
            if (lbl) lbl.textContent = '사진 바꾸기';
            repaint();
            BM.ui.haptic(10);
          });
        });
      }
    });
    return wrap;
  }

  BM.sharecard = {
    W: W, H: H, MODES: MODES, STYLES: STYLES, RESULTS: RESULTS,
    open: open,
    draw: draw,
    saveOrShare: saveOrShare,
    download: download,
    todayBigs: todayBigs,
    todaySub: todaySub,
    scoreLine: scoreLine,
    compModel: compModel,
    compSub: compSub,
    dateLine: dateLine,
    filename: filename,
    summaryOf: summaryOf,
    _sheetBody: sheetBody,
    _setState: function (o) { ui = o; },
    _state: function () { return ui; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
