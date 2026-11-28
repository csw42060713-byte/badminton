/* ============================================================
 * test/v199.test.js — bm-v1.104.0
 *
 *   승우 님 요청(2026-11-28): "체육관 같은데 후기 올리면 하트 눌러주면 하트 올라가게하는건 어떨까?"
 *   상한 확정: "최대3개"
 *
 *   1) 규칙 — 다른 사람이 내 체육관 후기에 ❤ → 하트 +1
 *             본인 글·본인 좋아요 0 · 같은 사람 같은 후기 1회 · 하루 3개
 *   2) 원장 — 하트 내역('내 후기 좋아요 · 닉네임') · 오늘 얻음 · 오늘 N/3
 *   3) 저장 — 좋아요를 누른 사람 기기에 '후기하트' 행 한 줄 (취소해도 남는다)
 *   4) 화면 — 후기 카드 안내 한 줄 · MY 하트 카드 오늘 N/3
 *   5) 서버 — SQL 파일의 검증 함수·트리거·하루 3개 잔액 계산
 *   6) 보호 — 기존 좋아요 수·답글·커뮤니티·버전 정합
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

  var ME_KEY = BM.seed.ME;               /* 'demo_me' */
  var ME = {
    key: ME_KEY, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  /* ---------- 도우미 ---------- */
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(extra) {
    clearStorage();
    var rows = (extra && extra.empty) ? [] : BM.fixtures.demo();
    (extra && extra.rows ? extra.rows : []).forEach(function (e) { rows.push(D.toRow(e)); });
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function stateOf(rows, meKey) {
    return {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: rows,
      data: BM.store.derive(rows, meKey || ME_KEY), drafts: {}, ui: {},
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* 후기 글이 담긴 행 한 벌 — 글쓴이 · 글 ID · 좋아요(누른 사람)를 마음대로 만듭니다. */
  var DAY = '2026-11-28';
  function reviewPost(id, author, when) {
    return {
      type: '소셜', id: id, userKey: author, nick: '콕집사', date: when || DAY,
      createdAt: (when || DAY) + ' 21:05:00', text: '🏟️ 나래울 배드민턴장',
      plan: { topic: '체육관 후기', gym: { name: '나래울 배드민턴장', floor: '좋아요', light: '좋아요', parking: '', shower: '' } }
    };
  }
  function likeRow(id, liker, author, postId, when, likes) {
    return {
      type: '후기하트', id: id, userKey: liker, nick: '', target: author,
      team: postId, date: when || DAY, createdAt: (when || DAY) + ' 22:10:00',
      likes: likes == null ? 1 : likes
    };
  }
  function plainPost(id, author) {
    return {
      type: '소셜', id: id, userKey: author, nick: '콕집사', date: DAY,
      createdAt: DAY + ' 20:00:00', text: '오늘 클럽 정기전 다녀왔어요.'
    };
  }

  /* ============================================================
   * 1. 규칙 — 누가 · 어떤 글에 · 몇 개까지
   * ============================================================ */

  test('v1.99 규칙: 다른 사람이 내 체육관 후기에 누른 좋아요만 하트 +1', function () {
    eq(D.REVIEW_LIKE.type, '후기하트', '행 유형');
    eq(D.REVIEW_LIKE.gain, 1, '한 번에 +1');
    eq(D.REVIEW_LIKE.perDay, 3, '하루 최대 3개');

    var rows = [reviewPost('p1', ME_KEY)];
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 0, '좋아요 없으면 0');

    rows.push(likeRow('h1', 'demo_chi', ME_KEY, 'p1'));
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 1, '한 사람이 누르면 1');
  });

  test('v1.99 규칙: 본인 글에 본인이 누른 좋아요는 0', function () {
    var rows = [reviewPost('p1', ME_KEY), likeRow('h1', ME_KEY, ME_KEY, 'p1')];
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 0, '본인 좋아요 제외');
    eq(D.heartLedger(D.index(rows), ME_KEY).balance, D.HEART_RULES.BASE, '잔액도 그대로');
  });

  test('v1.99 규칙: 같은 사람이 같은 후기에 취소 후 다시 눌러도 1회', function () {
    var rows = [
      reviewPost('p1', ME_KEY),
      likeRow('h1', 'demo_chi', ME_KEY, 'p1', DAY),
      likeRow('h2', 'demo_chi', ME_KEY, 'p1', DAY),
      likeRow('h3', 'demo_chi', ME_KEY, 'p1', DAY)
    ];
    var idx = D.index(rows);
    eq(D.reviewLikeCredits(idx, ME_KEY).length, 1, '행이 3개여도 1회');
    /* 같은 사람이 다른 후기에 누르면 따로 인정 */
    rows.push(reviewPost('p2', ME_KEY));
    rows.push(likeRow('h4', 'demo_chi', ME_KEY, 'p2', DAY));
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 2, '다른 후기는 따로');
  });

  test('v1.99 규칙: 하루 최대 3개 — 넷째부터는 좋아요 수만 오르고 하트는 안 온다', function () {
    var rows = [reviewPost('p1', ME_KEY)];
    ['demo_chi', 'demo_foot', 'demo_net', 'demo_drive', 'demo_koala'].forEach(function (who, i) {
      rows.push(likeRow('h' + i, who, ME_KEY, 'p1', DAY));
    });
    var idx = D.index(rows);
    var credits = D.reviewLikeCredits(idx, ME_KEY);
    eq(credits.length, 3, '하루 3개까지');
    eq(credits[0].userKey, 'demo_chi', '먼저 누른 사람부터');
    eq(D.heartLedger(idx, ME_KEY).balance, D.HEART_RULES.BASE + 3, '잔액 +3');

    /* 다음 날 새로 누른 사람의 좋아요는 다시 3개까지 인정 */
    rows.push(likeRow('n1', 'demo_clear', ME_KEY, 'p1', '2026-11-29'));
    rows.push(likeRow('n2', 'demo_suttle', ME_KEY, 'p1', '2026-11-29'));
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 5, '날짜가 바뀌면 다시');
    /* 같은 사람이 같은 후기에 다음 날 또 눌러도 늘지 않는다(사람·글당 1회) */
    rows.push(likeRow('n3', 'demo_chi', ME_KEY, 'p1', '2026-11-29'));
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 5, '같은 사람·같은 글은 그대로');
  });

  test('v1.99 규칙: 하루 3개 제한은 후기 주인 날짜 기준 — 남의 원장에는 안 잡힌다', function () {
    var rows = [
      reviewPost('p1', ME_KEY),
      likeRow('h1', 'demo_chi', ME_KEY, 'p1', DAY),
      likeRow('h2', 'demo_foot', 'demo_bear', 'p9', DAY)   /* 다른 사람 후기(내 원장 아님) */
    ];
    var idx = D.index(rows);
    eq(D.reviewLikeCredits(idx, ME_KEY).length, 1, '내 후기에 온 것만');
    eq(D.reviewLikeCredits(idx, 'demo_bear').length, 1, '그 사람 후기에 온 것은 그 사람 몫');
  });

  test('v1.99 규칙: likes 가 0 인 행(서버가 검증에서 걸러 남긴 줄)은 세지 않는다', function () {
    var rows = [reviewPost('p1', ME_KEY), likeRow('h1', 'demo_chi', ME_KEY, 'p1', DAY, 0)];
    eq(D.reviewLikeCredits(D.index(rows), ME_KEY).length, 0, '0개 행 제외');
  });

  /* ============================================================
   * 2. 원장 — 내역 · 오늘 얻음 · 오늘 N/3
   * ============================================================ */

  test('v1.99 원장: "내 후기 좋아요 · 닉네임" 한 줄로 남고 오늘 얻음에 들어간다', function () {
    var today = U.ymd();
    var before = D.heartLedger(D.index(BM.fixtures.demo()), ME_KEY);
    var rows = BM.fixtures.demo().concat([
      reviewPost('p1', ME_KEY, today),
      likeRow('h1', 'demo_chi', ME_KEY, 'p1', today),      /* 행에 닉네임이 비면 프로필에서 */
      likeRow('h2', 'demo_foot', ME_KEY, 'p1', today)
    ]);
    var idx = D.index(rows);
    var ledger = D.heartLedger(idx, ME_KEY);
    var lines = ledger.history.filter(function (h) { return h.kind === 'review-like'; });
    eq(lines.length, 2, '두 줄');
    eq(lines[0].label, '내 후기 좋아요', '이름');
    eq(lines[0].delta, 1, '+1');
    ok(!!lines[0].note, '누른 사람 닉네임이 붙는다');
    eq(ledger.earned, before.earned + 2, '적립 합계 +2');

    var st = D.heartStatus(idx, ME_KEY);
    eq(st.balance, before.balance + 2, '잔액 +2');
    eq(st.todayEarned, 2, '오늘 얻음');
    eq(st.reviewLike.today, 2, '오늘 후기 좋아요');
    eq(st.reviewLike.perDay, 3, '상한');
    eq(st.reviewLike.remaining, 1, '남은 수');
  });

  test('v1.99 원장: 오늘 3개를 채우면 남은 수 0', function () {
    var today = U.ymd();
    var rows = [reviewPost('p1', ME_KEY, today)];
    ['demo_chi', 'demo_foot', 'demo_net'].forEach(function (who, i) {
      rows.push(likeRow('h' + i, who, ME_KEY, 'p1', today));
    });
    var st = D.heartStatus(D.index(rows), ME_KEY);
    eq(st.reviewLike.today, 3, '3개');
    eq(st.reviewLike.remaining, 0, '남은 수 0');
  });

  /* ============================================================
   * 3. 저장 — 좋아요를 누르면 행 한 줄
   * ============================================================ */

  test('v1.99 저장: 남의 체육관 후기에 ❤ → 후기하트 행 한 줄 (좋아요 수 +1)', function () {
    return freshStore({ empty: true, rows: [reviewPost('gp1', 'demo_chi')] }).then(function (store) {
      var me = store.state.me && store.state.me.key;
      var res = store.actions.toggleLike('gp1');
      eq(res.ok, true, '좋아요 성공');
      eq(res.liked, true, '좋아요 상태');
      eq(res.reviewHeart && res.reviewHeart.given, true, '후기 주인에게 하트');
      eq(store.state.data.posts[0].likes, 1, '좋아요 수 1');
      var rows = store.state.rows.map(D.fromRow).filter(function (r) { return r.type === '후기하트'; });
      eq(rows.length, 1, '행 1개');
      eq(rows[0].target, 'demo_chi', '대상 = 후기 주인');
      eq(rows[0].team, 'gp1', '팀 = 글 ID');
      eq(rows[0].userKey, me, '쓴 사람 = 누른 사람');
      eq(rows[0].likes, 1, '1개');
      return store.flush();
    });
  });

  test('v1.99 저장: 좋아요를 취소해도 받은 하트는 남는다 (다시 눌러도 또 오르지 않음)', function () {
    return freshStore({ empty: true, rows: [reviewPost('gp1', 'demo_chi')] }).then(function (store) {
      store.actions.toggleLike('gp1');
      store.state.locks = {};                          /* 연타 잠금 해제(테스트는 즉시 다음 탭) */
      var off = store.actions.toggleLike('gp1');       /* 취소 */
      eq(off.liked, false, '취소');
      eq(store.state.data.posts[0].likes, 0, '좋아요 수 0');
      var keeps = store.state.rows.map(D.fromRow).filter(function (r) { return r.type === '후기하트'; });
      eq(keeps.length, 1, '후기하트 행은 그대로');
      store.state.locks = {};
      var again = store.actions.toggleLike('gp1');     /* 다시 좋아요 */
      eq(again.reviewHeart && again.reviewHeart.given, false, '두 번째는 하트 없음');
      eq(again.reviewHeart.reason, 'already', '이미 준 것으로 판단');
      eq(store.state.rows.map(D.fromRow).filter(function (r) { return r.type === '후기하트'; }).length, 1, '행도 1개');
      return store.flush();
    });
  });

  test('v1.99 제외: 내 후기·일반 글에는 하트가 가지 않는다', function () {
    return freshStore({
      empty: true,
      rows: [reviewPost('mine1', ME_KEY), plainPost('plain1', 'demo_chi')]
    }).then(function (store) {
      var mine = store.actions.toggleLike('mine1');
      eq(mine.reviewHeart && mine.reviewHeart.given, false, '내 후기');
      eq(mine.reviewHeart.reason, 'self', '이유 = 본인 글');
      var plain = store.actions.toggleLike('plain1');
      eq(plain.reviewHeart && plain.reviewHeart.given, false, '일반 글');
      eq(plain.reviewHeart.reason, 'not_review', '이유 = 후기 아님');
      var rows = store.state.rows.map(D.fromRow).filter(function (r) { return r.type === '후기하트'; });
      eq(rows.length, 0, '행이 생기지 않는다');
      eq(store.state.data.hearts.balance, D.HEART_RULES.BASE, '내 잔액 그대로');
      return store.flush();
    });
  });

  /* ============================================================
   * 4. 화면 — 후기 카드 한 줄 · MY 하트 카드
   * ============================================================ */

  test('v1.99 화면: 후기 카드에 하트 안내가 한 줄 붙는다', function () {
    var rows = [reviewPost('gp1', 'demo_chi')];
    var state = stateOf(rows);
    var post = state.data.posts[0];
    var card = BM.views.community._gymReviewCard(post, state);
    includes(card, 'gymreview__hb', '안내 줄');
    includes(card, '이 후기 주인에게 하트 +1', '남의 후기 안내');
    includes(card, 'gymreview__rows', '기존 네 칸 그대로');

    /* 내 후기면 오늘 받은 수(N/3) — 글·좋아요 모두 오늘 날짜로 만들어야 '오늘 N/3'에 잡힌다 */
    var today = U.ymd();
    var mine = stateOf([reviewPost('gp2', ME_KEY, today), likeRow('h1', 'demo_chi', ME_KEY, 'gp2', today)]);
    var mineCard = BM.views.community._gymReviewCard(mine.data.posts[0], mine);
    includes(mineCard, '오늘 1/3', '내 후기 오늘 받은 수');
    includes(mineCard, '좋아요를 받으면 하트 +1', '내 후기 안내');
  });

  test('v1.99 화면: MY 하트 카드에 오늘 후기 좋아요 N/3 한 줄', function () {
    var today = U.ymd();
    var rows = BM.fixtures.demo().concat([
      D.toRow(reviewPost('gp1', ME_KEY, today)),
      D.toRow(likeRow('rh1', 'demo_chi', ME_KEY, 'gp1', today))
    ]);
    var state = stateOf(rows);
    var html = BM.views.my.render(state);
    includes(html, 'data-review-line', 'MY 하트 카드 줄');
    includes(html, '내 체육관 후기 ❤️ 좋아요 = 하트 +1', '안내 문구');
    includes(html, '오늘 1/3', '오늘 받은 수');

    /* 3개를 채운 상태에서는 '다 찼어요' */
    var full = rows.concat([
      D.toRow(likeRow('rh2', 'demo_foot', ME_KEY, 'gp1', today)),
      D.toRow(likeRow('rh3', 'demo_net', ME_KEY, 'gp1', today))
    ]);
    includes(BM.views.my.render(stateOf(full)), '오늘 3개로 다 찼어요', '다 찼을 때');
  });

  test('v1.99 화면: 좋아요를 눌러 하트가 전해지면 토스트로 알려 준다', function () {
    var js = readRoot('js/views/community.js');
    includes(js, "reviewHeart.given", '전해졌을 때만');
    includes(js, '후기 주인에게 하트 +1을 전했어요', '토스트 문구');
    includes(readRoot('js/store.js'), 'function reviewLikeGrant', '보상은 저장소가');
  });

  /* ============================================================
   * 5. 서버 — SQL 파일
   * ============================================================ */

  test('v1.99 서버: 검증 함수 · INSERT 지킴이 · 하루 3개 잔액 계산이 한 파일에 있다', function () {
    if (!hasNode) return;
    var sql = readRoot('supabase/heart-rpc-v1.99-review-like.sql');
    includes(sql, 'public.bm_review_like_ok(', '검증 함수');
    includes(sql, "p.type = '소셜'", '진짜 글인지');
    includes(sql, "p.plan ? 'gym'", '체육관 후기인지');
    includes(sql, 'p_user <> p_target', '본인 글 제외');
    includes(sql, "q.type = '후기하트'", '중복 확인');
    includes(sql, 'trg_bm_review_like_guard', 'INSERT 지킴이');
    includes(sql, 'new.date := public.bm_kst_day(now())', '날짜를 서버가 다시 찍음');
    includes(sql, 'new.likes := case when v_ok then 1 else 0 end', '적립값은 1/0');
    includes(sql, "r.type = '후기하트'", '잔액에 후기 하트');
    includes(sql, 'c.rn <= 3', '하루 3개');
    includes(sql, "type = '선물하트' and target = p_key", '기존 적립 항목(선물 받음) 보존');
    includes(sql, "type = '꾸미기구매' and user_key = p_key", '기존 사용 항목(꾸미기) 보존');
    includes(sql, "type = '출석하트' and user_key = p_key", '기존 출석 보존');

    /* 앱(js/domain.js)과 서버가 같은 규칙을 쓴다 */
    var dom = readRoot('js/domain.js');
    includes(dom, 'REVIEW_LIKE.perDay', '앱도 하루 3개');
    includes(dom, 'REVIEW_LIKE.type', '같은 행 이름');
  });

  /* ============================================================
   * 6. 보호 — 기존 기능 · 버전
   * ============================================================ */

  test('v1.99 보호: 기존 좋아요·답글·커뮤니티 화면은 그대로', function () {
    var rows = BM.fixtures.demo();
    var state = stateOf(rows);
    var html = BM.views.community.render(state);
    includes(html, 'data-like=', '좋아요 버튼');
    includes(html, 'data-toggle-reply=', '답글 버튼');
    /* 글 좋아요 수 = 예전 그대로(후기하트는 좋아요 수에 안 섞인다) */
    var post = state.data.posts.filter(function (p) { return p.userKey === 'demo_chi'; })[0];
    ok(post.likes >= 1, '기존 좋아요 수 유지');
    var js = readRoot('js/store.js');
    includes(js, "type: '하트', id: U.uid()", '좋아요 행은 예전 그대로');
    /* 신고·차단·삭제 동선 그대로 */
    includes(js, "type === '답글' || rec.type === '하트'", '삭제 시 함께 정리');
  });

  test('v1.99 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var push = readRoot('js/push.js');
    includes(sw, "var VERSION = 'bm-v1.104.0'", 'sw.js');
    includes(app, "version: 'v1.104.0'", 'app.js');
    includes(push, "version: 'v1.104.0'", 'push.js');
    includes(index, 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.104.0', 'TWA 이름');
    eq(twa.appVersion, '1.104.0', 'TWA appVersion');
    eq(twa.appVersionCode, 98, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.104.0', 'README');
    includes(readRoot('test/run.js'), 'test/v199.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
