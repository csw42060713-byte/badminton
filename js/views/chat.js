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
    return D.chatTime(ts);
  }

  function findThread(state, roomId) {
    return (state.data.threads || []).filter(function (t) { return String(t.roomId) === String(roomId); })[0] || null;
  }

  /* 대화 목록에 있으면 그대로, 아직 목록에 없으면(막 들어온 방) 글에서 바로 그립니다 */
  function groupThreadOf(state, roomId) {
    var hit = (state.data.threads || []).filter(function (t) {
      return t.kind === 'group' && String(t.roomId) === String(roomId);
    })[0];
    if (hit) return hit;
    if (!roomId) return null;
    return D.groupThreadById(state.data.idx, (state.me && state.me.key) || '', roomId);
  }

  function postOf(state, postId) {
    return (state.data.posts || []).filter(function (p) { return String(p.id) === String(postId); })[0] || null;
  }

  /* 단체방 안에서 열어 둔 확인 바(나가기·모집 종료) — 화면을 다시 그려도 남게 여기에 둡니다 */
  var roomConfirm = { roomId: '', kind: '' };
  /* 대화 목록에서 여는 삭제 확인 (bm-v1.48.0) — 창(confirm) 대신 목록 안에서 한 번 더 묻습니다 */
  var listConfirm = { roomId: '' };
  /* 이번에 단체방으로 그려 본 방 — 방장이 지운 방을 알아보는 데 씁니다 */
  var seenGroup = {};

  /* 급수는 이름 옆 배지로, 이 줄에는 플레이 스타일만 (같은 말이 두 번 보이지 않게) */
  function metaLine(it, p) {
    return String(it.style || p.style || '').trim();
  }

  /* 받은 게스트 신청 — 글쓴이에게 오는 편지지(kind: 'guest')
   * 닉네임·급수·플레이스타일·한마디와 함께 그 자리에서 수락/거절합니다. */
  function guestLetter(g, state) {
    var p = UI.person(state, g.userKey);
    var post = g.post || null;
    var line = post ? D.groupNote(post) : '';
    var meta = metaLine(g, p);
    return '<article class="letter letter--compact letter--guest" data-guest-letter="' + U.esc(g.id) + '"' +
      ' data-from="' + U.esc(g.userKey) + '">' +
      '<div class="letter__top">' +
      '<span class="letter__av">' + UI.avatar(p, 44) + '</span>' +
      '<div class="letter__who"><div class="letter__name">' + U.esc(g.nick || p.nick || '회원') +
      (g.level || p.level ? '<span class="pill pill--grade">' + U.esc(g.level || p.level) + '</span>' : '') +
      '</div><p class="letter__meta">' + U.esc(meta || '플레이 스타일 미입력') + '</p></div>' +
      '<span class="letter__stamp letter__stamp--guest">게스트 신청</span></div>' +
      (g.note
        ? '<p class="letter__note">' + U.esc(g.note) + '</p>'
        : '<p class="letter__note letter__note--empty">한마디 없이 신청했어요.</p>') +
      '<p class="letter__post">' + UI.icon('bolt') + U.esc(U.truncate(line || '게스트 모집 글', 46)) + '</p>' +
      '<div class="letter__acts">' +
      '<button type="button" class="btn btn--ghost btn--sm" data-guest-reject="' + U.esc(g.id) + '">거절</button>' +
      '<button type="button" class="btn btn--primary btn--sm" data-guest-accept="' + U.esc(g.id) + '">수락</button>' +
      '</div></article>';
  }

  function guestLetters(state) {
    var list = D.guestInbox(state.data.idx, (state.me && state.me.key) || '');
    if (!list.length) return '';
    return '<section class="dmsec">' +
      '<h3 class="dmsec__t">' + U.esc(D.GUEST.inboxTitle) + ' <span class="badge">' + list.length + '</span></h3>' +
      '<div class="dmletters">' + list.map(function (g) { return guestLetter(g, state); }).join('') + '</div></section>';
  }

  function kindPill(kind) {
    if (kind === 'friend') return '<span class="pill pill--friend">친구</span>';
    if (kind === 'match') return '<span class="pill pill--ghost">매칭</span>';
    if (kind === 'coach') return '<span class="pill pill--ok">코치</span>';
    if (kind === 'group') return '<span class="pill pill--ok dmroom__group">단체</span>';
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
    var me = (state.me && state.me.key) || '';
    var isGroup = t.kind === 'group';
    var p = isGroup ? null : UI.person(state, t.other);
    var pres = isGroup ? null : D.presenceOf(state.data.idx, t.other);
    var gpost = isGroup ? postOf(state, t.postId || t.roomId) : null;
    /* 내가 만든 단체방(모집 글 글쓴이)만 목록에서 바로 지울 수 있습니다 (bm-v1.48.0) */
    var mineGroup = !!(isGroup && gpost && String(gpost.userKey || '') === String(me));
    var confirming = mineGroup && String(listConfirm.roomId) === String(t.roomId);
    var preview = t.last
      ? (t.last.userKey === me ? '나: ' : (isGroup ? (t.last.nick || '') + ': ' : '')) + t.last.text
      : '대화를 시작해 보세요';
    return '<li class="dmroom' + (isGroup ? ' dmroom--group' : '') + '" data-thread="' + U.esc(t.roomId) + '" data-other="' + U.esc(t.other) + '">' +
      (isGroup
        ? '<span class="dmgroupav" aria-hidden="true">' + UI.icon('users') + '</span>'
        : UI.avatar(p, 48)) +
      '<div class="dmroom__mid">' +
      '<div class="dmroom__top"><strong>' + U.esc(isGroup ? (t.title || D.MEET.roomLabel) : (p.nick || '회원')) + '</strong>' +
      (isGroup ? '<span class="dmroom__n">' + (t.memberCount || 0) + '명</span>' : '') +
      (!isGroup && p.level ? '<span class="pill pill--grade">' + U.esc(p.level) + '</span>' : '') +
      kindPill(t.kind) + '</div>' +
      '<p class="' + (t.unread ? 'is-unread' : '') + '">' + U.esc(U.truncate(preview, 42)) + '</p>' +
      (pres ? UI.presence(pres, { cls: 'presence--row' }) : '') +
      (confirming
        ? '<div class="dmroom__delbar" data-roomdel-bar>' +
          '<p class="dmroom__delbar-t">단체방을 삭제할까요? <b>모집 글도 함께</b> 내려가고 되돌릴 수 없어요.</p>' +
          '<div class="row gap8">' +
          '<button type="button" class="btn btn--ghost btn--sm grow" data-roomdel-no>' + U.esc(D.MEET.deleteNoLabel) + '</button>' +
          '<button type="button" class="btn btn--danger btn--sm grow" data-roomdel-yes="' + U.esc(t.roomId) + '">' +
          UI.icon('trash') + U.esc(D.MEET.deleteLabel) + '</button>' +
          '</div></div>'
        : '') +
      '</div>' +
      '<div class="dmroom__right">' +
      (t.at ? '<time>' + U.esc(D.chatListTime(t.at)) + '</time>' : '') +
      (t.unread ? '<span class="badge">' + (t.unread > 9 ? '9+' : t.unread) + '</span>' : '') +
      (mineGroup && !confirming
        ? '<button type="button" class="dmroom__del" data-room-del="' + U.esc(t.roomId) + '"' +
          ' aria-label="' + U.esc(D.MEET.deleteLabel) + '" title="' + U.esc(D.MEET.deleteLabel) + '">' + UI.icon('trash') + '</button>'
        : '') +
      '</div></li>';
  }

  /* 받은 1:1 매칭 요청 — 편지지 카드(매칭 화면과 같은 모양)로 알려 줍니다.
   * 편지지 형식을 꺼 둔 사람에게는 군더더기 없는 일반 요청 카드로 보입니다(v1.20). */
  function matchLetters(state) {
    var me = (state.me && state.me.key) || '';
    var list = U.sortBy((state.data.requests || []).filter(function (r) {
      return r.target === me && r.status === '대기';
    }), function (r) { return r.createdAt || ''; }, true);
    if (!list.length) return '';
    var letter = !(state.prefs && state.prefs.letter === false);
    var V = (BM.views.matching && BM.views.matching.letterHtml) ? BM.views.matching : null;
    var html = list.map(function (r) {
      if (!letter) return simpleRequest(r, state);
      return V ? V.letterHtml(state, r, { compact: true }) : simpleRequest(r, state);
    }).join('');
    return '<section class="dmsec">' +
      '<h3 class="dmsec__t">받은 매칭 요청 <span class="badge">' + list.length + '</span></h3>' +
      (letter ? '<div class="dmletters">' + html + '</div>' : '<ul class="dmreqs">' + html + '</ul>') + '</section>';
  }

  /* 편지지 형식이 꺼져 있을 때의 일반 요청 카드 */
  function simpleRequest(r, state) {
    var p = UI.person(state, r.userKey);
    var note = (r.payload && r.payload.note) || '';
    return '<li class="dmreq dmreq--simple" data-from="' + U.esc(r.userKey) + '" data-open-profile="' + U.esc(r.userKey) + '">' +
      UI.avatar(p, 44) +
      '<div class="dmreq__mid"><strong>' + U.esc(p.nick || '회원') + '</strong>' +
      '<p>' + U.esc(U.truncate(note || '1:1 매칭 요청', 34)) + ' · ' + U.esc(U.timeAgo(r.createdAt) || '방금') + '</p></div>' +
      '<div class="dmreq__act">' +
      '<button class="btn btn--ghost btn--sm" data-decline="' + U.esc(r.id) + '">거절</button>' +
      '<button class="btn btn--primary btn--sm" data-accept="' + U.esc(r.id) + '">수락</button>' +
      '</div></li>';
  }

  function listHtml(state) {
    var reqs = state.data.friendRequests || [];
    var threads = state.data.threads || [];
    var notifyOn = !(state.prefs && state.prefs.notify === false);
    return '' +
      '<header class="dmhead">' +
      '<button class="iconbtn" data-dm-close aria-label="채팅 닫기">' + UI.icon('close') + '</button>' +
      '<div class="dmhead__title"><strong>채팅</strong>' +
      '<span>' + (threads.length ? threads.length + '개 대화' : '카톡처럼 1:1 대화') + '</span></div>' +
      '<button class="iconbtn dmhead__bell' + (notifyOn ? ' is-on' : ' is-off') + '" data-dm-notify' +
      ' aria-pressed="' + (notifyOn ? 'true' : 'false') + '" aria-label="새 메시지 알림 ' + (notifyOn ? '끄기' : '켜기') + '"' +
      ' title="새 메시지 알림 ' + (notifyOn ? '켜짐' : '꺼짐') + '">' + UI.icon('bell') + '</button>' +
      '<button class="iconbtn" data-dm-add aria-label="친구 코드로 친구 추가">' + UI.icon('plus') + '</button>' +
      '</header>' +
      '<div class="dm__scroll" data-dm-scroll>' +
      (BM.views.friends ? BM.views.friends.codeBar(state) : '') +
      guestLetters(state) +
      matchLetters(state) +
      (reqs.length ? '<section class="dmsec">' +
        '<h3 class="dmsec__t">받은 친구 요청 <span class="badge">' + reqs.length + '</span></h3>' +
        '<ul class="dmreqs">' + reqs.map(function (r) { return requestCard(r, state); }).join('') + '</ul>' +
        '</section>' : '') +
      '<section class="dmsec">' +
      '<h3 class="dmsec__t">대화</h3>' +
      (threads.length
        ? '<ul class="dmrooms">' + threads.map(function (t) { return threadRow(t, state); }).join('') + '</ul>'
        : UI.emptyState('community', '아직 대화가 없어요',
          '친구 코드를 아는 사람과 친구가 되면 여기에 대화가 생겨요.',
          '<button class="btn btn--ghost btn--sm mt8" data-dm-add>친구 코드로 추가</button>')) +
      '</section></div>';
  }

  /* ---------- 대화방 ---------- */
  /* run: 바로 앞 말풍선과 같은 사람이 이어서 보낸 경우 (아바타·닉네임을 한 번만) */
  function messageHtml(m, state, otherKey, group, run) {
    var me = (state.me && state.me.key) || '';
    var mine = m.userKey === me;
    var p = UI.person(state, mine ? me : (group ? m.userKey : otherKey));
    return '<div class="dmsg' + (mine ? ' dmsg--me' : '') + (run ? ' is-run' : '') + '">' +
      (mine ? '' : '<span class="dmsg__av">' + UI.avatar(p, 28) + '</span>') +
      '<div class="dmsg__col">' +
      (group && !mine && !run ? '<span class="dmsg__nick">' + U.esc(m.nick || p.nick || '회원') + '</span>' : '') +
      '<div class="dbubble">' + D.linkify(m.text) + '</div>' +
      '<time>' + U.esc(D.chatStamp(m.createdAt)) + '</time>' +
      '</div></div>';
  }

  /* 말풍선 목록 — 날짜가 바뀌는 곳에 날짜 구분선을 둡니다.
   * (같은 날은 '오후 2:20', 다른 날은 '11/18 14:20'으로 시각 자체에도 날짜가 붙어
   *  구분선을 못 보는 곳에서도 언제 보낸 글인지 알 수 있습니다) */
  function messagesHtml(messages, state, otherKey, group) {
    var html = '', lastDay = '', lastFrom = '';
    (messages || []).forEach(function (m) {
      var day = D.chatDayKey(m.createdAt);
      if (day && day !== lastDay) {
        html += '<div class="dmsgday"><span>' + U.esc(D.chatDayLabel(m.createdAt)) + '</span></div>';
        lastDay = day;
        lastFrom = '';       /* 날짜가 바뀌면 아바타를 다시 보여 줍니다 */
      }
      var fromKey = String(m.userKey || '');
      var run = !!fromKey && fromKey === lastFrom;
      html += messageHtml(m, state, otherKey, group, run);
      lastFrom = fromKey;
    });
    return html;
  }

  /* 모집 글 단체방 — 글 정보·참여자·대화가 함께 보입니다.
   * bm-v1.43.0 — 헤더에 `나가기`(게스트) / `모집 종료`(글쓴이)를 두고,
   * 헤더 아래 한 줄에 모집 현황(참여 n/cap · 마감 · 받은 신청)과 명단 보기를 둡니다.
   * bm-v1.48.0 — 글쓴이의 `모집 종료`는 `방 삭제`로 바뀌었습니다(방을 통째로 해산). */
  function groupRoomHtml(state) {
    var roomId = state.ui.chatRoom;
    var room = groupThreadOf(state, roomId);
    var postId = (room && room.postId) || roomId;
    var post = postOf(state, postId);
    var title = (room && room.title) || (post ? D.groupTitle(post) : D.MEET.roomLabel);
    var note = (room && room.note) || (post ? D.groupNote(post) : '');
    var messages = (room && room.messages) || [];
    var members = (room && room.members) || [];
    var me = (state.me && state.me.key) || '';
    var st = post ? D.meetStatus(state.data.idx, post, me) : null;
    var mine = !!(st && st.mine);
    var inRoom = post ? D.guestMember(state.data.idx, post, me) : false;
    var canChat = !!me && inRoom;
    var confirming = !!st && String(roomConfirm.roomId) === String(postId) && !!roomConfirm.kind;
    var avatars = members.slice(0, 3).map(function (m) {
      return '<span class="dmhead__av">' + UI.avatar(UI.person(state, m.key), 24) + '</span>';
    }).join('');
    /* 헤더 오른쪽: 게스트는 '나가기', 글쓴이는 '모집 종료'(글 삭제) */
    var headAct = '';
    if (st && inRoom && !mine) {
      headAct = '<button type="button" class="dmhead__out" data-vite-leave="' + U.esc(postId) + '">' + U.esc(D.GUEST.leaveLabel) + '</button>';
    } else if (mine) {
      headAct = '<button type="button" class="dmhead__out dmhead__out--del" data-vite-end="' + U.esc(postId) + '">' +
        UI.icon('trash') + U.esc(D.MEET.deleteLabel) + '</button>';
    }
    /* 헤더 아래 모집 현황 줄 */
    var bar = '';
    if (st) {
      var capTxt = st.cap ? '참여 ' + st.count + '/' + st.cap + '명' : '참여 ' + st.count + '명';
      bar = '<div class="dm__meetbar"' + (st.closed ? ' data-closed="1"' : '') + '>' +
        UI.icon('users') + '<span>' + U.esc(capTxt) + '</span>' +
        (st.closed ? '<b class="dm__meetbar-b">' + U.esc(D.MEET.closedLabel) + '</b>' : '') +
        (mine && st.pending.length ? '<b class="dm__meetbar-n">신청 ' + st.pending.length + '건</b>' : '') +
        (post ? '<button type="button" class="linkbtn dm__meetbar-m" data-vite-members="' + U.esc(postId) + '">명단</button>' : '') +
        '</div>';
    }
    var confirmBar = '';
    if (confirming && roomConfirm.kind === 'leave') {
      confirmBar = '<div class="dm__leavebar" data-leavebar>' +
        '<p class="dm__leavebar-t">이 단체방에서 나갈까요? 나가면 자리가 나서 글이 다시 올라오고, 다시 들어오려면 글쓴이의 수락이 필요해요.</p>' +
        '<div class="row gap8">' +
        '<button type="button" class="btn btn--ghost btn--sm grow" data-act="leave-no">취소</button>' +
        '<button type="button" class="btn btn--danger btn--sm grow" data-act="leave-yes" data-leave-post="' + U.esc(postId) + '" data-leave-kind="leave">' + D.GUEST.leaveLabel + '</button>' +
        '</div></div>';
    } else if (confirming && roomConfirm.kind === 'end') {
      confirmBar = '<div class="dm__leavebar" data-leavebar>' +
        '<p class="dm__leavebar-t">단체방을 삭제할까요? <b>이 방과 모집 글이 함께</b> 사라지고, 참여자 화면의 대화 목록에서도 빠져요. 되돌릴 수 없어요.</p>' +
        '<div class="row gap8">' +
        '<button type="button" class="btn btn--ghost btn--sm grow" data-act="leave-no">' + U.esc(D.MEET.deleteNoLabel) + '</button>' +
        '<button type="button" class="btn btn--danger btn--sm grow" data-act="leave-yes" data-leave-post="' + U.esc(postId) + '" data-leave-kind="end">' + UI.icon('trash') + U.esc(D.MEET.deleteLabel) + '</button>' +
        '</div></div>';
    }
    return '' +
      '<header class="dmhead dmhead--room">' +
      '<button class="iconbtn" data-dm-back aria-label="대화 목록">' + UI.icon('arrow') + '</button>' +
      '<div class="dmhead__who dmhead__who--group">' +
      '<span class="dmgroupav dmgroupav--sm" aria-hidden="true">' + UI.icon('users') + '</span>' +
      '<div><strong>' + U.esc(title) + '</strong>' +
      '<span>단체방 · ' + (members.length ? members.length + '명 참여' : '아직 대화가 없어요') + '</span></div>' +
      (avatars ? '<span class="dmhead__avs">' + avatars + '</span>' : '') +
      '</div>' + headAct + '</header>' +
      bar + confirmBar +
      '<div class="dm__scroll dm__scroll--chat" data-dm-scroll>' +
      (messages.length
        ? '<div class="dm__groupnote">' + UI.icon('bolt') + U.esc(note || title) + '</div>' +
          '<div class="dm__msgs">' + messagesHtml(messages, state, '', true) + '</div>'
        : '<div class="dm__start"><span class="dmgroupav dmgroupav--big" aria-hidden="true">' + UI.icon('users') + '</span>' +
          '<p class="dm__start-t">' + U.esc(title) + '</p>' +
          '<p class="dm__start-s">' + (note ? U.esc(note) + '<br>' : '') +
          (mine ? '수락한 게스트와 여기서 이야기해요.' : '첫 인사를 남겨 보세요.') + '</p></div>') +
      '</div>' +
      (canChat
        ? '<form class="dm__composer" data-dm-form>' +
          '<input type="text" autocomplete="off" enterkeyhint="send" maxlength="300" data-dm-input' +
          ' value="' + U.esc(state.ui.chatDraft || '') + '"' +
          ' placeholder="참여 인사를 남겨 보세요" aria-label="메시지 입력">' +
          '<button class="btn btn--send" type="submit" aria-label="보내기">' + UI.icon('send') + '</button>' +
          '</form>'
        : '<div class="dm__locked">' + UI.icon('clock') + '로그인하고, 글쓴이가 수락하면 단체방에서 대화할 수 있어요</div>');
  }

  /* ---------- 매너 한 줄 태그 (bm-v1.29.0) ----------
   * 매칭이 성사된 1:1 방 상단에서 경기 후 한 번 남깁니다. 정해진 4종만 보여 주고
   * (자유 입력 없음), 오늘 이미 남겼으면 조용한 한 줄로 바뀝니다.
   * 코치 방은 수업 피드백 자리라 태그를 두지 않습니다. */
  function mannerHtml(state, other, canChat, kind) {
    var me = (state.me && state.me.key) || '';
    if (!me || !other || !canChat || kind === 'coach') return '';
    var sent = D.mannerToday(state.data.idx, me, other);
    if (sent) {
      return '<div class="manner manner--done" data-manner>' + UI.icon('check') +
        '<span>오늘 <b>' + U.esc(UI.person(state, other).nick || '상대') + '</b>님에게 남긴 매너 · <b>' +
        U.esc(sent.label || '한 줄') + '</b></span></div>';
    }
    return '<div class="manner" data-manner>' +
      '<p class="manner__t">' + UI.icon('heart') + '같이 친 경기 어땠어요? <small>한 개만 골라 주세요</small></p>' +
      '<div class="manner__chips">' + D.MANNER_TAGS.map(function (t) {
        return '<button type="button" class="manner__chip" data-manner-tag="' + U.esc(t.code) + '">' +
          U.esc(t.label) + '</button>';
      }).join('') + '</div></div>';
  }

  function roomHtml(state) {
    var roomId = state.ui.chatRoom;
    if (roomId && D.isGroupRoom(state.data.idx, roomId)) {
      seenGroup[String(roomId)] = 1;
      return groupRoomHtml(state);
    }
    /* 단체방으로 보고 있던 방이 사라졌으면(방장이 방 삭제) 안내하고 목록으로 보냅니다 */
    if (roomId && seenGroup[String(roomId)]) return deletedRoomHtml();
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
      '<span>' + U.esc([p.level, room && room.kind === 'friend' ? '친구' : (room && room.kind === 'match' ? '매칭' : (room && room.kind === 'coach' ? '코치' : ''))].filter(Boolean).join(' · ') || '1:1 대화') + '</span>' +
      UI.presence(D.presenceOf(state.data.idx, other), { cls: 'presence--head' }) +
      '</div></button>' +
      /* v1.55 — 1:1 대화방에서도 상대를 신고·차단 (구글 Play UGC 심사 요건) */
      (other
        ? '<button class="iconbtn dmhead__more" data-dm-safety="' + U.esc(other) + '" aria-label="신고·차단" title="신고·차단">' + UI.icon('more') + '</button>'
        : '') +
      '</header>' +
      mannerHtml(state, other, canChat, room && room.kind) +
      '<div class="dm__scroll dm__scroll--chat" data-dm-scroll>' +
      (messages.length
        ? '<div class="dm__msgs">' + messagesHtml(messages, state, other) + '</div>'
        : '<div class="dm__start">' + UI.avatar(p, 64) +
          '<p class="dm__start-t">' + U.esc((p.nick || '상대') + '님과의 대화') + '</p>' +
          '<p class="dm__start-s">' + (canChat ? '첫 메시지를 보내 보세요.' : '친구가 되거나 매칭이 성사되면 대화할 수 있어요.') + '</p></div>') +
      '</div>' +
      (canChat
        ? '<form class="dm__composer" data-dm-form>' +
          '<input type="text" autocomplete="off" enterkeyhint="send" maxlength="300" data-dm-input' +
          ' value="' + U.esc(state.ui.chatDraft || '') + '"' +
          ' placeholder="메시지를 입력하세요" aria-label="메시지 입력">' +
          '<button class="btn btn--send" type="submit" aria-label="보내기">' + UI.icon('send') + '</button>' +
          '</form>'
        : '<div class="dm__locked">' + UI.icon('clock') + '친구이거나 매칭이 성사된 상대와 대화할 수 있어요</div>');
  }

  /* 방장이 지운 방 — 참여자가 열어 둔 화면이 남아 있으면 삭제 안내로 바꿉니다 (bm-v1.48.0) */
  function deletedRoomHtml() {
    return '<header class="dmhead dmhead--room">' +
      '<button class="iconbtn" data-dm-back aria-label="대화 목록">' + UI.icon('arrow') + '</button>' +
      '<div class="dmhead__who"><div><strong>삭제된 단체방</strong>' +
      '<span>방장이 방을 삭제했어요</span></div></div></header>' +
      '<div class="dm__scroll dm__scroll--chat">' +
      '<div class="dm__start">' +
      '<span class="dmgroupav dmgroupav--big" aria-hidden="true">' + UI.icon('trash') + '</span>' +
      '<p class="dm__start-t">방장이 단체방을 삭제했어요</p>' +
      '<p class="dm__start-s">모집 글도 함께 내려가서 대화가 정리됐어요.</p>' +
      '<button type="button" class="btn btn--primary btn--sm mt8" data-dm-back>대화 목록으로</button>' +
      '</div></div>';
  }

  function render(host, state) {
    if (!host) return;
    var html = '<div class="dm__panel">' +
      (state.ui.chatRoom ? roomHtml(state) : listHtml(state)) + '</div>';
    /* 내용이 같으면 다시 그리지 않습니다 — 폴링으로 화면이 갱신될 때
     * 보고 있던 위치와 입력 중인 글이 그대로 남습니다. */
    if (host.__dmHtml === html) return;
    host.__dmHtml = html;
    host.innerHTML = html;
    var scroll = host.querySelector('[data-dm-scroll]');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }

  /* 한 번만 이벤트를 답니다 (호스트는 app.js가 계속 씁니다)
   * 다만 로그아웃 → 다시 로그인하면 store·ctx가 새로 만들어지므로,
   * 이벤트 리스너는 그대로 두고 '지금 ctx'만 바꿔 끼웁니다.
   * (예전에는 첫 ctx를 붙잡고 있어서, 다시 로그인하면 채팅을 눌렀을 때
   *  이전 계정의 store가 움직여 엉뚱한 탭으로 튀었습니다.) */
  function bind(host, ctx) {
    if (!host) return;
    host.__dmCtx = ctx;
    if (host.dataset.dmBound === '1') return;
    host.dataset.dmBound = '1';

    host.addEventListener('click', function (ev) {
      ctx = host.__dmCtx || ctx;
      /* 새 메시지 알림 켜기/끄기 (채팅 목록 상단 종) */
      if (ev.target.closest('[data-dm-notify]')) {
        ev.preventDefault();
        var notifyOn = !(ctx.store.state.prefs && ctx.store.state.prefs.notify !== false);
        ctx.actions.setPref('notify', notifyOn);
        UI.haptic(8);
        UI.toast(notifyOn ? '새 메시지 알림을 켰어요' : '새 메시지 알림을 껐어요');
        if (notifyOn && typeof Notification !== 'undefined' && Notification.permission === 'default') {
          try { Notification.requestPermission(); } catch (e) { /* 무시 */ }
        }
        return;
      }
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
      if (ev.target.closest('[data-dm-add]')) {
        ev.preventDefault();
        /* v1.38: 친구는 서로의 친구 코드(#XXXX)를 아는 사람끼리만 */
        if (BM.views.friends) BM.views.friends.open(ctx);
        return;
      }
      var codeCopy = ev.target.closest('[data-code-copy]');
      if (codeCopy) {
        ev.preventDefault();
        if (BM.views.friends) BM.views.friends.copyAndTell(codeCopy.getAttribute('data-code-copy'));
        return;
      }
      var prof = ev.target.closest('[data-dm-profile]');
      if (prof) {
        ev.preventDefault();
        var key = prof.getAttribute('data-dm-profile');
        if (key && BM.views.profile) BM.views.profile.open(key, ctx);
        return;
      }
      /* 매너 한 줄 태그 — 한 번 누르면 그 자리에서 남기고 화면이 바뀝니다 */
      var mtag = ev.target.closest('[data-manner-tag]');
      if (mtag) {
        ev.preventDefault();
        var mstate = ctx.store.state;
        var mroom = findThread(mstate, mstate.ui.chatRoom);
        var mto = (mroom && mroom.other) || mstate.ui.chatOther || '';
        var mgive = ctx.actions.giveManner(mto, mtag.getAttribute('data-manner-tag'));
        if (mgive.ok) { UI.haptic(12); UI.toast('매너 태그를 남겼어요 · ' + mgive.label); }
        else if (mgive.reason === 'daily') UI.toast('오늘은 이미 남겼어요' + (mgive.label ? ' · ' + mgive.label : '') + '. 내일 다시 남길 수 있어요.');
        else if (mgive.reason === 'no_login') UI.toast('로그인하면 매너 태그를 남길 수 있어요', 'error');
        else if (mgive.reason === 'not_allowed') UI.toast('친구이거나 매칭이 성사된 상대에게만 남길 수 있어요', 'error');
        else if (mgive.reason === 'locked') UI.toast('잠시만요');
        else UI.toast('태그를 남기지 못했어요', 'error');
        return;
      }
      /* 받은 게스트 신청 편지지 — 그 자리에서 수락/거절 (bm-v1.43.0) */
      var gAccept = ev.target.closest('[data-guest-accept]');
      if (gAccept) {
        ev.preventDefault();
        var gaRes = ctx.actions.respondGuest(gAccept.getAttribute('data-guest-accept'), true);
        if (gaRes && gaRes.ok) {
          UI.haptic(12);
          UI.toast('수락했어요 · 단체방에서 이어서 이야기해요');
          var gaRoom = String(gaRes.postId || '');
          if (gaRoom && D.isGroupRoom(ctx.store.state.idx, gaRoom)) {
            ctx.actions.openChat(gaRoom, '');
            ctx.actions.markChatRead(gaRoom, '');
          }
        } else if (gaRes && gaRes.reason === 'full') UI.toast('정원이 다 찼어요. 한 명이 나가면 다시 수락할 수 있어요', 'error');
        else if (gaRes && gaRes.reason === 'done') UI.toast('이미 답한 신청이에요');
        else if (gaRes && gaRes.reason === 'locked') UI.toast('잠시만요');
        else UI.toast('수락하지 못했어요', 'error');
        return;
      }
      var gReject = ev.target.closest('[data-guest-reject]');
      if (gReject) {
        ev.preventDefault();
        var grRes = ctx.actions.respondGuest(gReject.getAttribute('data-guest-reject'), false);
        if (grRes && grRes.ok) { UI.haptic(10); UI.toast('신청을 거절했어요 · 정원은 그대로예요'); }
        else if (grRes && grRes.reason === 'done') UI.toast('이미 답한 신청이에요');
        else UI.toast('거절하지 못했어요', 'error');
        return;
      }
      /* 1:1 대화방 상단 ⋯ — 상대 신고·차단 (bm-v1.55.0) */
      var safetyBtn = ev.target.closest('[data-dm-safety]');
      if (safetyBtn) {
        ev.preventDefault();
        var sKey = safetyBtn.getAttribute('data-dm-safety');
        var sp = UI.person(ctx.store.state, sKey);
        if (BM.safety) {
          BM.safety.openActionsSheet(ctx, {
            kind: 'chat', targetUser: sKey, nick: sp.nick || '상대', avatar: sp
          });
        }
        UI.haptic(6);
        return;
      }
      /* 단체방 나가기 / 모집 종료 — 한 번 더 물어보고(인라인 확인 바) 실행합니다 */
      var leaveBtn = ev.target.closest('[data-vite-leave]');
      if (leaveBtn) {
        ev.preventDefault();
        roomConfirm = { roomId: String(leaveBtn.getAttribute('data-vite-leave') || ''), kind: 'leave' };
        render(host, ctx.store.state);      /* 방 화면만 다시 그려 확인 바를 보여 줍니다 */
        UI.haptic(8);
        return;
      }
      var endBtn = ev.target.closest('[data-vite-end]');
      if (endBtn) {
        ev.preventDefault();
        roomConfirm = { roomId: String(endBtn.getAttribute('data-vite-end') || ''), kind: 'end' };
        render(host, ctx.store.state);
        UI.haptic(8);
        return;
      }
      if (ev.target.closest('[data-act="leave-no"]')) {
        ev.preventDefault();
        roomConfirm = { roomId: '', kind: '' };
        render(host, ctx.store.state);
        return;
      }
      var leaveYes = ev.target.closest('[data-act="leave-yes"]');
      if (leaveYes) {
        ev.preventDefault();
        var lPost = String(leaveYes.getAttribute('data-leave-post') || '');
        var lKind = leaveYes.getAttribute('data-leave-kind') || 'leave';
        roomConfirm = { roomId: '', kind: '' };
        if (lKind === 'end') {
          var endRes = ctx.actions.deleteGroupRoom(lPost);
          if (endRes && endRes.ok) { UI.haptic(16); UI.toast('단체방을 삭제했어요 · 모집 글도 함께 내려갔어요'); }
          else if (endRes && endRes.reason === 'not_owner') UI.toast('글쓴이만 단체방을 삭제할 수 있어요', 'error');
          else UI.toast('단체방을 삭제하지 못했어요', 'error');
          return;
        }
        var lRes = ctx.actions.leaveGuest(lPost);
        if (lRes && lRes.ok) { UI.toast('단체방에서 나왔어요 · 자리가 나서 글이 다시 올라왔어요'); UI.haptic(12); }
        else if (lRes && lRes.reason === 'owner') UI.toast('글쓴이는 나갈 수 없어요 · 모집을 끝내면 방이 사라져요');
        else if (lRes && lRes.reason === 'already') UI.toast('이미 나온 방이에요');
        else UI.toast('나가지 못했어요', 'error');
        return;
      }
      var vmemb = ev.target.closest('[data-vite-members]');
      if (vmemb) {
        ev.preventDefault();
        if (BM.views.community && BM.views.community.openMembers) {
          BM.views.community.openMembers(ctx, vmemb.getAttribute('data-vite-members'));
        }
        return;
      }
      /* 받은 매칭 요청(편지지) — 카드를 누르면 상세 편지지, 여기서는 바로 수락/거절 */
      var mAccept = ev.target.closest('[data-accept]');
      if (mAccept) {
        ev.preventDefault();
        var mres = ctx.actions.respondMatch(mAccept.getAttribute('data-accept'), '수락');
        if (!mres || !mres.ok) { UI.toast(mres && mres.reason === 'done' ? '이미 처리한 요청이에요' : '처리하지 못했어요', 'error'); return; }
        UI.haptic(12);
        var mFrom = mAccept.closest('[data-from]');
        var mOther = (mFrom && mFrom.getAttribute('data-from')) || '';
        if (mres.short > 0) UI.toast('수락했어요 · 보낸 분 하트가 ' + mres.charged + '개뿐이라 ' + mres.charged + '개만 차감했어요.');
        else if (mres.charged > 0) UI.toast('수락했어요 · 보낸 분 하트 ' + mres.charged + '개 차감');
        else UI.toast('수락했어요. 대화를 시작해 보세요.');
        if (mres.roomId) {
          ctx.actions.openChat(mres.roomId, mOther);
          if (mOther) ctx.actions.markChatRead(mres.roomId, mOther);
        }
        return;
      }
      var mDecline = ev.target.closest('[data-decline]');
      if (mDecline) {
        ev.preventDefault();
        var dres = ctx.actions.respondMatch(mDecline.getAttribute('data-decline'), '거절');
        UI.toast(dres && dres.ok ? '요청을 거절했어요' : '처리하지 못했어요');
        return;
      }
      /* 편지지 카드는 어디를 눌러도 상세 편지지로 들어갑니다 */
      var openLetter = ev.target.closest('[data-open-letter]');
      if (openLetter) {
        ev.preventDefault();
        if (BM.views.matching && BM.views.matching.openLetterSheet) {
          BM.views.matching.openLetterSheet(ctx, openLetter.getAttribute('data-open-letter'));
        }
        return;
      }
      var openProf = ev.target.closest('[data-open-profile]');
      if (openProf) {
        ev.preventDefault();
        var okey = openProf.getAttribute('data-open-profile');
        if (okey && BM.views.profile) BM.views.profile.open(okey, ctx);
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
      /* ---- 대화 목록의 단체방 삭제 (bm-v1.48.0) — 목록 안에서 한 번 더 묻고 지웁나다 ---- */
      var roomDel = ev.target.closest('[data-room-del]');
      if (roomDel) {
        ev.preventDefault();
        listConfirm = { roomId: String(roomDel.getAttribute('data-room-del') || '') };
        render(host, ctx.store.state);
        UI.haptic(6);
        return;
      }
      if (ev.target.closest('[data-roomdel-no]')) {
        ev.preventDefault();
        listConfirm = { roomId: '' };
        render(host, ctx.store.state);
        return;
      }
      var roomDelYes = ev.target.closest('[data-roomdel-yes]');
      if (roomDelYes) {
        ev.preventDefault();
        var delRoom = String(roomDelYes.getAttribute('data-roomdel-yes') || '');
        listConfirm = { roomId: '' };
        var delRes = ctx.actions.deleteGroupRoom(delRoom);
        if (delRes && delRes.ok) { UI.haptic(16); UI.toast('단체방을 삭제했어요 · 모집 글도 함께 내려갔어요'); }
        else if (delRes && delRes.reason === 'not_owner') UI.toast('글쓴이만 단체방을 삭제할 수 있어요', 'error');
        else UI.toast('단체방을 삭제하지 못했어요', 'error');
        render(host, ctx.store.state);
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
      ctx = host.__dmCtx || ctx;
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
      /* 전송 전에 입력창을 비웁니다. (화면을 다시 그릴 때 보낸 글이 남지 않게) */
      var text = input.value;
      input.value = '';
      var res = ctx.actions.sendChat(state.ui.chatRoom, other, text);
      if (res.ok) {
        UI.haptic(8);
      } else if (res.reason === 'locked') {
        input.value = text;
        UI.toast('잠시만요, 보내는 중이에요');
      } else if (res.reason === 'not_allowed') {
        input.value = text;
        UI.toast('친구이거나 매칭된 상대와만 대화할 수 있어요', 'error');
      } else if (res.reason === 'empty') {
        /* 빈 메시지는 그대로 둡니다 */
      }
    });
  }

  BM.views.chat = {
    render: render, bind: bind,
    listHtml: listHtml, roomHtml: roomHtml, messageHtml: messageHtml, messagesHtml: messagesHtml,
    mannerHtml: mannerHtml,
    simpleRequest: simpleRequest,
    findThread: findThread, hhmm: hhmm
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
