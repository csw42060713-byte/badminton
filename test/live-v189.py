"""bm-v1.89.0 라이브 점검 — 390×844 · '📱 폰 바탕화면으로 설정하기' · 콘솔 0 · CSP 0 · 가로 넘침 0

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v189.py
"""
import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get('V189_BASE') or 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None,
                          args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
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
    page.wait_for_timeout(3000)
    page.evaluate("""() => { localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email',email:'csw42060713@gmail.com',name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-27 09:00:00',
        profile:{nick:'승우',level:'선수부',discipline:'복식',region:'경기',club:'매원고',onboardedAt:'2026-11-27 09:00:00'}}));
      localStorage.setItem('bm_seen_v1','true'); }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3400)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version, wallpaper: !!(window.BM && BM.wallpaper) };
    })""")
    print('version', ver, flush=True)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear = { custom: { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:cobalt', 'grip:twotone', 'effect:ice', 'stencil:crown'],
        frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'none', effect: 'ice' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(2000)

    label = page.evaluate("""() => {
      const e = document.querySelector('[data-rk-wallpaper]');
      const h = document.querySelector('.rkwp__hint');
      return e ? { label: e.innerText, hint: h ? h.textContent : '', cfg: BM.wallpaper.configOf(BM.app.ctx.store.state) } : null;
    }""")
    print('button', label, flush=True)

    page.evaluate("() => document.querySelector('[data-rk-wallpaper]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(600)
    page.screenshot(path=OUT + '/v189_live_wallpaper_button.png')

    # 브리지 경로 실측 (실제 앱이 붙었을 때와 같은 호출)
    page.evaluate("""() => { window.__wp = null; window.__wpOpen = 0;
      window.BadmintonBridge = { setWallpaperConfig: j => window.__wp = j, openLiveWallpaper: () => window.__wpOpen++ }; }""")
    page.click('[data-rk-wallpaper]')
    page.wait_for_timeout(500)
    res = page.evaluate("() => ({ json: window.__wp, opened: window.__wpOpen })")
    import json as _json
    print('bridge', {'opened': res.get('opened'), 'config': _json.loads(res['json']) if res.get('json') else None}, flush=True)

    over = page.evaluate("""() => {
      const de = document.documentElement; const wide = [];
      document.querySelectorAll('body *').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > de.clientWidth + 1.5 || r.left < -1.5)) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.overflow === 'hidden') return;
          const p = el.parentElement; if (p && getComputedStyle(p).overflowX !== 'visible') return;
          wide.push((el.className || el.tagName) + ':' + Math.round(r.left) + '~' + Math.round(r.right));
        }
      });
      return { scrollW: de.scrollWidth, clientW: de.clientWidth, wide: wide.slice(0, 5) };
    }""")
    print('overflow', over, flush=True)

    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(1500)
    for tb in ['log', 'my']:
        page.evaluate("(t) => { const b = document.querySelector(\"#tabbar [data-tab='\" + t + \"']\"); if (b) b.click(); }", tb)
        page.wait_for_timeout(700)
    ov2 = page.evaluate("() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })")
    print('overflow_after_tabs', ov2, flush=True)
    print('csp', page.evaluate("() => window.__csp"), flush=True)
    print('console_errors', len(errs), [e[:200] for e in errs[:4]], flush=True)
    print('http_4xx', [c for c in bad if 'favicon' not in c][:5], flush=True)
    b.close()
