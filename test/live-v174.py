"""bm-v1.74.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.74.0 (sw.js · app.js · styles.css?v=20261125-3 · TWA 1.74.0/68)
  2) 앱 이름 '셔틀릭스 (Shuttlix)' — 문서 제목 · 홈 화면 이름 메타 · 상단 헤더 SHUTTLIX
  3) 시작 로딩(스플래시) SHUTTLIX · 셔틀릭스 (첫 페인트 직후)
  4) 시작화면(로그인 전) 셔틀릭스 · SHUTTLIX · MY 버전 줄 셔틀릭스 · v1.74.0
  5) 인스타 공유 카드 — 시트가 열리고 카드에 SHUTTLIX 워드마크가 그려진다
  6) 데이터 그대로 — packageId · 5개 탭 · localStorage 키(bm_*)
  7) 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360) · 캡처 downloads/v174_live_home.png · v174_live_sharecard.png

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v174.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    BLOCK = ('supabase.co', 'jsdelivr', 'tile.openstreetmap.org', 'accounts.google.com', 'storage.googleapis.com')
    ctx.route('**/*', lambda route: route.abort()
              if any(b in route.request.url for b in BLOCK) else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
            return
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name):
        path = OUT + '/v174_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def has(sel):
        return page.locator(sel).count() > 0

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    # ── A. 라이브 파일 ──
    sw = page.request.get(BASE + 'sw.js').text()
    check('A 라이브 sw.js bm-v1.74.0', "var VERSION = 'bm-v1.74.0'" in sw, sw[-120:])
    app_src = page.request.get(BASE + 'app.js').text()
    check('A 라이브 app.js v1.74.0', "version: 'v1.74.0'" in app_src)
    index = page.request.get(BASE + 'index.html').text()
    check('A 라이브 styles.css?v=20261125-3', 'styles.css?v=20261125-3' in index)
    check('A 라이브 index <title> 셔틀릭스', '<title>셔틀릭스 · 배드민턴 일지 & 매칭</title>' in index)
    check('A 라이브 홈 화면 이름 메타', 'apple-mobile-web-app-title" content="셔틀릭스' in index)
    mf = page.request.get(BASE + 'manifest.webmanifest')
    mfj = mf.json() if mf.status == 200 else {}
    check('A 라이브 매니페스트 200', mf.status == 200, mf.status)
    check('A 라이브 매니페스트 이름', mfj.get('short_name') == '셔틀릭스'
          and mfj.get('name') == '셔틀릭스 · 배드민턴 매칭 · AI', mfj.get('name'))
    twa = page.request.get(BASE + 'twa-manifest.json').json()
    check('A 라이브 TWA 1.74.0 · 코드 68', twa.get('appVersionName') == '1.74.0'
          and twa.get('appVersionCode') == 68, twa.get('appVersionName'))
    check('A 라이브 TWA 이름 셔틀릭스 · packageId 그대로', twa.get('name') == '셔틀릭스'
          and twa.get('launcherName') == '셔틀릭스'
          and twa.get('packageId') == 'io.github.csw42060713_byte.badminton',
          (twa.get('launcherName'), twa.get('packageId')))
    sc_src = page.request.get(BASE + 'js/sharecard.js').text()
    check('A 라이브 sharecard 워드마크 SHUTTLIX', "fillText('SHUTTLIX'" in sc_src
          and "'SHUTTLIX RECEIPT'" in sc_src and "fillText('BADMINTON'" not in sc_src)
    sw_src = page.request.get(BASE + 'sw.js').text()
    check('A 라이브 푸시 기본 제목 셔틀릭스', "title: '셔틀릭스'" in sw_src)

    # ── B. 첫 화면 · 시작 로딩 ──
    page.goto(BASE + '?nocache=1', wait_until='domcontentloaded')
    page.wait_for_timeout(150)
    sp = text_of('#splash') if has('#splash') else ''
    check('B 스플래시 SHUTTLIX · 셔틀릭스', 'SHUTTLIX' in sp and '셔틀릭스' in sp, sp.replace('\n', ' ')[:80])
    page.wait_for_timeout(1600)
    check('B 탭 제목 셔틀릭스', page.title() == '셔틀릭스 · 배드민턴 일지 & 매칭', page.title())

    # ── C. 시작화면(로그인 전) ──
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    check('C 시작화면 이름 셔틀릭스', text_of('.start__title').strip() == '셔틀릭스', text_of('.start__title'))
    check('C 시작화면 킥커 SHUTTLIX', 'SHUTTLIX' in text_of('.start__kicker'), text_of('.start__kicker'))
    shot('start')

    # ── D. 체험 모드로 앱 · 헤더 · MY ──
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live174@example.com', name: '승우',
          at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
          profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기', club: '나래울체육관',
                     onboardedAt: '2026-11-25 09:00:00' } }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('D 라이브 앱 v1.74.0', page.evaluate("() => BM.app.version") == 'v1.74.0',
          page.evaluate("() => BM.app.version"))
    check('D 헤더 워드마크 SHUTTLIX', text_of('.hdr__brand').strip() == 'SHUTTLIX', text_of('.hdr__brand'))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('D 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)
    keys = page.evaluate("() => Object.keys(localStorage).filter(k => k.indexOf('bm_') === 0).sort()")
    check('D localStorage 키(bm_*) 그대로', all(k in keys for k in ['bm_auth_v1', 'bm_backend_v1']), keys)
    shot('home')

    tap("#tabbar [data-tab='my']", 1000)
    page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    vline = text_of('.version') if has('.version') else ''
    check('D MY 버전 줄 셔틀릭스 · v1.74.0', '셔틀릭스' in vline and 'v1.74.0' in vline, vline)

    # ── E. 인스타 공유 카드 ──
    tap("#tabbar [data-tab='log']", 900)
    opened = page.evaluate("""() => {
      try {
        const st = BM.app.ctx.store.state;
        BM.sharecard.open(BM.app.ctx, { mode: 'today', record: (st.data.records || [])[0] || null });
        return true;
      } catch (e) { return String(e); }
    }""")
    check('E 공유 카드 시트가 열린다', opened is True, opened)
    page.wait_for_timeout(1400)
    painted = page.evaluate("""() => {
      const c = document.querySelector('#sheet .sc__canvas');
      if (!c) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      return n;
    }""")
    check('E 카드 캔버스가 그려진다', painted > 1000, painted)
    shot('sharecard')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── F. 개인정보처리방침 · 오류 · 넘침 ──
    page.goto(BASE + 'privacy.html', wait_until='load')
    page.wait_for_timeout(400)
    check('F 방침 제목 셔틀릭스', '셔틀릭스' in page.title(), page.title())
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(2600)
    check('F 앱 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])
    ow = overflow()
    check('F 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(700)
    ow2 = overflow()
    check('F 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)
    if blocked:
        print('  (막아 둔 요청: %d건 — 체험 모드라 실제로 쓰지 않는 요청)' % len(blocked), flush=True)

    browser.close()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
