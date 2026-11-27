"""bm-v1.91.0 점검 — 390×844 에서 종아리·아킬레스 쿨다운 AI 카드

발목 통증을 남긴 날 / 65분·센 날 두 경우로 접기 '부상 예방 · 종목 부하' 를 펼쳐
'운동 후 5분 종아리·아킬레스 쿨다운' 블록과 타이머 단추가 실제로 보이고 눌리는지 확인합니다.
콘솔 0 · CSP 0 · 가로 넘침 0 도 같이 봅니다.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/check-v191.py
결과: /workspace/downloads/v191_*.png
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V191K_PORT', '8941'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
threading.Thread(target=httpd.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'google' in r.request.url or 'jsdelivr' in r.request.url)
              else r.continue_())
    page = ctx.new_page()
    errs, csp, bad = [], [], []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('response', lambda r: bad.append(r.url + ' ' + str(r.status)) if r.status >= 400 else None)
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot191@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2500)

    print('version', page.evaluate("() => ({ app: BM.app.version })"), flush=True)

    def draft(patch):
        page.evaluate("""(patch) => {
          const st = BM.app.ctx.store.actions;
          st.resetDraft();
          st.setDraft(patch);
          st.analyze();
          location.hash = '#/log';
        }""", patch)
        page.wait_for_timeout(900)
        page.evaluate("() => { const el = document.querySelector('[data-region=\"analysis\"]');"
                      " if (el) el.scrollIntoView({block: 'start'}); }")
        page.wait_for_timeout(400)

    def open_prevent_fold():
        page.evaluate("""() => {
          const f = document.querySelector('details[data-fold="prevent"]');
          if (f && !f.open) f.querySelector('summary').click();
        }""")
        page.wait_for_timeout(500)

    def probe():
        return page.evaluate("""() => {
          const f = document.querySelector('details[data-fold="prevent"]');
          const c = document.querySelector('[data-cool]');
          const timers = document.querySelectorAll('[data-dtimer^="cool:"]');
          const btn = document.querySelector('[data-timer-start^="cool:"], [data-cool] [data-timer-start]');
          return {
            foldOpen: !!(f && f.open),
            summary: f ? f.querySelector('summary').innerText.replace(/\\s+/g, ' ').trim() : '',
            cool: c ? c.getAttribute('data-cool') : null,
            title: c ? (c.querySelector('.planbox__t') || {}).innerText : '',
            items: c ? c.querySelectorAll('li.warm').length : 0,
            timers: timers.length,
            startBtn: btn ? btn.innerText.trim() : '',
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
          };
        }""")

    def shot(name, clip=None):
        page.wait_for_timeout(250)
        page.screenshot(path=OUT + '/' + name + '.png', clip=clip)
        print('saved ' + name, flush=True)

    # ① 발목 통증을 남긴 날
    draft({'cond': 6, 'intensity': 6, 'minutes': 50, 'pain': ['발목'], 'weakness': ['풋워크']})
    open_prevent_fold()
    info = probe()
    print('pain-day', info, flush=True)
    shot('v191_ai_ankle')
    box = page.evaluate("""() => { const r = document.querySelector('[data-cool]').getBoundingClientRect();
      return {x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4),
              width: Math.min(390, r.width + 8), height: Math.min(844, r.height + 8)}; }""")
    if box['y'] + box['height'] > 844 or box['height'] > 700:
        page.evaluate("() => document.querySelector('[data-cool]').scrollIntoView({block: 'center'})")
        page.wait_for_timeout(250)
        box = page.evaluate("""() => { const r = document.querySelector('[data-cool]').getBoundingClientRect();
          return {x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4),
                  width: Math.min(390, r.width + 8), height: Math.min(844, r.height + 8)}; }""")
    shot('v191_cool_pain', box)

    # 타이머 단추가 실제로 눌리고 5분이 잡히는지
    tap = page.evaluate("""() => {
      const c = document.querySelector('[data-cool]');
      const btn = Array.from(c.querySelectorAll('[data-timer-start]')).find(b => (b.innerText || '').indexOf('5') >= 0);
      if (!btn) return { found: false };
      btn.click();
      const w = c.querySelector('[data-dtimer^="cool:"]');
      const face = w ? w.querySelector('.dtimer__clock') : null;
      return { found: true, label: btn.innerText.trim(), face: face ? face.innerText.replace(/\s+/g, ' ').trim() : '',
               on: !!(w && w.className.indexOf('dtimer--on') >= 0) };
    }""")
    print('timer', tap, flush=True)
    page.wait_for_timeout(1200)
    shot('v191_cool_timer', box)

    # ② 65분 · 강도 7 (통증 없음) — 볼륨 때문에 켜지는 경우
    draft({'cond': 7, 'intensity': 7, 'minutes': 65, 'pain': [], 'weakness': ['드라이브']})
    open_prevent_fold()
    print('load-day', probe(), flush=True)
    shot('v191_ai_long')

    # ③ 짧고 가벼운 날 — 블록이 없어야 함
    draft({'cond': 7, 'intensity': 6, 'minutes': 40, 'pain': [], 'weakness': ['드라이브']})
    open_prevent_fold()
    easy = probe()
    print('easy-day', easy, flush=True)
    assert easy['cool'] is None, '짧고 가벼운 날에 쿨다운 블록이 떴습니다'

    # ④ 실제 저장 흐름 — 저장한 일지의 처방에 쿨다운이 남는지
    draft({'cond': 6, 'intensity': 6, 'minutes': 70, 'pain': ['아킬레스건'], 'weakness': ['풋워크']})
    page.wait_for_timeout(300)
    saved = page.evaluate("""() => {
      const st = BM.app.ctx.store;
      const res = st.actions.saveLog();
      const rec = (st.state.data.records || [])[0];
      return { ok: !!(res && res.ok),
               stretch: rec && rec.prescription ? rec.prescription.stretch.join(' | ') : '',
               rehab: rec && rec.prescription ? rec.prescription.rehab.join(' | ') : '' };
    }""")
    print('saved-log', saved, flush=True)
    page.wait_for_timeout(800)
    shown = page.evaluate("""() => {
      const rec = (BM.app.ctx.store.state.data.records || [])[0];
      if (!rec) return 'no-record';
      const html = BM.views.log.recordDetail(rec);
      const box = document.createElement('div');
      box.innerHTML = html;
      return box.innerText.indexOf('운동 끝나고 5분') >= 0 ? 'yes' : 'no';
    }""")
    print('record-detail-cool', shown, flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    cspv = page.evaluate("() => window.__csp || []")
    print('overflow', overflow, flush=True)
    print('csp', cspv, flush=True)
    print('not_found', bad[:5], flush=True)
    print('console_errors', len([e for e in errs if 'ERR_FAILED' not in e]), flush=True)
    for e in errs[:8]:
        print('  ', e[:200], flush=True)
    b.close()
