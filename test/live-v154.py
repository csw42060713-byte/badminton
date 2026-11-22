"""bm-v1.54.0 라이브 점검 — 점수판 파트너·라이벌 전적 자동 누적

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 / 844×390 으로 열어 확인합니다.
· Supabase(서버 DB)·CDN·지도 타일 요청은 막아 둡니다 → 체험(기기 저장) 모드로만 움직이고 서버에 아무것도 쓰지 않습니다.
· 확인 순서
  A) 배포본 파일이 v1.54.0 (sw · app · index 스타일 캐시 · TWA 1.54.0 코드 48 · domain/scoreboard/log/css 반영)
  B) 기존 5개 탭 그대로 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
  C) 점수판 파트너·라이벌 이름 고르기(2탭) → 1세트(21:17) → 가로 점수판(844×390)
  D) '오늘 일지에 넣기' → 점수·메모·이름 자동 채움 → 저장 → 라이벌 카드(1승)
  E) 라이벌 칩으로 2차 경기(패) → 저장 → 라이벌 전적 1승 1패 누적
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v154.py
"""

import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'live154@example.com'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def val(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.value : ''; }", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    # ---------- A. 배포본 파일 ----------
    def get(url):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')

    stamp = '?l=' + str(int(time.time()))
    sw = get(BASE + 'sw.js' + stamp)
    index = get(BASE + 'index.html' + stamp)
    app = get(BASE + 'app.js' + stamp)
    twa = get(BASE + 'twa-manifest.json' + stamp)
    dom = get(BASE + 'js/domain.js' + stamp)
    sbj = get(BASE + 'js/scoreboard.js' + stamp)
    logjs = get(BASE + 'js/views/log.js' + stamp)
    css = get(BASE + 'styles.css' + stamp)

    check('A 배포본 sw.js bm-v1.54.0', "var VERSION = 'bm-v1.54.0'" in sw, sw[sw.find('var VERSION'):][:40])
    check('A 배포본 app.js v1.54.0', "version: 'v1.54.0'" in app)
    check('A 배포본 styles.css?v=20261122-68', 'styles.css?v=20261122-68' in index)
    check('A 배포본 TWA 1.54.0 · 코드 48', '"appVersionName": "1.54.0"' in twa and '"appVersionCode": 48' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A 배포본 domain.js 라이벌 전적', 'rivalStats' in dom and 'rivalLineText' in dom)
    check('A 배포본 scoreboard.js 이름표', 'setName' in sbj and 'NAME_MAX' in sbj)
    check('A 배포본 log.js 라이벌 칸·카드', 'data-rvl-chip' in logjs and 'data-region="rival"' in logjs)
    check('A 배포본 styles.css 이름표·고르기 칸', '.sb__teams' in css and '.sb__pick' in css and '.card--rvl' in css)

    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
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

    def login(email, nick):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
              onboardedAt: '2026-11-22 09:00:00',
              profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-22 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def play(points):
        mine, theirs = points
        a = bpt = 0
        while (a < mine or bpt < theirs):
            go_a = False if a >= mine else (True if bpt >= theirs else (a <= bpt))
            tap('[data-sb-point="%s"]' % ('a' if go_a else 'b'), 55)
            if go_a:
                a += 1
            else:
                bpt += 1
        page.wait_for_timeout(280)

    login(PLAYER, '점수왕')
    check('앱 진입 · 버전 v1.54.0', page.evaluate("() => BM.app.version") == 'v1.54.0',
          page.evaluate("() => BM.app.version"))
    check('A 일지 & AI 첫 화면', has(page, '[data-act="open-scoreboard"]'))

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 560)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab), body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ---------- B. 점수판 이름표 ----------
    tap("#tabbar [data-tab='log']", 700)
    tap('[data-act="open-scoreboard"]', 800)
    check('B 점수판이 열린다', has(page, '[data-sb]'))
    check('B 파트너·라이벌 이름표', has(page, '[data-sb-pick="partner"]') and has(page, '[data-sb-pick="rival"]'))
    tap('[data-sb-pick="partner"]', 400)
    check('B 파트너 고르기 칸(1탭)', has(page, '[data-sb-picker="partner"]'))
    page.fill('[data-sb-name-input="partner"]', '조환비')
    page.wait_for_timeout(200)
    tap('[data-sb-pick="rival"]', 400)
    page.fill('[data-sb-name-input="rival"]', '김원호')
    page.wait_for_timeout(200)
    tap('[data-sb-pick-close]', 400)
    check('B 카드 위 파트너 이름', '내 팀 · 조환비' in text_of(page, '[data-sb]'))
    check('B 카드 위 라이벌 이름', '상대 팀 · 김원호' in text_of(page, '[data-sb]'))
    play((21, 17))
    check('B 1세트 종료(21:17)', has(page, '[data-sb-save]'), text_of(page, '.sb__state'))
    page.screenshot(path=OUT + '/v154_live_scoreboard.png')

    page.set_viewport_size({'width': 844, 'height': 390})
    page.wait_for_timeout(600)
    check('B 가로 점수판', has(page, '.sb--full[data-sb-view="land"]'))
    w = overflow(page)
    check('B 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('B 가로에서도 이름표·+1·넣기', has(page, '[data-sb-pick="rival"]') and count(page, '[data-sb-point]') == 2 and has(page, '[data-sb-save]'))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(600)

    # ---------- C. 일지 자동 채움 · 저장 ----------
    tap('[data-sb-save]', 900)
    check('C 일지 파트너 채움', val(page, '[data-field="partner"]') == '조환비', val(page, '[data-field="partner"]'))
    check('C 일지 라이벌 채움', val(page, '[data-field="rival"]') == '김원호', val(page, '[data-field="rival"]'))
    check('C 게임 점수 채움', val(page, '[data-field="gameA"]') == '21' and val(page, '[data-field="gameB"]') == '17',
          [val(page, '[data-field="gameA"]'), val(page, '[data-field="gameB"]')])
    note = val(page, '[data-field="note"]')
    check('C 메모에 이름까지', '함께 조환비' in note and '상대 김원호' in note, note)
    tap('[data-act="save-log"]', 1600)
    rival_txt = text_of(page, '[data-region="rival"]')
    check('C 라이벌 카드 1승', '김원호에게 1승' in rival_txt, rival_txt[:120].replace('\n', ' '))
    page.evaluate("() => { const n = document.querySelector('[data-region=\"rival\"]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v154_live_rival_card.png')

    # ---------- D. 칩으로 2차 경기 · 누적 ----------
    tap('[data-act="open-scoreboard"]', 800)
    tap('[data-sb-pick="rival"]', 400)
    check('D 최근 라이벌 칩', has(page, '[data-sb-name-val="김원호"]'))
    tap('[data-sb-name-val="김원호"]', 500)
    check('D 칩 한 번으로 선택', '상대 팀 · 김원호' in text_of(page, '[data-sb]'))
    play((15, 21))
    tap('[data-sb-save]', 1200)
    check('D 두 번째 일지 라이벌', val(page, '[data-field="rival"]') == '김원호', val(page, '[data-field="rival"]'))
    tap('[data-act="save-log"]', 1800)
    rival_txt = text_of(page, '[data-region="rival"]')
    check('D 라이벌 전적 1승 1패', '1승 1패' in rival_txt, rival_txt[:160].replace('\n', ' '))

    page.evaluate("() => { const n=document.querySelector('[data-fold=\"games\"]'); if (n) n.open = true; }")
    page.wait_for_timeout(300)
    check('D 일지 최근 라이벌 칩', has(page, '[data-rvl-chip="김원호"]'))
    check('D 칸 아래 한 줄 전적', '1승 1패' in text_of(page, '[data-rvl-now]'), text_of(page, '[data-rvl-now]'))

    for tab in ['matching', 'community', 'coach', 'my', 'log']:
        tap("#tabbar [data-tab='%s']" % tab, 420)
        check('마무리 탭 %s' % tab, has(page, "[data-view='%s']" % tab))

    check('콘솔 오류 0', len(errs) == 0, errs[:3])
    check('CSP 위반 0', len(csp) == 0, csp[:3])
    print('   (오프라인 차단으로 실패한 외부 요청 %d건 — 앱 파일 실패 아님)' % len(blocked))

    ok = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과 · 실패 %d' % (ok, len(checks), len(checks) - ok))
