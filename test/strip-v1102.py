#!/usr/bin/env python3
"""bm-v1.102.0 flip 회전 진행 확인 — 6 프레임을 한 장에 이어 붙입니다.

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/strip-v1102.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8775


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
        pg = b.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg.set_default_timeout(20000)
        pg.goto('http://127.0.0.1:%d/index.html' % PORT, wait_until='networkidle')
        pg.wait_for_timeout(1000)
        pg.click('.start__guest')
        pg.wait_for_timeout(1500)
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
            c.frame = 'white'; c.string = 'white'; c.grip = 'white'; c.effect = 'none';
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(700)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1600)
        pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.28; a.view.pitch=0.08; a.paint(); }")
        pg.wait_for_timeout(300)
        paths = []
        for ms in (200, 520, 820, 1120, 1420, 1740):
            pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motion('flip'); a.motionHold(t); a.motionFreeze(70); }", ms)
            pg.wait_for_timeout(260)
            f = os.path.join(OUT, 'v1102_flip_%04d.png' % ms)
            pg.locator('.rk3d').screenshot(path=f)
            roll = pg.evaluate("(t) => { const p=BM.racketcustom.motionPose('flip', t); return [Math.round(p.roll/Math.PI*100)/100, Math.round(p.yaw*100)/100, Math.round(p.dy*10)/10]; }", ms)
            print('%4dms roll %.2fπ yaw %.2f dy %.1f' % (ms, roll[0], roll[1], roll[2]))
            paths.append(f)
        b.close()
    # 이어 붙이기 (PIL)
    from PIL import Image
    ims = [Image.open(p) for p in paths]
    w, h = ims[0].size
    sheet = Image.new('RGB', (w * 3, h * 2))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 3) * w, (i // 3) * h))
    out = os.path.join(OUT, 'v1102_flip_strip.png')
    sheet.save(out)
    print('saved', out)


if __name__ == '__main__':
    main()
