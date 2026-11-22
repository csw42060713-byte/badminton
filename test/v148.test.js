/* ============================================================
 * test/v148.test.js — bm-v1.48.0
 *   🗓 게스트 모집 날짜·시간 고르기 · 단체방 삭제 · 코트 점수판 가로 보기
 *
 *  1) 일시 고르기 — 날짜 칩(오늘·내일·이번 주말) + 달력 칸 + 시간 칩이
 *     지금 그대로의 저장 포맷('11/23(월) 19:00~21:00')을 만든다 (카드·지도·신청 호환)
 *  2) 손으로 적은 일시도 칸에 다시 채워 고칠 수 있다(parse) — 예전 글 그대로 읽힘
 *  3) 작성 칸 화면 — 언제 칸 아래 칩·달력·시간 칸, 게스트비 칸은 그대로
 *  4) 단체방 삭제 — 글쓴이만. 글·신청 행·방이 함께 정리되고 대화 목록에서 사라진다
 *  5) 참여자 화면 — 방장이 지운 방은 목록에서 빠지고, 열어 둔 화면은 삭제 안내로 바뀐다
 *  6) 코트 점수판 가로 — 가로 보기는 내 팀(왼쪽)|상대(오른쪽), 세로는 지금 그대로
 *  7) 버전 · 배선 · 보안
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

  var OWNER = { key: 'u_owner148', nick: '모집왕', level: 'B조', discipline: '복식', theme: { theme: 'th_night' } };
  var GUEST = { key: 'u_guest148', nick: '신청자', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, style: '공격형' };

  function meetRow(opts) {
    opts = opts || {};
    var plan = { topic: '게스트 모집' };
    var meet = opts.meet;
    if (meet !== null) plan.meet = meet || { when: '11/23(월) 19:00~21:00', place: '영통 체육관', cap: '4' };
    return D.toRow({
      id: opts.id || 'post-148', type: '소셜', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '모집왕', text: opts.text || '게스트 모집합니다',
      userKey: opts.userKey || OWNER.key, plan: plan
    });
  }

  function guestRow(opts) {
    return D.toRow({
      id: opts.id || ('g148-' + (opts.kind || 'x') + '-' + Math.random().toString(36).slice(2, 6)),
      type: '게스트신청', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '신청자', userKey: opts.user || GUEST.key, target: opts.target || OWNER.key,
      team: opts.post || 'post-148',
      payload: { kind: opts.kind, note: opts.note || '', nick: opts.nick || '신청자', level: 'C조', style: '' }
    });
  }

  function stateWith(rows, me) {
    var who = me || GUEST;
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

  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || []);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: OWNER.key, me: { nick: '모집왕' } }) });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 일시 고르기 (도메인)
   * ========================================================= */

  test('v1.48 일시: 날짜·시간을 지금 저장 포맷 한 줄로 만든다', function () {
    var W = D.meetWhen;
    eq(W.compose('2026-11-23', '19:00', '21:00'), '11/23(월) 19:00~21:00', '시작~끝');
    eq(W.compose('2026-11-23', '19:00', ''), '11/23(월) 19:00', '시작만');
    eq(W.compose('2026-11-23', '', ''), '11/23(월)', '날짜만');
    eq(W.compose('', '19:00', '21:00'), '', '날짜가 없으면 빈 값');
    eq(W.compose('2026-12-05', '9:00', '11:30'), '12/5(토) 09:00~11:30', '한 자리 시각도 09:00');
    eq(W.compose('2026-11-23', '19:00', '19:00'), '11/23(월) 19:00', '같은 시각은 한 번만');
    eq(W.compose('2026-11-23', '25:00', '24:00'), '11/23(월)', '잘못된 시각은 버림');
    eq(W.compose('2026-02-31', '19:00', '21:00'), '', '없는 날짜는 빈 값');
    ok(W.compose('2026-11-23', '19:00', '21:00').length <= 30, '저장 칸(30자) 안에 들어감');
  });

  test('v1.48 일시: 손으로 적은 글자도 날짜·시간 칸으로 다시 꺼낸다', function () {
    var now = new Date(2026, 10, 22, 12, 0, 0);      /* 2026-11-22(일) */
    var p = D.meetWhen.parse('11/23(월) 19:00~21:00', now);
    eq(p.date, '2026-11-23', '날짜');
    eq(p.start, '19:00', '시작');
    eq(p.end, '21:00', '끝');

    var one = D.meetWhen.parse('11/21(금) 19:00', now);
    eq(one.date, '2026-11-21', '시작만 있는 예전 글');
    eq(one.end, '', '끝은 빈 값');

    var dash = D.meetWhen.parse('12/5(토) 14:00-16:00', now);
    eq(dash.date, '2026-12-05', "'-' 표기도 읽음");
    eq(dash.start + '~' + dash.end, '14:00~16:00', '범위');

    var next = D.meetWhen.parse('1/3(토) 14:00~16:00', now);
    eq(next.date, '2027-01-03', '지난 날짜면 다음 해로');

    var none = D.meetWhen.parse('토요일 저녁에 해요', now);
    eq(none.date, '', '날짜가 없으면 빈 값');
    eq(none.start, '', '시각도 빈 값');
    eq(D.meetWhen.parse('', now).date, '', '빈 글자');
    eq(D.meetWhen.parse(null, now).date, '', 'null');
  });

  /* bm-v1.52.2 — 일요일이면 '이번 주말'이 오늘과 같은 날이라 칩을 하나만 두도록 바뀌었습니다
   * (조환비 님 피드백: '오늘 11/22(일)'·'이번 주말 11/22(일)' 중복) */
  test('v1.48 일시: 빠른 칩은 오늘·내일·이번 주말(주말에는 겹치는 주말 칩을 빼둠)', function () {
    var q = D.meetWhen.quickDates(new Date(2026, 10, 22));   /* 일요일 */
    eq(q.length, 2, '일요일에는 칩 2개(오늘·내일)');
    eq(q[0].label, '오늘', '첫 칩');
    eq(q[0].date, '2026-11-22', '오늘 날짜');
    eq(q[0].day, '11/22(일)', '요일까지');
    eq(q[1].label, '내일', '둘째 칩');
    eq(q[1].date, '2026-11-23', '내일 날짜');

    var wed = D.meetWhen.quickDates(new Date(2026, 10, 25));  /* 수요일 */
    eq(wed.length, 3, '평일에는 칩 3개');
    eq(wed[2].label, '이번 주말', '셋째 칩');
    eq(wed[2].date, '2026-11-28', '수요일이면 다가오는 토요일');
    eq(wed[2].day, '11/28(토)', '토요일 표기');

    eq(D.meetWhen.quickTimes.length >= 3, true, '자주 쓰는 시간대');
    includes(D.meetWhen.quickTimes.join(','), '19:00~21:00', '저녁 시간대');
  });

  test('v1.48 일시: 고른 값이 그대로 모집 정보가 된다 (카드·정원·신청 호환)', function () {
    return freshStore([]).then(function (store) {
      store.actions.setComposerTopic('게스트 모집');
      store.actions.setComposerMeet('when', D.meetWhen.compose('2026-11-23', '19:00', '21:00'));
      store.actions.setComposerMeet('place', '영통 체육관');
      store.actions.setComposerMeet('cap', '4');
      store.state.locks = {};
      var res = store.actions.createPost('', '게스트 모집', store.state.ui.composerMeet);
      ok(res.ok, '올리기');
      eq(res.meet.when, '11/23(월) 19:00~21:00', '저장된 일시');

      var post = store.state.data.posts[0];
      ok(post, '글이 있음');
      eq(post.meet.when, '11/23(월) 19:00~21:00', '다시 읽은 일시');
      eq(D.meetStatus(store.state.idx, post, GUEST.key).cap, 4, '정원도 그대로');
      var html = BM.views.community.render(store.state);
      includes(html, '11/23(월) 19:00~21:00', '모집 카드에 그대로');
      includes(html, 'data-vite-go="room"', '글쓴이 버튼(단체방 열기)도 그대로');
      return store.flush();
    });
  });

  /* =========================================================
   * 2. 작성 칸 화면
   * ========================================================= */

  test('v1.48 화면: 작성 칸에 날짜 칩·달력 칸·시간 칩이 함께 있다', function () {
    var st = stateWith([]);
    st.ui.composerTopic = '게스트 모집';
    st.ui.composerMeet = { when: '11/23(월) 19:00~21:00', place: '', cap: '', fee: '' };
    var html = BM.views.community.render(st);
    checkHtml(html, '작성 칸');

    includes(html, 'data-vitewhen="date"', '달력 칸');
    includes(html, 'data-vitewhen="start"', '시작 시간');
    includes(html, 'data-vitewhen="end"', '끝 시간');
    includes(html, 'type="date"', '날짜 선택기');
    includes(html, 'type="time"', '시간 선택기');

    var q = D.meetWhen.quickDates();
    q.forEach(function (x) {
      includes(html, 'data-viteday-quick="' + x.date + '"', x.label + ' 칩');
      includes(html, x.label, x.label + ' 글자');
      includes(html, x.day, x.label + ' 날짜 표기');
    });
    D.meetWhen.quickTimes.forEach(function (v) {
      includes(html, 'data-vitetime-quick="' + v + '"', v + ' 칩');
    });

    /* 적힌 일시는 날짜·시간 칸에 그대로 채워지고, 그 칩이 켜집니다 */
    var parsed = D.meetWhen.parse('11/23(월) 19:00~21:00');
    includes(html, 'value="' + parsed.date + '"', '날짜 칸 값');
    includes(html, 'value="19:00"', '시작 칸 값');
    includes(html, 'value="21:00"', '끝 칸 값');
    includes(html, 'data-vitetime-quick="19:00~21:00" aria-pressed="true"', '맞는 시간 칩은 켜짐');
    includes(html, 'data-vitetime-quick="20:00~22:00" aria-pressed="false"', '다른 칩은 꺼짐');

    /* 예전처럼 손으로 적는 칸도 남아 있습니다(포맷·글자 수 그대로) */
    includes(html, 'data-vitefield="when"', '일시 글자 칸');
    includes(html, 'placeholder="11/21(금) 19:00"', '안내 문구');
    includes(html, 'data-vitefield="fee"', '게스트비 칸은 그대로');

    /* 자유 말머리면 모집 칸 자체가 접혀 있습니다 */
    var free = BM.views.community.render(stateWith([]));
    includes(free, 'data-viteform hidden', '자유일 때는 접힘');
    eq(free.indexOf('data-viteday-quick') > free.indexOf('data-viteform'), true, '칩은 모집 칸 안에만');
  });

  test('v1.48 화면: 일시를 손으로 고쳐도 날짜·시간 칸이 따라간다 (배선)', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/community.js');
    includes(src, 'function syncWhen', '칸 → 글자');
    includes(src, 'function whenFromText', '글자 → 칸');
    includes(src, 'function paintWhen', '칩 켜짐');
    includes(src, 'data-viteday-quick', '날짜 칩 배선');
    includes(src, 'data-vitetime-quick', '시간 칩 배선');
    includes(src, "'[data-vitewhen]'", '달력·시간 칸 change');
    includes(src, "setComposerMeet('when'", '기존 저장 경로 그대로');
  });

  /* =========================================================
   * 3. 단체방 삭제 (저장소)
   * ========================================================= */

  test('v1.48 삭제: 글쓴이가 방을 지우면 글·신청 행·방이 함께 사라진다', function () {
    return freshStore([
      meetRow({ meet: { when: '11/23(월) 19:00~21:00', place: '영통 체육관', cap: '4' } }),
      guestRow({ id: 'app-148', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-148', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ]).then(function (store) {
      var open = store.actions.openGroupChat('post-148', '');
      ok(open.ok, '글쓴이는 방을 열 수 있음');
      eq(store.state.ui.chatRoom, 'post-148', '방이 열려 있음');

      var res = store.actions.deleteGroupRoom('post-148');
      ok(res.ok, '방 삭제');
      eq(res.roomId, 'post-148', '방 번호 = 글 번호');
      eq(!!store.state.idx.byId['post-148'], false, '글이 사라짐');
      eq(store.state.data.posts.length, 0, '피드에도 없음');
      var left = store.state.rows.filter(function (r) { return r[D.COL['유형']] === '게스트신청'; });
      eq(left.length, 0, '신청·수락 행도 함께 정리');
      eq(store.state.data.threads.filter(function (x) { return x.kind === 'group'; }).length, 0, '대화 목록에서 사라짐');
      eq(store.state.ui.chatRoom, null, '방 화면에서 나옴');
      eq(store.state.ui.chatOpen, true, '채팅 목록은 열린 채');
      return store.flush();
    });
  });

  test('v1.48 삭제: 글쓴이가 아니면 지울 수 없다 (참여자는 나가기 그대로)', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-2', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-2', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ]);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: GUEST.key, me: { nick: '신청자' } }) });
    return store.actions.init().then(function () {
      eq(store.actions.deleteGroupRoom('post-148').reason, 'not_owner', '참여자는 방 삭제 불가');
      ok(store.state.idx.byId['post-148'], '글이 그대로');
      ok(store.actions.openGroupChat('post-148', '').ok, '방은 그대로 들어갈 수 있음');
      /* 기존 나가기는 그대로 (자리가 나서 글이 다시 올라옴) */
      ok(store.actions.leaveGuest('post-148').ok, '나가기');
      eq(D.guestState(store.state.idx, 'post-148', GUEST.key).status, '나가기', '나간 상태');
      eq(D.meetStatus(store.state.idx, store.state.idx.byId['post-148'], GUEST.key).closed, false, '자리가 남음');
      return store.flush();
    });
  });

  test('v1.48 삭제: 없는 글·로그아웃은 조용히 막는다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', []);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0, meKey: OWNER.key, me: { nick: '모집왕' } }) });
    return store.actions.init().then(function () {
      eq(store.actions.deleteGroupRoom('nope').reason, 'not_found', '없는 글');
      eq(store.actions.deleteGroupRoom('').reason, 'not_found', '빈 번호');
      store.state.me = { key: '', nick: '' };
      eq(store.actions.deleteGroupRoom('nope').reason, 'no_login', '로그아웃');
      return store.flush();
    });
  });

  /* =========================================================
   * 4. 화면 — 글쓴이/참여자
   * ========================================================= */

  test('v1.48 화면: 글쓴이 단체방에 방 삭제가 있고, 게스트에게는 나가기뿐이다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-3', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-3', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ];
    var ownerSt = stateWith(rows, OWNER);
    ownerSt.ui.chatRoom = 'post-148';
    var ownerHtml = BM.views.chat.roomHtml(ownerSt);
    checkHtml(ownerHtml, '글쓴이 방');
    includes(ownerHtml, 'data-vite-end="post-148"', '방 삭제 버튼');
    includes(ownerHtml, D.MEET.deleteLabel, '방 삭제 글자');
    excludes(ownerHtml, 'data-vite-leave', '글쓴이는 나가기 없음');

    var guestSt = stateWith(rows);
    guestSt.ui.chatRoom = 'post-148';
    var guestHtml = BM.views.chat.roomHtml(guestSt);
    includes(guestHtml, 'data-vite-leave="post-148"', '게스트 나가기');
    excludes(guestHtml, 'data-vite-end', '게스트에게는 방 삭제 없음');
    includes(guestHtml, '참여 2/4명', '모집 현황 그대로');
  });

  test('v1.48 화면: 대화 목록에서 글쓴이만 단체방을 지울 수 있다', function () {
    var rows = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-4', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-4', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ];
    var ownerList = BM.views.chat.listHtml(stateWith(rows, OWNER));
    checkHtml(ownerList, '글쓴이 목록');
    includes(ownerList, 'data-room-del="post-148"', '목록의 방 삭제 버튼');
    includes(ownerList, '게스트 모집 단체방', '방 이름');

    var guestList = BM.views.chat.listHtml(stateWith(rows));
    includes(guestList, '게스트 모집 단체방', '게스트 목록에도 방은 보임');
    excludes(guestList, 'data-room-del', '게스트에게는 삭제 버튼 없음');
  });

  test('v1.48 화면: 방장이 지운 방은 목록에서 빠지고, 열어 둔 화면은 삭제 안내로 바뀐다', function () {
    var live = [
      meetRow({ meet: { cap: '4' } }),
      guestRow({ id: 'app-5', kind: '신청', at: at(50) }),
      guestRow({ id: 'ok-5', kind: '수락', user: OWNER.key, target: GUEST.key, at: at(40) })
    ];
    var st = stateWith(live);
    st.ui.chatRoom = 'post-148';
    var before = BM.views.chat.roomHtml(st);
    includes(before, 'data-vite-leave="post-148"', '지우기 전에는 방 화면');

    /* 방장이 지운 뒤 서버에서 받은 상태 — 글 행이 사라진다 */
    var after = stateWith([live[1], live[2]]);
    eq(after.data.threads.filter(function (x) { return x.kind === 'group'; }).length, 0, '대화 목록에서 사라짐');
    after.ui.chatRoom = 'post-148';           /* 참여자가 방을 열어 둔 채 */
    var notice = BM.views.chat.roomHtml(after);
    checkHtml(notice, '삭제 안내');
    includes(notice, '방장이 단체방을 삭제했어요', '삭제 안내 문구');
    includes(notice, 'data-dm-back', '대화 목록으로 돌아가기');
    excludes(notice, 'data-dm-form', '대화 입력창 없음');
    var list = BM.views.chat.listHtml(after);
    excludes(list, '게스트 모집 단체방', '목록에도 남지 않음');
  });

  /* =========================================================
   * 5. 코트 점수판 가로 보기
   * ========================================================= */

  test('v1.48 가로: 가로는 내 팀(왼쪽)·상대(오른쪽), 세로는 지금 그대로', function () {
    var SB = BM.scoreboard;
    var st = SB.create({ mode: 21, type: '복식' });

    var land = BM.views.log.scoreboardHtml(st, { land: true, swap: false });
    checkHtml(land, '가로 점수판');
    includes(land, 'data-sb-view="land"', '가로 표시');
    includes(land, 'is-land', '가로 클래스');
    includes(land, 'data-sb-rotate', '가로/세로 보기 버튼');
    includes(land, '세로 보기', '가로일 때 버튼 글자');
    ok(land.indexOf('data-sb-point="a"') < land.indexOf('data-sb-point="b"'), '내 팀이 왼쪽(먼저)');

    var swapped = BM.views.log.scoreboardHtml(st, { land: true, swap: true });
    ok(swapped.indexOf('data-sb-point="b"') < swapped.indexOf('data-sb-point="a"'), '코트 교대는 자리를 바꿈');

    var port = BM.views.log.scoreboardHtml(st, { land: false, swap: false });
    includes(port, 'data-sb-view="port"', '세로 표시');
    includes(port, '가로 보기', '세로일 때 버튼 글자');
    ok(port.indexOf('data-sb-point="b"') < port.indexOf('data-sb-point="a"'), '세로는 상대가 위');
  });

  test('v1.48 가로: 점수·되돌리기·세트 초기화·다음 세트가 가로에서도 그대로다', function () {
    var SB = BM.scoreboard;
    var st = SB.create({ mode: 21, type: '복식' });
    st = SB.point(st, 'a');
    st = SB.point(st, 'b');
    st = SB.point(st, 'a');
    var html = BM.views.log.scoreboardHtml(st, { land: true });
    includes(html, '<b class="sb__num">2</b>', '내 점수 2');
    includes(html, '<b class="sb__num">1</b>', '상대 점수 1');
    includes(html, 'data-sb-undo', '되돌리기');
    includes(html, 'data-sb-swap', '코트 교대');
    includes(html, 'data-sb-reset', '세트 초기화');

    var up = SB.undo(st);
    eq(up.a + ':' + up.b, '1:1', '되돌리기 한 점');
    eq(SB.resetSet(st).a, 0, '세트 초기화');

    var near = SB.copy(st);
    near.a = 20; near.b = 3;
    var win = SB.point(near, 'a');
    eq(win.over, 'a', '21점이면 세트 종료');
    var winHtml = BM.views.log.scoreboardHtml(win, { land: true });
    includes(winHtml, 'data-sb-next', '다음 세트 버튼');
    includes(winHtml, '세트 종료', '세트 종료 안내');
  });

  test('v1.48 가로: 기기 회전·CSS 회전·버튼 배선이 살아 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '@media (orientation: landscape)', '기기 회전 대응');
    includes(css, '.sbfull.is-land .sb__board', '가로 배치');
    includes(css, 'grid-template-columns: 1fr 1fr', '좌우 두 칸');
    includes(css, '.sbfull.is-land.is-qrot', '세로 화면에서 강제 가로');
    includes(css, 'rotate(90deg)', 'CSS 90도 회전');
    includes(css, '.sbfull__rot', '가로/세로 보기 버튼');

    var log = readRoot('js/views/log.js');
    includes(log, 'data-sb-rotate', '버튼 배선');
    includes(log, 'screen.orientation', '회전 잠금 시도');
    includes(log, 'sbApplyOrient', '방향 적용');
    includes(log, "'orientationchange'", '기기 회전 이벤트');
    includes(log, "matchMedia('(orientation: landscape)')", '가로 판정');
  });

  /* =========================================================
   * 6. 버전 · 배선 · 보안
   * ========================================================= */

  test('v1.48 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.54.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.54.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261122-68', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.54.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 48', '앱 버전 코드');
  });

  test('v1.48 배선: 새 파일 없이 기존 파일만 바뀐다 (서비스워커·테스트 목록)', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v148.test.js', '테스트 목록');
    var sw = readRoot('sw.js');
    excludes(sw, './js/whenpicker.js', '새 파일 없음');
    excludes(sw, './js/views/scoreboard.js', '새 화면 파일 없음');
    includes(sw, './js/views/chat.js', '채팅');
    includes(sw, './js/views/community.js', '커뮤니티');
  });

  test('v1.48 보안: 새 화면도 esc 를 쓰고 confirm() 창을 쓰지 않는다', function () {
    if (!hasNode) return;
    var chat = readRoot('js/views/chat.js');
    includes(chat, 'U.esc(D.MEET.deleteLabel)', '삭제 글자 탈출');
    includes(chat, 'U.esc(t.roomId)', '방 번호 탈출');
    includes(chat, 'deleteGroupRoom', '저장소 경로를 거침');
    excludes(chat, 'confirm(', '브라우저 confirm 창 없음');
    var comm = readRoot('js/views/community.js');
    includes(comm, 'U.esc(cur.date', '날짜 값 탈출');
    includes(comm, 'U.esc(q.day)', '요일 표기 탈출');
    includes(comm, 'U.esc(v)', '시간 칩 값 탈출');
    excludes(comm, 'confirm(', '브라우저 confirm 창 없음');
    var index = readRoot('index.html');
    includes(index, "object-src 'none'", 'CSP object-src');
    includes(index, "base-uri 'none'", 'CSP base-uri');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
