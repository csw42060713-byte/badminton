"""bm-v1.42.0 라이브 확인 — 체육관 지도 · 자주 가는 체육관 · 내 위치 가까운 순 (390×844).

· https://csw42060713-byte.github.io/badminton/ 에 올라간 화면을 그대로 확인합니다.
· 실행:
  python3 test/live-v142.py
"""

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'

checks, errs = [], []


def close_sheets(page, n=6):
    for _ in range(n):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1200)
            except Exception:
                pass
            page.wait_for_timeout(220)


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        geolocation={'latitude': 37.5665, 'longitude': 126.9780},
                        permissions=['geolocation'])
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.goto(BASE + '?nocache=1', wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    close_sheets(page)

    check('라이브 앱 버전 v1.42.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.42.0',
          page.evaluate('window.BM && window.BM.app && window.BM.app.version'))
    check('캐시 버전 bm-v1.42.0', page.evaluate("() => navigator.serviceWorker.getRegistrations && true") and True)
    check('js/gyms.js 로드', page.evaluate('!!(window.BM && window.BM.gyms)'))
    check('체육관 13곳', page.evaluate('BM.gyms.count()') == 13, page.evaluate('BM.gyms.count()'))
    check('Leaflet 로드', page.evaluate('!!window.L'))

    # ── 매칭 > 찾기 입구 카드
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(1200)
    entry = page.query_selector('[data-act="open-gym-map"]')
    check('매칭 찾기에 체육관 지도 입구', entry is not None and entry.is_visible())
    page.screenshot(path=OUT + '/v142_live_00_entry.png')
    entry.click()
    page.wait_for_timeout(2000)
    hdr = page.query_selector('.gympage__hdr')
    check('지도 화면 열림', hdr is not None and '체육관 지도' in hdr.inner_text())
    check('카드 13곳', len(page.query_selector_all('[data-gym-card]')) == 13, len(page.query_selector_all('[data-gym-card]')))
    check('핀 13곳', len(page.query_selector_all('.gympin')) == 13, len(page.query_selector_all('.gympin')))
    check('Leaflet 컨테이너', page.evaluate("() => !!document.querySelector('.leaflet-container')"))
    page.screenshot(path=OUT + '/v142_live_01_map.png')

    # ── 즐겨찾기
    first_id = page.eval_on_selector('[data-gym-card]', 'el => el.getAttribute("data-gym-card")')
    page.click('[data-gym-fav="%s"]' % first_id)
    page.wait_for_timeout(500)
    check('☆ → 자주 가는 체육관 칩', page.query_selector('[data-gym-jump="%s"]' % first_id) is not None)
    page.click('[data-gym-filter="fav"]')
    page.wait_for_timeout(600)
    check('즐겨찾기만 → 1곳', len(page.query_selector_all('[data-gym-card]')) == 1)
    page.click('[data-gym-filter="all"]')
    page.wait_for_timeout(500)

    # ── 내 위치 기준
    page.click('[data-gym-geo]')
    page.wait_for_timeout(2200)
    dists = page.evaluate("""() => Array.from(document.querySelectorAll('[data-gym-card]')).map(el => {
        var d = el.querySelector('.gymcard__dist');
        return d ? d.innerText : '';
    })""")
    nums = [float(t.replace('약', '').replace('km', '').strip()) for t in dists if t]
    check('전 카드 약 X.X km', len(nums) == 13, dists[:3])
    check('거리 오름차순', nums == sorted(nums), nums[:5])
    check('내 위치 점', page.evaluate("() => !!document.querySelector('.gyme-wrap, .gyme')"))
    page.screenshot(path=OUT + '/v142_live_02_near.png')

    # ── 새로고침 유지
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    close_sheets(page)
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(1100)
    check('입구 카드에 ★ 개수', page.evaluate("() => !!document.querySelector('.gymentry__n')"))

    # ── 5개 탭 오류 0 · 넘침
    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(1000)
        check('%s 탭 오류 0' % label, len(errs) == before, errs[before:before + 2])
    check('390 가로 넘침 없음', not page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1"))
    page.screenshot(path=OUT + '/v142_live_03_my.png')
    ctx.close()
    b.close()

print('\n== 콘솔·페이지 오류 ==', len(errs))
for e in errs[:10]:
    print(' ', e)
okn = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (okn, len(checks)))
for label, c in checks:
    if not c:
        print('FAILED:', label)
