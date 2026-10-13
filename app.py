import streamlit as st
import datetime
import pandas as pd

st.title("🏋️ 스포츠 과학 & 심리학 기반 배드민턴 정밀 훈련 시스템")
st.write("레벨별(초보/일반/선수) 맞춤형 스케줄, 기술 생체역학 및 스포츠 심리 진단·보강 처방 도구")

# 0. 세션 상태 초기화
if "user_level" not in st.session_state:
    st.session_state.user_level = "선수용 (고강도 전문 훈련)"

if "match_type" not in st.session_state:
    st.session_state.match_type = "복식 (Double - 순발력/전위 반응/스매시 파워)"

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
