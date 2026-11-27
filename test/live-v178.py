"""bm-v1.78.0 라이브 점검 (390×844) — 🦶 스플릿 스텝 → 전위 런지 · 발목 비틀림 보호

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 화면을 봅니다)
  A) 라이브 파일 — sw.js bm-v1.78.0 · app.js v1.78.0 · styles.css?v=20261125-7 · TWA 1.78.0/72
  B) 라이브 앱 — 버전 · 5개 탭
  C) 풋워크 약점 일지 → 추천 드릴 '스플릿 스텝 → 전위 런지'
  D) 관절 보호 접기 → '무릎·발목 보호 체크' 새 기준 1줄 · 새 확인 1개 · 참고 논문 Wang 2024
  E) 발목 통증 일지에서도 같은 항목
  F) 앱 오류 0 · CSP 위반 0 · 가로 넘침 0(390·360)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v178.py
"""

import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V178_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V178_SHOTS', '/workspace/check-shots')

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def remote(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return r.read().decode('utf-8')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
        elif 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            pass
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def shot(name, keep=False):
        path = SHOTS + '/v178_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/' + keep)
        return path

    def tap(sel, wait=500):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    # ── A. 라이브 파일 ──
    sw = remote('sw.js')
    app_js = remote('app.js')
    index = remote('index.html')
    twa = remote('twa-manifest.json')
    ai = remote('js/ai.js')
    check('A 라이브 sw.js bm-v1.78.0', "var VERSION = 'bm-v1.78.0'" in sw)
    check('A 라이브 app.js v1.78.0', "version: 'v1.78.0'" in app_js)
    check('A 라이브 styles.css?v=20261125-7', 'styles.css?v=20261125-7' in index)
    check('A 라이브 TWA 1.78.0 · 72',
          '"appVersionName": "1.78.0"' in twa and '"appVersionCode": 72' in twa)
    check('A packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)
    check('A 라이브 js/ai.js 에 Wang DOI', '10.3390/bioengineering11050501' in ai)
    check('A 라이브 js/ai.js 에 새 드릴', '스플릿 스텝 → 전위 런지' in ai)

    # ── B. 라이브 앱 ──
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1500)
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live178@example.com', name: '승우',
                    at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                    profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('B 라이브 앱 버전', page.evaluate("() => BM.app.version") == 'v1.78.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('B 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    def save_log(weak, pain):
        tap("#tabbar [data-tab='log']", 800)
        page.fill('[data-field="minutes"]', '60')
        page.evaluate("""(a) => {
          const st = BM.app.ctx.store.state;
          st.drafts.log.cond = 6;
          st.drafts.log.intensity = 5;
          st.drafts.log.weakness = a.weak;
          st.drafts.log.pain = a.pain;
        }""", {'weak': weak, 'pain': pain})
        tap('[data-act="save-log"]', 1800)

    # ── C. 풋워크 약점 → 새 드릴 ──
    save_log(['풋워크'], [])
    check('C AI 분석 카드 열림', count('[data-region="analysis"]') == 1)
    drills = text_of('.drills--core')
    check('C 추천 드릴에 스플릿 스텝 → 전위 런지', '스플릿 스텝 → 전위 런지' in drills, drills[:200])
    check('C 드릴 방법에 두 발 살짝 떼며 박자', '두 발을 살짝 떼며 박자를 맞춘' in drills, drills[:260])

    # ── D. 관절 보호 접기 → 새 코칭 ──
    check('D 관절 보호 접기 하나', count('[data-fold="guard"]') == 1, count('[data-fold="guard"]'))
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.open = true; d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(600)
    body = text_of('[data-fold="guard"]')
    check('D 무릎·발목 보호 체크', '무릎·발목 보호 체크' in body)
    check('D 새 쉬운 기준', '급하게 방향을 바꾸다 발목을 접질리는 경우가 가장 많아요' in body
          and '발목이 비틀리는 부담이 줄어요' in body)
    check('D 새 확인 — 방향 바꾸기 전 스플릿 스텝 한 번',
          '방향 바꾸기 전 스플릿 스텝 한 번' in body and '발바닥 전체로 디디세요' in body)
    check('D 기존 기준·확인 그대로', 'toe-in' in body and 'toe-out' in body
          and '점프 착지 무릎 정렬' in body and '백핸드 앞쪽 런지 조심' in body)
    check('D 참고 논문 한 줄에 Wang 2024',
          'Wang 2024' in body and 'Wen 2025' in body and 'Du & Fan 2020' in body, body[-200:])
    check('D 화면에 통계 기호 없음', 'p <' not in body and '모멘트' not in body and 'OR ' not in body)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(400)
    shot('guard_open', keep='v178_live_split_step.png')

    # ── E. 발목 통증 ──
    save_log([], ['발목'])
    check('E 통증 일지에서도 접기 하나', count('[data-fold="guard"]') == 1)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.open = true; d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(600)
    body2 = text_of('[data-fold="guard"]')
    check('E 발목 통증에도 새 확인', '방향 바꾸기 전 스플릿 스텝 한 번' in body2, body2[:160])
    check('E 발목 통증에도 새 기준', '방향을 바꾸기 직전에 가볍게 한 번 뛰어' in body2)
    shot('guard_pain', keep='v178_live_split_step_pain.png')

    # ── F. 오류 · 넘침 ──
    w = overflow()
    check('F 390 가로 넘침 없음', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(700)
    w2 = overflow()
    check('F 360 가로 넘침 없음', w2[0] <= w2[1], w2)
    check('F 앱 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
