/* ============================================================
 * views/matching.js — 1:1 매칭 (급수 기반) + 채팅
 *
 * 흐름: 카드에서 '프로필 보기' → 상대의 급수·주력 종목·지역·소개 확인
 *      → '요청 보내기'(하트 2) 또는 '닫기'. 확인 없이 바로 신청되지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var noteDrafts = {};   /* 선수별 '한마디' 임시 저장 */

  function myProfile(state) {
    var me = state.me || {};
    return (state.data.matchProfiles || []).filter(function (m) { return m.userKey === me.key; })[0] || {};
  }

  function statusOf(state, p) {
    var me = state.me || {};
    var requests = state.data.requests || [];
    var mine = requests.filter(function (r) { return r.userKey === me.key && r.target === p.userKey; })[0];
    var incoming = requests.filter(function (r) {
      return r.target === me.key && r.userKey === p.userKey && r.status === '대기';
    })[0];
    var incomingDone = requests.filter(function (r) {
      return r.target === me.key && r.userKey === p.userKey && r.status === '수락';
    })[0];
    var room = (state.data.rooms || []).filter(function (r) { return r.other === p.userKey; })[0];
    return {
      mine: mine,
      incoming: incoming,
      incomingAccepted: incomingDone,
      accepted: (mine && mine.status === '수락') || !!incomingDone,
      room: room,
      roomId: (room && room.roomId) || (mine && mine.status === '수락' && mine.id) || (incomingDone && incomingDone.id) || ''
    };
  }

  function filterBar(state) {
    var f = state.ui.matchFilter;
    function line(kr, key, options) {
      return '<div class="filter-line"><span class="filter-line__label">' + kr + '</span><div class="scrollx">' +
        ['전체'].concat(options).map(function (o) {
          return '<button type="button" class="chip chip--sm' + (f[key] === o ? ' is-on' : '') + '"' +
            ' data-filter="' + key + '" data-value="' + U.esc(o) + '">' + U.esc(o) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="filters">' +
      line('급수', 'level', D.VOCAB.grades) +
      line('지역', 'region', D.VOCAB.regions) +
      line('종목', 'discipline', D.VOCAB.disciplines) +
      '</div>';
  }

  function eventName(p) {
    if (p.discipline) return p.discipline;
    return '종목 미입력';
  }

  function matchLine(scored) {
    return '궁합 <b>' + scored.score + '</b>' +
      (scored.reasons.length ? ' · ' + U.esc(scored.reasons.slice(0, 2).join(' · ')) : '');
  }

  /* ---------- 목록 카드 ---------- */
  function playerCard(p, state) {
    var st = statusOf(state, p);
    var scored = D.matchScore(myProfile(state), p, myProfile(state));
    var key = U.esc(p.userKey);

    var action;
    if (st.incoming) {
      action = '<button class="btn btn--ghost grow" data-open-profile="' + key + '">' +
        UI.icon('community') + '받은 신청 보기</button>';
    } else if (st.accepted || st.room) {
      action = '<button class="btn grow" data-open-chat="' + U.esc(st.roomId) + '" data-other="' + key + '">' +
        UI.icon('community') + '채팅하기' + (st.room && st.room.unread ? ' <i class="badge">' + st.room.unread + '</i>' : '') + '</button>';
    } else if (st.mine) {
      action = '<button class="btn btn--ghost grow" disabled>신청함 · ' + U.esc(st.mine.status) + '</button>';
    } else {
      action = '<button class="btn btn--primary grow" data-open-profile="' + key + '">' +
        UI.icon('match') + '프로필 보고 요청하기</button>';
    }

    return '<article class="pcard" data-player="' + key + '" data-open-profile="' + key + '">' +
      '<div class="pcard__top">' + UI.avatar(p.avatar, 46) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) +
      '<span class="pill pill--grade">' + U.esc(p.level || '급수 미입력') + '</span></div>' +
      '<p class="pcard__meta">' + U.esc([p.region, p.club, p.availability].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="matchbadge"><strong>' + scored.score + '</strong><span>궁합</span></div></div>' +

      '<div class="pcard__event"><span class="pcard__event-k">주력</span>' +
      '<div class="pcard__events">' + D.VOCAB.disciplines.map(function (ev) {
        return '<span class="eventchip' + (p.discipline === ev ? ' is-on' : '') + '">' + U.esc(ev) + '</span>';
      }).join('') + '</div></div>' +

      (p.bio ? '<p class="pcard__bio">' + U.esc(p.bio) + '</p>' : '') +
      '<div class="tags">' + (p.experience ? '<span class="tag">' + U.esc(p.experience) + '</span>' : '') +
      (scored.reasons.length ? '<span class="tag tag--soft">' + U.esc(scored.reasons.slice(0, 2).join(' · ')) + '</span>' : '') + '</div>' +
      '<div class="pcard__act">' + action + '</div></article>';
  }

  /* ---------- 프로필 시트(요청 전 확인) ---------- */
  function profileBody(state, p) {
    var st = statusOf(state, p);
    var mp = myProfile(state);
    var scored = D.matchScore(mp, p, mp);
    var hearts = state.data.hearts || { balance: 0, matchCost: D.HEART_RULES.MATCH_COST };
    var cost = D.HEART_RULES.MATCH_COST;
    var key = U.esc(p.userKey);

    var footer;
    if (st.incoming) {
      footer = '<div class="pp__note">' + UI.icon('spark') + '상대가 먼저 매칭을 신청했어요. 수락하면 바로 대화할 수 있습니다.</div>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-decline="' + U.esc(st.incoming.id) + '">거절</button>' +
        '<button class="btn btn--primary grow" data-accept="' + U.esc(st.incoming.id) + '">수락하고 대화하기</button></div>';
    } else if (st.accepted || st.room) {
      footer = '<div class="pp__note pp__note--ok">' + UI.icon('check') + '매칭이 성사됐어요.</div>' +
        '<button class="btn btn--primary btn--big mt8" data-open-chat="' + U.esc(st.roomId) + '" data-other="' + key + '">' +
        UI.icon('community') + '채팅하기</button>';
    } else if (st.mine) {
      footer = '<div class="pp__note">' + UI.icon('clock') + '이미 요청을 보냈어요 · 상태 <b>' + U.esc(st.mine.status) + '</b></div>' +
        '<button class="btn btn--ghost btn--big mt8" data-close>닫기</button>';
    } else {
      var short = hearts.balance < cost;
      footer = '<label class="flabel">한마디 (선택)' +
        '<input type="text" data-note maxlength="60" placeholder="주말 오전에 같이 치실래요?" value="' + U.esc(noteDrafts[p.userKey] || '') + '"></label>' +
        '<div class="pp__cost">매칭 신청에 하트 <b>' + cost + '개</b> · 내 하트 <b class="' + (short ? 'down' : 'up') + '">' + hearts.balance + '개</b>' +
        (short ? '<span class="warn"> · ' + (cost - hearts.balance) + '개 부족</span>' : '') + '</div>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-close>닫기</button>' +
        '<button class="btn btn--primary grow" data-send-request="' + key + '"' + (short ? ' disabled' : '') + '>' +
        UI.icon('heart') + '요청 보내기</button></div>' +
        '<button class="linkbtn mt8" data-gift-in-sheet="' + key + '">하트 선물하기 (' + D.HEART_RULES.GIFT_COST + '개)</button>';
    }

    return '<div class="pp" data-profile="' + key + '">' +
      '<div class="pp__head">' + UI.avatar(p.avatar, 62) +
      '<div class="pp__id"><div class="pp__name">' + U.esc(p.nick) +
      '<span class="pill pill--grade">' + U.esc(p.level || '급수 미입력') + '</span></div>' +
      '<p class="pp__meta">' + U.esc([p.region, p.club].filter(Boolean).join(' · ')) + '</p>' +
      '<p class="pp__match">' + matchLine(scored) + '</p></div></div>' +

      '<h4 class="pp__label">주력 종목</h4>' +
      '<div class="pp__events">' + D.VOCAB.disciplines.map(function (ev) {
        return '<span class="eventchip eventchip--lg' + (p.discipline === ev ? ' is-on' : '') + '">' + U.esc(ev) + '</span>';
      }).join('') + '</div>' +

      '<h4 class="pp__label">급수</h4>' +
      '<div class="pp__grades">' + D.VOCAB.grades.map(function (g) {
        return '<span class="gradechip' + (p.level === g ? ' is-on' : '') + '">' + U.esc(g) + '</span>';
      }).join('') + '</div>' +

      '<dl class="kv kv--tight">' +
      '<dt>가능 시간</dt><dd>' + U.esc(p.availability || '—') + '</dd>' +
      '<dt>경력</dt><dd>' + U.esc(p.experience || '—') + '</dd>' +
      '<dt>지역</dt><dd>' + U.esc(p.region || '—') + '</dd>' +
      '<dt>클럽</dt><dd>' + U.esc(p.club || '—') + '</dd>' +
      '</dl>' +

      (p.bio ? '<p class="pp__bio">' + U.esc(p.bio) + '</p>' : '') +
      '<div class="pp__foot">' + footer + '</div></div>';
  }

  function openProfile(p, ctx) {
    UI.openSheet({
      title: '선수 프로필 · ' + (p.level || '급수 미입력'),
      body: profileBody(ctx.store.state, p),
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var send = ev.target.closest('[data-send-request]');
          if (send) {
            ev.preventDefault();
            var input = wrap.querySelector('[data-note]');
            var note = input ? input.value : (noteDrafts[p.userKey] || '');
            noteDrafts[p.userKey] = note;
            if (send.disabled) return;
            var res = ctx.actions.requestMatch(send.getAttribute('data-send-request'), note);
            UI.closeSheet();
            if (res.ok) UI.toast('매칭 신청을 보냈어요. 대화를 시작할 수 있어요.');
            else if (res.reason === 'already') UI.toast('이미 신청한 상대예요.');
            else if (res.reason === 'hearts') UI.toast('하트가 ' + res.need + '개 부족해요. MY에서 충전하세요.', 'error');
            else if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
            return;
          }
          var accept = ev.target.closest('[data-accept]');
          if (accept) {
            ev.preventDefault();
            ctx.actions.respondMatch(accept.getAttribute('data-accept'), '수락');
            UI.closeSheet();
            UI.toast('매칭을 수락했어요. 채팅을 시작해 보세요.');
            return;
          }
          var decline = ev.target.closest('[data-decline]');
          if (decline) {
            ev.preventDefault();
            ctx.actions.respondMatch(decline.getAttribute('data-decline'), '거절');
            UI.closeSheet();
            UI.toast('신청을 거절했어요.');
            return;
          }
          var chat = ev.target.closest('[data-open-chat]');
          if (chat) {
            ev.preventDefault();
            UI.closeSheet();
            ctx.actions.openChat(chat.getAttribute('data-open-chat'));
            ctx.actions.markChatRead(chat.getAttribute('data-open-chat'), chat.getAttribute('data-other'));
            return;
          }
          var gift = ev.target.closest('[data-gift-in-sheet]');
          if (gift) {
            ev.preventDefault();
            ev.stopPropagation();
            UI.confirm('하트 ' + D.HEART_RULES.GIFT_COST + '개를 ' + p.nick + '님에게 선물할까요?').then(function (ok) {
              if (!ok) return;
              var r = ctx.actions.giftHeart(p.userKey);
              if (r.ok) { UI.closeSheet(); UI.toast('하트를 선물했어요!'); }
              else if (r.reason === 'hearts') UI.toast('하트가 부족해요', 'error');
              else UI.toast('선물하지 못했어요', 'error');
            });
            return;
          }
        });
        var input = wrap.querySelector('[data-note]');
        if (input) input.addEventListener('input', function () { noteDrafts[p.userKey] = input.value; }, { passive: true });
      }
    });
  }

  /* ---------- 채팅 ---------- */
  function chatOverlay(state) {
    var roomId = state.ui.chatRoom;
    if (!roomId) return '';
    var room = state.data.rooms.filter(function (r) { return String(r.roomId) === String(roomId); })[0];
    var req = state.data.requests.filter(function (r) { return String(r.id) === String(roomId); })[0];
    var me = (state.me && state.me.key) || '';
    var other = (room && room.other) || (req && (req.userKey === me ? req.target : req.userKey)) || '';
    var mp = state.data.matchProfiles.filter(function (m) { return m.userKey === other; })[0] || {};
    var msgs = room ? room.messages : [];
    return '<div class="chat is-on" data-chat data-room="' + U.esc(roomId) + '" data-other="' + U.esc(other) + '">' +
      '<header class="chat__head">' +
      '<button class="iconbtn" data-act="chat-close" aria-label="닫기">' + UI.icon('arrow') + '</button>' +
      '<div class="chat__who">' + UI.avatar(mp.avatar || '🏸', 32) +
      '<div><strong>' + U.esc(mp.nick || '상대') + '</strong>' +
      '<span>' + U.esc([mp.level, mp.discipline, mp.club].filter(Boolean).join(' · ')) + '</span></div></div></header>' +
      '<div class="chat__body" data-chat-msgs>' +
      '<div class="chat__list">' + msgs.map(function (m) {
        var mine = m.userKey === me;
        return '<div class="bubble ' + (mine ? 'bubble--me' : '') + '"><p>' + U.esc(m.text) + '</p>' +
          '<time>' + U.timeAgo(m.createdAt) + '</time></div>';
      }).join('') + '</div>' +
      '<div class="quick">' +
      ['안녕하세요! 주말 오전 어떠세요?', '코트는 어디서 치세요?', '혼복도 가능하세요?', '좋아요, 그때 뵐게요 👍'].map(function (q) {
        return '<button class="chip chip--sm" data-quick="' + U.esc(q) + '">' + U.esc(q) + '</button>';
      }).join('') + '</div></div>' +
      '<form class="chat__input" data-chat-form>' +
      '<input type="text" placeholder="메시지 보내기" autocomplete="off" maxlength="300" data-chat-text>' +
      '<button class="btn btn--send" type="submit" aria-label="보내기">' + UI.icon('send') + '</button></form>' +
      '</div>';
  }

  function bindChat(root, ctx) {
    var form = root.querySelector('[data-chat-form]');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = form.querySelector('[data-chat-text]');
      var chat = root.querySelector('[data-chat]');
      if (!input || !chat) return;
      var res = ctx.actions.sendChat(chat.getAttribute('data-room'), chat.getAttribute('data-other'), input.value);
      if (res.ok) { input.value = ''; UI.haptic(10); }
    });
  }

  /* ---------- 화면 ---------- */
  var view = {
    title: '1:1 매칭',

    render: function (state) {
      var me = state.me || {};
      var mp = myProfile(state);
      var f = state.ui.matchFilter;
      var players = (state.data.matchProfiles || []).filter(function (p) {
        if (p.userKey === me.key) return false;
        if (f.level !== '전체' && p.level !== f.level) return false;
        if (f.region !== '전체' && p.region !== f.region) return false;
        if (f.discipline !== '전체' && p.discipline !== f.discipline) return false;
        return true;
      }).map(function (p) {
        return { p: p, s: D.matchScore(mp, p, mp).score };
      }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.p; });

      var rooms = state.data.rooms || [];

      return '' +
        '<section class="card card--match">' +
        '<div class="row between">' +
        '<div><h2 class="card__title">내 매칭 카드</h2>' +
        '<p class="muted sm">' + (mp.region || mp.level
          ? U.esc([mp.region, mp.level, mp.discipline].filter(Boolean).join(' · '))
          : '카드를 만들면 급수·종목이 맞는 상대를 찾아드려요') + '</p></div>' +
        '<button class="btn btn--ghost btn--sm" data-act="edit-match">' + UI.icon('edit') + (mp.region ? '수정' : '만들기') + '</button></div>' +
        '<div class="heart-chip">' + UI.icon('heart') + '하트 <strong>' + state.data.hearts.balance + '</strong>' +
        '<span class="muted sm">매칭 1회 ' + D.HEART_RULES.MATCH_COST + '개</span></div>' +
        '</section>' +

        (rooms.length ? '<section class="card"><header class="card__head"><h2>내 대화</h2>' +
          (state.data.unread ? '<span class="badge">' + state.data.unread + ' 새 메시지</span>' : '') + '</header>' +
          '<ul class="roomlist">' + rooms.map(function (r) {
            var rp = state.data.matchProfiles.filter(function (m) { return m.userKey === r.other; })[0] || {};
            return '<li class="room" data-open-chat="' + U.esc(r.roomId) + '" data-other="' + U.esc(r.other) + '">' +
              UI.avatar(rp.avatar || '🏸', 40) +
              '<div class="room__mid"><strong>' + U.esc(rp.nick || '상대') +
              (rp.level ? ' <span class="pill pill--grade">' + U.esc(rp.level) + '</span>' : '') + '</strong>' +
              '<p>' + U.esc(U.truncate((r.last && r.last.text) || '대화를 시작해 보세요', 34)) + '</p></div>' +
              '<div class="room__right"><time>' + U.timeAgo(r.at) + '</time>' +
              (r.unread ? '<span class="badge">' + r.unread + '</span>' : '') + '</div></li>';
          }).join('') + '</ul></section>' : '') +

        '<section class="card"><header class="card__head"><h2>플레이어 찾기</h2>' +
        '<span class="muted sm">' + players.length + '명 · 급수순</span></header>' +
        filterBar(state) +
        (players.length ? '<div class="pcards">' + players.map(function (p) { return playerCard(p, state); }).join('') + '</div>'
          : UI.emptyState('match', '조건에 맞는 플레이어가 없어요', '급수·지역 필터를 바꿔 보세요.')) +
        '</section>' +

        chatOverlay(state);
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        var chip = ev.target.closest('[data-filter]');
        if (chip) {
          ev.preventDefault();
          var patch = {};
          patch[chip.getAttribute('data-filter')] = chip.getAttribute('data-value');
          ctx.actions.setFilter(patch);
          UI.haptic(6);
          return;
        }

        /* 채팅 버튼이 카드(프로필 열기) 안에 있으므로 채팅을 먼저 확인합니다 */
        var open = ev.target.closest('[data-open-chat]');
        if (open) {
          ev.preventDefault();
          var roomId = open.getAttribute('data-open-chat');
          var other = open.getAttribute('data-other');
          if (!roomId) return;
          ctx.actions.openChat(roomId);
          if (other) ctx.actions.markChatRead(roomId, other);
          setTimeout(function () {
            var box = root.querySelector('[data-chat-msgs]');
            if (box) box.scrollTop = box.scrollHeight;
          }, 60);
          UI.haptic(8);
          return;
        }

        var profileTarget = ev.target.closest('[data-open-profile]');
        if (profileTarget) {
          ev.preventDefault();
          var key = profileTarget.getAttribute('data-open-profile');
          var p = (ctx.store.state.data.matchProfiles || []).filter(function (m) { return m.userKey === key; })[0];
          if (p) openProfile(p, ctx);
          return;
        }

        if (ev.target.closest('[data-act="chat-close"]')) {
          ev.preventDefault();
          ctx.actions.closeChat();
          return;
        }

        var quick = ev.target.closest('[data-quick]');
        if (quick) {
          ev.preventDefault();
          var input = root.querySelector('[data-chat-text]');
          if (input) { input.value = quick.getAttribute('data-quick'); input.focus(); }
          return;
        }

        if (ev.target.closest('[data-act="edit-match"]')) {
          ev.preventDefault();
          openMatchProfileSheet(ctx);
          return;
        }
      });

      bindChat(root, ctx);
    },

    update: function (root, state, ctx) {
      var chat = root.querySelector('[data-chat]');
      if (state.ui.chatRoom && !chat) {
        root.insertAdjacentHTML('beforeend', chatOverlay(state));
        bindChat(root, ctx);
      } else if (!state.ui.chatRoom && chat) {
        chat.parentNode.removeChild(chat);
      } else if (chat) {
        var roomId = state.ui.chatRoom;
        var room = (state.data.rooms || []).filter(function (r) { return String(r.roomId) === String(roomId); })[0];
        var box = chat.querySelector('[data-chat-msgs] .chat__list');
        if (box && room) {
          var me = (state.me && state.me.key) || '';
          box.innerHTML = room.messages.map(function (m) {
            return '<div class="bubble ' + (m.userKey === me ? 'bubble--me' : '') + '"><p>' + U.esc(m.text) + '</p>' +
              '<time>' + U.timeAgo(m.createdAt) + '</time></div>';
          }).join('');
          var body = chat.querySelector('[data-chat-msgs]');
          if (body) body.scrollTop = body.scrollHeight;
        }
      }
    },

    /* 테스트/다른 화면에서 재사용 */
    profileBody: profileBody,
    playerCard: playerCard,
    statusOf: statusOf
  };

  /* ---------- 내 매칭 카드 편집 ---------- */
  function openMatchProfileSheet(ctx) {
    var me = ctx.store.state.me || {};
    var myMp = myProfile(ctx.store.state);
    var payload = {
      region: myMp.region || '경기',
      level: myMp.level || me.level || 'C조',
      discipline: myMp.discipline || me.discipline || '복식',
      availability: myMp.availability || '주말',
      experience: myMp.experience || '2~5년',
      club: myMp.club || '',
      bio: myMp.bio || '',
      avatar: myMp.avatar || (me.theme && me.theme.avatar) || '🏸'
    };
    function chips(key, values, large) {
      return '<div class="scrollx">' + values.map(function (v) {
        return '<button type="button" class="chip chip--sm' + (payload[key] === v ? ' is-on' : '') + '"' +
          ' data-mp="' + key + '" data-v="' + U.esc(v) + '">' + U.esc(v) + '</button>';
      }).join('') + '</div>';
    }
    UI.openSheet({
      title: '내 매칭 카드',
      body: '<div class="form">' +
        '<label class="flabel">급수' + chips('level', D.VOCAB.grades) + '</label>' +
        '<label class="flabel">주력 종목' + chips('discipline', D.VOCAB.disciplines) + '</label>' +
        '<label class="flabel">지역' + chips('region', D.VOCAB.regions) + '</label>' +
        '<label class="flabel">가능 시간' + chips('availability', D.VOCAB.availability) + '</label>' +
        '<label class="flabel">경력' + chips('experience', D.VOCAB.experience) + '</label>' +
        '<label class="flabel">클럽<input type="text" data-mp-text="club" maxlength="20" value="' + U.esc(payload.club) + '"></label>' +
        '<label class="flabel">소개<input type="text" data-mp-text="bio" maxlength="80" value="' + U.esc(payload.bio) + '"></label>' +
        '</div><button class="btn btn--primary btn--big mt16" data-act="save-mp">저장</button>',
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var c = ev.target.closest('[data-mp]');
          if (c) {
            ev.preventDefault();
            var key = c.getAttribute('data-mp');
            payload[key] = c.getAttribute('data-v');
            var sib = c.parentNode.querySelectorAll('[data-mp="' + key + '"]');
            Array.prototype.forEach.call(sib, function (x) { x.classList.remove('is-on'); });
            c.classList.add('is-on');
            return;
          }
          if (ev.target.closest('[data-act="save-mp"]')) {
            ev.preventDefault();
            wrap.querySelectorAll('[data-mp-text]').forEach(function (inp) {
              payload[inp.getAttribute('data-mp-text')] = inp.value.trim();
            });
            ctx.actions.saveMatchProfile(payload);
            UI.closeSheet();
            UI.toast('매칭 카드를 저장했어요.');
          }
        });
      }
    });
  }

  view.openProfile = openProfile;
  BM.views.matching = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
