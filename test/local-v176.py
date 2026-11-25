"""bm-v1.76.0 로컬 점검 (390×844) — 🏸 내 라켓 · 스트링 장력 메모 & 교체 알림

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 화면에서 확인합니다.
  A) 버전·캐시 키·TWA·새 파일 로드 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  B) MY 에 '내 라켓 · 스트링' 카드가 보이고 처음에는 비어 있다
  C) 편집 시트 — 칩·오늘 버튼으로 입력하고 저장하면 카드에 요약이 뜬다
  D) 새로고침해도 그대로 남아 있다(기기 저장 → 프로필 꾸미기 JSON)
  E) 교체일을 과거로 바꾸면 '줄 교체 시기!' 배지 + 일지 & AI 위 한 줄 배너
  F) '오늘 새 줄로 갈았어요' 원탭 → D+0 으로 돌아오고 배지·배너가 사라진다
  G) 390·360 가로 넘침 없음
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v176.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V176_PORT', '8876'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V176_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V176_SHOTS', '/workspace/check-shots')

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
        path = SHOTS + '/v176_' + name + '.png'
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
            const s = { kind: 'email', email: 'check176@example.com', name: a.nick,
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
    check('A sw.js bm-v1.76.0', "var VERSION = 'bm-v1.76.0'" in read('sw.js'))
    check('A sw.js 가 js/gear.js 를 캐시한다', "'./js/gear.js'" in read('sw.js'))
    check('A index styles.css?v=20261125-5', 'styles.css?v=20261125-5' in read('index.html'))
    check('A index 가 js/gear.js 를 불러온다', 'js/gear.js' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.76.0 · 코드 70', '"appVersionName": "1.76.0"' in twa and '"appVersionCode": 70' in twa)
    check('A TWA packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1800)
    login('승우')
    check('A 앱 버전 v1.76.0', page.evaluate("() => BM.app.version") == 'v1.76.0',
          page.evaluate("() => BM.app.version"))
    check('A BM.gear 가 로드됐다', page.evaluate("() => !!(window.BM && BM.gear && BM.gear.statusOf)"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. MY 카드 (처음 = 빈 상태) ──
    tap("#tabbar [data-tab='my']", 1100)
    card = page.locator("[data-region='gear']").first
    check('B MY 에 내 라켓 · 스트링 카드', card.count() > 0)
    if card.count():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    check('B 카드 제목', '내 라켓 · 스트링' in text_of("[data-region='gear'] .card__head"),
          text_of("[data-region='gear'] .card__head"))
    check('B 처음에는 빈 상태', '내 라켓 기록하기' in text_of("[data-region='gear']"),
          text_of("[data-region='gear']")[:80])
    shot('b_my_gear_empty')

    # ── C. 편집 시트로 입력 · 저장 ──
    tap("[data-region='gear'] [data-act='gear-sheet']", 600)
    check('C 편집 시트가 열린다', has('#sheet [data-gear-form]'))
    check('C 스트링 프리셋 칩 4종', page.locator("#sheet [data-gear-pick='string']").count() == 4)
    check('C 장력 칩 5종', page.locator("#sheet [data-gear-pick='tension']").count() == 5)
    check('C 주기 칩 4종', page.locator("#sheet [data-gear-pick='cycleDays']").count() == 4)
    page.fill("#sheet [data-gear='racket']", '아스트록스 88D 프로')
    tap("#sheet [data-gear-pick='string'][data-value='BG80']", 200)
    check('C 스트링 칩 → 입력칸', page.input_value("#sheet [data-gear='string']") == 'BG80',
          page.input_value("#sheet [data-gear='string']"))
    tap("#sheet [data-gear-pick='tension'][data-value='26']", 200)
    check('C 장력 칩 → 입력칸', page.input_value("#sheet [data-gear='tension']") == '26',
          page.input_value("#sheet [data-gear='tension']"))
    tap("#sheet [data-gear-today]", 200)
    check('C 오늘 버튼 → 오늘 날짜', len(page.input_value("#sheet [data-gear='strungAt']")) == 10,
          page.input_value("#sheet [data-gear='strungAt']"))
    tap("#sheet [data-gear-pick='cycleDays'][data-value='45']", 200)
    check('C 주기 칩 → 입력칸', page.input_value("#sheet [data-gear='cycleDays']") == '45',
          page.input_value("#sheet [data-gear='cycleDays']"))
    page.fill("#sheet [data-gear='memo']", '26은 조금 팽팽, 25가 편함')
    shot('c_gear_sheet')
    tap("#sheet [data-gear-save]", 900)
    check('C 저장하면 시트가 닫힌다', not has('#sheet [data-gear-form]'))
    txt = text_of("[data-region='gear']")
    check('C 카드에 라켓 이름', '아스트록스 88D 프로' in txt, txt[:120])
    check('C 카드에 스트링 · 장력', 'BG80 · 26 lbs' in txt, txt[:160])
    check('C 카드에 D+0', 'D+0' in txt, txt[:160])
    check('C 카드에 남은 날', '45일' in txt, txt[:160])
    check('C 카드에 메모', '25가 편함' in txt, txt[:160])
    check('C 카드에 리셋 버튼', has("[data-region='gear'] [data-act='gear-restung']"))
    page.wait_for_timeout(3200)          # 토스트가 사라진 뒤 카드만 깨끗하게
    card = page.locator("[data-region='gear']").first
    if card.count():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    shot('d_my_gear_saved')

    # ── D. 새로고침해도 유지 ──
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap_state = page.evaluate("() => BM.app.ctx.store.state.me.gear")
    check('D 저장소에 기록이 남아 있다', isinstance(tap_state, dict) and tap_state.get('string') == 'BG80', tap_state)
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    card = page.locator("[data-region='gear']").first
    if card.count():
        card.scroll_into_view_if_needed()
    txt = text_of("[data-region='gear']")
    check('D 새로고침 뒤에도 카드에 그대로', '아스트록스 88D 프로' in txt and 'BG80 · 26 lbs' in txt, txt[:140])

    # ── E. 교체일을 과거로 → 교체 시기 배지 + 일지 위 배너 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const g = Object.assign({}, st.me.gear, { strungAt: '2026-10-01' });
      st.locks.profile = 0;
      BM.app.ctx.actions.setGear(g);
    }""")
    page.wait_for_timeout(900)
    txt = text_of("[data-region='gear']")
    check('E 줄 교체 시기 배지', '줄 교체 시기' in txt, txt[:140])
    check('E 교체 시기 상태 표시', page.get_attribute("[data-region='gear']", 'data-gear-state') == 'due',
          page.get_attribute("[data-region='gear']", 'data-gear-state'))
    card = page.locator("[data-region='gear']").first
    if card.count():
        card.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
    shot('e_my_gear_due')

    page.evaluate("() => BM.app.ctx.actions.setTab('log')")
    page.wait_for_timeout(1000)
    check('E 일지 & AI 위 배너', has('.gearline'), page.locator('.gearline').count())
    check('E 배너 문구', '줄 교체 시기예요' in text_of('.gearline'), text_of('.gearline')[:100])
    check('E 배너에 스트링 · 장력', 'BG80 · 26 lbs' in text_of('.gearline'), text_of('.gearline')[:120])
    shot('f_log_gear_banner')

    # ── F. 오늘 새 줄로 갈았어요 ──
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    tap("[data-region='gear'] [data-act='gear-restung']", 900)
    txt = text_of("[data-region='gear']")
    check('F 리셋 뒤 D+0', 'D+0' in txt, txt[:140])
    check('F 리셋 뒤 교체 시기 배지 사라짐', '줄 교체 시기' not in txt, txt[:140])
    check('F 스트링 · 장력은 그대로', 'BG80 · 26 lbs' in txt, txt[:140])
    page.evaluate("() => BM.app.ctx.actions.setTab('log')")
    page.wait_for_timeout(1000)
    check('F 일지 위 배너도 사라짐', not has('.gearline'))
    shot('g_after_restung')

    # ── 배너에서 바로 시트 열기 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.locks.profile = 0;
      BM.app.ctx.actions.setGear(Object.assign({}, st.me.gear, { strungAt: '2026-10-01' }));
      BM.app.repaint();
    }""")
    page.wait_for_timeout(1100)
    check('배너가 다시 뜬다', has('.gearline'))
    tap('.gearline', 700)
    check('배너를 누르면 편집 시트', has('#sheet [data-gear-form]'))
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.locks.profile = 0;
      BM.app.ctx.actions.setGear(Object.assign({}, st.me.gear, { strungAt: '2026-11-20' }));
      BM.app.repaint();
    }""")
    page.wait_for_timeout(800)
    check('기록을 되돌리면 배너가 사라진다', not has('.gearline'))

    # ── G. 오류 · 넘침 ──
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(900)
    w, inner = overflow()
    check('G 390 가로 넘침 없음', w <= inner + 1, (w, inner))
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(700)
    w2, inner2 = overflow()
    check('G 360 가로 넘침 없음', w2 <= inner2 + 1, (w2, inner2))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)
    check('G 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('G CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
