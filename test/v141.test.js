/* ============================================================
 * test/v141.test.js — bm-v1.41.1 (2026-11-21 저녁)
 *
 *  사용자가 고른 3번째 기능 — 주간 / 월간 상세 리포트
 *   1) 주간(최근 7일 vs 직전 7일) · 월간(이번 달 vs 지난달) 전환
 *   2) 운동량·승률(전체 + 접전 3점차) 변화
 *   3) 가장 자주 뜬 약점 TOP 3 (빈도·비중·지난 기간 대비 증감)
 *   4) 반복된 통증 부위 + 주의 안내, 다음 주/달 맞춤 방향 2~3줄
 *   5) 기록 0건이면 빈 상태 안내 · 일지 & AI / MY에 한 번에 여는 입구
 *
 *  새 시트 칸·DB 컬럼 없이 state.data.records 계산만 합니다.
 *  실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  var NOW = '2026-11-21';       /* 금요일 아님(토요일) — 날짜 계산만 고정해서 씁니다 */

  function day(offset) { return U.ymd(U.addDays(U.parseYmd(NOW), offset)); }

  /* 일지 한 건 — games: [[21,18],[19,21]] 처럼 */
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

  /* 이번 주(11/15~11/21) 3건 · 지난주(11/8~11/14) 2건 */
  function weekRecords() {
    return [
      rec({ date: day(0), minutes: 60, games: [[21, 18], [18, 21], [21, 19]], weakness: ['드라이브', '풋워크'], pain: ['무릎'] }),
      rec({ date: day(-2), minutes: 90, games: [[21, 12]], weakness: ['드라이브'], pain: ['무릎'] }),
      rec({ date: day(-5), minutes: 30, games: [[17, 21]], weakness: ['드라이브', '헤어핀'], pain: [] }),
      rec({ date: day(-8), minutes: 45, games: [[21, 18]], weakness: ['헤어핀'], pain: ['어깨'] }),
      rec({ date: day(-10), minutes: 60, games: [[15, 21]], weakness: [], pain: [] })
    ];
  }

  function buildOf(records, mode) {
    return BM.report.build(records, { mode: mode || 'week', now: NOW, role: 'club', level: 'C조' });
  }

  /* =========================================================
   * 1. 기간 — 주간은 최근 7일 vs 직전 7일
   * ========================================================= */
  test('v1.41 주간: 기간은 최근 7일(11/15~11/21)과 직전 7일(11/8~11/14)', function () {
    var r = buildOf([]);
    eq(r.mode, 'week', '기간 종류');
    eq(r.from, '2026-11-15', '시작일');
    eq(r.to, '2026-11-21', '끝일');
    eq(r.prevFrom, '2026-11-08', '직전 시작일');
    eq(r.prevTo, '2026-11-14', '직전 끝일');
    eq(r.days, 7, '7일');
    includes(r.rangeText, '11월 15일', '기간 표기');
    includes(r.compareText, '11월 8일', '비교 기간 표기');
  });

  test('v1.41 월간: 이번 달 1일~오늘 · 지난달은 1일~말일', function () {
    var r = buildOf([], 'month');
    eq(r.mode, 'month', '기간 종류');
    eq(r.from, '2026-11-01', '이번 달 시작');
    eq(r.to, '2026-11-21', '오늘까지');
    eq(r.prevFrom, '2026-10-01', '지난달 시작');
    eq(r.prevTo, '2026-10-31', '지난달 끝');
    eq(r.days, 21, '이번 달 지난 날짜');
    includes(r.rangeText, '2026년 11월', '월 표기');
    includes(r.compareText, '지난달', '지난달 안내');
    eq(r.nextLabel, '다음 달', '다음 달');
  });

  test('v1.41 기간 밖 기록·날짜 없는 기록은 세지 않는다', function () {
    var rows = weekRecords().concat([
      rec({ date: day(-30), minutes: 300 }),
      { id: 'nodate', date: '', minutes: 100, weakness: ['스매시'] }
    ]);
    var r = buildOf(rows);
    eq(r.current.sessions, 3, '이번 주 3건');
    eq(r.prev.sessions, 2, '지난주 2건');
    eq(r.current.minutes, 180, '이번 주 분');
    eq(r.prev.minutes, 105, '지난주 분');
  });

  /* =========================================================
   * 2. 운동량 · 승률 (전체 + 접전 3점차)
   * ========================================================= */
  test('v1.41 승률: 이번 주 3승 2패 = 60%, 지난주 1승 1패 = 50%', function () {
    var r = buildOf(weekRecords());
    eq(r.current.games, 5, '이번 주 5경기');
    eq(r.current.wins, 3, '3승');
    eq(r.current.losses, 2, '2패');
    eq(r.current.rate, 60, '승률 60%');
    eq(r.prev.rate, 50, '지난주 50%');
    eq(r.rateDiff, 10, '지난주 대비 +10%p');
  });

  test('v1.41 접전: 3점차 이내만 세고(4경기 2승 2패), 4점차는 빼요', function () {
    var r = buildOf(weekRecords());
    /* 21:18(+3) 승 · 18:21(-3) 패 · 21:19(+2) 승 · 21:12(+9) · 17:21(-4) */
    eq(r.current.close.games, 3, '이번 주 접전 3경기');
    eq(r.current.close.wins, 2, '접전 2승');
    eq(r.current.close.losses, 1, '접전 1패');
    eq(r.current.close.rate, 67, '접전 승률 67%');
    /* 지난주: 21:18(+3) 승 1경기만 접전 · 15:21(-6) 아님 */
    eq(r.prev.close.games, 1, '지난주 접전 1경기');
    eq(r.closeDiff, -33, '지난주(100%) 대비 -33%p');
  });

  test('v1.41 승률 기록이 없으면 — · 첫 기간 안내', function () {
    var r = buildOf([rec({ date: day(0), games: [], weakness: ['드라이브'] })]);
    eq(r.current.rate, null, '승률 없음');
    eq(r.rateDiff, null, '비교 없음');
    includes(BM.report.bodyHtml(r), '첫 기간', '첫 기간 표시');
    includes(BM.report.bodyHtml(r), '경기 점수를 남기면 승률', '점수 안내');
  });

  test('v1.41 다중 게임: 한 일지의 여러 경기를 모두 센다', function () {
    var r = buildOf([rec({ date: day(0), games: [[21, 19], [21, 19], [15, 21]] })]);
    eq(r.current.games, 3, '3경기');
    eq(r.current.wins, 2, '2승');
    eq(r.current.losses, 1, '1패');
    eq(r.current.close.games, 2, '접전 2경기(3점차 초과 1경기 제외)');
  });

  test('v1.41 훈련·분 증감: 3회(+1) · 180분(+75)', function () {
    var r = buildOf(weekRecords());
    eq(r.volumeDiff, 1, '횟수 +1');
    eq(r.minutesDiff, 75, '분 +75');
    var html = BM.report.bodyHtml(r);
    includes(html, '+1회', '증가 표시');
    includes(html, '+75분', '분 증가');
  });

  /* =========================================================
   * 3. 약점 TOP 3
   * ========================================================= */
  test('v1.41 약점 TOP 3: 많은 순 · 비중 · 지난 기간 대비 증감', function () {
    var r = buildOf(weekRecords());
    eq(r.weaknesses.length, 3, '세 개');
    eq(r.weaknesses[0].name, '드라이브', '1위');
    eq(r.weaknesses[0].n, 3, '드라이브 3회');
    eq(r.weaknesses[0].prev, 0, '지난주 0회');
    eq(r.weaknesses[0].diff, 3, '+3회');
    eq(r.weaknesses[0].share, 60, '3/5 = 60%');
    eq(r.weaknesses[1].name, '헤어핀', '2위');
    eq(r.weaknesses[1].n, 1, '헤어핀 1회(이번 주 1)');
    eq(r.weaknesses[2].name, '풋워크', '3위');
    var html = BM.report.bodyHtml(r);
    includes(html, '가장 자주 뜬 약점', '제목');
    includes(html, 'TOP 3', 'TOP 3');
    includes(html, 'rpt__bar', '막대');
    includes(html, '지난주엔 없던 약점이에요', '새 약점 표기');
    includes(html, '지난주와 같아요', '같음 표기');
  });

  test('v1.41 약점 동률이면 사전 순서로 고정 (드라이브 → 헤어핀 → 드롭)', function () {
    var r = buildOf([
      rec({ date: day(0), weakness: ['드롭', '드라이브', '헤어핀'] }),
      rec({ date: day(-1), weakness: ['풋워크'] })
    ]);
    eq(r.weaknesses.length, 3, 'TOP 3만');
    eq(r.weaknesses[0].name, '드라이브', '사전 1번');
    eq(r.weaknesses[1].name, '헤어핀', '사전 2번');
    eq(r.weaknesses[2].name, '드롭', '사전 3번');
  });

  test('v1.41 약점이 없으면 자리 안내를 보여 준다', function () {
    var r = buildOf([rec({ date: day(0), weakness: [], games: [[21, 10]] })]);
    eq(r.weaknesses.length, 0, '없음');
    includes(BM.report.bodyHtml(r), '약점 기술을 한 칸 남기면', '안내');
  });

  /* =========================================================
   * 4. 통증 · 다음 방향
   * ========================================================= */
  test('v1.41 지난 기간에 일지가 없으면 약점 비교는 그렇다고 말한다', function () {
    var r = buildOf([rec({ date: day(0), weakness: ['드라이브'], games: [[21, 10]] })]);
    eq(r.prev.sessions, 0, '지난주 기록 없음');
    includes(BM.report.bodyHtml(r), '지난주 일지가 없어 비교하지 못했어요', '비교 불가 안내');
  });

  test('v1.41 통증: 부위별 횟수 · 2번 이상이면 반복으로 표시', function () {
    var r = buildOf(weekRecords());
    eq(r.pains[0].name, '무릎', '무릎 먼저');
    eq(r.pains[0].n, 2, '무릎 2번');
    eq(r.repeatedPains.length, 1, '반복은 무릎 하나');
    eq(r.repeatedPains[0].name, '무릎', '반복 부위');
    var html = BM.report.bodyHtml(r);
    includes(html, '무릎 <b>2번</b>', '칩 표시');
    includes(html, '주의', '주의 안내');
    includes(html, '2주 넘게 이어지면', '2주 안내');
  });

  test('v1.41 통증이 없으면 없었다고 한 줄', function () {
    var r = buildOf([rec({ date: day(0), games: [[21, 10]] })]);
    includes(BM.report.bodyHtml(r), '아픈 부위가 없었어요', '없음 안내');
    eq(r.repeatedPains.length, 0, '반복 없음');
  });

  test('v1.41 월간 통증 주의 문구는 한 달 기준', function () {
    var r = buildOf([
      rec({ date: '2026-11-02', pain: ['어깨'] }),
      rec({ date: '2026-11-09', pain: ['어깨'] })
    ], 'month');
    includes(BM.report.bodyHtml(r), '이번 달에 2번 나왔어요', '월간 문구');
    includes(BM.report.bodyHtml(r), '이렇게 반복되면', '월간 주의');
  });

  test('v1.41 다음 방향: 2~3줄 · 약점 드릴과 유형 맞춤 한 줄', function () {
    var r = buildOf(weekRecords());
    ok(r.direction.length >= 2 && r.direction.length <= 3, '2~3줄: ' + r.direction.length);
    includes(r.direction[0], '드라이브가 이번 주 3번', '1순위 약점');
    includes(r.direction[0], '드라이브 드릴', '드릴 안내');
    includes(r.direction.join(' '), '무릎', '통증 반영');
    includes(r.direction[2], '아픈 부위가 편해질 때까지는', '동호인 맞춤 — 통증이 있으면 드릴 대신 회복 안내(v1.72)');
  });

  test('v1.41 선수 유형이면 7대 훈련으로 방향을 잡는다', function () {
    var r = BM.report.build([rec({ date: day(0), weakness: ['풋워크'], games: [[21, 10]] })],
      { mode: 'week', now: NOW, role: 'player' });
    includes(r.direction[r.direction.length - 1], '7대 훈련', '선수 문구');
    includes(r.direction[r.direction.length - 1], '풋워크', '약점 항목');
  });

  test('v1.41 코치·초보 유형도 자기 자리 문구가 나온다', function () {
    var coach = BM.report.build([rec({ date: day(0), weakness: ['서브'], games: [[21, 10]] })], { mode: 'week', now: NOW, role: 'coach' });
    includes(coach.direction.join(' '), '피드백', '코치');
    var beg = BM.report.build([rec({ date: day(0), weakness: ['서브'], games: [[21, 10]] })], { mode: 'week', now: NOW, role: 'beginner' });
    includes(beg.direction.join(' '), '4주 루틴', '초보');
  });

  /* =========================================================
   * 5. 화면 · 빈 상태 · XSS
   * ========================================================= */
  test('v1.41 빈 상태: 기록 0건이면 일지 1건 안내와 일지 쓰러 가기', function () {
    var r = buildOf([]);
    eq(r.empty, true, '비어 있음');
    eq(r.direction.length, 0, '방향 없음');
    var html = BM.report.bodyHtml(r);
    includes(html, '일지를 1건 이상 남기면 리포트가 채워져요', '빈 상태 문구');
    includes(html, 'data-rpt-go-log', '일지 이동 버튼');
    includes(html, 'data-rpt-empty', '빈 상태 표시');
  });

  test('v1.41 빈 상태: 지난 기간 기록이 있으면 그 숫자를 알려 준다', function () {
    var r = buildOf([rec({ date: day(-9), games: [[21, 10]] })]);
    eq(r.empty, true, '이번 주 없음');
    includes(BM.report.bodyHtml(r), '지난주에는 일지 1건', '지난 기간 안내');
  });

  test('v1.41 리포트 화면: 네 칸(운동량·약점·통증·다음 방향)과 주간/월간 탭', function () {
    var html = BM.report.bodyHtml(buildOf(weekRecords()));
    includes(html, 'data-rpt-sec="volume"', '운동량');
    includes(html, 'data-rpt-sec="weak"', '약점');
    includes(html, 'data-rpt-sec="pain"', '통증');
    includes(html, 'data-rpt-sec="next"', '다음 방향');
    includes(html, '다음 주에 이렇게', '주간 제목');
    var month = BM.report.bodyHtml(buildOf(weekRecords(), 'month'));
    includes(month, '다음 달에 이렇게', '월간 제목');
    var shell = BM.report.shellHtml();
    includes(shell, 'data-rpt-tab="week"', '주간 탭');
    includes(shell, 'data-rpt-tab="month"', '월간 탭');
    includes(shell, '📊 주간·월간 상세 리포트', '패널 제목');
  });

  test('v1.41 XSS: 약점·통증 이름이 그대로 실행되지 않는다', function () {
    var payload = '"><img src=x onerror=alert(1)>';
    var html = BM.report.bodyHtml(buildOf([
      rec({ date: day(0), weakness: [payload], pain: [payload], games: [[21, 10]] })
    ]));
    excludes(html, '<img src=x', '이미지 태그');
    excludes(html, '<script', '스크립트 태그');
    ok(html.indexOf('&lt;img src=x') >= 0, '글자로만 남는다');
  });

  test('v1.41 브라우저가 없는 곳(node)에서 open은 조용히 아무 것도 하지 않는다', function () {
    var got = BM.report.open({ records: [], role: 'club' });
    eq(got, null, 'DOM 없음');
    eq(BM.report.isOpen(), false, '열리지 않음');
  });

  test('v1.41 입구 문구는 요청 그대로 — 📊 주간·월간 상세 리포트 보기', function () {
    var html = BM.report.entryHtml();
    includes(html, '📊 주간·월간 상세 리포트 보기', '입구 문구');
    includes(html, 'data-act="open-report"', '동작');
    includes(html, 'aria-haspopup="dialog"', '접근성');
  });

  /* =========================================================
   * 6. 화면 배치 · 기존 기능 회귀
   * ========================================================= */
  function stateOf(records) {
    var me = { key: 'u_me', nick: '나래', level: 'C조', theme: { theme: 'th_def', role: 'club' } };
    var data = BM.store.derive([], me.key);
    data.records = records || [];
    data.stats = { count: 3, minutesMonth: 180, winRate: 60, streak: 2, sessions14: 3, avgCond: 6 };
    return {
      ready: true, mode: 'local', me: me, idx: data.idx, rows: [], data: data,
      drafts: { log: { date: NOW, cond: 6, intensity: 6, minutes: 60, done: [], pain: [], weakness: [], note: '', pro: {} } },
      ui: { tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' }, composer: '', replyTo: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  test('v1.41 일지 & AI: AI 카드 아래에 리포트 입구가 있고 하단 고정 저장 바는 그대로', function () {
    var html = BM.views.log.render(stateOf(weekRecords()));
    includes(html, 'data-act="open-report"', '리포트 입구');
    includes(html, 'submit-wrap savebar', '하단 고정 저장 바');
    includes(html, '저장하고 AI 분석', '저장 버튼');
    includes(html, '오늘 일지', '일지 카드');
  });

  test('v1.41 MY: 통계 카드 아래에 리포트 입구가 있다', function () {
    var html = BM.views.my.render(stateOf(weekRecords()));
    includes(html, 'data-act="open-report"', '리포트 입구');
    includes(html, '내 유형', '기존 유형 카드 유지');
    includes(html, '프로필 꾸미기', '기존 꾸미기 유지');
  });

  test('v1.41 유지: 4유형 · 게스트 모집 · 친구 코드 같은 기존 기능은 그대로', function () {
    eq(D.ROLES.length, 4, '4유형');
    eq(D.VOCAB.weakness.length, 9, '약점 9종(수비 포함, bm-v1.74.0)');
    eq(D.VOCAB.pain.length, 8, '통증 8종');
    var comm = readRoot('js/views/community.js');
    includes(comm, '게스트 모집', '게스트 모집 말머리');
    var friends = readRoot('js/views/friends.js');
    includes(friends, 'codeChip', '친구 코드');
  });

  /* =========================================================
   * 7. 버전 · 배포
   * ========================================================= */
  test('v1.41 버전: sw.js · app.js · twa-manifest.json이 1.41.1으로 맞는다', function () {
    var sw = readRoot('sw.js'), app = readRoot('app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.90.0'", 'sw.js');
    includes(app, "version: 'v1.90.0'", 'app.js');
    eq(twa.appVersionName, '1.90.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.90.0', 'TWA appVersion');
    eq(twa.appVersionCode, 84, '코드 38 유지');
  });

  test('v1.41 로드: index.html · sw.js 캐시에 js/report.js가 들어 있다', function () {
    var index = readRoot('index.html'), sw = readRoot('sw.js');
    includes(index, 'js/report.js', 'index.html');
    includes(sw, "./js/report.js", 'sw.js SHELL');
    ok(index.indexOf('js/report.js') < index.indexOf('app.js'), 'app.js보다 먼저');
    includes(index, 'styles.css?v=20261127-4', '스타일 캐시');
    var css = readRoot('styles.css');
    includes(css, '.rptbtn', '입구 스타일');
    includes(css, '.rpt__bar', '막대 스타일');
  });

  test('v1.41 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    var readme = readRoot('README.md'), ideas = readRoot('ideas.md');
    includes(readme, 'v1.43.0', 'README 버전 절');
    includes(readme, '주간·월간 상세 리포트', 'README 기능');
    includes(ideas, 'v1.43.0', '아이디어 노트');
  });

  test('v1.41 비밀값: 공개 저장소에 시트 ID·비밀키를 새로 넣지 않는다', function () {
    var js = readRoot('js/report.js');
    excludes(js, '1sqxAM6eskBYS03s', '시트 ID');
    excludes(js, 'supabase.co', 'Supabase 주소');
    excludes(js, 'service_role', '비밀키');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
