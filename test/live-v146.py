"""bm-v1.46.0 라이브 점검 — 내 집 반경 5km · 동네 동호인 · 지도 안 게스트 모집.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
· 실행: LD_LIBRARY_PATH=<chromium 라이브러리 경로> python3 test/live-v146.py
"""
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


# ---------- 배포본 파일부터 확인 (버전·캐시 키) ----------
sw = get(BASE + 'sw.js?l=' + str(int(time.time())))
index = get(BASE + 'index.html?l=' + str(int(time.time())))
check('sw.js bm-v1.46.0', "var VERSION = 'bm-v1.46.0'" in sw, (sw.split('var VERSION')[1][:40] if 'var VERSION' in sw else sw[:80]))
check('sw.js 캐시에 js/nearby.js', "'./js/nearby.js'" in sw)
check('index.html styles.css?v=20261121-58', 'styles.css?v=20261121-58' in index)
check('index.html js/nearby.js', 'js/nearby.js' in index)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
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

    cb = str(int(time.time()))
    page.goto(BASE + 'index.html?l=' + cb, wait_until='load')
    page.wait_for_timeout(2500)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(5):
        if not page.query_selector('#sheet.is-on .sheet__panel .btn--primary'):
            break
        page.click('#sheet.is-on .sheet__panel .btn--primary')
        page.wait_for_timeout(500)

    check('앱 버전 v1.46.0', page.evaluate("() => window.BM && BM.app && BM.app.version") == 'v1.46.0',
          page.evaluate("() => window.BM && BM.app && BM.app.version"))
    check('nearby 모듈 로드', page.evaluate("() => !!(window.BM && BM.nearby && BM.nearby.RADIUS_KM === 5)"))
    check('체육관 120곳', page.evaluate("() => window.BM.gyms.count()") >= 120,
          page.evaluate("() => window.BM.gyms.count()"))

    # ---------- 지도 열기 ----------
    page.click("#tabbar [data-tab='matching']")
    page.wait_for_timeout(900)
    entry = text_of(page, "[data-act='open-gym-map']")
    check('매칭 입구 카드: 반경 5km 칩', '반경 5km · 파란 불' in entry, entry.replace('\n', ' | ')[:140])
    page.click("[data-act='open-gym-map']")
    page.wait_for_timeout(3200)
    check('지도 화면 열림', has(page, '#gympage.is-on'))

    # 내 상태 · 내 집 · 동네 동호인
    check('내 상태 카드', has(page, '#gympage [data-gymmystat]'))
    check('운동 중/지금 운동 가능 스위치', count(page, '#gympage [data-mystat-work]') == 1 and count(page, '#gympage [data-mystat-free]') == 1)
    check('운동 가능 시간대 칩 4개', count(page, '#gympage [data-mystat-range]') == 4, count(page, '#gympage [data-mystat-range]'))
    home = text_of(page, '#gympage [data-gymhome]')
    check('내 집 줄 · 반경 5km', '반경 5km' in home, home.replace('\n', ' | '))
    rows = page.evaluate("() => [...document.querySelectorAll('#gympage .nearp')].map(n => ({lit: n.classList.contains('is-lit'), t: n.innerText}))")
    check('동네 동호인 목록', len(rows) >= 3, len(rows))
    lit = [r for r in rows if r['lit']]
    check('파란 불 켜진 동호인', len(lit) >= 1, len(lit))
    check('[예시] 표시', has(page, '#gympage [data-gymnear]'))
    note = text_of(page, '#gympage [data-gymnote]')
    check('지도 안내: 반경 5km + 전국 120곳', '반경 5km' in note and '120곳' in note, note.replace('\n', ' '))
    check('파란 불 범례', has(page, '#gympage [data-gymlegend]'))
    check('지도 위 사람 아이콘', count(page, '#gympage .gymp-wrap') >= 3, count(page, '#gympage .gymp-wrap'))
    home_pins = count(page, '#gympage .leaflet-marker-pane .gymhome-pin')
    check('내 집 핀', home_pins == 1, home_pins)   # 오프라인 대체 핀(.is-flat)은 숨김 상태로 함께 있습니다
    check('반경 5km 원(Leaflet)', count(page, '#gympage .leaflet-overlay-pane path') >= 1,
          count(page, '#gympage .leaflet-overlay-pane path'))

    # 최신 main: 권역 칩 · 검색
    check('권역 칩 7개', count(page, '#gympage [data-gym-region]') == 7, count(page, '#gympage [data-gym-region]'))
    check('동네·이름 검색', has(page, '#gympage [data-gym-search]'))
    page.click("#gympage [data-gym-region='seoul']")
    page.wait_for_timeout(1200)
    seoul_cards = count(page, '#gympage [data-gym-card]')
    check('서울 칩 → 23곳', seoul_cards == 23, seoul_cards)
    page.fill('#gympage [data-gym-search]', '수원')
    page.wait_for_timeout(1200)
    suwon = count(page, '#gympage [data-gym-card]')
    check('서울 + "수원" 검색 → 0곳', suwon == 0, suwon)
    page.fill('#gympage [data-gym-search]', '')
    page.click("#gympage [data-gym-region='all']")
    page.wait_for_timeout(1200)
    check('전체로 돌아옴', count(page, '#gympage [data-gym-card]') >= 120, count(page, '#gympage [data-gym-card]'))

    # ---------- 지도 안 게스트 모집 ----------
    page.evaluate("() => { const b = document.querySelector('#gympage .gympage__body'); const r = document.querySelector('#gympage [data-gymrecruit]'); if (b && r) b.scrollTop = r.offsetTop - 80; }")
    page.wait_for_timeout(500)
    check('지도 안 게스트 모집 칸', has(page, '#gympage [data-gymrecruit]'))
    page.click('#gympage [data-gym-recruit-new]')
    page.wait_for_timeout(800)
    check('모집 작성 칸 열림', has(page, '#gympage [data-gymrecform]'))
    check('가까운 체육관 칩', count(page, '#gympage [data-gymrec-place]') >= 1, count(page, '#gympage [data-gymrec-place]'))
    page.click('#gympage [data-gymrec-place]')
    page.wait_for_timeout(300)
    page.fill('#gympage [data-gymrec="when"]', '오늘 20:30')
    page.fill('#gympage [data-gymrec="cap"]', '4')
    page.click("#gympage [data-gymrec-feeval='1만원']")
    page.wait_for_timeout(300)
    page.click('#gympage [data-gym-recruit-post]')
    page.wait_for_timeout(1600)
    summ = text_of(page, '#gympage [data-recruit-sum]')
    check('모집 1건 올라감', '1건' in summ, summ.replace('\n', ' '))
    card = text_of(page, '#gympage [data-gym-recruit-card]')
    check('모집 카드: 언제·몇 명·게스트비·내 글',
          '오늘 20:30' in card and '4명' in card and '1만원' in card and '내 글' in card,
          card.replace('\n', ' | ')[:160])
    page.screenshot(path=OUT + '/v146l_01_지도_반경5km.png')
    print('  saved v146l_01_지도_반경5km.png')

    # '불 켜진 사람만'
    page.click('#gympage [data-gym-onlylit]')
    page.wait_for_timeout(800)
    lit_only = count(page, '#gympage .nearp')
    check("'불 켜진 사람만' 걸러짐", lit_only == len(lit), [lit_only, len(lit)])
    page.click('#gympage [data-gym-onlylit]')
    page.wait_for_timeout(500)
    page.click('#gympage [data-gym-close]')
    page.wait_for_timeout(700)

    # ---------- 5개 탭 회귀 ----------
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(700)
        check('탭 열림: ' + tab, has(page, 'main'))
    page.click("#tabbar [data-tab='matching']")
    page.wait_for_timeout(600)
    page.click("#tabbar [data-tab='community']")
    page.wait_for_timeout(700)
    vites = count(page, "#main [data-region='posts'] .vite")
    check('커뮤니티 목록 그려짐', vites >= 0, vites)

    overflow = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('390px 가로 넘침 없음', overflow[0] <= overflow[1], overflow)
    check('앱 콘솔 오류 0건', len(errs) == 0, errs[:3])
    check('CSP 위반 0건', len(csp) == 0, csp[:2])
    b.close()

bad = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(bad), len(checks)))
print('차단된 외부 요청(net::ERR_FAILED/ABORTED) %d건 — 구글 로그인·타일 등' % len(blocked))
if bad:
    print('실패:', bad)
raise SystemExit(1 if bad else 0)
