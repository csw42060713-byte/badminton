"""v1.33 라이브 점검 — 배포된 앱(390×844)에서 빈 화면 선화 일러스트와 히어로 카드 코트 워터마크를 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v133.py
"""
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
errs, fails = [], []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    page.on('requestfailed', lambda r: fails.append(r.url[:120]) if BASE.split('/')[2] in r.url else None)

    # ── 배포본 확인 (Pages 빌드 대기)
    sw = ''
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.33.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.33.0', 'bm-v1.33.0' in sw, sw[-60:])
    app = page.request.get(BASE + 'app.js?x=1').text()
    art = page.request.get(BASE + 'js/art.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    index = page.request.get(BASE + 'index.html?x=1').text()
    check('라이브 app.js = v1.33.0', "version: 'v1.33.0'" in app)
    check('라이브 art.js = 여섯 그림', all(k in art for k in ('ART.log', 'ART.search', 'ART.community', 'ART.coach', 'ART.send', 'ART.spark')))
    check('라이브 styles.css = 빈 화면 그림 + 워터마크',
          all(k in css for k in ('.empty__art', '--courtmark', '.card--hero::after', 'pointer-events: none')))
    check('라이브 index.html = art.js · styles.css?v=20261121-33',
          'js/art.js' in index and 'styles.css?v=20261121-33' in index)

    # ── 앱 열기 (둘러보기 = 체험 모드)
    page.goto(BASE + '?live=133', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(3):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.33.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    check('art 모듈 로드', page.evaluate("!!(window.BM && BM.art && BM.art.kinds.length === 6)"))

    def shot(name, region=None):
        path = OUT + '/' + name
        if region:
            page.locator(region).first.screenshot(path=path)
        else:
            page.screenshot(path=path)
        print('     saved', path)

    def art_info(label):
        return page.evaluate("""(label) => {
            const a = document.querySelector('.empty' + (label ? label : '' ) + ' .empty__art') || document.querySelector('.empty__art');
            if (!a) return null;
            const r = a.getBoundingClientRect();
            const st = getComputedStyle(a);
            const stroke = a.querySelector('.st');
            return {h: Math.round(r.height), w: Math.round(r.width),
                    color: st.color,
                    accent: getComputedStyle(a.querySelector('.st-a')).stroke,
                    line: stroke ? getComputedStyle(stroke).stroke : ''};
        }""", label)

    # ── 1) 다크(나이트) 테마 — 일지 & AI 히어로 카드
    page.goto(BASE + '#/log', wait_until='load')
    page.wait_for_timeout(2000)
    if not page.query_selector('[data-tab="log"].is-on'):
        page.click('[data-tab="log"]')
        page.wait_for_timeout(1200)
    hero = page.query_selector('.card--hero')
    check('일지 상단 히어로 카드', hero is not None)
    mark = page.evaluate("""() => {
        const el = document.querySelector('.card--hero');
        if (!el) return null;
        const st = getComputedStyle(el, '::after');
        return {opacity: Number(st.opacity), mask: (st.maskImage || st.webkitMaskImage || '').slice(0, 30),
                pe: st.pointerEvents, content: st.content};
    }""")
    check('히어로 카드 코트 선화(투명도 0.06~0.12)', mark and 0.06 <= mark['opacity'] <= 0.12, mark)
    check('히어로 카드 선화 = mask + 누르기 통과',
          mark and 'data:image/svg' in mark['mask'] and mark['pe'] == 'none', mark)
    page.screenshot(path=OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_일지_다크.png')
    print('     saved', OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_일지_다크.png')

    # 최근 기록 빈 화면
    page.evaluate("document.querySelector('[data-region=\"records\"], .logrow, [data-act=\"save-log\"]')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(600)
    info = art_info('')
    check('일지 빈 화면 그림(높이 56~88px)', info and 56 <= info['h'] <= 88, info)

    # ── 2) 커뮤니티 — 글 없음
    page.click('[data-tab="community"]')
    page.wait_for_timeout(1000)
    info = art_info('')
    check('커뮤니티 빈 화면 그림', info and 56 <= info['h'] <= 88, info)
    check('그림 색 = 글자색 계열 + 테마 포인트', info and info['color'] and info['accent'], info)
    page.screenshot(path=OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_커뮤니티_다크.png')
    print('     saved', OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_커뮤니티_다크.png')

    # ── 3) 매칭 — 조건 미선택 안내 + 결과 없음
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(900)
    intro = page.query_selector('.matchintro .empty__art')
    check('매칭 안내 카드 그림', intro is not None)
    page.screenshot(path=OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_매칭안내_다크.png')
    print('     saved', OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_매칭안내_다크.png')
    if page.query_selector('[data-act="show-all"]'):
        page.click('[data-act="show-all"]')
        page.wait_for_timeout(900)
    check('매칭 결과 없음 그림', page.query_selector('.empty__art') is not None)

    # ── 4) 코치 — 받은 피드백 없음 + 상단 카드 선화
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(900)
    check('코치 상단 카드', page.query_selector('.card--coach') is not None)
    check('코치 빈 화면 그림', page.query_selector('.empty__art') is not None)
    page.screenshot(path=OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_코치_다크.png')
    print('     saved', OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_코치_다크.png')

    # ── 5) MY — 프로필 카드 선화
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    mmark = page.evaluate("""() => {
        const el = document.querySelector('.card--profile');
        if (!el) return null;
        const st = getComputedStyle(el, '::after');
        return {opacity: Number(st.opacity), mask: (st.maskImage || st.webkitMaskImage || '').slice(0, 30)};
    }""")
    check('MY 프로필 카드 선화', mmark and 0.06 <= mmark['opacity'] <= 0.12, mmark)
    page.screenshot(path=OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_MY_다크.png')
    print('     saved', OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_MY_다크.png')

    dark_errs = list(errs)
    dark_fails = list(fails)

    # ── 6) 라이트(기본) 테마 — 같은 화면 다시
    page.evaluate("BM.app.ctx.store.actions.setTheme('th_def')")
    page.wait_for_timeout(1200)
    check('라이트 테마 적용', page.evaluate("document.documentElement.getAttribute('data-theme')") == 'th_def',
          page.evaluate("document.documentElement.getAttribute('data-theme')"))
    page.click('[data-tab="log"]')
    page.wait_for_timeout(900)
    lmark = page.evaluate("""() => { const st = getComputedStyle(document.querySelector('.card--hero'), '::after');
        return {opacity: Number(st.opacity), mask: (st.maskImage || '').slice(0, 30)}; }""")
    check('라이트 테마 히어로 선화', lmark and 0.06 <= lmark['opacity'] <= 0.12, lmark)
    page.screenshot(path=OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_일지_라이트.png')
    print('     saved', OUT + '/배드민턴_히어로코트선화_bm-v1.33.0_일지_라이트.png')
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    linfo = art_info('')
    check('라이트 테마 그림(높이·색)', linfo and 56 <= linfo['h'] <= 88, linfo)
    page.screenshot(path=OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_커뮤니티_라이트.png')
    print('     saved', OUT + '/배드민턴_빈화면일러스트_bm-v1.33.0_커뮤니티_라이트.png')

    # 가로 넘침·빈 화면 카드 높이 — 그림 때문에 스크롤이 늘지 않았는지
    widths, blocks = {}, {}
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(600)
        widths[tab] = page.evaluate('document.documentElement.scrollWidth')
        blocks[tab] = page.evaluate("""() => { const e = document.querySelector('.empty'); return e ? Math.round(e.getBoundingClientRect().height) : 0; }""")
    check('가로 넘침 없음(390px)', all(w <= 390 for w in widths.values()), widths)
    check('빈 화면 카드가 과하게 길어지지 않음(260px 이하)', all(v <= 260 for v in blocks.values()), blocks)
    print('     widths', widths, 'empty blocks', blocks)

    b.close()

print('\n다크 테마 콘솔 오류', len(dark_errs), dark_errs[:4])
print('다크 테마 실패 요청', len(dark_fails), dark_fails[:4])
print('전체 콘솔·페이지 오류', len(errs), errs[:6])
print('전체 실패 요청', len(fails), fails[:6])
check('콘솔·페이지 오류 0건', len(errs) == 0, errs[:3])
check('실패한 요청 0건', len(fails) == 0, fails[:3])
passed = sum(1 for _, okv in checks if okv)
print('\n점검 %d/%d 통과' % (passed, len(checks)))
raise SystemExit(0 if passed == len(checks) else 1)
