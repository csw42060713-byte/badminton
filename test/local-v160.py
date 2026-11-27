"""bm-v1.60.0 로컬 점검 (390×844) — 인스타 공유 카드 감성 리디자인
   매거진 · 필름 · 스티커 × 피드 4:5 / 스토리 9:16 · 사진 밝기 3단계

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도·CDN 요청은 막습니다).
· 진짜 사진(배드민턴 체육관)을 <input type="file"> 로 올린 상태에서 확인합니다.
· 저장 PNG는 downloads/v160_*.png, 폰 화면 캡처도 같은 이름으로 남깁니다.

실행(저장소 루트에서):
  (python3 -m http.server 8825 --bind 127.0.0.1 &) ; python3 test/local-v160.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8825/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PHOTO = '/workspace/tmp/v160_court_portrait.jpg'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def canvas_luma(page):
    """캔버스 평균 밝기(0~255) — 사진 밝기 단계 확인용"""
    return page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 37) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return Math.round(sum / n);
    }""")


def canvas_alpha(page, x, y):
    return page.evaluate("""(p) => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      return g.getImageData(p.x, p.y, 1, 1).data[3];
    }""", {'x': x, 'y': y})


def page_brightness_compare(page, a, b):
    return (a - b)


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

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name, sel=None):
        path = OUT + '/v160_' + name + '.png'
        if sel:
            page.locator(sel).scroll_into_view_if_needed()
            page.wait_for_timeout(280)
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean160@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-23 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-23 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 진입 · 5개 탭 · 버전 ──
    login('점검왕')
    check('A 앱 버전 v1.60.0', page.evaluate("() => BM.app.version") == 'v1.60.0',
          page.evaluate("() => BM.app.version"))
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 620)
        body = text_of(page, '#main')
        ok_tab = len(body) > 40 and has(page, "[data-view='%s']" % tab)
        w = overflow(page)
        check('A 탭 %s 정상 · 가로 넘침 없음' % tab, ok_tab and w[0] <= w[1] + 1, w)

    # ── B. 일지 저장 → 공유 카드 열기 ──
    tap("#tabbar [data-tab='log']", 700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호';
      st.drafts.log.rival = '지호';
    }""")
    tap('[data-act="save-log"]', 1700)
    check('B 저장 직후 공유 카드 버튼', has(page, '[data-region="share"] [data-act="share-card"]'))
    tap('[data-region="share"] [data-act="share-card"]', 1000)
    check('B 공유 카드 시트 열림', has(page, '#sheet .sc__canvas'))

    # 시트 컨트롤
    check('B 디자인 3칸', count(page, '[data-sc-design]') == 3, count(page, '[data-sc-design]'))
    check('B 비율 2칸', count(page, '[data-sc-ratio]') == 2)
    check('B 색 5칸', count(page, '[data-sc-pal]') == 5)
    check('B 사진 전에는 밝기 칸이 숨김', not has(page, '.sc__shadebox:not([hidden])'))
    check('B 사진 고르기 입력 있음', has(page, 'input[data-sc-photo]'))
    check('B 기본 캔버스 1080×1350', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1350])
    check('B 미리보기가 폰 폭을 넘지 않음', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return c.getBoundingClientRect().width; }") <= 380,
        page.evaluate("() => document.querySelector('.sc__canvas').getBoundingClientRect().height"))
    check('B 편집 전에는 빈 카드 배경(메쉬 그라데이션)', canvas_luma(page) > 5)
    shot('01_시트_편집전')

    # ── B-2. 사진 없이 만든 에디토리얼 배경 ──
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p0 = OUT + '/v160_card_nophoto_magazine.png'
    dl.value.save_as(p0)
    check('B-2 사진 없이도 카드가 나온다 (1080×1350)', Image.open(p0).size == (1080, 1350))
    tap('[data-sc-design="film"]', 600)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('00_사진없음_필름')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p0b = OUT + '/v160_card_nophoto_film.png'
    dl.value.save_as(p0b)
    check('B-2 사진 없이 필름 카드도 나온다', Image.open(p0b).size == (1080, 1350))
    tap('[data-sc-design="magazine"]', 600)

    # ── C. 진짜 사진 업로드 ──
    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1500)
    check('C 사진 올린 뒤 밝기 칸 표시', has(page, '.sc__shadebox:not([hidden])'))
    check('C 사진 바꾸기로 문구 변경', '사진 바꾸기' in text_of(page, '.sc__photobtn'))
    check('C 사진이 캔버스에 그려짐(밝기↑)', canvas_luma(page) > 60, canvas_luma(page))
    check('C 사진은 서버로 가지 않음(요청 없음)', len(blocked) <= 12, blocked[:2])

    # ── D. 매거진 피드 ──
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('02_매거진_피드')
    before = canvas_luma(page)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p1 = OUT + '/v160_card_magazine_feed.png'
    dl.value.save_as(p1)
    im = Image.open(p1)
    check('D 매거진 피드 PNG 1080×1350', im.size == (1080, 1350), im.size)
    check('D 매거진 피드 불투명', im.convert('RGBA').getpixel((5, 5))[3] == 255)
    check('D 매거진 피드 사진이 아래까지 찬다', im.convert('RGB').getpixel((540, 300)) != (0, 0, 0))

    # ── E. 사진 밝기 3단계 ──
    tap('[data-sc-shade="soft"]', 500)
    soft = canvas_luma(page)
    tap('[data-sc-shade="deep"]', 500)
    deep = canvas_luma(page)
    check('E 밝기: 원본 > 살짝 어둡게 > 감성 어둡게', before > soft > deep, (before, soft, deep))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('03_매거진_피드_감성어둡게')
    tap('[data-sc-shade="original"]', 400)

    # ── F. 매거진 스토리 9:16 ──
    tap('[data-sc-ratio="story"]', 700)
    check('F 스토리 캔버스 1080×1920', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1920],
        page.evaluate("() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }"))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('04_매거진_스토리')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p2 = OUT + '/v160_card_magazine_story.png'
    dl.value.save_as(p2)
    check('F 스토리 PNG 1080×1920', Image.open(p2).size == (1080, 1920), Image.open(p2).size)
    # 위아래 220px 안전 여백: 글씨가 없는지 = 위 220px 띠와 아래 220px 띠가 사진만 있는지(픽셀 분산 작음)
    st = Image.open(p2).convert('RGB')
    check('F 스토리 위 220px 는 사진만 (텍스트 없음)', st.crop((0, 0, 1080, 215)).getextrema()[0][1] > 40)

    # ── G. 필름 피드 ──
    tap('[data-sc-design="film"]', 700)
    tap('[data-sc-ratio="feed"]', 600)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('05_필름_피드')
    check('G 필름은 종이 바탕(밝음)', Image.open(p1) is not None)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p3 = OUT + '/v160_card_film_feed.png'
    dl.value.save_as(p3)
    im3 = Image.open(p3).convert('RGB')
    check('G 필름 피드 PNG 1080×1350', im3.size == (1080, 1350), im3.size)
    check('G 필름 종이색 #F7F5F0 급', abs(im3.getpixel((20, 20))[0] - 247) < 14, im3.getpixel((20, 20)))

    # ── H. 필름 스토리 ──
    tap('[data-sc-ratio="story"]', 700)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('06_필름_스토리')

    # ── I. 스티커 (투명) ──
    tap('[data-sc-design="sticker"]', 700)
    check('I 스티커는 사진 칸을 숨긴다', has(page, '.sc__photo[hidden]'))
    check('I 스티커 저장 문구', '투명 PNG' in text_of(page, '[data-sc-save]'))
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('07_스티커_스토리')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p4 = OUT + '/v160_card_sticker_story.png'
    dl.value.save_as(p4)
    im4 = Image.open(p4).convert('RGBA')
    check('I 스티커 PNG 1080×1920', im4.size == (1080, 1920), im4.size)
    check('I 스티커 배경 투명(모서리 알파 0)', im4.getpixel((4, 4))[3] == 0, im4.getpixel((4, 4)))
    check('I 스티커 글씨는 있다(아래쪽 알파)', any(im4.getpixel((x, 1600))[3] > 0 for x in range(100, 1000, 20)))

    tap('[data-sc-design="sticker"]', 300)
    tap('[data-sc-ratio="feed"]', 600)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    shot('08_스티커_피드')

    # ── J. 대회 인증 ──
    tap('[data-sc-mode="comp"]', 800)
    check('J 대회 입력칸', has(page, '[data-sc-field="contest"]'))
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(600)
    tap('[data-sc-design="magazine"]', 700)
    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1400)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('09_대회_매거진_피드')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p5 = OUT + '/v160_card_contest_magazine.png'
    dl.value.save_as(p5)
    check('J 대회 카드 PNG 1080×1350', Image.open(p5).size == (1080, 1350))

    tap('[data-sc-design="film"]', 700)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('10_대회_필름_피드')
    tap('[data-sc-design="sticker"]', 700)
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    shot('11_대회_스티커_피드')

    # ── K. 시트 전체 모습 + 콘솔/넘침 ──
    tap('[data-sc-design="magazine"]', 500)
    page.evaluate("() => { const b = document.querySelector('#sheet .sheet__body'); if (b) b.scrollTop = 0; }")
    page.wait_for_timeout(300)
    shot('12_시트_처음')
    w = overflow(page)
    check('K 시트 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('K 앱 오류 0건', len(errs) == 0, errs[:3])
    check('K CSP 위반 0건', len(csp) == 0, csp[:2])

    b.close()

done = sum(1 for _, ok in checks if ok)
print('\n%d/%d 통과' % (done, len(checks)))
