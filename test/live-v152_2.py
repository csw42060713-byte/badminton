"""bm-v1.52.2 라이브 점검 — 조환비 님 피드백 3종

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· Supabase(서버 DB)·CDN 요청은 막아 둡니다 → 체험(기기 저장) 모드로만 움직이고 서버에 아무것도 쓰지 않습니다.
· 확인 순서
  A) 배포본 파일이 v1.52.2 (sw · app · index 스타일 캐시 · TWA 1.52.2 코드 46 · pose/coach/domain 반영)
  B) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY) 그대로 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
  C) 일지 & AI → 영상 자세 비교 예시: '참고 기준 보기' 접힘(기본 닫힘) → 누르면 Miller 등 출처
  D) 커뮤니티 → 게스트 모집: 오늘(일요일) 날짜 칩에 같은 날짜가 두 번 나오지 않음
  E) 코치: 소속 체육관·프로필 클럽(경기 나래울)을 누르면 그 체육관 지도가 바로 열림
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/live-v152_2.py
"""

import json
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'live1522@example.com'
COACH_KEY = 'coach1522_live'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


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
    pose = get(BASE + 'js/pose.js' + stamp)
    coach = get(BASE + 'js/views/coach.js' + stamp)
    domain = get(BASE + 'js/domain.js' + stamp)
    css = get(BASE + 'styles.css' + stamp)

    check('A 배포본 sw.js bm-v1.52.2', "var VERSION = 'bm-v1.52.2'" in sw, sw[sw.find('var VERSION'):][:40])
    check('A 배포본 app.js v1.52.2', "version: 'v1.52.2'" in app)
    check('A 배포본 styles.css?v=20261122-66', 'styles.css?v=20261122-66' in index)
    check('A 배포본 TWA 1.52.2 · 코드 46', '"appVersionName": "1.52.2"' in twa and '"appVersionCode": 46' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A 배포본 pose.js 참고 기준 접기', 'data-pose-ref' in pose and '참고 기준 보기' in pose)
    check('A 배포본 coach.js 소속 지도 칩', 'affRow' in coach and 'data-gym-open' in coach)
    check('A 배포본 domain.js 날짜 칩 중복 제거', '같은 날짜는 한 번만' in domain)
    check('A 배포본 styles.css 접기 CSS', '.pose__refsum' in css and '.coachcard__gymname' in css)

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

    def open_app(rows=None):
        page.goto(BASE + 'index.html?l=' + str(int(time.time())), wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: '자세왕', at: new Date().toISOString(),
              onboardedAt: '2026-11-21 09:00:00',
              profile: { nick: '자세왕', level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-21 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': PLAYER})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)
        if rows is not None:
            key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
            page.evaluate("(a) => { localStorage.setItem(a.key, a.rows); }", {'key': key, 'rows': rows})
            page.reload(wait_until='load')
            page.wait_for_timeout(2600)

    def rows_json():
        key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
        return page.evaluate("(k) => localStorage.getItem(k) || '[]'", key)

    open_app()
    check('B 앱 버전 v1.52.2', page.evaluate("() => BM.app.version") == 'v1.52.2',
          page.evaluate("() => BM.app.version"))

    # ---------- B. 기존 5개 탭 ----------
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(560)
        body = text_of(page, '#main')
        check('B 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab), body[:50].replace('\n', ' '))

    # ---------- C. 영상 자세 비교 — 참고 기준 접기 ----------
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(800)
    page.click('[data-pose-demo]')
    page.wait_for_timeout(1100)
    check('C 참고 기준 상자', has(page, '[data-pose-ref]'))
    check('C 기본은 닫힘', page.evaluate(
        "() => { const d = document.querySelector('[data-pose-ref]'); return d && d.tagName === 'DETAILS' && !d.open; }"))
    check('C 닫힘 상태에서 출처 글자 숨김', page.evaluate(
        "() => { const n = document.querySelector('[data-pose-foot]'); return !n || n.innerText.trim() === ''; }"))
    page.evaluate("() => document.querySelector('[data-pose-ref]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v152_2L_01_자세비교_참고접힘.png')
    page.click('[data-pose-ref] summary')
    page.wait_for_timeout(450)
    foot = text_of(page, '[data-pose-foot]')
    check('C 누르면 펼쳐져 출처(Miller)가 보임', page.evaluate("() => document.querySelector('[data-pose-ref]').open")
          and 'Miller' in foot, foot[:100])
    page.screenshot(path=OUT + '/v152_2L_02_자세비교_참고펼침.png')
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(450)

    # ---------- D. 게스트 모집 날짜 칩 ----------
    page.click("#tabbar [data-tab='community']")
    page.wait_for_timeout(700)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(650)
    chips = page.evaluate("""() => Array.from(document.querySelectorAll('[data-viteday-quick]'))
        .map(b => ({ date: b.getAttribute('data-viteday-quick'), text: b.innerText.replace(/\\n/g, ' ') }))""")
    dates = [c['date'] for c in chips]
    check('D 빠른 날짜 칩 보임', len(chips) >= 2, chips)
    check('D 같은 날짜 두 번 없음', len(set(dates)) == len(dates), dates)
    check('D 오늘(11/22 일) 칩', any('11/22(일)' in c['text'] for c in chips), chips)
    check('D "이번 주말 11/22(일)" 중복 없음',
          not any(c['text'].startswith('이번 주말') and c['date'] == '2026-11-22' for c in chips), chips)
    page.evaluate("() => document.querySelector('[data-viteday]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v152_2L_03_게스트모집_날짜칩.png')

    # ---------- E. 코치 소속 → 지도 ----------
    rows = json.loads(rows_json())
    rows.append({
        'id': 'mentor-1522-live', 'type': '멘토신청', 'createdAt': '2026-11-22 08:00:00',
        'date': '2026-11-22', 'nick': '콕집사', 'userKey': COACH_KEY, 'target': 'admin',
        'status': '승인', 'payload': {
            'type': '체육관 코치', 'affiliation': '나래울 배드민턴장 · 매원고 배드민턴부',
            'experience': '7년', 'awards': '시 대회 3위', 'proof': '재직 확인', 'proofUrl': '',
            'proofPhoto': '', 'reason': '성인반을 봅니다', 'status': '승인',
            'submitted': '2026-11-20 10:00:00', 'level': 'B조', 'discipline': '복식',
            'region': '경기', 'club': '나래울'
        }
    })
    open_app(rows=json.dumps(rows, ensure_ascii=False))
    page.click("#tabbar [data-tab='coach']")
    page.wait_for_timeout(1300)
    cards = text_of(page, '.coachcards') if has(page, '.coachcards') else ''
    check('E 코치 카드에 소속', '나래울 배드민턴장' in cards, cards[:120])
    check('E 소속 이름이 지도 칩', has(page, '.coachcard__gyms [data-gym-open="naraeul"]'),
          page.evaluate("() => Array.from(document.querySelectorAll('.coachcard__gyms [data-gym-open]')).map(b => b.getAttribute('data-gym-open')).join(',')"))
    check('E 프로필 클럽(경기 나래울)도 지도 칩', has(page, '.coachcard__meta [data-gym-open="naraeul"]'),
          text_of(page, '.coachcard__meta'))
    page.screenshot(path=OUT + '/v152_2L_04_코치카드_지도칩.png')
    page.click('.coachcard__gyms [data-gym-open="naraeul"]')
    page.wait_for_timeout(1900)
    check('E 한 번에 체육관 지도', has(page, '#gympage'))
    focus = text_of(page, '#gympage [data-gym-focuscard]') if has(page, '#gympage [data-gym-focuscard]') else text_of(page, '#gympage')
    check('E 지도가 나래울 배드민턴장으로', '나래울 배드민턴장' in focus, focus[:120])
    page.screenshot(path=OUT + '/v152_2L_05_지도_나래울.png')
    closer = page.query_selector('[data-gym-close]')
    if closer:
        closer.click()
        page.wait_for_timeout(800)

    # ---------- 회귀 · 오류 ----------
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(620)
        body = text_of(page, '#main')
        check('Z 탭 %s 그대로' % tab, len(body) > 40 and 'undefined' not in body, body[:44].replace('\n', ' '))
    w = overflow(page)
    check('Z 390px 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('Z 콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('Z CSP 위반 0건', len(csp) == 0, csp[:2])
    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if ok != len(checks):
    for label, c in checks:
        if not c:
            print('  FAIL ' + label)
    raise SystemExit(1)
