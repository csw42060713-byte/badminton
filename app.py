import streamlit as st
import datetime
import pandas as pd
import calendar

# 1. 모바일 최적화 디자인 설정
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
        padding-top: 1rem;
        padding-bottom: 3rem;
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
    
    .main-title {
        font-size: 20px;
        font-weight: bold;
        color: #1e3c72;
        text-align: center;
        margin-bottom: 10px;
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
        padding: 8px 0;
        font-size: 13px;
        font-weight: bold;
        background-color: #f8f9fa;
    }
    .cal-td {
        height: 60px;
        vertical-align: top;
        border: 1px solid #f0f0f0;
        padding: 4px;
    }
    .cal-day-num {
        font-size: 12px;
        font-weight: bold;
        color: #333;
    }
    .cal-plan-badge {
        font-size: 8px;
        background-color: #e3f2fd;
        color: #1e3c72;
        padding: 1px 2px;
        border-radius: 3px;
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    </style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

# 세션 상태 초기화
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


# ==========================================
# 🏠 1. 첫 시작 화면 (레벨 & 종목 고르기)
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
            st.session_state.started = True
            st.rerun()
    with col2:
        if st.button("일반부", use_container_width=True):
            st.session_state.user_level = "일반부"
            st.session_state.started = True
            st.rerun()
    with col3:
        if st.button("선수부", type="primary", use_container_width=True):
            st.session_state.user_level = "선수부"
            st.session_state.started = True
            st.rerun()

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("**2. 주력 종목 선택**")
    col4, col5 = st.columns(2)
    with col4:
        if st.button("복식", use_container_width=True):
            st.session_state.match_type = "복식"
    with col5:
        if st.button("단식", use_container_width=True):
            st.session_state.match_type = "단식"
            
    st.markdown("---")
    if st.button("🚀 이대로 시작하기", type="primary", use_container_width=True):
        st.session_state.started = True
        st.rerun()


# ==========================================
# 🏆 2. 메인 앱 화면
# ==========================================
else:
    # 상단 빠른 설정 바
    top_c1, top_c2, top_c3 = st.columns([1.5, 1.5, 1])
    with top_c1:
        st.session_state.user_level = st.selectbox("실력", ["초보용", "일반부", "선수부"], index=["초보용", "일반부", "선수부"].index(st.session_state.user_level))
    with top_c2:
        st.session_state.match_type = st.selectbox("종목", ["복식", "단식"], index=["복식", "단식"].index(st.session_state.match_type))
    with top_c3:
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("처음으로"):
            st.session_state.started = False
            st.rerun()

    st.markdown("---")

    st.markdown("### 🗓️ 1. 이번 달 훈련 달력")
    st.write("날짜를 고르고 아래에서 오늘 할 운동을 체크하세요.")

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

    # 선택된 날짜 일정 입력 칸
    sel_date = st.session_state.selected_date
    st.markdown(f"**📌 [{sel_date}] 훈련 일정 짜기**")
    
    cur_plans = st.session_state.monthly_calendar_plans.get(sel_date, [])
    exercise_list = ["스트록", "벽치기", "런닝(인터벌)", "코어(복근/허리)", "근력(웨이트)"]
    
    updated_plans = st.multiselect(
        "오늘 할 운동 선택",
        exercise_list,
        default=cur_plans,
        key=f"m_plans_{sel_date}"
    )
    
    memo_key = f"memo_{sel_date}"
    if memo_key not in st.session_state:
        st.session_state[memo_key] = ""
        
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        if st.button("💾 일정 저장", use_container_width=True, type="primary"):
            if updated_plans:
                st.session_state.monthly_calendar_plans[sel_date] = updated_plans
                st.success("저장 완료!")
                st.rerun()
            else:
                st.warning("운동을 최소 한 개 이상 선택해주세요.")
    with col_btn2:
        if st.button("🗑️ 일정 지우기", use_container_width=True):
            st.session_state.monthly_calendar_plans.pop(sel_date, None)
            st.success("삭제 완료!")
            st.rerun()

    st.markdown("---")

    # ==========================================
    # 📝 2. 오늘 운동 완료 및 논문 기반 맞춤 처방
    # ==========================================
    st.markdown("### 📝 2. 오늘 운동 완료 및 기록")
    
    col_c1, col_c2 = st.columns(2)
    with col_c1:
        condition = st.slider("오늘 내 몸 컨디션 (1점 ~ 10점)", 1, 10, 7)
    with col_c2:
        hard_score = st.slider("운동 얼마나 힘들었나? (1점 ~ 10점)", 1, 10, 6)

    total_time = st.slider("총 운동 시간 (분)", 30, 240, 90, 10)
    
    # 💡 사용자가 자유롭게 적는 소감 및 아픈 부위 칸
    user_review = st.text_area(
        "💬 오늘 운동 소감 및 아픈 부위 적기 (예: 어깨가 뻐근해, 스매시 타점이 밀림, 발목 삐끗 등)", 
        placeholder="여기에 적어주시면 스포츠 의학 논문 기반 맞춤 스트레칭과 처방을 바로 알려드려요!"
    )

    if st.button("🔥 오늘 운동 저장하고 맞춤 처방 받기", type="primary", use_container_width=True):
        score = int((condition * 5) + ( (11 - hard_score) * 5 ))
        if score > 80:
            feedback = "오늘 컨디션도 좋고 훈련 소화도 완벽했어요! 꿀잠 자고 내일도 화이팅! 🏆"
        elif score > 60:
            feedback = "꾸준히 아주 잘하고 있습니다! 이 페이스 그대로 유지해봐요 🏸"
        else:
            feedback = "오늘은 몸이 좀 뻐근했겠네요. 무리하지 말고 따뜻한 물로 샤워 후 푹 쉬세요! 🛌"

        st.success(f"저장 완료! (오늘의 점수: {score}점)")
        st.info(f"💡 **종합 평가:** {feedback}")
        
        # 🔬 논문 기반 맞춤 처방 실시간 분석 출력
        if user_review.strip():
            st.markdown("---")
            st.markdown("### 🩺 [논문 기반 실전 맞춤 처방전]")
            
            review_lower = user_review.lower()
            
            if any(k in review_lower for k in ["어깨", "팔 위", "스매시", "클리어", "회전"]):
                st.warning("⚠️ **[어깨/회전근개 보호 처방]**\n\n"
                           "• **왜 아플까?:** 오버헤드 스트록 시 상완 회전근개가 과도하게 늘어나거나 충돌이 발생해 염증이 생기기 쉽습니다.\n"
                           "• **추천 스트레칭 (슬리퍼 스트레칭):** 옆으로 누워 아래쪽 팔을 앞으로 뻗은 뒤, 다른 손으로 손목을 바닥 쪽으로 지긋이 눌러 어깨 뒤쪽 관절낭을 풀어주세요.\n"
                           "• **보강 운동:** 가벼운 고무 밴드를 이용한 **'밴드 외회전 운동'**으로 어깨 안정성을 높여주세요.")
            elif any(k in review_lower for k in ["팔꿈치", "엘보", "팔뚝", "손목", "스냅"]):
                st.warning("⚠️ **[팔꿈치/전완근 보호 처방]**\n\n"
                           "• **왜 아플까?:** 셔틀콕 타구 시 과도한 손목 스냅이나 라켓 무게로 인해 팔꿈치 관절 주변 힘줄에 미세 부하가 누적되었습니다.\n"
                           "• **추천 스트레칭:** 팔을 앞으로 쭉 펴고 손바닥이 앞을 보게 한 뒤 손가락을 몸 쪽으로 당겨 전완근을 이완시켜 주세요.\n"
                           "• **보강 운동:** 가벼운 물병이나 아령을 들고 손목을 위아래로 움직이는 **'리스트 컬'**을 가볍게 수행하세요.")
            elif any(k in review_lower for k in ["발목", "무릎", "착지", "점프", "스텝", "하체", "런지"]):
                st.warning("⚠️ **[하지 관절/급정거 보호 처방]**\n\n"
                           "• **왜 아플까?:** 코트 위 급격한 방향 전환과 점프 착지 시 하체 관절에 체중의 수 배에 달하는 충격이 가해졌습니다.\n"
                           "• **추천 스트레칭:** 벽을 짚고 한 발을 뒤로 빼 뒤꿈치를 바닥에 완전히 붙인 채 종아리와 아킬레스건을 15초간 늘려주세요.\n"
                           "• **보강 운동:** 가동성과 안정성을 높이는 **'스쿼트 및 런지'**로 하체 근육을 단단하게 잡아주세요.")
            elif any(k in review_lower for k in ["멘탈", "생각", "긴장", "범실", "실수", "당황", "불안"]):
                st.info("🧠 **[스포츠 심리학 멘탈 케어 처방]**\n\n"
                        "• **원인 분석:** 경기 중 연속 실책이나 압박감으로 인해 자율신경계가 과도하게 각성되어 신체가 경직되었습니다.\n"
                        "• **처방 (4-7-8 호흡법):** 코로 4초간 숨을 깊이 들이마시고, 7초간 멈춘 뒤, 입으로 8초간 천천히 내쉬며 심박수를 낮추세요. '지난 실점에 얽매이지 않는 주의 집중 전환' 루틴을 적용해보세요!")
            else:
                st.success("✨ **[일반 스포츠 과학 맞춤 조언]**\n\n"
                           "• 남겨주신 소감을 보니 오늘 훈련에 대한 몰입도가 훌륭합니다!\n"
                           "• 훈련 후에는 반드시 10분간 전신 쿨다운 스트레칭을 병행하여 젖산을 분해하고 다음 날 피로를 예방하세요.")

        # 기록 저장
        st.session_state.training_history.append({
            "날짜": sel_date,
            "컨디션": condition,
            "운동강도": hard_score,
            "시간(분)": total_time,
            "점수": score,
            "소감": user_review
        })

    # ==========================================
    # 📊 3. 내 운동 기록 모아보기
    # ==========================================
    if len(st.session_state.training_history) > 0:
        st.markdown("---")
        st.markdown("### 📊 3. 내 지난 기록 모아보기")
        df_log = pd.DataFrame(st.session_state.training_history)
        st.dataframe(df_log, use_container_width=True)
