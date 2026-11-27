"""카드만 골라 캡처 — 디자인 4종 · 필터 · 메달 · 숫자 숨기기 (bm-v1.67.0 시각 확인용)

실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v167.py
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 8843
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/check-shots'

handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

os.makedirs(OUT, exist_ok=True)

# 진짜 사진 느낌 — 사람 대신 색 그라데이션 + 원 (실존 인물 안 씀)
img = OUT + '/v167_photo_card.png'
im = Image.new('RGB', (1200, 1600))
for y in range(1600):
    for x in range(1200):
        im.putpixel((x, y), (28 + x // 10, 86 + y // 18, 132 - x // 22))
im.save(img)
# 라켓샷 느낌(따뜻한 조명 + 어두운 배경) — 숫자 숨기기 확인용
img2 = OUT + '/v167_photo_warm.png'
im2 = Image.new('RGB', (1200, 1600))
for y in range(1600):
    for x in range(1200):
        im2.putpixel((x, y), (120 + x // 14, 96 + y // 22, 60 + x // 30))
im2.save(img2)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      const s = { kind: 'email', email: 'shot167@example.com', name: '점검왕',
                  at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                  profile: { nick: '점검왕', level: 'B조', discipline: '복식', region: '경기',
                             club: '나래울체육관', onboardedAt: '2026-11-24 09:00:00' } };
      localStorage.setItem('bm_auth_v1', JSON.stringify(s));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.fill('[data-field="minutes"]', '90')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '15' }, { a: '18', b: '21' }, { a: '21', b: '19' }];
      st.drafts.log.partner = '민호'; st.drafts.log.rival = '지호';
    }""")
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(1800)
    page.click('[data-share-entry="log-hero"]')
    page.wait_for_timeout(1200)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1200)

    def open_more():
        page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = true; }")
        page.wait_for_timeout(250)

    def card(name):
        page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
        page.wait_for_timeout(200)
        page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v167_card_%s.png' % name)
        print('saved', name, flush=True)

    # 1) 디자인 4종
    for design in ['magazine', 'glass', 'film', 'sticker']:
        page.click('#sheet [data-sc-design="%s"]' % design)
        page.wait_for_timeout(400)
        card(design)

    # 2) 필터 5종 (매거진)
    page.click('#sheet [data-sc-design="magazine"]')
    page.wait_for_timeout(300)
    for f in ['auto', 'film', 'vivid', 'mono', 'original']:
        page.click('#sheet [data-sc-filter="%s"]' % f)
        page.wait_for_timeout(400)
        card('filter_' + f)
    page.click('#sheet [data-sc-filter="auto"]')
    page.wait_for_timeout(300)

    # 3) 숫자 숨기기 — 매거진 · 글래스 (따뜻한 사진으로 교체)
    page.set_input_files('#sheet [data-sc-photo]', img2)
    page.wait_for_timeout(1100)
    open_more()
    page.click('#sheet [data-sc-taunt="taunt3"]')      # '우리 콤비 못 뚫지'
    page.wait_for_timeout(400)
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = false; }")
    page.click('#sheet [data-sc-nums="hide"]')
    page.wait_for_timeout(500)
    card('mood_magazine')
    page.click('#sheet [data-sc-design="glass"]')
    page.wait_for_timeout(400)
    card('mood_glass')
    page.click('#sheet [data-sc-design="film"]')
    page.wait_for_timeout(400)
    card('mood_film')
    page.click('#sheet [data-sc-design="sticker"]')
    page.wait_for_timeout(400)
    card('mood_sticker')
    page.click('#sheet [data-sc-design="magazine"]')
    page.click('#sheet [data-sc-nums="show"]')
    page.wait_for_timeout(400)

    # 4) 도발 멘트 + 라이벌 태그 (매거진)
    open_more()
    page.click('#sheet [data-sc-rtaunt="0"]')
    page.wait_for_timeout(400)
    page.evaluate("() => { const d = document.querySelector('#sheet .sc__more'); if (d) d.open = false; }")
    card('taunt_rival')

    # 5) 메달 임팩트 4종 (매거진 · 글래스)
    page.click('#sheet [data-sc-mode="comp"]')
    page.wait_for_timeout(900)
    page.fill('#sheet [data-sc-field="contest"]', '○○시 오픈 배드민턴 대회')
    page.fill('#sheet [data-sc-field="event"]', 'B조 복식')
    page.wait_for_timeout(500)
    page.set_input_files('#sheet [data-sc-photo]', img)
    page.wait_for_timeout(1100)
    for r in ['우승', '준우승', '3위', '출전']:
        page.click('#sheet [data-sc-result="%s"]' % r)
        page.wait_for_timeout(500)
        card('medal_' + r)
    page.click('#sheet [data-sc-design="glass"]')
    page.click('#sheet [data-sc-result="우승"]')
    page.wait_for_timeout(500)
    card('medal_gold_glass')
    page.click('#sheet [data-sc-design="film"]')
    page.wait_for_timeout(400)
    card('medal_gold_film')

    # 6) 사진 없이 기본 배경 + 금메달
    page.click('#sheet [data-sc-design="magazine"]')
    page.click('#sheet [data-sc-photoclear]')
    page.wait_for_timeout(600)
    page.click('#sheet [data-sc-bg="sunsetcourt"]')
    page.wait_for_timeout(500)
    card('medal_gold_bg')

    page.screenshot(path=OUT + '/v167_sheet_full.png')
    browser.close()
httpd.shutdown()
print('done', flush=True)
