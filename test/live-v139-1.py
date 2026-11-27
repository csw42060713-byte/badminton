"""bm-v1.39.1 라이브 확인 (390×844) — 게스트 모집 본문 없이 모집 칸만 채워 올리기.

LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu \
python3 test/live-v139-1.py
"""
import re
import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, fails = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:500]) if extra else ''))
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    def _failed(r):
        why = (r.failure or '')
        if 'ERR_ABORTED' in why:
            return
        fails.append(r.url[:120] + ' :: ' + why[:60])
    page.on('requestfailed', _failed)

    # 배포 파일 버전
    cb = str(int(time.time()))
    sw = page.request.get(BASE + 'sw.js?cb=' + cb).text()
    app = page.request.get(BASE + 'app.js?cb=' + cb).text()
    twa = page.request.get(BASE + 'twa-manifest.json?cb=' + cb).text()
    check('라이브 sw.js 캐시 버전 bm-v1.39.1', "var VERSION = 'bm-v1.39.1'" in sw, sw[-80:])
    check('라이브 app.js 버전 v1.39.1', "version: 'v1.39.1'" in app)
    check('라이브 TWA 1.39.1 · 코드 38', '"appVersionName": "1.39.1"' in twa and '"appVersionCode": 38' in twa)
    check('라이브 community.js 새 로직', '비워 두어도 올라가요' in page.request.get(BASE + 'js/views/community.js?cb=' + cb).text())
    check('라이브 store.js 새 로직', 'var hasMeet = D.meetFilled(mv);' in page.request.get(BASE + 'js/store.js?cb=' + cb).text())

    # 앱 실행 (체험 모드)
    page.goto(BASE + 'index.html?chk=' + cb, wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2500)
    for _ in range(6):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=2000)
            except Exception:
                pass
            page.wait_for_timeout(250)
    check('앱 버전 v1.39.1', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.39.1',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    def tab(key):
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(900)

    tab('community')
    err0 = len(errs)
    page.screenshot(path=OUT + '/v1391_01_community.png')

    # ── 시나리오 A: 본문 비우고 모집 칸만 채워 올리기
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(500)
    ph = page.get_attribute('[data-composer]', 'placeholder')
    check('게스트 모집을 고르면 입력칸 안내가 바뀐다', ph == '게스트 모집 한마디 (비워 두어도 올라가요)', ph)
    page.screenshot(path=OUT + '/v1391_02_meet_picked.png')

    page.fill('[data-vitefield="when"]', '11/21(금) 19:00')
    page.fill('[data-vitefield="cap"]', '6')
    page.fill('[data-vitefield="place"]', '올림픽체육관')
    body = page.input_value('[data-composer]')
    check('본문 입력칸은 비어 있음', body.strip() == '', repr(body))

    posts_before = page.evaluate("() => document.querySelectorAll('[data-region=\"posts\"] article.post').length")
    page.click('[data-act="post"]')
    page.wait_for_timeout(900)
    toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    check('올리기 성공 안내', toast == '게스트 모집을 올렸어요', toast)
    check('빈 칸 안내가 뜨지 않음', '내용을 입력해 주세요' not in toast, toast)
    posts_after = page.evaluate("() => document.querySelectorAll('[data-region=\"posts\"] article.post').length")
    check('글이 목록에 올라감', posts_after == posts_before + 1, (posts_before, posts_after))

    first = page.evaluate("""() => {
      const el = document.querySelector('[data-region="posts"] article.post');
      if (!el) return null;
      const info = el.querySelector('.vite__info');
      return {
        hasText: !!el.querySelector('.post__text'),
        textLen: (el.querySelector('.post__text') || {}).textContent || '',
        info: info ? info.innerText.replace(/\\s+/g, ' ').trim() : '',
        topic: (el.querySelector('.post__topic') || {}).textContent || '',
        body: el.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200)
      };
    }""")
    check('빈 본문 문단을 그리지 않음', first and not first['hasText'], first)
    check('모집 카드에 언제·장소·인원', first and all(k in first['info'] for k in ('11/21(금) 19:00', '올림픽체육관', '6명')), first and first['info'])
    check('말머리 게스트 모집', first and first['topic'] == '게스트 모집', first and first['topic'])
    page.screenshot(path=OUT + '/v1391_03_posted.png', full_page=False)

    rows = page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1') || '[]')")
    social = [r for r in rows if r[1] == '소셜']
    check('저장 행 1건 · 26칸', len(social) == 1 and len(social[0]) == 26, (len(social), len(social[0]) if social else 0))
    if social:
        check('본문 칸 비어 있음', str(social[0][21] if False else social[0][21]) is not None)
        plan = social[0][6] if len(social[0]) > 6 else ''
    # 훈련계획(plan) 칸 확인: domain.COLS 기준 인덱스
    plan_idx = page.evaluate("() => window.BM.domain.COL['훈련계획']")
    text_idx = page.evaluate("() => window.BM.domain.COL['소셜글']")
    if social:
        plan = social[0][plan_idx]
        check('훈련계획 칸에 게스트 모집 JSON', '게스트 모집' in plan and '"meet"' in plan, plan[:120])
        check('소셜글 칸은 빈 값', str(social[0][text_idx]).strip() == '', repr(social[0][text_idx])[:40])

    # ── 시나리오 B: 본문·모집 칸 둘 다 비면 거부 (연타 잠금 지난 뒤)
    page.wait_for_timeout(1400)
    page.click('[data-act="post"]')
    page.wait_for_timeout(600)
    toast_b = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    check('둘 다 비면 내용 안내', toast_b == '내용을 입력해 주세요', toast_b)
    rows2 = page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1') || '[]').filter(r => r[1] === '소셜').length")
    check('둘 다 비면 저장 안 됨', rows2 == 1, rows2)

    # ── 시나리오 C: 게스트 모집을 풀면 안내가 원래대로
    page.click('[data-topic="자유"]')
    page.wait_for_timeout(400)
    ph2 = page.get_attribute('[data-composer]', 'placeholder')
    check('자유로 돌아오면 원래 안내', ph2 == '오늘 경기 어땠어요? 한 줄 남겨보세요', ph2)

    # ── 회귀: 5개 탭 오류·가로 넘침
    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        tab(key)
        info = page.evaluate("""() => ({
          overflowX: document.documentElement.scrollWidth > innerWidth + 1,
          w: document.documentElement.scrollWidth
        })""")
        check('%s 탭: 오류 0' % label, len(errs) == before, errs[before:before + 2])
        check('%s 탭: 가로 넘침 없음' % label, not info['overflowX'], info['w'])
        page.screenshot(path='%s/v1391_tab_%s.png' % (OUT, key))

    page.click('[data-tab="community"]')
    page.wait_for_timeout(800)
    page.screenshot(path=OUT + '/v1391_04_community_final.png', full_page=True)

    print('\n== 콘솔·페이지 오류 ==', len(errs))
    for e in errs[:20]:
        print(' ', e)
    print('요청 실패', fails[:10])

    okn = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과' % (okn, len(checks)))
    for label, c in checks:
        if not c:
            print('FAILED:', label)
    b.close()
