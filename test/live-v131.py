"""v1.31 라이브 점검 — 배포된 앱에서 주간 약점 3회 챌린지를 실제로 채워 봅니다 (390×844).
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v131.py
"""
import sys
import time
import os

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
errs, fails = [], []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    page.on('requestfailed', lambda r: fails.append(r.url[:120]))

    # 배포 반영 기다리기 (Pages 빌드)
    sw = ''
    for i in range(50):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.31.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.31.0', 'bm-v1.31.0' in sw, sw[:60])
    app = page.request.get(BASE + 'app.js?x=1').text()
    dom = page.request.get(BASE + 'js/domain.js?x=1').text()
    logjs = page.request.get(BASE + 'js/views/log.js?x=1').text()
    chatjs = page.request.get(BASE + 'js/views/chat.js?x=1').text()
    aijs = page.request.get(BASE + 'js/ai.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    check('라이브 app.js = v1.31.0', "version: 'v1.31.0'" in app, app[:40])
    check('라이브 domain.js = weekChallenge', 'weekChallenge' in dom and 'CHALLENGE_GOAL' in dom)
    check('라이브 log.js = 챌린지 카드', 'challengeBlock' in logjs and 'wkch__stamp' in logjs)
    check('라이브 chat.js = is-run', 'is-run' in chatjs)
    check('라이브 ai.js = 셔틀콕 연속 받기', '셔틀콕 연속 받기' in aijs and '멀티셔틀' not in aijs)
    check('라이브 styles.css = 챌린지 카드', '.card--wkch' in css and '.wkch__stamp.is-on' in css)
    check('라이브 styles.css = 프로필 라벨 한 줄', '.kv dt' in css and 'white-space: nowrap' in css)

    page.goto(BASE + '?live=131', wait_until='load')
    page.wait_for_timeout(2500)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(3):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(500)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.31.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    page.goto(BASE + '#/log', wait_until='load')
    page.wait_for_timeout(1800)
    if not page.query_selector('[data-act="open-scoreboard"]'):
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1200)
    check('일지 화면', page.query_selector('[data-form="log"]') is not None)
    check('처음에는 챌린지 카드 없음(일지 없음)', page.query_selector('[data-region="challenge"]') is None)

    def save_log(days_ago, weak, wait=1800):
        page.evaluate("""({n, weak}) => {
            const U = BM.util, A = BM.app.ctx.store.actions;
            A.setDraft({
              date: U.ymd(U.addDays(new Date(), -n)), cond: 7, intensity: 6, minutes: 60,
              done: ['스트록', '게임'], weakness: weak, pain: [], note: '',
              games: [{a: '21', b: '18'}], gameMode: 21
            });
        }""", {"n": days_ago, "weak": weak})
        page.wait_for_timeout(350)
        btn = page.query_selector('[data-act="save-log"]')
        if btn:
            btn.click()
        page.wait_for_timeout(wait)

    # 1일차 — 3일 전(이번 주 수) 헤어핀
    save_log(3, ['헤어핀'])
    toast1 = page.evaluate("() => (document.getElementById('toast') || {}).textContent || ''")
    check('첫 저장 토스트에 1/3 표시', '이번 주 헤어핀 1/3' in toast1, toast1)
    card = page.query_selector('[data-region="challenge"]')
    check('1회 저장 → 챌린지 카드', card is not None)
    text = card.inner_text().replace('\n', ' | ') if card else ''
    check('약점 자동 선택 = 헤어핀', '헤어핀' in text, text)
    check('1/3 표시', '1/3' in text, text)
    card.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/배드민턴_주간약점챌린지_bm-v1.31.0_1회.png')

    # 2일차 — 어제(이번 주 목) 헤어핀
    save_log(1, ['헤어핀'], wait=2600)
    text = (page.query_selector('[data-region="challenge"]') or page).inner_text().replace('\n', ' | ')
    check('2회 저장 → 2/3', '2/3' in text, text[:120])
    check('한 번만 더 채우면 완성 안내', '한 번만 더 채우면 완성' in text, text[:160])
    page.evaluate("""() => { const e = document.querySelector('[data-region="challenge"]'); if (e) e.scrollIntoView({block:'center'}); }""")
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/배드민턴_주간약점챌린지_bm-v1.31.0_2회.png')

    # 3일차 — 오늘 헤어핀 → 3/3 달성
    save_log(0, ['헤어핀'], wait=2600)
    toast = page.evaluate("() => (document.getElementById('toast') || {}).textContent || ''")
    check('달성 토스트', '3회 달성' in toast, toast)
    text = (page.query_selector('[data-region="challenge"]') or page).inner_text().replace('\n', ' | ')
    check('3/3 달성 배지', '3회 채웠어요' in text, text[:160])
    check('다음 주 교체 안내', '다음 주 월요일에 새 약점으로 바뀌어요' in text, text[:200])
    check('완료 카드 스타일', page.evaluate("""() => !!document.querySelector('.card--wkch.is-done')"""))
    check('채운 스탬프 3개', page.evaluate("""() => document.querySelectorAll('.wkch__stamp.is-on').length""") == 3,
          page.evaluate("""() => document.querySelectorAll('.wkch__stamp.is-on').length"""))
    page.evaluate("""() => { const e = document.querySelector('[data-region="challenge"]'); if (e) e.scrollIntoView({block:'center'}); }""")
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/배드민턴_주간약점챌린지_bm-v1.31.0_3회달성.png')

    # 저장된 기록이 26칸 그대로인지 (새 칸 없음)
    row = page.evaluate("""() => {
        const C = BM.domain.COL, rows = BM.app.ctx.store.state.rows;
        const mine = rows.filter(r => r[C['유형']] === '기록');
        const r = mine[mine.length - 1] || [];
        return { len: r.length, weak: r[C['약점기술']], date: r[C['날짜']] };
    }""")
    check('26칸 그대로', row.get('len') == 26, row)
    check('약점기술 저장', '헤어핀' in (row.get('weak') or ''), row.get('weak'))

    # 프로필 시트 — 내 프로필(친구·채팅 자리 없음)에서 표 라벨 정렬 확인
    page.goto(BASE + '#/my', wait_until='load')
    page.wait_for_timeout(1500)
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)

    print('CONSOLE ERRORS', errs if errs else 'none')
    print('REQ FAILED', fails if fails else 'none')
    b.close()

bad = [c for c in checks if not c[1]]
print('SUMMARY', str(len(checks) - len(bad)) + '/' + str(len(checks)))
sys.exit(1 if bad or errs or fails else 0)
