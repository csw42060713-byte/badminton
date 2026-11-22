/* ============================================================
 * test/v136.test.js — bm-v1.37.2
 *   1) [수익화 · 하트/리워드 광고]
 *      · js/ads.js onRewardAdResult(ok, adUnit, txId) — txId 를 만들어/받아 watchAd 로 전달
 *      · 같은 txId 는 duplicate 로 한 번만 적립 · 행 메모(소셜글)에 'tx:…' 로 남김
 *      · HEART_RULES.STREAK_7_BONUS = 2 — 7·14일 연속 출석 보너스(원장에서 계산, 새 행 없음)
 *      · MY 하트 카드·공용 하트 시트에 보너스 안내 한 줄
 *   2) [일지 · 커뮤니티 연결]
 *      · 일지 입력칸 바로 아래 파트너 전적 한 줄('조환비 · 4전 3승 1패 (75%)')
 *      · 챌린지 자랑 문구에 함께 친 파트너·전적('조환비와 2경기 2승')을 자연스럽게
 *   3) 버전 · 회귀 · 보안
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

  var ME = 'u_v136_me';
  var NOW = U.ymd();            /* 날짜가 흐르면 테스트가 깨지지 않게 '오늘' 기준 */

  /* ---------- 도우미 ---------- */
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function storeWith(extra) {
    clearStorage();
    var rows = [];
    (extra || []).forEach(function (e) { rows.push(Array.isArray(e) ? e : D.toRow(e)); });
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0, meKey: ME });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function idxOf(rows) {
    return D.index((rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; }));
  }

  /* 오늘부터 n일 전 날짜 키 */
  function dayAgo(n) {
    return U.ymd(U.addDays(new Date(), -n));
  }

  function checkinRow(day, likes) {
    return D.toRow({
      id: 'c_' + day, type: '출석하트', createdAt: day + ' 08:00:00', date: day,
      nick: '나래', userKey: ME, likes: likes == null ? 1 : likes
    });
  }

  /* n일 연속 출석 행 — 마지막 날이 yesterdayOffset 일 전 */
  function streakRows(n, yesterdayOffset) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(checkinRow(dayAgo((yesterdayOffset || 0) + i)));
    return out;
  }

  function rec(date, partner, extra) {
    var r = {
      id: 'r_' + date + '_' + ((extra && extra.tag) || 'a'),
      type: '기록', date: date, userKey: ME,
      cond: 6, intensity: 3, minutes: 60,
      games: [], weakness: [], done: [], team: ''
    };
    if (partner) r.team = JSON.stringify({ partner: partner });
    Object.keys(extra || {}).forEach(function (k) { if (k !== 'tag') r[k] = extra[k]; });
    return r;
  }

  function game(a, b) { return { a: a, b: b }; }

  function stateOf(records, hearts) {
    return {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: records || [], allRecords: records || [], posts: [], threads: [], matchProfiles: [],
        feedback: [], requests: [], rooms: [], mentorApps: [], coachApps: [], friends: [],
        hearts: hearts || D.heartStatus(idxOf([]), ME, U.parseYmd(NOW).getTime()),
        idx: { all: [], byType: {}, byId: {} },
        stats: { streak: 0, sessions14: 2, winRate: 60, minutesMonth: 120, avgCond: 6 },
        unread: 0, guests: []
      },
      drafts: {
        log: {
          date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [],
          games: [{ a: '', b: '' }], pain: [], note: '', partner: '', video: '', videoNote: ''
        }
      },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      routine: {}, routinePref: null
    };
  }

  /* =========================================================
   * 1. 광고 거래 ID (txId) — 같은 시청 건은 한 번만
   * ========================================================= */

  test('v1.36 광고 txId: 시각 기반 고유 ID를 만든다', function () {
    ok(typeof BM.ads.newTxId === 'function', 'newTxId 함수');
    var a = BM.ads.newTxId(), b = BM.ads.newTxId();
    includes(a, 'tx-', '접두사');
    ok(a !== b, '두 번 만들면 다르다');
    ok(D.cleanTxId(a) === a, '글자 종류가 정리된 ID');
  });

  test('v1.36 광고 txId: 넘어온 ID를 정리하고 길이를 자른다', function () {
    eq(D.cleanTxId('  ad_123-abc.4  '), 'ad_123-abc.4', '공백 제거');
    eq(D.cleanTxId('a<script>b'), 'ascriptb', '허용 글자만 남김');
    eq(D.cleanTxId(''), '', '빈 값');
    eq(D.cleanTxId(null), '', 'null');
    eq(D.cleanTxId(new Array(500).join('x')), '', 'MZ게 긴 값은 버린다');
    eq(D.cleanTxId(new Array(200).join('y')).length, 48, '48자로 자름');
  });

  test('v1.36 광고 txId: 행 메모(tx:)를 읽고 이미 있는지 본다', function () {
    var rows = [D.toRow({
      id: 'ad1', type: '광고하트', createdAt: dayAgo(0) + ' 09:00:00', date: dayAgo(0),
      nick: '나래', userKey: ME, likes: 1, target: 'heart_reward', text: D.adTxNote('ad-777')
    })];
    var idx = idxOf(rows);
    includes(rows[0][D.COL['소셜글']], 'tx:ad-777', '메모에 txId');
    eq(D.adTxOf(D.fromRow(rows[0])), 'ad-777', '행에서 읽기');
    eq(D.adTxSeen(idx, ME, 'ad-777'), true, '이미 있음');
    eq(D.adTxSeen(idx, ME, 'ad-778'), false, '다른 ID');
    eq(D.adTxSeen(idx, 'other', 'ad-777'), false, '남의 기록은 안 센다');
    eq(D.adTxOf(D.fromRow(D.toRow({ id: 'x', type: '광고하트', userKey: ME, likes: 1, text: '' }))), '', '메모 없음');
  });

  test('v1.36 광고 저장: 같은 txId는 두 번째 적립을 막는다', function () {
    return storeWith([]).then(function (store) {
      var me = store.state.me.key;
      var tx = 'ad-tx-1';
      var r1 = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: tx });
      ok(r1.ok, '첫 적립');
      eq(r1.txId, tx, 'ID 그대로');
      var before = store.state.data.hearts.balance;
      var rows = store.state.rows.filter(function (row) { return row[D.COL['유형']] === '광고하트'; });
      eq(rows.length, 1, '광고 행 1개');
      includes(rows[0][D.COL['소셜글']], 'tx:' + tx, '메모에 ID');
      store.state.locks = {};
      var r2 = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: tx });
      eq(r2.ok, false, '두 번째 불가');
      eq(r2.reason, 'duplicate', '사유 duplicate');
      eq(store.state.rows.filter(function (row) { return row[D.COL['유형']] === '광고하트'; }).length, 1, '행이 늘지 않음');
      eq(store.state.data.hearts.balance, before, '잔액 그대로');
      ok(D.adTxSeen(store.state.idx, me, tx), 'idx 에 ID 가 남음');
    });
  });

  test('v1.36 광고 저장: 다른 ID·ID 없는 호출은 예전처럼 적립', function () {
    return storeWith([]).then(function (store) {
      var me = store.state.me.key;
      ok(store.actions.watchAd({ verified: true, txId: 'ad-a' }).ok, 'A 적립');
      store.state.locks = {};
      /* 30초 간격은 그대로 — 시각을 돌려 쿨타임을 지나게 만든다 */
      store.state.rows.forEach(function (row) {
        if (row[D.COL['유형']] === '광고하트') row[D.COL['작성일시']] = dayAgo(0) + ' 00:00:01';
      });
      store.actions.recompute ? store.actions.recompute() : null;
      var past = U.stamp(new Date(Date.now() - 40000));
      store.state.rows.forEach(function (row) {
        if (row[D.COL['유형']] === '광고하트') row[D.COL['작성일시']] = past;
      });
      store.actions.init && store.actions.init();
      var fresh = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
      return fresh.actions.init().then(function () {
        var r2 = fresh.actions.watchAd({ verified: true, txId: 'ad-b' });
        ok(r2.ok, '다른 ID 는 적립');
        fresh.state.locks = {};
        var r3 = fresh.actions.watchAd({ verified: true });
        eq(r3.reason, 'cooldown', 'ID 없는 호출은 간격 검사를 그대로 받는다');
      });
    });
  });

  test('v1.36 광고 훅: onRewardAdResult(ok, adUnit, txId)가 스토어로 넘긴다', function () {
    ok(typeof BM.ads.onRewardAdResult === 'function', 'onRewardAdResult 함수');
    return storeWith([]).then(function (store) {
      var prevCtx = BM.app && BM.app.ctx;
      BM.app = BM.app || {};
      BM.app.ctx = { store: store };
      var r = BM.ads.onRewardAdResult(true, 'heart_reward', 'native-1');
      eq(r.rewarded, true, '보상');
      eq(r.txId, 'native-1', 'ID');
      eq(r.apply && r.apply.ok, true, '지급');
      store.state.locks = {};
      var again = BM.ads.onRewardAdResult(true, 'heart_reward', 'native-1');
      eq(again.apply && again.apply.reason, 'duplicate', '같은 ID 두 번째는 duplicate');
      var noId = BM.ads.onRewardAdResult(false, 'heart_reward');
      ok(D.cleanTxId(noId.txId) !== '', '실패 콜백에도 ID가 붙는다');
      eq(noId.rewarded, false, '보상 없음');
      BM.app.ctx = prevCtx;
    });
  });

  test('v1.36 광고 훅: ID가 없으면 만들어서 넘긴다', function () {
    var res = BM.ads.onRewardAdResult(true, 'heart_reward');
    includes(res.txId, 'tx-', '시각 기반 ID');
    eq(res.apply && res.apply.ok, undefined, '기다리는 화면·스토어가 없으면 지급하지 않는다');
  });

  test('v1.36 광고 재생: 네이티브 콜백의 txId가 결과에 그대로 온다', function () {
    var prev = root.AndroidBridge;
    var opened = '';
    root.AndroidBridge = { showRewardedAd: function (unit) { opened = unit; } };
    var p = BM.ads.showRewarded({ unit: 'heart_reward' });
    ok(opened !== '', '브리지에 재생 요청');
    var sent = BM.ads.onRewardAdResult(true, 'heart_reward', 'sdk-42');
    eq(sent.txId, 'sdk-42', 'SDK ID');
    return p.then(function (r) {
      eq(r.rewarded, true, '보상');
      eq(r.txId, 'sdk-42', '결과에 ID');
      eq(r.source, 'native', '네이티브');
      root.AndroidBridge = prev;
    }, function (e) {
      root.AndroidBridge = prev;
      throw e;
    });
  });

  /* =========================================================
   * 2. 7일 연속 출석 보너스 (HEART_RULES.STREAK_7_BONUS)
   * ========================================================= */

  test('v1.36 연속 보너스: 규칙값 2개 · 7일마다', function () {
    eq(D.HEART_RULES.STREAK_7_BONUS, 2, '보너스 2');
    eq(D.streakBonusLeft(0), 7, '시작은 7일');
    eq(D.streakBonusLeft(2), 5, '2일째 → 5일 남음');
    eq(D.streakBonusLeft(6), 1, '6일째 → 1일');
    eq(D.streakBonusLeft(7), 7, '7일째(받은 날) → 다음은 7일 뒤');
    eq(D.streakBonusLeft(9), 5, '9일째 → 5일');
  });

  test('v1.36 연속 보너스: 7일을 채우면 원장에 +2가 한 줄 는다', function () {
    var six = D.heartStatus(idxOf(streakRows(6)), ME, U.parseYmd(NOW).getTime());
    var seven = D.heartStatus(idxOf(streakRows(7)), ME, U.parseYmd(NOW).getTime());
    eq(six.balance, D.HEART_RULES.BASE + 6, '6일은 보너스 없음');
    eq(seven.balance, D.HEART_RULES.BASE + 7 + 2, '7일째 +2');
    var bonus = seven.history.filter(function (h) { return h.kind === 'streak'; });
    eq(bonus.length, 1, '보너스 한 줄');
    eq(bonus[0].delta, 2, '+2');
    eq(bonus[0].label, '7일 연속 출석 보너스', '이름');
    eq(seven.streakBonus.amount, 2, 'status.amount');
    eq(seven.streakBonus.days, 7, '주기');
    eq(seven.streakBonus.left, 7, '받은 날은 다음이 7일 뒤');
    eq(seven.checkinStreak, 7, '연속 7일');
  });

  test('v1.36 연속 보너스: 14일은 두 번, 끊기면 다시 1부터', function () {
    var fourteen = D.heartStatus(idxOf(streakRows(14)), ME, U.parseYmd(NOW).getTime());
    eq(fourteen.balance, D.HEART_RULES.BASE + 14 + 4, '14일은 +2 두 번');
    eq(fourteen.history.filter(function (h) { return h.kind === 'streak'; }).length, 2, '보너스 두 줄');

    /* 10일 전에 끊긴 7일 연속 (그 뒤 3일 쉼) → 보너스는 한 번뿐 */
    var broken = [];
    for (var i = 0; i < 7; i++) broken.push(checkinRow(dayAgo(13 + i)));
    for (var j = 0; j < 3; j++) broken.push(checkinRow(dayAgo(j)));
    var st = D.heartStatus(idxOf(broken), ME, U.parseYmd(NOW).getTime());
    eq(st.history.filter(function (h) { return h.kind === 'streak'; }).length, 1, '끊긴 연속은 한 번만');
    eq(st.balance, D.HEART_RULES.BASE + 10 + 2, '잔액도 한 번만 +2');
    eq(st.checkinStreak, 3, '지금 연속은 3일');
  });

  test('v1.36 연속 보너스: 같은 날 두 번 출석해도 하루로 센다', function () {
    var rows = streakRows(6, 1);            /* 어제까지 6일 */
    rows.push(checkinRow(dayAgo(0), 1));   /* 오늘 */
    rows.push(checkinRow(dayAgo(0), 1));   /* 같은 날 두 번째 행 */
    var st = D.heartStatus(idxOf(rows), ME, U.parseYmd(NOW).getTime());
    eq(st.history.filter(function (h) { return h.kind === 'streak'; }).length, 1, '보너스 한 번');
    eq(st.checkinStreak, 7, '같은 날 두 번은 7일 중 하루');
    eq(st.balance, D.HEART_RULES.BASE + 8 + 2, '보너스 한 번만');
  });

  test('v1.36 연속 보너스: 7일째 출석은 하트 3개(1+2)를 준다', function () {
    return storeWith(streakRows(6, 1)).then(function (store) {
      var me = store.state.me.key;
      var before = store.state.data.hearts.balance;
      eq(store.state.data.hearts.checkinStreak, 6, '어제까지 6일');
      var r = store.actions.checkIn();
      ok(r.ok, '출석');
      eq(r.bonus, 2, '보너스 2');
      eq(r.gained, 3, '1 + 2');
      eq(r.streak, 7, '7일째');
      eq(store.state.data.hearts.balance, before + 3, '잔액 +3');
      eq(store.state.data.hearts.streakBonus.left, 7, '다음 보너스는 7일 뒤');
      var row = store.state.rows.filter(function (x) { return x[D.COL['유형']] === '출석하트' && x[D.COL['날짜']] === dayAgo(0); })[0];
      ok(row, '오늘 출석 행');
      includes(row[D.COL['소셜글']], '보너스', '행 메모에 보너스 표시');
      ok(me, '내 키');
    });
  });

  test('v1.36 연속 보너스: 7일이 아닌 날은 예전처럼 1개', function () {
    return storeWith(streakRows(2, 1)).then(function (store) {
      var r = store.actions.checkIn();
      ok(r.ok, '출석');
      eq(r.gained, 1, '보너스 없음');
      eq(r.bonus, 0, 'bonus 0');
      eq(r.streak, 3, '3일째');
    });
  });

  test('v1.36 연속 보너스: MY 하트 카드에 보너스 안내 한 줄', function () {
    var hearts = D.heartStatus(idxOf(streakRows(4)), ME, U.parseYmd(NOW).getTime());
    var out = BM.views.my.heartCard(hearts);
    includes(out, 'streakbonus', '보너스 줄');
    includes(out, '보너스 하트 +2', '문구');
    includes(out, '3일 더 하면', '남은 날');
    includes(out, '4일 연속 출석 중', '연속 일수');
    excludes(out, 'undefined', 'undefined 없음');
    /* 보너스가 없는(0) 설정에서는 줄을 그리지 않는다 */
    var noBonus = BM.views.my.heartCard(Object.assign({}, hearts, { streakBonus: { amount: 0, days: 7, left: 7 } }));
    excludes(noBonus, 'streakbonus', '보너스 0이면 숨김');
  });

  test('v1.36 연속 보너스: 공용 하트 시트도 같은 안내를 쓴다', function () {
    var hearts = D.heartStatus(idxOf(streakRows(4)), ME, U.parseYmd(NOW).getTime());
    var s = BM.ads.getStatus(hearts);
    eq(s.streak, 4, '연속 일수 전달');
    ok(s.streakBonus && s.streakBonus.amount === 2, '보너스 값 전달');
    var line = BM.ads.streakText(s);
    includes(line, '4일 연속 출석 중', '문구');
    includes(line, '+2', '보너스 수');
    eq(BM.ads.streakText({ streakBonus: null }), '', '보너스 없으면 빈 줄');
    includes(readRoot('js/ads.js'), 'data-streak-bonus', '시트 본문에 안내 줄');
  });

  /* =========================================================
   * 3. 일지 입력칸 아래 파트너 전적 한 줄
   * ========================================================= */

  test('v1.36 파트너 줄: 이름 하나의 전적을 한 줄로 만든다', function () {
    var list = [
      rec('2026-11-20', '조환비', { tag: 'a', games: [game(21, 15)] }),
      rec('2026-11-19', '조환비', { tag: 'b', games: [game(21, 18)] }),
      rec('2026-11-18', '조환비', { tag: 'c', games: [game(17, 21)] }),
      rec('2026-11-17', '조환비', { tag: 'd', games: [game(21, 12)] })
    ];
    var p = D.partnerStat(list, '조환비');
    ok(p, '한 명');
    eq(p.games, 4, '4경기');
    eq(p.wins, 3, '3승');
    eq(p.rate, 75, '75%');
    eq(D.partnerLineText(p), '조환비 · 4전 3승 1패 (75%)', '한 줄 문구');
    eq(D.partnerStat(list, '없는이름'), null, '기록 없으면 null');
    eq(D.partnerStat(list, '  '), null, '빈 이름');
  });

  test('v1.36 파트너 줄: 무승부만 있으면 승률을 붙이지 않는다', function () {
    var list = [rec('2026-11-20', '민수', { games: [game(21, 21)] })];
    var p = D.partnerStat(list, '민수');
    ok(p, '한 명');
    eq(p.games, 1, '1경기');
    excludes(D.partnerLineText(p), '%', '승률 없음');
    includes(D.partnerLineText(p), '1무', '무승부 표시');
  });

  test('v1.36 파트너 줄: 일지 화면 입력칸 바로 아래에 붙는다', function () {
    var list = [rec('2026-11-20', '조환비', { games: [game(21, 15), game(21, 19)] })];
    var state = stateOf(list);
    var txt = BM.views.log.partnerNowText(state, '조환비');
    includes(txt, '조환비 · 2전 2승', '미리보기 문구');
    eq(BM.views.log.partnerNowText(state, ''), '', '이름 없으면 빈 줄');
    var htmlOn = BM.views.log.partnerNow(state, '조환비');
    includes(htmlOn, 'data-ptn-now', '표식');
    excludes(htmlOn, ' hidden', '이름이 있으면 보임');
    includes(htmlOn, U.esc(txt), '문구');
    var htmlOff = BM.views.log.partnerNow(state, '없는이름');
    includes(htmlOff, ' hidden', '기록 없는 이름은 숨김');
    /* 일지 & AI 화면에도 들어간다 */
    var out = BM.views.log.render(state);
    includes(out, 'data-ptn-now', '화면에 한 줄');
  });

  test('v1.36 파트너 줄: 칩을 눌러도 줄이 따라 바뀐다 (코드 경로)', function () {
    var src = readRoot('js/views/log.js');
    includes(src, 'paintPartnerNow(ctx, form, next)', '칩 클릭');
    includes(src, 'paintPartnerNow(ctx, form, el.value)', '직접 입력');
  });

  /* =========================================================
   * 4. 챌린지 자랑 문구에 파트너·전적
   * ========================================================= */

  function challengeRecords() {
    /* 이번 주 3일(오늘·어제·그제) 헤어핀 — 챌린지 달성 */
    return [
      rec(dayAgo(0), '조환비', { tag: 'a', weakness: ['헤어핀'], games: [game(21, 15)] }),
      rec(dayAgo(1), '조환비', { tag: 'b', weakness: ['헤어핀'], games: [game(21, 18)] }),
      rec(dayAgo(2), '민수', { tag: 'c', weakness: ['헤어핀'], games: [game(15, 21)] })
    ];
  }

  test('v1.36 자랑 문구: 파트너·전적이 괄호로 붙는다', function () {
    var rows = challengeRecords();
    var ch = D.weekChallenge(rows, { now: U.parseYmd(NOW) });
    eq(ch.done, true, '챌린지 달성');
    eq(ch.weakness, '헤어핀', '약점');
    var text = D.challengeShareText(ch, { records: rows, now: NOW });
    includes(text, '이번 주 헤어핀 3회 연습 달성!', '기본 문구');
    includes(text, '(조환비와 2경기 2승)', '파트너·전적');
    includes(text, '🎉', '마무리');
    var p = D.challengePartner(rows, ch, { now: NOW });
    ok(p && p.name === '조환비', '가장 많이 함께 친 파트너');
    eq(D.challengePartnerTail(p), '조환비와 2경기 2승', '꼬리 문구');
  });

  test('v1.36 자랑 문구: 기록이 없으면 예전 문구 그대로', function () {
    var ch = { weakness: '헤어핀', goal: 3, days: [] };
    eq(D.challengeShareText(ch), '이번 주 헤어핀 3회 연습 달성! 🎉', '기존 문구');
    eq(D.challengeShareText({ weakness: '' }, { records: [] }), '', '약점 없음');
  });

  test('v1.36 자랑 문구: 받침에 따라 와/과를 고른다', function () {
    var rows = challengeRecords();
    var ch = D.weekChallenge(rows, { now: U.parseYmd(NOW) });
    var p = { name: '김철수', games: 2, wins: 1, losses: 1, draws: 0 };
    eq(D.challengePartnerTail(p), '김철수와 2경기 1승 1패', '받침 없으면 와');
    var q = { name: '박준', games: 3, wins: 2, losses: 0, draws: 1 };
    eq(D.challengePartnerTail(q), '박준과 3경기 2승 1무', '받침 있으면 과');
    eq(D.challengePartnerTail({ name: '조환비', games: 0 }), '', '경기 없으면 빈 문구');
    ok(ch.done, '달성');
  });

  test('v1.36 자랑 문구: 저장소가 초안을 만들어 준다', function () {
    return storeWith(challengeRecords()).then(function (store) {
      var d = store.actions.challengeShareDraft();
      ok(d.ok, '초안');
      includes(d.text, '(조환비와 2경기 2승)', '파트너 포함');
      ok(d.partner && d.partner.name === '조환비', '파트너 정보');
      var src = readRoot('js/views/log.js');
      includes(src, 'challengeShareDraft', '화면이 저장소 초안을 쓴다');
    });
  });

  test('v1.36 자랑 문구: 3회를 못 채우면 초안을 만들지 않는다', function () {
    return storeWith([rec(dayAgo(0), '조환비', { weakness: ['헤어핀'], games: [game(21, 15)] })]).then(function (store) {
      var d = store.actions.challengeShareDraft();
      eq(d.ok, false, '아직 미달');
      eq(d.reason, 'not_done', '사유');
    });
  });

  /* =========================================================
   * 5. 버전 · 회귀 · 보안
   * ========================================================= */

  test('v1.36 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.54.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.54.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261122-68', '스타일 캐시');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.54.0', 'TWA 이름');
    eq(twa.app, undefined, '군더더기 없음');
    eq(twa.appVersionCode, 48, 'TWA 코드');
  });

  test('v1.36 캐시: 새 파일 없이 기존 목록 그대로', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    ['js/ads.js', 'js/domain.js', 'js/store.js', 'js/views/log.js', 'js/views/my.js', 'styles.css'].forEach(function (f) {
      includes(sw, "'./" + f + "'", f + ' 캐시');
    });
    excludes(readRoot('test/run.js'), 'js/ads2.js', '없는 파일');
  });

  test('v1.36 회귀: 기존 하트·광고·일지 기능은 그대로', function () {
    if (!hasNode) return;
    var store = readRoot('js/store.js'), ads = readRoot('js/ads.js'), log = readRoot('js/views/log.js');
    includes(store, 'watchAd: function', '광고 적립');
    includes(store, 'checkIn: function', '출석');
    includes(store, 'reason: \'limit\'', '하루 5회 한도 그대로');
    includes(store, 'reason: \'cooldown\'', '30초 간격 그대로');
    includes(ads, 'openHeartSheet', '공용 충전 시트');
    includes(ads, 'PREVIEW_SEC', '웹 광고 미리보기');
    includes(log, 'partnerChips', '파트너 칩');
    includes(log, 'partnerBlock', '파트너별 승률 카드');
    includes(log, 'data-field="partner"', '파트너 입력');
  });

  test('v1.36 보안: 이번 사이클 코드에 시트 ID·비밀 키·바깥 주소가 없다', function () {
    if (!hasNode) return;
    ['js/ads.js', 'js/domain.js', 'js/store.js', 'js/views/log.js', 'js/views/my.js', 'app.js', 'sw.js', 'styles.css'].forEach(function (f) {
      var src = readRoot(f);
      excludes(src, '1sqxAM6eskBYS03', '시트 ID 없음 ' + f);
      excludes(src, 'supabase.co', 'DB 주소 없음 ' + f);
      excludes(src, 'service_role', '비밀 키 없음 ' + f);
      excludes(src, 'eyJhbGciOi', 'JWT 없음 ' + f);
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
