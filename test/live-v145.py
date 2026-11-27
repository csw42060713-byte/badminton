"""bm-v1.45.0 라이브 점검 — 개인 멘토 · 체육관/선수 코치 소속 증명.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
· 실행: LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/live-v145.py
"""
import time
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
CERT = OUT + '/v145_proof_cert.jpg'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
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

    cb = str(int(time.time()))
    page.goto(BASE + 'index.html?l=' + cb, wait_until='load')
    page.wait_for_timeout(2500)
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2400)
    for _ in range(5):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(250)
    if page.query_selector('[data-pick="role"]'):
        page.click('[data-pick="role"][data-val="player"]')
        page.fill('#onbNick', '라이브선수')
        page.wait_for_timeout(150)
        page.click('[data-pick="level"][data-val="C조"]')
        page.click('[data-pick="discipline"][data-val="복식"]')
        page.click('[data-act="finish"]')
        page.wait_for_timeout(2400)

    # ── 배포 버전
    check('라이브 앱 v1.45.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.45.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    sw = page.evaluate("""async () => {
      const r = await fetch('sw.js?x=' + Date.now(), { cache: 'no-store' });
      const t = await r.text();
      const m = t.match(/var VERSION = '([^']+)'/);
      return m ? m[1] : '';
    }""")
    check('라이브 sw.js bm-v1.45.0', sw == 'bm-v1.45.0', sw)
    css = page.evaluate("() => { const l = document.querySelector('link[rel=stylesheet]'); return l ? l.getAttribute('href') : ''; }")
    check('라이브 styles.css?v=20261121-57', '20261121-57' in css, css)
    coach_src = page.evaluate("""async () => {
      const r = await fetch('js/views/coach.js?x=' + Date.now(), { cache: 'no-store' });
      const t = await r.text();
      return t.indexOf('MENTOR_TYPES') >= 0 && t.indexOf('mentor-gym') >= 0;
    }""")
    check('라이브 coach.js 에 새 신청서', coach_src)

    # ── 멘토 신청서
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(800)
    page.click('[data-coachtab="apply"]')
    page.wait_for_timeout(600)
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-mtype]')).map(b => b.textContent.trim())")
    check('라이브 활동 유형 4칸', chips == ['개인 멘토', '체육관 코치', '선수 코치', '클럽 운영'], chips)
    check('라이브 소속·증빙 칸', has(page, '[data-mentor-field="affiliation"]') and has(page, '[data-mentor-field="proofUrl"]') and has(page, '[data-act="mentor-photo"]'))

    page.click('[data-mtype="선수 코치"]')
    page.wait_for_timeout(250)
    badges = page.evaluate("() => Array.from(document.querySelectorAll('[data-req-badge]')).map(b => b.textContent.trim())")
    check('라이브 선수 코치 → 필수', badges == ['필수', '필수'], badges)
    page.fill('[data-mentor-field="reason"]', '학교 배드민턴부 주니어반을 맡고 있습니다.')
    page.click('[data-act="apply-mentor"]')
    page.wait_for_timeout(400)
    check('라이브 소속 없이 신청 → 안내', '소속 체육관·팀을 먼저 적어 주세요' in text_of(page, '#toast'), text_of(page, '#toast'))

    page.fill('[data-mentor-field="affiliation"]', '매원')
    page.wait_for_timeout(350)
    sug = page.evaluate("() => Array.from(document.querySelectorAll('[data-aff-pick]')).map(b => b.getAttribute('data-aff-pick'))")
    check('라이브 체육관 추천', len(sug) >= 1, sug)
    if sug:
        page.click('[data-aff-pick]')
        page.wait_for_timeout(250)
    aff = page.evaluate("() => document.querySelector('[data-mentor-field=\"affiliation\"]').value")
    check('라이브 소속 채워짐', len(aff) >= 2, aff)

    page.fill('[data-mentor-field="proofUrl"]', 'https://gym.example.com/team/notice')
    page.click('[data-act="mentor-photo"]')
    page.wait_for_timeout(500)
    if has(page, 'input[type=file]'):
        page.set_input_files('input[type=file]', CERT)
        page.wait_for_timeout(1600)
    src_len = page.evaluate("() => { const i = document.querySelector('[data-proof-photo] img'); return i ? i.getAttribute('src').length : 0; }")
    check('라이브 증빙 사진 첨부·압축', 0 < src_len <= 48000, src_len)
    page.click('[data-act="apply-mentor"]')
    page.wait_for_timeout(1400)
    mine = text_of(page, '.card--mentor')
    check('라이브 신청 접수', '내 멘토 신청' in mine and '심사중' in mine, mine[:120])
    check('라이브 카드에 유형·소속·증명', '선수 코치' in mine and aff[:2] in mine and '사진 첨부' in mine)
    check('라이브 카드에 증빙 사진', has(page, '.card--mentor .proofshot img'))
    page.screenshot(path=OUT + '/v145l_01_신청완료.png')

    # ── 승인된 코치 카드 표시 (체험 모드 기기 저장에만 심사 결과를 넣어 확인)
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util;
      const rows = U.readJSON('bm_rows_v1', []) || [];
      rows.push(D.toRow({
        id: 'live-145-approved', type: '멘토신청', createdAt: U.stamp(), date: U.ymd(),
        nick: '코트코치', userKey: 'demo_net', target: D.ADMIN_TARGET, status: '승인',
        payload: { type: '체육관 코치', affiliation: '나래울 배드민턴장', proof: '재직 확인',
                   reason: '성인반 코치', status: '승인', submitted: U.stamp(), level: 'B조', discipline: '복식' }
      }));
      U.writeJSON('bm_rows_v1', rows);
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(900)
    cards = text_of(page, '.coachcards') if has(page, '.coachcards') else ''
    check('라이브 코치 카드 유형 배지', '체육관 코치' in cards, cards[:120])
    check('라이브 코치 카드 소속·활동 증명됨', '나래울 배드민턴장 · 활동 증명됨' in cards, cards[:200])
    page.screenshot(path=OUT + '/v145l_02_코치카드.png')

    # ── 5개 탭 회귀
    for tab, name in [('log', '일지'), ('matching', '매칭'), ('community', '커뮤니티'), ('my', 'MY')]:
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(700)
        check('라이브 %s 탭' % name, has(page, '[data-view]'))

    check('라이브 가로 넘침 없음', page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"),
          page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]"))
    check('라이브 콘솔 오류 0건', len(errs) == 0, errs[:2])
    check('라이브 CSP 위반 0건', len(csp) == 0, csp[:2])
    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if ok != len(checks):
    for label, c in checks:
        if not c:
            print('  FAIL ' + label)
    raise SystemExit(1)
