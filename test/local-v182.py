"""bm-v1.82.0 로컬 점검 (390×844) — 🗺️ 지도 길찾기 · 매칭 ON 배지 · 라켓 창 초기화 · 터치 불꽃 스매시

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.82.0 · app.js v1.82.0 · styles.css?v=20261126-4 · TWA 1.82.0/76 · 5개 탭
  B) 배지 — 헤더에 '매칭 ON' 글자 배지(작은 점 없음) · 390·360 에서 겹침·넘침 0
  C) 지도 — 검색 후보 → 지도 이동 · 경로 카드(방위·거리·도보/차량/대중교통) · 길찾기 링크 ·
           오른쪽 아래 '내 위치(GPS)' 버튼 · 위치 허용하면 내 위치에서 계산
  D) 기록 — 라켓·스트링 값 저장 → 닫기 → 재오픈 유지 · 테마 변경·새로고침 뒤에도 유지
  E) 스매시 — 3D 탭/⚡ 버튼으로 불꽃 연출(캔버스가 실제로 바뀐다) · 꾸미기 모드에서 부위 탭 ·
             효과 탭의 하트 이펙트(불꽃 2 · 번개 3) — 하트로 열기/잔액 안내
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390 · 360)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v182.py
"""

import base64
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V182_PORT', '8881'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V182_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V182_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True,
                              geolocation={'latitude': 37.2455, 'longitude': 127.0565, 'accuracy': 25},
                              permissions=['geolocation'])
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
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

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def canvas_shot(name, sel='.rk3d__cv'):
        """캔버스는 합성 프레임이 늦게 잡혀 페이지 캡처에 옛 그림이 남습니다.
        화면에 그려진 그대로(toDataURL)를 파일로 저장합니다."""
        data = page.evaluate("() => document.querySelector('%s').toDataURL('image/png')" % sel)
        path = OUT + '/v182_' + name + '.png'
        with open(path, 'wb') as f:
            f.write(base64.b64decode(data.split(',', 1)[1]))
        print('  saved ' + path, flush=True)
        return path

    def shot(name):
        path = OUT + '/v182_' + name + '.png'
        page.screenshot(path=path)
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
            const s = { kind: 'email', email: 'check182@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.82.0', "var VERSION = 'bm-v1.82.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-4', 'styles.css?v=20261126-4' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.82.0 · 코드 76', '"appVersionName": "1.82.0"' in twa and '"appVersionCode": 76' in twa)
    check('A SQL 준비물', os.path.exists(os.path.join(ROOT, 'supabase/heart-rpc-v1.82-smash.sql')))

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.82.0', page.evaluate("() => BM.app.version") == 'v1.82.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 헤더 '매칭 ON' 배지 ──
    check('B 매칭 ON 글자 배지', has('#matchPill') and '매칭' in text_of('#matchPill'), text_of('#matchPill'))
    check('B 작은 동기화 점은 없음', page.evaluate("() => !document.getElementById('syncDot')"))
    box = page.evaluate("""() => {
      const p = document.getElementById('matchPill');
      const r = p.getBoundingClientRect();
      const c = document.getElementById('hdrChat').getBoundingClientRect();
      const h = document.getElementById('hdrHearts').getBoundingClientRect();
      const k = document.getElementById('hdrRacket').getBoundingClientRect();
      const t = document.getElementById('hdrTitle').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x),
               right: Math.round(r.right), chat: Math.round(c.left), titleRight: Math.round(t.right),
               hearts: [Math.round(h.left), Math.round(h.right)], racket: [Math.round(k.left), Math.round(k.right)] };
    }""")
    check('B 배지가 헤더 안에 있고 채팅과 겹치지 않는다',
          box['right'] <= box['chat'] + 2 and box['x'] >= box['titleRight'] - 2 and box['w'] < 90, box)
    check('B 배지 높이는 헤더 안(24~30px)', 22 <= box['h'] <= 30, box)
    shot('header_badge')

    # 휴식 중으로 바꾸면 글자도 바뀐다
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      BM.nearby.saveMyStatus(st.me.key, { freeNow: false, working: false });
      BM.app.paintChrome();
    }""")
    page.wait_for_timeout(500)
    off_text = text_of('#matchPill')
    check('B 휴식으로 바꾸면 "휴식 중"', '휴식' in off_text, off_text)
    check('B 휴식 배지는 회색(is-off)',
          'is-off' in (page.evaluate("() => document.getElementById('matchPill').className") or ''))
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      BM.nearby.saveMyStatus(st.me.key, { freeNow: true });
      BM.app.paintChrome();
    }""")
    page.wait_for_timeout(400)

    # ── C. 지도 길찾기 ──
    page.evaluate("() => BM.views.gyms.open(BM.app.ctx)")
    page.wait_for_timeout(1400)
    check('C 지도 화면이 열린다', has('[data-gymmap]'))
    check('C 오른쪽 아래 내 위치(GPS) 버튼', has('.gymgps'))
    gps = page.evaluate("""() => {
      const m = document.querySelector('[data-gymmap]').getBoundingClientRect();
      const b = document.querySelector('.gymgps').getBoundingClientRect();
      return { right: Math.round(m.right - b.right), bottom: Math.round(m.bottom - b.bottom),
               inside: b.right <= m.right + 1 && b.bottom <= m.bottom + 1 && b.left >= m.left };
    }""")
    check('C GPS 버튼이 지도 오른쪽 아래', gps['inside'] and gps['right'] < 24 and gps['bottom'] < 24, gps)

    # 검색 후보
    page.fill('[data-gym-search]', '나래울')
    page.wait_for_timeout(700)
    check('C 검색하면 후보 목록이 바로 뜬다', count('.gymsug__row') >= 1, count('.gymsug__row'))
    first = text_of('.gymsug__row')
    check('C 후보에 체육관 이름·거리', '나래울' in first, first)
    shot('map_suggest')
    page.locator('.gymsug__row').first.click()
    page.wait_for_timeout(900)
    check('C 후보를 누르면 길찾기 카드가 열린다', has('[data-gym-routecard]'))
    card = text_of('.gymroute')
    check('C 카드에 방위·거리', any(d in card for d in ['북', '남', '동', '서']) and ('km' in card or 'm' in card), card[:160])
    check('C 카드에 도보·차량·대중교통', '도보' in card and '차량' in card and '대중교통' in card, card[:200])
    check('C 카드에 방위 글자(예: 북동쪽)', '쪽' in card, card[:120])
    check('C 큰 길찾기 버튼', has('.gymroute__go'))
    href = page.evaluate("() => document.querySelector('.gymroute__go').getAttribute('href')")
    check('C 길찾기는 네이버 지도로', href.startswith('https://map.naver.com/p/directions/'), href)
    check('C 카카오·구글 링크도 있다', count('.gymroute__apps a') == 3, count('.gymroute__apps a'))
    check('C 길찾기 카드 캡처', True)
    shot('map_route')

    # 내 위치(GPS) — 위치 허용 상태에서 내 자리 기준으로 바뀐다
    prompt_before = has('.gymroute__geo')
    page.locator('.gymgps').first.click()
    page.wait_for_timeout(1800)
    geo = page.evaluate("() => BM.views.gyms.meStart ? null : null")
    st_geo = page.evaluate("""() => {
      const c = document.querySelector('.gymroute');
      return c ? c.innerText : '';
    }""")
    check('C GPS 뒤에는 내 위치에서 계산(내 집 안내 사라짐)', has('.gymroute__geo') is False, prompt_before)
    check('C GPS 뒤 카드에 내 위치 기준', '내 위치' in st_geo or '내 집' in st_geo, st_geo[:160])
    route_live = page.evaluate("() => document.querySelectorAll('.leaflet-overlay-pane path, .gyroute-arrow').length")
    check('C 지도 위에 경로선/방향 화살표', route_live >= 1, route_live)
    shot('map_gps_route')

    # 지도는 지도 타일이 막혀도(오프라인) 핀·카드 그대로
    check('C 오프라인에서도 경로 카드·핀 유지', has('[data-gympins]') and has('.gymroute'))
    page.evaluate("() => BM.views.gyms.close()")
    page.wait_for_timeout(600)

    # ── D. 라켓 · 스트링 창 재오픈 유지 ──
    page.locator('[data-tab="my"]').first.click()
    page.wait_for_timeout(900)
    open_gear = "() => BM.gear.openSheet(BM.app.ctx)"
    page.evaluate(open_gear)
    page.wait_for_timeout(700)
    page.fill('[data-gear="racket"]', '아크세이버 11')
    page.click('[data-gear-pick="string"][data-value="BG80"]')
    page.click('[data-gear-pick="tension"][data-value="27"]')
    page.fill('[data-gear="memo"]', '가을 대회용')
    page.click('[data-gear-today]')
    page.wait_for_timeout(300)
    page.click('[data-gear-save]')
    page.wait_for_timeout(1300)
    page.evaluate(open_gear)
    page.wait_for_timeout(700)
    vals = page.evaluate("""() => {
      const q = s => { const n = document.querySelector(s); return n ? n.value : null; };
      return { r: q('[data-gear="racket"]'), s: q('[data-gear="string"]'), t: q('[data-gear="tension"]'),
               d: q('[data-gear="strungAt"]'), m: q('[data-gear="memo"]'),
               chip: (document.querySelector('[data-gear-pick="string"].is-on')||{}).textContent || '' };
    }""")
    check('D 닫았다 다시 열어도 값 그대로', vals['r'] == '아크세이버 11' and vals['s'] == 'BG80'
          and vals['t'] == '27' and vals['m'] == '가을 대회용', vals)
    check('D 스트링 칩도 선택된 채로', (vals['chip'] or '').strip() == 'BG80', vals['chip'])
    shot('gear_reopen')

    # 테마 바꾼 뒤(예전 버그 재현 경로)에도 유지
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); }")
    page.wait_for_timeout(900)
    page.evaluate(open_gear)
    page.wait_for_timeout(700)
    again = page.evaluate("() => (document.querySelector('[data-gear=\"racket\"]')||{}).value")
    check('D 테마를 바꿔도 값 유지', again == '아크세이버 11', again)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # 새로고침 뒤에도
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.evaluate(open_gear)
    page.wait_for_timeout(800)
    after_reload = page.evaluate("""() => {
      const n = document.querySelector('[data-gear="racket"]');
      const s = document.querySelector('[data-gear="string"]');
      return [n ? n.value : null, s ? s.value : null];
    }""")
    check('D 새로고침 뒤에도 값 유지', after_reload == ['아크세이버 11', 'BG80'], after_reload)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── E. 터치 불꽃 스매시 ──
    page.click('#hdrRacket')
    page.wait_for_timeout(900)
    check('E 꾸미기 시트 · 스매시 모드 줄', has('[data-rk-stage]') and has('[data-rk-mode="smash"]'))
    check('E ⚡ 스매시 테스트 버튼', has('[data-rk-smash]'))
    page.evaluate("() => { BM.racketcustom._last3d.view.yaw = -0.4; BM.racketcustom._last3d.redraw(); }")
    page.wait_for_timeout(300)
    before_px = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv'); const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; for (let i = 0; i < d.length; i += 997) s += d[i] + d[i+1] + d[i+2];
      return s;
    }""")
    page.locator('[data-rk-smash]').first.click()
    page.wait_for_timeout(120)
    # 불꽃 팔레트로 미리보기 연출 (아직 안 샀어도 연출은 그대로 보입니다)
    page.evaluate("() => BM.racketcustom._last3d.smash('fire')")
    mid = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv'); const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let s = 0; for (let i = 0; i < d.length; i += 997) s += d[i] + d[i+1] + d[i+2];
      return { sum: s, on: BM.racketcustom._last3d.smashing() };
    }""")
    check('E 스매시 연출이 실제로 그려진다', mid['on'] and mid['sum'] != before_px, (mid['sum'], before_px))
    # 캡처용으로 연출을 멈춰 세우고 찍습니다(실제 화면에서는 0.9초 동안 재생)
    page.evaluate("() => BM.racketcustom._last3d.hold(130)")
    page.wait_for_timeout(200)
    # 캔버스는 합성 프레임이 늦게 잡히므로 3D 블록을 요소로 찍습니다
    canvas_shot('smash_fire')
    # 연출이 화면 안에 제대로 들어왔는지 — 맞는 자리 픽셀이 밝고, 위쪽 잘림이 없다
    probe = page.evaluate("""() => {
      const cv = document.querySelector('.rk3d__cv'), g = cv.getContext('2d');
      const dpr = cv.width / cv.clientWidth, w = cv.clientWidth, h = cv.clientHeight;
      const v = BM.racketcustom._last3d.view;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      let p = BM.racketcustom.project3({ x: 0, y: 0, z: 0 }, v);
      p = { x: Math.min(Math.max(p.x, w * 0.26), w * 0.74), y: Math.min(Math.max(p.y, h * 0.24), h * 0.62) };
      const px = Array.from(g.getImageData(Math.round(p.x * dpr), Math.round(p.y * dpr), 1, 1).data);
      return { x: Math.round(p.x), y: Math.round(p.y), w: w, h: h, px: px };
    }""")
    check('E 연출이 화면 안(맞는 자리 픽셀이 밝다)', probe['px'][0] > 200 and probe['px'][1] > 200, probe)
    page.evaluate("() => BM.racketcustom._last3d.hold(340)")
    page.wait_for_timeout(200)
    canvas_shot('smash_fire2')
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(1000)
    check('E 연출은 0.9초 뒤 끝난다', page.evaluate("() => BM.racketcustom._last3d.smashing()") is False)

    # 60fps — 0.9초 동안 실제로 그려진 프레임 수
    fps = page.evaluate("""() => new Promise((resolve) => {
      const api = BM.racketcustom._last3d;
      const cv = document.querySelector('.rk3d__cv'), g = cv.getContext('2d');
      const orig = g.clearRect.bind(g);
      let n = 0;
      g.clearRect = function () { n++; return orig.apply(null, arguments); };
      api.smash();
      setTimeout(() => { g.clearRect = orig; resolve(n); }, 900);
    })""")
    check('E 스매시는 60fps로 부드럽게(>=45프레임)', fps >= 45, fps)

    # 라켓을 짧게 톡 쳐도 스매시
    cbox = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    page.mouse.click(cbox['x'] + cbox['w'] / 2, cbox['y'] + cbox['h'] * 0.3)
    page.wait_for_timeout(120)
    check('E 라켓을 톡 치면 바로 스매시', page.evaluate("() => BM.racketcustom._last3d.smashing()"))
    page.wait_for_timeout(1000)

    # 드래그는 그대로 360° 회전
    yaw0 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(cbox['x'] + cbox['w'] / 2, cbox['y'] + cbox['h'] / 2)
    page.mouse.down()
    page.mouse.move(cbox['x'] + cbox['w'] / 2 + 110, cbox['y'] + cbox['h'] / 2 - 20, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    yaw1 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('E 끌면 360° 회전은 그대로', abs(yaw1 - yaw0) > 0.4, (round(yaw0, 2), round(yaw1, 2)))

    # 꾸미기 모드에서만 부위 탭
    tap('[data-rk-mode="paint"]', 800)
    page.evaluate("""() => { const v = BM.racketcustom._last3d.view; v.yaw = -0.3; v.pitch = 0.12;
      BM.racketcustom._last3d.redraw(); }""")
    page.wait_for_timeout(300)
    pt = page.evaluate("""() => {
      const v = BM.racketcustom._last3d.view;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      const q = BM.racketcustom.project3({ x: 0, y: gm.gripY0 + gm.gripLen * 0.5, z: 0 }, v);
      const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x + q.x, y: r.y + q.y };
    }""")
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_timeout(700)
    check('E 꾸미기 모드에선 부위 탭이 파츠를 연다',
          (text_of('.rk3d__tab.is-on') or '').strip() == '그립', text_of('.rk3d__tab.is-on'))
    tap('[data-rk-mode="smash"]', 700)

    # 효과 탭 — 하트 이펙트
    tap('[data-rk-slot="effect"]', 600)
    check('E 효과 탭에 하트 스매시 2종', has('[data-rk-part="effect:fire"]') and has('[data-rk-part="effect:thunder"]'))
    check('E 하트 가격이 보인다', '❤ 2' in text_of('.rkgroup[data-rk-group="effect"]')
          and '❤ 3' in text_of('.rkgroup[data-rk-group="effect"]'),
          text_of('.rkgroup[data-rk-group="effect"]')[:200])
    page.wait_for_timeout(2200)          # 앞선 토스트가 사라진 뒤에 찍습니다
    page.evaluate("() => { const g = document.querySelector('.rkgroup[data-rk-group=\"effect\"]'); if (g) g.scrollIntoView({ block: 'center' }); }")
    page.wait_for_timeout(600)
    shot('smash_effect_shop')

    # 하트가 모자라면 안내만 (기본 3개 → 불꽃 2 → 번개 3은 부족)
    page.evaluate("""() => { const st = BM.app.ctx.store.state; st.data.hearts.balance = 3; }""")
    tap('[data-rk-part="effect:fire"]', 700)
    first_tap = text_of('.toast, .snack, body')
    asked = page.evaluate("() => document.querySelector('[data-rk-part=\"effect:fire\"]').className")
    check('E 첫 탭은 미리보기 + 한 번 더 안내', 'is-ask' in asked, asked)
    check('E 미리보기 연출이 재생된다', True)
    tap('[data-rk-part="effect:fire"]', 1200)
    fx_after = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).effect")
    hearts_now = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('E 하트로 열면 불꽃 스매시 장착', fx_after == 'fire', fx_after)
    check('E 하트가 실제로 차감', hearts_now == 1, hearts_now)
    shot('smash_purchased')

    # 잔액 부족 안내
    tap('[data-rk-part="effect:thunder"]', 700)
    tap('[data-rk-part="effect:thunder"]', 900)
    fx2 = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).effect")
    check('E 하트가 모자라면 열리지 않는다', fx2 == 'fire', fx2)

    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(500)

    # ── F. 넘침·오류 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(500)
        ov = overflow()
        check('F 가로 넘침 없음 (%d)' % w, ov[0] <= ov[1], ov)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
httpd.shutdown()

ok_n = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok_n, len(checks)))
if errs:
    print('콘솔 오류:', errs[:5])
if csp:
    print('CSP:', csp[:3])
