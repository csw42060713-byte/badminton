/* ============================================================
 * test/v157.test.js — bm-v1.57.0
 *   📸 테마 전체 무료 · 인스타 오운완/대회 인증 공유 카드 · 실시간 푸시 알림 틀
 *
 *  사용자가 승인한 세 가지를 그대로 검증합니다.
 *   1) 테마 4종(기본 코트·나이트·사쿠라·라임 코트) 모두 무료 — 하트 가격·배지·차감 없음
 *      · 시작 화면 사쿠라 카드의 '하트 2' 배지·안내 삭제, MY › 테마는 누르면 바로 적용
 *   2) 인스타 공유 카드 — 1080×1350(4:5)
 *      · 오늘 운동(오운완): 운동 시간 · 승패/스코어 또는 AI 점수 · 연속 일수
 *      · 대회 인증: 대회명 · 급수/종목 · 성적(우승/준우승/3위/출전) · 파트너
 *      · 내 사진 위에 얹기(폰 안에서만 합성·서버 전송 0) · 다크 코트 카드 · 투명 PNG 스티커
 *   3) 실시간 푸시 알림(FCM) 틀 — sw.js push/notificationclick, MY 알림 스위치·권한 상태,
 *      VAPID 키가 채워지면 PushManager 구독을 내 설정에 저장하는 경로
 *   4) 기존 5개 탭·v1.56 기능 보호 · 보안(CSP·이스케이프) · 버전(sw·app·index·TWA)
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

  var ME = BM.seed.ME;

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' }, club: '나래울' },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: { date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], games: [{ a: '', b: '' }], pain: [], weakness: [], note: '' } },
      ui: { tab: 'my', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  function ctxOf(state) {
    return {
      store: { state: state },
      actions: { setPref: function () {}, setTheme: function () { return { ok: true }; } },
      repaint: function () {}
    };
  }

  function rec(patch) {
    var r = {
      id: 'r_v157', type: '기록', userKey: ME, nick: '나래', date: U.ymd(),
      minutes: 90, cond: 7, intensity: 7, done: ['스트록', '게임'],
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }],
      team: JSON.stringify({ partner: '민호', rival: '지호' }),
      pain: [], weakness: ['헤어핀'], note: ''
    };
    Object.keys(patch || {}).forEach(function (k) { r[k] = patch[k]; });
    return r;
  }

  /* =========================================================
   * 1. 테마 전체 무료
   * ========================================================= */

  test('v1.57 테마: 4종 모두 하트 가격이 0이다', function () {
    eq(D.THEMES.length, 4, '테마 4종');
    D.THEMES.forEach(function (th) {
      eq(D.themePrice(th.id), 0, th.name + ' 무료');
      eq(D.HEART_RULES.THEME_PRICES[th.id], 0, th.id + ' 가격 0');
      eq(th.price, 0, th.id + ' 정의 가격 0');
      eq(D.ownsTheme({ byType: {} }, ME, th.id), true, th.id + ' 구매 없이도 소유');
    });
    includes(readRoot('js/domain.js'), 'THEME_PRICES: { th_def: 0, th_night: 0, th_court: 0, th_sakura: 0 }', '무료 정책');
  });

  test('v1.57 테마: 시작 화면에 하트 배지·유료 안내가 없다', function () {
    if (!hasNode) return;
    BM.views.start.reset();
    var html = BM.views.start.renderOnboarding({ kind: 'guest', name: '새내기' });
    eq((html.match(/data-pick="theme"/g) || []).length, 3, '앱 분위기 3종 그대로');
    excludes(html, '하트 2', '하트 2 배지 없음');
    excludes(html, 'onbtheme__price', '가격 배지 없음');
    excludes(html, '하트로 여는 테마', '유료 안내 없음');
    includes(html, 'data-onb-theme-note', '아래 한 줄 안내는 그대로');
    var src = readRoot('js/views/start.js');
    excludes(src, 'onbtheme__price', '가격 배지 코드 삭제');
    excludes(src, '하트 ' + "' + price + '" , '하트 가격 문구 삭제');
  });

  test('v1.57 테마: MY › 테마는 하트 확인 없이 바로 적용된다', function () {
    if (!hasNode) return;
    var state = stateOf();
    var html = BM.views.my.render(state);
    includes(html, 'data-theme="th_sakura"', '테마 카드');
    includes(html, 'theme__hint', '설명 유지');
    excludes(html, 'theme__lock', '잠금 배지 없음');
    excludes(html, '하트 2개로 열기', '구매 안내 없음');
    includes(html, '테마는 모두 무료예요', '하트 카드 안내');
    var src = readRoot('js/views/my.js');
    var at = src.indexOf('function pickTheme(ctx, id)');
    ok(at > 0, '테마 선택 함수');
    var body = src.slice(at, src.indexOf('\n  }', src.indexOf('UI.toast(\'테마를 바꾸지 못했어요\'', at)) + 4);
    excludes(body, 'UI.confirm', '무료 테마는 확인 창 없이 적용');
    excludes(body, 'openHeartSheet', '하트 충전 시트 없이 적용');
    includes(body, "ctx.actions.setTheme(id)", '저장소에 바로 적용');
  });

  test('v1.57 테마: 저장소가 하트를 건드리지 않고 테마만 바꾼다', function () {
    if (!hasNode) return;
    U.storage.removeItem('bm_rows_v1');
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () {
      var before = store.state.data.hearts.balance;
      store.state.locks = {};
      var r = store.actions.setTheme('th_court');
      ok(r.ok, '적용');
      eq(r.purchased, false, '구매 아님');
      eq(store.state.data.hearts.balance, before, '하트 그대로');
      eq(store.state.me.theme.theme, 'th_court', '즉시 반영');
      var buy = (store.state.data.idx.byType['꾸미기구매'] || []).filter(function (x) {
        return x.userKey === ME && x.target === 'th_court';
      });
      eq(buy.length, 0, '구매 행을 만들지 않음');
    });
  });

  /* =========================================================
   * 2. 인스타 공유 카드 — 모델
   * ========================================================= */

  function SC() { return BM.sharecard; }

  test('v1.57 공유카드: 두 모드 · 세 가지 출력이 약속대로다', function () {
    var sc = SC();
    eq(sc.W, 1080, '가로 1080');
    eq(sc.H, 1350, '세로 1350 (4:5)');
    eq(sc.MODES.map(function (m) { return m.id; }).join(','), 'today,comp', '오늘 운동 · 대회 인증');
    /* bm-v1.73.0 — 세 가지 '출력'은 디자인 3종(매거진·필름·스티커)으로 대체됐습니다 */
    eq(sc.RESULTS.join(','), '우승,준우승,3위,출전', '성적 4종');
  });

  test('v1.57 공유카드: 오늘 운동 숫자는 운동 시간 · 승패/스코어 · 연속 일수', function () {
    var sc = SC();
    var bigs = sc.todayBigs(rec(), { streak: 12, aiScore: 88 });
    eq(bigs.length, 3, '숫자 3개');
    eq(JSON.stringify(bigs[0]), JSON.stringify({ value: '90', unit: '분', label: '운동 시간' }), '운동 시간');
    eq(bigs[1].value, '2승 1패', '여러 경기는 승패로');
    eq(bigs[2].value, '12', '연속 일수');
    eq(bigs[2].label, '연속 기록', '연속 라벨');

    /* 1경기면 스코어 그대로 */
    var one = sc.todayBigs(rec({ games: [{ a: 21, b: 18 }] }), { streak: 0 });
    eq(one[1].value, '21:18', '1경기는 스코어');
    includes(one[1].label, '승', '승 표시');

    /* 경기 없이 AI 점수만 */
    var noGame = sc.todayBigs(rec({ games: [], score: null }), { aiScore: 91 });
    eq(noGame.length, 2, '운동 시간 + AI 점수');
    eq(noGame[1].value, '91', 'AI 점수');
    eq(noGame[1].label, 'AI 점수', '라벨');

    /* 연속 1일은 자랑 숫자로 쓰지 않고, 최대 3개 */
    eq(sc.todayBigs(rec(), { streak: 1 }).length, 2, '연속 1일은 생략');
    ok(sc.todayBigs(rec(), { streak: 30, aiScore: 80 }).length <= 3, '최대 3개');
  });

  test('v1.57 공유카드: 아래 한 줄은 체육관 · 파트너/라이벌 · 날짜', function () {
    var sc = SC();
    var sub = sc.todaySub(rec({ date: '2026-11-23' }), { gym: '나래울체육관' });
    includes(sub, '나래울체육관', '체육관');
    includes(sub, '민호와 함께', '파트너');
    includes(sub, 'vs 지호', '라이벌');
    includes(sub, '11/23 (월)', '날짜');
    eq(sc.dateLine('2026-11-23'), '11/23 (월)', '날짜 표기');
    eq(sc.dateLine(''), '', '빈 날짜');
  });

  test('v1.57 공유카드: 대회 인증은 대회명 · 급수/종목 · 성적 · 파트너', function () {
    var sc = SC();
    var m = sc.compModel({ contest: '  ○○시 오픈 대회 ', event: 'B조 복식', result: '준우승', partner: '민호', date: '2026-11-22' });
    eq(m.contest, '○○시 오픈 대회', '대회명 다듬기');
    eq(m.event, 'B조 복식', '급수/종목');
    eq(m.result, '준우승', '성적');
    eq(m.partner, '민호', '파트너');
    eq(m.date, '11/22 (일)', '날짜');
    includes(sc.compSub(m), 'B조 복식', '한 줄에 종목');
    includes(sc.compSub(m), '파트너 민호', '한 줄에 파트너');

    /* 빈 입력·모르는 성적도 안전하게 */
    var empty = sc.compModel({ result: '금메달' });
    eq(empty.contest, '오늘의 대회', '빈 대회명 기본값');
    eq(empty.result, '출전', '모르는 성적은 출전');
    eq(empty.event || '', '', '종목 비면 빈 값');
    ok(sc.compModel({ contest: '가'.repeat(80) }).contest.length <= 24, '대회명 길이 상한');
  });

  test('v1.57 공유카드: 파일 이름 · 요약 문구', function () {
    var sc = SC();
    eq(sc.filename('today', '2026-11-23'), 'badminton-share-20261123-today.png', '오늘 카드 이름');
    eq(sc.filename('comp', '2026-11-23'), 'badminton-share-20261123-contest.png', '대회 카드 이름');
    var sum = sc.summaryOf({ title: '오늘 운동', big: { value: '90', unit: '분' }, meta: '나래울 · 11/23 (일)' });
    includes(sum, '오늘 운동', '제목');
    includes(sum, '90분', '숫자');
    includes(sum, '나래울', '아래 줄');
  });

  /* =========================================================
   * 3. 인스타 공유 카드 — 시트·진입점·그리기
   * ========================================================= */

  test('v1.57 공유카드: 시트에 두 모드·사진 고르기·미리보기가 있다', function () {
    if (!hasNode) return;
    var state = stateOf([rec(), rec({ id: 'r_prev', date: '2026-11-22', minutes: 60 })]);
    var sc = SC();
    sc._setState({
      mode: 'today', design: 'magazine', ratio: 'feed', shade: 'original', recordId: 'r_v157', photo: null,
      gym: '나래울체육관', partner: '민호', rival: '지호',
      contest: '', event: '', result: '우승', compPartner: '', date: U.ymd()
    });
    var html = sc._sheetBody(ctxOf(state));
    includes(html, 'data-sc-mode="today"', '오늘 운동 탭');
    includes(html, 'data-sc-mode="comp"', '대회 인증 탭');
    /* bm-v1.73.0 — 디자인 3종(매거진·필름·스티커) */
    ['magazine', 'film', 'sticker'].forEach(function (id) {
      includes(html, 'data-sc-design="' + id + '"', '디자인 ' + id);
    });
    ['feed', 'story'].forEach(function (id) {
      includes(html, 'data-sc-ratio="' + id + '"', '비율 ' + id);
    });
    includes(html, 'type="file" accept="image/*"', '모바일 갤러리·카메라');
    includes(html, 'width="1080" height="1350"', '캔버스 4:5');
    includes(html, 'data-sc-save', '저장·공유 버튼');
    includes(html, '폰 안에서만', '사진은 서버로 보내지 않음');
    includes(html, 'data-sc-summary', '카드 요약');
    includes(html, '어느 일지로 만들까요', '최근 일지 고르기');

    /* 대회 모드로 바꾸면 대회 입력칸·성적 칩이 나온다 */
    sc._setState({
      mode: 'comp', design: 'magazine', ratio: 'feed', shade: 'original', recordId: '', photo: null, gym: '', partner: '', rival: '',
      contest: '○○시 오픈 대회', event: 'B조 복식', result: '준우승', compPartner: '민호', date: U.ymd()
    });
    var comp = sc._sheetBody(ctxOf(state));
    includes(comp, 'data-sc-field="contest"', '대회명 칸');
    includes(comp, 'data-sc-field="event"', '급수/종목 칸');
    ['우승', '준우승', '3위', '출전'].forEach(function (r) {
      includes(comp, 'data-sc-result="' + r + '"', '성적 ' + r);
    });
    includes(comp, 'data-sc-field="compPartner"', '파트너 칸');
    excludes(comp, '어느 일지로 만들까요', '대회 모드에는 일지 선택 없음');
  });

  test('v1.57 공유카드: 사용자가 적은 글자는 이스케이프되어 나간다', function () {
    if (!hasNode) return;
    var state = stateOf([]);
    SC()._setState({
      mode: 'comp', style: 'court', recordId: '', photo: null, gym: '', partner: '', rival: '',
      contest: '<img src=x onerror=alert(1)>', event: '"><script>alert(2)</script>',
      result: '우승', compPartner: '<b>', date: U.ymd()
    });
    var html = SC()._sheetBody(ctxOf(state));
    excludes(html, '<img src=x', '대회명 이스케이프');
    excludes(html, '<script>alert(2)', '종목 이스케이프');
    includes(html, '&lt;img', '글자로 남김');
  });

  test('v1.57 공유카드: 그리기는 캔버스에서만 · 공유 시트/다운로드로 저장', function () {
    if (!hasNode) return;
    var src = readRoot('js/sharecard.js');
    includes(src, "'image/png'", 'PNG 저장');
    includes(src, 'canvas.toBlob', '캔버스 → PNG');
    includes(src, 'navigator.canShare', '공유 시트 지원 확인');
    includes(src, 'navigator.share', '인스타 스토리로 바로 공유');
    includes(src, 'URL.createObjectURL', '공유가 없으면 다운로드');
    includes(src, 'createLinearGradient', '사진 위 그라디언트');
    includes(src, 'clearRect', '투명 스티커(배경 투명)');
    includes(src, 'SHUTTLIX', '브랜드 한 줄 (bm-v1.74.0 — 로고 그림 대신 얇은 워드마크)');
    excludes(src, 'fetch(', '서버 전송 없음');
    excludes(src, 'XMLHttpRequest', '서버 전송 없음');
    excludes(src, 'new FormData', '업로드 없음');
  });

  test('v1.57 공유카드: 일지 저장 직후·기록 상세·MY에 입구가 있다', function () {
    if (!hasNode) return;
    var logjs = readRoot('js/views/log.js');
    includes(logjs, '인스타 공유 카드 만들기', '저장 직후 버튼');
    includes(logjs, "BM.sharecard.open(ctx", '공유 카드 열기');
    var state = stateOf([rec()]);
    var detail = BM.views.log.recordDetail(rec());
    includes(detail, 'data-act="share-card"', '기록 상세 버튼');
    var myHtml = BM.views.my.render(state);
    includes(myHtml, '인스타 공유 카드', 'MY 입구');
    includes(myHtml, 'data-act="share-card"', 'MY 버튼');
    includes(BM.views.my.sharePanel(state), '대회 인증 카드', '대회 인증 입구');
  });

  /* =========================================================
   * 4. 실시간 푸시 알림(FCM) 틀
   * ========================================================= */

  test('v1.57 푸시: sw.js가 푸시를 받아 알림을 띄운다', function () {
    if (!hasNode) return;
    var vm = require('vm');
    var shown = [], handlers = {}, offscreen = [];
    var self = {
      addEventListener: function (name, fn) { handlers[name] = fn; },
      registration: {
        showNotification: function (title, opts) { shown.push({ title: title, opts: opts }); return Promise.resolve(); }
      },
      clients: {
        matchAll: function () { return Promise.resolve([]); },
        openWindow: function (url) { offscreen.push(url); return Promise.resolve(); }
      },
      location: { origin: 'https://cwho.github.io' }
    };
    var ctx = vm.createContext({ self: self, console: console, Date: Date, Promise: Promise });
    vm.runInContext(readRoot('sw.js'), ctx, { filename: 'sw.js' });
    ok(handlers.push, 'push 핸들러');
    ok(handlers.notificationclick, 'notificationclick 핸들러');
    includes(readRoot('sw.js'), 'showNotification', '알림 표시');

    var waits = [];
    handlers.push({
      data: { json: function () { return { title: '새 메시지', body: '민호: 오늘 7시 어때요?', url: '#/matching', tag: 'msg' }; } },
      waitUntil: function (p) { waits.push(p); }
    });
    return Promise.all(waits).then(function () {
      eq(shown.length, 1, '알림 1개');
      eq(shown[0].title, '새 메시지', '제목');
      eq(shown[0].opts.body, '민호: 오늘 7시 어때요?', '본문');
      eq(shown[0].opts.data.url, './#/matching', '링크');
      eq(shown[0].opts.icon, 'icons/icon-192.png', '아이콘');

      /* JSON이 아닌 페이로드도 본문 글자로 */
      shown = [];
      waits = [];
      handlers.push({ data: { json: function () { throw new Error('no json'); }, text: function () { return '그냥 글'; } }, waitUntil: function (p) { waits.push(p); } });
      return Promise.all(waits);
    }).then(function () {
      eq(shown.length, 1, '글자 페이로드도 알림');
      eq(shown[0].opts.body, '그냥 글', '본문 글자');
      eq(shown[0].title, '셔틀릭스', '기본 제목');

      /* 클릭 — 열린 창이 없으면 해시를 붙여 새 창 */
      waits = [];
      handlers.notificationclick({
        notification: { close: function () {}, data: { url: './#/community' } },
        waitUntil: function (p) { waits.push(p); }
      });
      return Promise.all(waits);
    }).then(function () {
      eq(offscreen.join(','), './#/community', '알림 클릭 → 그 탭으로 열기');
    });
  });

  test('v1.57 푸시: 알림 클릭 시 열린 앱을 앞으로 + 그 화면으로', function () {
    if (!hasNode) return;
    var vm = require('vm');
    var posted = [], focused = 0, handlers = {};
    var client = {
      focus: function () { focused++; return Promise.resolve(); },
      postMessage: function (m) { posted.push(m); }
    };
    var self = {
      addEventListener: function (n, fn) { handlers[n] = fn; },
      registration: { showNotification: function () { return Promise.resolve(); } },
      clients: { matchAll: function () { return Promise.resolve([client]); }, openWindow: function () { return Promise.resolve(); } },
      location: { origin: 'https://example.github.io' }
    };
    var ctx = vm.createContext({ self: self, console: console, Date: Date, Promise: Promise });
    vm.runInContext(readRoot('sw.js'), ctx, { filename: 'sw.js' });
    var waits = [];
    handlers.notificationclick({
      notification: { close: function () {}, data: { url: '#/chat' } },
      waitUntil: function (p) { waits.push(p); }
    });
    return Promise.all(waits).then(function () {
      eq(focused, 1, '앱 창 포커스');
      eq(posted.length, 1, '앱에 화면 이동 메시지');
      eq(posted[0].type, 'BM_PUSH_OPEN', '메시지 종류');
      eq(posted[0].url, './#/matching', '채팅은 매칭 탭으로');
    });
  });

