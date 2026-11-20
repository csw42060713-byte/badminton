/* ============================================================
 * test/matchrules.test.js — 승우 님이 정한 채팅·매칭 규칙 3가지 (v1.12.0)
 *  1) 매칭 편지지 — 받은 1:1 매칭 요청은 급수·한마디·수락/거절이 담긴 카드
 *  2) 수락 시 하트 차감 — 보낼 때는 보유량만 확인, 상대가 수락할 때 보낸 사람 2개 차감
 *     (거절 0 · 예전 요청과 두 번 차감 없음 · 수락 시점에 모자라면 있는 만큼만)
 *  3) 참여 문의 → 모집 글 단체방 — 글마다 하나인 고정 방, 1:1 DM은 친구·매칭만
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var ME_KEY = BM.seed.ME;

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  /* extra 를 넘기면 픽스처 뒤에 그 행을 붙여 저장소를 만듭니다 */
  function freshStore(extra) {
    clearStorage();
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(Array.isArray(e) ? e : D.toRow(e)); });
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  var ME = {
    key: ME_KEY, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, ME_KEY),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
      ui: {
        tab: 'matching', matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', chatRoom: null, chatOther: '', chatOpen: false, chatDraft: '',
        coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
    }
    return st;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 50, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'article', 'form', 'p', 'span', 'label', 'input'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = tag === 'input' ? open : (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  function meetPost(id, userKey, nick) {
    return D.toRow({
      id: id || 'post-bolt-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: nick || '콕집사', text: '이번 주 금요일 저녁에 번개 치실 분!', userKey: userKey || 'demo_chi',
      plan: { topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }
    });
  }

  function mineSent(store, target) {
    return (store.state.data.requests || []).filter(function (r) {
      return r.userKey === ME_KEY && r.target === target;
    })[0];
  }

  /* ================= 1. 수락 시 하트 차감 ================= */

  test('하트: 요청을 보낼 때는 빼지 않고, 상대가 수락하면 보낸 사람 하트 2개가 빠진다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      eq(before, 6, '시작 잔액');
      var res = store.actions.requestMatch('demo_chi', '토요일 오전 어때요?');
      ok(res.ok, '요청 보내기');
      eq(store.state.data.hearts.balance, before, '보낼 때는 차감 없음');

      var req = mineSent(store, 'demo_chi');
      eq(req.payload.payOn, 'accept', '수락할 때 지불하는 요청으로 기록');
      eq(req.payload.heartCost, 2, '비용 2개 기록');
      eq(req.payload.charged, undefined, '아직 차감 전');

      /* 상대 기기에서 수락하는 상황 — 응답은 요청 행의 상태를 바꿉니다 */
      store.state.locks = {};
      var acc = store.actions.respondMatch(req.id, '수락');
      ok(acc.ok, '수락');
      eq(acc.charged, 2, '이때 2개 차감');
      eq(acc.short, 0, '모자람 없음');
      eq(store.state.data.hearts.balance, before - 2, '보낸 사람 잔액 -2');
      var ledger = D.heartStatus(store.state.idx, ME_KEY);
      ok(ledger.history.some(function (h) { return h.label === '매칭 성사' && h.delta === -2; }), '원장에 매칭 성사 -2');
      eq(ledger.balance, before - 2, '원장 잔액도 같음');

      /* 연타·두 기기에서 두 번 차감되지 않는다 */
      store.state.locks = {};
      var again = store.actions.respondMatch(req.id, '수락');
      eq(again.ok, false, '이미 처리한 요청');
      eq(again.reason, 'done', '이유: 이미 답함');
      eq(store.state.data.hearts.balance, before - 2, '두 번 차감 없음');
    });
  });

  test('하트: 거절하면 차감이 0이다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      store.actions.requestMatch('demo_foot', '같이 쳐요');
      var req = mineSent(store, 'demo_foot');
      store.state.locks = {};
      var res = store.actions.respondMatch(req.id, '거절');
      ok(res.ok, '거절');
      eq(res.charged, 0, '차감 0');
      eq(store.state.data.hearts.balance, before, '잔액 그대로');
      var after = store.state.data.requests.filter(function (r) { return r.id === req.id; })[0];
      eq(after.status, '거절', '상태');
      eq(after.payload.charged, undefined, '차감 기록 없음');
    });
  });

  test('하트: 예전 요청(보낼 때 낸 건)은 수락해도 두 번 차감하지 않는다', function () {
    return freshStore().then(function (store) {
      var incoming = store.state.data.requests.filter(function (r) {
        return r.target === ME_KEY && r.status === '대기';
      })[0];
      ok(incoming, '받은 요청(예전 형식) 존재');
      eq(incoming.payload.payOn, undefined, '예전 형식(payOn 없음)');
      var senderBefore = D.heartStatus(store.state.idx, incoming.userKey).balance;
      store.state.locks = {};
      ok(store.actions.respondMatch(incoming.id, '수락').ok, '수락');
      eq(D.heartStatus(store.state.idx, incoming.userKey).balance, senderBefore,
        '이미 낸 요청이라 보낸 사람 원장이 그대로');
      eq(store.state.data.hearts.balance, 6, '내 잔액도 그대로');
    });
  });

  test('하트: 수락할 때 보낸 사람 하트가 모자라면 있는 만큼만 차감한다', function () {
    return freshStore().then(function (store) {
      store.actions.requestMatch('demo_chi', '한 게임 해요');   /* 6개 보유 상태에서 요청 */
      var req = mineSent(store, 'demo_chi');
      for (var i = 0; i < 5; i++) {                               /* 그 사이 하트를 써서 1개만 남김 */
        store.state.locks = {};
        ok(store.actions.giftHeart('demo_koala').ok, '하트 선물 ' + (i + 1));
      }
      eq(store.state.data.hearts.balance, 1, '남은 하트 1개');
      store.state.locks = {};
      var acc = store.actions.respondMatch(req.id, '수락');
      ok(acc.ok, '수락은 성사');
      eq(acc.charged, 1, '있는 1개만 차감');
      eq(acc.short, 1, '1개 모자람을 알려 줌');
      eq(store.state.data.hearts.balance, 0, '잔액이 음수로 가지 않음');
      var after = store.state.data.requests.filter(function (r) { return r.id === req.id; })[0];
      eq(after.payload.charged, 1, '실제 차감액 기록');
      eq(after.payload.short, 1, '모자란 양 기록');
      eq(after.status, '수락', '매칭은 그대로 성사');
    });
  });

  test('하트: 화면 안내가 "수락 시 차감"으로 맞춰져 있다', function () {
    var state = stateOf();
    var find = BM.views.matching.render(state);
    includes(find, '수락 시 하트 2개 차감', '찾기 카드');
    excludes(find, '신청 하트', '보낼 때 쓰는 것처럼 보이지 않음');
    var target = state.data.matchProfiles.filter(function (p) { return p.userKey === 'demo_foot'; })[0];
    var body = BM.views.matching.profileBody(state, target);
    includes(body, '수락 시 하트 2개 차감', '프로필 시트 상단');
    includes(body, '수락 시 <b>2개</b>가 차감돼요', '보유 하트 줄');
    var myCard = BM.views.matching.render(state);
    includes(myCard, '수락 시 하트 2개 차감', '내 카드 하트 줄');
  });

  /* ================= 2. 받은 요청 = 편지지 ================= */

  test('편지지: 받은 요청 탭은 보낸 사람·한마디·수락/거절이 담긴 카드로 보인다', function () {
    var state = stateOf(null, { ui: { matchTab: 'in' } });
    var html = BM.views.matching.render(state);
    checkHtml(html, '받은 요청 탭');
    includes(html, 'class="letter"', '편지지 카드');
    includes(html, 'letter__stamp', '요청 표시');
    includes(html, '셔틀버스', '보낸 사람');
    includes(html, '평일 저녁 어때요?', '한 줄 인사말');
    includes(html, 'data-accept=', '수락 버튼');
    includes(html, 'data-decline=', '거절 버튼');
    includes(html, '수락하면 보낸 분의 하트 2개가 차감되고 1:1 대화가 열려요', '수락 시 하트 안내');
    includes(html, '경기', '지역');
    excludes(html, 'rq__note', '한 줄 목록이 아니라 카드');
  });

  test('편지지: 한마디가 없어도 카드가 비지 않는다', function () {
    var rows = BM.fixtures.demo();
    rows.forEach(function (r) {
      if (String(r[D.COL['유형']]) === '매칭신청' && String(r[D.COL['대상']]) === ME_KEY) {
        r[D.COL['소셜글']] = JSON.stringify({ status: '대기', heartCost: 2 });
      }
    });
    var state = stateOf(rows, { ui: { matchTab: 'in' } });
    var html = BM.views.matching.render(state);
    checkHtml(html, '한마디 없는 요청');
    includes(html, '한마디 없이 보낸 요청이에요', '빈 인사말 안내');
    includes(html, 'data-accept=', '수락은 그대로');
  });

  test('편지지: 프로필 상세에도 보낸 사람 한마디와 수락 시 하트 안내가 보인다', function () {
    var state = stateOf();
    var p = state.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_suttle'; })[0];
    var body = BM.views.matching.profileBody(state, p);
    checkHtml(body, '받은 요청 프로필');
    includes(body, 'pp__quote', '한마디 인용');
    includes(body, '평일 저녁 어때요?', '한마디');
    includes(body, '보낸 분의 하트 2개', '수락 시 하트 안내');
    includes(body, 'data-accept=', '수락 버튼');
  });

  test('편지지: 상단 채팅 패널 알림에도 받은 매칭 요청이 보인다', function () {
    var state = stateOf();
    var html = BM.views.chat.listHtml(state);
    checkHtml(html, '채팅 목록');
    includes(html, '받은 매칭 요청', '알림 제목');
    includes(html, 'letter--compact', '편지지(작은 카드)');
    includes(html, '평일 저녁 어때요?', '한마디');
    includes(html, 'data-accept=', '바로 수락');
    includes(html, 'data-decline=', '바로 거절');

    var none = BM.fixtures.demo().filter(function (r) { return String(r[D.COL['유형']]) !== '매칭신청'; });
    var empty = BM.views.chat.listHtml(stateOf(none));
    excludes(empty, '받은 매칭 요청', '요청이 없으면 알림도 없음');
  });

  /* ================= 3. 참여 문의 → 모집 글 단체방 ================= */

  test('단체방: 글 번호가 곧 방 번호이고 제목·안내가 글에서 나온다', function () {
    var rows = [meetPost()];
    var state = stateOf(rows);
    var idx = state.data.idx;
    eq(D.groupRoomId('post-bolt-1'), 'post-bolt-1', '고정 방 ID');
    eq(D.isGroupRoom(idx, 'post-bolt-1'), true, '글 ID는 단체방');
    eq(D.isGroupRoom(idx, 'no-such-post'), false, '없는 글은 단체방 아님');
    var post = D.groupPostOf(idx, 'post-bolt-1');
    eq(post.userKey, 'demo_chi', '글쓴이');
    eq(D.groupTitle(post), '번개 단체방', '방 제목');
    includes(D.groupNote(post), '올림픽체육관', '글의 모집 정보가 방 안내로');
    eq(D.groupRoomId(' post-bolt-1 '), ' post-bolt-1 ', '문자열 그대로(테스트용 확인)');
  });

  test('단체방: 참여 문의를 누르면 1:1 DM이 아니라 그 글의 단체방이 열린다', function () {
    return freshStore([meetPost()]).then(function (store) {
      var post = store.state.data.posts.filter(function (p) { return p.topic === '번개'; })[0];
      ok(post, '번개 글');
      var res = store.actions.openGroupChat(post.id, '번개 참여하고 싶어요! (11/21(금) 19:00)');
      ok(res.ok, '단체방 열기');
      eq(store.state.ui.chatOpen, true, '채팅 패널 열림');
      eq(store.state.ui.chatRoom, post.id, '방 번호 = 글 번호');
      eq(store.state.ui.chatOther, '', '1:1 상대 없음');
      includes(store.state.ui.chatDraft, '참여하고 싶어요', '인사 문구가 미리 채워짐');

      /* 글쓴이는 아직 친구·매칭이 아니므로 1:1 DM은 그대로 막혀 있다 */
      eq(D.canChatWith(store.state.idx, ME_KEY, 'demo_chi'), false, '1:1 DM은 친구·매칭만');

      var sent = store.actions.sendChat(post.id, '', '안녕하세요! 토요일 참여 가능할까요?');
      ok(sent.ok, '단체방에는 바로 말을 걸 수 있다');
      eq(sent.group, true, '단체방 전송');

      var msg = (store.state.idx.byType['매칭채팅'] || []).filter(function (m) { return m.team === post.id; })[0];
      ok(msg, '메시지 저장');
      eq(msg.target, '', '단체방 메시지는 대상(1:1 상대)이 비어 있다');
      eq(msg.userKey, ME_KEY, '보낸 사람');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(msg.id); })[0];
      eq(row.length, 26, '시트 26칸 그대로');
      eq(row[D.COL['유형']], '매칭채팅', '기존 매칭채팅 유형');
      eq(row[D.COL['팀']], post.id, '팀 칸 = 방 번호');
      eq(row[D.COL['대상']], '', '대상 칸 비움');

      var room = store.state.data.threads.filter(function (t) { return t.kind === 'group'; })[0];
      ok(room, '대화 목록에 단체방');
      eq(room.roomId, post.id, '방 번호');
      eq(room.title, '번개 단체방', '제목');
      eq(room.memberCount, 2, '참여자 2명(글쓴이 + 나)');
      eq(room.members[0].key, 'demo_chi', '글쓴이가 먼저');
      eq(room.messages.length, 1, '메시지 1개');
      eq(store.state.data.unread, 0, '내가 쓴 글은 안 읽음 아님');

      var list = BM.views.chat.listHtml(store.state);
      checkHtml(list, '채팅 목록(단체방)');
      includes(list, '번개 단체방', '목록 제목');
      includes(list, '단체', '단체방 배지');
      includes(list, '2명', '참여자 수');

      store.state.ui.chatRoom = post.id;
      store.state.ui.chatOther = '';
      var roomHtml = BM.views.chat.roomHtml(store.state);
      checkHtml(roomHtml, '단체방 화면');
      includes(roomHtml, '번개 단체방', '방 제목');
      includes(roomHtml, '2명 참여', '참여자 수');
      includes(roomHtml, '올림픽체육관', '모집 정보');
      includes(roomHtml, 'data-dm-form', '바로 입력');
      includes(roomHtml, '안녕하세요! 토요일 참여 가능할까요?', '내 메시지');
      var otherMsg = { id: 'x', type: '매칭채팅', userKey: 'demo_chi', nick: '콕집사', target: '', team: post.id, text: '환영해요', createdAt: U.stamp() };
      var mh = BM.views.chat.messageHtml(otherMsg, store.state, '', true);
      includes(mh, 'dmsg__nick', '단체방은 보낸 사람을 표시');
      includes(mh, '콕집사', '보낸 사람 닉네임');
    });
  });

  test('단체방: 다른 사람 글에는 방이 열리고, 참여하지 않은 사람 목록에는 남지 않는다', function () {
    var bolt = meetPost('post-bolt-2', 'demo_chi');
    var rows = [bolt];
    rows.push(D.toRow({
      id: 'g-m1', type: '매칭채팅', createdAt: U.stamp(), nick: '콕집사', userKey: 'demo_chi',
      target: '', team: 'post-bolt-2', text: '금요일 19시에 모여요'
    }));
    rows.push(D.toRow({
      id: 'g-m2', type: '매칭채팅', createdAt: U.stamp(), nick: '네트앞여우', userKey: 'demo_net',
      target: '', team: 'post-bolt-2', text: '저도 갈게요!'
    }));
    var state = stateOf(rows);
    eq((state.data.threads || []).filter(function (t) { return t.kind === 'group'; }).length, 0,
      '참여하지 않은 사람의 대화 목록에는 없음');

    /* 글쓴이(콕집사)에게는 자기 글의 단체방이 보이고, 두 사람이 참여자로 잡힌다 */
    var author = BM.store.derive(rows, 'demo_chi');
    var room = (author.threads || []).filter(function (t) { return t.kind === 'group'; })[0];
    ok(room, '글쓴이의 단체방');
    eq(room.memberCount, 2, '참여자 2명(글쓴이 + 한 명)');
    eq(room.messages.length, 2, '메시지 2개');
    eq(room.unread, 1, '내가 안 쓴 메시지 1개는 안 읽음');
  });

  test('단체방: 읽으면 안 읽음 표시가 지워진다 (읽음 행은 방 번호만 남긴다)', function () {
    var bolt = meetPost('post-bolt-3', 'demo_chi');
    return freshStore([bolt, {
      id: 'g-mine', type: '매칭채팅', createdAt: U.stamp(), nick: '나래', userKey: ME_KEY,
      target: '', team: 'post-bolt-3', text: '저도 참여할게요'
    }, {
      id: 'g-other', type: '매칭채팅', createdAt: U.stamp(), nick: '콕집사', userKey: 'demo_chi',
      target: '', team: 'post-bolt-3', text: '환영해요!'
    }]).then(function (store) {
      var room = store.state.data.threads.filter(function (t) { return t.kind === 'group'; })[0];
      ok(room, '단체방이 목록에');
      eq(room.unread, 1, '안 읽은 메시지 1개');
      eq(store.state.data.unread, 1, '전체 안 읽음에도 반영');
      store.state.locks = {};
      var read = store.actions.markChatRead('post-bolt-3', '');
      ok(read.ok, '읽음 처리');
      eq(store.state.data.unread, 0, '안 읽음 사라짐');
      var readRow = (store.state.idx.byType['채팅읽음'] || []).filter(function (r) {
        return r.userKey === ME_KEY && r.team === 'post-bolt-3';
      })[0];
      ok(readRow, '읽음 행');
      eq(readRow.target, '', '단체방 읽음은 대상이 비어 있다');
      includes(BM.views.chat.listHtml(store.state), '번개 단체방', '목록에 그대로');
    });
  });

  test('단체방: 대화가 없어도 문의 버튼으로 열면 내 대화 목록에 방이 남는다', function () {
    return freshStore([meetPost('post-bolt-4', ME_KEY, '나래')]).then(function (store) {
      var post = store.state.data.posts.filter(function (p) { return p.topic === '번개'; })[0];
      ok(store.actions.openGroupChat(post.id, '').ok, '방 열기');
      eq((store.state.data.threads || []).filter(function (t) { return t.kind === 'group'; }).length, 0,
        '열기만 해서는 아직 목록에 없음');
      store.state.locks = {};
      ok(store.actions.markChatRead(post.id, '').ok, '처음 여는 방은 참여 기록을 남긴다');
      var room = store.state.data.threads.filter(function (t) { return t.kind === 'group'; })[0];
      ok(room, '대화가 없어도 목록에 방');
      eq(room.messages.length, 0, '메시지 0개');
      eq(room.memberCount, 1, '글쓴이 1명');
      eq(room.title, '번개 단체방', '제목');
      store.state.locks = {};
      eq(store.actions.markChatRead(post.id, '').ok, false, '다시 열면 새 기록 없음');
      var rows = (store.state.idx.byType['채팅읽음'] || []).filter(function (r) {
        return r.userKey === ME_KEY && r.team === post.id;
      });
      eq(rows.length, 1, '참여 기록 1건');
    });
  });

  test('단체방: 화면 버튼은 "참여 문의"이고 1:1 DM 문구가 남지 않는다', function () {
    var rows = [meetPost()];
    var html = BM.views.community.render(stateOf(rows));
    checkHtml(html, '커뮤니티(번개)');
    includes(html, 'data-vite-group="post-bolt-1"', '단체방 버튼');
    includes(html, '참여 문의', '버튼 글자');
    includes(html, '번개 모집', '모집 카드 제목');
    excludes(html, 'data-vite-dm', '작성자 1:1 DM 버튼 없음');
    includes(html, 'data-vite-group="post-bolt-1"', '어느 글의 방인지 함께');
  });

  test('단체방: 말머리 이름표는 한 곳에서 바꿀 수 있게 분리되어 있다', function () {
    eq(D.MEET.topic, '번개', '말머리');
    includes(D.POST_TOPICS.join(','), D.MEET.topic, '말머리 목록에 포함');
    eq(D.MEET.joinLabel, '참여 문의', '참여 버튼');
    ok(D.MEET.roomLabel.length > 0 && D.MEET.cardLabel.length > 0, '방·카드 이름표');
  });

  test('설정: 알림 배지에 받은 매칭 요청도 센다 (v1.12.0)', function () {
    var hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string';
    if (!hasNode) return;
    var fs = require('fs'), path = require('path');
    var rootDir = root.__REPO_ROOT__;
    var app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    var sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
    var css = fs.readFileSync(path.join(rootDir, 'styles.css'), 'utf8');
    includes(app, 'pendingMatch', '상단 채팅 배지에 매칭 요청 포함');
    ok(/var VERSION = 'bm-v1\.35\.0'/.test(sw), 'sw.js bm-v1.35.0');
    includes(css, '.letter {', '편지지 스타일');
    includes(css, '.dmgroupav', '단체방 아이콘 스타일');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
