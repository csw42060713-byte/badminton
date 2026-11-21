/* ============================================================
 * views/friends.js — 친구 코드(#XXXX)로 친구 추가 (bm-v1.38.0)
 *
 *  · 친구는 서로의 코드를 아는 사람끼리만 맺습니다.
 *    닉네임 검색·프로필 화면에는 '친구 추가' 버튼이 없습니다.
 *  · 코드는 user_key 에서 나오는 4자리(domain.friendCodeOf)라
 *    서버(app_users.user_key)·시트·기기 어디서 계산해도 같습니다.
 *  · 이 시트는 채팅 목록의 + 버튼과 MY의 내 코드에서 열립니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;
  BM.views = BM.views || {};

  function meKey(state) { return (state && state.me && state.me.key) || ''; }

  /* 화면 상태는 data.idx 안에 계산된 모음이 들어 있습니다(store.derive) */
  function idxOf(state) { return (state && (state.data && state.data.idx || state.idx)) || { byType: {} }; }

  /* 내 코드 글자 — '#A7K2' */
  function myCode(state) { return D.friendCodeOf(meKey(state)); }

  /* 복사·공유에 쓰는 글자 — '나래#A7K2' */
  function myCodeText(state) {
    return D.friendCodeWithNick(idxOf(state), meKey(state), (state && state.me && state.me.nick) || '');
  }

  /* ---------- 복사 ---------- */
  function legacyCopy(text) {
    try {
      if (typeof document === 'undefined' || !document.body) return false;
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.select();
      var done = !!(document.execCommand && document.execCommand('copy'));
      document.body.removeChild(ta);
      return done;
    } catch (e) { return false; }
  }

  /* 브라우저 클립보드가 막혀 있으면(권한·구형) 예전 방식으로 한 번 더 */
  function copyText(text) {
    var s = String(text == null ? '' : text);
    if (!s) return Promise.resolve(false);
    var nav = (typeof navigator !== 'undefined') ? navigator : null;
    if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
      try {
        return Promise.resolve(nav.clipboard.writeText(s)).then(function () { return true; }, function () {
          return legacyCopy(s);
        });
      } catch (e) { return Promise.resolve(legacyCopy(s)); }
    }
    return Promise.resolve(legacyCopy(s));
  }

  function copyAndTell(text) {
    return copyText(text).then(function (done) {
      if (done) { UI.haptic(8); UI.toast('친구 코드를 복사했어요 · ' + text); }
      else UI.toast('복사하지 못했어요. 코드를 길게 눌러 복사해 주세요', 'error');
      return done;
    });
  }

  /* ---------- 조각 ---------- */
  /* 내 코드 — MY 프로필·채팅 목록·친구 추가 시트에서 같은 모양으로 씁니다 */
  function codeChip(state, opts) {
    opts = opts || {};
    var code = myCode(state);
    if (!code) return '';
    var text = myCodeText(state);
    return '<button type="button" class="codechip' + (opts.cls ? ' ' + opts.cls : '') + '"' +
      ' data-code-copy="' + U.esc(text) + '"' +
      ' aria-label="내 친구 코드 #' + U.esc(code) + ', 눌러서 복사">' +
      '<span class="codechip__k">친구 코드</span>' +
      '<b class="codechip__v">#' + U.esc(code) + '</b>' +
      '<span class="codechip__cp">복사</span></button>';
  }

  /* 채팅 목록 위의 안내 줄 — 내 코드 + 친구 추가 입구 */
  function codeBar(state) {
    var code = myCode(state);
    if (!code) return '';
    var text = myCodeText(state);
    return '<section class="codebar" aria-label="내 친구 코드">' +
      '<div class="codebar__l">' +
      '<span class="codebar__k">내 친구 코드</span>' +
      '<b class="codebar__v">' + U.esc((state.me && state.me.nick) || '') + '<i>#' + U.esc(code) + '</i></b>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-code-copy="' + U.esc(text) + '">복사</button>' +
      '</section>';
  }

  /* 한 사람 결과 카드 — 친구 상태에 맞는 버튼만 */
  function matchCard(state, u) {
    var me = meKey(state);
    var p = UI.person(state, u.key);
    var fs = D.friendState(idxOf(state), me, u.key);
    var act;
    if (fs.state === 'friends') {
      act = '<span class="pill pill--friend">' + UI.icon('check') + '친구</span>' +
        (fs.acceptId ? '<button type="button" class="btn btn--primary btn--sm" data-code-chat="' + U.esc(fs.acceptId) + '" data-other="' + U.esc(u.key) + '">채팅하기</button>' : '');
    } else if (fs.state === 'sent') {
      act = '<span class="pp__friendnote">' + UI.icon('clock') + '요청 보냄</span>';
    } else if (fs.state === 'received') {
      act = '<button type="button" class="btn btn--ghost btn--sm" data-code-reject="' + U.esc(fs.requestId) + '">거절</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-code-accept="' + U.esc(fs.requestId) + '">수락</button>';
    } else {
      act = '<button type="button" class="btn btn--primary btn--sm" data-code-send="' + U.esc(u.key) + '">' +
        UI.icon('plus') + '친구 요청</button>';
    }
    return '<article class="coderesult" data-code-match="' + U.esc(u.key) + '">' +
      UI.avatar(p, 44) +
      '<div class="coderesult__mid">' +
      '<div class="coderesult__name">' + U.esc(p.nick || '회원') +
      '<span class="coderesult__code">#' + U.esc(u.code) + '</span>' +
      (p.level ? '<span class="pill pill--grade">' + U.esc(p.level) + '</span>' : '') + '</div>' +
      '<p class="coderesult__meta">' + U.esc([p.region, p.club].filter(Boolean).join(' · ') || '코드가 맞는 회원이에요') + '</p>' +
      '</div>' +
      '<div class="coderesult__act">' + act + '</div></article>';
  }

  /* 찾은 결과 — found 가 없으면 아직 아무것도 찾지 않은 상태 */
  function resultHtml(state, found) {
    if (!found) {
      return '<p class="codehint">' + UI.icon('shield') +
        '친구 코드를 아는 사람에게만 친구 요청을 보낼 수 있어요. 1:1 매칭은 편지지로 요청하세요.</p>';
    }
    if (found.invalid || !found.code) {
      return '<div class="codemsg codemsg--warn">' + UI.icon('alert') +
        '코드는 영문·숫자 4자리예요. 예: <b>A7K2</b></div>';
    }
    var mine = meKey(state);
    var list = found.matches || [];
    var others = list.filter(function (u) { return u.key !== mine; });
    if (!others.length) {
      if (list.length) {
        return '<div class="codemsg">' + UI.icon('alert') +
          '내 코드예요. 친구에게 <b>#' + U.esc(found.code) + '</b>를 알려 주세요.</div>';
      }
      return '<div class="codemsg">' + UI.icon('alert') +
        '<b>#' + U.esc(found.code) + '</b> 코드를 쓰는 회원을 찾지 못했어요. 4자리를 다시 확인해 주세요.</div>';
    }
    return (others.length > 1 ? '<p class="codehint">같은 코드가 ' + others.length + '명이에요. 닉네임을 보고 골라 주세요.</p>' : '') +
      others.map(function (u) { return matchCard(state, u); }).join('');
  }

  function body(state) {
    var code = myCode(state);
    return '<div class="fcode" data-friends>' +
      '<div class="fcode__mine">' +
      '<div class="fcode__l"><span class="fcode__k">내 친구 코드</span>' +
      '<b class="fcode__v">' + U.esc((state.me && state.me.nick) || '') + '<i>#' + U.esc(code) + '</i></b></div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-code-copy="' + U.esc(myCodeText(state)) + '">복사</button>' +
      '</div>' +
      '<form class="fcode__form" data-code-form>' +
      '<label class="flabel">친구 코드' +
      '<input type="text" data-code-input autocomplete="off" spellcheck="false" autocapitalize="characters"' +
      ' inputmode="text" maxlength="16" placeholder="예: A7K2" aria-label="친구 코드"></label>' +
      '<button type="submit" class="btn btn--primary">코드로 찾기</button>' +
      '</form>' +
      '<div class="fcode__result" data-code-result>' + resultHtml(state, null) + '</div>' +
      '</div>';
  }

  /* ---------- 시트 ---------- */
  function renderResult(wrap, state, found) {
    var box = wrap && wrap.querySelector('[data-code-result]');
    if (!box) return;
    wrap.__codeFound = found || null;
    box.innerHTML = resultHtml(state, found);
  }

  function open(ctx) {
    var state = ctx.store.state;
    UI.openSheet({
      title: '친구 추가',
      body: body(state),
      onMount: function (wrap) {
        var input = wrap.querySelector('[data-code-input]');
        wrap.addEventListener('click', function (ev) {
          var copy = ev.target.closest('[data-code-copy]');
          if (copy) {
            ev.preventDefault();
            copyAndTell(copy.getAttribute('data-code-copy'));
            return;
          }
          var send = ev.target.closest('[data-code-send]');
          if (send) {
            ev.preventDefault();
            if (send.dataset.busy === '1') return;
            send.dataset.busy = '1';
            var key = send.getAttribute('data-code-send');
            var r = ctx.actions.sendFriendRequest(key);
            if (r.ok) { UI.haptic(12); UI.toast('친구 요청을 보냈어요. 상대가 수락하면 대화할 수 있어요.'); }
            else if (r.reason === 'sent') UI.toast('이미 요청을 보냈어요');
            else if (r.reason === 'received') UI.toast('상대가 먼저 요청했어요. 수락해 주세요.');
            else if (r.reason === 'already') UI.toast('이미 친구예요');
            else if (r.reason === 'locked') UI.toast('잠시만요');
            else UI.toast('요청을 보내지 못했어요', 'error');
            renderResult(wrap, ctx.store.state, wrap.__codeFound);
            return;
          }
          var accept = ev.target.closest('[data-code-accept]');
          if (accept) {
            ev.preventDefault();
            var a = ctx.actions.respondFriendRequest(accept.getAttribute('data-code-accept'), true);
            if (a.ok) { UI.haptic(12); UI.toast('친구가 됐어요! 이제 대화할 수 있어요'); }
            else UI.toast('처리하지 못했어요', 'error');
            renderResult(wrap, ctx.store.state, wrap.__codeFound);
            return;
          }
          var reject = ev.target.closest('[data-code-reject]');
          if (reject) {
            ev.preventDefault();
            ctx.actions.respondFriendRequest(reject.getAttribute('data-code-reject'), false);
            UI.toast('친구 요청을 거절했어요');
            renderResult(wrap, ctx.store.state, wrap.__codeFound);
            return;
          }
          var chat = ev.target.closest('[data-code-chat]');
          if (chat) {
            ev.preventDefault();
            var roomId = chat.getAttribute('data-code-chat');
            var other = chat.getAttribute('data-other');
            UI.closeSheet();
            ctx.actions.openChat(roomId, other);
            ctx.actions.markChatRead(roomId, other);
            UI.haptic(8);
          }
        });
        wrap.addEventListener('submit', function (ev) {
          var form = ev.target.closest('[data-code-form]');
          if (!form) return;
          ev.preventDefault();
          var typed = input ? input.value : '';
          var found = D.friendCodeFind(idxOf(ctx.store.state), typed);
          renderResult(wrap, ctx.store.state, found);
          UI.haptic(6);
          if (input) { try { input.blur(); } catch (e) { /* 무시 */ } }
        });
      }
    });
  }

  /* 화면 어디서든 [data-code-copy] 한 번으로 복사 — MY·채팅이 같이 씁니다 */
  function bindCopy(rootEl) {
    if (!rootEl || rootEl.dataset.codeCopyBound === '1') return;
    rootEl.dataset.codeCopyBound = '1';
    rootEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-code-copy]');
      if (!btn) return;
      ev.preventDefault();
      copyAndTell(btn.getAttribute('data-code-copy'));
    });
  }

  BM.views.friends = {
    open: open, body: body, resultHtml: resultHtml, matchCard: matchCard,
    codeChip: codeChip, codeBar: codeBar,
    myCode: myCode, myCodeText: myCodeText,
    copyText: copyText, copyAndTell: copyAndTell, bindCopy: bindCopy
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
