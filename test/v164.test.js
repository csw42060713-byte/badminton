/* ============================================================
 * test/v164.test.js — bm-v1.73.0
 *   ideas.md 2026-11-24 아침 구상 → 오전 9시 코드 수정
 *
 *   1) [수익화 × 리텐션] 하트 연속 출석 보너스 3·7·14일 + 하트 부스트 실보상
 *      · 3일 +1 · 7일 +2 · 14일 +3 (그 뒤 14일마다 +3) — 원장에서 날짜 연속을 매번 다시 셈(멱등)
 *      · 중복 적립 방지 키 = 보너스를 받은 날짜(streakClaimKey) → 하루 한 번
 *      · MY 하트 지갑에 연속 일수·다음 보너스까지 남은 날
 *      · heart_boost(하트 3개 · 한 번 열면 계속)를 켜면 출석·광고 적립이 실제로 +1,
 *        MY 카드·꾸미기·충전 시트에 '적용 중(+1)'
 *   2) [출시 준비] AdMob 리워드 브리지 훅
 *      · window.BadmintonBridge · AndroidBridge · AndroidAdMob · BadmintonNative
 *      · window.BadmintonAdMob.reward(ok, adUnit, txId) / BM.app.onRewardAdResult
 *      · 같은 txId 는 한 번만 적립 · 웹에서는 기존 미리보기/쿨타임 가드 그대로
 *   3) [버그] 일지 저장·수정·삭제 직후 히어로 요약(이번 달 N분·승률·최근 2주) 즉시 갱신
 *   4) [여력] 대회 인증 카드 챔피언 골드 프레임 — 하트 2개로 영구 해금
 *   5) 버전(bm-v1.73.0) · 캐시 · 테스트 목록 · 보호
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

  var ME = 'u_v164_me';
  var NOW = U.ymd();

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

  function dayAgo(n) {
    return U.ymd(U.addDays(new Date(), -n));
  }

  function checkinRow(day, likes) {
    return D.toRow({
      id: 'c_' + day, type: '출석하트', createdAt: day + ' 08:00:00', date: day,
      nick: '나래', userKey: ME, likes: likes == null ? 1 : likes
    });
  }

  function streakRows(n, offset) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(checkinRow(dayAgo((offset || 0) + i)));
    return out;
  }

  function bonusRows(idx) {
    return D.heartStatus(idx, ME, U.parseYmd(NOW).getTime())
      .history.filter(function (h) { return h.kind === 'streak'; });
  }

  /* =========================================================
   * 1. 연속 출석 보너스 3 · 7 · 14일
   * ========================================================= */

  test('v1.64 연속 보너스 규칙: 3일 +1 · 7일 +2 · 14일 +3 · 30일 +5, 그 뒤 14일마다', function () {
    eq(D.STREAK_BONUSES.length, 4, '구간 4개');
    eq(D.STREAK_BONUSES[0].days + '/' + D.STREAK_BONUSES[0].amount, '3/1', '3일 +1');
    eq(D.STREAK_BONUSES[1].days + '/' + D.STREAK_BONUSES[1].amount, '7/2', '7일 +2');
    eq(D.STREAK_BONUSES[2].days + '/' + D.STREAK_BONUSES[2].amount, '14/3', '14일 +3');
    eq(D.STREAK_BONUSES[3].days + '/' + D.STREAK_BONUSES[3].amount, '30/5', '30일 +5');
    eq(D.STREAK_BONUS_REPEAT_DAYS, 14, '반복 주기 14일');

    eq(D.streakBonusFor(2), null, '2일은 없음');
    eq(D.streakBonusFor(3).amount, 1, '3일');
    eq(D.streakBonusFor(7).amount, 2, '7일');
    eq(D.streakBonusFor(14).amount, 3, '14일');
    eq(D.streakBonusFor(21), null, '21일은 없음(14일마다)');
    eq(D.streakBonusFor(28).amount, 3, '28일 +3');
    eq(D.streakBonusFor(30).amount, 5, '30일 +5');
  });

  test('v1.64 연속 보너스 안내: 다음 보너스까지 남은 날', function () {
    var d0 = D.nextStreakBonus(0);
    eq(d0.days + '/' + d0.left + '/' + d0.amount, '3/3/1', '시작은 3일');
    var d2 = D.nextStreakBonus(2);
    eq(d2.days + '/' + d2.left + '/' + d2.amount, '3/1/1', '2일째 → 1일 뒤 +1');
    eq(D.nextStreakBonus(3).days, 7, '3일을 받으면 다음은 7일');
    eq(D.nextStreakBonus(6).left, 1, '6일째 → 7일까지 1일');
    eq(D.nextStreakBonus(7).days, 14, '7일을 받으면 다음은 14일');
    eq(D.nextStreakBonus(14).days, 30, '14일을 받으면 다음은 30일(챔피언)');
    eq(D.nextStreakBonus(29).left, 1, '29일째 → 30일까지 1일');
    eq(D.nextStreakBonus(30).days, 42, '30일을 받으면 그 뒤는 14일마다(42일)');
    eq(D.nextStreakBonus(30).amount, 3, '42일은 14일 반복값 +3');
  });

  test('v1.64 연속 보너스 원장: 3·7·14일째에 한 줄씩 더해진다', function () {
    var three = D.heartStatus(idxOf(streakRows(3)), ME, U.parseYmd(NOW).getTime());
    eq(three.balance, D.HEART_RULES.BASE + 3 + 1, '3일 +1');
    eq(bonusRows(idxOf(streakRows(3))).length, 1, '한 줄');

    var seven = D.heartStatus(idxOf(streakRows(7)), ME, U.parseYmd(NOW).getTime());
    eq(seven.balance, D.HEART_RULES.BASE + 7 + 3, '3일 +1 · 7일 +2');
    eq(bonusRows(idxOf(streakRows(7))).length, 2, '두 줄');

    var fourteen = D.heartStatus(idxOf(streakRows(14)), ME, U.parseYmd(NOW).getTime());
    eq(fourteen.balance, D.HEART_RULES.BASE + 14 + 6, '3 + 7 + 14 = +6');
    eq(bonusRows(idxOf(streakRows(14))).length, 3, '세 줄');

    var twentyEight = D.heartStatus(idxOf(streakRows(28)), ME, U.parseYmd(NOW).getTime());
    eq(twentyEight.balance, D.HEART_RULES.BASE + 28 + 9, '14일 보너스 한 번 더');
  });

  test('v1.64 연속 보너스 원장: 끊긴 연속은 구간마다 따로 센다', function () {
    /* 3일 연속 두 번(사이에 하루 쉼) → +1 두 번 */
    var rows = [];
    rows = rows.concat(streakRows(3, 8));   /* 8·9·10일 전 */
    rows = rows.concat(streakRows(3, 0));   /* 오늘·어제·그제 */
    var st = D.heartStatus(idxOf(rows), ME, U.parseYmd(NOW).getTime());
    eq(bonusRows(idxOf(rows)).length, 2, '두 번 각각 +1');
    eq(st.balance, D.HEART_RULES.BASE + 6 + 2, '+2');
    eq(st.checkinStreak, 3, '지금 연속 3일');
  });

  test('v1.64 연속 보너스 중복 방지: 같은 날 두 번 출석해도 한 번만', function () {
    var rows = streakRows(2, 1);           /* 어제까지 2일 */
    rows.push(checkinRow(dayAgo(0), 1));
    rows.push(checkinRow(dayAgo(0), 1));   /* 같은 날 두 번째 행 */
    eq(bonusRows(idxOf(rows)).length, 1, '3일 보너스 한 번');
    eq(D.heartStatus(idxOf(rows), ME, U.parseYmd(NOW).getTime()).balance, D.HEART_RULES.BASE + 4 + 1, '+1 한 번');
    /* 키는 '그 보너스를 받은 날짜' — 하루에 하나뿐이라 두 번 들어갈 수 없습니다 */
    eq(D.streakClaimKey('2026-11-24'), 'streak:2026-11-24', '중복 방지 키');
    eq(D.streakClaimKey(''), '', '날짜가 없으면 키도 없음');
  });

  test('v1.64 출석 저장: 3일째에 보너스·키를 행에 남기고 gained 에 함께', function () {
    return storeWith(streakRows(2, 1)).then(function (store) {
      var before = store.state.data.hearts.balance;
      var r = store.actions.checkIn();
      ok(r.ok, '출석');
      eq(r.streak, 3, '3일째');
      eq(r.milestone, 3, '3일 구간');
      eq(r.bonus, 1, '보너스 1');
      eq(r.gained, 2, '1 + 1');
      eq(store.state.data.hearts.balance, before + 2, '잔액 +2');
      var row = store.state.rows.filter(function (x) {
        return x[D.COL['유형']] === '출석하트' && x[D.COL['날짜']] === dayAgo(0);
      })[0];
      ok(row, '오늘 출석 행');
      includes(row[D.COL['소셜글']], '3일 연속 출석 보너스', '행 메모');
      includes(row[D.COL['소셜글']], 'streak:', '중복 방지 키');
      eq(Number(row[D.COL['좋아요']]), 1, '행 값은 출석 보상만(보너스는 원장이 셈)');
    });
  });

  /* =========================================================
   * 2. 하트 부스트 실보상
   * ========================================================= */

  test('v1.64 하트 부스트: 하트 3개 · 꾸미기 ID · 이름', function () {
    eq(D.DECO_PRICES['boost:heart'], 3, '가격 3');
    eq(D.decoId('boost', 'heart'), 'boost:heart', 'ID');
    eq(D.decoId('boost', 'x'), '', '다른 값은 없음');
    eq(D.decoName('boost:heart'), '하트 부스트', '이름');
    eq(D.BOOST_BONUS, 1, '보너스 1');
  });

  test('v1.64 하트 부스트: 열고 켜면 출석·광고 적립이 +1', function () {
    return storeWith([]).then(function (store) {
      var h0 = store.state.data.hearts;
      eq(h0.balance, D.HEART_RULES.BASE, '시작 하트');
      eq(h0.checkinReward, 1, '부스트 전 출석 1');
      eq(h0.adReward, 1, '부스트 전 광고 1');
      eq(h0.boost.owned, false, '아직 없음');

      var buy = store.actions.buyDeco('boost', 'heart');
      ok(buy.ok && buy.purchased, '하트 3개로 해금');
      eq(buy.price, 3, '3개');
      eq(store.state.data.hearts.balance, 0, '잔액 3 → 0');
      eq(store.state.data.hearts.boost.owned, true, '소유');
      eq(store.state.data.hearts.boost.equipped, false, '열기만으로는 꺼짐');

      var on = store.actions.setHeartBoost(true);
      ok(on.ok, '켜기');
      eq(on.bonus, 1, '+1');
      var h1 = store.state.data.hearts;
      eq(h1.boost.equipped, true, '적용 중');
      eq(h1.checkinReward, 2, '출석 +2');
      eq(h1.adReward, 2, '광고 +2');

      var ci = store.actions.checkIn();
      eq(ci.boost, 1, '출석 부스트');
      eq(ci.gained, 2, '하트 2');
      var row = store.state.rows.filter(function (x) {
        return x[D.COL['유형']] === '출석하트' && x[D.COL['날짜']] === dayAgo(0);
      })[0];
      eq(Number(row[D.COL['좋아요']]), 2, '행 값에도 +1 (원장·서버 같은 숫자)');

      store.state.locks = {};
      var ad = store.actions.watchAd({ verified: true, adUnit: 'heart_reward' });
      ok(ad.ok, '광고');
      eq(ad.gained, 3, '광고 +2 + 오늘의 부스트 1');
      eq(ad.boost, 1, '부스트 표시');
      eq(ad.dailyBoost, 1, '오늘의 부스트 표시');
    });
  });

  test('v1.64 하트 부스트: 안 열고는 켤 수 없고, 끄면 원래대로', function () {
    return storeWith([]).then(function (store) {
      var no = store.actions.setHeartBoost(true);
      ok(!no.ok, '먼저 열어야 함');
      eq(no.reason, 'not_owned', '이유');
      eq(no.price, 3, '가격 안내');
      return store.actions.buyDeco('boost', 'heart');
    }).then(function () {
      /* 이미 위에서 store 는 사라졌으니 새 스토어로 다시 확인 */
      return storeWith([]).then(function (s2) {
        s2.state.locks = {};
        s2.actions.buyDeco('boost', 'heart');
        var on = s2.actions.setHeartBoost(true);
        ok(on.ok, '켜기');
        s2.state.locks = {};
        var off = s2.actions.setHeartBoost(false);
        ok(off.ok, '끄기');
        eq(off.bonus, 0, '보너스 0');
        eq(s2.state.data.hearts.boost.equipped, false, '꺼짐');
        eq(s2.state.data.hearts.checkinReward, 1, '출석 다시 1');
      });
    });
  });

  test('v1.64 하트 부스트: 꾸미기 저장·테마 변경에도 켜 둔 상태가 남는다', function () {
    return storeWith([]).then(function (store) {
      store.actions.buyDeco('boost', 'heart');
      store.state.locks = {};
      store.actions.setHeartBoost(true);
      eq(store.state.me.theme.boost, 1, '꾸미기 JSON 에 남음');

      store.state.locks = {};
      var saved = store.actions.saveProfile({ nick: '나래', bio: '부스트 테스트' });
      ok(saved.ok, '꾸미기 저장');
      eq(store.state.me.theme.boost, 1, '저장해도 그대로');

      store.state.locks = {};
      var th = store.actions.setTheme('th_def');
      ok(th.ok, '테마 변경');
      eq(store.state.me.theme.boost, 1, '테마를 바꿔도 그대로');
      eq(store.state.data.hearts.boost.equipped, true, '여전히 적용 중');
    });
  });

  test('v1.64 하트 부스트 UI: MY 하트 카드·꾸미기·충전 시트에 적용 중(+1)', function () {
    var hearts = D.heartStatus(idxOf([]), ME, U.parseYmd(NOW).getTime());
    var off = BM.views.my.heartCard(hearts);
    includes(off, 'boostline', '부스트 줄');
    includes(off, '하트 부스트', '이름');
    includes(off, '하트 3개로 열기', '잠김 안내');
    excludes(off, '적용 중(+1)', '아직 적용 전');

    var on = BM.views.my.heartCard(Object.assign({}, hearts, {
      boost: { id: 'boost:heart', price: 3, owned: true, equipped: true, bonus: 1, checkinReward: 2, adReward: 2 },
      checkinReward: 2, adReward: 2
    }));
    includes(on, '적용 중(+1)', '적용 중 표시');
    includes(on, '끄기', '끄기 버튼');

    var s = BM.ads.getStatus(Object.assign({}, hearts, {
      boost: { id: 'boost:heart', price: 3, owned: true, equipped: true, bonus: 1, checkinReward: 2, adReward: 2 },
      checkinReward: 2, adReward: 2
    }));
    eq(s.boost.equipped, true, '시트 상태');
    includes(BM.ads.boostText(s), '적용 중(+1)', '시트 한 줄');
    eq(BM.ads.boostText({ boost: { equipped: false } }), '', '꺼져 있으면 빈 줄');
    includes(readRoot('js/ads.js'), 'data-boost-line', '충전 시트 본문');
    includes(readRoot('js/views/my.js'), 'data-sub="boost"', '꾸미기 시트 안에도');
  });

  test('v1.64 연속 보너스 UI: 남은 날을 MY 카드·시트가 같은 문구로', function () {
    var hearts = D.heartStatus(idxOf(streakRows(4)), ME, U.parseYmd(NOW).getTime());
    eq(hearts.checkinStreak, 4, '4일 연속');
    eq(hearts.streakBonus.days, 7, '다음은 7일');
    eq(hearts.streakBonus.amount, 2, '보너스 +2');
    var out = BM.views.my.heartCard(hearts);
    includes(out, '4일 연속 출석 중', '연속 일수');
    includes(out, '3일 더 하면 보너스 하트 +2', '남은 날');
    eq(BM.ads.streakText(BM.ads.getStatus(hearts)), '4일 연속 출석 중 · 3일 더 하면 보너스 하트 +2', '시트 문구');
  });

  /* =========================================================
   * 3. AdMob 리워드 브리지 훅
   * ========================================================= */

  test('v1.64 AdMob: 래퍼 브리지를 이름으로 찾는다 (BadmintonBridge · AndroidAdMob)', function () {
    var calls = [];
    root.BadmintonBridge = { showRewardedAd: function (u) { calls.push(u); } };
    try {
      ok(!!BM.ads.bridge(), 'BadmintonBridge');
      eq(BM.ads.available().native, true, '네이티브 있음');
      var p = BM.ads.showRewarded({ unit: 'heart_reward' });
      eq(calls.length, 1, '광고 요청 1회');
      eq(calls[0], 'heart_reward', '기본 단위');
      var res = BM.ads.onRewardAdResult(true, 'heart_reward', 'tx-v164-native');
      ok(res.rewarded, '완료');
      eq(res.source, 'native', '네이티브');
      return p.then(function (r) {
        eq(r.rewarded, true, 'Promise 결과');
        eq(r.source, 'native', '네이티브 결과');
      });
    } finally {
      delete root.BadmintonBridge;
    }
  });

  test('v1.64 AdMob: window.BadmintonAdMob.reward 로 결과를 받는다', function () {
    ok(root.BadmintonAdMob, '래퍼가 부를 창구');
    eq(typeof root.BadmintonAdMob.reward, 'function', 'reward');
    eq(typeof root.BadmintonAdMob.setUnits, 'function', 'setUnits');
    eq(typeof root.BadmintonAdMob.showRewarded, 'function', 'showRewarded');
    var units = root.BadmintonAdMob.setUnits({ heart_boost: 'ca-app-pub-test/boost' });
    eq(units.heart_boost, 'ca-app-pub-test/boost', '단위 등록');
    eq(BM.ads.hasUnit('heart_boost'), true, '등록됨');
    eq(BM.ads.unitOf('heart_boost'), 'ca-app-pub-test/boost', '슬롯 단위');
    root.BadmintonAdMob.setUnits({ heart_boost: '' });
    eq(BM.ads.hasUnit('heart_boost'), false, '등록 지움');
  });

  test('v1.64 AdMob: 완료 콜백은 하트를 적립하고, 같은 txId 는 한 번만', function () {
    return storeWith([]).then(function (store) {
      var prevApp = BM.app;
      BM.app = BM.app || {};
      var prevCtx = BM.app.ctx;
      BM.app.ctx = { store: store };
      try {
        var first = BM.ads.onRewardAdResult(true, 'heart_reward', 'tx-v164-dup');
        ok(first.apply && first.apply.ok, '적립');
        eq(first.apply.gained, 2, '+1 + 오늘의 하트 부스트 1');
        var again = BM.ads.onRewardAdResult(true, 'heart_reward', 'tx-v164-dup');
        ok(!again.apply.ok, '두 번째는 막힘');
        eq(again.apply.reason, 'duplicate', '중복');
        eq(store.state.data.hearts.adUsedToday, 1, '오늘 광고 1회만');
      } finally {
        BM.app.ctx = prevCtx;
        if (!prevApp) BM.app = prevApp;
      }
    });
  });

  test('v1.64 AdMob: 웹(브리지 없음)에서는 광고를 지급하지 않는다 (미리보기 가드)', function () {
    eq(BM.ads.bridge(), null, '브리지 없음');
    return BM.ads.showRewarded({ unit: 'heart_reward' }).then(function (r) {
      eq(r.rewarded, false, '지급 없음');
      eq(r.reason, 'no_dom', '화면 없음(테스트) 안내');
    });
  });

  /* =========================================================
   * 4. 일지 저장 직후 히어로 요약 즉시 갱신
   * ========================================================= */

  function logState(patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: [{ id: 'r_v164', type: '기록', userKey: ME, date: NOW, minutes: 90, cond: 7 }],
        allRecords: [], posts: [], threads: [], matchProfiles: [], feedback: [], requests: [],
        rooms: [], mentorApps: [], coachApps: [], friends: [], friends_requests: [],
        hearts: D.heartStatus(idxOf([]), ME, U.parseYmd(NOW).getTime()),
        idx: { all: [], byType: {}, byId: {} },
        stats: { streak: 2, sessions14: 2, winRate: 60, minutesMonth: 120, avgCond: 6 },
        unread: 0
      },
      drafts: { log: { date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [], games: [{ a: '', b: '' }], pain: [], note: '', partner: '', video: '', videoNote: '' } },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, routine: {}, routinePref: null,
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    Object.keys(patch || {}).forEach(function (k) {
      if (k === 'stats') { st.data.stats = Object.assign({}, st.data.stats, patch.stats); return; }
      st.data[k] = patch[k];
    });
    return st;
  }

  test('v1.64 히어로: 요약 값과 서명이 함께 있다', function () {
    var st = logState();
    var html = BM.views.log.heroBlock(st);
    includes(html, 'data-sig="', '서명');
    includes(html, '120', '이번 달 120분');
    includes(html, '60%', '승률');
    includes(html, '최근 2주', '최근 2주');
    eq(BM.views.log.heroSig(st), BM.views.log.heroSig(logState()), '같은 값 → 같은 서명');
    ok(BM.views.log.heroSig(st) !== BM.views.log.heroSig(logState({ stats: { minutesMonth: 180 } })), '값이 바뀌면 서명도');
  });

  test('v1.64 히어로: 저장 직후 값이 바뀌면 카드를 다시 그린다', function () {
    var state = logState();
    var drawn = [];
    var hero = {
      sig: BM.views.log.heroSig(state),
      getAttribute: function () { return this.sig; },
      insertAdjacentHTML: function () {},
      set outerHTML(v) { drawn.push(v); }
    };
    var fakeRoot = {
      querySelector: function (sel) { return sel === '.card--hero' ? hero : null; },
      querySelectorAll: function () { return []; }
    };
    BM.views.log.update(fakeRoot, state);
    eq(drawn.length, 0, '같은 값이면 다시 그리지 않음');

    var after = logState({ stats: { minutesMonth: 180, winRate: 67, sessions14: 3, avgCond: 7 } });
    BM.views.log.update(fakeRoot, after);
    eq(drawn.length, 1, '값이 바뀌면 한 번 다시 그림');
    includes(drawn[0], '180', '이번 달 180분');
    includes(drawn[0], '67%', '승률 67%');
    includes(drawn[0], '3', '최근 2주 3회');
    excludes(drawn[0], 'undefined', 'undefined 없음');
  });

  test('v1.64 히어로: 인스타 공유 칩은 늘 최신 일지로 열린다', function () {
    var st = logState({
      records: [
        { id: 'r_new', type: '기록', userKey: ME, date: NOW, minutes: 120, cond: 7 },
        { id: 'r_old', type: '기록', userKey: ME, date: dayAgo(3), minutes: 60, cond: 6 }
      ]
    });
    var rec = BM.views.log.shareRecordOf(st, 'log-hero');
    eq(rec.id, 'r_new', '최신 일지');
    includes(BM.views.log.heroBlock(st), 'data-share-entry="log-hero"', '칩 그대로');
  });

  /* =========================================================
   * 5. 대회 인증 카드 챔피언 골드 프레임 (여력 반영)
   * ========================================================= */

  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }

  function mockCanvas() {
    var log = { texts: [], ops: [], leaves: 0, rects: 0, strokes: 0 };
    function gradient() {
      var g = { addColorStop: function () {} };
      return g;
    }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, globalAlpha: 1, lineCap: '', lineJoin: '',
      clearRect: function () {}, fillRect: function () { log.ops.push('fillRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      rect: function () { log.rects++; log.ops.push('rect'); },
      arc: function () {}, arcTo: function () {},
      ellipse: function () { log.leaves++; log.ops.push('ellipse'); },
      fill: function () { log.ops.push('fill'); },
      stroke: function () { log.strokes++; log.ops.push('stroke'); },
      clip: function () {}, save: function () {}, restore: function () {},
      translate: function () {}, rotate: function () {}, scale: function () {},
      createLinearGradient: gradient, createRadialGradient: gradient,
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (t) { log.texts.push(String(t)); },
      drawImage: function () {}
    };
    return {
      canvas: { width: 0, height: 0, getContext: function () { return g; } },
      log: log
    };
  }

  function compSpec(patch) {
    var s = {
      mode: 'comp', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night',
      frame: 'none', bg: '', photo: null,
      phrase: '민턴일기', top: '11/23 (일)', kicker: '○○시 오픈 배드민턴 대회',
      big: { value: '우승', unit: '', label: '성적' },
      stats: [{ label: '종목', value: 'B조 복식' }],
      meta: '', comp: { contest: '○○시 오픈', result: '우승', event: 'B조 복식' }, date: '11/23 (일)'
    };
    Object.keys(patch || {}).forEach(function (k) { s[k] = patch[k]; });
    return s;
  }

  test('v1.64 챔피언 프레임: 기본은 무료, 챔피언은 하트 2개', function () {
    eq(BM.sharecard.FRAMES.length, 2, '프레임 2종');
    var none = BM.sharecard.frameOptionById('none');
    eq(none.price, 0, '기본 무료');
    var champ = BM.sharecard.frameOptionById('champ');
    eq(champ.price, 2, '하트 2');
    eq(champ.deco, 'card:champ', '꾸미기 ID');
    eq(D.DECO_PRICES['card:champ'], 2, '도메인 가격');
    eq(D.decoId('card', 'champ'), 'card:champ', 'decoId');
    eq(D.decoName('card:champ'), '대회 카드 · 챔피언 프레임', '이름');
    eq(BM.sharecard.frameOptionById('??').id, 'none', '모르는 값은 기본');
  });

  test('v1.64 챔피언 프레임: 산 기록이 있으면 열려 있고, 없으면 잠김', function () {
    var state = {
      me: { key: ME },
      idx: idxOf([{ id: 'b1', type: '꾸미기구매', userKey: ME, target: 'card:champ', likes: 2, date: NOW }]),
      data: { hearts: { checkinStreak: 0 } }
    };
    var ctxWith = { store: { state: state } };
    ok(BM.sharecard.ownsFrame(ctxWith, 'champ'), '샀으면 열림');
    ok(BM.sharecard.ownsFrame(ctxWith, 'none'), '기본은 늘 무료');
    var ctxWithout = { store: { state: { me: { key: ME }, idx: idxOf([]), data: { hearts: {} } } } };
    eq(BM.sharecard.ownsFrame(ctxWithout, 'champ'), false, '안 샀으면 잠김');
    eq(BM.sharecard.ownsFrame({}, 'champ'), false, '상태가 없어도 안전');
  });

  test('v1.64 챔피언 프레임: 대회 인증 카드에만 금빛 테두리·월계관을 그린다', function () {
    var m1 = mockCanvas();
    BM.sharecard.draw(m1.canvas, compSpec({ frame: 'champ' }));
    ok(m1.log.leaves > 0, '월계관 잎');
    ok(m1.log.rects >= 2, '이중 테두리');
    ok(m1.log.strokes >= 2, '선');

    var m2 = mockCanvas();
    BM.sharecard.draw(m2.canvas, compSpec({ frame: 'none' }));
    ok(m2.log.leaves < m1.log.leaves, '기본 프레임은 월계관이 없다');

    /* 오늘 운동 카드에는 챔피언 프레임이 붙지 않는다 */
    var m3 = mockCanvas();
    BM.sharecard.draw(m3.canvas, compSpec({ mode: 'today', frame: 'champ' }));
    eq(m3.log.leaves, m2.log.leaves, '대회 카드 전용(오늘 운동은 기본과 같다)');
  });

  test('v1.64 챔피언 프레임: 시트에 프레임 칩이 있고 대회 모드에만 실린다', function () {
    var state = {
      me: { key: ME, nick: '나래' },
      idx: idxOf([]),
      data: { records: [], matchProfiles: [], stats: {}, hearts: D.heartStatus(idxOf([]), ME, U.parseYmd(NOW).getTime()) }
    };
    var ctx = { store: { state: state }, actions: {} };
    BM.sharecard._setState({
      mode: 'comp', design: 'magazine', ratio: 'feed', shade: 'original', palette: 'night',
      bg: '', frame: 'none', phrase: '민턴일기', phraseComp: '민턴일기', recordId: '',
      photo: null, gym: '', partner: '', rival: '', contest: '', event: '', result: '우승',
      compPartner: '', date: NOW
    });
    var body = BM.sharecard._sheetBody(ctx);
    includes(body, 'data-sc-frame="champ"', '프레임 칩');
    includes(body, '하트 2', '잠금 가격');
    includes(body, '카드 프레임', '이름표');

    var comp = BM.sharecard._specOf(ctx);
    eq(comp.frame, 'none', '대회 모드 — 고른 프레임');
    var ui2 = BM.sharecard._state();
    ui2.mode = 'today';
    var today = BM.sharecard._specOf(ctx);
    eq(today.frame, 'none', '오늘 운동은 늘 기본');

    eq(BM.sharecard._initialState(ctx).frame, 'none', '기본값은 프레임 없음');
  });

  test('v1.64 챔피언 프레임: 열기 — 하트가 모자라면 공용 충전 시트로, 충분하면 바로 연다', function () {
    var hearts = D.heartStatus(idxOf([]), ME, U.parseYmd(NOW).getTime());
    var state = { me: { key: ME, nick: '나래' }, idx: idxOf([]), data: { hearts: hearts }, rows: [] };
    var prevSheet = BM.ads.openHeartSheet;
    try {
      /* ① 하트 부족 → 공용 하트 시트를 열고, 그 안에서 채우면 그 자리에서 열기 */
      var opened = 0, sheetOpts = null;
      BM.ads.openHeartSheet = function (ctx, opts) { opened++; sheetOpts = opts; return {}; };
      var poorCtx = { store: { state: state }, actions: { buyDeco: function () { return { ok: false, reason: 'hearts', need: 2, price: 2 }; } } };
      var done1 = 0;
      BM.sharecard.unlockFrame(poorCtx, 'champ', function () { done1++; });
      eq(opened, 1, '충전 시트 열림');
      eq(sheetOpts.need, 2, '필요 하트 2');
      eq(typeof sheetOpts.onContinue, 'function', '채우면 이어서 열기');
      eq(done1, 0, '아직 안 열림');

      /* ② 하트가 충분하면 1탭으로 열린다 */
      BM.ads.openHeartSheet = function () { opened++; return {}; };
      var buyCtx = { store: { state: state }, actions: { buyDeco: function (kind, value) { return { ok: true, purchased: true, price: 2, id: kind + ':' + value }; } } };
      var done2 = 0, got = null;
      BM.sharecard.unlockFrame(buyCtx, 'champ', function () { done2++; got = BM.sharecard.ownsFrame({ store: { state: { me: { key: ME }, idx: idxOf([{ id: 'b1', type: '꾸미기구매', userKey: ME, target: 'card:champ', likes: 2, date: NOW }]), data: { hearts: { checkinStreak: 0 } } } } }, 'champ'); });
      eq(done2, 1, '열린 뒤 이어서');
      eq(opened, 1, '하트가 있으면 시트를 열지 않음');
      ok(got, '구매 기록으로 바로 열림');

      /* ③ 기본 프레임은 돈을 쓰지 않는다 */
      var spent = 0;
      var noneCtx = { store: { state: state }, actions: { buyDeco: function () { spent++; return { ok: true }; } } };
      BM.sharecard.unlockFrame(noneCtx, 'none', function () {});
      eq(spent, 0, '기본 프레임은 무료');
    } finally {
      BM.ads.openHeartSheet = prevSheet;
    }
  });

  /* =========================================================
   * 6. 버전 · 캐시 · 보호
   * ========================================================= */

  test('v1.64 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    includes(sw, "var VERSION = 'bm-v1.97.0'", 'sw.js');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
    includes(app, "version: 'v1.97.0'", 'app.js');
    includes(index, 'styles.css?v=20261128-3', 'styles.css 캐시');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.97.0', 'TWA 이름');
    eq(twa.appVersion, '1.97.0', 'TWA 버전');
    eq(twa.appVersionCode, 91, 'TWA 코드');
  });

  test('v1.64 배선: 새 파일 없이 화면 코드만 · 테스트 목록에 v164', function () {
    if (!hasNode) return;
    var run = readRoot('test/run.js');
    includes(run, 'test/v164.test.js', '테스트 목록');
    var sw = readRoot('sw.js');
    ['js/domain.js', 'js/store.js', 'js/ads.js', 'js/views/my.js', 'js/views/log.js', 'js/sharecard.js']
      .forEach(function (f) { includes(sw, f, 'sw 캐시 ' + f); });
  });

  test('v1.64 보호: 하트 규칙은 한 곳에서 · 서버 금액도 같은 값', function () {
    eq(D.HEART_RULES.CHECKIN, 1, '출석 1');
    eq(D.HEART_RULES.AD_REWARD, 1, '광고 1');
    eq(D.HEART_RULES.AD_PER_DAY, 5, '광고 하루 5회');
    ok(D.HEART_RULES.BASE >= 3, '기본 하트');
    /* 부스트는 적립 행에 적히므로 원장·서버가 같은 숫자를 셉니다 */
    includes(readRoot('js/store.js'), 'likes: gained', '출석 행에 실제 적립값');
  });

  test('v1.64 보안: 새 화면도 이스케이프 · 민감값 하드코딩 없음 · 실존 선수 이름 없음', function () {
    if (!hasNode) return;
    var files = ['js/domain.js', 'js/store.js', 'js/ads.js', 'js/views/my.js', 'js/views/log.js', 'js/sharecard.js'];
    files.forEach(function (f) {
      var src = readRoot(f);
      ['김원호', '안세영', '서승재'].forEach(function (n) { excludes(src, n, f + ' 실존 선수 이름'); });
      excludes(src, 'AIza', f + ' API 키 없음');
    });
    includes(readRoot('js/views/my.js'), 'U.esc(sub)', '부스트 줄 이스케이프');
    includes(readRoot('js/ads.js'), 'escText(boostText(s))', '시트 이스케이프');
    includes(readRoot('js/sharecard.js'), "U.esc(f.label", '프레임 칩 이스케이프');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
