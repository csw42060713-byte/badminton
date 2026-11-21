"""bm-v1.44.0 라이브 점검 — 전체화면 코트 점수판 · 전국 체육관 120곳.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
· 실행: LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v144.py
"""
import time
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


def tap(page, sel, n=1, wait=45):
    for _ in range(n):
        page.click(sel)
        page.wait_for_timeout(wait)


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
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(250)
    if page.query_selector('[data-pick="role"]'):
        page.click('[data-pick="role"][data-val="player"]')
        page.fill('#onbNick', '라이브선수')
        page.wait_for_timeout(150)
        page.click('[data-pick="level"][data-val="C조"]')
        page.click('[data-pick="discipline"][data-val="복식"]')
        page.click('[data-act="finish"]')
        page.wait_for_timeout(2400)

    # ── 배포 버전
    check('라이브 앱 v1.44.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.44.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    sw = page.evaluate("""async () => { const r = await fetch('sw.js?x=' + Date.now()); return await r.text(); }""")
    check('라이브 sw.js bm-v1.44.0', "bm-v1.44.0" in sw)
    check('라이브 스타일 캐시 -56', 'styles.css?v=20261121-56' in page.content())
    check('앱 진입', page.evaluate("() => !!document.querySelector('[data-act=\\'open-scoreboard\\']')"))

    # ── 1. 전체화면 점수판
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(600)
    check('전체화면 점수판 열림', page.evaluate("() => !!document.querySelector('#sbfull .sb--full')"))
    fb = page.evaluate("""() => { const n = document.querySelector('#sbfull'); const r = n.getBoundingClientRect();
        const el = document.querySelector('.sb--full');
        return {w: r.width, h: r.height, iw: innerWidth, ih: innerHeight,
                scroll: el.scrollHeight - el.clientHeight, doc: document.scrollingElement.scrollHeight - innerHeight}; }""")
    check('100dvh 전체를 덮고 스크롤 없음', fb['w'] >= fb['iw'] - 1 and fb['h'] >= fb['ih'] - 1
          and fb['scroll'] <= 1 and fb['doc'] <= 1, fb)
    card = page.evaluate("""() => { const n = document.querySelector('[data-sb-point="a"]'); const r = n.getBoundingClientRect();
        return [Math.round(r.width), Math.round(r.height)]; }""")
    check('내 팀 카드가 화면 폭·높이를 크게 씀', card[0] > 300 and card[1] > 150, card)
    tap(page, '[data-sb-point="a"]', 3)
    tap(page, '[data-sb-point="b"]', 2)
    nums = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('카드 탭 = +1 (3:2)', nums == ['2', '3'] or nums == ['3', '2'], nums)
    page.screenshot(path=OUT + '/v144l_01_scoreboard.png')

    page.click('[data-sb-undo]')
    page.wait_for_timeout(250)
    nums = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('−1 되돌리기', '1' in nums and '3' in nums, nums)
    page.click('[data-sb-point="b"]')
    page.wait_for_timeout(200)
    y0 = page.evaluate("() => document.querySelector('[data-sb-point=\\'a\\']').getBoundingClientRect().y")
    page.click('[data-sb-swap]')
    page.wait_for_timeout(350)
    y1 = page.evaluate("() => document.querySelector('[data-sb-point=\\'a\\']').getBoundingClientRect().y")
    check('코트 교대로 내 카드가 위로', y1 < y0, [y0, y1])
    page.screenshot(path=OUT + '/v144l_02_swap.png')
    page.click('[data-sb-swap]')
    page.wait_for_timeout(300)
    page.click('[data-sb-reset]')
    page.wait_for_timeout(300)
    nums = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('세트 초기화 0:0', nums == ['0', '0'], nums)

    # 세트 마무리 21:17 → 다음 세트
    tap(page, '[data-sb-point="b"]', 17, 30)
    tap(page, '[data-sb-point="a"]', 21, 30)
    page.wait_for_timeout(300)
    check('세트 종료', '세트 종료' in text_of(page, '.sb__state'), text_of(page, '.sb__state'))
    check('21:17 기록', '21:17' in text_of(page, '.sb__sets'))
    page.screenshot(path=OUT + '/v144l_03_set_over.png')
    page.click('[data-sb-next]')
    page.wait_for_timeout(350)
    check('다음 세트(2세트)', '2세트' in text_of(page, '.sbfull__hdr'), text_of(page, '.sbfull__hdr'))
    page.click('[data-sb-save]')
    page.wait_for_timeout(900)
    check('일지에 넣으면 닫힘', page.evaluate("() => !document.querySelector('#sbfull')"))
    ga = page.evaluate("() => { const i = document.querySelector('[data-field=\\'gameA\\']'); return i ? i.value : null; }")
    gb = page.evaluate("() => { const i = document.querySelector('[data-field=\\'gameB\\']'); return i ? i.value : null; }")
    note = page.evaluate("() => { const i = document.querySelector('[data-field=\\'note\\']'); return i ? i.value : ''; }")
    check('일지 점수 21:17 자동 채움', ga == '21' and gb == '17', [ga, gb])
    check('메모에 점수판 요약', '코트 점수판' in note, note)
    page.screenshot(path=OUT + '/v144l_04_log_filled.png')

    # 뒤로 가기
    page.evaluate("() => window.scrollTo(0, 0)")
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(500)
    page.go_back()
    page.wait_for_timeout(700)
    check('뒤로 가기로 점수판만 닫힘', page.evaluate("() => !document.querySelector('#sbfull')"))
    check('앱은 그대로', page.evaluate("() => !!document.querySelector('[data-act=\\'open-scoreboard\\']')"))

    # ── 2. 전국 체육관 지도
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(800)
    check('입구 카드 전국 120곳', '전국 체육관 120곳' in text_of(page, '.gymentry__t'), text_of(page, '.gymentry__t'))
    page.click('[data-act="open-gym-map"]')
    page.wait_for_timeout(3200)
    cards = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    pins = page.evaluate("() => document.querySelectorAll('[data-gym-pin]').length")
    check('카드 120 · 핀 120', cards == 120 and pins == 120, [cards, pins])
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-gym-region]')).map(b => b.innerText.replace('\\n',' '))")
    check('권역 칩 7개', len(chips) == 7, chips)
    inside = page.evaluate("""() => { const w = document.querySelector('[data-gymmap]'); const bx = w.getBoundingClientRect();
        return Array.from(w.querySelectorAll('.gypin-wrap')).filter(n => { const b = n.getBoundingClientRect();
          return b.x >= bx.x - 8 && b.right <= bx.right + 8 && b.y >= bx.y - 8 && b.bottom <= bx.bottom + 8; }).length; }""")
    check('핀이 모두 지도 안에 (전국 한 화면)', inside == 120, inside)
    page.screenshot(path=OUT + '/v144l_05_map_all.png')

    page.click('[data-gym-region="seoul"]')
    page.wait_for_timeout(900)
    check('서울 칩 23곳', page.evaluate("() => document.querySelectorAll('[data-gym-card]').length") == 23)
    page.screenshot(path=OUT + '/v144l_06_map_seoul.png')
    page.click('[data-gym-region="gg"]')
    page.wait_for_timeout(800)
    page.fill('[data-gym-search]', '수원')
    page.wait_for_timeout(700)
    qn = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    names = page.evaluate("() => Array.from(document.querySelectorAll('.gymcard__t h3')).map(n => n.innerText).join('|')")
    check('경기·인천 + 수원 = 11곳', qn == 11, qn)
    check('매원고·칠보·영통이 검색에', all(k in names for k in ['매원고등학교 체육관', '서수원칠보체육관', '영통복합체육센터']), names[:120])
    page.screenshot(path=OUT + '/v144l_07_map_search.png')
    page.click('[data-gym-search-clear]')
    page.wait_for_timeout(700)
    check('검색 지우면 37곳', page.evaluate("() => document.querySelectorAll('[data-gym-card]').length") == 37)
    page.click('[data-gym-region="all"]')
    page.wait_for_timeout(700)
    page.click('[data-gym-fav="maewon"]')
    page.wait_for_timeout(600)
    check('즐겨찾기 등록 ★', page.get_attribute('[data-gym-fav="maewon"]', 'aria-pressed') == 'true')
    page.click('[data-gym-filter="fav"]')
    page.wait_for_timeout(700)
    check('즐겨찾기만 1곳', page.evaluate("() => document.querySelectorAll('[data-gym-card]').length") == 1)
    page.screenshot(path=OUT + '/v144l_08_map_fav.png')
    page.click('[data-gym-filter="all"]')
    page.wait_for_timeout(600)
    page.click('[data-gym-close]')
    page.wait_for_timeout(600)
    check('지도 닫힘', page.evaluate("() => !document.querySelector('#gympage')"))

    # 5개 탭 · 가로 넘침 · 다크 테마
    over = []
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click('[data-tab="' + tab + '"]')
        page.wait_for_timeout(500)
        w = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
        if w > 1:
            over.append((tab, w))
    check('5개 탭 가로 넘침 0', not over, over)
    page.screenshot(path=OUT + '/v144l_09_my.png')

    page.click('[data-tab="log"]')
    page.wait_for_timeout(600)
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_night')")
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(600)
    page.screenshot(path=OUT + '/v144l_10_scoreboard_dark.png')
    page.click('[data-sb-close]')
    page.wait_for_timeout(400)

    check('앱 콘솔 오류 0건', not errs, errs[:3])
    check('CSP 위반 0건', not csp, csp[:3])
    print('   (외부 요청 실패 %d건 — 구글 로그인 등)' % len(blocked))

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
for f in fails:
    print('  FAIL:', f[0])
