/* ============================================================
 * test/v135.test.js — bm-v1.37.2
 *   고도화 7차 사이클: 타 앱 벤치마킹 UX·디자인 정비.
 *
 *   1) 일지 '복식 파트너' 최근 파트너 원탭 칩
 *      · BM.views.log.recentPartners(state, limit) — 자주·최근 순 최대 4개
 *      · 모자라면 친구 닉네임으로 · 나·빈 이름·중복 제외 · 점수 없는 일지도 셈
 *      · 입력칸 아래 칩 줄(data-ptnchips) · 지금 적힌 이름은 켜진 모양(aria-pressed)
 *      · 한 번 누르면 입력, 같은 칩을 다시 누르면 지움
 *
 *   2) 일지 & AI 첫 화면 밀도
 *      · 초보자 루틴 선택 카드: 지표 상자 3개 → 한 줄 메타, 버튼 두 개 → 한 줄 두 칸
 *      · 카드 사이 12px (기능·순서는 그대로)
 *
 *   3) 5개 탭 공통 정비
 *      · 한국어 단어 경계 줄바꿈(keep-all) · 상단 버튼 터치 영역
 *      · 커뮤니티 작성 카드의 '분류' 이름표 (목록 거르기 칩과 구분)
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

  var ME = 'u_v135_me';
  var NOW = '2026-11-21';

  function rec(date, partner, extra) {
    var r = {
      id: 'r_' + date + '_' + ((extra && extra.tag) || 'a'),
      type: '기록', date: date, userKey: ME,
      cond: 6, intensity: 3, minutes: 60,
      games: [], weakness: [], done: [], team: ''
    };
    if (partner) r.team = JSON.stringify({ partner: partner });
    Object.keys(extra || {}).forEach(function (k) { if (k !== 'tag') r[k] = extra[k]; });
    return r;
  }

  function stateOf(records, patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: records || [], allRecords: records || [], posts: [], threads: [], matchProfiles: [],
        feedback: [], requests: [], rooms: [], mentorApps: [], coachApps: [], friends: [],
        hearts: { balance: 3, earned: 0, spent: 0, todayEarned: 0, adUsedToday: 0, adLimit: 5, checkedInToday: false, checkinReward: 1, adCooldownSec: 30, matchCost: 2, giftCost: 5, history: [] },
        idx: { all: [], byType: {}, byId: {} },
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
      routine: {}, routinePref: null
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

  function names(state, limit) { return BM.views.log.recentPartners(state, limit); }

  /* =========================================================
   * 1. 최근 파트너 후보 (자주·최근 순)
   * ========================================================= */

  test('v1.35 파트너 후보: 함수가 있고 기본 4개까지', function () {
    ok(typeof BM.views.log.recentPartners === 'function', 'recentPartners 함수');
    var list = [
      rec('2026-11-20', '민호'), rec('2026-11-19', '민수'), rec('2026-11-18', '지훈'),
      rec('2026-11-17', '태양'), rec('2026-11-16', '서준')
    ];
    eq(names(stateOf(list)).length, 4, '최대 4개');
    eq(names(stateOf(list), 2).length, 2, 'opts.limit');
  });

  test('v1.35 파트너 후보: 자주 친 이름이 먼저', function () {
    var list = [
      rec('2026-11-20', '민수', { tag: 'a' }), rec('2026-11-20', '민호', { tag: 'b' }),
      rec('2026-11-19', '민호', { tag: 'c' }), rec('2026-11-18', '민호', { tag: 'd' })
    ];
    eq(names(stateOf(list))[0], '민호', '3번이 1번보다 앞');
    eq(names(stateOf(list))[1], '민수', '그다음');
  });

  test('v1.35 파트너 후보: 횟수가 같으면 최근 날짜가 먼저', function () {
    var list = [
      rec('2026-11-10', '옛파트너', { tag: 'a' }),
      rec('2026-11-20', '새파트너', { tag: 'b' })
    ];
    eq(names(stateOf(list)).join(','), '새파트너,옛파트너', '최근이 앞');
  });

  test('v1.35 파트너 후보: 모자라면 친구 닉네임으로 채운다', function () {
    var friends = [{ key: 'u_a', nick: '민호' }, { key: 'u_b', nick: '콕집사' }];
    var out = names(stateOf([rec('2026-11-20', '민수')], { data: { friends: friends } }));
    eq(out.join(','), '민수,민호,콕집사', '기록 다음에 친구');
  });

  test('v1.35 파트너 후보: 이미 있는 이름·중복 친구는 한 번만', function () {
    var friends = [{ key: 'u_a', nick: '민호' }, { key: 'u_b', nick: '민호' }, { key: 'u_c', nick: '  ' }];
    var out = names(stateOf([rec('2026-11-20', '민호')], { data: { friends: friends } }));
    eq(out.join(','), '민호', '중복·빈 이름 없음');
  });

  test('v1.35 파트너 후보: 나 자신은 빠진다', function () {
    var friends = [{ key: ME, nick: '나래' }];
    var out = names(stateOf([rec('2026-11-20', '나래', { tag: 'a' }), rec('2026-11-19', '민수', { tag: 'b' })], { data: { friends: friends } }));
    eq(out.join(','), '민수', '내 닉네임 제외');
  });

  test('v1.35 파트너 후보: 점수를 안 적은 일지도 함께 친 사람으로 센다', function () {
    var out = names(stateOf([rec('2026-11-20', '민호')]));
    eq(out.join(','), '민호', '게임 점수 없이도 이름만 있으면 후보');
  });

  test('v1.35 파트너 후보: 이름이 없거나 깨진 팀 칸은 조용히 건너뛴다', function () {
    var list = [
      rec('2026-11-20', '', { tag: 'a', team: '' }),
      rec('2026-11-19', '', { tag: 'b', team: '{깨진 JSON' }),
      rec('2026-11-18', '', { tag: 'c', team: JSON.stringify({ video: { url: 'https://youtu.be/x' } }) }),
      rec('2026-11-17', '민수', { tag: 'd' })
    ];
    eq(names(stateOf(list)).join(','), '민수', '이름 있는 것만');
    eq(names(stateOf([])).length, 0, '기록 없음');
    eq(names(null).length, 0, 'state 없음');
  });

  test('v1.35 파트너 후보: 이름 안쪽 공백은 한 칸으로 정리해 같은 사람으로 센다', function () {
    var list = [rec('2026-11-20', '조 환비', { tag: 'a' }), rec('2026-11-19', '조  환비', { tag: 'b' })];
    eq(names(stateOf(list)).join(','), '조 환비', '한 명으로');
  });

  test('v1.35 파트너 후보: 같은 입력이면 같은 결과 (입력을 건드리지 않는다)', function () {
    var list = [rec('2026-11-20', '민호')];
    var before = JSON.stringify(list);
    eq(JSON.stringify(names(stateOf(list))), JSON.stringify(names(stateOf(list))), '같은 결과');
    eq(JSON.stringify(list), before, '입력 그대로');
  });

  /* =========================================================
   * 2. 칩 줄 마크업
   * ========================================================= */

  test('v1.35 칩: 파트너 입력칸 바로 아래에 칩 줄이 온다', function () {
    var out = html(BM.views.log.render(stateOf([rec('2026-11-20', '민호')])), '일지');
    includes(out, 'data-ptnchips', '칩 줄');
    includes(out, 'class="ptnchips"', '칩 줄 클래스');
    includes(out, '자주 친 파트너', '이름표');
    var atInput = out.indexOf('data-field="partner"');
    var atChips = out.indexOf('data-ptnchips');
    ok(atInput > 0 && atChips > atInput, '입력칸 다음에 칩');
  });

  test('v1.35 칩: 후보마다 누를 수 있는 버튼 (data-ptn-chip)', function () {
    var out = html(BM.views.log.render(stateOf([
      rec('2026-11-20', '민호', { tag: 'a' }), rec('2026-11-19', '민수', { tag: 'b' })
    ])), '일지');
    includes(out, '<button type="button" class="ptnchip" data-ptn-chip="민호"', '민호 칩');
    includes(out, 'data-ptn-chip="민수"', '민수 칩');
    includes(out, 'aria-pressed="false"', '기본은 꺼진 모양');
  });

  test('v1.35 칩: 이미 적힌 이름은 켜진 모양 (aria-pressed)', function () {
    var out = html(BM.views.log.render(stateOf([rec('2026-11-20', '민호')], {
      drafts: { log: { partner: '민호' } }
    })), '일지');
    includes(out, 'class="ptnchip is-on" data-ptn-chip="민호"', '켜진 칩');
    includes(out, 'aria-pressed="true"', '눌린 상태');
  });

  test('v1.35 칩: 후보가 없으면 칩 줄을 그리지 않는다', function () {
    var out = html(BM.views.log.render(stateOf([])), '일지');
    excludes(out, 'data-ptnchips', '칩 줄 없음');
    excludes(out, '자주 친 파트너', '이름표 없음');
    includes(out, 'data-field="partner"', '파트너 입력칸은 그대로');
  });

  test('v1.35 칩: 이름은 글자로만 나온다 (이스케이프)', function () {
    var bad = '"><img src=x onerror=alert(1)>';
    var out = html(BM.views.log.render(stateOf([rec('2026-11-20', bad)])), '일지 XSS');
    excludes(out, '<img src=x', '태그로 열리지 않음');
    includes(out, '&lt;img', '글자로는 남는다');
  });

  test('v1.35 칩: 화면에는 4개까지만 나온다', function () {
    var list = ['가', '나', '다', '라', '마'].map(function (n, i) {
      return rec('2026-11-' + (20 - i), n + '선수', { tag: 't' + i });
    });
    var out = html(BM.views.log.render(stateOf(list)), '일지 5명');
    eq((out.match(/data-ptn-chip="/g) || []).length, 4, '칩 4개');
    excludes(out, 'data-ptn-chip="마선수"', '다섯 번째는 칩이 아니다');
  });

  test('v1.35 칩: 접힌 경기 점수 안에 그대로 있다 (새 카드 없음)', function () {
    var out = html(BM.views.log.render(stateOf([rec('2026-11-20', '민호')])), '일지');
    var fold = out.indexOf('data-fold="games"');
    var chips = out.indexOf('data-ptnchips');
    ok(fold > 0 && chips > fold, '경기 점수 접기 안');
    excludes(out, 'card--ptnchip', '새 카드 없음');
  });

  /* =========================================================
   * 3. 칩 누르기 (입력·지우기)
   * ========================================================= */

  test('v1.35 칩 누르기: 클릭 위임이 이름을 draft에 넣는다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    includes(src, "ev.target.closest('[data-ptn-chip]')", '클릭 위임');
    includes(src, 'ctx.actions.setDraft({ partner: next })', 'draft 반영');
    includes(src, "form.querySelector('[data-field=\"partner\"]')", '입력칸');
  });

  test('v1.35 칩 누르기: 같은 칩을 다시 누르면 지운다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    includes(src, "var next = now === picked ? '' : picked;", '같으면 빈 값');
    includes(src, 'UI.haptic(8)', '진동');
  });

  test('v1.35 칩 누르기: 누른 뒤 켜짐 표시를 다시 칠한다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    includes(src, "UI.$$('[data-ptn-chip]', form)", '모든 칩');
    includes(src, "b.classList.toggle('is-on', on)", '켜짐 표시');
    includes(src, "b.setAttribute('aria-pressed', on ? 'true' : 'false')", '스크린리더 상태');
  });

  test('v1.35 칩 누르기: 입력 중 커서를 건드리지 않는다 (이름만 넣는다)', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    excludes(src, 'ptnInput.focus()', '키보드를 다시 올리지 않음');
    includes(src, "ptnInput.value = next", '값만 바꾼다');
  });

  /* =========================================================
   * 4. 일지 & AI 첫 화면 밀도
   * ========================================================= */

  test('v1.35 밀도: 루틴 선택 카드는 그대로 있고 두 버튼도 그대로', function () {
    var out = html(BM.views.log.render(stateOf([])), '일지 선택 카드');
    includes(out, 'data-act="routine-start"', '시작 버튼');
    includes(out, '초보자 루틴 시작하기', '시작 버튼 이름');
    includes(out, 'data-act="routine-skip"', '건너뛰기 버튼');
    includes(out, '나중에 MY에서 언제든 켜고 끌 수 있어요', '되돌릴 수 있다는 안내');
  });

  test('v1.35 밀도: 큰 지표 상자 3개 대신 한 줄 메타 칩', function () {
    var out = html(BM.views.log.render(stateOf([])), '일지 메타');
    excludes(out, 'ask__stats', '지표 상자 없음');
    includes(out, 'ask__meta', '한 줄 메타');
    includes(out, '4주</b> 과정', '4주 안내 유지');
    includes(out, '연습 <b>13개</b>', '연습 13개 유지');
    includes(out, '주 <b>2~3회</b>', '주 2~3회 유지');
  });

  test('v1.35 밀도: 두 버튼이 한 줄 (ask__btns 그리드 두 칸)', function () {
    var css = readRoot('styles.css');
    includes(css, '.ask__btns {', '버튼 줄');
    includes(css, 'grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr)', '두 칸');
    includes(css, '.ask__btns .btn', '버튼 크기');
    var out = BM.views.log.render(stateOf([]));
    excludes(out, 'btn--big" data-act="routine-start"', '세로로 긴 버튼 아님');
  });

  test('v1.35 밀도: 카드 사이 간격 12px (일지 화면만)', function () {
    var css = readRoot('styles.css');
    includes(css, '.view[data-view="log"] { gap: 12px; }', '일지 화면 간격');
    includes(readRoot('app.js'), 'data-view="', '화면 이름표');
  });

  test('v1.35 밀도: 카드 순서 — 히어로 → 루틴 → 챌린지 → 가이드 → 오늘 일지 → 파트너 승률 → 최근 기록', function () {
    var out = BM.views.log.render(stateOf([
      rec('2026-11-18', '민호', { tag: 'a', weakness: ['헤어핀'], games: [{ a: 21, b: 18 }] })
    ]));
    var order = ['card--hero', 'data-region="routine"', 'card--wkch', 'data-region="beginner"', 'data-form="log"', 'data-region="partner"', 'data-region="recent"'];
    var at = order.map(function (k) { return out.indexOf(k); });
    ok(at.every(function (v) { return v > 0; }), '모두 있음: ' + at.join(','));
    for (var i = 1; i < at.length; i++) ok(at[i - 1] < at[i], '순서 유지: ' + order[i]);
  });

  test('v1.35 밀도: 파트너 승률 카드는 오늘 일지 아래로 (입력까지 76px 단축)', function () {
    var out = BM.views.log.render(stateOf([
      rec('2026-11-18', '민호', { tag: 'a', games: [{ a: 21, b: 18 }] })
    ]));
    ok(out.indexOf('data-form="log"') < out.indexOf('data-region="partner"'), '입력 다음에 승률');
    includes(out, '파트너별 승률', '카드는 그대로 있다');
  });

  test('v1.35 정리: 챌린지 달성 카드가 같은 안내를 두 번 하지 않는다', function () {
    var list = [
      rec('2026-11-18', '', { tag: 'a', weakness: ['스매시'] }),
      rec('2026-11-19', '', { tag: 'b', weakness: ['스매시'] }),
      rec('2026-11-20', '', { tag: 'c', weakness: ['스매시'] })
    ];
    var out = html(BM.views.log.render(stateOf(list)), '일지 챌린지');
    includes(out, '3회 채웠어요', '축하 문구');
    includes(out, '다음 주 월요일에 새 약점으로 바뀌어요', '바뀐다는 안내는 한 번');
    excludes(out, '다음 주에 일지를 보면 다시 골라 드려요', '같은 말을 되풀이하지 않음');
  });

  test('v1.35 정리: 다음 주 후보가 있으면 그 줄은 그대로 남는다', function () {
    var list = [
      rec('2026-11-16', '', { tag: 'a', weakness: ['스매시'] }),
      rec('2026-11-17', '', { tag: 'b', weakness: ['헤어핀'] }),
      rec('2026-11-18', '', { tag: 'c', weakness: ['헤어핀'] }),
      rec('2026-11-19', '', { tag: 'd', weakness: ['헤어핀'] }),
      rec('2026-11-20', '', { tag: 'e', weakness: ['헤어핀'] })
    ];
    var out = html(BM.views.log.render(stateOf(list)), '일지 후보');
    includes(out, '3회 채웠어요', '축하 문구');
    includes(out, '다음 주 후보 · 스매시', '다음 주 후보는 새 정보라 남김');
  });

  /* =========================================================
   * 5. 5개 탭 공통 정비
   * ========================================================= */

  test('v1.35 공통: 한국어는 단어 경계에서 줄바꿈 (keep-all)', function () {
    var css = readRoot('styles.css');
    includes(css, 'word-break: keep-all', 'keep-all');
    includes(css, 'overflow-wrap: break-word', '긴 주소는 그때만');
    includes(css, 'text-wrap: pretty', '고아 줄 방지');
  });

  test('v1.35 공통: 상단 채팅·하트 터치 영역을 키웠다', function () {
    var css = readRoot('styles.css');
    includes(css, '.hdr__chat.iconbtn { width: 38px; height: 38px; }', '채팅 38px');
    includes(css, '.heartchip { height: 34px; }', '하트 34px');
  });

  test('v1.35 공통: 매칭 첫 화면이 필터 칩과 같은 말을 되풀이하지 않는다', function () {
    var st = stateOf([]);
    st.ui.tab = 'matching';
    st.ui.matchFilter = { level: '', gender: '', region: '', discipline: '', query: '' };
    var out = html(BM.views.matching.render(st), '매칭');
    /* bm-v1.79.0 — 빈 안내 카드 대신 추천 목록(선수가 없으면 그림 안내)이 먼저 보이고,
     *  '전체'는 필터 줄에 하나만 */
    includes(out, 'data-act="show-all"', '전체 보기 버튼은 필터 줄에 그대로');
    excludes(out, 'matchintro', '빈 안내 카드는 없음');
    includes(out, 'empty__art', '선수가 없으면 그림 안내');
    excludes(out, '원하는 급수·조건이나 <b>전체</b>를 눌러 선수를 찾아보세요', '빈 안내 문구는 없음');
    excludes(out, '급수·지역·종목·성별 중 하나를 고르거나', '바로 위 칩과 겹치는 설명 줄은 없음');
    excludes(out, 'muted sm">급수 · 지역 · 종목', '카드 머리의 중복 라벨도 없음');
    includes(out, 'data-filter=', '필터 칩은 그대로');
  });

  test('v1.35 공통: 커뮤니티 작성 카드에 분류 이름표', function () {
    var com = readRoot('js/views/community.js');
    includes(com, 'topicpick__lab">분류</span>', '분류 이름표');
    includes(com, 'data-topics', '작성 말머리 칩은 그대로');
    includes(com, 'data-topicfilterbar', '목록 거르기 칩도 그대로');
    var css = readRoot('styles.css');
    includes(css, '.topicpick-line', '한 줄 배치');
  });

  test('v1.35 공통: 커뮤니티 화면이 그대로 그려진다 (말머리 두 줄)', function () {
    var state = stateOf([]);
    state.ui.composerTopic = '자유';
    var out = html(BM.views.community.render(state), '커뮤니티');
    includes(out, '분류', '이름표');
    includes(out, 'data-topic="자유"', '작성 칩');
    includes(out, 'data-topicfilter="전체"', '거르기 칩');
  });

  /* =========================================================
   * 6. 버전 · 캐시 · 회귀 · 보안
   * ========================================================= */

  test('v1.35 버전: sw.js·app.js·index.html·twa-manifest가 모두 v1.35', function () {
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.93.0'", 'sw.js');
    includes(app, "version: 'v1.93.0'", 'app.js');
    includes(index, 'styles.css?v=20261127-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.93.0', 'twa appVersionName');
    eq(twa.appVersion, '1.93.0', 'twa appVersion');
    eq(twa.appVersionCode, 87, 'twa appVersionCode');
  });

  test('v1.35 캐시: 새 파일 없이 기존 목록 그대로', function () {
    var sw = readRoot('sw.js');
    includes(sw, "'./js/views/log.js'", 'log.js 캐시');
    includes(sw, "'./js/views/community.js'", 'community.js 캐시');
    includes(sw, "'./styles.css'", '스타일 캐시');
    excludes(sw, 'ptnchip.js', '새 스크립트 없음');
  });

  test('v1.35 회귀: 기존 화면 기능은 그대로 있다', function () {
    var log = readRoot('js/views/log.js');
    includes(log, 'data-act="save-log"', '일지 저장');
    includes(log, 'data-act="open-scoreboard"', '코트 점수판');
    includes(log, 'card--wkch', '주간 챌린지 카드');
    includes(log, 'partnerBlock', '파트너 승률');
    includes(log, 'data-act="beginner-open"', '용어 사전 입구는 beginner.js');
    includes(readRoot('js/beginner.js'), 'data-act="beginner-open"', '용어 사전 버튼');
    includes(log, 'data-field="video"', '영상 링크');
    includes(log, 'data-field="partner"', '파트너 입력');
  });

  test('v1.35 보안: 이번 사이클 코드에 시트 ID·키·바깥 주소가 없다', function () {
    ['js/views/log.js', 'js/views/community.js', 'styles.css'].forEach(function (f) {
      var src = readRoot(f);
      excludes(src, '1sqxAM6eskBYS03s', f + ': 시트 ID 없음');
      excludes(src, 'eyJ', f + ': 토큰 없음');
      excludes(src, 'supabase.co', f + ': 서버 주소 없음');
    });
  });

  test('v1.35 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md'), ideas = readRoot('ideas.md');
    includes(readme, '## 15-35. v1.35.0', 'README 이번 사이클');
    includes(ideas, 'bm-v1.43.0', '아이디어 노트 상태');
    includes(ideas, '최근 파트너', '파트너 칩');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
