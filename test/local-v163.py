"""bm-v1.63.0 로컬 점검 (390×844) — 📸 인스타 공유 시트 단순화 · 기본 감성 배경 4종

사용자 피드백: "어 잘안보여 그리고 어떡게 하는건지 복잡해" · "디자인도 좀더 다듬어봐줘"
              "예쁜 이미지도 추가할수있게. 어때?" → "ㄱㄱ"

  1) 일지 첫 화면 '📸 인스타 공유' 칩 → 시트를 열자마자
     [탭 + 한 줄 안내 + 미리보기 + 📷 사진 넣기] 가 스크롤 없이 한 화면에 보인다
  2) 기본 배경 4종 칩(썸네일 캔버스) 1탭 → 미리보기 캔버스가 그 배경으로 다시 그려진다
     + 그 상태로 저장한 PNG가 1080×1350 / 1080×1920 으로 나온다(4종 모두)
  3) 내 사진 업로드 → 미리보기 반영 · '사진 바꾸기' + '사진 빼기' 로 바뀐다
  4) '문구 · 색 · 내용 바꾸기' 접기: 기본 닫힘 → 펼치면 문구·색·체육관 입력이 나온다
  5) 대회 인증 탭: 대회명·종목·성적·파트너가 접기 밖에서 바로 보인다
  6) 디자인 3종 × 비율 2종 카드 PNG(매거진·필름·스티커) · 저장 버튼은 늘 화면 아래
  7) 라이트 테마 · 360 폭 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0

실행(저장소 루트에서):
  (python3 -m http.server 8827 --bind 127.0.0.1 &) ; python3 test/local-v163.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8827/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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


def box(page, sel, scope='document'):
    return page.evaluate("""(a) => {
      const root = a.scope === 'sheet' ? document.querySelector('#sheet') : document;
      const n = root ? root.querySelector(a.sel) : null;
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
               right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
    }""", {'sel': sel, 'scope': scope})


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


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
        path = OUT + '/v163_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean163@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 ──
    sw = read('sw.js')
    twa = read('twa-manifest.json')
    index = read('index.html')
    css = read('styles.css')
    check('A-0 sw.js bm-v1.63.0', "var VERSION = 'bm-v1.63.0'" in sw)
    check('A-0 index styles.css?v=20261124-1', 'styles.css?v=20261124-1' in index)
    check('A-0 TWA 1.63.0 · 코드 57',
          '"appVersionName": "1.63.0"' in twa and '"appVersionCode": 57' in twa)
    check('A-0 줄인 시트 스타일', '.sc__guide {' in css and '.sc__shot {' in css
          and '.sc__bgs {' in css and '.sc__more {' in css and '.sc__savebar {' in css)

    login('점검왕')
    check('A 앱 버전 v1.63.0', page.evaluate("() => BM.app.version") == 'v1.63.0',
          page.evaluate("() => BM.app.version"))

    # 카드 숫자를 위해 일지 하나 저장 (이 기기에만)
    tap("#tabbar [data-tab='log']", 750)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1900)
    check('A 일지 저장 완료',
          page.evaluate("() => (BM.app.ctx.store.state.data.records || []).length") >= 1)

    # ── B. 시트 첫 화면 — 3초 완성 ──
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(400)
    tap('[data-share-entry="log-hero"]', 1200)
    check('B 칩 1탭에 공유 시트가 열린다', has(page, '#sheet .sc__canvas'))
    check('B 시트 제목 "인스타 공유 카드"', '인스타 공유 카드' in text_of(page, '#sheet'))

    vh = 844
    tabs = box(page, '.sc__modes', 'sheet')
    guide = box(page, '.sc__guide', 'sheet')
    prev = box(page, '.sc__preview', 'sheet')
    shotb = box(page, '.sc__shot', 'sheet')
    saveb = box(page, '.sc__savebar', 'sheet')
    check('B 한 화면에 탭 + 안내', bool(tabs and guide and tabs['top'] > 0 and guide['bottom'] <= vh),
          [tabs, guide])
    check('B 스크롤 없이 미리보기가 보인다', bool(prev and prev['top'] > 0 and prev['bottom'] <= vh), prev)
    check('B 스크롤 없이 📷 사진 넣기까지 보인다', bool(shotb and shotb['top'] > 0 and shotb['bottom'] <= vh),
          shotb)
    check('B 미리보기는 사진 버튼을 밀어내지 않는다 (높이 ≤ 340)',
          bool(prev and prev['h'] <= 340), prev)
    check('B 저장 버튼은 늘 화면 아래에 붙어 있다',
          bool(saveb and saveb['bottom'] <= vh and saveb['top'] > vh - 120), saveb)
    check('B 미리보기 위 = 안내, 아래 = 사진 버튼',
          bool(tabs and guide and prev and shotb and tabs['top'] < guide['top'] < prev['top'] < shotb['top']))
    gtext = text_of(page, '.sc__guide')
    check('B 한 줄 안내 문구', '사진 고르고' in gtext and '저장 누르면 끝' in gtext, gtext)
    stext = text_of(page, '.sc__shot')
    check('B 사진 버튼 문구 — 사진 넣기 / 갤러리 · 카메라',
          '사진 넣기' in stext and '갤러리' in stext and '카메라' in stext, stext)
    check('B 시트 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('01_시트_첫화면')

    # 문구·색·내용은 접혀 있다
    check('B 접기 제목 "문구 · 색 · 내용 바꾸기"', '문구 · 색 · 내용 바꾸기' in text_of(page, '.sc__moresum'))
    check('B 접기는 기본 닫힘', page.evaluate(
        "() => !document.querySelector('#sheet .sc__more').open"))
    check('B 닫힌 채로는 체육관 입력이 안 보인다', not page.evaluate("""() => {
        const el = document.querySelector('#sheet [data-sc-field="gym"]');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < 844;
      }"""))

    # ── C. 기본 배경 4종 ──
    check('C 기본 배경 칩 4개', count(page, '#sheet [data-sc-bg]') == 4,
          count(page, '#sheet [data-sc-bg]'))
    check('C 썸네일 캔버스 4개', count(page, '#sheet [data-sc-bgthumb]') == 4)
    thumbs_ok = page.evaluate("""() => [...document.querySelectorAll('#sheet [data-sc-bgthumb]')].map(cv => {
      try {
        const g = cv.getContext('2d');
        const d = g.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 3), 1, 1).data;
        return [cv.getAttribute('data-sc-bgthumb'), d[0] + d[1] + d[2] > 30];
      } catch (e) { return [cv.getAttribute('data-sc-bgthumb'), 'err']; }
    })""")
    check('C 썸네일이 실제로 그려졌다(빈 캔버스 아님)',
          isinstance(thumbs_ok, list) and len(thumbs_ok) == 4 and all(t[1] is True for t in thumbs_ok),
          thumbs_ok)

    sizes = {'feed': (1080, 1350), 'story': (1080, 1920)}
    for bg in ['courtnight', 'shuttlelight', 'sunsetcourt', 'mintmesh']:
        tap('#sheet [data-sc-bg="%s"]' % bg, 500)
        check('C %s 선택 표시' % bg, page.evaluate(
            "(id) => { const b = document.querySelector('#sheet [data-sc-bg=\"' + id + '\"]');"
            " return !!b && b.getAttribute('aria-pressed') === 'true'; }", bg))
        ink = page.evaluate("""() => {
          const cv = document.querySelector('#sheet .sc__canvas');
          const g = cv.getContext('2d');
          const pts = [[0.2, 0.15], [0.5, 0.35], [0.8, 0.6], [0.5, 0.9]];
          return pts.map(([x, y]) => {
            const d = g.getImageData(Math.round(cv.width * x), Math.round(cv.height * y), 1, 1).data;
            return d[0] + d[1] + d[2];
          });
        }""")
        check('C %s 미리보기 캔버스가 그려졌다' % bg,
              isinstance(ink, list) and len(set(ink)) >= 2 and max(ink) > 60, ink)
        if bg == 'courtnight':
            shot('02_배경_코트야경')
        with page.expect_download(timeout=20000) as dl:
            tap('[data-sc-save]', 400)
        png = OUT + '/v163_card_bg_%s.png' % bg
        dl.value.save_as(png)
        check('C %s 카드 PNG 1080×1350' % bg, Image.open(png).size == sizes['feed'],
              Image.open(png).size)
    shot('03_배경_민턴그라데이션')

    # 비율을 스토리로 → 1080×1920
    tap('#sheet [data-sc-ratio="story"]', 500)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    story_png = OUT + '/v163_card_bg_story.png'
    dl.value.save_as(story_png)
    check('C 스토리 카드 PNG 1080×1920', Image.open(story_png).size == sizes['story'],
          Image.open(story_png).size)
    tap('#sheet [data-sc-ratio="feed"]', 400)

    # ── D. 내 사진 — 사진이 먼저 ──
    check('D 사진 빼기는 사진이 없을 때 숨김', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-photoclear]'); return !b || b.hidden; }"))
    img = OUT + '/v163_upload.png'
    Image.new('RGB', (720, 900), (36, 92, 140)).save(img)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)
    check('D 사진을 고르면 미리보기에 반영된다', page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const g = cv.getContext('2d');
      const d = g.getImageData(Math.round(cv.width * 0.5), Math.round(cv.height * 0.30), 1, 1).data;
      return Math.abs(d[0] - 36) < 90 && Math.abs(d[2] - 140) < 90 && d[2] > d[0];
    }"""))
    check('D 사진이 있으면 "사진 바꾸기" + "사진 빼기"',
          '사진 바꾸기' in text_of(page, '.sc__shot') and has(page, '#sheet [data-sc-photoclear]'))
    check('D 사진이 있으면 "사진 빼기"가 보인다', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-photoclear]'); return !!b && !b.hidden; }"))
    check('D 사진을 고르면 기본 배경 선택은 꺼진다', page.evaluate(
        "() => [...document.querySelectorAll('#sheet [data-sc-bg]')].every(b => b.getAttribute('aria-pressed') === 'false')"))
    check('D 사진 밝기 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet .sc__shadebox'); return !!b && !b.hidden; }"))
    shot('04_내사진_적용')
    tap('#sheet [data-sc-shade="soft"]', 500)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    photo_png = OUT + '/v163_card_photo.png'
    dl.value.save_as(photo_png)
    check('D 내 사진 카드 PNG 1080×1350', Image.open(photo_png).size == sizes['feed'],
          Image.open(photo_png).size)
    tap('#sheet [data-sc-photoclear]', 600)
    check('D 사진 빼면 다시 "사진 넣기"', '사진 넣기' in text_of(page, '.sc__shot'))

    # ── E. 접기 펼침 ──
    tap('#sheet .sc__moresum', 600)
    check('E 접기를 펼치면 열린다', page.evaluate(
        "() => document.querySelector('#sheet .sc__more').open"))
    for sel, label in [('[data-sc-field="gym"]', '체육관 입력'),
                       ('[data-sc-phrase="mintern"]', '문구 칩'),
                       ('[data-sc-pal="court"]', '카드 색 칩')]:
        check('E 펼치면 %s 이 보인다' % label, has(page, '#sheet ' + sel))
    tap('#sheet [data-sc-pal="court"]', 400)
    check('E 카드 색을 바꾸면 미리보기가 바뀐다', page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const g = cv.getContext('2d');
      const d = g.getImageData(Math.round(cv.width * 0.1), Math.round(cv.height * 0.9), 1, 1).data;
      return d[2] > d[0];
    }"""))
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = b.scrollHeight; }")
    page.wait_for_timeout(400)
    shot('05_접기_펼침')
    tap('#sheet .sc__moresum', 400)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 0; }")
    page.wait_for_timeout(300)

    # ── F. 대회 인증 — 핵심 입력은 접기 밖 ──
    tap('#sheet [data-sc-mode="comp"]', 900)
    check('F 대회 인증 탭 전환', page.evaluate("""() => {
      const on = [...document.querySelectorAll('#sheet [data-sc-mode]')]
        .filter(t => t.getAttribute('aria-selected') === 'true')
        .map(t => t.getAttribute('data-sc-mode'));
      return on.length === 1 && on[0] === 'comp';
    }"""))
    check('F 대회명·종목·성적·파트너 입력이 접기 밖에 보인다', page.evaluate("""() => {
      const det = document.querySelector('#sheet .sc__more');
      const detTop = det ? det.getBoundingClientRect().top : 0;
      return ['contest', 'event', 'compPartner'].every(n => {
        const el = document.querySelector('#sheet [data-sc-field="' + n + '"]');
        return !!el && el.getBoundingClientRect().top < detTop;
      }) && !!document.querySelector('#sheet [data-sc-result="우승"]');
    }"""))
    t2 = page.evaluate("""() => [...document.querySelectorAll('#sheet [data-sc-bgthumb]')].map(cv => {
      try {
        const g = cv.getContext('2d');
        const d = g.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 3), 1, 1).data;
        return d[0] + d[1] + d[2] > 30;
      } catch (e) { return false; }
    })""")
    check('F 탭을 바꿔 다시 그려도 배경 썸네일 4개가 그대로',
          isinstance(t2, list) and len(t2) == 4 and all(t2), t2)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.wait_for_timeout(500)
    check('F 대회명이 미리보기에 들어간다', page.evaluate("() => BM.sharecard._state().contest") == '○○시 오픈 배드민턴 대회')
    shot('06_대회인증')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)
    check('F 시트 닫힘', not has(page, '#sheet .sc__canvas'))

    # ── G. 디자인 3종 × 비율 2종 PNG ──
    tap('[data-share-entry="log-hero"]', 1100)
    tap('#sheet [data-sc-bg="courtnight"]', 500)
    for d in ['magazine', 'film', 'sticker']:
        tap('#sheet [data-sc-design="%s"]' % d, 500)
        for r in ['feed', 'story']:
            tap('#sheet [data-sc-ratio="%s"]' % r, 400)
            with page.expect_download(timeout=20000) as dl:
                tap('[data-sc-save]', 300)
            png = OUT + '/v163_card_%s_%s.png' % (d, r)
            dl.value.save_as(png)
            check('G %s · %s 카드 PNG %s' % (d, r, sizes[r]), Image.open(png).size == sizes[r],
                  Image.open(png).size)
        if d == 'sticker':
            shot('07_스티커')
    tap('#sheet [data-sc-design="magazine"]', 400)
    tap('#sheet [data-sc-ratio="feed"]', 400)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)

    # ── H. 라이트 테마 · 360 폭 ──
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); BM.app.repaint(); }")
    page.wait_for_timeout(900)
    tap('[data-share-entry="log-hero"]', 1100)
    lprev = box(page, '.sc__preview', 'sheet')
    lshot = box(page, '.sc__shot', 'sheet')
    check('H 라이트 테마에서도 미리보기·사진 버튼이 한 화면', bool(lprev and lshot and lshot['bottom'] <= 844),
          [lprev, lshot])
    check('H 라이트 테마 가로 넘침 없음', overflow(page)[0] <= overflow(page)[1] + 1, overflow(page))
    shot('08_라이트_시트')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(500)
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_night'); BM.app.repaint(); }")
    page.wait_for_timeout(700)

    # 360 폭
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(600)
    tap('[data-share-entry="log-hero"]', 1100)
    w360 = overflow(page)
    s360 = box(page, '.sc__shot', 'sheet')
    check('H 360 폭에서도 사진 버튼까지 한 화면', bool(s360 and s360['bottom'] <= 780), s360)
    check('H 360 폭 가로 넘침 없음', w360[0] <= w360[1] + 1, w360)
    shot('09_360폭_시트')
    page.evaluate("() => BM.ui.closeSheet()")
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(500)

    # ── I. 다른 화면 보존 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 650)
        w = overflow(page)
        check('I 탭 %s 정상 · 가로 넘침 없음' % tab,
              has(page, "[data-view='%s']" % tab) and w[0] <= w[1] + 1, w)

    check('I 콘솔 오류 0', not errs, errs[:3])
    check('I CSP 위반 0', not csp, csp[:3])

    b.close()

total = len(checks)
passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, total))
if passed != total:
    print('실패:', [n for n, ok_ in checks if not ok_])
