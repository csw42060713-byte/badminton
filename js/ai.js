/* ============================================================
 * ai.js — 규칙 기반 '배드민턴 AI' 분석기
 * 입력: 최근 기록/경기, 오늘 작성한 일지
 * 출력: 점수·진단·추천드릴·맞춤처방·이번 주 루틴·급수 플랜·전술 노트
 * 추천드릴/맞춤처방의 JSON 모양은 기존 시트와 100% 호환됩니다.
 *   추천드릴: {"drills":[{name, level, method, sets, point}]}
 *   맞춤처방: {"rehab":[...], "stretch":[...], "mental":[...], "warmup":[...]}
 * 순수 함수라서 같은 입력이면 항상 같은 결과가 나옵니다.
 *
 * 급수(normalizeGrade)는 domain.js와 같은 7단계를 씁니다.
 *   자강 > 선수부 > A조 > B조 > C조 > D조 > 초심
 * 예전 값(초보용/일반부/상급)도 자동으로 맞춰 줍니다.
 *
 * ── 근거로 삼은 공식·학술 자료 (블로그·예능·비공식 요약 제외) ──
 * [BWF1] Badminton World Federation, <Badminton Coach Education Coaches' Manual Level 1>,
 *        2nd ed., 2017 — Module 6(무브먼트 사이클·스플릿스텝·런지), Module 8(단식/복식/혼합복식 전술).
 *        https://development.bwfbadminton.com/wp-content/uploads/2017/12/bwf_coach_education_coaches_manual_l1-2nd-edition-midres.pdf
 * [BWF2] BWF Development, Coach Education Level 1 개요(무료 교재·영상).
 *        https://development.bwfbadminton.com/coaches/level-1
 * [BE1]  Badminton England, Coaching Resource(SECTION 5) — 복식 포메이션(전후·좌우), 채널 어택.
 *        https://images.gc.badmintonenglandservices.co.uk/ed390d50-7aaf-11f0-9c36-1577a1c24d46.pdf
 * [KISS] 한국스포츠정책과학원(구 체육과학연구원) [체육지도자 훈련지도서] 배드민턴 — 기술·전술·체력 훈련 지도.
 *        https://www.sports.re.kr/front/board/bs/boardList.do?board_seq=37&keyKind3=101&menu_seq=682
 * [KIM13] 김동문 외, <국가대표 배드민턴 선수들의 운동상해 조사연구>, 한국웰니스학회지 8(2), 2013
 *        — 허리 18.2%·발목 17.4%·무릎 14.7%·어깨 14.1%, 과훈련 60%·준비운동 부족 17.8%.
 * [JEON24] Jeon J-W, Lim S-T, Cho J-H, <Designing and Conducting an Injury Study in Amateur
 *        Badminton Players>, Applied Sciences 14(12):5194, 2024 — 국내 동호인 504명, 허리·발목·무릎·어깨.
 * [SHAH25] Shaharudin M.I. et al., <Characteristics of injuries among elite badminton players:
 *        a systematic review>, PubMed 41332252, 2025 — 하지 54~71%, 건병증·염좌가 흔함.
 * [BMJ25] <Systematic review on badminton injuries: incidence, characteristics and risk factors>,
 *        BMJ Open Sport & Exercise Medicine 11(1):e002127, 2025 — 1,000시간당 1~4건, 과사용 25~74%,
 *        부상의 40%가 직전 주 훈련부하 10% 이상 급증과 연관(Piggott & Newton) → 주간 부하 급증 경계.
 * [MARC24] Marchena-Rodríguez A. et al., <Aetiology, epidemiology and treatment of musculoskeletal
 *        injuries in badminton players: a systematic review and meta-analysis>, Res Sports Med, 2024
 *        (DOI: 10.1080/15438627.2024.2351964) — 28편·2,435명. 하체 부상 52.15%, 염좌 36.06%.
 * [PHOM25] Phomsoupha M., Tran A., Guermont H., <A prospective randomised controlled trial investigating
 *        the impact of a musculoskeletal injury prevention warm-up program for youth badminton (PreventiBad)>,
 *        J Sports Sci 43(5):440-447, 2025 (DOI: 10.1080/02640414.2025.2461931) — 유소년 273명, 8주 클러스터 RCT.
 *        대조군 4.07건/1,000시간 → 중재군 1.23건, IRR 0.30(95%CI 0.12~0.75) = 부상 70% 감소.
 * [PENG25] Pengked K., Hareebin Y., Tawanwongsri W., Manunyanon S., <Badminton-related musculoskeletal injuries
 *        in senior players: Epidemiology and preventive strategies for common injuries>,
 *        Electron J Gen Med 22(1):em629, 2025 (DOI: 10.29333/ejgm/15917) — 성인 254명.
 *        우세측 무릎 51.1%·발목 36.3%·어깨/쇄골 25.5%, 발목 염좌 23.5%, 슬개건병증 20.3%.
 *        방향 전환에서 발목 염좌·무릎 부상이 많고, 준비운동 빈도와 부상 빈도는 역상관(ρ = -0.273, p < 0.001).
 * [ALC09] Alcock A., Cable N.T., <A comparison of singles and doubles badminton: heart rate response, player
 *        profiles and game characteristics>, Int J Perform Anal Sport 9(2):228-237, 2009
 *        (DOI: 10.1080/24748668.2009.11868479) — 단식 평균/최고 심박 88.8%/96.8% vs 복식 75.5%/89.0% HRmax,
 *        게임당 스텝 593.8 vs 314.5보, 랠리 5.0초·휴식 8.1 vs 9.7초.
 * [HOFF24] Hoffmann D., Brinkschulte M., Vogt T., <Match characteristics of women's and men's singles and doubles
 *        events in elite badminton>, Int J Perform Anal Sport, 2024 (DOI: 10.1080/24748668.2024.2386830) —
 *        2018 세계선수권 5종목. 남자복식·혼합복식이 가장 짧은 랠리(평균 5.6~6.7초)·가장 높은 타구 빈도,
 *        여자복식이 가장 긴 랠리(평균 약 10.1초)·가장 높은 실제 경기시간 비율.
 * [SANT25] Santiano F., Ison S., Emmerson J., Colyer S., <Using markerless motion analysis to quantify sex and
 *        discipline differences in external mechanical work during badminton match play>,
 *        J Sports Sci 43(12):1158-1166, 2025 (DOI: 10.1080/02640414.2025.2489863) — 체중 보정 외부 기계적
 *        작업량·파워가 단식에서 복식보다 큼(ES 0.44 / 0.47, 최상위급 남자 선수 ES 0.88).
 * [VRI16] Vriend I. et al., <Neuromuscular training is effective to prevent ankle sprains…>,
 *        JISAKOS 2016 — 신경근 훈련으로 발목 염좌 위험 40% 감소(RR 0.60).
 * [EHS24] Ehsani F. et al., <…subacromial impingement syndrome…>, J Sport Rehabil, 2024 —
 *        회전근개 점진 저항운동 주3회 6주가 견봉하 거리·통증 개선.
 * [YOUNG05] Young M.A. et al., <Eccentric decline squat protocol…>, Br J Sports Med, 2005 —
 *        슬개건병증 25° decline squat 3×15회 하루 2회 12주.
 * [HEALTHY21] <Efficacy of heel lifts versus calf muscle eccentric exercise for mid-portion Achilles
 *        tendinopathy (HEALTHY)>, Br J Sports Med 55(9), 2021 — Alfredson 3×15 하루 2회 12주.
 * [SILVA23] Silva R.S. et al., <Patellar Tendon Load Progression during Rehabilitation Exercises>,
 *        Med Sci Sports Exerc, 2023 — 슬개건 하중 3단계(step-up < lunge < decline squat).
 * [TRAV19] Travers M.J. et al., <Efficacy of heavy eccentric calf training…>, PubMed 30636702, 2019.
 * [NA24]  나경민·조은혜, <세계 배드민턴 남자복식경기의 승자 예측모형 탐색: 의사결정나무분석 적용>,
 *        한국체육학회지 63(3):147-156, 2024 (KCI) — BWF 국제대회 남자복식 100경기(233세트).
 *        승패 예측 변인: 랠리후반 득점·랠리전반 득점·서브실점·서브득점·선제공격 실점·리시브 실점.
 *        랠리후반 득점 12.5점 이상이면 75.9% 승리, 이하이면 72.4% 패배.
 * [PHOM15] Phomsoupha M., Laffaye G., <The Science of Badminton: Game Characteristics, Anthropometry,
 *        Physiology, Visual Fitness and Biomechanics>, Sports Med 45(4):473-495, 2015 —
 *        랠리 약 7초·휴식 약 15초(랠리:휴식 ≈ 1:2), 실질 경기시간 약 31%.
 * [PHOM20] Phomsoupha M., Laffaye G., <Injuries in badminton: A review>, Science & Sports, 2020 —
 *        부상이 훈련 후반(48%)에 가장 많고, 피로로 힘·고유수용감각이 떨어질 때 늘어남.
 * [GABB16] Gabbett T.J., <The training-injury prevention paradox: should athletes be training smarter
 *        and harder?>, Br J Sports Med 50:273-280, 2016 — 급성(1주):만성(4주 평균) 부하 비율
 *        0.8~1.3을 낮은 위험 구간, 1.5 이상 급증을 위험 구간으로 제시(모니터링 참고값).
 * [SHIS25] Shishido H., Nishijima T., <Characteristics of split-step skills of the world's top athletes
 *        in badminton>, PLoS ONE 20(1):e0316632, 2025 (DOI: 10.1371/journal.pone.0316632) —
 *        2023 BWF 세계선수권 남자단식 1~4위 선수(VITI·NARA·PRAN)의 7경기 영상 분석.
 *        스플릿 스텝 반응시간(상대 타구 → 한 발이 땅에서 떨어질 때까지) 0.24~0.25초,
 *        스탠스 폭은 신장의 0.51~0.52배(약 50%), 스플릿 스텝 위치는 베이스 중앙에서 42~55cm
 *        (선수별 중앙값 거리)에 모였습니다. 상대 타구가 상대의 백핸드 후위(LR)에 많을수록
 *        체공 시간이 길어져 베이스 복귀와 스플릿 스텝 준비가 안정적이었습니다(NARA가 LR 비중 유의하게 높음).
 * [HA10]  하태권·김홍기·구해모·박종철, <2008년 베이징올림픽 대비 배드민턴 남자복식 서비스 및
 *        서비스리시브 경기내용 분석>, 체육과학연구 21(1):947-955, 2010 (DOI: 10.24985/kjss.2010.21.1.947)
 *        — 2007·2008 세계선수권·2008 전영오픈 8강 이상, 국가대표 남자복식 2조(A조·B조) 각 4경기.
 *        서브는 몸쪽 67%(A조)·70%(B조), 직선 22%·20%, 대각 11%·10% → 서브 실점 23%·25%.
 *        리시브 기술은 숏 드라이브 46%·38%, 드라이브 21%·34%, 헤어핀 28%·15%(드롭 0%).
 *        두 조 모두 서브 코스와 리시브 구질의 다양화가 필요하다고 결론.
 * ============================================================ */
