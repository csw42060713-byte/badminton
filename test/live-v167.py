"""bm-v1.67.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.67.0 (sw.js · app.js) · 5개 탭 그대로
  2) 사진을 넣으면 필터 5종이 열리고 자동 감성이 기본 · 흑백은 R≈G≈B · 원본은 색이 살아난다
  3) 글래스 디자인 카드에 핵심 스탯·셀틀콕·브랜드가 그려진다
  4) 대회 메달 4종 스탬프(1ST/2ND/3RD PLACE · CHALLENGER)가 바뀐다
  5) 도발 멘트·라이벌 맞춤 도발 칩 1탭 → 카드 문구가 바뀐다
  6) 숫자 숨기기 — 시간 숫자 없이 문구·날짜만
  7) 저장 PNG 1080×1350 실제 픽셀(흑백 카드) 확인
  8) 360 폭 · 라이트 테마 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0

실행(저장소 루트에서):
  python3 test/live-v167.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
SHOTS = '/workspace/check-shots'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def mean_rgb(page, box):
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


def drawn_texts(page):
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
        path = SHOTS + '/v167_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        const s = { kind: 'email', email: 'live167@example.com', name: '라이브점검',
                    at: new Date().toISOString(), onboardedAt: '2026-11-24 12:00:00',
                    profile: { nick: '라이브점검', level: 'B조', discipline: '복식', region: '경기',
                               club: '나래울체육관', onboardedAt: '2026-11-24 12:00:00' } };
        localStorage.setItem('bm_auth_v1', JSON.stringify(s));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    check('A 라이브 버전 v1.67.0', page.evaluate("() => BM.app.version") == 'v1.67.0',
          page.evaluate("() => BM.app.version"))
    check('A 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))

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
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    tap('[data-share-entry="log-hero"]', 1400)
    check('A 공유 시트 열림', has(page, '#sheet .sc__canvas'))
    check('A 디자인 4종', count(page, '#sheet [data-sc-design]') == 4)

    img = OUT + '/v167_live_upload.png'
    im = Image.new('RGB', (1200, 900), (40, 90, 160))
    for x in range(600, 1200):
        for y in range(0, 450):
            im.putpixel((x, y), (230, 140, 50))
    im.save(img)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1400)
    check('B 필터 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet .sc__filterbox'); return !!b && !b.hidden; }"))
    check('B 필터 5종 · 기본 자동 감성',
          count(page, '#sheet [data-sc-filter]') == 5 and
          page.evaluate("() => BM.sharecard._state().filter") == 'auto')
    auto = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    tap('#sheet [data-sc-filter="mono"]', 800)
    mono = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    check('B 라이브 흑백 R≈G≈B', mono is not None and max(mono) - min(mono) <= 12, mono)
    tap('#sheet [data-sc-filter="original"]', 700)
    orig = mean_rgb(page, [0.05, 0.30, 0.20, 0.15])
    check('B 라이브 원본은 색이 산다', orig is not None and max(orig) - min(orig) > 20, orig)
    check('B 자동 감성과 원본이 다르다', auto != orig, [auto, orig])
    shot('01_필터')

    tap('#sheet [data-sc-design="glass"]', 900)
    t = '|'.join(drawn_texts(page))
    check('C 글래스 — 핵심 스탯', '90분' in t, t[:140])
    check('C 글래스 — 브랜드', 'BADMINTON' in t)
    shot('02_글래스')
    tap('#sheet [data-sc-design="magazine"]', 600)

    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = true; }")
    page.wait_for_timeout(400)
    check('E 도발 칩 6개 · 라이벌 맞춤 칩', count(page, '#sheet [data-sc-taunt]') == 6 and
          count(page, '#sheet [data-sc-rtaunt]') >= 2)
    tap('#sheet [data-sc-taunt="taunt6"]', 700)
    check('E 도발 멘트가 문구로', page.evaluate("() => BM.sharecard._state().phrase") == '전승 퇴근합니다')
    check('E 카드에 도발 멘트', '전승 퇴근합니다' in '|'.join(drawn_texts(page)))
    tap('#sheet [data-sc-rtaunt="0"]', 700)
    check('E 라이벌 맞춤 도발', '지호' in page.evaluate("() => BM.sharecard._state().phrase"))
    check('E 전적 한 줄', '콤비' in (page.evaluate("() => BM.sharecard._specOf(BM.app.ctx).tagLine") or ''))
    shot('03_도발')
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = false; }")
    page.wait_for_timeout(300)

    tap('#sheet [data-sc-nums="hide"]', 800)
    mood = '|'.join(drawn_texts(page))
    check('D 숫자 숨기기 — 90 없음', '90' not in mood, mood[:140])
    check('D 숫자 숨기기 — 문구·날짜 남는다', '나래울' in mood, mood[:140])
    shot('04_숫자숨기기')
    tap('#sheet [data-sc-nums="show"]', 700)

    tap('#sheet [data-sc-mode="comp"]', 1000)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.wait_for_timeout(500)
    for result, stamp in [('우승', '1ST PLACE · GOLD'), ('준우승', '2ND PLACE · SILVER'),
                          ('3위', '3RD PLACE · BRONZE'), ('출전', 'CHALLENGER')]:
        tap('#sheet [data-sc-result="%s"]' % result, 800)
        check('G %s 스탬프' % result, stamp in '|'.join(drawn_texts(page)))
    tap('#sheet [data-sc-result="우승"]', 700)
    shot('05_금메달')

    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 500)
    live_png = OUT + '/v167_live_contest_gold.png'
    dl.value.save_as(live_png)
    check('H 라이브 PNG 1080×1350', Image.open(live_png).size == (1080, 1350), Image.open(live_png).size)

    # 흑백 오늘 카드 저장
    tap('#sheet [data-sc-mode="today"]', 900)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1300)
    tap('#sheet [data-sc-filter="mono"]', 700)
    with page.expect_download(timeout=25000) as dl:
        tap('[data-sc-save]', 500)
    live_mono = OUT + '/v167_live_today_mono.png'
    dl.value.save_as(live_mono)
    im_mono = Image.open(live_mono).convert('RGB')
    gray, total = 0, 0
    for x in range(100, 900, 40):
        for y in range(120, 500, 40):
            r, g, b = im_mono.getpixel((x, y))
            total += 1
            if max(r, g, b) - min(r, g, b) <= 14:
                gray += 1
    check('H 라이브 흑백 PNG', Image.open(live_mono).size == (1080, 1350) and gray / max(1, total) > 0.9,
          '%d/%d' % (gray, total))

    w = overflow(page)
    check('J 390 폭 넘침 없음', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(900)
    w2 = overflow(page)
    check('J 360 폭 넘침 없음', w2[0] <= w2[1], w2)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 700; }")
    page.wait_for_timeout(400)
    shot('06_360')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(500)

    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); BM.app.repaint(); }")
    page.wait_for_timeout(900)
    if not has(page, '#sheet .sc__canvas'):
        tap('[data-share-entry="log-hero"]', 1200)
    tap('#sheet [data-sc-design="glass"]', 800)
    shot('07_라이트_글래스')
    check('J 라이트 테마에서도 글래스 카드', has(page, '#sheet .sc__canvas'))

    check('J 앱 오류 0', len(errs) == 0, errs[:3])
    check('J CSP 위반 0', len(csp) == 0, csp[:3])

    page.close()
    ctx.close()
    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
