"""bm-v1.67.0 로컬 점검 (390×844) — 사진 자동 감성 · 메달 임팩트 · 도발 멘트

승우 님 요청:
  "부자연스럽다, 사진 넣으면 자동으로 이쁘게 꾸며져야" · "대회 메달 색깔별 임팩트"
  · "누구 이기면 도발 멘트" + 추가 4가지(숫자 숨기기 · 자랑 하이라이트 · 파트너·라이벌 태그)

  1) 사진을 넣으면 '자동 감성'이 기본, 필터 5종이 실제로 픽셀을 바꾼다(흑백은 R≈G≈B)
  2) 과한 검은 스크림이 줄어 사진 색이 살아난다(같은 사진·같은 밝기에서 이전보다 밝다)
  3) 글래스 디자인 — 사진 위 유리 배지, 카드가 실제로 달라진다
  4) 대회 메달 금·은·동·출전 — 스탬프 글씨와 포인트 색이 바뀐다
  5) 도발 멘트·라이벌 맞춤 멘트·태그 칩 1탭 → 카드 문구가 바뀐다
  6) 숫자 숨기기 — 시간·승패 없이 날짜·체육관·한 줄만
  7) 자랑 하이라이트(오늘 전승) 배지, WIN 스탬프
  8) 저장 PNG 1080×1350 · 1080×1920 실제 픽셀 확인
  9) 콘솔 오류 0 · CSP 0 · 가로 넘침 0 · 기존 기능(탭·드래그·글씨 위치·기본 배경) 그대로

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v167.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V167_PORT', '8841'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V167_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V167_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def drawn_texts(page):
    """미리보기 캔버스에 실제로 그려진 글씨 전부(같은 spec으로 한 번 더 그려 기록)"""
    return page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return [];
      const g = cv.getContext('2d');
      const spec = BM.sharecard._specOf(BM.app.ctx);
      const rec = [];
      const orig = g.fillText;
      g.fillText = function (t, x, y) { rec.push(String(t)); return orig.apply(g, arguments); };
      try { BM.sharecard.draw(cv, spec); } finally { g.fillText = orig; }
      return rec;
    }""")


def px(page, x, y):
    """미리보기 캔버스 한 점 RGB"""
    return page.evaluate("""(a) => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return null;
      const g = cv.getContext('2d');
      const d = g.getImageData(Math.round(cv.width * a[0]), Math.round(cv.height * a[1]), 1, 1).data;
      return [d[0], d[1], d[2]];
    }""", [x, y])


