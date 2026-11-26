"""bm-v1.85.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  A) 버전 — BM.app.version v1.84.0 · 5개 탭 · 시트 26칸 · 최신 기능(3D 라켓·응원 하트·체육관 후기·피로 점프) 살아 있음
  B) ① MY 하트 — 무료 하트 합계와 괄호 안 항의 합이 같다 · 광고 버튼에 보너스가 나뉜다
  C) ⑤ 내 라켓 — 여러 자루 저장 · MY 카드 두 줄 · 장력 칩 21~28 · theme.gears
  D) ② 게스트 모집 — 몇 명 2·4·6명 칩을 누르면 칸과 칩이 함께 켜진다
  E) ④ 1:1 매칭 — 첫 화면에 추천 카드가 바로 · 전체 선수 보기 버튼 1개
  F) ③ 1:1 채팅 — 매너 카드 기본 접힘(눌러서 펼침) · 코트 약속 시트에 체육관 칩·지도 고르기
  G) ⑥ 코트 점수판 — 가로 보기에 내 팀·상대 팀 배지
  H) 콘솔 오류 0 · CSP 위반 0 · 가로 넘침 0
  캡처: /workspace/downloads/live-1126-v184.png (+ 보조 캡처)

· 실행(저장소 루트에서):
  LD_LIBRARY_PATH=/workspace/.local/sysroot/usr/lib/x86_64-linux-gnu python3 test/live-v184.py
"""

import os
import re

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/?nocache=1'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = os.environ.get('V184_OUT', '/workspace/downloads')

errs, csp, checks = [], [], []


def ck(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:220]) if extra else ''), flush=True)
    checks.append((label, bool(cond)))


