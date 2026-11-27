"""bm-v1.90.0 캡처 — 효과 7종(불·얼음·번개·블레이즈·스파크·스피드·프리즘) · 스매시 3장면 · 강타.

효과를 바꿀 때마다 페이지를 새로 열어 WebGL 컨텍스트가 쌓이지 않게 합니다(헤드리스 한정).
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v190.py
결과: /workspace/downloads/v190_*.png
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V190C_PORT', '8921'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ONLY = os.environ.get('V190_ONLY', '')


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox',
         '--autoplay-policy=no-user-gesture-required']

EFFECTS = ['fire', 'ice', 'thunder', 'blaze', 'spark', 'speed', 'prism']
SMASH_FX = ['fire', 'ice', 'thunder']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None, args=FLAGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    errs, csp = [], []
    page = ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)

    def boot(effect):
        page.goto(BASE, wait_until='load')
        page.evaluate("""() => {
          localStorage.clear();
          localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
          localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot190@example.com', name: '승우',
            at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
            profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                       onboardedAt: '2026-11-27 09:00:00' } }));
          localStorage.setItem('bm_seen_v1', 'true');
        }""")
        page.reload(wait_until='load')
        page.wait_for_timeout(2300)
        page.evaluate("""(eff) => {
          const st = BM.app.ctx.store.state;
          st.me.email = 'csw42060713@gmail.com';
          st.data.hearts = { balance: 40, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
          st.me.theme.gear = { custom: { body: 'smash',
            unlocked: ['body:smash', 'frame:onyx', 'string:cobalt', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:' + eff],
            frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: eff } };
          BM.racketcustom.openSheet(BM.app.ctx);
        }""", effect)
        page.wait_for_timeout(1400)
        page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.fit(); }")
        page.wait_for_timeout(400)

    def set_effect(eff):
        page.evaluate("""(eff) => {
          const st = BM.app.ctx.store.state;
          st.me.theme.gear = { custom: { body: 'smash',
            unlocked: ['body:smash','frame:onyx','string:cobalt','grip:twotone','stencil:crown','charm:ace','effect:' + eff],
            frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: eff } };
          const s = BM.racketcustom._last3d;
          s.view.yaw = -0.40; s.view.pitch = 0.10;
          s.paint();
        }""", eff)
        page.wait_for_timeout(700)

    def box():
        return page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height}; }""")

    def shot(name, wait=280):
        if ONLY and ONLY not in name:
            return
        page.wait_for_timeout(wait)
        page.evaluate("() => document.querySelector('.rk3d__cv').scrollIntoView({block:'center'})")
        page.wait_for_timeout(180)
        bb = box()
        clip = {'x': max(0, bb['x']), 'y': max(0, bb['y']),
                'width': min(390 - max(0, bb['x']), bb['width']),
                'height': min(844 - max(0, bb['y']), bb['height'])}
        page.screenshot(path=OUT + '/%s.png' % name, clip=clip)
        print('saved ' + name, flush=True)

    boot('fire')
    for eff in EFFECTS:
        set_effect(eff)
        shot('v190_effect_' + eff, 700)
        if eff in SMASH_FX:
            for tag, ms in [('incoming', 210), ('hit', 352), ('launch', 470)]:
                page.evaluate("(a) => { const s = BM.racketcustom._last3d; s.smash('%s'); s.hold(a); }" % eff, ms)
                shot('v190_%s_%s' % (eff, tag))
                page.evaluate("() => BM.racketcustom._last3d.resume()")
                page.wait_for_timeout(900)

    # 바닥 강타 · 시트 전체
    set_effect('fire')
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(380, 'slam'); }")
    shot('v190_slam', 380)
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(900)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.fit(); }")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v190_sheet_full.png')
    print('saved v190_sheet_full', flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print('overflow', overflow, flush=True)
    print('csp', page.evaluate("() => window.__csp || []"), flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e]), flush=True)
    for e in errs[:8]:
        print('  ', e[:200], flush=True)
    b.close()
