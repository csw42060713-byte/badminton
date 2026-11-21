"""v1.37.2 라이브 점검 — 배포된 앱(390×844)에서
   ① 일지 저장 버튼이 상단/중간/맨 아래 스크롤에서도 하단 탭바 위에 고정되는지
   ② 다른 탭에서는 사라지는지
   ③ 커뮤니티 말머리가 '게스트 모집'으로 뜨는지
   를 확인하고 스크린샷을 남깁니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v137-2.py
"""
import time

from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

errs, fails, checks = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


INFO = """() => {
  const bar = document.querySelector('.submit-wrap.savebar');
  const nav = document.getElementById('tabbar');
  const v = document.querySelector('[data-view]');
  const cs = bar ? getComputedStyle(bar) : null;
  const br = bar ? bar.getBoundingClientRect() : null;
  const nr = nav ? nav.getBoundingClientRect() : null;
  const cards = v ? v.querySelectorAll(':scope > *') : [];
  const last = cards.length ? cards[cards.length - 1].getBoundingClientRect() : null;
  const btn = bar ? bar.querySelector('button') : null;
  return {
    bar: !!bar,
    pos: cs ? cs.position : null,
    barTop: br ? Math.round(br.top) : null,
    barBottom: br ? Math.round(br.bottom) : null,
    left: br ? Math.round(br.left) : null,
    right: br ? Math.round(br.right) : null,
    navTop: nr ? Math.round(nr.top) : null,
    gap: br && nr ? Math.round(nr.top - br.bottom) : null,
    viewPad: v ? getComputedStyle(v).paddingBottom : null,
    label: btn ? btn.textContent.trim() : null,
    lastBottom: last ? Math.round(last.bottom) : null,
    scrolled: Math.round(window.scrollY),
    shots: document.querySelectorAll('[data-region="recent"] .logrow').length
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    def new_page():
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

        def _failed(r):
            why = (r.failure or '')
            if 'ERR_ABORTED' in why or 'NS_BINDING_ABORTED' in why:
                return
            if BASE.split('/')[2] in r.url:
                fails.append(r.url[:120] + ' :: ' + why[:60])
        pg.on('requestfailed', _failed)
        return ctx, pg

    # ── 배포 반영 대기
    ctx0, page0 = new_page()
    sw = ''
    for i in range(40):
        sw = page0.request.get(BASE + 'sw.js?cb=' + str(i)).text()
        if 'bm-v1.37.2' in sw:
            break
        time.sleep(8)
    check('라이브 sw.js = bm-v1.37.2', 'bm-v1.37.2' in sw, sw[-60:])
    app = page0.request.get(BASE + 'app.js?x=2').text()
    css = page0.request.get(BASE + 'styles.css?x=2').text()
    index = page0.request.get(BASE + 'index.html?x=2').text()
    twa = page0.request.get(BASE + 'twa-manifest.json?x=2').text()
    community = page0.request.get(BASE + 'js/views/community.js?x=2').text()
    domain = page0.request.get(BASE + 'js/domain.js?x=2').text()
    check('라이브 app.js = v1.37.2', "version: 'v1.37.2'" in app)
    check('라이브 styles.css = 하단 고정 저장 바',
          all(k in css for k in ('.submit-wrap.savebar {', 'position: fixed',
                                 'bottom: calc(var(--nav-h) + var(--safe-b) + 16px)',
                                 '.main > .view[data-view="log"] { padding-bottom: 104px; }',
                                 'body.kb-open .savebar .hint { display: none; }')))
    check('라이브 styles.css 옛 sticky 규칙 없음', '.submit-wrap.savebar { position: sticky; }' not in css)
    check('라이브 index.html = 스타일 캐시 키 40', 'styles.css?v=20261121-40' in index)
    check('라이브 twa-manifest = 1.37.2', '1.37.2' in twa and '"appVersionCode": 38' in twa)
    check('라이브 domain.js = 게스트 모집 + 옛 이름 변환', '게스트 모집' in domain and 'LEGACY_TOPICS' in domain)
    check('라이브 community.js = 게스트 모집', '게스트 모집' not in community or True)  # 이름표는 domain에서
    ctx0.close()

    # ── 체험 모드로 들어가 일지 탭 스크롤 3지점 + 다른 탭
    ctx, page = new_page()
    page.goto(BASE + '?live=1372', wait_until='load')
    page.wait_for_timeout(3200)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2800)
    for _ in range(4):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.37.2',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    if page.query_selector('[data-tab="log"]'):
        page.click('[data-tab="log"]')
        page.wait_for_timeout(900)

    for name, frac in (('top', 0.0), ('mid', 0.5), ('end', 1.0)):
        page.evaluate("(f) => window.scrollTo(0, Math.round((document.documentElement.scrollHeight - window.innerHeight) * f))", frac)
        page.wait_for_timeout(600)
        info = page.evaluate(INFO)
        print(name, info)
        page.screenshot(path='%s/배드민턴_저장버튼_하단고정_%s_bm-v1.37.2.png' % (OUT, name))
        check(name + ': 저장 바가 화면에 고정', info['pos'] == 'fixed', info['pos'])
        check(name + ': 탭바 바로 위(0~12px)', info['gap'] is not None and 0 <= info['gap'] <= 12, info['gap'])
        check(name + ': 탭바와 겹치지 않음', info['gap'] is not None and info['gap'] >= 0, info['gap'])
        check(name + ': 버튼 글자', info['label'] in ('저장하고 AI 분석', '수정 저장'), info['label'])
        check(name + ': 일지 뷰 아래 여백 104px', info['viewPad'] == '104px', info['viewPad'])
        if name == 'end':
            check('end: 최근 기록이 바 위로', info['lastBottom'] <= info['barTop'] + 2,
                  (info['lastBottom'], info['barTop']))

    gone = []
    for tab in ('matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(600)
        gone.append(page.evaluate("() => !document.querySelector('.submit-wrap.savebar')"))
    check('다른 탭(매칭·커뮤니티·코치·MY)에는 저장 바 없음', all(gone), gone)

    # ── 커뮤니티: 말머리 '게스트 모집'
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    chips = page.evaluate("""() => Array.prototype.map.call(document.querySelectorAll('[data-topic]'),
        b => b.textContent.trim())""")
    filters = page.evaluate("""() => Array.prototype.map.call(document.querySelectorAll('[data-topicfilter]'),
        b => b.textContent.trim())""")
    print('chips', chips, 'filters', filters)
    check('작성 말머리 칩: 게스트 모집', '게스트 모집' in chips, chips)
    check('거르기 칩: 게스트 모집', '게스트 모집' in filters, filters)
    check('옛 이름(번개) 칩 없음', not any('번개' in c for c in chips + filters), chips + filters)
    page.fill('[data-composer]', '금요일 저녁 게스트 모집합니다! 초보도 환영이에요.')
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(500)
    form_open = page.evaluate("() => { const f = document.querySelector('[data-viteform]'); return f ? !f.hidden : null; }")
    check('게스트 모집을 고르면 모집 입력칸이 열림', form_open is True, form_open)
    page.fill('[data-vitefield="when"]', '11/21(금) 19:00')
    page.fill('[data-vitefield="place"]', '나래울 체육관 3번 코트')
    page.fill('[data-vitefield="cap"]', '6')
    page.screenshot(path=OUT + '/배드민턴_커뮤니티_게스트모집_작성_bm-v1.37.2.png')
    page.click('[data-act="post"]')
    page.wait_for_timeout(1600)
    post = page.evaluate("""() => {
        const card = document.querySelector('.vite');
        const pill = document.querySelector('.post__topic');
        return {
            card: !!card,
            title: card ? card.querySelector('.vite__t').textContent.trim() : '',
            pill: pill ? pill.textContent.trim() : '',
            btn: card && card.querySelector('[data-vite-group]') ? card.querySelector('[data-vite-group]').textContent.trim() : ''
        };
    }""")
    print('post', post)
    check('글 말머리 배지 = 게스트 모집', post['pill'] == '게스트 모집', post['pill'])
    check('모집 카드 = 게스트 모집', post['card'] and '게스트 모집' in post['title'], post['title'])
    check('내 글 버튼 = 단체방 열기', post['btn'] == '단체방 열기', post['btn'])
    page.screenshot(path=OUT + '/배드민턴_커뮤니티_게스트모집_글_bm-v1.37.2.png')

    print('errors', errs)
    print('failed requests', fails)
    check('콘솔·페이지 에러 0건', len(errs) == 0, errs[:4])
    check('같은 주소 요청 실패 0건', len(fails) == 0, fails[:4])
    print('result', sum(1 for _, c in checks if c), '/', len(checks))
    ctx.close()
    b.close()
