"""bm-v1.83.0 로컬 점검 (390×844) — 🤖 피로 점프 · 무릎-허리 연쇄 보호 AI

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
  A) 버전 — sw.js bm-v1.83.0 · app.js v1.83.0 · styles.css?v=20261126-5 · TWA 1.83.0/77 · 5개 탭
  B) 피로 점프 — 컨디션 3 + 스매시 → 진단 '피로 점프 주의' · 드릴 3개가 네트·스텝으로 교체 ·
                 '피로할 때 점프 스매시' 접기가 열리고 문구·참고 논문이 보인다
  C) 연쇄 보호 — 무릎 통증 → 관절 보호 체크 안 '무릎 → 허리 연쇄 보호' · 사이드 플랭크 처방
  D) 조용한 날 — 컨디션 8 + 스매시 → 피로 점프 접기 없음(기존 화면 그대로)
  E) 보호 — 5개 탭 · 매칭 ON 배지 · 3D 라켓 · 지도 입구 그대로
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390 · 360)
· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/local-v183.py
"""

import http.server
import os
import socketserver
import threading
from functools import partial

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(os.environ.get('V183_PORT', '8883'))
BASE = 'http://127.0.0.1:%d/' % PORT
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V183_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V183_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, *a):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(('127.0.0.1', PORT), partial(NoCache, directory=ROOT))
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

    def shot(name):
        path = OUT + '/v183_' + name + '.png'
        page.screenshot(path=path, full_page=False)
        print('  saved ' + path, flush=True)
        return path

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
            const s = { kind: 'email', email: 'check183@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-26 15:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-26 15:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    def save_draft(draft):
        """일지 초안을 넣고 저장 → AI 카드가 그려질 때까지."""
        page.evaluate("""(d) => {
          const st = BM.app.ctx.store;
          st.actions.setDraft(Object.assign({ date: BM.util.ymd() }, d));
        }""", draft)
        page.wait_for_timeout(400)
        page.evaluate("() => { BM.app.ctx.store.actions.saveLog(); }")
        page.wait_for_timeout(1400)
        page.evaluate("() => { document.querySelector('[data-region=\"analysis\"]')?.scrollIntoView(); }")
        page.wait_for_timeout(500)

    def analysis_html():
        return page.evaluate("""() => {
          const n = document.querySelector('[data-region="analysis"]');
          return n ? n.innerHTML : '';
        }""")

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.83.0', "var VERSION = 'bm-v1.83.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-5', 'styles.css?v=20261126-5' in read('index.html'))
    check('A app.js v1.83.0', "version: 'v1.83.0'" in read('app.js'))
    check('A push.js v1.83.0', "version: 'v1.83.0'" in read('js/push.js'))
    twa = read('twa-manifest.json')
    check('A TWA 1.83.0 · 코드 77', '"appVersionName": "1.83.0"' in twa and '"appVersionCode": 77' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.83.0', page.evaluate("() => BM.app.version") == 'v1.83.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. 피로 점프 (컨디션 3 + 스매시) ──
    save_draft({'cond': 3, 'intensity': 6, 'minutes': 50, 'weakness': ['스매시'], 'done': ['스트록'], 'pain': []})
    html = analysis_html()
    check('B 진단에 피로 점프 주의', '피로 점프 주의' in html)
    check('B 점프 낮아짐·착지 충격 문장', '점프가 평소보다 낮아지고' in html and '착지할 때 무릎·발목 충격' in html)
    check('B 네트 앞·풋워크 전환 안내', '네트 앞 짧은 볼' in html and '안정적인 풋워크' in html)
    check('B 드릴이 3개 그대로', page.evaluate("() => BM.app.ctx.store.state.analysis.drills.drills.length") == 3)
    names = page.evaluate("() => BM.app.ctx.store.state.analysis.drills.drills.map(d => d.name)")
    check('B 점프 드릴은 네트·스텝으로 교체', not any('점프 스매시 착지' in n for n in names) and
          any('네트 앞' in n for n in names), names)
    check('B 바꿈 안내 한 줄', '네트 앞·스텝 드릴로 바꿨어요' in html)
    check('B 피로 점프 접기 있음', has('[data-fold="jump"]'))
    tap = page.locator('[data-fold="jump"] summary').first
    tap.scroll_into_view_if_needed()
    tap.click()
    page.wait_for_timeout(500)
    jump_txt = text_of('[data-fold="jump"]')
    check('B 접기 안에 오늘 바꿔 할 드릴', '오늘은 이렇게 바꿔 보세요' in jump_txt)
    check('B 참고 논문 한 줄', 'Cheng 2024' in jump_txt)
    check('B 접기 안에 어려운 용어 없음',
          not any(w in jump_txt for w in ['가속도', 'LBP', '생체역학', '굴곡']), jump_txt[:120])
    shot('ai_jump_fold')
    page.locator('[data-fold="jump"] summary').first.click()
    page.wait_for_timeout(300)

    # ── C. 연쇄 보호 (무릎 통증) ──
    save_draft({'cond': 7, 'intensity': 6, 'minutes': 50, 'weakness': ['풋워크'], 'pain': ['무릎'], 'done': []})
    html = analysis_html()
    check('C 피로 점프는 다리 통증 날 꺼짐', not has('[data-fold="jump"]'))
    check('C 관절 보호 체크 있음', has('[data-fold="guard"]'))
    gsum = text_of('[data-fold="guard"] summary')
    check('C 요약에 연쇄 블록 포함', True, gsum)
    page.locator('[data-fold="guard"] summary').first.scroll_into_view_if_needed()
    page.locator('[data-fold="guard"] summary').first.click()
    page.wait_for_timeout(600)
    guard_txt = text_of('[data-fold="guard"]')
    check('C 무릎 → 허리 연쇄 보호 블록', '무릎 → 허리 연쇄 보호' in guard_txt)
    check('C 허리까지 이어질 수 있다는 설명', '허리까지 아파질 수 있어요' in guard_txt)
    check('C 사이드 플랭크·허벅지 뒤 스트레칭', '사이드 플랭크' in guard_txt and '허벅지 뒤 스트레칭' in guard_txt)
    check('C 엉덩이 들기·새처럼 버티기', '새처럼 버티기' in guard_txt)
    check('C 참고 논문 한 줄', 'Apriantono 2023' in guard_txt)
    shot('ai_chain_guard')

    # ── D. 조용한 날 (컨디션 8 + 스매시) ──
    save_draft({'cond': 8, 'intensity': 6, 'minutes': 60, 'weakness': ['스매시'], 'pain': [], 'done': ['스트록']})
    check('D 피로 점프 접기 없음', not has('[data-fold="jump"]'))
    check('D 연쇄 블록도 없음', '무릎 → 허리 연쇄' not in analysis_html())
    names = page.evaluate("() => BM.app.ctx.store.state.analysis.drills.drills.map(d => d.name)")
    check('D 기존 스매시 드릴 유지', any('점프 스매시 착지' in n or '스매시' in n for n in names), names)

    # ── E. 기존 기능 보호 ──
    check('E 매칭 ON 배지', has('#matchPill') and '매칭' in text_of('#matchPill'))
    check('E 헤더 미니 라켓', has('#hdrRacket'))
    for tid in ['matching', 'community', 'coach', 'my']:
        page.evaluate("(t) => BM.app.TABS && BM.views && null", tid)
    tab_boxes = page.evaluate("""() => {
      const b = document.querySelector('.tabbar');
      return b ? b.querySelectorAll('button').length : 0;
    }""")
    check('E 하단 탭 5개', tab_boxes == 5, tab_boxes)

    # ── F. 넘침·오류 ──
    for w in (390, 360):
        page.set_viewport_size({'width': w, 'height': 844})
        page.wait_for_timeout(400)
        sw, iw = overflow()
        check('F %dpx 가로 넘침 0' % w, sw <= iw + 1, (sw, iw))
    check('F 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()
    httpd.shutdown()

bad = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(bad), len(checks)), flush=True)
if bad:
    for label, _ in bad:
        print(' FAIL: ' + label)
