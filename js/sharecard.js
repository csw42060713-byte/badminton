/* ============================================================
 * sharecard.js — 인스타 공유 카드 (오늘 운동 · 대회 인증) (bm-v1.61.0)
 *
 *  · 사진은 폰 안에서만 합성되고 서버로 보내지 않습니다
 *    (파일 선택 → 캔버스 → 저장·공유). 업로드 없음.
 *  · 인스타 비율 2종 — 피드 4:5(1080×1350) · 스토리 9:16(1080×1920).
 *    스토리는 위·아래 220px를 비워 프로필·답장창에 글씨가 가리지 않습니다.
 *  · 디자인 3종 (사람이 찍어 올린 카드처럼)
 *      매거진 — 사진 풀블리드. 좌상단 얇은 날짜·장소, 하단 30% 소프트 그라데이션 위에
 *               아주 큰 숫자 + 얇은 가로선 1개 + 작은 스탯. 박스·테두리 없음.
 *      필름   — 따뜻한 오프화이트(#F7F5F0) 여백 프레임 안에 사진, 아래 여백에
 *               모노스페이스 날짜·체육관·스탯 한 줄과 작은 셔틀콕 스탬프.
 *      스티커 — 배경 투명 PNG. 얇은 글씨 + 큰 숫자 + 셔틀콕 라인 아이콘만.
 *  · 색은 5종(나이트·코트 블루·선셋·사쿠라·챔피언 골드)에서 포인트 1색만 씁니다.
 *  · 사진 밝기 3단계(원본·살짝 어둡게·감성 어둡게)로 밝은 체육관 사진에서도 글씨가 살아납니다.
 *  · 문구는 프리셋 5종(민턴일기 · 오늘도, 배드민턴 · 민턴기록 · 민턴성장기 · COURT TIME)에서
 *    한 번에 고르거나 '직접 쓰기'로 24자까지 씁니다. 고른 문구는 매거진 · 필름 · 스티커
 *    세 디자인 모두에 제목 줄로 들어가고, 마지막에 고른 디자인·비율·색·문구는
 *    이 기기(localStorage)에 가볍게 기억해 다음에 또 고르지 않아도 됩니다.
 *  · 문구·숫자 계산은 순수 함수(model*)로 두고, 그리기는 DOM 캔버스에서만 합니다
 *    (node 테스트에서는 문구 + 가짜 2D 컨텍스트로 그리기 호출을 확인합니다).
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;
  function dom() { return BM.domain; }

  var W = 1080, H = 1350;          /* 기본 = 피드 4:5 */
  var SAFE = 220;                  /* 스토리 위·아래 안전 여백(px) */
  var FONT = '"Pretendard","Noto Sans KR","Noto Sans CJK KR","Apple SD Gothic Neo",Roboto,"Malgun Gothic",system-ui,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Roboto Mono",ui-monospace,SFMono-Regular,Menlo,"Noto Sans Mono","Nanum Gothic Coding",monospace';

  var MODES = [
    { id: 'today', name: '오늘 운동', note: '민턴일기 · 운동 기록' },
    { id: 'comp', name: '대회 인증', note: '메달 · 상장 사진 위에' }
  ];

  var RESULTS = ['우승', '준우승', '3위', '출전'];

  /* ---------- 카드 문구 프리셋 (bm-v1.61.0) ----------
   * 실제 배드민턴 동호인·선수 인스타 게시물에서 가장 많이 쓰는 짧은 문구만 골랐습니다.
   * '직접 쓰기'는 입력칸에 포커스만 옮기고, 타이핑한 문구가 그대로 카드에 들어갑니다. */
  var PHRASES = [
    { id: 'mintern', text: '민턴일기', note: '매일 쓰는 기록' },
    { id: 'today', text: '오늘도, 배드민턴', note: '오늘 하루도' },
    { id: 'record', text: '민턴기록', note: '숫자로 남기기' },
    { id: 'growth', text: '민턴성장기', note: '느는 중' },
    { id: 'court', text: 'COURT TIME', note: '코트 위에서' }
  ];
  var PHRASE_MAX = 24;
  var DEFAULT_PHRASE = PHRASES[0].text;

  /* ---------- 비율 2종 (인스타) ---------- */
  var RATIOS = [
    { id: 'feed', name: '피드 4:5', note: '1080×1350', w: 1080, h: 1350, safe: 0 },
    { id: 'story', name: '스토리 9:16', note: '1080×1920 · 위아래 비움', w: 1080, h: 1920, safe: SAFE }
  ];

  /* ---------- 디자인(레이아웃) 3종 ---------- */
  var DESIGNS = [
    { id: 'magazine', name: '매거진', note: '사진 꽉 차게 · 큰 숫자' },
    { id: 'film', name: '필름', note: '폴라로이드 · 여백' },
    { id: 'sticker', name: '스티커', note: '투명 · 스토리에 붙이기' }
  ];

  /* ---------- 사진 밝기 3단계 ---------- */
  var SHADES = [
    { id: 'original', name: '원본', note: '사진 그대로', dim: 0 },
    { id: 'soft', name: '살짝 어둡게', note: '글씨 또렷하게', dim: 0.26 },
    { id: 'deep', name: '감성 어둡게', note: '필름 톤', dim: 0.46 }
  ];

  /* ---------- 색 5종 (포인트 1색) ----------
   * accent — 강조 글씨·단위·스탬프 / onAccent — 강조 바탕 위 글씨
   * bg     — 사진이 없을 때의 메쉬 그라데이션 바탕 / glow·glow2 — 그 위 은은한 빛
   * text·muted·soft — 사진 없이 만든 카드의 글씨
   * scrim  — 사진 아래를 어둡게 스며들게 하는 색(RGB) */
  var PALETTES = [
    { id: 'night', name: '나이트', note: '딥 그린 · 네온 라임',
      bg: ['#0d1a15', '#08120e', '#040a08'],
      glow: 'rgba(198,242,78,0.20)', glow2: 'rgba(67,223,160,0.10)',
      accent: '#c6f24e', onAccent: '#0a1410',
      text: '#f4f8f5', muted: 'rgba(168,186,175,0.92)', soft: 'rgba(255,255,255,0.86)',
      hair: 'rgba(255,255,255,0.16)', scrim: [4, 9, 7] },
    { id: 'court', name: '코트 블루', note: '코트 블루 · 스카이',
      bg: ['#0b2a45', '#07182b', '#030c17'],
      glow: 'rgba(122,214,255,0.22)', glow2: 'rgba(255,255,255,0.08)',
      accent: '#7ad6ff', onAccent: '#04182b',
      text: '#f5fbff', muted: 'rgba(186,214,232,0.92)', soft: 'rgba(255,255,255,0.9)',
      hair: 'rgba(255,255,255,0.2)', scrim: [3, 12, 22] },
    { id: 'sunset', name: '선셋', note: '버건디 · 웜 코랄',
      bg: ['#3a1119', '#1f080e', '#0b0204'],
      glow: 'rgba(255,122,89,0.24)', glow2: 'rgba(255,178,122,0.10)',
      accent: '#ff7a59', onAccent: '#2a0806',
      text: '#fff6f2', muted: 'rgba(232,196,184,0.92)', soft: 'rgba(255,255,255,0.9)',
      hair: 'rgba(255,255,255,0.2)', scrim: [16, 5, 7] },
    { id: 'sakura', name: '사쿠라', note: '로즈 · 마젠타',
      bg: ['#39122c', '#210b19', '#0f040b'],
      glow: 'rgba(255,143,199,0.24)', glow2: 'rgba(255,255,255,0.10)',
      accent: '#ff8fc7', onAccent: '#2a0a18',
      text: '#fff5fa', muted: 'rgba(236,200,220,0.92)', soft: 'rgba(255,255,255,0.9)',
      hair: 'rgba(255,255,255,0.2)', scrim: [18, 5, 12] },
    { id: 'gold', name: '챔피언 골드', note: '딥 블랙 · 메탈릭 골드',
      bg: ['#19150a', '#0c0a06', '#040403'],
      glow: 'rgba(232,194,106,0.26)', glow2: 'rgba(255,236,180,0.10)',
      accent: '#e8c26a', onAccent: '#17130a',
      text: '#fff9ec', muted: 'rgba(226,208,170,0.92)', soft: 'rgba(255,255,255,0.9)',
      hair: 'rgba(232,194,106,0.28)', scrim: [7, 6, 4] }
  ];

  /* 필름(종이) 카드의 잉크 — 색 3개 이하: 종이 · 잉크 · 포인트 */
  var PAPER = { bg0: '#FAF8F3', bg1: '#F7F5F0', bg2: '#EFEAE0', ink: '#1D1B18', ink2: '#6E685D', ink3: 'rgba(29,27,24,0.42)' };

  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return PALETTES[0];
  }

  function designById(id) {
    for (var i = 0; i < DESIGNS.length; i++) if (DESIGNS[i].id === id) return DESIGNS[i];
    return DESIGNS[0];
  }

  function ratioById(id) {
    for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i].id === id) return RATIOS[i];
    return RATIOS[0];
  }

  function shadeById(id) {
    for (var i = 0; i < SHADES.length; i++) if (SHADES[i].id === id) return SHADES[i];
    return SHADES[0];
  }

  function dimsOf(ratio) {
    var r = ratioById(ratio);
    return { w: r.w, h: r.h, safe: r.safe };
  }

  /* ---------- 문구 다듬기 ----------
   * 카드에는 한 줄로만 그리므로 줄바꿈·제어문자는 공백으로 바꾸고, 앞뒤 공백을 지우고
   * 24자에서 자릅니다. HTML은 시트에서 U.esc로, 캔버스는 fillText라 그대로 안전합니다. */
  function phraseText(text) {
    if (typeof text !== 'string') return '';
    var s = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > PHRASE_MAX) s = s.slice(0, PHRASE_MAX).trim();
    return s;
  }

  function phraseById(id) {
    for (var i = 0; i < PHRASES.length; i++) if (PHRASES[i].id === id) return PHRASES[i];
    return null;
  }

  function isPresetPhrase(text) {
    var s = phraseText(text);
    for (var i = 0; i < PHRASES.length; i++) if (PHRASES[i].text === s) return true;
    return false;
  }

  /* ---------- 마지막에 고른 값 기억 (이 기기에만 · bm-v1.61.0) ----------
   * localStorage가 없는 곳(테스트·사생활 보호 모드)에서는 조용히 아무것도 하지 않습니다. */
  var PREF_KEY = 'bm_share_prefs_v1';
  function readPrefs() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return {};
      var raw = localStorage.getItem(PREF_KEY);
      if (!raw) return {};
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : {};
    } catch (e) { return {}; }
  }
  function writePrefs(patch) {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) return false;
      var cur = readPrefs();
      Object.keys(patch || {}).forEach(function (k) { cur[k] = patch[k]; });
      localStorage.setItem(PREF_KEY, JSON.stringify(cur));
      return true;
    } catch (e) { return false; }
  }

  function rgba(rgb, a) {
    var c = rgb || [0, 0, 0];
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ---------- 순수 모델 ---------- */

  /* 날짜 → '11/23 (일)' */
  function dateLine(ymd) {
    var key = String(ymd || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    var m = Number(key.slice(5, 7)), d = Number(key.slice(8, 10));
    var wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(key + 'T00:00:00').getDay()];
    return m + '/' + d + ' (' + wd + ')';
  }

  /* 게임 배열 → '2승 1패' · '21:18' · '' */
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

  /* 큰 숫자 2~3개: 운동 시간 · 승패/스코어(또는 AI 점수) · 연속 일수 */
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

  /* 아래 작은 한 줄: 체육관 · 파트너/라이벌 · 날짜 (이모지 없이 얇게) */
  function todaySub(record, opts) {
    opts = opts || {};
    var rec = record || {};
    var meta = (dom() && dom().logMeta) ? dom().logMeta(rec) : {};
    var bits = [];
    if (opts.gym) bits.push(opts.gym);
    var people = [];
    if (opts.partner || meta.partner) people.push((opts.partner || meta.partner) + '와 함께');
    if (opts.rival || meta.rival) people.push('vs ' + (opts.rival || meta.rival));
    if (people.length) bits.push(people.join(' · '));
    var day = dateLine(rec.date || opts.date);
    if (day) bits.push(day);
    return bits.join(' · ');
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

  /* 대회 카드 아래 한 줄: 종목 · 파트너 · 날짜 */
  function compSub(m) {
    var bits = [];
    if (m.event) bits.push(m.event);
    if (m.partner) bits.push('파트너 ' + m.partner);
    if (m.date) bits.push(m.date);
    return bits.join(' · ');
  }

  /* 저장 파일 이름 — badminton-share-YYYYMMDD-모드.png */
  function filename(mode, ymd) {
    var key = String(ymd || U.ymd()).replace(/[^0-9]/g, '').slice(0, 8);
    return 'badminton-share-' + key + '-' + (mode === 'comp' ? 'contest' : 'today') + '.png';
  }

  /* 화면에 보여 줄 카드 요약(접근성 문구) — 고른 디자인·비율·색도 함께 */
  function summaryOf(spec) {
    var s = spec || {};
    var text;
    if (s.mode === 'comp' && s.comp) {
      text = [s.phrase || '대회 인증', s.comp.contest, s.comp.result, compSub(s.comp)].filter(Boolean).join(' / ');
    } else {
      var big = s.big ? (s.big.value + (s.big.unit || '')) : '';
      var stats = (s.stats || []).map(function (b) { return b.value + (b.unit || ''); }).join(' · ');
      text = [s.phrase, s.title, big, stats, s.meta].filter(Boolean).join(' / ');
    }
    var extra = [designById(s.design).name, ratioById(s.ratio).name];
    if (s.photo) extra.push(shadeById(s.shade).name);
    extra.push(paletteById(s.palette).name);
    return text + ' / ' + extra.join(' · ');
  }

  /* ---------- 캔버스 준비 ---------- */
  function hasCanvas() {
    return typeof document !== 'undefined' && !!document.createElement;
  }

  function font(size, weight, family) {
    return (weight || 800) + ' ' + Math.round(size) + 'px ' + (family || FONT);
  }

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

  /* 한 줄 글씨 — 폭에 맞춰 줄이고, 그래도 넘치면 말줄임. { size, text } */
  function fitText(g, text, maxW, size, weight, family, min) {
    var src = String(text == null ? '' : text);
    var s = size, floor = min || 20;
    g.font = font(s, weight, family);
    if (g.measureText(src).width <= maxW) return { size: s, text: src };
    while (s > floor) {
      s -= 2;
      g.font = font(s, weight, family);
      if (g.measureText(src).width <= maxW) return { size: s, text: src };
    }
    var cut = src;
    while (cut.length > 1 && g.measureText(cut + '…').width > maxW) cut = cut.slice(0, -1);
    return { size: s, text: cut + '…' };
  }

  function photoOf(spec) {
    return (spec && spec.photo && spec.photo.width) ? spec.photo : null;
  }

  function shadeDim(spec) {
    if (!photoOf(spec)) return 0;
    return shadeById(spec.shade).dim || 0;
  }

  function frameOf(spec) {
    var r = ratioById(spec && spec.ratio);
    return {
      W: r.w, H: r.h, ratio: r.id,
      safeTop: r.safe, safeBottom: r.safe,
      top: r.safe, bottom: r.h - r.safe,
      pad: 84, story: r.safe > 0
    };
  }

  /* ---------- 공통 그림 ---------- */

  /* 사진을 카드에 꽉 차게(cover) */
  function drawCover(g, img, x, y, w, h) {
    var iw = img.width || w, ih = img.height || h;
    var scale = Math.max(w / iw, h / ih);
    var dw = iw * scale, dh = ih * scale;
    g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /* 사진이 없을 때 — 부드러운 메쉬 그라데이션 + 아주 옅은 셔틀콕 선화 */
  function paintMesh(g, p, F) {
    var base = g.createLinearGradient(0, 0, F.W * 0.3, F.H);
    base.addColorStop(0, p.bg[0]);
    base.addColorStop(0.55, p.bg[1]);
    base.addColorStop(1, p.bg[2]);
    g.fillStyle = base;
    g.fillRect(0, 0, F.W, F.H);

    var blobs = [
      { x: 0.16, y: 0.10, r: 0.62, c: p.glow },
      { x: 0.92, y: 0.44, r: 0.66, c: p.glow2 },
      { x: 0.30, y: 0.96, r: 0.72, c: 'rgba(255,255,255,0.05)' }
    ];
    blobs.forEach(function (b) {
      var cx = F.W * b.x, cy = F.H * b.y, r = F.W * b.r;
      var rad = g.createRadialGradient(cx, cy, 4, cx, cy, r);
      rad.addColorStop(0, b.c);
      rad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, F.W, F.H);
    });

    /* 제일 큰 셔틀콕 하나만 아주 옅게 (사람이 만든 여백 느낌) */
    paintShuttle(g, F.W * 0.76, F.H * 0.34, F.W * 0.36, 'rgba(255,255,255,0.055)');
  }

  /* 셔틀콕 라인 아이콘 — 깃털 3장 + 코르크. 스티커·필름 스탬프에 씁니다 */
  function paintShuttle(g, cx, cy, s, color) {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = Math.max(2, s * 0.055);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    /* 깃털 (위가 넓은 사다리꼴) */
    g.beginPath();
    g.moveTo(cx - s * 0.20, cy + s * 0.18);
    g.lineTo(cx - s * 0.44, cy - s * 0.42);
    g.lineTo(cx + s * 0.44, cy - s * 0.42);
    g.lineTo(cx + s * 0.20, cy + s * 0.18);
    g.stroke();
    /* 가운데 깃 */
    g.beginPath();
    g.moveTo(cx, cy + s * 0.16);
    g.lineTo(cx, cy - s * 0.40);
    g.stroke();
    /* 깃 끝 가로선 */
    g.beginPath();
    g.moveTo(cx - s * 0.30, cy - s * 0.22);
    g.lineTo(cx + s * 0.30, cy - s * 0.22);
    g.stroke();
    /* 코르크 */
    if (typeof g.ellipse === 'function') {
      g.beginPath();
      g.ellipse(cx, cy + s * 0.30, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(cx, cy + s * 0.30, s * 0.20, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  /* 얇은 가로선 하나 (+ 왼쪽 짧은 포인트 선) */
  function paintRule(g, x, y, w, color, accent) {
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
    if (accent) {
      g.strokeStyle = accent;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 84, y);
      g.stroke();
    }
    g.restore();
  }

  /* ============================================================
   * 매거진 — 사진 풀블리드 · 하단 30% 소프트 그라데이션 · 큰 숫자
   * ============================================================ */
  function paintMagazine(g, spec, p, F) {
    var W = F.W, H = F.H, pad = F.pad, photo = photoOf(spec);

    if (photo) {
      try { drawCover(g, photo, 0, 0, W, H); }
      catch (e) { paintMesh(g, p, F); photo = null; }
    } else {
      paintMesh(g, p, F);
    }

    /* 사진 밝기 — 고른 단계만큼만 (원본은 그대로) */
    var dim = photo ? shadeDim(spec) : 0;
    if (dim > 0) {
      g.fillStyle = rgba(p.scrim, dim);
      g.fillRect(0, 0, W, H);
    }

    /* 아래 40%부터 스며드는 스크림 — 사진은 그대로 보이고 글씨만 또렷하게 */
    var start = Math.round(H * 0.55);
    var scrim = g.createLinearGradient(0, start, 0, H);
    scrim.addColorStop(0, rgba(p.scrim, 0));
    scrim.addColorStop(0.30, rgba(p.scrim, 0.34));
    scrim.addColorStop(0.62, rgba(p.scrim, 0.66));
    scrim.addColorStop(0.82, rgba(p.scrim, 0.86));
    scrim.addColorStop(1, rgba(p.scrim, 0.95));
    g.fillStyle = scrim;
    g.fillRect(0, start, W, H - start);
    /* 맨 위 한 줄도 읽히게 아주 옅은 그라데이션 */
    if (photo) {
      var topFade = g.createLinearGradient(0, 0, 0, Math.round(H * 0.16));
      topFade.addColorStop(0, rgba(p.scrim, 0.34));
      topFade.addColorStop(1, rgba(p.scrim, 0));
      g.fillStyle = topFade;
      g.fillRect(0, 0, W, Math.round(H * 0.16));
    }

    var ink = photo ? '#ffffff' : p.text;
    var soft = photo ? 'rgba(255,255,255,0.86)' : p.muted;
    var lineColor = photo ? 'rgba(255,255,255,0.34)' : p.hair;
    var shadow = photo ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0)';
    var shadowBlur = photo ? 14 : 0;

    /* 좌상단 — 얇은 모노스페이스 날짜 · 장소 한 줄 */
    var topY = F.safeTop + 78;
    g.textAlign = 'left';
    if (spec.top) {
      var t = fitText(g, spec.top, W - pad * 2 - 220, 25, 500, MONO, 18);
      g.fillStyle = soft;
      g.font = font(t.size, 500, MONO);
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(t.text, pad, topY);
      g.shadowBlur = 0;
    }
    g.textAlign = 'right';
    g.fillStyle = soft;
    g.globalAlpha = 0.7;
    g.font = font(20, 600, FONT);
    g.shadowColor = shadow;
    g.shadowBlur = shadowBlur;
    g.fillText('BADMINTON', W - pad, topY);
    g.shadowBlur = 0;
    g.globalAlpha = 1;
    g.textAlign = 'left';

    var maxW = W - pad * 2;
    var stats = spec.stats || [];
    var metaY = F.bottom - 54;
    var ruleY = metaY - (spec.meta ? 56 : 34);

    /* 큰 숫자 (단위는 포인트 색으로 작게) */
    var bitext = String((spec.big && spec.big.value) || '');
    var unit = String((spec.big && spec.big.unit) || '');
    var unitSize = 52;
    var unitW = unit ? (function () { g.font = font(unitSize, 600, FONT); return g.measureText(unit).width + 20; })() : 0;
    var fitted = fitText(g, bitext, maxW - unitW, 198, 900, FONT, 58);
    var bigSize = fitted.size;
    var hasStats = stats.length > 0;
    var valBase = ruleY - 74;
    var bigBase = (hasStats ? valBase - 96 : ruleY - 84);

    /* 큰 숫자 위 제목 — 고른 문구(민턴일기 · 직접 쓴 문구)가 숫자 바로 위에 옵니다.
     * 대회 카드는 대회명이 주인공이라 문구를 그 위에 작게 얹습니다. */
    var kickerY = bigBase - Math.round(bigSize * 0.74) - 40;
    if (kickerY < F.safeTop + 150) kickerY = F.safeTop + 150;

    if (spec.mode === 'comp') {
      if (spec.phrase) {
        var pt = fitText(g, spec.phrase, maxW, 26, 600, FONT, 15);
        g.textAlign = 'left';
        g.fillStyle = soft;
        g.font = font(pt.size, 600, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(pt.text, pad, kickerY - 56);
        g.shadowBlur = 0;
      }
      if (spec.kicker) {
        g.textAlign = 'left';
        var kt = fitText(g, spec.kicker, maxW, 46, 700, FONT, 20);
        g.fillStyle = ink;
        g.font = font(kt.size, 700, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(kt.text, pad, kickerY);
        g.shadowBlur = 0;
      }
    } else if (spec.phrase) {
      var tt = fitText(g, spec.phrase, maxW, 34, 700, FONT, 18);
      g.textAlign = 'left';
      g.fillStyle = ink;
      g.font = font(tt.size, 700, FONT);
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(tt.text, pad, kickerY);
      g.shadowBlur = 0;
    }

    /* 큰 숫자 */
    g.textAlign = 'left';
    g.fillStyle = ink;
    g.font = font(bigSize, 900, FONT);
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = photo ? 24 : 0;
    g.fillText(fitted.text, pad, bigBase);
    var valueW = g.measureText(fitted.text).width;
    g.shadowBlur = 0;
    if (unit) {
      g.font = font(unitSize, 600, FONT);
      g.fillStyle = p.accent;
      g.fillText(unit, pad + valueW + 18, bigBase - Math.round(bigSize * 0.06));
    }

    /* 얇은 가로선 1개 */
    paintRule(g, pad, ruleY, maxW, lineColor, p.accent);

    /* 스탯 2~3개 — 작고 얇은 라벨 + 숫자 */
    if (hasStats) {
      var colW = (maxW - 36 * (stats.length - 1)) / stats.length;
      stats.forEach(function (st, i) {
        var x = pad + colW * i + 36 * i;
        var v = fitText(g, String(st.value), colW, 56, 800, FONT, 26);
        g.fillStyle = ink;
        g.font = font(v.size, 800, FONT);
        g.textAlign = 'left';
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(v.text, x, valBase);
        g.shadowBlur = 0;
        g.fillStyle = soft;
        g.font = font(23, 600, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(String(st.label || ''), x, valBase + 48);
        g.shadowBlur = 0;
      });
    }

    /* 맨 아래 얇은 한 줄 — 파트너/라이벌 */
    if (spec.meta) {
      var m = fitText(g, spec.meta, maxW, 27, 500, FONT, 18);
      g.fillStyle = soft;
      g.font = font(m.size, 500, FONT);
      g.textAlign = 'left';
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(m.text, pad, metaY);
      g.shadowBlur = 0;
    }
  }

  /* ============================================================
   * 필름 — 오프화이트 여백 프레임 + 모노스페이스 한 줄 + 셔틀콕 스탬프
   * ============================================================ */
  function filmBox(F) {
    var x = 64, w = F.W - 128;
    /* 스토리에서는 위 안전 여백 아래에 제목 한 줄 자리를 더 둡니다 */
    var y = F.story ? F.safeTop + 56 : 60;
    var bottom = F.story ? F.bottom - 236 : F.H - 268;
    return { x: x, y: y, w: w, h: bottom - y };
  }

  function paintFilmPaper(g, F) {
    var paper = g.createLinearGradient(0, 0, F.W, F.H);
    paper.addColorStop(0, PAPER.bg0);
    paper.addColorStop(0.5, PAPER.bg1);
    paper.addColorStop(1, PAPER.bg2);
    g.fillStyle = paper;
    g.fillRect(0, 0, F.W, F.H);
  }

  /* 사진 없이 만든 필름 카드 — 빈 상자가 아니라 '코트를 그린 필름 한 장'처럼 */
  function paintCourtSketch(g, x, y, w, h, color) {
    var topL = [x + w * 0.17, y + h * 0.17], topR = [x + w * 0.83, y + h * 0.17];
    var botL = [x + w * 0.05, y + h * 0.88], botR = [x + w * 0.95, y + h * 0.88];
    function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.lineCap = 'round';
    /* 외곽 */
    g.beginPath();
    g.moveTo(topL[0], topL[1]);
    g.lineTo(topR[0], topR[1]);
    g.lineTo(botR[0], botR[1]);
    g.lineTo(botL[0], botL[1]);
    g.closePath();
    g.stroke();
    /* 네트 */
    var nl = lerp(topL, botL, 0.5), nr = lerp(topR, botR, 0.5);
    g.beginPath();
    g.moveTo(nl[0], nl[1]);
    g.lineTo(nr[0], nr[1]);
    g.moveTo(nl[0], nl[1] - h * 0.03);
    g.lineTo(nr[0], nr[1] - h * 0.03);
    g.stroke();
    /* 숏 서비스 라인 · 롱 서비스 라인 */
    var t1 = lerp(topL, botL, 0.30), t2 = lerp(topR, botR, 0.30);
    var b1 = lerp(topL, botL, 0.72), b2 = lerp(topR, botR, 0.72);
    g.beginPath();
    g.moveTo(t1[0], t1[1]); g.lineTo(t2[0], t2[1]);
    g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]);
    g.stroke();
    /* 센터 라인 */
    g.beginPath();
    g.moveTo((nl[0] + nr[0]) / 2, nl[1]);
    g.lineTo((b1[0] + b2[0]) / 2, b1[1]);
    g.moveTo((nl[0] + nr[0]) / 2, nl[1]);
    g.lineTo((t1[0] + t2[0]) / 2, t1[1]);
    g.stroke();
    g.restore();
  }

  function paintFilmPlaceholder(g, box, p) {
    var grad = g.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    grad.addColorStop(0, '#F2EBDE');
    grad.addColorStop(0.5, '#E4DAC8');
    grad.addColorStop(1, '#CDBFa8');
    roundRect(g, box.x, box.y, box.w, box.h, 3);
    g.fillStyle = grad;
    g.fill();
    /* 왼쪽 위에서 스며드는 빛 */
    var lx = box.x + box.w * 0.24, ly = box.y + box.h * 0.16;
    var rad = g.createRadialGradient(lx, ly, 4, lx, ly, box.w * 0.75);
    rad.addColorStop(0, 'rgba(255,255,255,0.55)');
    rad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rad;
    g.fillRect(box.x, box.y, box.w, box.h);
    /* 코트 선을 옅게 — 사진 없는 카드도 '필름 한 장'처럼 */
    paintCourtSketch(g, box.x, box.y, box.w, box.h, 'rgba(255,255,255,0.5)');
    /* 오른쪽 아래 작은 셔틀콕 */
    paintShuttle(g, box.x + box.w * 0.82, box.y + box.h * 0.8, box.w * 0.1, 'rgba(255,255,255,0.55)');
  }

  function paintFilm(g, spec, p, F) {
    var W = F.W, H = F.H;
    paintFilmPaper(g, F);
    var box = filmBox(F), photo = photoOf(spec);

    if (photo) {
      /* 얇은 그림자 — 종이 위에 사진 한 장 */
      g.save();
      g.shadowColor = 'rgba(28,24,18,0.26)';
      g.shadowBlur = 34;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = 12;
      roundRect(g, box.x, box.y, box.w, box.h, 3);
      g.fillStyle = '#dcd4c6';
      g.fill();
      g.restore();

      g.save();
      roundRect(g, box.x, box.y, box.w, box.h, 3);
      g.clip();
      try { drawCover(g, photo, box.x, box.y, box.w, box.h); }
      catch (e) { paintFilmPlaceholder(g, box, p); }
      var dim = shadeDim(spec);
      if (dim > 0) {
        g.fillStyle = rgba([24, 19, 11], dim * 0.9);
        g.fillRect(box.x, box.y, box.w, box.h);
      }
      g.restore();
    } else {
      paintFilmPlaceholder(g, box, p);
    }

    /* 얇은 테두리 (0~4px 둥근 모서리) */
    g.save();
    g.strokeStyle = 'rgba(30,26,20,0.16)';
    g.lineWidth = 2;
    roundRect(g, box.x, box.y, box.w, box.h, 3);
    g.stroke();
    g.restore();

    var tx = box.x + 6, tw = box.w - 12;
    var l1 = box.y + box.h + 78;
    var l2 = l1 + 66;
    var l3 = l2 + 50;

    /* 제목 — 사진 위 종이 여백에 고른 문구 (사진은 가리지 않음) */
    if (spec.phrase) {
      var pt = fitText(g, spec.phrase, tw, 30, 700, FONT, 16);
      g.textAlign = 'left';
      g.fillStyle = PAPER.ink;
      g.font = font(pt.size, 700, FONT);
      g.fillText(pt.text, tx, box.y - 22);
    }

    /* 1줄 — 모노스페이스 날짜 · 체육관 */
    g.textAlign = 'left';
    if (spec.top) {
      var t = fitText(g, spec.top, tw - 120, 25, 500, MONO, 17);
      g.fillStyle = PAPER.ink2;
      g.font = font(t.size, 500, MONO);
      g.fillText(t.text, tx, l1);
    }
    paintRule(g, tx, l1 + 22, tw - 156, 'rgba(29,27,24,0.16)', p.accent);

    /* 2줄 — 핵심 스탯 한 줄 (굵게) */
    var line2 = spec.bigLine || '';
    if (line2) {
      var b = fitText(g, line2, tw - 150, 46, 800, FONT, 26);
      g.fillStyle = PAPER.ink;
      g.font = font(b.size, 800, FONT);
      g.fillText(b.text, tx, l2);
    }

    /* 3줄 — 얇은 한 줄 (파트너·종목·대회명) */
    if (spec.metaLine) {
      var m = fitText(g, spec.metaLine, tw - 150, 28, 500, FONT, 17);
      g.fillStyle = PAPER.ink2;
      g.font = font(m.size, 500, FONT);
      g.fillText(m.text, tx, l3);
    }

    /* 오른쪽 아래 작은 셔틀콕 스탬프 */
    paintShuttle(g, W - 118, box.y + box.h + 58, 54, p.accent);

    /* 브랜드 — 아주 작게 */
    g.textAlign = 'right';
    g.fillStyle = PAPER.ink3;
    g.font = font(18, 700, FONT);
    g.fillText('BADMINTON', W - 66, F.story ? F.bottom - 6 : H - 40);
    g.textAlign = 'left';
  }

  /* ============================================================
   * 스티커 — 배경 투명 · 얇은 글씨 + 큰 숫자 + 셔틀콕 라인
   * ============================================================ */
  function paintSticker(g, spec, p, F) {
    var pad = F.pad;
    var maxW = F.W - pad * 2;
    var labelY = F.bottom - 46;
    var bigBase = labelY - 74;

    var bitext = String((spec.big && spec.big.value) || '');
    var unit = String((spec.big && spec.big.unit) || '');
    var unitSize = 46;
    var unitW = unit ? (function () { g.font = font(unitSize, 500, FONT); return g.measureText(unit).width + 16; })() : 0;
    var fitted = fitText(g, bitext, maxW - unitW, F.story ? 190 : 176, 900, FONT, 54);
    var bigSize = fitted.size;

    /* 큰 숫자 — 그림자만 은은하게 (배경 박스 없음) */
    g.textAlign = 'left';
    g.fillStyle = '#ffffff';
    g.font = font(bigSize, 900, FONT);
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 28;
    g.fillText(fitted.text, pad, bigBase);
    var valueW = g.measureText(fitted.text).width;
    g.shadowBlur = 0;
    if (unit) {
      g.font = font(unitSize, 500, FONT);
      g.fillStyle = p.accent;
      g.shadowColor = 'rgba(0,0,0,0.45)';
      g.shadowBlur = 20;
      g.fillText(unit, pad + valueW + 14, bigBase - Math.round(bigSize * 0.05));
      g.shadowBlur = 0;
    }

    /* 얇은 한 줄 */
    if (spec.label) {
      var l = fitText(g, spec.label, maxW - 70, 30, 500, FONT, 18);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.font = font(l.size, 500, FONT);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 22;
      g.fillText(l.text, pad, labelY);
      g.shadowBlur = 0;
    }

    /* 작은 셔틀콕 라인 아이콘 + 제목 — 숫자 위 왼쪽 */
    var stampY = bigBase - Math.round(bigSize * 0.74) - 64;
    paintShuttle(g, pad + 24, stampY, 44, p.accent);
    if (spec.phrase) {
      var pt = fitText(g, spec.phrase, maxW - 80, 30, 700, FONT, 15);
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = font(pt.size, 700, FONT);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 22;
      g.fillText(pt.text, pad + 64, stampY + 10);
      g.shadowBlur = 0;
    }
  }

  /* spec → 캔버스 (캔버스가 없으면 null) */
  function draw(canvas, spec, cb) {
    if (!canvas || !canvas.getContext) return null;
    var s = spec || {};
    var F = frameOf(s);
    var g = canvas.getContext('2d');
    if (canvas.width !== F.W) canvas.width = F.W;
    if (canvas.height !== F.H) canvas.height = F.H;
    g.clearRect(0, 0, F.W, F.H);
    var p = paletteById(s.palette);
    var d = designById(s.design).id;
    if (d === 'film') paintFilm(g, s, p, F);
    else if (d === 'sticker') paintSticker(g, s, p, F);
    else paintMagazine(g, s, p, F);
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

  /* ---------- 화면 상태 ---------- */
  var ui = null;   /* { mode, design, ratio, shade, palette, recordId, photo, gym, partner, rival, contest, event, result, compPartner, date } */

  function initialState(ctx, opts) {
    opts = opts || {};
    var state = ctx && ctx.store ? ctx.store.state : {};
    var records = (state.data && state.data.records) || [];
    var rec = opts.record || records[0] || null;
    var me = state.me || {};
    var mp = ((state.data && state.data.matchProfiles) || []).filter(function (m) { return m.userKey === me.key; })[0] || {};
    var meta = rec && dom().logMeta ? dom().logMeta(rec) : {};
    var prefs = readPrefs();
    return {
      mode: opts.mode === 'comp' ? 'comp' : 'today',
      design: designById(prefs.design).id,
      ratio: ratioById(prefs.ratio).id,
      shade: shadeById(prefs.shade).id,
      palette: paletteById(prefs.palette).id,
      phrase: phraseText(prefs.phrase) || DEFAULT_PHRASE,
      phraseComp: phraseText(prefs.phraseComp) || DEFAULT_PHRASE,
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

  /* card spec — 그리기에 필요한 값만 (사진은 Image) */
  function specOf(ctx) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var rec = recordById(ctx, ui.recordId);
    var stats = (state.data && state.data.stats) || {};
    var design = designById(ui.design).id;
    var base = {
      design: design,
      ratio: ratioById(ui.ratio).id,
      shade: shadeById(ui.shade).id,
      palette: paletteById(ui.palette).id,
      photo: ui.photo || null
    };

    if (ui.mode === 'comp') {
      var m = compModel({ contest: ui.contest, event: ui.event, result: ui.result, partner: ui.compPartner, date: ui.date });
      var cstats = [];
      if (m.event) cstats.push({ label: '종목', value: m.event });
      if (m.partner) cstats.push({ label: '파트너', value: m.partner });
      return mix(base, {
        mode: 'comp', title: '대회 인증',
        phrase: phraseText(ui.phraseComp) || DEFAULT_PHRASE,
        top: m.date,
        kicker: m.contest,
        big: { value: m.result, unit: '', label: '성적' },
        bigLine: m.result + (m.event ? ' · ' + m.event : ''),
        stats: cstats,
        meta: '',
        metaLine: m.contest,
        label: m.contest + (m.event ? ' · ' + m.event : ''),
        comp: m, sub: compSub(m), date: m.date
      });
    }

    var an = (state.analysis && state.analysis.recordId && rec && String(state.analysis.recordId) === String(rec.id)) ? state.analysis : null;
    var meta = (rec && dom().logMeta) ? dom().logMeta(rec) : {};
    var bigs = todayBigs(rec, { streak: stats.streak, aiScore: an ? an.score : (rec && rec.score) });
    var primary = bigs[0] || null;
    var day = dateLine(rec && rec.date);
    var gym = ui.gym || '';
    var topBits = [];
    if (day) topBits.push(day);
    if (gym) topBits.push(gym);
    var people = [];
    var partner = ui.partner || meta.partner || '';
    var rival = ui.rival || meta.rival || '';
    if (partner) people.push(partner + '와 함께');
    if (rival) people.push('vs ' + rival);
    var rest = bigs.slice(1).map(function (b) {
      return { label: b.label, value: b.value + (b.unit || '') };
    });
    var labelBits = [];
    if (bigs[1]) labelBits.push(bigs[1].value + (bigs[1].unit || ''));
    if (day) labelBits.push(day);
    var phrase = phraseText(ui.phrase) || DEFAULT_PHRASE;

    return mix(base, {
      mode: 'today', title: '오늘 운동',
      phrase: phrase,
      top: topBits.join(' · '),
      kicker: primary ? primary.label : '',
      big: primary ? { value: String(primary.value), unit: primary.unit || '', label: primary.label }
        : { value: '', unit: '', label: '' },
      bigLine: primary ? (primary.value + (primary.unit ? primary.unit : '') + (bigs[1] ? ' · ' + bigs[1].value + (bigs[1].unit || '') : '')) : '',
      stats: rest,
      meta: people.join(' · '),
      metaLine: people.length ? people.join(' · ') : '',
      label: labelBits.join(' · '),
      sub: todaySub(rec, { gym: gym, partner: ui.partner, rival: ui.rival }),
      date: day
    });
  }

  function mix(a, b) {
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) { out[k] = b[k]; });
    return out;
  }

  /* ---------- 시트(화면) ---------- */
  function field(label, name, value, opts) {
    opts = opts || {};
    return '<label class="flabel"><span>' + U.esc(label) + '</span>' +
      '<input type="text" data-sc-field="' + name + '" maxlength="' + (opts.max || 24) + '" ' +
      'placeholder="' + U.esc(opts.placeholder || '') + '" value="' + U.esc(value || '') + '"' +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '></label>';
  }

  /* 카드 문구 — 1탭 프리셋 5종 + '직접 쓰기'(입력칸으로) — bm-v1.61.0 */
  function phraseBlock(mode) {
    var comp = mode === 'comp';
    var cur = phraseText(comp ? ui.phraseComp : ui.phrase) || DEFAULT_PHRASE;
    var chips = PHRASES.map(function (p) {
      var on = p.text === cur;
      return '<button type="button" class="chip sc__phrasechip' + (on ? ' is-on' : '') + '" data-sc-phrase="' + p.id + '" ' +
        'aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(p.text) + '</button>';
    }).join('');
    var customOn = !isPresetPhrase(cur);
    chips += '<button type="button" class="chip sc__phrasechip' + (customOn ? ' is-on' : '') + '" data-sc-phrase="custom" ' +
      'aria-pressed="' + (customOn ? 'true' : 'false') + '">직접 쓰기</button>';
    return '<div class="field sc__phrase">' +
      '<div class="field__label"><span>' + (comp ? '카드 제목' : '카드 문구') + '</span>' +
      '<small data-sc-phrase-count>' + cur.length + '/' + PHRASE_MAX + '</small></div>' +
      '<div class="chips chips--wrap sc__phrases" role="group" aria-label="카드 문구">' + chips + '</div>' +
      '<input type="text" class="sc__phraseinput" data-sc-field="' + (comp ? 'phraseComp' : 'phrase') + '" ' +
      'maxlength="' + PHRASE_MAX + '" placeholder="카드에 넣을 문구 (24자까지)" ' +
      'aria-label="카드 문구 직접 입력" value="' + U.esc(cur) + '">' +
      '</div>';
  }

  function sheetBody(ctx) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var records = ((state.data && state.data.records) || []).slice(0, 5);
    var rec = recordById(ctx, ui.recordId);
    var dims = dimsOf(ui.ratio);
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

    /* 사진 — 스티커(투명)에는 필요 없어 숨깁니다 */
    var photoBox = '<div class="field sc__photo"' + (ui.design === 'sticker' ? ' hidden' : '') + '>' +
      '<label class="btn btn--ghost btn--big sc__photobtn">' + BM.ui.icon('camera') +
      '<span>' + (ui.photo ? '사진 바꾸기' : '사진 고르기') + '</span>' +
      '<input type="file" accept="image/*" data-sc-photo hidden></label>' +
      '<p class="hint">사진은 폰 안에서만 합쳐져요 · 서버로 보내지 않아요</p></div>';

    /* 디자인 3종 */
    var designPicks = '<div class="field"><div class="field__label"><span>디자인</span></div>' +
      '<div class="sc__designs">' + DESIGNS.map(function (d) {
        var on = ui.design === d.id;
        return '<button type="button" class="sc__design sc__design--' + d.id + (on ? ' is-on' : '') + '" data-sc-design="' + d.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<i aria-hidden="true"></i><b>' + U.esc(d.name) + '</b><span>' + U.esc(d.note) + '</span></button>';
      }).join('') + '</div></div>';

    /* 비율 2종 */
    var ratioPicks = '<div class="field"><div class="field__label"><span>비율</span></div>' +
      '<div class="seg seg--wide sc__ratios" role="group" aria-label="카드 비율">' + RATIOS.map(function (r) {
        var on = ui.ratio === r.id;
        return '<button type="button" class="seg__btn sc__ratio sc__ratio--' + r.id + (on ? ' is-on' : '') + '" data-sc-ratio="' + r.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '"><i aria-hidden="true"></i><b>' + U.esc(r.name) + '</b></button>';
      }).join('') + '</div></div>';

    /* 사진 밝기 3단계 — 사진이 있을 때만 */
    var shadePicks = '<div class="field sc__shadebox"' + (ui.photo && ui.design !== 'sticker' ? '' : ' hidden') + '>' +
      '<div class="field__label"><span>사진 밝기</span></div>' +
      '<div class="seg seg--three sc__shades" role="group" aria-label="사진 밝기">' + SHADES.map(function (s) {
        var on = ui.shade === s.id;
        return '<button type="button" class="seg__btn sc__shade' + (on ? ' is-on' : '') + '" data-sc-shade="' + s.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(s.name) + '</button>';
      }).join('') + '</div></div>';

    /* 색 5종 — 사진 위에서는 포인트 색 */
    var colorPicks = '<div class="field"><div class="field__label"><span>카드 색</span></div>' +
      '<div class="sc__pals" role="group" aria-label="카드 색">' + PALETTES.map(function (p) {
        var on = ui.palette === p.id;
        return '<button type="button" class="sc__pal sc__pal--' + p.id + (on ? ' is-on' : '') + '" data-sc-pal="' + p.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '" title="' + U.esc(p.note) + '">' +
          '<i aria-hidden="true"></i><b>' + U.esc(p.name) + '</b></button>';
      }).join('') + '</div></div>';

    var saveLabel = emptyToday ? '일지를 먼저 저장해 주세요'
      : (ui.design === 'sticker' ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유');

    return modeTabs + emptyNote +
      (ui.mode === 'today' ? todayFields : compFields) +
      phraseBlock(ui.mode) +
      photoBox + designPicks + ratioPicks + shadePicks + colorPicks +
      '<div class="sc__preview' + (ui.design === 'sticker' ? ' is-sticker' : '') + '">' +
      '<canvas class="sc__canvas" width="' + dims.w + '" height="' + dims.h + '" aria-label="공유 카드 미리보기"></canvas></div>' +
      '<p class="sc__summary" data-sc-summary></p>' +
      '<button type="button" class="btn btn--primary btn--big mt8" data-sc-save' + (emptyToday ? ' disabled' : '') + '>' +
      BM.ui.icon('send') + '<span>' + saveLabel + '</span></button>' +
      '<p class="hint">' + (ui.design === 'sticker'
        ? '투명 PNG라 내 사진·스토리 위에 그대로 붙일 수 있어요.'
        : (ui.ratio === 'story'
          ? '스토리는 위·아래 220px를 비워 프로필·답장창에 가리지 않아요.'
          : '피드 4:5예요. 스토리에 올리려면 비율을 스토리로 바꿔 주세요.')) + '</p>';
  }

  function paintPreview(wrap, ctx) {
    var canvas = wrap.querySelector('.sc__canvas');
    if (!canvas) return;
    var spec = specOf(ctx);
    draw(canvas, spec);
    var sum = wrap.querySelector('[data-sc-summary]');
    if (sum) sum.textContent = summaryOf(spec);
  }

  /* 컨트롤 표시를 현재 상태에 맞춥니다(사진 칸·밝기 칸·저장 버튼 이름) */
  function syncControls(node) {
    var photoBox = node.querySelector('.sc__photo');
    if (photoBox) photoBox.hidden = ui.design === 'sticker';
    var shadeBox = node.querySelector('.sc__shadebox');
    if (shadeBox) shadeBox.hidden = !ui.photo || ui.design === 'sticker';
    var preview = node.querySelector('.sc__preview');
    if (preview) preview.classList.toggle('is-sticker', ui.design === 'sticker');
    var saveLabel = node.querySelector('[data-sc-save] span');
    if (saveLabel) {
      saveLabel.textContent = ui.design === 'sticker' ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유';
    }
    var lbl = node.querySelector('.sc__photobtn span');
    if (lbl) lbl.textContent = ui.photo ? '사진 바꾸기' : '사진 고르기';
  }

  /* 문구 칩·글자 수 표시를 현재 상태에 맞춥니다 (입력 중에는 입력값을 건드리지 않음) */
  function syncPhraseChips(node) {
    var cur = phraseText(ui.mode === 'comp' ? ui.phraseComp : ui.phrase) || DEFAULT_PHRASE;
    Array.prototype.forEach.call(node.querySelectorAll('[data-sc-phrase]'), function (b) {
      var id = b.getAttribute('data-sc-phrase');
      var p = phraseById(id);
      var on = id === 'custom' ? !isPresetPhrase(cur) : !!(p && p.text === cur);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var cnt = node.querySelector('[data-sc-phrase-count]');
    if (cnt) cnt.textContent = cur.length + '/' + PHRASE_MAX;
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
    if (!hasCanvas()) return null;
    var wrap = BM.ui.openSheet({
      title: '인스타 공유 카드',
      body: sheetBody(ctx),
      onMount: function (node) {
        paintPreview(node, ctx);

        function repaint() { paintPreview(node, ctx); }

        node.addEventListener('click', function (ev) {
          var ph = ev.target.closest('[data-sc-phrase]');
          if (ph) {
            ev.preventDefault();
            var pid = ph.getAttribute('data-sc-phrase');
            var key = ui.mode === 'comp' ? 'phraseComp' : 'phrase';
            var input = node.querySelector('.sc__phraseinput');
            var preset = phraseById(pid);
            if (preset) {
              ui[key] = preset.text;
              if (input) input.value = preset.text;
              writePrefs(key === 'phraseComp' ? { phraseComp: ui.phraseComp } : { phrase: ui.phrase });
            } else if (input) {
              /* 직접 쓰기 — 입력칸으로 커서를 옮기고 바로 고쳐 쓸 수 있게 합니다 */
              input.focus();
              try { input.setSelectionRange(0, input.value.length); } catch (e) { /* 무시 */ }
            }
            BM.ui.haptic(6);
            syncPhraseChips(node);
            repaint();
            return;
          }
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
          var dg = ev.target.closest('[data-sc-design]');
          if (dg) {
            ev.preventDefault();
            ui.design = dg.getAttribute('data-sc-design');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-design]'), function (b) {
              var on = b.getAttribute('data-sc-design') === ui.design;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            syncControls(node);
            writePrefs({ design: ui.design });
            repaint();
            return;
          }
          var rt = ev.target.closest('[data-sc-ratio]');
          if (rt) {
            ev.preventDefault();
            ui.ratio = rt.getAttribute('data-sc-ratio');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-ratio]'), function (b) {
              var on = b.getAttribute('data-sc-ratio') === ui.ratio;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            writePrefs({ ratio: ui.ratio });
            repaint();
            return;
          }
          var sd = ev.target.closest('[data-sc-shade]');
          if (sd) {
            ev.preventDefault();
            ui.shade = sd.getAttribute('data-sc-shade');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-shade]'), function (b) {
              var on = b.getAttribute('data-sc-shade') === ui.shade;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            writePrefs({ shade: ui.shade });
            repaint();
            return;
          }
          var pal = ev.target.closest('[data-sc-pal]');
          if (pal) {
            ev.preventDefault();
            ui.palette = pal.getAttribute('data-sc-pal');
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-pal]'), function (b) {
              var on = b.getAttribute('data-sc-pal') === ui.palette;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            writePrefs({ palette: ui.palette });
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
          if (name === 'phrase' || name === 'phraseComp') {
            syncPhraseChips(node);
            writePrefs(name === 'phraseComp' ? { phraseComp: phraseText(f.value) } : { phrase: phraseText(f.value) });
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
            syncControls(node);
            repaint();
            BM.ui.haptic(10);
          });
        });
      }
    });
    return wrap;
  }

  BM.sharecard = {
    W: W, H: H, MODES: MODES, RESULTS: RESULTS,
    DESIGNS: DESIGNS, RATIOS: RATIOS, SHADES: SHADES, PALETTES: PALETTES,
    PHRASES: PHRASES, PHRASE_MAX: PHRASE_MAX, DEFAULT_PHRASE: DEFAULT_PHRASE,
    designById: designById, ratioById: ratioById, shadeById: shadeById, paletteById: paletteById,
    phraseById: phraseById, phraseText: phraseText, isPresetPhrase: isPresetPhrase,
    dimsOf: dimsOf,
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
    _specOf: specOf,
    _sheetBody: sheetBody,
    _setState: function (o) { ui = o; },
    _state: function () { return ui; },
    _writePrefs: writePrefs,
    _readPrefs: readPrefs,
    _initialState: initialState
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
