"""bm-v1.88.0 캡처 — 진짜 3D(Three.js WebGL) 라켓 쇼룸 · 스매시 · 모션 · 파츠.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v188.py
결과: /workspace/downloads/v188_*.png
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V188C_PORT', '8910'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ONLY = os.environ.get('V188_ONLY', '')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

# WebGL 을 실제로 켭니다 (headless 는 SwiftShader)
FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None, args=FLAGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    page = ctx.new_page()
    errs, csp = [], []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot188@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.data.hearts = { balance: 20, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      st.me.theme.gear = { custom: { body: 'power77', unlocked: [],
        frame: 'matte', string: 'lime', grip: 'black', stencil: 'none', charm: 'none', effect: 'none' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1800)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")

    def shot(name, wait=300, clip=None):
        if ONLY and ONLY not in name:
            return
        page.wait_for_timeout(wait)
        page.screenshot(path=OUT + '/%s.png' % name, clip=(clip if clip is not None else box))
        print('saved ' + name, flush=True)

    # 1) 기본 3D 뷰 (파워 77 · 형광 라임)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    shot('v188_3d_default')

    # 2) 회전 각도 (옆에서 본 두께)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = 0.62; s.view.pitch = 0.06; s.paint(); }")
    shot('v188_3d_rotated')
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -1.15; s.view.pitch = 0.02; s.paint(); }")
    shot('v188_3d_side')

    # 3) 오닉스 티타늄 + 투톤 네온 + 프리즘 (레전드 세트)
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear.custom = { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:lime', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:prism'],
        frame: 'onyx', string: 'lime', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' };
      BM.racketcustom._last3d.paint();
    }""")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    shot('v188_parts_onyx_twotone', 700)

    # 4) 타월 베이지 그립
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear.custom = { body: 'control',
        unlocked: ['body:control', 'frame:carbon', 'string:white', 'grip:towel', 'effect:blaze'],
        frame: 'carbon', string: 'white', grip: 'towel', stencil: 'bolt', charm: 'medal', effect: 'blaze' };
      BM.racketcustom._last3d.paint();
    }""")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = 0.45; s.view.pitch = 0.12; s.fit(); }")
    shot('v188_parts_towel_carbon', 700)

    # 5) 스매시 — 날아오기 · 임팩트 · 발사
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear.custom = { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:lime', 'grip:twotone', 'charm:ace', 'effect:fire'],
        frame: 'onyx', string: 'lime', grip: 'twotone', stencil: 'none', charm: 'ace', effect: 'fire' };
      BM.racketcustom._last3d.paint();
    }""")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(400)
    for name, ms in [('v188_smash_incoming', 210), ('v188_smash_impact', 346),
                     ('v188_smash_after', 380), ('v188_smash_launch', 470)]:
        page.evaluate("(a) => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(a); }", ms)
        shot(name, 320)

    # 6) 모션 3종
    for mid, ms, nm in [('showcase', 1400, 'v188_motion_showcase'),
                        ('twist', 700, 'v188_motion_twist'),
                        ('flip', 900, 'v188_motion_flip')]:
        page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
        page.wait_for_timeout(1400)
        page.evaluate("(a) => { const s = BM.racketcustom._last3d; s.motion(a.id); s.hold(a.ms); }", {'id': mid, 'ms': ms})
        shot(nm, 340)

    # 7) 바닥 강타
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(1400)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(380, 'slam'); }")
    shot('v188_slam', 380)

    # 8) 시트 전체 (배지·파츠·모션 칩이 함께)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(1500)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v188_sheet_full.png')
    print('saved v188_sheet_full', flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    cspv = page.evaluate("() => window.__csp || []")
    print('overflow', overflow, flush=True)
    print('csp', cspv, flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e]), flush=True)
    for e in errs[:6]:
        print('  ', e[:200], flush=True)
    b.close()
