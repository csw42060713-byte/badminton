"""bm-v1.47.0 로컬(390×844) 점검 — 하트·광고 UX · 꾸미기 미리보기 · 코치 소속 지도.

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일 요청은 막습니다).
· 진짜 앱(index.html)을 체험(local) 모드로 열어 실제 버튼을 눌러 확인합니다.
  A) MY 하트 카드 — '남은 N/5회 · 다음 광고까지 N초' 가 1초마다 줄어드는지, 광고 1회 적립
  B) 꾸미기 미리보기 — 잠긴 프레임/배지를 지금 ↔ 적용 후로 비교, 1탭 해금
  C) 매칭 — 하트가 모자랄 때 '광고 보고 +1' 1탭
  D) 코치 — 승인된 코치의 소속 체육관 → 탭 한 번에 지도
· 실행:
  (저장소 루트에서) python3 -m http.server 8817 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/local-v147.py
"""

import json
import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8817/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []

PLAYER = 'heart147@example.com'
FAN = 'fan147@example.com'
COACH_KEY = 'coach147_key'


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def toast(page):
    return text_of(page, '#toast')


def avatar_frame(page, sel='[data-deco-preview] [data-frame]'):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.getAttribute('data-frame') : ''; }", sel)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
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
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def login(email, nick, rows=None):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
              onboardedAt: '2026-11-21 09:00:00',
              profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-21 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)
        if rows is not None:
            key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
            page.evaluate("(a) => { localStorage.setItem(a.key, a.rows); }", {'key': key, 'rows': rows})
            page.reload(wait_until='load')
            page.wait_for_timeout(2400)
        return page.evaluate("() => (BM.app && BM.app.ctx && BM.app.ctx.store.state.me && BM.app.ctx.store.state.me.key) || ''")

    def rows_json():
        key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
        return page.evaluate("(k) => localStorage.getItem(k) || '[]'", key)

    # ── A. MY 하트 카드 — 남은 횟수·쿨타임
    me_key = login(PLAYER, '하트수집가')
    check('A 앱 진입(일지 & AI)', page.evaluate("() => !!document.querySelector('[data-act=\\\"open-scoreboard\\\"]')"), me_key)
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    page.evaluate("() => { const n = document.querySelector('[data-region=\"heart\"]'); if (n) n.scrollIntoView({block: 'start'}); }")
    page.wait_for_timeout(500)
    check('A 하트 카드가 화면에', has(page, '[data-region="heart"]'))
    sub0 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    stat0 = text_of(page, '[data-ad-stat]')
    check('A 하트 카드 광고 줄 = 남은 N/5회 · 지금', ('남은 5/5회' in sub0) and ('지금' in sub0), sub0)
    check('A 오늘 광고 칸 N/5', stat0.strip() == '0/5', stat0)
    page.screenshot(path=OUT + '/v147_01_MY_하트카드.png')

    balance_before = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    page.click('[data-ad-btn]')
    page.wait_for_timeout(600)
    check('A 광고 미리보기 시트', has(page, '.ad-sim'), text_of(page, '#sheet .sheet__head'))
    page.screenshot(path=OUT + '/v147_02_광고_미리보기.png')
    page.wait_for_timeout(3200)
    t = toast(page)
    check('A 광고 1회 → 하트 +1 안내', '하트 +1' in t, t)
    balance_after = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('A 잔액 +1', balance_after == balance_before + 1, (balance_before, balance_after))
    sub1 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    check('A 쿨타임 문구 = 남은 4/5회 · 다음 광고까지', ('남은 4/5회' in sub1) and ('다음 광고까지' in sub1), sub1)
    stat1 = text_of(page, '[data-ad-stat]')
    check('A 오늘 광고 칸 1/5 로 갱신', stat1.strip() == '1/5', stat1)
    page.wait_for_timeout(1600)
    sub2 = text_of(page, '[data-ad-btn] [data-ad-sub]')
    n1 = int(''.join(ch for ch in sub1.split('다음 광고까지')[-1] if ch.isdigit()) or 0)
    n2 = int(''.join(ch for ch in sub2.split('다음 광고까지')[-1] if ch.isdigit()) or 0)
    check('A 1초마다 카운트다운이 줄어든다', n2 < n1, (sub1, sub2))
    check('A 쿨타임 동안 광고 버튼 잠금', page.evaluate("() => document.querySelector('[data-ad-btn]').disabled"), '')

    # ── B. 꾸미기 미리보기
    page.click('[data-act="decorate-sheet"]')
    page.wait_for_timeout(1100)
    check('B 꾸미기 시트', has(page, '[data-dframe]'))
    locked = page.evaluate("""() => {
      const b = Array.from(document.querySelectorAll('[data-dframe]')).find(x => x.classList.contains('is-locked'));
      return b ? b.getAttribute('data-dframe') : '';
    }""")
    check('B 잠긴 프레임이 있다', bool(locked), locked)
    page.screenshot(path=OUT + '/v147_03_꾸미기_잠금.png')
    page.click('[data-dframe="%s"]' % locked)
    page.wait_for_timeout(800)
    check('B 잠긴 프레임 → 미리보기 시트', has(page, '[data-dpv-seg]'), text_of(page, '#sheet .sheet__head'))
    pv = text_of(page, '#sheet')
    check('B 지금 모습 / 적용 후 비교', ('지금 모습' in pv) and ('적용 후' in pv), pv[:80])
    check('B 적용 후 아바타에 그 프레임', avatar_frame(page) == locked, avatar_frame(page))
    check('B 내 닉네임으로 미리보기', '하트수집가' in pv, pv[:80])
    page.screenshot(path=OUT + '/v147_04_미리보기_적용후.png')
    page.click('#sheet [data-dpv="now"]')
    page.wait_for_timeout(500)
    check('B 지금 모습으로 바꾸면 원래 프레임', avatar_frame(page) != locked, avatar_frame(page))
    page.click('#sheet [data-dpv="next"]')
    page.wait_for_timeout(500)

    # 하트가 모자란 상태를 만들어 '광고 보고 +1' 경로를 확인
    page.evaluate("() => { const st = BM.app.ctx.store.state; st.data.hearts.balance = 0; BM.app.repaint(); }")
    page.evaluate("() => BM.views.my.openDecoPreviewSheet(BM.app.ctx, 'frame', '%s', BM.views.my.decorateDraft(BM.app.ctx.store.state), function(){})" % locked)
    page.wait_for_timeout(700)
    check('B 하트 0 → 광고 버튼', has(page, '#sheet [data-dpv-act="ad"]'), text_of(page, '#sheet [data-dpv-act="ad"]'))
    check('B 모자란 수 안내', '부족' in text_of(page, '#sheet'), text_of(page, '#sheet')[-120:])
    page.screenshot(path=OUT + '/v147_05_미리보기_하트부족.png')

    # 하트를 채운 뒤에는 1탭 해금 버튼
    page.evaluate("() => { const st = BM.app.ctx.store.state; st.data.hearts.balance = 9; }")
    page.evaluate("() => BM.views.my.openDecoPreviewSheet(BM.app.ctx, 'frame', '%s', BM.views.my.decorateDraft(BM.app.ctx.store.state), function(){})" % locked)
    page.wait_for_timeout(700)
    unlock = text_of(page, '#sheet [data-dpv-act="unlock"]')
    check('B 하트 충분 → 1탭 해금 버튼', '하트' in unlock and '열기' in unlock, unlock)
    page.screenshot(path=OUT + '/v147_06_미리보기_해금가능.png')
    before_bal = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    page.click('#sheet [data-dpv-act="unlock"]')
    page.wait_for_timeout(1000)
    after_bal = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('B 해금하면 하트가 빠진다', after_bal < before_bal, (before_bal, after_bal))
    owned = page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      const me = st.me.key;
      return BM.domain.ownsDeco(st.data.idx, me, 'frame:' + '%s', st.data.hearts.checkinStreak || 0);
    }""" % locked)
    check('B 해금된 프레임이 내 것으로', owned)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(600)

    # ── C. 매칭 — 하트가 모자랄 때 1탭 광고 (진짜 하트: 시작 3개 → 프레임 2개 해금 = 1개)
    login('short147@example.com', '하트모자람')
    page.evaluate("() => BM.app.ctx.store.actions.buyDeco('frame', 'gold')")
    page.evaluate("() => { BM.app.ctx.store.actions.setTab('matching'); BM.app.repaint(); }")
    page.wait_for_timeout(1200)
    b0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('C 하트가 모자란 상태(1/2)', b0 == 1, b0)
    check('C 매칭 내 카드에 광고 1탭', has(page, '[data-act="ad-heart"]'), text_of(page, '[data-act="ad-heart"]'))
    check('C 매칭 카드에 부족 안내', '1개 부족' in text_of(page, '.mycard__hearts'), text_of(page, '.mycard__hearts'))
    page.screenshot(path=OUT + '/v147_07_매칭_하트부족.png')
    page.click('[data-act="ad-heart"]')
    page.wait_for_timeout(4200)
    b1 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('C 광고 보고 +1 → 잔액 +1', b1 == b0 + 1, (b0, b1, toast(page)))
    check('C 채워지면 부족 안내가 사라진다', '부족' not in text_of(page, '.mycard__hearts'), text_of(page, '.mycard__hearts'))
    page.screenshot(path=OUT + '/v147_08_매칭_하트충전됨.png')

    # ── D. 코치 소속 → 지도
    rows = json.loads(rows_json())
    rows.append({
        'id': 'mentor-147-local', 'type': '멘토신청', 'createdAt': '2026-11-22 08:00:00',
        'date': '2026-11-22', 'nick': '콕집사', 'userKey': COACH_KEY, 'target': 'admin',
        'status': '승인', 'payload': {
            'type': '체육관 코치', 'affiliation': '나래울 배드민턴장 · 매원고 배드민턴부',
            'experience': '7년', 'awards': '시 대회 3위', 'proof': '재직 확인', 'proofUrl': '',
            'proofPhoto': '', 'reason': '성인반을 봅니다', 'status': '승인',
            'submitted': '2026-11-20 10:00:00', 'level': 'B조', 'discipline': '복식'
        }
    })
    login(FAN, '팬', rows=json.dumps(rows, ensure_ascii=False))
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(1200)
    cards = text_of(page, '.coachcards') if has(page, '.coachcards') else ''
    check('D 코치 카드에 소속', '나래울 배드민턴장' in cards, cards[:120])
    check('D 소속 → 지도 칩', has(page, '.coachcard__gyms [data-gym-open]'),
          page.evaluate("() => Array.from(document.querySelectorAll('.coachcard__gyms [data-gym-open]')).map(b => b.getAttribute('data-gym-open')).join(',')"))
    page.screenshot(path=OUT + '/v147_09_코치카드_지도칩.png')
    page.click('.coachcard__gyms [data-gym-open="naraeul"]')
    page.wait_for_timeout(1600)
    check('D 탭 한 번에 체육관 지도', has(page, '#gympage'))
    focus = text_of(page, '#gympage [data-gym-focuscard]') if has(page, '#gympage [data-gym-focuscard]') else text_of(page, '#gympage')
    check('D 지도가 나래울 배드민턴장으로', '나래울 배드민턴장' in focus, focus[:140])
    page.screenshot(path=OUT + '/v147_10_지도_나래울.png')
    page.evaluate("() => { const c = document.querySelector('[data-gym-close]'); if (c) c.click(); }")
    page.wait_for_timeout(900)

    check('콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('CSP 위반 0건', len(csp) == 0, csp[:2])
    check('가로 넘침 없음', page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"),
          page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]"))
    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if ok != len(checks):
    for label, c in checks:
        if not c:
            print('  FAIL ' + label)
    raise SystemExit(1)
