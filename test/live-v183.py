"""bm-v1.85.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  A) 버전 — BM.app.version v1.85.0 · 새 AI 함수(fatigueJump·guardChain) · 5개 탭
  B) 피로 점프 — 컨디션 3 + 스매시 저장 → '피로할 때 점프 스매시' 접기 ·
                 점프가 평소보다 낮아지고 · 네트 앞 짧은 볼 · 참고 논문(Cheng 2024)
  C) 연쇄 보호 — 무릎 통증 저장 → 관절 보호 체크 안 '무릎 → 허리 연쇄 보호' · 사이드 플랭크
  D) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  캡처: /workspace/downloads/v183_live_ai.png · v183_live_chain.png

· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v183.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V183_OUT', '/workspace/downloads')

errs, csp, checks = [], [], []


def ck(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    # 내 사이트는 그대로, 바깥 서비스(로그인·DB·지도 타일)만 막습니다
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'accounts.google' in r.request.url
                  or 'tile.openstreetmap.org' in r.request.url)
              else r.continue_())
    pg = ctx.new_page()

    def on_c(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:200])
            return
        if 'net::ERR_' in m.text:
            return
        errs.append(m.text[:200])

    pg.on('console', on_c)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    pg.goto(BASE, wait_until='load')
    pg.wait_for_timeout(2500)
    pg.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      const s = { kind: 'email', email: 'live183@example.com', name: '승우',
                  at: new Date().toISOString(), onboardedAt: '2026-11-26 16:00:00',
                  profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기',
                             club: '나래울체육관', onboardedAt: '2026-11-26 16:00:00' } };
      localStorage.setItem('bm_auth_v1', JSON.stringify(s));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    pg.reload(wait_until='load')
    pg.wait_for_timeout(3000)

    ck('LIVE 버전 v1.85.0', pg.evaluate("() => BM.app.version") == 'v1.85.0',
       pg.evaluate("() => BM.app.version"))
    ck('LIVE 새 AI 함수', pg.evaluate(
        "() => typeof BM.ai.fatigueJump === 'function' && typeof BM.ai.guardChain === 'function'"))
    ck('LIVE 5개 탭', pg.evaluate("() => BM.app.TABS.map(t => t.id).join(',')") == 'log,matching,community,coach,my')

    # ── 피로 점프 ──
    pg.evaluate("""() => { const st = BM.app.ctx.store;
      st.actions.setDraft({ date: BM.util.ymd(), cond: 3, intensity: 6, minutes: 50,
                            weakness: ['스매시'], done: ['스트록'], pain: [] }); }""")
    pg.wait_for_timeout(400)
    pg.evaluate("() => BM.app.ctx.store.actions.saveLog()")
    pg.wait_for_timeout(1800)
    ck('LIVE 피로 점프 접기', pg.locator('[data-fold="jump"]').count() > 0)
    pg.locator('[data-fold="jump"] summary').first.scroll_into_view_if_needed()
    pg.locator('[data-fold="jump"] summary').first.click()
    pg.wait_for_timeout(600)
    t = pg.locator('[data-fold="jump"]').first.inner_text()
    ck('LIVE 점프가 평소보다 낮아지고', '점프가 평소보다 낮아지고' in t)
    ck('LIVE 네트 앞 짧은 볼 전환', '네트 앞 짧은 볼' in t)
    ck('LIVE 참고 논문', 'Cheng 2024' in t)
    pg.screenshot(path=OUT + '/v183_live_ai.png')
    print('  saved ' + OUT + '/v183_live_ai.png', flush=True)

    # ── 연쇄 보호 ──
    pg.evaluate("""() => { const st = BM.app.ctx.store;
      st.actions.setDraft({ date: BM.util.ymd(), cond: 7, intensity: 6, minutes: 50,
                            weakness: ['풋워크'], pain: ['무릎'], done: [] }); }""")
    pg.wait_for_timeout(400)
    pg.evaluate("() => BM.app.ctx.store.actions.saveLog()")
    pg.wait_for_timeout(1800)
    pg.evaluate("""() => { const f = document.querySelector('[data-fold="guard"]');
      if (f && !f.open) f.querySelector('summary').click(); }""")
    pg.wait_for_timeout(700)
    g = pg.locator('[data-fold="guard"]').first.inner_text()
    ck('LIVE 무릎 → 허리 연쇄 보호', '무릎 → 허리 연쇄 보호' in g and '사이드 플랭크' in g)
    moved = pg.evaluate("""() => {
      const boxes = [...document.querySelectorAll('[data-fold="guard"] .planbox')];
      const x = boxes.find(b => b.textContent.indexOf('무릎 → 허리 연쇄') >= 0);
      if (!x) return false;
      x.scrollIntoView({ block: 'start' });
      return true;
    }""")
    pg.wait_for_timeout(600)
    pg.screenshot(path=OUT + '/v183_live_chain.png')
    print('  saved chain shot: ' + str(moved), flush=True)

    sw, iw = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    ck('LIVE 390 가로 넘침 0', sw <= iw + 1, (sw, iw))
    ck('LIVE 콘솔 오류 0', len(errs) == 0, errs[:3])
    ck('LIVE CSP 위반 0', len(csp) == 0, csp[:2])
    b.close()

bad = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(bad), len(checks)), flush=True)
if bad:
    for label, _ in bad:
        print(' FAIL: ' + label)
