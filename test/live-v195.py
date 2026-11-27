"""bm-v1.95.0 라이브 점검 — ⚡ 라켓 아래 오라 · 썬더 골드 전체 낙뢰 · 히든 발견이 저장되는지

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다(서버 요청은 막아 둡니다).
· 확인 순서
  A) 배포본 파일 — sw.js bm-v1.95.0 · app.js v1.95.0 · styles.css?v=20261128-1 · TWA 1.95.0/89 ·
     heart-rpc-v1.95-all.sql · test/ 는 404(공개 배포본에 테스트 없음)
  B) 5개 탭 그대로 · 꾸미기 시트에 조합 배지·도감이 뜬다 · 히든은 ??? (0/7)
  C) 골드 풀세트 → '썬더 골드 풀세트 발동!' + 3D에 번개 줄기가 켜진다 → 캡처
  D) 팬텀 라이트닝(히든) → 발견 1/7 · 축하 토스트 · 새로고침 뒤에도 발견 기록 유지 → 캡처
  E) 가로 넘침 0 · 콘솔 오류 0 · CSP 위반 0
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v195.py
"""

import os
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def get(url):
    req = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode('utf-8', 'replace')


with sync_playwright() as p:
    stamp = '?v=%d' % int(time.time())
    sw = get(BASE + 'sw.js' + stamp)
    index = get(BASE + 'index.html' + stamp)
    app = get(BASE + 'app.js' + stamp)
    twa = get(BASE + 'twa-manifest.json' + stamp)
    sql = get(BASE + 'supabase/heart-rpc-v1.95-all.sql' + stamp)
    check('A 배포본 sw.js bm-v1.95.0', "var VERSION = 'bm-v1.95.0'" in sw)
    check('A 배포본 app.js v1.95.0', "version: 'v1.95.0'" in app)
    check('A 배포본 styles.css?v=20261128-1', 'styles.css?v=20261128-1' in index)
    check('A 배포본 TWA 1.95.0 · 89', '"appVersionName": "1.95.0"' in twa and '"appVersionCode": 89' in twa)
    check('A 배포본 heart-rpc-v1.95-all.sql', 'bm_racket_price' in sql and "'grip:gold'" in sql)
    try:
        get(BASE + 'test/v195.test.js' + stamp)
        check('A test/ 는 배포본에 없다', False, '내려받아짐')
    except Exception:
        check('A test/ 는 배포본에 없다', True)

    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'accounts.google' in r.request.url
                  or 'jsdelivr' in r.request.url)
              else r.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:200])
            return
        if 'ERR_FAILED' in m.text or 'ERR_ABORTED' in m.text or 'Failed to load resource' in m.text:
            return
        errs.append(m.text[:200])

    page.on('console', on_console)

    page.goto(BASE + 'index.html?l=' + str(int(time.time())), wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(6):
        if not page.query_selector('#sheet.is-on .sheet__panel .btn--primary'):
            break
        page.click('#sheet.is-on .sheet__panel .btn--primary')
        page.wait_for_timeout(350)

    check('A 앱 버전 v1.95.0', page.evaluate("() => BM.app.version") == 'v1.95.0',
          page.evaluate("() => BM.app.version"))
    check('B 5개 탭 그대로', page.evaluate("() => BM.app.TABS.map(t => t.id)") ==
          ['log', 'matching', 'community', 'coach', 'my'])

    # ── B. 꾸미기 시트 · 배지 ──
    page.click('#hdrRacket')
    page.wait_for_timeout(1600)
    check('B 조합 배지 · 도감', page.locator('[data-rk-set]').count() > 0 and page.locator('.rkset__book').count() > 0)
    badge = page.evaluate("() => document.querySelector('.rkset').innerText")
    check('B 히든 0/7 발견', '히든 0/7 발견' in badge, badge[:80])

    def wear(parts):
        page.evaluate("""(parts) => {
          const RC = BM.racketcustom, ctx = BM.app.ctx;
          const c = RC.customOf(ctx.store.state.me);
          parts.forEach(k => {
            if (c.unlocked.indexOf(k) < 0) c.unlocked.push(k);
            const cut = k.indexOf(':');
            c[cut < 0 ? k : k.slice(0, cut)] = k.slice(cut + 1);
          });
          const r = ctx.actions.setGear({ custom: RC.normalizeCustom(c) });
          if (BM.racketcustom.openSheet) return r && r.ok;
          return r && r.ok;
        }""", parts)
        page.wait_for_timeout(900)

    # ── C. 골드 풀세트 = 전체 낙뢰 ──
    wear(['frame:gold', 'string:gold', 'grip:gold'])
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.click('#hdrRacket')
    page.wait_for_timeout(1400)
    body = page.evaluate("() => document.querySelector('.rkset').innerText")
    check('C 썬더 골드 풀세트 발동', '썬더 골드 풀세트 발동' in body, body[:80])
    check('C 전체 낙뢰', '전체 낙뢰' in body)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
    page.evaluate("() => BM.racketcustom._last3d.setburst('thunderGold', 25000)")
    page.wait_for_timeout(200)
    lit = page.evaluate("""() => {
      let n = 0;
      BM.racketcustom._last3d.dbg().scene.traverse(o => { if (o.isLineSegments && o.material.opacity > 0.2) n++; });
      return n;
    }""")
    check('C 번개 줄기가 켜져 있다', lit >= 5, {'lit': lit})
    page.locator('.rk3d').first.screenshot(path=os.path.join(OUT, 'v195_live_aura_gold.png'))
    page.locator('.rkset').first.screenshot(path=os.path.join(OUT, 'v195_live_set_badge.png'))

    # ── D. 히든 — 팬텀 라이트닝 ──
    wear(['frame:onyx', 'string:black', 'grip:violet', 'effect:void'])
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.click('#hdrRacket')
    page.wait_for_timeout(1500)
    body2 = page.evaluate("() => document.querySelector('.rkset').innerText")
    check('D 팬텀 라이트닝 발동', '팬텀 라이트닝' in body2, body2[:100])
    check('D 히든 1/7 발견', '히든 1/7 발견' in body2)
    found = page.evaluate("() => BM.racketcustom.foundOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me))")
    check('D 발견 기록 저장', found == ['phantom'], found)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
    page.evaluate("() => BM.racketcustom._last3d.setburst('phantom', 25000)")
    page.wait_for_timeout(180)
    page.locator('.rk3d').first.screenshot(path=os.path.join(OUT, 'v195_live_hidden_phantom.png'))
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 360; }")
    page.wait_for_timeout(350)
    page.locator('.rkset').first.screenshot(path=os.path.join(OUT, 'v195_live_hidden_badge.png'))

    # 새로고침 뒤에도 발견·장착 유지
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    kept = page.evaluate("""() => {
      const RC = BM.racketcustom, c = RC.customOf(BM.app.ctx.store.state.me);
      return { found: RC.foundOf(c), frame: c.frame, grip: c.grip, effect: c.effect };
    }""")
    check('D 새로고침 뒤에도 발견 유지', kept.get('found') == ['phantom'], kept)
    check('D 새로고침 뒤에도 장착 유지', kept.get('frame') == 'onyx' and kept.get('effect') == 'void', kept)

    # ── E. 넘침 · 오류 ──
    ov = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('E 390 가로 넘침 없음', ov[0] <= ov[1], ov)
    check('E 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과 · 실패 %d' % (len(checks) - len(fails), len(checks), len(fails)))
