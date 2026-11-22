/* ============================================================
 * test/v138.test.js — bm-v1.38.0
 *   [🔐 친구 코드(#XXXX) 친추 제한 · 1:1 매칭 친추 제거]
 *
 *   1) 친구 코드 (js/domain.js · js/views/friends.js)
 *      · 4자리 영문 대문자+숫자, 헷갈리는 I·O·0·1 은 쓰지 않는다
 *      · user_key 하나에 코드 하나(결정적) — 기기·서버·시트가 같은 값
 *      · '#a7k2' · '나래#A7K2' · ' A7-K2 ' 를 모두 읽고, 잘못 친 코드는 조용히 바꾸지 않는다
 *      · 프로필·매칭카드가 있는 회원만 찾는다(닉네임 검색 없음)
 *      · 코드로만 친구 요청(friends 시트 → store.sendFriendRequestByCode)
 *
 *   2) 내 코드 노출 (MY · 채팅 목록 · 친구 추가 시트, 원탭 복사)
 *
 *   3) 아무나 친추하던 길 제거
 *      · 프로필 시트의 '친구 추가' 버튼 삭제(받은 요청 수락·친구 끊기·채팅은 유지)
 *      · 1:1 매칭 카드·상세 보기에서 친구 추가 삭제 → 편지지(매칭 요청)만
 *      · 채팅 목록 + → '친구 코드로 추가' (매칭 탭으로 보내지 않음)
 *
 *   4) 기존 기능 회귀 · XSS · 버전 정합 · 문서
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
  function existsRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, file));
  }
  function ruleOf(css, selector) {
    var at = css.indexOf(selector + ' {');
    if (at < 0) return '';
    var start = css.indexOf('{', at);
    var end = css.indexOf('}', start);
    return end > start ? css.slice(start, end) : '';
  }

  var ME = 'demo_me';
  var ME_INFO = { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_def', avatar: '🦋' } };

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: JSON.parse(JSON.stringify(ME_INFO)),
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
      ui: {
        tab: 'my', matchFilter: { level: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', chatRoom: null, chatOther: '', chatDraft: '', chatOpen: false,
        coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k === 'ui') st.ui = Object.assign({}, st.ui, patch.ui);
        else st[k] = patch[k];
      });
    }
    return st;
  }

  function friendRow(id, type, from, to, at) {
    return D.toRow({
      id: id, type: type, createdAt: at || U.stamp(), date: U.ymd(),
      nick: '', userKey: from, target: to
    });
  }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(extra) {
    clearStorage();
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(Array.isArray(e) ? e : D.toRow(e)); });
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* 대상 유저의 코드 (테스트에서 사람이 코드를 외우지 않아도 되게) */
  function codeOf(key) { return D.friendCodeOf(key); }

  /* =========================================================
   * 1. 친구 코드 — 형식·결정성
   * ========================================================= */
  test('v1.38 코드: 4자리 영문 대문자+숫자이고 헷갈리는 I·O·0·1 은 쓰지 않는다', function () {
    eq(D.FRIEND_CODE_LEN, 4, '4자리');
    eq(D.FRIEND_CODE_ALPHABET.length, 32, '32자 알파벳');
    ['I', 'O', '0', '1'].forEach(function (ch) {
      eq(D.FRIEND_CODE_ALPHABET.indexOf(ch), -1, '쓰지 않는 글자: ' + ch);
    });
    ['demo_me', 'demo_chi', 'u_8f3a9c0b1d2e', 'user@example.com'].forEach(function (key) {
      var code = codeOf(key);
      eq(code.length, 4, '길이 4: ' + key);
      ok(/^[A-Z2-9]{4}$/.test(code), '대문자·숫자만: ' + code);
      excludes(code, 'I', 'I 없음');
      excludes(code, 'O', 'O 없음');
      excludes(code, '0', '0 없음');
      excludes(code, '1', '1 없음');
      eq(D.friendCodeLabel(key), '#' + code, '표시는 # + 코드');
    });
    eq(D.friendCodeOf(''), '', '키가 없으면 코드도 없다');
    eq(D.friendCodeOf(null), '', 'null 안전');
  });

  test('v1.38 코드: 같은 user_key 는 언제·어디서 계산해도 같은 코드(서버가 그대로 쓸 수 있음)', function () {
    var key = 'u_csw42060713';
    var first = codeOf(key);
    for (var i = 0; i < 5; i++) eq(codeOf(key), first, '반복 계산도 같은 값');
    eq(codeOf(' ' + key + ' '), first, '앞뒤 공백은 무시');
    ok(codeOf(key) !== codeOf(key + 'x'), '다른 키는 다른 코드');
    ok(codeOf('demo_chi') !== codeOf('demo_net'), '사람마다 다른 코드');
  });

  test('v1.38 코드: 회원들 코드가 겹치지 않고, 흔한 키 모양에서도 충돌이 드물다', function () {
    var rows = BM.fixtures.demo();
    var idx = D.index(rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
    var dir = D.friendCodeDirectory(idx);
    ok(dir.length >= 8, '회원 목록: ' + dir.length);
    var seen = {};
    dir.forEach(function (u) {
      ok(!seen[u.code], '코드 겹침 없음: ' + u.nick + ' #' + u.code);
      seen[u.code] = u.key;
    });
    /* user_key 모양이 비슷해도(u_1…, u_2…) 낮은 비트가 몰리지 않아야 합니다 */
    var twice = {}, coll = 0;
    for (var i = 0; i < 5000; i++) {
      var c = codeOf('u_' + i + '_xyz');
      if (twice[c]) coll++;
      twice[c] = 1;
    }
    ok(coll <= 40, '5000명 중 코드 충돌 ' + coll + '건 (기대값 약 12건)');
  });

  test('v1.38 코드: 사람이 친 코드를 읽는다 (#·닉네임·공백·소문자·붙임표)', function () {
    eq(D.friendCodeParse('A7K2'), 'A7K2', '그대로');
    eq(D.friendCodeParse('#a7k2'), 'A7K2', '# + 소문자');
    eq(D.friendCodeParse('나래#A7K2'), 'A7K2', '닉네임#코드');
    eq(D.friendCodeParse('  a7k2  '), 'A7K2', '앞뒤 공백');
    eq(D.friendCodeParse('A7-K2'), 'A7K2', '붙임표');
    eq(D.friendCodeParse('a7k2'), 'A7K2', '소문자만');
    eq(D.friendCodeParse(''), '', '빈 값');
    /* 코드에 없는 O·0·I·1 은 잘못 친 것으로 봅니다(조용히 다른 코드로 바꾸지 않음) */
    ['A0K2', 'AOK2', 'A1K2', 'AIK2'].forEach(function (bad) {
      eq(D.friendCodeParse(bad), '', '잘못된 글자: ' + bad);
    });
    eq(D.friendCodeParse('A7K'), '', '3자리');
    eq(D.friendCodeParse('A7K22'), '', '5자리');
    eq(D.friendCodeParse('!!!!'), '', '글자가 아님');
  });

  test('v1.38 코드: 코드로 회원을 찾는다 (프로필·매칭카드가 있는 사람만)', function () {
    var state = stateOf();
    var idx = state.data.idx;
    var target = 'demo_chi';
    var found = D.friendCodeFind(idx, '#' + codeOf(target).toLowerCase());
    eq(found.code, codeOf(target), '읽은 코드');
    eq(found.matches.length, 1, '한 명 찾음');
    eq(found.matches[0].key, target, '찾은 사람');
    eq(found.matches[0].nick, '콕집사', '닉네임');
    ok(found.matches[0].level, '급수도 함께');

    var none = D.friendCodeFind(idx, 'ZZZZ');
    eq(none.matches.length, 0, '없는 코드');
    eq(none.invalid, false, '형식은 맞음');

    var bad = D.friendCodeFind(idx, 'A0K2');
    eq(bad.code, '', '형식이 틀림');
    eq(bad.invalid, true, '잘못 친 코드 표시');
    eq(bad.matches.length, 0, '찾지 않음');

    /* 내 코드도 찾히지만 화면에서 '내 코드'로 안내합니다 */
    var mine = D.friendCodeFind(idx, codeOf(ME));
    eq(mine.matches.length, 1, '내 코드도 찾힘');
    eq(mine.matches[0].key, ME, '나');
  });

  test('v1.38 코드: 회원 목록에는 프로필이 없는 빈 키가 없다', function () {
    var idx = D.index([
      D.toRow({ id: 'p1', type: '프로필', createdAt: '2026-11-20 10:00:00', userKey: 'u_a', nick: '가' }),
      D.toRow({ id: 'p2', type: '프로필', createdAt: '2026-11-20 10:05:00', userKey: 'u_a', nick: '가(수정)' }),
      D.toRow({ id: 'm1', type: '매칭프로필', createdAt: '2026-11-20 10:06:00', userKey: 'u_b', nick: '나', payload: { level: 'B조', region: '서울' } })
    ]);
    var dir = D.friendCodeDirectory(idx);
    eq(dir.length, 2, '사람 수만큼');
    var a = dir.filter(function (u) { return u.key === 'u_a'; })[0];
    eq(a.nick, '가(수정)', '최신 닉네임');
    var b = dir.filter(function (u) { return u.key === 'u_b'; })[0];
    eq(b.nick, '나', '매칭 카드만 있어도 찾힌다');
    eq(b.level, 'B조', '매칭 카드 급수');
  });

  /* =========================================================
   * 2. 코드로만 친구 요청 (저장소)
   * ========================================================= */
  test('v1.38 친추: 코드를 넣으면 친구 요청이 가고, 코드가 틀리면 가지 않는다', function () {
    return freshStore().then(function (store) {
      eq(D.friendState(store.state.idx, ME, 'demo_chi').state, 'none', '처음엔 관계 없음');
      var res = store.actions.sendFriendRequestByCode('#' + codeOf('demo_chi').toLowerCase());
      ok(res.ok, '코드로 요청');
      eq(res.code, codeOf('demo_chi'), '쓴 코드를 돌려줌');
      eq(res.target.key, 'demo_chi', '찾은 사람');
      eq(D.friendState(store.state.idx, ME, 'demo_chi').state, 'sent', '보낸 상태');
      var rows = (store.state.idx.byType['친구요청'] || []).filter(function (r) {
        return r.userKey === ME && r.target === 'demo_chi';
      });
      eq(rows.length, 1, '친구요청 행 1개');
      store.state.locks = {};
      eq(store.actions.sendFriendRequestByCode(codeOf('demo_chi')).reason, 'sent', '같은 사람에게 또 보내지 않음');

      store.state.locks = {};
      eq(store.actions.sendFriendRequestByCode('ZZZZ').reason, 'notfound', '없는 코드');
      eq(store.actions.sendFriendRequestByCode('A0K2').reason, 'bad_code', '형식이 틀린 코드');
      eq(store.actions.sendFriendRequestByCode(codeOf(ME)).reason, 'self', '내 코드');
      eq(store.actions.sendFriendRequestByCode('').reason, 'bad_code', '빈 코드');
      eq(D.friendState(store.state.idx, ME, 'demo_net').state, 'none', '실패한 요청은 흔적을 남기지 않음');
    });
  });

  test('v1.38 친추: 같은 코드를 쓰는 사람이 둘이면 골라서 보내게 한다', function () {
    /* 4자리 코드라 아주 드물게 겹칠 수 있습니다. 그때는 조용히 한 명을 고르지 않습니다. */
    var seen = {}, pair = null;
    for (var i = 0; i < 20000 && !pair; i++) {
      var key = 'u_c' + i;
      var c = codeOf(key);
      if (seen[c]) pair = [seen[c], key];
      else seen[c] = key;
    }
    ok(pair, '충돌하는 두 키를 찾는다');
    var rows = [
      D.toRow({ id: 'p_me', type: '프로필', createdAt: '2026-11-20 09:00:00', userKey: ME, nick: '나래' }),
      D.toRow({ id: 'pa', type: '프로필', createdAt: '2026-11-20 09:01:00', userKey: pair[0], nick: '첫째' }),
      D.toRow({ id: 'pb', type: '프로필', createdAt: '2026-11-20 09:02:00', userKey: pair[1], nick: '둘째' })
    ];
    return freshStore(rows).then(function (store) {
      var found = D.friendCodeFind(store.state.idx, codeOf(pair[0]));
      eq(found.matches.length, 2, '두 명 찾힘');
      var res = store.actions.sendFriendRequestByCode(codeOf(pair[0]));
      eq(res.ok, false, '바로 보내지 않음');
      eq(res.reason, 'ambiguous', '골라야 함');
      eq(res.matches.length, 2, '후보 2명');
      eq((store.state.idx.byType['친구요청'] || []).length, 0, '아직 아무 요청도 없음');
    });
  });

  /* =========================================================
   * 3. 내 코드 노출 — MY · 채팅 목록 · 친구 추가 시트
   * ========================================================= */
  test('v1.38 MY: 닉네임 아래에 내 친구 코드가 보이고 원탭으로 복사된다', function () {
    var state = stateOf();
    var html = BM.views.my.render(state);
    var code = codeOf(ME);
    includes(html, '#' + code, '내 코드 표시');
    includes(html, 'data-code-copy="나래#' + code + '"', '복사할 글자(닉네임#코드)');
    includes(html, 'codechip__v', '코드 칩');
    includes(html, '친구 코드', '이름표');
    includes(html, 'aria-label="내 친구 코드 #' + code + ', 눌러서 복사"', '스크린리더용 이름');
    /* 닉네임 바로 아래(프로필 꾸미기 버튼보다 위) */
    ok(html.indexOf('codechip') > html.indexOf('profile__name'), '닉네임 아래');
    ok(html.indexOf('codechip') < html.indexOf('data-act="decorate-sheet"'), '꾸미기 버튼 위');
  });

  test('v1.38 채팅: 목록 위에 내 코드 줄이 있고, + 는 친구 코드로 추가한다', function () {
    var state = stateOf();
    var html = BM.views.chat.listHtml(state);
    var code = codeOf(ME);
    includes(html, 'class="codebar"', '내 코드 줄');
    includes(html, '내 친구 코드', '이름표');
    includes(html, '<i>#' + code + '</i>', '코드');
    includes(html, 'data-dm-add', '친구 추가 입구');
    includes(html, 'aria-label="친구 코드로 친구 추가"', '버튼 이름');
    includes(html, 'data-code-copy="나래#' + code + '"', '원탭 복사');
    excludes(html, 'data-dm-find', '매칭 탭으로 보내던 예전 입구 없음');
    excludes(html, '매칭에서 친구 찾기', '예전 문구 없음');
  });

  test('v1.38 채팅: 대화가 없어도 친구 코드로 추가할 수 있다', function () {
    var state = stateOf([
      D.toRow({ id: 'p_me', type: '프로필', createdAt: U.stamp(), userKey: ME, nick: '나래' })
    ]);
    var html = BM.views.chat.listHtml(state);
    includes(html, 'data-dm-add', '친구 코드로 추가 버튼');
    includes(html, '친구 코드를 아는 사람과 친구가 되면', '안내 문구');
  });

  test('v1.38 친구 추가 시트: 내 코드 · 코드 입력 · 안내가 한 화면에 있다', function () {
    var state = stateOf();
    var html = BM.views.friends.body(state);
    var code = codeOf(ME);
    includes(html, 'data-friends', '시트 본문');
    includes(html, '나래<i>#' + code + '</i>', '내 닉네임#코드');
    includes(html, 'data-code-copy="나래#' + code + '"', '복사 버튼');
    includes(html, 'data-code-form', '코드 입력 폼');
    includes(html, 'data-code-input', '입력칸');
    includes(html, 'autocapitalize="characters"', '대문자 입력');
    includes(html, 'placeholder="예: A7K2"', '예시');
    includes(html, '코드로 찾기', '찾기 버튼');
    includes(html, 'data-code-result', '결과 자리');
    includes(html, '친구 코드를 아는 사람에게만', '아는 사람만 안내');
    includes(html, '1:1 매칭은 편지지로 요청하세요', '매칭은 편지지 안내');
  });

  test('v1.38 친구 추가 시트: 찾은 뒤 상태에 맞는 버튼만 보여 준다', function () {
    var rows = BM.fixtures.demo().concat([
      friendRow('fr_ok', '친구요청', 'demo_suttle', ME, '2026-11-19 10:00:00'),
      friendRow('fa_ok', '친구수락', ME, 'demo_suttle', '2026-11-19 10:05:00'),
      friendRow('fr_in', '친구요청', 'demo_net', ME, '2026-11-19 11:00:00'),
      friendRow('fr_out', '친구요청', ME, 'demo_koala', '2026-11-19 11:10:00')
    ]);
    var state = stateOf(rows);

    var act = BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, codeOf('demo_chi')));
    includes(act, 'data-code-send="demo_chi"', '모르는 사람은 친구 요청');
    includes(act, '#' + codeOf('demo_chi'), '상대 코드 표시');
    excludes(act, 'data-friend-add', '프로필 친추 버튼 없음');

    var already = BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, codeOf('demo_suttle')));
    includes(already, 'data-code-chat', '이미 친구면 바로 채팅');
    includes(already, 'pill--friend', '친구 배지');
    excludes(already, 'data-code-send', '이미 친구에게 또 요청하지 않음');

    var incoming = BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, codeOf('demo_net')));
    includes(incoming, 'data-code-accept="fr_in"', '상대가 먼저 요청했으면 수락');
    includes(incoming, 'data-code-reject="fr_in"', '거절도 그 자리에서');

    var outgoing = BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, codeOf('demo_koala')));
    includes(outgoing, '요청 보냄', '보낸 요청은 대기 표시');
    excludes(outgoing, 'data-code-send', '또 보내지 않음');
  });

  /* =========================================================
   * 4. 아무나 친추하던 길 제거
   * ========================================================= */
  test('v1.38 친추 제한: 프로필 시트에 친구 추가 버튼이 없다', function () {
    var state = stateOf();
    var html = BM.views.profile.buttons(state, 'demo_drive');
    ok(html.length > 0, '버튼 묶음이 그려진다');
    excludes(html, 'data-friend-add', '친구 추가 버튼 없음');
    excludes(html, '친구 추가', '친구 추가 글자도 없음');
    includes(html, '친구 코드', '친구 코드가 있어야 한다는 안내');
    excludes(BM.views.profile.buttons(state, 'demo_drive'), 'data-friend-chat', '친구 아닌 사람과 채팅 버튼 없음');
  });

  test('v1.38 친추 제한: 프로필 시트의 받은 요청·친구·채팅은 그대로다', function () {
    var rows = BM.fixtures.demo().concat([
      friendRow('fr1', '친구요청', 'demo_foot', ME, '2026-11-19 09:00:00'),
      friendRow('fr2', '친구요청', ME, 'demo_chi', '2026-11-19 09:10:00'),
      friendRow('fa2', '친구수락', 'demo_chi', ME, '2026-11-19 09:20:00')
    ]);
    var state = stateOf(rows);
    var received = BM.views.profile.buttons(state, 'demo_foot');
    includes(received, 'data-friend-accept="fr1"', '받은 요청은 여기서 수락');
    includes(received, 'data-friend-reject="fr1"', '거절도 그대로');
    var friends = BM.views.profile.buttons(state, 'demo_chi');
    includes(friends, 'data-friend-chat', '친구는 채팅 버튼');
    includes(friends, '친구 끊기', '친구 끊기');
    var sent = BM.views.profile.buttons(state, 'demo_koala');
    eq(sent.indexOf('data-friend-add'), -1, '요청 가능한 사람도 버튼은 없다');
  });

  test('v1.38 매칭: 선수 카드와 상세 보기에 친구 추가가 없고 편지지 요청만 있다', function () {
    var state = stateOf();
    var p = state.data.matchProfiles.filter(function (x) { return x.userKey === 'demo_chi'; })[0];
    var card = BM.views.matching.playerCard(p, state);
    excludes(card, '친구 추가', '카드에 친구 추가 없음');
    excludes(card, 'data-friend-add', '카드에 친추 버튼 없음');
    includes(card, 'data-open-profile="demo_chi"', '카드를 누르면 상세로');
    includes(card, '프로필 보고 요청하기', '요청하기로 이어짐');

    var sheet = BM.views.matching.profileBody(state, p);
    excludes(sheet, '친구 추가', '상세에 친구 추가 없음');
    excludes(sheet, 'data-friend-add', '상세에 친추 버튼 없음');
    includes(sheet, 'data-send-request="demo_chi"', '편지지(매칭 요청) 보내기');
    includes(sheet, '한마디 남기기', '한마디 남기기');
  });

  test('v1.38 매칭: 이미 친구인 상대도 대화는 그대로 된다', function () {
    var rows = BM.fixtures.demo().concat([
      friendRow('fr9', '친구요청', ME, 'demo_chi', '2026-11-19 09:00:00'),
      friendRow('fa9', '친구수락', 'demo_chi', ME, '2026-11-19 09:05:00')
    ]);
    var state = stateOf(rows);
    var p = state.data.matchProfiles.filter(function (x) { return x.userKey === 'demo_chi'; })[0];
    var sheet = BM.views.matching.profileBody(state, p);
    includes(sheet, 'data-open-chat', '채팅 시작');
    includes(sheet, '친구예요', '친구 안내');
    eq(D.canChatWith(state.data.idx, ME, 'demo_chi'), true, '대화 가능');
  });

  test('v1.38 매칭: 편지지 수락 → 대화방은 예전 그대로다', function () {
    var state = stateOf();
    var received = (state.data.requests || []).filter(function (r) {
      return r.target === ME && r.status === '대기';
    })[0];
    ok(received, '받은 매칭 요청이 있다');
    var letter = BM.views.matching.letterHtml(state, received);
    includes(letter, 'data-accept="' + received.id + '"', '수락 버튼');
    includes(letter, 'data-decline="' + received.id + '"', '거절 버튼');
    includes(letter, '매칭 요청', '편지지');
  });

  /* =========================================================
   * 5. XSS — 코드·닉네임이 화면에 그대로 박히지 않는다
   * ========================================================= */
  test('v1.38 보안: 친구 코드 화면이 닉네임·코드를 이스케이프한다', function () {
    var PAYLOAD = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
    var state = stateOf([
      D.toRow({ id: 'p_me', type: '프로필', createdAt: U.stamp(), userKey: ME, nick: PAYLOAD }),
      D.toRow({ id: 'p_x', type: '프로필', createdAt: U.stamp(), userKey: 'demo_chi', nick: PAYLOAD })
    ]);
    state.me.nick = PAYLOAD;
    var found = D.friendCodeFind(state.data.idx, codeOf('demo_chi'));
    [BM.views.friends.body(state), BM.views.friends.codeBar(state),
      BM.views.friends.codeChip(state), BM.views.friends.resultHtml(state, found),
      BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, 'ZZZZ')),
      BM.views.friends.resultHtml(state, D.friendCodeFind(state.data.idx, 'A0K2')),
      BM.views.chat.listHtml(state)].forEach(function (html, i) {
      excludes(html, '<img src=x', '입력값이 태그로 열림 #' + i);
      excludes(html, '<script', 'script 태그 #' + i);
      excludes(html, '><img', '태그로 열린 입력 #' + i);
    });
  });

  /* =========================================================
   * 6. 스타일 · 접근성
   * ========================================================= */
  test('v1.38 스타일: 코드 칩·코드 줄·친구 추가 시트 규칙이 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    var chip = ruleOf(css, '.codechip');
    ok(chip, '.codechip 규칙');
    includes(chip, 'font-family: inherit', '버튼 글꼴 상속');
    includes(css, '.codebar {', '채팅 목록 코드 줄');
    includes(css, '.fcode__form {', '친구 추가 폼');
    includes(css, '.coderesult {', '찾은 사람 카드');
    includes(css, '.codemsg', '안내 상자');
    var form = ruleOf(css, '.fcode__form');
    includes(form, 'align-items: flex-end', '입력칸과 버튼 아래 맞춤');
    var chipCode = ruleOf(css, '.codechip__v');
    includes(chipCode, 'tabular-nums', '숫자 폭 고정');
  });

  /* =========================================================
   * 7. 버전 · 캐시 · 파일
   * ========================================================= */
  test('v1.38 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.52.2'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.52.2'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261122-66', 'index.html 스타일 캐시');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.52.2', 'TWA 버전 이름');
    eq(twa.appVersion, '1.52.2', 'TWA appVersion');
    eq(twa.appVersionCode, 46, 'TWA 버전 코드(웹만 바뀌면 그대로)');
  });

  test('v1.38 파일: friends.js 가 실제로 있고 화면·캐시에 들어 있다', function () {
    if (!hasNode) return;
    ok(existsRoot('js/views/friends.js'), '파일 존재');
    var index = readRoot('index.html');
    includes(index, '<script defer src="js/views/friends.js"></script>', 'index.html 스크립트');
    ok(index.indexOf('js/views/profile.js') < index.indexOf('js/views/friends.js'), 'profile 다음(화면이 서로를 부를 수 있게)');
    var sw = readRoot('sw.js');
    includes(sw, "'./js/views/friends.js'", 'sw.js 캐시');
    includes(sw, '친구 코드', 'sw.js 변경 이력에 이번 사이클');
  });

  test('v1.38 문서: README·아이디어 노트에 이번 사이클과 서버 조회 방법이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md');
    includes(readme, 'v1.43.0', 'README 이번 사이클');
    includes(readme, '친구 코드', '친구 코드 설명');
    includes(readme, 'user_key', '서버가 같은 규칙으로 조회');
    var ideas = readRoot('ideas.md');
    includes(ideas, 'bm-v1.43.0', '아이디어 노트 상태');
    includes(ideas, '친구 코드', '아이디어 노트 항목');
  });

  /* =========================================================
   * 8. 회귀 — 친구 수락 대화방 · 코드 없는 요청 · 매칭 목록
   * ========================================================= */
  test('v1.38 회귀: 받은 친구 요청 수락은 채팅 목록에서 그대로 된다', function () {
    var rows = BM.fixtures.demo().concat([
      friendRow('fr7', '친구요청', 'demo_foot', ME, U.stamp())
    ]);
    var state = stateOf(rows);
    var html = BM.views.chat.listHtml(state);
    includes(html, '받은 친구 요청', '요청 섹션');
    includes(html, 'data-req-accept="fr7"', '수락');
    includes(html, 'data-req-reject="fr7"', '거절');
    includes(html, '발놀림장인', '신청자');
  });

  test('v1.38 회귀: 친구가 아니면 1:1 메시지는 여전히 막힌다', function () {
    return freshStore().then(function (store) {
      eq(store.actions.sendChat('anyroom', 'demo_drive', '안녕하세요').reason, 'not_allowed', '친구·매칭 전엔 차단');
      store.state.locks = {};
      ok(store.actions.sendChat('anyroom', 'demo_net', '매칭된 상대에게는 가능').ok, '매칭 상대는 전송');
    });
  });

  test('v1.38 회귀: 매칭 찾기 화면은 그대로 있다(닉네임 검색은 매칭용)', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    includes(html, 'data-search-input', '검색칸');
    includes(html, 'placeholder="닉네임, 지역, 클럽으로 찾기"', '검색 안내');
    excludes(html, '친구 추가', '매칭 화면에 친구 추가 없음');
  });

  test('v1.38 회귀: 채팅 대화방은 친구·매칭 상대와 예전처럼 열린다', function () {
    var state = stateOf();
    var thread = (state.data.threads || [])[0];
    ok(thread, '대화방이 있다');
    state.ui.chatRoom = thread.roomId;
    state.ui.chatOther = thread.other;
    var html = BM.views.chat.roomHtml(state);
    includes(html, 'data-dm-form', '입력창');
    includes(html, 'data-dm-back', '목록으로');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
