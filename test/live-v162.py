"""bm-v1.62.0 라이브 점검 (390×844) — 📸 인스타 공유 입구를 첫 화면으로

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 엽니다.
· Supabase·구글·지도·CDN 요청은 막아 두고, 기기 저장(local) 모드로만 움직입니다
  → 서버 DB에는 아무것도 쓰지 않습니다.
· 일지 히어로 칩 · MY 프로필 아래 배너를 각각 1탭해 실제 인스타 공유 시트가 열리고
  최신 일지로 카드 PNG(1080×1350)까지 나오는지 확인합니다.
· 저장 화면은 downloads/v162l_*.png 로 남깁니다.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu python3 test/live-v162.py
"""

import os
import time

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def box(page, sel):
    return page.evaluate("""(s) => {
      const n = document.querySelector(s);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
               right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    }""", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def on_dialog(d):
        errs.append('DIALOG: ' + d.message)
        d.dismiss()

    page.on('dialog', on_dialog)

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v162l_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean162l@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-23 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-23 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(3000)

    # ── A-0. 배포 파일 ──
    stamp = '?l=' + str(int(time.time()))
    sw = page.request.get(BASE + 'sw.js' + stamp).text()
    appjs = page.request.get(BASE + 'app.js' + stamp).text()
    index = page.request.get(BASE + 'index.html' + stamp).text()
    twa = page.request.get(BASE + 'twa-manifest.json' + stamp).text()
    css = page.request.get(BASE + 'styles.css' + stamp).text()
    logjs = page.request.get(BASE + 'js/views/log.js' + stamp).text()
    myjs = page.request.get(BASE + 'js/views/my.js' + stamp).text()
    check('A-0 sw.js bm-v1.62.0', "var VERSION = 'bm-v1.62.0'" in sw)
    check('A-0 app.js v1.62.0', "version: 'v1.62.0'" in appjs)
    check('A-0 index styles.css?v=20261123-6', 'styles.css?v=20261123-6' in index)
    check('A-0 TWA 1.62.0 · 코드 56',
          '"appVersionName": "1.62.0"' in twa and '"appVersionCode": 56' in twa)
    check('A-0 일지 칩 코드 배포됨', 'data-share-entry="log-hero"' in logjs)
    check('A-0 MY 배너 코드 배포됨 · 아코디언 제거',
          'data-share-entry="my-top"' in myjs and "group('share', 'camera'" not in myjs)
    check('A-0 styles.css 새 입구', '.hero__share {' in css and '.share-entry {' in css)

    wait, ok_live = 0, False
    while wait < 12:
        login('점검왕')
        if page.evaluate("() => BM.app && BM.app.version") == 'v1.62.0':
            ok_live = True
            break
        wait += 1
        page.wait_for_timeout(10000)
        # 캐시를 비우고 다시 (Pages 반영 대기)
        page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    check('A 라이브 앱 버전 v1.62.0', ok_live,
          page.evaluate("() => BM.app && BM.app.version"))

    # 카드 숫자를 위해 일지 하나 저장 (이 기기에만)
    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 2000)
    check('A 일지 저장 완료', page.evaluate("() => (BM.app.ctx.store.state.data.records || []).length") >= 1)

    # ── B. 일지 첫 화면 칩 ──
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    CHIP = '[data-share-entry="log-hero"]'
    check('B 첫 화면에 인스타 공유 칩', has(page, CHIP))
    cb = box(page, CHIP)
    check('B 스크롤 없이 보인다 (상단 0 · 화면 844 안)', cb and 0 < cb['top'] and cb['bottom'] <= 844, cb)
    check('B 폰 폭을 넘지 않는다', cb and cb['left'] >= 0 and cb['right'] <= 390, cb)
    chip_text = text_of(page, CHIP).replace('\n', ' ')
    check('B 칩 문구 — 인스타 공유 / 오늘 운동 · 대회 인증',
          '인스타 공유' in chip_text and '오늘 운동 · 대회 인증' in chip_text, chip_text)
    check('B 일지 첫 화면 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('01_일지_첫화면_칩')

    tap(CHIP, 1200)
    check('B 칩 1탭에 공유 시트가 열린다', has(page, '#sheet .sc__canvas'))
    check('B 시트 제목 "인스타 공유 카드"', '인스타 공유 카드' in text_of(page, '#sheet'))
    check('B 모드는 오늘 운동', page.evaluate("""() => {
      const on = [...document.querySelectorAll('#sheet [data-sc-mode]')]
        .filter(t => t.getAttribute('aria-selected') === 'true')
        .map(t => t.getAttribute('data-sc-mode'));
      return on.length === 1 && on[0] === 'today';
    }"""))
    check('B 최신 일지로 열린다', page.evaluate("""() => {
      const sc = BM.sharecard._state();
      const recs = BM.app.ctx.store.state.data.records || [];
      return !!sc && !!recs.length && String(sc.recordId) === String(recs[0].id);
    }"""))
    shot('02_일지_칩에서_열린_시트')

    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 500)
    png = OUT + '/v162l_card_from_log_chip.png'
    dl.value.save_as(png)
    check('B 칩에서 만든 카드 PNG 1080×1350', Image.open(png).size == (1080, 1350), Image.open(png).size)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)
    check('B 시트 닫힘', not has(page, '#sheet .sc__canvas'))

    # ── C. 저장 직후 스트립(보존) ──
    check('C 저장 직후 공유 스트립 그대로', has(page, '[data-region="share"] [data-act="share-card"]'))

    # ── D. MY 배너 ──
    tap("#tabbar [data-tab='my']", 900)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    BANNER = '[data-share-entry="my-top"]'
    check('D MY 첫 화면에 공유 배너', has(page, BANNER))
    bb = box(page, BANNER)
    check('D 스크롤 없이 보인다 (상단 0 · 화면 844 안)', bb and 0 < bb['top'] and bb['bottom'] <= 844, bb)
    check('D 폰 폭을 넘지 않는다', bb and bb['left'] >= 0 and bb['right'] <= 390, bb)
    btxt = text_of(page, BANNER).replace('\n', ' ')
    check('D 배너 문구 — 인스타 공유 카드 만들기 / 민턴일기 · 대회 인증 · 사진 얹기',
          '인스타 공유 카드 만들기' in btxt and '민턴일기 · 대회 인증 · 사진 얹기' in btxt, btxt)
    check('D MY 공유 입구는 하나', count(page, '[data-act="share-card"]') == 1,
          count(page, '[data-act="share-card"]'))
    check('D 중복 아코디언은 사라졌다', count(page, 'details[data-group="share"]') == 0)
    check('D MY 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('03_MY_첫화면_배너')

    tap(BANNER, 1200)
    check('D 배너 1탭에 공유 시트가 열린다', has(page, '#sheet .sc__canvas'))
    check('D 최신 일지로 열린다', page.evaluate("""() => {
      const sc = BM.sharecard._state();
      const recs = BM.app.ctx.store.state.data.records || [];
      return !!sc && !!recs.length && String(sc.recordId) === String(recs[0].id);
    }"""))
    shot('04_MY_배너에서_열린_시트')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)

    # ── E. 라이트 테마 ──
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); BM.app.repaint(); }")
    page.wait_for_timeout(900)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    lb = box(page, BANNER)
    check('E 라이트 테마 MY 배너 유지', has(page, BANNER) and lb and lb['bottom'] <= 844, lb)
    check('E 라이트 테마 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('05_MY_라이트')
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_night'); BM.app.repaint(); }")
    page.wait_for_timeout(800)

    # ── F. 다섯 탭 · 콘솔 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 700)
        w = overflow(page)
        check('F 탭 %s 정상 · 가로 넘침 없음' % tab,
              has(page, "[data-view='%s']" % tab) and w[0] <= w[1] + 1, w)

    check('F 콘솔 오류 0', not errs, errs[:3])
    check('F CSP 위반 0', not csp, csp[:3])

    b.close()

total = len(checks)
passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, total))
if passed != total:
    print('실패:', [n for n, ok_ in checks if not ok_])
