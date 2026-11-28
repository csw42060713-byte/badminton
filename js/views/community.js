/* ============================================================
 * views/community.js — 커뮤니티 (글·답글·하트)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var openReplies = {};   /* postId -> true */
  var replyDrafts = {};   /* postId -> text */
  var sortMode = 'new';
  var topicFilter = '전체';   /* 상단 말머리 칩 — 전체 / 자유 / 후기 / 게스트 모집 / 용품 / 일지 */
  var lastPostAt = 0;     /* 방금 올린 시각 — 올리기 연타로 '내용을 입력해 주세요'가 뜨지 않게 */

  /* 작성칸 안내 문구 — '게스트 모집'은 모집 칸만 채워도 올라가서 그렇게 알려 줍니다
   * (bm-v1.39.1: 본문을 비운 채 모집 칸만 채우고 올리다가 막히던 문제) */
  function composerHint(topic) {
    var t = D.normalizeTopic(topic);
    if (t === D.MEET.topic) return D.MEET.topic + ' 한마디 (비워 두어도 올라가요)';
    if (t === (D.GYM_REVIEW && D.GYM_REVIEW.topic)) return '바닥·조명·주차는 어땠어요? 한 줄 남겨보세요';
    return '오늘 경기 어땠어요? 한 줄 남겨보세요';
  }

  /* 말머리 칩 한 줄 (말머리 고르기 · 목록 거르기에서 같은 모양을 씁니다)
   * 거르기의 '전체'는 고른 조건이 아니라 '조건 없음'이라 색을 달리해 구분합니다. */
  function topicChips(current, attr, all) {
    var vals = (all ? ['전체'] : []).concat(D.POST_TOPICS);
    return vals.map(function (t) {
      var on = t === current;
      var whole = all && t === '전체';
      /* bm-v1.79 — '체육관 후기'만 앞에 🏟️ 를 붙여 한눈에 찾게 합니다(값은 말머리 그대로) */
      var mark = (D.GYM_REVIEW && t === D.GYM_REVIEW.topic) ? '🏟️ ' : '';
      return '<button type="button" class="chip chip--sm' + (whole ? ' chip--all' : '') + (on ? ' is-on' : '') + '" ' + attr + '="' + U.esc(t) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + (whole && on ? UI.icon('check', 'chip__ic') : '') + mark + U.esc(t) + '</button>';
    }).join('');
  }

  function visiblePosts(state) {
    var posts = (state.data.posts || []).slice();
    /* bm-v1.43.0 — 정원이 차서 마감된 모집 글은 커뮤니티에서 자동으로 내립니다.
     * (단체방 목록에는 그대로 남아 참여자·글쓴이가 계속 대화합니다) */
    posts = posts.filter(function (p) {
      return !D.meetHidden(state.data.idx, p, (state.me && state.me.key) || '');
    });
    if (topicFilter !== '전체') {
      posts = posts.filter(function (p) { return (p.topic || '자유') === topicFilter; });
    }
    if (sortMode === 'hot') posts.sort(function (a, b) { return (b.likes + b.replies.length) - (a.likes + a.replies.length); });
    return posts;
  }

  /* 지금 거르는 말머리에 '마감돼 내려간' 모집 글이 있는지 (빈 화면 안내를 바꿔 주기 위해) */
  function closedHiddenCount(state) {
    return (state.data.posts || []).filter(function (p) {
      if (topicFilter !== '전체' && (p.topic || '자유') !== topicFilter) return false;
      return D.meetHidden(state.data.idx, p, (state.me && state.me.key) || '');
    }).length;
  }

  function allPosts(state) { return state.data.posts || []; }

  function avatarFor(state, userKey) {
    var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === userKey; })[0];
    if (mp) return mp;
    if (state.me && state.me.key === userKey) return { theme: state.me.theme, avatar: (state.me.theme && state.me.theme.avatar) || '🏸' };
    return '🏸';
  }

  /* ---------- 신고 · 차단 (bm-v1.55.0) ----------
   * 다른 사람의 글·답글에만 붙습니다. ⋯ 를 누르면 그 글 안에서 신고·차단 두 버튼이 열리고,
   * 차단은 같은 자리에서 한 번 더 묻습니다(인라인 확인 — 창·페이지 이동 없음).
   * 저장은 store(reportContent · blockUser)가 하고, 차단하면 파생 데이터에서 바로 빠집니다. */
  function safetyBar(id, userKey, nick, small) {
    var cls = 'safetybar' + (small ? ' safetybar--mini' : '');
    return '<div class="' + cls + '" data-safetybar="' + U.esc(id) + '" hidden>' +
      '<button type="button" class="safetybtn" data-report="1" data-target="' + U.esc(id) + '"' +
      ' data-user="' + U.esc(userKey) + '" data-nick="' + U.esc(nick) + '">' + UI.icon('flag') + '신고</button>' +
      '<button type="button" class="safetybtn safetybtn--danger" data-block-ask="' + U.esc(userKey) + '"' +
      ' data-nick="' + U.esc(nick) + '" data-target="' + U.esc(id) + '">' + UI.icon('block') + '차단</button>' +
      '</div>' +
      '<div class="safetybar safetybar--confirm" data-blockconfirm="' + U.esc(userKey) + '" hidden>' +
      '<p class="safetybar__t">' + U.esc(nick) + '님을 차단할까요? 이 사람의 글·답글·1:1 대화가 보이지 않아요.</p>' +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--ghost btn--sm grow" data-block-no="1">취소</button>' +
      '<button type="button" class="btn btn--danger btn--sm grow" data-block-yes="' + U.esc(userKey) + '">' + UI.icon('block') + '차단</button>' +
      '</div></div>';
  }

  /* 신고할 때 함께 보내는 '신고 당시 내용 앞부분' — 화면 데이터에서만 찾습니다 */
  function targetText(state, kind, id) {
    var posts = (state && state.data && state.data.posts) || [];
    for (var i = 0; i < posts.length; i++) {
      if (kind === 'post' && String(posts[i].id) === String(id)) return posts[i].text || '';
      var rs = posts[i].replies || [];
      for (var j = 0; j < rs.length; j++) {
        if (String(rs[j].id) === String(id)) return rs[j].text || '';
      }
    }
    return '';
  }

  function postCard(p, state) {
    var open = !!openReplies[p.id];
    var me = (state.me && state.me.key) || '';
    /* 내가 쓴 글에만 '삭제' 입구를 붙입니다 (bm-v1.40.1) — 지우기 전에 그 글 안에서 한 번 더 확인합니다 */
    var mine = !!me && String(p.userKey || '') === String(me);
    /* 다른 사람 글에는 ⋯ 로 신고·차단 (bm-v1.55.0) */
    var others = !!me && !mine && !!String(p.userKey || '');
    /* 본문을 비우고 모집 정보만 적은 글은 빈 문단을 그리지 않습니다 (bm-v1.39.1) */
    var body = postBodyText(p);
    return '<article class="post" data-post="' + U.esc(p.id) + '">' +
      '<header class="post__head">' +
      '<button type="button" class="post__author" data-author="' + U.esc(p.userKey) + '" aria-label="' + U.esc(p.nick) + ' 프로필 보기">' +
      UI.avatar(avatarFor(state, p.userKey), 40) +
      '<span class="post__who"><strong>' + U.esc(p.nick) + '</strong>' +
      '<time>' + U.timeAgo(p.createdAt) + '</time></span></button>' +
      '<span class="pill pill--ghost post__topic">' + U.esc(p.topic || '자유') + '</span>' +
      /* bm-v1.87.0 — 글쓴이의 미니 라켓. 탭하면 라켓 구경 시트(응원 · 1:1 매칭) */
      (BM.racketcustom && p.userKey
        ? '<button type="button" class="post__rk" data-rk-person="' + U.esc(p.userKey) + '"' +
          ' aria-label="' + U.esc(p.nick) + '님 라켓 구경">' +
          BM.racketcustom.personHtml(state, p.userKey) + '</button>'
        : '') +
      (mine
        ? '<button type="button" class="post__del" data-post-del="' + U.esc(p.id) + '" aria-expanded="false"' +
          ' aria-label="내 글 삭제" title="삭제">' + UI.icon('trash') + '</button>'
        : '') +
      (others
        ? '<button type="button" class="post__more" data-post-menu="' + U.esc(p.id) + '" aria-expanded="false"' +
          ' aria-label="이 글 신고·차단" title="신고·차단">' + UI.icon('more') + '</button>'
        : '') +
      '</header>' +
      (others ? safetyBar(p.id, p.userKey, p.nick, false) : '') +
      (mine
        ? '<div class="post__delbar" data-delbar="' + U.esc(p.id) + '" hidden>' +
          '<p class="post__delbar-t">이 글을 삭제할까요? 지우면 되돌릴 수 없어요.</p>' +
          '<div class="row gap8">' +
          '<button type="button" class="btn btn--ghost btn--sm grow" data-act="post-del-no">취소</button>' +
          '<button type="button" class="btn btn--danger btn--sm grow" data-act="post-del-yes" data-del-post="' + U.esc(p.id) + '">' + UI.icon('trash') + '삭제</button>' +
          '</div></div>'
        : '') +
      (body.trim() ? '<p class="post__text">' + U.esc(body).replace(/\n/g, '<br>') + '</p>' : '') +
      gymReviewCard(p, state) +
      ((p.meet || p.topic === D.MEET.topic) ? meetCard(p, state) : '') +
      '<footer class="post__foot">' +
      '<button class="react' + (p.likedByMe ? ' is-on' : '') + '" data-like="' + U.esc(p.id) + '" aria-pressed="' + (p.likedByMe ? 'true' : 'false') + '">' +
      UI.icon('heart') + '<span data-like-count>' + p.likes + '</span></button>' +
      '<button class="react" data-toggle-reply="' + U.esc(p.id) + '">' + UI.icon('community') +
      '<span>' + (p.replies.length || '답글') + '</span></button>' +
      '</footer>' +
      (open ? '<div class="replies">' +
        (p.replies.length ? '<ul>' + p.replies.map(function (r) {
          var rMine = String(r.userKey || '') === String(me);
          var rOthers = !!me && !rMine && !!String(r.userKey || '');
          return '<li data-reply="' + U.esc(r.id) + '">' +
            '<div class="replies__who"><strong>' + U.esc(r.nick) + '</strong>' +
            (r.mentor ? '<span class="pill pill--ok replies__mentor">멘토 조언</span>' : '') +
            '<time>' + U.timeAgo(r.createdAt) + '</time>' +
            (rOthers
              ? '<button type="button" class="replies__more" data-reply-menu="' + U.esc(r.id) + '"' +
                ' aria-expanded="false" aria-label="이 답글 신고·차단" title="신고·차단">' + UI.icon('more') + '</button>'
              : '') +
            '</div><p>' + U.esc(r.text) + '</p>' +
            (rOthers ? safetyBar(r.id, r.userKey, r.nick, true) : '') + '</li>';
        }).join('') + '</ul>' : '<p class="muted sm">첫 답글을 남겨 보세요.</p>') +
        '<form class="replyform" data-reply-form="' + U.esc(p.id) + '">' +
        '<input type="text" maxlength="200" placeholder="' + U.esc((state.me && state.me.nick) || '나') + '(으)로 답글" data-reply-input="' + U.esc(p.id) + '" value="' + U.esc(replyDrafts[p.id] || '') + '">' +
        '<button class="btn btn--sm btn--primary" type="submit" aria-label="답글 보내기">' + UI.icon('send') + '</button></form>' +
        '</div>' : '') +
      '</article>';
  }

  /* ---------- 체육관 후기 (bm-v1.79.0) ----------
   * '바닥 · 조명 · 주차 · 샤워'를 한 카드로 묶어 글 위에 보여 줍니다.
   * 값이 없는 칸은 그리지 않고, 등록된 체육관 이름이면 지도로 이어 줍니다. */
  function gymTone(v) {
    return v === '좋아요' ? 'good' : (v === '아쉬워요' ? 'bad' : 'ok');
  }

  function gymReviewCard(p, state) {
    var g = D.gymReviewOf(p);
    if (!g) return '';
    var rows = D.GYM_REVIEW.fields.filter(function (f) { return g[f.key]; }).map(function (f) {
      return '<span class="gymrow gymrow--' + gymTone(g[f.key]) + '">' +
        '<i>' + U.esc(f.label) + '</i><b>' + U.esc(g[f.key]) + '</b></span>';
    }).join('');
    var name = g.name
      ? ((BM.views && BM.views.gyms) ? BM.views.gyms.linkOrText(g.name) : U.esc(g.name))
      : '';
    return '<div class="gymreview" data-gymreview="' + U.esc(p.id) + '">' +
      '<p class="gymreview__t">' + (name || (UI.icon('pin') + '<span>체육관 후기</span>')) + '</p>' +
      (rows ? '<div class="gymreview__rows">' + rows + '</div>' : '') +
      gymHeartLine(p, state) +
      '</div>';
  }

  /* bm-v1.99.0 — 후기 좋아요 하트 보상 한 줄
   *  · 내 후기: 지금까지 받은 수(오늘 N/3)를 보여 주고
   *  · 남의 후기: ❤ 를 누르면 후기 주인에게 하트가 간다고 알려 줍니다. */
  function gymHeartLine(p, state) {
    var me = (state && state.me && state.me.key) || '';
    var mine = !!me && String(p.userKey || '') === String(me);
    var rl = state && state.data && state.data.hearts && state.data.hearts.reviewLike;
    var text = mine
      ? (rl
        ? '❤️ 좋아요를 받으면 하트 +1 · 오늘 ' + rl.today + '/' + rl.perDay
        : '❤️ 좋아요를 받으면 하트 +1 · 하루 3개까지')
      : '❤️ 누르면 이 후기 주인에게 하트 +1';
    return '<p class="gymreview__hb">' + UI.icon('heart') + '<span>' + U.esc(text) + '</span></p>';
  }

  /* 글 본문 — 후기 카드가 같은 내용을 보여 주므로, 저장할 때 본문 앞에 붙여 둔
   * '체육관 이름 · 네 칸 요약' 두 줄은 글자에서 덜어 내고 사람이 쓴 말만 남깁니다.
   * (저장된 본문은 그대로라 예전 앱·다른 기기에서는 두 줄이 보입니다) */
  function postBodyText(p) {
    var raw = String((p && p.text) == null ? '' : p.text);
    var g = D.gymReviewOf(p);
    if (!g) return raw;
    var lines = raw.split('\n');
    if (lines.length && lines[0].indexOf('🏟️ ') === 0) lines.shift();
    var summary = D.gymReviewText(g);
    if (summary && lines.length && lines[0].trim() === summary) lines.shift();
    return lines.join('\n').trim();
  }

  /* 모집글의 '어디 체육관' — 등록된 체육관과 이어지면 이름을 눌러 지도(주소·코트 수)를
   * 바로 볼 수 있게 하고, 이어지지 않는 곳(집 앞 체육공원 등)은 지금처럼 글자로 둡니다. */
  function placeHtml(place) {
    var name = String(place || '').trim();
    var link = (name && BM.views && BM.views.gyms) ? BM.views.gyms.link(name) : '';
    if (link) return link;
    return UI.icon('pin') + '<span>' + U.esc(name || '장소는 문의해서 정해요') + '</span>';
  }

  /* ---------- 게스트 모집 ----------
   * 글 위에 일시·장소·인원을 스포츠 앱처럼 한 카드로 묶고,
   * bm-v1.43.0 — `참여 신청`은 신청 편지지를 보내고 글쓴이가 수락해야 단체방에 들어갑니다.
   *   · 글쓴이·수락된 게스트: '단체방 열기' / 신청 후 대기: '신청 대기 중'(눌리지 않음)
   *   · 정원이 차면 글은 커뮤니티에서 내려가고(단체방은 남음), 한 명이 나가면 다시 올라옵니다.
   */
  function meetCard(p, state) {
    var m = p.meet || D.normalizeMeet(null);
    var me = (state.me && state.me.key) || '';
    var st = D.meetStatus(state.data.idx, p, me);
    var mine = st.mine;
    var myGuest = st.me.status || '';
    var joined = (state.data.threads || []).some(function (t) {
      return t.kind === 'group' && String(t.roomId) === String(p.id);
    });
    /* 정원이 있으면 지금 인원을 함께 (글쓴이는 '참여자 N명'으로) */
    var capLine = st.cap
      ? (mine ? '참여자 ' + st.count + '명' : '참여 ' + st.count + '/' + st.cap + '명')
      : (mine && st.guests ? '참여자 ' + st.count + '명' : '');
    return '<div class="vite' + (st.closed ? ' vite--closed' : '') + '">' +
      '<div class="vite__info">' +
      '<p class="vite__t">' + UI.icon('bolt') + U.esc(D.MEET.cardLabel) +
      (m.cap ? '<b>' + U.esc(m.cap) + '명</b>' : '') +
      (st.closed ? '<span class="pill pill--closed">' + U.esc(D.MEET.closedLabel) + '</span>' : '') +
      '</p>' +
      '<p class="vite__row">' + UI.icon('clock') + '<span>' + U.esc(m.when || '일시는 문의해서 정해요') + '</span></p>' +
      '<p class="vite__row vite__row--place">' + placeHtml(m.place) + '</p>' +
      (m.fee ? '<p class="vite__row vite__row--fee">' + UI.icon('coin', 'vite__fee-ic') + '<span>' + U.esc(D.meetFeeText(m)) + '</span></p>' : '') +
      (capLine
        ? '<p class="vite__row vite__row--cap">' + UI.icon('users') + '<span>' + U.esc(capLine) + '</span>' +
          (mine && (st.members.length || st.pending.length)
            ? '<button type="button" class="linkbtn vite__members" data-vite-members="' + U.esc(p.id) + '"' +
              ' aria-label="참여자 명단·받은 신청 보기">' + (st.pending.length ? '신청 ' + st.pending.length + '건 · 명단' : '명단 보기') + '</button>'
            : '') + '</p>'
        : '') +
      (mine && !capLine && st.pending.length
        ? '<p class="vite__row vite__row--cap">' + UI.icon('mail') + '<span>신청 ' + st.pending.length + '건</span>' +
          '<button type="button" class="linkbtn vite__members" data-vite-members="' + U.esc(p.id) + '">명단 보기</button></p>'
        : '') +
      '</div>' +
      (p.userKey ? meetButton(p, st, mine, myGuest, joined) : '') +
      '</div>';
  }

  /* 모집 카드의 오른쪽 버튼 — 지금 내 상태에 따라 하나만 그립니다.
   * data-vite-group 은 어느 글의 방인지(모든 상태에서 같은 값),
   * data-vite-go 는 누를 때 할 일(room · apply · pending · rejected · closed)입니다. */
  function meetButton(p, st, mine, myGuest, joined) {
    var id = U.esc(p.id);
    var who = U.esc(p.nick || '글쓴이');
    var dot = joined ? '<i class="vite__dot" aria-hidden="true"></i>' : '';
    if (mine || myGuest === D.GUEST.accept) {
      return '<button type="button" class="btn btn--primary btn--sm vite__btn" data-vite-group="' + id + '" data-vite-go="room"' +
        ' aria-label="' + who + '님 글의 ' + U.esc(D.MEET.roomLabel) + ' 열기">' +
        UI.icon('users') + '<span>' + U.esc(D.MEET.openLabel) + '</span>' + dot + '</button>';
    }
    if (myGuest === D.GUEST.pending) {
      return '<button type="button" class="btn btn--ghost btn--sm vite__btn vite__btn--wait" data-vite-group="' + id + '"' +
        ' data-vite-go="pending" disabled aria-disabled="true">' +
        UI.icon('clock') + '<span>' + U.esc(D.GUEST.pendingLabel) + '</span></button>';
    }
    if (myGuest === D.GUEST.reject) {
      return '<button type="button" class="btn btn--ghost btn--sm vite__btn vite__btn--wait" data-vite-group="' + id + '"' +
        ' data-vite-go="rejected" disabled aria-disabled="true">' +
        UI.icon('close') + '<span>' + U.esc(D.GUEST.rejectedLabel) + '</span></button>';
    }
    if (st.closed) {
      return '<button type="button" class="btn btn--ghost btn--sm vite__btn vite__btn--wait" data-vite-group="' + id + '"' +
        ' data-vite-go="closed" disabled aria-disabled="true">' +
        UI.icon('users') + '<span>' + U.esc(D.MEET.closedLabel) + '</span></button>';
    }
    return '<button type="button" class="btn btn--primary btn--sm vite__btn" data-vite-group="' + id + '"' +
      ' data-vite-go="apply" aria-label="' + who + '님 글에 참여 신청">' +
      UI.icon('send') + '<span>' + U.esc(D.MEET.applyLabel) + '</span></button>';
  }

  /* 미리 채우는 문구 — 한 줄 입력창(약 30자)에 들어가게 일시는 날짜까지만 붙입니다.
   * v1.37.2: 말머리 이름이 '게스트 모집'으로 길어져, 일시를 그대로 붙이면 한 줄을 넘게 됩니다. */
  var DRAFT_MAX = 30;
  function withWhen(head, when) {
    if (!when) return head;
    var full = head + ' (' + when + ')';
    if (full.length <= DRAFT_MAX) return full;
    var date = String(when).split(' ')[0];           /* '11/21(금) 19:00' → '11/21(금)' */
    if (date && date !== when) {
      var short = head + ' (' + date + ')';
      if (short.length <= DRAFT_MAX) return short;
    }
    return head;
  }

  /* 정원이 찬 글에 '대기 문의'로 들어올 때 미리 채우는 문구 */
  function waitDraft(post) {
    var when = post && post.meet && post.meet.when ? String(post.meet.when) : '';
    if (when.length > 16) when = '';
    return withWhen(D.MEET.topic + ' ' + D.MEET.waitTopic, when);
  }

  /* 글쓴이용 — 참여자 명단 (간단한 시트). 누르면 그 사람 프로필(친구·채팅)로 이어집니다.
   * bm-v1.43.0 — 이름 아래에 '받은 게스트 신청'을 함께 보여 주고, 그 자리에서 수락/거절합니다. */
  /* 명단 시트의 본문 — 화면 없이 그려 볼 수 있게 순수 함수로 둡니다(테스트용) */
  function membersBody(state, postId) {
    var post = (state.data.posts || []).filter(function (p) { return String(p.id) === String(postId); })[0];
    if (!post) return '';
    var st = D.meetStatus(state.data.idx, post, state.me && state.me.key);
    var rows = st.members.map(function (mem) {
      var isAuthor = String(mem.key) === String(post.userKey);
      var isGuest = st.accepted.some(function (a) { return String(a.key) === String(mem.key); });
      return '<li><button type="button" class="members__who" data-vite-member="' + U.esc(mem.key) + '">' +
        UI.avatar(UI.person(state, mem.key), 34) +
        '<span><strong>' + U.esc(mem.nick) + '</strong>' +
        '<small>' + (isAuthor ? '글쓴이' : (isGuest ? '수락한 게스트' : '함께하는 사람')) + (mem.me ? ' · 나' : '') + '</small></span></button></li>';
    }).join('');
    var pending = st.pending.map(function (it) {
      var p2 = UI.person(state, it.key);
      return '<li class="members__req" data-guest-apply="' + U.esc(it.applyId) + '">' +
        '<div class="members__req-top">' + UI.avatar(p2, 34) +
        '<span><strong>' + U.esc(it.nick || p2.nick) + '</strong>' +
        '<small>' + U.esc([it.level || p2.level, it.style].filter(Boolean).join(' · ') || '대기 중') + '</small></span>' +
        '<em class="members__req-day">' + U.esc(U.timeAgo(it.applyAt || it.at) || '방금') + '</em></div>' +
        (it.note ? '<p class="members__req-note">' + U.esc(it.note) + '</p>'
          : '<p class="members__req-note members__req-note--none">한마디 없이 신청했어요.</p>') +
        '<div class="row gap8 members__req-act">' +
        '<button type="button" class="btn btn--ghost btn--sm grow" data-guest-reject="' + U.esc(it.applyId) + '">거절</button>' +
        '<button type="button" class="btn btn--primary btn--sm grow" data-guest-accept="' + U.esc(it.applyId) + '">수락</button>' +
        '</div></li>';
    }).join('');
    var body = '<div class="members">' +
      '<p class="members__t">' + UI.icon('users') + '참여자 <b>' + st.count + '명</b>' +
      (st.cap ? ' · 정원 ' + st.cap + '명' : '') +
      (st.closed ? ' · <b>' + U.esc(D.MEET.closedLabel) + '</b>' : '') + '</p>' +
      (rows ? '<ul class="members__list">' + rows + '</ul>' : '') +
      (st.guests ? '' : '<p class="members__empty">아직 참여자가 없어요. 받은 신청을 수락하면 여기에 함께 보여요.</p>') +
      '<p class="members__t members__t--sec">' + UI.icon('mail') + '받은 게스트 신청 <b>' + st.pending.length + '건</b></p>' +
      (pending ? '<ul class="members__list members__list--req">' + pending + '</ul>'
        : '<p class="members__empty">아직 받은 신청이 없어요. 정원이 차면 이 글이 커뮤니티에서 내려가고, 한 명이 나가면 다시 올라옵니다.</p>') +
      '</div>';
    return body;
  }

  function openMembers(ctx, postId) {
    var body = membersBody(ctx.store.state, postId);
    if (!body) { UI.toast('글을 찾지 못했어요', 'error'); return; }
    UI.openSheet({
      title: '참여자 명단',
      body: body,
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var okBtn = ev.target.closest('[data-guest-accept]');
          if (okBtn) {
            ev.preventDefault();
            var okRes = ctx.actions.respondGuest(okBtn.getAttribute('data-guest-accept'), true);
            if (okRes && okRes.ok) { UI.toast('수락했어요 · 단체방에서 인사해 보세요'); UI.haptic(12); }
            else if (okRes && okRes.reason === 'full') UI.toast('정원이 다 찼어요. 한 명이 나가면 다시 수락할 수 있어요', 'error');
            else if (okRes && okRes.reason === 'done') UI.toast('이미 답한 신청이에요');
            else UI.toast('수락하지 못했어요', 'error');
            if (okRes && okRes.ok) openMembers(ctx, postId);
            return;
          }
          var noBtn = ev.target.closest('[data-guest-reject]');
          if (noBtn) {
            ev.preventDefault();
            var noRes = ctx.actions.respondGuest(noBtn.getAttribute('data-guest-reject'), false);
            if (noRes && noRes.ok) UI.toast('신청을 거절했어요 · 정원은 그대로예요');
            else if (noRes && noRes.reason === 'done') UI.toast('이미 답한 신청이에요');
            else UI.toast('거절하지 못했어요', 'error');
            if (noRes && noRes.ok) openMembers(ctx, postId);
            return;
          }
          var b = ev.target.closest('[data-vite-member]');
          if (!b) return;
          ev.preventDefault();
          var key = b.getAttribute('data-vite-member');
          if (key && BM.views.profile) BM.views.profile.open(key, ctx);
        });
      }
    });
  }

  /* 참여 신청 편지지 — 한마디를 적어 보내면 글쓴이의 채팅 > 받은 게스트 신청에 도착합니다.
   * 기본 문구를 미리 채워 두고, 고쳐서 보낼 수 있게 합니다(최대 80자). */
  function applySheet(ctx, postId) {
    var state = ctx.store.state;
    var post = (state.data.posts || []).filter(function (p) { return String(p.id) === String(postId); })[0];
    if (!post) { UI.toast('글을 찾지 못했어요', 'error'); return; }
    var m = post.meet || D.normalizeMeet(null);
    var line = D.meetText(m);
    var draft = D.GUEST.noteDefault;
    var body = '<div class="applysheet">' +
      '<p class="applysheet__post">' + UI.icon('bolt') + '<b>' + U.esc(post.nick || '글쓴이') + '</b>님의 ' + U.esc(D.MEET.cardLabel) +
      (line ? '<small>' + U.esc(line) + '</small>' : '') + '</p>' +
      '<label class="applysheet__f"><span>한마디 <small>' + D.GUEST.noteMax + '자까지</small></span>' +
      '<input type="text" maxlength="' + D.GUEST.noteMax + '" data-guest-note enterkeyhint="send" value="' + U.esc(draft) + '" placeholder="' + U.esc(D.GUEST.noteDefault) + '"></label>' +
      '<p class="applysheet__hint">' + UI.icon('clock') + '보내면 글쓴이에게 편지지가 가요. 수락되면 이 글의 단체방에서 대화할 수 있어요.</p>' +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--ghost grow" data-close="1">취소</button>' +
      '<button type="button" class="btn btn--primary grow" data-guest-send="' + U.esc(post.id) + '">' + UI.icon('send') + '신청 보내기</button>' +
      '</div></div>';
    UI.openSheet({
      title: '참여 신청',
      body: body,
      onMount: function (wrap) {
        var go = function () {
          var inp = wrap.querySelector('[data-guest-note]');
          var res = ctx.actions.applyGuest(postId, inp ? inp.value : '');
          if (res && res.ok) {
            UI.closeSheet();
            UI.toast('신청 편지지를 보냈어요 · 글쓴이가 수락하면 알려 드릴게요');
            UI.haptic(12);
            return;
          }
          if (res && res.reason === 'pending') UI.toast('이미 신청했어요 · 글쓴이의 답을 기다리는 중이에요');
          else if (res && res.reason === 'accepted') UI.toast('이미 수락된 신청이에요 · 단체방으로 들어가세요');
          else if (res && res.reason === 'closed') UI.toast('정원이 다 찼어요', 'error');
          else if (res && res.reason === 'mine') UI.toast('내 글에는 신청할 수 없어요');
          else if (res && res.reason === 'no_login') UI.toast('로그인하면 참여 신청을 보낼 수 있어요', 'error');
          else if (res && res.reason === 'locked') UI.toast('잠시만요, 보내는 중이에요');
          else UI.toast('신청을 보내지 못했어요', 'error');
        };
        wrap.addEventListener('click', function (ev) {
          if (ev.target.closest('[data-guest-send]')) { ev.preventDefault(); go(); return; }
        });
        wrap.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return;
          if (!ev.target.closest('[data-guest-note]')) return;
          ev.preventDefault();
          go();
        });
      }
    });
  }

  /* 참여 문의 문구 — 한 줄 입력창에 들어가도록 일시는 짧게(날짜만) */
  function inquiryDraft(post) {
    var when = post && post.meet && post.meet.when ? String(post.meet.when) : '';
    if (when.length > 16) when = '';
    return withWhen(D.MEET.topic + ' 참여하고 싶어요!', when);
  }

  /* 말머리가 '게스트 모집'일 때만 보이는 선택 입력칸 (전부 비워 두어도 그냥 글이 됩니다)
   * bm-v1.40.1: '게스트비' 칸과 빠른 선택 칩(없음·5천원·1만원) — 비워 두어도 올라갑니다. */
  function feeChips(cur) {
    return D.MEET.feeChips.map(function (v) {
      var on = String(cur || '') === v;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '" data-vitefee-val="' + U.esc(v) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(v) + '</button>';
    }).join('');
  }

  /* 몇 명 빠른 선택 칩 (bm-v1.84.0) — 언제·게스트비처럼 2·4·6명을 한 번에
   *  · 누르면 칸에 그대로 적히고, 같은 칩을 다시 누르면 지웁니다. */
  var CAP_CHIPS = ['2', '4', '6'];
  function capChips(cur) {
    var v = String(cur == null ? '' : cur).replace(/[^0-9]/g, '');
    return CAP_CHIPS.map(function (n) {
      var on = v === n;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '" data-vitecap-val="' + n + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + n + '명</button>';
    }).join('');
  }

  /* 칸에 적힌 값에 맞춰 몇 명 칩의 켜짐만 바꿉니다 (포커스 유지) */
  function syncCapChips(root, val) {
    var host = root.querySelector('[data-vitecap]');
    if (!host) return;
    var v = String(val == null ? '' : val).replace(/[^0-9]/g, '');
    UI.$$('.chip', host).forEach(function (b) {
      var on = String(b.getAttribute('data-vitecap-val') || '') === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* 날짜·시간 칸 → 글자 한 줄. 칸을 바꿀 때마다 글자 칸과 칩만 맞춥니다 */
  function syncWhen(root, ctx) {
    var box = root.querySelector('[data-vitewhenbox]');
    if (!box || !ctx || !ctx.actions) return '';
    var date = box.querySelector('[data-vitewhen="date"]');
    var start = box.querySelector('[data-vitewhen="start"]');
    var end = box.querySelector('[data-vitewhen="end"]');
    var text = D.meetWhen.compose(date && date.value, start && start.value, end && end.value);
    var field = box.querySelector('[data-vitefield="when"]');
    if (field) field.value = text;
    ctx.actions.setComposerMeet('when', text);
    paintWhen(root, { date: (date && date.value) || '', start: (start && start.value) || '', end: (end && end.value) || '' });
    return text;
  }

  /* 손으로 적은 글자 → 날짜·시간 칸과 칩 (글자 칸 자체는 건드리지 않음) */
  function whenFromText(root, ctx, text) {
    var parsed = D.meetWhen.parse(text);
    var box = root.querySelector('[data-vitewhenbox]');
    if (!box) return;
    ['date', 'start', 'end'].forEach(function (k) {
      var inp = box.querySelector('[data-vitewhen="' + k + '"]');
      if (inp && parsed[k]) inp.value = parsed[k];
    });
    paintWhen(root, parsed);
    if (ctx && ctx.actions) ctx.actions.setComposerMeet('when', text);
  }

  /* 날짜·시간 칩의 켜짐만 바꿉니다 (화면을 다시 그리지 않음 → 포커스 유지) */
  function paintWhen(root, cur) {
    var box = root.querySelector('[data-vitewhenbox]');
    if (!box) return;
    var day = cur && cur.date ? cur.date : '';
    UI.$$('[data-viteday-quick]', box).forEach(function (b) {
      var on = !!day && b.getAttribute('data-viteday-quick') === day;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var s = D.meetWhen.time(cur && cur.start);
    var e = D.meetWhen.time(cur && cur.end);
    var range = (s && e) ? (s + '~' + e) : '';
    UI.$$('[data-vitetime-quick]', box).forEach(function (b) {
      var on = !!range && b.getAttribute('data-vitetime-quick') === range;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* 칸에 적힌 값에 맞춰 칩의 켜짐만 바꿉니다 (화면을 다시 그리지 않음 → 포커스 유지) */
  function syncFeeChips(root, val) {
    var host = root.querySelector('[data-vitefee]');
    if (!host) return;
    UI.$$('.chip', host).forEach(function (b) {
      var on = String(b.getAttribute('data-vitefee-val') || '') === String(val == null ? '' : val);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---------- 모집 일시 고르기 (bm-v1.48.0) ----------
   * 예전에는 '11/23(월) 19:00~21:00'을 손으로 쳤습니다. 이제 칩·칸으로 고르면
   * 같은 글자가 만들어져 지금 그대로 meet.when 한 칸에 들어갑니다(카드·지도·신청 호환).
   *  · 칸을 바꿀 때마다 화면을 다시 그리지 않고 글자 칸·칩만 맞춥니다(포커스 유지). */
  function whenQuickChips(cur) {
    return D.meetWhen.quickDates().map(function (q) {
      var on = !!cur.date && cur.date === q.date;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '"' +
        ' data-viteday-quick="' + U.esc(q.date) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        U.esc(q.label) + '<i class="vitewhen__d">' + U.esc(q.day) + '</i></button>';
    }).join('');
  }

  function whenTimeChips(cur) {
    var now = (cur.start && cur.end) ? (cur.start + '~' + cur.end) : '';
    return D.meetWhen.quickTimes.map(function (v) {
      var on = v === now;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '"' +
        ' data-vitetime-quick="' + U.esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        U.esc(v) + '</button>';
    }).join('');
  }

  function meetFields(picked, state) {
    var m = (state.ui && state.ui.composerMeet) || {};
    var on = picked === D.MEET.topic;
    var cur = D.meetWhen.parse(m.when);
    var today = U.ymd();
    return '<div class="viteform" data-viteform' + (on ? '' : ' hidden') + '>' +
      '<p class="viteform__t">' + UI.icon('bolt') + U.esc(D.MEET.cardLabel) + ' <small>비워 두어도 올라가요</small></p>' +
      '<div class="viteform__grid">' +
      '<div class="viteform__f viteform__f--wide vitewhen" data-vitewhenbox>' +
      '<span>언제 <small>날짜·시간을 눌러서 골라요</small></span>' +
      '<div class="chips viteform__chips vitewhen__quick" data-viteday>' + whenQuickChips(cur) + '</div>' +
      '<div class="vitewhen__row">' +
      '<input type="date" class="vitewhen__date" data-vitewhen="date" min="' + U.esc(today) + '"' +
      ' value="' + U.esc(cur.date || today) + '" aria-label="모집 날짜">' +
      '<div class="vitewhen__times">' +
      '<input type="time" class="vitewhen__time" data-vitewhen="start" step="1800"' +
      ' value="' + U.esc(cur.start) + '" aria-label="시작 시간">' +
      '<span class="vitewhen__tilde" aria-hidden="true">~</span>' +
      '<input type="time" class="vitewhen__time" data-vitewhen="end" step="1800"' +
      ' value="' + U.esc(cur.end) + '" aria-label="끝 시간">' +
      '</div></div>' +
      '<div class="chips viteform__chips vitewhen__quick" data-vitetime>' + whenTimeChips(cur) + '</div>' +
      '<input type="text" maxlength="30" data-vitefield="when" enterkeyhint="next" placeholder="11/21(금) 19:00"' +
      ' value="' + U.esc(m.when || '') + '" aria-label="모집 일시">' +
      '</div>' +
      '<label class="viteform__f"><span>몇 명</span>' +
      '<input type="text" inputmode="numeric" maxlength="3" data-vitefield="cap" enterkeyhint="next" placeholder="6" value="' + U.esc(m.cap || '') + '"></label>' +
      '<div class="chips viteform__chips vitecap" data-vitecap>' + capChips(m.cap) + '</div>' +
      '<label class="viteform__f viteform__f--wide"><span>어디 체육관</span>' +
      '<input type="text" maxlength="30" data-vitefield="place" placeholder="동네 체육관 이름" value="' + U.esc(m.place || '') + '">' +
      '<button type="button" class="viteform__pick" data-act="pick-gym">' + UI.icon('pin') + '지도에서 고르기</button></label>' +
      '<label class="viteform__f viteform__f--wide"><span>게스트비</span>' +
      '<input type="text" maxlength="12" data-vitefield="fee" enterkeyhint="done" placeholder="없음 또는 1만원" value="' + U.esc(m.fee || '') + '"></label>' +
      '<div class="chips viteform__chips" data-vitefee>' + feeChips(m.fee) + '</div>' +
      '</div></div>';
  }

  /* ---------- '체육관 후기' 작성 칸 (bm-v1.79.0) ----------
   * 말머리를 '체육관 후기'로 골랐을 때만 열립니다(게스트 모집 칸과 같은 방식).
   * 체육관 이름은 한 줄, 바닥·조명·주차·샤워는 세 칩 중 하나 — 다시 누르면 비웁니다.
   * 한 칸도 안 적어도 올라가고(본문만 있는 후기), 적은 것은 글에 구조화해 남습니다. */
  function gymFields(picked, state) {
    var g = D.normalizeGymReview((state.ui && state.ui.composerGym) || {});
    var on = picked === D.GYM_REVIEW.topic;
    return '<div class="gymform" data-gymform' + (on ? '' : ' hidden') + '>' +
      '<p class="gymform__t">' + UI.icon('pin') + U.esc(D.GYM_REVIEW.label) +
      ' <small>바닥·조명·주차·샤워를 한 번씩만 눌러도 올라가요</small></p>' +
      '<label class="gymform__name"><span>체육관 이름</span>' +
      '<input type="text" maxlength="' + D.GYM_REVIEW.nameMax + '" data-gymfield="name" enterkeyhint="next"' +
      ' placeholder="동네 체육관 이름" value="' + U.esc(g.name || '') + '"></label>' +
      D.GYM_REVIEW.fields.map(function (f) {
        return '<div class="gympick" data-gymrow="' + f.key + '">' +
          '<span class="gympick__k">' + U.esc(f.label) + '</span>' +
          '<div class="chips gympick__chips">' + D.GYM_REVIEW.scale.map(function (v) {
            var sel = g[f.key] === v;
            return '<button type="button" class="chip chip--sm gympick__b gympick__b--' + gymTone(v) + (sel ? ' is-on' : '') + '"' +
              ' data-gympick="' + f.key + '" data-gymval="' + U.esc(v) + '" aria-pressed="' + (sel ? 'true' : 'false') + '">' +
              U.esc(v) + '</button>';
          }).join('') + '</div></div>';
      }).join('') +
      '</div>';
  }

  /* 게스트 모집의 '어디 체육관'을 지도에서 고르게 합니다.
   * 고른 이름은 작성 칸(composerMeet.place)에 담기므로 화면을 다시 그려도 남습니다. */
  function openGymPicker(ctx, root) {
    if (!BM.views || !BM.views.gyms) return;
    BM.views.gyms.open(ctx, {
      onPick: function (v) {
        if (!v) return;
        ctx.actions.setComposerMeet('place', v.name);
        var inp = root.querySelector('[data-vitefield="place"]');
        if (inp) inp.value = v.name;
        var last = v.name.charCodeAt(v.name.length - 1);
        var josa = (last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0) ? '을' : '를';
        UI.toast('‘' + v.name + '’' + josa + ' 넣었어요');
        UI.haptic(8);
      }
    });
  }

  /* ---------- 빈 화면 ----------
   * 첫 방문에 빈 화면만 보이지 않도록, 아직 공유하지 않은 최근 일지를
   * 한 번에 올리는 버튼을 둡니다. 올릴 일지가 없으면 일지 쓰기로 보냅니다.
   * 2026-11-23 저녁 — 저녁에 게스트 모집 글을 올리거나 찾는 동호인이
   * 바로 닿도록 '게스트 모집 글쓰기' 입구를 함께 둡니다(누르면 분류가 게스트 모집으로). */
  function shareableRecord(state) {
    var me = (state.me && state.me.key) || '';
    var shared = {};
    ((state.idx && state.idx.byType && state.idx.byType['소셜']) || []).forEach(function (p) {
      if (p.userKey === me && p.target) shared[String(p.target)] = true;
    });
    var recs = state.data.records || [];
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r && r.id && !shared[String(r.id)]) return r;
    }
    return null;
  }

  function emptyBlock(state) {
    var rec = shareableRecord(state);
    var guest = '<button type="button" class="btn btn--ghost btn--sm" data-act="write-guest">' +
      UI.icon('bolt') + '게스트 모집 글쓰기</button>';
    var action = '<div class="empty__acts">' +
      (rec
        ? '<button type="button" class="btn btn--primary btn--sm" data-act="share-last">' +
          UI.icon('send') + U.shortDay(rec.date) + ' 기록 그대로 공유</button>' +
          guest +
          '<button type="button" class="linkbtn" data-act="write-log">새 일지 쓰기</button>'
        : '<button type="button" class="btn btn--primary btn--sm" data-act="write-log">' +
          UI.icon('edit') + '일지 쓰고 공유하기</button>' +
          guest) +
      '</div>';
    return UI.emptyState('community', '아직 글이 없어요',
      rec ? '지난 훈련 기록이 그대로 첫 글이 돼요.' : '오늘 훈련을 남기면 첫 글이 돼요.', action);
  }

  function filteredEmpty(topic) {
    return UI.emptyState('community', '‘' + topic + '’ 말머리 글이 아직 없어요', '다른 말머리를 골라 보거나 이 말머리로 첫 글을 남겨 보세요.',
      '<button type="button" class="btn btn--ghost btn--sm mt8" data-topicall="1">전체 글 보기</button>');
  }

  function postsHtml(state) {
    var posts = visiblePosts(state);
    if (posts.length) return posts.map(function (p) { return postCard(p, state); }).join('');
    if (!allPosts(state).length) return emptyBlock(state);
    /* 마감돼 내려간 모집 글만 남았을 때는 '글이 없다'가 아니라 이유를 알려 줍니다 */
    if (closedHiddenCount(state)) {
      return UI.emptyState('community', '지금은 모집 중인 글이 없어요',
        '정원이 다 찬 모집 글은 커뮤니티에서 자동으로 내려가요. 자리가 나면 다시 올라옵니다.',
        topicFilter === '전체' ? '' : '<button type="button" class="btn btn--ghost btn--sm mt8" data-topicall="1">전체 글 보기</button>');
    }
    return filteredEmpty(topicFilter);
  }

  function topicFilterBar() {
    return '<div class="chips topicbar" data-topicfilterbar data-tag="' + U.esc(topicFilter) + '">' +
      topicChips(topicFilter, 'data-topicfilter', true) + '</div>';
  }

  function paintTopicFilter(root, state) {
    var host = root.querySelector('[data-topicfilterbar]');
    if (host) {
      host.innerHTML = topicChips(topicFilter, 'data-topicfilter', true);
      host.setAttribute('data-tag', topicFilter);
    }
    var region = root.querySelector('[data-region="posts"]');
    if (region) region.innerHTML = postsHtml(state);
  }

  var view = {
    title: '커뮤니티',
    render: function (state) {
      var picked = state.ui.composerTopic || '자유';
      return '' +
        '<section class="card card--composer">' +
        '<div class="row">' + UI.avatar({ theme: state.me && state.me.theme }, 34) +
        '<textarea rows="1" data-composer placeholder="' + U.esc(composerHint(picked)) + '" maxlength="300">' + U.esc(state.ui.composer || '') + '</textarea></div>' +
        '<div class="topicpick-line"><span class="topicpick__lab">분류</span>' +
        '<div class="chips topicpick" data-topics data-tag="' + U.esc(picked) + '">' + topicChips(picked, 'data-topic', false) + '</div></div>' +
        meetFields(picked, state) +
        gymFields(picked, state) +
        '<div class="row between mt8"><span class="muted sm">욕설·비방은 자제해 주세요</span>' +
        '<button class="btn btn--primary btn--sm" data-act="post">' + UI.icon('send') + '올리기</button></div>' +
        '</section>' +
        topicFilterBar() +
        '<div class="seg seg--wide" data-sort>' +
        '<button class="seg__btn' + (sortMode === 'new' ? ' is-on' : '') + '" data-sortval="new">최신</button>' +
        '<button class="seg__btn' + (sortMode === 'hot' ? ' is-on' : '') + '" data-sortval="hot">인기</button>' +
        '</div>' +
        '<section class="card card--flush" data-region="posts">' +
        postsHtml(state) +
        '</section>';
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        /* 모집 날짜·시간 고르기 (bm-v1.48.0) — 칩을 누르면 칸이 채워지고 글자 한 줄이 따라옵니다 */
        var dchip = ev.target.closest('[data-viteday-quick]');
        if (dchip) {
          ev.preventDefault();
          var dInp = root.querySelector('[data-vitewhen="date"]');
          if (dInp) dInp.value = dchip.getAttribute('data-viteday-quick') || '';
          syncWhen(root, ctx);
          UI.haptic(6);
          return;
        }
        var tchip = ev.target.closest('[data-vitetime-quick]');
        if (tchip) {
          ev.preventDefault();
          var parts = String(tchip.getAttribute('data-vitetime-quick') || '').split('~');
          var sInp = root.querySelector('[data-vitewhen="start"]');
          var eInp = root.querySelector('[data-vitewhen="end"]');
          if (sInp) sInp.value = parts[0] || '';
          if (eInp) eInp.value = parts[1] || '';
          syncWhen(root, ctx);
          UI.haptic(6);
          return;
        }
        /* 게스트비 빠른 선택 칩 — 누르면 칸에 그대로 적히고, 같은 칩을 다시 누르면 지웁니다 */
        var fchip = ev.target.closest('[data-vitefee-val]');
        if (fchip) {
          ev.preventDefault();
          var fval = fchip.getAttribute('data-vitefee-val') || '';
          var finp = root.querySelector('[data-vitefield="fee"]');
          var next = (finp && finp.value === fval) ? '' : fval;
          if (finp) finp.value = next;
          ctx.actions.setComposerMeet('fee', next);
          syncFeeChips(root, next);
          UI.haptic(6);
          return;
        }
        /* 몇 명 빠른 선택 칩 (bm-v1.84.0) — 2·4·6명을 한 번에, 다시 누르면 지움 */
        var cchip = ev.target.closest('[data-vitecap-val]');
        if (cchip) {
          ev.preventDefault();
          var cval = cchip.getAttribute('data-vitecap-val') || '';
          var cinp = root.querySelector('[data-vitefield="cap"]');
          var cnext = (cinp && String(cinp.value || '').replace(/[^0-9]/g, '') === cval) ? '' : cval;
          if (cinp) cinp.value = cnext;
          ctx.actions.setComposerMeet('cap', cnext);
          syncCapChips(root, cnext);
          UI.haptic(6);
          return;
        }
        /* 말머리 고르기 (작성) — 한 개만 켜집니다 */
        /* 게스트 모집의 '어디 체육관' — 지도에서 골라 채웁니다 */
        if (ev.target.closest('[data-act="pick-gym"]')) {
          ev.preventDefault();
          openGymPicker(ctx, root);
          return;
        }

        var pick = ev.target.closest('[data-topic]');
        if (pick) {
          ev.preventDefault();
          var tag = D.normalizeTopic(pick.getAttribute('data-topic'));
          ctx.actions.setComposerTopic(tag);
          var group = pick.parentNode;
          UI.$$('.chip', group).forEach(function (b) {
            var on = b.getAttribute('data-topic') === tag;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          /* 게스트 모집일 때만 모집 입력칸을 보여 줍니다 (입력칸 포커스는 건드리지 않음) */
          var vf = root.querySelector('[data-viteform]');
          if (vf) vf.hidden = tag !== D.MEET.topic;
          /* v1.79 — '체육관 후기' 칸도 말머리를 따라 열고 닫습니다 */
          var gf = root.querySelector('[data-gymform]');
          if (gf) gf.hidden = tag !== D.GYM_REVIEW.topic;
          /* 본문 없이 모집 칸만 채워도 올라간다고 입력칸 안내도 같이 바꿉니다 */
          var hintTa = root.querySelector('[data-composer]');
          if (hintTa) hintTa.placeholder = composerHint(tag);
          UI.haptic(6);
          return;
        }
        /* 말머리 거르기 (목록) — 전체 포함 */
        var filt = ev.target.closest('[data-topicfilter]');
        if (filt) {
          ev.preventDefault();
          var picked = filt.getAttribute('data-topicfilter');
          topicFilter = picked === '전체' ? '전체' : D.normalizeTopic(picked);
          paintTopicFilter(root, ctx.store.state);
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-topicall]')) {
          ev.preventDefault();
          topicFilter = '전체';
          paintTopicFilter(root, ctx.store.state);
          return;
        }
        /* ---- 신고 · 차단 (bm-v1.55.0) — 구글 Play UGC 심사 요건 ----
         * ⋯ 를 누르면 그 글·답글 안에서 '신고'·'차단' 두 버튼이 열리고,
         * '차단'은 같은 자리에서 한 번 더 묻습니다(인라인 확인). */
        var moreBtn = ev.target.closest('[data-post-menu]');
        if (moreBtn) {
          ev.preventDefault();
          var mCard = moreBtn.closest('[data-post]');
          var mBar = mCard ? mCard.querySelector('[data-safetybar="' + moreBtn.getAttribute('data-post-menu') + '"]') : null;
          if (mBar) {
            mBar.hidden = !mBar.hidden;
            moreBtn.setAttribute('aria-expanded', mBar.hidden ? 'false' : 'true');
          }
          UI.haptic(6);
          return;
        }
        var rMore = ev.target.closest('[data-reply-menu]');
        if (rMore) {
          ev.preventDefault();
          var rLi = rMore.closest('[data-reply]');
          var rBar = rLi ? rLi.querySelector('[data-safetybar]') : null;
          if (rBar) {
            rBar.hidden = !rBar.hidden;
            rMore.setAttribute('aria-expanded', rBar.hidden ? 'false' : 'true');
          }
          UI.haptic(6);
          return;
        }
        var repBtn = ev.target.closest('[data-report]');
        if (repBtn) {
          ev.preventDefault();
          var repKind = repBtn.closest('[data-reply]') ? 'reply' : 'post';
          var repId = repBtn.getAttribute('data-target');
          var repUser = repBtn.getAttribute('data-user');
          if (!BM.safety) return;
          /* 신고는 사유를 골라 보내는 시트 하나로 끝냅니다 */
          BM.safety.openReportSheet(ctx, {
            kind: repKind, targetId: repId, targetUser: repUser,
            nick: repBtn.getAttribute('data-nick'),
            avatar: repUser ? avatarFor(ctx.store.state, repUser) : null,
            text: targetText(ctx.store.state, repKind, repId)
          });
          UI.haptic(6);
          return;
        }
        var askBtn = ev.target.closest('[data-block-ask]');
        if (askBtn) {
          ev.preventDefault();
          var askKey = askBtn.getAttribute('data-block-ask');
          var askCard = askBtn.closest('[data-post]');
          if (askCard) {
            UI.$$('[data-safetybar]', askCard).forEach(function (n) { n.hidden = true; });
            var conf = askCard.querySelector('[data-blockconfirm="' + askKey + '"]');
            if (conf) {
              conf.hidden = false;
              if (conf.scrollIntoView) conf.scrollIntoView({ block: 'nearest' });
            }
          }
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-block-no]')) {
          ev.preventDefault();
          var noBox = ev.target.closest('[data-blockconfirm]');
          if (noBox) noBox.hidden = true;
          return;
        }
        var blockYes = ev.target.closest('[data-block-yes]');
        if (blockYes) {
          ev.preventDefault();
          var bKey = blockYes.getAttribute('data-block-yes');
          if (BM.safety) BM.safety.doBlock(ctx, bKey);
          else ctx.actions.blockUser(bKey);
          return;
        }
        /* 글쓴이의 미니 라켓 → 라켓 구경 시트 — bm-v1.87.0 */
        var rkBtn = ev.target.closest('[data-rk-person]');
        if (rkBtn) {
          ev.preventDefault();
          var rkKey = rkBtn.getAttribute('data-rk-person');
          if (rkKey && BM.views.matching && BM.views.matching.openRacketPeek) {
            BM.views.matching.openRacketPeek(ctx, rkKey);
          }
          return;
        }
        /* 글쓴이 아바타·닉네임을 누르면 프로필(친구 상태·채팅 — 친구 추가는 친구 코드로만, v1.38) */
        var author = ev.target.closest('[data-author]');
        if (author) {
          ev.preventDefault();
          var key = author.getAttribute('data-author');
          if (key && BM.views.profile) BM.views.profile.open(key, ctx);
          return;
        }
        /* 모집 글의 참여 버튼 — bm-v1.43.0
         *  · apply: 신청 편지지 시트 (바로 단체방에 들어가지 않습니다)
         *  · room: 수락된 게스트·글쓴이가 단체방을 엽니다
         *  · pending/rejected/closed: 누를 수 없는 상태 */
        var vite = ev.target.closest('[data-vite-group]');
        if (vite) {
          ev.preventDefault();
          var vst = ctx.store.state;
          var meKey = (vst.me && vst.me.key) || '';
          if (!meKey) { UI.toast('로그인하면 게스트 모집에 신청하고 단체방에서 대화할 수 있어요', 'error'); return; }
          var gid = vite.getAttribute('data-vite-group');
          var go = vite.getAttribute('data-vite-go') || 'room';
          if (go === 'apply') { applySheet(ctx, gid); return; }
          if (go === 'pending') { UI.toast('신청했어요 · 글쓴이가 수락하면 단체방이 열려요'); return; }
          if (go === 'rejected') { UI.toast('이 글의 신청이 거절됐어요'); return; }
          if (go === 'closed') { UI.toast('정원이 다 찼어요 · 자리가 나면 다시 올라옵니다'); return; }
          var gpost = (vst.data.posts || []).filter(function (x) { return String(x.id) === String(gid); })[0] || null;
          var res = ctx.actions.openGroupChat(gid, '');
          if (!res || !res.ok) {
            UI.toast(res && res.reason === 'not_member' ? '수락되면 단체방에서 대화할 수 있어요' : '이 글의 단체방을 찾지 못했어요', 'error');
            return;
          }
          ctx.actions.markChatRead(res.roomId, '');
          UI.haptic(8);
          return;
        }
        /* 글쓴이의 참여자 명단 보기 */
        var mlist = ev.target.closest('[data-vite-members]');
        if (mlist) {
          ev.preventDefault();
          openMembers(ctx, mlist.getAttribute('data-vite-members'));
          return;
        }
        /* 내 글 삭제 — 먼저 그 글 안에서 한 번 더 물어보고(인라인 확인), '삭제'를 누를 때만 지웁니다 */
        var delBtn = ev.target.closest('[data-post-del]');
        if (delBtn) {
          ev.preventDefault();
          var dcard = delBtn.closest('[data-post]');
          var dbar = dcard ? dcard.querySelector('[data-delbar]') : null;
          if (dbar) {
            dbar.hidden = !dbar.hidden;
            delBtn.setAttribute('aria-expanded', dbar.hidden ? 'false' : 'true');
            if (!dbar.hidden && dbar.scrollIntoView) dbar.scrollIntoView({ block: 'nearest' });
          }
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-act="post-del-no"]')) {
          ev.preventDefault();
          var noBar = ev.target.closest('[data-delbar]');
          if (noBar) noBar.hidden = true;
          var noCard = noBar ? noBar.closest('[data-post]') : null;
          var noBtn = noCard ? noCard.querySelector('[data-post-del]') : null;
          if (noBtn) noBtn.setAttribute('aria-expanded', 'false');
          return;
        }
        var delYes = ev.target.closest('[data-act="post-del-yes"]');
        if (delYes) {
          ev.preventDefault();
          var dres = ctx.actions.deletePost(delYes.getAttribute('data-del-post'));
          if (dres && dres.ok) { UI.toast('글을 삭제했어요'); UI.haptic(12); }
          else if (dres && dres.reason === 'not_mine') UI.toast('내 글만 삭제할 수 있어요', 'error');
          else if (dres && dres.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
          else UI.toast('글을 찾지 못했어요', 'error');
          return;
        }
        var like = ev.target.closest('[data-like]');
        if (like) {
          ev.preventDefault();
          /* 손끝 반응은 CSS가 즉시, 숫자는 여기서 바로 */
          var on = !like.classList.contains('is-on');
          like.classList.toggle('is-on', on);
          var cnt = like.querySelector('[data-like-count]');
          if (cnt) cnt.textContent = Math.max(0, (+cnt.textContent || 0) + (on ? 1 : -1));
          UI.haptic(8);
          var likeRes = ctx.actions.toggleLike(like.getAttribute('data-like'));
          /* bm-v1.99.0 — 후기 주인에게 하트가 갔을 때만 한 줄 알려 줍니다 */
          U.when(likeRes, function (r) {
            if (r && r.reviewHeart && r.reviewHeart.given) {
              UI.toast('❤️ 후기 주인에게 하트 +1을 전했어요 · 하루 3개까지');
            }
          });
          return;
        }
        var toggle = ev.target.closest('[data-toggle-reply]');
        if (toggle) {
          ev.preventDefault();
          var pid = toggle.getAttribute('data-toggle-reply');
          openReplies[pid] = !openReplies[pid];
          ctx.refresh();
          return;
        }
        var sortBtn = ev.target.closest('[data-sortval]');
        if (sortBtn) {
          ev.preventDefault();
          sortMode = sortBtn.getAttribute('data-sortval');
          ctx.refresh();
          return;
        }
        /* 빈 화면 — 지난 기록 원탭 공유 / 일지 쓰기 */
        if (ev.target.closest('[data-act="share-last"]')) {
          ev.preventDefault();
          var rec = shareableRecord(ctx.store.state);
          if (!rec) { ctx.actions.setTab('log'); return; }
          var shared = ctx.actions.shareLogToCommunity(rec.id);
          if (shared.ok) { UI.toast('지난 기록을 공유했어요'); UI.haptic(10); }
          else if (shared.reason === 'already') UI.toast('이미 공유한 기록이에요');
          else if (shared.reason === 'no_login') UI.toast('로그인하면 커뮤니티에 공유할 수 있어요');
          else if (shared.reason === 'locked') UI.toast('잠시만요, 올리는 중이에요');
          else UI.toast('공유할 기록이 없어요');
          return;
        }
        if (ev.target.closest('[data-act="write-log"]')) {
          ev.preventDefault();
          ctx.actions.setTab('log');
          return;
        }
        /* 빈 화면 '게스트 모집 글쓰기' (2026-11-23)
         * 분류를 게스트 모집으로 바꾸면 모집 입력칸(언제·어디·몇 명)이 열립니다.
         * 이어서 작성 카드로 스크롤하고 글쓰기 칸에 커서를 놓습니다(본문은 비워 둔 채). */
        if (ev.target.closest('[data-act="write-guest"]')) {
          ev.preventDefault();
          ctx.actions.setComposerTopic(D.MEET.topic);
          UI.haptic(8);
          var curRoot = root;
          var go = function () {
            var card = curRoot.querySelector('.card--composer');
            var ta = curRoot.querySelector('[data-composer]');
            var when = curRoot.querySelector('[data-vitefield="when"]');
            if (card && card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            /* 글은 사람이 쓰고, 모집 칸(언제·어디·몇 명)은 바로 아래에 열려 있습니다 */
            var target = ta || when;
            if (target && target.focus) {
              try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
            }
          };
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
          else go();
          return;
        }
        /* 체육관 후기 칩 — 누르면 그 칸만 바뀌고, 같은 칩을 다시 누르면 비웁니다 (bm-v1.79.0) */
        var gp = ev.target.closest('[data-gympick]');
        if (gp) {
          ev.preventDefault();
          var gKey = gp.getAttribute('data-gympick');
          var gVal = gp.getAttribute('data-gymval') || '';
          var cur = D.normalizeGymReview((ctx.store.state.ui && ctx.store.state.ui.composerGym) || {});
          var nextVal = cur[gKey] === gVal ? '' : gVal;
          ctx.actions.setComposerGym(gKey, nextVal);
          var row = gp.closest('[data-gymrow]');
          if (row) {
            UI.$$('[data-gympick]', row).forEach(function (b) {
              var on = !!nextVal && b.getAttribute('data-gymval') === nextVal;
              b.classList.toggle('is-on', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
          }
          UI.haptic(6);
          return;
        }
        if (ev.target.closest('[data-act="post"]')) {
          ev.preventDefault();
          /* 올리기 연타: 첫 번째로 글이 올라가며 입력칸이 비는데, 두 번째 누름이
           * '내용을 입력해 주세요'로 보이면 방금 글이 안 올라간 줄 알게 됩니다.
           * 올린 직후 0.8초 안의 누름은 조용히 무시합니다(글이 중복 저장되지도 않습니다). */
          if (Date.now() - lastPostAt < 800) return;
          var ta = root.querySelector('[data-composer]');
          var text = ta ? ta.value : '';
          var st = ctx.store.state;
          var res = ctx.actions.createPost(text, st.ui.composerTopic, st.ui.composerMeet, st.ui.composerGym);
          if (res.ok) {
            lastPostAt = Date.now();
            if (ta) ta.value = '';
            /* 모집 입력칸도 같이 비웁니다 (다음 글은 다시 자유) */
            UI.$$('[data-vitefield]', root).forEach(function (inp) { inp.value = ''; });
            UI.$$('[data-vitewhen]', root).forEach(function (inp) {
              inp.value = inp.getAttribute('data-vitewhen') === 'date' ? U.ymd() : '';
            });
            paintWhen(root, { date: U.ymd(), start: '', end: '' });
            syncFeeChips(root, '');
            syncCapChips(root, '');
            var vf = root.querySelector('[data-viteform]');
            if (vf) vf.hidden = true;
            /* v1.79 — 체육관 후기 칸도 비우고 접습니다 */
            UI.$$('[data-gymfield]', root).forEach(function (inp) { inp.value = ''; });
            UI.$$('[data-gympick]', root).forEach(function (b) {
              b.classList.remove('is-on');
              b.setAttribute('aria-pressed', 'false');
            });
            var gf = root.querySelector('[data-gymform]');
            if (gf) gf.hidden = true;
            /* 올린 글이 지금 거르는 말머리와 다르면 전체로 돌아가 방금 글을 보여 줍니다 */
            if (topicFilter !== '전체' && topicFilter !== res.topic) {
              topicFilter = '전체';
              paintTopicFilter(root, ctx.store.state);
            }
            UI.toast(res.gym ? D.GYM_REVIEW.label + '를 올렸어요' : (res.meet ? D.MEET.cardLabel + '을 올렸어요' : '글을 올렸어요')); UI.haptic(10);
          }
          else if (res.reason === 'empty') UI.toast('내용을 입력해 주세요');
          else if (res.reason === 'locked') UI.toast('잠시만요, 올리는 중이에요');
          return;
        }
      });

      root.addEventListener('input', function (ev) {
        var ta = ev.target.closest('[data-composer]');
        if (ta) ctx.actions.setComposer(ta.value);
        /* 게스트 모집 입력 — 화면을 다시 그리지 않고 값만 담아 둡니다 */
        var vf = ev.target.closest('[data-vitefield]');
        if (vf) ctx.actions.setComposerMeet(vf.getAttribute('data-vitefield'), vf.value);
        /* 일시를 손으로 고쳐도 날짜·시간 칸과 칩이 따라갑니다 */
        if (vf && vf.getAttribute('data-vitefield') === 'when') whenFromText(root, ctx, vf.value);
        /* 게스트비를 손으로 고쳐도 칩의 켜짐이 따라갑니다 */
        if (vf && vf.getAttribute('data-vitefield') === 'fee') syncFeeChips(root, vf.value);
        /* 체육관 후기의 체육관 이름 — 화면을 다시 그리지 않고 값만 담아 둡니다 */
        var gfInp = ev.target.closest('[data-gymfield]');
        if (gfInp) ctx.actions.setComposerGym(gfInp.getAttribute('data-gymfield'), gfInp.value);
        /* 몇 명을 손으로 고쳐도 2·4·6명 칩의 켜짐이 따라갑니다 (bm-v1.84.0) */
        if (vf && vf.getAttribute('data-vitefield') === 'cap') syncCapChips(root, vf.value);
        var ri = ev.target.closest('[data-reply-input]');
        if (ri) replyDrafts[ri.getAttribute('data-reply-input')] = ri.value;
      }, { passive: true });

      /* 달력·시간 칸을 고르면(change) 글자 한 줄이 바로 바뀝니다 */
      root.addEventListener('change', function (ev) {
        if (!ev.target.closest('[data-vitewhen]')) return;
        syncWhen(root, ctx);
        UI.haptic(6);
      });

      root.addEventListener('submit', function (ev) {
        var form = ev.target.closest('[data-reply-form]');
        if (!form) return;
        ev.preventDefault();
        var pid = form.getAttribute('data-reply-form');
        var input = form.querySelector('[data-reply-input]');
        var res = ctx.actions.addReply(pid, input ? input.value : '');
        if (res.ok) {
          replyDrafts[pid] = '';
          if (input) input.value = '';
          openReplies[pid] = true;
          UI.haptic(8);
        }
      });
    },

    update: function (root, state, ctx) {
      var region = root.querySelector('[data-region="posts"]');
      if (!region) return;
      /* 답글 입력 중이면 포커스/글자를 잃지 않게 잠시 보존 */
      var active = document.activeElement;
      var keep = null;
      if (active && active.matches && active.matches('[data-reply-input]')) {
        keep = { pid: active.getAttribute('data-reply-input'), value: active.value, pos: active.selectionStart };
      }
      /* 말머리 칩 상태도 함께 맞춥니다 (올린 뒤 작성 말머리는 자유로 돌아갑니다) */
      var filterHost = root.querySelector('[data-topicfilterbar]');
      if (filterHost && filterHost.getAttribute('data-tag') !== topicFilter) {
        filterHost.innerHTML = topicChips(topicFilter, 'data-topicfilter', true);
        filterHost.setAttribute('data-tag', topicFilter);
      }
      var pickTag = state.ui.composerTopic || '자유';
      var pickHost = root.querySelector('[data-topics]');
      if (pickHost && pickHost.getAttribute('data-tag') !== pickTag) {
        pickHost.innerHTML = topicChips(pickTag, 'data-topic', false);
        pickHost.setAttribute('data-tag', pickTag);
      }
      /* 모집 입력칸은 말머리를 따라갑니다 (값은 입력칸이 그대로 들고 있음) */
      var viteHost = root.querySelector('[data-viteform]');
      if (viteHost) viteHost.hidden = pickTag !== D.MEET.topic;
      var gymHost = root.querySelector('[data-gymform]');
      if (gymHost) gymHost.hidden = pickTag !== D.GYM_REVIEW.topic;
      var hint = root.querySelector('[data-composer]');
      if (hint) hint.placeholder = composerHint(pickTag);
      region.innerHTML = postsHtml(state);
      if (keep) {
        var again = region.querySelector('[data-reply-input="' + keep.pid + '"]');
        if (again) {
          again.focus();
          again.value = keep.value;
          try { again.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* noop */ }
        }
      }
    },

    _openReplies: openReplies,
    /* 채팅 단체방에서도 명단·받은 신청 시트를 열 수 있게 (bm-v1.43.0) */
    openMembers: openMembers,
    _membersBody: membersBody,
    /* 테스트·점검용 (화면 안에서만 쓰는 말머리 상태) */
    _visiblePosts: visiblePosts,
    _setTopicFilter: function (t) { topicFilter = !t || t === '전체' ? '전체' : D.normalizeTopic(t); return topicFilter; },
    _inquiryDraft: inquiryDraft,
    _waitDraft: waitDraft,
    _applySheet: applySheet,
    _feeChips: feeChips,
    _syncFeeChips: syncFeeChips,
    _meetFields: meetFields,
    _whenQuickChips: whenQuickChips,
    _whenTimeChips: whenTimeChips,
    _syncWhen: syncWhen,
    _paintWhen: paintWhen,
    _meetStatus: D.meetStatus,
    /* v1.79 — 체육관 후기(작성 칸·글 카드) */
    _gymFields: gymFields,
    _gymReviewCard: gymReviewCard,
    _postBodyText: postBodyText
  };

  BM.views.community = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
