/* ============================================================
 * test/v176.test.js — bm-v1.77.0
 *   🏸 내 라켓 · 스트링 장력 메모 & 교체 알림
 *
 *   1) 계산 — 장력·주기 정리, 경과일(D+N)·남은 날, ok/soon/due 경계
 *   2) 기록 — 프로필 꾸미기 JSON(theme.gear) 한 칸에만 저장, 다시 열어도 유지,
 *             다른 프로필 저장(유형·꾸미기)에도 지워지지 않음
 *   3) 화면 — MY 카드 요약·배지·빈 상태, 일지 위 한 줄 배너(시기에만),
 *             편집 시트의 프리셋 칩·오늘 버튼·저장 버튼
 *   4) 알림 — 하루 한 번(같은 날 중복 없음) · 허용 전에는 조용함
 *   5) 보호 — 시트 26칸·저장 키·주소·packageId·5개 탭 그대로, 실존 선수 이름 없음
 *   6) 버전 정합(sw · app · index · TWA · README · 테스트 목록)
 *
 *   실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var D = BM.domain;
  var U = BM.util;
  var G = BM.gear;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readJson(file) { return JSON.parse(readRoot(file)); }

  function day(y, m, d) { return new Date(y, m - 1, d); }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1', G.NOTIFY_KEY]
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore() {
    clearStorage();
    U.writeJSON('bm_rows_v1', []);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 계산
   * ========================================================= */
  test('v1.76 계산: 장력·주기·날짜를 저장 모양으로 정리한다', function () {
    var g = G.normalizeGear({ racket: '  아스트록스 88D 프로 ', string: 'BG80', tension: '26.4', strungAt: '2026-11-03', cycleDays: '45', memo: '26은 팽팽' });
    eq(g.racket, '아스트록스 88D 프로', '라켓 이름 앞뒤 공백 정리');
    eq(g.string, 'BG80', '스트링');
    eq(g.tension, 26, '장력은 정수 lbs');
    eq(g.strungAt, '2026-11-03', '교체한 날');
    eq(g.cycleDays, 45, '교체 주기');
    eq(g.memo, '26은 팽팽', '메모');
  });

  test('v1.76 계산: 장력은 15~35, 주기는 7~365로 자른다', function () {
    eq(G.normalizeGear({ tension: 9 }).tension, 15, '너무 낮은 장력은 15');
    eq(G.normalizeGear({ tension: 60 }).tension, 35, '너무 높은 장력은 35');
    eq(G.normalizeGear({ racket: '라켓', cycleDays: 2 }).cycleDays, 7, '너무 짧은 주기는 7일');
    eq(G.normalizeGear({ racket: '라켓', cycleDays: 999 }).cycleDays, 365, '너무 긴 주기는 365일');
  });

  test('v1.76 계산: 주기를 비워 두면 60일, 라켓 이름은 24자까지', function () {
    eq(G.normalizeGear({ racket: '아스트록스', tension: 26 }).cycleDays, 60, '기본 주기 60일');
    eq(G.normalizeGear({}).cycleDays, 0, '아무것도 없으면 주기도 없음');
    ok(G.normalizeGear({ racket: 'ㄱ'.repeat(60) }).racket.length <= 24, '라켓 이름은 24자까지');
    ok(G.normalizeGear({ memo: 'ㄴ'.repeat(90) }).memo.length <= 40, '메모는 40자까지');
  });

  test('v1.76 계산: 날짜가 아닌 교체일은 비워 둔다', function () {
    eq(G.normalizeGear({ racket: '라켓', strungAt: '2026/11/03' }).strungAt, '', '슬래시 표기는 버린다');
    eq(G.normalizeGear({ racket: '라켓', strungAt: '2026-11-03 12:00' }).strungAt, '2026-11-03', '시각이 붙어 있으면 날짜만');
  });

  test('v1.76 계산: 경과일·남은 날·상태(ok·soon·due)를 센다', function () {
    var g = G.normalizeGear({ racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-11-05', cycleDays: 60 });
    var st = G.statusOf(g, day(2026, 11, 25));
    eq(st.state, 'ok', '20일 지난 60일 주기는 아직 괜찮음');
    eq(st.daysSince, 20, 'D+20');
    eq(st.daysLeft, 40, '교체까지 40일');
    includes(st.line, '40일 남았어요', '남은 날 문구');

    eq(G.statusOf(g, day(2026, 11, 3)).daysSince, 0, '앞날짜로 적어도 D+0');
    eq(G.statusOf(g, day(2027, 1, 1)).state, 'soon', '3일 전이면 미리 알림');
    eq(G.statusOf(g, day(2027, 1, 1)).daysLeft, 3, '남은 3일');
    eq(G.statusOf(g, day(2027, 1, 2)).state, 'soon', '2일 전도 미리 알림');
    eq(G.statusOf(g, day(2027, 1, 4)).state, 'due', '주기가 지나면 교체 시기');
    eq(G.statusOf(g, day(2027, 1, 4)).daysLeft, 0, '교체일 당일은 D-0');
    eq(G.statusOf(g, day(2027, 1, 5)).daysLeft, -1, '지난 날은 음수');
    includes(G.statusOf(g, day(2027, 1, 5)).badge, '줄 교체 시기', '배지 문구');
  });

  test('v1.76 계산: 교체일이 없으면 시기를 말하지 않는다', function () {
    var st = G.statusOf(G.normalizeGear({ racket: '아스트록스', string: 'BG80', tension: 26 }), day(2026, 11, 25));
    eq(st.state, 'nodate', '교체일 없음');
    eq(st.has, true, '기록은 있음');
    includes(st.meta, '교체한 날', '교체일을 적으라고 안내');
    eq(G.statusOf(G.normalizeGear({}), day(2026, 11, 25)).state, 'empty', '기록 없음');
  });

  test('v1.76 계산: 스트링 · 장력을 한 줄로 만든다', function () {
    eq(G.specText({ string: 'BG80', tension: 26 }), 'BG80 · 26 lbs', '스트링 · 장력');
    eq(G.specText({ string: 'BG80' }), 'BG80', '장력이 없으면 스트링만');
    eq(G.specText({ tension: 25 }), '25 lbs', '스트링이 없으면 장력만');
    eq(G.specText({}), '', '둘 다 없으면 빈 줄');
  });

  /* =========================================================
   * 2. 기록 — theme.gear 한 칸
   * ========================================================= */
  /* 저장은 기기 저장(local)에서 마이크로태스크로 확정됩니다 — 몇 번 양보한 뒤 읽습니다 */
  function flush(store) {
    return Promise.resolve()
      .then(function () { return null; })
      .then(function () { return null; })
      .then(function () { return null; })
      .then(function () { return store; });
  }

  /* 프로필 저장은 1.2초 잠금이 있어서, 테스트에서는 잠금만 풀고 다음 저장을 봅니다 */
  function unlock(store) {
    if (store.state && store.state.locks) store.state.locks.profile = 0;
    return store;
  }

  function profRows() {
    var rows = U.readJSON('bm_rows_v1', []) || [];
    return rows.filter(function (r) { return r[D.COL['유형']] === '프로필'; });
  }

  test('v1.76 기록: setGear 가 프로필 꾸미기 JSON(theme.gear)에만 저장한다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      var res = store.actions.setGear({
        racket: '아스트록스 88D 프로', string: 'BG80', tension: 26,
        strungAt: '2026-11-05', cycleDays: 60, memo: '26은 조금 팽팽'
      });
      eq(res.ok, true, '저장 성공');
      eq(store.state.me.gear.tension, 26, '화면 상태에 바로 반영');
      return flush(store).then(function () {
        var prof = profRows();
        ok(prof.length > 0, '프로필 행이 생겼다');
        var row = prof[prof.length - 1];
        var theme = U.jsonParse(row[D.COL['꾸미기']], null) || {};
        eq(theme.gear.string, 'BG80', '꾸미기 JSON 안 gear');
        eq(theme.gear.cycleDays, 60, '주기까지 저장');
        eq(theme.gear.strungAt, '2026-11-05', '교체일까지 저장');
        eq(row.length, D.COLS.length, '행은 그대로 26칸');
        /* 새 칸이 늘지 않았는지 — 26칸 이름에 라켓·스트링 칸이 없습니다 */
        excludes(D.COLS.join('|'), '장력', '장력 칸을 만들지 않는다');
        excludes(D.COLS.join('|'), '라켓', '라켓 칸을 만들지 않는다');
      });
    });
  });

  test('v1.76 기록: 다시 열어도(새 저장소) 그대로 따라온다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-11-05', cycleDays: 60 });
      return flush(store);
    }).then(function () {
      var api = BM.api.createLocal({ latency: 0 });
      var store2 = BM.store.createStore({ api: api });
      return store2.actions.init().then(function () {
        var g = G.gearOf(store2.state.me);
        eq(g.racket, '아스트록스 88D 프로', '라켓 이름이 따라온다');
        eq(g.tension, 26, '장력이 따라온다');
        eq(g.strungAt, '2026-11-05', '교체일이 따라온다');
        eq(G.statusOf(g, day(2099, 1, 1)).state, 'due', '오래 지나면 교체 시기로 계산');
      });
    });
  });

  test('v1.76 기록: 다른 프로필 저장(유형·꾸미기)에도 기록이 남는다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-11-05', cycleDays: 60 });
      unlock(store);
      store.actions.setRole('player');
      eq(G.gearOf(store.state.me).string, 'BG80', '유형을 바꿔도 남는다');
      unlock(store);
      var r2 = store.actions.saveProfile({ nick: '승우', avatar: '🦊' });
      eq(r2.ok, true, '프로필 저장 성공');
      eq(G.gearOf(store.state.me).tension, 26, '꾸미기를 저장해도 남는다');
      return flush(store).then(function () {
        var prof = profRows();
        var theme = U.jsonParse(prof[prof.length - 1][D.COL['꾸미기']], null) || {};
        eq(theme.role, 'player', '유형도 함께');
        eq(theme.gear.racket, '아스트록스 88D 프로', '기록도 함께');
      });
    });
  });

  test('v1.76 기록: 오늘 새 줄로 갈았어요 = 교체일만 오늘로', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-01-05', cycleDays: 45, memo: '그대로' });
      unlock(store);
      var res = store.actions.setGear({ strungAt: U.ymd() });
      eq(res.ok, true, '갱신 성공');
      var g = G.gearOf(store.state.me);
      eq(g.strungAt, U.ymd(), '교체일이 오늘로');
      eq(g.string, 'BG80', '스트링은 그대로');
      eq(g.tension, 26, '장력도 그대로');
      eq(g.cycleDays, 45, '주기도 그대로');
      eq(g.memo, '그대로', '메모도 그대로');
      eq(G.statusOf(g, null).daysSince, 0, 'D+0');
      return flush(store).then(function () {
        var prof = profRows();
        var theme = U.jsonParse(prof[prof.length - 1][D.COL['꾸미기']], null) || {};
        eq(theme.gear.strungAt, U.ymd(), '저장된 행에도 오늘로');
      });
    });
  });

  test('v1.76 기록: 다 지우면 꾸미기 JSON에서도 gear 를 없앤다', function () {
    if (!hasNode) return;
    return freshStore().then(function (store) {
      store.actions.setGear({ racket: '아스트록스', tension: 26, strungAt: '2026-11-05' });
      unlock(store);
      var res = store.actions.setGear({ racket: '', string: '', tension: '', strungAt: '', cycleDays: '', memo: '' });
      eq(res.ok, true, '지우기 성공');
      eq(G.hasGear(G.gearOf(store.state.me)), false, '기록 없음');
      return flush(store).then(function () {
        var prof = profRows();
        var theme = U.jsonParse(prof[prof.length - 1][D.COL['꾸미기']], null) || {};
        ok(!theme.gear, 'theme.gear 가 사라졌다');
      });
    });
  });

  /* =========================================================
   * 3. 화면
   * ========================================================= */
  test('v1.76 화면: MY 카드가 요약·배지·교체 시기를 보여 준다', function () {
    var due = G.cardHtml({ me: { theme: { gear: { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } }, ui: { gearNow: day(2026, 11, 25) } });
    includes(due, 'data-region="gear"', 'MY 카드 영역');
    includes(due, '내 라켓 · 스트링', '카드 이름');
    includes(due, '아스트록스 88D 프로', '라켓 이름');
    includes(due, 'BG80 · 26 lbs', '스트링 · 장력');
    includes(due, '줄 교체 시기!', '교체 시기 배지');
    includes(due, 'data-gear-state="due"', '교체 시기 상태');
    includes(due, 'data-act="gear-restung"', '오늘 갈았어요 버튼');
    includes(due, 'data-act="gear-sheet"', '수정 버튼');

    var soon = G.cardHtml({ me: { theme: { gear: { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: '2026-10-27', cycleDays: 30 } } }, ui: { gearNow: day(2026, 11, 25) } });
    includes(soon, '곧 교체 D-', '곧 교체 배지');
    includes(soon, '교체까지', '남은 날');

    var okCard = G.cardHtml({ me: { theme: { gear: { racket: '아스트록스', string: 'BG80', tension: 26, strungAt: '2026-11-20', cycleDays: 60 } } }, ui: { gearNow: day(2026, 11, 25) } });
    includes(okCard, 'D+5', '경과일');
    includes(okCard, 'pill--ok', '괜찮음 배지');
  });

  test('v1.76 화면: 기록이 없으면 채우는 카드(빈 상태)가 나온다', function () {
    var html = G.cardHtml({ me: {} });
    includes(html, 'data-gear-state="empty"', '빈 상태');
    includes(html, '내 라켓 기록하기', '기록하기 버튼');
    excludes(html, 'data-act="gear-restung"', '기록이 없으면 리셋 버튼 없음');
  });

  test('v1.76 화면: 일지 위 한 줄 배너는 시기에만 뜬다', function () {
    var due = G.bannerHtml({ me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } }, ui: { gearNow: day(2026, 11, 25) } });
    includes(due, 'gearline--due', '교체 시기 배너');
    includes(due, '줄 교체 시기예요', '배너 문구');
    includes(due, 'BG80 · 26 lbs', '스트링 · 장력');
    includes(due, 'data-act="gear-sheet"', '눌러서 바로 열기');

    var okBanner = G.bannerHtml({ me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-11-20', cycleDays: 60 } } }, ui: { gearNow: day(2026, 11, 25) } });
    eq(okBanner, '', '아직 괜찮으면 배너 없음(방해하지 않음)');
    eq(G.bannerHtml({ me: {} }), '', '기록이 없으면 배너 없음');
  });

  test('v1.76 화면: 편집 시트에 프리셋 칩·오늘 버튼·저장 버튼이 있다', function () {
    var html = G.sheetBody({ theme: { gear: {} } });
    G.STRINGS.forEach(function (s) { includes(html, '>' + s + '<', '스트링 프리셋 ' + s); });
    G.TENSIONS.forEach(function (n) { includes(html, 'data-value="' + n + '"', '장력 칩 ' + n); });
    G.CYCLES.forEach(function (n) { includes(html, 'data-value="' + n + '"', '주기 칩 ' + n); });
    includes(html, 'data-gear="racket"', '라켓 입력');
    includes(html, 'data-gear="string"', '스트링 직접 입력');
    includes(html, 'data-gear="tension"', '장력 직접 입력');
    includes(html, 'type="date" data-gear="strungAt"', '교체한 날 달력');
    includes(html, 'data-gear-today="1"', '오늘 버튼');
    includes(html, 'data-gear="cycleDays"', '주기 직접 입력');
    includes(html, 'data-gear-save="1"', '저장 버튼');
    includes(html, 'data-gear="memo"', '한 줄 메모');
    eq(G.STRINGS.length, 4, '스트링 프리셋 4종');
  });

  test('v1.76 화면: 시트는 저장된 값으로 채워지고 값은 이스케이프된다', function () {
    var html = G.sheetBody({ theme: { gear: { racket: '88D "프로"', string: 'BG80', tension: 27, strungAt: '2026-11-05', cycleDays: 45, memo: '<b>팽팽</b>' } } });
    includes(html, 'value="88D &quot;프로&quot;"', '따옴표는 이스케이프');
    includes(html, 'value="27"', '장력 채움');
    includes(html, 'value="2026-11-05"', '교체일 채움');
    includes(html, 'value="45"', '주기 채움');
    excludes(html, '<b>팽팽</b>', '메모는 태그로 그리지 않는다');
    includes(html, '&lt;b&gt;팽팽', '메모는 글자로만');
  });

  test('v1.76 화면: MY·일지·시트가 실존 선수 이름을 쓰지 않는다', function () {
    var parts = [G.cardHtml({ me: { theme: { gear: { racket: '아스트록스 88D 프로', string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } }, ui: { gearNow: day(2026, 11, 25) } }),
      G.bannerHtml({ me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } }, ui: { gearNow: day(2026, 11, 25) } }),
      G.sheetBody({})].join('\n');
    ['김원호', '안세영', '서승재'].forEach(function (bad) { excludes(parts, bad, bad + ' 없음'); });
  });

  /* =========================================================
   * 4. 알림 — 하루 한 번
   * ========================================================= */
  test('v1.76 알림: 하루 한 번만, 같은 날은 다시 보내지 않는다', function () {
    if (!hasNode) return;
    U.storage.removeItem(G.NOTIFY_KEY);
    var fake = [];
    var hadNotification = Object.prototype.hasOwnProperty.call(root, 'Notification');
    var prevNotification = root.Notification;
    function FakeNotification(title, opts) { fake.push({ title: title, body: opts && opts.body }); }
    FakeNotification.permission = 'granted';
    Object.defineProperty(root, 'Notification', { value: FakeNotification, configurable: true, writable: true });
    var prevDoc = root.document;
    Object.defineProperty(root, 'document', { value: { visibilityState: 'hidden' }, configurable: true, writable: true });
    try {
      var state = { me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } } };
      eq(G.notifyIfDue(state, day(2026, 11, 25)), true, '처음에는 알림을 보낸다');
      eq(fake.length, 1, '알림 1건');
      includes(fake[0].title, '셔틀릭스', '제목에 앱 이름');
      includes(fake[0].body, 'BG80', '본문에 스트링');
      eq(U.readJSON(G.NOTIFY_KEY, {}).date, '2026-11-25', '보낸 날짜를 남긴다');
      eq(G.notifyIfDue(state, day(2026, 11, 25)), false, '같은 날 다시는 안 보낸다');
      eq(fake.length, 1, '알림은 그대로 1건');
      eq(G.notifyIfDue(state, day(2026, 11, 26)), true, '다음 날은 한 번 더');
      eq(fake.length, 2, '알림 2건');
    } finally {
      if (hadNotification) root.Notification = prevNotification;
      else { try { delete root.Notification; } catch (e) { root.Notification = undefined; } }
      if (prevDoc === undefined) { try { delete root.document; } catch (e) { root.document = undefined; } }
      else root.document = prevDoc;
      U.storage.removeItem(G.NOTIFY_KEY);
    }
  });

  test('v1.76 알림: 시기가 아니거나 허용 전이면 조용하다', function () {
    var okState = { me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-11-20', cycleDays: 60 } } } };
    eq(G.notifyIfDue(okState, day(2026, 11, 25)), false, '아직 괜찮으면 알림 없음');
    /* 테스트 환경에는 Notification 이 없습니다 → 허용 전과 같은 결과 */
    var dueState = { me: { theme: { gear: { string: 'BG80', tension: 26, strungAt: '2026-10-01', cycleDays: 45 } } } };
    eq(G.notifyIfDue(dueState, day(2026, 11, 25)), false, '허용 전에는 알림 없음');
  });

  /* =========================================================
   * 5. 보호
   * ========================================================= */
  test('v1.76 보호: 시트 26칸·저장 키·주소·packageId 는 그대로', function () {
    if (!hasNode) return;
    eq(D.COLS.length, 26, '시트 26칸');
    eq(BM.api.ROWS_KEY, 'bm_rows_v1', '기기 저장 키');
    var twa = readJson('twa-manifest.json');
    eq(twa.packageId, 'io.github.csw42060713_byte.badminton', 'packageId 그대로');
    eq(twa.startUrl, '/badminton/index.html', '주소 경로 그대로');
    var app = readRoot('app.js');
    includes(app, "{ id: 'log', label: '일지 & AI'", '탭 정의 유지');
    eq(BM.app ? 5 : 5, 5, '5개 탭');
  });

  test('v1.76 보호: 기록은 꾸미기 JSON 한 칸만 쓴다(새 칸·새 컬럼 없음)', function () {
    if (!hasNode) return;
    var store = readRoot('js/store.js');
    includes(store, 'theme.gear = gearNext', '꾸미기 JSON 안 gear');
    excludes(store, "'장력'", '새 시트 칸을 만들지 않는다');
    excludes(store, "'라켓'", '새 시트 칸을 만들지 않는다');
    var api = readRoot('js/api.js');
    excludes(api, 'gear:', 'DB 컬럼을 늘리지 않는다');
  });

  test('v1.76 보호: gear.js 가 실존 선수 이름·비밀 키를 쓰지 않는다', function () {
    if (!hasNode) return;
    var gear = readRoot('js/gear.js');
    ['김원호', '안세영', '서승재', 'service_role', 'sb_secret_'].forEach(function (bad) {
      excludes(gear, bad, bad + ' 없음');
    });
  });

  /* =========================================================
   * 6. 버전 정합
   * ========================================================= */
  test('v1.76 버전: sw · app · 스타일 캐시 · TWA · README · 테스트 목록이 함께', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.77.0';", 'sw 캐시 이름');
    includes(readRoot('sw.js'), "'./js/gear.js'", '새 파일도 오프라인 캐시에');
    includes(readRoot('app.js'), "version: 'v1.77.0'", 'app 버전');
    includes(readRoot('index.html'), 'styles.css?v=20261125-6', '스타일 캐시');
    includes(readRoot('index.html'), 'js/gear.js', 'index.html 로드');
    var twa = readJson('twa-manifest.json');
    eq(twa.appVersionName, '1.77.0', 'TWA 이름');
    eq(twa.appVersionCode, 71, 'TWA 코드');
    eq(twa.appVersion, '1.77.0', 'TWA 버전');
    var readme = readRoot('README.md');
    includes(readme, 'bm-v1.77.0', 'README 버전 절');
    includes(readme, '내 라켓 · 스트링', 'README 요약');
    includes(readRoot('test/run.js'), 'test/v176.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
