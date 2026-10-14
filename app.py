import streamlit as st
import datetime
import pandas as pd
import calendar

# 1. 모바일 최적화 및 완벽한 가로 정렬 스타일 설정
st.set_page_config(
    page_title="내 손안의 배드민턴 훈련장", 
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
        padding-top: 0.5rem;
        padding-bottom: 7rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
    
    .main-title {
        font-size: 18px;
        font-weight: bold;
        color: #1e3c72;
        text-align: center;
        margin-bottom: 5px;
    }

    /* 캘린더 표 스타일 */
    .cal-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        background-color: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .cal-th {
        text-align: center;
        padding: 6px 0;
        font-size: 12px;
        font-weight: bold;
        background-color: #f8f9fa;
    }
    .cal-td {
        height: 55px;
        vertical-align: top;
        border: 1px solid #f0f0f0;
        padding: 3px;
    }
    .cal-day-num {
        font-size: 11px;
        font-weight: bold;
        color: #333;
    }
    .cal-plan-badge {
        font-size: 7px;
        background-color: #e3f2fd;
        color: #1e3c72;
        padding: 1px 2px;
        border-radius: 3px;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* 📱 하단 고정 네비게이션바 강제 가로 한 줄 정렬 */
    .fixed-nav-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100vw;
        height: 65px;
        background-color: #ffffff;
        border-top: 1px solid #e0e0e0;
        display: flex;
        flex-direction: row !important;
        justify-content: space-around;
        align-items: center;
        z-index: 999999;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        padding: 0 5px;
        box-sizing: border-box;
    }
    </style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

# ==========================================
# 세션 상태 안전 초기화 (절대 초기화되지 않도록 방어)
# ==========================================
if "started" not in st.session_state:
    st.session_state.started = False

if "user_level" not in st.session_state:
    st.session_state.user_level = "선수부"

if "match_type" not in st.session_state:
    st.session_state.match_type = "복식"

if "selected_date" not in st.session_state:
    st.session_state.selected_date = str(datetime.date.today())

if "monthly_calendar_plans" not in st.session_state:
    st.session_state.monthly_calendar_plans = {}

if "training_history" not in st.session_state:
    st.session_state.training_history = []

if "active_tab" not in st.session_state:
    st.session_state.active_tab = "달력"

if "cond_score" not in st.session_state:
    st.session_state.cond_score = 6

if "hard_score" not in st.session_state:
    st.session_state.hard_score = 6


# ==========================================
# 🏠 1. 첫 시작 화면 (실력 및 종목 선택)
# ==========================================
if not st.session_state.started:
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("<div class='main-title'>🏸 배드민턴 훈련 & 컨디션 관리</div>", unsafe_allow_html=True)
    st.write("내 실력과 주력 종목을 선택하고 바로 시작하세요!")
    
    st.markdown("---")
    st.markdown("**1. 내 실력 선택**")
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("초보용", use_container_width=True):
            st.session_state.user_level = "초보용"
    with col2:
        if st.button("일반부", use_container_width=True):
            st.session_state.user_level = "일반부"
    with col3:
        if st.button("선수부", type="primary" if st.session_state.user_level=="선수부" else "secondary", use_container_width=True):
            st.session_state.user_level = "선수부"

    st.markdown(f"선택된 실력: **{st.session_state.user_level}**")

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("**2. 주력 종목 선택**")
    col4, col5 = st.columns(2)
    with col4:
        if st.button("복식", type="primary" if st.session_state.match_type=="복식" else "secondary", use_container_width=True):
            st.session_state.match_type = "복식"
    with col5:
        if st.button("단식", type="primary" if st.session_state.match_type=="단식" else "secondary", use_container_width=True):
            st.session_state.match_type = "단식"
            
    st.markdown(f"선택된 종목: **{st.session_state.match_type}**")

    st.markdown("---")
    if st.button("🚀 이대로 시작하기", type="primary", use_container_width=True):
        st.session_state.started = True
        st.rerun()


# ==========================================
# 🏆 2. 메인 앱 화면 (튕김 없는 세션 기반 탭 관리)
# ==========================================
else:
    top_c1, top_c2, top_c3 = st.columns([1.5, 1.5, 1])
    with top_c1:
        st.session_state.user_level = st.selectbox("실력", ["초보용", "일반부", "선수부"], index=["초보용", "일반부", "선수부"].index(st.session_state.user_level), label_visibility="collapsed")
    with top_c2:
        st.session_state.match_type = st.selectbox("종목", ["복식", "단식"], index=["복식", "단식"].index(st.session_state.match_type), label_visibility="collapsed")
    with top_c3:
        if st.button("처음으로", use_container_width=True):
            st.session_state.started = False
            st.rerun()

    st.markdown("---")

    # ------------------------------------------
    # [탭 1] 달력 화면
    # ------------------------------------------
    if st.session_state.active_tab == "달력":
        st.markdown("### 🗓️ 월간 훈련 캘린더")
        
        now = datetime.datetime.now()
        cal_temp = calendar.Calendar(firstweekday=6)
        cal_dates_list = []
        for d in cal_temp.itermonthdates(now.year, now.month):
            if d.month == now.month:
                cal_dates_list.append(str(d))

        selected_date_box = st.selectbox(
            "📅 날짜 선택하기", 
            cal_dates_list, 
            index=cal_dates_list.index(st.session_state.selected_date) if st.session_state.selected_date in cal_dates_list else 0
        )
        if selected_date_box != st.session_state.selected_date:
            st.session_state.selected_date = selected_date_box
            st.rerun()

        # 달력 표 그리기
        cal_html = "<table class='cal-table'><thead><tr>"
        weekdays_kr = ["일", "월", "화", "수", "목", "금", "토"]
        for i, w_name in enumerate(weekdays_kr):
            color = "red" if i == 0 else ("blue" if i == 6 else "black")
            cal_html += f"<th class='cal-th' style='color:{color};'>{w_name}</th>"
        cal_html += "</tr></thead><tbody>"

        month_weeks = cal_temp.monthdayscalendar(now.year, now.month)
        for week in month_weeks:
            cal_html += "<tr>"
            for day in week:
                if day == 0:
                    cal_html += "<td class='cal-td' style='background-color:#fafafa;'></td>"
                else:
                    d_str = f"{now.year}-{now.month:02d}-{day:02d}"
                    is_selected = (d_str == st.session_state.selected_date)
                    bg_style = "background-color: #e8f4fd; border: 2px solid #1e3c72;" if is_selected else ""
                    
                    day_plans = st.session_state.monthly_calendar_plans.get(d_str, [])
                    plan_txt = f"🏸 {day_plans[0]}" if day_plans else ""
                    
                    cal_html += f"<td class='cal-td' style='{bg_style}'>"
                    cal_html += f"<div class='cal-day-num'>{day}</div>"
                    if plan_txt:
                        cal_html += f"<div class='cal-plan-badge'>{plan_txt}</div>"
                    cal_html += "</td>"
            cal_html += "</tr>"
        cal_html += "</tbody></table>"

        st.markdown(cal_html, unsafe_allow_html=True)
        st.markdown("<br>", unsafe_allow_html=True)

        sel_date = st.session_state.selected_date
        st.markdown(f"**📌 [{sel_date}] 훈련 일정 계획**")
        
        cur_plans = st.session_state.monthly_calendar_
