/* ============================================================
 * test/v172.test.js — bm-v1.72.0
 *   30일 출석 챔피언 · 오늘의 하트 부스트 · 📅 코트 약속 카드 · 스티커 글씨 3색 · 수비 칩
 *
 *  ideas.md(2026-11-25) 3과제를 그대로 구현했는지 봅니다.
 *   1) 연속 출석 30일(+5 하트 · 🏆 챔피언 배지) — 멱등 원장 · streak:YYYY-MM-DD 키 유지
 *      + 하트 부스트를 아직 열지 않은 사람도 오늘 첫 리워드 광고에 +1 ('오늘의 하트 부스트')
 *        — 하루 5회·30초 간격·heart_boost 영구 +1 과 충돌 없이 공존
 *   2) 1:1 대화방 `📅 약속 잡기` — 체육관·날짜·시간 카드 + 상대 `좋아요`/`시간 조정` 1탭
 *      + 하트가 모자란 자리는 공용 충전 시트(광고)로 바로 이어짐
 *   3) 일지 약점 칩 `수비`(수비 타이밍 코칭 연결) + 스티커 글씨 색 흰색·라임·골드 3종
 *
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

  var ME = BM.seed.ME;
  var PEER = 'u_v172_peer';

  /* ---------- 연속 출석 행 만들기 (오늘까지 n일) ---------- */
  function streakRows(n) {
    var rows = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = U.ymd(U.addDays(new Date(), -i));
      rows.push(D.toRow({
        id: 'v172ck' + i, type: '출석하트', createdAt: d + ' 08:00:00', date: d,
        nick: '나래', userKey: ME, likes: 1
      }));
    }
    return rows;
  }
  /* 어제까지 n일 연속 — 오늘 출석을 따로 해 볼 때 */
  function streakRowsBefore(n) {
    var rows = [];
    for (var i = n; i >= 1; i--) {
      var d = U.ymd(U.addDays(new Date(), -i));
      rows.push(D.toRow({
        id: 'v172cb' + i, type: '출석하트', createdAt: d + ' 08:00:00', date: d,
        nick: '나래', userKey: ME, likes: 1
      }));
    }
    return rows;
  }
  /* 테스트에서 30초 간격만 건너뛰기 */
  function noCooldown(store) { store.state.data.hearts.nextAdInSec = 0; }
  function idxOf(rows) { return D.index(rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })); }

  /* ---------- 작은 가짜 캔버스 (스티커 글씨 색 확인용) ---------- */
  function textWidth(text, font) {
    var m = /(\d+)px/.exec(font || '');
    var size = m ? Number(m[1]) : 24;
    var w = 0, src = String(text);
    for (var i = 0; i < src.length; i++) w += src.charCodeAt(i) > 0x2e80 ? size : size * 0.56;
    return w;
  }
  function mockCanvas() {
    var log = { texts: [], ops: [] };
    function gradient() { return { addColorStop: function () {} }; }
    var g = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '800 24px sans', textAlign: 'left',
      shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0, globalAlpha: 1,
      lineCap: '', lineJoin: '', letterSpacing: '0px', globalCompositeOperation: 'source-over',
      clearRect: function () {}, fillRect: function () {}, strokeRect: function () { log.ops.push('strokeRect'); },
      beginPath: function () {}, moveTo: function () {}, lineTo: function () {}, closePath: function () {},
      rect: function () {}, arcTo: function () {}, arc: function () {}, ellipse: function () {},
      fill: function () {}, stroke: function () {}, clip: function () {},
      save: function () {}, restore: function () {}, translate: function () {}, scale: function () {}, rotate: function () {},
      createLinearGradient: gradient, createRadialGradient: gradient,
      measureText: function (text) { return { width: textWidth(text, g.font) }; },
      fillText: function (text, x, y) { log.texts.push({ text: String(text), color: g.fillStyle }); },
      strokeText: function () {},
      drawImage: function () {}
    };
    return { canvas: { width: 0, height: 0, getContext: function () { return g; } }, log: log };
  }

  /* ---------- 시트 본문 잡기 (UI 없이) ---------- */
  function captureSheet(fn) {
    var orig = BM.ui.openSheet;
    var got = null;
    BM.ui.openSheet = function (o) { got = o; return null; };
    try { fn(); } finally { BM.ui.openSheet = orig; }
    return got;
  }

  /* ---------- 저장소 (친구·매칭 상대 한 명과 대화방) ---------- */
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }
  function storeWith(extra) {
    clearStorage();
    var rows = [
      D.toRow({ id: 'v172p_me', type: '프로필', createdAt: U.stamp(), date: U.ymd(), nick: '나래', level: 'B조', discipline: '복식', userKey: ME }),
      D.toRow({ id: 'v172p_peer', type: '프로필', createdAt: U.stamp(), date: U.ymd(), nick: '콕집사', level: 'C조', discipline: '복식', userKey: PEER }),
      D.toRow({
        id: 'v172match', type: '매칭신청', createdAt: U.stamp(), date: U.ymd(),
        nick: '나래', userKey: ME, target: PEER, status: '수락',
        payload: { note: '한 게임 해요', heartCost: 2, payOn: 'accept', charged: 0 }
      })
    ].concat(extra || []);
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0, meKey: ME, me: { nick: '나래', level: 'B조', discipline: '복식' } });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * A. 30일 연속 출석 — +5 하트 · 챔피언 배지
   * ========================================================= */

  test('v1.72 30일: 보너스 표에 30일 +5가 마지막 구간으로 있다', function () {
    eq(D.STREAK_BONUSES.length, 4, '구간 4개');
    eq(D.STREAK_BONUSES[3].days, 30, '30일');
    eq(D.STREAK_BONUSES[3].amount, 5, '+5 하트');
    var b = D.streakBonusFor(30);
    ok(b, '30일 보너스 있음');
    eq(b.amount, 5, '30일 +5');
    eq(b.label, '30일 연속 출석 보너스', '이름');
    eq(b.key, 'streak:30', '구간 키');
  });

  test('v1.72 30일: 14일 뒤 반복 구간은 예전처럼 +3 (30일 칸이 반복값을 바꾸지 않는다)', function () {
    eq(D.streakBonusFor(28).amount, 3, '28일 +3');
    eq(D.streakBonusFor(42).amount, 3, '42일도 +3');
    eq(D.streakBonusFor(29), null, '29일은 없음');
    var n = D.nextStreakBonus(14);
    eq(n.days, 30, '14일 뒤 다음은 30일');
    eq(n.amount, 5, '30일은 +5 예고');
    var after = D.nextStreakBonus(30);
    eq(after.days, 42, '30일 뒤 다음은 42일');
    eq(after.amount, 3, '42일은 +3 예고');
  });

  test('v1.72 30일: 챔피언 배지(🏆)는 30일을 채운 사람에게만 열린다', function () {
    eq(D.badgeEmoji('champ'), '🏆', '챔피언 배지 그림');
    eq(D.badgeLabel('champ'), '챔피언', '이름');
    eq(D.decoName('badge:champ'), '배지 · 챔피언', '꾸미기 이름');
    var unlock = D.STREAK_UNLOCKS.filter(function (m) { return m.days === 30; })[0];
    ok(unlock, '30일 해금 규칙');
    eq(unlock.id, 'badge:champ', '30일 = 챔피언 배지');
    includes(D.AVATAR.badges, '🏆', '배지 목록에 🏆');
    var idx = D.index([]);
    eq(D.ownsDeco(idx, ME, 'badge:champ', 29), false, '29일에는 아직 잠김');
    eq(D.ownsDeco(idx, ME, 'badge:champ', 30), true, '30일이면 무료 해금');
    var next = D.nextStreakMilestone(15);
    eq(next.days, 30, '15일째 다음 꾸미기 목표는 30일');
    includes(next.label, '챔피언', '목표 이름');
  });

  test('v1.72 30일: 원장은 30일째에 +5를 한 줄 더하고, 다시 계산해도 한 번뿐', function () {
    var idx = idxOf(streakRows(30));
    var st = D.heartStatus(idx, ME, Date.now());
    var rows = st.history.filter(function (h) { return h.kind === 'streak' && h.label === '30일 연속 출석 보너스'; });
    eq(rows.length, 1, '30일 보너스 한 줄');
    eq(rows[0].delta, 5, '+5');
    eq(rows[0].id, 'v172ck0', '받은 날의 출석 행을 가리킴(중복 방지 키 streak:YYYY-MM-DD 의 근거)');
    eq(st.checkinStreak, 30, '연속 30일');
    eq(st.balance, D.HEART_RULES.BASE + 30 + 1 + 2 + 3 + 3 + 5, '기본 + 출석30 + 3·7·14·28·30 보너스');
    /* 같은 기록을 다시 계산해도 늘 같은 숫자 (멱등) */
    var again = D.heartStatus(idxOf(streakRows(30)), ME, Date.now());
    eq(again.balance, st.balance, '다시 계산해도 잔액 그대로');
    eq(again.history.filter(function (h) { return h.kind === 'streak'; }).length, 5, '보너스 5줄(3·7·14·28·30) 그대로');
  });

  test('v1.72 30일: 출석 체크가 30일째에 +5 보너스를 함께 준다', function () {
    return storeWith(streakRowsBefore(29)).then(function (store) {
      var before = store.state.data.hearts.balance;
      eq(store.state.data.hearts.checkinStreak, 29, '어제까지 29일');
      var r = store.actions.checkIn();
      ok(r.ok, '출석');
      eq(r.streak, 30, '30일째');
      eq(r.bonus, 5, '보너스 +5');
      eq(r.gained, 6, '출석 1 + 보너스 5');
      eq(store.state.data.hearts.balance, before + 6, '잔액 +6');
      eq(store.state.data.hearts.checkinStreak, 30, '연속 30일 표시');
      eq(D.ownsDeco(store.state.data.idx, ME, 'badge:champ', 30), true, '챔피언 배지 해금');
    });
  });

  test('v1.72 30일: MY 하트 카드가 30일 목표와 30일 보너스를 안내한다', function () {
    var hearts = {
      balance: 5, checkinStreak: 26, streakNext: D.nextStreakMilestone(26),
      streakBonus: D.nextStreakBonus(26), history: [], adLimit: 5, adUsedToday: 0, adRemaining: 5,
      canCheckIn: true, checkinReward: 1, adReward: 1, adCooldownSec: 30, nextAdInSec: 0,
      boost: { price: 3, owned: false, equipped: false, bonus: 1 }
    };
    var line = BM.views.my.streakLine(hearts);
    includes(line, '30일까지 4일', '30일 챔피언 배지까지 남은 날');
    includes(line, '배지', '배지 무료');
    var bonus = BM.views.my.streakBonusLine(hearts);
    includes(bonus, '보너스 하트 +5', '30일 보너스 +5 예고');
  });

  /* =========================================================
   * B. 오늘의 하트 부스트 — 오늘 첫 광고 +1 (하루 1회)
   * ========================================================= */

  test('v1.72 부스트: 오늘 첫 광고만 +1 더, 둘째 광고는 예전 그대로', function () {
    return storeWith([]).then(function (store) {
      var before = store.state.data.hearts.balance;
      eq(store.state.data.hearts.adReward, 1, '광고 기본 1');
      eq(store.state.data.hearts.dailyBoostLeft, 1, '오늘 부스트 남음');
      store.state.locks = {};
      var first = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'tx-v172-a' });
      ok(first.ok, '첫 광고');
      eq(first.gained, 2, '1 + 오늘의 부스트 1');
      eq(first.dailyBoost, 1, '부스트 표시');
      eq(store.state.data.hearts.balance, before + 2, '잔액 +2');
      eq(store.state.data.hearts.dailyBoostLeft, 0, '오늘 부스트 소진');
      store.state.locks = {};
      noCooldown(store);
      var second = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'tx-v172-b' });
      ok(second.ok, '둘째 광고');
      eq(second.gained, 1, '예전처럼 +1');
      eq(second.dailyBoost, 0, '부스트 없음');
      eq(store.state.data.hearts.balance, before + 3, '잔액 +3');
      /* 적립 행에는 광고값만 — 부스트는 원장이 한 줄로 더합니다 (두 번 들어가지 않게) */
      var rows = store.state.rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return r.type === '광고하트'; });
      eq(rows.length, 2, '광고 행 2개');
      eq(rows.every(function (r) { return Number(r.likes) === 1; }), true, '행 값은 1 (원장·서버 같은 숫자)');
      var boostRows = store.state.data.hearts.history.filter(function (h) { return h.kind === 'ad-boost'; });
      eq(boostRows.length, 1, '원장의 오늘 부스트 줄은 하루 한 줄');
      eq(boostRows[0].delta, 1, '+1');
      eq(boostRows[0].label, '오늘의 하트 부스트', '이름');
    });
  });

  test('v1.72 부스트: 하루가 바뀌면 다시 생기고, 같은 날 두 광고도 부스트는 한 번', function () {
    var y = U.ymd(U.addDays(new Date(), -1));
    var rows = [
      D.toRow({ id: 'v172ad_y1', type: '광고하트', createdAt: y + ' 09:00:00', date: y, userKey: ME, likes: 1 }),
      D.toRow({ id: 'v172ad_y2', type: '광고하트', createdAt: y + ' 10:00:00', date: y, userKey: ME, likes: 1 }),
      D.toRow({ id: 'v172ad_t1', type: '광고하트', createdAt: U.ymd() + ' 09:00:00', date: U.ymd(), userKey: ME, likes: 1 })
    ];
    var idx = idxOf(rows);
    var st = D.heartStatus(idx, ME, Date.now());
    var boosts = st.history.filter(function (h) { return h.kind === 'ad-boost'; });
    eq(boosts.length, 2, '어제·오늘 각 한 줄(같은 날 두 광고도 한 번)');
    eq(st.balance, D.HEART_RULES.BASE + 3 + 2, '광고 3 + 부스트 2');
    eq(st.dailyBoostLeft, 0, '오늘은 이미 받음');
    eq(st.dailyBoost.usedToday, true, '오늘 받음 표시');
    var noAdsYet = D.heartStatus(idxOf(rows.slice(0, 2)), ME, Date.now());
    eq(noAdsYet.dailyBoostLeft, 1, '오늘 광고 전이면 부스트 남음');
  });

  test('v1.72 부스트: heart_boost(영구 +1)와 함께 쌓인다 — 첫 광고 3개', function () {
    return storeWith([]).then(function (store) {
      var buy = store.actions.buyDeco('boost', 'heart');
      ok(buy.ok && buy.purchased, '하트 부스트 해금');
      store.state.locks = {};
      ok(store.actions.setHeartBoost(true).ok, '켜기');
      eq(store.state.data.hearts.adReward, 2, '광고 +2 (부스트)');
      eq(store.state.data.hearts.dailyBoostLeft, 1, '오늘 부스트도 남음');
      store.state.locks = {};
      var ad = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'tx-v172-boost' });
      ok(ad.ok, '광고');
      eq(ad.boost, 1, '영구 부스트 +1');
      eq(ad.dailyBoost, 1, '오늘 부스트 +1');
      eq(ad.gained, 3, '1 + 1 + 1');
    });
  });

  test('v1.72 부스트: 하루 5회·30초 간격 가드는 그대로', function () {
    return storeWith([]).then(function (store) {
      var got = 0;
      for (var i = 0; i < 5; i++) {
        store.state.locks = {};
        noCooldown(store);
        var r = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'tx-v172-limit-' + i });
        if (r.ok) got++;
      }
      eq(got, 5, '하루 5회');
      store.state.locks = {};
      noCooldown(store);
      var over = store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'tx-v172-limit-6' });
      eq(over.ok, false, '6번째는 막힘');
      eq(over.reason, 'limit', '이유: 한도');
      eq(store.state.data.hearts.dailyBoostLeft, 0, '부스트도 소진');
      eq(store.state.data.hearts.adUsedToday, 5, '오늘 5회');
    });
  });

  test('v1.72 부스트: 안내 문구는 시트·하트 카드 공용 (받기 전/받은 뒤)', function () {
    var g = BM.ads.getStatus({ adReward: 1, adLimit: 5, adUsedToday: 0, adRemaining: 5,
      dailyBoostLeft: 1, dailyBoostAmount: 1, dailyBoost: { amount: 1, usedToday: false, available: true } });
    includes(BM.ads.dailyBoostText(g), '오늘 첫 광고에 +1', '받기 전');
    eq(g.freeHeartsLeft >= 1, true, '무료 하트에 부스트 포함');
    includes(BM.ads.adMeterText(g), '지금 바로 +2', '광고 줄에 부스트 포함');

    var done = BM.ads.getStatus({ adReward: 1, adLimit: 5, adUsedToday: 1, adRemaining: 4,
      dailyBoostLeft: 0, dailyBoostAmount: 1, dailyBoost: { amount: 1, usedToday: true, available: false } });
    includes(BM.ads.dailyBoostText(done), '오늘의 하트 부스트 받음', '받은 뒤');
    includes(BM.ads.adMeterText(done), '지금 바로 +1', '둘째 광고는 +1');

    var noAd = BM.ads.getStatus({ adReward: 1, adLimit: 5, adUsedToday: 5, adRemaining: 0,
      dailyBoostLeft: 1, dailyBoostAmount: 1 });
    eq(noAd.dailyBoostLeft, 0, '오늘 광고가 없으면 부스트도 오늘은 못 받음');
    includes(BM.ads.dailyBoostText(noAd), '내일 첫 광고에', '내일 안내');
  });

  test('v1.72 부스트: MY 하트 카드·공용 충전 시트에 줄과 1탭 채우기 버튼', function () {
    var hearts = {
      balance: 0, checkinReward: 1, checkedInToday: true, canCheckIn: false,
      adReward: 1, adLimit: 5, adUsedToday: 1, adRemaining: 4, adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0,
      dailyBoostLeft: 1, dailyBoostAmount: 1, dailyBoost: { amount: 1, usedToday: false, available: true },
      history: [], boost: { price: 3, owned: false, equipped: false, bonus: 1 }
    };
    var card = BM.views.my.heartCard(hearts);
    includes(card, 'data-daily-boost', '하트 카드의 부스트 줄');
    includes(card, '오늘 첫 광고에 +1', '문구');
    eq(BM.views.my.dailyBoostLine(hearts).indexOf('오늘의 하트 부스트'), 0, '줄 문구');

    var st = { ready: true, mode: 'local', me: { key: ME, nick: '나래' }, rows: [],
      data: { hearts: hearts, idx: D.index([]), matchProfiles: [], threads: [] }, ui: {}, drafts: {}, prefs: {} };
    var ctx = { store: { state: st, actions: {} }, actions: {}, refresh: function () {} };
    var sheet = captureSheet(function () {
      BM.ads.openHeartSheet(ctx, { need: 2, intro: function (s) { return '<p>' + s.balance + '</p>'; } });
    });
    ok(sheet, '시트를 연다');
    includes(sheet.body, 'data-daily-boost', '시트에도 부스트 줄');
    includes(sheet.body, 'data-charge="ad-fill"', '부족할 때 1탭 광고 채우기');
    includes(sheet.body, '광고 보고 +2 받기', '오늘 첫 광고는 +2로 보인다');
    includes(sheet.body, 'data-charge="ad"', '기존 광고 줄은 그대로');
    includes(sheet.body, 'data-charge="checkin"', '출석 줄도 그대로');
  });

  /* =========================================================
   * C. 📅 코트 약속 카드 — 1:1 대화방 1탭 제안·응답
   * ========================================================= */

  test('v1.72 약속: 카드 글은 구조화되고, 깨진 값은 카드로 만들지 않는다', function () {
    var text = D.apptText({ id: 'p1', gym: '나래울체육관', date: '2026-11-27', time: '19:00', note: '첫 게임은 워밍업' });
    includes(text, D.APPT.card, '표시로 시작');
    var ap = D.apptParse(text);
    eq(ap.id, 'p1', 'id');
    eq(ap.gym, '나래울체육관', '체육관');
    eq(ap.date, '2026-11-27', '날짜');
    eq(ap.time, '19:00', '시간');
    eq(ap.note, '첫 게임은 워밍업', '한마디');

    eq(D.apptText({ gym: '', date: '2026-11-27', time: '19:00' }), '', '체육관 없으면 안 만든다');
    eq(D.apptText({ gym: '코트', date: '11/27', time: '19:00' }), '', '날짜 형식 검사');
    eq(D.apptText({ gym: '코트', date: '2026-11-27', time: '저녁' }), '', '시간 형식 검사');
    eq(D.apptParse('안녕하세요'), null, '평범한 글은 null');
    eq(D.apptParse(D.APPT.card + '{깨진'), null, '깨진 JSON 은 null');
    eq(D.apptParse(D.APPT.card + '{"gym":"","date":"2026-11-27","time":"19:00"}'), null, '빈 체육관은 null');
    eq(D.apptText({ gym: '코트<script>', date: '2026-11-27', time: '19:00' }).indexOf('<script>') >= 0, true,
      '값은 그대로 담고(그리는 쪽에서 이스케이프)');
    eq(D.apptWhen('2026-11-27', '19:00'), '11월 27일 (금) 19:00', '보여 줄 때');
    eq(D.apptWhen('2026-11-27', '25:99'), '11월 27일 (금) 25:99', '이상한 시간도 글자로는 보임');
  });

  test('v1.72 약속: 좋아요 / 시간 조정 응답과 목록 미리보기', function () {
    eq(D.apptReplyParse(D.apptReplyText('p1', 'ok')).kind, 'ok', '좋아요');
    eq(D.apptReplyParse(D.apptReplyText('p1', 'adjust')).kind, 'adjust', '시간 조정');
    eq(D.apptReplyParse(D.apptReplyText('p1', 'ok')).id, 'p1', 'id');
    eq(D.apptReplyText('', 'ok'), '', 'id 없으면 안 만든다');
    eq(D.apptReplyParse('평범한 답'), null, '평범한 글은 null');
    var msgs = [{ id: 'm1', userKey: PEER, text: D.apptReplyText('p1', 'ok'), createdAt: '2026-11-25 10:00:00' }];
    eq(D.apptAnswer(msgs, 'p1').kind, 'ok', '카드에 온 답');
    eq(D.apptAnswer(msgs, 'p2'), null, '다른 카드의 답은 아님');
    eq(D.chatTextPreview(D.apptText({ id: 'p', gym: '나래울', date: '2026-11-27', time: '19:00' })),
      '📅 코트 약속 · 나래울 11월 27일 (금) 19:00', '목록 미리보기');
    eq(D.chatTextPreview(D.apptReplyText('p', 'ok')), '👍 약속 좋아요', '응답 미리보기');
    eq(D.chatTextPreview('평범한 글'), '평범한 글', '평범한 글은 그대로');
    excludes(D.apptStatusLabel('ok'), '기다', '확정 문구');
    includes(D.apptStatusLabel(''), '기다', '기다리는 중');
  });

  test('v1.72 약속: 성사된 상대에게만 보낼 수 있고, 응답이 대화에 남는다', function () {
    return storeWith([]).then(function (store) {
      var room = 'v172match';
      var res = store.actions.sendAppt(room, PEER, { gym: '나래울체육관', date: '2026-11-27', time: '19:00', note: '한 게임' });
      ok(res.ok, '친구·매칭 상대에게 보냄');
      ok(res.card && res.card.gym === '나래울체육관', '보낸 카드 돌려줌');
      var row = store.state.rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return r.type === '매칭채팅' && r.team === room; })[0];
      ok(row, '대화 행');
      eq(row.target, PEER, '상대');
      eq(row.userKey, ME, '보낸 사람');
      ok(D.apptParse(row.text), '글에 카드 표시');
      eq(store.actions.sendAppt(room, PEER, { gym: '', date: '2026-11-27', time: '19:00' }).reason, 'empty', '빈 체육관 거절');
      eq(store.actions.sendAppt(room, 'u_v172_stranger', { gym: '코트', date: '2026-11-27', time: '19:00' }).reason,
        'not_allowed', '모르는 사람에게는 못 보냄');

      var ans = store.actions.respondAppt(room, PEER, res.card.id, 'ok');
      store.state.locks = {};
      if (!ans.ok) ans = store.actions.respondAppt(room, PEER, res.card.id, 'ok');
      ok(ans.ok, '좋아요');
      var all = store.state.rows.map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return r.type === '매칭채팅'; });
      eq(all.length, 2, '카드 + 응답 두 줄');
      var thread = (store.state.data.threads || []).filter(function (x) { return String(x.roomId) === room; })[0];
      ok(thread, '대화 목록에 방');
      eq(D.apptAnswer(thread.messages, res.card.id).kind, 'ok', '응답이 대화에 남음');
      var replied = thread.messages.filter(function (m) { return D.apptReplyParse(m.text); })[0];
      ok(replied, '응답 말풍선이 있다');
      eq(D.apptReplyParse(replied.text).kind, 'ok', '응답은 좋아요');
      includes(D.chatTextPreview(replied.text), '좋아요', '목록에는 사람 말로');
    });
  });

  test('v1.72 약속: 대화방에 📅 약속 잡기 버튼과 카드(좋아요·시간 조정)가 그려진다', function () {
    var msgs = [
      { id: 'c1', userKey: PEER, nick: '콕집사', text: D.apptText({ id: 'p9', gym: '나래울체육관', date: '2026-11-27', time: '19:00', note: '한 게임' }),
        createdAt: '2026-11-25 09:00:00' }
    ];
    var state = {
      me: { key: ME, nick: '나래' },
      data: {
        idx: D.index([
          D.toRow({ id: 'pp1', type: '프로필', createdAt: U.stamp(), userKey: PEER, nick: '콕집사' }),
          D.toRow({ id: 'mm1', type: '매칭신청', createdAt: U.stamp(), userKey: ME, target: PEER, status: '수락',
            payload: { heartCost: 2, payOn: 'accept', charged: 0 } })
        ]),
        threads: [{ roomId: 'r1', other: PEER, kind: 'match', messages: msgs, last: msgs[0], unread: 0 }],
        matchProfiles: []
      },
      ui: { chatRoom: 'r1', chatOther: PEER, chatDraft: '' }, prefs: {}
    };
    var html = BM.views.chat.roomHtml(state);
    includes(html, 'data-dm-appt', '입력창 옆 📅 약속 잡기');
    includes(html, '약속 잡기', '버튼 이름');
    includes(html, 'aptcard', '약속 카드');
    includes(html, '나래울체육관', '체육관');
    includes(html, '11월 27일 (금) 19:00', '날짜·시간');
    includes(html, 'data-apt-ok="p9"', '좋아요 1탭');
    includes(html, 'data-apt-adjust="p9"', '시간 조정 1탭');
    includes(html, 'data-apt-gym="나래울체육관"', '조정할 때 값 채우기');
    excludes(html, D.APPT.card, '카드 글(원문)은 화면에 그대로 보이지 않는다');

    /* 답이 오면 버튼 대신 확정 표시 */
    var answered = msgs.concat([{ id: 'c2', userKey: ME, text: D.apptReplyText('p9', 'ok'), createdAt: '2026-11-25 09:05:00' }]);
    state.data.threads[0].messages = answered;
    var html2 = BM.views.chat.roomHtml(state);
    includes(html2, '약속 확정', '확정 표시');
    excludes(html2, 'data-apt-ok="p9"', '확정 뒤에는 버튼이 없다');

    /* 내가 보낸 카드는 답을 기다리는 중 */
    var mine = [{ id: 'c3', userKey: ME, text: D.apptText({ id: 'p10', gym: '코트', date: '2026-11-28', time: '10:00' }), createdAt: '2026-11-25 09:10:00' }];
    state.data.threads[0].messages = mine;
    includes(BM.views.chat.roomHtml(state), '답을 기다리는 중', '기다리는 중');
  });

  test('v1.72 약속: 약속 시트는 체육관·날짜·시간을 받아 보내고, 모자란 값을 잡아 준다', function () {
    var src = readRoot('js/views/chat.js');
    includes(src, 'data-apt-field="gym"', '체육관 칸');
    includes(src, 'type="date"', '날짜 칸');
    includes(src, 'type="time"', '시간 칸');
    includes(src, 'data-apt-send', '보내기 버튼');
    includes(src, '체육관 이름을 적어 주세요', '체육관 검사');
    includes(src, '날짜를 골라 주세요', '날짜 검사');
    includes(src, '시간을 골라 주세요', '시간 검사');
    includes(src, 'sendAppt', 'store 액션 연결');
    includes(readRoot('js/store.js'), 'sendAppt: function', 'store 에 sendAppt');
    includes(readRoot('js/store.js'), 'respondAppt: function', 'store 에 respondAppt');
  });

  test('v1.72 약속: 대화 목록·알림도 JSON 대신 사람 말로 보인다', function () {
    var state = {
      me: { key: ME },
      data: {
        idx: D.index([]), friendRequests: [], matchProfiles: [],
        threads: [{
          roomId: 'r2', other: PEER, kind: 'match', unread: 1,
          last: { userKey: PEER, text: D.apptText({ id: 'p3', gym: '나래울', date: '2026-11-27', time: '19:00' }) }
        }]
      },
      ui: {}, prefs: {}
    };
    var html = BM.views.chat.listHtml(state);
    includes(html, '📅 코트 약속', '목록 미리보기');
    excludes(html, D.APPT.card, '원문 표시 없음');
    includes(readRoot('app.js'), 'chatTextPreview', '알림 배너도 사람 말로');
    includes(readRoot('js/views/matching.js'), 'chatTextPreview', '매칭 탭 대화 목록도 사람 말로');
  });

  /* =========================================================
   * D. 일지 약점 칩 `수비` → 수비 타이밍 코칭
   * ========================================================= */

  test('v1.72 수비: 약점 칩에 수비가 있고, 고르면 수비 코칭 드릴이 나온다', function () {
    includes(D.VOCAB.weakness, '수비', '약점 목록');
    eq(D.VOCAB.weakness.length, 9, '9종');
    var an = BM.ai.analyze({ draft: { weakness: ['수비'], cond: 7, intensity: 6, minutes: 60 }, records: [], level: 'B조', discipline: '복식' });
    var names = (an.drills.drills || []).map(function (d) { return d.name; }).join('|');
    includes(names, '수비 타이밍', '수비 타이밍 코칭 연결');
    includes(JSON.stringify(an), '수비', '분석 결과에 수비');
    eq(an.drills.drills.length, 3, '드릴 3개');
  });

  test('v1.72 수비: 일지 화면 약점 칩이 VOCAB 목록을 그대로 쓴다', function () {
    var log = readRoot('js/views/log.js');
    includes(log, "UI.chips('weakness', D.VOCAB.weakness", '일지 약점 칩');
    includes(readRoot('js/ai.js'), "'수비': [", '수비 드릴 묶음');
    includes(readRoot('js/ai.js'), '수비 타이밍 — 예측했을 때 / 아닐 때', '예측·비예측 수비 코칭');
  });

  /* =========================================================
   * E. 스티커 글씨 색 3종 — 흰색 · 라임 · 골드
   * ========================================================= */

  test('v1.72 스티커: 글씨 색은 흰색·라임·골드 3종, 모르는 값은 흰색', function () {
    var SC = BM.sharecard;
    eq(SC.STICKER_INKS.length, 3, '3색');
    eq(SC.STICKER_INKS.map(function (k) { return k.id; }).join(','), 'white,lime,gold', '순서·이름');
    eq(SC.STICKER_INKS[0].fill, '#ffffff', '기본 흰색');
    eq(SC.inkById('lime').name, '라임', '라임');
    eq(SC.inkById('gold').fill, '#ffd166', '골드');
    eq(SC.inkById('보라').id, 'white', '모르는 값은 흰색');
    eq(SC.inkById(null).id, 'white', '빈 값도 흰색');
  });

  test('v1.72 스티커: 고른 색이 스펙·캔버스·시트 칩에 그대로 간다', function () {
    var SC = BM.sharecard;
    var spec = {
      mode: 'today', design: 'sticker', ratio: 'feed', shade: 'original', palette: 'night', bg: '',
      photo: null, textPos: 'bottom', showNums: true, ink: 'gold',
      phrase: '민턴일기', big: { value: '90', unit: '분' }, label: '2승 1패', top: '', tagLine: ''
    };
    var m = mockCanvas();
    SC.draw(m.canvas, spec);
    var gold = m.log.texts.filter(function (x) { return x.text === '90'; })[0];
    ok(gold, '큰 숫자를 그린다');
    eq(gold.color, '#ffd166', '골드로 그린다');
    var unit = m.log.texts.filter(function (x) { return x.text === '분'; })[0];
    eq(unit.color, '#ffd166', '단위도 같은 색');

    var white = mockCanvas();
    SC.draw(white.canvas, Object.assign({}, spec, { ink: 'white' }));
    eq(white.log.texts.filter(function (x) { return x.text === '90'; })[0].color, '#ffffff', '흰색은 예전 그대로');
    eq(white.log.texts.filter(function (x) { return x.text === '분'; })[0].color !== '#ffd166', true,
      '흰색일 때 단위는 카드 색(예전 그대로)');

    /* 무드(숫자 숨기기)도 같은 색 */
    var mood = mockCanvas();
    SC.draw(mood.canvas, Object.assign({}, spec, { showNums: false, ink: 'lime', phrase: '땀샷' }));
    var hit = mood.log.texts.filter(function (x) { return x.text === '땀샷'; })[0];
    eq(hit.color, '#ccff4d', '무드 글씨도 라임');

    var body0 = { store: { state: { me: {}, data: { records: [], matchProfiles: [] }, ui: {} } } };
    SC._setState({ mode: 'today', design: 'sticker', ratio: 'feed', shade: 'original', palette: 'night',
      bg: '', photo: null, textPos: 'bottom', nums: 'show', ink: 'gold',
      phrase: '민턴일기', phraseComp: '', recordId: '', gym: '', partner: '', rival: '',
      contest: '', event: '', result: '우승', compPartner: '', date: U.ymd() });
    var body = SC._sheetBody(body0);
    includes(body, 'data-sc-inkbox', '시트에 글씨 색 칸');
    includes(body, 'data-sc-ink="white"', '흰색 칩');
    includes(body, 'data-sc-ink="lime"', '라임 칩');
    includes(body, 'data-sc-ink="gold"', '골드 칩');
  });

  test('v1.72 스티커: 색은 스티커에서만, 기기에 기억된다', function () {
    var src = readRoot('js/sharecard.js');
    includes(src, 'inkPicks()', '칸을 그린다');
    includes(src, 'sticker ? \'\' : \' hidden\'', '스티커가 아니면 숨김');
    includes(src, 'writePrefs({ ink: ui.ink })', '기기에 기억');
    includes(src, 'ink: inkById(prefs.ink).id', '다시 열면 그 색');
    includes(src, 'data-sc-inkbox', '화면에서 숨김/보임 토글');
  });

  /* =========================================================
   * F. 기존 기능 보호 · 안전 · 버전
   * ========================================================= */

  test('v1.72 보호: 하트 규칙(5회·30초·2개·1개)과 보상 값은 그대로', function () {
    eq(D.HEART_RULES.AD_PER_DAY, 5, '하루 5회');
    eq(D.HEART_RULES.AD_COOLDOWN_SEC, 30, '30초');
    eq(D.HEART_RULES.MATCH_COST, 2, '매칭 2개');
    eq(D.HEART_RULES.GIFT_COST, 1, '선물 1개');
    eq(D.HEART_RULES.AD_REWARD, 1, '광고 1개');
    eq(D.HEART_RULES.CHECKIN, 1, '출석 1개');
    eq(D.BOOST_BONUS, 1, '부스트 +1');
    eq(D.decoPrice('boost:heart'), 3, '하트 부스트 3개');
    eq(D.decoPrice('card:champ'), 2, '챔피언 카드 프레임 2개');
  });

  test('v1.72 보호: 기존 대화 기능(말풍선·링크·매너 태그·신고)은 그대로', function () {
    var chat = readRoot('js/views/chat.js');
    includes(chat, 'D.linkify(m.text)', '링크 말풍선');
    includes(chat, 'data-dm-safety', '신고·차단');
    includes(chat, 'data-manner-tag', '매너 태그');
    includes(chat, 'data-vite-leave', '단체방 나가기');
    includes(chat, 'sendChat', '평범한 메시지');
    includes(readRoot('js/store.js'), 'sendChat: function', 'store sendChat');
  });

  test('v1.72 안전: 실존 선수 이름·민감값·서버 전송이 없다', function () {
    var files = ['js/domain.js', 'js/ads.js', 'js/store.js', 'js/views/my.js', 'js/views/chat.js', 'js/sharecard.js'];
    var names = ['김원호', '안세영', '서승재', '이용대'];
    files.forEach(function (f) {
      var src = readRoot(f);
      names.forEach(function (n) { excludes(src, n, f + ' 실존 선수 이름 없음'); });
      excludes(src, 'AIza', f + ' 구글 키 없음');
      excludes(src, 'AKfycb', f + ' 시트 웹앱 ID 없음');
    });
    /* 새 시트 칸·새 DB 컬럼 없이 기존 글(text)·행만 씀 */
    var dom = readRoot('js/domain.js');
    includes(readRoot('js/store.js'), "type: '매칭채팅'", '약속도 기존 매칭채팅 행');
    excludes(dom, "'약속카드'", '새 행 유형을 만들지 않음');
  });

  test('v1.72 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.72.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.72.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261125-1', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.72.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.72.0', 'TWA appVersion');
    eq(twa.appVersionCode, 66, 'TWA 버전 코드');
    includes(readRoot('README.md'), 'bm-v1.72.0', 'README 변경 이력');
    includes(readRoot('test/run.js'), 'test/v172.test.js', '테스트 목록');
    includes(readRoot('sw.js'), 'bm-v1.72.0', swIconCheck(readRoot('sw.js')));
  });

  function swIconCheck(sw) {
    return sw.indexOf('bm-v1.72.0') >= 0 ? '버전 캐시 키' : '버전 없음';
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
