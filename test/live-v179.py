"""bm-v1.79.0 라이브 점검 (390×844) — 💛 응원 하트 · ⚡ 지난 운동 채우기 · 🏟️ 체육관 후기

· https://csw42060713-byte.github.io/badminton/ 를 실제로 열어 확인합니다.
  (Supabase·구글·지도 타일·CDN 요청은 막고, 기기 저장(local) 모드로 화면을 봅니다)
  A) 버전 — sw.js bm-v1.79.0 · app.js v1.79.0 · styles.css?v=20261126-1 · TWA 1.79.0/73 · 5개 탭
  B) 매칭 — 선수 카드의 '응원' 버튼 → 하트 1개 차감 · 상대에게 선물 도착(토스트)
     · 하트 0개일 때 → 공용 충전 시트(출석·광고)가 열리고 닫힌다
     · 프로필 시트의 '응원 하트 1개 보내기' · 친구 코드 초대 칩(복사)
  C) 일지 — 일지 저장 뒤 '⚡ 지난 운동 그대로 채우기'가 보이고, 누르면
     운동 시간·컨디션·강도·약점이 그대로 채워진다 (직전 일지 없으면 버튼 없음)
  D) 일지 첫 화면 — 폼이 시작하는 위치(px)를 재어 압축 확인
  E) 커뮤니티 — '체육관 후기' 말머리 → 네 칸 칩 → 올리기 → 후기 카드 · 필터 칩
  F) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360 · 라이트 테마)
· 실행: LD_LIBRARY_PATH=/workspace/tmp/syslibs/usr/lib/x86_64-linux-gnu python3 test/live-v179.py
"""

import os
import urllib.request

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V179_OUT', '/workspace/downloads')
SHOTS = os.environ.get('V179_SHOTS', '/workspace/check-shots')

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


