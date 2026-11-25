"""bm-v1.76.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

· 라이브에 올라간 파일·화면을 그대로 봅니다(서비스워커는 막습니다).
· 라이브 앱을 기기 저장(local) 모드로 열어 '내 라켓 · 스트링' 카드의
  입력 → 저장 → 새로고침 유지 → 교체 시기 배지·일지 위 배너 → 오늘 갈았어요 리셋까지
  실제 화면에서 확인합니다(프로필 저장 경로는 Supabase 모드와 같은 코드).
  · 서버(Supabase) 계정으로 같은 흐름을 돌리려면 임시 검사 계정이 필요합니다 —
    2026-11-25 v1.75 검증 때 쓴 계정은 확인 뒤 지워서, 이번에는 기기 저장 모드로 봅니다.
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v176.py
"""

import json
import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V176_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V176_SHOTS', '/workspace/check-shots')

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def fetch_text(path):
    req = urllib.request.Request(BASE + path, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)

    # ── A. 라이브 파일 ──
    sw = fetch_text('sw.js')
    app = fetch_text('app.js')
    html = fetch_text('index.html')
    gear = fetch_text('js/gear.js')
    twa = json.loads(fetch_text('twa-manifest.json'))
    check('A 라이브 sw.js bm-v1.76.0', "var VERSION = 'bm-v1.76.0'" in sw)
    check('A 라이브 sw.js 가 js/gear.js 를 캐시', './js/gear.js' in sw)
    check('A 라이브 app.js v1.76.0', "version: 'v1.76.0'" in app)
    check('A 라이브 styles.css?v=20261125-5', 'styles.css?v=20261125-5' in html)
    check('A 라이브 index 가 js/gear.js 를 불러온다', 'js/gear.js' in html)
    check('A 라이브 js/gear.js 내려받기', 'BM.gear' in gear and 'statusOf' in gear)
    check('A 라이브 TWA 1.76.0 · 코드 70', twa.get('appVersionName') == '1.76.0' and twa.get('appVersionCode') == 70)
    check('A 라이브 packageId 그대로', twa.get('packageId') == 'io.github.csw42060713_byte.badminton')

    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            return
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name, path=None):
        path = path or (SHOTS + '/v176_live_' + name + '.png')
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

    # ── 앱 열기 (기기 저장 모드 · 체험 계정) ──
    page.goto(BASE, wait_until='domcontentloaded')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'live176@example.com', name: '승우',
          at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
          profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                     club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' }
        }));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3600)

    check('A 라이브 버전 v1.76.0', page.evaluate("() => (BM.app && BM.app.version) || ''") == 'v1.76.0',
          page.evaluate("() => (BM.app && BM.app.version) || ''"))
    check('A 라이브에 BM.gear 로드', page.evaluate("() => !!(window.BM && BM.gear && BM.gear.statusOf)"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 라이브 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. MY 카드 → 편집 시트 → 입력·저장 ──
    tap("#tabbar [data-tab='my']", 1100)
    card = page.locator("[data-region='gear']").first
    check('B 라이브 MY 내 라켓 카드', card.count() > 0)
    if card.count():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    check('B 라이브 처음에는 빈 상태', '내 라켓 기록하기' in text_of("[data-region='gear']"),
          text_of("[data-region='gear']")[:60])
    tap("[data-region='gear'] [data-act='gear-sheet']", 700)
    check('C 라이브 편집 시트', has('#sheet [data-gear-form]'))
    page.fill("#sheet [data-gear='racket']", '아스트록스 88D 프로')
    tap("#sheet [data-gear-pick='string'][data-value='BG80']", 200)
    tap("#sheet [data-gear-pick='tension'][data-value='26']", 200)
    tap("#sheet [data-gear-today]", 200)
    tap("#sheet [data-gear-pick='cycleDays'][data-value='45']", 200)
    page.fill("#sheet [data-gear='memo']", '26은 조금 팽팽, 25가 편함')
    shot('racket_sheet', OUT + '/v176_live_racket_sheet.png')
    tap("#sheet [data-gear-save]", 1000)
    check('C 라이브 저장하면 시트가 닫힌다', not has('#sheet [data-gear-form]'))
    txt = text_of("[data-region='gear']")
    check('C 라이브 카드에 라켓 · 스트링 · 장력', '아스트록스 88D 프로' in txt and 'BG80 · 26 lbs' in txt, txt[:120])
    check('C 라이브 카드에 D+0 · 남은 날', 'D+0' in txt and '45일' in txt, txt[:160])
    card = page.locator("[data-region='gear']").first
    if card.count():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
    shot('racket_card', OUT + '/v176_live_racket_card.png')

    # ── D. 새로고침해도 유지 ──
    page.reload(wait_until='load')
    page.wait_for_timeout(3400)
    g = page.evaluate("() => (BM.app.ctx.store.state.me && BM.app.ctx.store.state.me.gear) || null")
    check('D 라이브 새로고침 뒤에도 남아 있다', isinstance(g, dict) and g.get('string') == 'BG80', g)
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    txt = text_of("[data-region='gear']")
    check('D 라이브 카드에 그대로', '아스트록스 88D 프로' in txt and 'BG80 · 26 lbs' in txt, txt[:120])

    # ── E. 교체일을 과거로 → 교체 시기 배지 + 일지 위 배너 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.locks.profile = 0;
      BM.app.ctx.actions.setGear(Object.assign({}, st.me.gear, { strungAt: '2026-10-01' }));
      BM.app.repaint();
    }""")
    page.wait_for_timeout(900)
    txt = text_of("[data-region='gear']")
    check('E 라이브 줄 교체 시기 배지', '줄 교체 시기' in txt, txt[:120])
    page.evaluate("() => BM.app.ctx.actions.setTab('log')")
    page.wait_for_timeout(1100)
    check('E 라이브 일지 위 배너', has('.gearline'), page.locator('.gearline').count())
    check('E 라이브 배너 문구', '줄 교체 시기예요' in text_of('.gearline') and 'BG80 · 26 lbs' in text_of('.gearline'))

    # ── F. 오늘 새 줄로 갈았어요 ──
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    tap("[data-region='gear'] [data-act='gear-restung']", 1000)
    txt = text_of("[data-region='gear']")
    check('F 라이브 리셋 뒤 D+0', 'D+0' in txt, txt[:120])
    check('F 라이브 리셋 뒤 교체 시기 배지 사라짐', '줄 교체 시기' not in txt, txt[:120])
    page.evaluate("() => BM.app.ctx.actions.setTab('log')")
    page.wait_for_timeout(1100)
    check('F 라이브 일지 위 배너도 사라짐', not has('.gearline'))

    # ── G. 넘침 · 오류 ──
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    w, inner = overflow()
    check('G 라이브 390 가로 넘침 없음', w <= inner + 1, (w, inner))
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(700)
    w2, inner2 = overflow()
    check('G 라이브 360 가로 넘침 없음', w2 <= inner2 + 1, (w2, inner2))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)
    check('G 라이브 앱 오류 0', len(errs) == 0, errs[:3])
    check('G 라이브 CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
