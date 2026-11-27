"""bm-v1.43.0 이 기기 저장(local) 점검 — 게스트 신청 수락/거절 · 마감 숨김 · 방 나가기.

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글 요청은 막습니다).
· 흐름(두 역할): test/v143-preview.html 을 ?me=owner / ?me=guest 로 열어 **실제 화면 버튼**을
  눌러 신청 → 수락 → 마감 숨김 → 단체방 유지 → 나가기 → 다시 노출 → 거절을 확인합니다.
  (미리보기 페이지도 앱과 같은 js/views/* · js/store.js 코드를 그대로 씁니다)
· 회귀: 진짜 앱(index.html)을 체험 모드로 열어 5개 탭 · 지도(v1.42.0) · CSP · 오류 0건을 봅니다.
· 실행:
  (저장소 루트에서) python3 -m http.server 8813 --bind 127.0.0.1 &
  LD_LIBRARY_PATH=/workspace/tmp/deblibs/usr/lib/x86_64-linux-gnu python3 test/local-v143.py
"""

import time
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8813/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''))
    checks.append((label, bool(cond)))


def open_role(page, role):
    page.goto(BASE + 'test/v143-preview.html?me=' + role + '&t=' + str(int(time.time() * 1000)),
              wait_until='load')
    page.wait_for_timeout(900)


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def close_chat(page):
    """방 → 목록(뒤로) → 패널 닫기(X). 앱과 같은 두 단계입니다."""
    if page.query_selector('[data-dm-back]'):
        page.click('[data-dm-back]')
        page.wait_for_timeout(350)
    if page.query_selector('[data-dm-close]'):
        page.click('[data-dm-close]')
        page.wait_for_timeout(350)