(function (root) {
  'use strict';
  var BM = root.BM = root.BM || {};
  var U = BM.util;

  var LEVEL_FALLBACK = '일반부';

  /* ---------- 급수(7단계) ---------- */
  var GRADES = ['초심', 'D조', 'C조', 'B조', 'A조', '선수부', '자강'];
  var GRADE_TIER = { '초심': 0, 'D조': 1, 'C조': 2, 'B조': 3, 'A조': 4, '선수부': 5, '자강': 6 };
  var GRADE_ALIAS = {
    '초보용': '초심', '초보': '초심', '입문': '초심',
    '일반부': 'C조', '중급': 'C조', '일반': 'C조',
    '상급': 'B조',
    '선수': '선수부', '선출': '선수부'
  };
  /* 급수를 모르거나 예전 값일 때 되돌아갈 세트 문구 */
  var TIER_LEGACY = ['초보용', '초보용', '일반부', '일반부', '상급', '선수부', '선수부'];

  /* ---------- 논문에서 가져온 기준값 ----------
   * 화면 문구와 테스트가 같은 숫자를 쓰도록 한 곳에 모읍니다.
   * [SHIS25] 스플릿 스텝 · [HA10] 남자복식 서브/리시브 */
  var SPLIT_STEP = {
    reactionSec: [0.24, 0.25],        // 상대 타구 → 첫 발이 땅에서 떨어질 때까지
    stanceHeightRatio: [0.51, 0.52],  // 스탠스 폭 ÷ 신장
    baseRadiusCm: [42, 55],           // 베이스 중앙에서 스플릿 스텝 위치까지(선수별 중앙값)
    source: 'Shishido & Nishijima, PLoS ONE 20(1):e0316632, 2025'
  };
  var DOUBLES_SERVE = {
    bodyPct: [67, 70],                // 몸쪽 서브 비중
    lossPct: [23, 25],                // 그때의 서브 실점률
    straightPct: [20, 22],
    crossPct: [10, 11],
    source: '하태권·김홍기·구해모·박종철, 체육과학연구 21(1):947-955, 2010'
  };
  var DOUBLES_RECEIVE = {
    shortDrivePct: [38, 46],
    drivePct: [21, 34],
    hairpinPct: [15, 28],
    source: DOUBLES_SERVE.source
  };

  function rng(pair, unit) {
    return pair[0] + '~' + pair[1] + (unit || '');
  }

  function gradeOf(level) {
    var s = String(level == null ? '' : level).trim().replace(/\s+/g, '');
    if (!s) return '';
    if (GRADE_TIER[s] != null) return s;
    if (GRADE_ALIAS[s]) return GRADE_ALIAS[s];
    var m = s.match(/^([ABCD])조$/i);
    if (m) return m[1].toUpperCase() + '조';
    if (s.indexOf('자강') >= 0) return '자강';
    if (s.indexOf('선수') >= 0) return '선수부';
    if (s.indexOf('초심') >= 0 || s.indexOf('초보') >= 0) return '초심';
    if (s.indexOf('상급') >= 0) return 'B조';
    if (s.indexOf('일반') >= 0 || s.indexOf('중급') >= 0) return 'C조';
    return '';
  }

  function tierOf(level) {
    var g = gradeOf(level);
    return g ? GRADE_TIER[g] : -1;
  }

  /* ---------- 급수별 세트 문구 만들기 ----------
   * vol('회', [20,25,30,35,40,45,50], [2,3,3,4,4,4,5])
   *   → { 초심:'20회 × 2세트', 'D조':'25회 × 3세트', … '자강':'50회 × 5세트' }
   * 급수 7단계마다 숫자를 따로 두어 '초심용/일반부' 식의 두루뭉술한 처방을 없앱니다. */
  function vol(unit, perSet, setCount) {
    var out = {};
    GRADES.forEach(function (g, i) {
      out[g] = perSet[i] + unit + ' × ' + setCount[i] + '세트';
    });
    return out;
  }

  /* ---------- 기술별 드릴 ----------
   * 각 드릴의 sets는 7급수 전부를 갖습니다. (예전 4단계 문구도 setsFor가 받아 줍니다) */
  var DRILLS = {
    '드라이브': [
      {
        name: '드라이브 기본 반복',
        method: '같은 코스로 정확하게 반복해 샷 폼을 다집니다. 파트너 없이 벽치기로도 됩니다. 타점은 항상 몸 앞.',
        sets: vol('회', [20, 25, 30, 35, 40, 45, 50], [2, 3, 3, 3, 4, 4, 4]),
        point: '라켓을 몸 앞에 두고 마지막 손목 스냅에 집중'
      },
      {
        name: '드라이브 코스 변경',
        method: '좌우 코스를 번갈아 보내 상대 움직임을 만듭니다. 복식에서는 중앙(두 선수 사이)을 겨냥하는 것이 기본입니다.',
        sets: vol('분', [1, 2, 2, 2, 3, 3, 3], [2, 3, 3, 4, 4, 4, 5]),
        point: '샷 후 바로 준비 자세(라켓 들고)로 복귀'
      },
      {
        name: '드라이브 연결 3구',
        method: '드라이브 → 드라이브 → 공격(스매시/푸시)으로 이어지는 3구 패턴. 서브 리시브 뒤 드라이브 싸움을 견디는 힘을 만듭니다.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 15], [2, 3, 3, 4, 4, 4, 4]),
        point: '3구째에 반드시 아래로(공격) 바꾸기'
      },
      {
        name: '드라이브 방향 속이기',
        method: '같은 스윙에서 스트레이트/크로스로 갈라 보냅니다. 손목이 아니라 그립을 살짝 풀어 면을 돌립니다.',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 25], [2, 3, 3, 3, 4, 4, 4]),
        point: '스윙은 크게, 임팩트 순간만 방향'
      }
    ],
    '헤어핀': [
      {
        name: '네트 앞 헤어핀 정확도',
        method: '셔틀을 네트 바로 위로 낮게 넘깁니다. 20개씩 끊어 세트로 진행하세요.',
        sets: vol('개', [15, 20, 20, 25, 25, 30, 30], [3, 3, 4, 4, 4, 4, 5]),
        point: '라켓 면 고정, 손목 힘 빼기'
      },
      {
        name: '헤어핀 ↔ 리프트 전환',
        method: '같은 자리에서 헤어핀과 리프트를 번갈아 보내 상대를 흔듭니다. BWF 코치 매뉴얼도 네트 앞 선택지를 두 가지로 좁히는 훈련을 권합니다.',
        sets: vol('분', [1, 2, 2, 2, 3, 3, 3], [2, 3, 3, 4, 4, 4, 4]),
        point: '상대 자세를 보고 치기 전에 결정'
      },
      {
        name: '풋워크 붙여 헤어핀',
        method: '앞으로 나가는 2보 스텝 후 바로 헤어핀. 런지에서 뒤발을 끌지 않고 상체를 낮게.',
        sets: vol('회', [8, 10, 10, 12, 15, 15, 20], [2, 3, 3, 4, 4, 4, 4]),
        point: '오른발(오른손잡이) 앞으로, 무릎이 발끝을 넘지 않게'
      },
      {
        name: '스피닝 넷샷',
        method: '셔틀을 회전시켜 상대가 깔끔하게 못 받게 만드는 넷샷. 손목을 옆으로 살짝 튕깁니다. (BWF 단식 네트 플레이 응용)',
        sets: vol('회', [8, 10, 12, 15, 15, 20, 20], [2, 2, 3, 3, 3, 4, 4]),
        point: '네트 높이 위에서 잡고, 아래로 내려 찍지 않기'
      }
    ],
    '드롭': [
      {
        name: '드롭 낙하 지점 목표',
        method: '코트 앞쪽을 3구역으로 나눠 원하는 구역에 떨어뜨립니다. 네트에서 1~1.5m 지점을 기본 목표로.',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 20], [3, 3, 4, 4, 4, 5, 5]),
        point: '타구 순간 라켓 페이스 각도 유지'
      },
      {
        name: '클리어·드롭 같은 자세',
        method: '똑같은 스윙에서 클리어와 드롭을 섞어 상대 타이밍을 뺏습니다. 백스윙 크기는 같게.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 12], [3, 3, 3, 4, 4, 4, 4]),
        point: '팔 스윙은 같게, 임팩트 힘만 조절'
      },
      {
        name: '드롭 후 네트 앞 전진',
        method: '드롭을 보낸 뒤 곧바로 네트 앞으로 붙는 2단 동작. 상대 리프트가 짧으면 그대로 킬.',
        sets: vol('회', [6, 8, 10, 10, 12, 12, 12], [3, 3, 3, 4, 4, 4, 4]),
        point: '샷 직후 멈추지 말고 앞으로'
      },
      {
        name: '풀드 드롭(뒤로 밀린 상황)',
        method: '셔틀이 뒤에 있을 때 억지로 내리지 않고 살짝 끌어서 앞쪽으로. 상대 공격을 막는 안전한 선택입니다.',
        sets: vol('회', [8, 10, 12, 12, 15, 15, 15], [2, 3, 3, 3, 4, 4, 4]),
        point: '어깨에 힘 빼고 팔로 끌어내리기'
      }
    ],
    '클리어': [
      {
        name: '하이클리어 깊이',
        method: '백코트 끝 라인을 목표로 최대한 깊게. 파트너는 위치만 확인해 주세요.',
        sets: vol('회', [15, 20, 20, 25, 25, 30, 30], [3, 3, 4, 4, 4, 4, 4]),
        point: '임팩트 후 팔을 끝까지 뻗어 마무리'
      },
      {
        name: '백핸드 클리어',
        method: '백핸드로도 코트 끝까지. 처음엔 절반 코트부터, 익숙해지면 풀코트.',
        sets: vol('회', [8, 10, 12, 15, 15, 20, 20], [3, 3, 4, 4, 4, 4, 4]),
        point: '팔 힘 대신 몸통 회전과 짧은 그립'
      },
      {
        name: '클리어 → 수비 연결',
        method: '클리어를 올린 뒤 상대 공격을 받는 수비 자세로 바로 전환합니다.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 15], [3, 3, 3, 4, 4, 4, 4]),
        point: '클리어 후 센터 복귀, 라켓은 가슴 높이에'
      },
      {
        name: '공격적 클리어(플랫)',
        method: '일부러 낮고 빠르게 올려 상대 백스윙 시간을 줄입니다. B조 이상에서 상대 리듬을 끊는 카드로 씁니다.',
        sets: vol('회', [6, 8, 10, 10, 12, 15, 15], [2, 2, 3, 3, 4, 4, 4]),
        point: '상대 머리 위를 지나되 내려앉지 않게'
      }
    ],
    '스매시': [
      {
        name: '스매시 임팩트 반복',
        method: '높은 타점에 정확히 맞히는 연습만 따로 합니다. 손(또는 콕)을 높이 든 채 진행.',
        sets: vol('회', [10, 15, 15, 20, 20, 25, 25], [3, 3, 3, 3, 4, 4, 4]),
        point: '팔꿈치를 먼저 올리고 손목은 마지막에'
      },
      {
        name: '점프 스매시 착지 밸런스',
        method: '점프 후 착지에서 1초 버티기까지 한 동작. 무릎과 발목 상해 예방에 가장 중요한 부분입니다.',
        sets: vol('회', [6, 8, 8, 10, 10, 12, 12], [3, 3, 3, 3, 4, 4, 4]),
        point: '착지 후 흔들리지 않게, 무릎은 부드럽게'
      },
      {
        name: '스매시 좌우 코스',
        method: '같은 위치에서 좌우로 갈라 보내 상대 수비를 흔듭니다. 복식에서는 중앙·스트레이트가 우선.',
        sets: vol('분', [1, 2, 2, 2, 3, 3, 3], [2, 3, 4, 4, 4, 4, 4]),
        point: '몸 방향으로 코스를 만들기'
      },
      {
        name: '연속 스매시 → 앞 전진',
        method: '스매시 2개 뒤 네트 앞으로 따라 들어가는 공격 로테이션. 상대가 짧게 리프트할 때 바로 결정합니다. (BWF 복식 후위 공격 응용)',
        sets: vol('랠리', [4, 6, 6, 8, 8, 10, 10], [2, 3, 3, 4, 4, 4, 4]),
        point: '내려찍은 뒤 멈추지 말고 2보 전진'
      }
    ],
    '풋워크': [
      {
        name: '육각 풋워크',
        method: '중앙에서 6방향으로 나갔다 오는 스텝. 30초 하고 30초 쉽니다. 매번 출발은 스플릿 스텝에서 시작하세요.',
        sets: vol('초', [20, 25, 30, 35, 40, 45, 50], [4, 4, 5, 5, 6, 6, 7]),
        point: '앞꿈치로 딛고 소리 나지 않게'
      },
      {
        name: '스플릿스텝 타이밍',
        method: '상대가 치는 순간 발이 땅에서 살짝 떠 있다가 내려오게. 2023 BWF 세계선수권 남자단식 Top 4 연구에서 반응시간(상대 타구 → 첫 발)은 ' + rng(SPLIT_STEP.reactionSec, '초') + ', 스탠스 폭은 신장의 약 50%(' + rng(SPLIT_STEP.stanceHeightRatio) + '배)였습니다. BWF 매뉴얼의 무브먼트 사이클 시작 단계입니다.',
        sets: vol('회', [10, 15, 20, 20, 25, 25, 30], [3, 3, 3, 4, 4, 4, 4]),
        point: '상대 라켓을 보고 발은 먼저 — 스탠스는 어깨보다 넓게(신장의 절반)'
      },
      {
        name: '베이스 복귀 스플릿스텝',
        method: '코트 중앙(베이스)으로 돌아온 뒤 곧바로 스플릿 스텝. 상위 선수들은 베이스에서 평균 ' + rng(SPLIT_STEP.baseRadiusCm, 'cm') + ' 거리에 자리를 잡고 다음 샷을 기다렸습니다. 파트너가 네 방향으로 셔틀을 보내면 복귀 → 스플릿 → 첫 발까지 끊김 없이 이어 갑니다.',
        sets: vol('회', [8, 10, 12, 15, 15, 20, 20], [2, 3, 3, 4, 4, 4, 4]),
        point: '복귀는 베이스 근처(50cm 안팎), 스플릿은 상대 타구 순간'
      },
      {
        name: '섀도 배드민턴 6방향',
        method: '라켓 없이도 좋습니다. 각 방향으로 나가 스윙 동작까지 하고 복귀합니다.',
        sets: vol('분', [1, 1, 1, 2, 2, 2, 2], [2, 3, 3, 4, 4, 4, 4]),
        point: '나가기 전에 스플릿스텝 먼저'
      },
      {
        name: '전후 스텝 사다리',
        method: '앞뒤로 빠르게 오가는 스텝으로 코트 길이 감각을 만듭니다.',
        sets: vol('회', [10, 15, 15, 20, 20, 25, 25], [3, 3, 3, 3, 4, 4, 4]),
        point: '상체 세우고 발만 빠르게'
      }
    ],
    '서브': [
      {
        name: '숏서브 네트 낮게',
        method: '네트 위 10cm 안으로 떨어지는 숏서브 반복. 복식에서는 T자 부근이 기본 목표입니다. 국내 국가대표 남자복식 분석에서 몸쪽 서브가 ' + rng(DOUBLES_SERVE.bodyPct, '%') + '로 몰린 조는 서브 실점이 ' + rng(DOUBLES_SERVE.lossPct, '%') + '까지 올랐으니, 같은 자세에서 직선·대각을 섞으세요.',
        sets: vol('회', [15, 20, 20, 25, 25, 30, 30], [3, 3, 3, 4, 4, 4, 4]),
        point: '셔틀을 떨어뜨리지 말고 라켓 면으로 밀기'
      },
      {
        name: '롱서브/플릭서브 깊이',
        method: '백코트 끝까지 길게 보내는 서브. 단식에서 낮은 서브를 계속 쓰다가 한 번씩 섞으면 리시브 타이밍을 흔듭니다.',
        sets: vol('회', [6, 10, 10, 12, 12, 15, 15], [3, 3, 3, 4, 4, 4, 4]),
        point: '허리 회전으로 힘 만들기 (팔로 치지 않기)'
      },
      {
        name: '서브 → 3구 연결',
        method: '서브 → 상대 리시브 → 내 3구째까지 정해진 패턴을 반복합니다. 복식 기본은 숏서브 후 전위가 네트를 지키는 것.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 15], [2, 3, 3, 4, 4, 4, 4]),
        point: '서브 후 손을 내리지 말고 라켓 들고 준비'
      },
      {
        name: '서브 코스 압박',
        method: '중앙·몸쪽·바깥쪽으로 조금씩 바꿔 리시버의 선 자세를 흔듭니다. 몸쪽은 강하지만 단독으로 쓰면 읽힙니다 — 직선 ' + rng(DOUBLES_SERVE.straightPct, '%') + '·대각 ' + rng(DOUBLES_SERVE.crossPct, '%') + '도 같은 비중으로 섞어야 하고, 넓게 주는 서브는 리스크가 크다는 점을 기억하세요.',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 25], [2, 2, 3, 3, 3, 4, 4]),
        point: '같은 자세로 세 방향 — 몸쪽만 반복하지 않기'
      }
    ],
    '리시브': [
      {
        name: '리시브 반응 훈련',
        method: '파트너가 신호를 주면 바로 리시브로 반응하는 연습.',
        sets: vol('회', [15, 20, 20, 25, 25, 30, 30], [3, 3, 3, 4, 4, 4, 4]),
        point: '라켓 들고 무릎 굽힌 준비 자세'
      },
      {
        name: '서브 리시브 코스',
        method: '상대 서브를 헤어핀·드라이브·푸시로 받아냅니다. 복식은 네트 앞을 먼저 차지하는 리시브가 가장 좋습니다. 국내 국가대표 복식 분석에서 리시브 기술이 숏 드라이브 ' + rng(DOUBLES_RECEIVE.shortDrivePct, '%') + '·드라이브 ' + rng(DOUBLES_RECEIVE.drivePct, '%') + '·헤어핀 ' + rng(DOUBLES_RECEIVE.hairpinPct, '%') + '에 몰렸으니 한 구질만 반복하지 마세요.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 12], [3, 3, 3, 4, 4, 4, 4]),
        point: '서브 오기 전에 받을 곳 정해두기'
      },
      {
        name: '리시브 구질 3종 전환',
        method: '같은 서브에 헤어핀·숏 드라이브·드라이브를 번갈아 받습니다. 상대 서브 코스(몸쪽·직선·대각)마다 받는 구질을 정해 두면 리시브 실점이 줄어듭니다. 코스는 중앙·대각·직선을 골고루 섞어요.',
        sets: vol('랠리', [6, 8, 10, 12, 12, 15, 15], [2, 3, 3, 4, 4, 4, 4]),
        point: '서브 오기 전에 구질과 코스를 먼저 결정'
      },
      {
        name: '빠른 드라이브 리시브',
        method: '빠른 드라이브를 받아내며 라켓 면만으로 방향 바꾸기.',
        sets: vol('분', [1, 1, 1, 2, 2, 2, 2], [3, 3, 4, 4, 4, 4, 5]),
        point: '스윙 줄이고 타이밍으로'
      },
      {
        name: '리시브에서 공격 전환(4구)',
        method: '리시브 → 상대 리턴 → 내 3구 → 4구 공격까지. 리시브 팀이 4구 안에 아래로 만드는 것이 목표입니다. (BWF 복식 3·4구 보너스 게임 방식)',
        sets: vol('랠리', [4, 6, 6, 8, 8, 10, 10], [2, 3, 3, 3, 4, 4, 4]),
        point: '4구째까지 반드시 공격으로'
      }
    ],
    '수비': [
      {
        name: '좌우 수비 블록',
        method: '스매시를 블록으로 되받아 네트 앞으로. 좌우로 흔들리며 자세가 무너지지 않게.',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 25], [3, 3, 3, 4, 4, 4, 4]),
        point: '라켓을 낮게, 손목 받침으로'
      },
      {
        name: '드라이브 카운터',
        method: '스매시를 드라이브로 받아 바로 공격권을 되찾습니다. 힘보다 코스.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 15], [2, 3, 3, 4, 4, 4, 4]),
        point: '상대 몸쪽이나 빈 곳으로'
      },
      {
        name: '수비 → 로테이션',
        method: '블록/드라이브 후 앞으로 나가 네트를 차지하는 2단 전환. 파트너와 좌우→전후로 바뀌는 연습입니다.',
        sets: vol('랠리', [4, 6, 8, 8, 10, 10, 12], [2, 2, 3, 3, 4, 4, 4]),
        point: '받은 사람이 앞으로, 파트너는 반대쪽 뒤로'
      },
      {
        name: '한 발 수비(리치)',
        method: '넓게 벌린 좌우 수비에서 한 발만 내디뎌 받는 연습. 발목·무릎 부담을 줄이는 정확한 런지가 핵심.',
        sets: vol('회', [10, 10, 12, 15, 15, 20, 20], [2, 3, 3, 3, 4, 4, 4]),
        point: '무릎이 안쪽으로 무너지지 않게'
      }
    ],
    '네트': [
      {
        name: '네트 킬 정확도',
        method: '높게 뜬 셔틀을 아래로 찍어 마무리. 힘 조절이 핵심(강한 킬은 아웃이 늘어납니다).',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 25], [2, 3, 3, 3, 4, 4, 4]),
        point: '팔꿈치 앞에서 짧게, 라켓 면만'
      },
      {
        name: '네트 앞 푸시',
        method: '네트에서 밀어 상대 미드코트 빈 곳으로. 복식에서 리프트 대신 쓰는 공격적 선택입니다.',
        sets: vol('회', [10, 12, 15, 15, 20, 20, 20], [2, 3, 3, 4, 4, 4, 4]),
        point: '라켓을 세우고 앞으로 밀기'
      },
      {
        name: '전위 네트 커버',
        method: '파트너가 뒤에서 공격할 때 전위가 네트를 지키며 좌우로 따라 움직입니다. 채널 어택(공격 방향 쪽으로 붙기) 연습.',
        sets: vol('분', [1, 1, 2, 2, 2, 3, 3], [2, 3, 3, 3, 4, 4, 4]),
        point: '라켓은 네트 높이, 발은 살짝 뜨게'
      }
    ],
    '로테이션': [
      {
        name: '좌우 ↔ 전후 전환',
        method: '리프트가 뜨면 좌우(수비), 공격이 시작되면 전후(공격)로 바뀌는 기본 약속을 반복합니다. BWF·배드민턴잉글랜드가 모두 강조하는 복식의 기본형입니다.',
        sets: vol('회', [8, 10, 12, 15, 15, 20, 20], [2, 3, 3, 3, 4, 4, 4]),
        point: '셔틀 높이를 보고 둘이 동시에 움직이기'
      },
      {
        name: '공격 후 따라 들어가기',
        method: '뒤에서 스매시한 사람이 앞으로 들어가고, 전위가 반대쪽으로 비켜주는 로테이션.',
        sets: vol('랠리', [4, 6, 6, 8, 8, 10, 10], [2, 3, 3, 3, 4, 4, 4]),
        point: '파트너가 비켜줄 공간을 먼저 만들기'
      },
      {
        name: '수비 리프트 코스 규칙',
        method: '스트레이트 공격에는 크로스 리프트, 크로스 공격에는 스트레이트 리프트로 상대를 흔드는 규칙을 정해 랠리합니다.',
        sets: vol('랠리', [4, 6, 8, 8, 10, 10, 12], [2, 2, 3, 3, 3, 4, 4]),
        point: '받은 방향 반대로 올리기'
      }
    ]
  };

  var BASICS = [
    {
      name: '기본 스트록 10분',
      method: '클리어·드롭·스매시를 20개씩. 오늘 컨디션에 맞춰 강도만 조절하세요.',
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

  /* ---------- 급수별 플랜 ----------
   * 같은 드릴이라도 급수에 따라 목표·횟수·게임 형식이 달라야 합니다.
   * (BWF Level 1 Module 3의 '단순→복잡, 느림→빠름, 예측→비예측' 진행 원칙) */
  var GRADE_PLANS = {
    '초심': {
      focus: '기본 스트록 모양과 발 디딤',
      volume: '주 2회 · 회당 60~70분 (게임은 7점 단축)',
      rules: [
        '클리어·드롭·헤어핀을 한 번에 하나씩, 폼이 무너지면 개수를 줄이기',
        '풋워크는 6방향을 천천히, 소리 나지 않게',
        '게임은 5~7점 단축으로 자주, 랠리 10개 목표'
      ]
    },
    'D조': {
      focus: '리시브 안정 + 헤어핀/리프트 선택',
      volume: '주 2~3회 · 회당 70~80분 (게임 11점)',
      rules: [
        '서브는 숏서브 위주, 네트 위 10cm 목표',
        '헤어핀과 리프트를 미리 정하고 치기',
        '한 번에 20개씩 끊어 정확도 기록하기'
      ]
    },
    'C조': {
      focus: '드라이브 싸움 + 복식 좌우/전후 전환',
      volume: '주 3회 · 회당 90분',
      rules: [
        '드라이브 3구 안에 공격으로 바꾸기',
        '리프트가 뜨면 둘이 동시에 좌우 수비로',
        '복식 서브는 몸쪽만 반복하지 말고 직선·대각을 같은 자세로 섞기',
        '주 1회는 21점제 실전 2경기'
      ]
    },
    'B조': {
      focus: '공격 전환 속도와 코스',
      volume: '주 3~4회 · 회당 95~105분',
      rules: [
        '스매시 후 2보 전진 로테이션 반복',
        '수비에서는 블록·드라이브로 공격권 되찾기',
        '상대 약점(백핸드 뒤, 몸쪽) 한 곳을 정해 공략'
      ]
    },
    'A조': {
      focus: '3구 패턴과 결정구',
      volume: '주 4회 · 회당 110분 + 웨이트 2회',
      rules: [
        '서브·리시브 3~4구 패턴을 세트로 정해 두기',
        '드라이브 싸움에서 방향을 미리 숨기기',
        '스플릿 스텝은 상대 타구 순간 — 복귀는 베이스 근처(50cm 안팎), 스탠스는 신장의 절반',
        '연속 스매시 뒤 네트 마무리까지 한 흐름으로'
      ]
    },
    '선수부': {
      focus: '전술 운용 + 체력 배분',
      volume: '주 5~6회 · 회당 120분 (세트 플레이 포함)',
      rules: [
        '상대 유형별 플랜 A/B를 경기 전에 정하기',
        '3세트 대비 인터벌(30초~1분) 훈련 포함',
        '훈련 후 냉각·스트레칭 15분은 생략하지 않기'
      ]
    },
    '자강': {
      focus: '경기 운영과 결정력',
      volume: '주 5~6회 · 회당 120분+ (경기·분석 포함)',
      rules: [
        '경기 영상/기록으로 실점 패턴 3개만 뽑아 교정',
        '결정구 1개를 정해 압박 상황에서도 쓰기',
        '주 1회는 완전 휴식 또는 가벼운 회복 세션'
      ]
    }
  };

  /* ---------- 전술 노트 ----------
   * 종목별로 실제 경기에서 바로 쓰는 3구 패턴·로테이션·드라이브 싸움.
   * [BWF1] Module 8, [BE1] 복식 포메이션을 한국 코트 용어로 정리했습니다. */
  var TACTICS = {
    '단식': [
      '서브는 낮게 중앙으로(각도 줄이기), 가끔 플릭으로 타이밍 흔들기 (BWF 단식 서브)',
      '리시브는 네트 앞으로 받아 리프트를 유도한 뒤 공격, 낮게 오면 리프트로 뒤 코너에 깊게',
      '상대를 백핸드 후위로 길게 밀면 체공 시간이 벌어져 내가 베이스로 돌아와 스플릿 스텝을 준비할 시간이 생깁니다 — 뒤로 몰린 상대에게 백핸드 후위를 한 번 더',
      '중립 상황은 스트레이트 위주로 안전하게, 상대가 회복을 못 하면 긴 대각선으로 이동시키기',
      '공격 기회(짧은 리프트)에는 빠르게 뒤로 들어가 아래로, 압박이 세면 베이스를 앞으로',
      '뒤로 밀렸을 때는 억지 스매시보다 깊은 클리어·풀드 드롭으로 랠리 재정비'
    ],
    '복식': [
      '숏서브는 T자 부근, 서브 후 전위는 네트를 지키고 후위는 미드/후방 커버 (BWF 복식 서브). 몸쪽만 반복하면 읽힙니다 — 국내 국가대표 분석에서 몸쪽 서브 ' + rng(DOUBLES_SERVE.bodyPct, '%') + '인 조의 서브 실점이 ' + rng(DOUBLES_SERVE.lossPct, '%') + '였습니다',
      '리시브는 네트 앞으로 차지하기. 숏 드라이브 ' + rng(DOUBLES_RECEIVE.shortDrivePct, '%') + '·드라이브 ' + rng(DOUBLES_RECEIVE.drivePct, '%') + '·헤어핀 ' + rng(DOUBLES_RECEIVE.hairpinPct, '%') + '에 몰리지 말고 구질·코스(중앙/대각/직선)를 섞기',
      '공격은 전후(공격) / 수비는 좌우(수비). 셔틀 높이를 보고 둘이 동시에 바꾸기',
      '전위는 공격 방향 쪽으로 붙는 채널 어택 — 스트레이트·중앙 공격으로 2대1 만들기',
      '수비에서는 블록·드라이브로 앞으로 나가 주도권 회수, 리프트는 스트레이트 공격엔 크로스로',
      '드라이브 싸움에서는 중앙(두 선수 사이)과 몸쪽을 먼저 겨냥'
    ],
    '혼합복식': [
      '여성 선수는 전위·미드, 남성 선수는 미드·후위를 맡아 전위에서 결정하는 구조 (BWF 혼합복식)',
      '남성 서브 시 여성은 네트 옆에 붙어 리턴 커버, 여성 서브 시 남성은 중앙에서 대기',
      '여성 리시브는 네트로 붙어 전위 장악, 남성 리시브는 뒤로 밀어 공격 준비',
      '상대 여성 선수 쪽으로 공격을 몰아 전위 우위를 만들기'
    ]
  };

  /* ---------- 워밍업 / 정리운동 ----------
   * [PHOM25] PreventiBad(청소년 배드민턴 예방 워밍업)가 부상을 70% 줄인 RCT,
   * [BWF1] Module 9의 워밍업·쿨다운 원칙을 10~15분으로 압축했습니다. */
  var WARMUP = [
    '가벼운 조깅 2분 + 팔·어깨 돌리기(앞뒤 10회씩)',
    '동적 스트레칭: 다리 앞뒤 흔들기, 런지 워크 10보, 발목 돌리기 10회씩',
    '스플릿스텝 리듬 20회 + 사이드 스텝 10m 왕복 2회',
    '셔틀 랠리 3분(클리어→드롭→드라이브 순서로 강도 올리기)',
    '점프 착지 5회(무릎 부드럽게, 상체 살짝 앞으로) — 점프 많은 날은 필수',
    '마무리: 30초 이상 천천히 걷기 + 종아리·햄스트링·어깨 스트레칭 각 30초'
  ];

  /* ---------- 근거 기반 부상 예방 워밍업 ----------
   * [PHOM25] PreventiBad RCT(유소년 273명·8주)에서 부상 70% 감소(IRR 0.30, 4.07→1.23건/1,000시간).
   * [MARC24]·[PENG25] 하체 부상 52.15%, 방향 전환 시 발목 염좌 23.5%·슬개건병증 20.3%,
   *          우세측 어깨 25.5%, 준비운동 빈도 ↑ → 부상 ↓(ρ = -0.273, p < 0.001).
   * 그래서 통증 부위에 맞는 신경근 항목을 고르고, 없으면 하체 기본(발목·무릎)으로 잡습니다. */
  var PREVENT = {
    lowerBodyPct: 52.15,        /* [MARC24] 하체 부상 비중 */
    sprainPct: 36.06,           /* [MARC24] 염좌 비중 */
    ankleSprainPct: 23.5,       /* [PENG25] 발목 염좌 */
    patellarPct: 20.3,          /* [PENG25] 슬개건병증 */
    shoulderPct: 25.5,          /* [PENG25] 우세측 어깨 */
    warmupRho: -0.273,          /* [PENG25] 준비운동 빈도 ↔ 부상 빈도 (Spearman) */
    preventiBadPct: 70,         /* [PHOM25] 부상 감소율 */
    controlPer1000h: 4.07,
    programPer1000h: 1.23,
    irr: 0.30
  };
  var PREVENT_SRC = 'Phomsoupha et al., J Sports Sci 43(5):440-447, 2025 (PreventiBad, DOI 10.1080/02640414.2025.2461931) · ' +
    'Marchena-Rodríguez et al., Res Sports Med, 2024 (DOI 10.1080/15438627.2024.2351964) · ' +
    'Pengked et al., Electron J Gen Med 22(1):em629, 2025 (DOI 10.29333/ejgm/15917)';
  var PREVENT_SRC_SHORT = 'Phomsoupha 2025 J Sports Sci (부상 70%↓) · Marchena-Rodríguez 2024 Res Sports Med · Pengked 2025 EJGM';

  /* 워밍업 항목 — 부위별 1개씩, 이름은 짧게·방법은 한 줄로 */
  var WARM_ITEMS = {
    base: {
      name: '전신 동적 예열', area: '전신', min: 2,
      how: '다리 앞뒤 흔들기 10회씩 · 런지 워크 6보 · 팔·어깨 원 그리기 10회'
    },
    '발목': {
      name: '발목 고유수용감각', area: '발목', min: 2,
      how: '한 발 서기 30초 × 2, 눈 감고 15초 × 2 — 접질림은 방향 전환에서 가장 많아요(발목 염좌 23.5%)'
    },
    '무릎': {
      name: '한 발 착지 · 감속 런지', area: '무릎', min: 2,
      how: '가볍게 뛰어 한 발 착지 후 3초 버티기 좌우 5회 + 앞 런지 후 2초 정지 5회(슬개건병증 20.3%)'
    },
    '어깨': {
      name: '밴드 외회전 · 견갑 안정', area: '어깨', min: 2,
      how: '탄성밴드 외회전 15회 × 2 + 월 슬라이드 10회 × 2 — 우세측 어깨 부상이 25.5%예요'
    },
    '팔꿈치': {
      name: '전완·손목 예열', area: '팔꿈치', min: 2,
      how: '손목 굽히기·펴기 10회씩 + 가벼운 편심 손목 신전 15회 — 그립 힘은 빼고 가볍게'
    },
    '손목': {
      name: '손목 가동범위', area: '손목', min: 2,
      how: '손목 원 그리기 양방향 10회씩 + 손목 앞뒤 20초 × 2, 라켓을 쥔 채로 가볍게'
    },
    '허리': {
      name: '힙힌지 · 흉추 회전', area: '허리', min: 2,
      how: '고양이-소 10회 + 힙힌지 10회 + 흉추 회전 좌우 8회 — 허리를 굽혀 숙이지 않기'
    },
    '목': {
      name: '턱 당기기 · 흉추 풀기', area: '목', min: 2,
      how: '턱 당기기 10회 × 2 + 고개 천천히 좌우 10초씩 + 어깨 뒤로 모으기 10회'
    },
    '아킬레스건': {
      name: '종아리 · 발목 예열', area: '아킬레스건', min: 2,
      how: '벽 짚고 종아리 스트레칭 20초 × 2(무릎 펴고/굽히고) + 발목 돌리기 10회씩 — 아침 첫발이 뻣뻣하면 특히'
    }
  };

  /* 종목에 맞는 마지막 1분 — 코트 동작을 미리 한 번 돌립니다 */
  function warmClose(discipline) {
    var key = disciplineKey(discipline);
    if (key === '단식') {
      return {
        name: '코트 동작 예열', area: '종목', min: 2,
        how: '전·후위 코너 8~12초 셔틀 10구 — 단식은 앞뒤 이동 비중이 커서 다리 예열이 곧 경기력입니다'
      };
    }
    return {
      name: '코트 동작 예열', area: '종목', min: 2,
      how: '전위 연타·좌우 드라이브 10구 — 복식은 짧은 랠리를 자주 치니 발목·손목을 미리 깨워 두세요'
    };
  }

  /* preventionWarmup(painList, discipline)
   *   → 코트 들어가기 전 8분 · 항목 4개(전신 예열 → 통증 부위 2개 → 종목 예열)
   * 통증이 없으면 발목·무릎(하체 기본)으로 채웁니다. 같은 입력이면 같은 결과. */
  function preventionWarmup(painList, discipline) {
    var pains = (painList || []).filter(function (p) { return p && WARM_ITEMS[p]; });
    var picked = [], used = {};
    pains.forEach(function (p) {
      if (picked.length >= 2 || used[p]) return;
      used[p] = 1;
      picked.push(p);
    });
    /* 하체 부상이 전체의 52.15% — 부족한 자리는 발목 → 무릎 순서로 */
    ['발목', '무릎'].forEach(function (p) {
      if (picked.length >= 2 || used[p]) return;
      used[p] = 1;
      picked.push(p);
    });

    var items = [WARM_ITEMS.base];
    picked.slice(0, 2).forEach(function (p) { items.push(WARM_ITEMS[p]); });
    items.push(warmClose(discipline));

    var minutes = 0;
    var out = items.map(function (it) {
      minutes += it.min;
      return { name: it.name, how: it.how, area: it.area, min: it.min };
    });

    var areas = picked.slice(0, 2);
    var reason;
    if (pains.length) {
      var lower = areas.some(function (a) { return a === '발목' || a === '무릎' || a === '아킬레스건'; });
      var upper = areas.some(function (a) { return a === '어깨' || a === '팔꿈치' || a === '손목'; });
      reason = areas.join('·') + ' 준비를 넣었어요. ' +
        (lower ? '방향 전환에서 발목 염좌(' + PREVENT.ankleSprainPct + '%)·슬개건병증(' + PREVENT.patellarPct +
          '%)이 나고 부상의 ' + PREVENT.lowerBodyPct + '%가 하체입니다. ' : '') +
        (upper ? '우세측 어깨 부상이 ' + PREVENT.shoulderPct + '%입니다. ' : '') +
        '준비운동을 자주 할수록 부상이 적었어요(ρ = ' + PREVENT.warmupRho + ', p < 0.001).';
    } else {
      reason = '오늘 통증이 없어 하체 기본으로 잡았어요. 부상의 ' + PREVENT.lowerBodyPct + '%가 하체이고, ' +
        '8주 예방 워밍업으로 부상이 ' + PREVENT.preventiBadPct + '% 줄었습니다(' + PREVENT.controlPer1000h + ' → ' +
        PREVENT.programPer1000h + '건/1,000시간).';
    }
    return {
      title: '코트 전 예방 워밍업',
      minutes: minutes,
      label: minutes + '분',
      areas: areas,
      items: out,
      reason: reason,
      source: PREVENT_SRC,
      sourceShort: PREVENT_SRC_SHORT,
      stats: PREVENT
    };
  }

  /* ---------- 단식 vs 복식 부하·인터벌 기준 ----------
   * [ALC09] 단식 88.8%/96.8% vs 복식 75.5%/89.0% HRmax, 게임당 593.8 vs 314.5보.
   * [HOFF24] 남자복식·혼합복식 최단 랠리(5.6~6.7초)·최고 타구 빈도, 여자복식 최장 랠리(약 10.1초).
   * [SANT25] 단식이 체중 보정 외부 작업량·파워가 큼(ES 0.44 / 최상위급 0.88) → 근력·회복 관리. */
  var LOAD_STATS = {
    hrMeanSingles: 88.8, hrPeakSingles: 96.8,
    hrMeanDoubles: 75.5, hrPeakDoubles: 89.0,
    stepsSingles: 593.8, stepsDoubles: 314.5,
    singlesWorkES: 0.44, eliteWorkES: 0.88,
    mdRallySec: [5.6, 6.7], wdRallySec: 10.1
  };
  var LOAD_SRC = 'Alcock & Cable, Int J Perform Anal Sport 9(2):228-237, 2009 (DOI 10.1080/24748668.2009.11868479) · ' +
    'Hoffmann et al., Int J Perform Anal Sport, 2024 (DOI 10.1080/24748668.2024.2386830) · ' +
    'Santiano et al., J Sports Sci 43(12):1158-1166, 2025 (DOI: 10.1080/02640414.2025.2489863)';
  var LOAD_SRC_SHORT = 'Alcock & Cable 2009 Int J Perform Anal Sport · Hoffmann 2024 · Santiano 2025 J Sports Sci';

  var LOAD_GUIDE = {
    '단식': {
      rally: '8~12초 (전·후위 코너)',
      workRest: '1:2 — 8~12초 랠리 뒤 16~24초 회복',
      drill: '전후 코너 멀티셔틀 8~12초',
      heart: '평균 88.8% · 최고 96.8% HRmax (복식 75.5% · 89.0%)',
      steps: '게임당 593.8보 (복식 314.5보)',
      tips: [
        '단식은 체중 보정 기계적 작업량·파워가 복식보다 큽니다(ES 0.44, 최상위급 0.88) — 주 2회 하체 근력과 회복을 같이 챙기세요.',
        '심박이 최고 96.8%까지 오릅니다. 세트 사이 60~90초는 줄이지 말고, 3세트째는 랠리 길이만 2초 줄이세요.'
      ]
    },
    '남자복식': {
      rally: '6~10초 (실전 평균 5.6~6.7초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '드라이브·전위 연타 멀티셔틀 6~10초',
      heart: '평균 75.5% · 최고 89.0% HRmax',
      steps: '게임당 314.5보',
      tips: [
        '남자복식·혼합복식은 랠리가 가장 짧고 타구 빈도가 가장 높습니다 — 길게 끌지 말고 6~10초 초고빈도로 치세요.',
        '짧은 랠리 사이 회복도 짧아 심박 변동이 큽니다. 세트 사이 45~60초를 지키고 3세트부터는 드라이브 비중을 줄이세요.'
      ]
    },
    '혼합복식': {
      rally: '6~10초 (실전 평균 5.6~6.7초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '전위 연타·중앙 드라이브 멀티셔틀 6~10초',
      heart: '평균 75.5% · 최고 89.0% HRmax',
      steps: '게임당 314.5보',
      tips: [
        '혼합복식은 남자복식과 함께 랠리가 가장 짧고 타구 빈도가 가장 높습니다 — 전위 연타 위주로 6~10초 반복하세요.',
        '남녀 역할이 나뉘니 남성은 후위 연속 공격, 여성은 전위 좌우 커버를 각각 세트로 나눠 부하를 맞추세요.'
      ]
    },
    '여자복식': {
      rally: '10~12초 (실전 평균 약 10.1초)',
      workRest: '1:1~1:1.5 — 10~12초 랠리 뒤 10~15초',
      drill: '지속 랠리 멀티셔틀 10~12초',
      heart: '평균 75.5% · 최고 89.0% HRmax (복식 기준)',
      steps: '게임당 314.5보 (복식 기준)',
      tips: [
        '여자복식은 랠리가 가장 길고 실제 경기시간 비율도 가장 높습니다 — 10~12초를 끊기지 않게 이어 가는 훈련이 맞습니다.',
        '랠리가 길어 실점이 천천히 쌓입니다. 세트 사이는 짧게 가져가되 3세트째에도 랠리 수를 줄이지 마세요.'
      ]
    },
    '복식': {
      rally: '6~10초 (남자복식·혼합복식 5.6~6.7초 · 여자복식 약 10.1초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '드라이브·전위 연타 멀티셔틀 6~10초',
      heart: '평균 75.5% · 최고 89.0% HRmax',
      steps: '게임당 314.5보',
      tips: [
        '복식은 짧은 랠리를 자주 칩니다 — 6~10초 고빈도로, 여자복식이면 10~12초로 늘려 지속력을 같이 챙기세요.',
        '세트 사이 45~60초를 지키고, 단식 겸업이면 단식 훈련 뒤에는 회복을 하루 더 두세요.'
      ]
    }
  };

  /* 급수별 반복 수 — 같은 기준이라도 구수는 급수에 맞춰 */
  var LOAD_REPS = {
    '단식': ['8~10구 × 2~3세트', '8~10구 × 3세트', '10~12구 × 3세트', '10~15구 × 3세트', '12~15구 × 4세트', '15구 × 4세트', '15구 × 4세트'],
    '남자복식': ['15구 × 2~3세트', '15구 × 3세트', '20구 × 3세트', '20~25구 × 3세트', '25구 × 4세트', '30구 × 4세트', '30구 × 4세트'],
    '혼합복식': ['15구 × 2~3세트', '15구 × 3세트', '20구 × 3세트', '20~25구 × 3세트', '25구 × 4세트', '30구 × 4세트', '30구 × 4세트'],
    '여자복식': ['12구 × 2~3세트', '12~15구 × 3세트', '15~20구 × 3세트', '20구 × 3세트', '20~25구 × 4세트', '25구 × 4세트', '25구 × 4세트'],
    '복식': ['15구 × 2~3세트', '15구 × 3세트', '20구 × 3세트', '20~25구 × 3세트', '25구 × 4세트', '30구 × 4세트', '30구 × 4세트']
  };

  function disciplineKey(discipline) {
    var s = String(discipline == null ? '' : discipline).replace(/\s+/g, '');
    if (!s) return '복식';
    if (s.indexOf('혼합') >= 0 || s.indexOf('혼복') >= 0) return '혼합복식';
    if (s.indexOf('여자') >= 0 || s.indexOf('여성') >= 0 || s.indexOf('여복') >= 0) return '여자복식';
    if (s.indexOf('남자') >= 0 || s.indexOf('남성') >= 0 || s.indexOf('남복') >= 0) return '남자복식';
    if (s.indexOf('단식') >= 0) return '단식';
    return '복식';
  }

  /* disciplineLoadGuide(discipline, level)
   *   → 주력 종목의 랠리 길이·일:휴식 비율·심박·멀티셔틀 기준을 급수에 맞춰 */
  function disciplineLoadGuide(discipline, level) {
    var key = disciplineKey(discipline);
    var box = LOAD_GUIDE[key] || LOAD_GUIDE['복식'];
    var tier = tierOf(level);
    var idx = tier >= 0 ? tier : 2;
    var reps = (LOAD_REPS[key] || LOAD_REPS['복식'])[idx];
    var levelNote = tier >= 0 && tier <= 1
      ? '급수가 낮을 때는 구수보다 정확한 스플릿 스텝·복귀부터'
      : tier >= 4
        ? '구수를 늘리되 세트 사이 회복 시간은 그대로 두세요'
        : '세트 수보다 랠리 길이를 지키는 게 먼저예요';
    return {
      discipline: key,
      label: key,
      rally: box.rally,
      workRest: box.workRest,
      drill: box.drill,
      reps: reps,
      heart: box.heart,
      steps: box.steps,
      tips: box.tips.slice(),
      levelNote: levelNote,
      source: LOAD_SRC,
      sourceShort: LOAD_SRC_SHORT,
      stats: LOAD_STATS
    };
  }

  /* ---------- 실전 선수 오프코트 루틴 ----------
   * 체전 1등 선수 현장 기준(사용자가 직접 관찰해 알려 준 루틴)을 일반화한 순서입니다.
   *   코트 날: 밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭
   *   웨이트 날: 가벼운 실내 자전거 20분(예열) → 스트레칭 → 본 웨이트 → 마무리 폼롤러 30분
   *   지구력: 무릎 착지 충격이 적은 실내 자전거 40분 빠르게
   * 실명은 쓰지 않고 '체전 1등 선수 현장 기준'으로만 부릅니다. */
  var OFFCOURT = {
    title: '실전 선수 오프코트 루틴',
    note: '체전 1등 선수 현장에서 굳어진 순서예요. 코트에 들어가기 전에 몸을 만들고, 끝나면 반드시 정리하고 나옵니다.',
    source: '체전 1등 선수 현장 루틴 기록(2026-11-20) · 스포츠의학 회복 원칙',
    court: {
      key: 'court',
      title: '코트 훈련 날',
      order: '밴드 보강 + 스트레칭 → 본운동 → 마무리 스트레칭',
      steps: [
        {
          name: '밴드 보강 + 스트레칭', min: 15,
          how: '어깨 밴드 외회전 · 발목 밴드 · 고관절 스트레칭으로 몸을 먼저 만듭니다. 코트에 들어가자마자 폼이 나오게 하는 단계예요.'
        },
        {
          name: '본운동 (코트 훈련)', min: 0,
          how: '랠리 · 드릴 · 게임은 계획한 볼륨대로. 자세가 무너지는 순간이 오면 세트 수를 먼저 줄입니다.'
        },
        {
          name: '마무리 스트레칭', min: 10,
          how: '허벅지 앞 · 뒤, 종아리, 가슴 · 어깨를 30초씩. 코트에서 바로 나오지 않고 여기서 끝내야 다음 날 다리가 가볍습니다.'
        }
      ]
    },
    weight: {
      key: 'weight',
      title: '웨이트 보강 날',
      order: '가벼운 실내 자전거 20분 → 스트레칭 → 본 웨이트 → 마무리 폼롤러 30분',
      steps: [
        {
          name: '가벼운 실내 자전거 20분', min: 20,
          how: '본 웨이트 전 예열. 무릎 · 고관절이 데워진 뒤에 무게를 잡습니다(찬 몸으로 시작하면 무릎이 먼저 아픕니다).'
        },
        {
          name: '스트레칭', min: 10,
          how: '고관절 · 햄스트링 · 가슴을 풀어 스쿼트와 벤치 자세를 먼저 만듭니다.'
        },
        {
          name: '본 웨이트', min: 50,
          how: '불가리안 스플릿 스쿼트(양손 덤벨 · 뒷발 받침대 · 뒷무릎이 바닥아래까지 깊이) → 스쿼트 → 레그 익스텐션 → 벤치프레스 → 턱걸이 순서로.',
          moves: ['불가리안 스플릿 스쿼트 (양손 덤벨 · 뒷발 받침대 · 뒷무릎 아래까지 깊게)', '스쿼트', '레그 익스텐션', '벤치프레스', '턱걸이']
        },
        {
          name: '마무리 폼롤러 30분', min: 30,
          how: '허벅지 앞 · 옆, 종아리, 등 · 어깨를 폼롤러로 30분 천천히. 근막 이완과 회복을 여기서 끝내고 나옵니다.'
        }
      ]
    },
    core: {
      title: '코어 · 허리 보강',
      when: '웨이트 날 본 웨이트 뒤에 3종, 코트 날은 바닥에서 1~2세트만',
      items: [
        {
          name: '행잉 레그 레이즈', sets: '20회 × 3세트',
          how: '철봉 · 바 위에 매달려 다리를 듭니다. 몸이 흔들리면 허리로 들지 말고 복압만 잡아 내려 주세요.'
        },
        {
          name: '다리 걸고 윗몸 · 복근 올리기', sets: '20회 × 3세트',
          how: '디클라인 벤치 · 다리를 고정하고 윗몸(복근)을 올립니다. 목이 아니라 배로 올라가는 느낌으로.'
        },
        {
          name: '백 익스텐션', sets: '15회 × 3세트',
          how: '다리를 고정하고 허리만 천천히 들었다 내립니다. 스매시 · 하이클리어 뒤 허리를 받쳐 주는 보강이에요.'
        }
      ]
    },
    endurance: {
      title: '무릎 충격 줄인 지구력',
      min: 40,
      how: '달리기 대신 실내 자전거 40분을 빠르게. 착지 충격이 적어 무릎이 예민한 주에도 지구력을 올릴 수 있습니다.',
      when: '코트 · 웨이트가 없는 날이나 주 1회 보강으로'
    }
  };

  /* offcourtRoutine(discipline)
   *   → 코트 훈련 날 · 웨이트 보강 날 순서 + 무릎 충격 줄인 지구력 보강
   * 같은 입력이면 같은 결과(순수 함수) — 카드가 다시 그려져도 흔들리지 않게 매번 새 객체로 돌려줍니다. */
  function offcourtRoutine(discipline) {
    var key = disciplineKey(discipline);
    function copyDay(d) {
      return {
        key: d.key, title: d.title, order: d.order,
        steps: d.steps.map(function (s) {
          var step = { name: s.name, min: s.min, how: s.how };
          if (s.moves) step.moves = s.moves.slice();
          return step;
        })
      };
    }
    var note = key === '단식'
      ? '단식은 앞뒤 이동이 많아 웨이트 날 하체(불가리안 스플릿 스쿼트 · 스쿼트) 비중을 조금 더 두세요.'
      : '복식은 짧은 랠리를 자주 치니 코트 날에도 밴드 보강과 폼롤러 회복을 빠뜨리지 마세요.';
    return {
      title: OFFCOURT.title,
      note: OFFCOURT.note,
      discipline: key,
      disciplineNote: note,
      days: [copyDay(OFFCOURT.court), copyDay(OFFCOURT.weight)],
      core: {
        title: OFFCOURT.core.title,
        when: OFFCOURT.core.when,
        items: OFFCOURT.core.items.map(function (it) {
          return { name: it.name, sets: it.sets, how: it.how };
        })
      },
      endurance: {
        title: OFFCOURT.endurance.title, min: OFFCOURT.endurance.min,
        how: OFFCOURT.endurance.how, when: OFFCOURT.endurance.when
      },
      summary: '코트 날 3단계 · 웨이트 날 4단계 · 코어 3종 · 자전거 40분',
      source: OFFCOURT.source
    };
  }

  /* ---------- 자기 강도 조절 (선수 본인이 브레이크를 잡는다) ----------
   * 열정으로 끝까지 밀어붙이다 자세가 무너지면 그게 부상으로 이어집니다.
   * 코치·앱이 대신 정해 주는 게 아니라, 선수 스스로 한 단계 낮추는 판단을 하도록 문장으로 짚어 줍니다. */
  var SELF_PACE = {
    label: '자기 강도 조절',
    rule: '강도는 결국 선수 본인이 조절해야 합니다. 열정으로 끝까지 밀어붙이다 자세가 깨지면 그게 부상의 시작이에요.',
    brake: '무리해서 끝까지 밀어붙이면 자세가 깨져 다칠 수 있으니, 오늘은 선수 스스로 강도를 한 단계 낮춰 폼과 회복을 챙기세요.',
    caution: '오늘은 자세가 무너지는 순간이 오면 세트를 줄이세요. 강도는 끝까지 올리는 게 아니라 다음 날 몸까지 보고 정하는 겁니다.',
    keep: '지금 컨디션이면 계획한 강도로 가도 됩니다. 한 세트라도 폼이 깨지면 그 자리에서 낮추는 건 선수 본인 몫이에요.'
  };

  /* paceGuide(cond, load, painList, streakDays, intensity)
   *   level: brake(오늘은 낮춰라) / caution(자세 깨지면 멈춰라) / keep(계획대로)
   * 기준: 컨디션 ≤ 2 · 주간 부하 급증(1.5배 이상) · 지난주보다 25% 이상 증가 ·
   *       통증 + 고강도(8 이상) · 5일 연속 훈련 + 고강도 */
  function paceGuide(cond, load, painList, streakDays, intensity) {
    var c = cond == null ? null : Number(cond);
    var i = intensity == null ? null : Number(intensity);
    var pains = (painList || []).filter(Boolean);
    var zone = (load && load.zone) || '';
    var ratio = (load && load.ratio) || 0;
    var change = (load && load.change) || 0;
    var streak = streakDays || 0;
    var reasons = [];

    if (c != null && c <= 2) reasons.push('컨디션 ' + c);
    else if (c != null && c <= 4) reasons.push('컨디션 ' + c + ' (회복 쪽)');
    if (zone === 'spike') reasons.push('주간 부하 ' + ratio + '배 급증');
    else if (zone === 'watch') reasons.push('주간 부하 ' + ratio + '배 (조금 높음)');
    if (zone && change >= 25) reasons.push('지난주보다 ' + change + '% 증가');
    if (pains.length) reasons.push('통증 ' + pains.slice(0, 2).join('·'));
    if (streak >= 5) reasons.push(streak + '일 연속 훈련');

    var brake = (c != null && c <= 2) || zone === 'spike' || (zone && change >= 25) ||
      (pains.length && i != null && i >= 8) || (streak >= 5 && i != null && i >= 8);
    var caution = !brake && ((c != null && c <= 4) || zone === 'watch' || pains.length ||
      streak >= 4 || (i != null && i >= 9));
    var level = brake ? 'brake' : caution ? 'caution' : 'keep';

    return {
      level: level,
      label: SELF_PACE.label,
      text: level === 'brake' ? SELF_PACE.brake : level === 'caution' ? SELF_PACE.caution : SELF_PACE.keep,
      rule: SELF_PACE.rule,
      reasons: reasons
    };
  }

  /* ---------- 부상별 기준 · 처방 ----------
   * signs: 병원에 가야 하는 신호 / rehab: 집에서 할 수 있는 관리 / stretch / ret: 복귀 수칙
   * 근거: [EHS24] 어깨, [YOUNG05]·[SILVA23] 무릎, [VRI16] 발목, [HEALTHY21]·[TRAV19] 아킬레스 */
  var INJURY = {
    '목': {
      signs: ['팔로 저리는 느낌이 내려가면 즉시 진료', '2주 이상 목 통증이 이어지면 진료'],
      rehab: ['목 주변 근육 긴장 시 20분 온찜질 후 가벼운 움직임', '스마트폰·장시간 고개 숙임 자세 줄이기'],
      stretch: ['턱 당기기 10회 × 2세트', '어깨 돌리기 10회씩 앞·뒤', '고개 천천히 좌우로 10초씩'],
      ret: ['스매시·클리어 개수를 절반으로 줄이고 3일간 경과 확인']
    },
    '어깨': {
      signs: ['팔을 60~120° 들어올릴 때 통증이 심하거나 밤에 아파서 깨면 충돌 의심', '팔을 들어 올리기 힘들어지면 진료'],
      rehab: [
        '오버헤드(스매시·클리어) 횟수를 오늘 하루 절반으로 줄이기',
        '밴드 외회전 15회 × 2세트, 주 3회 (6주면 통증·기능 개선 근거)',
        '통증 시 냉찜질 15분, 2주 이상 이어지면 정형외과 상담'
      ],
      stretch: ['가슴 문 열기 스트레칭 30초 × 2', '어깨 뒤쪽(슬리퍼) 스트레칭 30초 × 2', '어깨 원 그리기 10회씩'],
      ret: ['통증 3/10 이하에서 오버헤드 재개, 스매시 개수는 주당 20%씩만 늘리기']
    },
    '무릎': {
      signs: ['계단 내려가기·점프 착지에서 무릎 앞쪽 통증', '아침에 무릎이 뻣뻣하거나 붓기가 남으면 진료'],
      rehab: [
        '점프·계단·깊은 런지 횟수를 줄이고 무릎 주변 근육 먼저 강화',
        '하중은 20cm 스텝업 → 런지 → 한 발 내리기 순서로 단계 올리기',
        '붓기가 있으면 냉찜질 15분, 통증 지속 시 진료'
      ],
      stretch: ['대퇴사두근 스트레칭 30초 × 2', '종아리 스트레칭 30초 × 2', '엉덩이(가위) 스트레칭 30초 × 2'],
      ret: ['통증 5/10까지는 허용, 다음 날 아침에 원래 통증으로 돌아와야 함', '2주 이상 같은 통증이면 진료']
    },
    '허리': {
      signs: ['다리로 저림이 내려오면 즉시 진료', '허리를 펼 때 통증이 심하면 진료'],
      rehab: ['셔틀 주울 때 무릎 굽혀 앉기, 허리 굽힌 자세 금지', '스매시 후 허리 펴기 동작 줄이기'],
      stretch: ['고양이-소 자세 10회', '햄스트링 스트레칭 30초 × 2', '누워서 무릎 잡기 30초 × 2'],
      ret: ['통증이 3일 이상 이어지면 강도를 낮추고 진료 (국가대표 조사에서 허리 상해가 가장 흔함)']
    },
    '팔꿈치': {
      signs: ['악력이 떨어지거나 물건 들 때 통증이면 진료', '2주 이상 이어지면 진료'],
      rehab: ['그립 압력을 낮추고 팔 힘 빼고 치기', '테니스 엘보 밴드 사용 고려', '백핸드 손목 스냅 동작 줄이기'],
      stretch: ['손목 굽히기 스트레칭 20초 × 3', '편심 손목 신전 15회 × 2 (가벼운 덤벨/물병)'],
      ret: ['통증 없는 범위에서 그립부터 바꾸고, 스매시는 통증 2/10 이하에서 재개']
    },
    '손목': {
      signs: ['새끼손가락 쪽 손목 통증 + 회전 시 통증이면 TFCC 손상 의심', '붓거나 힘이 안 들어가면 진료'],
      rehab: ['라켓 그립 두께 확인(너무 굵으면 손목 부담)', '손목 스냅 과사용 줄이기', '통증 시 테이핑 또는 보호대'],
      stretch: ['손목 원 그리기 10회', '손목 앞뒤 굽히기 20초 × 3'],
      ret: ['테이핑 후 네트 플레이부터 재개, 스매시는 마지막에']
    },
    '아킬레스건': {
      signs: ['아침 첫 발걸음에 통증/뻣뻣함', '건 부위를 눌렀을 때 아프거나 붓기가 있으면 진료'],
      rehab: [
        '점프·급정지 동작 줄이기, 운동 전 워밍업 10분은 필수',
        '종아리 편심 운동 15회 × 3세트 하루 2회 (통증 5/10까지 허용)',
        '12주 정도 꾸준히 — 급하게 늘리면 재발합니다'
      ],
      stretch: ['벽 짚고 종아리 스트레칭 30초 × 3(무릎 펴고/굽히고)', '발목 돌리기 10회씩'],
      ret: ['통증 없는 범위에서 조깅 → 점프 순서로, 아침 통증이 없으면 강도 유지']
    },
    '발목': {
      signs: ['접질린 뒤 체중을 못 실으면 진료(골절 확인)', '반복해서 접질리면 진료'],
      rehab: ['한 발 서기 30초 × 3, 눈 감고 15초 × 2 (균형 훈련은 염좌 위험을 40% 줄임)', '접질린 뒤라면 보호대 착용 후 복귀'],
      stretch: ['발목 앞뒤로 굽히기 20초 × 3', '발가락 벌리기 10회'],
      ret: ['균형 훈련을 주 3회 유지, 붓기 없이 뛸 수 있으면 경기 복귀']
    }
  };

  var GENERIC_CARE = {
    rehab: ['훈련 후 10분은 정리 운동으로 마무리하기', '통증이 3일 이상 이어지면 진료를 권장'],
    stretch: ['햄스트링·종아리 스트레칭 30초 × 2', '고관절 스트레칭 30초 × 2', '어깨 돌리기 10회씩']
  };

  function setsFor(drill, level) {
    var sets = drill.sets || {};
    var g = gradeOf(level);
    if (g && sets[g]) return sets[g];
    var raw = String(level == null ? '' : level).trim();
    if (raw && sets[raw]) return sets[raw];
    var tier = g ? GRADE_TIER[g] : -1;
    if (tier >= 0) {
      var legacy = TIER_LEGACY[tier];
      if (sets[legacy]) return sets[legacy];
    }
    return sets[LEVEL_FALLBACK] || sets['일반부'] || '3세트';
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

  /* ---------- 여러 경기(21·25점제) 점수 흐름 ----------
   * 일지에 남긴 "최종 점수"만으로 읽을 수 있는 것만 말합니다.
   * 경기 중간 흐름(역전·연속 실점)은 기록이 없으므로 추측하지 않고 '가능성'으로만 씁니다.
   * [NA24] 국제대회 남자복식 233세트 — 후반 득점이 승패를 가른 주요 변인.
   * [PHOM15] 랠리 약 7초·휴식 약 15초(1:2) — 경기 사이 회복을 규칙적으로.
   * [PHOM20] 부상은 훈련 후반(48%)에 많고 피로로 힘·고유수용감각이 떨어질 때 늘어남. */
  function gameMode(games, explicit) {
    var m = Number(explicit);
    if (m === 21 || m === 25) return m;
    var seen = 0;
    (games || []).forEach(function (g) {
      var mm = Number(g && g.mode);
      if (!seen && (mm === 21 || mm === 25)) seen = mm;
    });
    return seen || 21;
  }

  /* 일지에서 고른 점수제(21·25) — 고른 값이 먼저, 없으면 가장 최근에 남긴 점수제를 잇습니다.
   * (예전에는 '이번 주 루틴'이 21점제로 고정돼 25점제로 치는 선수에게도 21점제를 권했습니다.) */
  function scoreModeOf(draft, records) {
    var m = Number(draft && draft.gameMode);
    if (m === 21 || m === 25) return m;
    var list = U.sortBy((records || []).filter(function (r) {
      return r && r.games && r.games.length;
    }), function (r) { return (r.date || '') + (r.createdAt || ''); }, true);
    if (list.length) {
      var g = list[0].games[0];
      var mm = Number(g && g.mode);
      if (mm === 21 || mm === 25) return mm;
    }
    return 21;
  }

  function gameFlow(games, explicitMode, discipline) {
    var list = [];
    (games || []).forEach(function (g) {
      if (!g) return;
      var a = Number(g.a), b = Number(g.b);
      if (!isFinite(a) || !isFinite(b)) return;
      list.push({ a: a, b: b });
    });
    var flow = {
      mode: gameMode(games, explicitMode), count: 0, wins: 0, losses: 0,
      avgMargin: 0, close: 0, deuce: 0, blowout: 0,
      firstMargin: 0, lastMargin: 0, fade: false, tips: []
    };
    if (!list.length) return flow;

    var mode = flow.mode;
    var margins = [], total = 0, close = 0, deuce = 0, blowout = 0;
    list.forEach(function (g) {
      var m = g.a - g.b;
      margins.push(m);
      total += Math.abs(m);
      if (Math.abs(m) <= 3) close++;
      if (Math.abs(m) <= 2 && Math.min(g.a, g.b) >= mode - 2) deuce++;
      if (Math.abs(m) >= 10) blowout++;
      var r = BM.domain.resultFromScore(g);
      if (r === '승') flow.wins++;
      else if (r === '패') flow.losses++;
    });
    flow.count = list.length;
    flow.avgMargin = Math.round((total / list.length) * 10) / 10;
    flow.close = close;
    flow.deuce = deuce;
    flow.blowout = blowout;
    flow.firstMargin = margins[0];
    flow.lastMargin = margins[margins.length - 1];
    /* 여러 경기를 치렀는데 마지막 경기에서 점수차가 5점 이상 더 벌어졌으면
     * '후반 체력/집중력' 신호로 봅니다. (점수만 보는 참고 신호) */
    flow.fade = list.length >= 2 && flow.lastMargin < 0 && (flow.lastMargin - flow.firstMargin) <= -5;
    flow.tips = flowTips(flow, discipline);
    return flow;
  }

  function signed(n) { return (n > 0 ? '+' : '') + n; }

  /* 점수 흐름에 대한 실전 문구 — 코치가 일지에 적어 주는 말투로 짧게 */
  function flowTips(flow, discipline) {
    var out = [];
    if (!flow || !flow.count) return out;
    var d = String(discipline || '').trim();
    var singles = d.indexOf('단식') >= 0;

    if (flow.mode === 25) {
      out.push('25점제는 21점제보다 4점 더 길어요. 중반(12~13점)에서 한 번 숨을 고르며 남은 전술을 정하고, 마지막 5점은 안전한 선택부터 하세요.');
    }
    if (flow.fade) {
      out.push('첫 경기 ' + signed(flow.firstMargin) + '점차 → 마지막 경기 ' + signed(flow.lastMargin) +
        '점차로 벌어졌어요. 여러 경기를 뛰는 날은 경기 사이 60~90초를 규칙적으로 쉬세요 — 물 조금, 앉기, 다리 올리기, 긴 날숨 6회.');
    }
    if (flow.deuce >= 1) {
      out.push('마지막 2~3점까지 간 경기가 ' + flow.deuce + '경기예요. ' +
        flow.mode + '점제는 막판 실수 하나가 세트를 바꿉니다. 마지막 3~4점에서는 새 기술을 꺼내지 말고, 서브는 숏서브로 고정하고 리시브는 네트 앞으로 붙이세요.');
    } else if (flow.close >= 2) {
      out.push('3점차 이내 접전이 ' + flow.close + '경기예요. 이길 때도 이긴 이유가 분명해야 다음에 또 이깁니다. 접전에서 통한 샷 하나를 적어 두세요.');
    }
    var blowoutLoss = flow.blowout > 0 && flow.losses > 0;
    if (blowoutLoss) {
      out.push('10점 이상 벌어진 경기가 있었어요. 초반 5점은 깊은 클리어·드라이브로 안전하게 가고, 흐름이 안 좋으면 랠리를 길게 끌지 말고 짧게 끝내는 쪽을 택하세요.');
    }
    if (!singles) {
      out.push('다음 경기에서는 서브 실점과 리시브 실점만 따로 세어 보세요. 국제대회 남자복식 분석에서도 이 두 가지가 승패를 가른 변인이었어요.');
    } else {
      out.push('11점 전·후로 실점을 나눠 적어 보세요. 후반에 실점이 몰리면 풋워크 피로를 먼저 의심하고, 경기 사이 회복 시간을 늘리세요.');
    }
    return out.slice(0, 3);
  }

  /* ---------- 주간 부하(내부 부하 = 운동 분 × 주관적 강도) ----------
   * 세션 RPE 방식(Foster 2001)으로 기록된 시간·강도를 그대로 곱해 씁니다.
   * [GABB16] 급성(최근 1주):만성(직전 4주 주당 평균) 0.8~1.3 = 참고 구간, 1.5 이상 = 급증.
   * [BMJ25] 부상의 40%가 직전 주 훈련부하 10% 이상 급증과 연관.
   * 진단이 아니라 '늘리는 속도'를 보는 참고 지표입니다. */
  function sessionLoad(r) {
    var m = Number(r && r.minutes);
    var i = Number(r && r.intensity);
    if (!isFinite(m) || m <= 0) return 0;
    if (!isFinite(i) || i <= 0) return m;
    return m * i;
  }

  function loadIndex(records, draft) {
    var out = { acute: 0, chronic: 0, ratio: 0, change: 0, sessions: 0, zone: '', tips: [] };
    var today = U.parseYmd(U.ymd());
    if (!today) return out;
    var acute = 0, prior = 0, past = 0, pastSessions = 0;
    var pastWeeks = {};

    (records || []).forEach(function (r) {
      var d = U.parseYmd(r.date);
      if (!d) return;
      var diff = Math.round((today - d) / 86400000);
      if (diff < 0 || diff > 34) return;
      var load = sessionLoad(r);
      if (diff <= 6) acute += load;
      else if (diff <= 13) { prior += load; pastSessions++; pastWeeks['w1'] = 1; }
      else { past += load; pastSessions++; pastWeeks['w' + Math.ceil(diff / 7)] = 1; }
    });
    /* 오늘 작성 중인 일지도 이번 주 부하에 넣습니다 */
    var todayLoad = sessionLoad(draft);
    if (todayLoad) acute += todayLoad;
    out.acute = Math.round(acute);
    /* 4주 평균을 말하려면 최소 2주·3세션은 있어야 합니다 */
    if (!pastSessions || pastSessions < 3 || Object.keys(pastWeeks).length < 2) return out;

    out.sessions = pastSessions + (todayLoad ? 1 : 0);
    out.chronic = Math.round(past / 4);
    if (!out.chronic) return out;
    out.ratio = Math.round((acute / out.chronic) * 10) / 10;
    out.change = prior ? Math.round(((acute - prior) / prior) * 100) : 0;
    out.zone = out.ratio >= 1.5 ? 'spike' : out.ratio > 1.3 ? 'watch' : out.ratio < 0.8 ? 'low' : 'ok';
    out.tips = loadTips(out);
    return out;
  }

  function loadTips(load) {
    var out = [];
    if (load.zone === 'spike') {
      out.push('최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배로 급증했어요. 이번 주는 더 늘리지 말고, 다음 주에도 10% 넘게 올리지 마세요.');
    } else if (load.zone === 'watch') {
      out.push('최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배예요. 조금 높은 편이니 이번 주는 지금 볼륨을 유지하세요.');
    } else if (load.zone === 'low') {
      out.push('최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배로 적어요. 감각이 떨어지지 않게 다음 주는 10% 이내로만 올리세요.');
    } else if (load.zone === 'ok') {
      out.push('최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배예요. 지금 리듬이면 무리 없이 쌓이고 있어요.');
    }
    if (load.zone !== 'low' && load.change >= 15) {
      out.push('지난주보다 ' + load.change + '% 늘었어요. 주당 부하가 10% 넘게 뛰면 부상 위험이 커진다는 보고가 있으니 다음 주는 유지하세요.');
    }
    if (load.zone === 'spike' || (load.zone === 'watch' && load.change >= 25)) {
      out.push('잠이 부족하거나 통증이 생기면 그날은 세트 수를 20~30% 줄이고, 대신 풋워크·폼 점검으로 바꾸세요.');
    }
    return out.slice(0, 2);
  }

  /* 급수 플랜 — 화면·시트 어디서든 같은 문구가 나오도록 */
  function gradePlan(level) {
    var g = gradeOf(level);
    if (!g) g = 'C조';
    var plan = GRADE_PLANS[g] || GRADE_PLANS['C조'];
    return { grade: g, focus: plan.focus, volume: plan.volume, rules: plan.rules.slice() };
  }

  /* 전술 노트 — 종목(복식/단식/혼합복식)에 맞는 3가지. 급수가 낮으면 기본 2개만. */
  function playbook(discipline, level) {
    var d = String(discipline || '').trim();
    if (d.indexOf('혼합') >= 0) d = '혼합복식';
    else if (d.indexOf('단식') >= 0) d = '단식';
    else if (d.indexOf('복식') >= 0) d = '복식';
    else d = '복식';
    var all = TACTICS[d] || TACTICS['복식'];
    var tier = tierOf(level);
    var n = tier >= 0 && tier <= 1 ? 2 : 3;
    var g = gradeOf(level);
    return { discipline: d, grade: g, tips: all.slice(0, n) };
  }

  /* ---------- 핵심: 분석 ---------- */
  function analyze(input) {
    input = input || {};
    var draft = input.draft || {};
    var records = (input.records || []).slice();
    var level = input.level || draft.level || LEVEL_FALLBACK;
    var nick = draft.nick || input.nick || '회원';
    var discipline = input.discipline || draft.discipline || (input.me && input.me.discipline) || '';

    /* 오늘 일지(아직 저장 전)도 분석 대상에 포함 */
    var today = draft.date || U.ymd();
    /* 게임 점수: 여러 경기를 남겼으면 점수·승패를 합쳐서 봅니다.
     * (예전 한 경기 기록은 그대로 한 경기로 읽힙니다.) */
    var games = BM.domain.cleanGames(draft.games);
    var gsum = BM.domain.gamesSummary(games);
    /* 점수제: 일지에서 고른 21·25점제를 따릅니다(없으면 최근 기록의 점수제) */
    var scoreMode = scoreModeOf(draft, records);
    var flow = gameFlow(draft.games, draft.gameMode, discipline);
    var todayEntry = {
      date: today,
      cond: draft.cond, intensity: draft.intensity, minutes: draft.minutes,
      done: draft.done || [], score: gsum.first || draft.score || null,
      games: games, result: gsum.result || draft.result || '',
      pain: draft.pain || [], weakness: draft.weakness || [], userKey: draft.userKey
    };
    var history = records.filter(function (r) { return r.date !== today || r.cond !== draft.cond; });
    /* 부하 점검도 같은 일지(오늘·같은 컨디션)를 두 번 세지 않는 기록으로 계산합니다 */
    var load = loadIndex(history, draft);
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

    /* 자기 강도 조절 — 오늘 이 선수가 스스로 브레이크를 잡아야 하는 날인지 */
    var pace = paceGuide(cond, load, U.uniq(painToday.concat(repeatedPain)), streakDays, intensity);

    /* ---------- 점수 ---------- */
    var scoreIdx = 60;
    if (cond != null) scoreIdx += cond >= 7 ? 10 : cond <= 4 ? -12 : 3;
    if (intensity != null) scoreIdx += intensity >= 5 && intensity <= 8 ? 8 : intensity >= 9 ? -6 : 0;
    if (minutes != null) scoreIdx += minutes >= 45 ? 8 : minutes < 30 ? -8 : 3;
    var gameResult = gsum.count ? gsum.result
      : (draft.score ? (draft.result || BM.domain.resultFromScore(draft.score)) : '');
    if (draft.score || gsum.count) scoreIdx += gameResult === '승' ? 8 : gameResult === '무' ? 2 : -4;
    if (gsum.count > 2) scoreIdx += 3;            // 여러 경기를 치른 날은 볼륨 보너스
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
    if (gsum.count > 1) {
      insights.push({
        icon: 'score',
        label: '오늘 ' + gsum.count + '경기 ' + gsum.wins + '승 ' + gsum.losses + '패' + (gsum.draws ? ' ' + gsum.draws + '무' : ''),
        detail: (flow.fade
          ? '마지막 경기에서 점수차가 벌어졌어요. 경기 사이 회복 시간을 먼저 챙기세요.'
          : flow.deuce >= 1
            ? '접전이 ' + flow.deuce + '경기였어요. 후반 2~3점 운영이 이 경기들의 승부처였습니다.'
            : gsum.wins >= gsum.losses
              ? '여러 경기를 치렀어요. 이긴 경기에서 통한 샷 하나를 다음에도 그대로 써 보세요.'
              : '여러 경기 중 내용이 좋았던 한 경기를 기준으로 다음 훈련을 잡아 보세요.')
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
    if (load.zone) {
      insights.push({
        icon: 'clock',
        label: '주간 부하 ' + load.ratio + '배 (' + (load.zone === 'spike' ? '급증' : load.zone === 'watch' ? '조금 높음' : load.zone === 'low' ? '적음' : '적정') + ')',
        detail: load.zone === 'spike' || load.zone === 'watch'
          ? '직전 4주 평균과 비교한 최근 7일 부하예요. 늘리는 속도를 먼저 보세요.'
          : load.zone === 'low'
            ? '쉬엄쉬엄 쌓인 주예요. 다음 주에 10% 이내로 올려 보세요.'
            : '부하가 평소 범위 안에 있어요. 이 속도를 유지하세요.'
      });
    }
    if (pace.level === 'brake') {
      insights.unshift({
        icon: 'gauge',
        label: '강도 조절' + (pace.reasons.length ? ' · ' + pace.reasons[0] : ''),
        detail: pace.text
      });
    }
    if (pace.level === 'brake' && load.zone) {
      /* 부하 조언에도 같은 브레이크 문구를 맨 앞에 둡니다 */
      load.tips = [SELF_PACE.brake].concat(load.tips || []).slice(0, 2);
    }
    insights = insights.slice(0, 6);

    /* ---------- 추천드릴 ---------- */
    var drills = takeDrills(weakSkills, level, 3);
    if (drills.length < 3) {
      var extra = takeDrills(['풋워크', '드라이브', '리시브'], level, 3);
      extra.forEach(function (d) {
        if (drills.length < 3 && !drills.some(function (x) { return x.name === d.name; })) drills.push(d);
      });
    }
    if (drills.length < 3) drills = drills.concat(BASICS.slice(0, 3 - drills.length).map(function (b) {
      return { name: b.name, level: level, method: b.method, sets: setsFor(b, level), point: b.point };
    }));

    /* ---------- 맞춤처방 ---------- */
    var care = { rehab: [], stretch: [], mental: [], warmup: [] };
    var painList = U.uniq(painToday.concat(painCounts.filter(function (p) { return p.n >= 3; }).map(function (p) { return p.name; })));
    /* 통증 부위·종목에 맞춘 예방 워밍업과 종목별 인터벌 기준 (논문 근거) */
    var prevent = preventionWarmup(painList, discipline);
    var loadGuide = disciplineLoadGuide(discipline, level);
    painList.slice(0, 2).forEach(function (p) {
      var box = INJURY[p];
      if (box) {
        care.rehab = care.rehab.concat(box.rehab);
        care.stretch = care.stretch.concat(box.stretch);
      }
    });
    if (!care.rehab.length) care.rehab = GENERIC_CARE.rehab.slice();
    if (!care.stretch.length) care.stretch = GENERIC_CARE.stretch.slice();
    care.rehab = U.uniq(care.rehab).slice(0, 4);
    care.stretch = U.uniq(care.stretch).slice(0, 4);

    /* 워밍업: 훈련일에는 기본 6단계 중 앞 4개, 통증이 있으면 강도 낮춘 3개 */
    care.warmup = (painToday.length ? WARMUP.slice(0, 4) : WARMUP.slice(0, 5));

    if (ws.rate != null && ws.rate < 40) care.mental.push('오늘 잘된 샷 하나만 떠올려 보세요. 승률은 연습량이 쌓이면 따라옵니다.');
    if (cond != null && cond <= 4) care.mental.push('컨디션이 낮은 날은 "덜 하기"도 훈련입니다. 20분만 하고 끝내도 성공이에요.');
    if (pace.level === 'brake') care.mental.unshift(SELF_PACE.rule);
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

    var gp = gradePlan(level);
    var week = [
      { day: '다음 훈련', focus: weakSkills[0], menu: drills[0] ? drills[0].name : '기본 스트록' },
      { day: '2회차', focus: weakSkills[1] || '풋워크', menu: drills[1] ? drills[1].name : '육각 풋워크' },
      { day: '3회차', focus: '실전', menu: scoreMode + '점제 게임 2~3경기 + 기록 남기기' }
    ];
    /* 급수 플랜의 볼륨이 주 4회 이상이면 네 번째 회차를 전술 연습으로 채웁니다 */
    if (gradeOf(level) && GRADE_TIER[gradeOf(level)] >= 3) {
      week.push({ day: '4회차', focus: '전술', menu: (playbook(discipline, level).discipline) + ' 3구 패턴 반복' });
    }

    var risk = [];
    if (painToday.length && (intensity || 0) >= 8) risk.push({ level: 'warn', text: '통증이 있는데 강도가 높아요. 오늘은 강도를 6 이하로 낮추는 걸 권장합니다.' });
    if (repeatedPain.length) risk.push({ level: 'warn', text: repeatedPain.join(', ') + ' 통증이 반복되고 있어요. 2주 이상 이어지면 정형외과 상담을 권장합니다.' });
    if (load.zone === 'spike') risk.push({ level: 'warn', text: '최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배예요. 급증한 주에는 부상 위험이 커지니 다음 주는 볼륨을 유지하세요.' });
    if (streakDays >= 6) risk.push({ level: 'info', text: streakDays + '일 연속 훈련 중이에요. 24시간 휴식을 넣어 주세요.' });
    if (pace.level === 'brake') risk.unshift({ level: 'warn', text: pace.text });
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
      grade: gradeOf(level) || '',
      gradePlan: gp,
      playbook: playbook(discipline, level),
      flow: flow,
      gameMode: scoreMode,
      load: load,
      drills: { drills: drills },
      care: care,
      prevent: prevent,
      loadGuide: loadGuide,
      offcourt: offcourtRoutine(discipline),
      pace: pace,
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

  BM.ai = {
    analyze: analyze, summarize: summarize,
    DRILLS: DRILLS, REHAB: INJURY, INJURY: INJURY,
    GRADE_PLANS: GRADE_PLANS, TACTICS: TACTICS, WARMUP: WARMUP,
    GRADES: GRADES, gradeOf: gradeOf, tierOf: tierOf, setsFor: setsFor,
    gradePlan: gradePlan, playbook: playbook,
    gameFlow: gameFlow, loadIndex: loadIndex, scoreModeOf: scoreModeOf,
    preventionWarmup: preventionWarmup, disciplineLoadGuide: disciplineLoadGuide,
    offcourtRoutine: offcourtRoutine, OFFCOURT: OFFCOURT,
    paceGuide: paceGuide, SELF_PACE: SELF_PACE,
    disciplineKey: disciplineKey, PREVENT: PREVENT, LOAD_GUIDE: LOAD_GUIDE,
    /* 논문 기준값 — 화면 문구와 같은 숫자 */
    SPLIT_STEP: SPLIT_STEP, DOUBLES_SERVE: DOUBLES_SERVE, DOUBLES_RECEIVE: DOUBLES_RECEIVE
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
