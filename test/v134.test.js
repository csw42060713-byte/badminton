/* ============================================================
 * test/v134.test.js — bm-v1.37.2
 *   고도화 6차 사이클: 연속 배지 · 파트너 프로필 연결 · 코치 요청에 영상 동봉.
 *
 *   1) MY 4주 연속 약점 챌린지 달성 배지
 *      · D.challengeStreak(records, opts) 순수 함수 — 주마다 goal(3회)을 채운 주가 몇 주 연속인지
 *      · 이번 주가 아직 진행 중(미달)이면 연속을 끊지 않고 지난주까지 셈
 *      · 일지가 없던 주는 달성으로 세지 않음 · 같은 날 두 번은 1회
 *      · MY 상단 프로필 카드 요약 아래 작은 배지 (0주면 조용히 숨김)
 *
 *   2) 복식 파트너 → 프로필·채팅 바로 연결
 *      · D.memberByName(idx, name, {meKey}) — 닉네임이 정확히 같은 회원이 한 명일 때만 키
 *      · 같은 닉네임이 둘이면 잇지 않음 · 나 자신 제외 · 프로필·매칭프로필 모두
 *      · 일지 & AI 파트너별 승률 줄의 이름이 버튼(data-partner)으로 → 프로필 시트
 *
 *   3) 코치 피드백 요청에 최근 일지 영상 링크 동봉
 *      · feedbackAskText(state, {video}) — 영상 주소 + 한 줄 체크 포인트
 *      · 영상이 없으면 예전처럼 바로 대화 열기(단계 안 늘림)
 *      · 영상이 있으면 체크 한 번(선택 해제 가능) 뒤 대화 열기
 *      · 채팅 말풍선의 http(s) 주소는 눌러서 새 창(D.linkify)
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

  var ME = 'u_v134_me';
  var NOW = '2026-11-21';             /* 토요일 — 이번 주는 11/16(월)~11/22(일) */
  var VIDEO = 'https://www.youtube.com/watch?v=v134abc';

  function rec(date, weakness, extra) {
    var r = {
      id: 'r_' + date + '_' + ((extra && extra.tag) || 'a'),
      type: '기록', date: date, userKey: ME,
      cond: 6, intensity: 3, minutes: 60,
      games: [], weakness: weakness ? [weakness] : [], done: [], team: ''
    };
    Object.keys(extra || {}).forEach(function (k) { if (k !== 'tag') r[k] = extra[k]; });
    return r;
  }

  /* 4주 연속(이번 주 포함) — 매주 같은 약점을 3일씩 */
  function fourWeeks() {
    var days = [
      '2026-11-16', '2026-11-17', '2026-11-18',      /* 이번 주 */
      '2026-11-09', '2026-11-10', '2026-11-11',      /* 지난 주 */
      '2026-11-02', '2026-11-03', '2026-11-04',
      '2026-10-26', '2026-10-27', '2026-10-28'
    ];
    return days.map(function (d) { return rec(d, '헤어핀', { tag: d }); });
  }

  function idxOf(rows) {
    var idx = { all: rows.slice(), byType: {}, byId: {} };
    rows.forEach(function (r) { (idx.byType[r.type] = idx.byType[r.type] || []).push(r); idx.byId[r.id] = r; });
    return idx;
  }

  /* 화면용 상태 — 실제 앱 state 모양 */
  function stateOf(records, patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: records || [], allRecords: records || [], posts: [], threads: [], matchProfiles: [],
        feedback: [], requests: [], rooms: [], mentorApps: [], coachApps: [],
        hearts: { balance: 3, earned: 0, spent: 0, todayEarned: 0, adUsedToday: 0, adLimit: 5, checkedInToday: false, checkinReward: 1, adCooldownSec: 30, matchCost: 2, giftCost: 5, history: [] },
        idx: idxOf([]),
        stats: { streak: 0, sessions14: 2, winRate: 60, minutesMonth: 120, avgCond: 6 },
        unread: 0, guests: []
      },
      drafts: {
        log: {
          date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [],
          games: [{ a: '', b: '' }], pain: [], note: '', partner: '', video: '', videoNote: ''
        }
      },
      ui: { tab: 'log', challengeNow: NOW, matchFilter: { level: '전체', region: '전체', discipline: '전체' }, coachTab: 'feedback' },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      routine: {}, routinePref: false
    };
    if (patch) {
      var baseData = st.data, baseUi = st.ui;
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.data) st.data = Object.assign({}, baseData, patch.data);
      if (patch.ui) st.ui = Object.assign({}, baseUi, patch.ui);
      if (patch.drafts && patch.drafts.log) st.drafts = { log: Object.assign({}, st.drafts.log, patch.drafts.log) };
    }
    return st;
  }

  function html(out, label) {
    ok(out && out.length > 20, label + ': 화면이 비어 있습니다');
    excludes(out, 'undefined', label + ': undefined가 출력됨');
    excludes(out, 'NaN', label + ': NaN이 출력됨');
    return out;
  }

  /* =========================================================
   * 1. 연속 주간 챌린지 달성 (D.challengeStreak)
   * ========================================================= */

  test('v1.34 연속: 4주 연속 달성이면 weeks=4', function () {
    ok(typeof D.challengeStreak === 'function', 'D.challengeStreak 함수');
    var st = D.challengeStreak(fourWeeks(), { now: NOW });
    eq(st.weeks, 4, '4주 연속');
    eq(st.goal, 3, '목표 3회');
    eq(st.inProgress, false, '이번 주는 이미 채움');
    eq(st.current.count, 3, '이번 주 3회');
    eq(st.current.weekStart, '2026-11-16', '이번 주 월요일');
    eq(st.current.weekEnd, '2026-11-22', '이번 주 일요일');
    eq(st.best, 4, '최고 연속');
  });

  test('v1.34 연속: 한 주를 비우면 그 앞에서 끊긴다', function () {
    var list = fourWeeks().filter(function (r) {
      return r.date !== '2026-11-09' && r.date !== '2026-11-10' && r.date !== '2026-11-11';
    });
    var st = D.challengeStreak(list, { now: NOW });
    eq(st.weeks, 1, '이번 주까지 1주');
    eq(st.list[1].done, false, '지난 주는 미달');
  });

  test('v1.34 연속: 이번 주가 진행 중이면 지난주까지 세고 끊지 않는다', function () {
    var list = fourWeeks().filter(function (r) {
      return r.date !== '2026-11-17' && r.date !== '2026-11-18';   /* 이번 주는 1회만 */
    });
    var st = D.challengeStreak(list, { now: NOW });
    eq(st.inProgress, true, '이번 주는 아직 채우는 중');
    eq(st.current.count, 1, '이번 주 1/3');
    eq(st.weeks, 3, '지난주까지 3주 연속');
  });

  test('v1.34 연속: 주마다 약점이 달라도 그 주 기준으로 센다', function () {
    var list = [
      rec('2026-11-16', '헤어핀', { tag: 'a' }), rec('2026-11-17', '헤어핀', { tag: 'b' }), rec('2026-11-18', '헤어핀', { tag: 'c' }),
      rec('2026-11-09', '드라이브', { tag: 'a' }), rec('2026-11-10', '드라이브', { tag: 'b' }), rec('2026-11-11', '드라이브', { tag: 'c' })
    ];
    var st = D.challengeStreak(list, { now: NOW });
    eq(st.weeks, 2, '2주 연속');
    eq(st.list[0].weakness, '헤어핀', '이번 주 약점');
    eq(st.list[1].weakness, '드라이브', '지난 주 약점');
  });

  test('v1.34 연속: 같은 날 일지를 두 번 남겨도 1회', function () {
    var list = [
      rec('2026-11-16', '헤어핀', { tag: 'a' }), rec('2026-11-16', '헤어핀', { tag: 'b' }),
      rec('2026-11-17', '헤어핀', { tag: 'c' })
    ];
    var st = D.challengeStreak(list, { now: NOW });
    eq(st.current.count, 2, '이틀 = 2회');
    eq(st.weeks, 0, '아직 달성 아님');
  });

  test('v1.34 연속: 완료훈련에 찍힌 약점도 그 주에 센다', function () {
    var list = [
      rec('2026-11-16', '', { tag: 'a', done: ['헤어핀'] }),
      rec('2026-11-17', '', { tag: 'b', done: ['헤어핀'] }),
      rec('2026-11-18', '헤어핀', { tag: 'c' })
    ];
    var st = D.challengeStreak(list, { now: NOW });
    eq(st.current.count, 3, '3회 (완료훈련 포함)');
    eq(st.weeks, 1, '이번 주 1주');
  });

  test('v1.34 연속: 일지가 없으면 0주 · 조용히', function () {
    var st = D.challengeStreak([], { now: NOW });
    eq(st.weeks, 0, '기록 없음');
    eq(st.inProgress, true, '진행 중 상태');
    eq(st.current.reason, 'no_records', '이유');
    eq(D.challengeStreak(null, { now: NOW }).weeks, 0, 'null도 조용히');
  });

  test('v1.34 연속: 목표·기간을 바꿀 수 있다 (opts.goal · opts.weeks)', function () {
    var list = [rec('2026-11-16', '헤어핀', { tag: 'a' }), rec('2026-11-17', '헤어핀', { tag: 'b' })];
    eq(D.challengeStreak(list, { now: NOW, goal: 2 }).weeks, 1, '목표 2회면 이번 주 달성');
    eq(D.challengeStreak(fourWeeks(), { now: NOW, weeks: 2 }).list.length, 2, '2주만 본다');
    eq(D.challengeStreak(fourWeeks(), { now: NOW, weeks: 2 }).weeks, 2, '2주 중 2주');
  });

  test('v1.34 연속: 순수 함수 — 같은 입력이면 같은 결과, 입력을 건드리지 않는다', function () {
    var list = fourWeeks();
    var before = JSON.stringify(list);
    var a = D.challengeStreak(list, { now: NOW });
    var b = D.challengeStreak(list, { now: NOW });
    eq(JSON.stringify(a), JSON.stringify(b), '같은 결과');
    eq(JSON.stringify(list), before, '입력 그대로');
    eq(a.list.length, D.STREAK_WEEKS, '기본 8주까지 본다');
  });

  /* =========================================================
   * 2. MY 배지
   * ========================================================= */

  test('v1.34 MY: 4주 연속이면 배지가 보인다', function () {
    var out = html(BM.views.my.render(stateOf(fourWeeks())), 'MY');
    includes(out, 'class="mystreak"', '배지 클래스');
    includes(out, '4주 연속 챌린지 달성', '문구');
    includes(out, '🔥', '불꽃');
    includes(out, 'data-streak="4"', '주 수');
  });

  test('v1.34 MY: 1주면 "이번 주 챌린지 달성"', function () {
    var list = fourWeeks().filter(function (r) { return r.date >= '2026-11-16'; });
    var out = html(BM.views.my.render(stateOf(list)), 'MY 1주');
    includes(out, 'mystreak', '배지');
    includes(out, '이번 주 챌린지 달성', '1주 문구');
    excludes(out, '1주 연속', '어색한 1주 연속 없음');
  });

  test('v1.34 MY: 0주면 배지를 숨긴다 (카드가 길어지지 않게)', function () {
    var out = html(BM.views.my.render(stateOf([rec('2026-11-16', '헤어핀', { tag: 'a' })])), 'MY 0주');
    excludes(out, 'mystreak', '배지 없음');
    includes(out, 'card--profile', '프로필 카드는 그대로');
    includes(out, '프로필 꾸미기', '기존 버튼 그대로');
  });

  /* =========================================================
   * 3. 파트너 이름 → 프로필
   * ========================================================= */

  test('v1.34 파트너: 닉네임이 정확히 같은 회원 한 명이면 그 키', function () {
    var idx = idxOf([
      { id: 'p1', type: '프로필', userKey: 'u_a', nick: '민호', createdAt: '2026-11-10 10:00:00' },
      { id: 'p2', type: '프로필', userKey: 'u_b', nick: '나래', createdAt: '2026-11-10 10:00:00' }
    ]);
    eq(D.memberByName(idx, '민호'), 'u_a', '회원 키');
    eq(D.memberByName(idx, ' 민호 '), 'u_a', '공백은 정리');
    eq(D.memberByName(idx, '없는사람'), '', '회원 아님');
    eq(D.memberByName(idx, ''), '', '빈 이름');
    eq(D.memberByName(idx, null), '', 'null');
  });

  test('v1.34 파트너: 같은 닉네임이 둘이면 잇지 않는다 (엉뚱한 사람 방지)', function () {
    var idx = idxOf([
      { id: 'p1', type: '프로필', userKey: 'u_a', nick: '민호', createdAt: '2026-11-10 10:00:00' },
      { id: 'p2', type: '프로필', userKey: 'u_c', nick: '민호', createdAt: '2026-11-11 10:00:00' }
    ]);
    eq(D.memberByName(idx, '민호'), '', '둘이면 연결 안 함');
    eq(D.memberByName(idx, '민호', { meKey: 'u_a' }), 'u_c', '나를 빼면 남은 한 명');
  });

  test('v1.34 파트너: 나 자신은 제외 · 최신 닉네임 · 매칭프로필도 본다', function () {
    var idx = idxOf([
      { id: 'p1', type: '프로필', userKey: 'u_d', nick: '옛이름', createdAt: '2026-11-01 10:00:00' },
      { id: 'p2', type: '프로필', userKey: 'u_d', nick: '새이름', createdAt: '2026-11-12 10:00:00' },
      { id: 'm1', type: '매칭프로필', userKey: 'u_e', nick: '콕집사', createdAt: '2026-11-05 10:00:00' }
    ]);
    eq(D.memberByName(idx, '새이름'), 'u_d', '최신 닉네임');
    eq(D.memberByName(idx, '옛이름'), '', '지난 닉네임은 안 됨');
    eq(D.memberByName(idx, '콕집사'), 'u_e', '매칭프로필 닉네임');
    eq(D.memberByName(idx, '새이름', { meKey: 'u_d' }), '', '나 자신 제외');
  });

  test('v1.34 파트너: 승률 줄의 이름이 프로필 버튼으로 바뀐다', function () {
    var records = [
      rec('2026-11-19', '', { tag: 'a', team: JSON.stringify({ partner: '민호' }), games: [{ a: 21, b: 18 }] }),
      rec('2026-11-18', '', { tag: 'b', team: JSON.stringify({ partner: '모르는선수' }), games: [{ a: 21, b: 18 }] })
    ];
    var idx = idxOf([{ id: 'p1', type: '프로필', userKey: 'u_a', nick: '민호', createdAt: '2026-11-10 10:00:00' }]);
    var out = html(BM.views.log.render(stateOf(records, { data: { idx: idx } })), '일지');
    includes(out, 'data-partner="u_a"', '프로필 버튼');
    includes(out, 'aria-label="민호 프로필 열기"', '누를 수 있다는 안내');
    includes(out, 'class="ptn__link"', '누를 수 있는 이름');
    includes(out, '모르는선수', '회원 아닌 이름도 그대로 보인다');
    includes(out, '이름을 누르면 프로필', '한 줄 안내');
  });

  test('v1.34 파트너: 회원이 아니면 예전처럼 글자 (버튼 없음)', function () {
    var records = [rec('2026-11-19', '', { tag: 'a', team: JSON.stringify({ partner: '모르는선수' }), games: [{ a: 21, b: 18 }] })];
    var out = html(BM.views.log.render(stateOf(records)), '일지');
    includes(out, '모르는선수', '이름은 그대로');
    excludes(out, 'data-partner="', '프로필 버튼 없음');
    excludes(out, 'ptn__link', '링크 스타일 없음');
  });

  test('v1.34 파트너: 일지 화면이 프로필 시트를 연다', function () {
    var src = readRoot('js/views/log.js');
    includes(src, "ev.target.closest('[data-partner]')", '클릭 연결');
    includes(src, 'BM.views.profile.open', '프로필 시트');
    includes(readRoot('js/views/profile.js'), 'data-friend-add', '친구 추가 버튼');
    includes(readRoot('js/views/profile.js'), 'data-friend-chat', '채팅하기 버튼');
  });

  /* =========================================================
   * 4. 코치 피드백 요청 + 영상 동봉
   * ========================================================= */

  test('v1.34 코치: 최근 일지 영상 주소와 체크 포인트가 요청 문구에 붙는다', function () {
    var r = rec('2026-11-20', '스매시', { tag: 'a', team: JSON.stringify({ video: { url: VIDEO, label: '스매시 손목 각도' } }) });
    var text = BM.views.coach.feedbackAskText(stateOf([r]));
    includes(text, '코치님,', '인사');
    includes(text, '약점 스매시', '일지 요약');
    includes(text, VIDEO, '영상 주소');
    includes(text, '체크 포인트: 스매시 손목 각도', '체크 포인트');
    excludes(text, '<', 'HTML 없음(그대로 글자)');
  });

  test('v1.34 코치: 선택을 풀면 영상 없이 일지 요약만 (opts.video=false)', function () {
    var r = rec('2026-11-20', '스매시', { tag: 'a', team: JSON.stringify({ video: { url: VIDEO, label: '스매시 손목' } }) });
    var text = BM.views.coach.feedbackAskText(stateOf([r]), { video: false });
    excludes(text, VIDEO, '영상 주소 없음');
    excludes(text, '체크 포인트', '체크 포인트 없음');
    includes(text, '코치님,', '요약은 그대로');
  });

  test('v1.34 코치: 영상이 없는 일지는 예전 문구 그대로', function () {
    var text = BM.views.coach.feedbackAskText(stateOf([rec('2026-11-20', '스매시', { tag: 'a' })]));
    excludes(text, '영상', '영상 문구 없음');
    includes(text, '코치님,', '인사');
    includes(text, '한 줄 피드백 부탁드려요', '요청');
    eq(BM.views.coach.feedbackAskText(stateOf([])), '코치님, 일지 피드백 부탁드려요. 이번 주 훈련에서 먼저 볼 점을 알려 주세요.', '일지가 없을 때 문구');
  });

  test('v1.34 코치: 영상이 없으면 확인 단계 없이 바로 대화를 연다', function () {
    var called = null;
    var ctx = {
      store: { state: stateOf([rec('2026-11-20', '스매시', { tag: 'a' })]) },
      actions: { openCoachChat: function (key, text) { called = { key: key, text: text }; return { ok: true }; } }
    };
    BM.views.coach.askFeedback('u_coach', ctx);
    ok(called, '대화 열기 호출');
    eq(called.key, 'u_coach', '코치 키');
    includes(called.text, '한 줄 피드백 부탁드려요', '요청 문구');
    excludes(called.text, '영상', '영상 없음');
  });

  test('v1.34 코치: 영상이 있으면 함께 보낼지 고르는 시트 (선택 해제)', function () {
    var src = readRoot('js/views/coach.js');
    includes(src, 'data-video-include', '체크 상자');
    includes(src, 'data-ask-preview', '보낼 메시지 미리보기');
    includes(src, '함께 보내기', '안내 문구');
    includes(src, "ev.target.closest('[data-coach-ask]')", '요청 버튼 연결');
    includes(src, 'askFeedback(', '시트로 이어짐');
  });

  test('v1.34 코치: 선수 최근 기록 줄에서도 영상을 바로 연다', function () {
    var other = rec('2026-11-20', '드라이브', {
      tag: 'a', userKey: 'u_player', nick: '선수',
      team: JSON.stringify({ video: { url: VIDEO, label: '폼 체크' } })
    });
    var out = html(BM.views.coach.render(stateOf([other], { data: { isAdmin: true }, ui: { coachPlayer: 'u_player' } })), '코치');
    includes(out, '영상 보기', '영상 버튼');
    includes(out, VIDEO, '주소');
    includes(out, 'rel="noopener noreferrer"', '새 창 보안');
    includes(out, 'target="_blank"', '새 창');
  });

  test('v1.34 코치: 영상 체크 포인트의 꺾쇠는 글자로만 나온다 (이스케이프)', function () {
    var bad = '"><img src=x onerror=alert(1)><script>alert(2)</script>';
    var other = rec('2026-11-20', '드라이브', {
      tag: 'a', userKey: 'u_player', nick: '선수',
      team: JSON.stringify({ video: { url: VIDEO, label: bad } })
    });
    var out = html(BM.views.coach.render(stateOf([other], { data: { isAdmin: true } })), '코치 XSS');
    excludes(out, '<img src=x', '태그로 열리지 않음');
    excludes(out, '<script', '스크립트 없음');
  });

  /* =========================================================
   * 5. 채팅 말풍선 링크 (D.linkify)
   * ========================================================= */

  test('v1.34 링크: http(s) 주소만 새 창 링크로', function () {
    ok(typeof D.linkify === 'function', 'D.linkify 함수');
    var out = D.linkify('영상 ' + VIDEO + ' 봐 주세요');
    includes(out, '<a class="dlink" href="' + VIDEO + '"', '링크');
    includes(out, 'target="_blank"', '새 창');
    includes(out, 'rel="noopener noreferrer"', '보안');
    includes(out, '봐 주세요', '앞뒤 글자 그대로');
  });

  test('v1.34 링크: javascript:·data: 주소는 링크가 되지 않는다', function () {
    var out = D.linkify('javascript:alert(1) 그리고 data:text/html,<script>alert(2)</script>');
    excludes(out, '<a', '링크 없음');
    includes(out, 'javascript:alert(1)', '글자로는 남는다');
    excludes(out, '<script>alert(2)', '스크립트 이스케이프');
  });

  test('v1.34 링크: 문장 끝 마침표는 주소에서 뺀다 · 줄바꿈은 <br>', function () {
    var out = D.linkify('주소는 https://youtu.be/abc123. 다음 줄\n둘째 줄');
    includes(out, 'href="https://youtu.be/abc123"', '마침표 제외');
    includes(out, '</a>.', '마침표는 글자로');
    includes(out, '<br>', '줄바꿈');
  });

  test('v1.34 링크: 채팅 말풍선이 이 함수를 쓴다', function () {
    var src = readRoot('js/views/chat.js');
    includes(src, 'D.linkify(m.text)', '말풍선');
    excludes(src, 'U.esc(m.text).replace(/\\n/g', '예전 이스케이프만 있던 자리는 없음');
  });

  /* =========================================================
   * 6. 스타일 · 버전 · 회귀 · 보안
   * ========================================================= */

  test('v1.34 스타일: 배지·파트너 링크·영상 시트·말풍선 링크 클래스가 있다', function () {
    var css = readRoot('styles.css');
    includes(css, '.mystreak', '배지');
    includes(css, '.mystreak b', '배지 굵기');
    includes(css, '.ptn__link', '파트너 링크');
    includes(css, '.dbubble .dlink', '말풍선 링크');
    includes(css, '.fbask__toggle', '체크 줄');
    includes(css, '.fbask__msg', '미리보기');
    includes(css, 'overflow-wrap: anywhere', '긴 주소 줄바꿈');
  });

  test('v1.34 버전: sw.js·app.js·index.html·twa-manifest가 모두 v1.34', function () {
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.104.0'", 'sw.js');
    includes(app, "version: 'v1.104.0'", 'app.js');
    includes(index, 'styles.css?v=20261128-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.104.0', 'twa appVersionName');
    eq(twa.appVersion, '1.104.0', 'twa appVersion');
    eq(twa.appVersionCode, 98, 'twa appVersionCode');
    includes(app, "version: 'v1.104.0'", '화면 아래 버전');
  });

  test('v1.34 캐시: 새 파일 없이 기존 목록 그대로 (도메인·화면 코드만 갱신)', function () {
    var sw = readRoot('sw.js'), index = readRoot('index.html');
    includes(sw, "'./js/domain.js'", 'domain.js 캐시');
    includes(sw, "'./js/views/log.js'", 'log.js 캐시');
    includes(index, 'js/domain.js', 'domain.js 로드');
    includes(sw, "'./styles.css'", '스타일 캐시');
  });

  test('v1.34 회귀: 기존 화면 기능은 그대로 있다', function () {
    var log = readRoot('js/views/log.js'), co = readRoot('js/views/coach.js'), my = readRoot('js/views/my.js');
    includes(log, 'data-act="save-log"', '일지 저장');
    includes(log, 'card--wkch', '주간 챌린지 카드');
    includes(log, 'partnerBlock', '파트너 승률');
    includes(co, 'data-act="send-fb"', '코치 피드백 보내기');
    includes(co, 'data-coach-chat', '코치 1:1 채팅');
    includes(my, 'data-act="decorate-sheet"', '프로필 꾸미기');
    includes(my, 'data-theme="', '테마 고르기');
    includes(readRoot('js/views/chat.js'), 'data-dm-form', '채팅 입력');
    includes(readRoot('js/domain.js'), 'function weekChallenge', '주간 챌린지 계산');
    includes(readRoot('js/domain.js'), 'function partnerStats', '파트너 승률 계산');
  });

  test('v1.34 보안: 이번 사이클 코드에 시트 ID·키·바깥 주소가 없다', function () {
    ['js/domain.js', 'js/views/my.js', 'js/views/log.js', 'js/views/coach.js', 'js/views/chat.js'].forEach(function (f) {
      var src = readRoot(f);
      excludes(src, '1sqxAM6eskBYS03s', f + ': 시트 ID 없음');
      excludes(src, 'eyJ', f + ': 토큰 없음');
      excludes(src, 'supabase.co', f + ': 서버 주소 없음');
    });
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
