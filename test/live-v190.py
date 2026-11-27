"""bm-v1.90.0 라이브 점검 — 390×844 · 효과 가시성 · 스매시 임팩트 · 효과별 소리
콘솔 0 · CSP 0 · 가로 넘침 0 · 404 없음.

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v190.py
결과: /workspace/downloads/v190_live_*.png
"""
import os
import time

from playwright.sync_api import sync_playwright

BASE = os.environ.get('V190_BASE') or 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

FLAGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox']

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None, args=FLAGS)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    errs, bad, csp = [], [], []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('response', lambda r: bad.append(r.url + ' ' + str(r.status)) if r.status >= 400 else None)
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
      window.__snd = { osc: 0, buf: 0 };
      (function () {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const po = AC.prototype.createOscillator, pb = AC.prototype.createBufferSource;
        AC.prototype.createOscillator = function () { window.__snd.osc++; return po.apply(this, arguments); };
        AC.prototype.createBufferSource = function () { window.__snd.buf++; return pb.apply(this, arguments); };
      })();
    """)
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(2500)
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'csw42060713@gmail.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version,
               sound: !!(window.BM && BM.smashsound),
               layersFire: BM.smashsound ? BM.smashsound.layers('fire').length : 0 };
    })""")
    print('version', ver, flush=True)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.data.hearts = { balance: 40, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      st.me.theme.gear = { custom: { body: 'smash',
        unlocked: ['body:smash', 'frame:onyx', 'string:cobalt', 'grip:twotone', 'stencil:crown', 'charm:ace', 'effect:fire'],
        frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'fire' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1800)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.40; s.view.pitch = 0.10; s.fit(); }")
    page.wait_for_timeout(400)

    def clip():
        page.evaluate("() => document.querySelector('.rk3d__cv').scrollIntoView({block:'center'})")
        page.wait_for_timeout(160)
        bb = page.evaluate("""() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();
          return {x:r.x,y:r.y,width:r.width,height:r.height}; }""")
        return {'x': max(0, bb['x']), 'y': max(0, bb['y']),
                'width': min(390 - max(0, bb['x']), bb['width']),
                'height': min(844 - max(0, bb['y']), bb['height'])}

    def set_effect(eff):
        page.evaluate("""(eff) => {
          const st = BM.app.ctx.store.state;
          st.me.theme.gear = { custom: { body: 'smash',
            unlocked: ['body:smash','frame:onyx','string:cobalt','grip:twotone','stencil:crown','charm:ace','effect:' + eff],
            frame: 'onyx', string: 'cobalt', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: eff } };
          const s = BM.racketcustom._last3d;
          s.view.yaw = -0.40; s.view.pitch = 0.10; s.paint();
        }""", eff)
        page.wait_for_timeout(800)

    def shot(name, wait=350):
        page.wait_for_timeout(wait)
        page.screenshot(path=OUT + '/%s.png' % name, clip=clip())
        print('saved ' + name, flush=True)

    # 1) 효과 — 불 · 얼음 · 블레이즈 (요청 파일 이름 그대로)
    shot('v190_live_effect_fire', 700)
    set_effect('ice')
    shot('v190_live_effect_ice', 700)
    set_effect('blaze')
    shot('v190_live_effect_blaze', 700)
    set_effect('thunder')
    shot('v190_live_effect_thunder', 700)

    # 2) 정타 순간 — 실제 탭으로 스매시하고 히트스톱 프레임
    set_effect('fire')
    page.evaluate("() => { window.__snd = { osc: 0, buf: 0 }; }")
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(352); }")
    shot('v190_live_smash_hit', 400)
    print('sound', page.evaluate("() => window.__snd"), flush=True)

    # 3) 날아오는 장면 · 발사 장면
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(210); }")
    shot('v190_live_smash_incoming', 350)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.smash('ice'); s.hold(475); }")
    shot('v190_live_smash_launch', 350)

    # 4) 실제 손가락 탭 → 소리 합성 확인 (사용자 손짓 경로 그대로)
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(900)
    page.evaluate("() => { window.__snd = { osc: 0, buf: 0 }; }")
    cv = page.query_selector('.rk3d__cv')
    bb = cv.bounding_box()
    page.mouse.click(bb['x'] + bb['width'] * 0.5, bb['y'] + bb['height'] * 0.42)
    page.wait_for_timeout(900)
    print('tap sound', page.evaluate("() => window.__snd"), flush=True)

    # 5) 시트 전체 · 소리 단추
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.fit(); }")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v190_live_sheet.png')
    print('saved v190_live_sheet', flush=True)
    print('sound button', page.evaluate("""() => {
      const b = document.querySelector('[data-rk-sound]');
      return b ? { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') } : null;
    }"""), flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print('overflow', overflow, flush=True)
    print('csp', page.evaluate("() => window.__csp || []"), flush=True)
    print('bad_responses', [u for u in bad if 'supabase' not in u and 'google' not in u][:8], flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e and 'net::' not in e]), flush=True)
    for e in errs[:8]:
        print('  ', e[:200], flush=True)
    b.close()
