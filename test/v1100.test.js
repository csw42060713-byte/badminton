/* ============================================================
 * test/v1100.test.js — bm-v1.100.0
 *
 *   2026-11-28 12시 동호인 사용성 점검에서 나온 명백한 버그 3건 수정
 *   (디자인·기획 변경 없이 최소 범위 오류 수정만)
 *
 *   1) 주간·월간 상세 리포트 — 지난 기간엔 경기가 있는데 이번 기간 경기가 0건일 때
 *      비교 배지가 '첫 기간'으로 잘못 나오던 문제 → '이번 주 경기 없음' / '이번 달 경기 없음'
 *   2) 내 커스텀 라켓 —
 *      ① '라켓 터치 동작' 전환의 ⚡ 스매시와 실행 버튼 ⚡ 스매시가 같은 이름이던 중복 → 실행 버튼 '⚡ 스매시 쳐보기'
 *      ② 잠긴 파츠 카드마다 '❤ 2' 옆에 빈 ❤ 아이콘이 하나 더 붙던 중복 → 잠금 ❤ 제거(바디 칩의 🔒 는 그대로)
 *   3) 영상 자세 비교 — '…가장 정확해요.영상 없이 예시로 먼저 보기' 문장이 붙어 있던 문제 → 띄어쓰기
 *
 *   실행: node test/run.js
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

  /* 2026-11-28(토) 고정 — 이번 주 11/22~11/28 · 지난주 11/15~11/21 · 이번 달 11/1~11/28 · 지난달 10월 */
  var NOW = '2026-11-28';
  function day(offset) { return U.ymd(U.addDays(U.parseYmd(NOW), offset)); }

  function rec(opts) {
    opts = opts || {};
    var games = (opts.games || []).map(function (g) { return { a: g[0], b: g[1], mode: 21 }; });
    return {
      id: opts.id || ('r' + Math.random().toString(36).slice(2, 8)),
      type: '기록',
      date: opts.date || day(0),
      minutes: opts.minutes == null ? 60 : opts.minutes,
      done: opts.done || [],
      weakness: opts.weakness || [],
      pain: opts.pain || [],
      games: games,
      score: games.length ? games[0] : null,
      note: opts.note || ''
    };
  }

  function buildOf(records, mode) {
    return BM.report.build(records, { mode: mode || 'week', now: NOW, role: 'club', level: 'C조' });
  }

  /* ============================================================
   * 1. 리포트 비교 배지
   * ============================================================ */

  test('v1.100 리포트: 지난주엔 경기가 있고 이번 주는 0건이면 \'첫 기간\'이 아니라 \'이번 주 경기 없음\'', function () {
    var records = [
      rec({ date: day(-2), minutes: 70, games: [], weakness: ['드라이브'] }),      /* 이번 주 · 경기 점수 없음 */
      rec({ date: day(-8), minutes: 60, games: [[21, 18], [15, 21]] })             /* 지난주 · 2경기 */
    ];
    var r = buildOf(records);
    eq(r.current.games, 0, '이번 주 경기 0건');
    eq(r.prev.games, 2, '지난주 경기 2건');
    eq(r.prev.rate, 50, '지난주 승률 50%');
    eq(r.rateDiff, null, '비교할 이번 주 승률이 없다');
    var html = BM.report.bodyHtml(r);
    includes(html, '이번 주 경기 없음', '이번 주 경기 없음 배지');
    excludes(html, '첫 기간', '처음 쓰는 주처럼 보이지 않는다');
    ok(html.indexOf('이번 주 경기 없음') !== html.lastIndexOf('이번 주 경기 없음'), '두 칸(전체·접전)에 모두');
  });

  test('v1.100 리포트: 월간도 이번 달 경기 0건이면 \'이번 달 경기 없음\'', function () {
    var records = [
      rec({ date: '2026-11-26', minutes: 70, games: [] }),
      rec({ date: '2026-10-20', minutes: 60, games: [[21, 19]] })
    ];
    var r = buildOf(records, 'month');
    eq(r.current.games, 0, '이번 달 경기 0건');
    eq(r.prev.rate, 100, '지난달 승률 100%');
    var html = BM.report.bodyHtml(r);
    includes(html, '이번 달 경기 없음', '이번 달 경기 없음 배지');
    excludes(html, '첫 기간', '첫 달처럼 보이지 않는다');
  });

  test('v1.100 리포트: 두 기간 모두 경기가 없을 때만 \'첫 기간\' 그대로', function () {
    var r = buildOf([rec({ date: day(0), minutes: 60, games: [], weakness: ['드라이브'] })]);
    eq(r.prev.sessions, 0, '지난 기간 일지 없음');
    includes(BM.report.bodyHtml(r), '첫 기간', '두 기간 모두 경기 없음 → 첫 기간');
  });

  test('v1.100 리포트: 이번 주에 경기가 있고 지난주엔 없으면 \'지난주 경기 없음\'', function () {
    var records = [
      rec({ date: day(0), minutes: 60, games: [[21, 18]] }),
      rec({ date: day(-9), minutes: 50, games: [], weakness: ['서브'] })           /* 지난주 일지는 있지만 경기 점수 없음 */
    ];
    var r = buildOf(records);
    eq(r.current.rate, 100, '이번 주 승률 100%');
    eq(r.prev.sessions, 1, '지난주 일지 1건');
    eq(r.prev.games, 0, '지난주 경기 0건');
    var html = BM.report.bodyHtml(r);
    includes(html, '지난주 경기 없음', '지난주 쪽이 비었다고 알려 줌');
    excludes(html, '첫 기간', '첫 기간 아님');
  });

  test('v1.100 리포트: 이번 주 접전만 없으면 \'이번 주 접전 없음\' (경기 없음과 구분)', function () {
    var records = [
      rec({ date: day(0), minutes: 60, games: [[21, 10]] }),                       /* 11점차 — 접전 아님 */
      rec({ date: day(-8), minutes: 60, games: [[21, 19]] })
    ];
    var r = buildOf(records);
    eq(r.current.close.games, 0, '이번 주 접전 0건');
    eq(r.current.games, 1, '이번 주 경기 1건');
    includes(BM.report.bodyHtml(r), '이번 주 접전 없음', '접전만 없다고 구분');
  });

  test('v1.100 리포트: 변화가 있는 기존 표시는 그대로 (-33%p)', function () {
    var records = [
      rec({ date: day(0), minutes: 60, games: [[21, 18], [15, 21], [21, 19]] }),
      rec({ date: day(-8), minutes: 60, games: [[21, 19]] })
    ];
    var r = buildOf(records);
    eq(r.rateDiff, -33, '이번 67% vs 지난주 100% = -33%p');
    includes(BM.report.bodyHtml(r), '-33%p', '변화 배지 그대로');
    excludes(BM.report.bodyHtml(r), '경기 없음', '값이 있으면 안내는 나오지 않음');
  });

  /* ============================================================
   * 2. 내 커스텀 라켓
   * ============================================================ */

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };
  function stateWith(custom) {
    var me = JSON.parse(JSON.stringify(ME));
    me.theme.gear = { custom: custom || {} };
    return {
      ready: true, mode: 'local', me: me, rows: [],
      data: BM.store.derive([], BM.seed.ME), drafts: {}, ui: {}, hearts: { balance: 9 }
    };
  }

  test('v1.100 라켓: 전환 버튼 ⚡ 스매시와 실행 버튼이 같은 이름이 아니다', function () {
    var RC = BM.racketcustom;
    var html = RC.stageHtml(stateWith({}));
    includes(html, 'data-rk-mode="smash"', '터치 동작 전환(스매시) 그대로');
    includes(html, 'data-rk-mode="paint"', '터치 동작 전환(꾸미기) 그대로');
    includes(html, 'data-rk-smash="1"', '실행 버튼 그대로');
    includes(html, '>⚡ 스매시 쳐보기</button>', '실행 버튼은 무엇을 하는지 분명하게');
    /* 같은 '⚡ 스매시' 글자는 전환 버튼 하나뿐 */
    eq((html.match(/>⚡ 스매시</g) || []).length, 1, '⚡ 스매시 라벨은 한 곳만');
    /* 실행 버튼의 읽어 주는 이름은 예전부터 '연출 쳐보기' */
    includes(html, '연출 쳐보기', 'aria-label 유지');
  });

  test('v1.100 라켓: 잠긴 파츠 카드에 빈 ❤ 아이콘이 겹쳐 나오지 않는다', function () {
    var RC = BM.racketcustom;
    var html = RC.sheetBody(stateWith({}));
    var frame = html.slice(html.indexOf('data-rk-group="frame"'), html.indexOf('data-rk-group="string"'));
    ok(frame.indexOf('스텔스 카본') >= 0, '잠긴 파츠 카드가 그려졌다');
    includes(frame, '❤ 2', '가격 배지는 그대로');
    excludes(frame, '❤</span>', '가격 옆 빈 ❤ 아이콘 없음');
    eq((frame.match(/rkpart__lock/g) || []).length, 0, '파츠 카드에 잠금 ❤ 요소 없음');
    /* 바디(모델) 칸의 🔒 잠금 표시는 그대로 — 하트와 헷갈리지 않는 아이콘 */
    includes(html, '🔒</span>', '바디 칩 잠금 표시 유지');
  });

  test('v1.100 라켓: 하트 부족 · 광고로 열기 · 열린 파츠 표시는 그대로', function () {
    var RC = BM.racketcustom;
    var html = RC.sheetBody(stateWith({}));
    includes(html, '⚡ 광고로 열기', '하트 부족 안내 유지');
    includes(html, '보유', '이미 연 파츠 표시 유지');
    includes(html, '무료', '무료 파츠 표시 유지');
    /* 잠긴 카드에는 여전히 is-lock 이 붙어 흐림·잠금 상태를 보여 준다 */
    includes(html, 'class="rkpart is-r-', '파츠 카드 클래스 유지');
    includes(html, 'is-lock', '잠금 카드 표시 유지');
  });

  /* ============================================================
   * 3. 영상 자세 비교 안내 문장
   * ============================================================ */

  test('v1.100 자세 비교: \'정확해요.\' 와 \'영상 없이 예시로 먼저 보기\' 사이에 띄어쓰기·줄바꿈이 있다', function () {
    /* 앞선 테스트가 데모 구간을 열어 두었을 수 있어 빈 상태로 되돌린 뒤 그린다 */
    var st = BM.pose._state();
    st.segs.length = 0; st.segPlan.length = 0; st.busy = false; st.error = ''; st.demo = '';
    var html = BM.pose.statusHtml();
    includes(html, '가장 정확해요. <br>', '문장 끝 띄어쓰기 + 줄바꿈');
    var text = html.replace(/<[^>]+>/g, '');
    ok(/가장 정확해요\.\s+영상 없이 예시로 먼저 보기/.test(text), '글자만 뽑아도 문장이 붙지 않는다');
    excludes(text, '정확해요.영상', '붙은 문장 없음');
    includes(html, '예시로 먼저 보기', '안내 문구 그대로');
    includes(readRoot('js/pose.js'), '가장 정확해요. <br>', '소스에도 같은 문장');
  });

  /* ============================================================
   * 4. 보호 · 버전
   * ============================================================ */

  test('v1.100 보호: 리포트 섹션·라켓 기능·자세 비교 안내는 그대로', function () {
    var rep = readRoot('js/report.js');
    ['volume', 'weak', 'pain', 'next'].forEach(function (sec) {
      includes(rep, 'data-rpt-sec="' + sec + '"', '리포트 ' + sec + ' 섹션');
    });
    includes(rep, 'function statCell', '지표 칸');
    var rc = readRoot('js/racketcustom.js');
    includes(rc, 'data-rk-full="1"', '전체화면');
    includes(rc, 'data-rk-slam="1"', '바닥 강타');
    includes(rc, "id: 'fire', name: '불꽃 스매시'", '스페셜 스매시');
    var pose = readRoot('js/pose.js');
    includes(pose, '영상은 서버로 전송되지 않고', '폰 안 분석 안내');
  });

  test('v1.100 버전: sw · app · push · 스타일 캐시 · TWA · README · 테스트 목록', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var push = readRoot('js/push.js');
    includes(sw, "var VERSION = 'bm-v1.100.0'", 'sw.js');
    includes(app, "version: 'v1.100.0'", 'app.js');
    includes(push, "version: 'v1.100.0'", 'push.js');
    includes(index, 'styles.css?v=20261128-6', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.100.0', 'TWA 이름');
    eq(twa.appVersion, '1.100.0', 'TWA appVersion');
    eq(twa.appVersionCode, 94, 'TWA 버전 코드 +1');
    includes(readRoot('README.md'), 'bm-v1.100.0', 'README');
    includes(readRoot('test/run.js'), 'test/v1100.test.js', '테스트 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
