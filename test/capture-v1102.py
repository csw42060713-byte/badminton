#!/usr/bin/env python3
"""bm-v1.102.0 라켓 돌리기 클로즈업 캡처 (390x844 · dsf 2).

  회전 중 · 착지 한 방을 고정해 2배 해상도로 저장합니다(눈으로 확인용).

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/capture-v1102.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8773


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        pg = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True)
        pg.set_default_timeout(20000)
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
        pg.evaluate("""() => {
            const st = BM.app.ctx.store.state;
            st.me.admin = true;
            const c = BM.racketcustom.customOf(st.me);
            ['frame:white','string:white','grip:white','effect:none','frame:red','string:crimson','grip:crimson','effect:fire'].forEach(function (k) {
              if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
            });
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(700)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1600)

        def look(effect, frame):
            pg.evaluate("""(f) => {
                const st = BM.app.ctx.store.state;
                const c = BM.racketcustom.customOf(st.me);
                c.effect = f[0]; c.frame = f[1]; c.string = f[1]; c.grip = f[1];
                st.me.theme = st.me.theme || {};
                st.me.theme.gear = st.me.theme.gear || {};
                st.me.theme.gear.custom = c;
                if (BM.racketcustom._last3d) BM.racketcustom._last3d.paint();
            }""", [effect, frame])
            pg.wait_for_timeout(900)

        def shot(kind, hold_at, freeze, name, cls='rk3d'):
            pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.30; a.view.pitch=0.10; a.paint(); }")
            pg.wait_for_timeout(300)
            pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motion(t[0]); a.motionHold(t[1]); a.motionFreeze(t[2]); }",
                        [kind, hold_at, freeze])
            pg.wait_for_timeout(320)
            pg.locator('.' + cls).screenshot(path=os.path.join(OUT, name))
            print('saved', name, pg.evaluate("() => BM.racketcustom._last3d.dbg().motionFx()"))

        # 기본(효과 없음) — 임팩트만 또렷하게 보이도록
        look('none', 'white')
        shot('flip', 1000, 60, 'v1102_close_flip_spin_plain.png')
        shot('flip', 1725, 60, 'v1102_close_flip_land_plain.png')
        shot('flip', 1725, 150, 'v1102_close_flip_land_wide_plain.png')
        # 불 효과 — 테마 색이 어우러지는지
        look('fire', 'red')
        shot('flip', 1725, 60, 'v1102_close_flip_land_fire.png')
        shot('showcase', 1500, 60, 'v1102_close_showcase_land_fire.png')
        b.close()


if __name__ == '__main__':
    main()
