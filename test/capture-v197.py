#!/usr/bin/env python3
"""bm-v1.97.0 — 화면 캡처 (390×844 · has_touch)

  · 조합 도감의 '⚡ 바로 완성하기' 버튼과 누른 뒤 3D 연출
  · 3D 시트 첫 화면(부위 탭·전체화면 버튼)
  · 전체화면 3D

  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v197.py
  결과: /workspace/downloads/v197_*.png
"""
import base64
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8798


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)

    def grab(path, clip=None):
        """CDP 로 바로 찍습니다 — 캔버스가 계속 움직여 Playwright 의 '안정될 때까지' 대기가 걸립니다"""
        args = {'format': 'png', 'captureBeyondViewport': False}
        if clip:
            args['clip'] = {'x': clip['x'], 'y': clip['y'], 'width': clip['width'], 'height': clip['height'], 'scale': 2}
        r = cdp.send('Page.captureScreenshot', args)
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('saved', os.path.basename(path), flush=True)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 09:00:00',
        profile:{nick:'승우', level:'B조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 09:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(1600)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(300)
        else:
            break
    # 관리자 계정(전체 해금) + 몇 가지 조합을 한 번 맞춰 본 상태
    print('setup', pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.admin = true;
      st.me.email = 'csw42060713@gmail.com';
      const c = BM.racketcustom.customOf(st.me);
      ['frame:gold','string:gold','grip:gold','frame:ice','string:white','grip:white','effect:snow',
       'frame:red','string:crimson','grip:crimson','effect:fire','frame:violet','string:violet','grip:violet','effect:aurora'
      ].forEach(k => { if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k); });
      c.found = ['phoenix','aurora'];
      c.frame = 'violet'; c.string = 'violet'; c.grip = 'violet'; c.effect = 'aurora';
      st.me.theme = st.me.theme || {}; st.me.theme.gear = st.me.theme.gear || {};
      st.me.theme.gear.custom = c;
      const r = BM.app.ctx.store.actions.setGear({ custom: c });
      return { ok: !!(r && r.ok), admin: BM.domain.isAdminMe(BM.app.ctx.store.state.me) };
    }"""), flush=True)
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(600)
    pg.tap('[data-act="racket-sheet"]')
    pg.wait_for_timeout(1800)
    pg.evaluate("() => BM.racketcustom._last3d.fit()")
    pg.wait_for_timeout(600)
    grab(os.path.join(OUT, 'v197_sheet_top.png'))

    # 도감 펼치기 → 바로 완성하기 버튼
    pg.evaluate("() => { const d=document.querySelector('.rkset details'); if (d) d.open = true; const el=document.querySelector('.rkset'); if (el) el.scrollIntoView({block: 'start'}); }")
    pg.wait_for_timeout(700)
    grab(os.path.join(OUT, 'v197_apply_buttons.png'))
    bb = pg.evaluate("() => { const r=document.querySelector('.rkset').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
    grab(os.path.join(OUT, 'v197_apply_book.png'), bb)

    # '바로 완성하기' 터치 → 3D 세트 연출
    btn = pg.locator('[data-rk-apply-set="thunderGold"]')
    if btn.count():
        btn.first.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        bb = btn.first.bounding_box()
        pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(1500)
        pg.evaluate("() => { const el=document.querySelector('.rk3d'); if (el) el.scrollIntoView({block: 'start'}); window.scrollTo(0,0); }")
        pg.wait_for_timeout(500)
        bb = pg.evaluate("() => { const r=document.querySelector('.rk3d').getBoundingClientRect(); return {x:Math.max(0,r.x),y:Math.max(0,r.y),width:r.width,height:Math.min(844-Math.max(0,r.y),r.height)}; }")
        grab(os.path.join(OUT, 'v197_apply_set_3d.png'), bb)
        grab(os.path.join(OUT, 'v197_apply_after.png'))
    else:
        print('apply button not found', flush=True)

    # 전체화면
    pg.locator('.rk3d__full').scroll_into_view_if_needed()
    pg.wait_for_timeout(200)
    pg.tap('.rk3d__full')
    pg.wait_for_timeout(1400)
    grab(os.path.join(OUT, 'v197_fullscreen.png'))
    b.close()
httpd.shutdown()
