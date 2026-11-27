"""bm-v1.94.0 캡처·점검 — 390×844
  ① 드라이브·초구 노하우가 화면(AI 분석 카드 · 추천 드릴 · 전술 노트)에 보이는지
  ② 3D 셔틀 머리(코르크)와 정타 임팩트(스쿼시·별섬광)
  ③ 효과 7종 업그레이드 모습
  ④ 콘솔 에러 0 · CSP 위반 0 · 가로 넘침 0

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v194.py
라이브:  V194_LIVE=1 LD_LIBRARY_PATH=... python3 test/capture-v194.py
결과: /workspace/downloads/v194_*.png (+ v193_live_drive_tip.png · v193_live_shuttle_cork.png)
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V194_PORT', '8941'))
LIVE = os.environ.get('V194_LIVE', '') == '1'
BASE = 'https://csw42060713-byte.github.io/badminton/' if LIVE else 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
os.makedirs(OUT, exist_ok=True)

if not LIVE:
    class NoCache(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, max-age=0')
            super().end_headers()

        def log_message(self, *a):
            pass

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox',
         '--autoplay-policy=no-user-gesture-required']
EFFECTS = ['fire', 'ice', 'thunder', 'blaze', 'spark', 'speed', 'prism']
SET_GEAR = """(eff) => {
  const st = BM.app.ctx.store.state;
  st.me.theme.gear = { custom: { body: 'smash',
    unlocked: ['body:smash', 'frame:onyx', 'string:cobalt', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:' + eff],
    frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: eff } };
}"""
report = {}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None, args=FLAGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    if not LIVE:
        ctx.route('**/*', lambda r: r.abort()
                  if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
                  else r.continue_())
    errs = []
    page = ctx.new_page()
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1200)
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot194@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version, drive: !!(BM.ai.PRO_DRIVE && BM.ai.PRO_DRIVE.finger),
               plan: BM.racket3d && BM.racket3d.rev };
    })""")
    print('version', ver, flush=True)
    report['version'] = ver

    # ---------- ① AI 분석 카드: 드라이브 약점 ----------
    page.evaluate("""() => {
      const a = BM.app.ctx.store.actions;
      a.resetDraft();
      a.setDraft({ cond: 7, intensity: 6, minutes: 50, weakness: ['드라이브'] });
      a.analyze();
      location.hash = '#/log';
    }""")
    page.wait_for_timeout(1500)
    card = page.evaluate("""() => {
      const el = document.querySelector('[data-region="analysis"]');
      const drills = el ? Array.from(el.querySelectorAll('.drill')).map(d => d.innerText.replace(/\\s+/g, ' ')) : [];
      return { has: !!el, drills: drills };
    }""")
    joined = ' | '.join(card.get('drills') or [])
    print('drive_drills', [d[:90] for d in (card.get('drills') or [])][:3], flush=True)
    report['drive_visible'] = ('검지' in joined) and ('짧은 스윙' in joined)
    # 핵심 문장이 2줄 제한 안에 보이는지 — 첫 드릴 카드에서 바로 확인
    first_visible = page.evaluate("""() => {
      const el = Array.from(document.querySelectorAll('.drill__method')).find(m => m.innerText.indexOf('검지') >= 0);
      return el ? { clipped: el.scrollHeight - el.clientHeight, text: el.innerText.slice(0, 60) } : null;
    }""")
    print('drive_first_line', first_visible, flush=True)
    report['drive_clipped_px'] = (first_visible or {}).get('clipped')

    page.evaluate("""() => {
      const el = Array.from(document.querySelectorAll('.drill')).find(d => d.innerText.indexOf('검지') >= 0);
      if (el) el.scrollIntoView({block: 'center'});
    }""")
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v194_live_drive_drill.png')
    page.screenshot(path=OUT + '/v193_live_drive_tip.png')
    print('saved v193_live_drive_tip', flush=True)

    # ---------- 전술 노트: 초구 · 드라이브 싸움 ----------
    tips = page.evaluate("""() => {
      const d = document.querySelector('details[data-fold="extra"]');
      if (d && !d.open) d.querySelector('summary').click();
      return Array.from(d ? d.querySelectorAll('li') : []).map(e => e.innerText).join(' | ');
    }""")
    page.wait_for_timeout(700)
    print('tips_first_ball', '초구' in (tips or ''), '| drive_battle', '드라이브 싸움' in (tips or ''), flush=True)
    report['tips_first_ball'] = '초구' in (tips or '')
    report['tips_drive_battle'] = '드라이브 싸움' in (tips or '')
    page.evaluate("""() => {
      const d = document.querySelector('details[data-fold="extra"]');
      if (d) d.scrollIntoView({block: 'center'});
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v194_live_tips.png')

    # ---------- ② 3D 셔틀 머리 · 임팩트 ----------
    def boot3d(effect):
        page.evaluate(SET_GEAR, effect)
        page.evaluate("() => BM.racketcustom.openSheet(BM.app.ctx)")
        page.wait_for_timeout(1500)
        page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.fit(); }")
        page.wait_for_timeout(400)

    def shot_near(name, size=120, wait=200):
        """셔틀콕(코르크)이 화면 어디에 있는지 계산해 그 주변만 확대 캡처"""
        page.wait_for_timeout(wait)
        info = page.evaluate("""() => {
          const s = BM.racketcustom._last3d; const d = s.dbg();
          const cv = document.querySelector('.rk3d__cv');
          const r = cv.getBoundingClientRect();
          const sh = d.scene.children.find(o => o.userData && o.userData.cork);
          if (!sh) return null;
          const target = sh.userData.cork || sh;
          const v = new THREE.Vector3(); target.getWorldPosition(v); v.project(d.camera);
          return { x: r.x + (v.x * 0.5 + 0.5) * r.width, y: r.y + (-v.y * 0.5 + 0.5) * r.height };
        }""")
        if not info:
            return False
        cx, cy = info['x'], info['y']
        x = max(0, min(390 - size, cx - size / 2))
        y = max(0, min(844 - size, cy - size / 2))
        page.screenshot(path=OUT + '/%s.png' % name, clip={'x': x, 'y': y, 'width': size, 'height': size})
        print('saved ' + name + ' (close-up)', flush=True)
        return True

    def shot(name, wait=260):
        page.wait_for_timeout(wait)
        page.evaluate("() => document.querySelector('.rk3d__cv').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(200)
        bb = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x, y:r.y, width:r.width, height:r.height}; }""")
        clip = {'x': max(0, bb['x']), 'y': max(0, bb['y']),
                'width': min(390 - max(0, bb['x']), bb['width']),
                'height': min(844 - max(0, bb['y']), bb['height'])}
        page.screenshot(path=OUT + '/%s.png' % name, clip=clip)
        print('saved ' + name, flush=True)

    boot3d('ice')
    report['stage_3d'] = page.evaluate("() => !!(BM.racketcustom._last3d && BM.racketcustom._last3d.engine === 'three')")
    print('stage_3d', report['stage_3d'], flush=True)

    cork_info = page.evaluate("""() => {
      const s = BM.racketcustom._last3d;
      s.view.yaw = -0.62; s.view.pitch = 0.16;
      s.smash('ice'); s.hold(300);
      const d = s.dbg();
      const sh = d.scene.children.find(o => o.userData && o.userData.cork);
      const box = sh ? new THREE.Box3().setFromObject(sh) : null;
      return sh ? { visible: sh.visible,
        size: box ? [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z].map(v => Math.round(v)) : null,
        corkR: sh.userData.cork.geometry.parameters.radius,
        corkColor: '#' + sh.userData.cork.material.color.getHexString(),
        band: '#' + sh.userData.band.material.color.getHexString() } : null;
    }""")
    print('cork', cork_info, flush=True)
    report['cork'] = cork_info
    shot('v194_shuttle_incoming', 200)
    page.screenshot(path=OUT + '/v194_sheet_full.png')
    shot_near('v193_live_shuttle_cork', 96, 120)
    shot_near('v194_cork_closeup', 120, 60)

    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.62; s.view.pitch = 0.16; s.smash('ice'); s.hold(404); }")
    shot('v194_shuttle_impact', 220)
    shot_near('v194_impact_closeup', 140, 60)
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(900)

    # ---------- ③ 효과 7종 ----------
    for eff in EFFECTS:
        page.evaluate(SET_GEAR, eff)
        page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.paint(); }")
        page.wait_for_timeout(700)
        shot('v194_effect_' + eff, 500)

    # ---------- 성능(소프트웨어 GL 기준 참고값) ----------
    page.evaluate(SET_GEAR, 'fire')
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.paint(); }")
    page.wait_for_timeout(400)
    perf = page.evaluate("""() => new Promise(res => {
      let n = 0; const t0 = performance.now(); let last = t0, worst = 0;
      function tick(t) {
        n++; worst = Math.max(worst, t - last); last = t;
        if (t - t0 < 900) requestAnimationFrame(tick);
        else res({ fps: Math.round(n * 1000 / (t - t0)), worstMs: Math.round(worst) });
      }
      requestAnimationFrame(tick);
    })""")
    print('perf(swiftshader)', perf, flush=True)
    report['perf'] = perf

    # ---------- ④ 점검 수치 ----------
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    cspv = page.evaluate("() => window.__csp || []")
    real = [e for e in errs if 'ERR_FAILED' not in e and 'net::' not in e]
    print('overflow', overflow, flush=True)
    print('csp', cspv, flush=True)
    print('console_errors', len(real), flush=True)
    for e in real[:8]:
        print('  ', e[:200], flush=True)
    report['overflow'] = overflow
    report['csp'] = cspv
    report['errors'] = real[:8]
    b.close()

print('REPORT', report, flush=True)
