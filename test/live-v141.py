"""bm-v1.41.0 라이브 확인 (390×844) — 주간 / 월간 상세 리포트.

· 체험 모드(둘러보기)로 이 기기 저장(local)에만 쓰고, Supabase·구글 요청은 막습니다.
  (실제 계정을 만들지 않습니다)
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v141.py
"""

import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, fails = [], [], []


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
            page.wait_for_timeout(220)


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

    def _failed(r):
        why = (r.failure or '')
        if 'ERR_ABORTED' in why or 'ERR_FAILED' in why:
            return
        fails.append(r.url[:120] + ' :: ' + why[:60])
    page.on('requestfailed', _failed)

    cb = str(int(time.time()))
    # ── 0) 배포 파일 버전
    sw = page.request.get(BASE + 'sw.js?cb=' + cb).text()
    app = page.request.get(BASE + 'app.js?cb=' + cb).text()
    twa = page.request.get(BASE + 'twa-manifest.json?cb=' + cb).text()
    rep = page.request.get(BASE + 'js/report.js?cb=' + cb).text()
    css = page.request.get(BASE + 'styles.css?cb=' + cb).text()
    idx = page.request.get(BASE + 'index.html?cb=' + cb).text()
    check('라이브 sw.js bm-v1.41.0', "var VERSION = 'bm-v1.41.0'" in sw)
    check('라이브 app.js v1.41.0', "version: 'v1.41.0'" in app)
    check('라이브 TWA 1.41.0 · 코드 38', '"appVersionName": "1.41.0"' in twa and '"appVersionCode": 38' in twa)
    check('라이브 js/report.js 배포', 'BM.report' in rep and 'CLOSE_MARGIN' in rep and 'rpt__next' in rep)
    check('라이브 styles.css 리포트', '.rptbtn' in css and '.rpt__bar' in css and '.rpt__warn' in css)
    check('라이브 index.html 스타일 캐시 -53', 'styles.css?v=20261121-53' in idx and 'js/report.js' in idx)
    check('gh-pages에 test/·ideas.md 없음',
          page.request.get(BASE + 'test/run.js?cb=' + cb).status == 404
          and page.request.get(BASE + 'ideas.md?cb=' + cb).status == 404)

    # ── 1) 체험 모드로 앱 실행
    page.goto(BASE + 'index.html?chk=' + cb, wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    check('앱 버전 v1.41.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.41.0',
          page.evaluate('window.BM && window.BM.app && window.BM.app.version'))
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    close_sheets(page)
    check('js/report.js 로드', page.evaluate('!!(window.BM && window.BM.report)'))

    # ── 2) 기록이 0건일 때 빈 상태
    btn = page.query_selector('[data-act="open-report"]')
    check('일지 & AI에 리포트 입구', btn is not None and btn.is_visible())
    btn.click()
    page.wait_for_timeout(700)
    empty = page.query_selector('[data-rpt-empty]')
    check('빈 상태 안내', empty is not None and '일지를 1건 이상 남기면 리포트가 채워져요' in empty.inner_text())
    page.screenshot(path=OUT + '/v141_01_empty.png')
    page.click('#reportPanel .bgp__head [data-rpt-close="1"]')
    page.wait_for_timeout(500)

    # ── 3) 기록 넣고 주간 리포트
    page.evaluate("""() => {
      const D = window.BM.domain, U = window.BM.util;
      const today = new Date();
      const day = (n) => U.ymd(U.addDays(today, n));
      const rows = [];
      const rec = (o) => rows.push(D.toRow({
        id: 'live-r' + rows.length, type: '기록', createdAt: o.date + ' 19:00:00', date: o.date,
        nick: '나래', minutes: o.minutes, done: ['스트록'], games: (o.games || []).map(g => ({ a: g[0], b: g[1] })),
        weakness: o.weakness || [], pain: o.pain || [], userKey: 'demo_me'
      }));
      rec({ date: day(0), minutes: 60, games: [[21,18],[18,21],[21,19]], weakness: ['드라이브','풋워크'], pain: ['무릎'] });
      rec({ date: day(-2), minutes: 90, games: [[21,12]], weakness: ['드라이브'], pain: ['무릎'] });
      rec({ date: day(-5), minutes: 30, games: [[17,21]], weakness: ['드라이브','헤어핀'] });
      rec({ date: day(-8), minutes: 45, games: [[21,18]], weakness: ['헤어핀'], pain: ['어깨'] });
      rec({ date: day(-10), minutes: 60, games: [[15,21]] });
      localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    close_sheets(page)

    # 일지 & AI 입구 위치(캡처)
    page.evaluate("""() => {
      const b = document.querySelector('[data-act="open-report"]');
      if (b) b.scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(500)
    page.screenshot(path=OUT + '/v141_00_entry_log.png')

    page.click('[data-act="open-report"]')
    page.wait_for_timeout(900)
    body = page.query_selector('[data-rpt-body]')
    txt = body.inner_text() if body else ''
    check('주간 모드', body.get_attribute('data-rpt-mode') == 'week', body.get_attribute('data-rpt-mode') if body else '')
    check('주간 기간 11월 15일~11월 21일', '11월 15일 ~ 11월 21일' in txt or '(7일)' in txt, txt[:120])
    check('이번 주 3회 · 180분', '3회' in txt and '180분' in txt, txt[:200])
    check('전체 승률 60% · 접전 67%', '60%' in txt and '67%' in txt and '접전 승률' in txt)
    check('지난주 대비 증감', '+10%p' in txt and '+75분' in txt)
    check('약점 TOP 3', all(w in txt for w in ['드라이브', '헤어핀', '풋워크']) and 'TOP 3' in txt, txt[:300])
    check('통증 반복 + 주의', '무릎' in txt and '주의' in txt and '2주 넘게' in txt)
    nlines = len(body.query_selector_all('.rpt__next li')) if body else 0
    check('다음 주 방향 2~3줄', nlines in (2, 3), nlines)
    check('주간 제목', '다음 주에 이렇게' in txt)
    page.screenshot(path=OUT + '/v141_02_week.png')
    page.evaluate("() => document.querySelector('#reportPanel .bgp__body').scrollTo(0, 9999)")
    page.wait_for_timeout(450)
    page.screenshot(path=OUT + '/v141_03_week_bottom.png')

    # ── 4) 월간 전환
    page.evaluate("() => document.querySelector('#reportPanel .bgp__body').scrollTo(0, 0)")
    page.click('[data-rpt-tab="month"]')
    page.wait_for_timeout(700)
    body = page.query_selector('[data-rpt-body]')
    mtxt = body.inner_text() if body else ''
    check('월간 모드', body.get_attribute('data-rpt-mode') == 'month')
    check('월간 기간 표기 · 다음 달', ('2026년 11월' in mtxt) and '다음 달에 이렇게' in mtxt, mtxt[:160])
    check('월간 통증 문구', '이번 달에' in mtxt)
    page.screenshot(path=OUT + '/v141_04_month.png')
    page.click('[data-rpt-tab="week"]')
    page.wait_for_timeout(400)
    check('주간으로 복귀', page.query_selector('[data-rpt-body]').get_attribute('data-rpt-mode') == 'week')

    # ── 5) 닫기 · MY 입구 · 뒤로 가기 · 가로 넘침
    page.click('#reportPanel .bgp__head [data-rpt-close="1"]')
    page.wait_for_timeout(500)
    check('닫기', page.query_selector('#reportPanel') is None)
    page.click('[data-tab="my"]')
    page.wait_for_timeout(1300)
    mybtn = page.query_selector('[data-act="open-report"]')
    check('MY에 리포트 입구', mybtn is not None and mybtn.is_visible())
    info = page.evaluate("() => ({w: document.documentElement.scrollWidth, over: document.documentElement.scrollWidth > innerWidth + 1})")
    check('MY 가로 넘침 없음', not info['over'], info['w'])
    page.evaluate("() => { const b = document.querySelector('[data-act=\"open-report\"]'); if (b) b.scrollIntoView({block:'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v141_05_my_entry.png')
    mybtn.click()
    page.wait_for_timeout(800)
    rinfo = page.evaluate("() => ({w: document.documentElement.scrollWidth, over: document.documentElement.scrollWidth > innerWidth + 1})")
    check('리포트 가로 넘침 없음', not rinfo['over'], rinfo['w'])
    page.go_back()
    page.wait_for_timeout(700)
    check('뒤로 가기로 닫힘', page.query_selector('#reportPanel') is None)

    # ── 6) 5개 탭 오류 0
    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(900)
        info = page.evaluate("() => document.documentElement.scrollWidth > innerWidth + 1")
        check('%s 탭: 오류 0' % label, len(errs) == before, errs[before:before + 2])
        check('%s 탭: 가로 넘침 없음' % label, not info)

    print('\n== 콘솔·페이지 오류 ==', len(errs))
    for e in errs[:12]:
        print(' ', e)
    print('요청 실패', fails[:6])
    okn = sum(1 for _, c in checks if c)
    print('\n%d/%d 통과' % (okn, len(checks)))
    for label, c in checks:
        if not c:
            print('FAILED:', label)
    b.close()
