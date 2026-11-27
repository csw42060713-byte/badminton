/* ============================================================
 * test/ux1125.test.js — 2026-11-25 점심·저녁 사용성 점검 6건 (bm-v1.93.0)
 *
 *   1) MY → 하트 부스트 문구·무료 하트 계산 정비
 *      · 오늘 받을 수 있는 무료 하트 합계 = 출석 + 광고 + 첫 광고 보너스 (괄호 안 합과 일치)
 *      · 광고 버튼 '+N'도 '광고 x + 보너스 y'로 나뉨을 함께 적는다
 *      · 하트 3개로 여는 쪽은 '꾸미기'로 이름을 나누고 혜택을 한 줄로
 *   2) 커뮤니티 → 게스트 모집 '몇 명' 빠른 칩 (2·4·6명)
 *   3) 1:1 채팅 → 코트 약속 체육관 칩·지도 + 매너 카드 기본 접힘
 *   4) 1:1 매칭 → 찾기 첫 화면 추천 목록 + '전체 선수 보기' 버튼 1개
 *   5) MY → 내 라켓 여러 자루 + 장력 21~28 lbs
 *   6) 코트 점수판 가로 보기 팀 배지·색 구분
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

  var ME = 'u_ux1125_me';
  var NOW = U.ymd();

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

  function unlock(store) {
    if (store.state && store.state.locks) store.state.locks.profile = 0;
    return store;
  }

  function flush(store) {
    return Promise.resolve().then(function () { return null; })
      .then(function () { return null; })
      .then(function () { return store; });
  }

  function dayAgo(n) {
    return U.ymd(U.addDays(new Date(), -n));
  }

  /* =========================================================
   * 1. 하트 부스트 문구 · 무료 하트 계산
   * ========================================================= */

  test('v1.84 하트: 무료 하트 합계와 괄호 안 항의 합이 같다', function () {
    var s = BM.ads.getStatus({
      balance: 3, checkinReward: 1, canCheckIn: true, checkedInToday: false,
      adReward: 1, adLimit: 5, adUsedToday: 0, adRemaining: 5,
      adCooldownSec: 30, nextAdInSec: 0, nextAdAt: 0,
      dailyBoostAmount: 1, dailyBoostLeft: 1
    });
    eq(s.freeHeartsLeft, 7, '출석 1 + 광고 5 + 첫 광고 보너스 1');
    var detail = BM.ads.freeDetail(s);
    includes(detail, '출석 1', '출석');
    includes(detail, '광고 5', '광고 몫은 횟수가 아니라 하트 수');
    includes(detail, '첫 광고 보너스 1', '보너스도 항으로');
    includes(detail, '= 7개', '합계를 괄호 안에');
    /* 괄호 안 숫자를 더하면 앞의 합계가 된다 */
    var nums = String(detail).match(/\d+/g).map(Number);
    var total = nums[nums.length - 1];
    var parts = nums.slice(0, nums.length - 1).reduce(function (a, b) { return a + b; }, 0);
    eq(parts, total, '항의 합 = 합계');
    eq(total, s.freeHeartsLeft, '합계가 freeHeartsLeft 와 같다');
  });

  test('v1.84 하트: 하트 부스트를 켜면 광고 몫도 커진 값으로 합계가 맞는다', function () {
    var s = BM.ads.getStatus({
      balance: 0, checkinReward: 2, canCheckIn: true,
      adReward: 2, adLimit: 5, adUsedToday: 0, adRemaining: 5,
      dailyBoostAmount: 1, dailyBoostLeft: 1
    });
    eq(s.freeHeartsLeft, 13, '출석 2 + 광고 10 + 보너스 1');
    includes(BM.ads.freeDetail(s), '광고 10', '광고 5회 × 2개');
    includes(BM.ads.freeDetail(s), '= 13개', '합계');
  });

  test('v1.84 하트: 광고 버튼 +N 이 광고 몫 + 보너스로 나뉘어 보인다', function () {
    var s = BM.ads.getStatus({
      balance: 3, adReward: 1, adLimit: 5, adUsedToday: 0, adRemaining: 5,
      nextAdInSec: 0, nextAdAt: 0, dailyBoostAmount: 1, dailyBoostLeft: 1
    });
    var text = BM.ads.adMeterText(s);
    includes(text, '남은 5/5회', '남은 횟수');
    includes(text, '지금 바로 +2', '받을 하트 합계');
    includes(text, '광고 1', '광고 몫');
    includes(text, '보너스 1', '첫 광고 보너스');
  });

  test('v1.84 하트: 보너스가 없으면 예전 문구 그대로 (합계만)', function () {
    var s = BM.ads.getStatus({
      balance: 3, adReward: 1, adLimit: 5, adUsedToday: 2, adRemaining: 3, nextAdAt: 0
    });
    eq(BM.ads.adMeterText(s), '남은 3/5회 · 지금 바로 +1', '보너스 없으면 +1');
  });

  test('v1.84 하트: 오늘의 부스트(무료)와 하트 3개 부스트(꾸미기)가 문구로 구분된다', function () {
    var s = BM.ads.getStatus({
      adLimit: 5, adUsedToday: 0, adRemaining: 5, adReward: 1,
      dailyBoostAmount: 1, dailyBoostLeft: 1, dailyBoost: { amount: 1, usedToday: false }
    });
    var daily = BM.ads.dailyBoostText(s);
    eq(daily.indexOf('오늘의 하트 부스트'), 0, '오늘 줄은 그대로 시작');
    includes(daily, '(무료)', '무료라고 밝힘');
    includes(daily, '하루 1회', '하루 한 번');
    includes(daily, '오늘 첫 광고에 +1', '첫 광고 한 편');

    var hearts = D.heartStatus(D.index([]), ME, U.parseYmd(NOW).getTime());
    var html = BM.views.my.heartCard(hearts);
    includes(html, '하트 부스트 · 꾸미기', '3개로 여는 쪽은 꾸미기');
    includes(html, '한 번 열면 출석·광고 적립이 계속 +1', '무엇이 열리는지 한 줄로');
    includes(html, '하트 3개로 열기', '가격은 버튼에');
    excludes(html, '하트 3개로 한 번 열면 계속', '예전 두루뭉술한 문구는 없음');
  });

  /* =========================================================
   * 2. 게스트 모집 '몇 명' 빠른 칩
   * ========================================================= */

  test('v1.84 게스트 모집: 몇 명 칸 아래 2·4·6명 칩이 있고 4명을 고르면 켜진다', function () {
    var state = {
      ui: { composerMeet: { cap: '4', when: '', place: '', fee: '' } },
      data: { hearts: {} }
    };
    var html = BM.views.community.render(state);
    includes(html, 'data-vitecap', '몇 명 칩 묶음');
    ['2', '4', '6'].forEach(function (n) {
      includes(html, 'data-vitecap-val="' + n + '"', n + '명 칩');
      includes(html, '>' + n + '명<', n + '명 글자');
    });
    includes(html, 'class="chip chip--sm is-on" data-vitecap-val="4"', '지금 값이 켜짐');
    includes(html, 'data-vitefield="cap"', '직접 입력칸은 그대로');
    if (hasNode) includes(readRoot('js/views/community.js'), "ctx.actions.setComposerMeet('cap', cnext)", '누르면 입력칸에 담김');
  });

  /* =========================================================
   * 3. 1:1 채팅 — 약속 체육관·접힌 매너 카드
   * ========================================================= */

  function chatState() {
    var rows = [
      { type: '프로필', id: 'p1', userKey: ME, nick: '나래', level: 'C조', theme: { avatar: '🦋' }, createdAt: NOW + ' 09:00:00' },
      { type: '프로필', id: 'p2', userKey: 'ux_other', nick: '콕집사', level: 'B조', club: '나래울', theme: { avatar: '🐧' }, createdAt: NOW + ' 09:00:00' },
      { type: '친구수락', id: 'fr1', userKey: ME, target: 'ux_other', createdAt: NOW + ' 10:00:00' },
      { type: '매칭채팅', id: 'm1', userKey: 'ux_other', target: ME, team: 'fr1', text: '좋았어요', createdAt: NOW + ' 11:00:00' }
    ].map(function (e) { return D.toRow(e); });
    var idx = D.index(rows.map(D.fromRow));
    var base = D.derive ? null : null;
    var state = {
      me: { key: ME, nick: '나래', level: 'C조', theme: { avatar: '🦋' } },
      data: { idx: idx, threads: D.chatRooms(idx, ME), rooms: [], matchProfiles: [], hearts: {} },
      ui: { chatRoom: 'fr1', chatOther: 'ux_other' }
    };
    return state;
  }

  test('v1.84 채팅: 매너 카드는 기본 접힘 — 한 줄 요약 + 눌러서 펼치기', function () {
    var state = chatState();
    var html = BM.views.chat.roomHtml(state);
    includes(html, 'data-manner-toggle', '접기/펼치기 버튼');
    includes(html, '같이 친 경기 어땠어요?', '요약 문구');
    includes(html, '한 줄 남기기', '펼치는 말');
    includes(html, 'data-manner-body hidden', '처음에는 접힘');
    eq((html.match(/data-manner-tag=/g) || []).length, 4, '칩 4개는 DOM 에 있고');
    includes(html, 'aria-expanded="false"', '접힌 상태 표시');
    if (hasNode) {
      var src = readRoot('js/views/chat.js');
      includes(src, "mbody.hidden = !mannerOpen", '칩은 hidden 만 바꿔 펼침');
    }
  });

  test('v1.84 채팅: 코트 약속 시트에 체육관 칩·지도 고르기가 붙는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/chat.js');
    includes(src, 'data-apt-gym-map', '지도에서 고르기 버튼');
    includes(src, 'BM.views.gyms.open(ctx', '지도 화면 연결');
    includes(src, 'data-apt-gym-pick', '자주 가는 체육관 칩');
    includes(src, 'data-apt-field="gym"', '직접 입력칸은 그대로');
    var body = src.slice(src.indexOf('function openApptSheet'), src.indexOf('function openApptSheet') + 3000);
    includes(body, 'apptGymChips', '시트 본문에 칩 줄');
  });

  /* =========================================================
   * 4. 1:1 매칭 첫 화면 추천 목록
   * ========================================================= */

  function matchState() {
    var rows = [];
    var players = [
      { key: 'ux_a', nick: '같은동네C조', level: 'C조', region: '경기' },
      { key: 'ux_b', nick: '먼동네A조', level: 'A조', region: '서울' },
      { key: 'ux_c', nick: '같은동네B조', level: 'B조', region: '경기' }
    ];
    rows.push({ type: '프로필', id: 'me', userKey: ME, nick: '나래', level: 'C조', theme: {}, createdAt: NOW + ' 08:00:00' });
    players.forEach(function (p, i) {
      rows.push({ type: '프로필', id: 'pr' + i, userKey: p.key, nick: p.nick, level: p.level, theme: {}, createdAt: NOW + ' 08:00:00' });
      rows.push({
        type: '매칭프로필', id: 'mp' + i, userKey: p.key, nick: p.nick, createdAt: NOW + ' 09:00:00',
        payload: {
          region: p.region, level: p.level, discipline: '복식', club: '나래울', nick: p.nick,
          availability: '주말', experience: '2~5년', avatar: '🐧', gender: '남성',
          activityAt: NOW + ' 10:00:00'
        }
      });
    });
    var list = rows.map(function (e) { return D.toRow(e); });
    var idx = D.index(list);
    /* store.derive 와 같은 모양 — 매칭프로필 행의 payload 를 펼친 목록 */
    var profiles = (idx.byType['매칭프로필'] || []).map(function (m) {
      var pl = m.payload || {};
      return {
        rowId: m.id, userKey: m.userKey, nick: m.nick, region: pl.region || '',
        level: D.normalizeGrade(pl.level), discipline: pl.discipline || '', club: pl.club || '',
        availability: pl.availability || '', experience: pl.experience || '', bio: pl.bio || '',
        avatar: pl.avatar || '🐧', gender: pl.gender || '', activityAt: pl.activityAt || m.createdAt || '',
        createdAt: m.createdAt || ''
      };
    });
    return {
      me: { key: ME, nick: '나래', level: 'C조', region: '경기', theme: {} },
      data: { idx: idx, matchProfiles: profiles, requests: [], rooms: [], hearts: { balance: 3 } },
      ui: { tab: 'matching', matchStarted: false, matchFilter: { level: '', gender: '', region: '', discipline: '', query: '' } }
    };
  }

  test('v1.84 매칭: 첫 화면에 추천 선수 카드가 바로 보인다', function () {
    var state = matchState();
    ok(state.data.matchProfiles.length >= 3, '선수 카드 3명');
    var html = BM.views.matching.render(state);
    includes(html, 'resultbar--rec', '추천 줄');
    includes(html, 'pcards--rec', '추천 목록');
    eq((html.match(/class="pcard"/g) || []).length, 3, '선수 카드가 바로 나온다');
    includes(html, '명 찾음', '결과 수');
    includes(html, '내 동네 · 비슷한 급수를 먼저', '추천 기준 한 줄');
    excludes(html, 'matchintro', '예전 빈 안내 카드는 없음');
  });

  test('v1.84 매칭: 추천은 내 지역·비슷한 급수를 먼저 둔다', function () {
    var state = matchState();
    var rec = BM.views.matching.recommendPlayers(state, 3);
    eq(rec[0].nick, '같은동네C조', '같은 지역 + 같은 급수가 첫 번째');
    eq(rec[rec.length - 1].nick, '먼동네A조', '먼 지역·다른 급수는 뒤로');
  });

  test('v1.84 매칭: 전체 선수 보기 버튼은 필터 줄 하나뿐', function () {
    var state = matchState();
    var html = BM.views.matching.render(state);
    eq((html.match(/전체 선수 보기/g) || []).length, 1, '중복 버튼 없음');
    includes(html, 'data-act="show-all"', '필터 줄 전체 버튼');
    /* 조건을 고르면 예전처럼 조건 결과 줄 */
    state.ui.matchStarted = true;
    var searched = BM.views.matching.render(state);
    excludes(searched, 'pcards--rec', '조건을 고르면 추천 줄이 아니다');
    includes(searched, '명 찾음', '결과 수');
  });

  /* =========================================================
   * 5. 내 라켓 여러 자루 + 21~28 lbs
   * ========================================================= */

  test('v1.84 라켓: 장력 칩이 21~28 lbs 로 늘어난다', function () {
    var G = BM.gear;
    eq(G.TENSIONS.join(','), '21,22,23,24,25,26,27,28', '21~28');
    eq(G.TENSIONS.length, 8, '8칸');
    var html = G.sheetBody({});
    [21, 22, 23, 24, 25, 26, 27, 28].forEach(function (n) {
      includes(html, 'data-value="' + n + '"', n + ' 칩');
    });
  });

  test('v1.84 라켓: 예전 한 자루 저장값도 그대로 읽는다', function () {
    var G = BM.gear;
    var list = G.listOf({ theme: { gear: { racket: '아스트록스', string: 'BG80', tension: 26 } } });
    eq(list.length, 1, '한 자루');
    eq(list[0].tension, 26, '장력 그대로');
    eq(G.gearOf({ theme: { gear: { racket: '아스트록스', tension: 26 } } }).racket, '아스트록스', '메인 라켓 호환');
    eq(G.listOf({}).length, 0, '없으면 빈 목록');
  });

  test('v1.84 라켓: 여러 자루를 정리하고 5자루까지만 둔다', function () {
    var G = BM.gear;
    var list = G.normalizeGearList([
      { racket: 'A', tension: 26 },
      { racket: '', string: '', tension: 0 },
      { racket: 'B', tension: 22 }
    ]);
    eq(list.length, 2, '빈 자루는 뺀다');
    eq(list[0].racket, 'A', '순서 유지');
    eq(list[1].tension, 22, '두 번째 자루');
    var many = [];
    for (var i = 0; i < 9; i++) many.push({ racket: 'R' + i, tension: 24 });
    eq(G.normalizeGearList(many).length, 5, '최대 5자루');
  });

  test('v1.84 라켓: setGears 가 theme.gears 와 theme.gear(첫 자루)에 함께 남긴다', function () {
    if (!hasNode) return;
    return storeWith([]).then(function (store) {
      var res = store.actions.setGears([
        { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: dayAgo(40), cycleDays: 30 },
        { racket: '아크세이버 7 프로', string: 'BG65', tension: 22, strungAt: dayAgo(8), cycleDays: 45 }
      ]);
      eq(res.ok, true, '저장 성공');
      eq(store.state.me.gears.length, 2, '화면 상태에 두 자루');
      eq(store.state.me.gear.racket, '아스트록스 88D 프로', '첫 자루는 예전 칸에도');
      var theme = store.state.me.theme || {};
      eq((theme.gears || []).length, 2, '꾸미기 JSON gears');
      eq(theme.gear.tension, 26, '꾸미기 JSON gear(호환)');
      return flush(store).then(function () {
        var rows = U.readJSON('bm_rows_v1', []) || [];
        var prof = rows.filter(function (r) { return r[D.COL['유형']] === '프로필'; });
        var saved = U.jsonParse(prof[prof.length - 1][D.COL['꾸미기']], null) || {};
        eq((saved.gears || []).length, 2, '저장된 행에 두 자루');
        eq(prof[prof.length - 1].length, D.COLS.length, '칸 수는 그대로 26');
      });
    });
  });

  test('v1.84 라켓: 테마를 바꿔도 여러 자루와 커스텀 색이 그대로다', function () {
    if (!hasNode) return;
    return storeWith([]).then(function (store) {
      store.actions.setGears([
        { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: dayAgo(40), cycleDays: 30 },
        { racket: '아크세이버 7 프로', string: 'BG65', tension: 22, strungAt: dayAgo(8), cycleDays: 45 }
      ]);
      unlock(store);
      var res = store.actions.setTheme('th_night');
      ok(res && res.ok, '테마 저장 성공');
      eq(store.state.me.gears.length, 2, '테마를 바꿔도 두 자루');
      eq((store.state.me.theme.gears || []).length, 2, '꾸미기 JSON 에도 두 자루');
      eq(store.state.me.gear.racket, '아스트록스 88D 프로', '첫 자루는 예전 칸에도');
    });
  });

  test('v1.84 라켓: MY 카드가 두 자루를 메인 표시와 함께 그린다', function () {
    var state = {
      me: {
        theme: {
          gears: [
            { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: dayAgo(40), cycleDays: 30 },
            { racket: '아크세이버 7 프로', string: 'BG65', tension: 22, strungAt: dayAgo(8), cycleDays: 45 }
          ],
          gear: { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: dayAgo(40), cycleDays: 30 }
        }
      }
    };
    var html = BM.gear.cardHtml(state);
    eq((html.match(/data-gear-row=/g) || []).length, 2, '두 줄');
    includes(html, '메인', '첫 자루 메인 표시');
    includes(html, '아크세이버 7 프로', '서브 라켓 이름');
    includes(html, 'BG65 · 22 lbs', '서브 스펙');
    includes(html, 'data-gear-idx="1"', '서브 자루의 오늘 갈았어요');
    includes(html, 'data-act="gear-add"', '라켓 추가 버튼');
    includes(html, 'data-act="gear-sheet"', '수정 버튼');
    includes(html, 'data-gear-state="due"', '가장 급한 자루 상태로 카드 배지');
  });

  test('v1.84 라켓: 시트에 두 자루 칸과 자루 지우기가 있다', function () {
    var me = {
      theme: {
        gears: [
          { racket: 'A', tension: 26, strungAt: dayAgo(3), cycleDays: 60 },
          { racket: 'B', tension: 22, strungAt: dayAgo(5), cycleDays: 60 }
        ]
      }
    };
    var html = BM.gear.sheetBody(me);
    eq((html.match(/data-gear-item/g) || []).length, 2, '자루 두 칸');
    includes(html, '라켓 1 · 메인', '첫 칸 이름');
    includes(html, '라켓 2 · 서브', '둘째 칸 이름');
    eq((html.match(/data-gear-del=/g) || []).length, 2, '자루 지우기');
    includes(html, 'data-gear-add="1"', '자루 더하기');
    includes(html, 'value="A"', '첫 자루 값');
    includes(html, 'value="B"', '둘째 자루 값');
    if (hasNode) {
      var src = readRoot('js/gear.js');
      includes(src, 'function paintList', '자루 목록 다시 그리기');
      includes(src, "cur.splice(at, 1)", '자루 지우기');
    }
  });

  test('v1.84 라켓: 오늘 갈았어요는 고른 자루만 바꾼다', function () {
    if (!hasNode) return;
    return storeWith([]).then(function (store) {
      store.actions.setGears([
        { racket: 'A', string: 'BG80', tension: 26, strungAt: dayAgo(40), cycleDays: 60 },
        { racket: 'B', string: 'BG65', tension: 22, strungAt: dayAgo(8), cycleDays: 60 }
      ]);
      unlock(store);
      var ctx = { store: store, actions: store.actions };
      var res = BM.gear.restung(ctx, 1);
      eq(res.ok, true, '갱신 성공');
      var list = BM.gear.listOf(store.state.me);
      eq(list[1].strungAt, U.ymd(), '둘째 자루만 오늘로');
      eq(list[0].strungAt, dayAgo(40), '첫 자루는 그대로');
      eq(list[1].string, 'BG65', '스트링도 그대로');
    });
  });

  test('v1.84 라켓: 한 자루만 있으면 예전 setGear 도 그대로 동작한다', function () {
    if (!hasNode) return;
    return storeWith([]).then(function (store) {
      var r1 = store.actions.setGear({ racket: '아스트록스', string: 'BG80', tension: 26, strungAt: dayAgo(10), cycleDays: 60 });
      eq(r1.ok, true, '한 자루 저장');
      unlock(store);
      var r2 = store.actions.setGear({ strungAt: U.ymd() });
      eq(r2.ok, true, '교체일만 갱신');
      var g = BM.gear.gearOf(store.state.me);
      eq(g.strungAt, U.ymd(), '오늘로');
      eq(g.tension, 26, '장력은 그대로');
      eq(BM.gear.listOf(store.state.me).length, 1, '한 자루 유지');
    });
  });

  /* =========================================================
   * 6. 코트 점수판 가로 보기 팀 구분
   * ========================================================= */

  test('v1.84 점수판: 가로 보기에 내 팀·상대 팀 배지가 붙는다', function () {
    var SB = BM.scoreboard;
    var st = SB.create({ partner: '콕집사', rival: '발놀림장인' });
    var land = BM.views.log.scoreboardHtml(st, { land: true });
    includes(land, 'data-sb-view="land"', '가로 표시');
    includes(land, 'sb__tag--mine', '내 팀 배지 클래스');
    includes(land, 'sb__tag--rvl', '상대 팀 배지 클래스');
    includes(land, '>내 팀</span>', '내 팀 글자');
    includes(land, '>상대 팀</span>', '상대 팀 글자');
    includes(land, '>콕집사<', '내 팀 카드에는 이름만');
    includes(land, '>발놀림장인<', '상대 카드에는 이름만');
    ok(land.indexOf('data-sb-point="a"') < land.indexOf('data-sb-point="b"'), '내 팀이 왼쪽');
  });

  test('v1.84 점수판: 세로 보기는 예전 그대로 (배지 없음)', function () {
    var SB = BM.scoreboard;
    var st = SB.create({ partner: '콕집사', rival: '발놀림장인' });
    var port = BM.views.log.scoreboardHtml(st, { land: false });
    excludes(port, 'sb__tag', '세로에는 배지 없음');
    includes(port, '내 팀 · 콕집사', '세로는 팀 이름 + 파트너');
    includes(port, '상대 팀 · 발놀림장인', '상대도 그대로');
  });

  test('v1.84 점수판: 가로 팀 색 구분 CSS 가 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.sbfull.is-land .sb__tag--rvl', '상대 팀 배지 색');
    includes(css, '.sbfull.is-land .sb__card.sb__btn--b', '상대 카드 색');
    includes(css, '.sbfull.is-land .sb__card.sb__btn--a', '내 카드 강조');
    includes(css, '--sb-rvl', '상대 팀 색 변수');
  });

  /* =========================================================
   * 보호 — 기존 화면·칸은 그대로
   * ========================================================= */

  test('v1.84 보호: 5개 탭·시트 26칸은 그대로', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(app, "id: '" + id + "'", '탭 ' + id);
    });
    eq(D.COLS.length, 26, '시트 26칸');
    includes(readRoot('test/run.js'), 'test/ux1125.test.js', '테스트 목록 배선');
  });

  /* =========================================================
   * 버전 — bm-v1.93.0 (sw · app · push · 스타일 캐시 · TWA · README)
   * ========================================================= */

  test('v1.84 버전: sw · app · push · 스타일 캐시 · TWA · README', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.93.0'", 'sw 버전');
    includes(readRoot('app.js'), "version: 'v1.93.0'", 'app 버전');
    includes(readRoot('js/push.js'), "version: 'v1.93.0'", 'push 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261127-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.93.0', 'TWA 이름');
    eq(twa.appVersion, '1.93.0', 'TWA appVersion');
    eq(twa.appVersionCode, 87, 'TWA 코드');
    includes(readRoot('README.md'), 'bm-v1.93.0', 'README');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
