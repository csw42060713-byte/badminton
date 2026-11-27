"""bm-v1.63.0 라이브 점검 (390×844) — 📸 인스타 공유 시트 단순화 · 기본 감성 배경 4종

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 엽니다.
· Supabase·구글·지도·CDN 요청은 막아 두고, 기기 저장(local) 모드로만 움직입니다
  → 서버 DB에는 아무것도 쓰지 않습니다.
· 시트를 열자마자 [탭 + 한 줄 안내 + 미리보기 + 📷 사진 넣기] 가 한 화면에 보이는지,
  기본 배경 4종이 1탭에 미리보기·저장 PNG에 반영되는지, 접기·대회 입력·내 사진까지 확인합니다.
· 스크린샷은 downloads/v163l_*.png 로 남깁니다.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu python3 test/live-v163.py
"""

import os
import time
import urllib.request

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
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v163l_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean163l@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(3000)

    # ── A-0. 배포 파일 ──
    stamp = '?l=' + str(int(time.time() * 1000))

    def fetch(name):
        # 브라우저 캐시를 거치지 않고 배포본 파일을 그대로 읽습니다
        req = urllib.request.Request(BASE + name + stamp, headers={'Cache-Control': 'no-cache'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode('utf-8')

    sw = fetch('sw.js')
    appjs = fetch('app.js')
    index = fetch('index.html')
    twa = fetch('twa-manifest.json')
    css = fetch('styles.css')
    scjs = fetch('js/sharecard.js')
    check('A-0 배포본 읽기', 'bm-v1.63.0' in sw, sw[:60])
    check('A-0 sw.js bm-v1.63.0', "var VERSION = 'bm-v1.63.0'" in sw)
    check('A-0 app.js v1.63.0', "version: 'v1.63.0'" in appjs)
    check('A-0 index styles.css?v=20261124-1', 'styles.css?v=20261124-1' in index)
    check('A-0 TWA 1.63.0 · 코드 57',
          '"appVersionName": "1.63.0"' in twa and '"appVersionCode": 57' in twa)
    check('A-0 sharecard.js 배경 4종', "'courtnight'" in scjs and 'paintBgCourtNight' in scjs)
    check('A-0 styles.css 새 시트', '.sc__guide {' in css and '.sc__bgs {' in css and '.sc__savebar {' in css)

    wait, ok_live = 0, False
    while wait < 12:
        login('점검왕')
        if page.evaluate("() => BM.app && BM.app.version") == 'v1.63.0':
            ok_live = True
            break
        wait += 1
        page.wait_for_timeout(10000)
        page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    check('A 라이브 앱 버전 v1.63.0', ok_live, page.evaluate("() => BM.app && BM.app.version"))

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
    check('A 일지 저장 완료',
          page.evaluate("() => (BM.app.ctx.store.state.data.records || []).length") >= 1)

    # ── B. 시트 첫 화면 — 3초 완성 ──
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    CHIP = '[data-share-entry="log-hero"]'
    check('B 첫 화면에 인스타 공유 칩', has(page, CHIP))
    tap(CHIP, 1300)
    check('B 칩 1탭에 공유 시트가 열린다', has(page, '#sheet .sc__canvas'))

    vh = 844
    tabs = box(page, '#sheet .sc__modes')
    guide = box(page, '#sheet .sc__guide')
    prev = box(page, '#sheet .sc__preview')
    shotb = box(page, '#sheet .sc__shot')
    saveb = box(page, '#sheet .sc__savebar')
    check('B 한 화면에 탭 + 한 줄 안내', bool(tabs and guide and tabs['top'] > 0 and guide['bottom'] <= vh),
          [tabs, guide])
    check('B 스크롤 없이 미리보기', bool(prev and prev['top'] > 0 and prev['bottom'] <= vh), prev)
    check('B 스크롤 없이 📷 사진 넣기', bool(shotb and shotb['top'] > 0 and shotb['bottom'] <= vh), shotb)
    check('B 미리보기는 사진 버튼을 밀어내지 않는다 (높이 ≤ 340)', bool(prev and prev['h'] <= 340), prev)
    check('B 저장은 화면 아래 고정', bool(saveb and saveb['bottom'] <= vh and saveb['top'] > vh - 120), saveb)
    gtext = text_of(page, '#sheet .sc__guide')
    check('B 안내 한 줄', '사진 고르고' in gtext and '저장 누르면 끝' in gtext, gtext)
    stxt = text_of(page, '#sheet .sc__shot')
    check('B 사진 버튼 — 사진 넣기 / 갤러리 · 카메라',
          '사진 넣기' in stxt and '갤러리' in stxt, stxt)
    check('B 접기는 기본 닫힘', page.evaluate("() => !document.querySelector('#sheet .sc__more').open"))
    check('B 시트 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('01_시트_첫화면')

    # ── C. 기본 배경 4종 ──
    check('C 배경 칩 4개', count(page, '#sheet [data-sc-bg]') == 4, count(page, '#sheet [data-sc-bg]'))
    thumbs = page.evaluate("""() => [...document.querySelectorAll('#sheet [data-sc-bgthumb]')].map(cv => {
      try {
        const g = cv.getContext('2d');
        const d = g.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 3), 1, 1).data;
        return [cv.getAttribute('data-sc-bgthumb'), d[0] + d[1] + d[2] > 30];
      } catch (e) { return [cv.getAttribute('data-sc-bgthumb'), 'err']; }
    })""")
    check('C 썸네일 4개가 실제로 그려졌다',
          isinstance(thumbs, list) and len(thumbs) == 4 and all(t[1] is True for t in thumbs), thumbs)

    for bg in ['courtnight', 'shuttlelight', 'sunsetcourt', 'mintmesh']:
        tap('#sheet [data-sc-bg="%s"]' % bg, 500)
        ink = page.evaluate("""() => {
          const cv = document.querySelector('#sheet .sc__canvas');
          const g = cv.getContext('2d');
          return [[0.2, 0.15], [0.5, 0.35], [0.8, 0.6], [0.5, 0.9]].map(([x, y]) => {
            const d = g.getImageData(Math.round(cv.width * x), Math.round(cv.height * y), 1, 1).data;
            return d[0] + d[1] + d[2];
          });
        }""")
        check('C %s 미리보기 다시 그려짐' % bg,
              isinstance(ink, list) and len(set(ink)) >= 2 and max(ink) > 60, ink)
        if bg == 'courtnight':
            shot('02_배경_코트야경')
        with page.expect_download(timeout=25000) as dl:
            tap('[data-sc-save]', 400)
        png = OUT + '/v163l_card_bg_%s.png' % bg
        dl.value.save_as(png)
        check('C %s 카드 PNG 1080×1350' % bg, Image.open(png).size == (1080, 1350), Image.open(png).size)
    shot('03_배경_민턴그라데이션')

    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = b.scrollHeight; }")
    page.wait_for_timeout(400)
    shot('04_아래로_스크롤')
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 0; }")

    # ── D. 내 사진 ──
    img = OUT + '/v163l_upload.png'
    Image.new('RGB', (720, 900), (36, 92, 140)).save(img)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1300)
    check('D 사진을 고르면 미리보기 반영', page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const g = cv.getContext('2d');
      const d = g.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.30), 1, 1).data;
      return d[2] > d[0] + 20;
    }"""))
    check('D 사진이 있으면 "사진 바꾸기" · "사진 빼기"',
          '사진 바꾸기' in text_of(page, '#sheet .sc__shot') and page.evaluate(
              "() => { const b = document.querySelector('#sheet [data-sc-photoclear]'); return !!b && !b.hidden; }"))
    check('D 사진이 있으면 배경 선택은 꺼짐', page.evaluate(
        "() => [...document.querySelectorAll('#sheet [data-sc-bg]')].every(b => b.getAttribute('aria-pressed') === 'false')"))
    shot('05_내사진_적용')
    tap('#sheet [data-sc-photoclear]', 600)
    check('D 사진 빼면 "사진 넣기"로', '사진 넣기' in text_of(page, '#sheet .sc__shot'))

    # ── E. 접기 ──
    tap('#sheet .sc__moresum', 600)
    check('E 접기 펼침', page.evaluate("() => document.querySelector('#sheet .sc__more').open"))
    check('E 펼치면 문구·색·체육관이 보인다',
          has(page, '#sheet [data-sc-field="gym"]') and has(page, '#sheet [data-sc-pal="night"]')
          and has(page, '#sheet [data-sc-phrase="mintern"]'))
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = b.scrollHeight; }")
    page.wait_for_timeout(400)
    shot('06_접기_펼침')
    tap('#sheet .sc__moresum', 400)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 0; }")
    page.wait_for_timeout(300)

    # ── F. 대회 인증 ──
    tap('#sheet [data-sc-mode="comp"]', 900)
    check('F 대회 인증 탭', page.evaluate("""() => {
      const on = [...document.querySelectorAll('#sheet [data-sc-mode]')]
        .filter(t => t.getAttribute('aria-selected') === 'true')
        .map(t => t.getAttribute('data-sc-mode'));
      return on.length === 1 && on[0] === 'comp';
    }"""))
    check('F 대회 핵심 입력은 접기 밖', page.evaluate("""() => {
      const det = document.querySelector('#sheet .sc__more');
      const detTop = det ? det.getBoundingClientRect().top : 0;
      return ['contest', 'event', 'compPartner'].every(n => {
        const el = document.querySelector('#sheet [data-sc-field="' + n + '"]');
        return !!el && el.getBoundingClientRect().top < detTop;
      }) && !!document.querySelector('#sheet [data-sc-result="우승"]');
    }"""))
    shot('07_대회인증')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)

    # ── G. 디자인 3종 × 비율 2종 PNG ──
    tap(CHIP, 1200)
    tap('#sheet [data-sc-bg="sunsetcourt"]', 500)
    sizes = {'feed': (1080, 1350), 'story': (1080, 1920)}
    for d in ['magazine', 'film', 'sticker']:
        tap('#sheet [data-sc-design="%s"]' % d, 500)
        for r in ['feed', 'story']:
            tap('#sheet [data-sc-ratio="%s"]' % r, 400)
            with page.expect_download(timeout=25000) as dl:
                tap('[data-sc-save]', 300)
            png = OUT + '/v163l_card_%s_%s.png' % (d, r)
            dl.value.save_as(png)
            check('G %s · %s PNG %s' % (d, r, sizes[r]), Image.open(png).size == sizes[r],
                  Image.open(png).size)
        if d == 'film':
            page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 0; }")
            page.wait_for_timeout(300)
            shot('08_필름')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)

    # ── H. 보존 · 콘솔 ──
    check('H 저장 직후 공유 스트립 그대로', has(page, '[data-region="share"] [data-act="share-card"]'))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 650)
        w = overflow(page)
        check('H 탭 %s 정상 · 가로 넘침 없음' % tab,
              has(page, "[data-view='%s']" % tab) and w[0] <= w[1] + 1, w)

    check('H 콘솔 오류 0', not errs, errs[:3])
    check('H CSP 위반 0', not csp, csp[:3])

    b.close()

total = len(checks)
passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, total))
if passed != total:
    print('실패:', [n for n, ok_ in checks if not ok_])
