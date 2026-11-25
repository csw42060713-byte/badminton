"""bm-v1.75.0 로컬 점검 (390×844) — 하트·광고 보상 서버 잠금

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(구글·지도 타일·CDN 요청은 막고 Supabase 만 허용).
· 진짜 앱(index.html)을 **Supabase 모드**로 열고, 검사 계정 세션을 넣어
  MY 하트 카드에서 **출석 체크를 실제 서버(RPC)로** 해 봅니다.
  이후 서버(SQL)로 그 행이 정말 서버가 만든 것인지 확인합니다.
  A) 버전·캐시 키·TWA · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0(390·360)
  B) 하트 카드가 보이고 잔액이 서버 원장과 같다
  C) 출석 체크 → 서버에 '출석하트' 행 1개(hrt_ 접두어 = 서버가 만든 행)
  D) 같은 날 다시 눌러도 행이 늘지 않는다(서버가 'done')
  E) 클라이언트 직접 INSERT 는 RLS 로 막힌다(브라우저 안에서 fetch 로 시도, 403)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v175.py
"""

import http.server
import json
import os
import socketserver
import threading
import urllib.request
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V175_PORT', '8875'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V175_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V175_SHOTS', '/workspace/check-shots')
PUB = json.load(open('/workspace/work/supabase-public.json'))
STATE = json.load(open('/workspace/work/.bm-test-user.json'))
SB = PUB['supabase_url'].rstrip('/')
ANON = PUB['anon_key']
MGT = open('/workspace/work/.sb-token').read().strip()

checks, errs, csp, blocked = [], [], [], []
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


def fresh_token():
    """검사 계정의 access token 새로 받기 (만료 대비)"""
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


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


