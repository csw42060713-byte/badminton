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
 * [GUER23] Guermont H., Mittelheisser G., Reboursière E., Gauthier A., Drigny J., <Shoulder muscle imbalance
 *        as a risk factor for shoulder injury in elite badminton players: A prospective study>,
 *        Phys Ther Sport 61:149-155, 2023 (DOI: 10.1016/j.ptsp.2023.04.002) — 엘리트 19명(19.4±4.8세) 38주 추적,
 *        42%가 우세측 주요 어깨 부상(SSI). 사전검사 GIRD > 14°(OR 36.14), FR240 < 0.69(OR 28.0)이 예측 인자.
 * [CEJ22] Cejudo A., <Risk Factors for, and Prediction of, Shoulder Pain in Young Badminton Players>,
 *        IJERPH 19(20):13095, 2022 (DOI: 10.3390/ijerph192013095) — U-17 45명 12개월 추적, 47.4%가 어깨 통증.
 *        내회전 ROM 55° 이하 = 1년 내 어깨 통증 확률 81%(민감도 75.0%, 특이도 83.3%).
 * [DU20] Du Y., Fan Y., <Changes in the Kinematic and Kinetic Characteristics of Lunge Footwork during the
 *        Fatiguing Process>, Appl Sci 10(23):8703, 2020 (DOI: 10.3390/app10238703) — 대학 남자 15명.
 *        피로 후 고관절·무릎·발목의 시상면 초기접촉각·최대각·모멘트·파워·최대각 도달시간 모두 감소,
 *        무릎이 특히 심함(p < 0.001). 서론: 하지 부상이 전체의 43~86%, 부상은 경기·훈련 후반에 몰림.
 * [VAL18] Valldecabres R., de Benito A.M., Littler G., Richards J., <An exploration of the effect of
 *        proprioceptive knee bracing on biomechanics during a badminton lunge to the net…>, PeerJ 6:e6033,
 *        2018 (DOI: 10.7717/peerj.6033) — 숙련 16명. 백핸드 네트 런지가 포핸드보다 무릎 내회전 속도·
 *        신전 모멘트가 커 위험 요인이 많음(포핸드는 굴곡 각이 큼). 피로 후 시상면 각속도·모멘트 감소.
 * [BARR16] Barreira J., Chiminazzo J.G.C., Fernandes P.T., <Analysis of point difference established by winners
 *        and losers in games of badminton>, Int J Perform Anal Sport 16(2):687-694, 2016
 *        (DOI: 10.1080/24748668.2016.11868916) — 2015 세계선수권 남자단식 136게임(59경기).
 *        경기를 0~7점·8~14점·15~21점 세 구간으로 나눠 최대 점수차를 봄.
 *        1구간에서 한 번도 앞서지 못한 선수의 78%가 그 게임을 졌고,
 *        2·3구간에서 1점차 리드는 이기기에 부족했으며, 승자는 중반~후반에 5점 이상 차를 냄.
 * [SEN19] Senadheera V.V., Mayooran S., Dissanayake J.K., <Elbow, Wrist and Hand Tendinopathies in Badminton
 *        Players>, Am J Sports Sci Med 7(1):16-19, 2019 (DOI: 10.12691/ajssm-7-1-3) — 선수 25명 단면조사.
 *        팔꿈치·손목·손 힘줄 통증 경험 28%(팔꿈치 20%·손목 4%·손 4%), 그중 바깥쪽 팔꿈치(라켓 엘보)가
 *        45.9%로 가장 흔함. 상지 유연성 운동을 하지 않은 선수는 100%가 통증(연관 유의, p < 0.05).
 * [YOON21] Yoon S.Y., Kim Y.W., Shin I.S., Kang S., Moon H.I., Lee S.C., <The Beneficial Effects of Eccentric
 *        Exercise in the Management of Lateral Elbow Tendinopathy: A Systematic Review and Meta-Analysis>,
 *        J Clin Med 10(17):3968, 2021 (DOI: 10.3390/jcm10173968) — RCT 6편 429명.
 *        원심성(천천히 내리기) 운동을 더하면 통증(SMD -0.63)과 악력(SMD 1.05)이 더 좋아짐.
 *        다른 근력운동과 비교해도 통증은 더 줄었지만(SMD -0.30) 근력·기능 차이는 유의하지 않음
 *        → '천천히 내리기 + 스트레칭'을 기본으로, 세트는 10~15회 2~3세트.
 * [WEN11] Wen D.Y., Schultz B.J., Schaal B., Graham S.T., Kim B.S., <Eccentric Strengthening for Chronic Lateral
 *        Epicondylosis: A Prospective Randomized Study>, Sports Health 3(6):500-503, 2011
 *        (DOI: 10.1177/1941738111409690) — 28명 RCT. 원심성 운동이 스트레칭·물리치료보다 모든 시점에서
 *        우월하지는 않았고 8주에만 통증 이점 → 과장하지 않고 '4주 이상 꾸준히'로 안내.
 * [SONG18] Song M-S., Kang J-I., Kim B-R., <The Effect of Proprioceptive Neuromuscular Facilitation Wrist Taping
 *        and Rhythmic Stabilization Technique on Pain and Grip Strength in Badminton Players with Wrist Pain>,
 *        PNF and Movement, 2018 — 배드민턴 동호인 41명(손목 과사용 통증), 테이핑 3주에 통증·악력 개선.
 * [FONG21] Fong D.T.P., Mok K.M., Thompson I.M., Wang Y., Shan W., King M.A., <A lateral ankle sprain during
 *        a lateral backward step in badminton: A case report of a televised injury incident>,
 *        J Sport Health Sci 12(1):139-144, 2023 (DOI: 10.1016/j.jshs.2021.03.007) — 측후방 스텝 중 앞발 착지
 *        (발목 33° 저측굴곡·18° 내회전)가 급성 외측 염좌의 메커니즘. 예방은 앞발 착지 순간의 발목 제어.
 * [WANG24] Wang Y., Xu L., Jiang H., Yu L., Wu H., Mei Q., <Biomechanical Effects of the Badminton
 *        Split-Step on Forecourt Lunging Footwork>, Bioengineering 11(5):501, 2024
 *        (DOI: 10.3390/bioengineering11050501) — 대학 수준 남자 선수 18명, VICON 모션캡처·지면반력 분석.
 *        포핸드 런지에서는 스플릿 스텝을 밟으면 발이 닿는 순간 고관절 벌림·돌림이 커지고 무릎 굽힘이,
 *        백핸드 런지에서는 무릎 돌림이 커지는 대신 발목 돌림이 유의하게 줄었습니다(p < 0.05).
 *        첫 지면반력 피크의 하중률이 커지고 첫·둘째 피크 사이 간격이 좁아져, 앞으로 나가기 직전의
 *        스플릿 스텝이 힘을 받아내는 준비와 백핸드 착지의 발목 비틀림 부담을 함께 다룹니다.
 * [FOST98] Foster C., <Monitoring training in athletes with reference to overtraining syndrome>,
 *        Med Sci Sports Exerc 30(7):1164-1168, 1998 (DOI: 10.1097/00005768-199807000-00023) —
 *        세션 RPE 부하에서 '단조로움(monotony)' = 하루 부하 평균 ÷ 표준편차, '긴장(strain)' = 주간 총부하 × 단조로움.
 *        부하가 크면서 매일 비슷하게 쌓이면(단조로움↑) 몸살·감기 같은 증상이 그 선수의 기준선을 넘을 때 몰렸습니다.
 *        → 앱은 '지난 7일 중 쉰 날'과 하루 부하의 오르내림을 참고 지표로만 보여 줍니다(진단 아님).
 * [HADD17] Haddad M., Stylianides G., Djaoui L., Dellal A., Chamari K., <Session-RPE Method for Training Load
 *        Monitoring: Validity, Ecological Usefulness, and Influencing Factors>, Front Neurosci 11:612, 2017
 *        (DOI: 10.3389/fnins.2017.00612) — 세션 RPE(분 × 주관적 강도) 타당성 총설. 단조로움·긴장 계산식을
 *        Foster(1998) 그대로 정리: 단조로움 = 주간 하루 부하 평균/표준편차, 긴장 = 주간 총부하 × 단조로움.
 * [MA25]  Ma S., Xue W., Soh K.G. et al., <Effects of physical training programs on healthy badminton players'
 *        performance: a systematic review and meta-analysis>, BMC Sports Sci Med Rehabil, 2025
 *        (DOI: 10.1186/s13102-025-01199-y) — 15편·370명(메타 12편). 코어 훈련이 스매시·전·후위 기술과 민첩성,
 *        하지 저항운동이 파워, 밸런스 훈련이 균형, HIIT·SIT 가 VO2max 를 올림 → 한 가지 훈련으로는 다 덮이지 않음.
 * [WANG25] Wang T., Ng Y.G., Amri S., Kamalden T.F., Gao Z., <Effects of resistance training on performance in
 *        competitive badminton players: a systematic review>, Front Physiol, 2025 (DOI: 10.3389/fphys.2025.1548869) —
 *        하체 저항운동이 점프력에 가장 크고, 코어는 힘 전달, 상체는 스매시 속도에 도움(근거는 아직 적음).
 *        8주를 넘긴 프로그램이 짧은 것보다 효과적 → '주 2회로 8주'를 안내.
 * [WEN25] Wen J., Xu D., Gao X., Qu X., Zhang Z. 외, <Effects of foot rotation on ankle control and injury risk
 *        during badminton lunge landings>, BMC Sports Sci Med Rehabil 17(1):341, 2025
 *        (DOI: 10.1186/s13102-025-01393-y) — 남자 아마추어 30명, 모션캡처·힘판·표면근전도·족부 3D 유한요소해석.
 *        런지 착지에서 발끝 각도 3가지(중립 0°, toe-in 안쪽 20°, toe-out 바깥 20°)를 비교했습니다.
 *        toe-out은 발목 외번 각도·외번 모멘트·전후방 전단력·관절 충격량을 유의하게 줄였고
 *        (p < 0.001 / p = 0.025 / p = 0.047 / p = 0.038), 뒤꿈치에서 앞발 쪽으로 응력이 옮겨 가며
 *        비골근·하퇴삼두근 활성도가 높아 충격 흡수가 부드러워졌습니다.
 *        toe-in은 외번 부하·뒤꿈치 응력 집중이 커져 위험 → '진행 방향~조금 바깥(toe-out)'을 권합니다.
 *        (같은 연구에서 toe-out이 무릎 바깥쪽 벌어짐 각도는 조금 컸으므로 무릎 정렬은 별도 과제입니다.)
 * [XIAO26] Xiao D., Duan Y., Weng H., <Biomechanical risk factors for badminton injuries: a systematic review>,
 *        Res Sports Med 34(6):737-760, 2026 (DOI: 10.1080/15438627.2026.2680707) — 6개 DB 435편 → 전향적
 *        생체역학 연구 11편. 런지에서 시상면·이마면 무릎 모멘트 증가, 높은 최대 하중률, 경골 후방 이동이
 *        전방십자인대(ACL) 부상 위험과 연관. 착지에서는 무릎 안쪽 꺾임(knee valgus)·내회전·높은 수직
 *        지면반력이 위험을 높였습니다. 예방은 런지·착지 정렬 교정 + 햄스트링·회전근개 강화를 강조.
 * [CHENG24] Cheng K-C., Chiu Y-L., Tsai C-L., Hsu Y-L., Tsai Y-J., <Fatigue Affects Body Acceleration During
 *        Vertical Jumping and Agility Tasks in Elite Young Badminton Players>, Sports Health 17(1):126-134, 2024
 *        (DOI: 10.1177/19417381241245908) — 1부 리그 고등부 선수 38명(평균 16.2세, 경력 7.1년). 배드민턴
 *        풋워크·점프로 피로를 유도한 직후 수직 점프 높이가 최고·평균 모두 약 3~4cm 낮아졌고(p < 0.01),
 *        스쿼트(내려앉는) 구간의 하강 가속도가 커졌습니다(p < 0.05). 가속도 주파수 분석에서는 높은 주파수
 *        성분이 줄어 스스로 조절하는 힘이 떨어지고 탄성 조직(힘줄·인대)에 부담이 늘었다고 해석했습니다.
 *        → 피로가 쌓인 날의 연속 점프 스매시는 착지 충격이 커지므로, 네트 앞 짧은 볼·안정적인 풋워크로 전환.
 * [APRI23] Apriantono T.A., Herman I., Winata B., Chia-Smith Y-D., Akbari M.R., Ihsani S.I. 등,
 *        <Impact of Decreased Hamstring Flexibility and Trunk Muscle Strength Performance in Junior Badminton
 *        Athletes with a History of Knee Injuries: The Risk of Low Back Pain>, Int J Hum Mov Sports Sci 11(5), 2023
 *        (DOI: 10.13189/saj.2023.110504) — 17~19세 주니어 120명(무릎 부상 이력 60명). 무릎 부상 이력이 있는
 *        선수는 무릎 기능 점수(AKPS)가 낮을수록 허벅지 뒤(햄스트링) 유연성이 낮았고(남 r = -0.575, p = 0.001 ·
 *        여 r = -0.304, p = 0.018), 몸통 근력도 함께 낮았습니다(여 r = -0.354, p = 0.006).
 *        → 무릎 통증·햄스트링 뻣뻣함은 몸통 힘 저하와 함께 허리 통증 위험을 키우는 연쇄로 봅니다.
 * [SATRA25] Satra S.S., Bhurke A., <Comparison of Trunk Muscle Endurance and Modified Oswestry Disability
 *        Levels in Female Recreational Badminton Players With Low Back Pain>, IOSR J Sports Phys Educ
 *        12(5):01-06, 2025 (DOI: 10.9790/6737-1205010612) — 허리 통증이 4주 이상 이어진 여성 동호인 128명.
 *        몸통 회전 버티기(오른쪽) 시간이 길수록 일상 동작 불편 점수도 높았습니다(r = 0.174, p = 0.049).
 *        → 일반 코어 운동만으로는 부족하고, 좌우를 같은 시간으로 채우는 사이드 플랭크가 필요합니다.
 * [INGLE25] Ingle R.K., Vishwakarma B., Ganvir S., <Prevalence of calf muscle tightness and correlation between
 *        warm-up and cool-down with calf muscle tightness in recreational badminton players: A cross-sectional
 *        study>, Sri Ramachandra J Health Sci 5(2):65-70, 2025 (DOI: 10.25259/srjhs_14_2025) — 동호인 158명.
 *        무릎 벽 런지 검사(MWBLT)에서 26.6%(42명)가 종아리 뻣뻣함(발목 배측굴곡 제한)이었고, 이는 발목
 *        생체역학을 바꿔 아킬레스건 병증·발목 부상 위험을 올립니다. 경기 전 웜업은 상관이 거의 없었고
 *        (r = -0.006, p > 0.05), 경기 후 쿨다운·종아리 스트레칭은 강한 음의 상관(r = -0.890, p < 0.05)이었습니다.
 * [FAHL02] Fahlström M., Lorentzon R., Alfredson H., <Painful Conditions in the Achilles Tendon Region in Elite
 *        Badminton Players>, Am J Sports Med 30(1):51-54, 2002 (DOI: 10.1177/03635465020300012201) —
 *        스웨덴 엘리트부 66명(남 41·여 25). 32%(21명)가 최근 5년 안에 아킬레스건 부위 통증을 겪었고(지속 17%),
 *        겪은 선수는 주당 총 훈련 시간(전체·배드민턴·지구력·근력)이 유의하게 많았습니다.
 *        → 주간 누적 훈련량이 많을수록 아킬레스건 부하가 쌓이는 근거로 씁니다.
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

  /* ---------- 실전 드라이브·초구 기준 (bm-v1.94.0) ----------
   * 체전 1등 선수 현장 기준(사용자 제보 2026-11-27)을 그대로 옮겼습니다.
   *   "드라이브 칠 때 검지 손가락에 신경 써서 힘을 주고, 끊어 치지 않고 스윙을 짧게 한다"
   *   "초구는 직선(지선) 가운데로 누르는 게 기본"
   * 드릴·약점 코칭·전술 노트가 같은 문장을 쓰도록 한 곳에 모읍니다.
   * 실명은 쓰지 않고 '체전 1등 선수 현장 기준'으로만 부릅니다. */
  var PRO_DRIVE = {
    source: '체전 1등 선수 현장 기준(2026-11-27)',
    finger: '검지 손가락에 신경 써서 힘을 실어 주고',
    short: '라켓을 길게 휘두르거나 툭 끊어 치지 말고 스윙을 짧게',
    push: '짧은 스윙으로 간결하게 밀어 치기',
    first: '초구(첫 리턴)는 무리하게 코너를 찌르지 말고 직선 가운데로 눌러 주는 게 기본'
  };

  /* ---------- 기술별 드릴 ----------
   * 각 드릴의 sets는 7급수 전부를 갖습니다. (예전 4단계 문구도 setsFor가 받아 줍니다) */
  var DRILLS = {
    '드라이브': [
      {
        name: '드라이브 기본 반복',
        method: '포핸드 드라이브는 ' + PRO_DRIVE.finger + ', 툭 끊어 치지 않고 스윙을 짧게 밀듯 칩니다. 같은 코스로 반복하며 타점은 몸 앞, 파트너 없이 벽치기로도 됩니다.',
        sets: vol('회', [20, 25, 30, 35, 40, 45, 50], [2, 3, 3, 3, 4, 4, 4]),
        point: '검지에 힘 실어 주고 · 짧은 스윙으로 밀어 치기'
      },
      {
        name: '드라이브 코스 변경',
        method: '좌우 코스를 번갈아 보내 상대 움직임을 만듭니다. 복식에서는 중앙(두 선수 사이)을 겨냥하는 것이 기본입니다.',
        sets: vol('분', [1, 2, 2, 2, 3, 3, 3], [2, 3, 3, 4, 4, 4, 5]),
        point: '샷 후 바로 준비 자세(라켓 들고)로 복귀'
      },
      {
        name: '드라이브 연결 3구',
        method: '짧은 스윙으로 밀듯 치는 감각 그대로 드라이브 → 드라이브 → 공격(스매시/푸시) 3구를 이어갑니다. 서브 리시브 뒤 드라이브 싸움을 견디는 힘을 만들고, 랠리 중에 크게 휘두르면 다음 공 준비가 늦습니다.',
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
        point: '착지 후 흔들리지 않게 — 무릎은 발끝 방향으로 벌리고 엉덩이를 뒤로 빼며 부드럽게 흡수'
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
        name: '스플릿 스텝 → 전위 런지',
        method: '앞으로 뛰어나가기 직전에 두 발을 살짝 떼며 박자를 맞춘 뒤, 포핸드·백핸드 쪽으로 길게 런지합니다. 두 발이 땅에서 떠 있는 순간이 상대 타구와 맞아야 하고, 런지로 딛는 발은 발바닥 전체로 내려놓으세요. 스플릿 스텝을 넣은 런지와 넣지 않은 런지를 번갈아 해 보면 차이가 느껴집니다.',
        sets: vol('회', [6, 8, 10, 12, 12, 15, 15], [2, 2, 3, 3, 3, 4, 4]),
        point: '나가기 직전 두 발 살짝 떼며 박자 → 백핸드로 길게 뻗을 때 발목이 덜 비틀려요'
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
        method: '초구(첫 리턴)는 무리하게 코너를 찌르지 말고 직선 가운데로 눌러 주는 게 기본입니다. 상대 서브를 헤어핀·드라이브·푸시로 받아내고, 복식은 네트 앞을 먼저 차지하는 리시브가 가장 좋습니다. 국내 국가대표 복식 분석에서 리시브 기술이 숏 드라이브 ' + rng(DOUBLES_RECEIVE.shortDrivePct, '%') + '·드라이브 ' + rng(DOUBLES_RECEIVE.drivePct, '%') + '·헤어핀 ' + rng(DOUBLES_RECEIVE.hairpinPct, '%') + '에 몰렸으니 한 구질만 반복하지 마세요.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 12], [3, 3, 3, 4, 4, 4, 4]),
        point: '초구는 직선 가운데로 눌러 두고, 서브 오기 전에 받을 곳 정해두기'
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
        name: '수비 타이밍 — 예측했을 때 / 아닐 때',
        method: '코스를 예측한 공은 앞에서 짧게 잡아 상대를 압박하고, 예측하지 못한 공은 몸 쪽 뒤로 살짝 당겨 시간을 벌어 받아칩니다. 앞에서 급하게 치려 하면 공이 더 빠르게 느껴져요.',
        sets: vol('랠리', [6, 8, 10, 10, 12, 12, 15], [2, 3, 3, 3, 4, 4, 4]),
        point: '예측했으면 앞에서 짧게 / 예측 못 했으면 뒤로 당겨 여유롭게'
      },
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
        point: '무릎이 안쪽으로 무너지지 않게 — 딛는 발끝은 몸이 가는 방향에서 조금 바깥으로 열어 뒤꿈치 충격 줄이기'
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
      '리시브는 네트 앞으로 받아 리프트를 유도한 뒤 공격, 낮게 오면 리프트로 뒤 코너에 깊게 — ' + PRO_DRIVE.first + ' (' + PRO_DRIVE.source + ')',
      '상대를 백핸드 후위로 길게 밀면 체공 시간이 벌어져 내가 베이스로 돌아와 스플릿 스텝을 준비할 시간이 생깁니다 — 뒤로 몰린 상대에게 백핸드 후위를 한 번 더',
      '중립 상황은 스트레이트 위주로 안전하게, 상대가 회복을 못 하면 긴 대각선으로 이동시키기',
      '공격 기회(짧은 리프트)에는 빠르게 뒤로 들어가 아래로, 압박이 세면 베이스를 앞으로',
      '뒤로 밀렸을 때는 억지 스매시보다 깊은 클리어·풀드 드롭으로 랠리 재정비'
    ],
    '복식': [
      '수비에서 공격으로 뒤집을 땐 먼저 공을 세게 한 번 쳐서 상대를 뒤로 밀리게 만들고, 그다음 코스를 틀거나 짧게 놓아 빈틈을 노리세요 — 밀기 전에 방향부터 바꾸면 앞을 지키는 상대에게 걸립니다',
      '숏서브는 T자 부근, 서브 후 전위는 네트를 지키고 후위는 미드/후방 커버 (BWF 복식 서브). 몸쪽만 반복하면 읽힙니다 — 국내 국가대표 분석에서 몸쪽 서브 ' + rng(DOUBLES_SERVE.bodyPct, '%') + '인 조의 서브 실점이 ' + rng(DOUBLES_SERVE.lossPct, '%') + '였습니다',
      '리시브는 네트 앞으로 차지하기. 숏 드라이브 ' + rng(DOUBLES_RECEIVE.shortDrivePct, '%') + '·드라이브 ' + rng(DOUBLES_RECEIVE.drivePct, '%') + '·헤어핀 ' + rng(DOUBLES_RECEIVE.hairpinPct, '%') + '에 몰리지 말고 구질·코스(중앙/대각/직선)를 섞기 — ' + PRO_DRIVE.first + ' (' + PRO_DRIVE.source + ')',
      '공격은 전후(공격) / 수비는 좌우(수비). 셔틀 높이를 보고 둘이 동시에 바꾸기',
      '전위는 공격 방향 쪽으로 붙는 채널 어택 — 스트레이트·중앙 공격으로 2대1 만들기',
      '수비에서는 블록·드라이브로 앞으로 나가 주도권 회수, 리프트는 스트레이트 공격엔 크로스로 — 코스를 예측한 수비는 앞에서 짧게 잡아 압박하고, 예측 못 한 공은 몸 쪽 뒤로 살짝 당겨 시간을 벌고 여유롭게 받아치기',
      '드라이브 싸움에서는 중앙(두 선수 사이)과 몸쪽을 먼저 겨냥 — 포핸드 드라이브는 ' + PRO_DRIVE.finger + ' ' + PRO_DRIVE.push + ', 툭 끊어 치지 않기 (' + PRO_DRIVE.source + ')'
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
      name: '발목 균형 감각', area: '발목', min: 2,
      how: '한 발 서기 30초 × 2, 눈 감고 15초 × 2 — 접질림은 방향 전환에서 가장 많아요(발목 접질림 23.5%)'
    },
    '무릎': {
      name: '한 발 착지 · 감속 런지', area: '무릎', min: 2,
      how: '가볍게 뛰어 한 발 착지 후 3초 버티기 좌우 5회 + 앞 런지 후 2초 정지 5회(무릎 힘줄 통증 20.3%)'
    },
    '어깨': {
      name: '팔 바깥 돌리기 · 어깨 날개 고정', area: '어깨', min: 2,
      how: '밴드로 팔 바깥으로 돌리기 15회 × 2 + 벽에 팔 붙여 밀기 10회 × 2 — 주로 쓰는 어깨 부상이 25.5%예요'
    },
    '팔꿈치': {
      name: '팔뚝·손목 예열', area: '팔꿈치', min: 2,
      how: '손목 굽히기·펴기 10회씩 + 가벼운 손목 펴기 15회 — 그립 힘은 빼고 가볍게'
    },
    '손목': {
      name: '손목 풀기', area: '손목', min: 2,
      how: '손목 원 그리기 양방향 10회씩 + 손목 앞뒤 20초 × 2, 라켓을 쥔 채로 가볍게'
    },
    '허리': {
      name: '엉덩이 접기 · 등 돌리기', area: '허리', min: 2,
      how: '고양이-소 10회 + 엉덩이를 뒤로 빼며 숙이기 10회 + 등 돌리기 좌우 8회 — 허리를 굽혀 숙이지 않기'
    },
    '목': {
      name: '턱 당기기 · 등 풀기', area: '목', min: 2,
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
        (lower ? '방향 전환에서 발목 접질림(' + PREVENT.ankleSprainPct + '%)·무릎 힘줄 통증(' + PREVENT.patellarPct +
          '%)이 많이 나고, 부상의 절반 이상(' + Math.round(PREVENT.lowerBodyPct) + '%)이 다리예요. ' : '') +
        (upper ? '주로 쓰는 어깨 부상이 ' + PREVENT.shoulderPct + '%나 돼요. ' : '') +
        '준비운동을 자주 할수록 부상이 적었어요.';
    } else {
      reason = '오늘 통증이 없어 다리 기본으로 잡았어요. 부상의 절반 이상이 다리이고, ' +
        '8주 예방 워밍업으로 부상이 ' + PREVENT.preventiBadPct + '% 줄었어요(같은 시간에 ' + PREVENT.controlPer1000h + '건 → ' +
        PREVENT.programPer1000h + '건).';
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

  /* ---------- 운동 후 5분 종아리·아킬레스 쿨다운 (bm-v1.91.0) ----------
   * [INGLE25] 동호인 배드민턴 선수 158명 단면조사 — 26.6%(42명)가 종아리 근육이 뻣뻣해
   *   발목을 위로 당기는 각도(배측굴곡)가 제한됐습니다. 이 뻣뻣함은 발목 생체역학을 바꿔
   *   아킬레스건 병증·발목 부상 위험을 올립니다.
   *   경기 전 웜업(r = -0.006, p > 0.05)보다 경기 후 쿨다운·종아리 스트레칭(r = -0.890, p < 0.05)이
   *   뻣뻣함과 훨씬 강하게 이어졌습니다 → 웜업만 하고 끝내면 쿨다운 몫이 그대로 남습니다.
   * [FAHL02] 스웨덴 엘리트 선수 66명 중 32%(21명)가 최근 5년 안에 아킬레스건 부위 통증을 겪었고,
   *   겪은 선수는 주당 총 훈련 시간(전체·배드민턴·지구력·근력)이 유의하게 많았습니다
   *   → 주간 누적 훈련량이 많을수록 아킬레스건 부하가 쌓입니다.
   * 화면에는 '동호인 네 명 중 한 명', '웜업보다 쿨다운' 같은 쉬운 말만 쓰고 수치는 stats에 둡니다. */
  var CALF = {
    tightN: 158,               /* [INGLE25] 동호인 단면조사 표본 */
    tightPct: 26.6,            /* [INGLE25] 종아리 뻣뻣함 26.6% */
    tightCount: 42,
    cooldownR: -0.89,          /* [INGLE25] 쿨다운 ↔ 종아리 뻣뻣함 */
    warmupR: -0.006,           /* [INGLE25] 웜업 ↔ 종아리 뻣뻣함(유의하지 않음) */
    achillesN: 66,             /* [FAHL02] 엘리트 선수 66명 */
    achillesPct: 32,           /* [FAHL02] 아킬레스건 부위 통증 32% */
    achillesCount: 21,
    cooldownMin: 5,            /* 마무리 쿨다운 5분 */
    longMinutes: 60,           /* 60분 이상이면 쿨다운 팁 */
    hardIntensity: 8,          /* 강도 10점 중 8 이상 = 고강도(기존 하지 피로 기준과 동일) */
    items: [
      {
        name: '벽 짚고 종아리 스트레칭 (무릎 펴고)',
        how: '벽을 짚고 한 발을 뒤로 딛어 뒤꿈치를 바닥에 붙인 채 몸을 앞으로 — 무릎을 편 채 30초, 좌우 2번씩.',
        min: 2
      },
      {
        name: '가자미근 스트레칭 (무릎 굽히고)',
        how: '같은 자세에서 뒷무릎만 살짝 굽히면 발목 아래 깊은 종아리가 늘어나요 — 30초씩 좌우 2번.',
        min: 2
      },
      {
        name: '계단 끝 뒤꿈치 내리기 · 발목 돌리기',
        how: '계단 모서리에 앞발을 걸치고 뒤꿈치를 천천히 아래로 10회, 이어 발목을 안·밖으로 10회씩.',
        min: 1
      }
    ]
  };
  var CALF_STATS = {
    tightN: CALF.tightN, tightPct: CALF.tightPct, tightCount: CALF.tightCount,
    cooldownR: CALF.cooldownR, warmupR: CALF.warmupR,
    achillesN: CALF.achillesN, achillesPct: CALF.achillesPct, achillesCount: CALF.achillesCount,
    cooldownMin: CALF.cooldownMin, longMinutes: CALF.longMinutes, hardIntensity: CALF.hardIntensity
  };
  var CALF_SRC = 'Ingle et al., Sri Ramachandra J Health Sci 5(2):65-70, 2025 (DOI 10.25259/srjhs_14_2025) · ' +
    'Fahlström et al., Am J Sports Med 30(1):51-54, 2002 (DOI 10.1177/03635465020300012201)';
  var CALF_SRC_SHORT = '참고 논문 · Ingle 2025 Sri Ramachandra J Health Sci · Fahlström 2002 Am J Sports Med';
  /* 쿨다운이 필요한 부위 — 통증 칩에 있는 '발목·아킬레스건'과 기록에 남을 수 있는 '종아리·발' */
  var CALF_AREAS = ['발목', '아킬레스건', '종아리', '발'];

  /* coolDown(painList, ctx)
   *   → { on, level, title, label, minutes, items, reason, advice, note, source, sourceShort, stats }
   * 발목·종아리·아킬레스건 통증이 있거나, 60분 이상·강도 8 이상으로 친 날에 켜집니다.
   * 같은 입력이면 항상 같은 결과 (순수 함수) */
  function coolDown(painList, ctx) {
    ctx = ctx || {};
    var pains = (painList || []).filter(Boolean);
    var calfPain = pains.filter(function (p) { return CALF_AREAS.indexOf(p) >= 0; });
    var minutes = ctx.minutes == null ? null : Number(ctx.minutes);
    var intensity = ctx.intensity == null ? null : Number(ctx.intensity);
    var zone = (ctx.load && ctx.load.zone) || '';
    var longDay = minutes != null && minutes >= CALF.longMinutes;
    var hardDay = intensity != null && intensity >= CALF.hardIntensity;
    /* 주간 누적 훈련량이 평소보다 높은 주 — 아킬레스건 부하가 겹치는 구간 */
    var heavyWeek = zone === 'spike' || zone === 'watch';
    var on = calfPain.length > 0 || longDay || hardDay;
    var level = calfPain.length ? 'pain' : (longDay || hardDay ? 'load' : '');

    var reason = '';
    if (level === 'pain') {
      reason = '오늘 ' + calfPain.join('·') + ' 쪽이 불편하다고 남겼어요. 배드민턴 동호인 네 명 중 한 명은 종아리가 뻣뻣해 발목을 위로 당기는 각도가 줄어 있고, 그대로 계속 뛰면 발목이 바뀌면서 아킬레스건에 부담이 몰려요. 운동 끝나고 5분 종아리 스트레칭을 남겨 두세요.' +
        (heavyWeek ? ' 이번 주 훈련량이 평소보다 많아 아킬레스 부하가 겹친 주예요.' : '');
    } else if (level === 'load') {
      reason = (longDay ? '오늘 ' + minutes + '분' : '오늘 강도 ' + intensity) + '으로 길거나 세게 친 날이에요. 웜업은 열심히 해도 운동 후 쿨다운을 건너뛰면 종아리 뻣뻣함이 그대로 쌓여요 — 웜업보다 경기 후 종아리 스트레칭이 뻣뻣함 예방에 훨씬 크게 이어졌어요.' +
        (heavyWeek ? ' 이번 주 훈련량이 이미 높으니 마무리 5분을 빼먹지 마세요.' : '');
    }

    var advice = '';
    if (calfPain.length) {
      advice = (heavyWeek ? '이번 주 누적 훈련량이 많아요 — ' : '') +
        '아킬레스건은 주당 훈련 시간이 많을수록 통증이 늘었어요. 오늘은 강도를 한 칸 낮추고 점프·급정지 개수를 줄이세요.';
    } else if (heavyWeek) {
      advice = '이번 주 훈련량이 이미 높아요 — 오늘은 강도를 한 칸 낮추고 마무리 5분을 꼭 남기세요.';
    }

    var items = on ? CALF.items.map(function (it) {
      return { name: it.name, how: it.how, min: it.min };
    }) : [];

    return {
      on: on,
      level: level,
      title: '운동 후 5분 종아리·아킬레스 쿨다운',
      label: CALF.cooldownMin + '분',
      minutes: CALF.cooldownMin,
      areas: calfPain.slice(),
      heavyWeek: heavyWeek,
      longDay: longDay,
      hardDay: hardDay,
      items: items,
      reason: reason,
      advice: advice,
      /* 처방(스트레칭·회복)에 한 줄로 들어가는 문장 */
      stretchLine: '운동 끝나고 5분 — 벽 짚고 종아리 스트레칭(무릎 펴고·굽히고) 30초씩 좌우 2번 + 계단 끝 뒤꿈치 내리기 10회. 웜업보다 이 마무리 5분이 종아리 뻣뻣함을 막는 데 훨씬 크게 이어졌어요.',
      note: '웜업만 하고 끝내면 종아리 뻣뻣함이 그대로 남아요. 운동 후 5분이면 충분하니 코트에서 나오기 전에 꼭 하고 나오세요.',
      source: CALF_SRC,
      sourceShort: CALF_SRC_SHORT,
      stats: CALF_STATS
    };
  }

  /* ---------- 관절 보호 체크 — 어깨 과사용(GIRD) · 하지 피로 구간 ----------
   * 배드민턴 선수가 가장 자주 다치는 두 부위를 '측정 가능한 기준'으로 점검합니다.
   * [GUER23] 엘리트 19명(19.4±4.8세) 38주 추적, 42%가 우세측 주요 어깨 부상(SSI).
   *          사전검사 GIRD > 14°(OR 36.14), FR240 < 0.69(OR 28.0)이 독립 예측 인자.
   *          → 뒤쪽 관절낭(슬리퍼) 스트레치 + 외회전 원심성 보강.
   * [CEJ22] U-17 45명 12개월 추적, 47.4%가 어깨 통증 경험. 내회전 ROM 55° 이하 =
   *          1년 내 통증 확률 81%(민감도 75.0%, 특이도 83.3%).
   * [DU20] 대학 남자 15명. 피로가 쌓이면 고관절·무릎·발목의 시상면 초기접촉각·최대각·
   *          모멘트·파워·최대각 도달시간이 모두 줄고, 무릎이 특히 심함(p < 0.001).
   *          서론: 하지 부상이 전체의 43~86%, 부상은 경기·훈련 후반에 몰림.
   * [VAL18] 숙련 16명. 백핸드 네트 런지가 포핸드보다 무릎 내회전 속도·신전 모멘트가 커
   *          위험 요인이 많음(포핸드는 굴곡 각이 큼). 피로 후 시상면 각속도·모멘트 감소.
   * [FONG21] 측후방 스텝 중 앞발 착지(발목 33° 저측굴곡·18° 내회전)가 급성 외측 염좌의
   *          메커니즘. 예방은 앞발 착지 순간의 발목 제어·안정성.
   * 여기 숫자는 화면 문구와 테스트가 함께 씁니다. */
  var SHOULDER_RISK = {
    girdDeg: 14,            /* [GUER23] GIRD > 14° */
    girdOR: 36.14,
    fr240: 0.69,            /* [GUER23] FR240 < 0.69 */
    fr240OR: 28.0,
    irRomDeg: 55,           /* [CEJ22] 내회전 ROM ≤ 55° */
    irRomProbPct: 81,
    irRomSensPct: 75,
    irRomSpecPct: 83.3,
    eliteN: 19,
    followWeeks: 38,
    eliteInjuryPct: 42,
    youthN: 45,
    youthPainPct: 47.4
  };
  var LOWER_RISK = {
    lowerSharePct: [43, 86],   /* [DU20] 하지 부상 비중 */
    kneeMomentP: 0.001,        /* [DU20] 무릎 모멘트·파워 감소 유의수준 */
    plantarDeg: 33,            /* [FONG21] 착지 순간 저측굴곡 */
    irDeg: 18,                 /* [FONG21] 착지 순간 내회전 */
    toeTrials: 30,             /* [WEN25] 남자 아마추어 30명 · 발끝 방향 3조건 */
    toeOutDeg: 20,             /* [WEN25] toe-out(바깥 20°), toe-in도 같은 20° */
    toeInDeg: 20,
    toeOutSignificantP: [0.001, 0.025, 0.047, 0.038],  /* [WEN25] toe-out에서 유의하게 줄어든 값 */
    splitStepTrials: 18,       /* [WANG24] 대학 수준 남자 선수 18명 */
    splitStepP: 0.05,          /* [WANG24] 발목·무릎 돌림 차이 유의수준 */
    aclRecords: 435,           /* [XIAO26] 6개 DB 검색 결과 */
    aclStudies: 11,            /* [XIAO26] 전향적 생체역학 연구 11편 */
    heavyMinutes: 90,          /* 여기서부터 '피로 구간' 경고 */
    heavyIntensity: 8
  };
  var SHOULDER_SRC = 'Guermont et al., Phys Ther Sport 61:149-155, 2023 (DOI 10.1016/j.ptsp.2023.04.002) · ' +
    'Cejudo, IJERPH 19(20):13095, 2022 (DOI 10.3390/ijerph192013095)';
  var SHOULDER_SRC_SHORT = '참고 논문 · Guermont 2023 Phys Ther Sport · Cejudo 2022 IJERPH';
  var LOWER_SRC = 'Du & Fan, Appl Sci 10(23):8703, 2020 (DOI 10.3390/app10238703) · ' +
    'Valldecabres et al., PeerJ 6:e6033, 2018 (DOI 10.7717/peerj.6033) · ' +
    'Fong et al., J Sport Health Sci 12(1):139-144, 2023 (DOI 10.1016/j.jshs.2021.03.007) · ' +
    'Wang et al., Bioengineering 11(5):501, 2024 (DOI 10.3390/bioengineering11050501) · ' +
    'Wen et al., BMC Sports Sci Med Rehabil 17(1):341, 2025 (DOI 10.1186/s13102-025-01393-y) · ' +
    'Xiao et al., Res Sports Med 34(6):737-760, 2026 (DOI 10.1080/15438627.2026.2680707)';
  var LOWER_SRC_SHORT = '참고 논문 · Du & Fan 2020 · Valldecabres 2018 · Fong 2021 · Wang 2024 · Wen 2025 · Xiao 2026';
  /* 팔꿈치·손목 과사용(라켓 엘보·손목 힘줄) — 내부 수치는 화면 문구와 테스트가 같이 씁니다 */
  var ARM_RISK = {
    tendinopathyPct: 28,      /* [SEN19] 25명 중 28%가 팔꿈치·손목·손 힘줄 통증 */
    elbowPct: 20, wristPct: 4,
    lateralSharePct: 45.9,    /* [SEN19] 그중 바깥쪽 팔꿈치가 가장 흔함 */
    noFlexPainPct: 100,       /* [SEN19] 상지 유연성 운동 안 하는 선수 전원 통증 */
    metaStudies: 6, metaN: 429, /* [YOON21] */
    eccentricSets: 3, eccentricReps: 15, eccentricWeeks: 4
  };
  var ARM_SRC = 'Senadheera et al., Am J Sports Sci Med 7(1):16-19, 2019 (DOI 10.12691/ajssm-7-1-3) · ' +
    'Yoon et al., J Clin Med 10(17):3968, 2021 (DOI 10.3390/jcm10173968) · ' +
    'Wen et al., Sports Health 3(6):500-503, 2011 (DOI 10.1177/1941738111409690) · ' +
    'Song et al., PNF and Movement, 2018';
  var ARM_SRC_SHORT = '참고 논문 · Senadheera 2019 · Yoon 2021 J Clin Med · Wen 2011 Sports Health';

  function guardShoulder() {
    return {
      label: '어깨',
      title: '어깨 보호 체크',
      /* 화면 제목은 쉬운 말로, 논문 수치는 내부 stats와 참고 출처 한 줄에만 남깁니다 */
      thresholdTitle: '쉬운 기준',
      checkTitle: '자가 체크',
      guideTitle: '오늘 할 것',
      thresholds: [
        '주로 치는 어깨가 반대쪽보다 안으로 덜 돌아가면 어깨 부상 위험이 커져요',
        '라켓을 휘두른 뒤 브레이크 잡아 주는 뒤쪽 힘이 약해도 위험이 커져요',
        '누워서 팔을 벌렸을 때 주로 치는 쪽 손이 바닥 가까이 내려가지 않으면, 1년 안에 어깨 통증이 올 확률이 ' + SHOULDER_RISK.irRomProbPct + '%였어요'
      ],
      checks: [
        { name: '누워서 어깨 양쪽 비교하기', how: '똑바로 누워 팔을 90도로 벌리고 손바닥을 바닥 쪽으로 내려 보세요. 주로 치는 쪽 팔이 반대쪽보다 눈에 띄게 덜 내려가면 어깨 뒤쪽이 굳은 신호예요.' },
        { name: '어깨 뒤쪽 힘 균형', how: '라켓을 휘두른 뒤 브레이크 잡아주는 뒤쪽 근육이 약하면 통증이 생기기 쉬워요.' },
        { name: '체력 측정 때 코치에게 확인', how: '어깨 힘을 기계로 재는 측정이 있으면, 안으로 도는 각도와 뒤쪽 힘을 코치에게 같이 봐 달라고 하세요.' }
      ],
      guides: [
        { name: '옆으로 누워 어깨 뒤 풀기 (30초 × 3)', how: '옆으로 누워 어깨를 90도로 들고, 반대 손으로 손목을 바닥 쪽으로 살짝 눌러 30초 멈추기 — 통증 3/10 이하로 하루 1~2번.' },
        { name: '밴드 바깥으로 당겼다가 3초 천천히 풀기 (12회 × 3)', how: '밴드를 고정하고 팔꿈치를 몸에 붙인 채 바깥으로 돌렸다가 3초에 걸쳐 천천히 돌아오기 — 12회씩 3세트, 주 3번.' },
        { name: '벽에 등 대고 팔 위아래 밀기 (10회 × 2)', how: '벽에 등을 대고 팔을 벽에 붙여 위아래로 밀어 올리기 — 10회씩 2세트, 머리 위로 치기 전에 어깨 날개부터 고정해요.' }
      ],
      source: SHOULDER_SRC,
      sourceShort: SHOULDER_SRC_SHORT,
      stats: SHOULDER_RISK
    };
  }

  function guardLower() {
    return {
      label: '무릎·발목',
      title: '무릎·발목 보호 체크',
      thresholdTitle: '쉬운 기준',
      checkTitle: '조심할 동작',
      guideTitle: '오늘 할 것',
      thresholds: [
        '배드민턴에서 가장 많이 다치는 곳이 다리이고, 부상은 대부분 경기·훈련 끝날 때 몰려요',
        '피곤해지면 무릎을 굽히는 힘과 착지에서 버티는 힘이 먼저 떨어져요',
        '포핸드보다 백핸드 쪽으로 길게 뻗는 런지가 무릎에 더 위험해요',
        '대각선 뒤로 빠지면서 발끝부터 먼저 닿으면 발목이 접질리기 쉬워요',
        '런지로 앞으로 딛을 때 발끝을 몸 안쪽으로 말아 딛으면(안쪽으로 말기 · toe-in) 뒤꿈치에 힘이 몰리고 발목이 바깥으로 꺾이는 부담이 커져요',
        '같은 런지라도 발끝을 몸이 가는 방향이나 조금 바깥으로 열어 딛으면(바깥으로 열기 · toe-out) 발목이 바깥으로 꺾이는 힘과 뒤꿈치 충격이 줄어요',
        '점프 스매시에서 내려올 때 두 무릎이 안쪽으로 모이면 무릎 안쪽 인대에 부담이 커져요 — 무릎은 발끝과 같은 방향으로 두고 부드럽게 내려앉아야 해요',
        '급하게 방향을 바꾸다 발목을 접질리는 경우가 가장 많아요 — 방향을 바꾸기 직전에 가볍게 한 번 뛰어 두 발을 살짝 떼는 스플릿 스텝을 넣으면 백핸드 쪽으로 길게 뻗을 때 발목이 비틀리는 부담이 줄어요'
      ],
      checks: [
        { name: '백핸드 앞쪽 런지 조심', how: '포핸드보다 백핸드 쪽으로 길게 뻗을 때 무릎에 비틀리는 힘이 더 실려요. 지친 마지막 세트엔 무리해서 깊게 뻗지 마세요.' },
        { name: '대각선 뒤로 빠질 때 발바닥 전체로 착지', how: '뒤·옆으로 물러나면서 발끝부터 먼저 닿으면 발목을 삐기 쉬워요.' },
        { name: '마지막 세트 런지 5개로 확인', how: '지친 마지막 세트에 백핸드 런지 5개를 해 보고 무릎이 안으로 무너지거나 발이 미끄러지면 오늘은 더 뛰지 마세요.' },
        { name: '런지 착지 발끝 방향', how: '앞으로 런지할 때 딛는 발끝이 몸 안쪽으로 말려 있으면(toe-in) 뒤꿈치에 힘이 몰려요. 발끝을 몸이 가는 방향에서 조금 바깥으로 ' + LOWER_RISK.toeOutDeg + '도 정도 열어(toe-out) 딛으면 발목이 바깥으로 꺾이는 힘과 뒤꿈치 충격이 줄어요.' },
        { name: '점프 착지 무릎 정렬', how: '점프 스매시에서 내려올 때 무릎이 안쪽으로 모이면(무릎이 X자로 무너지면) 무릎 인대에 부담이 커져요. 착지 전에 무릎을 발끝 방향으로 벌리고 엉덩이를 살짝 뒤로 빼며 두 발로 부드럽게 내려앉으세요.' },
        { name: '방향 바꾸기 전 스플릿 스텝 한 번', how: '급하게 돌아서거나 착지할 때 발목이 안쪽으로 꺾이면 접질리기 쉬워요. 방향을 바꾸기 직전에 가볍게 한 번 뛰어 두 발을 살짝 떼는 스플릿 스텝으로 멈춘 뒤 발바닥 전체로 디디세요. 같은 선수 18명을 비교한 연구에서 이렇게 스플릿 스텝을 넣으면 백핸드 쪽으로 길게 뻗을 때 발목이 덜 비틀렸어요.' }
      ],
      guides: [
        { name: '허벅지 앞 힘 기르기 (계단 오르기 → 런지 → 한 발 내리기)', how: '20cm 계단 오르내리기 12회 → 앞으로 런지 10회 → 한 발로 천천히 내려오기 8회, 주 2~3번(무릎이 아프면 앞 단계만).' },
        { name: '엉덩이 힘 기르기 (엉덩이 들기 · 옆으로 걷기)', how: '누워서 엉덩이 들어올리기 15회 × 3 + 밴드 걸고 옆으로 걷기 10걸음 × 2 — 피곤할 때 제일 먼저 풀리는 힘이에요.' },
        { name: '발목 버티기 (한 발 서기 · 밴드 4방향)', how: '한 발로 30초 서기 2번(익숙해지면 눈 감고) + 밴드 4방향 15회 — 착지 순간 발목을 잡아 주는 힘이에요.' }
      ],
      source: LOWER_SRC,
      sourceShort: LOWER_SRC_SHORT,
      stats: LOWER_RISK
    };
  }

  /* 팔꿈치·손목 보호 체크 — 라켓을 계속 쥐고 손목으로 마무리하는 동작의 과사용
   * 화면은 쉬운 말(동호인 열 명 중 셋, 팔꿈치 바깥쪽, 그립 힘)로만 쓰고
   * 정확한 출처·수치는 stats와 참고 논문 한 줄에 담습니다. */
  function guardArm() {
    return {
      label: '팔꿈치·손목',
      title: '팔꿈치·손목 보호 체크',
      thresholdTitle: '쉬운 기준',
      checkTitle: '자가 체크',
      guideTitle: '오늘 할 것',
      thresholds: [
        '배드민턴은 라켓을 계속 쥐고 손목으로 마무리해서, 동호인 열 명 중 셋꼴로 팔꿈치·손목 힘줄 통증을 겪어요',
        '그중 제일 흔한 게 바깥쪽 팔꿈치(라켓 엘보)예요 — 팔을 뻗어 손등을 위로 든 채 손목을 누를 때 아프면 이쪽이에요',
        '운동 전후 팔·손목 스트레칭을 하지 않는 선수는 조사에서 전원이 통증을 겪었어요',
        '손목 새끼손가락 쪽이 아프면 그립을 꽉 쥐는 습관과 손목 스냅을 먼저 의심하세요'
      ],
      checks: [
        { name: '손등을 위로 두고 손목 눌러 보기', how: '팔을 앞으로 뻗고 손등이 위를 보게 한 뒤 반대 손으로 손목을 아래로 살짝 눌러 3초 — 팔꿈치 바깥이 찌르듯 아프면 라켓 엘보 신호예요.' },
        { name: '컵이나 라켓 들 때 아픈지', how: '가벼운 컵을 들 때도 팔꿈치 바깥이 아프면 근력보다 그립을 꽉 쥐는 습관부터 고치세요.' },
        { name: '손목 돌릴 때 힘이 빠지는지', how: '손목을 새끼손가락 쪽으로 돌릴 때 아프거나 힘이 빠지면 그립 두께와 손목 스냅 양을 먼저 줄이세요.' }
      ],
      guides: [
        { name: '손목 천천히 내리기 (15회 × 3세트, 주 3번)', how: '가벼운 물병을 들고 손목을 위로 든 뒤 4~5초에 걸쳐 천천히 내리기 — 아프지 않은 무게로 15회씩 3세트, 4주 이상 꾸고히. 통증이 6/10을 넘으면 무게를 낮추세요.' },
        { name: '팔뚝·손목 스트레칭 (20~30초 × 3번)', how: '손바닥을 벽에 대고 팔을 편 채 몸을 살짝 돌려 20~30초, 이어 손등을 벽에 대고 같은 방법으로 — 코트 오기 전과 마친 뒤 매일.' },
        { name: '그립은 10에 3 힘으로', how: '라켓을 쥜 때 손가락 힘을 10에 3 정도로 두고 치는 순간에만 살짝 조이기 — 힘을 빼면 팔꿈치·손목에 가는 부담이 줄어요.' },
        { name: '손목 스냅은 마지막에 짧게', how: '스매시는 팔꿈치를 먼저 올리고 손목은 마지막에 짧게 — 손목만 튕기는 습관이 팔꿈치 힘줄을 먼저 지치게 해요.' }
      ],
      source: ARM_SRC,
      sourceShort: ARM_SRC_SHORT,
      stats: ARM_RISK
    };
  }

  /* ---------- 무릎 통증 · 허벅지 뒤 뻣뻣함 → 허리 통증 연쇄 예방 (bm-v1.83.0) ----------
   * [APRI23] 무릎 부상 이력이 있는 주니어 선수는 허벅지 뒤(햄스트링) 유연성과 몸통 근력이 함께 낮았고,
   *   그게 허리 통증 위험으로 이어졌습니다. [SATRA25] 허리 통증이 있는 동호인은 몸통 회전 버티기의
   *   좌우 차이가 기능 불편과 연결됐습니다(일반 코어 운동만으로는 부족).
   * 화면에서는 '무릎이 아프면 허리까지 온다'는 연쇄만 쉬운 말로 설명하고, 용어·수치는 stats에만 둡니다. */
  var CHAIN = {
    label: '무릎·허리 연쇄',
    title: '무릎 → 허리 연쇄 보호',
    thresholdTitle: '쉬운 기준',
    checkTitle: '자가 체크',
    guideTitle: '오늘 할 것',
    reasonKnee: '무릎이 불편하거나 허벅지 뒤쪽이 뻣뻣하면 몸통 힘이 떨어져 허리까지 아파질 수 있어요. 운동 전후 허벅지 뒤 스트레칭과 양쪽 균형 코어 버티기(사이드 플랭크)를 같이 챙겨 주세요.',
    reasonBack: '허리가 불편한 날은 허벅지 뒤가 뻣뻣하거나 몸통 좌우 힘이 기울어져 있을 때가 많아요. 운동 전후 허벅지 뒤 스트레칭과 양쪽 균형 코어 버티기(사이드 플랭크)를 같이 챙겨 주세요.',
    thresholds: [
      '무릎이 아파 다리를 덜 쓰면 그쪽 허벅지·엉덩이 힘이 먼저 빠져요',
      '허벅지 뒤가 뻣뻣하면 허리를 대신 굽혀 숙이게 되고, 그게 허리 통증으로 이어져요',
      '몸통 좌우 버티는 힘이 한쪽만 약해도 스매시 회전 때 허리가 버티다 지쳐요'
    ],
    checks: [
      { name: '허벅지 뒤 뻣뻣한지', how: '바닥에 앉아 한쪽 다리를 펴고 손이 발끝에 닿는지 봅니다. 무릎이 굽거나 허리가 둥글게 말리면 허벅지 뒤가 굳은 신호예요.' },
      { name: '한쪽만 아픈지', how: '무릎이 아픈 쪽 다리를 덜 쓰면 엉덩이·허리 힘이 그쪽만 빠집니다. 아픈 쪽과 반대쪽을 나란히 비교해 보세요.' },
      { name: '사이드 플랭크 좌우 시간', how: '옆으로 누워 팔꿈치로 버티며 좌우 시간을 재 봅니다. 한쪽이 20% 넘게 짧으면 그쪽 몸통이 약한 신호예요.' }
    ],
    guides: [
      { name: '허벅지 뒤 스트레칭 30초 × 좌우 2번', how: '앉아서 한 다리를 펴고 허리를 편 채 몸을 앞으로 — 숨을 내쉬며 30초, 좌우 2번씩. 코트 오기 전과 마친 뒤에 해요.' },
      { name: '사이드 플랭크 좌우 같은 시간 (20초 × 2)', how: '옆으로 누워 팔꿈치·발 옆면으로 버팁니다. 약한 쪽을 더 길게 하지 말고, 양쪽을 같은 시간으로 채워 좌우 차이를 줄이세요.' },
      { name: '엉덩이 들기 · 새처럼 버티기 10회', how: '누워서 엉덩이 들어올리기 15회 + 네 발로 엎드려 반대 팔·다리 뻗기 10회씩. 허리를 젖히지 말고 배에 힘을 주세요.' }
    ],
    stats: {
      kneeFlexR: { male: -0.575, female: -0.304 },
      kneeTmsR: { male: -0.227, maleP: 0.082, female: -0.354, femaleP: 0.006 },
      backRotationR: 0.174, backRotationP: 0.049
    },
    source: 'Apriantono et al., Int J Hum Mov Sports Sci 11(5), 2023 (DOI: 10.13189/saj.2023.110504) · ' +
      'Satra & Bhurke, IOSR J Sports Phys Educ 12(5):01-06, 2025 (DOI: 10.9790/6737-1205010612)',
    sourceShort: '참고 논문 · Apriantono 2023 Int J Hum Mov Sports Sci · Satra 2025 IOSR'
  };

  /* 통증 부위가 무릎·허리(·허벅지)일 때 연쇄 예방 카드를 켜고, 어느 쪽에서 시작됐는지에 맞춰 문장을 고릅니다 */
  function guardChain(painList) {
    var pains = (painList || []).filter(Boolean);
    var areas = pains.filter(function (p) { return p === '무릎' || p === '허리' || p === '허벅지'; });
    var back = areas.indexOf('허리') >= 0;
    var knee = areas.indexOf('무릎') >= 0;
    return {
      label: CHAIN.label,
      title: CHAIN.title,
      thresholdTitle: CHAIN.thresholdTitle,
      checkTitle: CHAIN.checkTitle,
      guideTitle: CHAIN.guideTitle,
      on: areas.length > 0,
      level: back ? 'back' : (knee ? 'knee' : 'hamstring'),
      areas: areas.slice(),
      reason: areas.length ? (back ? CHAIN.reasonBack : CHAIN.reasonKnee) : '',
      thresholds: CHAIN.thresholds.slice(),
      checks: CHAIN.checks.map(function (x) { return { name: x.name, how: x.how }; }),
      guides: CHAIN.guides.map(function (x) { return { name: x.name, how: x.how }; }),
      source: CHAIN.source,
      sourceShort: CHAIN.sourceShort,
      stats: CHAIN.stats
    };
  }

  /* jointGuard(painList, weakSkills, ctx)
   *   → { shoulder:{on,level,reason,...}, lower:{on,level,reason,window,...} }
   * 어깨: 통증에 '어깨'가 있거나 스매시·클리어(오버헤드)를 고른 날
   * 하지: 무릎·발목·아킬레스건 통증, 풋워크(런지 많은 날), 강도 8 이상·90분 이상, 주간 부하 급증
   * 같은 입력이면 항상 같은 결과 (순수 함수) */
  function jointGuard(painList, weakSkills, ctx) {
    ctx = ctx || {};
    var pains = (painList || []).slice();
    var weak = (weakSkills || []).slice();
    var intensity = ctx.intensity == null ? null : Number(ctx.intensity);
    var minutes = ctx.minutes == null ? null : Number(ctx.minutes);
    var zone = (ctx.load && ctx.load.zone) || '';
    var heavy = (intensity != null && intensity >= LOWER_RISK.heavyIntensity) ||
      (minutes != null && minutes >= LOWER_RISK.heavyMinutes) || zone === 'spike';

    /* ---- 어깨 ---- */
    var shoulderPain = pains.indexOf('어깨') >= 0;
    var overhead = weak.indexOf('스매시') >= 0 || weak.indexOf('클리어') >= 0;
    var shoulder = guardShoulder();
    shoulder.on = shoulderPain || overhead;
    shoulder.level = shoulderPain ? 'pain' : (overhead ? 'overhead' : '');
    if (shoulderPain) {
      shoulder.reason = PAIN_RULE.stop + ' 어깨를 오늘 통증 부위로 남겼어요. 주로 쓰는 어깨가 반대쪽보다 안으로 덜 돌아가거나, 뒤쪽 버티는 힘이 약하면 스매시·클리어 때 어깨가 찝히기 쉬워요. 오늘은 스매시·클리어 개수를 절반으로 줄이고 아래 세 가지를 먼저 해 보세요.';
    } else if (overhead) {
      shoulder.reason = '주로 쓰는 어깨가 반대쪽보다 안으로 덜 돌아가거나, 뒤쪽 버티는 힘이 약하면 스매시·클리어 때 어깨가 찝히기 쉬워요. 머리 위로 치는 날은 코트 전후로 아래 3가지를 넣어 주면 훨씬 편해져요.';
    } else {
      shoulder.reason = '';
    }

    /* ---- 무릎·발목 ---- */
    var lowerPain = pains.filter(function (p) { return p === '무릎' || p === '발목' || p === '아킬레스건'; });
    var footwork = weak.indexOf('풋워크') >= 0;
    var lower = guardLower();
    lower.on = lowerPain.length > 0 || footwork || heavy;
    lower.level = lowerPain.length ? 'pain' : (heavy ? 'fatigue' : (footwork ? 'lunge' : ''));
    lower.pain = lowerPain.slice();
    lower.window = heavy
      ? '오늘은 ' + (minutes != null ? minutes + '분' : '훈련') + ' · 강도 ' + (intensity != null ? intensity : '-') +
        ' — 길거나 센 날은 마지막 30분에 다리 부상이 몰려요. 마지막 세트부터 백핸드 쪽 런지를 절반으로 줄이고, 대각선 뒤로 빠질 때는 발바닥 전체로 착지하세요.'
      : '';
    if (lowerPain.length) {
      lower.reason = PAIN_RULE.stop + ' ' + lowerPain.join('·') + '을 오늘 통증 부위로 남겼어요. 배드민턴 다리 부상은 대부분 지친 경기 후반에 몰려요. 오늘은 백핸드 쪽 런지와 깊은 런지를 줄이고 아래 보강을 먼저 하세요.';
    } else if (heavy) {
      lower.reason = '배드민턴 다리 부상은 대부분 지친 경기 후반에 몰려요. 피곤할수록 무릎이 덜 굽혀지고 착지가 딱딱해지거든요. 오늘처럼 길거나 센 날은 후반으로 갈수록 런지 질이 먼저 떨어지니 개수보다 착지와 무릎 정렬을 보세요.';
    } else {
      lower.reason = '배드민턴 다리 부상은 대부분 지친 경기 후반에 몰려요. 피곤할수록 무릎이 덜 굽혀지고 착지가 딱딱해지거든요. 풋워크·런지가 많은 오늘은 후반 착지가 흐트러지기 쉬우니 백핸드 쪽으로 깊게 뻗는 런지를 줄이고 발바닥 전체로 착지하세요.';
    }

    var on = [];
    if (shoulder.on) on.push(shoulder.label);
    if (lower.on) on.push(lower.label);

    /* ---- 무릎·허리 연쇄 (무릎이 아프면 허리까지 이어지는 고리) ---- */
    var chain = guardChain(pains);
    if (chain.on) on.push(chain.label);

    /* ---- 팔꿈치·손목 (라켓 엘보·손목 과사용) ----
     * 통증이 있을 때, 또는 머리 위 샷·드라이브를 약점으로 골랐는데
     * 강도가 세거나 길게 친 날(과사용이 쌓이기 쉬운 날)에 켜집니다. */
    var armPain = pains.filter(function (p) { return p === '팔꿈치' || p === '손목'; });
    var armWork = overhead;
    var arm = guardArm();
    arm.on = armPain.length > 0 || (armWork && heavy);
    arm.level = armPain.length ? 'pain' : (armWork && heavy ? 'load' : '');
    arm.pain = armPain.slice();
    if (armPain.length) {
      arm.reason = PAIN_RULE.stop + ' ' + armPain.join('·') + ' 통증을 오늘 일지에 남겼어요. 배드민턴은 라켓을 계속 쥐고 손목으로 마무리하는 동작이 많아 팔꿈치·손목 힘줄이 먼저 지쳐요. 오늘은 스매시·드라이브 개수를 절반으로 줄이고 그립 힘을 빼면서, 아래 네 가지를 먼저 해 보세요.';
    } else if (armWork && heavy) {
      arm.reason = '오늘은 머리 위 샷이나 드라이브를 많이 치는 날이에요. 스매시를 몰아 치면 팔꿈치·손목에 부담이 쌓여요. 세트 사이에 손목을 풀고, 코트 전후로 아래 스트레칭과 천천히 내리기를 넣어 주세요.';
    } else {
      arm.reason = '';
    }
    if (arm.on) on.push(arm.label);

    return {
      title: '관절 보호 체크',
      areas: on,
      label: on.length > 2 ? on[0] + ' 외 ' + (on.length - 1) + '곳' : on.join(' · '),
      shoulder: shoulder,
      lower: lower,
      chain: chain,
      arm: arm,
      heavy: heavy,
      painStop: on.length ? PAIN_RULE.stop : ''
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
      drill: '전후 코너 셔틀콕 연속 받기 8~12초',
      heart: '최대 심박수의 평균 88.8% · 최고 96.8% (복식은 75.5% · 89.0%)',
      steps: '게임당 593.8보 (복식 314.5보)',
      tips: [
        '단식은 몸무게 대비 움직이는 양도, 힘 쓰는 정도도 복식보다 커요 — 주 2회 하체 근력과 회복을 같이 챙기세요.',
        '심박이 최대 심박수의 96.8%까지 올라요. 세트 사이 60~90초는 줄이지 말고, 3세트째는 랠리 길이만 2초 줄이세요.'
      ]
    },
    '남자복식': {
      rally: '6~10초 (실전 평균 5.6~6.7초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '드라이브·전위 연타 연속 받기 6~10초',
      heart: '최대 심박수의 평균 75.5% · 최고 89.0%',
      steps: '게임당 314.5보',
      tips: [
        '남자복식·혼합복식은 랠리가 가장 짧고 타구 빈도가 가장 높습니다 — 길게 끌지 말고 6~10초 초고빈도로 치세요.',
        '짧은 랠리 사이 회복도 짧아 심박 변동이 큽니다. 세트 사이 45~60초를 지키고 3세트부터는 드라이브 비중을 줄이세요.'
      ]
    },
    '혼합복식': {
      rally: '6~10초 (실전 평균 5.6~6.7초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '전위 연타·중앙 드라이브 연속 받기 6~10초',
      heart: '최대 심박수의 평균 75.5% · 최고 89.0%',
      steps: '게임당 314.5보',
      tips: [
        '혼합복식은 남자복식과 함께 랠리가 가장 짧고 타구 빈도가 가장 높습니다 — 전위 연타 위주로 6~10초 반복하세요.',
        '남녀 역할이 나뉘니 남성은 후위 연속 공격, 여성은 전위 좌우 커버를 각각 세트로 나눠 부하를 맞추세요.'
      ]
    },
    '여자복식': {
      rally: '10~12초 (실전 평균 약 10.1초)',
      workRest: '1:1~1:1.5 — 10~12초 랠리 뒤 10~15초',
      drill: '지속 랠리 연속 받기 10~12초',
      heart: '최대 심박수의 평균 75.5% · 최고 89.0% (복식 기준)',
      steps: '게임당 314.5보 (복식 기준)',
      tips: [
        '여자복식은 랠리가 가장 길고 실제 경기시간 비율도 가장 높습니다 — 10~12초를 끊기지 않게 이어 가는 훈련이 맞습니다.',
        '랠리가 길어 실점이 천천히 쌓입니다. 세트 사이는 짧게 가져가되 3세트째에도 랠리 수를 줄이지 마세요.'
      ]
    },
    '복식': {
      rally: '6~10초 (남자복식·혼합복식 5.6~6.7초 · 여자복식 약 10.1초)',
      workRest: '1:1.5 — 6~10초 랠리 뒤 10~15초',
      drill: '드라이브·전위 연타 연속 받기 6~10초',
      heart: '최대 심박수의 평균 75.5% · 최고 89.0%',
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
   *   → 주력 종목의 랠리 길이·일:휴식 비율·심박·셔틀콕 연속 받기 기준을 급수에 맞춰 */
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
          how: '어깨 밴드 돌리기 · 발목 밴드 · 엉덩이 스트레칭으로 몸을 먼저 만듭니다. 코트에 들어가자마자 폼이 나오게 하는 단계예요.'
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
          how: '본 웨이트 전 예열. 무릎과 엉덩이가 데워진 뒤에 무게를 잡습니다(찬 몸으로 시작하면 무릎이 먼저 아픕니다).'
        },
        {
          name: '스트레칭', min: 10,
          how: '엉덩이 · 허벅지 뒤 · 가슴을 풀어 스쿼트와 벤치 자세를 먼저 만듭니다.'
        },
        {
          name: '본 웨이트', min: 50,
          how: '불가리안 스플릿 스쿼트(양손 덤벨 · 뒷발 받침대 · 뒷무릎이 바닥아래까지 깊이) → 스쿼트 → 레그 익스텐션 → 벤치프레스 → 턱걸이 순서로.',
          moves: ['불가리안 스플릿 스쿼트 (양손 덤벨 · 뒷발 받침대 · 뒷무릎 아래까지 깊게)', '스쿼트', '레그 익스텐션', '벤치프레스', '턱걸이']
        },
        {
          name: '마무리 폼롤러 30분', min: 30,
          how: '허벅지 앞 · 옆, 종아리, 등 · 어깨를 폼롤러로 30분 천천히. 뭉친 근육을 풀고 회복을 여기서 끝내고 나옵니다.'
        }
      ]
    },
    core: {
      title: '코어 · 허리 보강',
      when: '웨이트 날 본 웨이트 뒤에 3종, 코트 날은 바닥에서 1~2세트만',
      items: [
        {
          name: '행잉 레그 레이즈', sets: '20회 × 3세트',
          how: '철봉 · 바 위에 매달려 다리를 듭니다. 몸이 흔들리면 허리로 들지 말고 배에 힘을 주고 내려 주세요.'
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

  /* ---------- 통증 중단 기준 (bm-v1.53.0) ----------
   * 체전 1등 선수가 직접 말한 기준입니다:
   *   "아프다는 느낌이 들면 바로 쉬고 상태를 보는 게 최고라 생각해. 조금 아프더라도."
   * 그래서 앱은 '가벼우면 한 세트만 더'처럼 애매하게 넘기지 않고,
   * 조금이라도 아프면 그 자리에서 멈추는 기준을 먼저 말합니다. */
  var PAIN_RULE = {
    label: '통증 중단 기준',
    stop: '조금이라도 아픈 느낌이 들면 바로 코트를 멈추고 쉬면서 상태를 보는 게 제일 안전해요.',
    short: '조금 아파도 바로 멈추고 쉬기',
    next: '내일은 그 부위가 아침에 어떤지 먼저 보고, 괜찮을 때만 가볍게 시작하세요.',
    source: '체전 1등 선수 현장 기준(2026-11-22) — 조금 아프더라도 바로 쉬고 상태 보기'
  };

  /* ---------- 통증 부위에 부담 없는 드릴 (bm-v1.72.0) ----------
   * "무릎 쉬기"라고 안내해 놓고 바로 아래에서 육각 풋워크(30초×5세트)를 추천하던
   * 모순을 없앱니다(2026-11-25 06시 점검).
   *   · 하체 통증(무릎·발목 등) → 다리를 쓰지 않는 상체·스트레칭·회복으로 바꿉니다.
   *   · 상체 통증(어깨·팔꿈치 등) → 머리 위·팔을 많이 쓰는 드릴만 빼고 안전한 드릴로 채웁니다.
   * 드릴 이름과 설명에 이 낱말이 있으면 그 부위에 부담이 큰 동작으로 봅니다. */
  var PAIN_LOAD_WORDS = {
    '무릎': ['풋워크', '스텝', '점프', '착지', '런지', '섀도', '전후', '좌우', '수비', '로테이션'],
    '발목': ['풋워크', '스텝', '점프', '착지', '런지', '섀도', '전후', '좌우', '수비'],
    '아킬레스건': ['풋워크', '스텝', '점프', '착지', '런지', '섀도', '전후', '좌우'],
    '종아리': ['풋워크', '스텝', '점프', '착지', '섀도', '전후'],
    '허벅지': ['풋워크', '스텝', '점프', '착지', '런지', '섀도'],
    '고관절': ['풋워크', '스텝', '점프', '착지', '런지', '섀도'],
    '허리': ['점프', '착지', '스매시', '섀도'],
    '어깨': ['스매시', '클리어', '킬', '리프트', '서브'],
    '팔꿈치': ['스매시', '드라이브', '클리어'],
    '손목': ['스매시', '드라이브', '헤어핀', '푸시', '킬'],
    '손가락': ['스매시', '드라이브', '헤어핀', '푸시']
  };
  var PAIN_LOWER_AREAS = ['무릎', '발목', '아킬레스건', '종아리', '허벅지', '고관절', '발', '정강이'];
  var PAIN_UPPER_AREAS = ['어깨', '팔꿈치', '손목', '손가락', '팔', '가슴', '등'];

  /* 통증이 있을 때 대신 넣는 드릴 — 부위에 부담을 싣지 않는 것만 */
  var PAIN_SAFE_DRILLS = {
    lower: [
      { name: '앉아서 상체 스트록 폼', method: '의자에 앉아 어깨 회전과 라켓 펴기만 반복합니다. 무릎·발목에 체중을 싣지 않아요.', sets: '10분 · 2세트', point: '아픈 다리는 그대로 두고 상체만' },
      { name: '통증 부위 가벼운 스트레칭', method: '오늘 아픈 부위 주변을 아프지 않은 범위까지만 30초씩 천천히 늘립니다.', sets: '30초 × 2', point: '조금이라도 아프면 바로 멈추기' },
      { name: '회복 · 냉온 찜질 가이드', method: '오늘은 코트 대신 붓기가 있으면 15분 냉찜질, 2주 넘게 이어지면 병원에 다녀오세요.', sets: '15분', point: '쉬는 날도 훈련이에요' }
    ],
    upper: [
      { name: '하체 풋워크 6방향', method: '라켓을 내려놓고 발놀림만 합니다. 어깨·팔에 힘을 싣지 않아요.', sets: '30초 × 3세트', point: '상체는 편하게, 발만 빠르게' },
      { name: '코어 · 호흡 정리', method: '누워서 무릎을 굽혀 허리를 바닥에 붙이고 호흡합니다. 팔을 쓰지 않아요.', sets: '10분', point: '허리는 바닥에 붙이고 천천히' },
      { name: '통증 부위 가벼운 스트레칭', method: '아픈 부위는 아프지 않은 범위까지만 30초씩 천천히 늘립니다.', sets: '30초 × 2', point: '조금이라도 아프면 바로 멈추기' }
    ],
    both: [
      { name: '통증 부위 가벼운 스트레칭', method: '아픈 부위는 아프지 않은 범위까지만 30초씩 천천히 늘립니다.', sets: '30초 × 2', point: '조금이라도 아프면 바로 멈추기' },
      { name: '호흡 정리 · 회복 10분', method: '앉거나 누워서 긴 호흡으로 몸을 낮춥니다. 오늘은 회복이 먼저예요.', sets: '10분', point: '숨을 끝까지 내쉬기' },
      { name: '회복 · 냉온 찜질 가이드', method: '붓기가 있으면 15분 냉찜질, 2주 넘게 이어지면 병원에 다녀오세요.', sets: '15분', point: '쉬는 날도 훈련이에요' }
    ]
  };

  function painAreaKind(areas) {
    var lower = false, upper = false;
    (areas || []).forEach(function (a) {
      if (PAIN_LOWER_AREAS.indexOf(a) >= 0) lower = true;
      else if (PAIN_UPPER_AREAS.indexOf(a) >= 0) upper = true;
    });
    if (lower && upper) return 'both';
    if (lower) return 'lower';
    if (upper) return 'upper';
    return 'lower';   /* 모르는 부위는 다리를 쓰지 않는 쪽으로 안전하게 */
  }

  function drillLoadHit(drill, words) {
    var text = String((drill && drill.name) || '') + ' ' + String((drill && drill.method) || '');
    for (var i = 0; i < words.length; i++) if (words[i] && text.indexOf(words[i]) >= 0) return words[i];
    return '';
  }

  /* 통증 부위 → 부담 없는 드릴 3개 + 화면에 쓸 안내 한 줄 */
  function painSafeDrills(drills, areas, level) {
    var list = U.uniq((areas || []).filter(Boolean));
    var out = { drills: (drills || []).slice(), note: '', swapped: [] };
    if (!list.length) return out;
    var kind = painAreaKind(list);
    var words = [];
    list.forEach(function (a) { words = words.concat(PAIN_LOAD_WORDS[a] || []); });
    if (!words.length) words = ['점프', '착지', '풋워크'];

    /* 하체 통증이면 다리를 쓰는 드릴을 통째로 빼고 상체·스트레칭·회복으로 바꿉니다 */
    if (kind === 'lower' || kind === 'both') {
      var safe = PAIN_SAFE_DRILLS[kind].map(function (d) {
        return { name: d.name, level: level || LEVEL_FALLBACK, method: d.method, sets: d.sets, point: d.point, safeFor: list.slice() };
      });
      out.drills = safe;
      out.swapped = (drills || []).filter(function (d) { return drillLoadHit(d, words); }).map(function (d) { return d.name; });
      out.note = list.join('·') + ' 통증이 있어 오늘 추천 드릴은 ' + list.join('·') +
        '에 부담이 큰 동작 대신 상체·스트레칭·회복 3가지로 바꿨어요.';
      return out;
    }

    /* 상체 통증이면 머리 위·팔을 많이 쓰는 드릴만 빼고 나머지로 채웁니다 */
    var kept = [];
    var dropped = [];
    (drills || []).forEach(function (d) {
      if (drillLoadHit(d, words)) dropped.push(d.name); else kept.push(d);
    });
    var topUp = PAIN_SAFE_DRILLS.upper.map(function (d) {
      return { name: d.name, level: level || LEVEL_FALLBACK, method: d.method, sets: d.sets, point: d.point, safeFor: list.slice() };
    });
    topUp.forEach(function (d) {
      if (kept.length < 3 && !kept.some(function (x) { return x.name === d.name; })) kept.push(d);
    });
    out.drills = kept.slice(0, 3);
    out.swapped = dropped;
    if (dropped.length) {
      out.note = list.join('·') + ' 통증이 있어 ' + list.join('·') + '에 부담이 큰 드릴 ' + dropped.length +
        '개를 빼고, 부담 없는 드릴로 채웠어요.';
    }
    return out;
  }

  /* ---------- 피로가 쌓인 날의 점프 스매시 전환 (bm-v1.83.0) ----------
   * [CHENG24] 배드민턴 동작으로 피로를 유도하자 수직 점프 높이가 약 3~4cm 낮아지고
   *   내려앉는 구간의 하강 가속도(=착지 충격)가 커졌습니다. 화면에는 눈금·용어 없이
   *   "점프가 낮아지고 착지 충격이 커진다"는 쉬운 말로만 쓰고, 수치는 stats에 담습니다.
   * 조건: 점프·스매시를 오늘 고르거나 추천했는데 (1) 컨디션 4 이하  (2) 최근 3일 안에
   *   강도 8 이상 훈련이 2번 이상  (3) 주간 부하 급증 — 셋 중 하나라도 해당할 때.
   * 이미 다리 통증으로 멈춘 날은 통증 중단 기준이 먼저라 이 카드를 켜지 않습니다. */
  var FATIGUE_JUMP = {
    label: '피로 점프 전환',
    title: '피로할 때 점프 스매시',
    lowCond: 4,
    hardIntensity: 8,
    recentDays: 3,
    recentHard: 2,
    jumpPick: ['스매시', '점프'],
    jumpLoad: ['점프 착지', '점프 스매시', '연속 스매시', '점프'],
    reasonLow: '몸이 피로하면 점프가 평소보다 낮아지고 착지할 때 무릎·발목 충격이 커져요. 후반엔 연속 점프 스매시 대신 네트 앞 짧은 볼과 안정적인 풋워크 위주로 전환하세요.',
    reasonLoad: '요 며칠 센 훈련이 이어져 다리에 피로가 쌓였어요. 이 상태에선 점프가 평소보다 낮아지고 착지할 때 무릎·발목 충격이 커져요. 후반엔 연속 점프 스매시 대신 네트 앞 짧은 볼과 안정적인 풋워크 위주로 전환하세요.',
    note: '오늘은 피로가 쌓여 점프 드릴 대신 네트 앞·스텝 드릴로 바꿨어요.',
    rehab: '오늘 후반은 연속 점프 스매시 대신 네트 앞 짧은 볼·낮은 스텝으로 바꾸기',
    chainStretch: '허벅지 뒤 스트레칭 30초 × 좌우 2 + 사이드 플랭크 좌우 같은 시간 20초 × 2',
    thresholds: [
      '피곤해지면 점프 높이가 3~4cm쯤 줄고, 내려앉을 때 다리에 걸리는 충격은 오히려 커져요',
      '그래서 점프가 낮아진 만큼 세게 치려고 더 힘을 쓰다 착지가 딱딱해지기 쉬워요',
      '피로한 후반일수록 점프 스매시를 몰아 치기보다 네트 앞 짧은 볼과 발놀림으로 점수를 만드는 게 안전해요'
    ],
    checks: [
      { name: '오늘 점프가 가볍게 되는지', how: '코트 오기 전 제자리 점프 3번을 해 보세요. 발이 바닥에서 떨어지는 높이가 평소보다 낮거나 착지할 때 ‘쿵’ 하고 무릎·발목이 찌릿하면 오늘은 점프 스매시를 줄이세요.' },
      { name: '마지막 세트 착지 소리', how: '후반으로 갈수록 착지 소리가 커지거나 무릎이 안쪽으로 모이면 그 세트에서 점프 스매시를 멈추고 네트 앞으로 바꾸세요.' },
      { name: '다리 무거움 확인', how: '계단 한 층을 올라가 봤을 때 허벅지가 평소보다 무겁게 느껴지면 오늘은 점프 개수를 절반으로 잡으세요.' }
    ],
    guides: [
      { name: '네트 앞 짧은 볼로 전환', how: '헤어핀·푸시를 번갈아 10분. 점프 없이 발만 살짝 뜨는 스텝으로 자리를 잡습니다.' },
      { name: '낮은 스텝 6방향', how: '뛰어오르지 않고 한 발씩 내디디는 낮은 스텝으로 6방향을 돕니다. 30초 × 3세트.' },
      { name: '드라이브 랠리로 감각 유지', how: '서서 드라이브만 3분씩 2번. 점프 없이 랠리 감각과 코스 보는 눈을 유지합니다.' }
    ],
    drills: [
      { name: '네트 앞 헤어핀·푸시 번갈아', method: '점프 없이 네트 앞에서 헤어핀과 푸시를 번갈아 놓습니다. 발은 바닥에서 살짝만 뜨는 스텝으로.', sets: '10분 · 2세트', point: '무릎·발목 충격 없이 손끝 감각만' },
      { name: '낮은 스텝 6방향 (점프 없이)', method: '한 발씩 내디디는 낮은 스텝으로 6방향을 돕니다. 뛰어오르지 않아요.', sets: '30초 × 3세트', point: '발이 바닥에서 뜨지 않게' },
      { name: '드라이브 랠리 3분', method: '서서 드라이브만 주고받기. 힘을 빼고 코스를 먼저 봅니다.', sets: '3분 × 2', point: '점프 없이 랠리 감각 유지' }
    ],
    stats: { jumpDropCm: 4, jumpDropCmMin: 3, squatAccelUp: 1.03, pJump: 0.01, pSquat: 0.05 },
    source: 'Cheng et al., Sports Health 17(1):126-134, 2024 (DOI: 10.1177/19417381241245908)',
    sourceShort: '참고 논문 · Cheng 2024 Sports Health (피로 뒤 점프 높이 3~4cm↓ · 착지 충격↑)'
  };

  /* fatigueJump(cond, weakSkills, ctx)
   *   ctx: { intensity, load, recentHard, pain }
   *   → { on, level:'low'|'load', label, title, reason, thresholds, checks, guides, drills, stats, source }
   * 무작위 없음 — 같은 입력이면 항상 같은 결과(순수 함수). */
  function fatigueJump(cond, weakSkills, ctx) {
    ctx = ctx || {};
    var c = cond == null ? null : Number(cond);
    var weak = weakSkills || [];
    var low = c != null && c <= FATIGUE_JUMP.lowCond;
    var recentHard = ctx.recentHard == null ? 0 : Number(ctx.recentHard);
    var zone = (ctx.load && ctx.load.zone) || '';
    var many = recentHard >= FATIGUE_JUMP.recentHard || zone === 'spike';
    var jumps = FATIGUE_JUMP.jumpPick.some(function (w) { return weak.indexOf(w) >= 0; });
    var lowerPain = (ctx.pain || []).some(function (p) { return PAIN_LOWER_AREAS.indexOf(p) >= 0; });
    var on = jumps && (low || many) && !lowerPain;
    return {
      on: on,
      level: low ? 'low' : (many ? 'load' : ''),
      label: FATIGUE_JUMP.label,
      title: FATIGUE_JUMP.title,
      reason: on ? (low ? FATIGUE_JUMP.reasonLow : FATIGUE_JUMP.reasonLoad) : '',
      note: FATIGUE_JUMP.note,
      thresholds: FATIGUE_JUMP.thresholds.slice(),
      checks: FATIGUE_JUMP.checks.map(function (x) { return { name: x.name, how: x.how }; }),
      guides: FATIGUE_JUMP.guides.map(function (x) { return { name: x.name, how: x.how }; }),
      drills: FATIGUE_JUMP.drills.map(function (x) {
        return { name: x.name, level: LEVEL_FALLBACK, method: x.method, sets: x.sets, point: x.point };
      }),
      stats: FATIGUE_JUMP.stats,
      source: FATIGUE_JUMP.source,
      sourceShort: FATIGUE_JUMP.sourceShort,
      recentHard: recentHard
    };
  }

  /* 점프·스매시 드릴을 네트 앞·스텝 드릴로 하나씩 바꿉니다(개수는 그대로 3개).
   * 통증 때문에 이미 통째로 바뀐 날(painSafeDrills)에는 바꿀 것이 없어 그대로 돌려줍니다. */
  function jumpSafeDrills(drills, level) {
    var list = (drills || []).slice();
    var out = { drills: [], swapped: [], note: '' };
    var pool = FATIGUE_JUMP.drills.map(function (d) {
      return { name: d.name, level: level || LEVEL_FALLBACK, method: d.method, sets: d.sets, point: d.point };
    });
    var pi = 0;
    list.forEach(function (d) {
      if (drillLoadHit(d, FATIGUE_JUMP.jumpLoad)) {
        out.swapped.push(d.name);
        if (pool[pi]) out.drills.push(pool[pi++]);
      } else {
        out.drills.push(d);
      }
    });
    while (out.drills.length < list.length && pool[pi]) out.drills.push(pool[pi++]);
    if (out.swapped.length) out.note = FATIGUE_JUMP.note;
    return out;
  }

  /* ---------- 실전 감각연습 + 오후 보강 웨이트 (bm-v1.68.0) ----------
   * 체전 1등 선수 현장에서 하던 하루를 그대로 옮겼습니다(사용자 제보·승인 2026-11-24).
   *   오전 코트: 몸풀기(양쪽 약 5분) → 2대1 감각연습 30분 → 뒷코트 감각연습 10분 = 약 45~50분
   *   오후 웨이트: 코어·허리 → 하체 → 상체·팔
   * 코트에서 쓰는 줄임말(2대1·뒷사각·백익스텐션…)은 처음 보는 사람도 알아듣게
   * 쉬운 말과 짧은 설명을 함께 적습니다. 실명은 쓰지 않고 '체전 1등 선수 현장 기준'으로만 부릅니다. */
  var SENSE = {
    title: '실전 감각연습 + 오후 보강 웨이트',
    note: '코트에서 손끝 감각을 깨운 뒤, 오후에는 몸을 받쳐 주는 보강을 하는 하루예요. 적힌 순서대로 하면 됩니다.',
    source: '체전 1등 선수 현장 훈련 기록(2026-11-24) · 스포츠의학 부상 예방 원칙',
    court: {
      title: '오전 · 코트 실전 감각연습',
      total: '약 45~50분',
      order: '몸풀기 5분 → 2대1 감각연습 30분 → 뒷코트 감각연습 10분',
      blocks: [
        {
          name: '몸풀기 — 손끝 감각 깨우기', min: 5, sides: '양쪽 약 5분',
          how: '네트 앞(헤어핀)부터 뒤쪽(드롭·스매시)까지 거리감을 깨우는 몸풀기예요. 드롭과 헤어핀을 번갈아 친 뒤, 마지막에는 드롭 · 헤어핀 · 스매시를 끊지 않고 이어서 쳐 보세요.',
          point: '힘으로 치는 단계가 아니라, 라켓에 공이 맞는 느낌(손끝 감각)과 발 디딤(스텝)을 먼저 깨우는 단계예요.'
        },
        {
          name: '2대1 감각연습 (두 명이 한 사람에게)', min: 30,
          how: '두 명이서 한 사람에게 공을 몰아줘 빠른 템포를 익히는 연습이에요. 공을 받는 사람은 빠른 공 속에서도 라켓면(공이 맞는 면)과 타점(공을 맞는 높이)을 매번 되새깁니다.',
          parts: [
            { name: '숏드라이브 10분', how: '네트 앞에서 짧게 주고받기. 손목을 많이 쓰지 않고 라켓면만 세워 방향을 바꿔요.' },
            { name: '드라이브 10분', how: '한 걸음 뒤에서 빠르게 주고받기. 공이 떨어지기 전에 맞히는 감각을 익혀요.' },
            { name: '드롭 10분', how: '뒤에서 네트 앞으로 살짝 떨어뜨리기. 세게 치지 않아도 상대가 잡기 어렵게 떨어지는 감각이에요.' }
          ],
          point: '세 가지 모두 목표는 하나예요. 빠른 템포에서도 라켓면과 타점이 흔들리지 않기. 중간에 자세가 무너지면 10초 쉬고 다시 시작하세요.'
        },
        {
          name: '뒷코트(뒷사각) 감각연습', min: 10,
          how: '코트 뒤쪽 양 모서리(왼쪽·오른쪽 뒷사각)까지 이동해 안정적으로 공을 넘기는 연습이에요. 파트너가 두 모서리를 번갈아 보내면, 돌아 나가 클리어나 드롭으로 넘기고 다시 가운데로 돌아옵니다.',
          point: '발이 먼저 도착하고 라켓이 따라가야 해요. 뒤로 갈 때 상체를 젖히지 말고 옆으로 돌아 들어가는 게 핵심입니다.'
        }
      ]
    },
    weight: {
      title: '오후 · 보강 웨이트',
      total: '약 50분',
      order: '코어 · 허리 → 하체 → 상체 · 팔',
      groups: [
        {
          name: '코어 · 허리 (몸통을 잡아 주는 힘)',
          items: [
            { name: '중량 크런치', load: '10kg', sets: '30개 × 5세트',
              how: '배에 10kg 원판(또는 덤벨)을 얹고 윗몸을 올려요. 목으로 당기지 말고 배에 힘을 주고 천천히 올라갑니다.' },
            { name: '백 익스텐션 3방향', load: '', sets: '1번에 10개',
              how: '엎드려서 허리·등을 들어 올리기(가운데·왼쪽·오른쪽 3방향을 1개로 묶어 10개). 스매시·하이클리어 뒤 허리를 받쳐 줍니다.' }
          ]
        },
        {
          name: '하체 (코트를 뛰는 다리)',
          items: [
            { name: '스쿼트', load: '선수 기준 80kg', sets: '10개 × 3세트',
              how: '무릎과 발끝 방향을 맞추고 앉았다 일어나요. 선수 기준은 80kg이지만 동호인·초보자는 맨몸이나 가벼운 무게부터 시작하세요.' },
            { name: '종아리 레이즈(카프 레이즈)', load: '', sets: '10개 × 3세트',
              how: '발끝으로 뒤꿈치를 들어 올렸다 천천히 내려요. 코트에서 앞뒤로 뛸 때 종아리가 버텨 줍니다.' }
          ]
        },
        {
          name: '상체 · 팔 (스매시를 버티는 힘)',
          items: [
            { name: '턱걸이', load: '', sets: '10개 × 3세트',
              how: '철봉에 매달려 가슴을 끌어올려요. 반동 없이 천천히. 힘들면 발을 살짝 대고 도와도 됩니다.' },
            { name: '덤벨컬', load: '10kg', sets: '10개씩',
              how: '팔꿈치를 몸에 붙이고 덤벨을 들어 올려요. 양팔 10개씩.' },
            { name: '어깨 보강', load: '', sets: '10개씩',
              how: '가벼운 덤벨로 옆으로 들어 올리기(사이드 레이즈) 10개씩. 스매시를 반복해도 어깨가 버티게 만듭니다.' },
            { name: '삼두 보강', load: '', sets: '10개씩',
              how: '팔꿈치를 고정하고 팔 뒤쪽 힘으로 펴기 10개씩. 스매시 마무리 힘을 만드는 동작이에요.' }
          ]
        }
      ],
      loadGuide: '선수 기준 중량은 스쿼트 80kg · 중량 크런치 10kg · 덤벨 10kg이에요. 동호인·초보자는 맨몸이나 가벼운 무게부터 내 몸에 맞춰 조절하세요. 5세트·3세트도 2~3세트로 줄여도 충분합니다.',
      stop: PAIN_RULE.stop + ' 무게를 줄여도 아프면 그 종목은 오늘 쉬고, 내일 아침 상태를 보고 다시 시작하세요.'
    }
  };

  /* 감각연습과 약점을 잇는 한 줄 — 고른 약점이 있으면 그 블록을 한 번 더 하도록 안내합니다. */
  function senseFocus(weakList) {
    var list = weakList || [];
    var has = function (s) { return list.indexOf(s) >= 0; };
    if (has('드라이브')) return { skill: '드라이브', text: '드라이브가 약점이라면 2대1 드라이브 10분을 한 번 더 도세요. ' + PRO_DRIVE.finger + ' ' + PRO_DRIVE.push + ' — 빠른 공 속에서도 라켓면이 흔들리지 않습니다. (' + PRO_DRIVE.source + ')' };
    if (has('드롭')) return { skill: '드롭', text: '드롭이 약점이라면 2대1 드롭 10분을 한 번 더. 네트 앞에 살짝 떨어뜨리는 감각은 반복 횟수가 만들어 줍니다.' };
    if (has('헤어핀')) return { skill: '헤어핀', text: '헤어핀이 약점이라면 몸풀기에서 헤어핀을 20개 더. 네트에 붙는 발과 손목을 함께 봐 주세요.' };
    if (has('풋워크')) return { skill: '풋워크', text: '풋워크가 약점이라면 뒷코트 감각연습을 5분 더. 뒤쪽 모서리까지 돌아 나오는 발이 먼저예요.' };
    if (has('스매시')) return { skill: '스매시', text: '스매시가 약점이라면 몸풀기 마지막 연결에서 타점(점프한 최고점에서 맞히기)을 한 번 더 확인하세요.' };
    return null;
  }

  /* senseRoutine(discipline, level, weakList)
   *   → 오전 코트 감각연습 3블록 + 오후 보강 웨이트 3묶음 (+ 급수별 조절 안내)
   * 같은 입력이면 같은 결과(순수 함수) — 카드가 다시 그려져도 흔들리지 않게 매번 새 객체로 돌려줍니다. */
  function senseRoutine(discipline, level, weakList) {
    var key = disciplineKey(discipline);
    function copyItem(it) {
      return { name: it.name, load: it.load, sets: it.sets, how: it.how };
    }
    var tier = GRADE_TIER[gradeOf(level)];
    var levelNote;
    if (tier != null && tier <= 1) {
      levelNote = '처음이면 2대1은 10분씩 20분으로 줄이고, 웨이트는 맨몸·2세트부터 해도 충분해요. 지금은 무게보다 감각을 익히는 게 먼저예요.';
    } else if (tier != null && tier >= 5) {
      levelNote = '선수부·자강은 위 볼륨 그대로 해도 됩니다. 대신 세트 사이 쉬는 시간을 지켜 자세가 깨지지 않게 하세요.';
    } else {
      levelNote = '동호인은 2대1을 10분씩 20~30분, 웨이트는 가벼운 무게로 2~3세트면 충분해요. 숫자보다 자세가 먼저입니다.';
    }
    var disciplineNote = key === '단식'
      ? '단식은 뒤쪽으로 밀리는 공이 많아 뒷코트 감각연습 10분을 빼지 마세요.'
      : key === '혼합복식'
        ? '혼합복식은 전위에서 끝내는 공이 많아 몸풀기 헤어핀과 2대1 드롭을 특히 신경 쓰세요.'
        : '복식은 짧고 빠른 랠리가 많아 2대1 숏드라이브·드라이브 10분이 특히 중요해요.';
    return {
      title: SENSE.title,
      note: SENSE.note,
      discipline: key,
      disciplineNote: disciplineNote,
      levelNote: levelNote,
      court: {
        title: SENSE.court.title, total: SENSE.court.total, order: SENSE.court.order,
        blocks: SENSE.court.blocks.map(function (b) {
          var out = {
            name: b.name, min: b.min, how: b.how, point: b.point,
            parts: (b.parts || []).map(function (p) { return { name: p.name, how: p.how }; })
          };
          if (b.sides) out.sides = b.sides;
          return out;
        })
      },
      weight: {
        title: SENSE.weight.title, total: SENSE.weight.total, order: SENSE.weight.order,
        groups: SENSE.weight.groups.map(function (g) {
          return { name: g.name, items: g.items.map(copyItem) };
        }),
        loadGuide: SENSE.weight.loadGuide,
        stop: SENSE.weight.stop
      },
      focus: senseFocus(weakList),
      summary: '감각연습 3블록(45~50분) · 보강 웨이트 3묶음',
      source: SENSE.source
    };
  }

  /* ---------- 시합 당일 준비 (bm-v1.70.0) ----------
   * 체전 1등 선수 현장 기준(2026-11-24 인터뷰)에서 두 가지를 그대로 옮겼습니다.
   *   ① 시합 들어가기 직전 — 가볍게 조깅 → 스트레칭으로 관절 풀기 → 코트에서 시합
   *      (사용자 답변: "조깅하고 스트레칭하고 시합 뛰고")
   *   ② 복식 수비 → 공격 전환 — 공을 세게 한 번 쳐서 상대를 뒤로 밀리게 만든 다음,
   *      코스를 틀거나 짧게 놓아 빈틈을 노리기 (사용자 답변: "공을 세게한번쳐서 밀리게 하고 틀거나 놔")
   * 평소 훈련 웜업(WARMUP · PREVENT)과 네트 예열 구조는 그대로 두고,
   * 대회·시합이 있는 날에만 이 순서를 하나 더 얹습니다. */
  var MATCH_DAY = {
    title: '시합 당일 준비',
    note: '대회나 시합이 있는 날, 코트에 들어가기 전 순서예요. 평소 하던 웜업은 그대로 하고, 그 위에 이 세 가지를 순서대로 더하면 됩니다.',
    steps: [
      {
        name: '가볍게 조깅', min: 5,
        how: '코트 밖에서 몸이 따뜻해질 때까지 가볍게 뜁니다. 옆 사람과 이야기할 수 있는 속도면 충분하고, 숨이 조금 차면 멈춰도 돼요.'
      },
      {
        name: '스트레칭으로 관절 풀기', min: 5,
        how: '발목·무릎·어깨를 크게 돌리고 다리를 앞뒤로 흔들어 관절을 풀어 줍니다. 시합 직전에는 힘을 오래 주는 스트레칭보다 움직이면서 푸는 스트레칭이 몸을 덜 굳게 해요.'
      },
      {
        name: '코트에서 시합', min: 0,
        how: '이제 코트에 들어가 실제 경기처럼 뛰어 봅니다. 첫 랠리는 힘을 조금 빼고 시작해 셔틀 속도와 코트 감각을 확인한 뒤 올리세요.'
      }
    ],
    order: '가볍게 조깅 → 스트레칭으로 관절 풀기 → 코트에서 시합',
    switchTitle: '수비에서 공격으로 뒤집기',
    switchNote: '복식에서 수비에 몰려 있을 때 공격으로 뒤집는 순서예요. 한 번에 바꾸려 하지 말고, 밀어낸 다음에 바꿉니다.',
    switchSteps: [
      {
        name: '① 세게 한 번 쳐서 밀어내기',
        how: '수비에서 받은 공을 아래로 힘 있게 한 번 쳐서(드라이브·푸시) 상대 쪽 깊숙이 보냅니다. 상대 두 명이 뒤로 물러나야 다음이 열려요.'
      },
      {
        name: '② 밀린 걸 보고 코스 틀기 · 짧게 놓기',
        how: '상대가 뒤로 물러난 순간 앞이 비어요. 그때 대각이나 직선으로 코스를 틀거나, 네트 앞에 살짝 짧게 놓아 빈 곳을 찌릅니다.'
      },
      {
        name: '③ 순서 지키기',
        how: '밀기 전에 방향부터 바꾸면 앞을 지키는 상대에게 그대로 걸립니다. 세게 한 번 → 상대가 물러나는지 보기 → 코스 바꾸기, 이 순서를 지키세요.'
      }
    ],
    partner: '파트너와 미리 약속해 두세요. 한 명이 세게 밀어 상대를 뒤로 보내면, 다른 한 명은 네트 쪽으로 붙어 앞자리를 차지합니다(전후 전환).',
    defenseTitle: '수비에서 받는 타이밍',
    defenseNote: '예측한 수비와 예측 못 한 수비는 받는 자리가 달라야 해요.',
    defenseSteps: [
      {
        name: '예측한 공 — 앞에서 짧게',
        how: '상대가 어디로 칠지 예측했으면 앞에서 짧게 잡아 바로 압박합니다. 이때는 앞에서 치는 게 오히려 상대를 몰아붙여요.'
      },
      {
        name: '예측 못 한 공 — 뒤로 살짝 당겨 여유',
        how: '예측하지 못한 공을 앞에서 급하게 치려 하면 공이 더 빠르게 느껴져 실수가 나요. 몸 쪽 뒤로 살짝 당겨 시간을 벌고, 최대한 편한 자세로 여유 있게 받아치세요.'
      }
    ],
    singleNote: '단식도 같아요. 세게 깊게 한 번 보내 상대를 뒤로 밀어낸 뒤, 드롭이나 코스 변경으로 앞뒤를 흔들어 빈 곳을 노리세요.',
    source: '체전 1등 선수 현장 기준(2026-11-24) — 시합 직전 조깅·스트레칭 후 시합 / 수비에서 세게 밀고 코스 틀기'
  };

  /* matchDay(discipline)
   *   → 시합 직전 3단계 + 종목에 맞춘 수비→공격 전환 (복식·혼합복식은 3단계, 단식은 한 줄 안내)
   * 같은 입력이면 같은 결과(순수 함수) — 카드가 다시 그려져도 흔들리지 않게 매번 새 객체로 돌려줍니다. */
  function matchDay(discipline) {
    var key = disciplineKey(discipline);
    var dbl = key !== '단식';
    return {
      title: MATCH_DAY.title,
      note: MATCH_DAY.note,
      discipline: key,
      order: MATCH_DAY.order,
      steps: MATCH_DAY.steps.map(function (s) {
        return { name: s.name, min: s.min, how: s.how };
      }),
      switchBlock: {
        title: MATCH_DAY.switchTitle,
        note: dbl ? MATCH_DAY.switchNote : MATCH_DAY.singleNote,
        steps: dbl ? MATCH_DAY.switchSteps.map(function (s) { return { name: s.name, how: s.how }; }) : [],
        partner: dbl ? MATCH_DAY.partner : ''
      },
      defenseBlock: {
        title: MATCH_DAY.defenseTitle,
        note: MATCH_DAY.defenseNote,
        steps: MATCH_DAY.defenseSteps.map(function (s) { return { name: s.name, how: s.how }; })
      },
      summary: '시합 직전 3단계 · 수비에서 공격 전환 · 수비 타이밍',
      source: MATCH_DAY.source
    };
  }

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
    var text = level === 'brake' ? SELF_PACE.brake : level === 'caution' ? SELF_PACE.caution : SELF_PACE.keep;
    /* 통증이 있으면 강도 조절 문구보다 '바로 멈추는 기준'을 먼저 둡니다 */
    if (pains.length) text = PAIN_RULE.stop + ' ' + text;

    return {
      level: level,
      label: SELF_PACE.label,
      text: text,
      rule: SELF_PACE.rule,
      painStop: pains.length ? PAIN_RULE.stop : '',
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
        '머리 위로 치는 스매시·클리어 횟수를 오늘 하루 절반으로 줄이기',
        '밴드로 팔 바깥으로 돌리기 15회 × 2세트, 주 3회 (6주면 통증과 움직임이 좋아져요)',
        '통증 시 냉찜질 15분, 2주 이상 이어지면 정형외과 상담',
        '주로 치는 어깨가 반대쪽보다 안으로 덜 돌아가거나, 팔을 바닥 쪽으로 누를 때 손이 잘 안 내려가면 어깨 위험이 커요 — 옆으로 누워 어깨 뒤 풀기와 밴드로 뒤쪽 힘 기르기를 매일'
      ],
      stretch: ['가슴 문 열기 스트레칭 30초 × 2', '어깨 뒤쪽 풀기 30초 × 2', '어깨 원 그리기 10회씩'],
      ret: ['통증 3/10 이하에서 머리 위 샷 재개, 스매시 개수는 주당 20%씩만 늘리기']
    },
    '무릎': {
      signs: ['계단 내려가기·점프 착지에서 무릎 앞쪽 통증', '아침에 무릎이 뻣뻣하거나 붓기가 남으면 진료'],
      rehab: [
        '점프·계단·깊은 런지 횟수를 줄이고 무릎 주변 근육 먼저 강화',
        '하중은 20cm 스텝업 → 런지 → 한 발 내리기 순서로 단계 올리기',
        '붓기가 있으면 냉찜질 15분, 통증 지속 시 진료',
        '경기·훈련 후반(피로가 쌓일 때)에는 백핸드 쪽 런지 수를 줄이세요 — 포핸드보다 무릎에 비틀리는 힘이 더 실립니다'
      ],
      stretch: ['허벅지 앞 스트레칭 30초 × 2', '종아리 스트레칭 30초 × 2', '엉덩이(가위) 스트레칭 30초 × 2'],
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
      rehab: ['그립 압력을 낮추고 팔 힘 빼고 치기', '테니스 엘보 밴드 사용 고려', '백핸드 손목 스냅 동작 줄이기',
        '가벼운 물병을 들고 손목을 4~5초에 걸쳐 천천히 내리기 15회 × 3세트, 주 3번 — 4주 이상 하면 통증과 악력이 같이 좋아져요'],
      stretch: ['손목 굽히기 스트레칭 20초 × 3', '손목 펴기 15회 × 2 (가벼운 덤벨/물병)'],
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
        '종아리 천천히 내리기 운동 15회 × 3세트 하루 2회 (통증 5/10까지 허용)',
        '12주 정도 꾸준히 — 급하게 늘리면 재발합니다'
      ],
      stretch: ['벽 짚고 종아리 스트레칭 30초 × 3(무릎 펴고/굽히고)', '발목 돌리기 10회씩'],
      ret: ['통증 없는 범위에서 조깅 → 점프 순서로, 아침 통증이 없으면 강도 유지']
    },
    '발목': {
      signs: ['접질린 뒤 체중을 못 실으면 진료(골절 확인)', '반복해서 접질리면 진료'],
      rehab: ['한 발 서기 30초 × 3, 눈 감고 15초 × 2 (균형 훈련은 발목 접질림 위험을 40% 줄여요)', '접질린 뒤라면 보호대 착용 후 복귀',
        '대각선 뒤로 빠질 때 발끝이 아니라 발바닥 전체로 착지하세요 — 발목을 삐는 순간이 바로 여기서 나옵니다'],
      stretch: ['발목 앞뒤로 굽히기 20초 × 3', '발가락 벌리기 10회'],
      ret: ['균형 훈련을 주 3회 유지, 붓기 없이 뛸 수 있으면 경기 복귀']
    }
  };

  var GENERIC_CARE = {
    rehab: ['훈련 후 10분은 정리 운동으로 마무리하기', '통증이 3일 이상 이어지면 진료를 권장'],
    stretch: ['햄스트링 · 종아리 스트레칭 30초 × 2', '엉덩이 앞쪽 스트레칭 30초 × 2', '어깨 돌리기 10회씩']
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
   * [BARR16] 세계선수권 남자단식 136게임 — 0~7점·8~14점·15~21점 세 구간으로 나눠 보면
   *         1구간에서 한 번도 앞서지 못한 선수의 78%가 그 게임을 졌고, 2·3구간 1점차는 이기기에 부족했으며,
   *         승자는 중반~후반에 5점 이상 차를 냈습니다. → '중반(8~14점)까지 3점 이상'을 코트 목표로 안내.
   * [PHOM15] 랠리 약 7초·휴식 약 15초(1:2) — 경기 사이 회복을 규칙적으로.
   * [PHOM20] 부상은 훈련 후반(48%)에 많고 피로로 힘·고유수용감각이 떨어질 때 늘어남. */
  var GAME_PHASE = {
    phases: [[0, 7], [8, 14], [15, 21]],   /* [BARR16] 21점제 구간 */
    noLeadFirstLossPct: 78,                /* [BARR16] 1구간 한 번도 리드 없음 → 패배 */
    winnerMidMargin: 5,                    /* [BARR16] 승자의 중반~후반 최대 점수차 */
    targetLead: 3,                         /* 코트 목표: 중반까지 3점 이상 앞서기 */
    closeMargin: 3,                        /* 접전 기준(3점차 이내) */
    source: 'Barreira, Chiminazzo & Fernandes, Int J Perform Anal Sport 16(2):687-694, 2016 (DOI 10.1080/24748668.2016.11868916)'
  };

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
      firstMargin: 0, lastMargin: 0, fade: false, tips: [],
      /* 접전(3점차 이내) 성적 — 점수만으로 셀 수 있는 유일한 '마무리' 지표 */
      clutch: { games: 0, wins: 0, losses: 0 }
    };
    if (!list.length) return flow;

    var mode = flow.mode;
    var margins = [], total = 0, close = 0, deuce = 0, blowout = 0;
    var closeWins = 0, closeLosses = 0;
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
      if (Math.abs(m) <= GAME_PHASE.closeMargin) {
        if (r === '승') closeWins++;
        else if (r === '패') closeLosses++;
      }
    });
    flow.count = list.length;
    flow.avgMargin = Math.round((total / list.length) * 10) / 10;
    flow.close = close;
    flow.deuce = deuce;
    flow.blowout = blowout;
    flow.clutch = { games: closeWins + closeLosses, wins: closeWins, losses: closeLosses };
    if (flow.clutch.games) flow.clutch.rate = Math.round((closeWins / flow.clutch.games) * 100);
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
      out.push('마지막 2~3점까지 간 경기가 ' + flow.deuce + '경기예요' +
        (flow.clutch && flow.clutch.games ? ' (3점차 이내 ' + flow.clutch.games + '경기 중 ' + flow.clutch.wins + '승 ' + flow.clutch.losses + '패)' : '') + '. ' +
        flow.mode + '점제는 막판 실수 하나가 세트를 바꿉니다. 마지막 3~4점에서는 새 기술을 꺼내지 말고, 서브는 숏서브로 고정하고 리시브는 네트 앞으로 붙이세요. ' +
        '그 전에 ' + GAME_PHASE.phases[1][0] + '~' + GAME_PHASE.phases[1][1] + '점 구간에서 ' + GAME_PHASE.targetLead + '점 이상 앞서 두면 마지막에 뒤집히지 않아요.');
    } else if (flow.close >= 2) {
      out.push('3점차 이내 접전이 ' + flow.close + '경기예요' +
        (flow.clutch && flow.clutch.games ? ' (' + flow.clutch.wins + '승 ' + flow.clutch.losses + '패)' : '') +
        '. 이길 때도 이긴 이유가 분명해야 다음에 또 이깁니다. 접전에서 통한 샷 하나를 적어 두고, ' +
        GAME_PHASE.phases[1][0] + '~' + GAME_PHASE.phases[1][1] + '점 구간에서 ' + GAME_PHASE.targetLead + '점 이상 앞서 두는 걸 목표로 하세요.');
    } else if (flow.clutch && flow.clutch.games >= 2) {
      out.push('3점차 이내로 끝난 ' + flow.clutch.games + '경기에서 ' + flow.clutch.wins + '승 ' + flow.clutch.losses + '패였어요. ' +
        GAME_PHASE.phases[1][0] + '~' + GAME_PHASE.phases[1][1] + '점 구간에서 ' + GAME_PHASE.targetLead + '점 이상 앞서 두면 마지막에 뒤집히지 않아요. 첫 7점에서 한 번도 앞서지 못한 경기는 대부분 그대로 지니, 초반부터 한 점씩 가져가세요.');
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

  /* ---------- 주간 부하 리듬 (단조로움 · 긴장) ----------
   * [FOST98][HADD17] 세션 RPE(분 × 주관적 강도) 부하를 하루 단위로 더해서
   *   단조로움 = 지난 7일 하루 부하 평균 ÷ 표준편차 (쉰 날은 0으로 셉니다)
   *   긴장    = 지난 7일 부하 합 × 단조로움
   * 매일 비슷하게 세게 치면 표준편차가 작아져 단조로움이 커지고, 그 상태에서 부하가 크면
   * 몸살·감기 같은 게 늘었다는 보고가 있습니다. 진단이 아니라 '쉬는 날을 넣었는지'를 보는 참고값입니다.
   * (단조로움 2.0 이상을 높은 편으로 보는 것이 이 논문들에서 쓰는 흔한 참고선입니다.) */
  var RHYTHM = {
    days: 7,
    minDays: 3,                 /* 7일 중 3일은 훈련해야 말합니다 */
    monotonyHigh: 2.0,          /* [FOST98][HADD17] 참고선 */
    monotonyVeryHigh: 3.0,
    flatMonotony: 9.9,          /* 하루 부하가 모두 같아 표준편차가 0일 때(계산 불가) */
    source: 'Foster, Med Sci Sports Exerc 30(7):1164-1168, 1998 (DOI 10.1097/00005768-199807000-00023) · ' +
      'Haddad et al., Front Neurosci 11:612, 2017 (DOI 10.3389/fnins.2017.00612)',
    sourceShort: '참고 논문 · Foster 1998 MSSE(단조로움·긴장) · Haddad 2017 Front Neurosci'
  };

  /* loadRhythm(records, draft) → { on, total, mean, sd, monotony, strain, restDays, level, label, text, tips }
   * 같은 입력이면 항상 같은 결과 (순수 함수) */
  function loadRhythm(records, draft) {
    var out = {
      on: false, days: RHYTHM.days, total: 0, mean: 0, sd: 0, monotony: 0, strain: 0,
      restDays: 0, trainDays: 0, level: '', label: '부하 리듬', text: '', tips: [],
      daily: [], source: RHYTHM.source, sourceShort: RHYTHM.sourceShort
    };
    var today = U.parseYmd(U.ymd());
    if (!today) return out;
    var daily = [], i;
    for (i = 0; i < RHYTHM.days; i++) daily.push({ date: U.ymd(U.addDays(today, -(RHYTHM.days - 1 - i))), load: 0 });
    var index = {};
    daily.forEach(function (d) { index[d.date] = d; });

    (records || []).forEach(function (r) {
      var d = index[r.date];
      if (!d) return;
      d.load += sessionLoad(r);
    });
    /* 오늘 작성 중인 일지도 오늘 부하로 넣습니다 */
    var todayD = index[U.ymd()];
    if (todayD) todayD.load += sessionLoad(draft);

    var total = 0, trainDays = 0, lightDays = 0;
    daily.forEach(function (d) {
      total += d.load;
      if (d.load > 0) trainDays++;
    });
    if (trainDays < RHYTHM.minDays || total <= 0) return out;

    var mean = total / RHYTHM.days;
    /* 가벼운 날 = 하루 평균 부하의 절반 이하로 줄인 날(세게 친 날과 번갈아 친 경우) */
    daily.forEach(function (d) { if (d.load > 0 && d.load <= mean * 0.5) lightDays++; });
    var variance = 0;
    daily.forEach(function (d) { variance += Math.pow(d.load - mean, 2); });
    var sd = Math.sqrt(variance / RHYTHM.days);
    var monotony = sd > 0 ? mean / sd : RHYTHM.flatMonotony;
    var strain = total * monotony;

    out.on = true;
    out.daily = daily;
    out.total = Math.round(total);
    out.mean = Math.round(mean);
    out.sd = Math.round(sd);
    out.monotony = Math.round(monotony * 10) / 10;
    /* 하루 부하가 모두 같아 표준편차가 0이면 긴장은 계산하지 않습니다(0으로 두고 문구로만 짚어 줍니다) */
    out.strain = sd > 0 ? Math.round(strain) : 0;
    out.trainDays = trainDays;
    out.lightDays = lightDays;
    out.restDays = RHYTHM.days - trainDays;
    out.level = out.monotony >= RHYTHM.monotonyVeryHigh ? 'flat' : out.monotony >= RHYTHM.monotonyHigh ? 'high' : 'ok';
    out.text = '지난 7일 부하 ' + out.total + ' · ' +
      (sd > 0 ? '단조로움 ' + out.monotony + ' (2.0 넘으면 높은 편)' : '매일 같은 부하(단조로움 최대)') +
      ' · 쉰 날 ' + out.restDays + '일';

    var tips = [];
    if (out.level !== 'ok' && out.restDays === 0) {
      tips.push('지난 7일 동안 하루도 안 쉬었어요. 부하가 매일 비슷하게 쌓이면 몸살·감기 같은 게 늘 수 있다는 보고가 있어요 — 이번 주 하루는 완전히 쉬거나 20분만 가볍게 하세요.');
    } else if (out.level !== 'ok') {
      tips.push('쉰 날은 있는데 운동한 날 강도가 거의 같아요(단조로움 ' + out.monotony + '). 세게 친 날 다음 날은 강도 5 이하로 낮춰 오르내림을 만들어 주세요.');
    } else if (out.lightDays >= 2) {
      tips.push('세게 친 날과 가볍게 한 날이 번갈아 있어요. 오르내림은 좋은 리듬이에요' +
        (out.restDays ? ' — 이대로 가세요.' : ' — 여기에 완전히 쉬는 날 하루만 더 넣으면 금상첨화예요.'));
    } else if (out.restDays >= 2) {
      tips.push('세게 친 날과 쉬는 날이 번갈아 있어요. 회복이 들어가는 좋은 리듬이에요 — 이대로 가세요.');
    } else if (out.restDays === 1) {
      tips.push('하루는 쉬었어요. 이 정도면 괜찮아요. 대회·시합이 가까운 주에는 하루 더 넣어 보세요.');
    } else {
      tips.push('지난 7일 중 완전히 쉰 날은 없었어요. 오르내림은 괜찮지만, 하루는 20분 이하로 확 줄이는 날을 넣어 두세요.');
    }
    if (out.level !== 'ok') {
      tips.push('이번 주는 총량을 20~30% 줄이거나 세트 수를 하나 빼서 부하를 낮춰 보세요.');
    }
    out.tips = tips.slice(0, 2);
    return out;
  }

  /* ---------- 선수 7대 훈련 밸런스 ----------
   * 선수 유형은 일지에 7항목(스트록·벽치기·코어·풋워크·스매시·상체·하체)을 적습니다(domain.js PRO_ITEMS).
   * 최근 2주 기록에서 무엇을 몇 번 했는지 세어 '아예 안 한 항목'만 1~2개로 짚어 줍니다.
   * [MA25] 훈련 종류마다 올려 주는 게 달라서(코어→스매시·민첩성, 하체→파워, 밸런스→균형, HIIT→VO2max)
   *        한 가지만 하면 구멍이 남습니다.
   * [WANG25] 하체가 점프력에 가장 크고 코어는 힘 전달, 상체는 스매시 속도(근거 적음), 8주 넘게 해야 효과적. */
  var PRO_BAL = {
    days: 14,                 /* 지난 2주 */
    minSessions: 3,           /* 7대 훈련을 3번은 적어야 말합니다 */
    skewShare: 0.6,           /* 한 항목이 절반 넘게 차지하면 '쏠림' */
    order: ['하체 근력운동', '코어', '상체 근력운동', '풋워크', '스트록', '벽치기', '스매시'],
    court: ['스트록', '벽치기', '풋워크', '스매시'],
    strength: ['하체 근력운동', '코어', '상체 근력운동'],
    items: {
      '하체 근력운동': {
        how: '스쿼트 · 런지 10회 × 3세트, 주 2회 (8주는 채워야 늘어요)',
        why: '점프 스매시 높이와 착지에서 버티는 힘은 하체 근력이 제일 크게 좌우해요.'
      },
      '코어': {
        how: '플랭크 40초 × 3 + 데드버그 10회 × 3, 주 2회',
        why: '코어가 받쳐 줘야 스매시 힘이 팔까지 그대로 넘어가요 — 8주 코어 훈련이 스매시 속도·정확도를 올렸어요.'
      },
      '상체 근력운동': {
        how: '풀업이나 밴드 당기기 8~12회 × 3세트, 주 2회',
        why: '어깨 뒤쪽 힘이 받쳐 줘야 스매시를 많이 쳐도 어깨가 안 찝혀요.'
      },
      '풋워크': {
        how: '6코너 스텝 30초 × 6, 주 2회',
        why: '발이 먼저 붙어야 스매시 준비가 돼요. 민첩성 훈련이 방향 전환을 앞당겨요.'
      },
      '스트록': {
        how: '클리어 · 드롭 50개씩, 주 2~3회',
        why: '코트에서 제일 많이 쓰는 기본기예요. 양이 줄면 경기에서 먼저 흔들려요.'
      },
      '벽치기': {
        how: '벽치기 10분 × 2세트, 주 2회',
        why: '짧은 시간에 손목·전완 리듬을 많이 가져갈 수 있어요.'
      },
      '스매시': {
        how: '점프 스매시 20~30개 × 3세트, 주 1~2회',
        why: '근력·코어가 받쳐 줄 때 스매시가 세지고 정확해져요 — 개수만 늘리면 어깨·팔꿈치가 먼저 지쳐요.'
      }
    },
    source: 'Ma et al., BMC Sports Sci Med Rehabil, 2025 (DOI 10.1186/s13102-025-01199-y) · ' +
      'Wang et al., Front Physiol, 2025 (DOI 10.3389/fphys.2025.1548869)',
    sourceShort: '참고 논문 · Ma 2025 BMC Sports Sci Med Rehabil · Wang 2025 Front Physiol'
  };

  /* proBalance(records, draft) → { on, sessions, counts, missing, add, level, text, pattern }
   * 같은 입력이면 항상 같은 결과 (순수 함수) */
  function proBalance(records, draft) {
    var out = {
      on: false, title: '7대 훈련 밸런스', windowDays: PRO_BAL.days, sessions: 0,
      counts: [], missing: [], add: [], level: '', label: '', text: '', pattern: '',
      source: PRO_BAL.source, sourceShort: PRO_BAL.sourceShort
    };
    var today = U.parseYmd(U.ymd());
    if (!today || !BM.domain || typeof BM.domain.proOf !== 'function') return out;

    var counts = {}, last = {}, sessions = 0;
    function eat(pro, date) {
      var keys = Object.keys(pro || {});
      if (!keys.length) return;
      sessions++;
      keys.forEach(function (k) {
        if (PRO_BAL.order.indexOf(k) < 0) return;
        counts[k] = (counts[k] || 0) + 1;
        if (!last[k] || String(date) > String(last[k])) last[k] = date;
      });
    }

    (records || []).forEach(function (r) {
      var d = U.parseYmd(r.date);
      if (!d) return;
      var diff = Math.round((today - d) / 86400000);
      if (diff < 0 || diff > PRO_BAL.days - 1) return;
      eat(BM.domain.proOf(r), r.date);
    });
    /* 오늘 작성 중인 일지(아직 저장 전)도 한 번으로 셉니다 */
    if (draft && draft.pro) {
      var pro = BM.domain.normalizePro ? BM.domain.normalizePro(draft.pro) : draft.pro;
      eat(pro, U.ymd());
    }
    if (sessions < PRO_BAL.minSessions) return out;

    out.on = true;
    out.sessions = sessions;
    out.counts = PRO_BAL.order.map(function (n) {
      return { name: n, n: counts[n] || 0, last: last[n] || '' };
    });
    out.missing = out.counts.filter(function (c) { return !c.n; }).map(function (c) { return c.name; });
    var done = out.counts.filter(function (c) { return c.n > 0; })
      .sort(function (a, b) { return b.n - a.n || (a.name < b.name ? -1 : 1); });
    var top = done[0] || null;
    var share = top ? top.n / sessions : 0;
    var strengthEmpty = PRO_BAL.strength.every(function (n) { return !counts[n]; });
    var courtDone = PRO_BAL.court.filter(function (n) { return counts[n]; });

    out.level = !out.missing.length ? 'ok' : strengthEmpty ? 'skew' : 'miss';
    out.label = !out.missing.length ? '7가지 다 했어요' : out.missing.length + '개 비었어요';
    out.text = '지난 2주 동안 7대 훈련을 ' + sessions + '번 적었어요.';
    if (out.level === 'skew') {
      out.pattern = '코트에서 하는 ' + courtDone.join('·') + '만 했고, 힘을 만들어 주는 ' +
        PRO_BAL.strength.join('·') + '은 한 번도 없어요.';
    } else if (out.level === 'miss') {
      out.pattern = (top ? '제일 많이 한 건 ' + top.name + '(' + top.n + '번)' : '고른 항목이 적었어요') +
        '. ' + out.missing.slice(0, 3).join('·') + (out.missing.length > 3 ? ' 외 ' + (out.missing.length - 3) + '개' : '') + '는 아직 없어요.' +
        (share >= PRO_BAL.skewShare ? ' 한쪽으로 쏠려 있어요.' : '');
    } else {
      out.pattern = '7가지가 다 들어갔어요. 이번 주도 이 순서대로 돌려 가면 돼요.';
    }

    if (out.missing.length) {
      var rest = PRO_BAL.order.filter(function (n) { return out.missing.indexOf(n) >= 0; });
      out.add = rest.slice(0, 2).map(function (n) {
        var it = PRO_BAL.items[n] || { how: '', why: '' };
        return { name: n, how: it.how, why: it.why };
      });
    }
    return out;
  }

  /* 급수 플랜 — 화면·시트 어디서든 같은 문구가 나오도록 */
  function gradePlan(level) {
    var g = gradeOf(level);
    if (!g) g = 'C조';
    var plan = GRADE_PLANS[g] || GRADE_PLANS['C조'];
    return { grade: g, focus: plan.focus, volume: plan.volume, rules: plan.rules.slice() };
  }

  /* 전술 노트 — 종목(복식/단식/혼합복식)에 맞는 3가지. 급수가 낮으면 기본 2개만.
   * 복식은 드라이브 싸움 한 줄을 더 붙입니다(4줄) — 체전 1등 선수 현장 기준의
   * '검지에 힘·짧은 스윙'이 전술 노트에서도 보이게 하기 위해서입니다 (bm-v1.94.0). */
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
    var tips = all.slice(0, n);
    /* 복식 드라이브 싸움 — 급수가 올라간 사람에게만 한 줄 더 */
    if (d !== '단식' && tier > 1 && all.length > n) {
      var battle = null;
      for (var i = 0; i < all.length; i++) {
        if (all[i].indexOf('드라이브 싸움') >= 0) { battle = all[i]; break; }
      }
      if (battle && tips.indexOf(battle) < 0) tips.push(battle);
    }
    return { discipline: d, grade: g, tips: tips };
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

    /* 최근 3일 안에 '센 훈련(강도 8 이상)'이 몇 번 있었는지 — 피로 누적 판단용 */
    var recentHard = 0;
    (function () {
      var todayD = U.parseYmd(U.ymd());
      history.forEach(function (r) {
        if (!r.date || r.intensity == null) return;
        var d = U.parseYmd(r.date);
        if (!d) return;
        var gapDays = Math.round((todayD - d) / 86400000);
        if (gapDays >= 1 && gapDays <= 3 && Number(r.intensity) >= 8) recentHard++;
      });
    })();

    /* 피로가 쌓였는데 점프·스매시를 고른 날 — 점프 높이↓·착지 충격↑ ([CHENG24]) */
    var jump = fatigueJump(cond, weakSkills, {
      intensity: intensity, load: load, recentHard: recentHard, pain: painToday
    });

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
          ? '마지막 경기에서 점수차가 벌어졌어요. 경기 사이 회복 시간을 먼저 챙고세요.'
          : flow.deuce >= 1
            ? '접전이 ' + flow.deuce + '경기였어요. 후반 2~3점 운영이 이 경기들의 승부처였습니다.'
            : gsum.wins >= gsum.losses
              ? '여러 경기를 치렀어요. 이긴 경기에서 통한 샷 하나를 다음에도 그대로 써 보세요.'
              : '여러 경기 중 내용이 좋았던 한 경기를 기준으로 다음 훈련을 잡아 보세요.')
      });
    }
    /* 마무리(접전) 성적 — 점수만으로 셀 수 있는 유일한 '막판 운영' 지표
     * [BARR16] 한 번도 앞서지 못한 경기는 대부분 지고, 중반~후반 1점차로는 부족했습니다. */
    if (flow.clutch && flow.clutch.games >= 2 && flow.clutch.games < flow.count) {
      var clutch = flow.clutch;
      insights.push({
        icon: 'score',
        label: '접전 ' + clutch.games + '경기 ' + clutch.wins + '승 ' + clutch.losses + '패',
        detail: clutch.rate >= 60
          ? '끝까지 간 경기를 잘 잡았어요. 마지막 3~4점에서 한 선택(서브·리시브 코스)을 그대로 반복하세요.'
          : clutch.rate >= 40
            ? '반반이에요. 마지막 3점은 어떤 서브로 시작할지 미리 정해 두면 흔들리지 않아요.'
            : '아쉽게 놓친 경기가 많아요. ' + GAME_PHASE.phases[1][0] + '~' + GAME_PHASE.phases[1][1] +
              '점 구간에서 ' + GAME_PHASE.targetLead + '점 이상 앞서 두는 걸 이번 주 목표로 잡아 보세요.'
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
        detail: PAIN_RULE.stop + ' 최근 4주에 2회 이상 나온 부위라 오늘은 그 동작을 빼고, 다시 아프면 그 세트에서 끝내세요.'
      });
    } else if (painToday.length) {
      insights.push({
        icon: 'alert',
        label: '오늘 통증: ' + painToday.join(', '),
        detail: PAIN_RULE.stop + ' ' + PAIN_RULE.next
      });
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
    /* 피로 점프 경고는 '강도 조절' 바로 뒤에 — 둘 다 있으면 맨 앞은 브레이크 문구가 지킵니다 */
    if (jump.on) {
      insights.splice(pace.level === 'brake' ? 1 : 0, 0, {
        icon: 'alert',
        label: '피로 점프 주의',
        detail: jump.reason
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
    /* 통증 부위에 부담이 큰 드릴은 빼고 안전한 드릴로 바꿉니다 (bm-v1.72.0)
     * — 위에서 "무릎 쉬기"라고 해 놓고 아래에서 육각 풋워크를 권하던 모순 제거 */
    var drillSwap = painSafeDrills(drills, painToday, level);
    drills = drillSwap.drills;
    /* 피로가 쌓인 날의 점프·연속 스매시 드릴 → 네트 앞·낮은 스텝 드릴로 교체 (bm-v1.83.0)
     * 통증으로 이미 통째로 바뀐 날은 바꿀 것이 없어 그대로 둡니다. */
    var jumpSwap = jump.on ? jumpSafeDrills(drills, level) : { drills: drills, swapped: [], note: '' };
    drills = jumpSwap.drills;
    /* 통증 부위·종목에 맞춘 예방 워밍업과 종목별 인터벌 기준 (논문 근거) */
    var prevent = preventionWarmup(painList, discipline);
    var guard = jointGuard(painList, weakSkills, { intensity: intensity, minutes: minutes, load: load });
    /* 종아리·아킬레스 쿨다운 — 발목·종아리·아킬레스 통증, 60분 이상·고강도, 주간 부하로 켜집니다 (bm-v1.91.0) */
    var cool = coolDown(painList, { minutes: minutes, intensity: intensity, load: load });
    /* 선수 7대 훈련 밸런스 · 주간 부하 리듬 (bm-v1.49.0) */
    var balance = proBalance(history, draft);
    var rhythm = loadRhythm(history, draft);
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
    care.rehab = U.uniq(care.rehab);
    /* 피로 점프 경고가 켜진 날은 '회복' 처방에도 전환 한 줄을 같이 넣습니다 (bm-v1.83.0) */
    if (jump.on) care.rehab = U.uniq([FATIGUE_JUMP.rehab].concat(care.rehab));
    /* 통증이 있으면 처방 맨 앞에 '바로 멈추는 기준'을 둡니다(부위별 처방도 그대로 남김) */
    if (painToday.length) care.rehab = U.uniq([PAIN_RULE.stop].concat(care.rehab)).slice(0, 5);
    else care.rehab = care.rehab.slice(0, 4);
    care.stretch = U.uniq(care.stretch).slice(0, 4);
    /* 무릎·허리 연쇄 예방은 스트레칭 처방에도 한 줄로 함께 넣습니다 (bm-v1.83.0) */
    if (guard.chain && guard.chain.on) {
      care.stretch = U.uniq([FATIGUE_JUMP.chainStretch].concat(care.stretch)).slice(0, 4);
    }
    /* 종아리·아킬레스 쿨다운은 스트레칭·회복 처방에도 한 줄씩 들어갑니다 (bm-v1.91.0) */
    if (cool.on) {
      care.stretch = U.uniq(care.stretch.concat([cool.stretchLine])).slice(0, 5);
      if (cool.advice) care.rehab = U.uniq(care.rehab.concat([cool.advice])).slice(0, 6);
    }
    care.stop = painToday.length ? PAIN_RULE.stop : '';

    /* 워밍업: 훈련일에는 기본 6단계 중 앞 4개, 통증이 있으면 강도 낮춘 3개 */
    care.warmup = (painToday.length ? WARMUP.slice(0, 4) : WARMUP.slice(0, 5));

    if (ws.rate != null && ws.rate < 40) care.mental.push('오늘 잘된 샷 하나만 떠올려 보세요. 승률은 연습량이 쌓이면 따라옵니다.');
    if (cond != null && cond <= 4) care.mental.push('컨디션이 낮은 날은 "덜 하기"도 훈련입니다. 20분만 하고 끝내도 성공이에요.');
    if (pace.level === 'brake') care.mental.unshift(SELF_PACE.rule);
    if (painToday.length) care.mental.unshift(PAIN_RULE.stop + ' 오늘은 그 부위가 다시 아프지 않은 범위까지만 하세요.');
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
    else if (painToday.length) {
      /* 하체 통증이면 '가볍게 풋워크' 같은 다음 목표도 다리를 쓰지 않는 쪽으로 (bm-v1.72.0) */
      var lowerPain = painToday.some(function (a) { return PAIN_LOWER_AREAS.indexOf(a) >= 0; });
      focus = painToday[0] + ' 쉬기' + (lowerPain ? ' (오늘은 상체·스트레칭)' : ' + 부담 없는 드릴');
    }
    else if (ws.rate != null && ws.rate < 40) focus = '리시브 안정 + 실수 줄이기';

    var gp = gradePlan(level);
    var week = [
      { day: '다음 훈련', focus: weakSkills[0], menu: drills[0] ? drills[0].name : '기본 스트록' },
      { day: '2회차', focus: weakSkills[1] || '풋워크', menu: drills[1] ? drills[1].name : '육각 풋워크' },
      { day: '3회차', focus: '실전', menu: scoreMode + '점제 게임 2~3경기 + 기록 남기기' }
    ];
    /* 통증이 있으면 '내일 루틴' 첫 줄도 몸 상태 확인부터 — 조금 아프면 바로 쉬기 */
    if (painToday.length) {
      week[0] = {
        day: '다음 훈련',
        focus: painToday[0] + ' 상태 먼저 확인',
        menu: '아프면 바로 쉬기 · 괜찮으면 ' + (drills[0] ? drills[0].name : '기본 스트록')
      };
    }
    /* 급수 플랜의 볼륨이 주 4회 이상이면 네 번째 회차를 전술 연습으로 채웁니다 */
    if (gradeOf(level) && GRADE_TIER[gradeOf(level)] >= 3) {
      week.push({ day: '4회차', focus: '전술', menu: (playbook(discipline, level).discipline) + ' 3구 패턴 반복' });
    }

    var risk = [];
    if (painToday.length) risk.unshift({ level: 'warn', text: PAIN_RULE.stop + ' ' + PAIN_RULE.next });
    if (painToday.length && (intensity || 0) >= 8) risk.push({ level: 'warn', text: '통증이 있는데 강도가 높아요. 오늘은 강도를 6 이하로 낮추는 걸 권장합니다.' });
    if (repeatedPain.length) risk.push({ level: 'warn', text: repeatedPain.join(', ') + ' 통증이 반복되고 있어요. 2주 이상 이어지면 정형외과 상담을 권장합니다.' });
    if (load.zone === 'spike') risk.push({ level: 'warn', text: '최근 7일 부하가 직전 4주 평균의 ' + load.ratio + '배예요. 급증한 주에는 부상 위험이 커지니 다음 주는 볼륨을 유지하세요.' });
    if (streakDays >= 6) risk.push({ level: 'info', text: streakDays + '일 연속 훈련 중이에요. 24시간 휴식을 넣어 주세요.' });
    if (pace.level === 'brake') risk.unshift({ level: 'warn', text: pace.text });
    /* 피로 점프 경고는 맨 앞 경고를 가리지 않게 뒤에 붙입니다(통증·강도 조절이 우선) */
    if (jump.on) risk.push({ level: 'warn', text: jump.reason });
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
      drills: {
        drills: drills,
        note: [drillSwap.note || '', jumpSwap.note || ''].filter(Boolean).join(' '),
        swapped: (drillSwap.swapped || []).concat(jumpSwap.swapped || []).slice(),
        jumpSwapped: (jumpSwap.swapped || []).slice(),
        areas: painList.slice()
      },
      care: care,
      prevent: prevent,
      guard: guard,
      cool: cool,
      jump: jump,
      balance: balance,
      rhythm: rhythm,
      loadGuide: loadGuide,
      offcourt: offcourtRoutine(discipline),
      sense: senseRoutine(discipline, level, weakSkills),
      match: matchDay(discipline),
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
    DRILLS: DRILLS, REHAB: INJURY, INJURY: INJURY, PRO_DRIVE: PRO_DRIVE,
    GRADE_PLANS: GRADE_PLANS, TACTICS: TACTICS, WARMUP: WARMUP,
    GRADES: GRADES, gradeOf: gradeOf, tierOf: tierOf, setsFor: setsFor,
    gradePlan: gradePlan, playbook: playbook,
    gameFlow: gameFlow, loadIndex: loadIndex, scoreModeOf: scoreModeOf,
    preventionWarmup: preventionWarmup, disciplineLoadGuide: disciplineLoadGuide,
    coolDown: coolDown, CALF: CALF, CALF_STATS: CALF_STATS,
    jointGuard: jointGuard, guardChain: guardChain, CHAIN: CHAIN,
    fatigueJump: fatigueJump, FATIGUE_JUMP: FATIGUE_JUMP, jumpSafeDrills: jumpSafeDrills,
    SHOULDER_RISK: SHOULDER_RISK, LOWER_RISK: LOWER_RISK,
    proBalance: proBalance, loadRhythm: loadRhythm, PRO_BAL: PRO_BAL, RHYTHM: RHYTHM,
    offcourtRoutine: offcourtRoutine, OFFCOURT: OFFCOURT,
    senseRoutine: senseRoutine, SENSE: SENSE, senseFocus: senseFocus,
    matchDay: matchDay, MATCH_DAY: MATCH_DAY,
    paceGuide: paceGuide, SELF_PACE: SELF_PACE, PAIN_RULE: PAIN_RULE,
    painSafeDrills: painSafeDrills, PAIN_SAFE_DRILLS: PAIN_SAFE_DRILLS, PAIN_LOAD_WORDS: PAIN_LOAD_WORDS,
    disciplineKey: disciplineKey, PREVENT: PREVENT, LOAD_GUIDE: LOAD_GUIDE,
    /* 논문 기준값 — 화면 문구와 같은 숫자 */
    SPLIT_STEP: SPLIT_STEP, DOUBLES_SERVE: DOUBLES_SERVE, DOUBLES_RECEIVE: DOUBLES_RECEIVE,
    GAME_PHASE: GAME_PHASE, ARM_RISK: ARM_RISK
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
