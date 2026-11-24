/* ============================================================
 * sharecard.js — 인스타 공유 카드 (오늘 운동 · 대회 인증) (bm-v1.63.0)
 *
 *  · 사진은 폰 안에서만 합성되고 서버로 보내지 않습니다
 *    (파일 선택 → 캔버스 → 저장·공유). 업로드 없음.
 *  · 인스타 비율 2종 — 피드 4:5(1080×1350) · 스토리 9:16(1080×1920).
 *    스토리는 위·아래 220px를 비워 프로필·답장창에 글씨가 가리지 않습니다.
 *  · 시트는 '3초 완성' 순서 (bm-v1.63.0) — 탭 → 한 줄 안내 → 미리보기 →
 *    📷 사진 넣기(+ 기본 배경 4종) → 디자인·비율·사진 밝기 → 접기(문구 · 색 · 내용) → 저장.
 *    저장 버튼은 시트 아래에 붙어 있어 스크롤을 되돌리지 않아도 됩니다.
 *  · 기본 감성 배경 4종 (사진 없이 1탭) — 코트 야경 · 셔틀콕 라이트 · 노을 코트 ·
 *    민턴 그라데이션. 모두 캔버스로 그립니다(외부 이미지·저작권 없음).
 *  · 디자인 3종 (사람이 찍어 올린 카드처럼)
 *      매거진 — 사진 풀블리드. 좌상단 얇은 날짜·장소, 하단에 부드럽게 스며드는 스크림 위에
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
 *  · 사진 구도 (bm-v1.66.0) — 미리보기 사진을 손가락으로 끌어 위치를 옮기고
 *    −·+·슬라이더로 1.0×~2.5× 확대합니다(원래대로 한 번에 복구). 고른 값은
 *    화면뿐 아니라 저장 PNG(1080×1350 · 1080×1920)에 같은 비율·위치로 그려집니다.
 *    사진을 바꾸거나 빼면 기본값(가운데 · 1.0×)으로 돌아갑니다.
 *  · 글씨 위치 3단 (bm-v1.66.0) — 아래 · 가운데 · 위. 사진 속 인물·메달을 글씨가
 *    가리지 않도록 스크림과 글씨 묶음을 통째로 옮깁니다(기본은 기존과 같은 '아래').
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

  /* ---------- 글씨 위치 3단 (bm-v1.66.0) ----------
   * 사진 속 인물·메달을 글씨가 가리지 않게, 스크림과 글씨 묶음을 통째로 옮깁니다.
   * 기본값은 예전과 똑같은 '아래'라서 이미 만들던 카드는 모양이 바뀌지 않습니다. */
  var TEXT_POS = [
    { id: 'bottom', name: '아래', note: '사진 아래쪽' },
    { id: 'middle', name: '가운데', note: '사진 한가운데' },
    { id: 'top', name: '위', note: '사진 위쪽' }
  ];

  function textPosById(id) {
    for (var i = 0; i < TEXT_POS.length; i++) if (TEXT_POS[i].id === id) return TEXT_POS[i];
    return TEXT_POS[0];
  }

  /* ---------- 사진 구도 — 위치 이동 · 확대 (bm-v1.66.0) ----------
   * photoX · photoY 는 남은 여백 대비 −1~1 비율(0 = 가운데), photoZoom 은 1.0~2.5배입니다.
   * 확대하면 사진이 프레임보다 커지고, 그 넘친 만큼만 끌어서 옮길 수 있습니다
   * (인스타 편집기와 같은 감각 — 1.0배에서는 넘친 곳이 없어 끌어도 움직이지 않습니다). */
  var ZOOM_MIN = 1;
  var ZOOM_MAX = 2.5;
  var ZOOM_STEP = 0.05;

  function clampNum(v, lo, hi) {
    v = Number(v);
    if (!isFinite(v)) v = lo;
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function zoomOf(v) { return clampNum(v, ZOOM_MIN, ZOOM_MAX); }

  function photoViewOf(spec) {
    return {
      x: clampNum(spec && spec.photoX, -1, 1),
      y: clampNum(spec && spec.photoY, -1, 1),
      zoom: zoomOf(spec && spec.photoZoom)
    };
  }

  /* 확대·이동을 반영한 사진이 놓이는 자리(캔버스 px) — 그리기와 끌기가 같은 계산을 씁니다 */
  function coverBox(img, x, y, w, h, view) {
    var iw = (img && img.width) || w, ih = (img && img.height) || h;
    var v = view || { x: 0, y: 0, zoom: 1 };
    var zoom = zoomOf(v.zoom);
    var base = Math.max(w / iw, h / ih) * zoom;
    var dw = iw * base, dh = ih * base;
    var maxX = Math.max(0, (dw - w) / 2), maxY = Math.max(0, (dh - h) / 2);
    return {
      left: x + (w - dw) / 2 + clampNum(v.x, -1, 1) * maxX,
      top: y + (h - dh) / 2 + clampNum(v.y, -1, 1) * maxY,
      w: dw, h: dh, maxX: maxX, maxY: maxY, zoom: zoom
    };
  }

  /* 사진이 실제로 그려지는 틀 — 디자인마다 다릅니다(매거진은 카드 전체, 필름은 인화지 안) */
  function photoFrameOf(spec) {
    var F = frameOf(spec || {});
    if (designById(spec && spec.design).id === 'film') return filmBox(F);
    return { x: 0, y: 0, w: F.W, h: F.H };
  }

  /* 끌기 — 화면에서 움직인 px을 사진 위치 비율로 바꿉니다.
   * 프레임보다 넘친 만큼(maxX·maxY)만 움직이고, 넘칠 곳이 없으면 그대로입니다. */
  function movePhotoBy(canvas, spec, dxCss, dyCss) {
    var photo = photoOf(spec);
    if (!photo || !canvas) return null;
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    var k = (rect && rect.width) ? (canvas.width / rect.width) : 1;
    var box = photoFrameOf(spec);
    var view = photoViewOf(spec);
    var m = coverBox(photo, box.x, box.y, box.w, box.h, view);
    var nx = view.x, ny = view.y;
    if (m.maxX > 0 && dxCss) nx = clampNum(view.x + (dxCss * k) / m.maxX, -1, 1);
    if (m.maxY > 0 && dyCss) ny = clampNum(view.y + (dyCss * k) / m.maxY, -1, 1);
    return { x: nx, y: ny, moved: (nx !== view.x || ny !== view.y) };
  }

  /* ---------- 대회 카드 프레임 (bm-v1.64.0) ----------
   * 기본은 프레임 없음(무료). 대회 인증 카드에만 '챔피언 월계관/골드 프레임'을
   * 하트 2개로 한 번 열면 계속 씁니다(소유 기록은 꾸미기구매 target='card:champ').
   * 디자인·색·비율·문구는 그대로 무료라 바이럴을 막지 않습니다. */
  var FRAMES = [
    { id: 'none', label: '기본', hint: '프레임 없음', price: 0, deco: '' },
    { id: 'champ', label: '챔피언 골드', hint: '월계관 · 메탈릭 골드', price: 2, deco: 'card:champ' }
  ];

  function frameOptionById(id) {
    for (var i = 0; i < FRAMES.length; i++) if (FRAMES[i].id === id) return FRAMES[i];
    return FRAMES[0];
  }

  function frameDeco(id) {
    var f = frameOptionById(id);
    return f ? f.deco : '';
  }

  /* 이 기기 사용자가 챔피언 프레임을 열어 두었는지 */
  function ownsFrame(ctx, id) {
    var deco = frameDeco(id);
    if (!deco) return true;                 /* 기본 프레임은 늘 무료 */
    var st = ctx && ctx.store ? ctx.store.state : {};
    var me = st && st.me;
    var idx = st && st.idx;
    if (!me || !me.key || !idx || !BM.domain || !BM.domain.ownsDeco) return false;
    var streak = st.data && st.data.hearts ? (st.data.hearts.checkinStreak || 0) : 0;
    return BM.domain.ownsDeco(idx, me.key, deco, streak);
  }

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

  /* ---------- 기본 감성 배경 4종 (bm-v1.63.0) ----------
   * 사진을 고르지 않아도 1탭으로 감성 카드를 만드는 캔버스 아트입니다.
   * 외부 이미지·서버 없이 그 자리에서 1080×1350 / 1080×1920 으로 다시 그립니다.
   *   courtnight   코트 야경 — 깊은 에메랄드 코트 · 체육관 스포트라이트 · 원근 코트 라인
   *   shuttlelight 셔틀콕 라이트 — 따뜻한 다크 스튜디오 · 빛 번짐 보케 · 큰 셔틀콕 실루엣
   *   sunsetcourt  노을 코트 — 노을 그라데이션 · 네트 실루엣 · 코트 라인
   *   mintmesh     민턴 그라데이션 — 딥 네이비 · 민트 글로우 메쉬
   * 내 갤러리 사진을 고르면 사진이 우선하고(배경은 비워짐), 스티커는 투명이 우선입니다. */
  var BGS = [
    { id: 'courtnight',
      name: '코트 야경', note: '에메랄드 코트 · 조명' },
    { id: 'shuttlelight',
      name: '셔틀콕 라이트', note: '따뜻한 스튜디오 · 보케' },
    { id: 'sunsetcourt',
      name: '노을 코트', note: '노을 · 네트 실루엣' },
    { id: 'mintmesh',
      name: '민턴 그라데이션', note: '딥 네이비 · 민트 글로우' }
  ];

  function paletteById(id) {
    for (var i = 0; i < PALETTES.length; i++) if (PALETTES[i].id === id) return PALETTES[i];
    return PALETTES[0];
  }

  function bgById(id) {
    for (var i = 0; i < BGS.length; i++) if (BGS[i].id === id) return BGS[i];
    return { id: '', name: '', note: '' };
  }

  /* 카드에 실제로 깔릴 기본 배경 — 스티커(투명)에는 절대 깔지 않습니다 */
  function bgOf(spec) {
    if (!spec) return null;
    if (designById(spec.design).id === 'sticker') return null;
    var b = bgById(spec.bg);
    return b.id ? b : null;
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

  /* 자간(letter-spacing) — 지원하는 브라우저에서만 살짝 풀거나 조입니다.
   * 지원하지 않는 곳에서는 조용히 무시되어 예전과 같이 그려집니다. */
  function tracking(g, px) {
    try { g.letterSpacing = (px || 0) + 'px'; } catch (e) { /* 무시 */ }
  }

  /* 글씨 테두리 — 스티커가 어떤 사진 위에서도 또렷하도록. 캔버스가 지원하지 않는 곳
   * (테스트용 가짜 컨텍스트 등)에서는 조용히 건너뜀니다. */
  function outlineText(g, text, x, y) {
    if (typeof g.strokeText !== 'function') return;
    try { g.strokeText(text, x, y); } catch (e) { /* 무시 */ }
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

  /* 사진을 카드에 꽉 차게(cover) — view(위치·확대)가 있으면 그 구도로 그립니다 */
  function drawCover(g, img, x, y, w, h, view) {
    var m = coverBox(img, x, y, w, h, view || { x: 0, y: 0, zoom: 1 });
    g.drawImage(img, m.left, m.top, m.w, m.h);
    return m;
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
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
    if (accent) {
      g.strokeStyle = accent;
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 76, y);
      g.stroke();
    }
    g.restore();
  }

  /* ============================================================
   * 기본 감성 배경 4종 — 사진 없이도 바로 쓰는 캔버스 아트 (bm-v1.63.0)
   * 모두 box(절대 좌표 사각형) 안에 그립니다. 배경은 항상 사진보다 먼저,
   * 글씨는 그 위에 올라갑니다.
   * ============================================================ */

  function fillRadial(g, box, cx, cy, r0, r1, stops) {
    var rad = g.createRadialGradient(cx, cy, r0, cx, cy, r1);
    stops.forEach(function (s) { rad.addColorStop(s[0], s[1]); });
    g.fillStyle = rad;
    g.fillRect(box.x, box.y, box.w, box.h);
  }

  /* 큰 셔틀콕 실루엣 — 얇은 깃선으로 정교하게 (배경 아트용) */
  function paintShuttleArt(g, cx, cy, s, color, lw) {
    g.save();
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = lw || Math.max(1.6, s * 0.013);
    var topY = cy - s * 0.46, botY = cy + s * 0.20;
    var topW = s * 0.295, botW = s * 0.085;
    /* 깃 스커트 외곽 */
    g.beginPath();
    g.moveTo(cx - botW, botY);
    g.lineTo(cx - topW, topY);
    g.lineTo(cx + topW, topY);
    g.lineTo(cx + botW, botY);
    g.stroke();
    /* 깃 끝(위) 가로선 · 묶음 띠 2줄 */
    g.beginPath();
    g.moveTo(cx - topW, topY);
    g.lineTo(cx + topW, topY);
    g.stroke();
    [0.18, 0.56].forEach(function (t) {
      var by = topY + (botY - topY) * t;
      var bw = topW + (botW - topW) * t;
      g.beginPath();
      g.moveTo(cx - bw, by);
      g.lineTo(cx + bw, by);
      g.stroke();
    });
    /* 안쪽 깃선 5줄 — 부채살처럼 */
    [-0.72, -0.36, 0, 0.36, 0.72].forEach(function (k) {
      g.beginPath();
      g.moveTo(cx + botW * k * 0.9, botY - s * 0.005);
      g.lineTo(cx + topW * k * 0.96, topY + s * 0.005);
      g.stroke();
    });
    /* 코르크 — 깃 밑에 붙은 둥근 머리 */
    g.beginPath();
    if (typeof g.ellipse === 'function') {
      g.ellipse(cx, cy + s * 0.285, s * 0.098, s * 0.075, 0, 0, Math.PI * 2);
    } else {
      g.arc(cx, cy + s * 0.285, s * 0.09, 0, Math.PI * 2);
    }
    g.stroke();
    g.restore();
  }

  /* 1) 코트 야경 — 깊은 에메랄드 · 체육관 조명 · 원근 코트 라인
   *    카드 아래 3분의 1은 글씨 자리라 코트는 화면 위쪽 2/3에 앉힙니다. */
  function paintBgCourtNight(g, box) {
    var x = box.x, y = box.y, w = box.w, h = box.h;
    var base = g.createLinearGradient(x, y, x + w * 0.24, y + h);
    base.addColorStop(0, '#0a2a20');
    base.addColorStop(0.34, '#061a13');
    base.addColorStop(1, '#020907');
    g.fillStyle = base;
    g.fillRect(x, y, w, h);

    /* 천장 등 — 위에서 떨어지는 세 줄기 빛 (부드러운 원뿔) */
    [0.24, 0.5, 0.76].forEach(function (t, i) {
      fillRadial(g, box, x + w * t, y + h * 0.02, w * 0.01, w * (i === 1 ? 0.46 : 0.34),
        [[0, 'rgba(214,255,176,0.20)'], [0.42, 'rgba(180,240,120,0.05)'], [1, 'rgba(0,0,0,0)']]);
    });

    /* 코트 — 멀리(위) 좁게, 가까이(아래)는 화면 밖으로 벌어지게 */
    var farY = y + h * 0.40, nearY = y + h * 0.80;
    var farL = x + w * 0.285, farR = x + w * 0.715;
    var nearL = x - w * 0.12, nearR = x + w * 1.12;
    function at(t) {
      return { y: farY + (nearY - farY) * t, l: farL + (nearL - farL) * t, r: farR + (nearR - farR) * t };
    }
    /* 바닥 — 코트가 시작되는 곳부터 짙은 초록 */
    var floor = g.createLinearGradient(x, farY, x, y + h);
    floor.addColorStop(0, 'rgba(24,88,66,0.55)');
    floor.addColorStop(0.5, 'rgba(10,44,33,0.72)');
    floor.addColorStop(1, 'rgba(3,14,10,0.9)');
    g.fillStyle = floor;
    g.fillRect(x, farY, w, h - (farY - y));

    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    /* 코트 외곽 — 아래로 갈수록 옅게(글씨 자리를 방해하지 않게) */
    var edge = g.createLinearGradient(x, farY, x, nearY);
    edge.addColorStop(0, 'rgba(226,255,232,0.30)');
    edge.addColorStop(0.5, 'rgba(226,255,232,0.16)');
    edge.addColorStop(1, 'rgba(226,255,232,0.08)');
    g.strokeStyle = edge;
    g.lineWidth = Math.max(2, w * 0.0032);
    g.beginPath();
    g.moveTo(farL, farY); g.lineTo(farR, farY);
    g.moveTo(farL, farY); g.lineTo(nearL, nearY);
    g.moveTo(farR, farY); g.lineTo(nearR, nearY);
    g.stroke();
    /* 서비스 라인 2줄 */
    [0.30, 0.66].forEach(function (t) {
      var a = at(t);
      g.strokeStyle = 'rgba(226,255,232,' + (0.16 - t * 0.09).toFixed(3) + ')';
      g.beginPath();
      g.moveTo(a.l, a.y);
      g.lineTo(a.r, a.y);
      g.stroke();
    });
    /* 센터 라인 */
    var mid = at(0.66);
    g.strokeStyle = 'rgba(226,255,232,0.09)';
    g.beginPath();
    g.moveTo((farL + farR) / 2, farY);
    g.lineTo((mid.l + mid.r) / 2, mid.y);
    g.stroke();
    /* 네트 — 빛을 머금은 한 줄 + 옅은 망 */
    var netL = farL - w * 0.06, netR = farR + w * 0.06;
    g.strokeStyle = 'rgba(12,20,16,0.55)';
    g.lineWidth = Math.max(1, w * 0.0016);
    var i;
    for (i = 1; i < 14; i++) {
      var gx = netL + (netR - netL) * (i / 14);
      g.beginPath();
      g.moveTo(gx, farY - h * 0.06);
      g.lineTo(gx, farY + h * 0.01);
      g.stroke();
    }
    for (i = 1; i < 4; i++) {
      var gy = farY - h * 0.06 + (h * 0.07) * (i / 4);
      g.beginPath();
      g.moveTo(netL, gy);
      g.lineTo(netR, gy);
      g.stroke();
    }
    g.strokeStyle = 'rgba(240,255,246,0.52)';
    g.lineWidth = Math.max(3, w * 0.0055);
    g.shadowColor = 'rgba(198,242,78,0.5)';
    g.shadowBlur = w * 0.035;
    g.beginPath();
    g.moveTo(netL, farY - h * 0.06);
    g.lineTo(netR, farY - h * 0.06);
    g.stroke();
    g.restore();

    /* 네트 아래 바닥에 번지는 빛 */
    fillRadial(g, box, x + w * 0.5, y + h * 0.52, w * 0.01, w * 0.52,
      [[0, 'rgba(198,242,78,0.10)'], [1, 'rgba(0,0,0,0)']]);

    /* 비네트 */
    fillRadial(g, box, x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.16, Math.max(w, h) * 0.8,
      [[0, 'rgba(0,0,0,0)'], [0.62, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0.58)']]);
  }

  /* 2) 셔틀콕 라이트 — 따뜻한 다크 스튜디오 · 보케 · 큰 셔틀콕 실루엣 */
  function paintBgShuttleLight(g, box) {
    var x = box.x, y = box.y, w = box.w, h = box.h;
    var base = g.createLinearGradient(x, y, x + w * 0.55, y + h);
    base.addColorStop(0, '#2d1c11');
    base.addColorStop(0.42, '#180e08');
    base.addColorStop(1, '#060403');
    g.fillStyle = base;
    g.fillRect(x, y, w, h);

    fillRadial(g, box, x + w * 0.26, y + h * 0.16, w * 0.02, w * 0.9,
      [[0, 'rgba(255,196,120,0.22)'], [0.45, 'rgba(255,150,80,0.07)'], [1, 'rgba(0,0,0,0)']]);

    /* 빛 번짐 보케 — 자리·크기가 고정이라 늘 같은 그림 */
    var bokeh = [
      [0.13, 0.13, 0.075, 0.22], [0.31, 0.07, 0.042, 0.15], [0.22, 0.33, 0.032, 0.11],
      [0.83, 0.17, 0.058, 0.17], [0.93, 0.34, 0.082, 0.09], [0.68, 0.06, 0.028, 0.12],
      [0.09, 0.50, 0.048, 0.09], [0.89, 0.60, 0.038, 0.07], [0.45, 0.04, 0.024, 0.13],
      [0.72, 0.44, 0.020, 0.08], [0.16, 0.68, 0.026, 0.06]
    ];
    bokeh.forEach(function (b) {
      fillRadial(g, box, x + w * b[0], y + h * b[1], 0, w * b[2],
        [[0, 'rgba(255,222,170,' + b[3] + ')'], [0.55, 'rgba(255,196,130,' + (b[3] * 0.35).toFixed(3) + ')'], [1, 'rgba(0,0,0,0)']]);
    });

    /* 비스듬히 내려오는 빛줄기 */
    var beam = g.createLinearGradient(x + w * 0.08, y, x + w * 0.92, y + h * 0.8);
    beam.addColorStop(0, 'rgba(255,226,180,0)');
    beam.addColorStop(0.44, 'rgba(255,226,180,0.10)');
    beam.addColorStop(0.62, 'rgba(255,226,180,0.04)');
    beam.addColorStop(1, 'rgba(255,226,180,0)');
    g.fillStyle = beam;
    g.fillRect(x, y, w, h);

    /* 큰 셔틀콕 실루엣 — 조명에 비친 한 개 (글씨 자리 위쪽에) */
    var s = Math.min(w, h) * 0.46;
    var cx = x + w * 0.52, cy = y + h * 0.33;
    fillRadial(g, box, cx, cy, w * 0.02, w * 0.4,
      [[0, 'rgba(255,196,128,0.14)'], [1, 'rgba(0,0,0,0)']]);
    g.save();
    g.shadowColor = 'rgba(255,214,150,0.40)';
    g.shadowBlur = w * 0.045;
    paintShuttleArt(g, cx, cy, s, 'rgba(255,246,230,0.34)', Math.max(2.4, s * 0.012));
    g.restore();
    paintShuttleArt(g, cx, cy, s, 'rgba(255,252,244,0.26)', Math.max(1.6, s * 0.008));

    /* 비네트 */
    fillRadial(g, box, x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.2, Math.max(w, h) * 0.8,
      [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0.12)'], [1, 'rgba(0,0,0,0.62)']]);
  }

  /* 3) 노을 코트 — 노을 그라데이션 · 해 · 네트 실루엣 (지평선은 글씨 위로) */
  function paintBgSunsetCourt(g, box) {
    var x = box.x, y = box.y, w = box.w, h = box.h;
    var horizon = y + h * 0.585;
    var sky = g.createLinearGradient(x, y, x, horizon);
    sky.addColorStop(0, '#160e2b');
    sky.addColorStop(0.30, '#3a1844');
    sky.addColorStop(0.58, '#8b2f47');
    sky.addColorStop(0.82, '#d4603f');
    sky.addColorStop(1, '#f6ab63');
    g.fillStyle = sky;
    g.fillRect(x, y, w, horizon - y);

    /* 해 — 지평선 바로 위, 네트 뒤 */
    fillRadial(g, box, x + w * 0.5, y + h * 0.555, w * 0.01, w * 0.46,
      [[0, 'rgba(255,240,206,0.60)'], [0.24, 'rgba(255,190,124,0.22)'], [1, 'rgba(0,0,0,0)']]);
    g.save();
    g.fillStyle = 'rgba(255,246,218,0.94)';
    g.beginPath();
    g.arc(x + w * 0.5, y + h * 0.556, w * 0.05, 0, Math.PI * 2);
    g.fill();
    g.restore();

    /* 땅 */
    var ground = g.createLinearGradient(x, horizon, x, y + h);
    ground.addColorStop(0, '#2a1526');
    ground.addColorStop(0.30, '#140b18');
    ground.addColorStop(1, '#06040a');
    g.fillStyle = ground;
    g.fillRect(x, horizon, w, h - (horizon - y));

    /* 지평선 빛 번짐 */
    var haze = g.createLinearGradient(x, y + h * 0.52, x, y + h * 0.68);
    haze.addColorStop(0, 'rgba(255,170,110,0)');
    haze.addColorStop(0.45, 'rgba(255,170,110,0.28)');
    haze.addColorStop(1, 'rgba(255,170,110,0)');
    g.fillStyle = haze;
    g.fillRect(x, y + h * 0.52, w, h * 0.16);

    /* 네트 실루엣 — 지평선에 걸쳐 */
    var netTop = y + h * 0.475, netBot = y + h * 0.585;
    g.save();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(9,5,12,0.9)';
    g.lineWidth = Math.max(3, w * 0.005);
    g.beginPath();
    g.moveTo(x + w * 0.03, netTop);
    g.lineTo(x + w * 0.97, netTop);
    g.stroke();
    g.beginPath();
    g.moveTo(x + w * 0.055, netTop);
    g.lineTo(x + w * 0.055, netBot);
    g.moveTo(x + w * 0.945, netTop);
    g.lineTo(x + w * 0.945, netBot);
    g.stroke();
    g.lineWidth = Math.max(1, w * 0.0016);
    g.strokeStyle = 'rgba(10,6,13,0.34)';
    var i, j;
    for (i = 1; i < 26; i++) {
      var gx = x + w * (0.055 + (0.89 * i / 26));
      g.beginPath();
      g.moveTo(gx, netTop);
      g.lineTo(gx, netBot);
      g.stroke();
    }
    for (j = 1; j < 5; j++) {
      var gy = netTop + (netBot - netTop) * (j / 5);
      g.beginPath();
      g.moveTo(x + w * 0.055, gy);
      g.lineTo(x + w * 0.945, gy);
      g.stroke();
    }
    g.restore();

    /* 땅 위 코트 라인 — 지평선의 한 점으로 모이는 V + 가까운 라인 */
    g.save();
    g.lineCap = 'round';
    var nearLine = y + h * 0.93;
    var nearL = x + w * 0.00, nearR = x + w * 1.00;
    var vpX = x + w * 0.5, vpY = horizon;
    var fade = g.createLinearGradient(x, vpY, x, nearLine);
    fade.addColorStop(0, 'rgba(255,206,160,0.05)');
    fade.addColorStop(0.6, 'rgba(255,206,160,0.20)');
    fade.addColorStop(1, 'rgba(255,206,160,0.30)');
    g.strokeStyle = fade;
    g.lineWidth = Math.max(2, w * 0.003);
    g.beginPath();
    g.moveTo(vpX, vpY); g.lineTo(nearL, nearLine);
    g.moveTo(vpX, vpY); g.lineTo(nearR, nearLine);
    g.moveTo(nearL, nearLine); g.lineTo(nearR, nearLine);
    g.stroke();
    g.restore();
  }

  /* 4) 민턴 그라데이션 — 딥 네이비 · 민트 글로우 메쉬 */
  function paintBgMintMesh(g, box) {
    var x = box.x, y = box.y, w = box.w, h = box.h;
    var base = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    base.addColorStop(0, '#06202a');
    base.addColorStop(0.45, '#04141f');
    base.addColorStop(1, '#030a12');
    g.fillStyle = base;
    g.fillRect(x, y, w, h);

    fillRadial(g, box, x + w * 0.14, y + h * 0.10, w * 0.01, w * 0.86,
      [[0, 'rgba(86,255,206,0.46)'], [0.42, 'rgba(60,215,180,0.16)'], [1, 'rgba(0,0,0,0)']]);
    fillRadial(g, box, x + w * 0.96, y + h * 0.24, w * 0.01, w * 0.72,
      [[0, 'rgba(70,152,255,0.34)'], [0.5, 'rgba(50,110,220,0.10)'], [1, 'rgba(0,0,0,0)']]);
    fillRadial(g, box, x + w * 0.22, y + h * 1.02, w * 0.01, w * 0.84,
      [[0, 'rgba(126,255,220,0.26)'], [1, 'rgba(0,0,0,0)']]);
    fillRadial(g, box, x + w * 0.84, y + h * 0.82, w * 0.01, w * 0.6,
      [[0, 'rgba(12,30,64,0.62)'], [1, 'rgba(0,0,0,0)']]);
    fillRadial(g, box, x + w * 0.52, y + h * 0.44, w * 0.01, w * 0.42,
      [[0, 'rgba(180,255,238,0.10)'], [1, 'rgba(0,0,0,0)']]);

    /* 아주 옅은 사선 빛 */
    var streak = g.createLinearGradient(x, y + h, x + w, y);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5, 'rgba(200,255,240,0.05)');
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = streak;
    g.fillRect(x, y, w, h);

    /* 아래쪽은 글씨 자리라 조금 더 차분하게 */
    var deep = g.createLinearGradient(x, y + h * 0.55, x, y + h);
    deep.addColorStop(0, 'rgba(2,10,16,0)');
    deep.addColorStop(1, 'rgba(2,10,16,0.45)');
    g.fillStyle = deep;
    g.fillRect(x, y + h * 0.55, w, h * 0.45);

    fillRadial(g, box, x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.24, Math.max(w, h) * 0.84,
      [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.30)']]);
  }

  /* 배경 id → 그림 (box 안에만) */
  function paintBg(g, id, box) {
    if (!box || !box.w || !box.h) return;
    g.save();
    g.beginPath();
    g.rect(box.x, box.y, box.w, box.h);
    g.clip();
    if (id === 'courtnight') paintBgCourtNight(g, box);
    else if (id === 'shuttlelight') paintBgShuttleLight(g, box);
    else if (id === 'sunsetcourt') paintBgSunsetCourt(g, box);
    else paintBgMintMesh(g, box);
    g.restore();
  }

  /* ============================================================
   * 매거진 — 사진 풀블리드 · 하단 30% 소프트 그라데이션 · 큰 숫자
   * ============================================================ */
  function paintMagazine(g, spec, p, F) {
    var W = F.W, H = F.H, pad = F.pad, photo = photoOf(spec);
    /* 사진이 없으면 고른 기본 배경 아트를 깔고, 그것도 없으면 색 메쉬 */
    var art = photo ? null : bgOf(spec);
    var img = !!photo || !!art;

    if (photo) {
      try { drawCover(g, photo, 0, 0, W, H, photoViewOf(spec)); }
      catch (e) { photo = null; paintMesh(g, p, F); }
      if (photo) art = null;
      else art = bgOf(spec);
      if (!photo && art) { g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); paintBg(g, art.id, { x: 0, y: 0, w: W, h: H }); g.restore(); }
    } else if (art) {
      paintBg(g, art.id, { x: 0, y: 0, w: W, h: H });
    } else {
      paintMesh(g, p, F);
    }
    img = !!photo || (!photo && !!art);

    /* ---------- 글씨 묶음 자리 먼저 계산 (bm-v1.66.0 글씨 위치 … ·
     * 아래·가운데·위 어디든 같은 글씨 묶음을 통째로 밀어서 놓습니다.
     * 스크림도 이 자리를 따라가야 해서, 그리기 전에 계산합니다. */
    var maxW = W - pad * 2;
    var stats = spec.stats || [];
    var hasStats = stats.length > 0;
    var pos = textPosById(spec.textPos).id;

    var bitext = String((spec.big && spec.big.value) || '');
    var unit = String((spec.big && spec.big.unit) || '');
    var unitSize = 50;
    var unitW = unit ? (function () { g.font = font(unitSize, 600, FONT); return g.measureText(unit).width + 22; })() : 0;
    var fitted = fitText(g, bitext, maxW - unitW, 198, 900, FONT, 58);
    var bigSize = fitted.size;

    /* 기본(아래) 자리 — 예전과 똑같은 위치에서 시작합니다 */
    var metaY = F.bottom - 52;
    var ruleY = metaY - (spec.meta ? 58 : 36);
    var valBase = ruleY - 76;
    var bigBase = (hasStats ? valBase - 98 : ruleY - 86);

    /* 큰 숫자 위 제목 — 고른 문구(민턴일기 · 직접 쓴 문구)가 숫자 바로 위에 옵니다.
     * 대회 카드는 대회명이 주인공이라 문구를 그 위에 작게 얹습니다. */
    var kickerY = bigBase - Math.round(bigSize * 0.74) - 42;
    if (kickerY < F.safeTop + 158) kickerY = F.safeTop + 158;

    /* 글씨 묶음의 위·아래 끝 — 이 높이를 기준으로 통째로 옮깁니다 */
    var blockTop = kickerY - (spec.mode === 'comp'
      ? (spec.phrase ? 96 : 40)
      : (spec.phrase ? 44 : 18));
    var blockBottom = hasStats ? valBase + 54 : (spec.meta ? metaY + 12 : ruleY + 22);
    var dy = 0;
    var headBottom = F.safeTop + 132;          /* 좌상단 날짜 줄 아래 */
    if (pos === 'middle') {
      dy = Math.round((F.safeTop + F.bottom) / 2 - (blockTop + blockBottom) / 2);
    } else if (pos === 'top') {
      dy = Math.round((headBottom + 46) - blockTop);   /* 날짜 줄 아래에서 시작 */
    }
    if (pos !== 'bottom' && blockTop + dy < headBottom) dy = headBottom - blockTop;  /* 머리줄과 안 겹치게 */
    if (blockBottom + dy > F.bottom - 18) dy = (F.bottom - 18) - blockBottom;  /* 카드 밖으로 안 나가게 */
    metaY += dy; ruleY += dy; valBase += dy; bigBase += dy; kickerY += dy;
    blockTop += dy; blockBottom += dy;

    /* 사진 밝기 — 고른 단계만큼만 (원본은 그대로) */
    var dim = photo ? shadeDim(spec) : 0;
    if (dim > 0) {
      g.fillStyle = rgba(p.scrim, dim);
      g.fillRect(0, 0, W, H);
    }

    /* 스크림 — 글씨가 놓인 자리에만 부드럽게 스며들게 깔아 사진은 살리고 글씨는 또렷하게 */
    if (img) {
      if (pos === 'middle') {
        /* 가운데 — 글씨 자리 위아래로 아주 부드럽게 번지는 띠 (경계가 보이지 않게) */
        var bTop = Math.max(0, blockTop - 170), bBot = Math.min(H, blockBottom + 130);
        var band = g.createLinearGradient(0, bTop, 0, bBot);
        band.addColorStop(0, rgba(p.scrim, 0));
        band.addColorStop(0.30, rgba(p.scrim, 0.42));
        band.addColorStop(0.5, rgba(p.scrim, 0.72));
        band.addColorStop(0.70, rgba(p.scrim, 0.42));
        band.addColorStop(1, rgba(p.scrim, 0));
        g.fillStyle = band;
        g.fillRect(0, bTop, W, bBot - bTop);
      } else if (pos === 'top') {
        /* 위 — 위에서 내려오며 사라지는 스크림(스토리 안전 여백까지 덥습니다) */
        var tBot = Math.min(H, blockBottom + 56);
        var topScrim = g.createLinearGradient(0, 0, 0, tBot);
        topScrim.addColorStop(0, rgba(p.scrim, 0.90));
        topScrim.addColorStop(0.55, rgba(p.scrim, 0.62));
        topScrim.addColorStop(1, rgba(p.scrim, 0));
        g.fillStyle = topScrim;
        g.fillRect(0, 0, W, tBot);
      } else {
        /* 아래 — 위쪽 사진은 답답하지 않게, 아래 글씨만 또렷하게.
         * 네 구간으로 나눠 곡선을 부드럽게(급격한 경계가 보이지 않게) 깔았습니다. */
        var start = Math.round(H * 0.50);
        var scrim = g.createLinearGradient(0, start, 0, H);
        scrim.addColorStop(0, rgba(p.scrim, 0));
        scrim.addColorStop(0.22, rgba(p.scrim, 0.06));
        scrim.addColorStop(0.44, rgba(p.scrim, 0.26));
        scrim.addColorStop(0.64, rgba(p.scrim, 0.55));
        scrim.addColorStop(0.82, rgba(p.scrim, 0.80));
        scrim.addColorStop(1, rgba(p.scrim, 0.95));
        g.fillStyle = scrim;
        g.fillRect(0, start, W, H - start);
        /* 맨 위 한 줄도 읽히게 아주 옅은 그라데이션 */
        var topFade = g.createLinearGradient(0, 0, 0, Math.round(H * 0.17));
        topFade.addColorStop(0, rgba(p.scrim, 0.30));
        topFade.addColorStop(1, rgba(p.scrim, 0));
        g.fillStyle = topFade;
        g.fillRect(0, 0, W, Math.round(H * 0.17));
      }
    }

    var ink = img ? '#ffffff' : p.text;
    var soft = img ? 'rgba(255,255,255,0.84)' : p.muted;
    var lineColor = img ? 'rgba(255,255,255,0.32)' : p.hair;
    var shadow = img ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0)';
    var shadowBlur = img ? 16 : 0;

    /* 좌상단 — 얇은 모노스페이스 날짜 · 장소 한 줄 (살짝 풀어 쓴 자간) */
    var topY = F.safeTop + 84;
    g.textAlign = 'left';
    if (spec.top) {
      tracking(g, 1.2);
      var t = fitText(g, spec.top, W - pad * 2 - 240, 24, 500, MONO, 18);
      g.fillStyle = soft;
      g.globalAlpha = 0.9;
      g.font = font(t.size, 500, MONO);
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(t.text, pad, topY);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
      tracking(g, 0);
    }
    g.textAlign = 'right';
    g.fillStyle = soft;
    g.globalAlpha = 0.62;
    tracking(g, 3);
    g.font = font(19, 600, FONT);
    g.shadowColor = shadow;
    g.shadowBlur = shadowBlur;
    g.fillText('BADMINTON', W - pad, topY);
    g.shadowBlur = 0;
    g.globalAlpha = 1;
    tracking(g, 0);
    g.textAlign = 'left';

    /* 큰 숫자 · 단위 · 자리는 위에서 계산했고, 여기서는 글씨만 그립니다 */
    if (spec.mode === 'comp') {
      if (spec.phrase) {
        tracking(g, 0.6);
        var pt = fitText(g, spec.phrase, maxW, 25, 600, FONT, 15);
        g.textAlign = 'left';
        g.fillStyle = soft;
        g.globalAlpha = 0.92;
        g.font = font(pt.size, 600, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(pt.text, pad, kickerY - 58);
        g.shadowBlur = 0;
        g.globalAlpha = 1;
        tracking(g, 0);
      }
      if (spec.kicker) {
        g.textAlign = 'left';
        var kt = fitText(g, spec.kicker, maxW, 44, 700, FONT, 20);
        g.fillStyle = ink;
        g.font = font(kt.size, 700, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(kt.text, pad, kickerY);
        g.shadowBlur = 0;
      }
    } else if (spec.phrase) {
      tracking(g, -0.6);
      var tt = fitText(g, spec.phrase, maxW, 33, 700, FONT, 18);
      g.textAlign = 'left';
      g.fillStyle = ink;
      g.globalAlpha = 0.95;
      g.font = font(tt.size, 700, FONT);
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(tt.text, pad, kickerY);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
      tracking(g, 0);
    }

    /* 큰 숫자 — 화면에서 가장 큰 목소리. 자간만 살짝 조여 단단하게 */
    g.textAlign = 'left';
    g.fillStyle = ink;
    tracking(g, -2);
    g.font = font(bigSize, 900, FONT);
    g.shadowColor = 'rgba(0,0,0,0.32)';
    g.shadowBlur = img ? 26 : 0;
    g.fillText(fitted.text, pad, bigBase);
    var valueW = g.measureText(fitted.text).width;
    g.shadowBlur = 0;
    tracking(g, 0);
    if (unit) {
      g.font = font(unitSize, 600, FONT);
      g.fillStyle = p.accent;
      g.fillText(unit, pad + valueW + 20, bigBase - Math.round(bigSize * 0.08));
    }

    /* 얇은 가로선 1개 */
    paintRule(g, pad, ruleY, maxW, lineColor, p.accent);

    /* 스탯 2~3개 — 작고 얇은 라벨 + 숫자 */
    if (hasStats) {
      var colW = (maxW - 36 * (stats.length - 1)) / stats.length;
      stats.forEach(function (st, i) {
        var x = pad + colW * i + 36 * i;
        tracking(g, -1);
        var v = fitText(g, String(st.value), colW, 54, 800, FONT, 26);
        g.fillStyle = ink;
        g.font = font(v.size, 800, FONT);
        g.textAlign = 'left';
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(v.text, x, valBase);
        g.shadowBlur = 0;
        tracking(g, 1.2);
        g.fillStyle = soft;
        g.globalAlpha = 0.8;
        g.font = font(21, 600, FONT);
        g.shadowColor = shadow;
        g.shadowBlur = shadowBlur;
        g.fillText(String(st.label || ''), x, valBase + 46);
        g.shadowBlur = 0;
        g.globalAlpha = 1;
        tracking(g, 0);
      });
    }

    /* 맨 아래 얇은 한 줄 — 파트너/라이벌 */
    if (spec.meta) {
      tracking(g, 0.3);
      var m = fitText(g, spec.meta, maxW, 26, 500, FONT, 18);
      g.fillStyle = soft;
      g.globalAlpha = 0.76;
      g.font = font(m.size, 500, FONT);
      g.textAlign = 'left';
      g.shadowColor = shadow;
      g.shadowBlur = shadowBlur;
      g.fillText(m.text, pad, metaY);
      g.shadowBlur = 0;
      g.globalAlpha = 1;
      tracking(g, 0);
    }
  }

  /* ============================================================
   * 필름 — 오프화이트 여백 프레임 + 모노스페이스 한 줄 + 셔틀콕 스탬프
   * ============================================================ */
  function filmBox(F) {
    var x = 64, w = F.W - 128;
    /* 스토리에서는 위 안전 여백 아래에 제목 한 줄 자리를 더 둡니다 */
    var y = F.story ? F.safeTop + 68 : 74;
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
    /* 종이 가장자리에 아주 옅게 스며드는 그늘 — 인화지 느낌 */
    var edge = g.createRadialGradient(F.W * 0.5, F.H * 0.46, Math.min(F.W, F.H) * 0.30,
      F.W * 0.5, F.H * 0.46, Math.max(F.W, F.H) * 0.78);
    edge.addColorStop(0, 'rgba(120,104,76,0)');
    edge.addColorStop(1, 'rgba(120,104,76,0.10)');
    g.fillStyle = edge;
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
    var art = photo ? null : bgOf(spec);
    var pos = textPosById(spec.textPos).id;
    var cap = filmCaption(box, pos);

    if (photo || art) {
      /* 얇은 그림자 — 종이 위에 사진 한 장 */
      g.save();
      g.shadowColor = 'rgba(28,24,18,0.24)';
      g.shadowBlur = 36;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = 14;
      roundRect(g, box.x, box.y, box.w, box.h, 3);
      g.fillStyle = '#ded6c8';
      g.fill();
      g.restore();

      g.save();
      roundRect(g, box.x, box.y, box.w, box.h, 3);
      g.clip();
      if (photo) {
        try { drawCover(g, photo, box.x, box.y, box.w, box.h, photoViewOf(spec)); }
        catch (e) { photo = null; paintFilmPlaceholder(g, box, p); }
      }
      if (!photo) {
        if (art) paintBg(g, art.id, box);
        else paintFilmPlaceholder(g, box, p);
      }
      var dim = photo ? shadeDim(spec) : 0;
      if (dim > 0) {
        g.fillStyle = rgba([24, 19, 11], dim * 0.9);
        g.fillRect(box.x, box.y, box.w, box.h);
      }
      /* 사진 위에 글씨를 얹는 자리(가운데·위)에서만 부드러운 스크림 */
      if (cap.onPhoto) filmScrim(g, cap, p, cap.pos);
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
    g.strokeStyle = 'rgba(255,255,255,0.42)';
    g.lineWidth = 1;
    roundRect(g, box.x + 2, box.y + 2, box.w - 4, box.h - 4, 2);
    g.stroke();
    g.restore();

    /* 캡션 3줄 — '아래'는 여백에, '가운데'·'위'는 사진 위에 */
    filmCaptionText(g, spec, p, F, box, cap);

    /* 브랜드 — 아주 작게 */
    g.textAlign = 'right';
    g.fillStyle = PAPER.ink3;
    tracking(g, 2.4);
    g.font = font(17, 700, FONT);
    g.fillText('BADMINTON', W - 64, F.story ? F.bottom - 8 : H - 38);
    tracking(g, 0);
    g.textAlign = 'left';
  }

  /* 필름 캡션 3줄 — '아래'는 인화지 아래 여백, '가운데'·'위'는 사진 위에 얹습니다.
   * 인화지(폴−로이드) 느낌을 해치지 않게 여백 줄과 글씨 크기는 그대로 씁니다. */
  function filmCaption(box, pos) {
    var tx = box.x + 4, tw = box.w - 8;
    if (pos === 'middle') {
      var mid = box.y + box.h * 0.5 + 18;
      return {
        onPhoto: true, pos: pos, tx: tx, tw: tw,
        phraseY: mid - 118, l1: mid - 64, l2: mid + 8, l3: mid + 54,
        bandTop: box.y + box.h * 0.5 - 200, bandBot: Math.min(box.y + box.h, box.y + box.h * 0.5 + 160)
      };
    }
    if (pos === 'top') {
      var l1 = box.y + 118;
      return {
        onPhoto: true, pos: pos, tx: tx, tw: tw,
        phraseY: box.y + 74, l1: l1, l2: l1 + 62, l3: l1 + 106,
        bandTop: box.y, bandBot: Math.min(box.y + box.h, box.y + 330)
      };
    }
    var b1 = box.y + box.h + 72;
    return { onPhoto: false, pos: 'bottom', tx: tx, tw: tw, phraseY: box.y - 26, l1: b1, l2: b1 + 68, l3: b1 + 116 };
  }

  /* 사진 위 캡션 스크림 — 아래는 인화지 빛을 살리려고 종이톤 대신 어두운 톤을 얇게
   * 깔고, 가운데는 자리 위아래로 부드럽게 스며들게 깔았습니다. */
  function filmScrim(g, cap, p, pos) {
    var top = Math.max(0, cap.bandTop), bot = Math.max(top + 1, cap.bandBot);
    var grad = g.createLinearGradient(0, top, 0, bot);
    var dark = rgba([18, 15, 10], 0);
    if (pos === 'middle') {
      /* 가운데 — 가운데가 가장 진하고 양끝은 사라집니다 */
      grad.addColorStop(0, dark);
      grad.addColorStop(0.22, rgba([18, 15, 10], 0.62));
      grad.addColorStop(0.5, rgba([18, 15, 10], 0.74));
      grad.addColorStop(0.78, rgba([18, 15, 10], 0.62));
      grad.addColorStop(1, dark);
    } else {
      grad.addColorStop(0, rgba([18, 15, 10], 0.78));
      grad.addColorStop(0.55, rgba([18, 15, 10], 0.5));
      grad.addColorStop(1, dark);
    }
    g.fillStyle = grad;
    g.fillRect(cap.tx - 4, top, cap.tw + 8, bot - top);
  }

  /* 필름 캡션 3줄 — 사진 밖이면 종이 잉크, 사진 위면 흰 글씨 */
  function filmCaptionText(g, spec, p, F, box, cap) {
    var tx = cap.tx, tw = cap.tw;
    var on = cap.onPhoto;
    var inkMain = on ? '#ffffff' : PAPER.ink;
    var inkSub = on ? 'rgba(255,255,255,0.88)' : PAPER.ink2;
    var ruleColor = on ? 'rgba(255,255,255,0.36)' : 'rgba(29,27,24,0.14)';

    /* 제목 — 고른 문구 */
    if (spec.phrase) {
      var pt = fitText(g, spec.phrase, tw - 60, 29, 700, FONT, 16);
      g.textAlign = 'left';
      g.fillStyle = inkMain;
      g.font = font(pt.size, 700, FONT);
      g.fillText(pt.text, tx, cap.phraseY);
    }

    /* 1줄 — 모노스페이스 날짜 · 체육관 */
    g.textAlign = 'left';
    if (spec.top) {
      tracking(g, 0.8);
      var t = fitText(g, spec.top, tw - 150, 24, 500, MONO, 17);
      g.fillStyle = inkSub;
      g.font = font(t.size, 500, MONO);
      g.fillText(t.text, tx, cap.l1);
      tracking(g, 0);
    }
    paintRule(g, tx, cap.l1 + 24, tw - 160, ruleColor, p.accent);

    /* 2줄 — 핵심 스탯 한 줄 (굵게) */
    var line2 = spec.bigLine || '';
    if (line2) {
      tracking(g, -0.8);
      var b = fitText(g, line2, tw - 156, 44, 800, FONT, 26);
      g.fillStyle = inkMain;
      g.font = font(b.size, 800, FONT);
      g.fillText(b.text, tx, cap.l2);
      tracking(g, 0);
    }

    /* 3줄 — 얇은 한 줄 (파트너·종목·대회명) */
    if (spec.metaLine) {
      tracking(g, 0.2);
      var m = fitText(g, spec.metaLine, tw - 156, 27, 500, FONT, 17);
      g.fillStyle = inkSub;
      g.font = font(m.size, 500, FONT);
      g.fillText(m.text, tx, cap.l3);
      tracking(g, 0);
    }

    /* 오른쪽 아래 작은 셔틀콕 스탬프 — 2줄과 같은 높이에 정렬 */
    paintShuttle(g, F.W - 104, cap.l2 - 16, 46, p.accent);
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

    /* 글씨 위치 3단 (bm-v1.66.0) — 스티커는 투명이라 사진 위 어디든 놓을 수 있습니다.
     * 스티커 묶음(셔틀콕 아이콘 + 제목 + 큰 숫자 + 한 줄)을 통째로 옮깁니다. */
    var pos = textPosById(spec.textPos).id;
    var stampY = bigBase - Math.round(bigSize * 0.74) - 62;
    var blockTop = stampY - 30;
    var blockBottom = labelY + 12;
    var dy = 0;
    if (pos === 'middle') {
      dy = Math.round((F.safeTop + F.bottom) / 2 - (blockTop + blockBottom) / 2);
    } else if (pos === 'top') {
      dy = Math.round((F.safeTop + 150) - blockTop);
    }
    if (blockTop + dy < F.safeTop + 40) dy = (F.safeTop + 40) - blockTop;
    if (blockBottom + dy > F.bottom - 8) dy = (F.bottom - 8) - blockBottom;
    labelY += dy; bigBase += dy; stampY += dy;

    /* 큰 숫자 — 어떤 사진 위에 얹어도 또렷하게: 얇은 어두운 테두리 + 은은한 그림자 */
    g.textAlign = 'left';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.26)';
    g.lineWidth = Math.max(3, bigSize * 0.022);
    outlineText(g, fitted.text, pad, bigBase);
    g.fillStyle = '#ffffff';
    g.font = font(bigSize, 900, FONT);
    g.shadowColor = 'rgba(0,0,0,0.5)';
    g.shadowBlur = 26;
    g.fillText(fitted.text, pad, bigBase);
    var valueW = g.measureText(fitted.text).width;
    g.shadowBlur = 0;
    if (unit) {
      g.font = font(unitSize, 500, FONT);
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 3;
      outlineText(g, unit, pad + valueW + 14, bigBase - Math.round(bigSize * 0.05));
      g.fillStyle = p.accent;
      g.shadowColor = 'rgba(0,0,0,0.42)';
      g.shadowBlur = 18;
      g.fillText(unit, pad + valueW + 14, bigBase - Math.round(bigSize * 0.05));
      g.shadowBlur = 0;
    }

    /* 얇은 한 줄 */
    if (spec.label) {
      var l = fitText(g, spec.label, maxW - 70, 29, 500, FONT, 18);
      g.font = font(l.size, 500, FONT);
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 3;
      outlineText(g, l.text, pad, labelY);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 20;
      g.fillText(l.text, pad, labelY);
      g.shadowBlur = 0;
    }

    /* 작은 셔틀콕 라인 아이콘 + 제목 — 숫자 위 왼쪽 */
    paintShuttle(g, pad + 22, stampY, 42, p.accent);
    if (spec.phrase) {
      var pt = fitText(g, spec.phrase, maxW - 80, 29, 700, FONT, 15);
      g.textAlign = 'left';
      g.font = font(pt.size, 700, FONT);
      g.strokeStyle = 'rgba(0,0,0,0.24)';
      g.lineWidth = 3;
      outlineText(g, pt.text, pad + 62, stampY + 10);
      g.fillStyle = '#ffffff';
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 20;
      g.fillText(pt.text, pad + 62, stampY + 10);
      g.shadowBlur = 0;
    }
  }

  /* 챔피언 골드 프레임 그리기 (bm-v1.64.0) — 대회 인증 카드 위에 마지막으로 덮습니다.
   * 메탈릭 골드 이중 테두리 + 네 모서리 월계관 잎. 사진·배경·필름 종이 위에서도 또렷합니다. */
  function paintLeaf(g, x, y, rot, len, color) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    if (typeof g.ellipse === 'function') g.ellipse(0, 0, len * 0.34, len, 0, 0, Math.PI * 2);
    else g.arc(0, 0, len * 0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function paintChampFrame(g, F, p) {
    var gold = '#e8c26a';
    var goldSoft = 'rgba(232,194,106,0.62)';
    var inset = Math.round(F.W * 0.019);
    var inner = inset + Math.round(F.W * 0.011);
    var lw = Math.max(2, Math.round(F.W * 0.0035));
    g.save();
    /* 바깥 얇은 선 + 안쪽 금빛 선 — rect + stroke 로 그립니다(사각 박스 대신 프레임 선) */
    g.strokeStyle = goldSoft; g.lineWidth = Math.max(1.5, lw * 0.7);
    g.beginPath(); g.rect(inset, inset, F.W - inset * 2, F.H - inset * 2); g.stroke();
    g.strokeStyle = gold; g.lineWidth = lw * 1.7;
    g.beginPath(); g.rect(inner, inner, F.W - inner * 2, F.H - inner * 2); g.stroke();
    /* 네 모서리 월계관 — 가로·세로 가지에 잎 3장씩 */
    var s = Math.round(F.W * 0.046);
    var corners = [
      { x: inner, y: inner, dx: 1, dy: 1 },
      { x: F.W - inner, y: inner, dx: -1, dy: 1 },
      { x: inner, y: F.H - inner, dx: 1, dy: -1 },
      { x: F.W - inner, y: F.H - inner, dx: -1, dy: -1 }
    ];
    corners.forEach(function (c) {
      for (var i = 0; i < 3; i++) {
        var k = s * (0.66 + i * 0.64);
        var len = s * (0.52 - i * 0.07);
        paintLeaf(g, c.x + c.dx * k, c.y + c.dy * s * 0.17, Math.PI / 2, len, gold);
        paintLeaf(g, c.x + c.dx * s * 0.17, c.y + c.dy * k, 0, len, gold);
      }
    });
    g.restore();
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
    if (s.mode === 'comp' && frameOptionById(s.frame).id === 'champ') paintChampFrame(g, F, p);
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
      bg: bgById(prefs.bg).id,
      frame: frameOptionById(prefs.frame).id,
      phrase: phraseText(prefs.phrase) || DEFAULT_PHRASE,
      phraseComp: phraseText(prefs.phraseComp) || DEFAULT_PHRASE,
      /* 글씨 위치는 마지막에 고른 값을 기억합니다 (기본 '아래' = 예전과 같음) */
      textPos: textPosById(prefs.textPos).id,
      recordId: rec ? rec.id : '',
      photo: null,
      /* 사진 구도는 사진을 넣을 때마다 가운데 · 1.0배에서 시작합니다 */
      photoX: 0,
      photoY: 0,
      photoZoom: ZOOM_MIN,
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
      bg: ui.bg || '',
      photo: ui.photo || null,
      /* 사진 구도 — 끌어서 옮긴 위치와 확대 배율 (bm-v1.66.0) */
      photoX: ui.photoX || 0,
      photoY: ui.photoY || 0,
      photoZoom: zoomOf(ui.photoZoom),
      /* 글씨 위치 — 아래 · 가운데 · 위 (bm-v1.66.0) */
      textPos: textPosById(ui.textPos).id,
      /* 카드 프레임은 대회 인증 카드에만 (bm-v1.64.0) */
      frame: ui.mode === 'comp' ? frameOptionById(ui.frame).id : 'none'
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

  /* 기본 배경 칩 1개 — 썸네일은 같은 그림 함수로 그립니다(paintBgThumbs) */
  function bgChip(b) {
    var on = ui.bg === b.id && !ui.photo && ui.design !== 'sticker';
    return '<button type="button" class="sc__bg' + (on ? ' is-on' : '') + '" data-sc-bg="' + b.id + '" ' +
      'aria-pressed="' + (on ? 'true' : 'false') + '" title="' + U.esc(b.note) + '">' +
      '<canvas class="sc__bgthumb" width="84" height="105" data-sc-bgthumb="' + b.id + '" aria-hidden="true"></canvas>' +
      '<b>' + U.esc(b.name) + '</b></button>';
  }

  function hintOf(design, ratio) {
    if (design === 'sticker') return '투명 PNG라 내 사진·스토리 위에 그대로 붙일 수 있어요.';
    if (ratio === 'story') return '스토리는 위·아래 220px를 비워 프로필·답장창에 가리지 않아요.';
    return '피드 4:5예요. 스토리에 올리려면 비율을 스토리로 바꿔 주세요.';
  }

  /* 대회 카드 프레임 칩 — 기본은 무료, 챔피언은 하트 2개로 한 번 열면 계속 (bm-v1.64.0) */
  function framePicks(ctx) {
    return '<div class="field" data-sc-framebox><div class="field__label"><span>카드 프레임</span>' +
      '<small>챔피언은 하트로 열어요</small></div>' +
      '<div class="chips chips--wrap" role="group" aria-label="대회 카드 프레임">' + FRAMES.map(function (f) {
        var owned = ownsFrame(ctx, f.id);
        var on = frameOptionById(ui.frame).id === f.id;
        return '<button type="button" class="chip sc__framechip' + (on ? ' is-on' : '') + (owned ? '' : ' is-locked') + '"' +
          ' data-sc-frame="' + f.id + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
          ' title="' + U.esc(f.label + ' · ' + f.hint + (owned ? '' : ' · 하트 ' + f.price + '개로 열기')) + '">' +
          U.esc(f.label) + (owned ? '' : ' · 하트 ' + f.price) + '</button>';
      }).join('') + '</div></div>';
  }

  /* 챔피언 프레임 열기 — 하트가 모자라면 공용 하트 시트로 이어집니다 */
  function unlockFrame(ctx, id, done) {
    var opt = frameOptionById(id);
    if (!opt.deco) { done(); return; }
    var actions = (ctx && ctx.actions) || {};
    var canBuy = typeof actions.buyDeco === 'function';
    var res = canBuy ? actions.buyDeco('card', opt.id) : { ok: false, reason: 'no_store' };
    if (res && res.ok) {
      BM.ui.toast(res.purchased ? '하트 ' + res.price + '개로 ' + opt.label + ' 프레임을 열었어요' : '이미 열려 있어요');
      BM.ui.haptic(12);
      done();
      return;
    }
    if (res && res.reason === 'hearts' && BM.ads && BM.ads.openHeartSheet) {
      BM.ads.openHeartSheet(ctx, {
        need: opt.price,
        intro: function (s) {
          return '<p class="sheet__text">' + U.esc(opt.label) + ' 프레임 — <b>하트 ' + opt.price +
            '개</b>로 한 번 열면 계속 써요. 지금 <b>' + s.balance + '개</b> 있어요.' +
            (s.balance < opt.price ? ' <span class="warn">' + (opt.price - s.balance) + '개 부족</span>' : '') + '</p>';
        },
        continueLabel: '열기',
        onContinue: function () {
          var again = actions.buyDeco('card', opt.id);
          if (again && again.ok) {
            BM.ui.toast(opt.label + ' 프레임을 열었어요');
            BM.ui.haptic(12);
          } else {
            BM.ui.toast('아직 하트가 모자라요', 'error');
          }
          done();
        }
      });
      return;
    }
    if (res && res.reason === 'locked') { BM.ui.toast('잠시만요, 처리 중이에요'); return; }
    BM.ui.toast('챔피언 프레임은 하트 ' + opt.price + '개로 열 수 있어요', 'error');
  }

  /* 사진 구도 — 끌어서 위치 이동 + −·+·슬라이더 확대 (bm-v1.66.0)
   * 사진이 들어갔을 때만 나오고, '원래대로'는 위치·확대를 한 번에 복구합니다. */
  function zoomLabel(z) {
    return zoomOf(z).toFixed(2).replace(/0$/, '') + '×';
  }

  function zoomBox() {
    var on = !!ui.photo && ui.design !== 'sticker';
    return '<div class="sc__zoom" data-sc-zoombox' + (on ? '' : ' hidden') + '>' +
      '<div class="field__label"><span>사진 위치 · 확대</span>' +
        '<small data-sc-zoomlbl>' + zoomLabel(ui.photoZoom) + '</small></div>' +
      '<div class="sc__zoomrow">' +
        '<button type="button" class="sc__zoombtn" data-sc-zoomout aria-label="사진 작게">−</button>' +
        '<input type="range" class="sc__zoomslider" data-sc-zoom min="' + ZOOM_MIN + '" max="' + ZOOM_MAX + '" ' +
          'step="' + ZOOM_STEP + '" value="' + zoomOf(ui.photoZoom) + '" aria-label="사진 확대">' +
        '<button type="button" class="sc__zoombtn" data-sc-zoomin aria-label="사진 크게">+</button>' +
        '<button type="button" class="sc__zoomreset" data-sc-zoomreset>원래대로</button>' +
      '</div>' +
      '<p class="hint sc__dragghint">미리보기 사진을 손가락으로 끌면 구도를 옮길 수 있어요</p>' +
      '</div>';
  }

  /* 시트 — 초보자 기준 3초 완성 흐름 (bm-v1.63.0)
   *   탭 → 한 줄 안내 → 미리보기 → 📷 사진 넣기 (+ 기본 배경 4종) → 대회 입력(대회 탭)
   *   → 디자인 · 비율 · 사진 밝기 → 접기(문구 · 색 · 내용) → 저장
   * 가장 중요한 미리보기와 사진 버튼을 맨 위에 두고, 자주 안 고르는 옵션은 접었습니다. */
  function sheetBody(ctx) {
    var state = ctx && ctx.store ? ctx.store.state : {};
    var records = ((state.data && state.data.records) || []).slice(0, 5);
    var rec = recordById(ctx, ui.recordId);
    var dims = dimsOf(ui.ratio);
    var sticker = ui.design === 'sticker';

    var modeTabs = '<div class="seg seg--wide sc__modes" role="tablist">' + MODES.map(function (m) {
      return '<button type="button" class="seg__btn' + (ui.mode === m.id ? ' is-on' : '') + '" data-sc-mode="' + m.id + '" role="tab" ' +
        'aria-selected="' + (ui.mode === m.id ? 'true' : 'false') + '">' + U.esc(m.name) + '</button>';
    }).join('') + '</div>';

    /* 한 줄 안내 — 3초 안에 무엇을 할지 */
    var guide = '<p class="sc__guide">' +
      '<span><em>1</em>사진 고르고</span><i aria-hidden="true">→</i>' +
      '<span><em>2</em>저장 누르면 끝!</span></p>';

    /* 미리보기 — 시트를 열면 가장 먼저 카드가 보입니다 */
    var preview = '<div class="sc__preview' + (sticker ? ' is-sticker' : '') + '">' +
      '<canvas class="sc__canvas" width="' + dims.w + '" height="' + dims.h + '" aria-label="공유 카드 미리보기"></canvas></div>' +
      '<p class="sc__summary" data-sc-summary></p>';

    var picker = '';
    if (records.length > 1) {
      picker = '<label class="flabel"><span>어느 일지로 만들까요</span><select data-sc-field="recordId">' +
        records.map(function (r) {
          return '<option value="' + U.esc(r.id) + '"' + (String(r.id) === String(ui.recordId) ? ' selected' : '') + '>' +
            U.esc(U.shortDay(r.date) + (r.minutes ? ' · ' + r.minutes + '분' : '') + ((r.done || []).length ? ' · ' + r.done.slice(0, 2).join('·') : '')) +
            '</option>';
        }).join('') + '</select></label>';
    }

    /* 오늘 운동 — 세부 입력은 접기 안으로 */
    var todayFields = picker +
      '<div class="sc__grid">' +
      field('체육관', 'gym', ui.gym, { max: 20, placeholder: '예: ○○체육관' }) +
      field('함께 친 파트너', 'partner', ui.partner, { max: 12, placeholder: '비워도 돼요' }) +
      '</div>' +
      field('상대(라이벌)', 'rival', ui.rival, { max: 12, placeholder: '비워도 돼요' });

    /* 대회 인증 — 대회명·종목·성적·파트너는 접지 않고 바로 입력 */
    var compFields = '<div class="sc__compbox">' +
      '<div class="field__label"><span>대회 정보</span><small>카드에 그대로 들어가요</small></div>' +
      field('대회명', 'contest', ui.contest, { max: 24, placeholder: '예: ○○시 오픈 배드민턴 대회' }) +
      field('급수 · 종목', 'event', ui.event, { max: 20, placeholder: '예: B조 복식' }) +
      '<div class="field"><div class="field__label"><span>성적</span></div>' +
      '<div class="chips chips--wrap" data-sc-results>' + RESULTS.map(function (r) {
        return '<button type="button" class="chip' + (ui.result === r ? ' is-on' : '') + '" data-sc-result="' + r + '" ' +
          'aria-pressed="' + (ui.result === r ? 'true' : 'false') + '">' + r + '</button>';
      }).join('') + '</div></div>' +
      field('파트너', 'compPartner', ui.compPartner, { max: 12, placeholder: '비워도 돼요' }) +
      '</div>' + framePicks(ctx);

    var emptyToday = ui.mode === 'today' && !rec;
    var emptyNote = emptyToday
      ? '<p class="notice sc__notice">일지가 아직 없어요. 일지를 저장하면 운동 시간 · 승패 · 연속 일수가 카드에 채워져요.</p>'
      : '';

    /* 사진 — 스티커(투명)에는 필요 없어 숨깁니다 */
    var photoBox = '<div class="field sc__photo"' + (sticker ? ' hidden' : '') + '>' +
      '<div class="sc__shotrow">' +
        '<label class="sc__shot' + (ui.photo ? ' is-on' : '') + '">' +
          '<span class="sc__shotic">' + BM.ui.icon('camera') + '</span>' +
          '<span class="sc__shotxt"><b>' + (ui.photo ? '사진 바꾸기' : '사진 넣기') + '</b>' +
            '<small data-sc-photosub' + (ui.photo ? ' hidden' : '') + '>갤러리 · 카메라</small></span>' +
          '<input type="file" accept="image/*" data-sc-photo hidden>' +
        '</label>' +
        '<button type="button" class="sc__shotdel" data-sc-photoclear' + (ui.photo ? '' : ' hidden') + '>' +
          BM.ui.icon('trash') + '<span>사진 빼기</span></button>' +
      '</div>' +
      zoomBox() +
      '<div class="sc__bgrow"><span class="sc__bglabel">기본 배경</span><i class="sc__bghint">사진 없이도 감성 있게</i></div>' +
      '<div class="sc__bgs" role="group" aria-label="기본 배경 4종">' + BGS.map(bgChip).join('') + '</div>' +
      '<p class="hint sc__photohint">사진은 폰 안에서만 합쳐져요 · 서버로 보내지 않아요</p></div>';

    /* 디자인 3종 */
    var designPicks = '<div class="field"><div class="field__label"><span>디자인</span></div>' +
      '<div class="sc__designs">' + DESIGNS.map(function (d) {
        var on = ui.design === d.id;
        return '<button type="button" class="sc__design sc__design--' + d.id + (on ? ' is-on' : '') + '" data-sc-design="' + d.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '">' +
          '<i aria-hidden="true"></i><b>' + U.esc(d.name) + '</b><span>' + U.esc(d.note) + '</span></button>';
      }).join('') + '</div></div>';

    /* 비율 2종 + 그 비율에 맞는 한 줄 안내 */
    var ratioPicks = '<div class="field"><div class="field__label"><span>비율</span></div>' +
      '<div class="seg seg--wide sc__ratios" role="group" aria-label="카드 비율">' + RATIOS.map(function (r) {
        var on = ui.ratio === r.id;
        return '<button type="button" class="seg__btn sc__ratio sc__ratio--' + r.id + (on ? ' is-on' : '') + '" data-sc-ratio="' + r.id + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '"><i aria-hidden="true"></i><b>' + U.esc(r.name) + '</b></button>';
      }).join('') + '</div>' +
      '<p class="hint sc__ratiohint">' + hintOf(ui.design, ui.ratio) + '</p></div>';

    /* 글씨 위치 3단 (bm-v1.66.0) — 사진 속 인물·메달을 글씨가 가리지 않게 */
    var textPosPicks = '<div class="field"><div class="field__label"><span>글씨 위치</span>' +
      '<small>인물·메달을 가리지 않게</small></div>' +
      '<div class="seg seg--three sc__textpos" role="group" aria-label="글씨 위치">' + TEXT_POS.map(function (t) {
        var on = textPosById(ui.textPos).id === t.id;
        return '<button type="button" class="seg__btn sc__textposbtn sc__textposbtn--' + t.id + (on ? ' is-on' : '') + '" ' +
          'data-sc-textpos="' + t.id + '" aria-pressed="' + (on ? 'true' : 'false') + '" ' +
          'title="' + U.esc(t.note) + '">' + U.esc(t.name) + '</button>';
      }).join('') + '</div></div>';

    /* 사진 밝기 3단계 — 사진이 있을 때만 */
    var shadePicks = '<div class="field sc__shadebox"' + (ui.photo && !sticker ? '' : ' hidden') + '>' +
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

    /* 접기 — 문구 · 색 · 내용 바꾸기 (기본은 닫힘, 평소 화면은 아주 깔끔하게) */
    var more = '<details class="sc__more">' +
      '<summary class="sc__moresum">' + BM.ui.icon('tune') +
        '<span>문구 · 색 · 내용 바꾸기</span>' +
        '<i class="sc__chev" aria-hidden="true"></i></summary>' +
      '<div class="sc__morebody">' +
        phraseBlock(ui.mode) +
        (ui.mode === 'today' ? todayFields : '') +
        colorPicks +
      '</div></details>';

    var saveLabel = emptyToday ? '일지를 먼저 저장해 주세요'
      : (sticker ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유');

    /* 저장 — 늘 화면 아래에 붙어 있어 스크롤을 되돌리지 않아도 됩니다 */
    var saveBar = '<div class="sc__savebar">' +
      '<button type="button" class="btn btn--primary btn--big" data-sc-save' + (emptyToday ? ' disabled' : '') + '>' +
      BM.ui.icon('send') + '<span>' + saveLabel + '</span></button></div>';

    return modeTabs + guide + emptyNote + preview + photoBox +
      (ui.mode === 'comp' ? compFields : '') +
      designPicks + ratioPicks + textPosPicks + shadePicks + more + saveBar;
  }

  function paintPreview(wrap, ctx) {
    var canvas = wrap.querySelector('.sc__canvas');
    if (!canvas) return;
    var spec = specOf(ctx);
    draw(canvas, spec);
    /* 사진이 있으면 미리보기를 끌어 구도를 옮길 수 있다고 보여 줍니다 */
    var prev = canvas.parentNode;
    if (prev && prev.classList) prev.classList.toggle('is-drag', !!photoOf(spec) && ui.design !== 'sticker');
    var sum = wrap.querySelector('[data-sc-summary]');
    if (sum) sum.textContent = summaryOf(spec);
  }

  /* 컨트롤 표시를 현재 상태에 맞춥니다(사진 칸·기본 배경·밝기 칸·저장 버튼 이름 등) */
  function syncControls(node) {
    if (!node) return;
    var sticker = ui.design === 'sticker';
    var photoBox = node.querySelector('.sc__photo');
    if (photoBox) photoBox.hidden = sticker;
    var shadeBox = node.querySelector('.sc__shadebox');
    if (shadeBox) shadeBox.hidden = !ui.photo || sticker;
    var preview = node.querySelector('.sc__preview');
    if (preview) preview.classList.toggle('is-sticker', sticker);
    var saveLabel = node.querySelector('[data-sc-save] span');
    if (saveLabel) {
      saveLabel.textContent = sticker ? '투명 PNG 저장 · 공유' : 'PNG 저장 · 공유';
    }
    /* 사진 버튼 — 사진이 들어갔는지에 따라 이름·보조줄·‘사진 빼기’가 바뀍니다 */
    var shot = node.querySelector('.sc__shot');
    if (shot) shot.classList.toggle('is-on', !!ui.photo);
    var lbl = node.querySelector('.sc__shotxt b');
    if (lbl) lbl.textContent = ui.photo ? '사진 바꾸기' : '사진 넣기';
    var sub = node.querySelector('[data-sc-photosub]');
    if (sub) sub.hidden = !!ui.photo;
    var del = node.querySelector('[data-sc-photoclear]');
    if (del) del.hidden = !ui.photo;
    /* 사진 위치·확대 — 사진이 들어갔을 때만 (스티커는 사진을 얹지 않아요) */
    var zb = node.querySelector('[data-sc-zoombox]');
    if (zb) zb.hidden = !ui.photo || sticker;
    var zl = node.querySelector('[data-sc-zoomlbl]');
    if (zl) zl.textContent = zoomLabel(ui.photoZoom);
    var zs = node.querySelector('[data-sc-zoom]');
    if (zs && String(zs.value) !== String(zoomOf(ui.photoZoom))) zs.value = zoomOf(ui.photoZoom);
    syncTextPos(node);
    /* 기본 배경 4종 — 내 사진이 있으면 배경은 꺼진 상태 */
    Array.prototype.forEach.call(node.querySelectorAll('[data-sc-bg]'), function (b) {
      var on = !ui.photo && ui.bg === b.getAttribute('data-sc-bg');
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var hint = node.querySelector('.sc__ratiohint');
    if (hint) hint.textContent = hintOf(ui.design, ui.ratio);
  }

  /* 글씨 위치 3단 — 고른 자리만 켜 보입니다 */
  function syncTextPos(node) {
    if (!node) return;
    var cur = textPosById(ui.textPos).id;
    Array.prototype.forEach.call(node.querySelectorAll('[data-sc-textpos]'), function (b) {
      var on = b.getAttribute('data-sc-textpos') === cur;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* 기본 배경 썸네일 — 카드와 같은 그림 함수로 작게 그려 늘 같은 결과 */
  function paintBgThumbs(node) {
    Array.prototype.forEach.call(node.querySelectorAll('[data-sc-bgthumb]'), function (cv) {
      if (!cv || !cv.getContext) return;
      var g = cv.getContext('2d');
      if (!g) return;
      var w = cv.width || 84, h = cv.height || 105;
      g.clearRect(0, 0, w, h);
      paintBg(g, cv.getAttribute('data-sc-bgthumb'), { x: 0, y: 0, w: w, h: h });
    });
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
        paintBgThumbs(node);

        /* 미리보기 사진 끌기 — 손가락·마우스로 구도 옮기기 (bm-v1.66.0)
         * 시트 본문을 다시 그릴 때마다 캔버스가 새로 생기므로, 시트(node)에 걸어 둡니다. */
        var drag = null, rafId = 0;
        function scheduleRepaint() {
          if (typeof requestAnimationFrame !== 'function') { paintPreview(node, ctx); return; }
          if (rafId) return;
          rafId = requestAnimationFrame(function () { rafId = 0; paintPreview(node, ctx); });
        }
        node.addEventListener('pointerdown', function (ev) {
          var cv = ev.target && ev.target.closest ? ev.target.closest('.sc__canvas') : null;
          if (!cv || !ui.photo || ui.design === 'sticker') return;
          if (ev.button && ev.button !== 0) return;
          if (ev.preventDefault) ev.preventDefault();
          drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, cv: cv };
          cv.classList.add('is-grabbing');
          try { node.setPointerCapture(ev.pointerId); } catch (e) { /* 무시 */ }
        });
        node.addEventListener('pointermove', function (ev) {
          if (!drag || ev.pointerId !== drag.id) return;
          if (ev.preventDefault) ev.preventDefault();
          var r = movePhotoBy(drag.cv, specOf(ctx), ev.clientX - drag.x, ev.clientY - drag.y);
          drag.x = ev.clientX; drag.y = ev.clientY;
          if (!r) return;
          ui.photoX = r.x; ui.photoY = r.y;
          if (r.moved) scheduleRepaint();
        });
        function endDrag(ev) {
          if (!drag || (ev && ev.pointerId !== drag.id)) return;
          if (drag.cv) drag.cv.classList.remove('is-grabbing');
          try { node.releasePointerCapture(drag.id); } catch (e) { /* 무시 */ }
          drag = null;
        }
        node.addEventListener('pointerup', endDrag);
        node.addEventListener('pointercancel', endDrag);
        node.addEventListener('pointerleave', endDrag);

        function repaint() { paintPreview(node, ctx); }

        /* 대회 프레임을 열거나 모드를 바꾼 뒤 — 시트 안쪽만 다시 그립니다 */
        function refresh() {
          var body = node.querySelector('.sheet__body');
          if (body) body.innerHTML = sheetBody(ctx);
          paintPreview(node, ctx);
          paintBgThumbs(node);
        }

        node.addEventListener('click', function (ev) {
          /* 대회 인증 카드 프레임 (bm-v1.64.0) */
          var fr = ev.target.closest('[data-sc-frame]');
          if (fr) {
            ev.preventDefault();
            var fid = frameOptionById(fr.getAttribute('data-sc-frame')).id;
            if (!ownsFrame(ctx, fid)) { unlockFrame(ctx, fid, function () { ui.frame = 'champ'; writePrefs({ frame: ui.frame }); refresh(); }); return; }
            ui.frame = fid;
            Array.prototype.forEach.call(node.querySelectorAll('[data-sc-frame]'), function (b) {
              var on = frameOptionById(b.getAttribute('data-sc-frame')).id === ui.frame;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            BM.ui.haptic(6);
            writePrefs({ frame: ui.frame });
            repaint();
            return;
          }
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
            paintBgThumbs(node);
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
            syncControls(node);
            writePrefs({ ratio: ui.ratio });
            repaint();
            return;
          }
          /* 글씨 위치 3단 — 아래 · 가운데 · 위 (bm-v1.66.0) */
          var tp = ev.target.closest('[data-sc-textpos]');
          if (tp) {
            ev.preventDefault();
            ui.textPos = textPosById(tp.getAttribute('data-sc-textpos')).id;
            BM.ui.haptic(6);
            syncTextPos(node);
            writePrefs({ textPos: ui.textPos });
            repaint();
            return;
          }
          /* 사진 구도 — − · + · 원래대로 (bm-v1.66.0) */
          var zi = ev.target.closest('[data-sc-zoomin]');
          var zo = ev.target.closest('[data-sc-zoomout]');
          if (zi || zo) {
            ev.preventDefault();
            var next = zoomOf(ui.photoZoom) + (zi ? ZOOM_STEP : -ZOOM_STEP);
            ui.photoZoom = Math.round(zoomOf(next) * 100) / 100;
            BM.ui.haptic(6);
            syncControls(node);
            repaint();
            return;
          }
          if (ev.target.closest('[data-sc-zoomreset]')) {
            ev.preventDefault();
            ui.photoX = 0; ui.photoY = 0; ui.photoZoom = ZOOM_MIN;
            BM.ui.haptic(8);
            syncControls(node);
            repaint();
            return;
          }
          /* 기본 감성 배경 4종 — 한 번 누르면 그 배경으로, 다시 누르면 사진 없이(색 바탕)로 */
          var bgb = ev.target.closest('[data-sc-bg]');
          if (bgb) {
            ev.preventDefault();
            var bid = bgb.getAttribute('data-sc-bg');
            ui.bg = (!ui.photo && ui.bg === bid) ? '' : bid;
            if (ui.bg) ui.photo = null;   /* 기본 배경을 고르면 내 사진보다 먼저 보입니다 */
            BM.ui.haptic(6);
            syncControls(node);
            writePrefs({ bg: ui.bg });
            repaint();
            return;
          }
          if (ev.target.closest('[data-sc-photoclear]')) {
            ev.preventDefault();
            ui.photo = null;
            ui.photoX = 0; ui.photoY = 0; ui.photoZoom = ZOOM_MIN;   /* 구도도 기본값으로 */
            BM.ui.haptic(6);
            syncControls(node);
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
          /* 사진 확대 슬라이더 — 끄는 동안 바로 따라 그립니다 */
          var zr = ev.target.closest('[data-sc-zoom]');
          if (zr) {
            ui.photoZoom = zoomOf(zr.value);
            var zl = node.querySelector('[data-sc-zoomlbl]');
            if (zl) zl.textContent = zoomLabel(ui.photoZoom);
            repaint();
            return;
          }
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
            ui.bg = '';          /* 내 사진이 기본 배경보다 먼저 */
            /* 사진을 바꾸면 구도(위치·확대)는 가운데 · 1.0배로 돌아갑니다 */
            ui.photoX = 0; ui.photoY = 0; ui.photoZoom = ZOOM_MIN;
            writePrefs({ bg: '' });
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
    DESIGNS: DESIGNS, RATIOS: RATIOS, SHADES: SHADES, PALETTES: PALETTES, BGS: BGS,
    FRAMES: FRAMES, frameOptionById: frameOptionById, ownsFrame: ownsFrame,
    unlockFrame: unlockFrame, paintChampFrame: paintChampFrame,
    PHRASES: PHRASES, PHRASE_MAX: PHRASE_MAX, DEFAULT_PHRASE: DEFAULT_PHRASE,
    designById: designById, ratioById: ratioById, shadeById: shadeById, paletteById: paletteById,
    bgById: bgById, bgOf: bgOf, paintBg: paintBg,
    phraseById: phraseById, phraseText: phraseText, isPresetPhrase: isPresetPhrase,
    dimsOf: dimsOf,
    TEXT_POS: TEXT_POS, textPosById: textPosById,
    ZOOM_MIN: ZOOM_MIN, ZOOM_MAX: ZOOM_MAX, ZOOM_STEP: ZOOM_STEP,
    zoomOf: zoomOf, zoomLabel: zoomLabel,
    photoViewOf: photoViewOf, coverBox: coverBox, photoFrameOf: photoFrameOf, movePhotoBy: movePhotoBy,
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
