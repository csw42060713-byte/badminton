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

  /* 말머리 칩 한 줄 (말머리 고르기 · 목록 거르기에서 같은 모양을 씁니다) */
  function topicChips(current, attr, all) {
    var vals = (all ? ['전체'] : []).concat(D.POST_TOPICS);
    return vals.map(function (t) {
      var on = t === current;
      return '<button type="button" class="chip chip--sm' + (on ? ' is-on' : '') + '" ' + attr + '="' + U.esc(t) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' + U.esc(t) + '</button>';
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
    return '<div class="chips topicbar" data-topicfilterbar>' + topicChips(topicFilter, 'data-topicfilter', true) + '</div>';
  }

  function paintTopicFilter(root, state) {
    var host = root.querySelector('[data-topicfilterbar]');
    if (host) host.innerHTML = topicChips(topicFilter, 'data-topicfilter', true);
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
        '<div class="chips topicpick" data-topics>' + topicChips(picked, 'data-topic', false) + '</div>' +
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
          var res = ctx.actions.createPost(text, ctx.store.state.ui.composerTopic);
          if (res.ok) {
            if (ta) ta.value = '';
            /* 올린 글이 지금 거르는 말머리와 다르면 전체로 돌아가 방금 글을 보여 줍니다 */
            if (topicFilter !== '전체' && topicFilter !== res.topic) {
              topicFilter = '전체';
              paintTopicFilter(root, ctx.store.state);
            }
            UI.toast('글을 올렸어요'); UI.haptic(10);
          }
          else if (res.reason === 'empty') UI.toast('내용을 입력해 주세요');
          else if (res.reason === 'locked') UI.toast('잠시만요, 올리는 중이에요');
          return;
        }
      });

      root.addEventListener('input', function (ev) {
        var ta = ev.target.closest('[data-composer]');
        if (ta) ctx.actions.setComposer(ta.value);
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
      /* 말머리 칩 상태도 함께 맞춥니다 */
      var filterHost = root.querySelector('[data-topicfilterbar]');
      if (filterHost) filterHost.innerHTML = topicChips(topicFilter, 'data-topicfilter', true);
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
    _setTopicFilter: function (t) { topicFilter = !t || t === '전체' ? '전체' : D.normalizeTopic(t); return topicFilter; }
  };

  BM.views.community = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
