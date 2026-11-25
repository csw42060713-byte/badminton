/* ============================================================
 * test/v155.test.js — bm-v1.55.0
 *   🧹 일지·시트 정리 + 신고·차단 (구글 Play UGC 심사 요건)
 *
 *  사용자가 요청·승인한 세 가지를 그대로 검증합니다.
 *   1) 일지: 메모·영상 링크가 '메모 · 영상' 접기로 기본 닫힘
 *      · 값이 있으면(수정·점수판·영상 자세 비교) 저절로 열림
 *      · 저장·수정·점수판 자동 채움의 칸 이름(data-field)은 그대로
 *   2) MY: 일반 사용자에게 구글 시트 연결·JSON 백업·Client ID를 숨기고 '고급' 접기로
 *      · 관리자·이미 시트로 쓰는 계정은 예전처럼 바로 보임 (내부 sheets 브리지 그대로)
 *   3) 커뮤니티 글·답글·1:1 대화의 신고·차단
 *      · 신고 = 사유 4종 중 하나 + 한 줄(선택) → '신고' 한 줄로 저장
 *      · 차단 = 확인 한 번 뒤 '차단' 한 줄 → 그 사람 글·답글·매칭·1:1 대화가 바로 사라짐
 *      · MY에서 차단 해제
 *   4) 보안(CSP·이스케이프·칸 26개 그대로) · 버전(sw·app·TWA·styles.css)
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

  var ME = BM.seed.ME;         /* demo_me */
  var OTHER = 'demo_chi';      /* 예시 데이터의 다른 사람 (콕집사) */
  var OTHER2 = 'demo_foot';    /* 발놀림장인 */

  function LOG() { return BM.views.log; }
  function MY() { return BM.views.my; }
  function COM() { return BM.views.community; }
  function CHAT() { return BM.views.chat; }
  function SAFE() { return BM.safety; }

  function draft(patch) {
    var d = {
      date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], gameMode: 21,
      games: [{ a: '', b: '' }], score: null, result: '', pain: [], weakness: [],
      note: '', partner: '', rival: '', video: '', videoNote: '', pro: {}
    };
    Object.keys(patch || {}).forEach(function (k) { d[k] = patch[k]; });
    return d;
  }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: rows,
      data: BM.store.derive(rows, ME),
      drafts: { log: draft(patch && patch.draft) },
      ui: {
        tab: 'log', matchFilter: {}, chatRoom: null, chatOther: '', editLogId: null,
        composerTopic: '자유', composerMeet: {}
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }, prefs: {}, realtime: 'off',
      routine: {}, routinePref: null, proPref: null
    };
    Object.keys(patch || {}).forEach(function (k) { if (k !== 'draft') st[k] = patch[k]; });
    return st;
  }

  function freshStore() {
    try { root.localStorage && root.localStorage.clear && root.localStorage.clear(); } catch (e) { /* 무시 */ }
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* 내가 아닌 글 하나 (예시 데이터: 'demo_chi' 글) */
  function othersPost(state) {
    return (state.data.posts || []).filter(function (p) { return String(p.userKey) !== String(ME); })[0] || null;
  }

  /* =========================================================
   * 1. 일지 — 메모·영상 접기 (기본 닫힘 · 값이 있으면 열림)
   * ========================================================= */

  test('v1.55 일지: 메모·영상 칸이 "메모 · 영상" 접기 안에 있고 기본은 닫혀 있다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var html = LOG().render(stateOf());
    includes(html, '<details class="fold fold--detail" data-fold="detail"', '세부 기록 접기');
    var at = html.indexOf('data-fold="detail"');
    var openTag = html.slice(at, html.indexOf('>', at) + 1);
    excludes(openTag, 'open', '기본은 닫힘');
    includes(html, 'data-field="note"', '메모 칸은 접기 안에 그대로');
    includes(html, 'data-field="video"', '영상 링크 칸은 접기 안에 그대로');
    includes(html, 'data-video-hint', '영상 안내 한 줄도 그대로');
    /* 핵심 기록은 접지 않습니다 */
    includes(html, 'data-field="cond"', '컨디션');
    includes(html, 'data-field="minutes"', '운동 시간');
    includes(html, 'data-chipgroup="pain"', '아픈 부위');
    includes(html, 'data-chipgroup="weakness"', '약점 기술');
  });

  test('v1.55 일지: 메모·영상에 값이 있으면(수정·자동 채움) 저절로 펼쳐진다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var withNote = LOG().render(stateOf(null, { draft: { note: '스매시 손목 각도' } }));
    var nAt = withNote.indexOf('data-fold="detail"');
    includes(withNote.slice(nAt, withNote.indexOf('>', nAt) + 1), 'open', '메모가 있으면 펼침');
    includes(withNote, '메모 있음', '요약에 메모');

    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var withVideo = LOG().render(stateOf(null, { draft: { video: 'https://youtu.be/abc123' } }));
    var vAt = withVideo.indexOf('data-fold="detail"');
    includes(withVideo.slice(vAt, withVideo.indexOf('>', vAt) + 1), 'open', '영상이 있으면 펼침');
    includes(withVideo, '영상 있음', '요약에 영상');
  });

  test('v1.55 일지: 지난 일지를 고칠 때도 메모·영상이 접힌 채 숨지 않는다', function () {
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var rec = {
      id: 'r1', type: '기록', userKey: ME, nick: '나래', date: U.ymd(), cond: 7,
      games: [{ a: '21', b: '17' }], result: '승',
      team: D.logExtraJson({ partner: '민호', rival: '지호', video: { url: 'https://youtu.be/x1', label: '손목' } }),
      text: '오늘은 드라이브가 좋았다'
    };
    var d = D.recordDraft(rec);
    eq(d.video, 'https://youtu.be/x1', '영상 링크가 초안으로');
    var html = LOG().render(stateOf([rec], { draft: d }));
    var at = html.indexOf('data-fold="detail"');
    includes(html.slice(at, html.indexOf('>', at) + 1), 'open', '수정 화면은 펼침');
    includes(html, '오늘은 드라이브가 좋았다', '메모 값 유지');
  });

  test('v1.55 일지: 게임 점수 접기·점수판 자동 채움 연동은 그대로', function () {
    var html = LOG().render(stateOf());
    includes(html, 'data-fold="games"', '게임 점수 접기 유지');
    includes(html, 'data-act="open-scoreboard"', '코트 점수판 입구 유지');
    /* 점수판의 초안 패치 → 메모가 채워지면 접기가 열린다 (v1.30·v1.54 연동) */
    var sb = BM.scoreboard.create({ partner: '민호', rival: '지호' });
    for (var i = 0; i < 21; i++) sb = BM.scoreboard.point(sb, 'a');
    var patch = BM.scoreboard.draftPatch(sb, draft());
    ok(patch && patch.games && patch.games.length, '점수판이 점수를 초안으로');
    eq(patch.partner, '민호', '파트너 이름도 함께');
    ok(String(patch.note || '').trim().length > 0, '메모도 함께');
    LOG()._resetDetailFold && LOG()._resetDetailFold();
    var after = LOG().render(stateOf(null, { draft: draft(patch) }));
    var at = after.indexOf('data-fold="detail"');
    includes(after.slice(at, after.indexOf('>', at) + 1), 'open', '점수판 메모가 채워지면 펼침');
    includes(after, '메모 있음', '요약에 메모');
  });

  test('v1.55 일지: 세부 기록 문구는 쉬운 말, 새 시트 칸 없음', function () {
    var html = LOG().render(stateOf());
    includes(html, '메모 · 영상', '이름표');
    includes(html, '선택', '선택 입력이라고 알려 줌');
    eq(D.COLS.length, 26, '시트 26칸 그대로');
  });

  /* =========================================================
   * 2. MY — 구글 시트 연결 UI 숨김/접힘
   * ========================================================= */

  function myState(patch) {
    var st = {
      mode: 'supabase', me: { key: ME, nick: '나래' }, prefs: {}, realtime: 'live',
      lastSync: '2026-11-22 20:00:00', syncState: 'idle', queue: [],
      data: { isAdmin: false, blocks: [] }
    };
    Object.keys(patch || {}).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  test('v1.55 MY: 일반 사용자 화면에서는 시트 연결·JSON 백업·Client ID가 "고급" 접기 안에 있다', function () {
    var html = MY().dataPanel(myState());
    var fold = html.indexOf('data-adv="sheets"');
    var connect = html.indexOf('data-act="connect"');
    var exp = html.indexOf('data-act="export"');
    var cid = html.indexOf('data-cid');
    ok(fold > -1, '"고급" 접기가 있다');
    ok(connect > fold, '시트 연결 버튼은 접기 뒤에');
    ok(exp > fold, 'JSON 내보내기는 접기 뒤에');
    ok(cid > fold, 'Client ID 칸도 접기 뒤에');
    includes(html, '기록은 자동으로 저장돼요', '자동 저장 안내');
    includes(html, '고급 · 시트 연결 · JSON 백업', '접기 이름표');
    /* 접기는 기본 닫힘 — <details ...> 에 open 이 없습니다 */
    var tag = html.slice(html.lastIndexOf('<details', fold), html.indexOf('>', fold) + 1);
    excludes(tag, 'open', '기본은 닫힘');
  });

  test('v1.55 MY: 관리자·시트 사용 계정은 예전처럼 바로 보인다 (내부 브리지 그대로)', function () {
    var admin = MY().dataPanel(myState({ data: { isAdmin: true, blocks: [] } }));
    eq(admin.indexOf('data-adv="sheets"'), -1, '관리자는 접지 않음');
    ok(admin.indexOf('data-act="connect"') > -1, '관리자는 시트 연결 버튼이 바로');

    var sheets = MY().dataPanel(myState({ mode: 'sheets', realtime: 'off' }));
    eq(sheets.indexOf('data-adv="sheets"'), -1, '시트 계정도 접지 않음');
    includes(sheets, '출력결과', '시트 모드 안내 그대로');
  });

  test('v1.55 MY: 탭 이름도 "데이터 · 자동 저장"으로 바뀌어 시트를 연결해야 하는지 헷갈리지 않는다', function () {
    var src = readRoot('js/views/my.js');
    includes(src, "'데이터 · 자동 저장'", '일반 사용자 묶음 이름');
    includes(src, "'자동 저장 · 고급'", '묶음 요약');
    includes(src, "'데이터 연결'", '관리자·시트 계정 이름은 그대로');
  });

  test('v1.55 MY: 차단한 사람 목록과 해제 버튼', function () {
    var empty = MY().blockPanel(myState());
    includes(empty, '차단한 사람이 없어요', '비었을 때 안내');
    var list = MY().blockPanel(myState({
      data: { isAdmin: false, blocks: [{ id: 'b1', key: OTHER, nick: '콕집사', at: '2026-11-22 10:00:00' }] }
    }));
    includes(list, 'data-block-row="' + OTHER + '"', '차단한 사람 한 줄');
    includes(list, 'data-unblock="' + OTHER + '"', '해제 버튼');
    includes(list, '콕집사', '이름');
  });

  /* =========================================================
   * 3. 신고 — 사유 4종 · 저장 · 안내
   * ========================================================= */

  test('v1.55 신고: 사유는 정해진 4종만 (욕설·광고·부적절한 만남·기타)', function () {
    eq(D.REPORT_REASONS.length, 4, '사유 4종');
    eq(D.reportLabel('욕설'), '욕설·비방', '욕설');
    eq(D.reportLabel('광고'), '광고·도배', '광고');
    eq(D.reportLabel('만남'), '부적절한 만남·내용', '만남');
    eq(D.reportLabel('기타'), '기타', '기타');
    eq(D.reportReason('없는사유'), null, '목록에 없는 사유는 버린다');
  });

  test('v1.55 신고: 다른 사람 글을 신고하면 "신고" 한 줄이 저장된다', function () {
    return freshStore().then(function (store) {
      var st = store.state;
      var post = (st.data.posts || []).filter(function (p) { return String(p.userKey) !== String(ME); })[0];
      ok(post, '신고할 남의 글');
      var res = store.actions.reportContent({
        kind: 'post', targetId: post.id, targetUser: post.userKey,
        reason: '광고', detail: '도배 글이에요', text: post.text
      });
      ok(res && res.ok, '신고 접수');
      eq(res.label, '광고·도배', '사유 이름');
      var rows = store.state.idx.byType['신고'] || [];
      eq(rows.length, 1, '신고 한 줄');
      var rep = rows[0];
      eq(rep.type, '신고', '유형');
      eq(rep.userKey, ME, '내 행(내가 신고)');
      eq(rep.target, post.id, '대상 = 글 ID');
      ok(!!rep.payload, 'JSON으로 사유·대상 종류');
      eq(rep.payload.kind, 'post', '종류');
      eq(rep.payload.reason, '광고', '사유 코드');
      eq(rep.payload.user, post.userKey, '신고한 사람');
      includes(rep.payload.detail, '도배', '한 줄');
      includes(rep.payload.text, String(post.text).slice(0, 10), '신고 당시 내용 앞부분');
      /* 저장 모양도 26칸 그대로 (새 칸 없음) */
      eq(D.toRow({ type: '신고', id: 'x', userKey: ME, target: post.id, payload: rep.payload }).length, D.COLS.length, '26칸');
    });
  });

  test('v1.55 신고: 내 글·내 답글은 신고할 수 없고, 사유가 없으면 접수되지 않는다', function () {
    return freshStore().then(function (store) {
      var mine = (store.state.data.posts || []).filter(function (p) { return String(p.userKey) === String(ME); })[0];
      if (mine) {
        var r1 = store.actions.reportContent({ kind: 'post', targetId: mine.id, reason: '욕설' });
        ok(!r1.ok, '내 글은 신고 불가');
        eq(r1.reason, 'mine', '이유: 내 글');
      }
      var post = (store.state.data.posts || []).filter(function (p) { return String(p.userKey) !== String(ME); })[0];
      var r2 = store.actions.reportContent({ kind: 'post', targetId: post.id, reason: '' });
      ok(!r2.ok, '사유 없으면 접수 안 됨');
      eq(r2.reason, 'no_reason', '이유: 사유 없음');
      var r3 = store.actions.reportContent({ kind: 'post', targetId: 'nope', reason: '욕설' });
      eq(r3.reason, 'not_found', '없는 글');
      eq((store.state.idx.byType['신고'] || []).length, 0, '잘못된 신고는 남지 않음');
    });
  });

  test('v1.55 신고: 시트는 사유를 고르고 한 줄을 적는 화면 (전부 이스케이프)', function () {
    var html = SAFE().reportBody({
      kind: 'post', targetId: 'p1', targetUser: OTHER, nick: '<img src=x onerror=alert(1)>',
      text: '같이 <b>만나요</b>'
    });
    includes(html, 'data-report-reason="욕설"', '사유 칩');
    includes(html, 'data-report-detail', '한 줄 칸');
    includes(html, 'data-report-send', '보내기');
    includes(html, '신고는 운영자에게만 전달돼요', '안내 문구');
    excludes(html, '<img src=x', '이름은 이스케이프');
    includes(html, '&lt;img', '이스케이프된 이름');
    excludes(html, '<b>만나요', '본문도 이스케이프');
    eq(SAFE().normalizeTarget({ kind: 'nope' }).kind, 'post', '모르는 종류는 글');
  });

  test('v1.55 신고: 커뮤니티 카드에만 ⋯(신고·차단)가 붙고 내 글에는 붙지 않는다', function () {
    var st = stateOf();
    var html = COM().render(st);
    includes(html, 'data-post-menu=', '다른 사람 글의 ⋯');
    includes(html, 'data-report="1"', '신고 버튼');
    includes(html, 'data-block-ask=', '차단 버튼');
    includes(html, 'data-blockconfirm=', '인라인 확인 줄');
    includes(html, '님을 차단할까요?', '확인 문구');
    /* 내 글 카드에는 신고·차단이 없습니다 */
    var mine = (st.data.posts || []).filter(function (p) { return String(p.userKey) === String(ME); })[0];
    if (mine) {
      var at = html.indexOf('data-post="' + mine.id + '"');
      var end = html.indexOf('</article>', at);
      var card = html.slice(at, end);
      excludes(card, 'data-report', '내 글에는 신고 없음');
      excludes(card, 'data-block-ask', '내 글에는 차단 없음');
      includes(card, 'data-post-del=', '내 글에는 삭제만');
    }
  });

  test('v1.55 신고: 답글에도 ⋯(신고·차단)가 붙는다', function () {
    var st = stateOf();
    var post = (st.data.posts || []).filter(function (p) { return (p.replies || []).length; })[0];
    ok(post, '답글이 있는 글');
    COM()._openReplies[post.id] = true;
    var html = COM().render(st);
    includes(html, 'data-reply-menu=', '답글 ⋯');
    includes(html, 'data-reply="' + post.replies[0].id + '"', '답글 한 줄');
    COM()._openReplies[post.id] = false;
  });

  /* =========================================================
   * 4. 차단 — 저장 · 즉시 숨김 · 해제
   * ========================================================= */

  test('v1.55 차단: 한 줄만 남고, 같은 사람을 두 번 눌러도 한 줄이다', function () {
    return freshStore().then(function (store) {
      var r1 = store.actions.blockUser(OTHER);
      eq(r1.nick, '콕집사', '이름');
      eq((store.state.idx.byType['차단'] || []).length, 1, '차단 한 줄');
      var r2 = store.actions.blockUser(OTHER);
      ok(r2.ok && r2.already, '이미 차단');
      eq((store.state.idx.byType['차단'] || []).length, 1, '중복 저장 없음');
      var r3 = store.actions.blockUser(ME);
      eq(r3.reason, 'mine', '나 자신은 차단 불가');
      var row = (store.state.idx.byType['차단'] || [])[0];
      eq(row.userKey, ME, '내 행');
      eq(row.target, OTHER, '대상 = 사람 키');
      eq(D.toRow({ type: '차단', id: 'x', userKey: ME, target: OTHER }).length, D.COLS.length, '26칸 그대로');
    });
  });

  test('v1.55 차단: 차단한 사람의 글·답글·매칭·1:1 대화가 곧바로 사라진다', function () {
    var rows = BM.fixtures.demo();
    var before = BM.store.derive(rows, ME);
    var theirPost = (before.posts || []).filter(function (p) { return String(p.userKey) === String(OTHER); })[0];
    var theirProfile = (before.matchProfiles || []).filter(function (m) { return String(m.userKey) === String(OTHER); })[0];
    var theirReply = null;
    (before.posts || []).forEach(function (p) {
      (p.replies || []).forEach(function (r) { if (!theirReply && String(r.userKey) === String(OTHER)) theirReply = r; });
    });
    var theirRoom = (before.rooms || []).filter(function (r) { return String(r.other) === String(OTHER); })[0];
    ok(theirPost, '차단 전: 그 사람 글');
    ok(theirProfile, '차단 전: 매칭 카드');

    rows = rows.concat([D.toRow({ id: 'blk1', type: '차단', createdAt: U.stamp(), userKey: ME, target: OTHER })]);
    var after = BM.store.derive(rows, ME);
    eq((after.posts || []).filter(function (p) { return String(p.userKey) === String(OTHER); }).length, 0, '글 숨김');
    eq((after.matchProfiles || []).filter(function (m) { return String(m.userKey) === String(OTHER); }).length, 0, '매칭 숨김');
    var anyReply = false;
    (after.posts || []).forEach(function (p) {
      (p.replies || []).forEach(function (r) { if (String(r.userKey) === String(OTHER)) anyReply = true; });
    });
    ok(!anyReply, '답글 숨김');
    eq((after.rooms || []).filter(function (r) { return String(r.other) === String(OTHER); }).length, 0, '1:1 방 숨김');
    eq((after.threads || []).filter(function (x) { return String(x.other) === String(OTHER); }).length, 0, '대화 목록 숨김');
    eq(after.blocks.length, 1, '차단 목록에 남음');
    eq(after.blocks[0].key, OTHER, '차단한 사람');
    if (theirReply || theirRoom) ok(true, '차단 전 데이터 확인');
    /* 다른 사람 글은 그대로 */
    ok((after.posts || []).some(function (p) { return String(p.userKey) === String(OTHER2); }), '다른 사람 글은 그대로');
  });

  test('v1.55 차단: 해제하면 다시 보이고 목록에서 빠진다', function () {
    return freshStore().then(function (store) {
      var before = (store.state.data.posts || []).filter(function (p) { return String(p.userKey) === String(OTHER); }).length;
      ok(before > 0, '차단 전 글 있음');
      store.actions.blockUser(OTHER);
      eq((store.state.data.posts || []).filter(function (p) { return String(p.userKey) === String(OTHER); }).length, 0, '차단 중 숨김');
      var off = store.actions.unblockUser(OTHER);
      ok(off && off.ok, '차단 해제');
      eq((store.state.data.blocks || []).length, 0, '차단 목록 비었음');
      eq((store.state.data.posts || []).filter(function (p) { return String(p.userKey) === String(OTHER); }).length, before, '다시 보임');
      eq(store.actions.unblockUser(OTHER).reason, 'not_found', '이미 풀린 사람');
    });
  });

  test('v1.55 차단: 1:1 대화방 상단에 ⋯(신고·차단)가 있고, 차단하면 그 방이 닫힌다', function () {
    return freshStore().then(function (store) {
      var st = store.state;
      var room = (st.data.threads || []).filter(function (x) { return x.kind !== 'group' && x.other; })[0];
      if (room) {
        var view = Object.assign({}, st, {
          ui: Object.assign({}, st.ui, { chatRoom: room.roomId, chatOther: room.other })
        });
        var body = CHAT().roomHtml(view);
        includes(body, 'data-dm-safety="' + room.other + '"', '대화방 ⋯');
        includes(body, 'aria-label="신고·차단"', '접근성 이름');
      }
      var key = room ? room.other : OTHER;
      var other = (st.data.threads || []).filter(function (x) { return x.kind !== 'group' && x.other; })[0];
      if (other) {
        store.actions.openChat(other.roomId, other.other);
        store.actions.blockUser(other.other);
        eq(store.state.ui.chatRoom, null, '차단하면 열린 대화가 닫힘');
        var again = store.actions.openChat(other.roomId, other.other);
        ok(again && again.ok === false, '차단한 사람과는 대화가 열리지 않음');
        eq(again.reason, 'blocked', '이유: 차단');
        store.actions.unblockUser(key);
        ok(store.actions.openChat(other.roomId, other.other).ok, '해제하면 다시 열림');
      }
    });
  });

  test('v1.55 차단: 시트(확인 한 번)와 MY 해제 안내 문구', function () {
    var body = SAFE().blockBody({ kind: 'chat', targetUser: OTHER, nick: '콕집사' });
    includes(body, '콕집사', '이름');
    includes(body, '차단할까요?', '한 번 더 확인');
    includes(body, 'data-block-yes="' + OTHER + '"', '차단 버튼');
    includes(body, 'MY › 차단한 사람에서 언제든 풀 수 있어요', '해제 위치 안내');
    var acts = SAFE().actionsBody({ kind: 'chat', targetUser: OTHER, nick: '콕집사' });
    includes(acts, 'data-safety-report="1"', '신고 입구');
    includes(acts, 'data-safety-block="1"', '차단 입구');
  });

  /* =========================================================
   * 5. 보안 · 배선 · 버전
   * ========================================================= */

  test('v1.55 보안: 새 스크립트는 우리 주소의 파일 하나뿐 (CSP 그대로)', function () {
    if (!hasNode) return;
    var index = readRoot('index.html');
    includes(index, 'js/safety.js', '스크립트 태그');
    includes(index, 'Content-Security-Policy', 'CSP 메타');
    includes(index, "script-src 'self'", '스크립트는 self');
    var csp = index.slice(index.indexOf('Content-Security-Policy'), index.indexOf('>', index.indexOf('Content-Security-Policy')));
    excludes(csp, "'unsafe-eval'", 'eval 금지(wasm-unsafe-eval 만 허용)');
    excludes(csp, "script-src *", '와일드카드 없음');
  });

  test('v1.55 보안: 신고·차단 값은 길이를 자르고 사유는 목록 안으로만', function () {
    var long = new Array(400).join('가');
    var pl = D.reportPayload({ kind: 'reply', reason: '기타', detail: long, text: long, user: OTHER });
    eq(pl.reason, '기타', '사유');
    eq(pl.detail.length, D.REPORT_NOTE_MAX, '한 줄 길이 제한');
    eq(pl.text.length, D.REPORT_TEXT_MAX, '원문 길이 제한');
    eq(pl.kind, 'reply', '종류');
    eq(D.reportPayload({ kind: 'post', reason: '이상한값' }).reason, '기타', '모르는 사유는 기타로');
    eq(D.reportPayload({ kind: 'x' }).kind, 'post', '모르는 종류는 글');
  });

  test('v1.55 배선: sw.js 캐시·테스트 목록에 새 파일이 들어 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "'./js/safety.js'", 'sw.js 캐시');
    includes(sw, "'./js/pose.js'", '기존 파일 그대로');
    includes(sw, "'./js/views/my.js'", '기존 파일 그대로');
    var run = readRoot('test/run.js');
    includes(run, 'js/safety.js', '테스트 로드');
    includes(run, 'test/v155.test.js', '이 테스트 파일');
  });

  test('v1.55 버전: sw · app · index · TWA가 함께 bm-v1.74.0', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js'), app = readRoot('app.js'), index = readRoot('index.html');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    includes(sw, "var VERSION = 'bm-v1.77.0'", 'sw.js');
    includes(app, "version: 'v1.77.0'", 'app.js');
    includes(index, 'styles.css?v=20261125-6', 'styles.css 캐시 키');
    eq(twa.appVersionName, '1.77.0', 'TWA 이름');
    eq(twa.appVersion, '1.77.0', 'TWA 버전');
    eq(twa.appVersionCode, 71, 'TWA 코드');
  });

  test('v1.55 스타일: 신고·차단·세부 기록 접기 스타일이 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    includes(css, '.safetybar', '신고·차단 줄');
    includes(css, '.safety__chip', '사유 칩');
    includes(css, '.blocklist', '차단한 사람 목록');
    includes(css, '.fold--detail', '세부 기록 접기');
    includes(css, '.post__more', '⋯ 버튼');
    includes(css, '.dmhead__more', '대화방 ⋯');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
