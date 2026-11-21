"""bm-v1.40.1 로컬 확인 (390×844) — 게스트비 칸 · 모집 카드 표시 · 내 글 삭제(취소).

· 체험 모드(둘러보기)로 이 기기 저장(local)에만 쓰고, 바깥 서버(Supabase·구글) 요청은 막습니다.
· 실행:  python3 -m http.server 8423 (저장소 루트)  →  python3 test/local-v140-1.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8423/index.html'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


def close_sheets(page, n=6):
    for _ in range(n):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1200)
            except Exception:
                pass
            page.wait_for_timeout(200)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'gstatic' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    # ── 0) 체험 모드로 시작
    page.goto(BASE + '?v=1401', wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2500)
    check('앱 버전 v1.40.1', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.40.1',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    close_sheets(page)

    page.click('[data-tab="community"]')
    page.wait_for_timeout(1200)
    close_sheets(page)

    # ── 1) 게스트비 칸 + 빠른 칩
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(450)
    check('게스트비 입력칸이 열린다', page.query_selector('[data-vitefield="fee"]') is not None
          and page.query_selector('[data-vitefield="fee"]').is_visible())
    chips = page.query_selector_all('[data-vitefee-val]')
    check('빠른 칩 3개', len(chips) == 3, len(chips))
    page.fill('[data-vitefield="when"]', '11/22(토) 19:00')
    page.fill('[data-vitefield="cap"]', '6')
    page.fill('[data-vitefield="place"]', '올림픽체육관')
    page.click('[data-vitefee-val="1만원"]')
    page.wait_for_timeout(350)
    check('칩을 누르면 칸에 적힌다', page.evaluate("() => document.querySelector('[data-vitefield=\"fee\"]').value") == '1만원',
          page.evaluate("() => document.querySelector('[data-vitefield=\"fee\"]').value"))
    check('누른 칩이 켜진다', 'is-on' in (page.query_selector('[data-vitefee-val="1만원"]').get_attribute('class') or ''))
    page.fill('[data-composer]', '토요일 저녁 같이 쳐요! 게스트 한 분 모십니다')
    page.wait_for_timeout(300)
    page.evaluate("() => document.querySelector('[data-viteform]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v1401_01_fee_form.png')

    page.click('[data-act="post"]')
    page.wait_for_timeout(1400)
    card = page.query_selector('[data-region="posts"] .post')
    card_text = card.inner_text().replace('\n', ' ') if card else ''
    check('모집 카드에 게스트비 한 줄', '게스트비 1만원' in card_text, card_text[:160])
    check('카드에 동전 아이콘', card is not None and card.query_selector('.vite__fee-ic') is not None)
    row = page.evaluate("""() => {
      const s = window.BM.app.ctx.store.state;
      const rows = s.rows.filter(r => r[1] === '소셜');
      return { n: rows.length, plan: rows[0][window.BM.domain.COL['훈련계획']] || '', cells: rows[0].length };
    }""")
    check('26칸 그대로 · 훈련계획에 fee', row['n'] == 1 and row['cells'] == 26 and '"fee":"1만원"' in row['plan'], row['plan'][:160])
    page.evaluate("() => document.querySelector('[data-region=\"posts\"]').scrollIntoView({block: 'start'})")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v1401_02_fee_card.png')

    # ── 2) 내 글 삭제 — 확인 줄 → 취소 → 다시 → 삭제
    check('내 글에 삭제 버튼', page.query_selector('[data-post-del]') is not None)
    page.click('[data-post-del]')
    page.wait_for_timeout(450)
    bar = page.query_selector('[data-delbar]')
    check('확인 줄이 열린다', bar is not None and bar.is_visible())
    check('확인 문구', '이 글을 삭제할까요?' in (bar.inner_text() if bar else ''))
    page.screenshot(path=OUT + '/v1401_03_del_confirm.png')

    page.click('[data-act="post-del-no"]')
    page.wait_for_timeout(400)
    bar = page.query_selector('[data-delbar]')
    check('취소하면 접힌다', bar is not None and not bar.is_visible())
    check('취소해도 글은 그대로', page.query_selector('[data-region="posts"] .post') is not None)

    page.click('[data-post-del]')
    page.wait_for_timeout(350)
    page.click('[data-act="post-del-yes"]')
    page.wait_for_timeout(1200)
    check('삭제하면 목록에서 사라진다', page.query_selector('[data-region="posts"] .post') is None)
    toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    check('삭제 안내', '글을 삭제했어요' in toast, toast)
    left = page.evaluate("""() => {
      const s = window.BM.app.ctx.store.state;
      return s.rows.filter(r => r[1] === '소셜').length;
    }""")
    check('저장된 글도 0건', left == 0, left)
    page.screenshot(path=OUT + '/v1401_04_after_delete.png')

    # ── 3) 남의 글 — 게스트비는 보이고 삭제 버튼은 없다
    page.evaluate("""() => {
      const rows = JSON.parse(localStorage.getItem('bm_rows_v1') || '[]');
      rows.push(window.BM.domain.toRow({
        id: 'p-other-test', type: '소셜', createdAt: '2026-11-21 18:20:00', date: '2026-11-21',
        nick: '코트지기', userKey: 'u_other', text: '일요일 오전 게스트 한 분!',
        plan: { topic: '게스트 모집', meet: { when: '11/23(일) 09:00', place: '한빛체육관', cap: '4', fee: '5천원' } }
      }));
      localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    close_sheets(page)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(1300)
    card = page.query_selector('[data-region="posts"] .post')
    other_text = card.inner_text().replace('\n', ' ') if card else ''
    check("남의 글에도 게스트비 표시", '게스트비 5천원' in other_text, other_text[:160])
    check('남의 글에는 삭제 버튼 없음', page.query_selector('[data-post-del]') is None)
    page.screenshot(path=OUT + '/v1401_05_other_post.png')

    # ── 4) 5개 탭 오류·가로 넘침
    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(900)
        info = page.evaluate("() => ({overflowX: document.documentElement.scrollWidth > innerWidth + 1, w: document.documentElement.scrollWidth})")
        check('%s 탭: 오류 0' % label, len(errs) == before, errs[before:before + 2])
        check('%s 탭: 가로 넘침 없음' % label, not info['overflowX'], info['w'])

    print('\n== 콘솔·페이지 오류 ==', len(errs))
    for e in errs[:12]:
        print(' ', e)
    okn = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과' % (okn, len(checks)))
    for label, c in checks:
        if not c:
            print('FAILED:', label)
    b.close()