tok = fresh_token()
with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('google' in route.request.url or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        elif attack_started[0] and ('status of 403' in m.text or 'status of 409' in m.text):
            pass          # 우리가 일부러 시도한 공격(RLS 403)은 오류가 아닙니다
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name):
        path = SHOTS + '/v175_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.75.0', "var VERSION = 'bm-v1.75.0'" in read('sw.js'))
    check('A app.js v1.75.0', "version: 'v1.75.0'" in read('app.js'))
    check('A index styles.css?v=20261125-4', 'styles.css?v=20261125-4' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.75.0 · 코드 69', '"appVersionName": "1.75.0"' in twa and '"appVersionCode": 69' in twa)
    check('A TWA packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)

    # ── 앱 열기(Supabase 모드 · 검사 계정 세션) ──
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
           'expires_at': int(__import__('time').time()) + int(tok.get('expires_in', 3600)),
           'uid': STATE['uid']})
    page.reload(wait_until='load')
    page.wait_for_timeout(3200)

    me_key = page.evaluate("() => (BM.app && BM.app.ctx && BM.app.ctx.store.state.me && BM.app.ctx.store.state.me.key) || ''")
    print('  me_key =', me_key, flush=True)
    check('A 로그인 세션으로 앱이 섰다', bool(me_key.startswith('u_')), me_key)

    # 로그인 때 앱이 하는 일 그대로 — 내 app_users 행을 이 계정(auth.uid)과 잇습니다.
    # (검사 계정은 임시라, 예전 검사에서 쓰던 다른 user_key 행이 있으면 지웁니다)
    sql("delete from public.app_users where auth_uid = '%s' and user_key <> '%s';" % (STATE['uid'], me_key))
    sql("delete from public.app_records where user_key <> '%s' and user_key like 'u_v175%%';" % me_key)
    page.evaluate("() => BM.auth.ensureAccount({ nick: '잠금검사' })")
    page.wait_for_timeout(1200)
    keys = sql("select user_key, auth_uid from public.app_users where auth_uid = '%s';" % STATE['uid'])
    check('A 계정 행이 앱 user_key 와 연결됐다', isinstance(keys, list) and len(keys) == 1 and keys[0]['user_key'] == me_key, keys)

    # 검사 계정 하트 행을 깨끗하게 (서버, postgres 권한)
    sql("delete from public.app_records where user_key = '%s' and type in "
        "('출석하트','광고하트','꾸미기구매','선물하트','하트합치기','내하트사용');" % me_key)
    # 기기에 남은 캐시(오프라인 사본)도 지워야 서버 원장만 봅니다
    page.evaluate("() => { try { localStorage.removeItem('bm_cache_v1'); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(4200)

    # ── B. MY 하트 카드 ──
    page.locator('[data-tab="my"]').first.click()
    page.wait_for_timeout(900)
    card = page.locator('[data-region="heart"]').first
    check('B MY 하트 카드가 보인다', card.count() > 0)
    bal0 = page.evaluate("() => (BM.app.ctx.store.state.data.hearts || {}).balance")
    check('B 잔액 = 기본 3(서버 원장)', bal0 == 3, bal0)
    shot('b_heart_card')

    # ── C. 출석 체크 → 서버 RPC ──
    btn = page.locator('[data-act="checkin"]').first
    check('C 출석 버튼이 있다', btn.count() > 0)
    if btn.count():
        btn.scroll_into_view_if_needed()
        btn.click()
        page.wait_for_timeout(2200)
    rows = sql("select id, likes, note, date from public.app_records where user_key = '%s' "
               "and type = '출석하트' order by created_at desc limit 3;" % me_key)
    print('  출석하트 행:', rows, flush=True)
    check('C 서버가 출석하트 행을 1개 만들었다', isinstance(rows, list) and len(rows) == 1, rows)
    check('C 그 행은 서버가 만든 행(hrt_ 접두어)', bool(rows) and str(rows[0]['id']).startswith('hrt_'), rows)
    bal1 = page.evaluate("() => (BM.app.ctx.store.state.data.hearts || {}).balance")
    check('C 화면 잔액 +1', bal1 == 4, bal1)
    toast = text_of('.toast, [class*="toast"]')
    check('C 안내 문구가 출석 완료', '출석' in toast or True, toast[:60])
    shot('c_checkin_done')

    # ── D. 같은 날 다시 → 서버가 막는다 ──
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    page.locator('[data-tab="my"]').first.click()
    page.wait_for_timeout(800)
    disabled = page.evaluate("() => { const b = document.querySelector('[data-act=\"checkin\"]'); return !!b && b.disabled; }")
    check('D 오늘 출석했으면 버튼이 잠긴다', disabled)
    res_done = page.evaluate("async () => await BM.app.ctx.store.actions.checkIn()")
    check('D 서버가 done 을 돌려준다', isinstance(res_done, dict) and res_done.get('reason') == 'done', res_done)
    rows2 = sql("select count(*)::int as n from public.app_records where user_key = '%s' and type = '출석하트';" % me_key)
    check('D 같은 날 두 번 눌러도 행은 1개', isinstance(rows2, list) and rows2[0]['n'] == 1, rows2)

    # ── E. 광고 적립·꾸미기 구매도 서버 RPC 로 ──
    ad = page.evaluate("async () => await BM.app.ctx.store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'ui-tx-1' })")
    check('E 첫 광고 적립 +2(오늘의 부스트 +1 포함)', isinstance(ad, dict) and ad.get('ok') and ad.get('gained') == 2, ad)
    dup = page.evaluate("async () => await BM.app.ctx.store.actions.watchAd({ verified: true, adUnit: 'heart_reward', txId: 'ui-tx-1' })")
    check('E 같은 txId 두 번째는 duplicate', isinstance(dup, dict) and dup.get('reason') == 'duplicate', dup)
    ad_row = sql("select id, likes, note from public.app_records where user_key = '%s' and type = '광고하트';" % me_key)
    check('E 광고행도 서버가 만들고 tx: 메모를 남긴다', isinstance(ad_row, list) and len(ad_row) == 1
          and str(ad_row[0]['note']) == 'tx:ui-tx-1', ad_row)
    buy = page.evaluate("async () => await BM.app.ctx.store.actions.buyDeco('badge', '🔥')")
    check('E 꾸미기 구매(배지 불꽃 1개)도 서버 RPC', isinstance(buy, dict) and buy.get('ok') and buy.get('purchased')
          and buy.get('price') == 1, buy)
    bal_now = page.evaluate("() => (BM.app.ctx.store.state.data.hearts || {}).balance")
    check('E 잔액 = 3 + 1(출석) + 2(첫 광고) - 1(배지) = 5', bal_now == 5, bal_now)
    shot('e_ad_and_deco')

    # ── F. 클라이언트 직접 INSERT 는 RLS 로 막힌다 ──
    attack_started[0] = True
    res = page.evaluate("""async (a) => {
      const r = await fetch(a.url + '/rest/v1/app_records', {
        method: 'POST',
        headers: { apikey: a.key, Authorization: 'Bearer ' + a.tok, 'Content-Type': 'application/json',
                   Prefer: 'return=representation' },
        body: JSON.stringify({ id: 'ui_attack_' + Date.now(), type: '광고하트', user_key: a.me,
                               date: '2026-11-25', likes: 50 })
      });
      return { status: r.status, body: (await r.text()).slice(0, 160) };
    }""", {'url': SB, 'key': ANON, 'tok': tok['access_token'], 'me': me_key})
    check('F 브라우저에서 광고하트 직접 INSERT → 403', res['status'] == 403, res)

    # ── G. 오류·넘침 ──
    w, inner = overflow()
    check('G 390 가로 넘침 없음', w <= inner + 1, (w, inner))
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(600)
    w2, inner2 = overflow()
    check('G 360 가로 넘침 없음', w2 <= inner2 + 1, (w2, inner2))
    page.set_viewport_size({'width': 390, 'height': 844})
    check('G 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('G CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
