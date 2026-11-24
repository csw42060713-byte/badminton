"""bm-v1.64.0 라이브 점검 (390×844) — https://csw42060713-byte.github.io/badminton/

  1) 라이브가 bm-v1.64.0 (sw.js·app.js) · 5개 탭
  2) MY 하트 지갑: 연속 출석 다음 보너스(3·7·14일) · 하트 부스트 줄
  3) 하트 부스트 열고 켜기 → '적용 중(+1) · 출석·광고 +1' · 출석 +2
  4) 광고 미리보기 보상 +2 → 적립 +2
  5) 어제·그제 출석을 넣고 3일째 출석 → 보너스 +1 포함 하트 +3 · 행 메모(streak:)
  6) 일지 저장 직후 히어로(이번 달 N분·승률·최근 2주) 즉시 갱신 + 인스타 칩도 방금 일지
  7) 대회 인증 카드 챔피언 골드 프레임 칩 · 금빛 테두리/월계관
  8) 라이트 테마 · 360 폭 · 콘솔 오류 0 · CSP 0 · 가로 넘침 0

실행(저장소 루트에서):
  python3 test/live-v164.py
"""

import os

from playwright.sync_api import sync_playwright

BASE = 'https://csw42060713-byte.github.io/badminton/'
EXE = '/workspace/tmp/chrome159/chrome-headless-shell-linux64/chrome-headless-shell'
OUT = '/workspace/downloads'

checks, errs, csp = [], [], []


def check(label, cond, extra=''):
    print(('OK   ' if cond else 'FAIL ') + label + ((' :: ' + str(extra)[:200]) if extra else ''))
    checks.append((label, bool(cond)))


def text_of(page, sel):
    return page.evaluate("(s) => { const n = document.querySelector(s); return n ? n.innerText : ''; }", sel)


def has(page, sel):
    return page.evaluate("(s) => !!document.querySelector(s)", sel)


