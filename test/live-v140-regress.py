"""라이브 회귀 확인 — 게스트 모집(본문 없이) · 하단 고정 저장 바 · 스플래시/로고 (체험 모드)."""
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks = []
errs = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append(m.text[:120]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror ' + str(e)[:160]))
    page.goto(BASE, wait_until='domcontentloaded')
    page.wait_for_timeout(120)
    splash = page.evaluate("() => { const s = document.getElementById('splash'); return s ? !s.classList.contains('is-off') : false; }")
    logo = page.evaluate("() => { const i = document.querySelector('.splash__logo'); return i ? i.getAttribute('src') : ''; }")
    check('스플래시·로고', splash and 'icon-512' in logo, logo)
    page.screenshot(path=OUT + '/v140_splash.png')
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

    # 하단 고정 저장 바
    bar = page.evaluate("""() => { const el = document.querySelector('.savebar');
      if (!el) return null; const r = el.getBoundingClientRect();
      return {bottom: Math.round(r.bottom), h: Math.round(r.height), fixed: getComputedStyle(el).position}; }""")
    check('일지 하단 고정 저장 바', bar and bar['fixed'] in ('sticky', 'fixed'), bar)

    # 게스트 모집: 본문 없이 모집 칸만
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(400)
    ph = page.get_attribute('[data-composer]', 'placeholder')
    check('게스트 모집 안내 문구', ph == '게스트 모집 한마디 (비워 두어도 올라가요)', ph)
    page.fill('[data-vitefield="when"]', '11/22(토) 09:00')
    page.fill('[data-vitefield="cap"]', '4')
    page.fill('[data-vitefield="place"]', '수원체육관')
    before = page.evaluate("() => document.querySelectorAll('[data-region=\"posts\"] article.post').length")
    page.click('[data-act="post"]')
    page.wait_for_timeout(900)
    toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    after = page.evaluate("() => document.querySelectorAll('[data-region=\"posts\"] article.post').length")
    check('본문 없이 모집 글 등록', after == before + 1 and toast == '게스트 모집을 올렸어요', (toast, before, after))
    page.screenshot(path=OUT + '/v140_community_meet.png')

    print('오류', len(errs), errs[:4])
    okn = sum(1 for _, c in checks if c)
    print('%d/%d 통과' % (okn, len(checks)))
    b.close()
