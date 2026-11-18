/* ============================================================
 * views/community.js — 커뮤니티 (글·답글·하트)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var openReplies = {};   /* postId -> true */
  var replyDrafts = {};   /* postId -> text */
  var sortMode = 'new';

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
      '<time>' + U.timeAgo(p.createdAt) + '</time></span></button></header>' +
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
            '<time>' + U.timeAgo(r.createdAt) + '</time></div><p>' + U.esc(r.text) + '</p></li>';
        }).join('') + '</ul>' : '<p class="muted sm">첫 답글을 남겨 보세요.</p>') +
        '<form class="replyform" data-reply-form="' + U.esc(p.id) + '">' +
        '<input type="text" maxlength="200" placeholder="' + U.esc((state.me && state.me.nick) || '나') + '(으)로 답글" data-reply-input="' + U.esc(p.id) + '" value="' + U.esc(replyDrafts[p.id] || '') + '">' +
        '<button class="btn btn--sm btn--primary" type="submit">' + UI.icon('send') + '</button></form>' +
        '</div>' : '') +
      '</article>';
  }

  var view = {
    title: '커뮤니티',
    render: function (state) {
      var posts = (state.data.posts || []).slice();
      if (sortMode === 'hot') posts.sort(function (a, b) { return (b.likes + b.replies.length) - (a.likes + a.replies.length); });
      return '' +
        '<section class="card card--composer">' +
        '<div class="row">' + UI.avatar({ theme: state.me && state.me.theme }, 36) +
        '<textarea rows="2" data-composer placeholder="오늘 경기 어땠어요? 한 줄 남겨보세요" maxlength="300">' + U.esc(state.ui.composer || '') + '</textarea></div>' +
        '<div class="row between mt8"><span class="muted sm">욕설·비방은 자제해 주세요</span>' +
        '<button class="btn btn--primary btn--sm" data-act="post">' + UI.icon('send') + '올리기</button></div>' +
        '</section>' +
        '<div class="seg seg--wide" data-sort>' +
        '<button class="seg__btn' + (sortMode === 'new' ? ' is-on' : '') + '" data-sortval="new">최신</button>' +
        '<button class="seg__btn' + (sortMode === 'hot' ? ' is-on' : '') + '" data-sortval="hot">인기</button>' +
        '</div>' +
        '<section class="card card--flush" data-region="posts">' +
        (posts.length ? posts.map(function (p) { return postCard(p, state); }).join('')
          : UI.emptyState('community', '아직 글이 없어요', '첫 글을 남겨 보세요.')) +
        '</section>';
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
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
        if (ev.target.closest('[data-act="post"]')) {
          ev.preventDefault();
          var ta = root.querySelector('[data-composer]');
          var text = ta ? ta.value : '';
          var res = ctx.actions.createPost(text);
          if (res.ok) { if (ta) ta.value = ''; UI.toast('글을 올렸어요'); UI.haptic(10); }
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
      var posts = (state.data.posts || []).slice();
      if (sortMode === 'hot') posts.sort(function (a, b) { return (b.likes + b.replies.length) - (a.likes + a.replies.length); });
      region.innerHTML = posts.length ? posts.map(function (p) { return postCard(p, state); }).join('')
        : UI.emptyState('community', '아직 글이 없어요', '첫 글을 남겨 보세요.');
      if (keep) {
        var again = region.querySelector('[data-reply-input="' + keep.pid + '"]');
        if (again) {
          again.focus();
          again.value = keep.value;
          try { again.setSelectionRange(keep.pos, keep.pos); } catch (e) { /* noop */ }
        }
      }
    },

    _openReplies: openReplies
  };

  BM.views.community = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
