"""bm-v1.40.0 라이브 확인 (390×844) — 시작 4유형 선택 · 선수 7대 훈련 저장·최근 기록.

 · Supabase 등 바깥 요청은 막고(route abort) 이 기기 저장(local)으로만 확인합니다.
   (실제 계정을 만들지 않습니다)
 · 실행:
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v140.py
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

    # ── 0) 배포 파일 버전
    cb = str(int(time.time()))
    sw = page.request.get(BASE + 'sw.js?cb=' + cb).text()
    app = page.request.get(BASE + 'app.js?cb=' + cb).text()
    twa = page.request.get(BASE + 'twa-manifest.json?cb=' + cb).text()
    check('라이브 sw.js bm-v1.40.0', "var VERSION = 'bm-v1.40.0'" in sw, sw[-60:])
    check('라이브 app.js v1.40.0', "version: 'v1.40.0'" in app)
    check('라이브 TWA 1.40.0 · 코드 38', '"appVersionName": "1.40.0"' in twa and '"appVersionCode": 38' in twa)
    check('라이브 domain.js 4유형', 'ROLES' in page.request.get(BASE + 'js/domain.js?cb=' + cb).text()
          and "'상체 근력운동'" in page.request.get(BASE + 'js/domain.js?cb=' + cb).text())
    check('라이브 start.js 유형 카드', 'rolepicks' in page.request.get(BASE + 'js/views/start.js?cb=' + cb).text())
    check('라이브 log.js 7대 훈련', 'data-pro-toggle' in page.request.get(BASE + 'js/views/log.js?cb=' + cb).text())
    check('라이브 styles.css 유형 카드', '.rolepick' in page.request.get(BASE + 'styles.css?cb=' + cb).text())

    # ── 1) 앱 실행 (이 기기 저장 · 로그인 세션 흉내 → 온보딩 화면)
    page.goto(BASE + 'index.html?chk=' + cb, wait_until='load')
    page.evaluate("""() => { try {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email', email:'live140@example.com', name:'라이브선수', at:new Date().toISOString()}));
    } catch (e) {} }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('앱 버전 v1.40.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.40.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))

    roles = page.query_selector_all('[data-pick="role"]')
    check('온보딩 4유형 카드', len(roles) == 4, len(roles))
    page.screenshot(path=OUT + '/v140_01_onboarding.png', full_page=False)

    page.click('[data-pick="role"][data-val="player"]')
    page.wait_for_timeout(350)
    check('선수 카드 선택', 'is-on' in page.query_selector('[data-pick="role"][data-val="player"]').get_attribute('class'))
    page.screenshot(path=OUT + '/v140_02_onboarding_player.png', full_page=False)

    page.fill('#onbNick', '라이브선수')
    page.click('[data-pick="level"][data-val="선수부"]')
    page.click('[data-pick="discipline"][data-val="단식"]')
    page.wait_for_timeout(250)
    page.click('[data-act="finish"]')
    page.wait_for_timeout(2600)
    for _ in range(5):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            try:
                page.click('#sheet .sheet__head [data-close]', timeout=1500)
            except Exception:
                pass
            page.wait_for_timeout(250)
    check('일지 탭 진입', page.query_selector('[data-form="log"]') is not None)
    page.wait_for_timeout(600)
    check('일지에 7대 훈련 7줄', len(page.query_selector_all('[data-pro-toggle]')) == 7,
          len(page.query_selector_all('[data-pro-toggle]')))
    check('선수 화면에는 완료 훈련 칩 없음', page.query_selector('[data-chipgroup="done"]') is None)

    # ── 2) 체크 → 입력칸 열림 → 저장
    page.click('[data-pro-toggle="상체 근력운동"]')
    page.wait_for_timeout(350)
    note = page.query_selector('[data-pro="상체 근력운동"] [data-pro-note]')
    check('체크하면 입력칸이 열린다', note is not None and note.is_visible())
    check('입력칸에 커서', page.evaluate("() => (document.activeElement && document.activeElement.getAttribute('data-pro-name')) || ''") == '상체 근력운동')
    page.fill('[data-pro="상체 근력운동"] [data-pro-note]', '풀업 4세트, 벤치프레스 60kg')
    page.wait_for_timeout(250)
    page.click('[data-pro-toggle="풋워크"]')
    page.wait_for_timeout(300)
    page.fill('[data-pro="풋워크"] [data-pro-note]', '사이드 스텝 10분 × 3세트')
    page.wait_for_timeout(250)
    page.click('[data-pro-toggle="하체 근력운동"]')
    page.wait_for_timeout(250)
    page.fill('[data-pro="하체 근력운동"] [data-pro-note]', '스쿼트 80kg 5×5')
    page.wait_for_timeout(300)
    page.evaluate("""() => { const f = document.querySelector('[data-field="minutes"]');
      if (f) { f.value = '90'; f.dispatchEvent(new Event('input', {bubbles: true})); } }""")
    page.wait_for_timeout(350)
    page.screenshot(path=OUT + '/v140_03_pro_filled.png', full_page=False)

    page.click('[data-act="save-log"]')
    page.wait_for_timeout(1800)
    toast = page.evaluate("() => { const t = document.getElementById('toast'); return t ? t.textContent : ''; }")
    check('저장 안내', '일지를 저장했어요' in toast, toast)

    rec = page.evaluate("""() => {
      const s = window.BM.app.ctx.store.state;
      const rows = s.rows.filter(r => r[1] === '기록');
      const row = rows[0] || [];
      return {count: rows.length, cells: row.length,
              plan: row[window.BM.domain.COL['훈련계획']] || '',
              done: row[window.BM.domain.COL['완료훈련']] || ''};
    }""")
    check('저장 행 1건 · 26칸', rec['count'] == 1 and rec['cells'] == 26, rec)
    check('훈련계획 칸 pro JSON', '"pro"' in rec['plan'] and '풀업 4세트' in rec['plan'], rec['plan'][:140])
    check('완료훈련 칸 체크 3개', all(k in rec['done'] for k in ('상체 근력운동', '풋워크', '하체 근력운동')), rec['done'])

    page.wait_for_timeout(900)
    recent = page.evaluate("""() => {
      const el = document.querySelector('[data-region="recent"] .logrow .logrow__pro');
      return el ? el.innerText.replace(/\\s+/g, ' ').trim() : '';
    }""")
    check('최근 기록 7대 훈련 줄', '상체 근력운동' in recent or '풋워크' in recent, recent)
    page.evaluate("() => document.querySelector('[data-region=\"recent\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v140_04_recent.png', full_page=False)

    page.click('[data-region="recent"] .logrow')
    page.wait_for_timeout(900)
    sheet_text = page.evaluate("() => { const s = document.getElementById('sheet'); return s ? s.innerText.replace(/\\s+/g, ' ') : ''; }")
    check('상세 시트 7대 훈련', '선수 7대 훈련' in sheet_text and '풀업 4세트' in sheet_text, sheet_text[:160])
    page.screenshot(path=OUT + '/v140_05_detail.png', full_page=False)
    if page.query_selector('#sheet .sheet__head [data-close]'):
        page.click('#sheet .sheet__head [data-close]')
        page.wait_for_timeout(400)

    # ── 3) MY 내 유형
    page.click('[data-tab="my"]')
    page.wait_for_timeout(1100)
    check('MY 내 유형 카드', page.query_selector('[data-region="role"]') is not None)
    check('선수가 켜져 있음', 'is-on' in page.query_selector('[data-role="player"]').get_attribute('class'))
    page.evaluate("() => document.querySelector('[data-region=\"role\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v140_06_my_role.png', full_page=False)

    page.click('[data-role="club"]')
    page.wait_for_timeout(1100)
    check('동호인으로 변경 → 꾸미기 JSON', page.evaluate("() => (window.BM.app.ctx.store.state.me.theme || {}).role") == 'club',
          page.evaluate("() => (window.BM.app.ctx.store.state.me.theme || {}).role"))
    page.click('[data-tab="log"]')
    page.wait_for_timeout(1000)
    check('동호인은 7대 훈련 숨김', len(page.query_selector_all('[data-pro-toggle]')) == 0)
    check('동호인은 완료 훈련 칩', page.query_selector('[data-chipgroup="done"]') is not None)

    page.click('[data-tab="my"]')
    page.wait_for_timeout(800)
    page.click('[data-role="player"]')
    page.wait_for_timeout(1000)
    page.click('[data-tab="log"]')
    page.wait_for_timeout(1000)
    check('선수 복귀 시 7대 훈련 복귀', len(page.query_selector_all('[data-pro-toggle]')) == 7)

    # ── 4) 5개 탭 오류·가로 넘침
    for key, label in [('log', '일지&AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        before = len(errs)
        page.click('[data-tab="%s"]' % key)
        page.wait_for_timeout(900)
        info = page.evaluate("() => ({overflowX: document.documentElement.scrollWidth > innerWidth + 1, w: document.documentElement.scrollWidth})")
        check('%s 탭: 오류 0' % label, len(errs) == before, errs[before:before + 2])
        check('%s 탭: 가로 넘침 없음' % label, not info['overflowX'], info['w'])
        page.screenshot(path='%s/v140_tab_%s.png' % (OUT, key))

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
