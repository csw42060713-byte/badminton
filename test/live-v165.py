"""bm-v1.65.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.65.0 (sw.js · app.js · styles.css?v=20261124-3) · 5개 탭
  2) 지도: 반경 5km 동네 동호인을 누르면 '선택한 동호인' 카드가 열리고
     매칭 요청(예시 동호인은 안내 후 매칭으로) · 프로필 보기 버튼이 보인다
  3) 코치: 동호인·초보는 위 탭 없이 '코치 찾기 · 피드백' 한 줄, 멘토 신청은 맨 아래 보조 줄
     (보조 줄 → 신청 화면 → 돌아가기)
  4) 커뮤니티 빈 화면: '게스트 모집 글쓰기' → 분류 게스트 모집 + 모집 입력칸
  5) bm-v1.63.0 인스타 공유 카드: 칩 1탭 → 안내·미리보기·사진 버튼이 한 화면, 기본 배경 4종
  6) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0

캡처: /workspace/downloads/live-164-map-match.png
실행(저장소 루트에서):  python3 test/live-v165.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
OUT = '/workspace/downloads'
SHOTS = '/workspace/check-shots'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def count(page, sel):
    return page.locator(sel).count()


def box(page, sel, root=None):
    q = sel if root is None else root + ' ' + sel
    return page.evaluate("""(s) => {
      const el = document.querySelector(s); if (!el) return null;
      const r = el.getBoundingClientRect();
      return {top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
              right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height)};
    }""", q)


def tap(page, sel, ms=700):
    page.locator(sel).first.click()
    page.wait_for_timeout(ms)


def overflow(page):
    return page.evaluate("() => [document.documentElement.clientWidth, "
                         "document.documentElement.scrollWidth]")


def wire(page):
    def on_console(m):
        t = m.text or ''
        if 'Content Security Policy' in t or 'CSP' in t:
            csp.append(t)
        elif m.type in ('error', 'assert'):
            errs.append('console.%s: %s' % (m.type, t))
    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: %s' % e))


def route_external(ctx):
    for pattern in ('**://accounts.google.com/**', '**://apis.google.com/**', '**://*.gstatic.com/**',
                    '**://script.google.com/**', '**://*.supabase.co/**'):
        ctx.route(pattern, lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))


def freeze_clock(page):
    page.clock.install(time='2026-11-23T20:30:00+09:00')
    page.clock.resume()


def enter_guest(page):
    freeze_clock(page)
    page.goto(BASE + '?nocache=1', wait_until='load')
    page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
    page.goto(BASE + '?nocache=1', wait_until='load')
    page.wait_for_timeout(1200)
    page.locator("[data-act='guest']").first.click()
    page.wait_for_timeout(1400)
    for _ in range(4):
        btn = page.locator('#sheet.is-on .sheet__panel .btn--primary')
        if btn.count() == 0:
            break
        btn.first.click()
        page.wait_for_timeout(500)


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  locale='ko-KR', service_workers='block')
        route_external(ctx)
        page = ctx.new_page()
        wire(page)

        # ── A. 라이브 버전 ──
        sw = page.request.get(BASE + 'sw.js?nocache=1').text()
        index = page.request.get(BASE + '?nocache=1').text()
        check('A 라이브 sw.js bm-v1.65.0', "var VERSION = 'bm-v1.65.0'" in sw,
              sw[sw.find('var VERSION'):sw.find('var VERSION') + 40].replace('\n', ' '))
        check('A 라이브 styles.css?v=20261124-3', 'styles.css?v=20261124-3' in index)

        enter_guest(page)
        check('A 앱 버전 v1.65.0', page.evaluate('() => BM.app.version') == 'v1.65.0',
              page.evaluate('() => BM.app.version'))
        check('A 탭 5개', count(page, "#tabbar [data-tab]") == 5, count(page, "#tabbar [data-tab]"))

        # ── B. 지도 동호인 → 매칭 ──
        tap(page, "#tabbar [data-tab='matching']", 800)
        tap(page, "[data-act='open-gym-map']", 2800)
        check('B 지도 열림', count(page, '#gympage.is-on') == 1)
        people = page.locator('#gympage .nearp')
        check('B 동네 동호인 카드 있음', people.count() >= 3, people.count())
        people.first.click()
        page.wait_for_timeout(1000)
        act = page.locator('#gympage [data-gymact]')
        check('B 선택한 동호인 카드 열림', act.count() == 1, act.count())
        act_txt = act.inner_text().replace('\n', ' | ') if act.count() else ''
        check('B 카드에 이름·상태', '운동 가능 시간' in act_txt or '운동' in act_txt, act_txt[:120])
        check('B 매칭 요청 버튼', count(page, '#gympage [data-gym-match]') == 1)
        check('B 프로필 보기 버튼', count(page, '#gympage [data-gym-profile]') == 1)
        check('B 고른 카드 강조 · 지도 핀 표시', page.evaluate(
            "() => !!document.querySelector('#gympage .nearp[aria-expanded=\"true\"]')"))
        check('B 카드가 화면 안(하단 고정)', page.evaluate("""() => {
            const el = document.querySelector('#gympage [data-gymact]');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top > 0 && r.bottom <= window.innerHeight + 1 && r.width > 200;
        }"""))
        check('B 가로 넘침 없음', overflow(page)[0] >= overflow(page)[1] - 1, overflow(page))
        page.screenshot(path=OUT + '/live-164-map-match.png')
        print('  saved ' + OUT + '/live-164-map-match.png', flush=True)

        print('B-2) 매칭 요청 → 예시 동호인 안내', flush=True)
        tap(page, '#gympage [data-gym-match]', 900)
        sheet_body = text_of(page, '#sheet .sheet__body')
        check('B 매칭 요청이 시트로 이어진다', count(page, '#sheet.is-on') == 1, len(sheet_body))
        check('B 예시 동호인이면 그 사실을 밝힌다', '예시 동호인' in sheet_body, sheet_body[:120].replace('\n', ' | '))
        check('B 매칭으로 보내는 버튼', count(page, '#sheet [data-gym-find-mates]') == 1)
        page.locator('#sheet .sheet__panel [data-close]').first.click()
        page.wait_for_timeout(700)

        # ── C. 코치 탭 ──
        tap(page, '#gympage [data-gym-close]', 800)
        tap(page, "#tabbar [data-tab='coach']", 900)
        check('C 코치 화면', count(page, ".view[data-view='coach']") == 1)
        seg = page.locator(".view[data-view='coach'] .seg--wide")
        check('C 위 탭 줄 없음', seg.count() == 0, seg.count())
        line = text_of(page, ".view[data-view='coach'] .coachline")
        check("C '코치 찾기 · 피드백' 한 줄", '코치 찾기' in line, line)
        mentor = page.locator(".view[data-view='coach'] [data-coachmentor]")
        check('C 멘토 신청 보조 줄', mentor.count() == 1)
        check('C 멘토 신청은 목록 아래', page.evaluate("""() => {
            const m = document.querySelector('.view[data-view="coach"] [data-coachmentor]');
            const l = document.querySelector('.view[data-view="coach"] .coachline');
            if (!m || !l) return false;
            return m.getBoundingClientRect().top > l.getBoundingClientRect().top + 100;
        }"""))
        tap(page, ".view[data-view='coach'] [data-coachmentor] .btn", 900)
        apply_txt = text_of(page, ".view[data-view='coach']")
        check('C 신청 화면 열림', '멘토' in apply_txt and ('소속' in apply_txt or '경력' in apply_txt), apply_txt[:100].replace('\n', ' | '))
        back = page.locator(".view[data-view='coach'] [data-coachtab='feedback']")
        check('C 돌아가기', back.count() >= 1)
        if back.count():
            back.first.click()
            page.wait_for_timeout(800)
            check('C 코치 찾기로 돌아옴', count(page, ".view[data-view='coach'] .coachline") == 1)
        page.screenshot(path=SHOTS + '/live-165-coach.png')

        # ── D. 커뮤니티 빈 화면 ──
        tap(page, "#tabbar [data-tab='community']", 1000)
        empty = text_of(page, ".view[data-view='community']")
        check('D 빈 화면', '아직 글이 없어요' in empty, empty[:80].replace('\n', ' | '))
        guest_btn = page.locator(".view[data-view='community'] [data-act='write-guest']")
        check('D 게스트 모집 글쓰기 버튼', guest_btn.count() == 1)
        guest_btn.first.click()
        page.wait_for_timeout(1000)
        picked = page.evaluate("""() => {
            const on = document.querySelector('.view[data-view="community"] [data-topic].is-on');
            return on ? on.getAttribute('data-topic') : '';
        }""")
        check('D 분류 = 게스트 모집', picked == '게스트 모집', picked)
        check('D 모집 입력칸 열림', page.evaluate("""() => {
            const f = document.querySelector('.view[data-view="community"] [data-viteform]');
            return !!f && f.getBoundingClientRect().height > 0;
        }"""))
        page.screenshot(path=SHOTS + '/live-165-community.png')

        # ── E. bm-v1.63.0 인스타 공유 카드 ──
        tap(page, "#tabbar [data-tab='log']", 900)
        page.fill('[data-field="minutes"]', '90')
        page.evaluate("""() => {
          const st = BM.app.ctx.store.state;
          st.drafts.log.cond = 8;
          st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
        }""")
        tap(page, '[data-act="save-log"]', 2000)
        page.evaluate('() => window.scrollTo(0, 0)')
        page.wait_for_timeout(400)
        tap(page, '[data-share-entry="log-hero"]', 1400)
        check('E 공유 시트 열림', count(page, '#sheet .sc__canvas') >= 1)
        check('E 시트 제목', '인스타 공유 카드' in text_of(page, '#sheet'))
        vh = 844
        tabs = box(page, '.sc__modes', '#sheet')
        prev = box(page, '.sc__preview', '#sheet')
        shotb = box(page, '.sc__shot', '#sheet')
        saveb = box(page, '.sc__savebar', '#sheet')
        check('E 안내·미리보기·사진 버튼이 한 화면',
              bool(tabs and prev and shotb and tabs['bottom'] <= vh and prev['bottom'] <= vh
                   and shotb['bottom'] <= vh and tabs['top'] < prev['top'] < shotb['top']),
              [tabs, prev, shotb])
        check('E 저장 버튼은 화면 아래', bool(saveb and saveb['bottom'] <= vh and saveb['top'] > vh - 120), saveb)
        check('E 기본 배경 칩 4개', count(page, '#sheet [data-sc-bg]') == 4)
        check('E 썸네일 4개', count(page, '#sheet [data-sc-bgthumb]') == 4)
        page.locator('#sheet .sheet__panel [data-close]').first.click()
        page.wait_for_timeout(700)

        # ── F. 오류 · 넘침 ──
        for tab in ('log', 'matching', 'community', 'coach', 'my'):
            tap(page, "#tabbar [data-tab='%s']" % tab, 700)
            w = overflow(page)
            check('F 탭 %s 가로 넘침 없음' % tab, w[1] <= w[0] + 1, w)
        check('F 콘솔·페이지 오류 0', len(errs) == 0, errs[:5])
        check('F CSP 위반 0', len(csp) == 0, csp[:3])
        browser.close()

    print('', flush=True)
    bad = [c for c in checks if not c[1]]
    print('%d/%d 통과' % (len(checks) - len(bad), len(checks)), flush=True)
    if bad:
        for label, _ in bad:
            print('  - ' + label, flush=True)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
