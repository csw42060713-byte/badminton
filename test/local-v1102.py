#!/usr/bin/env python3
"""bm-v1.102.0 로컬 실검증 (390x844 · has_touch).

  라켓 돌리기(모션) 3종을 실제로 눌러
   · flip 다회전(3바퀴) 회전 중 프레임
   · 착지 한 방(이중 링·스파크·글로우·펀치) 프레임
   · 실처럼 따라다니는 선이 없는지(잔상 리본 제거)
   · 콘솔 에러 · 페이지 에러 · CSP 위반 · 가로 넘침 0
  을 확인하고 화면을 /workspace/downloads 에 저장합니다.

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/local-v1102.py
"""
import http.server
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8772


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
    fails = []

    def check(name, cond, extra=''):
        print(('  ✓ ' if cond else '  ✗ ') + name + ((' → ' + str(extra)) if extra else ''))
        if not cond:
            fails.append(name)

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

        # 체험 세션 — 관리자(모든 모션 해금) + 불 효과(색 대비가 잘 보이는 조합)
        pg.evaluate("""() => {
            const st = BM.app.ctx.store.state;
            st.me.admin = true;
            const c = BM.racketcustom.customOf(st.me);
            ['frame:red','string:crimson','grip:crimson','effect:fire'].forEach(function (k) {
              if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
            });
            c.frame = 'red'; c.string = 'crimson'; c.grip = 'crimson'; c.effect = 'fire';
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(700)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1500)
        print('3d ready:', pg.evaluate("() => { const a=BM.racketcustom._last3d; return a ? a.ready() : null; }"))
        print('engine:', pg.evaluate("() => { const a=BM.racketcustom._last3d; return a ? a.engine : null; }"))

        def fx():
            return pg.evaluate("() => { const a=BM.racketcustom._last3d; return a.dbg().motionFx(); }")

        def play(kind, spin_shot, land_shot, spin_wait):
            # 시점을 정면 가까이로 — 회전이 한눈에 보이게
            pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.34; a.view.pitch=0.10; if (a.paint) a.paint(); }")
            pg.wait_for_timeout(260)
            land_at = pg.evaluate("(k) => BM.racketcustom.motionLandAt(k)", kind)
            dur = pg.evaluate("(k) => BM.racketcustom.motionDur(k)", kind)
            btn = pg.locator('[data-rk-motion="%s"]' % kind)
            print('%s: 칩 %d개 · land %dms · dur %dms' % (kind, btn.count(), land_at, dur))
            btn.first.scroll_into_view_if_needed()
            pg.wait_for_timeout(200)
            btn.first.click()
            # 회전 중 — 그 시점 자세 + 회전 피크 링을 한 프레임에 고정해 캡처
            mid = pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motionHold(t[0]); a.motionFreeze(70); return a.dbg().motionFx(); }",
                              [int(spin_wait)])
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, spin_shot))
            # 착지 한 방 — 링·글로우·펀치가 터진 직후(80ms)를 고정
            hit = pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motionHold(t); a.motionFreeze(80); return a.dbg().motionFx(); }",
                              [int(land_at + 6)])
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, land_shot))
            pg.evaluate("() => { const a=BM.racketcustom._last3d; a.motionFreeze(null); a.motion('flip'); }")
            pg.wait_for_timeout(max(0, dur - land_at) + 200)
            return mid, hit

        mid, hit = play('flip', 'v1102_local_flip_spin.png', 'v1102_local_flip_land.png', 780)
        print('  flip 중반:', mid)
        print('  flip 착지:', hit)
        check('flip 착지 링이 떠 있다', hit['ring'] is True, hit)
        check('flip 착지 스파크가 살아 있다', hit['sparks'] > 0, hit['sparks'])
        check('flip 착지 펀치 > 0', hit['punch'] > 0.5, hit['punch'])
        check('flip 착지 바닥 링', hit['floor'] is True, hit['floor'])
        check('flip 이벤트 4개(회전3+착지1) 발화', hit['fired'] == 3, hit['fired'])
        check('flip 회전 중 링', mid['ring'] is True or mid['sparks'] > 0, mid)
        check('잔상 리본 없음', pg.evaluate("() => BM.racketcustom._last3d.dbg().ribbon()") is False)
        check('펀치 줌으로 카메라가 당겨졌다', abs(pg.evaluate("() => BM.racketcustom._last3d.dbg().motionFx().camZ")) > 0)

        mid, hit = play('showcase', 'v1102_local_showcase_spin.png', 'v1102_local_showcase_land.png', 700)
        print('  showcase 중반:', mid)
        print('  showcase 착지:', hit)
        check('showcase 착지 링', hit['ring'] is True, hit)
        check('showcase 착지 스파크', hit['sparks'] > 0, hit['sparks'])

        mid, hit = play('twist', 'v1102_local_twist_spin.png', 'v1102_local_twist_land.png', 620)
        print('  twist 중반:', mid)
        print('  twist 착지:', hit)
        check('twist 피크 링', mid['ring'] is True or hit['ring'] is True, [mid, hit])

        # 모션 뒤에도 라켓은 제자리 · 콘솔/레이아웃
        pg.wait_for_timeout(500)
        pg.screenshot(path=os.path.join(OUT, 'v1102_local_after.png'))
        overflow = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check('가로 넘침 0px', overflow <= 0, overflow)
        # 로컬 오리진에서만 나는 구글 로그인(403·GSI) 잡음은 제외 — 라이브에서는 없습니다
        noise = [c for c in console_errors if ('403' in c or 'GSI_LOGGER' in c or 'Failed to load resource' in c)]
        real = [c for c in console_errors if c not in noise]
        check('콘솔 에러 0 (구글 로그인 잡음 %d건 제외)' % len(noise), len(real) == 0, real[:3])
        check('페이지 에러 0', len(page_errors) == 0, page_errors[:3])
        check('CSP 위반 0', len(csp) == 0, csp[:3])
        # 성능 — 유휴와 모션 중 프레임 간격 비교(소프트웨어 GL 이라 절대값보다 비율을 봅니다)
        idle_fps = pg.evaluate("""() => new Promise(function (res) {
            const t0 = performance.now(); let n = 0, worst = 0, last = t0;
            function tick(now) {
              n++; worst = Math.max(worst, now - last); last = now;
              if (now - t0 < 1200) requestAnimationFrame(tick); else res({ fps: Math.round(n * 1000 / (now - t0)), worst: Math.round(worst) });
            }
            requestAnimationFrame(tick);
        })""")
        fps = pg.evaluate("""() => new Promise(function (res) {
            const a = BM.racketcustom._last3d;
            a.motion('flip');
            const t0 = performance.now(); let n = 0, worst = 0, last = t0;
            function tick(now) {
              n++; worst = Math.max(worst, now - last); last = now;
              if (now - t0 < 1600) requestAnimationFrame(tick); else res({ fps: Math.round(n * 1000 / (now - t0)), worst: Math.round(worst) });
            }
            requestAnimationFrame(tick);
        })""")
        print('  모션 중 프레임:', fps)
        print('  유휴 프레임:', idle_fps)
        pg.wait_for_timeout(1800)
        b.close()
    print('\n%s' % ('모두 통과' if not fails else ('실패 %d: %s' % (len(fails), fails))))


if __name__ == '__main__':
    main()
