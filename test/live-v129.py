import sys, time, os, json
from playwright.sync_api import sync_playwright

OUT = '/workspace/downloads'
BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
errs, fails = [], []
checks = []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
    page.on('requestfailed', lambda r: fails.append(r.url[:120]))

    # 배포 반영 기다리기 (Pages 빌드)
    sw = ''
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.29.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.29.0', 'bm-v1.29.0' in sw, sw[:60])
    app = page.request.get(BASE + 'app.js?x=1').text()
    dom = page.request.get(BASE + 'js/domain.js?x=1').text()
    chat = page.request.get(BASE + 'js/views/chat.js?x=1').text()
    comm = page.request.get(BASE + 'js/views/community.js?x=1').text()
    prof = page.request.get(BASE + 'js/views/profile.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    check('라이브 app.js = v1.29.0', "version: 'v1.29.0'" in app)
    check('라이브 domain.js = mannerReceived·meetStatus', 'function mannerReceived' in dom and 'function meetStatus' in dom)
    check('라이브 chat.js = 매너 태그 칩', 'data-manner-tag' in chat)
    check('라이브 community.js = 마감·대기 문의·명단', 'waitLabel' in comm and 'data-vite-members' in comm)
    check('라이브 profile.js = 받은 매너', 'mannerBlock' in prof)
    check('라이브 styles.css = 매너·마감 스타일', '.manner__chip' in css and '.vite--closed' in css)

    page.goto(BASE + '?live=129', wait_until='load')
    page.wait_for_timeout(2500)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(3):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(500)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.29.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    # 커뮤니티 → 번개 모집 글 (정원 1명 → 글쓴이 혼자서 정원 도달 = 자동 마감)
    page.goto(BASE + '#/community', wait_until='load')
    page.wait_for_timeout(1500)
    ta = page.query_selector('[data-composer]')
    if ta is None:
        page.click('[data-tab="community"]')
        page.wait_for_timeout(900)
        ta = page.query_selector('[data-composer]')
    ta.fill('라이브 점검용 번개 글입니다. 정원 1명으로 올려 마감 표시를 확인해요.')
    page.click('[data-topic="번개"]')
    page.wait_for_timeout(300)
    when = page.query_selector('[data-vitefield="when"]')
    when.fill('11/21(금) 19:00')
    cap = page.query_selector('[data-vitefield="cap"]')
    cap.fill('1')
    page.click('[data-act="post"]')
    page.wait_for_timeout(1200)
    card = page.query_selector('.vite')
    txt = card.inner_text() if card else ''
    check('라이브 번개 카드 = 마감', '마감' in txt, txt.replace('\n', ' | ')[:160])
    check('라이브 글쓴이 카드 = 참여자 1명', '참여자 1명' in txt, txt[:80])
    check('라이브 글쓴이 카드 = 명단 보기', bool(page.query_selector('[data-vite-members]')))
    page.evaluate("document.querySelector('[data-region=\"posts\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(500)
    page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.29.0_커뮤니티마감.png')

    # 글쓴이 명단 시트
    page.click('[data-vite-members]')
    page.wait_for_timeout(700)
    check('참여자 명단 시트', '참여자' in (page.query_selector('#sheet') or page).inner_text())
    page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.29.0_참여자명단.png')
    page.click('#sheet [data-close]')
    page.wait_for_timeout(400)

    # 내 프로필(커뮤니티 글쓴이 아바타) → 받은 매너 한 줄 (아직 없음)
    au = page.query_selector('[data-author]')
    if au:
        au.click()
        page.wait_for_timeout(800)
        body = page.query_selector('#sheet')
        sheet_txt = body.inner_text() if body else ''
        check('프로필 시트 = 받은 매너 줄', '매너' in sheet_txt, sheet_txt.replace('\n', ' | ')[:160])
        page.screenshot(path=f'{OUT}/배드민턴_라이브_bm-v1.29.0_프로필매너.png')
        page.click('#sheet [data-close]')
        page.wait_for_timeout(300)

    print('CONSOLE ERRORS', errs if errs else 'none')
    print('REQ FAILED', fails if fails else 'none')
    b.close()

bad = [c for c in checks if not c[1]]
print('SUMMARY', str(len(checks) - len(bad)) + '/' + str(len(checks)))
sys.exit(1 if bad or errs else 0)
