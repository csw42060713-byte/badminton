"""bm-v1.70.0 로컬 점검 (390×844) — 실전 시합 웜업 · 복식 수비 전환 · 수비 타이밍

체전 1등 선수 현장 기준(2026-11-24 19시 인터뷰)
  "조깅하고 스트레칭하고 시합 뛰고"
  "공을 세게한번쳐서 밀리게 하고 틀거나 놔"
  "예측해서 치는 거 아니면 뒤로 당긴 다음에 여유롭게, 예측 못 하는 공은 당겨서"

  1) 버전 — sw.js bm-v1.70.0 · app.js v1.70.0 · styles.css?v=20261124-8 · TWA 1.70.0/64
  2) 일지 저장(수비 약점) → AI 카드의 '시합 당일 준비' 접기 하나 (data-fold="match")
  3) 눌러서 열면 시합 직전 3단계(조깅 → 스트레칭 → 코트에서 시합)
  4) 수비 → 공격 전환 3단계(세게 한 번 밀기 → 코스 틀기·짧게 놓기 → 순서 지키기) + 파트너 전후 전환
  5) 수비에서 받는 타이밍 — 예측한 공은 앞에서 짧게 / 예측 못 한 공은 뒤로 당겨 여유
  6) 추천 드릴 1번이 '수비 타이밍 — 예측했을 때 / 아닐 때'
  7) 전술 노트(더 보기) 첫 줄에도 수비 → 공격 전환
  8) 기존 블록 보호 — 감각연습 · 관절 보호 · 오프코트 · 이번 주 루틴
  9) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360 · 라이트 테마)

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v170.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V170_PORT', '8851'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V170_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V170_SHOTS', '/workspace/check-shots')

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
        path = OUT + '/v170_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean170@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 19:30:00',
                        profile: { nick: a.nick, level: 'A조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 19:30:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 · 탭 ──
    check('A sw.js bm-v1.70.0', "var VERSION = 'bm-v1.70.0'" in read('sw.js'))
    check('A index styles.css?v=20261124-8', 'styles.css?v=20261124-8' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.70.0 · 코드 64',
          '"appVersionName": "1.70.0"' in twa and '"appVersionCode": 64' in twa)
    ai = read('js/ai.js')
    check('A ai.js에 시합 준비·전환·타이밍', 'MATCH_DAY' in ai and '시합 당일 준비' in ai
          and '수비에서 공격으로 뒤집기' in ai and '수비에서 받는 타이밍' in ai)
    check('A 실존 선수 이름 없음', '김원호' not in ai and '안세영' not in ai and '서재승' not in ai
          and '서승재' not in ai)

    login('점검왕')
    check('A 앱 버전 v1.70.0', page.evaluate("() => BM.app.version") == 'v1.70.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 수비 약점 일지 저장 → 시합 당일 준비 접기 ──
    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 6;
      st.drafts.log.intensity = 5;
      st.drafts.log.weakness = ['수비'];
    }""")
    tap('[data-act="save-log"]', 1700)
    check('B AI 분석 카드 열림', has(page, '[data-region="analysis"]'))
    card = text_of(page, '[data-region="analysis"]')
    check('B 추천 드릴 1번이 수비 타이밍', '수비 타이밍 — 예측했을 때 / 아닐 때' in card)
    check('B 드릴 방법에 당겨서 받기', '뒤로 살짝 당겨' in card, card[:160])
    tap('[data-fold="ai-detail"] > summary', 550)
    detail = text_of(page, '[data-fold="ai-detail"]')
    check('B 드릴 포인트 — 예측/아닐 때', '드릴 포인트' in detail
          and '예측했으면 앞에서 짧게' in detail and '뒤로 당겨 여유롭게' in detail)
    tap('[data-fold="ai-detail"] > summary', 350)
    check('B 시합 준비 접기가 하나', count(page, '[data-fold="match"]') == 1,
          count(page, '[data-fold="match"]'))
    summ = text_of(page, '[data-fold="match"] > summary')
    check('B 접힌 줄에 시합 당일 준비', '시합 당일 준비' in summ and '조깅' in summ, summ[:120])
    closed = page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""")
    check('B 기본은 접힘', closed is False, closed)
    body0 = text_of(page, '[data-fold="match"]')
    check('B 접힌 동안 본문은 안 보임', '가볍게 조깅' not in body0, body0[:120])
    page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]');
      d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('match-closed')

    # ── C. 눌러서 펼치기 — 시합 직전 3단계 ──
    tap('[data-fold="match"] > summary', 700)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="match"]')
    check('C 시합 직전 워밍업 소제목', '시합 직전 워밍업' in body)
    check('C 순서 줄 — 조깅 → 스트레칭 → 시합', '가볍게 조깅' in body and '스트레칭으로 관절 풀기' in body
          and '코트에서 시합' in body)
    check('C 조깅 설명', '몸이 따뜻해질 때까지' in body)
    check('C 스트레칭 설명 — 관절', '관절을 풀어' in body)
    check('C 네트 예열·평소 웜업 구조 유지', '웜업' in card and count(page, '[data-fold="prevent"]') >= 0)

    # ── D. 수비 → 공격 전환 ──
    check('D 수비 → 공격 전환 소제목', '수비에서 공격으로 뒤집기' in body)
    check('D ① 세게 한 번 밀기', '세게 한 번 쳐서 밀어내기' in body and '뒤로 물러나야' in body)
    check('D ② 코스 틀기 · 짧게 놓기', '코스 틀기 · 짧게 놓기' in body and '짧게 놓아' in body)
    check('D ③ 순서 지키기', '밀기 전에 방향부터 바꾸면' in body and '코스 바꾸기' in body)
    check('D 파트너 전후 전환', '전후 전환' in body and '네트 쪽으로 붙어' in body)

    # ── E. 수비에서 받는 타이밍 ──
    check('E 수비 타이밍 소제목', '수비에서 받는 타이밍' in body)
    check('E 예측한 공 — 앞에서 짧게', '예측한 공 — 앞에서 짧게' in body and '압박' in body)
    check('E 예측 못 한 공 — 뒤로 당겨 여유', '예측 못 한 공 — 뒤로 살짝 당겨 여유' in body
          and '빠르게 느껴져' in body and '여유 있게' in body)
    check('E 출처 줄 — 현장 기준', '체전 1등 선수 현장 기준' in body, body[-160:])
    check('E 화면에 통계 기호 없음', 'p <' not in body and '모멘트' not in body
          and '생체역학' not in body)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="match"]');
      const li = Array.prototype.slice.call(d.querySelectorAll('li'))
        .filter((n) => n.innerText.indexOf('예측 못 한 공') >= 0)[0];
      (li || d).scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(400)
    shot('match-open')

    # ── F. 전술 노트(더 보기) 첫 줄 ──
    tap('[data-fold="extra"] > summary', 650)
    extra = text_of(page, '[data-fold="extra"]')
    check('F 전술 노트 복식', '전술 노트 · 복식' in extra)
    check('F 전술 첫 줄이 수비 → 공격 전환', '세게 한 번' in extra and '코스를 틀거나 짧게' in extra)
    check('F 기존 전술(서브·리시브) 유지', '몸쪽 서브' in extra or '숏서브' in extra)
    tap('[data-fold="extra"] > summary', 400)

    # ── G. 다시 접기 · 기존 블록 보호 ──
    tap('[data-fold="match"] > summary', 600)
    check('G 다시 누르면 접힌다',
          page.evaluate("""() => { const d = document.querySelector('[data-fold="match"]'); return d ? d.open : null; }""") is False)
    check('G 추천 드릴 유지', '추천 드릴' in text_of(page, '[data-region="analysis"]'))
    check('G 감각연습 유지', count(page, '[data-fold="sense"]') == 1)
    check('G 오프코트 유지', count(page, '[data-fold="offcourt"]') == 1)
    check('G 이번 주 루틴 유지', count(page, '[data-fold="week"]') == 1)
    check('G 맞춤 처방 유지', count(page, '[data-fold="care"]') == 1)
    tap('[data-fold="sense"] > summary', 500)
    check('G 감각연습 열린다', '실전 감각연습' in text_of(page, '[data-fold="sense"]'))
    tap('[data-fold="sense"] > summary', 350)

    # ── H. 넘침 · 라이트 테마 · 360 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('H %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="match"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => { document.documentElement.setAttribute('data-theme', 'th_def'); }")
    page.wait_for_timeout(400)
    shot('match-light')
    w = overflow(page)
    check('H 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('H 360 폭 넘침 0', w[0] <= w[1], w)
    shot('match-360')
    page.set_viewport_size({'width': 390, 'height': 844})

    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])
    check('H (참고) 차단된 외부 요청만', True, len(blocked))

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
