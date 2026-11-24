"""bm-v1.64.0 캡처 — 하트 지갑(3일 연속 + 부스트 적용) · 대회 인증 챔피언 골드 프레임 카드.

실행(저장소 루트에서):
  (python3 -m http.server 8830 --bind 127.0.0.1 &) ; python3 test/capture-v164.py
"""
import os

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8830/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url
                  or 'jsdelivr' in r.request.url) else r.continue_())
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append(str(e)[:200]))
    page.on('console', lambda m: errs.append(m.text[:200])
            if m.type == 'error' and 'net::' not in m.text else None)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot164@example.com',
        name: '점검왕', at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
        profile: { nick: '점검왕', level: 'B조', discipline: '복식', region: '경기', club: '나래울',
                   onboardedAt: '2026-11-24 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    # 어제·그제 출석을 넣어 '3일 연속' 상태로
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util, me = BM.app.ctx.store.state.me.key, key = BM.auth.rowsKeyFor();
      const rows = U.readJSON(key, []) || [];
      const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      [1, 2].forEach((n) => { const k = day(n);
        rows.push(D.toRow({ type: '출석하트', id: 's' + k, clientId: 's' + k, date: k,
                            createdAt: k + ' 08:00:00', nick: '점검왕', userKey: me, likes: 1 })); });
      U.writeJSON(key, rows);
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)

    page.click("#tabbar [data-tab='my']")
    page.wait_for_timeout(700)
    page.click('[data-region="boost"] [data-act="boost"]')
    page.wait_for_timeout(800)
    page.click('[data-act="checkin"]')
    page.wait_for_timeout(900)
    card = page.query_selector('[data-region="heart"]')
    card.screenshot(path=OUT + '/v164_heart_card.png')
    print('heart card:', ' / '.join(card.inner_text().split('\n'))[:260])
    page.screenshot(path=OUT + '/v164_my_full.png')

    page.click('[data-act="share-card"]')
    page.wait_for_timeout(800)
    page.click('[data-sc-mode="comp"]')
    page.wait_for_timeout(600)
    page.fill('[data-sc-field="contest"]', '2026 수원시 오픈 배드민턴 대회')
    page.fill('[data-sc-field="event"]', 'B조 복식')
    page.click('[data-sc-frame="champ"]')
    page.wait_for_timeout(800)
    page.query_selector('.sc__canvas').screenshot(path=OUT + '/v164_comp_champ_canvas.png')
    page.screenshot(path=OUT + '/v164_comp_champ_sheet.png')
    print('errors', errs[:4])
    b.close()
