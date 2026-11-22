"""bm-v1.52.2 로컬 점검 (390×844) — 조환비 님 피드백 3종

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일·CDN 요청은 막습니다 → 인터넷 없는 폰과 같은 상태).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY) 정상 · 콘솔 오류 0 · 가로 넘침 0
  B) 일지 & AI → 영상 자세 비교 예시: 논문 참고 수치가 '참고 기준 보기'로 접혀 있고(기본 닫힘),
     누르면 펼쳐져 Miller 등 출처가 보인다
  C) 커뮤니티 → 게스트 모집: 오늘(일요일) 날짜 칩에 같은 날짜가 두 번 나오지 않는다
     ('오늘 11/22(일)' · '내일 11/23(월)', '이번 주말 11/22(일)' 없음)
  D) 코치: 소속 체육관·프로필 클럽(경기 나래울)을 누르면 그 체육관 지도가 바로 열린다
· 실행(저장소 루트에서):
  (python3 -m http.server 8819 --bind 127.0.0.1 &) ; python3 test/local-v152_2.py
"""

import json

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8819/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'chap1522@example.com'
COACH_KEY = 'coach1522_key'
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

    def login(email, nick, rows=None):
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
        if rows is not None:
            key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
            page.evaluate("(a) => { localStorage.setItem(a.key, a.rows); }", {'key': key, 'rows': rows})
            page.reload(wait_until='load')
            page.wait_for_timeout(2400)
        return page.evaluate("() => (BM.app && BM.app.ctx && BM.app.ctx.store.state.me && BM.app.ctx.store.state.me.key) || ''")

    def rows_json():
        key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
        return page.evaluate("(k) => localStorage.getItem(k) || '[]'", key)

    me = login(PLAYER, '자세왕')
    check('앱 진입 · 버전 v1.52.2', page.evaluate("() => BM.app.version") == 'v1.52.2',
          page.evaluate("() => BM.app.version"))
    check('앱 진입(일지 & AI)', has(page, '[data-act="open-scoreboard"]'), me)

    # ── A. 기존 5개 탭 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(560)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab), body[:50].replace('\n', ' '))

    # ── B. 영상 자세 비교 — 참고 기준 접기 ──
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(700)
    page.click('[data-pose-demo]')
    page.wait_for_timeout(900)
    check('B 참고 기준 상자가 있다', has(page, '[data-pose-ref]'))
    check('B 기본은 닫힘', page.evaluate(
        "() => { const d = document.querySelector('[data-pose-ref]'); return d && d.tagName === 'DETAILS' && !d.open; }"))
    check('B "참고 기준 보기" 글자', '참고 기준 보기' in text_of(page, '[data-pose-ref]'), text_of(page, '[data-pose-ref]')[:40])
    check('B 닫혀 있으면 출처 글자는 안 보임', page.evaluate(
        "() => { const n = document.querySelector('[data-pose-foot]'); return !n || n.innerText.trim() === ''; }"))
    page.evaluate("() => document.querySelector('[data-pose-ref]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v152_2_01_자세비교_참고접힘.png')
    page.click('[data-pose-ref] summary')
    page.wait_for_timeout(420)
    check('B 누르면 펼쳐진다', page.evaluate("() => document.querySelector('[data-pose-ref]').open"))
    foot = text_of(page, '[data-pose-foot]')
    check('B 펼치면 논문 출처(Miller 등)', 'Miller' in foot and '참고 수치' in foot, foot[:120])
    page.screenshot(path=OUT + '/v152_2_02_자세비교_참고펼침.png')
    page.click('[data-pose-ref] summary')
    page.wait_for_timeout(300)
    check('B 다시 누르면 접힌다', page.evaluate("() => !document.querySelector('[data-pose-ref]').open"))
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(400)

    # ── C. 커뮤니티 게스트 모집 — 일요일 날짜 칩 ──
    page.click("#tabbar [data-tab='community']")
    page.wait_for_timeout(700)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(600)
    chips = page.evaluate("""() => Array.from(document.querySelectorAll('[data-viteday-quick]'))
        .map(b => ({ date: b.getAttribute('data-viteday-quick'), text: b.innerText.replace(/\\n/g, ' ') }))""")
    dates = [c['date'] for c in chips]
    check('C 날짜 칩이 보인다', len(chips) >= 2, chips)
    check('C 같은 날짜가 두 번 나오지 않는다', len(set(dates)) == len(dates), dates)
    check('C 오늘 11/22(일) 칩', any('11/22(일)' in c['text'] for c in chips), chips)
    check('C 내일 11/23(월) 칩', any('11/23(월)' in c['text'] for c in chips), chips)
    check('C "이번 주말 11/22(일)" 중복 없음',
          not any(c['text'].startswith('이번 주말') and c['date'] == '2026-11-22' for c in chips), chips)
    check('C 앱의 칩 함수도 2개(오늘·내일)',
          page.evaluate("() => BM.domain.meetWhen.quickDates(new Date(2026, 10, 22)).length") == 2)
    page.evaluate("() => document.querySelector('[data-viteday]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v152_2_03_게스트모집_날짜칩.png')

    # ── D. 코치 — 소속 체육관·프로필 클럽 → 지도 ──
    rows = json.loads(rows_json())
    rows.append({
        'id': 'mentor-1522-local', 'type': '멘토신청', 'createdAt': '2026-11-22 08:00:00',
        'date': '2026-11-22', 'nick': '콕집사', 'userKey': COACH_KEY, 'target': 'admin',
        'status': '승인', 'payload': {
            'type': '체육관 코치', 'affiliation': '나래울 배드민턴장 · 매원고 배드민턴부',
            'experience': '7년', 'awards': '시 대회 3위', 'proof': '재직 확인', 'proofUrl': '',
            'proofPhoto': '', 'reason': '성인반을 봅니다', 'status': '승인',
            'submitted': '2026-11-20 10:00:00', 'level': 'B조', 'discipline': '복식',
            'region': '경기', 'club': '나래울'
        }
    })
    login(PLAYER, '자세왕', rows=json.dumps(rows, ensure_ascii=False))
    page.click("#tabbar [data-tab='coach']")
    page.wait_for_timeout(1200)
    cards = text_of(page, '.coachcards') if has(page, '.coachcards') else ''
    check('D 코치 카드에 소속', '나래울 배드민턴장' in cards, cards[:120])
    check('D 소속 이름이 누를 수 있는 칩',
          has(page, '.coachcard__gyms [data-gym-open="naraeul"]'),
          page.evaluate("() => Array.from(document.querySelectorAll('.coachcard__gyms [data-gym-open]')).map(b => b.getAttribute('data-gym-open')).join(',')"))
    check('D 프로필 클럽(경기 나래울)도 누를 수 있게', has(page, '.coachcard__meta [data-gym-open="naraeul"]'),
          text_of(page, '.coachcard__meta'))
    check('D 활동 증명됨 그대로', '활동 증명됨' in cards)
    page.screenshot(path=OUT + '/v152_2_04_코치카드_지도칩.png')

    page.click('.coachcard__gyms [data-gym-open="naraeul"]')
    page.wait_for_timeout(1800)
    check('D 소속 이름 한 번에 체육관 지도', has(page, '#gympage'))
    focus = text_of(page, '#gympage [data-gym-focuscard]') if has(page, '#gympage [data-gym-focuscard]') else text_of(page, '#gympage')
    check('D 지도가 나래울 배드민턴장으로', '나래울 배드민턴장' in focus, focus[:140])
    page.screenshot(path=OUT + '/v152_2_05_지도_나래울.png')
    close = page.query_selector('[data-gym-close]')
    if close:
        close.click()
        page.wait_for_timeout(900)

    # 프로필 클럽(경기 나래울) 쪽으로도 한 번
    if has(page, '.coachcard__meta [data-gym-open="naraeul"]'):
        page.click('.coachcard__meta [data-gym-open="naraeul"]')
        page.wait_for_timeout(1800)
        check('D 클럽 이름(경기 나래울) 한 번에 지도', has(page, '#gympage'))
        page.screenshot(path=OUT + '/v152_2_06_지도_클럽경로.png')
        close2 = page.query_selector('[data-gym-close]')
        if close2:
            close2.click()
            page.wait_for_timeout(800)

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
