"""bm-v1.42.0 로컬 확인 — 체육관 지도 · 자주 가는 체육관 · 내 위치 가까운 순 (390×844).

· 로컬 정적 서버(포트 8099)를 이 스크립트가 직접 띄우고 끝나면 내립니다.
· 이 기기 저장(체험)으로만 확인합니다.
· 실행:
  python3 test/local-v142.py
"""

import subprocess
import sys
import time
import os

from playwright.sync_api import sync_playwright

EXE = None
OUT = '/workspace/downloads'
PORT = 8099
BASE = 'http://127.0.0.1:%d/index.html' % PORT
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

checks, errs = [], []


def close_sheets(page, n=6):
    for _ in range(n):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1200)
            except Exception:
                pass
            page.wait_for_timeout(220)


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


def boot(page):
    """체험 모드로 첫 화면까지."""
    page.goto(BASE + '?l=1', wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    close_sheets(page)


srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'],
                       cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ── 1) 위치를 허용한 경우
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                            geolocation={'latitude': 37.5665, 'longitude': 126.9780},
                            permissions=['geolocation'])
        page = ctx.new_page()
        page.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
        boot(page)

        check('앱 버전 v1.42.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.42.0',
              page.evaluate('window.BM && window.BM.app && window.BM.app.version'))
        check('js/gyms.js 로드', page.evaluate('!!(window.BM && window.BM.gyms)'))
        check('체육관 13곳', page.evaluate('BM.gyms.count()') == 13, page.evaluate('BM.gyms.count()'))

        # ── 2) 매칭 > 찾기 맨 위 입구 카드
        page.click('[data-tab="matching"]')
        page.wait_for_timeout(1100)
        entry = page.query_selector('[data-act="open-gym-map"]')
        check('매칭 찾기에 체육관 지도 입구 카드', entry is not None and entry.is_visible())
        if entry:
            page.evaluate("() => document.querySelector('[data-act=\"open-gym-map\"]').scrollIntoView({block:'center'})")
            page.wait_for_timeout(300)
        page.screenshot(path=OUT + '/v142_00_entry_matching.png')
        entry.click()
        page.wait_for_timeout(1400)

        page_hdr = page.query_selector('.gympage__hdr')
        check('지도 화면 열림', page_hdr is not None and '체육관 지도' in page_hdr.inner_text())
        cards = page.query_selector_all('[data-gym-card]')
        pins = page.query_selector_all('.gympin')
        check('지도에 체육관 카드 13곳', len(cards) == 13, len(cards))
        check('지도 핀 13곳', len(pins) == 13, len(pins))
        leaf = page.evaluate("() => !!(window.L && document.querySelector('.leaflet-container'))")
        check('Leaflet 지도 컨테이너', leaf)
        info = page.evaluate("() => ({w: document.documentElement.scrollWidth, over: document.documentElement.scrollWidth > innerWidth + 1})")
        check('지도 화면 가로 넘침 없음', not info['over'], info['w'])
        page.screenshot(path=OUT + '/v142_01_map.png')

        # ── 3) 즐겨찾기 (별 → 칩 → 즐겨찾기만 보기)
        first_id = page.eval_on_selector('[data-gym-card]', 'el => el.getAttribute("data-gym-card")')
        page.click('[data-gym-fav="%s"]' % first_id)
        page.wait_for_timeout(500)
        chip = page.query_selector('[data-gym-jump="%s"]' % first_id)
        check('별을 누르면 자주 가는 체육관 칩', chip is not None)
        page.click('[data-gym-filter="fav"]')
        page.wait_for_timeout(600)
        fav_cards = page.query_selector_all('[data-gym-card]')
        check('즐겨찾기만 보기 → 1곳', len(fav_cards) == 1, len(fav_cards))
        page.screenshot(path=OUT + '/v142_02_fav.png')
        page.click('[data-gym-filter="all"]')
        page.wait_for_timeout(500)
        check('전체 보기 → 13곳', len(page.query_selector_all('[data-gym-card]')) == 13)

        # ── 4) 내 위치 기준 가까운 순
        page.click('[data-gym-geo]')
        page.wait_for_timeout(1800)
        dists = page.evaluate("""() => Array.from(document.querySelectorAll('[data-gym-card]')).map(el => {
            var d = el.querySelector('.gymcard__dist');
            return {id: el.getAttribute('data-gym-card'), txt: d ? d.innerText : ''};
        })""")
        has_dist = all(d['txt'] for d in dists)
        check('모든 카드에 약 X.X km', has_dist, dists[:3])
        nums = [float(d['txt'].replace('약', '').replace('km', '').strip()) for d in dists if d['txt']]
        check('거리 오름차순', nums == sorted(nums), nums[:5])
        geo_note = page.query_selector('[data-gymgeo]')
        check('내 위치 안내 문구', geo_note is not None and '내 위치' in geo_note.inner_text(), geo_note.inner_text()[:80] if geo_note else '')
        mydot = page.evaluate("() => !!document.querySelector('.gyme-wrap, .gyme')")
        check('지도에 내 위치 점', mydot)
        page.screenshot(path=OUT + '/v142_03_near.png')

        # ── 5) 새로고침해도 즐겨찾기 유지
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)
        close_sheets(page)
        page.click('[data-tab="matching"]')
        page.wait_for_timeout(1000)
        page.click('[data-act="open-gym-map"]')
        page.wait_for_timeout(1300)
        chip2 = page.query_selector('[data-gym-jump="%s"]' % first_id)
        check('새로고침 뒤에도 즐겨찾기 유지', chip2 is not None)
        check('입구 카드에 ★ 개수', page.evaluate("() => !!document.querySelector('.gymentry__n')"))

        # ── 6) 카드 '자세히' → 지도가 그 체육관으로
        page.click('[data-gym-view="%s"]' % first_id)
        page.wait_for_timeout(900)
        focus = page.query_selector('[data-gym-focuscard="%s"]' % first_id)
        check('체육관 자세히 → 요약 카드', focus is not None)
        page.screenshot(path=OUT + '/v142_04_focus.png')
        page.click('[data-gym-close]')
        page.wait_for_timeout(600)
        check('지도 닫기', page.query_selector('.gympage') is None)

        # ── 7) MY 프로필 꾸미기 → 주 체육관 '지도에서 고르기' → 저장 → 프로필 이름 → 지도
        page.click('[data-tab="my"]')
        page.wait_for_timeout(1300)
        page.click('[data-act="decorate-sheet"]')
        page.wait_for_timeout(1000)
        club_map = page.query_selector('[data-act="deco-club-map"]')
        check('프로필 주 체육관에 지도에서 고르기', club_map is not None)
        club_map.click()
        page.wait_for_timeout(1200)
        check('시트 위에 지도(체육관 고르기)', page.query_selector('.gympage__hdr') is not None and
              '체육관 고르기' in page.inner_text('.gympage__hdr'))
        pick_name = page.eval_on_selector('[data-gym-pick]', 'el => el.getAttribute("data-gym-pick")')
        page.click('[data-gym-pick="%s"]' % pick_name)
        page.wait_for_timeout(900)
        val = page.eval_on_selector('[data-dtext="club"]', 'el => el.value') if page.query_selector('[data-dtext="club"]') else ''
        check('고른 이름이 주 체육관 칸에', bool(val), val)
        page.screenshot(path=OUT + '/v142_05_profile_pick.png')
        page.click('[data-act="deco-save"]')
        page.wait_for_timeout(1200)
        close_sheets(page)
        page.wait_for_timeout(600)
        link = page.query_selector('[data-gym-open]')
        check('프로필 체육관 이름이 지도 링크', link is not None)
        if link:
            link.click()
            page.wait_for_timeout(1200)
            check('이름을 누르면 그 체육관 지도', page.query_selector('.gympage__hdr') is not None and
                  page.query_selector('[data-gym-focuscard]') is not None)
            page.click('[data-gym-close]')
            page.wait_for_timeout(600)

        # ── 8) 커뮤니티 게스트 모집 '어디 체육관' → 지도에서 고르기
        page.click('[data-tab="community"]')
        page.wait_for_timeout(1300)
        page.click('[data-topic="게스트 모집"]')
        page.wait_for_timeout(700)
        pick_btn = page.query_selector('[data-act="pick-gym"]')
        check('커뮤니티에 지도에서 고르기 버튼', pick_btn is not None)
        if pick_btn:
            pick_btn.click()
            page.wait_for_timeout(1200)
            page.click('[data-gym-pick="%s"]' % page.eval_on_selector('[data-gym-pick]', 'el => el.getAttribute("data-gym-pick")'))
            page.wait_for_timeout(900)
            ph = page.eval_on_selector('[data-vitefield="place"]', 'el => el.value') if page.query_selector('[data-vitefield="place"]') else ''
            check('고른 이름이 모집글 장소 칸에', bool(ph), ph)
        page.screenshot(path=OUT + '/v142_06_community.png')

        # ── 9) 5개 탭 오류 0 · 넘침
        for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
            before = len(errs)
            page.click('[data-tab="%s"]' % key)
            page.wait_for_timeout(900)
            check('%s 탭 오류 0' % label, len(errs) == before, errs[before:before + 2])
        ov = page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1")
        check('390 화면 가로 넘침 없음', not ov)
        ctx.close()

        # ── 10) 위치를 거부한 경우 — 목록은 그대로, 안내 한 줄만
        ctx2 = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                             is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                             permissions=[])
        p2 = ctx2.new_page()
        errs2 = []
        p2.on('console', lambda m: errs2.append('console: ' + m.text[:200]) if (m.type == 'error' and 'GSI_LOGGER' not in m.text and 'status of 403' not in m.text) else None)
        p2.on('pageerror', lambda e: errs2.append('pageerror: ' + str(e)[:300]))
        boot(p2)
        p2.click('[data-tab="matching"]')
        p2.wait_for_timeout(1000)
        p2.click('[data-act="open-gym-map"]')
        p2.wait_for_timeout(1200)
        p2.click('[data-gym-geo]')
        p2.wait_for_timeout(2500)
        n_after = len(p2.query_selector_all('[data-gym-card]'))
        check('위치 거부에도 목록 13곳 그대로', n_after == 13, n_after)
        p2.wait_for_timeout(600)
        note = p2.query_selector('.gymgeo__n')
        note_txt = note.inner_text().strip() if note else ''
        check('위치 거부 안내 한 줄', '허용' in note_txt, note_txt)
        check('위치 거부 앱 오류 0', len(errs2) == 0, errs2[:2])
        p2.screenshot(path=OUT + '/v142_07_denied.png')
        ctx2.close()
        b.close()
finally:
    srv.terminate()
    try:
        srv.wait(timeout=5)
    except Exception:
        srv.kill()

print('\n== 콘솔·페이지 오류 ==', len(errs))
for e in errs[:10]:
    print(' ', e)
okn = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (okn, len(checks)))
for label, c in checks:
    if not c:
        print('FAILED:', label)
