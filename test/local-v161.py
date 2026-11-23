"""bm-v1.61.0 로컬 점검 (390×844) — 인스타 카드 문구 프리셋 · 직접 입력

  1) '오운완'이 화면 어디에도 고정 표기로 없다 (MY 메뉴 줄은 '민턴일기 · 대회 인증')
  2) 카드 문구 칸 — 프리셋 5종 + '직접 쓰기', 1탭으로 미리보기·PNG에 반영
  3) 직접 쓴 문구가 매거진 · 필름 · 스티커 셋 다에 들어간다 (피드 · 스토리)
  4) 대회 카드도 제목을 바꾼다
  5) 마지막에 고른 디자인 · 문구가 다시 열어도 남는다(localStorage)
  6) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0

실행(저장소 루트에서):
  (python3 -m http.server 8827 --bind 127.0.0.1 &) ; python3 test/local-v161.py
"""

import os

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8827/'
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


def canvas_texts(page):
    """현재 카드 미리보기에서 그려진 글씨 목록은 캔버스에서 읽을 수 없으므로,
    대신 상태(spec)의 문구와 캔버스 픽셀로 확인합니다."""
    return page.evaluate("() => { const s = BM.sharecard._state(); return { phrase: s.phrase, phraseComp: s.phraseComp }; }")


