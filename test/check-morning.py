"""390×844 미리보기 점검 — 2026-11-25 아침 사용성 개선 (로컬 폴더만, push 없음)

확인
 A. 영수증 — 시간·점수 없는 일지(풋워크)에서 TOTAL이 비지 않고 훈련·컨디션이 채어진다
 B. 대회 인증 — 날짜 입력으로 지난 대회 날짜를 고를 수 있다
 C. 무릎 통증 — '무릎 쉬기' 아래에 육각 풋워크가 없고, 왜 바뀌었는지 한 줄이 보인다
 D. 저장 뒤 접힘 — 선수용 4개가 '심화 · 선수 루틴 더 보기' 하나로 묶인다
 E. 상세 리포트 — 접전 승률 -33%p에 보완 문구, 약점 없음 안내 띄어쓰기
 F. 영상 자세 비교 — 1·2구간 시간 구분 + 예시 전환 버튼 유지
 G. 콘솔/페이지 오류 0건

실행: python3 test/check-morning.py
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 8851
BASE = 'http://127.0.0.1:%d/' % PORT
OUT = '/workspace/downloads'
SHOTS = '/workspace/check-shots'
ERRORS = []
FAILS = []


def step(msg):
    print(msg, flush=True)


def check(name, ok, detail=''):
    print(('  PASS ' if ok else '  FAIL ') + name + (' — ' + str(detail) if detail else ''), flush=True)
    if not ok:
        FAILS.append(name + (' — ' + str(detail) if detail else ''))


handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
os.makedirs(OUT, exist_ok=True)
os.makedirs(SHOTS, exist_ok=True)


def seed_log(page, fields):
    page.evaluate("""(f) => {
      const st = BM.app.ctx.store.state;
      const d = st.drafts.log;
      d.date = f.date; d.minutes = f.minutes; d.cond = f.cond; d.intensity = f.intensity;
      d.games = f.games || [{ a: '', b: '' }]; d.done = f.done || [];
      d.pain = f.pain || []; d.weakness = f.weakness || []; d.note = f.note || '';
      d.partner = ''; d.rival = ''; d.score = null;
    }""", fields)
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(1500)


def card_shot(page, path):
    page.evaluate("() => { const b = document.querySelector('#sheet .sheet__body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(250)
    page.locator('#sheet .sc__canvas').screenshot(path=path)
    print('  saved', path, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    def route_external(route):
        url = route.request.url
        if url.startswith(BASE):
            return route.continue_()
        # 바깥 서비스(서버·지도·CDN)는 빈 응답으로 막아 콘솔 오류 없이 오프라인과 같게
        return route.fulfill(status=200, content_type='application/javascript', body='')

    ctx.route('**/*', route_external)
    page = ctx.new_page()
    page.on('console', lambda m: ERRORS.append('console.%s: %s' % (m.type, m.text))
            if m.type in ('error', 'assert') else None)
    page.on('pageerror', lambda e: ERRORS.append('pageerror: %s' % e))

    page.goto(BASE, wait_until='load')
    today = page.evaluate("() => BM.util.ymd()")

    def days_ago(n):
        y, m, d = [int(x) for x in today.split('-')]
        import datetime
        t = datetime.date(y, m, d) - datetime.timedelta(days=n)
        return t.isoformat()

    page.evaluate("""() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      const s = { kind: 'email', email: 'morning@example.com', name: '점검왕',
                  at: new Date().toISOString(), onboardedAt: '2026-11-25 08:00:00',
                  profile: { nick: '점검왕', level: 'B조', discipline: '복식', region: '서울',
                             club: '나래울체육관', onboardedAt: '2026-11-25 08:00:00' } };
      localStorage.setItem('bm_auth_v1', JSON.stringify(s));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(800)

    # ── A. 시간·점수 없는 일지 하나 (11/21 풋워크 상황 재현: 오늘 날짜, 시간·게임 없음)
    step('A) 영수증 — 시간·점수 없는 일지')
    seed_log(page, {'date': today, 'minutes': None, 'cond': 9, 'intensity': 4,
                    'games': [], 'done': ['풋워크'], 'note': ''})
    page.evaluate("() => { const m = el => document.querySelector(el); const a = m('[data-region=\"analysis\"]'); if (a) a.scrollIntoView(); }")
    page.wait_for_timeout(400)
    page.click('[data-share-entry="log-hero"]')
    page.wait_for_timeout(1300)
    page.click('#sheet [data-sc-design="receipt"]')
    page.wait_for_timeout(700)
    summary = page.locator('#sheet [data-sc-summary]').inner_text().strip()
    check('영수증 요약에 훈련 이름', '풋워크' in summary, summary)
    check('영수증 제목 선택됨', page.locator('#sheet [data-sc-design="receipt"]').get_attribute('aria-pressed') == 'true')
    card_shot(page, OUT + '/preview-morning-sharecard.png')
    page.screenshot(path=SHOTS + '/morning-sharecard-sheet.png')

    # ── B. 대회 인증 — 날짜 입력
    step('B) 대회 인증 — 지난 대회 날짜')
    page.click('#sheet [data-sc-mode="comp"]')
    page.wait_for_timeout(900)
    has_date = page.locator('#sheet input[type="date"][data-sc-field="date"]').count()
    check('날짜 입력 있음', has_date == 1, has_date)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.fill('#sheet [data-sc-field="event"]', 'B조 복식')
    page.fill('#sheet [data-sc-field="date"]', '2026-11-15')
    page.wait_for_timeout(700)
    check('날짜 값 유지', page.locator('#sheet [data-sc-field="date"]').input_value() == '2026-11-15',
          page.locator('#sheet [data-sc-field="date"]').input_value())
    check('앱 상태에도 반영', page.evaluate("() => BM.sharecard._state().date") == '2026-11-15',
          page.evaluate("() => BM.sharecard._state().date"))
    card_shot(page, OUT + '/preview-morning-compdate.png')
    page.screenshot(path=SHOTS + '/morning-comp-sheet.png')
    page.click('#sheet [data-sc-close], #sheet .sheet__head [data-close], #sheet [data-act="close-sheet"]')
    page.wait_for_timeout(600)

    # ── E-1. 리포트 — 약점이 아직 없을 때 안내 띄어쓰기
    step('E-1) 상세 리포트 — 약점 없음 안내')
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(800)
    page.click('[data-act="open-report"]')
    page.wait_for_timeout(1200)
    report_text = page.locator('#reportPanel').inner_text()
    check('약점 없음 안내 띄어쓰기', '채워져요. 일지의' in report_text.replace('\n', ' '),
          [s for s in report_text.replace('\n', ' ').split('.') if '채워져요' in s][:1])
    page.screenshot(path=SHOTS + '/morning-report-weak.png')
    page.click('#reportPanel .bgp__head [data-rpt-close]')
    page.wait_for_timeout(600)

    # ── C. 무릎 통증 일지
    step('C) 무릎 통증 — 드릴 교체')
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(800)
    seed_log(page, {'date': today, 'minutes': 50, 'cond': 7, 'intensity': 6,
                    'games': [], 'done': ['풋워크'], 'pain': ['무릎'], 'weakness': ['풋워크'], 'note': ''})
    page.wait_for_timeout(900)
    page.evaluate("() => { const a = document.querySelector('[data-region=\"analysis\"]'); if (a) a.scrollIntoView(); }")
    page.wait_for_timeout(600)
    swap = page.locator('[data-drill-swap]')
    check('이유 한 줄 있음', swap.count() == 1, swap.count())
    swap_text = swap.inner_text() if swap.count() else ''
    check('무릎 문구', '무릎' in swap_text, swap_text)
    drills = page.evaluate("""() => [...document.querySelectorAll('[data-region="analysis"] ol.drills--core li strong')]
        .map(n => n.textContent.trim())""")
    check('드릴 3개', len(drills) == 3, drills)
    bad = [d for d in drills if any(k in d for k in ('풋워크', '육각', '점프', '스텝', '런지'))]
    check('부담 큰 드릴 없음', not bad, bad)
    page.locator('[data-region="analysis"]').screenshot(path=SHOTS + '/morning-analysis.png')
    # 화면 캡처(첫 부분): 드릴 제목·안내·3개
    page.evaluate("() => { const n = document.querySelector('[data-drill-swap]'); if (n) { n.scrollIntoView({block: 'start'}); window.scrollBy(0, -110); } }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/preview-morning-log-drill.png')

    # ── D. 접힘 묶음
    step('D) 접힘 — 심화 · 선수 루틴 더 보기')
    pro = page.locator('[data-fold="pro"]')
    check('묶음 접기 있음', pro.count() == 1, pro.count())
    check('묶음 이름', pro.count() and '심화 · 선수 루틴 더 보기' in pro.first.inner_text(), pro.first.inner_text() if pro.count() else '')
    page.evaluate("() => { const n = document.querySelector('[data-fold=\"pro\"]'); if (n) n.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=SHOTS + '/morning-folds.png')
    top_folds = page.evaluate("""() => [...document.querySelectorAll('[data-region="analysis"] details.fold')]
        .filter(n => !n.parentElement.closest('details')).length""")
    check('첫 화면 접기 7개 이하', top_folds <= 7, top_folds)

    # ── F. 영상 자세 비교
    step('F) 영상 자세 비교 — 구간 시간·예시 전환')
    page.evaluate("() => { const b = document.querySelector('[data-act=\"open-pose\"]'); if (b) b.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(300)
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(900)
    page.click('[data-pose-demo="jump"]')
    page.wait_for_timeout(1200)
    times = page.evaluate("""() => [...document.querySelectorAll('.poseseg .poseseg__time')].map(n => n.textContent.trim())""")
    check('구간 시간 2개', len(times) == 2, times)
    check('시간이 겹치지 않음', len(set(times)) == len(times) and times[0] != times[1], times)
    check('2구간이 1.5초부터', times and times[1].startswith('1.5'), times)
    demo_buttons = page.evaluate("""() => [...document.querySelectorAll('[data-pose-demo]')].map(n => n.getAttribute('data-pose-demo'))""")
    check('예시 전환 버튼 유지', set(['', 'jump', 'duo']).issubset(set(demo_buttons)), demo_buttons)
    check('지금 예시 표시', page.locator('[data-pose-demo="jump"].is-on').count() == 1)
    page.screenshot(path=OUT + '/preview-morning-pose.png')
    page.locator('.bgp__head [data-pose-close]').first.click()
    page.wait_for_timeout(500)

    # ── E-2. 리포트 — 접전 승률 하락에 보완 문구
    step('E-2) 상세 리포트 — 접전 승률 -33%p')
    seed_log(page, {'date': days_ago(9), 'minutes': 60, 'cond': 7, 'intensity': 6,
                    'games': [{'a': 21, 'b': 19}], 'done': ['스트록'], 'pain': [], 'weakness': []})
    seed_log(page, {'date': days_ago(8), 'minutes': 60, 'cond': 7, 'intensity': 6,
                    'games': [{'a': 21, 'b': 18}], 'done': ['스트록'], 'pain': [], 'weakness': []})
    seed_log(page, {'date': today, 'minutes': 60, 'cond': 7, 'intensity': 6,
                    'games': [{'a': 21, 'b': 19}, {'a': 21, 'b': 18}, {'a': 19, 'b': 21}],
                    'done': ['풋워크'], 'pain': [], 'weakness': []})
    page.wait_for_timeout(600)
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(800)
    page.click('[data-act="open-report"]')
    page.wait_for_timeout(1400)
    body = page.locator('#reportPanel').inner_text().replace('\n', ' ')
    check('-33%p 표시', '-33' in body or '33%p' in body or '33포인트' in body,
          [s for s in body.split('.') if '접전' in s][:2])
    check('하락엔 보완 문구', '서브를 낮게' in body, [s for s in body.split('.') if '접전' in s][:2])
    check('모순 칭찬 없음', '지금처럼 마지막까지 집중하는 게 잘 되고 있어요' not in body)
    # 리포트 방향 줄이 보이게
    page.evaluate("""() => { const n = [...document.querySelectorAll('#reportPanel h3, #reportPanel p')]
        .find(x => (x.textContent || '').includes('다음 주')); if (n) n.scrollIntoView({block: 'center'}); }""")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/preview-morning-report.png')

    check('콘솔/페이지 오류 0건', not ERRORS, ERRORS[:5])

    browser.close()

print('\n결과: %s' % ('통과' if not FAILS else '실패 %d건' % len(FAILS)), flush=True)
for f in FAILS:
    print('  - ' + f, flush=True)
