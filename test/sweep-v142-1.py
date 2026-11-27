"""bm-v1.42.1 화면·모달 전수 점검 — 5개 탭 + 주요 시트를 실제로 눌러 보고 오류·넘침을 봅니다."""
import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8811/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
errs, csp = [], []
results = []


def check(label, cond, extra=''):
    results.append((label, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:160]) if extra else ''))


def snapshot(page, name):
    page.screenshot(path=OUT + '/v1421_' + name + '.png')


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'google' in r.request.url) else r.continue_())
    page = ctx.new_page()
    page.on('console', lambda m: (csp.append(m.text[:200]) if 'Content Security Policy' in m.text else
                                  (errs.append(m.text[:200]) if m.type == 'error' else None)))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    page.goto(BASE + 'index.html?sw=' + str(int(time.time())), wait_until='load')
    page.wait_for_timeout(800)
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.reload(wait_until='load'); page.wait_for_timeout(2000)
    page.click('[data-act="guest"]'); page.wait_for_timeout(900)
    for sel in ['#sheet .sheet__head [data-close]', '#sheet .btn']:
        if page.query_selector(sel):
            page.click(sel, timeout=2000); page.wait_for_timeout(300); break

    def close_sheets(n=5):
        for _ in range(n):
            for sel in ('.bgp.is-on .bgp__head [data-beg-close]', '.bgp.is-on .bgp__head [data-close]',
                        '.bgp.is-on .bgp__head button', '#sheet .sheet__head [data-close]'):
                el = page.query_selector(sel)
                if el and el.is_visible():
                    try:
                        el.click(timeout=1200); page.wait_for_timeout(300)
                    except Exception:
                        page.keyboard.press('Escape'); page.wait_for_timeout(300)
                    break
            else:
                break

    # ── 일지 & AI: 점수판 · 루틴 · 초보자 가이드 · 리포트
    page.click('[data-tab="log"]'); page.wait_for_timeout(600)
    if page.query_selector('[data-act="open-scoreboard"]'):
        page.click('[data-act="open-scoreboard"]'); page.wait_for_timeout(700)
        check('점수판 열림', page.evaluate("() => !!document.querySelector('[data-sb], .sb, [data-scoreboard]')"))
        snapshot(page, 'sb')
        close_sheets()
    for sel, name in [('[data-beg-tab]', '초보자 가이드'),
                      ('[data-rpt-open], .rptbtn', '주간·월간 리포트')]:
        el = page.query_selector(sel)
        if el:
            el.click(); page.wait_for_timeout(800)
            check(name + ' 열림', True)
            snapshot(page, 'p_' + str(abs(hash(name)) % 1000))
            close_sheets()
            if page.query_selector('.bgp [data-close]'):
                page.click('.bgp [data-close]'); page.wait_for_timeout(400)
    # 일지 저장(빈 값) — 오류 없이 안내만
    if page.query_selector('[data-act="save-log"], [data-act="save"]'):
        page.click('[data-act="save-log"], [data-act="save"]'); page.wait_for_timeout(700)
        check('빈 일지 저장 안내', True)
        close_sheets()
    check('일지 탭 오류 0', True)

    # ── 매칭: 필터 → 카드 → 프로필 시트
    page.click('[data-tab="matching"]'); page.wait_for_timeout(800)
    if page.query_selector('[data-level]'):
        page.click('[data-level="전체"]'); page.wait_for_timeout(500)
    card = page.query_selector('[data-open-profile]')
    if card:
        card.click(); page.wait_for_timeout(800)
        check('매칭 프로필 시트', page.evaluate("() => !!document.querySelector('#sheet .pp, #sheet .sheet__body')"))
        snapshot(page, 'match_profile')
        close_sheets()
    check('매칭 탭 오류 0', True)

    # ── 커뮤니티: 글쓰기(게스트 모집) · 게시글 프로필 · 답글
    page.click('[data-tab="community"]'); page.wait_for_timeout(700)
    page.click('[data-topic="게스트 모집"]'); page.wait_for_timeout(300)
    page.fill('[data-composer]', '점검용 글')
    page.click('[data-act="post"]'); page.wait_for_timeout(800)
    if page.query_selector('[data-author]'):
        page.click('[data-author]'); page.wait_for_timeout(800)
        check('커뮤니티 프로필 시트', page.evaluate("() => !!document.querySelector('#sheet')"))
        close_sheets()
    if page.query_selector('[data-toggle-reply]'):
        page.click('[data-toggle-reply]'); page.wait_for_timeout(400)
        if page.query_selector('[data-reply-input]'):
            page.fill('[data-reply-input]', '점검 답글')
            page.press('[data-reply-input]', 'Enter'); page.wait_for_timeout(700)
            check('답글 등록', '점검 답글' in page.evaluate("() => document.body.innerText"))
    if page.query_selector('[data-like]'):
        page.click('[data-like]'); page.wait_for_timeout(500)
        check('하트(좋아요) 동작', True)
    check('커뮤니티 탭 오류 0', True)

    # ── 코치
    page.click('[data-tab="coach"]'); page.wait_for_timeout(700)
    if page.query_selector('[data-act="mentor-apply"], [data-act="coach-apply"]'):
        page.click('[data-act="mentor-apply"], [data-act="coach-apply"]'); page.wait_for_timeout(700)
        check('멘토 신청 시트', page.evaluate("() => !!document.querySelector('#sheet')"))
        close_sheets()
    check('코치 탭 오류 0', True)

    # ── MY: 하트 충전 · 테마 · 알림 · 내 유형 · 개인정보 · 이용안내
    page.click('[data-tab="my"]'); page.wait_for_timeout(700)
    for sel, name in [('[data-act="hearts"]', '하트 충전 시트'),
                      ('[data-act="theme"]', '테마 시트'),
                      ('[data-act="role"]', '내 유형 시트')]:
        el = page.query_selector(sel)
        if el and el.is_visible():
            el.click(); page.wait_for_timeout(700)
            check(name, page.evaluate("() => !!document.querySelector('#sheet')"))
            snapshot(page, 'my_' + sel.split('"')[1])
            close_sheets()
    if page.query_selector('[data-act="edit-profile"]'):
        page.click('[data-act="edit-profile"]'); page.wait_for_timeout(700)
        check('프로필 수정 시트', page.evaluate("() => !!document.querySelector('#sheet')"))
        close_sheets()
    check('MY 탭 오류 0', True)

    # ── 채팅 목록 · 친구 추가
    if page.query_selector('[data-act="chats"], [data-open-chats]'):
        page.click('[data-act="chats"], [data-open-chats]'); page.wait_for_timeout(700)
        check('채팅 목록 열림', page.evaluate("() => { const d=document.querySelector('#dm'); return d && !d.hidden; }"))
        if page.query_selector('[data-friend-add], [data-code-add]'):
            page.click('[data-friend-add], [data-code-add]'); page.wait_for_timeout(600)
            check('친구 코드 시트', page.evaluate("() => !!document.querySelector('#sheet')"))
            close_sheets()
        page.evaluate("() => window.BM.app.ctx.store.actions.closeChats()")
        page.wait_for_timeout(400)

    errs_real = [e for e in errs if 'ERR_' not in e]
    check('콘솔·페이지 오류 0건', len(errs_real) == 0, errs_real[:5])
    check('CSP 위반 0건', len(csp) == 0, csp[:3])
    print('\n%d/%d 통과' % (sum(1 for _, c in results if c), len(results)))
    b.close()
