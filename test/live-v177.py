"""bm-v1.77.0 라이브 점검 (390×844) — 🔔 푸시 토큰 저장 + 발송 서버 틀

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 화면을 봅니다)
  A) 라이브 파일 버전 — sw.js bm-v1.77.0 · app.js v1.77.0 · styles.css?v=20261125-6 · TWA 1.77.0/71
  B) 라이브 앱 — window.ShuttlixPush 브리지 · 5개 탭 · 앱 버전
  C) MY › 알림 · 편지지 두 줄(실시간·백그라운드) 캡처
  D) 브리지로 토큰을 넘기면 '앱에 연결됨'
  E) 앱 오류 0 · CSP 위반 0 · 가로 넘침 0(390·360)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v177.py
"""

import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V177_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V177_SHOTS', '/workspace/check-shots')

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def remote(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return r.read().decode('utf-8')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
        elif 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            pass
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def shot(name, keep=False):
        path = SHOTS + '/v177_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v177_live_' + name + '.png')
        return path

    # ── A. 라이브 파일 ──
    sw = remote('sw.js')
    app_js = remote('app.js')
    index = remote('index.html')
    twa = remote('twa-manifest.json')
    check('A 라이브 sw.js bm-v1.77.0', "var VERSION = 'bm-v1.77.0'" in sw)
    check('A 라이브 sw.js 가 js/push.js 를 캐시', "'./js/push.js'" in sw)
    check('A 라이브 app.js v1.77.0', "version: 'v1.77.0'" in app_js)
    check('A 라이브 styles.css?v=20261125-6', 'styles.css?v=20261125-6' in index)
    check('A 라이브 TWA 1.77.0 · 71', '"appVersionName": "1.77.0"' in twa and '"appVersionCode": 71' in twa)
    check('A packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)

    # ── B. 라이브 앱 ──
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live177@example.com', name: '승우',
                    at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
                    profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('B 라이브 앱 버전', page.evaluate("() => BM.app.version") == 'v1.77.0',
          page.evaluate("() => BM.app.version"))
    check('B window.ShuttlixPush', page.evaluate("() => !!(window.ShuttlixPush && window.ShuttlixPush.register)"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('B 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── C. MY 알림 두 줄 ──
    page.locator("#tabbar [data-tab='my']").first.click()
    page.wait_for_timeout(1200)
    page.evaluate("() => { const d = document.querySelector(\"details[data-group='alarm']\"); if (d) d.open = true; }")
    page.wait_for_timeout(500)
    grp = page.locator("details[data-group='alarm']").first
    if grp.count():
        grp.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    check('C 실시간 알림(앱 켜짐) 줄', page.locator("[data-push-step='live']").count() == 1)
    check('C 백그라운드 푸시(앱 닫힘) 줄', page.locator("[data-push-step='bg']").count() == 1)
    badge = page.locator("[data-push-step='bg'] .pushstep__b").first.inner_text().strip()
    check('C 백그라운드 배지', badge in ('스토어 앱 연결 준비', 'Firebase 키 대기', '알림 차단됨'), badge)
    shot('push_steps', keep=True)

    # ── D. 브리지 토큰 → 앱에 연결됨 ──
    page.evaluate("() => window.ShuttlixPush.register('live-check-token-123456', 'android')")
    page.wait_for_timeout(400)
    check('D 토큰 저장', (page.evaluate("() => (BM.push.token() || {}).token || ''") == 'live-check-token-123456'))
    page.evaluate("() => BM.app.repaint()")
    page.wait_for_timeout(600)
    page.evaluate("() => { const d = document.querySelector(\"details[data-group='alarm']\"); if (d) d.open = true; }")
    page.wait_for_timeout(400)
    badge2 = page.locator("[data-push-step='bg'] .pushstep__b").first.inner_text().strip()
    check('D "앱에 연결됨" 으로 바뀐다', badge2 == '앱에 연결됨', badge2)
    grp = page.locator("details[data-group='alarm']").first
    if grp.count():
        grp.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    shot('push_linked', keep=True)

    # ── E. 오류 · 넘침 ──
    w = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('E 390 가로 넘침 없음', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(600)
    w2 = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('E 360 가로 넘침 없음', w2[0] <= w2[1], w2)
    check('E 앱 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
