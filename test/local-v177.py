"""bm-v1.77.0 로컬 점검 (390×844) — 🔔 푸시 토큰 저장 + 발송 서버 틀

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 화면에서 확인합니다.
  A) 버전·캐시 키·TWA·새 파일(js/push.js) · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  B) MY › 알림 · 편지지에 '실시간 알림(앱 켜짐)' · '백그라운드 푸시(앱 닫힘)' 두 줄
  C) window.ShuttlixPush.register 로 앱이 토큰을 넘기면 '앱에 연결됨' 으로 바뀐다
  D) 채팅 전송 직후 알림 훅이 불려도(체험 모드) 네트워크·콘솔 오류 없이 메시지는 그대로 저장된다
  E) 390·360 가로 넘침 없음
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v177.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V177_PORT', '8877'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V177_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V177_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def serve():
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    httpd = serve()
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
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
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name, keep=False):
        path = SHOTS + '/v177_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v177_' + name + '.png')
        return path

    def tap(sel, wait=420):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def has(sel):
        return page.locator(sel).count() > 0

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    def login(nick='승우'):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check177@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2600)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.77.0', "var VERSION = 'bm-v1.77.0'" in read('sw.js'))
    check('A sw.js 가 js/push.js 를 캐시한다', "'./js/push.js'" in read('sw.js'))
    check('A index styles.css?v=20261125-6', 'styles.css?v=20261125-6' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.77.0 · 코드 71', '"appVersionName": "1.77.0"' in twa and '"appVersionCode": 71' in twa)
    check('A TWA packageId 그대로', '"packageId": "io.github.csw42060713_byte.badminton"' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1800)
    login('승우')
    check('A 앱 버전 v1.77.0', page.evaluate("() => BM.app.version") == 'v1.77.0',
          page.evaluate("() => BM.app.version"))
    check('A window.ShuttlixPush 브리지가 열려 있다',
          page.evaluate("() => !!(window.ShuttlixPush && window.ShuttlixPush.register)"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. MY › 알림 · 편지지 두 줄 ──
    tap("#tabbar [data-tab='my']", 1200)
    page.evaluate("() => { const d = document.querySelector(\"details[data-group='alarm']\"); if (d) d.open = true; }")
    page.wait_for_timeout(500)
    grp = page.locator("details[data-group='alarm']").first
    if grp.count():
        grp.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    check('B 실시간 푸시 알림 스위치 그대로', has("[data-act='toggle-push']"))
    live = text_of("[data-push-step='live']")
    bg = text_of("[data-push-step='bg']")
    check('B 실시간 알림(앱 켜짐) 줄', '실시간 알림 (앱 켜짐)' in live, live[:80])
    check('B 백그라운드 푸시(앱 닫힘) 줄', '백그라운드 푸시 (앱 닫힘)' in bg, bg[:80])
    badge = text_of("[data-push-step='bg'] .pushstep__b").strip()
    hint = text_of("[data-push-step='bg'] .pushstep__s").strip()
    check('B 백그라운드 상태 배지', badge in ('스토어 앱 연결 준비', 'Firebase 키 대기', '알림 차단됨'), badge)
    check('B 백그라운드 안내 한 줄', len(hint) > 8, hint)
    live_badge = text_of("[data-push-step='live'] .pushstep__b").strip()
    check('B 실시간 상태 배지', live_badge in ('꺼짐', '권한 필요', '켜짐'), live_badge)
    shot('b_my_push_steps', keep=True)

    # ── C. 네이티브 브리지로 토큰 등록 → '앱에 연결됨' ──
    tok = page.evaluate("() => window.ShuttlixPush.register('local-check-token-123456', 'android')")
    page.wait_for_timeout(500)
    saved = page.evaluate("() => (BM.push.token() || {}).token || ''")
    check('C 토큰이 기기에 저장된다', saved == 'local-check-token-123456', saved)
    page.evaluate("() => { if (BM.app.ctx) { BM.app.repaint(); } }")
    page.wait_for_timeout(700)
    page.evaluate("() => { const d = document.querySelector(\"details[data-group='alarm']\"); if (d) d.open = true; }")
    page.wait_for_timeout(400)
    bg2 = text_of("[data-push-step='bg']")
    check('C 백그라운드가 "앱에 연결됨" 으로 바뀐다',
          text_of("[data-push-step='bg'] .pushstep__b").strip() == '앱에 연결됨', bg2[:120])
    check('C 상태 id = linked', page.evaluate("() => BM.push.background().id") == 'linked')
    grp = page.locator("details[data-group='alarm']").first
    if grp.count():
        grp.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
    shot('c_my_push_linked', keep=True)

    # ── D. 채팅 전송 — 알림 훅이 불려도 메시지는 그대로, 네트워크 오류 없음 ──
    page.evaluate("""() => {
      const D = BM.domain, me = BM.app.ctx.store.state.me.key || 'u_me';
      const rows = [
        D.toRow({ id: 'pv_me', type: '프로필', createdAt: '2026-11-20 09:00:00', nick: '승우', userKey: me, level: 'B조', discipline: '복식' }),
        D.toRow({ id: 'pv_other', type: '프로필', createdAt: '2026-11-20 09:05:00', nick: '민호', userKey: 'demo_chi', level: 'B조', discipline: '복식' }),
        D.toRow({ id: 'fr_177', type: '친구수락', createdAt: '2026-11-21 10:00:00', nick: '승우', userKey: me, target: 'demo_chi' })
      ];
      const key = BM.auth.rowsKeyFor(BM.auth.session());
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    blocked_before = len(blocked)
    tap("#hdrChat", 700)
    check('D 채팅 목록에 친구 방이 있다', has("[data-thread='fr_177']"),
          page.evaluate("() => BM.app.ctx.store.state.data.threads.map(t => t.roomId)"))
    tap("[data-thread='fr_177']", 800)
    check('D 1:1 대화방 입력칸', has("[data-dm-form] [data-dm-input]"))
    page.fill("[data-dm-form] [data-dm-input]", '오늘 7시 어때요?')
    tap("[data-dm-form] button[type='submit']", 900)
    body = page.locator('.dmsg--me').last.inner_text() if page.locator('.dmsg--me').count() else ''
    check('D 보낸 메시지가 화면에 남는다', '오늘 7시 어때요?' in body, body[:120])
    n_rows = page.evaluate("""() => BM.app.ctx.store.state.rows.filter(r => String(r[BM.domain.COL['유형']]) === '매칭채팅').length""")
    check('D 메시지가 저장소에 한 줄 들어간다', n_rows == 1, n_rows)
    check('D 체험 모드에서는 알림을 보내지 않는다(네트워크 요청 없음)', len(blocked) == blocked_before,
          blocked[blocked_before:])
    check('D 체험 모드 notify = not_remote',
          page.evaluate("() => BM.push.notify('chat', { to: 'demo_chi', mode: 'local', me: { key: 'me' }, text: 'x' }).then(r => r.status)") == 'not_remote')
    shot('d_chat_sent', keep=True)

    # ── E. 넘침 · 오류 ──
    w = overflow()
    check('E 390 가로 넘침 없음', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(600)
    w2 = overflow()
    check('E 360 가로 넘침 없음', w2[0] <= w2[1], w2)
    page.evaluate("() => BM.app.ctx.actions.setTab('my')")
    page.wait_for_timeout(800)
    check('E 앱 오류 0', len(errs) == 0, errs[:3])
    check('E CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
