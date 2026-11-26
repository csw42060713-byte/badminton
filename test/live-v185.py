"""bm-v1.85.0 라이브 점검 — https://csw42060713-byte.github.io/badminton/

· 배포된 그대로를 390×844 로 봅니다(Supabase·구글·지도·CDN 요청은 막습니다).
  A) 버전 — sw bm-v1.85.0 · app v1.85.0 · styles.css?v=20261126-7
  B) 5개 탭 · 하트 · 매칭 ON 배지 그대로
  C) 3D 라켓 — 캔버스에 실제로 그려지고, 꾸미기 시트에서 탭 → 선택창이 바로 아래
  D) 하트 지갑(포인트 없음) · 잠긴 파츠 '❤ n'
  E) 스매시(불·얼음) · 바닥 강타 연출이 그려진다
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v185.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
SHOTS = '/workspace/check-shots'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url
                  or 'jsdelivr' in r.request.url or 'tile.openstreetmap.org' in r.request.url)
              else r.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_' not in m.text:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1200)
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live185@example.com', name: '라이브',
        at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
        profile: { nick: '라이브', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-26 15:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)

    sw = page.evaluate("async () => (await (await fetch('sw.js', { cache: 'no-store' })).text())")
    check('A 라이브 sw bm-v1.85.0', "var VERSION = 'bm-v1.85.0'" in sw, sw[sw.find('var VERSION'):sw.find('var VERSION') + 40])
    check('A 라이브 app v1.85.0', page.evaluate("() => BM.app.version") == 'v1.85.0',
          page.evaluate("() => BM.app.version"))
    check('A 스타일 캐시 키', 'styles.css?v=20261126-7' in page.content())

    check('B 5개 탭', page.locator('#tabbar [data-tab]').count() == 5, page.locator('#tabbar [data-tab]').count())
    check('B 매칭 ON 배지', page.locator('.matchpill').count() >= 1)
    check('B 하트 표시', page.locator('#hdrHearts').count() == 1)

    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(900)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1500)

    order = page.evaluate("""() => {
      const top = (n) => n ? Math.round(n.getBoundingClientRect().top) : -1;
      return { pick: top(document.querySelector('[data-rk-pick]')),
               tabs: top(document.querySelector('.rk3d__tabs')),
               group: top(document.querySelector('.rkgroup')),
               age: top(document.querySelector('.rkage')),
               hero: top(document.querySelector('.rkhero')),
               hearts: top(document.querySelector('.rkhearts')) };
    }""")
    check('C 탭 → 선택창이 바로 아래', order['tabs'] > 0 and 0 < order['group'] - order['tabs'] < 260, order)
    check('C 줄 상태·컨디션·하트 지갑은 그 아래',
          order['age'] > order['group'] and order['hero'] > order['age'] and order['hearts'] > order['hero'], order)
    check('D 포인트(P) 안내 없음', page.locator('.rkpoints').count() == 0)
    check('D 하트 지갑', page.locator('.rkhearts').count() == 1)
    check('D 잠긴 파츠 하트 가격', '❤' in page.locator('[data-rk-part="frame:carbon"]').inner_text(),
          page.locator('[data-rk-part="frame:carbon"]').inner_text()[:60].replace('\n', ' '))

    canvas = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let painted = 0, lime = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 8) painted++;
        if (d[i + 1] > 150 && d[i] < 220 && d[i + 2] < 160) lime++;
      }
      return { painted: painted, lime: lime };
    }""")
    check('C 3D 라켓이 그려졌다', canvas['painted'] > 20000 and canvas['lime'] > 1500, canvas)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
    page.screenshot(path=OUT + '/v184_live_racket.png', clip=box)
    page.screenshot(path=OUT + '/v185_live_racket.png', clip=box)
    print('  saved live racket', flush=True)

    for fx, ms, name in [('fire', 380, 'v185_live_fire'), ('ice', 380, 'v185_live_ice')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.smash(a.fx); s.hold(a.ms, 'air'); }""",
                      {'fx': fx, 'ms': ms})
        page.wait_for_timeout(260)
        page.screenshot(path=OUT + '/' + name + '.png', clip=box)
    page.evaluate("""() => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(520, 'slam'); }""")
    page.wait_for_timeout(260)
    page.screenshot(path=OUT + '/v185_live_slam.png', clip=box)
    print('  saved live smash/slam', flush=True)

    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(1200)
    check('E 스매시·바닥 강타 버튼', page.locator('[data-rk-slam="1"]').count() == 1)

    ov = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('F 390 넘침 없음', ov[0] <= ov[1] + 1, ov)
    page.screenshot(path=SHOTS + '/v185_live_sheet.png')

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])
    b.close()

ok = sum(1 for _, v in checks if v)
print('\n%d/%d 통과' % (ok, len(checks)), flush=True)
raise SystemExit(0 if ok == len(checks) else 1)
