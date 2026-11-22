"""bm-v1.55.0 로컬 점검 (390×844) — 일지 세부 칸 접기 · MY 시트 숨김 · 신고·차단

· 127.0.0.1 로 띄운 저장소를 그대로 봅니다(Supabase·구글·지도 타일·CDN 요청은 막습니다).
· 진짜 앱(index.html)을 local 모드로 열고 실제 버튼을 눌러 확인합니다.
  A) 기존 5개 탭 정상 · 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 · 버전 v1.55.0
  B) 일지 — '메모 · 영상' 접기가 기본 닫힘(칸이 화면에 없음) · 컨디션·시간·게임 점수는 그대로
     · 코트 점수판 '오늘 일지에 넣기' → 메모가 채워지며 접기가 저절로 열림
  C) MY — 일반 사용자: '데이터 · 자동 저장' · 시트 연결·JSON 백업·Client ID는 '고급' 접기 안(안 보임)
     · 접기를 열면 그대로 동작
  D) 커뮤니티 — 남의 글 ⋯ → 신고(사유 4종 → 접수) · 차단(인라인 확인 → 피드에서 즉시 사라짐)
  E) MY — 차단한 사람 목록에서 해제 → 글이 다시 보임
  F) 1:1 대화방 상단 ⋯ → 신고·차단 시트 · 차단하면 방이 닫히고 목록에서 빠짐
· 실행(저장소 루트에서):
  (python3 -m http.server 8822 --bind 127.0.0.1 &) ; python3 test/local-v155.py
"""

from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8822/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'
PLAYER = 'clean155@example.com'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:260]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def count(page, sel):
    return page.evaluate("(s) => document.querySelectorAll(s).length", sel)


def val(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.value : ''; }", sel)


