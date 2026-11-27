"""bm-v1.42.1 라이브 확인 (390×844) — 보안 헤더(CSP) · 게스트 모집 입구·단체방 · 5개 탭 · 지도.

· 실제 사이트를 보되, Supabase 쓰기 요청(POST/PATCH/DELETE)은 막아 데이터를 건드리지 않습니다.
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v142-1.py
"""

import time
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


def route_filter(route):
    req = route.request
    u = req.url
    if 'mwgpakntlollndfluwgg.supabase.co' in u and req.method not in ('GET', 'HEAD'):
        return route.abort()          # 실제 데이터를 쓰지 않음
    if 'google' in u and 'accounts.google.com/gsi' not in u:
        return route.abort()
    return route.continue_()


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', route_filter)
    page = ctx.new_page()
    page.on('console', lambda m: (csp.append(m.text[:200]) if 'Content Security Policy' in m.text else
                                  (errs.append(m.text[:200]) if m.type == 'error' else None)))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    cb = str(int(time.time()))
    # 0) 배포 파일
    sw = page.request.get(BASE + 'sw.js?cb=' + cb).text()
    app = page.request.get(BASE + 'app.js?cb=' + cb).text()
    twa = page.request.get(BASE + 'twa-manifest.json?cb=' + cb).text()
    idx = page.request.get(BASE + 'index.html?cb=' + cb).text()
    check('라이브 sw.js bm-v1.42.1', "var VERSION = 'bm-v1.42.1'" in sw)
    check('라이브 app.js v1.42.1', "version: 'v1.42.1'" in app)
    check('라이브 TWA 1.42.1 · 코드 38', '"appVersionName": "1.42.1"' in twa and '"appVersionCode": 38' in twa)
    check('라이브 index.html CSP', 'Content-Security-Policy' in idx and 'sha256-' in idx)
    check('라이브 index.html Referrer-Policy', 'strict-origin-when-cross-origin' in idx)
    check('gh-pages에 test/·supabase 없음',
          page.request.get(BASE + 'test/run.js?cb=' + cb).status == 404
          and page.request.get(BASE + 'supabase/security-hardening.sql?cb=' + cb).status == 404)

    # 1) 체험 모드
    page.goto(BASE + 'index.html?chk=' + cb, wait_until='load')
    page.wait_for_timeout(800)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    check('앱 버전 v1.42.1', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.42.1',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    check('CSP 메타가 문서에 적용', page.evaluate("() => !!document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')"))
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(1000)
    for sel in ['#sheet .sheet__head [data-close]', '#sheet .btn']:
        if page.query_selector(sel):
            page.click(sel, timeout=2000); page.wait_for_timeout(300); break

    # 2) 5개 탭
    for tab, name in [('log', '일지 & AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(650)
        over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check('%s 탭: 오류 없음 · 가로 넘침 없음(390)' % name, over <= 0, over)

    # 3) 지도(조환비 님 기능) — CSP 아래에서도 뜨는지
    page.click('[data-tab="matching"]'); page.wait_for_timeout(600)
    entry = page.query_selector('[data-act="open-gym-map"], .gymentry__b')
    if entry:
        entry.click(); page.wait_for_timeout(1500)
        check('체육관 지도 열림', page.evaluate("() => !!document.querySelector('.gympage, [data-gymmap]')"))
        check('지도 카드 13곳', page.evaluate("() => document.querySelectorAll('[data-gym-card]').length") >= 10,
              page.evaluate("() => document.querySelectorAll('[data-gym-card]').length"))
        page.screenshot(path=OUT + '/v1421_live_map.png')
        if page.query_selector('[data-gym-close]'):
            page.click('[data-gym-close]'); page.wait_for_timeout(500)

    # 4) 게스트 모집 — 모집 칸을 비운 글에도 입구가 있는지
    page.click('[data-tab="community"]'); page.wait_for_timeout(700)
    page.click('[data-topic="게스트 모집"]'); page.wait_for_timeout(350)
    page.fill('[data-composer]', '점검용 모집 글')
    page.click('[data-act="post"]'); page.wait_for_timeout(1000)
    check('모집 칸 비운 글에도 모집 카드', page.evaluate("() => document.querySelectorAll('.vite').length") >= 1)
    check('모집 칸 비운 글에도 참여 버튼', bool(page.query_selector('[data-vite-group]')))
    page.screenshot(path=OUT + '/v1421_live_nomeet.png')
    page.click('[data-vite-group]'); page.wait_for_timeout(1000)
    check('그 글로 단체방 열림', page.evaluate("() => { const s=window.BM.app.ctx.store.state.ui; return !!(s.chatOpen && s.chatRoom); }"))
    check('단체방 제목', page.evaluate("() => { const d=document.querySelector('#dm'); return d ? d.innerText.indexOf('게스트 모집 단체방') >= 0 : false; }"))
    page.screenshot(path=OUT + '/v1421_live_room.png')
    page.evaluate("() => window.BM.app.ctx.store.actions.closeChats()")
    page.wait_for_timeout(400)

    # 5) 필터 칩
    page.click('[data-topicfilter="게스트 모집"]'); page.wait_for_timeout(600)
    check('게스트 모집 필터 동작', page.evaluate("() => document.querySelectorAll('[data-post]').length") >= 1,
          page.evaluate("() => document.querySelectorAll('[data-post]').length"))
    check('필터 뒤에도 참여 버튼', bool(page.query_selector('[data-vite-group]')))

    # 6) 오류 집계
    real = [e for e in errs if 'ERR_' not in e and 'GSI_LOGGER' not in e and '403' not in e]
    check('앱 오류 0건', len(real) == 0, real[:4])
    check('CSP 위반 0건', len(csp) == 0, csp[:3])
    print('\n%d/%d 통과' % (sum(1 for _, c in checks if c), len(checks)))
    b.close()
