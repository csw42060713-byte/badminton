"""bm-v1.45.0 로컬(390×844) 점검 — 개인 멘토 · 체육관/선수 코치 소속 증명.

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·타일 요청은 막습니다).
· 진짜 앱(index.html)을 체험(local) 모드로 열어 실제 버튼을 눌러 확인합니다.
  A) 코치 지망생 계정 — 멘토 신청(유형 칩 · 소속 검증 · 체육관 추천 · 증빙 링크/사진)
  B) 관리자 계정 — 멘토 심사 카드 · 조건 자세히 보기 · 수락
  C) 팬 계정 — 승인된 코치 카드에 'OO체육관 · 활동 증명됨'
· 실행:
  (저장소 루트에서) python3 -m http.server 8814 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/usr/lib/x86_64-linux-gnu:/workspace/tmp/deblibs2/lib/x86_64-linux-gnu python3 test/local-v145.py
"""

import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8814/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
CERT = OUT + '/v145_proof_cert.jpg'
checks, errs, csp, blocked = [], [], [], []

APPLICANT = 'coach145@example.com'
ADMIN = 'csw42060713@gmail.com'
FAN = 'fan145@example.com'


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def toast(page):
    return text_of(page, '#toast')


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
        """로컬(체험) 저장소 + 이메일 계정으로 앱에 들어갑니다 (온보딩은 건너뜀)."""
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
        return page.evaluate("() => (BM.store && BM.store.state && BM.store.state.me && BM.store.state.me.key) || ''")

    def rows_json():
        key = page.evaluate("() => BM.auth.rowsKeyFor(BM.auth.session())")
        return key, page.evaluate("(k) => localStorage.getItem(k) || '[]'", key)

    # ── A. 코치 지망생: 멘토 신청
    me_key = login(APPLICANT, '코치지망생')
    check('A 앱 진입(일지 & AI)', page.evaluate("() => !!document.querySelector('[data-act=\"open-scoreboard\"]')"), me_key)

    page.click('[data-tab="coach"]')
    page.wait_for_timeout(700)
    page.click('[data-coachtab="apply"]')
    page.wait_for_timeout(500)
    check('A 멘토 신청 화면', has(page, '[data-mentor-form]'))
    chips = page.evaluate("() => Array.from(document.querySelectorAll('[data-mtype]')).map(b => b.textContent.trim())")
    check('A 활동 유형 4칸', chips == ['개인 멘토', '체육관 코치', '선수 코치', '클럽 운영'], chips)
    check('A 기본은 개인 멘토', page.evaluate("() => { const b = document.querySelector('[data-mtype].is-on'); return b && b.getAttribute('data-mtype'); }") == '개인 멘토')
    check('A 소속 칸', has(page, '[data-mentor-field="affiliation"]'))
    check('A 증빙 링크·메모 칸', has(page, '[data-mentor-field="proofUrl"]') and has(page, '[data-mentor-field="proof"]'))
    check('A 증빙 사진 버튼', has(page, '[data-act="mentor-photo"]'))
    check('A 체육관 목록 입구', has(page, '[data-act="mentor-gym"]'))
    check('A 처음엔 소속·증명이 선택', '선택' in text_of(page, '[data-req-badge]'))
    page.screenshot(path=OUT + '/v145_01_form_개인멘토.png')

    # 유형을 체육관 코치로 → 필수 표시와 안내가 바뀐다
    page.click('[data-mtype="체육관 코치"]')
    page.wait_for_timeout(250)
    badges = page.evaluate("() => Array.from(document.querySelectorAll('[data-req-badge]')).map(b => b.textContent.trim())")
    check('A 체육관 코치 → 소속·증명 필수', badges == ['필수', '필수'], badges)
    check('A 유형 안내 문구', '활동 증명됨' in text_of(page, '[data-mtype-hint]'), text_of(page, '[data-mtype-hint]')[:60])
    page.screenshot(path=OUT + '/v145_02_체육관코치_필수.png')

    # 소속 비운 채로 보내기 → 접수되지 않고 안내
    page.fill('[data-mentor-field="reason"]', '평일 저녁 성인반과 주말 주니어반을 봅니다.')
    page.click('[data-act="apply-mentor"]')
    page.wait_for_timeout(400)
    check('A 소속 없이 신청 → 안내', '소속 체육관·팀을 먼저 적어 주세요' in toast(page), toast(page))
    check('A 소속 없이는 접수 안 됨', has(page, '[data-mentor-form]'))

    # 체육관 이름을 치면 추천이 뜨고, 누르면 채워진다
    page.fill('[data-mentor-field="affiliation"]', '나래')
    page.wait_for_timeout(300)
    sug = page.evaluate("() => Array.from(document.querySelectorAll('[data-aff-pick]')).map(b => b.getAttribute('data-aff-pick'))")
    check('A 체육관 추천이 뜬다', len(sug) >= 1, sug)
    page.screenshot(path=OUT + '/v145_03_체육관추천.png')
    if sug:
        page.click('[data-aff-pick]')
        page.wait_for_timeout(250)
    aff_val = page.evaluate("() => document.querySelector('[data-mentor-field=\"affiliation\"]').value")
    check('A 추천을 누르면 소속 칸이 채워진다', len(aff_val) >= 2, aff_val)

    # 체육관 목록(지도)에서 고르기 입구도 열린다
    page.click('[data-act="mentor-gym"]')
    page.wait_for_timeout(1200)
    check('A 체육관 목록이 열린다', has(page, '#gympage'))
    page.evaluate("() => { const c = document.querySelector('[data-gym-close]'); if (c) c.click(); }")
    page.wait_for_timeout(900)
    # 체육관 목록을 다녀와도 적던 값(유형·소속·사유)이 남아 있어야 합니다
    kept = page.evaluate("""() => {
      const q = (s) => { const n = document.querySelector(s); return n ? n.value : ''; };
      const chip = document.querySelector('[data-mtype].is-on');
      return { type: chip ? chip.getAttribute('data-mtype') : '', aff: q('[data-mentor-field="affiliation"]'),
               reason: q('[data-mentor-field="reason"]') };
    }""")
    check('A 체육관 목록을 다녀와도 적던 값이 남는다',
          kept['type'] == '체육관 코치' and kept['aff'] != '' and '성인반' in kept['reason'], kept)

    # 증빙: 링크 + 사진
    page.fill('[data-mentor-field="proofUrl"]', 'https://gym.example.com/notice/145')
    page.fill('[data-mentor-field="proof"]', '위촉 2026-03 · 사무실 031-000-0000')
    page.click('[data-act="mentor-photo"]')
    page.wait_for_timeout(500)
    if has(page, 'input[type=file]'):
        page.set_input_files('input[type=file]', CERT)
        page.wait_for_timeout(1600)
    has_thumb = has(page, '[data-proof-photo] img')
    check('A 증빙 사진 미리보기', has_thumb)
    src_len = page.evaluate("() => { const i = document.querySelector('[data-proof-photo] img'); return i ? i.getAttribute('src').length : 0; }")
    check('A 사진은 압축된 data:image (48,000자 이하)', 0 < src_len <= 48000, src_len)
    check('A 사진 src 는 data:image', page.evaluate("() => { const i = document.querySelector('[data-proof-photo] img'); return i ? i.getAttribute('src').slice(0, 22) : ''; }").startswith('data:image/'))
    page.screenshot(path=OUT + '/v145_04_증빙첨부.png')

    page.fill('[data-mentor-field="experience"]', '6년 · 성인반 3년')
    page.fill('[data-mentor-field="awards"]', '생활체육지도자 2급')
    page.click('[data-act="apply-mentor"]')
    page.wait_for_timeout(1200)
    status = text_of(page, '.card--mentor')
    check('A 신청 접수 → 내 멘토 신청 카드', '내 멘토 신청' in status)
    check('A 심사중 표시', '심사중' in status)
    check('A 카드에 구분·소속·증명', '체육관 코치' in status and aff_val[:2] in status and '사진 첨부' in status, status[:160])
    check('A 카드에 증빙 링크', '증빙 링크' in status)
    check('A 카드에 증빙 사진', has(page, '.card--mentor .proofshot img'))
    page.screenshot(path=OUT + '/v145_05_신청완료.png')

    _, applicant_rows = rows_json()

    # ── B. 관리자: 심사
    login(ADMIN, '승우', rows=applicant_rows)
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(900)
    check('B 관리자 멘토 심사 탭', has(page, '[data-coachtab="approve"]'))
    page.click('[data-coachtab="approve"]')
    page.wait_for_timeout(600)
    admin = text_of(page, '.applist')
    check('B 심사 카드에 신청자', '코치지망생' in admin, admin[:120])
    check('B 심사 카드에 구분', '체육관 코치' in admin)
    check('B 심사 카드에 소속', aff_val[:2] in admin)
    check('B 심사 카드에 증빙 링크', '증빙 링크' in admin)
    check('B 심사 카드에 증빙 사진', '사진 첨부' in admin and has(page, '.applist .proofshot img'))
    page.screenshot(path=OUT + '/v145_06_관리자_심사카드.png')

    page.click('[data-mentor-open]')
    page.wait_for_timeout(700)
    sheet = text_of(page, '#sheet')
    check('B 조건 자세히 보기 시트', has(page, '#sheet'))
    check('B 시트에 유형·소속·증명', '활동 유형' in sheet and '활동 소속' in sheet and aff_val[:2] in sheet)
    check('B 시트에 증빙 사진', has(page, '#sheet .proofshot img'))
    page.screenshot(path=OUT + '/v145_07_조건자세히보기.png')

    page.click('#sheet [data-sheet-decide="승인"]')
    page.wait_for_timeout(500)
    check('B 수락 확인 시트', has(page, '#sheet [data-act="yes"]'))
    page.click('#sheet [data-act="yes"]')
    page.wait_for_timeout(900)
    done = text_of(page, '.applist')
    check('B 승인 처리됨', '승인' in done and '처리' in done, done[:120])
    admin_key, approved_rows = rows_json()

    # ── C. 팬 계정: 승인된 코치 카드에 소속·활동 증명됨
    login(FAN, '팬', rows=approved_rows)
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(900)
    cards = text_of(page, '.coachcards') if has(page, '.coachcards') else text_of(page, '[data-view]')
    check('C 코치 카드에 구분 배지', '체육관 코치' in cards, cards[:160])
    check('C 코치 카드에 소속 · 활동 증명됨', (aff_val + ' · 활동 증명됨') in cards, cards[:300])
    page.screenshot(path=OUT + '/v145_08_코치카드_증명됨.png')

    # ── D. 나가기: 신청자 시점에서도 승인 표시(같은 데이터를 신청자 저장소에도)
    login(APPLICANT, '코치지망생', rows=approved_rows)
    page.click('[data-tab="coach"]')
    page.wait_for_timeout(900)
    page.click('[data-coachtab="apply"]')
    page.wait_for_timeout(500)
    mine = text_of(page, '.card--mentor')
    check('D 내 멘토 신청 — 승인', '승인' in mine, mine[:160])
    check('D 내 멘토 신청 — 소속 · 활동 증명됨', (aff_val + ' · 활동 증명됨') in mine, mine[:300])
    page.screenshot(path=OUT + '/v145_09_내멘토_승인.png')

    # ── E. MY: 승인된 코치는 유형 배지와 소속·증명 줄
    page.click('[data-tab="my"]')
    page.wait_for_timeout(900)
    my = text_of(page, '[data-view]')
    check('E MY 에 구분 배지', '체육관 코치' in my, my[:120])
    check('E MY 에 소속 · 활동 증명됨', (aff_val + ' · 활동 증명됨') in my)
    check('E MY 소속 줄 스타일', has(page, '.profile__coachline'))
    page.screenshot(path=OUT + '/v145_10_MY_코치배지.png')

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
