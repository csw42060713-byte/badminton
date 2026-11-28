"""bm-v1.102.0 성능 측정 — 390×844 · dsf 2 · CPU 4배 스로틀(중급 안드로이드 흉내).

  LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/perf-v1102.py

측정 항목(각 1.6초):
  idle             — 가만히 둔 채 자동 회전
  motion-flip      — 🌀 공중 3연속 스핀(3바퀴) + 링·스파크·글로우
  motion-showcase  — 한 바퀴 스냅 회전
  motion-twist     — 손목 트위스트
  smash            — ⚡ 스매시 연출(불꽃)
결과: 평균/중앙/95% 프레임 간격(ms)과 fps.
"""
import http.server
import json
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V1102P_PORT', '8893'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
THROTTLE = float(os.environ.get('V1102_THROTTLE', '4'))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

REC = """() => {
  window.__ft = [];
  window.__on = true;
  var last = performance.now();
  function tick(t) {
    if (!window.__on) return;
    var d = t - last; last = t;
    if (d > 0 && d < 500) window.__ft.push(d);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}"""
STOP = """() => {
  window.__on = false;
  var a = window.__ft.slice().sort(function (x, y) { return x - y; });
  if (!a.length) return { n: 0 };
  var sum = 0; a.forEach(function (v) { sum += v; });
  return { n: a.length, avg: +(sum / a.length).toFixed(2),
           med: +a[Math.floor(a.length / 2)].toFixed(2),
           p95: +a[Math.floor(a.length * 0.95)].toFixed(2),
           max: +a[a.length - 1].toFixed(2) };
}"""

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
    page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'perf1102@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-26 15:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(600)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
        const st = BM.app.ctx.store.state;
        st.me.admin = true;
        const c = BM.racketcustom.customOf(st.me);
        ['frame:red','string:crimson','grip:crimson','effect:fire'].forEach(function (k) {
          if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
        });
        c.frame = 'red'; c.string = 'crimson'; c.grip = 'crimson'; c.effect = 'fire';
    }""")
    page.wait_for_timeout(600)

    cdp = ctx.new_cdp_session(page)
    cdp.send('Emulation.setCPUThrottlingRate', {'rate': THROTTLE})

    out = {}

    def measure(name, act, ms=1600):
        page.evaluate(REC)
        act()
        page.wait_for_timeout(ms)
        out[name] = page.evaluate(STOP)
        print(name, json.dumps(out[name]), flush=True)

    measure('idle', lambda: None)
    for kind in ('flip', 'showcase', 'twist'):
        measure('motion-' + kind, lambda k=kind: page.evaluate("(k) => BM.racketcustom._last3d.motion(k)", kind))
        page.wait_for_timeout(500)
    measure('smash', lambda: page.evaluate("() => BM.racketcustom._last3d.smash('fire')"))
    page.wait_for_timeout(600)

    print('console_errors', len(errs), flush=True)
    for e in errs[:5]:
        print('  ', e[:200], flush=True)
    print('RESULT ' + json.dumps(out), flush=True)
    b.close()
