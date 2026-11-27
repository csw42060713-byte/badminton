"""bm-v1.88.0 라이브 점검 — 390×844 · WebGL 3D 실측 · 콘솔 0 · CSP 0 · 가로 넘침 0 + 캡처.

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v188.py
"""
import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get('V188_BASE') or 'https://csw42060713-byte.github.io/badminton/'

if BASE.startswith('http://127.0.0.1') or BASE.startswith('http://localhost'):
    import http.server, socketserver, threading
    from functools import partial as _partial
    _ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

    class _H(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, max-age=0')
            super().end_headers()

        def log_message(self, *a):
            pass

    _port = int(os.environ.get('V188_LIVE_PORT', '8914'))
    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(('127.0.0.1', _port), _partial(_H, directory=_ROOT))
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()
    BASE = 'http://127.0.0.1:%d/' % _port

EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
TAG = os.environ.get('V188_LIVE_TAG', 'live')
ONLY = os.environ.get('V188_LIVE_ONLY', '')

# WebGL 을 실제로 켭니다 (headless 는 SwiftShader)
FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None, args=FLAGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    errs, bad = [], []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('response', lambda r: bad.append(r.url + ' ' + str(r.status)) if r.status >= 400 else None)
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(3200)
    page.evaluate("""() => { localStorage.clear(); localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email',email:'live188@example.com',name:'승우',at:new Date().toISOString(),
        onboardedAt:'2026-11-27 09:00:00', profile:{nick:'승우',level:'선수부',discipline:'복식',region:'경기',club:'매원고',onboardedAt:'2026-11-27 09:00:00'}}));
      localStorage.setItem('bm_seen_v1','true'); }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3400)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version };
    })""")
    print('version', ver, flush=True)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.data.hearts = { balance: 20, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      st.me.theme.gear = { custom: { body: 'power77', unlocked: [],
        frame: 'matte', string: 'lime', grip: 'black', stencil: 'none', charm: 'none', effect: 'none' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(2000)

    info = page.evaluate("""() => {
      const api = BM.racketcustom._last3d;
      const cv = document.querySelector('.rk3d__cv');
      const g = cv.getContext('webgl2') || cv.getContext('webgl');
      let painted = 0;
      if (g) {
        const buf = new Uint8Array(cv.width * cv.height * 4);
        g.readPixels(0, 0, cv.width, cv.height, g.RGBA, g.UNSIGNED_BYTE, buf);
        for (let i = 3; i < buf.length; i += 4) if (buf[i] > 6) painted++;
      }
      return { engine: api && api.engine, ready: api && api.ready(), webgl: !!g,
               paintedPx: painted, size: [cv.width, cv.height] };
    }""")
    print('3d', info, flush=True)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")

    def shot(name, wait=320):
        if ONLY and ONLY not in name:
            return
        page.wait_for_timeout(wait)
        page.screenshot(path=OUT + '/v188_%s_%s.png' % (TAG, name), clip=box)
        print('saved ' + name, flush=True)

    # 1) 기본 3D 뷰
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    shot('3d_default')

    # 2) 회전
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = 0.60; s.view.pitch = 0.06; s.paint(); }")
    shot('3d_rotated')

    # 3) 오닉스 · 투톤 · 프리즘
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear.custom = { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:lime', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:prism'],
        frame: 'onyx', string: 'lime', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' };
      BM.racketcustom._last3d.paint();
    }""")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    shot('parts_onyx_twotone', 800)

    # 4) 스매시 임팩트
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(346); }")
    shot('smash_impact', 340)

    # 5) 모션 · 강타
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(1400)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.motion('showcase'); s.hold(1400); }")
    shot('motion_showcase', 340)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(1400)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(380, 'slam'); }")
    shot('slam', 380)

    # 6) 시트 전체 + 가로 넘침 + 탭 이동
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(1500)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.46; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v188_%s_sheet.png' % TAG)
    print('saved sheet', flush=True)

    over = page.evaluate("""() => {
      const de = document.documentElement;
      const wide = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > de.clientWidth + 1.5 || r.left < -1.5)) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.overflow === 'hidden') return;
          wide.push((el.className || el.tagName) + ':' + Math.round(r.left) + '~' + Math.round(r.right));
        }
      });
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide: wide.slice(0, 5) };
    }""")
    print('overflow', over, flush=True)
    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    for tb in ['log', 'my']:
        page.click("#tabbar [data-tab='%s']" % tb)
        page.wait_for_timeout(700)
    ov2 = page.evaluate("() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })")
    print('overflow_after_tabs', ov2, flush=True)
    cspv = page.evaluate("() => window.__csp || []")
    print('csp_violations', cspv, flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e]), flush=True)
    for e in [e for e in errs if 'ERR_FAILED' not in e][:6]:
        print('  ', e[:300], flush=True)
    print('http_4xx', [c for c in bad if 'favicon' not in c][:5], flush=True)
    b.close()
