import streamlit as st
import datetime
import pandas as pd

st.set_page_config(page_title="배드민턴 정밀 훈련 시스템", page_icon="🏸", layout="wide")

# ==========================================
# 🎨 저작권 걱정 없는 코딩 배경 (이미지 파일 불필요)
# ==========================================
# 앱 전체에 스포티한 다크 모드 그라데이션 적용 (CSS)
bg_css = """
<style>
/* 전체 앱 배경 설정: 깊고 스포티한 네이비 다크 그라데이션 */
.stApp {
    background: linear-gradient(135deg, #101820 0%, #1a2533 45%, #2c3e50 100%);
    color: #e0e6ed;
}

/* 메인 콘텐츠 영역 배경 투명화 및 그림자 */
.block-container {
    background-color: rgba(30, 41, 59, 0.6); /* 투명한 네이비 슬레이트 */
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

/* 시작 화면 전용 스타일 */
.start-screen {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    height: 70vh;
}

/* 타이틀 글씨 스타일 개선 (네온 효과 살짝) */
h1#t-title {
    color: #00ff88; /* 셔틀콕 녹색 */
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.6);
    margin-bottom: 0.5rem;
}
