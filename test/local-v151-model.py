"""bm-v1.51.0 로컬 점검(2) — 진짜 영상 + 진짜 MediaPipe Pose (네트워크 허용)

· CDN(jsdelivr)과 자세 모델(storage.googleapis.com)을 실제로 받아 옵니다.
  → CSP(script-src·connect-src·'wasm-unsafe-eval'·media-src blob:)가 실제로 통과하는지 확인합니다.
· 영상(work/pose-test/pose-duo.webm)은 실제 배드민턴 사진 3장면을 이어 붙여 만든 12초 webm입니다.
  0~4초 두 사람 · 4~8초 두 사람(조금 이동) · 8~12초 한 사람 → 앱이 3구간으로 나눠 분석합니다.
  앱은 이 파일을 blob: 주소로만 열고 서버로 보내지 않습니다(Supabase 요청은 막아 둡니다).
· 실행(저장소 루트에서):
  (python3 -m http.server 8818 --bind 127.0.0.1 &) ; python3 test/local-v151-model.py
"""

import time

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8818/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
VIDEO = '/workspace/work/pose-test/pose-duo.webm'
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


def cards_text(page):
    return text_of(page, '[data-pose-cards]')


def state(page):
    return page.evaluate("""() => {
      const s = BM.pose._state();
      const n = s.segs[s.seg];
      return {
        busy: s.busy, err: s.error, dur: s.duration, segs: s.segs.length, seg: s.seg, view: s.view,
        model: BM.pose.modelState().state,
        seginfo: n ? { label: n.seg.label, start: n.seg.start, end: n.seg.end, players: n.analysis.players.length,
                       track: n.track, ok: n.analysis.ok,
                       cards: n.analysis.ok ? n.analysis.players[n.track].result.cards.map(c => c.text + c.unit + ':' + c.verdict) : null,
                       times: n.frames.map(f => f.t),
                       poses: n.frames.map(f => f.poses.length) } : null,
        sums: s.segs.map(x => BM.pose.segSummary(x).text + '/' + BM.pose.segSummary(x).people)
      };
    }""")


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
    requests = []
    page.on('request', lambda r: requests.append(r.url))

    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({
          kind: 'email', email: 'model151@example.com', name: '영상테스트', at: new Date().toISOString(),
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

    hints = []
    deadline = time.time() + 200
    st = {}
    while time.time() < deadline:
        st = state(page)
        if st.get('busy'):
            h = page.evaluate("() => BM.pose._state().hint")
            if h and (not hints or hints[-1] != h):
                hints.append(h)
        elif st.get('segs') or st.get('err'):
            break
        time.sleep(1.5)
    took = round(time.time() - t0, 1)
    print('   ... 모델+일괄 분석 %.1f초 · 상태 %s' % (took, {k: v for k, v in st.items() if k != 'seginfo'}))
    print('   ... 진행 안내:', hints[:8])

    check('MediaPipe 모델을 실제로 불러옴', st.get('model') == 'ready', st.get('model'))
    check('영상 길이 12초', st.get('dur') == 12, st.get('dur'))
    check('구간 3개로 자동 분할', st.get('segs') == 3, st.get('segs'))
    check('진행 안내에 "1/3 구간"·"2/3 구간"이 보인다',
          any('/3 구간 분석 중' in h for h in hints) or any('/3 구간' in h for h in hints), hints[:6])

    segbar = text_of(page, '[data-pose-segs]')
    check('구간 칩에 1·2·3구간이 있다', all(('%d구간' % i) in segbar for i in (1, 2, 3)), segbar[:200])
    check('구간 시간이 0~4·4~8·8~12초', '0.0~4.0초' in segbar and '4.0~8.0초' in segbar and '8.0~12.0초' in segbar,
          segbar[:200])
    check('구간 요약(보완 N건/좋아요)', ('보완' in segbar or '좋아요' in segbar), segbar[:200])
    check('영상 길이·구간 수 표시', '영상 12.0초 · 3구간' in text_of(page, '[data-pose-seghead], [data-pose-segdur]'),
          text_of(page, '[data-pose-segdur]'))
    page.screenshot(path=OUT + '/v151l_07_영상_1구간.png')

    # ---- 구간마다 분석 결과가 따로 있는지 (내부 상태 + 실제 화면) ----
    segs = page.evaluate("""() => {
      const s = BM.pose._state();
      return s.segs.map(n => ({ label: n.seg.label, start: n.seg.start, end: n.seg.end,
        players: n.analysis.players.length,
        summary: BM.pose.segSummary(n).text,
        cards: n.analysis.ok ? n.analysis.players[n.track].result.cards.map(c => c.text) : [],
        times: n.frames.map(f => f.t),
        allInRange: n.frames.every(f => f.t >= n.seg.start && f.t <= n.seg.end) }));
    }""")
    print('   ... 구간별:', segs)
    check('구간마다 사람을 찾았다', all(g['players'] >= 1 for g in segs), [g['players'] for g in segs])
    check('구간마다 프레임 시각이 그 구간 안', all(g['allInRange'] for g in segs),
          [(g['label'], g['times'][:2], g['times'][-1]) for g in segs])
    check('구간마다 카드 4장', all(len(g['cards']) == 4 for g in segs), [len(g['cards']) for g in segs])
    two = [i for i, g in enumerate(segs) if g['players'] >= 2]
    check('두 선수가 잡힌 구간이 있다', bool(two), two)

    # ---- 2구간(여러 명) 열기 ----
    multi = two[0] if two else 1
    page.click('[data-pose-seg="%d"]' % multi)
    page.wait_for_timeout(800)
    st2 = state(page)
    check('%d구간으로 바뀐다' % (multi + 1), st2['seg'] == multi and st2['seginfo']['label'] == '%d구간' % (multi + 1),
          (st2['seg'], st2['seginfo'] and st2['seginfo']['label']))
    check('%d구간 카드 4장' % (multi + 1), count(page, '[data-pose-card]') == 4)
    check('프레임 시간이 그 구간 안', st2['seginfo']['start'] <= float(text_of(page, '[data-pose-time]').replace('초', '') or -1)
          <= st2['seginfo']['end'], text_of(page, '[data-pose-time]'))
    check('선수 칩이 그 구간 인원만큼', count(page, '[data-pose-track]') == st2['seginfo']['players'],
          (count(page, '[data-pose-track]'), st2['seginfo']['players']))
    who = text_of(page, '[data-pose-who]')
    check('선수 N명 안내 배너', ('선수 %d명이 보여요' % st2['seginfo']['players']) in who, who[:120])
    cards1 = cards_text(page)
    page.screenshot(path=OUT + '/v151l_08_2구간_선수칩.png')

    # ---- 선수 2 로 바꾸기 → 카드·스켈레톤이 바뀐다 ----
    if st2['seginfo']['players'] >= 2:
        ink1 = canvas_ink(page, '[data-pose-canvas]')
        page.click('[data-pose-track="1"]')
        page.wait_for_timeout(800)
        st3 = state(page)
        cards2 = cards_text(page)
        ink2 = canvas_ink(page, '[data-pose-canvas]')
        check('선수 2 칩이 켜진다', page.evaluate(
            "() => { const n = document.querySelector('[data-pose-track=\"1\"]'); return n && n.classList.contains('is-on'); }"))
        check('선수 2로 바뀌면 카드가 달라진다', cards1 != cards2, '%s → %s' % (cards1[:80], cards2[:80]))
        check('선수 2 카드도 4장', count(page, '[data-pose-card]') == 4)
        check('캔버스 스켈레톤도 바뀐다', ink1 != ink2, '%s → %s' % (ink1, ink2))
        check('선수 2 측정값이 실제로 계산됨', st3['seginfo'] and st3['seginfo']['cards'] is not None,
              st3['seginfo'] and st3['seginfo']['cards'])
        print('   ... 선수1 카드:', cards1[:120].replace('\n', ' | '))
        print('   ... 선수2 카드:', cards2[:120].replace('\n', ' | '))
        page.screenshot(path=OUT + '/v151l_09_선수2_카드.png')
    else:
        check('선수 2 칩 (두 선수 구간 필요)', False, '두 선수가 잡힌 구간이 없음')

    # ---- 다른 구간으로 바꾸면 상세가 그 구간 것으로 ----
    other = 2 if multi != 2 else 0
    page.click('[data-pose-seg="%d"]' % other)
    page.wait_for_timeout(800)
    st4 = state(page)
    cards3 = cards_text(page)
    check('%d구간으로 바뀐다' % (other + 1), st4['seg'] == other, st4['seg'])
    check('구간을 바꾸면 카드가 달라진다', cards3 != cards2 if st2['seginfo']['players'] >= 2 else cards3 != cards1,
          '%s → %s' % (cards2[:70], cards3[:70]))
    check('구간을 바꾸면 프레임 시간도 그 구간 것', st4['seginfo']['start'] <= float(
        text_of(page, '[data-pose-time]').replace('초', '') or -1) <= st4['seginfo']['end'],
        text_of(page, '[data-pose-time]'))
    check('한 명짜리 구간이면 선수 칩이 사라진다',
          (count(page, '[data-pose-track]') == 0) == (st4['seginfo']['players'] < 2),
          (count(page, '[data-pose-track]'), st4['seginfo']['players']))
    check('캔버스에 스켈레톤이 그려진다', canvas_ink(page, '[data-pose-canvas]') > 3000, canvas_ink(page, '[data-pose-canvas]'))
    page.screenshot(path=OUT + '/v151l_10_%d구간.png' % (other + 1))

    # ---- 프레임 슬라이더 ----
    t_before = text_of(page, '[data-pose-time]')
    page.evaluate("""() => {
      const r = document.querySelector('[data-pose-range]');
      r.value = '3';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    page.wait_for_timeout(400)
    t_after = text_of(page, '[data-pose-time]')
    ok_after = page.evaluate("() => BM.pose._state().segs[BM.pose._state().seg].frames[BM.pose._state().view].t")
    check('프레임 슬라이더로 시간이 바뀐다', t_before != t_after, t_before + ' → ' + t_after)
    check('고른 프레임이 그 구간 안', st4['seginfo']['start'] <= ok_after <= st4['seginfo']['end'], ok_after)

    # ---- 풋워크로 바꾸면 저장한 좌표로 다시 계산 ----
    page.click('[data-pose-mode="foot"]')
    page.wait_for_timeout(1200)
    foot = text_of(page, '[data-pose-cards]')
    st5 = state(page)
    check('풋워크 카드로 바뀐다', '스플릿 스텝 발 간격' in foot and '런지 앞무릎' in foot, foot[:160])
    check('구간 목록은 그대로 3개', st5['segs'] == 3, st5['segs'])
    check('구간 요약도 풋워크 기준으로 다시 계산', st5['sums'] and all('/' in x for x in st5['sums']), st5['sums'])
    page.screenshot(path=OUT + '/v151l_11_풋워크.png')

    # ---- 영상은 서버로 안 나간다 ----
    check('서버(DB)로 보낸 요청 없음', not [u for u in requests if 'supabase.co' in u], [u for u in requests if 'supabase' in u][:2])
    check('CSP 위반 0 (CDN·WASM·모델 모두 허용됨)', not csp, csp[:2])
    check('콘솔 오류 0', not errs, errs[:3])
    print('   ... 4xx/5xx 응답(참고):', bad[:6])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    for f in fails:
        print('FAIL:', f[0])
raise SystemExit(1 if fails else 0)
