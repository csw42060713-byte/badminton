"""bm-v1.43.0 라이브 점검 — 게스트 신청 편지지 · 수락/거절 · 마감 숨김 · 방 나가기.

· 배포본(https://csw42060713-byte.github.io/badminton/)을 390×844 로 열어 확인합니다.
· 로그인 없이 체험(기기 저장) 모드로만 움직입니다 → Supabase에 아무것도 쓰지 않습니다.
  상대 역할(신청·수락·나가기)의 행은 기기 저장소(bm_rows_v1)에 넣어 '서버에서 도착한 것'처럼 재현합니다.
· 실행: LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/live-v143.py
"""
import time
from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


INJECT = """
(spec) => {
  const D = window.BM.domain, U = window.BM.util;
  const key = 'bm_rows_v1';
  const rows = JSON.parse(localStorage.getItem(key) || '[]');
  const row = D.toRow(spec.row);
  rows.push(row);
  localStorage.setItem(key, JSON.stringify(rows));
  return row[0];
}
"""


def inject(page, spec):
    return page.evaluate(INJECT, {'row': spec})


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    page = ctx.new_page()

    def on_console(m):
        if m.type != 'error':
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
    page.wait_for_timeout(2600)
    if page.query_selector('[data-act="guest"]'):
        page.click('[data-act="guest"]')
        page.wait_for_timeout(2200)
    for _ in range(5):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(250)

    # ── 배포 버전
    check('라이브 앱 v1.43.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.43.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    check('라이브 sw.js bm-v1.43.0', 'bm-v1.43.0' in page.evaluate(
        "async () => (await fetch('sw.js?x=' + Date.now())).text()"))
    check('라이브 index.html CSP 유지', 'Content-Security-Policy' in page.evaluate(
        "async () => (await fetch('index.html?x=' + Date.now())).text()"))

    # ── 1. 글쓴이(demo_me): 모집 글 올리기 (정원 2명)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(350)
    page.fill('[data-composer]', '토요일 저녁 게스트 1명 모집합니다')
    page.fill('[data-vitefield="when"]', '11/22(토) 19:00')
    page.fill('[data-vitefield="place"]', '영통 체육관')
    page.fill('[data-vitefield="cap"]', '2')
    page.click('[data-act="post"]')
    page.wait_for_timeout(1100)
    post_id = page.evaluate("() => { const el = document.querySelector('[data-post] .vite'); const p = el ? el.closest('[data-post]') : null; return p ? p.getAttribute('data-post') : ''; }")
    check('라이브: 모집 글 올림', bool(post_id), post_id)
    check('라이브: 글쓴이 카드에 단체방 열기', page.evaluate(
        "(id) => !!document.querySelector('[data-vite-group=\"' + id + '\"][data-vite-go=\"room\"]')", post_id))
    page.screenshot(path=OUT + '/v143l_01_owner_post.png')

    # ── 2. 신청 편지지 도착 → 목록에 표시 → 수락
    inject(page, {
        'id': 'live-guest-apply', 'type': '게스트신청', 'createdAt': page.evaluate("() => window.BM.util.stamp()"),
        'date': page.evaluate("() => window.BM.util.ymd()"), 'nick': '라이브신청자',
        'userKey': 'u_live_guest', 'target': page.evaluate("() => window.BM.app.ctx.store.state.me.key"),
        'team': post_id,
        'payload': {'kind': '신청', 'note': '토요일 7시에 갈 수 있어요!', 'nick': '라이브신청자', 'level': 'C조', 'style': '수비형'}
    })
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click('#hdrChat')
    page.wait_for_timeout(900)
    dm = text_of(page, '#dm')
    check('라이브: 받은 게스트 신청 편지지', '받은 게스트 신청' in dm, dm[:160])
    check('라이브: 편지지 내용(닉네임·급수·한마디)', ('라이브신청자' in dm) and ('C조' in dm) and ('토요일 7시에 갈 수 있어요' in dm))
    page.screenshot(path=OUT + '/v143l_02_owner_inbox.png')
    page.click('[data-guest-accept]')
    page.wait_for_timeout(1300)
    check('라이브: 수락하면 단체방이 열림', page.evaluate("() => !!document.querySelector('.dm__meetbar')"),
          page.evaluate("() => window.BM.app.ctx.store.state.ui.chatRoom"))
    check('라이브: 현황 참여 2/2명', '참여 2/2명' in text_of(page, '.dm__meetbar'), text_of(page, '.dm__meetbar'))
    check('라이브: 글쓴이 모집 종료 버튼', page.evaluate("() => !!document.querySelector('[data-vite-end]')"))
    page.screenshot(path=OUT + '/v143l_03_owner_room_closed.png')
    page.click('[data-dm-back]')
    page.wait_for_timeout(500)
    check('라이브: 단체방이 대화 목록에 남음', '게스트 모집 단체방' in text_of(page, '#dm'))
    page.click('[data-dm-close]')
    page.wait_for_timeout(500)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    check('라이브: 마감된 글은 피드에서 내려감', page.evaluate("() => document.querySelectorAll('[data-post] .vite').length") == 0)
    check('라이브: 내려간 이유 안내', '모집 중인 글이 없어요' in text_of(page, '#main'), text_of(page, '#main')[:160])
    page.screenshot(path=OUT + '/v143l_04_feed_hidden.png')

    # ── 3. 게스트가 나가면 자리가 나서 다시 올라옴
    inject(page, {
        'id': 'live-guest-leave', 'type': '게스트신청', 'createdAt': page.evaluate("() => window.BM.util.stamp()"),
        'date': page.evaluate("() => window.BM.util.ymd()"), 'nick': '라이브신청자',
        'userKey': 'u_live_guest', 'target': page.evaluate("() => window.BM.app.ctx.store.state.me.key"),
        'team': post_id, 'payload': {'kind': '나가기', 'nick': '라이브신청자'}
    })
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    check('라이브: 나가면 글이 다시 올라옴', page.evaluate("() => document.querySelectorAll('[data-post] .vite').length") >= 1)
    cap_txt = text_of(page, '[data-post="%s"] .vite__row--cap' % post_id)
    check('라이브: 인원이 줄어 보임(참여자 1명)', '참여자 1명' in cap_txt, cap_txt)
    page.screenshot(path=OUT + '/v143l_05_reopened.png')

    # ── 4. 거절 흐름
    inject(page, {
        'id': 'live-guest-apply2', 'type': '게스트신청', 'createdAt': page.evaluate("() => window.BM.util.stamp()"),
        'date': page.evaluate("() => window.BM.util.ymd()"), 'nick': '두번째신청자',
        'userKey': 'u_live_guest2', 'target': page.evaluate("() => window.BM.app.ctx.store.state.me.key"),
        'team': post_id,
        'payload': {'kind': '신청', 'note': '저도 껴 주세요', 'nick': '두번째신청자', 'level': 'D조', 'style': '공격형'}
    })
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click('#hdrChat')
    page.wait_for_timeout(900)
    check('라이브: 두 번째 신청 도착', '두번째신청자' in text_of(page, '#dm'))
    page.click('[data-guest-reject]')
    page.wait_for_timeout(1000)
    check('라이브: 거절하면 신청이 사라짐', '두번째신청자' not in text_of(page, '#dm'))
    page.click('[data-dm-close]')
    page.wait_for_timeout(500)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    cap_txt = text_of(page, '[data-post="%s"] .vite__row--cap' % post_id)
    check('라이브: 거절해도 글이 그대로(참여자 1명)', '참여자 1명' in cap_txt, cap_txt)
    page.screenshot(path=OUT + '/v143l_06_rejected.png')

    # ── 5. 게스트 시점 — 남의 글에 참여 신청 → 수락 → 나가기
    inject(page, {
        'id': 'live-owner-post', 'type': '소셜', 'createdAt': page.evaluate("() => window.BM.util.stamp()"),
        'date': page.evaluate("() => window.BM.util.ymd()"), 'nick': '라이브모집왕',
        'userKey': 'u_live_owner', 'text': '일요일 아침 게스트 모집해요',
        'plan': {'topic': '게스트 모집', 'meet': {'when': '11/23(일) 08:00', 'place': '영통 체육관', 'cap': '3'}}
    })
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    check('라이브: 남의 글에 참여 신청 버튼', page.evaluate(
        "() => !!document.querySelector('[data-vite-group=\"live-owner-post\"][data-vite-go=\"apply\"]')"))
    page.click('[data-vite-group="live-owner-post"][data-vite-go="apply"]')
    page.wait_for_timeout(700)
    check('라이브: 신청 시트', '참여 신청' in text_of(page, '#sheet'))
    page.fill('[data-guest-note]', '일요일 아침 좋아요!')
    page.screenshot(path=OUT + '/v143l_07_apply_sheet.png')
    page.click('[data-guest-send]')
    page.wait_for_timeout(1000)
    check('라이브: 신청 뒤 신청 대기 중', '신청 대기 중' in text_of(page, '[data-vite-go="pending"]'), text_of(page, '[data-vite-go="pending"]'))
    page.screenshot(path=OUT + '/v143l_08_pending.png')
    # 글쓴이의 수락이 도착한 것처럼
    inject(page, {
        'id': 'live-owner-accept', 'type': '게스트신청', 'createdAt': page.evaluate("() => window.BM.util.stamp()"),
        'date': page.evaluate("() => window.BM.util.ymd()"), 'nick': '라이브모집왕',
        'userKey': 'u_live_owner', 'target': page.evaluate("() => window.BM.app.ctx.store.state.me.key"),
        'team': 'live-owner-post', 'payload': {'kind': '수락', 'nick': '라이브모집왕'}
    })
    page.reload(wait_until='load')
    page.wait_for_timeout(2400)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    room_btn = page.evaluate("() => { const b=document.querySelector('[data-vite-group=\"live-owner-post\"][data-vite-go=\"room\"]'); return b ? b.innerText : ''; }")
    check('라이브: 수락되면 단체방 열기', '단체방 열기' in room_btn, room_btn)
    page.click('[data-vite-group="live-owner-post"][data-vite-go="room"]')
    page.wait_for_timeout(900)
    check('라이브: 게스트 단체방 열림', page.evaluate("() => { const d=document.querySelector('#dm'); return d ? d.innerText.indexOf('게스트 모집 단체방') >= 0 : false; }"))
    check('라이브: 게스트에게 나가기', page.evaluate("() => !!document.querySelector('[data-vite-leave]')"))
    page.fill('[data-dm-input]', '잘 부탁드립니다!')
    page.click('[data-dm-form] .btn--send')
    page.wait_for_timeout(800)
    page.screenshot(path=OUT + '/v143l_09_guest_room.png')
    page.click('[data-vite-leave]')
    page.wait_for_timeout(500)
    check('라이브: 나가기 확인 바', '나갈까요' in text_of(page, '[data-leavebar]'), text_of(page, '[data-leavebar]')[:140])
    page.click('[data-act="leave-yes"]')
    page.wait_for_timeout(1000)
    check('라이브: 나가면 방이 목록에서 사라짐', '게스트 모집 단체방' not in text_of(page, '#dm'), text_of(page, '#dm')[:140])
    if page.query_selector('#dm [data-dm-close]'):
        page.click('#dm [data-dm-close]')
        page.wait_for_timeout(500)
    page.click('[data-tab="community"]')
    page.wait_for_timeout(900)
    check('라이브: 나간 뒤 다시 참여 신청 가능', page.evaluate(
        "() => !!document.querySelector('[data-vite-group=\"live-owner-post\"][data-vite-go=\"apply\"]')"))
    page.screenshot(path=OUT + '/v143l_10_left.png')

    # ── 6. 회귀 — 5개 탭 · 지도(v1.42.0) · 가로 넘침
    for tab, name in [('log', '일지 & AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(800)
        overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check('라이브 %s 탭: 가로 넘침 없음' % name, overflow <= 0, overflow)
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(800)
    check('라이브: 체육관 지도 입구(v1.42.0)', page.evaluate("() => !!document.querySelector('[data-act=\"open-gym-map\"]')"))
    page.click('[data-act="open-gym-map"]')
    page.wait_for_timeout(1600)
    check('라이브: 지도에 체육관 표시', page.evaluate("() => document.querySelectorAll('.gympin, .gymcard, .gymitem').length") >= 3,
          page.evaluate("() => document.querySelectorAll('.gympin, .gymcard, .gymitem').length"))
    page.screenshot(path=OUT + '/v143l_11_map.png')

    check('라이브: 앱 콘솔·페이지 오류 0건', len(errs) == 0, errs[:3])
    check('라이브: CSP 위반 0건', len(csp) == 0, csp[:2])

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    print('실패:', fails)
