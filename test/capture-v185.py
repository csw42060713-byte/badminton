"""bm-v1.85.0 캡처 — 3D 라켓(기본 파츠) · 불/얼음/바닥 강타 · 꾸미기 시트.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v184.py
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V184C_PORT', '8886'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    page = ctx.new_page()
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot184@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-26 15:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(700)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1300)
    page.evaluate("() => { const c = document.querySelector('.rk3d__cv'); const s = BM.racketcustom._last3d;"
                  " s.view.yaw = -0.5; s.view.pitch = 0.12; s.fit(); }")
    page.wait_for_timeout(500)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")

    page.screenshot(path=OUT + '/v185_racket_3d.png', clip=box)
    print('saved v185_racket_3d.png', flush=True)

    for fx, ms, name in [('fire', 360, 'v185_smash_fire'), ('fire', 520, 'v185_smash_fire_fly'),
                         ('ice', 360, 'v185_smash_ice'), ('ice', 560, 'v185_smash_ice_fly')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.smash(a.fx); s.hold(a.ms, 'air'); }""",
                      {'fx': fx, 'ms': ms})
        page.wait_for_timeout(240)
        page.screenshot(path=OUT + '/' + name + '.png', clip=box)
        print('saved ' + name, flush=True)

    for ms, name in [(420, 'v185_slam_hit'), (520, 'v185_slam_break')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(a, 'slam'); }""", ms)
        page.wait_for_timeout(240)
        page.screenshot(path=OUT + '/' + name + '.png', clip=box)
        print('saved ' + name, flush=True)

    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(1500)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v185_sheet2.png')
    print('saved v185_sheet.png', flush=True)
    b.close()
