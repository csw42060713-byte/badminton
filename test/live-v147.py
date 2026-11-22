"""bm-v1.47.0 라이브 점검 — 하트·광고 UX · 꾸미기 미리보기 · 코치 소속 지도.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
· 실행: LD_LIBRARY_PATH=<chromium 라이브러리 경로> python3 test/live-v147.py
"""
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
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


# ---------- 배포본 파일부터 확인 (버전·캐시 키·새 코드) ----------
stamp = '?l=' + str(int(time.time()))
sw = get(BASE + 'sw.js' + stamp)
index = get(BASE + 'index.html' + stamp)
app = get(BASE + 'app.js' + stamp)
ads = get(BASE + 'js/ads.js' + stamp)
my = get(BASE + 'js/views/my.js' + stamp)
matching = get(BASE + 'js/views/matching.js' + stamp)
coach = get(BASE + 'js/views/coach.js' + stamp)
twa = get(BASE + 'twa-manifest.json' + stamp)

check('sw.js bm-v1.47.0', "var VERSION = 'bm-v1.47.0'" in sw,
      (sw.split('var VERSION')[1][:40] if 'var VERSION' in sw else sw[:60]))
check('app.js v1.47.0', "version: 'v1.47.0'" in app)
check('index.html styles.css?v=20261122-59', 'styles.css?v=20261122-59' in index)
check('index.html CSP 유지', "object-src 'none'" in index and "base-uri 'none'" in index)
check('TWA 1.47.0 · 코드 39', '"appVersionName": "1.47.0"' in twa and '"appVersionCode": 39' in twa)
check('ads.js 다중 슬롯', "'heart_boost'" in ads and "'report_detail'" in ads and 'function setUnits' in ads)
check('ads.js 실시간 표시 · 1탭', 'function adMeterText' in ads and 'function watchForHeart' in ads)
check('my.js 미리보기', 'function openDecoPreviewSheet' in my and 'data-dpv-act' in my)
check('matching.js 1탭 광고 버튼', 'data-act="ad-heart"' in matching and 'data-letter-ad' in matching)
check('coach.js 소속 → 지도', 'function affVenues' in coach and 'data-gym-open' in coach)

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

    check('앱 버전 v1.47.0', page.evaluate("() => window.BM && BM.app && BM.app.version") == 'v1.47.0',
          page.evaluate("() => window.BM && BM.app && BM.app.version"))
    check('ads 모듈: 슬롯·실시간·1탭', page.evaluate(
        "() => !!(BM.ads && BM.ads.adMeterText && BM.ads.watchForHeart && BM.ads.SLOTS && BM.ads.SLOTS.length >= 3)"))
    check('체육관 120곳 그대로', page.evaluate("() => BM.gyms.count()") >= 120, page.evaluate("() => BM.gyms.count()"))

    # ---------- A. MY 하트 카드 실시간 표시 · 광고 1회 ----------
    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(900)
    page.evaluate("() => { const n = document.querySelector('[data-region=\\\"heart\\\"]'); if (n) { n.scrollIntoView({block: 'start'}); window.scrollBy(0, -96); } }")
    page.wait_for_timeout(500)
    sub0 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    check('하트 카드: 남은 N/5회 + 지금 바로', ('남은 5/5회' in sub0) and ('지금' in sub0), sub0)
    page.screenshot(path=OUT + '/v147l_01_하트카드_실시간.png')
    bal0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    page.click('[data-ad-btn]')
    page.wait_for_timeout(700)
    check('광고 미리보기 시트', has(page, '.ad-sim'))
    page.wait_for_timeout(3200)
    toast = text_of(page, '#toast')
    check('광고 1회 → 하트 +1', '하트 +1' in toast, toast)
    bal1 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('잔액 +1', bal1 == bal0 + 1, (bal0, bal1))
    sub1 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    check('쿨타임 남은 4/5회 + 다음 광고까지', ('남은 4/5회' in sub1) and ('다음 광고까지' in sub1), sub1)
    page.screenshot(path=OUT + '/v147l_02_하트카드_쿨타임.png')
    page.wait_for_timeout(1400)
    sub2 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    check('1초 카운트다운', sub1 != sub2, (sub1, sub2))

    # ---------- B. 꾸미기 미리보기 ----------
    page.evaluate("() => { const n = document.querySelector('[data-act=\\\"decorate-sheet\\\"]'); if (n) n.click(); }")
    page.wait_for_timeout(1200)
    check('꾸미기 시트', has(page, '[data-dframe]'))
    locked = page.evaluate("""() => {
      const b = Array.from(document.querySelectorAll('[data-dframe]')).find(x => x.classList.contains('is-locked'));
      return b ? b.getAttribute('data-dframe') : '';
    }""")
    check('잠긴 프레임', bool(locked), locked)
    page.click('[data-dframe="%s"]' % locked)
    page.wait_for_timeout(800)
    pv = text_of(page, '#sheet')
    check('미리보기 시트(지금 ↔ 적용 후)', ('지금 모습' in pv) and ('적용 후' in pv), pv[:80])
    frame_next = page.evaluate("() => { const n = document.querySelector('[data-deco-preview] [data-frame]'); return n ? n.getAttribute('data-frame') : ''; }")
    check('적용 후 아바타', frame_next == locked, frame_next)
    check('겸 안내/해금 버튼', has(page, '#sheet [data-dpv-act="unlock"]') or has(page, '#sheet [data-dpv-act="ad"]'))
    page.screenshot(path=OUT + '/v147l_03_미리보기.png')
    page.click('#sheet [data-dpv="now"]')
    page.wait_for_timeout(500)
    frame_now = page.evaluate("() => { const n = document.querySelector('[data-deco-preview] [data-frame]'); return n ? n.getAttribute('data-frame') : ''; }")
    check('지금 모습은 원래 프레임', frame_now != locked, frame_now)
    page.click('#sheet [data-dpv-act="close"]')
    page.wait_for_timeout(500)

    # ---------- C. 코치 소속 → 지도 (데이터 없이 함수 경로 확인) ----------
    coach_link = page.evaluate("""() => {
      const v = BM.views.coach.affVenues('나래울 배드민턴장 · 매원고 배드민턴부');
      const html = BM.views.coach.affMapRow('나래울 배드민턴장');
      return { ids: v.map(x => x.id).join(','), html: html.indexOf('data-gym-open=\\"naraeul\\"') >= 0 };
    }""")
    check('활동 소속 → 체육관 2곳', coach_link['ids'] == 'naraeul,maewon', coach_link['ids'])
    check('소속 지도 칩 렌더', coach_link['html'])
    page.click("#tabbar [data-tab='coach']")
    page.wait_for_timeout(900)
    check('코치 탭 정상', '코치' in text_of(page, '[data-view]'), text_of(page, '[data-view]')[:60])

    # ---------- D. 5개 탭 회귀 ----------
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(800)
        body = text_of(page, '[data-view]')
        check('탭 %s 정상' % tab, len(body) > 40 and 'undefined' not in body, body[:50].replace('\n', ' '))

    check('콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('CSP 위반 0건', len(csp) == 0, csp[:2])
    check('가로 넘침 없음', page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"),
          page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]"))
    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if ok != len(checks):
    for label, c in checks:
        if not c:
            print('  FAIL ' + label)
    raise SystemExit(1)
