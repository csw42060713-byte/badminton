"""bm-v1.90.0 점검 — 소리 실제 재생 · 소리 단추 · 바닥 강타 · 가로 넘침/CSP/콘솔 0."""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V190K_PORT', '8933'))
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

FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox',
         '--autoplay-policy=no-user-gesture-required']

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
      window.__snd = { osc: 0, buf: 0, ctxs: 0 };
      (function () {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const po = AC.prototype.createOscillator, pb = AC.prototype.createBufferSource;
        AC.prototype.createOscillator = function () { window.__snd.osc++; return po.apply(this, arguments); };
        AC.prototype.createBufferSource = function () { window.__snd.buf++; return pb.apply(this, arguments); };
        const OG = AC.prototype.createGain;
        AC.prototype.createGain = function () { window.__snd.ctxs++; return OG.apply(this, arguments); };
      })();
    """)
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
    page.wait_for_timeout(2400)
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.data.hearts = { balance: 40, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      st.me.theme.gear = { custom: { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:cobalt', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:fire'],
        frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'fire' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1300)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(300)
    box = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height}; }""")

    # 실제 소리 — 탭(포인터)으로 스매시하고 오디오 계측
    page.evaluate("() => { window.__snd = { osc: 0, buf: 0, ctxs: 0 }; }")
    cv = page.query_selector('.rk3d__cv')
    bb = cv.bounding_box()
    page.mouse.click(bb['x'] + bb['width'] * 0.5, bb['y'] + bb['height'] * 0.4)
    page.wait_for_timeout(900)
    probe = page.evaluate("""() => ({ snd: window.__snd, muted: BM.smashsound.muted(),
      layers: BM.smashsound.layers('fire').length, state: (function () {
        try { return BM.smashsound.supported(); } catch (e) { return false; } })() })""")
    print('real tap sound', probe, flush=True)

    # 바닥 강타 (저음 쿵 + 충격 링 공명) — 계측 다시
    page.evaluate("() => { window.__snd = { osc: 0, buf: 0, ctxs: 0 }; }")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(380, 'slam'); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v190_slam.png', clip=box)
    print('slam', page.evaluate("() => window.__snd"), flush=True)
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(900)

    # 소리 단추 클릭 → 꺼짐/켜짐 + 기기 저장
    snd = page.evaluate("""() => {
      const b = document.querySelector('[data-rk-sound]');
      if (!b) return null;
      const before = { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), muted: BM.smashsound.muted() };
      b.click();
      const off = { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'),
                    muted: BM.smashsound.muted(), saved: localStorage.getItem('bm_sound_v1'),
                    playBlocked: BM.smashsound.play('ice', 'air') };
      b.click();
      const on = { text: b.textContent.trim(), muted: BM.smashsound.muted(), saved: localStorage.getItem('bm_sound_v1') };
      return { before: before, off: off, on: on };
    }""")
    print('sound toggle', snd, flush=True)

    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v190_sheet_full.png')
    print('saved sheet', flush=True)

    # 다른 효과의 소리도 서로 다른 층 수인지 확인
    print('layer counts', page.evaluate(
        "() => ['none','fire','ice','thunder'].map(f => f + ':' + BM.smashsound.layers(f).length)"), flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    cspv = page.evaluate("() => window.__csp || []")
    print('overflow', overflow, flush=True)
    print('csp', cspv, flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e]), flush=True)
    for e in errs[:8]:
        print('  ', e[:200], flush=True)
    b.close()
