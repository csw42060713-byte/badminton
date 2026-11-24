"""bm-v1.69.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.69.0 (sw.js · app.js) · 5개 탭 그대로
  2) 일지 저장(풋워크 약점) → AI 카드의 '관절 보호 체크' 접기 하나, 눌러서 열린다
  3) '무릎·발목 보호 체크' — 새 기준 3줄(발끝 안쪽/toe-in · 바깥/toe-out · 점프 착지 무릎 정렬)
  4) 새 '조심할 동작' 2개(런지 착지 발끝 방향 · 점프 착지 무릎 정렬), 기존 3개 그대로
  5) 참고 논문 한 줄 Wen 2025 · Xiao 2026
  6) 기존 블록 보호(추천 드릴 · 감각연습 · 오프코트) · 360 폭 · 라이트 테마
  7) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 캡처 downloads/v169_lower_guard.png

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v169.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
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
        path = OUT + '/v169_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live169@example.com', name: '라이브점검',
                    at: new Date().toISOString(), onboardedAt: '2026-11-24 16:00:00',
                    profile: { nick: '라이브점검', level: 'A조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-24 16:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    check('A 라이브 버전 v1.69.0', page.evaluate("() => BM.app.version") == 'v1.69.0',
          page.evaluate("() => BM.app.version"))
    sw = page.evaluate("""async () => {
      try { const r = await fetch('sw.js?x=' + Date.now()); return await r.text(); } catch (e) { return ''; }
    }""")
    check('A 라이브 sw.js bm-v1.69.0', "var VERSION = 'bm-v1.69.0'" in sw)
    ai = page.evaluate("""async () => {
      try { const r = await fetch('js/ai.js?x=' + Date.now()); return await r.text(); } catch (e) { return ''; }
    }""")
    check('A 라이브 ai.js에 새 근거', '10.1186/s13102-025-01393-y' in ai
          and '10.1080/15438627.2026.2680707' in ai)
    check('A 라이브 ai.js에 새 문구', '런지 착지 발끝 방향' in ai and '점프 착지 무릎 정렬' in ai)
    check('A 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))

    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 6;
      st.drafts.log.intensity = 5;
      st.drafts.log.weakness = ['풋워크'];
    }""")
    tap('[data-act="save-log"]', 1900)
    check('B AI 카드 열림', has(page, '[data-region="analysis"]'))
    check('B 관절 보호 접기가 하나', count(page, '[data-fold="guard"]') == 1,
          count(page, '[data-fold="guard"]'))
    closed = page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""")
    check('B 기본은 접힘', closed is False, closed)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('live_guard-closed')

    tap('[data-fold="guard"] > summary', 800)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="guard"]')
    check('C 무릎·발목 보호 체크 화면', '무릎·발목 보호 체크' in body and '쉬운 기준' in body)
    check('C 새 기준 — 발끝 안쪽(toe-in)', 'toe-in' in body and '몸 안쪽으로 말아' in body
          and '뒤꿈치' in body)
    check('C 새 기준 — 발끝 바깥(toe-out)', 'toe-out' in body and '조금 바깥으로 열어' in body
          and '뒤꿈치 충격' in body)
    check('C 새 기준 — 점프 착지 무릎 정렬', '두 무릎이 안쪽으로 모이면' in body
          and '발끝과 같은 방향' in body)
    check('C 기존 기준 4줄 그대로', '가장 많이 다치는 곳이 다리' in body
          and '백핸드 쪽으로 길게 뻗는 런지' in body and '대각선 뒤로 빠지면서' in body)
    check('C 새 확인 — 런지 착지 발끝 방향', '런지 착지 발끝 방향' in body and '20도' in body)
    check('C 새 확인 — 점프 착지 무릎 정렬', '점프 착지 무릎 정렬' in body and 'X자' in body)
    check('C 기존 확인 3개 그대로', '백핸드 앞쪽 런지 조심' in body
          and '마지막 세트 런지 5개로 확인' in body)
    check('C 참고 논문 한 줄', '참고 논문 · Du & Fan 2020' in body and 'Wen 2025' in body
          and 'Xiao 2026' in body, body[-160:])
    check('C 화면에 통계 기호 없음', 'p <' not in body and '모멘트' not in body
          and '내회전' not in body)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(400)
    shot('live_guard-open')
    # 새 '조심할 동작' 두 줄이 화면에 들어오게 내려서 최종 라이브 캡처 (계획서 지정 경로)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="guard"]');
      const li = Array.prototype.slice.call(d.querySelectorAll('li'))
        .filter((n) => n.innerText.indexOf('런지 착지 발끝 방향') >= 0)[0];
      (li || d).scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(450)
    page.screenshot(path=OUT + '/v169_lower_guard.png')
    print('  saved ' + OUT + '/v169_lower_guard.png', flush=True)

    tap('[data-fold="guard"] > summary', 600)
    check('D 다시 누르면 접힌다',
          page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""") is False)

    check('E 추천 드릴 그대로', '추천 드릴' in text_of(page, '[data-region="analysis"]'))
    check('E 감각연습 블록 그대로', count(page, '[data-fold="sense"]') == 1)
    check('E 오프코트 블록 그대로', count(page, '[data-fold="offcourt"]') == 1)

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="guard"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
      document.documentElement.setAttribute('data-theme', 'th_def');
    }""")
    page.wait_for_timeout(450)
    shot('live_guard-light')
    w = overflow(page)
    check('F 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('F 360 폭 넘침 0', w[0] <= w[1], w)
    shot('live_guard-360')

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
