"""bm-v1.85.0 로컬 점검 (390×844) — 1:1 매칭 실시간 · 3D 라켓·모션·임팩트 · 하트로 파츠 · 라켓 기록 유지

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·CDN 요청은 막습니다).
  A) 버전 — sw bm-v1.85.0 · app/push v1.85.0 · styles.css?v=20261126-7 · TWA 1.85.0/78 · 5개 탭
  B) 꾸미기 배치 — 3D → [테두리…효과] 탭 → 선택창이 바로 아래 → 줄 상태·컨디션·하트 지갑
  C) 하트 — 포인트(P) 표기 없음 · 보유 하트 · 잠긴 파츠 '❤ n' · 하트 부족 안내 · 관리자 전체 해금
  D) 기록 유지 — 라켓·텐션 입력 → 저장 → 닫기 → 재오픈 → poll() → 재오픈에도 그대로
  E) 3D — 캔버스에 실제로 그려짐 · 헤드가 달걀 곡선(네모 아님) · 불/얼음/바닥 강타 캡처
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390 · 360)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v184.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V184_PORT', '8885'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V184_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V184_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
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
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
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

    def shot(name, path=None):
        target = path or (SHOTS + '/v185_' + name + '.png')
        page.screenshot(path=target, full_page=False)
        print('  saved ' + target, flush=True)
        return target

    def login(email, nick):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: a.email, name: a.nick,
              at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
              profile: { nick: a.nick, level: '선수부', discipline: '복식', region: '경기',
                         club: '매원고', onboardedAt: '2026-11-26 15:00:00' } }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    # ── A. 버전 ──
    check('A sw.js bm-v1.85.0', "var VERSION = 'bm-v1.85.0'" in read('sw.js'))
    check('A app.js v1.85.0', "version: 'v1.85.0'" in read('app.js'))
    check('A js/push.js v1.85.0', "version: 'v1.85.0'" in read('js/push.js'))
    check('A styles.css?v=20261126-7', 'styles.css?v=20261126-7' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.85.0 / 78', '"appVersionName": "1.85.0"' in twa and '"appVersionCode": 79' in twa)
    check('A SQL 파일', os.path.exists(os.path.join(ROOT, 'supabase/heart-rpc-v1.84-racket.sql')))

    # ── B~E. 관리자 계정(전체 해금) ──
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1200)
    login('csw42060713@gmail.com', '차승우')
    check('A 5개 탭', page.locator('#tabbar [data-tab]').count() == 5,
          page.locator('#tabbar [data-tab]').count())
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(700)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1200)

    # B. 배치: 탭 → 선택창이 바로 아래
    order = page.evaluate("""() => {
      const pick = document.querySelector('[data-rk-pick]');
      const tabs = document.querySelector('.rk3d__tabs');
      const group = document.querySelector('.rkgroup');
      const age = document.querySelector('.rkage');
      const hero = document.querySelector('.rkhero');
      const hearts = document.querySelector('.rkhearts');
      const top = (n) => n ? Math.round(n.getBoundingClientRect().top) : -1;
      return { pick: top(pick), tabs: top(tabs), group: top(group), age: top(age), hero: top(hero), hearts: top(hearts) };
    }""")
    check('B 탭이 선택창 묶음 안', order['pick'] <= order['tabs'] and order['tabs'] > 0, order)
    check('B 선택창이 탭 바로 아래', 0 < order['group'] - order['tabs'] < 260, order)
    check('B 줄 상태는 선택창 아래', order['age'] > order['group'], order)
    check('B 컨디션·하트 지갑은 그 아래', order['hero'] > order['age'] and order['hearts'] > order['hero'], order)
    check('B 포인트(P) 안내 없음', page.locator('.rkpoints').count() == 0, page.locator('.rkpoints').count())
    check('B 하트 지갑 보임', page.locator('.rkhearts').count() == 1)
    check('B 관리자 안내', '관리자' in (page.locator('.rkhearts').inner_text() or ''))
    body = page.locator('.sheet__body').inner_text()
    check('B P 단위 없음', 'P로 열' not in body and '라켓 포인트' not in body)
    shot('sheet_admin')

    # 관리자: 잠긴 파츠를 눌러도(첫 탭 미리보기 → 두 번째 탭) 하트 없이 열린다
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:carbon\"]'); if (b) b.click(); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:carbon\"]'); if (b) b.click(); }")
    page.wait_for_timeout(700)
    check('B 관리자 전체 해금(하트 0)', page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const c = BM.racketcustom.customOf(st.me);
      return BM.racketcustom.isUnlocked(c, 'frame', 'carbon') && c.frame === 'carbon';
    }"""))

    # D. 기록 유지: 입력 → 저장 → 닫기 → 재오픈 → poll() → 재오픈
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.click('[data-act="gear-sheet"]')
    page.wait_for_timeout(600)
    page.fill('[data-gear="racket"]', '아스트록스77')
    page.fill('[data-gear="tension"]', '29')
    page.evaluate("() => document.querySelector('[data-gear-save]').click()")
    page.wait_for_timeout(1000)
    page.click('[data-act="gear-sheet"]')
    page.wait_for_timeout(600)
    v1 = (page.input_value('[data-gear="racket"]'), page.input_value('[data-gear="tension"]'))
    page.evaluate("() => document.querySelector('[data-close=\"1\"]').click()")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.app.ctx.store.actions.poll()")
    page.wait_for_timeout(1400)
    page.click('[data-act="gear-sheet"]')
    page.wait_for_timeout(600)
    v2 = (page.input_value('[data-gear="racket"]'), page.input_value('[data-gear="tension"]'))
    check('D 재오픈에도 라켓·텐션 유지', v1 == ('아스트록스77', '29'), v1)
    check('D poll() 뒤에도 유지', v2 == ('아스트록스77', '29'), v2)
    page.evaluate("() => document.querySelector('[data-close=\"1\"]').click()")
    page.wait_for_timeout(300)

    # C. 일반 계정 — 하트 부족 안내 · 잠긴 파츠 표시
    login('check184@example.com', '점검왕')
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(600)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1000)
    # 하트 3개(기본) → 로열 네이비(3하트)를 열면 잔액 0
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:navy\"]'); if (b) b.click(); }")
    page.wait_for_timeout(600)
    t1 = page.evaluate("() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : ''")
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:navy\"]'); if (b) b.click(); }")
    page.wait_for_timeout(900)
    t2 = page.evaluate("() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : ''")
    opened = page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const c = BM.racketcustom.customOf(st.me);
      return { on: BM.racketcustom.isUnlocked(c, 'frame', 'navy'), hearts: BM.racketcustom.heartNow(st) };
    }""")
    check('C 첫 탭은 미리보기 안내', ('한 번 더' in t1) or ('❤' in t1), t1)
    check('C 두 번째 탭에 하트로 열린다', ('열었어요' in t2) and opened['on'] is True, (t2, opened))
    check('C 하트가 실제로 빠졌다', opened['hearts'] < 3, opened)
    # 이제 잔액 0 — 다른 잠긴 파츠는 열리지 않고 부족 안내
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:carbon\"]'); if (b) b.click(); }")
    page.wait_for_timeout(500)
    page.evaluate("() => { const b = document.querySelector('[data-rk-part=\"frame:carbon\"]'); if (b) b.click(); }")
    page.wait_for_timeout(800)
    t3 = page.evaluate("() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : ''")
    locked = page.evaluate("""() => {
      const c = BM.racketcustom.customOf(BM.app.ctx.store.state.me);
      return BM.racketcustom.isUnlocked(c, 'frame', 'carbon');
    }""")
    check('C 하트가 모자라면 부족 안내', '부족' in t3, t3)
    check('C 하트가 모자라면 열리지 않는다', locked is False, locked)

    # E. 3D 캔버스 — 실제로 그려졌는지(픽셀) + 헤드 곡선
    canvas = page.evaluate("""() => {
      const c = document.querySelector('.rk3d__cv');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let painted = 0, green = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 8) painted++;
        if (d[i + 1] > 150 && d[i] < 220 && d[i + 2] < 160) green++;
      }
      return { painted: painted, green: green, w: c.width, h: c.height };
    }""")
    check('E 3D 캔버스에 그림이 있다', canvas['painted'] > 20000, canvas)
    check('E 거트(라임)가 보인다', canvas['green'] > 1500, canvas)
    shape = page.evaluate("""() => {
      const RC = BM.racketcustom;
      const out = {};
      RC.BODY_IDS.forEach((id) => {
        const gm = RC.geomOf({ body: id });
        const half = gm.profile;
        let wide = 0, flat = 0;
        half.forEach((p) => { wide = Math.max(wide, Math.abs(p[0])); });
        for (let i = 1; i < half.length; i++) {
          if (Math.abs(half[i][0] - half[i - 1][0]) < 0.012 && Math.abs(half[i][0]) > 0.9) flat++;
        }
        out[id] = { n: half.length, wide: +wide.toFixed(3), flat: flat };
      });
      return out;
    }""")
    check('E 실루엣 촘촘(≥18점)·정규화', all(v['n'] >= 18 and abs(v['wide'] - 1) < 0.02 for v in shape.values()), shape)
    check('E 옆구리 직선 없음(네모 아님)', all(v['flat'] <= 1 for v in shape.values()), shape)

    # 3D 캔버스만 크게 캡처 (요청 파일 이름)
    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")
    page.screenshot(path=OUT + '/v185_racket_3d.png', clip=box)
    print('  saved ' + OUT + '/v185_racket_3d.png', flush=True)

    # E. 스매시 연출 캡처 — 불 · 얼음 · 바닥 강타
    page.evaluate("""() => {
      const b = document.querySelector('[data-rk-part="effect:fire"]');
      if (b) { b.click(); }
    }""")
    page.wait_for_timeout(500)
    for ms, name in [(360, 'smash_fire'), (520, 'smash_fire_fly')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(a, 'air'); }""", ms)
        page.wait_for_timeout(240)
        page.screenshot(path=OUT + '/v185_' + name + '.png', clip=box)
        print('  saved ' + OUT + '/v185_' + name + '.png', flush=True)
    for ms, name in [(360, 'smash_ice'), (560, 'smash_ice_fly')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.smash('ice'); s.hold(a, 'air'); }""", ms)
        page.wait_for_timeout(240)
        page.screenshot(path=OUT + '/v185_' + name + '.png', clip=box)
        print('  saved ' + OUT + '/v185_' + name + '.png', flush=True)
    for ms, name in [(420, 'slam_hit'), (520, 'slam_break')]:
        page.evaluate("""(a) => { const s = BM.racketcustom._last3d; s.slam('fire'); s.hold(a, 'slam'); }""", ms)
        page.wait_for_timeout(240)
        page.screenshot(path=OUT + '/v185_' + name + '.png', clip=box)
        print('  saved ' + OUT + '/v185_' + name + '.png', flush=True)
    check('E 바닥 강타 버튼', page.locator('[data-rk-slam="1"]').count() == 1)

    # 회전(드래그) 모션 — 끌고 놓으면 관성으로 계속 돈다
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.resume(); }")
    page.wait_for_timeout(300)
    before = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + 120)
    page.mouse.down()
    for i in range(6):
        page.mouse.move(box['x'] + box['width'] / 2 + (i + 1) * 18, box['y'] + 120, steps=2)
        page.wait_for_timeout(16)
    page.mouse.up()
    mid = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    page.wait_for_timeout(260)
    after = page.evaluate("() => BM.racketcustom._last3d.view.yaw")
    check('E 끌면 돌아간다', abs(mid - before) > 0.05, round(mid - before, 3))
    check('E 손을 떼도 관성으로 조금 더 돈다', abs(after - mid) > 0.002, round(after - mid, 4))

    # F. 넘침·콘솔
    check('F 390 넘침 없음', overflow()[0] <= overflow()[1] + 1, overflow())
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(500)
    check('F 360 넘침 없음', overflow()[0] <= overflow()[1] + 1, overflow())
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)
    shot('sheet_390')

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

ok = sum(1 for _, v in checks if v)
print('\n%d/%d 통과' % (ok, len(checks)), flush=True)
raise SystemExit(0 if ok == len(checks) else 1)
