"""bm-v1.86.0 캡처 — 3D 라켓(실제 비율) · 셔틀콕 접근/백스윙/임팩트/발사 · 불·얼음·바닥 강타 · 모션.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v186.py
"""
import http.server
import json
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V186C_PORT', '8887'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ONLY = os.environ.get('V186_ONLY', '')


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
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot186@example.com', name: '승우',
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
    page.wait_for_timeout(1400)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.5; s.view.pitch = 0.12; s.fit(); }")
    page.wait_for_timeout(500)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
    page.screenshot(path=OUT + '/v186_racket_3d.png', clip=box)
    print('saved v186_racket_3d.png', flush=True)

    def shot(name, js, wait=230):
        page.evaluate(js)
        page.wait_for_timeout(wait)
        page.screenshot(path=OUT + '/%s.png' % name, clip=box)
        print('saved ' + name, flush=True)

    seq = [
        ('v186_air_wind', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(150, 'air'); }"),
        ('v186_air_backswing', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(248, 'air'); }"),
        ('v186_air_swing', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(320, 'air'); }"),
        ('v186_fire_impact', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(360, 'air'); }"),
        ('v186_fire_blast', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(430, 'air'); }"),
        ('v186_fire_launch', "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(560, 'air'); }"),
        ('v186_ice_impact', "() => { const s = BM.racketcustom._last3d; s.smash('ice'); s.hold(365, 'air'); }"),
        ('v186_ice_blast', "() => { const s = BM.racketcustom._last3d; s.smash('ice'); s.hold(470, 'air'); }"),
        ('v186_thunder_blast', "() => { const s = BM.racketcustom._last3d; s.smash('thunder'); s.hold(400, 'air'); }"),
        ('v186_slam_hit', "() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(360, 'slam'); }"),
        ('v186_slam_break', "() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(520, 'slam'); }"),
    ]
    for name, js in seq:
        if ONLY and ONLY not in name:
            continue
        shot(name, js)

    # 모션 프리셋(관리자 해금 전에도 api 로 직접)
    for mid, ms, name in [('twist', 700, 'v186_motion_twist'), ('showcase', 1400, 'v186_motion_showcase'),
                          ('flip', 900, 'v186_motion_flip')]:
        if ONLY and ONLY not in name:
            continue
        page.evaluate("() => BM.racketcustom._last3d.resume()")
        page.wait_for_timeout(200)
        page.evaluate("(a) => { const s = BM.racketcustom._last3d; s.motion(a.id); s.hold(a.ms); }", {'id': mid, 'ms': ms})
        page.wait_for_timeout(230)
        page.screenshot(path=OUT + '/%s.png' % name, clip=box)
        print('saved ' + name, flush=True)

    # 시트 전체(모션 칩이 보이게) · 라켓 선택창
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(600)
    page.screenshot(path=OUT + '/v186_sheet.png')
    print('saved v186_sheet.png', flush=True)

    print('console_errors', len(errs), flush=True)
    for e in errs[:8]:
        print('  ', e[:300], flush=True)
    b.close()
