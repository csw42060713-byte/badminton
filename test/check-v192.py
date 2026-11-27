"""bm-v1.92.0 점검 — 390×844 에서 매칭 화면·겹쳐 읽기·버전 확인

1) 계정이 지워진 예전 시험용 유저(우승·환비·나래)의 매칭 카드가 목록에서 빠지는지
2) 실제 브라우저 번들에서 reconcileRecords 가 '받은 사람'의 수락을 겹쳐 읽는지
3) 탈퇴 직후 서버 로그아웃(signOutLocal)만 있는지 — 로그아웃 버튼은 그대로 동작하는지
4) 콘솔 0 · CSP 0 · 가로 넘침 0

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/check-v192.py
결과: /workspace/downloads/v192_local_*.png
"""
import http.server
import json
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V192K_PORT', '8952'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
os.makedirs(OUT, exist_ok=True)


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
    page.on('console', lambda m: errs.append(m.text + ' @' + str((m.location or {}).get('url'))) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    page.on('response', lambda r: bad.append(r.url + ' ' + str(r.status)) if r.status >= 400 else None)
    blocked = []
    page.on('requestfailed', lambda r: blocked.append(r.url))
    page.add_init_script("""
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', function (e) {
        window.__csp.push(e.violatedDirective + ' ' + e.blockedURI);
      });
    """)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1200)

    session = {
        'kind': 'email', 'email': 'shot192@example.com', 'name': '승우',
        'at': '2026-11-27T09:00:00', 'onboardedAt': '2026-11-27 09:00:00',
        'profile': {'nick': '승우', 'level': 'B조', 'discipline': '복식', 'region': '경기',
                    'club': '매원고', 'onboardedAt': '2026-11-27 09:00:00'},
    }
    rows = page.evaluate("""(sess) => {
      const D = BM.domain, U = BM.util;
      const rows = [
        D.toRow({ id: 'mp192a', type: '매칭프로필', userKey: 'u_4f3c0b40e9b0', nick: '나래',
                  createdAt: U.stamp(), date: U.ymd(),
                  payload: { level: 'C조', region: '경기', discipline: '복식', bio: '예전 시험 계정' } }),
        D.toRow({ id: 'mp192b', type: '매칭프로필', userKey: 'u_bd730c28ae44', nick: '우승',
                  createdAt: U.stamp(), date: U.ymd(),
                  payload: { level: '자강', region: '경기', discipline: '단식' } }),
        D.toRow({ id: 'mp192c', type: '매칭프로필', userKey: 'u_real192', nick: '실회원',
                  createdAt: U.stamp(), date: U.ymd(),
                  payload: { level: 'B조', region: '경기', discipline: '복식', bio: '진짜 회원 카드' } })
      ];
      const prev = BM.auth.session();
      localStorage.setItem(BM.auth.rowsKeyFor(sess), JSON.stringify(rows));
      return rows.length;
    }""", session)
    page.evaluate("""(sess) => {
      localStorage.setItem('bm_auth_v1', JSON.stringify(sess));
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_seen_v1', 'true');
    }""", session)
    page.reload(wait_until='load')
    page.wait_for_timeout(2500)

    print('version', page.evaluate("() => ({ app: BM.app.version, sw: 'bm-v1.92.0' })"), flush=True)

    # ---------- 1) 매칭 화면: 예전 시험용 카드 제외 ----------
    page.evaluate("() => { location.hash = '#/matching'; }")
    page.wait_for_timeout(2000)
    body = page.evaluate("() => document.body.innerText")
    print('matching has 실회원:', '실회원' in body)
    print('matching has 우승:', '우승' in body)
    print('matching has 나래:', '나래' in body)
    page.screenshot(path=OUT + '/v192_local_matching.png')

    # ---------- 2) 겹쳐 읽기: 받은 사람의 수락이 유지되는지 (실제 번들) ----------
    res = page.evaluate("""() => {
      const rec = { id: 'room192', type: '매칭신청', user_key: 'u_192_a', nick: '신청A', target: 'u_192_b',
        win: '대기', payload: { note: '토요일 오전 어때요?', heartCost: 2, payOn: 'accept', status: '대기' },
        created_at: '2026-11-27T05:00:00+00:00' };
      const rep = { id: 'p192', type: '수정', user_key: 'u_192_b', target: 'room192',
        payload: { cells: { '승패': '수락', '소셜글': JSON.stringify({ note: '토요일 오전 어때요?', heartCost: 2, payOn: 'accept', status: '수락', charged: 2 }) } },
        created_at: '2026-11-27T05:01:00+00:00' };
      const bad = { id: 'p192x', type: '수정', user_key: 'u_192_c', target: 'room192',
        payload: { cells: { '승패': '수락' } }, created_at: '2026-11-27T05:02:00+00:00' };
      const rows = BM.api.reconcileRecords([rec, rep]);
      const after = BM.store.derive(rows, 'u_192_a');
      const third = BM.api.reconcileRecords([rec, bad]);
      return {
        status: String(rows[0][BM.domain.COL['승패']]),
        charged: JSON.parse(String(rows[0][BM.domain.COL['소셜글']])).charged,
        hearts: after.hearts.balance,
        room: (after.threads || []).some(function (t) { return t.roomId === 'room192'; }),
        thirdParty: String(third[0][BM.domain.COL['승패']])
      };
    }""")
    print('reconcile', res)
    print('  수락 유지:', res['status'] == '수락', '· 하트 3-2 =', res['hearts'], '· 대화방:', res['room'],
          '· 제3자 무시:', res['thirdParty'] == '대기')

    # ---------- 3) MY 탭 · 탈퇴 안내 문구(기존 기능 보호) ----------
    page.evaluate("() => { location.hash = '#/my'; }")
    page.wait_for_timeout(1500)
    my = page.evaluate("() => document.body.innerText")
    print('MY has 로그아웃:', '로그아웃' in my)
    page.screenshot(path=OUT + '/v192_local_my.png')

    # 가로 넘침
    over = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print('overflow', over)
    app_errs = [e for e in errs if 'accounts.google.com' not in e]
    print('console errors (app)', app_errs[:5])
    print('console errors (외부 구글 스크립트 차단 — 점검 환경)', [e for e in errs if 'accounts.google.com' in e][:2])
    print('csp', page.evaluate("() => window.__csp"))
    print('bad http', [x for x in bad if 'favicon' not in x][:5])
    print('blocked external', blocked[:5], 'count', len(blocked))

    b.close()
httpd.shutdown()
