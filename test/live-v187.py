"""bm-v1.87.0 라이브 점검 — 390×844 · 콘솔 에러 0 · CSP 위반 0 · 가로 넘침 0 + 화면 캡처.

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v187.py
"""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get('V187_BASE') or 'https://csw42060713-byte.github.io/badminton/'

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

    _port = int(os.environ.get('V187_LIVE_PORT', '8913'))
    socketserver.TCPServer.allow_reuse_address = True
    _httpd = socketserver.TCPServer(('127.0.0.1', _port), _partial(_H, directory=_ROOT))
    threading.Thread(target=_httpd.serve_forever, daemon=True).start()
    BASE = 'http://127.0.0.1:%d/' % _port
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
tag = os.environ.get('V187_LIVE_TAG', 'live')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    errs = []
    csp = []
    page.on('console', lambda m: (errs if m.type == 'error' else []).append(m.text))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('response', lambda r: csp.append(r.url + ' ' + str(r.status)) if r.status >= 400 else None)
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(3500)
    page.evaluate("""() => { localStorage.clear(); localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email',email:'live187@example.com',name:'승우',at:new Date().toISOString(),
        onboardedAt:'2026-11-27 09:00:00', profile:{nick:'승우',level:'선수부',discipline:'복식',region:'경기',club:'매원고',onboardedAt:'2026-11-27 09:00:00'}}));
      localStorage.setItem('bm_seen_v1','true'); }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version };
    })""")
    print('version', ver, flush=True)

    # 1) 꾸미기 시트 — 상태 배지 + 레전드 파츠 + 하트 부족
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.me.theme.gear = { custom: { body: 'smash', unlocked: ['frame:onyx','grip:twotone','effect:prism','body:smash'],
        frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' } };
      st.data.hearts = { balance: 1, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1400)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.5; s.view.pitch = 0.12; s.fit(); }")
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v187_live_sheet.png')
    print('saved live sheet', flush=True)

    # 2) 되받아치는 스윙 — 발사 직후
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.smash('none'); s.hold(500, 'air'); }")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v187_live_return.png')
    print('saved live return', flush=True)

    # 3) 모션 쇼케이스(손목 한 바퀴)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(200)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.motion('showcase'); s.hold(1400); }")
    page.wait_for_timeout(320)
    page.screenshot(path=OUT + '/v187_live_motion.png')
    print('saved live motion', flush=True)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(500)

    # 4) 상대 라켓 구경
    page.evaluate("""() => {
      const rows = BM.util.readJSON('bm_rows_v1', []) || [];
      rows.push(BM.domain.toRow({ type: '프로필', id: 'p_live', clientId: 'p_live', createdAt: '2026-11-26 09:00:00',
        nick: '하늘', userKey: 'u_live', level: 'B조', region: '경기', discipline: '복식',
        theme: { theme: 'th_night', gear: { strungAt: '2026-10-10', cycleDays: 30,
          custom: { body: 'aero', unlocked: ['frame:onyx','grip:twotone','effect:prism','body:aero','charm:ace','stencil:crown','string:gold'],
            frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' } } } }));
      BM.util.writeJSON('bm_rows_v1', rows);
      const st = BM.app.ctx.store.state;
      Object.assign(st.data, BM.store.derive(BM.util.readJSON('bm_rows_v1', []), st.me.key));
    }""")
    page.click("#tabbar [data-tab='matching']")
    page.wait_for_timeout(900)
    page.evaluate("() => BM.views.matching.openRacketPeek(BM.app.ctx, 'u_live')")
    page.wait_for_timeout(800)
    page.screenshot(path=OUT + '/v187_live_peek.png')
    print('saved live peek', flush=True)

    # 5) 가로 넘침 · 탭 이동 점검
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
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide: wide.slice(0, 6) };
    }""")
    print('overflow', over, flush=True)
    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    for t in ['log', 'my']:
        page.click("#tabbar [data-tab='%s']" % t)
        page.wait_for_timeout(700)
    ov2 = page.evaluate("() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })")
    print('overflow_after_tabs', ov2, flush=True)

    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e and 'favicon' not in e]), flush=True)
    for e in [e for e in errs if 'ERR_FAILED' not in e][:8]:
        print('  ', e[:300], flush=True)
    print('csp_violations', len([c for c in csp if 'Content-Security' in c or 'CSP' in c]), flush=True)
    print('http_4xx', [c for c in csp if 'favicon' not in c][:5], flush=True)
    b.close()
