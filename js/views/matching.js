/* ============================================================
 * views/matching.js — 1:1 매칭 (찾기 · 받은 요청 · 보낸 요청 · 대화)
 *
 * 흐름: 찾기 탭에서 급수·지역·종목·성별로 좁히고, 카드를 누르면 상대 프로필을
 *      확인한 뒤 '요청 보내기'(하트 2)로 신청합니다. 확인 없이 바로 신청되지 않습니다.
 *      받은 요청은 목록에서 바로 수락/거절할 수 있고, 수락하면 채팅방이 열립니다.
 *      보낸 요청은 대기/수락/거절 상태가 그대로 보입니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  BM.views = BM.views || {};

  var noteDrafts = {};   /* 선수별 '한마디' 임시 저장 */

  function meKey(state) { return (state.me && state.me.key) || ''; }

  function myProfile(state) {
    var me = state.me || {};
    return (state.data.matchProfiles || []).filter(function (m) { return m.userKey === me.key; })[0] || {};
  }

  function profileOf(state, key) {
    return (state.data.matchProfiles || []).filter(function (m) { return m.userKey === key; })[0] || null;
  }

  /* 매칭 카드가 없어도 프로필 행은 있으므로, 카드가 없으면 프로필로 대신합니다 */
  function personOf(state, key) {
    var p = profileOf(state, key);
    if (p) return p;
    var d = D.profileOf(state.data.idx, key) || {};
    return {
      userKey: key, nick: d.nick || '회원', level: d.level || '', discipline: d.discipline || '',
      region: '', club: '', availability: '', experience: '', bio: d.bio || '',
      gender: '비공개', theme: d.theme || null
    };
  }

  function latest(list) {
    return U.sortBy(list, function (r) { return r.createdAt || ''; }, true)[0] || null;
  }

  function statusOf(state, p) {
    var me = meKey(state);
    var requests = state.data.requests || [];
    var mine = latest(requests.filter(function (r) { return r.userKey === me && r.target === p.userKey; }));
    var incoming = latest(requests.filter(function (r) {
      return r.target === me && r.userKey === p.userKey && r.status === '대기';
    }));
    var acceptedIn = latest(requests.filter(function (r) {
      return r.target === me && r.userKey === p.userKey && r.status === '수락';
    }));
    var fs = D.friendState(state.data.idx, me, p.userKey);
    var thread = (state.data.threads || []).filter(function (t) { return t.other === p.userKey; })[0];
    var room = (state.data.rooms || []).filter(function (r) { return r.other === p.userKey; })[0];
    return {
      mine: mine,
      incoming: incoming,
      incomingAccepted: acceptedIn,
      friend: fs,
      accepted: (mine && mine.status === '수락') || !!acceptedIn,
      canChat: D.canChatWith(state.data.idx, me, p.userKey),
      room: room,
      roomId: (thread && thread.roomId) || (fs.state === 'friends' && fs.acceptId) ||
        (room && room.roomId) || (mine && mine.status === '수락' && mine.id) || (acceptedIn && acceptedIn.id) || ''
    };
  }

  function pendingIncoming(state) {
    var me = meKey(state);
    return U.sortBy((state.data.requests || []).filter(function (r) {
      return r.target === me && r.status === '대기';
    }), function (r) { return r.createdAt || ''; }, true);
  }

  function sentRequests(state) {
    var me = meKey(state);
    return U.sortBy((state.data.requests || []).filter(function (r) { return r.userKey === me; }),
      function (r) { return r.createdAt || ''; }, true);
  }

  /* ---------- 필터 ---------- */
  function filterOf(state) {
    return state.ui.matchFilter || {};
  }

  function sortOf(state) {
    return state.ui.matchSort === 'recent' ? 'recent' : 'score';
  }

  function tabOf(state) {
    var t = state.ui.matchTab;
    return (t === 'in' || t === 'out' || t === 'chat') ? t : 'find';
  }

  function valueOf(f, key) {
    var v = f[key];
    return v && v !== '전체' ? v : '';
  }

  /* 필터 버튼 + 펼친 칩 묶음. 상태가 바뀌면 이 영역만 다시 그립니다. */
  function filterBar(state) {
    return '<div class="fwrap" data-region="filters" data-sig="' + U.esc(filterSig(state)) + '">' +
      filterBarOnly(state) + '</div>';
  }

  function filterSig(state) {
    var f = filterOf(state);
    return [f.level || '전체', f.gender || '전체', f.region || '전체', f.discipline || '전체',
      state.ui.matchFilterOpen || ''].join('|');
  }

  function searchBar(state) {
    var q = filterOf(state).query || '';
    return '<div class="searchbar' + (q ? ' is-filled' : '') + '">' +
      '<span class="searchbar__ico">' + UI.icon('search') + '</span>' +
      '<input type="search" data-search-input enterkeyhint="search" autocomplete="off" spellcheck="false"' +
      ' placeholder="닉네임, 지역, 클럽으로 찾기" aria-label="플레이어 검색" value="' + U.esc(q) + '">' +
      '<button type="button" class="searchbar__clear" data-act="clear-search" aria-label="검색어 지우기"' +
      (q ? '' : ' hidden') + '>' + UI.icon('close') + '</button>' +
      '</div>';
  }

  function genderPill(p) {
    var g = D.normalizeGender(p.gender);
    if (!g || g === '비공개') return '';
    return '<span class="pill pill--gender pill--' + (g === '여성' ? 'f' : 'm') + '">' + U.esc(g) + '</span>';
  }

  function gradePill(p) {
    return '<span class="pill pill--grade">' + U.esc(p.level || '급수 미입력') + '</span>';
  }

  /* ---------- 목록 카드 ---------- */
  function heartBuyText(state) {
    var hearts = state.data.hearts || {};
    var cost = D.HEART_RULES.MATCH_COST;
    var balance = hearts.balance || 0;
    return { cost: cost, balance: balance, short: balance < cost };
  }

  function playerCard(p, state) {
    var st = statusOf(state, p);
    var mp = myProfile(state);
    var scored = D.matchScore(mp, p, mp);
    var key = U.esc(p.userKey);
    var meta = [p.region, p.club].filter(Boolean).join(' · ');
    var spec = [p.availability, p.experience].filter(Boolean).join(' · ');

    var action;
    var costNote = '';
    if (st.incoming) {
      action = '<button class="btn btn--primary btn--sm" data-open-profile="' + key + '">' +
        '받은 요청 확인</button>';
    } else if (st.canChat && st.roomId) {
      action = '<button class="btn btn--primary btn--sm" data-open-chat="' + U.esc(st.roomId) + '" data-other="' + key + '">' +
        '채팅하기' + (st.room && st.room.unread ? ' <i class="badge">' + st.room.unread + '</i>' : '') + '</button>';
    } else if (st.mine && st.mine.status !== '거절') {
      action = '<span class="pcard__state">보낸 요청 · ' + U.esc(st.mine.status) + '</span>';
    } else {
      action = '<button class="btn btn--ghost btn--sm" data-open-profile="' + key + '">' +
        '프로필 보고 요청하기</button>';
      /* 요청 전에 하트가 얼마나 드는지 카드에서 바로 보이게 (스크롤 전) */
      var hb = heartBuyText(state);
      costNote = '<span class="pcard__cost">' + UI.icon('heart') + '신청 하트 ' + hb.cost + '개 · 보유 ' + hb.balance + '개' +
        (hb.short ? ' <b class="down">· ' + (hb.cost - hb.balance) + '개 부족</b>' : '') + '</span>';
    }

    return '<article class="pcard" data-player="' + key + '" data-open-profile="' + key + '">' +
      '<div class="pcard__top">' + UI.avatar(p, 50) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) +
      gradePill(p) + genderPill(p) +
      (st.friend.state === 'friends' ? '<span class="pill pill--friend">친구</span>' : '') + '</div>' +
      '<p class="pcard__meta">' + U.esc(meta || '지역 미입력') + '</p></div>' +
      '<div class="fit"><strong>' + scored.score + '</strong><span>궁합</span></div></div>' +
      (p.discipline || spec ? '<p class="pcard__spec">' +
        (p.discipline ? '<span class="eventchip is-on">' + U.esc(p.discipline) + '</span>' : '') +
        (spec ? '<span class="pcard__spec-t">' + U.esc(spec) + '</span>' : '') + '</p>' : '') +
      (p.bio ? '<p class="pcard__bio">' + U.esc(p.bio) + '</p>' : '') +
      (scored.reasons.length ? '<p class="pcard__why">' + U.esc(scored.reasons.slice(0, 2).join(' · ')) + '</p>' : '') +
      '<div class="pcard__act">' + costNote + action + '</div></article>';
  }

  /* ---------- 결과 계산 ---------- */
  function sortedPlayers(state) {
    var mp = myProfile(state);
    var list = D.filterPlayers(state.data.matchProfiles || [], filterOf(state), { excludeKey: meKey(state) })
      .map(function (p) { return { p: p, s: D.matchScore(mp, p, mp).score }; });
    if (sortOf(state) === 'recent') {
      list.sort(function (a, b) {
        var A = a.p.createdAt || '', B = b.p.createdAt || '';
        if (A !== B) return A < B ? 1 : -1;
        return b.s - a.s;
      });
    } else {
      list.sort(function (a, b) { return b.s - a.s; });
    }
    return list;
  }

  function visiblePlayers(state) {
    return sortedPlayers(state).map(function (x) { return x.p; });
  }

  function resultsSig(state) {
    var f = filterOf(state);
    var reqs = (state.data.requests || []).map(function (r) { return r.id + ':' + r.status; }).join(',');
    var rooms = (state.data.rooms || []).map(function (r) { return r.roomId + ':' + r.unread; }).join(',');
    return [f.level || '전체', f.gender || '전체', f.region || '전체', f.discipline || '전체', f.query || '',
      sortOf(state), (state.data.matchProfiles || []).length, reqs, rooms,
      (state.me && state.me.nick) || '', (state.me && state.me.theme && state.me.theme.avatar) || ''].join('|');
  }

  function resultsHtml(state) {
    var players = visiblePlayers(state);
    var active = D.activeFilters(filterOf(state));
    var q = String(filterOf(state).query || '').trim();
    var f = filterOf(state);
    /* 예전에 저장된 프로필에는 성별이 없습니다. 필터 결과가 비었을 때 이유를 알려줍니다. */
    var anyGender = (state.data.matchProfiles || []).some(function (p) {
      return D.normalizeGender(p.gender) !== '비공개';
    });
    /* 아직 아무도 없을 때는 '조건' 문제가 아니므로 첫 행동을 알려 줍니다 */
    var nobody = !(state.data.matchProfiles || []).some(function (p) { return p.userKey !== meKey(state); });
    var emptySub = nobody
      ? '첫 번째 선수가 되어 보세요. 내 카드를 만들면 여기에 상대가 나타나요.'
      : (f.gender && f.gender !== '전체' && !anyGender
        ? '아직 성별을 공개한 플레이어가 없어요. 상대가 프로필에서 성별을 공개하면 여기에 보여요.'
        : (q ? '다른 낱말로 찾아보거나 조건을 풀어 보세요.' : '급수·지역 조건을 바꿔 보세요.'));

    return '<div class="resultbar">' +
      '<p>' +
      (q ? '<span class="resultbar__q">“' + U.esc(q) + '” 검색 결과</span><span class="resultbar__dot">·</span>' : '') +
      '<b>' + players.length + '</b>명 찾음' +
      (active.length ? ' <span class="muted">· 조건 ' + active.length + '개</span>' : '') +
      '</p>' +
      '<div class="sortseg" role="group" aria-label="정렬 기준">' +
      '<button type="button" class="sortseg__b' + (sortOf(state) === 'score' ? ' is-on' : '') + '" data-sort="score">궁합순</button>' +
      '<button type="button" class="sortseg__b' + (sortOf(state) === 'recent' ? ' is-on' : '') + '" data-sort="recent">최근순</button>' +
      '</div></div>' +
      (players.length
        ? '<div class="pcards">' + players.map(function (p) { return playerCard(p, state); }).join('') + '</div>'
        : UI.emptyState('search', nobody ? '아직 등록된 선수가 없어요' : '조건에 맞는 플레이어가 없어요', emptySub,
          nobody
            ? '<button type="button" class="btn btn--primary btn--sm mt8" data-act="edit-match">내 매칭 카드 만들기</button>'
            : '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="reset-filter">조건 초기화</button>'));
  }

  /* ---------- 찾기 탭 ---------- */
  function findTab(state) {
    return '<section class="card">' +
      '<header class="card__head"><h2>플레이어 찾기</h2>' +
      '<span class="muted sm">급수 · 지역 · 종목</span></header>' +
      searchBar(state) + filterBar(state) +
      '<div data-region="results" data-sig="' + U.esc(resultsSig(state)) + '">' + resultsHtml(state) + '</div>' +
      '</section>';
  }

  /* ---------- 요청 목록 ---------- */
  function reqRow(state, r, kind) {
    var other = kind === 'in' ? r.userKey : r.target;
    var p = personOf(state, other);
    var note = (r.payload && r.payload.note) || '';
    var status = r.status || '대기';
    var act;
    if (kind === 'in') {
      act = '<button type="button" class="btn btn--ghost btn--sm" data-decline="' + U.esc(r.id) + '">거절</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-accept="' + U.esc(r.id) + '">수락</button>';
    } else if (status === '수락') {
      act = '<button type="button" class="btn btn--ghost btn--sm" data-open-chat="' + U.esc(r.id) + '" data-other="' + U.esc(other) + '">' +
        '채팅하기</button>';
    } else {
      act = '<span class="rq__status' + (status === '거절' ? ' is-off' : status === '수락' ? ' is-ok' : '') + '">' +
        U.esc(status) + '</span>';
    }
    return '<li class="rq" data-open-profile="' + U.esc(other) + '">' + UI.avatar(p, 44) +
      '<div class="rq__mid">' +
      '<div class="rq__name">' + U.esc(p.nick) + gradePill(p) +
      (p.discipline ? '<span class="rq__disc">' + U.esc(p.discipline) + '</span>' : '') + '</div>' +
      (note ? '<p class="rq__note">' + U.esc(note) + '</p>' : '') +
      '<p class="rq__meta">' + U.esc(U.timeAgo(r.createdAt) || '') +
      (kind === 'in' ? ' · 수락하면 대화가 열려요' : '') + '</p></div>' +
      '<div class="rq__act">' + act + '</div></li>';
  }

  function reqList(state, kind) {
    var list = kind === 'in' ? pendingIncoming(state) : sentRequests(state);
    if (!list.length) {
      return kind === 'in'
        ? UI.emptyState('community', '받은 요청이 없어요', '요청을 보내면 상대가 수락할 때 대화가 열려요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>')
        : UI.emptyState('send', '보낸 요청이 없어요', '마음에 드는 상대의 프로필을 보고 요청을 보내보세요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>');
    }
    return '<ul class="rqlist">' + list.map(function (r) { return reqRow(state, r, kind); }).join('') + '</ul>';
  }

  function reqTab(state, kind) {
    var list = kind === 'in' ? pendingIncoming(state) : sentRequests(state);
    return '<section class="card" data-region="reqbody" data-sig="' + reqSig(state, kind) + '">' +
      '<header class="card__head"><h2>' + (kind === 'in' ? '받은 요청' : '보낸 요청') + '</h2>' +
      '<span class="muted sm">' + list.length + '건</span></header>' +
      reqList(state, kind) + '</section>';
  }

  function reqSig(state, kind) {
    return kind + '|' + (state.data.requests || []).map(function (r) {
      return r.id + ':' + r.status;
    }).join(',') + '|' + (state.data.matchProfiles || []).length;
  }

  /* ---------- 대화 탭 ---------- */
  function roomList(state) {
    var rooms = state.data.threads || [];
    if (!rooms.length) {
      return UI.emptyState('community', '대화가 없어요', '매칭이 성사되면 여기서 바로 대화할 수 있어요.',
        '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>');
    }
    return '<ul class="roomlist">' + rooms.map(function (r) {
      var rp = personOf(state, r.other);
      return '<li class="room" data-open-chat="' + U.esc(r.roomId) + '" data-other="' + U.esc(r.other) + '">' +
        UI.avatar(rp, 42) +
        '<div class="room__mid"><strong>' + U.esc(rp.nick) +
        (rp.level ? ' <span class="pill pill--grade">' + U.esc(rp.level) + '</span>' : '') + '</strong>' +
        '<p>' + U.esc(U.truncate((r.last && r.last.text) || '대화를 시작해 보세요', 34)) + '</p></div>' +
        '<div class="room__right"><time>' + U.timeAgo(r.at) + '</time>' +
        (r.unread ? '<span class="badge">' + r.unread + '</span>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }

  function chatTab(state) {
    return '<section class="card" data-region="reqbody" data-sig="' + roomsSig(state) + '">' +
      '<header class="card__head"><h2>대화</h2>' +
      (state.data.unread ? '<span class="badge">' + state.data.unread + ' 새 메시지</span>' : '') + '</header>' +
      roomList(state) + '</section>';
  }

  function roomsSig(state) {
    return (state.data.threads || []).map(function (r) {
      return r.roomId + ':' + r.unread + ':' + r.at + ':' + ((r.last && r.last.text) || '');
    }).join(',');
  }

  /* ---------- 탭 줄 ---------- */
  function tabCounts(state) {
    var me = meKey(state);
    var reqs = state.data.requests || [];
    return {
      'in': reqs.filter(function (r) { return r.target === me && r.status === '대기'; }).length,
      out: reqs.filter(function (r) { return r.userKey === me && r.status === '대기'; }).length,
      chat: (state.data.threads || []).length
    };
  }

  function tabsSig(state) {
    var c = tabCounts(state);
    return tabOf(state) + '|' + c['in'] + '|' + c.out + '|' + c.chat;
  }

  function tabButtons(state) {
    var now = tabOf(state);
    var c = tabCounts(state);
    function b(id, label, n) {
      return '<button type="button" role="tab" class="mtab' + (now === id ? ' is-on' : '') + '"' +
        ' data-match-tab="' + id + '" aria-selected="' + (now === id ? 'true' : 'false') + '">' + label +
        (n ? '<i class="mtab__n">' + n + '</i>' : '') + '</button>';
    }
    return b('find', '찾기') + b('in', '받은 요청', c['in']) + b('out', '보낸 요청', c.out) + b('chat', '대화', c.chat);
  }

  function statusTabs(state) {
    return '<div class="mtabs" role="tablist" aria-label="매칭 상태" data-region="tabs" data-sig="' +
      U.esc(tabsSig(state)) + '">' + tabButtons(state) + '</div>';
  }

  /* ---------- 프로필 시트(요청 전 확인) ---------- */
  function profileBody(state, p) {
    var st = statusOf(state, p);
    var mp = myProfile(state);
    var scored = D.matchScore(mp, p, mp);
    var hearts = state.data.hearts || { balance: 0, matchCost: D.HEART_RULES.MATCH_COST };
    var cost = D.HEART_RULES.MATCH_COST;
    var balance = hearts.balance || 0;
    var key = U.esc(p.userKey);
    var sent = st.mine && st.mine.status !== '거절' ? st.mine : null;
    var short = balance < cost;
    var canRequest = !st.incoming && !st.canChat && !sent;

    var footer;
    if (st.incoming) {
      footer = '<div class="pp__note">' + UI.icon('clock') + '상대가 먼저 요청했어요. 수락하면 바로 대화할 수 있어요.</div>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-decline="' + U.esc(st.incoming.id) + '">거절</button>' +
        '<button class="btn btn--primary grow" data-accept="' + U.esc(st.incoming.id) + '">수락하고 대화하기</button></div>';
    } else if (st.canChat) {
      footer = '<div class="pp__note pp__note--ok">' + UI.icon('check') +
        (st.friend.state === 'friends' ? '친구예요. 바로 1:1 대화를 할 수 있어요.' : '매칭이 성사됐어요. 바로 1:1 대화를 할 수 있어요.') + '</div>' +
        (st.roomId ? '<button class="btn btn--primary btn--big mt8" data-open-chat="' + U.esc(st.roomId) + '" data-other="' + key + '">채팅 시작</button>' : '');
    } else if (sent) {
      footer = '<div class="pp__note">' + UI.icon('clock') + '보낸 요청이에요 · 상태 <b>' + U.esc(sent.status) + '</b></div>' +
        '<button class="btn btn--ghost btn--big mt8" data-close>닫기</button>';
    } else {
      footer = '<label class="flabel">한마디 남기기 <span class="muted">(선택)</span>' +
        '<input type="text" data-note maxlength="60" placeholder="토요일 오전 어떠세요?" value="' + U.esc(noteDrafts[p.userKey] || '') + '"></label>' +
        '<p class="pp__cost">매칭 신청에 하트 <b>' + cost + '개</b> · 보유 <b class="' + (short ? 'down' : 'up') + '">' + balance + '개</b>' +
        (short ? '<span class="warn"> · ' + (cost - balance) + '개 부족</span>' : '') + '</p>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-close>닫기</button>' +
        (short
          ? '<button class="btn btn--primary grow" data-charge-hearts="' + key + '">하트 충전하기</button>'
          : '<button class="btn btn--primary grow" data-send-request="' + key + '">요청 보내기</button>') +
        '</div>' +
        (short ? '' : '<button class="linkbtn mt8" data-gift-in-sheet="' + key + '">하트 선물하기 (' + D.HEART_RULES.GIFT_COST + '개)</button>');
    }

    return '<div class="pp" data-profile="' + key + '">' +
      '<div class="pp__head">' + UI.avatar(p, 72) +
      '<div class="pp__id"><div class="pp__name">' + U.esc(p.nick) + '</div>' +
      '<div class="pp__pills">' + gradePill(p) + genderPill(p) + '</div>' +
      '<p class="pp__meta">' + U.esc([p.region, p.club].filter(Boolean).join(' · ') || '지역 미입력') + '</p>' +
      '</div></div>' +
      '<p class="pp__match">궁합 <b>' + scored.score + '</b>' +
      (scored.reasons.length ? '<span class="pp__why">' + U.esc(scored.reasons.slice(0, 3).join(' · ')) + '</span>' : '') + '</p>' +
      /* 하트 소모 안내는 요청 버튼까지 스크롤하지 않아도 보이게 맨 위에 둡니다 */
      (canRequest
        ? '<p class="pp__cost pp__cost--top">' + UI.icon('heart') + '매칭 신청에 하트 <b>' + cost + '개</b> · 보유 <b class="' + (short ? 'down' : 'up') + '">' + balance + '개</b>' +
          (short ? '<span class="warn"> · ' + (cost - balance) + '개 부족</span>' : '') + '</p>'
        : '') +

      '<dl class="pp__spec">' +
      '<div><dt>주력 종목</dt><dd>' + (p.discipline
        ? '<span class="eventchip eventchip--lg is-on">' + U.esc(p.discipline) + '</span>'
        : '<span class="muted">미입력</span>') + '</dd></div>' +
      '<div><dt>급수</dt><dd>' + U.esc(p.level || '미입력') + '</dd></div>' +
      '<div><dt>경력</dt><dd>' + U.esc(p.experience || '미입력') + '</dd></div>' +
      '<div><dt>가능 시간</dt><dd>' + U.esc(p.availability || '미입력') + '</dd></div>' +
      '</dl>' +

      (p.bio ? '<p class="pp__bio">' + U.esc(p.bio) + '</p>' : '') +
      '<div class="pp__social">' + (BM.views.profile ? BM.views.profile.buttons(state, p.userKey, { noHint: true }) : '') + '</div>' +
      '<div class="pp__foot">' + footer + '</div></div>';
  }

  function openProfile(p, ctx) {
    UI.openSheet({
      title: '선수 프로필',
      body: profileBody(ctx.store.state, p),
      onMount: function (wrap) {
        if (BM.views.profile) BM.views.profile.bind(wrap, ctx);
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
            if (res.ok) UI.toast('요청을 보냈어요. 상대가 수락하면 대화할 수 있어요.');
            else if (res.reason === 'already') UI.toast('이미 요청한 상대예요.');
            else if (res.reason === 'hearts') UI.toast('하트가 ' + res.need + '개 부족해요.', 'error');
            else if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
            return;
          }
          var charge = ev.target.closest('[data-charge-hearts]');
          if (charge) {
            ev.preventDefault();
            var inputNow = wrap.querySelector('[data-note]');
            if (inputNow) noteDrafts[p.userKey] = inputNow.value;
            UI.closeSheet();
            openHeartSheet(ctx, p.userKey);
            return;
          }
          if (ev.target.closest('[data-close]')) {
            ev.preventDefault();
            UI.closeSheet();
            return;
          }
          var accept = ev.target.closest('[data-accept]');
          if (accept) {
            ev.preventDefault();
            UI.closeSheet();
            acceptRequest(ctx, accept.getAttribute('data-accept'));
            return;
          }
          var decline = ev.target.closest('[data-decline]');
          if (decline) {
            ev.preventDefault();
            UI.closeSheet();
            declineRequest(ctx, decline.getAttribute('data-decline'));
            return;
          }
          var chat = ev.target.closest('[data-open-chat]');
          if (chat) {
            ev.preventDefault();
            UI.closeSheet();
            ctx.actions.openChat(chat.getAttribute('data-open-chat'), chat.getAttribute('data-other'));
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
              if (r.ok) { UI.closeSheet(); UI.toast('하트를 선물했어요'); }
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

  /* ---------- 수락/거절 ---------- */
  function acceptRequest(ctx, reqId) {
    var req = (ctx.store.state.data.requests || []).filter(function (r) { return r.id === reqId; })[0] || {};
    var res = ctx.actions.respondMatch(reqId, '수락');
    if (!res || !res.ok) { UI.toast('잠시 후 다시 시도해 주세요', 'error'); return; }
    UI.haptic(12);
    UI.toast('수락했어요. 대화를 시작해 보세요.');
    if (res.roomId) {
      ctx.actions.openChat(res.roomId, req.userKey || '');
      ctx.actions.markChatRead(res.roomId, req.userKey || '');
    }
  }

  function declineRequest(ctx, reqId) {
    var res = ctx.actions.respondMatch(reqId, '거절');
    if (!res || !res.ok) { UI.toast('잠시 후 다시 시도해 주세요', 'error'); return; }
    UI.toast('요청을 거절했어요.');
  }

  /* ---------- 하트 충전(출석·광고) ---------- */
  function adLabel(h) {
    if (!h.adRemaining) return '오늘 다 받았어요';
    if (h.nextAdInSec > 0) return h.nextAdInSec + '초 후';
    return '남은 ' + h.adRemaining + '회';
  }

  function openHeartSheet(ctx, backKey) {
    var h = ctx.store.state.data.hearts || {};
    var cost = D.HEART_RULES.MATCH_COST;
    var balance = h.balance || 0;
    var enough = balance >= cost;
    var body = '<p class="sheet__text">매칭 신청에는 하트 ' + cost + '개가 필요해요. 지금 <b>' + balance + '개</b> 있어요.</p>' +
      '<div class="charge">' +
      '<button type="button" class="charge__row" data-charge="checkin"' + (h.canCheckIn ? '' : ' disabled') + '>' +
      '<span class="charge__t">출석 체크</span>' +
      '<span class="charge__d">' + (h.checkedInToday ? '오늘 완료' : '하루 1회') + '</span>' +
      '<b class="charge__n">+' + (h.checkinReward || D.HEART_RULES.CHECKIN) + '</b></button>' +
      '<button type="button" class="charge__row" data-charge="ad"' + (h.canWatchAd ? '' : ' disabled') + '>' +
      '<span class="charge__t">광고 보고 받기</span>' +
      '<span class="charge__d">' + U.esc(adLabel(h)) + '</span>' +
      '<b class="charge__n">+' + (h.adReward || D.HEART_RULES.AD_REWARD) + '</b></button>' +
      '</div>' +
      '<p class="hint">' + (enough ? '지금 바로 요청을 보낼 수 있어요.' : '두 개를 모두 받으면 ' + (cost - balance) + '개를 채울 수 있어요.') + '</p>' +
      (backKey && enough ? '<button type="button" class="btn btn--primary btn--big mt8" data-charge="back">프로필로 돌아가기</button>'
        : '<button type="button" class="btn btn--ghost btn--big mt8" data-charge="my">MY에서 잔액 보기</button>');

    UI.openSheet({
      title: '하트 충전',
      body: body,
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          var b = ev.target.closest('[data-charge]');
          if (!b) return;
          ev.preventDefault();
          var kind = b.getAttribute('data-charge');
          if (b.disabled) return;
          if (kind === 'my') {
            UI.closeSheet();
            ctx.actions.setTab('my');
            UI.toast('MY 화면 하트 카드에서 충전할 수 있어요');
            return;
          }
          if (kind === 'back') {
            UI.closeSheet();
            var p = profileOf(ctx.store.state, backKey);
            if (p) openProfile(p, ctx);
            return;
          }
          if (kind === 'checkin') {
            var ci = ctx.actions.checkIn();
            if (ci.ok) { UI.toast('출석 체크 완료 · 하트 +' + ci.gained); UI.haptic(12); UI.closeSheet(); openHeartSheet(ctx, backKey); }
            else if (ci.reason === 'done') UI.toast('오늘은 이미 출석했어요');
            else UI.toast('잠시만요');
            return;
          }
          if (kind === 'ad') {
            /* js/ads.js 어댑터: 네이티브 브리지가 있으면 그쪽, 웹에서는 3초 미리보기 */
            var myView = BM.views.my;
            if (b.classList.contains('is-busy')) return;
            b.classList.add('is-busy');
            var play = (BM.ads && BM.ads.showRewarded)
              ? BM.ads.showRewarded({ unit: 'heart_reward' })
              : ((myView && myView.playRewardAd) ? myView.playRewardAd() : Promise.resolve(null));
            play.then(function (r) {
              if (!r || !r.rewarded) { b.classList.remove('is-busy'); return; }
              var res = ctx.actions.watchAd({ verified: true, adUnit: r.adUnit });
              b.classList.remove('is-busy');
              if (res.ok) { UI.toast('하트 +' + res.gained); UI.haptic(12); UI.closeSheet(); openHeartSheet(ctx, backKey); }
              else if (res.reason === 'limit') UI.toast('오늘 몫을 모두 받았어요');
              else if (res.reason === 'cooldown') UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
              else UI.toast('잠시만요');
            });
          }
        });
      }
    });
  }

  /* ---------- 내 매칭 카드 ---------- */
  function myCardSig(state) {
    var mp = myProfile(state);
    return [state.data.hearts ? state.data.hearts.balance : 0, mp.level, mp.discipline,
      mp.region, D.normalizeGender(mp.gender), (state.me && state.me.nick) || ''].join('|');
  }

  function myCardInner(state) {
    var mp = myProfile(state);
    var me = state.me || {};
    var hearts = state.data.hearts || { balance: 0 };
    var balance = hearts.balance || 0;
    var cost = D.HEART_RULES.MATCH_COST;
    var ready = !!(mp.level && mp.discipline && mp.region);
    var meta = [D.normalizeGender(mp.gender) === '비공개' ? '' : D.normalizeGender(mp.gender),
      mp.discipline, mp.region].filter(Boolean);

    return '<div class="mycard">' + UI.avatar(mp.rowId ? mp : me, 46) +
      '<div class="mycard__id">' +
      '<div class="mycard__name">' + U.esc(me.nick || '회원') + (mp.level ? gradePill(mp) : '') + '</div>' +
      '<p class="mycard__meta">' + U.esc(meta.length ? meta.join(' · ') : '매칭 카드가 아직 없어요') + '</p></div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="edit-match">' + (mp.level || mp.region ? '수정' : '만들기') + '</button></div>' +
      (ready ? '' : '<p class="mycard__hint">급수·종목·지역을 등록하면 맞는 상대부터 보여드려요.</p>') +
      '<div class="mycard__hearts">하트 <b>' + balance + '</b><span>· 신청 1회 ' + cost + '개</span>' +
      (balance < cost ? '<button type="button" class="linkbtn" data-act="charge-hearts">충전</button>' : '') +
      '</div>';
  }

  function myCard(state) {
    return '<section class="card card--match"><div data-region="mycard" data-sig="' +
      U.esc(myCardSig(state)) + '">' + myCardInner(state) + '</div></section>';
  }

  /* ---------- 화면 ---------- */
  var view = {
    title: '1:1 매칭',

    render: function (state) {
      var tab = tabOf(state);
      var body;
      if (tab === 'in') body = reqTab(state, 'in');
      else if (tab === 'out') body = reqTab(state, 'out');
      else if (tab === 'chat') body = chatTab(state);
      else body = findTab(state);

      return myCard(state) + statusTabs(state) + body;
    },

    mount: function (root, ctx) {
      root.addEventListener('click', function (ev) {
        /* 탭 */
        var tab = ev.target.closest('[data-match-tab]');
        if (tab) {
          ev.preventDefault();
          ctx.actions.setMatchTab(tab.getAttribute('data-match-tab'));
          if (ctx.refresh) ctx.refresh();
          UI.haptic(6);
          return;
        }

        /* 정렬 */
        var sort = ev.target.closest('[data-sort]');
        if (sort) {
          ev.preventDefault();
          ctx.actions.setMatchSort(sort.getAttribute('data-sort'));
          UI.haptic(6);
          return;
        }

        /* 필터 줄 펼치기 */
        var open = ev.target.closest('[data-filter-open]');
        if (open) {
          ev.preventDefault();
          ctx.actions.setFilterPanel(open.getAttribute('data-filter-open'));
          UI.haptic(6);
          return;
        }

        var chip = ev.target.closest('[data-filter]');
        if (chip) {
          ev.preventDefault();
          var patch = {};
          patch[chip.getAttribute('data-filter')] = chip.getAttribute('data-value');
          ctx.actions.setFilter(patch);
          UI.haptic(6);
          return;
        }

        if (ev.target.closest('[data-act="clear-search"]')) {
          ev.preventDefault();
          var input = root.querySelector('[data-search-input]');
          if (input) input.value = '';
          ctx.actions.setMatchQuery('');
          UI.haptic(6);
          return;
        }

        if (ev.target.closest('[data-act="reset-filter"]')) {
          ev.preventDefault();
          var box = root.querySelector('[data-search-input]');
          if (box) box.value = '';
          ctx.actions.resetMatchFilter();
          UI.toast('조건을 초기화했어요');
          UI.haptic(6);
          return;
        }

        if (ev.target.closest('[data-act="charge-hearts"]')) {
          ev.preventDefault();
          openHeartSheet(ctx, '');
          return;
        }

        /* 수락·거절은 카드(프로필 열기)보다 먼저 처리합니다 */
        var accept = ev.target.closest('[data-accept]');
        if (accept) {
          ev.preventDefault();
          acceptRequest(ctx, accept.getAttribute('data-accept'));
          return;
        }
        var decline = ev.target.closest('[data-decline]');
        if (decline) {
          ev.preventDefault();
          declineRequest(ctx, decline.getAttribute('data-decline'));
          return;
        }

        /* 채팅 버튼도 카드 안에 있으므로 먼저 확인합니다 */
        var chat = ev.target.closest('[data-open-chat]');
        if (chat) {
          ev.preventDefault();
          var roomId = chat.getAttribute('data-open-chat');
          var other = chat.getAttribute('data-other');
          if (!roomId) return;
          ctx.actions.openChat(roomId, other);
          if (other) ctx.actions.markChatRead(roomId, other);
          UI.haptic(8);
          return;
        }

        var profileTarget = ev.target.closest('[data-open-profile]');
        if (profileTarget) {
          ev.preventDefault();
          var key = profileTarget.getAttribute('data-open-profile');
          var p = profileOf(ctx.store.state, key) || personOf(ctx.store.state, key);
          if (p) openProfile(p, ctx);
          return;
        }

        if (ev.target.closest('[data-act="edit-match"]')) {
          ev.preventDefault();
          openMatchProfileSheet(ctx);
          return;
        }
      });

      /* 검색은 한 글자씩 바로 반영합니다 (입력창은 다시 그리지 않아 포커스가 유지됩니다) */
      var search = root.querySelector('[data-search-input]');
      if (search) {
        var syncClear = function () {
          var clearBtn = root.querySelector('[data-act="clear-search"]');
          var wrap = search.parentNode;
          if (clearBtn) clearBtn.hidden = !search.value;
          if (wrap) wrap.classList.toggle('is-filled', !!search.value);
        };
        search.addEventListener('input', function () {
          syncClear();
          ctx.actions.setMatchQuery(search.value);
        }, { passive: true });
        search.addEventListener('search', function () {
          syncClear();
          ctx.actions.setMatchQuery(search.value);
        });
      }
    },

    /* 필터·검색·신청 상태가 바뀌면 결과 영역만 다시 그립니다.
     * 검색창과 필터 줄은 건드리지 않아 입력 포커스와 펼친 상태가 유지됩니다. */
    update: function (root, state, ctx) {
      var card = root.querySelector('[data-region="mycard"]');
      if (card) {
        var cs = myCardSig(state);
        if (card.getAttribute('data-sig') !== cs) {
          card.innerHTML = myCardInner(state);
          card.setAttribute('data-sig', cs);
        }
      }

      var tabs = root.querySelector('[data-region="tabs"]');
      if (tabs) {
        var ts = tabsSig(state);
        if (tabs.getAttribute('data-sig') !== ts) {
          tabs.innerHTML = tabButtons(state);
          tabs.setAttribute('data-sig', ts);
        }
      }

      var filters = root.querySelector('[data-region="filters"]');
      if (filters) {
        var fs = filterSig(state);
        if (filters.getAttribute('data-sig') !== fs) {
          filters.innerHTML = filterBarOnly(state);
          filters.setAttribute('data-sig', fs);
        }
      }

      var results = root.querySelector('[data-region="results"]');
      if (results) {
        var rs = resultsSig(state);
        if (results.getAttribute('data-sig') !== rs) {
          results.innerHTML = resultsHtml(state);
          results.setAttribute('data-sig', rs);
        }
      }

      var body = root.querySelector('[data-region="reqbody"]');
      if (body) {
        var tab = tabOf(state);
        var sig = tab === 'chat' ? roomsSig(state) : reqSig(state, tab);
        if (body.getAttribute('data-sig') !== sig) {
          if (tab === 'chat') {
            body.innerHTML = '<header class="card__head"><h2>대화</h2>' +
              (state.data.unread ? '<span class="badge">' + state.data.unread + ' 새 메시지</span>' : '') +
              '</header>' + roomList(state);
          } else {
            var list = tab === 'in' ? pendingIncoming(state) : sentRequests(state);
            body.innerHTML = '<header class="card__head"><h2>' + (tab === 'in' ? '받은 요청' : '보낸 요청') + '</h2>' +
              '<span class="muted sm">' + list.length + '건</span></header>' + reqList(state, tab);
          }
          body.setAttribute('data-sig', sig);
        }
      }
    },

    /* 테스트/다른 화면에서 재사용 */
    profileBody: profileBody,
    playerCard: playerCard,
    statusOf: statusOf,
    resultsHtml: resultsHtml,
    visiblePlayers: visiblePlayers,
    pendingIncoming: pendingIncoming,
    sentRequests: sentRequests
  };

  function filterBarOnly(state) {
    var f = filterOf(state);
    var open = state.ui.matchFilterOpen || '';
    var active = D.activeFilters(f);
    function button(key, label) {
      var v = valueOf(f, key);
      /* 값이 없으면 이름만 — 버튼 네 개가 한 줄에 다 들어가고 화면이 덜 빽빽합니다 */
      return '<button type="button" class="fbtn' + (v ? ' is-on' : '') + (open === key ? ' is-open' : '') + '"' +
        ' data-filter-open="' + key + '" aria-expanded="' + (open === key ? 'true' : 'false') + '"' +
        ' aria-label="' + label + ' 필터' + (v ? ' · ' + U.esc(v) : '') + '">' +
        label + (v ? '<b>' + U.esc(v) + '</b>' : '') + UI.icon('arrow', 'fbtn__car') + '</button>';
    }
    function line(kr, key, options) {
      var current = f[key] || '전체';
      return '<div class="filter-line' + (open === key ? ' is-active' : '') + '">' +
        '<span class="filter-line__label">' + kr + '</span><div class="scrollx">' +
        ['전체'].concat(options).map(function (o) {
          return '<button type="button" class="chip chip--sm' + (current === o ? ' is-on' : '') + '"' +
            ' data-filter="' + key + '" data-value="' + U.esc(o) + '"' +
            ' aria-pressed="' + (current === o ? 'true' : 'false') + '">' + U.esc(o) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="fbar">' +
      button('level', '급수') + button('region', '지역') + button('discipline', '종목') + button('gender', '성별') +
      '</div>' +
      '<div class="fpanel' + (open ? ' is-open' : '') + '">' +
      line('급수', 'level', D.VOCAB.grades) +
      line('지역', 'region', D.VOCAB.regions) +
      line('종목', 'discipline', D.VOCAB.disciplines) +
      line('성별', 'gender', (D.VOCAB.genderFilter || ['전체', '남성', '여성']).slice(1)) +
      '</div>' +
      (active.length ? '<p class="fsum">' + active.map(function (a) {
        return '<span class="fsum__chip">' + U.esc(a.key === 'query' ? '“' + a.value + '”' : a.value) + '</span>';
      }).join('') + '<button type="button" class="linkbtn" data-act="reset-filter">조건 초기화</button></p>' : '');
  }

  /* ---------- 내 매칭 카드 편집 ---------- */
  function openMatchProfileSheet(ctx) {
    var me = ctx.store.state.me || {};
    var myMp = myProfile(ctx.store.state);
    var payload = {
      region: myMp.region || '경기',
      level: myMp.level || me.level || 'C조',
      discipline: myMp.discipline || me.discipline || '복식',
      gender: myMp.gender || '비공개',
      availability: myMp.availability || '주말',
      experience: myMp.experience || '2~5년',
      club: myMp.club || '',
      bio: myMp.bio || '',
      avatar: myMp.avatar || (me.theme && me.theme.avatar) || '🏸',
      avatarPhoto: myMp.avatarPhoto || '',
      avatarFrame: myMp.avatarFrame || 'basic',
      avatarBg: myMp.avatarBg || 'plain',
      avatarBadge: myMp.avatarBadge || ''
    };
    function chips(key, values) {
      return '<div class="scrollx">' + values.map(function (v) {
        return '<button type="button" class="chip chip--sm' + (payload[key] === v ? ' is-on' : '') + '"' +
          ' data-mp="' + key + '" data-v="' + U.esc(v) + '">' + U.esc(v) + '</button>';
      }).join('') + '</div>';
    }
    UI.openSheet({
      title: '내 매칭 카드',
      body: '<div class="sheethero">' + UI.avatar(payload, 64) +
        '<div><strong>' + U.esc(me.nick || '회원') + '</strong>' +
        '<p class="hint">사진·프레임은 MY &gt; 프로필 꾸미기에서 바꿀 수 있어요.</p></div></div>' +
        '<div class="form">' +
        '<label class="flabel">성별' + chips('gender', D.VOCAB.genders) + '</label>' +
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
            Array.prototype.forEach.call(wrap.querySelectorAll('[data-mp-text]'), function (inp) {
              payload[inp.getAttribute('data-mp-text')] = inp.value.trim();
            });
            ctx.actions.saveMatchProfile(payload);
            /* 성별·지역은 프로필에도 같이 남겨 MY 화면과 어긋나지 않게 합니다 */
            ctx.actions.saveProfile({
              gender: payload.gender, region: payload.region,
              level: payload.level, discipline: payload.discipline,
              bio: payload.bio, club: payload.club
            });
            UI.closeSheet();
            UI.toast('매칭 카드를 저장했어요.');
          }
        });
      }
    });
  }

  view.openProfile = openProfile;
  view.openHeartSheet = openHeartSheet;
  view.profileBody = profileBody;   /* 테스트·점검용 (프로필 시트 본문) */
  BM.views.matching = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
