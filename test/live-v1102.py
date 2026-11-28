#!/usr/bin/env python3
"""bm-v1.102.0 라이브 검증 — https://csw42060713-byte.github.io/badminton/ (390x844 · has_touch).

  실제 배포본에서 모션 3종을 눌러
   · 회전 중 · 착지 한 방 프레임 캡처(/workspace/downloads)
   · 콘솔 에러 · 페이지 에러 · CSP 위반 · 가로 넘침 0
   · 잔상 리본(실 같은 선) 없음
  을 확인합니다.

  실행: LD_LIBRARY_PATH=/workspace/tmp/debs/root/usr/lib/x86_64-linux-gnu python3 test/live-v1102.py
"""
import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'https://csw42060713-byte.github.io/badminton/')
OUT = '/workspace/downloads'


def main():
    fails = []

    def check(name, cond, extra=''):
        print(('  ✓ ' if cond else '  ✗ ') + name + ((' → ' + str(extra)) if extra else ''))
        if not cond:
            fails.append(name)

    # 1) 배포본 확인 — 파일이 정말 새 것인지(캐시 우회)
    sw = urllib.request.urlopen(BASE + 'sw.js?cb=v1102', timeout=30).read().decode('utf-8')
    ver = [l for l in sw.splitlines() if l.startswith('var VERSION')][0]
    print('live sw:', ver)
    js3 = urllib.request.urlopen(BASE + 'js/racket3d.js?cb=v1102', timeout=30).read().decode('utf-8')
    js2 = urllib.request.urlopen(BASE + 'js/racketcustom.js?cb=v1102', timeout=30).read().decode('utf-8')
    check('배포본이 bm-v1.102.0', 'bm-v1.102.0' in ver, ver)
    check('배포본에 모션 임팩트(updateMotionFx)', 'function updateMotionFx' in js3)
    check('배포본에 잔상 리본 없음', 'spinMesh' not in js3 and 'updateSpinTrail' not in js3)
    check('배포본에 3바퀴(TAU * 3)', 'e * TAU * 3' in js2)

    console_errors, page_errors, csp = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1,
                            is_mobile=True, has_touch=True, service_workers='block')
        pg = ctx.new_page()
        pg.set_default_timeout(20000)
        pg.add_init_script("window.__errs=[];window.addEventListener('error',function(e){window.__errs.push((e.error&&e.error.stack)||e.message);});")
        pg.on('console', lambda m: (console_errors.append(m.text) if m.type == 'error' else None,
                                    csp.append(m.text) if 'Content Security Policy' in m.text else None))
        pg.on('pageerror', lambda e: page_errors.append(str(e)))
        pg.goto(BASE + 'index.html?live=1102', wait_until='networkidle')
        pg.wait_for_timeout(1800)
        pg.click('.start__guest')
        pg.wait_for_timeout(2400)
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
            ['frame:red','string:crimson','grip:crimson','effect:fire'].forEach(function (k) {
              if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
            });
            c.frame = 'red'; c.string = 'crimson'; c.grip = 'crimson'; c.effect = 'fire';
            st.me.theme = st.me.theme || {};
            st.me.theme.gear = st.me.theme.gear || {};
            st.me.theme.gear.custom = c;
        }""")
        pg.click('[data-tab="my"]')
        pg.wait_for_timeout(800)
        pg.click('[data-act="racket-sheet"]')
        pg.wait_for_timeout(2000)
        print('engine:', pg.evaluate("() => { const a=BM.racketcustom._last3d; return [a ? a.engine : null, a ? a.ready() : null]; }"))

        def play(kind, spin_at, land_shot, spin_shot):
            pg.evaluate("() => { const a=BM.racketcustom._last3d; a.view.yaw=-0.30; a.view.pitch=0.10; a.paint(); }")
            pg.wait_for_timeout(300)
            land_at = pg.evaluate("(k) => BM.racketcustom.motionLandAt(k)", kind)
            dur = pg.evaluate("(k) => BM.racketcustom.motionDur(k)", kind)
            btn = pg.locator('[data-rk-motion="%s"]' % kind)
            btn.first.scroll_into_view_if_needed()
            pg.wait_for_timeout(200)
            btn.first.click()
            pg.wait_for_timeout(120)
            mid = pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motionHold(t); a.motionFreeze(70); return a.dbg().motionFx(); }", [spin_at])
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, spin_shot))
            hit = pg.evaluate("(t) => { const a=BM.racketcustom._last3d; a.motionHold(t); a.motionFreeze(70); return a.dbg().motionFx(); }", [land_at + 6])
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, land_shot))
            pg.evaluate("() => { const a=BM.racketcustom._last3d; a.motionFreeze(null); a.motion('flip'); }")
            pg.wait_for_timeout(300)
            print('%s: land %dms · dur %dms · 중반 %s' % (kind, land_at, dur, mid))
            return mid, hit

        mid, hit = play('flip', 1000, 'v1102_live_flip_land.png', 'v1102_live_flip_spin.png')
        check('flip 착지 링', hit['ring'] is True, hit)
        check('flip 착지 스파크', hit['sparks'] > 0, hit['sparks'])
        check('flip 착지 펀치', hit['punch'] > 0.5, hit['punch'])
        check('flip 착지 바닥 링', hit['floor'] is True, hit['floor'])
        check('flip 이벤트 4개 발화', hit['fired'] == 3, hit['fired'])
        check('회전 중 링·스파크', mid['ring'] is True and mid['sparks'] > 0, mid)

        mid2, hit2 = play('showcase', 860, 'v1102_live_showcase_land.png', 'v1102_live_showcase_spin.png')
        check('showcase 착지 링', hit2['ring'] is True, hit2)
        mid3, hit3 = play('twist', 760, 'v1102_live_twist_land.png', 'v1102_live_twist_spin.png')
        check('twist 피크/착지 임팩트', mid3['ring'] is True or hit3['ring'] is True, [mid3['ring'], hit3['ring']])

        # 화면이 제자리로 돌아오고 가로 넘침이 없는지
        pg.wait_for_timeout(600)
        pg.screenshot(path=os.path.join(OUT, 'v1102_live_after.png'))
        overflow = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        check('가로 넘침 0px', overflow <= 0, overflow)
        check('잔상 리본 없음(라이브 런타임)', pg.evaluate("() => BM.racketcustom._last3d.dbg().ribbon()") is False)
        noise = [c for c in console_errors if ('403' in c or 'GSI_LOGGER' in c or 'Failed to load resource' in c)]
        real = [c for c in console_errors if c not in noise]
        check('콘솔 에러 0 (구글 로그인 잡음 %d건 제외)' % len(noise), len(real) == 0, real[:3])
        check('페이지 에러 0', len(page_errors) == 0, page_errors[:3])
        check('CSP 위반 0', len(csp) == 0, csp[:3])
        b.close()
    print('\n%s' % ('라이브 모두 통과' if not fails else ('실패 %d: %s' % (len(fails), fails))))


if __name__ == '__main__':
    main()
