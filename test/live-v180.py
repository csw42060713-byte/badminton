"""bm-v1.80.0 라이브 점검 (390×844) — 🏸 내 커스텀 라켓 · 스매시 임팩트 공유

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 화면을 봅니다)
  A) 버전 — sw.js bm-v1.80.0 · app.js v1.80.0 · styles.css?v=20261126-2 · TWA 1.80.0/74 · 5개 탭
  B) 헤더 — 오른쪽 미니 라켓 → '내 커스텀 라켓' 시트(파츠 25개)가 열리고 닫힌다
  C) 일지 저장 → 스매시 연출(0.88초) → 화면 아래 '방금 쓴 오늘 운동 그대로 공유' 바
     → 공유 시트가 '스매시 임팩트' 켜진 채로 열리고, 캔버스에 그림이 그려진다
  D) 매칭 — 선수 카드의 라켓(가상 회원)·프로필 시트의 라켓/친구 코드 초대
  E) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v180.py
"""

import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V180_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V180_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def read(path):
    sep = '&' if '?' in path else '?'
    with urllib.request.urlopen(BASE + path + sep + 'cb=v180', timeout=30) as r:
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

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def shot(name, keep=False):
        path = SHOTS + '/live180_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v180_live_' + name + '.png')
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    # ── A. 라이브 파일 · 버전 ──
    sw = read('sw.js')
    index = read('index.html')
    twa = read('twa-manifest.json')
    check('A sw.js bm-v1.80.0', "var VERSION = 'bm-v1.80.0'" in sw)
    check('A sw 캐시에 js/racketcustom.js', "'./js/racketcustom.js'" in sw)
    check('A index styles.css?v=20261126-2', 'styles.css?v=20261126-2' in index)
    check('A TWA 1.80.0 · 코드 74',
          '"appVersionName": "1.80.0"' in twa and '"appVersionCode": 74' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(2200)
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live180@example.com', name: '승우',
                    at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                    profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2900)
    check('A 앱 버전 v1.80.0', page.evaluate("() => BM.app.version") == 'v1.80.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 헤더 미니 라켓 ──
    check('B 라이브 헤더에 미니 라켓', has('#hdrRacket'))
    tap('#hdrRacket', 700)
    check('B 꾸미기 시트', has('.rksheet'))
    check('B 파츠 25개', count('.rkpart') == 25, count('.rkpart'))
    check('B 3D 캔버스', has('.rk3d__cv'))
    painted3d = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv'); if (!c) return 0;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) { if (d[i] + d[i+1] + d[i+2] > 120) n++; }
      return n;
    }""")
    check('B 3D 라켓이 그려졌다', painted3d > 80, painted3d)
    shot('rk3d', keep=True)
    box = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    yaw0 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + box['w'] / 2 + 110, box['y'] + box['h'] / 2, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    yaw1 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('B 끌면 돌아간다', abs(yaw1 - yaw0) > 0.4, (round(yaw0, 2), round(yaw1, 2)))
    page.evaluate("""() => { const v = BM.racketcustom._last3d.view; v.yaw = -0.3; v.pitch = 0.12; BM.racketcustom._last3d.redraw(); }""")
    page.wait_for_timeout(200)
    hp = page.evaluate("""() => {
      const v = BM.racketcustom._last3d.view;
      const p = BM.racketcustom.project3({ x: 0, y: 240, z: 0 }, v);
      const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x + p.x, y: r.y + p.y, hit: BM.racketcustom.hitSlot(p.x, p.y, v) };
    }""")
    page.mouse.click(hp['x'], hp['y'])
    page.wait_for_timeout(700)
    check('B 그립을 누르면 그립 탭', (text_of('.rk3d__tab.is-on') or '').strip() == '그립', text_of('.rk3d__tab.is-on'))
    vis = page.evaluate("() => [...document.querySelectorAll('.rkgroup')].filter(g => !g.hidden).map(g => g.dataset.rkGroup)")
    check('B 그립 파츠만 보인다', vis == ['grip'], vis)
    shot('rk3d_grip', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(300)

    # ── C. 저장 → 스매시 연출 → 공유 바 → 스매시 카드 ──
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => { const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8; st.drafts.log.intensity = 6; st.drafts.log.weakness = ['풋워크']; }""")
    tap('[data-act="save-log"]', 240)
    check('C 저장 직후 스매시 연출', has('#smashburst'))
    shot('burst', keep=True)
    page.wait_for_timeout(900)
    check('C 연출은 곧 사라진다', not has('#smashburst'))
    check('C 화면 아래 공유 바', has('#saveShare') and not page.locator('#saveShare').is_hidden())
    check('C 공유 바 문구', '방금 쓴 오늘 운동 그대로 공유하기' in text_of('#saveShare'))
    shot('saveshare', keep=True)

    page.locator('#saveShare [data-act="share-card"]').first.click()
    page.wait_for_timeout(1100)
    check('C 스매시 배너 선택됨', has('.sc__smashban.is-on'))
    summ = text_of('[data-sc-summary]')
    check('C 카드 요약에 스매시 임팩트', '스매시 임팩트' in summ, summ[:120])
    painted = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      if (!c) return 0;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) { if (d[i] + d[i+1] + d[i+2] > 90) n++; }
      return n;
    }""")
    check('C 캔버스에 그림이 그려졌다', painted > 50, painted)
    shot('sharecard', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(300)

    # ── D. 매칭 — 카드·프로필 라켓 ──
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util;
      const rowsKey = Object.keys(localStorage).filter(k => k.indexOf('bm_rows_v1') === 0)[0] || 'bm_rows_v1';
      const rows = JSON.parse(localStorage.getItem(rowsKey) || '[]');
      const key = 'live_racket';
      rows.push(D.toRow({ id: U.uid(), type: '프로필', createdAt: '2026-11-25 10:00:00',
        nick: '콕집사', level: 'B조', discipline: '복식', userKey: key,
        theme: { theme: 'th_night', avatar: '🐧', gear: { custom: { frame: 'red', string: 'gold', unlocked: ['frame:red', 'string:gold'] } } } }));
      rows.push(D.toRow({ id: U.uid(), type: '매칭프로필', createdAt: '2026-11-25 10:05:00',
        userKey: key, nick: '콕집사',
        payload: { region: '경기', level: 'B조', discipline: '복식', club: '나래울',
          availability: '주말', experience: '2~5년', bio: '라이브 확인용 가상 회원',
          avatar: '🐧', gender: '남성' } }));
      localStorage.setItem(rowsKey, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2900)
    tap("#tabbar [data-tab='matching']", 900)
    if not count('.pcard__rk'):
        page.evaluate("""() => { const st = BM.app.ctx.store.state;
          st.ui.matchStarted = true; BM.app.ctx.actions.resetMatchFilter(); }""")
        page.wait_for_timeout(700)
    check('D 선수 카드에 라켓', count('.pcard__rk') > 0, count('.pcard__rk'))
    page.evaluate("() => { const c = document.querySelector('.pcard'); if (c) c.scrollIntoView({ block: 'center' }); }")
    page.wait_for_timeout(400)
    shot('matching', keep=True)
    if count('[data-open-profile]'):
        page.locator('[data-open-profile]').first.click()
        page.wait_for_timeout(700)
        check('D 프로필 시트 라켓 줄', has('.pp__racket'))
        check('D 친구 코드 초대', has('.pp__invite'))
        shot('profile', keep=True)
        page.evaluate("() => BM.ui.closeSheet()")
        page.wait_for_timeout(250)

    # ── E. 넘침 · 콘솔 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(400)
        ov = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
        check('E 가로 넘침 없음 (' + str(w) + ')', ov[0] <= ov[1], ov)
    check('E 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:3])

    browser.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)), flush=True)
if errs:
    print('콘솔 오류:', errs[:5], flush=True)
if csp:
    print('CSP:', csp[:3], flush=True)
raise SystemExit(0 if ok == len(checks) else 1)