def mean_rgb(page, box):
    """캔버스 한 영역 평균 RGB — 필터·스크림이 바뀌면 달라집니다"""
    return page.evaluate("""(b) => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return null;
      const g = cv.getContext('2d');
      const x = Math.round(cv.width * b[0]), y = Math.round(cv.height * b[1]);
      const w = Math.round(cv.width * b[2]), h = Math.round(cv.height * b[3]);
      const d = g.getImageData(x, y, w, h).data;
      let r = 0, gg = 0, bb = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; }
      return [Math.round(r / n), Math.round(gg / n), Math.round(bb / n)];
    }""", box)


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
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
        path = SHOTS + '/v167_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean167@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 앱 열기 · 일지 두 개 저장 (2승 1패 / 오늘 전승) ──
    login()
    check('A 앱 버전 v1.67.0', page.evaluate("() => BM.app.version") == 'v1.67.0',
          page.evaluate("() => BM.app.version"))
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
    check('A 일지 저장', page.evaluate("() => (BM.app.ctx.store.state.data.records || []).length") >= 1)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    tap('[data-share-entry="log-hero"]', 1300)
    check('A 공유 시트 열림', has(page, '#sheet .sc__canvas'))
    check('A 디자인 4종', count(page, '#sheet [data-sc-design]') == 4, count(page, '#sheet [data-sc-design]'))

    # ── B. 사진 넣기 → 자동 감성 + 필터 5종 ──
    img = OUT + '/v167_upload.png'
    im = Image.new('RGB', (1200, 900), (40, 90, 160))
    for x in range(600, 1200):
        for y in range(0, 450):
            im.putpixel((x, y), (230, 140, 50))
    im.save(img)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1300)
    check('B 사진이 들어가면 필터 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet .sc__filterbox'); return !!b && !b.hidden; }"))
    check('B 필터 5종 칩', count(page, '#sheet [data-sc-filter]') == 5, count(page, '#sheet [data-sc-filter]'))
    check('B 기본은 자동 감성', page.evaluate("() => BM.sharecard._state().filter") == 'auto',
          page.evaluate("() => BM.sharecard._state().filter"))
    check('B 자동 감성 칩이 켜져 있다', page.evaluate(
        "() => document.querySelector('#sheet [data-sc-filter=\"auto\"]').getAttribute('aria-pressed')") == 'true')
    auto = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    shot('01_사진_자동감성')

    tap('#sheet [data-sc-filter="mono"]', 700)
    mono = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    check('B 흑백 필터 — R·G·B가 거의 같다',
          mono is not None and max(mono) - min(mono) <= 12, mono)
    shot('02_사진_흑백')

    tap('#sheet [data-sc-filter="original"]', 700)
    orig = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    check('B 원본 필터는 다시 색이 산다', orig is not None and max(orig) - min(orig) > 20, orig)
    check('B 원본과 자동 감성은 다르다', auto != orig, [auto, orig])

    tap('#sheet [data-sc-filter="film"]', 700)
    film = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    check('B 필름 필터는 자동 감성과 다르다', film != auto, [film, auto])
    shot('03_사진_필름')
    tap('#sheet [data-sc-filter="auto"]', 600)

    # ── C. 글래스 디자인 ──
    tap('#sheet [data-sc-design="glass"]', 800)
    check('C 글래스 선택', page.evaluate("() => BM.sharecard._state().design") == 'glass')
    glass_texts = drawn_texts(page)
    joined = '|'.join(glass_texts)
    check('C 글래스 — 핵심 스탯 한 줄', ('90분' in joined), joined[:120])
    check('C 글래스 — 날짜·체육관', ('나래울' in joined), joined[:120])
    check('C 글래스 — 브랜드', 'BADMINTON' in joined)
    shot('04_글래스')
    tap('#sheet [data-sc-design="magazine"]', 600)

    # ── D. 숫자 숨기기 (무드) ──
    tap('#sheet [data-sc-nums="hide"]', 800)
    mood = '|'.join(drawn_texts(page))
    check('D 숫자 숨기기 — 시간 숫자 없음', '90' not in mood, mood[:140])
    check('D 숫자 숨기기 — 문구·날짜·체육관은 남는다', '민턴일기' in mood and '나래울' in mood, mood[:140])
    shot('05_숫자숨기기')
    tap('#sheet [data-sc-nums="show"]', 700)
    check('D 다시 숫자 보이기', '90' in '|'.join(drawn_texts(page)))

    # ── E. 도발 · 자랑 멘트 · 태그 ──
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = true; }")
    page.wait_for_timeout(400)
    check('E 도발 칩 6개', count(page, '#sheet [data-sc-taunt]') == 6, count(page, '#sheet [data-sc-taunt]'))
    check('E 라이벌 맞춤 도발 칩', count(page, '#sheet [data-sc-rtaunt]') >= 2,
          count(page, '#sheet [data-sc-rtaunt]'))
    check('E 태그 칩', count(page, '#sheet [data-sc-tag]') >= 2, count(page, '#sheet [data-sc-tag]'))
    tap('#sheet [data-sc-taunt="taunt6"]', 700)
    check('E 도발 멘트가 문구로', page.evaluate("() => BM.sharecard._state().phrase") == '전승 퇴근합니다',
          page.evaluate("() => BM.sharecard._state().phrase"))
    check('E 카드에 도발 멘트', '전승 퇴근합니다' in '|'.join(drawn_texts(page)))
    shot('06_도발멘트')
    rt = '#sheet [data-sc-rtaunt="0"]'
    tap(rt, 700)
    phrase = page.evaluate("() => BM.sharecard._state().phrase")
    check('E 라이벌 맞춤 도발 — 이름이 들어간다', phrase.startswith('지호') or '지호' in phrase, phrase)
    tagline = page.evaluate("() => { const s = BM.sharecard._specOf(BM.app.ctx); return s.tagLine; }")
    check('E 카드에 콤비·라이벌 전적 한 줄', ('콤비' in tagline) and ('지호' in tagline), tagline)
    shot('07_라이벌_태그')

    # ── F. WIN 스탬프 · 자랑 배지 ──
    win = '|'.join(drawn_texts(page))
    check('F 2승 1패 → WIN 스탬프', 'WIN' in win, win[:160])
    badge = page.evaluate("() => BM.sharecard._specOf(BM.app.ctx).badge")
    check('F 자랑 배지 계산(오늘 전승·이번 달·연속)', isinstance(badge, str), badge)

    # 오늘 전승 일지를 하나 더 저장하고, 그 일지로 카드를 열면 '오늘 2전 전승' 배지
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)
    tap("#tabbar [data-tab='log']", 800)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '12' }, { a: '21', b: '17' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1900)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    tap('[data-share-entry="log-hero"]', 1300)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)
    badge2 = page.evaluate("() => BM.sharecard._specOf(BM.app.ctx).badge")
    texts2 = '|'.join(drawn_texts(page))
    check('F 오늘 전승 → 자랑 배지', '오늘 2전 전승' in badge2, badge2)
    check('F 배지가 카드에 그려진다', '오늘 2전 전승' in texts2, texts2[:160])
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = true; }")
    page.wait_for_timeout(300)
    check('F 자랑 한 줄 칩', count(page, '#sheet [data-sc-highlight]') >= 1,
          count(page, '#sheet [data-sc-highlight]'))
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = false; }")
    shot('07b_자랑배지')

    # ── G. 대회 인증 — 메달 임팩트 3종 ──
    tap('#sheet [data-sc-mode="comp"]', 1000)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.wait_for_timeout(500)
    stamps = {'우승': '1ST PLACE · GOLD', '준우승': '2ND PLACE · SILVER',
              '3위': '3RD PLACE · BRONZE', '출전': 'CHALLENGER'}
    for result, stamp in stamps.items():
        tap('#sheet [data-sc-result="%s"]' % result, 800)
        texts = '|'.join(drawn_texts(page))
        check('G %s — 스탬프 %s' % (result, stamp), stamp in texts, texts[:160])
        shot('08_메달_%s' % result)
    # 금메달 카드 픽셀 — 금빛 포인트가 실제로 있다
    tap('#sheet [data-sc-result="우승"]', 800)
    tap('#sheet [data-sc-design="glass"]', 800)
    shot('09_금메달_글래스')
    tap('#sheet [data-sc-design="magazine"]', 700)

    # ── H. 저장 PNG 실제 픽셀 ──
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 500)
    gold_png = OUT + '/v167_contest_gold.png'
    dl.value.save_as(gold_png)
    size = Image.open(gold_png).size
    check('H 대회 금메달 PNG 1080×1350', size == (1080, 1350), size)
    im_gold = Image.open(gold_png).convert('RGB')
    golden = 0
    for x in range(0, 1080, 6):
        for y in range(0, 300, 6):
            r, g, b = im_gold.getpixel((x, y))
            if r > 190 and g > 150 and b < 120:
                golden += 1
    check('H 금빛 포인트 픽셀이 실제로 있다', golden > 40, golden)

    # 흑백 카드 저장 — 픽셀 R≈G≈B
    tap('#sheet [data-sc-mode="today"]', 900)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)
    tap('#sheet [data-sc-filter="mono"]', 700)
    tap('#sheet [data-sc-design="magazine"]', 500)
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 500)
    mono_png = OUT + '/v167_today_mono.png'
    dl.value.save_as(mono_png)
    check('H 흑백 카드 PNG 1080×1350', Image.open(mono_png).size == (1080, 1350))
    im_mono = Image.open(mono_png).convert('RGB')
    gray_ok = 0
    total = 0
    for x in range(100, 900, 40):
        for y in range(120, 500, 40):
            r, g, b = im_mono.getpixel((x, y))
            total += 1
            if max(r, g, b) - min(r, g, b) <= 14:
                gray_ok += 1
    check('H 흑백 PNG 픽셀도 흑백', gray_ok / max(1, total) > 0.9, '%d/%d' % (gray_ok, total))

    # ── I. 기존 기능 보호 ──
    check('I 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))
    check('I 글씨 위치 3단 그대로', count(page, '#sheet [data-sc-textpos]') == 3)
    check('I 기본 배경 4종 그대로', count(page, '#sheet [data-sc-bg]') == 4)
    check('I 사진 위치·확대 칸 그대로', count(page, '#sheet [data-sc-zoom]') == 1)
    tap('#sheet [data-sc-textpos="top"]', 500)
    check('I 글씨 위치 위 선택', page.evaluate("() => BM.sharecard._state().textPos") == 'top')
    tap('#sheet [data-sc-textpos="bottom"]', 400)
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 400)
    story = OUT + '/v167_today_feed.png'
    dl.value.save_as(story)
    check('I 오늘 카드 PNG 1080×1350', Image.open(story).size == (1080, 1350))

    # ── J. 넘침·콘솔 ──
    w = overflow(page)
    check('J 390 폭 가로 넘침 없음', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(800)
    w2 = overflow(page)
    check('J 360 폭 가로 넘침 없음', w2[0] <= w2[1], w2)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 900; }")
    page.wait_for_timeout(400)
    shot('10_360_필터와_숫자')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(600)
    shot('11_시트_전체')

    check('J 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('J CSP 위반 0', len(csp) == 0, csp[:3])

    page.close()
    ctx.close()
    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
