"""v1.35 라이브 점검 — 배포된 앱(390×844)에서 파트너 원탭 칩·첫 화면 밀도·5개 탭 정비를 확인합니다.
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v135.py
"""
import time

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
    page.on('requestfailed', lambda r: fails.append(r.url[:120]) if BASE.split('/')[2] in r.url else None)

    # ── 배포본 확인 (Pages 빌드 대기)
    sw = ''
    for i in range(40):
        sw = page.request.get(BASE + 'sw.js?cachebust=' + str(i)).text()
        if 'bm-v1.35.0' in sw:
            break
        time.sleep(6)
    check('라이브 sw.js = bm-v1.35.0', 'bm-v1.35.0' in sw, sw[-60:])
    app = page.request.get(BASE + 'app.js?x=1').text()
    logjs = page.request.get(BASE + 'js/views/log.js?x=1').text()
    mjs = page.request.get(BASE + 'js/views/matching.js?x=1').text()
    comjs = page.request.get(BASE + 'js/views/community.js?x=1').text()
    css = page.request.get(BASE + 'styles.css?x=1').text()
    index = page.request.get(BASE + 'index.html?x=1').text()
    check('라이브 app.js = v1.35.0', "version: 'v1.35.0'" in app)
    check('라이브 log.js = 최근 파트너 칩', all(k in logjs for k in ('recentPartnerNames', 'data-ptn-chip', 'ask__meta')))
    check('라이브 matching.js = 되풀이 안내 정리', 'matchintro__d' not in mjs)
    check('라이브 community.js = 분류 이름표', 'topicpick__lab' in comjs)
    check('라이브 styles.css = 새 클래스', all(k in css for k in ('.ptnchip', '.ask__meta', 'word-break: keep-all', '.topicpick-line')))
    check('라이브 index.html = styles.css?v=20261121-35', 'styles.css?v=20261121-35' in index)

    # ── 앱 열기 (체험 모드)
    page.goto(BASE + '?live=135', wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)
    check('앱 버전 노출', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.35.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    # ── 이번 주 일지 3건 (파트너 이름 포함) — 앱 저장 동작 그대로
    saved = []
    plan = [('2026-11-19', '민호', '21', '18', ['풋워크']),
            ('2026-11-20', '민수', '21', '19', ['스매시']),
            ('2026-11-21', '민호', '21', '15', ['스매시'])]
    for day, partner, a, bb, weak in plan:
        saved.append(page.evaluate("""([d, p, a, b, w]) => {
            const st = BM.app.ctx.store;
            st.actions.setDraft({ date: d, cond: 6, intensity: 6, minutes: 70, done: ['게임'],
              weakness: w, games: [{ a: a, b: b }], partner: p, gameMode: 21 });
            return st.actions.saveLog().ok;
        }""", [day, partner, a, bb, weak]))
        page.wait_for_timeout(1500)
    check('일지 3건 저장 (파트너 민호·민수)', saved and all(saved), saved)

    # 저장 뒤 화면을 새로 그립니다 (이미 열려 있는 탭을 다시 누르면 다시 그리지 않습니다)
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    for _ in range(3):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]')
            page.wait_for_timeout(400)

    def shot(name, sel=None):
        path = OUT + '/' + name
        if sel:
            page.locator(sel).first.screenshot(path=path)
        else:
            page.screenshot(path=path)
        print('     saved', path)

    # ── 1) 일지 & AI 첫 화면 (루틴 선택 카드 = 압축본)
    page.click('[data-tab="log"]')
    page.wait_for_timeout(1200)
    page.evaluate('window.scrollTo(0,0)')
    page.wait_for_timeout(400)
    first = page.evaluate("""() => {
        const r = (sel) => { const el = document.querySelector(sel); if (!el) return null;
          const b = el.getBoundingClientRect(); return {top: Math.round(b.top + scrollY), h: Math.round(b.height)}; };
        return {ask: r('.card--rtn-ask'), formHead: r('[data-form="log"] .card__head'),
                form: r('[data-form="log"]'), ptn: r('.card--ptn'), body: document.body.scrollHeight,
                meta: !!document.querySelector('.ask__meta'), stats: !!document.querySelector('.ask__stats')};
    }""")
    check('루틴 선택 카드는 압축판 (지표 상자 없이 메타 칩)', first['meta'] and not first['stats'], first)
    check('루틴 선택 카드 높이 ≤ 260px', first['ask'] and first['ask']['h'] <= 260, first)
    check('오늘 일지 카드가 첫 화면 아래쪽에 시작 (≤ 860px)', first['formHead'] and first['formHead']['top'] <= 860, first)
    check('파트너 승률 카드는 입력 아래', first['formHead'] and first['ptn'] and first['ptn']['top'] > first['formHead']['top'], first)
    shot('배드민턴_일지첫화면_밀도_bm-v1.35.0.png')

    # ── 2) 최근 파트너 원탭 칩
    page.evaluate("document.querySelector('[data-fold=\"games\"]').open = true")
    page.wait_for_timeout(400)
    page.evaluate("document.querySelector('[data-ptnchips]')?.scrollIntoView({block:'center'})")
    page.wait_for_timeout(500)
    chips = page.evaluate("""() => [...document.querySelectorAll('[data-ptn-chip]')].map(b => ({
        n: b.getAttribute('data-ptn-chip'), pressed: b.getAttribute('aria-pressed'),
        h: Math.round(b.getBoundingClientRect().height)}))""")
    check('최근 파트너 칩이 보인다 (민호·민수)', [c['n'] for c in chips][:2] == ['민호', '민수'], chips)
    check('칩 높이 34px (누르기 좋게)', chips and all(c['h'] >= 34 for c in chips), chips)
    shot('배드민턴_최근파트너칩_bm-v1.35.0_일지.png')
    page.locator('[data-ptnchips]').screenshot(path=OUT + '/배드민턴_최근파트너칩_bm-v1.35.0_확대.png')
    print('     saved', OUT + '/배드민턴_최근파트너칩_bm-v1.35.0_확대.png')

    if page.query_selector('[data-ptn-chip]'):
        page.click('[data-ptn-chip]')
        page.wait_for_timeout(500)
        val = page.evaluate("document.querySelector('[data-field=\"partner\"]').value")
        draft = page.evaluate('BM.app.ctx.store.state.drafts.log.partner')
        pressed = page.evaluate("[...document.querySelectorAll('[data-ptn-chip]')].map(b => b.getAttribute('aria-pressed'))")
        check('칩 한 번 = 입력칸에 이름', val == '민호' and draft == '민호', [val, draft])
        check('누른 칩만 켜짐 표시', pressed[0] == 'true' and pressed[1] == 'false', pressed)
        shot('배드민턴_최근파트너칩_한탭_bm-v1.35.0.png')
        page.click('[data-ptn-chip]')
        page.wait_for_timeout(400)
        val2 = page.evaluate("document.querySelector('[data-field=\"partner\"]').value")
        check('같은 칩 다시 = 지움', val2 == '', repr(val2))

    # ── 3) 5개 탭 가로 넘침·터치 영역·콘솔 오류
    widths, small = {}, {}
    for tab in ('log', 'matching', 'community', 'coach', 'my'):
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(700)
        widths[tab] = page.evaluate('document.documentElement.scrollWidth')
        small[tab] = page.evaluate("""() => {
            const h = document.querySelector('.hdr__chat'), s = document.querySelector('.heartchip');
            return [h ? Math.round(h.getBoundingClientRect().height) : 0, s ? Math.round(s.getBoundingClientRect().height) : 0];
        }""")
        if tab == 'coach':
            shot('배드민턴_코치줄바꿈_bm-v1.35.0.png')
        if tab == 'community':
            shot('배드민턴_커뮤니티분류_bm-v1.35.0.png')
    check('가로 넘침 없음(390px)', all(w <= 390 for w in widths.values()), widths)
    check('상단 채팅 38px · 하트 34px', all(v[0] >= 38 and v[1] >= 34 for v in small.values()), small)

    # ── 4) 루틴 표시를 고른 사용자 — 첫 화면에 입력 폼이 들어온다
    page.evaluate("BM.app.ctx.store.actions.setRoutinePref(false)")
    page.wait_for_timeout(900)
    page.click('[data-tab="log"]')
    page.wait_for_timeout(900)
    page.evaluate('window.scrollTo(0,0)')
    page.wait_for_timeout(400)
    steady = page.evaluate("""() => {
        const el = document.querySelector('[data-form="log"] .card__head');
        const b = el.getBoundingClientRect();
        return {top: Math.round(b.top + scrollY), ask: !!document.querySelector('.card--rtn-ask')};
    }""")
    check('루틴을 고른 뒤에는 선택 카드가 없다', not steady['ask'], steady)
    check('오늘 일지 입력이 첫 화면 안 (≤ 844)', steady['top'] <= 844, steady)
    shot('배드민턴_일지첫화면_입력_bm-v1.35.0.png')

    b.close()

print('\n콘솔·페이지 오류', len(errs), errs[:6])
print('실패한 요청', len(fails), fails[:6])
check('콘솔·페이지 오류 0건', len(errs) == 0, errs[:3])
check('실패한 요청 0건', len(fails) == 0, fails[:3])
passed = sum(1 for _, okv in checks if okv)
print('\n점검 %d/%d 통과' % (passed, len(checks)))
raise SystemExit(0 if passed == len(checks) else 1)
