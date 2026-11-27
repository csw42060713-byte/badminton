"""bm-v1.72.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.72.0 (sw.js · app.js · styles.css?v=20261125-1) · 5개 탭 그대로
  2) ① 영수증 — 시간·점수 없는 일지도 TOTAL이 훈련으로 채워지고 종이가 비지 않는다
  3) ② 대회 인증 — 날짜 입력이 있고 고른 날짜가 카드에 간다
  4) ③ 일지 & AI — 무릎 통증이면 풋워크·점프 대신 상체·스트레칭·회복, 이유 한 줄
  5) ④ 저장 뒤 접힘 — 선수 루틴 4개가 '심화 · 선수 루틴 더 보기' 하나로
  6) ⑤ 상세 리포트 — 접전 하락에는 보완 문구 · 통증에는 회복 안내 · 오타 없음
  7) ⑥ 영상 자세 비교 — 예시 1·2구간 시간이 이어지고, 예시를 본 뒤에도 전환 버튼
  8) 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360) · 캡처 downloads/live-morning-ux.png

실행(저장소 루트에서):
  python3 test/live-v172.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'jsdelivr' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:300])
            return
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            return      # 라이브에서 막은 외부(supabase·지도 타일) 요청
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))

    def tap(sel, wait=500):
        page.click('#sheet ' + sel)
        page.wait_for_timeout(wait)

    def body_top():
        page.evaluate("() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = 0; }")
        page.wait_for_timeout(160)

    def not_blank():
        return page.evaluate("""() => {
          const c = document.querySelector('#sheet .sc__canvas');
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const seen = new Set(); let ink = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i+3] > 8) ink++;
            seen.add(d[i] + ',' + d[i+1] + ',' + d[i+2] + ',' + d[i+3]);
          }
          return { colors: seen.size, ink: ink, total: d.length / 4 };
        }""")

    # ── A. 라이브 파일 버전 · 새 코드 ──
    sw = page.request.get(BASE + 'sw.js').text()
    check('A 라이브 sw.js bm-v1.72.0', "var VERSION = 'bm-v1.72.0'" in sw)
    app_src = page.request.get(BASE + 'app.js').text()
    check('A 라이브 app.js v1.72.0', "version: 'v1.72.0'" in app_src)
    index = page.request.get(BASE + 'index.html').text()
    check('A 라이브 styles.css?v=20261125-1', 'styles.css?v=20261125-1' in index)
    sc_src = page.request.get(BASE + 'js/sharecard.js').text()
    check('A 공유 카드: 영수증 빈 칸 채우기 + 대회 날짜 칸', 'function doneLine' in sc_src
          and 'function noteLineOf' in sc_src and 'function dateField' in sc_src)
    ai_src = page.request.get(BASE + 'js/ai.js').text()
    check('A 일지 & AI: 통증 안전 드릴 표', 'PAIN_SAFE_DRILLS' in ai_src and 'painSafeDrills' in ai_src)
    log_src = page.request.get(BASE + 'js/views/log.js').text()
    check('A 일지 화면: 심화 묶음 접기', 'function proFold' in log_src and 'fold--pro' in log_src)
    rep_src = page.request.get(BASE + 'js/report.js').text()
    check('A 리포트: 회복 안내·오타 수정', '아픈 부위가 편해질 때까지는' in rep_src and '채워져요.일지의' not in rep_src)
    pose_src = page.request.get(BASE + 'js/pose.js').text()
    check('A 자세 비교: 예시 전환 줄', 'function demoLinksHtml' in pose_src)

    # ── B. 앱 부팅 ──
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live172@example.com', name: '승우',
          at: new Date().toISOString(), onboardedAt: '2026-11-24 20:10:00',
          profile: { nick: '승우', level: 'A조', discipline: '복식', region: '경기', club: '나래울체육관',
                     onboardedAt: '2026-11-24 20:10:00' } }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('B 라이브 앱 v1.72.0', page.evaluate("() => BM.app.version") == 'v1.72.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('B 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)
    w = overflow(page)
    check('B 390 가로 넘침 없음', w[0] <= w[1], w)

    # ── C. ① 영수증: 시간·점수 없는 일지 ──
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'rlive172', date: '2026-11-21', done: ['풋워크'], cond: 9, weakness: ['풋워크'],
        text: '서브 연습 위주로 가볍게' }];
      st.data.stats = Object.assign({}, st.data.stats, { streak: 0 });
    }""")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.sharecard.open(BM.app.ctx, { mode: 'today', record: BM.app.ctx.store.state.data.records[0] })")
    page.wait_for_timeout(2000)
    tap('[data-sc-design="receipt"]', 900)
    rows = page.evaluate("""() => {
      const spec = BM.sharecard._specOf(BM.app.ctx);
      return { keys: BM.sharecard.receiptRows(spec).map(r => r.key),
               big: spec.big.value, textOnly: !!spec.big.textOnly,
               done: spec.doneText, minutes: spec.minutes };
    }""")
    check('C 영수증 빈 칸: 운동시간·경기 대신 훈련·한 줄',
          '훈련' in rows['keys'] and '한 줄' in rows['keys']
          and '운동시간' not in rows['keys'] and '경기' not in rows['keys'], rows['keys'])
    check('C TOTAL 자리가 훈련 이름', rows['big'] == '풋워크' and rows['textOnly'] is True, rows)
    nb = not_blank()
    check('C 영수증 종이가 실제로 그려진다', nb['colors'] > 8 and nb['ink'] > nb['total'] * 0.002, nb)

    cv = page.locator('#sheet .sc__canvas')
    cv.scroll_into_view_if_needed()
    page.wait_for_timeout(320)
    cap = OUT + '/live-morning-ux.png'
    cv.screenshot(path=cap)
    print('  saved ' + cap, flush=True)
    check('C 캡처 저장', os.path.exists(cap) and os.path.getsize(cap) > 8000,
          os.path.getsize(cap) if os.path.exists(cap) else 0)

    # ── D. ② 대회 인증 날짜 ──
    body_top()
    tap('[data-sc-mode="comp"]', 800)
    check('D 대회 인증 날짜 입력', page.locator('#sheet input[type=date][data-sc-field="date"]').count() == 1)
    check('D 날짜 안내 한 줄', '지난 대회 날짜로 바꿀 수 있어요' in page.inner_text('#sheet'))
    page.fill('#sheet [data-sc-field="date"]', '2026-11-15')
    page.wait_for_timeout(700)
    comp = page.evaluate("""() => {
      const spec = BM.sharecard._specOf(BM.app.ctx);
      return { date: spec.date, top: spec.top, ui: BM.sharecard._state().date };
    }""")
    check('D 고른 날짜가 카드로 간다', '11/15' in str(comp['date']) + str(comp['top']) or comp['ui'].startswith('2026-11-15'), comp)
    tap('[data-sc-ratio="story"]', 600)
    check('D 스토리 9:16 그대로', page.evaluate(
        "() => { const c = document.querySelector('#sheet .sc__canvas'); return c.width + 'x' + c.height; }") == '1080x1920')
    body_top()
    tap('[data-sc-ratio="feed"]', 400)
    page.evaluate("() => BM.sheet && BM.sheet.close && BM.sheet.close()")
    page.wait_for_timeout(600)

    # ── E. ③ 통증 드릴 · ④ 심화 묶음 ──
    pain = page.evaluate("""() => {
      const an = BM.ai.analyze({ draft: { cond: 7, intensity: 6, minutes: 50, pain: ['무릎'], weakness: ['풋워크'] },
        records: [], level: 'B조', nick: '승우' });
      const names = (an.drills.drills || []).map(d => d.name);
      const html = BM.views.log.analysisCard(an, { data: { records: [] }, ui: {} });
      var foldCount = (html.match(/data-fold="pro"/g) || []).length;
      var oldFolds = (html.match(/data-fold="balance"|data-fold="offcourt"|data-fold="sense"|data-fold="match"/g) || []).length;
      return { names: names, note: an.drills.note, html: html.slice(0, 0), hasSwap: html.indexOf('data-drill-swap') >= 0,
               proFold: html.indexOf('심화 · 선수 루틴 더 보기') >= 0, foldCount: foldCount, oldFolds: oldFolds,
               weekMenu: an.week && an.week[0] ? an.week[0].menu : '' };
    }""")
    bad = [n for n in pain['names'] if any(k in n for k in ['풋워크', '점프', '육각', '스텝', '런지'])]
    check('E 무릎 통증: 부담 큰 드릴 0개', len(pain['names']) == 3 and not bad, pain['names'])
    check('E 이유 한 줄이 화면에', pain['hasSwap'] and '무릎' in pain['note'], pain['note'])
    check('E 이번 주 메뉴도 안전 드릴', '풋워크' not in str(pain['weekMenu']), pain['weekMenu'])
    check('E 심화 묶음 하나로', pain['proFold'] and pain['foldCount'] == 1, [pain['foldCount'], pain['oldFolds']])

    # ── F. ⑤ 상세 리포트 문구 ──
    rep = page.evaluate("""() => {
      function reportOf(diff) {
        return { mode: 'week', periodLabel: '이번 주', prevPeriodLabel: '지난주', role: 'club', level: 'B조',
          current: { sessions: 3, minutes: 180, rate: 40, games: 10,
                     close: { games: 6, wins: 2, losses: 4, rate: diff == null ? 33 : (diff < 0 ? 33 : 67) } },
          prev: { sessions: 3 }, closeDiff: diff, weaknesses: [], repeatedPains: [] };
      }
      var down = BM.report.direction(reportOf(-33)).join(' | ');
      var up = BM.report.direction(reportOf(33)).join(' | ');
      var flag = reportOf(0);
      flag.repeatedPains = [{ name: '무릎', n: 2 }];
      var withPain = BM.report.direction(flag).join(' | ');
      var html = BM.report.bodyHtml(BM.report.build([{ id: 'x1', date: BM.util.ymd(), weakness: [], pain: [] }], { mode: 'week' }));
      return { down: down, up: up, withPain: withPain,
               typo: html.indexOf('채워져요.일지의') >= 0, spaced: html.indexOf('채워져요. 일지의') >= 0 };
    }""")
    check('F 접전 하락: 보완 문구 · 모순 칭찬 없음',
          '서브를 낮게' in rep['down'] and '지금처럼 마지막까지 집중하는 게 잘 되고 있어요' not in rep['down'], rep['down'][:160])
    check('F 오른 주에는 보완 문구 없음', '서브를 낮게' not in rep['up'], rep['up'][:160])
    check('F 통증 있으면 회복 안내', '아픈 부위가 편해질 때까지는' in rep['withPain'], rep['withPain'][:160])
    check('F "채워져요. 일지의" 띄어쓰기', rep['spaced'] and not rep['typo'], rep['typo'])

    # ── G. ⑥ 영상 자세 비교 예시 ──
    pose = page.evaluate("""() => {
      const P = BM.pose, packs = P.demoJump();
      const t0 = P.segTime(packs[0].seg), t1 = P.segTime(packs[1].seg);
      P._analyzeDemo('smash');
      const html = P.statusHtml();
      P._setMode('foot');
      const foot = P.statusHtml();
      return { t0: t0, t1: t1, joined: packs[1].seg.start === packs[0].seg.end,
               base: html.indexOf('data-pose-demo=""') >= 0, jump: html.indexOf('data-pose-demo="jump"') >= 0,
               duo: html.indexOf('data-pose-demo="duo"') >= 0,
               hint: html.indexOf('다른 예시로 바로 바꿀 수 있어요') >= 0,
               footDuo: foot.indexOf('data-pose-demo="duo"') >= 0, footJump: foot.indexOf('data-pose-demo="jump"') >= 0 };
    }""")
    check('G 예시 1·2구간 이어짐', pose['t0'] == '0.0~1.5초' and pose['t1'] == '1.5~3.0초' and pose['joined'],
          [pose['t0'], pose['t1']])
    check('G 예시를 본 뒤에도 전환 버튼', pose['base'] and pose['jump'] and pose['duo'] and pose['hint'], pose)
    check('G 풋워크에는 점프 예시 없음', pose['footDuo'] and not pose['footJump'], pose)

    # ── H. 360 폭 · 오류 ──
    page.set_viewport_size({'width': 360, 'height': 844})
    page.wait_for_timeout(500)
    w2 = overflow(page)
    check('H 360 가로 넘침 없음', w2[0] <= w2[1], w2)
    page.wait_for_timeout(400)
    check('H 콘솔·페이지 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok in checks if ok)
print('\n%d/%d 통과' % (passed, len(checks)))
