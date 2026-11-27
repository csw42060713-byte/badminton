"""bm-v1.58.0 라이브 점검 (390×844) — 인스타 카드 색 5종·디자인 3종 · 동기화 막힘 해결

· https://csw42060713-byte.github.io/badminton/ 배포본을 그대로 봅니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 진입 → 실DB에 아무것도 쓰지 않습니다)
· 확인
  A-0) 배포 파일 버전(sw·app·index·TWA·sharecard) · 캐시 키
  A) 5개 탭 정상 · 가로 넘침 0 · 콘솔 오류 0 · CSP 위반 0 · 버전 v1.58.0
  B) 공유 카드 — 색상 5칸·디자인 3칸, 코트 블루/챔피언 골드/선셋 포스터/코트 라인 캔버스 색,
     1080×1350 PNG 저장, MY › 인스타 공유 카드 입구
  C) MY › 데이터에 동기화 상태 칸(대기·건너뜀)과 '대기 중 비우기'
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu \\
  python3 test/live-v158.py
"""

import time
import urllib.request

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'live158@example.com'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def png_size(path):
    with Image.open(path) as im:
        return im.size


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
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
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def login(email, nick):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
                        onboardedAt: '2026-11-22 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-22 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(3000)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def canvas_pixel(x, y):
        return page.evaluate("""(p) => {
          const c = document.querySelector('.sc__canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(p.x, p.y, 1, 1).data;
          return [d[0], d[1], d[2], d[3]];
        }""", {'x': x, 'y': y})

    # ── A-0. 배포 파일 ──
    stamp = '?l=' + str(int(time.time()))
    sw = get(BASE + 'sw.js' + stamp)
    index = get(BASE + 'index.html' + stamp)
    appjs = get(BASE + 'app.js' + stamp)
    twa = get(BASE + 'twa-manifest.json' + stamp)
    css = get(BASE + 'styles.css' + stamp)
    card = get(BASE + 'js/sharecard.js' + stamp)
    store = get(BASE + 'js/store.js' + stamp)
    check('A-0 sw.js bm-v1.58.0', "var VERSION = 'bm-v1.58.0'" in sw)
    check('A-0 app.js v1.58.0', "version: 'v1.58.0'" in appjs)
    check('A-0 index styles.css?v=20261123-2', 'styles.css?v=20261123-2' in index)
    check('A-0 TWA 1.58.0 · 코드 52',
          '"appVersionName": "1.58.0"' in twa and '"appVersionCode": 52' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A-0 sharecard 5색·3디자인', "'night'" in card and "'courtline'" in card and "'gold'" in card)
    check('A-0 store 격리(bm_queue_dead_v1)', 'bm_queue_dead_v1' in store)
    check('A-0 styles 색상·동기화 칩', '.sc__pal' in css and '.syncbox' in css)

    # ── A. 진입 · 5개 탭 ──
    login(PLAYER, '점검왕')
    check('A 앱 진입 · 버전 v1.58.0', page.evaluate("() => BM.app.version") == 'v1.58.0',
          page.evaluate("() => BM.app.version"))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 일지 저장 → 공유 카드 ──
    tap("#tabbar [data-tab='log']", 700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
    }""")
    tap('[data-act="save-log"]', 1600)
    tap('[data-region="share"] [data-act="share-card"]', 900)
    check('B 공유 카드 시트', has(page, '#sheet .sc__canvas'))
    check('B 색상 5칸 · 디자인 3칸', count(page, '[data-sc-pal]') == 5 and count(page, '[data-sc-layout]') == 3,
          (count(page, '[data-sc-pal]'), count(page, '[data-sc-layout]')))
    pal = page.evaluate("""() => {
      const r = Array.from(document.querySelectorAll('[data-sc-pal]')).map(n => n.getBoundingClientRect());
      return { tops: r.map(x => Math.round(x.top)), left: Math.round(r[0].left), right: Math.round(r[4].right), w: window.innerWidth };
    }""")
    check('B 색상 5칸 한 줄 · 화면 폭 안', len(set(pal['tops'])) == 1 and pal['left'] >= 0 and pal['right'] <= pal['w'], pal)
    page.locator('#sheet [data-sc-pal]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v158_live_sharecard_colors.png')

    base_px = canvas_pixel(560, 40)
    check('B 기본 나이트 카드', base_px[1] > base_px[2] and base_px[0] < 40, base_px)
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v158_live_card_night.png')

    tap('[data-sc-pal="court"]', 450)
    court_px = canvas_pixel(560, 40)
    check('B 코트 블루 배경', court_px[2] > court_px[0] and court_px[2] > 20, court_px)
    tap('[data-sc-layout="courtline"]', 500)
    check('B 코트 라인 디자인', '코트 라인' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v158_live_card_court_line.png')

    tap('[data-sc-pal="gold"]', 350)
    tap('[data-sc-layout="poster"]', 500)
    tap('[data-sc-mode="comp"]', 700)
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(350)
    check('B 대회 카드 요약(챔피언 골드 · 포스터)',
          '챔피언 골드' in text_of(page, '[data-sc-summary]') and '포스터' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.locator('#sheet [data-sc-pal]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v158_live_sharecard_contest_sheet.png')
    page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v158_live_card_gold_contest_poster.png')

    page.locator('#sheet [data-sc-save]').scroll_into_view_if_needed()
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 300)
    path = OUT + '/v158_live_saved.png'
    dl.value.save_as(path)
    check('B 저장 PNG 1080×1350', png_size(path) == (1080, 1350), png_size(path))

    # ── C. MY › 데이터 동기화 상태 ──
    page.evaluate("() => { if (BM.ui && BM.ui.closeSheet) BM.ui.closeSheet(); }")
    page.wait_for_timeout(500)
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-group=data]')
    page.wait_for_timeout(250)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.open = true; }", 'details[data-adv=sheets]')
    page.wait_for_timeout(400)
    my = text_of(page, '#main')
    check('C MY › 인스타 공유 카드 입구', '인스타 공유 카드' in my)
    check('C MY › 동기화 상태 칸', '동기화 상태' in my and '대기 중인 저장' in my, my[:100])
    check('C MY › 대기 중 비우기', has(page, '[data-act="clear-queue"]') or '보내지 못한 저장이 없어요' in my)
    page.evaluate("(sel) => { const n = document.querySelector(sel); if (n) n.scrollIntoView({block:'center'}); }", '[data-sync-box]')
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v158_live_my_sync.png')

    # ── D. 콘솔·CSP ──
    check('D 콘솔 오류 0', not errs, errs[:3])
    check('D CSP 위반 0', not csp, csp[:2])
    check('D 가로 넘침 0', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))

    b.close()

failed = [c for c in checks if not c[1]]
print('\n%d/%d 통과%s' % (len(checks) - len(failed), len(checks),
                        (' · 실패: ' + ', '.join(c[0] for c in failed)) if failed else ''))