with sync_playwright() as p:
    os.makedirs(OUT, exist_ok=True)
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block')
    # 내 사이트는 그대로, 바깥 서비스(로그인·DB·지도 타일)만 막습니다
    ctx.route('**/*', lambda r: r.abort()
              if ('supabase.co' in r.request.url or 'accounts.google' in r.request.url
                  or 'tile.openstreetmap.org' in r.request.url)
              else r.continue_())
    pg = ctx.new_page()

    def on_c(m):
        if m.type != 'error':
            return
        if 'Content Security Policy' in m.text:
            csp.append(m.text[:200])
            return
        if 'net::ERR_' in m.text:
            return
        errs.append(m.text[:200])

    pg.on('console', on_c)
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:200]))

    pg.goto(BASE, wait_until='load')
    pg.wait_for_timeout(2500)
    pg.evaluate("""() => {
      localStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      const s = { kind: 'email', email: 'live184@example.com', name: '환비',
                  at: new Date().toISOString(), onboardedAt: '2026-11-26 16:00:00',
                  profile: { nick: '환비', level: 'B조', discipline: '복식', region: '경기',
                             club: '나래울체육관', onboardedAt: '2026-11-26 16:00:00' } };
      localStorage.setItem('bm_auth_v1', JSON.stringify(s));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    pg.reload(wait_until='load')
    pg.wait_for_timeout(3000)

    # ── A. 버전 · 기본 ─────────────────────────────────────────────
    ver = pg.evaluate("() => BM.app.version")
    ck('LIVE 버전 v1.84.0', ver == 'v1.85.0', ver)
    ck('LIVE 5개 탭', pg.evaluate("() => BM.app.TABS.map(t => t.id).join(',')")
       == 'log,matching,community,coach,my')
    ck('LIVE 시트 26칸', pg.evaluate("() => BM.domain.COLS.length") == 26)
    ck('LIVE 최신 기능 살아 있음 (3D 라켓·여러 자루·응원 하트·피로 점프·체육관 후기)', pg.evaluate("""() => {
      return typeof BM.racketcustom.openSheet === 'function'
        && typeof BM.gear.listOf === 'function' && BM.gear.MAX_RACKETS >= 5
        && typeof BM.views.chat.mannerHtml === 'function'
        && typeof BM.ai.fatigueJump === 'function'
        && BM.domain.POST_TOPICS.indexOf('체육관 후기') >= 0;
    }"""))

    # ── B. ① MY 하트 합계·부스트 구분 ─────────────────────────────
    pg.locator('[data-tab="my"]').first.click()
    pg.wait_for_timeout(1200)
    free = pg.locator('[data-free-line]').first.inner_text()
    m = re.search(r'무료 하트\s*(\d+)개 남음', free)
    paren = re.search(r'\(([^)]*)=\s*(\d+)개\)', free)
    total = int(m.group(1)) if m else -1
    inside = int(paren.group(2)) if paren else -2
    ck('LIVE 하트: 합계와 괄호 안 합이 같다', total > 0 and total == inside, free)
    nums = [int(x) for x in re.findall(r'\d+', paren.group(1))] if paren else []
    ck('LIVE 하트: 괄호 안 항의 합이 합계', sum(nums) == total, (nums, total))
    adsub = pg.locator('[data-ad-sub]').first.inner_text()
    ck('LIVE 하트: 광고 버튼에 광고 몫·보너스가 나뉜다', ('광고' in adsub) and ('보너스' in adsub or '완료' in adsub), adsub)
    boost = pg.evaluate("() => BM.ads.boostText({ boost: { equipped: true, bonus: 1 } })")
    ck('LIVE 하트: 꾸미기 부스트는 이름·혜택이 구분된다', '하트 부스트(꾸미기)' in boost and '출석·광고' in boost, boost)

    # ── C. ⑤ 내 라켓 여러 자루 ───────────────────────────────────
    pg.locator('[data-region="gear"]').first.scroll_into_view_if_needed()
    pg.wait_for_timeout(400)
    pg.locator('[data-act="gear-add"]').first.click()
    pg.wait_for_timeout(900)
    blocks = pg.locator('[data-gear-item]')
    ck('LIVE 라켓: 한 자루 더 누르면 두 칸', blocks.count() == 2, blocks.count())
    tens = pg.evaluate("""() => [...new Set([...document.querySelectorAll('[data-gear-pick="tension"]')]
      .map(b => Number(b.getAttribute('data-value'))))]""")
    ck('LIVE 라켓: 장력 칩이 21~28', tens and min(tens) == 21 and max(tens) == 28, (min(tens or [0]), max(tens or [0])))
    pg.evaluate("""() => {
      const items = document.querySelectorAll('[data-gear-item]');
      const put = (el, name, v) => { const n = el.querySelector('[data-gear="' + name + '"]'); if (n) n.value = v; };
      put(items[0], 'racket', '아스트록스 88D 프로'); put(items[0], 'string', 'BG80');
      put(items[0], 'tension', '26'); put(items[0], 'strungAt', BM.util.ymd()); put(items[0], 'cycleDays', '30');
      put(items[1], 'racket', '아크세이버 7 프로'); put(items[1], 'string', 'BG65');
      put(items[1], 'tension', '22'); put(items[1], 'strungAt', BM.util.ymd()); put(items[1], 'cycleDays', '45');
    }""")
    pg.locator('[data-gear-save]').first.click()
    pg.wait_for_timeout(1500)
    rows = pg.locator('[data-region="gear"] .gear__row')
    ck('LIVE 라켓: MY 카드에 두 자루', rows.count() == 2, rows.count())
    card = pg.locator('[data-region="gear"]').first.inner_text()
    ck('LIVE 라켓: 메인 표시·두 이름', ('메인' in card) and ('아스트록스' in card) and ('아크세이버' in card), card[:100])
    saved_gears = pg.evaluate("() => (BM.app.ctx.store.state.me.theme.gears || []).length")
    ck('LIVE 라켓: theme.gears 에 두 자루 저장', saved_gears == 2, saved_gears)
    # 테마를 바꿔도 두 자루가 남는지 (v1.82 gear 유지와 같은 자리)
    pg.evaluate("""() => { const st = BM.app.ctx.store;
      if (st.state.locks) st.state.locks.profile = 0;
      st.actions.setTheme('th_day'); }""")
    pg.wait_for_timeout(1200)
    after_theme = pg.evaluate("() => (BM.app.ctx.store.state.me.theme.gears || []).length")
    ck('LIVE 라켓: 테마를 바꿔도 두 자루 그대로', after_theme == 2, after_theme)
    pg.evaluate("() => { const el = document.querySelector('[data-region=\\'heart\\']'); if (el) el.scrollIntoView({ block: 'start' }); }")
    pg.wait_for_timeout(600)
    heart_top = pg.evaluate("""() => { const el = document.querySelector('[data-region="heart"]');
      return el ? Math.round(el.getBoundingClientRect().top) : -1; }""")
    if heart_top > 500:
        pg.evaluate("() => window.scrollTo(0, 0)")
        pg.wait_for_timeout(400)
    pg.screenshot(path=OUT + '/live-1126-v184.png')
    print('  saved ' + OUT + '/live-1126-v184.png', flush=True)
    pg.locator('[data-region="gear"]').first.scroll_into_view_if_needed()
    pg.wait_for_timeout(400)
    pg.screenshot(path=OUT + '/v185_live_gear.png')
    print('  saved ' + OUT + '/v185_live_gear.png', flush=True)

    # ── D. ② 게스트 모집 몇 명 칩 ─────────────────────────────────
    pg.locator('[data-tab="community"]').first.click()
    pg.wait_for_timeout(1200)
    pick = pg.locator('[data-topics] [data-topic]')
    ck('LIVE 커뮤니티: 말머리 칩에 게스트 모집', pg.locator('[data-topic="게스트 모집"]').count() > 0, pick.count())
    if pg.locator('[data-topic="게스트 모집"]').count():
        pg.locator('[data-topic="게스트 모집"]').first.scroll_into_view_if_needed()
        pg.locator('[data-topic="게스트 모집"]').first.click()
        pg.wait_for_timeout(1000)
    caps = pg.locator('[data-vitecap-val]')
    ck('LIVE 게스트 모집: 2·4·6명 칩 3개', caps.count() == 3, caps.count())
    if caps.count() >= 2:
        caps.nth(1).scroll_into_view_if_needed()
        caps.nth(1).click()
        pg.wait_for_timeout(600)
        val = pg.evaluate("""() => { const f = document.querySelector('[data-vitefield="cap"]');
          return f ? f.value : null; }""")
        on = pg.evaluate("""() => { const b = document.querySelector('[data-vitecap-val="4"]');
          return b ? b.classList.contains('is-on') : false; }""")
        ck('LIVE 게스트 모집: 4명을 누르면 칸·칩이 함께 켜진다', (val == '4') and on, (val, on))
        pg.screenshot(path=OUT + '/v185_live_community.png')
        print('  saved ' + OUT + '/v185_live_community.png', flush=True)

    # ── E. ④ 1:1 매칭 첫 화면 추천 ────────────────────────────────
    mykey = pg.evaluate("() => BM.app.ctx.store.state.me.key")
    pg.evaluate("""(mykey) => {
      const D = BM.domain, U = BM.util, now = U.stamp();
      const KEY = BM.auth.rowsKeyFor();
      const rows = U.readJSON(KEY, []) || [];
      const more = [
        { key: 'live184_other', nick: '콕집사', level: 'B조' },
        { key: 'live184_b', nick: '민턴러버', level: 'B조' },
        { key: 'live184_c', nick: '셔틀장인', level: 'C조' }
      ];
      more.forEach(function (o, i) {
        rows.push(D.toRow({ type: '프로필', id: 'lp' + i, userKey: o.key, nick: o.nick,
                            level: o.level, theme: { avatar: '🐧' }, createdAt: now }));
        rows.push(D.toRow({ type: '매칭프로필', id: 'lmp' + i, userKey: o.key, nick: o.nick,
                            level: o.level, createdAt: now,
                            payload: { region: '경기', discipline: '복식', gender: '남',
                                       experience: '3년', availability: '주말 09–12',
                                       bio: '같이 쳐요', level: o.level } }));
      });
      rows.push(D.toRow({ type: '친구수락', id: 'lfr1', userKey: mykey, target: 'live184_other', createdAt: now }));
      rows.push(D.toRow({ type: '매칭채팅', id: 'lm1', userKey: 'live184_other', target: mykey,
                          team: 'lfr1', text: '어제 경기 좋았어요', createdAt: now }));
      U.writeJSON(KEY, rows);
    }""", mykey)
    pg.reload(wait_until='load')
    pg.wait_for_timeout(3000)
    pg.locator('[data-tab="matching"]').first.click()
    pg.wait_for_timeout(1300)
    ck('LIVE 매칭: 첫 화면에 추천 카드(.pcards--rec)', pg.locator('.pcards--rec').count() > 0)
    ck('LIVE 매칭: 추천 표시(.resultbar__rec)', pg.locator('.resultbar__rec').count() > 0)
    rec_n = pg.locator('.pcards--rec .pcard').count()
    ck('LIVE 매칭: 추천 선수가 6명 이하로 바로 보인다', 0 < rec_n <= 6, rec_n)
    ck('LIVE 매칭: 안내 카드(.matchintro)는 걷어냄', pg.locator('.matchintro').count() == 0)
    allbtns = pg.get_by_role('button', name=re.compile('전체 선수 보기'))
    ck('LIVE 매칭: 전체 선수 보기 버튼 1개', allbtns.count() == 1, allbtns.count())
    pg.screenshot(path=OUT + '/v185_live_matching.png')
    print('  saved ' + OUT + '/v185_live_matching.png', flush=True)

    # ── F. ③ 1:1 채팅 매너 카드 접힘 · 코트 약속 칩 ────────────────
    pg.locator('[data-match-tab="chat"]').first.click()
    pg.wait_for_timeout(1200)
    item = pg.locator('li.room[data-open-chat]')
    ck('LIVE 채팅: 대화 목록에 방 1개', item.count() >= 1, item.count())
    if item.count():
        item.first.click()
        pg.wait_for_timeout(1200)
    has_fold = pg.locator('[data-manner-toggle]').count() > 0
    body_hidden = pg.evaluate("""() => { const b = document.querySelector('[data-manner-body]');
      return b ? b.hasAttribute('hidden') : null; }""")
    ck('LIVE 채팅: 매너 카드가 기본 접힘', has_fold and body_hidden is True, (has_fold, body_hidden))
    if has_fold:
        pg.locator('[data-manner-toggle]').first.scroll_into_view_if_needed()
        pg.locator('[data-manner-toggle]').first.click()
        pg.wait_for_timeout(600)
        open_now = pg.evaluate("""() => { const b = document.querySelector('[data-manner-body]');
          return b ? !b.hasAttribute('hidden') : null; }""")
        ck('LIVE 채팅: 눌러서 펼쳐진다', open_now is True, open_now)
        pg.screenshot(path=OUT + '/v185_live_chat.png')
        print('  saved ' + OUT + '/v185_live_chat.png', flush=True)
    apt = pg.locator('[data-dm-appt]')
    ck('LIVE 채팅: 약속 잡기 버튼이 있다', apt.count() > 0, apt.count())
    if apt.count():
        apt.first.scroll_into_view_if_needed()
        apt.first.click()
        pg.wait_for_timeout(900)
        chips = pg.locator('[data-apt-gyms] [data-apt-gym-pick]')
        ck('LIVE 채팅: 코트 약속 시트에 체육관 칩', chips.count() > 0, chips.count())
        ck('LIVE 채팅: 지도에서 고르기', pg.locator('[data-apt-gym-map]').count() > 0)
        pg.screenshot(path=OUT + '/v185_live_appt.png')
        print('  saved ' + OUT + '/v185_live_appt.png', flush=True)
        pg.evaluate("() => { if (BM.ui && BM.ui.closeSheet) BM.ui.closeSheet(); }")
        pg.wait_for_timeout(700)
    pg.evaluate("""() => { const st = BM.app.ctx.store;
      st.state.ui.chatOpen = false; st.state.ui.chatRoom = null;
      BM.app.repaint && BM.app.repaint();
      if (BM.ui && BM.ui.closeSheet) BM.ui.closeSheet();
      const s = document.getElementById('sheet');
      if (s) { s.classList.remove('is-on'); }
      document.body.classList.remove('no-scroll'); }""")
    pg.wait_for_timeout(700)
    # 실제 UI로 채팅 패널을 닫는다 (뒤로 → 닫기)
    for sel in ('[data-dm-back]', '[data-dm-close]'):
        btn = pg.locator(sel)
        if btn.count():
            try:
                btn.first.click(timeout=4000)
                pg.wait_for_timeout(600)
            except Exception:
                pass
    pg.wait_for_timeout(500)

    # ── G. ⑥ 코트 점수판 가로 보기 팀 배지 ────────────────────────
    pg.locator('[data-tab="log"]').first.click()
    pg.wait_for_timeout(1200)
    open_sb = pg.locator('[data-act="open-scoreboard"]')
    ck('LIVE 점수판: 열기 버튼', open_sb.count() > 0, open_sb.count())
    if open_sb.count():
        open_sb.first.scroll_into_view_if_needed()
        open_sb.first.click()
        pg.wait_for_timeout(1000)
        pg.locator('[data-sb-rotate]').first.click()
        pg.wait_for_timeout(800)
        tags = pg.evaluate("() => [...document.querySelectorAll('.sbfull .sb__tag')].map(t => t.textContent.trim())")
        ck('LIVE 점수판: 가로 보기에 내 팀·상대 팀 배지', ('내 팀' in tags) and ('상대 팀' in tags), tags)
        ck('LIVE 점수판: 가로 클래스', pg.evaluate("() => document.querySelector('.sbfull .sb').classList.contains('is-land')"))
        pg.screenshot(path=OUT + '/v185_live_scoreboard.png')
        print('  saved ' + OUT + '/v185_live_scoreboard.png', flush=True)
        pg.locator('[data-sb-close]').first.click()
        pg.wait_for_timeout(600)

    # ── H. 오류·넘침 ──────────────────────────────────────────────
    sw, iw = pg.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")
    ck('LIVE 390 가로 넘침 0', sw <= iw + 1, (sw, iw))
    ck('LIVE 콘솔 오류 0', len(errs) == 0, errs[:3])
    ck('LIVE CSP 위반 0', len(csp) == 0, csp[:2])
    b.close()

bad = [c for c in checks if not c[1]]
print('\n%d/%d 통과' % (len(checks) - len(bad), len(checks)), flush=True)
if bad:
    for label, _ in bad:
        print(' FAIL: ' + label)
