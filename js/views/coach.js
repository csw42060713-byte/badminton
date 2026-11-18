/* ============================================================
 * views/coach.js — 코치 (선수 피드백 + 멘토 신청 심사)
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var rating = 4;
  var picked = [];

  function playersWithLogs(state) {
    var me = (state.me && state.me.key) || '';
    var map = {};
    (state.data.allRecords || []).forEach(function (r) {
      if (!r.userKey || r.userKey === me) return;
      (map[r.userKey] = map[r.userKey] || []).push(r);
    });
    return Object.keys(map).map(function (k) {
      var list = U.sortBy(map[k], function (r) { return (r.date || '') + (r.createdAt || ''); }, true);
      var mp = (state.data.matchProfiles || []).filter(function (m) { return m.userKey === k; })[0] || {};
      return {
        key: k, nick: list[0].nick || mp.nick || '선수', avatar: mp.avatar || '🏸',
        avatarPhoto: mp.avatarPhoto || '', avatarFrame: mp.avatarFrame || 'basic',
        avatarBg: mp.avatarBg || 'plain', avatarBadge: mp.avatarBadge || '',
        records: list, level: list[0].level || mp.level || '',
        last: (list[0] && list[0].date) || ''
      };
    }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });   /* 최근 기록이 있는 선수부터 */
  }

  function playerBlock(p, state) {
    var sum = BM.ai.summarize(p.records, p.level);
    var last = p.records[0] || {};
    var openRec = state.ui.coachPlayer === p.key;
    return '<article class="card card--player' + (openRec ? ' is-open' : '') + '" data-player="' + U.esc(p.key) + '">' +
      '<header class="pcard__top">' + UI.avatar(p, 46) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) + '<span class="pill">' + U.esc(p.level) + '</span></div>' +
      '<p class="pcard__meta">최근 30일 ' + sum.sessions + '회 · ' + sum.minutes + '분 · 승률 ' + (sum.winRate == null ? '—' : sum.winRate + '%') + '</p></div>' +
      '<button class="btn btn--ghost btn--sm" data-pick="' + U.esc(p.key) + '">' + (openRec ? '접기' : '자세히') + '</button></header>' +
      '<div class="tags">' +
      (sum.topWeakness.length ? sum.topWeakness.map(function (w) { return '<span class="tag tag--warn">약점 ' + U.esc(w) + '</span>'; }).join('') : '') +
      (sum.pain.length ? sum.pain.map(function (x) { return '<span class="tag">통증 ' + U.esc(x) + '</span>'; }).join('') : '') +
      '<span class="tag tag--soft">평균 컨디션 ' + (sum.avgCond == null ? '—' : sum.avgCond) + '</span></div>' +
      (openRec ? '<div class="player__detail">' +
        '<h4 class="sec-title">최근 기록</h4><ul class="loglist loglist--tight">' +
        p.records.slice(0, 4).map(function (r) {
          return '<li class="logrow"><div class="logrow__date"><strong>' + U.shortDay(r.date) + '</strong><span>' + U.relDay(r.date) + '</span></div>' +
            '<div class="logrow__mid"><p class="logrow__title">컨디션 ' + (r.cond == null ? '—' : r.cond) + ' · 강도 ' + (r.intensity == null ? '—' : r.intensity) + ' · ' + (r.minutes || 0) + '분</p>' +
            '<div class="tags">' + [].concat(r.pain || [], r.weakness || []).map(function (t) { return '<span class="tag">' + U.esc(t) + '</span>'; }).join('') + '</div></div>' +
            '<div class="logrow__score"><span class="score ' + (r.result === '승' ? 'is-win' : r.result === '패' ? 'is-loss' : '') + '">' + U.esc(r.scoreRaw || '—') + '</span></div></li>';
        }).join('') + '</ul>' +
        '<div class="coachbox" data-coachbox="' + U.esc(p.key) + '">' +
        '<h4 class="sec-title">피드백 보내기</h4>' +
        '<div class="stars" data-stars>' + [1, 2, 3, 4, 5].map(function (n) {
          return '<button type="button" class="star' + (n <= rating ? ' is-on' : '') + '" data-star="' + n + '">★</button>';
        }).join('') + '</div>' +
        '<div class="chips" data-drills>' + ['드라이브', '풋워크', '헤어핀', '스매시', '기초 체력'].map(function (d) {
          return '<button type="button" class="chip chip--sm" data-drill="' + U.esc(d) + '">' + U.esc(d) + '</button>';
        }).join('') + '</div>' +
        '<textarea rows="3" data-fb-text placeholder="예: 드라이브 타점이 뒤로 밀려요. 몸 앞에서 잡는 연습 3세트 해보세요." maxlength="300"></textarea>' +
        '<button class="btn btn--primary btn--big" data-act="send-fb" data-player="' + U.esc(p.key) + '">' + UI.icon('send') + '피드백 보내기</button>' +
        '</div></div>' : '') +
      '</article>';
  }

  function approveBlock(state) {
    var apps = state.data.coachApps || [];
    var pending = apps.filter(function (a) { return a.status === '심사중'; });
    var done = apps.filter(function (a) { return a.status !== '심사중'; });
    return '<section class="card"><header class="card__head"><h2>멘토 신청 심사</h2>' +
      '<span class="badge">' + pending.length + ' 대기</span></header>' +
      (apps.length ? '' : UI.emptyState('coach', '신청이 없어요', '멘토 신청이 들어오면 여기에서 승인/거절할 수 있어요.')) +
      '<ul class="applist">' + apps.map(function (a) {
        var pl = a.payload || {};
        var cls = a.status === '승인' ? 'is-ok' : a.status === '거절' ? 'is-no' : 'is-wait';
        return '<li class="approw ' + cls + '">' +
          '<div class="approw__top"><strong>' + U.esc(a.nick || '신청자') + '</strong>' +
          '<span class="pill pill--' + (a.status === '승인' ? 'ok' : a.status === '거절' ? 'no' : 'wait') + '">' + U.esc(a.status) + '</span></div>' +
          '<dl class="kv kv--tight">' +
          '<dt>유형</dt><dd>' + U.esc(pl.type || '—') + '</dd>' +
          '<dt>경력</dt><dd>' + U.esc(pl.experience || '—') + '</dd>' +
          '<dt>증빙</dt><dd>' + U.esc(pl.proof || '—') + '</dd>' +
          '<dt>소개</dt><dd>' + U.esc(pl.intro || '—') + '</dd>' +
          '<dt>신청일</dt><dd>' + U.esc(pl.submitted || a.createdAt || '') + '</dd>' +
          '</dl>' +
          (a.status === '심사중' ? '<div class="row gap8 mt8">' +
            '<button class="btn btn--ghost grow" data-decide="' + U.esc(a.id) + '" data-status="거절">거절</button>' +
            '<button class="btn btn--primary grow" data-decide="' + U.esc(a.id) + '" data-status="승인">승인</button></div>' : '') +
          '</li>';
      }).join('') + '</ul></section>';
  }

  var view = {
    title: '코치',
    render: function (state) {
      var tab = state.ui.coachTab || 'feedback';
      var players = playersWithLogs(state);
      var myFeedback = (state.data.feedback || []).filter(function (f) {
        return state.me && f.target === state.me.key;
      });
      var sent = (state.data.feedback || []).filter(function (f) {
        return state.me && f.userKey === state.me.key;
      });
      return '' +
        '<div class="seg seg--wide" data-coachtabs>' +
        '<button class="seg__btn' + (tab === 'feedback' ? ' is-on' : '') + '" data-coachtab="feedback">선수 피드백</button>' +
        '<button class="seg__btn' + (tab === 'approve' ? ' is-on' : '') + '" data-coachtab="approve">멘토 심사</button>' +
        '</div>' +

        (tab === 'feedback' ?
          (myFeedback.length ? '<section class="card card--fb"><header class="card__head"><h2>' + UI.icon('spark') + '내가 받은 피드백</h2></header>' +
            myFeedback.slice(0, 3).map(function (f) {
              var pl = f.payload || {};
              return '<div class="fb"><div class="fb__top"><strong>' + U.esc(pl.coach || f.nick) + '</strong>' +
                '<span class="stars stars--sm">' + UI.stars(pl.rating || 0) + '</span></div>' +
                '<p>' + U.esc(pl.feedback || '') + '</p>' +
                '<div class="tags">' + (pl.drills || []).map(function (d) { return '<span class="tag">' + U.esc(d) + '</span>'; }).join('') + '</div></div>';
            }).join('') + '</section>' : '') +
          '<p class="sectionnote">코치는 선수 기록을 보고 한 줄 피드백과 추천 드릴을 남길 수 있어요. 내 기록은 <b>일지 & AI</b>에서 확인합니다.</p>' +
          (players.length ? players.map(function (p) { return playerBlock(p, state); }).join('')
            : '<section class="card">' + UI.emptyState('coach', '선수 기록이 아직 없어요', '다른 회원이 일지를 저장하면 여기에 나타납니다.') + '</section>') +
          (sent.length ? '<section class="card"><header class="card__head"><h2>내가 보낸 피드백</h2><span class="muted sm">' + sent.length + '건</span></header>' +
            '<ul class="bullets">' + sent.slice(0, 5).map(function (f) {
              var pl = f.payload || {};
              return '<li><b>' + U.esc(f.nick ? '보낸 피드백' : '피드백') + '</b> · ' + U.esc(U.truncate(pl.feedback || '', 40)) + '</li>';
            }).join('') + '</ul></section>' : '')
          : approveBlock(state));
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        var t = ev.target.closest('[data-coachtab]');
        if (t) { ev.preventDefault(); ctx.actions.setCoachTab(t.getAttribute('data-coachtab')); return; }

        var pickBtn = ev.target.closest('[data-pick]');
        if (pickBtn) {
          ev.preventDefault();
          var k = pickBtn.getAttribute('data-pick');
          ctx.actions.setCoachPlayer(ctx.store.state.ui.coachPlayer === k ? null : k);
          UI.haptic(6);
          return;
        }
        var star = ev.target.closest('[data-star]');
        if (star) {
          ev.preventDefault();
          rating = +star.getAttribute('data-star');
          var box = star.closest('[data-stars]');
          Array.prototype.forEach.call(box.querySelectorAll('[data-star]'), function (s) {
            s.classList.toggle('is-on', +s.getAttribute('data-star') <= rating);
          });
          return;
        }
        var drill = ev.target.closest('[data-drill]');
        if (drill) {
          ev.preventDefault();
          UI.toggleChip(drill);
          return;
        }
        var send = ev.target.closest('[data-act="send-fb"]');
        if (send) {
          ev.preventDefault();
          var box2 = send.closest('[data-coachbox]');
          var text = box2.querySelector('[data-fb-text]').value;
          var drills = UI.readChips(box2.querySelector('[data-drills]'));
          var res = ctx.actions.sendCoachFeedback({
            playerKey: send.getAttribute('data-player'), text: text, rating: rating, drills: drills
          });
          if (res.ok) {
            box2.querySelector('[data-fb-text]').value = '';
            UI.toast('피드백을 보냈어요.');
            UI.haptic(12);
          } else if (res.reason === 'empty') UI.toast('피드백 내용을 적어 주세요');
          else if (res.reason === 'locked') UI.toast('잠시만요');
          return;
        }
        var dec = ev.target.closest('[data-decide]');
        if (dec) {
          ev.preventDefault();
          ctx.actions.decideCoachApp(dec.getAttribute('data-decide'), dec.getAttribute('data-status'));
          UI.toast('멘토 신청을 ' + dec.getAttribute('data-status') + ' 처리했어요.');
          UI.haptic(10);
          return;
        }
      });
    },

    update: function (root, state, ctx) {
      /* 코치 화면은 상태가 바뀌면 통째로 다시 그립니다 (목록이 작아 빠릅니다) */
      ctx.refresh();
    }
  };

  BM.views.coach = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
