"""v1.35 로컬 화면 점검 — 저장소를 그대로 띄워 390×844에서 5개 탭과 파트너 칩을 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-v135.py
"""
import functools
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = '/workspace/work/bm-app'
OUT = '/workspace/tmp/v135local'
PORT = 8145
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errs = []

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    page.goto('http://127.0.0.1:%d/?v=135' % PORT, wait_until='load')
    page.wait_for_timeout(2200)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2000)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(300)

    print('version', page.evaluate('window.BM && BM.app && BM.app.version'))

    # ── 일지 3건 (파트너: 민호 2번, 민수 1번 · 하나는 점수 없이)
    page.evaluate("""() => {
        const st = BM.app.ctx.store;
        const save = (patch) => { st.actions.setDraft(patch); return st.actions.saveLog().ok; };
        save({ date: '2026-11-20', cond: 6, intensity: 7, minutes: 80, weakness: ['스매시'],
               done: ['스트록'], games: [{ a: '21', b: 19 }], partner: '민호' });
    }""")
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
        const st = BM.app.ctx.store;
        st.actions.setDraft({ date: '2026-11-19', cond: 5, intensity: 5, minutes: 60, weakness: ['풋워크'],
          done: ['풋워크'], games: [{ a: '18', b: '21' }], partner: '민수' });
        return st.actions.saveLog().ok;
    }""")
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
        const st = BM.app.ctx.store;
        st.actions.setDraft({ date: '2026-11-18', cond: 7, intensity: 6, minutes: 70, done: ['게임'],
          games: [{ a: '21', b: '15' }], partner: '민호' });
        return st.actions.saveLog().ok;
    }""")
    page.wait_for_timeout(1600)

    def measure(tag):
        return page.evaluate("""() => {
            const r = (sel) => { const el = document.querySelector(sel); if (!el) return null;
              const b = el.getBoundingClientRect(); return {top: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width)}; };
            return {sw: document.documentElement.scrollWidth, vw: innerWidth,
              hero: r('.card--hero'), ask: r('.card--rtn-ask'), wkch: r('.card--wkch'),
              ptn: r('.card--ptn'), form: r('[data-form="log"]'), head: r('[data-form="log"] .card__head'),
              chips: r('[data-ptnchips]'), chipCount: document.querySelectorAll('[data-ptn-chip]').length,
              body: document.body.scrollHeight};
        }""")

    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(300)
    m = measure('log')
    print('log layout', m)
    page.screenshot(path=OUT + '/log-top.png')

    # ── 경기 점수 접기 펼치고 칩 확인
    page.evaluate("document.querySelector('[data-fold=\"games\"]').open = true")
    page.wait_for_timeout(400)
    page.evaluate("document.querySelector('[data-ptnchips]')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/log-chips.png')
    chips = page.evaluate("""() => [...document.querySelectorAll('[data-ptn-chip]')].map(b => ({
        n: b.getAttribute('data-ptn-chip'), on: b.classList.contains('is-on'),
        pressed: b.getAttribute('aria-pressed'), h: Math.round(b.getBoundingClientRect().height)}))""")
    print('chips', chips)
    if page.query_selector('[data-ptn-chip]'):
        page.click('[data-ptn-chip]')
        page.wait_for_timeout(500)
        print('after tap value =', page.evaluate("document.querySelector('[data-field=\"partner\"]').value"))
        print('draft partner =', page.evaluate('BM.app.ctx.store.state.drafts.log.partner'))
        print('pressed =', page.evaluate("[...document.querySelectorAll('[data-ptn-chip]')].map(b => b.getAttribute('aria-pressed'))"))
        page.screenshot(path=OUT + '/log-chips-on.png')
        page.click('[data-ptn-chip]')
        page.wait_for_timeout(400)
        print('after second tap value =', repr(page.evaluate("document.querySelector('[data-field=\"partner\"]').value")))

    # ── 루틴 선택 카드 (아직 안 고름)
    page.evaluate("localStorage.removeItem('bm_routine_pref_v1')")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(300)
    m2 = measure('ask')
    print('with ask', m2)
    page.screenshot(path=OUT + '/log-ask.png')
    page.locator('.card--rtn-ask').screenshot(path=OUT + '/ask-card.png')

    # ── 5개 탭
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(900)
        page.evaluate('window.scrollTo(0,0)')
        page.wait_for_timeout(300)
        sw = page.evaluate('document.documentElement.scrollWidth')
        page.screenshot(path=OUT + '/%s.png' % tab)
        print(tab, 'scrollWidth', sw)
        if tab == 'community':
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=OUT + '/community-top.png')

    print('errors', len(errs), errs[:5])
    b.close()

httpd.shutdown()
