"""bm-v1.82.0 라이브 점검 (390×844) — 🗺️ 지도 길찾기 · 매칭 ON 배지 · 라켓 창 초기화 · 터치 불꽃 스매시

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글 로그인 스크립트는 막고 기기 저장(local) 모드로 화면을 봅니다. 지도 타일은 실제로 받습니다)
  A) 버전 — sw.js bm-v1.82.0 · app.js v1.82.0 · styles.css?v=20261126-4 · TWA 1.82.0/76 · 5개 탭
  B) 배지 — 헤더 '매칭 ON' 글자 배지 (작은 점 없음)
  C) 지도 — 검색 후보 → 지도 이동 · 경로선 · 길찾기 카드(방위·거리·도보/차량/대중교통) · 네이버/카카오/구글 링크 · 내 위치(GPS)
  D) 기록 — 라켓·스트링 값 저장 → 닫기 → 재오픈에도 그대로
  E) 스매시 — 3D에서 불꽃 연출이 실제로 그려지고, 효과 탭에 하트 이펙트(❤2·❤3)
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v182.py
"""

import base64
import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V182_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V182_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def read(path):
    sep = '&' if '?' in path else '?'
    with urllib.request.urlopen(BASE + path + sep + 'cb=v182', timeout=30) as r:
        return r.read().decode('utf-8')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True,
                              geolocation={'latitude': 37.2455, 'longitude': 127.0565, 'accuracy': 25},
                              permissions=['geolocation'])
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'accounts.google.com' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def tap(sel, wait=500):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def shot(name, keep=False):
        path = SHOTS + '/live182_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v182_live_' + name + '.png')
        return path

    def canvas_shot(name):
        data = page.evaluate("() => document.querySelector('.rk3d__cv').toDataURL('image/png')")
        path = OUT + '/v182_live_' + name + '.png'
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data.split(',', 1)[1]))
        print('  saved ' + path, flush=True)
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    def login(nick='승우'):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'live182@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(3000)

    # ── A. 라이브 파일 · 버전 ──
    check('A 라이브 sw.js bm-v1.82.0', "var VERSION = 'bm-v1.82.0'" in read('sw.js'))
    check('A 라이브 index styles.css?v=20261126-4', 'styles.css?v=20261126-4' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A 라이브 TWA 1.82.0 · 76', '"appVersionName": "1.82.0"' in twa and '"appVersionCode": 76' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1800)
    login('승우')
    check('A 앱 버전 v1.82.0', page.evaluate("() => BM.app.version") == 'v1.82.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 배지 ──
    check('B 헤더 매칭 ON 글자 배지', has('#matchPill') and '매칭' in text_of('#matchPill'), text_of('#matchPill'))
    check('B 작은 동기화 점 없음', page.evaluate("() => !document.getElementById('syncDot')"))
    shot('header', keep=True)

    # ── C. 지도 길찾기 ──
    page.evaluate("() => BM.views.gyms.open(BM.app.ctx)")
    page.wait_for_timeout(2600)
    check('C 지도가 실제 Leaflet으로 뜬다', page.evaluate("() => !!document.querySelector('.leaflet-container')"))
    check('C 내 위치(GPS) 버튼', has('.gymgps'))
    page.fill('[data-gym-search]', '나래울')
    page.wait_for_timeout(800)
    check('C 검색 후보가 바로 뜬다', count('.gymsug__row') >= 1, count('.gymsug__row'))
    page.locator('.gymsug__row').first.click()
    page.wait_for_timeout(1500)
    card = text_of('.gymroute')
    check('C 길찾기 카드에 방위·거리', ('쪽' in card) and ('km' in card or 'm' in card), card[:140])
    check('C 도보·차량·대중교통 시간', '도보' in card and '차량' in card and '대중교통' in card, card[:200])
    href = page.evaluate("() => document.querySelector('.gymroute__go').getAttribute('href')")
    check('C 큰 길찾기 = 네이버 지도', href.startswith('https://map.naver.com/p/directions/'), href)
    check('C 카카오·구글 링크', count('.gymroute__apps a') == 3)
    check('C 지도 위 경로선·방향 화살표',
          page.evaluate("() => document.querySelectorAll('.leaflet-overlay-pane path, .gyroute-arrow').length") >= 1)
    shot('map_route', keep=True)
    page.locator('.gymgps').first.click()
    page.wait_for_timeout(2000)
    check('C GPS 뒤 내 위치 기준', '내 위치' in text_of('.gymroute'), text_of('.gymroute')[:160])
    shot('map_gps', keep=True)
    page.evaluate("() => BM.views.gyms.close()")
    page.wait_for_timeout(600)

    # ── D. 라켓 창 재오픈 유지 ──
    page.locator('[data-tab="my"]').first.click()
    page.wait_for_timeout(900)
    open_gear = "() => BM.gear.openSheet(BM.app.ctx)"
    page.evaluate(open_gear)
    page.wait_for_timeout(700)
    page.fill('[data-gear="racket"]', '아크세이버 11')
    page.click('[data-gear-pick="string"][data-value="BG80"]')
    page.click('[data-gear-pick="tension"][data-value="27"]')
    page.click('[data-gear-today]')
    page.wait_for_timeout(300)
    page.click('[data-gear-save]')
    page.wait_for_timeout(1400)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(500)
    page.evaluate("() => BM.app.ctx.store.actions.setTheme('th_def')")
    page.wait_for_timeout(900)
    page.evaluate(open_gear)
    page.wait_for_timeout(700)
    vals = page.evaluate("""() => {
      const q = s => { const n = document.querySelector(s); return n ? n.value : null; };
      return [q('[data-gear="racket"]'), q('[data-gear="string"]'), q('[data-gear="tension"]')];
    }""")
    check('D 닫았다 다시 열어도 값 그대로', vals == ['아크세이버 11', 'BG80', '27'], vals)
    shot('gear', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(500)

    # ── E. 터치 불꽃 스매시 ──
    page.click('#hdrRacket')
    page.wait_for_timeout(1000)
    check('E 스매시 모드 줄·테스트 버튼', has('[data-rk-stage]') and has('[data-rk-smash]'))
    page.evaluate("() => BM.racketcustom._last3d.smash('fire')")
    page.evaluate("() => BM.racketcustom._last3d.hold(130)")
    page.wait_for_timeout(200)
    probe = page.evaluate("""() => {
      const cv = document.querySelector('.rk3d__cv'), g = cv.getContext('2d');
      const dpr = cv.width / cv.clientWidth, w = cv.clientWidth, h = cv.clientHeight;
      const v = BM.racketcustom._last3d.view;
      let p = BM.racketcustom.project3({ x: 0, y: 0, z: 0 }, v);
      p = { x: Math.min(Math.max(p.x, w * 0.26), w * 0.74), y: Math.min(Math.max(p.y, h * 0.24), h * 0.62) };
      return Array.from(g.getImageData(Math.round(p.x * dpr), Math.round(p.y * dpr), 1, 1).data);
    }""")
    check('E 불꽃 연출이 캔버스에 그려진다', probe[0] > 200 and probe[1] > 190, probe)
    canvas_shot('smash')
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(1000)
    tap('[data-rk-slot="effect"]', 700)
    check('E 효과 탭에 하트 이펙트 2종', has('[data-rk-part="effect:fire"]') and has('[data-rk-part="effect:thunder"]'))
    names = text_of('.rkgroup[data-rk-group="effect"]')
    check('E 하트 가격(❤ 2 · ❤ 3)', '❤ 2' in names and '❤ 3' in names, names[:160])
    page.evaluate("""() => { const g = document.querySelector('.rkgroup[data-rk-group="effect"]'); if (g) g.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(700)
    shot('smash_shop', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── F. 넘침·오류 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(600)
        ov = overflow()
        check('F 가로 넘침 없음 (%d)' % w, ov[0] <= ov[1], ov)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

ok_n = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok_n, len(checks)))
if errs:
    print('콘솔 오류:', errs[:5])
if csp:
    print('CSP:', csp[:3])
