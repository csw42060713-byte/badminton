"""bm-v1.50.0 로컬 점검 — 🎥 영상 자세 비교(온디바이스 MediaPipe) 화면·계산

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·CDN 요청은 막습니다 → 인터넷 없는 폰과 같음).
· 진짜 앱(index.html)을 local 모드로 열고
  A) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY)이 그대로 뜨는지
  B) 일지 & AI 첫 카드의 '영상 자세 비교' 입구 → 전체화면 패널(개인정보 안내·종목·영상 고르기)
  C) '영상 없이 예시로 먼저 보기' — 스켈레톤 캔버스 + 기준 비교 카드 4장 + 보완점
  D) 종목 바꾸기(풋워크) · 프레임 이동 · 일지 메모에 넣기
  E) CDN을 막아 둔 상태(오프라인)에서 영상을 고르면 앱이 죽지 않고 안내만
  F) 뒤로 가기로 패널만 닫기
· 실행(저장소 루트에서):
  (python3 -m http.server 8818 --bind 127.0.0.1 &) ; python3 test/local-v150.py
"""

import time

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8818/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
VIDEO = '/workspace/work/pose-test/pose-smash.webm'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def watch(page):
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


def canvas_ink(page, sel):
    """캔버스에 실제로 뭔가 그려졌는지 — 색이 다른 픽셀 수"""
    return page.evaluate("""(s) => {
      const c = document.querySelector(s);
      if (!c) return -1;
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      }
      return n;
    }""", sel)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    watch(page)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'pose150@example.com', name: '자세왕', at: new Date().toISOString(),
          onboardedAt: '2026-11-21 09:00:00',
          profile: { nick: '자세왕', level: '선수부', discipline: '단식', region: '경기',
                     club: '나래울', onboardedAt: '2026-11-21 09:00:00', role: 'player' }
        }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    check('앱 버전 v1.50.0', page.evaluate("() => BM.app.version") == 'v1.50.0',
          page.evaluate("() => BM.app.version"))

    # ---------------- A. 기존 5개 탭 ----------------
    for tab, title in [('log', '일지 & AI'), ('matching', '1:1 매칭'), ('community', '커뮤니티'),
                       ('coach', '코치'), ('my', 'MY')]:
        page.click("#tabbar [data-tab='%s']" % tab)
        page.wait_for_timeout(520)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab), body[:60])

    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(600)
    check('A 일지 첫 카드에 영상 자세 비교 입구', has(page, '[data-act="open-pose"]'))
    check('A 기존 점수판 버튼 그대로', has(page, '[data-act="open-scoreboard"]'))
    w = overflow(page)
    check('A 390px 가로 넘침 없음', w[0] <= w[1], w)

    # ---------------- B. 패널 열기 ----------------
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(700)
    check('B 패널이 열린다', has(page, '#posePanel'), text_of(page, '#posePanel')[:60])
    panel = text_of(page, '#posePanel')
    check('B 개인정보 안내 문구', '서버로 전송되지 않고' in panel and '내 폰 안에서만' in panel, panel[:120])
    check('B 영상 고르기 버튼', has(page, '[data-pose-file]'))
    check('B 종목 두 가지', count(page, '[data-pose-mode]') == 2)
    check('B 처음엔 모델을 안 불러옴', page.evaluate("() => BM.pose.modelState().state") == 'idle')
    check('B 결과 전에는 메모 버튼이 숨음', not page.evaluate("() => { const n = document.querySelector('[data-pose-actions]'); return n && n.offsetParent !== null; }"))
    page.screenshot(path=OUT + '/v150l_01_입구.png')

    # ---------------- C. 예시로 보기 (영상 없이 같은 계산) ----------------
    page.click('[data-pose-demo]')
    page.wait_for_timeout(800)
    check('C 카드 4장', count(page, '[data-pose-card]') == 4, count(page, '[data-pose-card]'))
    cards = text_of(page, '[data-pose-cards]')
    check('C 카드 이름(팔꿈치·타점·무릎·몸통)',
          '임팩트 팔꿈치 각도' in cards and '타점' in cards and '무릎' in cards and '몸통 기울기' in cards,
          cards[:160])
    check('C 판정 배지', '조금 낮아요' in cards or '좋아요' in cards, cards[:160])
    check('C 기준 범위 표시', '155~175°' in cards and '58~82°' in cards, cards[:200])
    check('C 쉬운 말 보완점', '팔을 쭉 펴' in cards, cards[-200:])
    oneline = text_of(page, '[data-pose-one]')
    check('C 맨 위 한 줄 요약', '팔을 쭉 펴' in oneline, oneline)
    ink = canvas_ink(page, '[data-pose-canvas]')
    check('C 캔버스에 스켈레톤이 그려짐', ink > 2000, ink)
    check('C 참고 논문 줄', 'Miller' in text_of(page, '[data-pose-foot]'), text_of(page, '[data-pose-foot]')[:120])
    check('C 프레임 시간 표시', '초' in text_of(page, '[data-pose-time]'), text_of(page, '[data-pose-time]'))
    check('C 일지 메모 버튼이 나타남', has(page, '[data-pose-note]') and page.evaluate("() => { const n = document.querySelector('[data-pose-actions]'); return n && n.offsetParent !== null; }"))
    page.screenshot(path=OUT + '/v150l_02_예시_스매시.png')

    # ---------------- D. 종목 바꾸기 · 프레임 이동 ----------------
    t0 = text_of(page, '[data-pose-time]')
    page.evaluate("""() => {
      const r = document.querySelector('[data-pose-range]');
      r.value = '2';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    page.wait_for_timeout(400)
    t1 = text_of(page, '[data-pose-time]')
    check('D 프레임 이동하면 시간이 바뀐다', t0 != t1, t0 + ' → ' + t1)

    page.click('[data-pose-mode="foot"]')
    page.wait_for_timeout(700)
    cards = text_of(page, '[data-pose-cards]')
    check('D 풋워크 카드로 바뀐다', '스플릿 스텝 발 간격' in cards and '런지 앞무릎' in cards, cards[:160])
    check('D 풋워크도 4장', count(page, '[data-pose-card]') == 4)
    check('D 풋워크 스켈레톤', canvas_ink(page, '[data-pose-canvas]') > 2000)
    page.screenshot(path=OUT + '/v150l_03_예시_풋워크.png')

    # ---------------- E. 일지 메모에 넣기 ----------------
    page.click('[data-pose-note]')
    page.wait_for_timeout(600)
    note = page.evaluate("() => (BM.app.ctx.store.state.drafts.log || {}).note || ''")
    check('E 일지 메모에 한 줄이 들어감', '영상 자세 비교' in note and '런지' in note, note)
    check('E 메모 넣으면 패널이 닫힌다', not has(page, '#posePanel'))
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v150l_04_메모반영.png')

    # ---------------- F. 오프라인(CDN 차단)에서 영상 고르기 ----------------
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(600)
    page.set_input_files('[data-pose-file]', VIDEO)
    page.wait_for_timeout(9000)
    status = text_of(page, '[data-pose-status-wrap]')
    check('F 오프라인에서는 안내만 하고 앱은 산다',
          ('인터넷 연결 후' in status) or ('못 불러왔' in status), status[:200])
    check('F 모델 상태 = error', page.evaluate("() => BM.pose.modelState().state") in ('error', 'loading'),
          page.evaluate("() => BM.pose.modelState().state"))
    check('F 앱은 그대로 살아 있음', page.evaluate("() => !!BM.app.ctx.store.state.ready"))
    page.screenshot(path=OUT + '/v150l_05_오프라인안내.png')

    # ---------------- G. 뒤로 가기로 패널만 닫기 ----------------
    page.go_back()
    page.wait_for_timeout(700)
    check('G 뒤로 가기 → 패널만 닫힘', not has(page, '#posePanel'))
    check('G 앱 화면은 그대로', has(page, "[data-view='log']"))
    w = overflow(page)
    check('G 390px 가로 넘침 없음', w[0] <= w[1], w)

    check('콘솔 오류 0', not errs, errs[:3])
    check('CSP 위반 0', not csp, csp[:3])
    check('차단된 외부 요청은 실패로 안 셈', True, blocked[:2])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    for f in fails:
        print('FAIL:', f[0])
raise SystemExit(1 if fails else 0)
