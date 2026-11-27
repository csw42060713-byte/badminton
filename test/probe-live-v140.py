"""최근 기록 7대 훈련 줄이 카드 안에서 말줄임되는지 라이브에서 직접 측정."""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort() if 'supabase' in r.request.url or 'google' in r.request.url else r.continue_())
    page = ctx.new_page()
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => { localStorage.clear(); localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'email', email:'m@e.com', name:'측정', at:new Date().toISOString()})); }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.click('[data-pick="role"][data-val="player"]')
    page.wait_for_timeout(200)
    page.fill('#onbNick', '측정')
    page.click('[data-pick="level"][data-val="선수부"]')
    page.click('[data-pick="discipline"][data-val="단식"]')
    page.click('[data-act="finish"]')
    page.wait_for_timeout(2000)
    for _ in range(4):
        if page.query_selector('#sheet .sheet__head [data-close]'):
            page.click('#sheet .sheet__head [data-close]', timeout=1500)
            page.wait_for_timeout(200)
    for name, text in (('상체 근력운동', '풀업 4세트, 벤치프레스 60kg'), ('풋워크', '사이드 스텝 10분 × 3세트'), ('하체 근력운동', '스쿼트 80kg 5×5')):
        page.click('[data-pro-toggle="%s"]' % name)
        page.wait_for_timeout(200)
        page.fill('[data-pro="%s"] [data-pro-note]' % name, text)
        page.wait_for_timeout(150)
    page.click('[data-act="save-log"]')
    page.wait_for_timeout(1600)
    info = page.evaluate("""() => {
      const p = document.querySelector('[data-region="recent"] .logrow__pro');
      if (!p) return null;
      const r = p.getBoundingClientRect();
      const card = p.closest('.card').getBoundingClientRect();
      const row = p.closest('.logrow').getBoundingClientRect();
      const list = p.closest('.loglist');
      return {
        text: p.textContent, clientW: p.clientWidth, scrollW: p.scrollWidth,
        pRight: Math.round(r.right), rowRight: Math.round(row.right), cardRight: Math.round(card.right),
        gridCols: list ? getComputedStyle(list).gridTemplateColumns : 'n/a',
        listRight: list ? Math.round(list.getBoundingClientRect().right) : null
      };
    }""")
    print(json.dumps(info, ensure_ascii=False))
    page.evaluate("() => document.querySelector('[data-region=\"recent\"]').scrollIntoView({block:'center'})")
    page.wait_for_timeout(300)
    page.screenshot(path='/workspace/downloads/v140_live_recent_probe.png')
    page.screenshot(path='/workspace/downloads/v140_live_recent_probe_zoom.png',
                    clip={'x': 0, 'y': 330, 'width': 390, 'height': 280})
    b.close()
