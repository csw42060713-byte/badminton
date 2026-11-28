/* ============================================================
 * js/report.js — 주간 / 월간 상세 리포트 (bm-v1.41.1)
 *
 *  사용자가 고른 3번째 기능 — 일지 & AI · MY에서 한 번 눌러 여는 리포트.
 *   · 주간 = 최근 7일 vs 직전 7일 / 월간 = 이번 달 vs 지난달
 *   · state.data.records(내 일지)만 셉니다. 새 시트 칸·새 DB 컬럼 없이 계산만 합니다.
 *   · 1) 운동량·승률(전체 + 접전 3점차) 변화
 *     2) 가장 자주 뜬 약점 TOP 3 (빈도 · 비중 막대 · 지난 기간 대비 증감)
 *     3) 반복된 통증 부위 + 주의 안내
 *     4) 다음 주 / 다음 달 맞춤 훈련 방향 2~3줄
 *   · AI 문구는 화면에 그대로 나가는 쉬운 코트 말투입니다
 *     (전문용어·논문 수치는 여기에 쓰지 않습니다).
 *   · 같은 입력이면 같은 결과(순수 함수). opts.now로 날짜를 고정할 수 있습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util, D = BM.domain;
  var UI = BM.ui;
  var hasDom = typeof document !== 'undefined' && !!document.createElement;

  var CLOSE_MARGIN = 3;      /* 접전 기준 — 3점차 이내 */
  var TOP_N = 3;             /* 약점 TOP 3 */
  var WEEK_DAYS = 7;

  /* 통증 부위별 한 줄 관리 (쉬운 말 · 화면에 그대로) */
  var PAIN_TIP = {
    '목': '고개 숙인 자세를 줄이고, 턱 당기기를 하루 두 번 해 보세요.',
    '어깨': '스매시·클리어 개수를 절반으로 줄이고 어깨 뒤쪽 풀기를 먼저 하세요.',
    '허리': '셔틀 주울 때 무릎을 굽히고, 허리를 젖히는 동작은 줄여 보세요.',
    '팔꿈치': '그립 힘을 빼고 손목을 천천히 내리는 운동을 주 3번 해 보세요.',
    '무릎': '점프·계단·깊은 런지 수를 줄이고 무릎 주변 근육부터 강화해 보세요.',
    '손목': '손목 스냅을 줄이고, 아플 때는 테이핑부터 해 보세요.',
    '아킬레스건': '점프·급정지 수를 줄이고 운동 전 종아리 워밍업 10분을 꼭 챙기세요.',
    '발목': '발목 돌리기로 풀고, 한 발 착지로 버티는 연습부터 해 보세요.'
  };

  /* 통증 부위별 '다음 주'에 할 일 — 위 주의 상자(PAIN_TIP)와 같은 말을 반복하지 않도록
   * 방향 줄에서는 다음 주 계획 쪽으로 한 번만 말합니다. */
  var PAIN_NEXT = {
    '목': '목은 다음 주에 하루 쉬는 날을 먼저 넣고, 스매시 연습 뒤 목 스트레칭을 붙여 보세요.',
    '어깨': '어깨는 다음 주에 머리 위로 치는 훈련을 하루만 넣고, 나머지 날은 뒤쪽 근육 강화로 채워 보세요.',
    '허리': '허리는 다음 주에 무게 훈련을 하루 줄이고, 코트 들어가기 전 코어 5분을 먼저 챙겨 보세요.',
    '팔꿈치': '팔꿈치는 다음 주에 스매시 개수를 절반으로 두고, 손목 천천히 내리기를 주 3번 넣어 보세요.',
    '무릎': '무릎은 다음 주에 점프·계단 훈련을 하루 빼고, 회복 날에 무릎 주변 근육을 채워 보세요.',
    '손목': '손목은 다음 주에 스냅을 쓰는 샷을 줄이고, 그립 두께부터 한 번 확인해 보세요.',
    '아킬레스건': '아킬레스건은 다음 주에 점프·급정지를 줄이고, 운동 전 종아리 워밍업을 10분 꼭 넣어 보세요.',
    '발목': '발목은 다음 주에 한 발 착지 버티기를 매일 5분씩 넣고, 테이핑부터 챙겨 보세요.'
  };

  /* ---------- 날짜 ---------- */
  function dateOf(v) {
    if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    var p = U.parseYmd(v || '');
    if (p) return p;
    var t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }

  function shortOf(key) {
    var d = U.parseYmd(key);
    return d ? (d.getMonth() + 1) + '월 ' + d.getDate() + '일' : String(key || '');
  }

  function monthOf(key) {
    var d = U.parseYmd(key);
    return d ? d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월' : String(key || '');
  }

  /* 기간 창 — 주간은 최근 7일/직전 7일, 월간은 이번 달/지난달 */
  function period(mode, now) {
    var today = dateOf(now);
    if (mode === 'month') {
      var from = new Date(today.getFullYear(), today.getMonth(), 1);
      var prevTo = new Date(today.getFullYear(), today.getMonth(), 0);
      var prevFrom = new Date(prevTo.getFullYear(), prevTo.getMonth(), 1);
      return {
        mode: 'month', days: today.getDate(),
        from: U.ymd(from), to: U.ymd(today),
        prevFrom: U.ymd(prevFrom), prevTo: U.ymd(prevTo)
      };
    }
    return {
      mode: 'week', days: WEEK_DAYS,
      from: U.ymd(U.addDays(today, -(WEEK_DAYS - 1))), to: U.ymd(today),
      prevFrom: U.ymd(U.addDays(today, -(WEEK_DAYS * 2 - 1))), prevTo: U.ymd(U.addDays(today, -WEEK_DAYS))
    };
  }

  /* ---------- 한 기간의 숫자 ---------- */
  /* 한 일지에 남긴 게임들 — 여러 경기(games)가 있으면 그것, 없으면 한 경기(score) */
  function gamesOf(r) {
    if (!r) return [];
    var list = (r.games && r.games.length) ? r.games : (r.score ? [r.score] : []);
    var out = [];
    (list || []).forEach(function (g) {
      if (!g) return;
      var a = Number(g.a), b = Number(g.b);
      if (!isFinite(a) || !isFinite(b)) return;
      out.push({ a: a, b: b });
    });
    return out;
  }

  function aggregate(records, from, to) {
    var acc = {
      sessions: 0, minutes: 0, days: [],
      games: 0, wins: 0, losses: 0, draws: 0, rate: null,
      close: { games: 0, wins: 0, losses: 0, rate: null },
      weak: {}, weakTotal: 0,
      pain: {}, painTotal: 0
    };
    (records || []).forEach(function (r) {
      if (!r) return;
      var key = D.dayKey(r.date);
      if (!key || key < from || key > to) return;
      acc.sessions++;
      acc.minutes += U.num(r.minutes, 0) || 0;
      if (acc.days.indexOf(key) < 0) acc.days.push(key);

      gamesOf(r).forEach(function (g) {
        var res = D.resultFromScore(g);
        acc.games++;
        if (res === '무') { acc.draws++; }
        else if (res === '승') acc.wins++;
        else acc.losses++;
        if (res !== '무' && Math.abs(g.a - g.b) <= CLOSE_MARGIN) {
          acc.close.games++;
          if (res === '승') acc.close.wins++;
          else acc.close.losses++;
        }
      });

      var seenW = {};
      (r.weakness || []).forEach(function (w) {
        var name = String(w == null ? '' : w).trim();
        if (!name || seenW[name]) return;
        seenW[name] = 1;
        acc.weak[name] = (acc.weak[name] || 0) + 1;
        acc.weakTotal++;
      });
      var seenP = {};
      (r.pain || []).forEach(function (p) {
        var name = String(p == null ? '' : p).trim();
        if (!name || seenP[name]) return;
        seenP[name] = 1;
        acc.pain[name] = (acc.pain[name] || 0) + 1;
        acc.painTotal++;
      });
    });
    acc.rate = (acc.wins + acc.losses) ? Math.round((acc.wins / (acc.wins + acc.losses)) * 100) : null;
    acc.close.rate = (acc.close.wins + acc.close.losses)
      ? Math.round((acc.close.wins / (acc.close.wins + acc.close.losses)) * 100) : null;
    return acc;
  }

  /* 이름별 횟수 → 많은 순 · 동률이면 사전(VOCAB) 순서 (항상 같은 결과) */
  function rank(map, vocab) {
    var order = {};
    (vocab || []).forEach(function (n, i) { order[n] = i; });
    return Object.keys(map).map(function (name) {
      return { name: name, n: map[name] };
    }).sort(function (a, b) {
      if (b.n !== a.n) return b.n - a.n;
      var oa = order[a.name] == null ? 99 : order[a.name];
      var ob = order[b.name] == null ? 99 : order[b.name];
      return oa - ob || (a.name < b.name ? -1 : 1);
    });
  }

  /* ---------- 리포트 계산 ----------
   * build(records, { mode:'week'|'month', now, role, level }) */
  function build(records, opts) {
    opts = opts || {};
    var mode = opts.mode === 'month' ? 'month' : 'week';
    var w = period(mode, opts.now);
    var cur = aggregate(records, w.from, w.to);
    var prev = aggregate(records, w.prevFrom, w.prevTo);

    var weakTop = rank(cur.weak, D.VOCAB.weakness).slice(0, TOP_N).map(function (it) {
      var before = prev.weak[it.name] || 0;
      return {
        name: it.name, n: it.n,
        share: cur.weakTotal ? Math.round((it.n / cur.weakTotal) * 100) : 0,
        prev: before, diff: it.n - before
      };
    });
    var pains = rank(cur.pain, D.VOCAB.pain).map(function (it) {
      return { name: it.name, n: it.n, prev: prev.pain[it.name] || 0 };
    });

    var out = {
      mode: mode,
      modeLabel: mode === 'month' ? '월간' : '주간',
      periodLabel: mode === 'month' ? '이번 달' : '이번 주',
      prevPeriodLabel: mode === 'month' ? '지난달' : '지난주',
      nextLabel: mode === 'month' ? '다음 달' : '다음 주',
      from: w.from, to: w.to, days: w.days,
      prevFrom: w.prevFrom, prevTo: w.prevTo,
      rangeText: mode === 'month'
        ? monthOf(w.from) + ' ' + (+w.from.slice(8, 10)) + '일 ~ ' + shortOf(w.to)
        : shortOf(w.from) + ' ~ ' + shortOf(w.to) + ' (' + w.days + '일)',
      compareText: mode === 'month'
        ? '지난달(' + monthOf(w.prevFrom) + ')과 비교했어요'
        : '지난 7일(' + shortOf(w.prevFrom) + ' ~ ' + shortOf(w.prevTo) + ')과 비교했어요',
      current: cur, prev: prev,
      volumeDiff: cur.sessions - prev.sessions,
      minutesDiff: cur.minutes - prev.minutes,
      rateDiff: (cur.rate != null && prev.rate != null) ? cur.rate - prev.rate : null,
      closeDiff: (cur.close.rate != null && prev.close.rate != null) ? cur.close.rate - prev.close.rate : null,
      weaknesses: weakTop,
      pains: pains,
      repeatedPains: pains.filter(function (p) { return p.n >= 2; }),
      role: opts.role || '',
      level: opts.level || '',
      empty: cur.sessions === 0
    };
    out.direction = out.empty ? [] : direction(out);
    return out;
  }

  /* ---------- 쉬운 말 조사 ---------- */
  function hasJong(s) {
    var str = String(s == null ? '' : s);
    if (!str) return false;
    var c = str.charCodeAt(str.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return false;
    return (c - 0xac00) % 28 !== 0;
  }
  function iga(s) { return s + (hasJong(s) ? '이' : '가'); }

  /* 약점 → 바로 해 볼 드릴 한 줄 (초보자 가이드가 있으면 그 문장) */
  function drillLine(name) {
    var d = (BM.beginner && BM.beginner.drillForSkill) ? BM.beginner.drillForSkill(name) : null;
    if (d && d.name) return d.name + ' 드릴 ' + d.sets + '부터 — ' + d.point;
    return name + ' 기본 동작을 짧게 여러 번 나눠서 해 보세요.';
  }

  function proItemFor(weak) {
    if (weak === '풋워크') return '풋워크';
    if (weak === '스매시') return '스매시';
    return '스트록';
  }

  /* 유형(초보·동호인·선수·코치)에 맞춘 다음 한 걸음
   * 아픈 부위가 있으면 '풋워크 드릴 10분' 같은 훈련 권유 대신 회복 안내 (bm-v1.72.0) */
  function roleLine(role, weak, hasPain) {
    var w = weak || '';
    if (hasPain) {
      if (role === 'player') return '아픈 부위가 가라앉을 때까지는 7대 훈련 중 회복·유연성 항목만 챙기고 드릴은 쉬어 가세요.';
      if (role === 'coach') return '아픈 부위를 말한 선수는 그 부위 드릴을 빼고 회복 위주로 피드백해 주세요.';
      if (role === 'beginner') return '4주 루틴은 아픈 부위가 편해진 뒤에 이어 가고, 오늘은 가벼운 스트레칭만 해 보세요.';
      return '아픈 부위가 편해질 때까지는 드릴 대신 가벼운 몸풀기와 스트레칭으로 시작해 보세요.';
    }
    if (role === 'player') {
      return w
        ? '선수 루틴은 그대로 두고, 7대 훈련의 ' + proItemFor(w) + ' 세트만 하나 더 가져가 보세요.'
        : '선수 루틴은 그대로 두고, 7대 훈련에서 가장 적게 한 항목 세트를 하나 더 가져가 보세요.';
    }
    if (role === 'coach') {
      return w
        ? '코치 유형이니 선수 일지에서 ' + iga(w) + ' 반복되는지 묶어서 한 번에 피드백해 주세요.'
        : '코치 유형이니 선수 일지에서 같은 약점이 반복되는지 묶어서 피드백해 주세요.';
    }
    if (role === 'beginner') {
      return w
        ? '4주 루틴 순서대로 하고, ' + w + ' 연습은 5분만 먼저 넣어 보세요.'
        : '4주 루틴 순서대로 하고, 오늘 배운 동작 하나만 5분 더 해 보세요.';
    }
    return w
      ? '게임에 들어가기 전에 ' + w + ' 드릴 10분을 먼저 하고 치면 훨씬 편해요.'
      : '게임에 들어가기 전에 10분 몸풀기와 기본 스트록을 먼저 하면 실수가 줄어요.';
  }

  /* 다음 주/달 맞춤 방향 — 2~3줄 */
  function direction(r) {
    var c = r.current;
    var out = [];
    var top = r.weaknesses[0];

    /* 1) 가장 자주 나온 약점 + 바로 할 드릴 */
    if (top) {
      out.push(iga(top.name) + ' ' + r.periodLabel + ' ' + top.n + '번 나왔어요. ' + drillLine(top.name));
    } else if (c.sessions) {
      out.push('일지는 ' + c.sessions + '번 남겼어요. 다음에는 약점 기술을 한 칸 같이 남기면 다음 훈련을 더 또렷하게 골라 드릴 수 있어요.');
    }

    /* 2) 통증이 먼저, 없으면 접전·승률 */
    var rep = r.repeatedPains[0];
    if (rep) {
      out.push(PAIN_NEXT[rep.name] || (iga(rep.name) + ' ' + r.periodLabel + ' ' + rep.n + '번 나왔어요. 다음에는 강도를 한 단계 낮춰 보세요.'));
    } else if (c.close.games) {
      /* 지난 기간보다 접전 승률이 떨어졌는데도 칭찬하던 모순 수정 (bm-v1.72.0)
       * — 2026-11-24 18시 점검: "-33%p 낮아요. 지금처럼 마지막까지 집중하는 게 잘 되고 있어요." */
      var closeDropped = r.closeDiff != null && r.closeDiff <= -5;
      var closeRose = r.closeDiff != null && r.closeDiff >= 5;
      var closeLow = c.close.rate != null && c.close.rate < 50;
      var tail = (closeDropped || closeLow)
        ? '. 마지막 3점은 서브를 낮게, 첫 공은 안전하게 가 보세요.'
        : closeRose
          ? '. 지난 기간보다 접전을 잘 잡고 있어요 — 이 흐름을 이어 가세요.'
          : '. 지금처럼 마지막까지 집중하는 게 잘 되고 있어요.';
      var diffTxt = r.closeDiff == null ? ''
        : ' (' + r.prevPeriodLabel + '보다 ' + Math.abs(r.closeDiff) + '포인트 ' +
          (r.closeDiff > 0 ? '높아요' : r.closeDiff < 0 ? '낮아요' : '그대로예요') + ')';
      out.push('접전(3점차 이내) ' + c.close.games + '경기에서 ' + c.close.wins + '승 ' + c.close.losses + '패' + diffTxt + tail);
    } else if (c.games) {
      out.push('경기 ' + c.games + '경기 ' + (c.rate == null ? '무승부만 있었어요' : '승률 ' + c.rate + '%') +
        '. 다음에 3점차 이내 접전이 나오면 그때 쓴 서브와 첫 공을 한 줄 적어 보세요.');
    } else if (c.sessions) {
      out.push('훈련은 ' + c.sessions + '번 · ' + c.minutes + '분이에요. 게임 점수를 같이 남기면 승률과 접전 승률도 볼 수 있어요.');
    }

    /* 3) 유형 맞춤 한 줄 — 이번 기간에 아픈 부위가 있으면 회복 안내로 */
    out.push(roleLine(r.role, top ? top.name : '', !!(rep || (r.pains && r.pains.length))));
    return out.slice(0, 3);
  }

  /* ---------- 화면(HTML) ---------- */
  /* 비교 배지 — 값이 없을 때 왜 비교가 안 되는지까지 적습니다 (bm-v1.100.0)
   *  · 지난 기간엔 경기가 있는데 이번 기간 경기가 0건이면 '첫 기간'이 아니라 '이번 주 경기 없음'
   *  · 반대로 이번엔 있는데 지난 기간이 없으면 '지난주 경기 없음'
   *  · 두 기간 모두 경기가 없을 때만 예전처럼 '첫 기간' */
  function deltaHtml(n, unit, noneText) {
    if (n == null) {
      if (noneText) return '<i class="rpt__d is-flat">' + U.esc(noneText) + '</i>';
      return '<i class="rpt__d is-first">첫 기간</i>';
    }
    if (!n) return '<i class="rpt__d is-flat">변화 없음</i>';
    return '<i class="rpt__d ' + (n > 0 ? 'up' : 'down') + '">' + (n > 0 ? '+' : '') + n + U.esc(unit) + '</i>';
  }

  /* 승률·접전 승률 변화 배지 — 비교할 쪽이 비었으면 그 기간 이름으로 알려 줌 */
  function rateDeltaHtml(curRate, prevRate, r, unit, kind) {
    var curNone = (kind === 'close' && r.current.games) ? '접전 없음' : '경기 없음';
    var prevNone = (kind === 'close' && r.prev.games) ? '접전 없음' : '경기 없음';
    if (curRate == null) {
      return deltaHtml(null, unit, r.prev.sessions ? r.periodLabel + ' ' + curNone : '');
    }
    if (prevRate == null) {
      return deltaHtml(null, unit, r.prev.sessions ? r.prevPeriodLabel + ' ' + prevNone : '');
    }
    return deltaHtml(curRate - prevRate, unit);
  }

  function statCell(value, label, delta) {
    return '<div class="rpt__stat"><strong>' + U.esc(value) + '</strong><span>' + U.esc(label) + '</span>' + delta + '</div>';
  }

  function gamesNote(c) {
    if (!c.games) return '경기 점수를 남기면 승률과 접전 승률이 같이 나와요.';
    var bits = ['전체 ' + c.games + '경기 ' + c.wins + '승 ' + c.losses + '패'];
    if (c.draws) bits[0] += ' ' + c.draws + '무';
    if (c.close.games) bits.push('접전(3점차 이내) ' + c.close.games + '경기 ' + c.close.wins + '승 ' + c.close.losses + '패');
    else bits.push('3점차 이내 접전은 아직 없었어요');
    return bits.join(' · ');
  }

  function volumeHtml(r) {
    var c = r.current;
    return '<section class="rpt__sec" data-rpt-sec="volume">' +
      '<h3 class="rpt__h">운동량 &amp; 승률 <small>' + U.esc(r.prevPeriodLabel) + ' 대비</small></h3>' +
      '<div class="rpt__stats">' +
      statCell(c.sessions + '회', '훈련', deltaHtml(r.volumeDiff, '회')) +
      statCell(c.minutes + '분', '운동 시간', deltaHtml(r.minutesDiff, '분')) +
      statCell(c.rate == null ? '—' : c.rate + '%', '전체 승률', rateDeltaHtml(c.rate, r.prev.rate, r, '%p', 'rate')) +
      statCell(c.close.rate == null ? '—' : c.close.rate + '%', '접전 승률', rateDeltaHtml(c.close.rate, r.prev.close.rate, r, '%p', 'close')) +
      '</div>' +
      '<p class="rpt__note">' + U.esc(gamesNote(c)) + '</p>' +
      '</section>';
  }

  function weakDiff(it, r) {
    if (!r.prev.sessions) return r.prevPeriodLabel + ' 일지가 없어 비교하지 못했어요';
    if (!it.prev) return r.prevPeriodLabel + '엔 없던 약점이에요';
    if (it.diff < 0) return r.prevPeriodLabel + '보다 ' + Math.abs(it.diff) + '회 줄었어요';
    if (it.diff > 0) return r.prevPeriodLabel + '보다 ' + it.diff + '회 늘었어요';
    return r.prevPeriodLabel + '와 같아요';
  }

  function weakHtml(r) {
    var head = '<h3 class="rpt__h">가장 자주 뜬 약점 <small>TOP ' + TOP_N + '</small></h3>';
    if (!r.weaknesses.length) {
      return '<section class="rpt__sec" data-rpt-sec="weak">' + head +
        '<p class="rpt__none">약점 기술을 한 칸 남기면 여기에 자주 나온 기술부터 채워져요. 일지의 <b>약점 기술</b>에서 오늘 아쉬웠던 것 하나만 골라도 돼요.</p>' +
        '</section>';
    }
    return '<section class="rpt__sec" data-rpt-sec="weak">' + head +
      '<ul class="rpt__bars">' + r.weaknesses.map(function (it) {
        var w = Math.max(4, Math.min(100, it.share));
        return '<li class="rpt__barrow" data-rpt-weak="' + U.esc(it.name) + '">' +
          '<div class="rpt__bar-top"><b>' + U.esc(it.name) + '</b><span>' + it.n + '회 · ' + it.share + '%</span></div>' +
          '<div class="rpt__bar"><i style="--w:' + w + '%"></i></div>' +
          '<p class="rpt__bar-d">' + U.esc(weakDiff(it, r)) + '</p></li>';
      }).join('') + '</ul></section>';
  }

  function painWarn(r) {
    var rep = r.repeatedPains[0];
    if (!rep) return '';
    var when = r.mode === 'month' ? '이번 달에' : '이번 주에';
    var tail = r.mode === 'month'
      ? ' 이렇게 반복되면 코트를 하루 쉬고 병원에서 한 번 봐 주세요.'
      : ' 2주 넘게 이어지면 코트를 하루 쉬고 병원에서 한 번 봐 주세요.';
    return '<div class="rpt__warn" data-rpt-warn="' + U.esc(rep.name) + '"><b>주의</b>' +
      '<p>' + U.esc(iga(rep.name)) + ' ' + when + ' ' + rep.n + '번 나왔어요.' + U.esc(tail) + '</p>' +
      (PAIN_TIP[rep.name] ? '<p class="rpt__warn-s">' + U.esc(PAIN_TIP[rep.name]) + '</p>' : '') +
      '</div>';
  }

  function painHtml(r) {
    var head = '<h3 class="rpt__h">반복된 통증 부위 <small>' + U.esc(r.periodLabel) + '</small></h3>';
    if (!r.pains.length) {
      return '<section class="rpt__sec" data-rpt-sec="pain">' + head +
        '<p class="rpt__none">' + U.esc(r.periodLabel) + '에는 아픈 부위가 없었어요. 좋아요.</p></section>';
    }
    return '<section class="rpt__sec" data-rpt-sec="pain">' + head +
      '<div class="rpt__chips">' + r.pains.map(function (p) {
        return '<span class="rpt__chip' + (p.n >= 2 ? ' is-warn' : '') + '">' + U.esc(p.name) +
          ' <b>' + p.n + '번</b></span>';
      }).join('') + '</div>' + painWarn(r) + '</section>';
  }

  function nextHtml(r) {
    return '<section class="rpt__sec" data-rpt-sec="next">' +
      '<h3 class="rpt__h">' + U.esc(r.nextLabel) + '에 이렇게 <small>맞춤 방향</small></h3>' +
      '<ol class="rpt__next">' + r.direction.map(function (line) {
        return '<li>' + U.esc(line) + '</li>';
      }).join('') + '</ol></section>';
  }

  function emptyHtml(r) {
    var sub = r.prev.sessions
      ? r.prevPeriodLabel + '에는 일지 ' + r.prev.sessions + '건을 남겼어요. 이번엔 아직 비어 있어요.'
      : '오늘 일지를 저장하면 운동량 · 승률 · 약점이 한 번에 정리돼요.';
    var act = '<button type="button" class="btn btn--primary mt12" data-rpt-go-log="1">일지 쓰러 가기</button>';
    return '<div class="rpt__empty" data-rpt-empty="1">' +
      UI.emptyState('chart', '일지를 1건 이상 남기면 리포트가 채워져요', sub, act) +
      '</div>';
  }

  function bodyHtml(r) {
    if (!r) return '';
    if (r.empty) return emptyHtml(r);
    return '<p class="rpt__range"><b>' + U.esc(r.rangeText) + '</b><span>' + U.esc(r.compareText) + '</span></p>' +
      volumeHtml(r) + weakHtml(r) + painHtml(r) + nextHtml(r) +
      '<p class="rpt__foot">일지에 남긴 기록만 세었어요. 같은 기간이면 언제 열어도 같은 숫자가 나와요.</p>';
  }

  /* 일지 & AI · MY에 놓는 입구 한 줄 */
  function entryHtml() {
    return '<button type="button" class="rptbtn" data-act="open-report" aria-haspopup="dialog">' +
      '<span class="rptbtn__t">📊 주간·월간 상세 리포트 보기' +
      '<small>이번 주 vs 지난 주 · 승률 · 약점 · 통증 · 다음 방향</small></span>' +
      UI.icon('arrow', 'rptbtn__car') + '</button>';
  }

  /* ---------- 전체화면 패널 (DOM) ---------- */
  var panelEl = null;
  var panel = { mode: 'week', data: null, onGoLog: null };

  function shellHtml() {
    return '' +
      '<div class="bgp__backdrop" data-rpt-close="1"></div>' +
      '<div class="bgp__panel" role="dialog" aria-modal="true" aria-label="주간·월간 상세 리포트">' +
      '<div class="bgp__head"><h2>📊 주간·월간 상세 리포트</h2>' +
      '<button type="button" class="iconbtn" data-rpt-close="1" aria-label="닫기">' + UI.icon('close') + '</button></div>' +
      '<div class="bgp__tabs" role="tablist" aria-label="리포트 기간">' +
      '<button type="button" class="bgp__tab" role="tab" data-rpt-tab="week" aria-selected="false">주간</button>' +
      '<button type="button" class="bgp__tab" role="tab" data-rpt-tab="month" aria-selected="false">월간</button>' +
      '</div>' +
      '<div class="bgp__body rpt" data-rpt-body></div>' +
      '</div>';
  }

  function paint() {
    if (!panelEl || !panel.data) return;
    var body = panelEl.querySelector('[data-rpt-body]');
    var r = build(panel.data.records, {
      mode: panel.mode, now: panel.data.now, role: panel.data.role, level: panel.data.level
    });
    if (body) {
      body.setAttribute('data-rpt-mode', r.mode);
      body.innerHTML = bodyHtml(r);
      body.scrollTop = 0;
    }
    Array.prototype.forEach.call(panelEl.querySelectorAll('[data-rpt-tab]'), function (b) {
      var on = b.getAttribute('data-rpt-tab') === panel.mode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function close() {
    if (!hasDom || !panelEl) return;
    var node = panelEl;
    panelEl = null;
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    node.classList.remove('is-on');
    if (document.body) document.body.classList.remove('no-scroll');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
  }

  /* 뒤로 가기: 패널만 닫고 앱은 나가지 않습니다 */
  function onPop() {
    if (!panelEl) return;
    panelEl = null;
    var node = document.getElementById('reportPanel');
    if (node) {
      node.classList.remove('is-on');
      if (document.body) document.body.classList.remove('no-scroll');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }
    if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('popstate', onPop);
    if (BM.ui && BM.ui.overlay) BM.ui.overlay.close();
  }

  function onClick(ev) {
    if (ev.target.closest('[data-rpt-close]')) {
      ev.preventDefault();
      close();
      return;
    }
    var tab = ev.target.closest('[data-rpt-tab]');
    if (tab) {
      ev.preventDefault();
      var next = tab.getAttribute('data-rpt-tab') === 'month' ? 'month' : 'week';
      if (next === panel.mode) return;
      panel.mode = next;
      paint();
      if (BM.ui && BM.ui.haptic) BM.ui.haptic(6);
      return;
    }
    if (ev.target.closest('[data-rpt-go-log]')) {
      ev.preventDefault();
      var go = panel.onGoLog;
      close();
      if (typeof go === 'function') go();
    }
  }

  function open(opts) {
    if (!hasDom) return null;
    opts = opts || {};
    panel.mode = opts.mode === 'month' ? 'month' : 'week';
    panel.data = {
      records: opts.records || [],
      role: opts.role || '',
      level: opts.level || '',
      now: opts.now || null
    };
    panel.onGoLog = typeof opts.onGoLog === 'function' ? opts.onGoLog : null;
    if (!panelEl) {
      var node = document.createElement('div');
      node.id = 'reportPanel';
      node.className = 'bgp rptp';
      node.innerHTML = shellHtml();
      document.body.appendChild(node);
      document.body.classList.add('no-scroll');
      panelEl = node;
      node.addEventListener('click', onClick);
      if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('popstate', onPop);
      if (BM.ui && BM.ui.overlay) BM.ui.overlay.open();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { node.classList.add('is-on'); });
      else node.classList.add('is-on');
    }
    paint();
    return panelEl;
  }

  /* 화면 쪽에서 한 줄로 여는 길 — ctx만 넘기면 됩니다 */
  function openFrom(ctx, mode) {
    var st = (ctx && ctx.store && ctx.store.state) || {};
    return open({
      mode: mode || 'week',
      records: (st.data && st.data.records) || [],
      role: D.roleOf(st.me || {}),
      level: (st.me && st.me.level) || '',
      onGoLog: function () {
        if (ctx && ctx.actions && ctx.actions.setTab) ctx.actions.setTab('log');
      }
    });
  }

  BM.report = {
    build: build, period: period, aggregate: aggregate, direction: direction,
    bodyHtml: bodyHtml, entryHtml: entryHtml, shellHtml: shellHtml,
    open: open, openFrom: openFrom, close: close,
    isOpen: function () { return !!panelEl; },
    PAIN_TIP: PAIN_TIP, PAIN_NEXT: PAIN_NEXT, CLOSE_MARGIN: CLOSE_MARGIN, TOP_N: TOP_N
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
