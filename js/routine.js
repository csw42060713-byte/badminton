/* ============================================================
 * routine.js — 초보자 배드민턴 4주 루틴 (체크리스트)
 *
 *  조환비(@chohwanbi7) 님이 제안하고 승우 님이 "서서 하는 헤어핀 · 서서 하는 언더"를
 *  더한 4주 루틴을, 라켓을 처음 잡는 사람도 바로 따라 할 수 있는 말로 풀었습니다.
 *
 *  · 주 2~3회 · 하루 20~30분 (1주차는 15분이면 충분)
 *  · 전문 용어는 쉬운 말로 풀거나 괄호로 설명을 붙입니다.
 *  · 항목마다 '이렇게 해요'(방법)와 '감 잡는 포인트'(한 줄)가 있습니다.
 *  · 체크 상태는 기기에 저장합니다(계정마다 따로). 시트 26칸은 건드리지 않습니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var TITLE = '초보자 배드민턴 4주 루틴';
  var SUB = '라켓을 처음 잡아도 괜찮아요 · 주 2~3회 · 하루 20~30분';
  var GUARD = '처음 2주는 숨이 살짝 찰 정도로만. 통증이 생기면 그날은 쉬어요.';

  var WEEKS = [
    {
      no: 1,
      name: '그립과 기본 자세',
      goal: '라켓을 편하게 잡고, 공을 맞을 준비 자세 만들기',
      pace: '약 15분 · 이번 주 2회면 충분해요',
      items: [
        {
          id: 'w1_grip',
          name: '라켓 그립 익히기',
          min: 5,
          how: '라켓을 악수하듯 잡아 보세요(포핸드 그립). 왼쪽으로 오는 공을 칠 때(백핸드)는 엄지를 라켓의 넓은 면에 대고 잡습니다.',
          point: '손에 힘을 빼고 10번 잡았다 놓기 · 라켓이 손에서 미끄러질 듯 가볍게'
        },
        {
          id: 'w1_ready',
          name: '준비 자세 만들기',
          min: 5,
          how: '발은 어깨너비로 벌리고 무릎을 살짝 굽혀요. 라켓은 가슴 높이에 살짝 들어 둡니다.',
          point: '폰 카메라로 30초만 확인 · 무릎이 굳지 않고 발바닥에 힘이 남아 있으면 좋아요'
        },
        {
          id: 'w1_warmup',
          name: '워밍업 5분',
          min: 5,
          how: '손목·어깨·발목을 각각 10바퀴씩 양쪽으로 돌려요. 몸이 따뜻해지면 끝입니다.',
          point: '숨이 살짝 찰 정도면 충분 · 아프면 바로 멈추기'
        }
      ]
    },
    {
      no: 2,
      name: '제자리 기본 타구와 빈 스윙',
      goal: '제자리에서 공을 원하는 곳으로 보내는 감각 잡기',
      pace: '약 24분 · 이번 주 2~3회',
      items: [
        {
          id: 'w2_hairpin',
          name: '서서 하는 헤어핀 연습',
          min: 5,
          how: '네트 앞에 서서 라켓을 살짝 들고, 손목과 손가락만으로 셔틀콕을 톡톡 띄워 네트 너머로 보내요. 처음엔 10개 중 3~5개만 넘어가도 성공이에요.',
          point: '팔을 크게 휘두르지 말고 "톡" 소리만 나게 · 발은 제자리에'
        },
        {
          id: 'w2_under',
          name: '서서 하는 언더 연습',
          min: 5,
          how: '스텝 없이 제자리에 서서, 낮게 오는 공을 라켓으로 아래에서 위로 살살 쳐 올려요. 처음엔 3~5m 앞까지만 보내면 됩니다.',
          point: '무릎은 살짝 굽힌 채, 라켓이 바닥을 긁지 않게 · 공을 살짝 들어 올리는 느낌'
        },
        {
          id: 'w2_shadow',
          name: '빈 스윙 15회 × 3세트',
          min: 6,
          how: '공 없이 머리 위로 라켓을 올렸다가 천천히 내려치는 동작만 반복해요(섀도 스윙). 15회 하고 30초 쉬기, 3세트.',
          point: '폰 전면 카메라로 팔이 귀 옆을 지나는지 확인 · 힘 빼고 "휙" 소리만'
        },
        {
          id: 'w2_step',
          name: '기본 스텝 · 하체 보강',
          min: 8,
          how: '가운데로 돌아오기(좌·우·앞으로 1~2걸음 나갔다 오기) 1분, 런지(한 발 앞으로 크게 딛기) 30초 × 3세트, 제자리 잔발 30초 × 3세트.',
          point: '빠르기보다 정확히 가운데로 돌아오기 · 숨이 차면 10초 쉬어도 괜찮아요'
        }
      ]
    },
    {
      no: 3,
      name: '서브와 랠리 감각',
      goal: '서브가 들어가고, 랠리가 두세 번 이어지는 감각 만들기',
      pace: '약 21분 · 이번 주 2~3회',
      items: [
        {
          id: 'w3_serve',
          name: '서브 연습 (숏서브 20개 · 롱서브 20개)',
          min: 10,
          how: '네트 바로 뒤로 살짝 넘기는 숏서브 20개, 상대 코트 뒤쪽 깊게 보내는 롱서브 20개. 바닥에 수건이나 빈 박스로 표적을 만들어 두고 세요.',
          point: '10개 중 6개가 표적 근처면 충분 · 서브할 때 손목은 고정, 라켓은 아래에서 위로'
        },
        {
          id: 'w3_pace',
          name: '샷 강약 (하이클리어 · 드롭샷)',
          min: 8,
          how: '높이 멀리 보내는 하이클리어(머리 위에서 올려 치기) 10개, 살살 떨어뜨리는 드롭샷 10개를 번갈아 쳐요.',
          point: '같은 자세에서 힘만 빼면 드롭샷 · 동작이 달라지면 상대가 미리 알아채요'
        },
        {
          id: 'w3_split',
          name: '스플릿 스텝 (공 오기 직전 폴짝)',
          min: 3,
          how: '상대가 공을 치기 직전에 제자리에서 1~2cm만 가볍게 폴짝 뛰며 양발을 어깨너비로 벌려요. 10번 반복.',
          point: '높이 뛰지 말고 가볍게 · 착지한 발로 바로 옆으로 한 걸음'
        }
      ]
    },
    {
      no: 4,
      name: '실전 적응과 회복',
      goal: '경기 흐름을 경험하고, 끝나고 몸을 돌보는 습관 만들기',
      pace: '약 22분 · 이번 주 2회',
      items: [
        {
          id: 'w4_half',
          name: '반코트 10점제',
          min: 15,
          how: '코트 절반에서 10점 내기. 이기는 것보다 10번 이상 랠리를 이어 가는 게 목표예요.',
          point: '3점을 연달아 내줘도 멈추지 않기 · 서브는 낮게, 첫 공은 안전하게'
        },
        {
          id: 'w4_cool',
          name: '경기 후 쿨다운 5분',
          min: 5,
          how: '종아리·팔뚝(전완근)·어깨를 각각 40초씩 두 번씩 천천히 늘려요.',
          point: '숨이 편해질 때까지 · 통증이 있는 부위는 건너뛰기'
        },
        {
          id: 'w4_log',
          name: '일지에 한 줄 남기기',
          min: 2,
          how: '잘된 샷 1개, 놓친 방향 1개를 일지에 적어요. 앱에 저장하면 AI가 다음 연습을 골라 줘요.',
          point: '잘한 것부터 쓰기 · 30초면 충분해요'
        }
      ]
    }
  ];

  var ALL_ITEMS = [];
  WEEKS.forEach(function (w) {
    w.items.forEach(function (it) {
      ALL_ITEMS.push({ id: it.id, name: it.name, week: w.no, weekName: w.name });
    });
  });

  function ids() { return ALL_ITEMS.map(function (it) { return it.id; }); }

  function hasItem(id) {
    for (var i = 0; i < ALL_ITEMS.length; i++) if (ALL_ITEMS[i].id === id) return true;
    return false;
  }

  function weekOf(no) {
    for (var i = 0; i < WEEKS.length; i++) if (WEEKS[i].no === Number(no)) return WEEKS[i];
    return WEEKS[0];
  }

  /* 저장된 값을 아는 항목만 true/false로 정리합니다 (예전·깨진 값 무시) */
  function normalize(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    ALL_ITEMS.forEach(function (it) {
      if (map[it.id] === true || map[it.id] === 'true' || map[it.id] === 1) out[it.id] = true;
    });
    return out;
  }

  function toggle(map, id) {
    var next = normalize(map);
    if (!hasItem(id)) return next;
    if (next[id]) delete next[id];
    else next[id] = true;
    return next;
  }

  function weekStats(week, map) {
    var m = normalize(map);
    var done = week.items.filter(function (it) { return !!m[it.id]; }).length;
    return {
      no: week.no, name: week.name, goal: week.goal, pace: week.pace,
      done: done, total: week.items.length,
      pct: week.items.length ? Math.round(done / week.items.length * 100) : 0,
      complete: done === week.items.length
    };
  }

  function stats(map) {
    var m = normalize(map);
    var weeks = WEEKS.map(function (w) { return weekStats(w, m); });
    var total = 0, done = 0;
    weeks.forEach(function (w) { total += w.total; done += w.done; });
    return {
      weeks: weeks, total: total, done: done,
      pct: total ? Math.round(done / total * 100) : 0,
      complete: total > 0 && done === total
    };
  }

  /* 지금 볼 주차 — 아직 덜 끝낸 첫 주차(모두 끝냈으면 마지막 주차) */
  function currentWeek(map) {
    var st = stats(map);
    for (var i = 0; i < st.weeks.length; i++) {
      if (!st.weeks[i].complete) return st.weeks[i].no;
    }
    return st.weeks[st.weeks.length - 1].no;
  }

  /* 다음에 할 한 가지 — 체크하지 않은 첫 항목 */
  function nextItem(map) {
    var m = normalize(map);
    for (var i = 0; i < ALL_ITEMS.length; i++) {
      var it = ALL_ITEMS[i];
      if (!m[it.id]) return it;
    }
    return null;
  }

  /* ---------- 저장 (기기 · 계정별) ---------- */
  var KEY = 'bm_routine_v1';

  function keyFor(scope) {
    return KEY + '::' + String(scope || 'guest').toLowerCase();
  }

  function load(scope) {
    return normalize(U.readJSON(keyFor(scope), {}));
  }

  function save(scope, map) {
    return U.writeJSON(keyFor(scope), normalize(map));
  }

  BM.routine = {
    TITLE: TITLE, SUB: SUB, GUARD: GUARD,
    WEEKS: WEEKS, ALL_ITEMS: ALL_ITEMS,
    ids: ids, hasItem: hasItem, weekOf: weekOf,
    normalize: normalize, toggle: toggle,
    stats: stats, weekStats: weekStats, currentWeek: currentWeek, nextItem: nextItem,
    keyFor: keyFor, load: load, save: save
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
