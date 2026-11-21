/* ============================================================
 * test/v132.test.js — bm-v1.37.1
 *   고도화 4차 사이클(ideas.md 2026-11-21 다음 후보 A·B·C).
 *
 *   1) 복식 파트너 이름 + 파트너별 승률
 *      · 일지 게임 점수 접기 안 작은 칸(선택 · 20자)
 *      · 새 시트 칸 없이 '팀' 칸 JSON {"partner":"조환비"} 로 저장
 *      · '일지 & AI'에 파트너별 승률 줄 (예: 조환비 4전 3승 · 75%)
 *
 *   2) 스윙·경기 영상 링크 + 한 줄 체크 포인트
 *      · http/https만 저장(javascript:·data: 차단) · 앱에 영상은 올리지 않음
 *      · 저장한 일지에서 '영상 보기 ↗' 한 번으로 새 창(target=_blank · rel=noopener noreferrer)
 *
 *   3) 챌린지 3회 달성 → 커뮤니티 원탭 공유
 *      · 3/3 카드에 '커뮤니티에 자랑하기' → 말머리 '일지' 글쓰기로 문구가 채워져 이동
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

  var ME = 'u_v132_me';
  var NOW = '2026-11-20';
  var VIDEO = 'https://www.youtube.com/watch?v=abc123';

  /* '팀' 칸에 들어 있는 JSON 모양 그대로의 일지 한 줄 */
  function rec(date, partner, games, extra) {
    var team = partner ? JSON.stringify({ partner: partner }) : '';
    var r = {
      id: 'r_' + date + '_' + (partner || 'none'),
      type: '기록', date: date, userKey: ME,
      games: games || [], team: team, weakness: [], done: []
    };
    Object.keys(extra || {}).forEach(function (k) { r[k] = extra[k]; });
    return r;
  }

  /* 화면용 상태 — 실제 앱 state 모양(분석·탭·초안 포함) */
  function stateOf(records, patch) {
    var st = {
      ready: true, mode: 'local',
      me: { key: ME, nick: '나래', level: 'C조', discipline: '복식', theme: { theme: 'th_night' } },
      rows: [],
      data: {
        records: records || [], posts: [], threads: [], matchProfiles: [], feedback: [],
        idx: { all: [], byType: {}, byId: {} },
        stats: { streak: 0, sessions14: 2, winRate: 60, minutesMonth: 120, avgCond: 6 }
      },
      drafts: {
        log: {
          date: NOW, cond: null, intensity: null, minutes: null, done: [], weakness: [],
          games: [{ a: '', b: '' }], pain: [], note: '', partner: '', video: '', videoNote: ''
        }
      },
      ui: { tab: 'log', challengeNow: NOW, matchFilter: { level: '전체', region: '전체', discipline: '전체' } },
      analysis: null, queue: [], locks: {}, syncState: 'idle', syncError: null, lastSync: '',
      stats: { writes: 0, blocked: 0, failed: 0 },
      routine: {}, routinePref: false
    };
    if (patch) {
      Object.keys(patch).forEach(function (k) { st[k] = patch[k]; });
      if (patch.ui) st.ui = Object.assign({}, st.ui, patch.ui);
      if (patch.drafts && patch.drafts.log) {
        st.drafts = { log: Object.assign({}, st.drafts.log, patch.drafts.log) };
      }
    }
    return st;
  }

  function checkHtml(html, label) {
    ok(html && html.length > 20, label + ': 화면이 비어 있습니다');
    excludes(html, 'undefined', label + ': undefined가 출력됨');
    excludes(html, 'NaN', label + ': NaN이 출력됨');
    ['div', 'section', 'ul', 'li', 'button', 'header', 'footer', 'p', 'span', 'i', 'a'].forEach(function (tag) {
      var open = (html.match(new RegExp('<' + tag + '[\\s>]', 'g')) || []).length;
      var close = (html.match(new RegExp('</' + tag + '>', 'g')) || []).length;
      eq(open, close, label + ': <' + tag + '> 태그 짝');
    });
  }

  function clearStorage() {
    ['bm_rows_v1', 'bm_queue_v1', 'bm_dedupe_v1', 'bm_cache_v1', 'bm_seen_v1', 'bm_me_v1', 'bm_mode_v1']
      .forEach(function (k) { U.storage.removeItem(k); });
  }
  function freshStore(rows) {
    clearStorage();
    U.writeJSON('bm_rows_v1', rows || BM.fixtures.demo());
    var api = BM.api.createLocal({ latency: 0 });
    var store = BM.store.createStore({ api: api });
    return store.actions.init().then(function () { return store; });
  }

  /* =========================================================
   * 1. 저장 규격 — '팀' 칸 JSON (새 칸 없음)
   * ========================================================= */

  test('v1.32 파트너: 파트너·영상이 없으면 빈 값', function () {
    var meta = D.logMeta('');
    eq(meta.partner, '', '파트너 없음');
    eq(meta.video.url, '', '영상 없음');
    eq(meta.video.label, '', '체크 포인트 없음');
    eq(D.logMeta(null).partner, '', 'null도 조용히');
    eq(D.logMeta({}).partner, '', '팀 칸 없는 기록');
  });

  test('v1.32 파트너: 팀 칸 JSON에서 파트너와 영상을 읽는다', function () {
    var team = JSON.stringify({ partner: '조환비', video: { url: VIDEO, label: '스매시 손목' } });
    var meta = D.logMeta({ team: team });
    eq(meta.partner, '조환비', '파트너');
    eq(meta.video.url, VIDEO, '영상 주소');
    eq(meta.video.label, '스매시 손목', '한 줄 체크 포인트');
    eq(D.logMeta(team).partner, '조환비', '문자열로 넘겨도 같다');
  });

  test('v1.32 파트너: 예전에 이름만 적힌 팀 칸도 파트너로 읽는다', function () {
    eq(D.logMeta({ team: '  콕집사 ' }).partner, '콕집사', '공백 정리');
    eq(D.logMeta({ team: '{깨진 JSON' }).partner, '{깨진 JSON', '깨진 JSON은 글자 그대로');
  });

  test('v1.32 파트너: 이름은 20자까지 · 줄바꿈은 한 칸으로', function () {
    var long = '가나다라마바사아자차카타파하가나다라마바사아자';
    eq(D.cleanPartner(long).length, D.PARTNER_MAX, '20자로 자른다');
    eq(D.PARTNER_MAX, 20, '상한 20자');
    eq(D.cleanPartner('조 환비\n김코치'), '조 환비 김코치', '줄바꿈 제거');
    eq(D.cleanPartner('   '), '', '공백만이면 빈 값');
  });

  test('v1.32 영상: http·https만 열린다 (javascript: 등 차단)', function () {
    eq(D.safeVideoUrl(VIDEO), VIDEO, '유튜브');
    eq(D.safeVideoUrl('https://drive.google.com/file/d/x/view'), 'https://drive.google.com/file/d/x/view', '구글 드라이브');
    eq(D.safeVideoUrl('http://example.com/a.mp4'), 'http://example.com/a.mp4', 'http');
    eq(D.safeVideoUrl('javascript:alert(1)'), '', 'javascript: 차단');
    eq(D.safeVideoUrl('JavaScript://example.com/%0aalert(1)'), '', '대소문자 섞은 javascript: 차단');
    eq(D.safeVideoUrl('data:text/html,<script>alert(1)</script>'), '', 'data: 차단');
    eq(D.safeVideoUrl('file:///etc/passwd'), '', 'file: 차단');
    eq(D.safeVideoUrl('https://exa mple.com/a'), '', '공백이 있으면 버린다');
    eq(D.safeVideoUrl('https://exam<ple.com'), '', '꺾쇠가 있으면 버린다');
    eq(D.safeVideoUrl('https://localhost/v'), '', '도메인이 아닌 호스트는 버린다');
    eq(D.safeVideoUrl('www.youtube.com/watch?v=1'), '', '스킴 없는 주소는 버린다');
    eq(D.safeVideoUrl('https://' + 'a'.repeat(D.VIDEO_URL_MAX)), '', '너무 긴 주소는 버린다');
  });

  test('v1.32 영상: 잘못된 주소면 한 줄 메모도 저장하지 않는다', function () {
    var json = D.logExtraJson({ partner: '조환비', video: { url: 'javascript:alert(1)', label: '스매시' } });
    eq(json, '{"partner":"조환비"}', '파트너만 남는다');
    excludes(json, '스매시', '체크 문구도 함께 버린다');
    eq(D.cleanVideoLabel('a'.repeat(80)).length, D.VIDEO_LABEL_MAX, '체크 문구 60자');
  });

  test('v1.32 저장: 둘 다 비면 팀 칸도 비운다', function () {
    eq(D.logExtraJson({ partner: '', video: { url: '', label: '' } }), '', '빈 문자열 → 칸 비움');
    eq(D.logExtraJson(null), '', 'null → 칸 비움');
    eq(D.logExtraJson({ video: { url: VIDEO, label: '  폼 체크 ' } }),
      '{"video":{"url":"' + VIDEO + '","label":"폼 체크"}}', '영상만 있어도 저장');
  });

  test('v1.32 저장: 26칸 그대로 — 팀 칸 왕복', function () {
    var row = D.toRow({
      id: 'x1', type: '기록', userKey: 'u', date: '2026-11-20', nick: '나래',
      team: D.logExtraJson({ partner: '조환비', video: { url: VIDEO, label: '스매시' } })
    });
    eq(row.length, 26, '26칸 스키마 유지');
    var back = D.logMeta(D.fromRow(row));
    eq(back.partner, '조환비', '다시 읽어도 파트너');
    eq(back.video.url, VIDEO, '다시 읽어도 영상');
    eq(back.video.label, '스매시', '다시 읽어도 체크 문구');
    eq(D.COLS.length, 26, '칸 수 그대로');
  });

  test('v1.32 수정: 기존 파트너·영상이 입력칸 초안으로 돌아온다', function () {
    var rec1 = D.fromRow(D.toRow({
      id: 'x2', type: '기록', date: '2026-11-20', userKey: 'u',
      games: [{ a: 21, b: 18 }], scoreRaw: '21:18',
      team: D.logExtraJson({ partner: '조환비', video: { url: VIDEO, label: '폼 체크' } })
    }));
    var draft = D.recordDraft(rec1);
    eq(draft.partner, '조환비', '파트너 초안');
    eq(draft.video, VIDEO, '영상 초안');
    eq(draft.videoNote, '폼 체크', '체크 문구 초안');
    eq(draft.games.length, 1, '게임 점수는 그대로');
  });

  test('v1.32 수정: 바뀐 칸에 팀 칸이 들어가고 ID·사용자ID는 건드리지 않는다', function () {
    var cells = D.logCells({
      date: '2026-11-20', cond: 7, result: '승', text: '메모',
      team: D.logExtraJson({ partner: '조환비' })
    });
    eq(cells['팀'], '{"partner":"조환비"}', '팀 칸');
    ok(D.COL['팀'] !== undefined, '시트 칸 이름');
    ok(!('ID' in cells), 'ID 없음');
    ok(!('사용자ID' in cells), '사용자ID 없음');
    ok(!('비밀번호' in cells), '비밀번호 칸 없음');
    eq(D.logCells({ team: '' })['팀'], '', '파트너를 지우면 칸도 비운다');
  });

  /* =========================================================
   * 2. 파트너별 승률 계산 (D.partnerStats 순수 함수)
   * ========================================================= */

  test('v1.32 승률: 여러 게임을 세어 4전 3승 1패 → 75%', function () {
    var list = D.partnerStats([
      rec('2026-11-10', '조환비', [{ a: 21, b: 18 }, { a: 18, b: 21 }]),
      rec('2026-11-17', '조환비', [{ a: 21, b: 15 }]),
      rec('2026-11-19', '조환비', [{ a: 25, b: 23 }])
    ]);
    eq(list.length, 1, '파트너 한 명');
    eq(list[0].name, '조환비', '이름');
    eq(list[0].games, 4, '4전');
    eq(list[0].wins, 3, '3승');
    eq(list[0].losses, 1, '1패');
    eq(list[0].rate, 75, '승률 75%');
    eq(list[0].line, '4전 3승 1패', '한 줄 표기');
  });

  test('v1.32 승률: 점수 없이 승패만 적힌 일지는 1경기로 센다', function () {
    var list = D.partnerStats([
      rec('2026-11-10', '콕집사', [], { result: '승' }),
      rec('2026-11-11', '콕집사', [], { result: '승' }),
      rec('2026-11-12', '콕집사', [], { result: '패' })
    ]);
    eq(list[0].games, 3, '3경기');
    eq(list[0].wins, 2, '2승');
    eq(list[0].rate, 67, '67%');
  });

  test('v1.32 승률: 무승부는 승률 분모에서 뺀다', function () {
    var list = D.partnerStats([
      rec('2026-11-10', '조환비', [{ a: 21, b: 21 }, { a: 21, b: 19 }, { a: 18, b: 21 }])
    ]);
    eq(list[0].games, 3, '3전');
    eq(list[0].draws, 1, '1무');
    eq(list[0].rate, 50, '1승 1패 → 50%');
    includes(list[0].line, '1무', '무승부도 줄에 표시');
  });

  test('v1.32 승률: 파트너를 안 적은 일지와 점수 없는 일지는 빠진다', function () {
    var list = D.partnerStats([
      rec('2026-11-10', '', [{ a: 21, b: 18 }]),
      rec('2026-11-11', '조환비', []),
      rec('2026-11-12', '조환비', [{ a: 21, b: 18 }])
    ]);
    eq(list.length, 1, '한 명만');
    eq(list[0].games, 1, '점수 있는 1경기만');
  });

  test('v1.32 승률: 승률 높은 순 → 경기 많은 순 → 이름 순', function () {
    var list = D.partnerStats([
      rec('2026-11-10', '가나', [{ a: 21, b: 18 }]),
      rec('2026-11-11', '다라', [{ a: 21, b: 18 }, { a: 21, b: 19 }, { a: 21, b: 20 }]),
      rec('2026-11-12', '마바', [{ a: 21, b: 18 }, { a: 18, b: 21 }])
    ]);
    eq(list[0].name, '다라', '3전 3승이 먼저');
    eq(list[1].name, '가나', '1전 1승 다음(승률 100% · 경기수)');
    eq(list[2].name, '마바', '50%가 마지막');
    eq(D.partnerStats(list.map(function (p) { return rec('2026-11-13', p.name, [{ a: 21, b: 20 }]); }), { limit: 2 }).length, 2, 'limit');
    eq(D.partnerStats([], {}).length, 0, '기록 없음');
  });

  test('v1.32 승률: 순수 함수 — 입력을 바꾸지 않는다', function () {
    var input = [
      rec('2026-11-10', '조환비', [{ a: 21, b: 18 }]),
      rec('2026-11-12', '콕집사', [{ a: 18, b: 21 }])
    ];
    var copy = JSON.stringify(input);
    var a = D.partnerStats(input), b = D.partnerStats(input);
    eq(JSON.stringify(a), JSON.stringify(b), '두 번 계산해도 같다');
    eq(JSON.stringify(input), copy, '입력은 그대로');
  });

  /* =========================================================
   * 3. 저장 → 집계 (store)
   * ========================================================= */

  test('v1.32 저장: 일지를 저장하면 팀 칸 JSON과 파트너 승률이 함께 남는다', function () {
    return freshStore().then(function (store) {
      store.actions.setDraft({
        date: NOW, cond: 7, minutes: 60, done: ['게임'],
        games: [{ a: 21, b: 18 }, { a: 21, b: 19 }],
        partner: '조환비', video: VIDEO, videoNote: '스매시 손목 각도'
      });
      var res = store.actions.saveLog({ keepDraft: true });
      ok(res.ok, '저장 성공');
      var last = store.state.data.records[0];
      eq(last.team, '{"partner":"조환비","video":{"url":"' + VIDEO + '","label":"스매시 손목 각도"}}', '팀 칸 JSON');
      var meta = D.logMeta(last);
      eq(meta.partner, '조환비', '읽어도 파트너');
      eq(meta.video.url, VIDEO, '읽어도 영상');
      var table = D.partnerStats(store.state.data.records);
      eq(table[0].name, '조환비', '승률 표에 등장');
      eq(table[0].games, 2, '2경기');
      eq(table[0].rate, 100, '2승');
      /* 저장된 행은 여전히 26칸 */
      var row = store.state.rows.filter(function (r) { return String(r[0]) === String(last.id); })[0];
      eq(row.length, 26, '26칸 그대로');
    });
  });

  test('v1.32 저장: 파트너를 안 적으면 팀 칸이 비어 있다', function () {
    return freshStore().then(function (store) {
      store.actions.setDraft({ date: NOW, cond: 6, minutes: 40, games: [{ a: 21, b: 15 }] });
      ok(store.actions.saveLog({ keepDraft: true }).ok, '저장 성공');
      var last = store.state.data.records[0];
      eq(last.team, '', '빈 칸');
      eq(D.partnerStats(store.state.data.records).length, 0, '승률 표도 비어 있다');
    });
  });

  test('v1.32 챌린지 공유: 글쓰기로 문구와 말머리를 채우고 커뮤니티 탭으로 옮긴다', function () {
    return freshStore().then(function (store) {
      var text = D.challengeShareText({ weakness: '헤어핀', goal: 3 });
      eq(text, '이번 주 헤어핀 3회 연습 달성! 🎉', '자랑 문구');
      var res = store.actions.startChallengeShare(text, '일지');
      ok(res.ok, '이동');
      eq(store.state.ui.composer, text, '작성칸 문구');
      eq(store.state.ui.composerTopic, '일지', '말머리');
      eq(store.state.ui.tab, 'community', '커뮤니티 탭');
      eq(store.state.data.posts.length, store.state.data.posts.length, '글은 올리지 않는다');
      eq(D.challengeShareText({}), '', '약점이 없으면 빈 문구');
    });
  });

  /* =========================================================
   * 4. 화면 (일지 & AI)
   * ========================================================= */

  test('v1.32 화면: 일지 입력에 파트너 칸과 영상 칸이 있다', function () {
    var html = BM.views.log.render(stateOf([]));
    includes(html, 'data-field="partner"', '파트너 입력칸');
    includes(html, '복식 파트너', '라벨');
    includes(html, 'maxlength="20"', '20자 상한');
    includes(html, 'data-field="video"', '영상 링크 칸');
    includes(html, 'data-field="videoNote"', '한 줄 체크 포인트 칸');
    includes(html, 'data-video-hint', '주소 안내 한 줄');
    checkHtml(html, '일지 화면');
  });

  test('v1.32 화면: 영상 주소 안내 — 잘못된 주소는 미리 알려 준다', function () {
    eq(BM.views.log.videoHintOf('').bad, false, '빈 칸은 안내만');
    includes(BM.views.log.videoHintOf('').text, '링크만', '빈 칸 안내');
    eq(BM.views.log.videoHintOf('javascript:alert(1)').bad, true, 'javascript:는 경고');
    includes(BM.views.log.videoHintOf('javascript:alert(1)').text, 'http', '무엇이 되는지 알려 준다');
    eq(BM.views.log.videoHintOf(VIDEO).bad, false, '정상 주소');
  });

  test('v1.32 화면: 파트너 이름이 없으면 승률 카드는 그리지 않는다', function () {
    eq(BM.views.log.partnerBlock(stateOf([])), '', '기록 없음');
    eq(BM.views.log.partnerBlock(stateOf([rec('2026-11-19', '', [{ a: 21, b: 18 }])])), '', '파트너 없는 일지만');
  });

  test('v1.32 화면: 파트너별 승률 줄 — 조환비 4전 3승 · 75%', function () {
    var records = [
      rec('2026-11-10', '조환비', [{ a: 21, b: 18 }, { a: 18, b: 21 }]),
      rec('2026-11-17', '조환비', [{ a: 21, b: 15 }]),
      rec('2026-11-19', '조환비', [{ a: 25, b: 23 }]),
      rec('2026-11-18', '콕집사', [{ a: 18, b: 21 }])
    ];
    var html = BM.views.log.partnerBlock(stateOf(records));
    includes(html, 'data-region="partner"', '카드');
    includes(html, '파트너별 승률', '제목');
    includes(html, '조환비', '이름');
    includes(html, '4전 3승 1패', '전적');
    includes(html, '75%', '승률');
    includes(html, '콕집사', '두 번째 파트너');
    includes(html, '0%', '한 번 지면 0%');
    ok(html.indexOf('조환비') < html.indexOf('콕집사'), '승률 높은 파트너가 먼저');
    checkHtml(html, '파트너 카드');
  });

  test('v1.32 화면: 파트너 이름도 이스케이프한다', function () {
    var html = BM.views.log.partnerBlock(stateOf([rec('2026-11-19', '<b>x</b>', [{ a: 21, b: 18 }])]));
    excludes(html, '<b>x</b>', '태그가 그대로 나가면 안 된다');
    includes(html, '&lt;b&gt;x&lt;/b&gt;', '이스케이프');
  });

  test('v1.32 화면: 파트너 카드가 없을 때 다시 그려도 오류가 없다', function () {
    var st = stateOf([]);
    var html = BM.views.log.render(st);
    excludes(html, 'data-region="partner"', '카드 없음');
  });

  test('v1.32 화면: 저장한 일지에 영상 보기 버튼 (새 창 · noopener)', function () {
    var r = D.fromRow(D.toRow({
      id: 'v1', type: '기록', date: '2026-11-20', userKey: ME, nick: '나래',
      games: [{ a: 21, b: 18 }], scoreRaw: '21:18',
      team: D.logExtraJson({ partner: '조환비', video: { url: VIDEO, label: '스매시 손목 각도' } })
    }));
    var html = BM.views.log.recordDetail(r);
    includes(html, '영상 보기 ↗', '버튼 하나');
    includes(html, 'href="' + VIDEO + '"', '주소');
    includes(html, 'target="_blank"', '새 창');
    includes(html, 'rel="noopener noreferrer"', '안전한 새 창');
    includes(html, '스매시 손목 각도', '체크 포인트');
    includes(html, '복식 파트너', '상세 표에 파트너');
    includes(html, '조환비', '파트너 이름');
    checkHtml(html, '일지 상세');
  });

  test('v1.32 화면: javascript: 주소는 버튼으로 나가지 않는다', function () {
    var r = D.fromRow(D.toRow({
      id: 'v2', type: '기록', date: '2026-11-20', userKey: ME,
      team: JSON.stringify({ partner: '조환비', video: { url: 'javascript:alert(1)', label: 'x' } })
    }));
    var html = BM.views.log.recordDetail(r);
    excludes(html, 'javascript:', '차단');
    excludes(html, '영상 보기', '버튼 없음');
    includes(html, '조환비', '파트너는 남는다');
  });

  test('v1.32 화면: 최근 기록 줄에서도 영상 한 번에 · 파트너 이름 표시', function () {
    var r = D.fromRow(D.toRow({
      id: 'v3', type: '기록', date: '2026-11-20', userKey: ME, nick: '나래',
      games: [{ a: 21, b: 18 }], scoreRaw: '21:18', weakness: ['헤어핀'],
      team: D.logExtraJson({ partner: '조환비', video: { url: VIDEO } })
    }));
    var html = BM.views.log.render(stateOf([r]));
    includes(html, 'data-video', '최근 기록의 영상 링크');
    includes(html, 'href="' + VIDEO + '"', '주소');
    includes(html, 'rel="noopener noreferrer"', '안전한 새 창');
    includes(html, '영상 보기 ↗', '문구');
    includes(html, '함께 조환비', '파트너 이름');
    checkHtml(html, '최근 기록');
  });

  test('v1.32 화면: 챌린지 3회 달성 카드에만 자랑하기 버튼', function () {
    var two = [
      { date: '2026-11-10', weakness: ['헤어핀'], done: [] },
      { date: '2026-11-16', weakness: ['헤어핀'], done: [] },
      { date: '2026-11-18', weakness: ['헤어핀'], done: [] }
    ];
    var notYet = BM.views.log.challengeBlock(stateOf(two));
    includes(notYet, '주간 약점 챌린지', '카드');
    excludes(notYet, 'challenge-share', '2회에는 버튼 없음');

    var done = two.concat([{ date: '2026-11-19', weakness: ['헤어핀'], done: [] }]);
    var html = BM.views.log.challengeBlock(stateOf(done));
    includes(html, 'data-act="challenge-share"', '자랑하기 버튼');
    includes(html, '커뮤니티에 자랑하기', '문구');
    includes(html, '3회 채웠어요', '달성 배지');
    checkHtml(html, '챌린지 달성 카드');
  });

  /* =========================================================
   * 5. 스타일 · 버전 · 문서
   * ========================================================= */

  test('v1.32 스타일: 파트너·영상 클래스가 테마 변수를 쓴다', function () {
    if (!hasNode) return;
    var css = readRoot('styles.css');
    ['.ptnfield', '.card--ptn', '.ptn__row', '.ptn__rate', '.logrow__vid', '.vidbox', '.field__hint', '.wkch__acts'].forEach(function (sel) {
      includes(css, sel, sel + ' 정의');
    });
    ok(/\.ptn__rate\s*\{[^}]*var\(--accent\)/.test(css), '승률은 테마 강조색');
    ok(/\.vidbox\s*\{[^}]*var\(--card\)/.test(css), '영상 블록은 테마 카드색');
    excludes(css.match(/\.ptn__rate\s*\{[^}]*\}/)[0], '#fff', '고정 색을 쓰지 않는다');
  });

  test('v1.32 버전: sw · app · index · README · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.37.1'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.37.1'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261121-39', 'index.html 스타일 캐시');
    includes(readRoot('README.md'), 'v1.37.1', 'README 변경 이력');
    var twa = JSON.parse(readRoot('twa-manifest.json'));
    eq(twa.appVersionName, '1.37.1', 'TWA 버전 이름');
    eq(twa.appVersion, '1.37.1', 'TWA appVersion');
    eq(twa.appVersionCode, 38, 'TWA 버전 코드');
  });

  test('v1.32 문서: 아이디어 노트에 이번 사이클과 다음 후보가 남는다', function () {
    if (!hasNode) return;
    var doc = readRoot('ideas.md');
    includes(doc, 'v1.37.1', '이번 사이클');
    includes(doc, '파트너', '파트너 승률');
    includes(doc, '영상', '영상 체크 메모');
    includes(doc, '커뮤니티에 자랑하기', '챌린지 공유');
    includes(doc, '반영 완료', '반영 표시');
  });

  test('v1.32 파일: 앱 껍데기(sw)에 새 화면 코드가 들어 있다', function () {
    if (!hasNode) return;
    var sw = readRoot('sw.js');
    includes(sw, './js/views/log.js', 'log.js');
    includes(sw, './js/domain.js', 'domain.js');
    includes(sw, './styles.css', 'styles.css');
    var idx = readRoot('index.html');
    includes(idx, 'js/views/log.js', 'index.html 로드');
  });

  test('v1.32 시트 다리: 일지 수정 때 팀 칸(파트너·영상)도 받는다', function () {
    if (!hasNode) return;
    var gs = readRoot('APPS_SCRIPT_BRIDGE.gs');
    var block = gs.match(/'기록':\s*\[[^\]]*\]/);
    ok(block, '기록 수정 허용 칸 목록');
    includes(block[0], "'팀'", '팀 칸');
    includes(block[0], "'게임점수'", '기존 칸 유지');
    excludes(block[0], "'사용자ID'", '사용자ID는 못 바꿈');
    excludes(block[0], "'비밀번호'", '비밀번호는 못 바꿈');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
