import streamlit as st
import datetime
import pandas as pd
import calendar

# 1. 페이지 설정 및 모바일 디자인 CSS 최적화 (아이콘을 배드민턴 라켓과 셔틀콕으로 변경 🏸)
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
        background: linear-gradient(135deg, #2b5876 0%, #4e4376 100%);
        color: white;
        padding: 15px;
        border-radius: 15px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        margin-bottom: 15px;
    }
    
    .cal-memo-text {
        font-size: 11px;
        color: #1e3c72;
        background-color: #eef2f5;
        border-radius: 4px;
        padding: 2px 4px;
        margin-top: 2px;
        word-break: break-all;
        line-height: 1.2;
    }
    </style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

# 0. 세션 상태 초기화
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

if "
