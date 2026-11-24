/* ============================================================
 * test/meet.test.js — 커뮤니티 '게스트 모집' 모집 카드 (v1.11.0)
 *  1) 모집 정보 정리 — 언제·어디·몇 명(숫자만, 1~99), 전부 비면 없는 것으로
 *  2) 글 저장 — '훈련계획' 칸 JSON에 말머리와 함께 담기고, 시트 26칸 그대로
 *  3) 비워 두거나 다른 말머리면 지금처럼 일반 글로 올라간다
 *  4) 화면 — 게스트 모집일 때만 입력칸이 열리고, 글에는 참여 문의 버튼이 붙는다
 *  5) 참여 문의 — 대화를 열 때 모집 정보를 담은 문구를 미리 채운다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

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

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
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
    ok(html && html.length > 50, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'article', 'form', 'p', 'details', 'summary', 'label', 'input'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = tag === 'input' ? open : (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  function meetRow(plan, userKey, id) {
    return D.toRow({
      id: id || 'bolt-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '코트지기', text: '이번 주 금요일 저녁에 게스트 모집합니다!', userKey: userKey || 'u_other', plan: plan
    });
  }

  /* ---------- 1. 모집 정보 정리 ---------- */
  test('게스트 모집: 모집 정보를 다듬는다 (공백·숫자·글자 수)', function () {
    var m = D.normalizeMeet({ when: '  11/21(금)   19:00 ', place: ' 올림픽  체육관 ', cap: '6명' });
    eq(m.when, '11/21(금) 19:00', '언제 공백 정리');
    eq(m.place, '올림픽 체육관', '어디 공백 정리');
    eq(m.cap, '6', '몇 명은 숫자만');
    eq(D.normalizeMeet({ cap: '0' }).cap, '1', '0명은 1명으로');
    eq(D.normalizeMeet({ cap: '250' }).cap, '99', '최대 99명');
    eq(D.normalizeMeet({ cap: 'abc' }).cap, '', '숫자가 없으면 빈 값');
    eq(D.normalizeMeet({ when: 'a'.repeat(80) }).when.length, 30, '언제 30자 제한');
    eq(D.normalizeMeet(null).when, '', 'null 안전');
  });

  test('게스트 모집: 비어 있는 모집 정보는 없는 것으로 본다', function () {
    eq(D.meetFilled(D.normalizeMeet({})), false, '전부 빈 값');
    eq(D.meetFilled(D.normalizeMeet({ when: '  ' })), false, '공백만');
    eq(D.meetFilled(D.normalizeMeet({ place: '체육관' })), true, '하나만 있어도 모집 정보');
    eq(D.meetOf({ plan: { topic: '게스트 모집' } }), null, 'meet 없음');
    eq(D.meetOf({ plan: { topic: '게스트 모집', meet: {} } }), null, '빈 meet');
    eq(D.meetOf({ plan: { topic: '게스트 모집', meet: { place: '체육관' } } }).place, '체육관', 'meet 읽기');
    eq(D.meetOf({ plan: 'garbage' }), null, '깨진 plan 안전');
    eq(D.meetText({ when: '11/21 19:00', place: '체육관', cap: '6' }), '11/21 19:00 · 체육관 · 6명', '한 줄');
    eq(D.meetText({ when: '', place: '', cap: '' }), '', '빈 값은 빈 줄');
  });

  /* ---------- 2. 글 저장 ---------- */
  test('게스트 모집: 말머리와 모집 정보가 시트 26칸 그대로 저장된다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('게스트 모집');
      store.actions.setComposerMeet('when', '11/21(금) 19:00');
      store.actions.setComposerMeet('place', '올림픽체육관');
      store.actions.setComposerMeet('cap', '6');
      var res = store.actions.createPost('금요일 저녁 게스트 모집합니다', '게스트 모집', store.state.ui.composerMeet);
      ok(res.ok, '글 저장');
      eq(res.topic, '게스트 모집', '말머리');
      ok(res.meet, '모집 정보 함께 저장');
      eq(res.meet.cap, '6', '인원');

      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸 그대로');
      includes(row[D.COL['훈련계획']], '"topic":"게스트 모집"', '훈련계획 칸에 말머리');
      includes(row[D.COL['훈련계획']], '"meet"', '훈련계획 칸에 모집 정보');

      var post = store.state.data.posts[0];
      eq(post.topic, '게스트 모집', '목록 말머리');
      eq(post.meet.when, '11/21(금) 19:00', '목록 일시');
      eq(post.meet.place, '올림픽체육관', '목록 장소');
      eq(post.meet.cap, '6', '목록 인원');

      /* 다른 기기(시트)에서 다시 읽어도 그대로 */
      var back = D.fromRow(row);
      eq(D.topicOf(back), '게스트 모집', '다시 읽은 말머리');
      eq(D.meetOf(back).place, '올림픽체육관', '다시 읽은 장소');

      /* 올리면 작성칸은 비워집니다 */
      eq(store.state.ui.composerTopic, '자유', '말머리 초기화');
      eq(store.state.ui.composerMeet.when, '', '모집칸 초기화');
      return store.flush();
    });
  });

  test('게스트 모집: 모집 정보를 비워도, 다른 말머리면 모집 정보 없이 올라간다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var a = store.actions.createPost('게스트 모집인데 정보는 안 적음', '게스트 모집', { when: '', place: '', cap: '' });
      ok(a.ok, '글 저장');
      eq(a.meet, null, '모집 정보 없음');
      eq(store.state.data.posts[0].topic, '게스트 모집', '말머리는 게스트 모집');
      eq(store.state.data.posts[0].meet, null, '목록에도 모집 정보 없음');
      excludes(store.state.rows[0][D.COL['훈련계획']], '"meet"', '훈련계획에 meet 없음');

      /* 연타 잠금(1.2초)은 테스트에서 바로 넘깁니다 */
      store.state.locks = {};
      var b = store.actions.createPost('그냥 자유 글', '자유', { when: '11/21', place: '체육관', cap: '4' });
      ok(b.ok, '일반 글도 저장');
      eq(b.meet, null, '자유 글에는 모집 정보를 붙이지 않음');
      eq(store.state.data.posts[0].meet, null, '목록에도 없음');
      return store.flush();
    });
  });

  test('게스트 모집: 예전 글(모집 정보 없음)도 그대로 읽힌다', function () {
    var old = D.fromRow(D.toRow({
      id: 'old-b', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      text: '예전 글', userKey: 'u_other', plan: { topic: '게스트 모집' }
    }));
    eq(D.topicOf(old), '게스트 모집', '말머리 유지');
    eq(D.meetOf(old), null, '모집 정보 없음');
  });

  /* v1.37.2: 말머리 이름이 '번개' → '게스트 모집'으로 바뀌었습니다.
   * 이미 저장된 '번개' 글(말머리·방 이름)도 새 이름으로 읽혀 모집 카드가 그대로 떠야 합니다. */
  test('게스트 모집: 예전 이름(번개)으로 저장된 글도 새 말머리로 읽는다', function () {
    ['번개', '번개 모집', '번개모집'].forEach(function (old) {
      eq(D.normalizeTopic(old), '게스트 모집', '말머리 변환: ' + old);
      eq(D.topicOf({ plan: { topic: old } }), '게스트 모집', '글 말머리: ' + old);
      eq(D.groupTitle({ plan: { topic: old } }), '게스트 모집 단체방', '단체방 이름: ' + old);
    });
    /* 모집 정보가 있는 예전 글도 그대로 카드가 뜹니다 */
    var oldPost = D.fromRow(D.toRow({
      id: 'old-c', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      text: '예전에 올린 글', userKey: 'u_other',
      plan: { topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }
    }));
    eq(D.topicOf(oldPost), '게스트 모집', '예전 글 말머리');
    eq(D.meetOf(oldPost).place, '올림픽체육관', '예전 글 모집 정보');
    var html = BM.views.community.render(stateOf([oldPost]));
    includes(html, 'data-vite-group="old-c"', '예전 글에도 참여 신청 버튼');
    includes(html, 'class="vite__t"', '예전 글에도 모집 카드');
    excludes(html, '번개', '화면에는 옛 이름이 남지 않는다');
    /* 말머리 목록에도 새 이름만 있습니다 */
    ok(D.POST_TOPICS.indexOf('게스트 모집') >= 0, '말머리 목록에 새 이름');
    eq(D.POST_TOPICS.indexOf('번개'), -1, '말머리 목록에 옛 이름 없음');
  });

  /* ---------- 3. 화면 ---------- */
  test('게스트 모집 화면: 말머리가 자유면 입력칸이 접혀 있다', function () {
    var html = BM.views.community.render(stateOf());
    checkHtml(html, '커뮤니티');
    includes(html, 'data-viteform hidden', '자유일 때 모집 입력칸 숨김');
    includes(html, 'data-vitefield="when"', '입력칸은 그려 두고 숨김');
    includes(html, 'data-vitefield="place"', '장소 입력칸');
    includes(html, 'data-vitefield="cap"', '인원 입력칸');
    excludes(html, 'data-vite-group', '일반 글에는 참여 버튼 없음');
  });

  test('게스트 모집 화면: 말머리를 게스트 모집으로 고르면 입력칸이 열리고 값을 기억한다', function () {
    var st = stateOf();
    st.ui.composerTopic = '게스트 모집';
    st.ui.composerMeet = { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' };
    var html = BM.views.community.render(st);
    checkHtml(html, '게스트 모집 작성');
    includes(html, 'data-viteform>', '모집 입력칸 열림');
    includes(html, 'value="11/21(금) 19:00"', '언제 값 유지');
    includes(html, 'value="올림픽체육관"', '장소 값 유지');
    includes(html, 'value="6"', '인원 값 유지');
  });

  /* bm-v1.43.0 — 남의 모집 글 버튼은 '참여 신청'(신청 편지지)이고, 수락 전에는 방에 들어가지 않습니다 */
  test('게스트 모집 화면: 글 카드에 일시·장소·인원과 참여 신청이 보인다', function () {
    var rows = [meetRow({ topic: '게스트 모집', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } })];
    var html = BM.views.community.render(stateOf(rows));
    checkHtml(html, '게스트 모집 글');
    includes(html, 'class="vite"', '모집 카드');
    includes(html, 'class="vite__t"', '모집 카드 제목');
    includes(html, '게스트 모집', '카드 이름');
    includes(html, '11/21(금) 19:00', '일시');
    includes(html, '올림픽체육관', '장소');
    includes(html, '6명', '인원');
    includes(html, 'data-vite-group="bolt-1"', '어느 글인지 함께');
    includes(html, 'data-vite-go="apply"', '참여 신청 버튼');
    includes(html, '>참여 신청<', '버튼 글자');
    excludes(html, '내가 올린 게스트 모집', '남의 글에는 내 글 표시 없음');
  });

  test('게스트 모집 화면: 내가 올린 글은 단체방을 여는 버튼이 된다', function () {
    var rows = [meetRow({ topic: '게스트 모집', meet: { when: '', place: '동네 체육관', cap: '' } }, BM.seed.ME)];
    var html = BM.views.community.render(stateOf(rows));
    checkHtml(html, '내 게스트 모집');
    includes(html, '단체방 열기', '내 글은 단체방 열기');
    includes(html, 'data-vite-group="bolt-1"', '같은 방을 엽니다');
    includes(html, '일시는 문의해서 정해요', '비어 있는 일시 안내');
    includes(html, '동네 체육관', '적은 장소');
  });

  /* ---------- 4. 참여 문의 → 1:1 대화 ---------- */
  test('참여 문의: 대화를 열 때 모집 정보를 담은 문구를 미리 채운다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('게스트 모집');
      store.actions.createPost('금요일 저녁 게스트 모집', '게스트 모집', { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' });
      var post = store.state.data.posts[0];
      var draft = BM.views.community._inquiryDraft(post);
      store.actions.openChat('room_x', 'u_other', draft);
      eq(store.state.ui.chatOpen, true, '대화 열림');
      eq(store.state.ui.chatRoom, 'room_x', '방');
      includes(store.state.ui.chatDraft, '게스트 모집', '말머리가 문구에');
      includes(store.state.ui.chatDraft, '11/21(금)', '일시(날짜)가 문구에');
      includes(store.state.ui.chatDraft, '참여하고 싶어요', '참여 의사');
      ok(store.state.ui.chatDraft.length <= 30, '한 줄 입력창에 들어가는 짧은 문구');
      excludes(store.state.ui.chatDraft, '19:00', '한 줄을 넘지 않게 시간은 생략');
      excludes(store.state.ui.chatDraft, '올림픽체육관', '긴 장소는 문구에서 생략');
      /* 모집 정보가 없는 글이면 인사만 */
      eq(BM.views.community._inquiryDraft({ meet: null }), '게스트 모집 참여하고 싶어요!', '정보 없으면 인사만');
      store.actions.openChat('room_y', 'u_other');
      eq(store.state.ui.chatDraft, '', '문구 없이 열면 빈 입력창');
      return store.flush();
    });
  });

  test('게스트 모집: 새 파일 없이 화면·버전이 v1.11.0으로 맞춰져 있다', function () {
    var hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string';
    if (!hasNode) return;
    var fs = require('fs'), path = require('path');
    var rootDir = root.__REPO_ROOT__;
    var sw = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf8');
    var app = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
    var index = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    ok(/var VERSION = 'bm-v1.70.0'/.test(sw), 'sw.js');
    includes(app, "version: 'v1.70.0'", 'app.js v1.17.0');
    includes(index, 'styles.css?v=20261124-8', 'styles.css 쿼리 갱신');
    includes(index, 'js/routine.js', '루틴 파일 유지');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
