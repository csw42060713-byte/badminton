"""bm-v1.81.0 로컬 점검 (390×844) — 🏸 실제 비율 3D 라켓 · 바디 4종 · 등급 · 효과 · 줄 갈고 며칠째

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.81.0 · app.js v1.81.0 · styles.css?v=20261126-3 · TWA 1.81.0/75 · 5개 탭
  B) 헤더 — 오른쪽 미니 라켓 → '내 커스텀 라켓' 시트(바디 4 · 파츠 30 · 탭 6)가 열리고 닫힌다
  C) 3D — 실제 비율 라켓이 그려지고, 끌면 돌아가며, 거트·테두리·그립을 눌러 탭이 바뀐다
  D) 바디 — 파워 77 → 스매시 맥스로 바꾸면 3D 실루엣·프레임 두께가 실제로 달라진다
  E) 등급 — 카드에 일반/레어/에픽/레전드 배지와 테두리 글로우가 보인다
  F) 효과 — 효과 칸에서 '블레이즈 오라'를 열면 3D 캔버스가 움직이고(프레임이 계속 바뀐다) 헤더·공유 카드에도 보인다
  G) 줄 — 미등록 → '오늘 갈았어요'로 D+0 복구, 40일 전으로 두면 '교체 시기 · 줄이 끊어졌어요'
  H) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390 · 360)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v181.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V181_PORT', '8881'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V181_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V181_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


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
                              accept_downloads=True)
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

    def shot(name, keep=False):
        path = SHOTS + '/v181_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v181_' + name + '.png')
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def close_sheet():
        page.evaluate("() => { try { BM.ui.closeSheet(); } catch (e) {} }")
        page.wait_for_timeout(500)

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    def login(nick='승우'):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check181@example.com', name: a.nick,
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
    check('A sw.js bm-v1.81.0', "var VERSION = 'bm-v1.81.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-3', 'styles.css?v=20261126-3' in read('index.html'))
    check('A index js/racketcustom.js', 'js/racketcustom.js' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.81.0 · 코드 75', '"appVersionName": "1.81.0"' in twa and '"appVersionCode": 75' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.81.0', page.evaluate("() => BM.app.version") == 'v1.81.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 헤더 미니 라켓 ──
    check('B 헤더에 미니 라켓 버튼', has('#hdrRacket'))
    box = page.evaluate("""() => {
      const el = document.getElementById('hdrRacket');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const h = document.getElementById('hdrHearts').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x),
               right: Math.round(r.right), heart: Math.round(h.right),
               svg: !!el.querySelector('svg'), cls: el.className };
    }""")
    check('B 헤더 라켓 크기·자리', box and 28 <= box['w'] <= 40 and box['svg'] and box['right'] <= 390, box)
    check('B 라켓이 하트 옆(오른쪽)', box and box['x'] >= box['heart'], box)
    shot('header', keep=True)

    tap('#hdrRacket', 800)
    check('B 꾸미기 시트가 열린다', has('.rksheet'))
    check('B 바디 칩 4개', count('.rkbody__chip') == 4, count('.rkbody__chip'))
    check('B 부위 탭 6개(효과 포함)', count('.rk3d__tab') == 6, count('.rk3d__tab'))
    check('B 파츠 6칸 × 5종 = 30개', count('.rkpart') == 30, count('.rkpart'))
    check('B 등급 배지가 카드에 있다', count('.rkrar') >= 30, count('.rkrar'))

    # ── C. 3D ──
    check('C 3D 캔버스', has('.rk3d__cv'))
    painted = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv'); if (!c) return 0;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) { if (d[i] + d[i+1] + d[i+2] > 120) n++; }
      return n;
    }""")
    check('C 3D 라켓이 그려졌다', painted > 80, painted)
    geo = page.evaluate("""() => {
      const cv = document.querySelector('.rk3d__cv');
      const v = BM.racketcustom._last3d.view;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      const top = BM.racketcustom.project3({ x: 0, y: -gm.ry, z: 0 }, v);
      const bot = BM.racketcustom.project3({ x: 0, y: gm.gripY1, z: 0 }, v);
      const l = BM.racketcustom.project3({ x: -gm.rx, y: 0, z: 0 }, v);
      const r = BM.racketcustom.project3({ x: gm.rx, y: 0, z: 0 }, v);
      return { h: Math.round(bot.y - top.y), w: Math.round(r.x - l.x),
               cssH: Math.round(cv.getBoundingClientRect().height), span: gm.span };
    }""")
    check('C 라켓이 캔버스 높이를 채운다', geo['h'] > geo['cssH'] * 0.7 and geo['h'] <= geo['cssH'], geo)
    check('C 라켓 비율이 세로로 길다(높이 > 가로×2)', geo['h'] > geo['w'] * 2, geo)
    shot('rk3d_front', keep=True)

    box = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    yaw0 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + box['w'] / 2 + 110, box['y'] + box['h'] / 2 - 20, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    yaw1 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('C 끌면 라켓이 돌아간다', abs(yaw1 - yaw0) > 0.4, (round(yaw0, 2), round(yaw1, 2)))
    shot('rk3d_rotated', keep=True)

    # 부위 직접 탭 — 그립
    page.evaluate("""() => { const v = BM.racketcustom._last3d.view; v.yaw = -0.3; v.pitch = 0.12;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      BM.racketcustom._last3d.redraw(); }""")
    pt = page.evaluate("""() => {
      const v = BM.racketcustom._last3d.view;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      const p = BM.racketcustom.project3({ x: 0, y: gm.gripY0 + gm.gripLen * 0.5, z: 0 }, v);
      const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x + p.x, y: r.y + p.y, hit: BM.racketcustom.hitSlot(p.x, p.y, v) };
    }""")
    check('C 그립 위치가 그립으로 잡힌다', pt['hit'] == 'grip', pt)
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_timeout(700)
    check('C 그립 탭이 바로 열린다', (text_of('.rk3d__tab.is-on') or '').strip() == '그립', text_of('.rk3d__tab.is-on'))

    # ── D. 바디 바꾸기 ──
    before = page.evaluate("""() => {
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      return { body: gm.id, rx: gm.rx, hoop: gm.hoop, gripLen: gm.gripLen };
    }""")
    page.evaluate("""() => {   /* 포인트를 넉넉히: 일지 30건(과거 기록) */
      const st = BM.app.ctx.store.state;
      const days = [];
      for (let i = 0; i < 30; i++) days.push(String(1 + i).padStart(2, '0'));
      days.forEach((d, i) => {
        st.rows.push({ type: '기록', id: 'v181-' + i, clientId: 'v181c' + i,
          createdAt: '2026-10-' + d + ' 10:00:00', userKey: st.me.key, nick: '승우',
          date: '2026-10-' + d, minutes: 60 });
      });
      st.data = BM.store.derive(st.rows, st.me.key);
    }""")
    page.wait_for_timeout(300)
    bal0 = page.evaluate("() => BM.racketcustom.pointsBalance(BM.app.ctx.store.state)")
    check('D 포인트가 모여 있다(과거 일지 30건 = 300P)', bal0 >= 300, bal0)
    tap('[data-rk-body="smash"]', 900)
    after = page.evaluate("""() => {
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      return { body: gm.id, rx: gm.rx, hoop: gm.hoop, gripLen: gm.gripLen };
    }""")
    check('D 스매시 맥스로 바뀐다', after['body'] == 'smash', (before, after))
    check('D 실루엣·프레임 두께가 실제로 달라진다',
          after['rx'] < before['rx'] and after['hoop'] > before['hoop'], (before, after))
    check('D 바디 칩 강조가 따라온다',
          'is-on' in (page.locator('[data-rk-body="smash"]').first.get_attribute('class') or ''))
    shot('rk3d_smash', keep=True)

    # ── E. 효과 ──
    tap('[data-rk-slot="effect"]', 600)
    check('E 효과 탭에 다섯 카드', count('[data-rk-part^="effect:"]') == 5, count('[data-rk-part^="effect:"]'))
    fx = 'none'
    for _ in range(4):
        tap('[data-rk-part="effect:blaze"]', 900)
        fx = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).effect")
        if fx == 'blaze':
            break
        page.wait_for_timeout(700)
    check('E 블레이즈 오라를 열어 입었다', fx == 'blaze', fx)
    p1 = page.evaluate("() => BM.racketcustom._last3d.view.phase")
    page.wait_for_timeout(700)
    p2 = page.evaluate("() => BM.racketcustom._last3d.view.phase")
    check('E 3D에서 연출이 계속 움직인다', p2 > p1 + 0.1, (p1, p2))
    check('E 헤더 미니 라켓에도 연출이 보인다',
          'ffb347' in page.evaluate("() => document.getElementById('hdrRacket').innerHTML"))
    shot('rk3d_blaze', keep=True)

    # ── F. 줄 갈고 며칠째 ──
    close_sheet()
    page.evaluate("""() => { BM.app.ctx.actions.setGear({ strungAt: '', cycleDays: 30 }); }""")
    page.wait_for_timeout(300)
    tap('#hdrRacket', 700)
    age = text_of('.rkage')
    check('F 줄 교체일 미등록 안내', '줄 교체일 미등록' in age, age)
    check('F 눌러서 기록 연결', has('[data-rk-gear="1"]') and has('[data-rk-restring="1"]'))
    tap('[data-rk-restring="1"]', 1800)
    age2 = text_of('.rkage')
    check('F 오늘 갈았어요 → D+0', 'D+0' in age2 or '오늘 새 줄로 갈았어요' in age2, age2)
    hdr = ''
    for _ in range(8):
        hdr = page.evaluate("() => document.getElementById('hdrRacket').className") or ''
        if 'prime' in hdr:
            break
        page.wait_for_timeout(400)
    check('F 줄이 다시 팽팽(최상)', 'prime' in hdr, hdr)
    shot('rk3d_new_string', keep=True)

    # 40일 전으로 두면 끊어짐
    page.evaluate("""() => {
      const d = new Date(); d.setDate(d.getDate() - 40);
      const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      BM.app.ctx.actions.setGear({ strungAt: s, cycleDays: 30 });
    }""")
    page.wait_for_timeout(400)
    close_sheet()
    tap('#hdrRacket', 700)
    age3 = text_of('.rkage')
    check('F 40일 → 교체 시기 안내', '끊어졌어요' in age3, age3)
    check('F 헤더 라켓이 끊어진 상태', 'is-broken' in (page.evaluate("() => document.getElementById('hdrRacket').className") or ''),
          page.evaluate("() => document.getElementById('hdrRacket').className"))
    shot('rk3d_broken', keep=True)

    # ── G. 공유 카드(스매시) ──
    tap('[data-rk-share="1"]', 1200)
    check('G 공유 시트가 스매시로 열린다', has('.sc__smashban'), count('.sc__smashban'))
    shot('share_smash', keep=True)

    # ── H. 넘침·오류 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(500)
        ov = overflow()
        check('H 가로 넘침 없음 (%d)' % w, ov[0] <= ov[1], ov)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
httpd.shutdown()

ok_n = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok_n, len(checks)))
if errs:
    print('콘솔 오류:', errs[:5])
if csp:
    print('CSP:', csp[:3])
