/* ============================================================
 * ai.js — 규칙 기반 '배드민턴 AI' 분석기
 * 입력: 최근 기록/경기, 오늘 작성한 일지
 * 출력: 점수·진단·추천드릴·맞춤처방·이번 주 루틴
 * 추천드릴/맞춤처방의 JSON 모양은 기존 시트와 100% 호환됩니다.
 *   추천드릴: {"drills":[{name, level, method, sets, point}]}
 *   맞춤처방: {"rehab":[...], "stretch":[...], "mental":[...]}
 * 순수 함수라서 같은 입력이면 항상 같은 결과가 나옵니다.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var LEVEL_FALLBACK = '일반부';

  var DRILLS = {
    '드라이브': [
      {
        name: '드라이브 기본 반복',
        method: '같은 코스로 정확하게 반복해서 샷 폼을 다집니다. 파트너 없이 벽치기로도 가능해요.',
        sets: { '초보용': '30회 × 3세트', '일반부': '40회 × 3세트', '상급': '12랠리 × 4세트', '선수부': '15랠리 × 4세트' },
        point: '타점을 몸 앞에 두고 마지막 손목 스냅에 집중'
      },
      {
        name: '드라이브 코스 변경',
        method: '좌우 코스를 번갈아 보내며 상대 움직임을 만듭니다.',
        sets: { '초보용': '2분 × 3세트', '일반부': '2분 × 4세트', '상급': '3분 × 4세트', '선수부': '3분 × 5세트' },
        point: '샷 후 준비 자세로 빠르게 복귀'
      },
      {
        name: '드라이브 연결 훈련',
        method: '앞 샷과 이어지는 실전 패턴으로 연결합니다. 드라이브 → 드라이브 → 공격으로 이어가요.',
        sets: { '초보용': '8랠리 × 3세트', '일반부': '10랠리 × 3세트', '상급': '12랠리 × 4세트', '선수부': '15랠리 × 4세트' },
        point: '파트너와 로테이션 타이밍 맞추기'
      }
    ],
    '헤어핀': [
      {
        name: '네트 앞 헤어핀 정확도',
        method: '셔틀을 네트 바로 위로 낮게 넘기는 연습. 20개씩 끊어서 세트로 진행하세요.',
        sets: { '초보용': '20개 × 3세트', '일반부': '25개 × 4세트', '상급': '30개 × 4세트', '선수부': '30개 × 5세트' },
        point: '라켓 면을 고정하고 손목 힘 빼기'
      },
      {
        name: '헤어핀 ↔ 리프트 전환',
        method: '같은 자리에서 헤어핀과 리프트를 번갈아 보내 상대를 흔듭니다.',
        sets: { '초보용': '2분 × 3세트', '일반부': '2분 × 4세트', '상급': '3분 × 4세트', '선수부': '3분 × 4세트' },
        point: '상대 자세를 보고 미리 결정하기'
      },
      {
        name: '풋워크 붙여 헤어핀',
        method: '앞으로 나가는 2보 스텝 후 바로 헤어핀으로 연결합니다.',
        sets: { '초보용': '10회 × 3세트', '일반부': '12회 × 4세트', '상급': '15회 × 4세트', '선수부': '20회 × 4세트' },
        point: '오른발을 앞으로, 상체는 낮게'
      }
    ],
    '드롭': [
      {
        name: '드롭 낙하 지점 목표 훈련',
        method: '코트 앞쪽을 3구역으로 나눠 원하는 구역에 떨어뜨립니다.',
        sets: { '초보용': '15회 × 3세트', '일반부': '15회 × 4세트', '상급': '20회 × 4세트', '선수부': '20회 × 5세트' },
        point: '타구 순간 라켓 페이스 각도 유지'
      },
      {
        name: '클리어·드롭 같은 자세',
        method: '똑같은 스윙에서 클리어와 드롭을 섞어 보내 상대 타이밍을 뺏습니다.',
        sets: { '초보용': '8랠리 × 3세트', '일반부': '10랠리 × 3세트', '상급': '12랠리 × 4세트', '선수부': '12랠리 × 4세트' },
        point: '팔 스윙은 같게, 임팩트 힘만 조절'
      },
      {
        name: '드롭 후 네트 앞 전진',
        method: '드롭을 보낸 뒤 곧바로 네트 앞으로 붙는 2단 동작을 반복합니다.',
        sets: { '초보용': '8회 × 3세트', '일반부': '10회 × 3세트', '상급': '12회 × 4세트', '선수부': '12회 × 4세트' },
        point: '샷 직후 멈추지 말고 앞으로'
      }
    ],
    '클리어': [
      {
        name: '하이클리어 깊이 훈련',
        method: '백코트 끝 라인을 목표로 최대한 깊게 보냅니다. 파트너는 위치만 확인해 주세요.',
        sets: { '초보용': '20회 × 3세트', '일반부': '20회 × 4세트', '상급': '25회 × 4세트', '선수부': '30회 × 4세트' },
        point: '임팩트 후 팔을 끝까지 뻗어 마무리'
      },
      {
        name: '백핸드 클리어',
        method: '백핸드로도 코트 끝까지 보내는 연습. 처음엔 절반 코트부터.',
        sets: { '초보용': '10회 × 3세트', '일반부': '12회 × 4세트', '상급': '15회 × 4세트', '선수부': '20회 × 4세트' },
        point: '팔 힘 대신 몸통 회전'
      },
      {
        name: '클리어 → 수비 연결',
        method: '클리어를 올린 뒤 상대 공격을 받아내는 수비 자세로 바로 전환합니다.',
        sets: { '초보용': '8랠리 × 3세트', '일반부': '10랠리 × 3세트', '상급': '12랠리 × 4세트', '선수부': '15랠리 × 4세트' },
        point: '클리어 후 센터 복귀, 라켓은 들고'
      }
    ],
    '스매시': [
      {
        name: '스매시 임팩트 반복',
        method: '손(또는 콕)을 높이 든 채 그 지점에 정확히 맞히는 연습만 따로 합니다.',
        sets: { '초보용': '15회 × 3세트', '일반부': '20회 × 3세트', '상급': '20회 × 4세트', '선수부': '25회 × 4세트' },
        point: '팔꿈치를 먼저 올리고 손목은 마지막에'
      },
      {
        name: '점프 스매시 착지 밸런스',
        method: '점프 후 착지 자세에서 1초 버티는 것까지 한 동작으로 봅니다.',
        sets: { '초보용': '8회 × 3세트', '일반부': '10회 × 3세트', '상급': '12회 × 3세트', '선수부': '12회 × 4세트' },
        point: '착지 후 흔들리지 않게, 무릎은 부드럽게'
      },
      {
        name: '스매시 좌우 코스',
        method: '같은 위치에서 좌우 코스로 갈라 보내 상대 수비를 흔듭니다.',
        sets: { '초보용': '2분 × 3세트', '일반부': '2분 × 4세트', '상급': '3분 × 4세트', '선수부': '3분 × 4세트' },
        point: '몸 방향으로 코스를 만들기'
      }
    ],
    '풋워크': [
      {
        name: '육각 풋워크',
        method: '중앙에서 6방향으로 나갔다 오는 스텝. 30초 하고 30초 쉽니다.',
        sets: { '초보용': '30초 × 4세트', '일반부': '30초 × 6세트', '상급': '40초 × 6세트', '선수부': '45초 × 8세트' },
        point: '앞꿈치로 딛고 소리 나지 않게'
      },
      {
        name: '섀도 배드민턴 6방향',
        method: '라켓 없이도 좋아요. 각 방향으로 나가 스윙 동작까지 하고 복귀합니다.',
        sets: { '초보용': '1분 × 3세트', '일반부': '1분 × 4세트', '상급': '1분 30초 × 4세트', '선수부': '2분 × 4세트' },
        point: '나가기 전에 리턴 스텝 먼저'
      },
      {
        name: '전후 스텝 사다리',
        method: '앞뒤로 빠르게 오가는 스텝으로 코트 길이 감각을 만듭니다.',
        sets: { '초보용': '15회 × 3세트', '일반부': '20회 × 3세트', '상급': '20회 × 4세트', '선수부': '25회 × 4세트' },
        point: '상체 세우고 발만 빠르게'
      }
    ],
    '서브': [
      {
        name: '숏서브 네트 낮게',
        method: '네트 위 10cm 안으로 떨어지는 숏서브를 반복합니다.',
        sets: { '초보용': '20회 × 3세트', '일반부': '25회 × 3세트', '상급': '30회 × 4세트', '선수부': '30회 × 4세트' },
        point: '셔틀을 떨어뜨리지 말고 라켓 면으로 밀기'
      },
      {
        name: '롱서브 깊이',
        method: '백코트 끝까지 길게 보내는 서브. 상대를 뒤로 밀어냅니다.',
        sets: { '초보용': '10회 × 3세트', '일반부': '12회 × 3세트', '상급': '12회 × 4세트', '선수부': '15회 × 4세트' },
        point: '허리 회전으로 힘 만들기'
      },
      {
        name: '서브 → 리시브 연결',
        method: '서브를 넣고 곧바로 리시브 자세로 들어가는 흐름을 연습합니다.',
        sets: { '초보용': '8랠리 × 3세트', '일반부': '10랠리 × 3세트', '상급': '12랠리 × 3세트', '선수부': '12랠리 × 4세트' },
        point: '서브 후 손을 내리지 말고 준비'
      }
    ],
    '리시브': [
      {
        name: '리시브 반응 훈련',
        method: '파트너가 신호를 주면 바로 리시브로 반응하는 연습.',
        sets: { '초보용': '20회 × 3세트', '일반부': '25회 × 3세트', '상급': '25회 × 4세트', '선수부': '30회 × 4세트' },
        point: '라켓 들고 무릎 굽힌 준비 자세'
      },
      {
        name: '서브 리시브 코스',
        method: '상대 서브를 헤어핀·드라이브 두 가지로 받아냅니다.',
        sets: { '초보용': '8랠리 × 3세트', '일반부': '10랠리 × 3세트', '상급': '12랠리 × 3세트', '선수부': '12랠리 × 4세트' },
        point: '서브 오기 전에 받을 곳 정해두기'
      },
      {
        name: '빠른 드라이브 리시브',
        method: '빠른 드라이브를 받아내며 라켓 면만으로 방향 바꾸기.',
        sets: { '초보용': '1분 × 3세트', '일반부': '1분 × 4세트', '상급': '2분 × 4세트', '선수부': '2분 × 4세트' },
        point: '스윙 줄이고 타이밍으로'
      }
    ]
  };

  var BASICS = [
    {
      name: '기본 스트록 10분',
      method: '클리어·드롭·스매시를 한 번씩 20개씩. 오늘 컨디션에 맞춰 강도만 조절하세요.',
      sets: { '초보용': '10분', '일반부': '10분', '상급': '10분', '선수부': '10분' },
      point: '폼이 무너지면 개수보다 정확도'
    },
    {
      name: '벽치기 100회',
      method: '벽을 상대로 드라이브·헤어핀을 섞어 칩니다. 파트너가 없어도 됩니다.',
      sets: { '초보용': '50회 × 2세트', '일반부': '100회', '상급': '150회', '선수부': '200회' },
      point: '라켓을 몸 가까이, 손목은 부드럽게'
    }
  ];

  var REHAB = {
    '목': {
      rehab: ['목 주변 근육 긴장 시 20분 온찜질 후 가벼운 움직임', '스마트폰·장시간 고개 숙임 자세 줄이기'],
      stretch: ['턱 당기기 10회 × 2세트', '어깨 돌리기 10회씩 앞·뒤', '고개 천천히 좌우로 10초씩']
    },
    '어깨': {
      rehab: ['오버헤드 동작(스매시·클리어) 횟수를 오늘 하루 줄이기', '통증 시 냉찜질 15분, 통증이 계속되면 진료 권장'],
      stretch: ['밴드 바깥돌림 15회 × 2세트', '가슴 문 열기 스트레칭 30초 × 2', '어깨 원 그리기 10회씩']
    },
    '무릎': {
      rehab: ['계단·점프 동작을 줄이고 무릎 주변 근육을 먼저 강화', '붓기가 있으면 냉찜질 15분, 통증 지속 시 진료'],
      stretch: ['대퇴사두근 스트레칭 30초 × 2', '종아리 스트레칭 30초 × 2', '엉덩이 스트레칭 30초 × 2']
    },
    '허리': {
      rehab: ['셔틀 주울 때 무릎 굽혀 앉기, 허리 굽힌 자세 금지', '통증이 이어지면 운동 강도를 낮추고 진료 권장'],
      stretch: ['고양이-소 자세 10회', '햄스트링 스트레칭 30초 × 2', '누워서 무릎 잡기 30초 × 2']
    },
    '팔꿈치': {
      rehab: ['그립 악력을 줄이고 팔 힘을 빼고 치기', '테니스 엘보 밴드 사용을 고려'],
      stretch: ['손목 굽히기 스트레칭 20초 × 3', '팔뚝 마사지 2분']
    },
    '손목': {
      rehab: ['라켓 그립 두께 확인, 손목 스냅 과사용 줄이기', '통증 시 테이핑 또는 보호대 사용'],
      stretch: ['손목 원 그리기 10회', '손목 앞뒤 굽히기 20초 × 3']
    },
    '아킬레스건': {
      rehab: ['점프·급정지 동작 줄이기, 아침 첫 통증 확인', '운동 전 10분 워밍업을 꼭 지키기'],
      stretch: ['벽 짚고 종아리 스트레칭 30초 × 3', '발목 돌리기 10회씩']
    },
    '발목': {
      rehab: ['한 발 서기 30초 × 3으로 발목 균형 잡기', '접질린 뒤라면 보호대 착용 후 복귀'],
      stretch: ['발목 앞뒤로 굽히기 20초 × 3', '발가락 벌리기 10회']
    }
  };

  var GENERIC_CARE = {
    rehab: ['훈련 후 10분은 정리 운동으로 마무리하기', '통증이 3일 이상 이어지면 진료를 권장'],
    stretch: ['햄스트링·종아리 스트레칭 30초 × 2', '고관절 스트레칭 30초 × 2', '어깨 돌리기 10회씩']
  };

  function setsFor(drill, level) {
    return (drill.sets && (drill.sets[level] || drill.sets[LEVEL_FALLBACK])) || '3세트';
  }

  function takeDrills(skills, level, count) {
    var out = [], used = {};
    var pools = [];
    skills.forEach(function (s) { if (DRILLS[s]) pools.push(DRILLS[s]); });
    var maxLen = 0;
    pools.forEach(function (p) { maxLen = Math.max(maxLen, p.length); });
    for (var round = 0; round < maxLen && out.length < count; round++) {
      for (var i = 0; i < pools.length && out.length < count; i++) {
        var d = pools[i][round];
        if (!d || used[d.name]) continue;
        used[d.name] = 1;
        out.push({
          name: d.name, level: level || LEVEL_FALLBACK,
          method: d.method, sets: setsFor(d, level || LEVEL_FALLBACK), point: d.point
        });
      }
    }
    return out;
  }

  /* 최근 기록에서 자주 나온 약점·통증 세기 */
  function tally(records, key) {
    var counts = {};
    records.forEach(function (r) {
      (r[key] || []).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return Object.keys(counts)
      .map(function (k) { return { name: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n || (a.name < b.name ? -1 : 1); });
  }

  function recentWindow(records, days) {
    var today = U.parseYmd(U.ymd());
    return records.filter(function (r) {
      var d = U.parseYmd(r.date);
      if (!d) return false;
      var diff = (today - d) / 86400000;
      return diff >= 0 && diff <= (days || 14);
    });
  }

  function winStats(list) {
    var w = 0, l = 0;
    list.forEach(function (r) {
      var res = r.result || BM.domain.resultFromScore(r.score);
      if (res === '승') w++;
      else if (res === '패') l++;
    });
    return { wins: w, losses: l, total: w + l, rate: w + l ? Math.round((w / (w + l)) * 100) : null };
  }

  /* ---------- 핵심: 분석 ---------- */
  function analyze(input) {
    input = input || {};
    var draft = input.draft || {};
    var records = (input.records || []).slice();
    var level = input.level || draft.level || LEVEL_FALLBACK;
    var nick = draft.nick || input.nick || '회원';

    /* 오늘 일지(아직 저장 전)도 분석 대상에 포함 */
    var today = draft.date || U.ymd();
    var todayEntry = {
      date: today,
      cond: draft.cond, intensity: draft.intensity, minutes: draft.minutes,
      done: draft.done || [], score: draft.score || null, result: draft.result || '',
      pain: draft.pain || [], weakness: draft.weakness || [], userKey: draft.userKey
    };
    var history = records.filter(function (r) { return r.date !== today || r.cond !== draft.cond; });
    var window14 = recentWindow(history, 14);
    var window30 = recentWindow(history, 30);

    /* 약점: 최근 기록 + 오늘 선택 */
    var weakCounts = tally(window30, 'weakness');
    var painCounts = tally(window30, 'pain');
    var todayWeak = (draft.weakness || []).slice();
    var weakSkills = U.uniq(todayWeak.concat(weakCounts.map(function (w) { return w.name; }))).slice(0, 3);
    if (!weakSkills.length) weakSkills = ['드라이브', '풋워크'];

    var painToday = draft.pain || [];
    var painTop = painCounts[0] || null;
    var repeatedPain = painCounts.filter(function (p) { return p.n >= 2; }).map(function (p) { return p.name; });

    /* 승률 */
    var recentGames = U.sortBy(window30.filter(function (r) { return r.score; }), function (r) { return r.date; }, true).slice(0, 5);
    var ws = winStats(recentGames);
    var streakDays = 0;
    (function () {
      var dates = U.uniq(window30.map(function (r) { return r.date; })).sort().reverse();
      var todayD = U.parseYmd(U.ymd());
      if (!dates.length) return;
      var first = U.parseYmd(dates[0]);
      if (Math.round((todayD - first) / 86400000) > 1) return;
      streakDays = 1;
      for (var i = 1; i < dates.length; i++) {
        if (Math.round((U.parseYmd(dates[i - 1]) - U.parseYmd(dates[i])) / 86400000) === 1) streakDays++;
        else break;
      }
    })();

    var cond = draft.cond == null ? null : draft.cond;
    var intensity = draft.intensity == null ? null : draft.intensity;
    var minutes = draft.minutes == null ? null : draft.minutes;
    var done = draft.done || [];

    /* ---------- 점수 ---------- */
    var scoreIdx = 60;
    if (cond != null) scoreIdx += cond >= 7 ? 10 : cond <= 4 ? -12 : 3;
    if (intensity != null) scoreIdx += intensity >= 5 && intensity <= 8 ? 8 : intensity >= 9 ? -6 : 0;
    if (minutes != null) scoreIdx += minutes >= 45 ? 8 : minutes < 30 ? -8 : 3;
    if (draft.score) scoreIdx += (draft.result || BM.domain.resultFromScore(draft.score)) === '승' ? 8 : (draft.result === '무' ? 2 : -4);
    scoreIdx -= Math.min(18, painToday.length * 6);
    if (done.indexOf('코어') >= 0 || done.indexOf('런닝') >= 0) scoreIdx += 4;
    if (painToday.length && (intensity || 0) >= 8) scoreIdx -= 5;
    if (streakDays >= 5) scoreIdx -= 4;           // 연속 훈련 과부하
    var score = U.clamp(Math.round(scoreIdx), 0, 100);

    /* ---------- 진단 문장 ---------- */
    var insights = [];
    if (ws.total) {
      insights.push({
        icon: 'score',
        label: '최근 ' + ws.total + '경기 ' + ws.wins + '승 ' + ws.losses + '패',
        detail: ws.rate >= 60 ? '흐름이 좋아요. 지금 쓰는 패턴을 유지하세요.'
          : ws.rate >= 40 ? '반반 승부예요. 결정구 하나만 더 만들면 달라집니다.'
            : '점수보다 내용을 보세요. 아래 기본 드릴 2주면 충분히 뒤집힙니다.'
      });
    }
    if (cond != null && intensity != null) {
      var gap = intensity - cond;
      insights.push({
        icon: 'gauge',
        label: '컨디션 ' + cond + ' / 강도 ' + intensity,
        detail: gap >= 3 ? '몸 상태보다 강도가 높아요. 오늘은 세트 수를 20% 줄이세요.'
          : cond <= 4 ? '회복이 먼저인 날이에요. 가볍게 20~30분만.'
            : gap <= -2 ? '여유가 있어요. 마지막에 스매시 드릴을 한 세트 더 붙여도 좋습니다.'
              : '컨디션과 강도가 잘 맞았어요.'
      });
    } else if (cond != null) {
      insights.push({ icon: 'gauge', label: '컨디션 ' + cond, detail: cond <= 4 ? '회복 위주로 짧게.' : '좋은 상태예요. 집중 훈련 가능.' });
    }
    if (minutes != null) {
      insights.push({
        icon: 'clock',
        label: '운동 ' + minutes + '분',
        detail: minutes < 30 ? '워밍업만 하다 끝나기 쉬운 시간이에요. 15분만 더 채워 보세요.'
          : minutes > 120 ? '긴 훈련이었어요. 내일은 회복일에 가깝게 가져가세요.'
            : '적당한 볼륨이에요.'
      });
    }
    if (repeatedPain.length) {
      insights.push({
        icon: 'alert',
        label: '반복 통증: ' + repeatedPain.join(', '),
        detail: '최근 4주에 2회 이상 나온 부위예요. 오늘은 해당 동작 개수를 줄이고 처방을 먼저 챙기세요.'
      });
    } else if (painToday.length) {
      insights.push({ icon: 'alert', label: '오늘 통증: ' + painToday.join(', '), detail: '한 번으로 끝나면 괜찮아요. 내일 같은 부위면 강도를 낮추세요.' });
    }
    if (streakDays >= 3) {
      insights.push({ icon: 'fire', label: streakDays + '일 연속 기록', detail: streakDays >= 5 ? '대단해요. 다만 5일 넘으면 하루는 완전 휴식이 실력에 더 좋습니다.' : '꾸준함이 제일 큰 무기예요.' });
    }
    if (weakCounts.length) {
      insights.push({
        icon: 'weak',
        label: '자주 나온 약점: ' + weakCounts.slice(0, 2).map(function (w) { return w.name; }).join(', '),
        detail: '최근 30일 기록 기준이에요. 아래 추천드릴이 이 기술에 맞춰져 있습니다.'
      });
    }
    insights = insights.slice(0, 5);

    /* ---------- 추천드릴 ---------- */
    var drills = takeDrills(weakSkills, level, 3);
    if (drills.length < 3) {
      var extra = takeDrills(['풋워크', '드라이브', '리시브'], level, 3);
      extra.forEach(function (d) {
        if (drills.length < 3 && !drills.some(function (x) { return x.name === d.name; })) drills.push(d);
      });
    }
    if (drills.length < 3) drills = drills.concat(BASICS.slice(0, 3 - drills.length).map(function (b) {
      return { name: b.name, level: level, method: b.method, sets: b.sets[level] || b.sets['일반부'], point: b.point };
    }));

    /* ---------- 맞춤처방 ---------- */
    var care = { rehab: [], stretch: [], mental: [] };
    var painList = U.uniq(painToday.concat(painCounts.filter(function (p) { return p.n >= 3; }).map(function (p) { return p.name; })));
    painList.slice(0, 2).forEach(function (p) {
      var box = REHAB[p];
      if (box) {
        care.rehab = care.rehab.concat(box.rehab);
        care.stretch = care.stretch.concat(box.stretch);
      }
    });
    if (!care.rehab.length) care.rehab = GENERIC_CARE.rehab.slice();
    if (!care.stretch.length) care.stretch = GENERIC_CARE.stretch.slice();
    care.rehab = U.uniq(care.rehab).slice(0, 4);
    care.stretch = U.uniq(care.stretch).slice(0, 4);

    if (ws.rate != null && ws.rate < 40) care.mental.push('오늘 잘된 샷 하나만 떠올려 보세요. 승률은 연습량이 쌓이면 따라옵니다.');
    if (cond != null && cond <= 4) care.mental.push('컨디션이 낮은 날은 "덜 하기"도 훈련입니다. 20분만 하고 끝내도 성공이에요.');
    if (painToday.length) care.mental.push('통증은 참지 말고 그 자리에서 멈추는 게 오래 칩니다.');
    if (streakDays >= 5) care.mental.push('5일 넘게 이어졌어요. 내일 하루 쉬면 다음 주 감각이 더 좋아집니다.');
    if (!care.mental.length) {
      care.mental = [
        '좋은 흐름이에요! 오늘 잘된 샷 하나를 떠올리며 마무리하세요.',
        '다음 훈련 목표를 한 가지만 정해 보세요.',
        '경기 후엔 잘한 점 2가지를 먼저 적어 보세요.'
      ];
    }
    care.mental = U.uniq(care.mental).slice(0, 3);

    /* ---------- 다음 목표 + 이번 주 루틴 ---------- */
    var focus = weakSkills[0] + ' 정확도 1개';
    if (cond != null && cond <= 4) focus = '회복 (20분 가볍게)';
    else if (painToday.length) focus = painToday[0] + ' 관리 + 가벼운 ' + weakSkills[0];
    else if (ws.rate != null && ws.rate < 40) focus = '리시브 안정 + 실수 줄이기';

    var week = [
      { day: '다음 훈련', focus: weakSkills[0], menu: drills[0] ? drills[0].name : '기본 스트록' },
      { day: '2회차', focus: weakSkills[1] || '풋워크', menu: drills[1] ? drills[1].name : '육각 풋워크' },
      { day: '3회차', focus: '실전', menu: '21점제 게임 2~3경기 + 기록 남기기' }
    ];

    var risk = [];
    if (painToday.length && (intensity || 0) >= 8) risk.push({ level: 'warn', text: '통증이 있는데 강도가 높아요. 오늘은 강도를 6 이하로 낮추는 걸 권장합니다.' });
    if (repeatedPain.length) risk.push({ level: 'warn', text: repeatedPain.join(', ') + ' 통증이 반복되고 있어요. 2주 이상 이어지면 정형외과 상담을 권장합니다.' });
    if (streakDays >= 6) risk.push({ level: 'info', text: streakDays + '일 연속 훈련 중이에요. 24시간 휴식을 넣어 주세요.' });
    if (!risk.length) risk.push({ level: 'ok', text: '무리한 신호는 없어요. 지금 리듬을 유지하세요.' });

    var headline;
    if (score >= 80) headline = '아주 좋은 하루예요, ' + nick + '님';
    else if (score >= 60) headline = '잘 채운 하루예요';
    else if (score >= 40) headline = '조금만 더 다듬으면 좋아져요';
    else headline = '오늘은 회복이 먼저예요';

    return {
      score: score,
      headline: headline,
      focus: focus,
      insights: insights,
      weakness: weakSkills,
      drills: { drills: drills },
      care: care,
      week: week,
      risk: risk,
      /* 시트에 그대로 넣을 수 있는 형태 */
      sheetPatch: { '추천드릴': JSON.stringify({ drills: drills }), '맞춤처방': JSON.stringify(care) }
    };
  }

  /* 코치 화면용: 선수 한 명 요약 */
  function summarize(records, level) {
    var list = U.sortBy(records || [], function (r) { return r.date || ''; }, true);
    var window30 = recentWindow(list, 30);
    var ws = winStats(window30.filter(function (r) { return r.score; }).slice(0, 8));
    var weak = tally(window30, 'weakness');
    var pain = tally(window30, 'pain');
    var conds = window30.filter(function (r) { return r.cond != null; });
    return {
      sessions: window30.length,
      winRate: ws.rate,
      wins: ws.wins, losses: ws.losses,
      topWeakness: weak.slice(0, 2).map(function (w) { return w.name; }),
      pain: pain.slice(0, 3).map(function (p) { return p.name + '(' + p.n + ')'; }),
      avgCond: conds.length ? Math.round((U.sum(conds, function (r) { return r.cond; }) / conds.length) * 10) / 10 : null,
      minutes: U.sum(window30, function (r) { return r.minutes || 0; }),
      level: level
    };
  }

  BM.ai = { analyze: analyze, summarize: summarize, DRILLS: DRILLS, REHAB: REHAB };
})(typeof globalThis !== 'undefined' ? globalThis : this);
