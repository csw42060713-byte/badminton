import streamlit as st
import datetime
import pandas as pd

st.set_page_config(page_title="배드민턴 정밀 훈련 시스템", page_icon="🏸", layout="wide")

# 0. 세션 상태 초기화
if "started" not in st.session_state:
    st.session_state.started = False

if "user_level" not in st.session_state:
    st.session_state.user_level = "선수용 (고강도 전문 훈련)"

if "match_type" not in st.session_state:
    st.session_state.match_type = "복식 (Double - 순발력/전위 반응/스매시 파워)"

if "weekly_goal_stroke" not in st.session_state:
    st.session_state.weekly_goal_stroke = 6
if "weekly_goal_wall" not in st.session_state:
    st.session_state.weekly_goal_wall = 3
if "weekly_goal_interval" not in st.session_state:
    st.session_state.weekly_goal_interval = 3
if "weekly_goal_core" not in st.session_state:
    st.session_state.weekly_goal_core = 3
if "weekly_goal_strength" not in st.session_state:
    st.session_state.weekly_goal_strength = 2

# 레벨별 기본 요일 스케줄 정의
level_default_schedules = {
    "선수용 (고강도 전문 훈련)": {
        "월요일": ["스트록", "벽치기", "코어", "근력"],
        "화요일": ["스트록", "인터벌", "근력"],
        "수요일": ["스트록", "벽치기", "코어"],
        "목요일": ["스트록", "인터벌", "근력"],
        "금요일": ["스트록", "벽치기", "코어"],
        "토요일": ["스트록", "인터벌"],
        "일요일": []
    },
    "일반부 (동호인/취미 운동)": {
        "월요일": ["스트록", "코어"],
        "화요일": ["스트록", "근력"],
        "수요일": ["벽치기", "코어"],
        "목요일": ["스트록", "인터벌"],
        "금요일": ["스트록"],
        "토요일": ["스트록", "벽치기"],
        "일요일": []
    },
    "초보용 (입문 및 기초 체력)": {
        "월요일": ["벽치기", "코어"],
        "화요일": ["스트록"],
        "수요일": ["벽치기", "코어"],
        "목요일": ["스트록"],
        "금요일": ["벽치기"],
        "토요일": ["스트록"],
        "일요일": []
    }
}

if "training_history" not in st.session_state:
    st.session_state.training_history = []

# ==========================================
# 🏠 시작 화면 (Landing / Home Screen)
# ==========================================
if not st.session_state.started:
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.title("🏸 스포츠 과학 & 심리학 기반 배드민턴 정밀 훈련 시스템")
    st.markdown("### 🚀 완벽한 코트 제압을 위한 나만의 맞춤형 훈련 파트너")
    st.write("레벨별 맞춤 스케줄 관리, 생체역학 기반 s-RPE 부하 분석, 그리고 스포츠 심리 처방까지 한 번에 관리하세요.")
    
    st.markdown("---")
    
    col_start1, col_start2 = st.columns([2, 1])
    with col_start1:
        st.info("💡 **시작하기 전 안내**\n- 좌측 상단 또는 아래 버튼을 눌러 훈련을 시작할 수 있습니다.\n- 매일의 컨디션과 훈련량을 기록하여 과학적인 데이터로 실력을 키워보세요!")
    
    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("🔥 훈련 시스템 입장하기", type="primary", use_container_width=True):
        st.session_state.started = True
        st.rerun()

