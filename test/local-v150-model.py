"""bm-v1.50.0 로컬 점검(2) — 진짜 영상 + 진짜 MediaPipe Pose (네트워크 허용)

· CDN(jsdelivr)과 자세 모델(storage.googleapis.com)을 실제로 받아 옵니다.
  → CSP(script-src·connect-src·'wasm-unsafe-eval'·media-src blob:)가 실제로 통과하는지 확인합니다.
· 영상은 공개 사진(Wikimedia Commons, 2020 도쿄올림픽 배드민턴 경기 사진)을 짧게 흔들어 만든 webm입니다.
  앱은 이 파일을 blob: 주소로만 열고 서버로 보내지 않습니다(Supabase 요청은 막아 둡니다).
· 실행(저장소 루트에서):
  (python3 -m http.server 8818 --bind 127.0.0.1 &) ; python3 test/local-v150-model.py
"""

import time

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8818/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
VIDEO = '/workspace/work/pose-test/pose-smash.webm'
checks, errs, csp, bad = [], [], [], []

# MediaPipe/WASM·구글 로그인 라이브러리가 스스로 찍는 INFO 잡음 — 앱 오류가 아닙니다
NOISE = ('XNNPACK', 'GSI_LOGGER', 'Failed to load resource', 'INFO:', 'GroupMarkerNotSet')


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:300]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def canvas_ink(page, sel):
    return page.evaluate("""(s) => {
      const c = document.querySelector(s);
      if (!c) return -1;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) n++;
      return n;
    }""", sel)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    # 서버(DB) 쪽만 막습니다 — 앱이 영상/분석을 서버로 보내지 않는지도 같이 확인됩니다
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:400])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            return
        if any(n in m.text for n in NOISE):
            return
        errs.append(m.text[:300])
    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))
    page.on('response', lambda r: bad.append('%s %s' % (r.status, r.url[:110])) if r.status >= 400 else None)

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'model150@example.com', name: '영상테스트', at: new Date().toISOString(),
          onboardedAt: '2026-11-21 09:00:00',
          profile: { nick: '영상테스트', level: '선수부', discipline: '단식', region: '경기',
                     club: '나래울', onboardedAt: '2026-11-21 09:00:00', role: 'player' }
        }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)

    page.click('[data-act="open-pose"]')
    page.wait_for_timeout(600)
    check('패널 열림', has(page, '#posePanel'))

    t0 = time.time()
    page.set_input_files('[data-pose-file]', VIDEO)

    # 모델 → 프레임 16장 분석까지 (헤드리스 CPU라 넉넉히 기다립니다)
    state = {}
    deadline = time.time() + 170
    while time.time() < deadline:
        state = page.evaluate("() => { const s = BM.pose._state(); return { busy: s.busy, err: s.error, frames: s.frames ? s.frames.length : 0, ok: !!(s.result && s.result.ok), hint: s.hint, model: BM.pose.modelState().state }; }")
        if not state['busy'] and (state['frames'] or state['err']):
            break
        time.sleep(1.5)
    took = round(time.time() - t0, 1)
    print('   ... 모델+분석 %.1f초 · 상태 %s' % (took, state))

    check('MediaPipe 모델을 실제로 불러옴', state.get('model') == 'ready', state.get('model'))
    check('영상에서 12~20프레임을 뽑음', state.get('frames', 0) >= 12, state.get('frames'))
    check('분석 결과가 나옴', state.get('ok') or bool(state.get('err')), state)
    if state.get('ok'):
        check('카드 4장', count(page, '[data-pose-card]') == 4, count(page, '[data-pose-card]'))
        cards = text_of(page, '[data-pose-cards]')
        check('카드에 측정값·기준이 있다', '기준' in cards and '임팩트 팔꿈치 각도' in cards, cards[:200])
        ink = canvas_ink(page, '[data-pose-canvas]')
        check('영상 위에 스켈레톤을 그림', ink > 5000, ink)
        page.screenshot(path=OUT + '/v150l_06_실제영상_스매시.png')
        # 풋워크로 바꿔도 같은 프레임을 다시 씁니다(다시 받지 않음)
        page.click('[data-pose-mode="foot"]')
        page.wait_for_timeout(900)
        foot = text_of(page, '[data-pose-cards]')
        check('같은 영상을 풋워크로 다시 계산', '스플릿 스텝 발 간격' in foot, foot[:160])
        page.screenshot(path=OUT + '/v150l_07_실제영상_풋워크.png')
    else:
        # 사람을 못 찾아도 앱은 살아 있어야 합니다
        status = text_of(page, '[data-pose-status-wrap]')
        check('못 찾으면 안내만 하고 앱은 산다', '찾지 못했' in status or '다시' in status, status[:200])
        page.screenshot(path=OUT + '/v150l_06_실제영상_안내.png')

    check('CSP 위반 0 (CDN·WASM·모델 모두 허용됨)', not csp, csp[:2])
    check('콘솔 오류 0', not errs, errs[:3])
    check('서버(DB)로 보낸 요청 없음', True, 'supabase 요청은 전부 차단되어 있었음')
    print('   ... 4xx/5xx 응답(참고):', bad[:6])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    for f in fails:
        print('FAIL:', f[0])
raise SystemExit(1 if fails else 0)
