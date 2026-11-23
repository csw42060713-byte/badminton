/* ============================================================
 * test/v152.test.js — bm-v1.52.2
 *   🎥 영상 자세 비교 — 영상을 구간으로 나눠 모두 분석 · 선수 직접 선택
 *
 *  1) 구간 나누기 (순수 함수)
 *     · splitSegments — 6초 이하 1구간 / 5초·10초 단위 / 최대 8구간 / 빈틈없이 이어짐
 *     · sampleTimes — 고른 구간 안에서만 12~20프레임 · 오름차순 · 뒤집힌 입력도 안전
 *  2) 다인 트랙 (순수 함수)
 *     · trackPoses — 2명·4명 분리, 한 프레임이 비어도 같은 선수, 한 장짜리 오검출 제거
 *     · analyzeSegment — 선수별로 따로 카드·판정, 1명이면 v1.50과 똑같이 자동 선택
 *     · nearestPlayer — 캔버스에서 누른 자리로 선수 바꾸기
 *  3) 구간 요약 · 화면 — '보완 N건'/'좋아요'/'사람을 못 찾음', 구간 칩·선수 칩·안내 배너
 *  4) 배선·보안·버전 — numPoses 4, CSP(여전히 기기 안에서만), sw·app·index·TWA
 * 실행: node test/run.js
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM;
  var P = BM.pose;
  var t = BM.test, test = t.test, eq = t.eq, ok = t.ok, includes = t.includes, excludes = t.excludes;

  var hasNode = false;
  try { hasNode = typeof require === 'function' && typeof root.__REPO_ROOT__ === 'string'; } catch (e) { hasNode = false; }

  function readRoot(file) {
    var fs = require('fs'), path = require('path');
    return fs.readFileSync(path.join(root.__REPO_ROOT__, file), 'utf8');
  }

  /* ---------- 테스트용 좌표 만들기 (실제 영상 대신) ---------- */

  /* 한 사람이 n프레임 동안 팔을 조금씩 움직이는 장면 */
  function seq(cfg, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var lm = P.poseFrame({
        elbowAng: (cfg.elbowAng || 150) + (i % 2 ? 4 : -4),
        kneeFlex: cfg.kneeFlex == null ? 70 : cfg.kneeFlex,
        armDir: cfg.armDir == null ? 186 : cfg.armDir,
        leanX: cfg.leanX || 0
      });
      out.push({ t: Math.round(i * 100) / 1000, lm: lm });
    }
    return out;
  }

  /* 두 사람이 나란히(왼쪽·오른쪽) 서 있는 프레임 묶음 — poses에 둘 다 */
  function duo(a, b) {
    return a.map(function (f, i) {
      var left = P.placePose(f.lm, 0.27, 0.56, 0.5);
      var right = P.placePose(b[i].lm, 0.73, 0.56, 0.5);
      return { t: f.t, lm: left, poses: [left, right] };
    });
  }

  /* 복식 4명 */
  function quad(a) {
    return a.map(function (f) {
      var poses = [0.14, 0.38, 0.62, 0.86].map(function (x) { return P.placePose(f.lm, x, 0.58, 0.34); });
      return { t: f.t, lm: poses[0], poses: poses };
    });
  }

  /* ============================================================
   * 1. 구간 나누기 · 샘플 시각
   * ============================================================ */

  test('v1.52 구간: 영상 길이에 따라 자동으로 나뉜다', function () {
    eq(P.splitSegments(0).length, 0, '길이가 0이면 구간 없음');
    eq(P.splitSegments(-3).length, 0, '음수도 안전');
    eq(P.splitSegments(NaN).length, 0, '숫자가 아니면 구간 없음');

    var one = P.splitSegments(5.4);
    eq(one.length, 1, '6초 이하는 나누지 않음');
    eq(one[0].start, 0, '처음은 0초');
    eq(one[0].end, 5.4, '끝은 영상 길이');
    eq(one[0].label, '1구간', '칩 이름');

    var s15 = P.splitSegments(15);
    eq(s15.length, 3, '15초 → 5초 단위 3구간');
    eq(s15[0].start, 0, '1구간 시작');
    eq(s15[0].end, 5, '1구간 끝');
    eq(s15[1].label, '2구간', '2구간 이름');
    eq(s15[2].start, 10, '3구간 시작');
    eq(s15[2].end, 15, '3구간 끝');

    var s60 = P.splitSegments(60);
    eq(s60.length, 6, '60초 → 10초 단위 6구간');
    eq(s60[s60.length - 1].end, 60, '영상 끝까지');
    ok(s60[0].span >= 9.9 && s60[0].span <= 10.1, '긴 영상은 10초 단위: ' + s60[0].span);

    var huge = P.splitSegments(200);
    eq(huge.length, P.SEG_MAX, '아무리 길어도 8구간');
    eq(huge[huge.length - 1].end, 200, '그래도 영상 끝까지');
  });

  test('v1.52 구간: 빈틈없이 이어지고 순서가 맞는다', function () {
    [6.4, 12, 21.7, 60, 200].forEach(function (d) {
      var segs = P.splitSegments(d);
      ok(segs.length >= 2 || d <= 6, d + '초 구간 수: ' + segs.length);
      segs.forEach(function (s, i) {
        ok(s.end > s.start, d + '초 ' + s.label + ' 길이가 양수');
        eq(s.start, i === 0 ? 0 : segs[i - 1].end, d + '초 ' + s.label + '은 앞 구간 끝에서 시작');
        eq(s.label, (i + 1) + '구간', '번호가 이어짐');
        ok(s.span >= 0.2, '누를 수 있는 길이: ' + s.span);
      });
      eq(segs[segs.length - 1].end, Math.round(d * 10) / 10, d + '초 마지막 구간이 영상 끝까지');
    });
  });

  test('v1.52 구간: 샘플 시각은 고른 구간 안에서만 오름차순', function () {
    var st = P.sampleTimes(4, 8, 12);
    eq(st.length, 12, '12프레임');
    ok(st[0] >= 4 && st[st.length - 1] <= 8, '구간(4~8초) 밖으로 안 나감');
    ok(st[0] < 4.5 && st[st.length - 1] > 7.5, '구간 양 끝을 넓게 씀');
    var prev = -1, mono = true;
    st.forEach(function (v) { if (v <= prev) mono = false; prev = v; });
    ok(mono, '시간이 오름차순');

    var rev = P.sampleTimes(8, 4, 12);
    eq(rev[0], st[0], '시작·끝을 뒤집어 넣어도 같은 구간');
    eq(rev[rev.length - 1], st[st.length - 1], '뒤집어도 끝이 같음');

    eq(P.sampleTimes(4, 4, 12).length, 0, '길이 0인 구간은 빈 목록');
    eq(P.sampleTimes(4, 8, 999).length, P.SAMPLE_MAX, '너무 많이 달라고 해도 20장');
    eq(P.sampleTimes(4, 8, 1).length, 4, '너무 적게 달라고 해도 4장은 뽑음');

    /* 구간마다 뽑은 시각이 그 구간 안에 있는지 — 0~4 / 4~8 / 8~12초 */
    P.splitSegments(12).forEach(function (seg) {
      P.sampleTimes(seg.start, seg.end, P.SEG_SAMPLE).forEach(function (t0) {
        ok(t0 >= seg.start && t0 <= seg.end, seg.label + ' 시각 ' + t0);
      });
    });
  });

  /* ============================================================
   * 2. 다인 트랙 · 선수 선택
   * ============================================================ */

  test('v1.52 다인: 두 선수를 각자 트랙으로 나눈다', function () {
    var f2 = duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12));
    var tk = P.trackPoses(f2);
    eq(tk.count, 2, '두 명');
    eq(tk.tracks[0].id, 1, '1번 선수');
    eq(tk.tracks[0].label, '선수 1', '칩 이름');
    ok(tk.tracks[0].primary, '1번이 주 트랙');
    ok(!tk.tracks[1].primary, '2번은 주 트랙이 아님');
    eq(tk.tracks[0].count, 12, '1번은 모든 프레임에서 잡힘');
    eq(tk.tracks[1].count, 12, '2번도 모든 프레임에서 잡힘');
    var h1 = tk.tracks[0].byFrame[0], h2 = tk.tracks[1].byFrame[0];
    ok(h1 && h2, '프레임마다 자리를 남긴다');
    ok(Math.abs(h1.box.x - h2.box.x) > 0.2, '두 선수 자리가 확실히 다름');
    ok(h1.lm !== h2.lm, '좌표를 섞지 않음');
    /* 프레임마다 같은 선수가 같은 트랙에 남는다(뒤 프레임에서도 자리 유지) */
    ok(tk.tracks[0].byFrame[11].box.x < 0.5, '1번은 계속 왼쪽');
    ok(tk.tracks[1].byFrame[11].box.x > 0.5, '2번은 계속 오른쪽');
    eq(tk.frameCount, 12, '본 프레임 수');
  });

  test('v1.52 다인: 복식 4명도 트랙이 겹치지 않는다', function () {
    var tk = P.trackPoses(quad(seq({ elbowAng: 160 }, 12)));
    eq(tk.count, 4, '네 명');
    var xs = [];
    for (var i = 0; i < 4; i++) {
      eq(tk.tracks[i].count, 12, (i + 1) + '번 모든 프레임');
      xs.push(tk.tracks[i].byFrame[6].box.x);
    }
    xs.sort(function (a, b) { return a - b; });
    for (var k = 1; k < xs.length; k++) ok(xs[k] - xs[k - 1] > 0.15, '자리가 겹치지 않음: ' + xs.join(','));
    ok(P.NUM_POSES === 4, '모델이 한 번에 4명을 찾게 설정');
  });

  test('v1.52 다인: 한 프레임이 비거나 한 장짜리 오검출은 트랙을 흔들지 않는다', function () {
    var f2 = duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12));
    /* 6번째 프레임에서 1번 선수를 놓친 경우 */
    var gap = f2.map(function (f, i) {
      if (i !== 5) return f;
      return { t: f.t, lm: f.poses[1], poses: [f.poses[1]] };
    });
    var tk = P.trackPoses(gap);
    eq(tk.count, 2, '놓친 프레임이 있어도 두 명');
    eq(tk.tracks[0].count + tk.tracks[1].count, 23, '한 프레임만 빠짐');

    /* 딱 한 프레임에만 나타난 오검출 */
    var noise = f2.map(function (f, i) {
      if (i !== 3) return f;
      var ghost = P.placePose(P.poseFrame({}), 0.95, 0.95, 0.18);
      return { t: f.t, lm: f.lm, poses: [f.poses[0], f.poses[1], ghost] };
    });
    eq(P.trackPoses(noise).count, 2, '한 장짜리는 선수로 안 셈');

    /* 아무도 없으면 빈 목록 — 앱이 죽지 않는다 */
    eq(P.trackPoses([{ t: 0, lm: null, poses: [] }]).count, 0, '사람 없음');
    ok(!P.analyzeSegment([{ t: 0, lm: null, poses: [] }], 'smash').ok, '분석 실패도 조용히');
  });

  test('v1.52 다인: 선수마다 따로 재고 카드가 다르다', function () {
    var f2 = duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12));
    var an = P.analyzeSegment(f2, 'smash');
    ok(an.ok, '분석 성공');
    eq(an.count, 2, '선수 2명');
    eq(an.players.length, 2, '선수별 결과 2개');
    eq(an.pick, 0, '기본 선택은 주 트랙(1번)');
    var p1 = an.players[0].result, p2 = an.players[1].result;
    ok(p1.ok && p2.ok, '두 선수 모두 카드가 나온다');
    eq(p1.cards.length, 5, '1번 카드 5장(점프 타이밍 포함)');
    eq(p2.cards.length, 5, '2번 카드 5장(점프 타이밍 포함)');
    ok(p1.cards[0].text !== p2.cards[0].text, '팔꿈치 수치가 다르다: ' + p1.cards[0].text + ' vs ' + p2.cards[0].text);
    eq(p1.cards[0].verdict, 'good', '1번(166°)는 기준 안');
    eq(p2.cards[0].verdict, 'low', '2번(120°)는 낮음');
    includes(p2.cards[0].tip, '팔을 쭉 펴', '2번 카드의 쉬운 말 보완점');
    /* 선수의 프레임 묶음도 따로 — 1번은 왼쪽 자세만 */
    ok(an.players[0].seq.length === 12, '1번 프레임 12장');
    var torsoL = P.torsoOf(an.players[0].seq[0].lm), torsoR = P.torsoOf(an.players[1].seq[0].lm);
    ok(torsoL.x < 0.5 && torsoR.x > 0.5, '선수별 좌표가 섞이지 않음');
  });

  test('v1.52 다인: 1명이면 예전처럼 바로 분석한다(자동 선택)', function () {
    var one = P.analyzeSegment(P.demoFrames('smash'), 'smash');
    ok(one.ok, '1인 영상도 바로 분석');
    eq(one.count, 1, '선수 1명');
    eq(one.pick, 0, '자동 선택');
    eq(one.players.length, 1, '선수 칩 없이 한 명');
    var base = P.measure(P.demoFrames('smash'), 'smash');
    eq(one.players[0].result.cards[0].text, base.cards[0].text, 'v1.50과 같은 수치');
    eq(one.players[0].result.cards[0].verdict, base.cards[0].verdict, 'v1.50과 같은 판정');
    eq(one.players[0].result.summary, base.summary, '맨 위 한 줄도 그대로');
    var foot = P.analyzeSegment(P.demoFrames('foot'), 'foot');
    eq(foot.players[0].result.cards[0].key, 'stance', '풋워크도 그대로');
  });

  test('v1.52 다인: 상세 화면은 그 선수가 실제로 있는 프레임을 편다', function () {
    var f2 = duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12));
    /* 가운데 프레임들에서 2번 선수가 안 잡힌 경우 — 프레임과 잰 프레임 번호가 어긋나기 쉽습니다 */
    var gappy = f2.map(function (f, i) {
      if (i !== 5 && i !== 6) return f;
      return { t: f.t, lm: f.poses[0], poses: [f.poses[0]] };
    });
    var an = P.analyzeSegment(gappy, 'smash');
    var p2 = an.players[1];
    ok(p2 && p2.result.ok, '2번도 카드가 나온다');
    ok(p2.result.picks.frame != null, '화면에 펼 프레임 번호를 함께 남긴다');
    ok(p2.result.picks.frame >= p2.result.picks.key, '영상 프레임 번호는 잰 순서보다 뒤일 수 있다: ' +
      p2.result.picks.key + ' → ' + p2.result.picks.frame);
    ok(p2.result.picks.frame < p2.seq.length, '영상 프레임 범위 안');
    ok(p2.seq[p2.result.picks.frame] && p2.seq[p2.result.picks.frame].lm, '그 프레임에 2번 좌표가 있다');
    /* 1번은 모든 프레임에 있으니 frame == key */
    var p1 = an.players[0];
    eq(p1.result.picks.frame, p1.result.picks.key, '모든 프레임에 있으면 그대로');
  });

  test('v1.52 다인: 캔버스에서 누른 자리로 그 선수가 골라진다', function () {
    var an = P.analyzeSegment(duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12)), 'smash');
    eq(P.nearestPlayer(an.players, 0, { x: 0.72, y: 0.56 }), 1, '오른쪽 사람을 누르면 2번');
    eq(P.nearestPlayer(an.players, 0, { x: 0.2, y: 0.5 }), 0, '왼쪽 사람을 누르면 1번');
    eq(P.nearestPlayer(an.players, 0, { x: 0.5, y: 0.98 }), -1, '아무도 없는 바닥은 그대로');
    eq(P.nearestPlayer([], 0, { x: 0.5, y: 0.5 }), -1, '선수가 없으면 -1');
    eq(P.nearestPlayer(an.players, 0, null), -1, '좌표가 없으면 -1');
  });

  /* ============================================================
   * 3. 구간 요약 · 화면
   * ============================================================ */

  test('v1.52 구간: 구간마다 요약이 다르게 나온다', function () {
    var good = P.analyzeSegment(seq({ elbowAng: 166 }, 12), 'smash');
    var low = P.analyzeSegment(seq({ elbowAng: 120 }, 12), 'smash');
    var none = P.analyzeSegment([{ t: 0, lm: null, poses: [] }], 'smash');

    var gs = P.segSummary({ analysis: good });
    eq(gs.text, '좋아요', '기준 안이면 좋아요');
    eq(gs.tone, 'good', '색 구분');

    var ls = P.segSummary({ analysis: low });
    includes(ls.text, '보완', '어긋난 항목 수: ' + ls.text);
    eq(ls.tone, 'warn', '색 구분');

    var ns = P.segSummary({ analysis: none });
    includes(ns.text, '사람을 못 찾음', '사람이 없을 때');
    eq(P.segSummary(null).text, '분석 중…', '아직 안 끝난 구간');
    eq(P.segSummary({ analysis: low }).people, 1, '사람 수를 함께');
  });

  test('v1.52 화면: 구간 칩 · 선수 칩 · 안내 배너', function () {
    var st = P._state();
    var keep = { segs: st.segs, seg: st.seg, duration: st.duration, mode: st.mode, segPlan: st.segPlan };
    var good = P.analyzeSegment(seq({ elbowAng: 166 }, 12), 'smash');
    var duoAn = P.analyzeSegment(duo(seq({ elbowAng: 166 }, 12), seq({ elbowAng: 120 }, 12)), 'smash');
    st.mode = 'smash';
    st.seg = 1;
    st.duration = 12.4;
    st.segPlan = [];
    st.segs = [
      { seg: { index: 0, start: 0, end: 5, span: 5, label: '1구간' }, frames: [], analysis: good, track: 0 },
      { seg: { index: 1, start: 5, end: 10, span: 5, label: '2구간' }, frames: [], analysis: duoAn, track: 0 }
    ];

    var bar = P.segBarHtml();
    includes(bar, '구간별 분석', '제목');
    includes(bar, '영상 12.4초', '영상 길이');
    includes(bar, '1구간', '1구간 칩');
    includes(bar, '0.0~5.0초', '1구간 시간');
    includes(bar, '2구간', '2구간 칩');
    includes(bar, '5.0~10.0초', '2구간 시간');
    includes(bar, 'data-pose-seg="0"', '칩을 누르면 그 구간');
    includes(bar, '좋아요', '1구간 요약');
    includes(bar, '선수 2명', '2구간 사람 수');
    eq((bar.match(/class="poseseg is-on"/g) || []).length, 1, '지금 구간 하나만 켜짐');
    includes(bar, 'data-pose-seg="1"', '2구간도 누를 수 있음');

    var who = P.whoHtml();
    includes(who, '선수 2명이 보여요', '안내 배너');
    includes(who, '분석할 선수를 눌러 고르세요', '고르는 말');
    includes(who, 'data-pose-track="0"', '선수 1 칩');
    includes(who, 'data-pose-track="1"', '선수 2 칩');
    includes(who, 'data-pose-chips', '칩 줄');

    /* 아직 분석 중인 구간(계획만 있는 상태)은 눌리지 않게 */
    st.segPlan = [st.segs[0].seg, { index: 1, start: 10, end: 12, span: 2, label: '3구간' }];
    st.segs = [st.segs[0]];
    st.seg = 0;
    var pending = P.segBarHtml();
    includes(pending, '3구간', '아직 분석 중인 구간도 칩으로 보인다');
    includes(pending, 'disabled', '그 칩은 아직 누를 수 없다');
    includes(pending, 'is-pending', '흐리게 보인다');
    includes(pending, '분석 중', '분석 중이라고 적는다');
    st.segs = [
      { seg: { index: 0, start: 0, end: 5, span: 5, label: '1구간' }, frames: [], analysis: good, track: 0 },
      { seg: { index: 1, start: 5, end: 10, span: 5, label: '2구간' }, frames: [], analysis: duoAn, track: 0 }
    ];
    st.segPlan = [];

    /* 1명 구간에서는 안내·선수 칩이 없다(예전 화면 그대로) */
    st.seg = 0;
    eq(P.whoHtml(), '', '1명이면 선수 칩 없음');

    /* 사람을 못 찾은 구간을 고르면 다음 행동을 알려 준다 */
    st.segs[0] = { seg: st.segs[0].seg, frames: [{ t: 0, lm: null, poses: [] }], analysis: P.analyzeSegment([{ t: 0, lm: null, poses: [] }], 'smash'), track: 0 };
    st.frames = st.segs[0].frames;
    st.result = null;
    includes(P.stageHtml(), '사람을 찾지 못했어요', '다른 구간을 눌러 보라고 안내');

    /* 구간이 아직 없으면 칩도 없다 */
    st.segs = [];
    st.duration = 0;
    st.segPlan = [];
    eq(P.segBarHtml(), '', '분석 전에는 구간 칩 없음');
    eq(P.whoHtml(), '', '분석 전에는 안내 없음');

    st.segs = keep.segs; st.seg = keep.seg; st.duration = keep.duration;
    st.mode = keep.mode; st.segPlan = keep.segPlan;
    st.frames = null; st.result = null;   /* 다음 테스트(처음 화면)를 위해 되돌립니다 */
  });

  test('v1.52 화면: 패널에 구간·복식 예시와 1인 안내가 함께 있다', function () {
    var shell = P.shellHtml();
    includes(shell, 'data-pose-canvas', '스켈레톤 캔버스');
    includes(shell, 'data-pose-range', '프레임 이동');
    includes(shell, 'data-pose-demo', '1인 예시');
    includes(shell, 'data-pose-demo="duo"', '복식 예시');
    includes(shell, 'data-pose-close', '닫기');
    includes(P.statusHtml(), '5~10초 구간으로 나눠 모두 분석', '자동 분할 안내');
    excludes(shell, '<script', '스크립트를 넣지 않는다');
    /* 구간·선수 칩은 분석 뒤에만 — 처음 화면에는 없다 */
    excludes(shell, 'data-pose-segs', '처음엔 구간 칩 없음');

    /* 예시 데이터: 1인 1구간 · 복식 2구간 2명 */
    var d1 = P.demoFrames('smash');
    eq(P.analyzeSegment(d1, 'smash').count, 1, '1인 예시는 1명');
    var d2 = P.demoDuo('smash');
    eq(d2.length, 2, '복식 예시는 2구간');
    eq(P.analyzeSegment(d2[0].frames, 'smash').count, 2, '복식 예시 한 구간에 2명');
    eq(P.analyzeSegment(d2[1].frames, 'smash').players[0].result.cards[0].text,
      P.analyzeSegment(d1, 'smash').players[0].result.cards[0].text, '복식 예시도 같은 자세 기준');
  });

  test('v1.52 화면: 일지 메모에 구간 시간이 함께 들어간다', function () {
    var r = P.analyzeSegment(P.demoFrames('smash'), 'smash').players[0].result;
    var line = P.noteLine(r, { segTime: '5.0~10.0초' });
    includes(line, '영상 자세 비교', '제목');
    includes(line, '5.0~10.0초', '구간 시간');
    includes(line, '팔꿈치 각도 150', '수치');
    ok(line.length < 160, '메모 한 줄 길이: ' + line.length);
    var duoLine = P.noteLine(r, { segTime: '0.0~5.0초', player: 2, players: 2 });
    includes(duoLine, '2번 선수', '여러 명이면 몇 번 선수인지');
    excludes(P.noteLine(r), '번 선수', '1명이면 선수 번호 없음');
  });

  /* ============================================================
   * 4. 배선 · 보안 · 버전
   * ============================================================ */

  test('v1.52 MediaPipe: 한 프레임에서 4명까지 찾는다', function () {
    eq(P.NUM_POSES, 4, 'numPoses 4');
    eq(P.modelState().poses, 4, '모델 상태에도 4명');
    var pose = readRoot('js/pose.js');
    includes(pose, 'numPoses: NUM_POSES', '모델 옵션에 연결');
    includes(pose, 'runningMode: \'IMAGE\'', '이미지 모드(프레임 단위)');
    includes(pose, 'splitSegments', '구간 나누기');
    includes(pose, 'trackPoses', '선수 트랙');
    includes(pose, 'data-pose-seg', '구간 칩');
    includes(pose, 'data-pose-track', '선수 칩');
  });

  test('v1.52 보안: 영상은 여전히 기기 안에서만 · 서버 없음', function () {
    var pose = readRoot('js/pose.js');
    excludes(pose, 'supabase', '실서버(DB) 접근 없음');
    excludes(pose, 'app_records', '앱 기록 테이블 없음');
    excludes(pose, 'XMLHttpRequest', '직접 업로드 없음');
    excludes(pose, "method: 'POST'", '업로드 없음');
    includes(pose, 'URL.createObjectURL', '기기 안 blob 주소로만 연다');
    includes(pose, 'URL.revokeObjectURL', '다 쓰면 주소를 지운다');
    excludes(pose, 'window.confirm(', '브라우저 confirm 창 없음');
    includes(pose, 'U.esc(', '사용자가 넣은 값도 탈출');

    var index = readRoot('index.html');
    var m = index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    ok(m, 'CSP 메타');
    includes(m[1], "media-src 'self' blob:", '폰에서 고른 영상(blob)만 재생');
    includes(m[1], 'https://cdn.jsdelivr.net', '자세 모델 코드');
    includes(m[1], 'https://storage.googleapis.com', '자세 모델 파일');
    includes(m[1], "object-src 'none'", 'object-src 그대로');
    includes(m[1], "'wasm-unsafe-eval'", 'WASM 실행');
  });

  test('v1.52 배선: 테스트 목록에 새 테스트 파일이 들어 있다', function () {
    if (!hasNode) return;
    includes(readRoot('test/run.js'), 'test/v152.test.js', '테스트 목록');
    includes(readRoot('test/run.js'), 'js/pose.js', 'pose.js는 그대로');
    includes(readRoot('sw.js'), "'./js/pose.js'", '서비스워커 캐시');
  });

  test('v1.52 버전: sw · app · index · TWA 가 함께 올라간다', function () {
    if (!hasNode) return;
    includes(readRoot('sw.js'), "var VERSION = 'bm-v1.62.0'", 'sw.js');
    includes(readRoot('app.js'), "version: 'v1.62.0'", 'app.js');
    includes(readRoot('index.html'), 'styles.css?v=20261123-6', '스타일 캐시');
    includes(readRoot('twa-manifest.json'), '"appVersionName": "1.62.0"', 'TWA 버전');
    includes(readRoot('twa-manifest.json'), '"appVersionCode": 56', '앱 버전 코드 +1');
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
