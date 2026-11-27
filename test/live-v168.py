"""bm-v1.68.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.68.0 (sw.js · app.js) · 5개 탭 그대로
  2) 일지 저장 → AI 카드에 감각연습 접힘 블록 하나, 눌러서 열린다
  3) 오전 3블록(몸풀기 5분 · 2대1 숏드라이브/드라이브/드롭 10분 · 뒷코트 10분) 텍스트
  4) 오후 웨이트 3묶음(크런치 10kg 30개×5세트 · 백 익스텐션 3방향 · 스쿼트 80kg · 종아리 · 턱걸이 · 덤벨컬 · 어깨·삼두)
  5) 쉬운 말 풀이 · 무게 안내 · 안전 줄 · 약점(드라이브) 한 줄
  6) 360 폭 · 라이트 테마 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0
  7) v1.67 공유 카드 보호

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v168.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
SHOTS = '/workspace/check-shots'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' not in m.text and 'net::ERR_ABORTED' not in m.text:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def tap(sel, wait=500):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v168_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live168@example.com', name: '라이브점검',
                    at: new Date().toISOString(), onboardedAt: '2026-11-24 13:00:00',
                    profile: { nick: '라이브점검', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-24 13:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    check('A 라이브 버전 v1.68.0', page.evaluate("() => BM.app.version") == 'v1.68.0',
          page.evaluate("() => BM.app.version"))
    sw = page.evaluate("""async () => {
      try { const r = await fetch('sw.js?x=' + Date.now()); return await r.text(); } catch (e) { return ''; }
    }""")
    check('A 라이브 sw.js bm-v1.68.0', "var VERSION = 'bm-v1.68.0'" in sw)
    check('A 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))

    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '70')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 7;
      st.drafts.log.intensity = 6;
      st.drafts.log.weakness = ['드라이브'];
    }""")
    tap('[data-act="save-log"]', 1800)
    check('B AI 카드 열림', has(page, '[data-region="analysis"]'))
    check('B 감각연습 접힘 블록 하나', count(page, '[data-fold="sense"]') == 1, count(page, '[data-fold="sense"]'))
    closed = page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""")
    check('B 기본은 접힘', closed is False, closed)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('B-sense-closed')

    tap('[data-fold="sense"] > summary', 700)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="sense"]')
    check('C 오전 코트 45~50분', '오전 · 코트 실전 감각연습' in body and '약 45~50분' in body)
    check('C 오전 순서 3블록', '몸풀기 5분 → 2대1 감각연습 30분 → 뒷코트 감각연습 10분' in body)
    check('C 2대1 쉬운 풀이 · 10분씩', '두 명이서 한 사람에게' in body and '숏드라이브 10분' in body
          and '드라이브 10분' in body and '드롭 10분' in body)
    check('C 뒷코트(뒷사각) 풀이', '뒷코트(뒷사각)' in body and '모서리' in body)
    check('C 오후 웨이트 3묶음', '코어 · 허리' in body and '하체' in body and '상체 · 팔' in body)
    check('C 크런치 10kg 30개×5세트', '중량 크런치' in body and '30개 × 5세트' in body)
    check('C 백 익스텐션 3방향', '백 익스텐션 3방향' in body and '가운데·왼쪽·오른쪽' in body)
    check('C 스쿼트 선수 기준 80kg', '선수 기준 80kg' in body and '10개 × 3세트' in body)
    check('C 종아리 · 턱걸이 · 덤벨컬 · 어깨 · 삼두',
          '종아리 레이즈(카프 레이즈)' in body and '턱걸이' in body and '덤벨컬' in body
          and '어깨 보강' in body and '삼두 보강' in body)
    check('C 무게 안내 · 안전', '무게 안내 ·' in body and '동호인·초보자는 맨몸' in body and '안전 ·' in body)
    check('C 약점(드라이브) 한 줄', '드라이브가 약점이라면 2대1 드라이브 10분' in body)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); d.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(350)
    shot('C-sense-open')

    tap('[data-fold="sense"] > summary', 500)
    check('D 다시 누르면 접힌다',
          page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""") is False)

    tap('[data-act="share-card"][data-share-entry="log-hero"]', 1200)
    check('E v1.67 공유 카드가 열린다', has(page, '.sc__canvas'))
    shot('E-share-card')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="sense"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
      document.documentElement.setAttribute('data-theme', 'th_def');
    }""")
    page.wait_for_timeout(450)
    shot('F-sense-light')
    w = overflow(page)
    check('F 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('F 360 폭 넘침 0', w[0] <= w[1], w)
    shot('F-sense-360')

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
