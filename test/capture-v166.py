"""카드만 골라 캡처 — 디자인 3종 × 글씨 위치 3단 × 구도 (bm-v1.66.0 시각 확인용)

실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v166.py
"""
import http.server
import os
import socketserver
import threading, subprocess
from functools import partial

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = 8833
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/check-shots'

handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

# 카드에 쓸 진짜 사진 느낌(사람 대신 색 그라데이션 + 원) — 예시에 실존 인물 안 씀
img = OUT + '/v166_photo_card.png'
im = Image.new('RGB', (1200, 1600))
for y in range(1600):
    for x in range(1200):
        im.putpixel((x, y), (30 + x // 12, 80 + y // 20, 120 - x // 20))
im.save(img)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
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
      const s = { kind: 'email', email: 'shot166@example.com', name: '점검왕',
                  at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                  profile: { nick: '점검왕', level: 'B조', discipline: '복식', region: '경기',
                             club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
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

    def card(name, ratio='feed'):
        page.click('#sheet [data-sc-ratio="%s"]' % ratio)
        page.wait_for_timeout(300)
        page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
        page.wait_for_timeout(250)
        page.locator('#sheet .sc__canvas').screenshot(path=OUT + '/v166_card_%s.png' % name)
        print('saved', name, flush=True)

    for design in ['magazine', 'film', 'sticker']:
        page.click('#sheet [data-sc-design="%s"]' % design)
        page.wait_for_timeout(400)
        for pos in ['bottom', 'middle', 'top']:
            page.click('#sheet [data-sc-textpos="%s"]' % pos)
            page.wait_for_timeout(350)
            card('%s_%s' % (design, pos))

    # 구도 — 확대 + 끌기 (매거진)
    page.click('#sheet [data-sc-design="magazine"]')
    page.wait_for_timeout(300)
    page.click('#sheet [data-sc-textpos="bottom"]')
    page.wait_for_timeout(300)
    page.click('#sheet [data-sc-zoomreset]')
    page.wait_for_timeout(300)
    card('photo_1x')
    for _ in range(8):
        page.click('#sheet [data-sc-zoomin]')
        page.wait_for_timeout(90)
    card('photo_zoom')
    # 사진 없이 기본 배경(노을 코트) + 글씨 위 — 밝은 배경에서도 글씨가 읽히는지
    page.click('#sheet [data-sc-photoclear]')           # 사진 빼고 기본 배경으로
    page.wait_for_timeout(500)
    page.click('#sheet [data-sc-bg="sunsetcourt"]')
    page.wait_for_timeout(400)
    page.click('#sheet [data-sc-textpos="top"]')
    page.wait_for_timeout(400)
    card('bg_sunset_top')
    page.click('#sheet [data-sc-textpos="middle"]')
    page.wait_for_timeout(400)
    card('bg_sunset_middle')

    # 화면(시트) 전체도 한 장
    page.screenshot(path=OUT + '/v166_sheet_zoom_controls.png')

    b.close()
httpd.shutdown()
