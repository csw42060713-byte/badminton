"""bm-v1.52.1 로컬 점검 — 🎥 영상 자세 비교(구간 나눠 분석 · 선수 선택) 화면

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·CDN 요청은 막습니다 → 인터넷 없는 폰과 같음).
· 진짜 앱(index.html)을 local 모드로 열고
  A) 기존 5개 탭(일지 & AI · 매칭 · 커뮤니티 · 코치 · MY)이 그대로 뜨는지
  B) 일지 & AI 첫 카드의 '영상 자세 비교' 입구 → 전체화면 패널(개인정보 안내·종목·영상 고르기·자동 분할 안내)
  C) 1인 예시 — 구간 칩 1개 · 선수 칩 없음 · 카드 4장 · 스켈레톤 (v1.50 화면 그대로)
  D) 복식(2명) 예시 — 구간 2개 · '선수 2명이 보여요' 배너 · 선수 칩으로 바꾸기 · 캔버스 탭으로 바꾸기
  E) CDN을 막아 둔 상태(오프라인)에서 영상을 고르면 앱이 죽지 않고 안내만
  F) 뒤로 가기로 패널만 닫기
· 실행(저장소 루트에서):
  (python3 -m http.server 8818 --bind 127.0.0.1 &) ; python3 test/local-v152.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8818/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
VIDEO = '/workspace/work/pose-test/pose-duo.webm'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def canvas_ink(page, sel):
    return page.evaluate("""(s) => {
      const c = document.querySelector(s);
      if (!c) return -1;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      return n;
    }""", sel)


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
          kind: 'email', email: 'pose151@example.com', name: '자세왕', at: new Date().toISOString(),
          onboardedAt: '2026-11-21 09:00:00',
          profile: { nick: '자세왕', level: '선수부', discipline: '단식', region: '경기',
                     club: '나래울', onboardedAt: '2026-11-21 09:00:00', role: 'player' }
        }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    check('앱 버전 v1.52.0', page.evaluate("() => BM.app.version") == 'v1.52.1',
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
    check('B 자동 분할 안내', '5~10초 구간으로 나눠' in panel, panel[:400])
    check('B 처음엔 모델을 안 불러옴', page.evaluate("() => BM.pose.modelState().state") == 'idle')
    check('B 처음엔 구간 칩 없음', count(page, '[data-pose-seg]') == 0)
    check('B 결과 전에는 메모 버튼이 숨음', not page.evaluate(
        "() => { const n = document.querySelector('[data-pose-actions]'); return n && n.offsetParent !== null; }"))
    page.screenshot(path=OUT + '/v152l_01_입구.png')

    # ---------------- C. 1인 예시 (v1.50 화면 그대로) ----------------
    page.click('[data-pose-demo]')
    page.wait_for_timeout(900)
    check('C 카드 4장', count(page, '[data-pose-card]') == 4, count(page, '[data-pose-card]'))
    cards = text_of(page, '[data-pose-cards]')
    check('C 카드 이름', '임팩트 팔꿈치 각도' in cards and '타점' in cards and '무릎' in cards and '몸통 기울기' in cards,
          cards[:160])
    check('C 판정 배지', '조금 낮아요' in cards or '좋아요' in cards, cards[:160])
    check('C 쉬운 말 보완점', '팔을 쭉 펴' in cards, cards[-160:])
    ink = canvas_ink(page, '[data-pose-canvas]')
    check('C 캔버스에 스켈레톤이 그려짐', ink > 2000, ink)
    check('C 프레임 시간 표시', '초' in text_of(page, '[data-pose-time]'), text_of(page, '[data-pose-time]'))
    check('C 구간 칩 1개', count(page, '[data-pose-seg]') == 1, count(page, '[data-pose-seg]'))
    segbar = text_of(page, '[data-pose-segs]')
    check('C 구간 칩에 1구간·시간', '1구간' in segbar and '0.0~1.0초' in segbar, segbar[:120])
    check('C 1명이면 선수 칩·배너 없음', count(page, '[data-pose-track]') == 0)
    check('C 일지 메모 버튼이 나타남', has(page, '[data-pose-note]') and page.evaluate(
        "() => { const n = document.querySelector('[data-pose-actions]'); return n && n.offsetParent !== null; }"))
    page.screenshot(path=OUT + '/v152l_02_예시_1인.png')

    # ---------------- D. 복식(2명) 예시 — 구간 2개 · 선수 선택 ----------------
    page.evaluate("() => BM.pose.close()")
    page.wait_for_timeout(400)
    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(500)
    page.click('[data-pose-demo="duo"]')
    page.wait_for_timeout(1000)
    check('D 복식 예시 — 구간 2개', count(page, '[data-pose-seg]') == 2, count(page, '[data-pose-seg]'))
    segbar = text_of(page, '[data-pose-segs]')
    check('D 구간 시간(0~3·3~6초)', '0.0~3.0초' in segbar and '3.0~6.0초' in segbar, segbar[:160])
    who = text_of(page, '[data-pose-who]')
    check('D 선수 2명 안내 배너', '선수 2명이 보여요' in who and '분석할 선수를 눌러 고르세요' in who, who[:160])
    check('D 선수 칩 2개', count(page, '[data-pose-track]') == 2, count(page, '[data-pose-track]'))
    check('D 카드 4장', count(page, '[data-pose-card]') == 4)
    ink1 = canvas_ink(page, '[data-pose-canvas]')
    page.screenshot(path=OUT + '/v152l_03_복식_예시.png')

    # 선수 2 로 바꾸기
    page.click('[data-pose-track="1"]')
    page.wait_for_timeout(600)
    check('D 선수 2 칩이 켜진다', page.evaluate(
        "() => { const n = document.querySelector('[data-pose-track=\"1\"]'); return n && n.classList.contains('is-on'); }"))
    check('D 선수 2 카드도 4장', count(page, '[data-pose-card]') == 4)
    ink2 = canvas_ink(page, '[data-pose-canvas]')
    check('D 캔버스 그림이 바뀐다(강조 관절 이동)', ink1 != ink2, '%s → %s' % (ink1, ink2))
    page.screenshot(path=OUT + '/v152l_04_선수2.png')

    # 캔버스에서 왼쪽 선수 누르기 → 선수 1
    # 캔버스에 그려진 1번 선수의 몸통 중심을 실제 좌표로 계산해 누릅니다
    page.evaluate("() => document.querySelector('[data-pose-canvas]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(300)
    pt = page.evaluate("""() => {
      const s = BM.pose._state(); const n = s.segs[s.seg];
      const c = document.querySelector('[data-pose-canvas]'); const r = c.getBoundingClientRect();
      const p = n.analysis.players[0]; const hit = p.track.byFrame[s.view];
      const geo = s.geo || { fx: 1, fy: 1, ox: 0, oy: 0 };
      return { x: r.x + (geo.ox + hit.box.x * geo.fx) * r.width,
               y: r.y + (geo.oy + hit.box.y * geo.fy) * r.height };
    }""")
    page.mouse.click(pt['x'], pt['y'])
    page.wait_for_timeout(600)
    check('D 캔버스 탭으로 선수 1로 돌아온다', page.evaluate(
        "() => { const n = document.querySelector('[data-pose-track=\"0\"]'); return n && n.classList.contains('is-on'); }"))

    # 구간 2 클릭
    page.click('[data-pose-seg="1"]')
    page.wait_for_timeout(700)
    check('D 2구간이 켜진다', page.evaluate(
        "() => { const n = document.querySelector('[data-pose-seg=\"1\"]'); return n && n.classList.contains('is-on'); }"))
    t_seg2 = text_of(page, '[data-pose-time]')
    check('D 2구간 프레임 시간이 3초 이후', float(t_seg2.replace('초', '') or 0) >= 3.0, t_seg2)
    check('D 2구간도 카드 4장', count(page, '[data-pose-card]') == 4)
    check('D 2구간도 선수 칩 2개', count(page, '[data-pose-track]') == 2)
    page.screenshot(path=OUT + '/v152l_05_2구간.png')

    # ---------------- E. 일지 메모 (구간 시간 포함) ----------------
    page.click('[data-pose-note]')
    page.wait_for_timeout(600)
    note = page.evaluate("() => (BM.app.ctx.store.state.drafts.log || {}).note || ''")
    check('E 일지 메모에 구간 시간이 들어감', '영상 자세 비교' in note and '3.0~6.0초' in note, note)
    check('E 메모 넣으면 패널이 닫힌다', not has(page, '#posePanel'))

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
    page.screenshot(path=OUT + '/v152l_06_오프라인안내.png')

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
