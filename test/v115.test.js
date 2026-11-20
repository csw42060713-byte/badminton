/* ============================================================
 * test/v115.test.js — v1.15.0 (2026-11-20)
 *  1) ads.getStatus: nextAdAt(절대 시각)에서 남은 초를 매번 다시 계산한다
 *     — 시트·MY 카드의 "다음 광고까지 N초"가 0초가 되면 버튼이 열린다
 *  2) ads.showRewarded 중복 실행 잠금(inFlight): 진행 중이면 새 창 없이 busy
 *  3) 공용 하트 충전 시트: 출석·광고·오늘 남은 무료 하트·이어서 하기
 *  4) MY 하트 카드: "오늘 받을 수 있는 무료 하트 N개 남음" 배지
 *  5) 하트가 모자란 자리(매칭·선물·테마·프레임/배지)가 모두 공용 시트로 이어진다
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', gender: '비공개', style: '공격형',
    theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf(extra) {
    var rows = BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: {
        tab: 'my',
        matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', matchSort: 'score', matchFilterOpen: '',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (extra) Object.keys(extra).forEach(function (k) { st.data.hearts[k] = extra[k]; });
    return st;
  }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function hasNode() { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }

  /* ---------- 1. 실시간 쿨타임 계산 ---------- */

  test('v1.15 ads.getStatus: nextAdAt에서 남은 초를 다시 계산한다', function () {
    var now = 1700000000000;
    var h = {
      balance: 2, checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 1, adRemaining: 4,
      adCooldownSec: 30, nextAdInSec: 99, nextAdAt: now + 12500
    };
    var s = BM.ads.getStatus(h, now);
    eq(s.nextAdInSec, 13, '남은 초(올림)');
    eq(s.canWatchAd, false, '쿨다운 동안은 잠김');
    eq(BM.ads.adText(s), '다음 광고까지 13초', '시트·카드 문구');

    var later = BM.ads.getStatus(h, now + 13000);
    eq(later.nextAdInSec, 0, '지나면 0초');
    eq(later.canWatchAd, true, '0초가 되면 열린다');
    eq(BM.ads.adText(later), '남은 4회', '쿨다운이 끝나면 남은 횟수');

    /* 오늘 받을 수 있는 무료 하트 = 출석 1 + 광고 4 */
    eq(s.freeHeartsLeft, 5, '무료 하트');
    eq(s.freeChancesLeft, 5, '받을 수 있는 횟수');
    includes(BM.ads.freeText(s), '오늘 받을 수 있는 무료 하트 5개 남음', '한 줄 배지');
  });

  test('v1.15 ads.getStatus: 한도를 다 채우면 무료 하트 0 · 버튼 잠금', function () {
    var s = BM.ads.getStatus({
      balance: 1, checkinReward: 1, checkedInToday: true, canCheckIn: false,
      adReward: 1, adLimit: 5, adUsedToday: 5, adRemaining: 0,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0
    });
    eq(s.adRemaining, 0, '남은 광고 없음');
    eq(s.canWatchAd, false, '잠김');
    eq(s.freeHeartsLeft, 0, '무료 하트 없음');
    eq(BM.ads.freeText(s), '오늘 무료 하트를 모두 받았어요', '완료 문구');
    includes(BM.ads.freeDetail(s), '출석 완료', '상세');
    includes(BM.ads.adText(s), '오늘 모두 받았어요', '한도 문구');
  });

  /* ---------- 2. 중복 실행 잠금 ---------- */

  test('v1.15 광고 중복 실행 잠금: 진행 중이면 새 창 없이 busy', function () {
    var first = BM.ads.showRewarded({ unit: 'heart_reward' });
    ok(BM.ads.busy(), '진행 중');
    var second = BM.ads.showRewarded({ unit: 'heart_reward' });
    return Promise.all([first, second]).then(function (r) {
      eq(r[0].reason, 'no_dom', '화면이 없는 환경의 첫 요청');
      eq(r[1].source, 'lock', '두 번째는 잠금');
      eq(r[1].rewarded, false, '보상 없음');
      eq(r[1].busy, true, 'busy 표시');
      eq(BM.ads.busy(), false, '끝나면 잠금 해제');
      return BM.ads.showRewarded().then(function (r3) {
        eq(r3.reason, 'no_dom', '잠금이 풀리면 다시 실행');
      });
    });
  });

  /* ---------- 3. 공용 하트 충전 시트 ---------- */

  function captureSheet(fn) {
    var orig = BM.ui.openSheet;
    var captured = null;
    BM.ui.openSheet = function (o) { captured = o; return null; };
    try { fn(); } finally { BM.ui.openSheet = orig; }
    return captured;
  }

  test('v1.15 공용 충전 시트: 부족할 때 출석·광고·남은 무료 하트를 보여 준다', function () {
    var st = stateOf({
      balance: 1, checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 2, adRemaining: 3,
      adCooldownSec: 30, nextAdInSec: 12, nextAdAt: Date.now() + 12000
    });
    var ctx = { store: { state: st, actions: {} }, actions: {}, refresh: function () {} };
    var sheet = captureSheet(function () {
      BM.ads.openHeartSheet(ctx, { need: 2, continueLabel: '프로필로 돌아가기' });
    });
    ok(sheet, '시트를 연다');
    eq(sheet.title, '하트 충전', '제목');
    includes(sheet.body, '하트 2개', '필요 하트');
    includes(sheet.body, '1개 부족', '부족 안내');
    includes(sheet.body, 'data-charge="checkin"', '출석 버튼');
    includes(sheet.body, 'data-charge="ad"', '광고 버튼');
    includes(sheet.body, '다음 광고까지', '실시간 쿨타임');
    includes(sheet.body, '오늘 받을 수 있는 무료 하트 4개 남음', '남은 무료 하트');
    includes(sheet.body, 'MY에서 잔액 보기', '모자랄 때 MY 안내');
    excludes(sheet.body, 'data-charge="continue"', '모자랄 때는 이어서 버튼이 없다');
  });

  test('v1.15 공용 충전 시트: 채우고 나면 원래 동작으로 이어 가는 버튼이 열린다', function () {
    var st = stateOf({
      balance: 2, checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 2, adRemaining: 3,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0
    });
    var ctx = { store: { state: st, actions: {} }, actions: {}, refresh: function () {} };
    var sheet = captureSheet(function () {
      BM.ads.openHeartSheet(ctx, { need: 2, continueLabel: '열기', onContinue: function () {} });
    });
    ok(sheet, '시트를 연다');
    includes(sheet.body, 'data-charge="continue"', '이어서 버튼');
    includes(sheet.body, '>열기<', '버튼 이름');
    includes(sheet.body, '지금 바로 이어서 할 수 있어요', '준비 완료 안내');
    excludes(sheet.body, '1개 부족', '부족 안내 없음');
  });

  test('v1.15 공용 충전 시트: 화면이 없으면 조용히 null (테스트·구형 캐시)', function () {
    var st = stateOf();
    var ctx = { store: { state: st, actions: {} }, actions: {} };
    eq(BM.ads.openHeartSheet(ctx, { need: 2 }), null, '시트 없음');
    eq(BM.ads.openHeartSheet(null, { need: 2 }), null, '상태가 없으면 열지 않는다');
  });

  test('v1.15 공용 충전 시트: 다시 열면 그 순간 잔액으로 다시 쓴다', function () {
    var st = stateOf({
      balance: 1, checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 2, adRemaining: 3,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0
    });
    var ctx = { store: { state: st, actions: {} }, actions: {}, refresh: function () {} };
    var intro = function (s) { return '<p>지금 ' + s.balance + '개</p>'; };
    var first = captureSheet(function () {
      BM.ads.openHeartSheet(ctx, { need: 2, intro: intro });
    });
    includes(first.body, '지금 1개', '열 때 잔액');

    st.data.hearts.balance = 2;   /* 출석·광고로 채운 뒤 */
    var second = captureSheet(function () {
      BM.ads.openHeartSheet(ctx, { need: 2, intro: intro });
    });
    includes(second.body, '지금 2개', '다시 열면 새 잔액');
    includes(second.body, 'data-charge="continue"', '이어서 버튼');
    excludes(second.body, '부족', '부족 안내 없음');
  });

  /* ---------- 4. MY 하트 카드 ---------- */

  test('v1.15 MY 하트 카드: 오늘 남은 무료 하트 배지와 실시간 쿨타임', function () {
    var st = stateOf({
      balance: 3, checkinReward: 1, checkedInToday: false, canCheckIn: true,
      adReward: 1, adLimit: 5, adUsedToday: 2, adRemaining: 3,
      adCooldownSec: 30, nextAdInSec: 12, nextAdAt: Date.now() + 12000
    });
    var html = BM.views.my.render(st);
    includes(html, 'data-free-line', '무료 하트 줄');
    includes(html, '오늘 받을 수 있는 무료 하트 4개 남음', '남은 무료 하트 개수');
    includes(html, '다음 광고까지', '쿨다운 카운트다운 문구');
    includes(html, 'data-ad-btn', '광고 버튼');
  });

  test('v1.15 MY 하트 카드: 한도를 채우면 무료 하트 줄이 완료로 바뀐다', function () {
    var st = stateOf({
      balance: 3, checkinReward: 1, checkedInToday: true, canCheckIn: false,
      adReward: 1, adLimit: 5, adUsedToday: 5, adRemaining: 0,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0
    });
    var html = BM.views.my.render(st);
    includes(html, '오늘 무료 하트를 모두 받았어요', '완료 문구');
    includes(html, 'is-done', '완료 스타일');
  });

  /* ---------- 5. 하트가 모자란 자리 모두 공용 시트로 ---------- */

  test('v1.15 하트 부족 지점: MY·매칭 모두 공용 충전 시트를 쓴다', function () {
    if (!hasNode()) return;
    var my = readRoot('js/views/my.js');
    var matching = readRoot('js/views/matching.js');
    includes(my, 'BM.ads.openHeartSheet', 'MY: 테마·프레임/배지 해금 → 공용 시트');
    includes(my, 'onContinue: apply', 'MY 테마: 채운 뒤 바로 다시 시도');
    includes(my, 'onContinue: function () { buyDeco(', 'MY 꾸미기: 채운 뒤 바로 구매');
    excludes(my, '하트가 \' + res.need + \'개 부족해요. 광고·출석으로 모아 주세요.', '토스트만 띄우던 예전 안내');
    includes(matching, 'BM.ads.openHeartSheet', '매칭: 공용 시트');
    includes(matching, 'function sendGift(', '매칭: 하트 선물 충전 연결');
    excludes(matching, '\'<div class="charge">\'', '매칭 안의 옛 충전 시트를 따로 만들지 않는다');
    includes(readRoot('js/ads.js'), 'openHeartSheet: openHeartSheet', 'ads: 공용 시트 구현');
  });

  test('v1.15 버전: sw·app·화면 캐시가 함께 올라간다', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    includes(sw, "var VERSION = 'bm-v1.32.0'", 'sw.js');
    includes(app, "version: 'v1.32.0'", 'app.js');
    includes(index, 'styles.css?v=20261121-32', '스타일 캐시');
    includes(readRoot('README.md'), 'v1.31.0', 'README 변경 이력');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
