/* ============================================================
 * test/v120.test.js — v1.20.0 (2026-11-20)
 *  1) 채팅 보낸 시각: 말풍선마다 시각, 다른 날은 날짜까지, 날짜 구분선
 *  2) 활동 상태: 활동 중 / 방금 전 활동 / N분 전 활동 / 오늘 활동 / N일 전 / 오래전 / 정보 없음
 *  3) 새 메시지·새 1:1 요청 감지: 직전 확인 이후 것만, 내가 보낸 것·참여 안 한 단체방 제외
 *  4) 알림 설정(기본 켜짐·끄기 저장)과 편지지 설정(끄면 일반 요청 카드·즉시 전송)
 *  5) 내 활동 시각을 매칭프로필 JSON에만 남긴다 (26칸 그대로)
 *  6) 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util, D = BM.domain;
  var ME = BM.seed.ME;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* ---------- 스토리지 되돌리기 ---------- */
  var TOUCHED = [D.PREFS_KEY, 'bm_rows_v1', 'bm_cache_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_mode_v1'];
  function snapshot() {
    return TOUCHED.map(function (k) { return [k, U.storage.getItem(k)]; });
  }
  function restore(snap) {
    snap.forEach(function (p) {
      if (p[1] == null) U.storage.removeItem(p[0]);
      else U.storage.setItem(p[0], p[1]);
    });
  }
  function withStorage(fn) {
    var snap = snapshot();
    try { return fn(); } finally { restore(snap); }
  }

  var NOW = new Date(2026, 10, 20, 14, 30, 0);   /* 2026-11-20(금) 14:30 */
  function at(daysAgo, h, m) {
    var d = U.addDays(NOW, -daysAgo);
    return U.ymd(d) + ' ' + U.pad2(h) + ':' + U.pad2(m || 0) + ':00';
  }
  function minsAgo(n) { return U.stamp(new Date(NOW.getTime() - n * 60000)); }

  /* ---------- 화면 상태 도우미 ---------- */
  var ME_OBJ = {
    key: ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };
  function stateOf(rows, prefs, meKey) {
    rows = rows || BM.fixtures.demo();
    meKey = meKey || ME;
    return {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME_OBJ)),
      prefs: D.normalizePrefs(prefs || {}),
      rows: rows, data: BM.store.derive(rows, meKey),
      inbox: { messages: [], requests: [], friendRequests: [], total: 0, at: '' },
      drafts: { log: {} },
      ui: {
        tab: 'matching', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchTab: 'in', matchStarted: true,
        chatRoom: null, chatOther: '', chatDraft: '', chatOtherSeen: '',
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1) 보낸 시각
   * ========================================================= */
  test('v1.20 시각: 같은 날은 오후 2:20, 다른 날은 날짜를 붙인다', function () {
    eq(D.chatTime('2026-11-20 14:20:00'), '오후 2:20', '오후 표기');
    eq(D.chatTime('2026-11-20 09:05:00'), '오전 9:05', '오전 표기');
    eq(D.chatTime(''), '', '빈 값');
    eq(D.chatStamp('2026-11-20 14:20:00', NOW.getTime()), '오후 2:20', '같은 날은 시각만');
    eq(D.chatStamp('2026-11-18 14:20:00', NOW.getTime()), '11/18 14:20', '다른 날은 날짜 + 24시간제');
    eq(D.chatListTime('2026-11-20 14:20:00', NOW.getTime()), '오후 2:20', '목록: 오늘은 시계');
    eq(D.chatListTime('2026-11-19 22:00:00', NOW.getTime()), '어제', '목록: 어제');
    eq(D.chatListTime('2026-11-18 10:00:00', NOW.getTime()), '11/18', '목록: 그 전');
    eq(D.chatDayKey('2026-11-18 10:00:00'), '2026-11-18', '날짜 키');
    eq(D.chatDayLabel('2026-11-20 08:00:00', NOW.getTime()), '오늘', '구분선 오늘');
    eq(D.chatDayLabel('2026-11-19 08:00:00', NOW.getTime()), '어제', '구분선 어제');
    eq(D.chatDayLabel('2026-11-18 08:00:00', NOW.getTime()), '11월 18일 (수)', '구분선 날짜');
  });

  test('v1.20 시각: 말풍선마다 시각이 있고 날짜가 바뀌면 구분선이 생긴다', function () {
    var state = stateOf();
    var today = U.ymd();
    var yesterday = U.ymd(U.addDays(new Date(), -1));
    var msgs = [
      { id: 'a', userKey: 'demo_net', nick: '네트앞여우', text: '어제 보낸 글', createdAt: yesterday + ' 20:10:00' },
      { id: 'b', userKey: ME, nick: '나래', text: '오늘 답장', createdAt: today + ' 09:05:00' },
      { id: 'c', userKey: 'demo_net', nick: '네트앞여우', text: '오늘 두 번째', createdAt: today + ' 14:20:00' }
    ];
    var html = BM.views.chat.messagesHtml(msgs, state, 'demo_net');
    var bubbles = html.split('class="dbubble"').length - 1;
    var times = html.split('<time>').length - 1;
    eq(bubbles, 3, '말풍선 3개');
    eq(times, 3, '말풍선마다 시각');
    includes(html, 'dmsgday', '날짜 구분선');
    includes(html, '어제', '어제 구분선');
    includes(html, '오늘', '오늘 구분선');
    includes(html, '오전 9:05', '보낸 시각 표기');
    includes(html, '오후 2:20', '보낸 시각 표기(두 번째)');
  });

  test('v1.20 시각: 대화 목록에도 마지막 메시지 시각이 보인다', function () {
    var state = stateOf();
    var room = state.data.threads.filter(function (r) { return r.kind === 'match'; })[0];
    ok(room, '매칭 대화방이 있다');
    var html = BM.views.chat.listHtml(state);
    includes(html, 'data-thread="' + room.roomId + '"', '대화 목록 줄');
    includes(html, D.chatListTime(room.at), '마지막 메시지 시각');
    excludes(html, '<time>' + U.esc(room.at) + '</time>', '원본 타임스탬프를 그대로 보여 주지 않는다');
  });

  /* =========================================================
   * 2) 활동 상태
   * ========================================================= */
  test('v1.20 활동: 5분·15분·1시간·오늘·N일·오래전·정보 없음을 구분한다', function () {
    var p1 = D.presenceFromAt(minsAgo(2), NOW.getTime());
    eq(p1.state, 'on', '2분 전 → 활동 중');
    eq(p1.label, '활동 중');
    eq(p1.dot, true, '초록 점');
    eq(D.presenceFromAt(minsAgo(5), NOW.getTime()).state, 'on', '5분까지 활동 중');
    eq(D.presenceFromAt(minsAgo(10), NOW.getTime()).label, '방금 전 활동', '15분 이내');
    eq(D.presenceFromAt(minsAgo(30), NOW.getTime()).label, '30분 전 활동', '1시간 이내');
    eq(D.presenceFromAt(minsAgo(180), NOW.getTime()).label, '오늘 활동', '오늘 안');
    eq(D.presenceFromAt(minsAgo(20 * 60), NOW.getTime()).label, '어제 활동', '20시간 전(어제)');
    eq(D.presenceFromAt(at(2, 9, 0), NOW.getTime()).label, '2일 전 활동', '7일 이내');
    eq(D.presenceFromAt(at(10, 9, 0), NOW.getTime()).label, '오래전', '일주일 넘음');
    var none = D.presenceFromAt('', NOW.getTime());
    eq(none.label, '활동 정보 없음');
    eq(none.state, 'none');
    eq(none.dot, false);
    /* 미래 시각(기기 시간 차이)은 활동 중으로 */
    eq(D.presenceFromAt(U.stamp(new Date(NOW.getTime() + 120000)), NOW.getTime()).state, 'on');
  });

  test('v1.20 활동: 마지막 활동은 채팅·일지·프로필 갱신 중 가장 늦은 값이다', function () {
    /* 예시 데이터도 고정 시각(NOW)으로 만들어 날짜가 바뀌어도 같은 결과가 나오게 합니다 */
    var rows = BM.fixtures.demo(NOW);
    var idx = D.index(rows.map(D.fromRow));
    var last = D.lastActiveAt(idx, 'demo_net');
    ok(last, '활동 시각이 있다');
    /* 상대의 마지막 활동(어제 22:13 커뮤니티 하트)이 채팅·프로필보다 늦다 */
    eq(last, at(1, 22, 13), '가장 늦은 활동');
    /* 매칭프로필 lastActiveAt 이 더 늦으면 그 값을 쓴다 */
    rows.push(D.toRow({
      id: 'presence1', type: '매칭프로필', createdAt: at(1, 21, 0), userKey: 'demo_net', nick: '네트앞여우',
      payload: { nick: '네트앞여우', lastActiveAt: at(0, 14, 0) }
    }));
    var idx2 = D.index(rows.map(D.fromRow));
    eq(D.lastActiveAt(idx2, 'demo_net'), at(0, 14, 0), 'lastActiveAt 우선');
    eq(D.presenceOf(idx2, 'demo_net', new Date(2026,10,20,14,30).getTime()).label, '30분 전 활동', '상태 계산');
    eq(D.lastActiveAt(idx, 'nobody'), '', '기록 없는 사람');
  });

  test('v1.20 활동: 채팅방 헤더·대화 목록·프로필에 표시된다', function () {
    var rows = BM.fixtures.demo();
    /* 데모 상대를 '활동 중'으로 (지금 막 메시지를 남긴 것처럼) */
    rows.push(D.toRow({
      id: 'active1', type: '매칭채팅', createdAt: U.stamp(), userKey: 'demo_net', target: ME,
      team: 'room-live', nick: '네트앞여우', text: '지금 있어요?'
    }));
    var state = stateOf(rows);
    var room = state.data.threads.filter(function (r) { return r.other === 'demo_net' && r.kind === 'match'; })[0];
    ok(room, '방이 있다');
    state.ui.chatRoom = room.roomId;
    var head = BM.views.chat.roomHtml(state);
    includes(head, 'presence', '헤더 활동 상태');
    includes(head, '활동 중', '헤더 문구');
    var list = BM.views.chat.listHtml(state);
    includes(list, 'presence--row', '목록 활동 상태');
    var p = state.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_net'; })[0];
    var prof = BM.views.matching.profileBody(state, p);
    includes(prof, 'presence', '프로필 활동 상태');
    includes(BM.ui.presence({ state: 'on', label: '활동 중' }), 'presence--on', 'UI 헬퍼');
  });

  /* =========================================================
   * 3) 새 메시지·요청 감지
   * ========================================================= */
  function chatRow(o) {
    return D.toRow({
      id: o.id, type: '매칭채팅', createdAt: o.at, userKey: o.userKey,
      target: o.target || '', team: o.team || 'room1', nick: o.nick || '', text: o.text || ''
    });
  }

  test('v1.20 새 소식: 직전 확인 이후 새 메시지·1:1 요청만 골라낸다', function () {
    var rows = [
      chatRow({ id: 'm1', at: '2026-11-20 10:00:00', userKey: 'u_a', target: 'me', nick: '에이', text: '지난 메시지' }),
      chatRow({ id: 'm2', at: '2026-11-20 10:05:00', userKey: 'u_a', target: 'me', nick: '에이', text: '새 메시지' }),
      chatRow({ id: 'm3', at: '2026-11-20 10:06:00', userKey: 'me', target: 'u_a', nick: '나', text: '내 답장' }),
      D.toRow({
        id: 'r1', type: '매칭신청', createdAt: '2026-11-20 10:07:00', userKey: 'u_b', target: 'me',
        nick: '비', status: '대기', payload: { note: '같이 쳐요' }
      })
    ];
    var idx = D.index(rows.map(D.fromRow));
    var fresh = D.newIncoming(idx, 'me', '2026-11-20 10:04:00');
    eq(fresh.messages.length, 1, '내가 보낸 답장 제외');
    eq(fresh.messages[0].text, '새 메시지');
    eq(fresh.messages[0].nick, '에이');
    eq(fresh.messages[0].roomId, 'room1');
    eq(fresh.requests.length, 1, '새 1:1 요청');
    eq(fresh.requests[0].note, '같이 쳐요');
    eq(fresh.total, 2);
    /* 그 뒤로는 새 것이 없다 */
    eq(D.newIncoming(idx, 'me', '2026-11-20 23:59:59').total, 0, '기준 이후 없음');
    /* 로그인 전에는 아무것도 */
    eq(D.newIncoming(idx, '', '').total, 0, '내 키 없음');
  });

  test('v1.20 새 소식: 참여하지 않은 단체방·이미 처리한 요청은 알리지 않는다', function () {
    var post = D.toRow({ id: 'p1', type: '소셜', createdAt: '2026-11-20 09:00:00', userKey: 'u_c', nick: '씨', text: '토요일 모집' });
    var groupMsg = chatRow({ id: 'g1', at: '2026-11-20 10:10:00', userKey: 'u_c', team: 'p1', nick: '씨', text: '한 분 더 모셔요' });
    var done = D.toRow({ id: 'r2', type: '매칭신청', createdAt: '2026-11-20 10:11:00', userKey: 'u_d', target: 'me', nick: '디', status: '수락' });
    var idx = D.index([post, groupMsg, done].map(D.fromRow));
    eq(D.newIncoming(idx, 'me', '2026-11-20 10:00:00').total, 0, '참여 안 한 단체방·처리한 요청 제외');
    /* 방에 들어간(읽음 표시를 남긴) 뒤에는 알린다 */
    var read = D.toRow({ id: 'rd1', type: '채팅읽음', createdAt: '2026-11-20 09:30:00', userKey: 'me', team: 'p1' });
    var idx2 = D.index([post, groupMsg, done, read].map(D.fromRow));
    var fresh = D.newIncoming(idx2, 'me', '2026-11-20 10:00:00');
    eq(fresh.messages.length, 1, '참여한 단체방 메시지');
    eq(fresh.messages[0].group, true, '단체방 표시');
  });

  test('v1.20 새 소식: 처음 열 때는 조용하고, 폴링에서 새 메시지를 알린다', function () {
    if (!hasNode()) return;
    return withStorage(function () {
      var rowsRef = { rows: BM.fixtures.demo() };
      var api = {
        mode: 'sheets',
        bootstrap: function () { return Promise.resolve({ me: { key: ME, nick: '나래', level: 'C조' }, rows: rowsRef.rows.slice(), syncedAt: U.stamp() }); },
        append: function () { return Promise.resolve({ ok: true }); },
        update: function () { return Promise.resolve({ ok: true }); },
        remove: function () { return Promise.resolve({ ok: true }); },
        purgeSamples: function () { return Promise.resolve({ ok: true }); }
      };
      var store = BM.store.createStore({ api: api });
      return store.actions.init().then(function () {
        eq(store.state.inbox.total, 0, '처음에는 지난 메시지를 알리지 않는다');
        /* 30초쯤 지난 뒤 다른 기기에서 온 새 메시지처럼 */
        store.state.notifySince = U.stamp(new Date(Date.now() - 30000));
        rowsRef.rows.push(D.toRow({
          id: 'live1', type: '매칭채팅', createdAt: U.stamp(),
          userKey: 'demo_net', target: ME, team: 'room-live', nick: '네트앞여우', text: '새 메시지!'
        }));
        return store.actions.poll();
      }).then(function (res) {
        ok(res && res.ok, '폴링 성공');
        eq(res.fresh.total, 1, '새 메시지 1건');
        eq(store.state.inbox.total, 1, '받은 소식에 담김');
        eq(store.state.inbox.messages[0].text, '새 메시지!');
        eq(store.state.inbox.messages[0].nick, '네트앞여우');
        return store.actions.poll();
      }).then(function (res2) {
        eq(res2.fresh.total, 0, '같은 메시지를 두 번 알리지 않는다');
        store.actions.dismissInbox();
        eq(store.state.inbox.total, 0, '닫으면 비워진다');
      });
    });
  });

  /* =========================================================
   * 4) 알림 · 편지지 설정
   * ========================================================= */
  test('v1.20 설정: 알림·편지지는 기본으로 켜지고, 끄면 기기에 저장된다', function () {
    return withStorage(function () {
      U.storage.removeItem(D.PREFS_KEY);
      var def = D.readPrefs();
      eq(def.notify, true, '알림 기본 켜짐');
      eq(def.letter, true, '편지지 기본 켜짐');
      eq(D.normalizePrefs({ notify: false }).letter, true, '하나만 꺼도 다른 하나는 그대로');
      eq(D.normalizePrefs({ letter: 'no' }).letter, true, '깨진 값은 켜짐');
      D.setPref(null, 'notify', false);
      eq(D.readPrefs().notify, false, '끄면 저장');
      D.setPref(null, 'notify', true);
      eq(D.readPrefs().notify, true, '다시 켜면 저장');
      var panel = BM.views.my.alarmPanel(stateOf());
      includes(panel, 'data-act="toggle-notify"', 'MY 알림 스위치');
      includes(panel, 'data-act="toggle-letter"', 'MY 편지지 스위치');
      includes(panel, 'aria-checked="true"', '켜짐 상태 표시');
      includes(BM.views.chat.listHtml(stateOf()), 'data-dm-notify', '채팅 상단 알림 종');
    });
  });

  test('v1.20 설정: 끄면 채팅 알림 종도 꺼진 상태로 보인다', function () {
    var state = stateOf(null, { notify: false });
    var html = BM.views.chat.listHtml(state);
    includes(html, 'aria-pressed="false"', '알림 꺼짐');
    includes(html, 'is-off', '종 아이콘 흐리게');
    includes(html, '새 메시지 알림 켜기', '켜기 안내');
  });

  test('v1.20 편지지: 요청은 편지지 미리보기를 거치고, 끄면 바로 보낸다', function () {
    var on = stateOf(null, { letter: true });
    var p = on.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_foot'; })[0];
    var body = BM.views.matching.profileBody(on, p);
    includes(body, 'data-send-request="demo_foot"', '요청 버튼은 그대로');
    includes(body, '한마디 남기기', '한마디 입력');
    includes(body, '편지지를 미리 보고', '편지지 안내');
    includes(body, '요청 보내기', '버튼 이름 그대로');

    var off = stateOf(null, { letter: false });
    var p2 = off.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_foot'; })[0];
    var body2 = BM.views.matching.profileBody(off, p2);
    includes(body2, '바로 전송돼요', '끄면 즉시 전송 안내');
    excludes(body2, '편지를 미리 보고', '편지지 안내 없음');

    /* 봉투 미리보기 시트 */
    var env = BM.views.matching.letterComposeBody(on, p, '토요일 오전 어떠세요?');
    includes(env, 'class="env"', '봉투 모양');
    includes(env, 'env__note', '한마디 미리보기');
    includes(env, '토요일 오전 어떠세요?', '적은 한마디');
    includes(env, 'data-letter-send="demo_foot"', '편지 보내기');
    includes(env, 'data-letter-off="demo_foot"', '편지지 끄고 바로 보내기');
    includes(env, '수락 시 보낸 분의 하트 2개 차감', '하트 규칙 유지');
  });

  test('v1.20 편지지: 받은 요청도 설정에 따라 편지지/일반 카드로 보인다', function () {
    var on = stateOf(null, { letter: true });
    var letters = BM.views.matching.render(on);
    includes(letters, 'class="letter', '편지지 카드');
    includes(letters, '받은 요청', '받은 요청 탭');
    var chatOn = BM.views.chat.listHtml(on);
    includes(chatOn, 'class="letter', '채팅 목록도 편지지');

    var off = stateOf(null, { letter: false });
    var simple = BM.views.matching.render(off);
    includes(simple, 'rq--simple', '일반 요청 카드');
    excludes(simple, 'class="letter', '편지지 카드 없음');
    includes(simple, 'data-accept', '수락 버튼');
    includes(simple, 'data-decline', '거절 버튼');
    var chatOff = BM.views.chat.listHtml(off);
    includes(chatOff, 'dmreq--simple', '채팅 목록도 일반 카드');
    excludes(chatOff, 'data-open-letter', '편지지 열기 없음');
    /* 설정을 바꾸면 받은 요청 영역도 다시 그려지도록 키에 설정을 넣는다 */
    includes(readRoot('js/views/matching.js'), "state.prefs.letter === false ? 'simple' : 'letter'", '요청 목록 다시 그리기 키');
  });

  /* =========================================================
   * 5) 내 활동 시각 · 26칸 유지
   * ========================================================= */
  test('v1.20 활동 시각: 매칭프로필 JSON에만 남기고 26칸은 그대로', function () {
    if (!hasNode()) return;
    return withStorage(function () {
      var rowsRef = { rows: BM.fixtures.demo() };
      var api = {
        mode: 'sheets',
        bootstrap: function () { return Promise.resolve({ me: { key: ME, nick: '나래', level: 'C조' }, rows: rowsRef.rows.slice(), syncedAt: U.stamp() }); },
        append: function () { return Promise.resolve({ ok: true }); },
        update: function () { return Promise.resolve({ ok: true }); },
        remove: function () { return Promise.resolve({ ok: true }); }
      };
      var store = BM.store.createStore({ api: api });
      return store.actions.init().then(function () {
        var r = store.actions.touchActivity({ force: true });
        eq(r.ok, true, '활동 시각 기록');
        eq(r.mode, 'sheets', '시트 모드');
        var mine = store.state.data.matchProfiles.filter(function (m) { return m.userKey === ME; })[0];
        ok(mine && mine.rowId, '내 매칭프로필 행');
        var raw = store.state.idx.byId[mine.rowId];
        ok(raw.payload && raw.payload.lastActiveAt, 'payload.lastActiveAt');
        eq(raw.payload.level, 'C조', '기존 프로필 값 유지');
        eq(store.state.rows.filter(function (row) { return row[0] === mine.rowId; })[0].length, D.COLS.length, '26칸 그대로');
        eq(D.COLS.length, 26, '스키마 26칸');
        ok(D.lastActiveAt(store.state.idx, ME) >= raw.payload.lastActiveAt, '내 활동 시각으로 읽힌다');
        var again = store.actions.touchActivity();
        eq(again.mode, 'throttled', '3분 안에는 다시 쓰지 않는다');
      });
    });
  });

  /* =========================================================
   * 6) 화면 골격 · 버전
   * ========================================================= */
  test('v1.20 골격: 알림 배너·폴링·브라우저 알림이 붙어 있다', function () {
    if (!hasNode()) return;
    var index = readRoot('index.html');
    includes(index, 'id="notifbar"', '알림 배너 자리');
    includes(index, 'styles.css?v=20261123-5', '스타일 캐시');
    var app = readRoot('app.js');
    includes(app, 'setInterval', '폴링');
    includes(app, 'Notification', '브라우저 알림');
    includes(app, 'navigator', '알림 API 사용');
    includes(app, 'touchActivity', '활동 시각 갱신');
    includes(app, 'paintNotify', '배너 그리기');
    includes(app, 'notifyClosedSig', '닫은 배너는 다시 띄우지 않는다');
    var store = readRoot('js/store.js');
    includes(store, 'poll: function', 'store 폴링');
    includes(store, 'touchActivity: function', 'store 활동 시각');
    var css = readRoot('styles.css');
    includes(css, '.presence--on', '활동 중 스타일');
    includes(css, '.notifbar', '배너 스타일');
    includes(css, '.dmsgday', '날짜 구분선 스타일');
    includes(css, '.env__note', '편지지 스타일');
  });

  test('v1.20 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.61.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.61.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261123-5', '스타일 캐시 키');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.61.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.61.0', 'TWA appVersion');
    eq(twa.appVersionCode, 55, 'TWA 버전 코드');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
