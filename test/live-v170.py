"""bm-v1.70.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.70.0 (sw.js · app.js · js/ai.js의 새 문구) · 5개 탭 그대로
  2) 일지 저장(수비 약점) → AI 카드의 '시합 당일 준비' 접기 하나, 눌러서 열린다
  3) 시합 직전 3단계(가볍게 조깅 → 스트레칭으로 관절 풀기 → 코트에서 시합)
  4) 수비 → 공격 전환 3단계 + 파트너 전후 전환
  5) 수비에서 받는 타이밍 — 예측한 공은 앞에서 짧게 / 예측 못 한 공은 뒤로 당겨 여유
  6) 추천 드릴 1번이 '수비 타이밍 — 예측했을 때 / 아닐 때' (드릴 방법·포인트)
  7) 전술 노트(더 보기) 첫 줄이 수비 → 공격 전환, 기존 서브·리시브 전술 유지
  8) 기존 블록 보호 · 360 폭 · 라이트 테마
  9) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 캡처 downloads/v170_live_tactic.png

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v170.py
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
        path = OUT + '/v170_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live170@example.com', name: '라이브점검',
                    at: new Date().toISOString(), onboardedAt: '2026-11-24 19:40:00',
                    profile: { nick: '라이브점검', level: 'A조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-24 19:40:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    check('A 라이브 버전 v1.70.0', page.evaluate("() => BM.app.version") == 'v1.70.0',
          page.evaluate("() => BM.app.version"))
    sw = page.evaluate("""async () => {
      try { const r = await fetch('sw.js?x=' + Date.now()); return await r.text(); } catch (e) { return ''; }
    }""")
    check('A 라이브 sw.js bm-v1.70.0', "var VERSION = 'bm-v1.70.0'" in sw)
    ai = page.evaluate("""async () => {
      try { const r = await fetch('js/ai.js?x=' + Date.now()); return await r.text(); } catch (e) { return ''; }
    }""")
    check('A 라이브 ai.js에 시합 당일 준비', '시합 당일 준비' in ai and 'MATCH_DAY' in ai)
    check('A 라이브 ai.js에 수비 전환·타이밍', '수비에서 공격으로 뒤집기' in ai
          and '수비에서 받는 타이밍' in ai and '뒤로 살짝 당겨' in ai)
    check('A 라이브 ai.js에 수비 드릴', '수비 타이밍 — 예측했을 때 / 아닐 때' in ai)
    check('A 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))

    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 6;
      st.drafts.log.intensity = 5;
      st.drafts.log.weakness = ['수비'];
    }""")
    tap('[data-act="save-log"]', 1900)
    check('B AI 카드 열림', has(page, '[data-region="analysis"]'))
    card = text_of(page, '[data-region="analysis"]')
    check('B 추천 드릴 1번이 수비 타이밍', '수비 타이밍 — 예측했을 때 / 아닐 때' in card)
    check('B 드릴 방법에 당겨서 받기', '뒤로 살짝 당겨' in card)
    tap('[data-fold="ai-detail"] > summary', 600)
    detail = text_of(page, '[data-fold="ai-detail"]')
    check('B 드릴 포인트 — 예측/아닐 때', '드릴 포인트' in detail
          and '예측했으면 앞에서 짧게' in detail and '뒤로 당겨 여유롭게' in detail)
    tap('[data-fold="ai-detail"] > summary', 400)

    check('C 시합 준비 접기가 하나', count(page, '[data-fold="match"]') == 1,
          count(page, '[data-fold="match"]'))
    closed = page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""")
    check('C 기본은 접힘', closed is False, closed)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]');
      d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('live_match-closed')

    tap('[data-fold="match"] > summary', 800)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="match"]')
    check('C 시합 직전 워밍업 소제목', '시합 직전 워밍업' in body)
    check('C 3단계 — 조깅·스트레칭·시합', '가볍게 조깅' in body and '스트레칭으로 관절 풀기' in body
          and '코트에서 시합' in body)
    check('C 조깅 설명', '몸이 따뜻해질 때까지' in body)
    check('C 스트레칭 설명 — 관절을 풀어', '관절을 풀어' in body)
    check('D 전환 소제목', '수비에서 공격으로 뒤집기' in body)
    check('D ① 세게 한 번 밀기', '세게 한 번 쳐서 밀어내기' in body and '뒤로 물러나야' in body)
    check('D ② 코스 틀기 · 짧게 놓기', '코스 틀기 · 짧게 놓기' in body and '짧게 놓아' in body)
    check('D ③ 순서 지키기', '밀기 전에 방향부터 바꾸면' in body and '코스 바꾸기' in body)
    check('D 파트너 전후 전환', '전후 전환' in body and '네트 쪽으로 붙어' in body)
    check('E 수비 타이밍 소제목', '수비에서 받는 타이밍' in body)
    check('E 예측한 공 — 앞에서 짧게', '예측한 공 — 앞에서 짧게' in body and '압박' in body)
    check('E 예측 못 한 공 — 뒤로 당겨 여유', '예측 못 한 공 — 뒤로 살짝 당겨 여유' in body
          and '빠르게 느껴져' in body and '여유 있게' in body)
    check('E 출처 줄 — 현장 기준', '체전 1등 선수 현장 기준' in body, body[-160:])
    check('E 화면에 통계 기호 없음', 'p <' not in body and '모멘트' not in body
          and '생체역학' not in body)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="match"]');
      const li = Array.prototype.slice.call(d.querySelectorAll('li'))
        .filter((n) => n.innerText.indexOf('예측 못 한 공') >= 0)[0];
      (li || d).scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v170_live_tactic.png')
    print('  saved ' + OUT + '/v170_live_tactic.png', flush=True)
    shot('live_match-open')

    tap('[data-fold="match"] > summary', 600)
    check('F 다시 누르면 접힌다',
          page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""") is False)

    tap('[data-fold="extra"] > summary', 650)
    extra = text_of(page, '[data-fold="extra"]')
    check('G 전술 노트 복식', '전술 노트 · 복식' in extra)
    check('G 전술 첫 줄이 수비 → 공격 전환', '세게 한 번' in extra and '코스를 틀거나 짧게' in extra)
    check('G 기존 전술(서브·리시브) 유지', '숏서브' in extra and '리시브' in extra)
    tap('[data-fold="extra"] > summary', 400)

    check('H 추천 드릴 유지', '추천 드릴' in text_of(page, '[data-region="analysis"]'))
    check('H 감각연습 유지', count(page, '[data-fold="sense"]') == 1)
    check('H 오프코트 유지', count(page, '[data-fold="offcourt"]') == 1)
    check('H 이번 주 루틴 유지', count(page, '[data-fold="week"]') == 1)
    check('H 맞춤 처방 유지', count(page, '[data-fold="care"]') == 1)

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('I %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="match"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
      document.documentElement.setAttribute('data-theme', 'th_def');
    }""")
    page.wait_for_timeout(450)
    shot('live_match-light')
    w = overflow(page)
    check('I 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('I 360 폭 넘침 0', w[0] <= w[1], w)
    shot('live_match-360')

    check('I 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('I CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
