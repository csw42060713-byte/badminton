/* ============================================================
 * test/v125.test.js — v1.31.0 (2026-11-20)
 *  옛 COURT NOTE 초보용 글 통합 (용어 사전 43개 · 튜토리얼 3묶음 ·
 *  기술 가이드 5종 · 쉬운 맞춤 연습 5종)
 *  1) 데이터 수량과 원문 보존
 *  2) 검색·기술 맞추기 (이름·설명, 드릴 이름에서도)
 *  3) 초심 급수 노출 (큰 카드 ↔ 한 줄 보조 카드)
 *  4) 패널 화면 (튜토리얼 · 용어 카드 · 기술 가이드)
 *  5) AI 카드: 쉬운 설명 → 논문 드릴 순서
 *  6) 버전 정합성 (sw · app · 스타일 캐시 · README · TWA · 캐시 목록)
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;
  var U = BM.util;
  var B = BM.beginner;

  function hasNode() {
    try { return typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; }
    catch (e) { return false; }
  }
  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }
  function readmeNote() {
    try {
      var fs = require('fs'), path = require('path');
      var p = path.join(root.__REPO_ROOT__, '..', 'legacy-beginner-extract.md');
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    } catch (e) { return ''; }
  }
  function term(name) {
    return B.TERMS.filter(function (x) { return x[0] === name; })[0] || null;
  }
  function countOf(html, needle) {
    return String(html).split(needle).length - 1;
  }

  /* ---------- 화면 상태 ---------- */
  function stateOf(level, weakness) {
    var rows = BM.fixtures.demo();
    var me = {
      key: BM.seed.ME, nick: '승우', level: level, discipline: '복식',
      theme: { theme: 'th_def', avatar: '🏸' }
    };
    var state = {
      ready: true, mode: 'local', me: me, rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: {
        log: {
          date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: ['스트록'],
          weakness: weakness || [], pain: [], note: ''
        }
      },
      ui: { tab: 'log' }, analysis: null, queue: [], locks: {},
      syncState: 'idle', syncError: null, lastSync: '', stats: {}, routinePref: true
    };
    state.analysis = BM.ai.analyze({
      draft: state.drafts.log, records: state.data.records, level: level, nick: '승우'
    });
    return state;
  }

  /* =========================================================
   * 1) 데이터 수량 · 원문
   * ========================================================= */
  test('v1.25 데이터: 용어 43개 · 기술 가이드 5종 · 연습 5종 · 튜토리얼 3묶음', function () {
    eq(B.TERMS.length, 43, '용어 개수');
    eq(B.SKILL_GUIDE.length, 5, '기술 가이드 개수');
    eq(B.DRILLS.length, 5, '맞춤 연습 개수');
    eq(B.TUTORIAL.groups.length, 3, '튜토리얼 묶음');
    B.TERMS.forEach(function (x) {
      ok(typeof x[0] === 'string' && x[0].trim() && typeof x[1] === 'string' && x[1].trim(), '용어 이름·설명: ' + x[0]);
    });
    var names = B.TERMS.map(function (x) { return x[0]; });
    eq(names.length, U.uniq(names).length, '용어 이름이 겹치지 않아야 합니다');
  });

  test('v1.25 원문: 옛 초보용 문장을 고치지 않고 담았다', function () {
    includes(term('스트로크 (Stroke)')[1], '셔틀콕을 라켓으로 치는 동작을 통틀어 스트로크라고 해요.');
    includes(term('스트로크 (Stroke)')[1], '연습할 때는 팔만 휘두르지 말고 준비 자세, 몸의 회전, 타점, 임팩트를 연결해 보세요.');
    includes(term('듀스')[1], '29대29에서는 다음 점수를 얻어 30점에 먼저 도달한 쪽이 게임을 이겨요.');
    includes(term('스플릿 스텝 (Split Step)')[1], '상대가 셔틀콕을 치는 순간에 맞춰 가볍게 발을 띄우거나 양발로 가볍게 착지해 다음 방향으로 출발할 준비를 하는 동작이에요.');
    includes(term('서브 vs 리시브')[1], '서브는 랠리를 시작하는 첫 타구이고, 리시브는 상대의 서브를 받아내는 동작이에요.');
    /* 추출 노트가 옆에 있으면 43개 전부 문장 그대로인지 대조합니다 */
    var md = readmeNote();
    if (!md) return;
    var rows = md.split('\n').filter(function (l) { return /^\['/.test(l.trim()); });
    eq(rows.length, 43, '추출 노트의 용어 줄');
    var src = {};
    rows.forEach(function (l) {
      var m = l.trim().match(/^\['((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'\],?$/);
      if (m) src[m[1]] = m[2].replace(/\\'/g, "'");
    });
    B.TERMS.forEach(function (x) {
      eq(x[1], src[x[0]], '원문과 같은 문장: ' + x[0]);
    });
  });

  test('v1.25 튜토리얼: 세 묶음 안내 문구', function () {
    includes(B.TUTORIAL.welcome, 'COURT NOTE 초보자 튜토리얼에 온 걸 환영해요!');
    includes(B.TUTORIAL.intro, '처음에는 모든 용어를 외우려고 하지 않아도 돼요.');
    eq(B.TUTORIAL.groups[0].title, '1. 이동 기술');
    eq(B.TUTORIAL.groups[0].terms, '풋워크 · 스플릿 스텝 · 런지 · 리커버리');
    eq(B.TUTORIAL.groups[1].title, '2. 타구 기술');
    eq(B.TUTORIAL.groups[1].terms, '클리어 · 드롭 · 스매시 · 푸시 · 드라이브 · 헤어핀');
    eq(B.TUTORIAL.groups[2].title, '3. 경기 운영');
    eq(B.TUTORIAL.groups[2].terms, '서브 · 리시브 · 포메이션 · 로테이션 · 전술');
  });

  test('v1.25 기술 가이드: 5종의 횟수·세트 목표까지 원문 그대로', function () {
    var skills = B.SKILL_GUIDE.map(function (g) { return g.skill; });
    eq(skills.join(','), '드라이브,헤어핀,스매시,클리어,언더', '가이드 기술');
    var drive = B.guideForSkill('드라이브');
    eq(drive.sets, '20개씩 3세트');
    includes(drive.paragraphs[0].text, '5분간 랠리를 이어가세요');
    includes(drive.paragraphs[1].text, '20개씩 3세트를 목표로 합니다.');
    eq(B.guideForSkill('헤어핀').sets, '하루 10분씩 양쪽 방향');
    includes(B.guideForSkill('헤어핀').paragraphs[1].label, '쉽게 이해하기');
    includes(B.guideForSkill('헤어핀').paragraphs[1].text, '셔틀콕을 살짝 밀어 친다고 생각하세요.');
    eq(B.guideForSkill('스매시').sets, '15개씩 3세트');
    eq(B.guideForSkill('클리어').sets, '30개씩 3세트');
    includes(B.guideForSkill('클리어').paragraphs[0].text, '30개씩 3세트를 목표로 하세요.');
    eq(B.guideForSkill('언더').sets, '', '언더는 세트 숫자 없이 원문만');
    includes(B.guideForSkill('언더').paragraphs[1].text, '셔틀콕을 높고 멀리 보내 준비 시간을 확보하세요.');
  });

  test('v1.25 맞춤 연습: 5종의 방법·횟수·포인트', function () {
    var names = B.DRILLS.map(function (d) { return d.name; });
    eq(names.join(','), '드라이브,헤어핀,스매시,클리어,언더');
    B.DRILLS.forEach(function (d) {
      ok(d.method && d.sets && d.point, d.name + ' 방법·횟수·포인트');
    });
    eq(B.drillForSkill('드라이브').sets, '5분씩 2세트');
    eq(B.drillForSkill('스매시').sets, '10회씩 2세트');
    includes(B.drillForSkill('스매시').method, '통증이 있으면 중단하세요.');
    includes(B.drillForSkill('헤어핀').point, '힘보다 부드러운 터치와 안정적인 자세 우선');
  });

  /* =========================================================
   * 2) 검색 · 기술 맞추기
   * ========================================================= */
  test('v1.25 검색: 빈 검색어는 43개, 이름과 설명을 함께 거른다', function () {
    eq(B.searchTerms('').length, 43);
    eq(B.searchTerms('   ').length, 43);
    var foot = B.searchTerms('풋워크').map(function (x) { return x[0]; });
    includes(foot.join('|'), '풋워크 (Footwork)');
    includes(foot.join('|'), '6점 풋워크');
    eq(B.searchTerms('듀스').length, 1);
    eq(B.searchTerms('듀스')[0][0], '듀스');
    eq(B.searchTerms('smash').length, 1, '영문 이름도 소문자로 찾힘');
    eq(B.searchTerms('없는말입니다').length, 0);
  });

  test('v1.25 기술 맞추기: 약점 이름과 AI 드릴 이름 모두', function () {
    eq(B.guideForSkill('헤어핀').skill, '헤어핀');
    eq(B.guideForSkill('드라이브 기본 반복').skill, '드라이브');
    eq(B.guideForSkill('네트 앞 헤어핀 정확도').skill, '헤어핀');
    eq(B.guideForSkill('스매시 임팩트 반복').skill, '스매시');
    eq(B.guideForSkill('풋워크'), null);
    var list = B.guidesForSkills(['헤어핀', '헤어핀 정확도', '드라이브', '풋워크']);
    eq(list.length, 2, '겹치지 않게 두 개');
    eq(list[0].skill, '헤어핀');
  });

  /* =========================================================
   * 3) 급수 노출
   * ========================================================= */
  test('v1.25 급수: 초심·초보·입문만 초보자 카드', function () {
    ok(B.isBeginnerGrade('초심'));
    ok(B.isBeginnerGrade('초보'));
    ok(B.isBeginnerGrade('초보용'));
    ok(B.isBeginnerGrade('입문'));
    ok(!B.isBeginnerGrade('D조'));
    ok(!B.isBeginnerGrade('C조'));
    ok(!B.isBeginnerGrade('선수부'));
    ok(!B.isBeginnerGrade('자강'));
    ok(!B.isBeginnerGrade('일반부'));
    ok(!B.isBeginnerGrade(''));
    ok(!B.isBeginnerGrade(null));
  });

  test('v1.25 카드: 초심은 큰 카드, 그 위 급수는 한 줄 보조 카드', function () {
    var big = B.entryHtml({ me: { level: '초심' } });
    includes(big, 'card--beg', '초심 큰 카드');
    includes(big.replace(/&amp;/g, '&'), '🏸 처음이라면 · 용어 사전 & 기초 가이드', '버튼 문구');
    includes(big, 'data-act="beginner-open"');
    includes(big, '43');
    excludes(big, 'undefined');
    var slim = B.entryHtml({ me: { level: 'C조' } });
    includes(slim, 'card--beg-slim', '보조 카드');
    includes(slim.replace(/&amp;/g, '&'), '🏸 처음이라면 · 용어 사전 & 기초 가이드');
    includes(slim, 'data-act="beginner-open"');
    includes(slim, 'data-region="beginner"');
    excludes(slim, 'card--beg"', '큰 카드가 아니어야 합니다');
  });

  /* =========================================================
   * 4) 패널 화면
   * ========================================================= */
  test('v1.25 패널: 튜토리얼 · 용어 카드 43개 · 고정 검색창', function () {
    var intro = B.bodyHtml('intro', '');
    includes(intro, B.TUTORIAL.welcome);
    includes(intro, '1. 이동 기술');
    includes(intro, '2. 타구 기술');
    includes(intro, '3. 경기 운영');
    excludes(intro, 'undefined');
    var terms = B.bodyHtml('terms', '');
    eq(countOf(terms, 'class="bgt"'), 43, '용어 카드 수');
    includes(terms, '43개 용어 표시 중');
    var one = B.bodyHtml('terms', '듀스');
    includes(one, '1개 용어 표시 중');
    includes(one, '듀스');
    excludes(one, '스트로크 (Stroke)');
    var none = B.bodyHtml('terms', '없는말입니다');
    includes(none, '검색 결과가 없어요. 다른 단어로 검색해 보세요.');
    includes(none, '0개 용어 표시 중');
  });

  test('v1.25 패널: 기술 가이드 화면에 5종 + 연습 5종', function () {
    var guide = B.bodyHtml('guide', '');
    eq(countOf(guide, 'bgt--guide'), 5, '기술 가이드 카드');
    eq(countOf(guide, 'bgt--drill'), 5, '맞춤 연습 카드');
    includes(guide, '처음에는 정확도와 안정성을 우선하고, 익숙해지면 속도와 위치를 조절해 보세요.');
    includes(guide, '20개씩 3세트');
    includes(guide, '드라이브 연습');
    includes(guide, '<dt>포인트</dt>');
    excludes(guide, 'undefined');
  });

  /* =========================================================
   * 5) AI 카드 연결
   * ========================================================= */
  test('v1.25 AI 카드: 쉬운 설명이 논문 드릴보다 먼저', function () {
    var easy = B.easyGuideHtml(['네트 앞 헤어핀 정확도']);
    includes(easy, '처음이라면 · 쉬운 설명');
    includes(easy, '쉽게 이해하기');
    includes(easy, 'data-beg-tab="guide"');
    excludes(easy, 'undefined');
    eq(B.easyGuideHtml(['풋워크', '서브']), '', '가이드 없는 기술은 비어 있음');

    var html = BM.views.log.render(stateOf('초심', ['헤어핀']));
    var easyAt = html.indexOf('처음이라면 · 쉬운 설명');
    var drillAt = html.indexOf('<ol class="drills');
    ok(easyAt >= 0, 'AI 카드에 쉬운 설명');
    ok(drillAt > easyAt, '쉬운 설명이 드릴 목록보다 위에 있어야 합니다');
    includes(html, 'data-region="beginner"');
  });

  test('v1.25 화면: 일지·MY에서 언제든 열 수 있다', function () {
    var beginner = BM.views.log.render(stateOf('초심', []));
    includes(beginner, 'card--beg"');
    var pro = BM.views.log.render(stateOf('C조', []));
    includes(pro, 'card--beg-slim');
    var my = BM.views.my.render(stateOf('C조', []));
    includes(my, 'data-act="beginner-open"', 'MY의 입구');
    includes(my, '🏸 처음이라면 · 용어 사전 &amp; 기초 가이드');
  });

  /* =========================================================
   * 6) 버전 · 캐시
   * ========================================================= */
  test('v1.25 버전: sw · app · 스타일 캐시 · README · TWA가 함께 올라간다', function () {
    if (!hasNode()) return;
    var sw = readRoot('sw.js');
    var app = readRoot('app.js');
    var index = readRoot('index.html');
    var readme = readRoot('README.md');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.90.0'", 'sw.js');
    includes(sw, "./js/beginner.js", '서비스워커 캐시 목록');
    includes(app, "version: 'v1.90.0'", 'app.js');
    includes(index, 'styles.css?v=20261127-4', '스타일 캐시 키');
    includes(index, 'js/beginner.js', '스크립트 로드');
    includes(readme, 'v1.31.0', 'README 변경 이력');
    eq(twa.appVersionName, '1.90.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.90.0', 'TWA appVersion');
    eq(twa.appVersionCode, 84, 'TWA 버전 코드');
  });

  test('v1.25 스타일: 패널·용어 카드가 테마 변수로 그려진다', function () {
    if (!hasNode()) return;
    var css = readRoot('styles.css');
    includes(css, '.card--beg {');
    includes(css, '.bgp__panel');
    includes(css, '.bgt__sum');
    includes(css, '.bgp__searchbox');
    includes(css, '.easy__p');
    includes(css, 'var(--bg)');
    includes(css, 'var(--card)');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
