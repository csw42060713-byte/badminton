/* ============================================================
 * test/map5km.test.js — 내 집 반경 5km · 동네 동호인 · 지도 안 게스트 모집 (2026-11-21)
 *
 *  1) 내 집(기준 위치)
 *     · 처음엔 망원동 예시 기준점 · 동네로 저장하면 이 기기에 남는다 · 계정마다 따로
 *     · 깨진 저장값·국내 밖 좌표는 버리고 기본값으로
 *  2) 운동 상태(파란 불)
 *     · 지금 운동 중 → 불 켜짐
 *     · 운동 가능 시간 안 → 불 켜짐 ('지금 운동 가능' 포함)
 *     · 운동이 끝났거나 운동 가능 시간이 아니면 → 불 꺼짐
 *     · 요일·시간대(자정 넘김 포함) 계산
 *  3) 반경 5km 안 사람
 *     · 5km 밖은 빠지고, 가까운 순으로 정렬 · 거리(km)가 붙는다
 *     · 내 집을 바꾸면 사람 수·거리가 다시 계산된다
 *  4) 내 운동 상태 저장 · 화면
 *     · 내 상태 카드(운동 중/지금 운동 가능/운동 가능 시간 칩)
 *     · 지도 화면의 사람 아이콘·불 켜짐/꺼짐·5km 원 안내
 *  5) 지도 안 게스트 모집
 *     · 반경 5km 안 모집 글만 목록에 · 카드에 언제·몇 명·게스트비
 *     · 모집 글 쓰기 칸(체육관 칩·게스트비 칩) · 체육관 카드의 모집 버튼
 *  6) 배선
 *     · index.html·sw.js 캐시·테스트 목록에 js/nearby.js
 *     · 위치·사람 정보를 서버로 보내지 않는다
 *
 *  실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function existsRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, file));
  }

  function N() { return BM.nearby; }
  function G() { return BM.gyms; }

  /* 2026-11-21(토) 20:11 — 화면 검사와 같은 시각 */
  var SAT = new Date(2026, 10, 21, 20, 11);
  var MON = new Date(2026, 10, 23, 20, 0);

  function resetAll() {
    ['demo_me', 'other_me', 'guest'].forEach(function (scope) {
      U.storage.removeItem(N().homeKey(scope));
      U.storage.removeItem(N().availKey(scope));
      U.storage.removeItem(G().keyFor(scope));
    });
  }

  function stateOf(scope, patch) {
    var meKey = scope || 'demo_me';
    var st = {
      ready: true, mode: 'local',
      me: { key: meKey, nick: '나래', level: 'C조', region: '경기', club: '나래울', theme: { theme: 'th_def' } },
      data: { posts: (patch && patch.posts) || [], matchProfiles: (patch && patch.profiles) || [], idx: null },
      ui: {}
    };
    return st;
  }

  /* 화면 검사용 모집 글 — 커뮤니티 '게스트 모집'과 같은 모양 */
  function postOf(id, place, when, cap, fee, extra) {
    var p = {
      id: id, type: '소셜', userKey: 'other', nick: '동네친구', createdAt: '2026-11-21 19:40:00',
      text: '', topic: '게스트 모집',
      meet: { when: when || '', place: place || '', cap: cap || '', fee: fee || '' }
    };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  /* =========================================================
   * 1. 내 집
   * ========================================================= */
  test('내 집: 처음엔 망원동 예시 기준점, 동네로 저장하면 이 기기에 남는다', function () {
    resetAll();
    var h = N().home('demo_me');
    eq(h.label, '망원동', '기본 동네');
    eq(h.demo, true, '예시 기준점 표시');
    ok(h.lat > 37 && h.lat < 38 && h.lng > 126 && h.lng < 127, '서울 좌표');

    var saved = N().saveHome('demo_me', { lat: 37.5215, lng: 126.9245, label: '여의도' });
    eq(saved.label, '여의도', '저장된 동네');
    eq(saved.demo, false, '내가 정한 기준점');
    eq(N().home('demo_me').label, '여의도', '다시 읽어도 남는다');
    eq(N().home('other_me').label, '망원동', '계정마다 따로');

    eq(N().resetHome('demo_me').label, '망원동', '되돌리면 기본값');
    resetAll();
  });

  test('내 집: 깨진 저장값·국내 밖 좌표는 버리고 기본값으로 돌아간다', function () {
    resetAll();
    U.writeJSON(N().homeKey('demo_me'), { lat: 'x', lng: null });
    eq(N().home('demo_me').label, '망원동', '깨진 값 → 기본');
    U.writeJSON(N().homeKey('demo_me'), { lat: 51.5, lng: -0.12, label: '런던' });
    eq(N().home('demo_me').label, '망원동', '국내 밖 좌표 → 기본');
    U.writeJSON(N().homeKey('demo_me'), 'not-json-object');
    eq(N().home('demo_me').demo, true, '객체가 아니면 기본');
    resetAll();
  });

  /* =========================================================
   * 2. 운동 상태(파란 불)
   * ========================================================= */
  test('불: 운동 중이면 켜지고, 운동이 끝났으면 꺼진다', function () {
    var working = N().statusOf({ workout: 'on', ended: false }, SAT);
    eq(working.lit, true, '운동 중 → 켜짐');
    eq(working.key, 'work', '상태 키');
    eq(working.label, '운동 중', '표시');

    var ended = N().statusOf({ workout: 'off', ended: true, avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' } }, SAT);
    eq(ended.lit, false, '운동 끝 → 꺼짐');
    eq(ended.label, '운동 끝', '표시');
  });

  test('불: 운동 가능 시간 안이면 운동 중이 아니어도 켜진다 (요청 수정 반영)', function () {
    var avail = N().statusOf({ workout: 'off', avail: { days: [1, 2, 3, 4, 5, 6, 7], from: '19:00', to: '22:00' } }, SAT);
    eq(avail.lit, true, '운동 가능 시간 → 켜짐');
    eq(avail.key, 'avail', '상태 키');
    eq(avail.label, '운동 가능 시간', '표시');

    var freeNow = N().statusOf({ workout: 'off', freeNow: true, avail: null }, SAT);
    eq(freeNow.lit, true, "'지금 운동 가능' → 켜짐");
    eq(freeNow.range, '지금 운동 가능', '안내');

    var off = N().statusOf({ workout: 'off', avail: { days: [6, 7], from: '09:00', to: '12:00' } }, SAT);
    eq(off.lit, false, '주말 오전 시간대인데 지금은 저녁 → 꺼짐');
    eq(off.label, '운동 시간 아님', '표시');

    var weekday = N().statusOf({ workout: 'off', avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' } }, SAT);
    eq(weekday.lit, false, '토요일엔 평일 시간대가 아니다');
    var monday = N().statusOf({ workout: 'off', avail: { days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' } }, MON);
    eq(monday.lit, true, '월요일 20시엔 켜짐');
  });

  test('불: 자정을 넘기는 시간대도 맞게 계산하고, 시간대 문구를 만든다', function () {
    var late = { days: [1, 2, 3, 4, 5, 6, 7], from: '22:00', to: '01:00' };
    eq(N().availableAt({ avail: late }, new Date(2026, 10, 21, 23, 30)), true, '23:30');
    eq(N().availableAt({ avail: late }, new Date(2026, 10, 22, 0, 30)), true, '00:30');
    eq(N().availableAt({ avail: late }, new Date(2026, 10, 21, 12, 0)), false, '낮');
    eq(N().availableAt({ freeNow: true }, new Date(2026, 10, 21, 12, 0)), true, "'지금 운동 가능'은 시간과 무관");
    eq(N().availableAt({}, new Date(2026, 10, 21, 12, 0)), false, '시간대가 없으면 꺼짐');
    eq(N().rangeLabel({ days: [1, 2, 3, 4, 5, 6, 7], from: '19:00', to: '22:00' }), '매일 19–22시', '매일');
    eq(N().rangeLabel({ days: [1, 2, 3, 4, 5], from: '19:00', to: '22:00' }), '평일 19–22시', '평일');
    eq(N().rangeLabel({ days: [6, 7], from: '09:00', to: '12:00' }), '주말 09–12시', '주말');
    eq(N().rangeLabel(null), '', '없으면 빈 값');
  });

  /* =========================================================
   * 3. 반경 5km 안 사람
   * ========================================================= */
  test('사람: 반경 5km 안만 남고 가까운 순으로 정렬된다', function () {
    resetAll();
    var h = N().home('demo_me');
    var list = N().all(stateOf());
    var inside = N().near(list, h);
    eq(inside.length, 7, '5km 안 7명 (실제 ' + inside.length + '명)');
    ok(inside.every(function (p) { return p.dist <= 5; }), '모두 5km 이내');
    var kms = inside.map(function (p) { return p.dist; });
    eq(kms.join(','), kms.slice().sort(function (a, b) { return a - b; }).join(','), '가까운 순');
    eq(inside[0].name, '정하늘', '가장 가까운 사람');
    eq(N().outside(list, h), 2, '5km 밖 2명');
    var names = inside.map(function (p) { return p.name; });
    ok(names.indexOf('배수아') < 0 && names.indexOf('서지훈') < 0, '5km 밖 사람은 빠진다');
  });

  test('사람: 내 집을 바꾸면 반경 안 사람·거리가 다시 계산된다', function () {
    resetAll();
    N().saveHome('demo_me', { lat: 37.5215, lng: 126.9245, label: '여의도' });
    var h = N().home('demo_me');
    var inside = N().near(N().all(stateOf()), h);
    eq(inside.length, 5, '여의도 기준 5명 (실제 ' + inside.length + '명)');
    ok(inside[0].dist > 0 && inside[0].dist < 2, '가장 가까운 곳은 2km 안: ' + inside[0].dist);
    var names = inside.map(function (p) { return p.name; });
    ok(names.indexOf('한지우') >= 0, '여의도에서는 강남 쪽(한지우)이 반경 안으로 들어온다');
    resetAll();
  });

  test('사람: 요약은 불 켜진 사람·운동 중·5km 밖 인원을 함께 센다', function () {
    resetAll();
    var s = N().summary(stateOf(), SAT, 'demo_me');
    eq(s.people.length, 7, '5km 안 7명');
    eq(s.lit, 5, '파란 불 5명 (운동 중 2 + 운동 가능 3)');
    eq(s.working, 2, '운동 중 2명');
    eq(s.outside, 2, '5km 밖 2명');
    eq(s.radiusKm, 5, '반경 5km');
    eq(s.home.label, '망원동', '내 집');
    eq(s.mine.lit, true, '내 불도 같은 규칙으로 켜짐');

    var labels = s.people.map(function (p) { return p.status.label; });
    ok(labels.indexOf('운동 중') >= 0 && labels.indexOf('운동 끝') >= 0 &&
      labels.indexOf('운동 시간 아님') >= 0 && labels.indexOf('운동 가능 시간') >= 0,
      '네 가지 표시가 함께 있다: ' + labels.join(' / '));
  });

  /* =========================================================
   * 4. 내 운동 상태 · 지도 화면
   * ========================================================= */
  test('내 상태: 기본은 지금 운동 가능 + 매일 19–22시, 저장하면 남는다', function () {
    resetAll();
    var mine = N().myStatus('demo_me');
    eq(mine.working, false, '처음엔 운동 중 아님');
    eq(mine.freeNow, true, '처음엔 지금 운동 가능');
    eq(N().statusOf(N().meAsPerson(mine), SAT).lit, true, '그래서 불이 켜져 있다');

    N().saveMyStatus('demo_me', { working: true });
    eq(N().myStatus('demo_me').working, true, '운동 중 저장');
    eq(N().myStatus('other_me').working, false, '계정마다 따로');
    eq(N().statusOf(N().meAsPerson(N().myStatus('demo_me')), SAT).label, '운동 중', '내 라벨');

    N().saveMyStatus('demo_me', { working: false, freeNow: false, rangeId: 'weekend-9-12', days: [6, 7], from: '09:00', to: '12:00' });
    var st = N().myStatus('demo_me');
    eq(st.freeNow, false, '지금 운동 가능 꺼짐');
    eq(N().statusOf(N().meAsPerson(st), SAT).lit, false, '토요일 저녁엔 시간대 밖 → 꺼짐');
    eq(N().statusOf(N().meAsPerson(st), new Date(2026, 10, 21, 10, 0)).lit, true, '토요일 오전 10시 → 켜짐');
    resetAll();
  });

  test('화면: 내 상태 카드에 스위치·시간대 칩이 있고, 반경 5km 동호인 목록이 보인다', function () {
    resetAll();
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT });
    includes(html, 'data-gymmystat', '내 상태 카드');
    includes(html, '내 상태 · 파란 불 켜짐', '지금 내 불');
    includes(html, 'data-mystat-work', '운동 중 스위치');
    includes(html, 'data-mystat-free', '지금 운동 가능 스위치');
    eq((html.match(/data-mystat-range=/g) || []).length, 4, '운동 가능 시간 칩 4개');
    includes(html, '매일 19–22시', '기본 시간대');
    includes(html, '운동 중 · 운동 가능 시간', '범례: 파란 불');
    includes(html, '운동 끝 · 운동 시간 아님', '범례: 불 꺼짐');

    includes(html, 'data-gymhome', '내 집 줄');
    includes(html, '내 집 · 망원동', '내 집 이름');
    includes(html, '반경 5km', '반경 안내');
    includes(html, 'data-gym-home', '내 집 바꾸기');

    includes(html, 'data-gymnote', '지도 안내');
    includes(html, '동호인 <b>7명</b>', '7명');
    includes(html, '파란 불 <b>5명</b>', '파란 불 5명');
    includes(html, '5km 밖 2명은 뺐어요', '밖 인원');

    eq((html.match(/class="nearp(?: is-lit)?"/g) || []).length, 7, '동호인 줄 7개');
    eq((html.match(/class="nearp is-lit"/g) || []).length, 5, '불 켜진 줄 5개');
    eq((html.match(/lamp lamp--live/g) || []).length >= 7, true, '파란 불 표시가 여러 곳 (내 상태·동호인·범례)');
    includes(html, '운동 끝', '운동 끝 표시');
    includes(html, '운동 시간 아님', '운동 시간 아님 표시');
    includes(html, '불 켜진 사람만', '거르기 칩');
    includes(html, '약 0.8 km', '거리');
    includes(html, '초보', '급수');

    /* 불 켜진 사람만 보기 */
    var litOnly = BM.views.gyms.render({ scope: 'demo_me', now: SAT, onlyLit: true });
    eq((litOnly.match(/class="nearp(?: is-lit)?"/g) || []).length, 5, '불 켜진 줄만 5개');

    /* 5km 밖은 지도·목록에 없다 */
    excludes(html, '배수아', '5km 밖 사람은 목록에 없다');
    excludes(html, '서지훈', '5km 밖 사람은 목록에 없다');

    /* Leaflet 없이도 사람 아이콘(오프라인 핀 지도)이 찍힌다 */
    includes(html, 'class="gymp is-flat is-lit', '오프라인 사람 아이콘');
    includes(html, 'class="gymring"', '오프라인 반경 원');
    includes(html, 'gymhome-pin', '오프라인 내 집 핀');
    resetAll();
  });

  /* =========================================================
   * 5. 지도 안 게스트 모집
   * ========================================================= */
  test('모집: 반경 5km 안 글만 목록에 오고 카드에 언제·몇 명·게스트비가 보인다', function () {
    resetAll();
    var posts = [
      postOf('p1', '마포구민체육센터', '오늘 20:30', '4', '1만원'),
      postOf('p2', '월계배드민턴장', '내일 19:00', '6', '') /* 노원 — 반경 밖 */
    ];
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT, posts: posts });
    includes(html, 'data-gymrecruit', '모집 칸');
    includes(html, '지도 안 게스트 모집', '이름');
    includes(html, '반경 5km 안 모집 <b>1건</b>', '5km 안 1건');
    includes(html, '그 밖 1건', '밖 글 수');
    eq((html.match(/data-gym-recruit-card=/g) || []).length, 1, '카드 1개');
    var card = html.slice(html.indexOf('data-gym-recruit-card'));
    includes(card, '마포구민체육센터', '체육관');
    includes(card, '오늘 20:30', '언제');
    includes(card, '4명', '몇 명');
    includes(card, '게스트비 1만원', '게스트비');
    includes(card, '참여 문의', '참여 버튼');
    includes(card, 'data-gym-view="mapo"', '지도에서 보기');
    /* 모집 칸은 지도 아래에 있고 그다음이 체육관 목록입니다 (권역 칩·검색은 지도 위로 올라감) */
    var section = html.slice(html.indexOf('data-gymrecruit'));
    section = section.slice(0, section.indexOf('data-gymlist'));
    excludes(section, '월계배드민턴장', '5km 밖 글은 모집 목록에 없다');
  });

  test('모집: 글 쓰기 칸에는 체육관 칩·언제·몇 명·게스트비 칩이 있다', function () {
    resetAll();
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT, recruitOpen: true, draft: { place: '마포구민체육센터' } });
    includes(html, 'data-gymrecform', '작성 칸');
    includes(html, 'data-gymrec="place"', '체육관 칸');
    includes(html, 'data-gymrec="when"', '언제 칸');
    includes(html, 'data-gymrec="cap"', '몇 명 칸');
    eq((html.match(/data-gymrec-feeval=/g) || []).length, 3, '게스트비 칩 3개');
    includes(html, 'data-gym-recruit-post', '올리기 버튼');
    includes(html, 'value="마포구민체육센터"', '고른 체육관이 담겨 있다');
    excludes(BM.views.gyms.render({ scope: 'demo_me', now: SAT }), 'data-gymrecform', '닫혀 있으면 칸 없음');
  });

  test('모집: 글이 없으면 안내를, 체육관 카드에는 그 체육관 모집 버튼이 있다', function () {
    resetAll();
    var empty = BM.views.gyms.render({ scope: 'demo_me', now: SAT });
    includes(empty, '첫 모집 글을 올려 보세요', '빈 안내');
    includes(empty, 'data-gym-recruit-new', '모집 글 쓰기 버튼');
    eq((empty.match(/data-gym-recruit-gym=/g) || []).length, G().count(), '카드마다 모집 버튼');
    var withPost = BM.views.gyms.render({ scope: 'demo_me', now: SAT, posts: [postOf('p1', '마포구민체육센터', '오늘 20:30', '4', '')] });
    includes(withPost, '모집 1', '카드 배지');
    includes(withPost, '이 체육관에서 게스트 모집 · 1건', '카드 버튼 문구');
  });

  /* =========================================================
   * 6. 배선 · 개인정보
   * ========================================================= */
  test('배선: js/nearby.js 가 화면·서비스워커 캐시·테스트 목록에 들어 있다', function () {
    if (!hasNode) return;
    ok(existsRoot('js/nearby.js'), 'js/nearby.js 파일');
    var html = readRoot('index.html');
    var at = html.indexOf('js/nearby.js');
    ok(at > 0, 'index.html 에서 불러온다');
    ok(html.indexOf('js/gyms.js') < at, 'gyms.js 다음');
    ok(at < html.indexOf('js/views/gyms.js'), '지도 화면보다 먼저');
    includes(readRoot('sw.js'), "'./js/nearby.js'", '서비스워커 캐시 목록');
    includes(readRoot('test/run.js'), "'js/nearby.js'", '테스트 목록');
    includes(readRoot('styles.css'), '.lamp--live', '파란 불 스타일');
    includes(readRoot('styles.css'), '#3b82f6', '파란 불 색');
    includes(readRoot('js/nearby.js'), 'bm_home_base_v1', '내 집 저장 키');
    includes(readRoot('js/nearby.js'), 'bm_my_avail_v1', '내 상태 저장 키');
  });

  test('개인정보: 내 집·사람 정보는 서버로 보내지 않는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/nearby.js');
    ['fetch(', 'XMLHttpRequest', 'api.', 'supabase', 'navigator.sendBeacon'].forEach(function (word) {
      excludes(src, word, '서버로 보내지 않음: ' + word);
    });
    var view = readRoot('js/views/gyms.js');
    excludes(view, 'setHome(', '서버에 저장하는 액션을 쓰지 않는다');
    includes(src, 'U.readJSON', '기기 저장 읽기');
    includes(src, 'U.writeJSON', '기기 저장 쓰기');
  });

  test('내 집: 기준 위치는 기기 저장소에만 남는다(계정별)', function () {
    resetAll();
    N().saveHome('demo_me', { lat: 37.5496, lng: 126.9138, label: '합정동' });
    var raw = U.readJSON(N().homeKey('demo_me'), null);
    ok(raw && raw.label === '합정동', '저장 키에 남는다');
    eq(N().home('guest').label, '망원동', '다른 계정은 그대로');
    resetAll();
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
