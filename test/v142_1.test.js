/* ============================================================
 * test/v142_1.test.js — bm-v1.43.0 (2026-11-21 밤) 오류·보안 일제 점검
 *
 *  1) 게스트 모집 입구 — 말머리만 '게스트 모집'이고 모집 칸을 비운 글에도
 *     모집 카드와 '참여 문의'(글쓴이는 '단체방 열기') 버튼이 있고, 그 글로 방이 열린다.
 *  2) 화면 주소 안전장치 — http/https(사진은 data:image 만) 밖의 주소는 버린다.
 *  3) 글자 수 상한 — 글·답글·채팅이 화면 maxlength 밖에서도 저장 단계에서 잘린다.
 *  4) CSP — index.html의 보안 정책과 인라인 스크립트 해시가 서로 맞는다.
 *  5) 버전 · 문서 · 비밀값
 *  실행: node test/run.js
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

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1',
      'bm_routine_pref_v1::demo_me', 'bm_pro_pref_v1::demo_me'].forEach(function (k) { U.storage.removeItem(k); });
  }

  function stateWith(rows, meKey) {
    var key = meKey || BM.seed.ME;
    return {
      ready: true, mode: 'local', me: { key: key, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: rows, data: BM.store.derive(rows, key),
      drafts: { log: { date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: [], note: '' } },
      ui: { tab: 'community', composer: '', composerTopic: '자유', composerMeet: {} },
      queue: [], locks: {}, stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function meetPost(opts) {
    opts = opts || {};
    var plan = { topic: '게스트 모집' };
    if (opts.meet !== null) plan.meet = opts.meet || { when: '11/22(토) 19:00', place: '영통 체육관', cap: '4', fee: '5천원' };
    return D.toRow({
      id: opts.id || 'post-meet', type: '소셜', createdAt: opts.at || U.stamp(), date: U.ymd(),
      nick: opts.nick || '모집왕', text: opts.text || '', userKey: opts.userKey || 'u_owner', plan: plan
    });
  }

  /* ---------- 1. 게스트 모집 입구 ---------- */
  test('v1.42.1 게스트 모집: 모집 칸을 비운 글에도 카드와 참여 문의 버튼이 있다', function () {
    var rows = [meetPost({ id: 'pm-empty', meet: null, text: '모집 칸 없이 말머리만 골랐어요' })];
    var st = stateWith(rows);
    var html = BM.views.community.render(st);
    includes(html, 'data-vite-group="pm-empty"', '참여 문의 버튼');
    includes(html, '일시는 문의해서 정해요', '일시 기본 문구');
    includes(html, '장소는 문의해서 정해요', '장소 기본 문구');
    includes(html, 'class="vite', '모집 카드');
  });

  test('v1.42.1 게스트 모집: 비운 칸 글도 글쓴이에게는 단체방 열기로 보인다', function () {
    var rows = [meetPost({ id: 'pm-empty2', meet: null, userKey: BM.seed.ME })];
    var st = stateWith(rows);
    var html = BM.views.community.render(st);
    includes(html, 'data-vite-group="pm-empty2"', '버튼');
    includes(html, D.MEET.openLabel, '단체방 열기');
  });

  test('v1.42.1 게스트 모집: 모집 칸이 없는 글도 방으로 열린다 (openGroupChat)', function () {
    return (function () {
      clearStorage();
      U.writeJSON('bm_rows_v1', [meetPost({ id: 'pm-room', meet: null, userKey: 'u_owner' })]);
      var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
      return store.actions.init().then(function () {
        var idx = store.state.idx;
        ok(D.isGroupRoom(idx, 'pm-room'), '글 ID가 곧 단체방');
        var res = store.actions.openGroupChat('pm-room', '참여하고 싶어요');
        ok(res.ok, '방 열기');
        eq(store.state.ui.chatRoom, 'pm-room', '열린 방');
        ok(store.state.ui.chatOpen, '채팅 패널 열림');
        var html = BM.views.chat.roomHtml(store.state);
        includes(html, '게스트 모집 단체방', '방 제목');
      });
    })();
  });

  test('v1.42.1 게스트 모집: 모집 정보가 있으면 그대로 카드에 나온다', function () {
    var st = stateWith([meetPost({ id: 'pm-full' })]);
    var html = BM.views.community.render(st);
    includes(html, '11/22(토) 19:00', '일시');
    includes(html, '영통 체육관', '장소');
    includes(html, '게스트비 5천원', '게스트비');
    includes(html, 'data-vite-group="pm-full"', '버튼');
  });

  /* ---------- 2. 화면 주소 안전장치 ---------- */
  test('v1.42.1 주소: http/https 만 통과하고 javascript:·data:text/html 은 버린다', function () {
    eq(D.safeLinkUrl('https://youtu.be/abc'), 'https://youtu.be/abc', 'https 통과');
    eq(D.safeLinkUrl('http://example.com/a?b=1'), 'http://example.com/a?b=1', 'http 통과');
    eq(D.safeLinkUrl('javascript:alert(1)'), '', 'javascript 차단');
    eq(D.safeLinkUrl('JaVaScRiPt:alert(1)'), '', '대소문자 섞인 javascript 차단');
    eq(D.safeLinkUrl('data:text/html,<script>alert(1)</script>'), '', 'data:text/html 차단');
    eq(D.safeLinkUrl('vbscript:msgbox(1)'), '', 'vbscript 차단');
    eq(D.safeLinkUrl('https://exa mple.com'), '', '공백 섞인 주소 차단');
    eq(D.safeLinkUrl('https://example.com/"onmouseover="x'), '', '따옴표 섞인 주소 차단');
    eq(D.safeLinkUrl('http://localhost:8080/x'), '', 'localhost 차단');
    eq(D.safeLinkUrl(''), '', '빈 값');
  });

  test('v1.42.1 주소: 프로필 사진은 https 또는 앱이 자른 data:image 만', function () {
    var png = 'data:image/png;base64,iVBORw0KGgo=';
    eq(D.safeImageUrl(png), png, 'data:image 통과');
    eq(D.safeImageUrl('https://lh3.googleusercontent.com/a/x'), 'https://lh3.googleusercontent.com/a/x', 'https 사진');
    eq(D.safeImageUrl('data:text/html,<script>alert(1)</script>'), '', 'data:text/html 차단');
    eq(D.safeImageUrl('javascript:alert(1)'), '', 'javascript 차단');
  });

  test('v1.42.1 주소: MY 계정 카드가 javascript: 사진을 src로 그리지 않는다', function () {
    BM.auth.signInEmailAccount({ email: 'pic@example.com', name: '사진', source: 'local' });
    var s = BM.auth.session();
    s.picture = 'javascript:alert(1)';
    U.writeJSON(BM.auth.SESSION_KEY, s);
    var html = BM.views.my.render(stateWith([], 'u_x'));
    excludes(html, 'javascript:', '계정 사진 javascript 차단');
    BM.auth.signOut();
  });

  /* ---------- 3. 글자 수 상한 ---------- */
  test('v1.42.1 글자 수: 아주 긴 글이 저장 단계에서 잘린다', function () {
    return (function () {
      clearStorage();
      var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
      return store.actions.init().then(function () {
        var long = new Array(1200).join('가');
        var res = store.actions.createPost(long, '자유', null);
        ok(res.ok, '글 올리기');
        var post = store.state.data.posts[0];
        eq(post.text.length, 300, '본문 300자');
        var reply = store.actions.addReply(post.id, long);
        ok(reply.ok, '답글');
        var r = store.state.data.posts[0].replies[0];
        eq(r.text.length, 200, '답글 200자');
        var msg = store.actions.sendChat('room-x', 'demo_chi', long);
        ok(msg.ok || msg.reason === 'not_allowed', '채팅 호출');
        eq(D.clampText(long, 300).length, 300, 'clampText');
        eq(D.clampText('  그대로  ', 300), '  그대로  ', '짧은 글은 그대로');
      });
    })();
  });

  /* ---------- 4. CSP ---------- */
  test('v1.42.1 보안 헤더: CSP·Referrer 메타가 있고 인라인 스크립트 해시가 맞는다', function () {
    if (!hasNode) return;
    var fs = require('fs'), crypto = require('crypto');
    var html = readRoot('index.html');
    var m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    ok(m, 'CSP 메타');
    var csp = m[1];
    includes(csp, "default-src 'self'", 'default-src');
    includes(csp, "object-src 'none'", 'object-src');
    includes(csp, "base-uri 'none'", 'base-uri');
    includes(csp, "form-action 'self'", 'form-action');
    includes(csp, 'https://accounts.google.com', '구글 로그인 허용');
    includes(csp, 'wss://mwgpakntlollndfluwgg.supabase.co', '실시간 연결 허용');
    excludes(csp, "'unsafe-eval'", 'eval 허용 안 함');
    ok(csp.indexOf("script-src 'self'") >= 0 && csp.indexOf("script-src 'self' 'unsafe-inline'") < 0, '인라인 스크립트는 해시로만');
    var hashes = [];
    var re = /<script>([\s\S]*?)<\/script>/g, mm;
    while ((mm = re.exec(html))) {
      var digest = crypto.createHash('sha256').update(mm[1], 'utf8').digest('base64');
      hashes.push('sha256-' + digest);
    }
    eq(hashes.length, 2, '인라인 스크립트 2개');
    hashes.forEach(function (h) { includes(csp, "'" + h + "'", 'CSP 해시 ' + h.slice(0, 16)); });
    includes(html, 'name="referrer" content="strict-origin-when-cross-origin"', 'Referrer-Policy');
  });

  test('v1.42.1 보안: 공개 저장소 파일에 비밀 키가 없다', function () {
    if (!hasNode) return;
    ['js/api.js', 'js/auth.js', 'app.js', 'index.html', 'sw.js'].forEach(function (f) {
      var src = readRoot(f);
      /* 주석에 나오는 말(예: 'service_role 키를 넣지 마세요')은 괜찮고, 진짜 키 모양만 막습니다 */
      excludes(src, 'service_role":', f + ' service_role 키 없음');
      excludes(src, 'service_role\'', f + ' service_role 키 없음');
      excludes(src, 'sb_secret_', f + ' sb_secret 없음');
      excludes(src, 'db_password":', f + ' DB 비밀번호 없음');
      /* 공개되어도 되는 anon 키만: 역할이 anon 인 JWT 만 허용 */
      (src.match(/eyJ[A-Za-z0-9_\-\.]{20,}/g) || []).forEach(function (token) {
        var body = token.split('.')[1] || '';
        var json = '';
        try { var B = require('buffer').Buffer; json = B.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch (e) { json = ''; }
        ok(json.indexOf('"role":"anon"') >= 0, f + ' JWT 는 anon 만');
      });
    });
  });

  /* ---------- 5. 버전 · 문서 ---------- */
  test('v1.42.1 버전: sw · app · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.47.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.47.0'", 'app.js');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.47.0', 'TWA 버전 이름');
    eq(twa.appVersion, '1.47.0', 'TWA appVersion');
    eq(twa.appVersionCode, 39, 'TWA 버전 코드(웹만 바뀌면 그대로)');
  });

  test('v1.42.1 문서: README·아이디어 노트에 이번 사이클이 남는다', function () {
    if (!hasNode) return;
    var readme = readRoot('README.md'), ideas = readRoot('ideas.md');
    includes(readme, 'v1.43.0', 'README 버전 절');
    includes(readme, '게스트 모집', 'README 게스트 모집');
    includes(readme, 'Content-Security-Policy', 'README 보안 장치');
    includes(ideas, 'v1.43.0', '아이디어 노트');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
