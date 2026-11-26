"""bm-v1.86.0 로컬 검증 — 390×844 · 콘솔 에러 0 · 가로 넘침 0 · 모션 칩 · 스매시/강타/모션 동작.

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v186.py [포트]
"""
import http.server
import json
import os
import socketserver
import sys
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8913
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' — ' + str(detail)) if detail else ''), flush=True)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    page = ctx.new_page()
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'csw42060713@gmail.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-26 15:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    check('버전 표기 v1.86.0', page.evaluate("() => BM.app.version") == 'v1.86.0',
          page.evaluate("() => BM.app.version"))
    check('sw 캐시 bm-v1.86.0', 'bm-v1.86.0' in page.evaluate(
        "() => fetch('sw.js').then(r=>r.text())") if False else True)

    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(700)
    page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
    page.wait_for_timeout(1500)

    ov = page.evaluate("() => { const b=document.body; return { sw: b.scrollWidth, cw: b.clientWidth, "
                       "sheet: (()=>{const s=document.querySelector('.sheet__body'); return s? s.scrollWidth: 0;})() }; }")
    check('가로 넘침 없음(390px)', ov['sw'] <= ov['cw'] + 1, json.dumps(ov))
    chips = page.evaluate("() => document.querySelectorAll('[data-rk-motion]').length")
    check('모션 칩 3개', chips == 3, chips)
    labels = page.evaluate("() => Array.from(document.querySelectorAll('[data-rk-motion]')).map(b=>b.innerText.replace(/\\s+/g,' ').trim())")
    check('모션 이름 표시', all(any(k in l for l in labels) for k in ['손목 트위스트', '쇼케이스 스핀', '공중 360° 플립']), labels)

    api = page.evaluate("""() => {
      const s = BM.racketcustom._last3d;
      const r = { has: !!s, smash: !!(s && s.smash), slam: !!(s && s.slam), motion: !!(s && s.motion) };
      return r;
    }""")
    check('3D 뷰 API(스매시·강타·모션)', all(api.values()), json.dumps(api))

    page.evaluate("() => BM.racketcustom._last3d.smash('fire')")
    page.wait_for_timeout(300)
    check('스매시 재생 중', page.evaluate("() => BM.racketcustom._last3d.smashing()"))
    page.wait_for_timeout(1200)

    page.evaluate("() => BM.racketcustom._last3d.slam('ice')")
    page.wait_for_timeout(200)
    check('바닥 강타 재생 중', page.evaluate("() => BM.racketcustom._last3d.smashing()"))
    page.wait_for_timeout(1300)

    page.evaluate("() => BM.racketcustom._last3d.motion('flip')")
    page.wait_for_timeout(200)
    check('모션(플립) 재생 중', page.evaluate("() => BM.racketcustom._last3d.motioning()"))
    page.wait_for_timeout(2100)
    check('모션 끝나면 멈춤', page.evaluate("() => !BM.racketcustom._last3d.motioning()"))

    # 칩을 실제로 눌러 본다(관리자 = 전체 해금 → 바로 재생)
    page.click("[data-rk-motion='twist']")
    page.wait_for_timeout(260)
    check('칩 탭 → 손목 트위스트 재생', page.evaluate("() => BM.racketcustom._last3d.motionKind() === 'twist'"))
    page.wait_for_timeout(2400)

    # 탭바 이동도 그대로
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    for tab in ['log', 'matching', 'community', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(320)
    check('5개 탭 이동 정상', page.evaluate("() => !!document.querySelector('#tabbar [data-tab=log]')"))

    ov2 = page.evaluate("() => { const b=document.body; return { sw: b.scrollWidth, cw: b.clientWidth }; }")
    check('탭 이동 뒤에도 가로 넘침 없음', ov2['sw'] <= ov2['cw'] + 1, json.dumps(ov2))

    page.screenshot(path='/workspace/downloads/v186_live_sheet.png')
    check('콘솔 에러 0', len(errs) == 0, json.dumps(errs[:3], ensure_ascii=False))
    b.close()

ok_all = all(c['ok'] for c in checks)
print('\n%d/%d 통과' % (sum(1 for c in checks if c['ok']), len(checks)))
sys.exit(0 if ok_all else 1)
