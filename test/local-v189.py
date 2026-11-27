"""bm-v1.89.0 로컬 점검 — 390×844 · 커스텀 라켓 시트의 '📱 폰 바탕화면으로 설정하기'

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v189.py

  확인하는 것
   1) 시트 맨 아래 단추·안내가 390 폭에서 보이고 가로로 넘치지 않는다
   2) 일반 브라우저(데스크톱 UA)에서 누르면 '안드로이드 앱 설치' 안내만 (이동 없음)
   3) 네이티브 브리지가 있으면 설정 JSON 을 넘기고 배경화면 선택창을 부른다
   4) 콘솔 에러 0 · CSP 위반 0 · 가로 넘침 0
   5) 캡처: 시트 아래(단추) · 안내 토스트
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V189_PORT', '8921'))
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(Handler, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % PORT

BOOT = """() => {
  localStorage.clear();
  localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
  localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email',email:'csw42060713@gmail.com',name:'승우',
    at:new Date().toISOString(), onboardedAt:'2026-11-27 09:00:00',
    profile:{nick:'승우',level:'선수부',discipline:'복식',region:'경기',club:'매원고',onboardedAt:'2026-11-27 09:00:00'}}));
  localStorage.setItem('bm_seen_v1','true');
}"""

OPEN = """() => {
  const st = BM.app.ctx.store.state;
  st.me.email = 'csw42060713@gmail.com';
  st.data.hearts = { balance: 20, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
  st.me.theme.gear = { custom: { body: 'power77', unlocked: [],
    frame: 'matte', string: 'lime', grip: 'black', stencil: 'none', charm: 'none', effect: 'none' } };
  BM.racketcustom.openSheet(BM.app.ctx);
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None,
                          args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
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
    page.wait_for_timeout(2600)
    page.evaluate(BOOT)
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)
    page.wait_for_timeout(600)
    page.evaluate(OPEN)
    page.wait_for_timeout(1800)

    btn = page.query_selector('[data-rk-wallpaper]')
    label = btn.inner_text() if btn else ''
    hint = page.evaluate("() => { const e = document.querySelector('.rkwp__hint'); return e ? e.textContent : ''; }")
    box = page.evaluate("""() => { const e = document.querySelector('[data-rk-wallpaper]');
        if (!e) return null; const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height,
                 visible: r.width > 0 && r.height > 0 && r.bottom <= 844 + 1 }; }""")
    print('button', {'label': label, 'hint': hint, 'box': box}, flush=True)

    # 시트를 단추까지 스크롤해서 캡처
    page.evaluate("() => document.querySelector('[data-rk-wallpaper]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v189_local_wallpaper_button.png')

    # ① 데스크톱 UA: 안내만 (페이지 이동 없이 토스트)
    url_before = page.url
    page.click('[data-rk-wallpaper]')
    page.wait_for_timeout(600)
    toast = page.evaluate("() => { const e = document.querySelector('.toast, #toast, .ui-toast'); return e ? e.textContent : ''; }")
    print('desktop_toast', repr(toast), 'moved', page.url != url_before, flush=True)
    page.screenshot(path=OUT + '/v189_local_wallpaper_hint.png')

    # ② 네이티브 브리지: 설정 JSON 을 넘기고 선택창을 부른다
    page.evaluate("""() => {
      window.__wp = null; window.__wpOpen = 0;
      window.BadmintonBridge = {
        setWallpaperConfig: function (json) { window.__wp = json; },
        openLiveWallpaper: function () { window.__wpOpen++; }
      };
    }""")
    page.click('[data-rk-wallpaper]')
    page.wait_for_timeout(500)
    res = page.evaluate("() => ({ json: window.__wp, opened: window.__wpOpen })")
    ok_json = None
    if res.get('json'):
        import json as _json
        try:
            ok_json = _json.loads(res['json'])
        except Exception as e:  # noqa
            ok_json = {'parse_error': str(e)}
    print('bridge', {'opened': res.get('opened'), 'config': ok_json}, flush=True)

    # ③ 가로 넘침 · CSP · 콘솔
    over = page.evaluate("""() => {
      const de = document.documentElement; const wide = [];
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
    page.wait_for_timeout(1400)
    for tb in ['log', 'my']:
        page.evaluate("(t) => { const b = document.querySelector(\"#tabbar [data-tab='\" + t + \"']\"); if (b) b.click(); }", tb)
        page.wait_for_timeout(700)
    print('csp', page.evaluate("() => window.__csp"), flush=True)
    print('console_errors', [e for e in errs if 'ERR_FAILED' not in e][:6], flush=True)
    b.close()
