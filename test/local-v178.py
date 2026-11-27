"""bm-v1.78.0 로컬 점검 (390×844) — 🦶 스플릿 스텝 → 전위 런지 · 발목 비틀림 보호

근거: Wang et al. 2024 (Bioengineering 11(5):501, DOI 10.3390/bioengineering11050501)
      Pengked et al. 2025 (Electron J Gen Med 22(1):em629, DOI 10.29333/ejgm/15917)

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.78.0 · app.js v1.78.0 · styles.css?v=20261125-7 · TWA 1.78.0/72 · 5개 탭
  B) 풋워크 약점 일지 저장 → 추천 드릴에 '스플릿 스텝 → 전위 런지'가 보인다
  C) 관절 보호 접기(data-fold="guard") 하나를 눌러 펼치면 '무릎·발목 보호 체크'에
     새 쉬운 기준 1줄 · 조심할 동작 '방향 바꾸기 전 스플릿 스텝 한 번'이 보이고 기존 문구는 그대로
  D) 발목 통증 일지에서도 같은 항목이 보인다
  E) 기존 블록(추천 드릴·감각연습·오프코트·이번 주·맞춤 처방·부상 예방) 보호
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360 · 라이트 테마)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v178.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V178_PORT', '8878'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V178_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V178_SHOTS', '/workspace/check-shots')

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

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def shot(name, keep=False):
        path = SHOTS + '/v178_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v178_' + name + '.png')
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

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
            const s = { kind: 'email', email: 'check178@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    def save_log(weak, pain):
        tap("#tabbar [data-tab='log']", 800)
        page.fill('[data-field="minutes"]', '60')
        page.evaluate("""(a) => {
          const st = BM.app.ctx.store.state;
          st.drafts.log.cond = 6;
          st.drafts.log.intensity = 5;
          st.drafts.log.weakness = a.weak;
          st.drafts.log.pain = a.pain;
        }""", {'weak': weak, 'pain': pain})
        tap('[data-act="save-log"]', 1700)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.78.0', "var VERSION = 'bm-v1.78.0'" in read('sw.js'))
    check('A index styles.css?v=20261125-7', 'styles.css?v=20261125-7' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.78.0 · 코드 72',
          '"appVersionName": "1.78.0"' in twa and '"appVersionCode": 72' in twa)
    check('A ai.js 에 Wang DOI', '10.3390/bioengineering11050501' in read('js/ai.js'))
    check('A js/push.js 브리지 버전 v1.78.0', "version: 'v1.78.0'" in read('js/push.js'))

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.78.0', page.evaluate("() => BM.app.version") == 'v1.78.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 풋워크 약점 → 추천 드릴에 새 드릴 ──
    save_log(['풋워크'], [])
    check('B AI 분석 카드 열림', has('[data-region="analysis"]'))
    drills = text_of('.drills--core') if has('.drills--core') else text_of('[data-region="analysis"]')
    check('B 추천 드릴에 스플릿 스텝 → 전위 런지', '스플릿 스텝 → 전위 런지' in drills, drills[:200])
    check('B 드릴 방법에 두 발 살짝 떼며 박자',
          '두 발을 살짝 떼며 박자를 맞춘' in drills, drills[:260])
    alltxt = page.evaluate("""() => { const n = document.querySelector('[data-region=\"analysis\"]');
      return n ? n.textContent : ''; }""")
    check('B 드릴 한 줄 코칭(드릴 포인트)', '백핸드로 길게 뻗을 때 발목이 덜 비틀려요' in alltxt, alltxt[-260:])
    check('B 기존 드릴도 그대로', '육각 풋워크' in drills and '스플릿스텝 타이밍' in drills)

    # ── C. 관절 보호 접기 열기 ──
    check('C 관절 보호 접기가 하나', count('[data-fold="guard"]') == 1, count('[data-fold="guard"]'))
    summ = text_of('[data-fold="guard"] > summary')
    check('C 접힌 줄에 무릎·발목', '관절 보호 체크' in summ and '무릎·발목' in summ, summ[:120])
    body0 = text_of('[data-fold="guard"]')
    check('C 접힌 동안 새 항목은 안 보임', '방향 바꾸기 전 스플릿 스텝' not in body0, body0[:120])
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(350)
    shot('guard-closed')

    tap('[data-fold="guard"] > summary', 700)
    opened = page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]'); return d ? d.open : null; }""")
    check('C 누르면 열린다', opened is True, opened)
    body = text_of('[data-fold="guard"]')
    check('C 무릎·발목 보호 체크 블록', '무릎·발목 보호 체크' in body)
    check('C 새 쉬운 기준 — 방향 바꾸기 직전 스플릿 스텝',
          '급하게 방향을 바꾸다 발목을 접질리는 경우가 가장 많아요' in body
          and '스플릿 스텝을 넣으면' in body and '발목이 비틀리는 부담이 줄어요' in body)
    check('C 기존 쉬운 기준 7줄 그대로',
          '가장 많이 다치는 곳이 다리' in body and '피곤해지면' in body
          and '백핸드 쪽으로 길게 뻗는 런지' in body and '대각선 뒤로 빠지면서' in body
          and 'toe-in' in body and 'toe-out' in body and '발끝과 같은 방향' in body)
    check('C 조심할 동작 제목', '조심할 동작' in body)
    check('C 새 확인 — 방향 바꾸기 전 스플릿 스텝 한 번',
          '방향 바꾸기 전 스플릿 스텝 한 번' in body and '발바닥 전체로 디디세요' in body
          and '18명' in body)
    check('C 기존 확인 5개 그대로',
          '백핸드 앞쪽 런지 조심' in body and '대각선 뒤로 빠질 때 발바닥 전체로 착지' in body
          and '마지막 세트 런지 5개로 확인' in body and '런지 착지 발끝 방향' in body
          and '점프 착지 무릎 정렬' in body)
    check('C 오늘 할 것 3개 그대로',
          '허벅지 앞 힘 기르기' in body and '엉덩이 힘 기르기' in body and '발목 버티기' in body)
    check('C 참고 논문 한 줄에 Wang 2024',
          '참고 논문 · Du & Fan 2020' in body and 'Wang 2024' in body and 'Wen 2025' in body,
          body[-220:])
    check('C 화면에 통계 기호·전문 약어 없음',
          'p <' not in body and '모멘트' not in body and '내회전' not in body
          and 'OR ' not in body and 'inversion' not in body and 'GIRD' not in body)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      d.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(400)
    shot('guard-open', keep=True)

    # ── D. 발목 통증 일지에서도 같은 항목 ──
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      if (d) d.open = false; }""")
    save_log([], ['발목'])
    check('D 통증 일지 저장 뒤에도 관절 보호 접기 하나', count('[data-fold="guard"]') == 1)
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } }""")
    page.wait_for_timeout(500)
    body2 = text_of('[data-fold="guard"]')
    check('D 발목 통증에도 새 확인이 보인다', '방향 바꾸기 전 스플릿 스텝 한 번' in body2, body2[:160])
    check('D 발목 통증에도 새 기준이 보인다', '방향을 바꾸기 직전에 가볍게 한 번 뛰어' in body2)
    shot('guard-open-pain', keep=True)

    # ── E. 기존 블록 보호 ──
    an_txt = text_of('[data-region="analysis"]')
    check('E 추천 드릴', '추천 드릴' in an_txt)
    check('E 감각연습 블록 그대로', count('[data-fold="sense"]') == 1)
    check('E 오프코트 블록 그대로', count('[data-fold="offcourt"]') == 1)
    check('E 이번 주 루틴 블록 그대로', count('[data-fold="week"]') == 1)
    check('E 맞춤 처방 블록 그대로', count('[data-fold="care"]') == 1)
    check('E 부상 예방 블록 그대로', count('[data-fold="prevent"]') == 1)

    # ── F. 넘침 · 라이트 테마 · 오류 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow()
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("() => { document.documentElement.setAttribute('data-theme', 'th_def'); }")
    page.evaluate("""() => { const d = document.querySelector('[data-fold="guard"]');
      if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }""")
    page.wait_for_timeout(400)
    shot('guard-light', keep=True)
    w = overflow()
    check('F 라이트 테마 가로 넘침 0 (390)', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(700)
    w2 = overflow()
    check('F 360 가로 넘침 0', w2[0] <= w2[1], w2)
    shot('guard-360')
    check('F 앱 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
