"""bm-v1.81.0 라이브 점검 (390×844) — 🏸 실제 비율 3D 라켓 · 바디 4종 · 등급 · 효과 · 줄 갈고 며칠째

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 화면을 봅니다)
  A) 버전 — sw.js bm-v1.81.0 · app.js v1.81.0 · styles.css?v=20261126-3 · TWA 1.81.0/75 · 5개 탭
  B) 헤더 — 오른쪽 미니 라켓 → '내 커스텀 라켓' 시트(바디 4 · 파츠 30 · 탭 6)
  C) 3D — 실제 비율 라켓 · 끌어서 회전 · 거트/테두리/그립 탭
  D) 바디·효과 — 스매시 맥스로 바꾸면 실루엣이 달라지고, 블레이즈 오라가 3D에서 움직인다
  E) 줄 — '오늘 갈았어요' 원탭 복구 · 40일 전이면 교체 시기(끊어짐)
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v181.py
"""

import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V181_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V181_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def read(path):
    sep = '&' if '?' in path else '?'
    with urllib.request.urlopen(BASE + path + sep + 'cb=v181', timeout=30) as r:
        return r.read().decode('utf-8')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
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

    def tap(sel, wait=500):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def shot(name, keep=False):
        path = SHOTS + '/live181_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v181_live_' + name + '.png')
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    # ── A. 버전 ──
    check('A sw.js bm-v1.81.0', "var VERSION = 'bm-v1.81.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-3', 'styles.css?v=20261126-3' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.81.0 · 코드 75', '"appVersionName": "1.81.0"' in twa and '"appVersionCode": 75' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1800)
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live181@example.com',
        name: '승우', at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
        profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                   club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } }));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    check('A 앱 버전 v1.81.0', page.evaluate("() => BM.app.version") == 'v1.81.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 헤더 · 시트 ──
    check('B 헤더 미니 라켓', has('#hdrRacket'))
    shot('header', keep=True)
    tap('#hdrRacket', 900)
    check('B 꾸미기 시트', has('.rksheet'))
    check('B 바디 4칩', count('.rkbody__chip') == 4, count('.rkbody__chip'))
    check('B 부위 탭 6개', count('.rk3d__tab') == 6, count('.rk3d__tab'))
    check('B 파츠 30개', count('.rkpart') == 30, count('.rkpart'))
    check('B 등급 배지', count('.rkrar') >= 30, count('.rkrar'))

    # ── C. 3D ──
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
      const v = BM.racketcustom._last3d.view;
      const gm = BM.racketcustom.geomOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me));
      const top = BM.racketcustom.project3({ x: 0, y: -gm.ry, z: 0 }, v);
      const bot = BM.racketcustom.project3({ x: 0, y: gm.gripY1, z: 0 }, v);
      const l = BM.racketcustom.project3({ x: -gm.rx, y: 0, z: 0 }, v);
      const r = BM.racketcustom.project3({ x: gm.rx, y: 0, z: 0 }, v);
      return { h: Math.round(bot.y - top.y), w: Math.round(r.x - l.x), span: gm.span };
    }""")
    check('C 세로로 긴 실제 비율', geo['h'] > geo['w'] * 2 and geo['h'] > 260, geo)
    box = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    yaw0 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + box['w'] / 2 + 100, box['y'] + box['h'] / 2 - 16, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    yaw1 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('C 끌면 돌아간다', abs(yaw1 - yaw0) > 0.4, (round(yaw0, 2), round(yaw1, 2)))
    shot('rk3d', keep=True)

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
    check('C 그립 탭이 바로 열린다', (text_of('.rk3d__tab.is-on') or '').strip() == '그립')

    # ── D. 바디 · 효과 (포인트는 과거 일지 30건으로) ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      for (let i = 0; i < 30; i++) {
        const d = String(1 + i).padStart(2, '0');
        st.rows.push({ type: '기록', id: 'live181-' + i, clientId: 'l181' + i,
          createdAt: '2026-10-' + d + ' 10:00:00', userKey: st.me.key, nick: '승우',
          date: '2026-10-' + d, minutes: 60 });
      }
      st.data = BM.store.derive(st.rows, st.me.key);
    }""")
    page.wait_for_timeout(300)
    tap('[data-rk-body="smash"]', 1500)
    body = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).body")
    check('D 스매시 맥스로 바뀐다', body == 'smash', body)
    tap('[data-rk-slot="effect"]', 700)
    check('D 효과 카드 5개', count('[data-rk-part^="effect:"]') == 5, count('[data-rk-part^="effect:"]'))
    fx = 'none'
    for _ in range(4):
        tap('[data-rk-part="effect:blaze"]', 900)
        fx = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).effect")
        if fx == 'blaze':
            break
        page.wait_for_timeout(700)
    check('D 블레이즈 오라를 입었다', fx == 'blaze', fx)
    p1 = page.evaluate("() => BM.racketcustom._last3d.view.phase")
    page.wait_for_timeout(800)
    p2 = page.evaluate("() => BM.racketcustom._last3d.view.phase")
    check('D 연출이 계속 움직인다', p2 > p1 + 0.1, (p1, p2))
    check('D 헤더에도 연출', 'ffb347' in page.evaluate("() => document.getElementById('hdrRacket').innerHTML"))
    shot('rk3d_blaze', keep=True)

    # ── E. 줄 갈고 며칠째 ──
    page.evaluate("() => { BM.ui.closeSheet(); BM.app.ctx.actions.setGear({ strungAt: '', cycleDays: 30 }); }")
    page.wait_for_timeout(600)
    tap('#hdrRacket', 800)
    age = text_of('.rkage')
    check('E 줄 교체일 미등록 안내', '줄 교체일 미등록' in age, age)
    tap('[data-rk-restring="1"]', 1800)
    age2 = text_of('.rkage')
    check('E 오늘 갈았어요 → D+0', 'D+0' in age2 or '오늘 새 줄로 갈았어요' in age2, age2)
    hdr = ''
    for _ in range(8):
        hdr = page.evaluate("() => document.getElementById('hdrRacket').className") or ''
        if 'prime' in hdr:
            break
        page.wait_for_timeout(400)
    check('E 헤더가 다시 팽팽', 'prime' in hdr, hdr)
    page.evaluate("""() => {
      const d = new Date(); d.setDate(d.getDate() - 40);
      const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      BM.ui.closeSheet(); BM.app.ctx.actions.setGear({ strungAt: s, cycleDays: 30 });
    }""")
    page.wait_for_timeout(600)
    tap('#hdrRacket', 800)
    age3 = text_of('.rkage')
    check('E 40일 → 교체 시기(끊어짐)', '끊어졌어요' in age3, age3)
    shot('rk3d_broken', keep=True)

    # ── F. 넘침 · 오류 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(500)
        ov = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        check('F 가로 넘침 없음 (%d)' % w, ov[0] <= ov[1], ov)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(300)
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])
    browser.close()

ok_n = sum(1 for _, c in checks if c)
print('\n%d/%d 통과 (차단된 요청 %d건)' % (ok_n, len(checks), len(blocked)))
if errs:
    print('콘솔 오류:', errs[:5])
if csp:
    print('CSP:', csp[:3])