def ink_rows(page, y0, y1):
    """캔버스 y0~y1 띠에서 글씨(밝은 픽셀)가 있는지 — 제목이 그 자리에 그려졌는지 확인용"""
    return page.evaluate("""(p) => {
      const c = document.querySelector('.sc__canvas');
      const g = c.getContext('2d');
      const d = g.getImageData(0, p.y0, c.width, Math.max(1, p.y1 - p.y0)).data;
      let bright = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200 && d[i + 3] > 120) bright++;
      }
      return bright;
    }""", {'y0': y0, 'y1': y1})


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

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name, sel='#sheet .sc__preview'):
        if sel and has(page, sel):
            page.locator(sel).scroll_into_view_if_needed()
            page.wait_for_timeout(320)
        path = OUT + '/v161_' + name + '.png'
        page.screenshot(path=path)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean161@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-23 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-23 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 버전 · MY 메뉴 줄 ──
    login()
    check('A 앱 버전 v1.61.0', page.evaluate("() => BM.app.version") == 'v1.61.0',
          page.evaluate("() => BM.app.version"))

    # 카드에 숫자가 들어가도록 일지 하나 저장 (사진 없이 · 이 기기에만)
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
    check('A 일지 저장(카드에 숫자가 들어감)', page.evaluate(
        "() => (BM.app.ctx.store.state.data.records || []).length") >= 1)

    tap("#tabbar [data-tab='my']", 700)
    my = text_of(page, '#main')
    check('A MY 메뉴 줄이 턴일기 · 대회 인증', '민턴일기 · 대회 인증' in my)
    check('A MY 화면에 오운완 없음', '오운완' not in my)
    shot('01_MY_공유카드_줄', sel=None)

    # ── B. 카드 열기 · 문구 칸 ──
    page.evaluate("() => { document.querySelector('[data-group=\"share\"]').open = true; }")
    page.wait_for_timeout(400)
    tap('[data-act="share-card"][data-sc-mode="today"]', 900)
    check('B 공유 카드 시트 열림', has(page, '#sheet .sc__canvas'))
    check('B 카드 문구 칸', has(page, '.sc__phrase'))
    check('B 칩 6개', count(page, '[data-sc-phrase]') == 6, count(page, '[data-sc-phrase]'))
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-sc-phrase]')).map(b => b.innerText.trim())")
    check('B 칩 글자 그대로', chips == ['민턴일기', '오늘도, 배드민턴', '민턴기록', '민턴성장기', 'COURT TIME', '직접 쓰기'], chips)
    check('B 기본은 민턴일기(칩이 색으로 켜짐)', page.evaluate(
        "() => { const b = document.querySelector('[data-sc-phrase=\"mintern\"]'); return b.getAttribute('aria-pressed') + '/' + b.classList.contains('is-on'); }") == 'true/true')
    check('B 입력칸 값 = 민턴일기', page.evaluate(
        "() => document.querySelector('.sc__phraseinput').value") == '민턴일기')
    check('B 시트에 오운완 없음', '오운완' not in text_of(page, '#sheet'))
    w = overflow(page)
    check('B 시트 가로 넘침 없음', w[0] <= w[1] + 1, w)
    shot('02_시트_문구칸', sel='.sc__phrase')

    # 사진 올리기(스토리에서 글씨가 사진 위에서도 읽히는지)
    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1500)

    # ── C. 프리셋 1탭 → 미리보기·PNG ──
    results = {}
    for pid, text in [('today', '오늘도, 배드민턴'), ('record', '민턴기록'),
                      ('growth', '민턴성장기'), ('court', 'COURT TIME')]:
        tap('[data-sc-phrase="%s"]' % pid, 500)
        st = canvas_texts(page)
        check('C %s 칩 → 입력칸·상태 반영' % text,
              page.evaluate("() => document.querySelector('.sc__phraseinput').value") == text and st['phrase'] == text, st)
        check('C %s 칩 눌림 표시' % text, page.evaluate(
            "(id) => document.querySelector('[data-sc-phrase=\"' + id + '\"]').getAttribute('aria-pressed')",
            pid) == 'true')

    # 민턴일기로 되돌리고 매거진 피드 저장
    tap('[data-sc-phrase="mintern"]', 600)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p1 = OUT + '/v161_card_magazine_feed.png'
    dl.value.save_as(p1)
    check('C 매거진 피드 PNG 1080×1350', Image.open(p1).size == (1080, 1350), Image.open(p1).size)
    shot('03_매거진_피드_민턴일기')

    # ── D. 직접 쓰기 ──
    tap('[data-sc-phrase="custom"]', 400)
    check('D 직접 쓰기 → 입력칸 포커스', page.evaluate(
        "() => document.activeElement && document.activeElement.classList.contains('sc__phraseinput')"))
    page.fill('.sc__phraseinput', '코트 위 3시간')
    page.wait_for_timeout(700)
    check('D 직접 쓴 문구가 상태에 반영', canvas_texts(page)['phrase'] == '코트 위 3시간', canvas_texts(page))
    check('D 직접 쓰기 칩이 켜짐', page.evaluate(
        "() => document.querySelector('[data-sc-phrase=\"custom\"]').classList.contains('is-on')") == True)
    check('D 민턴일기 칩은 꺼짐', page.evaluate(
        "() => document.querySelector('[data-sc-phrase=\"mintern\"]').classList.contains('is-on')") == False)
    check('D 글자 수 8/24', '8/24' in text_of(page, '.sc__phrase .field__label'), text_of(page, '.sc__phrase .field__label'))
    shot('04_직접쓴문구_매거진')

    # 24자 상한 · 줄바꿈 정리
    page.fill('.sc__phraseinput', '가' * 30)
    page.wait_for_timeout(500)
    check('D 24자에서 잘림', page.evaluate(
        "() => document.querySelector('.sc__phraseinput').value.length") == 24,
        page.evaluate("() => document.querySelector('.sc__phraseinput').value.length"))
    page.fill('.sc__phraseinput', '코트 위 3시간')
    page.wait_for_timeout(500)

    # ── E. 세 디자인 × 직접 쓴 문구 ──
    for d, name in [('magazine', '매거진'), ('film', '필름'), ('sticker', '스티커')]:
        tap('#sheet [data-sc-design="%s"]' % d, 700)
        shot('05_%s_직접쓴문구' % name)
        if d == 'sticker':
            check('E 스티커는 사진 칸을 숨긴다', has(page, '.sc__photo[hidden]'))
            continue
        with page.expect_download(timeout=20000) as dl:
            tap('[data-sc-save]', 400)
        path = OUT + '/v161_card_%s_feed.png' % d
        dl.value.save_as(path)
        im = Image.open(path)
        check('E %s 피드 PNG 1080×1350' % name, im.size == (1080, 1350), im.size)
        if d == 'film':
            check('E 필름은 밝은 종이(제목이 종이 위)', im.convert('RGB').getpixel((20, 20))[0] > 200,
                  im.convert('RGB').getpixel((20, 20)))

    # 스티커 PNG — 투명 + 글씨 있음
    tap('#sheet [data-sc-design="sticker"]', 500)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    ps = OUT + '/v161_card_sticker_feed.png'
    dl.value.save_as(ps)
    ims = Image.open(ps).convert('RGBA')
    check('E 스티커 PNG 1080×1350 · 배경 투명', ims.size == (1080, 1350) and ims.getpixel((4, 4))[3] == 0, ims.size)

    # ── F. 스토리 9:16 · 안전 여백 ──
    tap('#sheet [data-sc-design="magazine"]', 500)
    tap('#sheet [data-sc-ratio="story"]', 700)
    check('F 스토리 캔버스 1080×1920', page.evaluate(
        "() => { const c = document.querySelector('.sc__canvas'); return [c.width, c.height]; }") == [1080, 1920])
    shot('06_매거진_스토리')
    page.locator('#sheet .sc__preview').scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p2 = OUT + '/v161_card_magazine_story.png'
    dl.value.save_as(p2)
    check('F 스토리 PNG 1080×1920', Image.open(p2).size == (1080, 1920))
    im2 = Image.open(p2).convert('RGB')
    # 위 220px 띠에는 사진만 — 글씨(흰 덩어리)가 새로 생기지 않는지 밝기 분산으로 확인
    top = im2.crop((0, 0, 1080, 200))
    check('F 스토리 위 200px 는 사진만', len(set(top.resize((40, 8)).getdata())) >= 4)

    tap('#sheet [data-sc-design="film"]', 600)
    shot('07_필름_스토리')
    tap('#sheet [data-sc-design="sticker"]', 600)
    shot('08_스티커_스토리')

    # ── G. 대회 카드 제목 ──
    tap('#sheet [data-sc-mode="comp"]', 900)
    check('G 대회 모드에 카드 제목 칸', has(page, '.sc__phrase'))
    check('G 대회 제목도 민턴일기에서 시작', page.evaluate(
        "() => document.querySelector('.sc__phraseinput').value") == '민턴일기')
    page.fill('[data-sc-field="contest"]', '2026 전국 동호인 오픈')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    tap('[data-sc-result="준우승"]', 300)
    page.fill('[data-sc-field="compPartner"]', '민호')
    page.wait_for_timeout(500)
    tap('[data-sc-phrase="growth"]', 600)
    check('G 대회 제목 민턴성장기', canvas_texts(page)['phraseComp'] == '민턴성장기', canvas_texts(page))
    tap('[data-sc-design="magazine"]', 600)
    page.set_input_files('input[data-sc-photo]', PHOTO)
    page.wait_for_timeout(1400)
    tap('#sheet [data-sc-ratio="feed"]', 600)
    shot('09_대회_매거진_민턴성장기')
    with page.expect_download(timeout=20000) as dl:
        tap('[data-sc-save]', 400)
    p3 = OUT + '/v161_card_contest_magazine.png'
    dl.value.save_as(p3)
    check('G 대회 카드 PNG 1080×1350', Image.open(p3).size == (1080, 1350))
    tap('#sheet [data-sc-design="film"]', 600)
    shot('10_대회_필름_민턴성장기')
    tap('#sheet [data-sc-design="sticker"]', 600)
    shot('11_대회_스티커_민턴성장기')

    # ── H. 다시 열어도 마지막 선택 기억 ──
    page.evaluate("() => { const s = document.querySelector('#sheet [data-act=\"close\"], #sheet .sheet__close'); if (s) s.click(); }")
    page.wait_for_timeout(500)
    page.evaluate("() => document.querySelectorAll('.sheet__scrim, .sheet__close').forEach(n => n.click())")
    page.wait_for_timeout(600)
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap("#tabbar [data-tab='my']", 700)
    page.evaluate("() => { const g = document.querySelector('[data-group=\"share\"]'); if (g) g.open = true; }")
    page.wait_for_timeout(300)
    tap('[data-act="share-card"][data-sc-mode="today"]', 900)
    st = canvas_texts(page)
    check('H 다시 열어도 문구 기억(직접 쓴 문구)', st['phrase'] == '코트 위 3시간', st)
    check('H 다시 열어도 디자인 기억(스티커)', page.evaluate(
        "() => document.querySelector('[data-sc-design=\"sticker\"]').getAttribute('aria-pressed')") == 'true')

    # ── I. 마무리: 콘솔 · 넘침 ──
    w = overflow(page)
    check('I 가로 넘침 없음', w[0] <= w[1] + 1, w)
    check('I 앱 오류 0건', len(errs) == 0, errs[:3])
    check('I CSP 위반 0건', len(csp) == 0, csp[:2])

    b.close()

done = sum(1 for _, ok in checks if ok)
print('\n%d/%d 통과' % (done, len(checks)))
