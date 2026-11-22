/* ============================================================
 * test/ux-polish.test.js — 사용성 다듬기 (미리보기 브랜치 fix/usability-polish)
 *
 *  1) 프로필 꾸미기 — 미리보기 닫기 동선
 *     · 잠긴 프레임·배지 → 미리보기 → '닫기'는 미리보기만 닫고 꾸미기 창으로 돌아온다
 *     · 돌아올 때 보던 스크롤 자리와 고치던 값(초안)을 그대로 이어받는다
 *  2) 프로필 꾸미기 — 화면 문구
 *     · 사진 · 프레임 아래 프레임/배경/아이콘/배지 소제목이 각 묶음 위에 선다
 *     · 저장 버튼 아래는 개발자 문구(JSON·시트 26칸) 대신 한 줄 안내
 *  3) 체육관 지도 — 내 집에서 가까운 순
 *     · 내 집을 직접 정해 두면 지도 아래 목록이 등록 순이 아니라 가까운 순
 *     · 예시 기준점(망원동)만 있을 때는 기존 순서 그대로
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

  function G() { return BM.gyms; }
  function N() { return BM.nearby; }

  var SAT = new Date(2026, 10, 21, 20, 11);

  function resetHomes() {
    ['demo_me', 'other_me', 'guest'].forEach(function (scope) {
      U.storage.removeItem(N().homeKey(scope));
      U.storage.removeItem(G().keyFor(scope));
    });
  }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', gender: '비공개', style: '공격형',
    theme: { theme: 'th_night', avatar: '🦋' }
  };

  function stateOf() {
    var rows = BM.fixtures.demo();
    return {
      ready: true, mode: 'local', me: JSON.parse(JSON.stringify(ME)), rows: rows,
      data: BM.store.derive(rows, BM.seed.ME), drafts: {},
      ui: {
        tab: 'my', matchFilter: { level: '전체', gender: '전체', region: '전체', discipline: '전체', query: '' },
        matchTab: 'find', matchSort: 'score', matchFilterOpen: '',
        chatRoom: null, chatOther: '', chatDraft: '', coachTab: '', coachPlayer: null,
        composer: '', composerTopic: '자유', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  /* =========================================================
   * 1. 프로필 꾸미기 — 미리보기 닫기 동선
   * ========================================================= */
  test('꾸미기: 잠긴 프레임·배지 미리보기의 닫기는 꾸미기 창으로 돌아온다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/my.js');
    /* 미리보기 닫기 → 아래에 있던 꾸미기 창을 다시 엽니다 */
    includes(src, "if (what === 'close') { back({ ok: false }); return; }", "닫기 → 'back'");
    includes(src, 'function back(res) {', '돌아가기 함수');
    includes(src, '/* 미리보기만 닫고, 아래에서 열려 있던', '미리보기만 닫기');
    /* 프레임·배지 두 길 모두 같은 자리로 돌아온다 */
    includes(src, 'openDecorateSheet(ctx, { draft: draft, scroll: atFrame })', '프레임 → 꾸미기 유지');
    includes(src, 'openDecorateSheet(ctx, { draft: draft, scroll: atBadge })', '배지 → 꾸미기 유지');
    /* 위 ×·바깥을 눌러도 같은 동선 (capture 로 먼저 받아 기본 닫기를 막음) */
    includes(src, "ev.target.closest('[data-close]')", '×·바깥 누름');
    includes(src, 'ev.stopPropagation();', '기본 닫기 막기');
    /* 해금에 성공해도 미리보기 위에 겹치지 않고 꾸미기로 */
    includes(src, 'back(res);', '해금 성공 → 꾸미기로');
    excludes(src, "if (what === 'close') { UI.closeSheet(); return; }", '예전 닫기 동선 없음');
  });

  test('꾸미기: 돌아올 때 보던 스크롤 자리를 그대로 되살린다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/my.js');
    includes(src, 'function sheetScrollOf(node) {', '스크롤 읽기');
    includes(src, "node.querySelector('.sheet__body')", '시트 본문');
    includes(src, 'var backAt = Math.max(0, Number(opts.scroll) || 0);', '되살릴 자리');
    includes(src, 'if (body) body.scrollTop = backAt;', '스크롤 되돌리기');
  });

  /* =========================================================
   * 2. 프로필 꾸미기 — 소제목 · 하단 문구
   * ========================================================= */
  test('꾸미기 화면: 프레임·배경·아이콘·배지 소제목이 각 묶음 위에 있다', function () {
    var st = stateOf();
    var draft = BM.views.my.decorateDraft(st);
    var body = BM.views.my.decorateBody(draft, st.me, st);

    includes(body, 'data-sub="frame"', '프레임 소제목');
    includes(body, 'data-sub="bg"', '배경 소제목');
    includes(body, 'data-sub="emoji"', '아이콘 소제목');
    includes(body, 'data-sub="badge"', '배지 소제목');
    includes(body, '>프레임</p>', '프레임 글자');
    includes(body, '>배경</p>', '배경 글자');
    includes(body, '>아이콘</p>', '아이콘 글자');
    includes(body, '>배지</p>', '배지 글자');

    /* 순서: 프레임 → 배경 → 아이콘 → 배지 */
    var order = ['frame', 'bg', 'emoji', 'badge'].map(function (k) {
      return body.indexOf('data-sub="' + k + '"');
    });
    ok(order[0] < order[1] && order[1] < order[2] && order[2] < order[3], '소제목 순서');

    /* 소제목은 자기 묶음 바로 위에 (앞 묶음 버튼보다 뒤) */
    ok(body.indexOf('data-dframe="gold"') < order[1], '프레임 버튼은 배경 소제목보다 앞');
    ok(order[1] < body.indexOf('data-dbg='), '배경 소제목이 배경 버튼 위');
    ok(order[2] < body.indexOf('data-demoji='), '아이콘 소제목이 아이콘 버튼 위');
    ok(order[3] < body.indexOf('data-dbadge='), '배지 소제목이 배지 버튼 위');
  });

  test('꾸미기 화면: 개발자 문구 대신 한 줄 안내', function () {
    var st = stateOf();
    var draft = BM.views.my.decorateDraft(st);
    var body = BM.views.my.decorateBody(draft, st.me, st);

    includes(body, '저장하면 MY 카드와 1:1 매칭 프로필에 바로 반영돼요.', '한 줄 안내');
    excludes(body, '26칸', '개발자 문구(칸 수) 없음');
    excludes(body, 'JSON', '개발자 문구(JSON) 없음');
    excludes(body, '새 칸을 만들지 않고', '개발자 문구(스키마) 없음');
    /* 안내는 저장 버튼 아래에 */
    ok(body.indexOf('data-act="deco-save"') < body.indexOf('바로 반영돼요'), '저장 버튼 아래');
  });

  test('꾸미기 스타일: 소제목 규칙이 한 벌 있고 앱 배선에 들어 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.deco__sub {', '소제목 규칙');
    includes(css, '.deco__sub::before', '소제목 표시');
    eq((css.match(/^\.deco__sub \{/gm) || []).length, 1, '규칙 한 벌');
  });

  /* =========================================================
   * 3. 체육관 지도 — 내 집에서 가까운 순
   * ========================================================= */
  test('지도: 내 집을 정하면 목록이 내 집에서 가까운 순으로 선다', function () {
    resetHomes();
    var home = { name: '내 집', label: '양재', lat: 37.4825, lng: 127.0339, demo: false };
    var html = BM.views.gyms.render({ scope: 'demo_me', home: home, now: SAT });

    var near = G().nearby(G().all(), home);
    var first = (html.match(/data-gym-card="([^"]+)"/) || [])[1];
    eq(first, near[0].id, '가장 가까운 곳이 첫 카드');
    ok(G().all()[0].id !== near[0].id, '등록 순서와 다르다(의미 있는 검사)');

    /* 카드 순서가 거리 오름차순 */
    var ids = [];
    var re = /data-gym-card="([^"]+)"/g, m;
    while ((m = re.exec(html))) ids.push(m[1]);
    eq(ids.length, G().count(), '모든 체육관이 카드로');
    var dist = {};
    near.forEach(function (v) { dist[v.id] = v.dist; });
    for (var i = 1; i < ids.length; i++) {
      ok(dist[ids[i]] >= dist[ids[i - 1]], '거리 오름차순: ' + ids[i]);
    }

    /* 카드마다 거리 표시 · 지도 안내도 정렬 이유를 말한다 */
    eq((html.match(/class="gymcard__dist"/g) || []).length, G().count(), '카드마다 거리');
    includes(html, '가까운 순', '지도 안내');
    includes(html, '내 집 반경 5km', '내 집 기준 안내');
  });

  test('지도: 예시 기준점만 있을 때는 기존 순서(등록 순)를 그대로 둔다', function () {
    resetHomes();
    N().resetHome('demo_me');                 /* 망원동 예시 */
    var html = BM.views.gyms.render({ scope: 'demo_me', now: SAT });
    var first = (html.match(/data-gym-card="([^"]+)"/) || [])[1];
    eq(first, G().all()[0].id, '등록 순 첫 체육관');
    eq((html.match(/class="gymcard__dist"/g) || []).length, 0, '거리 칩 없음');
    includes(html, '반경 5km', '내 집 반경 안내는 그대로');
  });

  test('지도: 내 위치 기준이 켜져 있으면 내 위치 거리가 먼저다', function () {
    resetHomes();
    var home = { name: '내 집', label: '양재', lat: 37.4825, lng: 127.0339, demo: false };
    var geo = { lat: 37.5642, lng: 126.9045 };      /* 망원동 쪽 내 위치 */
    var html = BM.views.gyms.render({ scope: 'demo_me', home: home, geo: geo, now: SAT });
    var first = (html.match(/data-gym-card="([^"]+)"/) || [])[1];
    eq(first, G().nearby(G().all(), geo)[0].id, '내 위치에서 가장 가까운 곳');
    includes(html, '내 위치에서 가까운 순', '내 위치 기준 안내');
  });

  test('지도: 권역·검색으로 좁혀도 그 안에서 가까운 순', function () {
    resetHomes();
    var home = { name: '내 집', label: '영통', lat: 37.2644, lng: 127.0852, demo: false };
    var html = BM.views.gyms.render({ scope: 'demo_me', home: home, region: 'gg', now: SAT });
    var first = (html.match(/data-gym-card="([^"]+)"/) || [])[1];
    eq(first, 'yeongtong', '영통에서 가장 가까운 곳이 첫 카드');
    eq((html.match(/data-gym-card="/g) || []).length, G().filter(G().all(), { region: 'gg' }).length, '권역 안만');
  });

  test('배선: 이 테스트가 node 실행 목록에 있다', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/ux-polish.test.js', 'run.js 목록');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
