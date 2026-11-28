#!/usr/bin/env python3
"""bm-v1.98.0 — 화면 캡처 & 점검 (390×844 · has_touch)

  ① 그립 탭의 이니셜 각인 입력줄 (기본 비움 → SW 적용 → 지우기)
  ② 파츠를 고르는 동안 3D 미리보기가 위에 남는지 (붙박이 카드) · 스크롤 튐 0
  ③ 360° 회전 · 전체화면에서도 각인이 라켓과 함께 도는지
  ④ 콘솔 에러 0 · 페이지 에러 0 · 가로 넘침 0

  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v198.py
        TS_LIVE=1 ... 라이브(깃허브 페이지)
  결과: /workspace/downloads/v198_*.png · v198_report.json
"""
import base64
import http.server
import json
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8798
LIVE = os.environ.get('TS_LIVE', '') == '1'
BASE = ('https://csw42060713-byte.github.io/badminton/index.html?c=%d' % os.getpid() if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)

errors = []
page_errors = []
checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)) if detail else ''), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


httpd = None
if not LIVE:
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    if not LIVE:
        ctx.route('**/*', lambda r: r.abort()
                  if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
                  else r.continue_())
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: page_errors.append(str(e)))

    def grab(path, clip=None):
        """CDP 로 바로 찍습니다 — 캔버스가 계속 움직여 Playwright 의 '안정될 때까지' 대기가 걸립니다"""
        args = {'format': 'png', 'captureBeyondViewport': False}
        if clip:
            args['clip'] = {'x': clip['x'], 'y': clip['y'], 'width': clip['width'], 'height': clip['height'], 'scale': 2}
        r = cdp.send('Page.captureScreenshot', args)
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('saved', os.path.basename(path), flush=True)

    def overflow():
        return pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")

    def state():
        return pg.evaluate("""() => {
          const b = document.querySelector('.sheet__body');
          const rk = document.querySelector('.rk3d');
          const cv = document.querySelector('.rk3d__cv');
          const bb = b.getBoundingClientRect();
          const cc = cv.getBoundingClientRect();
          return { top: Math.round(b.scrollTop), mini: rk.classList.contains('is-mini'),
                   rkH: Math.round(rk.getBoundingClientRect().height),
                   cvH: Math.round(cc.height), cvTop: Math.round(cc.top - bb.top), cvBottom: Math.round(cc.bottom - bb.top),
                   bodyH: Math.round(bb.height) };
        }""")

    def scroll_to(sel):
        pg.evaluate("""(s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({block: 'center'}); }""", sel)
        pg.wait_for_timeout(450)

    def tap_sel(sel):
        el = pg.locator(sel).first
        bb = el.bounding_box()
        pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(700)

    def shot_canvas(name):
        bb = pg.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
        grab(os.path.join(OUT, name + '.png'), bb)

    pg.goto(BASE, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 13:00:00',
        profile:{nick:'승우', level:'B조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 13:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    if not LIVE:
        pg.reload(wait_until='networkidle')
        pg.wait_for_timeout(1600)
    if LIVE and pg.locator('.start__guest').count():
        pg.tap('.start__guest')
        pg.wait_for_timeout(1500)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(300)
        else:
            break

    print('setup', pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.admin = true; st.me.email = 'csw42060713@gmail.com';
      const c = BM.racketcustom.customOf(st.me);
      c.initial = ''; c.grip = 'black';
      ['grip:gold','grip:ice','frame:ice','string:ice'].forEach(k => { if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k); });
      st.me.theme = st.me.theme || {}; st.me.theme.gear = st.me.theme.gear || {};
      st.me.theme.gear.custom = c;
      const r = BM.app.ctx.store.actions.setGear({ custom: c });
      return { ok: !!(r && r.ok) };
    }"""), flush=True)

    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(500)
    pg.tap('[data-act="racket-sheet"]')
    pg.wait_for_timeout(1800)
    pg.evaluate("() => { const a = BM.racketcustom._last3d; if (a && a.fit) a.fit(); }")
    pg.wait_for_timeout(400)

    s0 = state()
    print('열자마자', s0, flush=True)
    grab(os.path.join(OUT, 'v198_sheet_open.png'))
    check('열자마자 3D + 탭 줄이 한 화면에', s0['cvH'] >= 200 and s0['cvBottom'] < s0['bodyH'], s0)
    check('열자마자 가로 넘침 0', overflow() == 0, overflow())

    # ① 그립 탭 · 기본(비움) 상태
    scroll_to('.rk3d__tab[data-rk-slot="grip"]')
    tap_sel('.rk3d__tab[data-rk-slot="grip"]')
    st0 = pg.evaluate("""() => ({
      ink: !!document.querySelector('.rkink'),
      value: (document.querySelector('[data-rk-ink-input]') || {}).value || '',
      count: (document.querySelector('[data-rk-ink-count]') || {}).textContent || '',
      clearDisabled: (document.querySelector('[data-rk-ink-clear]') || {}).disabled,
      headerInk: !!document.querySelector('#hdrRacket text.rkink-t')
    })""")
    print('기본', st0, flush=True)
    check('그립 탭에 이니셜 입력줄', st0['ink'])
    check('기본은 빈 값 — 각인 없음', st0['value'] == '' and st0['headerInk'] is False and st0['clearDisabled'] is True, st0)
    scroll_to('.rkink')
    grab(os.path.join(OUT, 'v198_ink_empty.png'))
    s = state()
    check('그립 탭에서 3D 미리보기가 위에 남는다', s['mini'] and s['cvTop'] < 40 and s['cvBottom'] > 60, s)

    # ② SW 입력 → 적용
    inp = pg.locator('[data-rk-ink-input]').first
    bb = inp.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(250)
    pg.keyboard.type('SW')
    pg.wait_for_timeout(250)
    check('입력 중 글자 수 2/6', pg.evaluate("() => (document.querySelector('[data-rk-ink-count]')||{}).textContent") == '2/6')
    grab(os.path.join(OUT, 'v198_ink_typed.png'))
    before = state()
    ab = pg.locator('[data-rk-ink-apply]').first.bounding_box()
    pg.touchscreen.tap(ab['x'] + ab['width'] / 2, ab['y'] + ab['height'] / 2)
    pg.wait_for_timeout(1300)
    after = state()
    st1 = pg.evaluate("""() => {
      const c = BM.racketcustom.customOf(BM.app.ctx.store.state.me);
      const saved = ((BM.app.ctx.store.state.me.theme || {}).gear || {}).custom || {};
      return { initial: c.initial, saved: saved.initial,
               value: (document.querySelector('[data-rk-ink-input]') || {}).value || '',
               headerInk: !!document.querySelector('#hdrRacket text.rkink-t'),
               headerChars: (document.querySelector('#hdrRacket text.rkink-t') || {}).textContent || '' };
    }""")
    print('적용 뒤', st1, after, flush=True)
    check('적용 → 저장값 initial = "SW"', st1['saved'] == 'SW', st1)
    check('입력칸이 저장값으로 다시 그려진다', st1['value'] == 'SW')
    check('미니 라켓(헤더)에도 각인 글자', st1['headerInk'] and st1['headerChars'] == 'SW', st1)
    check('각인 적용 뒤 스크롤 유지 (%+d)' % (after['top'] - before['top']), abs(after['top'] - before['top']) <= 30, [before['top'], after['top']])
    grab(os.path.join(OUT, 'v198_ink_applied.png'))

    # ③ 3D 뷰로 올라가 회전·전체화면
    pg.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTo({top: 0}); }")
    pg.wait_for_timeout(700)
    s2 = state()
    check('위로 올리면 큰 3D 로 복귀', (not s2['mini']) and s2['cvH'] >= 200, s2)
    shot_canvas('v198_3d_ink_front')

    box = pg.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }")
    pg.mouse.move(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2)
    pg.mouse.down()
    for i in range(1, 7):
        pg.mouse.move(box['x'] + box['w'] / 2 + i * 18, box['y'] + box['h'] / 2)
        pg.wait_for_timeout(30)
    pg.mouse.up()
    pg.wait_for_timeout(800)
    shot_canvas('v198_3d_ink_rotated')

    pg.locator('.rk3d__full').scroll_into_view_if_needed()
    pg.wait_for_timeout(200)
    pg.tap('.rk3d__full')
    pg.wait_for_timeout(1500)
    grab(os.path.join(OUT, 'v198_3d_ink_full.png'))
    check('전체화면에서도 각인 카드가 붙박이로 남지 않는다', not pg.evaluate("() => document.querySelector('.rk3d').classList.contains('is-mini')"))
    pg.tap('.rk3d__full')
    pg.wait_for_timeout(900)

    # ④ 지우기 → 기본 그립
    scroll_to('.rk3d__tab[data-rk-slot="grip"]')
    tap_sel('.rk3d__tab[data-rk-slot="grip"]')
    scroll_to('.rkink')
    cb = pg.locator('[data-rk-ink-clear]').first.bounding_box()
    pg.touchscreen.tap(cb['x'] + cb['width'] / 2, cb['y'] + cb['height'] / 2)
    pg.wait_for_timeout(1300)
    st2 = pg.evaluate("""() => {
      const c = BM.racketcustom.customOf(BM.app.ctx.store.state.me);
      const saved = ((BM.app.ctx.store.state.me.theme || {}).gear || {}).custom || {};
      return { initial: c.initial, saved: saved.initial,
               headerInk: !!document.querySelector('#hdrRacket text.rkink-t') };
    }""")
    print('지우기', st2, flush=True)
    check('지우기 → 각인 사라짐(미니 라켓도)', st2['initial'] == '' and st2['headerInk'] is False, st2)
    grab(os.path.join(OUT, 'v198_ink_cleared.png'))

    # ⑤ 6자 제한 · 위험 문자 정리
    lim = pg.evaluate("""() => ({
      tags: BM.racketcustom.normalizeInitial('<b>SW</b>'),
      long: BM.racketcustom.normalizeInitial('ABCDEFGH'),
      kor: BM.racketcustom.normalizeInitial('  승우  '),
      ctrl: BM.racketcustom.normalizeInitial('A\\u0000B\\nC')
    })""")
    print('정리', lim, flush=True)
    check('꺾쇠·태그 문자 제거', lim['tags'] == 'bSW/b', lim['tags'])
    check('6자 초과는 잘림', lim['long'] == 'ABCDEF', lim['long'])
    check('한글·공백 정리', lim['kor'] == '승우', lim['kor'])
    check('제어문자 제거', lim['ctrl'] == 'A B C', lim['ctrl'])

    inp = pg.locator('[data-rk-ink-input]').first
    bb = inp.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(200)
    pg.keyboard.type('ABCDEFGH')
    pg.wait_for_timeout(250)
    v = pg.evaluate("() => (document.querySelector('[data-rk-ink-input]')||{}).value || ''")
    check('입력칸은 6자까지만', len(v) <= 6, v)

    # ⑥ 파츠 연속 선택 — 스크롤 튐 0 · 미리보기 유지
    scroll_to('.rk3d__tab[data-rk-slot="grip"]')
    tap_sel('.rk3d__tab[data-rk-slot="grip"]')
    jumps = []
    for pid in ['grip:gold', 'grip:ice', 'grip:black']:
        scroll_to('.rkparts [data-rk-part="%s"]' % pid)
        b1 = state()
        tap_sel('.rkparts [data-rk-part="%s"]' % pid)
        b2 = state()
        jumps.append(b2['top'] - b1['top'])
        check('%s 선택 후 스크롤 유지 (%+d)' % (pid, b2['top'] - b1['top']), b2['top'] == b1['top'], [b1['top'], b2['top']])
        check('%s 선택 중 3D 미리보기 보임' % pid, b2['mini'] and b2['cvBottom'] > 60, b2)
    grab(os.path.join(OUT, 'v198_pick_sticky.png'))

    check('가로 넘침 0', overflow() == 0, overflow())
    check('페이지 에러 0', len(page_errors) == 0, page_errors[:3])
    real = [e for e in errors if 'Failed to load resource' not in e]
    check('콘솔 에러 0', len(real) == 0, real[:3])

    json.dump({'checks': checks, 'errors': errors, 'pageErrors': page_errors}, ensure_ascii=False,
              indent=1, fp=open(os.path.join(OUT, 'v198_report.json'), 'w'))
    b.close()
if httpd:
    httpd.shutdown()
failed = [c for c in checks if not c['ok']]
print('\n%d/%d 확인 통과' % (len(checks) - len(failed), len(checks)))
raise SystemExit(1 if failed else 0)
