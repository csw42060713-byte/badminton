"""bm-v1.44.0 로컬(390×844) 점검 — 전체화면 코트 점수판 · 전국 체육관 지도.

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글 요청은 막습니다).
· 진짜 앱(index.html)을 체험(local) 모드로 열어 실제 버튼을 눌러 확인합니다.
· 실행:
  (저장소 루트에서) python3 -m http.server 8814 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-v144.py
"""

import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8814/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def box_of(page, sel):
    return page.evaluate("""(s) => { const n = document.querySelector(s); if (!n) return null;
        const r = n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; }""", sel)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
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

    # ── 준비: 체험(local) 모드 + 로그인 상태 → 온보딩 → 앱
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'local144@example.com', name: '로컬선수', at: new Date().toISOString()
        }));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-pick="role"]'):
        page.click('[data-pick="role"][data-val="player"]')
        page.fill('#onbNick', '로컬선수')
        page.wait_for_timeout(150)
        page.click('[data-pick="level"][data-val="C조"]')
        page.click('[data-pick="discipline"][data-val="복식"]')
        page.click('[data-act="finish"]')
        page.wait_for_timeout(2200)
    check('앱 진입(일지 & AI)', page.evaluate("() => !!document.querySelector('[data-act=\"open-scoreboard\"]')"))
    page.screenshot(path=OUT + '/v144_01_log.png')

    # ══════════════════════════════════════════
    # 1. 코트 점수판 전체화면
    # ══════════════════════════════════════════
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(500)
    check('전체화면 점수판이 열린다', page.evaluate("() => !!document.querySelector('#sbfull .sb--full')"))
    vp = page.evaluate("() => ({w: innerWidth, h: innerHeight})")
    fb = box_of(page, '#sbfull')
    check('화면 전체(100dvh)를 덮는다', fb and fb['w'] >= vp['w'] - 1 and fb['h'] >= vp['h'] - 1, fb)
    fit = page.evaluate("""() => {
      const el = document.querySelector('.sb--full');
      const doc = document.scrollingElement;
      return {sb: el ? el.scrollHeight - el.clientHeight : -1,
              doc: doc ? doc.scrollHeight - innerHeight : -1};
    }""")
    check('세로 스크롤 없이 한 화면', fit['sb'] <= 1 and fit['doc'] <= 1, fit)
    check('세트 번호·점수제 표시', '1세트' in text_of(page, '.sbfull__hdr') and '21점제' in text_of(page, '.sbfull__hdr'),
          text_of(page, '.sbfull__hdr'))
    check('내 팀·상대 팀 카드', '내 팀' in text_of(page, '.sb__board') and '상대 팀' in text_of(page, '.sb__board'))
    big = box_of(page, '[data-sb-point="a"]')
    check('카드가 화면 높이를 크게 쓴다', big and big['h'] >= 150 and big['w'] >= 300, big)
    page.screenshot(path=OUT + '/v144_02_scoreboard_0_0.png')

    # 카드 전체 탭 = +1
    for _ in range(5):
        page.click('[data-sb-point="a"]')
        page.wait_for_timeout(60)
    for _ in range(3):
        page.click('[data-sb-point="b"]')
        page.wait_for_timeout(60)
    nums = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('카드를 누르면 5:3', nums == ['3', '5'] or nums == ['5', '3'], nums)

    # −1 되돌리기
    page.click('[data-sb-undo]')
    page.wait_for_timeout(250)
    nums2 = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('−1 되돌리기로 5:2', '2' in nums2 and '5' in nums2, nums2)
    page.click('[data-sb-point="b"]')
    page.wait_for_timeout(200)

    # 코트 교대 — 두 카드의 자리가 바뀐다
    before = box_of(page, '[data-sb-point="a"]')['y'], box_of(page, '[data-sb-point="b"]')['y']
    page.click('[data-sb-swap]')
    page.wait_for_timeout(300)
    after = box_of(page, '[data-sb-point="a"]')['y'], box_of(page, '[data-sb-point="b"]')['y']
    check('코트 교대로 두 카드 자리가 바뀐다', before[0] > before[1] and after[0] < after[1], [before, after])
    check('교대 상태 표시', page.get_attribute('[data-sb-swap]', 'aria-pressed') == 'true')
    page.screenshot(path=OUT + '/v144_03_scoreboard_swap.png')
    page.click('[data-sb-swap]')
    page.wait_for_timeout(250)

    # 세트 초기화
    page.click('[data-sb-reset]')
    page.wait_for_timeout(300)
    nums3 = page.evaluate("() => Array.from(document.querySelectorAll('.sb__num')).map(n => n.innerText)")
    check('세트 초기화로 0:0', nums3 == ['0', '0'], nums3)
    check('초기화도 되돌릴 수 있다', page.evaluate("() => !!document.querySelector('[data-sb-undo]')"))

    # 세트 마무리(0:17 → 21:17) → 다음 세트 → 일지에 넣기
    for _ in range(17):
        page.click('[data-sb-point="b"]')
        page.wait_for_timeout(35)
    for _ in range(21):
        page.click('[data-sb-point="a"]')
        page.wait_for_timeout(35)
    page.wait_for_timeout(300)
    check('세트 종료 표시', '세트 종료' in text_of(page, '.sb__state'), text_of(page, '.sb__state'))
    check('끝난 세트 기록', '21:17' in text_of(page, '.sb__sets'), text_of(page, '.sb__sets'))
    check('승 표시', page.evaluate("() => !!document.querySelector('.sb__res--w')"))
    page.screenshot(path=OUT + '/v144_04_scoreboard_set_over.png')
    page.click('[data-sb-next]')
    page.wait_for_timeout(300)
    check('다음 세트는 2세트', '2세트' in text_of(page, '.sbfull__hdr'), text_of(page, '.sbfull__hdr'))
    for _ in range(3):
        page.click('[data-sb-point="b"]')
        page.wait_for_timeout(60)

    check('일지에 넣기 버튼', page.evaluate("() => !!document.querySelector('[data-sb-save]')"))
    page.click('[data-sb-save]')
    page.wait_for_timeout(700)
    check('넣으면 점수판이 닫힌다', page.evaluate("() => !document.querySelector('#sbfull')"))
    ga = page.evaluate("() => { const i = document.querySelector('[data-field=\"gameA\"]'); return i ? i.value : null; }")
    gb = page.evaluate("() => { const i = document.querySelector('[data-field=\"gameB\"]'); return i ? i.value : null; }")
    note = page.evaluate("() => { const i = document.querySelector('[data-field=\"note\"]'); return i ? i.value : null; }")
    check('일지 게임 점수가 채워진다 (21:17)', ga == '21' and gb == '17', [ga, gb])
    check('메모에 코트 점수판 요약', note and '코트 점수판' in note, note)
    check('넣은 뒤 안내 토스트', '일지에 넣었어요' in text_of(page, '#toast'), text_of(page, '#toast'))
    page.screenshot(path=OUT + '/v144_05_log_filled.png')

    # 저장 → 실제 일지 기록
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(900)
    stored = page.evaluate("""() => {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('bm_rows_v1') === 0) out[k] = localStorage.getItem(k);
      }
      return out;
    }""")
    has_score = any('21:17' in v for v in stored.values())
    check('저장하면 일지에 21:17 이 남는다', has_score, (list(stored.keys())[:2], str(stored)[:160]))

    # 뒤로 가기로 닫기 (앱을 나가지 않음)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(500)
    check('다시 열린다', page.evaluate("() => !!document.querySelector('#sbfull')"))
    page.go_back()
    page.wait_for_timeout(600)
    check('뒤로 가기로 점수판만 닫힌다', page.evaluate("() => !document.querySelector('#sbfull')"))
    check('앱 화면은 그대로', page.evaluate("() => !!document.querySelector('[data-act=\"open-scoreboard\"]')"))

    # × 닫기
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(450)
    page.click('[data-sb-close]')
    page.wait_for_timeout(450)
    check('× 로 닫힌다', page.evaluate("() => !document.querySelector('#sbfull')"))

    # 다크 테마에서도 선명한지 (보기용 스크린샷)
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_night')")
    page.click('[data-act="open-scoreboard"]')
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v144_06_scoreboard_dark.png')
    page.click('[data-sb-close]')
    page.wait_for_timeout(400)
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_def')")

    # ══════════════════════════════════════════
    # 2. 전국 체육관 지도
    # ══════════════════════════════════════════
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(700)
    entry = text_of(page, '.gymentry__t')
    check('매칭 탭에 체육관 지도 입구(전국 120곳)', '전국 체육관' in entry, entry)
    page.screenshot(path=OUT + '/v144_07_matching_entry.png')
    page.click('[data-act="open-gym-map"]')
    page.wait_for_timeout(1600)
    check('지도 화면이 열린다', page.evaluate("() => !!document.querySelector('#gympage')"))
    cards = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    pins = page.evaluate("() => document.querySelectorAll('[data-gym-pin]').length")
    check('체육관 120곳 카드', cards == 120, cards)
    check('핀 120개', pins == 120, pins)
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-gym-region]')).map(b => b.innerText.replace('\\n',' '))")
    check('권역 칩 7개', len(chips) == 7, chips)
    check('머리말 전국 120곳', '전국 배드민턴 120곳' in text_of(page, '.gympage__t'), text_of(page, '.gympage__t'))
    page.screenshot(path=OUT + '/v144_08_gym_all.png')

    # 권역 칩
    page.click('[data-gym-region="seoul"]')
    page.wait_for_timeout(700)
    sc = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    check('서울 칩 → 서울만 (23곳)', sc == 23, sc)
    check('서울 칩이 켜진다', page.get_attribute('[data-gym-region="seoul"]', 'aria-pressed') == 'true')
    check('서울 안내 문구', '서울' in text_of(page, '[data-gymnote]') and '23' in text_of(page, '[data-gymnote]'),
          text_of(page, '[data-gymnote]'))
    page.screenshot(path=OUT + '/v144_09_gym_seoul.png')

    page.click('[data-gym-region="gangwon"]')
    page.wait_for_timeout(600)
    gc = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    check('강원·제주 칩 → 18곳', gc == 18, gc)
    page.screenshot(path=OUT + '/v144_10_gym_gangwon.png')

    # 검색 + 권역 조합
    page.click('[data-gym-region="gg"]')
    page.wait_for_timeout(500)
    page.fill('[data-gym-search]', '수원')
    page.wait_for_timeout(500)
    qn = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    metas = page.evaluate("() => Array.from(document.querySelectorAll('.gymcard__meta')).map(n => n.innerText)")
    check('경기·인천 + "수원" 검색 (11곳)', qn == 11 and all('수원' in t for t in metas), [qn, metas[:3]])
    check('검색 결과 안내', '검색 결과' in text_of(page, '[data-gymnote]'), text_of(page, '[data-gymnote]'))
    check('매원고가 검색에 있다', '매원고등학교 체육관' in page.evaluate(
        "() => Array.from(document.querySelectorAll('.gymcard__t h3')).map(n => n.innerText).join('|')"))
    page.screenshot(path=OUT + '/v144_11_gym_search.png')

    # 검색 지우기
    page.click('[data-gym-search-clear]')
    page.wait_for_timeout(500)
    qn2 = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    check('검색 지우면 경기·인천 전체(37곳)', qn2 == 37, qn2)

    # 즐겨찾기
    page.click('[data-gym-region="all"]')
    page.wait_for_timeout(500)
    page.click('[data-gym-fav="chilbo"]')
    page.wait_for_timeout(500)
    check('즐겨찾기 등록', page.get_attribute('[data-gym-fav="chilbo"]', 'aria-pressed') == 'true')
    check('자주 가는 체육관 칩에 이름', '서수원칠보체육관' in text_of(page, '.gymfav'),
          text_of(page, '.gymfav')[:120])
    page.click('[data-gym-filter="fav"]')
    page.wait_for_timeout(600)
    fc = page.evaluate("() => document.querySelectorAll('[data-gym-card]').length")
    check('즐겨찾기만 보기 → 1곳', fc == 1, fc)
    page.screenshot(path=OUT + '/v144_12_gym_fav.png')
    page.click('[data-gym-filter="all"]')
    page.wait_for_timeout(500)

    # 내 위치 거부 → 목록 그대로
    page.click('[data-gym-geo]')
    page.wait_for_timeout(1500)
    check('위치를 거부해도 목록은 그대로', page.evaluate("() => document.querySelectorAll('[data-gym-card]').length") == 120)
    check('거부 안내', '위치를 허용하면' in text_of(page, '[data-gymgeo]'), text_of(page, '[data-gymgeo]'))

    # 카드에서 지도로 보기
    page.click('[data-gym-view="maewon"]')
    page.wait_for_timeout(800)
    check('매원고 카드 강조', page.evaluate("() => !!document.querySelector('.gymcard.is-focus')"))
    page.screenshot(path=OUT + '/v144_13_gym_maewon.png')

    # 닫기
    page.click('[data-gym-close]')
    page.wait_for_timeout(600)
    check('지도 닫힌다', page.evaluate("() => !document.querySelector('#gympage')"))

    # 가로 넘침 없음 (전 탭)
    over = []
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        page.click('[data-tab="' + tab + '"]')
        page.wait_for_timeout(500)
        w = page.evaluate("() => document.documentElement.scrollWidth - innerWidth")
        if w > 1:
            over.append((tab, w))
    check('5개 탭 가로 넘침 0', not over, over)
    page.screenshot(path=OUT + '/v144_14_my.png')

    check('앱 콘솔 오류 0건', not errs, errs[:3])
    check('CSP 위반 0건', not csp, csp[:3])
    print('   (일부러 막은 외부 요청 실패 %d건 — 구글·Supabase·타일)' % len(blocked))

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
for f in fails:
    print('  FAIL:', f[0])
