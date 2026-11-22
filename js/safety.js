/* ============================================================
 * js/safety.js — 신고 · 차단 (bm-v1.55.0) · 구글 Play UGC 심사 요건
 *
 *  커뮤니티 글·답글·1:1 대화에서 다른 사람의 내용을 신고하거나 그 사람을 차단합니다.
 *   · 신고: 사유 4종(욕설·비방 / 광고·도배 / 부적절한 만남·내용 / 기타) 중 하나를 고르고
 *     한 줄(선택)을 적어 보냅니다 → store.reportContent가 '신고' 한 줄로 남깁니다.
 *   · 차단: 한 번 더 확인한 뒤 store.blockUser가 그 사람을 '차단' 한 줄로 남기고,
 *     그 사람의 글·답글·매칭·1:1 대화는 파생 데이터(derive)에서 바로 빠집니다.
 *     해제는 MY › 차단한 사람에서 언제든 할 수 있습니다.
 *  화면(시트)만 여기서 그리고, 저장·계산은 store·domain이 맡습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;

  /* 시트를 다시 그려도 고른 사유·한 줄이 남게 모듈에 둡니다 */
  var draft = { reason: '', detail: '' };

  function resetDraft() { draft = { reason: '', detail: '' }; }

  /* 신고 대상 한 줄 — { kind, targetId, targetUser, nick, text } */
  function normalizeTarget(t) {
    t = t || {};
    var kind = D.REPORT_KINDS[String(t.kind || '')] ? String(t.kind) : 'post';
    return {
      kind: kind,
      targetId: String(t.targetId == null ? '' : t.targetId),
      targetUser: String(t.targetUser == null ? '' : t.targetUser),
      nick: String(t.nick == null ? '' : t.nick) || '이 사람',
      avatar: t.avatar || null,
      text: String(t.text == null ? '' : t.text)
    };
  }

  /* ---------- 사유 고르기 ---------- */
  function reasonChips(current) {
    return D.REPORT_REASONS.map(function (r) {
      var on = r.code === current;
      return '<button type="button" class="safety__chip' + (on ? ' is-on' : '') + '" data-report-reason="' + U.esc(r.code) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        (on ? UI.icon('check', 'safety__chipic') : '') + U.esc(r.label) + '</button>';
    }).join('');
  }

  /* ---------- 신고 시트 ---------- */
  function reportBody(target) {
    var t = normalizeTarget(target);
    var kindLabel = D.reportKindLabel(t.kind);
    var quote = t.text ? '<p class="safety__quote">' + U.esc(U.truncate(t.text.replace(/\s+/g, ' ').trim(), 60)) + '</p>' : '';
    return '<div class="safety" data-safety-form>' +
      '<p class="safety__lead">' + UI.icon('flag') +
      '<span><b>' + U.esc(t.nick) + '</b>님의 ' + U.esc(kindLabel) + '을 신고해요</span></p>' +
      quote +
      '<p class="safety__q">이유를 골라 주세요</p>' +
      '<div class="safety__chips" data-reason-list>' + reasonChips(draft.reason) + '</div>' +
      '<label class="safety__note"><span>한 줄 <small>선택 · ' + D.REPORT_NOTE_MAX + '자까지</small></span>' +
      '<input type="text" maxlength="' + D.REPORT_NOTE_MAX + '" data-report-detail value="' + U.esc(draft.detail) + '"' +
      ' placeholder="어떤 점이 문제였는지 짧게 적어 주세요"></label>' +
      '<p class="safety__hint">' + UI.icon('shield') + '신고는 운영자에게만 전달돼요. 상대에게는 알리지 않습니다.</p>' +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--ghost grow" data-close="1">취소</button>' +
      '<button type="button" class="btn btn--danger grow" data-report-send="1">' + UI.icon('flag') + '신고하기</button>' +
      '</div></div>';
  }

  function openReportSheet(ctx, target) {
    if (!ctx || !ctx.actions) return null;
    var t = normalizeTarget(target);
    resetDraft();
    return UI.openSheet({
      title: '신고하기',
      body: reportBody(t),
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var chip = ev.target.closest('[data-report-reason]');
          if (chip) {
            ev.preventDefault();
            var code = chip.getAttribute('data-report-reason');
            draft.reason = draft.reason === code ? '' : code;
            var box = wrap.querySelector('[data-reason-list]');
            if (box) box.innerHTML = reasonChips(draft.reason);
            UI.haptic(6);
            return;
          }
          if (ev.target.closest('[data-report-send]')) {
            ev.preventDefault();
            var detail = wrap.querySelector('[data-report-detail]');
            if (!draft.reason) { UI.toast('신고 이유를 골라 주세요', 'error'); UI.haptic(4); return; }
            var res = ctx.actions.reportContent({
              kind: t.kind, targetId: t.targetId, targetUser: t.targetUser,
              reason: draft.reason, detail: detail ? detail.value : '', text: t.text
            });
            if (res && res.ok) {
              resetDraft();
              UI.closeSheet();
              UI.haptic(14);
              UI.toast('신고가 접수됐어요 · 운영자가 확인할게요');
              return;
            }
            if (res && res.reason === 'mine') UI.toast('내 글·답글은 신고할 수 없어요', 'error');
            else if (res && res.reason === 'no_login') UI.toast('로그인하면 신고할 수 있어요', 'error');
            else if (res && res.reason === 'locked') UI.toast('잠시만요, 보내는 중이에요');
            else UI.toast('신고를 보내지 못했어요', 'error');
            return;
          }
        });
        wrap.addEventListener('input', function (ev) {
          if (ev.target.closest('[data-report-detail]')) draft.detail = ev.target.value;
        });
      }
    });
  }

  /* ---------- 차단 확인 시트 (1:1 대화 등 시트가 자연스러운 자리) ---------- */
  function blockBody(target) {
    var t = normalizeTarget(target);
    return '<div class="safety">' +
      '<p class="safety__lead">' + UI.icon('block') +
      '<span><b>' + U.esc(t.nick) + '</b>님을 차단할까요?</span></p>' +
      '<ul class="safety__list">' +
      '<li>이 사람의 글·답글이 보이지 않아요</li>' +
      '<li>매칭 목록과 1:1 대화에서도 빠져요</li>' +
      '<li>MY › 차단한 사람에서 언제든 풀 수 있어요</li>' +
      '</ul>' +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--ghost grow" data-close="1">취소</button>' +
      '<button type="button" class="btn btn--danger grow" data-block-yes="' + U.esc(t.targetUser) + '">' + UI.icon('block') + '차단하기</button>' +
      '</div></div>';
  }

  function openBlockSheet(ctx, target) {
    if (!ctx || !ctx.actions) return null;
    var t = normalizeTarget(target);
    return UI.openSheet({
      title: '차단하기',
      body: blockBody(t),
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var yes = ev.target.closest('[data-block-yes]');
          if (!yes) return;
          ev.preventDefault();
          doBlock(ctx, yes.getAttribute('data-block-yes'));
        });
      }
    });
  }

  /* 차단 실행 + 결과 안내 — 화면마다 같은 문구를 쓰게 한 곳에 둡니다 */
  function doBlock(ctx, userKey) {
    if (!ctx || !ctx.actions) return { ok: false };
    var res = ctx.actions.blockUser(userKey);
    if (res && res.ok) {
      UI.closeSheet();
      UI.haptic(14);
      UI.toast((res.already ? '이미 차단한 사람이에요' : '차단했어요') + ' · MY › 차단한 사람에서 풀 수 있어요');
      return res;
    }
    if (res && res.reason === 'mine') UI.toast('나 자신은 차단할 수 없어요', 'error');
    else if (res && res.reason === 'no_login') UI.toast('로그인하면 차단할 수 있어요', 'error');
    else if (res && res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
    else UI.toast('차단하지 못했어요', 'error');
    return res || { ok: false };
  }

  function doUnblock(ctx, userKey) {
    if (!ctx || !ctx.actions) return { ok: false };
    var res = ctx.actions.unblockUser(userKey);
    if (res && res.ok) {
      UI.haptic(10);
      UI.toast('차단을 풀었어요 · 이제 글과 대화가 다시 보여요');
      return res;
    }
    if (res && res.reason === 'not_found') UI.toast('이미 차단이 풀린 사람이에요');
    else UI.toast('차단을 풀지 못했어요', 'error');
    return res || { ok: false };
  }

  /* ---------- 1:1 대화방 헤더의 ⋯ — 신고 · 차단 한 화면 ---------- */
  function actionsBody(target) {
    var t = normalizeTarget(target);
    return '<div class="safety safety--menu">' +
      '<p class="safety__lead">' + UI.avatar(t.avatar || { nick: t.nick }, 40) +
      '<span><b>' + U.esc(t.nick) + '</b>님</span></p>' +
      '<div class="safety__acts">' +
      '<button type="button" class="safetyact" data-safety-report="1">' + UI.icon('flag') +
      '<span>신고하기<small>욕설·광고·부적절한 내용을 운영자에게 알려요</small></span></button>' +
      '<button type="button" class="safetyact safetyact--danger" data-safety-block="1">' + UI.icon('block') +
      '<span>차단하기<small>이 사람의 글·매칭·1:1 대화를 숨겨요</small></span></button>' +
      '</div></div>';
  }

  function openActionsSheet(ctx, target) {
    if (!ctx || !ctx.actions) return null;
    var t = normalizeTarget(target);
    return UI.openSheet({
      title: t.nick,
      body: actionsBody(t),
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-safety-report]')) {
            ev.preventDefault();
            openReportSheet(ctx, t);
            return;
          }
          if (ev.target.closest('[data-safety-block]')) {
            ev.preventDefault();
            openBlockSheet(ctx, t);
            return;
          }
        });
      }
    });
  }

  BM.safety = {
    openReportSheet: openReportSheet,
    openBlockSheet: openBlockSheet,
    openActionsSheet: openActionsSheet,
    doBlock: doBlock,
    doUnblock: doUnblock,
    reportBody: reportBody,
    blockBody: blockBody,
    actionsBody: actionsBody,
    normalizeTarget: normalizeTarget,
    _reset: resetDraft,
    _draft: function () { return { reason: draft.reason, detail: draft.detail }; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
