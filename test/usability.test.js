/* ============================================================
 * test/usability.test.js — 조환비 측 앱 사용성 점검 5건 (v1.9.9)
 *  1) 일지 & AI: 고른 점수제(21·25)가 이번 주 루틴에 그대로 나온다
 *  2) 일지 & AI: 분석 카드는 요약·드릴 핵심만 펴고 상세는 접어 둔다
 *  3) 매칭: 하트 소모 안내가 카드·프로필 상단(스크롤 전)에 보인다
 *  4) 코치: 승인된 코치 카드에서 피드백 요청 / 1:1 채팅으로 이어진다
 *  5) 커뮤니티: 말머리(주제)를 골라 쓰고, 칩으로 걸러 본다 (+ 일지 공유는 자동 '일지')
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain, AI = BM.ai;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  /* ---------- 도우미 ---------- */
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(opts) {
    clearStorage();
    if (!(opts && opts.empty)) {
      var rows = BM.fixtures.demo();
      ((opts && opts.extra) || []).forEach(function (e) { rows.push(D.toRow(e)); });
      U.writeJSON('bm_rows_v1', rows);
    }
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(rows, meKey) {
    rows = rows || BM.fixtures.demo();
    meKey = meKey || BM.seed.ME;
    return {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, meKey),
      drafts: {
        log: {
          date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: ['스트록', '게임'],
          score: { a: 21, b: 18 }, result: '승', pain: [], weakness: ['드라이브'], note: ''
        }
      },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: 'feedback', coachPlayer: null,
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function checkHtml(html, label) {
    ok(html && html.length > 50, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'ol', 'li', 'button', 'header', 'footer', 'article', 'form', 'dl', 'p', 'details', 'summary'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  function weekRow(an, day) {
    return (an.week || []).filter(function (w) { return w.day === day; })[0] || {};
  }

  /* ================= 1. 일지 & AI — 점수제 연동 ================= */
  test('AI 점수제: 25점제로 저장하면 이번 주 루틴도 25점제를 권한다', function () {
    var an = AI.analyze({
      draft: { gameMode: 25, games: [{ a: 25, b: 23 }, { a: 21, b: 19 }], weakness: ['풋워크'] },
      records: [], level: 'B조', nick: '나래'
    });
    var real = weekRow(an, '3회차');
    includes(real.menu, '25점제', '25점제 실전');
    excludes(real.menu, '21점제', '21점제로 고정되지 않음');
    eq(an.gameMode, 25, '분석 결과에 점수제');
  });

  test('AI 점수제: 21점제는 21점제로 나온다', function () {
    var an = AI.analyze({ draft: { gameMode: 21, weakness: ['리시브'] }, records: [], level: 'C조' });
    includes(weekRow(an, '3회차').menu, '21점제', '21점제 실전');
    eq(an.gameMode, 21, '기본 21점제');
  });

  test('AI 점수제: 일지에 고른 값이 없으면 최근 기록의 점수제를 잇는다', function () {
    var rec25 = {
      id: 'r25', type: '기록', date: U.ymd(), createdAt: U.stamp(),
      cond: 6, intensity: 6, minutes: 60, games: [{ a: 25, b: 23, mode: 25 }, { a: 19, b: 25, mode: 25 }],
      result: '무', pain: [], weakness: [], level: 'B조', userKey: BM.seed.ME
    };
    var an = AI.analyze({ draft: { cond: 6, intensity: 6, minutes: 60 }, records: [rec25], level: 'B조' });
    eq(an.gameMode, 25, '최근 25점제 기록을 따름');
    includes(weekRow(an, '3회차').menu, '25점제', '루틴도 25점제');
  });

  test('AI 점수제: 기록도 없으면 21점제 기본값', function () {
    eq(AI.scoreModeOf({}, []), 21, '기본값');
    eq(AI.scoreModeOf({ gameMode: 25 }, []), 25, '고른 값 우선');
    eq(AI.scoreModeOf({ gameMode: '25' }, []), 25, '문자도 읽음');
  });

  /* ================= 2. 일지 & AI — 카드 길이 ================= */
  test('화면: 분석 카드는 요약·드릴 핵심을 먼저, 상세는 접어 둔다', function () {
    var state = stateOf();
    state.drafts.log.games = [{ a: 21, b: 18 }, { a: 19, b: 21 }, { a: 21, b: 19 }];
    /* 부하 점검(4주 평균)과 경기 흐름이 함께 나오도록 지난 4주 기록을 둡니다 */
    var history = [8, 11, 15, 19, 22, 26].map(function (d) {
      return {
        id: 'h' + d, type: '기록', date: U.ymd(U.addDays(new Date(), -d)), createdAt: U.stamp(),
        cond: 6, intensity: 5, minutes: 60, done: ['스트록'], score: { a: 21, b: 18 }, result: '승',
        pain: [], weakness: [], level: 'C조', userKey: BM.seed.ME
      };
    });
    state.data.records = history;
    state.analysis = AI.analyze({
      draft: state.drafts.log, records: history, level: 'C조', nick: '나래', discipline: '복식'
    });
    var html = BM.views.log.render(state);
    checkHtml(html, '분석 카드');
    /* 요약: 점수 링 · 총평 · 한 줄 지표 · 드릴 */
    includes(html, 'ai-top', '점수·총평');
    includes(html, 'ai-metric', '한 줄 지표 칩');
    includes(html, 'drills drills--core', '드릴 핵심 목록');
    includes(html, '추천 드릴', '드릴 제목');
    /* 상세는 기본 닫힘 */
    ok(/<details class="fold fold--ai" data-fold="ai-detail">/.test(html), '자세히 보기 접기(기본 닫힘)');
    ok(/<details class="fold fold--ai" data-fold="week">/.test(html), '이번 주 루틴 접기(기본 닫힘)');
    ok(/<details class="fold fold--ai" data-fold="care">/.test(html), '맞춤 처방 접기(기본 닫힘)');
    excludes(html, 'data-fold="ai-detail" open', '상세는 펼치지 않음');
    /* 순서: 요약 → 드릴 → 상세 → 루틴 */
    ok(html.indexOf('ai-top') < html.indexOf('drills drills--core'), '총평이 드릴보다 위');
    ok(html.indexOf('drills drills--core') < html.indexOf('data-fold="ai-detail"'), '드릴이 상세보다 위');
    ok(html.indexOf('data-fold="ai-detail"') < html.indexOf('data-fold="week"'), '상세가 루틴보다 위');
    /* 접힌 곳에 들어간 내용은 그대로 있다 */
    includes(html, '경기 흐름', '경기 흐름은 상세 안에');
    includes(html, '부하 점검', '부하 점검은 상세 안에');
    includes(html, '드릴 포인트', '드릴 포인트는 상세 안에');
  });

  /* ================= 3. 매칭 — 하트 소모 안내 ================= */
  test('화면: 매칭 카드에 하트 소모가 요청 버튼 옆에 먼저 보인다', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    checkHtml(html, '매칭 목록');
    includes(html, 'pcard__cost', '카드의 하트 안내');
    includes(html, '수락 시 하트 2개 차감', '수락할 때 차감되는 비용');
    ok(html.indexOf('pcard__cost') < html.indexOf('프로필 보고 요청하기'), '버튼보다 먼저 읽힘');
  });

  test('화면: 프로필 시트 상단에 하트 소모가 보인다 (요청 버튼까지 스크롤 불필요)', function () {
    var state = stateOf();
    var target = state.data.matchProfiles.filter(function (p) { return p.userKey !== BM.seed.ME; })[0];
    var body = BM.views.matching.profileBody(state, target);
    checkHtml(body, '프로필 시트');
    includes(body, 'pp__cost pp__cost--top', '상단 하트 안내');
    includes(body, '매칭 요청 · <b>수락 시 하트 2개 차감</b>', '수락 시 차감 문구');
    ok(body.indexOf('pp__cost pp__cost--top') < body.indexOf('pp__spec'), '스펙 표보다 위');
    ok(body.indexOf('pp__cost pp__cost--top') < body.indexOf('data-send-request'), '요청 버튼보다 위');
  });

  test('화면: 이미 친구·수락된 상대에게는 하트 안내를 띄우지 않는다', function () {
    var state = stateOf();
    var friend = state.data.matchProfiles.filter(function (p) { return p.userKey === 'demo_net'; })[0];
    var body = BM.views.matching.profileBody(state, friend);
    excludes(body, 'pp__cost--top', '요청할 수 없는 상대에는 비용 안내 없음');
  });

  /* ================= 4. 코치 — 피드백 요청 / 1:1 채팅 ================= */
  test('화면: 승인된 코치 카드에 피드백 요청·1:1 채팅 버튼이 있다', function () {
    var state = stateOf();
    var html = BM.views.coach.render(state);
    checkHtml(html, '코치 화면');
    includes(html, 'coachcard', '코치 카드');
    includes(html, 'data-coach-ask="demo_net"', '피드백 요청');
    includes(html, 'data-coach-chat="demo_net"', '1:1 채팅');
    includes(html, '네트앞여우', '승인된 코치 이름');
    excludes(html, 'data-coach-ask="demo_bear"', '심사중인 신청은 코치 목록에 없음');
  });

  test('코치 대화: 승인된 코치와는 1:1 대화가 열리고, 일반 회원은 그대로 막힌다', function () {
    /* 매칭·친구가 아닌 승인 코치를 하나 둡니다 (코치 대화는 승인 여부만 봅니다) */
    var rows = BM.fixtures.demo();
    rows.push(D.toRow({
      id: 'mentor_chi', type: '멘토신청', createdAt: U.stamp(), nick: '콕집사', userKey: 'demo_chi',
      target: D.ADMIN_TARGET,
      payload: { status: '승인', type: '동호인 멘토', experience: '5년', awards: '', reason: '기본기 봐드려요', submitted: U.stamp() }
    }));
    var state = stateOf(rows);
    var room = D.coachRoomId(BM.seed.ME, 'demo_chi');
    eq(room, D.coachRoomId('demo_chi', BM.seed.ME), '두 사람이 같은 방 ID');
    ok(room.indexOf('coach_') === 0, '코치 방 접두어');
    eq(D.canChatWith(state.data.idx, BM.seed.ME, 'demo_chi'), true, '선수 → 승인 코치');
    eq(D.canChatWith(state.data.idx, BM.seed.ME, 'demo_suttle'), false, '일반 회원에게는 그대로 잠금');
    eq(D.canChatWith(state.data.idx, 'demo_chi', BM.seed.ME), false, '코치가 먼저 말 걸지는 않음(대화 전)');
    var html = BM.views.coach.render(state);
    includes(html, 'data-coach-ask="demo_chi"', '승인 코치 카드');
  });

  test('코치 대화: 요청 문구를 채운 채로 열리고, 보내면 코치 대화방이 생긴다', function () {
    return freshStore({ extra: [{
      id: 'mentor_chi', type: '멘토신청', createdAt: U.stamp(), nick: '콕집사', userKey: 'demo_chi',
      target: D.ADMIN_TARGET,
      payload: { status: '승인', type: '동호인 멘토', experience: '5년', reason: '기본기 봐드려요', submitted: U.stamp() }
    }] }).then(function (store) {
      var room = D.coachRoomId(BM.seed.ME, 'demo_chi');
      var r = store.actions.openCoachChat('demo_chi', '코치님, 일지 피드백 부탁드려요.');
      ok(r.ok, '대화 열기');
      eq(store.state.ui.chatOpen, true, 'DM 패널');
      eq(store.state.ui.chatRoom, room, '코치 방');
      eq(store.state.ui.chatOther, 'demo_chi', '상대');
      includes(store.state.ui.chatDraft, '피드백 부탁드려요', '요청 문구 미리 채움');

      /* 화면: 채워진 입력창 + 보낼 수 있는 상태 */
      var html = BM.views.chat.roomHtml(store.state);
      includes(html, 'data-dm-input', '입력창');
      includes(html, '피드백 부탁드려요', '미리 채운 문구');
      includes(html, 'data-dm-form', '보내기 가능(잠금 아님)');

      var sent = store.actions.sendChat(room, 'demo_chi', store.state.ui.chatDraft);
      ok(sent.ok, '메시지 전송');
      eq(store.state.ui.chatDraft, '', '보낸 뒤 미리 채운 문구는 비움');
      var thread = D.threadById(store.state.idx, BM.seed.ME, room);
      ok(thread, '대화 목록에 코치 방');
      eq(thread.kind, 'coach', '코치 대화방 표시');
      eq(thread.unread, 0, '내가 보낸 메시지는 안 읽음 아님');

      /* 코치는 시작된 방에서만 답장할 수 있다 → 방이 생겼으니 이제 가능 */
      eq(D.canChatWith(store.state.idx, 'demo_chi', BM.seed.ME), true, '코치 답장 가능');
      return store.flush();
    });
  });

  test('코치 대화: 이미 매칭·친구인 코치면 그 대화방을 그대로 쓴다', function () {
    return freshStore().then(function (store) {
      var room = D.coachRoomId(BM.seed.ME, 'demo_net');
      eq(store.state.data.threads.filter(function (t) { return t.roomId === room; }).length, 0, '코치 방은 아직 없음');
      var match = store.state.data.threads.filter(function (t) { return t.other === 'demo_net'; })[0];
      ok(match && match.kind === 'match', '매칭 대화방이 있음');
      var r = store.actions.openCoachChat('demo_net', '코치님, 피드백 부탁드려요.');
      ok(r.ok, '대화 열기');
      eq(store.state.ui.chatRoom, match.roomId, '새 방을 만들지 않고 매칭 방 재사용');
      eq(store.state.ui.chatDraft, '코치님, 피드백 부탁드려요.', '요청 문구는 그대로 채움');
    });
  });

  /* ================= 5. 커뮤니티 — 말머리 ================= */
  test('커뮤니티: 작성할 때 말머리를 고르고, 상단 칩으로 걸러 본다', function () {
    var state = stateOf();
    var html = BM.views.community.render(state);
    checkHtml(html, '커뮤니티');
    D.POST_TOPICS.forEach(function (topic) {
      includes(html, 'data-topic="' + topic + '"', '작성 말머리: ' + topic);
      includes(html, 'data-topicfilter="' + topic + '"', '거르기 칩: ' + topic);
    });
    includes(html, 'data-topicfilter="전체"', '전체 필터');
    includes(html, 'post__topic', '글마다 말머리 표시');

    eq(BM.views.community._setTopicFilter('전체'), '전체', '전체');
    eq(BM.views.community._visiblePosts(state).length, state.data.posts.length, '전체 글');

    BM.views.community._setTopicFilter('번개');
    eq(BM.views.community._visiblePosts(state).length, 0, '번개 글은 아직 없음');
    var empty = BM.views.community.render(state);
    includes(empty, '번개', '빈 말머리 안내');
    includes(empty, 'data-topicall', '전체로 돌아가기');
    BM.views.community._setTopicFilter('전체');
  });

  test('커뮤니티: 고른 말머리가 글로 저장되고(시트 칸 그대로) 목록에 남는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('후기');
      var res = store.actions.createPost('오늘 클럽 정기전 후기', store.state.ui.composerTopic);
      ok(res.ok, '글 저장');
      eq(res.topic, '후기', '저장된 말머리');
      var post = store.state.data.posts[0];
      eq(post.topic, '후기', '목록의 말머리');
      eq(store.state.ui.composerTopic, '자유', '올린 뒤 말머리는 자유로');
      var row = store.state.rows[0];
      includes(row[D.COL['훈련계획']], '후기', '시트 훈련계획 칸에 JSON');
      eq(D.topicOf({ plan: { topic: '이상한값' } }), '자유', '모르는 값은 자유');
      eq(D.normalizeTopic(''), '자유', '빈 값은 자유');
      return store.flush();
    });
  });

  test('커뮤니티: 일지 원탭 공유 글에는 자동으로 일지 말머리가 붙는다', function () {
    return freshStore().then(function (store) {
      store.actions.setDraft({ cond: 6, intensity: 6, minutes: 60, done: ['스트록'] });
      var saved = store.actions.saveLog();
      ok(saved.ok, '일지 저장');
      var shared = store.actions.shareLogToCommunity(saved.entity.id);
      ok(shared.ok, '커뮤니티 공유');
      var post = store.state.data.posts.filter(function (p) { return String(p.target) === String(saved.entity.id); })[0];
      ok(post, '공유 글');
      eq(post.topic, '일지', '자동 일지 말머리');

      /* 말머리가 없는 예전 공유 글도 일지로 읽는다 */
      var old = D.toRow({ id: 'oldpost', type: '소셜', createdAt: U.stamp(), date: U.ymd(), text: '옛 공유', target: 'old-log', userKey: BM.seed.ME });
      eq(D.topicOf(D.fromRow(old)), '일지', '예전 공유 글 호환');
      var plain = D.toRow({ id: 'plain', type: '소셜', createdAt: U.stamp(), date: U.ymd(), text: '그냥 글', userKey: BM.seed.ME });
      eq(D.topicOf(D.fromRow(plain)), '자유', '말머리 없는 일반 글');
      return store.flush();
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