def rows_of(page):
    return page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1') || '[]')")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url)
              else route.continue_())
    page = ctx.new_page()
    def on_console(m):
        if m.type != 'error':
            if 'Content Security Policy' in m.text:
                csp.append(m.text[:300])
            return
        # 구글 로그인·Supabase 요청은 이 점검에서 일부러 막습니다(외부 통신 없이 앱만 보기)
        if 'net::ERR_FAILED' in m.text or 'net::ERR_ABORTED' in m.text:
            blocked.append(m.text[:300])
        else:
            errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))
    page.on('requestfailed', lambda r: errs.append('requestfailed: ' + r.url[:160])
            if 'google' not in r.url and 'supabase.co' not in r.url else None)

    # 준비 — 저장소 비우고 두 역할 미리보기 페이지로 시작
    page.goto(BASE + 'test/v143-preview.html', wait_until='load')
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")

    # ── 1. 글쓴이: 모집 글 올리기 (정원 2명)
    open_role(page, 'owner')
    check('미리보기 진입(글쓴이)', page.evaluate("() => !!(window.V143 && window.V143.store.state.ready)"),
          page.evaluate("() => window.V143 && window.V143.store.state.me && window.V143.store.state.me.key"))
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(300)
    page.fill('[data-composer]', '토요일 저녁 게스트 1명 모집합니다')
    page.fill('[data-vitefield="when"]', '11/22(토) 19:00')
    page.fill('[data-vitefield="place"]', '영통 체육관')
    page.fill('[data-vitefield="cap"]', '2')
    page.click('[data-act="post"]')
    page.wait_for_timeout(700)
    eq_ok = page.evaluate("() => document.querySelectorAll('[data-post] .vite').length") >= 1
    check('모집 글 올림', eq_ok)
    check('글쓴이 카드: 단체방 열기', page.evaluate("() => !!document.querySelector('[data-vite-go=\"room\"]')"))
    check('글쓴이 카드: 참여자 1명', '참여자 1명' in (text_of(page, '.vite__row--cap')), text_of(page, '.vite__row--cap'))
    page.screenshot(path=OUT + '/v143_01_owner_post.png')

    # ── 2. 게스트: 참여 신청 편지지
    open_role(page, 'guest')
    check('게스트 화면에 참여 신청 버튼', page.evaluate("() => !!document.querySelector('[data-vite-go=\"apply\"]')"),
          text_of(page, '.vite__btn'))
    page.screenshot(path=OUT + '/v143_02_guest_apply.png')
    page.click('[data-vite-go="apply"]')
    page.wait_for_timeout(500)
    check('신청 시트 열림', '참여 신청' in text_of(page, '#sheet'))
    check('한마디 기본 문구 채워짐', page.evaluate("() => { const i=document.querySelector('[data-guest-note]'); return i ? i.value.length > 0 : false; }"),
          page.evaluate("() => { const i=document.querySelector('[data-guest-note]'); return i ? i.value : ''; }"))
    check('80자 상한', page.evaluate("() => { const i=document.querySelector('[data-guest-note]'); return i ? i.maxLength : 0; }") in (80, '80'))
    page.fill('[data-guest-note]', '토요일 7시에 갈 수 있어요!')
    page.screenshot(path=OUT + '/v143_03_apply_sheet.png')
    page.click('[data-guest-send]')
    page.wait_for_timeout(700)
    check('신청하면 신청 대기 중', '신청 대기 중' in text_of(page, '[data-vite-go="pending"]'), text_of(page, '[data-vite-go="pending"]'))
    check('대기 버튼은 눌리지 않음', page.evaluate("() => { const b=document.querySelector('[data-vite-go=\"pending\"]'); return b ? b.disabled === true : false; }"))
    check('게스트신청 행 1건 저장', page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1')).filter(r => r[1] === '게스트신청').length") == 1)
    check('게스트 대화 목록에는 아직 방 없음', page.evaluate("() => window.V143.store.state.data.threads.filter(t => t.kind === 'group').length") == 0)
    page.screenshot(path=OUT + '/v143_04_guest_pending.png')

    # ── 3. 글쓴이: 받은 게스트 신청 편지지 → 수락
    open_role(page, 'owner')
    page.click('#hdrChat')
    page.wait_for_timeout(600)
    dm = text_of(page, '#dm')
    check('받은 게스트 신청 편지지', '받은 게스트 신청' in dm)
    check('편지지: 닉네임·급수·스타일·한마디', ('신청자' in dm) and ('C조' in dm) and ('수비형' in dm) and ('토요일 7시에 갈 수 있어요' in dm), dm[:200])
    check('편지지: 수락/거절 버튼', page.evaluate("() => !!(document.querySelector('[data-guest-accept]') && document.querySelector('[data-guest-reject]'))"))
    page.screenshot(path=OUT + '/v143_05_owner_inbox.png')
    page.click('[data-guest-accept]')
    page.wait_for_timeout(900)
    rows = rows_of(page)
    check('수락 행 저장', page.evaluate("() => { const c = window.BM.domain.COL['소셜글']; return JSON.parse(localStorage.getItem('bm_rows_v1')).some(r => r[1] === '게스트신청' && String(r[c] || '').indexOf('수락') >= 0); }"))
    check('수락하면 받은 신청이 사라짐', '받은 게스트 신청' not in text_of(page, '#dm'))
    check('수락하면 단체방이 대화 목록에 생김', '게스트 모집 단체방' in text_of(page, '#dm'), text_of(page, '#dm')[:160])
    # 수락하면 그 글의 단체방이 바로 열립니다 (매칭 수락과 같은 흐름)
    page.wait_for_timeout(600)
    check('수락하면 단체방이 열림', page.evaluate("() => window.V143.store.state.ui.chatRoom === 'post-' + '' || !!document.querySelector('.dm__meetbar')"),
          page.evaluate("() => window.V143.store.state.ui.chatRoom"))
    page.screenshot(path=OUT + '/v143_06_owner_accepted.png')
    bar = text_of(page, '.dm__meetbar')
    check('단체방 현황: 참여 2/2명', '참여 2/2명' in bar, bar)
    check('글쓴이에게는 모집 종료', page.evaluate("() => !!document.querySelector('[data-vite-end]')"))
    check('글쓴이에게는 나가기 없음', page.evaluate("() => !document.querySelector('[data-vite-leave]')"))
    page.fill('[data-dm-input]', '환영합니다! 19시에 봐요')
    page.click('[data-dm-form] .btn--send')
    page.wait_for_timeout(600)
    check('단체방 메시지 전송', page.evaluate("() => JSON.parse(localStorage.getItem('bm_rows_v1')).filter(r => r[1] === '매칭채팅').length") >= 1)
    page.screenshot(path=OUT + '/v143_07_owner_room_closed.png')

    # ── 4. 마감된 글은 커뮤니티에서 내려감 (글쓴이)
    close_chat(page)
    check('마감되면 피드에서 내려감', page.evaluate("() => document.querySelectorAll('[data-post] .vite').length") == 0)
    check('내려간 이유 안내', '모집 중인 글이 없어요' in text_of(page, '#main'), text_of(page, '#main')[:160])
    page.screenshot(path=OUT + '/v143_08_owner_feed_hidden.png')

    # ── 5. 게스트: 단체방 → 나가기(확인 → 취소 → 확정)
    open_role(page, 'guest')
    page.click('#hdrChat')
    page.wait_for_timeout(600)
    check('수락된 게스트 대화 목록에 방', '게스트 모집 단체방' in text_of(page, '#dm'))
    page.click('[data-thread]')
    page.wait_for_timeout(600)
    check('게스트 방 현황 참여 2/2명', '참여 2/2명' in text_of(page, '.dm__meetbar'))
    check('게스트에게 나가기 버튼', page.evaluate("() => !!document.querySelector('[data-vite-leave]')"))
    page.screenshot(path=OUT + '/v143_09_guest_room.png')
    page.click('[data-vite-leave]')
    page.wait_for_timeout(400)
    check('나가기 확인 바', '나갈까요' in text_of(page, '[data-leavebar]'), text_of(page, '[data-leavebar]')[:160])
    page.screenshot(path=OUT + '/v143_10_leave_confirm.png')
    page.click('[data-act="leave-no"]')
    page.wait_for_timeout(300)
    check('취소하면 방 그대로', page.evaluate("() => !!document.querySelector('[data-vite-leave]')"))
    page.click('[data-vite-leave]')
    page.wait_for_timeout(300)
    page.click('[data-act="leave-yes"]')
    page.wait_for_timeout(800)
    check('나가면 대화 목록으로', '게스트 모집 단체방' not in text_of(page, '#dm'), text_of(page, '#dm')[:160])
    rows = rows_of(page)
    check('나가기 행 저장', page.evaluate("() => { const c = window.BM.domain.COL['소셜글']; return JSON.parse(localStorage.getItem('bm_rows_v1')).some(r => r[1] === '게스트신청' && String(r[c] || '').indexOf('나가기') >= 0); }"))
    check('나간 뒤 목록에 방 없음', page.evaluate("() => window.V143.store.state.data.threads.filter(t => t.kind === 'group').length") == 0)
    page.screenshot(path=OUT + '/v143_11_guest_left.png')

    # ── 6. 자리가 나서 글이 다시 올라옴
    close_chat(page)
    page.click('[data-topicfilter="전체"]')
    page.wait_for_timeout(300)
    check('나가면 글이 다시 올라옴', page.evaluate("() => document.querySelectorAll('[data-post] .vite').length") >= 1)
    check('다시 참여 신청 버튼', page.evaluate("() => !!document.querySelector('[data-vite-go=\"apply\"]')"))
    check('인원이 줄어 보임(참여 1/2명)', '참여 1/2명' in text_of(page, '.vite__row--cap'), text_of(page, '.vite__row--cap'))
    page.screenshot(path=OUT + '/v143_12_reopened.png')

    # ── 7. 거절 흐름
    page.click('[data-vite-go="apply"]')
    page.wait_for_timeout(400)
    page.fill('[data-guest-note]', '다시 신청합니다')
    page.click('[data-guest-send]')
    page.wait_for_timeout(700)
    check('다시 신청하면 대기', page.evaluate("() => !!document.querySelector('[data-vite-go=\"pending\"]')"))
    open_role(page, 'owner')
    page.click('#hdrChat')
    page.wait_for_timeout(600)
    check('글쓴이 받은 신청 도착', '받은 게스트 신청' in text_of(page, '#dm'))
    page.click('[data-guest-reject]')
    page.wait_for_timeout(700)
    check('거절하면 신청 사라짐', '받은 게스트 신청' not in text_of(page, '#dm'))
    check('거절 행 저장', page.evaluate("() => { const c = window.BM.domain.COL['소셜글']; return JSON.parse(localStorage.getItem('bm_rows_v1')).some(r => r[1] === '게스트신청' && String(r[c] || '').indexOf('거절') >= 0); }"))
    open_role(page, 'guest')
    check('거절된 신청자는 거절됨 표시', '신청 거절됨' in text_of(page, '[data-vite-go="rejected"]'), text_of(page, '[data-vite-go="rejected"]'))
    check('거절되면 정원 그대로(참여 1/2명)', '참여 1/2명' in text_of(page, '.vite__row--cap'))
    page.screenshot(path=OUT + '/v143_13_rejected.png')

    # ── 8. 글쓴이: 모집 종료(글 삭제) — 빈 방 정리
    open_role(page, 'owner')
    page.click('#hdrChat')
    page.wait_for_timeout(500)
    page.click('[data-thread]')
    page.wait_for_timeout(500)
    page.click('[data-vite-end]')
    page.wait_for_timeout(300)
    check('모집 종료 확인 바', '모집을 끝낼까요' in text_of(page, '[data-leavebar]'), text_of(page, '[data-leavebar]')[:160])
    page.screenshot(path=OUT + '/v143_14_end_confirm.png')
    page.click('[data-act="leave-yes"]')
    page.wait_for_timeout(800)
    check('모집 종료하면 글 삭제', not any(r[1] == '소셜' for r in rows_of(page)))
    check('모집 종료하면 방도 닫힘', page.evaluate("() => window.V143.store.state.ui.chatOpen !== true"))

    # ── 9. 진짜 앱(index.html) 회귀 — 5개 탭 · 지도 · CSP · 오류
    page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }")
    page.goto(BASE + 'index.html?chk=' + str(int(time.time())), wait_until='load')
    page.wait_for_timeout(1500)
    check('앱 버전 v1.43.0', page.evaluate('window.BM && BM.app && BM.app.version') == 'v1.43.0',
          page.evaluate('window.BM && BM.app && BM.app.version'))
    page.click('[data-act="guest"]')
    page.wait_for_timeout(1200)
    for _ in range(4):
        if page.query_selector('#sheet [data-close]'):
            page.click('#sheet [data-close]')
            page.wait_for_timeout(250)
    check('체험 모드 진입', page.evaluate("() => !!(window.BM.app.ctx && window.BM.app.ctx.store.state.ready)"))
    for tab, name in [('log', '일지 & AI'), ('matching', '매칭'), ('community', '커뮤니티'), ('coach', '코치'), ('my', 'MY')]:
        page.click('[data-tab="%s"]' % tab)
        page.wait_for_timeout(700)
        overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        check('%s 탭: 가로 넘침 없음' % name, overflow <= 0, overflow)
    page.click('[data-tab="matching"]')
    page.wait_for_timeout(600)
    check('체육관 지도 입구(v1.42.0) 그대로', page.evaluate("() => !!document.querySelector('[data-act=\"open-gym-map\"]')"))
    page.click('[data-act="open-gym-map"]')
    page.wait_for_timeout(1400)
    check('지도 화면: 체육관 3곳 이상', page.evaluate("() => document.querySelectorAll('.gympin, .gymcard, .gymitem').length") >= 3,
          page.evaluate("() => document.querySelectorAll('.gympin, .gymcard, .gymitem').length"))
    page.screenshot(path=OUT + '/v143_15_map_regress.png')
    page.click('[data-gym-close]')
    page.wait_for_timeout(500)
    # 진짜 앱에서도 게스트 모집 글 → 참여 신청 시트까지는 열려야 합니다
    page.click('[data-tab="community"]')
    page.wait_for_timeout(700)
    page.click('[data-topic="게스트 모집"]')
    page.wait_for_timeout(300)
    page.fill('[data-vitefield="cap"]', '4')
    page.fill('[data-composer]', '회귀 확인용 모집 글')
    page.click('[data-act="post"]')
    page.wait_for_timeout(800)
    check('진짜 앱: 내 모집 글에 단체방 열기', page.evaluate("() => !!document.querySelector('[data-vite-go=\"room\"]')"))
    page.screenshot(path=OUT + '/v143_16_app_community.png')

    check('앱 콘솔·페이지 오류 0건', len(errs) == 0, errs[:3])
    check('CSP 위반 0건', len(csp) == 0, csp[:2])
    check('막은 외부 요청은 구글 로그인뿐', len(blocked) <= 3, blocked)

    b.close()

fails = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(fails), len(checks)))
if fails:
    print('실패:', fails)
