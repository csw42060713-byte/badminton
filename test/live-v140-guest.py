"""bm-v1.40.0 라이브 오류 점검 — 체험 모드(둘러보기)로 5개 탭 + 유형 카드 화면.

 · 아무 로그인도 하지 않으므로 Supabase에 아무것도 쓰지 않습니다(체험 모드는 이 기기 저장).
 · 차단 없이 실행해 '앱 자체 콘솔·페이지 오류 0건'을 확인합니다.
"""
import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

errs = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:160]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    cb = str(int(time.time()))
    page.goto(BASE + 'index.html?g=' + cb, wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2500)
    for _ in range(6):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1500)
            except Exception:
                pass
            page.wait_for_timeout(250)

    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(900)
        info = page.evaluate("() => ({overflowX: document.documentElement.scrollWidth > innerWidth + 1, w: document.documentElement.scrollWidth})")
        print(('%s 탭: 오류 %d · 넘침 %s' % (label, len(errs) - before, info['overflowX'])))
        page.screenshot(path='%s/v140_guest_%s.png' % (OUT, key))

    # 체험 모드 MY: 유형 카드에서 선수로 바꾸면 일지에 7대 훈련이 뜨는지 (이 기기 저장)
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    page.click('[data-role="player"]')
    page.wait_for_timeout(1000)
    page.click('[data-tab="log"]')
    page.wait_for_timeout(1000)
    n = len(page.query_selector_all('[data-pro-toggle]'))
    print('체험 모드에서 선수로 바꾸면 7대 훈련 줄:', n)
    page.screenshot(path=OUT + '/v140_guest_player.png')

    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    page.evaluate("() => document.querySelector('[data-region=\"role\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v140_guest_my_role.png')

    print('\n== 콘솔·페이지 오류 ==', len(errs))
    for e in errs[:12]:
        print(' ', e)
    b.close()
