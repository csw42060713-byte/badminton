"""bm-v1.71.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.71.0 (sw.js · app.js · js/sharecard.js 영수증) · 5개 탭 그대로
  2) 기본 배경 3종 실사 사진이 라이브에서 실제로 내려와 1080으로 로드된다
  3) 매거진(야경) · 영수증 · 매거진(노을) · 스티커 전환과 캔버스 렌더링
  4) 꾸밈 배지 기본 꺼짐/켜짐 · 사진 넣기 · 필터 · 비율 · 두 모드
  5) PNG 저장(1080×1350) · 오류 0 · CSP 0 · 가로 넘침 0 (390·360)
  6) 캡처 downloads/v171_live_magazine.png · v171_live_receipt.png ·
     v171_live_sunset.png · v171_live_sticker.png

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v171.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


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
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            return      # 라이브에서 막은 외부(supabase·지도 타일) 요청
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def tap(sel, wait=450):
        page.click('#sheet ' + sel)
        page.wait_for_timeout(wait)

    def body_top():
        page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
        page.wait_for_timeout(180)

    def card_png(name):
        cv = page.locator('#sheet .sc__canvas')
        cv.scroll_into_view_if_needed()
        page.wait_for_timeout(260)
        path = OUT + '/v171_live_' + name + '.png'
        cv.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def not_blank():
        return page.evaluate("""() => {
          const c = document.querySelector('#sheet .sc__canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set(); let ink = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i+3] > 8) ink++;
            seen.add(d[i] + ',' + d[i+1] + ',' + d[i+2] + ',' + d[i+3]);
          }
          return { colors: seen.size, ink: ink, total: d.length / 4 };
        }""")

    # ── A. 라이브 파일 버전 ──
    sw = page.request.get(BASE + 'sw.js').text()
    check('A 라이브 sw.js bm-v1.71.0', "var VERSION = 'bm-v1.71.0'" in sw)
    sc = page.request.get(BASE + 'js/sharecard.js').text()
    check('A 라이브 sharecard에 영수증', 'paintReceipt' in sc and 'BADMINTON RECEIPT' in sc and "'receipt'" in sc)
    check('A 라이브 sharecard에 배경 3종', all(('assets/share-bg/%s' % n) in sc
                                          for n in ['night-court.jpg', 'sunset-shuttle.jpg', 'minimal-studio.jpg']))
    for n in ['night-court.jpg', 'sunset-shuttle.jpg', 'minimal-studio.jpg']:
        r = page.request.get(BASE + 'assets/share-bg/' + n)
        check('A 라이브 사진 %s 200 · %dKB' % (n, (int(r.headers.get('content-length') or 0)) // 1024), r.status == 200)

    # ── B. 앱 · 로그인 ──
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live171@example.com', name: '승우',
          at: new Date().toISOString(), onboardedAt: '2026-11-24 20:10:00',
          profile: { nick: '승우', level: 'A조', discipline: '복식', region: '경기', club: '나래울체육관',
                     onboardedAt: '2026-11-24 20:10:00' } }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('B 라이브 앱 v1.71.0', page.evaluate("() => BM.app.version") == 'v1.71.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('B 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'rlive171', date: '2026-11-24', minutes: 90, cond: 9, intensity: 7,
        games: [{a:21,b:15},{a:18,b:21},{a:21,b:19}],
        team: JSON.stringify({ partner: '민호', rival: '지호' }), done: ['스매시 드릴','풋워크'] }];
      st.data.stats = Object.assign({}, st.data.stats, { streak: 5 });
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.sharecard.open(BM.app.ctx, { mode: 'today', record: BM.app.ctx.store.state.data.records[0] })")
    page.wait_for_timeout(2000)

    # ── C. 배경 사진 로드 · 캡처 4장 ──
    imgs = page.evaluate("""() => BM.sharecard.BGS.map(b => ({ id: b.id, src: b.src,
        w: (BM.sharecard.bgImageOf(b.id) || {}).width || 0 }))""")
    photo_bgs = [i for i in imgs if i['src']]
    check('C 라이브 배경 3종 1080 로드', len(photo_bgs) == 3 and all(i['w'] == 1080 for i in photo_bgs), imgs)
    check('C 기본 배경 야경 코트 선택', page.evaluate(
        "() => !!document.querySelector('#sheet .sc__bg.is-on[data-sc-bg=nightcourt]')"))
    card_png('magazine')

    tap('[data-sc-design="receipt"]', 800)
    nb = not_blank()
    check('C 영수증이 그려진다', nb['colors'] > 8 and nb['ink'] > nb['total'] * 0.002, nb)
    check('C 영수증 종이 크림색', page.evaluate("""() => {
      const c = document.querySelector('#sheet .sc__canvas');
      const d = c.getContext('2d').getImageData(540, 700, 1, 1).data;
      return [d[0], d[1], d[2]];
    }""")[0] > 225)
    card_png('receipt')

    tap('[data-sc-design="magazine"]', 500)
    tap('[data-sc-bg="sunsetshuttle"]', 900)
    card_png('sunset')

    tap('[data-sc-design="sticker"]', 800)
    nb2 = not_blank()
    check('C 스티커가 그려진다(투명)', nb2['colors'] > 4, nb2)
    card_png('sticker')

    # ── D. 꾸밈 배지 · 사진 · 비율 ──
    tap('[data-sc-design="magazine"]', 500)
    body_top()
    check('D 꾸밈 배지 기본 꺼짐', '꾸밈 배지 꺼짐' in page.inner_text('#sheet'))
    check('D 꺼짐일 때 자랑 배지 숨김', page.locator('#sheet [data-sc-badgetoggle]').count() == 0)
    tap('[data-sc-decotoggle]', 700)
    check('D 켜면 자랑 배지 칸', page.locator('#sheet [data-sc-badgetoggle]').count() == 1)
    body_top()
    tap('[data-sc-decotoggle]', 500)
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
    page.wait_for_timeout(1300)
    check('D 사진 넣기', page.evaluate("() => !!BM.sharecard._state().photo"))
    tap('[data-sc-zoomin]', 450)
    check('D 확대 +', page.evaluate("() => BM.sharecard._state().photoZoom") > 1)
    tap('[data-sc-filter="mono"]', 500)
    check('D 사진 필터', page.evaluate("() => BM.sharecard._state().filter") == 'mono')
    tap('[data-sc-ratio="story"]', 600)
    check('D 스토리 9:16', page.evaluate(
        "() => { const c = document.querySelector('#sheet .sc__canvas'); return c.width + 'x' + c.height; }") == '1080x1920')
    body_top()
    tap('[data-sc-ratio="feed"]', 400)
    page.evaluate("() => document.querySelector('#sheet [data-sc-photoclear]').click()")
    page.wait_for_timeout(500)
    check('D 사진 빼기', page.evaluate("() => !BM.sharecard._state().photo"))

    # ── E. 두 모드 ──
    body_top()
    tap('[data-sc-mode="comp"]', 700)
    page.fill('#sheet [data-sc-field="contest"]', '경기도지사기 배드민턴 대회')
    page.fill('#sheet [data-sc-field="event"]', 'B조 복식')
    page.wait_for_timeout(500)
    check('E 대회 인증 모드', page.evaluate("() => BM.sharecard._state().mode") == 'comp')
    check('E 대회 카드가 그려진다', not_blank()['ink'] > 1000)
    card_png('comp')
    body_top()
    tap('[data-sc-mode="today"]', 500)

    # ── F. 저장 · 오류 · 넘침 ──
    with page.expect_download(timeout=15000) as dl:
        tap('[data-sc-save]', 200)
    save_path = OUT + '/v171_live_saved.png'
    dl.value.save_as(save_path)
    size = os.path.getsize(save_path)
    check('F PNG 저장', size > 40000, '%d KB' % (size // 1024))
    from PIL import Image
    check('F 저장 PNG 1080×1350', Image.open(save_path).size == (1080, 1350))

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])
    ow = overflow(page)
    check('F 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(500)
    ow2 = overflow(page)
    check('F 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)

    browser.close()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
