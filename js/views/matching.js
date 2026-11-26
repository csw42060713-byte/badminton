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
      gender: '비공개', style: D.normalizeStyle(d.theme && d.theme.style), theme: d.theme || null
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

  /* 수락한 지 얼마 안 된 편지 — 목록에서 사라지지 않고 '1:1 대화하기'로 이어 줍니다 */
  function acceptedIncoming(state, limit) {
    var me = meKey(state);
    return U.sortBy((state.data.requests || []).filter(function (r) {
      return r.target === me && r.status === '수락';
    }), function (r) { return r.createdAt || ''; }, true).slice(0, limit || 3);
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

  function activeFilterCount(state) {
    return D.activeFilters(filterOf(state)).length;
  }

  /* 처음 들어오면 아무 조건도 고르지 않은 '안내' 상태입니다.
   * 급수·지역·종목·성별을 고르거나 검색어를 넣거나 '전체'를 누르면 목록이 나옵니다. */
  function searchStarted(state) {
    return D.matchSearchActive(filterOf(state), state.ui.matchStarted);
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
    return [f.level || '', f.gender || '', f.region || '', f.discipline || '',
      state.ui.matchFilterOpen || '', searchStarted(state) ? '1' : '0'].join('|');
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

  /* 지역 · 주 체육관 — 체육관 이름이 등록된 체육관과 이어지면 눌러서 지도를 엽니다 */
  function metaHtml(p) {
    var parts = [];
    if (p && p.region) parts.push(U.esc(p.region));
    if (p && p.club) parts.push((BM.views && BM.views.gyms && BM.views.gyms.link(p.club)) || U.esc(p.club));
    return parts.join(' · ');
  }

  /* '주 체육관' 칸 — 이름을 누르면 지도로 (지역·주소·코트 수 확인) */
  function clubHtml(p) {
    var club = p && p.club;
    if (!club) return '<span class="muted">미입력</span>';
    var link = (BM.views && BM.views.gyms) ? BM.views.gyms.link(club) : '';
    return link || U.esc(club);
  }

  /* ---------- 목록 카드 ---------- */
  function heartBuyText(state) {
    var hearts = state.data.hearts || {};
    var cost = D.HEART_RULES.MATCH_COST;
    var balance = hearts.balance || 0;
    return { cost: cost, balance: balance, short: balance < cost };
  }
  /* bm-v1.80.0 — 다른 사람의 커스텀 라켓 한 자루 (급수·지역 옆에 작게) */
  function racketMini(state, userKey) {
    if (!BM.racketcustom) return '';
    return '<span class="pcard__rk" data-rk-person="' + U.esc(userKey) + '">' +
      BM.racketcustom.personHtml(state, userKey) + '</span>';
  }

  function playerCard(p, state) {
    var st = statusOf(state, p);
    var mp = myProfile(state);
    var scored = D.matchScore(mp, p, mp);
    var key = U.esc(p.userKey);
    var meta = metaHtml(p);
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
      /* 요청 전에 하트가 어떻게 드는지 카드에서 바로 보이게 (수락될 때 차감) */
      var hb = heartBuyText(state);
      costNote = '<span class="pcard__cost">' + UI.icon('heart') + '수락 시 하트 ' + hb.cost + '개 차감 · 보유 ' + hb.balance + '개' +
        (hb.short ? ' <b class="down">· ' + (hb.cost - hb.balance) + '개 부족</b>' : '') + '</span>';
    }

    return '<article class="pcard" data-player="' + key + '" data-open-profile="' + key + '">' +
      '<div class="pcard__top">' + UI.avatar(p, 50) +
      '<div class="pcard__id"><div class="pcard__name">' + U.esc(p.nick) +
      gradePill(p) + genderPill(p) +
      (st.friend.state === 'friends' ? '<span class="pill pill--friend">친구</span>' : '') + '</div>' +
      '<p class="pcard__meta">' + racketMini(state, p.userKey) + (meta || '지역 미입력') + '</p></div>' +
      '<div class="pcard__side"><div class="fit"><strong>' + scored.score + '</strong><span>궁합</span></div>' +
      /* bm-v1.79.0 — 요청 전에도 부담 없이 건네는 '응원 하트 1개'(카드 안에서 바로) */
      '<button type="button" class="cheerbtn cheerbtn--sm" data-cheer="' + key + '"' +
      ' aria-label="' + U.esc(p.nick) + '님에게 응원 하트 ' + D.HEART_RULES.GIFT_COST + '개 보내기">' +
      '<span class="cheerbtn__ico" aria-hidden="true">💛</span>응원</button></div></div>' +
      (p.discipline || p.style || spec ? '<p class="pcard__spec">' +
        (p.discipline ? '<span class="eventchip is-on">' + U.esc(p.discipline) + '</span>' : '') +
        (p.style ? '<span class="pill pill--style">' + U.esc(p.style) + '</span>' : '') +
        (spec ? '<span class="pcard__spec-t">' + U.esc(spec) + '</span>' : '') + '</p>' : '') +
      (p.bio ? '<p class="pcard__bio">' + U.esc(p.bio) + '</p>' : '') +
      (scored.reasons.length ? '<p class="pcard__why">' + U.esc(scored.reasons.slice(0, 2).join(' · ')) + '</p>' : '') +
      '<div class="pcard__act">' + costNote + action + '</div></article>';
  }

  /* ---------- 결과 계산 ---------- */
  /* 조건에 맞는 카드 전부 (14일 미접속 숨김 전) */
  function matchedPlayers(state) {
    return D.filterPlayers(state.data.matchProfiles || [], filterOf(state), { excludeKey: meKey(state) });
  }

  /* bm-v1.59.0 — 최근 14일 안에 활동한 사람만 목록에 남깁니다.
   * 본인·친구·대화 중인 상대는 대화가 끊기지 않게 그대로 둡니다(js/domain.js). */
  function sortedPlayers(state) {
    var mp = myProfile(state);
    var list = D.withoutInactive(matchedPlayers(state), state.data.idx, meKey(state))
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
    /* 14일 미접속으로 숨는 사람이 바뀌면 목록도 다시 그립니다 (bm-v1.59.0) */
    var acts = (state.data.matchProfiles || []).map(function (p) {
      return (p.userKey || '') + ':' + (p.activityAt || '');
    }).join(',');
    return [f.level || '', f.gender || '', f.region || '', f.discipline || '', f.query || '',
      searchStarted(state) ? '1' : '0',
      sortOf(state), (state.data.matchProfiles || []).length, reqs, rooms, acts,
      (state.me && state.me.nick) || '', (state.me && state.me.theme && state.me.theme.avatar) || ''].join('|');
  }

  /* bm-v1.84.0 — 조건을 고르기 전 첫 화면에도 선수를 바로 보여 줍니다.
   *  · 예전에는 '전체를 누르세요' 안내 카드만 있어 빈 화면처럼 보였습니다.
   *  · 내 동네(지역) → 비슷한 급수 → 궁합 점수 순으로 6명을 먼저 추립니다. */
  function recommendPlayers(state, max) {
    var mp = myProfile(state);
    var me = (state && state.me) || {};
    var f = filterOf(state);
    var reg = f.region || mp.region || me.region || '';
    var lvl = D.normalizeGrade(f.level || mp.level || me.level || '');
    var list = sortedPlayers(state).map(function (x) {
      var near = 0;
      if (reg && x.p.region && x.p.region === reg) near += 2;
      if (lvl && D.normalizeGrade(x.p.level) === lvl) near += 1;
      return { p: x.p, near: near, s: x.s };
    });
    list.sort(function (a, b) {
      if (a.near !== b.near) return b.near - a.near;
      return b.s - a.s;
    });
    return list.slice(0, Math.max(1, max || 6)).map(function (x) { return x.p; });
  }

  function recommendBar(state, n) {
    return '<div class="resultbar resultbar--rec">' +
      '<p><span class="resultbar__rec">추천</span> <b>' + n + '</b>명 찾음</p>' +
      '<div class="sortseg" role="group" aria-label="정렬 기준">' +
      '<button type="button" class="sortseg__b' + (sortOf(state) === 'score' ? ' is-on' : '') + '" data-sort="score">궁합순</button>' +
      '<button type="button" class="sortseg__b' + (sortOf(state) === 'recent' ? ' is-on' : '') + '" data-sort="recent">최근순</button>' +
      '</div></div>';
  }

  /* 조건을 고르기 전 첫 화면 — 추천 선수 목록 (없을 때만 안내) */
  function defaultHtml(state) {
    var list = recommendPlayers(state, 6);
    if (!list.length) {
      var nobody = !(state.data.matchProfiles || []).some(function (p) { return p.userKey !== meKey(state); });
      var hidden = D.inactiveHiddenCount(matchedPlayers(state), state.data.idx, meKey(state));
      return (nobody
        ? UI.emptyState('search', '아직 등록된 선수가 없어요',
          '첫 번째 선수가 되어 보세요. 내 카드를 만들면 여기에 상대가 나타나요.',
          '<button type="button" class="btn btn--primary btn--sm mt8" data-act="edit-match">내 매칭 카드 만들기</button>')
        : UI.emptyState('search', hidden ? '지금은 다들 잠시 쉬는 중이에요' : '조건에 맞는 플레이어가 없어요',
          hidden
            ? '최근 ' + D.INACTIVE_HIDE_DAYS + '일 안에 활동한 분들만 보여 드려요. 상대가 다시 활동하면 여기에 나타나요.'
            : '급수·지역 조건을 바꿔 보세요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="reset-filter">조건 초기화</button>')) +
        '<p class="resultbar__quiet">조건을 고르면 그 조건에 맞춰 다시 찾아드려요.</p>';
    }
    return recommendBar(state, list.length) + inactiveNote(state) +
      '<div class="pcards pcards--rec">' + list.map(function (p) { return playerCard(p, state); }).join('') + '</div>' +
      '<p class="resultbar__quiet">내 동네 · 비슷한 급수를 먼저 보여 드려요 · ‘전체’를 누르면 모든 선수를 볼 수 있어요</p>';
  }

  /* bm-v1.59.0 — 14일 미접속으로 숨긴 사람이 있으면 목록 아래에 조용히 알려 줍니다.
   * (숨김은 탐색 목록에서만 — 친구·대화방은 그대로) */
  function inactiveNote(state) {
    var hidden = D.inactiveHiddenCount(matchedPlayers(state), state.data.idx, meKey(state));
    var days = D.INACTIVE_HIDE_DAYS;
    return '<p class="resultbar__quiet">최근 ' + days + '일 안에 활동한 분들만 보여 드려요' +
      (hidden ? ' · 쉬고 있는 ' + hidden + '명은 잠시 감춰 뒀어요' : '') + '</p>';
  }

  function resultsHtml(state) {
    if (!searchStarted(state)) return defaultHtml(state);
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
    /* 14일 미접속으로 모두 숨었을 때는 '조건' 문제가 아니므로 그 이유를 알려 줍니다 */
    var hidden = D.inactiveHiddenCount(matchedPlayers(state), state.data.idx, meKey(state));
    var allQuiet = !players.length && hidden > 0;
    var emptySub = nobody
      ? '첫 번째 선수가 되어 보세요. 내 카드를 만들면 여기에 상대가 나타나요.'
      : (allQuiet
        ? '최근 ' + D.INACTIVE_HIDE_DAYS + '일 안에 활동한 분들만 보여 드려요. 상대가 다시 활동하면 여기에 나타나요.'
        : (f.gender && f.gender !== '전체' && !anyGender
          ? '아직 성별을 공개한 플레이어가 없어요. 상대가 프로필에서 성별을 공개하면 여기에 보여요.'
          : (q ? '다른 낱말로 찾아보거나 조건을 풀어 보세요.' : '급수·지역 조건을 바꿔 보세요.')));

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
      (players.length ? inactiveNote(state) : '') +
      (players.length
        ? '<div class="pcards">' + players.map(function (p) { return playerCard(p, state); }).join('') + '</div>'
        : UI.emptyState('search', nobody ? '아직 등록된 선수가 없어요' : (allQuiet ? '지금은 다들 잠시 쉬는 중이에요' : '조건에 맞는 플레이어가 없어요'), emptySub,
          nobody
            ? '<button type="button" class="btn btn--primary btn--sm mt8" data-act="edit-match">내 매칭 카드 만들기</button>'
            : '<button type="button" class="btn btn--ghost btn--sm mt8" data-act="reset-filter">조건 초기화</button>'));
  }

  /* ---------- 체육관 지도 입구 ----------
   * 지도 화면은 js/views/gyms.js 가 그리고, 여기서는 들어가는 카드만 그립니다.
   * 자주 가는 체육관을 등록해 두면 이 줄에 이름이 바로 보입니다. */
  function gymEntry(state) {
    var G = BM.gyms;
    if (!G || !BM.views || !BM.views.gyms) return '';
    var scope = meKey(state) || 'guest';
    var favs = G.favorites(scope);
    var names = favs.map(function (id) { var v = G.get(id); return v && v.name; }).filter(Boolean);
    var sub = names.length
      ? '자주 가는 곳 ' + names.length + '곳 · ' + names.slice(0, 2).join(', ') + (names.length > 2 ? ' 외' : '')
      : '전국 체육관 ' + G.count() + '곳 · 권역·이름으로 찾기';
    /* 내 집 반경 5km 안 동호인 — 지도에 들어가지 않아도 몇 명인지 보이게 (2026-11-21) */
    var near = (BM.nearby && BM.nearby.summary) ? BM.nearby.summary(state) : null;
    var nearChip = (near && near.people.length)
      ? '<i class="gymentry__near">반경 5km · 파란 불 ' + near.lit + '</i>'
      : '';
    return '<section class="card card--flush gymentry">' +
      '<button type="button" class="gymentry__b" data-act="open-gym-map">' +
      '<span class="gymentry__ic" aria-hidden="true">' + UI.icon('pin') + '</span>' +
      '<span class="gymentry__t"><b>체육관 지도</b><small>' + U.esc(sub) + '</small></span>' +
      '<span class="gymentry__go">' + nearChip +
      (favs.length ? '<i class="gymentry__n">★ ' + favs.length + '</i>' : '') +
      UI.icon('arrow') + '</span></button></section>';
  }

  /* ---------- 찾기 탭 ---------- */
  /* ---------- 친구 코드 초대 칩 (bm-v1.79.0) ----------
   * 매칭 찾기 맨 위에 내 코드(#XXXX)를 두어, 코트에서 만난 동호인에게 바로 건네게 합니다.
   * 코드를 아는 사람끼리만 친구가 되고(친구 코드 규칙 그대로), 친구가 되면 1:1 대화가 열립니다.
   * 복사는 화면 어디서든 [data-code-copy] 하나로 처리합니다(js/views/friends.js bindCopy). */
  function inviteBar(state) {
    var F = BM.views && BM.views.friends;
    if (!F) return '';
    var code = F.myCode(state);
    if (!code) return '';
    return '<section class="invitebar" data-region="invite">' +
      '<div class="invitebar__l">' +
      '<span class="invitebar__k">친구 코드 초대</span>' +
      '<b class="invitebar__v">' + U.esc((state.me && state.me.nick) || '나') + '<i>#' + U.esc(code) + '</i></b>' +
      '<span class="invitebar__s">코드로 친구가 되면 1:1 대화 · 응원 하트 1개</span>' +
      '</div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-code-copy="' + U.esc(F.myCodeText(state)) + '">복사</button>' +
      '</section>';
  }

  function findTab(state) {
    return gymEntry(state) + inviteBar(state) + '<section class="card">' +
      '<header class="card__head"><h2>플레이어 찾기</h2></header>' +
      searchBar(state) + filterBar(state) +
      '<div data-region="results" data-sig="' + U.esc(resultsSig(state)) + '">' + resultsHtml(state) + '</div>' +
      '</section>';
  }

  /* ---------- 요청 목록 ---------- */
  /* 받은 1:1 매칭 요청 = 편지지 카드.
   * 보낸 사람의 급수·종목·한마디와 수락/거절이 한 장에 담기게 합니다.
   * (과한 장식 없이 스포츠 앱 톤 — 얇은 테두리, 급수 배지, 한 줄 인사말) */
  function letterHtml(state, r, opts) {
    opts = opts || {};
    var other = r.userKey;
    var p = personOf(state, other);
    var note = (r.payload && r.payload.note) || '';
    var meta = metaHtml(p);
    var spec = [p.discipline, p.availability].filter(Boolean).join(' · ');
    var cost = Number(r.payload && r.payload.heartCost) || D.HEART_RULES.MATCH_COST;
    var status = r.status || '대기';
    var accepted = status === '수락';
    var acts;
    if (accepted) {
      /* 수락한 편지는 그 자리에서 1:1 대화방으로 이어 줍니다 */
      acts = '<div class="letter__acts">' +
        '<button type="button" class="btn btn--primary btn--sm" data-open-chat="' + U.esc(r.id) + '"' +
        ' data-other="' + U.esc(other) + '">1:1 대화하기</button></div>';
    } else if (status !== '대기') {
      acts = '<div class="letter__acts"><span class="rq__status is-off">' + U.esc(status) + '</span></div>';
    } else {
      acts = '<div class="letter__acts">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-decline="' + U.esc(r.id) + '">거절</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-accept="' + U.esc(r.id) + '">수락</button>' +
        '</div>';
    }
    return '<article class="letter' + (opts.compact ? ' letter--compact' : '') + (accepted ? ' letter--done' : '') + '"' +
      ' data-letter="' + U.esc(r.id) + '" data-open-letter="' + U.esc(r.id) + '"' +
      ' data-from="' + U.esc(other) + '">' +
      '<div class="letter__top">' +
      '<span class="letter__av">' + UI.avatar(p, opts.compact ? 44 : 52) + '</span>' +
      '<div class="letter__who">' +
      '<div class="letter__name">' + U.esc(p.nick) + gradePill(p) + genderPill(p) + '</div>' +
      '<p class="letter__meta">' + (meta || '지역 미입력') +
      (spec ? ' · ' + U.esc(spec) : '') + '</p></div>' +
      '<span class="letter__stamp">' + (accepted ? '수락함' : '매칭 요청') + '</span></div>' +
      (note
        ? '<p class="letter__note">' + U.esc(note) + '</p>'
        : '<p class="letter__note letter__note--empty">한마디 없이 보낸 요청이에요.</p>') +
      (accepted ? '' : '<p class="letter__rule">' + UI.icon('heart') +
        '수락하면 보낸 분의 하트 ' + cost + '개가 차감되고 1:1 대화가 열려요.</p>') +
      acts +
      '<button type="button" class="letter__open" data-open-letter="' + U.esc(r.id) + '">' +
      '눌러서 편지지 열기' + UI.icon('arrow', 'letter__arrow') + '</button>' +
      '</article>';
  }

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

  /* 받은 요청 — 편지지 형식(기본)이면 편지지 카드, 꺼 두었으면 일반 요청 카드 */
  function reqList(state, kind) {
    var list = kind === 'in' ? pendingIncoming(state) : sentRequests(state);
    var letter = !(state.prefs && state.prefs.letter === false);
    if (kind === 'in' && !letter) {
      var simple = list.concat(acceptedIncoming(state));
      if (!simple.length) {
        return UI.emptyState('community', '받은 요청이 없어요', '요청을 보내면 상대가 수락할 때 대화가 열려요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>');
      }
      return '<ul class="rqlist rqlist--simple">' + simple.map(function (r) { return simpleRequestRow(state, r); }).join('') + '</ul>';
    }
    if (!list.length) {
      return kind === 'in'
        ? acceptedBlock(state) || UI.emptyState('community', '받은 요청이 없어요', '요청을 보내면 상대가 수락할 때 대화가 열려요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>')
        : UI.emptyState('send', '보낸 요청이 없어요', '마음에 드는 상대의 프로필을 보고 요청을 보내보세요.',
          '<button type="button" class="btn btn--ghost btn--sm mt8" data-match-tab="find">플레이어 찾기</button>');
    }
    if (kind === 'in') {
      return '<div class="letters">' + list.map(function (r) { return letterHtml(state, r); }).join('') + '</div>' +
        acceptedBlock(state);
    }
    return '<ul class="rqlist">' + list.map(function (r) { return reqRow(state, r, kind); }).join('') + '</ul>';
  }

  /* 편지지 형식을 꺼 둔 사람이 받는 요청 — 군더더기 없는 한 줄 카드 */
  function simpleRequestRow(state, r) {
    var other = r.userKey;
    var p = personOf(state, other);
    var note = (r.payload && r.payload.note) || '';
    var status = r.status || '대기';
    var act;
    if (status === '대기') {
      act = '<button type="button" class="btn btn--ghost btn--sm" data-decline="' + U.esc(r.id) + '">거절</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-accept="' + U.esc(r.id) + '">수락</button>';
    } else if (status === '수락') {
      act = '<button type="button" class="btn btn--ghost btn--sm" data-open-chat="' + U.esc(r.id) + '" data-other="' + U.esc(other) + '">채팅하기</button>';
    } else {
      act = '<span class="rq__status is-off">' + U.esc(status) + '</span>';
    }
    return '<li class="rq rq--simple" data-open-profile="' + U.esc(other) + '">' + UI.avatar(p, 44) +
      '<div class="rq__mid">' +
      '<div class="rq__name">' + U.esc(p.nick) + gradePill(p) +
      (p.discipline ? '<span class="rq__disc">' + U.esc(p.discipline) + '</span>' : '') + '</div>' +
      (note ? '<p class="rq__note">' + U.esc(note) + '</p>' : '') +
      '<p class="rq__meta">' + U.esc(U.timeAgo(r.createdAt) || '방금') +
      UI.presence(D.presenceOf(state.data.idx, other), { cls: 'presence--row' }) + '</p></div>' +
      '<div class="rq__act">' + act + '</div></li>';
  }

  /* 수락한 편지 묶음 — 누르면 편지지가 열리고, 버튼으로 바로 대화방에 들어갑니다 */
  function acceptedBlock(state) {
    var list = acceptedIncoming(state);
    if (!list.length) return '';
    return '<div class="letters letters--done">' +
      '<p class="letters__cap">' + UI.icon('check') + '수락한 요청</p>' +
      list.map(function (r) { return letterHtml(state, r); }).join('') + '</div>';
  }

  function reqTab(state, kind) {
    var list = kind === 'in' ? pendingIncoming(state) : sentRequests(state);
    return '<section class="card" data-region="reqbody" data-sig="' + reqSig(state, kind) + '">' +
      '<header class="card__head"><h2>' + (kind === 'in' ? '받은 요청' : '보낸 요청') + '</h2>' +
      '<span class="muted sm">' + list.length + '건</span></header>' +
      reqList(state, kind) + '</section>';
  }

  function reqSig(state, kind) {
    return kind + '|' + (state.prefs && state.prefs.letter === false ? 'simple' : 'letter') + '|' +
      (state.data.requests || []).map(function (r) {
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
      var group = r.kind === 'group';
      var rp = group ? null : personOf(state, r.other);
      return '<li class="room' + (group ? ' room--group' : '') + '" data-open-chat="' + U.esc(r.roomId) + '" data-other="' + U.esc(r.other) + '">' +
        (group
          ? '<span class="dmgroupav dmgroupav--sm" aria-hidden="true">' + UI.icon('users') + '</span>'
          : UI.avatar(rp, 42)) +
        '<div class="room__mid"><strong>' + U.esc(group ? (r.title || D.MEET.roomLabel) : rp.nick) +
        (group ? ' <span class="pill pill--ok">단체</span>' : '') +
        (!group && rp.level ? ' <span class="pill pill--grade">' + U.esc(rp.level) + '</span>' : '') + '</strong>' +
        '<p>' + U.esc(U.truncate(D.chatTextPreview((r.last && r.last.text) || '대화를 시작해 보세요'), 34)) + '</p>' +
        (group ? '' : UI.presence(D.presenceOf(state.data.idx, r.other), { cls: 'presence--row' })) + '</div>' +
        '<div class="room__right"><time>' + U.esc(D.chatListTime(r.at)) + '</time>' +
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
  /* bm-v1.80.0 — 상대의 커스텀 라켓 + 친구 코드로 초대 (요청 흐름은 아래 그대로) */
  function racketSheetRow(state, p) {
    if (!BM.racketcustom) return '';
    var c = BM.racketcustom.customFor(state, p.userKey);
    var mine = !!(state.me && state.me.key === p.userKey);
    var codeText = (BM.views && BM.views.friends && BM.views.friends.myCodeText)
      ? BM.views.friends.myCodeText(state) : '';
    return '<div class="pp__racket" data-racket="' + U.esc(p.userKey) + '">' +
      '<span class="pp__racketart">' + BM.racketcustom.svg(c, { level: 'prime' }) + '</span>' +
      '<div class="pp__rackettx">' +
      '<b>커스텀 라켓</b>' +
      '<span>' + U.esc(BM.racketcustom.hasCustom(c) ? BM.racketcustom.specText(c) : '아직 기본 라켓이에요') + '</span>' +
      '</div>' +
      (!mine && codeText
        ? '<button type="button" class="btn btn--ghost btn--sm pp__invite" data-code-copy="' + U.esc(codeText) + '">친구 코드 초대</button>'
        : '') +
      '</div>';
  }

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
    /* 편지지 형식을 꺼 둔 사람은 한마디만 적어 바로 보내는 일반 요청 카드로 */
    var letterOn = !(state.prefs && state.prefs.letter === false);

    var footer;
    if (st.incoming) {
      var incNote = (st.incoming.payload && st.incoming.payload.note) || '';
      footer = (incNote ? '<p class="pp__quote">' + U.esc(incNote) + '</p>' : '') +
        '<div class="pp__note pp__note--info">' + UI.icon('heart') + '상대가 먼저 요청했어요. 수락하면 보낸 분의 하트 ' + cost + '개가 차감되고 바로 대화할 수 있어요.</div>' +
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
      /* 한마디는 여기서 적고, 편지지 형식이 켜져 있으면 '요청 보내기'가
       * 봉투 미리보기(편지지 작성 시트)로 이어집니다. 꺼져 있으면 바로 보내요. */
      footer = '<label class="flabel">한마디 남기기 <span class="muted">(선택)</span>' +
        '<input type="text" data-note maxlength="60" placeholder="토요일 오전 어떠세요?" value="' + U.esc(noteDrafts[p.userKey] || '') + '"></label>' +
        '<p class="pp__cost">보유 하트 <b class="' + (short ? 'down' : 'up') + '">' + balance + '개</b> · 수락 시 <b>' + cost + '개</b>가 차감돼요' +
        (short ? '<span class="warn"> · ' + (cost - balance) + '개 부족</span>' : '') + '</p>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-close>닫기</button>' +
        (short
          ? '<button class="btn btn--primary grow" data-charge-hearts="' + key + '">하트 충전하기</button>'
          : '<button class="btn btn--primary grow" data-send-request="' + key + '">' +
            (letterOn ? UI.icon('mail') : '') + '요청 보내기</button>') +
        '</div>' +
        (short ? '' : '<p class="hint mt8">' + (letterOn
          ? '편지지 형식이 켜져 있어요. 요청 보내기를 누르면 상대에게 갈 편지지를 미리 보고 보낼 수 있어요.'
          : '편지지 형식이 꺼져 있어 요청이 바로 전송돼요. MY > 알림·편지지에서 다시 켤 수 있어요.') + '</p>');
    }

    /* bm-v1.79.0 — 어느 상태(요청 전·보냄·수락·친구)에서든 부담 없이 건네는 '💛 응원 하트 1개'.
     * 1:1 매칭(수락 시 2하트)보다 가벼운 인사라 확인 창 없이 한 번에 보내고,
     * 하트가 모자라면 토스트 대신 공용 충전 시트(출석·광고)가 바로 열립니다. */
    footer += '<button type="button" class="cheerbtn cheerbtn--wide mt8" data-cheer-sheet="' + key + '"' +
      ' aria-label="' + U.esc(p.nick) + '님에게 응원 하트 ' + D.HEART_RULES.GIFT_COST + '개 보내기">' +
      '<span class="cheerbtn__ico" aria-hidden="true">💛</span>' +
      '<span class="cheerbtn__t">응원 하트 ' + D.HEART_RULES.GIFT_COST + '개 보내기</span>' +
      '<span class="cheerbtn__s">부담 없이 마음만 전해요</span></button>';

    return '<div class="pp" data-profile="' + key + '">' +
      '<div class="pp__head">' + UI.avatar(p, 72) +
      '<div class="pp__id"><div class="pp__name">' + U.esc(p.nick) + '</div>' +
      '<div class="pp__pills">' + gradePill(p) + genderPill(p) + '</div>' +
      '<p class="pp__meta">' + (metaHtml(p) || '지역 미입력') + '</p>' +
      UI.presence(D.presenceOf(state.data.idx, p.userKey), { cls: 'presence--profile' }) +
      '</div></div>' +
      /* bm-v1.80.0 — 상대의 커스텀 라켓 → 바로 매칭 요청·친구 코드 초대 */
      racketSheetRow(state, p) +
      '<p class="pp__match">궁합 <b>' + scored.score + '</b>' +
      (scored.reasons.length ? '<span class="pp__why">' + U.esc(scored.reasons.slice(0, 3).join(' · ')) + '</span>' : '') + '</p>' +
      /* 하트 소모 안내는 요청 버튼까지 스크롤하지 않아도 보이게 맨 위에 둡니다 */
      (canRequest
        ? '<p class="pp__cost pp__cost--top">' + UI.icon('heart') + '매칭 요청 · <b>수락 시 하트 ' + cost + '개 차감</b> · 보유 <b class="' + (short ? 'down' : 'up') + '">' + balance + '개</b>' +
          (short ? '<span class="warn"> · ' + (cost - balance) + '개 부족</span>' : '') + '</p>'
        : '') +

      '<dl class="pp__spec">' +
      '<div><dt>주력 종목</dt><dd>' + (p.discipline
        ? '<span class="eventchip eventchip--lg is-on">' + U.esc(p.discipline) + '</span>'
        : '<span class="muted">미입력</span>') + '</dd></div>' +
      '<div><dt>플레이 스타일</dt><dd>' + (p.style
        ? '<span class="pill pill--style">' + U.esc(p.style) + '</span>'
        : '<span class="muted">미입력</span>') + '</dd></div>' +
      '<div><dt>급수</dt><dd>' + U.esc(p.level || '미입력') + '</dd></div>' +
      '<div><dt>주 체육관</dt><dd>' + clubHtml(p) + '</dd></div>' +
      '<div><dt>경력</dt><dd>' + U.esc(p.experience || '미입력') + '</dd></div>' +
      '<div><dt>가능 시간</dt><dd>' + U.esc(p.availability || '미입력') + '</dd></div>' +
      '</dl>' +

      (p.bio ? '<p class="pp__bio">' + U.esc(p.bio) + '</p>' : '') +
      /* v1.38: 1:1 매칭 화면에서는 편지지(매칭 요청)만 보냅니다.
       *  친구 추가는 친구 코드를 아는 사람끼리만(채팅 목록 + → 친구 추가) 가능합니다. */
      '<div class="pp__foot">' + footer + '</div></div>';
  }

  /* ---------- 이: 요청 보내기 (편지지 / 바로 보내기) ----------
   * requestMatch는 그대로(하트는 수락 시 차감)이고, 보내는 모양만 설정을 따릅니다. */
  function releaseRequest(ctx, p, note, opts) {
    opts = opts || {};
    var res = ctx.actions.requestMatch(p.userKey, note);
    UI.closeSheet();
    /* bm-v1.75.0 — 서버(Supabase)는 하트 2개 보유 여부를 서버에서 확인해 결과가 Promise 로 옴 */
    return U.when(res, function (res) {
      res = res || { ok: false, reason: 'error' };
      if (res.ok) {
        UI.toast((opts.letter ? '편지지를 보냈어요. ' : '요청을 보냈어요. ') +
          '상대가 수락하면 하트 ' + (res.cost || D.HEART_RULES.MATCH_COST) + '개가 차감되고 대화가 열려요.');
      } else if (res.reason === 'hearts') {
        openHeartSheet(ctx, p.userKey, { need: D.HEART_RULES.MATCH_COST, continueLabel: '프로필로 돌아가기' });
      } else if (res.reason === 'already') UI.toast('이미 요청한 상대예요.');
      else if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
      else if (res.reason === 'offline' || res.reason === 'login') UI.toast(res.message || '인터넷에 연결되면 보낼 수 있어요', 'error');
      else UI.toast('요청을 보내지 못했어요', 'error');
      return res;
    });
  }

  /* 봉투 모양 미리보기 — 적는 즉시 미리보기에 반영됩니다. */
  function letterComposeBody(state, p, note) {
    var me = myProfile(state);
    var cost = D.HEART_RULES.MATCH_COST;
    var balance = (state.data.hearts && state.data.hearts.balance) || 0;
    var key = U.esc(p.userKey);
    return '<div class="env" data-env>' +
      '<div class="env__top"><span class="env__stamp">매칭 요청</span>' +
      '<span class="env__to">' + U.esc(p.nick) + '님에게</span></div>' +
      '<p class="env__note" data-env-note>' + (note ? U.esc(note) : '<span class="muted">한마디를 적어 보내 보세요.</span>') + '</p>' +
      '<div class="env__foot">' + U.esc((me && me.nick) || '나') + ' · 수락 시 보낸 분의 하트 ' + cost + '개 차감</div>' +
      '</div>' +
      '<label class="flabel mt8">한마디 <span class="muted">(선택 · 60자)</span>' +
      '<input type="text" data-note maxlength="60" placeholder="토요일 오전 어떠세요?" value="' + U.esc(note) + '"></label>' +
      '<p class="pp__cost">보유 하트 <b class="' + (balance < cost ? 'down' : 'up') + '">' + balance + '개</b>' +
      (balance < cost ? ' <span class="warn">' + (cost - balance) + '개 부족 · 광고 한 번이면 +1</span>' : '') + '</p>' +
      (balance < cost
        ? '<button type="button" class="btn btn--ghost btn--big mt8" data-letter-ad>광고 보고 하트 +1</button>'
        : '') +
      '<div class="row gap8 mt8">' +
      '<button type="button" class="btn btn--ghost grow" data-close>취소</button>' +
      '<button type="button" class="btn btn--primary grow" data-letter-send="' + key + '">편지 보내기</button></div>' +
      '<button type="button" class="linkbtn mt8" data-letter-off="' + key + '">편지지 없이 바로 보내기 (편지지 형식 끄기)</button>';
  }

  function openLetterCompose(ctx, p) {
    var state = ctx.store.state;
    var note = noteDrafts[p.userKey] || '';
    UI.openSheet({
      title: '편지지로 요청 보내기',
      body: letterComposeBody(state, p, note),
      onMount: function (wrap) {
        var input = wrap.querySelector('[data-note]');
        var preview = wrap.querySelector('[data-env-note]');
        if (input) {
          input.addEventListener('input', function () {
            noteDrafts[p.userKey] = input.value;
            if (preview) {
              preview.innerHTML = input.value ? U.esc(input.value) : '<span class="muted">한마디를 적어 보내 보세요.</span>';
            }
          }, { passive: true });
        }
        wrap.addEventListener('click', function (ev) {
          var send = ev.target.closest('[data-letter-send]');
          if (send) {
            ev.preventDefault();
            if (send.disabled) return;
            releaseRequest(ctx, p, input ? input.value : note, { letter: true });
            return;
          }
          var off = ev.target.closest('[data-letter-off]');
          if (off) {
            ev.preventDefault();
            ctx.actions.setPref('letter', false);
            releaseRequest(ctx, p, input ? input.value : note, { letter: false });
            UI.toast('편지지 형식을 꺼 두었어요. 다음부터는 바로 보내요.');
            return;
          }
          /* 하트가 모자를 때 안내 옆에서 바로 광고로 — 채운 뒤 이 편지지로 돌아옵니다 */
          if (ev.target.closest('[data-letter-ad]')) {
            ev.preventDefault();
            if (input) noteDrafts[p.userKey] = input.value;
            adOneTap(ctx, function () { openLetterCompose(ctx, p); });
            return;
          }
          if (ev.target.closest('[data-close]')) {
            ev.preventDefault();
            UI.closeSheet();
          }
        });
      }
    });
  }

  /* 하트 선물 — 모자라면 공용 충전 시트로 이어 주고, 채우면 다시 선물할 수 있게 합니다 */
  function sendGift(ctx, p) {
    UI.confirm('하트 ' + D.HEART_RULES.GIFT_COST + '개를 ' + p.nick + '님에게 선물할까요?').then(function (ok) {
      if (!ok) return;
      var r = ctx.actions.giftHeart(p.userKey);
      U.when(r, function (r) {
        r = r || { ok: false, reason: 'error' };
        if (r.ok) { UI.closeSheet(); UI.toast('하트를 선물했어요'); return; }
        if (r.reason === 'hearts') {
          openHeartSheet(ctx, '', {
            need: D.HEART_RULES.GIFT_COST,
            why: '하트 선물에는 <b>하트 ' + D.HEART_RULES.GIFT_COST + '개</b>가 필요해요.',
            continueLabel: '다시 선물하기',
            onContinue: function () { sendGift(ctx, p); }
          });
          return;
        }
        UI.toast(r.message || '선물하지 못했어요', 'error');
      });
    });
  }

  /* ---------- 응원 하트 1개 (bm-v1.79.0) ----------
   * 1:1 매칭 신청(수락 시 하트 2개)과 달리, 부담 없이 마음만 건네는 1하트 응원입니다.
   *  · 하트 차감은 기존 store.giftHeart → 서버 RPC(heart_spend 'gift')가 맡습니다(새 RPC 없음).
   *  · 하트가 모자라면 토스트로 끝내지 않고 공용 충전 시트(출석 · 광고)를 바로 열고,
   *    채운 뒤 그 자리에서 응원을 이어 보냅니다. */
  function cheerSend(ctx, p, opts) {
    opts = opts || {};
    var need = Math.max(1, Number(D.HEART_RULES.GIFT_COST) || 1);
    function charge(introText) {
      openHeartSheet(ctx, p.userKey, {
        need: need,
        title: '응원 하트 충전',
        why: introText || ('응원 하트는 <b>하트 ' + need + '개</b>로 보내요.'),
        continueLabel: p.nick + '님에게 응원 보내기',
        onContinue: function () { cheerSend(ctx, p, opts); }
      });
    }
    var hearts = (ctx.store.state.data && ctx.store.state.data.hearts) || {};
    if ((hearts.balance || 0) < need) { charge(); return null; }
    var r = ctx.actions.giftHeart(p.userKey);
    return U.when(r, function (res) {
      res = res || { ok: false, reason: 'error' };
      if (res.ok) {
        UI.haptic(10);
        UI.toast('💛 ' + p.nick + '님에게 응원 하트를 보냈어요');
        if (opts.close) UI.closeSheet();
        return res;
      }
      if (res.reason === 'hearts') { charge(); return res; }
      if (res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
      else if (res.reason === 'self') UI.toast('나에게는 보낼 수 없어요');
      else if (res.reason === 'offline' || res.reason === 'login') UI.toast(res.message || '인터넷에 연결되면 보낼 수 있어요', 'error');
      else UI.toast('응원을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요', 'error');
      return res;
    });
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
            /* 편지지 형식이 켜져 있으면 바로 보내지 않고 봉투 미리보기(작성 시트)를 거칩니다 */
            var letterOn = !(ctx.store.state.prefs && ctx.store.state.prefs.letter === false);
            if (letterOn) {
              UI.closeSheet();
              openLetterCompose(ctx, p);
              return;
            }
            releaseRequest(ctx, p, note, { letter: false });
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
            sendGift(ctx, p);
            return;
          }
          /* 응원 하트 1개 — 프로필 시트를 닫지 않고 그 자리에서 보냅니다 */
          if (ev.target.closest('[data-cheer-sheet]')) {
            ev.preventDefault();
            cheerSend(ctx, p);
            return;
          }
        });
        var input = wrap.querySelector('[data-note]');
        if (input) input.addEventListener('input', function () { noteDrafts[p.userKey] = input.value; }, { passive: true });
      }
    });
  }

  /* ---------- 편지지 상세 ----------
   * 목록의 편지지 카드를 누르면 열리는 풀 카드 뷰.
   * 보낸 사람 프로필·플레이 스타일·주 체육관·한마디 전문과 수락/거절을 한 화면에 담습니다. */
  function letterBody(state, r) {
    var p = personOf(state, r.userKey);
    var note = (r.payload && r.payload.note) || '';
    var cost = Number(r.payload && r.payload.heartCost) || D.HEART_RULES.MATCH_COST;
    var status = r.status || '대기';
    var accepted = status === '수락';
    var key = U.esc(p.userKey);

    var footer;
    if (accepted) {
      footer = '<div class="pp__note pp__note--ok">' + UI.icon('check') +
        '<span>수락한 요청이에요. 바로 1:1 대화를 할 수 있어요.</span></div>' +
        '<button class="btn btn--primary btn--big mt8" data-open-chat="' + U.esc(r.id) + '" data-other="' + key + '">1:1 대화방 열기</button>';
    } else if (status !== '대기') {
      footer = '<div class="pp__note">' + UI.icon('clock') + '<span>이미 ' + U.esc(status) + '한 요청이에요.</span></div>';
    } else {
      footer = '<div class="pp__note pp__note--info">' + UI.icon('heart') +
        '<span>수락하면 보낸 분 하트 <b>' + cost + '개 차감</b> · 바로 1:1 대화가 열려요.</span></div>' +
        '<div class="row gap8 mt8">' +
        '<button class="btn btn--ghost grow" data-decline="' + U.esc(r.id) + '">거절</button>' +
        '<button class="btn btn--primary grow" data-accept="' + U.esc(r.id) + '">수락하고 대화하기</button></div>';
    }

    return '<div class="lettermail" data-letter-sheet="' + U.esc(r.id) + '">' +
      '<div class="lettermail__top">' + UI.avatar(p, 64) +
      '<div class="lettermail__who">' +
      '<div class="lettermail__name">' + U.esc(p.nick) + gradePill(p) + genderPill(p) + '</div>' +
      '<p class="lettermail__meta">' + (metaHtml(p) || '지역 미입력') + '</p>' +
      '<span class="lettermail__stamp">' + (accepted ? '수락한 편지' : '매칭 요청 편지') + '</span></div></div>' +
      '<div class="lettermail__note">' +
      (note ? U.esc(note) : '<span class="muted">한마디 없이 보낸 요청이에요.</span>') + '</div>' +
      '<p class="lettermail__cap">보낸 분 정보</p>' +
      '<dl class="pp__spec">' +
      '<div><dt>급수</dt><dd>' + U.esc(p.level || '미입력') + '</dd></div>' +
      '<div><dt>주력 종목</dt><dd>' + (p.discipline
        ? '<span class="eventchip eventchip--lg is-on">' + U.esc(p.discipline) + '</span>'
        : '<span class="muted">미입력</span>') + '</dd></div>' +
      '<div><dt>플레이 스타일</dt><dd>' + (p.style
        ? '<span class="pill pill--style">' + U.esc(p.style) + '</span>'
        : '<span class="muted">미입력</span>') + '</dd></div>' +
      '<div><dt>주 체육관</dt><dd>' + clubHtml(p) + '</dd></div>' +
      '<div><dt>가능 시간</dt><dd>' + U.esc(p.availability || '미입력') + '</dd></div>' +
      '<div><dt>경력</dt><dd>' + U.esc(p.experience || '미입력') + '</dd></div>' +
      '</dl>' +
      (p.bio ? '<p class="pp__bio">' + U.esc(p.bio) + '</p>' : '') +
      (U.timeAgo(r.createdAt)
        ? '<p class="lettermail__at">' + UI.icon('clock') + U.esc(U.timeAgo(r.createdAt)) + ' 도착</p>'
        : '') +
      '<div class="lettermail__foot">' + footer + '</div>' +
      '<button type="button" class="linkbtn lettermail__more" data-open-profile="' + key + '">프로필 자세히 보기</button>' +
      '</div>';
  }

  function openLetterSheet(ctx, reqId) {
    var state = ctx.store.state;
    var r = (state.data.requests || []).filter(function (x) { return String(x.id) === String(reqId); })[0];
    if (!r) { UI.toast('요청을 찾지 못했어요', 'error'); return; }
    UI.openSheet({
      title: '받은 편지지',
      body: letterBody(state, r),
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
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
            var roomId = chat.getAttribute('data-open-chat');
            var other = chat.getAttribute('data-other');
            if (!roomId) return;
            ctx.actions.openChat(roomId, other);
            if (other) ctx.actions.markChatRead(roomId, other);
            return;
          }
          var prof = ev.target.closest('[data-open-profile]');
          if (prof) {
            ev.preventDefault();
            var p = personOf(ctx.store.state, prof.getAttribute('data-open-profile'));
            UI.closeSheet();
            if (p) openProfile(p, ctx);
            return;
          }
        });
      }
    });
  }

  /* ---------- 수락/거절 ---------- */
  function acceptRequest(ctx, reqId) {
    var req = (ctx.store.state.data.requests || []).filter(function (r) { return r.id === reqId; })[0] || {};
    var res = ctx.actions.respondMatch(reqId, '수락');
    if (!res || !res.ok) {
      if (res && res.reason === 'done') UI.toast('이미 처리한 요청이에요');
      else UI.toast('잠시 후 다시 시도해 주세요', 'error');
      return;
    }
    UI.haptic(12);
    if (res.short > 0) {
      UI.toast('수락했어요 · 보낸 분 하트가 ' + res.charged + '개뿐이라 ' + res.charged + '개만 차감했어요.');
    } else if (res.charged > 0) {
      UI.toast('수락했어요 · 보낸 분 하트 ' + res.charged + '개 차감');
    } else {
      UI.toast('수락했어요. 대화를 시작해 보세요.');
    }
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

  /* ---------- 하트 1탭 충전 (bm-v1.47.0) ----------
   * '광고 보고 +1' — 하트가 모자랄 때 안내 옆에서 바로 광고로 이어집니다.
   * 재생·적립·안내 문구는 BM.ads.watchForHeart 한 곳이 맡고, 끝나면 화면만 다시 그립니다. */
  function adOneTap(ctx, after) {
    if (!BM.ads || typeof BM.ads.watchForHeart !== 'function') {
      UI.toast('지금은 광고를 볼 수 없어요', 'error');
      return;
    }
    BM.ads.watchForHeart(ctx).then(function (res) {
      if (res && res.ok) { if (after) after(res); return; }
      if (res && res.reason === 'limit') UI.toast('오늘 몫을 모두 받았어요. 내일 다시 만나요!');
      else if (res && res.reason === 'cooldown') UI.toast(res.retryAfter + '초 뒤에 다시 시도해 주세요');
      else if (res && res.reason === 'duplicate') UI.toast('이미 받은 광고예요');
      else if (res && res.reason === 'busy') UI.toast('광고를 준비하고 있어요. 잠시만요');
      else if (res && res.reason === 'cancel') UI.toast('광고를 끝까지 봐야 하트를 받을 수 있어요');
      else if (res && res.reason === 'locked') UI.toast('잠시만요, 처리 중이에요');
      else UI.toast('지금은 광고를 볼 수 없어요. 잠시 후 다시 시도해 주세요');
      if (after) after(res);
    });
  }

  /* ---------- 하트 충전(공용 시트) ----------
   * 출석·광고·실시간 쿨타임은 js/ads.js 의 openHeartSheet 하나가 맡습니다.
   * 매칭뿐 아니라 하트 선물·유료 테마·프레임/배지 해금에서도 같은 시트가 열립니다. */
  function openHeartSheet(ctx, backKey, opts) {
    opts = opts || {};
    var hearts = (ctx.store.state.data && ctx.store.state.data.hearts) || {};
    var balance = hearts.balance || 0;
    var need = Math.max(1, Math.round(Number(opts.need) || D.HEART_RULES.MATCH_COST));
    var back = backKey || '';
    var p = back ? profileOf(ctx.store.state, back) : null;
    var short = Math.max(0, need - balance);
    var why = opts.why || (need >= D.HEART_RULES.MATCH_COST
      ? '1:1 매칭은 <b>상대가 수락할 때</b> 하트 ' + need + '개가 차감돼요.'
      : '하트 선물에는 <b>하트 ' + need + '개</b>가 필요해요.');
    var intro = function (s) {
      return '<p class="sheet__text">' + why + ' 지금 <b>' + s.balance + '개</b> 있어요.' +
        (s.balance < need ? ' <span class="warn">' + (need - s.balance) + '개 부족</span>' : '') + '</p>';
    };

    if (BM.ads && typeof BM.ads.openHeartSheet === 'function') {
      return BM.ads.openHeartSheet(ctx, {
        need: need,
        title: opts.title || '하트 충전',
        intro: intro,
        continueLabel: opts.continueLabel || (p ? '프로필로 돌아가기' : '닫기'),
        onContinue: opts.onContinue || (p ? function () { openProfile(p, ctx); } : null)
      });
    }
    /* 광고 모듈을 못 읽은 환경(아주 오래된 캐시)에서는 안내만 남깁니다 */
    UI.toast('하트가 ' + short + '개 부족해요. MY에서 충전해 주세요', 'error');
    return null;
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
      mp.discipline, D.normalizeStyle(mp.style), mp.region].filter(Boolean);

    return '<div class="mycard">' + UI.avatar(mp.rowId ? mp : me, 46) +
      '<div class="mycard__id">' +
      '<div class="mycard__name">' + U.esc(me.nick || '회원') + (mp.level ? gradePill(mp) : '') + '</div>' +
      '<p class="mycard__meta">' + U.esc(meta.length ? meta.join(' · ') : '매칭 카드가 아직 없어요') + '</p></div>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-act="edit-match">' + (mp.level || mp.region ? '수정' : '만들기') + '</button></div>' +
      (ready ? '' : '<p class="mycard__hint">급수·종목·지역을 등록하면 맞는 상대부터 보여드려요.</p>') +
      '<div class="mycard__hearts">하트 <b>' + balance + '</b><span>· 수락 시 하트 ' + cost + '개 차감</span>' +
      (balance < cost ? '<span class="warn">' + (cost - balance) + '개 부족</span>' : '') +
      '</div>' +
      /* 하트가 모자랄 때 — 안내 바로 밑에서 광고 한 번으로 +1 (bm-v1.47.0) */
      (balance < cost
        ? '<div class="row gap8 mt8">' +
          '<button type="button" class="btn btn--primary btn--sm grow" data-act="ad-heart">' + UI.icon('spark') + '광고 보고 하트 +1</button>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-act="charge-hearts">충전</button></div>'
        : '');
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
        /* 체육관 지도 (찾기 탭 맨 위 카드) */
        if (ev.target.closest('[data-act="open-gym-map"]')) {
          ev.preventDefault();
          if (BM.views && BM.views.gyms) BM.views.gyms.open(ctx);
          UI.haptic(6);
          return;
        }

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

        /* '전체' — 한 조건이 아니라 모든 조건을 풀어 전부 다시 보여 줍니다 */
        if (ev.target.closest('[data-act="show-all"]')) {
          ev.preventDefault();
          var had = activeFilterCount(ctx.store.state);
          var wasStarted = searchStarted(ctx.store.state);
          var search = root.querySelector('[data-search-input]');
          if (search) search.value = '';
          ctx.actions.resetMatchFilter();
          UI.toast(had ? '조건을 모두 풀었어요' : '전체 선수를 보여드릴게요');
          if (had || !wasStarted) UI.haptic(6);
          return;
        }

        var chip = ev.target.closest('[data-filter]');
        if (chip) {
          ev.preventDefault();
          var key = chip.getAttribute('data-filter');
          var val = chip.getAttribute('data-value');
          if (val === '전체') {
            /* 각 줄의 전체도 같은 의미로 통일 — 모든 조건을 풀고 전부 보여 줍니다 */
            var hadAny = activeFilterCount(ctx.store.state);
            var box = root.querySelector('[data-search-input]');
            if (box) box.value = '';
            ctx.actions.resetMatchFilter();
            if (hadAny) UI.toast('조건을 모두 풀었어요');
            UI.haptic(6);
            return;
          }
          var patch = {};
          patch[key] = val;
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
          ctx.actions.clearMatchFilter();
          UI.toast('조건을 초기화했어요');
          UI.haptic(6);
          return;
        }

        if (ev.target.closest('[data-act="ad-heart"]')) {
          ev.preventDefault();
          adOneTap(ctx, function () { if (ctx.refresh) ctx.refresh(); });
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

        /* 편지지 카드는 어디를 눌러도 상세 편지지로 들어갑니다 (내부 버튼은 위에서 먼저 처리) */
        var letter = ev.target.closest('[data-open-letter]');
        if (letter) {
          ev.preventDefault();
          openLetterSheet(ctx, letter.getAttribute('data-open-letter'));
          return;
        }

        /* 응원 하트 1개 — 카드 안 버튼이라 프로필 열기보다 먼저 처리합니다 (bm-v1.79.0) */
        var cheer = ev.target.closest('[data-cheer]');
        if (cheer) {
          ev.preventDefault();
          ev.stopPropagation();
          var ck = cheer.getAttribute('data-cheer');
          var cp = profileOf(ctx.store.state, ck) || personOf(ctx.store.state, ck);
          if (cp) cheerSend(ctx, cp);
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
      syncFbar(root);
      /* 친구 코드 복사 칩 — 화면 어디서든 한 번으로 (js/views/friends.js) */
      if (BM.views && BM.views.friends && BM.views.friends.bindCopy) BM.views.friends.bindCopy(root);
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
          /* 다시 그려도 가로 스크롤 위치와 고른 칩이 그대로 보이게 합니다.
           * (칩을 누를 때마다 줄이 왼쪽 끝으로 튀어 고른 값이 화면 밖으로 사라지던 문제) */
          var keeps = {};
          var bar = filters.querySelector('[data-fbar]');
          var barLeft = bar ? bar.scrollLeft : 0;
          Array.prototype.forEach.call(filters.querySelectorAll('.filter-line'), function (ln) {
            var sx = ln.querySelector('.scrollx');
            if (sx) keeps[ln.getAttribute('data-key')] = sx.scrollLeft;
          });
          filters.innerHTML = filterBarOnly(state);
          var bar2 = filters.querySelector('[data-fbar]');
          if (bar2 && barLeft) bar2.scrollLeft = barLeft;
          Array.prototype.forEach.call(filters.querySelectorAll('.filter-line'), function (ln) {
            var sx = ln.querySelector('.scrollx');
            if (!sx) return;
            var keep = keeps[ln.getAttribute('data-key')];
            if (keep != null) sx.scrollLeft = keep;
            sx.classList.toggle('is-scrolled', sx.scrollLeft > 1);
            /* 지금 고른 칩이 가려져 있으면 보이게 옮깁니다 */
            var on = sx.querySelector('.chip.is-on');
            if (on) {
              var cr = on.getBoundingClientRect();
              var sr = sx.getBoundingClientRect();
              if (cr.left < sr.left || cr.right > sr.right) {
                /* 고른 칩이 줄 맨 앞에 오게 옮깁니다(오른쪽은 페이드로 '더 있음'을 알립니다) */
                sx.scrollLeft = Math.max(0, sx.scrollLeft + (cr.left - sr.left) - 8);
              }
              sx.classList.toggle('is-scrolled', sx.scrollLeft > 1);
            }
          });
          filters.setAttribute('data-sig', fs);
        }
      }
      syncFbar(root);

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
    /* 프로필 시트 본문 */
    profileBody: profileBody,
    playerCard: playerCard,
    racketSheetRow: racketSheetRow,
    racketMini: racketMini,
    letterHtml: letterHtml,
    letterBody: letterBody,
    openLetterCompose: openLetterCompose,
    letterComposeBody: letterComposeBody,
    simpleRequestRow: simpleRequestRow,
    openLetterSheet: openLetterSheet,
    statusOf: statusOf,
    resultsHtml: resultsHtml,
    recommendPlayers: recommendPlayers,
    visiblePlayers: visiblePlayers,
    pendingIncoming: pendingIncoming,
    acceptedIncoming: acceptedIncoming,
    sentRequests: sentRequests
  };

  function filterBarOnly(state) {
    var f = filterOf(state);
    var open = state.ui.matchFilterOpen || '';
    var active = D.activeFilters(f);
    var started = searchStarted(state);
    function button(key, label) {
      var v = valueOf(f, key);
      /* 값이 없으면 이름만 — 버튼 네 개가 한 줄에 다 들어가고 화면이 덜 빽빽합니다 */
      return '<button type="button" class="fbtn' + (v ? ' is-on' : '') + (open === key ? ' is-open' : '') + '"' +
        ' data-filter-open="' + key + '" aria-expanded="' + (open === key ? 'true' : 'false') + '"' +
        ' aria-label="' + label + ' 필터' + (v ? ' · ' + U.esc(v) : '') + '">' +
        label + (v ? '<b>' + U.esc(v) + '</b>' : '') + UI.icon('arrow', 'fbtn__car') + '</button>';
    }
    function line(kr, key, options) {
      var cur = f[key] || '';
      var none = !cur || cur === '전체';
      return '<div class="filter-line' + (open === key ? ' is-active' : '') + '" data-key="' + key + '">' +
        '<span class="filter-line__label">' + kr + '</span><div class="scrollx">' +
        ['전체'].concat(options).map(function (o) {
          var all = o === '전체';
          /* 조건을 고르기 전에는 아무것도 선택되지 않은 상태로 둡니다 */
          var on = all ? (started && none) : cur === o;
          /* '전체'는 조건을 고른 것이 아니라 '모든 조건 풀기' 상태라 색을 달리해 한눈에 구분합니다 */
          return '<button type="button" class="chip chip--sm' + (all ? ' chip--all' : '') + (on ? ' is-on' : '') + '"' +
            ' data-filter="' + key + '" data-value="' + U.esc(o) + '"' +
            ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
            (all && on ? UI.icon('check', 'chip__ic') : '') + U.esc(o) + '</button>';
        }).join('') + '</div></div>';
    }
    return '<div class="fbar" data-fbar>' +
      '<button type="button" class="fall' + (started && !active.length ? ' is-on' : '') + '" data-act="show-all"' +
      ' aria-label="' + (active.length ? '조건을 모두 풀고 전체 선수 보기' : '전체 선수 보기') + '">' +
      UI.icon(started && !active.length ? 'check' : 'refresh') + '<span>전체</span></button>' +
      button('level', '급수') + button('region', '지역') + button('discipline', '종목') + button('gender', '성별') +
      '</div>' +
      '<div class="fpanel' + (open ? ' is-open' : '') + '">' +
      '<p class="fpanel__hint">' + UI.icon('refresh') + '‘전체’를 누르면 급수·지역·종목·성별 조건이 <b>모두</b> 풀려요.</p>' +
      line('급수', 'level', D.VOCAB.grades) +
      line('지역', 'region', D.VOCAB.regions) +
      line('종목', 'discipline', D.VOCAB.disciplines) +
      line('성별', 'gender', (D.VOCAB.genderFilter || ['전체', '남성', '여성']).slice(1)) +
      '</div>' +
      (active.length ? '<p class="fsum">' + active.map(function (a) {
        return '<span class="fsum__chip">' + U.esc(a.key === 'query' ? '“' + a.value + '”' : a.value) + '</span>';
      }).join('') + '<button type="button" class="linkbtn fsum__all" data-act="show-all">' +
        UI.icon('refresh') + '전체 보기</button></p>' : '');
  }

  /* 필터 버튼 줄이 화면보다 길면 오른쪽 페이드로 '더 있음'을 알립니다. */
  function syncFbar(root) {
    var bar = root && root.querySelector ? root.querySelector('[data-fbar]') : null;
    if (!bar) return;
    bar.classList.toggle('is-scroll', bar.scrollWidth > bar.clientWidth + 1);
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
      style: D.normalizeStyle(myMp.style || me.style || ''),
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
        '<label class="flabel">플레이 스타일' + chips('style', D.VOCAB.styles) + '</label>' +
        '<label class="flabel">주력 종목' + chips('discipline', D.VOCAB.disciplines) + '</label>' +
        '<label class="flabel">지역' + chips('region', D.VOCAB.regions) + '</label>' +
        '<label class="flabel">가능 시간' + chips('availability', D.VOCAB.availability) + '</label>' +
        '<label class="flabel">경력' + chips('experience', D.VOCAB.experience) + '</label>' +
        '<label class="flabel">클럽<div class="flabel__row"><input type="text" data-mp-text="club" maxlength="20" value="' + U.esc(payload.club) + '">' +
        '<button type="button" class="btn btn--ghost btn--sm flabel__map" data-act="mp-club-map">' + UI.icon('pin') + '지도에서 고르기</button></div></label>' +
        '<label class="flabel">소개<input type="text" data-mp-text="bio" maxlength="80" value="' + U.esc(payload.bio) + '"></label>' +
        '</div><button class="btn btn--primary btn--big mt16" data-act="save-mp">저장</button>',
      onMount: function (wrap) {
        wrap.addEventListener('click', function (ev) {
          /* 클럽 칸의 '지도에서 고르기' — 고른 체육관 이름을 칸에 채웁니다(저장은 저장 버튼) */
          if (ev.target.closest('[data-act="mp-club-map"]')) {
            ev.preventDefault();
            if (!BM.views || !BM.views.gyms) return;
            BM.views.gyms.open(ctx, {
              onPick: function (v) {
                if (!v) return;
                payload.club = v.name;
                var inp = wrap.querySelector('[data-mp-text="club"]');
                if (inp) inp.value = v.name;
                UI.toast(v.name + ' · 클럽 칸에 넣었어요');
              }
            });
            return;
          }
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
              bio: payload.bio, club: payload.club, style: payload.style
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
  /* v1.79 — 옹원 하트·친구 코드 초대 칩 (테스트·재사용) */
  view.playerCard = playerCard;
  view.cheerSend = cheerSend;
  view.inviteBar = inviteBar;

  /* ---------- 다른 화면(체육관 지도)에서 매칭 흐름으로 이어지는 입구 (2026-11-23)
   *  · 매칭 탭의 프로필 시트·매칭 신청(편지지)·1:1 대화를 그대로 재사용합니다.
   *  · 지도에서 동네 동호인을 눌렀을 때 바로 이 함수들로 들어옵니다. */
  view.matchWith = function (ctx, userKey) {
    if (!ctx || !userKey) return null;
    var state = ctx.store && ctx.store.state;
    if (!state) return null;
    var p = profileOf(state, userKey) || personOf(state, userKey);
    if (!p) return null;
    openProfile(p, ctx);
    return p;
  };

  /* 이미 대화할 수 있는 사이(친구 · 매칭 성사 · 승인된 코치)인지 */
  view.canChatWith = function (ctx, userKey) {
    var state = ctx && ctx.store && ctx.store.state;
    if (!state || !userKey) return false;
    var me = meKey(state);
    if (!me) return false;
    return !!D.canChatWith(state.data.idx, me, userKey);
  };

  /* 대화방을 바로 연다 — 방 ID 계산은 매칭 화면과 같은 규칙(statusOf) */
  view.openChatWith = function (ctx, userKey) {
    var state = ctx && ctx.store && ctx.store.state;
    if (!state || !userKey) return { ok: false, reason: 'no_key' };
    var st = statusOf(state, personOf(state, userKey));
    if (!st.canChat || !st.roomId) return { ok: false, reason: 'no_chat' };
    var res = ctx.actions.openChat(st.roomId, userKey);
    if (res && res.ok) ctx.actions.markChatRead(st.roomId, userKey);
    return res || { ok: false, reason: 'no_chat' };
  };
  BM.views.matching = view;
})(typeof globalThis !== 'undefined' ? globalThis : this);
