"""v1.37.2 로컬 점검 — 일지 & AI 저장 버튼이 하단 탭바 위에 고정되는지 390×844로 촬영합니다.
   (로컬 저장소를 그대로 띄웁니다 · 체험 모드)
   LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-savebar.py
"""
import functools
import http.server
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = '/workspace/work/bm137'
OUT = '/workspace/tmp/savebar'
PORT = 8141
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
TAG = sys.argv[1] if len(sys.argv) > 1 else 'local'

socketserver.TCPServer.allow_reuse_address = True
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
httpd.allow_reuse_address = True
threading.Thread(target=httpd.serve_forever, daemon=True).start()
BASE = 'http://127.0.0.1:%d/' % PORT

errs, checks = [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


PROBE = """(tab) => {
  const bar = document.querySelector('.submit-wrap.savebar');
  const nav = document.getElementById('tabbar');
  const v = document.querySelector('[data-view]');
  const main = document.getElementById('main');
  const css = bar ? getComputedStyle(bar) : null;
  const br = bar ? bar.getBoundingClientRect() : null;
  const nr = nav ? nav.getBoundingClientRect() : null;
  /* 마지막 카드(최근 기록)의 아래 끝 — 고정 바가 이걸 덮지 않아야 합니다 */
  const cards = v ? v.querySelectorAll(':scope > *') : [];
  const last = cards.length ? cards[cards.length - 1].getBoundingClientRect() : null;
  const btn = bar ? bar.querySelector('button') : null;
  const bt = btn ? btn.getBoundingClientRect() : null;
  return {
    tab: tab,
    barPresent: !!bar,
    barPos: css ? css.position : null,
    bar: br ? {top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right), h: Math.round(br.height)} : null,
    btn: bt ? {top: Math.round(bt.top), bottom: Math.round(bt.bottom), h: Math.round(bt.height)} : null,
    label: btn ? btn.textContent.trim() : null,
    nav: nr ? {top: Math.round(nr.top), bottom: Math.round(nr.bottom)} : null,
    viewPadBottom: v ? getComputedStyle(v).paddingBottom : null,
    mainPadBottom: main ? getComputedStyle(main).paddingBottom : null,
    lastBottom: last ? Math.round(last.bottom) : null,
    scrollY: Math.round(window.scrollY),
    maxScroll: Math.round(document.documentElement.scrollHeight - window.innerHeight),
    vh: window.innerHeight
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    def new_page(theme):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                            color_scheme='light')
        pg = ctx.new_page()
        pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))
        pg.goto(BASE + 'index.html?s=' + theme, wait_until='load')
        pg.evaluate("(th) => localStorage.setItem('bm_cache_v1', JSON.stringify({ me: { theme: { theme: th } } }))", theme)
        pg.goto(BASE + 'index.html?s=' + theme + '&r=1', wait_until='load')
        pg.wait_for_timeout(2600)
        return ctx, pg

    for theme in ('th_def', 'th_night'):
        ctx, page = new_page(theme)
        if page.query_selector('[data-act="guest"]'):
            page.click('[data-act="guest"]')
            page.wait_for_timeout(2400)
        for _ in range(4):
            if page.query_selector('#sheet .sheet__head [data-close]'):
                page.click('#sheet .sheet__head [data-close]')
                page.wait_for_timeout(400)
        if page.query_selector('[data-tab="log"]'):
            page.click('[data-tab="log"]')
            page.wait_for_timeout(800)

        for name, frac in (('top', 0.0), ('mid', 0.45), ('end', 1.0)):
            page.evaluate("(f) => window.scrollTo(0, Math.round((document.documentElement.scrollHeight - window.innerHeight) * f))", frac)
            page.evaluate("(th) => document.documentElement.setAttribute('data-theme', th)", theme)
            page.wait_for_timeout(400)
            info = page.evaluate(PROBE, theme)
            print(theme, name, info)
            page.screenshot(path='%s/%s-%s-%s.png' % (OUT, TAG, theme, name))
            gap = (info['nav']['top'] - info['bar']['bottom']) if info['bar'] and info['nav'] else None
            check(theme + ' ' + name + ' 저장 바 고정', info['barPos'] == 'fixed', info['barPos'])
            check(theme + ' ' + name + ' 탭바 바로 위(간격 0~18px)', gap is not None and 0 <= gap <= 18, gap)
            check(theme + ' ' + name + ' 바가 탭바와 겹치지 않음', gap is not None and gap >= 0, gap)
            if name == 'end':
                check(theme + ' end 마지막 내용이 바 위로', info['lastBottom'] is not None and info['lastBottom'] <= info['bar']['top'] + 2,
                      (info['lastBottom'], info['bar']['top']))
        # 다른 탭에서는 저장 바가 없어야 합니다
        for tab in ('matching', 'community', 'coach', 'my'):
            page.click('[data-tab="%s"]' % tab)
            page.wait_for_timeout(500)
            gone = page.evaluate("() => !document.querySelector('.submit-wrap.savebar')")
            check(theme + ' ' + tab + ' 탭에 저장 바 없음', gone, gone)
        ctx.close()

    # 로컬 주소는 구글 로그인 client ID에 등록돼 있지 않아 GSI 403이 뜹니다(배포본에서는 없음)
    real = [e for e in errs if 'GSI_LOGGER' not in e and 'status of 403' not in e]
    print('errors', real)
    check('콘솔·페이지 에러 0건(로컬 GSI 제외)', len(real) == 0, real[:4])
    print('result', sum(1 for _, c in checks if c), '/', len(checks))
    b.close()
