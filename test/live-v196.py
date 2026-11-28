#!/usr/bin/env python3
"""bm-v1.96.0 라이브 검증 — https://csw42060713-byte.github.io/badminton/ (390x844).

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/live-v196.py
"""
import json
import os
import http.server
import socketserver
import threading
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'https://csw42060713-byte.github.io/badminton/')
OUT = '/workspace/downloads'


def serve_local():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=root, **kw)
        def log_message(self, *a):
            pass
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', 8774), H)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    httpd = serve_local() if os.environ.get('BASE') else None
    # 1) 배포본 확인 (캐시·서비스워커 이전)
    sw = urllib.request.urlopen(BASE + 'sw.js?cb=1', timeout=30).read().decode('utf-8')
    ver = [l for l in sw.splitlines() if l.startswith('var VERSION')][0]
    print('live sw:', ver)
    html = urllib.request.urlopen(BASE + 'index.html?cb=1', timeout=30).read().decode('utf-8')
    print('live css key:', 'styles.css?v=20261128-2' in html)
    js = urllib.request.urlopen(BASE + 'js/racket3d.js?cb=1', timeout=30).read().decode('utf-8')
    print('live 3D rev 1.96.0:', "var REV = '1.96.0'" in js, '| buildRain:', 'function buildRain' in js)

    console_errors, page_errors, csp = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                        is_mobile=True, has_touch=True)
        pg.set_default_timeout(20000)
        pg.add_init_script("window.__errs=[];window.addEventListener('error',function(e){window.__errs.push((e.error&&e.error.stack)||e.message);});")
        pg.on('console', lambda m: (console_errors.append(m.text) if m.type == 'error' else None,
                                    csp.append(m.text) if 'Content Security Policy' in m.text else None))
        pg.on('pageerror', lambda e: page_errors.append(str(e)))
        pg.goto(BASE + 'index.html?live=196', wait_until='networkidle')
        pg.wait_for_timeout(1500)
        pg.click('.start__guest')
        pg.wait_for_timeout(2200)
        for _ in range(3):
            c = pg.locator('#sheet [data-close]')
            if c.count():
                c.first.click()
                pg.wait_for_timeout(500)
            else:
                break
        pg.evaluate("""() => {
            const st = BM.app.ctx.store.state;
            st.me.admin = true;
            const c = BM.racketcustom.customOf(st.me);
            ['frame:ice','string:white','grip:white','effect:snow',
             'frame:red','string:crimson','grip:crimson','effect:fire',
             'frame:violet','string:violet','grip:violet','effect:aurora',
             'frame:white','string:gold','grip:gold','charm:medal'].forEach(function (k) {
              if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
            });
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(900)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(2200)
        def errs(tag):
            print('  [errs]', tag, len(console_errors))
        errs('sheet open')
        print('3D ready:', pg.evaluate("() => { const a=BM.racketcustom._last3d; return a ? a.ready() : null; }"))

        def pick(slot, pid, tries=3):
            for _ in range(tries):
                pg.click('.rk3d__tab[data-rk-slot="%s"]' % slot)
                pg.wait_for_timeout(300)
                pg.click('[data-rk-part="%s:%s"]' % (slot, pid))
                pg.wait_for_timeout(800)
                cur = pg.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).%s" % slot)
                if cur == pid:
                    return True
                pg.wait_for_timeout(500)
            return False

        def setid():
            return pg.evaluate("() => { const el=document.querySelector('.rkset'); return el?el.getAttribute('data-rk-set'):''; }")

        def top():
            pg.evaluate("() => { const b=document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
            pg.wait_for_timeout(500)

        def full(on):
            pg.locator('[data-rk-full]').click()
            pg.wait_for_timeout(1400)

        # 얼음(블리자드)
        pick('frame', 'ice')
        pick('string', 'white')
        top()
        near = pg.evaluate("() => { const n=document.querySelector('[data-rk-near]'); return n? n.getAttribute('data-rk-near')+' | '+n.innerText.replace(/\\s+/g,' ') : ''; }")
        print('LIVE NEAR(2/4):', near)
        pg.evaluate("() => { const el=document.querySelector('.rkset'); if (el) el.scrollIntoView({block:'center'}); }")
        pg.wait_for_timeout(400)
        pg.locator('.rkset').screenshot(path=os.path.join(OUT, 'v196_live_near_hint.png'))
        pick('grip', 'white')
        pick('effect', 'snow')
        pg.wait_for_timeout(1200)
        errs('blizzard')
        print('LIVE ICE set:', setid())
        top()
        print('LIVE dbg:', pg.evaluate("() => { const d=BM.racketcustom._last3d.dbg(); return { rain:d.rain(), set:d.set() }; }"))
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_live_ice_rain.png'))
        full(False)

        # 불(불사조)
        for slot, pid in [('frame', 'red'), ('string', 'crimson'), ('grip', 'crimson'), ('effect', 'fire')]:
            pick(slot, pid)
        pg.wait_for_timeout(1000)
        errs('phoenix')
        print('LIVE FIRE set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_live_fire_rain.png'))
        full(False)

        # 오로라 / 챔피언 (히든)
        for slot, pid in [('frame', 'violet'), ('string', 'violet'), ('grip', 'violet'), ('effect', 'aurora')]:
            pick(slot, pid)
        pg.wait_for_timeout(900)
        errs('aurora')
        print('LIVE AURORA set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_live_aurora.png'))
        full(False)

        for slot, pid in [('frame', 'white'), ('string', 'gold'), ('grip', 'gold'), ('charm', 'medal')]:
            pick(slot, pid)
        pg.wait_for_timeout(900)
        errs('champion')
        print('LIVE CHAMPION set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_live_champion.png'))
        full(False)

        # 정타(불) 임팩트 — 정면 시점에서 정타 프레임 고정
        for slot, pid in [('frame', 'red'), ('string', 'crimson'), ('grip', 'crimson'), ('effect', 'fire')]:
            pick(slot, pid)
        pg.wait_for_timeout(800)
        top()
        pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.46; a.view.pitch=0.12; a.paint(); }")
        pg.wait_for_timeout(300)
        full(True)
        pg.wait_for_timeout(500)
        pg.evaluate("() => BM.racketcustom._last3d.hold(430, 'air')")
        pg.wait_for_timeout(400)
        errs('smash')
        print('LIVE IMPACT:', pg.evaluate("() => BM.racketcustom._last3d.dbg().impact()"))
        pg.screenshot(path=os.path.join(OUT, 'v196_live_smash_burst.png'))
        pg.evaluate("() => BM.racketcustom._last3d.resume()")
        full(False)

        # 돌릴 때 잔상
        pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.46; a.view.pitch=0.12; a.paint(); }")
        pg.wait_for_timeout(300)
        box = pg.locator('.rk3d__cv').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        pg.mouse.move(cx - 60, cy)
        pg.mouse.down()
        for i in range(16):
            pg.mouse.move(cx - 60 + i * 6, cy - (i % 3) * 6, steps=1)
            pg.wait_for_timeout(24)
        errs('spin')
        print('LIVE SPIN:', round(pg.evaluate("() => BM.racketcustom._last3d.dbg().spin()"), 3),
              'ribbon:', pg.evaluate("() => BM.racketcustom._last3d.dbg().ribbon()"))
        pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v196_live_spin_trail.png'))
        pg.mouse.up()
        pg.wait_for_timeout(900)

        # 전체화면 ESC · 가로 넘침
        full(True)
        errs('fullscreen')
        print('LIVE FULL:', pg.evaluate("() => { const el=document.querySelector('.rk3d'); const cv=el.querySelector('.rk3d__cv'); return [el.className, cv.clientWidth, cv.clientHeight]; }"))
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(800)
        print('LIVE after ESC:', pg.evaluate("() => document.querySelector('.rk3d').className"))
        print('LIVE overflow:', pg.evaluate("() => ({ docW: document.documentElement.scrollWidth, win: innerWidth })"))
        print('LIVE page errs:', pg.evaluate("() => window.__errs.slice(0,3)"))
        b.close()
    print('console errors:', len(console_errors))
    for e in console_errors[:10]:
        print('  ERR', e[:200].replace('\n', ' | '))
    print('pageerrors:', len(page_errors))
    for e in page_errors[:6]:
        print('  PAGEERR', e[:240])
    print('csp:', len(csp))
    if httpd:
        httpd.shutdown()


main()
