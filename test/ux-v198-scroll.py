#!/usr/bin/env python3
"""bm-v1.98.0 — 꾸미기 시트 스크롤·미리보기 동선 점검 (390×844 · has_touch)

  · 그립/프레임/스트링/효과 파츠를 연속으로 눌렀을 때 .sheet__body.scrollTop 이
    튀지 않는지(누른 자리에 그대로 있는지) 전후 값을 찍습니다.
  · 파츠를 고르는 동안 3D 미리보기(붙박이 카드)가 화면 위에 남는지 확인합니다.
  · 시트를 다시 그려도(탭 이동) 탭 줄이 화면에서 같은 자리에 있는지 확인합니다.
  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/ux-v198-scroll.py
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
PORT = 8791
checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)) if detail else ''), flush=True)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:%d/index.html' % PORT, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우', at:new Date().toISOString(), onboardedAt:'2026-11-28 13:00:00', profile:{nick:'승우', level:'B조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 13:00:00'}}));
      localStorage.setItem('bm_seen_v1','true');
    }""")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(1600)
    print(pg.evaluate("""() => {
      const st = BM.app.ctx.store.state; st.me.admin = true; st.me.email = 'csw42060713@gmail.com';
      const c = BM.racketcustom.customOf(st.me);
      ['frame:gold','string:gold','grip:gold','effect:fire','frame:ice','string:ice','grip:ice']
        .forEach(k => { if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k); });
      st.me.theme = st.me.theme || {}; st.me.theme.gear = st.me.theme.gear || {};
      st.me.theme.gear.custom = c;
      BM.app.ctx.store.actions.setGear({ custom: c });
      return { ok: true };
    }"""))
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(500)
    pg.tap('[data-act="racket-sheet"]')
    pg.wait_for_timeout(1900)

    def state():
        return pg.evaluate("""() => {
          const b = document.querySelector('.sheet__body');
          const rk = document.querySelector('.rk3d');
          const cv = document.querySelector('.rk3d__cv');
          const tabs = document.querySelector('.rk3d__tabs');
          const bb = b.getBoundingClientRect();
          const rc = rk.getBoundingClientRect();
          const cc = cv.getBoundingClientRect();
          const tc = tabs.getBoundingClientRect();
          return { top: Math.round(b.scrollTop), max: Math.round(b.scrollHeight - b.clientHeight),
                   mini: rk.classList.contains('is-mini'), pinned: rk.style.height || '',
                   rkH: Math.round(rc.height), cardTop: Math.round(rc.top - bb.top), cardBottom: Math.round(rc.bottom - bb.top),
                   cvH: Math.round(cc.height), cvTop: Math.round(cc.top - bb.top), cvBottom: Math.round(cc.bottom - bb.top),
                   tabsTop: Math.round(tc.top - bb.top), bodyH: Math.round(bb.height) };
        }""")

    def scroll_to(sel, block='center'):
        pg.evaluate("""(a) => { const el = document.querySelector(a[0]); if (el) el.scrollIntoView({block: a[1]}); }""", [sel, block])
        pg.wait_for_timeout(550)

    def tap_sel(sel):
        el = pg.locator(sel).first
        bb = el.bounding_box()
        pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
        pg.wait_for_timeout(800)

    def shot(name):
        r = cdp.send('Page.captureScreenshot', {'format': 'png'})
        open(os.path.join(OUT, name + '.png'), 'wb').write(base64.b64decode(r['data']))
        print('saved', name, flush=True)

    s0 = state()
    print('열자마자', s0, flush=True)
    shot('ux198_00_open')
    check('열자마자 탭 줄이 첫 화면 안에 보인다', s0['tabsTop'] < s0['bodyH'] - 60, s0['tabsTop'])

    # 그립 탭 → 그립 파츠 5줄을 훑으며 연속 선택
    scroll_to('.rk3d__tab[data-rk-slot="grip"]')
    tap_sel('.rk3d__tab[data-rk-slot="grip"]')
    s = state()
    print('그립탭', s, flush=True)
    shot('ux198_01_grip_tab')
    check('그립 탭을 누르면 3D 미리보기가 위에 붙는다', s['mini'], s)
    check('붙박이 카드의 3D(176px)가 화면 위쪽에 보인다', 0 <= s['cvTop'] < 40 and s['cvH'] == 176, s)

    picked = []
    for pid in ['grip:neon', 'grip:mint', 'grip:coral', 'grip:purple', 'grip:gold', 'grip:ice']:
        scroll_to('.rkparts [data-rk-part="%s"]' % pid)
        before = state()
        tap_sel('.rkparts [data-rk-part="%s"]' % pid)
        after = state()
        picked.append({'id': pid, 'before': before['top'], 'after': after['top'],
                       'jump': after['top'] - before['top'], 'mini': after['mini'],
                       'cvTop': after['cvTop'], 'cvBottom': after['cvBottom']})
        check('%s 선택 후 스크롤 유지 (점프 %+d)' % (pid, after['top'] - before['top']),
              after['top'] == before['top'], after['top'])
        check('%s 선택 중에도 3D 미리보기 보임' % pid,
              after['mini'] and after['cvTop'] < 40 and after['cvBottom'] > 60, after)
    shot('ux198_02_grip_after_picks')
    print('grip picks', json.dumps(picked, ensure_ascii=False), flush=True)

    # 프레임·스트링·효과도 같은 동선
    for slot, pid in [('frame', 'frame:ice'), ('string', 'string:ice'), ('effect', 'effect:fire')]:
        scroll_to('.rk3d__tab[data-rk-slot="%s"]' % slot)
        before_tab = state()
        tap_sel('.rk3d__tab[data-rk-slot="%s"]' % slot)
        after_tab = state()
        check('%s 탭 전환 뒤 탭 줄이 같은 자리 (%+dpx)' % (slot, after_tab['tabsTop'] - before_tab['tabsTop']),
              abs(after_tab['tabsTop'] - before_tab['tabsTop']) <= 8, after_tab['tabsTop'])
        scroll_to('.rkparts [data-rk-part="%s"]' % pid)
        before = state()
        tap_sel('.rkparts [data-rk-part="%s"]' % pid)
        after = state()
        check('%s 선택 후 스크롤 유지 (%+d)' % (pid, after['top'] - before['top']), after['top'] == before['top'], after['top'])
        check('%s 선택 중 3D 보임' % pid, after['mini'] and after['cvBottom'] > 60, after)
    shot('ux198_03_effect_after_picks')

    # 위로 올리면 큰 3D 로 복귀 + 높이 그대로(튐 없음)
    before = state()
    pg.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTo({top: 0}); }")
    pg.wait_for_timeout(700)
    after = state()
    print('위로 복귀', after, flush=True)
    check('위로 올리면 붙박이 해제 + 큰 카드 복귀', (not after['mini']) and after['cvH'] > 200 and after['rkH'] > 400, after)
    check('카드 높이가 원래대로(눌림 없음)', after['rkH'] == before['rkH'] if before['mini'] else True, [before['rkH'], after['rkH']])
    shot('ux198_04_back_to_top')

    # 이니셜 각인도 스크롤 유지
    scroll_to('.rk3d__tab[data-rk-slot="grip"]')
    tap_sel('.rk3d__tab[data-rk-slot="grip"]')
    scroll_to('.rkink')
    before = state()
    inp = pg.locator('[data-rk-ink-input]').first
    bb = inp.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(200)
    pg.keyboard.type('SW')
    pg.wait_for_timeout(200)
    ab = pg.locator('[data-rk-ink-apply]').first.bounding_box()
    pg.touchscreen.tap(ab['x'] + ab['width'] / 2, ab['y'] + ab['height'] / 2)
    pg.wait_for_timeout(1200)
    after = state()
    check('각인 적용 뒤 스크롤 유지 (%+d)' % (after['top'] - before['top']),
          abs(after['top'] - before['top']) <= 40, [before['top'], after['top']])
    check('각인 적용 중 3D 보임', after['mini'] and after['cvBottom'] > 60, after)
    shot('ux198_05_ink_after_apply')

    ov = pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check('가로 넘침 0', ov == 0, ov)
    check('콘솔 에러 0(리소스 차단 제외)', len([e for e in errors if 'Failed to load resource' not in e]) == 0, errors[:3])
    json.dump(checks, open(os.path.join(OUT, 'ux198_checks.json'), 'w'), ensure_ascii=False, indent=1)
    b.close()
httpd.shutdown()
failed = [c for c in checks if not c['ok']]
print('\n%d/%d 확인 통과' % (len(checks) - len(failed), len(checks)))
raise SystemExit(1 if failed else 0)
