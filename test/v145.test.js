/* ============================================================
 * test/v145.test.js — bm-v1.45.0 개인 멘토 · 체육관/선수 코치 소속 증명
 *
 *  1) 멘토 구분 — 개인 멘토 · 체육관 코치 · 선수 코치 · 클럽 운영,
 *     예전 값('선수 멘토'·'코치'·'동호인 멘토')은 그대로 읽고 그대로 보여 줍니다
 *  2) 활동 소속(affiliation) · 증명(글/링크/사진) — 정리·검증 규칙
 *  3) 신청 검증 — 체육관 코치·선수 코치는 소속과 증명이 없으면 접수되지 않는다
 *  4) 심사 — 승인해도 소속·증명이 남고, 관리자 화면에서 한눈에 보인다
 *  5) 화면 — 신청 폼 · 내 멘토 상태 · 코치 카드 · MY 배지
 *  6) 체육관 이름 추천(BM.gyms) · 보안 · 버전
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

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  var PHOTO = 'data:image/jpeg;base64,' + new Array(60).join('A');   /* 60자짜리 가짜 증빙 사진 */
  var APPLICANT = { key: 'u_coach_new', nick: '코치지망생', level: 'B조', discipline: '복식', theme: { theme: 'th_night' } };

  function rowsWith(extra) {
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(D.toRow(e)); });
    return rows;
  }

  function localStore(opts) {
    opts = opts || {};
    clearStorage();
    U.writeJSON('bm_rows_v1', opts.rows || rowsWith());
    var api = BM.api.createLocal({
      latency: 0, meKey: opts.meKey || APPLICANT.key,
      me: opts.me || { nick: APPLICANT.nick, level: APPLICANT.level, discipline: APPLICANT.discipline }
    });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function adminStore(rows) {
    return localStore({
      rows: rows || rowsWith(),
      meKey: 'csw42060713@gmail.com',
      me: { nick: '승우', email: 'csw42060713@gmail.com' }
    });
  }

  /* 신청 한 줄(엔티티) — rowsWith 가 D.toRow 로 바꿔 넣습니다 */
  function appRow(opts) {
    opts = opts || {};
    var payload = {
      type: opts.type || '체육관 코치', affiliation: opts.affiliation, experience: '7년',
      awards: '시 대회 3위', proof: opts.proof || '', proofUrl: opts.proofUrl || '',
      proofPhoto: opts.proofPhoto || '', reason: opts.reason || '초보 스매시를 봐드릴 수 있어요',
      status: opts.status || '심사중', submitted: opts.submitted || U.stamp(),
      level: 'B조', discipline: '복식'
    };
    return {
      id: opts.id || 'mentor-145', type: '멘토신청', createdAt: opts.createdAt || U.stamp(),
      date: U.ymd(), nick: opts.nick || APPLICANT.nick, userKey: opts.userKey || APPLICANT.key,
      target: D.ADMIN_TARGET, payload: payload, status: opts.status || '심사중'
    };
  }

  function appOf(store, id) {
    return (store.state.data.idx.byType['멘토신청'] || []).concat(store.state.data.idx.byType['코치신청'] || [])
      .filter(function (a) { return String(a.id) === String(id); })[0];
  }

  /* =========================================================
   * 1. 멘토 구분과 예전 데이터 호환
   * ========================================================= */
  test('v1.45 멘토 구분: 개인 멘토 · 체육관 코치 · 선수 코치 · 클럽 운영', function () {
    eq(D.MENTOR_TYPES.length, 4, '네 가지');
    ['개인 멘토', '체육관 코치', '선수 코치', '클럽 운영'].forEach(function (t2) {
      ok(D.MENTOR_TYPES.indexOf(t2) >= 0, t2 + ' 포함');
    });
    eq(D.mentorNeedsProof('체육관 코치'), true, '체육관 코치는 소속·증명 필요');
    eq(D.mentorNeedsProof('선수 코치'), true, '선수 코치는 소속·증명 필요');
    eq(D.mentorNeedsProof('개인 멘토'), false, '개인 멘토는 선택');
    eq(D.mentorNeedsProof('클럽 운영'), false, '클럽 운영은 선택');
  });

  test('v1.45 예전 값: 선수 멘토·코치·동호인 멘토는 그대로 읽고 그대로 보여 준다', function () {
    eq(D.mentorTypeOf('선수 멘토'), '선수 멘토', '예전 이름 유지');
    eq(D.mentorTypeOf('코치'), '코치', '예전 이름 유지');
    eq(D.mentorTypeOf('동호인 멘토'), '동호인 멘토', '예전 이름 유지');
    eq(D.mentorTypeOf(''), '개인 멘토', '빈 값은 개인 멘토');
    eq(D.mentorTypeOf(null), '개인 멘토', '없는 값도 개인 멘토');
    /* 예전 신청(픽스처의 '동호인 멘토')도 같은 자리에서 읽힌다 */
    var rows = rowsWith();
    var st = { ready: true, me: { key: 'demo_me', nick: '나래' }, data: BM.store.derive(rows, 'demo_me') };
    var apps = D.mentorApplications(st.data.idx, 'demo_me', true);
    var legacy = apps.filter(function (a) { return a.nick === '네트앞여우'; })[0];
    ok(legacy, '예전 신청이 읽힌다');
    eq(legacy.mentorType, '동호인 멘토', '예전 구분 그대로');
    eq(legacy.affiliation, '', '소속은 비어 있다');
    eq(legacy.proof, '나래울 클럽 코치 활동 2년', '예전 증빙 글 유지');
    eq(legacy.proofed, true, '증빙 글이 있으면 증명됨');
  });

  /* =========================================================
   * 2. 소속·증명 정리 규칙
   * ========================================================= */
  test('v1.45 소속: 앞뒤 공백·줄바꿈을 정리하고 40자에서 자른다', function () {
    eq(D.cleanAffiliation('  나래울  배드민턴장 \n'), '나래울 배드민턴장', '공백 정리');
    eq(D.cleanAffiliation('가'.repeat(80)).length, 40, '40자 상한');
    eq(D.cleanAffiliation(null), '', '빈 값');
  });

  test('v1.45 증명 링크: http/https만 남고 javascript:·data:text/html은 버린다', function () {
    eq(D.cleanProofUrl('https://cafe.naver.com/gym/123'), 'https://cafe.naver.com/gym/123', 'https 통과');
    eq(D.cleanProofUrl('http://gym.example.com/notice'), 'http://gym.example.com/notice', 'http 통과');
    eq(D.cleanProofUrl('javascript:alert(1)'), '', 'javascript 차단');
    eq(D.cleanProofUrl('data:text/html;base64,PHNjcmlwdD4='), '', 'data:text/html 차단');
    eq(D.cleanProofUrl('https://gym.example.com/a b'), '', '공백 섞인 주소 차단');
    eq(D.cleanProofUrl('가'.repeat(400)), '', '너무 긴 주소 차단');
  });

  test('v1.45 증명 사진: data:image(jpeg·png·webp)만, 48,000자까지', function () {
    ok(D.cleanProofPhoto(PHOTO).indexOf('data:image/jpeg;base64,') === 0, 'jpeg 통과');
    ok(D.cleanProofPhoto('data:image/png;base64,AAAA').length > 0, 'png 통과');
    eq(D.cleanProofPhoto('data:text/html;base64,PHNjcmlwdD4='), '', 'html 차단');
    eq(D.cleanProofPhoto('https://gym.example.com/coach.png'), '', '외부 주소는 사진으로 받지 않음');
    eq(D.cleanProofPhoto('data:image/jpeg;base64,' + 'A'.repeat(D.MENTOR.photoMax)), '', '상한 넘으면 버린다');
  });

  test('v1.45 증명 있음/없음: 글·링크·사진 중 하나면 증명됨', function () {
    eq(D.mentorProofOf({}).any, false, '아무것도 없으면');
    eq(D.mentorProofOf({ proof: '위촉 2026-03' }).any, true, '글');
    eq(D.mentorProofOf({ proofUrl: 'https://a.example.com/x' }).any, true, '링크');
    eq(D.mentorProofOf({ proofPhoto: PHOTO }).any, true, '사진');
    var badge = D.mentorBadgeOf({ type: '선수 코치', affiliation: '나래울 배드민턴장', proof: '재직 확인' });
    eq(badge.type, '선수 코치', '구분');
    eq(badge.affiliation, '나래울 배드민턴장', '소속');
    eq(badge.proofed, true, '증명됨');
    /* 승인 + 증명일 때만 '활동 증명됨' */
    eq(D.mentorAffiliationLine({ status: '승인', affiliation: '나래울', proofed: true }), '나래울 · 활동 증명됨', '승인+증명');
    eq(D.mentorAffiliationLine({ status: '심사중', affiliation: '나래울', proofed: true }), '나래울', '심사중에는 안 붙음');
    eq(D.mentorAffiliationLine({ status: '승인', affiliation: '', proofed: false }), '', '둘 다 없으면 빈 줄');
  });

  /* =========================================================
   * 3. 신청 검증 — store
   * ========================================================= */
  test('v1.45 신청: 체육관 코치는 소속이 없으면 접수되지 않는다', function () {
    return localStore().then(function (store) {
      var res = store.actions.requestMentor({
        type: '체육관 코치', reason: '주 3회 코치합니다', proof: '위촉 확인'
      });
      eq(res.ok, false, '접수 거절');
      eq(res.reason, 'need_affiliation', '소속 필요');
      eq((store.state.data.idx.byType['멘토신청'] || []).length, 0, '행이 생기지 않음');
    });
  });

  test('v1.45 신청: 선수 코치는 소속만 있고 증명이 없으면 접수되지 않는다', function () {
    return localStore().then(function (store) {
      var res = store.actions.requestMentor({
        type: '선수 코치', affiliation: '매원고 배드민턴부', reason: '학교 팀 코치입니다'
      });
      eq(res.ok, false, '접수 거절');
      eq(res.reason, 'need_proof', '증명 필요');
      store.state.locks = {};
      var res2 = store.actions.requestMentor({
        type: '선수 코치', affiliation: '매원고 배드민턴부', reason: '학교 팀 코치입니다',
        proofUrl: 'javascript:alert(1)'
      });
      eq(res2.reason, 'bad_url', '잘못된 링크는 따로 알려 준다');
      store.state.locks = {};
      var res3 = store.actions.requestMentor({
        type: '선수 코치', affiliation: '매원고 배드민턴부', reason: '학교 팀 코치입니다',
        proofPhoto: 'data:text/html;base64,PHNjcmlwdD4='
      });
      eq(res3.reason, 'bad_photo', '사진도 따로 알려 준다');
    });
  });

  test('v1.45 신청: 소속 + 증명(사진)이 있으면 접수되고 payload에 남는다', function () {
    return localStore().then(function (store) {
      var res = store.actions.requestMentor({
        type: '체육관 코치', affiliation: '나래울 배드민턴장',
        proofUrl: 'https://gym.example.com/notice/12', proof: '위촉 2026-03',
        proofPhoto: PHOTO, reason: '평일 저녁 성인반을 봅니다', experience: '6년', awards: '생활체육지도자 2급'
      });
      ok(res.ok, '접수');
      var row = (store.state.data.idx.byType['멘토신청'] || [])[0];
      ok(row, '멘토신청 행');
      eq(row.payload.type, '체육관 코치', '구분');
      eq(row.payload.affiliation, '나래울 배드민턴장', '소속');
      eq(row.payload.proofUrl, 'https://gym.example.com/notice/12', '증빙 링크');
      eq(row.payload.proof, '위촉 2026-03', '증빙 글');
      eq(row.payload.proofPhoto, PHOTO, '증빙 사진');
      eq(row.payload.status, '심사중', '심사중');
      /* 화면(내 멘토 신청 카드)에 구분·소속·증명이 나온다 */
      store.state.ui.coachTab = 'apply';
      var html = BM.views.coach.render(store.state);
      includes(html, '체육관 코치', '구분 표시');
      includes(html, '나래울 배드민턴장', '소속 표시');
      includes(html, '증빙 링크', '증빙 링크 표시');
      includes(html, '사진 첨부', '증빙 사진 표시');
    });
  });

  test('v1.45 신청: 개인 멘토·클럽 운영은 소속·증명 없이도 접수된다', function () {
    return localStore().then(function (store) {
      var res = store.actions.requestMentor({ type: '개인 멘토', reason: '개인 레슨 3년 했습니다' });
      ok(res.ok, '개인 멘토 접수');
      eq((store.state.data.idx.byType['멘토신청'] || [])[0].payload.type, '개인 멘토', '구분 저장');
      /* 이미 심사중인 신청이 있으면 두 번째는 막힌다(중복 방지) */
      store.state.locks = {};
      eq(store.actions.requestMentor({ type: '클럽 운영', reason: '두 번째 신청' }).reason, 'pending', '중복 신청 차단');
      return localStore();
    }).then(function (store) {
      /* 구분을 안 보내도 개인 멘토로 접수된다(예전 화면·예전 앱과 호환) */
      var res = store.actions.requestMentor({ reason: '클럽에서 같이 쳐요' });
      ok(res.ok, '구분 없이도 접수');
      eq((store.state.data.idx.byType['멘토신청'] || [])[0].payload.type, '개인 멘토', '기본값은 개인 멘토');
    });
  });

  /* =========================================================
   * 4. 심사 — 관리자 승인 뒤에도 소속·증명 유지
   * ========================================================= */
  test('v1.45 심사: 승인해도 소속·증명이 남고 관리자 화면에서 한눈에 보인다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-a', type: '선수 코치', affiliation: '나래울 배드민턴장',
      proofUrl: 'https://gym.example.com/coach/12', proof: '위촉 2026-03', proofPhoto: PHOTO
    })]);
    return adminStore(rows).then(function (store) {
      store.state.ui.coachTab = 'approve';
      var html = BM.views.coach.render(store.state);
      includes(html, '선수 코치', '구분');
      includes(html, '나래울 배드민턴장', '소속');
      includes(html, '증빙 링크', '증빙 링크');
      includes(html, '사진 첨부', '사진 첨부 표시');
      includes(html, 'data:image/jpeg;base64,', '증빙 사진 그림');
      includes(html, '조건 자세히 보기', '상세 보기 버튼');
      var res = store.actions.decideMentor('mentor-145-a', '승인');
      ok(res.ok, '승인');
      var after = appOf(store, 'mentor-145-a');
      eq(after.status, '승인', '상태 반영');
      eq(after.payload.affiliation, '나래울 배드민턴장', '소속 유지');
      eq(after.payload.proofPhoto, PHOTO, '사진 유지');
      eq(after.payload.type, '선수 코치', '구분 유지');
      /* 승인 뒤 관리자 카드에도 여전히 소속·증명이 보인다 */
      html = BM.views.coach.render(store.state);
      includes(html, '나래울 배드민턴장', '승인 뒤에도 소속');
    });
  });

  /* =========================================================
   * 5. 화면 — 신청 폼 · 코치 카드 · MY
   * ========================================================= */
  test('v1.45 신청 화면: 유형 칩 4개와 소속·증빙(링크·사진) 칸이 있다', function () {
    return localStore().then(function (store) {
      store.state.ui.coachTab = 'apply';
      var html = BM.views.coach.render(store.state);
      ['개인 멘토', '체육관 코치', '선수 코치', '클럽 운영'].forEach(function (label) {
        includes(html, 'data-mtype="' + label + '"', label + ' 칩');
      });
      includes(html, 'data-mentor-field="affiliation"', '소속 입력칸');
      includes(html, 'data-mentor-field="proofUrl"', '증빙 링크칸');
      includes(html, 'data-mentor-field="proof"', '증빙 메모칸');
      includes(html, 'data-act="mentor-photo"', '증빙 사진 버튼');
      includes(html, 'data-aff-sug', '체육관 추천 자리');
      includes(html, 'data-act="mentor-gym"', '체육관 목록에서 고르기');
      includes(html, '어디서 코치하나요?', '소속 질문');
      includes(html, 'data-req-badge', '필수/선택 표시');
      /* 개인 멘토가 기본 — 소속·증명은 '선택' */
      includes(html, 'pill pill--ghost" data-req-badge>선택<', '기본은 선택');
      includes(html, '멘토 신청 보내기', '보내기 버튼');
    });
  });

  test('v1.45 코치 카드: 구분 배지와 "OO체육관 · 활동 증명됨"이 보인다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-b', userKey: 'demo_chi', nick: '콕집사', type: '체육관 코치',
      affiliation: '나래울 배드민턴장', proof: '재직 확인', status: '승인'
    })]);
    return localStore({ rows: rows, meKey: 'demo_me', me: { nick: '나래' } }).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      includes(html, 'data-coach="demo_chi"', '코치 카드');
      includes(html, '체육관 코치', '구분 배지');
      includes(html, '나래울 배드민턴장 · 활동 증명됨', '소속 + 활동 증명됨');
    });
  });

  test('v1.45 코치 카드: 증명이 없는 승인 코치는 소속만 보인다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-c', userKey: 'demo_suttle', nick: '셔틀버스', type: '개인 멘토',
      affiliation: '', proof: '', status: '승인'
    })]);
    return localStore({ rows: rows, meKey: 'demo_me', me: { nick: '나래' } }).then(function (store) {
      store.state.ui.coachTab = 'feedback';
      var html = BM.views.coach.render(store.state);
      includes(html, 'data-coach="demo_suttle"', '코치 카드');
      includes(html, '개인 멘토', '구분 배지');
      excludes(html, '셔틀버스 · 활동 증명됨', '증명 없으면 붙지 않음');
    });
  });

  test('v1.45 내 멘토 상태: 승인되면 소속과 활동 증명됨이 함께 보인다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-d', type: '체육관 코치', affiliation: '나래울 배드민턴장',
      proof: '재직 확인', status: '승인'
    })]);
    return localStore({ rows: rows }).then(function (store) {
      store.state.ui.coachTab = 'apply';
      var html = BM.views.coach.render(store.state);
      includes(html, '내 멘토 신청', '상태 카드');
      includes(html, '활동 유형', '유형 줄');
      includes(html, '활동 소속', '소속 줄');
      includes(html, '나래울 배드민턴장 · 활동 증명됨', '승인 + 증명');
    });
  });

  test('v1.45 MY: 승인된 멘토는 구분 배지와 소속 줄이 붙는다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-e', userKey: 'demo_me', nick: '나래', type: '선수 코치',
      affiliation: '매원고 배드민턴부', proof: '위촉 확인', status: '승인'
    })]);
    return localStore({ rows: rows, meKey: 'demo_me', me: { nick: '나래', level: 'C조' } }).then(function (store) {
      var html = BM.views.my.render(store.state);
      includes(html, '선수 코치', '구분 배지');
      includes(html, 'profile__coachline', '소속 줄');
      includes(html, '매원고 배드민턴부 · 활동 증명됨', '소속 + 증명');
    });
  });

  /* =========================================================
   * 6. 체육관 추천 · 보안 · 버전
   * ========================================================= */
  test('v1.45 체육관 추천: 이름·동네로 찾고 4곳까지, 빈 검색어는 없음', function () {
    eq(D.gymNameSuggestions('', 4).length, 0, '빈 검색어');
    eq(D.gymNameSuggestions('ㅁㄴㅇㄹ', 4).length, 0, '없는 이름');
    var list = D.gymNameSuggestions('나래울', 4);
    ok(list.length >= 1, '나래울 찾기');
    includes(list[0].name, '나래울', '이름에 나래울');
    ok(list[0].id, '체육관 id');
    eq(D.gymNameSuggestions('수원', 4).length, 4, '4곳 상한');
    eq(D.gymNameSuggestions('없는체육관이름', 4).length, 0, '없으면 빈 목록');
  });

  test('v1.45 프로필: 승인된 코치의 구분·소속·증명을 그 사람 기준으로 찾는다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-p', userKey: 'u_prof', nick: '프로필코치', type: '선수 코치',
      affiliation: '매원고 배드민턴부', proof: '위촉 확인', status: '승인'
    })]);
    var st = { ready: true, me: { key: 'demo_me', nick: '나래' }, data: BM.store.derive(rows, 'demo_me') };
    var m = D.approvedMentorOf(st.data.idx, 'u_prof');
    ok(m, '승인된 코치');
    eq(m.type, '선수 코치', '구분');
    eq(m.affiliation, '매원고 배드민턴부', '소속');
    eq(m.line, '매원고 배드민턴부 · 활동 증명됨', '배지 줄');
    eq(D.approvedMentorOf(st.data.idx, 'demo_suttle'), null, '신청이 없으면 없음');
    /* 심사중인 신청만 있으면 배지를 붙이지 않는다 */
    var rows2 = rowsWith([appRow({ id: 'mentor-145-q', userKey: 'u_wait', type: '체육관 코치', affiliation: '나래울', proof: 'x', status: '심사중' })]);
    var st2 = { ready: true, me: { key: 'demo_me' }, data: BM.store.derive(rows2, 'demo_me') };
    eq(D.approvedMentorOf(st2.data.idx, 'u_wait'), null, '심사중은 아직 없음');
    /* 예전 값(동호인 멘토)도 그대로 */
    var legacy = D.approvedMentorOf(st.data.idx, 'demo_net');
    ok(legacy, '예전 승인 신청');
    eq(legacy.type, '동호인 멘토', '예전 구분 유지');
    eq(legacy.proofed, true, '예전 증빙 글도 증명으로 인정');
  });

  test('v1.45 보안: 소속·증명 글자가 HTML로 실행되지 않는다', function () {
    var rows = rowsWith([appRow({
      id: 'mentor-145-x', type: '<img src=x onerror=alert(1)>',
      affiliation: '<script>alert(1)</script>', proof: '<b>굵게</b>',
      proofUrl: 'javascript:alert(1)', status: '승인'
    })]);
    return adminStore(rows).then(function (store) {
      store.state.ui.coachTab = 'approve';
      var html = BM.views.coach.render(store.state);
      excludes(html, '<script>alert(1)</script>', '스크립트가 그대로 나가지 않음');
      excludes(html, 'javascript:alert(1)', 'javascript 주소가 href로 나가지 않음');
      excludes(html, '<img src=x onerror', '태그가 그대로 나가지 않음');
      includes(html, '&lt;script&gt;', '글자로만 보인다');
      /* 관리자 상세 시트도 같은 값으로 그려진다(도메인 단계에서 걸러짐) */
      var app = D.mentorApplications(store.state.data.idx, 'csw42060713@gmail.com', true)
        .filter(function (a) { return a.id === 'mentor-145-x'; })[0];
      eq(app.proofUrl, '', '위험한 링크는 비어 있음');
      eq(app.affiliation, '<script>alert(1)</script>', '글자는 보존(화면에서 이스케이프)');
    });
  });

  test('v1.45 버전: sw · app · index · TWA가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.45.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.45.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261121-57', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.45.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 38', '앱 버전 코드는 그대로');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
