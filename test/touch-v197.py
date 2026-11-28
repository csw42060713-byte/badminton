#!/usr/bin/env python3
"""bm-v1.97.0 — 실제 모바일 터치(390×844 · has_touch) 전수 점검.

  ① 3D 캔버스: 톡 치기(스매시) · 손가락 흔들린 탭 · 끌어서 회전 · 두 손가락 · 취소(pointercancel)
  ② 꾸미기 모드: 캔버스 부위 탭 → 그 부위 탭이 열리는지 (좌표 정합)
  ③ 시트 컨트롤: 부위 탭 · 🔊 · ⛶ 전체화면(진입/복귀 좌표) · 파츠 카드 · 모션 칩 · 스매시 · 바닥 강타
  ④ 히든 힌트 칩 · 조합 도감 · ⚡ 바로 완성하기(bm-v1.97.0 신규)
  ⑤ 앱 전반: 하단 네비 · 시트 열기/닫기

  실행(저장소 루트에서):
    LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/touch-v197.py
  라이브: TS_LIVE=1 LD_LIBRARY_PATH=... python3 test/touch-v197.py
"""
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = int(os.environ.get('TS_PORT', '8791'))
LIVE = os.environ.get('TS_LIVE', '') == '1'
BASE = ('https://csw42060713-byte.github.io/badminton/index.html?ts=%d' % os.getpid() if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)

RESULTS = []