def overflow(page):
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE if os.path.exists(EXE) else None)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                        is_mobile=True, has_touch=True, locale='ko-KR', service_workers='block',
                        accept_downloads=True)
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
        if 'net::ERR_' in m.text:
            return
        errs.append(m.text[:300])

    page.on('console', on_console)
    page.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)[:300]))
    page.on('dialog', lambda d: (errs.append('DIALOG: ' + d.message), d.dismiss()))

    def tap(sel, wait=450):
        page.click(sel)
        page.wait_for_timeout(wait)

    def shot(name):
        path = OUT + '/v164_live_' + name + '.png'
        page.screenshot(path=path)
        return path

    def hearts():
        return page.evaluate("() => BM.app.ctx.store.state.data.hearts")

    # ── A. 라이브 버전 ──
    page.goto(BASE, wait_until='load')
    page.wait_for_timeout(900)
    sw = page.evaluate("async () => (await fetch('sw.js', {cache: 'reload'})).text()")
    check('A 라이브 sw.js bm-v1.64.0', "var VERSION = 'bm-v1.64.0'" in sw, sw[:120].replace('\n', ' '))
    page.evaluate("""() => {
      localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('bm_backend_v1', JSON.stringify('local'));
      localStorage.setItem('bm_auth_v1', JSON.stringify({ kind: 'email', email: 'live164@example.com',
        name: '라이브점검', at: new Date().toISOString(), onboardedAt: '2026-11-24 09:00:00',
        profile: { nick: '라이브점검', level: 'B조', discipline: '복식', region: '경기', club: '나래울',
                   onboardedAt: '2026-11-24 09:00:00' } }));
      localStorage.setItem('bm_seen_v1', JSON.stringify(true));
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2800)
    check('A 앱 버전 v1.64.0', page.evaluate("() => BM.app.version") == 'v1.64.0',
          page.evaluate("() => BM.app.version"))
    tabs = page.evaluate("() => BM.app.TABS.map(t => t.id)")
    check('A 5개 탭 그대로', tabs == ['log', 'matching', 'community', 'coach', 'my'], tabs)

    # ── B. MY 하트 지갑 ──
    tap("#tabbar [data-tab='my']", 900)
    card = text_of(page, '[data-region="heart"]')
    check('B 3·7·14일 안내', '3일·7일·14일' in card, card[:120])
    check('B 다음 보너스 남은 날', '3일 더 하면 보너스 하트 +1' in card)
    check('B 하트 부스트 줄', '하트 부스트' in card and '하트 3개로 열기' in card)
    shot('B-my')

    # ── C. 하트 부스트 ──
    tap('[data-region="boost"] [data-act="boost"]', 900)
    h = hearts()
    check('C 부스트 해금·적용', h['boost']['owned'] and h['boost']['equipped'] and h['boost']['bonus'] == 1, h['boost'])
    card = text_of(page, '[data-region="heart"]')
    check('C 적용 중(+1) · 출석 +2', '적용 중(+1) · 출석·광고 +1' in card and '+2 · 하루 1회' in card,
          card[:160])
    tap('[data-act="checkin"]', 800)
    h = hearts()
    check('C 첫 출석 +2', h['balance'] == 2 and h['checkinStreak'] == 1, {'b': h['balance'], 's': h['checkinStreak']})

    # ── D. 광고 미리보기 (부스트 +2) ──
    tap('[data-act="ad"]', 600)
    check('D 미리보기 하트 2개', '하트 2개' in text_of(page, '.ad-sim'), text_of(page, '.ad-sim')[:120])
    page.wait_for_timeout(3600)
    check('D 광고 적립 +2', hearts()['balance'] == 4, hearts()['balance'])

    # ── E. 3일 연속 보너스 (어제·그제 출석 주입) ──
    page.evaluate("""() => {
      const D = BM.domain, U = BM.util, me = BM.app.ctx.store.state.me.key, key = BM.auth.rowsKeyFor();
      const day = (n) => { const d = new Date(); d.setDate(d.getDate() - n);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
      const today = day(0);
      /* 오늘 출석(C에서 이미 함)은 빼고, 어제·그제만 남겨 '내일이 3일째' 상태로 */
      const rows = (U.readJSON(key, []) || []).filter((r) =>
        !(r[D.COL['유형']] === '출석하트' && r[D.COL['날짜']] === today));
      [1, 2].forEach((n) => { const k = day(n);
        rows.push(D.toRow({ type: '출석하트', id: 'l' + k, clientId: 'l' + k, date: k,
                            createdAt: k + ' 08:00:00', nick: '라이브점검', userKey: me, likes: 1 })); });
      U.writeJSON(key, rows);
    }""")
    page.reload(wait_until='load')
    page.wait_for_timeout(2500)
    tap("#tabbar [data-tab='my']", 800)
    h = hearts()
    check('E 어제까지 2일 연속', h['checkinStreak'] == 2, h['checkinStreak'])
    before = h['balance']
    tap('[data-act="checkin"]', 900)
    h = hearts()
    check('E 3일째 = 1 + 부스트 1 + 보너스 1', h['balance'] == before + 3, {'b': before, 'a': h['balance']})
    check('E MY 카드 3일 연속 · 4일 더 하면 +2', '3일 연속 출석 중' in text_of(page, '[data-region="heart"]')
          and '4일 더 하면 보너스 하트 +2' in text_of(page, '[data-region="heart"]'))
    note = page.evaluate("""() => {
      const st = BM.app.ctx.store.state, D = BM.domain;
      return st.rows.filter(r => r[D.COL['유형']] === '출석하트').map(r => r[D.COL['소셜글']] || '').filter(Boolean).join(' | ');
    }""")
    check('E 행 메모에 보너스 + streak 키', '3일 연속 출석 보너스' in note and 'streak:' in note, note)
    shot('E-streak')

    # ── F. 일지 저장 직후 히어로 ──
    tap("#tabbar [data-tab='log']", 800)
    before_hero = text_of(page, '.card--hero .stat-strip')
    page.fill('[data-field="minutes"]', '80')
    page.evaluate("""() => {
      const st = BM.app.ctx.store.state;
      st.drafts.log.cond = 8;
      st.drafts.log.games = [{ a: '21', b: '18' }];
    }""")
    tap('[data-act="save-log"]', 1600)
    after_hero = text_of(page, '.card--hero .stat-strip')
    check('F 저장 직후 이번 달 80분', '80' in after_hero and after_hero != before_hero,
          {'before': before_hero.replace('\n', ' '), 'after': after_hero.replace('\n', ' ')})
    latest = page.evaluate("() => { const r = BM.views.log.shareRecordOf(BM.app.ctx.store.state, 'log-hero'); return r ? r.minutes : null; }")
    check('F 인스타 칩 = 방금 저장한 일지', latest == 80, latest)
    shot('F-hero')

    # ── G. 대회 카드 챔피언 프레임 ──
    tap('[data-act="share-card"][data-share-entry="log-hero"]', 900)
    check('G 공유 시트', has(page, '.sc__canvas'))
    tap('[data-sc-mode="comp"]', 700)
    frame_txt = text_of(page, '[data-sc-framebox]')
    check('G 프레임 칩 · 하트 2', '카드 프레임' in frame_txt and '챔피언 골드' in frame_txt and '하트 2' in frame_txt,
          frame_txt[:120])
    tap('[data-sc-frame="champ"]', 1000)
    check('G 챔피언 선택', page.evaluate("() => BM.sharecard._state()['frame']") == 'champ')
    gold = page.evaluate("""() => {
      const c = document.querySelector('.sc__canvas'); if (!c) return -1;
      const g = c.getContext('2d');
      const d = g.getImageData(0, Math.round(c.height * 0.5), c.width, 1).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 180 && d[i + 1] > 140 && d[i + 2] < 160 && d[i + 3] > 40) n++;
      }
      return n;
    }""")
    check('G 금빛 테두리 그려짐', gold > 0, gold)
    shot('G-champ')
    page.evaluate("() => BM.ui.closeSheet()")
    page.wait_for_timeout(400)

    # ── H. 라이트 · 360 · 넘침 · 오류 ──
    page.evaluate("() => document.documentElement.setAttribute('data-theme', 'th_def')")
    page.wait_for_timeout(350)
    for tab in ['log', 'matching', 'community', 'coach', 'my']:
        tap("#tabbar [data-tab='%s']" % tab, 520)
        w = overflow(page)
        check('H %s 넘침 0 (390)' % tab, w[0] <= w[1], w)
    page.set_viewport_size({'width': 360, 'height': 780})
    page.wait_for_timeout(400)
    w = overflow(page)
    check('H 360 폭 넘침 0', w[0] <= w[1], w)
    tap("#tabbar [data-tab='my']", 500)
    shot('H-360-my')
    check('H 콘솔 오류 0', len(errs) == 0, errs[:3])
    check('H CSP 위반 0', len(csp) == 0, csp[:2])

    b.close()

passed = sum(1 for _, ok_ in checks if ok_)
print('\n%d/%d 통과' % (passed, len(checks)))
if passed != len(checks):
    print('실패:', [l for l, ok_ in checks if not ok_])
