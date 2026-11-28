/* ============================================================
 * test/v137_2.test.js — bm-v1.37.2
 *   [일지 '저장하고 AI 분석' 버튼 하단 고정 · 커뮤니티 '번개' → '게스트 모집']
 *
 *   1) 저장 바(styles.css · js/views/log.js)
 *      · 카드 안 sticky 대신 화면 하단 탭바 바로 위의 고정 바(position: fixed)
 *      · 탭바와 같은 폭·여백(칩 12px · 최대 436px) — 하단 독처럼 보이게
 *      · 일지 & AI 탭에서만 보입니다(뷰가 다시 그려져 다른 탭에는 요소 자체가 없음)
 *      · 맨 아래 내용을 가리지 않게 뷰에 아래 여백(104px)
 *      · 키보드가 올라오면(body.kb-open) 키보드 바로 위로 붙고 안내 문구는 숨김
 *      · 버튼 class · data-act · 글자(저장하고 AI 분석 / 수정 저장)와 저장 동작은 그대로
 *
 *   2) 말머리 이름 변경
 *      · '게스트 모집'이 말머리 목록·카드·단체방 이름표의 기본 이름
 *      · 예전에 저장된 '번개'·'번개 모집'·'번개모집' 글도 새 이름으로 읽혀 모집 카드·단체방 유지
 *      · 화면 문구(앱 코드)에는 '번개'가 남지 않음, 참여/대기 문구는 한 줄(30자) 유지
 *
 *   3) 버전 정합(sw · app · index · TWA · README · ideas) · 회귀
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
  function existsRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.existsSync(path.join(root.__REPO_ROOT__, file));
  }
  /* CSS에서 규칙 하나의 본문만 잘라 냅니다 (같은 선택자가 여러 번 나오면 첫 번째) */
  function ruleOf(css, selector) {
    var at = css.indexOf(selector + ' {');
    if (at < 0) return '';
    var start = css.indexOf('{', at);
    var end = css.indexOf('}', start);
    return end > start ? css.slice(start, end) : '';
  }

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function stateOf(rows, patch) {
    rows = rows || [];
    var st = {
      ready: true, mode: 'local',
      me: { key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_def', avatar: '🏸' } },
      rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
          gameMode: 21, games: [{ a: '', b: '' }], score: null, result: '',
          pain: [], weakness: [], note: ''
        }
      },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', composerMeet: { when: '', place: '', cap: '' }, replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      dataExtra: null
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) {
        if (k === 'ui') st.ui = Object.assign({}, st.ui, patch.ui);
        else st[k] = patch[k];
      });
    }
    return st;
  }

  function meetRow(plan, userKey, id) {
    return D.toRow({
      id: id || 'guest-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '코트지기', text: '금요일 저녁 게스트 모집합니다!', userKey: userKey || 'u_other', plan: plan
    });
  }

  /* =========================================================
   * 1. 저장 바 — 하단 탭바 위 고정 (styles.css)
   * ========================================================= */
  test('v1.37.2 저장 바: 카드 안 sticky가 아니라 화면 하단 고정 바다', function () {
    var css = readRoot('styles.css');
    var bar = ruleOf(css, '.submit-wrap.savebar');
    ok(bar, '저장 바 규칙을 찾는다');
    includes(bar, 'position: fixed', '화면에 고정');
    includes(bar, 'bottom:', '아래에서 띄운다');
    includes(bar, 'translateX(-50%)', '가운데 정렬(앱 폭 460px 안)');
    excludes(bar, 'position: sticky', '카드 안 sticky는 남기지 않는다');
    excludes(bar, 'margin: 18px -18px -18px', '카드 밖으로 삐져나오던 음수 여백 없음');
    excludes(bar, 'margin: 20px -18px -18px', '두 번째 음수 여백 규칙도 없음');
    /* 예전 sticky 규칙이 뒤에서 되살아나지 않아야 합니다 */
    excludes(css, '.submit-wrap.savebar { position: sticky; }', '뒤에서 sticky로 되돌리지 않음');
  });

  test('v1.37.2 저장 바: 하단 탭바 바로 위에 탭바와 같은 폭으로 떠 있다', function () {
    var css = readRoot('styles.css');
    var bar = ruleOf(css, '.submit-wrap.savebar');
    includes(bar, 'bottom: calc(var(--nav-h) + var(--safe-b) + 16px)', '탭바 높이 + 안전 영역 + 8px 숨');
    includes(bar, 'width: calc(100% - 24px)', '탭바와 같은 좌우 12px 여백');
    includes(bar, 'max-width: 436px', '탭바와 같은 최대 폭');
    includes(bar, 'border-radius: 20px', '둥근 바');
    includes(bar, 'z-index: 44', '탭바(45)·헤더(40) 사이');
    /* 탭바 규칙과 짝이 맞는지 */
    var tabbar = ruleOf(css, '.tabbar');
    includes(css, 'bottom: calc(8px + var(--safe-b));', '탭바는 아래에서 8px');
    includes(tabbar, 'max-width: 436px', '탭바 최대 폭과 같다');
  });

  test('v1.37.2 저장 바: 떠 있는 바라 위쪽 그라데이션 띠는 쓰지 않는다', function () {
    var css = readRoot('styles.css');
    includes(css, '.savebar::before { content: none; display: none; }', '그라데이션 띠 끔');
    excludes(css, 'background: linear-gradient(180deg, transparent, var(--card));', '옛 페이드 규칙 없음');
  });

  test('v1.37.2 저장 바: 맨 아래 내용(최근 기록)을 가리지 않게 뷰에 아래 여백이 있다', function () {
    var css = readRoot('styles.css');
    includes(css, '.main > .view[data-view="log"] { padding-bottom: 104px; }', '일지 탭 뷰 아래 여백');
    /* 여백이 바 높이(약 92px)보다 넉넉해야 합니다 */
    ok(104 > 92, '바 높이보다 큰 여백');
  });

  test('v1.37.2 저장 바: 키보드가 올라오면 키보드 바로 위로 붙고 얇아진다', function () {
    var css = readRoot('styles.css');
    includes(css, 'body.kb-open .savebar { bottom: calc(var(--kbd, 0px) + 10px); padding-bottom: 9px; }',
      '키보드 위로 이동 · 아래 여백 축소');
    includes(css, 'body.kb-open .savebar .hint { display: none; }', '입력 중에는 안내 문구를 숨겨 메모 칸을 덜 가린다');
    includes(css, 'body.kb-open .tabbar', '키보드가 올라오면 탭바는 숨김(그 자리를 저장 바가 씀)');
  });

  /* =========================================================
   * 2. 저장 바 — 버튼·문구·동작은 그대로 (js/views/log.js · app.js)
   * ========================================================= */
  test('v1.37.2 저장 바: 버튼 class·data-act·글자가 그대로다', function () {
    var log = readRoot('js/views/log.js');
    includes(log, "'<div class=\"submit-wrap savebar\">'", '같은 컨테이너');
    includes(log, 'class="btn btn--primary btn--big" data-act="save-log"', '같은 버튼 class · 같은 동작');
    includes(log, "editing ? '수정 저장' : '저장하고 AI 분석'", '수정/새 일지 글자');
    includes(log, "editing ? '바뀐 칸만 새로 계산해 이 일지에 반영합니다' : '비워 둔 항목은 저장하지 않아요'", '안내 문구');
    includes(log, '<section class="card" data-form="log">', '오늘 일지 카드 안에서 위임 이벤트를 그대로 받음');
  });

  test('v1.37.2 저장 바: 저장 중·저장됨 표시와 분석으로 이동은 그대로다', function () {
    var app = readRoot('app.js');
    includes(app, "label.textContent = editing ? '수정 중…' : '저장 중…'", '저장 중 표시');
    includes(app, "label.textContent = res.updated ? '수정됨 ✓' : '저장됨 ✓'", '끝난 표시');
    includes(app, "label.textContent = '저장하고 AI 분석'", '끝나면 원래 글자로');
    includes(app, "[data-region=\"analysis\"]", '저장 뒤 분석 카드로 이동');
    includes(app, "btn.dataset.busy", '연타 잠금');
  });

  test('v1.37.2 저장 바: 일지 화면에 버튼이 하나만 있고 수정 모드에서 글자가 바뀐다', function () {
    var html = BM.views.log.render(stateOf());
    ok(html && html.length > 200, '일지 화면이 그려진다');
    var count = (html.match(/data-act="save-log"/g) || []).length;
    eq(count, 1, '저장 버튼 하나');
    includes(html, 'class="submit-wrap savebar"', '고정 바');
    includes(html, '저장하고 AI 분석', '새 일지 글자');

    var editing = stateOf(null, { ui: { editLogId: 'log-1' } });
    var editHtml = BM.views.log.render(editing);
    includes(editHtml, '수정 저장', '수정 모드 글자');
    eq((editHtml.match(/data-act="save-log"/g) || []).length, 1, '수정 모드에서도 버튼 하나');
  });

  /* =========================================================
   * 3. 말머리 '번개' → '게스트 모집'
   * ========================================================= */
  test('v1.37.2 말머리: 기본 이름이 게스트 모집이다', function () {
    eq(D.MEET.topic, '게스트 모집', '말머리');
    eq(D.MEET.cardLabel, '게스트 모집', '모집 카드 이름');
    eq(D.MEET.roomLabel, '게스트 모집 단체방', '단체방 이름');
    ok(D.POST_TOPICS.indexOf('게스트 모집') >= 0, '말머리 목록에 포함');
    eq(D.POST_TOPICS.indexOf('번개'), -1, '말머리 목록에 옛 이름 없음');
    includes(D.POST_TOPICS.join(','), D.MEET.topic, '이름표와 목록이 같은 곳을 본다');
  });

  test('v1.37.2 말머리: 예전 이름(번개)으로 저장된 글도 새 이름으로 읽는다', function () {
    ['번개', '번개 모집', '번개모집', '  번개  '].forEach(function (old) {
      eq(D.normalizeTopic(old), '게스트 모집', '말머리 변환: ' + JSON.stringify(old));
      eq(D.topicOf({ plan: { topic: old } }), '게스트 모집', '글 말머리: ' + JSON.stringify(old));
    });
    eq(D.normalizeTopic('자유'), '자유', '다른 말머리는 그대로');
    eq(D.normalizeTopic('이상한값'), '자유', '모르는 값은 자유');
    eq(D.normalizeTopic(''), '자유', '빈 값은 자유');
    /* 예전 글이어도 모집 카드·참여 문의·단체방이 그대로 */
    var old = D.fromRow(D.toRow({
      id: 'old-guest', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '코트지기', text: '예전에 올린 글', userKey: 'u_other',
      plan: { topic: '번개', meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } }
    }));
    eq(D.meetOf(old).place, '올림픽체육관', '예전 글 모집 정보');
    eq(D.groupTitle(old), '게스트 모집 단체방', '예전 글 단체방 이름');
    var html = BM.views.community.render(stateOf([old]));
    includes(html, 'class="vite"', '예전 글도 모집 카드');
    includes(html, 'data-vite-group="old-guest"', '예전 글도 참여 문의(단체방) 버튼');
    includes(html, '게스트 모집', '새 이름으로 보임');
    excludes(html, '번개', '옛 이름은 화면에 남지 않음');
  });

  test('v1.37.2 말머리: 커뮤니티 화면의 말머리 칩이 새 이름으로 그려진다', function () {
    var html = BM.views.community.render(stateOf());
    includes(html, 'data-topic="게스트 모집"', '작성 말머리 칩');
    includes(html, 'data-topicfilter="게스트 모집"', '거르기 칩');
    excludes(html, 'data-topic="번개"', '옛 칩 없음');
    eq(BM.views.community._setTopicFilter('번개'), '게스트 모집', '옛 이름으로 걸러도 새 말머리로');
    BM.views.community._setTopicFilter('전체');
  });

  test('v1.37.2 말머리: 참여·대기 문구는 새 이름으로도 한 줄에 들어간다', function () {
    var post = { meet: { when: '11/21(금) 19:00', place: '올림픽체육관', cap: '6' } };
    var inquiry = BM.views.community._inquiryDraft(post);
    var wait = BM.views.community._waitDraft(post);
    includes(inquiry, '게스트 모집', '말머리(참여)');
    includes(inquiry, '참여하고 싶어요', '참여 의사');
    includes(wait, '게스트 모집', '말머리(대기)');
    includes(wait, '대기하고 싶어요', '대기 의사');
    ok(inquiry.length <= 30, '참여 문구는 30자 이내: ' + inquiry.length);
    ok(wait.length <= 30, '대기 문구는 30자 이내: ' + wait.length);
    excludes(inquiry, '올림픽체육관', '긴 장소는 뺀다');
    eq(BM.views.community._inquiryDraft({ meet: null }), '게스트 모집 참여하고 싶어요!', '정보 없으면 인사만');
    eq(BM.views.community._waitDraft({ meet: null }), '게스트 모집 대기하고 싶어요!', '정보 없으면 인사만(대기)');
  });

  test('v1.37.2 말머리: 글을 올리면 새 이름으로 저장된다', function () {
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
    U.storage.removeItem('bm_rows_v1');
    return store.actions.init().then(function () {
      store.actions.setComposerTopic('게스트 모집');
      eq(store.state.ui.composerTopic, '게스트 모집', '작성 말머리');
      store.actions.setComposerMeet('when', '11/21(금) 19:00');
      var res = store.actions.createPost('금요일 저녁 게스트 모집', store.state.ui.composerTopic, store.state.ui.composerMeet);
      ok(res.ok, '글 저장');
      eq(res.topic, '게스트 모집', '저장된 말머리');
      includes(store.state.rows[0][D.COL['훈련계획']], '"topic":"게스트 모집"', '훈련계획 칸에 새 이름');
      eq(store.state.data.posts[0].topic, '게스트 모집', '목록 말머리');
      /* 옛 이름으로 들어온 작성 요청도 새 이름으로 저장 */
      store.state.locks = {};
      var b = store.actions.createPost('옛 이름으로 올림', '번개', { when: '', place: '', cap: '' });
      ok(b.ok, '옛 이름으로 올린 글도 저장');
      eq(b.topic, '게스트 모집', '저장할 때 새 이름으로');
      return store.flush();
    });
  });

  test('v1.37.2 말머리: 앱 화면 문구에 옛 이름이 남아 있지 않다', function () {
    if (!hasNode) return;
    ['js/domain.js', 'js/store.js', 'js/views/community.js', 'js/views/my.js', 'js/views/chat.js'].forEach(function (f) {
      var src = readRoot(f);
      if (f === 'js/domain.js') {
        /* domain.js에는 예전 이름을 새 이름으로 읽는 표만 남습니다 */
        includes(src, 'LEGACY_TOPICS', '옛 이름 변환표');
        var visible = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(function (line) {
          return line.indexOf('번개') >= 0 && line.indexOf('LEGACY_TOPICS') < 0 && line.indexOf('//') !== 0;
        });
        eq(visible.length, 0, '설명·변환표 밖에서 옛 이름을 쓰지 않는다: ' + visible[0]);
        return;
      }
      excludes(src, "'번개", f + ': 옛 이름이 화면 문구에 없음');
    });
  });

  /* =========================================================
   * 4. 버전 정합 · 회귀
   * ========================================================= */
  test('v1.37.2 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    var sw = readRoot('sw.js');
    includes(sw, "var VERSION = 'bm-v1.99.0'", 'sw.js');
    var app = readRoot('app.js');
    includes(app, "version: 'v1.99.0'", 'app.js');
    var html = readRoot('index.html');
    includes(html, 'styles.css?v=20261128-5', '스타일 캐시 키');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.99.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.99.0', 'TWA appVersion');
    eq(twa.appVersionCode, 93, 'appVersionCode는 그대로');
  });

  test('v1.37.2 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    includes(readRoot('ideas.md'), 'v1.37.2', '이번 사이클');
    includes(readRoot('ideas.md'), '게스트 모집', '이름 변경');
    var readme = readRoot('README.md');
    includes(readme, 'v1.37.2', 'README 변경 이력');
    includes(readme, '게스트 모집', 'README 말머리 이름');
  });

  test('v1.37.2 회귀: 일지 저장·수정 흐름과 파일이 그대로 있다', function () {
    if (!hasNode) return;
    ['js/views/log.js', 'js/store.js', 'js/ai.js', 'styles.css', 'index.html', 'sw.js', 'manifest.webmanifest'].forEach(function (f) {
      ok(existsRoot(f), '파일: ' + f);
    });
    var log = readRoot('js/views/log.js');
    includes(log, "data-act=\"save-log\"", '저장');
    includes(log, "data-act=\"cancel-edit\"", '수정 취소');
    includes(log, "data-region=\"recent\"", '최근 기록');
    includes(log, 'partnerBlock', '파트너 승률');
    var store = readRoot('js/store.js');
    includes(store, 'saveLog', '저장 동작');
    includes(store, 'deleteLog', '삭제 동작');
    includes(store, 'openGroupChat', '단체방 열기');
  });

  test('v1.37.2 회귀: 5개 탭과 하단 탭바는 그대로다', function () {
    var html = readRoot('index.html');
    ['log', 'matching', 'community', 'coach', 'my'].forEach(function (tab) {
      includes(html, 'data-tab="' + tab + '"', '탭: ' + tab);
    });
    includes(html, '일지 & AI', '일지 탭 이름');
    var css = readRoot('styles.css');
    includes(css, '--nav-h: 62px', '탭바 높이');
    includes(css, '.tabbar {', '탭바 스타일');
  });

  test('v1.37.2 보안: 저장 바·말머리에 바깥 주소나 인라인 스크립트가 없다', function () {
    var log = readRoot('js/views/log.js');
    var bar = log.slice(log.indexOf('<div class="submit-wrap savebar">'), log.indexOf('</section>', log.indexOf('submit-wrap savebar')));
    excludes(bar, 'http://', '평문 주소 없음');
    excludes(bar, 'onclick=', '인라인 스크립트 없음');
    var community = readRoot('js/views/community.js');
    excludes(community, 'onclick=', '커뮤니티 인라인 스크립트 없음');
    includes(community, 'U.esc(D.MEET.cardLabel)', '이름표도 이스케이프');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
