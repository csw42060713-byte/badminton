"""초보 · 코치 유형의 일지 첫 화면 확인 (라이브 · 체험 모드, 이 기기 저장)."""
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    errs = []
    page.on('console', lambda m: errs.append(m.text[:120]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:160]))
    page.goto(BASE, wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.click('[data-act="guest"]')
    page.wait_for_timeout(2400)
    for _ in range(5):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1500)
            except Exception:
                pass
            page.wait_for_timeout(250)

    def role(id_):
        page.click('[data-tab="my"]')
        page.wait_for_timeout(900)
        page.click('[data-role="%s"]' % id_)
        page.wait_for_timeout(1000)
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1100)

    role('beginner')
    routine = page.query_selector('[data-region="routine"]')
    beginner_card = page.query_selector('[data-region="beginner"]')
    print('초보: 4주 루틴 카드', bool(routine), '/ 용어사전 카드', bool(beginner_card),
          '/ 7대 훈련', len(page.query_selector_all('[data-pro-toggle]')))
    page.screenshot(path=OUT + '/v140_role_beginner.png')

    role('coach')
    hint = page.query_selector('[data-region="rolehint"]')
    print('코치: 안내 카드', bool(hint), '/ 7대 훈련', len(page.query_selector_all('[data-pro-toggle]')))
    page.screenshot(path=OUT + '/v140_role_coach.png')

    print('오류', len(errs), errs[:4])
    b.close()
