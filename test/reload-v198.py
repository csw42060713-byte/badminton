#!/usr/bin/env python3
"""bm-v1.98.0 — 각인이 새로고침·재방문에도 남는지 확인 (390×844 · has_touch)

  · 그립에 'SW' 를 넣고 → 페이지를 새로고침 → 시트를 다시 열어 입력칸·3D 각인·미니 라켓 확인
  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/reload-v198.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8796
BASE = 'http://127.0.0.1:%d/index.html' % PORT
checks = []


def check(name, ok, detail=''):
    checks.append((name, bool(ok)))
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)) if detail else ''), flush=True)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    pg = ctx.new_page()
    pg.goto(BASE, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 14:00:00',
        profile:{nick:'승우', level:'B조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 14:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(1600)
    pg.evaluate("""() => {
      const st = BM.app.ctx.store.state; st.me.admin = true; st.me.email = 'csw42060713@gmail.com';
    }""")
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(500)
    pg.tap('[data-act="racket-sheet"]')
    pg.wait_for_timeout(1800)
    # 그립 탭 → 입력 → 적용
    pg.evaluate("() => { const el = document.querySelector('.rk3d__tab[data-rk-slot=\"grip\"]'); el.scrollIntoView({block: 'center'}); }")
    pg.wait_for_timeout(400)
    el = pg.locator('.rk3d__tab[data-rk-slot="grip"]').first
    bb = el.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(600)
    pg.evaluate("() => { const el = document.querySelector('.rkink'); el.scrollIntoView({block: 'center'}); }")
    pg.wait_for_timeout(400)
    inp = pg.locator('[data-rk-ink-input]').first
    bb = inp.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(200)
    pg.keyboard.type('SW')
    pg.wait_for_timeout(200)
    ab = pg.locator('[data-rk-ink-apply]').first.bounding_box()
    pg.touchscreen.tap(ab['x'] + ab['width'] / 2, ab['y'] + ab['height'] / 2)
    pg.wait_for_timeout(1400)
    before = pg.evaluate("() => ((BM.app.ctx.store.state.me.theme||{}).gear||{}).custom.initial")
    print('적용 직후 저장값', before, flush=True)
    check('적용 직후 저장값 SW', before == 'SW', before)

    # 새로고침 (기기 저장 → 다시 읽기)
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(2000)
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(600)
    hdr = pg.evaluate("() => ({ ink: !!document.querySelector('#hdrRacket text.rkink-t'), text: (document.querySelector('#hdrRacket text.rkink-t')||{}).textContent || '' })")
    print('새로고침 뒤 헤더', hdr, flush=True)
    check('새로고침 뒤 미니 라켓에 각인 유지', hdr['ink'] and hdr['text'] == 'SW', hdr)
    pg.tap('[data-act="racket-sheet"]')
    pg.wait_for_timeout(1800)
    after = pg.evaluate("""() => {
      const c = BM.racketcustom.customOf(BM.app.ctx.store.state.me);
      const plan = BM.racket3d.gripInkPlan(BM.racket3d.lookOf({ store: BM.app.ctx.store }));
      return { initial: c.initial, plan: plan ? plan.text : null, planColor: plan ? plan.color : null };
    }""")
    print('새로고침 뒤', after, flush=True)
    check('새로고침 뒤 값 유지', after['initial'] == 'SW', after)
    check('새로고침 뒤 3D 각인 레이어 다시 생김', after['plan'] == 'SW', after)
    # 그립 탭 입력칸에도 채워져 있는지
    pg.evaluate("() => { const el = document.querySelector('.rk3d__tab[data-rk-slot=\"grip\"]'); el.scrollIntoView({block: 'center'}); }")
    pg.wait_for_timeout(400)
    el = pg.locator('.rk3d__tab[data-rk-slot="grip"]').first
    bb = el.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(600)
    v = pg.evaluate("() => (document.querySelector('[data-rk-ink-input]')||{}).value || ''")
    check('새로고침 뒤 입력칸에 SW', v == 'SW', v)
    b.close()
httpd.shutdown()
bad = [c for c in checks if not c[1]]
print('\n%d/%d 확인 통과' % (len(checks) - len(bad), len(checks)))
raise SystemExit(1 if bad else 0)
