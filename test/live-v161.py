"""bm-v1.61.0 라이브 점검 (390×844) — 인스타 카드 문구 프리셋 · 직접 입력

· 배포본(https://csw42060713-byte.github.io/badminton/)을 그대로 엽니다.
· Supabase·구글·지도·CDN 요청은 막고 기기 저장(local) 모드로만 움직입니다 → 서버 DB에 쓰지 않습니다.
· 저장 PNG는 downloads/v161l_*.png 로 남깁니다.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu python3 test/live-v161.py
"""

import os
import time

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PHOTO = '/workspace/tmp/v160_court_portrait.jpg'

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


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def phrase_state(page):
    return page.evaluate("() => { const s = BM.sharecard._state(); return { phrase: s.phrase, phraseComp: s.phraseComp }; }")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url
                  or 'firebase' in route.request.url)
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

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name, sel='#sheet .sc__preview'):
        if sel and has(page, sel):
            page.locator(sel).scroll_into_view_if_needed()
            page.wait_for_timeout(320)
        path = OUT + '/v161l_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean161l@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-23 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-23 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(3000)

    # ── A-0. 배포 파일이 v1.61.0 인지 ──
    stamp = '?l=' + str(int(time.time()))
    sw = page.request.get(BASE + 'sw.js' + stamp).text()
    appjs = page.request.get(BASE + 'app.js' + stamp).text()
    index = page.request.get(BASE + 'index.html' + stamp).text()
    twa = page.request.get(BASE + 'twa-manifest.json' + stamp).text()
    card = page.request.get(BASE + 'js/sharecard.js' + stamp).text()
    css = page.request.get(BASE + 'styles.css' + stamp).text()
    readme = page.request.get(BASE + 'README.md' + stamp).text()
    check('A-0 sw.js bm-v1.61.0', "var VERSION = 'bm-v1.61.0'" in sw)
    check('A-0 app.js v1.61.0', "version: 'v1.61.0'" in appjs)
    check('A-0 index styles.css?v=20261123-5', 'styles.css?v=20261123-5' in index)
    check('A-0 TWA 1.61.0 · 코드 55',
          '"appVersionName": "1.61.0"' in twa and '"appVersionCode": 55' in twa)
    check('A-0 sharecard 프리셋 5종', all(t in card for t in
          ['민턴일기', '오늘도, 배드민턴', '민턴기록', '민턴성장기', 'COURT TIME', 'PHRASES', 'PHRASE_MAX = 24']))
    check('A-0 sharecard 오운완 없음', '오운완' not in card)
    check('A-0 styles.css 문구 칸', '.sc__phrase' in css and '.sc__phraseinput' in css)
    check('A-0 README v1.61.0', 'bm-v1.61.0' in readme)

    # ── A. 앱 · MY ──
    login()
    check('A 라이브 앱 버전 v1.61.0', page.evaluate("() => BM.app.version") == 'v1.61.0',
          page.evaluate("() => BM.app.version"))

    tap("#tabbar [data-tab='log']", 700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1800)

    tap("#tabbar [data-tab='my']", 700)
    my = text_of(page, '#main')
    check('A MY 줄 민턴일기 · 대회 인증', '민턴일기 · 대회 인증' in my)
    check('A MY 화면에 오운완 없음', '오운완' not in my)
    page.evaluate("() => { const g = document.querySelector('[data-group=\"share\"]'); if (g) g.open = true; }")
    page.wait_for_timeout(300)
    shot('01_MY', sel=None)

    # ── B. 카드 시트 · 문구 칸 ──
    tap('[data-act="share-card"][data-sc-mode="today"]', 900)
    check('B 공유 카드 시트', has(page, '#sheet .sc__canvas'))
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-sc-phrase]')).map(b => b.innerText.trim())")
    check('B 칩 6개 · 문구 그대로', chips == ['민턴일기', '오늘도, 배드민턴', '민턴기록', '민턴성장기', 'COURT TIME', '직접 쓰기'], chips)
    check('B 기본 민턴일기(켜짐)', page.evaluate(
        "() => { const b = document.querySelector('[data-sc-phrase=\"mintern\"]'); return b.getAttribute('aria-pressed') + '/' + b.classList.contains('is-on'); }") == 'true/true')
    check('B 입력칸 민턴일기', page.evaluate("() => document.querySelector('.sc__phraseinput').value") == '민턴일기')
    check('B 시트에 오운완 없음', '오운완' not in text_of(page, '#sheet'))
    w = overflow(page)
    check('B 시트 가로 넘침 없음', w[0] <= w[1] + 1, w)
    shot('02_시트_문구칸', sel='.sc__phrase')

    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1500)

    # ── C. 프리셋 1탭 ──
    for pid, txt in [('today', '오늘도, 배드민턴'), ('record', '민턴기록'),
                     ('growth', '민턴성장기'), ('court', 'COURT TIME')]:
        tap('[data-sc-phrase="%s"]' % pid, 450)
        check('C %s → 입력칸·상태' % txt,
              page.evaluate("() => document.querySelector('.sc__phraseinput').value") == txt
              and phrase_state(page)['phrase'] == txt)

    tap('[data-sc-phrase="mintern"]', 600)
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 400)
    p1 = OUT + '/v161l_card_magazine_feed.png'
    dl.value.save_as(p1)
    check('C 매거진 피드 PNG 1080×1350', Image.open(p1).size == (1080, 1350), Image.open(p1).size)
    shot('03_매거진_피드_민턴일기')

    # ── D. 직접 쓰기 ──
    tap('[data-sc-phrase="custom"]', 400)
    check('D 직접 쓰기 → 입력칸 포커스', page.evaluate(
        "() => document.activeElement && document.activeElement.classList.contains('sc__phraseinput')"))
    page.fill('.sc__phraseinput', '코트 위 3시간')
    page.wait_for_timeout(700)
    check('D 직접 쓴 문구 반영', phrase_state(page)['phrase'] == '코트 위 3시간')
    check('D 직접 쓰기 칩 켜짐', page.evaluate(
        "() => document.querySelector('[data-sc-phrase=\"custom\"]').classList.contains('is-on')") == True)
    shot('04_직접쓴문구_매거진')

    page.fill('.sc__phraseinput', '가' * 30)
    page.wait_for_timeout(500)
    check('D 24자 상한', page.evaluate("() => document.querySelector('.sc__phraseinput').value.length") == 24)
    page.fill('.sc__phraseinput', '코트 위 3시간')
    page.wait_for_timeout(500)

    # ── E. 세 디자인 ──
    for d, name in [('magazine', '매거진'), ('film', '필름'), ('sticker', '스티커')]:
        tap('#sheet [data-sc-design="%s"]' % d, 700)
        shot('05_%s_직접쓴문구' % name)
        if d == 'sticker':
            check('E 스티커는 사진 칸 숨김', has(page, '.sc__photo[hidden]'))
            continue
        with page.expect_download(timeout=25000) as dl:
            tap('[data-sc-save]', 400)
        path = OUT + '/v161l_card_%s_feed_custom.png' % d
        dl.value.save_as(path)
        check('E %s 피드 PNG' % name, Image.open(path).size == (1080, 1350))
        if d == 'film':
            check('E 필름 종이 바탕', Image.open(path).convert('RGB').getpixel((20, 20))[0] > 200)

    tap('#sheet [data-sc-design="sticker"]', 500)
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 400)
    ps = OUT + '/v161l_card_sticker_feed.png'
    dl.value.save_as(ps)
    ims = Image.open(ps).convert('RGBA')
    check('E 스티커 투명 PNG', ims.size == (1080, 1350) and ims.getpixel((4, 4))[3] == 0)

    # ── F. 스토리 9:16 ──
    tap('#sheet [data-sc-design="magazine"]', 500)
    tap('#sheet [data-sc-ratio="story"]', 700)
    check('F 스토리 캔버스 1080×1920', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1920])
    shot('06_매거진_스토리')
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 400)
    p2 = OUT + '/v161l_card_magazine_story.png'
    dl.value.save_as(p2)
    check('F 스토리 PNG 1080×1920', Image.open(p2).size == (1080, 1920))
    tap('#sheet [data-sc-design="film"]', 600)
    shot('07_필름_스토리')
    tap('#sheet [data-sc-design="sticker"]', 600)
    shot('08_스티커_스토리')

    # ── G. 대회 카드 제목 ──
    tap('#sheet [data-sc-mode="comp"]', 900)
    check('G 대회 카드 제목 칸', has(page, '.sc__phrase'))
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(500)
    tap('[data-sc-phrase="growth"]', 600)
    check('G 대회 제목 민턴성장기', phrase_state(page)['phraseComp'] == '민턴성장기')
    tap('#sheet [data-sc-design="magazine"]', 600)
    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1400)
    tap('#sheet [data-sc-ratio="feed"]', 600)
    shot('09_대회_매거진_민턴성장기')
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 400)
    p3 = OUT + '/v161l_card_contest_magazine.png'
    dl.value.save_as(p3)
    check('G 대회 카드 PNG', Image.open(p3).size == (1080, 1350))
    tap('#sheet [data-sc-design="film"]', 600)
    shot('10_대회_필름_민턴성장기')
    tap('#sheet [data-sc-design="sticker"]', 600)
    shot('11_대회_스티커_민턴성장기')

    # ── H. 다시 열어도 기억 ──
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const g = document.querySelector('[data-group=\"share\"]'); if (g) g.open = true; }")
    page.wait_for_timeout(300)
    tap('[data-act="share-card"][data-sc-mode="today"]', 900)
    check('H 다시 열어도 직접 쓴 문구 기억', phrase_state(page)['phrase'] == '코트 위 3시간', phrase_state(page))
    check('H 다시 열어도 디자인 기억(스티커)', page.evaluate(
        "() => document.querySelector('[data-sc-design=\"sticker\"]').classList.contains('is-on')") == True)

    # ── I. 마무리 ──
    w = overflow(page)
    check('I 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('I 앱 오류 0건', len(errs) == 0, errs[:3])
    check('I CSP 위반 0건', len(csp) == 0, csp[:2])

    b.close()

done = sum(1 for _, ok in checks if ok)
print('\n%d/%d 통과' % (done, len(checks)))