def read(path):
    with urllib.request.urlopen(BASE + path, timeout=30) as r:
        return r.read().decode('utf-8')


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(SHOTS, exist_ok=True)
    browser = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                              is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                              accept_downloads=True)
    ctx.route('**/*', lambda route: route.abort()
              if ('supabase.co' in route.request.url or 'google' in route.request.url
                  or 'jsdelivr' in route.request.url or 'tile.openstreetmap.org' in route.request.url)
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

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def shot(name, keep=False):
        path = SHOTS + '/v179_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        if keep:
            page.screenshot(path=OUT + '/v179_' + name + '.png')
        return path

    def has(sel):
        return page.locator(sel).count() > 0

    def count(sel):
        return page.locator(sel).count()

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    def login(nick='승우'):
        page.evaluate("""(a) => {
          try {
            localStorage.clear(); sessionStorage.clear();
            localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
            const s = { kind: 'email', email: 'check179@example.com', name: a.nick,
                        at: new Date().toISOString(), onboardedAt: '2026-11-25 16:00:00',
                        profile: { nick: a.nick, level: 'B조', discipline: '복식', region: '경기',
                                   club: '나래울체육관', onboardedAt: '2026-11-25 16:00:00' } };
            localStorage.setItem('bm_auth_v1', JSON.stringify(s));
            localStorage.setItem('bm_seen_v1', JSON.stringify(true));
          } catch (e) {}
        }""", {'nick': nick})
        page.reload(wait_until='load')
        page.wait_for_timeout(2800)

    # ── A. 파일 · 버전 ──
    check('A sw.js bm-v1.79.0', "var VERSION = 'bm-v1.79.0'" in read('sw.js'))
    check('A index styles.css?v=20261126-1', 'styles.css?v=20261126-1' in read('index.html'))
    twa = read('twa-manifest.json')
    check('A TWA 1.79.0 · 코드 73',
          '"appVersionName": "1.79.0"' in twa and '"appVersionCode": 73' in twa)

    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(1600)
    login('승우')
    check('A 앱 버전 v1.79.0', page.evaluate("() => BM.app.version") == 'v1.79.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── C. 일지 — 직전 일지 없음 → 버튼 없음 ──
    tap("#tabbar [data-tab='log']", 700)
    check('C 기록이 없으면 채우기 버튼 없음', not has('[data-act="quick-fill"]'), count('[data-quickfill]'))
    form_y_before = page.evaluate("""() => {
      const f = document.querySelector('[data-form="log"]');
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return Math.round(r.top + window.scrollY);
    }""")
    print('  일지 폼 시작 y = ' + str(form_y_before), flush=True)

    # 첫 일지 저장
    page.fill('[data-field="minutes"]', '60')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.intensity = 6;
      st.drafts.log.weakness = ['풋워크'];
    }""")
    tap('[data-act="save-log"]', 1800)
    check('C 저장 뒤 AI 분석 카드', has('[data-region="analysis"]'))

    # ── C. 채우기 ──
    if not has('[data-act="quick-fill"]'):
        page.evaluate("() => BM.app.ctx.actions.resetDraft()")
        page.wait_for_timeout(500)
    check('C 지난 일지가 있으면 채우기 버튼', has('[data-act="quick-fill"]'))
    qtxt = text_of('[data-quickfill]')
    check('C 버튼에 지난 운동 요약', '지난 운동 그대로 채우기' in qtxt and '60분' in qtxt, qtxt[:120])
    page.evaluate("""() => { const n = document.querySelector('[data-quickfill]');
      if (n) n.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(300)
    shot('log_quickfill', keep=True)
    tap('[data-act="quick-fill"]', 700)
    vals = page.evaluate("""() => {
      const d = document.querySelector('[data-field="minutes"]');
      const st = BM.app.ctx.store.state.drafts.log;
      return { minutes: d ? d.value : '', cond: st.cond, intensity: st.intensity,
               weakness: st.weakness, note: st.note };
    }""")
    check('C 운동 시간이 그대로', str(vals['minutes']) == '60', vals)
    check('C 컨디션·강도가 그대로', vals['cond'] == 8 and vals['intensity'] == 6, vals)
    check('C 약점 칩이 그대로', vals['weakness'] == ['풋워크'], vals.get('weakness'))
    out_cond = text_of('[data-out="cond"]')
    check('C 화면에도 컨디션 표시', '7~8' in out_cond or '무난' in out_cond or '제대로' in out_cond, out_cond)
    page.evaluate("""() => { const n = document.querySelector('[data-quickfill]');
      if (n) n.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(300)
    shot('log_quickfill_done', keep=True)

    check('D 일지 폼이 첫 화면 안에서 시작 (740px 이하 · 압축 전 748)',
          form_y_before is not None and form_y_before < 740, form_y_before)

    # ── B. 매칭 — 응원 ──
    # 로컬(체험) 저장소에는 다른 회원이 없으므로, 응원 화면을 실제로 눌러 보려고
    # 테스트용 가상 회원 한 명을 이 기기 저장소에만 넣습니다(서버로 나가지 않음).
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util;
      /* 기기 저장(체험)은 계정별 키(bm_rows_v1::이메일)에 쌓입니다 */
      const rowsKey = Object.keys(localStorage).filter(k => k.indexOf('bm_rows_v1') === 0)[0] || 'bm_rows_v1';
      const rows = JSON.parse(localStorage.getItem(rowsKey) || '[]');
      const key = 'demo_cheer';
      rows.push(D.toRow({ id: U.uid(), type: '프로필', createdAt: '2026-11-25 10:00:00',
        nick: '콕집사', level: 'B조', discipline: '복식', userKey: key,
        bio: '응원 테스트용 가상 회원', theme: { avatar: '🐧' } }));
      rows.push(D.toRow({ id: U.uid(), type: '매칭프로필', createdAt: '2026-11-25 10:05:00',
        userKey: key, nick: '콕집사',
        payload: { region: '경기', level: 'B조', discipline: '복식', club: '나래울',
          availability: '주말', experience: '2~5년', bio: '응원 테스트용 가상 회원',
          avatar: '🐧', gender: '남성', avatarFrame: 'basic', avatarBg: 'plain', avatarBadge: '' } }));
      localStorage.setItem(rowsKey, JSON.stringify(rows));
      const st = BM.app.ctx.store.state;
      st.ui.matchStarted = true;
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2600)
    tap("#tabbar [data-tab='matching']", 900)
    if not has('[data-cheer]'):
        page.evaluate("""() => {
          const st = BM.app.ctx.store.state;
          st.ui.matchStarted = true;
          BM.app.ctx.actions.resetMatchFilter();
        }""")
        page.wait_for_timeout(600)
    ncards = count('[data-cheer]')
    print('  응원 버튼 수(다른 회원 카드) = ' + str(ncards), flush=True)
    check('B 선수 카드에 응원 버튼', ncards >= 1, ncards)
    check('B 친구 코드 초대 칩', has('.invitebar') and '#' in text_of('.invitebar'))
    invite = text_of('.invitebar')
    check('B 초대 칩에 코드·안내', '친구 코드' in invite and ('대화' in invite), invite[:160])
    shot('matching_invite', keep=True)

    if ncards:
        before = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
        tap('[data-cheer]', 900)
        after = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
        check('B 응원 한 번에 하트 1개', after == before - 1, (before, after))
        check('B 응원 토스트', '응원' in text_of('.toast') if has('.toast') else False)
        shot('matching_cheer', keep=True)

        # 프로필 시트의 응원 버튼도 확인
        tap('[data-open-profile]', 800)
        sheet_ok = has('[data-cheer-sheet]')
        check('B 프로필 시트에 응원 하트 버튼', sheet_ok)
        if sheet_ok:
            page.evaluate("""() => { const n = document.querySelector('[data-cheer-sheet]');
              if (n) n.scrollIntoView({ block: 'center' }); }""")
            page.wait_for_timeout(300)
            shot('matching_profile_cheer', keep=True)
            before2 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
            tap('[data-cheer-sheet]', 900)
            after2 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
            check('B 시트에서 응원도 하트 1개', after2 == before2 - 1, (before2, after2))
            # 시트 닫기 (시트 안 상단 X)
            page.evaluate("""() => {
              const btn = document.querySelector('.sheet [data-close]');
              if (btn) btn.click();
            }""")
            page.wait_for_timeout(600)
            vis = page.locator('[data-cheer-sheet]').first
            check('B 프로필 시트가 닫힌다', (vis.count() == 0) or (not vis.is_visible()))

        # 하트를 실제로 다 써서 0개로 만든 뒤 → 충전 시트
        page.evaluate("""() => {
          const a = BM.app.ctx.store.actions, st = BM.app.ctx.store.state;
          for (let i = 0; i < 12; i++) { st.locks = {}; a.giftHeart('demo_cheer'); }
        }""")
        page.wait_for_timeout(400)
        bal = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
        check('B 하트를 다 쓰면 0개', bal == 0, bal)
        tap('[data-cheer]', 900)
        check('B 모자라면 공용 충전 시트', has('[data-charge]'), count('[data-charge]'))
        sheet_txt = text_of('.sheet') if has('.sheet') else ''
        check('B 충전 시트에 출석·광고', ('출석 체크' in sheet_txt) and ('광고' in sheet_txt), sheet_txt[:200])
        shot('matching_charge', keep=True)
        page.evaluate("""() => { const b = document.querySelector('#sheet [data-close]'); if (b) b.click(); }""")
        page.wait_for_timeout(700)
        vis2 = page.locator('#sheet [data-charge="checkin"]').first
        check('B 충전 시트가 닫힌다', (vis2.count() == 0) or (not vis2.is_visible()))

    # ── E. 커뮤니티 — 체육관 후기 ──
    tap("#tabbar [data-tab='community']", 800)
    check('E 작성 말머리에 체육관 후기', has('[data-topic="체육관 후기"]'))
    check('E 목록 필터에 체육관 후기', has('[data-topicfilter="체육관 후기"]'))
    page.evaluate("""() => { const n = document.querySelector('[data-topic="체육관 후기"]');
      if (n) n.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(250)
    shot('community_topic', keep=True)
    tap('[data-topic="체육관 후기"]', 600)
    check('E 말머리를 고르면 후기 칸이 열린다', has('[data-gymform]:not([hidden])'))
    page.fill('[data-gymfield="name"]', '나래울 배드민턴장')
    for key, val in [('floor', '좋아요'), ('light', '보통'), ('parking', '아쉬워요'), ('shower', '좋아요')]:
        tap('[data-gympick="%s"][data-gymval="%s"]' % (key, val), 250)
    picked = page.evaluate("() => BM.app.ctx.store.state.ui.composerGym")
    check('E 네 칸이 작성 칸에 담긴다', picked.get('floor') == '좋아요' and picked.get('parking') == '아쉬워요', picked)
    page.fill('[data-composer]', '주차는 좁지만 코트 상태 좋아요')
    page.evaluate("""() => { const n = document.querySelector('[data-gymform]');
      if (n) n.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(300)
    shot('gym_review_form', keep=True)
    tap('[data-act="post"]', 1200)
    check('E 올린 글에 후기 카드', has('[data-gymreview]'))
    card = text_of('[data-gymreview]')
    check('E 후기 카드에 이름·네 칸', '나래울 배드민턴장' in card and '바닥' in card and '주차' in card, card[:200])
    check('E 글에 본문도 함께', '주차는 좁지만' in page.locator('[data-region="posts"]').first.inner_text())
    page.evaluate("""() => { const n = document.querySelector('[data-gymreview]');
      if (n) n.scrollIntoView({ block: 'center' }); }""")
    page.wait_for_timeout(300)
    shot('gym_review_post', keep=True)
    tap('[data-topicfilter="체육관 후기"]', 600)
    only = page.locator('[data-region="posts"] [data-post]').count()
    check('E 필터로 후기 글만 모아 보기', only == 1, only)
    page.evaluate("""() => { const n = document.querySelector('[data-region="posts"]');
      if (n) n.scrollIntoView({ block: 'start' }); }""")
    page.wait_for_timeout(300)
    shot('gym_review_filter', keep=True)
    tap('[data-topicfilter="전체"]', 500)

    # ── F. 넘침 · 라이트 테마 · 오류 ──
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 550)
        w = overflow()
        check('F %s 탭 가로 넘침 0 (390)' % tab, w[0] <= w[1], w)
    tap("#tabbar [data-tab='log']", 700)
    page.evaluate("() => { document.documentElement.setAttribute('data-theme', 'th_def'); }")
    page.wait_for_timeout(400)
    shot('log_light', keep=True)
    w = overflow()
    check('F 라이트 테마 가로 넘침 0 (390)', w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(700)
    w2 = overflow()
    check('F 360 가로 넘침 0', w2[0] <= w2[1], w2)
    shot('log_360')
    check('F 앱 오류 0', len(errs) == 0, errs[:3])
    check('F CSP 위반 0', len(csp) == 0, csp[:2])

    browser.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
