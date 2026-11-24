"""bm-v1.66.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.66.0 (sw.js · app.js) · 5개 탭 그대로
  2) 사진을 넣으면 '사진 위치 · 확대'(− · 슬라이더 · + · 원래대로)가 열린다
  3) + 로 확대 → 미리보기 픽셀 변화 · 저장 PNG 1080×1350 에도 같은 구도
  4) 미리보기를 끌면 위치 값과 캔버스 픽셀이 바뀐다 · '원래대로'로 복구
  5) 글씨 위치 아래 → 가운데 → 위 로 옮기면 캔버스 위/아래 픽셀이 바뀐다
  6) 스토리 1080×1920 · 라이트 테마 · 360 폭 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0

실행(저장소 루트에서):
  python3 test/live-v166.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def band(page, ys):
    """미리보기 캔버스의 가로 줄 평균 밝기 — 글씨가 있으면 그 줄이 어두워지거나 밝아집니다"""
    return page.evaluate("""(ys) => {
      const cv = document.querySelector('#sheet .sc__canvas');
      if (!cv) return null;
      const g = cv.getContext('2d');
      return ys.map((y) => {
        const d = g.getImageData(0, Math.round(cv.height * y), cv.width, 1).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
        return Math.round(sum / (d.length / 4));
      });
    }""", ys)


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
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
        if 'net::ERR_' in m.text:
            return
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v166_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    # ── A. 라이브 버전 ──
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(900)
    sw = page.evaluate("async () => (await fetch('sw.js', {cache: 'reload'})).text()")
    check('A 라이브 sw.js bm-v1.66.0', "var VERSION = 'bm-v1.66.0'" in sw, sw[:120].replace('\n', ' '))
    page.evaluate("""() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live166@example.com',
        name: '라이브점검', at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
        profile: { nick: '라이브점검', level: 'B조', discipline: '복식', region: '경기', club: '나래울',
                   onboardedAt: '2026-11-24 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    check('A 앱 버전 v1.66.0', page.evaluate("() => BM.app.version") == 'v1.66.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 일지 저장 → 공유 시트 ──
    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호'; st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1900)
    check('B 일지 저장', page.evaluate("() => (BM.app.ctx.store.state.data.records || []).length") >= 1)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    tap('[data-share-entry="log-hero"]', 1300)
    check('B 공유 시트 열림', has(page, '#sheet .sc__canvas'))

    # ── C. 사진 · 위치·확대 ──
    img = OUT + '/v166_live_upload.png'
    im = Image.new('RGB', (1200, 900), (30, 60, 130))
    for x in range(600, 1200):
        for y in range(0, 900):
            im.putpixel((x, y), (220, 120, 40))
    im.save(img)
    check('C 사진 전에는 위치·확대 칸 숨김', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !b || b.hidden; }"))
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1400)
    check('C 사진을 넣으면 위치·확대 칸이 열린다', page.evaluate(
        "() => { const b = document.querySelector('#sheet [data-sc-zoombox]'); return !!b && !b.hidden; }"))
    check('C − · 슬라이더 · + · 원래대로', count(page, '#sheet [data-sc-zoomin]') == 1
          and count(page, '#sheet [data-sc-zoomout]') == 1 and count(page, '#sheet [data-sc-zoom]') == 1
          and count(page, '#sheet [data-sc-zoomreset]') == 1)
    shot('01_사진위치_확대')

    before = band(page, [0.5])
    for _ in range(4):
        tap('#sheet [data-sc-zoomin]', 250)
    zoom = page.evaluate("() => BM.sharecard._state().photoZoom")
    check('C + 네 번 = 1.2×', abs(zoom - 1.2) < 0.001, zoom)
    box_w = page.evaluate("""() => {
      const cv = document.querySelector('#sheet .sc__canvas');
      const spec = BM.sharecard._specOf(BM.app.ctx);
      return Math.round(BM.sharecard.coverBox(spec.photo, 0, 0, cv.width, cv.height,
                                             BM.sharecard.photoViewOf(spec)).w);
    }""")
    check('C 확대하면 그려지는 사진이 커진다', box_w > 1800, box_w)

    # 끌기
    cb = page.evaluate("() => { const r = document.querySelector('#sheet .sc__canvas').getBoundingClientRect();"
                       " return [r.left + r.width / 2, r.top + r.height / 2]; }")
    page.mouse.move(cb[0], cb[1])
    page.mouse.down()
    page.mouse.move(cb[0] - 70, cb[1], steps=12)
    page.mouse.up()
    page.wait_for_timeout(500)
    px = page.evaluate("() => BM.sharecard._state().photoX")
    after = band(page, [0.5])
    check('C 끌면 위치 값이 바뀐다', abs(px) > 0.05, px)
    check('C 미리보기 픽셀도 바뀐다', before != after, [before, after])
    shot('02_끌어서_위치이동')

    # 저장 PNG 에 같은 구도
    with page.expect_download(timeout=30000) as dl:
        tap('[data-sc-save]', 700)
    png = OUT + '/v166_live_card_drag.png'
    dl.value.save_as(png)
    check('C 저장 PNG 1080×1350', Image.open(png).size == (1080, 1350), Image.open(png).size)
    pm = Image.open(png).convert('RGB')
    check('C 저장 PNG 좌우 색이 다르다(구도 반영)', pm.getpixel((120, 675)) != pm.getpixel((960, 675)),
          [pm.getpixel((120, 675)), pm.getpixel((960, 675))])

    tap('#sheet [data-sc-zoomreset]', 500)
    st = page.evaluate("() => { const s = BM.sharecard._state(); return [s.photoX, s.photoY, s.photoZoom]; }")
    check('C 원래대로 — 가운데 · 1.0×', st == [0, 0, 1], st)

    # ── D. 글씨 위치 3단 ──
    tap('#sheet [data-sc-photoclear]', 600)
    tap('#sheet [data-sc-bg="sunsetcourt"]', 600)
    check('D 글씨 위치 3칸', count(page, '#sheet [data-sc-textpos]') == 3)
    check('D 이름 아래 · 가운데 · 위', page.evaluate(
        "() => [...document.querySelectorAll('#sheet [data-sc-textpos]')].map(b => b.innerText.trim()).join(',')")
        == '아래,가운데,위')
    ys = {}
    for pos in ['bottom', 'middle', 'top']:
        tap('#sheet [data-sc-textpos="%s"]' % pos, 700)
        ys[pos] = page.evaluate("""() => {
          const cv = document.querySelector('#sheet .sc__canvas');
          const g = cv.getContext('2d');
          const spec = BM.sharecard._specOf(BM.app.ctx);
          const rows = [];
          const orig = g.fillText;
          g.fillText = function (t, x, y) { rows.push([String(t), y]); return orig.apply(g, arguments); };
          try { BM.sharecard.draw(cv, spec); } finally { g.fillText = orig; }
          const hit = rows.filter(r => r[0] === '90')[0];
          return hit ? Math.round(hit[1]) : null;
        }""")
        check('D %s 글씨 위치 선택 표시' % pos, page.evaluate(
            "(id) => { const b = document.querySelector('#sheet [data-sc-textpos=\"' + id + '\"]');"
            " return !!b && b.getAttribute('aria-pressed') === 'true'; }", pos))
        print('   %s → 90 y = %s' % (pos, ys[pos]), flush=True)
    check('D 위 < 가운데 < 아래', None not in ys.values() and ys['top'] < ys['middle'] < ys['bottom'], ys)
    shot('03_글씨위치_위')
    with page.expect_download(timeout=30000) as dl:
        tap('[data-sc-save]', 700)
    top_png = OUT + '/v166_live_card_text_top.png'
    dl.value.save_as(top_png)
    check('D 글씨 위 카드 PNG 1080×1350', Image.open(top_png).size == (1080, 1350), Image.open(top_png).size)

    # 스토리
    tap('#sheet [data-sc-ratio="story"]', 700)
    check('D 스토리 캔버스 1080×1920', page.evaluate(
        "() => { const c = document.querySelector('#sheet .sc__canvas'); return [c.width, c.height]; }") == [1080, 1920])
    with page.expect_download(timeout=30000) as dl:
        tap('[data-sc-save]', 700)
    story = OUT + '/v166_live_card_text_top_story.png'
    dl.value.save_as(story)
    check('D 스토리 PNG 1080×1920', Image.open(story).size == (1080, 1920), Image.open(story).size)
    tap('#sheet [data-sc-ratio="feed"]', 500)

    # ── E. 라이트 테마 · 360 폭 · 오류 0 ──
    tap('#sheet [data-sc-design="film"]', 500)
    tap('#sheet [data-sc-textpos="middle"]', 500)
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_def'); BM.app.repaint(); }")
    page.wait_for_timeout(900)
    page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 200; }")
    page.wait_for_timeout(300)
    shot('04_라이트_글씨가운데')
    page.evaluate("() => { BM.app.ctx.store.actions.setTheme('th_night'); BM.app.repaint(); }")
    page.wait_for_timeout(700)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(700)
    tp360 = page.evaluate("""() => {
      const tp = document.querySelector('#sheet .sc__textpos');
      if (!tp) return null;
      const r = tp.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    }""")
    check('E 360 폭에서 글씨 위치가 넘치지 않는다', bool(tp360 and tp360['right'] <= 360), tp360)
    ov = overflow(page)
    check('E 가로 넘침 없음', ov[0] <= ov[1] + 1, ov)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(500)
    shot('05_360_시트')

    check('E 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:3])

    b.close()

print('\n%d/%d 통과' % (sum(1 for _, ok in checks if ok), len(checks)), flush=True)
fails = [n for n, ok in checks if not ok]
if fails:
    print('실패: ' + ' | '.join(fails), flush=True)
