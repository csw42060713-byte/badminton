"""bm-v1.69.0 로컬 점검 (390×844) — 런지·착지 부상 예방 보강 (무릎·발목 보호 체크)

근거: Wen et al. 2025 (BMC Sports Sci Med Rehabil 17(1):341, DOI 10.1186/s13102-025-01393-y)
      Xiao et al. 2026 (Res Sports Med 34(6):737-760, DOI 10.1080/15438627.2026.2680707)

  1) 버전 — sw.js bm-v1.69.0 · app.js v1.69.0 · styles.css?v=20261124-7 · TWA 1.69.0/63
  2) 일지 저장 → AI 카드의 '관절 보호 체크' 접기 하나 (data-fold="guard")
  3) 눌러서 열면 '무릎·발목 보호 체크' — 새 기준 3줄(발끝 안쪽/toe-in · 바깥/toe-out · 점프 착지 무릎 정렬)
  4) 새 '조심할 동작' 2개 — 런지 착지 발끝 방향 · 점프 착지 무릎 정렬 (기존 3개는 그대로)
  5) 참고 논문 한 줄에 Wen 2025 · Xiao 2026 (DOI는 코드에만)
  6) 기존 블록 보호 — 추천 드릴 · 감각연습 · 오프코트 · 이번 주 루틴
  7) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360 · 라이트 테마)

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v169.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V169_PORT', '8849'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V169_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V169_SHOTS', '/workspace/check-shots')

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


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


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

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v169_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean169@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 16:00:00',
                        profile: { nick: a.nick, level: 'A조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 16:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 · 탭 ──
    check('A sw.js bm-v1.69.0', "var VERSION = 'bm-v1.69.0'" in read('sw.js'))
    check('A index styles.css?v=20261124-7', 'styles.css?v=20261124-7' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.69.0 · 코드 63',
          '"appVersionName": "1.69.0"' in twa and '"appVersionCode": 63' in twa)
    check('A ai.js에 새 근거', '10.1186/s13102-025-01393-y' in read('js/ai.js')
          and '10.1080/15438627.2026.2680707' in read('js/ai.js'))

    login('점검왕')
    check('A 앱 버전 v1.69.0', page.evaluate("() => BM.app.version") == 'v1.69.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 풋워크 약점 일지 저장 → 관절 보호 체크 ──
    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 6;
      st.drafts.log.intensity = 5;
      st.drafts.log.weakness = ['풋워크'];
    }""")
    tap('[data-act="save-log"]', 1700)
    check('B AI 분석 카드 열림', has(page, '[data-region="analysis"]'))
    check('B 관절 보호 접기가 하나', count(page, '[data-fold="guard"]') == 1,
          count(page, '[data-fold="guard"]'))
    summ = text_of(page, '[data-fold="guard"] > summary')
    check('B 접힌 줄에 무릎·발목', '관절 보호 체크' in summ and '무릎·발목' in summ, summ[:120])
    body0 = text_of(page, '[data-fold="guard"]')
    check('B 접힌 동안 새 항목은 안 보임', '런지 착지 발끝 방향' not in body0, body0[:120])
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('guard-closed')

    # ── C. 눌러서 펼치기 ──
    tap('[data-fold="guard"] > summary', 700)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="guard"]')
    check('C 무릎·발목 보호 체크 블록', '무릎·발목 보호 체크' in body)
    check('C 쉬운 기준 제목', '쉬운 기준' in body)
    check('C 새 기준 — 발끝 안쪽(toe-in) · 뒤꿈치', 'toe-in' in body and '뒤꿈치' in body
          and '몸 안쪽으로 말아' in body)
    check('C 새 기준 — 발끝 바깥(toe-out)', 'toe-out' in body and '조금 바깥으로 열어' in body
          and '뒤꿈치 충격' in body)
    check('C 새 기준 — 점프 착지 무릎 정렬', '두 무릎이 안쪽으로 모이면' in body
          and '발끝과 같은 방향' in body)
    check('C 기존 기준 4줄 그대로', '가장 많이 다치는 곳이 다리' in body and '피곤해지면' in body
          and '백핸드 쪽으로 길게 뻗는 런지' in body and '대각선 뒤로 빠지면서' in body)
    check('C 조심할 동작 제목', '조심할 동작' in body)
    check('C 새 확인 — 런지 착지 발끝 방향', '런지 착지 발끝 방향' in body and '20도' in body)
    check('C 새 확인 — 점프 착지 무릎 정렬', '점프 착지 무릎 정렬' in body and 'X자' in body
          and '엉덩이를 살짝 뒤로' in body)
    check('C 기존 확인 3개 그대로', '백핸드 앞쪽 런지 조심' in body
          and '대각선 뒤로 빠질 때 발바닥 전체로 착지' in body
          and '마지막 세트 런지 5개로 확인' in body)
    check('C 오늘 할 것 3개 그대로', '허벅지 앞 힘 기르기' in body and '엉덩이 힘 기르기' in body
          and '발목 버티기' in body)
    check('C 참고 논문 한 줄', '참고 논문 · Du & Fan 2020' in body and 'Wen 2025' in body
          and 'Xiao 2026' in body, body[-200:])
    check('C 화면에 통계 기호 없음', 'p <' not in body and '모멘트' not in body
          and '내회전' not in body and 'OR ' not in body)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(350)
    shot('guard-open')

    # ── D. 다시 눌러 접기 ──
    tap('[data-fold="guard"] > summary', 600)
    closed2 = page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""")
    check('D 다시 누르면 접힌다', closed2 is False, closed2)

    # ── E. 기존 블록 보호 ──
    check('E 추천 드릴', '추천 드릴' in text_of(page, '[data-region="analysis"]'))
    check('E 감각연습 블록 그대로', count(page, '[data-fold="sense"]') == 1)
    check('E 오프코트 블록 그대로', count(page, '[data-fold="offcourt"]') == 1)
    tap('[data-fold="sense"] > summary', 600)
    check('E 감각연습도 열린다', '실전 감각연습' in text_of(page, '[data-fold="sense"]'))
    tap('[data-fold="sense"] > summary', 400)

    # ── F. 넘침 · 라이트 테마 · 360 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="guard"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => { document.documentElement.setAttribute('data-theme', 'th_def'); }")
    page.wait_for_timeout(400)
    shot('guard-light')
    w = overflow(page)
    check('F 관절 보호 펼친 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('F 360 폭 넘침 0', w[0] <= w[1], w)
    shot('guard-360')
    page.set_viewport_size({'width': 390, 'height': 844})

    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])
    check('F (참고) 차단된 외부 요청만', True, len(blocked))

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