# ==========================================
# 🏆 메인 훈련 시스템 화면
# ==========================================
else:
    with st.sidebar:
        st.markdown("### 🧭 네비게이션")
        if st.button("🏠 처음 시작 화면으로", use_container_width=True):
            st.session_state.started = False
            st.rerun()
        st.markdown("---")
        st.markdown(f"👤 **현재 레벨**\n`{st.session_state.user_level}`")
        st.markdown(f"🎯 **주력 종목**\n`{st.session_state.match_type}`")

    st.title("🏋️ 배드민턴 정밀 훈련 & 생리 부하 관리 센터")
    st.markdown("---")

    tab1, tab2, tab3 = st.tabs([
        "⚙️ 1. 주간 목표 및 레벨별 스케줄 설정", 
        "📝 2. 레벨별 기술·심리 진단 및 s-RPE 입력", 
        "📊 3. 주간 시각화, 과학적 지표 및 히스토리"
    ])

    with tab1:
        st.subheader("🎯 레벨 및 종목(단식/복식) 생체역학 설정")
        
        col_s1, col_s2 = st.columns(2)
        with col_s1:
            selected_level = st.selectbox(
                "훈련자 레벨 선택",
                ["초보용 (입문 및 기초 체력)", "일반부 (동호인/취미 운동)", "선수용 (고강도 전문 훈련)"],
                index=["초보용 (입문 및 기초 체력)", "일반부 (동호인/취미 운동)", "선수용 (고강도 전문 훈련)"].index(st.session_state.user_level) if st.session_state.user_level in ["초보용 (입문 및 기초 체력)", "일반부 (동호인/취미 운동)", "선수용 (고강도 전문 훈련)"] else 0
            )
            if selected_level != st.session_state.user_level:
                st.session_state.user_level = selected_level
                if "초보용" in selected_level:
                    st.session_state.weekly_goal_core = 1
                    st.session_state.weekly_goal_strength = 1
                    st.session_state.weekly_goal_interval = 0
                    st.session_state.weekly_goal_wall = 1
                    st.session_state.weekly_goal_stroke = 2
                elif "일반부" in selected_level:
                    st.session_state.weekly_goal_core = 2
                    st.session_state.weekly_goal_strength = 2
                    st.session_state.weekly_goal_interval = 1
                    st.session_state.weekly_goal_wall = 2
                    st.session_state.weekly_goal_stroke = 3
                else:
                    st.session_state.weekly_goal_core = 3
                    st.session_state.weekly_goal_strength = 2
                    st.session_state.weekly_goal_interval = 3
                    st.session_state.weekly_goal_wall = 3
                    st.session_state.weekly_goal_stroke = 6
                st.rerun()

        with col_s2:
            st.session_state.match_type = st.selectbox(
                "주력 종목 선택",
                ["복식 (Double - 순발력/전위 반응/스매시 파워)", "단식 (Single - 심폐 지구력/코트 커버리지)"]
            )

        st.markdown("---")
        col_g1, col_g2 = st.columns(2)
        with col_g1:
            st.markdown("🏸 **배드민턴 주간 총 목표 (횟수 기준)**")
            st.session_state.weekly_goal_stroke = st.slider("주간 총 스트록 목표 횟수", 0, 7, st.session_state.weekly_goal_stroke)
            st.session_state.weekly_goal_wall = st.slider("주간 총 벽치기 목표 횟수", 0, 7, st.session_state.weekly_goal_wall)
            st.session_state.weekly_goal_interval = st.slider("주간 총 인터벌 목표 횟수", 0, 7, st.session_state.weekly_goal_interval)
        with col_g2:
            st.markdown("💪 **체력 및 보강 주간 총 목표 (횟수 기준)**")
            st.session_state.weekly_goal_core = st.slider("주간 총 코어 운동 목표 횟수", 0, 7, st.session_state.weekly_goal_core)
            st.session_state.weekly_goal_strength = st.slider("주간 총 근력 운동 목표 횟수", 0, 7, st.session_state.weekly_goal_strength)

        st.markdown("---")
        st.subheader(f"🗓️ 요일별 훈련 배정 설정 (현재 레벨: {st.session_state.user_level})")
        days_of_week = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]
        exercise_categories = ["스트록", "벽치기", "인터벌", "코어", "근력"]

        if "schedule_mapping" not in st.session_state:
            st.session_state.schedule_mapping = level_default_schedules[st.session_state.user_level]

        for day in days_of_week:
            with st.expander(f"📌 {day} 훈련 배정 관리"):
                current_assigned = st.session_state.schedule_mapping.get(day, level_default_schedules[st.session_state.user_level].get(day, []))
                new_assigned = st.multiselect(
                    f"{day}에 수행할 훈련 선택",
                    exercise_categories,
                    default=current_assigned,
                    key=f"schedule_{day}"
                )
                st.session_state.schedule_mapping[day] = new_assigned

    with tab2:
        st.subheader("📅 오늘의 훈련 수행, 레벨별 기술·심리 진단 및 s-RPE 입력")
        
        col_d, col_date, col_weight = st.columns(3)
        with col_d:
            today_selection = st.selectbox("오늘 요일 선택", ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"], key="today_sel_tab2")
        with col_date:
            train_date = st.date_input("수행 날짜", datetime.date.today())
        with col_weight:
            user_weight = st.number_input("본인 체중 (kg)", min_value=30.0, max_value=150.0, value=65.0, step=0.5)

        col_c1, col_c2 = st.columns(2)
        with col_c1:
            condition = st.slider("오늘의 컨디션 점수 (1~10)", 1, 10, 5)
        with col_c2:
            rpe_score = st.slider("운동 자각도 (CR10 RPE 스케일)", 1, 10, 7, help="총 시간 × RPE로 s-RPE 생리 부하 산출")

        st.markdown("---")
        current_level = st.session_state.user_level
        st.subheader(f"🧠 [레벨 맞춤: {current_level}] 기술·심리 자가진단 및 기타 학습")

        if "초보용" in current_level:
            strength_options = [
                "기본 그립 잡기 및 정면 언더클리어 안정적 구사",
                "짧은 거리 하이클리어 타점 포착 양호",
                "기본 스텝(사이드 스텝) 리듬 유지 양호"
            ]
            weakness_options = [
                "라켓 면이 틀어져 셔틀콕이 엉뚱한 방향으로 날아감",
                "스윙할 때 팔꿈치가 내려가고 손목 스냅이 안 잡힘",
                "스텝이 엉겨서 셔틀콕 낙이지점을 따라가지 못함",
                "랠리가 조금만 길어져도 체력이 급격히 방전됨",
                "게임 중 긴장해서 실수가 반복되고 당황함"
            ]
        elif "일반부" in current_level:
            strength_options = [
                "클리어와 드롭 샷의 구종 전환 타이밍 우수",
                "후위 언더핸드 수비 및 푸시 리시브 안정적",
                "기본적인 복식 로테이션 및 코트 커버리지 원활",
                "랠리 중 페이스 조절 및 집중력 유지 양호"
            ]
            weakness_options = [
                "스매시 타점이 자꾸 뒤로 밀려 파워가 실리지 않음",
                "전위 헤어핀 시 라켓 헤드가 너무 깊숙이 들어가 밀림",
                "푸시 동작에서 과도한 힘이 들어가 아웃 범실 발생",
                "경기 후반 하체 피로로 인해 스텝 속도가 느려짐",
                "접전 상황이나 스코어 역전 시 멘탈이 흔들림"
            ]
        else: 
            strength_options = [
                "고강도 점프 스매시 회전 토크 및 타점 높이 극대화",
                "전위 드라이브 싸움에서 빠른 라켓 반응속도 유지",
                "올코트 커버리지 중 딥 런지 밸런스 완벽 유지",
                "클러치 상황(듀스/매치포인트) 심박수 통제 및 멘탈 루틴 유지"
            ]
            weakness_options = [
                "오버헤드 스트록 시 상완 회전근개 협응 저하로 파워 저하",
                "고강도 랠리 중 전완근 억제(경직)로 인한 손목 스냅 타이밍 상실",
                "후위 딥 런지 시 코어 안티로테이션 및 코골반 안정성 무너짐",
                "연속 실책 후 반추 사고(Rumination)로 인한 집중력 교란",
                "최종 3세트 후반 무산소성 한계 상황에서의 신체 경직"
            ]

        col_str, col_weak = st.columns(2)
        with col_str:
            st.markdown(f"✨ **오늘 나의 주요 강점 ({current_level.split()[0]})**")
            my_strengths = st.multiselect("잘 풀렸던 기술 및 요인 선택", strength_options, key="str_sel_lvl")
            extra_strength = st.text_input("✨ [기타 강점 직접 입력 (선택사항)]", placeholder="예: 백핸드 클리어 성공 등", key="extra_str_lvl")

        with col_weak:
            st.markdown(f"⚠️ **오늘 보완이 필요한 취약점 ({current_level.split()[0]})**")
            my_weaknesses = st.multiselect("보완이 필요한 기술 및 요인 선택", weakness_options, key="weak_sel_lvl")
            extra_weakness = st.text_input("⚠️ [기타 취약점 직접 입력 (선택사항)]", placeholder="예: 특정 코스로 오는 공 대처가 어려움 등", key="extra_weak_lvl")

        today_plan = st.session_state.schedule_mapping.get(today_selection, level_default_schedules[current_level].get(today_selection, []))
        st.info(f"💡 **[{today_selection} 스케줄 안내]** 레벨: **{st.session_state.user_level}** | 주력 종목: **{st.session_state.match_type}**")

        st.markdown("---")
        st.subheader("⏱️ 기본 훈련량 수행 시간 입력 (분 단위)")
        
        col_r1, col_r2 = st.columns(2)
        with col_r1:
            real_stroke_min = st.slider("오늘 스트록 수행 시간 (분)", 0, 180, 30 if "스트록" in today_plan else 0, step=10, key="r_stroke")
            real_wall_min = st.slider("오늘 벽치기 수행 시간 (분)", 0, 120, 20 if "벽치기" in today_plan else 0, step=5, key="r_wall")
            real_interval_min = st.slider("오늘 인터벌 수행 시간 (분)", 0, 120, 20 if "인터벌" in today_plan else 0, step=5, key="r_inter")
        with col_r2:
            real_core_min = st.slider("오늘 코어 운동 수행 시간 (분)", 0, 120, 20 if "코어" in today_plan else 0, step=5, key="r_core")
            real_strength_min = st.slider("오늘 근력 운동 수행 시간 (분)", 0, 180, 40 if "근력" in today_plan else 0, step=10, key="r_str")

        hunbol_time = 0.0
        footwork_details = []
        if "선수용" in st.session_state.user_level:
            st.markdown("---")
            st.markdown("🏆 **[선수용 특화] 헌볼 및 풋워크 정밀 지표**")
            train_hunbol = st.checkbox("오늘 헌볼(Multi-shuttle) 훈련 수행함", key="chk_hunbol")
            if train_hunbol:
                hunbol_time = st.slider("헌볼 훈련 시간 (시간 단위)", 0.5, 3.0, 1.0, 0.5, format="%.1f시간", key="hunbol_slider")

            train_footwork = st.checkbox("오늘 풋워크(Footwork) 훈련 수행함", key="chk_footwork")
            if train_footwork:
                fw_types = st.multiselect(
                    "수행한 풋워크 코스 선택",
                    ["직선", "대각", "사이드", "앞사각", "뒷사각", "올코트 (All-court)"],
                    key="fw_types_sci"
                )
                for fw in fw_types:
                    fc1, fc2 = st.columns(2)
                    with fc1:
                        fw_sets = st.number_input(f"[{fw}] 세트 수", 1, 5, 3, key=f"fw_s_{fw}")
                    with fc2:
                        if fw == "올코트 (All-court)":
                            fw_count = st.number_input(f"[{fw}] 반복 횟수", 20, 50, 30, 1, key=f"fw_c_{fw}")
                            footwork_details.append(f"풋워크-{fw}: {fw_sets}세트(반복{fw_count}개)")
                        else:
                            footwork_details.append(f"풋워크-{fw}: {fw_sets}세트")

        st.markdown("---")
        st.subheader("🛠️ 논문 기반 부위별 & 기능별 전문 보강 운동 기록")

        grip_exercises = []
        with st.expander("① 악력 운동 (스냅, 라켓 컨트롤, 리시브 안정성)"):
            if st.checkbox("악력 운동 수행함", key="chk_g"):
                g_sel = st.multiselect("종목", ["추 감기(Heavy Roller)", "팻그립 바벨 홀드", "리버스 리스트 컬", "핑거 팁 푸시업"], key="g_sel_sci")
                for g in g_sel:
                    sets = st.number_input(f"[{g}] 세트 수", 1, 10, 3, key=f"gs_{g}")
                    grip_exercises.append(f"{g} {sets}세트")

        core_exercises = []
        with st.expander("② 코어 운동 (스윙 회전력, 안티로테이션, 허리 안정화)"):
            if st.checkbox("코어 운동 수행함", key="chk_c"):
                c_sel = st.multiselect("종목", ["케이블 팔로 오프 프레스", "행잉 레그 레이즈", "랜드마인 트위스트", "짐볼 플랭크"], key="c_sel_sci")
                for c in c_sel:
                    sets = st.number_input(f"[{c}] 세트 수", 1, 10, 3, key=f"cs_{c}")
                    core_exercises.append(f"{c} {sets}세트")

        stroke_aux_exercises = []
        with st.expander("③ 스트록 보조 운동 (타구 파워 및 회전 토크)"):
            if st.checkbox("스트록 보조 운동 수행함", key="chk_st"):
                st_sel = st.multiselect("종목", ["헤비 라켓 스윙", "메디신볼 오버헤드 스로우", "케이블 하이 풀리 스윙"], key="st_sel_sci")
                for st_item in st_sel:
                    sets = st.number_input(f"[{st_item}] 세트 수", 1, 10, 3, key=f"sts_{st_item}")
                    stroke_aux_exercises.append(f"{st_item} {sets}세트")

        jump_exercises = []
        with st.expander("④ 점프 운동 (신장-단축 주기, 탄성 에너지 극대화)"):
            if st.checkbox("점프 운동 수행함", key="chk_j"):
                j_sel = st.multiselect("종목", ["데프스 점프 (Depth Jump)", "박스 점프", "턱걸이 점프 (Tuck Jump)"], key="j_sel_sci")
                for j in j_sel:
                    sets = st.number_input(f"[{j}] 세트 수", 1, 10, 3, key=f"js_{j}")
                    jump_exercises.append(f"{j} {sets}세트")

        upper_exercises = []
        with st.expander("⑤ 상체 근력 (폭발적 파워 및 견관절 안정성)"):
            if st.checkbox("상체 근력 운동 수행함", key="chk_up"):
                u_sel = st.multiselect("종목", ["푸시 프레스 (Push Press)", "웨이트 풀업", "벤치프레스"], key="u_sel_sci")
                for u in u_sel:
                    sets = st.number_input(f"[{u}] 세트 수", 1, 10, 3, key=f"us_{u}")
                    upper_exercises.append(f"{u} {sets}세트")

        lower_exercises = []
        with st.expander("⑥ 하체 근력 (불균형 방지 및 런지 파워)"):
            if st.checkbox("하체 근력 운동 수행함", key="chk_low"):
                l_sel = st.multiselect("종목", ["불리언 스쿼트 (Bulgarian Split Squat)", "파워 클린", "바벨 힙스러스트"], key="l_sel_sci")
                for l in l_sel:
                    sets = st.number_input(f"[{l}] 세트 수", 1, 10, 3, key=f"ls_{l}")
                    lower_exercises.append(f"{l} {sets}세트")

        st.markdown("---")
        st.markdown("⚔️ **실전 경기(Game) 복수 기록 (랠리 분석)**")
        game_details = []
        has_games = st.checkbox("오늘 실전 경기(Game)를 진행함", key="chk_games_sci")
        if has_games:
            num_games = st.number_input("오늘 치른 총 경기 수", 1, 10, 1, key="num_games_sci")
            for g_idx in range(1, num_games + 1):
                with st.expander(f"경기 #{g_idx} 상세 기록"):
                    opponent_name = st.text_input(f"상대 선수 / 팀 이름", f"상대 {g_idx}", key=f"opp_sci_{g_idx}")
                    game_sets = st.number_input(f"세트 수 (최대 3세트)", 1, 3, 3, key=f"sets_sci_{g_idx}")
                    set_scores_str = []
                    for i in range(1, game_sets + 1):
                        gc1, gc2, gc3 = st.columns(3)
                        with gc1:
                            my_score = st.number_input(f"내 점수 ({i}세트)", 0, 30, 21, key=f"my_sc_{g_idx}_{i}")
                        with gc2:
                            opp_score = st.number_input(f"상대 점수 ({i}세트)", 0, 30, 15, key=f"opp_sc_{g_idx}_{i}")
                        with gc3:
                            is_win = st.radio(f"결과 ({i}세트)", ["승리", "패배"], key=f"win_sc_{g_idx}_{i}")
                        set_scores_str.append(f"{i}세트({my_score}:{opp_score}-{is_win})")
                    game_details.append(f"[경기{g_idx}] 상대: {opponent_name} / " + ", ".join(set_scores_str))

        overall_memo = st.text_area("💬 오늘 훈련 생체역학적 및 심리적 소감")

        if st.button("논문 기반 정밀 생리·심리 부하 분석 및 저장"):
            total_training_minutes = real_stroke_min + real_wall_min + real_interval_min + real_core_min + real_strength_min + (hunbol_time * 60)
            s_rpe_load = total_training_minutes * rpe_score
            
            is_doubles = "복식" in st.session_state.match_type
            match_coefficient = 1.15 if is_doubles else 1.25
            
            total_aux_count = len(grip_exercises) + len(core_exercises) + len(stroke_aux_exercises) + \
                              len(jump_exercises) + len(upper_exercises) + len(lower_exercises)
            
            biomechanical_index = (s_rpe_load * 0.05) + (total_aux_count * 12) + (len(game_details) * 30) + (hunbol_time * 25)
            final_biological_score = biomechanical_index * match_coefficient * (user_weight / 65.0)

            log_entry = {
                "날짜": str(train_date),
                "요일": today_selection,
                "레벨": st.session_state.user_level,
                "종목": st.session_state.match_type,
                "컨디션": condition,
                "RPE": rpe_score,
                "s-RPE부하(AU)": round(s_rpe_load, 1),
                "생체부하지수": round(final_biological_score, 1),
                "기타취약점": extra_weakness,
                "소감": overall_memo
            }
            st.session_state.training_history.append(log_entry)

            st.success(f"[{today_selection} / {train_date}] 논문 기반 정밀 분석 완료 및 저장됨! (3번 탭에서 확인)")
            
            st.markdown("---")
            if s_rpe_load >= 500 or rpe_score >= 8:
                st.info("🔥 **오늘 진짜 엄청나게 불태우셨네요!** 온몸에 힘이 꽉 들어가서 피곤하실 텐데, 오늘은 따뜻한 물로 샤워하고 꿀잠 주무세요! 고생 정말 많았어요 토닥토닥 🥹")
            elif condition <= 4:
                st.info("🥺 **오늘은 컨디션이 조금 힘들었나 봐요...** 몸이 무거워도 끝까지 버텨낸 당신이 챔피언입니다! 오늘은 무리하지 말고 푹 쉬어요 힘내세요! 💪")
            elif s_rpe_load <= 200:
                st.info("🍀 **오늘은 평범하고 차분한 하루였어요!** 때로는 이런 루틴한 하루가 쌓여서 엄청난 실력이 된답니다. 오늘도 묵묵히 해내느라 수고 많았어요 😊")
            else:
                st.info("✨ **컨디션 최고! 오늘 코트를 아주 멋지게 씹어드셨군요?** 이 기세 그대로 내일도 멋지게 날아봅시다 화이팅 😆🏸")

            st.markdown(f"### 📈 [{today_selection}] 스포츠 과학 및 심리 진단 결과")
            col_res1, col_res2 = st.columns(2)
            with col_res1:
                st.metric("훈련 부하 (s-RPE)", f"{s_rpe_load:.1f} AU")
            with col_res2:
                st.metric("종합 생체 부하 지수", f"{final_biological_score:.1f}점")
            
            st.markdown("---")
            st.subheader("💡 논문 기반 기술 생체역학 & 스포츠 심리 맞춤 처방전")
            
            active_weaknesses = [w for w in my_weaknesses if w]
            if extra_weakness and extra_weakness.strip():
                active_weaknesses.append(extra_weakness.strip())

            if len(active_weaknesses) > 0:
                st.markdown("🎯 **[자가진단 취약점 맞춤 보강 솔루션]**")
                for w in active_weaknesses:
                    if "타점" in w or "회전" in w or "스매시" in w or "클리어" in w or "라켓 면" in w:
                        st.warning(f"👉 **취약점:** `{w}`\n\n  * **🔬 논문 기반 생체역학 처방:** 상완 회전근개 안정화 및 **메디신볼 오버헤드 스로우**, **헤비 라켓 스윙**을 통해 임팩트 시 회전 토크를 극대화하고 라켓 면 정렬을 교정하세요.")
                    elif "손목" in w or "악력" in w or "헤어핀" in w or "리시브" in w or "팔꿈치" in w:
                        st.warning(f"👉 **취약점:** `{w}`\n\n  * **🔬 논문 기반 생체역학 처방:** 전완근 피로 완화를 위해 **추 감기(Heavy Roller)**와 **팻그립 바벨 홀드**를 처방합니다. 임팩트 순간 불필요한 긴장을 풀어줍니다.")
                    elif "런지" in w or "중심" in w or "하체" in w or "밸런스" in w or "스텝" in w or "체력" in w:
                        st.warning(f"👉 **취약점:** `{w}`\n\n  * **🔬 논문 기반 생체역학 처방:** 하체 밸런스 및 지구력 강화를 위해 **불리언 스쿼트(Bulgarian Split Squat)**와 코어 안티로테이션인 **케이블 팔로 오프 프레스**, **인터벌 젖산 내성 훈련**을 집중 수행하세요.")
                    elif "멘탈" in w or "생각" in w or "범실" in w or "긴장" in w or "힘" in w or "당황" in w:
                        st.warning(f"👉 **취약점:** `{w}`\n\n  * **🧠 스포츠 심리학 처방 (Arousal & Anxiety Control):** 인지적 불안 완화를 위해 **4-7-8 호흡 루틴(Box Breathing)**과 '과거 실점에 얽매이지 않는 주의 집중 전환(Attentional Control)' 훈련을 적용하세요.")
                    else:
                        st.warning(f"👉 **취약점:** `{w}`\n\n  * **🔬 스포츠 과학 맞춤 분석 처방:** 입력하신 특이사항에 맞춰 해당 부위의 **관절 가동범위(ROM) 스트레칭**과 **종목별 반복 스냅 훈련**을 병행하여 전신 협응력을 높여주세요!")
            else:
                st.success("✨ 오늘 특별히 체크하신 취약점이 없습니다! 훌륭한 밸런스를 유지하고 계시네요.")

            st.markdown("---")
            is_doubles = "복식" in st.session_state.match_type
            if is_doubles:
                st.markdown("🔹 **[복식 생체역학 진단]** 복식은 **무산소성 포스파겐 시스템(ATP-PC)**과 **반복 스프린트(RSA)**가 지배적입니다.")
            else:
                st.markdown("🔹 **[단식 생체역학 진단]** 단식은 **유산소/무산소 복합 대사(V̇O2max 및 젖산 역치)**와 장시간 코트 커버리지가 핵심입니다.")

    with tab3:
        st.subheader("📊 주간 누적 통계, s-RPE 그래프 및 논문 히스토리")
        
        if len(st.session_state.training_history) == 0:
            st.info("📌 저장된 훈련 일지가 없습니다. 2번 탭에서 훈련을 기록해 주세요!")
        else:
            df_history = pd.DataFrame(st.session_state.training_history)
            
            st.markdown("### 📋 전체 정밀 훈련 로그 목록")
            st.dataframe(df_history, use_container_width=True)
            
            st.markdown("---")
            st.subheader("📈 s-RPE 및 생체 부하 지수 트렌드 그래프")
            if len(df_history) > 0:
                chart_data = df_history.set_index("날짜")[["s-RPE부하(AU)", "생체부하지수"]]
                st.line_chart(chart_data)
            
            st.markdown("---")
            st.subheader("⏱️ 주간 누적 생리 데이터 요약")
            col_m1, col_m2, col_m3 = st.columns(3)
            col_m1.metric("총 훈련 세션 수", f"{len(df_history)}회")
            col_m2.metric("평균 s-RPE 부하", f"{df_history['s-RPE부하(AU)'].mean():.1f} AU")
            col_m3.metric("평균 생체 부하 지수", f"{df_history['생체부하지수'].mean():.1f}점")

            st.markdown("---")
            st.subheader("💾 논문 기반 훈련 데이터 파일 다운로드 (CSV)")
            csv_data = df_history.to_csv(index=False).encode('utf-8-sig')
            st.download_button(
                label="📥 정밀 훈련 일지 CSV 다운로드",
                data=csv_data,
                file_name=f"badminton_scientific_training_log_{datetime.date.today()}.csv",
                mime="text/csv"
            )
