/* ============================================================
 * art.js — 빈 화면 일러스트 (v1.33.0)
 *
 * 글자만 남은 빈 화면 자리에 넣는 가벼운 인라인 SVG 그림입니다.
 *  · 전부 선화라 파일을 더 받지 않고, 테마 변수(currentColor · var(--accent) ·
 *    var(--accent-soft) · var(--line))로 그려 다크·라이트·사쿠라·라임에서 저절로 어울립니다.
 *  · 색은 CSS(.empty__art .st / .st-f / .st-a / .st-d)가 정합니다. 그림은 모양만 만듭니다.
 *  · 그림 하나가 3~5KB를 넘지 않게 path를 손으로 적었습니다(외부 이미지·아이콘 폰트 없음).
 *
 * 쓰는 곳: BM.ui.emptyState(kind, …) — kind가 아래 ART에 있으면 그림을,
 * 없으면 예전처럼 24px 아이콘을 그립니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};

  /* 그림 상자 — 가로 168 · 세로 96 (화면에는 높이 72px로 그립니다) */
  var BOX = '0 0 168 96';

  function svg(inner) {
    return '<svg class="empty__art" viewBox="' + BOX + '" aria-hidden="true" focusable="false">' +
      inner + '</svg>';
  }

  /* ---------- 조각 ---------- */

  /* 셔틀콕 — 로컬 22×26, (x,y)가 가운데. 깃(위) + 코르크(아래) */
  function shuttle(x, y, s, rot, cls) {
    return '<g class="' + (cls || 'st') + '" transform="translate(' + x + ' ' + y + ')' +
      (rot ? ' rotate(' + rot + ')' : '') + ' scale(' + s + ') translate(-11 -13)">' +
      '<path d="M4.6 1h12.8L14.2 15.2H7.8L4.6 1z"/>' +
      '<path class="st-f" d="M5.4 5.4h11.2M8 1.6l1.5 13.4M11 1.2v13.8M14 1.6l-1.5 13.4"/>' +
      '<path d="M7.8 15.2h6.4v2.3a3.2 3.2 0 0 1-6.4 0v-2.3z"/>' +
      '</g>';
  }

  /* 라켓 — 로컬 44×78, (22,39)이 가운데. 머리(타원) + 줄 + 자루 + 손잡이 */
  function racket(x, y, s, rot) {
    return '<g class="st" transform="translate(' + x + ' ' + y + ')' +
      (rot ? ' rotate(' + rot + ')' : '') + ' scale(' + s + ') translate(-22 -39)">' +
      '<path d="M22 6a15 17 0 1 1 0 34a15 17 0 0 1 0-34z"/>' +
      '<path class="st-f" d="M8.4 17h27.2M7 23h30M8.4 29h27.2M14 9.2v27.6M22 6.4v33.2M30 9.2v27.6"/>' +
      '<path d="M22 40.4v18"/>' +
      '<path d="M20 58h4a3.4 3.4 0 0 1 3.4 3.4v10.8A3.4 3.4 0 0 1 24 75.6h-4a3.4 3.4 0 0 1-3.4-3.4V61.4A3.4 3.4 0 0 1 20 58z"/>' +
      '<path class="st-f" d="M18.4 66h7.2M18.4 72h7.2"/>' +
      '</g>';
  }

  /* 코트 바닥 한 조각 — 베이스라인 + 두 사이드라인 + 서비스 라인. 로컬 88폭 × 30높이 */
  function court(x, y) {
    return '<g transform="translate(' + x + ' ' + y + ')">' +
      '<path class="st" d="M2 30h84"/>' +
      '<path class="st" d="M12 30 18 3M78 30 72 3"/>' +
      '<path class="st-f" d="M15.6 18h56.8"/>' +
      '</g>';
  }

  /* 네트 — 두 포스트 + 윗밴드 + 그물. 로컬 24폭 × 50높이 */
  function net(x, y) {
    return '<g transform="translate(' + x + ' ' + y + ')">' +
      '<path class="st" d="M2 0v50M22 0v50"/>' +
      '<path class="st" d="M-1 0h26"/>' +
      '<path class="st-f" d="M2 10h20M2 20h20M2 30h20M2 40h20M9 0v50M15 0v50"/>' +
      '</g>';
  }

  /* ---------- 그림 ---------- */

  var ART = {};

  /* 아직 기록이 없어요 — 코트로 내려앉는 첫 셔틀콕 */
  ART.log = function () {
    return svg(
      shuttle(48, 24, 1.25, -32, 'st-a') +
      '<path class="st-d" d="M62 32q24 10 34 20"/>' +
      '<g transform="translate(46 56) rotate(-7)">' +
      '<path class="st" d="M0 0h82v36H0z"/>' +
      '<path class="st" d="M0 10h82"/>' +
      '<path class="st-f" d="M4 10v-5M12 10v-5M20 10v-5M28 10v-5M36 10v-5M46 10v-5M54 10v-5M62 10v-5M70 10v-5M78 10v-5"/>' +
      '<path class="st-f" d="M0 23h82M41 10v26"/>' +
      '</g>' +
      '<circle class="st-f" cx="146" cy="26" r="2.2"/>'
    );
  };

  /* 조건에 맞는 선수가 없어요 — 라켓으로 둘러보는 중 */
  ART.search = function () {
    return svg(
      racket(44, 50, 1.16, -20) +
      '<circle class="st-d" cx="122" cy="34" r="22"/>' +
      shuttle(122, 32, .82, 18, 'st-a') +
      '<path class="st" d="M137 53l10 10"/>' +
      '<circle class="st-f" cx="34" cy="26" r="2.2"/>'
    );
  };

  /* 아직 글이 없어요 — 네트를 사이에 두고 오가는 셔틀콕 */
  ART.community = function () {
    return svg(
      net(72, 40) +
      '<path class="st" d="M54 88h60"/>' +
      shuttle(38, 42, .95, 54, 'st-a') +
      shuttle(128, 62, .95, -118, 'st-a') +
      '<path class="st-d" d="M50 40q30-28 62-6"/>' +
      '<circle class="st-f" cx="30" cy="24" r="2.2"/>'
    );
  };

  /* 선수 기록이 없어요 — 코치의 전술 보드 */
  ART.coach = function () {
    return svg(
      '<path class="st" d="M42 18h84a9 9 0 0 1 9 9v52a9 9 0 0 1-9 9H42a9 9 0 0 1-9-9V27a9 9 0 0 1 9-9z"/>' +
      '<path class="st" d="M70 12h28a3 3 0 0 1 3 3v6H67v-6a3 3 0 0 1 3-3z"/>' +
      '<g transform="translate(46 34) scale(0.8)">' +
      '<path class="st-f" d="M2 30h84"/>' +
      '<path class="st-f" d="M12 30 18 3M78 30 72 3"/>' +
      '<path class="st-f" d="M15.6 18h56.8"/>' +
      '</g>' +
      '<path class="st-d" d="M46 82q24-10 40-20"/>' +
      shuttle(114, 54, .62, 26, 'st-a')
    );
  };

  /* 보낸 요청이 없어요 — 요청을 담아 띄워 보내기 */
  ART.send = function () {
    return svg(
      '<path class="st" d="M30 42h82a9 9 0 0 1 9 9v28a9 9 0 0 1-9 9H30a9 9 0 0 1-9-9V51a9 9 0 0 1 9-9z"/>' +
      '<path class="st" d="M23 47l48 26 48-26"/>' +

      '<path class="st-d" d="M120 42q14-12 20-18"/>' +
      shuttle(144, 22, .9, 26, 'st-a')
    );
  };

  /* 받은 피드백이 아직 없어요 — 지금 막 날아온 한 마디 */
  ART.spark = function () {
    return svg(
      shuttle(64, 46, 1.5, -10, 'st-a') +
      '<path class="st" d="M112 26l2.8 7.6 7.6 2.8-7.6 2.8-2.8 7.6-2.8-7.6-7.6-2.8 7.6-2.8z"/>' +
      '<circle class="st" cx="130" cy="50" r="2.4"/>' +
      '<path class="st-f" d="M94 30h7M128 28h7"/>' +
      '<path class="st" d="M34 84h96"/>'
    );
  };

  /* kind → 그림. 없는 kind는 빈 문자열이라 예전 아이콘으로 그립니다. */
  function empty(kind) {
    var fn = ART[kind];
    return typeof fn === 'function' ? fn() : '';
  }

  BM.art = { empty: empty, kinds: Object.keys(ART), BOX: BOX, shuttle: shuttle, racket: racket, court: court };
})(typeof globalThis !== 'undefined' ? globalThis : this);
