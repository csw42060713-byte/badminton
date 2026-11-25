/* ============================================================
 * test/v129.test.js — bm-v1.37.2
 *   고도화 1차 사이클(ideas.md 2순위) 두 가지를 검증합니다.
 *
 *   1) 매칭·모집 후 매너 한 줄 태그
 *      · 정해진 4종만 (시간 약속 정확 · 배려 넘침 · 실력이 비슷해요 · 매너 굿), 자유 입력 없음
 *      · 같은 상대에게 하루 1회 (유형=매너 · 대상=상대 키 · 팀=태그 코드 · 좋아요=1)
 *      · 받은 태그는 domain.mannerReceived 로만 집계해 프로필 시트에 최대 3개 + 건수
 *
 *   2) 커뮤니티 모집 글 정원 자동 마감 & 참여자 명단
 *      · 참여자 = 글쓴이 + 단체방에 한마디 남긴 사람 (새 행 없이 계산)
 *      · 정원(meet.cap, 예전 이름 meet.max)에 도달하면 '마감' 배지 + 버튼 '대기 문의'
 *      · 글쓴이에게 '참여자 N명' 요약 + 명단 보기
 *
 *   실행: node test/run.js
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

  function freshStore(opts) {
    clearStorage();
    if (!(opts && opts.empty)) U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: { key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night', avatar: '🦋' } },
      rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '', pain: [], weakness: [], note: '' } },
      ui: {
        tab: 'community', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
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
    ok(html && html.length > 30, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'article', 'form', 'p', 'span'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  /* 매너 한 줄 — 화면에서 쓰는 모양 그대로 */
  function mannerRow(plan) {
    return D.toRow({
      id: plan.id || U.uid(), type: D.MANNER_TYPE, createdAt: plan.at || U.stamp(), date: plan.date || U.ymd(),
      nick: plan.nick || '', userKey: plan.from, target: plan.to, team: plan.code, likes: 1
    });
  }

  /* 모집 글 + 단체방 대화 */
  function meetRow(plan, userKey, id) {
    return D.toRow({
      id: id || 'bolt-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: plan.nick || '번개장터', text: plan.text || '이번 주 금요일 저녁에 번개 치실 분!',
      userKey: userKey || 'demo_chi', plan: plan
    });
  }

  function groupMsgRow(postId, key, nick, text) {
    return D.toRow({
      id: U.uid(), type: '매칭채팅', createdAt: U.stamp(), date: U.ymd(),
      nick: nick, userKey: key, target: '', team: String(postId), text: text
    });
  }

  function matchRoomState(rows) {
    var st = stateOf(rows);
    var th = st.data.threads.filter(function (x) { return x.kind === 'match' && x.other === 'demo_net'; })[0];
    if (th) { st.ui.chatRoom = th.roomId; st.ui.chatOther = 'demo_net'; }
    return st;
  }

  /* =========================================================
   * 1. 매너 태그 — 정해진 네 가지
   * ========================================================= */
  test('v1.29 매너: 정해진 4종만 있고 자유 입력이 없다', function () {
    eq(D.MANNER_TYPE, '매너', '행 유형');
    eq(D.MANNER_TAGS.length, 4, '태그 수');
    eq(D.MANNER_TAGS.map(function (x) { return x.label; }).join('|'),
      '시간 약속 정확|배려 넘침|실력이 비슷해요|매너 굿', '태그 문구·순서');
    eq(D.MANNER_TAGS.map(function (x) { return x.code; }).join('|'), 'time|care|similar|good', '코드');
    eq(D.mannerTag('care').label, '배려 넘침', '코드 → 문구');
    eq(D.mannerTag('직접 쓴 태그'), null, '없는 코드는 null');
    eq(D.mannerTag(''), null, '빈 코드');
    eq(D.mannerLabel('good'), '매너 굿', '문구 조회');
    eq(D.mannerLabel('nope'), '', '모르는 코드는 빈 문구');
    eq(D.MANNER_MAX_BADGES, 3, '프로필에는 최대 3개');
  });

  test('v1.29 매너: 받은 태그를 태그별로 세고 많이 받은 순으로 준다', function () {
    var rows = [
      mannerRow({ from: 'demo_chi', to: 'demo_net', code: 'care', at: '2026-11-20 21:00:00' }),
      mannerRow({ from: 'demo_foot', to: 'demo_net', code: 'care', at: '2026-11-20 22:00:00' }),
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'time', at: '2026-11-19 20:00:00' }),
      mannerRow({ from: 'demo_foot', to: 'demo_net', code: '해킹', at: '2026-11-20 23:00:00' }),
      mannerRow({ from: 'demo_chi', to: 'demo_koala', code: 'good', at: '2026-11-20 23:00:00' })
    ];
    var idx = D.index(rows.map(D.fromRow));
    var sum = D.mannerReceived(idx, 'demo_net', 3);
    eq(sum.total, 3, '정해진 4종만 셉니다(모르는 코드 제외)');
    eq(sum.givers, 3, '준 사람 수');
    eq(sum.tags.length, 2, '받은 태그 종류');
    eq(sum.tags[0].label, '배려 넘침', '가장 많이 받은 태그');
    eq(sum.tags[0].count, 2, '건수');
    eq(sum.tags[0].givers, 2, '이 태그를 준 사람 수');
    eq(sum.tags[1].label, '시간 약속 정확', '두 번째');
    eq(D.mannerReceived(idx, 'demo_net', 1).tags.length, 1, '최대 개수 제한');
    eq(D.mannerReceived(idx, 'demo_koala').total, 1, '다른 사람 집계는 따로');
    eq(D.mannerReceived(idx, 'demo_suttle').total, 0, '받은 게 없으면 0');
    eq(D.mannerReceived(D.index([]), 'demo_net').total, 0, '빈 저장소 안전');
    eq(D.mannerReceived(null, 'demo_net').total, 0, 'idx 없음 안전');
  });

  test('v1.29 매너: 같은 상대에게 하루 1회만', function () {
    var today = U.ymd();
    var yday = U.ymd(U.addDays(new Date(), -1));
    var one = D.index([
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'good', at: today + ' 21:00:00', date: today })
    ].map(D.fromRow));
    eq(D.mannerGivenToday(one, BM.seed.ME, 'demo_net'), true, '오늘 남김');
    eq(D.mannerGivenToday(one, BM.seed.ME, 'demo_chi'), false, '다른 상대는 아직');
    eq(D.mannerToday(one, BM.seed.ME, 'demo_net').label, '매너 굿', '오늘 남긴 태그');
    eq(D.mannerToday(one, BM.seed.ME, 'demo_chi'), null, '안 남겼으면 null');

    var old = D.index([
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'good', at: yday + ' 21:00:00', date: yday })
    ].map(D.fromRow));
    eq(D.mannerGivenToday(old, BM.seed.ME, 'demo_net'), false, '어제 남긴 건 오늘 제한에 안 걸림');
    eq(D.mannerGivenToday(old, BM.seed.ME, 'demo_net', U.parseYmd(yday).getTime() + 3600000), true, '그날 기준으로는 남김');
  });

  /* =========================================================
   * 2. 매너 태그 — 저장(하루 1회 · 26칸 호환)
   * ========================================================= */
  test('v1.29 매너 저장: 26칸 그대로, 상대 키·태그 코드가 들어간다', function () {
    return freshStore().then(function (store) {
      var res = store.actions.giveManner('demo_net', 'care');
      ok(res.ok, '태그 남기기');
      eq(res.code, 'care', '코드');
      eq(res.label, '배려 넘침', '문구');

      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸 그대로');
      eq(row[D.COL['유형']], '매너', '유형=매너');
      eq(row[D.COL['대상']], 'demo_net', '대상=상대 키');
      eq(row[D.COL['팀']], 'care', '팀=태그 코드');
      eq(row[D.COL['좋아요']], '1', '좋아요=1');
      eq(row[D.COL['사용자ID']], BM.seed.ME, '보낸 사람');
      eq(row[D.COL['날짜']], U.ymd(), '날짜');

      /* 읽어도 그대로 (다른 기기·시트에서 다시 읽는 경우) */
      var back = D.fromRow(row);
      eq(back.type, '매너', '다시 읽은 유형');
      eq(D.mannerLabel(back.team), '배려 넘침', '다시 읽은 태그');
      eq(D.mannerReceived(store.state.data.idx, 'demo_net').total, 1, '받은 쪽 집계에 바로 반영');
      return store.flush();
    });
  });

  test('v1.29 매너 저장: 같은 상대에게 두 번은 안 된다(하루 1회)', function () {
    return freshStore().then(function (store) {
      ok(store.actions.giveManner('demo_net', 'time').ok, '첫 번째');
      store.state.locks = {};
      var again = store.actions.giveManner('demo_net', 'good');
      eq(again.ok, false, '두 번째는 막힘');
      eq(again.reason, 'daily', '이유: 하루 1회');
      eq(again.label, '시간 약속 정확', '이미 남긴 태그를 알려 줌');
      eq(store.state.rows.filter(function (r) { return r[D.COL['유형']] === '매너'; }).length, 1, '행은 하나뿐');
      return store.flush();
    });
  });

  test('v1.29 매너 저장: 다음 날이면 다시 남길 수 있다', function () {
    return freshStore().then(function (store) {
      ok(store.actions.giveManner('demo_net', 'time').ok, '첫 번째');
      /* 기기에 남은 행의 날짜만 어제로 (하루 지난 상황) */
      var yday = U.ymd(U.addDays(new Date(), -1));
      store.state.rows.forEach(function (r) {
        if (r[D.COL['유형']] === '매너') {
          r[D.COL['날짜']] = yday;
          r[D.COL['작성일시']] = yday + ' 21:00:00';
        }
      });
      store.state.idx = D.index(store.state.rows.map(function (r) { return D.fromRow(r); }));
      store.state.locks = {};
      var next = store.actions.giveManner('demo_net', 'similar');
      ok(next.ok, '다음 날은 다시');
      eq(next.code, 'similar', '새 태그');
      eq(D.mannerReceived(store.state.idx, 'demo_net').total, 2, '두 건 모두 남음');
      return store.flush();
    });
  });

  test('v1.29 매너 저장: 자기 자신·없는 코드·모르는 사람은 막는다', function () {
    return freshStore().then(function (store) {
      eq(store.actions.giveManner(BM.seed.ME, 'good').reason, 'no_target', '나에게는 못 남김');
      store.state.locks = {};
      eq(store.actions.giveManner('demo_net', '직접 쓴 태그').reason, 'unknown', '정해진 4종만');
      store.state.locks = {};
      eq(store.actions.giveManner('demo_koala', 'good').reason, 'not_allowed', '친구·매칭 아닌 사람에게는 못 남김');
      eq(store.state.rows.filter(function (r) { return r[D.COL['유형']] === '매너'; }).length, 0, '행이 생기지 않음');
      return store.flush();
    });
  });

  test('v1.29 매너 저장: 로그인 전에는 남길 수 없다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.me = null;
      eq(store.actions.giveManner('demo_net', 'good').reason, 'no_login', '로그인 필요');
      return store.flush();
    });
  });

  /* =========================================================
   * 3. 매너 태그 — 대화방 상단 · 프로필 시트
   * ========================================================= */
  test('v1.29 화면: 매칭 대화방 상단에 매너 태그 4칩이 있다', function () {
    var st = matchRoomState();
    ok(st.ui.chatRoom, '매칭 대화방을 찾음');
    var html = BM.views.chat.roomHtml(st);
    checkHtml(html, '매칭 대화방');
    includes(html, 'class="manner"', '매너 줄');
    includes(html, '같이 친 경기 어땠어요?', '안내 문구');
    eq((html.match(/data-manner-tag=/g) || []).length, 4, '칩 4개');
    ['시간 약속 정확', '배려 넘침', '실력이 비슷해요', '매너 굿'].forEach(function (label) {
      includes(html, label, '태그 문구: ' + label);
    });
    includes(html, 'data-manner-tag="time"', '칩 코드');
    eq((html.match(/<input/g) || []).length, 1, '입력칸은 메시지 입력 하나뿐 (태그는 자유 입력 없음)');
  });

  test('v1.29 화면: 오늘 남긴 태그가 있으면 조용한 한 줄로 바뀐다', function () {
    var rows = BM.fixtures.demo().concat([
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'care', at: U.stamp(), date: U.ymd() })
    ]);
    var st = matchRoomState(rows);
    var html = BM.views.chat.roomHtml(st);
    checkHtml(html, '매너 남긴 뒤');
    includes(html, 'manner manner--done', '남긴 상태');
    includes(html, '오늘', '오늘');
    includes(html, '배려 넘침', '남긴 태그');
    includes(html, '네트앞여우', '상대 이름');
    excludes(html, 'data-manner-tag', '다시 고르는 칩은 숨김');
  });

  test('v1.29 화면: 단체방·코치방에는 매너 태그를 두지 않는다', function () {
    var rows = BM.fixtures.demo().concat([
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }, BM.seed.ME, 'bolt-g')
    ]);
    var st = stateOf(rows);
    st.ui.chatRoom = 'bolt-g';
    st.ui.chatOther = '';
    var html = BM.views.chat.roomHtml(st);
    checkHtml(html, '단체방');
    includes(html, 'dmhead__who--group', '단체방 화면');
    excludes(html, 'manner', '단체방에는 매너 태그 없음');
    /* 코치 방은 방 종류로 걸러 냅니다 */
    var mst = stateOf();
    eq(BM.views.chat.mannerHtml(mst, 'demo_net', true, 'coach'), '', '코치방 없음');
    eq(BM.views.chat.mannerHtml(mst, '', true, 'match'), '', '상대 없음');
    eq(BM.views.chat.mannerHtml(mst, 'demo_net', false, 'match'), '', '대화 불가면 없음');
  });

  test('v1.29 화면: 프로필 시트에 받은 매너 배지가 건수와 함께 보인다', function () {
    var rows = BM.fixtures.demo().concat([
      mannerRow({ from: 'demo_chi', to: 'demo_net', code: 'care', at: '2026-11-20 21:00:00' }),
      mannerRow({ from: 'demo_foot', to: 'demo_net', code: 'care', at: '2026-11-20 22:00:00' }),
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'time', at: '2026-11-19 20:00:00' })
    ]);
    var st = stateOf(rows);
    var html = BM.views.profile.mannerBlock(st, 'demo_net');
    checkHtml(html, '프로필 매너');
    includes(html, '받은 매너 3', '총 건수');
    includes(html, 'mannerbadge', '배지');
    includes(html, '배려 넘침', '태그 문구');
    includes(html, '<b>2</b>', '건수');
    includes(html, '시간 약속 정확', '두 번째 태그');
    eq((html.match(/class="mannerbadge"/g) || []).length, 2, '태그 종류만큼');
  });

  test('v1.29 화면: 받은 태그가 없으면 조용한 한 줄만', function () {
    var st = stateOf();
    var html = BM.views.profile.mannerBlock(st, 'demo_suttle');
    includes(html, 'pp__manner-empty', '빈 상태 한 줄');
    includes(html, '아직 받은 매너 태그가 없어요', '문구');
    excludes(html, 'mannerbadge', '배지 없음');
  });

  /* =========================================================
   * 4. 모집 정원 — 계산
   * ========================================================= */
  test('v1.29 정원: 몇 명은 cap, 예전 이름 max도 읽는다', function () {
    eq(D.meetCap({ cap: '6' }), 6, 'cap');
    eq(D.meetCap({ max: '4' }), 4, 'max(다른 이름)');
    eq(D.meetCap({ cap: '', max: '3' }), 3, 'cap이 비면 max');
    eq(D.meetCap({ cap: '6명' }), 6, '숫자만');
    eq(D.meetCap({ cap: '0' }), 0, '0명은 정원 없음');
    eq(D.meetCap({}), 0, '정원 없음');
    eq(D.meetCap(null), 0, 'null 안전');
    eq(D.normalizeMeet({ max: '5' }).cap, '5', 'normalizeMeet도 max를 읽음');
    eq(D.normalizeMeet({ cap: '7', max: '5' }).cap, '7', 'cap이 먼저');
  });

  test('v1.29 정원: 참여자 = 글쓴이 + 단체방에 남긴 사람', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '4' } }, 'demo_chi', 'bolt-2'),
      groupMsgRow('bolt-2', 'demo_suttle', '셔틀버스', '번개 참여하고 싶어요!'),
      groupMsgRow('bolt-2', 'demo_suttle', '셔틀버스', '19시에 갈게요'),
      groupMsgRow('bolt-2', 'demo_net', '네트앞여우', '저도 갈게요')
    ];
    var st = stateOf(rows);
    var post = st.data.posts.filter(function (p) { return p.id === 'bolt-2'; })[0];
    var s = D.meetStatus(st.data.idx, post, BM.seed.ME);
    eq(s.cap, 4, '정원');
    eq(s.count, 3, '글쓴이 + 문의 2명 (같은 사람은 한 번)');
    eq(s.guests, 2, '문의한 사람 수');
    eq(s.closed, false, '아직 자리 있음');
    eq(s.mine, false, '내 글 아님');
    eq(s.members[0].key, 'demo_chi', '글쓴이가 먼저');
    eq(s.members.length, 3, '명단');
  });

  test('v1.29 정원: 정원이 차면 자동 마감', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '3' } }, 'demo_chi', 'bolt-3'),
      groupMsgRow('bolt-3', 'demo_suttle', '셔틀버스', '참여하고 싶어요!'),
      groupMsgRow('bolt-3', 'demo_net', '네트앞여우', '저도요!')
    ];
    var st = stateOf(rows);
    var post = st.data.posts.filter(function (p) { return p.id === 'bolt-3'; })[0];
    var s = D.meetStatus(st.data.idx, post, BM.seed.ME);
    eq(s.count, 3, '정원만큼 모임');
    eq(s.closed, true, '자동 마감');

    /* 정원을 넘겨도 마감은 그대로 (숫자는 실제 인원) */
    var more = stateOf(rows.concat([groupMsgRow('bolt-3', 'demo_koala', '콕콕이', '저도 끼워 주세요')]));
    var p2 = more.data.posts.filter(function (p) { return p.id === 'bolt-3'; })[0];
    eq(D.meetStatus(more.data.idx, p2, BM.seed.ME).count, 4, '인원은 실제로 셈');
    eq(D.meetStatus(more.data.idx, p2, BM.seed.ME).closed, true, '마감 유지');
  });

  test('v1.29 정원: 정원이 없으면 마감하지 않는다', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { place: '동네 체육관' } }, 'demo_chi', 'bolt-4'),
      groupMsgRow('bolt-4', 'demo_suttle', '셔틀버스', '갈게요')
    ];
    var st = stateOf(rows);
    var post = st.data.posts.filter(function (p) { return p.id === 'bolt-4'; })[0];
    var s = D.meetStatus(st.data.idx, post, BM.seed.ME);
    eq(s.cap, 0, '정원 없음');
    eq(s.count, 2, '인원은 셈');
    eq(s.closed, false, '마감 없음');
  });

  test('v1.29 정원: 계산은 저장된 행을 건드리지 않는다', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { cap: '3' } }, 'demo_chi', 'bolt-5'),
      groupMsgRow('bolt-5', 'demo_suttle', '셔틀버스', '갈게요')
    ];
    var before = JSON.stringify(rows);
    var st = stateOf(rows);
    var post = st.data.posts.filter(function (p) { return p.id === 'bolt-5'; })[0];
    D.meetStatus(st.data.idx, post, BM.seed.ME);
    D.mannerReceived(st.data.idx, 'demo_net');
    eq(JSON.stringify(rows), before, '행이 그대로');
  });

  /* =========================================================
   * 5. 모집 정원 — 화면
   * ========================================================= */
  /* bm-v1.43.0 — 정원이 차면 커뮤니티 피드에서 자동으로 내려갑니다 (단체방은 남음) */
  test('v1.29 화면: 정원이 찬 글은 커뮤니티 피드에서 내려간다', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '3' } }, 'demo_chi', 'bolt-6'),
      groupMsgRow('bolt-6', 'demo_suttle', '셔틀버스', '참여하고 싶어요!'),
      groupMsgRow('bolt-6', 'demo_net', '네트앞여우', '저도요!')
    ];
    var st = stateOf(rows);
    var html = BM.views.community.render(st);
    checkHtml(html, '마감된 번개');
    excludes(html, 'data-post="bolt-6"', '피드에서 내려감');
    includes(html, '지금은 모집 중인 글이 없어요', '빈 화면 안내');
    /* 이미 참여 중인 사람에게는 단체방이 그대로 남습니다 */
    var post = st.data.posts.filter(function (p) { return p.id === 'bolt-6'; })[0];
    ok(D.guestMember(st.data.idx, post, 'demo_suttle'), '예전 참여자는 방 사람');
    eq(D.meetStatus(st.data.idx, post, 'demo_suttle').closed, true, '마감 상태');
  });

  test('v1.29 화면: 자리가 남은 글은 참여 신청', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }, 'demo_chi', 'bolt-7'),
      groupMsgRow('bolt-7', 'demo_suttle', '셔틀버스', '참여하고 싶어요!')
    ];
    var html = BM.views.community.render(stateOf(rows));
    checkHtml(html, '자리 남은 번개');
    includes(html, '>참여 신청<', '참여 신청');
    excludes(html, 'pill--closed', '마감 배지 없음');
    excludes(html, 'vite vite--closed', '마감 카드 아님');
    includes(html, '참여 2/6명', '지금 인원');
  });

  test('v1.29 화면: 글쓴이에게는 참여자 N명 요약과 명단 보기', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }, BM.seed.ME, 'bolt-8'),
      groupMsgRow('bolt-8', 'demo_suttle', '셔틀버스', '참여하고 싶어요!'),
      groupMsgRow('bolt-8', 'demo_net', '네트앞여우', '저도 갈게요')
    ];
    var html = BM.views.community.render(stateOf(rows));
    checkHtml(html, '내가 쓴 번개');
    includes(html, '참여자 3명', '참여자 요약');
    includes(html, 'data-vite-members="bolt-8"', '명단 보기');
    includes(html, '명단 보기', '버튼 글자');
    includes(html, '단체방 열기', '내 글은 단체방 열기');
    excludes(html, '대기 문의', '자리가 남아 있으면 대기 문의 아님');
  });

  test('v1.29 화면: 정원이 찬 내 글도 피드에서는 내려가고 단체방에서 현황·모집 종료를 본다', function () {
    var rows = [
      meetRow({ topic: '번개', meet: { cap: '2' } }, BM.seed.ME, 'bolt-9'),
      groupMsgRow('bolt-9', 'demo_suttle', '셔틀버스', '갈게요')
    ];
    var st = stateOf(rows);
    st.ui.chatRoom = 'bolt-9';
    var html = BM.views.community.render(st);
    checkHtml(html, '마감된 내 번개');
    excludes(html, 'data-post="bolt-9"', '글쓴이에게도 피드에서 내려감');
    var room = BM.views.chat.roomHtml(st);
    includes(room, '참여 2/2명', '모집 현황 줄');
    includes(room, 'data-vite-members="bolt-9"', '명단 보기');
    includes(room, 'data-vite-end="bolt-9"', '글쓴이는 모집 종료');
    excludes(room, 'data-vite-leave', '글쓴이에게는 나가기 없음');
  });

  test('v1.29 문구: 대기 문의 문구도 한 줄에 들어간다', function () {
    var post = { meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } };
    var draft = BM.views.community._waitDraft(post);
    includes(draft, '게스트 모집', '말머리');
    includes(draft, '대기하고 싶어요', '대기 의사');
    includes(draft, '11/21(금)', '일시(날짜)');
    ok(draft.length <= 30, '한 줄 입력창에 들어가는 길이');
    excludes(draft, '올림픽체육관', '긴 장소는 생략');
    excludes(draft, '19:00', '한 줄을 넘지 않게 시간은 생략');
    eq(BM.views.community._waitDraft({ meet: null }), '게스트 모집 대기하고 싶어요!', '정보 없으면 인사만');
  });

  test('v1.29 화면: 이상한 닉네임·장소도 그대로 이스케이프', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)>';
    var rows = [
      meetRow({ topic: '번개', nick: PAYLOAD, text: PAYLOAD, meet: { place: PAYLOAD, cap: '3' } }, 'demo_chi', 'bolt-x'),
      groupMsgRow('bolt-x', 'demo_suttle', PAYLOAD, '갈게요')
    ];
    var html = BM.views.community.render(stateOf(rows));
    excludes(html, '<img src=x', '이스케이프');
    includes(html, '&lt;img src=x', '글자로 보임');
  });

  /* =========================================================
   * 6. 기존 동작 보존 · 버전
   * ========================================================= */
  test('v1.29 보존: 매너 행은 하트 잔액을 건드리지 않는다', function () {
    var rows = BM.fixtures.demo().concat([
      mannerRow({ from: BM.seed.ME, to: 'demo_net', code: 'good', at: U.stamp(), date: U.ymd() })
    ]);
    var a = BM.store.derive(BM.fixtures.demo(), BM.seed.ME);
    var b = BM.store.derive(rows, BM.seed.ME);
    eq(b.hearts.balance, a.hearts.balance, '하트 잔액 그대로');
    eq(b.posts.length, a.posts.length, '커뮤니티 글 수 그대로');
    eq(b.threads.length, a.threads.length, '대화 목록 그대로');
    eq(b.friends.length, a.friends.length, '친구 그대로');
  });

  test('v1.29 스타일: 매너 태그·마감·명단 클래스가 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.manner', '.manner__chip', '.manner--done', '.mannerbadge',
      '.pp__manner-empty', '.pill--closed', '.vite--closed', '.vite__members', '.members__who'].forEach(function (sel) {
      includes(css, sel, '클래스 정의: ' + sel);
    });
  });

  test('v1.29 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.73.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.73.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261125-2', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.73.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.73.0', 'TWA appVersion');
    eq(twa.appVersionCode, 67, 'TWA 버전 코드');
    includes(readRoot('index.html'), 'js/views/chat.js', '채팅 화면 파일 유지');
    includes(readRoot('sw.js'), "'./js/views/profile.js'", '서비스워커 캐시 목록 유지');
  });

  test('v1.29 문서: 아이디어 노트에 두 기능이 반영으로 남는다', function () {
    if (!hasNode) return;
    var note = readRoot('ideas.md');
    includes(note, '매너 한 줄 태그', '아이디어 노트 항목');
    includes(note, 'v1.31.0', '반영 버전');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
