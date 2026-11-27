"""bm-v1.87.0 캡처 — 레전드 파츠(금속·타월·투톤) · 상태 배지 · 하트 부족 → 광고 시트 ·
상대 라켓 구경 · 되받아치는 스윙(코르크 180°) · 회전 모션 3종.

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v187.py
"""
import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V187C_PORT', '8891'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
ONLY = os.environ.get('V187_ONLY', '')


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
    errs = []
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'shot187@example.com', name: '승우',
        at: new Date().toISOString(), onboardedAt: '2026-11-27 09:00:00',
        profile: { nick: '승우', level: '선수부', discipline: '복식', region: '경기', club: '매원고',
                   onboardedAt: '2026-11-27 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    # 관리자(전체 해금) 상태로 3D 시트 열기
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'csw42060713@gmail.com';
      st.data.hearts = { balance: 1, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1400)

    box = page.evaluate("() => { const r = document.querySelector('.rk3d__cv').getBoundingClientRect();"
                        " return {x:r.x,y:r.y,width:r.width,height:r.height}; }")

    def shot(name, js=None, wait=260, clip=None, full=False):
        if ONLY and ONLY not in name:
            return
        if js:
            page.evaluate(js)
            page.wait_for_timeout(wait)
        page.screenshot(path=OUT + '/%s.png' % name, clip=(clip if clip is not None else (None if full else box)))
        print('saved ' + name, flush=True)

    # 1) 레전드 파츠 — 오닉스 프레임 + 투톤 그립
    shot('v187_legend_onyx_twotone',
         """() => {
           const st = BM.app.ctx.store.state;
           st.me.theme.gear = { custom: { body: 'smash', unlocked: ['frame:onyx','grip:twotone','effect:prism'],
             frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' } };
           BM.racketcustom._last3d.view.yaw = -0.5; BM.racketcustom._last3d.view.pitch = 0.12;
           BM.racketcustom._last3d.fit();
         }""")
    # 2) 타월 그립
    shot('v187_towel_grip',
         """() => {
           const st = BM.app.ctx.store.state;
           st.me.theme.gear.custom = { body: 'control', unlocked: ['frame:carbon','grip:towel','effect:none'],
             frame: 'carbon', string: 'white', grip: 'towel', stencil: 'none', charm: 'none', effect: 'none' };
           BM.racketcustom._last3d.view.yaw = 0.5; BM.racketcustom._last3d.view.pitch = 0.1;
           BM.racketcustom._last3d.fit();
         }""")

    # 3) 상태 배지 — 줄 느슨(4일 휴식)
    page.evaluate("""() => {
      const d = new Date(); d.setDate(d.getDate() - 4);
      const ymd = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'log4', type: '기록', date: ymd, minutes: 60, nick: '승우', userKey: st.me.key }];
      st.me.theme.gear = { custom: { body: 'power77', unlocked: [], frame: 'matte', string: 'lime',
        grip: 'black', stencil: 'none', charm: 'none', effect: 'none' } };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1200)
    shot('v187_state_badge_worn', None, 200, full=False)
    page.screenshot(path=OUT + '/v187_state_badge_worn_full.png')
    print('saved v187_state_badge_worn_full', flush=True)

    # 4) 하트 부족 → 광고로 바로 열기 (파츠 칸 + 시트)
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.email = 'user@example.com';
      st.data.hearts = { balance: 1, adLimit: 5, adUsedToday: 1, adReward: 1, adCooldownSec: 30 };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(900)
    page.screenshot(path=OUT + '/v187_parts_short_hearts.png')
    print('saved v187_parts_short_hearts', flush=True)
    page.evaluate("""() => {
      const btn = document.querySelector('[data-rk-part="frame:onyx"]');
      if (btn) btn.click();
    }""")
    page.wait_for_timeout(700)
    page.screenshot(path=OUT + '/v187_ad_charge_sheet.png')
    print('saved v187_ad_charge_sheet', flush=True)
    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # 5) 되받아치는 스윙 — 임팩트 전/직후/발사
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.me.theme.gear.custom = { body: 'power77', unlocked: ['effect:fire'], frame: 'matte',
        string: 'lime', grip: 'black', stencil: 'none', charm: 'none', effect: 'fire' };
      BM.racketcustom.openSheet(BM.app.ctx);
    }""")
    page.wait_for_timeout(1200)
    # 시점을 기준 각도로 되돌리고 캡처 (오래 두면 살짝 흔들려 각도가 달라집니다)
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.52; s.view.pitch = 0.16; s.fit(); }")
    page.wait_for_timeout(350)
    for name, ms in [('v187_swing_incoming', 200), ('v187_swing_backswing', 280),
                     ('v187_swing_contact', 346), ('v187_swing_follow', 380),
                     ('v187_return_launch', 470), ('v187_return_far', 640)]:
        shot(name, "() => { const s = BM.racketcustom._last3d; s.smash('fire'); s.hold(%d, 'air'); }" % ms)

    # 6) 회전 모션 — 한 바퀴(쇼케이스) 중간 · 트위스트 · 플립
    page.evaluate("() => { const s = BM.racketcustom._last3d; s.view.yaw = -0.52; s.view.pitch = 0.16; s.fit(); }")
    page.wait_for_timeout(300)
    for mid, ms, name in [('showcase', 1400, 'v187_motion_showcase_mid'), ('twist', 700, 'v187_motion_twist'),
                          ('flip', 900, 'v187_motion_flip')]:
        if ONLY and ONLY not in name:
            continue
        page.evaluate("() => BM.racketcustom._last3d.resume()")
        page.wait_for_timeout(180)
        page.evaluate("(a) => { const s = BM.racketcustom._last3d; s.motion(a.id); s.hold(a.ms); }",
                      {'id': mid, 'ms': ms})
        page.wait_for_timeout(230)
        page.screenshot(path=OUT + '/%s.png' % name, clip=box)
        print('saved ' + name, flush=True)

    # 7) 상대 라켓 구경 시트 (매칭 카드)
    page.evaluate("() => BM.racketcustom._last3d.resume()")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.ui.closeSheet && BM.ui.closeSheet()")
    page.wait_for_timeout(400)
    page.click("#tabbar [data-tab='matching']")
    page.wait_for_timeout(900)
    ok_peek = page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const rows = BM.util.readJSON('bm_rows_v1', []) || [];
      rows.push(BM.domain.toRow({ type: '프로필', id: 'p_peek', clientId: 'p_peek',
        createdAt: '2026-11-26 09:00:00', nick: '하늘', userKey: 'u_peek', level: 'B조', region: '경기',
        discipline: '복식',
        theme: { theme: 'th_night', gear: { strungAt: '2026-10-10', cycleDays: 30,
          custom: { body: 'aero', unlocked: ['frame:onyx','grip:twotone','effect:prism','body:aero','charm:ace','stencil:crown','string:gold'],
            frame: 'onyx', string: 'gold', grip: 'twotone', stencil: 'crown', charm: 'ace', effect: 'prism' } } } }));
      BM.util.writeJSON('bm_rows_v1', rows);
      return true;
    }""")
    page.evaluate("() => BM.app.ctx.store.actions.reload().then(() => BM.app.repaint())")
    page.wait_for_timeout(1200)
    page.evaluate("() => { if (BM.views.matching && BM.views.matching.openRacketPeek) BM.views.matching.openRacketPeek(BM.app.ctx, 'u_peek'); }")
    page.wait_for_timeout(800)
    page.screenshot(path=OUT + '/v187_racket_peek.png')
    print('saved v187_racket_peek', flush=True)

    print('console_errors', len(errs), flush=True)
    for e in errs[:10]:
        print('  ', e[:300], flush=True)
    b.close()
