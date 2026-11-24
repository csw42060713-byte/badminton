"""bm-v1.71.0 로컬 점검 (390×844) — 인스타 공유 카드 감성 전면 리디자인 + 고화질 배경 3종

승우 님 요청: "인스타 공유 카드가 아직 어수선하고 아쉽다 — 싹 갈아엎어 줘."
  1) 고화질 실사 기본 배경 3종(야경 코트·노을 체육관·다크 스튜디오)이 실제로 로드된다
  2) 매거진 — 큰 숫자 + 얇은 선 + 짧은 한 줄 + 맨 아래 날짜, 도장은 기본 없음
  3) 영수증 — 크림 종이 · 머리글 · 줄 · TOTAL · 바코드 · 한 줄 코멘트가 종이 위에 그려진다
  4) 디자인 4종 전환(매거진·영수증·필름·스티커) + 꾸밈 배지 켜기/끄기
  5) 기존 기능 보호 — 사진 넣기·끌기·확대·필터·글씨 위치·비율·문구·두 모드
  6) 저장(PNG)이 실제로 내려받아지고 1080×1350 · 1080×1920 이다
  7) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360)

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v171.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V171_PORT', '8871'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V171_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V171_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


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

    def body_top():
        page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
        page.wait_for_timeout(180)

    def tap(sel, wait=420):
        page.click('#sheet ' + sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = SHOTS + '/v171_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)

    def login(nick='승우'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check171@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 19:30:00',
                        profile: { nick: a.nick, level: 'A조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-24 19:30:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.71.0', "var VERSION = 'bm-v1.71.0'" in read('sw.js'))
    check('A index styles.css?v=20261124-9', 'styles.css?v=20261124-9' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.71.0 · 코드 65', '"appVersionName": "1.71.0"' in twa and '"appVersionCode": 65' in twa)
    check('A sw SHELL에 배경 사진 3장', all(("'./assets/share-bg/%s'" % n) in read('sw.js')
                                         for n in ['night-court.jpg', 'sunset-shuttle.jpg', 'minimal-studio.jpg']))
    for n in ['night-court.jpg', 'sunset-shuttle.jpg', 'minimal-studio.jpg']:
        check('A 파일 %s' % n, os.path.exists(os.path.join(ROOT, 'assets/share-bg', n)))

    login('승우')
    check('A 앱 버전 v1.71.0', page.evaluate("() => BM.app.version") == 'v1.71.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # 일지 하나 심고 시트 열기
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'r171', date: '2026-11-24', minutes: 90, cond: 9, intensity: 7,
        games: [{a:21,b:15},{a:18,b:21},{a:21,b:19}],
        team: JSON.stringify({ partner: '민호', rival: '지호' }), done: ['스매시 드릴','풋워크'] }];
      st.data.stats = Object.assign({}, st.data.stats, { streak: 5 });
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.sharecard.open(BM.app.ctx, { mode: 'today', record: BM.app.ctx.store.state.data.records[0] })")
    page.wait_for_timeout(1600)

    def card_png(name):
        cv = page.locator('#sheet .sc__canvas')
        cv.scroll_into_view_if_needed()
        page.wait_for_timeout(220)
        path = OUT + '/v171_local_' + name + '.png'
        cv.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    # ── B. 기본 배경 3종 로드 ──
    imgs = page.evaluate("""() => BM.sharecard.BGS.map(b => ({ id: b.id, src: b.src,
        w: (BM.sharecard.bgImageOf(b.id) || {}).width || 0 }))""")
    photo_bgs = [i for i in imgs if i['src']]
    check('B 실사 배경 3종이 1080으로 로드', len(photo_bgs) == 3 and all(i['w'] == 1080 for i in photo_bgs), imgs)
    check('B 기본 배경은 야경 코트', page.evaluate(
        "() => document.querySelector('#sheet [data-sc-bg=\"nightcourt\"]').classList.contains('is-on')"))
    card_png('magazine_night')

    # ── C. 디자인 4종 전환 ──
    def pixel(x, y):
        return page.evaluate("""(p) => {
          const c = document.querySelector('#sheet .sc__canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(p[0], p[1], 1, 1).data;
          return [d[0], d[1], d[2], d[3]];
        }""", [x, y])

    def not_blank():
        px = page.evaluate("""() => {
          const c = document.querySelector('#sheet .sc__canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set();
          let ink = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i+3] > 8) ink++;
            seen.add(d[i] + ',' + d[i+1] + ',' + d[i+2] + ',' + d[i+3]);
          }
          return { colors: seen.size, ink: ink, total: d.length / 4 };
        }""")
        return px['colors'] > 8 and px['ink'] > px['total'] * 0.002

    for d in ['magazine', 'receipt', 'film', 'sticker']:
        tap('[data-sc-design="%s"]' % d, 650)
        on = page.evaluate("(x) => document.querySelector('#sheet [data-sc-design=\"' + x + '\"]').classList.contains('is-on')", d)
        check('C 디자인 %s 선택' % d, on)
        check('C 디자인 %s 캔버스가 그려진다' % d, not_blank())
        card_png('design_' + d)

    # 영수증 종이는 가운데가 크림색
    tap('[data-sc-design="receipt"]', 650)
    px = pixel(540, 700)
    check('C 영수증 종이 크림색', px[0] > 225 and px[1] > 220 and px[2] > 205 and px[0] > px[2], px)
    # 매거진으로 돌아오기
    tap('[data-sc-design="magazine"]', 500)

    # ── D. 꾸밈 배지 기본 꺼짐 ──
    check('D 꾸밈 배지 기본 꺼짐', '꾸밈 배지 꺼짐' in page.inner_text('#sheet'))
    check('D 꺼짐일 때 자랑 배지 칸 숨김', page.locator('#sheet [data-sc-badgetoggle]').count() == 0)
    body_top()
    tap('[data-sc-decotoggle]', 700)
    check('D 켜면 자랑 배지 칸이 나온다', page.locator('#sheet [data-sc-badgetoggle]').count() == 1)
    card_png('magazine_deco')
    body_top()
    tap('[data-sc-decotoggle]', 500)
    check('D 다시 끄면 사라진다', page.locator('#sheet [data-sc-badgetoggle]').count() == 0)

    # ── E. 사진 넣기 · 끌기 · 확대 · 필터 ──
    page.evaluate("""() => {
      const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 900, 1200);
      gr.addColorStop(0, '#2b5c8a'); gr.addColorStop(1, '#0b1826');
      g.fillStyle = gr; g.fillRect(0, 0, 900, 1200);
      c.toBlob(blob => {
        const file = new File([blob], 'p.png', { type: 'image/png' });
        const dt = new DataTransfer(); dt.items.add(file);
        const input = document.querySelector('#sheet [data-sc-photo]');
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, 'image/png');
    }""")
    page.wait_for_timeout(1200)
    check('E 사진 넣기', page.evaluate("() => !!BM.sharecard._state().photo"))
    check('E 사진을 넣으면 기본 배경은 비움', page.evaluate("() => BM.sharecard._state().bg") == '')
    check('E 사진 위치·확대 칸이 보인다', page.locator('#sheet [data-sc-zoombox]').is_visible())
    zoom0 = page.evaluate("() => BM.sharecard._state().photoZoom")
    tap('[data-sc-zoomin]', 450)
    zoom1 = page.evaluate("() => BM.sharecard._state().photoZoom")
    check('E 확대 + 버튼', zoom1 > zoom0, '%s → %s' % (zoom0, zoom1))
    tap('[data-sc-zoomreset]', 450)
    check('E 원래대로', page.evaluate("() => BM.sharecard._state().photoZoom") == 1)
    # 사진 끌기
    box = page.locator('#sheet .sc__canvas').bounding_box()
    page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
    page.mouse.down()
    page.mouse.move(box['x'] + box['width'] / 2 + 24, box['y'] + box['height'] / 2 + 18, steps=6)
    page.mouse.up()
    page.wait_for_timeout(450)
    moved = page.evaluate("() => ({ x: BM.sharecard._state().photoX, y: BM.sharecard._state().photoY })")
    check('E 사진 끌기', moved['x'] != 0 or moved['y'] != 0, moved)
    tap('[data-sc-filter="mono"]', 500)
    check('E 사진 필터(흑백)', page.evaluate("() => BM.sharecard._state().filter") == 'mono')
    tap('[data-sc-filter="auto"]', 400)
    card_png('magazine_photo')

    # ── F. 비율 · 글씨 위치 · 문구 · 두 모드 ──
    tap('[data-sc-ratio="story"]', 550)
    check('F 스토리 9:16', page.evaluate(
        "() => { const c = document.querySelector('#sheet .sc__canvas'); return c.width + 'x' + c.height; }") == '1080x1920')
    card_png('magazine_story')
    tap('[data-sc-ratio="feed"]', 400)
    tap('[data-sc-textpos="top"]', 500)
    check('F 글씨 위치 위', page.evaluate("() => document.querySelector('#sheet [data-sc-textpos=\"top\"]').classList.contains('is-on')"))
    tap('[data-sc-textpos="bottom"]', 400)
    page.evaluate("""() => document.querySelector('details.sc__more').open = true""")
    page.wait_for_timeout(300)
    page.fill('#sheet [data-sc-field="phrase"]', '오늘도, 배드민턴')
    page.wait_for_timeout(500)
    check('F 문구 직접 입력', page.evaluate("() => BM.sharecard._state().phrase") == '오늘도, 배드민턴')
    tap('[data-sc-phrase="mintern"]', 500)
    check('F 문구 프리셋', page.evaluate("() => BM.sharecard._state().phrase") == '민턴일기')
    body_top()
    tap('[data-sc-mode="comp"]', 700)
    check('F 대회 인증 모드', page.evaluate("() => BM.sharecard._state().mode") == 'comp')
    page.fill('#sheet [data-sc-field="contest"]', '경기도지사기 배드민턴 대회')
    page.fill('#sheet [data-sc-field="event"]', 'B조 복식')
    page.wait_for_timeout(400)
    tap('[data-sc-result="준우승"]', 600)
    card_png('comp_magazine')
    tap('[data-sc-design="receipt"]', 700)
    card_png('comp_receipt')
    shot('sheet_receipt')
    body_top()
    tap('[data-sc-mode="today"]', 600)

    # ── G. 저장(PNG) ──
    tap('[data-sc-design="magazine"]', 500)
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 200)
    download = dl.value
    save_path = OUT + '/v171_local_saved.png'
    download.save_as(save_path)
    size = os.path.getsize(save_path)
    check('G PNG 저장', size > 40000, '%d KB · %s' % (size // 1024, download.suggested_filename))
    from PIL import Image
    im = Image.open(save_path)
    check('G 저장 PNG 1080×1350', im.size == (1080, 1350), im.size)

    # ── H. 오류 · 넘침 ──
    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])
    ow = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('H 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(500)
    ow2 = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('H 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
