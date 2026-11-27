"""bm-v1.92.0 라이브 검증 — 신규 임시 계정 2개로
  ① 1:1 매칭 신청 → ② 상대 수락 → ③ 새로고침 후에도 수락·하트 -2·대화방 유지
  ④ 두 계정 탈퇴(앱 회원 탈퇴) 시 /auth/v1/logout 403 0건 확인 → 데이터 정리

라이브: https://csw42060713-byte.github.io/badminton/
실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v192.py
결과: /workspace/downloads/v192_live_*.png
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
STATE = '/workspace/tmp/v192_live'
os.makedirs(OUT, exist_ok=True)
os.makedirs(STATE, exist_ok=True)

stamp = str(int(time.time()))[-6:]
NOTE = '토요일 오전 9시 나래울에서 같이 쳐요!'
A = {'email': f'bmw192{stamp}a@badminton-app.com', 'pw': 'BmTest!2026a', 'nick': f'K192A{stamp[-3:]}'}
B = {'email': f'bmw192{stamp}b@badminton-app.com', 'pw': 'BmTest!2026b', 'nick': f'K192B{stamp[-3:]}'}
res = {}


class S:
    def __init__(self, ctx, page, name):
        self.ctx, self.page, self.name = ctx, page, name
        self.console, self.http = [], []
        page.on('console', lambda m: self.console.append((m.type, m.text[:300])))
        page.on('pageerror', lambda e: self.console.append(('pageerror', str(e)[:300])))
        page.on('response', self._resp)

    def _resp(self, r):
        if r.status >= 400:
            self.http.append((r.status, r.url[:160]))

    def text(self, n=2000):
        return self.page.evaluate('(n) => document.body.innerText.slice(0,n)', n)

    def errs(self):
        return [e for e in self.console
                if e[0] in ('error', 'pageerror') and 'accounts.google.com' not in e[1]
                and 'vibrate' not in e[1] and 'send-push' not in e[1]]

    def bad(self):
        return [h for h in self.http if 'send-push' not in h[1] and 'favicon' not in h[1]]


def new_ctx(br, name, state=None):
    kw = dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True,
              has_touch=True, locale='ko-KR', timezone_id='Asia/Seoul', service_workers='block')
    if state:
        kw['storage_state'] = state
    ctx = br.new_context(**kw)
    page = ctx.new_page()
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(3500)
    return S(ctx, page, name)


def signup(s, acc):
    s.page.get_by_text('이메일로 로그인 · 회원가입').click()
    s.page.wait_for_timeout(1000)
    s.page.click('[data-act="mode"][data-mode="signup"]')
    s.page.wait_for_timeout(500)
    s.page.fill('input[data-f="email"]', acc['email'])
    s.page.fill('input[data-f="password"]', acc['pw'])
    s.page.fill('input[data-f="nick"]', acc['nick'])
    s.page.click('[data-act="submit"]')
    s.page.wait_for_timeout(4500)


def onboard(s, nick):
    for sel in ['[data-pick="role"][data-val="player"]', '[data-pick="level"][data-val="B조"]',
                '[data-pick="discipline"][data-val="복식"]', '[data-pick="gender"][data-val="남성"]',
                '[data-pick="region"][data-val="경기"]']:
        try:
            s.page.click(sel, timeout=4000)
            s.page.wait_for_timeout(250)
        except Exception:
            pass
    s.page.fill('#onbClub', '나래울')
    s.page.click('[data-act="finish"]')
    s.page.wait_for_timeout(4000)


def tab(s, t, wait=2500):
    s.page.evaluate("(t) => { const b=document.querySelector(\"#tabbar [data-tab='\"+t+\"']\"); if(b) b.click(); }", t)
    s.page.wait_for_timeout(wait)


def hearts(s):
    return s.page.evaluate("""() => [...document.querySelectorAll('header button')]
      .filter(e => /^\\d+$/.test(e.innerText.trim())).map(e => e.innerText.trim())""")


with sync_playwright() as p:
    br = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None,
                           args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for tag, acc in [('A', A), ('B', B)]:
        s = new_ctx(br, f'L192{tag}')
        signup(s, acc)
        s.page.fill('#onbNick', acc['nick'])
        onboard(s, acc['nick'])
        acc['key'] = s.page.evaluate('() => BM.auth.meKeyFor(BM.auth.session())')
        print(tag, '가입', acc['email'], acc['key'], 'version', s.page.evaluate('() => BM.app.version'), flush=True)
        s.ctx.storage_state(path=f'{STATE}/{tag}.json')
        s.ctx.close()

    As = new_ctx(br, 'L192A2', state=f'{STATE}/A.json')
    Bs = new_ctx(br, 'L192B2', state=f'{STATE}/B.json')

    tab(As, 'matching')
    before = hearts(As)
    As.page.click(f'button[data-open-profile="{B["key"]}"]')
    As.page.wait_for_timeout(1500)
    As.page.fill('[data-note]', NOTE)
    As.page.click('[data-send-request]')
    As.page.wait_for_timeout(1500)
    As.page.click('[data-letter-send]')
    As.page.wait_for_timeout(2500)
    tab(Bs, 'matching')
    Bs.page.click('[data-match-tab="in"]')
    Bs.page.wait_for_timeout(1500)
    print('B 요청 도착:', NOTE in Bs.text(600), flush=True)
    Bs.page.click('button[data-accept]')
    Bs.page.wait_for_timeout(3000)
    print('B 토스트:', Bs.page.evaluate("() => (document.querySelector('.toast')||{}).innerText||''"), flush=True)

    As.page.reload(wait_until='load'); As.page.wait_for_timeout(5500)
    Bs.page.reload(wait_until='load'); Bs.page.wait_for_timeout(5500)
    tab(As, 'matching')
    tab(Bs, 'matching')
    As.page.evaluate("() => { const t=document.querySelector('[data-match-tab=\"out\"]'); if(t) t.click(); }")
    Bs.page.evaluate("() => { const t=document.querySelector('[data-match-tab=\"in\"]'); if(t) t.click(); }")
    As.page.wait_for_timeout(2000)
    Bs.page.wait_for_timeout(2000)
    a_text, b_text = As.text(2000), Bs.text(2000)
    print('A 새로고침 후:', a_text.replace('\n', ' | ')[:400], flush=True)
    print('B 새로고침 후:', b_text.replace('\n', ' | ')[:400], flush=True)
    res['A 수락 유지'] = '채팅하기' in a_text
    res['A 하트 3-2'] = hearts(As) == ['1']
    res['B 수락함'] = '수락함' in b_text
    As.page.screenshot(path=OUT + '/v192_live_match_accepted.png')
    Bs.page.screenshot(path=OUT + '/v192_live_b_after_reload.png')
    print('결과', json.dumps(res, ensure_ascii=False), flush=True)
    As.ctx.close()
    Bs.ctx.close()

    # 탈퇴 — DM 이 화면을 덮지 않도록 새 컨텍스트에서
    for tag in ['A', 'B']:
        s = new_ctx(br, f'L192D{tag}', state=f'{STATE}/{tag}.json')
        s.page.evaluate("() => { const dm=document.getElementById('dm'); if(dm) dm.hidden=true; }")
        tab(s, 'my')
        s.page.evaluate("""() => { const d=[...document.querySelectorAll('details.group')]
          .find(x => /개인정보/.test((x.querySelector('summary')||{}).innerText||''));
          if (d) { d.open = true; d.scrollIntoView({block:'center'}); } }""")
        s.page.wait_for_timeout(1200)
        s.page.click('[data-act="delete-account"]')
        s.page.wait_for_timeout(1200)
        s.page.fill('[data-delete-word]', '탈퇴')
        s.page.wait_for_timeout(400)
        s.page.click('[data-act="confirm-delete"]')
        s.page.wait_for_timeout(7000)
        gate = '이메일로 로그인' in s.text(250)
        logout403 = len([h for h in s.http if 'logout' in h[1] and h[0] == 403])
        print(tag, '탈퇴 → 시작화면:', gate, '| logout 403:', logout403, '| http>=400:', s.bad()[-3:], flush=True)
        res[f'{tag} 탈퇴'] = gate
        res[f'{tag} logout403'] = logout403
        s.page.screenshot(path=f'{OUT}/v192_live_{tag}_deleted.png')
        s.ctx.close()
    br.close()

print('FINAL', json.dumps(res, ensure_ascii=False), flush=True)
print('계정', A['email'], B['email'], flush=True)
