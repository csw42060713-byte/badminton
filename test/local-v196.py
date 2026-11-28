#!/usr/bin/env python3
"""bm-v1.96.0 로컬 실검증 (390x844).

  낙하(얼음·불) · 회전 잔상 · 정타 임팩트 · 전체화면 · 히든 근접 힌트를 실제 화면으로 확인합니다.

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/local-v196.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8770


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    console_errors, page_errors, csp = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                        is_mobile=True, has_touch=True)
        pg.set_default_timeout(15000)
        pg.add_init_script("window.__errs=[];window.addEventListener('error',function(e){window.__errs.push((e.error&&e.error.stack)||e.message);});")
        pg.on('console', lambda m: (console_errors.append(m.text) if m.type == 'error' else None,
                                    csp.append(m.text) if 'Content Security Policy' in m.text else None))
        pg.on('pageerror', lambda e: page_errors.append(str(e)))
        pg.goto('http://127.0.0.1:%d/index.html' % PORT, wait_until='networkidle')
        pg.wait_for_timeout(1000)
        pg.click('.start__guest')
        pg.wait_for_timeout(1400)
        for _ in range(3):
            c = pg.locator('#sheet [data-close]')
            if c.count():
                c.first.click()
                pg.wait_for_timeout(400)
            else:
                break
        # 체험 세션에 쓸 파츠만 열어 둡니다(기기 저장값만 — 서버 호출 없음)
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
        pg.wait_for_timeout(700)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1400)
        print('3d ready:', pg.evaluate("() => { const a=BM.racketcustom._last3d; return a ? a.ready() : null; }"))

        def pick(slot, pid, tries=3):
            for _ in range(tries):
                pg.click('.rk3d__tab[data-rk-slot="%s"]' % slot)
                pg.wait_for_timeout(260)
                pg.click('[data-rk-part="%s:%s"]' % (slot, pid))
                pg.wait_for_timeout(650)
                cur = pg.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).%s" % slot)
                if cur == pid:
                    return True
                pg.wait_for_timeout(400)
            return False

        def setid():
            return pg.evaluate("() => { const el=document.querySelector('.rkset'); return el?el.getAttribute('data-rk-set'):''; }")

        def top():
            pg.evaluate("() => { const b=document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
            pg.wait_for_timeout(420)

        def full(on):
            if os.environ.get('NOFULL'):
                return 'nofull'
            btn = pg.locator('[data-rk-full]')
            btn.click()
            pg.wait_for_timeout(1100)
            return pg.evaluate("() => document.querySelector('.rk3d').className")

        print('pick frame:ice', pick('frame', 'ice'))
        print('pick string:white', pick('string', 'white'))
        top()
        near = pg.evaluate("() => { const n=document.querySelector('[data-rk-near]'); return n? n.getAttribute('data-rk-near')+' | '+n.innerText.replace(/\\s+/g,' ') : ''; }")
        print('NEAR(2/4):', near)
        pg.evaluate("() => { const el=document.querySelector('.rkset'); if (el) el.scrollIntoView({block:'center'}); }")
        pg.wait_for_timeout(300)
        pg.locator('.rkset').screenshot(path=os.path.join(OUT, 'v196_local_near_hint.png'))
        print('pick grip:white', pick('grip', 'white'))
        print('pick effect:snow', pick('effect', 'snow'))
        pg.wait_for_timeout(900)
        print('ICE set:', setid())
        top()
        print('ICE dbg:', pg.evaluate("() => { const d=BM.racketcustom._last3d.dbg(); return { spin:d.spin(), rain:d.rain(), set:d.set() }; }"))
        pg.evaluate("() => BM.racketcustom._last3d.hold(378, 'air')")
        pg.wait_for_timeout(300)
        print('ICE impact kind:', pg.evaluate("() => BM.racketcustom._last3d.dbg().impact()"))
        pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v196_local_ice_smash.png'))
        pg.evaluate("() => BM.racketcustom._last3d.resume()")
        pg.wait_for_timeout(500)
        cls = full(True)
        print('ICE full:', cls, pg.evaluate("() => { const cv=document.querySelector('.rk3d__cv'); return [cv.clientWidth, cv.clientHeight]; }"))
        pg.wait_for_timeout(600)
        pg.screenshot(path=os.path.join(OUT, 'v196_local_fullscreen_ice.png'))
        full(False)
        pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v196_local_ice_rain.png'))

        # 불사조(불)
        for slot, pid in [('frame', 'red'), ('string', 'crimson'), ('grip', 'crimson'), ('effect', 'fire')]:
            pick(slot, pid)
        pg.wait_for_timeout(900)
        print('FIRE set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(700)
        pg.screenshot(path=os.path.join(OUT, 'v196_local_fire_rain.png'))
        full(False)

        # 돌릴 때 잔상
        pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.46; a.view.pitch=0.12; a.paint(); }")
        pg.wait_for_timeout(300)
        box = pg.locator('.rk3d__cv').bounding_box()
        cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        pg.mouse.move(cx - 90, cy)
        pg.mouse.down()
        for i in range(16):
            pg.mouse.move(cx - 60 + i * 6, cy - (i % 3) * 6, steps=1)
            pg.wait_for_timeout(24)
        spin = pg.evaluate("() => BM.racketcustom._last3d.dbg().spin()")
        pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v196_local_spin_trail.png'))
        pg.mouse.up()
        print('SPIN while dragging:', round(spin, 3), 'ribbon:', pg.evaluate("() => BM.racketcustom._last3d.dbg().ribbon()"))
        pg.wait_for_timeout(1200)
        print('SPIN idle:', round(pg.evaluate("() => BM.racketcustom._last3d.dbg().spin()"), 3))
        print('SPIN idle ribbon visible:', pg.evaluate("() => BM.racketcustom._last3d.dbg().spin() > 0.02"))

        # 공 칠 때 — 시점을 정면으로 되돌리고 정타 프레임을 잡아서(hold) 캡처
        pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.46; a.view.pitch=0.12; a.paint(); }")
        pg.wait_for_timeout(200)
        full(True)
        pg.wait_for_timeout(400)
        pg.evaluate("() => BM.racketcustom._last3d.hold(378, 'air')")
        pg.wait_for_timeout(260)
        print('IMPACT kind:', pg.evaluate("() => BM.racketcustom._last3d.dbg().impact()"))
        try:
            pg.screenshot(path=os.path.join(OUT, 'v196_local_smash_burst.png'), timeout=12000)
        except Exception as e:
            print('page shot failed, element shot:', type(e).__name__)
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v196_local_smash_burst.png'), timeout=12000)
        pg.evaluate("() => BM.racketcustom._last3d.resume()")
        full(False)

        # 히든 세트 두 가지 더 — 오로라 / 챔피언 골드
        for slot, pid in [('frame', 'violet'), ('string', 'violet'), ('grip', 'violet'), ('effect', 'aurora')]:
            pick(slot, pid)
        pg.wait_for_timeout(900)
        print('AURORA set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_local_aurora.png'))
        full(False)
        for slot, pid in [('frame', 'white'), ('string', 'gold'), ('grip', 'gold'), ('charm', 'medal')]:
            pick(slot, pid)
        pg.wait_for_timeout(900)
        print('CHAMPION set:', setid())
        top()
        full(True)
        pg.wait_for_timeout(900)
        pg.screenshot(path=os.path.join(OUT, 'v196_local_champion.png'))
        pg.evaluate("() => BM.racketcustom._last3d.hold(400, 'air')")
        pg.wait_for_timeout(300)
        print('CHAMPION impact kind:', pg.evaluate("() => BM.racketcustom._last3d.dbg().impact()"))
        pg.screenshot(path=os.path.join(OUT, 'v196_local_champion_smash.png'))
        pg.evaluate("() => BM.racketcustom._last3d.resume()")
        full(False)
        pg.wait_for_timeout(600)

        # ESC 로 전체화면 나가기
        full(True)
        pg.keyboard.press('Escape')
        pg.wait_for_timeout(700)
        print('after ESC class:', pg.evaluate("() => document.querySelector('.rk3d').className"))
        print('overflow:', pg.evaluate("() => ({ docW: document.documentElement.scrollWidth, win: innerWidth })"))
        print('page errs:', pg.evaluate("() => window.__errs.slice(0,4)"))
        b.close()
    httpd.shutdown()
    print('console errors:', len(console_errors))
    for e in console_errors[:8]:
        print('  ERR', e[:160])
    print('pageerrors:', len(page_errors))
    for e in page_errors[:8]:
        print('  PAGEERR', e[:240])
    print('csp:', len(csp))


main()