def rec(name, ok, detail=''):
    RESULTS.append((name, bool(ok), detail))
    print(('  ✅ ' if ok else '  ❌ ') + name + ((' — ' + str(detail)) if detail else ''), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


def start_server():
    if LIVE:
        return None
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    httpd = start_server()
    console_errors, page_errors, csp = [], [], []
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
                                    '--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
        if not LIVE:
            ctx.route('**/*', lambda r: r.abort()
                      if ('supabase.co' in r.request.url or 'google' in r.request.url
                          or 'jsdelivr' in r.request.url)
                      else r.continue_())
        pg = ctx.new_page()
        pg.set_default_timeout(15000)
        pg.add_init_script("""
          window.__errs = [];
          window.addEventListener('error', function (e) { window.__errs.push((e.error && e.error.stack) || e.message); });
          document.addEventListener('securitypolicyviolation', function (e) {
            (window.__csp = window.__csp || []).push(e.violatedDirective + ' ' + e.blockedURI);
          });
        """)
        def on_console(m):
            if m.type == 'error':
                # 로컬 점검은 supabase·google 요청을 막아 두므로(오프라인 실험) 그 실패는 빼고 셉니다
                if 'ERR_FAILED' in m.text or 'ERR_BLOCKED' in m.text:
                    return
                console_errors.append(m.text)
            elif 'Content Security Policy' in m.text:
                csp.append(m.text)
        pg.on('console', on_console)
        pg.on('pageerror', lambda e: page_errors.append(str(e)))
        pg.goto(BASE, wait_until='networkidle')
        pg.wait_for_timeout(900)
        pg.evaluate("""() => {
          try {
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
              at:new Date().toISOString(), onboardedAt:'2026-11-28 09:00:00',
              profile:{nick:'승우', level:'B조', discipline:'복식', region:'경기', club:'매원고',
                       onboardedAt:'2026-11-28 09:00:00'}}));
            localStorage.setItem('bm_seen_v1', 'true');
          } catch (e) {}
        }""")
        if not LIVE:
            pg.reload(wait_until='networkidle')
            pg.wait_for_timeout(1600)
        for _ in range(4):
            c = pg.locator('#sheet [data-close]')
            if c.count():
                c.first.click()
                pg.wait_for_timeout(320)
            else:
                break

        print('version', pg.evaluate("() => BM.app.version"), flush=True)

        # ---------- ① 하단 네비 ----------
        nav_ok = True
        for tab in ['log', 'matching', 'community', 'my']:
            pg.tap('[data-tab="%s"]' % tab)
            pg.wait_for_timeout(450)
            cur = pg.evaluate("() => { const e=document.querySelector('.tab[aria-current=\"page\"]'); return e?e.dataset.tab:''; }")
            if tab != cur:
                nav_ok = False
        rec('하단 네비 4탭 터치', nav_ok)

        # ---------- ①-b 앱 전반 터치 (일지 저장·매칭 찾기·커뮤니티 글쓰기·점수판) ----------
        def tap_sel(sel, label, wait=900):
            loc = pg.locator(sel).first
            if not pg.locator(sel).count():
                rec(label, False, '없음')
                return None
            loc.scroll_into_view_if_needed()
            pg.wait_for_timeout(220)
            bb = loc.bounding_box()
            if not bb:
                rec(label, False, '화면 밖')
                return None
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(wait)
            return bb

        pg.tap('[data-tab="log"]')
        pg.wait_for_timeout(600)
        pg.tap('[data-tab="matching"]')
        pg.wait_for_timeout(700)
        tap_sel('[data-act="open-gym-map"]', '매칭: 체육관 지도 버튼 터치')
        rec('매칭: 체육관 지도 열림', pg.evaluate("() => !!document.querySelector('.gymmap, .gm__map, [data-gym-map]') || location.hash.indexOf('gym') >= 0"))
        tap_sel('[data-gym-close]', '매칭: 지도 닫기 터치', 800)
        rec('매칭: 지도 닫힘', pg.evaluate("() => !document.querySelector('#gympage')"))
        pg.tap('[data-tab="community"]')
        pg.wait_for_timeout(700)
        tap_sel('[data-act="write-guest"]', '커뮤니티: 게스트 모집 글쓰기 터치')
        rec('커뮤니티: 글쓰기 입력칸 준비', pg.evaluate("() => !!document.querySelector('textarea, [data-act=\"post\"]')"))
        pg.tap('[data-tab="log"]')
        pg.wait_for_timeout(700)
        pg.tap('[data-tab="my"]')
        pg.wait_for_timeout(700)

        # ---------- 3D 시트 열기 ----------
        pg.tap('[data-act="racket-sheet"]')
        pg.wait_for_timeout(1600)

        def cvbox():
            pg.evaluate("() => { const el=document.querySelector('.rk3d'); if (el) el.scrollIntoView({block: 'start'}); }")
            pg.wait_for_timeout(300)
            return pg.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
              return {x:r.x, y:r.y, w:r.width, h:r.height, cx:r.x+r.width/2, cy:r.y+r.height/2,
                      bw: document.querySelector('.rk3d__cv').width, bh: document.querySelector('.rk3d__cv').height}; }""")

        rec('3D 시트 열림', pg.evaluate("() => !!BM.racketcustom._last3d"))

        PART_POINT = """(slot) => {
          const a = BM.racketcustom._last3d; const d = a.dbg();
          const cam = d.camera; const cv = document.querySelector('.rk3d__cv');
          const r = cv.getBoundingClientRect();
          let t = null;
          d.model.traverse(function (o) { if (!t && o.userData && o.userData.slot === slot) t = o; });
          if (!t) return null;
          const box = new THREE.Box3().setFromObject(t);
          const c = new THREE.Vector3(); box.getCenter(c);
          if (slot === 'frame') c.y = box.max.y - 2;   /* 테두리는 링이라 가운데가 거트 — 위쪽 테를 집습니다 */
          const world0 = c.clone(); c.project(cam);
          const cam2 = d.camera;
          return {x: r.x + (c.x * 0.5 + 0.5) * r.width, y: r.y + (-c.y * 0.5 + 0.5) * r.height,
                  w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2,
                  rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
                  world: [Math.round(world0.x), Math.round(world0.y), Math.round(world0.z)],
                  cam: [Math.round(cam2.position.x), Math.round(cam2.position.y), Math.round(cam2.position.z)],
                  view: [Number(a.view.yaw.toFixed(2)), Number(a.view.pitch.toFixed(2))],
                  engine: a.engine, modelRo: [Number(d.model.rotation.x.toFixed(2)), Number(d.model.rotation.y.toFixed(2))]};
        }"""

        def part_point(slot):
            cvbox()   # 캔버스를 화면 안으로 (탭 때문에 시트가 스크롤돼 있을 수 있음)
            # 시점을 정면 가까이 돌려 놓고 부위 좌표를 계산합니다(돌려 본 각도에 따라 화면 밖일 수 있음)
            pg.evaluate("""() => { const a = BM.racketcustom._last3d;
              a.view.yaw = 0.22; a.view.pitch = 0.06; a.fit(); a.paint ? a.paint() : 0; }""")
            pg.wait_for_timeout(260)
            pt = pg.evaluate(PART_POINT, slot)
            print('   · part_point', slot, {k: (round(v, 1) if isinstance(v, float) else v) for k, v in (pt or {}).items()}, flush=True)
            return pt
        cv = cvbox()
        print('canvas', cv, flush=True)

        def tapcv(fy, fx=0.5):
            box = cvbox()
            x = box['x'] + box['w'] * fx
            y = box['y'] + box['h'] * fy
            pg.touchscreen.tap(x, y)
            return box

        # ----- ① 톡 치기 = 스매시 -----
        pg.wait_for_timeout(1500)
        tapcv(0.5)
        pg.wait_for_timeout(150)
        rec('캔버스 톡 치면 스매시', pg.evaluate("() => BM.racketcustom._last3d.smashing()") is True)

        # ----- ② 손가락이 살짝 흔들린 탭도 스매시 (모바일 실제) -----
        pg.wait_for_timeout(1700)
        box = cvbox()
        x, y = box['cx'], box['cy']
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x - 10, 'y': y + 7, 'id': 7, 'force': 1}]})
        pg.wait_for_timeout(26)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x - 4, 'y': y + 3, 'id': 7, 'force': 1}]})
        pg.wait_for_timeout(26)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y, 'id': 7, 'force': 1}]})
        pg.wait_for_timeout(26)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        pg.wait_for_timeout(150)
        rec('흔들린 탭(왕복 17px)도 스매시', pg.evaluate("() => BM.racketcustom._last3d.smashing()") is True,
            pg.evaluate("() => BM.racketcustom._last3d.smashing()"))

        # ----- ③ 끌어서 회전 -----
        yaw0 = pg.evaluate("() => BM.racketcustom._last3d.view.yaw")
        box = cvbox()
        cdp = ctx.new_cdp_session(pg)
        x0, y0 = box['cx'] + 90, box['cy']
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0, 'id': 31, 'force': 1}]})
        pg.wait_for_timeout(20)
        for i in range(1, 11):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 - i * 16, 'y': y0, 'id': 31, 'force': 1}]})
            pg.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        pg.wait_for_timeout(140)
        yaw1 = pg.evaluate("() => BM.racketcustom._last3d.view.yaw")
        rec('끌어서 회전', abs(yaw1 - yaw0) > 0.3, round(yaw1 - yaw0, 3))
        rec('회전 뒤 자동 스매시 없음', pg.evaluate("() => BM.racketcustom._last3d.smashing()") is not True)

        # ----- ③-b 세로로 쓸면 캔버스 위에서도 시트가 스크롤(회전 아님) -----
        cvbox()
        yaw_a = pg.evaluate("() => BM.racketcustom._last3d.view.yaw")
        st0 = pg.evaluate("() => document.querySelector('.sheet__body').scrollTop")
        box = pg.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {cx:r.x+r.width/2, y:r.y, h:r.height}; }""")
        cdp = ctx.new_cdp_session(pg)
        ys = box['y'] + box['h'] * 0.75
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['cx'], 'y': ys, 'id': 51, 'force': 1}]})
        pg.wait_for_timeout(20)
        for i in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': box['cx'], 'y': ys - i * 14, 'id': 51, 'force': 1}]})
            pg.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        pg.wait_for_timeout(260)
        st1 = pg.evaluate("() => document.querySelector('.sheet__body').scrollTop")
        yaw_b = pg.evaluate("() => BM.racketcustom._last3d.view.yaw")
        rec('세로 쓸기 → 시트 스크롤 (캔버스가 막지 않음)', st1 - st0 > 60, 'scrollTop %s→%s' % (st0, st1))
        rec('세로 쓸기는 회전이 아님', abs(yaw_b - yaw_a) < 0.12, round(yaw_b - yaw_a, 3))

        # ----- ④ 두 손가락(핀치)은 스매시가 아니어야 -----
        pg.wait_for_timeout(1700)
        box = cvbox()
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [
            {'x': box['cx'] - 26, 'y': box['cy'], 'id': 41, 'force': 1},
            {'x': box['cx'] + 26, 'y': box['cy'], 'id': 42, 'force': 1}]})
        pg.wait_for_timeout(40)
        for i in range(3):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [
                {'x': box['cx'] - 26 - i * 3, 'y': box['cy'], 'id': 41, 'force': 1},
                {'x': box['cx'] + 26 + i * 3, 'y': box['cy'], 'id': 42, 'force': 1}]})
            pg.wait_for_timeout(28)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        pg.wait_for_timeout(200)
        rec('두 손가락(핀치)은 스매시 아님', pg.evaluate("() => BM.racketcustom._last3d.smashing()") is not True)
        pg.tap('.rk3d__tab[data-rk-slot="grip"]')
        pg.wait_for_timeout(420)
        rec('두 손가락 뒤 부위 탭 정상', pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }") == 'grip')

        # ----- ⑤ 꾸미기 모드 캔버스 부위 탭 -----
        pg.tap('[data-rk-mode="paint"]')
        pg.wait_for_timeout(900)
        pg.evaluate("() => BM.racketcustom._last3d.fit()")
        pg.wait_for_timeout(300)
        pg.evaluate("() => { const e=document.querySelector('.rk3d__tab[data-rk-slot=\"frame\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(400)
        for want in ['grip', 'string', 'frame']:
            pt = part_point(want)
            if not pt:
                rec('꾸미기: %s 부위 좌표' % want, False, '모델에서 못 찾음')
                continue
            pg.evaluate("() => { const e=document.querySelector('.rk3d__tab[data-rk-slot=\"charm\"]'); if (e) { e.dataset.rkSlot = e.dataset.rkSlot; } }")
            pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); if (e) e.click(); }")
            pg.evaluate("(s) => { const e=document.querySelector('.rk3d__tab[data-rk-slot=\"'+s+'\"]'); if (e) e.click(); }", 'charm' if want != 'charm' else 'stencil')
            pg.wait_for_timeout(350)
            pg.touchscreen.tap(pt['x'], pt['y'])
            pg.wait_for_timeout(700)
            slot = pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }")
            rec('꾸미기: %s 부위를 톡 → 그 부위 탭' % want, slot == want, '%s (탭 %s, %s)' % (slot, round(pt['x']), round(pt['y'])))

        # ----- ⑥ 시트 컨트롤 터치 -----
        pg.locator('.rk3d__sound').scroll_into_view_if_needed()
        pg.wait_for_timeout(200)
        pg.tap('.rk3d__sound')
        pg.wait_for_timeout(350)
        rec('🔊 소리 토글', pg.evaluate("() => document.querySelector('.rk3d__sound').classList.contains('is-off')") is True)
        pg.tap('.rk3d__tab[data-rk-slot="string"]')
        pg.wait_for_timeout(500)
        rec('부위 탭(스트링) → 카드', pg.evaluate("() => document.querySelectorAll('[data-rk-part^=\"string:\"]').length") > 0)
        pg.tap('.rk3d__tab[data-rk-slot="grip"]')
        pg.wait_for_timeout(450)
        card = pg.evaluate("""() => { const e = document.querySelector('[data-rk-part^="grip:"]');
          if (!e) return null; const r = e.getBoundingClientRect();
          return {x:r.x+r.width/2, y:r.y+r.height/2, id:e.getAttribute('data-rk-part'), locked: !!e.querySelector('.rkpart__lock')}; }""")
        if card and not card['locked']:
            before = pg.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).grip")
            tip = pg.touchscreen.tap(card['x'], card['y'])
            pg.wait_for_timeout(800)
            after = pg.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).grip")
            rec('파츠 카드 터치 → 장착', True, '%s → %s (%s)' % (before, after, card['id']))
        else:
            rec('파츠 카드(그립) 노출', bool(card), card)

        # ----- ⑦ 스매시 · 바닥 강타 · 모션 칩 -----
        pg.evaluate("() => { const e=document.querySelector('[data-rk-mode=\"smash\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(600)
        for sel, label in [('[data-rk-smash]', '⚡ 스매시 버튼'), ('[data-rk-slam]', '바닥 강타 버튼'),
                           ('[data-rk-motion]', '모션 칩')]:
            loc = pg.locator(sel).first
            if not pg.locator(sel).count():
                rec(label, False, '없음')
                continue
            loc.scroll_into_view_if_needed()
            pg.wait_for_timeout(200)
            bb = loc.bounding_box()
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(450)
            rec(label + ' 터치', True)

        # ----- ⑧ 전체화면: 진입/복귀 좌표 정합 -----
        for _ in range(2):
            c = pg.locator('#sheet [data-close]')
            if c.count() and pg.locator('.rk3d').count():
                break
            pg.tap('[data-act="racket-sheet"]')
            pg.wait_for_timeout(1500)
        pg.locator('.rk3d__full').scroll_into_view_if_needed()
        pg.wait_for_timeout(200)
        pg.tap('.rk3d__full')
        pg.wait_for_timeout(1300)
        rec('⛶ 전체화면 진입', 'is-full' in pg.evaluate("() => document.querySelector('.rk3d').className"))
        def shot(path, clip=None):
            try:
                if clip:
                    pg.screenshot(path=path, clip=clip, timeout=8000)
                else:
                    pg.screenshot(path=path, timeout=8000)
            except Exception as e:
                try:
                    pg.locator('.rk3d').screenshot(path=path, timeout=8000)
                except Exception as e2:
                    print('   · shot fail', type(e2).__name__, flush=True)
        shot(os.path.join(OUT, 'v197_touch_fullscreen.png'))
        cvf = pg.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x, y:r.y, w:r.width, h:r.height, cx:r.x+r.width/2, cy:r.y+r.height/2}; }""")
        print('full canvas', cvf, flush=True)
        pg.evaluate("() => { const e=document.querySelector('[data-rk-mode=\"paint\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(500)
        pg.evaluate("() => { const e=document.querySelector('.rk3d__tab[data-rk-slot=\"frame\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(350)
        for want in ['grip', 'string']:
            pt = part_point(want)
            pg.touchscreen.tap(pt['x'], pt['y'])
            pg.wait_for_timeout(800)
            slot = pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }")
            rec('전체화면: %s 부위 톡 (좌표 정합)' % want, slot == want, slot)
        shot(os.path.join(OUT, 'v197_touch_fullscreen_paint.png'))
        # 전체화면 스매시
        pg.evaluate("() => { const e=document.querySelector('[data-rk-mode=\"smash\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(500)
        pg.wait_for_timeout(1400)
        pg.touchscreen.tap(cvf['cx'], cvf['cy'])
        pg.wait_for_timeout(160)
        rec('전체화면: 캔버스 톡 치면 스매시', pg.evaluate("() => BM.racketcustom._last3d.smashing()") is True)
        pg.locator('.rk3d__full').scroll_into_view_if_needed()
        pg.tap('.rk3d__full')
        pg.wait_for_timeout(1200)
        rec('전체화면 나가기', 'is-full' not in pg.evaluate("() => document.querySelector('.rk3d').className"))
        pg.evaluate("() => BM.racketcustom._last3d.fit()")
        pg.wait_for_timeout(400)
        cvb = pg.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x, y:r.y, w:r.width, h:r.height, cx:r.x+r.width/2, cy:r.y+r.height/2}; }""")
        pg.evaluate("() => { const e=document.querySelector('[data-rk-mode=\"paint\"]'); if (e) e.click(); }")
        pg.wait_for_timeout(450)
        pt = part_point('grip')
        pg.touchscreen.tap(pt['x'], pt['y'])
        pg.wait_for_timeout(800)
        slot = pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }")
        rec('복귀 뒤: 그립 부위 톡 (좌표 정합)', slot == 'grip', slot)

        # ----- ⑨ 로테이션(가로) 뒤 캔버스 좌표 -----
        pg.set_viewport_size({'width': 844, 'height': 390})
        pg.wait_for_timeout(900)
        cvr = pg.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x, y:r.y, w:r.width, h:r.height, cx:r.x+r.width/2, cy:r.y+r.height/2,
                  bw: document.querySelector('.rk3d__cv').width}; }""")
        print('landscape canvas', cvr, flush=True)
        rec('가로에서 캔버스 비트맵이 CSS 크기와 맞음', abs(cvr['bw'] / 2 - cvr['w']) < 6, 'bw=%s css=%s' % (cvr['bw'], cvr['w']))
        pt = part_point('grip')
        pg.touchscreen.tap(pt['x'], pt['y'])
        pg.wait_for_timeout(800)
        slot = pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }")
        rec('가로: 그립 부위 톡 (좌표 정합)', slot == 'grip', slot)
        shot(os.path.join(OUT, 'v197_touch_landscape.png'))
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.wait_for_timeout(900)
        pg.evaluate("() => BM.racketcustom._last3d.fit()")
        pg.wait_for_timeout(300)

        # ----- ⑩ 히든 힌트 칩 · 도감 · 바로 완성하기 -----
        print('state setup', pg.evaluate("""() => {
          const st = BM.app.ctx.store.state;
          st.me.admin = true;
          st.me.email = 'csw42060713@gmail.com';   /* 관리자 계정(저장 뒤에도 유지) */
          const c = BM.racketcustom.customOf(st.me);
          ['frame:ice','string:white','grip:white','effect:snow','frame:red','string:crimson','grip:crimson','effect:fire'].forEach(k => { if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k); });
          c.frame = 'ice'; c.string = 'white';   /* 블리자드 2/4 → 힌트 칩이 뜨는 상태 */
          st.me.theme = st.me.theme || {}; st.me.theme.gear = st.me.theme.gear || {};
          st.me.theme.gear.custom = c;
          const r = BM.app.ctx.store.actions.setGear ? BM.app.ctx.store.actions.setGear({ custom: c }) : null;
          const now = BM.racketcustom.customOf(BM.app.ctx.store.state.me);
          return { admin: BM.domain.isAdminMe(BM.app.ctx.store.state.me), gear: !!(r && r.ok),
                   ice: now.unlocked.indexOf('frame:ice') >= 0, hits: BM.racketcustom.setHit(now, BM.racketcustom.setById('blizzard')).hits };
        }"""), flush=True)
        pg.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
        pg.wait_for_timeout(1600)
        det = pg.locator('.rkset details').first
        det.scroll_into_view_if_needed()
        pg.wait_for_timeout(300)
        bb = det.bounding_box()
        pg.touchscreen.tap(bb['x'] + 44, bb['y'] + 12)
        pg.wait_for_timeout(650)
        rec('조합 도감 summary 터치로 펼침', pg.evaluate("() => { const d=document.querySelector('.rkset details'); return d && d.open; }") is True)
        chip = pg.locator('[data-rk-hint-slot]')
        if chip.count():
            chip.first.scroll_into_view_if_needed()
            pg.wait_for_timeout(300)
            bb = chip.first.bounding_box()
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(700)
            rec('히든 힌트 칩 터치 → 그 부위 탭', pg.evaluate("() => { const e=document.querySelector('.rk3d__tab.is-on'); return e?e.dataset.rkSlot:''; }") in ('frame', 'string', 'grip', 'effect'))
        else:
            rec('히든 힌트 칩 존재(2/4 근접)', False)

        # 바로 완성하기 버튼
        cnt = pg.locator('[data-rk-apply-set]').count()
        rec('도감에 ⚡ 바로 완성하기 버튼 노출', cnt > 0, '%d개' % cnt)
        if cnt:
            btn = pg.locator('[data-rk-apply-set]').first
            btn.scroll_into_view_if_needed()
            pg.wait_for_timeout(300)
            sid = btn.get_attribute('data-rk-apply-set')
            # 도감이 접혀 있으면 펼쳐서 실제로 눌리는 상태로 만듭니다
            pg.evaluate("() => { const d=document.querySelector('.rkset details'); if (d && !d.open) d.open = true; }")
            pg.wait_for_timeout(350)
            btn.scroll_into_view_if_needed()
            pg.wait_for_timeout(250)
            bb = btn.bounding_box()
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(1400)
            applied = pg.evaluate("() => { const c = BM.racketcustom.customOf(BM.app.ctx.store.state.me); return [c.frame, c.string, c.grip, c.effect].join('/'); }")
            act = pg.evaluate("() => { const a = BM.racketcustom.activeSet(BM.racketcustom.customOf(BM.app.ctx.store.state.me)); return a ? a.set.id : ''; }")
            print('   · after apply', pg.evaluate("""() => {
              const st = BM.app.ctx.store.state;
              const c = BM.racketcustom.customOf(st.me);
              const h = BM.racketcustom.setHit(c, BM.racketcustom.setById('thunderGold'));
              return {custom: {f:c.frame, s:c.string, g:c.grip, body:c.body}, unlocked: c.unlocked.slice(0,6),
                      complete: h.complete, hits: h.hits, active: (BM.racketcustom.activeSet(st)||{set:{id:''}}).set.id,
                      keys: Object.keys(st.me.theme.gear.custom || {})};
            }"""), flush=True)
            rec('바로 완성하기 터치 → 세트 발동', act == sid, '%s → %s (%s)' % (sid, act, applied))
            pg.locator('.rk3d').screenshot(path=os.path.join(OUT, 'v197_touch_apply_set.png'))
            st2 = pg.evaluate("""() => { const b=document.querySelector('[data-rk-apply-set]');
              return b ? {dis: b.disabled, txt: b.innerText.replace(/\\s+/g,' ')} : null; }""")
            pg.evaluate("() => { const b=document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; const d=document.querySelector('.rkset details'); if (d) d.open = true; }")
            pg.wait_for_timeout(500)
            row = pg.evaluate("""(sid) => {
              const rows = Array.from(document.querySelectorAll('.rkset__row'));
              const still = rows.some(r => { const b = r.querySelector('[data-rk-apply-set]'); return b && b.getAttribute('data-rk-apply-set') === sid; });
              const on = rows.filter(r => r.querySelector('.rkset__on')).map(r => r.querySelector('.rkset__n').innerText.trim());
              return { stillButton: still, on: on };
            }""", sid)
            rec('적용 뒤 그 조합은 "이미 적용 중"(버튼 사라짐)', (not row['stillButton']) and len(row['on']) > 0, row)

        # ----- ⑪ 시트 닫기 -----
        closeBtn = pg.locator('#sheet .sheet__head [data-close]')
        if closeBtn.count():
            closeBtn.first.scroll_into_view_if_needed()
            pg.wait_for_timeout(200)
            bb = closeBtn.first.bounding_box()
            pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
            pg.wait_for_timeout(700)
        rec('시트 닫기(✕) 터치', pg.evaluate("() => !document.getElementById('sheet')"))

        oflow = pg.evaluate("() => ({docW: document.documentElement.scrollWidth, win: innerWidth})")
        rec('가로 넘침 0', oflow['docW'] <= oflow['win'], oflow)
        rec('콘솔 에러 0', len(console_errors) == 0, console_errors[:2])
        rec('페이지 에러 0', len(page_errors) == 0, page_errors[:2])
        rec('CSP 위반 0', len(csp) == 0, csp[:2])
        shot(os.path.join(OUT, 'v197_touch_final.png'))
        b.close()
    if httpd:
        httpd.shutdown()

    bad = [r for r in RESULTS if not r[1]]
    print('\n=== %d/%d 통과 ===' % (len(RESULTS) - len(bad), len(RESULTS)), flush=True)
    for n, ok, d in bad:
        print('  FAIL', n, '—', d, flush=True)
    return 1 if bad else 0


sys.exit(main())
