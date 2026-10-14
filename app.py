import streamlit as st
import datetime
import pandas as pd
import calendar

# 1. 페이지 설정 및 모바일 디자인 CSS 최적화
st.set_page_config(
    page_title="배드민턴 정밀 훈련 시스템", 
    page_icon="🏸", 
    layout="wide"
)

hide_streamlit_style = """
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .stDeployButton {display: none;}
    
    .block-container {
        padding-top: 1rem;
        padding-bottom: 3rem;
        padding-left: 0.8rem;
        padding-right: 0.8rem;
    }
    
    .mini-card {
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color: white;
        padding: 15px;
        border-radius: 15px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        margin-bottom: 15px;
    }
    
    .cal-memo-box {
        font-size: 11px;
        color: #1e3c72;
        background-color: #eef2f5;
        border-radius: 4px;
        padding: 3px;
        margin-top: 2px;
        word-break: break-all;
    }
    </style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

# 세션 상태 초기화
if "started" not in st.session_state:
    st.session_state.started = False

if "user_level" not in st.session_state:
    st.session_state.user_level = "선수용 (고강도 전문 훈련)"

if "match_type" not in st.session_state:
    st.session_state.match_type = "복식 (Double - 순발력/전위 반응/스매시 파워)"

if "cal_view_mode" not in st.session_state:
    st.session_state.cal_view_mode = "widget"

if "selected_date" not in st.session_state:
    st.session_state.selected_date = str(datetime.date.today())

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

if "schedule_mapping" not in st.session_state:
    st.session_state.schedule_mapping = level_default_schedules[st.session_state.user_level]

if "monthly_calendar_plans" not in st.session_state:
    st.session_state.monthly_calendar_plans = {}

if "monthly_calendar_memos" not in st.session_state:
    st.session_state.monthly_calendar_memos = {}

if "training_history" not in st.session_state:
    st.session_state.training_history = []


# ==========================================
# 🏠 시작 화면 (Landing Screen)
# ==========================================
if not st.session_state.started:
    st.markdown("<br>", unsafe_allow_html=True)
    st.title("🏸 스포츠 과학 & 심리학 기반 배드민턴 정밀 훈련 시스템")
    st.markdown("### 🚀 완벽한 코트 제압을 위한 나만의 맞춤형 훈련 파트너")
    st.write("먼저 본인의 **훈련 레벨**을 선택하고 시스템에 입장하세요!")
    
    st.markdown("---")
    st.markdown("#### 👤 훈련자 레벨 선택")
    
    col_l1, col_l2, col_l3 = st.columns(3)
    
    with col_l1:
        st.markdown("🌱 **초보용**")
        st.caption("입문 및 기초 체력 향상 코스")
        if st.button("초보용으로 시작", use_container_width=True, key="btn_beginner"):
            st.session_state.user_level = "초보용 (입문 및 기초 체력)"
            st.session_state.schedule_mapping = level_default_schedules[st.session_state.user_level]
            st.session_state.started = True
            st.rerun()
            
    with col_l2:
        st.markdown("🔥 **일반부**")
        st.caption("동호인 및 취미 실전 강화 코스")
        if st.button("일반부로 시작", use_container_width=True, key="btn_normal"):
            st.session_state.user_level = "일반부 (동호인/취미 운동)"
            st.session_state.schedule_mapping = level_default_schedules[st.session_state.user_level]
            st.session_state.started = True
            st.rerun()
            
    with col_l3:
        st.markdown("🏆 **선수용**")
        st.caption("고강도 전문 훈련 및 시합 준비반")
        if st.button("선수용으로 시작", type="primary", use_container_width=True, key="btn_pro"):
            st.session_state.user_level = "선수용 (고강도 전문 훈련)"
            st.session_state.schedule_mapping = level_default_schedules[st.session_state.user_level]
            st.session_state.started = True
            st.rerun()

    st.markdown("---")
    st.info("💡 **안내:** 입장 후에도 언제든지 좌측 사이드바에서 레벨과 주력 종목을 변경하실 수 있습니다.")

# ==========================================
# 🏆 메인 훈련 시스템 화면
# ==========================================
else:
    with st.sidebar:
        st.markdown("### 🧭 네비게이션 & 기본 설정")
        if st.button("🏠 처음 시작 화면으로", use_container_width=True):
            st.session_state.started = False
            st.rerun()
        st.markdown("---")
        
        st.markdown("⚙️ **현재 레벨 & 주력 종목 설정**")
        
        levels = ["초보용 (입문 및 기초 체력)", "일반부 (동호인/취미 운동)", "선수용 (고강도 전문 훈련)"]
        current_level_idx = levels.index(st.session_state.user_level) if st.session_state.user_level in levels else 2

        selected_level = st.selectbox(
            "훈련자 레벨 선택",
            levels,
            index=current_level_idx,
            key="sb_level_select"
        )
        
        if selected_level != st.session_state.user_level:
            st.session_state.user_level = selected_level
            st.session_state.schedule_mapping = level_default_schedules[selected_level]
            st.rerun()

        match_types = ["복식 (Double - 순발력/전위 반응/스매시 파워)", "단식 (Single - 심폐 지구력/코트 커버리지)"]
        current_match_idx = match_types.index(st.session_state.match_type) if st.session_state.match_type in match_types else 0

        selected_match_type = st.selectbox(
            "주력 종목 선택",
            match_types,
            index=current_match_idx,
            key="sb_match_select"
        )
        if selected_match_type != st.session_state.match_type:
            st.session_state.match_type = selected_match_type
            st.rerun()

    st.title("🏸 배드민턴 정밀 훈련 & 컨디션 관리 센터")
    st.markdown("---")

    tab1, tab2, tab3 = st.tabs([
        "📅 1. 캘린더 & 일주일 훈련 진단", 
        "📝 2. 레벨별 기술·심리 진단 및 오늘의 훈련 기록", 
        "📊 3. 100점 만점 훈련 리포트 & 히스토리"
    ])

    with tab1:
        # 위젯 모드
        if st.session_state.cal_view_mode == "widget":
            today_str = str(datetime.date.today())
            today_plans = st.session_state.monthly_calendar_plans.get(today_str, [])
            today_memo = st.session_state.monthly_calendar_memos.get(today_str, "")
            
            st.markdown(
                f"""
                <div class="mini-card">
                    <h3 style="margin:0;">🏸 오늘의 스마트 배드민턴 위젯</h3>
                    <p style="margin-top:8px; font-size:15px;">🗓️ 오늘 날짜: <b>{today_str}</b></p>
                    <p style="font-size:14px; margin-bottom:0;">현재 설정된 레벨: <b>{st.session_state.user_level}</b></p>
                </div>
                """,
                unsafe_allow_html=True
            )
            
            st.info(f"📋 **오늘의 훈련:** {', '.join(today
