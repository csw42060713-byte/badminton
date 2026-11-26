/* ============================================================
 * test/v147.test.js — bm-v1.47.0
 *   하트 지갑 실시간 쿨타임 · AdMob 다중 슬롯 · 꾸미기 미리보기 · 코치 소속 → 지도
 *
 *  1) 광고 슬롯 — heart_reward 외 heart_boost · report_detail 을 setUnits 로 등록·조회,
 *     모르는 이름은 버리고, 등록이 없으면 heart_reward 로 재생 (txId 중복 차단·동시 실행 잠금 유지)
 *  2) 실시간 표시 — '남은 3/5회 · 다음 광고까지 12초' (MY 하트 카드 · 충전 시트가 1초마다)
 *  3) 1탭 충전 — watchForHeart: 하트가 모자란 자리에서 재생→적립까지 한 번에
 *  4) 꾸미기 미리보기 — 잠긴 프레임/배지를 내 사진·닉네임에 적용해 먼저 보고(지금 ↔ 적용 후),
 *     하트가 충분하면 1탭 해금, 모자라면 '광고 보고 하트 +1'
 *  5) 코치 소속 체육관 → 지도 — 활동 소속이 등록 체육관(120곳)과 이어지면 탭 한 번에 지도
 *  6) 버전 · 배선 · 보안
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

  var ME = 'u_v147_me';

  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0, meKey: ME, me: { nick: '나래', level: 'B조', discipline: '복식' } });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function rowsWith(extra) {
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(D.toRow(e)); });
    return rows;
  }

  function mentorRow(opts) {
    opts = opts || {};
    var payload = {
      type: opts.type || '체육관 코치', affiliation: opts.affiliation || '', experience: '7년',
      awards: '시 대회 3위', proof: opts.proof || '', proofUrl: '', proofPhoto: '',
      reason: '성인반을 봅니다', status: '승인', submitted: U.stamp(), level: 'B조', discipline: '복식'
    };
    return {
      id: opts.id || 'mentor-147', type: '멘토신청', createdAt: U.stamp(), date: U.ymd(),
      nick: opts.nick || '코치', userKey: opts.userKey || 'demo_chi',
      target: D.ADMIN_TARGET, payload: payload, status: '승인'
    };
  }

  /* 꾸미기 미리보기 본문은 화면 없이도 만들 수 있습니다 — 하트 상태만 있는 작은 상태 */
  function heartsSnap(balance, patch) {
    var h = {
      balance: balance, todayEarned: 0, earned: 0, spent: 0, history: [],
      checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 1, adRemaining: 4,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0,
      matchCost: 2, giftCost: 1
    };
    Object.keys(patch || {}).forEach(function (k) { h[k] = patch[k]; });
    return h;
  }

  function previewCtx(balance, patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래' },
      data: { hearts: heartsSnap(balance, patch), idx: { all: [], byType: {}, byId: {} }, records: [] },
      ui: {}
    };
    return { store: { state: st }, actions: {} };
  }

  var DRAFT = {
    nick: '나래', photo: '', emoji: '🏸', frame: 'basic', bg: 'mint', badge: '',
    level: 'B조', discipline: '복식', gender: '남', style: '공격형', region: '경기', club: '나래울', bio: ''
  };

  function previewBody(ctx, shown, d) {
    return BM.views.my.decoPreviewBody(ctx, d || { id: 'frame:gold', price: 2, owned: false, kind: 'frame', value: 'gold' },
      DRAFT, ctx.store.state.me || { nick: '나래' }, shown || 'next');
  }

  /* =========================================================
   * 1. 광고 슬롯 (AdMob 다중 슬롯)
   * ========================================================= */

  test('v1.47 광고 슬롯: heart_boost · report_detail 을 등록하고 이름으로 찾는다', function () {
    var slots = BM.ads.SLOTS;
    ok(slots.indexOf('heart_reward') >= 0, '기본 슬롯');
    ok(slots.indexOf('heart_boost') >= 0, '하트 2배 슬롯');
    ok(slots.indexOf('report_detail') >= 0, '상세 리포트 슬롯');

    var before = BM.ads.unitOf('heart_reward');
    var out = BM.ads.setUnits({ heart_boost: 'ca-app-pub-test/heart_boost', report_detail: 'ca-app-pub-test/report' });
    eq(out.heart_boost, 'ca-app-pub-test/heart_boost', '등록값');
    eq(BM.ads.unitOf('heart_boost'), 'ca-app-pub-test/heart_boost', '이름으로 찾기');
    eq(BM.ads.unitOf('report_detail'), 'ca-app-pub-test/report', '두 번째 슬롯');
    ok(BM.ads.hasUnit('heart_boost'), '등록됨');
    eq(BM.ads.unitOf('report_detail'), 'ca-app-pub-test/report', '조회');
    eq(BM.ads.unitOf('heart_reward'), before, '기본 슬롯은 그대로');

    /* 모르는 이름(오타)은 조용히 버립니다 — 잘못된 광고 단위로 재생하지 않게 */
    BM.ads.setUnits({ heart_bost: 'ca-app-pub-test/typo' });
    eq(BM.ads.unitOf('heart_bost'), before, '오타 슬롯은 무시');
    ok(!BM.ads.hasUnit('heart_bost'), '오타는 등록되지 않음');

    /* 빈 값은 그 슬롯의 등록을 지우고 기본(heart_reward) 단위로 돌아갑니다 */
    BM.ads.setUnits({ heart_boost: '' });
    eq(BM.ads.unitOf('heart_boost'), before, '지우면 기본 단위');
    ok(!BM.ads.hasUnit('heart_boost'), '등록 해제');
    eq(BM.ads.unitOf('report_detail'), 'ca-app-pub-test/report', '다른 슬롯은 그대로');

    /* 등록이 없는 슬롯은 heart_reward 단위로 재생 */
    eq(BM.ads.unitOf('없는슬롯'), before, '모르는 슬롯 → 기본 단위');
    ok(BM.ads.slotNames().length >= 3, '슬롯 이름 목록');
  });

  test('v1.47 광고 슬롯: 등록하지 않은 슬롯은 heart_reward 단위로 재생한다', function () {
    var base = BM.ads.unitOf('heart_reward');
    BM.ads.setUnits({ heart_boost: '' });
    BM.ads.setUnits({ heart_boost: 'ca-app-pub-test/hb' });
    eq(BM.ads.unitOf('heart_boost'), 'ca-app-pub-test/hb', '등록 후에는 그 단위');
    BM.ads.setUnits({ heart_boost: '' });
    eq(BM.ads.unitOf('heart_boost'), base, '지우면 기본 단위');
    ok(!BM.ads.hasUnit('heart_boost'), '등록 전 hasUnit false');
  });

  test('v1.47 광고: txId 가 같으면 두 번 적립되지 않는다 (중복 차단 유지)', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      var r1 = store.actions.watchAd({ verified: true, adUnit: 'heart_boost', txId: 'tx-v147-dup' });
      ok(r1.ok, '첫 적립');
      /* 오늘 첫 광고라 오늘의 하트 부스트 +1이 함께 붙습니다 (bm-v1.73.0) */
      eq(r1.gained, 2, '+1 + 오늘 부스트 1');
      eq(r1.dailyBoost, 1, '오늘 부스트');
      var r2 = store.actions.watchAd({ verified: true, adUnit: 'heart_boost', txId: 'tx-v147-dup' });
      eq(r2.ok, false, '두 번째는 막힘');
      eq(r2.reason, 'duplicate', '이유: duplicate');
      eq(store.state.data.hearts.balance, before + 2, '한 번만 들어감');
      /* 어느 슬롯에서 봤는지가 적립 행(target)에 남습니다 */
      var row = (store.state.rows || []).map(function (r) { return Array.isArray(r) ? D.fromRow(r) : r; })
        .filter(function (r) { return r.type === '광고하트' && r.target === 'heart_boost'; })[0];
      ok(row, '슬롯 이름이 남은 적립 행');
      eq(row.target, 'heart_boost', '슬롯 이름이 남음');
    });
  });

  test('v1.47 광고: 광고가 도는 동안 다시 부르면 busy 로 막는다 (동시 실행 잠금 유지)', function () {
    var p1 = BM.ads.showRewarded({ unit: 'heart_reward' });
    var p2 = BM.ads.showRewarded({ unit: 'heart_reward' });
    ok(BM.ads.busy(), '진행 중 표시');
    return Promise.all([p1, p2]).then(function (list) {
      eq(list[1].busy, true, '두 번째는 busy');
      eq(list[1].reason, 'in_flight', '이유: in_flight');
      eq(list[0].rewarded, false, '화면이 없는 테스트에서는 재생 불가(no_dom)');
      eq(list[0].reason, 'no_dom', 'no_dom');
      ok(list[1].txId, '두 번째 호출에도 txId');
      ok(!list[0].txId || list[0].txId !== list[1].txId, '호출마다 다른 txId');
      ok(!BM.ads.busy(), '끝나면 잠금 해제');
    });
  });

  /* =========================================================
   * 2. 실시간 쿨타임 · 남은 횟수
   * ========================================================= */

  test('v1.47 표시: adMeterText 가 남은 횟수와 쿨타임을 한 줄로 쓴다', function () {
    var now = U.parseYmd('2026-11-22').getTime() + 10 * 3600 * 1000;
    var cooling = BM.ads.getStatus({
      balance: 3, adLimit: 5, adUsedToday: 2, adReward: 1, adCooldownSec: 30,
      nextAdAt: now + 12000
    }, now);
    eq(BM.ads.adMeterText(cooling), '남은 3/5회 · 다음 광고까지 12초', '쿨타임');

    var ready = BM.ads.getStatus({
      balance: 3, adLimit: 5, adUsedToday: 2, adReward: 1, adCooldownSec: 30, nextAdAt: 0
    }, now);
    eq(BM.ads.adMeterText(ready), '남은 3/5회 · 지금 바로 +1', '지금 바로');

    var done = BM.ads.getStatus({ adLimit: 5, adUsedToday: 5, adRemaining: 0, nextAdAt: 0 }, now);
    eq(BM.ads.adMeterText(done), '남은 0/5회 · 오늘 모두 받았어요', '한도');

    eq(BM.ads.adMeterText(BM.ads.getStatus({ adLimit: 0 }, now)), '오늘 광고 없음', '광고 없음');
    eq(BM.ads.adMeterText(null), '', '값이 없으면 빈 줄');
  });

  test('v1.47 표시: 1초마다 초가 줄어든다 (getStatus 는 절대 시각으로 다시 계산)', function () {
    var now = U.parseYmd('2026-11-22').getTime() + 10 * 3600 * 1000;
    var h = { adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30, nextAdAt: now + 30000 };
    var a = BM.ads.getStatus(h, now);
    var b = BM.ads.getStatus(h, now + 5000);
    var c = BM.ads.getStatus(h, now + 30000);
    eq(a.nextAdInSec, 30, '처음 30초');
    eq(b.nextAdInSec, 25, '5초 뒤 25초');
    includes(BM.ads.adMeterText(a), '다음 광고까지 30초', '문구 A');
    includes(BM.ads.adMeterText(b), '다음 광고까지 25초', '문구 B');
    ok(c.canWatchAd, '0초가 되면 바로 볼 수 있음');
    includes(BM.ads.adMeterText(c), '지금 바로', '0초 문구');
  });

  test('v1.47 MY 하트 카드: 남은 횟수(N/5) 자리와 광고 줄을 함께 그린다', function () {
    var st = {
      ready: true, me: { key: ME, nick: '나래' },
      data: { hearts: heartsSnap(3, { adUsedToday: 2, adRemaining: 3, nextAdAt: U.nowStamp ? 0 : 0 }), idx: { byType: {} } },
      ui: {}
    };
    var html = BM.views.my.heartCard(st.data.hearts);
    includes(html, 'data-ad-sub', '광고 줄');
    includes(html, 'data-ad-stat', '오늘 광고 칸');
    includes(html, '남은 3/5회', '남은 횟수 N/5');
    includes(html, '2/5', '오늘 광고 칸 숫자');
    excludes(html, 'undefined', 'undefined 없음');
    /* 1초마다 다시 쓰는 코드 경로가 살아 있다 */
    if (hasNode) {
      var src = readRoot('js/views/my.js');
      includes(src, 'data-ad-stat', '카드에 갱신 자리');
      includes(src, 'stat.textContent = h.adUsedToday', '타이머가 숫자를 갱신');
      includes(src, 'BM.ads.adMeterText', '남은 횟수·쿨타임 문구 공용');
    }
  });

  test('v1.47 하트 충전 시트: 광고 줄이 남은 횟수·쿨타임을 쓴다', function () {
    if (!hasNode) return;
    var src = readRoot('js/ads.js');
    includes(src, 'adMeterText(s)', '시트 광고 줄');
    includes(src, 'function adMeterText', '함수');
    includes(src, 'sub.textContent = adMeterText(s)', '1초마다 다시');
    includes(src, 'watchForHeart: watchForHeart', '내보냄');
    includes(src, 'adMeterText: adMeterText', '내보냄');
  });

  /* =========================================================
   * 3. 하트 1탭 충전 (watchForHeart)
   * ========================================================= */

  /* 네이티브 광고 브리지(AndroidBridge)를 잠시 붙여 광고 결과를 손으로 돌려줍니다 */
  function withBridge(fn) {
    var g = (typeof globalThis !== 'undefined') ? globalThis : root;
    var prev = g.AndroidBridge;
    g.AndroidBridge = { showRewardedAd: function () { /* 광고 SDK 대신 테스트가 결과를 준다 */ } };
    function restore() { g.AndroidBridge = prev; }
    return Promise.resolve().then(fn).then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
  }

  test('v1.47 1탭: watchForHeart 가 재생 결과를 바로 적립한다', function () {
    return freshStore().then(function (store) {
      var ctx = { store: store, actions: store.actions };
      var before = store.state.data.hearts.balance;

      return withBridge(function () {
        var p = BM.ads.watchForHeart(ctx, { silent: true });
        BM.ads.onRewardAdResult(true, 'heart_reward', 'tx-v147-native');
        return p.then(function (res) {
          ok(res.ok, '적립 성공');
          eq(res.gained, 2, '+1 + 오늘의 하트 부스트 1');
          eq(store.state.data.hearts.balance, before + 2, '잔액 +2');
          eq(res.balance, before + 2, '결과에 잔액');
          eq(res.remaining, 4, '오늘 남은 4회');

          /* 같은 txId 로 한 번 더 오면 중복으로 막힌다 */
          var p2 = BM.ads.watchForHeart(ctx, { silent: true });
          BM.ads.onRewardAdResult(true, 'heart_reward', 'tx-v147-native');
          return p2.then(function (again) {
            eq(again.ok, false, '중복은 적립 안 됨');
            eq(again.reason, 'duplicate', '이유: duplicate');
            eq(store.state.data.hearts.balance, before + 2, '잔액 그대로');
          });
        });
      });
    });
  });

  test('v1.47 1탭: 광고를 끝까지 보지 않으면 적립하지 않는다', function () {
    return freshStore().then(function (store) {
      var ctx = { store: store, actions: store.actions };
      var before = store.state.data.hearts.balance;
      return withBridge(function () {
        var p = BM.ads.watchForHeart(ctx, { silent: true });
        BM.ads.onRewardAdResult(false, 'heart_reward', 'tx-v147-cancel');
        return p.then(function (res) {
          eq(res.ok, false, '적립 없음');
          eq(res.reason, 'not_rewarded', '이유: not_rewarded');
          eq(store.state.data.hearts.balance, before, '잔액 그대로');
          return BM.ads.watchForHeart(null, {});
        }).then(function (res2) {
          eq(res2.ok, false, '저장소가 없으면');
          eq(res2.reason, 'no_store', '이유: no_store');
        });
      });
    });
  });

  test('v1.47 1탭 입구: 매칭 카드·편지지에 "광고 보고 +1" 버튼이 있다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/matching.js');
    includes(src, 'data-act="ad-heart"', '매칭 내 카드');
    includes(src, 'data-letter-ad', '편지지 시트');
    includes(src, 'BM.ads.watchForHeart', '한 곳으로 모음');
    includes(src, 'function adOneTap', '공용 함수');
    includes(readRoot('js/views/my.js'), 'BM.ads.watchForHeart', '꾸미기 미리보기에서도 같은 흐름');
  });

  /* =========================================================
   * 4. 꾸미기 미리보기 → 1탭 해금
   * ========================================================= */

  test('v1.47 미리보기: 적용 후 모습을 내 사진·닉네임으로 보여 준다', function () {
    var ctx = previewCtx(3);
    var next = previewBody(ctx, 'next');
    includes(next, '지금 모습', '비교 버튼 1');
    includes(next, '적용 후', '비교 버튼 2');
    includes(next, 'data-frame="gold"', '골드 프레임으로 그린 아바타');
    includes(next, '나래', '내 닉네임');
    includes(next, '프레임 · 골드', '꾸미기 이름');
    includes(next, 'data-dpv-act="unlock"', '해금 버튼');
    includes(next, '하트 2개로 열기', '1탭 해금 문구');
    excludes(next, 'undefined', 'undefined 없음');
    excludes(next, 'NaN', 'NaN 없음');

    var now = previewBody(ctx, 'now');
    includes(now, 'data-frame="basic"', '지금 모습은 원래 프레임');
    excludes(now, 'data-frame="gold"', '지금 모습에 골드 없음');
  });

  test('v1.47 미리보기: 하트가 모자라면 "광고 보고 하트 +1" 로 잇는다', function () {
    var ctx = previewCtx(0, { adUsedToday: 2, adRemaining: 3, nextAdAt: 0 });
    var body = previewBody(ctx, 'next');
    includes(body, 'data-dpv-act="ad"', '광고 버튼');
    includes(body, '광고 보고 하트 +1', '문구');
    includes(body, '2개 부족', '모자란 수');
    includes(body, '남은 3/5회', '남은 광고 횟수');
    excludes(body, 'data-dpv-act="unlock"', '아직 해금 버튼 없음');

    /* 오늘 광고를 다 봤으면 광고 버튼 대신 안내 */
    var spent = previewBody(previewCtx(0, { adUsedToday: 5, adRemaining: 0 }), 'next');
    includes(spent, '오늘 광고를 모두 봤어요', '한도 안내');
    excludes(spent, 'data-dpv-act="ad"', '광고 버튼 없음');
  });

  test('v1.47 미리보기: 잠긴 배지도 같은 흐름 (칭호·배지)', function () {
    var d = { id: 'badge:crown', price: 2, owned: false, kind: 'badge', value: '👑' };
    var ctx = previewCtx(2);
    var body = previewBody(ctx, 'next', d);
    includes(body, 'data-dpv-act="unlock"', '해금');
    includes(body, '배지 · 왕관', '이름');
    includes(body, '👑', '배지 그림');
    var poor = previewBody(previewCtx(1), 'next', d);
    includes(poor, 'data-dpv-act="ad"', '모자라면 광고');
  });

  test('v1.47 미리보기: 꾸미기 화면의 잠긴 칸이 미리보기로 이어진다 (배선)', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/my.js');
    includes(src, "openDecoPreviewSheet(ctx, 'frame'", '프레임');
    includes(src, "openDecoPreviewSheet(ctx, 'badge'", '배지');
    excludes(src, 'unlockDeco(ctx', '예전 확인창 경로 제거');
    includes(src, 'BM.views.my.openDecoPreviewSheet = openDecoPreviewSheet', '테스트용 내보냄');
    includes(readRoot('styles.css'), '.decoprev__seg', '스타일');
  });

  /* =========================================================
   * 5. 코치 소속 체육관 → 지도
   * ========================================================= */

  test('v1.47 코치 소속: 활동 소속을 등록 체육관(120곳)과 이어 찾는다', function () {
    var one = BM.views.coach.affVenues('나래울 배드민턴장');
    eq(one.length, 1, '한 곳');
    eq(one[0].id, 'naraeul', '나래울');

    var two = BM.views.coach.affVenues('나래울 배드민턴장 · 매원고 배드민턴부');
    eq(two.length, 2, '두 곳');
    eq(two.map(function (v) { return v.id; }).join(','), 'naraeul,maewon', '·로 나눠 각각');

    eq(BM.views.coach.affVenues('어딘가 배드민턴 클럽 3호점').length, 0, '등록에 없으면 없음');
    eq(BM.views.coach.affVenues('').length, 0, '빈 소속');
    eq(BM.views.coach.affVenues(null).length, 0, 'null');
  });

  test('v1.47 코치 소속: 칩을 누르면 그 체육관 지도로 (id·이름·안내)', function () {
    var row = BM.views.coach.affMapRow('나래울 배드민턴장');
    includes(row, 'data-gym-open="naraeul"', '지도 열기 id');
    includes(row, '나래울 배드민턴장', '한 곳일 때도 체육관 이름');
    includes(row, 'coachcard__gyms', '스타일 자리');
    /* bm-v1.52.2 — 소속 이름 자체가 누를 수 있는 칩 */
    var aff = BM.views.coach.affRow('나래울 배드민턴장');
    includes(aff, '나래울 배드민턴장', '소속 이름 칩');
    includes(aff, 'data-gym-open="naraeul"', '소속 이름 클릭 → 지도');
    includes(BM.views.coach.affRow('우리동네 크루'), 'coachcard__gymname', '등록에 없으면 글자만');
    excludes(BM.views.coach.affRow('우리동네 크루'), 'data-gym-open', '없는 곳은 링크 없음');

    var rows2 = BM.views.coach.affMapRow('나래울 배드민턴장 · 매원고 배드민턴부');
    includes(rows2, 'data-gym-open="naraeul"', '첫째');
    includes(rows2, 'data-gym-open="maewon"', '둘째');
    includes(rows2, '매원고등학교 체육관', '두 곳일 때는 이름으로 구분');
    eq(BM.views.coach.affMapRow('없는 체육관'), '', '이어지지 않으면 칩 없음');
  });

  test('v1.47 코치 카드: 승인된 코치의 소속이 등록 체육관이면 지도 입구가 붙는다', function () {
    return freshStore(rowsWith([mentorRow({
      id: 'mentor-147-a', userKey: 'demo_chi', nick: '콕집사', type: '체육관 코치',
      affiliation: '나래울 배드민턴장', proof: '재직 확인'
    })])).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      includes(html, 'data-coach="demo_chi"', '코치 카드');
      includes(html, '나래울 배드민턴장', '소속 이름');
      includes(html, '활동 증명됨', '활동 증명됨');
      includes(html, 'data-gym-open="naraeul"', '지도 입구');
      includes(html, 'coachcard__gyms', '칩 줄');
    });
  });

  test('v1.47 코치 카드: 등록에 없는 소속이면 지도 입구를 만들지 않는다', function () {
    return freshStore(rowsWith([mentorRow({
      id: 'mentor-147-b', userKey: 'demo_suttle', nick: '셔틀버스', type: '개인 멘토',
      affiliation: '우리동네 배드민턴 크루', proof: ''
    })])).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      includes(html, 'data-coach="demo_suttle"', '코치 카드');
      includes(html, '우리동네 배드민턴 크루', '소속 글자');
      includes(html, 'coachcard__gymname', '글자로만');
      excludes(html, 'coachcard__gyms [data-gym-open', '소속 지도 칩 없음');
    });
  });

  /* =========================================================
   * 6. 버전 · 배선 · 보안
   * ========================================================= */

  test('v1.47 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.86.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.86.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261126-8', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.86.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 80', '앱 버전 코드');
  });

  test('v1.47 배선: 새 파일 없이 기존 파일만 바뀐다 (서비스워커·테스트 목록)', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v147.test.js', '테스트 목록');
    var sw = readRoot('sw.js');
    includes(sw, './js/ads.js', '광고');
    includes(sw, './js/views/coach.js', '코치');
    includes(sw, './js/views/my.js', 'MY');
    excludes(sw, './js/decopreview.js', '새 파일 없음');
  });

  test('v1.47 보안: CSP·주소 필터 그대로, 새 화면도 esc 를 쓴다', function () {
    if (!hasNode) return;
    var index = readRoot('index.html');
    includes(index, "object-src 'none'", 'CSP object-src');
    includes(index, "base-uri 'none'", 'CSP base-uri');
    includes(index, "script-src 'self' https://accounts.google.com 'sha256-", '스크립트는 self·구글·해시만');
    var my = readRoot('js/views/my.js');
    includes(my, 'U.esc(name)', '미리보기 이름 탈출');
    includes(my, 'U.esc(decoMeta(view))', '지역·체육관 탈출');
    var coach = readRoot('js/views/coach.js');
    includes(coach, "U.esc(v.id)", '체육관 id 탈출');
    includes(coach, 'U.esc(v.name', '체육관 이름 탈출');
    excludes(coach, "innerHTML = aff", '문자열 그대로 넣지 않음');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
