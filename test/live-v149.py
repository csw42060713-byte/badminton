"""bm-v1.49.0 라이브 점검 — AI 선수 7대 훈련 균형 · 주간 부하 리듬.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
  (7대 훈련 일지 기록은 이 브라우저의 localStorage에만 심습니다)
· 실행:
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/live-v149.py
"""

import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


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


def boot(page):
    page.goto(BASE + 'index.html?l=' + str(int(time.time())), wait_until='load')
    page.wait_for_timeout(2200)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(6):
        if not page.query_selector('#sheet.is-on .sheet__panel .btn--primary'):
            break
        page.click('#sheet.is-on .sheet__panel .btn--primary')
        page.wait_for_timeout(400)


# ---------- 배포본 파일 확인 (버전 · 캐시 키 · 새 코드) ----------
stamp = '?l=' + str(int(time.time()))
sw = get(BASE + 'sw.js' + stamp)
index = get(BASE + 'index.html' + stamp)
app = get(BASE + 'app.js' + stamp)
twa = get(BASE + 'twa-manifest.json' + stamp)
ai = get(BASE + 'js/ai.js' + stamp)
log = get(BASE + 'js/views/log.js' + stamp)

check('sw.js bm-v1.49.0', "var VERSION = 'bm-v1.49.0'" in sw, sw[:0])
check('app.js v1.49.0', "version: 'v1.49.0'" in app)
check('index styles.css?v=20261122-61', 'styles.css?v=20261122-61' in index)
check('TWA 1.49.0 · 코드 41', '"appVersionName": "1.49.0"' in twa and '"appVersionCode": 41' in twa)
check('ai.js 새 함수(proBalance·loadRhythm)', 'proBalance' in ai and 'loadRhythm' in ai)
check('ai.js 근거 4편', all(k in ai for k in ['FOST98', 'HADD17', 'MA25', 'WANG25']))
check('log.js 균형 접기', 'data-fold="balance"' in log and '주간 부하 리듬' in log)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()
    watch(page)
    boot(page)

    check('앱 버전 v1.49.0', page.evaluate("() => BM.app.version") == 'v1.49.0', page.evaluate("() => BM.app.version"))
    check('새 AI 함수가 브라우저에서 산다', page.evaluate("() => typeof BM.ai.proBalance === 'function' && typeof BM.ai.loadRhythm === 'function'"))

    # 체험 모드에 7대 훈련 일지 7건 심기 (기기 저장에만)
    page.evaluate("""() => {
      const key = BM.auth.rowsKeyFor(BM.auth.session());
      const me = BM.app.ctx.store.state.me.key;
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      const today = new Date();
      const d = (off) => { const x = new Date(today.getTime()); x.setDate(x.getDate() + off); return BM.util.ymd(x); };
      const pros = [
        {'스트록': '클리어 100개'}, {'스트록': '클리어', '스매시': '20개'},
        {'스트록': '클리어', '코어': '플랭크 60초'}, {'스트록': '클리어', '스매시': '20개'},
        {'스트록': '드롭 50개', '풋워크': '10분'}, {'스트록': '클리어', '벽치기': '10분'},
        {'스트록': '클리어', '스매시': '30개'}
      ];
      for (let i = 0; i < 7; i++) {
        rows.push(BM.domain.toRow({
          type: '기록', date: d(-i), userKey: me, nick: '나래',
          cond: 6, intensity: 7, minutes: 90, done: [], pain: [], weakness: [],
          plan: { pro: pros[i] }
        }));
      }
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)

    page.click("#tabbar [data-tab='log']")
    page.wait_for_timeout(700)
    page.evaluate("() => { const d = BM.app.ctx.store.state.drafts.log; d.minutes = null; d.intensity = null; d.cond = null; }")
    page.evaluate("() => { BM.app.ctx.store.actions.analyze(); BM.app.ctx.repaint(); }")
    page.wait_for_timeout(800)

    an = page.evaluate("() => { const a = BM.app.ctx.store.state.analysis; return a ? { on: !!(a.balance && a.balance.on), sessions: a.balance && a.balance.sessions, miss: a.balance && a.balance.missing, mono: a.rhythm && a.rhythm.monotony, rest: a.rhythm && a.rhythm.restDays } : null; }")
    check('라이브 분석: 7대 훈련 7번 · 빈 항목 하체·상체', an and an['on'] and an['sessions'] == 7 and an['miss'] == ['하체 근력운동', '상체 근력운동'], an)
    check('라이브 분석: 단조로움 9.9 · 쉰 날 0일', an and an['mono'] == 9.9 and an['rest'] == 0, an)

    check('7대 훈련 균형 접기', has(page, '[data-fold="balance"]'))
    sum_txt = text_of(page, '[data-fold="balance"] summary')
    check('접기 요약 = 지난 14일 · 7번 기록', '지난 14일' in sum_txt and '7번 기록' in sum_txt, sum_txt)
    page.click('[data-fold="balance"] summary')
    page.wait_for_timeout(500)
    body = text_of(page, '[data-fold="balance"] .fold__body')
    check('비어 있는 항목 + 하나만 더', '아직 없음' in body and '이번 주에 하나만 더' in body and '스쿼트' in body, body[:200])
    page.evaluate("() => { const n = document.querySelector('[data-fold=\"balance\"]'); if (n) n.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v149l_01_7대훈련_균형.png')

    page.click('[data-fold="ai-detail"] summary')
    page.wait_for_timeout(700)
    detail = text_of(page, '[data-fold="ai-detail"] .fold__body')
    check('주간 부하 리듬 + 쉬는 날 경고', '주간 부하 리듬' in detail and '하루도 안 쉬었어요' in detail, detail[:200])
    page.evaluate("() => { const n = [...document.querySelectorAll('[data-fold=\"ai-detail\"] .planbox__t')].find(x => x.innerText.indexOf('주간 부하 리듬') === 0); if (n) n.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v149l_02_부하리듬.png')

    w = overflow(page)
    check('390px 가로 넘침 없음', w[0] <= w[1], w)
    check('콘솔 오류 0', not errs, errs[:3])
    check('CSP 위반 0', not csp, csp[:3])
    check('차단(외부) 요청은 실패로 안 셈', True, blocked[:2])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    for f in fails:
        print('FAIL:', f[0])
raise SystemExit(1 if fails else 0)
