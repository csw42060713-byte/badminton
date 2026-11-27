"""bm-v1.95.0 로컬 점검 (390×844) — ⚡ 라켓 아래 오라 · 노랑 풀세트 전체 낙뢰 · 히든 7종 · 새 그립/임팩트

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.95.0 · app.js v1.95.0 · styles.css?v=20261128-1 · TWA 1.95.0/89 · 5개 탭
  B) 세트 배지 — 3D 아래 조합 배지·도감 · 히든 7행이 ??? 로 숨음 · 0/7 발견
  C) 노랑 풀세트 — 골드 프레임+거트+그립을 차례로 눌러 발동 · '썬더 골드 풀세트 발동!' ·
     3D 장면에 번개 줄기(LineSegments)가 실제로 켜진다 · 캡처(v195_live_aura_gold.png)
  D) 히든 — 팬텀 라이트닝 조합(오닉스·블랙·바이올렛·보이드) → 축하 토스트 · 1/7 발견 ·
     발견 뒤 이름 표시 · 캡처(v195_live_hidden_phantom.png)
  E) 새 그립·임팩트 — 그립 15종 · 효과 14종 · 골드/천공 그립 3D 재질 · 오로라 연출
  F) 성능 — 번개가 켜진 동안 프레임 간격(대략 60fps 예산) · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v195.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V195_PORT', '8895'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V195_OUT', '/workspace/downloads')

checks, errs, csp = [], [], []


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
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR',
                              service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text)
            return
        if 'ERR_FAILED' in m.text or 'Failed to load resource' in m.text:
            return
        errs.append(m.text)

    page.on('console', on_console)

    def has(sel):
        return page.locator(sel).count() > 0

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    # ── A. 버전 ──
    check('A sw.js bm-v1.95.0', "var VERSION = 'bm-v1.95.0'" in read('sw.js'))
    check('A index styles.css?v=20261128-1', 'styles.css?v=20261128-1' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.95.0 · 코드 89', '"appVersionName": "1.95.0"' in twa and '"appVersionCode": 89' in twa)
    check('A SQL v1.95-all 준비', os.path.exists(os.path.join(ROOT, 'supabase/heart-rpc-v1.95-all.sql')))

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'csw42060713@gmail.com', name: '승우',
                    at: new Date().toISOString(), onboardedAt: '2026-11-28 07:00:00',
                    profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-28 07:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('A 앱 버전 v1.95.0', page.evaluate("() => BM.app.version") == 'v1.95.0',
          page.evaluate("() => BM.app.version"))
    check('A 관리자 전체 해금', page.evaluate("() => BM.racketcustom.isAdminUser(BM.app.ctx.store.state)"))
    check('A 5개 탭 그대로', page.evaluate("() => BM.app.TABS.map(t => t.id)") ==
          ['log', 'matching', 'community', 'coach', 'my'])

    # ── B. 꾸미기 시트 · 조합 배지 ──
    page.click('#hdrRacket')
    page.wait_for_timeout(1200)
    check('B 3D 쇼룸 열림', has('[data-rk-3d]') and has('.rk3d__cv'))
    check('B 조합 배지 있음', has('[data-rk-set]'))
    check('B 도감 접기 있음', has('.rkset__book'))
    page.locator('.rkset__book summary').first.click()
    page.wait_for_timeout(350)
    check('B 히든 ??? 로 숨김', '??? 히든 조합' in text_of('.rkset'), text_of('.rkset__list')[:60])
    page.locator('.rkset__book summary').first.click()
    page.wait_for_timeout(250)
    check('B 히든 0/7 발견', '히든 0/7 발견' in text_of('.rkset'), text_of('.rkset__meta'))
    page.screenshot(path=os.path.join(OUT, 'v195_local_sheet.png'), full_page=False)

    # ── C. 노랑 풀세트 = 전체 낙뢰 ──
    def pick(slot, pid):
        page.locator('[data-rk-slot="%s"][role="tab"]' % slot).first.click()
        page.wait_for_timeout(450)
        page.locator('[data-rk-part="%s:%s"]' % (slot, pid)).first.click()
        page.wait_for_timeout(750)

    pick('frame', 'gold')
    pick('string', 'gold')
    pick('grip', 'gold')
    page.wait_for_timeout(900)
    body = page.evaluate("() => document.querySelector('.rkset').innerText")
    check('C 썬더 골드 풀세트 발동', '썬더 골드 풀세트 발동' in body, body[:80])
    check('C 전체 낙뢰 문구', '전체 낙뢰' in body)
    check('C 3/3 파츠 완성', '3/3 파츠 완성' in body)
    check('C 배지에 세트 id', page.evaluate("() => document.querySelector('.rkset').getAttribute('data-rk-set')") == 'thunderGold')
    # 3D 장면에 번개 줄기가 실제로 있다
    page.evaluate("() => BM.racketcustom._last3d.setburst('thunderGold', 6000)")
    page.wait_for_timeout(180)
    bolt = page.evaluate("""() => {
      const s = BM.racketcustom._last3d.dbg().scene;
      let n = 0, lit = 0, floor = 0;
      s.traverse(o => {
        if (o.isLineSegments) { n++; if (o.material && o.material.opacity > 0.2) lit++; }
        if (o.isMesh && o.material && o.material.map) floor++;
      });
      let pts = 0;
      s.traverse(o => { if (o.isPoints && o.visible) pts++; });
      return { lines: n, lit: lit, sprites: pts };
    }""")
    check('C 번개 줄기 3개 이상', bolt['lines'] >= 3, bolt)
    check('C 번개가 켜져 있다', bolt['lit'] >= 3, bolt)
    page.evaluate("() => { const v = BM.racketcustom._last3d.view; v.yaw = -0.3; v.pitch = 0.18; BM.racketcustom._last3d.redraw(); }")
    page.evaluate("() => BM.racketcustom._last3d.setburst('thunderGold', 20000)")
    page.wait_for_timeout(150)
    page.locator('.rk3d').first.screenshot(path=os.path.join(OUT, 'v195_live_lightning.png'))
    page.evaluate("() => BM.racketcustom._last3d.setburst('thunderGold', 20000)")
    page.wait_for_timeout(120)
    page.screenshot(path=os.path.join(OUT, 'v195_live_aura_gold.png'), full_page=False)
    page.locator('.rkset').first.screenshot(path=os.path.join(OUT, 'v195_live_set_badge.png'))
    # 오라 — 바닥 오라 그룹이 장면에 있다
    aura = page.evaluate("""() => {
      const s = BM.racketcustom._last3d.dbg().scene;
      let meshes = 0, planes = 0;
      s.traverse(o => { if (o.isMesh && o.material && o.material.blending === 2) meshes++; });
      return { additive: meshes };
    }""")
    check('C 바닥 오라 가산 레이어 여러 장', aura['additive'] >= 8, aura)

    # ── D. 히든 7종 — 팬텀 라이트닝 발견 ──
    pick('frame', 'onyx')
    pick('string', 'black')
    pick('grip', 'violet')
    pick('effect', 'void')
    page.wait_for_timeout(1100)
    body2 = page.evaluate("() => document.querySelector('.rkset').innerText")
    check('D 팬텀 라이트닝 발동', '팬텀 라이트닝' in body2, body2[:100])
    check('D 히든 1/7 발견', '히든 1/7 발견' in body2, body2[:140])
    found = page.evaluate("() => BM.racketcustom.foundOf(BM.racketcustom.customOf(BM.app.ctx.store.state.me))")
    check('D 발견 기록 저장', found == ['phantom'], found)
    check('D 축하 토스트', '히든 조합 발견' in (page.locator('#toast').inner_text() if has('#toast') else ''),
          page.locator('#toast').inner_text() if has('#toast') else '')
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.racketcustom._last3d.setburst('phantom', 20000)")
    page.wait_for_timeout(160)
    page.locator('.rk3d').first.screenshot(path=os.path.join(OUT, 'v195_live_hidden_phantom.png'))
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 340; }")
    page.wait_for_timeout(300)
    page.locator('.rkset').first.screenshot(path=os.path.join(OUT, 'v195_live_hidden_badge.png'))

    # ── E. 새 그립·임팩트 ──
    counts = page.evaluate("""() => ({
      grip: BM.racketcustom.itemsOf('grip').length,
      effect: BM.racketcustom.itemsOf('effect').length,
      frame: BM.racketcustom.itemsOf('frame').length,
      string: BM.racketcustom.itemsOf('string').length
    })""")
    check('E 그립 15 · 효과 14 · 프레임 11 · 거트 10', counts ==
          {'grip': 15, 'effect': 14, 'frame': 11, 'string': 10}, counts)
    # 오로라 임팩트로 바꿔 3D 연출 확인
    pick('effect', 'aurora')
    check('E 오로라 장착', page.evaluate("() => BM.racketcustom.customOf(BM.app.ctx.store.state.me).effect") == 'aurora')
    page.evaluate("() => { const v = BM.racketcustom._last3d.view; v.yaw = -0.3; v.pitch = 0.16; BM.racketcustom._last3d.redraw(); }")
    page.wait_for_timeout(400)
    page.locator('.rk3d').first.screenshot(path=os.path.join(OUT, 'v195_live_grip_aurora.png'))
    # 그립 탭 — 새 그립 색 카드가 보인다
    page.locator('[data-rk-slot="grip"][role="tab"]').first.click()
    page.wait_for_timeout(500)
    check('E 그립 탭에 골드/아이스 카드', has('[data-rk-part="grip:gold"]') and has('[data-rk-part="grip:ice"]'))

    # ── F. 성능 · 넘침 · 오류 ──
    page.evaluate("() => { BM.ui.closeSheet(); }")
    page.wait_for_timeout(500)
    ov390 = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('F 390 가로 넘침 없음', ov390[0] <= ov390[1], ov390)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(600)
    ov360 = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('F 360 가로 넘침 없음', ov360[0] <= ov360[1], ov360)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.click('#hdrRacket')
    page.wait_for_timeout(1000)
    cost = page.evaluate("""() => {
      const api = BM.racketcustom._last3d;
      api.setburst('phantom', 6000);
      const t0 = performance.now();
      for (let i = 0; i < 24; i++) api.paint();
      const dt = (performance.now() - t0) / 24;
      return Math.round(dt * 10) / 10;
    }""")
    check('F 번개 켠 한 프레임 그리기 33ms 이하(소프트웨어 렌더)', cost <= 33, {'ms': cost})
    check('F 세트 연출은 쉬는 동안 30fps 간격', 'setScene ? 32 : 60' in read('js/racket3d.js'))
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과 · 실패 %d' % (len(checks) - len(fails), len(checks), len(fails)))
if errs:
    print('콘솔 오류:', errs[:5])
if csp:
    print('CSP:', csp[:5])
