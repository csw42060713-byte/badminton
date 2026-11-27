"""bm-v1.91.0 라이브 점검 — 390×844 라이브 앱에서 종아리·아킬레스 쿨다운 AI가 보이는지

라이브(https://csw42060713-byte.github.io/badminton/)에서
  · sw.js VERSION = bm-v1.91.0
  · 발목 통증 일지에서 '운동 후 5분 종아리·아킬레스 쿨다운' 블록 + 3동작 타이머
  · 콘솔 에러 0 · CSP 위반 0 · 가로 넘침 0 · 404 없음
을 확인하고 captures 를 남깁니다.

  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v191.py
결과: /workspace/downloads/v191_live_ai.png · v191_live_fold.png
"""
import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get('V191_BASE') or 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    errs, bad, csp = [], [], []
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
    page.wait_for_timeout(2500)
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live191@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)

    ver = page.evaluate("""() => fetch('sw.js', {cache: 'no-store'}).then(r => r.text()).then(t => {
      const m = t.match(/var VERSION = '(bm-v[0-9.]+)'/);
      return { sw: m ? m[1] : '?', app: BM.app.version, cool: typeof BM.ai.coolDown };
    })""")
    print('version', ver, flush=True)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.actions;
      st.resetDraft();
      st.setDraft({ cond: 6, intensity: 6, minutes: 50, pain: ['발목'], weakness: ['풋워크'] });
      st.analyze();
      location.hash = '#/log';
    }""")
    page.wait_for_timeout(1200)
    page.evaluate("""() => {
      const f = document.querySelector('details[data-fold="prevent"]');
      if (f) { f.scrollIntoView({block: 'start'}); if (!f.open) f.querySelector('summary').click(); }
    }""")
    page.wait_for_timeout(700)

    info = page.evaluate("""() => {
      const f = document.querySelector('details[data-fold="prevent"]');
      const c = document.querySelector('[data-cool]');
      return {
        fold: f ? f.querySelector('summary').innerText.replace(/\\s+/g, ' ').trim() : null,
        cool: c ? c.getAttribute('data-cool') : null,
        title: c ? (c.querySelector('.planbox__t') || {}).innerText : '',
        items: c ? c.querySelectorAll('li.warm').length : 0,
        timers: document.querySelectorAll('[data-dtimer^="cool:"]').length,
        stretch: (BM.app.ctx.store.state.analysis.care.stretch || []).join(' | ').indexOf('운동 끝나고 5분') >= 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    }""")
    print('live-ai', info, flush=True)

    page.screenshot(path=OUT + '/v191_live_top.png')
    print('saved v191_live_top', flush=True)

    # 쿨다운 블록만 확대 캡처
    page.evaluate("() => document.querySelector('[data-cool]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    box = page.evaluate("""() => { const r = document.querySelector('[data-cool]').getBoundingClientRect();
      return {x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4),
              width: Math.min(390, r.width + 8), height: Math.min(844, r.height + 8)}; }""")
    page.screenshot(path=OUT + '/v191_live_fold.png', clip=box)
    print('saved v191_live_fold', flush=True)
    # 전체 화면(접기 요약 → 쿨다운 블록까지 한 장에) — 보고용
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    page.screenshot(path=OUT + '/v191_live_ai.png', full_page=True)
    print('saved v191_live_ai (full page)', flush=True)

    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    cspv = page.evaluate("() => window.__csp || []")
    print('overflow', overflow, flush=True)
    print('csp', cspv, flush=True)
    print('not_found', [u for u in bad if 'supabase' not in u][:5], flush=True)
    real_errs = [e for e in errs if 'ERR_FAILED' not in e]
    print('console_errors', len(real_errs), flush=True)
    for e in real_errs[:8]:
        print('  ', e[:200], flush=True)
    b.close()
