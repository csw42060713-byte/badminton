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
  var topicFilter = '전체';   /* 상단 말머리 칩 — 전체 / 자유 / 후기 / 번개 / 용품 / 일지 */

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
    return '<article class="post" data-post="' + U.esc(p.id) + '">' +
      '<header class="post__head">' +
      '<button type="button" class="post__author" data-author="' + U.esc(p.userKey) + '" aria-label="' + U.esc(p.nick) + ' 프로필 보기">' +
      UI.avatar(avatarFor(state, p.userKey), 40) +
      '<span class="post__who"><strong>' + U.esc(p.nick) + '</strong>' +
      '<time>' + U.timeAgo(p.createdAt) + '</time></span></button>' +
      '<span class="pill pill--ghost post__topic">' + U.esc(p.topic || '자유') + '</span></header>' +
      '<p class="post__text">' + U.esc(p.text).replace(/\n/g, '<br>') + '</p>' +
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

  /* ---------- 번개 모집 ----------
   * 글 위에 일시·장소·인원을 스포츠 앱처럼 한 카드로 묶고,
   * `참여 문의`는 작성자 1:1 DM이 아니라 이 글 전용 단체방을 엽니다. */
  function meetCard(p, state) {
    var m = p.meet;
    var me = (state.me && state.me.key) || '';
    var mine = !!me && p.userKey === me;
    var joined = (state.data.threads || []).some(function (t) {
      return t.kind === 'group' && String(t.roomId) === String(p.id);
    });
    return '<div class="vite">' +
      '<div class="vite__info">' +
      '<p class="vite__t">' + UI.icon('bolt') + U.esc(D.MEET.cardLabel) +
      (m.cap ? '<b>' + U.esc(m.cap) + '명</b>' : '') + '</p>' +
      '<p class="vite__row">' + UI.icon('clock') + '<span>' + U.esc(m.when || '일시는 문의해서 정해요') + '</span></p>' +
      '<p class="vite__row">' + UI.icon('pin') + '<span>' + U.esc(m.place || '장소는 문의해서 정해요') + '</span></p>' +
      '</div>' +
      (p.userKey
        ? '<button type="button" class="btn btn--primary btn--sm vite__btn" data-vite-group="' + U.esc(p.id) + '"' +
          ' aria-label="' + U.esc(p.nick) + '님 글의 ' + U.esc(D.MEET.roomLabel) + ' 열기">' +
          UI.icon('users') + '<span>' + U.esc(mine ? D.MEET.openLabel : D.MEET.joinLabel) + '</span>' +
          (joined ? '<i class="vite__dot" aria-hidden="true"></i>' : '') + '</button>'
        : '') +
      '</div>';
  }

  /* 참여 문의 문구 — 한 줄 입력창에 들어가도록 날짜까지만(길면 생략) */
  function inquiryDraft(post) {
    var when = post && post.meet && post.meet.when ? String(post.meet.when) : '';
    if (when.length > 16) when = '';
    return D.MEET.topic + ' 참여하고 싶어요!' + (when ? ' (' + when + ')' : '');
  }

  /* 말머리가 '번개'일 때만 보이는 선택 입력칸 (전부 비워 두어도 그냥 글이 됩니다) */
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
      '<input type="text" maxlength="30" data-vitefield="place" placeholder="동네 체육관 이름" value="' + U.esc(m.place || '') + '"></label>' +
      '</div></div>';
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
        '<textarea rows="1" data-composer placeholder="오늘 경기 어땠어요? 한 줄 남겨보세요" maxlength="300">' + U.esc(state.ui.composer || '') + '</textarea></div>' +
        '<div class="chips topicpick" data-topics data-tag="' + U.esc(picked) + '">' + topicChips(picked, 'data-topic', false) + '</div>' +
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
        /* 말머리 고르기 (작성) — 한 개만 켜집니다 */
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
          /* 번개일 때만 모집 입력칸을 보여 줍니다 (입력칸 포커스는 건드리지 않음) */
          var vf = root.querySelector('[data-viteform]');
          if (vf) vf.hidden = tag !== D.MEET.topic;
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
        /* 글쓴이 아바타·닉네임을 누르면 프로필(친구 추가·채팅) */
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
          /* 내가 올린 번개면 인사 문구를 미리 채우지 않습니다 (방장 인사) */
          var mine = !!(gpost && gpost.userKey === meKey);
          var res = ctx.actions.openGroupChat(gid, mine ? '' : inquiryDraft(gpost));
          if (!res || !res.ok) { UI.toast('이 글의 단체방을 찾지 못했어요', 'error'); return; }
          ctx.actions.markChatRead(res.roomId, '');
          UI.haptic(8);
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
          var ta = root.querySelector('[data-composer]');
          var text = ta ? ta.value : '';
          var st = ctx.store.state;
          var res = ctx.actions.createPost(text, st.ui.composerTopic, st.ui.composerMeet);
          if (res.ok) {
            if (ta) ta.value = '';
            /* 모집 입력칸도 같이 비웁니다 (다음 글은 다시 자유) */
            UI.$$('[data-vitefield]', root).forEach(function (inp) { inp.value = ''; });
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
        /* 번개 모집 입력 — 화면을 다시 그리지 않고 값만 담아 둡니다 */
        var vf = ev.target.closest('[data-vitefield]');
        if (vf) ctx.actions.setComposerMeet(vf.getAttribute('data-vitefield'), vf.value);
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
    _inquiryDraft: inquiryDraft
  };

  BM.views.community = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
