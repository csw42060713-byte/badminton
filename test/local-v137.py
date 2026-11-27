"""v1.37 로컬 화면 점검 — 저장소를 그대로 띄워 390×844에서 스플래시·시작화면을 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-v137.py
"""
import functools
import http.server
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = '/workspace/work/bm137'
OUT = '/workspace/tmp/v137local'
PORT = 8138
socketserver.TCPServer.allow_reuse_address = True
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()

BASE = 'http://127.0.0.1:%d/' % PORT
errs = []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    def new_page():
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        return ctx, pg

    # ── 1) 스플래시만 보이도록 app.js 응답을 늦춘다 (실제 렌더 그대로 촬영)
    import time
    for theme in ('th_def', 'th_night'):
        ctx, page = new_page()
        page.goto(BASE + 'index.html?t=' + theme, wait_until='commit')
        page.evaluate("""(th) => {
            localStorage.setItem('bm_cache_v1', JSON.stringify({ me: { theme: { theme: th } } }));
        }""", theme)
        page.route('**/app.js', lambda route: (time.sleep(2.6), route.continue_()))
        page.goto(BASE + 'index.html?slow=' + theme, wait_until='commit')
        page.wait_for_timeout(1500)
        info = page.evaluate("""() => {
            const sp = document.getElementById('splash');
            const tile = sp.querySelector('.splash__tile');
            const img = sp.querySelector('.splash__logo');
            const cs = getComputedStyle(tile);
            return {
                theme: document.documentElement.getAttribute('data-theme'),
                visible: getComputedStyle(sp).opacity,
                radius: cs.borderRadius,
                border: cs.borderTopColor,
                imgComplete: img.complete && img.naturalWidth,
                tile: tile.getBoundingClientRect().width
            };
        }""")
        print('splash', theme, info)
        check('스플래시 라운드 타일 24px (' + theme + ')', info['radius'] == '24px', info['radius'])
        check('로고 그림 로드 (' + theme + ')', bool(info['imgComplete']), info['imgComplete'])
        check('스플래시 보임 (' + theme + ')', float(info['visible']) == 1.0, info['visible'])
        page.screenshot(path=OUT + '/splash-' + theme + '.png')
        print('     saved', OUT + '/splash-' + theme + '.png')
        ctx.close()

    # ── 2) 최소 노출·페이드 타이밍 (정상 로드)
    for theme in ('th_def', 'th_night'):
        ctx, page = new_page()
        page.goto(BASE + 'index.html?timing=' + theme, wait_until='commit')
        page.evaluate("""(th) => {
            localStorage.setItem('bm_cache_v1', JSON.stringify({ me: { theme: { theme: th } } }));
            sessionStorage.setItem('bm_splash_probe', '1');
        }""", theme)
        page.add_init_script("""
            window.__splash = { start: performance.now(), off: null };
            const t0 = performance.now();
            const obs = new MutationObserver(() => {
                const sp = document.getElementById('splash');
                if (sp && sp.classList.contains('is-off') && !window.__splash.off) {
                    window.__splash.off = performance.now() - t0;
                }
            });
            document.addEventListener('DOMContentLoaded', () => {
                const sp = document.getElementById('splash');
                if (sp) obs.observe(sp, { attributes: true, attributeFilter: ['class'] });
            });
        """)
        page.goto(BASE + 'index.html?run=' + theme, wait_until='load')
        page.wait_for_timeout(1600)
        probe = page.evaluate('window.__splash')
        print('timing', theme, probe)
        check('스플래시가 최소 300ms 이상 보였다 (' + theme + ')',
              probe['off'] is not None and probe['off'] >= 280, probe['off'])
        check('스플래시가 1.6초 안에 걷혔다 (' + theme + ')',
              probe['off'] is not None and probe['off'] < 1500, probe['off'])
        gone = page.evaluate("""() => {
            const sp = document.getElementById('splash');
            return { cls: sp.className, vis: getComputedStyle(sp).visibility, op: getComputedStyle(sp).opacity };
        }""")
        check('스플래시가 완전히 사라졌다 (' + theme + ')',
              gone['vis'] == 'hidden' and float(gone['op']) == 0, gone)

        # ── 시작화면 (로그인 게이트)
        page.wait_for_timeout(600)
        gate = page.evaluate("""() => {
            const mark = document.querySelector('.start__mark');
            const img = mark ? mark.querySelector('img') : null;
            return {
                mark: !!mark,
                markRadius: mark ? getComputedStyle(mark).borderRadius : null,
                img: img ? img.getAttribute('src') : null,
                imgLoaded: img ? (img.complete && img.naturalWidth > 0) : false,
                emoji: document.body.innerText.includes('🏸'),
                buttons: [...document.querySelectorAll('.start__actions button')].map(b => b.textContent.trim().slice(0, 14))
            };
        }""")
        print('gate', theme, gate)
        check('시작화면 로고 타일 24px (' + theme + ')', gate['markRadius'] == '24px', gate['markRadius'])
        check('시작화면 새 로고 (' + theme + ')', gate['img'] == 'icons/icon-512.png' and gate['imgLoaded'], gate['img'])
        check('시작화면에 이모지 없음 (' + theme + ')', gate['emoji'] is False, gate['emoji'])
        check('로그인 세 갈래 유지 (' + theme + ')', len(gate['buttons']) == 3, gate['buttons'])
        page.screenshot(path=OUT + '/start-' + theme + '.png')
        print('     saved', OUT + '/start-' + theme + '.png')

        # 이메일 화면 위 미니 로고
        page.click('[data-act="to-email"]')
        page.wait_for_timeout(500)
        mini = page.evaluate("""() => {
            const m = document.querySelector('.start__mini');
            return m ? { src: m.getAttribute('src'), w: m.getBoundingClientRect().width, ok: m.complete && m.naturalWidth > 0 } : null;
        }""")
        check('이메일 화면 미니 로고 (' + theme + ')', mini and mini['ok'] and mini['w'] == 22, mini)
        page.screenshot(path=OUT + '/email-' + theme + '.png')
        print('     saved', OUT + '/email-' + theme + '.png')
        ctx.close()

    print('errors', errs)
    print('result', sum(1 for _, c in checks if c), '/', len(checks))
    b.close()

httpd.shutdown()
