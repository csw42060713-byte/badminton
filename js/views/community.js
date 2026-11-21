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
    return D.normalizeTopic(topic) === D.MEET.topic
      ? D.MEET.topic + ' 한마디 (비워 두어도 올라가요)'
      : '오늘 경기 어땠어요? 한 줄 남겨보세요';
  }

  /* 말머리 칩 한 줄 (말머리 고르기 · 목록 거르기에서 같은 모양을 씁니다)
   * 거르기의 '전체'는 고른 조건이 아니라 '조건 없음'이라 색을 달리해 구분합니다. */
  function topicChips(current, attr, all) {
    var vals = (all ? ['전체'] : []).concat(D.POST_TOPICS);
    return vals.map(function (t) {
      var on = t === current;
      var whole = all && t === '전체';
      return '<button type="button" class="chip chip--sm' + (whole ? ' chip--all' : '') + (on ? ' is-on' : '') + '" ' + attr + '="' + U.esc(t) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + (whole && on ? UI.icon('check', 'chip__ic') : '') + U.esc(t) + '</button>';
    }).join('');
  }

  function visiblePosts(state) {
    var posts = (state.data.posts || []).slice();
    if (topicFilter !== '전체') {
      posts = posts.filter(function (p) { return (p.topic || '자유') === topicFilter; });
    }
    if (sortMode === 'hot') posts.sort(function (a, b) { return (b.likes + b.replies.length) - (a.likes + a.replies.length); });
    return posts;
  }

  function allPosts(state) { return state.data.posts || []; }

  function avatarFor(state, userKey) {
    var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === userKey; })[0];
    if (mp) return mp;
    if (state.me && state.me.key === userKey) return { theme: state.me.theme, avatar: (state.me.theme && state.me.theme.avatar) || '🏸' };
    return '🏸';
  }

  function postCard(p, state) {
    var open = !!openReplies[p.id];
    var me = (state.me && state.me.key) || '';
    /* 내가 쓴 글에만 '삭제' 입구를 붙입니다 (bm-v1.40.1) — 지우기 전에 그 글 안에서 한 번 더 확인합니다 */
    var mine = !!me && String(p.userKey || '') === String(me);
    /* 본문을 비우고 모집 정보만 적은 글은 빈 문단을 그리지 않습니다 (bm-v1.39.1) */
    var body = String(p.text == null ? '' : p.text);
    return '<article class="post" data-post="' + U.esc(p.id) + '">' +
      '<header class="post__head">' +
      '<button type="button" class="post__author" data-author="' + U.esc(p.userKey) + '" aria-label="' + U.esc(p.nick) + ' 프로필 보기">' +
      UI.avatar(avatarFor(state, p.userKey), 40) +
      '<span class="post__who"><strong>' + U.esc(p.nick) + '</strong>' +
      '<time>' + U.timeAgo(p.createdAt) + '</time></span></button>' +
      '<span class="pill pill--ghost post__topic">' + U.esc(p.topic || '자유') + '</span>' +
      (mine
        ? '<button type="button" class="post__del" data-post-del="' + U.esc(p.id) + '" aria-expanded="false"' +
          ' aria-label="내 글 삭제" title="삭제">' + UI.icon('trash') + '</button>'
        : '') +
      '</header>' +
      (mine
        ? '<div class="post__delbar" data-delbar="' + U.esc(p.id) + '" hidden>' +
          '<p class="post__delbar-t">이 글을 삭제할까요? 지우면 되돌릴 수 없어요.</p>' +
          '<div class="row gap8">' +
          '<button type="button" class="btn btn--ghost btn--sm grow" data-act="post-del-no">취소</button>' +
          '<button type="button" class="btn btn--danger btn--sm grow" data-act="post-del-yes" data-del-post="' + U.esc(p.id) + '">' + UI.icon('trash') + '삭제</button>' +
          '</div></div>'
        : '') +
      (body.trim() ? '<p class="post__text">' + U.esc(body).replace(/\n/g, '<br>') + '</p>' : '') +
      (p.meet ? meetCard(p, state) : '') +
      '<footer class="post__foot">' +
      '<button class="react' + (p.likedByMe ? ' is-on' : '') + '" data-like="' + U.esc(p.id) + '" aria-pressed="' + (p.likedByMe ? 'true' : 'false') + '">' +
      UI.icon('heart') + '<span data-like-count>' + p.likes + '</span></button>' +
      '<button class="react" data-toggle-reply="' + U.esc(p.id) + '">' + UI.icon('community') +
      '<span>' + (p.replies.length || '답글') + '</span></button>' +
      '</footer>' +
      (open ? '<div class="replies">' +
        (p.replies.length ? '<ul>' + p.replies.map(function (r) {
          return '<li><div class="replies__who"><strong>' + U.esc(r.nick) + '</strong>' +
            (r.mentor ? '<span class="pill pill--ok replies__mentor">멘토 조언</span>' : '') +
            '<time>' + U.timeAgo(r.createdAt) + '</time></div><p>' + U.esc(r.text) + '</p></li>';
        }).join('') + '</ul>' : '<p class="muted sm">첫 답글을 남겨 보세요.</p>') +
        '<form class="replyform" data-reply-form="' + U.esc(p.id) + '">' +
        '<input type="text" maxlength="200" placeholder="' + U.esc((state.me && state.me.nick) || '나') + '(으)로 답글" data-reply-input="' + U.esc(p.id) + '" value="' + U.esc(replyDrafts[p.id] || '') + '">' +
        '<button class="btn btn--sm btn--primary" type="submit" aria-label="답글 보내기">' + UI.icon('send') + '</button></form>' +
        '</div>' : '') +
      '</article>';
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
   * `참여 문의`는 작성자 1:1 DM이 아니라 이 글 전용 단체방을 엽니다.
   * v1.29: 정원이 차면 자동으로 '마감' 배지 + 버튼이 '대기 문의'로 바뀌고,
   *        글쓴이에게는 '참여자 N명'과 명단 보기를 보여 줍니다.
   *        (참여자 = 글쓴이 + 단체방에 한마디 남긴 사람 — 따로 행을 만들지 않습니다) */
  function meetCard(p, state) {
    var m = p.meet;
    var me = (state.me && state.me.key) || '';
    var st = D.meetStatus(state.data.idx, p, me);
    var mine = st.mine;
    var joined = (state.data.threads || []).some(function (t) {
      return t.kind === 'group' && String(t.roomId) === String(p.id);
    });
    /* 정원이 있으면 지금 인원을 함께 (글쓴이는 '참여자 N명'으로) */
    var capLine = st.cap
      ? (mine ? '참여자 ' + st.count + '명' : '참여 ' + st.count + '/' + st.cap + '명')
      : (mine && st.guests ? '참여자 ' + st.count + '명' : '');
    var label = mine ? D.MEET.openLabel : (st.closed ? D.MEET.waitLabel : D.MEET.joinLabel);
    return '<div class="vite' + (st.closed ? ' vite--closed' : '') + '">' +
      '<div class="vite__info">' +
      '<p class="vite__t">' + UI.icon('bolt') + U.esc(D.MEET.cardLabel) +
      (m.cap ? '<b>' + U.esc(m.cap) + '명</b>' : '') +
      (st.closed ? '<span class="pill pill--closed">' + U.esc(D.MEET.closedLabel) + '</span>' : '') + '</p>' +
      '<p class="vite__row">' + UI.icon('clock') + '<span>' + U.esc(m.when || '일시는 문의해서 정해요') + '</span></p>' +
      '<p class="vite__row vite__row--place">' + placeHtml(m.place) + '</p>' +
      (m.fee ? '<p class="vite__row vite__row--fee">' + UI.icon('coin', 'vite__fee-ic') + '<span>' + U.esc(D.meetFeeText(m)) + '</span></p>' : '') +
      (capLine
        ? '<p class="vite__row vite__row--cap">' + UI.icon('users') + '<span>' + U.esc(capLine) + '</span>' +
          (mine && st.members.length
            ? '<button type="button" class="linkbtn vite__members" data-vite-members="' + U.esc(p.id) + '"' +
              ' aria-label="참여자 명단 보기">명단 보기</button>'
            : '') + '</p>'
        : '') +
      '</div>' +
      (p.userKey
        ? '<button type="button" class="btn btn--primary btn--sm vite__btn" data-vite-group="' + U.esc(p.id) + '"' +
          ' aria-label="' + U.esc(p.nick) + '님 글의 ' + U.esc(D.MEET.roomLabel) + ' 열기">' +
          UI.icon('users') + '<span>' + U.esc(label) + '</span>' +
          (joined ? '<i class="vite__dot" aria-hidden="true"></i>' : '') + '</button>'
        : '') +
      '</div>';
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
   * 명단은 새로 저장하지 않고 이 글 단체방에 한마디 남긴 사람들로 그립니다. */
  function openMembers(ctx, postId) {
    var state = ctx.store.state;
    var post = (state.data.posts || []).filter(function (p) { return String(p.id) === String(postId); })[0];
    if (!post) { UI.toast('글을 찾지 못했어요', 'error'); return; }
    var st = D.meetStatus(state.data.idx, post, state.me && state.me.key);
    var rows = st.members.map(function (mem) {
      var isAuthor = String(mem.key) === String(post.userKey);
      return '<li><button type="button" class="members__who" data-vite-member="' + U.esc(mem.key) + '">' +
        UI.avatar(UI.person(state, mem.key), 34) +
        '<span><strong>' + U.esc(mem.nick) + '</strong>' +
        '<small>' + (isAuthor ? '글쓴이' : '참여 문의') + (mem.me ? ' · 나' : '') + '</small></span></button></li>';
    }).join('');
    var body = '<div class="members">' +
      '<p class="members__t">' + UI.icon('users') + '참여자 <b>' + st.count + '명</b>' +
      (st.cap ? ' · 정원 ' + st.cap + '명' : '') +
      (st.closed ? ' · <b>' + U.esc(D.MEET.closedLabel) + '</b>' : '') + '</p>' +
      (rows ? '<ul class="members__list">' + rows + '</ul>' : '') +
      (st.guests ? '' : '<p class="members__empty">아직 참여 문의가 없어요. 단체방에 한마디 남긴 사람부터 여기에 보여요.</p>') +
      '</div>';
    UI.openSheet({
      title: '참여자 명단',
      body: body,
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-vite-member]');
          if (!b) return;
          ev.preventDefault();
          var key = b.getAttribute('data-vite-member');
          if (key && BM.views.profile) BM.views.profile.open(key, ctx);
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

  function meetFields(picked, state) {
    var m = (state.ui && state.ui.composerMeet) || {};
    var on = picked === D.MEET.topic;
    return '<div class="viteform" data-viteform' + (on ? '' : ' hidden') + '>' +
      '<p class="viteform__t">' + UI.icon('bolt') + U.esc(D.MEET.cardLabel) + ' <small>비워 두어도 올라가요</small></p>' +
      '<div class="viteform__grid">' +
      '<label class="viteform__f"><span>언제</span>' +
      '<input type="text" maxlength="30" data-vitefield="when" enterkeyhint="next" placeholder="11/21(금) 19:00" value="' + U.esc(m.when || '') + '"></label>' +
      '<label class="viteform__f"><span>몇 명</span>' +
      '<input type="text" inputmode="numeric" maxlength="3" data-vitefield="cap" enterkeyhint="next" placeholder="6" value="' + U.esc(m.cap || '') + '"></label>' +
      '<label class="viteform__f viteform__f--wide"><span>어디 체육관</span>' +
      '<input type="text" maxlength="30" data-vitefield="place" placeholder="동네 체육관 이름" value="' + U.esc(m.place || '') + '">' +
      '<button type="button" class="viteform__pick" data-act="pick-gym">' + UI.icon('pin') + '지도에서 고르기</button></label>' +
      '<label class="viteform__f viteform__f--wide"><span>게스트비</span>' +
      '<input type="text" maxlength="12" data-vitefield="fee" enterkeyhint="done" placeholder="없음 또는 1만원" value="' + U.esc(m.fee || '') + '"></label>' +
      '<div class="chips viteform__chips" data-vitefee>' + feeChips(m.fee) + '</div>' +
      '</div></div>';
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
   * 한 번에 올리는 버튼을 둡니다. 올릴 일지가 없으면 일지 쓰기로 보냅니다. */
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
    var action = '<div class="empty__acts">' +
      (rec
        ? '<button type="button" class="btn btn--primary btn--sm" data-act="share-last">' +
          UI.icon('send') + U.shortDay(rec.date) + ' 기록 그대로 공유</button>' +
          '<button type="button" class="linkbtn" data-act="write-log">새 일지 쓰기</button>'
        : '<button type="button" class="btn btn--primary btn--sm" data-act="write-log">' +
          UI.icon('edit') + '일지 쓰고 공유하기</button>') +
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
        /* 글쓴이 아바타·닉네임을 누르면 프로필(친구 상태·채팅 — 친구 추가는 친구 코드로만, v1.38) */
        var author = ev.target.closest('[data-author]');
        if (author) {
          ev.preventDefault();
          var key = author.getAttribute('data-author');
          if (key && BM.views.profile) BM.views.profile.open(key, ctx);
          return;
        }
        /* 모집 글의 참여 문의 — 작성자 1:1 DM이 아니라 글 전용 단체방을 엽니다.
         * (내가 쓴 글이어도 같은 방을 열어 대화를 이어 갑니다.) */
        var vite = ev.target.closest('[data-vite-group]');
        if (vite) {
          ev.preventDefault();
          var vst = ctx.store.state;
          var meKey = (vst.me && vst.me.key) || '';
          if (!meKey) { UI.toast('로그인하면 단체방에서 참여 대화를 할 수 있어요', 'error'); return; }
          var gid = vite.getAttribute('data-vite-group');
          var gpost = (vst.data.posts || []).filter(function (x) { return String(x.id) === String(gid); })[0] || null;
          /* 내가 올린 게스트 모집 글이면 인사 문구를 미리 채우지 않습니다 (방장 인사) */
          var mine = !!(gpost && gpost.userKey === meKey);
          /* 정원이 찬 글은 '대기 문의'로 들어옵니다 (문구도 대기로) */
          var gstatus = gpost ? D.meetStatus(vst.data.idx, gpost, meKey) : null;
          var draft = '';
          if (!mine && gpost) draft = (gstatus && gstatus.closed) ? waitDraft(gpost) : inquiryDraft(gpost);
          var res = ctx.actions.openGroupChat(gid, draft);
          if (!res || !res.ok) { UI.toast('이 글의 단체방을 찾지 못했어요', 'error'); return; }
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
          ctx.actions.toggleLike(like.getAttribute('data-like'));
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
        if (ev.target.closest('[data-act="post"]')) {
          ev.preventDefault();
          /* 올리기 연타: 첫 번째로 글이 올라가며 입력칸이 비는데, 두 번째 누름이
           * '내용을 입력해 주세요'로 보이면 방금 글이 안 올라간 줄 알게 됩니다.
           * 올린 직후 0.8초 안의 누름은 조용히 무시합니다(글이 중복 저장되지도 않습니다). */
          if (Date.now() - lastPostAt < 800) return;
          var ta = root.querySelector('[data-composer]');
          var text = ta ? ta.value : '';
          var st = ctx.store.state;
          var res = ctx.actions.createPost(text, st.ui.composerTopic, st.ui.composerMeet);
          if (res.ok) {
            lastPostAt = Date.now();
            if (ta) ta.value = '';
            /* 모집 입력칸도 같이 비웁니다 (다음 글은 다시 자유) */
            UI.$$('[data-vitefield]', root).forEach(function (inp) { inp.value = ''; });
            syncFeeChips(root, '');
            var vf = root.querySelector('[data-viteform]');
            if (vf) vf.hidden = true;
            /* 올린 글이 지금 거르는 말머리와 다르면 전체로 돌아가 방금 글을 보여 줍니다 */
            if (topicFilter !== '전체' && topicFilter !== res.topic) {
              topicFilter = '전체';
              paintTopicFilter(root, ctx.store.state);
            }
            UI.toast(res.meet ? D.MEET.cardLabel + '을 올렸어요' : '글을 올렸어요'); UI.haptic(10);
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
        /* 게스트비를 손으로 고쳐도 칩의 켜짐이 따라갑니다 */
        if (vf && vf.getAttribute('data-vitefield') === 'fee') syncFeeChips(root, vf.value);
        var ri = ev.target.closest('[data-reply-input]');
        if (ri) replyDrafts[ri.getAttribute('data-reply-input')] = ri.value;
      }, { passive: true });

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
    /* 테스트·점검용 (화면 안에서만 쓰는 말머리 상태) */
    _visiblePosts: visiblePosts,
    _setTopicFilter: function (t) { topicFilter = !t || t === '전체' ? '전체' : D.normalizeTopic(t); return topicFilter; },
    _inquiryDraft: inquiryDraft,
    _waitDraft: waitDraft,
    _feeChips: feeChips,
    _syncFeeChips: syncFeeChips,
    _meetStatus: D.meetStatus
  };

  BM.views.community = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
