"""v1.30 라이브 점검 — 배포된 앱에서 점수판·타이머를 실제로 눌러 봅니다 (390×844).
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v130.py
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
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.30.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.30.0', 'bm-v1.30.0' in sw, sw[:60])
    app = page.request.get(BASE + 'app.js?x=1').text()
    logjs = page.request.get(BASE + 'js/views/log.js?x=1').text()
    sbjs = page.request.get(BASE + 'js/scoreboard.js?x=1').text()
    tjs = page.request.get(BASE + 'js/timer.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    check('라이브 app.js = v1.30.0', "version: 'v1.30.0'" in app, app[:40])
    check('라이브 scoreboard.js', 'BM.scoreboard' in sbjs and 'nextSet' in sbjs)
    check('라이브 timer.js', 'BM.timer' in tjs and 'data-timer-start' in tjs)
    check('라이브 log.js = 점수판·타이머', 'open-scoreboard' in logjs and 'timerWidget' in logjs)
    check('라이브 styles.css = 점수판·타이머 스타일', '.sb__board' in css and '.dtimer__btn' in css)

    page.goto(BASE + '?live=130', wait_until='load')
    page.wait_for_timeout(2500)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(3):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(500)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.30.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    # 일지 탭 → + 코트 점수판
    page.goto(BASE + '#/log', wait_until='load')
    page.wait_for_timeout(1800)
    if not page.query_selector('[data-act="open-scoreboard"]'):
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1200)
    btn = page.query_selector('[data-act="open-scoreboard"]')
    check('일지 첫머리 + 코트 점수판', btn is not None)
    check('버튼 글자', '코트 점수판' in (btn.inner_text() if btn else ''),
          (btn.inner_text() if btn else '').replace('\n', ' | '))
    page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.30.0_일지입구.png')

    btn.click()
    page.wait_for_timeout(900)
    check('점수판 시트', page.query_selector('#sheet [data-sb]') is not None)
    check('+1 버튼 2개', len(page.query_selector_all('#sheet [data-sb-point]')) == 2)

    for _ in range(3):
        page.click('#sheet [data-sb-point="a"]')
        page.wait_for_timeout(140)
    nums = page.evaluate("""() => Array.from(document.querySelectorAll('#sheet .sb__num')).map(n => n.textContent).join(':')""")
    check('내 팀 +1 세 번 = 3:0', nums == '3:0', nums)
    page.click('#sheet [data-sb-undo]')
    page.wait_for_timeout(250)
    nums = page.evaluate("""() => Array.from(document.querySelectorAll('#sheet .sb__num')).map(n => n.textContent).join(':')""")
    check('되돌리기 = 2:0', nums == '2:0', nums)

    page.click('#sheet [data-sb-mode-val="25"]')
    page.wait_for_timeout(300)
    state_txt = page.locator('#sheet .sb__state').inner_text()
    check('25점제 안내', '25점제' in state_txt, state_txt)
    page.click('#sheet [data-sb-type-val="단식"]')
    page.wait_for_timeout(300)
    labels = page.locator('#sheet .sb__add').inner_text().replace('\n', ' ')
    check('단식 = 나/상대', '나' in labels and '상대' in labels, labels)
    page.click('#sheet [data-sb-mode-val="21"]')
    page.wait_for_timeout(250)
    page.click('#sheet [data-sb-type-val="복식"]')
    page.wait_for_timeout(250)

    # 21:17까지 (2:0에서 시작, 번갈아 눌러 세트가 먼저 끝나지 않게)
    a, bb = 2, 0
    while a < 21 or bb < 17:
        if a < 21 and (a <= bb or bb >= 17):
            page.click('#sheet [data-sb-point="a"]')
            a += 1
        else:
            page.click('#sheet [data-sb-point="b"]')
            bb += 1
    page.wait_for_timeout(500)
    state_txt = page.locator('#sheet .sb__state').inner_text()
    check('21:17 세트 종료', '세트 종료' in state_txt and '승' in state_txt, state_txt)
    check('다음 세트 버튼', page.query_selector('#sheet [data-sb-next]') is not None)
    check('오늘 일지에 넣기', page.query_selector('#sheet [data-sb-save]') is not None)
    page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.30.0_점수판세트종료.png')

    page.click('#sheet [data-sb-save]')
    page.wait_for_timeout(1200)
    check('시트 닫힘', page.query_selector('#sheet') is None)
    draft = page.evaluate("() => JSON.parse(JSON.stringify(BM.app.ctx.store.state.drafts.log))")
    check('초안 게임 = 21:17', draft.get('games') == [{'a': 21, 'b': 17}], draft.get('games'))
    check('초안 결과 = 승', draft.get('result') == '승', draft.get('result'))
    check('초안 메모', '코트 점수판' in (draft.get('note') or ''), draft.get('note'))
    vals = page.evaluate("""() => {
        const a = document.querySelector('[data-field="gameA"]');
        const b = document.querySelector('[data-field="gameB"]');
        const n = document.querySelector('[data-field="note"]');
        return { score: a && b ? a.value + ':' + b.value : '', note: n ? n.value : '' };
    }""")
    check('폼에 21:17', vals.get('score') == '21:17', vals)
    check('폼에 메모', '코트 점수판' in vals.get('note', ''), vals.get('note'))
    page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.30.0_일지자동채움.png')

    # 저장 → 기록에 남는지
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(1800)
    row = page.evaluate("""() => {
        const C = BM.domain.COL, rows = BM.app.ctx.store.state.rows;
        const mine = rows.filter(r => r[C['유형']] === '기록' && String(r[C['소셜글']] || '').includes('코트 점수판'));
        const r = mine[mine.length - 1] || [];
        return { score: r[C['게임점수']], result: r[C['승패']], done: r[C['완료훈련']], len: r.length };
    }""")
    check('저장된 게임점수 21:17', row.get('score') == '21:17', row)
    check('저장된 승패', row.get('result') == '승', row)
    check('26칸 그대로', row.get('len') == 26, row.get('len'))
    check('AI 카드', page.query_selector('[data-region="analysis"]') is not None)

    # 드릴 타이머
    page.wait_for_timeout(600)
    total = len(page.query_selector_all('[data-timer-start]'))
    check('타이머 버튼 14개', total == 14, total)
    start = page.query_selector_all('[data-timer-start]')[0] if total else None
    if start:
        start.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        start.click()
        page.wait_for_timeout(1400)
        clock = page.locator('[data-timer-display]').first.inner_text()
        check('카운트다운', clock.startswith('02:5'), clock)
        page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.30.0_드릴타이머.png')
        check('일시정지 버튼', page.query_selector('[data-timer-toggle]') is not None)
        page.click('[data-timer-toggle]')
        page.wait_for_timeout(350)
        check('일시정지 동작', page.evaluate("() => (BM.timer.state() || {}).running") is False)
        page.click('[data-timer-reset]')
        page.wait_for_timeout(350)
        check('초기화', page.evaluate("() => BM.timer.state()") is None)
        check('초기화 뒤 3분 버튼', len(page.query_selector_all('[data-timer-start]')) == 14)

    print('CONSOLE ERRORS', errs if errs else 'none')
    print('REQ FAILED', fails if fails else 'none')
    b.close()

bad = [c for c in checks if not c[1]]
print('SUMMARY', str(len(checks) - len(bad)) + '/' + str(len(checks)))
sys.exit(1 if bad or errs or fails else 0)
