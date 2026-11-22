/* ============================================================
 * test/v140_1.test.js — bm-v1.41.1 (2026-11-21 저녁)
 *
 *  사용자 기획 요청 2건:
 *   1) 게스트 모집에 '게스트비' 적는 칸 (없음·5천원·1만원 빠른 칩, 모집 카드에도 표시)
 *   2) 커뮤니티에 올린 내 글 삭제(취소) — 앱 UI로 한 번 확인한 뒤 글·답글·하트 정리
 *
 *   저장은 새 칸 없이: 게스트비 → '훈련계획' JSON의 meet.fee (26칸·Supabase 그대로),
 *   삭제 → 기존 행 삭제(remove) 큐 그대로.
 *  실행: node test/run.js
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
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_routine_pref_v1::demo_me', 'bm_pro_pref_v1::demo_me'].forEach(function (k) { U.storage.removeItem(k); });
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
    key: BM.seed.ME, nick: '나래', level: '선수부', discipline: '단식',
    theme: { theme: 'th_night', avatar: '🦋', role: 'player' }
  };

  function postRow(opts) {
    opts = opts || {};
    return D.toRow({
      id: opts.id || 'p1', type: '소셜', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '코트지기', text: opts.text || '오늘 경기 좋았어요',
      userKey: opts.userKey || 'u_other', plan: opts.plan || { topic: '자유' }
    });
  }

  function replyRow(target, userKey, id) {
    return D.toRow({
      id: id, type: '답글', createdAt: U.stamp(), date: U.ymd(),
      nick: '길동', userKey: userKey, target: target, text: '답글입니다'
    });
  }

  function likeRow(target, userKey, id) {
    return D.toRow({ id: id, type: '하트', createdAt: U.stamp(), date: U.ymd(), userKey: userKey, target: target, likes: 1 });
  }

  function stateOf(rows, patch) {
    rows = rows || [postRow()];
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, ME.key),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], pain: [], weakness: [], note: '', pro: {} } },
      ui: {
        tab: 'community', chatRoom: null, chatOther: '', chatOpen: false, chatDraft: '',
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '', fee: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k === 'me') st.me = patch.me ? Object.assign({}, copyOf(ME), patch.me) : null;
        else if (k === 'ui') st.ui = Object.assign({}, st.ui, patch.ui);
        else st[k] = patch[k];
      });
    }
    return st;
  }

  function rowsWith(extra) { return [postRow()].concat(extra || []); }

  /* ---------- 1. 게스트비 정리 ---------- */
  test('v1.41.1 게스트비: 값을 다듬고 12자에서 자른다', function () {
    eq(D.normalizeMeet({ fee: '  1만원  ' }).fee, '1만원', '앞뒤 공백 정리');
    eq(D.normalizeMeet({ fee: '1만    원' }).fee, '1만 원', '가운데 공백 한 칸');
    eq(D.normalizeMeet({ fee: '아주아주아주아주긴게스트비이름' }).fee.length, 12, '12자에서 자름');
    eq(D.normalizeMeet({}).fee, '', '안 적으면 빈 값');
    eq(D.normalizeMeet(null).fee, '', 'null 안전');
    eq(D.normalizeMeet({ fee: '없음' }).fee, '없음', "'없음'도 값");
    /* 빠른 칩은 정해 둔 세 가지 */
    eq(D.MEET.feeChips.join(','), '없음,5천원,1만원', '빠른 칩');
    eq(D.MEET.feeLabel, '게스트비', '칸 이름');
  });

  test('v1.41.1 게스트비: 게스트비만 있어도 모집 글로 본다', function () {
    eq(D.meetFilled(D.normalizeMeet({ fee: '1만원' })), true, '게스트비만 채워도 모집 정보');
    eq(D.meetFilled(D.normalizeMeet({ fee: '  ' })), false, '공백만이면 빈 값');
    var post = { plan: { topic: '게스트 모집', meet: { fee: '없음' } } };
    eq(D.meetOf(post).fee, '없음', '글에서 다시 읽기');
    eq(D.meetFeeText({ fee: '1만원' }), '게스트비 1만원', '카드 한 줄');
    eq(D.meetFeeText({ fee: '없음' }), '게스트비 없음', '없음도 그대로');
    eq(D.meetFeeText({}), '', '값이 없으면 빈 줄');
    /* 한 줄 안내는 게스트비까지 담고, 없으면 지금 그대로 */
    eq(D.meetText({ when: '11/21 19:00', place: '체육관', cap: '6', fee: '1만원' }),
      '11/21 19:00 · 체육관 · 6명 · 게스트비 1만원', '게스트비 포함 한 줄');
    eq(D.meetText({ when: '11/21 19:00', place: '체육관', cap: '6' }),
      '11/21 19:00 · 체육관 · 6명', '게스트비 없으면 예전 그대로');
  });

  /* ---------- 2. 저장 (26칸 그대로) ---------- */
  test('v1.41.1 게스트비: 글 저장은 26칸 그대로, 훈련계획 JSON에 fee', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('게스트 모집');
      store.actions.setComposerMeet('when', '11/21(금) 19:00');
      store.actions.setComposerMeet('place', '올림픽체육관');
      store.actions.setComposerMeet('cap', '6');
      store.actions.setComposerMeet('fee', '1만원');
      eq(store.state.ui.composerMeet.fee, '1만원', '입력칸 값 기억');

      var res = store.actions.createPost('금요일 저녁 게스트 모집합니다', '게스트 모집', store.state.ui.composerMeet);
      ok(res.ok, '글 저장');
      eq(res.meet.fee, '1만원', '결과에 게스트비');
      var row = store.state.rows[0];
      eq(row.length, 26, '시트 26칸 그대로');
      includes(row[D.COL['훈련계획']], '"fee":"1만원"', '훈련계획 JSON에 게스트비');
      includes(row[D.COL['훈련계획']], '"meet"', '같은 meet 객체 안');
      eq(store.state.data.posts[0].meet.fee, '1만원', '목록에서 게스트비');
      eq(D.meetOf(D.fromRow(row)).fee, '1만원', '다른 기기에서 다시 읽어도 그대로');
      eq(store.state.ui.composerMeet.fee, '', '올리면 칸 비움');
      return store.flush();
    });
  });

  test('v1.41.1 게스트비: 비워 두어도 등록되고 meet에 fee가 없다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var res = store.actions.createPost('게스트비는 나중에 정할게요', '게스트 모집', { when: '11/22', place: '체육관', cap: '4', fee: '' });
      ok(res.ok, '글 저장');
      includes(store.state.rows[0][D.COL['훈련계획']], '"fee":""', '훈련계획의 fee는 빈 값 (칸은 그대로)');
      eq(store.state.data.posts[0].meet.fee, '', '목록에도 빈 값');
      /* 게스트비만 채운 모집 글도 올라갑니다 (본문 없이) */
      store.state.locks = {};
      var only = store.actions.createPost('', '게스트 모집', { when: '', place: '', cap: '', fee: '5천원' });
      ok(only.ok, '게스트비만으로도 등록');
      eq(only.meet.fee, '5천원', '게스트비 저장');
      return store.flush();
    });
  });

  /* ---------- 3. 화면 ---------- */
  test('v1.41.1 게스트비 화면: 작성 칸에 입력칸과 빠른 칩이 있다', function () {
    var st = stateOf();
    st.ui.composerTopic = '게스트 모집';
    st.ui.composerMeet = { when: '', place: '', cap: '', fee: '5천원' };
    var html = BM.views.community.render(st);
    includes(html, 'data-vitefield="fee"', '게스트비 입력칸');
    includes(html, 'placeholder="없음 또는 1만원"', '안내 문구');
    includes(html, 'value="5천원"', '적은 값 유지');
    ['없음', '5천원', '1만원'].forEach(function (v) {
      includes(html, 'data-vitefee-val="' + v + '"', '빠른 칩: ' + v);
    });
    includes(html, 'data-vitefee-val="5천원" aria-pressed="true"', '적힌 칩은 켜짐');
    includes(html, 'data-vitefee-val="1만원" aria-pressed="false"', '다른 칩은 꺼짐');
    includes(html, '<span>게스트비</span>', '칸 이름표');
    /* 말머리가 자유면 모집 칸 자체가 접혀 있습니다 */
    var free = BM.views.community.render(stateOf());
    includes(free, 'data-viteform hidden', '자유일 때는 접힘');
    eq(free.indexOf('data-vitefee-val') > free.indexOf('data-viteform'), true, '빠른 칩은 접힌 모집 칸 안에만 있음');
  });

  test('v1.41.1 게스트비 화면: 모집 카드에 게스트비 한 줄', function () {
    var rows = [postRow({
      id: 'meet-fee', plan: { topic: '게스트 모집', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6', fee: '1만원' } }
    })];
    var html = BM.views.community.render(stateOf(rows));
    includes(html, 'vite__row--fee', '게스트비 줄');
    includes(html, '게스트비 1만원', '값 표시');
    includes(html, 'vite__fee-ic', '동전 아이콘');
    ok(html.indexOf('게스트비 1만원') > html.indexOf('올림픽체육관'), '장소 줄 아래에 옵니다');

    var none = BM.views.community.render(stateOf([postRow({
      id: 'meet-none', plan: { topic: '게스트 모집', meet: { when: '11/21', place: '체육관', cap: '', fee: '없음' } }
    })]));
    includes(none, '게스트비 없음', "'없음'도 그대로 보여 줌");

    var nofee = BM.views.community.render(stateOf([postRow({
      id: 'meet-nofee', plan: { topic: '게스트 모집', meet: { when: '11/21', place: '체육관', cap: '6' } }
    })]));
    excludes(nofee, 'vite__row--fee', '게스트비가 없으면 줄도 없음');
    excludes(nofee, '게스트비 ', '게스트비 문구도 없음');
  });

  /* ---------- 4. 내 글 삭제(취소) 화면 ---------- */
  test('v1.41.1 내 글: 내 글에만 삭제 버튼과 확인 줄이 붙는다', function () {
    var mine = BM.views.community.render(stateOf([postRow({ id: 'mine-1', userKey: ME.key, nick: '나래' })]));
    includes(mine, 'data-post-del="mine-1"', '내 글 삭제 버튼');
    includes(mine, 'aria-label="내 글 삭제"', '접근성 이름');
    includes(mine, 'data-delbar="mine-1"', '확인 줄');
    includes(mine, 'data-act="post-del-no"', '취소 버튼');
    includes(mine, 'data-act="post-del-yes"', '삭제 버튼');
    includes(mine, 'data-del-post="mine-1"', '어느 글인지');
    includes(mine, '이 글을 삭제할까요?', '확인 문구');
    includes(mine, 'post__delbar" data-delbar="mine-1" hidden', '처음에는 접혀 있음');

    var other = BM.views.community.render(stateOf([postRow({ id: 'other-1', userKey: 'u_other' })]));
    excludes(other, 'data-post-del', '남의 글에는 없음');
    excludes(other, 'data-delbar', '남의 글에는 확인 줄도 없음');

    var guest = BM.views.community.render(stateOf([postRow({ id: 'mine-2', userKey: '' })], { me: null }));
    excludes(guest, 'data-post-del', '로그인 전에는 없음');
  });

  test('v1.41.1 내 글: 브라우저 confirm 대신 앱 안 인라인 확인', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/community.js');
    excludes(src, 'window.confirm', '브라우저 confirm 없음');
    excludes(src, 'confirm(', 'confirm() 없음');
    includes(src, 'post-del-no', '취소 처리');
    includes(src, 'post-del-yes', '삭제 처리');
    includes(src, 'syncFeeChips', '게스트비 칩 동기화');
  });

  /* ---------- 5. 삭제 동작 ---------- */
  test('v1.41.1 삭제: 내 글·내 답글·내 하트를 정리하고 remove를 큐에 넣는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var made = store.actions.createPost('지울 글', '자유');
      ok(made.ok, '글 저장');
      var pid = String(store.state.rows[0][0]);
      store.state.locks = {};
      store.actions.addReply(pid, '내 답글');
      var myReply = store.state.rows.filter(function (r) { return r[1] === '답글'; })[0][0];

      /* 남이 남긴 답글·하트, 다른 글의 답글은 직접 넣어 둡니다 */
      store.state.rows.push(replyRow(pid, 'u_other', 'r-other'));
      store.state.rows.push(likeRow(pid, ME.key, 'h-mine'));
      store.state.rows.push(likeRow(pid, 'u_other', 'h-other'));
      store.state.rows.push(replyRow('p-else', 'u_other', 'r-else'));
      store.state.queue = [];
      store.state.locks = {};

      var res = store.actions.deletePost(pid);
      ok(res.ok, '내 글 삭제');
      eq(res.id, pid, '지운 글');
      eq(store.state.rows.filter(function (r) { return String(r[0]) === pid; }).length, 0, '글 사라짐');
      ['r-other', 'h-mine', 'h-other'].forEach(function (id) {
        eq(store.state.rows.filter(function (r) { return String(r[0]) === id; }).length, 0, '그 글에 달린 줄도 정리: ' + id);
      });
      eq(store.state.rows.filter(function (r) { return String(r[0]) === 'r-else'; }).length, 1, '다른 글의 답글은 그대로');
      eq(store.state.data.posts.length, 0, '목록에서도 사라짐');

      /* 서버에는 내 글·내 답글·내 하트만 (남의 행은 RLS가 막으므로 보내지 않음) */
      var removes = store.state.queue.filter(function (q) { return q.kind === 'remove'; })
        .map(function (q) { return String(q.id); });
      ok(removes.indexOf(pid) >= 0, '내 글 remove');
      ok(removes.indexOf(String(myReply)) >= 0, '내 답글 remove');
      ok(removes.indexOf('h-mine') >= 0, '내 하트 remove');
      ok(removes.indexOf('r-other') < 0, '남의 답글은 서버로 보내지 않음');
      ok(removes.indexOf('h-other') < 0, '남의 하트도 보내지 않음');
      return store.flush();
    });
  });

  test('v1.41.1 삭제: 남의 글·없는 글은 지우지 않는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.state.rows.push(postRow({ id: 'not-mine', userKey: 'u_other' }));
      store.state.locks = {};
      var a = store.actions.deletePost('not-mine');
      eq(a.ok, false, '남의 글 거부');
      eq(a.reason, 'not_mine', '이유');
      eq(store.state.rows.filter(function (r) { return String(r[0]) === 'not-mine'; }).length, 1, '남의 글은 그대로');

      store.state.locks = {};
      var b = store.actions.deletePost('nope');
      eq(b.ok, false, '없는 글');
      eq(b.reason, 'not_found', '이유');
      var c = store.actions.deletePost('');
      eq(c.ok, false, '빈 값도 안전');
      return store.flush();
    });
  });

  test('v1.41.1 삭제: 연타는 잠금으로 한 번만 처리한다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.createPost('연타 글', '자유');
      var pid = String(store.state.rows[0][0]);
      store.state.locks = {};
      store.state.locks['delpost:' + pid] = Date.now() + 1000;
      var res = store.actions.deletePost(pid);
      eq(res.ok, false, '잠금');
      eq(res.reason, 'locked', '이유');
      eq(store.state.rows.filter(function (r) { return String(r[0]) === pid; }).length, 1, '글이 남아 있음');
      store.state.locks = {};
      ok(store.actions.deletePost(pid).ok, '잠금이 풀리면 지워짐');
      return store.flush();
    });
  });

  test('v1.41.1 삭제: 단체방을 열어 두고 지우면 대화도 닫힌다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.createPost('', '게스트 모집', { when: '11/22 19:00', place: '체육관', cap: '6', fee: '1만원' });
      var pid = String(store.state.rows[0][0]);
      store.state.locks = {};
      var open = store.actions.openGroupChat(pid, '');
      ok(open.ok, '단체방 열림');
      eq(store.state.ui.chatOpen, true, '대화 열림');
      store.state.locks = {};
      var res = store.actions.deletePost(pid);
      ok(res.ok, '글 삭제');
      eq(store.state.ui.chatRoom, null, '방 닫힘');
      eq(store.state.ui.chatOpen, false, '대화도 닫힘');
      return store.flush();
    });
  });

  /* ---------- 6. 기존 기능 유지 ---------- */
  test('v1.41.1 유지: 모집 본문 공란 등록 · 하단 고정 저장 바 · 친구 코드', function () {
    if (!hasNode) return;
    var community = readRoot('js/views/community.js');
    includes(community, '비워 두어도 올라가요', '모집 칸만으로 등록 안내');
    includes(community, 'composerHint', '입력칸 안내 전환');
    includes(readRoot('js/views/log.js'), 'submit-wrap savebar', '일지 하단 고정 저장 바');
    includes(readRoot('js/views/chat.js'), '친구 코드', '친구 코드 친추');
    includes(readRoot('js/views/start.js'), 'rolepicks', '시작 4유형');
    includes(readRoot('js/domain.js'), "'상체 근력운동'", '선수 7대 훈련');
  });

  test('v1.40.1 버전: sw.js · app.js · twa-manifest.json이 1.41.1으로 맞는다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.50.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.50.0'", 'app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.50.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.50.0', 'TWA appVersion');
    eq(twa.appVersionCode, 42, 'TWA 버전 코드는 그대로');
    includes(readRoot('index.html'), 'styles.css?v=20261122-62', '스타일 캐시 키');
  });

  test('v1.41.1 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md');
    includes(readme, 'v1.43.0', 'README 버전 절');
    includes(readme, '게스트비', 'README 게스트비 설명');
    includes(readme, '내 글 삭제', 'README 삭제 설명');
    includes(readRoot('ideas.md'), 'bm-v1.43.0', '아이디어 노트 상태');
    includes(readRoot('test/run.js'), 'test/v140_1.test.js', '테스트 실행 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
