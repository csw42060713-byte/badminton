#!/usr/bin/env python3
"""bm-v1.99.0 — 화면 캡처 & 점검 (390×844 · has_touch)

  ① 후기 카드 한 줄 — 남의 후기: '❤ 를 누르면 이 후기 주인에게 하트 +1'
                     내 후기: '오늘 N/3'
  ② 다른 사람 후기에 ❤ 를 누르면 후기 주인에게 '후기하트' 행이 남고 토스트가 뜬다
  ③ MY 하트 카드에 오늘 N/3 한 줄
  ④ 콘솔 에러 0 · 페이지 에러 0 · 가로 넘침 0

  실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/capture-v199.py
        TS_LIVE=1 ... 라이브(깃허브 페이지)
  결과: /workspace/downloads/v199_*.png · v199_report.json
"""
import base64
import http.server
import json
import os
import socketserver
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = '/workspace/downloads'
PORT = 8799
LIVE = os.environ.get('TS_LIVE', '') == '1'
BASE = ('https://csw42060713-byte.github.io/badminton/index.html?c=%d' % os.getpid() if LIVE
        else 'http://127.0.0.1:%d/index.html' % PORT)

errors = []
page_errors = []
csp = []
checks = []


def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': str(detail)})
    print(('  ✓ ' if ok else '  ✗ ') + name + ((' · ' + str(detail)) if detail else ''), flush=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass


httpd = None
if not LIVE:
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()

SEED = r"""() => {
  const D = BM.domain, U = BM.util;
  const me = 'demo_me';
  const today = U.ymd();
  const gym = (name, floor) => ({ topic: '체육관 후기', gym: { name: name, floor: floor, light: '좋아요', parking: '아쉬워요', shower: '' } });
  const rows = [];
  const push = (e) => rows.push(D.toRow(e));
  /* 사람들 */
  [['demo_chi','콕집사'],['demo_foot','발놀림장인'],['demo_me','승우']].forEach(([k, n]) => {
    push({ id: 'pf_' + k, type: '프로필', createdAt: today + ' 08:00:00', nick: n, userKey: k,
           level: 'C조', discipline: '복식', bio: '같이 쳐요',
           theme: { theme: 'th_night', avatar: '🦋' } });
  });
  /* 남의 체육관 후기 (좋아요 대상) */
  push({ id: 'post_other', type: '소셜', createdAt: today + ' 09:10:00', date: today,
         nick: '콕집사', userKey: 'demo_chi', text: '🏟️ 나래울 배드민턴장\n바닥 좋아요 · 조명 좋아요 · 주차 아쉬워요\n조명이 밝고 바닥이 미끄럽지 않아요.',
         plan: gym('나래울 배드민턴장', '좋아요') });
  /* 내 체육관 후기 (오늘 좋아요 1개 받음) */
  push({ id: 'post_mine', type: '소셜', createdAt: today + ' 08:30:00', date: today,
         nick: '승우', userKey: me, text: '🏟️ 망포 체육관\n바닥 좋아요 · 샤워 좋아요\n샤워실 넓어요.',
         plan: gym('망포 체육관', '좋아요') });
  push({ id: 'rh_1', type: '후기하트', createdAt: today + ' 08:40:00', date: today,
         nick: '콕집사', userKey: 'demo_chi', target: me, team: 'post_mine', likes: 1 });
  localStorage.setItem('bm_rows_v1', JSON.stringify(rows));
  return { rows: rows.length };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    blocked = []
    if not LIVE:
        def route(r):
            u = r.request.url
            if ('supabase.co' in u or 'google' in u or 'jsdelivr' in u):
                blocked.append(u)
                return r.abort()
            return r.continue_()
        ctx.route('**/*', route)
    pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg)

    def on_console(m):
        if m.type == 'error':
            errors.append(m.text)
        if 'Content Security Policy' in (m.text or ''):
            csp.append(m.text)

    pg.on('console', on_console)
    pg.on('pageerror', lambda e: page_errors.append(str(e)))

    def grab(name):
        r = cdp.send('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False})
        path = os.path.join(OUT, name + '.png')
        open(path, 'wb').write(base64.b64decode(r['data']))
        print('saved', os.path.basename(path), flush=True)
        return path

    def overflow():
        return pg.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")

    pg.goto(BASE, wait_until='networkidle')
    pg.evaluate("""() => {
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({kind:'guest', guest:true, name:'승우',
        at:new Date().toISOString(), onboardedAt:'2026-11-28 13:00:00',
        profile:{nick:'승우', level:'C조', discipline:'복식', region:'경기', club:'매원고', onboardedAt:'2026-11-28 13:00:00'}}));
      localStorage.setItem('bm_seen_v1', 'true');
    }""")
    if LIVE and pg.locator('.start__guest').count():
        pg.tap('.start__guest')
        pg.wait_for_timeout(1500)
    print('seed', pg.evaluate(SEED), flush=True)
    pg.evaluate("() => { localStorage.setItem('bm_backend_v1', JSON.stringify('local')); }")
    pg.reload(wait_until='networkidle')
    pg.wait_for_timeout(1600)
    for _ in range(4):
        c = pg.locator('#sheet [data-close]')
        if c.count():
            c.first.click()
            pg.wait_for_timeout(250)
        else:
            break

    # ① 커뮤니티 — 후기 카드 두 장
    pg.tap('[data-tab="community"]')
    pg.wait_for_timeout(700)
    cards = pg.evaluate("""() => {
      const out = [];
      document.querySelectorAll('[data-gymreview]').forEach((el) => {
        out.push({ id: el.getAttribute('data-gymreview'),
                   hint: (el.querySelector('.gymreview__hb') || {}).textContent || '',
                   rows: (el.querySelector('.gymreview__rows') || {}).textContent || '' });
      });
      return out;
    }""")
    print('카드', cards, flush=True)
    check('후기 카드 2장', len(cards) == 2, [c['id'] for c in cards])
    other = [c for c in cards if c['id'] == 'post_other']
    mine = [c for c in cards if c['id'] == 'post_mine']
    check('남의 후기 안내 — "이 후기 주인에게 하트 +1"', other and '이 후기 주인에게 하트 +1' in other[0]['hint'], other)
    check('내 후기 안내 — 오늘 1/3', mine and '오늘 1/3' in mine[0]['hint'], mine)
    check('기존 네 칸(바닥·조명·주차) 그대로', other and '바닥' in other[0]['rows'] and '조명' in other[0]['rows'], other)
    check('커뮤니티 가로 넘침 0', overflow() == 0, overflow())
    grab('v199_feed')

    # ② 남의 후기 ❤ → 하트 +1 · 토스트
    like = pg.locator('[data-like="post_other"]').first
    like.scroll_into_view_if_needed()
    pg.wait_for_timeout(250)
    bb = like.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(700)
    toast = pg.evaluate("() => (document.querySelector('#toast') || {}).textContent || ''")
    after = pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const rows = st.rows.map(BM.domain.fromRow).filter(r => r.type === '후기하트');
      const post = st.data.posts.filter(p => p.id === 'post_other')[0];
      return { likes: post ? post.likes : -1,
               rows: rows.map(r => ({ target: r.target, team: r.team, likes: r.likes, user: r.userKey })),
               toastOn: !!(document.querySelector('#toast') && document.querySelector('#toast').classList.contains('is-on')) };
    }""")
    print('좋아요 뒤', toast, after, flush=True)
    check('남의 후기 좋아요 수 +1', after['likes'] == 1, after['likes'])
    mine_rows = [r for r in after['rows'] if r['team'] == 'post_other']
    check('후기하트 행 1개 (대상=후기 주인)', len(mine_rows) == 1 and mine_rows[0]['target'] == 'demo_chi', after['rows'])
    check('토스트 — 후기 주인에게 하트 +1', '후기 주인에게 하트 +1' in toast, toast)
    grab('v199_like_toast')

    # ③ 좋아요 취소 → 하트는 그대로
    pg.wait_for_timeout(1200)
    bb = like.bounding_box()
    pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2)
    pg.wait_for_timeout(700)
    off = pg.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const rows = st.rows.map(BM.domain.fromRow).filter(r => r.type === '후기하트' && r.team === 'post_other');
      const post = st.data.posts.filter(p => p.id === 'post_other')[0];
      return { likes: post ? post.likes : -1, n: rows.length };
    }""")
    print('취소 뒤', off, flush=True)
    check('취소해도 후기하트 행은 남는다', off['n'] == 1 and off['likes'] == 0, off)

    # ④ MY 하트 카드 — 오늘 1/3
    pg.tap('[data-tab="my"]')
    pg.wait_for_timeout(800)
    if pg.locator('[data-review-line]').count():
        pg.locator('[data-review-line]').first.scroll_into_view_if_needed()
        pg.wait_for_timeout(250)
    line = pg.evaluate("() => (document.querySelector('[data-review-line]') || {}).textContent || ''")
    check('MY 하트 카드 — 내 후기 좋아요 안내', '내 체육관 후기' in line, line)
    check('MY 하트 카드 — 오늘 1/3', '오늘 1/3' in line, line)
    check('MY 가로 넘침 0', overflow() == 0, overflow())
    grab('v199_my_heart')

    print('차단한 외부 요청', blocked[:4], flush=True)
    real_errors = [e for e in errors if 'Failed to load resource' not in e] or ([] if blocked else errors)
    check('콘솔 에러 0', len(real_errors) == 0, real_errors[:3])
    check('페이지 에러 0', len(page_errors) == 0, page_errors[:3])
    check('CSP 위반 0', len(csp) == 0, csp[:2])
    b.close()

if httpd:
    httpd.shutdown()

failed = [c for c in checks if not c['ok']]
print('\n%d/%d 통과' % (len(checks) - len(failed), len(checks)), flush=True)
json.dump({'checks': checks, 'errors': errors, 'page_errors': page_errors, 'csp': csp,
           'passed': len(checks) - len(failed), 'total': len(checks)},
          open(os.path.join(OUT, 'v199_report.json'), 'w'), ensure_ascii=False, indent=1)
if failed:
    raise SystemExit(1)
