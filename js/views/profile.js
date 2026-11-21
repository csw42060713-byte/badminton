/* ============================================================
 * views/profile.js — 사람 프로필 시트 (친구 상태 · 채팅)
 *
 *  v1.38: 닉네임만 보고 아무나 친추하던 '친구 추가' 버튼은 없앴습니다.
 *  친구는 서로의 친구 코드(#XXXX)를 아는 사람끼리만(채팅 목록 + → 친구 추가).
 *
 * 커뮤니티 글쓴이, 채팅 상대, 매칭 카드 어디서 눌러도 같은 시트가 열리고
 * 친구 상태(없음/보냄/받음/친구)에 맞는 버튼만 보입니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain, UI = BM.ui;
  BM.views = BM.views || {};

  function roomFor(state, key) {
    var me = state.me || {};
    var thread = (state.data.threads || []).filter(function (t) { return t.other === key; })[0];
    if (thread) return thread.roomId;
    var fs = D.friendState(state.data.idx, me.key, key);
    if (fs.state === 'friends' && fs.acceptId) return fs.acceptId;
    var ms = D.matchBetween(state.data.idx, me.key, key);
    if (ms.accepted && ms.requestId) return ms.requestId;
    return '';
  }

  /* 친구 상태에 맞는 버튼 묶음
   *  v1.38: 닉네임·프로필만 보고 아무나 친구 요청을 보내던 '친구 추가' 버튼을 없앴습니다.
   *  친구는 서로의 친구 코드(#XXXX)를 아는 사람끼리만 맺습니다(채팅 목록 + → 친구 추가). */
  function buttons(state, key, opts) {
    opts = opts || {};
    var me = state.me || {};
    if (!key || key === me.key) return '';
    var fs = D.friendState(state.data.idx, me.key, key);
    var canChat = D.canChatWith(state.data.idx, me.key, key);
    var roomId = roomFor(state, key);
    var out = '';

    if (fs.state === 'friends') {
      out += '<span class="pill pill--ok pill--friend">' + UI.icon('check') + '친구</span>' +
        '<button class="btn btn--ghost btn--sm" data-friend-remove="' + U.esc(key) + '">친구 끊기</button>';
    } else if (fs.state === 'received') {
      out += '<span class="pp__friendnote">' + UI.icon('community') + '친구 요청을 보냈어요</span>' +
        '<button class="btn btn--ghost btn--sm" data-friend-reject="' + U.esc(fs.requestId) + '">거절</button>' +
        '<button class="btn btn--primary btn--sm" data-friend-accept="' + U.esc(fs.requestId) + '">수락</button>';
    } else if (fs.state === 'sent') {
      out += '<button class="btn btn--ghost btn--sm" disabled>' + UI.icon('clock') + '요청 보냄</button>';
    } else {
      out += '<span class="pp__friendhint">' + UI.icon('shield') +
        '친구는 서로의 친구 코드(#4자리)를 알아야 추가할 수 있어요</span>';
    }

    if (canChat && roomId) {
      out += '<button class="btn btn--primary btn--sm" data-friend-chat="' + U.esc(roomId) + '" data-other="' + U.esc(key) + '">' +
        UI.icon('community') + '채팅하기</button>';
    } else if (!canChat && !opts.noHint) {
      out += '<span class="pp__friendhint">친구가 되면 1:1 대화를 할 수 있어요</span>';
    }
    return out;
  }

  /* 시트 안의 친구/채팅 버튼 동작 (여러 화면에서 같이 씁니다) */
  function bind(wrap, ctx) {
    if (!wrap || wrap.dataset.friendBound === '1') return;
    wrap.dataset.friendBound = '1';
    wrap.addEventListener('click', function (ev) {
      var add = ev.target.closest('[data-friend-add]');
      if (add) {
        /* v1.38: 예전 화면(캐시)이 남아 있어도 프로필에서 바로 친구가 되지 않습니다 */
        ev.preventDefault();
        UI.toast('친구는 친구 코드(#4자리)로 추가할 수 있어요. 채팅 목록의 + 를 눌러 주세요.');
        return;
      }
      var accept = ev.target.closest('[data-friend-accept]');
      if (accept) {
        ev.preventDefault();
        var a = ctx.actions.respondFriendRequest(accept.getAttribute('data-friend-accept'), true);
        if (a.ok) { UI.toast('친구가 됐어요! 이제 대화할 수 있어요'); UI.haptic(12); }
        else UI.toast('처리하지 못했어요', 'error');
        return;
      }
      var reject = ev.target.closest('[data-friend-reject]');
      if (reject) {
        ev.preventDefault();
        ctx.actions.respondFriendRequest(reject.getAttribute('data-friend-reject'), false);
        UI.toast('친구 요청을 거절했어요');
        return;
      }
      var remove = ev.target.closest('[data-friend-remove]');
      if (remove) {
        ev.preventDefault();
        var key = remove.getAttribute('data-friend-remove');
        UI.confirm('친구를 끊을까요? 대화 내용은 그대로 남아요.').then(function (ok) {
          if (!ok) return;
          var d = ctx.actions.removeFriend(key);
          if (d.ok) { UI.toast('친구를 끊었어요'); UI.haptic(8); }
        });
        return;
      }
      var chat = ev.target.closest('[data-friend-chat]');
      if (chat) {
        ev.preventDefault();
        var roomId = chat.getAttribute('data-friend-chat');
        var other = chat.getAttribute('data-other');
        UI.closeSheet();
        ctx.actions.openChat(roomId, other);
        ctx.actions.markChatRead(roomId, other);
        UI.haptic(8);
        return;
      }
    });
  }

  function infoRow(label, value) {
    return '<dt>' + U.esc(label) + '</dt><dd>' + U.esc(value || '—') + '</dd>';
  }

  /* 받은 매너 한 줄 태그 (bm-v1.29.0) — 집계는 domain.mannerReceived(순수 함수).
   * 상대가 경기 후 남긴 태그를 최대 3개까지 건수와 함께 조용한 배지로 보여 주고,
   * 아직 없으면 한 줄만 남겨 시트가 길어지지 않게 합니다. */
  function mannerBlock(state, userKey) {
    var sum = D.mannerReceived(state.data.idx, userKey, D.MANNER_MAX_BADGES);
    if (!sum.total) {
      return '<p class="pp__manner-empty">' + UI.icon('heart') + '아직 받은 매너 태그가 없어요</p>';
    }
    var tags = sum.tags.map(function (t) {
      return '<span class="mannerbadge">' + U.esc(t.label) + '<b>' + t.count + '</b></span>';
    }).join('');
    return '<div class="pp__manner">' +
      '<p class="pp__label">받은 매너 ' + sum.total + '</p>' +
      '<div class="mannerbadges">' + tags + '</div></div>';
  }

  /* 사람 프로필 시트 열기 */
  function open(userKey, ctx) {
    var state = ctx.store.state;
    var p = UI.person(state, userKey);
    var mp = D.matchProfileOf(state.data.idx, userKey);
    var me = state.me || {};
    var mine = userKey === me.key;
    /* v1.45 — 승인된 코치·멘토면 유형 배지와 'OO · 활동 증명됨' 을 함께 보여 줍니다 */
    var mentor = D.approvedMentorOf(state.data.idx, userKey);
    var body = '<div class="pp" data-profile="' + U.esc(userKey) + '">' +
      '<div class="pp__head">' + UI.avatar(p, 74) +
      '<div class="pp__id"><div class="pp__name">' + U.esc(p.nick) + '</div>' +
      '<div class="pp__pills">' +
      (mentor ? '<span class="pill pill--grade">' + U.esc(mentor.type) + '</span>' : '') +
      (p.level ? '<span class="pill pill--grade">' + U.esc(p.level) + '</span>' : '') +
      ((mp && mp.gender && mp.gender !== '비공개') ? '<span class="pill pill--gender">' + U.esc(mp.gender) + '</span>' : '') +
      (p.discipline ? '<span class="pill pill--ghost">' + U.esc(p.discipline) + '</span>' : '') +
      ((mp && D.normalizeStyle(mp.style)) ? '<span class="pill pill--style">' + U.esc(D.normalizeStyle(mp.style)) + '</span>' : '') +
      '</div>' +
      '<p class="pp__meta">' + U.esc([mp && mp.region, mp && mp.club].filter(Boolean).join(' · ') || '지역 미입력') + '</p>' +
      (mentor && mentor.line ? '<p class="profile__coachline">' + UI.icon('shield') + U.esc(mentor.line) + '</p>' : '') +
      '</div></div>' +
      (p.bio ? '<p class="pp__bio">' + U.esc(p.bio) + '</p>' : '') +
      mannerBlock(state, userKey) +
      '<dl class="kv kv--tight">' +
      infoRow('성별', (mp && mp.gender) || '비공개') +
      infoRow('플레이 스타일', mp && mp.style) +
      infoRow('가능 시간', mp && mp.availability) +
      infoRow('경력', mp && mp.experience) +
      infoRow('지역', mp && mp.region) +
      infoRow('클럽', mp && mp.club) +
      '</dl>' +
      (mine ? '<p class="pp__friendhint">내 프로필이에요. 친구·채팅 버튼은 다른 사람 프로필에서 보여요.</p>'
        : '<div class="pp__social">' + buttons(state, userKey) + '</div>') +
      '</div>';
    UI.openSheet({
      title: '프로필',
      body: body,
      onMount: function (wrap) { bind(wrap, ctx); }
    });
  }

  BM.views.profile = { open: open, buttons: buttons, bind: bind, roomFor: roomFor, mannerBlock: mannerBlock };
})(typeof globalThis !== 'undefined' ? globalThis : this);
