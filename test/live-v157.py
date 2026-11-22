"""bm-v1.57.0 라이브 점검 (390×844) — 테마 전체 무료 · 인스타 공유 카드 · 푸시 알림 틀

· https://csw42060713-byte.github.io/badminton/ 배포본을 그대로 봅니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 진입합니다)
· 확인
  A) 배포 파일 버전(sw·app·index·TWA·sharecard·push) · 5개 탭 · 가로 넘침 0
  B) 테마 전체 무료 — MY › 테마 잠금 없음 · 사쿠라/라임 코트를 눌러도 하트 그대로
  C) 인스타 공유 카드 — 오늘 운동 · 대회 인증 · 내 사진 · 투명 스티커 (1080×1350 PNG)
  D) MY 알림 · 편지지 — 실시간 푸시 알림 스위치·준비 상태
  E) 콘솔 오류 0 · CSP 위반 0
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu \\
  python3 test/live-v157.py
"""

import time
import urllib.request

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PHOTO = '/workspace/tmp/v157_photo.jpg'
PLAYER = 'live157@example.com'

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


def theme(page):
    return page.evaluate("() => document.documentElement.getAttribute('data-theme')")


def png_size(path):
    with Image.open(path) as im:
        return im.size


def corner_alpha(path):
    with Image.open(path) as im:
        return im.convert('RGBA').getpixel((4, 4))[3]


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
    ctx.add_init_script("""
      try {
        Object.defineProperty(window, 'Notification', {
          configurable: true,
          value: function Notification() {},
        });
        window.Notification.permission = 'default';
        window.Notification.requestPermission = function () { return Promise.resolve('default'); };
      } catch (e) {}
    """)
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
        page.wait_for_timeout(2800)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    # ── A-0. 배포 파일 ──
    stamp = '?l=' + str(int(time.time()))
    sw = get(BASE + 'sw.js' + stamp)
    index = get(BASE + 'index.html' + stamp)
    appjs = get(BASE + 'app.js' + stamp)
    twa = get(BASE + 'twa-manifest.json' + stamp)
    css = get(BASE + 'styles.css' + stamp)
    card = get(BASE + 'js/sharecard.js' + stamp)
    pushjs = get(BASE + 'js/push.js' + stamp)
    check('A-0 sw.js bm-v1.57.0', "var VERSION = 'bm-v1.57.0'" in sw)
    check('A-0 app.js v1.57.0', "version: 'v1.57.0'" in appjs)
    check('A-0 index styles.css?v=20261123-1', 'styles.css?v=20261123-1' in index)
    check('A-0 index sharecard·push 스크립트',
          'js/sharecard.js' in index and 'js/push.js' in index)
    check('A-0 TWA 1.57.0 · 코드 51',
          '"appVersionName": "1.57.0"' in twa and '"appVersionCode": 51' in twa,
          twa[twa.find('appVersionName'):][:60])
    check('A-0 sw.js 가 sharecard·push 를 캐시', './js/sharecard.js' in sw and './js/push.js' in sw)
    check('A-0 styles.css 공유카드·푸시 스타일', '.sc__canvas' in css and '.pushstatus' in css)
    check('A-0 sharecard.js 1080×1350 · navigator.share',
          'W = 1080' in card and 'H = 1350' in card and 'navigator.share' in card)
    check('A-0 push.js VAPID 경로', 'PushManager' not in pushjs or 'pushManager' in pushjs)
    check('A-0 push.js 상태 문구', 'Firebase 연결 준비됨' in pushjs)

    # ── A. 진입 · 5개 탭 ──
    login(PLAYER, '점검왕')
    check('A 앱 진입 · 버전 v1.57.0', page.evaluate("() => BM.app.version") == 'v1.57.0',
          page.evaluate("() => BM.app.version"))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 테마 전체 무료 ──
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"theme\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(320)
    check('B 테마 4종 카드', count(page, '.theme[data-theme]') == 4, count(page, '.theme[data-theme]'))
    check('B 잠금·하트 배지 없음', not has(page, '.theme__lock'))
    hearts0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    tap('.theme[data-theme="th_sakura"]', 750)
    check('B 사쿠라 바로 적용', theme(page) == 'th_sakura', theme(page))
    check('B 하트 차감 없음',
          page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance") == hearts0,
          '%s' % hearts0)
    page.evaluate("() => document.querySelector('details[data-group=\"theme\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v157_live_themes_free.png')
    tap('.theme[data-theme="th_court"]', 750)
    check('B 라임 코트 적용 · 하트 그대로',
          theme(page) == 'th_court' and page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance") == hearts0)
    onboarding = page.evaluate("""() => {
      BM.views.start.reset();
      return BM.views.start.renderOnboarding({ kind: 'guest', name: '새내기' });
    }""")
    check('B 시작 화면 하트 2 배지 없음', '하트 2' not in onboarding and 'onbtheme__price' not in onboarding)

    # ── C. 일지 저장 → 인스타 공유 카드 ──
    tap("#tabbar [data-tab='log']", 700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1600)
    check('C 저장 직후 공유 카드 버튼', has(page, '[data-region="share"] [data-act="share-card"]'))
    tap('[data-region="share"] [data-act="share-card"]', 900)
    check('C 공유 카드 시트 열림', has(page, '#sheet .sc__canvas'))
    check('C 캔버스 1080×1350', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1350])
    check('C 오늘 카드 요약', '90' in text_of(page, '[data-sc-summary]') and '2승 1패' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v157_live_sharecard_today_sheet.png')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 300)
    path1 = OUT + '/v157_live_sharecard_today.png'
    dl.value.save_as(path1)
    check('C 오늘 카드 PNG 1080×1350', png_size(path1) == (1080, 1350), png_size(path1))
    check('C 오늘 카드 불투명', corner_alpha(path1) == 255, corner_alpha(path1))

    tap('[data-sc-mode="comp"]', 650)
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(350)
    check('C 대회 카드 요약',
          '2026 전국 동호인 오픈' in text_of(page, '[data-sc-summary]') and '준우승' in text_of(page, '[data-sc-summary]'),
          text_of(page, '[data-sc-summary]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v157_live_sharecard_contest_sheet.png')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 300)
    path2 = OUT + '/v157_live_sharecard_contest.png'
    dl.value.save_as(path2)
    check('C 대회 카드 PNG 1080×1350', png_size(path2) == (1080, 1350), png_size(path2))

    tap('[data-sc-style="photo"]', 400)
    page.set_input_files('[data-sc-photo]', PHOTO)
    page.wait_for_timeout(900)
    px = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      return Array.from(c.getContext('2d').getImageData(540, 300, 1, 1).data);
    }""")
    check('C 사진이 캔버스에 합성됨', px[0] > 120 and px[3] == 255, px)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v157_live_sharecard_photo_sheet.png')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 300)
    path3 = OUT + '/v157_live_sharecard_photo.png'
    dl.value.save_as(path3)
    check('C 사진 카드 PNG 1080×1350', png_size(path3) == (1080, 1350), png_size(path3))

    tap('[data-sc-style="sticker"]', 450)
    check('C 스티커 안내', '투명' in text_of(page, '[data-sc-save]'), text_of(page, '[data-sc-save]'))
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 300)
    path4 = OUT + '/v157_live_sharecard_sticker.png'
    dl.value.save_as(path4)
    check('C 스티커 PNG 1080×1350', png_size(path4) == (1080, 1350), png_size(path4))
    check('C 스티커 배경 투명', corner_alpha(path4) == 0, corner_alpha(path4))
    tap('#sheet .sheet__head [data-close]', 400)

    # ── D. MY 알림 · 편지지 ──
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"alarm\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(350)
    check('D 실시간 푸시 알림 줄', has(page, '[data-pref-row="push"]'))
    check('D Firebase 준비 상태', 'Firebase 연결 준비됨' in text_of(page, '[data-push-status]'),
          text_of(page, '[data-push-status]'))
    page.evaluate("() => document.querySelector('details[data-group=\"alarm\"]').scrollIntoView({block:'start'})")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v157_live_my_push_alarm.png')
    tap('[data-act="toggle-push"]', 900)
    check('D 스위치를 켜면 저장', page.evaluate("() => BM.app.ctx.store.state.prefs.push === true"))
    check('D 켠 뒤에도 준비 상태', 'Firebase' in text_of(page, '[data-push-status]'),
          text_of(page, '[data-push-status]'))

    # ── E. 최근 기록 상세 · MY 공유 입구 ──
    page.evaluate("() => { const d = document.querySelector('details[data-group=\"share\"]'); if (d) d.open = true; }")
    page.wait_for_timeout(300)
    check('E MY 공유 카드 입구', count(page, 'details[data-group="share"] [data-act="share-card"]') == 2)
    tap("#tabbar [data-tab='log']", 700)
    tap('.logrow', 700)
    check('E 최근 기록 상세에 공유 카드 버튼', has(page, '#sheet [data-act="share-card"]'))
    page.screenshot(path=OUT + '/v157_live_record_detail.png')
    tap('#sheet [data-act="share-card"]', 900)
    check('E 상세 → 공유 카드 시트', has(page, '#sheet .sc__canvas'))
    tap('#sheet .sheet__head [data-close]', 400)

    # ── F. 콘솔 · CSP ──
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:3])
    w = overflow(page)
    check('F 가로 넘침 0', w[0] <= w[1] + 1, w)

    b.close()

failed = [c for c in checks if not c[1]]
print('\n%d/%d 통과%s' % (len(checks) - len(failed), len(checks),
                        (' · 실패: ' + str([f[0] for f in failed])) if failed else ''))
raise SystemExit(1 if failed else 0)
