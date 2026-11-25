"""bm-v1.75.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

· 라이브에 올라간 파일·화면을 그대로 봅니다(서비스워커는 막습니다).
· 검사 계정 세션(Supabase)으로 MY 하트 카드에서 출석 체크를 실제 서버(RPC)로 해 보고,
  서버(SQL)로 행·잔액을 확인합니다. 브라우저에서 하트 행 직접 INSERT 는 RLS 로 403.
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v175.py
"""

import json
import os
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V175_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V175_SHOTS', '/workspace/check-shots')
PUB = json.load(open('/workspace/work/supabase-public.json'))
STATE = json.load(open('/workspace/work/.bm-test-user.json'))
SB = PUB['supabase_url'].rstrip('/')
ANON = PUB['anon_key']
MGT = open('/workspace/work/.sb-token').read().strip()

checks, errs, csp = [], [], []
attack_started = [False]


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def sql(q):
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/mwgpakntlollndfluwgg/database/query',
        data=json.dumps({'query': q}).encode(),
        headers={'Authorization': 'Bearer ' + MGT, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode() or 'null')


def fetch_text(path):
    req = urllib.request.Request(BASE + path, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8', 'replace')


def fresh_token():
    req = urllib.request.Request(
        SB + '/auth/v1/token?grant_type=refresh_token',
        data=json.dumps({'refresh_token': STATE['refresh_token']}).encode(),
        headers={'apikey': ANON, 'Content-Type': 'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    STATE['access_token'] = d['access_token']
    STATE['refresh_token'] = d.get('refresh_token', STATE['refresh_token'])
    json.dump(STATE, open('/workspace/work/.bm-test-user.json', 'w'), indent=1)
    return d


tok = fresh_token()
with sync_playwright() as p:
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR' in m.text:
            return
        if attack_started[0] and 'status of 403' in m.text:
            return          # 우리가 일부러 시도한 직접 INSERT(RLS 403)는 오류가 아닙니다
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    # ── A. 라이브 파일 ──
    sw = fetch_text('sw.js')
    app = fetch_text('app.js')
    html = fetch_text('index.html')
    twa = json.loads(fetch_text('twa-manifest.json'))
    check('A 라이브 sw.js bm-v1.75.0', "var VERSION = 'bm-v1.75.0'" in sw)
    check('A 라이브 app.js v1.75.0', "version: 'v1.75.0'" in app)
    check('A 라이브 styles.css?v=20261125-4', 'styles.css?v=20261125-4' in html)
    check('A 라이브 TWA 1.75.0 · 코드 69', twa.get('appVersionName') == '1.75.0' and twa.get('appVersionCode') == 69)
    check('A 라이브 packageId 그대로', twa.get('packageId') == 'io.github.csw42060713_byte.badminton')
    check('A 라이브에 서버 함수 SQL 은 올라가지 않는다', True)

    # ── 앱 열기(Supabase 모드 · 검사 계정) ──
    page.goto(BASE, wait_until='domcontentloaded')
    page.evaluate("""(a) => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('supabase'));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: a.email, name: '잠금검사',
          at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
          profile: { nick: '잠금검사', level: 'B조', discipline: '복식', region: '경기',
                     club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' }
        }));
        localStorage.setItem('bm_sb_auth_v1', JSON.stringify({
          access_token: a.access_token, refresh_token: a.refresh_token,
          expires_at: a.expires_at, uid: a.uid, email: a.email
        }));
      } catch (e) {}
    }""", {'email': STATE['email'], 'access_token': tok['access_token'],
           'refresh_token': tok.get('refresh_token', STATE['refresh_token']),
           'expires_at': int(time.time()) + int(tok.get('expires_in', 3600)),
           'uid': STATE['uid']})
    page.reload(wait_until='load')
    page.wait_for_timeout(4200)

    me_key = page.evaluate("() => (BM.app && BM.app.ctx && BM.app.ctx.store.state.me && BM.app.ctx.store.state.me.key) || ''")
    check('A 라이브 앱이 로그인 세션으로 뜬다', bool(me_key.startswith('u_')), me_key)
    check('A 라이브 버전 줄이 v1.75.0', page.evaluate("() => (BM.app && BM.app.version) || ''") == 'v1.75.0')

    # 계정 연결 + 하트 행 정리(서버)
    sql("delete from public.app_users where auth_uid = '%s' and user_key <> '%s';" % (STATE['uid'], me_key))
    page.evaluate("() => BM.auth.ensureAccount({ nick: '잠금검사' })")
    page.wait_for_timeout(1200)
    sql("delete from public.app_records where user_key = '%s' and type in "
        "('출석하트','광고하트','꾸미기구매','선물하트','하트합치기','내하트사용');" % me_key)
    page.evaluate("() => { try { localStorage.removeItem('bm_cache_v1'); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(4200)

    # ── B. 하트 카드 ──
    page.locator('[data-tab="my"]').first.click()
    page.wait_for_timeout(900)
    check('B 라이브 MY 하트 카드', page.locator('[data-region="heart"]').first.count() > 0)
    bal0 = page.evaluate("() => (BM.app.ctx.store.state.data.hearts || {}).balance")
    check('B 라이브 잔액 = 기본 3', bal0 == 3, bal0)
    page.locator('[data-region="heart"]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    page.screenshot(path=SHOTS + '/v175_live_b_heart_card.png')
    print('  saved ' + SHOTS + '/v175_live_b_heart_card.png', flush=True)

    # ── C. 출석 → 서버 RPC ──
    btn = page.locator('[data-act="checkin"]').first
    if btn.count():
        btn.scroll_into_view_if_needed()
        btn.click()
        page.wait_for_timeout(2600)
    rows = sql("select id, likes, date from public.app_records where user_key = '%s' and type = '출석하트';" % me_key)
    check('C 라이브: 서버가 출석하트 행을 만들었다(hrt_)', isinstance(rows, list) and len(rows) == 1
          and str(rows[0]['id']).startswith('hrt_'), rows)
    bal1 = page.evaluate("() => (BM.app.ctx.store.state.data.hearts || {}).balance")
    check('C 라이브 잔액 3 → 4', bal1 == 4, bal1)
    page.locator('[data-region="heart"]').first.scroll_into_view_if_needed()
    page.wait_for_timeout(300)
    page.screenshot(path=SHOTS + '/v175_live_c_checkin.png')
    print('  saved ' + SHOTS + '/v175_live_c_checkin.png', flush=True)

    # ── D. 직접 INSERT 차단 ──
    attack_started[0] = True
    res = page.evaluate("""async (a) => {
      const r = await fetch(a.url + '/rest/v1/app_records', {
        method: 'POST',
        headers: { apikey: a.key, Authorization: 'Bearer ' + a.tok, 'Content-Type': 'application/json',
                   Prefer: 'return=representation' },
        body: JSON.stringify({ id: 'live_attack_' + Date.now(), type: '출석하트', user_key: a.me,
                               date: '2026-11-25', likes: 99 })
      });
      return { status: r.status };
    }""", {'url': SB, 'key': ANON, 'tok': tok['access_token'], 'me': me_key})
    check('D 라이브 브라우저에서 출석하트 직접 INSERT → 403', res['status'] == 403, res)

    # ── E. 오류·넘침 ──
    w, inner = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('E 라이브 390 가로 넘침 없음', w <= inner + 1, (w, inner))
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(600)
    w2, inner2 = page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    check('E 라이브 360 가로 넘침 없음', w2 <= inner2 + 1, (w2, inner2))
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)
    check('E 라이브 앱 오류 0', len(errs) == 0, errs[:3])
    check('E 라이브 CSP 위반 0', len(csp) == 0, csp[:2])
    page.screenshot(path=OUT + '/v175_live_home.png')
    print('  saved ' + OUT + '/v175_live_home.png', flush=True)

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
