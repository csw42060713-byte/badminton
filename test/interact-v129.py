"""v1.29 매너 태그 — 실제 저장소·이벤트까지 돌려 보는 점검 (로컬, 390×844)
   python3 test/interact-v129.py
"""
import functools
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP)
httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
port = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errs, checks = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR')
        page = ctx.new_page()
        page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        page.goto(f'http://127.0.0.1:{port}/test/v129-preview.html?view=interact', wait_until='load')
        page.wait_for_timeout(800)
        check('점검 화면 준비', page.evaluate('!!window.__store'))
        check('칩 4개', page.locator('[data-manner-tag]').count() == 4, page.locator('[data-manner-tag]').count())

        before = page.evaluate("window.__store.state.rows.filter(r => r[1] === '매너').length")
        page.click('[data-manner-tag="care"]')
        page.wait_for_timeout(700)
        after = page.evaluate("window.__store.state.rows.filter(r => r[1] === '매너').length")
        check('누르면 매너 행 1개 저장', before == 0 and after == 1, f'{before} → {after}')
        row = page.evaluate("""() => {
            const r = window.__store.state.rows.filter(x => x[1] === '매너')[0] || [];
            const C = BM.domain.COL;
            return { type: r[C['유형']], target: r[C['대상']], team: r[C['팀']], likes: r[C['좋아요']], len: r.length };
        }""")
        check('행 모양 (유형·대상·팀·좋아요·26칸)',
              row.get('type') == '매너' and row.get('target') == 'demo_net' and row.get('team') == 'care'
              and row.get('likes') == '1' and row.get('len') == 26, row)
        check('화면이 남긴 상태로 바뀜', page.locator('.manner--done').count() == 1)
        check('칩은 사라짐', page.locator('[data-manner-tag]').count() == 0)
        check('토스트 안내', '매너' in (page.locator('#toast').inner_text() if page.locator('#toast').count() else ''),
              page.locator('#toast').inner_text() if page.locator('#toast').count() else '')
        done_txt = page.locator('.manner--done').inner_text()
        check('남긴 태그 문구', '배려 넘침' in done_txt and '네트앞여우' in done_txt, done_txt)
        page.screenshot(path=os.path.join(OUT, '배드민턴_매너한줄태그_bm-v1.29.0_누른뒤.png'))

        # 하루 1회 — 같은 방에서 다시 남길 수 없음(칩이 없음).
        # 연타 잠금(1.5초)이 풀린 뒤에 불러야 '하루 1회' 규칙을 확인할 수 있습니다.
        page.wait_for_timeout(1700)
        again = page.evaluate("""() => {
            const r = window.__store.actions.giveManner('demo_net', 'good');
            return r;
        }""")
        check('같은 날 두 번째는 막힘', again.get('reason') == 'daily', again)
        b.close()
finally:
    httpd.shutdown()

print('CONSOLE ERRORS', errs if errs else 'none')

# 두 번째 점검 — 정원이 찬 번개 글에서 '대기 문의' 누름
httpd2 = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=APP))
port2 = httpd2.server_address[1]
threading.Thread(target=httpd2.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=EXE)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR')
        page = ctx.new_page()
        page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        page.goto(f'http://127.0.0.1:{port2}/test/v129-preview.html?view=interact-meet', wait_until='load')
        page.wait_for_timeout(800)
        card = page.locator('[data-vite-group="930000000000001"]')
        check('남의 번개 버튼 = 대기 문의', '대기 문의' in card.inner_text(), card.inner_text())
        card.click()
        page.wait_for_timeout(700)
        draft = page.evaluate('window.__store.state.ui.chatDraft')
        check('대기 문구가 채워짐', '대기하고 싶어요' in draft, draft)
        check('방은 그 글의 단체방', page.evaluate('window.__store.state.ui.chatRoom') == '930000000000001',
              page.evaluate('window.__store.state.ui.chatRoom'))
        page.screenshot(path=os.path.join(OUT, '배드민턴_모집정원_bm-v1.29.0_대기문의.png'))
        b.close()
finally:
    httpd2.shutdown()

print('CONSOLE ERRORS(2)', errs if errs else 'none')
bad = [c for c in checks if not c[1]]
print('SUMMARY', f'{len(checks) - len(bad)}/{len(checks)}')
