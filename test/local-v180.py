"""bm-v1.80.0 로컬 점검 (390×844) — 🏸 내 커스텀 라켓 · 스매시 임팩트 공유

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.80.0 · app.js v1.80.0 · styles.css?v=20261126-2 · TWA 1.80.0/74 · 5개 탭
  B) 헤더 — 오른쪽 미니 라켓이 보이고, 누르면 '내 커스텀 라켓' 시트가 열리고 닫힌다
     · 파츠 5칸 × 5종 · 잠긴 파츠는 가격 표시
  C) 꾸미기 — (일지 10개로 100P) 스트링 '화이트' 해금 → 입기 → 헤더 라켓 줄 색이 바뀐다
  D) 일지 저장 — 스매시 연출(약 0.9초) → 화면 아래 '방금 쓴 오늘 운동 그대로 공유' 바
     · 공유 → 공유 시트에 '스매시 임팩트'가 켜진 채 열리고, 미리보기 캔버스가 그려진다
  E) 매칭 — 선수 카드의 라켓 · 프로필 시트의 라켓/친구 코드 초대
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390 · 360)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v180.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V180_PORT', '8881'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V180_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V180_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
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
        path = SHOTS + '/v180_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v180_' + name + '.png')
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
            const s = { kind: 'email', email: 'check180@example.com', name: a.nick,
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
    check('A sw.js bm-v1.80.0', "var VERSION = 'bm-v1.80.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-2', 'styles.css?v=20261126-2' in read('index.html'))
    check('A index js/racketcustom.js', 'js/racketcustom.js' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.80.0 · 코드 74',
          '"appVersionName": "1.80.0"' in twa and '"appVersionCode": 74' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.80.0', page.evaluate("() => BM.app.version") == 'v1.80.0',
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
    check('B 헤더 라켓 크기·자리', box and 28 <= box['w'] <= 40 and box['svg'] and box['right'] <= 390,
          box)
    check('B 라켓이 하트 옆(오른쪽)', box and box['x'] >= box['heart'], box)
    shot('header', keep=True)

    tap('#hdrRacket', 700)
    check('B 꾸미기 시트가 열린다', has('.rksheet'))
    check('B 파츠 5칸', count('.rkgroup') == 5, count('.rkgroup'))
    check('B 파츠 25개', count('.rkpart') == 25, count('.rkpart'))
    check('B 잠긴 파츠 가격 표시', 'P' in text_of('.rkpart.is-lock'))
    check('B 라켓 포인트 표시', '라켓 포인트' in text_of('.rkpoints'))

    # ── B2. 3D 라켓 — 360° 돌려보기 · 부위 직접 탭 ──
    check('B2 3D 캔버스', has('.rk3d__cv'))
    check('B2 부위 탭 5개', count('.rk3d__tab') == 5, count('.rk3d__tab'))
    painted3d = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv'); if (!c) return 0;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) { if (d[i] + d[i+1] + d[i+2] > 120) n++; }
      return n;
    }""")
    check('B2 3D 라켓이 그려졌다', painted3d > 80, painted3d)
    shot('rk3d_open', keep=True)

    box = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height }; }""")
    yaw0 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(box['x'] + box['w'] / 2, box['y'] + box['h'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + box['w'] / 2 + 110, box['y'] + box['h'] / 2 - 20, steps=8)
    page.mouse.up()
    page.wait_for_timeout(300)
    yaw1 = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('B2 끌면 라켓이 돌아간다', abs(yaw1 - yaw0) > 0.4, (round(yaw0, 2), round(yaw1, 2)))
    shot('rk3d_rotated', keep=True)
    # 돌린 각도에서 그립을 직접 누른다
    page.evaluate("""() => { BM.racketcustom._last3d.view.pitch = 0.14; BM.racketcustom._last3d.redraw(); }""")
    pt = page.evaluate("""() => {
      const v = BM.racketcustom._last3d.view;
      const p = BM.racketcustom.project3({ x: 0, y: 240, z: 0 }, v);
      const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x + p.x, y: r.y + p.y, hit: BM.racketcustom.hitSlot(p.x, p.y, v) };
    }""")
    check('B2 그립 위치가 그립으로 잡힌다', pt['hit'] == 'grip', pt)
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_timeout(700)
    check('B2 그립 탭이 바로 열린다', (text_of('.rk3d__tab.is-on') or '').strip() == '그립', text_of('.rk3d__tab.is-on'))
    vis = page.evaluate("() => [...document.querySelectorAll('.rkgroup')].filter(g => !g.hidden).map(g => g.dataset.rkGroup)")
    check('B2 그립 파츠만 보인다', vis == ['grip'], vis)
    shot('rk3d_griptab', keep=True)
    # 거트(스트링 면) 직접 탭
    page.evaluate("""() => { BM.racketcustom._last3d.view.yaw = -0.2; BM.racketcustom._last3d.view.pitch = 0.1; BM.racketcustom._last3d.redraw(); }""")
    page.wait_for_timeout(200)
    hp = page.evaluate("""() => {
      const v = BM.racketcustom._last3d.view;
      const p = BM.racketcustom.project3({ x: 0, y: 0, z: 0 }, v);
      const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
      return { x: r.x + p.x, y: r.y + p.y, hit: BM.racketcustom.hitSlot(p.x, p.y, v) };
    }""")
    check('B2 헤드 가운데가 거트로 잡힌다', hp['hit'] == 'string', hp)
    page.mouse.click(hp['x'], hp['y'])
    page.wait_for_timeout(600)
    check('B2 거트 탭이 열린다', (text_of('.rk3d__tab.is-on') or '').strip() == '거트', text_of('.rk3d__tab.is-on'))
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(350)

    # ── C. 일지 10개 → 100P → 스트링 화이트 해금 · 입기 ──
    page.evaluate("""() => {
      /* 앱의 저장 흐름 그대로 일지 10개 (과거 날짜) */
      const a = BM.app.ctx.actions, st = BM.app.ctx.store.state;
      for (let i = 0; i < 10; i++) {
        st.locks = {};
        a.setDraft({ date: '2026-11-' + String(10 + i).padStart(2, '0'), minutes: 60 });
        a.saveLog();
      }
      st.locks = {};
      a.resetDraft();
    }""")
    page.wait_for_timeout(900)
    points = page.evaluate("() => BM.racketcustom.pointsBalance(BM.app.ctx.store.state)")
    check('C 일지 10개 → 100P (기존 기록 자동 지급)', points >= 100, points)

    tap('#hdrRacket', 700)
    tap('.rk3d__tab[data-rk-slot="string"]', 500)
    page.evaluate("""() => {
      const b = [...document.querySelectorAll('[data-rk-part]')].find(x => x.getAttribute('data-rk-part') === 'string:white');
      if (b) b.scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(250)
    yaw_before = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    tap('[data-rk-part="string:white"]', 700)
    yaw_after = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('C 색을 바꿔도 보던 각도가 유지된다', abs(yaw_after - yaw_before) < 0.25,
          (round(yaw_before, 2), round(yaw_after, 2)))
    st = page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me)")
    check('C 스트링 화이트를 한 번에 열어 입었다', st.get('string') == 'white' and 'string:white' in st.get('unlocked', []), st)
    check('C 잠금 표시가 풀린 파츠가 있다', count('.rkpart.is-lock') < 20, count('.rkpart.is-lock'))
    check('C 되돌리기 줄이 보인다', has('[data-rk-undo]'))
    left = page.evaluate("() => BM.racketcustom.pointsBalance(BM.app.ctx.store.state)")
    check('C 100P에서 30P를 쓰고 70P', left == 70, left)
    shot('sheet_unlock', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(300)

    # ── C2. 9일 쉰 상태 — 줄이 끊어진 모습 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records.forEach(r => { r.date = '2026-11-17'; });
      BM.app.ctx.repaint();
    }""")
    page.wait_for_timeout(500)
    cls = page.evaluate("() => document.getElementById('hdrRacket').className")
    check('C2 9일 쉬면 헤더 라켓이 끊어진 상태', 'is-broken' in cls, cls)
    shot('header_broken', keep=True)
    tap('#hdrRacket', 600)
    check('C2 시트에 끊어진 상태 카드', has('.rkhero--broken'))
    shot('sheet_broken', keep=True)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(300)

    # ── D. 일지 저장 → 스매시 연출 → 공유 바 → 스매시 카드 ──
    tap("#tabbar [data-tab='log']", 600)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.intensity = 6;
      st.drafts.log.weakness = ['풋워크'];
    }""")
    tap('[data-act="save-log"]', 260)
    check('D 저장 직후 스매시 연출이 화면에 뜬다', has('#smashburst'))
    # 저장 직후 부드러운 스크롤·애니메이션이 도는 중이라, 캡처용으로 그 순간을 잠깐 멈춰 찍습니다
    page.evaluate("""() => {
      const n = document.getElementById('smashburst');
      if (n) n.querySelectorAll('*').forEach(function (e) { e.style.animationPlayState = 'paused'; });
      window.scrollTo(0, window.scrollY);
    }""")
    page.wait_for_timeout(90)
    shot('smash_burst', keep=True)
    page.wait_for_timeout(900)
    check('D 연출은 0.88초면 사라진다', not has('#smashburst'))
    check('D 화면 아래 공유 바', has('#saveShare') and not page.locator('#saveShare').is_hidden())
    check('D 공유 바 문구', '방금 쓴 오늘 운동 그대로 공유하기' in text_of('#saveShare'), text_of('#saveShare')[:100])
    check('D 공유 바에 +P', 'P' in text_of('#saveShare'), text_of('#saveShare')[:100])
    shot('saveshare_bar', keep=True)

    page.locator('#saveShare [data-act="share-card"]').first.click()
    page.wait_for_timeout(900)
    check('D 스매시 배너가 켜진 채로 열린다', has('.sc__smashban.is-on'))
    check('D 미리보기 캔버스', has('.sc__canvas'))
    check('D 배너에 선택됨 표시', '켜짐' in text_of('.sc__smashban'))
    summ = text_of('[data-sc-summary]')
    check('D 카드 요약에 스매시 임팩트', '스매시 임팩트' in summ, summ[:140])
    # 캔버스가 실제로 그려졌는지(빈 캔버스가 아닌지) — 픽셀 몇 개를 훑습니다
    painted = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      if (!c) return 0;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4000) { if (d[i] + d[i+1] + d[i+2] > 90) n++; }
      return n;
    }""")
    check('D 캔버스에 그림이 그려졌다', painted > 50, painted)
    shot('share_smash', keep=True)

    # 라켓·친구 코드 토글
    page.evaluate("""() => {
      const n = document.querySelector('[data-sc-rackettoggle]');
      if (n) n.scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(250)
    if has('[data-sc-rackettoggle]'):
        tap('[data-sc-rackettoggle]', 400)
        off = page.evaluate("() => BM.sharecard._state().racket")
        check('D 라켓 토글이 꺼진다', off is False, off)
        tap('[data-sc-rackettoggle]', 400)
        on = page.evaluate("() => BM.sharecard._state().racket")
        check('D 다시 켜진다', on is True, on)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(300)

    # ── E. 매칭 — 카드·프로필의 라켓 ──
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util;
      const rowsKey = Object.keys(localStorage).filter(k => k.indexOf('bm_rows_v1') === 0)[0] || 'bm_rows_v1';
      const rows = JSON.parse(localStorage.getItem(rowsKey) || '[]');
      const key = 'demo_racket';
      rows.push(D.toRow({ id: U.uid(), type: '프로필', createdAt: '2026-11-25 10:00:00',
        nick: '콕집사', level: 'B조', discipline: '복식', userKey: key,
        theme: { theme: 'th_night', avatar: '🐧', gear: { custom: { frame: 'red', string: 'gold', unlocked: ['frame:red', 'string:gold'] } } } }));
      rows.push(D.toRow({ id: U.uid(), type: '매칭프로필', createdAt: '2026-11-25 10:05:00',
        userKey: key, nick: '콕집사',
        payload: { region: '경기', level: 'B조', discipline: '복식', club: '나래울',
          availability: '주말', experience: '2~5년', bio: '라켓 테스트용 가상 회원',
          avatar: '🐧', gender: '남성' } }));
      localStorage.setItem(rowsKey, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap("#tabbar [data-tab='matching']", 900)
    if not count('.pcard__rk'):
        page.evaluate("""() => {
          const st = BM.app.ctx.store.state;
          st.ui.matchStarted = true;
          BM.app.ctx.actions.resetMatchFilter();
        }""")
        page.wait_for_timeout(700)
    check('E 선수 카드에 라켓', count('.pcard__rk') > 0, count('.pcard__rk'))
    page.evaluate("""() => { const c = document.querySelector('.pcard'); if (c) c.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(450)
    shot('matching_racket', keep=True)
    if count('[data-open-profile]'):
        page.locator('[data-open-profile]').first.click()
        page.wait_for_timeout(650)
        check('E 프로필 시트에 라켓 줄', has('.pp__racket'))
        check('E 친구 코드 초대 버튼', has('.pp__invite'))
        shot('profile_racket', keep=True)
        page.evaluate("() => BM.ui.closeSheet()")
        page.wait_for_timeout(250)

    # ── F. 오버플로 · 콘솔 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(400)
        ov = overflow()
        check('F 가로 넘침 없음 (' + str(w) + ')', ov[0] <= ov[1], ov)
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:3])

    browser.close()
    httpd.shutdown()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)), flush=True)
if errs:
    print('콘솔 오류:', errs[:5], flush=True)
if csp:
    print('CSP:', csp[:3], flush=True)
raise SystemExit(0 if ok == len(checks) else 1)
