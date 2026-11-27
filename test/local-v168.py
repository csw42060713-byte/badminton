"""bm-v1.68.0 로컬 점검 (390×844) — 실전 감각연습 + 오후 보강 웨이트

승우 님 제보·승인: "코칭에 추가해둬" + 추가 지시 "이해하기 쉽게"

  1) 일지 & AI 카드에 접힌 블록 하나(data-fold="sense") — 기본은 접힘
  2) 눌러서 열고 닫힌다 (기능 1개 = 확인 1개)
  3) 오전 코트 3블록: 몸풀기 5분 → 2대1 30분(숏드라이브·드라이브·드롭 10분씩) → 뒷코트 10분
  4) 오후 웨이트 3묶음: 중량 크런치 10kg 30개×5세트 · 백 익스텐션 3방향 · 스쿼트 80kg
     · 종아리 레이즈 · 턱걸이 · 덤벨컬 10kg · 어깨·삼두
  5) 쉬운 말: 줄임말 옆에 동호인·초보자도 알아듣는 설명
  6) 안전: 무게 낮추기 · 아프면 그 종목은 오늘 쉬기
  7) 약점(드라이브)을 고르면 그 블록을 한 번 더 하라는 한 줄
  8) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 5개 탭 · v1.67 공유 카드 보호

실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v168.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V168_PORT', '8843'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V168_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V168_SHOTS', '/workspace/check-shots')

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
        path = OUT + '/v168_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def login(nick='점검왕'):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'clean168@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울', onboardedAt: '2026-11-24 09:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 · 탭 ──
    check('A sw.js bm-v1.68.0', "var VERSION = 'bm-v1.68.0'" in read('sw.js'))
    check('A index styles.css?v=20261124-6', 'styles.css?v=20261124-6' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.68.0 · 코드 62',
          '"appVersionName": "1.68.0"' in twa and '"appVersionCode": 62' in twa)

    login('점검왕')
    check('A 앱 버전 v1.68.0', page.evaluate("() => BM.app.version") == 'v1.68.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 오늘 일지 저장 → AI 카드에 감각연습 블록 ──
    tap("#tabbar [data-tab='log']", 800)
    page.fill('[data-field="minutes"]', '70')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 7;
      st.drafts.log.intensity = 6;
      st.drafts.log.weakness = ['드라이브'];
    }""")
    tap('[data-act="save-log"]', 1600)
    check('B AI 분석 카드 열림', has(page, '[data-region="analysis"]'))
    check('B 감각연습 접힘 블록이 하나', count(page, '[data-fold="sense"]') == 1,
          count(page, '[data-fold="sense"]'))
    closed = page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""")
    check('B 기본은 접힘', closed is False, closed)
    summ = text_of(page, '[data-fold="sense"] > summary')
    check('B 접힌 줄 제목', '실전 감각연습 + 오후 보강 웨이트' in summ and '오전 코트 · 오후 웨이트' in summ, summ[:120])
    body0 = text_of(page, '[data-fold="sense"]')
    check('B 접힌 동안 본문은 화면에 안 보임', '숏드라이브 10분' not in body0, body0[:120])
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="sense"]');
      d.scrollIntoView({ block: 'center' });
    }""")
    page.wait_for_timeout(350)
    shot('B-sense-closed')

    # ── C. 눌러서 펼치기 ──
    tap('[data-fold="sense"] > summary', 700)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of(page, '[data-fold="sense"]')
    check('C 오전 코트 · 총 시간', '오전 · 코트 실전 감각연습' in body and '약 45~50분' in body, body[:180])
    check('C 오전 순서', '몸풀기 5분 → 2대1 감각연습 30분 → 뒷코트 감각연습 10분' in body)
    check('C 몸풀기 양쪽 약 5분', '양쪽 약 5분' in body)
    check('C 2대1 쉬운 풀이', '두 명이서 한 사람에게' in body)
    check('C 숏드라이브 10분 · 드라이브 10분 · 드롭 10분',
          '숏드라이브 10분' in body and '드라이브 10분' in body and '드롭 10분' in body)
    check('C 뒷코트(뒷사각) 풀이', '뒷코트(뒷사각)' in body and '모서리' in body)
    check('C 오후 웨이트 3묶음', '코어 · 허리' in body and '하체' in body and '상체 · 팔' in body)
    check('C 중량 크런치 10kg 30개 × 5세트', '중량 크런치' in body and '10kg' in body and '30개 × 5세트' in body)
    check('C 백 익스텐션 3방향 10개', '백 익스텐션 3방향' in body and '가운데·왼쪽·오른쪽' in body)
    check('C 스쿼트 선수 기준 80kg 10개 × 3세트', '스쿼트' in body and '선수 기준 80kg' in body and '10개 × 3세트' in body)
    check('C 종아리 레이즈', '종아리 레이즈(카프 레이즈)' in body)
    check('C 턱걸이 · 덤벨컬 · 어깨 · 삼두',
          '턱걸이' in body and '덤벨컬' in body and '어깨 보강' in body and '삼두 보강' in body)
    check('C 무게 안내 줄', '무게 안내 ·' in body and '동호인·초보자는 맨몸' in body)
    check('C 안전 줄', '안전 ·' in body and '아프면' in body)
    check('C 약점(드라이브) 한 줄', '드라이브가 약점이라면 2대1 드라이브 10분' in body, body[-260:])
    check('C 급수 안내', '동호인은 2대1을 10분씩' in body)
    check('C 출처는 일반화', '체전 1등 선수' in body)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="sense"]');
      d.scrollIntoView({ block: 'start' });
    }""")
    page.wait_for_timeout(350)
    shot('C-sense-open')

    # ── D. 다시 눌러 접기 ──
    tap('[data-fold="sense"] > summary', 600)
    closed2 = page.evaluate("""() => { const d = document.querySelector('[data-fold="sense"]'); return d ? d.open : null; }""")
    check('D 다시 누르면 접힌다', closed2 is False, closed2)

    # 기존 접힌 블록도 그대로 열린다
    tap('[data-fold="offcourt"] > summary', 600)
    check('D 기존 오프코트 루틴도 열린다', '실전 선수 오프코트 루틴' in text_of(page, '[data-fold="offcourt"]'))
    tap('[data-fold="offcourt"] > summary', 400)

    # ── E. v1.67 공유 카드 보호 ──
    tap('[data-act="share-card"][data-share-entry="log-hero"]', 1100)
    check('E 인스타 공유 카드가 열린다', has(page, '.sc__canvas'))
    shot('E-share-card')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── F. 넘침 · 라이트 테마 · 360 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow(page)
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("""() => {
      const d = document.querySelector('[data-fold="sense"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); }
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => { document.documentElement.setAttribute('data-theme', 'th_def'); }")
    page.wait_for_timeout(400)
    shot('F-sense-light')
    w = overflow(page)
    check('F 감각연습 펼친 라이트 테마 넘침 0', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(450)
    w = overflow(page)
    check('F 360 폭 넘침 0', w[0] <= w[1], w)
    shot('F-sense-360')
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
