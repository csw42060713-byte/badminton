"""bm-v1.53.0 라이브 점검 — 점프 최고점 임팩트 · 통증 즉시 휴식

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· Supabase(서버 DB)·CDN 요청은 막아 둡니다 → 체험(기기 저장) 모드로만 움직이고 서버에 아무것도 쓰지 않습니다.
· 확인 순서
  A) 배포본 파일이 v1.53.0 (sw · app · index 스타일 캐시 · TWA 1.53.0 코드 47 · pose/ai/css 반영)
  B) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY) 그대로 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
  C) 영상 자세 비교 → '점프 스매시 예시': 1구간 좋아요 100% · 2구간 조금 늦어요(0.3초(3프레임))
     · 1인 예시는 '제자리 타점' 중립 · 풋워크에는 점프 카드 없음
  D) 일지에 '무릎' 통증을 남기고 저장 → AI 카드에 '바로 코트를 멈추고 쉬면서' 기준
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/live-v153.py
"""

import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'live153@example.com'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


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
    ai = get(BASE + 'js/ai.js' + stamp)
    css = get(BASE + 'styles.css' + stamp)

    check('A 배포본 sw.js bm-v1.53.0', "var VERSION = 'bm-v1.53.0'" in sw, sw[sw.find('var VERSION'):][:40])
    check('A 배포본 app.js v1.53.0', "version: 'v1.53.0'" in app)
    check('A 배포본 styles.css?v=20261122-67', 'styles.css?v=20261122-67' in index)
    check('A 배포본 TWA 1.53.0 · 코드 47', '"appVersionName": "1.53.0"' in twa and '"appVersionCode": 47' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A 배포본 pose.js 점프 최고점 판정', 'jumpTiming' in pose and '점프 최고점' in pose)
    check('A 배포본 pose.js 점프 예시', 'demoJump' in pose and 'data-pose-demo' in pose)
    check('A 배포본 ai.js 통증 중단 기준', 'PAIN_RULE' in ai and '바로 코트를 멈추고' in ai)
    check('A 배포본 styles.css 중립 카드', '.posecard.is-stay' in css)

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

    def open_app():
        page.goto(BASE + 'index.html?l=' + str(int(time.time())), wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: '점프왕', at: new Date().toISOString(),
              onboardedAt: '2026-11-21 09:00:00',
              profile: { nick: '점프왕', level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-21 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': PLAYER})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    def open_pose():
        page.click("#tabbar [data-tab='log']")
        page.wait_for_timeout(700)
        page.click('[data-act="open-pose"]')
        page.wait_for_timeout(800)

    open_app()
    check('B 앱 버전 v1.53.0', page.evaluate("() => BM.app.version") == 'v1.53.0',
          page.evaluate("() => BM.app.version"))

    # ---------- B. 기존 5개 탭 ----------
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(560)
        body = text_of(page, '#main')
        check('B 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:50].replace('\n', ' '))

    # ---------- C. 점프 예시 · 제자리 · 풋워크 ----------
    open_pose()
    check('C 점프 예시 버튼', has(page, '[data-pose-demo="jump"]'))
    page.click('[data-pose-demo="jump"]')
    page.wait_for_timeout(1200)
    check('C 두 구간', count(page, '[data-pose-seg]') == 2, count(page, '[data-pose-seg]'))
    check('C 1구간 좋아요', '좋아요' in text_of(page, '[data-pose-seg="0"]'), text_of(page, '[data-pose-seg="0"]'))
    jump = text_of(page, '[data-pose-card="jump"]')
    check('C 점프 카드 100% 좋아요', '100%' in jump and '좋아요' in jump, jump.replace('\n', ' ')[:120])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v153L_01_점프예시_최고점타점.png')

    page.click('[data-pose-seg="1"]')
    page.wait_for_timeout(750)
    jump2 = text_of(page, '[data-pose-card="jump"]')
    check('C 2구간 조금 늦어요', '조금 늦어요' in jump2, jump2.replace('\n', ' ')[:120])
    check('C 0.3초(3프레임) 표기', '0.3초(3프레임)' in jump2, jump2.replace('\n', ' ')[:200])
    check('C 맨 위 한 줄도 점프', '최고점' in text_of(page, '[data-pose-one]'), text_of(page, '[data-pose-one]')[:100])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v153L_02_점프예시_내려오며타점.png')

    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(450)
    open_pose()
    page.click('[data-pose-demo]')
    page.wait_for_timeout(1000)
    stay = text_of(page, '[data-pose-card="jump"]')
    check('C 제자리 타점 중립', '제자리 타점' in stay, stay.replace('\n', ' ')[:100])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v153L_03_제자리타점_중립.png')
    page.click('[data-pose-mode="foot"]')
    page.wait_for_timeout(850)
    check('C 풋워크에는 점프 카드 없음', not has(page, '[data-pose-card="jump"]'))
    check('C 풋워크 카드 4장', count(page, '[data-pose-card]') == 4, count(page, '[data-pose-card]'))
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(450)

    # ---------- D. 통증 → 바로 멈추기 ----------
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.click('[data-chipgroup="pain"] [data-chip="무릎"]')
    page.wait_for_timeout(400)
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(2400)
    ai_text = text_of(page, '#main')
    check('D AI 카드에 중단 기준', '바로 코트를 멈추고' in ai_text, ai_text[-200:].replace('\n', ' '))
    check('D 조금이라도 아픈 느낌', '조금이라도 아픈 느낌' in ai_text)
    check('D 다음 목표도 쉬기', '쉬기' in ai_text)
    page.evaluate("() => { const n = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.innerText && e.innerText.indexOf('바로 코트를 멈추고') >= 0); if (n) n.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v153L_04_통증_바로쉬기.png')

    # ---------- 마무리 ----------
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
