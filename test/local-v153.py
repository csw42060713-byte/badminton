"""bm-v1.53.0 로컬 점검 (390×844) — 점프 최고점 임팩트 · 통증 즉시 휴식

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일·CDN 요청은 막습니다 → 인터넷 없는 폰과 같은 상태).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY) 정상 · 콘솔 오류 0 · 가로 넘침 0
  B) 일지 & AI → 영상 자세 비교 → '점프 스매시 예시'
     1구간 '좋아요'(100%) · 2구간 '조금 늦어요'(최고점보다 0.3초(3프레임) 늦음) · 점프 카드 문구
  C) 1인 예시(제자리) → '제자리 타점' 중립, 풋워크 모드에는 점프 카드 없음
  D) 일지에 '무릎' 통증을 남기고 저장 → AI 카드에 '바로 코트를 멈추고 쉬면서' 기준이 먼저 나온다
· 실행(저장소 루트에서):
  (python3 -m http.server 8820 --bind 127.0.0.1 &) ; python3 test/local-v153.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8821/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'jump153@example.com'
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


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
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
              onboardedAt: '2026-11-21 09:00:00',
              profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-21 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)

    def openPose():
        page.click("#tabbar [data-tab='log']")
        page.wait_for_timeout(700)
        page.click('[data-act="open-pose"]')
        page.wait_for_timeout(700)

    def cardText(key):
        return text_of(page, '[data-pose-card="%s"]' % key)

    me = login(PLAYER, '점프왕')
    check('앱 진입 · 버전 v1.53.0', page.evaluate("() => BM.app.version") == 'v1.53.0',
          page.evaluate("() => BM.app.version"))
    check('앱 진입(일지 & AI)', has(page, '[data-act="open-scoreboard"]'), me)

    # ── A. 기존 5개 탭 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(560)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:50].replace('\n', ' '))

    # ── B. 점프 스매시 예시 ──
    openPose()
    check('B 점프 예시 버튼이 있다', has(page, '[data-pose-demo="jump"]'))
    page.click('[data-pose-demo="jump"]')
    page.wait_for_timeout(1100)
    check('B 점프 예시는 두 구간', count(page, '[data-pose-seg]') == 2,
          count(page, '[data-pose-seg]'))
    seg1 = text_of(page, '[data-pose-seg="0"]')
    seg2 = text_of(page, '[data-pose-seg="1"]')
    check('B 1구간 = 좋아요', '좋아요' in seg1, seg1.replace('\n', ' '))
    check('B 2구간 = 보완 1건', '보완 1건' in seg2, seg2.replace('\n', ' '))

    jump = cardText('jump')
    check('B 점프 카드가 나온다', '점프 최고점 · 타점 타이밍' in jump, jump.replace('\n', ' ')[:120])
    check('B 1구간은 최고점 100% · 좋아요', '100%' in jump and '좋아요' in jump,
          jump.replace('\n', ' ')[:120])
    check('B 최고점 부근이면 칭찬', '최고점에서 공을 맞췄어요' in jump, jump.replace('\n', ' ')[:160])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v153_01_점프예시_최고점타점.png')

    page.click('[data-pose-seg="1"]')
    page.wait_for_timeout(700)
    jump2 = cardText('jump')
    check('B 2구간 점프 카드 = 조금 늦어요', '조금 늦어요' in jump2, jump2.replace('\n', ' ')[:120])
    check('B 몇 초(프레임) 늦었는지 나온다', '0.3초(3프레임)' in jump2, jump2.replace('\n', ' ')[:200])
    check('B 내려오면서 치면 타점이 떨어진다고 짚는다', '내려오면서' in jump2 and '최고점' in jump2,
          jump2.replace('\n', ' ')[:220])
    one = text_of(page, '[data-pose-one]') if has(page, '[data-pose-one]') else ''
    check('B 맨 위 한 줄도 점프를 먼저 짚는다', '최고점' in one, one[:120])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v153_02_점프예시_내려오며타점.png')

    # ── C. 제자리(1인) 예시 · 풋워크 ──
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(500)
    openPose()
    page.click('[data-pose-demo]')
    page.wait_for_timeout(900)
    stay = cardText('jump')
    check('C 제자리 타격은 제자리 타점(중립)', '제자리' in stay and '제자리 타점' in stay,
          stay.replace('\n', ' ')[:120])
    one = text_of(page, '[data-pose-one]') if has(page, '[data-pose-one]') else ''
    check('C 맨 위 한 줄은 점프를 지적하지 않는다', '점프' not in one, one[:120])
    page.evaluate("() => document.querySelector('[data-pose-card=\"jump\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v153_03_제자리타점_중립.png')

    page.click('[data-pose-mode="foot"]')
    page.wait_for_timeout(800)
    check('C 풋워크에는 점프 카드가 없다', not has(page, '[data-pose-card="jump"]'),
          text_of(page, '.pose__cards')[:120].replace('\n', ' '))
    check('C 풋워크 카드 4장', count(page, '[data-pose-card]') == 4, count(page, '[data-pose-card]'))
    page.click('[data-pose-mode="smash"]')
    page.wait_for_timeout(700)
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(500)

    # ── D. 통증 · 바로 멈추는 기준 ──
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.click('[data-chipgroup="pain"] [data-chip="무릎"]')
    page.wait_for_timeout(400)
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(2200)
    ai = text_of(page, '#main')
    check('D 저장 후 AI 카드에 중단 기준', '바로 코트를 멈추고' in ai, ai[:200].replace('\n', ' '))
    check('D 조금이라도 아픈 느낌', '조금이라도 아픈 느낌' in ai)
    check('D 오늘 점검에도 같은 기준', '조금이라도 아픈 느낌이 들면' in text_of(page, '#main'))
    page.evaluate("() => { const n = Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && e.innerText && e.innerText.indexOf('바로 코트를 멈추고') >= 0); if (n) n.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v153_04_통증_바로쉬기.png')

    # ── 마무리: 5개 탭 회귀 + 오류/넘침 ──
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
