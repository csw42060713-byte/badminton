#!/usr/bin/env python3
"""bm-v1.102.0 2D 폴백 확인 — WebGL 을 끄고 같은 모션을 돌려 봅니다.

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/fallback-v1102.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8776


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


def main():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    fails = []

    def check(name, cond, extra=''):
        print(('  ✓ ' if cond else '  ✗ ') + name + ((' → ' + str(extra)) if extra else ''))
        if not cond:
            fails.append(name)

    console_errors, page_errors = [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers='block')
        pg = ctx.new_page()
        pg.set_default_timeout(20000)
        pg.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' else None)
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
        pg.evaluate("""() => {
            const st = BM.app.ctx.store.state;
            st.me.admin = true;
            const c = BM.racketcustom.customOf(st.me);
            c.frame = 'red'; c.string = 'crimson'; c.grip = 'crimson'; c.effect = 'none';
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(700)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1500)
        fresh = pg.evaluate("() => fetch('js/racketcustom.js?x=' + Date.now()).then(function(r){return r.text();}).then(function(t){return t.indexOf('r0 * 0.42') >= 0;})")
        print('서버 파일 최신:', fresh)
        api = pg.evaluate("() => { const a=BM.racketcustom._last3d; return [a.engine, typeof a.motion]; }")
        print('engine:', api)
        check('WebGL 없이 2D 로 떨어진다', api[0] != 'three', api)

        pg.wait_for_timeout(300)
        pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v1102_fallback_idle.png'))
        for kind, at, shot in (('flip', 1790, 'v1102_fallback_flip_land2.png'),
                               ('flip', 820, 'v1102_fallback_flip_spin.png'),
                               ('showcase', 1000, 'v1102_fallback_showcase.png')):
            pg.evaluate("(k) => BM.racketcustom._last3d.motion(k)", kind)
            pg.wait_for_timeout(60)
            pg.evaluate("(t) => { const a = BM.racketcustom._last3d; if (a.hold) a.hold(t); a.paint(); }", at)
            pg.wait_for_timeout(240)
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, shot))
            box = pg.locator('.rk3d__cv').bounding_box()
            if box:
                pg.screenshot(path=os.path.join(OUT, shot.replace('.png', '_crop.png')),
                              clip={'x': box['x'], 'y': box['y'], 'width': box['width'], 'height': box['height'] * 0.62})
            print('   mfx:', pg.evaluate("() => window.__mfx"))
            pose = pg.evaluate("(t) => { const p = BM.racketcustom.motionPose('flip', t); const ev = BM.racketcustom.motionEvents('flip'); return [Math.round(p.roll/Math.PI*100)/100, p.sq, p.imp, ev.map(function(e){return e.at;}).join('/')]; }", at)
            print('%s @%dms roll %.2fπ sq %.3f' % (kind, at, pose[0], pose[1]))

        overflow = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check('가로 넘침 0px', overflow <= 0, overflow)
        check('페이지 에러 0', len(page_errors) == 0, page_errors[:3])
        noise = [c for c in console_errors if ('403' in c or 'GSI_LOGGER' in c or 'Failed to load resource' in c)]
        real = [c for c in console_errors if c not in noise]
        check('콘솔 에러 0 (구글 로그인 잡음 %d건 제외)' % len(noise), len(real) == 0, real[:3])
        b.close()
    print('\n%s' % ('2D 폴백 통과' if not fails else ('실패 %d: %s' % (len(fails), fails))))


if __name__ == '__main__':
    main()
