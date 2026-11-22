"""bm-v1.54.0 로컬 점검 (390×844 · 844×390) — 점수판 파트너·라이벌 전적 자동 누적

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY) 정상 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
  B) 코트 점수판 — 파트너·라이벌 이름표(2탭) · 이름을 적으면 카드 위에 함께
     · 1세트(21:17) → '오늘 일지에 넣기' → 일지 폼에 점수·파트너·라이벌 자동 채움
  C) 저장 → 파트너 카드 + 라이벌 맞대결 카드(1승) · 가로 점수판(844×390) 정상
  D) 두 번째 경기(패)를 라이벌 칩으로 고르고 저장 → 라이벌 전적 1승 1패로 누적
  E) 일지 입력칸의 최근 라이벌 칩 · 한 줄 전적
· 실행(저장소 루트에서):
  (python3 -m http.server 8822 --bind 127.0.0.1 &) ; python3 test/local-v154.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8822/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'score154@example.com'

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

    def play(set_points):
        """(내 점수, 상대 점수) 를 번갈아 눌러 한 세트를 끝냅니다."""
        mine, theirs = set_points
        a = b = 0
        while (a < mine or b < theirs):
            go_a = False if a >= mine else (True if b >= theirs else (a <= b))
            tap('[data-sb-point="%s"]' % ('a' if go_a else 'b'), 60)
            if go_a:
                a += 1
            else:
                b += 1
        page.wait_for_timeout(300)

    login(PLAYER, '점수왕')
    check('앱 진입 · 버전 v1.54.0', page.evaluate("() => BM.app.version") == 'v1.54.0',
          page.evaluate("() => BM.app.version"))
    check('A 일지 & AI 첫 화면', has(page, '[data-act="open-scoreboard"]'))

    # ── A. 기존 5개 탭 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 560)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 점수판에서 파트너·라이벌 고르기 ──
    tap("#tabbar [data-tab='log']", 700)
    tap('[data-act="open-scoreboard"]', 800)
    check('B 점수판이 열린다', has(page, '[data-sb]'))
    check('B 파트너·라이벌 이름표 버튼', has(page, '[data-sb-pick="partner"]') and has(page, '[data-sb-pick="rival"]'))
    tap('[data-sb-pick="partner"]', 400)
    check('B 파트너 고르기 칸 열림(1탭)', has(page, '[data-sb-picker="partner"]') and has(page, '[data-sb-name-input="partner"]'))
    page.fill('[data-sb-name-input="partner"]', '조환비')
    page.wait_for_timeout(250)
    tap('[data-sb-pick="rival"]', 400)
    check('B 라이벌 고르기 칸 열림', has(page, '[data-sb-picker="rival"]') and has(page, '[data-sb-name-input="rival"]'))
    page.fill('[data-sb-name-input="rival"]', '김원호')
    page.wait_for_timeout(250)
    tap('[data-sb-pick-close]', 400)
    check('B 카드 위에 파트너 이름', '내 팀 · 조환비' in text_of(page, '[data-sb]'), text_of(page, '[data-sb-board]')[:80] if has(page, '[data-sb-board]') else '')
    check('B 카드 위에 라이벌 이름', '상대 팀 · 김원호' in text_of(page, '[data-sb]'))
    check('B 세로에서 +1 카드 두 개', count(page, '[data-sb-point]') == 2)

    play((21, 17))
    check('B 1세트 끝(21:17)', has(page, '[data-sb-save]'), text_of(page, '.sb__state'))
    page.screenshot(path=OUT + '/v154_scoreboard_partner_rival.png')

    # ── 가로 점수판 ──
    page.set_viewport_size({'width': 844, 'height': 390})
    page.wait_for_timeout(600)
    check('B 가로: 내 팀이 왼쪽', has(page, '.sb--full[data-sb-view="land"]'))
    w = overflow(page)
    check('B 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('B 가로에서도 이름표·+1·넣기', has(page, '[data-sb-pick="rival"]') and count(page, '[data-sb-point]') == 2 and has(page, '[data-sb-save]'))
    page.screenshot(path=OUT + '/v154_scoreboard_landscape.png')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(600)

    # ── C. 일지에 채우기 ──
    tap('[data-sb-save]', 900)
    check('C 점수판이 닫힌다', not has(page, '[data-sb]'))
    check('C 일지 파트너 칸 자동 채움', val(page, '[data-field="partner"]') == '조환비', val(page, '[data-field="partner"]'))
    check('C 일지 라이벌 칸 자동 채움', val(page, '[data-field="rival"]') == '김원호', val(page, '[data-field="rival"]'))
    check('C 게임 점수 자동 채움', '21' in val(page, '[data-field="gameA"]') and '17' in val(page, '[data-field="gameB"]'),
          [val(page, '[data-field="gameA"]'), val(page, '[data-field="gameB"]')])
    note = val(page, '[data-field="note"]')
    check('C 메모에 파트너·라이벌', '함께 조환비' in note and '상대 김원호' in note, note)
    check('C 파트너 전적 줄은 첫 경기라 비어 있음', page.evaluate("() => { const n=document.querySelector('[data-ptn-now]'); return !n || n.hidden; }"))
    w = overflow(page)
    check('C 일지 가로 넘침 없음', w[0] <= w[1] + 1, w)
    page.evaluate("() => { const n=document.querySelector('[data-fold=\"games\"]'); if (n) n.open = true; }")
    page.wait_for_timeout(350)
    page.evaluate("() => { const n=document.querySelector('[data-partner-field]'); if (n) n.scrollIntoView({block:'start'}); window.scrollBy(0, -120); }")
    page.wait_for_timeout(450)
    page.screenshot(path=OUT + '/v154_log_autofill.png')
    field = page.query_selector('[data-games]')
    if field: field.screenshot(path=OUT + '/v154_games_field.png')

    # ── 저장 ──
    tap('[data-act="save-log"]', 1600)
    check('C 저장 후 라이벌 카드', has(page, '[data-region="rival"]'), text_of(page, '[data-region="rival"]')[:80])
    rival_txt = text_of(page, '[data-region="rival"]')
    check('C 라이벌 카드에 1승', '김원호에게 1승' in rival_txt, rival_txt[:120].replace('\n', ' '))
    check('C 파트너 카드 그대로', has(page, '[data-region="partner"]'))
    page.evaluate("() => { const n = document.querySelector('[data-region=\"rival\"]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v154_rival_card.png')

    # ── D. 두 번째 경기(패) — 라이벌 칩으로 고르기 ──
    tap('[data-act="open-scoreboard"]', 800)
    tap('[data-sb-pick="rival"]', 400)
    check('D 최근 라이벌 칩이 나온다', has(page, '[data-sb-name-val="김원호"]'))
    tap('[data-sb-name-val="김원호"]', 500)
    check('D 칩 한 번으로 라이벌 선택', '상대 팀 · 김원호' in text_of(page, '[data-sb]'))
    play((15, 21))
    tap('[data-sb-save]', 1200)
    check('D 두 번째 일지 라이벌 채움', val(page, '[data-field="rival"]') == '김원호', val(page, '[data-field="rival"]'))
    tap('[data-act="save-log"]', 1800)
    rival_txt = text_of(page, '[data-region="rival"]')
    check('D 라이벌 전적 누적(1승 1패)', '1승 1패' in rival_txt, rival_txt[:160].replace('\n', ' '))
    page.evaluate("() => { const n = document.querySelector('[data-region=\"rival\"]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v154_rival_accumulated.png')

    # ── E. 일지 입력칸의 최근 라이벌 칩·한 줄 전적 ──
    page.evaluate("() => { const n = document.querySelector('[data-fold=\"games\"]'); if (n) n.open = true; }")
    page.wait_for_timeout(300)
    check('E 최근 라이벌 칩', has(page, '[data-rvl-chip="김원호"]'))
    page.evaluate("() => { const n=document.querySelector('[data-rvl-chip=\"김원호\"]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(350)
    check('E 방금 쓴 라이벌은 켜진 칩', page.evaluate("() => { const n=document.querySelector('[data-rvl-chip=\"김원호\"]'); return !!n && n.getAttribute('aria-pressed') === 'true'; }"))
    tap('[data-rvl-chip="김원호"]', 500)
    check('E 같은 칩을 다시 누르면 지움', val(page, '[data-field="rival"]') == '', val(page, '[data-field="rival"]'))
    tap('[data-rvl-chip="김원호"]', 500)
    check('E 한 번 더 누르면 다시 들어감', val(page, '[data-field="rival"]') == '김원호', val(page, '[data-field="rival"]'))
    check('E 저장 뒤 파트너 칩도 바로 보인다', has(page, '[data-ptn-chip="조환비"]'))
    check('E 칸 아래 한 줄 전적', '2전 1승 1패' in text_of(page, '[data-rvl-now]'), text_of(page, '[data-rvl-now]'))
    page.evaluate("() => { const n = document.querySelector('[data-field=\"rival\"]'); if (n) n.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v154_log_rival_chips.png')

    # ── 마무리: 5개 탭 한 번 더 · 오류 점검 ──
    for tab in ['matching', 'community', 'coach', 'my', 'log']:
        tap("#tabbar [data-tab='%s']" % tab, 420)
        check('마무리 탭 %s' % tab, has(page, "[data-view='%s']" % tab))

    check('콘솔 오류 0', len(errs) == 0, errs[:3])
    check('CSP 위반 0', len(csp) == 0, csp[:3])
    print('   (오프라인 차단으로 실패한 외부 요청 %d건 — 앱 파일 실패 아님)' % len(blocked))

    ok = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과 · 실패 %d' % (ok, len(checks), len(checks) - ok))
