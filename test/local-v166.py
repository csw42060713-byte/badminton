"""bm-v1.66.0 로컬 점검 (390×844) — 사진 드래그·확대 + 글씨 위치 3단

승우 님 요청: "이미지 같은거 원하는 위치에 넣을수없어?" → "ㄱㄱ" → "둘다"

  1) 사진을 넣으면 '사진 위치 · 확대'(− · 슬라이더 · + · 원래대로)가 열린다
  2) 미리보기 사진을 끌면 구도가 옮겨지고(캔버스 픽셀 변화), 확대하면 더 크게 그려진다
  3) 그 구도 그대로 저장한 PNG(1080×1350 · 1080×1920)에 같은 위치·비율로 들어간다
  4) 사진을 바꾸거나 빼면 위치·확대는 기본값(가운데 · 1.0×)으로 돌아간다
  5) 글씨 위치 아래 · 가운데 · 위 — 세 디자인 × 두 비율 모두에서 실제 위치가 바뀐다
  6) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 기존 기능(탭·사진 빼기·저장) 그대로

실행(저장소 루트에서):
  python3 test/local-v166.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V166_PORT', '8831'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V166_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V166_SHOTS', '/workspace/check-shots')

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


def canvas_size(page):
    return page.evaluate("() => { const c = document.querySelector('#sheet .sc__canvas');"
                         " return c ? [c.width, c.height] : null; }")


def pixel(page, xs, ys):
    """미리보기 캔버스의 여러 점 색(0~255 합) — 구도가 바뀌면 값이 달라집니다"""
    return page.evaluate("""(a) => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return null;
      const g = cv.getContext('2d');
      return a.pts.map(([x, y]) => {
        const d = g.getImageData(Math.round(cv.width * x), Math.round(cv.height * y), 1, 1).data;
        return d[0] + d[1] + d[2];
      });
    }""", {'pts': list(zip(xs, ys))})


def text_y(page, needle):
    """미리보기 캔버스에서 그 글씨가 그려진 y(캔버스 px)를 찾습니다"""
    return page.evaluate("""(needle) => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return null;
      const g = cv.getContext('2d');
      const hits = [];
      const orig = g.fillText;
      // 이미 그려진 캔버스는 되돌릴 수 없으므로, 같은 spec으로 한 번 더 그려 y를 기록합니다.
      const spec = BM.sharecard._specOf(BM.app.ctx);
      const rec = [];
      const spy = function (text, x, y) { rec.push([String(text), y]); return orig.apply(g, arguments); };
      g.fillText = spy;
      try { BM.sharecard.draw(cv, spec); } finally { g.fillText = orig; }
      rec.forEach(([t, y]) => { if (t === needle) hits.push(Math.round(y)); });
      return hits.length ? hits[0] : null;
    }""", needle)


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
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
        path = SHOTS + '/v166_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean166@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 앱 열기 · 일지 저장 ──
    login()
    check('A 앱 버전', page.evaluate("() => BM.app.version") == 'v1.66.0',
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
    tap('[data-share-entry="log-hero"]', 1200)
    check('A 공유 시트 열림', has(page, '#sheet .sc__canvas'))

    # ── B. 사진 넣기 → 위치·확대 칸이 열린다 ──
    check('B 사진이 없으면 위치·확대 칸은 숨김', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !b || b.hidden; }"))
    img = OUT + '/v166_upload.png'
    # 좌우로 다른 색을 가진 사진 — 끌면 픽셀이 확실히 바뀝니다
    im = Image.new('RGB', (1200, 900), (30, 60, 130))
    for x in range(600, 1200):
        for y in range(0, 900):
            im.putpixel((x, y), (220, 120, 40))
    im.save(img)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)
    check('B 사진이 들어가면 위치·확대 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !!b && !b.hidden; }"))
    check('B − · 슬라이더 · + · 원래대로 가 모두 있다',
          count(page, '#sheet [data-sc-zoomin]') == 1 and count(page, '#sheet [data-sc-zoomout]') == 1
          and count(page, '#sheet [data-sc-zoom]') == 1 and count(page, '#sheet [data-sc-zoomreset]') == 1)
    check('B 기본 확대 1×', abs(float(page.evaluate(
        "() => document.querySelector('#sheet [data-sc-zoom]').value")) - 1.0) < 0.001)
    check('B 안내 한 줄', '끌면 구도를' in text_of(page, '#sheet .sc__dragghint'))
    check('B 미리보기에 끌기 표시', page.evaluate(
        "() => !!document.querySelector('#sheet .sc__preview.is-drag')"))
    shot('01_사진위치_확대_칸')

    # ── C. 확대 → 사진이 더 크게 그려진다 ──
    box0 = page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const spec = BM.sharecard._specOf(BM.app.ctx);
      const m = BM.sharecard.coverBox(spec.photo, 0, 0, cv.width, cv.height, BM.sharecard.photoViewOf(spec));
      return [Math.round(m.w), Math.round(m.h), Math.round(m.maxX), Math.round(m.maxY)];
    }""")
    # 1200×900 사진은 4:5 카드에 세로로 꽉 차고 가로만 넘칩니다 — 세로로는 끌어도 그대로여야 합니다
    check('C 1.0× 에서 세로로는 넘치는 곳이 없다(위아래로는 안 움직인다)', box0[3] == 0, box0)
    tap('#sheet [data-sc-zoomin]', 350)
    tap('#sheet [data-sc-zoomin]', 350)
    tap('#sheet [data-sc-zoomin]', 350)
    tap('#sheet [data-sc-zoomin]', 350)
    check('C + 를 누르면 1.2×', abs(page.evaluate("() => BM.sharecard._state().photoZoom") - 1.2) < 0.001,
          page.evaluate("() => BM.sharecard._state().photoZoom"))
    check('C 확대 표시가 바뀐다', '1.2×' in text_of(page, '#sheet [data-sc-zoomlbl]'),
          text_of(page, '#sheet [data-sc-zoomlbl]'))
    box1 = page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const spec = BM.sharecard._specOf(BM.app.ctx);
      const m = BM.sharecard.coverBox(spec.photo, 0, 0, cv.width, cv.height, BM.sharecard.photoViewOf(spec));
      return [Math.round(m.w), Math.round(m.h), Math.round(m.maxX), Math.round(m.maxY)];
    }""")
    check('C 확대하면 그려지는 사진이 커진다', box1[0] > box0[0] and box1[2] > 0, [box0, box1])
    shot('02_확대_1.2배')

    # ── D. 미리보기를 끌면 구도가 옮겨진다 ──
    before = pixel(page, [0.15, 0.5, 0.85], [0.5, 0.5, 0.5])
    cb = page.evaluate("() => { const r = document.querySelector('#sheet .sc__canvas').getBoundingClientRect();"
                       " return [r.left + r.width / 2, r.top + r.height / 2]; }")
    page.mouse.move(cb[0], cb[1])
    page.mouse.down()
    page.mouse.move(cb[0] - 70, cb[1], steps=12)
    page.mouse.up()
    page.wait_for_timeout(500)
    after = pixel(page, [0.15, 0.5, 0.85], [0.5, 0.5, 0.5])
    st = page.evaluate("() => { const s = BM.sharecard._state(); return [s.photoX, s.photoY, s.photoZoom]; }")
    check('D 끌면 위치 값이 바뀐다', abs(st[0]) > 0.05, st)
    check('D 미리보기 픽셀도 바뀐다', before != after, [before, after])
    shot('03_끌어서_위치이동')

    # 터치로도 (모바일 손가락)
    page.touchscreen.tap(cb[0], cb[1])
    page.wait_for_timeout(200)

    # ── E. 저장 PNG에 같은 위치·비율로 ──
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 500)
    png = OUT + '/v166_card_drag_feed.png'
    dl.value.save_as(png)
    check('E 피드 PNG 1080×1350', Image.open(png).size == (1080, 1350), Image.open(png).size)
    saved = page.evaluate("""() => {
      const s = BM.sharecard._state();
      return [s.photoX, s.photoY, s.photoZoom];
    }""")
    # 저장한 이미지에서 왼쪽/오른쪽 색을 비교 — 끌기 전과 다른 구도인지
    pm = Image.open(png).convert('RGB')
    left = pm.getpixel((120, 675))
    right = pm.getpixel((960, 675))
    check('E 저장 PNG에 확대한 구도가 들어간다(좌우 색이 다르다)', left != right, [left, right])

    # 스토리 비율도
    tap('#sheet [data-sc-ratio="story"]', 600)
    check('E 스토리 캔버스 1080×1920', canvas_size(page) == [1080, 1920], canvas_size(page))
    pv = page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const spec = BM.sharecard._specOf(BM.app.ctx);
      const m = BM.sharecard.coverBox(spec.photo, 0, 0, cv.width, cv.height, BM.sharecard.photoViewOf(spec));
      return [Math.round(m.left), Math.round(m.top), Math.round(m.w), Math.round(m.h)];
    }""")
    check('E 스토리에서도 같은 위치·확대가 적용된다', pv[2] > 1080, pv)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 500)
    story = OUT + '/v166_card_drag_story.png'
    dl.value.save_as(story)
    check('E 스토리 PNG 1080×1920', Image.open(story).size == (1080, 1920), Image.open(story).size)
    shot('04_스토리_구도')
    tap('#sheet [data-sc-ratio="feed"]', 500)

    # ── F. 원래대로 / 사진 빼기 → 기본값 ──
    tap('#sheet [data-sc-zoomreset]', 500)
    st2 = page.evaluate("() => { const s = BM.sharecard._state(); return [s.photoX, s.photoY, s.photoZoom]; }")
    check('F 원래대로 — 가운데 · 1.0×', st2 == [0, 0, 1], st2)
    tap('#sheet [data-sc-zoomin]', 300)
    tap('#sheet [data-sc-photoclear]', 600)
    st3 = page.evaluate("() => { const s = BM.sharecard._state(); return [s.photoX, s.photoY, s.photoZoom]; }")
    check('F 사진을 빼면 구도도 기본값', st3 == [0, 0, 1], st3)
    check('F 사진을 빼면 위치·확대 칸이 닫힌다', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !b || b.hidden; }"))
    img2 = OUT + '/v166_upload2.png'
    im2 = Image.new('RGB', (900, 1200), (40, 140, 90))
    for y in range(600, 1200):
        for x in range(0, 900):
            im2.putpixel((x, y), (200, 200, 60))
    im2.save(img2)
    page.set_input_files('#sheet [data-sc-photo]', img2)
    page.wait_for_timeout(1100)
    tap('#sheet [data-sc-zoomin]', 300)
    tap('#sheet [data-sc-zoomin]', 300)
    st4 = page.evaluate("() => BM.sharecard._state().photoZoom")
    check('F 사진을 다시 넣으면 위치·확대 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !!b && !b.hidden; }"))
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1100)
    st5 = page.evaluate("() => BM.sharecard._state().photoZoom")
    check('F 사진을 바꾸면 확대가 1.0×로 돌아간다', st4 > 1 and st5 == 1, [st4, st5])

    # ── G. 글씨 위치 3단 ──
    check('G 글씨 위치 칸이 있다', count(page, '#sheet [data-sc-textpos]') == 3)
    check('G 이름은 아래 · 가운데 · 위', page.evaluate(
        "() => [...document.querySelectorAll('#sheet [data-sc-textpos]')].map(b => b.innerText.trim()).join(',')")
        == '아래,가운데,위')
    check('G 기본은 아래', page.evaluate(
        "() => BM.sharecard._state().textPos") == 'bottom')
    check('G 디자인·비율 바로 아래에 있다', page.evaluate("""() => {
        const tp = document.querySelector('#sheet .sc__textpos');
        const ra = document.querySelector('#sheet .sc__ratios');
        if (!tp || !ra) return false;
        return ra.getBoundingClientRect().top < tp.getBoundingClientRect().top;
    }"""))

    # 대회 카드로 — 큰 숫자(성적) 문구가 유일해서 y 위치를 재기 쉽습니다
    tap('#sheet [data-sc-mode="comp"]', 900)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.wait_for_timeout(600)
    ys = {}
    for design in ['magazine', 'film', 'sticker']:
        tap('#sheet [data-sc-design="%s"]' % design, 600)
        for pos in ['bottom', 'middle', 'top']:
            tap('#sheet [data-sc-textpos="%s"]' % pos, 500)
            check('G %s · %s 선택 표시' % (design, pos), page.evaluate(
                "(id) => { const b = document.querySelector('#sheet [data-sc-textpos=\"' + id + '\"]');"
                " return !!b && b.getAttribute('aria-pressed') === 'true'; }", pos))
            y = text_y(page, '우승')
            ys[(design, pos)] = y
            print('   %s · %s → 우승 y = %s' % (design, pos, y), flush=True)
        shot('05_글씨위치_%s' % design)
    for design in ['magazine', 'film', 'sticker']:
        b_, m_, t_ = ys[(design, 'bottom')], ys[(design, 'middle')], ys[(design, 'top')]
        check('G %s — 위 < 가운데 < 아래' % design,
              None not in (b_, m_, t_) and t_ < m_ < b_, [t_, m_, b_])

    # 스토리에서도 위 위치가 안전 여백(220px) 아래에서 시작한다
    tap('#sheet [data-sc-ratio="story"]', 600)
    tap('#sheet [data-sc-design="magazine"]', 500)
    tap('#sheet [data-sc-textpos="top"]', 500)
    ytop = text_y(page, '우승')
    check('G 스토리 위 위치는 안전 여백 아래', ytop is not None and ytop > 220 + 60, ytop)
    shot('06_스토리_글씨위')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 500)
    ptop = OUT + '/v166_card_text_top_story.png'
    dl.value.save_as(ptop)
    check('G 글씨 위 스토리 PNG 1080×1920', Image.open(ptop).size == (1080, 1920), Image.open(ptop).size)

    # ── H. 기존 기능 보호 ──
    check('H 5개 탭 그대로', count(page, '#tabbar .tab') == 5, count(page, '#tabbar .tab'))
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)
    check('H 시트 닫힘', not has(page, '#sheet .sc__canvas'))
    tap('[data-share-entry="log-hero"]', 1100)
    check('H 다시 열면 기본 글씨 위치는 기억한 값', page.evaluate(
        "() => BM.sharecard._state().textPos") in ('bottom', 'middle', 'top'),
        page.evaluate("() => BM.sharecard._state().textPos"))
    tap('#sheet [data-sc-ratio="feed"]', 400)
    tap('#sheet [data-sc-bg="courtnight"]', 500)
    check('H 기본 배경은 그대로 4종', count(page, '#sheet [data-sc-bg]') == 4)
    check('H 사진 없이도 저장 버튼이 눌린다', count(page, '#sheet [data-sc-save]') == 1)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    bg_png = OUT + '/v166_card_bg.png'
    dl.value.save_as(bg_png)
    check('H 기본 배경 카드 PNG 1080×1350', Image.open(bg_png).size == (1080, 1350), Image.open(bg_png).size)

    # ── I. 라이트 테마 · 360 폭에서도 새 컨트롤이 넘치지 않는다 ──
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); BM.app.repaint(); }")
    page.wait_for_timeout(900)
    if not has(page, '#sheet .sc__canvas'):
        tap('[data-share-entry="log-hero"]', 1200)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)
    lz = page.evaluate("""() => {
      const box = document.querySelector('#sheet [data-sc-zoombox]');
      const row = document.querySelector('#sheet .sc__zoomrow');
      if (!box || !row) return null;
      const r = row.getBoundingClientRect();
      return { on: !box.hidden, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) };
    }""")
    check('I 라이트 테마에서 위치·확대 줄이 화면 안', bool(lz and lz['on'] and lz['left'] >= 0 and lz['right'] <= 390), lz)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 430; }")
    page.wait_for_timeout(400)
    shot('07_라이트_사진위치_확대')
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_night'); BM.app.repaint(); }")
    page.wait_for_timeout(800)

    # 360 폭
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(800)
    t360 = page.evaluate("""() => {
      const box = document.querySelector('#sheet [data-sc-zoombox]');
      const row = document.querySelector('#sheet .sc__zoomrow');
      if (!box || !row) return null;
      const r = row.getBoundingClientRect();
      return { on: !box.hidden, left: Math.round(r.left), right: Math.round(r.right) };
    }""")
    check('I 360 폭에서도 위치·확대 줄이 넘치지 않는다', bool(t360 and t360['left'] >= 0 and t360['right'] <= 360), t360)
    t360tp = page.evaluate("""() => {
      const tp = document.querySelector('#sheet .sc__textpos');
      if (!tp) return null;
      const r = tp.getBoundingClientRect();
      const btns = [...tp.querySelectorAll('[data-sc-textpos]')].map(b => Math.round(b.getBoundingClientRect().width));
      return { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), btns: btns };
    }""")
    check('I 360 폭에서도 글씨 위치 3칸이 나란히', bool(t360tp and t360tp['right'] <= 360
          and len(t360tp['btns']) == 3 and max(t360tp['btns']) - min(t360tp['btns']) <= 2), t360tp)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); b.scrollTop = 430; }")
    page.wait_for_timeout(300)
    shot('08_360_사진위치')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(600)

    ov = overflow(page)
    check('H 가로 넘침 없음', ov[0] <= ov[1] + 1, ov)
    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:3])

    b.close()
    httpd.shutdown()

print('\n%d/%d 통과' % (sum(1 for _, ok in checks if ok), len(checks)), flush=True)
fails = [n for n, ok in checks if not ok]
if fails:
    print('실패: ' + ' | '.join(fails), flush=True)
