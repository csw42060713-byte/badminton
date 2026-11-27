/* ============================================================
 * test/v179.test.js — bm-v1.87.0
 *   💛 매칭 응원 하트 1개 · ⚡ 지난 운동 그대로 채우기 · 🏟️ 체육관 후기
 *
 *  1) 응원 — 매칭 카드·프로필 시트의 1하트 응원이 기존 store.giftHeart(서버 RPC
 *     heart_spend 'gift')만 타고, 하트가 모자라면 공용 충전 시트로 이어진다
 *  2) 응원 — 실제로 1개만 빠지고 상대에게 1개가 남는다(원장 그대로)
 *  3) 채우기 — 직전 일지의 운동 시간·컨디션·강도·약점만 초안에 채운다
 *  4) 채우기 — 직전 일지가 없으면 버튼을 그리지 않고, 지난 일지 수정 중에는 그 앞 일지
 *  5) 후기 — '체육관 후기' 말머리·네 칸(바닥·조명·주차·샤워)·글 본문이 시트 26칸 그대로
 *  6) 후기 — 목록에서 '체육관 후기' 칩으로 모아 보고, 글에는 후기 카드가 붙는다
 *  7) 안전 — 후기 글자·체육관 이름은 HTML로 실행되지 않고 실존 선수 이름이 없다
 *  8) 버전 · 보호 — sw · app · 스타일 캐시 · TWA · README · 테스트 목록, 탭 5개 · 시트 26칸
 *
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

  function emptyDraft() {
    return {
      date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
      gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
      pain: [], weakness: [], note: '', partner: '', rival: '', video: '', videoNote: '', pro: {}
    };
  }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: emptyDraft() },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        matchTab: 'find', matchStarted: false, matchSort: 'score',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유',
        composerMeet: { when: '', place: '', cap: '', fee: '' },
        composerGym: { name: '', floor: '', light: '', parking: '', shower: '' },
        editLogId: null, replyTo: null
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

  /* 사용자가 보는 문구에 나오면 안 되는 것들 */
  var HARD = ['OR ', 'p <', 'GIRD', 'HRmax', 'ACWR', 'RPE', '모멘트', '생체역학', '내회전', '외회전'];

  function banText(text, where) {
    HARD.forEach(function (w) {
      excludes(text, w, where + ' → "' + w + '" 없음');
    });
  }

  /* ============================================================
   * 1. 응원 — 같은 하트 통로(store.giftHeart → heart_spend 'gift')
   * ============================================================ */

  test('v1.79 응원: 매칭 카드·프로필 시트에 응원 하트 1개 버튼이 있다', function () {
    var state = stateOf();
    var player = state.data.matchProfiles.filter(function (p) { return p.userKey !== BM.seed.ME; })[0];
    var card = BM.views.matching.playerCard(player, state);
    includes(card, 'data-cheer="' + player.userKey + '"', '카드의 응원 버튼');
    includes(card, '응원', '버튼 글자');
    includes(card, 'data-open-profile="' + player.userKey + '"', '카드에서 프로필 열기 그대로');
    var profile = BM.views.matching.profileBody(state, player);
    includes(profile, 'data-cheer-sheet="' + player.userKey + '"', '프로필 시트의 응원 하트');
    includes(profile, '응원 하트', '시트 문구');
    banText(profile, '프로필 시트');
  });

  test('v1.79 응원: 매칭 코드에 매칭 신청(2하트)과 다른 1하트 응원 흐름이 있다', function () {
    if (!hasNode) return;
    var code = readRoot('js/views/matching.js');
    includes(code, 'function cheerSend(', '응원 보내기 함수');
    includes(code, 'ctx.actions.giftHeart(', '기존 store.giftHeart 재사용');
    includes(code, 'openHeartSheet(ctx, p.userKey, {', '모자라면 공용 충전 시트');
    includes(code, "continueLabel: p.nick + '님에게 응원 보내기'", '채운 뒤 그 자리에서 다시 응원');
    /* 하트 차감은 서버 RPC 하나(기존 그대로) — 새 적립/차감 경로를 만들지 않는다 */
    var store = readRoot('js/store.js');
    includes(store, "rpc('heart_spend', { p_kind: 'gift', p_target: targetKey })", '서버 RPC gift');
    eq(D.HEART_RULES.GIFT_COST, 1, '응원은 하트 1개');
    eq(D.HEART_RULES.MATCH_COST, 2, '1:1 매칭은 그대로 2개');
    excludes(code, "rpc('heart_reward'", '클라이언트에서 새 적립 RPC를 부르지 않는다');
  });

  test('v1.79 응원: 실제로 하트 1개만 빠지고 상대 원장에 1개가 남는다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      var target = 'demo_chi';
      var res = store.actions.giftHeart(target);
      ok(res && res.ok, '응원 보내기');
      eq(store.state.data.hearts.balance, before - 1, '보낸 쪽 -1');
      var row = store.state.rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return r.type === '선물하트' && r.userKey === BM.seed.ME && r.target === target; })
        .pop();
      ok(row, '선물하트 행이 남는다');
      eq(Number(row.likes), 1, '행에는 1개');
      var theirs = D.heartStatus(store.state.idx, target, 0);
      ok(theirs.balance >= 1, '상대 잔액에 반영: ' + theirs.balance);
      /* 연속으로 보내도 한 번에 1개 */
      store.state.locks = {};
      var again = store.actions.giftHeart(target);
      ok(again && again.ok, '두 번째 응원');
      eq(store.state.data.hearts.balance, before - 2, '또 1개');
      return store.flush();
    });
  });

  test('v1.79 응원: 하트가 모자라면 서버·저장소가 hearts로 돌려주고 화면은 충전 시트를 연다', function () {
    return freshStore().then(function (store) {
      /* 8개를 모두 써서 0개로 */
      for (var i = 0; i < 8; i++) {
        store.state.locks = {};
        ok(store.actions.giftHeart('demo_koala').ok, '선물 ' + (i + 1));
      }
      eq(store.state.data.hearts.balance, 0, '잔액 0');
      store.state.locks = {};
      var res = store.actions.giftHeart('demo_chi');
      eq(res.ok, false, '보낼 수 없다');
      eq(res.reason, 'hearts', '이유는 하트 부족(토스트가 아니라 충전으로 이어짐)');
      if (hasNode) {
        var code = readRoot('js/views/matching.js');
        includes(code, "if ((hearts.balance || 0) < need) { charge(); return null; }", '누르기 전에 잔액을 보고 충전 시트');
        includes(code, "if (res.reason === 'hearts') { charge(); return res; }", '서버가 모자라다고 하면 충전 시트');
      }
      /* 출석 한 번이면 다시 보낼 수 있다 */
      store.state.locks = {};
      return Promise.resolve(store.actions.checkIn()).then(function (ci) {
        ok(ci && ci.ok, '출석으로 하트 채우기');
        store.state.locks = {};
        var after = store.actions.giftHeart('demo_chi');
        ok(after && after.ok, '채운 뒤 응원 성공');
        return store.flush();
      });
    });
  });

  /* ============================================================
   * 2. 일지 — ⚡ 지난 운동 그대로 채우기
   * ============================================================ */

  test('v1.79 채우기: 직전 일지의 시간·컨디션·강도·약점만 골라 채운다', function () {
    var rec = {
      id: 'r1', date: '2026-11-25', minutes: 75, cond: 6, intensity: 7,
      weakness: ['풋워크', '스매시'], done: ['스트록'], pain: ['무릎'],
      games: [{ a: 21, b: 18 }], note: '메모', partner: '민호', rival: '지호'
    };
    var patch = BM.views.log.fillPatchOf(rec);
    eq(patch.minutes, 75, '운동 시간');
    eq(patch.cond, 6, '컨디션');
    eq(patch.intensity, 7, '강도');
    eq(patch.weakness.join(','), '풋워크,스매시', '약점 칩');
    eq(patch.done, undefined, '완료 훈련은 건드리지 않는다');
    eq(patch.pain, undefined, '아픈 부위는 그대로');
    eq(patch.games, undefined, '게임 점수는 그대로');
    eq(patch.note, undefined, '메모는 그대로');
    eq(patch.partner, undefined, '파트너는 그대로');
    eq(patch.date, undefined, '날짜는 오늘 그대로');
  });

  test('v1.79 채우기: 비어 있는 값은 채우지 않고, 채울 게 없으면 버튼도 없다', function () {
    var patch = BM.views.log.fillPatchOf({ id: 'x', date: '2026-11-20' });
    eq(Object.keys(patch).length, 0, '빈 일지에서는 채울 값 없음');
    var state = stateOf([], { data: { records: [{ id: 'x', date: '2026-11-20', done: ['스트록'] }] } });
    eq(BM.views.log.quickFillBar(state), '', '채울 값이 없으면 버튼 숨김');
    var none = stateOf([], { data: { records: [] } });
    eq(BM.views.log.quickFillBar(none), '', '직전 일지가 없으면 버튼 숨김');
  });

  test('v1.79 채우기: 지난 일지를 고치는 중이면 그 일지가 아니라 그 앞 일지에서 가져온다', function () {
    var rows = BM.fixtures.demo();
    var state = stateOf(rows);
    var first = state.data.records[0], second = state.data.records[1];
    ok(first && second, '일지가 둘 이상');
    eq(BM.views.log.lastFillSource(state).id, first.id, '보통은 최신 일지');
    eq(BM.views.log.lastFillSource(Object.assign({}, state, { ui: Object.assign({}, state.ui, { editLogId: first.id }) })).id,
      second.id, '수정 중인 일지는 건너뛴다');
    var bar = BM.views.log.quickFillBar(state);
    includes(bar, '⚡', '번개 아이콘');
    includes(bar, '지난 운동 그대로 채우기', '버튼 글자');
    includes(bar, 'data-act="quick-fill"', '누르면 채우기');
  });

  test('v1.79 채우기: 저장한 일지 → 채우기 → 저장이 한 번에 이어진다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setDraft({
        minutes: 60, cond: 8, intensity: 6, weakness: ['풋워크'], note: '첫 일지', done: ['스트록']
      });
      var saved = store.actions.saveLog();
      ok(saved && saved.ok, '첫 일지 저장');
      var rec = store.state.data.records[0];
      ok(rec && rec.minutes === 60, '저장된 60분');

      /* 다음 날 화면처럼 초안을 비운 뒤, 버튼이 보여 주는 값 그대로 채웁니다 */
      store.actions.resetDraft();
      var bar = BM.views.log.quickFillBar(store.state);
      includes(bar, '지난 운동 그대로 채우기', '버튼이 보인다');
      includes(bar, '60분', '지난 운동 시간 안내');
      var patch = BM.views.log.fillPatchOf(BM.views.log.lastFillSource(store.state));
      store.actions.setDraft(patch);
      eq(store.state.drafts.log.minutes, 60, '시간이 채워졌다');
      eq(store.state.drafts.log.cond, 8, '컨디션');
      eq(store.state.drafts.log.intensity, 6, '강도');
      eq((store.state.drafts.log.weakness || []).join(','), '풋워크', '약점');
      eq(store.state.drafts.log.note, '', '메모는 비어 있다(그대로 둠)');
      eq(store.state.drafts.log.date, U.ymd(), '날짜는 오늘');
      store.actions.setDraft({ minutes: 70 });
      store.state.locks = {};
      var second = store.actions.saveLog();
      ok(second && second.ok, '고쳐서 저장');
      eq(store.state.data.records[0].minutes, 70, '고친 값으로 저장');
      return store.flush();
    });
  });

  /* ============================================================
   * 3. 체육관 후기 — 말머리 · 네 칸
   * ============================================================ */

  test('v1.79 후기: 말머리 목록에 체육관 후기가 들어오고 기존 말머리는 그대로다', function () {
    includes(D.POST_TOPICS.join('|'), '체육관 후기', '새 말머리');
    ['자유', '후기', '게스트 모집', '용품', '일지'].forEach(function (t0) {
      includes(D.POST_TOPICS.join('|'), t0, '기존 말머리: ' + t0);
    });
    eq(D.normalizeTopic('체육관 후기'), '체육관 후기', '정규화');
    eq(D.normalizeTopic('체육관후기'), '자유', '모르는 값은 자유');
    eq(D.GYM_REVIEW.scale.join(','), '좋아요,보통,아쉬워요', '세 칸 중 하나');
    eq(D.GYM_REVIEW.fields.map(function (f) { return f.label; }).join(','), '바닥,조명,주차,샤워', '네 칸');
  });

  test('v1.79 후기: 네 칸 값을 정리하고 한 줄로 읽는다', function () {
    var g = D.normalizeGymReview({ name: '  나래울 배드민턴장 ', floor: '좋아요', light: '보통', parking: '아쉬워요', shower: '몰라요' });
    eq(g.name, '나래울 배드민턴장', '이름 정리');
    eq(g.floor, '좋아요', '바닥');
    eq(g.parking, '아쉬워요', '주차');
    eq(g.shower, '', '목록에 없는 값은 버린다');
    eq(D.gymReviewText(g), '바닥 좋아요 · 조명 보통 · 주차 아쉬워요', '한 줄 요약');
    ok(D.gymReviewFilled(g), '적은 값이 있다');
    ok(!D.gymReviewFilled(D.normalizeGymReview(null)), '비어 있으면 없음');
    var body = D.gymReviewBody(g, '조명이 밝고 바닥이 미끄럽지 않아요');
    includes(body, '🏟️ 나래울 배드민턴장', '본문 첫 줄에 체육관');
    includes(body, '바닥 좋아요', '본문 둘째 줄에 네 칸');
    includes(body, '미끄럽지 않아요', '사람이 쓴 한 줄');
    ok(body.length <= 300, '본문 300자 안');
  });

  test('v1.79 후기: 글을 올리면 훈련계획 칸 JSON에 담기고 목록 말머리도 체육관 후기다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setComposerTopic('체육관 후기');
      store.actions.setComposerGym('name', '나래울 배드민턴장');
      store.actions.setComposerGym('floor', '좋아요');
      store.actions.setComposerGym('light', '보통');
      store.actions.setComposerGym('parking', '아쉬워요');
      store.actions.setComposerGym('shower', '좋아요');
      var res = store.actions.createPost('주차는 좁지만 코트는 좋아요', store.state.ui.composerTopic, null, store.state.ui.composerGym);
      ok(res.ok, '후기 글 저장');
      eq(res.topic, '체육관 후기', '말머리');
      var row = store.state.rows[0];
      var plan = JSON.parse(row[D.COL['훈련계획']]);
      eq(plan.topic, '체육관 후기', '훈련계획 JSON 말머리');
      eq(plan.gym.name, '나래울 배드민턴장', '체육관 이름');
      eq(plan.gym.floor, '좋아요', '바닥');
      eq(plan.gym.parking, '아쉬워요', '주차');
      includes(row[D.COL['소셜글']], '🏟️ 나래울 배드민턴장', '본문에 체육관 이름');
      includes(row[D.COL['소셜글']], '바닥 좋아요', '본문에 네 칸');
      eq(store.state.ui.composerTopic, '자유', '올린 뒤 말머리 초기화');
      eq(store.state.ui.composerGym.name, '', '올린 뒤 후기 칸 초기화');
      var post = store.state.data.posts[0];
      eq(post.topic, '체육관 후기', '목록 말머리');
      eq(D.topicOf(post), '체육관 후기', '다시 읽은 말머리');
      eq(D.gymReviewOf(post).light, '보통', '화면이 읽는 후기 값');
      eq(D.COLS.length, 26, '시트 26칸 그대로');
      return store.flush();
    });
  });

  test('v1.79 후기: 체육관 이름만 적어도 올라가고, 일반 말머리면 후기 칸을 쓰지 않는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      eq(store.actions.createPost('', '체육관 후기', null, { name: '', floor: '', light: '', parking: '', shower: '' }).reason,
        'empty', '아무것도 안 적으면 막는다');
      var only = store.actions.createPost('', '체육관 후기', null, { name: '칠보체육관', floor: '', light: '', parking: '', shower: '' });
      ok(only.ok, '이름만으로 올라간다');
      eq(only.gym.name, '칠보체육관', '이름 저장');
      includes(store.state.rows[0][D.COL['소셜글']], '칠보체육관', '본문에 이름');
      store.state.locks = {};
      var free = store.actions.createPost('오늘 후기', '자유', null, { name: '무시될 이름', floor: '좋아요' });
      ok(free.ok, '자유 글도 그대로');
      eq(free.gym, null, '자유 말머리에는 후기 정보가 붙지 않는다');
      eq(D.gymReviewOf(store.state.data.posts[0]), null, '후기 없는 글');
      return store.flush();
    });
  });

  /* ============================================================
   * 4. 체육관 후기 — 화면
   * ============================================================ */

  test('v1.79 후기 화면: 작성 칸은 말머리를 고를 때만 열리고 네 칸 칩이 있다', function () {
    var state = stateOf();
    var html = BM.views.community.render(state);
    includes(html, 'data-topic="체육관 후기"', '작성 말머리 칩');
    includes(html, 'data-topicfilter="체육관 후기"', '목록 거르기 칩');
    includes(html, 'data-gymform', '후기 칸');
    var closed = BM.views.community._gymFields('자유', state);
    includes(closed, 'data-gymform hidden', '다른 말머리에서는 접힘');
    var open = BM.views.community._gymFields('체육관 후기', state);
    excludes(open, 'data-gymform hidden', '후기를 고르면 열림');
    ['floor', 'light', 'parking', 'shower'].forEach(function (k) {
      includes(open, 'data-gympick="' + k + '"', '칸: ' + k);
    });
    includes(open, 'data-gymfield="name"', '체육관 이름 칸');
    eq((open.match(/data-gympick="/g) || []).length, 12, '네 칸 × 세 선택 = 칩 12개');
    banText(open, '후기 작성 칸');
  });

  test('v1.79 후기 화면: 글에 후기 카드가 붙고 목록에서 그 말머리로 모아 볼 수 있다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.createPost('조명이 밝아요', '체육관 후기', null,
        { name: '나래울 배드민턴장', floor: '좋아요', light: '좋아요', parking: '아쉬워요', shower: '' });
      var state = store.state;
      var html = BM.views.community.render(state);
      includes(html, 'data-gymreview=', '후기 카드');
      includes(html, '분류', '작성 카드 그대로');
      includes(html, 'pill--ghost post__topic', '글마다 말머리');
      var card = BM.views.community._gymReviewCard(state.data.posts[0]);
      includes(card, 'gymreview__rows', '네 칸 줄');
      includes(card, '나래울 배드민턴장', '체육관 이름');
      includes(card, '바닥', '바닥 칸');
      includes(card, '주차', '주차 칸');
      excludes(card, '샤워', '비운 칸은 그리지 않는다');
      includes(card, 'gymrow--good', '좋아요 색');
      includes(card, 'gymrow--bad', '아쉬워요 색');
      /* 말머리 거르기 — 후기 글만 모인다 */
      eq(BM.views.community._setTopicFilter('체육관 후기'), '체육관 후기', '거르기');
      var only = BM.views.community._visiblePosts(store.state);
      eq(only.length, 1, '후기 글 1건');
      eq(only[0].topic, '체육관 후기', '그 글');
      BM.views.community._setTopicFilter('전체');
      return store.flush();
    });
  });

  /* ============================================================
   * 5. 안전 — 글자는 글자로만, 실존 선수 이름 없음
   * ============================================================ */

  test('v1.79 안전: 후기 글자·체육관 이름은 HTML로 실행되지 않는다', function () {
    var post = {
      id: 'p1', nick: '나래', userKey: BM.seed.ME, likes: 0, replies: [], createdAt: U.nowStamp ? U.nowStamp() : '',
      text: '<img src=x onerror=alert(1)>', topic: '체육관 후기',
      plan: { topic: '체육관 후기', gym: { name: '<script>alert(2)</script>', floor: '좋아요', light: '', parking: '', shower: '' } }
    };
    var card = BM.views.community._gymReviewCard(post);
    excludes(card, '<script>alert(2)', '태그가 그대로 들어가지 않는다');
    includes(card, '&lt;script&gt;', '글자로만 보인다');
    var body = D.gymReviewBody({ name: '<b onmouseover=1>', floor: '좋아요' }, '');
    ok(body.indexOf('<b onmouseover=1>') >= 0, '본문은 저장 글자 그대로(그리는 쪽에서 이스케이프)');
    var state = stateOf();
    var html = BM.views.community.render(state);
    excludes(html, '<img src=x', '화면에도 태그가 그대로 나가지 않는다');
  });

  test('v1.79 실명: 코드·화면 어디에도 실존 선수 이름이 없다', function () {
    if (!hasNode) return;
    var blob = readRoot('js/domain.js') + readRoot('js/views/matching.js') +
      readRoot('js/views/log.js') + readRoot('js/views/community.js') + readRoot('js/store.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(blob, name, name + ' 없음');
    });
  });

  /* ============================================================
   * 6. 버전 · 보호
   * ============================================================ */

  test('v1.79 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.87.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.87.0'", 'app.js');
    includes(readRoot('js/push.js'), "version: 'v1.87.0'", 'push.js');
    includes(readRoot('index.html'), 'styles.css?v=20261127-1', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.87.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.87.0', 'TWA appVersion');
    eq(twa.appVersionCode, 81, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.87.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v179.test.js', '테스트 목록 배선');
    includes(readRoot('styles.css'), '.cheerbtn', '응원 버튼 스타일');
    includes(readRoot('styles.css'), '.quickfill', '채우기 버튼 스타일');
    includes(readRoot('styles.css'), '.gymreview', '후기 카드 스타일');
  });

  test('v1.79 보호: 5개 탭·시트 26칸·기존 블록 구조가 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "id: '" + id + "'", '탭 ' + id);
    });
    eq(BM.domain.COLS.length, 26, '시트 26칸');
    var state = stateOf();
    var logHtml = BM.views.log.render(state);
    includes(logHtml, 'data-act="save-log"', '저장 버튼 그대로');
    includes(logHtml, 'data-field="minutes"', '운동 시간 칸 그대로');
    includes(logHtml, 'data-cond-band', '컨디션 5단계 그대로');
    includes(logHtml, 'data-form="log"', '일지 폼 그대로');
    var matching = BM.views.matching.render(state);
    includes(matching, 'data-match-tab="find"', '매칭 탭 그대로');
    var p0 = state.data.matchProfiles.filter(function (p) { return p.userKey !== BM.seed.ME; })[0];
    includes(BM.views.matching.playerCard(p0, state), 'data-open-profile=', '프로필 열기 그대로');
    var community = BM.views.community.render(state);
    ['자유', '후기', '게스트 모집', '용품', '일지'].forEach(function (tag) {
      includes(community, 'data-topic="' + tag + '"', '기존 작성 말머리: ' + tag);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
