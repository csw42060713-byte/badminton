"""2026-11-21 14시 정기 점검 — 라이브 앱(390×844) 전 화면 회귀 + 연타 방지 확인.

LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu \
python3 test/live-check-20261121.py
"""
import json
import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, fails = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:400]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    def _failed(r):
        why = (r.failure or '')
        if 'ERR_ABORTED' in why:
            return
        fails.append(r.url[:120] + ' :: ' + why[:60])
    page.on('requestfailed', _failed)

    # ── 배포 파일 버전 일치
    sw = page.request.get(BASE + 'sw.js?cb=' + str(int(time.time()))).text()
    app = page.request.get(BASE + 'app.js?x=3').text()
    index = page.request.get(BASE + 'index.html?x=3').text()
    twa = page.request.get(BASE + 'twa-manifest.json?x=3').text()
    ver = page.request.get(BASE + 'app.js?x=4').text()
    m = 'v1.38.0'
    check('라이브 sw.js 캐시 버전', ('bm-' + m) in sw, sw[:120].replace('\n', ' '))
    check('라이브 app.js 버전', ("version: '" + m + "'") in app)
    check('라이브 index.html CSS 캐시', 'styles.css?v=20261121-50' in index, index[:0])
    check('라이브 TWA 버전', '"appVersionName": "1.38.0"' in twa and '"appVersionCode": 38' in twa)

    # sw.js SHELL 목록이 실제로 모두 200인지
    import re
    shell = re.findall(r"'\./([^']+)'", sw.split('SHELL = [')[1].split('];')[0])
    bad = []
    for f in shell:
        r = page.request.get(BASE + f)
        if r.status != 200:
            bad.append((f, r.status))
    check('sw.js SHELL 파일 전부 200', not bad, bad[:5])
    print('SHELL 파일 수', len(shell))

    # ── 앱 실행
    page.goto(BASE + 'index.html?chk=1', wait_until='load')
    page.evaluate("() => localStorage.clear()")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2500)
    for _ in range(5):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(250)
    check('앱 버전 v1.38.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.38.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    def tab_info(name):
        return page.evaluate("""() => {
          const vis = Array.from(document.querySelectorAll('button, a, [role="button"]'))
            .filter(el => { const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; });
          const small = vis.filter(el => el.getBoundingClientRect().height < 32 && !el.closest('.tabbar'))
            .map(el => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24));
          return {
            overflowX: document.documentElement.scrollWidth > innerWidth + 1,
            scrollW: document.documentElement.scrollWidth,
            h: document.body.scrollHeight,
            small: small.slice(0, 12),
            html: document.body.innerText.length
          };
        }""")

    tabs = [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]
    results = {}
    for key, label in tabs:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(1000)
        info = tab_info(key)
        results[key] = info
        new_errs = errs[before:]
        check('%s 탭: 콘솔·페이지 오류 0' % label, not new_errs, new_errs[:2])
        check('%s 탭: 가로 넘침 없음' % label, not info['overflowX'], info['scrollW'])
        page.screenshot(path='%s/chk20261121_%s.png' % (OUT, key))

    # ── 연타 방지: 일지 저장
    page.click('[data-tab="log"]')
    page.wait_for_timeout(900)
    has_form = page.query_selector('[data-log-form], form')
    print('일지 폼 있음', bool(has_form))
    if has_form:
        # 필수 칸을 채운다: 날짜·닉네임 등 기본값이 있으면 그대로 저장
        rows_before = page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1') || '[]').length")
        btn = page.query_selector('[data-log-save], [data-save]')
        if btn:
            bid = btn.get_attribute('data-log-save') is not None and '[data-log-save]' or '[data-save]'
            btn.click()
            page.wait_for_timeout(50)
            # 두 번째 클릭을 즉시 시도
            try:
                page.eval_on_selector(bid, 'el => el.click()')
            except Exception:
                pass
            page.wait_for_timeout(1200)
            rows_after = page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1') || '[]').length")
            check('일지 저장 연타: 한 줄만 저장', rows_after - rows_before == 1, (rows_before, rows_after))

    print('\n== 오류 ==')
    for e in errs[:20]:
        print(' ', e)
    print('요청 실패', fails[:10])

    ok = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과' % (ok, len(checks)))
    for label, c in checks:
        if not c:
            print('FAILED:', label)
    b.close()
