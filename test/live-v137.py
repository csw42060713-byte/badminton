"""v1.37 라이브 점검 — 배포된 앱(390×844)에서 스플래시·시작화면 로고 타일을 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v137.py
"""
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

errs, fails, checks = [], [], []


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
        def _failed(r):
            # 화면을 넘기거나 닫을 때 끊긴 요청(ERR_ABORTED)은 실패가 아닙니다
            why = (r.failure or '')
            if 'ERR_ABORTED' in why or 'NS_BINDING_ABORTED' in why:
                return
            if BASE.split('/')[2] in r.url:
                fails.append(r.url[:120] + ' :: ' + why[:60])
        pg.on('requestfailed', _failed)
        return ctx, pg

    # ── 배포 반영 대기
    ctx0, page0 = new_page()
    sw = ''
    for i in range(45):
        sw = page0.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.37.1' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.37.1', 'bm-v1.37.1' in sw, sw[-60:])
    app = page0.request.get(BASE + 'app.js?x=1').text()
    css = page0.request.get(BASE + 'styles.css?x=1').text()
    index = page0.request.get(BASE + 'index.html?x=1').text()
    start = page0.request.get(BASE + 'js/views/start.js?x=1').text()
    twa = page0.request.get(BASE + 'twa-manifest.json?x=1').text()
    check('라이브 app.js = v1.37.1 · SPLASH_MIN_MS 420', "version: 'v1.37.1'" in app and 'SPLASH_MIN_MS = 420' in app)
    check('라이브 styles.css = 스플래시 타일·맥동·페이드',
          all(k in css for k in ('.splash__tile', 'splashPulse', 'border-radius: 24px', 'splash.is-off')))
    check('라이브 index.html = 새 스플래시 + 캐시 키 39',
          'class="splash__tile"' in index and 'styles.css?v=20261121-39' in index)
    check('라이브 start.js = 로고 타일', 'start__mark"><img src="icons/icon-512.png"' in start and 'start__mini' in start)
    check('라이브 twa-manifest = 1.37.1', '1.37.1' in twa)
    ctx0.close()

    # ── 스플래시 촬영 (app.js 응답을 늦춰 실제 렌더 그대로)
    for theme in ('th_def', 'th_night'):
        ctx, page = new_page()
        page.goto(BASE + 'index.html?seed=' + theme, wait_until='commit')
        page.evaluate("""(th) => localStorage.setItem('bm_cache_v1', JSON.stringify({ me: { theme: { theme: th } } }))""", theme)
        page.route('**/app.js', lambda route: (time.sleep(2.8), route.continue_()))
        page.goto(BASE + 'index.html?shot=' + theme, wait_until='commit')
        page.wait_for_timeout(1800)
        info = page.evaluate("""() => {
            const sp = document.getElementById('splash');
            const tile = sp.querySelector('.splash__tile');
            const img = sp.querySelector('.splash__logo');
            return {
                theme: document.documentElement.getAttribute('data-theme'),
                tile: Math.round(tile.getBoundingClientRect().width),
                radius: getComputedStyle(tile).borderRadius,
                logo: img.complete && img.naturalWidth,
                text: sp.innerText.replace(/\\n/g, ' | ')
            };
        }""")
        print('   splash', theme, info)
        check('스플래시 타일 92px·24px (' + theme + ')', info['tile'] == 92 and info['radius'] == '24px', info)
        check('스플래시 로고 로드 (' + theme + ')', bool(info['logo']), info['logo'])
        name = '배드민턴_스플래시_bm-v1.37.1_' + ('다크' if theme == 'th_night' else '라이트') + '.png'
        page.screenshot(path=OUT + '/' + name)
        print('     saved', OUT + '/' + name)
        ctx.close()

    # ── 최소 노출·페이드 타이밍 + 시작화면
    for theme in ('th_def', 'th_night'):
        ctx, page = new_page()
        page.goto(BASE + 'index.html?t0=' + theme, wait_until='commit')
        page.evaluate("""(th) => localStorage.setItem('bm_cache_v1', JSON.stringify({ me: { theme: { theme: th } } }))""", theme)
        page.add_init_script("""
            window.__splash = { off: null };
            const t0 = performance.now();
            const obs = new MutationObserver(() => {
                const sp = document.getElementById('splash');
                if (sp && sp.classList.contains('is-off') && window.__splash.off === null)
                    window.__splash.off = Math.round(performance.now() - t0);
            });
            document.addEventListener('DOMContentLoaded', () => {
                const sp = document.getElementById('splash');
                if (sp) obs.observe(sp, { attributes: true, attributeFilter: ['class'] });
            });
        """)
        page.goto(BASE + 'index.html?live=137&th=' + theme, wait_until='load')
        page.wait_for_timeout(3200)
        probe = page.evaluate('window.__splash')
        print('   timing', theme, probe)
        check('스플래시 최소 300ms 이상 보임 (' + theme + ')', probe['off'] is not None and probe['off'] >= 280, probe)
        gone = page.evaluate("""() => {
            const sp = document.getElementById('splash');
            return { cls: sp.className, vis: getComputedStyle(sp).visibility };
        }""")
        check('스플래시가 걷혔다 (' + theme + ')', gone['vis'] == 'hidden', gone)
        gate = page.evaluate("""() => {
            const img = document.querySelector('.start__mark img');
            return {
                theme: document.documentElement.getAttribute('data-theme'),
                mark: img ? img.getAttribute('src') : null,
                loaded: img ? (img.complete && img.naturalWidth > 0) : false,
                emoji: document.body.innerText.includes('🏸'),
                buttons: document.querySelectorAll('.start__actions button').length
            };
        }""")
        print('   gate', theme, gate)
        check('시작화면 새 로고 (' + theme + ')', gate['mark'] == 'icons/icon-512.png' and gate['loaded'], gate)
        check('시작화면 이모지 없음 (' + theme + ')', gate['emoji'] is False, gate['emoji'])
        check('로그인 세 갈래 유지 (' + theme + ')', gate['buttons'] == 3, gate['buttons'])
        name = '배드민턴_시작화면_bm-v1.37.1_' + ('다크' if theme == 'th_night' else '라이트') + '.png'
        page.screenshot(path=OUT + '/' + name)
        print('     saved', OUT + '/' + name)

        # 이메일 화면 위 미니 로고
        page.click('[data-act="to-email"]')
        page.wait_for_timeout(600)
        mini = page.evaluate("""() => {
            const m = document.querySelector('.start__mini');
            return m ? { src: m.getAttribute('src'), w: Math.round(m.getBoundingClientRect().width), ok: m.complete && m.naturalWidth > 0 } : null;
        }""")
        check('이메일 화면 미니 로고 (' + theme + ')', mini and mini['ok'] and mini['w'] == 22, mini)
        ctx.close()

    # ── 체험 모드로 들어가 5개 탭 회귀 확인 (에러 0건)
    ctx, page = new_page()
    page.goto(BASE + '?regress=137', wait_until='load')
    page.wait_for_timeout(3000)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.37.1',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    tabs = []
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(900)
        tabs.append(page.evaluate("() => document.querySelector('[data-tab=\"%s\"]').getAttribute('aria-current') === 'page'" % tab))
    check('5개 탭 이동 정상', all(tabs), tabs)
    page.screenshot(path=OUT + '/배드민턴_일지탭_bm-v1.37.1.png')
    print('     saved', OUT + '/배드민턴_일지탭_bm-v1.37.1.png')
    ctx.close()

    print('errors', errs)
    print('failed requests', fails)
    check('콘솔·페이지 에러 0건', len(errs) == 0, errs[:4])
    check('같은 주소 요청 실패 0건', len(fails) == 0, fails[:4])
    print('result', sum(1 for _, c in checks if c), '/', len(checks))
    b.close()
