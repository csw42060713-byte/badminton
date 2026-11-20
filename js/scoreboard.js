/* ============================================================
 * scoreboard.js — 코트 점수판 계산 (화면과 분리한 순수 함수)
 *
 * 코트에서 상대와 바로 점수를 세는 21점제(배드민턴 공식) · 25점제(동호인/연습)
 * 점수판이 씁니다. 화면·저장소를 건드리지 않으므로 테스트에서 그대로 돌려 봅니다.
 *
 * 규칙 (배드민턴 공식):
 *   · 21점제: 먼저 21점 + 2점 차  /  20-20(듀스)부터는 2점 차가 날 때까지
 *   · 25점제: 먼저 25점 + 2점 차  /  24-24부터 2점 차
 *   · 최대 30점: 29-29에서 30점을 먼저 가져간 쪽이 이깁니다(2점 차 없이 끝)
 *
 * 저장은 기존 일지 칸 그대로입니다(게임점수 한 칸에 "21:18, 19:21",
 * 25점제는 앞에 "25점제"). 새 시트 칸을 만들지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};

  var MODES = [21, 25];
  var CAP = 30;
  var TYPES = ['단식', '복식'];
  var MAX_UNDO = 60;

  function normalMode(m) { return Number(m) === 25 ? 25 : 21; }
  function normalType(t) { return String(t) === '단식' ? '단식' : '복식'; }

  /* 새 점수판 — 0:0에서 시작, 아직 끝난 세트 없음 */
  function create(opts) {
    opts = opts || {};
    return {
      mode: normalMode(opts.mode),
      type: normalType(opts.type),
      a: 0,
      b: 0,
      over: '',        /* '' | 'a' | 'b' — 지금 세트가 끝났는지 */
      sets: [],        /* 끝난 세트들 [{a, b}] */
      history: []      /* 되돌리기용 점수 기록 */
    };
  }

  function copy(st) {
    st = st || create();
    return {
      mode: normalMode(st.mode),
      type: normalType(st.type),
      a: Number(st.a) || 0,
      b: Number(st.b) || 0,
      over: st.over === 'a' || st.over === 'b' ? st.over : '',
      sets: (st.sets || []).map(function (s) { return { a: Number(s.a) || 0, b: Number(s.b) || 0 }; }),
      history: (st.history || []).slice(-MAX_UNDO)
    };
  }

  function target(st) { return normalMode(st && st.mode); }

  /* 지금 세트의 승자 — 아직 안 끝났으면 '' */
  function winner(st) {
    if (!st) return '';
    var t = target(st), a = Number(st.a) || 0, b = Number(st.b) || 0;
    if (a >= CAP && a > b) return 'a';
    if (b >= CAP && b > a) return 'b';
    if (a >= t && a - b >= 2) return 'a';
    if (b >= t && b - a >= 2) return 'b';
    return '';
  }

  /* 듀스 — 20-20(25점제는 24-24)부터 2점 차가 필요합니다 */
  function deuce(st) {
    if (!st) return false;
    var t = target(st);
    return (Number(st.a) || 0) >= t - 1 && (Number(st.b) || 0) >= t - 1;
  }

  /* 세트 포인트 — 한 점이면 세트가 끝나는 쪽이 있는지 */
  function matchPoint(st) {
    if (!st || winner(st)) return false;
    var t = target(st), a = Number(st.a) || 0, b = Number(st.b) || 0;
    var need = deuce(st) ? Math.max(a, b) + 1 : t;
    return (a >= need - 1 && a - b >= 1) || (b >= need - 1 && b - a >= 1);
  }

  function snapshot(st) {
    return {
      a: st.a, b: st.b, over: st.over,
      sets: st.sets.map(function (s) { return { a: s.a, b: s.b }; })
    };
  }

  /* 한 점 — side는 'a'(내 팀) 또는 'b'(상대 팀). 원래 상태는 그대로 둡니다. */
  function point(st, side) {
    var next = copy(st);
    if (next.over) return next;                  /* 세트가 끝났으면 더 안 쌓입니다 */
    next.history.push(snapshot(next));
    if (next.history.length > MAX_UNDO) next.history.shift();
    if (side === 'b') next.b += 1; else next.a += 1;
    next.over = winner(next);
    return next;
  }

  /* 되돌리기 — 직전 점수로 (세트가 끝난 순간이면 다시 이어 칠 수 있게) */
  function undo(st) {
    var next = copy(st);
    if (!next.history.length) return next;
    var snap = next.history.pop();
    next.a = snap.a;
    next.b = snap.b;
    next.over = snap.over;
    next.sets = (snap.sets || []).map(function (s) { return { a: s.a, b: s.b }; });
    return next;
  }

  /* 다음 세트 — 끝난 세트를 쌓아 두고 0:0으로 */
  function nextSet(st) {
    var next = copy(st);
    if (!next.over) return next;
    next.history.push(snapshot(next));
    if (next.history.length > MAX_UNDO) next.history.shift();
    next.sets.push({ a: next.a, b: next.b });
    next.a = 0;
    next.b = 0;
    next.over = '';
    return next;
  }

  /* 일지에 넣을 경기들 — 끝난 세트만 (진행 중인 0:0은 넣지 않습니다) */
  function games(st) {
    st = st || {};
    var out = (st.sets || []).map(function (s) { return { a: Number(s.a) || 0, b: Number(s.b) || 0 }; });
    if (st.over === 'a' || st.over === 'b') out.push({ a: Number(st.a) || 0, b: Number(st.b) || 0 });
    return out;
  }

  function scoreText(g) { return (g.a) + ':' + (g.b); }

  /* 경기 요약 — 승/패는 내 팀(a) 기준 */
  function summary(st) {
    var list = games(st);
    var wins = 0, losses = 0, draws = 0;
    list.forEach(function (g) {
      if (g.a > g.b) wins++;
      else if (g.a < g.b) losses++;
      else draws++;
    });
    return {
      count: list.length,
      wins: wins,
      losses: losses,
      draws: draws,
      result: !list.length ? '' : wins > losses ? '승' : losses > wins ? '패' : '무',
      text: list.map(scoreText).join(', ')
    };
  }

  function memoText(st, sum) {
    sum = sum || summary(st);
    return '코트 점수판 · ' + normalType(st.type) + ' ' + target(st) + '점제 ' + sum.text +
      ' (' + sum.wins + '승 ' + sum.losses + '패' + (sum.draws ? ' ' + sum.draws + '무' : '') + ')';
  }

  /* 일지 입력칸에 넣을 값 — 종목(게임)·점수·한 줄 메모를 한 번에 채웁니다.
   * 이미 쓴 메모와 완료 훈련은 지우지 않고 그대로 둡니다. */
  function draftPatch(st, draft) {
    var list = games(st);
    if (!list.length) return null;
    var sum = summary(st);
    draft = draft || {};
    var done = (draft.done || []).slice();
    if (done.indexOf('게임') < 0) done.push('게임');
    return {
      gameMode: target(st),
      games: list,
      result: sum.result,
      done: done,
      note: (draft.note && String(draft.note).trim()) ? draft.note : memoText(st, sum)
    };
  }

  /* 점수판 위 문구 — 지금 무엇이 걸려 있는지 한 줄로 */
  function stateText(st) {
    var w = winner(st);
    var t = target(st);
    if (w) return { kind: 'over', text: '세트 종료 · ' + scoreText(st) + (w === 'a' ? ' 승' : ' 패') };
    if (deuce(st)) return { kind: 'deuce', text: '듀스 · 2점 차로 이겨야 끝나요' };
    if (matchPoint(st)) return { kind: 'point', text: '세트 포인트' };
    return { kind: 'rule', text: t + '점제 · 2점 차 · 최대 ' + CAP + '점' };
  }

  BM.scoreboard = {
    MODES: MODES, TYPES: TYPES, CAP: CAP,
    create: create, copy: copy, target: target, normalMode: normalMode, normalType: normalType,
    winner: winner, deuce: deuce, matchPoint: matchPoint,
    point: point, undo: undo, nextSet: nextSet,
    games: games, scoreText: scoreText, summary: summary, memoText: memoText,
    draftPatch: draftPatch, stateText: stateText
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
