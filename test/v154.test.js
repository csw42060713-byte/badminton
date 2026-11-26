/* ============================================================
 * test/v154.test.js — bm-v1.73.0
 *   🏆 점수판 파트너 · 라이벌 전적 자동 누적
 *
 *  사용자가 고른 기능 그대로 검증합니다.
 *   1) 코트 점수판에서 파트너(내 팀)·상대(라이벌) 이름을 1~2탭으로 고른다
 *      · 세로/가로 점수판 모두 · 비워 두면 예전처럼 점수만 · +1/−1/코트 교대 그대로
 *   2) '오늘 일지에 넣기' → 점수·메모와 함께 파트너·상대 이름이 일지 폼으로 넘어간다
 *   3) 일지를 저장하면 라이벌 맞대결 전적(총 경기·승/패·승률·최근 스코어)이 쌓인다
 *      · 기존 파트너 전적·예전 일지('팀' 칸에 이름만 적힌 줄)와 호환
 *   4) 일지 입력칸·전적 카드에서 '이 상대에게 몇 승 몇 패'를 한눈에
 *   5) 보안(이름 이스케이프·길이) · 버전(sw·app·TWA·styles.css) · 새 칸 없음
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

  function SB() { return BM.scoreboard; }
  function LOG() { return BM.views.log; }

  function rally(st, side, n) {
    for (var i = 0; i < n; i++) st = SB().point(st, side);
    return st;
  }

  /* 끝난 한 세트를 만든다 — 내 팀(a) 승/패. 세트가 끝나면 그 상태 그대로 둡니다.
   * (한쪽이 21점·2점 차에 먼저 닿으면 세트가 끝나므로 번갈아 한 점씩 올립니다) */
  function setOver(st, mine, theirs) {
    st = SB().resetSet(st);
    var guard = 0;
    while ((st.a < mine || st.b < theirs) && !SB().winner(st) && guard++ < 80) {
      var goA = st.a >= mine ? false : (st.b >= theirs ? true : (st.a <= st.b));
      st = SB().point(st, goA ? 'a' : 'b');
    }
    return st;
  }

  function setWon(st, mine, theirs) { return SB().nextSet(setOver(st, mine, theirs)); }

  function stateOf(rows, patch) {
    rows = rows || BM.fixtures.demo();
    var st = {
      ready: true, mode: 'local',
      me: { key: BM.seed.ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: rows,
      data: BM.store.derive(rows, BM.seed.ME),
      drafts: {
        log: {
          date: U.ymd(), cond: null, intensity: null, minutes: null, done: [], gameMode: 21,
          games: [{ a: '', b: '' }], score: null, result: '', pain: [], weakness: [], note: '',
          partner: '', rival: '', video: '', videoNote: '', pro: {}
        }
      },
      ui: { tab: 'log', matchFilter: {}, chatRoom: null, editLogId: null },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 }
    };
    if (patch) Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
    return st;
  }

  /* 일지 한 줄 — '팀' 칸은 D.logExtraJson으로 만듭니다(저장 경로와 같은 모양) */
  function rec(date, opts) {
    opts = opts || {};
    return {
      id: 'r' + date + (opts.n || ''),
      type: '기록',
      userKey: BM.seed.ME,
      nick: '나래',
      date: date,
      cond: 7,
      games: opts.games || [],
      result: opts.result || '',
      team: D.logExtraJson({ partner: opts.partner || '', rival: opts.rival || '', video: {} })
    };
  }

  function freshStore() {
    try { root.localStorage && root.localStorage.clear && root.localStorage.clear(); } catch (e) { /* 무시 */ }
    U.writeJSON('bm_rows_v1', BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 점수판 이름표 — 파트너 · 라이벌 (계산은 순수 함수)
   * ========================================================= */

  test('v1.54 점수판: 파트너·라이벌 이름은 점수 계산에 영향이 없고, 되돌리기·세트에도 남는다', function () {
    var st = SB().create({ partner: '민호', rival: '지호' });
    eq(st.partner, '민호', '파트너 이름');
    eq(st.rival, '지호', '라이벌 이름');
    eq(st.a, 0, '점수는 0에서');

    var played = SB().nextSet(rally(SB().create({ partner: '민호', rival: '지호' }), 'a', 21));
    eq(played.partner, '민호', '세트가 끝나도 파트너 유지');
    eq(played.rival, '지호', '세트가 끝나도 라이벌 유지');
    eq(SB().undo(played).partner, '민호', '되돌려도 파트너 유지');
    eq(SB().resetSet(played).rival, '지호', '세트 초기화에도 라이벌 유지');
  });

  test('v1.54 점수판: 이름 바꾸기는 복사본을 만들어 원래 상태를 건드리지 않는다', function () {
    var st = SB().create({ partner: '민호' });
    var before = JSON.stringify(st);
    var next = SB().setName(st, 'rival', '지호');
    eq(next.rival, '지호', '라이벌 바뀜');
    eq(next.partner, '민호', '파트너 그대로');
    eq(JSON.stringify(st), before, '원래 상태 그대로');
    eq(SB().setName(st, 'partner', '민수').partner, '민수', '파트너도 바뀜');
    eq(SB().setName(st, 'nope', 'x').partner, '민호', '모르는 칸은 무시');
  });

  test('v1.54 점수판: 이름은 20자·한 줄로 정리한다 (일지 칸과 같은 상한)', function () {
    var long = '가'.repeat(30);
    eq(SB().create({ partner: long }).partner.length, 20, '파트너 20자');
    eq(SB().create({ rival: ' 김  원호\n' }).rival, '김 원호', '줄바꿈·중복 공백 정리');
    eq(SB().cleanName(null), '', '없는 값은 빈 문자열');
    eq(SB().NAME_MAX, 20, '상한 상수');
    eq(SB().NAME_MAX, D.PARTNER_MAX, '파트너 칸과 같은 상한');
    eq(SB().NAME_MAX, D.RIVAL_MAX, '라이벌 칸과 같은 상한');
  });

  /* =========================================================
   * 2. 일지로 넘기기 — 점수·메모·파트너·라이벌
   * ========================================================= */

  test('v1.54 넘기기: 끝난 세트가 있으면 파트너·라이벌 이름까지 초안에 들어간다', function () {
    var st = SB().create({ partner: '민호', rival: '지호' });
    st = setWon(st, 21, 17);
    var patch = SB().draftPatch(st, {});
    eq(patch.partner, '민호', '파트너');
    eq(patch.rival, '지호', '라이벌');
    eq(patch.gameMode, 21, '점수제');
    eq(JSON.stringify(patch.games), '[{"a":21,"b":17}]', '게임 점수');
    eq(patch.result, '승', '결과');
    includes(patch.note, '21:17', '메모에 스코어');
    includes(patch.note, '함께 민호', '메모에 파트너');
    includes(patch.note, '상대 지호', '메모에 라이벌');
  });

  test('v1.54 넘기기: 점수판에 이름이 없으면 일지에 이미 적어 둔 이름을 지우지 않는다', function () {
    var st = setWon(SB().create(), 21, 19);
    var patch = SB().draftPatch(st, { partner: '민수', rival: '지훈' });
    eq(patch.partner, '민수', '기존 파트너 유지');
    eq(patch.rival, '지훈', '기존 라이벌 유지');
    excludes(patch.note, '함께', '이름이 없으면 메모에도 안 붙음');
  });

  test('v1.54 넘기기: 단식은 파트너 없이 라이벌만 넘어간다', function () {
    var st = SB().create({ type: '단식', partner: '민호', rival: '지호' });
    st = setWon(st, 21, 15);
    var patch = SB().draftPatch(st, {});
    eq(patch.rival, '지호', '단식 라이벌');
    excludes(patch.note, '함께', '단식 메모에는 파트너 없음');
    includes(patch.note, '상대 지호', '단식 메모에 라이벌');
  });

  test('v1.54 넘기기: 끝난 세트가 없으면 예전처럼 아무것도 넘기지 않는다', function () {
    eq(SB().draftPatch(SB().create({ partner: '민호', rival: '지호' }), {}), null, '0:0은 null');
  });

  /* =========================================================
   * 3. 저장 — '팀' 칸 JSON에 rival 한 칸, 기존 일지와 호환
   * ========================================================= */

  test('v1.54 저장: 팀 칸 JSON에 partner·rival이 함께 적히고 다시 읽힌다', function () {
    var json = D.logExtraJson({ partner: '민호', rival: '지호', video: {} });
    var back = D.logMeta({ team: json });
    eq(back.partner, '민호', '파트너 읽기');
    eq(back.rival, '지호', '라이벌 읽기');
    includes(json, '"rival":"지호"', 'JSON에 rival');
    ok(json.length < 200, '한 칸에 들어가는 짧은 줄');
  });

  test('v1.54 호환: 예전 일지(이름만·partner만)는 그대로 읽고 rival은 빈 값', function () {
    var legacy = D.logMeta({ team: '민호' });
    eq(legacy.partner, '민호', '예전 이름 칸 → 파트너');
    eq(legacy.rival, '', '라이벌 없음');

    var v132 = D.logMeta({ team: '{"partner":"민호"}' });
    eq(v132.partner, '민호', 'v1.32 JSON');
    eq(v132.rival, '', 'rival 없는 JSON');
    eq(D.logExtraJson({ partner: '민호' }), '{"partner":"민호"}', 'rival 없으면 예전과 같은 JSON');
    eq(D.logExtraJson({}), '', '모두 비면 칸 비움');
  });

  test('v1.54 저장: 초안의 rival이 일지 저장 경로를 지나 시트 한 줄에 남는다', function () {
    return freshStore().then(function (store) {
      var st = setWon(SB().create({ partner: '민호', rival: '지호' }), 21, 12);
      store.actions.setDraft(SB().draftPatch(st, store.state.drafts.log));
      eq(store.state.drafts.log.rival, '지호', '초안 라이벌');
      var res = store.actions.saveLog();
      ok(res.ok, '저장 성공');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(res.entity.id); })[0];
      ok(row, '저장한 일지 행');
      var meta = D.logMeta(row[D.COL['팀']]);
      eq(meta.partner, '민호', '행의 파트너');
      eq(meta.rival, '지호', '행의 라이벌');
      eq(meta.video.url, '', '영상은 그대로 빈 값');
      eq(D.COL['팀'] === undefined, false, '팀 칸은 그대로 있다');

      /* 저장 뒤 다음 일지에는 이름이 따라오지 않는다(초안 초기화) */
      eq(store.state.drafts.log.rival, '', '새 일지 초안은 비어 있음');
      return store.flush();
    });
  });

  test('v1.54 저장: 지난 일지를 고쳐 저장해도 rival이 함께 바뀐다', function () {
    return freshStore().then(function (store) {
      var st = setWon(SB().create({ partner: '민호', rival: '지호' }), 21, 18);
      store.actions.setDraft(SB().draftPatch(st, store.state.drafts.log));
      var first = store.actions.saveLog();
      ok(first.ok, '첫 저장');
      var id = first.entity.id;

      var edit = store.actions.startEditLog(id);
      ok(edit.ok, '수정 시작');
      eq(edit.draft.rival, '지호', '수정 화면에 라이벌');
      store.actions.setDraft({ rival: '지훈' });
      store.state.locks.log = 0;                 /* 저장 연타 잠금(1.2초)은 테스트에서 풀어 줍니다 */
      var res = store.actions.saveLog();
      ok(res.ok, '수정 저장');
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(id); })[0];
      var meta = D.logMeta(row[D.COL['팀']]);
      eq(meta.rival, '지훈', '바뀐 라이벌');
      eq(meta.partner, '민호', '파트너는 그대로');
      return store.flush();
    });
  });

  /* =========================================================
   * 4. 라이벌 전적 — 누적·계산
   * ========================================================= */

  test('v1.54 라이벌 전적: 총 경기·승/패·승률·최근 스코어를 센다', function () {
    var records = [
      rec('2026-11-10', { rival: '지호', games: [{ a: 21, b: 18 }, { a: 19, b: 21 }] }),
      rec('2026-11-15', { rival: '지호', games: [{ a: 21, b: 15 }] }),
      rec('2026-11-20', { rival: '지호', games: [{ a: 18, b: 21 }] })
    ];
    var r = D.rivalStat(records, '지호');
    ok(r, '라이벌을 찾음');
    eq(r.games, 4, '총 4경기');
    eq(r.wins, 2, '2승');
    eq(r.losses, 2, '2패');
    eq(r.draws, 0, '무승부 없음');
    eq(r.rate, 50, '승률 50%');
    eq(r.line, '4전 2승 2패', '한 줄 전적');
    eq(r.recent, '18:21', '가장 최근 날의 스코어');
    includes(D.rivalLineText(r), '최근 18:21', '한 줄에 최근 스코어');
    includes(D.rivalVersusText(r), '2승', '몇 승');
    includes(D.rivalVersusText(r), '2패', '몇 패');
  });

  test('v1.54 라이벌 전적: 무승부는 승률 분모에서 빼고, 점수 없는 승패만 적은 일지는 1경기', function () {
    var records = [
      rec('2026-11-18', { rival: '박선수', games: [{ a: 21, b: 21 }] }),
      rec('2026-11-19', { rival: '박선수', games: [{ a: 21, b: 10 }] }),
      rec('2026-11-20', { rival: '박선수', result: '패' })
    ];
    var r = D.rivalStat(records, '박선수');
    eq(r.games, 3, '3경기');
    eq(r.wins, 1, '1승');
    eq(r.losses, 1, '1패');
    eq(r.draws, 1, '1무');
    eq(r.rate, 50, '무승부는 분모에서 뺌');
    eq(r.line, '3전 1승 1무 1패', '무 포함 한 줄');
  });

  test('v1.54 라이벌 전적: 같은 날 두 일지면 나중에 쓴 일지의 스코어가 최근 스코어', function () {
    var a = rec('2026-11-20', { rival: '지호', games: [{ a: 21, b: 17 }] });
    a.createdAt = '2026-11-20 10:00:00';
    var b = rec('2026-11-20', { rival: '지호', games: [{ a: 15, b: 21 }], n: 'b' });
    b.createdAt = '2026-11-20 19:00:00';
    /* 화면은 최신순으로 내려오므로 "나중 일지가 앞" */
    var r = D.rivalStat([b, a], '지호');
    eq(r.games, 2, '2경기');
    eq(r.recent, '15:21', '나중에 쓴 일지의 스코어');
    eq(D.rivalStat([a, b], '지호').recent, '15:21', '순서와 상관없이 같은 결과');
  });

  test('v1.54 라이벌 전적: 가장 많이 맞붙은 상대가 위, 이름 하나만 볼 수도 있다', function () {
    var records = [
      rec('2026-11-10', { rival: '지호', games: [{ a: 21, b: 5 }] }),
      rec('2026-11-11', { rival: '지호', games: [{ a: 21, b: 6 }] }),
      rec('2026-11-12', { rival: '지훈', games: [{ a: 21, b: 19 }, { a: 21, b: 20 }, { a: 18, b: 21 }] })
    ];
    var list = D.rivalStats(records, { limit: 5 });
    eq(list.length, 2, '두 명');
    eq(list[0].name, '지훈', '경기 많은 쪽이 먼저');
    eq(list[1].name, '지호', '그다음');
    eq(D.rivalStats(records, { name: '지호', limit: 5 }).length, 1, '이름 필터');
    eq(D.rivalStat(records, '없는사람'), null, '기록 없는 이름은 null');
    eq(D.rivalStat(records, ''), null, '빈 이름은 null');
    eq(D.rivalStats(records, { limit: 1 }).length, 1, 'limit');
  });

  test('v1.54 라이벌 전적: 파트너 전적과 섞이지 않는다 (같은 이름이라도 다른 칸)', function () {
    var records = [
      rec('2026-11-10', { partner: '민호', rival: '지호', games: [{ a: 21, b: 10 }] }),
      rec('2026-11-11', { partner: '지호', games: [{ a: 21, b: 11 }] })
    ];
    eq(D.rivalStat(records, '지호').games, 1, '라이벌 지호 1경기');
    eq(D.partnerStat(records, '지호').games, 1, '파트너 지호 1경기');
    eq(D.rivalStat(records, '민호'), null, '파트너 이름은 라이벌로 안 셈');
    eq(D.partnerStat(records, '민호').games, 1, '파트너 민호 1경기');
    eq(D.rivalStat(records, '지호').wins, 1, '내가 이긴 경기가 승');
  });

  test('v1.54 전적 호환: 기존 파트너 전적은 같은 기록에서 예전 그대로 나온다', function () {
    var records = [
      rec('2026-11-10', { partner: '민호', games: [{ a: 21, b: 18 }, { a: 19, b: 21 }] }),
      rec('2026-11-12', { partner: '민호', games: [{ a: 21, b: 15 }] }),
      rec('2026-11-13', { partner: '민수', games: [{ a: 18, b: 21 }] })
    ];
    var list = D.partnerStats(records, { limit: 5 });
    eq(list.length, 2, '두 명');
    eq(list[0].name, '민호', '승률 높은 파트너 먼저');
    eq(list[0].line, '3전 2승 1패', '파트너 한 줄');
    eq(list[0].rate, 67, '승률');
    eq(D.partnerLineText(list[0]), '민호 · 3전 2승 1패 (67%)', '파트너 한 줄 문구');
    eq(D.partnerStats(records, { limit: 5 }).map(function (p) { return p.name; }).join(','), '민호,민수', '정렬 그대로');
    eq(D.rivalStats(records, { limit: 5 }).length, 0, '라이벌은 없음');
  });

  test('v1.54 전적: 입력 기록을 바꾸지 않는다 (순수 함수)', function () {
    var records = [rec('2026-11-10', { partner: '민호', rival: '지호', games: [{ a: 21, b: 18 }] })];
    var before = JSON.stringify(records);
    D.rivalStats(records, { limit: 5 });
    D.partnerStats(records, { limit: 5 });
    eq(JSON.stringify(records), before, '입력 그대로');
  });

  /* =========================================================
   * 5. 화면 — 점수판(세로·가로) · 일지 입력칸 · 전적 카드
   * ========================================================= */

  test('v1.54 화면: 점수판에 파트너·라이벌 이름표 버튼이 있고 +1 카드는 그대로', function () {
    var st = SB().create();
    var html = LOG().scoreboardHtml(st);
    includes(html, 'data-sb-pick="partner"', '파트너 버튼');
    includes(html, 'data-sb-pick="rival"', '라이벌 버튼');
    includes(html, '>파트너<', '파트너 이름표');
    includes(html, '>라이벌<', '라이벌 이름표');
    includes(html, 'data-sb-point="a"', '내 팀 +1');
    includes(html, 'data-sb-point="b"', '상대 +1');
    includes(html, 'data-sb-undo', '되돌리기');
    includes(html, 'data-sb-swap', '코트 교대');
    includes(html, 'data-sb-reset', '세트 초기화');
    excludes(html, 'NaN', 'NaN 없음');
    excludes(html, 'undefined', 'undefined 없음');
  });

  test('v1.54 화면: 이름을 고르면 카드 위에 함께 보이고, 단식은 파트너 버튼이 없다', function () {
    var html = LOG().scoreboardHtml(SB().create({ partner: '민호', rival: '지호' }));
    includes(html, '내 팀 · 민호', '내 팀 카드에 파트너');
    includes(html, '상대 팀 · 지호', '상대 카드에 라이벌');
    includes(html, '>민호<', '이름표 버튼에 이름');

    var single = LOG().scoreboardHtml(SB().create({ type: '단식' }));
    excludes(single, 'data-sb-pick="partner"', '단식엔 파트너 버튼 없음');
    includes(single, 'data-sb-pick="rival"', '단식에도 라이벌 버튼');
    includes(single, '>나<', '단식은 나');
    includes(single, '>상대<', '단식은 상대');
  });

  test('v1.54 화면: 이름 고르기 칸 — 최근 칩·직접 적기·지금 전적 한 줄', function () {
    var html = LOG().scoreboardHtml(SB().create({ partner: '민호', rival: '지호' }), {
      picker: 'rival',
      cands: { rival: ['지호', '지훈'], partner: ['민호'], rec: { rival: '지호 · 4전 2승 2패 (50%) · 최근 18:21' } }
    });
    includes(html, 'data-sb-picker="rival"', '라이벌 고르기 열림');
    includes(html, 'data-sb-name="rival" data-sb-name-val="지훈"', '최근 상대 칩');
    includes(html, 'data-sb-name-input="rival"', '직접 적는 칸');
    includes(html, 'maxlength="20"', '길이 상한');
    includes(html, '지호 · 4전 2승 2패 (50%) · 최근 18:21', '고르는 자리에서 전적');
    includes(html, 'data-sb-pick-close', '닫기');
    excludes(html, 'data-sb-picker="partner"', '파트너 칸은 닫혀 있음');

    var empty = LOG().scoreboardHtml(SB().create(), { picker: 'rival', cands: {} });
    includes(empty, '아직 맞붙은 상대가 없어요', '칩이 없으면 안내 + 직접 적기');
  });

  test('v1.54 화면: 가로 점수판도 이름표·+1 카드·일지 넣기가 모두 있다', function () {
    var st = setOver(SB().create({ partner: '민호', rival: '지호' }), 21, 17);  /* 세트가 막 끝난 상태 */
    var land = LOG().scoreboardHtml(st, { land: true });
    var port = LOG().scoreboardHtml(st, { land: false });
    [land, port].forEach(function (html) {
      includes(html, 'data-sb-pick="partner"', '이름표 (방향 무관)');
      includes(html, 'data-sb-point="a"', '+1 내 팀');
      includes(html, 'data-sb-save', '일지에 넣기');
      includes(html, 'data-sb-next', '다음 세트');
      includes(html, '내 팀 · 민호', '카드 위 이름');
      excludes(html, 'NaN', 'NaN 없음');
    });
    eq(land.indexOf('data-sb-point="a"') < land.indexOf('data-sb-point="b"'), true, '가로는 내 팀이 먼저(왼쪽)');
    eq(port.indexOf('data-sb-point="b"') < port.indexOf('data-sb-point="a"'), true, '세로는 상대가 먼저(위)');
    includes(land, 'data-sb-view="land"', '가로 표시');
    includes(port, 'data-sb-view="port"', '세로 표시');
  });

  test('v1.54 배선: 점수판 클릭 위임에 이름 고르기·칩·입력이 연결돼 있다', function () {
    if (!hasNode) return;
    var src = readRoot('js/views/log.js');
    includes(src, "ev.target.closest('[data-sb-pick]')", '이름표 버튼');
    includes(src, "ev.target.closest('[data-sb-name]')", '이름 칩');
    includes(src, "getAttribute('data-sb-name-input')", '직접 적는 칸');
    includes(src, 'SB.setName(sbState', '이름 바꾸기');
    includes(src, 'sbPicker', '열린 칸 기억');
    includes(src, 'recentRivalNames(state, 6)', '최근 라이벌 후보');
  });

  test('v1.54 화면: 일지 입력칸에 상대(라이벌) 칸·최근 라이벌 칩·한 줄 전적이 있다', function () {
    var rows = [rec('2026-11-20', { rival: '지호', games: [{ a: 21, b: 18 }] })];
    var html = LOG().render(stateOf(rows));
    includes(html, 'data-field="rival"', '라이벌 입력칸');
    includes(html, '상대(라이벌)', '이름표');
    includes(html, 'data-rvlchips', '라이벌 칩 줄');
    includes(html, 'data-rvl-chip="지호"', '지호 칩');
    includes(html, 'data-rvl-now', '라이벌 전적 줄');
    includes(html, '자주 만난 라이벌', '칩 줄 이름표');
    var atPartner = html.indexOf('data-field="partner"');
    var atRival = html.indexOf('data-field="rival"');
    ok(atPartner > 0 && atRival > atPartner, '파트너 다음에 라이벌');
  });

  test('v1.54 화면: 이름을 적으면 그 자리에서 전적이 보인다 (파트너·라이벌)', function () {
    var rows = [rec('2026-11-20', { rival: '지호', games: [{ a: 21, b: 18 }] })];
    var st = stateOf(rows);
    eq(LOG().rivalNowText(st, '지호'), '지호 · 1전 1승 0패 (100%) · 최근 21:18', '라이벌 한 줄');
    eq(LOG().rivalNowText(st, '없는사람'), '', '기록 없으면 빈 줄');
    eq(LOG().partnerNowText(st, '지호'), '', '파트너로는 안 셈');
    var html = LOG().render(st);
    includes(html, 'data-rvl-now', '줄 자리');
  });

  test('v1.54 화면: 라이벌 맞대결 카드 — 몇 승 몇 패·최근 스코어를 한눈에', function () {
    var rows = [
      rec('2026-11-10', { rival: '지호', games: [{ a: 21, b: 18 }, { a: 19, b: 21 }] }),
      rec('2026-11-20', { rival: '지호', games: [{ a: 21, b: 15 }] }),
      rec('2026-11-12', { rival: '지훈', games: [{ a: 18, b: 21 }] })
    ];
    var st = stateOf(rows);
    var html = LOG().render(st);
    includes(html, 'data-region="rival"', '카드 자리');
    includes(html, '라이벌 맞대결', '카드 이름');
    includes(html, '지호에게 2승 1패', '요약 줄에 몇 승 몇 패');
    includes(html, '3전 2승 1패', '줄마다 전적');
    includes(html, '최근 21:15', '최근 스코어');
    includes(html, '라이벌', '배지');
    ok(LOG().rivalBlock(st).indexOf('지호') < LOG().rivalBlock(st).indexOf('지훈'), '자주 만난 상대가 위');

    /* 라이벌 기록이 없으면 카드도 없다 */
    eq(LOG().rivalBlock(stateOf([rec('2026-11-10', { partner: '민호', games: [{ a: 21, b: 5 }] })])), '', '기록 없으면 카드 없음');
  });

  test('v1.54 화면: 일지 상세·최근 기록에도 상대(라이벌)가 보인다', function () {
    var r = rec('2026-11-20', { partner: '민호', rival: '지호', games: [{ a: 21, b: 18 }] });
    var detail = LOG().recordDetail(r);
    includes(detail, '상대(라이벌)', '상세 이름표');
    includes(detail, '지호', '상세 이름');
    var html = LOG().render(stateOf([r]));
    includes(html, 'vs 지호', '최근 기록 한 줄');
  });

  /* =========================================================
   * 6. 보안 · 버전 · 배포
   * ========================================================= */

  test('v1.54 보안: 이름은 글자로만 나가고(이스케이프) 길이·제어문자를 막는다', function () {
    var bad = '"><img src=x onerror=alert(1)>';
    var html = LOG().scoreboardHtml(SB().create({ partner: bad, rival: bad }));
    excludes(html, '<img src=x', '점수판에서 태그로 열리지 않음');
    includes(html, '&lt;img', '글자로는 남는다');

    var rows = [rec('2026-11-20', { rival: bad, games: [{ a: 21, b: 18 }] })];
    var log = LOG().render(stateOf(rows));
    excludes(log, '<img src=x', '일지에서 태그로 열리지 않음');

    eq(D.logMeta({ team: D.logExtraJson({ rival: '<script>alert(1)</script>' }) }).rival, '<script>alert(1)</script>'.slice(0, 20), '저장은 글자 그대로(상한 20자)');
  });

  test('v1.54 스키마: 새 칸·새 행 유형 없이 기존 26칸 그대로', function () {
    eq(D.COLS.length, 26, '시트 26칸');
    eq(D.COL['팀'] === undefined, false, '팀 칸 그대로');
    eq(D.logCells({ team: '{"rival":"지호"}' })['팀'], '{"rival":"지호"}', '팀 칸으로 나감');
    eq(D.toRow({ type: '기록', team: '{"partner":"민호","rival":"지호"}' })[D.COL['팀']], '{"partner":"민호","rival":"지호"}', '행으로 나감');
    eq(D.COLS.filter(function (c) { return c === 'rival' || c === '라이벌'; }).length, 0, '새 칸 없음');
  });

  test('v1.54 버전: sw·app·TWA·styles.css가 bm-v1.74.0으로 맞는다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, "var VERSION = 'bm-v1.80.0'", '서비스워커 버전');
    includes(sw, 'bm-v1.74.0', '변경 이력');
    includes(readRoot('app.js'), "version: 'v1.80.0'", '앱 버전');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.80.0', 'TWA 이름');
    eq(twa.appVersion, '1.80.0', 'TWA 버전');
    eq(twa.appVersionCode, 74, '업로드 번호 +1');
    var html = readRoot('index.html');
    ok(/styles\.css\?v=20261126-\d+/.test(html), '스타일 캐시 키');
    includes(html, 'js/views/log.js', '일지 화면 스크립트');
    includes(readRoot('test/run.js'), 'test/v154.test.js', '테스트 묶음에 추가');
  });

  test('v1.54 스타일: 이름표·고르기 칸·라이벌 색이 스타일시트에 있다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.sb__teams', '.sb__team', '.sb__pick', '.sb__pick-chips', '.sb__pick-rec',
      '.ptnchip--rvl', '.ptnnow--rvl', '.card--rvl', '.pill--rvl'].forEach(function (sel) {
        includes(css, sel, sel + ' 규칙');
      });
    includes(css, '.sbfull.is-land .sb__pick', '가로에서 낮은 고르기 칸');
  });

  test('v1.54 보안: CSP·외부 출처는 그대로 (이름은 기기·내 기록에만)', function () {
    if (!hasNode) return;
    var html = readRoot('index.html');
    var m = html.match(/Content-Security-Policy" content="([^"]+)"/);
    var csp = m ? m[1] : '';
    ok(csp, 'CSP 있음');
    excludes(csp, "'unsafe-eval'", 'eval 열지 않음');
    includes(csp, "script-src 'self'", '스크립트는 내 주소만');
    excludes(csp, 'rival', '이름표 때문에 출처를 늘리지 않음');
    excludes(csp, 'https://api', '새 API 출처 없음');
    var log = readRoot('js/views/log.js');
    excludes(log, 'fetch(', '이름을 보내는 새 요청 없음');
    includes(log, 'maxlength', '길이 상한은 화면에도');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