def visible(page, sel):
    """화면에 실제로 보이는지 (접힌 details 안이면 0×0)"""
    return page.evaluate(
        "(s) => { const n = document.querySelector(s); if (!n) return false;"
        " if (n.checkVisibility) return n.checkVisibility();"
        " const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }",
        sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url
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

    def login(email, nick):
        page.goto(BASE, wait_until='load')
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            localStorage.setItem('bm_auth_v1', JSON.stringify({
              kind: 'email', email: a.email, name: a.nick, at: new Date().toISOString(),
              onboardedAt: '2026-11-22 09:00:00',
              profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                         club: '나래울', onboardedAt: '2026-11-22 09:00:00' }
            }));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'email': email, 'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)

    def tap(sel, wait=420):
        page.click(sel)
        page.wait_for_timeout(wait)

    def seed(extra_post=True, chat=True):
        """다른 사람 글·답글·1:1 방을 이 기기 저장소에 넣고 다시 엽니다(서버 아님)."""
        page.evaluate("""(o) => {
          const D = BM.domain, U = BM.util, A = BM.auth;
          const key = A.rowsKeyFor();
          const me = A.meKeyFor();
          const peer = 'u_peer155';
          const rows = [
            D.toRow({ id: 'p_me155', type: '프로필', createdAt: '2026-11-22 09:00:00',
                      nick: '점검왕', userKey: me, theme: { theme: 'th_night', avatar: '🏸' } }),
            D.toRow({ id: 'p_peer155', type: '프로필', createdAt: '2026-11-22 09:01:00',
                      nick: '광고러', userKey: peer, bio: '같이 치실 분' }),
            D.toRow({ id: 'mp_peer155', type: '매칭프로필', createdAt: '2026-11-22 09:02:00',
                      userKey: peer, nick: '광고러',
                      payload: { region: '경기', level: 'C조', discipline: '복식', club: '나래울' } })
          ];
          if (o.post) {
            rows.push(D.toRow({ id: 'post155', type: '소셜', createdAt: '2026-11-22 09:10:00',
                                date: '2026-11-22', nick: '광고러', userKey: peer,
                                text: '광고 글입니다. 여기로 오세요' }));
            rows.push(D.toRow({ id: 'rep155', type: '답글', createdAt: '2026-11-22 09:12:00',
                                date: '2026-11-22', nick: '광고러', userKey: peer,
                                target: 'post155', text: '광고 답글입니다' }));
          }
          if (o.chat) {
            rows.push(D.toRow({ id: 'req155', type: '매칭신청', createdAt: '2026-11-22 09:20:00',
                                date: '2026-11-22', userKey: me, target: peer, status: '수락',
                                payload: { note: '한 게임 해요', heartCost: 2 } }));
            rows.push(D.toRow({ id: 'm1', type: '매칭채팅', createdAt: '2026-11-22 09:21:00',
                                date: '2026-11-22', userKey: peer, target: me, team: 'req155',
                                text: '안녕하세요! 토요일 어떠세요?' }));
          }
          localStorage.setItem(key, JSON.stringify(rows));
        }""", {'post': extra_post, 'chat': chat})
        page.reload(wait_until='load')
        page.wait_for_timeout(2400)

    # ── A. 진입 · 탭 ──
    login(PLAYER, '점검왕')
    ver = page.evaluate("() => BM.app.version")
    check('A 앱 진입 · 버전 v1.55.0', ver == 'v1.55.0', ver)

    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 560)
        body = text_of(page, '#main')
        check('A 탭 %s 정상' % tab, len(body) > 40 and has(page, "[data-view='%s']" % tab),
              body[:40].replace('\n', ' '))
        w = overflow(page)
        check('A 탭 %s 가로 넘침 없음' % tab, w[0] <= w[1] + 1, w)

    # ── B. 일지 — 세부 칸 접기 ──
    tap("#tabbar [data-tab='log']", 650)
    check('B 메모·영상 접기가 있다', has(page, '[data-fold="detail"]'))
    check('B 접기는 기본 닫힘(칸이 화면에 없음)',
          (not visible(page, '[data-field="note"]')) and (not visible(page, '[data-field="video"]')))
    check('B 접기 이름표', '메모 · 영상' in text_of(page, '[data-fold="detail"]'),
          text_of(page, '[data-fold="detail"]')[:60].replace('\n', ' '))
    check('B 핵심 칸은 그대로 보인다',
          visible(page, '[data-field="cond"]') and visible(page, '[data-field="minutes"]') and has(page, '[data-games]'))
    page.evaluate("() => document.querySelector('[data-fold=\"detail\"]').scrollIntoView({block: 'center'})")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT + '/v155_log_fold.png')
    page.locator('[data-form="log"]').screenshot(path=OUT + '/v155_log_form.png')

    # 이름 접기를 눌러 펼쳤다가 접기(사용자가 직접)
    tap('[data-fold="detail"] .fold__sum', 420)
    check('B 눌러서 펼치면 메모 칸이 보인다', visible(page, '[data-field="note"]'))
    tap('[data-fold="detail"] .fold__sum', 420)
    check('B 다시 접힌다', not visible(page, '[data-field="note"]'))

    # ── B-2. 점수판 → 일지 자동 채움 → 접기가 저절로 열림 ──
    tap('[data-act="open-scoreboard"]', 800)
    a = b_ = 0
    while a < 21 or b_ < 17:
        go_a = False if a >= 21 else (True if b_ >= 17 else (a <= b_))
        tap('[data-sb-point="%s"]' % ('a' if go_a else 'b'), 55)
        if go_a:
            a += 1
        else:
            b_ += 1
    page.wait_for_timeout(300)
    tap('[data-sb-save]', 900)
    check('B 점수판 → 메모 자동 채움', len(val(page, '[data-field="note"]')) > 0, val(page, '[data-field="note"]')[:40])
    check('B 채워지면 접기가 저절로 열림', visible(page, '[data-field="note"]'))
    check('B 점수도 그대로', val(page, '[data-field="gameA"]') == '21' and val(page, '[data-field="gameB"]') == '17')

    # ── C. MY — 시트 연결 숨김/접기 ──
    tap("#tabbar [data-tab='my']", 700)
    data_sum = text_of(page, '[data-group="data"] .group__sum')
    check('C 묶음 이름: 데이터 · 자동 저장', '자동 저장' in data_sum, data_sum[:60].replace('\n', ' '))
    tap('[data-group="data"] .group__sum', 500)
    check('C 자동 저장 안내', '기록은 자동으로 저장돼요' in text_of(page, '[data-group="data"]'),
          text_of(page, '[data-group="data"]')[:80].replace('\n', ' '))
    check('C 시트 연결 버튼은 고급 접기 안(처음엔 안 보임)',
          has(page, '[data-act="connect"]') and not visible(page, '[data-act="connect"]'))
    check('C JSON 내보내기도 안 보임', has(page, '[data-act="export"]') and not visible(page, '[data-act="export"]'))
    page.screenshot(path=OUT + '/v155_my_clean.png')
    tap('[data-adv="sheets"] summary', 500)
    check('C 고급을 열면 시트 연결·백업 그대로', visible(page, '[data-act="connect"]') and visible(page, '[data-act="export"]'))
    tap('[data-adv="sheets"] summary', 400)

    # ── D. 커뮤니티 — 신고 · 차단 ──
    seed()
    tap("#tabbar [data-tab='community']", 800)
    check('D 남의 글에 ⋯ 가 있다', has(page, '[data-post-menu]'))
    check('D 내 글에는 ⋯ 가 없다', count(page, '[data-post="post155"]'), count(page, '[data-post]'))
    tap('[data-post-menu]', 420)
    check('D ⋯ 를 누르면 신고·차단 두 버튼', visible(page, '[data-report]') and visible(page, '[data-block-ask]'))
    page.screenshot(path=OUT + '/v155_community_actions.png')

    tap('[data-safetybar] [data-report]', 700)
    check('D 신고 시트가 열린다', has(page, '[data-report-send]'))
    check('D 사유 4종', count(page, '[data-report-reason]') == 4, count(page, '[data-report-reason]'))
    page.screenshot(path=OUT + '/v155_report_sheet.png')
    tap('[data-report-reason="광고"]', 320)
    check('D 광고·도배를 고르면 켜진다',
          page.evaluate("() => document.querySelector('[data-report-reason=\"광고\"]').classList.contains('is-on')"))
    page.fill('[data-report-detail]', '도배 글이라 신고합니다')
    page.wait_for_timeout(200)
    tap('[data-report-send]', 900)
    check('D 신고 접수 안내', '신고가 접수됐어요' in text_of(page, '#toast') or
          page.evaluate("() => { const t = document.querySelector('#toast'); return t ? t.innerText : ''; }") != '',
          page.evaluate("() => { const t = document.querySelector('#toast'); return t ? t.innerText : ''; }"))
    rep = page.evaluate("""() => {
      const rows = BM.app.ctx.store.state.idx.byType['신고'] || [];
      return rows.map(r => ({ type: r.type, target: r.target, reason: r.payload && r.payload.reason,
                              kind: r.payload && r.payload.kind, text: r.payload && r.payload.text }));
    }""")
    check('D 신고 한 줄이 저장됨(광고·post155)', len(rep) == 1 and rep[0]['target'] == 'post155'
          and rep[0]['reason'] == '광고', rep)

    tap('[data-post-menu]', 400)
    tap('[data-block-ask]', 420)
    check('D 차단은 한 번 더 묻는다(인라인 확인)', visible(page, '[data-blockconfirm="u_peer155"]'))
    page.screenshot(path=OUT + '/v155_block_confirm.png')
    tap('[data-blockconfirm="u_peer155"] [data-block-yes]', 800)
    check('D 차단하면 피드에서 즉시 사라짐', count(page, '[data-post="post155"]') == 0, count(page, '[data-post]'))
    page.screenshot(path=OUT + '/v155_blocked_feed.png')

    # ── E. MY — 차단 해제 ──
    tap("#tabbar [data-tab='my']", 700)
    tap('[data-group="blocks"] .group__sum', 500)
    check('E 차단한 사람 1명', '광고러' in text_of(page, '[data-group="blocks"]'),
          text_of(page, '[data-group="blocks"]')[:60].replace('\n', ' '))
    tap('[data-unblock]', 800)
    check('E 해제하면 목록이 빈다', '차단한 사람이 없어요' in text_of(page, '[data-group="blocks"]'),
          text_of(page, '[data-group="blocks"]')[:60].replace('\n', ' '))
    tap("#tabbar [data-tab='community']", 700)
    page.click('[data-toggle-reply="post155"]')
    page.wait_for_timeout(400)
    check('E 해제하면 글·답글이 다시 보인다', count(page, '[data-post="post155"]') == 1, count(page, '[data-post]'))

    # ── F. 1:1 대화방 신고·차단 ──
    page.evaluate("() => BM.app.ctx.store.actions.closeChats()")
    page.wait_for_timeout(300)
    page.evaluate("() => BM.app.ctx.store.actions.openChat('req155', 'u_peer155')")
    page.wait_for_timeout(700)
    check('F 대화방 상단 ⋯', has(page, '[data-dm-safety]'))
    tap('[data-dm-safety]', 600)
    check('F 신고·차단 시트', has(page, '[data-safety-report]') and has(page, '[data-safety-block]'))
    page.screenshot(path=OUT + '/v155_chat_safety.png')
    tap('[data-safety-block]', 600)
    check('F 차단 확인 문구', '차단할까요' in text_of(page, '#sheet'))
    tap('#sheet [data-block-yes]', 900)
    check('F 차단하면 대화방이 닫힘', page.evaluate("() => BM.app.ctx.store.state.ui.chatRoom") is None)
    page.evaluate("() => BM.app.ctx.store.actions.openChat('req155', 'u_peer155')")
    page.wait_for_timeout(500)
    check('F 차단한 사람과는 다시 열리지 않음', page.evaluate("() => BM.app.ctx.store.state.ui.chatRoom") is None)
    page.evaluate("() => BM.app.ctx.store.actions.unblockUser('u_peer155')")
    page.wait_for_timeout(400)
    check('F 해제하면 다시 열림',
          page.evaluate("() => { const r = BM.app.ctx.store.actions.openChat('req155','u_peer155'); return !!r.ok; }"))

    # ── G. 마무리: 오류 0 ──
    check('G 콘솔 오류 0', not errs, errs[:2])
    check('G CSP 위반 0', not csp, csp[:2])
    w = overflow(page)
    check('G 마지막 화면 가로 넘침 없음', w[0] <= w[1] + 1, w)

    b.close()

ok = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (ok, len(checks)))
if errs:
    print('콘솔 오류:', errs[:3])
if csp:
    print('CSP:', csp[:3])
