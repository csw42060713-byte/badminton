"""bm-v1.49.0 로컬 점검 — AI 선수 7대 훈련 균형 · 주간 부하 리듬(단조로움).

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고, 7대 훈련을 적은 일지 기록을 심어 실제 화면을 확인합니다
  → 서버 DB에는 아무것도 쓰지 않습니다.
  A) 7대 훈련 균형 접기 — 지난 14일 횟수 · 비어 있는 항목 · '이번 주에 하나만 더'
  B) 주간 부하 리듬 — 단조로움(매일 같은 부하) · 쉰 날 0일 경고
  C) 선수 기록이 없는 계정 — 7대 훈련 접기는 없고 부하 리듬은 그대로
· 실행:
  (저장소 루트에서) python3 -m http.server 8818 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/local-v149.py
"""

import json
import time

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8818/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
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


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)

    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'tile.openstreetmap.org' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    watch(page)

    def login(email, nick, level, role, records):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
              onboardedAt: '2026-11-21 09:00:00',
              profile: { nick: a.nick, level: a.level, discipline: '단식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-21 09:00:00', role: a.role }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick, 'level': level, 'role': role})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)
        key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
        me = page.evaluate("() => BM.app.ctx.store.state.me.key")
        page.evaluate("""(a) => {
          const rows = JSON.parse(localStorage.getItem(a.key) || '[]');
          const today = new Date();
          function d(off) {
            const x = new Date(today.getTime()); x.setDate(x.getDate() + off);
            return BM.util.ymd(x);
          }
          a.records.forEach((r) => {
            const e = {
              type: '기록', date: d(r.off), userKey: a.me, nick: a.nick,
              cond: r.cond == null ? 6 : r.cond,
              intensity: r.intensity == null ? 7 : r.intensity,
              minutes: r.minutes == null ? 90 : r.minutes,
              done: [], pain: [], weakness: r.weakness || []
            };
            if (r.pro) e.plan = { pro: r.pro };
            rows.push(BM.domain.toRow(e));
          });
          localStorage.setItem(a.key, JSON.stringify(rows));
        }""", {'key': key, 'me': me, 'nick': nick, 'records': records})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)
        return me

    def analyze():
        page.click("#tabbar [data-tab='log']")
        page.wait_for_timeout(600)
        # 심어 둔 기록만으로 계산합니다(저장 전 초안의 시간·강도는 비움 → 오늘 두 번 세지 않음)
        page.evaluate("() => { const d = BM.app.ctx.store.state.drafts.log; d.minutes = null; d.intensity = null; d.cond = null; }")
        page.evaluate("() => { BM.app.ctx.store.actions.analyze(); BM.app.ctx.repaint(); }")
        page.wait_for_timeout(700)

    # =====================================================
    # A · B — 선수 계정, 세로 390×844
    # =====================================================
    flat = [{'off': -i, 'minutes': 90, 'intensity': 7, 'pro': {'스트록': '클리어 100개'}} for i in range(0, 7)]
    flat[1]['pro'] = {'스트록': '클리어', '스매시': '20개'}
    flat[2]['pro'] = {'스트록': '클리어', '코어': '플랭크 60초'}
    flat[3]['pro'] = {'스트록': '클리어', '스매시': '20개', '풋워크': '10분'}
    flat[5]['pro'] = {'스트록': '드롭 50개', '벽치기': '10분', '스매시': '30개'}
    login('player149@example.com', '선수에이', '선수부', 'player', flat)

    check('A 앱 버전 v1.49.0', page.evaluate("() => BM.app.version") == 'v1.49.0', page.evaluate("() => BM.app.version"))
    analyze()

    an = page.evaluate("() => { const a = BM.app.ctx.store.state.analysis; return a ? { on: !!(a.balance && a.balance.on), miss: a.balance && a.balance.missing, sessions: a.balance && a.balance.sessions, mono: a.rhythm && a.rhythm.monotony, rest: a.rhythm && a.rhythm.restDays } : null; }")
    check('A 분석에 7대 훈련 균형', an and an['on'], an)
    check('A 7번 기록 · 빈 항목 2개(하체·상체)', an and an['sessions'] == 7 and an['miss'] == ['하체 근력운동', '상체 근력운동'], an)
    check('A 단조로움 9.9 · 쉰 날 0일', an and an['mono'] == 9.9 and an['rest'] == 0, an)

    check('A 7대 훈련 균형 접기가 화면에', has(page, '[data-fold="balance"]'))
    sum_txt = text_of(page, '[data-fold="balance"] summary')
    check('A 접기 요약 = 지난 14일 · 7번 기록', '지난 14일' in sum_txt and '7번 기록' in sum_txt, sum_txt)
    page.click('[data-fold="balance"] summary')
    page.wait_for_timeout(500)
    body = text_of(page, '[data-fold="balance"] .fold__body')
    check('A 항목별 횟수·아직 없음', '하체 근력운동' in body and '아직 없음' in body, body[:160])
    check('A 이번 주에 하나만 더 + 이유', '이번 주에 하나만 더' in body and '스쿼트' in body, body[:240])

    page.evaluate("() => { const n = document.querySelector('[data-fold=\"balance\"]'); if (n) n.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v149_01_7대훈련_균형.png')

    # ---- B. 부하 리듬 (자세히 보기 안) ----
    page.click('[data-fold="ai-detail"] summary')
    page.wait_for_timeout(600)
    detail = text_of(page, '[data-fold="ai-detail"] .fold__body')
    check('B 주간 부하 리듬 줄', '주간 부하 리듬' in detail, detail[:160])
    check('B 매일 같은 부하 → 쉬는 날 경고', '하루도 안 쉬었어요' in detail, detail[:300])
    check('B 참고 논문 한 줄', 'Foster' in detail and 'Haddad' in detail, detail[-200:])
    page.evaluate("() => { const n = [...document.querySelectorAll('[data-fold=\"ai-detail\"] .planbox__t')].find(x => x.innerText.indexOf('주간 부하 리듬') === 0); if (n) n.scrollIntoView({block: 'center'}); }")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v149_02_부하리듬.png')

    w = overflow(page)
    check('B 390px 가로 넘침 없음', w[0] <= w[1], w)

    # =====================================================
    # C — 7대 훈련 기록이 없는 계정
    # =====================================================
    plain = [{'off': -5, 'minutes': 60, 'intensity': 6}, {'off': -3, 'minutes': 60, 'intensity': 6},
             {'off': -1, 'minutes': 60, 'intensity': 6}]
    login('club149@example.com', '동호인비', 'C조', 'club', plain)
    analyze()
    check('C 7대 훈련 접기 없음', not has(page, '[data-fold="balance"]'))
    page.click('[data-fold="ai-detail"] summary')
    page.wait_for_timeout(500)
    detail2 = text_of(page, '[data-fold="ai-detail"] .fold__body')
    check('C 일반 기록에도 부하 리듬은 나옴', '주간 부하 리듬' in detail2, detail2[:160])
    page.screenshot(path=OUT + '/v149_03_일반계정.png')

    check('콘솔 오류 0', not errs, errs[:3])
    check('CSP 위반 0', not csp, csp[:3])
    check('차단(네트워크) 요청은 실패로 안 셈', True, blocked[:2])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    for f in fails:
        print('FAIL:', f[0])
raise SystemExit(1 if fails else 0)
