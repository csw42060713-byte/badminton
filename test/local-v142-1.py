"""bm-v1.42.1 이 기기 저장(local) 점검 — 보안 헤더(CSP) · 게스트 모집 입구 · 5개 탭.

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다. Supabase·구글 요청은 막습니다.
· 실행:
  (저장소 루트에서) python3 -m http.server 8811 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-v141-1.py
"""

import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8811/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    page.on('console', lambda m: (errs.append(m.text[:300]) if m.type == 'error' else None,
                                  csp.append(m.text[:300]) if 'Content Security Policy' in m.text else None))
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    cb = str(int(time.time()))
    page.goto(BASE + 'index.html?chk=' + cb, wait_until='load')
    page.wait_for_timeout(900)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2200)
    check('앱 버전 v1.42.1', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.42.1',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    check('시작화면 구글 버튼', bool(page.query_selector('[data-act="google"]')))
    check('시작화면 둘러보기 버튼', bool(page.query_selector('[data-act="guest"]')))
    page.click('[data-act="guest"]')
    page.wait_for_timeout(900)
    for sel in ['#sheet [data-close]', '#sheet .btn']:
        if page.query_selector(sel):
            page.click(sel, timeout=2000); page.wait_for_timeout(300); break
    check('체험 모드 진입', page.evaluate("() => !!(window.BM.app.ctx && window.BM.app.ctx.store.state.ready)"))

    # ── 5개 탭
    for tab, name in [('log', '일지 & AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(600)
        overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check('%s 탭: 가로 넘침 없음' % name, overflow <= 0, overflow)

    # ── 게스트 모집: 말머리만 고르고 모집 칸을 비운 글
    page.click('[data-tab="community"]'); page.wait_for_timeout(600)
    page.click('[data-topic="게스트 모집"]'); page.wait_for_timeout(350)
    check('모집 입력칸 보임', page.evaluate("() => { const f=document.querySelector('[data-viteform]'); return f ? !f.hidden : false; }"))
    page.fill('[data-composer]', '말머리만 골랐어요')
    page.click('[data-act="post"]'); page.wait_for_timeout(900)
    check('모집 칸 비운 글에도 모집 카드', page.evaluate("() => document.querySelectorAll('.vite').length") >= 1)
    check('모집 칸 비운 글에도 참여 버튼', bool(page.query_selector('[data-vite-group]')))
    page.screenshot(path=OUT + '/v1421_01_nomeet_card.png')
    page.click('[data-vite-group]'); page.wait_for_timeout(900)
    check('그 글로 단체방 열림', page.evaluate("() => { const s=window.BM.app.ctx.store.state.ui; return !!(s.chatOpen && s.chatRoom); }"))
    check('단체방 제목', page.evaluate("() => { const d=document.querySelector('#dm'); return d ? d.innerText.indexOf('게스트 모집 단체방') >= 0 : false; }"))
    page.screenshot(path=OUT + '/v1421_02_nomeet_room.png')
    page.evaluate("() => window.BM.app.ctx.store.actions.closeChats()")
    page.wait_for_timeout(500)

    # ── 모집 정보를 채운 글도 그대로
    page.click('[data-topic="게스트 모집"]'); page.wait_for_timeout(300)
    page.fill('[data-vitefield="when"]', '11/22(토) 19:00')
    page.fill('[data-vitefield="place"]', '영통 체육관')
    page.fill('[data-vitefield="cap"]', '4')
    page.click('[data-vitefee-val="5천원"]'); page.wait_for_timeout(200)
    page.click('[data-act="post"]'); page.wait_for_timeout(900)
    body = page.evaluate("() => document.querySelector('[data-region=\"posts\"]').innerText")
    check('모집 정보 카드(일시·장소·게스트비)', ('영통 체육관' in body) and ('게스트비 5천원' in body) and ('11/22' in body))
    page.screenshot(path=OUT + '/v1421_03_meet_card.png')

    # ── 주요 시트 열어 보기
    page.click('[data-tab="my"]'); page.wait_for_timeout(700)
    sheets = ['[data-act="hearts"]', '[data-act="theme"]', '[data-act="help"]']
    for sel in sheets:
        el = page.query_selector(sel)
        if el and el.is_visible():
            page.click(sel); page.wait_for_timeout(500)
            page.screenshot(path=OUT + '/v1421_sheet_' + sel.split('"')[1] + '.png')
            if page.query_selector('#sheet [data-close]'):
                page.click('#sheet [data-close]'); page.wait_for_timeout(350)

    # ── CSP가 실제로 걸려 있는지(정책 위반 보고 0건) · 인라인 스크립트가 살아 있는지
    check('CSP 인라인 스크립트 실행(테마)', page.evaluate("() => !!document.documentElement.getAttribute('data-theme')"))
    check('CSP 위반 0건', len(csp) == 0, csp[:3])
    check('앱 오류 0건', len([e for e in errs if 'ERR_' not in e]) == 0, [e for e in errs if 'ERR_' not in e][:3])

    ok_all = all(c for _, c in checks)
    print('\n%d/%d 통과' % (sum(1 for _, c in checks if c), len(checks)))
    b.close()
