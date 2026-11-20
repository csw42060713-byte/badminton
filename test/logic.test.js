/* ============================================================
 * test/logic.test.js — 실제 로직 검증 (시트 호환 · AI · 하트 · 저장 · 화면)
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var U = BM.util, D = BM.domain, AI = BM.ai;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes, near = t.near;

  /* ---------- 도우미 ---------- */
  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }

  function freshStore(opts) {
    clearStorage();
    /* 예전에는 seed.build()가 데모 행을 깔아 줬지만 이제 앱은 빈 상태로 시작합니다.
     * 저장소 동작 검증에는 '행이 있는 상태'가 필요하므로 테스트 픽스처를 직접 깔아 둡니다.
     * opts.empty = true 이면 아무 행도 없는 상태를 씁니다. */
    if (!(opts && opts.empty)) {
      U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    }
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  function freshStoreWith(extra) {
    clearStorage();
    var rows = BM.fixtures.demo();
    (extra || []).forEach(function (e) { rows.push(D.toRow(e)); });
    U.writeJSON('bm_rows_v1', rows);
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  var ME = {
    key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', bio: '소개',
    region: '경기', club: '나래울', theme: { theme: 'th_night', avatar: '🦋' }
  };

  function copyOf(o) { return JSON.parse(JSON.stringify(o)); }

  function stateOf(rows, meKey) {
    rows = rows || BM.fixtures.demo();
    meKey = meKey || BM.seed.ME;
    return {
      ready: true, mode: 'local', me: copyOf(ME), rows: rows,
      data: BM.store.derive(rows, meKey),
      drafts: {
        log: {
          date: U.ymd(), cond: 6, intensity: 6, minutes: 60, done: ['스트록', '게임'],
          score: { a: 21, b: 18 }, result: '승', pain: [], weakness: ['드라이브'], note: ''
        }
      },
      ui: {
        tab: 'log', matchFilter: { level: '전체', region: '전체', discipline: '전체' },
        chatRoom: null, coachTab: 'feedback', coachPlayer: null, composer: '', replyTo: null
      },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
  }

  function rec(offsetDays, extra) {
    var e = {
      date: U.ymd(U.addDays(new Date(), offsetDays)),
      cond: 6, intensity: 6, minutes: 60, done: ['스트록'], score: { a: 21, b: 18 }, result: '승',
      pain: [], weakness: [], level: '일반부'
    };
    Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 50, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'ol', 'li', 'button', 'header', 'footer', 'article', 'form', 'dl', 'p'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  /* 실제 시트에 있던 기록 행 (개인정보 제외, 26칸 그대로) */
  var REAL_ROW = [
    '179222027616658', '기록', '2026-10-17 15:57:56', '2026-10-17', '우승', '초보용', '복식', '',
    '5', '6', '54', '스트록,벽치기,코어', '21:13', '패', '목',
    '{"rehab":["목 주변 근육 긴장 시 20분 온찜질 후 가벼운 움직임","스마트폰·장시간 고개 숙임 자세 줄이기"],"stretch":["어깨 돌리기 10회씩 앞·뒤","햄스트링·종아리 스트레칭 30초×2","고관절 스트레칭 30초×2"],"mental":["좋은 흐름이에요!"]}',
    '드라이브', '', '', '', '', '', '', '', '', '', '', ''
  ];

  /* ================= 1. 시트 호환 ================= */
  test('시트 26칸: 실제 행을 그대로 읽는다', function () {
    eq(D.COLS.length, 26, '열 개수');
    var e = D.fromRow(REAL_ROW);
    eq(e.id, '179222027616658', 'ID');
    eq(e.type, '기록', '유형');
    eq(e.nick, '우승', '닉네임');
    eq(e.cond, 5, '컨디션');
    eq(e.intensity, 6, '훈련강도');
    eq(e.minutes, 54, '운동시간');
    eq(e.done.join(','), '스트록,벽치기,코어', '완료훈련');
    eq(e.score.a, 21, '내 점수');
    eq(e.score.b, 13, '상대 점수');
    eq(e.result, '패', '승패');
    eq(e.pain.join(','), '목', '아픈부위');
    eq(e.weakness.join(','), '드라이브', '약점기술');
    eq(e.prescription.rehab.length, 2, '맞춤처방 파싱');
  });

  test('시트 26칸: 앱 객체를 다시 행으로 (비밀번호 칸은 비어 있음)', function () {
    var e = D.fromRow(REAL_ROW);
    var row = D.toRow(e);
    eq(row.length, 26, '칸 수');
    eq(row[0], '179222027616658', 'ID 유지');
    eq(row[24], '', '비밀번호 칸은 항상 빈칸');
    eq(row[D.COL['컨디션']], '5', '컨디션');
    eq(row[D.COL['완료훈련']], '스트록,벽치기,코어', '완료훈련');
    eq(row[D.COL['게임점수']], '21:13', '게임점수');
    var again = D.fromRow(row);
    eq(again.cond, e.cond, '왕복 후 컨디션');
    eq(again.weakness.join(','), e.weakness.join(','), '왕복 후 약점');
  });

  test('JSON 유형(매칭프로필·코치신청)은 payload로 분리된다', function () {
    var row = [];
    for (var i = 0; i < 26; i++) row.push('');
    row[0] = '1'; row[1] = '코치신청'; row[4] = '치이';
    row[18] = '{"type":"동호인 멘토","experience":"경력","proof":"증빙","intro":"소개","status":"심사중"}';
    var e = D.fromRow(row);
    eq(e.text, '', 'JSON은 본문 텍스트가 아니다');
    eq(e.payload.status, '심사중', '상태 파싱');
    eq(e.status, '심사중', '상태 노출');
  });

  test('삭제 표시된 행은 목록에서 빠진다', function () {
    var row = REAL_ROW.slice();
    row[D.COL['유형']] = '삭제';
    var idx = D.index([D.fromRow(REAL_ROW), D.fromRow(row)]);
    eq(idx.all.length, 1, '남은 행');
    eq((idx.byType['기록'] || []).length, 1, '기록 수');
  });

  test('점수/결과 계산', function () {
    eq(D.parseScore('21:13').a, 21);
    eq(D.parseScore('21:13').b, 13);
    eq(D.resultFromScore({ a: 21, b: 13 }), '승');
    eq(D.resultFromScore({ a: 13, b: 21 }), '패');
    eq(D.resultFromScore({ a: 21, b: 21 }), '무');
    eq(D.parseScore(''), null);
    eq(D.splitList('스트록,벽치기,코어').length, 3);
  });

  /* ================= 2. AI 분석 ================= */
  test('AI: 추천드릴 3개와 시트 호환 JSON을 만든다', function () {
    var history = [rec(-3, { weakness: ['드라이브'] }), rec(-2, { pain: ['목'] })];
    var an = AI.analyze({ draft: { cond: 5, intensity: 6, minutes: 54, pain: ['목'], weakness: ['드라이브'], score: { a: 21, b: 13 }, result: '패' }, records: history, level: '일반부', nick: '나래' });
    eq(an.drills.drills.length, 3, '드릴 개수');
    an.drills.drills.forEach(function (d) {
      ok(d.name && d.method && d.sets && d.point, '드릴 필드: ' + d.name);
      eq(d.level, '일반부', '레벨');
    });
    ok(an.score >= 0 && an.score <= 100, '점수 범위');
    ok(an.care.rehab.length >= 1 && an.care.stretch.length >= 1 && an.care.mental.length >= 1, '처방 3종');
    var patch = JSON.parse(an.sheetPatch['추천드릴']);
    ok(patch.drills.length === 3, '추천드릴 JSON');
    var care = JSON.parse(an.sheetPatch['맞춤처방']);
    ok(care.rehab && care.stretch && care.mental, '맞춤처방 JSON');
    excludes(JSON.stringify(an), 'undefined', '분석 결과에 undefined 없음');
  });

  test('AI: 아픈 부위에 맞는 처방 (목 → 온찜질)', function () {
    var an = AI.analyze({ draft: { cond: 6, intensity: 5, minutes: 50, pain: ['목'], weakness: [] }, records: [], level: '초보용', nick: '나' });
    includes(an.care.rehab.join(' '), '온찜질', '목 처방');
    includes(an.care.stretch.join(' '), '턱 당기기', '목 스트레칭');
  });

  test('AI: 반복 통증은 경고로 잡아낸다', function () {
    var history = [
      rec(-9, { pain: ['어깨'] }), rec(-5, { pain: ['어깨'] }), rec(-2, { pain: ['어깨'] })
    ];
    var an = AI.analyze({ draft: { cond: 6, intensity: 7, minutes: 60, pain: [], weakness: [] }, records: history, level: '일반부', nick: '나' });
    eq(an.risk[0].level, 'warn', '경고 단계');
    includes(an.risk[0].text, '어깨', '경고 내용');
    includes(an.insights.map(function (i) { return i.label; }).join(' '), '반복 통증', '진단에 반복 통증');
  });

  test('AI: 컨디션이 낮으면 회복 우선으로 말한다', function () {
    var an = AI.analyze({ draft: { cond: 1, intensity: 9, minutes: 15, pain: ['무릎', '허리'], weakness: ['풋워크'] }, records: [], level: '일반부', nick: '나' });
    includes(an.headline, '회복', '헤드라인');
    ok(an.score < 50, '낮은 점수: ' + an.score);
    includes(an.focus, '회복', '다음 목표');
  });

  test('AI: 기록이 없어도 동작한다 (기본값)', function () {
    var an = AI.analyze({ draft: {}, records: [], level: '', nick: '' });
    eq(an.drills.drills.length, 3, '기본 드릴');
    ok(an.insights.length >= 0, '진단');
    excludes(JSON.stringify(an), 'undefined', 'undefined 없음');
    excludes(JSON.stringify(an), 'null', 'null 없음');
  });

  test('AI: 같은 입력이면 같은 결과 (결정적)', function () {
    var input = { draft: { cond: 7, intensity: 6, minutes: 70, pain: [], weakness: ['헤어핀'], score: { a: 21, b: 19 }, result: '승' }, records: [rec(-2, { weakness: ['헤어핀'] })], level: '상급', nick: '나' };
    eq(JSON.stringify(AI.analyze(input)), JSON.stringify(AI.analyze(input)), '결정성');
  });

  test('AI: 코치용 요약', function () {
    var rows = [rec(-1, { weakness: ['클리어'], pain: ['팔꿈치'] }), rec(-4, { weakness: ['클리어'], score: { a: 12, b: 21 }, result: '패' })];
    var s = AI.summarize(rows, '초보용');
    eq(s.sessions, 2, '세션 수');
    eq(s.topWeakness[0], '클리어', '주 약점');
    includes(s.pain.join(' '), '팔꿈치', '통증');
    eq(s.winRate, 50, '승률');
  });

  /* ================= 3. 하트 ================= */
  test('하트: 적립·사용 계산 (기본 3개 포함)', function () {
    var rows = BM.fixtures.demo();
    var idx = D.index(rows.map(D.fromRow));
    var ledger = D.heartLedger(idx, BM.seed.ME);
    eq(ledger.base, 3, '기본 하트');
    eq(ledger.earned, 6, '적립: 출석2 + 광고2 + 선물받음1 + 합치기1');
    eq(ledger.spent, 3, '사용: 매칭2 + 선물보냄1');
    eq(ledger.balance, 6, '잔액');
    var kinds = {};
    ledger.history.forEach(function (h) { kinds[h.kind] = true; });
    ['checkin', 'ad', 'gift-in', 'gift-out', 'merge', 'match'].forEach(function (k) {
      ok(kinds[k], '원장 종류: ' + k);
    });
    ledger.history.forEach(function (h) {
      ok(h.delta !== 0, '금액 0인 내역 없음');
      ok(h.label && h.at, '라벨/시각');
    });
  });

  test('하트: 오늘 현황(출석·광고 한도·대기시간)', function () {
    var st = D.heartStatus(D.index(BM.fixtures.demo().map(D.fromRow)), BM.seed.ME);
    eq(st.checkedInToday, false, '오늘 출석 전');
    eq(st.canCheckIn, true, '출석 가능');
    eq(st.adUsedToday, 0, '오늘 광고 0');
    eq(st.adLimit, 5, '하루 5회');
    eq(st.adRemaining, 5, '남은 5');
    eq(st.canWatchAd, true, '광고 가능');
    eq(st.matchCost, 2, '매칭 비용');
    eq(st.giftCost, 1, '선물 비용');
    eq(st.balance, 6, '잔액');
  });

  /* ================= 4. 통계 ================= */
  test('통계: 승률·연속 기록·운동시간', function () {
    var rows = [
      rec(0, { score: { a: 21, b: 19 }, result: '승', minutes: 60 }),
      rec(-1, { score: { a: 15, b: 21 }, result: '패', minutes: 40 }),
      rec(-2, { score: { a: 21, b: 10 }, result: '승', minutes: 80 })
    ].map(function (e) { e.id = U.uid(); e.type = '기록'; e.userKey = BM.seed.ME; return D.toRow(e); });
    var s = D.stats(D.index(rows.map(D.fromRow)), BM.seed.ME);
    eq(s.count, 3, '기록 수');
    eq(s.wins, 2, '승');
    eq(s.losses, 1, '패');
    eq(s.winRate, 67, '승률');
    eq(s.streak, 3, '연속 기록');
    eq(s.minutesTotal, 180, '총 시간');
    eq(s.minutesMonth, 180, '이번 달');
  });

  /* ================= 5. 매칭 ================= */
  test('매칭: 조건이 맞을수록 점수가 높다', function () {
    var me = { level: '일반부', region: '경기', discipline: '복식', availability: '주말', experience: '2~5년' };
    var same = D.matchScore(me, { level: '일반부', region: '경기', discipline: '복식', availability: '주말', experience: '2~5년' });
    var far = D.matchScore(me, { level: '선수부', region: '부산', discipline: '단식', availability: '평일 낮', experience: '1년 미만' });
    ok(same.score > far.score, '같은 조건이 더 높아야: ' + same.score + ' vs ' + far.score);
    ok(same.reasons.length >= 2, '이유 표시');
  });

  test('급수: 예전 실력 값을 급수로 바꾼다', function () {
    eq(D.VOCAB.grades.length, 7, '급수 7단계');
    eq(D.normalizeGrade('일반부'), 'C조', '일반부 → C조');
    eq(D.normalizeGrade('초보용'), '초심', '초보용 → 초심');
    eq(D.normalizeGrade('상급'), 'B조', '상급 → B조');
    eq(D.normalizeGrade('선수부'), '선수부', '선수부 유지');
    eq(D.normalizeGrade('a조'), 'A조', '소문자 조');
    eq(D.normalizeGrade('자강부'), '자강', '자강부 → 자강');
    eq(D.normalizeGrade(''), '', '빈 값');
    eq(D.fromRow(REAL_ROW).level, '초심', '예전 시트 행 → 급수');
  });

  test('급수: 예전 매칭 프로필(상급)도 급수로 표시된다', function () {
    var rows = BM.fixtures.demo().concat([D.toRow({
      id: U.uid(), type: '매칭프로필', userKey: 'demo_legacy', nick: '옛회원', createdAt: U.stamp(),
      payload: { region: '경기', level: '상급', discipline: '복식', club: '옛클럽', availability: '주말', experience: '2~5년', bio: '', avatar: '🏸' }
    })]);
    var data = BM.store.derive(rows, BM.seed.ME);
    var p = data.matchProfiles.filter(function (m) { return m.userKey === 'demo_legacy'; })[0];
    eq(p.level, 'B조', '급수로 변환');
    var state = stateOf(rows);
    state.ui.matchFilter.level = 'B조';
    var html = BM.views.matching.render(state);
    includes(html, '옛회원', 'B조 필터에 포함');
  });

  test('급수: 필터가 급수로 동작한다', function () {
    var state = stateOf();
    state.ui.matchFilter.level = 'A조';
    var html = BM.views.matching.render(state);
    includes(html, '발놀림장인', 'A조 선수 표시');
    excludes(html, '콕집사', 'B조는 제외');
    excludes(html, '드라이브요정', 'D조는 제외');
  });

  test('매칭: 카드에서는 프로필로 들어간다 (바로 신청 없음)', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    includes(html, 'data-open-profile', '프로필 열기');
    excludes(html, 'data-apply', '바로 신청 버튼 없음');
    includes(html, '프로필 보고 요청하기', '안내 문구');
    includes(html, 'eventchip', '주력 종목 칩');
    includes(html, 'pill--grade', '급수 배지');
  });

  test('매칭: 프로필에서 종목·급수를 확인하고 요청/닫기', function () {
    var state = stateOf();
    var p = state.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_foot'; })[0];
    var html = BM.views.matching.profileBody(state, p);
    checkHtml(html, '프로필 시트');
    includes(html, '주력 종목', '종목 라벨');
    includes(html, 'eventchip eventchip--lg is-on">복식', '상대 주력 종목 강조');
    includes(html, '급수', '급수 라벨');
    includes(html, 'A조', '상대 급수');
    includes(html, '요청 보내기', '요청 버튼');
    includes(html, '닫기', '닫기 버튼');
    includes(html, '궁합', '궁합 점수');
    includes(html, 'data-send-request="demo_foot"', '요청 대상');
    excludes(html, 'undefined', 'undefined 없음');
  });

  test('매칭: 받은 신청은 프로필에서 수락/거절', function () {
    var state = stateOf();
    var p = state.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_suttle'; })[0];
    var html = BM.views.matching.profileBody(state, p);
    includes(html, 'data-accept', '수락 버튼');
    includes(html, 'data-decline', '거절 버튼');
    excludes(html, 'data-send-request', '내가 다시 신청하지 않음');
  });

  /* ================= 6. 채팅 ================= */
  test('채팅: 방 단위로 묶고 안 읽은 수를 센다', function () {
    function chat(id, from, text, at, team) {
      return { id: id, type: '매칭채팅', userKey: from, target: from === BM.seed.ME ? 'demo_net' : BM.seed.ME, text: text, createdAt: at, team: team };
    }
    var rows = [
      chat('m1', BM.seed.ME, '안녕하세요', '2026-11-10 10:00:00', 'r1'),
      chat('m2', 'demo_net', '네 반가워요', '2026-11-10 10:05:00', 'r1'),
      chat('m3', 'demo_net', '토요일 좋아요', '2026-11-11 10:00:00', 'r1')
    ].map(function (e) { return D.toRow(e); });
    rows.push(D.toRow({ id: 'rd1', type: '채팅읽음', userKey: BM.seed.ME, target: 'demo_net', team: 'r1', createdAt: '2026-11-10 10:06:00' }));
    var rooms = D.chatRooms(D.index(rows.map(D.fromRow)), BM.seed.ME);
    eq(rooms.length, 1, '방 개수');
    eq(rooms[0].roomId, 'r1', '방 ID');
    eq(rooms[0].messages.length, 3, '메시지 수');
    eq(rooms[0].unread, 1, '안 읽은 수');
    eq(rooms[0].other, 'demo_net', '상대');
  });

  /* ================= 7. 저장소(API) ================= */
  test('API: 같은 clientId는 한 번만 저장된다 (연타·재시도 방지)', function () {
    clearStorage();
    var api = BM.api.createLocal({ latency: 0 });
    var row = D.toRow({ id: '700001', type: '소셜', userKey: 'demo_me', nick: '나', date: U.ymd(), text: '중복 테스트' });
    return api.append(row, 'cid-1').then(function (r1) {
      eq(r1.duplicate, undefined, '첫 저장');
      return api.append(row, 'cid-1');
    }).then(function (r2) {
      eq(r2.duplicate, true, '두 번째는 중복');
      return api.bootstrap();
    }).then(function (res) {
      var same = res.rows.filter(function (r) { return r[0] === '700001'; });
      eq(same.length, 1, '행은 1개만');
    });
  });

  test('API: 수정과 삭제가 해당 행에만 적용된다', function () {
    clearStorage();
    var api = BM.api.createLocal({ latency: 0 });
    var row = D.toRow({ id: '700002', type: '소셜', userKey: 'demo_me', nick: '나', text: '처음' });
    return api.append(row, 'a').then(function () {
      return api.update('700002', { '소셜글': '고침' }, 'b');
    }).then(function () {
      return api.bootstrap();
    }).then(function (res) {
      var hit = res.rows.filter(function (r) { return r[0] === '700002'; })[0];
      eq(hit[D.COL['소셜글']], '고침', '수정 반영');
      return api.remove('700002', 'c');
    }).then(function () {
      return api.bootstrap();
    }).then(function (res) {
      eq(res.rows.filter(function (r) { return r[0] === '700002'; }).length, 0, '삭제 반영');
    });
  });

  test('시트 모드: 요청 형식(preflight 회피)과 토큰 전달', function () {
    var calls = [];
    var fakeFetch = function (url, opts) {
      calls.push({ url: url, body: JSON.parse(opts.body), headers: opts.headers });
      return Promise.resolve({
        text: function () {
          return Promise.resolve(JSON.stringify({ ok: true, token: 'tok-1', me: { key: 'u1', nick: '나' }, rows: [] }));
        }
      });
    };
    var saved = root.fetch;
    root.fetch = fakeFetch;
    var api = BM.api.createSheets({ url: 'https://script.google.com/macros/s/x/exec' });
    return api.login({ email: 'me@example.com', password: 'pw', create: true }).then(function (res) {
      eq(res.token, 'tok-1', '로그인 토큰');
      eq(calls[0].body.action, 'login', 'action=login');
      eq(calls[0].body.create, true, '가입 허용');
      includes(calls[0].headers['Content-Type'], 'text/plain', '사전요청 없는 content-type');
      return api.bootstrap();
    }).then(function (bs) {
      eq(calls[1].body.action, 'bootstrap', 'action=bootstrap');
      eq(calls[1].body.token, 'tok-1', '토큰 전달');
      eq(bs.rows.length, 0, '행 0개');
      root.fetch = saved;
    });
  });

  test('시트 모드: 서버 오류는 메시지로 돌려준다', function () {
    var saved = root.fetch;
    root.fetch = function () {
      return Promise.resolve({
        text: function () { return Promise.resolve(JSON.stringify({ ok: false, code: 'bad_password', message: '비밀번호가 맞지 않습니다.' })); }
      });
    };
    var api = BM.api.createSheets({ url: 'https://x/y' });
    return api.login({ email: 'a@b.c', password: 'nope' }).then(function () {
      throw new Error('실패해야 합니다');
    }, function (err) {
      eq(err.code, 'bad_password', '오류 코드');
      includes(err.message, '비밀번호', '오류 메시지');
      root.fetch = saved;
    });
  });

  /* ================= 8. 상태/동작 ================= */
  test('저장: 연타해도 한 번만 기록된다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.records.length;
      var a = store.actions.saveLog();
      var b = store.actions.saveLog();
      eq(a.ok, true, '첫 저장');
      eq(b.ok, false, '두 번째는 잠김');
      eq(b.reason, 'locked', '이유');
      eq(store.state.data.records.length, before + 1, '기록은 1개만 추가');
      eq(store.state.stats.blocked, 1, '막은 횟수');
      eq(store.state.queue.length, 1, '전송 대기 1건');
      return store.flush();
    }).then(function () {
      return BM.api.createLocal({ latency: 0 }).bootstrap();
    }).then(function (res) {
      /* 저장소에 남은 기록 행이 1개인지 (시드 10 + 1) */
      var mine = res.rows.filter(function (r) { return r[D.COL['유형']] === '기록' && r[D.COL['사용자ID']] === BM.seed.ME; });
      eq(mine.length, 11, '실제 저장된 기록 수');
    });
  });

  test('저장: AI 분석이 함께 저장되고 화면에 바로 반영된다', function () {
    return freshStore().then(function (store) {
      store.actions.setDraft({ pain: ['어깨'], weakness: ['스매시'], cond: 4, intensity: 9, minutes: 100 });
      var res = store.actions.saveLog();
      ok(res.ok, '저장');
      ok(store.state.analysis, '분석 결과');
      var last = store.state.data.records[0];
      ok(last.prescription, '처방 저장');
      ok(last.drills && last.drills.drills.length === 3, '드릴 저장');
      ok(last.prescription.rehab.length >= 2, '처방 항목');
      includes(last.prescription.rehab.join(' '), '오버헤드', '어깨 부위 처방');
    });
  });

  test('커뮤니티: 좋아요 토글 (낙관적 반영)', function () {
    return freshStore().then(function (store) {
      var post = store.state.data.posts.filter(function (p) { return !p.likedByMe; })[0];
      ok(post, '좋아요 안 한 글 존재');
      var count = post.likes;
      var r1 = store.actions.toggleLike(post.id);
      eq(r1.liked, true, '좋아요');
      eq(store.state.data.posts.filter(function (p) { return p.id === post.id; })[0].likes, count + 1, '숫자 증가');
      store.state.locks['like:' + post.id] = 0;   /* 잠금 해제 후 취소 */
      var r2 = store.actions.toggleLike(post.id);
      eq(r2.liked, false, '취소');
      eq(store.state.data.posts.filter(function (p) { return p.id === post.id; })[0].likes, count, '숫자 원복');
      eq(store.state.queue.length, 2, '대기 2건(추가/삭제)');
    });
  });

  test('커뮤니티: 답글과 글쓰기', function () {
    return freshStore().then(function (store) {
      var post = store.state.data.posts[0];
      var before = post.replies.length;
      var r = store.actions.addReply(post.id, '좋은 정보 감사합니다');
      ok(r.ok, '답글');
      eq(store.state.data.posts.filter(function (p) { return p.id === post.id; })[0].replies.length, before + 1, '답글 수');
      var p = store.actions.createPost('오늘 승리!');
      ok(p.ok, '글쓰기');
      eq(store.state.data.posts[0].text, '오늘 승리!', '맨 위에 표시');
      eq(store.actions.createPost('   ').ok, false, '빈 글은 막는다');
    });
  });

  test('매칭: 요청을 보낼 때는 하트를 빼지 않고, 2개 이상인지만 확인한다', function () {
    return freshStore().then(function (store) {
      eq(store.state.data.hearts.balance, 6, '시작 잔액');
      var targets = ['demo_chi', 'demo_suttle', 'demo_foot'];
      targets.forEach(function (t) {
        store.state.locks = {};
        ok(store.actions.requestMatch(t, '같이 쳐요').ok, t + ' 신청');
      });
      eq(store.state.data.hearts.balance, 6, '보낼 때는 차감 없음(수락 시 차감)');
      eq((store.state.idx.byType['내하트사용'] || []).filter(function (h) {
        return h.userKey === BM.seed.ME;
      }).length, 1, '새 내하트사용 행은 만들지 않음(예전 성사 건 1건 그대로)');
      /* 보유 하트가 2개보다 적으면 요청 자체를 막는다 (받아도 낼 수 없으므로) */
      for (var gi = 0; gi < 5; gi++) {     /* 선물 1개씩 다섯 번 → 6개에서 1개 */
        store.state.locks = {};
        ok(store.actions.giftHeart('demo_koala').ok, '하트 선물 ' + (gi + 1));
      }
      eq(store.state.data.hearts.balance, 1, '하트 1개만 남음');
      store.state.locks = {};
      var blocked = store.actions.requestMatch('demo_drive', '');
      eq(blocked.ok, false, '하트가 2개보다 적으면 신청 불가');
      eq(blocked.reason, 'hearts', '이유: 하트 부족');
      eq(blocked.need, 1, '부족 개수');
    });
  });

  test('매칭: 같은 상대에게 중복 신청하지 않는다', function () {
    return freshStore().then(function (store) {
      store.actions.requestMatch('demo_chi', '');
      store.state.locks = {};
      var again = store.actions.requestMatch('demo_chi', '');
      eq(again.ok, false, '중복 신청 차단');
      eq(again.reason, 'already', '이유');
    });
  });

  test('매칭: 받은 신청을 수락하면 상태가 바뀐다', function () {
    return freshStore().then(function (store) {
      var incoming = store.state.data.requests.filter(function (r) { return r.target === BM.seed.ME; })[0];
      ok(incoming, '받은 신청 존재');
      var res = store.actions.respondMatch(incoming.id, '수락');
      ok(res.ok, '수락 처리');
      var after = store.state.data.requests.filter(function (r) { return r.id === incoming.id; })[0];
      eq(after.status, '수락', '상태 반영');
      eq(store.state.queue.length, 1, '시트 수정 요청');
    });
  });

  test('매칭: 수락한 상대는 다시 신청하지 않고 채팅으로 연결된다', function () {
    return freshStore().then(function (store) {
      var incoming = store.state.data.requests.filter(function (r) { return r.target === BM.seed.ME && r.status === '대기'; })[0];
      store.actions.respondMatch(incoming.id, '수락');
      /* 찾기 탭은 처음엔 안내 화면이라, '전체'를 눌러 목록을 보이게 한 뒤 확인합니다 */
      store.actions.resetMatchFilter();
      var html = BM.views.matching.render(store.state);
      includes(html, 'data-open-chat="' + incoming.id + '"', '수락한 상대의 채팅 버튼');
      excludes(html, 'data-send-request="' + incoming.userKey + '"', '같은 상대에게 다시 요청 버튼 없음');
    });
  });

  test('채팅: 보낸 메시지가 즉시 목록에 붙는다', function () {
    return freshStore().then(function (store) {
      var room = store.state.data.rooms[0];
      ok(room, '방 존재');
      var before = room.messages.length;
      var res = store.actions.sendChat(room.roomId, room.other, '토요일 9시에 뵐게요');
      ok(res.ok, '전송');
      var after = store.state.data.rooms.filter(function (r) { return r.roomId === room.roomId; })[0];
      eq(after.messages.length, before + 1, '메시지 수');
      eq(after.messages[after.messages.length - 1].text, '토요일 9시에 뵐게요', '내용');
      store.state.locks = {};
      eq(store.actions.sendChat(room.roomId, room.other, '  ').ok, false, '빈 메시지 차단');
    });
  });

  test('코치: 멘토 신청 승인/거절 (관리자)', function () {
    return freshStore().then(function (store) {
      store.state.me.admin = true;
      var pending = store.state.data.coachApps.filter(function (a) { return a.status === '심사중'; })[0];
      ok(pending, '심사중 신청 존재');
      var res = store.actions.decideCoachApp(pending.id, '승인');
      ok(res.ok, '승인 처리');
      var after = store.state.data.coachApps.filter(function (a) { return a.id === pending.id; })[0];
      eq(after.status, '승인', '상태 반영');
      eq((store.state.queue[0] || {}).kind, 'update', '시트 수정 요청');
      store.state.locks = {};
      var reject = store.state.data.coachApps.filter(function (a) { return a.status === '심사중'; })[0];
      if (reject) eq(store.actions.decideCoachApp(reject.id, '거절').ok, true, '거절 처리');
    });
  });

  test('코치: 피드백 보내기 (관리자)', function () {
    return freshStore().then(function (store) {
      store.state.me.admin = true;
      var res = store.actions.sendCoachFeedback({ playerKey: 'demo_drive', text: '타점을 몸 앞에서', rating: 4, drills: ['드라이브'] });
      ok(res.ok, '전송');
      var fb = store.state.data.feedback[0];
      eq(fb.target, 'demo_drive', '대상');
      eq(fb.payload.rating, 4, '별점');
      eq(fb.payload.drills[0], '드라이브', '드릴');
    });
  });

  test('하트: 광고는 하루 5회까지', function () {
    var old = U.stamp(new Date(Date.now() - 120000));
    var extra = [];
    for (var i = 0; i < 5; i++) {
      extra.push({ id: U.uid(), type: '광고하트', userKey: BM.seed.ME, date: U.ymd(), likes: 1, createdAt: old });
    }
    return freshStoreWith(extra).then(function (store) {
      eq(store.state.data.hearts.adUsedToday, 5, '오늘 5회');
      eq(store.state.data.hearts.adRemaining, 0, '남은 0');
      var r = store.actions.watchAd();
      eq(r.ok, false, '더 못 받음');
      eq(r.reason, 'limit', '한도');
    });
  });

  test('하트: 광고는 30초 간격 (연타 파밍 방지)', function () {
    var recent = U.stamp(new Date(Date.now() - 5000));
    return freshStoreWith([{ id: U.uid(), type: '광고하트', userKey: BM.seed.ME, date: U.ymd(), likes: 1, createdAt: recent }])
      .then(function (store) {
        var st = store.state.data.hearts;
        eq(st.adUsedToday, 1, '오늘 1회');
        ok(st.nextAdInSec > 20 && st.nextAdInSec <= 30, '대기 ' + st.nextAdInSec + '초');
        eq(st.canWatchAd, false, '대기 중');
        var r = store.actions.watchAd();
        eq(r.reason, 'cooldown', '쿨다운 거절');
        ok(r.retryAfter > 0, '남은 초');
      });
  });

  test('하트: 간격이 지나면 광고를 다시 받을 수 있다', function () {
    var past = U.stamp(new Date(Date.now() - 40000));
    return freshStoreWith([{ id: U.uid(), type: '광고하트', userKey: BM.seed.ME, date: U.ymd(), likes: 1, createdAt: past }])
      .then(function (store) {
        eq(store.state.data.hearts.canWatchAd, true, '가능');
        var before = store.state.data.hearts.balance;
        var r = store.actions.watchAd({ verified: true });
        eq(r.ok, true, '적립');
        eq(r.gained, 1, '1개');
        eq(r.remaining, 3, '오늘 2회 사용 → 3회 남음');
        eq(store.state.data.hearts.balance, before + 1, '잔액 +1');
      });
  });

  test('하트: 출석 체크는 하루 1회', function () {
    return freshStore().then(function (store) {
      eq(store.state.data.hearts.checkedInToday, false, '시작');
      var r = store.actions.checkIn();
      ok(r.ok, '출석 성공');
      eq(r.gained, 1, '보상 1');
      eq(store.state.data.hearts.balance, 7, '잔액 +1');
      eq(store.state.data.hearts.checkedInToday, true, '완료 표시');
      store.state.locks = {};
      var again = store.actions.checkIn();
      eq(again.ok, false, '두 번째 불가');
      eq(again.reason, 'done', '이유');
    });
  });

  test('하트: 선물은 보낸 사람 -1, 받은 사람 +1', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      var r = store.actions.giftHeart('demo_chi', '좋은 경기였어요');
      ok(r.ok, '선물 성공');
      eq(r.spent, 1, '1개 사용');
      eq(store.state.data.hearts.balance, before - 1, '보낸 사람 -1');
      var target = D.heartStatus(store.state.idx, 'demo_chi');
      var got = target.history.filter(function (h) { return h.kind === 'gift-in' && h.delta === 1; });
      ok(got.length >= 1, '받은 사람 +1');
      store.state.locks = {};
      eq(store.actions.giftHeart(BM.seed.ME).reason, 'self', '나에게는 불가');
      eq(store.actions.giftHeart('nobody').reason, 'no_target', '없는 사람');
    });
  });

  test('하트: 유료 테마는 한 번만 차감된다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      var price = D.HEART_RULES.THEME_PRICES.th_court;
      ok(price > 0, '유료 테마 가격');
      var r1 = store.actions.setTheme('th_court');
      ok(r1.ok, '구매+적용');
      eq(r1.purchased, true, '구매함');
      eq(store.state.data.hearts.balance, before - price, '가격만큼 차감');
      eq(D.ownsTheme(store.state.idx, BM.seed.ME, 'th_court'), true, '소유');
      store.state.locks = {};
      var queued = store.state.queue.length;
      var r2 = store.actions.setTheme('th_court');
      ok(r2.ok, '재적용');
      eq(r2.purchased, false, '추가 구매 없음');
      eq(store.state.data.hearts.balance, before - price, '추가 차감 없음');
      eq(store.state.queue.length, queued + 1, '프로필 행만 추가');
    });
  });

  test('하트: 잔액이 모자라면 테마 구매가 막힌다', function () {
    var spend = [];
    for (var i = 0; i < 3; i++) {
      spend.push({ id: U.uid(), type: '내하트사용', userKey: BM.seed.ME, date: U.ymd(), likes: 2, createdAt: U.stamp() });
    }
    return freshStoreWith(spend).then(function (store) {
      var st = store.state.data.hearts;
      ok(st.balance < D.HEART_RULES.THEME_PRICES.th_sakura, '잔액 부족: ' + st.balance);
      var r = store.actions.setTheme('th_sakura');
      eq(r.ok, false, '구매 불가');
      eq(r.reason, 'hearts', '이유');
      ok(r.need >= 1, '부족 개수');
      eq(store.state.me.theme.theme === 'th_sakura', false, '적용되지 않음');
    });
  });

  test('프로필/테마 변경이 즉시 반영된다', function () {
    return freshStore().then(function (store) {
      var res = store.actions.saveProfile({ nick: '새이름', bio: '소개 변경', avatar: '🐧' });
      ok(res.ok, '프로필 저장');
      eq(store.state.me.nick, '새이름', '상태 반영');
      var p = store.state.data.idx.byType['프로필'].filter(function (x) { return x.userKey === BM.seed.ME; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
      eq(p[p.length - 1].nick, '새이름', '프로필 행 추가');
      store.state.locks = {};
      var th = store.actions.setTheme('th_sakura');
      ok(th.ok, '테마');
      eq(store.state.me.theme.theme, 'th_sakura', '테마 반영');
      eq(th.purchased, true, '유료 테마 구매');
      eq(store.state.queue.length, 3, '프로필 + 구매 + 테마 프로필');
    });
  });

  /* ================= 9. 화면 ================= */
  test('화면: 일지 & AI 렌더', function () {
    var state = stateOf();
    var html = BM.views.log.render(state);
    checkHtml(html, '일지');
    includes(html, '오늘 일지', '제목');
    includes(html, '저장하고 AI 분석', '저장 버튼');
    includes(html, '아픈 부위', '입력 항목');
  });

  test('화면: 분석 카드 렌더 (undefined 없이)', function () {
    var state = stateOf();
    state.analysis = AI.analyze({ draft: state.drafts.log, records: state.data.records, level: '일반부', nick: '나래' });
    var html = BM.views.log.render(state);
    checkHtml(html, '분석');
    includes(html, '추천 드릴', '드릴 제목');
    includes(html, '맞춤 처방', '처방 제목');
    includes(html, '이번 주 루틴', '루틴');
  });

  test('화면: 매칭 렌더 (궁합 점수 포함)', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    checkHtml(html, '매칭');
    includes(html, '플레이어 찾기', '목록');
    includes(html, '궁합', '점수');
    includes(html, '프로필 보고 요청하기', '요청 전 프로필 확인');
    includes(html, 'data-value="자강"', '급수 필터');
    includes(html, 'eventchip is-on', '카드의 주력 종목 칩');
  });

  test('화면: 1:1 대화방 렌더', function () {
    var state = stateOf();
    var room = state.data.threads[0];
    state.ui.chatRoom = room.roomId;
    var html = BM.views.chat.roomHtml(state);
    checkHtml(html, '채팅');
    includes(html, 'dm__composer', '입력창');
    includes(html, 'data-dm-form', '전송 폼');
    includes(html, '네트앞여우', '상대 이름');
    includes(html, 'dmsg--me', '내 메시지는 오른쪽');
  });

  test('화면: 커뮤니티 렌더', function () {
    var state = stateOf();
    var html = BM.views.community.render(state);
    checkHtml(html, '커뮤니티');
    includes(html, '올리기', '글쓰기');
    includes(html, '나래울 코트 빈 자리', '사용자가 쓴 글');
  });

  test('화면: 코치 렌더 (피드백/심사)', function () {
    var state = stateOf();
    state.me.admin = true;
    var html = BM.views.coach.render(state);
    checkHtml(html, '코치-피드백');
    includes(html, '선수 피드백', '탭');
    includes(html, '도착한 멘토 신청', '관리자 배너');
    state.ui.coachTab = 'approve';
    var html2 = BM.views.coach.render(state);
    checkHtml(html2, '코치-심사');
    includes(html2, '멘토 신청 심사', '심사 탭');
    includes(html2, '조건 확인 후 수락', '수락 버튼');
  });

  test('화면: MY 렌더', function () {
    var state = stateOf();
    var html = BM.views.my.render(state);
    checkHtml(html, 'MY');
    includes(html, '하트', '하트');
    includes(html, '광고 보고 받기', '보상형 광고 버튼');
    includes(html, '출석 체크', '출석 버튼');
    includes(html, '오늘 광고', '오늘 광고 한도');
    includes(html, '꾸미기', '꾸미기');
    includes(html, '체험 모드', '모드 표시');
    includes(html, '총 기록', '통계');
  });

  test('화면: MY 하트 카드 — 광고 한도/쿨다운 표시', function () {
    var old = U.stamp(new Date(Date.now() - 40000));
    var rows = BM.fixtures.demo();
    for (var i = 0; i < 5; i++) {
      rows.push(D.toRow({ id: U.uid(), type: '광고하트', userKey: BM.seed.ME, date: U.ymd(), likes: 1, createdAt: old }));
    }
    var state = stateOf(rows);
    var html = BM.views.my.render(state);
    checkHtml(html, 'MY-한도');
    includes(html, '오늘 모두 받았어요', '한도 도달 문구');
    includes(html, '5/5', '오늘 광고 5/5');

    var rows2 = BM.fixtures.demo();
    rows2.push(D.toRow({ id: U.uid(), type: '광고하트', userKey: BM.seed.ME, date: U.ymd(), likes: 1, createdAt: U.stamp(new Date(Date.now() - 5000)) }));
    var html2 = BM.views.my.render(stateOf(rows2));
    checkHtml(html2, 'MY-쿨다운');
    includes(html2, '다음 광고까지', '쿨다운 표시(실시간 카운트다운)');
    includes(html2, '1/5', '오늘 광고 1/5');
  });

  /* ================= 10. 시드/개인정보 ================= */
  test('시드: 첫 설치에는 아무 데이터도 넣지 않는다 (build() → [])', function () {
    eq(BM.seed.build().length, 0, '행 수 0');
    eq((BM.seed.PLAYERS || []).length, 0, '데모 선수 없음');
    ok(BM.seed.ME, '사용자ID 키는 유지');
    /* 빈 배열을 저장소·화면이 그대로 받아도 터지지 않아야 합니다 */
    var data = BM.store.derive(BM.seed.build(), BM.seed.ME);
    eq(data.posts.length, 0, '글 0');
    eq(data.matchProfiles.length, 0, '매칭 프로필 0');
    eq(data.rooms.length, 0, '대화방 0');
    eq(data.records.length, 0, '기록 0');
    eq(data.stats.count, 0, '통계 0');
    eq(data.hearts.balance, D.HEART_RULES.BASE, '하트는 기본 3개');
    var html = BM.views.log.render(stateOf(BM.seed.build()));
    checkHtml(html, '빈 일지 화면');
    includes(html, '아직 기록이 없어요', '빈 상태 안내');
  });

  test('픽스처: 26칸 구조이고 개인정보(이메일·비밀번호)가 없다', function () {
    var rows = BM.fixtures.demo();
    ok(rows.length > 50, '행 수: ' + rows.length);
    var types = {};
    rows.forEach(function (r) {
      eq(r.length, 26, '칸 수');
      eq(r[D.COL['비밀번호']], '', '비밀번호 칸');
      types[r[D.COL['유형']]] = 1;
      r.forEach(function (cell) { excludes(cell, '@', '이메일 흔적'); });
    });
    ['프로필', '기록', '소셜', '답글', '하트', '매칭프로필', '매칭신청', '매칭채팅', '코치신청', '출석하트', '광고하트', '선물하트', '내하트사용', '달력메모', '꾸미기구매']
      .forEach(function (ty) { ok(types[ty], '유형 존재: ' + ty); });
  });

  test('픽스처 → 파생 데이터 (대화·신청·통계)', function () {
    var data = BM.store.derive(BM.fixtures.demo(), BM.seed.ME);
    ok(data.posts.length >= 5, '글 수');
    ok(data.matchProfiles.length >= 6, '매칭 프로필');
    eq(data.rooms.length, 1, '대화방');
    eq(data.requests.length, 2, '매칭 신청');
    ok(data.hearts.balance >= 0, '하트');
    ok(data.stats.count >= 10, '기록');
    eq(data.posts.reduce(function (n, p) { return n + p.replies.length; }, 0), 4, '답글 수');
  });

  test('식별자: 15~16자리 숫자이고 서로 다르다', function () {
    var seen = {};
    for (var i = 0; i < 200; i++) {
      var id = U.uid();
      ok(/^\d{15,16}$/.test(id), '형식: ' + id);
      ok(!seen[id], '중복 없음');
      seen[id] = 1;
    }
    ok(/^c[0-9a-z]+$/.test(U.clientId()), 'clientId 형식');
  });

  /* ================= 11. 시작화면·계정 연동 ================= */
  function clearAuth() {
    ['bm_auth_v1', 'bm_accounts_v1', 'bm_google_client_id_v1', 'bm_auth_profile_v1', 'bm_bridge_url_v1', 'bm_session_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
    var s = BM.views.start.state();
    s.screen = 'home'; s.mode = 'login'; s.error = '';
    s.draft = { email: '', password: '', nick: '' };
    s.onb = { nick: '', level: '', discipline: '', region: '', club: '' };
  }

  test('브리지: 저장된 주소가 없으면 배포된 기본 시트 브리지로 연결한다', function () {
    clearAuth();
    ok(/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(BM.auth.bridgeUrl()), '기본 /exec 주소');
    eq(BM.auth.bridgeUrl(), BM.auth.DEFAULT_BRIDGE_URL, '기본값=DEFAULT_BRIDGE_URL');
    BM.auth.saveBridgeUrl('https://example.com/custom');
    eq(BM.auth.bridgeUrl(), 'https://example.com/custom', '저장한 주소가 우선');
    U.storage.removeItem('bm_bridge_url_v1');
    eq(BM.auth.bridgeUrl(), BM.auth.DEFAULT_BRIDGE_URL, '저장값을 지우면 기본값');
  });

  test('계정: 둘러보기 세션은 저장되고 로그아웃하면 사라진다', function () {
    clearAuth();
    eq(BM.auth.session(), null, '처음에는 세션 없음');
    BM.auth.signInGuest();
    var s = BM.auth.session();
    eq(s.kind, 'guest', '체험 세션');
    eq(BM.auth.kindLabel(s), '체험 모드', '표시 이름');
    eq(BM.auth.needsOnboarding(s, null), false, '체험 모드는 온보딩 없음');
    eq(BM.auth.rowsKeyFor(s), 'bm_rows_v1', '체험 데이터 키');
    BM.auth.signOut();
    eq(BM.auth.session(), null, '로그아웃 후 세션 없음');
  });

  test('계정: 이메일 가입 → 로그인 (비밀번호는 해시로만 저장)', function () {
    clearAuth();
    return BM.auth.signInEmail({ email: 'Player@Example.com', password: 'secret12', nick: '테스터', create: true, url: '' })
      .then(function (res) {
        eq(res.ok, true, '가입 성공');
        eq(res.session.kind, 'email', '이메일 세션');
        eq(res.session.email, 'player@example.com', '소문자 정규화');
        var acc = BM.auth.accountOf('player@example.com');
        ok(acc, '계정 저장됨');
        ok(/^(sha256|fnv)\$/.test(acc.hash), '해시 형식: ' + acc.hash);
        excludes(JSON.stringify(acc), 'secret12', '평문 비밀번호 없음');
        BM.auth.signOut();
        return BM.auth.signInEmail({ email: 'player@example.com', password: 'secret12', url: '' });
      })
      .then(function (res) {
        eq(res.ok, true, '로그인 성공');
        eq(BM.auth.session().kind, 'email', '세션 종류');
        return BM.auth.signInEmail({ email: 'player@example.com', password: 'wrong-pass', url: '' });
      })
      .then(function (res) {
        eq(res.ok, false, '틀린 비밀번호는 거절');
        eq(res.code, 'bad_password', '이유');
        return BM.auth.signInEmail({ email: 'player@example.com', password: 'secret12', create: true, url: '' });
      })
      .then(function (res) {
        eq(res.ok, false, '같은 이메일 재가입 거절');
        eq(res.code, 'exists', '이유');
        return BM.auth.signInEmail({ email: 'nobody@example.com', password: 'secret12', url: '' });
      })
      .then(function (res) {
        eq(res.ok, false, '없는 계정은 만들지 않음');
        eq(res.code, 'no_user', '이유');
      });
  });

  test('계정: 이메일·비밀번호 형식 검사', function () {
    clearAuth();
    return BM.auth.signInEmail({ email: 'not-an-email', password: 'secret12', create: true })
      .then(function (res) {
        eq(res.ok, false, '이메일 형식');
        eq(res.code, 'bad_email', '이유');
        return BM.auth.signInEmail({ email: 'a@b.co', password: '123', create: true });
      })
      .then(function (res) {
        eq(res.ok, false, '짧은 비밀번호');
        eq(res.code, 'weak_password', '이유');
      });
  });

  test('온보딩: 가입 직후에는 필요하고, 완료하면 다시 묻지 않는다', function () {
    clearAuth();
    return BM.auth.signInEmail({ email: 'onb@example.com', password: 'secret12', nick: '온보', create: true, url: '' })
      .then(function () {
        var s = BM.auth.session();
        eq(BM.auth.needsOnboarding(s, { level: '', discipline: '' }), true, '가입 직후 온보딩 필요');
        BM.auth.markOnboarded({ nick: '온보', level: 'B조', discipline: '복식', region: '서울', club: '테스트클럽' });
        var s2 = BM.auth.session();
        eq(BM.auth.needsOnboarding(s2, { level: '', discipline: '' }), false, '완료 후에는 아님');
        ok(s2.onboardedAt, '완료 시각 저장');
        eq(BM.auth.profileFor(s2).club, '테스트클럽', '클럽 저장');
        eq(BM.auth.kindLabel(s2), '이메일 계정', '표시 이름');
      });
  });

  test('계정: 로그인 계정은 체험 데이터와 다른 저장 키를 쓴다', function () {
    clearAuth();
    return BM.auth.signInEmail({ email: 'key@example.com', password: 'secret12', create: true, url: '' }).then(function () {
      var key = BM.auth.rowsKeyFor(BM.auth.session());
      ok(key.indexOf('bm_rows_v1::') === 0, '계정별 키: ' + key);
      ok(key.indexOf('key@example.com') > 0, '이메일 포함');
      eq(key !== 'bm_rows_v1', true, '체험 키와 분리');
      var meKey = BM.auth.meKeyFor(BM.auth.session());
      ok(meKey.indexOf('u_') === 0, '계정 사용자 키: ' + meKey);
      BM.auth.signOut();
      BM.auth.signInGuest();
      eq(BM.auth.rowsKeyFor(BM.auth.session()), 'bm_rows_v1', '체험 키');
      eq(BM.auth.meKeyFor(BM.auth.session()), BM.seed.ME, '체험 사용자 키');
    });
  });

  test('계정: 데모 Google 계정과 잘못된 토큰 처리', function () {
    clearAuth();
    BM.auth.signInGoogle(BM.auth.DEMO_GOOGLE);
    var s = BM.auth.session();
    eq(s.kind, 'google', '구글 세션');
    eq(s.email, 'demo.player@gmail.com', '이메일');
    eq(s.demo, true, '데모 표시');
    includes(BM.auth.kindLabel(s), 'Google', '표시 이름');
    eq(BM.auth.decodeJwt('garbage'), null, '잘못된 토큰');
    eq(BM.auth.decodeJwt('a.b.c'), null, '이메일 없는 payload');
    t.throws(function () { BM.auth.signInGoogle({}); }, '이메일 없는 구글 로그인은 거절');
  });

  test('계정: Google Client ID 검증과 저장', function () {
    clearAuth();
    /* 배포 기본값이 들어 있어, 저장 값이 없어도 실제 구글 로그인이 동작합니다. */
    eq(BM.auth.googleClientId(), BM.auth.DEFAULT_GOOGLE_CLIENT_ID, '처음에는 배포 기본값');
    eq(BM.auth.isGoogleClientId(BM.auth.googleClientId()), true, '기본값은 올바른 형식');
    eq(BM.auth.isDefaultGoogleClientId(), true, '기본값 사용 중');
    eq(BM.auth.setGoogleClientId('not-a-client-id').ok, false, '형식 오류 거절');
    var good = '1234567890-abcdefg.apps.googleusercontent.com';
    eq(BM.auth.setGoogleClientId(good).ok, true, '정상 ID 저장');
    eq(BM.auth.googleClientId(), good, '저장한 값이 기본값보다 우선');
    eq(BM.auth.isDefaultGoogleClientId(), false, '직접 넣은 값 상태');
    BM.auth.setGoogleClientId('');
    eq(BM.auth.googleClientId(), BM.auth.DEFAULT_GOOGLE_CLIENT_ID, '지우면 기본값으로 복귀');
  });

  test('시작화면: Google·이메일·둘러보기 세 갈래가 한 화면에 있다', function () {
    clearAuth();
    var html = BM.views.start.render();
    includes(html, 'Google로 계속하기', '구글 버튼');
    includes(html, '이메일로 로그인', '이메일 버튼');
    includes(html, '로그인 없이 둘러보기', '둘러보기 버튼');
    includes(html, 'data-act="google"', '구글 액션');
    includes(html, 'data-act="to-email"', '이메일 액션');
    includes(html, 'data-act="guest"', '둘러보기 액션');
    includes(html, 'start__title', '브랜드 제목');

    var ui = BM.views.start.state();
    ui.screen = 'email';
    var form = BM.views.start.render();
    includes(form, 'data-f="email"', '이메일 입력(로그인 모드)');
    excludes(form, 'data-f="nick"', '가입 모드가 아니면 닉네임 칸 없음');
    ui.mode = 'signup';
    var signup = BM.views.start.render();
    includes(signup, 'data-f="nick"', '가입 모드 닉네임 칸');
    includes(signup, '가입하고 시작하기', '가입 버튼');
    ui.screen = 'home';
  });

  test('온보딩 화면: 급수 7개와 종목 3개를 한 화면에서 고른다', function () {
    clearAuth();
    BM.auth.signInGoogle(BM.auth.DEMO_GOOGLE);
    var html = BM.views.start.renderOnboarding(BM.auth.session());
    D.GRADES.forEach(function (g) { includes(html, 'data-val="' + g + '"', '급수: ' + g); });
    ['단식', '복식', '혼합복식'].forEach(function (d) { includes(html, 'data-val="' + d + '"', '종목: ' + d); });
    includes(html, 'data-act="finish"', '시작하기 버튼');
    includes(html, 'data-o="nick"', '닉네임 입력');
    includes(html, '10초', '짧은 안내');
    BM.auth.signOut();
  });

  test('MY 화면: 계정 카드에 상태·로그아웃·Client ID 설정이 있다', function () {
    clearAuth();
    var guest = BM.views.my.render(stateOf(BM.fixtures.demo()));
    includes(guest, 'data-region="account"', '계정 카드');
    includes(guest, '체험 모드', '체험 표시');
    includes(guest, 'data-act="account-login"', '로그인 버튼');
    includes(guest, '고급 · Google Client ID', 'Client ID 설정');
    return BM.auth.signInEmail({ email: 'my@example.com', password: 'secret12', nick: '마이', create: true, url: '' }).then(function () {
      var html = BM.views.my.render(stateOf(BM.fixtures.demo()));
      includes(html, '이메일 계정', '이메일 표시');
      includes(html, 'data-act="logout"', '로그아웃 버튼');
      includes(html, 'my@example.com', '이메일 주소');
      BM.auth.signOut();
    });
  });

  test('로컬 저장소: 계정별 데이터 키가 서로 섞이지 않는다', function () {
    clearAuth();
    U.storage.removeItem('bm_rows_v1');
    U.storage.removeItem('bm_rows_v1::guest@example.com');
    var guestApi = BM.api.createLocal({ latency: 0 });
    var acctApi = BM.api.createLocal({ latency: 0, rowsKey: 'bm_rows_v1::guest@example.com', meKey: 'u_test', me: { nick: '새회원', level: '', discipline: '' } });
    return guestApi.bootstrap().then(function (res) {
      eq(res.rows.length, 0, '체험 데이터 없음(빈 상태로 시작)');
      eq(res.me.nick, '체험 사용자', '체험 기본 닉네임(데모 인물 아님)');
      ok(Array.isArray(U.readJSON('bm_rows_v1', null)), '체험 데이터 키 생성');
      return acctApi.bootstrap();
    }).then(function (res) {
      eq(res.rows.length, 0, '계정도 빈 상태로 시작');
      eq(res.me.nick, '새회원', '계정 닉네임 적용');
      eq(res.me.key, 'u_test', '계정 전용 사용자 키');
      eq(res.me.level, '', '급수는 비어 있음(온보딩 대상)');
      eq(res.me.discipline, '', '종목은 비어 있음(온보딩 대상)');
      ok(Array.isArray(U.readJSON('bm_rows_v1::guest@example.com', null)), '계정 데이터 따로 저장');
      U.storage.removeItem('bm_rows_v1::guest@example.com');
    });
  });

  /* ================= 11. 매칭 검색 · 성별 필터 · 프로필 꾸미기 (v1.2) ================= */
  test('성별: 표기를 하나로 정리한다', function () {
    eq(D.normalizeGender('남성'), '남성', '남성');
    eq(D.normalizeGender('남'), '남성', '남');
    eq(D.normalizeGender('male'), '남성', 'male');
    eq(D.normalizeGender('여'), '여성', '여');
    eq(D.normalizeGender('Female'), '여성', 'Female');
    eq(D.normalizeGender('비공개'), '비공개', '비공개');
    eq(D.normalizeGender(''), '비공개', '빈 값 → 비공개');
    eq(D.normalizeGender(null), '비공개', 'null → 비공개');
    eq(D.VOCAB.genders.length, 3, '성별 3종');
  });

  test('검색: 닉네임·지역·클럽·소개 낱말로 찾는다', function () {
    var state = stateOf();
    function find(q) {
      return D.filterPlayers(state.data.matchProfiles, { query: q }, { excludeKey: BM.seed.ME })
        .map(function (p) { return p.nick; });
    }
    eq(find('콕집사').join(), '콕집사', '닉네임');
    includes(find('나래울').join(), '콕집사', '클럽으로 찾기');
    includes(find('강서').join(), '발놀림장인', '클럽 일부');
    includes(find('풋워크').join(), '발놀림장인', '소개 낱말');
    includes(find('경기').join(), '셔틀버스', '지역');
    eq(find('없는사람').length, 0, '없는 낱말');
    eq(find('').length, 8, '빈 검색어는 전부');
    eq(find('콕집사 발놀림').length, 0, '여러 낱말은 모두 만족해야');
  });

  test('검색: 검색어는 공백을 무시하고, 대소문자도 구분하지 않는다', function () {
    var players = [
      { userKey: 'x1', nick: 'Smash Kim', region: '서울', club: '강서 SH', bio: 'fast drive' }
    ];
    eq(D.filterPlayers(players, { query: 'smash' }).length, 1, '소문자 검색');
    eq(D.filterPlayers(players, { query: 'SMASH KIM' }).length, 1, '대문자+공백');
    eq(D.filterPlayers(players, { query: '강서SH' }).length, 1, '붙여 쓴 클럽명');
  });

  test('필터: 성별을 고르면 그 성별만 남고 비공개는 빠진다', function () {
    var state = stateOf();
    var women = D.filterPlayers(state.data.matchProfiles, { gender: '여성' }, { excludeKey: BM.seed.ME });
    var men = D.filterPlayers(state.data.matchProfiles, { gender: '남성' }, { excludeKey: BM.seed.ME });
    ok(women.length >= 3, '여성 선수');
    ok(men.length >= 3, '남성 선수');
    women.forEach(function (p) { eq(p.gender, '여성', p.nick + ' 성별'); });
    men.forEach(function (p) { eq(p.gender, '남성', p.nick + ' 성별'); });
    eq(women.length + men.length <= state.data.matchProfiles.length - 1, true, '비공개는 필터에서 빠짐');
    eq(D.filterPlayers([{ userKey: 'p', gender: '비공개', nick: '비밀' }], { gender: '여성' }).length, 0, '비공개 제외');
  });

  test('필터: 급수·성별·종목·지역을 함께 좁힌다', function () {
    var state = stateOf();
    var hit = D.filterPlayers(state.data.matchProfiles,
      { level: 'B조', gender: '여성', discipline: '혼합복식', region: '서울' }, { excludeKey: BM.seed.ME });
    eq(hit.length, 1, '조건 4개');
    eq(hit[0].nick, '하늘클리어', '맞는 선수');
    eq(D.activeFilters({ level: 'B조', gender: '전체', region: '경기', query: ' ' }).length, 2, '활성 조건 수');
  });

  test('매칭 화면: 검색창·성별 칩·결과 수·초기화가 있다', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    includes(html, 'data-search-input', '검색 입력창');
    includes(html, 'data-act="clear-search"', '검색어 지우기');
    includes(html, 'data-filter="gender" data-value="남성"', '성별 필터(남성)');
    includes(html, 'data-filter="gender" data-value="여성"', '성별 필터(여성)');
    includes(html, '명 찾음', '결과 수');
    includes(html, 'pill--gender', '카드의 성별 배지');
  });

  test('매칭 화면: 성별·검색 조건이 실제 목록에 적용된다', function () {
    var state = stateOf();
    state.ui.matchFilter.gender = '여성';
    var html = BM.views.matching.render(state);
    includes(html, '네트앞여우', '여성 선수 표시');
    excludes(html, '콕집사', '남성 선수 제외');
    includes(html, '전체 보기', '조건이 있으면 전체 보기 버튼');

    state.ui.matchFilter.gender = '전체';
    state.ui.matchFilter.query = '풋워크';
    var searched = BM.views.matching.render(state);
    includes(searched, '발놀림장인', '소개로 찾은 선수');
    excludes(searched, '셔틀버스', '검색에 맞지 않는 선수 제외');
    includes(searched, '검색 결과', '검색 결과 안내');

    state.ui.matchFilter.query = '';
    eq(BM.views.matching.visiblePlayers(state).length, 8, '조건이 없으면 전부');
  });

  test('매칭 화면: 조건에 맞는 사람이 없으면 안내와 초기화를 보여 준다', function () {
    var state = stateOf();
    state.ui.matchFilter.query = '존재하지않는닉네임';
    var html = BM.views.matching.render(state);
    checkHtml(html, '검색 결과 없음');
    includes(html, '조건에 맞는 플레이어가 없어요', '빈 결과 안내');
    includes(html, 'data-act="reset-filter"', '초기화 버튼');
    includes(html, '<b>0</b>명 찾음', '결과 0명');
  });

  /* ================= 11-b. 1:1 매칭 상태 탭 · 정렬 · 충전 안내 ================= */
  test('매칭: 찾기·받은 요청·보낸 요청·대화 탭과 건수가 보인다', function () {
    var state = stateOf();
    var html = BM.views.matching.render(state);
    checkHtml(html, '매칭 탭');
    includes(html, 'data-match-tab="find"', '찾기 탭');
    includes(html, 'data-match-tab="in"', '받은 요청 탭');
    includes(html, 'data-match-tab="out"', '보낸 요청 탭');
    includes(html, 'data-match-tab="chat"', '대화 탭');
    includes(html, 'mtab__n', '건수 배지');
    eq(BM.views.matching.pendingIncoming(state).length, 1, '받은 요청(대기) 1건');
    eq(BM.views.matching.sentRequests(state).length, 1, '보낸 요청 1건');
  });

  test('매칭: 받은 요청 탭에서 바로 수락·거절하고 상대 한마디를 본다', function () {
    var state = stateOf();
    state.ui.matchTab = 'in';
    var html = BM.views.matching.render(state);
    checkHtml(html, '받은 요청 탭');
    includes(html, '셔틀버스', '보낸 사람');
    includes(html, '평일 저녁 어때요?', '상대 한마디');
    includes(html, 'data-accept=', '수락 버튼');
    includes(html, 'data-decline=', '거절 버튼');
    excludes(html, '프로필 보고 요청하기', '찾기 목록은 보이지 않음');
  });

  test('매칭: 보낸 요청 탭은 상태를 그대로 보여 주고 수락이면 채팅으로 연결한다', function () {
    var state = stateOf();
    state.ui.matchTab = 'out';
    var html = BM.views.matching.render(state);
    checkHtml(html, '보낸 요청 탭');
    includes(html, '보낸 요청', '탭 제목');
    includes(html, '주말 오전 가능하실까요?', '내가 쓴 한마디');
    includes(html, 'data-open-chat=', '수락한 상대는 채팅 버튼');
  });

  test('매칭: 대화 탭에 대화방이 뜨고, 없으면 찾기로 안내한다', function () {
    var state = stateOf();
    state.ui.matchTab = 'chat';
    var html = BM.views.matching.render(state);
    checkHtml(html, '대화 탭');
    includes(html, 'data-open-chat=', '대화방');

    state.data.threads = [];
    var empty = BM.views.matching.render(state);
    includes(empty, '대화가 없어요', '빈 안내');
    includes(empty, 'data-match-tab="find"', '찾기로 가는 버튼');
  });

  test('매칭: 최근순 정렬은 최근에 만든 카드부터 보여 준다', function () {
    var state = stateOf();
    var byScore = BM.views.matching.visiblePlayers(state).map(function (p) { return p.nick; });
    state.ui.matchSort = 'recent';
    var recent = BM.views.matching.visiblePlayers(state);
    eq(recent.length, byScore.length, '같은 인원');
    for (var i = 1; i < recent.length; i++) {
      ok((recent[i - 1].createdAt || '') >= (recent[i].createdAt || ''), '최근 등록 순서');
    }
    includes(BM.views.matching.resultsHtml(state), 'sortseg__b is-on', '정렬 버튼 표시');
  });

  test('매칭: 필터 버튼을 누르면 칩 줄이 펼쳐지고 선택값이 버튼에 남는다', function () {
    var state = stateOf();
    state.ui.matchFilterOpen = 'level';
    state.ui.matchFilter.level = 'A조';
    var html = BM.views.matching.render(state);
    includes(html, 'fpanel is-open', '필터 줄 펼침');
    includes(html, '급수<b>A조</b>', '펼친 버튼에 선택값');
    includes(html, 'filter-line is-active', '펼친 줄 강조');
    includes(html, 'data-filter="level" data-value="A조"', '급수 칩');
  });

  test('매칭: 결과 영역은 검색창·필터와 분리되어 있다 (갱신해도 입력이 살아 있게)', function () {
    var html = BM.views.matching.render(stateOf());
    var resultsAt = html.indexOf('data-region="results"');
    var filtersAt = html.indexOf('data-region="filters"');
    ok(filtersAt > 0 && resultsAt > filtersAt, '필터 다음에 결과');
    includes(html.slice(0, resultsAt), 'data-search-input', '검색창은 결과 영역 밖');
  });

  test('매칭: 하트가 부족하면 요청 버튼 대신 충전으로 안내한다', function () {
    var state = stateOf();
    state.data.hearts.balance = 1;
    var p = state.data.matchProfiles.filter(function (m) { return m.userKey === 'demo_foot'; })[0];
    var html = BM.views.matching.profileBody(state, p);
    checkHtml(html, '하트 부족 시트');
    includes(html, '한마디 남기기', '한마디 입력');
    includes(html, '1개 부족', '부족 개수 안내');
    includes(html, 'data-charge-hearts', '충전 버튼');
    excludes(html, 'data-send-request', '눌러도 안 되는 요청 버튼은 두지 않음');
  });

  test('매칭: 수락하면 그 요청이 곧바로 대화방이 된다', function () {
    return freshStore().then(function (store) {
      var incoming = store.state.data.requests.filter(function (r) {
        return r.target === BM.seed.ME && r.status === '대기';
      })[0];
      var res = store.actions.respondMatch(incoming.id, '수락');
      ok(res.ok, '수락');
      store.actions.openChat(res.roomId, incoming.userKey);
      eq(store.state.ui.chatOpen, true, '채팅이 열림');
      eq(store.state.ui.chatRoom, incoming.id, '수락한 요청이 대화방 ID');
    });
  });

  test('프로필 꾸미기: 프레임·배경·배지를 정리하고 그린다', function () {
    var spec = D.normalizeAvatar({ avatar: '🐧', avatarFrame: 'gold', avatarBg: 'mint', avatarBadge: '🥇' });
    eq(spec.emoji, '🐧', '이모지');
    eq(spec.frame, 'gold', '프레임');
    eq(spec.bg, 'mint', '배경');
    eq(spec.badge, '🥇', '배지');
    eq(D.normalizeAvatar({ avatarFrame: 'nope', avatarBg: 'nope', avatarBadge: 'nope' }).frame, 'basic', '모르는 프레임 → 기본');
    eq(D.normalizeAvatar({ avatarPhoto: 'javascript:alert(1)' }).photo, '', '이미지 data URL만 허용');
    var photo = 'data:image/jpeg;base64,' + new Array(40).join('A');
    eq(D.normalizeAvatar({ avatarPhoto: photo }).photo, photo, '사진 유지');
    eq(D.normalizeAvatar({ avatarPhoto: 'data:image/jpeg;base64,' + new Array(70000).join('A') }).photo, '', '너무 큰 사진은 버림');

    var html = BM.ui.avatar(spec, 48);
    includes(html, 'avx--gold', '프레임 클래스');
    includes(html, 'avx--bg-mint', '배경 클래스');
    includes(html, 'avx__badge', '배지');
    includes(html, '🐧', '이모지');
    var withPhoto = BM.ui.avatar({ avatar: '🦊', avatarPhoto: photo, avatarFrame: 'neon' }, 40);
    includes(withPhoto, '<img', '사진은 img로');
    includes(withPhoto, 'avx--neon', '사진에도 프레임');
  });

  test('프로필 꾸미기: 저장하면 내 테마(꾸미기 칸)에 남는다', function () {
    return freshStore().then(function (store) {
      store.state.locks = {};
      var res = store.actions.saveProfile({
        avatar: '🦌', avatarFrame: 'royal', avatarBg: 'ocean', avatarBadge: '⭐', gender: '여성'
      });
      ok(res.ok, '저장');
      eq(store.state.me.theme.avatarFrame, 'royal', '프레임 저장');
      eq(store.state.me.theme.avatarBg, 'ocean', '배경 저장');
      eq(store.state.me.theme.avatarBadge, '⭐', '배지 저장');
      eq(store.state.me.gender, '여성', '성별 저장');
      var me = store.state.me;
      var html = BM.views.my.render(store.state);
      includes(html, 'avx--royal', 'MY 카드에 프레임');
      includes(html, 'avx--bg-ocean', 'MY 카드에 배경');
      includes(html, me.nick, '내 닉네임');
    });
  });

  test('프로필 꾸미기: 매칭 카드 JSON에도 사진·프레임이 들어간다', function () {
    return freshStore().then(function (store) {
      store.state.locks = {};
      store.actions.saveMatchProfile({
        region: '경기', level: 'C조', discipline: '복식', club: '나래울',
        availability: '주말', experience: '2~5년', bio: '소개', gender: '여성',
        avatar: '🐰', avatarFrame: 'sakura', avatarBg: 'grape', avatarBadge: '🔥'
      });
      var mp = store.state.data.matchProfiles.filter(function (m) { return m.userKey === BM.seed.ME; })[0];
      eq(mp.gender, '여성', '성별');
      eq(mp.avatarFrame, 'sakura', '프레임');
      eq(mp.avatarBg, 'grape', '배경');
      eq(mp.avatarBadge, '🔥', '배지');
      var html = BM.views.matching.render(store.state);
      includes(html, 'avx--sakura', '내 매칭 카드에 프레임');
    });
  });

  test('MY 화면: 꾸미기 입구는 프로필 꾸미기 하나 (사진·프레임도 그 시트에서)', function () {
    var state = stateOf();
    var html = BM.views.my.render(state);
    /* v1.16: 위 버튼 · 사진·프레임 카드 · 편집 아이콘으로 나뉘어 있던 입구를 하나로 모았습니다 */
    includes(html, 'data-act="decorate-sheet"', '꾸미기 버튼 하나');
    includes(html, 'profile__deco', '큰 버튼 스타일');
    includes(html, '프로필 사진 꾸미기', '아바타 버튼 라벨');
    excludes(html, 'data-region="decor"', '중복된 사진·프레임 카드는 그리지 않는다');
    excludes(html, 'data-act="edit-profile"', '중복 편집 아이콛 없음');
    excludes(html, 'data-act="pick-photo"', '카드 안 사진 버튼 없음');
    excludes(html, 'data-pick-frame="gold"', '카드 안 프레임 줄 없음');
    /* 사진·프레임은 꾸미기 시트 안에 그대로 있습니다 */
    var body = BM.views.my.decorateBody(BM.views.my.decorateDraft(state), state.me, state);
    includes(body, 'data-act="deco-photo"', '시트 안 사진 올리기');
    includes(body, 'data-dframe="gold"', '시트 안 프레임 선택');
  });

  test('온보딩: 성별도 함께 고르고, 프로필·매칭 카드에 저장한다', function () {
    clearAuth();
    BM.auth.signInGoogle(BM.auth.DEMO_GOOGLE);
    var html = BM.views.start.renderOnboarding(BM.auth.session());
    D.VOCAB.genders.forEach(function (g) { includes(html, 'data-val="' + g + '"', '성별: ' + g); });
    includes(html, 'data-pick="gender"', '성별 그룹');
    BM.auth.signOut();
    return freshStore({ empty: true }).then(function (store) {
      store.state.locks = {};
      store.actions.saveProfile({ nick: '새회원', level: 'D조', discipline: '단식', gender: '남성' });
      store.state.locks = {};
      store.actions.saveMatchProfile({ region: '서울', level: 'D조', discipline: '단식', gender: '남성' });
      var mp = store.state.data.matchProfiles.filter(function (m) { return m.userKey === BM.seed.ME; })[0];
      eq(mp.gender, '남성', '매칭 카드 성별');
      eq(store.state.me.gender, '남성', '프로필 성별');
    });
  });


  /* ================= 11. 커뮤니티 정리 (AI·샘플 글) ================= */
  test('커뮤니티: 예전 앱이 넣은 샘플 글은 보이지 않는다', function () {
    var rows = BM.fixtures.demo();
    rows.push(D.toRow({
      id: 's1', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '나래', userKey: BM.seed.ME, text: BM.seed.SAMPLE_POSTS[1]
    }));
    rows.push(D.toRow({
      id: 's2', type: '소셜', createdAt: U.stamp(), date: U.ymd(),
      nick: '나래', userKey: BM.seed.ME, text: '내가 직접 쓴 진짜 글입니다'
    }));
    var data = BM.store.derive(rows, BM.seed.ME);
    excludes(data.posts.map(function (p) { return p.text; }).join('|'), '나래울 클럽 토요일 오픈', '샘플 글 숨김');
    includes(data.posts.map(function (p) { return p.text; }).join('|'), '내가 직접 쓴 진짜 글입니다', '실제 글은 보임');
  });

  test('커뮤니티: 정리하면 샘플 글·답글·하트가 저장소에서도 사라진다', function () {
    return freshStoreWith([
      { id: 's1', type: '소셜', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, text: BM.seed.SAMPLE_POSTS[2] },
      { id: 'r1', type: '답글', createdAt: U.stamp(), date: U.ymd(), nick: '콕집사', userKey: 'demo_chi', target: 's1', text: BM.seed.SAMPLE_REPLIES[0] },
      { id: 'h1', type: '하트', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, target: 's1' },
      { id: 's2', type: '소셜', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, text: '지우면 안 되는 내 글' }
    ]).then(function (store) {
      var texts = store.state.rows.map(function (r) { return r[D.COL['소셜글']]; }).join('|');
      excludes(texts, BM.seed.SAMPLE_POSTS[2], '샘플 글 삭제');
      excludes(texts, BM.seed.SAMPLE_REPLIES[0], '샘플 답글 삭제');
      includes(texts, '지우면 안 되는 내 글', '내 글은 보존');
      ok(!store.state.data.posts.some(function (p) { return p.id === 's1'; }), '글 목록에서도 제외');
      var removed = store.actions.purgeSampleCommunity();
      eq(removed.removed, 0, '두 번 지우면 0건');
    });
  });

  /* ================= 12. 친구(친추) ================= */
  test('친구: 요청을 보내면 대기, 수락하면 친구가 되어 대화할 수 있다', function () {
    return freshStore().then(function (store) {
      eq(D.friendState(store.state.idx, BM.seed.ME, 'demo_chi').state, 'none', '처음엔 관계 없음');
      var r = store.actions.sendFriendRequest('demo_chi');
      ok(r.ok, '요청 보내기');
      eq(D.friendState(store.state.idx, BM.seed.ME, 'demo_chi').state, 'sent', '보낸 상태');
      eq(D.canChatWith(store.state.idx, BM.seed.ME, 'demo_chi'), false, '친구 전엔 대화 불가');
      store.state.locks = {};
      eq(store.actions.sendFriendRequest('demo_chi').reason, 'sent', '중복 요청 차단');

      /* 상대가 수락한 상황 (시트에서 내려온 행) */
      var rows = BM.fixtures.demo().concat([
        D.toRow({ id: 'fq1', type: '친구요청', createdAt: '2026-11-17 10:00:00', date: '2026-11-17', nick: '나래', userKey: BM.seed.ME, target: 'demo_chi' }),
        D.toRow({ id: 'fa1', type: '친구수락', createdAt: '2026-11-17 10:05:00', date: '2026-11-17', nick: '콕집사', userKey: 'demo_chi', target: BM.seed.ME })
      ]);
      var state = stateOf(rows);
      eq(D.friendState(state.data.idx, BM.seed.ME, 'demo_chi').state, 'friends', '친구 상태');
      eq(D.canChatWith(state.data.idx, BM.seed.ME, 'demo_chi'), true, '친구는 대화 가능');
      var thread = (state.data.threads || []).filter(function (t) { return t.other === 'demo_chi'; })[0];
      ok(thread, '대화방 생김');
      eq(thread.roomId, 'fa1', '친구수락 행이 대화방 ID');
      eq(D.friendState(state.data.idx, BM.seed.ME, 'demo_foot').state, 'none', '모르는 사이');
    });
  });

  test('친구: 받은 요청은 수락/거절, 친구는 끊을 수 있다', function () {
    return freshStoreWith([
      { id: 'fq2', type: '친구요청', createdAt: U.stamp(), date: U.ymd(), nick: '네트앞여우', userKey: 'demo_net', target: BM.seed.ME }
    ]).then(function (store) {
      var reqs = store.state.data.friendRequests;
      eq(reqs.length, 1, '받은 요청 1건');
      eq(reqs[0].id, 'fq2', '요청 ID');
      var res = store.actions.respondFriendRequest('fq2', true);
      ok(res.ok, '수락');
      eq(D.friendState(store.state.idx, BM.seed.ME, 'demo_net').state, 'friends', '친구');
      store.state.locks = {};
      var del = store.actions.removeFriend('demo_net');
      ok(del.ok, '친구 끊기');
      eq(D.friendState(store.state.idx, BM.seed.ME, 'demo_net').state, 'none', '끊긴 상태');
    });
  });

  test('친구: 거절하면 관계가 없어지고 다시 요청할 수 있다', function () {
    return freshStoreWith([
      { id: 'fq3', type: '친구요청', createdAt: U.stamp(), date: U.ymd(), nick: '드라이브요정', userKey: 'demo_drive', target: BM.seed.ME }
    ]).then(function (store) {
      ok(store.actions.respondFriendRequest('fq3', false).ok, '거절');
      eq(D.friendState(store.state.idx, BM.seed.ME, 'demo_drive').state, 'none', '거절 후 관계 없음');
      store.state.locks = {};
      ok(store.actions.sendFriendRequest('demo_drive').ok, '다시 요청 가능');
    });
  });

  test('친구: 프로필 버튼이 상태에 맞게 바뀐다', function () {
    var rows = BM.fixtures.demo().concat([
      D.toRow({ id: 'fq4', type: '친구요청', createdAt: U.stamp(), date: U.ymd(), nick: '발놀림장인', userKey: 'demo_foot', target: BM.seed.ME }),
      D.toRow({ id: 'fq5', type: '친구요청', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, target: 'demo_chi' }),
      D.toRow({ id: 'fa5', type: '친구수락', createdAt: U.stamp(), date: U.ymd(), nick: '콕집사', userKey: 'demo_chi', target: BM.seed.ME })
    ]);
    var state = stateOf(rows);
    includes(BM.views.profile.buttons(state, 'demo_foot'), 'data-friend-accept', '받은 요청 수락 버튼');
    includes(BM.views.profile.buttons(state, 'demo_chi'), 'data-friend-chat', '친구는 채팅 버튼');
    includes(BM.views.profile.buttons(state, 'demo_drive'), 'data-friend-add', '모르는 사람은 친구 추가');
    includes(BM.views.profile.buttons(state, 'demo_chi'), '친구 끊기', '친구 끊기');
  });

  /* ================= 13. 1:1 채팅 목록 ================= */
  test('채팅: 친구·매칭 상대가 메시지 없이도 대화 목록에 뜬다', function () {
    var rows = BM.fixtures.demo().concat([
      D.toRow({ id: 'fq6', type: '친구요청', createdAt: '2026-11-17 09:00:00', date: '2026-11-17', nick: '나래', userKey: BM.seed.ME, target: 'demo_drive' }),
      D.toRow({ id: 'fa6', type: '친구수락', createdAt: '2026-11-17 09:05:00', date: '2026-11-17', nick: '드라이브요정', userKey: 'demo_drive', target: BM.seed.ME })
    ]);
    var state = stateOf(rows);
    var friendThread = state.data.threads.filter(function (t) { return t.roomId === 'fa6'; })[0];
    ok(friendThread, '메시지 없어도 친구 대화방');
    eq(friendThread.other, 'demo_drive', '상대');
    eq(friendThread.kind, 'friend', '친구 대화방');
    var matchThread = state.data.threads.filter(function (t) { return t.kind === 'match'; })[0];
    ok(matchThread, '매칭 성사 대화방도 목록에');
    var html = BM.views.chat.listHtml(state);
    checkHtml(html, '채팅 목록');
    includes(html, 'data-thread="fa6"', '친구 대화방');
    includes(html, '대화를 시작해 보세요', '첫 대화 안내');
  });

  test('채팅: 받은 친구 요청은 목록 상단에서 수락/거절', function () {
    var rows = BM.fixtures.demo().concat([
      D.toRow({ id: 'fq7', type: '친구요청', createdAt: U.stamp(), date: U.ymd(), nick: '발놀림장인', userKey: 'demo_foot', target: BM.seed.ME })
    ]);
    var state = stateOf(rows);
    var html = BM.views.chat.listHtml(state);
    includes(html, '받은 친구 요청', '요청 섹션');
    includes(html, 'data-req-accept="fq7"', '수락 버튼');
    includes(html, 'data-req-reject="fq7"', '거절 버튼');
    includes(html, '발놀림장인', '신청자 이름');
  });

  test('채팅: 친구가 아닌 상대에게는 메시지를 보낼 수 없다', function () {
    return freshStore().then(function (store) {
      var res = store.actions.sendChat('anyroom', 'demo_drive', '안녕하세요');
      eq(res.ok, false, '차단');
      eq(res.reason, 'not_allowed', '이유');
      store.state.locks = {};
      var okRes = store.actions.sendChat('anyroom', 'demo_net', '매칭된 상대에게는 가능');
      ok(okRes.ok, '매칭 상대에게 전송');
    });
  });

  /* ================= 14. 멘토 신청·관리자 심사 ================= */
  test('멘토: 신청은 관리자에게 전달되고 심사중으로 남는다', function () {
    return freshStore().then(function (store) {
      eq(D.isAdminMe(store.state.me), false, '일반 계정은 관리자 아님');
      var res = store.actions.requestMentor({
        type: '코치', experience: '5년', awards: '시 대회 3위', reason: '초보 스매시 폼을 봐드릴 수 있어요'
      });
      ok(res.ok, '신청 접수');
      var app = (store.state.data.idx.byType['멘토신청'] || [])[0];
      ok(app, '멘토신청 행');
      eq(app.target, D.ADMIN_TARGET, '대상은 관리자');
      eq(app.status, '심사중', '심사중');
      eq(store.state.data.mentorApps.length, 1, '내 신청 1건');
      store.state.locks = {};
      eq(store.actions.decideMentor(app.id, '승인').reason, 'forbidden', '일반 사용자는 승인 불가');
      store.state.ui.coachTab = 'apply';
      var html = BM.views.coach.render(store.state);
      includes(html, '관리자에게 멘토 신청이 전달되었습니다', '전달 안내');
      excludes(html, '조건 확인 후 수락', '심사 버튼 없음');
    });
  });

  test('멘토: 관리자만 조건을 보고 수락/거절한다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({
      latency: 0, me: { email: 'csw42060713@gmail.com', nick: '승우' }
    });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () {
      eq(D.isAdminMe(store.state.me), true, '관리자 로그인');
      var apps = store.state.data.mentorApps;
      ok(apps.length >= 2, '관리자는 모든 신청을 본다');
      var html = BM.views.coach.render(store.state);
      includes(html, '도착한 멘토 신청', '상단 배너');
      store.state.ui.coachTab = 'approve';
      html = BM.views.coach.render(store.state);
      includes(html, '조건 확인 후 수락', '수락 버튼');
      includes(html, '거절', '거절 버튼');
      var pending = apps.filter(function (a) { return a.status === '심사중'; })[0];
      ok(pending, '심사중 신청');
      var res = store.actions.decideMentor(pending.id, '승인');
      ok(res.ok, '승인');
      var after = stateApps(store, pending.id);
      eq(after.status, '승인', '상태 반영');
      eq((store.state.queue[0] || {}).kind, 'update', '시트 수정 요청');
      var audit = (store.state.data.idx.byType['멘토승인'] || [])[0];
      ok(audit, '심사 기록');
      eq(audit.target, pending.userKey, '대상');
      store.state.locks = {};
      var next = store.state.data.mentorApps.filter(function (a) { return a.status === '심사중'; })[0];
      if (next) eq(store.actions.decideMentor(next.id, '거절').ok, true, '거절');
    });
  });

  function stateApps(store, id) {
    return (store.state.data.idx.byType['멘토신청'] || []).concat(store.state.data.idx.byType['코치신청'] || [])
      .filter(function (a) { return a.id === id; })[0];
  }

  test('멘토: 관리자 계정 판별은 이메일 기준', function () {
    eq(D.isAdminEmail('CSW42060713@gmail.com'), true, '대소문자 무시');
    eq(D.isAdminEmail('someone@example.com'), false, '일반 계정');
    eq(D.isAdminMe({ email: 'csw42060713@gmail.com' }), true, '로컬 로그인');
    eq(D.isAdminMe({ admin: true }), true, '브리지가 내려 준 관리자 표시');
    eq(D.isAdminMe({ email: 'player@gmail.com' }), false, '일반');
    eq(D.ADMIN_TARGET, 'csw42060713@gmail.com', '신청 대상 관리자');
  });

  test('멘토: 일반 사용자 화면에는 내 신청 상태만 보인다', function () {
    var rows = BM.fixtures.demo();
    var state = stateOf(rows);
    var html = BM.views.coach.render(state);
    includes(html, '멘토 신청', '신청 탭');
    excludes(html, '멘토 신청 심사', '심사 탭은 관리자만');
    excludes(html, '도착한 멘토 신청', '배너 없음');
    state.ui.coachTab = 'approve';
    var html2 = BM.views.coach.render(state);
    excludes(html2, '조건 확인 후 수락', '남의 신청을 승인할 수 없음');
  });

  /* ================= 15. 사용성 개선 (v1.7.2) ================= */

  test('게임 점수: 여러 게임을 한 칸에 저장하고 다시 읽는다', function () {
    var games = [{ a: 21, b: 18 }, { a: 18, b: 21 }];
    eq(D.formatGames(games, 21), '21:18, 18:21', '21점제 두 경기');
    eq(D.formatGames([{ a: 25, b: 23 }], 25), '25점제 25:23', '25점제 표시');
    var parsed = D.parseGames('25점제 25:23, 21:19');
    eq(parsed.length, 2, '두 경기');
    eq(parsed[0].a, 25, '첫 경기 내 점수');
    eq(parsed[1].mode, 25, '25점제 표시 유지');
    var old = D.parseGames('21:18');
    eq(old.length, 1, '예전 한 경기 기록');
    eq(old[0].mode, 21, '기본 21점제');
  });

  test('게임 점수: 승패는 여러 경기를 합쳐 계산한다', function () {
    var sum = D.gamesSummary([{ a: 21, b: 18 }, { a: 21, b: 15 }, { a: 15, b: 21 }]);
    eq(sum.count, 3, '경기 수');
    eq(sum.wins, 2, '승');
    eq(sum.losses, 1, '패');
    eq(sum.result, '승', '합산 결과');
    eq(D.gamesSummary([{ a: 3, b: 3 }]).result, '무', '무승부');
    eq(D.gamesSummary([]).result, '', '경기 없음');
    eq(D.cleanGames([{ a: '', b: '' }, { a: 21, b: 18 }]).length, 1, '빈 게임은 버린다');
  });

  test('게임 점수: 26칸 시트 행으로 저장해도 그대로 (25점제)', function () {
    var row = D.toRow({ id: 'x1', type: '기록', scoreRaw: '25점제 25:23, 21:19', result: '승' });
    eq(row.length, 26, '칸 수');
    eq(row[D.COL['게임점수']], '25점제 25:23, 21:19', '게임점수 칸');
    var e = D.fromRow(row);
    eq(e.games.length, 2, '두 경기로 읽힘');
    eq(e.score.a, 25, '첫 경기 점수');
    eq(e.games[0].mode, 25, '25점제');
  });

  test('AI: 여러 경기 결과가 분석에 들어간다', function () {
    var an = AI.analyze({
      draft: {
        date: U.ymd(), cond: 6, intensity: 6, minutes: 90, gameMode: 21,
        games: [{ a: 21, b: 18 }, { a: 21, b: 15 }, { a: 18, b: 21 }]
      },
      records: [], level: 'C조'
    });
    ok(an.insights.some(function (it) { return it.label.indexOf('3경기') >= 0; }), '경기 수 안내');
    includes(JSON.stringify(an), '2승 1패', '승패 요약');
  });

  /* ================= 2-1. 경기 흐름 · 주간 부하 (2026-11-19) ================= */

  test('AI: 접전이 많은 날은 후반 운영을 짚어 준다', function () {
    var an = AI.analyze({
      draft: { cond: 6, intensity: 7, minutes: 90, games: [{ a: 21, b: 19 }, { a: 22, b: 20 }, { a: 18, b: 21 }] },
      records: [], level: 'B조', discipline: '복식'
    });
    eq(an.flow.count, 3, '경기 수');
    eq(an.flow.wins, 2, '승');
    eq(an.flow.deuce, 2, '마지막까지 간 경기');
    eq(an.flow.close, 3, '3점차 이내');
    ok(an.flow.tips.length >= 1 && an.flow.tips.length <= 3, '문구 1~3개');
    var text = an.flow.tips.join(' ');
    includes(text, '마지막 2~3점', '후반 운영');
    includes(text, '서브 실점', '복식 서브·리시브 실점');
    excludes(text, 'undefined', '빈 값 없음');
  });

  test('AI: 마지막 경기에서 점수차가 벌어지면 후반 피로를 짚는다', function () {
    var an = AI.analyze({
      draft: { cond: 6, intensity: 7, minutes: 110, games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 11, b: 21 }] },
      records: [], level: 'C조', discipline: '단식'
    });
    eq(an.flow.fade, true, '후반 흐름 악화');
    eq(an.flow.lastMargin, -10, '마지막 경기 점수차');
    includes(an.flow.tips.join(' '), '60~90초', '경기 사이 회복');
    includes(an.flow.tips.join(' '), '11점 전·후', '단식은 점수 구간으로 기록');
    excludes(an.flow.tips.join(' '), '서브 실점과 리시브 실점만', '단식에 복식 문구 없음');
  });

  test('AI: 흐름이 좋아지는 날은 후반 피로로 말하지 않는다', function () {
    var an = AI.analyze({
      draft: { cond: 7, intensity: 6, minutes: 80, games: [{ a: 14, b: 21 }, { a: 21, b: 16 }, { a: 21, b: 18 }] },
      records: [], level: 'C조'
    });
    eq(an.flow.fade, false, '후반 피로 아님');
    excludes(an.flow.tips.join(' '), '60~90초', '회복 문구 없음');
  });

  test('AI: 21점제와 25점제를 구분해 접전을 센다', function () {
    var g = [{ a: 23, b: 21 }];
    var a21 = AI.analyze({ draft: { cond: 6, intensity: 6, minutes: 60, gameMode: 21, games: g }, records: [], level: 'C조' });
    var a25 = AI.analyze({ draft: { cond: 6, intensity: 6, minutes: 60, gameMode: 25, games: g }, records: [], level: 'C조' });
    eq(a21.flow.mode, 21, '21점제');
    eq(a25.flow.mode, 25, '25점제');
    eq(a21.flow.deuce, 1, '21점제 23:21은 마지막까지 간 경기');
    eq(a25.flow.deuce, 0, '25점제 23:21은 막판 승부가 아님');
    includes(a25.flow.tips.join(' '), '25점제', '점수제 표기');
  });

  test('AI: 주간 부하가 급증한 주는 경고한다', function () {
    var history = [];
    [8, 11, 15, 19, 22, 26].forEach(function (d) { history.push(rec(-d, { minutes: 60, intensity: 5 })); });
    var an = AI.analyze({
      draft: { cond: 7, intensity: 8, minutes: 120, games: [] },
      records: history.concat([
        rec(-1, { minutes: 120, intensity: 8 }),
        rec(-2, { minutes: 120, intensity: 8 }),
        rec(-4, { minutes: 110, intensity: 8 })
      ]),
      level: 'B조'
    });
    eq(an.load.zone, 'spike', '급증');
    ok(an.load.ratio >= 1.5, '비율: ' + an.load.ratio);
    includes(an.load.tips.join(' '), '10%', '다음 주 10% 이내');
    ok(an.risk.some(function (r) { return r.level === 'warn' && r.text.indexOf('부하') >= 0; }), '경고에 부하');
    ok(an.insights.some(function (it) { return it.label.indexOf('주간 부하') >= 0; }), '진단에 부하');
  });

  test('AI: 평소와 비슷한 주는 부하 적정으로 말한다', function () {
    var history = [];
    [-1, -4, -7, -10, -13, -14, -17, -20, -21, -24, -27, -28, -31, -34].forEach(function (d) {
      history.push(rec(d, { minutes: 60, intensity: 5 }));
    });
    var an = AI.analyze({ draft: { cond: 6, intensity: 5, minutes: 60 }, records: history, level: 'C조' });
    eq(an.load.zone, 'ok', '적정 구간');
    ok(an.load.ratio >= 0.8 && an.load.ratio <= 1.3, '비율: ' + an.load.ratio);
    ok(an.load.tips.length >= 1, '문구');
  });

  test('AI: 부하 기록이 모자라면 부하 점검을 하지 않는다', function () {
    var an = AI.analyze({ draft: { cond: 6, intensity: 6, minutes: 60 }, records: [rec(-2)], level: 'C조' });
    eq(an.load.zone, '', '점검 안 함');
    eq(an.load.tips.length, 0, '문구 없음');
    eq(an.load.ratio, 0, '비율 0');
    excludes(JSON.stringify(an), 'NaN', 'NaN 없음');
  });

  test('화면: 경기 흐름·부하 점검이 분석 카드에 나온다', function () {
    var history = [];
    [8, 11, 15, 19, 22, 26].forEach(function (d) { history.push(rec(-d, { minutes: 60, intensity: 5 })); });
    var state = stateOf();
    state.drafts.log = {
      date: U.ymd(), cond: 6, intensity: 7, minutes: 90, discipline: '복식',
      games: [{ a: 21, b: 19 }, { a: 18, b: 21 }, { a: 12, b: 21 }], pain: [], weakness: ['리시브']
    };
    state.data.records = history;
    state.analysis = AI.analyze({ draft: state.drafts.log, records: history, level: 'B조', discipline: '복식' });
    var html = BM.views.log.render(state);
    checkHtml(html, '흐름·부하 카드');
    includes(html, '경기 흐름', '경기 흐름 제목');
    includes(html, '21점제', '점수제 표기');
    includes(html, '부하 점검', '부하 제목');
  });

  test('저장: 여러 게임을 한 일지로 저장한다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setDraft({ gameMode: 25, games: [{ a: 25, b: 23 }, { a: 21, b: 19 }] });
      var res = store.actions.saveLog();
      ok(res.ok, '저장');
      var rec = store.state.data.records[0];
      eq(rec.games.length, 2, '두 경기');
      eq(rec.result, '승', '합산 승');
      eq(rec.scoreRaw, '25점제 25:23, 21:19', '시트 칸 표기');
      return store.flush();
    }).then(function () {
      return BM.api.createLocal({ latency: 0 }).bootstrap();
    }).then(function (res) {
      var row = (res.rows || []).filter(function (r) { return r[D.COL['유형']] === '기록'; })[0];
      ok(row, '저장된 기록 행');
      eq(row[D.COL['게임점수']], '25점제 25:23, 21:19', '시트에 남은 점수');
      eq(row[D.COL['승패']], '승', '시트 승패');
    });
  });

  test('저장: 예전 한 경기 점수 입력도 그대로 저장된다', function () {
    return freshStore({ empty: true }).then(function (store) {
      store.actions.setDraft({ score: { a: 21, b: 18 }, games: undefined });
      var res = store.actions.saveLog();
      ok(res.ok, '저장');
      var rec = store.state.data.records[0];
      eq(rec.scoreRaw, '21:18', '한 경기 표기');
      eq(rec.result, '승', '승패');
    });
  });

  test('일지: 저장 전 기본값이 입력 완료처럼 보이지 않는다', function () {
    return freshStore({ empty: true }).then(function (store) {
      var d = store.state.drafts.log;
      eq(d.minutes, null, '운동 시간 비어 있음');
      eq(d.score, null, '점수 비어 있음');
      eq(d.result, '', '결과 비어 있음');
      eq(d.cond, null, '컨디션 비어 있음');
      eq((d.games || []).length, 1, '게임 한 줄');
      eq(d.games[0].a, '', '점수 칸 비어 있음');
      var html = BM.views.log.render(store.state);
      includes(html, '미입력', '미입력 표시');
      excludes(html, '21:18', '예전 기본 점수 없음');
      excludes(html, 'value="60"', '예전 기본 시간 없음');
    });
  });

  test('일지: 게임 추가·21/25점제 버튼이 있다', function () {
    var state = stateOf();
    state.drafts.log = {
      date: U.ymd(), cond: null, intensity: null, minutes: null, done: [],
      gameMode: 21, games: [{ a: 21, b: 18 }, { a: 18, b: 21 }],
      score: null, result: '', pain: [], weakness: [], note: ''
    };
    var html = BM.views.log.render(state);
    includes(html, 'data-act="add-game"', '게임 추가 버튼');
    includes(html, 'data-gamemode-val="25"', '25점제 선택');
    includes(html, 'data-gamemode-val="21"', '21점제 선택');
    includes(html, '2경기', '경기 수 요약');
    checkHtml(html, '일지 화면');
  });

  test('체험 모드: 예전 대기열(저장 중… 35건)을 읽지 않고 지운다', function () {
    clearStorage();
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var legacy = [];
    for (var i = 0; i < 35; i++) legacy.push({ kind: 'append', row: ['legacy' + i], clientId: 'c' + i });
    U.writeJSON('bm_queue_v1', legacy);
    var store = BM.store.createStore({ api: BM.api.createLocal({ latency: 0 }) });
    eq(store.state.queue.length, 0, '처음부터 대기 0건');
    eq(U.storage.getItem('bm_queue_v1'), null, '예전 대기열 삭제');
    return store.actions.init().then(function () {
      var r = store.actions.createPost('오늘 21:18로 이겼다');
      ok(r.ok, '글쓰기');
      return store.flush();
    }).then(function () {
      eq(store.state.queue.length, 0, '전송 완료');
      eq(U.storage.getItem('bm_queue_v1'), null, '기기 저장 모드에서는 대기열을 남기지 않는다');
      eq(store.state.syncState, 'idle', '동기화 표시 없음');
    });
  });

  test('체험 모드: 예전 데모 인물·기록을 한 번 걷어 낸다', function () {
    clearStorage();
    var rows = [];
    rows.push(D.toRow({ id: 'legacy-post', type: '소셜', userKey: 'demo_chi', nick: '콕집사', text: BM.seed.SAMPLE_POSTS[2] }));
    rows.push(D.toRow({ id: 'legacy-rec', type: '기록', userKey: 'demo_chi', nick: '콕집사', date: U.ymd(), cond: 6, score: { a: 21, b: 18 } }));
    rows.push(D.toRow({ id: 'my-rec', type: '기록', userKey: BM.seed.ME, nick: '나', date: U.ymd(), minutes: 40 }));
    U.writeJSON('bm_rows_v1', rows);
    return BM.api.createLocal({ latency: 0 }).bootstrap().then(function (res) {
      var keys = res.rows.map(function (r) { return r[D.COL['사용자ID']]; });
      ok(keys.indexOf('demo_chi') < 0, '데모 인물 기록 삭제');
      ok(keys.indexOf(BM.seed.ME) >= 0, '내 기록 유지');
      eq(res.rows.length, 1, '내 기록만 남는다');
    });
  });

  test('코치: 기본 화면은 선수용 코치 찾기·피드백이다', function () {
    var state = stateOf();
    state.ui.coachTab = '';
    var html = BM.views.coach.render(state);
    includes(html, '코치 찾기 · 피드백', '선수용 탭 이름');
    includes(html, 'data-coachtab="apply"', '멘토 신청은 두 번째 탭');
    includes(html, '코치에게 피드백 받기', '선수 안내 카드');
    excludes(html, '멘토 신청 심사', '심사 탭 없음');
    checkHtml(html, '코치 화면');
  });

  test('코치: 승인된 코치는 선수 화면에 보인다', function () {
    var rows = BM.fixtures.demo();
    rows.push(D.toRow({
      id: 'mentor-ok', type: '멘토신청', createdAt: U.stamp(), date: U.ymd(),
      nick: '코치님', userKey: 'demo_coach9', target: D.ADMIN_TARGET,
      payload: { status: '승인', level: 'B조', discipline: '복식', region: '경기', club: '나래울', reason: '지도' }
    }));
    var state = stateOf(rows);
    state.ui.coachTab = '';
    var html = BM.views.coach.render(state);
    includes(html, '코치님', '승인 코치 표시');
  });

  /* ================= 11. 꾸미기 해금 · 연속 출석 · 일지 공유 ================= */

  test('꾸미기: 잠긴 프레임은 하트를 한 번만 차감한다', function () {
    return freshStore().then(function (store) {
      var before = store.state.data.hearts.balance;
      var r1 = store.actions.buyDeco('frame', 'gold');
      ok(r1.ok, '해금 성공');
      eq(r1.purchased, true, '처음에는 산다');
      eq(r1.price, 2, '골드 프레임은 하트 2개');
      eq(store.state.data.hearts.balance, before - 2, '하트 차감');

      store.state.locks = {};      /* 연타 잠금은 테스트에서 바로 풉니다 */
      var r2 = store.actions.buyDeco('frame', 'gold');
      ok(r2.ok, '두 번째도 성공(적용만)');      eq(r2.purchased, false, '이미 산 것은 다시 사지 않는다');
      eq(store.state.data.hearts.balance, before - 2, '잔액 그대로');

      /* 남은 하트를 다 쓰고 나면 다음 해금은 막힌다 */
      ['neon', 'royal', 'sakura'].forEach(function (id) {
        store.state.locks = {};
        ok(store.actions.buyDeco('frame', id).ok, '해금: ' + id);
      });
      eq(store.state.data.hearts.balance, 0, '잔액 0');
      store.state.locks = {};
      var r3 = store.actions.buyDeco('badge', '🔥');
      eq(r3.ok, false, '하트가 모자라면 막힌다');
      eq(r3.reason, 'hearts', '이유: 하트 부족');
      eq(r3.need, 1, '부족한 개수');
    });
  });

  test('꾸미기: 무료·연속 출석 해금은 하트를 쓰지 않는다', function () {
    var rows = [];
    for (var i = 0; i < 3; i++) {
      rows.push({ id: U.uid(), type: '출석하트', userKey: BM.seed.ME, date: U.ymd(U.addDays(new Date(), -i)), likes: 1, createdAt: U.stamp() });
    }
    return freshStoreWith(rows).then(function (store) {
      var free = store.actions.buyDeco('frame', 'court');
      eq(free.ok, true, '무료 프레임');
      eq(free.purchased, false, '무료는 결제 없음');

      var before = store.state.data.hearts.balance;
      var star = store.actions.buyDeco('badge', '⭐');
      eq(star.ok, true, '3일 연속 출석 배지');
      eq(star.purchased, false, '연속 출석은 무료');
      eq(store.state.data.hearts.balance, before, '하트 그대로');
    });
  });

  test('연속 출석: 오늘까지 이어진 날 수만 센다', function () {
    function row(offset) {
      return { id: U.uid(), type: '출석하트', userKey: 'u1', date: U.ymd(U.addDays(new Date(), offset)), likes: 1 };
    }
    var idx = D.index([row(0), row(-1), row(-2), row(-5)]);
    eq(D.checkinStreak(idx, 'u1'), 3, '사흘 연속');
    eq(D.nextStreakMilestone(3).days, 7, '다음 목표는 7일');
    eq(D.nextStreakMilestone(2).left, 1, '3일까지 1일');
    var old = D.index([row(-3), row(-4)]);
    eq(D.checkinStreak(old, 'u1'), 0, '사흘 비면 끊긴다');
    eq(D.checkinStreak(D.index([]), 'u1'), 0, '기록 없음');
    eq(D.streakUnlocked(7).indexOf('badge:medal') >= 0, true, '7일이면 메달 배지');
  });

  test('테마를 바꿔도 사진·프레임·배지가 남는다', function () {
    return freshStore().then(function (store) {
      store.actions.saveProfile({ avatar: '🦊', avatarFrame: 'gold', avatarBadge: '⭐', avatarBg: 'mint' });
      var r = store.actions.setTheme('th_court');
      ok(r.ok, '테마 적용');
      var th = store.state.me.theme;
      eq(th.theme, 'th_court', '테마 바뀜');
      eq(th.avatarFrame, 'gold', '프레임 유지');
      eq(th.avatarBadge, '⭐', '배지 유지');
      eq(th.avatarBg, 'mint', '배경 유지');
      eq(th.avatar, '🦊', '이모지 유지');
    });
  });

  test('일지 공유: 저장한 일지를 커뮤니티에 한 번만 올린다', function () {
    return freshStore().then(function (store) {
      store.actions.setDraft({ minutes: 60, done: ['스트록'], cond: 7, games: [{ a: 21, b: 18 }, { a: 18, b: 21 }] });
      var saved = store.actions.saveLog();
      ok(saved.ok, '일지 저장');

      var postCount = store.state.data.posts.length;
      var r = store.actions.shareLogToCommunity();
      ok(r.ok, '공유 성공');
      ok(r.text.indexOf('2경기 1승 1패') >= 0, '전적이 들어간다: ' + r.text);
      eq(store.state.data.posts.length, postCount + 1, '글이 하나 늘어난다');
      eq(store.state.ui.lastSavedLog, null, '공유 뒤 카드는 접힌다');

      store.state.locks = {};
      var again = store.actions.shareLogToCommunity(saved.entity.id);
      eq(again.ok, false, '같은 일지는 다시 올리지 않는다');
      eq(again.reason, 'already', '이유: 이미 공유');
      eq(store.state.data.posts.length, postCount + 1, '글 수 그대로');
    });
  });

  test('일지 화면: 저장 직후에만 공유 버튼이 보인다', function () {
    var state = stateOf();
    state.analysis = BM.ai.analyze({ draft: state.drafts.log, records: state.data.records, level: 'C조', nick: '나래' });
    var plain = BM.views.log.render(state);
    excludes(plain, '커뮤니티에 오늘 운동 공유', '저장 전에는 없다');

    state.ui.lastSavedLog = { id: 'log-1', date: U.ymd(), minutes: 60, done: ['스트록'], games: [{ a: 21, b: 18 }], cond: 7 };
    var html = BM.views.log.render(state);
    includes(html, '커뮤니티에 오늘 운동 공유', '공유 버튼');
    includes(html, 'data-act="share-log"', '버튼 동작');
    includes(html, '1경기 1승 0패', '미리보기 전적');
    checkHtml(html, '공유 카드');
  });

  test('MY 화면: 연속 출석과 잠긴 꾸미기를 보여 준다', function () {
    var rows = BM.fixtures.demo();
    for (var i = 0; i < 2; i++) {
      rows.push(D.toRow({ id: U.uid(), type: '출석하트', userKey: BM.seed.ME, date: U.ymd(U.addDays(new Date(), -i)), likes: 1, createdAt: U.stamp() }));
    }
    var st = stateOf(rows);
    var html = BM.views.my.render(st);
    var streak = st.data.hearts.checkinStreak;
    ok(streak >= 2, '연속 출석 계산: ' + streak);
    includes(html, streak + '일 연속 출석 중', '연속 출석 표시 (하트 카드)');
    includes(html, '일까지', '다음 목표');
    /* 잠긴 꾸미기(하트 해금)는 이제 꾸미기 시트 안에서 보여 줍니다 */
    var body = BM.views.my.decorateBody(BM.views.my.decorateDraft(st), st.me, st);
    includes(body, 'is-locked', '잠긴 꾸미기 표시');
    includes(body, 'decolock', '해금 가격 표시');
    checkHtml(html, 'MY-꾸미기');
  });

  test('커뮤니티: 승인된 멘토의 답글에만 멘토 조언 배지가 붙는다', function () {
    var rows = BM.fixtures.demo();
    rows.push(D.toRow({ id: 'share-1', type: '소셜', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, text: '오늘 60분 스트록' }));
    rows.push(D.toRow({ id: 'r1', type: '답글', createdAt: U.stamp(), date: U.ymd(), nick: '코치님', userKey: 'demo_coach9', target: 'share-1', text: '풋워크를 먼저 잡아 보세요.' }));
    rows.push(D.toRow({ id: 'r2', type: '답글', createdAt: U.stamp(), date: U.ymd(), nick: '나래', userKey: BM.seed.ME, target: 'share-1', text: '감사합니다.' }));
    rows.push(D.toRow({
      id: 'mentor-ok', type: '멘토신청', createdAt: U.stamp(), date: U.ymd(),
      nick: '코치님', userKey: 'demo_coach9', target: D.ADMIN_TARGET,
      payload: { status: '승인', level: 'B조', discipline: '복식', region: '경기', reason: '지도' }
    }));
    var state = stateOf(rows);
    var replies = state.data.posts.filter(function (p) { return p.id === 'share-1'; })[0].replies;
    eq(replies.filter(function (r) { return r.mentor; }).length, 1, '멘토 답글 1개');
    BM.views.community._openReplies['share-1'] = true;
    var html = BM.views.community.render(state);
    includes(html, '멘토 조언', '배지 표시');
    checkHtml(html, '커뮤니티-멘토');
  });

  test('광고 어댑터: 화면이 없으면 보상을 지급하지 않는다', function () {
    ok(BM.ads && typeof BM.ads.showRewarded === 'function', 'BM.ads가 있다');
    eq(typeof BM.ads.bridge(), 'object', '브리지 조회(없으면 null)');
    return BM.ads.showRewarded({ unit: 'heart_reward' }).then(function (r) {
      eq(r.rewarded, false, '화면 없는 환경에서는 지급 없음');
      eq(r.reason, 'no_dom', '이유: 화면 없음');
    });
  });

  test('광고 어댑터: ui.hasDom이 값(true)이어도 시트를 띄운다', function () {
    /* ui.js는 hasDom을 true/false 값으로 내보냅니다.
     * 예전 코드는 UI.hasDom()으로 불러 그 자리에서 예외가 났고, 버튼만 잠긴 채 남았습니다. */
    var real = BM.ui;
    var calls = [];
    BM.ui = {
      hasDom: true,
      openSheet: function (opts) { calls.push(opts.title || ''); return null; },
      closeSheet: function () {}
    };
    return BM.ads.showRewarded({ unit: 'heart_reward' }).then(function (r) {
      BM.ui = real;
      eq(calls.length, 1, '시트를 한 번 띄우려 한다');
      includes(calls[0], '광고', '시트 제목');
      eq(r.rewarded, false, '시트가 없으면 지급하지 않는다');
      eq(r.reason, 'no_sheet', '이유: 시트 없음');
    }, function (e) {
      BM.ui = real;
      throw e;
    });
  });

  /* ---------- 자동 실행 ---------- */
  if (typeof process !== 'undefined' && process.argv && /run\.js$/.test(process.argv[1] || '')) {
    BM.test.run().then(function (sum) {
      sum.results.forEach(function (r) {
        console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.error ? '\n      ' + r.error : ''));
      });
      console.log('\n' + sum.passed + '/' + sum.total + ' 통과' + (sum.failed ? ' · 실패 ' + sum.failed : ''));
      process.exitCode = sum.failed ? 1 : 0;
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