/* node에는 브라우저 알림·PushManager가 없으므로, 상태 표시 테스트 동안만 흉내 냅니다 */
  function withPushEnv(opts, fn) {
    var old = { Notification: root.Notification, navigator: root.navigator, PushManager: root.PushManager };
    var perm = (opts && opts.permission) || 'default';
    root.Notification = { permission: perm, requestPermission: function () { return Promise.resolve(perm); } };
    if (!('PushManager' in root)) root.PushManager = function PushManager() {};
    if (!root.navigator) root.navigator = { serviceWorker: { ready: Promise.resolve(null) } };
    function restore() {
      if (old.Notification === undefined) { try { delete root.Notification; } catch (e) { root.Notification = undefined; } }
      else root.Notification = old.Notification;
      if (old.navigator === undefined) { try { delete root.navigator; } catch (e) { root.navigator = undefined; } }
      else root.navigator = old.navigator;
      if (old.PushManager === undefined) { try { delete root.PushManager; } catch (e) { root.PushManager = undefined; } }
      else root.PushManager = old.PushManager;
    }
    var out;
    try { out = fn(); } catch (e) { restore(); throw e; }
    if (out && typeof out.then === 'function') {
      return out.then(function (v) { restore(); return v; }, function (e) { restore(); throw e; });
    }
    restore();
    return out;
  }

  test('v1.57 푸시: Firebase 키가 없으면 준비 상태만, 있으면 구독까지 안내', function () {
    var p = BM.push;
    ok(p, 'push 모듈');
    return withPushEnv({ permission: 'default' }, function () {
      var origKey = BM.api.PUSH_CONFIG.vapidPublicKey;
      BM.api.PUSH_CONFIG.vapidPublicKey = '';
      eq(p.keyReady(), false, '키 없음');
      var st = p.status();
      eq(st.firebaseReady, false, '준비 안 됨');
      eq(st.label, 'Firebase 연결 준비됨 · 곧 켜져요', '준비 상태 문구');

      BM.api.PUSH_CONFIG.vapidPublicKey = 'B'.repeat(87);
      eq(p.keyReady(), true, '키 있음');
      eq(p.status().label, '미설정', '키가 있어도 권한 전에는 미설정');

      /* 권한을 허용하고 구독 기록이 있으면 '허용됨 · 켜짐' */
      root.Notification.permission = 'granted';
      U.writeJSON('bm_push_v1', { endpoint: 'https://push.example/abc', keys: {}, at: U.stamp() });
      eq(p.status().label, '허용됨 · 켜짐', '구독까지 끝난 상태');
      eq(p.status().subscribed, true, '구독 기록');

      root.Notification.permission = 'denied';
      eq(p.status().label, '차단됨', '차단 상태');
      U.storage.removeItem('bm_push_v1');
      BM.api.PUSH_CONFIG.vapidPublicKey = origKey;
    });
  });

  test('v1.57 푸시: 알림 링크는 앱 화면으로만 이어진다', function () {
    var r = BM.push.routeOf;
    if (typeof root.atob !== 'function') {
      var B = require('buffer').Buffer;
      root.atob = function (s) { return B.from(String(s), 'base64').toString('binary'); };
    }
    eq(r('#/matching').tab, 'matching', '해시 탭');
    eq(r('https://csw42060713-byte.github.io/badminton/#/community').tab, 'community', '전체 주소');
    eq(r('#/chat').chat, true, '채팅');
    eq(r('#/chat').tab, 'matching', '채팅은 매칭 탭');
    eq(r('mystery').tab, 'log', '모르는 곳은 첫 화면');
    eq(r('').tab, 'log', '빈 링크');
    eq(BM.push.urlB64ToUint8Array('AAAA').length, 3, 'VAPID 키 변환');
  });

  test('v1.57 푸시: MY 알림 설정에 스위치와 상태 표시가 있다', function () {
    if (!hasNode) return;
    var origKey = BM.api.PUSH_CONFIG.vapidPublicKey;
    BM.api.PUSH_CONFIG.vapidPublicKey = '';
    var panel = withPushEnv({ permission: 'default' }, function () { return BM.views.my.alarmPanel(stateOf()); });
    includes(panel, '실시간 푸시 알림', '이름');
    includes(panel, 'data-act="toggle-push"', '스위치');
    includes(panel, 'data-push-status', '상태 표시');
    includes(panel, 'Firebase 연결 준비됨 · 곧 켜져요', '준비 상태 문구');
    includes(panel, 'data-act="toggle-notify"', '기존 새 메시지 알림 그대로');
    includes(panel, 'data-act="toggle-letter"', '기존 편지지 그대로');
    BM.api.PUSH_CONFIG.vapidPublicKey = origKey;

    /* 설정 기본값 — 푸시는 꺼짐, 켜면 저장 */
    eq(D.normalizePrefs({}).push, false, '푸시 기본 꺼짐');
    eq(D.normalizePrefs({ push: true }).push, true, '켜면 켜짐');
    eq(D.normalizePrefs({ notify: false }).notify, false, '기존 알림 기본값 그대로');
    var myjs = readRoot('js/views/my.js');
    includes(myjs, 'toggle-push', 'MY 스위치 배선');
    includes(myjs, 'BM.push.enable', '켜면 권한·구독');
    includes(readRoot('js/api.js'), 'vapidPublicKey', 'VAPID 설정 자리');
    includes(readRoot('app.js'), 'BM_PUSH_OPEN', '알림 클릭 → 앱 화면');
  });

  /* =========================================================
   * 5. 기존 기능 보호 · 보안 · 버전
   * ========================================================= */

  test('v1.57 보호: 5개 탭·v1.56 기능·공유 스트립이 그대로다', function () {
    if (!hasNode) return;
    var app = readRoot('app.js');
    var tabs = (app.match(/\{ id: '(\w+)', label:/g) || []).join(' ');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (id) {
      includes(tabs, "id: '" + id + "'", '탭 ' + id);
    });
    eq((tabs.match(/id: '/g) || []).length, 5, '탭 5개');
    eq(D.CONDITION_BANDS.length, 5, 'v1.56 컨디션 5단계 유지');
    eq(D.onbThemes().length, 3, 'v1.56 앱 분위기 3종 유지');
    var logjs = readRoot('js/views/log.js');
    includes(logjs, 'data-act="share-log"', '커뮤니티 공유 유지');
    includes(logjs, 'data-act="open-scoreboard"', '코트 점수판 유지');
    includes(logjs, 'data-fold="detail"', '메모·영상 접기 유지');
    var state = stateOf([rec()]);
    var html = BM.views.log.render(state);
    includes(html, 'data-cond-band="normal"', '일지 5단계 카드');
  });

  test('v1.57 보안: 새 화면도 이스케이프를 거치고 CSP는 그대로다', function () {
    if (!hasNode) return;
    var sc = readRoot('js/sharecard.js');
    includes(sc, 'U.esc(', '이스케이프');
    excludes(sc, "innerHTML = '<button", '문자열 그대로 넣지 않음');
    excludes(sc, 'eval(', 'eval 없음');
    var index = readRoot('index.html');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지');
    excludes(csp, 'script-src *', '와일드카드 없음');
    includes(csp, "object-src 'none'", 'object 잠금');
    includes(csp, "form-action 'self'", 'form 잠금');
  });

  test('v1.57 문구: 예시에 실존 선수 이름을 쓰지 않는다', function () {
    if (!hasNode) return;
    var state = stateOf([rec()]);
    SC()._setState({
      mode: 'today', style: 'court', recordId: 'r_v157', photo: null,
      gym: '', partner: '', rival: '', contest: '', event: '', result: '우승', compPartner: '', date: U.ymd()
    });
    var html = SC()._sheetBody(ctxOf(state));
    var src = readRoot('js/sharecard.js');
    ['김원호', '안세영', '서승재'].forEach(function (name) {
      excludes(html, name, '공유 카드 예시에 ' + name + ' 없음');
      excludes(src, name, 'sharecard.js에 ' + name + ' 없음');
    });
  });

  test('v1.57 배선: sw.js 캐시·index 스크립트·테스트 목록에 새 파일이 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "'./js/sharecard.js'", 'sw 캐시 sharecard');
    includes(sw, "'./js/push.js'", 'sw 캐시 push');
    var index = readRoot('index.html');
    ok(index.indexOf('js/push.js') < index.indexOf('js/sharecard.js'), 'push 다음 sharecard');
    ok(index.indexOf('js/ui.js') < index.indexOf('js/sharecard.js'), 'ui 다음 sharecard');
    ok(index.indexOf('js/sharecard.js') < index.indexOf('app.js'), 'app.js 마지막');
    var run = readRoot('test/run.js');
    includes(run, 'js/sharecard.js', '테스트 로드');
    includes(run, 'js/push.js', '테스트 로드');
    includes(run, 'test/v157.test.js', '이 테스트 파일');
  });

  test('v1.57 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.83.0'", 'sw.js');
    includes(app, "version: 'v1.83.0'", 'app.js');
    includes(index, 'styles.css?v=20261126-5', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.83.0', 'TWA 이름');
    eq(twa.appVersion, '1.83.0', 'TWA 버전');
    eq(twa.appVersionCode, 77, 'TWA 코드');
    includes(sw, 'bm-v1.74.0', 'sw 변경 이력');
  });

  test('v1.57 스타일: 공유 카드·푸시 상태 스타일이 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.sc__modes', '.sc__designs', '.sc__design.is-on', '.sc__ratios', '.sc__shadebox', '.sc__preview', '.sc__canvas', '.sc__summary',
      '.pushstatus', '.pushstatus--denied', '.pushstatus--ready'].forEach(function (sel) {
      includes(css, sel, '스타일 ' + sel);
    });
    includes(css, '.sc__preview', '투명 체크무늬 바탕');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
