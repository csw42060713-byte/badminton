/* ============================================================
 * test/v143.test.js — bm-v1.43.0 게스트 신청 수락·거절 · 마감 숨김 · 방 나가기
 *
 *  1) 신청 편지지 — 참여 신청 → 대기 → 글쓴이 수락/거절 → 정원 포함/제외
 *  2) 마감 — 정원이 차면 커뮤니티(전체·게스트 모집)에서 자동으로 내려감 (단체방은 유지)
 *  3) 나가기 — 게스트가 나가면 자리가 나서 글이 다시 올라오고, 내 대화 목록에서 방이 사라짐
 *  4) 화면 — 카드 버튼 상태 · 받은 신청 편지지 · 단체방 헤더(나가기/모집 종료)와 확인 바
 *  5) 보안 — 신청 한마디·닉네임이 HTML로 실행되지 않는다 (길이 상한 80자)
 *  6) 버전 · 문서
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  var OWNER = { key: 'u_owner', nick: '모집왕', level: 'B조', discipline: '복식', theme: { theme: 'th_night' } };
  var GUEST = { key: 'u_guest', nick: '신청자', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, style: '공격형' };

  /* 모집 글 한 줄 — cap 을 비우면 정원 없는 글 */
  function meetRow(opts) {
    opts = opts || {};
    var plan = { topic: '게스트 모집' };
    var meet = opts.meet;
    if (meet !== null) plan.meet = meet || { when: '11/22(토) 19:00', place: '영통 체육관', cap: '2' };
    return D.toRow({
      id: opts.id || 'post-1', type: '소셜', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '모집왕', text: opts.text || '게스트 모집합니다',
      userKey: opts.userKey || OWNER.key, plan: plan
    });
  }

  function guestRow(opts) {
    return D.toRow({
      id: opts.id || ('g-' + (opts.kind || 'x') + '-' + (opts.who || '') + '-' + Math.random().toString(36).slice(2, 6)),
      type: '게스트신청', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '신청자', userKey: opts.user || GUEST.key, target: opts.target || OWNER.key,
      team: opts.post || 'post-1',
      payload: { kind: opts.kind, note: opts.note || '', nick: opts.nick || '신청자', level: opts.level || 'C조', style: opts.style || '' }
    });
  }

  function stateWith(rows, me) {
    var who = me || { key: GUEST.key, nick: '신청자', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } };
    return {
      ready: true, mode: 'local', me: who, rows: rows,
      data: BM.store.derive(rows, who.key),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], note: '' } },
      ui: {
        tab: 'community', composer: '', composerTopic: '자유', composerMeet: {}, chatRoom: null, chatOther: '', chatDraft: '', chatOpen: true
      },
      queue: [], locks: {}, stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function at(secAgo) {
    return U.stamp(new Date(Date.now() - (secAgo || 0) * 1000));
  }

  function checkHtml(html, label) {
    ok(html && html.length > 20, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
  }

  /* ---------- 1. 신청 → 수락/거절 ---------- */
  test('v1.43 신청: 신청 행 하나로 대기 → 수락 → 나가기 → 다시 신청이 이어진다', function () {
    var rows = [meetRow()];
    var idx = D.index(rows.map(D.fromRow));
    var post = D.index(rows.map(D.fromRow)).byId['post-1'];
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '', '처음엔 신청 없음');

    rows.push(guestRow({ kind: '신청', note: '같이 치고 싶어요!', at: at(50) }));
    idx = D.index(rows.map(D.fromRow));
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '대기', '신청하면 대기');
    eq(D.guestState(idx, 'post-1', GUEST.key).note, '같이 치고 싶어요!', '한마디 저장');
    eq(D.meetStatus(idx, post, GUEST.key).count, 1, '대기만으로는 정원에 들어가지 않음(글쓴이 1명)');
    eq(D.meetStatus(idx, post, GUEST.key).pending.length, 1, '신청함에 1건');
    eq(D.meetStatus(idx, post, GUEST.key).me.status, '대기', '내 상태 대기');

    rows.push(guestRow({ kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) }));
    idx = D.index(rows.map(D.fromRow));
    post = idx.byId['post-1'];
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '수락', '수락 상태');
    eq(D.meetStatus(idx, post, GUEST.key).count, 2, '수락하면 정원에 포함');
    eq(D.meetStatus(idx, post, GUEST.key).closed, true, '정원 2명이 차면 마감');
    eq(D.meetStatus(idx, post, GUEST.key).pending.length, 0, '신청함에서 빠짐');
    eq(D.guestMember(idx, post, GUEST.key), true, '수락된 게스트는 방 사람');

    rows.push(guestRow({ kind: '나가기', at: at(30) }));
    idx = D.index(rows.map(D.fromRow));
    post = idx.byId['post-1'];
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '나가기', '나감');
    eq(D.meetStatus(idx, post, GUEST.key).count, 1, '나가면 정원에서 빠짐');
    eq(D.meetStatus(idx, post, GUEST.key).closed, false, '자리가 나서 마감 풀림');
    eq(D.guestMember(idx, post, GUEST.key), false, '방 사람 아님');

    rows.push(guestRow({ kind: '신청', note: '다시 하고 싶어요', at: at(20) }));
    idx = D.index(rows.map(D.fromRow));
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '대기', '나간 뒤 다시 신청하면 대기');
    eq(D.guestState(idx, 'post-1', GUEST.key).note, '다시 하고 싶어요', '새 한마디');
  });

  test('v1.43 신청: 거절되면 정원에 들어가지 않고 신청함에서도 빠진다', function () {
    var rows = [meetRow({ meet: { cap: '3' } }), guestRow({ kind: '신청', note: '신청합니다', at: at(30) })];
    var idx = D.index(rows.map(D.fromRow));
    var post = idx.byId['post-1'];
    eq(D.meetStatus(idx, post, OWNER.key).pending.length, 1, '글쓴이 신청함 1건');

    rows.push(guestRow({ kind: '거절', user: OWNER.key, target: GUEST.key, at: at(20) }));
    idx = D.index(rows.map(D.fromRow));
    post = idx.byId['post-1'];
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '거절', '거절 상태');
    eq(D.meetStatus(idx, post, GUEST.key).count, 1, '정원 그대로');
    eq(D.meetStatus(idx, post, OWNER.key).pending.length, 0, '신청함에서 빠짐');
    eq(D.meetStatus(idx, post, GUEST.key).rejected.length, 1, '거절 명단에 남음');
    eq(D.guestMember(idx, post, GUEST.key), false, '방 사람 아님');
  });

  test('v1.43 신청: 예전 참여자(방에 말만 남긴 사람)는 그대로 참여자로 센다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      D.toRow({
        id: 'm-1', type: '매칭채팅', createdAt: at(60), date: U.ymd(),
        nick: '예전참여자', userKey: 'u_legacy', target: '', team: 'post-1', text: '저도 갈게요'
      })
    ];
    var idx = D.index(rows.map(D.fromRow));
    var post = idx.byId['post-1'];
    eq(D.meetStatus(idx, post, 'u_legacy').count, 2, '글쓴이 + 예전 참여자');
    eq(D.guestMember(idx, post, 'u_legacy'), true, '예전 참여자는 방 사람');
    /* 예전 참여자가 나가기를 누르면 그때부터 빠집니다 */
    rows.push(guestRow({ kind: '나가기', user: 'u_legacy', target: OWNER.key, at: at(10), post: 'post-1' }));
    var idx2 = D.index(rows.map(D.fromRow));
    eq(D.meetStatus(idx2, idx2.byId['post-1'], 'u_legacy').count, 1, '나가면 빠짐');
  });

  /* ---------- 2. 정원이 차면 커뮤니티에서 내려감 ---------- */
  test('v1.43 마감: 정원이 차면 피드(전체·게스트 모집)에서 내려가고, 나가면 다시 올라온다', function () {
    var rows = [
      meetRow({ id: 'post-1', meet: { cap: '2' } }),
      meetRow({ id: 'post-2', at: at(100), text: '다른 모집', meet: { cap: '6' } }),
      guestRow({ kind: '신청', post: 'post-1', at: at(50) }),
      guestRow({ kind: '수락', user: OWNER.key, target: GUEST.key, post: 'post-1', at: at(40) })
    ];
    var st = stateWith(rows);
    var html = BM.views.community.render(st);
    checkHtml(html, '커뮤니티(마감 숨김)');
    excludes(html, 'data-post="post-1"', '마감된 글은 내려감');
    includes(html, 'data-post="post-2"', '자리 남은 글은 그대로');
    /* 게스트 모집 말머리로 걸러도 똑같이 내려갑니다 */
    BM.views.community._setTopicFilter('게스트 모집');
    var html2 = BM.views.community.render(st);
    excludes(html2, 'data-post="post-1"', '게스트 모집 필터에서도 내려감');
    includes(html2, 'data-post="post-2"', '자리 남은 모집 글');
    BM.views.community._setTopicFilter('전체');

    /* 한 명이 나가면 다시 올라옵니다 */
    rows.push(guestRow({ kind: '나가기', post: 'post-1', at: at(30) }));
    var st2 = stateWith(rows);
    var html3 = BM.views.community.render(st2);
    includes(html3, 'data-post="post-1"', '자리가 나면 다시 올라옴');
    includes(html3, '참여 1/2명', '지금 인원이 줄어 보임');
    eq(D.meetHidden(st2.data.idx, st2.data.posts.filter(function (p) { return p.id === 'post-1'; })[0], GUEST.key), false, '마감 풀림');
  });

  test('v1.43 마감: 정원이 없는 글은 마감·숨김 없이 그대로 남는다', function () {
    var rows = [meetRow({ meet: { place: '동네 체육관' } }), guestRow({ kind: '신청', at: at(30) })];
    var st = stateWith(rows);
    var post = st.data.posts.filter(function (p) { return p.id === 'post-1'; })[0];
    eq(D.meetStatus(st.data.idx, post, GUEST.key).cap, 0, '정원 없음');
    eq(D.meetHidden(st.data.idx, post, GUEST.key), false, '숨기지 않음');
    includes(BM.views.community.render(st), 'data-post="post-1"', '피드에 그대로');
  });

  test('v1.43 마감: 마감된 글도 참여자에게는 단체방이 남는다', function () {
    var rows = [
      meetRow({ meet: { cap: '2' } }),
      guestRow({ kind: '신청', at: at(50) }),
      guestRow({ kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ];
    var st = stateWith(rows);
    var rooms = st.data.threads.filter(function (t) { return t.kind === 'group'; });
    eq(rooms.length, 1, '수락된 게스트의 대화 목록에 단체방');
    eq(rooms[0].roomId, 'post-1', '방 번호 = 글 번호');
    includes(BM.views.chat.listHtml(st), '게스트 모집 단체방', '목록에 방이 보임');
  });

  test('v1.43 마감: 수락 전(대기)·나간 사람은 대화 목록에 방이 없다', function () {
    var rows = [meetRow({ meet: { cap: '4' } }), guestRow({ kind: '신청', at: at(50) })];
    var st = stateWith(rows);
    eq(st.data.threads.filter(function (t) { return t.kind === 'group'; }).length, 0, '대기 중에는 방 없음');
    eq(D.guestBlocked(st.data.idx, st.data.idx.byId['post-1'], GUEST.key), true, '방에 들어가지 못함');

    rows.push(guestRow({ kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) }));
    var st2 = stateWith(rows);
    eq(st2.data.threads.filter(function (t) { return t.kind === 'group'; }).length, 1, '수락하면 방이 생김');
    eq(D.guestBlocked(st2.data.idx, st2.data.idx.byId['post-1'], GUEST.key), false, '들어갈 수 있음');

    rows.push(guestRow({ kind: '나가기', at: at(30) }));
    var st3 = stateWith(rows);
    eq(st3.data.threads.filter(function (t) { return t.kind === 'group'; }).length, 0, '나가면 목록에서 사라짐');
  });

  /* ---------- 3. 저장소 동작 ---------- */
  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || []);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: GUEST.key, me: { nick: '신청자' } }) });
    return store.actions.init().then(function () { return store; });
  }

  test('v1.43 저장소: 신청을 보내면 게스트신청 행이 26칸 그대로 저장된다', function () {
    return freshStore([meetRow({ meet: { cap: '3' } })]).then(function (store) {
      var res = store.actions.applyGuest('post-1', '토요일 7시에 갈 수 있어요');
      ok(res.ok, '신청 보냄');
      eq(res.note, '토요일 7시에 갈 수 있어요', '한마디');
      var row = store.state.rows.filter(function (r) { return r[D.COL['유형']] === '게스트신청'; })[0];
      ok(row, '행 저장');
      eq(row.length, 26, '시트 26칸 그대로');
      eq(row[D.COL['팀']], 'post-1', '팀 칸 = 글 ID');
      eq(row[D.COL['대상']], OWNER.key, '대상 = 글쓴이');
      eq(row[D.COL['사용자ID']], GUEST.key, '사용자ID = 신청자');
      includes(row[D.COL['소셜글']], '"kind":"신청"', '소셜글 JSON에 종류');
      includes(row[D.COL['소셜글']], '토요일 7시에 갈 수 있어요', '소셜글 JSON에 한마디');
      eq(D.guestState(store.state.idx, 'post-1', GUEST.key).status, '대기', '대기 상태');

      /* 다시 신청은 막습니다 (중복 편지지 방지) */
      store.state.locks = {};
      eq(store.actions.applyGuest('post-1', '또 신청').reason, 'pending', '중복 신청 차단');
      /* 내 글에는 신청할 수 없습니다 */
      store.state.locks = {};
      U.writeJSON('bm_rows_v1', [meetRow({ id: 'mine', userKey: GUEST.key })]);
      return store.actions.init();
    }).then(function () {
      return freshStore([meetRow({ id: 'mine', userKey: GUEST.key })]);
    }).then(function (store) {
      eq(store.actions.applyGuest('mine', '내 글').reason, 'mine', '내 글 차단');
      return store.flush();
    });
  });

  test('v1.43 저장소: 신청 한마디는 80자까지만, 비우면 기본 문구', function () {
    return freshStore([meetRow({ meet: { cap: '3' } }), meetRow({ id: 'post-2', meet: { cap: '3' } })]).then(function (store) {
      var long = new Array(120).join('가');
      var res = store.actions.applyGuest('post-1', long);
      ok(res.ok, '신청');
      ok(res.note.length <= D.GUEST.noteMax, '80자 이하: ' + res.note.length);
      eq(D.guestState(store.state.idx, 'post-1', GUEST.key).note.length <= D.GUEST.noteMax, true, '저장된 한마디도 80자 이하');
      store.state.locks = {};
      var res2 = store.actions.applyGuest('post-2', '   ');
      ok(res2.ok, '빈 한마디도 신청');
      eq(res2.note, D.GUEST.noteDefault, '기본 문구');
      return store.flush();
    });
  });

  test('v1.43 저장소: 글쓴이 수락은 정원을 채우고, 정원이 차면 더 수락하지 않는다', function () {
    clearStorage();
    /* 글쓴이 시점 저장소: 신청자 두 명이 이미 신청한 상태 */
    U.writeJSON('bm_rows_v1', [
      meetRow({ meet: { cap: '2' } }),
      guestRow({ id: 'app-a', kind: '신청', user: 'u_a', nick: '가나', at: at(50) }),
      guestRow({ id: 'app-b', kind: '신청', user: 'u_b', nick: '다라', at: at(40) })
    ]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: OWNER.key, me: { nick: '모집왕' } }) });
    return store.actions.init().then(function () {
      var inbox = D.guestInbox(store.state.idx, OWNER.key);
      eq(inbox.length, 2, '받은 신청 2건');
      var res = store.actions.respondGuest('app-a', true);
      ok(res.ok, '수락');
      eq(res.accepted, true, '수락 결과');
      eq(D.guestState(store.state.idx, 'post-1', 'u_a').status, '수락', '수락 상태');
      eq(D.meetStatus(store.state.idx, store.state.idx.byId['post-1'], OWNER.key).closed, true, '정원이 찼음');
      store.state.locks = {};
      var res2 = store.actions.respondGuest('app-b', true);
      eq(res2.reason, 'full', '정원이 차면 더 수락하지 않음');
      store.state.locks = {};
      var res3 = store.actions.respondGuest('app-a', false);
      eq(res3.reason, 'done', '이미 답한 신청은 다시 처리하지 않음');
      return store.flush();
    });
  });

  test('v1.43 저장소: 다른 사람의 글쓴이가 아니면 수락할 수 없다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', [meetRow(), guestRow({ id: 'app-c', kind: '신청', user: 'u_c', at: at(10) })]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: GUEST.key, me: { nick: '신청자' } }) });
    return store.actions.init().then(function () {
      eq(store.actions.respondGuest('app-c', true).reason, 'not_mine', '글쓴이만 수락');
      return store.flush();
    });
  });

  test('v1.43 저장소: 게스트가 나가면 방이 닫히고 목록에서 사라지며 글이 다시 올라온다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', [
      meetRow({ meet: { cap: '2' } }),
      guestRow({ id: 'app-d', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-d', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: GUEST.key, me: { nick: '신청자' } }) });
    return store.actions.init().then(function () {
      var open = store.actions.openGroupChat('post-1', '');
      ok(open.ok, '수락된 게스트는 방을 열 수 있음');
      store.state.locks = {};
      ok(store.actions.markChatRead('post-1', '').ok, '참여 기록');
      ok(store.actions.sendChat('post-1', '', '안녕하세요! 잘 부탁해요').ok, '단체방 대화');
      eq(store.state.data.threads.filter(function (x) { return x.kind === 'group'; }).length, 1, '목록에 방');
      store.state.locks = {};
      var res = store.actions.leaveGuest('post-1');
      ok(res.ok, '나가기');
      eq(store.state.ui.chatRoom, null, '보고 있던 방이 닫힘');
      eq(store.state.ui.chatOpen, true, '대화 목록으로 돌아감');
      eq(store.state.data.threads.filter(function (x) { return x.kind === 'group'; }).length, 0, '목록에서 사라짐');
      eq(D.meetStatus(store.state.idx, store.state.idx.byId['post-1'], GUEST.key).closed, false, '자리가 남음');
      store.state.locks = {};
      eq(store.actions.leaveGuest('post-1').reason, 'not_member', '이미 나간 사람은 다시 나갈 수 없음');
      /* 나간 사람이 다시 신청할 수 있습니다 */
      store.state.locks = {};
      ok(store.actions.applyGuest('post-1', '다시 들어가고 싶어요').ok, '나간 뒤 다시 신청');
      return store.flush();
    });
  });

  test('v1.43 저장소: 글쓴이는 나갈 수 없다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', [meetRow()]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: OWNER.key, me: { nick: '모집왕' } }) });
    return store.actions.init().then(function () {
      eq(store.actions.leaveGuest('post-1').reason, 'owner', '글쓴이는 나가기 불가');
      return store.flush();
    });
  });

  test('v1.43 저장소: 대기 중에는 단체방에 말을 남길 수 없다', function () {
    return freshStore([meetRow({ meet: { cap: '4' } }), guestRow({ id: 'app-e', kind: '신청', at: at(20) })]).then(function (store) {
      eq(store.actions.openGroupChat('post-1', '').reason, 'not_member', '방 열기 차단');
      eq(store.actions.sendChat('post-1', '', '안녕하세요').reason, 'not_member', '대화 차단');
      return store.flush();
    });
  });

  test('v1.43 저장소: 모집을 끝내면(글 삭제) 그 글의 신청·수락 행도 함께 정리된다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-z', kind: '신청', at: at(40) }),
      guestRow({ id: 'ok-z', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(30) })
    ]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: OWNER.key, me: { nick: '모집왕' } }) });
    return store.actions.init().then(function () {
      ok(store.actions.deletePost('post-1').ok, '모집 종료(글 삭제)');
      var left = store.state.rows.filter(function (r) { return r[D.COL['유형']] === '게스트신청'; });
      eq(left.length, 0, '신청·수락 행도 화면에서 정리');
      eq(store.state.idx.byType['게스트신청'] ? store.state.idx.byType['게스트신청'].length : 0, 0, '도메인 색인에서도 없음');
      return store.flush();
    });
  });

  /* ---------- 4. 화면 ---------- */
  test('v1.43 화면: 카드 버튼이 내 상태를 따라간다 (참여 신청·신청 대기 중·단체방 열기)', function () {
    /* 신청 전 */
    var rows = [meetRow({ meet: { cap: '4' } })];
    var st = stateWith(rows);
    var html = BM.views.community.render(st);
    checkHtml(html, '신청 전');
    includes(html, 'data-vite-go="apply"', '참여 신청 버튼');
    includes(html, '>참여 신청<', '버튼 글자');

    /* 신청 후 (대기) */
    rows.push(guestRow({ kind: '신청', note: '같이 해요', at: at(50) }));
    var st2 = stateWith(rows);
    var html2 = BM.views.community.render(st2);
    includes(html2, 'data-vite-go="pending"', '대기 버튼');
    includes(html2, '신청 대기 중', '대기 글자');
    includes(html2, 'disabled', '누를 수 없음');

    /* 수락 후 */
    rows.push(guestRow({ kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) }));
    var st3 = stateWith(rows);
    var html3 = BM.views.community.render(st3);
    includes(html3, 'data-vite-go="room"', '단체방 열기');
    includes(html3, '>단체방 열기<', '버튼 글자');

    /* 거절 후 */
    rows.push(guestRow({ kind: '거절', user: OWNER.key, target: GUEST.key, at: at(30) }));
    var st4 = stateWith(rows);
    var html4 = BM.views.community.render(st4);
    includes(html4, 'data-vite-go="rejected"', '거절 상태');
    includes(html4, D.GUEST.rejectedLabel, '거절 글자');
  });

  test('v1.43 화면: 글쓴이 카드에 받은 신청 건수와 명단 보기가 붙는다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ kind: '신청', user: 'u_a', nick: '가나', at: at(50) }),
      guestRow({ kind: '신청', user: 'u_b', nick: '다라', at: at(40) })
    ];
    var st = stateWith(rows, OWNER);
    var html = BM.views.community.render(st);
    checkHtml(html, '글쓴이 카드');
    includes(html, '신청 2건', '받은 신청 건수');
    includes(html, 'data-vite-members="post-1"', '명단 보기');
    includes(html, '>단체방 열기<', '글쓴이 버튼');
    /* 명단 시트 본문 — 받은 신청 줄과 수락/거절 버튼 */
    var members = BM.views.community._membersBody(st, 'post-1');
    checkHtml(members, '명단 시트');
    includes(members, '받은 게스트 신청', '신청 구역');
    includes(members, '가나', '신청자 닉네임');
    includes(members, 'data-guest-accept', '수락 버튼');
    includes(members, 'data-guest-reject', '거절 버튼');
    includes(members, '참여자 <b>1명</b>', '지금 참여자 수');
  });

  test('v1.43 화면: 채팅 목록에 받은 게스트 신청 편지지가 수락/거절과 함께 보인다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-f', kind: '신청', user: 'u_f', nick: '신청러', level: 'B조', style: '수비형', note: '토요일 가능해요', at: at(50) })
    ];
    var st = stateWith(rows, OWNER);
    var html = BM.views.chat.listHtml(st);
    checkHtml(html, '채팅 목록');
    includes(html, '받은 게스트 신청', '구역 이름');
    includes(html, '신청러', '신청자 닉네임');
    includes(html, 'B조', '급수');
    includes(html, '수비형', '플레이 스타일');
    includes(html, '토요일 가능해요', '한마디');
    includes(html, 'data-guest-accept="app-f"', '수락 버튼');
    includes(html, 'data-guest-reject="app-f"', '거절 버튼');
    includes(html, '게스트 신청', '우표');
  });

  test('v1.43 화면: 단체방 헤더에 나가기(게스트)와 확인 바가 있다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-g', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-g', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ];
    var st = stateWith(rows);
    st.ui.chatRoom = 'post-1';
    var html = BM.views.chat.roomHtml(st);
    checkHtml(html, '단체방');
    includes(html, 'data-vite-leave="post-1"', '나가기 버튼');
    includes(html, '>나가기<', '버튼 글자');
    includes(html, '참여 2/4명', '모집 현황 줄');
    includes(html, 'data-vite-members="post-1"', '명단 버튼');
    excludes(html, 'data-vite-end', '게스트에게는 모집 종료 없음');
  });

  test('v1.43 화면: 글쓴이 단체방에는 모집 종료가 있고 나가기는 없다', function () {
    var rows = [meetRow({ meet: { cap: '4' } })];
    var st = stateWith(rows, OWNER);
    st.ui.chatRoom = 'post-1';
    var html = BM.views.chat.roomHtml(st);
    includes(html, 'data-vite-end="post-1"', '모집 종료 버튼');
    excludes(html, 'data-vite-leave', '글쓴이는 나가기 없음');
    includes(html, '참여 1/4명', '모집 현황');
  });

  test('v1.43 알림: 글쓴이에게 게스트 신청이 새 소식으로 잡힌다', function () {
    var rows = [meetRow({ meet: { cap: '4' } }), guestRow({ id: 'app-n', kind: '신청', nick: '알림이', at: at(10) })];
    var idx = D.index(rows.map(D.fromRow));
    var fresh = D.newIncoming(idx, OWNER.key, at(60));
    var guest = fresh.requests.filter(function (r) { return r.kind === 'guest'; });
    eq(guest.length, 1, '받은 게스트 신청 1건');
    eq(guest[0].nick, '알림이', '닉네임');
    eq(guest[0].postId, 'post-1', '어느 글인지');
    /* 신청자 본인에게는 새 소식이 아닙니다 */
    eq(D.newIncoming(idx, GUEST.key, at(60)).requests.filter(function (r) { return r.kind === 'guest'; }).length, 0, '신청자에게는 알림 없음');
  });

  /* ---------- 5. 보안 ---------- */
  test('v1.43 보안: 신청 한마디·닉네임이 HTML로 실행되지 않는다', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-x', kind: '신청', user: 'u_x', nick: PAYLOAD, note: PAYLOAD, style: PAYLOAD, at: at(50) })
    ];
    var ownerHtml = BM.views.chat.listHtml(stateWith(rows, OWNER));
    checkHtml(ownerHtml, '받은 신청 편지지');
    excludes(ownerHtml, '<img src=x', '닉네임·한마디가 태그로 박히지 않음');
    excludes(ownerHtml, '<script>', '스크립트 태그 없음');
    var guestHtml = BM.views.community.render(stateWith(rows));
    excludes(guestHtml, '<img src=x', '카드에도 태그 없음');
  });

  test('v1.43 보안: 게스트신청 행은 JSON 종류만 읽고 남의 상태는 바꾸지 않는다', function () {
    /* 알 수 없는 kind 는 상태를 바꾸지 않습니다 */
    var rows = [
      meetRow(),
      guestRow({ kind: '해킹', at: at(20) }),
      guestRow({ kind: '신청', at: at(30) })
    ];
    var idx = D.index(rows.map(D.fromRow));
    eq(D.guestState(idx, 'post-1', GUEST.key).status, '대기', '모르는 종류는 무시');
    /* 깨진 JSON·빈 팀도 안전합니다 */
    var broken = D.fromRow(D.toRow({ id: 'bad-1', type: '게스트신청', userKey: 'u_q', team: '', payload: null }));
    eq(D.guestKind(broken), '', '깨진 행도 안전');
    eq(D.guestStates(D.index([broken]), '').length, undefined, '빈 글 ID는 빈 상태');
  });

  /* ---------- 6. 버전 · 문서 ---------- */
  test('v1.43 버전: sw · app · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.99.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.99.0'", 'app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.99.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.99.0', 'TWA appVersion');
    eq(twa.appVersionCode, 93, 'appVersionCode 유지');
    includes(readRoot('index.html'), 'styles.css?v=20261128-5', '스타일 캐시 키');
  });

  test('v1.43 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md'), ideas = readRoot('ideas.md');
    includes(readme, 'v1.43.0', 'README 버전 절');
    includes(readme, '참여 신청', 'README 신청 설명');
    includes(readme, '나가기', 'README 나가기');
    includes(ideas, 'bm-v1.43.0', '아이디어 노트');
    includes(readRoot('test/run.js'), 'test/v143.test.js', '테스트 실행 목록');
  });

  test('v1.43 CSP: index.html 인라인 스크립트 해시가 그대로 맞는다', function () {
    if (!hasNode) return;
    var crypto = require('crypto');
    var html = readRoot('index.html');
    var hashes = (html.match(/sha256-[A-Za-z0-9+/=]+/g) || []);
    var inline = [];
    var re = /<script>([\s\S]*?)<\/script>/g, m;
    while ((m = re.exec(html))) inline.push(m[1]);
    eq(inline.length, 2, '인라인 스크립트 2개');
    eq(hashes.length, 2, '해시 2개');
    inline.forEach(function (body) {
      var h = 'sha256-' + crypto.createHash('sha256').update(body, 'utf8').digest('base64');
      ok(hashes.indexOf(h) >= 0, '해시 일치: ' + h);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
