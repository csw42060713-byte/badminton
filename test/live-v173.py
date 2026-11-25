"""bm-v1.73.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.73.0 (sw.js · app.js · styles.css?v=20261125-2 · TWA 1.73.0/67) · 5개 탭 그대로
  2) 조환비 님 bm-v1.72.0 6건이 그대로 살아 있다 (영수증 빈 칸 · 대회 날짜 · 통증 드릴 · 접힘 묶음 · 리포트 · 자세 구간)
  3) 30일 연속 출석 — 하트 카드 30일 챔피언 안내 + 30일째 출석 +6(보너스 +5) + 🏆 해금
  4) 오늘의 하트 부스트 — 줄 표시 · 첫 광고 +2 · 충전 시트 1탭 버튼
  5) 📅 코트 약속 카드 — 시트에서 보내고, 상대 카드 좋아요 1탭 → 약속 확정
  6) 일지 약점 칩 수비 · 스티커 글씨 색 3종(골드가 캔버스에 실제로 그려짐)
  7) 오류 0 · CSP 위반 0 · 가로 넘침 0 (390·360) · 캡처 downloads/v173_live_*.png

실행(저장소 루트에서):
  python3 test/live-v173.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp, blocked = [], [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:240]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
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
            blocked.append(m.text[:300])
            return
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def shot(name):
        path = OUT + '/v173_live_' + name + '.png'
        page.screenshot(path=path)
        print('  saved ' + path, flush=True)
        return path

    def tap(sel, wait=450):
        el = page.locator(sel).first
        el.scroll_into_view_if_needed()
        el.click()
        page.wait_for_timeout(wait)

    def has(sel):
        return page.locator(sel).count() > 0

    def text_of(sel):
        n = page.locator(sel).first
        return n.inner_text() if n.count() else ''

    def toast():
        return text_of('#toast') if has('#toast') else ''

    def overflow():
        return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")

    # ── A. 라이브 파일 ──
    sw = page.request.get(BASE + 'sw.js').text()
    check('A 라이브 sw.js bm-v1.73.0', "var VERSION = 'bm-v1.73.0'" in sw, sw[-120:])
    app_src = page.request.get(BASE + 'app.js').text()
    check('A 라이브 app.js v1.73.0', "version: 'v1.73.0'" in app_src)
    index = page.request.get(BASE + 'index.html').text()
    check('A 라이브 styles.css?v=20261125-2', 'styles.css?v=20261125-2' in index)
    twa = page.request.get(BASE + 'manifest.webmanifest')
    check('A 라이브 매니페스트 200', twa.status == 200, twa.status)
    dom_src = page.request.get(BASE + 'js/domain.js').text()
    check('A 라이브 domain: 30일·오늘 부스트·약속 카드', 'days: 30, amount: 5' in dom_src
          and 'DAILY_BOOST' in dom_src and '[[APT]]' in dom_src)
    chat_src = page.request.get(BASE + 'js/views/chat.js').text()
    check('A 라이브 chat: 📅 약속 잡기', 'data-dm-appt' in chat_src and 'aptcard' in chat_src)
    sc_src = page.request.get(BASE + 'js/sharecard.js').text()
    check('A 라이브 sharecard: 스티커 글씨 3색 + 조환비 님 영수증·대회 날짜', 'STICKER_INKS' in sc_src
          and 'function dateField' in sc_src and 'function doneLine' in sc_src)
    ai_src = page.request.get(BASE + 'js/ai.js').text()
    check('A 라이브 ai: 수비 코칭 + 통증 안전 드릴', '수비 타이밍' in ai_src and 'PAIN_SAFE_DRILLS' in ai_src)

    # ── B. 부팅 ──
    page.goto(BASE, wait_until='load')
    page.evaluate("""() => {
      try {
        localStorage.clear(); sessionStorage.clear();
        localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
        localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live173@example.com', name: '승우',
          at: new Date().toISOString(), onboardedAt: '2026-11-25 09:00:00',
          profile: { nick: '승우', level: 'B조', discipline: '복식', region: '경기', club: '나래울체육관',
                     onboardedAt: '2026-11-25 09:00:00' } }));
        localStorage.setItem('bm_seen_v1', JSON.stringify(true));
      } catch (e) {}
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    check('B 라이브 앱 v1.73.0', page.evaluate("() => BM.app.version") == 'v1.73.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('B 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)
    w = overflow()
    check('B 390 가로 넘침 없음', w[0] <= w[1], w)

    # ── C. 30일 연속 출석 ──
    page.evaluate("""() => {
      const D = BM.domain, A = BM.auth, U = BM.util;
      const key = A.rowsKeyFor(), me = A.meKeyFor();
      const rows = [
        D.toRow({ id: 'p_me173', type: '프로필', createdAt: '2026-11-25 09:00:00', date: '2026-11-25',
                  nick: '승우', level: 'B조', discipline: '복식', userKey: me, theme: { theme: 'th_night', avatar: '🏸' } })
      ];
      for (let i = 29; i >= 1; i--) {
        const d = U.ymd(U.addDays(new Date(), -i));
        rows.push(D.toRow({ id: 'ck' + i, type: '출석하트', createdAt: d + ' 08:00:00', date: d,
                            nick: '승우', userKey: me, likes: 1 }));
      }
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    tap("#tabbar [data-tab='my']", 1000)
    hb = text_of('[data-region="heart"]')
    check('C 29일 연속 · 30일 챔피언 안내', '29일 연속' in hb and '30일까지' in hb and '배지' in hb,
          hb[:160].replace('\n', ' '))
    check('C 30일 보너스 +5 예고', '보너스 하트 +5' in hb, hb[:220].replace('\n', ' '))
    shot('c_heart_29')
    tap('[data-region="heart"] [data-act="checkin"]', 1300)
    t = toast()
    check('C 30일째 출석 +6 (보너스 +5)', '하트 +6' in t and '보너스 +5' in t, t)
    check('C 🏆 챔피언 배지 해금', page.evaluate(
        "() => { const m = BM.app.ctx.store.state; return BM.domain.ownsDeco(m.idx, m.me.key, 'badge:champ', m.data.hearts.checkinStreak); }"),
        page.evaluate("() => BM.app.ctx.store.state.data.hearts.checkinStreak"))
    shot('c_checkin_30')

    # ── D. 오늘의 하트 부스트 ──
    hb = text_of('[data-region="heart"]')
    check('D 하트 카드 부스트 줄', '오늘의 하트 부스트' in hb, hb[:240].replace('\n', ' '))
    check('D 광고 줄이 오늘 +2', '+2' in text_of('[data-region="heart"] [data-ad-sub]'),
          text_of('[data-region="heart"] [data-ad-sub]'))
    bal0 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    tap('[data-region="heart"] [data-act="ad"]', 600)
    page.wait_for_timeout(4400)
    t = toast()
    check('D 첫 광고 +2 (오늘 부스트 포함)', '하트 +2' in t and '오늘의 부스트 +1' in t, t)
    bal1 = page.evaluate("() => BM.app.ctx.store.state.data.hearts.balance")
    check('D 잔액 +2', bal1 == bal0 + 2, '%s → %s' % (bal0, bal1))
    check('D 받은 뒤 문구', '오늘의 하트 부스트 받음' in text_of('[data-region="heart"]'))
    shot('d_boost_done')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.hearts.balance = 0; st.data.hearts.nextAdInSec = 0; st.data.hearts.nextAdAt = 0;
      BM.ads.openHeartSheet(BM.app.ctx, { need: 2, intro: function (s) { return '<p>하트 2개</p>'; } });
    }""")
    page.wait_for_timeout(700)
    sheet = text_of('#sheet')
    check('D 충전 시트 부스트 줄 · 1탭 버튼', '오늘의 하트 부스트' in sheet and has('#sheet [data-charge="ad-fill"]'),
          sheet[:200].replace('\n', ' '))
    shot('d_charge_sheet')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── E. 📅 코트 약속 카드 ──
    page.evaluate("""() => {
      const D = BM.domain, A = BM.auth, U = BM.util;
      const key = A.rowsKeyFor(), me = A.meKeyFor();
      const peer = 'u_peer173';
      const rows = JSON.parse(localStorage.getItem(key) || '[]');
      rows.push(D.toRow({ id: 'p_peer173', type: '프로필', createdAt: '2026-11-25 09:01:00', date: '2026-11-25',
                          nick: '콕집사', userKey: peer, theme: { avatar: '🐧' } }));
      rows.push(D.toRow({ id: 'mp_peer173', type: '매칭프로필', createdAt: '2026-11-25 09:02:00', date: '2026-11-25',
                          userKey: peer, nick: '콕집사',
                          payload: { region: '경기', level: 'C조', discipline: '복식', club: '나래울' } }));
      rows.push(D.toRow({ id: 'room173', type: '매칭신청', createdAt: '2026-11-25 09:05:00', date: '2026-11-25',
                          userKey: me, target: peer, status: '수락',
                          payload: { note: '한 게임 해요', heartCost: 2, payOn: 'accept', charged: 0 } }));
      rows.push(D.toRow({ id: 'msg173a', type: '매칭채팅', createdAt: '2026-11-25 09:06:00', date: '2026-11-25',
                          userKey: peer, target: me, team: 'room173', text: '안녕하세요! 언제 치실래요?' }));
      rows.push(D.toRow({ id: 'msg173b', type: '매칭채팅', createdAt: '2026-11-25 09:20:00', date: '2026-11-25',
                          userKey: peer, target: me, team: 'room173',
                          text: D.apptText({ id: 'apt173', gym: '수원 실내체육관', date: '2026-11-28', time: '10:00', note: '주말 오전' }) }));
      localStorage.setItem(key, JSON.stringify(rows));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(3000)
    page.evaluate("() => BM.app.ctx.actions.openChat('room173', 'u_peer173')")
    page.wait_for_timeout(1000)
    panel = text_of('.dm__panel')
    check('E 📅 약속 잡기 버튼', has('[data-dm-appt]'), text_of('.dm__composer')[:80])
    check('E 상대 카드 + 좋아요 버튼', '수원 실내체육관' in panel and has('[data-apt-ok="apt173"]'),
          panel[-160:].replace('\n', ' '))
    check('E 원문(JSON) 표시 없음', '[[APT]]' not in panel)
    shot('e_appt_peer')
    tap('[data-dm-appt]', 700)
    check('E 약속 시트 체육관·날짜·시간', has('#sheet input[type="date"]') and has('#sheet input[type="time"]'))
    page.fill('#sheet [data-apt-field="gym"]', '나래울체육관')
    page.fill('#sheet [data-apt-field="date"]', '2026-11-27')
    page.fill('#sheet [data-apt-field="time"]', '19:00')
    page.wait_for_timeout(220)
    shot('e_appt_sheet')
    tap('[data-apt-send]', 1000)
    panel = text_of('.dm__panel')
    check('E 내 카드가 남고 답을 기다림', '나래울체육관' in panel and '답을 기다리는 중' in panel,
          panel[-200:].replace('\n', ' '))
    tap('[data-apt-ok="apt173"]', 1100)
    panel = text_of('.dm__panel')
    check('E 좋아요 → 약속 확정', '약속 확정' in panel, panel[-180:].replace('\n', ' '))
    check('E 확정 뒤 버튼 사라짐', not has('[data-apt-ok="apt173"]'))
    shot('e_appt_confirmed')
    page.evaluate("() => BM.app.ctx.actions.closeChats()")
    page.wait_for_timeout(600)

    # ── F. 수비 칩 · 스티커 3색 ──
    tap("#tabbar [data-tab='log']", 1000)
    chip = '#main [data-chipgroup="weakness"] [data-chip="수비"]'
    check('F 약점 칩 수비', has(chip))
    page.locator(chip).first.scroll_into_view_if_needed()
    page.wait_for_timeout(220)
    shot('f_log_weakness')
    page.locator(chip).first.click()
    page.wait_for_timeout(500)
    check('F 수비 선택', page.evaluate("() => BM.app.ctx.store.state.drafts.log.weakness.indexOf('수비') >= 0"))
    an = page.evaluate("() => { const s = BM.app.ctx.store.state; return BM.ai.analyze({ draft: s.drafts.log, records: s.data.records, level: s.me.level, discipline: s.me.discipline }); }")
    names = '|'.join(d['name'] for d in (an.get('drills') or {}).get('drills') or [])
    check('F 수비 코칭 드릴', '수비' in names, names)

    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.data.records = [{ id: 'rlive173', date: '2026-11-25', minutes: 90, cond: 8, intensity: 6,
        games: [{a:21,b:15},{a:18,b:21},{a:21,b:19}], team: JSON.stringify({ partner: '민호', rival: '지호' }), done: ['수비 드릴'] }];
    }""")
    page.evaluate("() => BM.sharecard.open(BM.app.ctx, { mode: 'today', record: BM.app.ctx.store.state.data.records[0] })")
    page.wait_for_timeout(1800)
    tap('[data-sc-design="sticker"]', 800)
    check('F 스티커 글씨 색 칸', page.locator('#sheet [data-sc-inkbox]').is_visible()
          and page.locator('#sheet [data-sc-ink]').count() == 3)
    tap('[data-sc-ink="gold"]', 700)
    check('F 골드 선택', page.evaluate("() => BM.sharecard._state().ink") == 'gold')
    cv = page.locator('#sheet .sc__canvas')
    cv.scroll_into_view_if_needed()
    page.wait_for_timeout(350)
    cv.screenshot(path=OUT + '/v173_live_sticker_gold.png')
    print('  saved ' + OUT + '/v173_live_sticker_gold.png', flush=True)
    gold = page.evaluate("""() => {
      const c = document.querySelector('#sheet .sc__canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] > 40 && d[i] > 220 && d[i+1] > 180 && d[i+1] < 240 && d[i+2] < 140) n++;
      }
      return n;
    }""")
    check('F 골드 글씨가 캔버스에 그려진다', gold > 200, gold)
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── G. 오류 · 넘침 ──
    check('G 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('G CSP 위반 0', len(csp) == 0, csp[:2])
    ow = overflow()
    check('G 가로 넘침 0 (390)', ow[0] <= ow[1], ow)
    page.set_viewport_size({'width': 360, 'height': 800})
    page.wait_for_timeout(600)
    ow2 = overflow()
    check('G 가로 넘침 0 (360)', ow2[0] <= ow2[1], ow2)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(400)
    shot('g_today')

    browser.close()

passed = sum(1 for _, c in checks if c)
print('\n%d/%d 통과' % (passed, len(checks)), flush=True)
raise SystemExit(0 if passed == len(checks) else 1)
