"""bm-v1.74.0 로컬 점검 (390×844) — 앱 이름 '셔틀릭스 (Shuttlix)' 반영

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 화면을 확인합니다.
  A) 버전·캐시 키·TWA·5개 탭 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  B) 문서 제목·홈 화면 이름 메타·상단 헤더 워드마크(SHUTTLIX)
  C) 시작 로딩(스플래시) — SHUTTLIX · 셔틀릭스 (첫 페인트 직후 캡처)
  D) 시작화면(로그인 전) — 셔틀릭스 · SHUTTLIX 킥커
  E) MY 맨 아래 버전 줄 — 셔틀릭스 · v1.74.0
  F) 인스타 공유 카드 — 시트가 열리고 카드가 그려진다(캡처)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v174.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V174_PORT', '8874'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V174_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V174_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
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
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name):
        path = SHOTS + '/v174_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def tap(sel, wait=420):
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

    def login(nick='승우'):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check174@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.74.0', "var VERSION = 'bm-v1.74.0'" in read('sw.js'))
    check('A index styles.css?v=20261125-3', 'styles.css?v=20261125-3' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.74.0 · 코드 68', '"appVersionName": "1.74.0"' in twa and '"appVersionCode": 68' in twa)
    check('A TWA packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)

    # ── B. 문서 제목 · 메타 (파일 기준 + 실제 DOM) ──
    check('B index <title> 셔틀릭스', '<title>셔틀릭스 · 배드민턴 일지 & 매칭</title>' in read('index.html'))
    check('B 홈 화면 이름 메타', 'name="apple-mobile-web-app-title" content="셔틀릭스"' in read('index.html'))

    # ── C. 스플래시 (첫 페인트 직후 — 420ms 이상 보입니다) ──
    page.goto(BASE, wait_until='domcontentloaded')
    page.wait_for_timeout(120)
    sp = text_of('#splash') if has('#splash') else ''
    check('C 스플래시 SHUTTLIX', 'SHUTTLIX' in sp, sp.replace('\n', ' ')[:80])
    check('C 스플래시 셔틀릭스', '셔틀릭스' in sp, sp.replace('\n', ' ')[:80])
    shot('c_splash')
    page.wait_for_timeout(1400)

    # ── D. 시작화면(로그인 전) ──
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2200)
    start_title = text_of('.start__title') if has('.start__title') else ''
    check('D 시작화면 이름 셔틀릭스', start_title.strip() == '셔틀릭스', start_title)
    check('D 시작화면 킥커 SHUTTLIX', 'SHUTTLIX' in (text_of('.start__kicker') if has('.start__kicker') else ''),
          text_of('.start__kicker') if has('.start__kicker') else '')
    shot('d_start')
    check('D 앱 이름 셔틀릭스 — 탭 제목', page.title() == '셔틀릭스 · 배드민턴 일지 & 매칭', page.title())

    # ── 로그인(체험) 뒤 헤더 · MY ──
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.goto(BASE, wait_until='load')
    login('승우')
    check('A 앱 버전 v1.74.0', page.evaluate("() => BM.app.version") == 'v1.74.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    brand = text_of('.hdr__brand') if has('.hdr__brand') else ''
    check('B 헤더 워드마크 SHUTTLIX', brand.strip() == 'SHUTTLIX', brand)
    shot('b_home')

    tap("#tabbar [data-tab='my']", 1000)
    page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)
    vline = text_of('.version') if has('.version') else ''
    check('E MY 버전 줄 셔틀릭스 · v1.74.0', '셔틀릭스' in vline and 'v1.74.0' in vline, vline)
    shot('e_my_bottom')

    # ── F. 인스타 공유 카드 ──
    tap("#tabbar [data-tab='log']", 900)
    ok_open = page.evaluate("""() => {
      try {
        const st = BM.app.ctx.store.state;
        BM.sharecard.open(BM.app.ctx, { mode: 'today', record: (st.data.records || [])[0] || null });
        return true;
      } catch (e) { return String(e); }
    }""")
    check('F 공유 카드 시트가 열린다', ok_open is True, ok_open)
    page.wait_for_timeout(1200)
    check('F 카드 캔버스가 그려진다', page.evaluate("""() => {
      const c = document.querySelector('#sheet .sc__canvas');
      if (!c) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 8) painted++;
      return painted > 1000;
    }"""))
    shot('f_sharecard')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── G. 정책 페이지 이름 · 오류 · 넘침 ──
    page.goto(BASE + 'privacy.html', wait_until='load')
    page.wait_for_timeout(400)
    check('G 개인정보처리방침 제목', '셔틀릭스' in page.title(), page.title())
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(2400)
    check('G 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('G CSP 위반 0', len(csp) == 0, csp[:2])
    ow = overflow()
    check('G 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(600)
    ow2 = overflow()
    check('G 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
