/* ============================================================
 * views/chat.js — 상단 오른쪽 1:1 채팅(DM)
 *
 *  · 채팅 목록: 받은 친구 요청(수락/거절) + 대화 목록(친구·매칭 상대)
 *  · 대화방: 상대 프로필 · 말풍선(내 것 오른쪽 / 상대 왼쪽) · 입력창
 *  · 친구이거나 1:1 매칭이 성사된 상대와만 대화할 수 있습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;
  BM.views = BM.views || {};

  function hhmm(ts) {
    var d = ts ? new Date(String(ts).replace(' ', 'T')) : null;
    if (!d || isNaN(d.getTime())) return '';
    var h = d.getHours(), m = d.getMinutes();
    return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
  }

  function findThread(state, roomId) {
    return (state.data.threads || []).filter(function (t) { return String(t.roomId) === String(roomId); })[0] || null;
  }

  function kindPill(kind) {
    if (kind === 'friend') return '<span class="pill pill--friend">친구</span>';
    if (kind === 'match') return '<span class="pill pill--ghost">매칭</span>';
    return '';
  }

  /* ---------- 목록 ---------- */
  function requestCard(r, state) {
    var p = UI.person(state, r.key);
    return '<li class="dmreq" data-request="' + U.esc(r.id) + '">' +
      UI.avatar(p, 44) +
      '<div class="dmreq__mid"><strong>' + U.esc(r.nick || p.nick) + '</strong>' +
      '<p>친구 요청 · ' + U.timeAgo(r.at) + '</p></div>' +
      '<div class="dmreq__act">' +
      '<button class="btn btn--ghost btn--sm" data-req-reject="' + U.esc(r.id) + '">거절</button>' +
      '<button class="btn btn--primary btn--sm" data-req-accept="' + U.esc(r.id) + '">수락</button>' +
      '</div></li>';
  }

  function threadRow(t, state) {
    var p = UI.person(state, t.other);
    var me = (state.me && state.me.key) || '';
    var preview = t.last
      ? (t.last.userKey === me ? '나: ' : '') + t.last.text
      : '대화를 시작해 보세요';
    return '<li class="dmroom" data-thread="' + U.esc(t.roomId) + '" data-other="' + U.esc(t.other) + '">' +
      UI.avatar(p, 48) +
      '<div class="dmroom__mid">' +
      '<div class="dmroom__top"><strong>' + U.esc(p.nick || '회원') + '</strong>' +
      (p.level ? '<span class="pill pill--grade">' + U.esc(p.level) + '</span>' : '') +
      kindPill(t.kind) + '</div>' +
      '<p class="' + (t.unread ? 'is-unread' : '') + '">' + U.esc(U.truncate(preview, 42)) + '</p></div>' +
      '<div class="dmroom__right">' +
      (t.at ? '<time>' + U.timeAgo(t.at) + '</time>' : '') +
      (t.unread ? '<span class="badge">' + (t.unread > 9 ? '9+' : t.unread) + '</span>' : '') +
      '</div></li>';
  }

  function listHtml(state) {
    var reqs = state.data.friendRequests || [];
    var threads = state.data.threads || [];
    return '' +
      '<header class="dmhead">' +
      '<button class="iconbtn" data-dm-close aria-label="채팅 닫기">' + UI.icon('close') + '</button>' +
      '<div class="dmhead__title"><strong>채팅</strong>' +
      '<span>' + (threads.length ? threads.length + '개 대화' : '카톡처럼 1:1 대화') + '</span></div>' +
      '<button class="iconbtn" data-dm-find aria-label="매칭에서 친구 찾기">' + UI.icon('plus') + '</button>' +
      '</header>' +
      '<div class="dm__scroll" data-dm-scroll>' +
      (reqs.length ? '<section class="dmsec">' +
        '<h3 class="dmsec__t">받은 친구 요청 <span class="badge">' + reqs.length + '</span></h3>' +
        '<ul class="dmreqs">' + reqs.map(function (r) { return requestCard(r, state); }).join('') + '</ul>' +
        '</section>' : '') +
      '<section class="dmsec">' +
      '<h3 class="dmsec__t">대화</h3>' +
      (threads.length
        ? '<ul class="dmrooms">' + threads.map(function (t) { return threadRow(t, state); }).join('') + '</ul>'
        : UI.emptyState('community', '아직 대화가 없어요',
          '친구를 추가하거나 1:1 매칭을 수락하면 여기에 대화가 생겨요.',
          '<button class="btn btn--ghost btn--sm mt8" data-dm-find>매칭에서 친구 찾기</button>')) +
      '</section></div>';
  }

  /* ---------- 대화방 ---------- */
  function messageHtml(m, state, otherKey) {
    var me = (state.me && state.me.key) || '';
    var mine = m.userKey === me;
    var p = UI.person(state, mine ? me : otherKey);
    return '<div class="dmsg' + (mine ? ' dmsg--me' : '') + '">' +
      (mine ? '' : '<span class="dmsg__av">' + UI.avatar(p, 28) + '</span>') +
      '<div class="dmsg__col">' +
      '<div class="dbubble">' + U.esc(m.text).replace(/\n/g, '<br>') + '</div>' +
      '<time>' + hhmm(m.createdAt) + '</time>' +
      '</div></div>';
  }

  function roomHtml(state) {
    var roomId = state.ui.chatRoom;
    var room = findThread(state, roomId);
    var other = (room && room.other) || state.ui.chatOther || '';
    var p = UI.person(state, other);
    var messages = (room && room.messages) || [];
    var canChat = other ? D.canChatWith(state.data.idx, state.me && state.me.key, other) : false;
    return '' +
      '<header class="dmhead dmhead--room">' +
      '<button class="iconbtn" data-dm-back aria-label="대화 목록">' + UI.icon('arrow') + '</button>' +
      '<button class="dmhead__who" data-dm-profile="' + U.esc(other) + '">' +
      UI.avatar(p, 34) +
      '<div><strong>' + U.esc(p.nick || '상대') + '</strong>' +
      '<span>' + U.esc([p.level, room && room.kind === 'friend' ? '친구' : (room && room.kind === 'match' ? '매칭' : '')].filter(Boolean).join(' · ') || '1:1 대화') + '</span></div>' +
      '</button>' +
      '</header>' +
      '<div class="dm__scroll dm__scroll--chat" data-dm-scroll>' +
      (messages.length
        ? '<div class="dm__msgs">' + messages.map(function (m) { return messageHtml(m, state, other); }).join('') + '</div>'
        : '<div class="dm__start">' + UI.avatar(p, 64) +
          '<p class="dm__start-t">' + U.esc((p.nick || '상대') + '님과의 대화') + '</p>' +
          '<p class="dm__start-s">' + (canChat ? '첫 메시지를 보내 보세요.' : '친구가 되거나 매칭이 성사되면 대화할 수 있어요.') + '</p></div>') +
      '</div>' +
      (canChat
        ? '<form class="dm__composer" data-dm-form>' +
          '<input type="text" autocomplete="off" enterkeyhint="send" maxlength="300" data-dm-input' +
          ' placeholder="메시지를 입력하세요" aria-label="메시지 입력">' +
          '<button class="btn btn--send" type="submit" aria-label="보내기">' + UI.icon('send') + '</button>' +
          '</form>'
        : '<div class="dm__locked">' + UI.icon('clock') + '친구이거나 매칭이 성사된 상대와 대화할 수 있어요</div>');
  }

  function render(host, state) {
    if (!host) return;
    host.innerHTML = '<div class="dm__panel">' +
      (state.ui.chatRoom ? roomHtml(state) : listHtml(state)) + '</div>';
    var scroll = host.querySelector('[data-dm-scroll]');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  /* 한 번만 이벤트를 답니다 (호스트는 app.js가 계속 씁니다) */
  function bind(host, ctx) {
    if (!host || host.dataset.dmBound === '1') return;
    host.dataset.dmBound = '1';

    host.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-dm-close]')) {
        ev.preventDefault();
        ctx.actions.closeChats();
        return;
      }
      if (ev.target.closest('[data-dm-back]')) {
        ev.preventDefault();
        ctx.actions.closeChat();
        return;
      }
      if (ev.target.closest('[data-dm-find]')) {
        ev.preventDefault();
        ctx.actions.closeChats();
        ctx.actions.setTab('matching');
        return;
      }
      var prof = ev.target.closest('[data-dm-profile]');
      if (prof) {
        ev.preventDefault();
        var key = prof.getAttribute('data-dm-profile');
        if (key && BM.views.profile) BM.views.profile.open(key, ctx);
        return;
      }
      var accept = ev.target.closest('[data-req-accept]');
      if (accept) {
        ev.preventDefault();
        var r = ctx.actions.respondFriendRequest(accept.getAttribute('data-req-accept'), true);
        if (r.ok) { UI.toast('친구가 됐어요! 대화를 시작해 보세요.'); UI.haptic(12); }
        else UI.toast('처리하지 못했어요', 'error');
        return;
      }
      var reject = ev.target.closest('[data-req-reject]');
      if (reject) {
        ev.preventDefault();
        ctx.actions.respondFriendRequest(reject.getAttribute('data-req-reject'), false);
        UI.toast('친구 요청을 거절했어요');
        return;
      }
      var thread = ev.target.closest('[data-thread]');
      if (thread) {
        ev.preventDefault();
        var roomId = thread.getAttribute('data-thread');
        var other = thread.getAttribute('data-other');
        ctx.actions.openChat(roomId, other);
        ctx.actions.markChatRead(roomId, other);
        UI.haptic(8);
        return;
      }
    });

    host.addEventListener('submit', function (ev) {
      var form = ev.target.closest('[data-dm-form]');
      if (!form) return;
      ev.preventDefault();
      var input = form.querySelector('[data-dm-input]');
      var panel = host.querySelector('.dm__panel');
      var roomHeader = host.querySelector('[data-dm-back]');
      if (!input || !roomHeader) return;
      var state = ctx.store.state;
      var room = findThread(state, state.ui.chatRoom);
      var other = (room && room.other) || state.ui.chatOther || '';
      var res = ctx.actions.sendChat(state.ui.chatRoom, other, input.value);
      if (res.ok) {
        input.value = '';
        input.focus();
        UI.haptic(8);
      } else if (res.reason === 'locked') {
        UI.toast('잠시만요, 보내는 중이에요');
      } else if (res.reason === 'not_allowed') {
        UI.toast('친구이거나 매칭된 상대와만 대화할 수 있어요', 'error');
      }
    });
  }

  BM.views.chat = {
    render: render, bind: bind,
    listHtml: listHtml, roomHtml: roomHtml, messageHtml: messageHtml,
    findThread: findThread, hhmm: hhmm
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
